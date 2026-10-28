/**
 * True A* Pathfinding Algorithm Engine
 * Features:
 *   - Safety-Weighted Cost Function: f(n) = g(n) + h(n)
 *   - Multi-Exit Safety Optimization (selects lowest risk-weighted route, not just shortest)
 *   - Step-by-Step Viva Trace Generator (Open Set, Closed Set, f/g/h metrics)
 */

import { GRID_COLS, GRID_ROWS } from './mapData.js';

// Direction vectors for 4-connected grid (Up, Down, Left, Right)
const DIRS = [
  { dx: 0, dy: -1 }, // North
  { dx: 1, dy: 0 },  // East
  { dx: 0, dy: 1 },  // South
  { dx: -1, dy: 0 }  // West
];

/**
 * Standard Manhattan Distance Heuristic
 */
function heuristic(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * Executes full A* search from start to a single target exit.
 *
 * @param {{x: number, y: number}} start
 * @param {{x: number, y: number, id: string, name: string}} goal
 * @param {Array<Array<number>>} baseGrid
 * @param {Array<Array<any>; >} dangerMap
 * @returns {null | {path: Array<{x, y}>, totalCost: number, riskCost: number, distance: number, openCount: number, closedCount: number}}
 */
export function aStarSingle(start, goal, baseGrid, dangerMap) {
  const startKey = `${start.x},${start.y}`;
  const goalKey = `${goal.x},${goal.y}`;

  // Priority Queue / Open Set stored as array with quick lowest-f lookup
  const openSet = [];
  const openSetKeys = new Set([startKey]);
  const closedSet = new Set();

  // Maps for scores and parent tracking
  const gScore = new Map();
  const fScore = new Map();
  const cameFrom = new Map();
  const riskOnPath = new Map();

  // Initial node
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(start.x, start.y, goal.x, goal.y));
  riskOnPath.set(startKey, 0);

  openSet.push({
    x: start.x,
    y: start.y,
    f: fScore.get(startKey),
    g: 0,
    h: fScore.get(startKey)
  });

  while (openSet.length > 0) {
    // 1. Extract node with lowest fScore (tie-break on lowest hScore)
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (
        openSet[i].f < openSet[lowestIdx].f ||
        (openSet[i].f === openSet[lowestIdx].f && openSet[i].h < openSet[lowestIdx].h)
      ) {
        lowestIdx = i;
      }
    }

    const current = openSet.splice(lowestIdx, 1)[0];
    const currentKey = `${current.x},${current.y}`;
    openSetKeys.delete(currentKey);

    // Goal reached
    if (current.x === goal.x && current.y === goal.y) {
      const path = [];
      let traceKey = currentKey;
      let totalRisk = 0;

      while (traceKey) {
        const [tx, ty] = traceKey.split(',').map(Number);
        path.unshift({ x: tx, y: ty });
        const dangerInfo = dangerMap[ty][tx];
        totalRisk += dangerInfo ? dangerInfo.penalty : 0;
        traceKey = cameFrom.get(traceKey);
      }

      return {
        path,
        totalCost: gScore.get(currentKey),
        riskCost: totalRisk,
        distance: path.length,
        openCount: openSet.length,
        closedCount: closedSet.size
      };
    }

    closedSet.add(currentKey);

    // 2. Evaluate 4-way neighbors
    for (const dir of DIRS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const neighborKey = `${nx},${ny}`;

      // Boundary check
      if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;

      // Closed set check
      if (closedSet.has(neighborKey)) continue;

      // Structural wall check
      if (baseGrid[ny][nx] === 1) continue;

      // Danger check: Fire epicenters are impassable
      const dangerInfo = dangerMap[ny][nx];
      if (dangerInfo && dangerInfo.isBlocked) continue;

      // Step cost: Base movement (1) + dynamic risk penalty (0 to 35)
      const stepPenalty = dangerInfo ? dangerInfo.penalty : 0;
      const stepCost = 1 + stepPenalty;
      const tentativeG = gScore.get(currentKey) + stepCost;

      const existingG = gScore.has(neighborKey) ? gScore.get(neighborKey) : Infinity;

      if (tentativeG < existingG) {
        cameFrom.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentativeG);
        const h = heuristic(nx, ny, goal.x, goal.y);
        const f = tentativeG + h;
        fScore.set(neighborKey, f);
        riskOnPath.set(neighborKey, (riskOnPath.get(currentKey) || 0) + stepPenalty);

        if (!openSetKeys.has(neighborKey)) {
          openSet.push({ x: nx, y: ny, f, g: tentativeG, h });
          openSetKeys.add(neighborKey);
        } else {
          // Update in openSet array
          const idx = openSet.findIndex(n => n.x === nx && n.y === ny);
          if (idx !== -1) {
            openSet[idx].f = f;
            openSet[idx].g = tentativeG;
            openSet[idx].h = h;
          }
        }
      }
    }
  }

  // No path exists
  return null;
}

/**
 * Evaluates all available emergency exits and selects the route with lowest TOTAL COST.
 * Demonstrates "Shortest path ≠ safest path" by providing side-by-side exit evaluations.
 *
 * @param {{x: number, y: number}} start
 * @param {Array<{id: string, name: string, x: number, y: number, label: string, color: string}>} exits
 * @param {Array<Array<number>>} baseGrid
 * @param {Array<Array<any>>} dangerMap
 */
