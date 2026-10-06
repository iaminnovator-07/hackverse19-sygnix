"""On-wire bundle frame (hardware-ready: fits in one ESP-NOW packet, <=250 bytes).

Layout (big-endian, packed):
  0   2  magic  'VX'
  2   1  version (1)
  3   1  priority (1..4)
  4   1  src node index
  5   1  dst node index
  6   2  bundle number
  8   2  sequence number
  10  2  ttl (ticks)
  12  8  payload SHA-256 (first 8 bytes)
  20  1  payload length (0..200)
  21  n  payload
  21+n 2 CRC-16/CCITT of everything before it

C++ equivalent (ESP32):
  struct __attribute__((packed)) VxHeader { char magic[2]; uint8_t ver, prio, src, dst;
      uint16_t bundle, seq, ttl; uint8_t hash8[8]; uint8_t plen; };
"""
from __future__ import annotations

import hashlib
import struct

MAGIC = b"VX"
VERSION = 1
HDR = struct.Struct(">2sBBBBHHH8sB")
NODE_INDEX = {"SAT-A": 0, "RELAY-B": 1, "RELAY-C": 2, "RELAY-D": 3, "EARTH": 4}
NODE_NAME = {v: k for k, v in NODE_INDEX.items()}
MAX_PAYLOAD = 200


class FrameError(Exception):
    pass


def crc16(data: bytes, poly=0x1021, init=0xFFFF) -> int:
    crc = init
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ poly) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def encode(bundle_no: int, seq: int, priority: int, src: str, dst: str, ttl: int, payload: bytes) -> bytes:
    if len(payload) > MAX_PAYLOAD:
        raise FrameError("payload too large for one ESP-NOW frame")
    h8 = hashlib.sha256(payload).digest()[:8]
    body = HDR.pack(MAGIC, VERSION, priority, NODE_INDEX[src], NODE_INDEX[dst], bundle_no, seq, ttl, h8, len(payload)) + payload
    return body + struct.pack(">H", crc16(body))


def decode(frame: bytes) -> dict:
    if len(frame) < HDR.size + 2:
        raise FrameError("frame too short")
    body, (crc,) = frame[:-2], struct.unpack(">H", frame[-2:])
    if crc16(body) != crc:
        raise FrameError("CRC mismatch (corrupted frame)")
    magic, ver, prio, src, dst, bno, seq, ttl, h8, plen = HDR.unpack(body[:HDR.size])
    payload = body[HDR.size:]
    if magic != MAGIC or ver != VERSION:
        raise FrameError("bad magic/version")
    if len(payload) != plen:
        raise FrameError("length mismatch")
    if hashlib.sha256(payload).digest()[:8] != h8:
        raise FrameError("payload hash mismatch")
    return {"bundle_no": bno, "seq": seq, "priority": prio, "src": NODE_NAME[src], "dst": NODE_NAME[dst],
            "ttl": ttl, "payload": payload}
