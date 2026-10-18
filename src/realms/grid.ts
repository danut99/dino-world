import home from './islands/home.json';

/**
 * The home island's building grid. Cells are isometric diamonds; `GRID` is the top corner of cell (0, 0) and half
 * the size of one cell, in scene pixels. The island art is assembled from PixelLab tiles on exactly this grid
 * (scripts/compose-island.py): one 32×18 art tile per cell, drawn at 2 scene pixels per art pixel.
 */
export const GRID = home.grid;
export const project = (x: number, y: number) => ({ x: GRID.x + (x - y) * GRID.w, y: GRID.y + (x + y) * GRID.h });
export const unproject = (x: number, y: number) => ({
  x: Math.floor(((x - GRID.x) / GRID.w + (y - GRID.y) / GRID.h) / 2),
  y: Math.floor(((y - GRID.y) / GRID.h - (x - GRID.x) / GRID.w) / 2),
});

const OPEN = new Set(home.buildable.map(([x, y]) => `${x},${y}`));
/** A cell can hold part of a building if it is open ground on the composed island (trees and cliffs excluded).
 *  The original 12×12 area always counts, so buildings in older saves stay where they are. */
export function buildable(x: number, y: number) {
  return (x >= 0 && y >= 0 && x < 12 && y < 12) || OPEN.has(`${x},${y}`);
}
/** Every buildable cell, for drawing the placement grid. */
export const BUILDABLE_CELLS: { x: number; y: number }[] = home.buildable.map(([x, y]) => ({ x, y }));
