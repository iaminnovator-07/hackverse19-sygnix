# VORTHYX on real ESP32s — WiFi mesh demo (ESP-NOW) with the laptop as the EARTH end node

```
 SAT-A (id 1)            RELAY-B (id 2)           EARTH gateway (id 0) ==USB==> laptop
 ESP32, generates  ~~~>  ESP32 relay      ~~~>    ESP32            serial     bridge.py (live view, metrics,
 telemetry / burst  \                      /                                  HTTP /state, typed commands)
                     ~~~> RELAY-C (id 3) ~~~>
                          ESP32 relay
   ~~~ = ESP-NOW over the ESP32's own WiFi radio (no router, no internet, no pairing UI)
```
Minimum 3 boards (EARTH + SAT + 1 relay); 4 boards (2 relays) is the good demo: kill the relay that carries traffic and
watch the mesh move to the other one. More relays: give them ids 4..7.

## What is real and what is simulated
| Real on the boards | Simulated for the demo |
|---|---|
| ESP-NOW radio frames between boards, beacons, neighbour table | `kill a b` = the two boards *ignore* each other (boards on one desk are all in radio range, so we block virtually) |
| A neighbour that goes silent (unplugged!) is declared DOWN after 2 s | `down <id>` = software "power loss" (physically unplugging a relay works too and is more convincing) |
| Route to EARTH recomputed from live beacons (split-horizon distance-vector) | The "space" part: delays/rates are those of a WiFi desk, not of a lunar link |
| Custody transfer: bundle stays in the sender's queue until the next hop ACKs; retransmit / re-route on timeout | |
| SHA-256 (8-byte prefix) per bundle checked at every hop + CRC-16 per frame, duplicate rejection | |
| Priority queue / store-and-forward / eviction of LOW when the 32-slot queue is full | |

## 1. Flash (5 minutes per board)
1. Open this project in PlatformIO. The project builds the sketch in `lib/esp32/vorthyx_node/vorthyx_node.ino` through `src/main.cpp` (keep `vx_core.h` next to the sketch).
2. Set `NODE_ID` in `platformio.ini` for each board: **0 = EARTH gateway, 1 = SAT-A, 2 = RELAY-B, 3 = RELAY-C**. Every board needs a unique id. All boards must use the same `WIFI_CHANNEL` (default 1).
3. Build and upload the `esp32dev` environment, then open Serial Monitor at 115200: you should see `# VORTHYX node N ready`.
4. EARTH board stays on the laptop's USB. SAT and relays: power banks / phone chargers (or the laptop's other USB ports).
Label the boards with their id with tape. Boards must be on the same `WIFI_CHANNEL` (default 1).

