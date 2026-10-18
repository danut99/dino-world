import { expect, it } from 'vitest';
import { worldArt } from './worldArt';
import { ELEMENTS } from './game';
import { ISLANDS } from './islands';
import { SCENE } from './camera';

it('draws every elemental world as one PixelLab island at a whole-pixel scale, centred in the scene', () => {
  for (const element of ELEMENTS) {
    const isl = ISLANDS[element.id];
    expect(worldArt(element.id)).toBe(`/realms/worlds/${element.id}-island.png`);
    expect(Number.isInteger(isl.scale)).toBe(true);
    expect(isl.offset[0] * 2 + isl.size[0] * isl.scale).toBe(SCENE.width);
    expect(isl.size[1] * isl.scale).toBeLessThanOrEqual(SCENE.height);
    expect(isl.spots.length).toBeGreaterThanOrEqual(5);
    for (const p of isl.spots) {
      expect(p.x).toBeGreaterThan(isl.offset[0]);
      expect(p.x).toBeLessThan(isl.offset[0] + isl.size[0] * isl.scale);
    }
  }
});
