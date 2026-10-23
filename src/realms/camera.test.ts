import { describe, expect, it } from 'vitest';
import { constrainPan, constrainHomePan, HOME_ART, SCENE } from './camera';
import home from './islands/home.json';

describe('world camera coverage', () => {
  it('keeps normal drags moving at maximum home zoom-out', () => {
    for (const viewport of [SCENE, { width: 1536, height: 864 }, { width: 710, height: 1024 }]) {
      for (const direction of [-1, 1]) {
        const target = { x: direction * 500, y: direction * 300 };
        expect(constrainHomePan(target, 0.7, viewport)).toEqual(target);
      }
    }
  });
  it('keeps part of the home island visible at extreme drag limits', () => {
    for (const direction of [-1, 1]) {
      const pan = constrainHomePan({ x: direction * 10000, y: direction * 10000 }, 0.7, SCENE);
      const left = (home.offset[0] - SCENE.width / 2) * 0.7 + pan.x;
      const right = left + home.size[0] * home.scale * 0.7;
      const top = (home.offset[1] - SCENE.height / 2) * 0.7 + pan.y;
      const bottom = top + home.size[1] * home.scale * 0.7;
      expect(Math.min(right, SCENE.width / 2) - Math.max(left, -SCENE.width / 2)).toBeGreaterThanOrEqual(127.9);
      expect(Math.min(bottom, SCENE.height / 2) - Math.max(top, -SCENE.height / 2)).toBeGreaterThanOrEqual(127.9);
    }
  });

  it('uses the enlarged island dimensions and allows dragging at the initial 0.8 zoom', () => {
    expect(HOME_ART.width).toBeGreaterThanOrEqual(home.size[0] * home.scale);
    expect(HOME_ART.height).toBeGreaterThanOrEqual(home.size[1] * home.scale);
    const pan = constrainPan({ x: 160, y: 0 }, 0.8, SCENE, HOME_ART);
    expect(pan.x).toBe(160);
  });

  it('allows movement at 1x across the current home art', () => {
    const pan = constrainPan({ x: 9999, y: -9999 }, 1, SCENE, HOME_ART);
    expect(pan.x).toBeCloseTo((HOME_ART.width - SCENE.width) / 2);
    expect(pan.y).toBeCloseTo(-(HOME_ART.height - SCENE.height) / 2);
    expect(SCENE.width / 2 + SCENE.width / 2 - pan.x).toBeLessThanOrEqual((SCENE.width + HOME_ART.width) / 2);
    expect(SCENE.width / 2 - SCENE.width / 2 - pan.x).toBeCloseTo((SCENE.width - HOME_ART.width) / 2);
  });
  it('keeps every visible corner within the artwork after extreme drags, zoom out and resize', () => {
    for (const viewport of [
      { width: 1536, height: 1024 },
      { width: 1536, height: 710 },
      { width: 710, height: 1024 },
    ]) {
      for (const zoom of [1, 2])
        for (const x of [-10000, 10000])
          for (const y of [-10000, 10000]) {
            const pan = constrainPan({ x, y }, zoom, viewport);
            for (const sx of [-1, 1])
              for (const sy of [-1, 1]) {
                const worldX = SCENE.width / 2 + ((sx * viewport.width) / 2 - pan.x) / zoom;
                const worldY = SCENE.height / 2 + ((sy * viewport.height) / 2 - pan.y) / zoom;
                expect(worldX).toBeGreaterThanOrEqual(0);
                expect(worldX).toBeLessThanOrEqual(SCENE.width);
                expect(worldY).toBeGreaterThanOrEqual(0);
                expect(worldY).toBeLessThanOrEqual(SCENE.height);
              }
          }
    }
  });
  it('allows panning across cropped artwork at default zoom and further when zoomed in', () => {
    expect(constrainPan({ x: 999, y: 999 }, 1, { width: 1000, height: 1024 })).toEqual({ x: 268, y: 0 });
    expect(constrainPan({ x: 999, y: 999 }, 2, SCENE)).toEqual({ x: 768, y: 512 });
    expect(constrainPan({ x: 768, y: 512 }, 1, SCENE)).toEqual({ x: 0, y: 0 });
  });
});
