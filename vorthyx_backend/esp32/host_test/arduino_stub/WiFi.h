#pragma once
#include "Arduino.h"
#define WIFI_STA 1
struct WiFiClass { void mode(int) {} void disconnect() {} };
static WiFiClass WiFi;
