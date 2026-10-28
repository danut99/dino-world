import { describe, expect, it } from 'vitest';
import { RECIPES, REGIONS, regionTeamSize, stageLevel } from './content';
import {
  elementBonus,
  expeditionPlan,
  PATROL,
  patrolPlan,
  patrolReward,
  recommendedElement,
  stageMs,
  stageReward,
  suggestTeam,
} from './expeditionRules';
import {
  advance,
  ARENA_LEVELS,
  BALANCE,
  command,
  currentTrip,
  dinoIncome,
  ELEMENTS,
  newSave,
  parseSave,
  STORY_CHAPTERS,
  worldLock,
  type Dino,
  type Save,
} from './game';

const t0 = 1_800_000_000_000;
/** A playable family of each element used here. */
const FAMILY: Partial<Record<Dino['element'], Dino['species']>> = {
  fire: 'trex',
  water: 'thalassaur',
  earth: 'terrasaur',
};
const dino = (
  id: string,
  element: Dino['element'],
  level: number,
  stage: Dino['stage'] = level >= 25 ? 'adult' : level >= 10 ? 'juvenile' : 'baby',
): Dino => ({
  id,
  species: FAMILY[element] ?? 'trex',
  element,
  level,
  stage,
  nickname: id,
});
/** Four dinosaurs, the portal and the arena built, every world open, nothing explored yet. */
function ready(): Save {
  const s = newSave(t0);
  s.dinos = [dino('f', 'fire', 15), dino('w', 'water', 30), dino('e', 'earth', 30), dino('b', 'fire', 5)];
  s.champion = 'f';
  s.team = ['f'];
  s.eggs = [];
  s.portalLevel = 1;
  s.habitats = Object.fromEntries(ELEMENTS.map((e) => [e.id, 1]));
  s.arenaLevel = ARENA_LEVELS.length;
  s.buildings = [
    { id: 'nest', kind: 'hatchery', x: 2, y: 4 },
    { id: 'a', kind: 'arena', x: 0, y: 0 },
    { id: 'p', kind: 'portal', x: 4, y: 0 },
  ];
  s.discovered = ['trex_fire'];
  return s;
}
const roundTrip = (s: Save) => expect(parseSave(JSON.stringify(s))).toEqual(s);
/** What a reward is worth: gold and food one each, a raw material ten. */
const worth = (r: { gold: number; food: number; materials: Partial<Record<string, number>> }) =>
  r.gold + r.food + 10 * Object.values(r.materials).reduce((a: number, b) => a + (b ?? 0), 0);

describe('expedition regions', () => {
  it('chains ten regions over the worlds in order, five stages each, from level 10 to 50', () => {
    expect(REGIONS.map((r) => r.element)).toEqual(ELEMENTS.map((e) => e.id));
    expect(REGIONS.map((r) => r.id)).toEqual([
      'training',
      'ruins',
      'canyon',
      'frost',
      'lagoon',
      'wind',
      'thunder',
      'twilight',
      'dawn',
      'sigils',
    ]);
    expect(REGIONS[0].name).toEqual(['Pasul de jar', 'Ember pass']);
    expect(REGIONS[3].name).toEqual(['Poiana ferigilor', 'Fern glade']);
    expect(REGIONS[0].minutes).toEqual([1, 3, 7, 15, 25]);
    expect(REGIONS[9].minutes).toEqual([360, 420, 480, 540, 600]);
    for (const r of REGIONS)
      expect(
        [...r.minutes].every((m, i) => i === 0 || m > r.minutes[i - 1]),
        r.id,
      ).toBe(true);
    expect(stageLevel(1, 1)).toBe(10);
    expect(stageLevel(3, 2)).toBe(19);
    expect(stageLevel(10, 5)).toBe(50);
    expect(REGIONS.map((_, i) => regionTeamSize(i + 1))).toEqual([1, 1, 2, 2, 2, 3, 3, 3, 3, 3]);
    // About 220 hours of stages in all.
    expect(REGIONS.reduce((n, r) => n + r.minutes.reduce((a, b) => a + b, 0), 0) / 60).toBeCloseTo(219.1, 1);
    expect(recommendedElement('fire')).toBe('water');
    expect(recommendedElement('ice')).toBe('light');
  });
  it('pays a stage by its minutes and region: gold, food, the region materials and an arena ticket', () => {
    expect(stageReward('training', 0)).toEqual({ gold: 13, food: 5, materials: { wood: 1 }, tickets: 1 });
    expect(stageReward('canyon', 2)).toEqual({
      gold: 525,
      food: 150,
      materials: { stone: 12, crystal: 11 },
      tickets: 1,
    });
    expect(stageReward('sigils', 4)).toMatchObject({
      gold: 4200,
      food: 600,
      materials: { crystal: 45, fiber: 45 },
      tickets: 2,
      gems: 3,
    });
  });
});

