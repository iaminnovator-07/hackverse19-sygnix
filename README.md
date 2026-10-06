# VORTHYX

## Disruption-Tolerant Space Data Routing & Priority Engine

> **ST-06 — Disruption-Tolerant Space Data Routing & Priority Engine**

VORTHYX is a disruption-tolerant networking system designed to demonstrate how critical data can continue to move through an unreliable communication network when links disappear, nodes fail, buffers fill, or packets are corrupted.

The project combines:

- Deterministic Python network simulation
- Adaptive routing strategies
- Priority-aware store-and-forward
- Custody transfer and ACK-based retransmission
- SHA-256 integrity verification
- Duplicate detection
- Fault injection and recovery
- Real ESP32 hardware-in-the-loop networking
- ESP-NOW mesh communication
- Laptop Mission Control
- Phone-based Earth endpoint
- Live network monitoring dashboard

> **Important:** The ESP32 setup is a terrestrial hardware-in-the-loop testbed representing the proposed space network. The ESP32 boards are not space-qualified communication hardware.

---

## 1. Problem

Space communication networks are different from conventional terrestrial networks because communication links can disappear due to node failure, intermittent connectivity, limited bandwidth, delay, outages, congestion, and unreliable channels.

A conventional shortest-path router is not sufficient when the network is disrupted.

VORTHYX addresses this using:

```text
Priority-aware routing
        +
Store-and-forward
        +
Adaptive path selection
        +
Custody transfer
        +
ACK-based retransmission
        +
Integrity verification
        +
Duplicate protection
        +
Fault recovery
```

---

## 2. Core Objective

VORTHYX demonstrates that when a communication path becomes unavailable:

1. Critical messages are prioritized.
2. Data is buffered during outages.
3. Routes can be recalculated when connectivity changes.
4. Data is forwarded through available paths.
5. Duplicate packets are rejected.
6. Corrupted packets are detected.
7. Delivery is verified using integrity checks and acknowledgements.
8. The system can recover after a failed link or node returns.

---

## 3. System Architecture

```text
                         VORTHYX
                            |
             +--------------+--------------+
             |                             |
             v                             v
      SOFTWARE SIMULATOR            HARDWARE TESTBED
             |                             |
       Python Engine                  ESP32 Mesh
             |                             |
       Routing Engine                 ESP-NOW
             |                             |
       Priority Engine            Store-and-Forward
             |                             |
       Integrity Engine                 ACK
             |                             |
             +--------------+--------------+
                            |
                            v
                     Mission Control
                            |
                          Laptop
                            |
                    FastAPI / Bridge
                            |
              +-------------+-------------+
              |                           |
              v                           v
           ESP32-A                    Dashboard
            SAT-A
              |
           ESP-NOW
              |
              v
           ESP32-B
           RELAY-B
              |
           ESP-NOW
              |
              v
           ESP32-C
           EARTH-C
              |
            Wi-Fi
              |
              v
            PHONE
         PHONE-EARTH
```

The software simulator proves the routing and disruption logic.

The physical testbed proves that the same networking concepts can be exercised using real ESP32 nodes.

---

## 4. Physical Hardware Demonstration

The physical demonstration uses:

- 3 ESP32 boards
- 1 laptop
- 1 smartphone

Recommended mapping:

```text
ESP32-A = SAT-A
ESP32-B = RELAY-B
ESP32-C = EARTH-C

Laptop = MISSION-EARTH
Phone  = PHONE-EARTH
```

Basic physical flow:

```text
LAPTOP
  |
  | USB / Serial
  v
ESP32-A
 SAT-A
  |
  | ESP-NOW
  v
ESP32-B
 RELAY-B
  |
  | ESP-NOW
  v
ESP32-C
 EARTH-C
  |
  | Wi-Fi / HTTP
  v
PHONE
 PHONE-EARTH
```

Where practical, an alternate physical link can be configured:

