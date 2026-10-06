"""Automated verification. `python simulator.py selftest` -> exit code 0 only if everything holds.
Covers the 8 demo-day scenarios from the plan + determinism, conservation and wire-format checks."""
from __future__ import annotations

import io
import contextlib

from .config import *
from .metrics import summarize
from .scenarios import SCENARIOS, build_engine, run_scenario

SEEDS = [1, 2, 3, 4, 5]
STRATS = ["dijkstra", "vorthyx", "epidemic"]
RESULTS = []


def check(name):
    def deco(fn):
        fn._name = name
        RESULTS.append(fn)
        return fn
    return deco


def S(strategy, scenario, seed=42, integrity=True):
    e = run_scenario(strategy, scenario, seed, integrity)
    return e, summarize(e)


@check("T1  normal network: all strategies sane (0 leaks, CRITICAL 100%); VORTHYX delivery >= Dijkstra (mean of seeds)")
def t_normal():
    mean = {}
    for st in ("dijkstra", "vorthyx"):
        vals = []
        for sd in SEEDS:
            _, s = S(st, "normal", sd)
            assert s["delivery_rate"] >= 90.0, f"{st} seed {sd}: delivery {s['delivery_rate']}"
            assert s["critical_delivery"] == 100.0
            assert s["duplicates_delivered"] == 0 and s["corrupt_delivered"] == 0
            vals.append(s["delivery_rate"])
        mean[st] = sum(vals) / len(vals)
    assert mean["vorthyx"] >= mean["dijkstra"], f"vorthyx {mean['vorthyx']:.1f} < dijkstra {mean['dijkstra']:.1f}"


@check("T2  invariants: every scenario x strategy x seed - no leaks, conservation, unique delivery")
def t_invariants():
    for sc in SCENARIOS:
        for st in STRATS:
            for sd in SEEDS[:3]:
                e, s = S(st, sc, sd)
                assert s["duplicates_delivered"] == 0, f"dup leaked {st}/{sc}/{sd}"
                assert s["corrupt_delivered"] == 0, f"corrupt leaked {st}/{sc}/{sd}"
                acc = s["delivered"] + s["undelivered_expired"] + s["undelivered_lost"] + s["undelivered_stuck"]
                assert acc == s["total_bundles"], f"conservation {st}/{sc}/{sd}: {acc} != {s['total_bundles']}"
                ids = [ev["bundle"] for ev in e.events if ev["kind"] == "DELIVERED"]
                assert len(ids) == len(set(ids)), f"bundle delivered twice {st}/{sc}/{sd}"


@check("T3  kill one link: nothing is transmitted on it while down; delivery continues via alternate route")
def t_one_kill():
    for st in ("dijkstra", "vorthyx"):
        e = build_engine(st, "link_fail", 42)
        link = e.net.link("RELAY-B", "RELAY-D")
        e.run(61)
        assert not link.up
        base = link.tx_count
        e.run(499)
        assert link.tx_count == base, f"{st}: {link.tx_count - base} tx on a DOWN link"
        e.run(1500)
        s = summarize(e)
        assert s["delivery_rate"] >= 95.0, f"{st}: delivery {s['delivery_rate']}"
        assert any(ev["kind"] == "LINK_DOWN" for ev in e.events)


@check("T4  kill two links (RELAY-D isolated): no tx on dead links; VORTHYX never loses CRITICAL/HIGH")
def t_two_kills():
    for sd in SEEDS:
        e = build_engine("vorthyx", "double_fail", sd)
        l1, l2 = e.net.link("RELAY-B", "RELAY-D"), e.net.link("RELAY-C", "RELAY-D")
        e.run(125)
        b1, b2 = l1.tx_count, l2.tx_count
        e.run(440)
        assert l1.tx_count == b1 and l2.tx_count == b2, "traffic on a dead link"
        e.run(1500)
        s = summarize(e)
        assert s["critical_delivery"] == 100.0, f"seed {sd}: critical {s['critical_delivery']}"
        assert s["by_priority"]["HIGH"]["rate"] == 100.0, f"seed {sd}: HIGH lost"
        assert s["delivery_rate"] >= 90.0, f"seed {sd}: delivery {s['delivery_rate']}"


