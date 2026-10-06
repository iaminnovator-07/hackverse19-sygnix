"""Serial-port discovery and ESP32 node identification for VORTHYX.

The project can discover hardware serial ports and handshake with ESP32 boards to
learn their assigned node IDs instead of guessing based on COM numbers.
"""
from __future__ import annotations

import json
import re
import time
from typing import Any, Iterable

try:  # pragma: no cover - optional dependency
    import serial  # type: ignore
except ImportError:  # pragma: no cover
    serial = None

try:  # pragma: no cover - optional dependency
    from serial.tools import list_ports as serial_ports_module  # type: ignore
except ImportError:  # pragma: no cover
    serial_ports_module = None

VALID_NODE_IDS = {
    "SAT-A",
    "RELAY-B",
    "EARTH-C",
    "MISSION-EARTH",
    "PHONE-EARTH",
    "UNASSIGNED",
    "UNKNOWN",
}

PORT_MAPPING: dict[str, str] = {}


def _as_string(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, int):
        return str(value)
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _hex_or_string(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, int):
        return f"0x{value:04X}"
    return _as_string(value)


def discover_ports() -> list[dict[str, Any]]:
    """Return all detected serial ports with metadata, without opening them."""
    if serial_ports_module is None:
        return []

    ports: list[dict[str, Any]] = []
    for info in serial_ports_module.comports():
        ports.append(
            {
                "port": _as_string(getattr(info, "device", None) or getattr(info, "name", None)),
                "description": _as_string(getattr(info, "description", None)),
                "manufacturer": _as_string(getattr(info, "manufacturer", None)),
                "vid": _hex_or_string(getattr(info, "vid", None)),
                "pid": _hex_or_string(getattr(info, "pid", None)),
                "serial_number": _as_string(getattr(info, "serial_number", None)),
                "location": _as_string(getattr(info, "location", None)),
                "status": "unknown",
            }
        )
    return ports


