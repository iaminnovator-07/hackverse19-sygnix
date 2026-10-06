"""VORTHYX command line interface.

  python simulator.py demo                      scripted killer demo (live story + comparison)
  python simulator.py run -s vorthyx -c link_fail --events 60
  python simulator.py compare -c all --seeds 5  strategy comparison tables
  python simulator.py shell                     interactive control room (kill/restore/inject)
  python simulator.py selftest                  automated checks (exit code 1 on failure)
  python simulator.py scenarios                 list scenarios
"""
from __future__ import annotations

import argparse
import cmd
import csv
import json
import random
import sys
import time

from .config import *
from .engine import Engine
from .metrics import summarize
from .scenarios import SCENARIOS, build_engine, make_workload, run_scenario
from .strategies import REGISTRY, make_strategy

STRATS = ["dijkstra", "vorthyx", "epidemic"]
USE_COLOR = sys.stdout.isatty()
COL = {"LINK_DOWN": "31", "LINK_UP": "32", "DELIVERED": "32", "CORRUPT": "31;1", "DUPLICATE": "33;1",
       "STORE": "33", "RESUME": "36", "REROUTE": "35;1", "ROUTE": "35", "EVICT": "31", "DROP": "31",
       "INJECT": "36;1", "EXPIRE": "31", "REFUSE": "33", "GEN": "90", "SEND": "90", "RETX": "90",
       "LOSS": "90", "CUSTODY": "90"}


def paint(text, kind):
    if USE_COLOR and kind in COL:
        return f"\033[{COL[kind]}m{text}\033[0m"
    return text


def fmt_event(ev):
    return paint(f"[{ev['time']:7.2f}s] {ev['kind']:<9} {ev['msg']}", ev["kind"])


def print_events(eng, limit=None, level=1, kinds=None, bundle=None):
    evs = [e for e in eng.events if e["level"] <= level and (not kinds or e["kind"] in kinds)
           and (bundle is None or e["bundle"] == bundle)]
    if limit:
        evs = evs[:limit]
    for e in evs:
        print(fmt_event(e))


# ------------------------------------------------------------------ tables
def table(headers, rows, aligns=None):
    cols = len(headers)
    w = [max(len(str(headers[i])), *(len(str(r[i])) for r in rows)) for i in range(cols)] if rows else [len(h) for h in headers]
    aligns = aligns or ["<"] + [">"] * (cols - 1)
    line = "+-" + "-+-".join("-" * x for x in w) + "-+"
    out = [line, "| " + " | ".join(f"{headers[i]:{aligns[i]}{w[i]}}" for i in range(cols)) + " |", line]
    for r in rows:
        out.append("| " + " | ".join(f"{str(r[i]):{aligns[i]}{w[i]}}" for i in range(cols)) + " |")
    out.append(line)
    return "\n".join(out)


# (label, key, better: 'high'|'low'|None, formatter)
ROWS = [
    ("Delivery rate (intact)", "delivery_rate", "high", lambda v: f"{v:.1f}%"),
    ("CRITICAL delivery", "critical_delivery", "high", lambda v: f"{v:.1f}%"),
    ("Avg latency (all)", "avg_latency_s", "low", lambda v: f"{v:.2f}s"),
    ("p95 latency", "p95_latency_s", "low", lambda v: f"{v:.2f}s"),
    ("CRITICAL avg latency", "critical_avg_latency_s", "low", lambda v: f"{v:.2f}s"),
    ("CRITICAL max latency", "critical_max_latency_s", "low", lambda v: f"{v:.2f}s"),
    ("Duplicates delivered (leaked)", "duplicates_delivered", "low", lambda v: f"{v:.1f}"),
    ("Corrupt delivered (leaked)", "corrupt_delivered", "low", lambda v: f"{v:.1f}"),
    ("Corruption detected+rejected", "corruption_detected", None, lambda v: f"{v:.1f}"),
    ("Dup copies reaching dest (rejected)", "duplicates_rejected_at_dest", "low", lambda v: f"{v:.1f}"),
    ("Dup copies suppressed in network", "duplicates_suppressed_in_net", None, lambda v: f"{v:.1f}"),
    ("Transmissions (overhead)", "transmissions", "low", lambda v: f"{v:.0f}"),
    ("Retransmissions", "retransmissions", "low", lambda v: f"{v:.1f}"),
    ("Buffer overflow events", "buffer_overflow_total", "low", lambda v: f"{v:.1f}"),
    ("Peak buffer fill", "peak_buffer_pct", "low", lambda v: f"{v:.0f}%"),
    ("Link utilization", "link_utilization_pct", None, lambda v: f"{v:.1f}%"),
    ("Bundles stored during outage", "bundles_stored_during_outage", None, lambda v: f"{v:.1f}"),
    ("Undelivered (expired/lost/stuck)", None, None, None),
]