```text
             +----------------+
             |                |
             v                |
          SAT-A <----------> EARTH-C
            |                 ^
            |                 |
            v                 |
         RELAY-B -------------+
```

If no alternate physical route exists, the system demonstrates disruption tolerance using store-and-forward buffering until connectivity returns.

---

## 5. Software Stack

### Backend

```text
Python 3.12+
FastAPI
Uvicorn
PySerial
NetworkX
hashlib
Python standard library
```

### Frontend

```text
React
TypeScript
Vite
Tailwind CSS
React Flow / SVG
Recharts
```

### Hardware

```text
ESP32
ESP-NOW
Wi-Fi
UART / USB Serial
NVS / Preferences
```

### Phone

```text
Mobile Web UI
Local Wi-Fi
HTTP / WebSocket
```

---

## 6. Repository Structure

```text
vorthyx/
│
├── README.md
│
├── vorthyx_backend/
│   ├── simulator.py
│   ├── api.py
│   │
│   ├── vorthyx/
│   │   ├── config.py
│   │   ├── models.py
│   │   ├── topology.py
│   │   ├── strategies.py
│   │   ├── engine.py
│   │   ├── metrics.py
│   │   ├── scenarios.py
│   │   ├── cli.py
│   │   ├── selftest.py
│   │   └── wire.py
│   │
│   ├── bridge/
│   │   ├── bridge.py
│   │   ├── port_discovery.py
│   │   ├── serial_transport.py
│   │   ├── protocol.py
│   │   └── hardware_state.py
│   │
│   └── scripts/
│       └── killer_demo.txt
│
├── esp32/
│   ├── common/
│   │   ├── protocol.h
│   │   ├── routing.h
│   │   ├── queue.h
│   │   └── integrity.h
│   │
│   ├── sat_a/
│   │   └── sat_a.ino
│   ├── relay_b/
│   │   └── relay_b.ino
│   └── earth_c/
│       └── earth_c.ino
│
├── phone/
│   └── earth-node/
│
└── dashboard/
    └── ...
```

---

## 7. Existing Software Simulator

The simulator contains five simulated ESP32-class nodes:

```text
SAT-A
RELAY-B
RELAY-C
RELAY-D
EARTH
```

It models seven links with latency, bandwidth, reliability, and up/down state.

A slow `RELAY-C <-> EARTH` direct backup link is included.

Simulation time is tick-based:

```text
1 tick = 50 ms virtual time
```

Randomness is seeded so the same seed produces reproducible network conditions.

---

## 8. Bundle Model

Each bundle contains:

```text
id
seq
source
destination
priority
size
created_at
ttl
payload
SHA-256
```

Example:

```json
{
  "id": "VTX-001",
  "seq": 1,
  "source": "MISSION-EARTH",
  "destination": "PHONE-EARTH",
  "priority": "CRITICAL",
  "size": 128,
  "ttl": 10,
  "payload": "MISSION ALERT",
  "hash": "..."
}
```

---

## 9. Priority Levels

```text
CRITICAL
HIGH
NORMAL
LOW
```

Under congestion:

```text
CRITICAL
   ↓
HIGH
   ↓
NORMAL
   ↓
LOW
```

VORTHYX uses strict-priority queues and priority-aware buffer handling.

---

## 10. Routing Strategies

### Dijkstra

Baseline:

- Shortest path by current latency
- Uses currently UP links
- FIFO queues
- Priority-blind

### VORTHYX

Adaptive:

- Latency-aware
- Reliability-aware
- Congestion-aware
- Priority-aware
- Hop-aware

Uses:

- Strict-priority queues
- Earliest-deadline tie-breaking
- Priority-based buffer eviction
- Adaptive path selection

### Epidemic

Flooding-based:

- Summary vectors
- Immunity / gossip
- Replication

Provides strong delivery odds but introduces significant transmission overhead.

---

## 11. Store-and-Forward

When a route becomes unavailable, packets are retained instead of immediately discarded.