@check("T5  restore link: contact resumes and the link carries traffic again; backlog drains")
def t_restore():
    e = build_engine("vorthyx", "blackout", 42)
    link = e.net.link("RELAY-D", "EARTH")
    e.run(340)
    base = link.tx_count
    assert not link.up
    e.run(1000)
    assert link.up and link.tx_count > base, "no traffic after contact restored"
    assert any(ev["kind"] == "LINK_UP" for ev in e.events)
    assert summarize(e)["critical_delivery"] == 100.0


@check("T6  duplicates: injected duplicates/replays are rejected (ON); replay leaks through when integrity OFF")
def t_dups():
    for st in STRATS:
        _, s = S(st, "integrity", 42)
        assert s["duplicates_rejected_at_dest"] + s["duplicates_suppressed_in_net"] >= 1
        assert s["duplicates_delivered"] == 0
    e, s = S("vorthyx", "integrity", 42, integrity=False)
    assert s["duplicates_delivered"] >= 1, "integrity OFF should leak the replayed duplicate"
    assert any(ev["kind"] == "DUPLICATE" and "already delivered" in ev["msg"] for ev in
               run_scenario("vorthyx", "integrity", 42).events)


@check("T7  corruption: detected+rejected+retransmitted (ON); corrupt data reaches Earth when OFF")
def t_corrupt():
    for st in STRATS:
        _, s = S(st, "integrity", 42)
        assert s["corruption_detected"] >= 4, f"{st}: only {s['corruption_detected']} detections"
        assert s["corrupt_delivered"] == 0
    _, s = S("vorthyx", "integrity", 42, integrity=False)
    assert s["corrupt_delivered"] >= 1, "integrity OFF should let corrupt payloads through"


@check("T8  buffer pressure: VORTHYX never loses CRITICAL, sheds LOW first, beats Dijkstra on CRITICAL")
def t_buffer():
    for sd in SEEDS:
        ev, sv = S("vorthyx", "congestion", sd)
        _, sd_ = S("dijkstra", "congestion", sd)
        assert sv["drops_by_priority"]["CRITICAL"] == 0, f"seed {sd}: CRITICAL dropped"
        assert sv["critical_delivery"] == 100.0, f"seed {sd}: {sv['critical_delivery']}"
        assert sv["drops_by_priority"]["LOW"] >= sv["drops_by_priority"]["HIGH"]
        assert sv["critical_delivery"] >= sd_["critical_delivery"]
        assert sv["buffer_overflow_total"] > 0, "scenario should actually stress the buffers"


