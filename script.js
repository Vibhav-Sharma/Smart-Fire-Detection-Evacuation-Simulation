/**
 * Application Orchestrator & State Controller
 * Binds UI controls, Canvas renderer, A* engine, Danger model,
 * Audio alarms, and Telemetry bridge together.
 */

import {
  GRID_COLS,
  GRID_ROWS,
  ROOMS,
  SENSORS,
  EXITS,
  DEFAULT_OCCUPANTS,
  createBaseGrid,
  getRoomAt
} from './src/mapData.js';

import { calculateDangerMap, formatRiskScore } from './src/danger.js';
import { findSafestEvacuationRoute, generateAStarTrace } from './src/astar.js';
import { CanvasRenderer } from './src/renderer.js';
import { SensorTelemetryManager } from './src/telemetry.js';
import { AlarmAudioSystem } from './src/audio.js';
import { PresentationDemoRunner } from './src/demo.js';

class FireEvacuationApp {
  constructor() {
    this.canvas = document.getElementById('mapCanvas');
    this.renderer = new CanvasRenderer(this.canvas);
    this.audio = new AlarmAudioSystem();

    // Core Simulation State
    this.baseGrid = createBaseGrid();
    this.occupants = JSON.parse(JSON.stringify(DEFAULT_OCCUPANTS));
    this.selectedOccupantId = 'P1';

    this.telemetry = new SensorTelemetryManager((sensors) => {
      this.onSensorsUpdated(sensors);
    });

    this.dangerMap = calculateDangerMap([], this.baseGrid);
    this.currentRoute = null;

    // A* Trace & Visualization State
    this.showAStarViz = false;
    this.aStarTrace = [];
    this.traceStepIndex = 0;
    this.traceInterval = null;
    this.traceSpeed = 45; // ms per step
    this.isTracePlaying = false;

    // Animation loop state
    this.isEvacuating = false;
    this.evacuationStep = 0;
    this.evacuationInterval = null;

    this.demoRunner = new PresentationDemoRunner(this);

    this.initUI();
    this.setupEventListeners();
    this.updateSystem();
    this.startRenderLoop();
  }

  getSelectedOccupant() {
    return this.occupants.find(o => o.id === this.selectedOccupantId) || this.occupants[0];
  }

  onSensorsUpdated(sensors) {
    this.renderTelemetryTable(sensors);
    this.renderFireControlButtons(sensors);
  }

  updateSystem() {
    const activeFires = this.telemetry.getActiveFires();

    // 1. Update Danger Map based on active fire epicenters
    this.dangerMap = calculateDangerMap(activeFires, this.baseGrid);

    // 2. Manage Audio Siren
    if (activeFires.length > 0) {
      this.audio.startAlarm();
      document.getElementById('emergencyBanner').classList.remove('hidden');
      document.getElementById('emergencyBannerText').innerText =
        `🔥 CRITICAL ALERT: FIRE DETECTED AT SENSOR(S): ${activeFires.map(f => `${f.id} (${f.room})`).join(', ')}`;
    } else {
      this.audio.stopAlarm();
      document.getElementById('emergencyBanner').classList.add('hidden');
    }

    // 3. Recalculate Evacuation Route using A*
    const occupant = this.getSelectedOccupant();
    const routeResult = findSafestEvacuationRoute(
      { x: occupant.x, y: occupant.y },
      EXITS,
      this.baseGrid,
      this.dangerMap
    );

    this.currentRoute = routeResult.bestRoute;

    // Track baseline shortest path under normal conditions for comparison during fire
    if (activeFires.length === 0 && this.currentRoute) {
      this.baselineRoute = JSON.parse(JSON.stringify(this.currentRoute));
    }

    // 4. Update HUD and Exits Comparison Panel
    this.updateHUD(routeResult, activeFires);
    this.renderExitComparisons(routeResult.evaluations, routeResult.bestRoute);
    this.renderFireControlButtons(this.telemetry.getAllSensors());
    this.renderTelemetryTable(this.telemetry.getAllSensors());

    // 5. If A* Viz is active, prepare trace
    if (this.currentRoute) {
      this.aStarTrace = generateAStarTrace(
        { x: occupant.x, y: occupant.y },
        this.currentRoute.exit,
        this.baseGrid,
        this.dangerMap
      );
      if (this.showAStarViz && this.isTracePlaying) {
        this.runTraceAnimation();
      }
    }
  }