```text
LAPTOP
  |
  v
SAT-A
  |
  X
RELAY-B
```

SAT-A stores:

```text
QUEUE

VTX-001  CRITICAL
VTX-002  HIGH
VTX-003  NORMAL
VTX-004  LOW
```

When connectivity returns:

```text
QUEUE
  |
  v
RELAY-B
  |
  v
EARTH-C
  |
  v
PHONE
```

---

## 12. Custody Transfer and ACK

The sender keeps a copy of a bundle until the next hop acknowledges successful reception.

```text
SENDER
  |
  | Bundle
  v
NEXT HOP
  |
  | ACK
  v
SENDER releases copy
```

If acknowledgement times out:

```text
ACK TIMEOUT
     |
     v
RETRANSMIT
```

---

## 13. SHA-256 Integrity

Every bundle has an integrity hash.

At every receiving hop:

```text
Receive packet
      |
Calculate SHA-256
      |
Compare hash
      |
  +---+---+
  |       |
MATCH   MISMATCH
  |       |
  v       v
FORWARD  REJECT
```

Valid:

```text
SHA-256
✓ VERIFIED
```

Corrupted:

```text
INTEGRITY FAILURE
✗ REJECTED
```

---

## 14. Duplicate Detection

Packet identity:

```text
bundle_id + sequence_number
```

If a packet is already known:

```text
DUPLICATE DETECTED
        |
        v
     REJECTED
```

---

## 15. ESP32 Communication

ESP32-to-ESP32 communication uses ESP-NOW.

```text
SAT-A
  |
ESP-NOW
  |
RELAY-B
  |
ESP-NOW
  |
EARTH-C
```

Additional peer links may be configured to provide alternate physical routes.

The dashboard must reflect the actual physical topology.

---

## 16. Laptop Mission Control

The laptop is the Mission Control station.

Responsibilities:

- Bundle generation
- Hardware discovery
- ESP32 monitoring
- Packet injection
- Network monitoring
- Fault control
- Packet tracing
- Metrics
- Dashboard state
- Simulator control

Laptop-to-SAT-A:

```text
Laptop
  |
  | USB Serial
  v
SAT-A
```

---

## 17. Automatic ESP32 Discovery

Do not assume:

```text
COM3 = SAT-A
COM4 = RELAY-B
COM5 = EARTH-C
```

Find available ports:

```powershell
python -m serial.tools.list_ports
```

Example:

```text
COM3
COM4
COM5
COM6
COM8
```

The bridge performs an identification handshake:

```text
Laptop
  |
  | HELLO
  v
ESP32
  |
  | node_id = SAT-A
  v
Laptop
```

Example:

```text
COM3 → SAT-A
COM4 → RELAY-B
COM5 → EARTH-C
COM6 → UNKNOWN
COM8 → UNKNOWN
```

The mapping is based on the ESP32 identity, not the COM number.

---

## 18. ESP32 Identification Protocol

Every ESP32 responds to:

```text
HELLO
```

Example:

```json
{
  "type": "HELLO",
  "device": "ESP32",
  "node_id": "SAT-A",
  "firmware": "vorthyx-1.0",
  "capabilities": [
    "ESP-NOW",
    "FORWARD",
    "QUEUE",
    "ACK",
    "SHA256"
  ]
}
```

Supported IDs:

```text
SAT-A
RELAY-B
EARTH-C
```

Store the node ID persistently using ESP32 NVS / Preferences.

---

## 19. Hardware Manager

The laptop bridge maintains multiple ESP32 connections.

Example:

```text
HardwareManager

SAT-A
  COM3
  ONLINE

RELAY-B
  COM4
  ONLINE

EARTH-C
  COM5
  ONLINE
```

Responsibilities:

- Port discovery
- Node identification
- Serial connection management
- Reconnection
- Telemetry collection
- Packet transmission
- Event collection
- Hardware state management

---

## 20. Auto-Reconnect

If an ESP32 is unplugged:

