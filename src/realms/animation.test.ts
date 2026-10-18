import { describe, expect, it } from 'vitest';
import { ANIMATED_BOSS_ELEMENTS, frameAt, validateManifest, type SpriteClip, type SpriteManifest } from './animation';
import { readFileSync } from 'node:fs';
import inventory from './animation-inventory.json';

const clip: SpriteClip = {
  sheet: '/realms/animations/test/idle.png',
  frameWidth: 192,
  frameHeight: 192,
  columns: 3,
  durationsMs: [80, 120, 200],
  loop: true,
};
const manifest = (): SpriteManifest => ({
  schemaVersion: 1,
  variantId: 'trex_fire',
  stage: 'baby',
  status: 'prototype',
  sourceSize: { width: 192, height: 192 },
  pivot: { x: 96, y: 180 },
  clips: { se: { idle: structuredClone(clip) } },
});
describe('animation timing', () => {
  it('ships complete local atlases for every registered family and age', () => {
    for (const id of [...inventory, ...ANIMATED_BOSS_ELEMENTS.map(e => `boss_${e}_adult`)]) {
      const m = validateManifest(JSON.parse(readFileSync(`public/realms/animations/${id}/manifest.json`, 'utf8')));
      expect(`${m.variantId}_${m.stage}`).toBe(id);
      const required = ['idle', 'walk', ...(m.stage === 'baby' ? [] : ['attack', 'defend', 'hurt', 'death']), ...(m.stage === 'adult' && id !== 'boss_nature_adult' ? ['ultimate'] : [])];
      for (const name of required) expect(m.clips.se).toHaveProperty(name);
      for (const direction of Object.values(m.clips)) {
        for (const c of Object.values(direction ?? {})) {
          const png = readFileSync(`public${c.sheet}`);
          expect(png.subarray(1, 4).toString()).toBe('PNG');
          expect(png.readUInt32BE(16)).toBe(c.columns * c.frameWidth);
          expect(png.readUInt32BE(20)).toBe(Math.ceil(c.durationsMs.length / c.columns) * c.frameHeight);
        }
      }
    }
  });
  it('honours unequal frame durations and wraps only at the loop boundary', () => {
    expect([0, 79, 80, 199, 200, 399, 400, 480].map((t) => frameAt(clip, t))).toEqual([0, 0, 1, 1, 2, 2, 0, 1]);
  });
  it('holds the final defeat pose instead of resurrecting on a loop', () => {
    expect(frameAt({ ...clip, loop: false }, 5000)).toBe(2);
    expect(frameAt(clip, -50)).toBe(0);
  });
  it('rejects combat clips for babies and invalid timing or impact events', () => {
    const m = manifest();
    m.clips.se!.attack = clip;
    expect(() => validateManifest(m)).toThrow(/attack/);
    delete m.clips.se!.attack;
    m.clips.se!.idle!.durationsMs[0] = 0;
    expect(() => validateManifest(m)).toThrow(/idle/);
    m.clips.se!.idle = { ...clip, impactFrame: 4 };
    expect(() => validateManifest(m)).toThrow(/idle/);
  });
});