export function findSafestEvacuationRoute(start, exits, baseGrid, dangerMap) {
  const evaluations = [];

  for (const exit of exits) {
    const result = aStarSingle(start, exit, baseGrid, dangerMap);
    if (result) {
      evaluations.push({
        exit,
        accessible: true,
        path: result.path,
        totalCost: result.totalCost,
        riskCost: result.riskCost,
        distance: result.distance,
        // Calculate estimated evacuation time (assuming ~1.2m per cell and 1.5m/s walking speed, slowed by smoke)
        estimatedTimeSec: Math.round(result.distance * 0.8 + result.riskCost * 0.15)
      });
    } else {
      evaluations.push({
        exit,
        accessible: false,
        path: null,
        totalCost: Infinity,
        riskCost: Infinity,
        distance: Infinity,
        estimatedTimeSec: Infinity
      });
    }
  }

  // Filter accessible routes
  const accessibleRoutes = evaluations.filter(e => e.accessible);

  if (accessibleRoutes.length === 0) {
    return {
      success: false,
      bestRoute: null,
      evaluations,
      message: 'NO SAFE EVACUATION ROUTE AVAILABLE - ALL EXITS BLOCKED BY FIRE'
    };
  }

  // Sort by lowest totalCost (combined distance + danger risk)
  accessibleRoutes.sort((a, b) => a.totalCost - b.totalCost);

  const bestRoute = accessibleRoutes[0];

  return {
    success: true,
    bestRoute,
    evaluations,
    message: `Safest path routed to ${bestRoute.exit.name} (Risk Score: ${bestRoute.riskCost}, Total Cost: ${bestRoute.totalCost})`
  };
}

/**
 * Generates an animated exploration step trace for Viva examinations.
 * Records OPEN set, CLOSED set, and current node at every iteration.
 */
export function generateAStarTrace(start, goal, baseGrid, dangerMap, maxSteps = 1200) {
  const trace = [];
  const startKey = `${start.x},${start.y}`;

  const openSet = [];
  const openSetMap = new Map();
  const closedSet = new Set();
  const gScore = new Map();
  const fScore = new Map();
  const cameFrom = new Map();

  gScore.set(startKey, 0);
  const startH = heuristic(start.x, start.y, goal.x, goal.y);
  fScore.set(startKey, startH);

  const startNode = { x: start.x, y: start.y, f: startH, g: 0, h: startH };
  openSet.push(startNode);
  openSetMap.set(startKey, startNode);

  trace.push({
    action: 'INITIALIZE',
    node: startNode,
    openList: [startNode],
    closedList: [],
    finalPath: null
  });

  let steps = 0;

  while (openSet.length > 0 && steps < maxSteps) {
    steps++;

    // Lowest f-score
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (
        openSet[i].f < openSet[lowestIdx].f ||
        (openSet[i].f === openSet[lowestIdx].f && openSet[i].h < openSet[lowestIdx].h)
      ) {
        lowestIdx = i;
      }
    }

    const current = openSet.splice(lowestIdx, 1)[0];
    const currentKey = `${current.x},${current.y}`;
    openSetMap.delete(currentKey);

    // Record EVALUATE step
    trace.push({
      action: 'EVALUATING',
      node: current,
      openList: [...openSet],
      closedList: Array.from(closedSet).map(k => {
        const [cx, cy] = k.split(',').map(Number);
        return { x: cx, y: cy };
      }),
      finalPath: null
    });

    // Check goal
    if (current.x === goal.x && current.y === goal.y) {
      const finalPath = [];
      let curr = currentKey;
      while (curr) {
        const [cx, cy] = curr.split(',').map(Number);
        finalPath.unshift({ x: cx, y: cy });
        curr = cameFrom.get(curr);
      }

      trace.push({
        action: 'GOAL_REACHED',
        node: current,
        openList: [...openSet],
        closedList: Array.from(closedSet).map(k => {
          const [cx, cy] = k.split(',').map(Number);
          return { x: cx, y: cy };
        }),
        finalPath
      });
      break;
    }

    closedSet.add(currentKey);

    // Expand neighbors
    for (const dir of DIRS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const nKey = `${nx},${ny}`;

      if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
      if (closedSet.has(nKey)) continue;
      if (baseGrid[ny][nx] === 1) continue;

      const dangerInfo = dangerMap[ny][nx];
      if (dangerInfo && dangerInfo.isBlocked) continue;

      const stepPenalty = dangerInfo ? dangerInfo.penalty : 0;
      const tentativeG = gScore.get(currentKey) + 1 + stepPenalty;
      const existingG = gScore.has(nKey) ? gScore.get(nKey) : Infinity;

      if (tentativeG < existingG) {
        cameFrom.set(nKey, currentKey);
        gScore.set(nKey, tentativeG);
        const h = heuristic(nx, ny, goal.x, goal.y);
        const f = tentativeG + h;
        fScore.set(nKey, f);

        const neighborNode = { x: nx, y: ny, f, g: tentativeG, h, penalty: stepPenalty };

        if (!openSetMap.has(nKey)) {
          openSet.push(neighborNode);
          openSetMap.set(nKey, neighborNode);
        } else {
          const idx = openSet.findIndex(n => n.x === nx && n.y === ny);
          if (idx !== -1) {
            openSet[idx] = neighborNode;
          }
        }
      }
    }
  }

  return trace;
}
