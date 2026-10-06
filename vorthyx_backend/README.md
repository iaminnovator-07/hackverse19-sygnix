# VORTHYX backend (CLI-first) — ST-06 Disruption-Tolerant Space Data Routing & Priority Engine

Pure Python (stdlib only, tested on 3.12). No pip install needed. `api.py` is an *optional* FastAPI wrapper for the future dashboard.

```
python simulator.py selftest                 # 14 automated checks, exit code 1 on failure  (RUN THIS FIRST)
python simulator.py demo                     # scripted killer demo, paced (use --pause 0 for instant)
python simulator.py compare -c all --seeds 5 # full strategy comparison tables (+ --json out.json --csv out.csv)
python simulator.py run -s vorthyx -c blackout --events 60 --trace ALERT-1
python simulator.py shell                    # interactive control room (kill/restore/inject live)
python simulator.py shell --script scripts/killer_demo.txt
python simulator.py scenarios                # list scenarios
python bridge/bridge.py --node SAT-A         # auto-map a discovered board by logical node name
python bridge/bridge.py --serial COM3        # legacy direct-port connection still works when you already know it
```

## Hardware discovery and node mapping

The laptop bridge can now scan USB serial ports and identify connected ESP32 boards without guessing COM numbers:

- `GET /ports` lists every detected port with vendor / VID / PID metadata.
- `POST /ports/scan` opens each port, sends `HELLO`, reads the JSON response, and records `node_id`.
- `--node SAT-A` resolves the logical node to the actual COM port automatically.
- `COM_EARTH` is rejected as a literal port alias; use a real serial path or `--node` instead.

This is implemented in `bridge/port_discovery.py` and is kept separate from the simulator so the VORTHYX workload engine remains untouched.

## What is simulated
5 simulated ESP32-class nodes `SAT-A, RELAY-B, RELAY-C, RELAY-D, EARTH`, 7 links (latency / bandwidth / reliability / up-down).
`RELAY-C<->EARTH` is a slow direct backup link (added so "kill two links" is survivable).
Time is **tick-based** (1 tick = 50 ms virtual). All randomness = hash(seed, link, tick) so **every strategy sees identical
workload and channel weather** for the same seed (fair comparison, reproducible demo).

Per bundle: `id, seq, source, dest, priority, size, created_at, ttl, payload, SHA-256`.
Mechanisms: priority queues, store-and-forward, **custody transfer** (sender keeps the copy until ACK; ACK timeout -> retransmit),
buffer limits, TTL expiry, SHA-256 verification at **every hop**, duplicate rejection, fault injection.

## Strategies (compared on the same seed)
| name | idea |
|---|---|
| `dijkstra` | shortest path by latency over links that are UP now, FIFO queues, custody refused when buffer full. Priority-blind. |
| `vorthyx` | per-bundle path cost = latency + reliability + congestion (+hop), **weights depend on priority**; strict-priority queues (earliest deadline tie-break); **priority-based eviction** when a buffer fills; avoids pushing non-critical data into full buffers. |
| `epidemic` | flooding with summary vectors + immunity gossip (textbook version, not a straw man). Great delivery odds, huge overhead. |

`--baseline-overflow drop_tail` makes the baselines silently drop on overflow (naive router) — default `refuse` is the fairer one.

## Scenarios
normal · link_fail (B-D dies, restored) · double_fail (D isolated) · blackout (all Earth links down + CRITICAL alerts mid-outage) ·
congestion (200 bundles, small buffers) · integrity (lossy + injected corruption/duplicates/replay) · flapping (intermittent contacts) ·
chaos (seeded random outages) · demo (scripted: cascading failure -> blackout -> recovery + faults).

## Shell commands
`gen N [spread|PRIORITY]` · `alert` · `run N` · `step N` · `finish` · `kill A B` · `restore A B` · `corrupt` · `dup` · `replay` ·
`strategy NAME` · `integrity on|off` · `status` · `links` · `queues [node]` · `metrics` · `events N [lvl]` · `trace ID` · `route ID` ·
`snapshot [file]` · `reset [seed]` · `live 0|1|2` · `quit`.   Nodes: `A B C D E` (or full names).

## Results the simulator generates (compare -c all --seeds 5, mean) — delivery % / CRITICAL % / avg latency
```
Scenario     dijkstra          vorthyx           epidemic
normal       100 / 100 / 1.72  100 / 100 / 0.98   95 /  98 / 1.21
link_fail     99 / 100 / 1.97   99 / 100 / 1.13   93 /  98 / 1.26
double_fail   99 / 100 / 2.22   99 / 100 / 1.16   93 /  98 / 1.30
blackout      68 /  50 / 10.95  83 / 100 / 10.31  57 /  47 / 8.57
congestion    31 /  65 / 1.66   41 / 100 / 1.23   30 /  59 / 0.95
integrity     92 / 100 / 2.61   95 / 100 / 1.58   88 /  94 / 1.45
flapping      97 / 100 / 2.78   95 / 100 / 1.63   80 /  88 / 1.75
chaos         93 / 100 / 2.24   96 / 100 / 1.41   90 / 100 / 1.40
```
Re-run it yourself; do **not** paste these into slides as constants — judges will ask for the live run.

