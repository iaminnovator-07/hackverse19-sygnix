"""Routing strategies.

1. dijkstra  - classic shortest path (by latency) over currently-UP links, FIFO queues, drop-tail buffers.
               Priority-blind. This is the fair "normal graph routing" baseline.
2. vorthyx   - priority-aware DTN routing: per-bundle path cost mixes latency, link reliability,
               congestion and buffer pressure with weights that depend on the bundle's priority;
               strict-priority queues; priority-based eviction when a buffer fills.
3. epidemic  - flooding baseline (summary-vector epidemic): copy every bundle to every neighbour
               that does not hold it yet. Great delivery odds, terrible overhead.
"""
from __future__ import annotations

import heapq
import math

from .config import CRITICAL, HIGH, NORMAL, LOW, TICK_MS

INF = float("inf")


def dijkstra_to(eng, dest, cost_fn):
    """Reverse Dijkstra: dist[x] = cheapest cost from x to dest over links that are UP."""
    dist = {dest: 0.0}
    heap = [(0.0, dest)]
    while heap:
        d, y = heapq.heappop(heap)
        if d > dist.get(y, INF):
            continue
        for x, link in eng.net.neighbors(y):
            if not link.up:
                continue
            nd = d + cost_fn(x, y, link)
            if nd < dist.get(x, INF):
                dist[x] = nd
                heapq.heappush(heap, (nd, x))
    return dist


class Strategy:
    name = "base"
    label = "Base"
    single_copy = True            # custody transfer: sender releases copy after ACK
    overflow_policy = "drop_tail"  # or "priority_evict"
    reports_store = True          # log STORE/RESUME events (not meaningful for flooding)

    def order(self, eng, node, bundles):
        return sorted(bundles, key=lambda b: (b.arrived_tick, b.id))   # FIFO

    def pre_step(self, eng, t):
        """Hook called once per tick before transmissions (used by epidemic immunity gossip)."""

    def next_hops(self, eng, node, b, t):
        raise NotImplementedError

    def plan(self, eng, node, b):
        """Return dict(path=[...], reliability=float, eta_ms=int) or None."""
        return None

    def describe(self, eng, node, b, nb):
        p = self.plan(eng, node, b)
        if not p:
            return ""
        return (f"| path {'>'.join(x.replace('RELAY-', 'R-') for x in p['path'])} "
                f"| reliability {p['reliability'] * 100:.1f}% | est. delay {p['eta_ms']}ms")

    # ---- helpers shared by path-based strategies
    def _cost_fn(self, eng, b):
        raise NotImplementedError

    def _dist(self, eng, b, key_extra, t):
        cost = self._cost_fn(eng, b)
        return eng.cached((self.name, key_extra, b.dest), lambda: dijkstra_to(eng, b.dest, cost)), cost

    def _follow(self, eng, start, b, dist, cost):
        path, cur = [start], start
        while cur != b.dest and len(path) < 8:
            best, best_c = None, INF
            for nb, link in eng.net.neighbors(cur):
                if not link.up or nb not in dist or nb in path:
                    continue
                c = cost(cur, nb, link) + dist[nb]
                if c < best_c:
                    best, best_c = nb, c
            if best is None:
                return None
            path.append(best)
            cur = best
        return path if path[-1] == b.dest else None

    def _plan_from(self, eng, node, b, dist, cost):
        path = self._follow(eng, node.name, b, dist, cost)
        if not path:
            return None
        rel, eta = 1.0, 0
        for u, v in zip(path, path[1:]):
            l = eng.net.link(u, v)
            rel *= l.reliability
            eta += l.latency_ms + math.ceil(b.size / l.bandwidth) * TICK_MS
        return {"path": path, "reliability": rel, "eta_ms": eta}


class Dijkstra(Strategy):
    name = "dijkstra"
    label = "Dijkstra (shortest path)"

    def _cost_fn(self, eng, b):
        return lambda u, v, link: float(link.latency_ms)

    def next_hops(self, eng, node, b, t):
        dist, cost = self._dist(eng, b, "static", t)
        best, best_c = None, INF
        for nb, link in eng.net.neighbors(node.name):
            if not link.up or nb not in dist:
                continue
            c = cost(node.name, nb, link) + dist[nb]
            if c < best_c:
                best, best_c = nb, c
        return [best] if best else []

    def plan(self, eng, node, b):
        dist, cost = self._dist(eng, b, "static", eng.tick)
        return self._plan_from(eng, node, b, dist, cost)


