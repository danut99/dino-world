import { describe, expect, it } from 'vitest';
import { autoPlay } from './autoBattle';
import { ENCOUNTERS } from './content';
import { playableSpecies } from './playableDinosaurs';
import {
  ARENA_LEVELS,
  ARENA_REST,
  ARENA_SEASON,
  ELEMENTS,
  GEMS,
  SPECIES,
  STAR_MILESTONES,
  command,
  elementEdge,
  newSave,
  parseSave,
  starsFor,
  type Dino,
  type Rarity,
  type RealmId,
  type Save,
} from './game';

/*
 * How the balance targets are measured. Fights are deterministic, so a "win rate" is the share of victories over a
 * sweep of teams, not of repeated fights:
 * - every arena encounter of the tier (all ten leagues, unless a case says otherwise);
 * - every one of the 14 species leading the team, the other members being the next species in SPECIES order
 *   (so each species appears in every position);
 * - common and rare teams (most eggs hatch common, about a fifth rare); epic and legendary teams are stronger;
 * - the team's elements: "neutral" members take elements with no edge on the league (a different one each, in
 *   turn), "edge" members the element that beats it, "disadvantaged" ones the element it beats;
 * - every member at the tier's level plus the case's extra levels (at most 50), adult from level 25.
 */
const ids = ELEMENTS.map((e) => e.id as RealmId);
type Edge = -1 | 0 | 1;
const elementsWith = (league: RealmId, edge: Edge) => ids.filter((x) => elementEdge(x, league) === edge);
const RARITIES_SWEPT: Rarity[] = ['common', 'rare'];

function ready(team: Dino[]): Save {
  const s = newSave(0);
  s.arenaTickets = Object.fromEntries(ELEMENTS.map((e) => [e.id, 100]));
  s.dinos = team;
  s.team = team.map((d) => d.id);
  s.champion = s.team[0];
  s.habitats = Object.fromEntries(ELEMENTS.map((x) => [x.id, 5]));
  s.arenaLevel = ARENA_LEVELS.length;
  s.cleared = ENCOUNTERS.map((x) => x.id);
  s.stars = Object.fromEntries(ENCOUNTERS.map((e) => [e.id, 3]));
  // Every star milestone is already paid: these 90 stars were not won here.
  s.starMilestones = STAR_MILESTONES.length;
  s.buildings = [
    { id: 'a', kind: 'arena', x: 0, y: 0 },
    { id: 'nest', kind: 'hatchery', x: 2, y: 4 },
  ];
  return s;
}
function member(i: number, species: string, element: RealmId, level: number, rarity: Rarity): Dino {
  return { id: `d${i}`, species: species as Dino['species'], element, level, stage: level >= 25 ? 'adult' : 'juvenile', nickname: `T${i}`, rarity };
}
const fight = (s: Save, encounterId: string, now = 0) => autoPlay(command(s, { type: 'battle', encounterId }, now), now);

