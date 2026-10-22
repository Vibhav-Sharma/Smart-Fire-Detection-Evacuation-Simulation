/**
 * ============================================================================
 * SafeRoute Mobile - Personal Emergency Evacuation & Fire Alert Companion
 * Mobile-First Client Orchestrator
 * ============================================================================
 */

import {
  GRID_COLS,
  GRID_ROWS,
  ROOMS,
  SENSORS,
  EXITS,
  createBaseGrid,
  getRoomAt
} from './src/mapData.js';

import { calculateDangerMap } from './src/danger.js';
import { findSafestEvacuationRoute } from './src/astar.js';
import { SensorTelemetryManager } from './src/telemetry.js';
import { AlarmAudioSystem } from './src/audio.js';

class MobileEvacuationApp {
  constructor() {
    this.canvas = document.getElementById('mobileMapCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new AlarmAudioSystem();

    this.baseGrid = createBaseGrid();
    this.telemetry = new SensorTelemetryManager((sensors) => {
      this.onSensorsUpdated(sensors);
    });

    // Default occupant location: Classroom 1 (x: 7, y: 16)
    this.userLocation = { x: 7, y: 16, roomId: 'class_1', roomName: 'Classroom 1' };
    this.dangerMap = calculateDangerMap([], this.baseGrid);
    this.currentRoute = null;

    // ESP8266 Wi-Fi Polling State
    let savedMobileUrl = localStorage.getItem('esp8266_mobile_url');
    if (!savedMobileUrl || !savedMobileUrl.includes('192.168.137.209')) {
      savedMobileUrl = 'http://192.168.137.209/status';
      localStorage.setItem('esp8266_mobile_url', savedMobileUrl);
    }
    this.espUrl = savedMobileUrl;
    this.espFireIsActive = false;
    this.espWifiInterval = null;

    // Animation & Canvas State
    this.animOffset = 0;
    this.cellSize = 10;

    this.initUI();
    this.setupEventListeners();
    this.setupCanvas();
    this.updateSystem();
    this.startAutoPolling();
    this.startRenderLoop();
  }

  setupCanvas() {
    const resize = () => {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);
      this.cellSize = rect.width / GRID_COLS;
    };
    resize();
    window.addEventListener('resize', resize);

    // Touch & Click handler on Canvas to set occupant location
    const handleTap = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = Math.floor((clientX - rect.left) / this.cellSize);
      const y = Math.floor((clientY - rect.top) / this.cellSize);

      if (x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS) {
        // Only allow walkable cells (0 or 2)
        if (this.baseGrid[y][x] === 0 || this.baseGrid[y][x] === 2) {
          const room = getRoomAt(x, y);
          this.setUserLocation(x, y, room.name);
          if ('vibrate' in navigator) navigator.vibrate(25);
        }
      }
    };

