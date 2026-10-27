import { describe, expect, it } from 'vitest';
import {
  advance,
  BOOST_CAP,
  command,
  feedCost,
  friendCollect,
  friendlyBattle,
  goldCap,
  LEGEND_TRIAL,
  legendTrialsLeft,
  newSave,
  OutdatedSave,
  parseSave,
  PET,
  QUEST_EGGS,
  TRAINING,
  TREASURE,
  treasureReady,
  type Save,
} from './game';
import { project, unproject } from './World';
const now = 1_800_000_000_000;
function juvenile(): Save {
  let s = command(newSave(now), { type: 'incubate' }, now);
  s = command(s, { type: 'hatch' }, now + 30_000);
  s.food = 1000;
  for (let i = 0; i < 8; i++) s = command(s, { type: 'feed' }, now + 30_000);
  return command(s, { type: 'evolve' }, now + 30_000);
}
describe('friendCollect', () => {
  it('empties the storage when the friend collected, so it fills again after', () => {
    const s = juvenile();
    s.storedGold = goldCap(s);
    const later = s.updatedAt + 8 * 3_600_000,
      alone = advance(s, later),
      helped = friendCollect(s, [s.updatedAt + 3_600_000], later);
    expect(alone.storedGold).toBe(goldCap(s));
    expect(helped.gold + helped.storedGold).toBeGreaterThan(alone.gold + alone.storedGold);
    expect(helped.revision).toBe(s.revision + 1);
    expect(friendCollect(s, [], later)).toBe(s);
  });
});
describe('things to do while waiting', () => {
  it('pets a few times a day, trains for a free level, and finds treasures two hours apart', () => {
    let s = juvenile();
    const t = now + 60_000,
      id = s.dinos[0].id,
      level = s.dinos[0].level,
      food = s.food;
    for (let i = 0; i < PET.perDay; i++) s = command(s, { type: 'pet', dinoId: id }, t);
    expect(s.food).toBe(food + PET.food * PET.perDay);
    expect(() => command(s, { type: 'pet', dinoId: id }, t)).toThrow('petsDone');
    s = command(s, { type: 'train', dinoId: id }, t);
    expect(() => command(s, { type: 'train', dinoId: id }, t)).toThrow('training');
    expect(() => command(s, { type: 'claimTraining' }, t + 60_000)).toThrow('training');
    s = command(s, { type: 'claimTraining' }, t + TRAINING.minutes * 60_000);
    expect(s.dinos[0].level).toBe(level + 1);
    expect(s.training).toBeNull();
    expect(parseSave(JSON.stringify(s)).training).toBeNull();
    const at = t + TRAINING.minutes * 60_000;
    expect(treasureReady(s, at)).toBe(true);
    s = command(s, { type: 'treasure' }, at);
    expect(treasureReady(s, at + 60_000)).toBe(false);
    expect(() => command(s, { type: 'treasure' }, at + 60_000)).toThrow('treasure');
    expect(treasureReady(s, at + TREASURE.everyMs)).toBe(true);
  });
});
describe('friendlyBattle', () => {
  it("fights the friend's team to the end without touching tickets, rest or rewards", async () => {
    const { autoPlay } = await import('./autoBattle');
    const me = juvenile(),
      rival = juvenile();
    rival.dinos[0].level = 12;
    const start = friendlyBattle(me, rival, 'u2', now + 60_000);
    expect(start.battle).toMatchObject({ encounterId: 'friend:u2', foeIndex: 0, result: null });
    expect(start.battle!.foes[0]).toMatchObject({ species: 'trex', element: 'fire', level: 12 });
    const end = autoPlay(start, now + 60_000);
    expect(end.battle!.result).not.toBeNull();
    expect(end.tired).toEqual(me.tired);
    expect(end.rewardPending).toBe(false);
    expect(end.gold).toBe(advance(me, now + 60_000).gold);
    expect(() => friendlyBattle(me, newSave(now), 'u3', now)).toThrow('rivalTeam');
  });
});
/** Juvenile Ignis at level 15 with the arena built and fire tickets. */
function fighter(): Save {
  let s = juvenile();
  s.dinos[0].level = 15;
  s = command(s, { type: 'build', kind: 'arena', x: 1, y: 8 }, now + 30_000);
  s.arenaTickets.fire = 5;
  return s;
}
describe('Dino Realms first playable path', () => {
  it('refuses saves from before the v6 reset, and habitats on the main island', () => {
    for (const schemaVersion of [1, 4, 5, 7]) {
      const error = (() => {
        try {
          parseSave(JSON.stringify({ ...juvenile(), schemaVersion }));
        } catch (e) {
          return e;
        }
      })();
      expect(error).toBeInstanceOf(OutdatedSave);
    }
    expect(() => parseSave(JSON.stringify({ gold: 5 }))).toThrow(OutdatedSave);
    expect(() => parseSave('null')).toThrow('Invalid save');
    const invalid = newSave(now);
    invalid.buildings.push({ id: 'home', kind: 'habitat', x: 7, y: 4 });
    expect(() => parseSave(JSON.stringify(invalid))).toThrow('Invalid buildings');
  });
  it('resumes incubation and hatches once without duplicating the dinosaur', () => {
    const s = parseSave(JSON.stringify(command(newSave(now), { type: 'incubate' }, now)));
    expect(() => command(s, { type: 'hatch' }, now + 29_999)).toThrow();
    const hatched = command(s, { type: 'hatch' }, now + 30_000);
    expect(hatched.dinos).toMatchObject([{ nickname: 'Ignis', level: 1 }]);
    expect(hatched).toMatchObject({ champion: 'ignis', team: ['ignis'], discovered: ['trex_fire'] });
    expect(() => command(hatched, { type: 'hatch' }, now + 30_000)).toThrow();
  });
  it('locks at evolution thresholds, charges 482 food to reach juvenile and a crystal for adult', () => {
    let s = command(newSave(now), { type: 'incubate' }, now);
    s = command(s, { type: 'hatch' }, now + 30_000);
    s.food = 1000;
    expect(() => command(s, { type: 'battle', encounterId: 'arena-fire-1' }, now + 30_000)).toThrow('juvenile');
    // Feeding several times stops at the evolution gate.
    s = command(s, { type: 'feed', times: 10 }, now + 30_000);
    expect(s.dinos[0].level).toBe(9);
    expect(() => command(s, { type: 'feed' }, now + 30_000)).toThrow('evolve');
    s = command(s, { type: 'evolve' }, now + 30_000);
    expect(s.dinos[0]).toMatchObject({ stage: 'juvenile', level: 10 });
    expect(s.food).toBe(1000 - 482);
    expect(() => command(s, { type: 'feed', times: 11 }, now + 30_000)).toThrow('feed');
    // ...and when the food runs out.
    s.food = feedCost(10) + feedCost(11) + 1;
    s = command(s, { type: 'feed', times: 5 }, now + 30_000);
    expect(s).toMatchObject({ food: 1, dinos: [{ level: 12 }] });
    s.food = 100_000;
    while (s.dinos[0].level < 24) s = command(s, { type: 'feed', times: 10 }, now + 30_000);
    expect(() => command(s, { type: 'feed' }, now + 30_000)).toThrow('evolve');
    expect(() => command(s, { type: 'evolve' }, now + 30_000)).toThrow('evolutionCrystal');
    s.inventory.evolutionCrystal = 1;
    s = command(s, { type: 'evolve' }, now + 30_000);
    expect(s.dinos[0]).toMatchObject({ stage: 'adult', level: 25 });
    expect(s.inventory.evolutionCrystal).toBe(0);
    expect(s.daily.progress.feed).toBe(3);
  });
  it('raises one level with a crystal anywhere but at an evolution gate', () => {
    let s = juvenile();
    s.inventory.evolutionCrystal = 2;
    s = command(s, { type: 'useCrystal' }, now + 30_000);
    expect(s.dinos[0].level).toBe(11);
    s.dinos[0].level = 24;
    expect(() => command(s, { type: 'useCrystal' }, now + 30_000)).toThrow('level');
  });
  it('validates placement atomically and keeps farm timers across reload', () => {
    const s = newSave(now);
    expect(() => command(s, { type: 'build', x: 2, y: 4 }, now)).toThrow();
    expect(s.gold).toBe(1000);
    expect(() => command(s, { type: 'build', x: 20, y: 0 }, now)).toThrow();
    // The lawn reaches past the original 12×12 square on the sides.
    expect(command(s, { type: 'build', x: 10, y: 0 }, now).buildings.at(-1)).toMatchObject({ x: 10, y: 0 });
    let farm = command(s, { type: 'build', x: 5, y: 8 }, now);
    expect(farm.gold).toBe(900);
    farm = parseSave(JSON.stringify(command(farm, { type: 'plant' }, now)));
    expect(() => command(farm, { type: 'harvest' }, now + 299_999)).toThrow();
    farm = command(farm, { type: 'harvest' }, now + 300_000);
    expect(farm.food).toBe(410);
    expect(() => command(farm, { type: 'harvest' }, now + 300_000)).toThrow();
    expect(() => command(farm, { type: 'move', id: 'farm', x: 2, y: 4 }, now + 300_000)).toThrow();
  });
  it('keeps a free row between the sides of new buildings, but still loads older side-by-side towns', () => {
    const s = newSave(now);
    // The hatchery covers 2..4 × 4..6: a farm right against its side is refused, one row further it fits.
    expect(() => command(s, { type: 'build', x: 5, y: 4 }, now)).toThrow('placement');
    expect(command(s, { type: 'build', x: 6, y: 4 }, now).buildings.at(-1)).toMatchObject({ x: 6, y: 4 });
    // Corners may still meet.
    expect(command(s, { type: 'build', x: 5, y: 7 }, now).buildings.at(-1)).toMatchObject({ x: 5, y: 7 });
    const farm = command(s, { type: 'build', x: 6, y: 4 }, now);
    expect(() => command(farm, { type: 'move', id: 'farm', x: 5, y: 5 }, now)).toThrow('placement');
    const old = structuredClone(s);
    old.buildings.push({ id: 'farm', kind: 'farm', x: 5, y: 4 });
    expect(parseSave(JSON.stringify(old)).buildings).toEqual(old.buildings);
  });
  it('caps offline production, retains fractional gold, and prevents repeated collection', () => {
    const s = juvenile();
    const accrued = advance(s, s.updatedAt + 24 * 3_600_000);
    // A juvenile makes 8 gold an hour, for at most eight hours away.
    expect(accrued.storedGold).toBe(64);
    const collected = command(accrued, { type: 'collect' }, accrued.updatedAt);
    expect(collected.gold).toBe(1064);
    expect(() => command(collected, { type: 'collect' }, accrued.updatedAt)).toThrow();
    expect(advance(accrued, accrued.updatedAt - 10000).storedGold).toBe(64);
  });
  it('resumes deterministic combat and grants victory rewards exactly once', () => {
    const start = fighter();
    let s = command(start, { type: 'battle', encounterId: 'arena-fire-1' }, now + 30_000);
    expect(() => command(s, { type: 'action', action: 'ultimate' }, now + 30_000)).toThrow();
    expect(() => command(s, { type: 'action', action: 'skill' as never }, now + 30_000)).toThrow('action');
    s = command(s, { type: 'action', action: 'basic' }, now + 30_000);
    const round = parseSave(JSON.stringify(s));
    expect(command(s, { type: 'action', action: 'basic' }, now + 30_000)).toEqual(
      command(round, { type: 'action', action: 'basic' }, now + 30_000),
    );
    while (!s.battle?.result) s = command(s, { type: 'action', action: 'basic' }, now + 30_000);
    expect(s.battle.result).toBe('victory');
    const claimed = command(s, { type: 'claim' }, now + 30_000);
    // Fire apprentice, first win, one dinosaur: 20 × level 10 gold and 8 × level 10 food.
    expect(claimed.gold).toBe(start.gold + 200);
    expect(claimed.food).toBe(start.food + 80);
    expect(claimed.arena.weekWins).toBe(1);
    expect(() => command(claimed, { type: 'claim' }, now + 30_000)).toThrow();
    expect(claimed.dinos).toEqual(s.dinos);
  });
  it('unlocks ultimate only for adults and consumes all energy', () => {
    const adult = fighter();
    adult.dinos[0] = { ...adult.dinos[0], level: 25, stage: 'adult' };
    let s = command(adult, { type: 'battle', encounterId: 'arena-fire-1' }, now + 30_000);
    for (let i = 0; i < 4; i++) s = command(s, { type: 'action', action: 'defend' }, now + 30_000);
    expect(s.battle?.energy).toBe(100);
    s = command(s, { type: 'action', action: 'ultimate' }, now + 30_000);
    // The bar empties; a blow taken in the same round charges it a little again.
    expect(s.battle?.energy).toBe(s.battle!.report!.taken > 0 ? 15 : 0);
  });
  it('rejects corrupt imports and overlapping buildings', () => {
    const base = juvenile();
    for (const change of [
      { gold: -1 },
      { food: Infinity },
      {
        dinos: [{ id: 'x', species: 'trex', element: 'fire', level: 25, stage: 'baby', nickname: 'x' }],
        champion: 'x',
        team: ['x'],
      },
      {
        dinos: [{ id: 'x', species: 'dragon', element: 'fire', level: 1, stage: 'baby', nickname: 'x' }],
        champion: 'x',
        team: ['x'],
      },
      {
        dinos: [{ id: 'x', species: 'boss', element: 'fire', level: 5, stage: 'baby', nickname: 'x' }],
        champion: 'x',
        team: ['x'],
      },
      { team: ['ignis', 'ignis'] },
      { eggs: [{ id: 'e', species: 'trex', element: 'void', seconds: 300, hatchAt: null }] },
      { habitats: { fire: 9 } },
      { lamps: 6 },
      { portalLevel: 1 },
      { discovered: ['dragon_fire'] },
      {
        expeditions: [
          {
            id: 't',
            kind: 'stage',
            regionId: 'training',
            team: ['ignis'],
            startedAt: now,
            endsAt: now + 1,
            stage: 0,
            reward: { gold: 1, food: 1, materials: {} },
          },
        ],
      },
      { construction: { target: 'castle', level: 2, startedAt: now, endsAt: now } },
      { arena: { week: 'monday', weekWins: 0, weekClaimed: 0 } },
      { battle: {} },
      { rewardPending: true },
    ]) {
      expect(() => parseSave(JSON.stringify({ ...base, ...change })), JSON.stringify(change)).toThrow();
    }
    const s = newSave(now);
    s.buildings.push({ id: 'farm', kind: 'farm', x: 2, y: 4 });
    expect(() => parseSave(JSON.stringify(s))).toThrow();
    expect(parseSave(JSON.stringify(base))).toEqual(base);
  });
  it('fills fields a v6 save lacks with defaults, but still rejects wrong values', () => {
    const base = juvenile();
    const partial = structuredClone(base) as Partial<Save>;
    for (const key of [
      'gems',
      'boostUntil',
      'lamps',
      'legend',
      'discovered',
      'collectionMilestones',
      'arena',
      'arenaTickets',
      'owedEggs',
      'bossEggsClaimed',
      'stars',
      'starMilestones',
      'tired',
      'expeditions',
      'expeditionProgress',
      'construction',
      'daily',
    ] as const)
      delete partial[key];
    delete (partial.inventory as Partial<Save['inventory']>).crystal;
    const loaded = parseSave(JSON.stringify(partial));
    const fresh = newSave(base.updatedAt);
    expect(loaded).toMatchObject({
      gems: 0,
      boostUntil: 0,
      lamps: 0,
      legend: fresh.legend,
      discovered: [],
      collectionMilestones: 0,
      arena: fresh.arena,
      arenaTickets: {},
      owedEggs: [],
      stars: {},
      tired: {},
      expeditions: [],
      expeditionProgress: {},
      construction: null,
    });
    expect(loaded.inventory.crystal).toBe(0);
    expect(loaded.daily.day).toBe(fresh.daily.day);
    expect(loaded.dinos).toEqual(base.dinos);
    for (const change of [
      { gems: '5' },
      { gems: -1 },
      { lamps: 1.5 },
      { legend: { week: 'monday', trials: 0 } },
      { legend: { week: fresh.legend.week, trials: LEGEND_TRIAL.perWeek + 1 } },
      { discovered: 'trex_fire' },
      { arena: null },
      { stars: { nowhere: 2 } },
      { revision: undefined },
      { buildings: undefined },
    ])
      expect(() => parseSave(JSON.stringify({ ...partial, ...change })), JSON.stringify(change)).toThrow();
  });
  it('lets only a rested, grown dinosaur at home take the lead, keeping up to two valid teammates', () => {
    const t = now + 30_000;
    let s = juvenile();
    s.habitats.water = 1;
    s.habitats.earth = 1;
    const young = (id: string, element: 'water' | 'earth') => ({
      id,
      species: 'raptor' as const,
      element,
      level: 12,
      stage: 'juvenile' as const,
      nickname: id,
    });
    s.dinos.push(young('w1', 'water'), young('w2', 'water'), young('e1', 'earth'), {
      ...young('baby', 'earth'),
      level: 1,
      stage: 'baby',
    });
    s = command(s, { type: 'setTeam', dinoIds: ['ignis', 'w1', 'w2'] }, t);
    expect(() => command(s, { type: 'setChampion', dinoId: 'baby' }, t)).toThrow('juvenile');
    expect(() => command({ ...s, tired: { e1: t + 60_000 } }, { type: 'setChampion', dinoId: 'e1' }, t)).toThrow(
      'tired',
    );
    expect(() => command({ ...s, rewardPending: true }, { type: 'setChampion', dinoId: 'e1' }, t)).toThrow(
      'unavailable',
    );
    // A full team makes room by dropping its last member; a member already in the team only moves up.
    expect(command(s, { type: 'setChampion', dinoId: 'e1' }, t)).toMatchObject({
      champion: 'e1',
      team: ['e1', 'ignis', 'w1'],
    });
    expect(command(s, { type: 'setChampion', dinoId: 'w2' }, t).team).toEqual(['w2', 'ignis', 'w1']);
    // A resting member leaves, so the third one stays.
    expect(command({ ...s, tired: { w1: t + 60_000 } }, { type: 'setChampion', dinoId: 'e1' }, t).team).toEqual([
      'e1',
      'ignis',
      'w2',
    ]);
  });
  it('doubles habitat gold storage while a boost runs, and keeps what was stored after it ends', () => {
    const t = now + 30_000;
    let s = juvenile();
    s.gems = 100;
    s.storedGold = 495;
    expect(advance(s, t + 4 * 3_600_000).storedGold).toBe(goldCap(s));
    s = command(s, { type: 'gemBoost', hours: 4 }, t);
    expect(goldCap(s, t)).toBe(goldCap(s) * BOOST_CAP);
    const boosted = advance(s, t + 4 * 3_600_000);
    // A juvenile makes 8 gold an hour, doubled: 64 in four hours.
    expect(boosted.storedGold).toBe(495 + 64);
    expect(goldCap(boosted, t + 4 * 3_600_000)).toBe(goldCap(s));
    expect(advance(boosted, t + 8 * 3_600_000).storedGold).toBe(495 + 64);
    expect(parseSave(JSON.stringify(boosted))).toEqual(boosted);
  });
  it('opens the weekly Legend trial once the story is finished', () => {
    const t = now + 30_000;
    let s = juvenile();
    s.gold = 50_000;
    s.food = 100_000;
    expect(legendTrialsLeft(s, t)).toBe(0);
    expect(() => command(s, { type: 'legendTrial' }, t)).toThrow('legendLocked');
    s.questEggs = QUEST_EGGS.map((q) => q.id);
    expect(legendTrialsLeft(s, t)).toBe(LEGEND_TRIAL.perWeek);
    const gems = s.gems;
    for (let i = 0; i < LEGEND_TRIAL.perWeek; i++) s = command(s, { type: 'legendTrial' }, t);
    expect(s).toMatchObject({
      gold: 50_000 - 3 * LEGEND_TRIAL.gold,
      food: 100_000 - 3 * LEGEND_TRIAL.food,
      gems: gems + 3 * LEGEND_TRIAL.gems,
      legend: { trials: 3 },
    });
    expect(s.eggs).toHaveLength(3);
    expect(s.eggs.every((e) => e.element === 'fire' && e.species !== 'boss')).toBe(true);
    expect(legendTrialsLeft(s, t)).toBe(0);
    expect(() => command(s, { type: 'legendTrial' }, t)).toThrow('legendWeek');
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    // A new Bucharest week brings them back.
    expect(command(s, { type: 'legendTrial' }, t + 7 * 86_400_000).legend.trials).toBe(1);
    s.food = LEGEND_TRIAL.food - 1;
    expect(() => command(s, { type: 'legendTrial' }, t + 7 * 86_400_000)).toThrow('food');
  });
  it('maps isometric cell centers back to the correct cell', () => {
    for (let x = 0; x < 12; x++)
      for (let y = 0; y < 12; y++) {
        const p = project(x + 0.5, y + 0.5);
        expect(unproject(p.x, p.y)).toEqual({ x, y });
      }
  });
});