## 2. Laptop side
```
pip install pyserial
python bridge/bridge.py --serial COM5 --http 8001          # Windows;  Linux/mac: --serial /dev/ttyUSB0
python bridge/bridge.py --serial COM5 --serial COM6        # optionally also the SAT board (adds GEN/ROUTE events)
```
The bridge shows every bundle that reaches EARTH with its hop path, plus events the relays report **through the mesh**
(links lost, bundles stored, rerouted, corruption/duplicates caught). Whatever you type goes to the mesh:
`kill 1 2` · `restore 1 2` · `down 3` · `up 3` · `mode d` · `mode v` · `send 4 ENGINE FIRE` · `burst 20` · `auto 400` · `corrupt` · `dup` · `stats` · `quit`.
(`corrupt` / `dup` act on the board you typed them into, i.e. EARTH; to corrupt traffic from SAT-A use SAT's own serial monitor or `--serial` both boards and type there.)
`http://localhost:8001/state` returns nodes / links / metrics / events JSON for the dashboard; `POST /cmd?line=kill+1+2` sends a command.

## 3. The demo script (≈3 minutes)
1. Power relays + SAT. In the bridge: `LINK UP` lines appear, `stats` shows every node with hops to EARTH (SAT-A = 2).
2. SAT's Serial Monitor (or EARTH bridge): `auto 400` → bundles stream in; each `DELIVERED` line shows the path (SAT-A>RELAY-B>EARTH). Mixed priorities.
3. **Pull the USB cable of the relay named in the path** (or type `down 2`). Within ~2 s: `neighbour RELAY-B stopped answering -> LINK DOWN`, then new bundles arrive via `SAT-A>RELAY-C>EARTH`. Nothing was lost (custody + retransmit).
4. **Blackout:** also remove the second relay. SAT-A keeps accepting data: events show `STORED ... WAITING FOR CONTACT`. Type `burst 12` (mixed priorities) and `send 4 ALERT` while it's dark.
5. Plug a relay back. `contact available -> forwarding` appears and **CRITICAL arrives first**, then HIGH, NORMAL, LOW.
6. Integrity: on SAT's serial `corrupt` then wait → `CORRUPTION DETECTED ... rejected`, bundle still arrives intact. `dup` → `DUPLICATE DETECTED ... copy rejected`, delivered once.
7. Comparison on hardware: `mode d` (min-hop FIFO, no priorities) then `burst 28` on SAT, note the CRITICAL "age"; `mode v` and repeat. (In simulation CRITICAL got through 5x faster under the same burst: 86 ms vs 443 ms.)

Tip: traffic prefers the relay that has been ACKing reliably, so look at the DELIVERED path first and kill *that* one; killing the idle relay changes nothing (and that is correct behaviour).

## 4. Verified vs NOT verified (read this)
**Verified on a PC** (`esp32/host_test/run.sh`, g++ only, runs the real `vx_core.h` under AddressSanitizer + UBSan on virtual radios): 29 checks — SHA-256 NIST vector, CRC cross-check with Python `wire.py`, route convergence,
relay powered off mid-stream (30/30 delivered, rerouted, no duplicates), total blackout → STORE → RESUME → CRITICAL first, corruption detected + retransmitted, injected duplicate rejected, 25% frame loss on every hop (30/30),
queue-full eviction of LOW (and the DIJKSTRA mode dropping the CRITICAL instead), flooded kill/restore of a link, loop-free paths, relay→EARTH event reporting, VORTHYX vs min-hop under an identical burst.
The Arduino sketch is only **syntax-checked against stub headers** (core 2.x and 3.x signatures).

**NOT verified — I had no boards:** actual ESP-NOW behaviour (peer registration, channel setting on your core version, unicast reliability, radio range/RSSI), real timing, USB-serial throughput with several boards, brown-outs on power banks.
Test on the boards **today**, not at 3 a.m. of the hackathon. Likely first-day issues:
* *No NBR_UP lines*: boards on different `WIFI_CHANNEL`, duplicate `NODE_ID`, or `esp_now_init` failed (see `FATAL` line). Some cores want `WiFi.mode(WIFI_STA)` + `esp_wifi_start()` before `esp_wifi_set_channel`.
* *Unicast frames not arriving but beacons do*: the id→MAC table is learned from received frames; until a neighbour has been heard the sketch falls back to broadcast (works, but louder).
* *Core 3.x compile error on the receive callback*: signature differences between core releases; the `#if ESP_ARDUINO_VERSION_MAJOR >= 3` block is the only place to touch.

## 5. Limits (say them before the judges find them)
* Payload ≤ 64 bytes per bundle, 32-slot queue per node, ≤ 8 neighbours, hop limit 8; one bundle per 40 ms per node (≈25/s).
* Routing is distance-vector on live beacons + neighbour queue + ACK-success EWMA — no contact schedule (no real CGR). Link "reliability" is measured from ACKs, not RSSI.
* `age` in the bridge = time a bundle waited in queues (store-and-forward delay), not radio flight time; device clocks are not synchronised.
* Relay→EARTH event reports are best-effort and rate-limited (10/s), so under heavy loss some relay-side events may be missing on the laptop. EARTH's own events and `DELIVER` are exact.
* Security: integrity (hash/CRC) and duplicate rejection only. No encryption/authentication, 8-byte hash prefix, control frames (kill/down/mode) are unauthenticated — fine for a demo, not for a spacecraft.
* Phone as EARTH node is **not implemented** (the gateway speaks USB-serial to a laptop). A phone would need an ESP32 AP + WebSocket page or a USB-OTG serial app — future work.

## Wire format (v2, all big-endian)
Envelope: `'V' 'X' 0x02 kind hop_src hop_dst | body | CRC16(CCITT, init 0xFFFF) over everything before it`
kinds: 1 BEACON(hops, qlen, via, flags) · 2 DATA · 3 ACK(src, bno) · 4 CTRL(op, a, b, cseq) · 5 STATUS · 6 EVENT
DATA body: `src dst prio bno(2) ttl_ds(2) age_ds(2) npath path[6] hash8[8] plen payload[≤64]`  (≤ 108 bytes, far below the 250-byte ESP-NOW limit)