describe('timed expeditions with teams', () => {
  it('sends a team on the next stage and pays out once, only after it is back', () => {
    let s = command(ready(), { type: 'expedition', regionId: 'training', team: ['f'] }, t0);
    expect(s.expeditions).toMatchObject([
      { kind: 'stage', regionId: 'training', team: ['f'], stage: 0, endsAt: t0 + 60_000 },
    ]);
    expect(s.battle).toBeNull();
    expect(() => command(s, { type: 'claimExpedition' }, t0 + 1000)).toThrow('expedition');
    const { gold, food } = s;
    s = command(s, { type: 'claimExpedition' }, t0 + 60_000);
    expect(s.gold).toBe(gold + 13);
    expect(s.food).toBe(food + 5);
    expect(s.expeditionProgress.training).toBe(1);
    expect(s.arenaTickets.fire).toBe(1);
    expect(s.expeditions).toEqual([]);
    expect(() => command(s, { type: 'claimExpedition' }, t0 + 10 * 60_000)).toThrow('expedition');
    roundTrip(s);
  });
  it('checks the team size and the level of every member, in the UI plan and the reducer alike', () => {
    const s = ready();
    s.expeditionProgress = { training: 5, ruins: 5 };
    s.inventory.provisions = 9;
    // Canyon ruins: region 3 takes two members at level 18 for its first stage.
    expect(expeditionPlan(s, 'canyon', ['w'])).toMatchObject({
      teamSize: 2,
      level: 18,
      supplies: 2,
      blocker: 'teamSize',
      canSend: false,
    });
    expect(() => command(s, { type: 'expedition', regionId: 'canyon', team: ['w'] }, t0)).toThrow('teamSize');
    expect(() => command(s, { type: 'expedition', regionId: 'canyon', team: ['w', 'w'] }, t0)).toThrow('teamSize');
    expect(() => command(s, { type: 'expedition', regionId: 'canyon', team: ['w', 'e', 'f'] }, t0)).toThrow('teamSize');
    expect(expeditionPlan(s, 'canyon', ['w', 'f']).failing).toEqual([{ id: 'f', reason: 'level' }]);
    expect(() => command(s, { type: 'expedition', regionId: 'canyon', team: ['w', 'f'] }, t0)).toThrow('level');
    s.dinos[3] = dino('b', 'fire', 9);
    expect(() => command(s, { type: 'expedition', regionId: 'canyon', team: ['w', 'b'] }, t0)).toThrow('juvenile');
    expect(() => command(s, { type: 'expedition', regionId: 'canyon', team: ['w', 'ghost'] }, t0)).toThrow('dino');
    expect(expeditionPlan(s, 'canyon', ['w', 'e']).canSend).toBe(true);
    const sent = command(s, { type: 'expedition', regionId: 'canyon', team: ['w', 'e'] }, t0);
    expect(sent.inventory.provisions).toBe(7);
    expect(sent.expeditions[0]).toMatchObject({ team: ['w', 'e'], endsAt: t0 + 90 * 60_000 });
    roundTrip(sent);
    // The suggested team takes the best dinosaurs able to go.
    expect(suggestTeam(s, 'canyon', 'stage').sort()).toEqual(['e', 'w']);
  });
  it('runs as many teams as the portal has slots, each dinosaur in one place only', () => {
    let s = ready();
    s.expeditionProgress = { training: 3 };
    s.inventory.provisions = 5;
    s = command(s, { type: 'expedition', regionId: 'training', team: ['f'] }, t0);
    expect(expeditionPlan(s, 'training', ['w']).blocker).toBe('running');
    expect(patrolPlan(s, 'training', 1, ['w']).blocker).toBe('slots');
    expect(() => command(s, { type: 'patrol', regionId: 'training', hours: 1, team: ['w'] }, t0)).toThrow('slots');
    s.portalLevel = 2;
    expect(() => command(s, { type: 'patrol', regionId: 'training', hours: 1, team: ['f'] }, t0)).toThrow('busy');
    s = command(s, { type: 'patrol', regionId: 'training', hours: 1, team: ['w', 'e'] }, t0);
    expect(s.expeditions).toHaveLength(2);
    roundTrip(s);
    s.portalLevel = 3;
    // One stage run per region at a time.
    expect(() => command(s, { type: 'expedition', regionId: 'training', team: ['b'] }, t0)).toThrow('busy');
    // Busy dinosaurs stay out of the arena, the champion's place and the release.
    expect(() => command(s, { type: 'battle', encounterId: 'arena-fire-1' }, t0)).toThrow('away');
    expect(() => command(s, { type: 'setChampion', dinoId: 'w' }, t0)).toThrow('away');
    expect(() => command(s, { type: 'releaseDino', dinoId: 'e' }, t0)).toThrow('away');
    // Feeding one is fine.
    expect(command({ ...s, food: 10_000 }, { type: 'feed', dinoId: 'f' }, t0).dinos[0].level).toBe(16);
  });
  it('earns no habitat gold while a dinosaur is away, and again from the moment it is back', () => {
    let s = ready();
    s.expeditionProgress = { training: 3 };
    s.inventory.provisions = 1;
    s = command(s, { type: 'patrol', regionId: 'training', hours: 8, team: ['w'] }, t0);
    const rate = (id: string) =>
      dinoIncome(
        s,
        s.dinos.find((d) => d.id === id)!,
      );
    const home = rate('f') + rate('e') + rate('b');
    const at4 = advance(s, t0 + 4 * 3_600_000);
    expect(at4.storedGold - s.storedGold).toBeCloseTo(4 * home, 6);
    // Back at hour 8, claimed or not: from then on it earns again.
    const at10 = advance(at4, t0 + 10 * 3_600_000);
    expect(at10.storedGold - at4.storedGold).toBeCloseTo(6 * home + 2 * rate('w'), 6);
    // Storage still caps the total.
    expect(advance({ ...s, storedGold: 4999 }, t0 + BALANCE.offlineCap).storedGold).toBeLessThanOrEqual(5000);
  });
  it('never repeats a crossed stage', () => {
    const s = ready();
    s.expeditionProgress = { training: 5 };
    expect(expeditionPlan(s, 'training', ['f'])).toMatchObject({ done: true, blocker: 'done', canSend: false });
    expect(() => command(s, { type: 'expedition', regionId: 'training', team: ['f'] }, t0)).toThrow('done');
    // A saved run of a stage already crossed is refused.
    const forged = command(
      { ...ready(), expeditionProgress: { training: 2 } },
      { type: 'expedition', regionId: 'training', team: ['f'] },
      t0,
    );
    forged.expeditionProgress.training = 3;
    expect(() => parseSave(JSON.stringify(forged))).toThrow('Invalid expedition');
  });
  it('opens worlds and regions in order: a world after stage 3 of the previous region, a region after the previous one', () => {
    const s = newSave(t0);
    s.gold = 10_000;
    expect(worldLock(s, 'water')).toEqual({ reason: 'region', world: 'fire' });
    expect(() => command(s, { type: 'unlockHabitat', realm: 'water' }, t0)).toThrow('worldRegion');
    s.expeditionProgress = { training: 2 };
    expect(() => command(s, { type: 'unlockHabitat', realm: 'water' }, t0)).toThrow('worldRegion');
    s.expeditionProgress = { training: 3 };
    expect(worldLock(s, 'water')).toBeNull();
    expect(command(s, { type: 'unlockHabitat', realm: 'water' }, t0).habitats.water).toBe(1);
    expect(() => command(s, { type: 'unlockHabitat', realm: 'earth' }, t0)).toThrow('worldOrder');
    // The region of a world needs that world open and the region before it crossed (5/5).
    const r = ready();
    r.habitats = { fire: 1, water: 1 };
    r.dinos = r.dinos.filter((d) => d.element !== 'earth');
    r.expeditionProgress = { training: 4 };
    r.inventory.provisions = 3;
    expect(expeditionPlan(r, 'ruins', ['w']).blocker).toBe('previous');
    expect(() => command(r, { type: 'expedition', regionId: 'ruins', team: ['w'] }, t0)).toThrow('locked');
    r.expeditionProgress.training = 5;
    expect(expeditionPlan(r, 'ruins', ['w']).canSend).toBe(true);
    r.expeditionProgress.ruins = 5;
    expect(expeditionPlan(r, 'canyon', ['w', 'f']).blocker).toBe('world');
    // Region 1 needs the portal too.
    const noPortal = ready();
    noPortal.portalLevel = 0;
    noPortal.buildings = noPortal.buildings.filter((b) => b.kind !== 'portal');
    expect(() => command(noPortal, { type: 'expedition', regionId: 'training', team: ['f'] }, t0)).toThrow('building');
    expect(() => command(ready(), { type: 'expedition', regionId: 'arena-fire-1', team: ['f'] }, t0)).toThrow(
      'encounter',
    );
  });
  it('adds 20% per member of the recommended element, up to 60%', () => {
    const s = ready();
    expect(elementBonus(s, ['w'], 'water')).toBeCloseTo(0.2);
    expect(elementBonus(s, ['f'], 'water')).toBe(0);
    s.dinos.push(dino('w2', 'water', 30), dino('w3', 'water', 30));
    expect(elementBonus(s, ['w', 'w2', 'w3'], 'water')).toBeCloseTo(0.6);
    const base = expeditionPlan(s, 'training', ['f']).reward,
      boosted = expeditionPlan(s, 'training', ['w']).reward;
    expect(base.gold).toBe(13);
    expect(boosted.gold).toBe(15);
    expect(boosted.food).toBe(6);
    expect(patrolReward('canyon', 3, 3, 0.6).gold).toBe(Math.round(44 * 2.85 * 2.5 * 1.6));
  });
  it('requires supply packs by team size, none in the first region', () => {
    const s = ready();
    s.expeditionProgress = { training: 5, ruins: 5, canyon: 5, frost: 5, lagoon: 5 };
    expect(expeditionPlan(s, 'training', ['f']).supplies).toBe(0);
    expect(expeditionPlan(s, 'ruins', ['w']).supplies).toBe(1);
    expect(expeditionPlan(s, 'wind', []).supplies).toBe(3);
    expect(() =>
      command(
        { ...s, expeditionProgress: { training: 5 } },
        { type: 'expedition', regionId: 'ruins', team: ['w'] },
        t0,
      ),
    ).toThrow('provisions');
  });
  it('survives a reload mid-trip and rejects a tampered timer, stage or team', () => {
    let s = ready();
    s.expeditionProgress = { training: 1 };
    s.gems = 50;
    s = command(s, { type: 'expedition', regionId: 'training', team: ['f'] }, t0);
    roundTrip(s);
    expect(s.expeditions[0].endsAt - s.expeditions[0].startedAt).toBe(stageMs('training', 1));
    for (const tamper of [
      (x: Save['expeditions'][number]) => (x.endsAt = x.startedAt + 1),
      (x: Save['expeditions'][number]) => ((x.stage = 3), (x.endsAt = x.startedAt + stageMs('training', 3))),
      (x: Save['expeditions'][number]) => (x.team = ['f', 'w']),
      (x: Save['expeditions'][number]) => (x.reward.gems = 3),
      (x: Save['expeditions'][number]) => (x.reward.egg = { species: 'triceratops', element: 'nature' }),
    ]) {
      const cheat = structuredClone(s);
      tamper(cheat.expeditions[0]);
      expect(() => parseSave(JSON.stringify(cheat)), tamper.toString()).toThrow('Invalid expedition');
    }
    // Diamonds may bring it back early: then it is marked as rushed.
    const rushed = command(s, { type: 'gemFinish', target: 'expedition', id: s.expeditions[0].id }, t0 + 1000);
    expect(rushed.expeditions[0]).toMatchObject({ endsAt: t0 + 1000, rushed: true });
    roundTrip(rushed);
    expect(() => command(s, { type: 'claimExpedition', runId: 'nope' }, s.expeditions[0].endsAt)).toThrow('expedition');
  });
  it("pays a region's finale: its egg, three diamonds and two tickets, then opens the next region", () => {
    let s = ready();
    s.expeditionProgress = { training: 4 };
    s = command(s, { type: 'expedition', regionId: 'training', team: ['f'] }, t0);
    const run = currentTrip(s)!;
    expect(run.reward).toMatchObject({ tickets: 2, gems: 3, egg: { element: 'fire' } });
    roundTrip(s);
    const { gems } = s;
    s = command(s, { type: 'claimExpedition', runId: run.id }, run.endsAt);
    expect(s.gems).toBe(gems + 3);
    expect(s.arenaTickets.fire).toBe(2);
    expect(s.expeditionProgress.training).toBe(5);
    expect(s.eggs.at(-1)).toMatchObject({ element: 'fire', species: run.reward.egg!.species });
    expect(expeditionPlan(s, 'ruins', ['w']).blocker).toBe('supplies');
    // Most of the time the egg is a family still missing from the collection.
    let fresh = 0;
    for (let i = 0; i < 200; i++) {
      const x = ready();
      x.expeditionProgress = { training: 4 };
      x.revision = i;
      if (
        command(x, { type: 'expedition', regionId: 'training', team: ['f'] }, t0).expeditions[0].reward.egg!.species !==
        'trex'
      )
        fresh++;
    }
    expect(fresh / 200).toBeGreaterThan(0.7);
  });
});

