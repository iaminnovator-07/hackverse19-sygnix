"""Metrics computed from the simulator's ground-truth records."""
from __future__ import annotations

from .config import PRIO_NAME, TICK_MS


def _pct(vals, q):
    if not vals:
        return 0.0
    s = sorted(vals)
    k = max(0, min(len(s) - 1, int(round(q * (len(s) - 1)))))
    return s[k]


def _avg(vals):
    return sum(vals) / len(vals) if vals else 0.0


def summarize(eng) -> dict:
    recs = list(eng.records.values())
    total = len(recs)
    ok = [r for r in recs if r.delivered_tick is not None and r.intact]
    lat = lambda r: (r.delivered_tick - r.created_tick) * TICK_MS / 1000.0
    by_prio = {}
    for p in (4, 3, 2, 1):
        pr = [r for r in recs if r.priority == p]
        po = [r for r in pr if r.delivered_tick is not None and r.intact]
        by_prio[PRIO_NAME[p]] = {
            "total": len(pr), "delivered": len(po),
            "rate": 100.0 * len(po) / len(pr) if pr else 100.0,
            "avg_latency_s": _avg([lat(r) for r in po]),
            "max_latency_s": max([lat(r) for r in po], default=0.0),
        }
    crit_lat = [lat(r) for r in ok if r.priority == 4]

    in_net = set()
    for n in eng.net.nodes.values():
        in_net.update(n.storage.keys())
    stuck = expired = lost = 0
    for r in recs:
        if r.delivered_tick is not None and r.intact:
            continue
        if r.id in in_net:
            stuck += 1
        elif r.expired:
            expired += 1
        else:
            lost += 1

    c = eng.c
    tot_busy = tot_avail = 0
    link_util = {}
    for l in eng.net.links.values():
        busy = sum(l.busy_ticks.values())
        avail = 2 * l.up_active_ticks      # utilisation measured while the network had work to do
        link_util[l.name] = {"utilization_pct": 100.0 * busy / avail if avail else 0.0,
                             "transmissions": l.tx_count, "up": l.up,
                             "availability_pct": 100.0 * l.up_ticks / eng.samples if eng.samples else 0.0}
        tot_busy += busy
        tot_avail += avail

    caps = {n.name: n.buffer_cap for n in eng.net.nodes.values() if n.buffer_cap}
    peak_pct = max((100.0 * eng.buf_peak[k] / v for k, v in caps.items()), default=0.0)
    avg_buf = _avg([eng.buf_sum[k] / max(1, eng.samples) for k in caps])

    drops = {PRIO_NAME[p]: eng.drops_by_prio[p] for p in (4, 3, 2, 1)}
    return {
        "strategy": eng.strategy.name,
        "integrity_layer": eng.integrity,
        "ticks": eng.tick,
        "total_bundles": total,
        "delivered": len(ok),
        "delivery_rate": 100.0 * len(ok) / total if total else 100.0,
        "critical_delivery": by_prio["CRITICAL"]["rate"],
        "avg_latency_s": _avg([lat(r) for r in ok]),
        "p95_latency_s": _pct([lat(r) for r in ok], 0.95),
        "critical_avg_latency_s": _avg(crit_lat),
        "critical_max_latency_s": max(crit_lat, default=0.0),
        "by_priority": by_prio,
        "duplicates_rejected_at_dest": c["dup_rejected_dest"],
        "duplicates_suppressed_in_net": c["dup_suppressed_net"],
        "duplicates_delivered": c["dup_delivered"],
        "corruption_detected": c["corruption_detected"],
        "corrupt_delivered": c["corrupt_delivered"],
        "transmissions": c["transmissions"],
        "retransmissions": c["retransmissions"],
        "overhead_tx_per_delivery": c["transmissions"] / len(ok) if ok else 0.0,
        "store_events": c["store_events"],
        "bundles_stored_during_outage": len(eng.stored_ids),
        "buffer_drops": c["drops"],
        "buffer_evictions": c["evictions"],
        "buffer_refusals": c["refusals"],
        "buffer_overflow_total": c["drops"] + c["evictions"] + c["refusals"],
        "drops_by_priority": drops,
        "undelivered_expired": expired,
        "undelivered_lost": lost,
        "undelivered_stuck": stuck,
        "inflight_lost_on_failure": c["inflight_lost_on_failure"],
        "link_utilization_pct": 100.0 * tot_busy / tot_avail if tot_avail else 0.0,
        "peak_buffer_pct": peak_pct,
        "avg_buffer_units": avg_buf,
        "links": link_util,
    }