def average(summaries):
    keys = [k for k, v in summaries[0].items() if isinstance(v, (int, float)) and not isinstance(v, bool)]
    out = {k: sum(s[k] for s in summaries) / len(summaries) for k in keys}
    out["_n"] = len(summaries)
    out["_undelivered"] = tuple(sum(s[k] for s in summaries) / len(summaries)
                                for k in ("undelivered_expired", "undelivered_lost", "undelivered_stuck"))
    return out


def comparison_table(results, title=""):
    names = list(results)
    rows, wins = [], {n: 0 for n in names}
    for label, key, better, f in ROWS:
        if key is None:
            rows.append([label] + ["{:.1f}/{:.1f}/{:.1f}".format(*results[n]["_undelivered"]) for n in names])
            continue
        vals = [results[n][key] for n in names]
        best = None
        if better:
            best = max(vals) if better == "high" else min(vals)
        cells = []
        for n, v in zip(names, vals):
            mark = " *" if best is not None and abs(v - best) < 1e-9 and len(set(round(x, 6) for x in vals)) > 1 else ""
            if mark:
                wins[n] += 1
            cells.append(f(v) + mark)
        rows.append([label] + cells)
    head = ["Metric"] + [make_strategy(n).label for n in names]
    txt = (f"\n{title}\n" if title else "\n") + table(head, rows)
    txt += "\n  * = best of the compared strategies for that metric   |   metric wins: " + \
           ", ".join(f"{make_strategy(n).name}={wins[n]}" for n in names)
    return txt


def run_many(strategies, scenario, seeds, integrity=True, baseline_overflow="refuse"):
    res = {}
    for st in strategies:
        sums = [summarize(run_scenario(st, scenario, sd, integrity, baseline_overflow=baseline_overflow))
                for sd in seeds]
        res[st] = average(sums)
    return res


# ------------------------------------------------------------------ commands
def kpi_cards(s):
    items = [("DELIVERY RATE", f"{s['delivery_rate']:.1f}%"), ("CRITICAL DELIVERY", f"{s['critical_delivery']:.1f}%"),
             ("AVG LATENCY", f"{s['avg_latency_s']:.2f}s"), ("DUPLICATES LEAKED", s["duplicates_delivered"]),
             ("CORRUPT LEAKED", s["corrupt_delivered"]), ("LINK UTILIZATION", f"{s['link_utilization_pct']:.0f}%")]
    return table([k for k, _ in items], [[v for _, v in items]], aligns=[">"] * len(items))


def print_summary(eng):
    s = summarize(eng)
    print(f"\nStrategy: {eng.strategy.label}   scenario: {getattr(eng, 'scenario', None) and eng.scenario.name}   "
          f"seed: {eng.seed}   integrity layer: {'ON' if eng.integrity else 'OFF'}   virtual time: {eng.time_s():.1f}s")
    print(kpi_cards(s))
    rows = [[p, d["total"], d["delivered"], f"{d['rate']:.1f}%", f"{d['avg_latency_s']:.2f}s",
             f"{d['max_latency_s']:.2f}s", s["drops_by_priority"][p]] for p, d in s["by_priority"].items()]
    print(table(["Priority", "Total", "Delivered", "Rate", "Avg lat", "Max lat", "Dropped"], rows))
    print(f"Integrity: hash checks={eng.c['hash_checks']}  corruption detected={s['corruption_detected']}  "
          f"corrupt delivered={s['corrupt_delivered']}  dup rejected@dest={s['duplicates_rejected_at_dest']}  "
          f"dup suppressed@net={s['duplicates_suppressed_in_net']}  dup delivered={s['duplicates_delivered']}")
    print(f"Custody: transmissions={s['transmissions']}  retransmissions={s['retransmissions']}  "
          f"stored-during-outage={s['bundles_stored_during_outage']}  in-flight lost on failure={s['inflight_lost_on_failure']}")
    print(f"Undelivered: expired={s['undelivered_expired']} lost(buffer)={s['undelivered_lost']} stuck={s['undelivered_stuck']}   "
          f"buffer: drops={s['buffer_drops']} evictions={s['buffer_evictions']} refusals={s['buffer_refusals']}  peak={s['peak_buffer_pct']:.0f}%")
    lrows = [[k, "UP" if v["up"] else "DOWN", f"{v['availability_pct']:.0f}%", f"{v['utilization_pct']:.1f}%", v["transmissions"]]
             for k, v in s["links"].items()]
    print(table(["Link", "Now", "Avail", "Util", "Tx"], lrows))