## Honest caveats (say them before the judges find them)
* VORTHYX is not best everywhere: in `flapping` Dijkstra delivers slightly more; VORTHYX deliberately sacrifices LOW bundles under buffer pressure to protect CRITICAL; Epidemic has the lowest raw latency in `chaos` but ~1.7x the transmissions.
* Priority is strict *per node*: a LOW bundle already sitting near Earth can leave before a CRITICAL one still 3 hops away when a contact returns. A contact-plan-aware planner (real CGR) would pre-position traffic; not implemented (future work).
* VORTHYX reacts to *current* link state; it does not use a future contact schedule. Weights (`Vorthyx.REL_W / CON_W`) are hand-tuned, not learned.
* Single source (SAT-A) and single destination (EARTH); 5 nodes; synthetic link numbers. Workload sizes/buffers were chosen so the network is loaded (otherwise nothing differentiates the strategies).
* Dijkstra "normal" can lose a few LOW bundles at the source buffer: all traffic funnels through one path (a real weakness of shortest-path under burst, not a bug).

## Judge Q&A -> where the proof lives
| Question | Command |
|---|---|
| Which 2 strategies, which metrics? | `compare -c link_fail` |
| Cut a link mid-demo: critical first? any duplicates? | `demo` or shell: `kill B D`, `alert`, `trace ALERT-1` |
| How do you detect corruption/duplicates? | SHA-256 per hop + id dedup at destination; `run -c integrity`; show `--no-integrity` for the damage |
| Storage full during long outage? | `compare -c congestion` (eviction: LOW first, never CRITICAL) |
| Is it deterministic / honest? | `selftest` (T11), same seed => identical numbers |

## Hardware demo: ESP32 WiFi mesh (laptop = EARTH end node)
See `esp32/README_ESP32.md`. Boards form an ESP-NOW mesh, kill/unplug a relay and traffic re-routes; `bridge/bridge.py` is the laptop side (live view + HTTP `/state`).
`sh esp32/host_test/run.sh` runs 29 checks of the real firmware core on virtual radios (g++ only); `python bridge/bridge.py --replay esp32/host_test/sample_earth_transcript.log` shows the bridge without hardware.
**The sketch has NOT been run on real boards** (none available while building) - test it early.

## Files
```
vorthyx/config.py      constants (tick, priorities, sizes, TTL)
vorthyx/models.py      Bundle, Record, Link, Node
vorthyx/topology.py    network + default 5-node topology (+ aliases A..E)
vorthyx/strategies.py  dijkstra / vorthyx / epidemic  (+ reverse-Dijkstra helper)
vorthyx/engine.py      tick loop, custody, buffers, integrity, fault injection, snapshot()
vorthyx/metrics.py     summarize(engine) -> all KPIs
vorthyx/scenarios.py   scenario registry, seeded workload, event schedules
vorthyx/cli.py         run / compare / demo / shell / selftest
vorthyx/selftest.py    14 checks (the 8 plan tests + invariants + determinism + wire)
vorthyx/wire.py        <=250-byte ESP-NOW frame encode/decode (CRC16 + SHA-256 prefix) for the ESP32 PoC
api.py                 optional FastAPI: GET /state, POST /control/{start|pause|reset}, /link/{kill|restore}?a=B&b=D,
                       /inject/{corrupt|dup|replay}, /generate, GET /trace/{id}, /compare/{scenario}
scripts/killer_demo.txt  shell script version of the demo
```

## How the 11 hours are now spent (backend is done)
| Time | Who | What |
|---|---|---|
| 0:00-0:30 | all | read this README, run `selftest` + `demo`, everyone watches the demo once |
| 0:30-5:30 | frontend (1-2 people) | dashboard on top of `api.py` (`GET /state` every 500 ms: nodes, links, queues, KPIs, last 40 events). KPI cards, graph with red failed link, event stream, control buttons, comparison chart from `/compare/{scenario}` |
| 0:30-3:00 | backend person | read engine/strategies end to end (judges WILL ask), try `--no-integrity`, tweak scenarios, add 1-2 own scenarios |
| 3:00-6:00 | you | optional ESP32 PoC with `wire.py` frames over ESP-NOW (3 boards: A, relay, gateway; serial -> laptop). Drop it if not stable by 90 minutes |
| 6:00-8:30 | all | integrate, bug-fix, full rehearsal of `demo` flow in the UI |
| 8:30-10:00 | you | 6 slides + rehearse 3x, practice the caveats list |
| last hour | — | buffer. No new features |
