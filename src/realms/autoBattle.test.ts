import { describe, expect, it } from 'vitest';
import { autoAction, autoPlay, movesMemory, nextMove, predictFight } from './autoBattle';
import { ENCOUNTERS } from './content';
import { arenaFoes, foeHasUltimate } from './arenaTeams';
import { ARENA_LEVELS, ELEMENTS, command, newSave, strikeAgainst, type Dino, type RoundReport, type Save, type Stage } from './game';
import type { BattleAction } from './battleChoreography';

/** A save that may enter every encounter, with a team of the given age and level (one to three T-Rexes). */
function ready(stage: Stage, level: number, size = 1): Save {
  const s = newSave(0);
  s.arenaTickets = Object.fromEntries(ELEMENTS.map((e) => [e.id, 100]));
  s.dinos = Array.from({ length: size }, (_, i): Dino => ({ id: `d${i}`, species: 'trex', element: 'fire', level, stage, nickname: `T${i}` }));
  s.team = s.dinos.map((d) => d.id);
  s.champion = 'd0';
  s.habitats = Object.fromEntries(ELEMENTS.map((e) => [e.id, 1]));
  s.arenaLevel = ARENA_LEVELS.length;
  s.cleared = ENCOUNTERS.map((e) => e.id);
  s.stars = Object.fromEntries(ENCOUNTERS.map((e) => [e.id, 3]));
  s.buildings = [{ id: 'a', kind: 'arena', x: 0, y: 0 }];
  return s;
}
/** Plays one fight with the planner; returns each round's mover, move and report, and the end. */
function fight(s: Save, encounterId: string) {
  let save = command(s, { type: 'battle', encounterId }, 0);
  const rounds: { dino: string; foe: number; move: BattleAction; report: RoundReport }[] = [];
  const memory = movesMemory();
  for (let move = nextMove(save, memory); move; move = nextMove(save, memory)) {
    const dino = save.battle!.dinoId,
      foe = save.battle!.foeIndex;
    save = command(save, { type: 'action', action: move }, 0);
    rounds.push({ dino, foe, move, report: save.battle!.report! });
  }
  return { rounds, battle: save.battle! };
}
const arena = ENCOUNTERS.filter((e) => e.mode === 'arena');

