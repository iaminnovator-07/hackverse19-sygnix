// Minimal Arduino/ESP-IDF stubs: ONLY to syntax-check vorthyx_node.ino on a PC. Not a functional emulation.
#pragma once
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdarg.h>
#include <string>
inline uint32_t millis() { return 0; }
inline void delay(int) {}
inline uint32_t esp_random() { return 4; }
struct String {
  std::string s;
  String() {}
  String(const char* c) : s(c) {}
  String(const std::string& c) : s(c) {}
  unsigned length() const { return (unsigned)s.size(); }
  void trim() { while (!s.empty() && isspace((unsigned char)s.back())) s.pop_back(); size_t i = 0; while (i < s.size() && isspace((unsigned char)s[i])) i++; s = s.substr(i); }
  int indexOf(char c) const { size_t p = s.find(c); return p == std::string::npos ? -1 : (int)p; }
  String substring(int a) const { return String(s.substr(a)); }
  String substring(int a, int b) const { return String(s.substr(a, b - a)); }
  int toInt() const { return atoi(s.c_str()); }
  bool startsWith(const char* p) const { return s.rfind(p, 0) == 0; }
  const char* c_str() const { return s.c_str(); }
  bool operator==(const char* o) const { return s == o; }
  String& operator+=(char c) { s += c; return *this; }
  String& operator=(const char* c) { s = c; return *this; }
};
struct SerialClass {
  void begin(int) {}
  void println(const char* l) { puts(l); }
  void println(const String& l) { puts(l.c_str()); }
  void printf(const char* f, ...) __attribute__((format(printf, 2, 3))) { va_list a; va_start(a, f); vprintf(f, a); va_end(a); }
  int available() { return 0; }
  int read() { return -1; }
};
static SerialClass Serial;