describe('patrols', () => {
  it('open after the third stage and take one supply pack and one to three members', () => {
    let s = ready();
    s.expeditionProgress = { training: 2 };
    s.inventory.provisions = 2;
    expect(patrolPlan(s, 'training', 1, ['f']).blocker).toBe('patrolLocked');
    expect(() => command(s, { type: 'patrol', regionId: 'training', hours: 1, team: ['f'] }, t0)).toThrow(
      'patrolLocked',
    );
    s.expeditionProgress.training = 3;
    expect(() => command(s, { type: 'patrol', regionId: 'training', hours: 2 as 1, team: ['f'] }, t0)).toThrow(
      'teamSize',
    );
    expect(() => command(s, { type: 'patrol', regionId: 'training', hours: 1, team: [] }, t0)).toThrow('teamSize');
    expect(() => command(s, { type: 'patrol', regionId: 'training', hours: 1, team: ['b'] }, t0)).toThrow('juvenile');
    s = command(s, { type: 'patrol', regionId: 'training', hours: 3, team: ['f', 'w', 'e'] }, t0);
    expect(s.inventory.provisions).toBe(1);
    expect(s.expeditions[0]).toMatchObject({
      kind: 'patrol',
      hours: 3,
      endsAt: t0 + 3 * 3_600_000,
      reward: { tickets: 1 },
    });
    roundTrip(s);
  });
  it('pays more than its supply pack costs, in every region and for every length', () => {
    const pack = RECIPES.find((r) => r.id === 'provisions')!;
    const packWorth = (pack.food ?? 0) + 10 * Object.values(pack.cost).reduce((a, b) => a + b, 0);
    for (const r of REGIONS)
      for (const hours of PATROL.hours) {
        const reward = patrolReward(r.id, hours, 1);
        expect(worth(reward), `${r.id} ${hours}h`).toBeGreaterThan(packWorth);
        expect(reward.gold + reward.food, `${r.id} ${hours}h`).toBeGreaterThan(pack.food ?? 0);
      }
    // Longer and bigger patrols pay more in all, a little less per hour.
    const one = patrolReward('canyon', 1, 1).gold,
      three = patrolReward('canyon', 3, 1).gold,
      eight = patrolReward('canyon', 8, 1).gold;
    expect(three).toBeGreaterThan(one);
    expect(eight).toBeGreaterThan(three);
    expect(eight / 8).toBeLessThan(one);
    expect(patrolReward('canyon', 1, 2).gold).toBe(Math.round(44 * 1.8));
    expect(patrolReward('training', 8, 1).tickets).toBe(2);
    expect(patrolReward('training', 1, 1).tickets).toBeUndefined();
  });
  it('pays the first three patrols claimed each day half again', () => {
    let s = ready();
    s.expeditionProgress = { training: 3 };
    s.inventory.provisions = 4;
    s.portalLevel = 3;
    const base = patrolReward('training', 1, 1);
    for (let i = 0; i < 4; i++) {
      s = command(s, { type: 'patrol', regionId: 'training', hours: 1, team: ['f'] }, t0 + i * 3_600_000);
      const gold = s.gold;
      s = command(s, { type: 'claimExpedition' }, t0 + (i + 1) * 3_600_000);
      expect(s.gold - gold, `patrol ${i + 1}`).toBe(i < 3 ? base.gold + Math.round(base.gold * 0.5) : base.gold);
    }
    expect(s.daily.patrols).toBe(4);
    roundTrip(s);
  });
  it('finds an egg of the region about 3% of the time per hour', () => {
    let eggs = 0;
    for (let i = 0; i < 400; i++) {
      const s = ready();
      s.expeditionProgress = { training: 3 };
      s.inventory.provisions = 1;
      s.revision = i;
      const egg = command(s, { type: 'patrol', regionId: 'training', hours: 8, team: ['f'] }, t0).expeditions[0].reward
        .egg;
      if (egg) {
        eggs++;
        expect(egg.element).toBe('fire');
      }
    }
    expect(eggs / 400).toBeGreaterThan(0.15);
    expect(eggs / 400).toBeLessThan(0.35);
  });
});