/** Share of the sweep won on a tier with a team of `size`, the given element edge and extra levels. */
function winRate(tier: number, size: number, edge: Edge, plus: number, leagues = ids) {
  let wins = 0,
    total = 0;
  for (const e of ENCOUNTERS.filter((x) => x.id.endsWith(`-${tier}`) && leagues.includes(x.league as RealmId))) {
    const elements = elementsWith(e.league as RealmId, edge);
    const level = Math.min(50, e.level + plus);
    for (const rarity of RARITIES_SWEPT)
      for (let k = 0; k < SPECIES.length; k++) {
        const team = Array.from({ length: size }, (_, j) =>
          member(j, SPECIES[(k + j) % SPECIES.length], elements[(k + j) % elements.length], level, rarity),
        );
        total++;
        if (fight(ready(team), e.id).battle!.result === 'victory') wins++;
      }
  }
  return wins / total;
}
/** Balance targets (see the sweep above), measured on the real reducer and planner. */
describe('arena balance', () => {
  it('makes a trio at the tier level win apprentices, split veterans and need an edge or levels for champions', () => {
    expect(winRate(1, 3, 0, 0)).toBeGreaterThan(0.95);
    const veteran = winRate(2, 3, 0, 0);
    expect(veteran).toBeGreaterThanOrEqual(0.45);
    expect(veteran).toBeLessThanOrEqual(0.75);
    expect(winRate(3, 3, 0, 0)).toBeLessThan(0.35);
    expect(winRate(3, 3, 1, 0)).toBeGreaterThan(0.85);
    expect(winRate(3, 3, 0, 5)).toBeGreaterThan(0.75);
    expect(winRate(3, 3, -1, 0)).toBeLessThanOrEqual(0.1);
  });
  it('lets a single dinosaur eight levels above the tier win apprentices and most veterans', () => {
    expect(winRate(1, 1, 0, 8)).toBeGreaterThan(0.9);
    expect(winRate(2, 1, 0, 8)).toBeGreaterThan(0.5);
  });
  it('wheels every element: exactly one it beats and exactly one that beats it', () => {
    for (const a of ids) {
      expect(ids.filter((b) => elementEdge(a, b) === 1).length, a).toBe(1);
      expect(ids.filter((b) => elementEdge(a, b) === -1).length, a).toBe(1);
    }
    // Two cycles of five: fire→nature→earth→lightning→water→fire and ice→wind→arcane→dark→light→ice.
    for (const cycle of [['fire', 'nature', 'earth', 'lightning', 'water'], ['ice', 'wind', 'arcane', 'dark', 'light']] as RealmId[][])
      cycle.forEach((a, i) => expect(elementEdge(a, cycle[(i + 1) % 5]), a).toBe(1));
  });
  it('opens leagues at 10 + 4 per world, tiers two levels apart, up to the arcane champion at 50', () => {
    expect(ids.map((id) => ENCOUNTERS.find((e) => e.id === `arena-${id}-1`)!.level)).toEqual([10, 14, 18, 22, 26, 30, 34, 38, 42, 46]);
    expect([1, 2, 3].map((t) => ENCOUNTERS.find((e) => e.id === `arena-arcane-${t}`)!.level)).toEqual([46, 48, 50]);
    // First wins: 20 gold and 8 food per level, half again per tier.
    expect(ENCOUNTERS.find((e) => e.id === 'arena-fire-1')).toMatchObject({ gold: 200, food: 80 });
    expect(ENCOUNTERS.find((e) => e.id === 'arena-fire-3')).toMatchObject({ gold: 560, food: 224 });
  });
});