def cmd_run(a):
    eng = build_engine(a.strategy, a.scenario, a.seed, not a.no_integrity, baseline_overflow=a.baseline_overflow)
    if a.live:
        eng.listeners.append(lambda e: (e["level"] <= a.level) and print(fmt_event(e)))
        if a.pause:
            eng.listeners.append(lambda e: (e["level"] <= a.level) and time.sleep(a.pause))
    eng.run(a.duration or eng.scenario.duration)
    if not a.live and a.events:
        print_events(eng, None if a.events < 0 else a.events, a.level)
    if a.trace:
        print(f"\n--- trace {a.trace} ---")
        print_events(eng, level=9, bundle=a.trace)
    print_summary(eng)
    if a.json:
        json.dump(summarize(eng), open(a.json, "w"), indent=2)
        print("wrote", a.json)


def cmd_compare(a):
    names = list(SCENARIOS) if a.scenario == "all" else a.scenario.split(",")
    names = [n for n in names if n != "demo" or a.scenario != "all"]
    strategies = a.strategies.split(",")
    seeds = list(range(a.seed, a.seed + a.seeds))
    allres = {}
    for sc in names:
        res = run_many(strategies, sc, seeds, not a.no_integrity, a.baseline_overflow)
        allres[sc] = res
        print(comparison_table(res, f"=== Scenario: {sc} - {SCENARIOS[sc].desc}  (seeds {seeds[0]}..{seeds[-1]}, mean) ==="))
    if len(names) > 1:
        print("\n=== OVERVIEW: delivery % / CRITICAL delivery % / avg latency s ===")
        rows = []
        for sc, res in allres.items():
            rows.append([sc] + [f"{res[s]['delivery_rate']:.0f} / {res[s]['critical_delivery']:.0f} / {res[s]['avg_latency_s']:.2f}"
                                for s in strategies])
        print(table(["Scenario"] + [make_strategy(s).name for s in strategies], rows))
    if a.json:
        json.dump({sc: {st: {k: v for k, v in d.items() if not k.startswith("_")} for st, d in res.items()}
                   for sc, res in allres.items()}, open(a.json, "w"), indent=2)
        print("wrote", a.json)
    if a.csv:
        with open(a.csv, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["scenario", "strategy"] + [k for _, k, _, _ in ROWS if k])
            for sc, res in allres.items():
                for st, d in res.items():
                    w.writerow([sc, st] + [round(d[k], 4) for _, k, _, _ in ROWS if k])
        print("wrote", a.csv)


def banner(txt, pause):
    print("\n" + "=" * 78 + f"\n  {txt}\n" + "=" * 78)
    time.sleep(pause)


