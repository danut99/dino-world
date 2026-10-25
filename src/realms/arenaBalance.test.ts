import { describe, expect, it } from 'vitest';
import { autoAction } from './autoBattle';
import { ENCOUNTERS } from './content';
import {
  ARENA_LEVELS,
  ELEMENTS,
  SPECIES,
  STAR_MILESTONES,
  command,
  elementEdge,
  newSave,
  parseSave,
  starsFor,
  type RealmId,
  type Save,
} from './game';
import type { BattleAction } from './battleChoreography';

const ids = ELEMENTS.map((e) => e.id as RealmId);
const withEdge = (league: RealmId, edge: number) => ids.find((x) => elementEdge(x, league) === edge);
function ready(species: string, element: RealmId, level: number): Save {
  const s = newSave(0);
  s.arenaTickets = Object.fromEntries(ELEMENTS.map(e => [e.id, 100]));
  s.dinos = [{ id: 'd', species: species as never, element, level, stage: level >= 25 ? 'adult' : 'juvenile', nickname: 'T' }];
  s.champion = 'd';
  s.habitats = Object.fromEntries(ELEMENTS.map((x) => [x.id, 1]));
  s.arenaLevel = ARENA_LEVELS.length;
  s.cleared = ENCOUNTERS.map((x) => x.id);
  s.stars = Object.fromEntries(ENCOUNTERS.filter((e) => e.mode === 'arena').map((e) => [e.id, 3]));
  s.buildings = [{ id: 'a', kind: 'arena', x: 0, y: 0 }];
  return s;
}
function fight(s: Save, encounterId: string, now = 0) {
  s = command(s, { type: 'battle', encounterId }, now);
  const shown = new Set<BattleAction>();
  while (!s.battle!.result) {
    const a = autoAction(s.battle!, s.dinos[0], shown);
    shown.add(a);
    s = command(s, { type: 'action', action: a }, now);
  }
  return s;
}
/** Share of fights won on a tier, over every league and species, for a given element edge and extra levels. */
function winRate(tier: number, edge: number, plus: number) {
  const results: boolean[] = [];
  for (const e of ENCOUNTERS.filter((x) => x.mode === 'arena' && x.id.endsWith(`-${tier}`))) {
    const element = withEdge(e.league as RealmId, edge);
    if (!element) continue;
    for (const sp of SPECIES) results.push(fight(ready(sp, element, Math.min(50, e.level + plus)), e.id).battle!.result === 'victory');
  }
  return results.filter(Boolean).length / results.length;
}

describe('arena balance', () => {
  it('makes the element edge decide fights at the recommended level', () => {
    expect(winRate(1, 0, 0)).toBeGreaterThan(0.9); // an apprentice is a safe first win
    expect(winRate(1, -1, 0)).toBeLessThan(0.2);
    expect(winRate(2, 0, 0)).toBeGreaterThan(0.3); // a veteran is a coin flip
    expect(winRate(2, 0, 0)).toBeLessThan(0.75);
    expect(winRate(2, 1, 0)).toBeGreaterThan(0.9);
    expect(winRate(3, 0, 0)).toBeLessThan(0.35); // a champion needs the edge...
    expect(winRate(3, 1, 0)).toBeGreaterThan(0.85);
    expect(winRate(3, 0, 5)).toBeGreaterThan(0.75); // ...or about five more levels
    expect(winRate(3, -1, 0)).toBe(0);
  });
  it('wheels every element: one it beats, one that beats it, light and dark against each other', () => {
    for (const a of ids) {
      expect(ids.filter((b) => elementEdge(a, b) === 1).length, a).toBe(1);
      expect(ids.filter((b) => elementEdge(a, b) === -1).length, a).toBe(a === 'light' || a === 'dark' ? 0 : 1);
    }
    expect(elementEdge('fire', 'nature')).toBe(1);
    expect(elementEdge('water', 'fire')).toBe(1);
    expect(elementEdge('light', 'dark')).toBe(1);
    expect(elementEdge('dark', 'light')).toBe(1);
  });
  it('gives one to three stars from the health left', () => {
    expect([starsFor(10, 100), starsFor(20, 100), starsFor(49, 100), starsFor(50, 100)]).toEqual([1, 2, 2, 3]);
  });
  it('opens the next tier with two stars, keeps the best stars and pays star milestones once', () => {
    let s = ready('trex', 'water', 20); // water beats fire: three stars against the fire apprentice
    s.stars = {};
    s.cleared = [];
    expect(() => command(s, { type: 'battle', encounterId: 'arena-fire-2' }, 0)).toThrow('stars');
    s = fight(s, 'arena-fire-1');
    expect(s.battle!.result).toBe('victory');
    const stars = s.battle!.stars!;
    expect(stars).toBeGreaterThanOrEqual(2);
    s = command(s, { type: 'claim' }, 0);
    expect(s.stars['arena-fire-1']).toBe(stars);
    expect(command(s, { type: 'battle', encounterId: 'arena-fire-2' }, 0).battle?.encounterId).toBe('arena-fire-2');
    // Five stars reach the first milestone, paid with the fight that crosses it, exactly once.
    s.stars['arena-water-1'] = 3;
    const gold = s.gold;
    s = command(fight(s, 'arena-fire-1'), { type: 'claim' }, 0);
    expect(s.starMilestones).toBe(STAR_MILESTONES.filter((m) => m.stars <= 6).length);
    expect(s.gold).toBeGreaterThan(gold + STAR_MILESTONES[0].gold);
    const again = command(fight(s, 'arena-fire-1'), { type: 'claim' }, 0);
    expect(again.starMilestones).toBe(s.starMilestones);
  });
  it('rests a defeated dinosaur for a few minutes before it may fight again', () => {
    let s = ready('trex', 'nature', 14); // fire burns nature: a sure defeat against the fire champion
    s = fight(s, 'arena-fire-3', 1000);
    expect(s.battle!.result).toBe('defeat');
    s = command(s, { type: 'claim' }, 1000);
    expect(() => command(s, { type: 'battle', encounterId: 'arena-fire-1' }, 2000)).toThrow('tired');
    expect(command(s, { type: 'battle', encounterId: 'arena-fire-1' }, 1000 + 3 * 60_000).battle).not.toBeNull();
  });
  it('turns arena fights won before stars existed into two stars on load', () => {
    const base = ready('trex', 'fire', 15);
    base.buildings.push({ id: 'nest', kind: 'hatchery', x: 2, y: 4 });
    const old = JSON.parse(JSON.stringify({ ...base, cleared: ['training', 'arena-fire-1'] }));
    delete old.stars;
    delete old.starMilestones;
    delete old.tired;
    const s = parseSave(JSON.stringify(old));
    expect(s.stars).toEqual({ 'arena-fire-1': 2 });
    expect(s.tired).toEqual({});
  });
});