  updateHUD(routeResult, activeFires) {
    const statusPill = document.getElementById('systemStatusPill');
    const activeFiresCount = document.getElementById('activeFiresCount');
    const chosenExitEl = document.getElementById('chosenExit');
    const pathDistEl = document.getElementById('pathDistance');
    const pathRiskEl = document.getElementById('pathRisk');
    const pathTimeEl = document.getElementById('pathTime');
    const comparisonCallout = document.getElementById('comparisonCallout');

    activeFiresCount.innerText = activeFires.length;

    if (activeFires.length > 0) {
      statusPill.className = 'status-badge fire';
      statusPill.innerText = '🔴 FIRE / EVACUATION';
    } else {
      statusPill.className = 'status-badge normal';
      statusPill.innerText = '🟢 STANDBY NORMAL';
    }

    if (routeResult.success && routeResult.bestRoute) {
      const best = routeResult.bestRoute;
      chosenExitEl.innerText = best.exit.label;
      chosenExitEl.style.color = best.exit.color;

      const meters = (best.distance * 1.2).toFixed(1);
      pathDistEl.innerText = `${best.distance} cells (${meters} m)`;

      const riskFmt = formatRiskScore(best.riskCost);
      pathRiskEl.innerHTML = `<span class="badge ${riskFmt.badgeClass}">${best.riskCost} - ${riskFmt.label}</span>`;
      pathTimeEl.innerText = `~${best.estimatedTimeSec} sec`;

      // Explain why route was chosen
      if (activeFires.length > 0) {
        comparisonCallout.innerHTML = `
          <strong>Intelligent Path Selection Active:</strong><br>
          A* evaluated all active exits and chose <strong>${best.exit.name}</strong> because its cumulative hazard risk (${best.riskCost}) is lower than high-danger paths near active fire zones.
        `;
        comparisonCallout.className = 'callout success';
      } else {
        comparisonCallout.innerHTML = `
          <strong>Normal Conditions:</strong><br>
          No active hazards. A* directs occupant via shortest optimal path to nearest exit (${best.exit.name}).
        `;
        comparisonCallout.className = 'callout info';
      }
    } else {
      chosenExitEl.innerText = 'NONE AVAILABLE';
      chosenExitEl.style.color = '#ef4444';
      pathDistEl.innerText = 'N/A';
      pathRiskEl.innerHTML = '<span class="badge extreme">MAXIMUM / BLOCKED</span>';
      pathTimeEl.innerText = 'N/A';

      comparisonCallout.innerHTML = `
        <strong style="color: #ef4444;">⚠ WARNING: ALL EXITS BLOCKED BY FIRE!</strong><br>
        No safe evacuation path found. Occupants should seek reinforced shelter or await firefighter assistance.
      `;
      comparisonCallout.className = 'callout danger';
    }
  }