def cmd_demo(a):
    p = a.pause
    seed = a.seed
    banner("VORTHYX - DISRUPTION-TOLERANT SPACE NETWORK  |  scripted live demo", p * 4)
    print("Topology: SAT-A -- RELAY-B -- RELAY-D -- EARTH   (+ RELAY-C alternate path, + slow C->EARTH backup)")
    print("Workload: 100 bundles = 10 CRITICAL / 20 HIGH / 40 NORMAL / 30 LOW, plus 2 CRITICAL alerts mid-outage")
    print("Script  : t=3s kill B<->D | t=4s kill D<->EARTH | t=5s kill C<->EARTH (TOTAL BLACKOUT) |")
    print("          t=6s ALERT-1 | t=8s ALERT-2 | t=15s D<->EARTH restored | t=15.3s corrupt next |")
    print("          t=15.6s duplicate next | t=22.5s replay attack | t=25s remaining links restored\n")
    banner(f"STEP 1 - run VORTHYX (seed {seed}); key events stream below", p * 3)
    eng = build_engine("vorthyx", "demo", seed)
    caps = {"STORE": 5, "RESUME": 5, "REROUTE": 4, "DUPLICATE": 6, "EVICT": 4, "DROP": 3, "CORRUPT": 5, "EXPIRE": 3}
    seen = {}
    hidden = {"n": 0}

    def live(e):
        k = e["kind"]
        alert = bool(e["bundle"]) and e["bundle"].startswith("ALERT")
        show = False
        if k in ("LINK_DOWN", "LINK_UP", "INJECT"):
            show = True
        elif k in ("GEN", "ROUTE", "REROUTE", "DELIVERED", "STORE", "RESUME") and alert:
            show = True
        elif k in caps:
            seen[k] = seen.get(k, 0) + 1
            show = seen[k] <= caps[k]
            if seen[k] == caps[k] + 1:
                print(f"            ... further {k} events hidden (use: run --live --level 2) ...")
        if show:
            print(fmt_event(e))
            time.sleep(p / 6)
        else:
            hidden["n"] += 1
    eng.listeners.append(live)
    eng.run(eng.scenario.duration)
    print(f"\n({hidden['n']} routine events not shown)")
    banner("STEP 2 - final KPIs (VORTHYX)", p * 2)
    print_summary(eng)

    banner("STEP 3 - the same scenario & channel weather under the other strategies", p * 2)
    engines = {st: run_scenario(st, "demo", seed) for st in STRATS}
    res = {st: average([summarize(e)]) for st, e in engines.items()}
    print(comparison_table(res, "=== STRATEGY COMPARISON (generated by the simulator, not hard-coded) ==="))

    banner("STEP 4 - what happened to the CRITICAL alert raised DURING the outage?", p * 2)
    for st in ("dijkstra", "vorthyx"):
        e = engines[st]
        print(f"\n[{make_strategy(st).label}]  trace of ALERT-1")
        for ev in e.trace("ALERT-1"):
            if ev["kind"] in ("GEN", "ROUTE", "REROUTE", "STORE", "RESUME", "DELIVERED", "CORRUPT", "DUPLICATE", "EVICT", "DROP", "EXPIRE"):
                print("  " + fmt_event(ev))
    banner("STEP 5 - integrity proof (VORTHYX run)", p * 2)
    s = summarize(eng)
    print(f"  Hash checks performed ..... {eng.c['hash_checks']}")
    print(f"  Corruption detected ....... {s['corruption_detected']}  -> rejected, retransmitted; leaked to Earth: {s['corrupt_delivered']}")
    print(f"  Duplicates rejected ....... {s['duplicates_rejected_at_dest']} at Earth + {s['duplicates_suppressed_in_net']} inside network; leaked: {s['duplicates_delivered']}")
    off = summarize(run_scenario("vorthyx", "demo", seed, integrity=False))
    print(f"  Same run, integrity layer OFF: corrupt delivered={off['corrupt_delivered']}, duplicates delivered={off['duplicates_delivered']}")
    print("\nDemo complete.")


def cmd_scenarios(a):
    print(table(["Scenario", "Bundles", "Duration", "Description"],
                [[n, s.n_bundles, f"{s.duration * TICK_MS / 1000:.0f}s", s.desc] for n, s in SCENARIOS.items()],
                aligns=["<", ">", ">", "<"]))


