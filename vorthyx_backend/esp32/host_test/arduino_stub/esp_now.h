#pragma once
#include "Arduino.h"
#define ESP_OK 0
typedef int esp_err_t;
typedef struct { uint8_t peer_addr[6]; uint8_t channel; bool encrypt; } esp_now_peer_info_t;
#ifdef STUB_V3
typedef struct { const uint8_t* src_addr; } esp_now_recv_info_t;
typedef void (*esp_now_recv_cb_t)(const esp_now_recv_info_t*, const uint8_t*, int);
#else
typedef void (*esp_now_recv_cb_t)(const uint8_t*, const uint8_t*, int);
#endif
inline esp_err_t esp_now_init() { return 0; }
inline esp_err_t esp_now_register_recv_cb(esp_now_recv_cb_t) { return 0; }
inline bool esp_now_is_peer_exist(const uint8_t*) { return false; }
inline esp_err_t esp_now_add_peer(const esp_now_peer_info_t*) { return 0; }
inline esp_err_t esp_now_send(const uint8_t*, const uint8_t*, size_t) { return 0; }