describe('automatic fights', () => {
  it('shows attack, guard and ultimate for every adult fighter that lasts a few rounds', () => {
    for (const encounter of arena) {
      const { rounds } = fight(ready('adult', Math.max(25, encounter.level), 3), encounter.id);
      for (const id of new Set(rounds.map((r) => r.dino))) {
        const moves = rounds.filter((r) => r.dino === id).map((r) => r.move);
        if (moves.length < 4) continue;
        expect(new Set(moves), `${encounter.id} ${id}`).toEqual(new Set(['basic', 'defend', 'ultimate']));
      }
    }
  });
  it('restarts the repertoire for each fighter that steps in: it opens with an attack', () => {
    const { rounds, battle } = fight(ready('juvenile', 14, 3), 'arena-fire-3');
    const fighters = [...new Set(rounds.map((r) => r.dino))];
    expect(fighters.length).toBeGreaterThan(1);
    for (const id of fighters) expect(rounds.find((r) => r.dino === id)!.move, id).toBe('basic');
    expect(battle.team.slice(0, battle.active).every((a) => a.hp === 0)).toBe(true);
  });
  it('relays on both sides: the next fighter enters with an empty bar, and the swap is reported', () => {
    const { rounds, battle } = fight(ready('adult', 30, 3), 'arena-fire-2');
    expect(battle.result).toBe('victory');
    const swaps = rounds.filter((r) => r.report.swap);
    expect(swaps.length).toBeGreaterThanOrEqual(2);
    expect(swaps.every((r) => r.report.swap === 'enemy' || r.report.swap === 'both' || r.report.swap === 'ally')).toBe(true);
    // Every foe in turn: each one fought until it fell.
    expect([...new Set(rounds.map((r) => r.foe))]).toEqual([0, 1, 2]);
    let s = command(ready('adult', 30, 3), { type: 'battle', encounterId: 'arena-fire-2' }, 0);
    const memory = movesMemory();
    while (s.battle!.foeIndex === 0) s = command(s, { type: 'action', action: nextMove(s, memory)! }, 0);
    expect(s.battle!.enemyEnergy).toBe(0);
    expect(s.battle!.enemy).toBe(s.battle!.foes[1].maxHp);
    expect(s.battle!.report!.swap).toMatch(/enemy|both/);
  });
  it('lets every opponent show its guard, and its ultimate when it owns one', () => {
    for (const encounter of arena) {
      const { rounds } = fight(ready(encounter.level < 25 ? 'juvenile' : 'adult', encounter.level, 1), encounter.id);
      const first = rounds.filter((r) => r.foe === 0).map((r) => r.report.foe);
      if (first.length < 4) continue;
      expect(first, encounter.id).toContain('attack');
      expect(first, encounter.id).toContain('defend');
      if (first.length >= 5) expect(first.includes('ultimate'), encounter.id).toBe(foeHasUltimate(arenaFoes(encounter.id)[0]));
    }
  });
  it('spends the ultimate every few rounds, not only as a finisher', () => {
    const { rounds } = fight(ready('adult', 30, 1), 'arena-earth-3');
    const moves = rounds.map((r) => r.move);
    expect(moves.indexOf('ultimate')).toBeLessThanOrEqual(3);
    expect(moves.filter((m) => m === 'ultimate').length).toBeGreaterThanOrEqual(2);
    expect(rounds.filter((r) => r.report.foe === 'ultimate').length).toBeGreaterThanOrEqual(1);
  });
  it('turns part of a guarded blow back, and a dodge takes no damage', () => {
    const all = arena.flatMap((e) => fight(ready('adult', Math.max(25, e.level), 3), e.id).rounds.map((r) => r.report));
    expect(all.some((r) => r.ally === 'defend' && r.reflected > 0)).toBe(true);
    expect(all.some((r) => r.dodged)).toBe(true);
    expect(all.filter((r) => r.dodged).every((r) => r.taken === 0)).toBe(true);
  });
  it('opens with an attack, then guards against the first blow, for juveniles too (who have no ultimate)', () => {
    const { rounds } = fight(ready('juvenile', 12, 1), 'arena-fire-1');
    const moves = rounds.map((r) => r.move);
    expect(moves[0]).toBe('basic');
    // Round 2 is the opponent's guard, so the dinosaur raises its shield against the blow of round 3.
    expect(rounds[1].report.foe).toBe('defend');
    expect(moves[2]).toBe('defend');
    expect(moves).not.toContain('ultimate');
  });
  it('lands the ultimate as the finishing blow, braces for the opponent ultimate, never guards into a loss', () => {
    const d = { level: 20, stage: 'adult' as const, species: 'trex' as const, element: 'fire' as const };
    const foes = arenaFoes('arena-fire-3');
    const board = { foes, foeIndex: 0, energy: 40, hp: 500, round: 1, enemyEnergy: 0, enemy: 0 };
    board.enemy = strikeAgainst(board, d, 'basic');
    expect(autoAction(board, d, new Set(['basic', 'defend']))).toBe('ultimate');
    expect(autoAction({ ...board, enemy: 900, round: 3, energy: 50, enemyEnergy: 100 }, d, new Set(['basic', 'defend']))).toBe('defend');
    expect(autoAction({ ...board, enemy: 1, hp: 1, energy: 0 }, d, new Set(['basic']))).toBe('ultimate');
  });
  it('plays the whole relay in the forecast, for the current team, without paying', () => {
    const solo = predictFight(ready('juvenile', 14, 1), 'arena-fire-3', 0)!;
    const trio = predictFight(ready('juvenile', 14, 3), 'arena-fire-3', 0)!;
    expect(trio.hpLeft).toBeGreaterThanOrEqual(0);
    expect(trio.win || trio.fallen === 3).toBe(true);
    expect(solo.fallen).toBeLessThanOrEqual(1);
    // The forecast and the real fight agree.
    const real = autoPlay(command(ready('juvenile', 14, 3), { type: 'battle', encounterId: 'arena-fire-3' }, 0), 0).battle!;
    expect(real.result === 'victory').toBe(trio.win);
    expect(real.stars ?? 0).toBe(trio.stars);
  });
});