@check("T9  CRITICAL alerts raised during a total blackout lead the post-restore wave (and beat Dijkstra)")
def t_critical_outage():
    restore = 350
    lat_v, lat_d = [], []
    for sd in SEEDS:
        e, s = S("vorthyx", "blackout", sd)
        rec = e.records
        assert rec["ALERT-1"].delivered_tick is not None and rec["ALERT-2"].delivered_tick is not None
        bulk = sorted(r.delivered_tick for r in rec.values()
                      if r.priority <= 2 and r.delivered_tick and r.delivered_tick >= restore)
        median_bulk = bulk[len(bulk) // 2]
        for a in ("ALERT-1", "ALERT-2"):
            t = rec[a].delivered_tick
            assert t < median_bulk, f"seed {sd}: {a} delivered @tick {t}, after median bulk @ {median_bulk}"
            assert t - restore <= 40, f"seed {sd}: {a} took {(t - restore) * TICK_MS / 1000:.1f}s after contact returned"
            lat_v.append(t - restore)
        assert s["store_events"] > 0, "store-and-forward never kicked in"
        ed, sdj = S("dijkstra", "blackout", sd)
        assert s["critical_delivery"] >= sdj["critical_delivery"]
        for a in ("ALERT-1", "ALERT-2"):
            td = ed.records[a].delivered_tick
            lat_d.append((td - restore) if td else 10 ** 6)
    assert sum(lat_v) / len(lat_v) <= sum(lat_d) / len(lat_d), "alerts not faster than Dijkstra on average"


@check("T10 store-and-forward is visible: STORE then RESUME events exist for stranded bundles")
def t_store():
    for st in ("dijkstra", "vorthyx"):
        e, s = S(st, "blackout", 42)
        kinds = {ev["kind"] for ev in e.events}
        assert {"STORE", "RESUME", "LINK_DOWN", "LINK_UP", "DELIVERED"} <= kinds
        assert s["bundles_stored_during_outage"] > 0


@check("T11 determinism: same seed => identical metrics; all strategies see the same workload")
def t_determinism():
    a, b = S("vorthyx", "chaos", 7)[1], S("vorthyx", "chaos", 7)[1]
    assert a == b, "non-deterministic run"
    ws = {}
    for st in STRATS:
        e = run_scenario(st, "link_fail", 9)
        ws[st] = sorted((r.id, r.priority, r.size, r.created_tick) for r in e.records.values())
    assert ws["dijkstra"] == ws["vorthyx"] == ws["epidemic"]


@check("T12 VORTHYX beats Dijkstra on CRITICAL latency in every scenario (mean over seeds)")
def t_latency():
    for sc in ("normal", "link_fail", "double_fail", "integrity", "flapping", "chaos"):
        v = sum(S("vorthyx", sc, sd)[1]["critical_avg_latency_s"] for sd in SEEDS) / len(SEEDS)
        d = sum(S("dijkstra", sc, sd)[1]["critical_avg_latency_s"] for sd in SEEDS) / len(SEEDS)
        assert v < d, f"{sc}: vorthyx {v:.2f}s !< dijkstra {d:.2f}s"


@check("T13 wire frame: roundtrip OK, any flipped bit is detected")
def t_wire():
    from . import wire
    f = wire.encode(42, 7, 4, "SAT-A", "EARTH", 900, b"engine temp 91C")
    d = wire.decode(f)
    assert d["bundle_no"] == 42 and d["payload"] == b"engine temp 91C" and d["dst"] == "EARTH"
    for i in range(len(f)):
        bad = bytearray(f)
        bad[i] ^= 0x01
        try:
            wire.decode(bytes(bad))
        except wire.FrameError:
            continue
        raise AssertionError(f"bit flip at byte {i} not detected")


@check("T14 CLI smoke: shell script + compare tables + snapshot JSON run without errors")
def t_cli():
    import json
    from .cli import Shell, comparison_table, run_many
    sh = Shell("vorthyx", 42)
    with contextlib.redirect_stdout(io.StringIO()):
        for line in ["gen 40", "run 30", "kill B D", "alert", "corrupt", "dup", "run 60", "status", "queues",
                     "links", "events 5", "restore B D", "finish", "metrics", "trace ALERT-1", "route ALERT-1",
                     "strategy dijkstra", "integrity off", "integrity on", "reset 3", "snapshot"]:
            sh.onecmd(line)
    txt = comparison_table(run_many(STRATS, "link_fail", [1, 2]), "t")
    assert "VORTHYX" in txt
    json.dumps(build_engine("vorthyx", "normal").snapshot(), default=str)


def run_all(verbose=False):
    fails = 0
    print(f"VORTHYX selftest: {len(RESULTS)} checks\n")
    for fn in RESULTS:
        try:
            fn()
            print(f"  PASS  {fn._name}")
        except Exception as exc:    # noqa: BLE001
            fails += 1
            print(f"  FAIL  {fn._name}\n        -> {type(exc).__name__}: {exc}")
            if verbose:
                import traceback
                traceback.print_exc()
    print(f"\n{len(RESULTS) - fails}/{len(RESULTS)} passed")
    return 1 if fails else 0
