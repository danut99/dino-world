import { describe, expect, it } from 'vitest';
import { autoPlay } from './autoBattle';
import { ENCOUNTERS } from './content';
import { ARENA_LEVELS, ELEMENTS, TAP_BONUS, command, newSave, type Dino, type Save } from './game';

function ready(size = 3): Save {
  const s = newSave(0);
  s.arenaTickets = Object.fromEntries(ELEMENTS.map((e) => [e.id, 100]));
  s.dinos = Array.from({ length: size }, (_, i): Dino => ({
    id: `d${i}`,
    species: 'trex',
    element: 'fire',
    level: 30,
    stage: 'adult',
    nickname: `T${i}`,
  }));
  s.team = s.dinos.map((d) => d.id);
  s.champion = 'd0';
  s.habitats = Object.fromEntries(ELEMENTS.map((e) => [e.id, 1]));
  s.arenaLevel = ARENA_LEVELS.length;
  s.cleared = ENCOUNTERS.map((e) => e.id);
  s.stars = Object.fromEntries(ENCOUNTERS.map((e) => [e.id, 3]));
  s.buildings = [{ id: 'a', kind: 'arena', x: 0, y: 0 }];
  return s;
}

/** The first state of the fight where the ultimate is charged and an untapped one lands. */
function charged(): Save {
  let s = command(ready(), { type: 'battle', encounterId: 'arena-fire-2' }, 0);
  while (!s.battle!.result) {
    if (s.battle!.energy >= 100) {
      const r = command(s, { type: 'action', action: 'ultimate' }, 0).battle!.report!;
      if (r.dealt > 0) return s;
    }
    s = command(s, { type: 'action', action: 'basic' }, 0);
  }
  throw new Error('no charged round');
}

describe('ultimate tap', () => {
  it('a tapped ultimate hits harder and is reported', () => {
    const s = charged();
    const plain = command(s, { type: 'action', action: 'ultimate' }, 0).battle!.report!,
      tapped = command(s, { type: 'action', action: 'ultimate', tapped: true }, 0).battle!.report!;
    expect(TAP_BONUS).toBeGreaterThan(1);
    expect(tapped.dealt).toBeGreaterThan(plain.dealt);
    expect(tapped.tapped).toBe(true);
    expect(plain.tapped).toBeUndefined();
  });
  it('tapped is refused for any move but the ultimate', () => {
    const s = command(ready(), { type: 'battle', encounterId: 'arena-fire-2' }, 0);
    expect(() => command(s, { type: 'action', action: 'basic', tapped: true }, 0)).toThrow('action');
    expect(() => command(s, { type: 'action', action: 'defend', tapped: true }, 0)).toThrow('action');
  });
});

describe('fight recap', () => {
  it('records the biggest hit and damage per ally after autoPlay', () => {
    const end = autoPlay(command(ready(), { type: 'battle', encounterId: 'arena-fire-2' }, 0), 0).battle!;
    expect(end.result).not.toBeNull();
    expect(end.bestHit?.amount).toBeGreaterThan(0);
    expect(end.team.map((a) => a.dinoId)).toContain(end.bestHit!.dinoId);
    const totals = Object.values(end.damage ?? {});
    expect(totals.length).toBeGreaterThan(0);
    expect(Math.max(...totals)).toBeGreaterThanOrEqual(end.bestHit!.amount);
    expect(end.round - 1).toBeGreaterThan(0);
  });
});
