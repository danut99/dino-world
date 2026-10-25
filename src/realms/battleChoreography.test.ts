import { describe, expect, it } from 'vitest';
import type { SpriteClip, SpriteManifest } from './animation';
import { entrance, exchange, fighter, runMs, runStart, swapEntrance } from './battleChoreography';
import type { RoundReport } from './game';

const report = (r: Partial<RoundReport>): RoundReport => ({
  ally: 'basic', foe: 'attack', dealt: 20, enemyAfterStrike: 80, taken: 15, dodged: false, reflected: 0, ...r,
});

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
    const steps = exchange(report({}), A, J, { ally: true, enemy: true });
    expect(steps.map((s) => [s.ally, s.enemy])).toEqual([
      ['attack', 'idle'],
      ['attack', 'hurt'],
      ['idle', 'idle'],
      ['idle', 'attack'],
      ['hurt', 'attack'],
      ['idle', 'idle'],
    ]);
    expect(steps[0].ms).toBe(400);
    expect(steps[1]).toMatchObject({ ms: 450, reveal: 'enemy', revealHp: 80, impact: { on: 'enemy', kind: 'hit' } });
    expect(steps[1].say).toEqual([{ on: 'enemy', kind: 'damage', amount: 20 }]);
    expect(steps[4]).toMatchObject({ reveal: 'ally', impact: { on: 'ally', kind: 'hit' } });
    expect(steps[4].say).toEqual([{ on: 'ally', kind: 'damage', amount: 15 }]);
  });
  it('holds the guard through the riposte, then turns part of it back', () => {
    const steps = exchange(report({ ally: 'defend', dealt: 0, enemyAfterStrike: 100, taken: 9, reflected: 4 }), A, J, { ally: true, enemy: true });
    expect(steps.map((s) => [s.ally, s.enemy])).toEqual([
      ['defend', 'attack'],
      ['defend', 'attack'],
      ['defend', 'hurt'],
      ['idle', 'idle'],
    ]);
    expect(steps[1].impact).toEqual({ on: 'ally', kind: 'guard' });
    expect(steps[1].say).toEqual([{ on: 'ally', kind: 'blocked', amount: 9 }]);
    expect(steps[2]).toMatchObject({ reveal: 'enemy', impact: { on: 'enemy', kind: 'reflect' } });
    expect(steps[2].say).toEqual([{ on: 'enemy', kind: 'reflect', amount: 4 }]);
  });
  it('shows the opponent raising its shield, and its ultimate', () => {
    const guarded = exchange(report({ foe: 'defend', dealt: 10, taken: 0 }), A, A, { ally: true, enemy: true });
    expect(guarded.map((s) => [s.ally, s.enemy])).toEqual([
      ['attack', 'defend'],
      ['attack', 'defend'],
      ['idle', 'idle'],
    ]);
    expect(guarded[0].say).toEqual([{ on: 'enemy', kind: 'guard' }]);
    expect(guarded[1].say).toEqual([{ on: 'enemy', kind: 'blocked', amount: 10 }]);
    const ult = exchange(report({ foe: 'ultimate', taken: 30 }), A, A, { ally: true, enemy: true });
    expect(ult[3]).toMatchObject({ ally: 'idle', enemy: 'ultimate', say: [{ on: 'enemy', kind: 'ultimate' }] });
  });
  it('lets the ally leap aside from a dodged blow', () => {
    const steps = exchange(report({ dodged: true, taken: 0 }), A, J, { ally: true, enemy: true });
    expect(steps[4]).toMatchObject({ ally: 'idle', enemy: 'attack', dodge: 'ally', say: [{ on: 'ally', kind: 'dodge' }] });
    expect(steps[4].impact).toBeUndefined();
  });
  it('ends on the defeat pose and never resurrects the fallen', () => {
    const win = exchange(report({ ally: 'ultimate', foe: 'none', dealt: 80, enemyAfterStrike: 0 }), A, J, { ally: true, enemy: false });
    expect(win.map((s) => [s.ally, s.enemy])).toEqual([
      ['ultimate', 'idle'],
      ['ultimate', 'death'],
      ['idle', 'death'],
    ]);
    expect(win[0].say).toEqual([{ on: 'ally', kind: 'ultimate' }]);
    expect(win[1].say?.at(-1)).toEqual({ on: 'enemy', kind: 'ko' });
    const loss = exchange(report({}), J, A, { ally: false, enemy: true });
    expect(loss.at(-2)).toMatchObject({ ally: 'death', enemy: 'attack' });
    expect(loss.at(-1)).toMatchObject({ ally: 'death', enemy: 'idle', ms: Infinity });
  });
  it('keeps the beat names for static art and downgrades a missing ultimate to the attack', () => {
    expect(exchange(report({ ally: 'ultimate' }), J, statue, { ally: true, enemy: true })[0].ally).toBe('attack');
    const steps = exchange(report({}), J, statue, { ally: true, enemy: true });
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
    const steps = exchange(report({}), A, J, { ally: true, enemy: true });
    expect(runStart(steps, 1, 'ally')).toBe(0);
    expect(runStart(steps, 4, 'enemy')).toBe(3);
    expect(runMs(steps, 1, 'ally')).toBe(850);
    expect(runStart(steps, 5, 'ally')).toBe(5);
    const loss = exchange(report({}), J, A, { ally: false, enemy: true });
    expect(runStart(loss, loss.length - 1, 'ally')).toBe(loss.length - 2);
  });
  it('replays the entrance for the fighter that steps in after a relay swap', () => {
    const foe = swapEntrance('enemy', A, J, { ally: true, enemy: true });
    expect(foe.map((s) => [s.ally, s.enemy])).toEqual([
      ['idle', 'walk'],
      ['idle', 'idle'],
    ]);
    expect(foe[0]).toMatchObject({ enter: 'enemy', ms: 12 * 83 });
    expect(foe[1].ms).toBe(Infinity);
    const ally = swapEntrance('ally', statue, A, { ally: true, enemy: true });
    expect(ally[0]).toMatchObject({ ally: 'walk', enemy: 'idle', enter: 'ally', ms: 900 });
    const both = swapEntrance('both', A, J, { ally: true, enemy: true });
    expect(both[0]).toMatchObject({ ally: 'walk', enemy: 'walk', enter: 'both' });
  });
  it('reveals the health a fallen fighter ended its round with, not its successor', () => {
    const steps = exchange(report({ taken: 40, hpAfter: 0, reflected: 5, ally: 'defend', dealt: 0, enemyAfterStrike: 60, enemyAfter: 55, swap: 'ally' }), A, J, { ally: false, enemy: true });
    expect(steps.find((s) => s.reveal === 'ally')?.revealHp).toBe(0);
    expect(steps.find((s) => s.impact?.kind === 'reflect')?.revealHp).toBe(55);
    expect(steps.at(-1)).toMatchObject({ ally: 'death', ms: Infinity });
  });
});
