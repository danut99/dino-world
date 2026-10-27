import { describe, expect, it } from 'vitest';
import { weekId } from './daily';
import {
  ELEMENTS,
  TOWER_FLOORS,
  TOWER_REWARDS,
  command,
  isTower,
  newSave,
  parseSave,
  towerBase,
  towerFoes,
  towerRule,
  type Command,
  type Dino,
  type Save,
} from './game';

const now = 1_800_000_000_000,
  week = weekId(now);
const run = (s: Save, ...cs: Command[]) => cs.reduce((x, c) => command(x, c, now), s);

function ready(level = 30): Save {
  const s = newSave(now);
  s.dinos = Array.from({ length: 3 }, (_, i): Dino => ({
    id: `d${i}`,
    species: 'trex',
    element: 'fire',
    level,
    stage: level >= 25 ? 'adult' : 'juvenile',
    nickname: `T${i}`,
  }));
  s.team = s.dinos.map((d) => d.id);
  s.champion = 'd0';
  s.habitats = { ...Object.fromEntries(ELEMENTS.map((e) => [e.id, 1])), fire: 2 };
  s.buildings = [
    { id: 'nest', kind: 'hatchery', x: 2, y: 4 },
    { id: 'a', kind: 'arena', x: 6, y: 1 },
  ];
  s.eggs = [];
  return s;
}
/** Plays the current fight to the end; `win` leaves every foe on 1 hp first. */
function finish(s: Save, win = true): Save {
  if (win) for (const f of s.battle!.foes) f.hp = 1;
  else for (const a of s.battle!.team) a.hp = 1;
  let x = s;
  while (!x.battle!.result) x = command(x, { type: 'action', action: win ? 'basic' : 'defend' }, now);
  return x;
}

