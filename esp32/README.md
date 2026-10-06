# VORTHYX four-board ESP-NOW demo

This PlatformIO project builds the supplied `vx_core.h` delay-tolerant routing firmware for four ESP32 DevKit boards. The boards communicate directly over ESP-NOW on Wi-Fi channel 1; they do not need an access point or internet connection.

| PlatformIO environment | Board ID | Role |
| --- | ---: | --- |
| `earth` | 0 | USB-connected laptop gateway |
| `sat_a` | 1 | Telemetry source |
| `relay_b` | 2 | Relay path A |
| `relay_c` | 3 | Alternate relay path |

## Flash

Open this `esp32` folder in VS Code with PlatformIO. Select each environment and upload it to the corresponding board. Keep the EARTH board connected to the laptop. Power the other boards from USB chargers or power banks. All boards must use the same channel and unique IDs.

Alternatively, with PlatformIO CLI:

```powershell
pio run -e earth -t upload --upload-port COM5
pio run -e sat_a -t upload --upload-port COM6
pio run -e relay_b -t upload --upload-port COM7
pio run -e relay_c -t upload --upload-port COM8
```

Use each board's actual COM port. After uploading, only the EARTH port is required for the dashboard. Connecting SAT-A as a second serial port lets the dashboard send source commands directly to SAT-A.

## Start the live dashboard data bridge

From the project root, install the serial dependency once and start the bridge:

```powershell
python -m pip install pyserial
python .\vorthyx_backend\bridge\bridge.py --serial COM5 --http 8001
```

Optional SAT-A USB connection (EARTH must stay first):

```powershell
python .\vorthyx_backend\bridge\bridge.py --serial COM5 --serial COM6 --http 8001
```

Open `http://localhost:8001/state` to check the live hardware JSON. The dashboard polls this API separately from the simulator on port 8000.

### Show received data on a phone

The bridge also serves the mobile inbox at `/phone`. Put the phone and laptop on the same local Wi-Fi/LAN, run `ipconfig` on the laptop, and open `http://<laptop-IPv4>:8001/phone` on the phone. The page displays online ESP32s, active mesh links, and the latest verified bundles delivered to EARTH. If Windows Firewall asks, allow Python on the private network. The phone reads through the USB-connected EARTH gateway; phones cannot receive ESP-NOW directly.

## Live demo controls

The hardware panel can kill/restore the SAT-A ↔ RELAY-B virtual link and switch between VORTHYX priority routing and Dijkstra FIFO. To generate traffic, type `auto 400`, `burst 20`, or `send 4 ENGINE FIRE` in SAT-A's serial monitor. With SAT-A connected as serial port 1, the dashboard's **Send test bundle from SAT-A** button sends a critical bundle there.

Unplug the active relay or use `down 2`; the nodes detect the lost neighbor and route over RELAY-C. Restore with `up 2` or reconnect power. Use `corrupt` or `dup` on SAT-A's serial monitor to demonstrate integrity and duplicate rejection. The firmware's status, delivery, route, and fault events are rendered as hardware data, not inferred from the simulator.

Firmware source and its virtual-radio host checks are in `vorthyx_node/` and `host_test/`. Actual radio range, core-version compilation, and behavior on the physical boards still need a board-side check.

For PC-to-phone messages, keep EARTH on the first serial port and connect SAT-A as the second serial port. In the dashboard enter the payload, select its priority, then press **Send PC -> mesh -> phone**. It is sent to SAT-A over USB, routed to EARTH by ESP-NOW, then shown by the phone inbox.