  renderExitComparisons(evaluations, bestRoute) {
    const container = document.getElementById('exitComparisonCards');
    if (!container) return;

    container.innerHTML = evaluations.map(ev => {
      const isBest = bestRoute && bestRoute.exit.id === ev.exit.id;
      const statusClass = !ev.accessible ? 'exit-blocked' : isBest ? 'exit-recommended' : 'exit-alternative';
      const statusText = !ev.accessible ? 'BLOCKED' : isBest ? 'SAFEST ROUTE' : 'HAZARDOUS / LONGER';

      return `
        <div class="exit-card ${statusClass}">
          <div class="exit-card-header">
            <span class="exit-title" style="color: ${ev.exit.color}">🚪 ${ev.exit.name}</span>
            <span class="exit-badge ${statusClass}">${statusText}</span>
          </div>
          <div class="exit-metrics">
            <div>Dist: <strong>${ev.accessible ? `${ev.distance} cells` : '∞'}</strong></div>
            <div>Risk: <strong>${ev.accessible ? ev.riskCost : '∞'}</strong></div>
            <div>Total Cost: <strong>${ev.accessible ? ev.totalCost : '∞'}</strong></div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderFireControlButtons(sensors) {
    const container = document.getElementById('fireButtonsGrid');
    if (!container) return;

    container.innerHTML = sensors.map(s => {
      const isFire = s.status === 'FIRE';
      const isHw = s.id === 'S6' || s.isHardware;
      return `
        <button class="btn-sensor ${isFire ? 'fire-active' : ''}" data-sensor-id="${s.id}">
          <span class="sensor-icon">${isFire ? '🔥' : '🟢'}</span>
          <span class="sensor-id">${s.id}${isHw ? ' <small style="color:#c084fc; font-size: 8px;">(ESP8266)</small>' : ''}</span>
          <span class="sensor-room">${s.room}</span>
        </button>
      `;
    }).join('');

    // Attach click listener
    container.querySelectorAll('.btn-sensor').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.getAttribute('data-sensor-id');
        const sensor = this.telemetry.getSensor(sid);
        if (sensor.status === 'FIRE') {
          this.telemetry.clearSensor(sid);
        } else {
          this.telemetry.triggerFire(sid, sid === 'S6' ? 'ESP8266_HARDWARE' : 'SIMULATION');
        }
        this.updateSystem();
      });
    });
  }

  renderTelemetryTable(sensors) {
    const tbody = document.getElementById('sensorTableBody');
    if (!tbody) return;

    tbody.innerHTML = sensors.map(s => {
      const isHw = s.id === 'S6' || s.isHardware;
      const statusBadge = s.status === 'FIRE' ? '<span class="badge extreme">🔴 FIRE</span>' :
        s.status === 'PRE_ALARM' ? '<span class="badge caution">🟡 ALERT</span>' :
          '<span class="badge safe">🟢 NORMAL</span>';

      const flameText = s.flame ? '<strong style="color: #ef4444;">YES</strong>' : '<span style="color: #64748b;">No</span>';
      const tempColor = s.temp > 50 ? '#ef4444' : s.temp > 35 ? '#f59e0b' : '#38bdf8';
      const smokeColor = s.smoke > 300 ? '#ef4444' : s.smoke > 100 ? '#f59e0b' : '#94a3b8';
      const hwPill = isHw ? '<span class="badge hardware-badge-pill" style="font-size: 8px; margin-left: 5px; padding: 1px 5px;">⚡ESP8266 HW</span>' : '';

      return `
        <tr class="${s.status === 'FIRE' ? 'row-fire' : ''}">
          <td><strong>${s.id}</strong>${hwPill}</td>
          <td>${s.room}</td>
          <td><span style="color: ${smokeColor}; font-weight: 600;">${s.smoke} ppm</span></td>
          <td><span style="color: ${tempColor}; font-weight: 600;">${s.temp}°C</span></td>
          <td>${flameText}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn-table-trigger ${s.status === 'FIRE' ? 'active' : ''}" data-sensor-id="${s.id}">
              ${s.status === 'FIRE' ? 'Extinguish' : 'Trigger'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Table quick actions
    tbody.querySelectorAll('.btn-table-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.getAttribute('data-sensor-id');
        const sensor = this.telemetry.getSensor(sid);
        if (sensor.status === 'FIRE') {
          this.telemetry.clearSensor(sid);
        } else {
          this.telemetry.triggerFire(sid, 'SIMULATION');
        }
        this.updateSystem();
      });
    });
  }

