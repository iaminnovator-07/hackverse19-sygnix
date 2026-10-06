"""USB serial gateway for the four-board PlatformIO mesh demo.

Set VORTHYX_SERIAL_PORT (for example COM5) to enable the bridge. The gateway
ESP32 is the one tethered to this host; the other three boards join wirelessly.
"""
from __future__ import annotations

import hashlib
import json
import os
import queue
import threading
import time
from collections import deque


class HardwareBridge:
    def __init__(self):
        self.port = os.getenv("VORTHYX_SERIAL_PORT", "").strip()
        self.baud = int(os.getenv("VORTHYX_SERIAL_BAUD", "115200"))
        self.lock = threading.Lock()
        self.outgoing: queue.Queue[dict] = queue.Queue()
        self.nodes: dict[str, dict] = {}
        self.links: list[dict] = []
        self.events = deque(maxlen=100)
        self.connected = False
        self.error = "Set VORTHYX_SERIAL_PORT to the gateway COM port" if not self.port else "Waiting for gateway"
        self.total_sent = 0
        self.delivered = 0
        self.corruption = 0
        self.duplicates = 0
        self.seen: set[str] = set()
        self.mesh_acks: dict[str, set[str]] = {}
        self.pending: dict[str, dict] = {}
        self.last_topology = 0.0
        self.gateway_id = ""
        threading.Thread(target=self._run, daemon=True, name="vorthyx-serial").start()

    def send(self, payload: str, priority: str = "CRITICAL") -> str:
        now = int(time.time() * 1000)
        bundle_id = f"EARTH-{now}"
        command = {"action": "send_bundle", "bundle_id": bundle_id,
                   "priority": priority.upper(), "payload": payload}
        with self.lock:
            self.total_sent += 1
            self.pending[bundle_id] = {"command": command, "attempts": 0,
                                       "last_sent": 0.0, "acks": set()}
            self._event("BUNDLE_QUEUED", f"{bundle_id} queued from laptop to mesh", bundle_id)
        self.outgoing.put(command)
        return bundle_id

    def snapshot(self) -> dict:
        now = time.time()
        with self.lock:
            nodes = [{"id": "LAPTOP", "name": "LAPTOP / EARTH", "gateway": False,
                      "endpoint": True, "online": self.connected, "last_seen_s": 0 if self.connected else None}]
            for node_id, node in self.nodes.items():
                online = now - node["last_seen"] < 5.0
                nodes.append({"id": node_id, "name": "ESP32-GW" if node.get("gateway") else f"ESP32-{node_id[-4:]}",
                              "gateway": bool(node.get("gateway")), "online": online,
                              "last_seen_s": round(now - node["last_seen"], 1)})
            links = list(self.links)
            if self.gateway_id:
                links.append({"a": "LAPTOP", "b": self.gateway_id, "up": self.connected,
                              "transport": "USB SERIAL"})
            return {"connected": self.connected, "error": self.error, "port": self.port,
                    "gateway_id": self.gateway_id, "nodes": nodes, "links": links, "events": list(self.events),
                    "total_sent": self.total_sent, "delivered": self.delivered,
                    "mesh_ack_count": sum(len(acks) for acks in self.mesh_acks.values()),
                    "mesh_acks": {bundle: sorted(nodes) for bundle, nodes in self.mesh_acks.items()},
                    "corruption_detected": self.corruption, "duplicates_rejected": self.duplicates,
                    "last_topology_s": self.last_topology}

    def _event(self, kind: str, message: str, bundle: str | None = None):
        self.events.appendleft({"type": kind, "message": message, "bundle": bundle,
                                "time": time.time()})

    def _walk_tree(self, tree, parent=None):
        edges = []
        for item in tree if isinstance(tree, list) else []:
            if not isinstance(item, dict) or "nodeId" not in item:
                continue
            node = str(item["nodeId"])
            if parent is not None:
                edges.append({"a": parent, "b": node, "up": True})
            edges.extend(self._walk_tree(item.get("subs", []), node))
        return edges

    def _consume(self, packet: dict):
        kind = packet.get("type", "")
        node_id = str(packet.get("node_id", packet.get("gateway_id", "")))
        now = time.time()
        with self.lock:
            if kind == "gateway_ready":
                self.connected = True
                self.error = ""
                self.gateway_id = node_id
                self.nodes[node_id] = {"last_seen": now, "gateway": True}
                self._event("GATEWAY_ONLINE", f"USB mesh gateway {node_id} connected")
            elif kind == "topology":
                self.connected = True
                self.error = ""
                self.last_topology = now
                ids = {str(value) for value in packet.get("nodes", [])}
                ids.add(str(packet.get("gateway_id", "")))
                for existing in self.nodes:
                    if existing not in ids:
                        self.nodes[existing]["last_seen"] = 0
                for value in ids:
                    if value:
                        self.nodes.setdefault(value, {"gateway": value == str(packet.get("gateway_id"))})["last_seen"] = now
                self.nodes[str(packet.get("gateway_id", ""))]["gateway"] = True
                self.gateway_id = str(packet.get("gateway_id", ""))
                raw = packet.get("connections", "[]")
                try:
                    tree = json.loads(raw) if isinstance(raw, str) else raw
                    self.links = self._walk_tree(tree, self.gateway_id)
                except (TypeError, json.JSONDecodeError):
                    self.links = []
            elif kind in {"bundle_queued", "bundle_received", "duplicate", "corruption", "mesh_ack"}:
                bundle = str(packet.get("bundle_id", ""))
                if kind == "bundle_queued":
                    self._event("BUNDLE_QUEUED", f"{bundle} sent from laptop into mesh", bundle)
                elif kind == "bundle_received":
                    payload = str(packet.get("payload", ""))
                    good_hash = hashlib.sha256(payload.encode()).hexdigest() == packet.get("sha256")
                    if not packet.get("intact") or not good_hash:
                        self.corruption += 1
                        self._event("CORRUPTION", f"{bundle} failed payload integrity check", bundle)
                    elif bundle in self.seen:
                        self.duplicates += 1
                        self._event("DUPLICATE", f"Duplicate {bundle} rejected at Earth", bundle)
                    else:
                        self.seen.add(bundle)
                        self.delivered += 1
                        self._event("DELIVERED", f"{bundle} received intact at laptop Earth endpoint", bundle)
                elif kind == "duplicate":
                    self.duplicates += 1
                    self._event("DUPLICATE", f"Duplicate {bundle} rejected at gateway", bundle)
                elif kind == "mesh_ack":
                    node = str(packet.get("node_id", ""))
                    if not packet.get("intact", False):
                        self.corruption += 1
                        self._event("CORRUPTION", f"{bundle} failed integrity check at {node}", bundle)
                    elif packet.get("duplicate", False):
                        self.duplicates += 1
                        self.mesh_acks.setdefault(bundle, set()).add(node)
                        pending = self.pending.get(bundle)
                        if pending:
                            pending["acks"].add(node)
                        self._event("DUPLICATE", f"{bundle} copy suppressed at {node}", bundle)
                    else:
                        self.mesh_acks.setdefault(bundle, set()).add(node)
                        pending = self.pending.get(bundle)
                        if pending:
                            pending["acks"].add(node)
                        self._event("MESH_ACK", f"{bundle} received and verified by {node}", bundle)
                else:
                    self.corruption += 1
                    self._event("CORRUPTION", f"{bundle} failed SHA-256 verification", bundle)
            elif kind in {"node_joined", "connections_changed"}:
                if node_id:
                    self.nodes.setdefault(node_id, {"gateway": False})["last_seen"] = now
                self._event(kind.upper(), f"Mesh topology changed ({node_id})")

    def _run(self):
        while True:
            if not self.port:
                time.sleep(1)
                continue
            try:
                import serial
                with serial.Serial(self.port, self.baud, timeout=0.2, write_timeout=1) as device:
                    with self.lock:
                        self.connected = True
                        self.error = ""
                    while True:
                        try:
                            command = self.outgoing.get_nowait()
                            device.write((json.dumps(command, separators=(",", ":")) + "\n").encode())
                            with self.lock:
                                pending = self.pending.get(command.get("bundle_id", ""))
                                if pending:
                                    pending["attempts"] += 1
                                    pending["last_sent"] = time.time()
                        except queue.Empty:
                            pass
                        self._retry_due(device)
                        raw = device.readline()
                        if raw:
                            try:
                                packet = json.loads(raw.decode("utf-8", errors="ignore").strip())
                            except json.JSONDecodeError:
                                continue
                            if isinstance(packet, dict):
                                self._consume(packet)
            except Exception as exc:
                with self.lock:
                    self.connected = False
                    self.error = f"{type(exc).__name__}: {exc}"
                time.sleep(2)

    def _retry_due(self, device):
        now = time.time()
        retry = []
        with self.lock:
            relay_count = sum(1 for node in self.nodes.values()
                              if not node.get("gateway") and now - node.get("last_seen", 0) < 5.0)
            expected = max(1, relay_count)
            for bundle, state in list(self.pending.items()):
                if len(state["acks"]) >= expected:
                    self.pending.pop(bundle, None)
                elif now - state["last_sent"] >= 2.0 and state["attempts"] >= 4:
                    self._event("DELIVERY_TIMEOUT", f"{bundle} exhausted four transmissions; received {len(state['acks'])}/{expected} relay ACKs", bundle)
                    self.pending.pop(bundle, None)
                elif now - state["last_sent"] >= 2.0 and state["attempts"] > 0:
                    retry.append((bundle, state["command"]))
        for bundle, command in retry:
            device.write((json.dumps(command, separators=(",", ":")) + "\n").encode())
            with self.lock:
                pending = self.pending.get(bundle)
                if pending:
                    pending["attempts"] += 1
                    pending["last_sent"] = now
                    self._event("CUSTODY_RETRY", f"No ACK for {bundle}; retransmission {pending['attempts']}/4", bundle)


hardware = HardwareBridge()