describe('weekly tower', () => {
  it('floors are fixed per week and scale from the team level', () => {
    for (let n = 1; n <= TOWER_FLOORS; n++) {
      expect(towerFoes(week, n, 30, 'fire')).toEqual(towerFoes(week, n, 30, 'fire'));
      expect(towerRule(week, n)).toBe(towerRule(week, n));
      const foes = towerFoes(week, n, 30, 'fire');
      expect(foes.length).toBeGreaterThanOrEqual(1);
      expect(foes.length).toBeLessThanOrEqual(4);
      expect(foes.filter((f) => !f.boss).every((f) => f.level === 30 + n - 4)).toBe(true);
    }
    // No family twice on a floor, over many weeks (element floors included).
    for (let d = 0; d < 40; d++) {
      const w = new Date(Date.UTC(2030, 0, 7 + 7 * d)).toISOString().slice(0, 10);
      for (let n = 1; n <= TOWER_FLOORS; n++) {
        const regular = towerFoes(w, n, 30, 'fire').filter((f) => !f.boss);
        expect(new Set(regular.map((f) => f.species)).size, `${w} floor ${n}`).toBe(regular.length);
      }
    }
    expect(towerFoes(week, 5, 30, 'fire').at(-1)!.boss).toBe(true);
    expect(towerFoes(week, TOWER_FLOORS, 30, 'fire').at(-1)!.boss).toBe(true);
    const other = '2030-01-07';
    expect(
      Array.from({ length: TOWER_FLOORS }, (_, i) => JSON.stringify(towerFoes(other, i + 1, 30, 'fire'))),
    ).not.toEqual(Array.from({ length: TOWER_FLOORS }, (_, i) => JSON.stringify(towerFoes(week, i + 1, 30, 'fire'))));
    expect(towerBase([{ level: 3 }])).toBe(10);
    expect(towerBase([{ level: 20 }, { level: 44 }])).toBe(44);
  });

  it('towerFight starts the next floor without tickets', () => {
    const s = run(ready(), { type: 'towerFight' });
    expect(s.battle!.encounterId).toBe(`tower:${week}:1`);
    expect(isTower(s.battle!.encounterId)).toBe(true);
    expect(s.arenaTickets).toEqual({});
    expect(s.battle!.foes.every((f) => f.level === 27)).toBe(true);
    expect(() => run(s, { type: 'towerFight' })).toThrow('juvenile');
  });

  it('needs the arena, a grown team at home and rested', () => {
    const noArena = ready();
    noArena.buildings = noArena.buildings.filter((b) => b.kind !== 'arena');
    expect(() => run(noArena, { type: 'towerFight' })).toThrow('building');
    const tired = ready();
    tired.tired = { d0: now + 60_000 };
    expect(() => run(tired, { type: 'towerFight' })).toThrow('tired');
  });

  it('a victory climbs a floor with no rest and no arena rewards', () => {
    const s = ready(),
      won = finish(run(s, { type: 'towerFight' }));
    expect(won.battle!.result).toBe('victory');
    expect(won.tower.floor).toBe(1);
    expect(won.tired).toEqual({});
    expect(won.rewardPending).toBe(false);
    const back = run(won, { type: 'claim' });
    expect(back.battle).toBeNull();
    expect(back.gold).toBe(s.gold);
    expect(back.victories).toBe(0);
    expect(back.arena.weekWins).toBe(0);
    expect(run(back, { type: 'towerFight' }).battle!.encounterId).toBe(`tower:${week}:2`);
  });

  it('a defeat keeps the floor and does not tire the team', () => {
    const lost = finish(run(ready(), { type: 'towerFight' }), false);
    expect(lost.battle!.result).not.toBe('victory');
    expect(lost.tower.floor).toBe(0);
    expect(lost.tired).toEqual({});
  });

  it('tower fights survive a reload', () => {
    const s = run(ready(), { type: 'towerFight' }, { type: 'action', action: 'basic' });
    expect(parseSave(JSON.stringify(s)).battle).toEqual(s.battle);
    const top = ready(50);
    top.tower.floor = TOWER_FLOORS - 1;
    const boss = run(top, { type: 'towerFight' });
    expect(parseSave(JSON.stringify(boss)).battle!.foes.at(-1)!.boss).toBe(true);
    const forged = structuredClone(boss);
    forged.battle!.foes[0].power += 1;
    expect(() => parseSave(JSON.stringify(forged))).toThrow('Invalid battle');
  });

  it('pays each chest once a week', () => {
    let s = ready();
    s.tower.floor = 5;
    expect(() => run(s, { type: 'claimTower', floor: 6 })).toThrow('towerFloor');
    s = run(s, { type: 'claimTower', floor: 3 });
    expect(s.gold).toBe(ready().gold + TOWER_REWARDS[3].gold!);
    expect(s.tower.claimed).toEqual([3]);
    expect(() => run(s, { type: 'claimTower', floor: 3 })).toThrow('towerClaimed');
    s.tower.floor = TOWER_FLOORS;
    s = run(s, { type: 'claimTower', floor: 6 });
    expect(Object.values(s.arenaTickets).reduce((a, b) => a + b, 0)).toBe(TOWER_REWARDS[6].tickets);
    const eggs = s.eggs.length + s.owedEggs.length,
      gems = s.gems;
    s = run(s, { type: 'claimTower', floor: 10 });
    expect(s.gems).toBe(gems + TOWER_REWARDS[10].gems!);
    expect(s.eggs.length + s.owedEggs.length).toBe(eggs + 1);
    expect(() => run(s, { type: 'claimTower', floor: 10 })).toThrow('towerClaimed');
  });

  it('resets when the week changes', () => {
    const s = ready();
    s.tower = { week, floor: 7, claimed: [3, 6] };
    const next = command(s, { type: 'towerFight' }, now + 8 * 86_400_000);
    expect(next.tower.week).not.toBe(week);
    expect(next.tower.floor).toBe(0);
    expect(next.tower.claimed).toEqual([]);
    expect(next.battle!.encounterId).toBe(`tower:${next.tower.week}:1`);
  });

  it('old saves load with a fresh tower; broken towers are refused', () => {
    const s = ready() as Partial<Save>;
    delete s.tower;
    expect(parseSave(JSON.stringify(s)).tower).toEqual({ week, floor: 0, claimed: [] });
    const bad = ready();
    bad.tower = { week, floor: 2, claimed: [3] };
    expect(() => parseSave(JSON.stringify(bad))).toThrow();
    bad.tower = { week, floor: 11, claimed: [] };
    expect(() => parseSave(JSON.stringify(bad))).toThrow();
  });
});
