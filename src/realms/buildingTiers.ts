import { WORKSHOP_ART, WORKSHOP_GROUND } from './animatedWorkshop';
import { FARM_ART, FARM_GROUND, FARM_STATES } from './animatedFarm';
import { FARM_LEVELS, type UtilityKind } from './content';
import { ARENA_LEVELS, HATCHERY_LEVELS, WORKSHOP_LEVELS, type Save } from './game';

/**
 * Buildings change look at milestone levels rather than every level. Each tier is a standalone square sprite
 * (see docs/building-tier-art-prompts.json); until its file exists, the building keeps its current art.
 */
export const BUILDING_TIERS: Partial<Record<UtilityKind, { from: number; art: string }[]>> = {
  // Clădirile PixelLab (96×96, desenate ×2 pe amprenta 3×3), în stilul insulelor. Nivelurile mai mari vin pe rând.
  farm: FARM_STATES.map(({ from, art }) => ({ from, art })),
  hatchery: [
    { from: 1, art: '/realms/buildings/px/hatchery-1.png' },
    { from: 2, art: '/realms/buildings/px/hatchery-2.png' },
    { from: 3, art: '/realms/buildings/px/hatchery-3.png' },
  ],
  workshop: [
    { from: 1, art: '/realms/buildings/px/workshop-1.png' },
    { from: 2, art: '/realms/buildings/px/workshop-2.png' },
    { from: 3, art: '/realms/buildings/px/workshop-3.png' },
  ],
  arena: [
    { from: 1, art: '/realms/buildings/px/arena-1.png' },
    { from: 2, art: '/realms/buildings/px/arena-2.png' },
  ],
  market: [{ from: 1, art: '/realms/buildings/px/market-1.png' }],
};
/** Every building kind that has its own sprite. */
export const TIERED = Object.keys(BUILDING_TIERS) as UtilityKind[];
/** Buildings with levels, in the order their upgrades appear. */
export const LEVELED: UtilityKind[] = ['farm', 'hatchery', 'workshop', 'arena'];

/**
 * Standalone sprites: height of the ground plate's left/right corners as a fraction of the image, measured from
 * each picture. The game puts that line on the footprint's corners, so the building sits on its 3x3 cells.
 */
export const GROUND_LINE: Record<string, number> = {
  [FARM_ART]: FARM_GROUND,
  ...Object.fromEntries(FARM_STATES.map(({ art, ground }) => [art, ground])),
  [WORKSHOP_ART]: WORKSHOP_GROUND,
  '/realms/buildings/farm-2.webp': 0.553,
  '/realms/buildings/farm-3.webp': 0.644,
  '/realms/buildings/hatchery-2.webp': 0.689,
  '/realms/buildings/hatchery-3.webp': 0.692,
  '/realms/gameplay/market-building-pixel.webp': 0.635,
};

const measured = new Map<string, number>();
/**
 * Finds a standalone sprite's ground line by itself, so new art needs no hand-measured entry: the widest opaque
 * row of the image is where the ground plate's left and right corners are.
 */
export function measureGround(img: HTMLImageElement) {
  if (measured.has(img.src)) return;
  const size = 256,
    canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(img, 0, 0, size, size);
  const alpha = ctx.getImageData(0, 0, size, size).data;
  let best = -1,
    row = -1;
  for (let y = 0; y < size; y++) {
    let left = -1,
      right = -1;
    for (let x = 0; x < size; x++)
      if (alpha[(y * size + x) * 4 + 3] > 128) {
        if (left < 0) left = x;
        right = x;
      }
    if (right - left > best) [best, row] = [right - left, y];
  }
  if (row >= 0) measured.set(img.src, row / size);
}
/** The ground line for a sprite: the measured value from the table above, else the one found on load. */
export function groundLine(img: HTMLImageElement) {
  return Object.entries(GROUND_LINE).find(([path]) => img.src.endsWith(path))?.[1] ?? measured.get(img.src);
}

/** Level of an upgradable building, or null for buildings without levels. */
export function buildingLevel(s: Save, kind: UtilityKind): { level: number; max: number } | null {
  if (kind === 'farm') return { level: s.farmLevel, max: FARM_LEVELS.length };
  if (kind === 'hatchery') return { level: s.hatcheryLevel, max: HATCHERY_LEVELS.length };
  if (kind === 'workshop') return { level: s.workshopLevel, max: WORKSHOP_LEVELS.length };
  if (kind === 'arena') return { level: s.arenaLevel, max: ARENA_LEVELS.length };
  return null;
}

/** The milestone art for the building's current level, or null while it still uses its base look. */
export function tierArt(s: Save, kind: UtilityKind): string | null {
  const level = buildingLevel(s, kind)?.level || 1;
  return [...(BUILDING_TIERS[kind] ?? [])].reverse().find((t) => level >= t.from)?.art ?? null;
}
