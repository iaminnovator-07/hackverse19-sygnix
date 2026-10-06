// Host-side simulation of the ESP32 mesh: runs the REAL vx_core.h on virtual radios.
//   g++ -std=c++11 -O1 -Wall -Wextra -o mesh_test mesh_test.cpp && ./mesh_test [transcript_out.log]
#include <algorithm>
#include <functional>
#include <map>
#include <memory>
#include <set>
#include <string>
#include <vector>
#include <cstdlib>
#include <cstdio>
#include "../vorthyx_node/vx_core.h"

using namespace vx;

struct Net;
struct SimPlat : Platform {
  Net* net; int id;
  SimPlat(Net* n, int i) : net(n), id(i) {}
  uint32_t now() override;
  void send(uint8_t to, const uint8_t* d, uint16_t n) override;
  void emit(const char* line) override;
  uint32_t rnd() override;
};

struct Frame { uint32_t at; int to; std::vector<uint8_t> data; };

struct Net {
  uint32_t t = 0;
  uint64_t rs = 88172645463325252ULL;
  double loss = 0.0;                                  // radio loss probability (applies to every frame)
  std::vector<std::unique_ptr<SimPlat>> plats;
  std::vector<std::unique_ptr<Node>> nodes;
  std::set<std::pair<int,int>> adj;
  std::vector<Frame> pending;
  std::vector<std::pair<int,std::string>> log;       // (node id, line)
  size_t log_mark = 0;

  uint32_t rnd32() { rs ^= rs << 13; rs ^= rs >> 7; rs ^= rs << 17; return (uint32_t)(rs >> 11); }
  double rndf() { return (rnd32() & 0xFFFFF) / 1048576.0; }
  void link(int a, int b) { adj.insert({a,b}); adj.insert({b,a}); }
  Node* add(int id) {
    plats.emplace_back(new SimPlat(this, id));
    nodes.emplace_back(new Node((uint8_t)id, plats.back().get()));
    return nodes.back().get();
  }
  Node* get(int id) { for (auto& n : nodes) if (n->id == id) return n.get(); return nullptr; }
  void tx(int from, uint8_t to, const uint8_t* d, uint16_t n) {
    for (auto& nd : nodes) {
      int j = nd->id;
      if (j == from || !adj.count({from, j})) continue;
      if (to != BCAST && j != to) continue;
      if (loss > 0 && rndf() < loss) continue;
      Frame f; f.at = t + 2 + (rnd32() % 3); f.to = j; f.data.assign(d, d + n);
      pending.push_back(f);
    }
  }
  void run(uint32_t ms) {
    uint32_t end = t + ms;
    while (t < end) {
      t++;
      for (size_t i = 0; i < pending.size();) {
        if (pending[i].at <= t) { Frame f = pending[i]; pending.erase(pending.begin() + i); get(f.to)->on_frame(f.data.data(), (uint16_t)f.data.size()); }
        else i++;
      }
      for (auto& n : nodes) n->loop();
    }
  }
  // ---- log helpers
  int count(int node, const std::string& needle, size_t from = 0) const {
    int c = 0;
    for (size_t i = from; i < log.size(); i++) if ((node < 0 || log[i].first == node) && log[i].second.find(needle) != std::string::npos) c++;
    return c;
  }
  std::vector<std::string> lines(int node, const std::string& needle, size_t from = 0) const {
    std::vector<std::string> v;
    for (size_t i = from; i < log.size(); i++) if ((node < 0 || log[i].first == node) && log[i].second.find(needle) != std::string::npos) v.push_back(log[i].second);
    return v;
  }
};
uint32_t SimPlat::now() { return net->t; }
void SimPlat::send(uint8_t to, const uint8_t* d, uint16_t n) { net->tx(id, to, d, n); }
void SimPlat::emit(const char* line) { net->log.push_back({id, line}); }
uint32_t SimPlat::rnd() { return net->rnd32(); }

static std::string field(const std::string& l, const std::string& key) {      // crude JSON field extractor
  size_t p = l.find("\"" + key + "\":");
  if (p == std::string::npos) return "";
  p += key.size() + 3;
  if (l[p] == '"') { size_t e = l.find('"', p + 1); return l.substr(p + 1, e - p - 1); }
  size_t e = l.find_first_of(",}", p);
  return l.substr(p, e - p);
}

// diamond:  SRC(1) - R2 - EARTH(0)
//                \  R3 /           (+ 2-3 link)
static void diamond(Net& n) {
  n.add(0); n.add(1); n.add(2); n.add(3);
  n.link(1,2); n.link(1,3); n.link(2,0); n.link(3,0); n.link(2,3);
}

