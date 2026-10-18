import { describe, expect, it } from 'vitest';
import type { SpriteClip, SpriteManifest } from './animation';
import { entrance, exchange, fighter, runMs, runStart } from './battleChoreography';

const clip = (frames: number, ms: number, loop = true, impactFrame?: number): SpriteClip => ({
  sheet: '/realms/animations/test/x.png',
  frameWidth: 256,
  frameHeight: 256,
  columns: 8,
  durationsMs: Array(frames).fill(ms),
  loop,
  impactFrame,
});
const adult: SpriteManifest = {
  schemaVersion: 1,
  variantId: 'trex_fire',
  stage: 'adult',
  status: 'prototype',
  sourceSize: { width: 256, height: 256 },
  pivot: { x: 128, y: 216 },
  clips: {
    se: {
      idle: clip(8, 125),
      walk: clip(12, 83),
      attack: clip(8, 100, false, 4),
      defend: clip(8, 100, false),
      hurt: clip(4, 100, false),
      death: clip(8, 100, false),
      ultimate: clip(20, 83, false),
    },
  },
};
const juvenile: SpriteManifest = { ...adult, stage: 'juvenile', clips: { se: { ...adult.clips.se, ultimate: undefined } } };
const A = fighter(adult),
  J = fighter(juvenile),
  statue = fighter(null);

describe('battle choreography', () => {
  it('walks both fighters in, then rests on idle', () => {
    const steps = entrance(A, J, { ally: true, enemy: true });
    expect(steps.map((s) => [s.ally, s.enemy])).toEqual([
      ['walk', 'walk'],
      ['idle', 'idle'],
    ]);
    expect(steps[0].ms).toBe(12 * 83);
    expect(steps[1].ms).toBe(Infinity);
  });
  it('lands the ally hit at the impact frame, then lets the enemy answer', () => {
    const steps = exchange('basic', A, J, { ally: true, enemy: true });
    expect(steps.map((s) => [s.ally, s.enemy])).toEqual([
      ['attack', 'idle'],
      ['attack', 'hurt'],
      ['idle', 'idle'],
      ['idle', 'attack'],
      ['hurt', 'attack'],
      ['idle', 'idle'],
    ]);
    expect(steps[0].ms).toBe(400);
    expect(steps[1]).toMatchObject({ ms: 450, reveal: 'enemy', impact: { on: 'enemy', kind: 'hit' } });
    expect(steps[4]).toMatchObject({ reveal: 'ally', impact: { on: 'ally', kind: 'hit' } });
  });
  it('holds the guard through the riposte and skips the ally strike', () => {
    const steps = exchange('defend', A, J, { ally: true, enemy: true });
    expect(steps.map((s) => [s.ally, s.enemy])).toEqual([
      ['defend', 'attack'],
      ['defend', 'attack'],
      ['idle', 'idle'],
    ]);
    expect(steps[1].impact).toEqual({ on: 'ally', kind: 'guard' });
  });
  it('ends on the defeat pose and never resurrects the fallen', () => {
    const win = exchange('ultimate', A, J, { ally: true, enemy: false });
    expect(win.map((s) => [s.ally, s.enemy])).toEqual([
      ['ultimate', 'idle'],
      ['ultimate', 'death'],
      ['idle', 'death'],
    ]);
    const loss = exchange('basic', J, A, { ally: false, enemy: true });
    expect(loss.at(-2)).toMatchObject({ ally: 'death', enemy: 'attack' });
    expect(loss.at(-1)).toMatchObject({ ally: 'death', enemy: 'idle', ms: Infinity });
  });
  it('keeps the beat names for static art and downgrades a missing ultimate to the attack', () => {
    expect(exchange('ultimate', J, statue, { ally: true, enemy: true })[0].ally).toBe('attack');
    const steps = exchange('basic', J, statue, { ally: true, enemy: true });
    expect(steps.map((s) => s.enemy)).toEqual(['idle', 'hurt', 'idle', 'attack', 'attack', 'idle']);
    expect(steps[1].ms).toBe(600);
    expect(steps[3].ms).toBe(330);
  });
  it('survives an empty or finished step list while manifests load', () => {
    expect(runStart([], 0, 'ally')).toBe(0);
    expect(runMs([], 0, 'enemy')).toBe(0);
    const steps = entrance(A, J, { ally: true, enemy: true });
    expect(runStart(steps, 9, 'ally')).toBe(1);
    expect(runMs(steps, 9, 'ally')).toBe(0);
  });
  it('keeps a clip spanning several beats on one run', () => {
    const steps = exchange('basic', A, J, { ally: true, enemy: true });
    expect(runStart(steps, 1, 'ally')).toBe(0);
    expect(runStart(steps, 4, 'enemy')).toBe(3);
    expect(runMs(steps, 1, 'ally')).toBe(850);
    expect(runStart(steps, 5, 'ally')).toBe(5);
    const loss = exchange('basic', J, A, { ally: false, enemy: true });
    expect(runStart(loss, loss.length - 1, 'ally')).toBe(loss.length - 2);
  });
});
