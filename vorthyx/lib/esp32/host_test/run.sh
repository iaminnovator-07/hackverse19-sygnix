#!/bin/sh
# Builds and runs the host simulation of the real firmware core (needs only g++).
# Optional: ./run.sh transcript.log   -> also writes the EARTH node's serial output for `bridge.py --replay`
set -e
cd "$(dirname "$0")"
g++ -std=c++11 -O1 -g -fsanitize=address,undefined -Wall -Wextra -o mesh_test mesh_test.cpp
./mesh_test "$@"
# syntax-check the Arduino sketch against stub headers (core 2.x and 3.x callback signatures)
g++ -std=c++11 -Wall -Wextra -fsyntax-only -x c++ -include arduino_stub/Arduino.h -Iarduino_stub -I../vorthyx_node ../vorthyx_node/vorthyx_node.ino
g++ -std=c++11 -Wall -Wextra -fsyntax-only -x c++ -include arduino_stub/Arduino.h -Iarduino_stub -I../vorthyx_node -DSTUB_V3 -DESP_ARDUINO_VERSION_MAJOR=3 ../vorthyx_node/vorthyx_node.ino
echo "sketch syntax check OK (stub headers only - NOT a hardware test)"
