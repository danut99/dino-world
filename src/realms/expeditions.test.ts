import { describe, expect, it } from 'vitest';
import { ENCOUNTERS, RECIPES } from './content';
import { expeditionPlan } from './expeditionRules';
import { ARENA_LEVELS, ELEMENTS, command, expeditionMs, newSave, parseSave, type Save } from './game';

/** A juvenile champion with the portal and the arena built, every expedition already open. */
function ready(): Save {
  const s = newSave(0);
  s.dinos = [{ id: 'd', species: 'trex', element: 'fire', level: 15, stage: 'juvenile', nickname: 'Ignis' }];
  s.champion = 'd';
  s.eggs = [];
  s.habitats = Object.fromEntries(ELEMENTS.map((e) => [e.id, 1]));
  s.arenaLevel = ARENA_LEVELS.length;
  s.buildings = [
    { id: 'nest', kind: 'hatchery', x: 2, y: 4 },
    { id: 'a', kind: 'arena', x: 0, y: 0 },
    { id: 'p', kind: 'portal', x: 4, y: 0 },
  ];
  return s;
}

describe('timed expeditions', () => {
  it('sends the champion away and pays out once, only after it is back', () => {
    const start = 1_800_000_000_000;
    let s = command(ready(), { type: 'expedition', encounterId: 'training' }, start);
    expect(s.expedition).toMatchObject({ encounterId: 'training', dinoId: 'd', endsAt: start + expeditionMs('training') });
    expect(s.battle).toBeNull();
    expect(() => command(s, { type: 'claimExpedition' }, start + 1000)).toThrow('expedition');
    const gold = s.gold;
    s = command(s, { type: 'claimExpedition' }, start + expeditionMs('training'));
    expect(s.gold).toBe(gold + 250);
    expect(s.cleared).toContain('training');
    expect(s.rewardedTutorial).toBe(true);
    expect(s.expedition).toBeNull();
    expect(() => command(s, { type: 'claimExpedition' }, start + 10 * 60_000)).toThrow();
  });
  it('follows the realms in order, fire first, each destination unlocking the next', () => {
    const chain = ENCOUNTERS.filter((e) => e.mode === 'expedition');
    expect(chain.map((e) => e.image)).toEqual(ELEMENTS.map((e) => e.id));
    expect(chain[0]).toMatchObject({ id: 'training', image: 'fire' });
    chain.forEach((e, i) => expect(e.requires, e.id).toBe(i ? chain[i - 1].id : undefined));
    chain.forEach((e, i) => i && expect(e.level, e.id).toBeGreaterThanOrEqual(chain[i - 1].level));
  });
  it('grows from a one-minute introduction to two-hour final stages', () => {
    const trips = ENCOUNTERS.filter((e) => e.mode === 'expedition').map((e) => expeditionMs(e.id));
    expect(trips[0]).toBe(60_000);
    expect(trips.every((ms, i) => i === 0 || ms > trips[i - 1])).toBe(true);
    expect(expeditionMs('sigils', 2)).toBe(2 * 60 * 60_000);
  });
  it('keeps the champion out of the arena, and allows one expedition at a time', () => {
    const s = command(ready(), { type: 'expedition', encounterId: 'training' }, 0);
    expect(() => command(s, { type: 'battle', encounterId: 'arena-fire-1' }, 1000)).toThrow('away');
    expect(() => command(s, { type: 'expedition', encounterId: 'training' }, 1000)).toThrow('busy');
  });
  it('respects the map order, the level and the portal', () => {
    expect(() => command(ready(), { type: 'expedition', encounterId: 'ruins' }, 0)).toThrow('locked');
    const noPortal = ready();
    noPortal.buildings = noPortal.buildings.filter((b) => b.kind !== 'portal');
    noPortal.cleared = ['training'];
    expect(() => command(noPortal, { type: 'expedition', encounterId: 'ruins' }, 0)).toThrow('building');
    expect(() => command(ready(), { type: 'expedition', encounterId: 'arena-fire-1' }, 0)).toThrow('encounter');
  });
  it('survives a reload mid-trip and rejects a tampered timer', () => {
    const s = command(ready(), { type: 'expedition', encounterId: 'training' }, 0);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    const cheat = structuredClone(s);
    cheat.expedition!.endsAt = 1;
    expect(() => parseSave(JSON.stringify(cheat))).toThrow('Invalid expedition');
  });
  it('requires supplies, consumes them once and opens the next route only after all stages', () => {
    let s = ready();
    s.cleared = ['training'];
    expect(() => command(s, { type: 'expedition', encounterId: 'ruins' }, 0)).toThrow('provisions');
    s.inventory.provisions = 3;
    let now = 0;
    for (let stage = 0; stage < 3; stage++) {
      const plan = expeditionPlan(s, 'ruins');
      expect(plan.stage).toBe(stage);
      expect(plan.canSend).toBe(true);
      s = command(s, { type: 'expedition', encounterId: 'ruins' }, now);
      expect(s.inventory.provisions).toBe(2 - stage);
      expect(s.expedition!.stage).toBe(stage);
      if (stage < 2) expect(s.expedition!.reward.egg).toBeUndefined();
      expect(parseSave(JSON.stringify(s))).toEqual(s);
      const endsAt = s.expedition!.endsAt;
      expect(() => command(s, { type: 'claimExpedition' }, endsAt - 1)).toThrow('expedition');
      s = command(s, { type: 'claimExpedition' }, endsAt);
      now = endsAt;
      expect(s.expeditionProgress.ruins).toBe(stage + 1);
      expect(s.cleared.includes('ruins')).toBe(stage === 2);
      expect(expeditionPlan(s, 'canyon').previous).toBe(stage === 2);
    }
    expect(expeditionPlan(s, 'ruins')).toMatchObject({ completed: 3, stage: 2, stocked: false });
    expect(() => command(s, { type: 'battle', encounterId: 'ruins' }, now)).toThrow('timedExpedition');
  });
  it('raises level requirements per stage and keeps the UI and reducer in agreement', () => {
    const s = ready(); s.cleared = ['training']; s.inventory.provisions = 1;
    s.expeditionProgress.ruins = 2; s.dinos[0].level = 10;
    expect(expeditionPlan(s, 'ruins')).toMatchObject({ stage: 2, level: 12, trained: false, canSend: false });
    expect(() => command(s, { type: 'expedition', encounterId: 'ruins' }, 0)).toThrow('level');
  });
  it('preserves old completed destinations, inventory and already running timers', () => {
    const old = ready() as Save & { expeditionProgress?: Save['expeditionProgress'] };
    old.cleared = ['training', 'ruins'];
    const json = JSON.parse(JSON.stringify(old));
    delete json.expeditionProgress; delete json.inventory.provisions;
    json.expedition = { encounterId: 'canyon', dinoId: 'd', startedAt: 1000, endsAt: 181000, reward: { gold: 220, food: 100, materials: { fiber: 15 } } };
    let s = parseSave(JSON.stringify(json));
    expect(expeditionPlan(s, 'ruins').completed).toBe(3);
    expect(s.inventory.provisions).toBe(0);
    expect(s.expedition!.endsAt).toBe(181000);
    s = command(s, { type: 'claimExpedition' }, 181000);
    expect(s.cleared).toContain('canyon');
    expect(s.expeditionProgress.canyon).toBe(3);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it('rejects invalid progress and skips in a saved trip stage', () => {
    const s = ready();
    expect(() => parseSave(JSON.stringify({ ...s, expeditionProgress: { ruins: 4 } }))).toThrow('Invalid expedition progress');
    expect(() => parseSave(JSON.stringify({ ...s, expeditionProgress: { fake: 1 } }))).toThrow();
    s.cleared = ['training']; s.inventory.provisions = 2;
    const trip = command(s, { type: 'expedition', encounterId: 'ruins' }, 0);
    trip.expedition!.stage = 2;
    trip.expedition!.endsAt = expeditionMs('ruins', 2);
    expect(() => parseSave(JSON.stringify(trip))).toThrow('Invalid expedition');
  });
  it('crafts supply packs from food and materials and refunds queued packs on cancellation', () => {
    let s = ready(); s.buildings.push({ id: 'w', kind: 'workshop', x: 0, y: 4 });
    const food = s.food; const wood = s.inventory.wood;
    s = command(s, { type: 'craft', recipeId: 'provisions' }, 0);
    expect(s.food).toBe(food - 50); expect(s.inventory.wood).toBe(wood - 2);
    const recipe = RECIPES.find(r => r.id === 'provisions')!;
    const job = s.crafting[0];
    expect(job.endsAt).toBe(recipe.seconds * 1000);
    s = command(s, { type: 'craft', recipeId: 'provisions' }, 0);
    const queued = s.crafting[1].id;
    s = command(s, { type: 'cancelCraft', jobId: queued }, 0);
    expect(s.food).toBe(food - 50); expect(s.inventory.wood).toBe(wood - 2);
    s = command(s, { type: 'claimCraft', jobId: job.id }, job.endsAt);
    expect(s.inventory.provisions).toBe(1);
    const poor = ready(); poor.food = 49; poor.buildings.push({ id: 'w', kind: 'workshop', x: 0, y: 4 });
    expect(() => command(poor, { type: 'craft', recipeId: 'provisions' }, 0)).toThrow('food');
    expect(poor.inventory.wood).toBe(wood);
  });
});
