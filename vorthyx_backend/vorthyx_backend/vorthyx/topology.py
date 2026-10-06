"""Network topology (simulated ESP32-class nodes)."""
from __future__ import annotations

from .models import Link, Node

ALIASES = {
    "A": "SAT-A", "SATA": "SAT-A", "SAT-A": "SAT-A", "SAT": "SAT-A",
    "B": "RELAY-B", "RELAYB": "RELAY-B", "RELAY-B": "RELAY-B",
    "C": "RELAY-C", "RELAYC": "RELAY-C", "RELAY-C": "RELAY-C",
    "D": "RELAY-D", "RELAYD": "RELAY-D", "RELAY-D": "RELAY-D",
    "E": "EARTH", "EARTH": "EARTH",
}


class Network:
    def __init__(self):
        self.nodes: dict[str, Node] = {}
        self.links: dict[tuple, Link] = {}
        self._adj: dict[str, list] = {}

    def add_node(self, name, kind, buffer_cap):
        self.nodes[name] = Node(name, kind, buffer_cap)
        self._adj[name] = []

    def add_link(self, a, b, latency_ms, bandwidth, reliability, corrupt_prob=0.0):
        link = Link(a, b, latency_ms, bandwidth, reliability, corrupt_prob)
        self.links[tuple(sorted((a, b)))] = link
        self._adj[a].append((b, link))
        self._adj[b].append((a, link))
        for n in (a, b):
            self._adj[n].sort(key=lambda x: x[0])
        return link

    def link(self, a, b):
        return self.links.get(tuple(sorted((a, b))))

    def neighbors(self, n):
        return self._adj[n]

    def resolve(self, name: str) -> str:
        key = name.strip().upper().replace("_", "-")
        if key in ALIASES:
            return ALIASES[key]
        raise KeyError(f"unknown node '{name}'. Use one of: A B C D E (or SAT-A RELAY-B RELAY-C RELAY-D EARTH)")


def default_network(buffer_scale: float = 1.0) -> Network:
    net = Network()
    cap = lambda x: max(20, int(x * buffer_scale))
    net.add_node("SAT-A", "SAT", cap(600))
    net.add_node("RELAY-B", "RELAY", cap(400))
    net.add_node("RELAY-C", "RELAY", cap(400))
    net.add_node("RELAY-D", "RELAY", cap(400))
    net.add_node("EARTH", "GROUND", None)
    #            a        b          lat_ms  bw  reliability
    net.add_link("SAT-A", "RELAY-B", 120, 40, 0.98)
    net.add_link("SAT-A", "RELAY-C", 250, 30, 0.95)
    net.add_link("RELAY-B", "RELAY-C", 80, 30, 0.96)
    net.add_link("RELAY-B", "RELAY-D", 150, 30, 0.92)
    net.add_link("RELAY-C", "RELAY-D", 100, 30, 0.97)
    net.add_link("RELAY-D", "EARTH", 100, 40, 0.98)
    net.add_link("RELAY-C", "EARTH", 400, 15, 0.90)   # slow direct backup link
    return net
