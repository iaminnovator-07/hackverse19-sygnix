"""Core data models: Bundle, Record, Link, Node."""
from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from typing import Optional

from .config import TICK_MS


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@dataclass
class Bundle:
    """A DTN bundle (a packet that can wait). One Bundle object == one *copy* held by one node."""
    id: str
    seq: int
    source: str
    dest: str
    priority: int
    size: int
    created_tick: int
    ttl: int
    payload: bytes
    payload_hash: str
    arrived_tick: int = 0
    path: list = field(default_factory=list)       # nodes this copy has visited
    pending: dict = field(default_factory=dict)    # neighbour -> ACK deadline tick
    acked: set = field(default_factory=set)        # (epidemic) neighbours that confirmed custody
    waiting: bool = False                          # True while no route exists (stored, waiting for contact)
    last_hop: str = ""

    def copy_for_tx(self) -> "Bundle":
        return Bundle(self.id, self.seq, self.source, self.dest, self.priority, self.size,
                      self.created_tick, self.ttl, self.payload, self.payload_hash,
                      path=list(self.path))

    def intact(self) -> bool:
        return sha256_hex(self.payload) == self.payload_hash


@dataclass
class Record:
    """Ground-truth bookkeeping per bundle id (used only for metrics, never by routing)."""
    id: str
    priority: int
    size: int
    created_tick: int
    delivered_tick: Optional[int] = None
    intact: bool = True
    expired: bool = False
    dropped: bool = False
    path: list = field(default_factory=list)


@dataclass
class Link:
    a: str
    b: str
    latency_ms: int
    bandwidth: int            # units per tick (serialisation speed)
    reliability: float        # probability one transmission (and its ACK) survives
    corrupt_prob: float = 0.0
    up: bool = True
    busy_until: dict = field(default_factory=dict)
    busy_ticks: dict = field(default_factory=dict)
    util_ema: dict = field(default_factory=dict)
    up_ticks: int = 0
    up_active_ticks: int = 0     # ticks the link was up while the network had work to do
    tx_count: int = 0

    def __post_init__(self):
        for n in (self.a, self.b):
            self.busy_until[n] = 0
            self.busy_ticks[n] = 0
            self.util_ema[n] = 0.0

    @property
    def latency_ticks(self) -> int:
        return max(1, math.ceil(self.latency_ms / TICK_MS))

    @property
    def name(self) -> str:
        return f"{self.a}<->{self.b}"

    def other(self, n: str) -> str:
        return self.b if n == self.a else self.a


@dataclass
class Node:
    name: str
    kind: str                       # SAT | RELAY | GROUND
    buffer_cap: Optional[int]       # None = unlimited
    storage: dict = field(default_factory=dict)      # bundle id -> Bundle
    delivered: set = field(default_factory=set)      # ids accepted at this node as final destination

    def used(self) -> int:
        return sum(b.size for b in self.storage.values())