```text
RELAY-B
🔴 OFFLINE
```

The backend must continue running.

When it is plugged back in:

```text
RELAY-B
🟢 ONLINE
```

The bridge should automatically reconnect and re-identify the node.

---

## 21. Heartbeats

Each ESP32 periodically reports:

```text
node_id
uptime
free_heap
queue_size
packets_received
packets_forwarded
packets_dropped
duplicate_count
corruption_count
neighbors
```

Recommended interval:

```text
1 second
```

If heartbeats stop beyond the configured timeout:

```text
NODE OFFLINE
```

---

## 22. Real Packet Flow

The physical demonstration must use real packets.

```text
LAPTOP
  ↓
SAT-A
  ↓
RELAY-B
  ↓
EARTH-C
  ↓
PHONE
```

Example:

```text
ID:
VTX-001

SOURCE:
MISSION-EARTH

DESTINATION:
PHONE-EARTH

PRIORITY:
CRITICAL

PAYLOAD:
MISSION ALERT
```

Example trace:

```text
TX VTX-001 → SAT-A
RX VTX-001 @ SAT-A

TX VTX-001 → RELAY-B
RX VTX-001 @ RELAY-B

TX VTX-001 → EARTH-C
RX VTX-001 @ EARTH-C

DELIVERED VTX-001 @ PHONE
```

---

## 23. Phone Earth Endpoint

Phone UI:

```text
VORTHYX EARTH NODE

STATUS
🟢 CONNECTED

NODE
PHONE-EARTH

LAST PACKET
VTX-001

PRIORITY
CRITICAL

MESSAGE
MISSION ALERT

INTEGRITY
✓ SHA-256 VERIFIED
```

The phone can send a response:

```text
PHONE
  ↓
EARTH-C
  ↓
RELAY-B
  ↓
SAT-A
  ↓
LAPTOP
```

This demonstrates bidirectional communication.

---

## 24. Node Failure Demonstration

Normal:

```text
LAPTOP
  ↓
SAT-A
  ↓
RELAY-B
  ↓
EARTH-C
  ↓
PHONE
```

Turn off RELAY-B:

```text
RELAY-B
🔴 OFFLINE
```

If an alternate physical path exists, use it.

Otherwise:

```text
SAT-A
  |
  v
LOCAL QUEUE
```

The packet remains buffered until connectivity returns.

---

## 25. Recovery

Restore RELAY-B:

```text
RELAY-B
🟢 ONLINE
```

Release queued bundles:

```text
QUEUE
  |
  v
RELAY-B
  |
  v
EARTH-C
  |
  v
PHONE
```

Result:

```text
DELIVERED
✓
```

---

## 26. Live Dashboard

### Network Status

```text
ACTIVE NODES
3

ACTIVE LINKS
3

QUEUED BUNDLES
4

DELIVERED
27

DUPLICATES
1

CORRUPTED
1

DELIVERY RATE
96.4%
```

### Network Graph

```text
              SAT-A
             /                 /              RELAY-B ---- EARTH-C
                       |
                     PHONE
```

Nodes display:

- Online/offline state
- Queue length
- RX count
- TX count
- Drops
- Duplicate count
- Corruption count

---

## 27. Packet Trace

```text
VTX-001

MISSION-EARTH
      ✓
      |
      v
SAT-A
      ✓
      |
      v
RELAY-B
      ✓
      |
      v
EARTH-C
      ✓
      |
      v
PHONE-EARTH
      ✓

SHA-256
✓ VERIFIED

ACK
✓ RECEIVED

STATUS
DELIVERED
```

---

## 28. Event Stream

Example:

```text
14:32:10  Bundle VTX-001 created
14:32:11  SAT-A received VTX-001
14:32:11  SAT-A → RELAY-B
14:32:12  RELAY-B received VTX-001
14:32:13  RELAY-B OFFLINE
14:32:13  Route unavailable
14:32:13  Bundle queued
14:32:18  RELAY-B ONLINE
14:32:18  Bundle forwarded
14:32:19  EARTH-C received VTX-001
14:32:19  PHONE received VTX-001
14:32:19  SHA-256 verified
14:32:19  ACK received
```