  animateEvacuation() {
    if (!this.currentRoute || !this.currentRoute.path || this.currentRoute.path.length < 2) return;

    if (this.evacuationInterval) {
      clearInterval(this.evacuationInterval);
    }

    this.isEvacuating = true;
    const path = this.currentRoute.path;
    const occupant = this.getSelectedOccupant();
    let stepIndex = 0;

    this.evacuationInterval = setInterval(() => {
      if (stepIndex < path.length) {
        occupant.x = path[stepIndex].x;
        occupant.y = path[stepIndex].y;
        stepIndex++;
      } else {
        clearInterval(this.evacuationInterval);
        this.isEvacuating = false;
      }
    }, 180);
  }

  triggerAStarVisualization() {
    this.showAStarViz = true;
    document.getElementById('aStarVizToggle').checked = true;
    const vizControls = document.getElementById('aStarVizControls');
    if (vizControls) vizControls.classList.remove('hidden');

    const occupant = this.getSelectedOccupant();
    if (!this.currentRoute) return;

    this.aStarTrace = generateAStarTrace(
      { x: occupant.x, y: occupant.y },
      this.currentRoute.exit,
      this.baseGrid,
      this.dangerMap
    );

    this.traceStepIndex = 0;
    this.runTraceAnimation();
  }

  runTraceAnimation() {
    if (this.traceInterval) clearInterval(this.traceInterval);
    this.isTracePlaying = true;

    this.traceInterval = setInterval(() => {
      if (this.traceStepIndex < this.aStarTrace.length - 1) {
        this.traceStepIndex++;
        this.updateTraceDisplay();
      } else {
        clearInterval(this.traceInterval);
        this.isTracePlaying = false;
      }
    }, this.traceSpeed);
  }

  pauseTraceAnimation() {
    if (this.traceInterval) {
      clearInterval(this.traceInterval);
      this.traceInterval = null;
    }
    this.isTracePlaying = false;
  }

  updateTraceDisplay() {
    const traceItem = this.aStarTrace[this.traceStepIndex];
    if (!traceItem) return;

    document.getElementById('vizStepCount').innerText = `${this.traceStepIndex + 1} / ${this.aStarTrace.length}`;
    document.getElementById('vizOpenCount').innerText = traceItem.openList ? traceItem.openList.length : 0;
    document.getElementById('vizClosedCount').innerText = traceItem.closedList ? traceItem.closedList.length : 0;

    if (traceItem.node) {
      document.getElementById('vizCurrentNode').innerText = `(${traceItem.node.x}, ${traceItem.node.y})`;
      document.getElementById('vizGScore').innerText = traceItem.node.g ?? '-';
      document.getElementById('vizHScore').innerText = traceItem.node.h ?? '-';
      document.getElementById('vizFScore').innerText = traceItem.node.f ?? '-';
    }
  }

  lockInSafestRoute() {
    this.pauseTraceAnimation();
    this.showAStarViz = false;
    document.getElementById('aStarVizToggle').checked = false;
    const vizControls = document.getElementById('aStarVizControls');
    if (vizControls) vizControls.classList.add('hidden');
    this.updateSystem();
  }

  resetSimulation() {
    this.demoRunner.stop();
    if (this.evacuationInterval) clearInterval(this.evacuationInterval);
    if (this.traceInterval) clearInterval(this.traceInterval);

    this.occupants = JSON.parse(JSON.stringify(DEFAULT_OCCUPANTS));
    this.selectedOccupantId = 'P1';
    this.telemetry.clearAllFires();
    this.showAStarViz = false;
    this.traceStepIndex = 0;

    document.getElementById('aStarVizToggle').checked = false;
    const vizControls = document.getElementById('aStarVizControls');
    if (vizControls) vizControls.classList.add('hidden');

    this.updateSystem();
  }