describe('arena team fights', () => {
  // Families that exist in the game, so the saves survive a reload.
  const trio = (level = 20, element: RealmId = 'water') =>
    [0, 1, 2].map((i) => member(i, playableSpecies(element)[i % playableSpecies(element).length], element, level, 'common'));
  it('gives stars from the whole team health: three only with nobody fallen', () => {
    expect([starsFor(10, 100), starsFor(20, 100), starsFor(49, 100), starsFor(50, 100)]).toEqual([1, 2, 2, 3]);
    expect(starsFor(80, 100, true)).toBe(2);
    expect(starsFor(10, 100, true)).toBe(1);
  });
  it('sets a team of one to three able dinosaurs, champion first', () => {
    let s = ready(trio());
    s.dinos.push({ id: 'baby', species: 'trex', element: 'fire', level: 3, stage: 'baby', nickname: 'B' });
    for (const bad of [[], ['d0', 'd0'], ['d0', 'd1', 'd2', 'baby'], ['nobody']])
      expect(() => command(s, { type: 'setTeam', dinoIds: bad }, 0)).toThrow();
    expect(() => command(s, { type: 'setTeam', dinoIds: ['baby'] }, 0)).toThrow('juvenile');
    s = command(s, { type: 'setTeam', dinoIds: ['d2', 'd0'] }, 0);
    expect(s).toMatchObject({ team: ['d2', 'd0'], champion: 'd2' });
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    s.tired = { d1: 60_000 };
    expect(() => command(s, { type: 'setTeam', dinoIds: ['d1'] }, 0)).toThrow('tired');
    // A team member busy in a fight cannot be swapped out or fed.
    const fighting = command(s, { type: 'battle', encounterId: 'arena-fire-1' }, 0);
    expect(() => command(fighting, { type: 'setTeam', dinoIds: ['d0'] }, 0)).toThrow('unavailable');
    expect(() => command(fighting, { type: 'feed', dinoId: 'd0' }, 0)).toThrow('unavailable');
  });
  it('pays the team bonus: ×1.1 for two dinosaurs and ×1.2 for three', () => {
    const s = ready(trio());
    s.cleared = [];
    s.arenaLevel = 1;
    const gold = (team: string[]) => command({ ...s, team, champion: team[0] }, { type: 'battle', encounterId: 'arena-fire-1' }, 0).battle!.reward.gold;
    expect([gold(['d0']), gold(['d0', 'd1']), gold(['d0', 'd1', 'd2'])]).toEqual([200, 220, 240]);
  });
  it('opens the next tier with two stars, keeps the best stars and pays star milestones once', () => {
    let s = ready(trio(20));
    s.stars = {};
    s.starMilestones = 0;
    s.cleared = [];
    expect(() => command(s, { type: 'battle', encounterId: 'arena-fire-2' }, 0)).toThrow('stars');
    s = fight(s, 'arena-fire-1');
    expect(s.battle!.result).toBe('victory');
    const stars = s.battle!.stars!;
    expect(stars).toBeGreaterThanOrEqual(2);
    s = command(s, { type: 'claim' }, 0);
    expect(s.stars['arena-fire-1']).toBe(stars);
    s.tired = {};
    expect(command(s, { type: 'battle', encounterId: 'arena-fire-2' }, 0).battle?.encounterId).toBe('arena-fire-2');
    // Five stars reach the first milestone, paid with the fight that crosses it, exactly once.
    s.stars['arena-water-1'] = 3;
    const gold = s.gold,
      gems = s.gems;
    s = command(fight(s, 'arena-fire-1'), { type: 'claim' }, 0);
    expect(s.starMilestones).toBe(STAR_MILESTONES.filter((m) => m.stars <= 6).length);
    expect(s.gold).toBeGreaterThan(gold + STAR_MILESTONES[0].gold);
    // Its diamonds come with it, announced once.
    expect(s.gems).toBe(gems + STAR_MILESTONES[0].gems);
    expect(s.notice?.gems).toBe(STAR_MILESTONES[0].gems);
    s.tired = {};
    const again = command(fight(s, 'arena-fire-1'), { type: 'claim' }, 0);
    expect(again.starMilestones).toBe(s.starMilestones);
    expect(again.gems).toBe(s.gems);
  });
  it('rests the team after a fight: by tier after a win, longer for the fallen, twenty minutes after a defeat', () => {
    // A weak member placed first falls; the two strong ones behind it win.
    let s = ready([member(0, 'raptor', 'nature', 12, 'common'), member(1, 'trex', 'water', 24, 'epic'), member(2, 'trex', 'water', 24, 'epic')]);
    s = fight(s, 'arena-fire-2', 1000);
    expect(s.battle!.result).toBe('victory');
    expect(s.battle!.team[0].hp).toBe(0);
    for (const a of s.battle!.team) expect(s.tired[a.dinoId], a.dinoId).toBe(1000 + 60_000 * (a.hp === 0 ? ARENA_REST.fallen : ARENA_REST.win[1]));
    expect(s.battle!.stars).toBeLessThanOrEqual(2);
    s = command(s, { type: 'claim' }, 1000);
    expect(() => command(s, { type: 'battle', encounterId: 'arena-fire-1' }, 2000)).toThrow('tired');
    // Wake one dinosaur for 3 diamonds, or the whole team for at most 6.
    s.gems = 20;
    const one = command(s, { type: 'gemRest', dinoId: 'd1' }, 2000);
    expect(one.gems).toBe(20 - GEMS.rest);
    expect(one.tired.d1).toBeUndefined();
    const all = command(s, { type: 'gemRest', team: true }, 2000);
    expect(all.gems).toBe(20 - GEMS.restTeam);
    expect(all.team.every((id) => !all.tired[id])).toBe(true);
    expect(command(all, { type: 'battle', encounterId: 'arena-fire-1' }, 2000).battle).not.toBeNull();
    expect(() => command(all, { type: 'gemRest', team: true }, 2000)).toThrow('rested');
    // A defeat rests every member twenty minutes.
    let lost = ready([member(0, 'trex', 'nature', 14, 'common')]);
    lost = fight(lost, 'arena-fire-3', 1000);
    expect(lost.battle!.result).toBe('defeat');
    expect(lost.tired.d0).toBe(1000 + ARENA_REST.defeat * 60_000);
    expect(command(lost, { type: 'claim' }, 1000).tired.d0).toBe(1000 + ARENA_REST.defeat * 60_000);
  });
  it('keeps a relay fight, its stars and the rest through a reload', () => {
    let s = ready(trio(14, 'nature'));
    s = command(s, { type: 'battle', encounterId: 'arena-fire-3' }, 1000);
    s = command(s, { type: 'action', action: 'basic' }, 1000);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    // A tampered fight is refused: foes must be the encounter's, mirrors must follow the fighters on stage.
    const tampered = structuredClone(s);
    tampered.battle!.foes[0].power = 1;
    expect(() => parseSave(JSON.stringify(tampered))).toThrow('Invalid battle');
    const mirror = structuredClone(s);
    mirror.battle!.hp = mirror.battle!.maxHp + 1;
    expect(() => parseSave(JSON.stringify(mirror))).toThrow('Invalid battle');
    s = command(autoPlay(s, 1000), { type: 'claim' }, 1000);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    expect(s.tired.d0).toBeGreaterThan(1000);
  });
});