All events must come from actual simulator or hardware state.

---

## 29. Killer Demo

### Step 1 — Discover hardware

```text
SAT-A       🟢
RELAY-B     🟢
EARTH-C     🟢
PHONE       🟢
```

### Step 2 — Send normal message

```text
Laptop
→ SAT-A
→ RELAY-B
→ EARTH-C
→ Phone
```

### Step 3 — Send critical message

```text
CRITICAL
MISSION ALERT
```

### Step 4 — Generate multiple priorities

```text
CRITICAL
HIGH
NORMAL
LOW
```

### Step 5 — Kill RELAY-B

```text
RELAY-B
🔴 OFFLINE
```

### Step 6 — Generate traffic during disruption

Critical traffic must either:

- take a real alternate physical route, or
- remain buffered using store-and-forward.

### Step 7 — Restore RELAY-B

```text
RELAY-B
🟢 ONLINE
```

### Step 8 — Release queued traffic

```text
QUEUE
↓
FORWARD
↓
PHONE
```

### Step 9 — Verify integrity

```text
SHA-256
✓ VERIFIED
```

### Step 10 — Duplicate protection

```text
DUPLICATE DETECTED
✗ REJECTED
```

### Step 11 — Corruption protection

```text
INTEGRITY FAILURE
✗ REJECTED
```

### Step 12 — Show final metrics

Show:

- Delivery rate
- Critical delivery rate
- Average latency
- Duplicates
- Corrupted packets
- Dropped bundles
- Queue utilization

---

## 30. Existing Simulator Commands

Run from the backend directory.

### Self Test

```powershell
python simulator.py selftest
```

The simulator contains 14 automated checks.

### Killer Demo

```powershell
python simulator.py demo
```

Instant:

```powershell
python simulator.py demo --pause 0
```

### Strategy Comparison

```powershell
python simulator.py compare -c all --seeds 5
```

Export:

```powershell
python simulator.py compare -c all --seeds 5 --json out.json --csv out.csv
```

### Scenario Run

```powershell
python simulator.py run -s vorthyx -c blackout --events 60 --trace ALERT-1
```

### Interactive Shell

```powershell
python simulator.py shell
```

Or:

```powershell
python simulator.py shell --script scripts/killer_demo.txt
```

### Scenario List

```powershell
python simulator.py scenarios
```

---

## 31. Scenarios

```text
normal
link_fail
double_fail
blackout
congestion
integrity
flapping
chaos
demo
```

---

## 32. Interactive Shell Commands

```text
gen N [spread|PRIORITY]
alert
run N
step N
finish

kill A B
restore A B

corrupt
dup
replay

strategy NAME

integrity on|off

status
links
queues [node]
metrics
events N [lvl]

trace ID
route ID

snapshot [file]
reset [seed]

live 0|1|2

quit
```

Nodes can be referenced as:

```text
A B C D E
```

or by their full names.

---

## 33. FastAPI

The API layer provides:

```text
GET  /state

POST /control/start
POST /control/pause
POST /control/reset

POST /link/kill
POST /link/restore

POST /inject/corrupt
POST /inject/dup
POST /inject/replay

POST /generate

GET /trace/{id}

GET /compare/{scenario}
```

Start:

```powershell
python -m uvicorn api:app --reload
```

---

## 34. Hardware Bridge

Install PySerial:

```powershell
python -m pip install pyserial
```

Find ports:

```powershell
python -m serial.tools.list_ports
```

Example:

```text
COM3
COM4
COM5
COM6
COM8
```

Do **not** use:

```text
COM_EARTH
```

as a literal Windows COM port.

Use actual discovered ports or logical node IDs.

Recommended:

```powershell
python bridge.py --scan
```

Then:

