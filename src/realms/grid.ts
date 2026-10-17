/**
 * The home island's building grid. Cells are isometric diamonds; `GRID` is the top corner of cell (0, 0) and half
 * the size of one cell, in scene pixels, fitted to the lawn of home-island-wide-v1.
 */
export const GRID = { x: 800, y: 232, w: 36, h: 18 };
export const project = (x: number, y: number) => ({ x: GRID.x + (x - y) * GRID.w, y: GRID.y + (x + y) * GRID.h });
export const unproject = (x: number, y: number) => ({
  x: Math.floor(((x - GRID.x) / GRID.w + (y - GRID.y) / GRID.h) / 2),
  y: Math.floor(((y - GRID.y) / GRID.h - (x - GRID.x) / GRID.w) / 2),
});

/** The open lawn, in scene pixels, kept clear of the trees, pillars and ruins along its edges. */
const LAWN: [number, number][] = [
  [794, 242],
  [1110, 292],
  [1262, 354],
  [1278, 419],
  [1442, 457],
  [1219, 560],
  [957, 633],
  [794, 658],
  [718, 571],
  [555, 539],
  [353, 479],
  [185, 441],
  [272, 359],
  [468, 299],
];
function onLawn(px: number, py: number) {
  let inside = false;
  for (let i = 0, j = LAWN.length - 1; i < LAWN.length; j = i++) {
    const [x1, y1] = LAWN[i],
      [x2, y2] = LAWN[j];
    if (y1 > py !== y2 > py && px < ((x2 - x1) * (py - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}
/** A cell can hold part of a building if its centre is on the lawn. The original 12×12 area always counts, so
 *  buildings in older saves stay where they are. */
export function buildable(x: number, y: number) {
  if (x >= 0 && y >= 0 && x < 12 && y < 12) return true;
  const c = project(x + 0.5, y + 0.5);
  return onLawn(c.x, c.y);
}
/** Every buildable cell, for drawing the placement grid. */
export const BUILDABLE_CELLS: { x: number; y: number }[] = [];
for (let x = -10; x < 22; x++) for (let y = -10; y < 22; y++) if (buildable(x, y)) BUILDABLE_CELLS.push({ x, y });