# ------------------------------------------------------------------ interactive shell
class Shell(cmd.Cmd):
    prompt = "vorthyx> "
    intro = ("VORTHYX control room. Type 'help'.  Quick start:  gen 100 | run 60 | kill B D | alert | run 100 | "
             "restore B D | run 600 | metrics")

    def __init__(self, strategy="vorthyx", seed=42, integrity=True, scenario=None, baseline_overflow="refuse"):
        super().__init__()
        self.strategy_name, self.seed, self.integrity, self.bo = strategy, seed, integrity, baseline_overflow
        self.scenario = scenario
        self.reset_engine()

    def reset_engine(self):
        if self.scenario:
            self.eng = build_engine(self.strategy_name, self.scenario, self.seed, self.integrity, baseline_overflow=self.bo)
        else:
            self.eng = Engine(self.strategy_name, seed=self.seed, integrity=self.integrity, baseline_overflow=self.bo)
        self.eng.listeners.append(self._live)
        self.live_level = 1
        self.shown_to = 0

    def _live(self, ev):
        if ev["level"] <= self.live_level and self.live_level > 0:
            print(fmt_event(ev))

    def emptyline(self):
        pass

    def default(self, line):
        print(f"unknown command: {line.split()[0]}  (type 'help')")

    def onecmd(self, line):
        try:
            return super().onecmd(line)
        except (KeyError, ValueError, IndexError) as exc:
            print(f"error: {exc}")
            return False

    # --- control
    def do_gen(self, arg):
        """gen [N] [SPREAD_TICKS|PRIORITY]  - N bundles with the default mix (10/20/40/30), spread over SPREAD_TICKS
        (default 100 = 5s) starting now.  `gen 5 CRITICAL` creates 5 bundles of that priority immediately."""
        parts = arg.split()
        n = int(parts[0]) if parts else 10
        second = parts[1] if len(parts) > 1 else "100"
        if second.isdigit():
            spread = max(1, int(second))
            base = self.eng.counter + len([1 for evs in self.eng.schedule.values() for a_, _ in evs if a_ == "gen"])
            for t, p, size in make_workload(self.seed + base, n, DEFAULT_MIX, spread):
                self.eng.at(self.eng.tick + t, "gen", p, size)
            print(f"{n} bundle(s) scheduled over the next {spread} ticks ({spread * TICK_MS / 1000:.1f}s) - use 'run'")
        else:
            rng = random.Random(self.seed + self.eng.tick + self.eng.counter)
            p = PRIO_ID[second.upper()]
            for _ in range(n):
                self.eng.generate(p, rng.randint(*SIZE_RANGE[p]))
            print(f"{n} {PRIO_NAME[p]} bundle(s) generated now")

    def do_alert(self, arg):
        """alert  - raise a CRITICAL bundle labelled ALERT-n"""
        self.eng.alert_counter += 1
        bid = self.eng.generate(4, 8, f"ALERT-{self.eng.alert_counter}")
        print("raised", bid)

    def do_step(self, arg):
        """step [N]  - advance N ticks (default 1; 1 tick = 50ms virtual)"""
        self.eng.run(self.eng.tick + (int(arg) if arg else 1))

    def do_run(self, arg):
        """run [N]  - advance N ticks (default 100)"""
        self.eng.run(self.eng.tick + (int(arg) if arg else 100))
        print(f"-- t={self.eng.time_s():.2f}s (tick {self.eng.tick}) --")

    def do_runto(self, arg):
        """runto TICK  - advance until the given tick"""
        self.eng.run(int(arg))

    def do_finish(self, arg):
        """finish  - run until all bundles are delivered/dead or 3000 more ticks"""
        end = self.eng.tick + 3000
        while self.eng.tick < end:
            self.eng.step()
            if not any(n.storage for n in self.eng.net.nodes.values()) and not self.eng.data_tx and not self.eng.schedule:
                break
        print(f"-- finished at t={self.eng.time_s():.2f}s --")

    def do_kill(self, arg):
        """kill A B  - fail the link between two nodes (A,B,C,D,E or full names)"""
        a, b = arg.split()
        if not self.eng.kill_link(a, b):
            print("link already down")

    def do_restore(self, arg):
        """restore A B  - bring a link back"""
        a, b = arg.split()
        if not self.eng.restore_link(a, b):
            print("link already up")

    def do_corrupt(self, arg):
        """corrupt  - corrupt the payload of the next transmitted bundle"""
        self.eng.inject_corrupt()

    def do_dup(self, arg):
        """dup  - transmit the next bundle twice"""
        self.eng.inject_duplicate()

    def do_replay(self, arg):
        """replay  - re-inject a stale copy of the last delivered bundle toward Earth"""
        self.eng.inject_replay()

    def do_strategy(self, arg):
        """strategy dijkstra|vorthyx|epidemic  - switch routing strategy on the fly (new runs: use 'reset')"""
        if not arg:
            print("current:", self.eng.strategy.name)
            return
        st = make_strategy(arg.strip())
        if st.name != "vorthyx":
            st.overflow_policy = self.bo
        self.eng.strategy = st
        self.strategy_name = st.name
        print("strategy ->", st.label)

    def do_integrity(self, arg):
        """integrity on|off  - toggle hash verification + duplicate rejection"""
        self.eng.integrity = self.integrity = arg.strip().lower() != "off"
        print("integrity layer", "ON" if self.eng.integrity else "OFF")

    def do_live(self, arg):
        """live 0|1|2  - live event stream level (0 off, 1 important, 2 everything)"""
        self.live_level = int(arg) if arg else 1

    def do_reset(self, arg):
        """reset [seed]  - fresh engine (keeps strategy)"""
        if arg:
            self.seed = int(arg)
        self.reset_engine()
        print("engine reset")

    # --- inspect
    def do_status(self, arg):
        """status  - nodes, buffers, links"""
        e = self.eng
        print(f"t={e.time_s():.2f}s  strategy={e.strategy.label}  integrity={'ON' if e.integrity else 'OFF'}  in-flight={len(e.data_tx)}")
        rows = []
        for n in e.net.nodes.values():
            rows.append([n.name, f"{n.used()}/{n.buffer_cap if n.buffer_cap else 'inf'}",
                         len([b for b in n.storage.values() if not b.pending]),
                         len([b for b in n.storage.values() if b.pending]),
                         len([b for b in n.storage.values() if b.waiting])])
        print(table(["Node", "Buffer", "Queued", "Await-ACK", "Waiting"], rows))
        self.do_links("")

    def do_links(self, arg):
        """links  - link states"""
        rows = [[l.name, "UP" if l.up else "DOWN", f"{l.latency_ms}ms", l.bandwidth, f"{l.reliability * 100:.0f}%",
                 f"{max(l.util_ema.values()) * 100:.0f}%"] for l in self.eng.net.links.values()]
        print(table(["Link", "State", "Latency", "BW", "Reliab", "Util"], rows))

    def do_queues(self, arg):
        """queues [node]  - bundles currently stored at each node"""
        for n in self.eng.net.nodes.values():
            if arg and self.eng.net.resolve(arg) != n.name:
                continue
            items = sorted(n.storage.values(), key=lambda b: (-b.priority, b.id))
            print(f"{n.name}: {len(items)} bundle(s), buffer {n.used()}/{n.buffer_cap}")
            for b in items[:25]:
                st = "AWAIT-ACK " + ",".join(b.pending) if b.pending else ("WAITING-FOR-CONTACT" if b.waiting else "queued")
                print(f"    {b.id:<9} {PRIO_NAME[b.priority]:<8} size={b.size:<3} {st}")
            if len(items) > 25:
                print(f"    ... {len(items) - 25} more")

    def do_metrics(self, arg):
        """metrics  - KPI cards and full summary"""
        print_summary(self.eng)

    def do_events(self, arg):
        """events [N] [level]  - last N events (default 25, level 1)"""
        parts = arg.split()
        n = int(parts[0]) if parts else 25
        lvl = int(parts[1]) if len(parts) > 1 else 1
        evs = [e for e in self.eng.events if e["level"] <= lvl][-n:]
        for e in evs:
            print(fmt_event(e))

    def do_trace(self, arg):
        """trace BUNDLE_ID  - full life story of one bundle (e.g. trace B-007, trace ALERT-1)"""
        evs = self.eng.trace(arg.strip())
        if not evs:
            print("no events for", arg)
        for e in evs:
            print(fmt_event(e))

    def do_route(self, arg):
        """route BUNDLE_ID  - where it is now and the route the current strategy would pick"""
        res = self.eng.explain_route(arg.strip())
        if not res:
            print("bundle not stored anywhere (delivered, in flight, or dead)")
        for name, p in res:
            if p:
                print(f"at {name}: path {' > '.join(p['path'])} | reliability {p['reliability'] * 100:.1f}% | est. delay {p['eta_ms']}ms")
            else:
                print(f"at {name}: NO ROUTE -> stored, waiting for contact")

    def do_snapshot(self, arg):
        """snapshot [file]  - dump the JSON state (the future /state API payload)"""
        data = json.dumps(self.eng.snapshot(), indent=2, default=str)
        if arg:
            open(arg.strip(), "w").write(data)
            print("wrote", arg.strip())
        else:
            print(data[:3000] + ("\n..." if len(data) > 3000 else ""))

    def do_quit(self, arg):
        """quit  - leave"""
        return True

    do_exit = do_quit

    def do_EOF(self, arg):
        return True


