# 🚒 Smart Fire Detection & Dynamic Emergency Evacuation Simulation
### Intelligent IoT Safety System with ESP8266 Wi-Fi Hardware Integration, Safety-Weighted A* Pathfinding & SafeRoute Mobile Companion App

[![Platform: ESP8266](https://img.shields.io/badge/Hardware-ESP8266%20NodeMCU-orange.svg?style=flat-square&logo=espressif)](https://www.espressif.com/)
[![Pathfinding: Safety-Weighted A*](https://img.shields.io/badge/Algorithm-Safety--Weighted%20A*-blue.svg?style=flat-square)](https://en.wikipedia.org/wiki/A*_search_algorithm)
[![Frontend: Vanilla ES6+](https://img.shields.io/badge/Frontend-Vanilla%20HTML5%20%2F%20CSS3%20%2F%20ES6+-yellow.svg?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Mobile: PWA Ready](https://img.shields.io/badge/Mobile-PWA%20Ready-emerald.svg?style=flat-square&logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Communication: HTTP / CORS](https://img.shields.io/badge/Protocol-HTTP%20REST%20%2B%20CORS-blueviolet.svg?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

---

## 📌 Executive Summary & Project Motivation

Traditional emergency evacuation systems in modern commercial buildings, university campuses, and industrial facilities rely on **static illuminated exit signs** and **fixed fire evacuation diagrams**. In a real emergency, these static signs point occupants toward predetermined geometric exits regardless of where the fire ignited. 

When a fire spreads, the shortest geometric route often leads occupants directly through toxic carbon monoxide plumes, superheated air, or fully engulfed corridors.

**Smart Fire Detection & Dynamic Evacuation Simulation** solves this critical safety failure by integrating **physical IoT sensing nodes (ESP8266)** with a **dynamic safety-weighted pathfinding engine**. 

### Core System Capabilities:
1. **Physical Microcontroller Sensing**: An **ESP8266 NodeMCU** equipped with an optical infrared flame sensor (Pin `D1`) and active piezo buzzer (Pin `D2`) acts as an active building node (**Sensor 6 — Central Hallway**), streaming live telemetry over local Wi-Fi.
2. **Distributed Sensor Mesh**: An 8-node environmental telemetry grid continuously monitors ambient temperature (°C), smoke density (ppm), and optical flame presence across key facilities (Computer Lab, Electronics Lab, Server Room, Classrooms, Corridors).
3. **Dynamic Hazard Surface Modeling**: Rather than treating hazards as binary blockers, thermal radiation and toxic smoke plumes project non-linear risk penalty fields onto surrounding navigable corridors.
4. **Safety-Weighted A\* Algorithm**: Minimizes a customized multi-variable cost function ($f(n) = g(n) + h(n)$) where step costs incorporate localized hazard weights, proving mathematically and visually that **"Shortest Path ≠ Safest Path"**.
5. **Multi-Exit Real-Time Evaluation**: Dynamically compares all available building exits (Exit A, Exit B, Exit C) and steers occupants toward the exit with the lowest aggregate risk profile.
6. **📱 SafeRoute Mobile Companion App**: A zero-install, mobile-first responsive web application for occupants inside the building. It provides instant emergency banners, identifies the burning room/sensor, lets occupants tap their current location, and gives turn-by-turn evacuation directions to safety.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Physical Hardware Layer [Physical Hardware Layer]
        IR[IR Optical Flame Sensor<br/>Pin D1 / GPIO 5] -->|Active LOW| ESP[ESP8266 NodeMCU 1.0<br/>Wi-Fi Microcontroller]
        ESP -->|Digital Out / 2500Hz PWM| BUZZ[Active Piezo Buzzer<br/>Pin D2 / GPIO 4]
        ESP -->|HTTP GET /status<br/>JSON + CORS Headers| WIFINET[Local Wi-Fi Network / Hotspot<br/>Subnet: 192.168.137.x]
    end

    subgraph Central Control Station [Central Command Center - Desktop Dashboard]
        WIFINET -->|500ms HTTP Polling| POL[Telemetry Ingestion Bridge<br/>script.js]
        SIM[Virtual Sensor Array S1-S8<br/>telemetry.js] --> POL
        POL --> HAZ[Radial Hazard Diffusion Model<br/>danger.js]
        HAZ --> ASTAR[Safety-Weighted A* Engine<br/>astar.js]
        MAP[Architectural 42x26 Grid<br/>mapData.js] --> ASTAR
        ASTAR --> EVAL[Exit Candidate Evaluator<br/>Exit A vs Exit B vs Exit C]
        EVAL --> RENDER[High-DPI Canvas Renderer<br/>Ant Trails & Glows | renderer.js]
        EVAL --> AUDIO[Web Audio API Siren Engine<br/>audio.js]
    end

    subgraph Occupant Mobile Layer [SafeRoute Mobile App - Smartphone PWA]
        WIFINET -->|HTTP Auto-Polling| MOBCTL[Mobile Controller<br/>mobile.js]
        MOBCTL --> MOBLOC[Occupant Locator<br/>Room Pills / Canvas Tap]
        MOBLOC --> MOBASTAR[Local A* Path Planner<br/>Safe Corridor Navigation]
        MOBASTAR --> MOBUX[Turn-by-Turn Guidance<br/>Distance & Escape Time]
        MOBCTL --> MOBSOS[SOS Tools<br/>Vibration, Strobe, 112 Call]
    end
```

---

## 🛠️ Hardware Engineering & Circuit Specifications

### 1. Component Bill of Materials (BOM)
| Component | Specification | Operating Voltage | Interface |
|---|---|---|---|
| **ESP8266 Microcontroller** | NodeMCU v1.0 (ESP-12E Module), 80/160 MHz Tensilica L106 | 3.3V Logic (5V Micro-USB) | 802.11 b/g/n 2.4 GHz Wi-Fi |
| **Infrared Flame Sensor** | YG1006 phototransistor, LM393 voltage comparator | 3.3V – 5.0V DC | Digital DO pin (Active LOW) |
| **Active Piezo Buzzer** | 5V Active Sound Generator Module | 3.3V – 5.0V DC | Digital / PWM pin (High = Sound) |
| **Power Supply** | USB-A to Micro-USB Cable or 5V Power Bank | 5V DC, 1A minimum | USB Bus |

### 2. Complete Wiring Diagram
| Component Pin | ESP8266 NodeMCU Pin | GPIO Equivalent | Pin Functionality |
|---|---|---|---|
| **Flame Sensor DO** | `D1` | `GPIO 5` | Digital Input with internal pull-up |
| **Flame Sensor VCC** | `3V3` or `Vin` | — | DC Power Rail |
| **Flame Sensor GND** | `GND` | — | Common Ground Rail |
| **Buzzer (+) Anode** | `D2` | `GPIO 4` | Digital Output (Oscillating Siren Alert) |
| **Buzzer (-) Cathode**| `GND` | — | Common Ground Rail |

```
    +-------------------------------------------------------+
    |                    ESP8266 NodeMCU                    |
    |                                                       |
    |   [D1] (GPIO 5) <--- Digital DO <--- [ Flame Sensor ] |
    |   [D2] (GPIO 4) ---> Anode (+)  ---> [ Piezo Buzzer ] |
    |   [3V3]         ---> VCC (+)    ---> [ Flame Sensor ] |
    |   [GND]         ---> GND (-)    ---> [ Sensors Common]|
    +-------------------------------------------------------+
```

### 3. Firmware Architecture (`firmware/esp8266_sensor6.ino`)
The firmware configures the ESP8266 in Station Mode (`WIFI_STA`), connects to a local 2.4 GHz network or Windows Mobile Hotspot, and spins up a lightweight HTTP server on port 80.

#### Key Firmware Highlights:
- **Continuous Pin Sampling**: Digital pin `D1` is continuously polled in `loop()`. When fire is detected (pin goes `LOW`), `flameDetected` switches to `true`.
- **Audible Siren Pattern**: An acoustic alarm pattern toggles pin `D2` between 2500 Hz tone and silence every 100–150ms.
- **RESTful `/status` Endpoint**: Responds with JSON payload:
  ```json
  {
    "fire": true,
    "room": "Room_1"
  }
  ```
- **Cross-Origin Resource Sharing (CORS)**: Injects `Access-Control-Allow-Origin: *` headers, enabling standard browser web apps to query the microcontroller without proxy servers or backend daemons.

---

## 🧮 Safety-Weighted A* Pathfinding Engine

### 1. Mathematical Formulation
Standard A* minimizes total geometric distance:
$$f(n) = g(n) + h(n)$$

In our safety-weighted algorithm:
- **$h(n)$**: Admissible Manhattan distance heuristic to the candidate emergency exit:
  $$h(n) = |x_n - x_{exit}| + |y_n - y_{exit}|$$
- **$g(n)$**: Accumulated path cost from the starting room to node $n$:
  $$g(n) = g(\text{parent}) + \text{Cost}(parent \to n)$$
  $$\text{Cost}(parent \to n) = C_{base} + H(n)$$

Where:
- $C_{base} = 1.0$ (uniform grid step cost for orthogonal movement).
- $H(n)$ is the **hazard penalty weight** computed by the radial diffusion model:

$$H(n) = \begin{cases} 
\infty & \text{if node } n \text{ is an active fire cell or solid wall} \\
K_{hazard} \times \left(1 - \frac{d(n, fire)}{R_{danger}}\right)^2 & \text{if } d(n, fire) \le R_{danger} \\
0 & \text{otherwise}
\end{cases}$$

### 2. Multi-Exit Real-Time Evaluation
The simulation computes the optimal path for each operational exit:
$$\text{Exit}^* = \arg\min_{e \in \{Exit A, Exit B, Exit C\}} f(e)$$

If an exit or its approach corridor is engulfed in flames, its cost evaluates to $\infty$, and the algorithm immediately shifts all evacuees to alternative safe exits.

---

## 📱 SafeRoute Mobile — Personal Occupant Evacuation App

SafeRoute Mobile (`mobile.html`) is a progressive, touch-optimized web application crafted for occupants inside the facility during an evacuation.

### Key Mobile Features:
1. **Pulsing Emergency Alert Banner**: Alerts occupants with flashing visual cues, high-contrast typography, and optional phone haptic vibration (`navigator.vibrate([300, 150, 300])`).
2. **Exact Fire Epicenter Display**: Clearly displays which sensor and room triggered the alarm (e.g., `Sensor 6 — Central Hallway`).
3. **Interactive Room Selector**: Occupants select their current room via quick-tap pill buttons, a dropdown picker, or by tapping directly on the mobile floorplan canvas to place an occupant marker.
4. **Dynamic Safest Route**: Runs the safety-weighted A* algorithm locally on the smartphone, generating a highlighted evacuation corridor that routes around high-danger zones.
5. **Turn-by-Turn Directions**: Step-by-step navigation instructions detailing every hallway turn, estimated walking distance in meters, and escape time in seconds.
6. **SOS Tools Sheet**:
   - **Haptic Vibration**: Physical phone buzz alert test.
   - **Screen Flashlight Strobe**: Flashes high-intensity white light to help navigate dark or smoke-filled stairwells.
   - **Emergency Dialer**: One-touch shortcut to dial national emergency services (`112` / `911`).
7. **Zero-Configuration Wi-Fi Sync**: Automatically synchronizes with the ESP8266 at `http://192.168.137.46/status`.

---

## 🚀 Installation & Setup Guide

### Prerequisites
- **Computer** (Windows, macOS, or Linux) with Google Chrome, Microsoft Edge, or Firefox.
- **Node.js** (optional, for `npx serve .`) or **Python 3.x** (for `python -m http.server`).
- **Arduino IDE** (with ESP8266 Board Package installed) for hardware flashing.
- **ESP8266 NodeMCU** with flame sensor and buzzer.

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/Vibhav-Sharma/Smart-Fire-Detection-Evacuation-Simulation.git
cd Smart-Fire-Detection-Evacuation-Simulation
```

---

### Step 2: Flash the ESP8266 Hardware
1. Launch the **Arduino IDE**.
2. Open [`firmware/esp8266_sensor6.ino`](file:///c:/Users/vibha/Fire_Detection/firmware/esp8266_sensor6.ino).
3. If not already installed, add the ESP8266 board URL to Arduino IDE Preferences:
   ```
   http://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
4. Install **esp8266** via Tools > Board > Boards Manager.
5. Edit lines 22–23 with your Wi-Fi name and password:
   ```cpp
   const char* ssid = "YOUR_HOTSPOT_NAME";
   const char* password = "YOUR_PASSWORD";
   ```
   > [!TIP]
   > For laptop demonstrations, enable **Windows Mobile Hotspot** (Settings > Network & Internet > Mobile Hotspot). This assigns your computer IP `192.168.137.1` and your ESP8266 an IP like `192.168.137.46`.

6. Select Board: **NodeMCU 1.0 (ESP-12E Module)** and your COM Port.
7. Click **Upload**.
8. Open the Serial Monitor at **115200 baud** to view the assigned IP:
   ```
   =========================================
    ESP8266 Fire Detection Active (D-Pins) 
    API URL: http://192.168.137.46/status
   =========================================
   ```

---

### Step 3: Launch the Simulation Server
Run any local static HTTP server in the repository directory:

#### Option A: 1-Click Windows Launcher
Double-click [`start_simulation.bat`](file:///c:/Users/vibha/Fire_Detection/start_simulation.bat).

#### Option B: Using Node.js
```bash
npx serve .
```

#### Option C: Using Python
```bash
python -m http.server 3000
```

---

### Step 4: Open Desktop Command Center
In your desktop browser, navigate to:
```
http://localhost:3000
```
- In the **ESP8266 Wi-Fi Hardware Bridge** card, verify the URL is set to `http://192.168.137.46/status`.
- Click **📡 Connect & Start Sync**. The status badge illuminates `🟢 Live Synced`.

> [!TIP]
> ### ⚡ Single Place to Change IP (`config.js`)
> If your ESP8266 is ever assigned a new IP address, you **only need to change 1 line** in [`config.js`](file:///c:/Users/vibha/Fire_Detection/config.js):
> ```javascript
> export const ESP8266_IP = '192.168.137.46';
> ```
> Both the desktop dashboard and the mobile phone app will automatically use the new IP! No need to edit any other file.

---

### Step 5: Open SafeRoute Mobile App on Your Smartphone
1. Connect your phone to the same Wi-Fi network or Windows Mobile Hotspot.
2. In your mobile browser, navigate to:
   ```
   http://192.168.137.1:3000/mobile.html
   ```
   *(Or simply scan the QR code displayed on the desktop command center dashboard!)*
3. Select your room (e.g. Classroom 1, Computer Lab) and watch your evacuation route update in real-time!

---

## 🧪 Testing the Live System

### 1. Physical Flame Trigger
- Bring a lighter or flame within 10–30 cm of the IR flame sensor connected to Pin `D1`.
- **ESP8266 Hardware Response**: Buzzer sounds immediately with an acoustic siren.
- **Desktop Command Center**: Sensor 6 (Central Hallway) turns bright red (`FIRE`), sound alarms trigger, and the A* path instantly recalculates away from the central hallway toward Exit B.
- **SafeRoute Mobile App**: Flashes an emergency alarm banner, buzzes with haptic vibration, displays `🔥 FIRE DETECTED AT SENSOR 6 (CENTRAL HALLWAY)`, and updates the occupant's turn-by-turn route.

### 2. Physical Flame Clear
- Extinguish or remove the flame.
- The buzzer silences.
- The dashboard and mobile app clear Sensor 6 back to `NORMAL` (Green), and routes return to normal baseline paths.

### 3. Simulation Override Testing
- Don't have physical hardware on hand? Use the **🔥 Test Flame (Fire)** and **🧯 Test Clear (Safe)** buttons in either the desktop dashboard or mobile settings sheet to simulate the exact hardware response!

---

## 🎓 Viva & Presentation Demonstration Guide

When presenting this project to professors, examiners, or project juries, use the following sequence:

| Step | Action | What to Explain to Examiners |
|---|---|---|
| **1. Baseline State** | Show default 8-node sensor grid | Explain normal environmental thresholds: 25°C, 15 ppm smoke, flame inactive. Show shortest path to Exit A. |
| **2. Hardware Connection** | Click "Connect & Start Sync" | Explain how the ESP8266 runs an embedded HTTP server with CORS headers, streaming JSON telemetry over Wi-Fi without third-party cloud brokers. |
| **3. Live Flame Detection** | Bring flame near sensor | Show real-time synchronization between the physical flame sensor, buzzer, and digital floor plan (**Sensor 6 — Central Hallway**). |
| **4. "Shortest ≠ Safest"** | Point to Exit Evaluation Matrix | Show examiners that although Exit A is geometrically closer, the hazard cost $H(n)$ makes it dangerous. A* chooses the slightly longer but safe route to Exit B. |
| **5. Algorithm Visualization** | Enable "Visualize A* Search" | Demonstrate the OPEN set (frontier cells evaluated in amber/cyan) and CLOSED set (explored nodes in purple), explaining $g(n)$, $h(n)$, and $f(n)$. |
| **6. Mobile Occupant App** | Show phone screen / QR code | Show examiners the mobile view on a real smartphone. Demonstrate tapping different rooms and watching the evacuation route dynamically adjust. |

---

## ❓ Frequently Asked Oral Exam Questions (FAQ)

### Q1: Why use A* instead of Dijkstra or Breadth-First Search (BFS)?
> **Answer**: BFS assumes uniform edge weights and cannot handle variable danger penalties. Dijkstra handles weights but explores nodes radially in all directions without a goal bias. A* combines Dijkstra's path cost tracking ($g(n)$) with an admissible heuristic ($h(n)$), focusing search towards the exit and running orders of magnitude faster, which is essential for real-time life safety systems.

### Q2: How does the ESP8266 communicate with the web browser without CORS errors?
> **Answer**: The ESP8266 firmware explicitly sends HTTP response headers:
> ```cpp
> server.sendHeader("Access-Control-Allow-Origin", "*");
> ```
> This informs the browser's security engine that local asynchronous `fetch()` requests are authorized across different IP origins.

### Q3: What happens if all exits are compromised by fire?
> **Answer**: The algorithm evaluates all candidate exits. If all paths contain infinite cost cells, the system alerts the occupant that all primary corridors are blocked, calculates the lowest-danger holding zone or refuge room, and prompts them to deploy the SOS distress signal.

### Q4: Why use an IR Flame Sensor rather than just smoke or temperature?
> **Answer**: Temperature and smoke sensors have thermal and mechanical diffusion delays (taking seconds to minutes to accumulate). Optical infrared sensors detect the 760nm–1100nm infrared radiation of open flames within milliseconds, offering immediate early-stage fire alarm escalation.

---

## 📂 Project Directory Structure

```
Fire_Detection/
├── index.html                   # Desktop Command Center Dashboard (HTML5)
├── style.css                    # Command Center Cyber-Dark Design System
├── script.js                    # Desktop Controller & ESP8266 Wi-Fi Bridge
├── mobile.html                  # SafeRoute Mobile Occupant Evacuation App (PWA)
├── mobile.css                   # Mobile-First Responsive Styles & SOS Tools
├── mobile.js                    # Mobile Controller, Touch Canvas & Turn-by-Turn Engine
├── firmware/
│   └── esp8266_sensor6.ino      # ESP8266 C++ Arduino Firmware with HTTP /status Server
├── src/
│   ├── mapData.js               # 42x26 Architectural Grid, Rooms, Walls, Exits A/B/C
│   ├── astar.js                 # Safety-Weighted A* Pathfinding Engine with Step Tracing
│   ├── danger.js                # Radial Hazard & Smoke Plume Propagation Model
│   ├── renderer.js              # High-DPI Canvas Renderer with Ant Trails & Glows
│   ├── telemetry.js             # 8-Node Sensor Manager with Realistic Environmental Jitter
│   ├── audio.js                 # Web Audio API Synthesized Dual-Frequency Siren
│   └── demo.js                  # Automated 13-Second Presentation Sequence
├── start_simulation.bat         # 1-Click Windows Local HTTP Server Launcher
├── .gitignore                   # Git Ignore Rules
└── README.md                    # Comprehensive Project Documentation
```

---

## 📄 License

This project is licensed under the **MIT License** — you are free to modify, distribute, and integrate this software and firmware for educational and commercial purposes.

---

**Developed with ❤️ for College MPMC (Microprocessors & Microcontrollers) Engineering Capstone Project**
