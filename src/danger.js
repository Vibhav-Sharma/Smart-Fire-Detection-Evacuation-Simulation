/**
 * Dynamic Danger Zone & Risk Modeling
 * Calculates fire spread, temperature/smoke proximity penalties,
 * and safety cost overlays for the A* pathfinding engine.
 */

import { GRID_COLS, GRID_ROWS } from './mapData.js';

export const RISK_LEVELS = {
  SAFE: { label: 'Safe', color: 'transparent', penalty: 0 },
  CAUTION: { label: 'Caution (Smoke)', color: 'rgba(234, 179, 8, 0.28)', penalty: 5 },
  DANGER: { label: 'Danger (High Heat)', color: 'rgba(249, 115, 22, 0.45)', penalty: 16 },
  EXTREME: { label: 'Extreme (Toxic Gas)', color: 'rgba(239, 68, 68, 0.65)', penalty: 35 },
  FIRE: { label: 'Active Fire (Blocked)', color: 'rgba(220, 38, 38, 0.95)', penalty: 999999 }
};

/**
 * Computes a 2D matrix of risk penalties and blocked states based on all active fire epicenters.
 *
 * @param {Array<{id: string, x: number, y: number}>} activeFires - Active fire sensor epicenters
 * @param {Array<Array<number>>} baseGrid - Base architectural grid
 * @returns {Array<Array<{level: string, penalty: number, isBlocked: boolean, color: string}>>}
 */
export function calculateDangerMap(activeFires, baseGrid) {
  const dangerMap = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => ({
      level: 'SAFE',
      penalty: 0,
      isBlocked: false,
      color: 'transparent'
    }))
  );

  if (!activeFires || activeFires.length === 0) {
    return dangerMap;
  }

  // Evaluate each cell's cumulative risk from all fires
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      // Wall cells are already blocked structurally
      if (baseGrid[y][x] === 1) {
        dangerMap[y][x].isBlocked = true;
        continue;
      }

      let totalPenalty = 0;
      let isFire = false;
      let maxSeverity = 'SAFE';

      for (const fire of activeFires) {
        const dx = x - fire.x;
        const dy = y - fire.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Fire Epicenter (direct sensor cell + immediate 1-cell perimeter)
        if (dist <= 1.2) {
          isFire = true;
          maxSeverity = 'FIRE';
          totalPenalty = RISK_LEVELS.FIRE.penalty;
          break; // Epicenter immediately sets maximum blocked penalty
        } else if (dist <= 2.8) {
          totalPenalty += RISK_LEVELS.EXTREME.penalty;
          if (maxSeverity !== 'FIRE') maxSeverity = 'EXTREME';
        } else if (dist <= 4.8) {
          totalPenalty += RISK_LEVELS.DANGER.penalty;
          if (maxSeverity !== 'FIRE' && maxSeverity !== 'EXTREME') maxSeverity = 'DANGER';
        } else if (dist <= 7.0) {
          totalPenalty += RISK_LEVELS.CAUTION.penalty;
          if (maxSeverity === 'SAFE') maxSeverity = 'CAUTION';
        }
      }

      dangerMap[y][x] = {
        level: maxSeverity,
        penalty: totalPenalty,
        isBlocked: isFire,
        color: RISK_LEVELS[maxSeverity].color
      };
    }
  }

  return dangerMap;
}

/**
 * Returns descriptive human-readable safety classification for a given score.
 */
export function formatRiskScore(riskScore) {
  if (riskScore === 0) return { label: 'Optimal Safe', badgeClass: 'safe' };
  if (riskScore < 20) return { label: 'Low Risk', badgeClass: 'safe' };
  if (riskScore < 50) return { label: 'Moderate Caution', badgeClass: 'caution' };
  if (riskScore < 100) return { label: 'High Hazard', badgeClass: 'danger' };
  return { label: 'Severe / Impassable', badgeClass: 'extreme' };
}
