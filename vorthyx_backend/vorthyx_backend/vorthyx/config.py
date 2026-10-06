"""Global constants. One simulation tick = TICK_MS milliseconds of *virtual* time."""

TICK_MS = 50

CRITICAL, HIGH, NORMAL, LOW = 4, 3, 2, 1
PRIO_NAME = {4: "CRITICAL", 3: "HIGH", 2: "NORMAL", 1: "LOW"}
PRIO_ID = {v: k for k, v in PRIO_NAME.items()}
PRIO_SHORT = {4: "CRIT", 3: "HIGH", 2: "NORM", 1: "LOW "}

# bundle size in "units" (think KB). Bigger = lower priority bulk data.
SIZE_RANGE = {4: (4, 8), 3: (8, 15), 2: (12, 25), 1: (25, 50)}

# default workload mix: CRITICAL, HIGH, NORMAL, LOW
DEFAULT_MIX = (10, 20, 40, 30)

DEFAULT_TTL = 900          # ticks (45 s virtual) before an undelivered bundle expires
ACK_MARGIN = 2             # extra ticks before a missing ACK is declared lost

SOURCE = "SAT-A"
DEST = "EARTH"
