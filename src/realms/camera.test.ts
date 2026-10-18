import { describe, expect, it } from 'vitest';
import { constrainPan, HOME_ART, SCENE } from './camera';

describe('world camera coverage', () => {
  it('allows sideways movement at 1x within the wider centered home art', () => {
    const pan = constrainPan({ x: 9999, y: -9999 }, 1, SCENE, HOME_ART);
    expect(pan.x).toBeCloseTo((HOME_ART.width - SCENE.width) / 2);
    expect(pan.y).toBeCloseTo(0);
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