    this.canvas.addEventListener('click', handleTap);
    this.canvas.addEventListener('touchstart', handleTap, { passive: true });
  }

  setUserLocation(x, y, roomName) {
    this.userLocation = { x, y, roomName };
    this.syncRoomPillsSelection();
    this.updateSystem();
  }

  syncRoomPillsSelection() {
    document.querySelectorAll('.room-pill').forEach(btn => {
      const room = btn.getAttribute('data-room-name');
      if (room && this.userLocation.roomName && this.userLocation.roomName.toLowerCase().includes(room.toLowerCase())) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const select = document.getElementById('roomSelectDropdown');
    if (select) {
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].text.includes(this.userLocation.roomName)) {
          select.selectedIndex = i;
          break;
        }
      }
    }
  }

  initUI() {
    // 1. Populate Room Pills
    const pillsContainer = document.getElementById('roomPillsContainer');
    const select = document.getElementById('roomSelectDropdown');

    if (pillsContainer) {
      pillsContainer.innerHTML = ROOMS.map(r => `
        <button class="room-pill ${r.name === this.userLocation.roomName ? 'active' : ''}" 
                data-room-name="${r.name}" 
                data-x="${Math.round((r.x1 + r.x2) / 2)}" 
                data-y="${Math.round((r.y1 + r.y2) / 2)}">
          <span>${r.name}</span>
        </button>
      `).join('');

      pillsContainer.querySelectorAll('.room-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          const x = Number(btn.getAttribute('data-x'));
          const y = Number(btn.getAttribute('data-y'));
          const name = btn.getAttribute('data-room-name');
          this.setUserLocation(x, y, name);
        });
      });
    }

    if (select) {
      select.innerHTML = ROOMS.map(r => `
        <option value="${Math.round((r.x1 + r.x2) / 2)},${Math.round((r.y1 + r.y2) / 2)}" ${r.name === this.userLocation.roomName ? 'selected' : ''}>
          ${r.name}
        </option>
      `).join('');

      select.addEventListener('change', (e) => {
        const [x, y] = e.target.value.split(',').map(Number);
        const name = e.target.options[e.target.selectedIndex].text.trim();
        this.setUserLocation(x, y, name);
      });
    }

    // 2. Telemetry mini drawer toggle
    const toggleBtn = document.getElementById('toggleTelemetryBtn');
    const drawer = document.getElementById('telemetryDrawer');
    const chevron = document.getElementById('telemetryChevron');
    if (toggleBtn && drawer) {
      toggleBtn.addEventListener('click', () => {
        drawer.classList.toggle('hidden');
        chevron?.classList.toggle('open');
      });
    }
  }

  setupEventListeners() {
    // Audio toggle button
    const btnAudio = document.getElementById('btnMobileAudio');
    const audioIcon = document.getElementById('audioIcon');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const enabled = this.audio.toggleAudio();
        if (audioIcon) {
          audioIcon.innerText = enabled ? '🔊' : '🔇';
        }
      });
    }

    // Settings Modal
    const btnOpenSettings = document.getElementById('btnOpenSettings');
    const btnCloseSettings = document.getElementById('btnCloseSettings');
    const modal = document.getElementById('settingsModal');
    const inputUrl = document.getElementById('inputEspMobileUrl');
    const btnSaveUrl = document.getElementById('btnSaveEspUrl');

    if (inputUrl) {
      inputUrl.value = this.espUrl;
    }

    if (btnOpenSettings && modal) {
      btnOpenSettings.addEventListener('click', () => modal.classList.remove('hidden'));
    }
    if (btnCloseSettings && modal) {
      btnCloseSettings.addEventListener('click', () => modal.classList.add('hidden'));
    }
    if (btnSaveUrl) {
      btnSaveUrl.addEventListener('click', () => {
        if (inputUrl) {
          let u = inputUrl.value.trim();
          if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
          if (!u.includes('/status')) u = u.replace(/\/+$/, '') + '/status';
          this.espUrl = u;
          localStorage.setItem('esp8266_mobile_url', u);
          modal?.classList.add('hidden');
          this.startAutoPolling();
        }
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    }

    // Phone Simulation Test Buttons
    const btnSimFire = document.getElementById('btnMobileSimFire');
    const btnSimClear = document.getElementById('btnMobileSimClear');
    if (btnSimFire) {
      btnSimFire.addEventListener('click', () => {
        this.mockOverride = true;
        this.telemetry.applyHardwareFireState(true, 'Room_1');
        this.updateSystem();
        modal?.classList.add('hidden');
      });
    }
    if (btnSimClear) {
      btnSimClear.addEventListener('click', () => {
        this.mockOverride = false;
        this.telemetry.applyHardwareFireState(false, 'Room_1');
        this.updateSystem();
        modal?.classList.add('hidden');
      });
    }

    // SOS Tools (Buzz, Strobe)
    const btnBuzz = document.getElementById('btnVibrateTest');
    if (btnBuzz) {
      btnBuzz.addEventListener('click', () => {
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 400]);
        } else {
          alert('Haptic vibration not supported on this browser/device.');
        }
      });
    }

    const btnStrobe = document.getElementById('btnFlashlight');
    const strobeOverlay = document.getElementById('strobeOverlay');
    if (btnStrobe && strobeOverlay) {
      btnStrobe.addEventListener('click', () => strobeOverlay.classList.remove('hidden'));
      strobeOverlay.addEventListener('click', () => strobeOverlay.classList.add('hidden'));
    }
  }

  onSensorsUpdated(sensors) {
    this.renderMiniSensorGrid(sensors);
  }

  renderMiniSensorGrid(sensors) {
    const grid = document.getElementById('miniSensorGrid');
    if (!grid) return;

    grid.innerHTML = sensors.map(s => {
      const isFire = s.status === 'FIRE';
      return `
        <div class="mini-sensor-card ${isFire ? 'fire' : ''}">
          <div class="mini-sensor-top">
            <span>${s.id}${s.id === 'S6' ? ' <small style="color:#c084fc;">(ESP8266)</small>' : ''}</span>
            <span style="color: ${isFire ? '#ef4444' : '#10b981'};">${isFire ? '🔥 FIRE' : '🟢 NORMAL'}</span>
          </div>
          <div class="mini-sensor-room">${s.room}</div>
          <div class="mini-sensor-readings">${s.smoke} ppm &bull; ${s.temp}°C</div>
        </div>
      `;
    }).join('');

    const activeFires = sensors.filter(s => s.status === 'FIRE');
    const summary = document.getElementById('telemetrySummaryText');
    if (summary) {
      if (activeFires.length > 0) {
        summary.innerHTML = `<strong style="color: #ef4444;">🔥 FIRE DETECTED:</strong> ${activeFires.map(f => f.id).join(', ')}`;
      } else {
        summary.innerText = 'All 8 Nodes: Normal &bull; Sensor 6 Synced';
      }
    }
  }

  updateSystem() {
    const activeFires = this.telemetry.getActiveFires();

    // 1. Update Danger Map
    this.dangerMap = calculateDangerMap(activeFires, this.baseGrid);

    // 2. Manage Status Banner & Emergency Card
    const statusBar = document.getElementById('buildingStatusBar');
    const statusHeadline = document.getElementById('statusHeadline');
    const statusSubline = document.getElementById('statusSubline');
    const emergencyCard = document.getElementById('emergencyCard');
    const fireSensorName = document.getElementById('fireSensorName');
    const fireSensorMeta = document.getElementById('fireSensorMeta');

    if (activeFires.length > 0) {
      statusBar.className = 'status-banner fire';
      statusHeadline.innerText = 'CRITICAL ALERT: FIRE DETECTED';
      statusSubline.innerText = `Evacuate building immediately! Threat in ${activeFires.map(f => f.room).join(', ')}`;
      emergencyCard.classList.remove('hidden');

      const s6Fire = activeFires.find(f => f.id === 'S6');
      if (s6Fire) {
        fireSensorName.innerText = 'Sensor 6 (Central Hallway) — Live ESP8266';
        fireSensorMeta.innerText = `Active Flame Detected &bull; Smoke: ${s6Fire.smoke} ppm &bull; Temp: ${s6Fire.temp}°C`;
      } else {
        const topFire = activeFires[0];
        fireSensorName.innerText = `${topFire.name} (${topFire.room})`;
        fireSensorMeta.innerText = `Smoke: ${topFire.smoke} ppm &bull; Temp: ${topFire.temp}°C &bull; Flame: ${topFire.flame ? 'YES' : 'NO'}`;
      }

      this.audio.startAlarm();
      if ('vibrate' in navigator) {
        navigator.vibrate([300, 150, 300, 150, 600]);
      }
    } else {
      statusBar.className = 'status-banner safe';
      statusHeadline.innerText = 'BUILDING STATUS: SAFE & CLEAR';
      statusSubline.innerText = 'All 8 sensor zones operational &bull; Corridors clear';
      emergencyCard.classList.add('hidden');
      this.audio.stopAlarm();
    }

    // 3. Recalculate A* Route from user location
    const routeResult = findSafestEvacuationRoute(
      { x: this.userLocation.x, y: this.userLocation.y },
      EXITS,
      this.baseGrid,
      this.dangerMap
    );

    this.currentRoute = routeResult.bestRoute;
    this.updateRouteGuidance(routeResult, activeFires);
  }

  updateRouteGuidance(routeResult, activeFires) {
    const routeTitle = document.getElementById('chosenExitTitle');
    const gateBadge = document.getElementById('exitGateBadge');
    const metricDistance = document.getElementById('metricDistance');
    const metricTime = document.getElementById('metricTime');
    const metricRisk = document.getElementById('metricRisk');
    const statusBadge = document.getElementById('routeStatusBadge');
    const list = document.getElementById('directionsList');

    if (!routeResult.success || !routeResult.bestRoute) {
      if (routeTitle) routeTitle.innerText = '⚠️ No Safe Exit Found';
      if (gateBadge) gateBadge.innerText = 'BLOCKED';
      if (metricRisk) {
        metricRisk.className = 'metric-val danger';
        metricRisk.innerText = 'EXTREME';
      }
      if (list) list.innerHTML = '<li class="direction-item"><span class="step-warning">All corridors compromised! Move to nearest safe room with exterior window.</span></li>';
      return;
    }

    const best = routeResult.bestRoute;
    const meters = Math.round(best.distance * 1.2);
    const seconds = Math.round(meters / 1.3);

    if (routeTitle) routeTitle.innerText = `Proceed to ${best.exit.label}`;
    if (gateBadge) {
      gateBadge.innerText = best.exit.id.replace('_', ' ');
      gateBadge.style.backgroundColor = best.exit.color;
    }
    if (metricDistance) metricDistance.innerText = `${meters} meters`;
    if (metricTime) metricTime.innerText = `~${seconds} sec`;

    if (metricRisk) {
      if (best.riskCost > 20) {
        metricRisk.className = 'metric-val danger';
        metricRisk.innerText = 'ELEVATED RISK';
      } else {
        metricRisk.className = 'metric-val safe';
        metricRisk.innerText = 'ZERO (SAFE)';
      }
    }

    if (statusBadge) {
      statusBadge.innerText = activeFires.length > 0 ? '🔥 SAFETY-WEIGHTED ESCAPE PATH' : 'SHORTEST DIRECT ROUTE';
    }

    // Generate Turn-by-Turn Directions
    if (list) {
      list.innerHTML = this.generateTurnByTurnSteps(best, activeFires);
    }
  }

  generateTurnByTurnSteps(route, activeFires) {
    const steps = [];
    steps.push(`Start from <strong>${this.userLocation.roomName || 'Current Location'}</strong>.`);

    const isCentralHallwayBurning = activeFires.some(f => f.id === 'S6');

    if (isCentralHallwayBurning) {
      steps.push('<span class="step-warning">⚠️ FIRE ALERT: Do NOT enter Central Hallway (Sensor 6 burning). Follow detour.</span>');
    }

    if (route.exit.id === 'EXIT_B') {
      steps.push('Follow corridor East towards the Electronics Lab wing.');
      steps.push('Pass clear of fire smoke plumes.');
      steps.push('Arrive at <strong>Emergency Exit B (East Exit)</strong> &amp; proceed outside.');
    } else if (route.exit.id === 'EXIT_C') {
      steps.push('Follow corridor West towards the Computer Lab stairwell.');
      steps.push('Pass clear of fire smoke plumes.');
      steps.push('Arrive at <strong>Stairwell Exit C (West Exit)</strong> &amp; proceed outside.');
    } else {
      steps.push('Head South towards the main entrance lobby.');
      steps.push('Arrive at <strong>Main Exit A (South Exit)</strong> &amp; proceed outside.');
    }

    return steps.map((st, idx) => `
      <li class="direction-item">
        <span class="step-number">${idx + 1}</span>
        <span>${st}</span>
      </li>
    `).join('');
  }

  startAutoPolling() {
    if (this.espWifiInterval) {
      clearInterval(this.espWifiInterval);
    }

    const poll = async () => {
      if (this.mockOverride) return;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);
        const res = await fetch(this.espUrl, {
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) return;
        const data = await res.json();
        const isFlame = (data.fire === true || data.fire === 'true' || data.fire === 1 || data.fire === '1');
        const s6 = this.telemetry.getSensor('S6');
        const isCurrentlyFire = Boolean(s6 && s6.status === 'FIRE');

        if (isFlame !== isCurrentlyFire || isFlame !== this.espFireIsActive) {
          this.espFireIsActive = isFlame;
          this.telemetry.applyHardwareFireState(isFlame, data.room || 'Room_1');
          this.updateSystem();
        }
      } catch (e) {
        // Quietly retry next tick
      }
    };

    poll();
    this.espWifiInterval = setInterval(poll, 500);
  }

  startRenderLoop() {
    const loop = () => {
      this.renderCanvas();
      this.animOffset = (this.animOffset + 0.3) % 20;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  renderCanvas() {
    const ctx = this.ctx;
    const cs = this.cellSize;
    if (!cs || cs <= 0) return;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Draw Grid Base & Walls
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const type = this.baseGrid[y][x];
        const cx = x * cs;
        const cy = y * cs;

        if (type === 1) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(cx, cy, cs, cs);
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(cx, cy, cs, cs);
        } else if (type === 2) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
          ctx.fillRect(cx, cy, cs, cs);
        } else if (type === 3) {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(cx, cy, cs, cs);
        } else {
          ctx.fillStyle = '#050811';
          ctx.fillRect(cx, cy, cs, cs);
        }
      }
    }

    // 2. Draw Fire Hazard Danger Heatmap
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const cell = this.dangerMap[y][x];
        if (cell.level > 0 && this.baseGrid[y][x] !== 1) {
          const cx = x * cs;
          const cy = y * cs;
          if (cell.level === 3) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
          } else if (cell.level === 2) {
            ctx.fillStyle = 'rgba(249, 115, 22, 0.55)';
          } else {
            ctx.fillStyle = 'rgba(234, 179, 8, 0.25)';
          }
          ctx.fillRect(cx, cy, cs, cs);
        }
      }
    }

    // 3. Draw Safe Animated Evacuation Route Ant-Trail
    if (this.currentRoute && this.currentRoute.path && this.currentRoute.path.length > 1) {
      const path = this.currentRoute.path;

      // Glow underlay
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = cs * 0.9;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(path[0].x * cs + cs / 2, path[0].y * cs + cs / 2);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x * cs + cs / 2, path[i].y * cs + cs / 2);
      }
      ctx.stroke();

      // Sharp glowing route with animated dash
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = Math.max(2, cs * 0.45);
      ctx.setLineDash([cs * 0.8, cs * 0.6]);
      ctx.lineDashOffset = -this.animOffset;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Draw Exits
    for (const e of EXITS) {
      const ex = e.x * cs + cs / 2;
      const ey = e.y * cs + cs / 2;
      ctx.fillStyle = e.color || '#10b981';
      ctx.beginPath();
      ctx.arc(ex, ey, cs * 0.75, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.max(7, cs * 0.5)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.id.replace('EXIT_', ''), ex, ey);
    }

    // 5. Draw Sensors (S1 to S8)
    for (const s of this.telemetry.getAllSensors()) {
      const sx = s.x * cs + cs / 2;
      const sy = s.y * cs + cs / 2;
      const isFire = s.status === 'FIRE';

      if (isFire) {
        // Pulsing flame marker
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.beginPath();
        ctx.arc(sx, sy, cs * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(sx, sy, cs * 0.7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = `${Math.max(8, cs * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔥', sx, sy);
      } else {
        ctx.fillStyle = s.id === 'S6' ? '#a855f7' : '#10b981';
        ctx.beginPath();
        ctx.arc(sx, sy, cs * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Draw User Location Pin
    const ux = this.userLocation.x * cs + cs / 2;
    const uy = this.userLocation.y * cs + cs / 2;

    // Glowing halo
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.beginPath();
    ctx.arc(ux, uy, cs * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Solid blue pin
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(ux, uy, cs * 0.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#040812';
    ctx.font = `bold ${Math.max(7, cs * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOU', ux, uy);
  }
}

// Bootstrap on Mobile DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.mobileApp = new MobileEvacuationApp();
});
