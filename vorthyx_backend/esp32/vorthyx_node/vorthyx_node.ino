/*
  VORTHYX mesh node  -  ESP32 (Arduino core 2.x or 3.x), ESP-NOW over the built-in WiFi radio. No router needed.

  1) Set NODE_ID below, flash the SAME sketch to every board (change only NODE_ID):
       0 = EARTH gateway  (plug THIS one into the laptop via USB, bridge/bridge.py reads its serial port)
       1 = SAT-A source   (generates telemetry; can also be fed from its own serial monitor)
       2..7 = relays      (power from a power bank / USB charger, no laptop needed)
  2) Arduino IDE: Board "ESP32 Dev Module" (any ESP32 / ESP32-S3 / C3 works), Serial 115200.
  3) All boards must be on the same WIFI_CHANNEL.

  The brain is vx_core.h (identical file runs in the host simulation). This file is only radio + serial glue.

  Serial commands (type in Serial Monitor / bridge):
    send <1-4> <text>      create a bundle (1 LOW, 2 NORMAL, 3 HIGH, 4 CRITICAL)
    burst <n> [prio]       n bundles (mixed priorities if prio omitted)
    auto <ms>|off          automatic telemetry every <ms>
    mode v|d               VORTHYX (priority-aware) or DIJKSTRA (min-hop FIFO) for the WHOLE mesh (flooded)
    kill <a> <b>           kill the virtual link a<->b for the WHOLE mesh (flooded)       restore <a> <b>
    down <id>              simulate power loss of node <id> (flooded)                    up <id>
    corrupt                corrupt the payload of the next transmitted bundle on THIS node
    dup                    send the next bundle twice from THIS node
    status                 print this node's status
    (physically unplugging a relay works too: neighbours notice within ~2 s)
*/
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include "vx_core.h"

#define NODE_ID 1          // <<<<<< CHANGE PER BOARD
#define WIFI_CHANNEL 1

static const uint8_t BCAST_MAC[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
static uint8_t macById[256][6];
static bool haveMac[256];

struct RxItem { uint8_t data[250]; uint16_t len; };
static RxItem rxq[24];
static volatile uint8_t rxHead = 0, rxTail = 0;

static void ensurePeer(const uint8_t* mac) {
  if (esp_now_is_peer_exist(mac)) return;
  esp_now_peer_info_t p = {};
  memcpy(p.peer_addr, mac, 6);
  p.channel = 0;            // 0 = current channel
  p.encrypt = false;
  esp_now_add_peer(&p);
}

struct ArduinoPlatform : vx::Platform {
  uint32_t now() override { return millis(); }
  uint32_t rnd() override { return esp_random(); }
  void emit(const char* line) override { Serial.println(line); }
  void send(uint8_t to, const uint8_t* d, uint16_t n) override {
    const uint8_t* mac = BCAST_MAC;
    if (to != vx::BCAST && haveMac[to]) { mac = macById[to]; ensurePeer(mac); }
    esp_now_send(mac, d, n);       // delivery is confirmed by OUR application-level ACK, not by this call
  }
} platform;

static vx::Node node(NODE_ID, &platform);

// ---- receive callback (runs in the WiFi task: only copy the frame into a ring buffer)
static void pushRx(const uint8_t* mac, const uint8_t* data, int len) {
  if (len < 8 || len > 250) return;
  if (data[0] == 'V' && data[1] == 'X') {          // learn id -> MAC mapping from every valid frame
    uint8_t hopSrc = data[4];
    memcpy(macById[hopSrc], mac, 6);
    haveMac[hopSrc] = true;
  }
  uint8_t next = (rxHead + 1) % 24;
  if (next == rxTail) return;                      // ring full: drop (radio is lossy anyway)
  memcpy(rxq[rxHead].data, data, len);
  rxq[rxHead].len = (uint16_t)len;
  rxHead = next;
}
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
static void onRecv(const esp_now_recv_info_t* info, const uint8_t* data, int len) { pushRx(info->src_addr, data, len); }
#else
static void onRecv(const uint8_t* mac, const uint8_t* data, int len) { pushRx(mac, data, len); }
#endif

// ---- serial console
static String line;
static const uint8_t MIX[10] = {4, 3, 3, 2, 2, 2, 2, 1, 1, 1};

static void handleLine(String s) {
  s.trim();
  if (!s.length()) return;
  int sp = s.indexOf(' ');
  String cmd = sp < 0 ? s : s.substring(0, sp);
  String rest = sp < 0 ? "" : s.substring(sp + 1);
  rest.trim();
  if (cmd == "send") {
    int p = rest.toInt();
    int sp2 = rest.indexOf(' ');
    String txt = sp2 < 0 ? String("manual") : rest.substring(sp2 + 1);
    node.gen((uint8_t)p, txt.c_str());
  } else if (cmd == "burst") {
    int n = rest.toInt(); if (n <= 0) n = 10;
    int sp2 = rest.indexOf(' ');
    int p = sp2 < 0 ? 0 : rest.substring(sp2 + 1).toInt();
    for (int i = 0; i < n; i++) {
      uint8_t pr = p ? (uint8_t)p : MIX[i % 10];
      char t[32]; snprintf(t, sizeof(t), "burst %d", i);
      node.gen(pr, t);
    }
  } else if (cmd == "auto") {
    node.auto_ms = (rest == "off") ? 0 : (uint32_t)rest.toInt();
  } else if (cmd == "mode") {
    node.ctrl(vx::OP_MODE, rest.startsWith("d") ? 0 : 1, 0);
  } else if (cmd == "kill" || cmd == "restore") {
    int a = rest.toInt(); int sp2 = rest.indexOf(' ');
    int b = sp2 < 0 ? 0 : rest.substring(sp2 + 1).toInt();
    node.ctrl(cmd == "kill" ? vx::OP_KILL : vx::OP_RESTORE, (uint8_t)a, (uint8_t)b);
  } else if (cmd == "down") {
    node.ctrl(vx::OP_DOWN, (uint8_t)rest.toInt(), 0);
  } else if (cmd == "up") {
    node.ctrl(vx::OP_UP, (uint8_t)rest.toInt(), 0);
  } else if (cmd == "corrupt") {
    node.corrupt_next = true;
  } else if (cmd == "dup") {
    node.dup_next = true;
  } else if (cmd == "status") {
    node.status_print();
  } else {
    Serial.println("commands: send burst auto mode kill restore down up corrupt dup status");
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_channel(WIFI_CHANNEL, WIFI_SECOND_CHAN_NONE);
  if (esp_now_init() != ESP_OK) {
    Serial.println("EVT {\"k\":\"FATAL\",\"why\":\"esp_now_init failed\"}");
    return;
  }
  esp_now_register_recv_cb(onRecv);
  ensurePeer(BCAST_MAC);
  Serial.printf("# VORTHYX node %d ready (ESP-NOW, channel %d). type 'status' or 'help'\n", NODE_ID, WIFI_CHANNEL);
  node.status_print();
}

void loop() {
  while (rxTail != rxHead) {                        // drain frames received by the radio
    node.on_frame(rxq[rxTail].data, rxq[rxTail].len);
    rxTail = (rxTail + 1) % 24;
  }
  node.loop();
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') { handleLine(line); line = ""; }
    else if (line.length() < 120) line += c;
  }
}
