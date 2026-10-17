import { expect, it } from 'vitest';
import { worldArt, worldArtSize } from './worldArt';
import { ELEMENTS } from './game';
import { constrainPan, SCENE } from './camera';

it('uses wide artwork for every world without stretching and clamps its centered edges', () => {
  for (const element of ELEMENTS) expect(worldArt(element.id)).toBe(`/realms/worlds/${element.id}-wide-v1.webp`);
  for (const [width, height] of [[1672, 941], [1824, 1024], [1536, 864]]) {
    const art = worldArtSize({ naturalWidth: width, naturalHeight: height });
    expect(art.width / art.height).toBeCloseTo(width / height);
    for (const zoom of [1, 2, 3]) for (const direction of [-1, 1]) {
      const pan = constrainPan({ x: direction * 99999, y: 0 }, zoom, SCENE, art);
      const edge = SCENE.width / 2 + (direction * SCENE.width / 2 - pan.x) / zoom;
      expect(edge).toBeGreaterThanOrEqual((SCENE.width - art.width) / 2 - 0.001);
      expect(edge).toBeLessThanOrEqual((SCENE.width + art.width) / 2 + 0.001);
      expect(Math.abs(pan.x)).toBeGreaterThan(140);
    }
  }
});
