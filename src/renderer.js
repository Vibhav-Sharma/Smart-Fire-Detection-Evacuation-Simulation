/**
 * Architectural Floor Plan & Evacuation Canvas Renderer
 * High-DPI responsive renderer for rooms, walls, sensors, danger heatmaps,
 * animated evacuation paths, and A* algorithm visualization.
 */

import { GRID_COLS, GRID_ROWS, ROOMS, EXITS } from './mapData.js';

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.cellSize = 22;
    this.width = GRID_COLS * this.cellSize;
    this.height = GRID_ROWS * this.cellSize;

    this.animTime = 0;
    this.dashOffset = 0;
    this.hoverCell = null;

    this.initCanvasSize();
    this.setupResizeListener();
  }

  initCanvasSize() {
    const dpr = window.devicePixelRatio || 1;
    // Base resolution
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.scale(dpr, dpr);
  }

  setupResizeListener() {
    window.addEventListener('resize', () => {
      // Re-scale if needed for responsive layouts
      const container = this.canvas.parentElement;
      if (container) {
        const availWidth = container.clientWidth - 24;
        if (availWidth < this.width) {
          const scale = availWidth / this.width;
          this.canvas.style.width = `${this.width * scale}px`;
          this.canvas.style.height = `${this.height * scale}px`;
        } else {
          this.canvas.style.width = `${this.width}px`;
          this.canvas.style.height = `${this.height}px`;
        }
      }
    });
  }

  render(state) {
    this.animTime += 0.035;
    this.dashOffset = (this.dashOffset - 0.7) % 24;

    const ctx = this.ctx;
    const { baseGrid, dangerMap, sensors, occupants, currentRoute, previousRoute, aStarTraceState, showAStarViz } = state;

    // 1. Clear background
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Room Floor tints and architectural zones
    this.renderRooms(ctx);

    // 3. Grid line accents (subtle floor tiles)
    this.renderGridLines(ctx);

    // 4. Danger Zones & Heatmaps
    this.renderDangerHeatmap(ctx, dangerMap);

    // 5. A* Algorithm Step Visualization Overlay (if active)
    if (showAStarViz && aStarTraceState) {
      this.renderAStarTrace(ctx, aStarTraceState);
    }

    // 6. Structural Walls & Doors
    this.renderWallsAndDoors(ctx, baseGrid);

    // 7. Emergency Exits
    this.renderExits(ctx);

    // 8. Previous Compromised Route (if fire active)
    if (previousRoute && dangerMap) {
      this.renderCompromisedPreFireRoute(ctx, previousRoute, dangerMap);
    }

    // 9. Current Active Evacuation Route
    if (currentRoute && currentRoute.path && currentRoute.path.length > 0) {
      this.renderEvacuationPath(ctx, currentRoute);
    }

    // 9. Sensor Nodes
    this.renderSensors(ctx, sensors);

    // 10. Occupants / People
    this.renderOccupants(ctx, occupants);

    // 11. Mouse Hover Inspection Highlight
    if (this.hoverCell) {
      this.renderHoverHighlight(ctx, this.hoverCell, baseGrid, dangerMap);
    }
  }

  renderRooms(ctx) {
    for (const room of ROOMS) {
      const rx = room.x1 * this.cellSize;
      const ry = room.y1 * this.cellSize;
      const rw = (room.x2 - room.x1 + 1) * this.cellSize;
      const rh = (room.y2 - room.y1 + 1) * this.cellSize;

      // Subtle room backdrop tint
      ctx.fillStyle = room.id.includes('lab') ? 'rgba(15, 23, 42, 0.75)' :
                      room.id.includes('server') ? 'rgba(19, 27, 46, 0.85)' :
                      room.id.includes('corridor') ? 'rgba(11, 15, 25, 0.4)' :
                      'rgba(15, 23, 42, 0.6)';
      ctx.fillRect(rx, ry, rw, rh);

      // Room border accent
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, rw, rh);

      // Room Name Label
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(room.name.toUpperCase(), rx + 7, ry + 6);
    }
  }

  renderGridLines(ctx) {
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.25)';
    ctx.lineWidth = 0.5;

    ctx.beginPath();
    for (let x = 0; x <= GRID_COLS; x++) {
      ctx.moveTo(x * this.cellSize, 0);
      ctx.lineTo(x * this.cellSize, this.height);
    }
    for (let y = 0; y <= GRID_ROWS; y++) {
      ctx.moveTo(0, y * this.cellSize);
      ctx.lineTo(this.width, y * this.cellSize);
    }
    ctx.stroke();
  }

  renderDangerHeatmap(ctx, dangerMap) {
    if (!dangerMap) return;

    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const cell = dangerMap[y][x];
        if (!cell || cell.level === 'SAFE') continue;

        const cx = x * this.cellSize;
        const cy = y * this.cellSize;

        if (cell.level === 'FIRE') {
          // Epicenter fire cell
          const pulse = Math.sin(this.animTime * 6) * 0.15 + 0.85;
          ctx.fillStyle = `rgba(220, 38, 38, ${0.8 * pulse})`;
          ctx.fillRect(cx, cy, this.cellSize, this.cellSize);

          // Flame icon overlay
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🔥', cx + this.cellSize / 2, cy + this.cellSize / 2);
        } else if (cell.level === 'EXTREME') {
          const pulse = Math.sin(this.animTime * 4 + x + y) * 0.1 + 0.45;
          ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
          ctx.fillRect(cx, cy, this.cellSize, this.cellSize);
        } else if (cell.level === 'DANGER') {
          ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
          ctx.fillRect(cx, cy, this.cellSize, this.cellSize);
        } else if (cell.level === 'CAUTION') {
          ctx.fillStyle = 'rgba(234, 179, 8, 0.2)';
          ctx.fillRect(cx, cy, this.cellSize, this.cellSize);
        }
      }
    }
  }

  renderWallsAndDoors(ctx, baseGrid) {
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const val = baseGrid[y][x];
        const cx = x * this.cellSize;
        const cy = y * this.cellSize;

        if (val === 1) {
          // Structural Wall: high-tech slate block with subtle glow
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(cx, cy, this.cellSize, this.cellSize);

          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx + 0.5, cy + 0.5, this.cellSize - 1, this.cellSize - 1);
        } else if (val === 2) {
          // Doorway
          ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
          ctx.fillRect(cx, cy, this.cellSize, this.cellSize);

          ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.strokeRect(cx + 1, cy + 1, this.cellSize - 2, this.cellSize - 2);
          ctx.setLineDash([]);
        }
      }
    }
  }

  renderExits(ctx) {
    for (const exit of EXITS) {
      const cx = exit.x * this.cellSize;
      const cy = exit.y * this.cellSize;

      // Glow halo
      const pulse = Math.sin(this.animTime * 3) * 0.2 + 0.8;
      ctx.fillStyle = exit.color === '#10b981' ? `rgba(16, 185, 129, ${0.4 * pulse})` :
                      exit.color === '#06b6d4' ? `rgba(6, 182, 212, ${0.4 * pulse})` :
                      `rgba(168, 85, 247, ${0.4 * pulse})`;
      ctx.fillRect(cx - 2, cy - 2, this.cellSize + 4, this.cellSize + 4);

      // Exit Body
      ctx.fillStyle = exit.color;
      ctx.fillRect(cx, cy, this.cellSize, this.cellSize);

      // Exit Label badge
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚪', cx + this.cellSize / 2, cy + this.cellSize / 2);

      // Outer caption positioned cleanly above or below portal
      ctx.fillStyle = exit.color;
      ctx.font = '700 9.5px Inter, sans-serif';
      if (exit.y >= GRID_ROWS - 2) {
        ctx.textAlign = 'center';
        ctx.fillText(exit.name, cx + this.cellSize / 2, cy - 8);
      } else if (exit.x <= 2) {
        ctx.textAlign = 'left';
        ctx.fillText(exit.name, cx + 2, cy - 8);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(exit.name, cx + this.cellSize - 2, cy - 8);
      }
    }
  }

  renderCompromisedPreFireRoute(ctx, previousRoute, dangerMap) {
    if (!previousRoute || !previousRoute.path || previousRoute.path.length < 2) return;
    const path = previousRoute.path;

    // Ghosted dashed red/gray trail showing old route
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const px = path[i].x * this.cellSize + this.cellSize / 2;
      const py = path[i].y * this.cellSize + this.cellSize / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Find first point where the pre-fire path hits the danger zone and draw a red X
    let markedX = false;
    for (let i = 0; i < path.length; i++) {
      const node = path[i];
      const danger = dangerMap[node.y][node.x];
      if (danger && (danger.isBlocked || danger.penalty > 10) && !markedX) {
        const px = node.x * this.cellSize + this.cellSize / 2;
        const py = node.y * this.cellSize + this.cellSize / 2;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❌', px, py);
        markedX = true;
      }
    }
  }

  renderEvacuationPath(ctx, currentRoute) {
    const path = currentRoute.path;
    if (!path || path.length < 2) return;

    // Glowing underlying track
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const px = path[i].x * this.cellSize + this.cellSize / 2;
      const py = path[i].y * this.cellSize + this.cellSize / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Animated dash ant-trail
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const px = path[i].x * this.cellSize + this.cellSize / 2;
      const py = path[i].y * this.cellSize + this.cellSize / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = currentRoute.riskCost > 20 ? '#f59e0b' : '#10b981';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = this.dashOffset;
    ctx.stroke();
    ctx.setLineDash([]);

    // Route waypoint dots
    for (let i = 0; i < path.length; i += 3) {
      const px = path[i].x * this.cellSize + this.cellSize / 2;
      const py = path[i].y * this.cellSize + this.cellSize / 2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderSensors(ctx, sensors) {
    for (const s of sensors) {
      const cx = s.x * this.cellSize + this.cellSize / 2;
      const cy = s.y * this.cellSize + this.cellSize / 2;
      const isFire = s.status === 'FIRE';
      const isPreAlarm = s.status === 'PRE_ALARM';

      if (isFire) {
        // Pulsing radar alarm wave
        const waveRadius = ((this.animTime * 30) % 28) + 8;
        const waveAlpha = Math.max(0, 1 - waveRadius / 28);
        ctx.strokeStyle = `rgba(239, 68, 68, ${waveAlpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, waveRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Fire node body
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.id, cx, cy);
      } else if (isPreAlarm) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.id, cx, cy);
      } else {
        // Normal Sensor Node (sleek green emerald beacon)
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(cx, cy, 7.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 8.5px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.id, cx, cy);
      }

      // Render hardware tag for physical ESP8266 node
      if (s.isHardware || s.id === 'S6') {
        ctx.fillStyle = isFire ? '#fca5a5' : '#c084fc';
        ctx.font = 'bold 7.5px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ESP8266', cx, cy - 11);
      }
    }
  }

  renderOccupants(ctx, occupants) {
    for (const occ of occupants) {
      const cx = occ.x * this.cellSize + this.cellSize / 2;
      const cy = occ.y * this.cellSize + this.cellSize / 2;

      // Glow halo
      ctx.fillStyle = occ.color ? `${occ.color}44` : 'rgba(56, 189, 248, 0.3)';
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();

      // Occupant Marker
      ctx.fillStyle = occ.color || '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Badge ID
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(occ.id, cx, cy);

      // Label below
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 9px Inter, sans-serif';
      ctx.fillText(occ.name, cx, cy + 16);
    }
  }

  renderAStarTrace(ctx, traceState) {
    if (!traceState) return;

    // Closed Set (Explored nodes in soft purple)
    if (traceState.closedList) {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
      for (const node of traceState.closedList) {
        ctx.fillRect(node.x * this.cellSize + 2, node.y * this.cellSize + 2, this.cellSize - 4, this.cellSize - 4);
      }
    }

    // Open Set (Nodes waiting to be evaluated in glowing cyan/amber)
    if (traceState.openList) {
      ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
      ctx.lineWidth = 1;
      for (const node of traceState.openList) {
        const nx = node.x * this.cellSize + 2;
        const ny = node.y * this.cellSize + 2;
        ctx.fillRect(nx, ny, this.cellSize - 4, this.cellSize - 4);
        ctx.strokeRect(nx, ny, this.cellSize - 4, this.cellSize - 4);
      }
    }

    // Current Node being evaluated
    if (traceState.node) {
      const cx = traceState.node.x * this.cellSize;
      const cy = traceState.node.y * this.cellSize;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(cx + 1, cy + 1, this.cellSize - 2, this.cellSize - 2);
    }
  }

  renderHoverHighlight(ctx, cell, baseGrid, dangerMap) {
    const cx = cell.x * this.cellSize;
    const cy = cell.y * this.cellSize;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, this.cellSize, this.cellSize);
  }

  getGridCoordinatesFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const x = Math.floor((clientX * scaleX) / this.cellSize);
    const y = Math.floor((clientY * scaleY) / this.cellSize);

    if (x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS) {
      return { x, y };
    }
    return null;
  }
}
