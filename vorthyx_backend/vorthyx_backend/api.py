"""OPTIONAL thin HTTP layer for the future dashboard (the simulator itself needs no dependencies).

    pip install fastapi uvicorn
    uvicorn api:app --reload --port 8000

Frontend polls GET /state every ~500 ms and calls the POST endpoints for the control buttons.
"""
from __future__ import annotations

import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from vorthyx.cli import STRATS
from vorthyx.metrics import summarize
from vorthyx.scenarios import SCENARIOS, build_engine, run_scenario
from vorthyx.hardware_bridge import hardware

app = FastAPI(title="VORTHYX backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

LOCK = threading.Lock()
STATE = {"eng": None, "strategy": "vorthyx", "scenario": "demo", "seed": 42, "integrity": True,
         "running": False, "speed": 4}


def fresh():
    STATE["eng"] = build_engine(STATE["strategy"], STATE["scenario"], STATE["seed"], STATE["integrity"])
    STATE["running"] = False


fresh()


def _loop():
    import time
    while True:
        time.sleep(0.05)
        with LOCK:
            if STATE["running"]:
                STATE["eng"].run(STATE["eng"].tick + STATE["speed"])


threading.Thread(target=_loop, daemon=True).start()


@app.get("/state")
def state():
    with LOCK:
        snap = STATE["eng"].snapshot()
        snap.update(running=STATE["running"], scenario=STATE["scenario"], speed=STATE["speed"])
        return snap


@app.post("/control/{action}")          # start | pause | reset
def control(action: str, strategy: str = None, scenario: str = None, seed: int = None, speed: int = None):
    with LOCK:
        if strategy: STATE["strategy"] = strategy
        if scenario: STATE["scenario"] = scenario
        if seed is not None: STATE["seed"] = seed
        if speed: STATE["speed"] = speed
        if action == "start": STATE["running"] = True
        elif action == "pause": STATE["running"] = False
        elif action == "reset": fresh()
        else: raise HTTPException(404, "unknown action")
        return {"ok": True}


@app.post("/link/{action}")             # kill | restore   body: ?a=B&b=D
def link(action: str, a: str, b: str):
    with LOCK:
        try:
            ok = STATE["eng"].kill_link(a, b) if action == "kill" else STATE["eng"].restore_link(a, b)
        except KeyError as exc:
            raise HTTPException(400, str(exc))
        return {"changed": ok}


@app.post("/inject/{kind}")             # corrupt | dup | replay
def inject(kind: str):
    with LOCK:
        STATE["eng"].do({"corrupt": "corrupt", "dup": "dup", "replay": "replay"}[kind])
        return {"ok": True}


@app.post("/generate")
def generate(priority: str = "CRITICAL", size: int = 8, label: str = None):
    with LOCK:
        return {"id": STATE["eng"].generate(priority, size, label)}


@app.get("/trace/{bundle_id}")
def trace(bundle_id: str):
    with LOCK:
        return STATE["eng"].trace(bundle_id)


@app.get("/compare/{scenario}")
def compare(scenario: str, seed: int = 42):
    if scenario not in SCENARIOS:
        raise HTTPException(404, "unknown scenario")
    return {st: summarize(run_scenario(st, scenario, seed)) for st in STRATS}


@app.get("/scenarios")
def scenarios():
    return {k: v.desc for k, v in SCENARIOS.items()}


@app.get("/hardware/state")
def hardware_state():
    """Live USB-serial view of the four-board PlatformIO mesh demo."""
    return hardware.snapshot()


@app.post("/hardware/send")
def hardware_send(payload: str = "CRITICAL: VORTHYX mesh delivery check", priority: str = "CRITICAL"):
    if priority.upper() not in {"CRITICAL", "HIGH", "NORMAL", "LOW"}:
        raise HTTPException(400, "priority must be CRITICAL, HIGH, NORMAL or LOW")
    if not hardware.snapshot()["connected"]:
        raise HTTPException(503, "USB mesh gateway is offline; check VORTHYX_SERIAL_PORT and its COM cable")
    return {"bundle_id": hardware.send(payload, priority)}
