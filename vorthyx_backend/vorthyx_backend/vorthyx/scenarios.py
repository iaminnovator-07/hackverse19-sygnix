"""Reproducible test scenarios. Same (scenario, seed) => identical workload & channel weather
for every strategy, which is what makes the comparison fair."""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Callable, Optional

from .config import *
from .engine import Engine
from .topology import default_network


@dataclass
class Scenario:
    name: str
    desc: str
    duration: int = 1500
    ttl: int = DEFAULT_TTL
    n_bundles: int = 100
    mix: tuple = DEFAULT_MIX
    spread: int = 100
    buffer_scale: float = 1.0
    net_tweak: Optional[Callable] = None
    events: Optional[Callable] = None     # events(seed) -> [(tick, action, args...)]


def make_workload(seed, n, mix, spread):
    rng = random.Random(seed)
    tot = sum(mix)
    counts = [round(n * m / tot) for m in mix]
    counts[-1] += n - sum(counts)
    pris = [4] * counts[0] + [3] * counts[1] + [2] * counts[2] + [1] * counts[3]
    rng.shuffle(pris)
    ticks = sorted(rng.randrange(0, spread) for _ in pris)
    return [(t, p, rng.randint(*SIZE_RANGE[p])) for t, p in zip(ticks, pris)]


# ---------------------------------------------------------------- event builders
def _ev_normal(seed):
    return []


def _ev_link_fail(seed):
    return [(60, "kill", "B", "D"), (500, "restore", "B", "D")]


def _ev_double_fail(seed):
    return [(60, "kill", "B", "D"), (120, "kill", "C", "D"),
            (450, "restore", "C", "D"), (700, "restore", "B", "D")]


def _ev_blackout(seed):
    # every Earth link dies: all data must be stored; a CRITICAL alert is raised mid-outage
    return [(50, "kill", "D", "E"), (50, "kill", "C", "E"),
            (160, "gen", "CRITICAL", 8, "ALERT-1"),
            (240, "gen", "CRITICAL", 8, "ALERT-2"),
            (350, "restore", "D", "E"), (600, "restore", "C", "E")]


def _ev_congestion(seed):
    return [(40, "kill", "B", "D"), (400, "restore", "B", "D")]


def _ev_integrity(seed):
    ev = [(60, "kill", "B", "D"), (450, "restore", "B", "D")]
    ev += [(t, "corrupt") for t in (20, 45, 90, 130)]
    ev += [(t, "dup") for t in (30, 70, 110, 150)]
    ev += [(420, "replay"), (520, "replay")]
    return ev


def _ev_flapping(seed):
    ev = []
    t = 30
    up = True
    while t < 1000:
        ev.append((t, "restore" if up else "kill", "B", "D"))
        ev.append((t + 20, "kill" if up else "restore", "D", "E") if False else (t, "noop"))
        up = not up
        t += 45
    ev = [e for e in ev if e[1] != "noop"]
    # Earth link also flaps, out of phase
    t, up = 55, False
    while t < 1000:
        ev.append((t, "restore" if up else "kill", "D", "E"))
        up = not up
        t += 70
    ev.append((1000, "restore", "B", "D"))
    ev.append((1000, "restore", "D", "E"))
    return ev


def _ev_chaos(seed):
    rng = random.Random(seed * 7919 + 13)
    links = [("A", "B"), ("A", "C"), ("B", "C"), ("B", "D"), ("C", "D"), ("D", "E"), ("C", "E")]
    ev = []
    for _ in range(6):
        a, b = rng.choice(links)
        t0 = rng.randrange(30, 500)
        dur = rng.randrange(60, 260)
        ev.append((t0, "kill", a, b))
        ev.append((t0 + dur, "restore", a, b))
    ev.append((900, "gen", "CRITICAL", 8, "ALERT-1"))
    ev.append((1300, "restore", "A", "B"))
    return ev


def _tweak_lossy(net):
    for l in net.links.values():
        l.corrupt_prob = 0.04
        l.reliability = max(0.80, l.reliability - 0.05)


def _tweak_none(net):
    pass


SCENARIOS = {
    "normal": Scenario("normal", "Healthy network, no failures (sanity check)", events=_ev_normal),
    "link_fail": Scenario("link_fail", "Kill RELAY-B<->RELAY-D mid-transmission, restore later (THE killer demo)",
                          events=_ev_link_fail),
    "double_fail": Scenario("double_fail", "Two links die (B-D, C-D); RELAY-D gets isolated; backup C-EARTH link only",
                            events=_ev_double_fail),
    "blackout": Scenario("blackout", "All Earth links down: store-and-forward + CRITICAL alerts raised mid-outage",
                         events=_ev_blackout, duration=1800),
    "congestion": Scenario("congestion", "200 bundles, small buffers, link failure => buffer overflow policy matters",
                           n_bundles=200, spread=60, buffer_scale=0.45, events=_ev_congestion, duration=2200),
    "integrity": Scenario("integrity", "Lossy links + injected corruption, duplicates and replays during a failure",
                          events=_ev_integrity, net_tweak=_tweak_lossy),
    "flapping": Scenario("flapping", "Intermittent contacts (links up/down on a schedule) - classic DTN",
                         events=_ev_flapping, duration=1800),
    "chaos": Scenario("chaos", "Seeded random outages on random links + lossy channel",
                      events=_ev_chaos, net_tweak=_tweak_lossy, duration=2000),
    "demo": Scenario("demo", "Scripted live demo: cascading failure -> total blackout, CRITICAL alerts mid-outage, "
                             "recovery with injected corruption/duplicate/replay",
                     events=lambda seed: [(60, "kill", "B", "D"), (80, "kill", "D", "E"), (100, "kill", "C", "E"),
                                          (120, "gen", "CRITICAL", 8, "ALERT-1"), (160, "gen", "CRITICAL", 8, "ALERT-2"),
                                          (300, "restore", "D", "E"), (306, "corrupt"), (312, "dup"),
                                          (450, "replay"), (500, "restore", "B", "D"), (520, "restore", "C", "E")],
                     duration=1800),
}


def build_engine(strategy, scenario_name="link_fail", seed=42, integrity=True, with_workload=True,
                 baseline_overflow="refuse"):
    sc = SCENARIOS[scenario_name]
    net = default_network(sc.buffer_scale)
    if sc.net_tweak:
        sc.net_tweak(net)
    eng = Engine(strategy, seed=seed, integrity=integrity, network=net, ttl=sc.ttl,
                 baseline_overflow=baseline_overflow)
    eng.scenario = sc
    if with_workload:
        for t, p, size in make_workload(seed, sc.n_bundles, sc.mix, sc.spread):
            eng.at(t, "gen", p, size)
    for ev in (sc.events(seed) if sc.events else []):
        eng.at(ev[0], ev[1], *ev[2:])
    return eng


def run_scenario(strategy, scenario_name="link_fail", seed=42, integrity=True, listener=None, duration=None,
                 baseline_overflow="refuse"):
    eng = build_engine(strategy, scenario_name, seed, integrity, baseline_overflow=baseline_overflow)
    if listener:
        eng.listeners.append(listener)
    eng.run(duration or eng.scenario.duration)
    return eng