  setupEventListeners() {
    // 1. Canvas Interactive Clicks
    this.canvas.addEventListener('click', (e) => {
      const coords = this.renderer.getGridCoordinatesFromEvent(e);
      if (!coords) return;

      // Check if user clicked a sensor
      const clickedSensor = SENSORS.find(s => s.x === coords.x && s.y === coords.y);
      if (clickedSensor) {
        const state = this.telemetry.getSensor(clickedSensor.id);
        if (state.status === 'FIRE') {
          this.telemetry.clearSensor(clickedSensor.id);
        } else {
          this.telemetry.triggerFire(clickedSensor.id, 'SIMULATION');
        }
        this.updateSystem();
        return;
      }

      // Check if user clicked a walkable cell -> move selected occupant
      if (this.baseGrid[coords.y][coords.x] !== 1) {
        const occupant = this.getSelectedOccupant();
        occupant.x = coords.x;
        occupant.y = coords.y;
        this.updateSystem();
      }
    });

    // 2. Canvas Mouse Move for Cell Tooltip
    this.canvas.addEventListener('mousemove', (e) => {
      const coords = this.renderer.getGridCoordinatesFromEvent(e);
      this.renderer.hoverCell = coords;

      const tooltip = document.getElementById('cellTooltip');
      if (!coords || !tooltip) {
        if (tooltip) tooltip.style.display = 'none';
        return;
      }

      const room = getRoomAt(coords.x, coords.y);
      const isWall = this.baseGrid[coords.y][coords.x] === 1;
      const danger = this.dangerMap[coords.y][coords.x];

      tooltip.style.display = 'block';
      tooltip.style.left = `${e.clientX + 16}px`;
      tooltip.style.top = `${e.clientY + 16}px`;
      tooltip.innerHTML = `
        <div class="tooltip-title">${room.name}</div>
        <div>Coord: <strong>(${coords.x}, ${coords.y})</strong></div>
        <div>Type: <strong>${isWall ? 'Structural Wall' : 'Walkable Floor'}</strong></div>
        <div>Hazard: <span class="badge ${danger ? formatRiskScore(danger.penalty).badgeClass : 'safe'}">${danger ? danger.level : 'SAFE'}</span></div>
        <div>Move Cost: <strong>${danger && danger.isBlocked ? '∞ (BLOCKED)' : (1 + (danger ? danger.penalty : 0))}</strong></div>
      `;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.renderer.hoverCell = null;
      const tooltip = document.getElementById('cellTooltip');
      if (tooltip) tooltip.style.display = 'none';
    });

    // 3. Header Action Buttons
    document.getElementById('btnRunDemo').addEventListener('click', () => {
      this.demoRunner.start();
    });

    document.getElementById('btnReset').addEventListener('click', () => {
      this.resetSimulation();
    });

    document.getElementById('btnClearFires').addEventListener('click', () => {
      this.telemetry.clearAllFires();
      this.updateSystem();
    });

    document.getElementById('btnStartEvac').addEventListener('click', () => {
      this.animateEvacuation();
    });

    // 4. Audio Mute Toggle
    const btnMute = document.getElementById('btnToggleAudio');
    btnMute.addEventListener('click', () => {
      const muted = this.audio.toggleMute();
      btnMute.innerHTML = muted ? '🔇 Sound OFF' : '🔊 Sound ON';
      btnMute.classList.toggle('muted', muted);
    });

    // 5. Occupant Selector
    document.querySelectorAll('.btn-occupant').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-occupant').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedOccupantId = btn.getAttribute('data-occupant-id');
        this.updateSystem();
      });
    });

    // 6. A* Visualization Toggle & Controls
    const vizToggle = document.getElementById('aStarVizToggle');
    vizToggle.addEventListener('change', (e) => {
      this.showAStarViz = e.target.checked;
      const vizControls = document.getElementById('aStarVizControls');
      if (this.showAStarViz) {
        vizControls.classList.remove('hidden');
        this.triggerAStarVisualization();
      } else {
        vizControls.classList.add('hidden');
        this.pauseTraceAnimation();
      }
    });

    document.getElementById('btnTracePlay').addEventListener('click', () => {
      if (this.isTracePlaying) {
        this.pauseTraceAnimation();
        document.getElementById('btnTracePlay').innerText = '▶ Resume';
      } else {
        this.runTraceAnimation();
        document.getElementById('btnTracePlay').innerText = '⏸ Pause';
      }
    });

    document.getElementById('btnTraceStep').addEventListener('click', () => {
      this.pauseTraceAnimation();
      if (this.traceStepIndex < this.aStarTrace.length - 1) {
        this.traceStepIndex++;
        this.updateTraceDisplay();
      }
    });

    document.getElementById('traceSpeedSlider').addEventListener('input', (e) => {
      // Invert slider so right = faster (lower delay)
      const val = Number(e.target.value);
      this.traceSpeed = 250 - val;
      if (this.isTracePlaying) {
        this.runTraceAnimation();
      }
    });

    // 7. Demo Progress banner hook
    this.demoRunner.onProgress((info) => {
      const banner = document.getElementById('demoBanner');
      if (banner) {
        banner.classList.remove('hidden');
        banner.innerHTML = `<strong>${info.title} (${info.second}s):</strong> ${info.description}`;
        if (info.title === 'Demo Complete') {
          setTimeout(() => banner.classList.add('hidden'), 4000);
        }
      }
    });

    // 8. ESP8266 Wi-Fi HTTP Polling Bridge (Live Sensor 6)
    this.espWifiInterval = null;
    this.espPollingActive = false;
    this.espFireIsActive = false;
    this.espFailCount = 0;

    const espUrlInput = document.getElementById('esp8266Url');
    const btnToggleWifi = document.getElementById('btnToggleWifiSync');
    const badgeWifi = document.getElementById('wifiStatusBadge');
    const hwFlameState = document.getElementById('hwFlameState');
    const hwLastPing = document.getElementById('hwLastPing');
    const wifiLog = document.getElementById('wifiLog');
    const btnClearLog = document.getElementById('btnClearWifiLog');

    const appendWifiLog = (msg, type = 'info') => {
      if (!wifiLog) return;
      const line = document.createElement('div');
      line.className = `serial-line ${type}`;
      line.innerText = `> ${msg}`;
      wifiLog.appendChild(line);
      wifiLog.scrollTop = wifiLog.scrollHeight;
    };

    if (btnClearLog) {
      btnClearLog.addEventListener('click', () => {
        if (wifiLog) wifiLog.innerHTML = '<div class="serial-line info">&gt; Log cleared. Ready for ESP8266 telemetry.</div>';
      });
    }

    // Always default to active hardware IP: 192.168.137.209
    let initialUrl = 'http://192.168.137.209/status';
    const savedUrl = localStorage.getItem('esp8266_url');
    if (savedUrl && savedUrl.includes('192.168.137.209')) {
      initialUrl = savedUrl;
    } else {
      localStorage.setItem('esp8266_url', initialUrl);
    }
    if (espUrlInput) {
      espUrlInput.value = initialUrl;

      espUrlInput.addEventListener('input', () => {
        const u = normalizeUrl(espUrlInput.value);
        localStorage.setItem('esp8266_url', u);
      });
    }

    const normalizeUrl = (raw) => {
      let u = (raw || '').trim();
      if (!u) return 'http://192.168.137.209/status';
      if (!/^https?:\/\//i.test(u)) {
        u = 'http://' + u;
      }
      if (!u.includes('/status')) {
        u = u.replace(/\/+$/, '') + '/status';
      }
      return u;
    };

    const pollEsp8266 = async () => {
      const targetUrl = normalizeUrl(espUrlInput ? espUrlInput.value : '');
      const startTime = performance.now();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);

        const response = await fetch(targetUrl, {
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const latency = Math.round(performance.now() - startTime);

        this.espFailCount = 0;
        if (badgeWifi) {
          badgeWifi.className = 'badge success';
          badgeWifi.innerText = `🟢 Live Synced (${latency}ms)`;
        }

        if (hwLastPing) {
          hwLastPing.innerText = `${new Date().toLocaleTimeString()} (${latency}ms)`;
        }

        // ESP8266 JSON packet: {"fire": true/false, "room": "Room_1"}
        const isFlame = (data.fire === true || data.fire === 'true' || data.fire === 1 || data.fire === '1');
        const roomName = data.room || 'Room_1';

        if (hwFlameState) {
          if (isFlame) {
            hwFlameState.className = 'stat-value fire';
            hwFlameState.innerText = '🔥 FIRE DETECTED';
          } else {
            hwFlameState.className = 'stat-value safe';
            hwFlameState.innerText = 'CLEAR (SAFE)';
          }
        }

        const s6 = this.telemetry.getSensor('S6');
        const isCurrentlyFire = Boolean(s6 && s6.status === 'FIRE');

        // State Synchronization: Fire Detected
        if (isFlame) {
          if (!isCurrentlyFire || !this.espFireIsActive) {
            this.espFireIsActive = true;
            appendWifiLog(`🔥 ESP8266 Alert: Flame sensed on hardware! Sensor 6 (${roomName}) set to FIRE!`, 'error');
            this.telemetry.applyHardwareFireState(true, roomName);
            this.updateSystem();
          }
        }
        // State Synchronization: Safe / Clear
        else {
          if (isCurrentlyFire || this.espFireIsActive) {
            this.espFireIsActive = false;
            appendWifiLog(`✅ ESP8266 Alert: Hardware flame cleared! Sensor 6 (${roomName}) restored to safe status.`, 'success');
            this.telemetry.applyHardwareFireState(false, roomName);
            this.updateSystem();
          }
        }

      } catch (err) {
        this.espFailCount++;
        if (this.espFailCount === 1) {
          appendWifiLog(`⚠️ Polling ${targetUrl}: ${err.message}. Retrying...`, 'error');
        } else if (this.espFailCount === 5) {
          appendWifiLog(`⚠️ Note: Verify your ESP8266 is on Wi-Fi and reachable at ${targetUrl}.`, 'info');
        }

        if (badgeWifi) {
          badgeWifi.className = 'badge';
          badgeWifi.innerText = `🟡 Retrying (${this.espFailCount})...`;
        }
        if (hwLastPing) {
          hwLastPing.innerText = `Offline (${new Date().toLocaleTimeString()})`;
        }
      }
    };

    const startEspPolling = () => {
      if (this.espPollingActive) return;
      this.espPollingActive = true;
      const targetUrl = normalizeUrl(espUrlInput ? espUrlInput.value : '');
      if (espUrlInput) {
        localStorage.setItem('esp8266_url', targetUrl);
      }

      appendWifiLog(`Connecting to ESP8266 at ${targetUrl} (500ms poll interval)...`, 'info');
      if (btnToggleWifi) {
        btnToggleWifi.innerHTML = '⏸ Stop Wi-Fi Sync';
        btnToggleWifi.className = 'btn btn-sm btn-secondary';
      }
      if (badgeWifi) {
        badgeWifi.className = 'badge caution';
        badgeWifi.innerText = '🟡 Connecting...';
      }

      pollEsp8266();
      this.espWifiInterval = setInterval(pollEsp8266, 500);
    };

    const stopEspPolling = () => {
      if (!this.espPollingActive) return;
      this.espPollingActive = false;
      if (this.espWifiInterval) {
        clearInterval(this.espWifiInterval);
        this.espWifiInterval = null;
      }
      if (btnToggleWifi) {
        btnToggleWifi.innerHTML = '📡 Connect &amp; Start Sync';
        btnToggleWifi.className = 'btn btn-sm btn-primary';
      }
      if (badgeWifi) {
        badgeWifi.className = 'badge';
        badgeWifi.innerText = '🔴 Disconnected';
      }
      appendWifiLog('Wi-Fi polling paused.', 'info');
    };

    if (btnToggleWifi) {
      btnToggleWifi.addEventListener('click', () => {
        if (this.espPollingActive) {
          stopEspPolling();
        } else {
          startEspPolling();
        }
      });
    }

    // Automatically begin Wi-Fi sync immediately on startup
    startEspPolling();

    // 9. Quick Hardware Test Controls for S6
    const btnSimFlame = document.getElementById('btnSimulateFlame');
    if (btnSimFlame) {
      btnSimFlame.addEventListener('click', () => {
        this.espFireIsActive = true;
        if (hwFlameState) {
          hwFlameState.className = 'stat-value fire';
          hwFlameState.innerText = '🔥 FIRE DETECTED (MOCK)';
        }
        appendWifiLog('⚡ Hardware Simulation: Flame ON -> Sensor 6 (Central Hallway) set to FIRE!', 'error');
        this.telemetry.applyHardwareFireState(true, 'Room_1');
        this.updateSystem();
      });
    }

    const btnSimClear = document.getElementById('btnSimulateClear');
    if (btnSimClear) {
      btnSimClear.addEventListener('click', () => {
        this.espFireIsActive = false;
        if (hwFlameState) {
          hwFlameState.className = 'stat-value safe';
          hwFlameState.innerText = 'CLEAR (SAFE)';
        }
        appendWifiLog('⚡ Hardware Simulation: Flame CLEAR -> Sensor 6 (Central Hallway) restored to NORMAL.', 'success');
        this.telemetry.applyHardwareFireState(false, 'Room_1');
        this.updateSystem();
      });
    }
  }

  initUI() {
    this.renderFireControlButtons(this.telemetry.getAllSensors());
    this.renderTelemetryTable(this.telemetry.getAllSensors());
  }

  startRenderLoop() {
    const loop = () => {
      const occupant = this.getSelectedOccupant();
      const activeFires = this.telemetry.getActiveFires();
      this.renderer.render({
        baseGrid: this.baseGrid,
        dangerMap: this.dangerMap,
        sensors: this.telemetry.getAllSensors(),
        occupants: this.occupants,
        currentRoute: this.currentRoute,
        previousRoute: activeFires.length > 0 ? this.baselineRoute : null,
        aStarTraceState: this.showAStarViz && this.aStarTrace.length > 0 ? this.aStarTrace[this.traceStepIndex] : null,
        showAStarViz: this.showAStarViz
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.fireApp = new FireEvacuationApp();
});

// Global Integration Hooks (Supports external scripts and manual console triggers)
window.setRoomOnFire = (roomOrSensorName) => {
  if (!window.fireApp) return;
  window.fireApp.telemetry.applyHardwareFireState(true, roomOrSensorName || 'Room_1');
  window.fireApp.updateSystem();
  console.log(`%c🔥 [ESP8266 Hook] Fire triggered on Sensor 6 (Room: ${roomOrSensorName || 'Room_1'})`, 'color: red; font-weight: bold;');
};

window.clearRoomFire = (roomOrSensorName) => {
  if (!window.fireApp) return;
  window.fireApp.telemetry.applyHardwareFireState(false, roomOrSensorName || 'Room_1');
  window.fireApp.updateSystem();
  console.log(`%c✅ [ESP8266 Hook] Fire cleared on Sensor 6`, 'color: green; font-weight: bold;');
};

window.resetSimulation = () => {
  if (!window.fireApp) return;
  window.fireApp.telemetry.clearAllFires();
  window.fireApp.updateSystem();
};

window.triggerWebsiteFire = (roomName) => {
  window.setRoomOnFire(roomName);
};

window.clearWebsiteFire = (roomName) => {
  window.clearRoomFire(roomName);
};