```powershell
python bridge.py --auto --http 8001
```

---

## 35. Hardware Auto Discovery

Expected output:

```text
VORTHYX HARDWARE DISCOVERY

Scanning serial ports...

COM3 → ESP32 → SAT-A      🟢
COM4 → ESP32 → RELAY-B    🟢
COM5 → ESP32 → EARTH-C    🟢
COM6 → UNKNOWN            ⚪
COM8 → UNKNOWN            ⚪

3 VORTHYX nodes identified.
```

The backend must identify boards using the ESP32 handshake rather than assuming fixed COM-port order.

---

## 36. Hardware API

Recommended additions:

```text
GET  /ports
POST /ports/scan

GET  /hardware/state

POST /hardware/send

POST /hardware/node/{node_id}/restart

POST /hardware/node/{node_id}/kill
POST /hardware/node/{node_id}/restore

GET  /hardware/events

GET  /hardware/trace/{bundle_id}
```

These extend the existing simulator API rather than replacing it.

---

## 37. Hardware Packet Format

Logical bundle:

```json
{
  "id": "VTX-001",
  "seq": 1,
  "source": "MISSION-EARTH",
  "destination": "PHONE-EARTH",
  "priority": "CRITICAL",
  "ttl": 10,
  "payload": "MISSION ALERT",
  "hash": "..."
}
```

Physical ESP-NOW frames should remain compact because ESP-NOW payload size is limited.

The existing `wire.py` provides an ESP-NOW-oriented compact frame format with CRC16 and a SHA-256 prefix.

---

## 38. Metrics

VORTHYX tracks:

```text
Delivery Rate
Critical Delivery Rate
Average Latency
Duplicate Count
Corruption Count
Dropped Bundles
Buffer Utilization
Link Utilization
Routing Overhead
```

These metrics are used to compare routing strategies.

---

## 39. Strategy Comparison

Run:

```powershell
python simulator.py compare -c all --seeds 5
```

Compare:

```text
Dijkstra
VORTHYX
Epidemic
```

All strategies should receive equivalent seeded workloads and channel conditions for fair comparison.

Do not hardcode sample numbers into presentation slides.

Run the current simulator before presenting results.

---

## 40. Judge Questions

### Which strategies are compared?

Dijkstra, VORTHYX and Epidemic.

```powershell
python simulator.py compare -c link_fail
```

### What happens when a link fails?

Use:

```text
kill B D
```

Then:

```text
alert
trace ALERT-1
```

The system either selects an available path or stores traffic until connectivity returns.

### How is corruption detected?

SHA-256 verification.

### How are duplicates detected?

Bundle ID + sequence number.

### What happens when buffers fill?

Priority-aware eviction protects critical traffic.

### Is the simulator deterministic?

```powershell
python simulator.py selftest
```

The seeded simulation is designed to produce reproducible results.

---

## 41. Honest Limitations

VORTHYX is a prototype and research demonstration.

Current limitations:

- Synthetic network topology
- Small physical ESP32 testbed
- Hand-tuned routing weights
- No future contact-plan prediction
- No real satellite RF communication
- No space-qualified hardware
- Limited physical node count
- Synthetic simulator traffic
- Terrestrial physical testbed

VORTHYX should be presented as a routing and disruption-tolerance prototype, not a production satellite communication system.

---

## 42. Why VORTHYX?

Traditional shortest-path routing asks:

> "What is the shortest route right now?"

VORTHYX asks:

> "What is the best route for this message given its priority, link reliability, congestion and current network state?"

That distinction becomes important when communication links are intermittent.

---

## 43. End-to-End Demonstration

```text
                  MISSION CONTROL
                       LAPTOP
                          |
                          v
                       SAT-A
                        🛰
                       /                         /                      RELAY-B   EARTH-C
                    🛰        🌍
                               |
                               v
                             PHONE
```

### Normal

```text
Laptop
  ↓
SAT-A
  ↓
RELAY-B
  ↓
EARTH-C
  ↓
Phone
```

