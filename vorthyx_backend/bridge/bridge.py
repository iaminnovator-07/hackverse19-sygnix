#!/usr/bin/env python3
"""VORTHYX laptop bridge - the "EARTH end node" software.

Reads the serial output of the EARTH gateway ESP32 (node id 0) - and optionally other boards plugged into the laptop -
and turns the raw `EVT {...}` lines into: a live event stream, mesh status (nodes / links / queues), delivery metrics,
and an HTTP /state endpoint for a future dashboard. Whatever you type is sent to the first serial port, so you can
kill links / power off relays / inject faults live.

    pip install pyserial                                  (only needed for real hardware)
    python bridge.py --serial COM5                        # Windows
    python bridge.py --serial /dev/ttyUSB0 --http 8001    # Linux/mac, + dashboard API
    python bridge.py --serial COM5 --serial COM6          # EARTH + SAT-A both plugged in (richer events)
    python bridge.py --replay earth_demo.log              # no hardware: replay a recorded/simulated transcript

Typed commands (forwarded to the mesh):  kill 2 3 | restore 2 3 | down 2 | up 2 | mode v|d | send 4 text | burst 20 | auto 400 | corrupt | dup
Local commands: stats | nodes | quit
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from collections import Counter, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from bridge.port_discovery import discover_ports, resolve_node_port, scan_ports

PRIO = {4: "CRITICAL", 3: "HIGH", 2: "NORMAL", 1: "LOW"}
NAMES = {0: "EARTH", 1: "SAT-A", 2: "RELAY-B", 3: "RELAY-C", 4: "RELAY-D", 5: "RELAY-E", 6: "RELAY-F", 7: "RELAY-G"}
COLORS = {"DELIVER": "32", "NBR_DOWN": "31;1", "NBR_UP": "32", "CORRUPT": "31;1", "DUP": "33;1", "STORE": "33",
          "RESUME": "36", "REROUTE": "35;1", "ROUTE": "35", "EVICT": "31", "DROP": "31", "DOWN": "31;1", "UP": "32;1",
          "BLOCK": "31", "UNBLOCK": "32", "MODE": "36;1", "INJECT": "36;1", "RETX": "90", "GEN": "90", "EXPIRE": "31"}
SILENT_AFTER_MS = 4000


def nm(i) -> str:
    return NAMES.get(int(i), f"NODE-{i}")


class MeshState:
    def __init__(self, color: bool):
        self.color = color
        self.lock = threading.Lock()
        self.nodes: dict[int, dict] = {}
        self.links: dict[tuple, int] = {}
        self.now_dev = 0                       # latest device timestamp seen from EARTH (ms)
        self.events: deque = deque(maxlen=300)
        self.delivered: dict[str, dict] = {}   # bundle id -> info
        self.by_prio = {p: {"n": 0, "age": 0.0, "max": 0} for p in PRIO}
        self.paths = Counter()
        self.last_path = None
        self.path_changes = 0
        self.dups = 0
        self.corrupt = 0
        self.link_losses = 0
        self.start = time.time()

    # ------------------------------------------------------------------ ingest
    def feed(self, raw: str):
        raw = raw.strip()
        if not raw:
            return
        if not raw.startswith("EVT "):
            if raw.startswith("#"):
                print(self._paint(raw, "90"))
            return
        try:
            e = json.loads(raw[4:])
        except json.JSONDecodeError:
            return
        with self.lock:
            msg = self._apply(e)
        if msg:
            self._print(e, msg)

    def _apply(self, e: dict):
        k, n, t = e.get("k"), e.get("n"), e.get("t", 0)
        if n == 0:
            self.now_dev = max(self.now_dev, t)
        if k == "STATUS":
            o = e["o"]
            node = self.nodes.setdefault(o, {})
            mask = e.get("nb", 0)
            nbs = [i for i in range(16) if mask >> i & 1]
            node.update(id=o, name=nm(o), hops=e.get("hops"), q=e.get("q"), mode=e.get("mode"), nb=nbs,
                        gen=e.get("gen"), fwd=e.get("fwd"), stored=e.get("stored"), seen=self.now_dev)
            for p in nbs:
                self.links[tuple(sorted((o, p)))] = self.now_dev
            return None
        text = None
        if k == "DELIVER":
            p, age = e["p"], e["age"]
            self.by_prio[p]["n"] += 1
            self.by_prio[p]["age"] += age
            self.by_prio[p]["max"] = max(self.by_prio[p]["max"], age)
            self.delivered[e["b"]] = e
            path = e["path"]
            self.paths[path] += 1
            if self.last_path and path != self.last_path:
                self.path_changes += 1
            self.last_path = path
            text = (f"DELIVERED {e['b']} ({PRIO[p]}) age {age / 1000:.2f}s via "
                    f"{'>'.join(nm(x) for x in path.split('>'))} | SHA-256 VERIFIED | \"{e.get('txt', '')}\"")
        elif k == "DUP":
            self.dups += 1
            text = f"DUPLICATE DETECTED {e['b']} (from {nm(e.get('from', '?'))}) -> copy rejected"
        elif k == "CORRUPT":
            self.corrupt += 1
            text = f"CORRUPTION DETECTED {e['b']} (from {nm(e.get('from', '?'))}) -> rejected, sender will retransmit"
        elif k == "NBR_DOWN":
            self.link_losses += 1
            text = f"{nm(n)}: neighbour {nm(e['peer'])} stopped answering -> LINK DOWN (beacon timeout)"
        elif k == "NBR_UP":
            text = f"{nm(n)}: neighbour {nm(e['peer'])} heard -> LINK UP"
        elif k == "STORE":
            text = f"{nm(n)}: {e['b']} ({PRIO.get(e.get('p'), '?')}) STORED - no route to EARTH, WAITING FOR CONTACT (queue {e.get('q')})"
        elif k == "RESUME":
            text = f"{nm(n)}: {e['b']} ({PRIO.get(e.get('p'), '?')}) contact available -> forwarding via {nm(e['nh'])}"
        elif k == "ROUTE":
            text = f"{nm(n)}: {e['b']} ({PRIO.get(e.get('p'), '?')}) -> {nm(e['nh'])} ({e.get('hops')} hops to EARTH)"
        elif k == "REROUTE":
            text = f"{nm(n)}: {e['b']} ({PRIO.get(e.get('p'), '?')}) REROUTED -> {nm(e['nh'])}"
        elif k == "RETX":
            text = f"{nm(n)}: {e['b']} no ACK from {nm(e['nh'])} -> retransmit"
        elif k == "EVICT":
            text = f"{nm(n)}: BUFFER FULL - evicted {e['b']} (prio {e.get('p')}) to admit {e.get('for')}"
        elif k in ("DROP", "REFUSE"):
            text = f"{nm(n)}: {e['b']} {k} ({e.get('why')})"
        elif k == "EXPIRE":
            text = f"{nm(n)}: {e['b']} TTL expired"
        elif k == "GEN":
            text = f"{nm(n)}: created {e['b']} ({PRIO.get(e.get('p'), '?')}) \"{e.get('txt', '')}\""
        elif k == "DOWN":
            text = f"{nm(n)}: POWER LOSS (simulated)"
        elif k == "UP":
            text = f"{nm(n)}: power restored, cold boot"
        elif k in ("BLOCK", "UNBLOCK"):
            text = f"{nm(n)}: virtual link to {nm(e['peer'])} {'KILLED' if k == 'BLOCK' else 'RESTORED'}"
        elif k == "MODE":
            text = f"{nm(n)}: routing mode -> {e['mode'].upper()}"
        elif k == "INJECT":
            text = f"{nm(n)}: FAULT INJECTED ({e['what']}) on next bundle"
        elif k == "HOPS":
            return None
        if text:
            self.events.append({"t": t, "node": n, "kind": k, "msg": text})
        return text

    def _paint(self, s, code):
        return f"\033[{code}m{s}\033[0m" if self.color else s

    def _print(self, e, msg):
        line = f"[{e.get('t', 0) / 1000:8.2f}s] {e['k']:<9} {msg}"
        print(self._paint(line, COLORS.get(e["k"], "0")), flush=True)

    # ------------------------------------------------------------------ views
    def snapshot(self, last_events=40) -> dict:
        with self.lock:
            fresh = lambda ts: self.now_dev - ts <= SILENT_AFTER_MS
            nodes = []
            ids = sorted(set(self.nodes) | {0})
            for i in ids:
                d = dict(self.nodes.get(i, {}))
                if i == 0:
                    d.update(id=0, name="EARTH", hops=0, seen=self.now_dev)
                d["name"] = nm(i)
                d["up"] = fresh(d.get("seen", -10 ** 9))
                nodes.append(d)
            links = [{"a": a, "b": b, "a_name": nm(a), "b_name": nm(b), "up": fresh(ts)} for (a, b), ts in sorted(self.links.items())]
            total = sum(v["n"] for v in self.by_prio.values())
            metrics = {
                "delivered": total, "duplicates_rejected": self.dups, "corruption_detected": self.corrupt,
                "link_losses_detected": self.link_losses, "route_changes": self.path_changes,
                "path_usage": dict(self.paths),
                "by_priority": {PRIO[p]: {"delivered": v["n"], "avg_age_ms": (v["age"] / v["n"]) if v["n"] else 0,
                                          "max_age_ms": v["max"]} for p, v in self.by_prio.items()},
            }
            return {"source": "hardware", "device_time_ms": self.now_dev, "nodes": nodes, "links": links,
                    "metrics": metrics, "events": list(self.events)[-last_events:]}

    def print_stats(self):
        s = self.snapshot()
        m = s["metrics"]
        print("\n" + "=" * 72)
        print(f"MESH STATUS  (device time {s['device_time_ms'] / 1000:.1f}s)")
        print(f"{'node':<10}{'up':<6}{'hops':<6}{'queue':<7}{'mode':<10}{'gen':<6}{'fwd':<6}{'stored':<8}neighbours")
        for n in s["nodes"]:
            print(f"{n['name']:<10}{'UP' if n['up'] else 'SILENT':<6}{str(n.get('hops', '-')):<6}{str(n.get('q', '-')):<7}"
                  f"{str(n.get('mode', '-')):<10}{str(n.get('gen', '-')):<6}{str(n.get('fwd', '-')):<6}{str(n.get('stored', '-')):<8}"
                  f"{','.join(nm(i) for i in n.get('nb', []))}")
        print(f"\nlinks: " + "  ".join(f"{l['a_name']}<->{l['b_name']}={'UP' if l['up'] else 'DOWN'}" for l in s["links"]))
        print(f"\nDELIVERED {m['delivered']}   duplicates rejected {m['duplicates_rejected']}   corruption detected "
              f"{m['corruption_detected']}   link losses detected {m['link_losses_detected']}   route changes {m['route_changes']}")
        for p in ("CRITICAL", "HIGH", "NORMAL", "LOW"):
            v = m["by_priority"][p]
            print(f"  {p:<9} delivered {v['delivered']:<4} avg age {v['avg_age_ms'] / 1000:.2f}s  max {v['max_age_ms'] / 1000:.2f}s")
        print("  paths used: " + ", ".join(f"{'>'.join(nm(x) for x in p.split('>'))} x{c}" for p, c in m["path_usage"].items()))
        print("=" * 72, flush=True)


# ---------------------------------------------------------------------- IO
class SerialPort(threading.Thread):
    def __init__(self, port, baud, state):
        super().__init__(daemon=True)
        try:
            import serial  # pyserial
        except ImportError:
            sys.exit("pyserial missing:  pip install pyserial")
        self.ser = serial.Serial(port, baud, timeout=0.2)
        self.state = state
        self.port = port

    def run(self):
        buf = b""
        while True:
            try:
                buf += self.ser.read(256)
            except Exception as exc:  # noqa: BLE001
                print(f"serial error on {self.port}: {exc}")
                return
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                self.state.feed(line.decode("utf-8", "replace"))

    def write(self, line: str):
        self.ser.write((line.strip() + "\n").encode())


def start_http(state: MeshState, writer, port: int):
    class H(BaseHTTPRequestHandler):
        def _send(self, code, obj):
            body = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET,POST")
            self.end_headers()

        def do_GET(self):
            u = urlparse(self.path)
            if u.path == "/state":
                self._send(200, state.snapshot())
            elif u.path == "/ports":
                self._send(200, {"ports": discover_ports()})
            else:
                self._send(404, {"error": "use /state, /ports, or POST /cmd?line=kill+2+3"})

        def do_POST(self):
            u = urlparse(self.path)
            if u.path == "/cmd":
                line = parse_qs(u.query).get("line", [""])[0]
                if writer and line:
                    writer(line)
                    self._send(200, {"sent": line})
                else:
                    self._send(400, {"error": "no serial port / empty line"})
            elif u.path == "/ports/scan":
                self._send(200, scan_ports())
            else:
                self._send(404, {"error": "unknown"})

        def log_message(self, *a):
            pass

    srv = ThreadingHTTPServer(("0.0.0.0", port), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    print(f"# dashboard API: http://localhost:{port}/state   (POST /cmd?line=kill+2+3)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--serial", action="append", help="serial port of an ESP32 (repeat for several). First = EARTH gateway")
    ap.add_argument("--node", help="logical node to connect, e.g. SAT-A, RELAY-B, EARTH-C")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--replay", help="replay a transcript file instead of hardware")
    ap.add_argument("--speed", type=float, default=0.0, help="replay speed (0 = instant, 1 = real time)")
    ap.add_argument("--http", type=int, help="serve /state on this port")
    ap.add_argument("--no-color", action="store_true")
    ap.add_argument("--stats-every", type=float, default=0, help="print mesh status every N seconds")
    ap.add_argument("--keep-alive", action="store_true", help="keep serving HTTP after a replay ends")
    a = ap.parse_args()

    state = MeshState(color=sys.stdout.isatty() and not a.no_color)
    ports: list[SerialPort] = []

    def write(line: str):
        if ports:
            ports[0].write(line)

    if a.http:
        start_http(state, write if ports or a.serial else None, a.http)

    if a.replay:
        last_t = None
        for raw in open(a.replay):
            if a.speed > 0 and raw.startswith("EVT "):
                try:
                    t = json.loads(raw[4:]).get("t", 0)
                    if last_t is not None and t > last_t:
                        time.sleep((t - last_t) / 1000.0 / a.speed)
                    last_t = t
                except json.JSONDecodeError:
                    pass
            state.feed(raw)
        state.print_stats()
        if a.keep_alive:
            while True:
                time.sleep(1)
        return

    if a.serial and a.node:
        ap.error("choose either --serial PORT or --node NODE, not both")
    if a.node:
        resolved = resolve_node_port(a.node)
        if not resolved:
            discovered = scan_ports()
            resolved = resolve_node_port(a.node, discovered.get("ports", []))
        if not resolved:
            ap.error(f"no ESP32 discovered for node {a.node}; run a scan or pass --serial PORT")
        a.serial = [resolved]
    if a.serial:
        bad = [p for p in a.serial if str(p).upper() == "COM_EARTH"]
        if bad:
            ap.error("COM_EARTH is not a literal serial port. Use --node SAT-A / RELAY-B / EARTH-C or scan for hardware.")
    if not a.serial:
        ap.error("give --serial PORT, --node SAT-A, or --replay FILE")
    for p in a.serial:
        sp = SerialPort(p, a.baud, state)
        sp.start()
        ports.append(sp)
    print(f"# connected to {', '.join(a.serial)}  - type commands (kill 2 3, down 2, mode d, burst 20, stats, quit)")
    last_stats = time.time()
    try:
        while True:
            try:
                line = sys.stdin.readline()
            except KeyboardInterrupt:
                break
            if line == "":                                   # stdin closed (e.g. run in background): keep listening
                time.sleep(0.2)
            else:
                line = line.strip()
                if line in ("quit", "exit"):
                    break
                if line in ("stats", "nodes"):
                    state.print_stats()
                elif line:
                    write(line)
            if a.stats_every and time.time() - last_stats > a.stats_every:
                state.print_stats()
                last_stats = time.time()
    except KeyboardInterrupt:
        pass
    finally:
        state.print_stats()


if __name__ == "__main__":
    main()
