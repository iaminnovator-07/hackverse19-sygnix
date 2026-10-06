"""Tick-based discrete simulation engine with store-and-forward, custody (ACK) transfer,
priority queues, buffer management, SHA-256 integrity and duplicate detection.

Determinism: all randomness is a hash of (seed, salt, link, tick), so every strategy faces
exactly the same "channel weather" for the same seed.
"""
from __future__ import annotations

import hashlib
import math
from collections import Counter
from dataclasses import dataclass

from .config import *
from .models import Bundle, Record, sha256_hex
from .strategies import make_strategy
from .topology import default_network


@dataclass
class Tx:
    arrive: int
    frm: str
    to: str
    bundle: Bundle
    lost: bool
    link: object
    seq: int


@dataclass
class Ack:
    arrive: int
    frm: str
    to: str
    bundle_id: str
    lost: bool
    link: object
    seq: int


class Engine:
    def __init__(self, strategy="vorthyx", seed=42, integrity=True, network=None, ttl=DEFAULT_TTL,
                 baseline_overflow="refuse"):
        self.strategy = make_strategy(strategy) if isinstance(strategy, str) else strategy
        if self.strategy.name != "vorthyx":
            # baselines: "refuse" = refuse custody when full (sender keeps the bundle, fair DTN behaviour)
            #            "drop_tail" = silently drop the newcomer (naive router behaviour)
            self.strategy.overflow_policy = baseline_overflow
        self.baseline_overflow = baseline_overflow
        self.seed = seed
        self.integrity = integrity
        self.net = network or default_network()
        self.ttl = ttl
        self.tick = 0
        self.events: list[dict] = []
        self.records: dict[str, Record] = {}
        self.schedule: dict[int, list] = {}
        self.data_tx: list[Tx] = []
        self.ack_tx: list[Ack] = []
        self._seq = 0
        self._cache: dict = {}
        self.links_version = 0
        self.counter = 0
        self.alert_counter = 0
        self.inject = {"corrupt": 0, "dup": 0}
        self.delivered_copies: dict[str, Bundle] = {}
        self.delivered_time: dict[str, int] = {}
        self.last_delivered = None
        self.listeners = []
        self.c = Counter()
        self.drops_by_prio = Counter()
        self.evict_by_prio = Counter()
        self.buf_sum = Counter()
        self.buf_peak = Counter()
        self.samples = 0
        self.store_events = 0
        self.stored_ids = set()

    # ------------------------------------------------------------------ utilities
    def rnd(self, salt, *parts) -> float:
        h = hashlib.sha256(f"{self.seed}|{salt}|{'|'.join(map(str, parts))}".encode()).digest()
        return int.from_bytes(h[:8], "big") / 2 ** 64

    def cached(self, key, fn):
        if key not in self._cache:
            self._cache[key] = fn()
        return self._cache[key]

    def occupancy(self, name) -> float:
        n = self.net.nodes[name]
        if n.buffer_cap is None:
            return 0.0
        return n.used() / n.buffer_cap

    def would_overflow(self, name, b) -> bool:
        n = self.net.nodes[name]
        return n.buffer_cap is not None and (n.used() + b.size) > n.buffer_cap * 0.95

    def backlog(self, name) -> float:
        """Rough queue pressure at a node (0 = empty, ~1 = ~30 ticks of work)."""
        def calc():
            n = self.net.nodes[name]
            units = sum(b.size for b in n.storage.values() if not b.pending)
            bw = sum(l.bandwidth for _, l in self.net.neighbors(name) if l.up) or 1
            return units / (bw * 30.0)
        return self.cached(("backlog", name), calc)

    def holds(self, name, bid) -> bool:
        n = self.net.nodes[name]
        return bid in n.storage or bid in n.delivered

    def time_s(self, tick=None) -> float:
        return (self.tick if tick is None else tick) * TICK_MS / 1000.0

    def _log(self, kind, msg, bundle=None, level=1):
        ev = {"tick": self.tick, "time": self.time_s(), "kind": kind, "msg": msg,
              "bundle": bundle.id if bundle is not None else None, "level": level}
        self.events.append(ev)
        for fn in self.listeners:
            fn(ev)
        return ev

    # ------------------------------------------------------------------ scheduling / commands
    def at(self, tick, action, *args):
        self.schedule.setdefault(tick, []).append((action, args))

    def do(self, action, *args):
        fn = {"gen": self.generate, "kill": self.kill_link, "restore": self.restore_link,
              "corrupt": self.inject_corrupt, "dup": self.inject_duplicate,
              "replay": self.inject_replay, "setrel": self.set_reliability}[action]
        return fn(*args)

    def generate(self, priority, size, label=None):
        if isinstance(priority, str):
            priority = PRIO_ID[priority.upper()]
        self.counter += 1
        bid = label or f"B-{self.counter:03d}"
        payload = hashlib.sha256(f"payload|{self.seed}|{bid}".encode()).digest() + bid.encode()
        b = Bundle(bid, self.counter, SOURCE, DEST, priority, size, self.tick, self.ttl,
                   payload, sha256_hex(payload), arrived_tick=self.tick, path=[SOURCE])
        rec = Record(bid, priority, size, self.tick)
        self.records[bid] = rec
        node = self.net.nodes[SOURCE]
        status = self._admit(node, b)
        lvl = 1 if priority >= CRITICAL else 2
        self._log("GEN", f"{bid} created {PRIO_NAME[priority]} size={size} seq={b.seq} "
                         f"sha256={b.payload_hash[:12]}...", b, lvl)
        if status != "STORED":
            rec.dropped = True
            self.c["source_rejects"] += 1
            if status == "REFUSED":          # (drop-tail already counted itself in _drop)
                self.drops_by_prio[priority] += 1
            self._log("DROP", f"{bid} could not be admitted at {SOURCE} (buffer full)", b, 1)
        return bid

    def kill_link(self, a, b):
        a, b = self.net.resolve(a), self.net.resolve(b)
        link = self.net.link(a, b)
        if link is None:
            raise KeyError(f"no link between {a} and {b}")
        if not link.up:
            return False
        link.up = False
        self.links_version += 1
        self._cache.clear()
        n1 = len([x for x in self.data_tx if x.link is link])
        n2 = len([x for x in self.ack_tx if x.link is link])
        self.data_tx = [x for x in self.data_tx if x.link is not link]
        self.ack_tx = [x for x in self.ack_tx if x.link is not link]
        self.c["inflight_lost_on_failure"] += n1 + n2
        self._log("LINK_DOWN", f"LINK {a} <-> {b} FAILED ({n1} bundle(s) + {n2} ACK(s) in flight lost)", None, 1)
        return True

    def restore_link(self, a, b):
        a, b = self.net.resolve(a), self.net.resolve(b)
        link = self.net.link(a, b)
        if link is None:
            raise KeyError(f"no link between {a} and {b}")
        if link.up:
            return False
        link.up = True
        self.links_version += 1
        self._cache.clear()
        self._log("LINK_UP", f"CONTACT RESTORED {a} <-> {b}", None, 1)
        return True

    def set_reliability(self, a, b, rel):
        link = self.net.link(self.net.resolve(a), self.net.resolve(b))
        link.reliability = rel

    def inject_corrupt(self):
        self.inject["corrupt"] += 1
        self._log("INJECT", "fault armed: next transmitted bundle will have its payload corrupted", None, 1)

    def inject_duplicate(self):
        self.inject["dup"] += 1
        self._log("INJECT", "fault armed: next transmitted bundle will be sent TWICE (duplicate)", None, 1)

    def inject_replay(self):
        if not self.last_delivered:
            self._log("INJECT", "replay skipped: nothing delivered yet", None, 1)
            return
        b = self.delivered_copies[self.last_delivered].copy_for_tx()
        self._seq += 1
        self.data_tx.append(Tx(self.tick + 1, "ATTACKER", b.dest, b, False, None, self._seq))
        self._log("INJECT", f"REPLAY: stale copy of already-delivered {b.id} injected towards {b.dest}", b, 1)

    # ------------------------------------------------------------------ buffer management
    def _drop(self, node, b, why, evicted=False):
        rec = self.records[b.id]
        rec.dropped = True
        if evicted:
            self.c["evictions"] += 1
            self.evict_by_prio[b.priority] += 1
        else:
            self.c["drops"] += 1
        self.drops_by_prio[b.priority] += 1
        self._log("EVICT" if evicted else "DROP", f"{b.id} ({PRIO_NAME[b.priority]}) at {node.name}: {why}", b,
                  1 if b.priority >= HIGH else 2)

    def _admit(self, node, b):
        cap = node.buffer_cap
        if cap is None or node.used() + b.size <= cap:
            node.storage[b.id] = b
            return "STORED"
        if self.strategy.overflow_policy == "priority_evict":
            victims = sorted([v for v in node.storage.values() if not v.pending and v.priority < b.priority],
                             key=lambda v: (v.priority, -v.created_tick, v.id))
            used, chosen = node.used(), []
            for v in victims:
                if used + b.size <= cap:
                    break
                chosen.append(v)
                used -= v.size
            if used + b.size <= cap:
                for v in chosen:
                    del node.storage[v.id]
                    self._drop(node, v, f"BUFFER FULL - evicted to admit {PRIO_NAME[b.priority]} {b.id}", evicted=True)
                node.storage[b.id] = b
                return "STORED"
        if self.strategy.overflow_policy == "drop_tail":
            self._drop(node, b, f"BUFFER FULL ({node.used()}/{cap}) - drop-tail")
            return "DROPPED"
        self.c["refusals"] += 1
        self._log("REFUSE", f"{b.id} ({PRIO_NAME[b.priority]}) refused at {node.name}: buffer full"
                            f"{'' if node.name == SOURCE else ' (sender keeps custody)'}", b, 2)
        return "REFUSED"

    # ------------------------------------------------------------------ main loop
    def step(self):
        t = self.tick
        self._cache.clear()
        for action, args in self.schedule.pop(t, []):
            self.do(action, *args)
        self._expire(t)
        self._deliver_acks(t)
        self._deliver_data(t)
        self._ack_timeouts(t)
        self._transmit(t)
        self._sample(t)
        self.tick += 1

    def run(self, until):
        while self.tick < until:
            self.step()

    def _expire(self, t):
        for n in self.net.nodes.values():
            for bid, b in list(n.storage.items()):
                if t - b.created_tick > b.ttl:
                    del n.storage[bid]
                    rec = self.records[bid]
                    if rec.delivered_tick is None and not rec.expired:
                        rec.expired = True
                        self._log("EXPIRE", f"{bid} ({PRIO_NAME[b.priority]}) TTL expired at {n.name}", b,
                                  1 if b.priority >= HIGH else 2)

    def _deliver_acks(self, t):
        due = sorted([a for a in self.ack_tx if a.arrive <= t], key=lambda a: (a.arrive, a.seq))
        self.ack_tx = [a for a in self.ack_tx if a.arrive > t]
        for a in due:
            if a.lost:
                self.c["acks_lost"] += 1
                continue
            sender = self.net.nodes[a.to]
            b = sender.storage.get(a.bundle_id)
            if b is None or a.frm not in b.pending:
                continue
            del b.pending[a.frm]
            if self.strategy.single_copy:
                del sender.storage[b.id]
                self._log("CUSTODY", f"{b.id} custody transferred {a.to} -> {a.frm} (ACK received)", b, 2)
            else:
                b.acked.add(a.frm)

    def _deliver_data(self, t):
        due = sorted([x for x in self.data_tx if x.arrive <= t], key=lambda x: (x.arrive, x.seq))
        self.data_tx = [x for x in self.data_tx if x.arrive > t]
        for tx in due:
            if tx.lost:
                self.c["tx_lost"] += 1
                self._log("LOSS", f"{tx.bundle.id} lost in transit {tx.frm} -> {tx.to} (no ACK will come)",
                          tx.bundle, 2)
                continue
            self._receive(tx, t)

    def _send_ack(self, receiver, tx, t):
        link = tx.link
        if link is None or not link.up:
            return
        lost = self.rnd("ackloss", link.name, receiver, t) > link.reliability
        self._seq += 1
        self.ack_tx.append(Ack(t + link.latency_ticks, receiver, tx.frm, tx.bundle.id, lost, link, self._seq))

    def _receive(self, tx, t):
        b, node = tx.bundle, self.net.nodes[tx.to]
        if self.integrity:
            self.c["hash_checks"] += 1
            if not b.intact():
                self.c["corruption_detected"] += 1
                self._log("CORRUPT", f"CORRUPTION DETECTED {b.id} at {node.name}: hash "
                                     f"{sha256_hex(b.payload)[:10]}.. != expected {b.payload_hash[:10]}.. "
                                     f"-> REJECTED (no ACK, sender will retransmit)", b, 1)
                return
        is_dest = node.name == b.dest
        if is_dest and b.id in node.delivered:
            if self.integrity:
                self.c["dup_rejected_dest"] += 1
                self._log("DUPLICATE", f"DUPLICATE DETECTED {b.id}: already delivered at "
                                       f"t={self.time_s(self.delivered_time[b.id]):.2f}s -> copy REJECTED", b, 1)
                self._send_ack(node.name, tx, t)
            else:
                self.c["dup_delivered"] += 1
                self._log("DUPLICATE", f"{b.id} delivered AGAIN (integrity layer OFF - duplicate leaked)", b, 1)
                self._send_ack(node.name, tx, t)      # link-layer ACK is independent of the integrity layer
            return
        if not is_dest and b.id in node.storage:
            self.c["dup_suppressed_net"] += 1
            if self.integrity:
                self._log("DUPLICATE", f"duplicate {b.id} suppressed at {node.name} (already holding it)", b, 2)
            self._send_ack(node.name, tx, t)
            return
        if is_dest:
            node.delivered.add(b.id)
            self.delivered_time[b.id] = t
            self.delivered_copies[b.id] = b
            self.last_delivered = b.id
            rec = self.records[b.id]
            rec.delivered_tick = t
            rec.path = b.path + [node.name]
            rec.intact = b.intact()
            lat = (t - b.created_tick) * TICK_MS / 1000.0
            if rec.intact:
                self._log("DELIVERED", f"{b.id} ({PRIO_NAME[b.priority]}) DELIVERED to {node.name} in {lat:.2f}s via "
                                       f"{'>'.join(x.replace('RELAY-', 'R-') for x in rec.path)} | SHA-256 VERIFIED"
                                       f"{' | DUPLICATE CHECK PASSED' if self.integrity else ''}", b,
                          1 if b.priority >= HIGH else 2)
            else:
                self.c["corrupt_delivered"] += 1
                self._log("DELIVERED", f"{b.id} delivered but PAYLOAD IS CORRUPT (integrity layer OFF)", b, 1)
            self._send_ack(node.name, tx, t)
            return
        # store at an intermediate node
        b.arrived_tick = t
        b.path = b.path + [node.name]
        b.pending, b.acked, b.waiting, b.last_hop = {}, set(), False, ""
        status = self._admit(node, b)
        if status in ("STORED", "DROPPED"):
            self._send_ack(node.name, tx, t)

    def _ack_timeouts(self, t):
        for n in self.net.nodes.values():
            for b in n.storage.values():
                for nb, dl in list(b.pending.items()):
                    if dl <= t:
                        del b.pending[nb]
                        self.c["retransmissions"] += 1
                        self._log("RETX", f"{b.id}: no ACK from {nb} -> will retransmit", b, 2)

    def _transmit(self, t):
        strat = self.strategy
        strat.pre_step(self, t)
        for name in sorted(self.net.nodes):
            n = self.net.nodes[name]
            if not n.storage:
                continue
            order = strat.order(self, n, list(n.storage.values()))
            wants = {}
            for b in order:
                if strat.single_copy and b.pending:
                    continue
                hops = strat.next_hops(self, n, b, t)
                wants[b.id] = hops
                if strat.reports_store:
                    if not hops and not b.waiting:
                        b.waiting = True
                        self.c["store_events"] += 1
                        self.stored_ids.add(b.id)
                        cap = n.buffer_cap if n.buffer_cap is not None else "inf"
                        self._log("STORE", f"{b.id} ({PRIO_NAME[b.priority]}) STORED at {n.name}: no route to "
                                           f"{b.dest} -> WAITING FOR CONTACT (buffer {n.used()}/{cap})", b,
                                  1 if b.priority >= HIGH else 2)
                    elif hops and b.waiting:
                        b.waiting = False
                        self._log("RESUME", f"{b.id} ({PRIO_NAME[b.priority]}) contact available at {n.name} -> "
                                            f"forwarding resumes via {hops[0]}", b, 1 if b.priority >= HIGH else 2)
            for nb, link in self.net.neighbors(name):
                if not link.up or link.busy_until[name] > t:
                    continue
                for b in order:
                    if b.id not in n.storage or nb not in wants.get(b.id, ()):
                        continue
                    if strat.single_copy and b.pending:
                        continue
                    self._send(n, nb, link, b, t)
                    break

    def _send(self, n, nb, link, b, t):
        assert link.up, "transmission attempted on a DOWN link"
        ser = max(1, math.ceil(b.size / link.bandwidth))
        link.busy_until[n.name] = t + ser
        link.busy_ticks[n.name] += ser
        link.tx_count += 1
        self.c["transmissions"] += 1
        arrive = t + ser + link.latency_ticks
        copy = b.copy_for_tx()
        lost = self.rnd("loss", link.name, n.name, t) > link.reliability
        corrupt = self.rnd("corr", link.name, n.name, t) < link.corrupt_prob
        dup = False
        if self.inject["corrupt"] > 0:
            self.inject["corrupt"] -= 1
            corrupt, lost = True, False
            self._log("INJECT", f"FAULT: payload of {b.id} corrupted on {n.name} -> {nb}", b, 1)
        if self.inject["dup"] > 0:
            self.inject["dup"] -= 1
            dup, lost = True, False
            self._log("INJECT", f"FAULT: {b.id} transmitted twice on {n.name} -> {nb}", b, 1)
        if corrupt:
            p = copy.payload
            copy.payload = bytes([p[0] ^ 0xFF]) + p[1:]
            self.c["corrupted_in_transit"] += 1
        self._seq += 1
        self.data_tx.append(Tx(arrive, n.name, nb, copy, lost, link, self._seq))
        if dup:
            self._seq += 1
            self.data_tx.append(Tx(arrive + 1, n.name, nb, copy.copy_for_tx(), False, link, self._seq))
            self.data_tx[-1].bundle.payload = copy.payload
        b.pending[nb] = arrive + link.latency_ticks + ACK_MARGIN
        if nb != b.last_hop:
            kind = "REROUTE" if b.last_hop else "ROUTE"
            desc = self.strategy.describe(self, n, b, nb)
            self._log(kind, f"{b.id} ({PRIO_NAME[b.priority]}) {n.name} -> {nb} {desc}", b,
                      1 if b.priority >= CRITICAL else 2)
            b.last_hop = nb
        else:
            self._log("SEND", f"{b.id} {n.name} -> {nb} (retransmit)", b, 2)

    def _sample(self, t):
        active = bool(self.data_tx) or any(n.storage for n in self.net.nodes.values() if n.buffer_cap is not None)
        for link in self.net.links.values():
            if link.up:
                link.up_ticks += 1
                if active:
                    link.up_active_ticks += 1
            for d in (link.a, link.b):
                busy = 1.0 if (link.busy_until[d] > t and link.up) else 0.0
                link.util_ema[d] = link.util_ema[d] * 0.95 + busy * 0.05
        for n in self.net.nodes.values():
            u = n.used()
            self.buf_sum[n.name] += u
            self.buf_peak[n.name] = max(self.buf_peak[n.name], u)
        self.samples += 1

    # ------------------------------------------------------------------ introspection
    def trace(self, bid):
        return [e for e in self.events if e["bundle"] == bid]

    def where(self, bid):
        return [(n.name, b) for n in self.net.nodes.values() for b in [n.storage.get(bid)] if b is not None]

    def explain_route(self, bid):
        out = []
        for name, b in self.where(bid):
            p = self.strategy.plan(self, self.net.nodes[name], b)
            out.append((name, p))
        return out

    def snapshot(self, last_events=40):
        from .metrics import summarize
        return {
            "tick": self.tick, "time_s": self.time_s(), "strategy": self.strategy.name,
            "integrity": self.integrity,
            "nodes": [{"name": n.name, "kind": n.kind, "buffer_used": n.used(), "buffer_cap": n.buffer_cap,
                       "queued": len([b for b in n.storage.values() if not b.pending]),
                       "awaiting_ack": len([b for b in n.storage.values() if b.pending]),
                       "bundles": [{"id": b.id, "priority": PRIO_NAME[b.priority], "size": b.size,
                                    "waiting": b.waiting} for b in n.storage.values()]}
                      for n in self.net.nodes.values()],
            "links": [{"a": l.a, "b": l.b, "up": l.up, "latency_ms": l.latency_ms, "bandwidth": l.bandwidth,
                       "reliability": l.reliability,
                       "utilization": round(max(l.util_ema.values()), 3)} for l in self.net.links.values()],
            "in_flight": len(self.data_tx),
            "metrics": summarize(self),
            "events": self.events[-last_events:],
        }