static int fails = 0, total = 0;
#define CHECK(name, cond) do { total++; if (cond) printf("  PASS  %s\n", name); else { fails++; printf("  FAIL  %s   (%s:%d)\n", name, __FILE__, __LINE__); } } while (0)

static double mean_age(Net& n, const std::string& prioTag) {
  double s = 0; int c = 0;
  for (auto& l : n.lines(0, "\"k\":\"DELIVER\"")) if (field(l, "p") == prioTag) { s += atof(field(l, "age").c_str()); c++; }
  return c ? s / c : 1e9;
}

static std::vector<std::string> delivered_keys(Net& n) {
  std::vector<std::string> v;
  for (auto& l : n.lines(0, "\"k\":\"DELIVER\"")) v.push_back(field(l, "b"));
  return v;
}

static bool unique(const std::vector<std::string>& v) { std::set<std::string> s(v.begin(), v.end()); return s.size() == v.size(); }

int main(int argc, char** argv) {
  printf("VORTHYX mesh core - host simulation (real vx_core.h, virtual radios)\n\n");

  // ---- T0 primitives
  {
    uint8_t h[8]; sha256_8((const uint8_t*)"abc", 3, h);
    const uint8_t exp[8] = {0xba,0x78,0x16,0xbf,0x8f,0x01,0xcf,0xea};
    CHECK("T0a SHA-256('abc') matches the NIST vector", memcmp(h, exp, 8) == 0);
    CHECK("T0b CRC-16/CCITT('123456789') == 0x29B1 (same as python wire.py)", crc16((const uint8_t*)"123456789", 9) == 0x29B1);
  }

  // ---- T1 convergence
  {
    Net n; diamond(n); n.run(4000);
    CHECK("T1  neighbours discovered, SRC learns a 2-hop route to EARTH",
          n.get(1)->own_hops() == 2 && n.get(1)->nbr_alive(2) && n.get(1)->nbr_alive(3) && n.get(2)->own_hops() == 1);
  }

  // ---- T2 plain delivery + path/dup sanity
  {
    Net n; diamond(n); n.run(3000);
    for (int i = 0; i < 20; i++) { char b[32]; snprintf(b, 32, "telemetry %d", i); n.get(1)->gen((uint8_t)(1 + i % 4), b); n.run(60); }
    n.run(10000);
    auto k = delivered_keys(n);
    CHECK("T2  20/20 bundles delivered to EARTH, each exactly once", k.size() == 20 && unique(k));
    bool okpath = true;
    for (auto& l : n.lines(0, "\"k\":\"DELIVER\"")) { std::string p = field(l, "path"); if (p.rfind("1>", 0) != 0 || p.back() != '0') okpath = false; }
    CHECK("T2b every delivered bundle shows its hop path (1>relay>0)", okpath);
  }

  // ---- T3 relay dies mid-stream
  {
    Net n; diamond(n); n.run(3000);
    for (int i = 0; i < 30; i++) {
      char b[32]; snprintf(b, 32, "stream %d", i);
      n.get(1)->gen((uint8_t)(1 + i % 4), b);
      if (i == 10) n.get(0)->ctrl(OP_DOWN, 2, 0);          // RELAY-2 loses power while traffic flows
      n.run(150);
    }
    n.run(15000);
    auto k = delivered_keys(n);
    CHECK("T3  relay 2 powered off mid-stream: 30/30 still delivered, no duplicates", k.size() == 30 && unique(k));
    int down_evt = n.count(1, "\"k\":\"NBR_DOWN\",\"peer\":2");
    CHECK("T3b SRC detected neighbour 2 DOWN by itself (beacon timeout)", down_evt >= 1);
    size_t mark = n.log.size();
    for (int i = 0; i < 6; i++) { n.get(1)->gen(3, "post-failure"); n.run(200); }
    n.run(6000);
    bool via3 = true, no2 = true; int cnt = 0;
    for (auto& l : n.lines(0, "\"k\":\"DELIVER\"", mark)) { std::string p = field(l, "path"); cnt++; if (p != "1>3>0") via3 = false; if (p.find(">2>") != std::string::npos) no2 = false; }
    CHECK("T3c after the failure new bundles all travel 1>3>0 (6/6), none via the dead relay", cnt == 6 && via3 && no2);
    CHECK("T3d REROUTE events were generated for in-flight bundles", n.count(1, "\"k\":\"REROUTE\"") >= 1);
  }

  // ---- T4 total blackout: store, wait, resume, critical first
  {
    Net n; diamond(n); n.run(3000);
    n.get(0)->ctrl(OP_DOWN, 2, 0); n.get(0)->ctrl(OP_DOWN, 3, 0);
    n.run(3500);                                             // neighbours time out
    size_t mark = n.log.size();
    for (int i = 0; i < 6; i++) n.get(1)->gen(1, "bulk science");     // LOW
    n.get(1)->gen(4, "ALERT: engine temp");                           // CRITICAL
    n.get(1)->gen(3, "telemetry");
    n.run(4000);
    CHECK("T4a no route -> bundles are STORED (not lost), nothing delivered during blackout",
          n.count(1, "\"k\":\"STORE\"", mark) == 8 && n.count(0, "\"k\":\"DELIVER\"", mark) == 0);
    size_t mark2 = n.log.size();
    n.get(0)->ctrl(OP_UP, 3, 0);
    n.run(8000);
    CHECK("T4b contact returns -> RESUME events, all 8 stored bundles delivered", n.count(1, "\"k\":\"RESUME\"", mark2) == 8 && n.count(0, "\"k\":\"DELIVER\"", mark2) == 8);
    auto d = n.lines(0, "\"k\":\"DELIVER\"", mark2);
    CHECK("T4c CRITICAL alert is the FIRST thing delivered after the blackout", !d.empty() && field(d[0], "p") == "4");
    CHECK("T4d priority order after restore: CRITICAL, HIGH, then LOW", d.size() == 8 && field(d[1], "p") == "3" && field(d[2], "p") == "1");
  }

  // ---- T5 corruption
  {
    Net n; diamond(n); n.run(3000);
    n.get(1)->corrupt_next = true;
    n.get(1)->gen(4, "payload under attack");
    n.run(4000);
    auto d = n.lines(0, "\"k\":\"DELIVER\"");
    CHECK("T5  corrupted copy detected by SHA-256 at the next hop and rejected", n.count(-1, "\"k\":\"CORRUPT\"") >= 1);
    CHECK("T5a the detection is REPORTED THROUGH THE MESH to EARTH (laptop sees relay-side events)", n.count(0, "\"k\":\"CORRUPT\"") == 1);
    CHECK("T5b sender retransmitted; EARTH got exactly one INTACT copy", d.size() == 1 && field(d[0], "txt") == "payload under attack");
  }

  // ---- T6 duplicate
  {
    Net n; diamond(n); n.run(3000);
    n.get(1)->dup_next = true;
    n.get(1)->gen(3, "send me twice");
    n.run(4000);
    CHECK("T6  injected duplicate rejected: EARTH delivers exactly once", n.count(0, "\"k\":\"DELIVER\"") == 1);
    CHECK("T6b the duplicate was detected (DUP event) and reported to EARTH", n.count(-1, "\"k\":\"DUP\"") >= 1 && n.count(0, "\"k\":\"DUP\"") >= 1);
  }

  // ---- T7 lossy radio
  {
    Net n; diamond(n); n.loss = 0.25; n.run(6000);
    for (int i = 0; i < 30; i++) { char b[32]; snprintf(b, 32, "lossy %d", i); n.get(1)->gen((uint8_t)(1 + i % 4), b); n.run(60); }
    n.run(40000);
    auto k = delivered_keys(n);
    CHECK("T7  25% frame loss on every hop: custody/ACK/retransmit still delivers 30/30", k.size() == 30);
    CHECK("T7b ...and never delivers a duplicate", unique(k));
  }

  // ---- T8 buffer pressure
  {
    Net n; diamond(n); n.run(3000);
    n.get(0)->ctrl(OP_DOWN, 2, 0); n.get(0)->ctrl(OP_DOWN, 3, 0); n.run(3500);
    for (int i = 0; i < QCAP; i++) n.get(1)->gen(1, "fill");
    n.get(1)->gen(4, "CRITICAL while full");
    CHECK("T8  queue full of LOW: VORTHYX evicts a LOW bundle to admit the CRITICAL one", n.count(1, "\"k\":\"EVICT\"") == 1 && n.get(1)->queue_len() == QCAP);
    Net m; diamond(m); m.run(3000);
    m.get(0)->ctrl(OP_MODE, 0, 0); m.run(300);
    m.get(0)->ctrl(OP_DOWN, 2, 0); m.get(0)->ctrl(OP_DOWN, 3, 0); m.run(3500);
    for (int i = 0; i < QCAP; i++) m.get(1)->gen(1, "fill");
    m.get(1)->gen(4, "CRITICAL while full");
    CHECK("T8b DIJKSTRA baseline mode has no priority eviction: the CRITICAL bundle is dropped", m.count(1, "\"k\":\"DROP\"") == 1);
  }

  // ---- T9 live comparison on identical traffic
  {
    double crit[2] = {0, 0}; int dl[2] = {0, 0};
    for (int mode = 0; mode < 2; mode++) {
      Net n; diamond(n); n.run(3000);
      n.get(0)->ctrl(OP_MODE, (uint8_t)mode, 0); n.run(300);
      for (int i = 0; i < 28; i++) n.get(1)->gen(i % 4 == 0 ? 4 : 1, i % 4 == 0 ? "critical" : "bulk");   // burst: 7 CRIT + 21 LOW
      n.run(30000);
      crit[mode] = mean_age(n, "4");
      dl[mode] = n.count(0, "\"k\":\"DELIVER\"");
      CHECK(mode ? "T9b VORTHYX mode delivers the full burst (40/40)" : "T9a DIJKSTRA mode delivers the full burst (28/28)", dl[mode] == 28);
    }
    printf("        mean CRITICAL latency under burst: dijkstra=%.0f ms  vorthyx=%.0f ms\n", crit[0], crit[1]);
    CHECK("T9c under the same burst VORTHYX gets CRITICAL data through >=30% faster", crit[1] < crit[0] * 0.7);
  }

  // ---- T10 no routing loops anywhere
  {
    Net n; diamond(n); n.run(3000);
    for (int i = 0; i < 20; i++) { n.get(1)->gen(2, "loop?"); n.run(100); if (i == 7) n.get(0)->ctrl(OP_DOWN, 2, 0); if (i == 14) n.get(0)->ctrl(OP_UP, 2, 0); }
    n.run(20000);
    bool loopfree = true;
    for (auto& l : n.lines(0, "\"k\":\"DELIVER\"")) {
      std::string p = field(l, "path"); std::set<char> s; int cnt = 0;
      for (char c : p) if (c != '>') { s.insert(c); cnt++; }
      if ((int)s.size() != cnt) loopfree = false;
    }
    CHECK("T10 relay down then back up: every delivered path is loop-free and all 20 arrive", loopfree && n.count(0, "\"k\":\"DELIVER\"") == 20);
  }

  // ---- T11 virtual link kill via flooded CTRL frame (what the laptop does during the demo)
  {
    Net n; diamond(n); n.run(3000);
    n.get(0)->ctrl(OP_KILL, 1, 2); n.run(3500);
    CHECK("T11 'kill 1 2' floods to every node; SRC stops hearing relay 2 and re-routes via 3",
          !n.get(1)->nbr_alive(2) && n.get(1)->nbr_alive(3) && n.get(1)->own_hops() == 2);
    n.get(1)->gen(4, "after link kill");
    n.run(3000);
    auto d = n.lines(0, "\"k\":\"DELIVER\"");
    CHECK("T11b traffic still flows, via relay 3", d.size() == 1 && field(d[0], "path") == "1>3>0");
    n.get(0)->ctrl(OP_RESTORE, 1, 2); n.run(3000);
    CHECK("T11c 'restore 1 2' brings the link back", n.get(1)->nbr_alive(2));
  }

  // ---- transcript for the laptop bridge (EARTH node's serial output during a scripted demo)
  if (argc > 1) {
    Net n; diamond(n);
    n.get(1)->auto_ms = 400;
    n.run(8000);
    int used = 2;                                              // which relay is carrying the traffic right now?
    { auto d = n.lines(0, "\"k\":\"DELIVER\""); if (!d.empty()) { std::string p = field(d.back(), "path"); used = p.size() >= 3 ? p[2] - '0' : 2; } }
    int other = used == 2 ? 3 : 2;
    n.get(0)->ctrl(OP_DOWN, (uint8_t)used, 0);  n.run(8000);   // t=8s  the relay IN USE dies -> traffic moves to the other one
    n.get(0)->ctrl(OP_DOWN, (uint8_t)other, 0); n.run(7000);   // t=16s the other dies too -> total blackout, bundles are stored
    n.get(0)->ctrl(OP_UP, (uint8_t)other, 0);   n.run(6000);   // t=23s one relay back -> stored bundles flow, CRITICAL first
    n.get(1)->corrupt_next = true;       n.run(1500);
    n.get(1)->dup_next = true;           n.run(1500);
    n.get(0)->ctrl(OP_UP, (uint8_t)used, 0);    n.run(6000);
    n.get(1)->auto_ms = 0;               n.run(6000);
    FILE* f = fopen(argv[1], "w");
    for (auto& e : n.log) if (e.first == 0) fprintf(f, "%s\n", e.second.c_str());
    fclose(f);
    printf("\ntranscript of EARTH node serial output written to %s\n", argv[1]);
  }

  printf("\n%d/%d checks passed\n", total - fails, total);
  return fails ? 1 : 0;
}
