import { describe, expect, it } from 'vitest';
import { autoAction } from './autoBattle';
import { ENCOUNTERS } from './content';
import { ARENA_LEVELS, ELEMENTS, command, foeHasUltimate, newSave, strikeDamage, type RoundReport, type Save, type Stage } from './game';
import type { BattleAction } from './battleChoreography';

/** A save that may enter every encounter, with one dinosaur of the given age and level. */
function ready(stage: Stage, level: number): Save {
  const s = newSave(0);
  s.arenaTickets = Object.fromEntries(ELEMENTS.map(e => [e.id, 100]));
  s.dinos = [{ id: 'd', species: 'trex', element: 'fire', level, stage, nickname: 'T' }];
  s.champion = 'd';
  s.habitats = Object.fromEntries(ELEMENTS.map((e) => [e.id, 1]));
  s.arenaLevel = ARENA_LEVELS.length;
  s.cleared = ENCOUNTERS.map((e) => e.id);
  s.stars = Object.fromEntries(ENCOUNTERS.filter((e) => e.mode === 'arena').map((e) => [e.id, 3]));
  s.buildings = [
    { id: 'a', kind: 'arena', x: 0, y: 0 },
    { id: 'p', kind: 'portal', x: 4, y: 0 },
  ];
  return s;
}
/** Plays one fight with the planner and returns the moves used, in order, and the result. */
function fight(s: Save, encounterId: string) {
  let save = command(s, { type: 'battle', encounterId }, 0);
  const moves: BattleAction[] = [];
  const reports: RoundReport[] = [];
  const shown = new Set<BattleAction>();
  while (!save.battle!.result) {
    const move = autoAction(save.battle!, save.dinos[0], shown);
    shown.add(move);
    moves.push(move);
    save = command(save, { type: 'action', action: move }, 0);
    reports.push(save.battle!.report!);
  }
  return { moves, reports, result: save.battle!.result };
}

describe('automatic fights', () => {
  it('shows attack, guard and ultimate in every arena fight an adult can enter', () => {
    for (const encounter of ENCOUNTERS.filter((e) => e.mode === 'arena')) {
      for (const level of [encounter.level, encounter.level + 10]) {
        const { moves, result } = fight(ready('adult', level), encounter.id);
        // A fight decided in a single blow can only show one strike; real encounters last longer.
        if (moves.length < 3) continue;
        expect(new Set(moves), `${encounter.id} at level ${level} (${result})`).toEqual(new Set(['basic', 'defend', 'ultimate']));
      }
    }
  });
  it('lets every arena opponent show its guard, and its ultimate when it owns one', () => {
    for (const encounter of ENCOUNTERS.filter((e) => e.mode === 'arena')) {
      const { reports } = fight(ready('adult', encounter.level), encounter.id);
      const foe = new Set(reports.map((r) => r.foe));
      expect(foe.has('attack'), encounter.id).toBe(true);
      expect(foe.has('defend'), encounter.id).toBe(true);
      expect(foe.has('ultimate'), encounter.id).toBe(foeHasUltimate(encounter.id));
    }
  });
  it('spends the ultimate every few rounds, on both sides, not only as a finisher', () => {
    for (const encounter of ENCOUNTERS.filter((e) => e.mode === 'arena')) {
      const { moves, reports } = fight(ready('adult', encounter.level), encounter.id);
      // The bar fills in about three rounds: the first ultimate comes by round 4, long before the end.
      expect(moves.indexOf('ultimate'), encounter.id).toBeLessThanOrEqual(3);
      if (foeHasUltimate(encounter.id)) expect(reports.findIndex((r) => r.foe === 'ultimate'), encounter.id).toBeLessThanOrEqual(2);
    }
    const long = fight(ready('adult', 14), 'arena-fire-3');
    expect(long.moves.filter((m) => m === 'ultimate').length).toBeGreaterThanOrEqual(2);
    expect(long.reports.filter((r) => r.foe === 'ultimate').length).toBeGreaterThanOrEqual(2);
  });
  it('turns part of a guarded blow back, and a dodge takes no damage', () => {
    const all = ENCOUNTERS.filter((e) => e.mode === 'arena').flatMap((e) => fight(ready('adult', e.level), e.id).reports);
    expect(all.some((r) => r.ally === 'defend' && r.reflected > 0)).toBe(true);
    expect(all.filter((r) => r.dodged).every((r) => r.taken === 0)).toBe(true);
  });
  it('opens with an attack, then guards against the first blow, for juveniles too (who have no ultimate)', () => {
    const { moves, reports } = fight(ready('juvenile', 12), ENCOUNTERS.find((e) => e.mode === 'arena')!.id);
    expect(moves[0]).toBe('basic');
    // Round 2 is the opponent's guard, so the dinosaur raises its shield against the blow of round 3.
    expect(reports[1].foe).toBe('defend');
    expect(moves[2]).toBe('defend');
    expect(moves).not.toContain('ultimate');
  });
  it('lands the ultimate as the finishing blow when the bar never fills', () => {
    const d = { level: 20, stage: 'adult' as const, species: 'trex' as const, element: 'fire' as const };
    const b = { encounterId: 'training', energy: 40, enemy: strikeDamage(d, 'basic'), hp: 500, round: 1, enemyEnergy: 0 };
    expect(autoAction(b, d, new Set(['basic', 'defend']))).toBe('ultimate');
  });
  it('braces for the opponent ultimate', () => {
    const d = { level: 30, stage: 'adult' as const, species: 'trex' as const, element: 'fire' as const };
    const b = { encounterId: 'arena-fire-3', energy: 50, enemy: 900, hp: 900, round: 3, enemyEnergy: 100 };
    expect(autoAction(b, d, new Set(['basic', 'defend']))).toBe('defend');
  });
  it('never guards when the delayed blow would lose the fight', () => {
    const d = { level: 20, stage: 'adult' as const, species: 'trex' as const, element: 'fire' as const };
    const b = { encounterId: 'training', energy: 0, enemy: 1, hp: 1, round: 1, enemyEnergy: 0 };
    expect(autoAction(b, d, new Set(['basic']))).toBe('ultimate');
  });
});
