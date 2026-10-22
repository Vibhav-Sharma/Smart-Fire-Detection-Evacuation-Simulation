/**
 * Building Floor Plan & Grid Geometry
 * Grid Dimensions: 42 columns (X: 0..41) x 26 rows (Y: 0..25)
 * Cell Types:
 *   0: Walkable floor
 *   1: Structural wall
 *   2: Doorway (Walkable)
 *   3: Emergency Exit (Goal)
 */

export const GRID_COLS = 42;
export const GRID_ROWS = 26;

// Room definitions with bounds and friendly names
export const ROOMS = [
  { id: 'comp_lab', name: 'Computer Lab', x1: 2, y1: 2, x2: 17, y2: 9, sensorId: 'S1' },
  { id: 'elec_lab', name: 'Electronics Lab', x1: 23, y1: 2, x2: 39, y2: 9, sensorId: 'S2' },
  { id: 'corridor_n', name: 'North Crossway', x1: 18, y1: 2, x2: 22, y2: 9 },
  { id: 'corridor_c', name: 'Central Hallway', x1: 2, y1: 10, x2: 39, y2: 13, sensorId: 'S6' },
  { id: 'class_1', name: 'Classroom 1', x1: 2, y1: 14, x2: 13, y2: 19, sensorId: 'S7' },
  { id: 'class_2', name: 'Classroom 2', x1: 15, y1: 14, x2: 26, y2: 19, sensorId: 'S8' },
  { id: 'server_room', name: 'Server Room', x1: 28, y1: 14, x2: 39, y2: 19, sensorId: 'S3' },
  { id: 'faculty_rm', name: 'Faculty Room', x1: 2, y1: 20, x2: 13, y2: 24, sensorId: 'S4' },
  { id: 'storage_rm', name: 'Storage Room', x1: 28, y1: 20, x2: 39, y2: 24, sensorId: 'S5' },
  { id: 'lobby_s', name: 'South Lobby', x1: 15, y1: 20, x2: 26, y2: 24 },
];

export const SENSORS = [
  { id: 'S1', name: 'Sensor 1', room: 'Computer Lab', x: 9, y: 5 },
  { id: 'S2', name: 'Sensor 2', room: 'Electronics Lab', x: 31, y: 5 },
  { id: 'S3', name: 'Sensor 3', room: 'Server Room', x: 33, y: 16 },
  { id: 'S4', name: 'Sensor 4', room: 'Faculty Room', x: 7, y: 22 },
  { id: 'S5', name: 'Sensor 5', room: 'Storage Room', x: 34, y: 22 },
  { id: 'S6', name: 'Sensor 6 (ESP8266)', room: 'Central Hallway', x: 20, y: 11, isHardware: true },
  { id: 'S7', name: 'Sensor 7', room: 'Classroom 1', x: 7, y: 16 },
  { id: 'S8', name: 'Sensor 8', room: 'Classroom 2', x: 20, y: 16 }
];

// Exits configuration
export const EXITS = [
  { id: 'EXIT_A', name: 'Main Exit A', x: 20, y: 25, label: 'EXIT A (South)', color: '#10b981' },
  { id: 'EXIT_B', name: 'Emergency Exit B', x: 41, y: 11, label: 'EXIT B (East)', color: '#06b6d4' },
  { id: 'EXIT_C', name: 'Stairwell Exit C', x: 0, y: 11, label: 'EXIT C (West)', color: '#a855f7' }
];

// Initial Occupants positioned strategically across building sectors
export const DEFAULT_OCCUPANTS = [
  { id: 'P1', name: 'Person 1', x: 20, y: 11, color: '#38bdf8', active: true, room: 'Central Hallway' },
  { id: 'P2', name: 'Person 2', x: 7, y: 17, color: '#f43f5e', active: false, room: 'Classroom 1' },
  { id: 'P3', name: 'Person 3', x: 33, y: 6, color: '#eab308', active: false, room: 'Electronics Lab' }
];

/**
 * Creates the base grid matrix with walls, rooms, doors and exits.
 * 0: Walkable floor
 * 1: Wall (impassable)
 * 2: Door (walkable)
 * 3: Exit (goal)
 */