describe('weekly arena season', () => {
  const monday = Date.UTC(2026, 9, 26, 9); // Monday 26 October 2026, morning in Bucharest
  it('pays 5, 15 and 30 wins once each, with the claim of the win that reaches them, and restarts on Monday', () => {
    let s = ready([member(0, 'thalassaur', 'water', 30, 'common')]);
    s.habitats = { fire: 1, water: 1, earth: 1 };
    s.arenaLevel = 1;
    s.updatedAt = monday;
    s.arena = { week: '2026-10-26', weekWins: 4, weekClaimed: 0 };
    const before = { gold: s.gold, gems: s.gems };
    s = fight(s, 'arena-fire-1', monday);
    const reward = s.battle!.reward.gold;
    s = command(s, { type: 'claim' }, monday);
    expect(s.arena).toMatchObject({ weekWins: 5, weekClaimed: 1 });
    expect(s.gold).toBe(before.gold + reward + ARENA_SEASON[0].gold);
    expect(s.gems).toBe(before.gems + ARENA_SEASON[0].gems);
    // The 15-win step: diamonds, an evolution crystal and three tickets of an open world.
    s.arena.weekWins = 14;
    s.tired = {};
    const tickets = Object.values(s.arenaTickets).reduce((a, b) => a + (b ?? 0), 0);
    const crystals = s.inventory.evolutionCrystal;
    s = command(fight(s, 'arena-fire-1', monday), { type: 'claim' }, monday);
    expect(s.arena.weekClaimed).toBe(2);
    expect(s.inventory.evolutionCrystal).toBe(crystals + 1);
    expect(Object.values(s.arenaTickets).reduce((a, b) => a + (b ?? 0), 0)).toBe(tickets - 1 + 3);
    s.tired = {};
    s.arena.weekWins = 29;
    const kits = s.inventory.habitatKit;
    s = command(fight(s, 'arena-fire-1', monday), { type: 'claim' }, monday);
    expect(s.arena.weekClaimed).toBe(3);
    expect(s.inventory.habitatKit).toBe(kits + 1);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    // A new week starts over.
    const next = command(s, { type: 'collectAvailable' }, monday + 7 * 24 * 3_600_000);
    expect(next.arena).toEqual({ week: '2026-11-02', weekWins: 0, weekClaimed: 0 });
  });
});