describe('the story follows the regions', () => {
  it('builds the portal and crosses the fire region in chapter I; every hint names the finale level', () => {
    const ids = STORY_CHAPTERS[0].steps.map((q) => q.id);
    expect(ids.slice(-2)).toEqual(['c1-portal', 'c1-trip']);
    const trip = STORY_CHAPTERS[0].steps.at(-1)!;
    expect(trip.hint[0]).toContain('nivel 14+');
    const s = ready();
    expect(trip.done(s)).toBe(false);
    s.expeditionProgress = { training: 5 };
    expect(trip.done(s)).toBe(true);
    expect(trip.progress!(s)).toEqual([5, 5]);
    const water = STORY_CHAPTERS[1].steps.find((q) => q.id === 'w-water-trip')!;
    expect(water.hint[1]).toContain(`level ${stageLevel(2, 5)}+`);
    const arcane = STORY_CHAPTERS[9].steps.find((q) => q.id === 'w-arcane-trip')!;
    expect(arcane.hint[1]).toContain('3 dinosaurs at level 50+');
  });
});

describe('supply packs', () => {
  it('are crafted from food and materials, and queued packs are refunded on cancellation', () => {
    let s = ready();
    s.buildings.push({ id: 'w', kind: 'workshop', x: 0, y: 4 });
    const food = s.food;
    const wood = s.inventory.wood;
    s = command(s, { type: 'craft', recipeId: 'provisions' }, 0);
    expect(s.food).toBe(food - 30);
    expect(s.inventory.wood).toBe(wood - 2);
    const recipe = RECIPES.find((r) => r.id === 'provisions')!;
    const job = s.crafting[0];
    expect(job.endsAt).toBe(recipe.seconds * 1000);
    s = command(s, { type: 'craft', recipeId: 'provisions' }, 0);
    const queued = s.crafting[1].id;
    s = command(s, { type: 'cancelCraft', jobId: queued }, 0);
    expect(s.food).toBe(food - 30);
    expect(s.inventory.wood).toBe(wood - 2);
    s = command(s, { type: 'claimCraft', jobId: job.id }, job.endsAt);
    expect(s.inventory.provisions).toBe(1);
  });
});