def _extract_json_blob(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    stripped = text.strip()
    if not stripped:
        return None

    try:
        payload = json.loads(stripped)
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        pass

    for match in re.finditer(r"\{.*?\}", stripped, flags=re.DOTALL):
        candidate = match.group(0)
        try:
            payload = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            return payload
    return None


def _normalize_node_id(raw: Any) -> str:
    node_id = _as_string(raw).strip()
    if not node_id:
        return "UNASSIGNED"
    normalized = node_id.upper().replace("-", "-")
    if normalized in {"SAT_A", "SAT A"}:
        return "SAT-A"
    if normalized in {"RELAY_B", "RELAY B"}:
        return "RELAY-B"
    if normalized in {"EARTH_C", "EARTH C"}:
        return "EARTH-C"
    if normalized in {"MISSION_EARTH", "MISSION-EARTH"}:
        return "MISSION-EARTH"
    if normalized in {"PHONE_EARTH", "PHONE-EARTH"}:
        return "PHONE-EARTH"
    return node_id if node_id in VALID_NODE_IDS else "UNKNOWN"


def probe_port(port: str, baudrate: int = 115200, timeout: float = 1.5) -> dict[str, Any] | None:
    """Open a serial port, send HELLO, and return the JSON discovery payload."""
    if serial is None:
        raise RuntimeError("pyserial is required for serial discovery. Install with: pip install pyserial")

    try:
        port_handle = serial.Serial(port, baudrate, timeout=0.2, write_timeout=1)
    except Exception:  # pragma: no cover - hardware dependent
        return None

    try:
        port_handle.reset_input_buffer()
        port_handle.reset_output_buffer()
        try:
            port_handle.write(b"HELLO\r\n")
            port_handle.flush()
        except Exception:  # pragma: no cover - hardware dependent
            return None
        deadline = time.monotonic() + timeout
        buffer = ""

        while time.monotonic() < deadline:
            chunk = port_handle.read(256)
            if not chunk:
                time.sleep(0.05)
                continue
            buffer += chunk.decode("utf-8", errors="replace")
            payload = _extract_json_blob(buffer)
            if payload is not None:
                if isinstance(payload.get("type"), str) and payload.get("type", "").upper() == "HELLO":
                    payload.setdefault("device", "ESP32")
                    payload.setdefault("node_id", "UNASSIGNED")
                    payload["node_id"] = _normalize_node_id(payload.get("node_id", "UNASSIGNED"))
                    return payload
                if payload.get("device") or payload.get("node_id"):
                    payload.setdefault("device", "ESP32")
                    payload.setdefault("node_id", "UNASSIGNED")
                    payload["node_id"] = _normalize_node_id(payload.get("node_id", "UNASSIGNED"))
                    return payload
        payload = _extract_json_blob(buffer)
        if payload is not None:
            payload.setdefault("device", "ESP32")
            payload.setdefault("node_id", "UNASSIGNED")
            payload["node_id"] = _normalize_node_id(payload.get("node_id", "UNASSIGNED"))
            return payload
        return None
    finally:
        try:
            port_handle.close()
        except Exception:  # pragma: no cover
            pass


def scan_ports(port_names: Iterable[str] | None = None, timeout: float = 1.5) -> dict[str, Any]:
    """Open each candidate serial port, send HELLO, and report the discovered node IDs."""
    detected = discover_ports()
    selected_ports = [p["port"] for p in detected if p["port"]]
    if port_names is not None:
        selected_ports = [p for p in port_names if p]

    results: list[dict[str, Any]] = []
    mapping: dict[str, str] = {}
    seen_ports: set[str] = set()

    for port in selected_ports:
        if port in seen_ports:
            continue
        seen_ports.add(port)

        base = next((p for p in detected if p.get("port") == port), {})
        entry = {
            "port": port,
            "description": base.get("description", ""),
            "manufacturer": base.get("manufacturer", ""),
            "vid": base.get("vid", ""),
            "pid": base.get("pid", ""),
            "serial_number": base.get("serial_number", ""),
            "location": base.get("location", ""),
            "status": "unknown",
            "device": "UNKNOWN",
            "node_id": "UNKNOWN",
            "firmware": "",
            "capabilities": [],
        }

        try:
            payload = probe_port(port, timeout=timeout)
        except RuntimeError:
            payload = None

        if payload:
            entry["device"] = payload.get("device", "ESP32")
            entry["node_id"] = _normalize_node_id(payload.get("node_id", "UNASSIGNED"))
            entry["firmware"] = _as_string(payload.get("firmware"))
            entry["capabilities"] = payload.get("capabilities") or []
            entry["status"] = "online" if entry["node_id"] != "UNKNOWN" else "unknown"
            if entry["node_id"] not in {"UNKNOWN", "UNASSIGNED"}:
                mapping[port] = entry["node_id"]
                PORT_MAPPING[port] = entry["node_id"]
            else:
                PORT_MAPPING.pop(port, None)
        else:
            PORT_MAPPING.pop(port, None)

        if not entry["description"] and entry["device"] == "UNKNOWN":
            maybe_info = next((p for p in detected if p.get("port") == port), None)
            if maybe_info:
                entry["description"] = maybe_info.get("description", "")
                entry["manufacturer"] = maybe_info.get("manufacturer", "")
                entry["vid"] = maybe_info.get("vid", "")
                entry["pid"] = maybe_info.get("pid", "")
                entry["serial_number"] = maybe_info.get("serial_number", "")
                entry["location"] = maybe_info.get("location", "")

        results.append(entry)

    for info in detected:
        port = info.get("port")
        if port and port not in seen_ports:
            results.append(
                {
                    **info,
                    "device": "UNKNOWN",
                    "node_id": "UNKNOWN",
                    "firmware": "",
                    "capabilities": [],
                    "status": "unknown",
                }
            )

    return {"ports": results, "mapping": mapping}


def resolve_node_port(node_id: str, results: list[dict[str, Any]] | None = None, timeout: float = 1.5) -> str | None:
    """Look up the port that advertises the given logical node ID."""
    requested = _normalize_node_id(node_id).upper()
    if results is None:
        scan = scan_ports(timeout=timeout)
        results = scan.get("ports", [])

    for entry in results:
        current = _normalize_node_id(entry.get("node_id", "UNKNOWN")).upper()
        if current == requested:
            return entry.get("port")
    for port, mapped in list(PORT_MAPPING.items()):
        if _normalize_node_id(mapped).upper() == requested:
            return port
    return None


list_ports = discover_ports
scan_serial_ports = scan_ports
lookup_node_port = resolve_node_port


def assign_node(port: str, node_id: str, baudrate: int = 115200) -> dict[str, Any]:
    """Send SET_NODE_ID <node> to a device and persist it via the ESP32 firmware."""
    if serial is None:
        raise RuntimeError("pyserial is required for serial discovery. Install with: pip install pyserial")

    normalized = _normalize_node_id(node_id)
    if normalized == "UNKNOWN":
        raise ValueError(f"Unsupported node id: {node_id!r}")

    try:
        ser = serial.Serial(port, baudrate, timeout=0.2, write_timeout=1)
    except Exception as exc:  # pragma: no cover - hardware dependent
        raise RuntimeError(f"Cannot open serial port {port!r}: {exc}") from exc

    try:
        ser.write(f"SET_NODE_ID {normalized}\r\n".encode("utf-8"))
        ser.flush()
        time.sleep(0.15)
        response = ser.read(256)
        return {
            "port": port,
            "node_id": normalized,
            "reply": response.decode("utf-8", errors="replace").strip(),
            "ok": True,
        }
    finally:
        ser.close()