export function createBaseGrid() {
  const grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));

  // 1. Perimeter Walls
  for (let x = 0; x < GRID_COLS; x++) {
    grid[0][x] = 1;
    grid[GRID_ROWS - 1][x] = 1;
  }
  for (let y = 0; y < GRID_ROWS; y++) {
    grid[y][0] = 1;
    grid[y][GRID_COLS - 1] = 1;
  }

  // 2. Horizontal dividing wall below top labs (y = 9)
  for (let x = 1; x < GRID_COLS - 1; x++) {
    grid[9][x] = 1;
  }
  // Doorways from top labs into Central Hallway & North corridor
  grid[9][9] = 2;   // Computer Lab South Door
  grid[9][10] = 2;
  grid[9][20] = 2;  // North Crossway Corridor opening
  grid[9][21] = 2;
  grid[9][30] = 2;  // Electronics Lab South Door
  grid[9][31] = 2;

  // Vertical wall between Comp Lab and North crossway (x = 17, y: 1..9)
  for (let y = 1; y < 9; y++) grid[y][17] = 1;
  grid[5][17] = 2; // Doorway east of Comp Lab

  // Vertical wall between North crossway and Electronics Lab (x = 23, y: 1..9)
  for (let y = 1; y < 9; y++) grid[y][23] = 1;
  grid[5][23] = 2; // Doorway west of Elec Lab

  // 3. Central Hallway (y: 10..13) is a wide open artery
  // Horizontal wall below Central Hallway (y = 13)
  for (let x = 1; x < GRID_COLS - 1; x++) {
    grid[13][x] = 1;
  }
  // Doorways from Central Hallway into Middle rooms
  grid[13][7] = 2;   // Classroom 1 North Door
  grid[13][8] = 2;
  grid[13][20] = 2;  // Classroom 2 / Central hallway connection
  grid[13][21] = 2;
  grid[13][32] = 2;  // Server Room North Door
  grid[13][33] = 2;

  // 4. Middle Section vertical walls (y: 14..19)
  // Wall between Classroom 1 and Classroom 2 (x = 14)
  for (let y = 14; y < 20; y++) grid[y][14] = 1;
  grid[16][14] = 2; // Door between classrooms

  // Wall between Classroom 2 and Server Room (x = 27)
  for (let y = 14; y < 20; y++) grid[y][27] = 1;
  // Server Room accessed via hallway door

  // 5. Horizontal wall below middle section (y = 19)
  for (let x = 1; x < GRID_COLS - 1; x++) {
    grid[19][x] = 1;
  }
  // Doorways into bottom section
  grid[19][7] = 2;   // Faculty Room North Door
  grid[19][8] = 2;
  grid[19][20] = 2;  // South Lobby connection
  grid[19][21] = 2;
  grid[19][32] = 2;  // Storage Room North Door
  grid[19][33] = 2;

  // 6. Bottom Section vertical walls (y: 20..24)
  // Wall between Faculty room and South Lobby (x = 14)
  for (let y = 20; y < GRID_ROWS - 1; y++) grid[y][14] = 1;
  grid[22][14] = 2; // Door into lobby

  // Wall between South Lobby and Storage room (x = 27)
  for (let y = 20; y < GRID_ROWS - 1; y++) grid[y][27] = 1;
  grid[22][27] = 2; // Door into storage

  // 7. Install Exits in perimeter walls (Walkable exit portals)
  // EXIT A: South main exit
  grid[25][20] = 3;
  grid[25][21] = 3;

  // EXIT B: East emergency exit
  grid[11][41] = 3;
  grid[12][41] = 3;

  // EXIT C: West stairwell exit
  grid[11][0] = 3;
  grid[12][0] = 3;

  return grid;
}

/**
 * Returns room info for any given cell coordinate.
 */
export function getRoomAt(x, y) {
  for (const r of ROOMS) {
    if (x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) {
      return r;
    }
  }
  // Check exits
  for (const e of EXITS) {
    if (Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1) {
      return { id: e.id, name: e.label };
    }
  }
  return { id: 'corridor', name: 'Corridor' };
}
