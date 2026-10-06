// VORTHYX mesh core - portable C++11, NO Arduino dependencies.
// The same file runs on the ESP32 (via vorthyx_node.ino) and in the host simulation (esp32/host_test).
//
// What it implements (mirrors the Python simulator):
//   * beacons + neighbour table -> a neighbour that stays silent for NBR_TIMEOUT_MS is declared DOWN
//   * distance-vector route to EARTH with split horizon (no count-to-infinity loops)
//   * per-bundle next-hop choice: hops + link reliability + neighbour queue, weights depend on priority (VORTHYX)
//     or plain min-hop (DIJKSTRA baseline) - switchable live
//   * priority queue / FIFO queue, store-and-forward when no route exists, TTL, eviction of lowest priority
//   * custody transfer: a bundle stays in the sender's queue until the next hop ACKs; ACK timeout -> re-route
//   * SHA-256 (first 8 bytes) per bundle verified at every hop, CRC-16 per frame, duplicate rejection
//   * flooded CTRL frames (kill/restore virtual links, power a node down/up, switch mode) for the live demo
//   * STATUS frames forwarded to EARTH so the laptop can see the whole mesh
#pragma once
#include <stdint.h>
#include <string.h>
#include <stdio.h>
#include <stdarg.h>

namespace vx {

// ------------------------------------------------------------------ constants
enum : uint8_t { K_BEACON = 1, K_DATA = 2, K_ACK = 3, K_CTRL = 4, K_STATUS = 5, K_EVENT = 6 };
enum : uint8_t { R_CORRUPT = 1, R_DUP, R_STORE, R_RESUME, R_REROUTE, R_EVICT, R_NBR_DOWN, R_NBR_UP, R_EXPIRE };
enum : uint8_t { OP_KILL = 1, OP_RESTORE = 2, OP_DOWN = 3, OP_UP = 4, OP_MODE = 5 };
enum Mode : uint8_t { MODE_DIJKSTRA = 0, MODE_VORTHYX = 1 };

static const uint8_t EARTH_ID = 0;
static const uint8_t BCAST = 0xFF;
static const int MAX_NBR = 8;
static const int QCAP = 32;                 // ~100 bytes/slot -> ~3 KB RAM
static const int MAX_PAYLOAD = 64;
static const int MAX_PATH = 6;
static const int SEEN_N = 64;
static const uint8_t MAX_HOPS = 8;
static const uint32_t BEACON_MS = 500;
static const uint32_t NBR_TIMEOUT_MS = 2000;
static const uint32_t ACK_TIMEOUT_MS = 250;
static const uint32_t SEND_GAP_MS = 40;      // emulates a finite link rate (~25 bundles/s)
static const uint32_t STATUS_MS = 1000;
static const uint16_t DEFAULT_TTL_DS = 600;  // 60 s

static const int RELW[5] = {0, 1, 2, 4, 6};     // [prio] weight on link unreliability
static const int CONW[5] = {0, 10, 6, 4, 2};    // [prio] weight on neighbour queue length

static const char* PRIO_NAME[5] = {"?", "LOW", "NORMAL", "HIGH", "CRITICAL"};

// ------------------------------------------------------------------ platform abstraction
struct Platform {
  virtual uint32_t now() = 0;                                         // milliseconds
  virtual void send(uint8_t to_id, const uint8_t* d, uint16_t n) = 0;   // to_id == BCAST for broadcast
  virtual void emit(const char* line) = 0;                            // one line of serial output
  virtual uint32_t rnd() = 0;
  virtual ~Platform() {}
};

// ------------------------------------------------------------------ CRC-16/CCITT (same as python wire.py)
inline uint16_t crc16(const uint8_t* d, uint16_t n) {
  uint16_t c = 0xFFFF;
  for (uint16_t i = 0; i < n; i++) {
    c ^= (uint16_t)d[i] << 8;
    for (int b = 0; b < 8; b++) c = (c & 0x8000) ? (uint16_t)((c << 1) ^ 0x1021) : (uint16_t)(c << 1);
  }
  return c;
}

// ------------------------------------------------------------------ SHA-256 (compact, public-domain style)
struct Sha256 {
  uint32_t h[8];
  uint8_t buf[64];
  uint64_t len;
  uint32_t bl;
  static inline uint32_t rr(uint32_t x, int n) { return (x >> n) | (x << (32 - n)); }
  void init() {
    static const uint32_t i0[8] = {0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                                   0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19};
    memcpy(h, i0, sizeof(h));
    len = 0;
    bl = 0;
  }
  void block(const uint8_t* p) {
    static const uint32_t K[64] = {
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2};
    uint32_t w[64];
    for (int i = 0; i < 16; i++)
      w[i] = ((uint32_t)p[i * 4] << 24) | ((uint32_t)p[i * 4 + 1] << 16) | ((uint32_t)p[i * 4 + 2] << 8) | p[i * 4 + 3];
    for (int i = 16; i < 64; i++) {
      uint32_t s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >> 3);
      uint32_t s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    uint32_t a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (int i = 0; i < 64; i++) {
      uint32_t S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      uint32_t ch = (e & f) ^ (~e & g);
      uint32_t t1 = hh + S1 + ch + K[i] + w[i];
      uint32_t S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      uint32_t mj = (a & b) ^ (a & c) ^ (b & c);
      uint32_t t2 = S0 + mj;
      hh = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  void update(const uint8_t* d, size_t n) {
    len += n;
    while (n--) {
      buf[bl++] = *d++;
      if (bl == 64) { block(buf); bl = 0; }
    }
  }
  void final(uint8_t out[32]) {
    uint64_t bits = len * 8;
    uint8_t one = 0x80, zero = 0;
    update(&one, 1);
    while (bl != 56) update(&zero, 1);
    for (int i = 7; i >= 0; i--) { uint8_t b = (uint8_t)(bits >> (i * 8)); update(&b, 1); }
    for (int i = 0; i < 8; i++) {
      out[i * 4] = (uint8_t)(h[i] >> 24); out[i * 4 + 1] = (uint8_t)(h[i] >> 16);
      out[i * 4 + 2] = (uint8_t)(h[i] >> 8); out[i * 4 + 3] = (uint8_t)h[i];
    }
  }
};

inline void sha256_8(const uint8_t* d, size_t n, uint8_t out8[8]) {
  Sha256 s; uint8_t full[32];
  s.init(); s.update(d, n); s.final(full);
  memcpy(out8, full, 8);
}

// ------------------------------------------------------------------ small buffer helpers
struct Buf {
  uint8_t b[250];
  uint16_t n = 0;
  void p8(uint8_t v) { if (n < sizeof(b)) b[n++] = v; }
  void p16(uint16_t v) { p8((uint8_t)(v >> 8)); p8((uint8_t)v); }
  void pn(const uint8_t* d, uint16_t k) { for (uint16_t i = 0; i < k; i++) p8(d[i]); }
};

struct Rd {
  const uint8_t* d; uint16_t n, i = 0; bool bad = false;
  Rd(const uint8_t* dd, uint16_t nn) : d(dd), n(nn) {}
  uint8_t g8() { if (i >= n) { bad = true; return 0; } return d[i++]; }
  uint16_t g16() { uint16_t h = g8(); return (uint16_t)((h << 8) | g8()); }
  void gn(uint8_t* o, uint16_t k) { for (uint16_t j = 0; j < k; j++) o[j] = g8(); }
};

// ------------------------------------------------------------------ the node
struct Nbr {
  uint8_t id = 0; bool used = false, alive = false;
  uint32_t last = 0; uint8_t hops = 255, qlen = 0, via = 0xFF, rel = 90;
};

struct Slot {
  bool used = false;
  uint8_t src = 0, dst = 0, prio = 1, plen = 0, npath = 0, state = 0;   // state 0 queued, 1 awaiting ACK
  uint16_t bno = 0, ttl_ds = 0, age_ds = 0;                            // age when it arrived here
  uint8_t payload[MAX_PAYLOAD]; uint8_t hash8[8]; uint8_t path[MAX_PATH];
  uint32_t arrived = 0, ack_deadline = 0, order = 0;
  uint8_t from_hop = 0xFF, cur_nh = 0xFF, last_nh = 0xFF;
  bool waiting = false;
};

struct Stats {
  uint32_t generated = 0, forwarded = 0, delivered = 0, dup_rejected = 0, corrupt_detected = 0, retx = 0,
           evicted = 0, refused = 0, expired = 0, stored_events = 0;
};

class Node {
 public:
  uint8_t id;
  Mode mode = MODE_VORTHYX;
  Platform* P;
  Stats st;
  bool down_ = false;
  bool corrupt_next = false, dup_next = false;
  uint32_t auto_ms = 0;

  Node(uint8_t node_id, Platform* p) : id(node_id), P(p) {
    memset(blocked_, 0, sizeof(blocked_));
    memset(seen_, 0, sizeof(seen_));
    memset(ctrl_seen_, 0, sizeof(ctrl_seen_));
  }

  // -------------------------------------------------------------- public API
  void gen(uint8_t prio, const char* text) {
    if (prio < 1 || prio > 4) prio = 2;
    Slot s;
    s.used = true; s.src = id; s.dst = EARTH_ID; s.prio = prio;
    s.bno = ++bno_;
    s.plen = (uint8_t)strnlen_(text, MAX_PAYLOAD);
    memcpy(s.payload, text, s.plen);
    sha256_8(s.payload, s.plen, s.hash8);
    s.ttl_ds = DEFAULT_TTL_DS; s.age_ds = 0;
    s.path[0] = id; s.npath = 1;
    s.arrived = P->now();
    s.from_hop = 0xFF;
    st.generated++;
    char b[16]; key_str(b, s.src, s.bno);
    evt("GEN", "\"b\":\"%s\",\"p\":%u,\"txt\":\"%s\"", b, s.prio, safe(text));
    admit(s, true);
  }

  void set_mode(Mode m) {
    mode = m;
    evt("MODE", "\"mode\":\"%s\"", m == MODE_VORTHYX ? "vorthyx" : "dijkstra");
  }

  // originate a flooded control frame (also applied locally)
  void ctrl(uint8_t op, uint8_t a, uint8_t b) {
    uint16_t cseq = (uint16_t)((id << 8) | (++ctrl_ctr_ & 0xFF));
    remember_ctrl(cseq);
    apply_ctrl(op, a, b);
    send_ctrl(op, a, b, cseq);
  }

  void block(uint8_t nid) { set_block(nid, true); }
  void unblock(uint8_t nid) { set_block(nid, false); }
  bool is_blocked(uint8_t nid) const { return (blocked_[nid >> 3] >> (nid & 7)) & 1; }

  void status_print() {
    emit_status_local();
  }

  int queue_len() const { int c = 0; for (int i = 0; i < QCAP; i++) if (q_[i].used) c++; return c; }
  uint8_t own_hops() const { return hops_; }
  bool nbr_alive(uint8_t nid) const {
    for (int i = 0; i < MAX_NBR; i++) if (nb_[i].used && nb_[i].id == nid) return nb_[i].alive;
    return false;
  }

  // -------------------------------------------------------------- main loop (call very often)
  void loop() {
    uint32_t t = P->now();
    if (down_) return;
    if (t - last_beacon_ >= BEACON_MS) { last_beacon_ = t; send_beacon(); }
    expire_neighbours(t);
    recompute_hops();
    ack_timeouts(t);
    expire_ttl(t);
    if (t - last_tx_ >= SEND_GAP_MS) try_transmit(t);
    if (t - last_status_ >= STATUS_MS) { last_status_ = t; send_status(); }
    if (auto_ms && t - last_auto_ >= auto_ms) {
      last_auto_ = t;
      static const uint8_t mix[10] = {4, 3, 3, 2, 2, 2, 2, 1, 1, 1};
      uint8_t p = mix[auto_ctr_ % 10];
      char txt[40]; snprintf(txt, sizeof(txt), "%s seq=%u", PRIO_NAME[p], (unsigned)auto_ctr_);
      auto_ctr_++;
      gen(p, txt);
    }
  }

  // -------------------------------------------------------------- radio input
  void on_frame(const uint8_t* d, uint16_t n) {
    if (n < 8 || d[0] != 'V' || d[1] != 'X' || d[2] != 2) return;
    uint16_t crc = (uint16_t)((d[n - 2] << 8) | d[n - 1]);
    if (crc16(d, (uint16_t)(n - 2)) != crc) return;
    uint8_t kind = d[3], hop_src = d[4], hop_dst = d[5];
    if (hop_src == id) return;
    Rd r(d + 6, (uint16_t)(n - 8));
    if (down_ && kind != K_CTRL) return;
    if (kind != K_CTRL && is_blocked(hop_src)) return;     // virtual link is dead
    switch (kind) {
      case K_BEACON: on_beacon(hop_src, r); break;
      case K_DATA: if (hop_dst == id) on_data(hop_src, r); break;
      case K_ACK: if (hop_dst == id) on_ack(hop_src, r); break;
      case K_STATUS: if (hop_dst == id) on_status(hop_src, r); break;
      case K_EVENT: if (hop_dst == id) on_event(hop_src, r); break;
      case K_CTRL: on_ctrl(r); break;
    }
  }

 private:
  uint8_t hops_ = 255, via_ = 0xFF;
  uint16_t bno_ = 0;
  uint8_t ctrl_ctr_ = 0;
  uint32_t last_beacon_ = 0, last_tx_ = 0, last_status_ = 0, last_auto_ = 0, order_ctr_ = 0, auto_ctr_ = 0;
  uint16_t sent_status_ = 0;
  uint8_t blocked_[32];
  Nbr nb_[MAX_NBR];
  Slot q_[QCAP];
  uint16_t seen_[SEEN_N]; uint8_t seen_src_[SEEN_N]; int seen_pos_ = 0; bool seen_init_[SEEN_N] = {false};
  uint16_t ctrl_seen_[32]; int ctrl_pos_ = 0;

  static size_t strnlen_(const char* s, size_t m) { size_t i = 0; while (i < m && s[i]) i++; return i; }
  static void key_str(char* o, uint8_t src, uint16_t bno) { snprintf(o, 16, "%u-%u", src, bno); }

  const char* safe(const char* s) {
    static char out[MAX_PAYLOAD + 1];
    size_t i = 0;
    for (; s[i] && i < MAX_PAYLOAD; i++) out[i] = (s[i] >= 32 && s[i] < 127 && s[i] != '"' && s[i] != '\\') ? s[i] : '_';
    out[i] = 0;
    return out;
  }

  void vevt(uint8_t origin, const char* kind, const char* fmt, va_list ap) {
    char body[170];
    vsnprintf(body, sizeof(body), fmt, ap);
    char line[260];
    snprintf(line, sizeof(line), "EVT {\"n\":%u,\"t\":%lu,\"k\":\"%s\",%s}", origin, (unsigned long)P->now(), kind, body);
    P->emit(line);
  }
  void evt(const char* kind, const char* fmt, ...) __attribute__((format(printf, 3, 4))) {
    va_list ap; va_start(ap, fmt); vevt(id, kind, fmt, ap); va_end(ap);
  }
  void evt_as(uint8_t origin, const char* kind, const char* fmt, ...) __attribute__((format(printf, 4, 5))) {
    va_list ap; va_start(ap, fmt); vevt(origin, kind, fmt, ap); va_end(ap);
  }

  // ---- best-effort event reporting towards EARTH (so the laptop sees what relays see)
  uint32_t rep_tokens_ = 10, rep_last_ = 0;
  void report(uint8_t code, uint8_t x, uint16_t bno, uint8_t prio, uint8_t extra) {
    if (id == EARTH_ID) return;
    uint32_t t = P->now();
    uint32_t add = (t - rep_last_) / 100;                       // refill 10 tokens / second, burst 10
    if (add) { rep_tokens_ = rep_tokens_ + add > 10 ? 10 : rep_tokens_ + add; rep_last_ = t; }
    if (!rep_tokens_) return;
    int nh = pick_nh(4, 0xFF, true);
    if (nh < 0) return;
    rep_tokens_--;
    Buf b; header(b, K_EVENT, nb_[nh].id);
    b.p8(id); b.p8(8); b.p8(code); b.p8(x); b.p16(bno); b.p8(prio); b.p8(extra);
    finish_send(b, nb_[nh].id);
  }

  void on_event(uint8_t from, Rd& r) {
    uint8_t origin = r.g8(), ttl = r.g8(), code = r.g8(), x = r.g8();
    uint16_t bno = r.g16(); uint8_t prio = r.g8(), extra = r.g8();
    if (r.bad) return;
    if (id == EARTH_ID) {
      switch (code) {
        case R_CORRUPT: evt_as(origin, "CORRUPT", "\"b\":\"%u-%u\",\"from\":%u,\"via\":\"report\"", x, bno, extra); break;
        case R_DUP: evt_as(origin, "DUP", "\"b\":\"%u-%u\",\"from\":%u,\"where\":\"relay\"", x, bno, extra); break;
        case R_STORE: evt_as(origin, "STORE", "\"b\":\"%u-%u\",\"p\":%u", x, bno, prio); break;
        case R_RESUME: evt_as(origin, "RESUME", "\"b\":\"%u-%u\",\"p\":%u,\"nh\":%u", x, bno, prio, extra); break;
        case R_REROUTE: evt_as(origin, "REROUTE", "\"b\":\"%u-%u\",\"p\":%u,\"nh\":%u", x, bno, prio, extra); break;
        case R_EVICT: evt_as(origin, "EVICT", "\"b\":\"%u-%u\",\"p\":%u", x, bno, prio); break;
        case R_EXPIRE: evt_as(origin, "EXPIRE", "\"b\":\"%u-%u\",\"p\":%u", x, bno, prio); break;
        case R_NBR_DOWN: evt_as(origin, "NBR_DOWN", "\"peer\":%u", x); break;
        case R_NBR_UP: evt_as(origin, "NBR_UP", "\"peer\":%u", x); break;
      }
      return;
    }
    if (ttl == 0) return;
    int nh = pick_nh(4, from, true);
    if (nh < 0) return;
    Buf b; header(b, K_EVENT, nb_[nh].id);
    b.p8(origin); b.p8((uint8_t)(ttl - 1)); b.p8(code); b.p8(x); b.p16(bno); b.p8(prio); b.p8(extra);
    finish_send(b, nb_[nh].id);
  }

  void set_block(uint8_t nid, bool on) {
    if (on) blocked_[nid >> 3] |= (uint8_t)(1 << (nid & 7)); else blocked_[nid >> 3] &= (uint8_t)~(1 << (nid & 7));
    evt(on ? "BLOCK" : "UNBLOCK", "\"peer\":%u", nid);
  }

  // ---------------------------------------------------------- frame building
  void header(Buf& b, uint8_t kind, uint8_t hop_dst) {
    b.p8('V'); b.p8('X'); b.p8(2); b.p8(kind); b.p8(id); b.p8(hop_dst);
  }
  void finish_send(Buf& b, uint8_t to) {
    b.p16(crc16(b.b, b.n));
    P->send(to, b.b, b.n);
  }

  void send_beacon() {
    Buf b; header(b, K_BEACON, BCAST);
    b.p8(hops_); b.p8((uint8_t)queue_len()); b.p8(via_); b.p8(mode == MODE_VORTHYX ? 1 : 0);
    finish_send(b, BCAST);
  }

  void send_ctrl(uint8_t op, uint8_t a, uint8_t bb, uint16_t cseq) {
    Buf b; header(b, K_CTRL, BCAST);
    b.p8(op); b.p8(a); b.p8(bb); b.p16(cseq);
    finish_send(b, BCAST);
  }

  void send_ack(uint8_t to, uint8_t src, uint16_t bno) {
    Buf b; header(b, K_ACK, to);
    b.p8(src); b.p16(bno);
    finish_send(b, to);
  }

  void send_status() {
    sent_status_++;
    if (id == EARTH_ID) { emit_status_local(); return; }
    int nh = pick_nh(4, 0xFF, true);
    if (nh < 0) return;
    Buf b; header(b, K_STATUS, nb_[nh].id);
    pack_status(b, id, 8);
    finish_send(b, nb_[nh].id);
  }

  uint16_t nbmask() const {
    uint16_t m = 0;
    for (int i = 0; i < MAX_NBR; i++) if (nb_[i].used && nb_[i].alive && nb_[i].id < 16) m |= (uint16_t)(1 << nb_[i].id);
    return m;
  }

  void pack_status(Buf& b, uint8_t origin, uint8_t ttl) {
    b.p8(origin); b.p8(ttl); b.p8(hops_); b.p8((uint8_t)queue_len());
    b.p8(mode == MODE_VORTHYX ? 1 : 0); b.p16(nbmask()); b.p16((uint16_t)st.generated);
    b.p16((uint16_t)st.forwarded); b.p16((uint16_t)(st.stored_events));
  }

  void emit_status_json(uint8_t origin, uint8_t hops, uint8_t q, uint8_t md, uint16_t mask, uint16_t gen, uint16_t fwd,
                        uint16_t stored) {
    evt("STATUS", "\"o\":%u,\"hops\":%u,\"q\":%u,\"mode\":\"%s\",\"nb\":%u,\"gen\":%u,\"fwd\":%u,\"stored\":%u", origin,
        hops, q, md ? "vorthyx" : "dijkstra", mask, gen, fwd, stored);
  }
  void emit_status_local() {
    emit_status_json(id, hops_, (uint8_t)queue_len(), mode == MODE_VORTHYX, nbmask(), (uint16_t)st.generated,
                     (uint16_t)st.forwarded, (uint16_t)st.stored_events);
  }

  // ---------------------------------------------------------- neighbours & routing
  Nbr* nbr(uint8_t nid, bool create) {
    for (int i = 0; i < MAX_NBR; i++) if (nb_[i].used && nb_[i].id == nid) return &nb_[i];
    if (!create) return nullptr;
    for (int i = 0; i < MAX_NBR; i++) if (!nb_[i].used) { nb_[i] = Nbr(); nb_[i].used = true; nb_[i].id = nid; return &nb_[i]; }
    return nullptr;
  }

  void on_beacon(uint8_t from, Rd& r) {
    uint8_t h = r.g8(), q = r.g8(), via = r.g8(), flags = r.g8();
    if (r.bad) return;
    (void)flags;
    Nbr* n = nbr(from, true);
    if (!n) return;
    bool was = n->alive;
    n->alive = true; n->last = P->now(); n->hops = h; n->qlen = q; n->via = via;
    if (!was) { evt("NBR_UP", "\"peer\":%u,\"hops\":%u", from, h); report(R_NBR_UP, from, 0, 0, 0); }
  }

  void expire_neighbours(uint32_t t) {
    for (int i = 0; i < MAX_NBR; i++) {
      Nbr& n = nb_[i];
      if (n.used && n.alive && t - n.last > NBR_TIMEOUT_MS) {
        n.alive = false;
        n.rel = 90;
        evt("NBR_DOWN", "\"peer\":%u", n.id);
        report(R_NBR_DOWN, n.id, 0, 0, 0);
        // bundles waiting for this neighbour's ACK are released for immediate re-routing
        for (int k = 0; k < QCAP; k++)
          if (q_[k].used && q_[k].state == 1 && q_[k].cur_nh == n.id) q_[k].state = 0;
      }
    }
  }

  void recompute_hops() {
    uint8_t old = hops_;
    if (id == EARTH_ID) { hops_ = 0; via_ = 0xFF; return; }
    uint8_t best = 255, bvia = 0xFF;
    for (int i = 0; i < MAX_NBR; i++) {
      const Nbr& n = nb_[i];
      if (!n.used || !n.alive || n.hops >= MAX_HOPS || n.via == id) continue;
      if ((uint8_t)(n.hops + 1) < best || ((uint8_t)(n.hops + 1) == best && n.id < bvia)) { best = (uint8_t)(n.hops + 1); bvia = n.id; }
    }
    hops_ = best; via_ = bvia;
    if (old != hops_) evt("HOPS", "\"hops\":%u,\"via\":%u", hops_, via_ == 0xFF ? 255 : via_);
  }

  // returns index into nb_ of the best next hop for priority `prio`, or -1
  int pick_nh(uint8_t prio, uint8_t exclude, bool minhop_only = false) {
    int best = -1; long bc = 0;
    for (int i = 0; i < MAX_NBR; i++) {
      const Nbr& n = nb_[i];
      if (!n.used || !n.alive || n.hops >= MAX_HOPS || n.via == id) continue;
      long cost = (long)(n.hops + 1) * 100;
      if (mode == MODE_VORTHYX && !minhop_only) cost += (long)(100 - n.rel) * RELW[prio] + (long)n.qlen * CONW[prio];
      if (n.id == exclude) cost += 1000;
      if (best < 0 || cost < bc || (cost == bc && n.id < nb_[best].id)) { best = i; bc = cost; }
    }
    return best;
  }

  // ---------------------------------------------------------- queue
  bool in_queue(uint8_t src, uint16_t bno) const {
    for (int i = 0; i < QCAP; i++) if (q_[i].used && q_[i].src == src && q_[i].bno == bno) return true;
    return false;
  }

  // returns true if stored
  bool admit(Slot& s, bool local) {
    s.order = ++order_ctr_;
    s.state = 0; s.waiting = false; s.last_nh = 0xFF; s.cur_nh = 0xFF;
    for (int i = 0; i < QCAP; i++) if (!q_[i].used) { q_[i] = s; return true; }
    char b[16]; key_str(b, s.src, s.bno);
    if (mode == MODE_VORTHYX) {
      int v = -1;
      for (int i = 0; i < QCAP; i++) {
        if (q_[i].state != 0 || q_[i].prio >= s.prio) continue;
        if (v < 0 || q_[i].prio < q_[v].prio || (q_[i].prio == q_[v].prio && q_[i].order > q_[v].order)) v = i;
      }
      if (v >= 0) {
        char vb[16]; key_str(vb, q_[v].src, q_[v].bno);
        evt("EVICT", "\"b\":\"%s\",\"p\":%u,\"for\":\"%s\"", vb, q_[v].prio, b);
        report(R_EVICT, q_[v].src, q_[v].bno, q_[v].prio, 0);
        st.evicted++;
        q_[v] = s;
        return true;
      }
    }
    st.refused++;
    evt(local ? "DROP" : "REFUSE", "\"b\":\"%s\",\"p\":%u,\"why\":\"queue full\"", b, s.prio);
    return false;
  }

  void ack_timeouts(uint32_t t) {
    for (int i = 0; i < QCAP; i++) {
      Slot& s = q_[i];
      if (!s.used || s.state != 1 || t < s.ack_deadline) continue;
      s.state = 0;
      st.retx++;
      Nbr* n = nbr(s.cur_nh, false);
      if (n) n->rel = (uint8_t)((n->rel * 8) / 10);          // EWMA towards 0 on a missed ACK
      char b[16]; key_str(b, s.src, s.bno);
      evt("RETX", "\"b\":\"%s\",\"nh\":%u", b, s.cur_nh);
    }
  }

  void expire_ttl(uint32_t t) {
    for (int i = 0; i < QCAP; i++) {
      Slot& s = q_[i];
      if (!s.used) continue;
      uint32_t age = s.age_ds + (t - s.arrived) / 100;
      if (age > s.ttl_ds) {
        char b[16]; key_str(b, s.src, s.bno);
        evt("EXPIRE", "\"b\":\"%s\",\"p\":%u", b, s.prio);
        report(R_EXPIRE, s.src, s.bno, s.prio, 0);
        st.expired++;
        s.used = false;
      }
    }
  }

  bool better(const Slot& a, const Slot& b) const {          // should a be tried before b ?
    if (mode == MODE_VORTHYX && a.prio != b.prio) return a.prio > b.prio;
    return a.order < b.order;                                // FIFO / oldest first
  }

  void try_transmit(uint32_t t) {
    int idx[QCAP]; int n = 0;
    for (int i = 0; i < QCAP; i++) if (q_[i].used && q_[i].state == 0) idx[n++] = i;
    for (int i = 1; i < n; i++) {                            // insertion sort
      int k = idx[i], j = i - 1;
      while (j >= 0 && better(q_[k], q_[idx[j]])) { idx[j + 1] = idx[j]; j--; }
      idx[j + 1] = k;
    }
    for (int a = 0; a < n; a++) {
      Slot& s = q_[idx[a]];
      int nh = pick_nh(s.prio, s.from_hop);
      char b[16]; key_str(b, s.src, s.bno);
      if (nh < 0) {
        if (!s.waiting) {
          s.waiting = true; st.stored_events++;
          evt("STORE", "\"b\":\"%s\",\"p\":%u,\"q\":%d", b, s.prio, queue_len());
          report(R_STORE, s.src, s.bno, s.prio, 0);
        }
        continue;
      }
      if (s.waiting) {
        s.waiting = false;
        evt("RESUME", "\"b\":\"%s\",\"p\":%u,\"nh\":%u", b, s.prio, nb_[nh].id);
        report(R_RESUME, s.src, s.bno, s.prio, nb_[nh].id);
      }
      transmit(s, nh, t);
      return;                                                // one bundle per SEND_GAP
    }
  }

  void transmit(Slot& s, int nh, uint32_t t) {
    uint8_t to = nb_[nh].id;
    uint32_t age = s.age_ds + (t - s.arrived) / 100;
    Buf b; header(b, K_DATA, to);
    b.p8(s.src); b.p8(s.dst); b.p8(s.prio); b.p16(s.bno); b.p16(s.ttl_ds); b.p16((uint16_t)age);
    b.p8(s.npath);
    for (int i = 0; i < MAX_PATH; i++) b.p8(i < s.npath ? s.path[i] : 0);
    b.pn(s.hash8, 8);
    b.p8(s.plen);
    uint8_t pay[MAX_PAYLOAD]; memcpy(pay, s.payload, s.plen);
    if (corrupt_next) { corrupt_next = false; if (s.plen) pay[0] ^= 0xFF; evt("INJECT", "\"what\":\"corrupt\""); }
    b.pn(pay, s.plen);
    b.p16(crc16(b.b, b.n));
    P->send(to, b.b, b.n);
    if (dup_next) { dup_next = false; P->send(to, b.b, b.n); evt("INJECT", "\"what\":\"duplicate\""); }
    char key[16]; key_str(key, s.src, s.bno);
    if (to != s.last_nh) {
      evt(s.last_nh == 0xFF ? "ROUTE" : "REROUTE", "\"b\":\"%s\",\"p\":%u,\"nh\":%u,\"hops\":%u", key, s.prio, to, nb_[nh].hops + 1);
      if (s.last_nh != 0xFF) report(R_REROUTE, s.src, s.bno, s.prio, to);
      s.last_nh = to;
    }
    s.cur_nh = to; s.state = 1; s.ack_deadline = t + ACK_TIMEOUT_MS;
    st.forwarded++;
    last_tx_ = t;
  }

  // ---------------------------------------------------------- received frames
  bool seen_has(uint8_t src, uint16_t bno) const {
    for (int i = 0; i < SEEN_N; i++) if (seen_init_[i] && seen_src_[i] == src && seen_[i] == bno) return true;
    return false;
  }
  void seen_add(uint8_t src, uint16_t bno) {
    seen_src_[seen_pos_] = src; seen_[seen_pos_] = bno; seen_init_[seen_pos_] = true;
    seen_pos_ = (seen_pos_ + 1) % SEEN_N;
  }

  void on_data(uint8_t from, Rd& r) {
    Slot s;
    s.used = true;
    s.src = r.g8(); s.dst = r.g8(); s.prio = r.g8(); s.bno = r.g16(); s.ttl_ds = r.g16(); s.age_ds = r.g16();
    s.npath = r.g8();
    uint8_t path[MAX_PATH]; r.gn(path, MAX_PATH);
    r.gn(s.hash8, 8);
    s.plen = r.g8();
    if (r.bad || s.plen > MAX_PAYLOAD || s.npath > MAX_PATH || s.prio < 1 || s.prio > 4) return;
    r.gn(s.payload, s.plen);
    if (r.bad) return;
    memcpy(s.path, path, MAX_PATH);
    char key[16]; key_str(key, s.src, s.bno);

    uint8_t h[8]; sha256_8(s.payload, s.plen, h);
    if (memcmp(h, s.hash8, 8) != 0) {                        // integrity failure: reject, NO ACK -> sender retransmits
      st.corrupt_detected++;
      evt("CORRUPT", "\"b\":\"%s\",\"from\":%u", key, from);
      report(R_CORRUPT, s.src, s.bno, s.prio, from);
      return;
    }
    s.arrived = P->now();
    s.from_hop = from;
    if (s.dst == id) {                                       // final destination (EARTH)
      if (seen_has(s.src, s.bno)) {
        st.dup_rejected++;
        evt("DUP", "\"b\":\"%s\",\"from\":%u", key, from);
        send_ack(from, s.src, s.bno);
        return;
      }
      seen_add(s.src, s.bno);
      st.delivered++;
      char pp[64]; int pl = 0;
      for (int i = 0; i < s.npath && pl < 50; i++) pl += snprintf(pp + pl, sizeof(pp) - pl, "%u>", s.path[i]);
      snprintf(pp + pl, sizeof(pp) - pl, "%u", id);
      char txt[MAX_PAYLOAD + 1]; memcpy(txt, s.payload, s.plen); txt[s.plen] = 0;
      evt("DELIVER", "\"b\":\"%s\",\"p\":%u,\"age\":%lu,\"path\":\"%s\",\"txt\":\"%s\",\"ok\":1", key, s.prio,
          (unsigned long)s.age_ds * 100UL, pp, safe(txt));
      send_ack(from, s.src, s.bno);
      return;
    }
    if (in_queue(s.src, s.bno)) {                            // already holding it: suppress, but ACK so the sender stops
      st.dup_rejected++;
      evt("DUP", "\"b\":\"%s\",\"from\":%u,\"where\":\"relay\"", key, from);
      report(R_DUP, s.src, s.bno, s.prio, from);
      send_ack(from, s.src, s.bno);
      return;
    }
    if (s.npath < MAX_PATH) s.path[s.npath++] = id;
    if (admit(s, false)) send_ack(from, s.src, s.bno);       // refused => no ACK => sender keeps custody
  }

  void on_ack(uint8_t from, Rd& r) {
    uint8_t src = r.g8(); uint16_t bno = r.g16();
    if (r.bad) return;
    for (int i = 0; i < QCAP; i++) {
      Slot& s = q_[i];
      if (s.used && s.src == src && s.bno == bno && s.state == 1 && s.cur_nh == from) {
        s.used = false;                                      // custody transferred
        Nbr* n = nbr(from, false);
        if (n) n->rel = (uint8_t)((n->rel * 8 + 100 * 2) / 10);
        return;
      }
    }
  }

  void on_status(uint8_t from, Rd& r) {
    uint8_t origin = r.g8(), ttl = r.g8(), hops = r.g8(), q = r.g8(), md = r.g8();
    uint16_t mask = r.g16(), gen = r.g16(), fwd = r.g16(), stored = r.g16();
    if (r.bad) return;
    if (id == EARTH_ID) { emit_status_json(origin, hops, q, md, mask, gen, fwd, stored); return; }
    if (ttl == 0) return;
    int nh = pick_nh(4, from, true);
    if (nh < 0) return;
    Buf b; header(b, K_STATUS, nb_[nh].id);
    b.p8(origin); b.p8((uint8_t)(ttl - 1)); b.p8(hops); b.p8(q); b.p8(md);
    b.p16(mask); b.p16(gen); b.p16(fwd); b.p16(stored);
    finish_send(b, nb_[nh].id);
  }

  void remember_ctrl(uint16_t c) { ctrl_seen_[ctrl_pos_] = c; ctrl_pos_ = (ctrl_pos_ + 1) % 32; }
  bool ctrl_known(uint16_t c) const { for (int i = 0; i < 32; i++) if (ctrl_seen_[i] == c && c != 0) return true; return false; }

  void on_ctrl(Rd& r) {
    uint8_t op = r.g8(), a = r.g8(), b = r.g8(); uint16_t cseq = r.g16();
    if (r.bad || ctrl_known(cseq)) return;
    remember_ctrl(cseq);
    apply_ctrl(op, a, b);
    send_ctrl(op, a, b, cseq);                               // flood once
  }

  void apply_ctrl(uint8_t op, uint8_t a, uint8_t b) {
    switch (op) {
      case OP_KILL: if (id == a) set_block(b, true); if (id == b) set_block(a, true); break;
      case OP_RESTORE: if (id == a) set_block(b, false); if (id == b) set_block(a, false); break;
      case OP_DOWN: if (id == a) { down_ = true; evt("DOWN", "\"why\":\"simulated power loss\""); } break;
      case OP_UP:
        if (id == a && down_) {
          down_ = false; last_beacon_ = 0; hops_ = 255; via_ = 0xFF;
          for (int i = 0; i < MAX_NBR; i++) nb_[i] = Nbr();      // cold boot: forget neighbours
          evt("UP", "\"why\":\"power restored\"");
        }
        break;
      case OP_MODE: set_mode(a ? MODE_VORTHYX : MODE_DIJKSTRA); break;
    }
  }
};

}  // namespace vx