def cmd_shell(a):
    sh = Shell(a.strategy, a.seed, not a.no_integrity, a.scenario, a.baseline_overflow)
    if a.script:
        sh.live_level = 1
        for line in open(a.script):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            print(f"vorthyx> {line}")
            if sh.onecmd(line):
                break
    else:
        sh.cmdloop()


def cmd_selftest(a):
    from .selftest import run_all
    sys.exit(run_all(verbose=a.verbose))


def main(argv=None):
    ap = argparse.ArgumentParser(prog="vorthyx", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd")

    def common(p):
        p.add_argument("--seed", type=int, default=42)
        p.add_argument("--no-integrity", action="store_true", help="disable hash verification + dedup (to show the damage)")
        p.add_argument("--baseline-overflow", choices=["refuse", "drop_tail"], default="refuse",
                       help="buffer policy of the baselines (default refuse custody = fair)")

    r = sub.add_parser("run", help="run one strategy on one scenario")
    common(r)
    r.add_argument("-s", "--strategy", default="vorthyx", choices=list(REGISTRY))
    r.add_argument("-c", "--scenario", default="link_fail", choices=list(SCENARIOS))
    r.add_argument("--events", type=int, default=0, help="print N events afterwards (-1 = all)")
    r.add_argument("--level", type=int, default=1, help="event verbosity 1=important 2=all")
    r.add_argument("--live", action="store_true", help="stream events while simulating")
    r.add_argument("--pause", type=float, default=0.0, help="seconds to sleep per live event")
    r.add_argument("--trace", help="print full trace of a bundle id (e.g. ALERT-1, B-007)")
    r.add_argument("--duration", type=int)
    r.add_argument("--json")
    r.set_defaults(fn=cmd_run)

    c = sub.add_parser("compare", help="compare strategies (tables)")
    common(c)
    c.add_argument("-c", "--scenario", default="all", help="scenario name, comma list, or 'all'")
    c.add_argument("--strategies", default="dijkstra,vorthyx,epidemic")
    c.add_argument("--seeds", type=int, default=5, help="number of seeds to average")
    c.add_argument("--json")
    c.add_argument("--csv")
    c.set_defaults(fn=cmd_compare)

    d = sub.add_parser("demo", help="scripted killer demo")
    d.add_argument("--seed", type=int, default=42)
    d.add_argument("--pause", type=float, default=1.0, help="pacing in seconds (0 = instant)")
    d.set_defaults(fn=cmd_demo)

    s = sub.add_parser("shell", help="interactive control room")
    common(s)
    s.add_argument("-s", "--strategy", default="vorthyx", choices=list(REGISTRY))
    s.add_argument("-c", "--scenario", default=None, choices=list(SCENARIOS))
    s.add_argument("--script", help="run commands from a file instead of interactive")
    s.set_defaults(fn=cmd_shell)

    t = sub.add_parser("selftest", help="automated verification")
    t.add_argument("-v", "--verbose", action="store_true")
    t.set_defaults(fn=cmd_selftest)

    sc = sub.add_parser("scenarios", help="list scenarios")
    sc.set_defaults(fn=cmd_scenarios)

    a = ap.parse_args(argv)
    if not getattr(a, "fn", None):
        ap.print_help()
        return
    a.fn(a)


if __name__ == "__main__":
    main()