class Vorthyx(Strategy):
    name = "vorthyx"
    label = "VORTHYX (priority-aware DTN)"
    overflow_policy = "priority_evict"

    # per-priority weights: how much each bundle class cares about each cost term
    REL_W = {CRITICAL: 0.60, HIGH: 0.40, NORMAL: 0.25, LOW: 0.10}   # per % of link unreliability
    CON_W = {CRITICAL: 0.50, HIGH: 2.00, NORMAL: 4.00, LOW: 6.00}   # per unit of congestion
    HOP_COST = 0.5
    FULL_BUFFER = 0.95

    def order(self, eng, node, bundles):
        # strict priority, then earliest deadline first
        return sorted(bundles, key=lambda b: (-b.priority, b.created_tick + b.ttl, b.id))

    def edge_cost(self, eng, u, v, link, p):
        lat = link.latency_ms / 100.0
        unrel = (1.0 - link.reliability) * 100.0
        cong = link.util_ema[u] + eng.occupancy(v) + min(3.0, eng.backlog(u))
        return lat + self.REL_W[p] * unrel + self.CON_W[p] * cong + self.HOP_COST

    def _cost_fn(self, eng, b):
        p = b.priority
        return lambda u, v, link: self.edge_cost(eng, u, v, link, p)

    def next_hops(self, eng, node, b, t):
        dist, cost = self._dist(eng, b, ("prio", b.priority), t)
        visited = set(b.path)
        cands = []
        for nb, link in eng.net.neighbors(node.name):
            if not link.up or nb not in dist:
                continue
            if nb != b.dest and b.priority < CRITICAL and eng.would_overflow(nb, b):
                continue            # don't push non-critical data into a full buffer
            c = cost(node.name, nb, link) + dist[nb]
            if nb in visited and nb != b.dest:
                c += 1000.0         # strongly avoid loops, but allow as last resort
            cands.append((c, nb))
        if not cands:
            return []
        cands.sort()
        return [cands[0][1]]

    def plan(self, eng, node, b):
        dist, cost = self._dist(eng, b, ("prio", b.priority), eng.tick)
        return self._plan_from(eng, node, b, dist, cost)


class Epidemic(Strategy):
    """Epidemic routing with a summary vector and 'immunity' gossip (delivered ids spread over live
    links and purge stale copies) - the textbook version, so the baseline is not a straw man."""
    name = "epidemic"
    label = "Epidemic (flooding)"
    single_copy = False
    reports_store = False

    def __init__(self):
        self.immune = {}

    def pre_step(self, eng, t):
        for n in eng.net.nodes.values():
            self.immune.setdefault(n.name, set()).update(n.delivered)
        for link in eng.net.links.values():
            if link.up:
                u = self.immune[link.a] | self.immune[link.b]
                self.immune[link.a] = set(u)
                self.immune[link.b] = set(u)
        for n in eng.net.nodes.values():
            for bid in [bid for bid in n.storage if bid in self.immune[n.name]]:
                del n.storage[bid]

    def next_hops(self, eng, node, b, t):
        out = []
        for nb, link in eng.net.neighbors(node.name):
            if not link.up or nb in b.pending or nb in b.acked:
                continue
            if eng.holds(nb, b.id):
                continue
            out.append(nb)
        out.sort(key=lambda x: (x != b.dest, x))
        return out

    def describe(self, eng, node, b, nb):
        return "| flooding copy"


REGISTRY = {"dijkstra": Dijkstra, "vorthyx": Vorthyx, "epidemic": Epidemic}
ALIAS = {"dj": "dijkstra", "shortest": "dijkstra", "vx": "vorthyx", "ep": "epidemic", "flood": "epidemic"}


def make_strategy(name: str) -> Strategy:
    key = ALIAS.get(name.lower(), name.lower())
    if key not in REGISTRY:
        raise KeyError(f"unknown strategy '{name}'. Choose from: {', '.join(REGISTRY)}")
    return REGISTRY[key]()