### Failure

```text
Laptop
  ↓
SAT-A
  ↓
RELAY-B ❌
```

### VORTHYX Response

```text
FAILURE DETECTED
       ↓
ROUTE RECOMPUTATION
       ↓
ALTERNATE ROUTE
       OR
STORE-AND-FORWARD
```

### Recovery

```text
RELAY-B 🟢
       ↓
QUEUE RELEASE
       ↓
FORWARD
       ↓
PHONE
       ↓
SHA-256 VERIFIED
       ↓
ACK
```

---

## 44. Final Acceptance Tests

### Test 1 — Laptop → Phone

```text
Laptop
→ SAT-A
→ RELAY-B
→ EARTH-C
→ Phone
```

Phone receives the message.

### Test 2 — Phone → Laptop

```text
Phone
→ EARTH-C
→ RELAY-B
→ SAT-A
→ Laptop
```

Laptop receives the message.

### Test 3 — Node Failure

Turn off RELAY-B.

Expected:

```text
RELAY-B
🔴 OFFLINE
```

### Test 4 — Store-and-Forward

Send a CRITICAL bundle while the route is unavailable.

Expected:

```text
Bundle queued
```

### Test 5 — Recovery

Restore RELAY-B.

Expected:

```text
Queued bundle
→ forwarded
→ delivered
```

### Test 6 — Integrity

Inject corruption.

Expected:

```text
CORRUPTED
✗ REJECTED
```

### Test 7 — Duplicate

Inject a duplicate.

Expected:

```text
DUPLICATE
✗ REJECTED
```

### Test 8 — Dashboard

Dashboard displays actual:

```text
Nodes
Links
Queues
Bundles
Events
Routes
Metrics
Failures
Recovery
```

---

## 45. Development Order

```text
PHASE 1
Existing simulator
        ↓
Run selftest
        ↓
Run demo
```

```text
PHASE 2
ESP32 firmware
        ↓
HELLO
        ↓
Node identification
        ↓
ESP-NOW communication
```

```text
PHASE 3
Laptop hardware bridge
        ↓
COM discovery
        ↓
Multi-node management
        ↓
Telemetry
```

```text
PHASE 4
Real packet transmission
        ↓
Laptop → ESP32
        ↓
ESP32 → ESP32
        ↓
ESP32 → Phone
```

```text
PHASE 5
Store-and-forward
        ↓
ACK
        ↓
Retransmission
        ↓
Priority
```

```text
PHASE 6
Fault injection
        ↓
Node failure
        ↓
Recovery
        ↓
Integrity
        ↓
Duplicates
```

```text
PHASE 7
Dashboard
        ↓
Live topology
        ↓
Packet trace
        ↓
Metrics
```

```text
PHASE 8
Killer Demo
        ↓
Full rehearsal
```

---

## 46. Demo Principle

Prioritize reliable functionality over unnecessary visual effects.

The final demonstration should show:

```text
REAL PACKET
REAL ESP32
REAL WIRELESS FORWARDING
REAL NODE FAILURE
REAL QUEUE
REAL RECOVERY
REAL INTEGRITY CHECK
REAL PHONE DELIVERY
REAL METRICS
```

Do not use fake packet animations or fake metrics.

---

## 47. Final Pitch

> **VORTHYX is a disruption-tolerant routing and priority engine that keeps critical information moving through unreliable networks. It combines adaptive routing, priority-aware store-and-forward, custody transfer, integrity verification and duplicate protection in a deterministic simulator, and validates the same concepts using a real ESP32 hardware-in-the-loop mesh.**

The live demonstration shows:

```text
Laptop
   ↓
Real ESP32 Mesh
   ↓
Phone

        ↓

Node Failure

        ↓

Route Adaptation / Buffering

        ↓

Network Recovery

        ↓

Verified Delivery
```

# VORTHYX

## When the network breaks, the mission doesn't have to.
