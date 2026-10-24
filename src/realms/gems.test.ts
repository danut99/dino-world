import { describe, expect, it } from 'vitest';
import { advance, command, GEMS, gemsToFinish, newSave, parseSave, type Save } from './game';

const now = Date.UTC(2026, 9, 25, 12);
const roundTrip = (s: Save) => expect(parseSave(JSON.stringify(s))).toEqual(s);
const rich = () => command(newSave(now), { type: 'addGems', amount: 500 }, now);

describe('diamonds', () => {
  it('start at zero, are added by the test grant within limits, and load into older saves', () => {
    expect(newSave(now).gems).toBe(0);
    expect(rich().gems).toBe(500);
    expect(() => command(newSave(now), { type: 'addGems', amount: 0 }, now)).toThrow('gems');
    expect(() => command(newSave(now), { type: 'addGems', amount: GEMS.maxGrant + 1 }, now)).toThrow('gems');
    const old = JSON.parse(JSON.stringify(newSave(now)));
    delete old.gems;
    delete old.boostUntil;
    expect(parseSave(JSON.stringify(old))).toMatchObject({ gems: 0, boostUntil: 0 });
    expect(() => parseSave(JSON.stringify({ ...newSave(now), gems: -1 }))).toThrow();
  });

  it('cost one diamond per started five minutes of waiting', () => {
    expect(gemsToFinish(0)).toBe(0);
    expect(gemsToFinish(1)).toBe(1);
    expect(gemsToFinish(5 * 60_000)).toBe(1);
    expect(gemsToFinish(5 * 60_000 + 1)).toBe(2);
  });

  it('finish an incubating egg at once, and refuse when there are not enough', () => {
    let s = command(newSave(now), { type: 'incubate' }, now);
    expect(() => command(s, { type: 'gemFinish', target: 'egg', id: s.eggs[0].id }, now)).toThrow('gems');
    s = command(s, { type: 'addGems', amount: 10 }, now);
    s = command(s, { type: 'gemFinish', target: 'egg', id: s.eggs[0].id }, now);
    expect(s.gems).toBe(9);
    expect(s.eggs[0].hatchAt).toBe(now);
    s = command(s, { type: 'hatch' }, now);
    expect(s.dinos).toHaveLength(1);
    roundTrip(s);
  });

  it('double habitat gold while a boost runs, and stack a second boost on the first', () => {
    const base = advance({ ...rich(), dinos: [{ id: 'd', species: 'trex', element: 'fire', level: 10, stage: 'juvenile', nickname: 'Ignis' }], champion: 'd' } as Save, now);
    const plain = advance(base, now + 3_600_000).storedGold;
    let boosted = command(base, { type: 'gemBoost', hours: 1 }, now);
    expect(boosted.gems).toBe(500 - GEMS.boost[1]);
    expect(advance(boosted, now + 3_600_000).storedGold).toBeCloseTo(plain * 2);
    // Half the next two hours are boosted: 1.5 times the plain rate.
    expect(advance(boosted, now + 2 * 3_600_000).storedGold).toBeCloseTo(advance(base, now + 2 * 3_600_000).storedGold * 1.5);
    boosted = command(boosted, { type: 'gemBoost', hours: 4 }, now);
    expect(boosted.boostUntil).toBe(now + 5 * 3_600_000);
    roundTrip(boosted);
  });

  it('trade for gold or food, and wake a tired champion', () => {
    let s = rich();
    const { gold, food } = s;
    s = command(s, { type: 'gemTrade', offer: 'gold' }, now);
    s = command(s, { type: 'gemTrade', offer: 'food' }, now);
    expect(s).toMatchObject({ gold: gold + 1000, food: food + 500, gems: 480 });
    s = { ...s, dinos: [{ id: 'd', species: 'trex', element: 'fire', level: 10, stage: 'juvenile', nickname: 'Ignis' }], champion: 'd' };
    expect(() => command(s, { type: 'gemRest' }, now)).toThrow('rested');
    s.tired = { d: now + 60_000 };
    s = command(s, { type: 'gemRest' }, now);
    expect(s.tired.d).toBeUndefined();
    expect(s.gems).toBe(480 - GEMS.rest);
  });

  it('finish a growing farm plot, which can then be harvested', () => {
    let s = command(rich(), { type: 'build', kind: 'farm', x: 5, y: 8 }, now);
    s = command(s, { type: 'plant' }, now);
    const plot = s.plots.findIndex((p) => p);
    expect(() => command(s, { type: 'harvest', plot }, now)).toThrow('timer');
    const gems = s.gems;
    s = command(s, { type: 'gemFinish', target: 'plot', plot }, now);
    expect(s.gems).toBe(gems - 1);
    const food = s.food;
    s = command(s, { type: 'harvest', plot }, now);
    expect(s.food).toBeGreaterThan(food);
    expect(() => command(s, { type: 'gemFinish', target: 'plot', plot }, now)).toThrow('timer');
    roundTrip(s);
  });

  it('buy extra turns of the daily wheel once the free one is used', () => {
    let s = rich();
    expect(() => command(s, { type: 'gemSpin' }, now)).toThrow('dailyFree');
    s = command(s, { type: 'spinDaily' }, now);
    const { gold, food, gems } = s;
    s = command(s, { type: 'gemSpin' }, now);
    expect(s.gems).toBe(gems - GEMS.spin);
    expect(s.gold + s.food).toBeGreaterThanOrEqual(gold + food);
    expect(s.daily.spin).not.toBeNull();
    roundTrip(s);
    expect(() => command({ ...s, gems: GEMS.spin - 1 }, { type: 'gemSpin' }, now)).toThrow('gems');
  });

  it('keep the save loadable after finishing a craft or an expedition early', () => {
    let s = command(rich(), { type: 'build', kind: 'workshop', x: 6, y: 1 }, now);
    s.inventory.wood = 50;
    s = command(s, { type: 'craft', recipeId: 'planks' }, now);
    s = command(s, { type: 'craft', recipeId: 'planks' }, now);
    const [first, second] = s.crafting;
    s = command(s, { type: 'gemFinish', target: 'craft', id: first.id }, now + 1000);
    expect(s.crafting[0].endsAt).toBe(now + 1000);
    // The job queued behind it moves up by the time saved, keeping its own length.
    expect(s.crafting[1].endsAt - s.crafting[1].startedAt).toBe(second.endsAt - second.startedAt);
    expect(s.crafting[1].startedAt).toBeLessThan(second.startedAt);
    roundTrip(s);
    s = { ...s, dinos: [{ id: 'd', species: 'trex', element: 'fire', level: 12, stage: 'juvenile', nickname: 'Ignis' }], champion: 'd' };
    s = command(s, { type: 'expedition', encounterId: 'training' }, now);
    s = command(s, { type: 'gemFinish', target: 'expedition' }, now + 1000);
    expect(s.expedition!.endsAt).toBe(now + 1000);
    roundTrip(s);
  });

  it('repair, once, a save whose timers were finished with diamonds before they were marked', () => {
    let s = command(rich(), { type: 'build', kind: 'workshop', x: 6, y: 1 }, now);
    s.inventory.wood = 50;
    s = command(s, { type: 'craft', recipeId: 'planks' }, now);
    s = command(s, { type: 'gemFinish', target: 'craft', id: s.crafting[0].id }, now + 1000);
    const old = JSON.parse(JSON.stringify(s));
    delete old.timersVersion;
    delete old.crafting[0].rushed;
    expect(parseSave(JSON.stringify(old)).crafting[0].rushed).toBe(true);
    // With the marker present, a shortened timer without the mark is still refused.
    const forged = JSON.parse(JSON.stringify(s));
    delete forged.crafting[0].rushed;
    expect(() => parseSave(JSON.stringify(forged))).toThrow('Invalid crafting');
  });
});
