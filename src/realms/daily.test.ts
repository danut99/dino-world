import { describe, expect, it, vi } from 'vitest';
import { command, newSave, parseSave, advance } from './game';
import { dailyQuests, DAILY_QUESTS, normalizeDaily, wheelPrize, WHEEL_PRIZES, type DailyQuestId } from './daily';
const now = Date.UTC(2026, 9, 24, 12);
describe('daily rewards', () => {
  it('awards one spin per UTC day, persists it and resets only on the next day', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const original = newSave(now);
      const won = command(original, { type: 'spinDaily' }, now);
      expect(won.gold).toBe(original.gold + 100);
      expect(won.daily.spin).toBe(0);
      expect(parseSave(JSON.stringify(won))).toEqual(won);
      expect(() => command(won, { type: 'spinDaily' }, now + 1000)).toThrow('dailyClaimed');
      expect(() => command(won, { type: 'spinDaily' }, now - 86400000)).toThrow('dailyClaimed');
      expect(command(won, { type: 'spinDaily' }, Date.UTC(2026, 9, 25)).gold).toBe(won.gold + 100);
    } finally { random.mockRestore(); }
  });
  it('keeps progression, pays quests and completion bonus once, resets counters daily', () => {
    let save = newSave(now);
    const ids = dailyQuests(save.daily.day);
    expect(ids).toHaveLength(3);
    expect(() => command(save, { type: 'claimDailyBonus' }, now)).toThrow('dailyIncomplete');
    expect(() => command(save, { type: 'claimDailyQuest', quest: ids[0] }, now)).toThrow('dailyIncomplete');
    for (const id of ids) {
      save.daily.progress[id] = DAILY_QUESTS[id].target;
      save = command(save, { type: 'claimDailyQuest', quest: id }, now);
      expect(() => command(save, { type: 'claimDailyQuest', quest: id }, now)).toThrow('dailyClaimed');
    }
    const before = save.gold;
    save = command(save, { type: 'claimDailyBonus' }, now);
    expect(save.gold).toBe(before + 200);
    expect(() => command(save, { type: 'claimDailyBonus' }, now)).toThrow('dailyClaimed');
    expect(parseSave(JSON.stringify(save))).toEqual(save);
    const tomorrow = advance(save, now + 86400000);
    expect(tomorrow.daily.claimed).toEqual([]);
    expect(tomorrow.daily.progress.harvest).toBe(0);
    expect(tomorrow.gold).toBe(save.gold);
  });
  it('tracks successful feeding, plot harvests, crafts and completed trips automatically', () => {
    let save = newSave(now);
    save.dinos = [{ id: 'd', species: 'trex', element: 'fire', stage: 'juvenile', level: 10, nickname: 'Ignis' }]; save.champion = 'd';
    save.gold = 10000; save.food = 10000;
    for (const [kind, x, y] of [['farm',5,8],['workshop',6,1]] as const) save = command(save,{type:'build',kind,x,y},now);
    save = command(save, { type: 'feed' }, now);
    expect(save.daily.progress.feed).toBe(1);
    save = command(save,{type:'plant'},now);
    expect(() => command(save,{type:'harvest'},now)).toThrow('timer');
    expect(save.daily.progress.harvest).toBe(0);
    save = command(save,{type:'harvest'},now+60000);
    expect(save.daily.progress.harvest).toBe(1);
    save = command(save,{type:'craft',recipeId:'planks'},now+60000);
    const job = save.crafting[0];
    save = command(save,{type:'claimCraft',jobId:job.id},job.endsAt);
    expect(save.daily.progress.craft).toBe(1);
    save = command(save,{type:'expedition',encounterId:'training'},job.endsAt);
    expect(save.daily.progress.expedition).toBe(0);
    save = command(save,{type:'claimExpedition'},save.expedition!.endsAt);
    expect(save.daily.progress.expedition).toBe(1);
    expect(parseSave(JSON.stringify(save))).toEqual(save);
  });
  it('migrates old saves and rejects invalid or unearned claims', () => {
    const save = newSave(now);
    const old = JSON.parse(JSON.stringify(save)); delete old.daily;
    expect(parseSave(JSON.stringify(old)).daily.day).toBe('2026-10-24');
    // A claim without the progress behind it is dropped on load, so it can never pay out.
    save.daily.claimed = [dailyQuests(save.daily.day)[0]];
    expect(parseSave(JSON.stringify(save)).daily.claimed).toEqual([]);
    const invalid = newSave(now); invalid.daily.spin = 99;
    expect(() => parseSave(JSON.stringify(invalid))).toThrow('Invalid daily');
  });
  it('counts a finished battle only after the result is collected', () => {
    let save = newSave(now);
    save.dinos = [{ id:'d', species:'trex', element:'fire', stage:'juvenile', level:15, nickname:'Ignis' }];
    save.champion = 'd';
    save = command(save,{type:'battle',encounterId:'training'},now);
    for(let i=0;i<30 && !save.battle?.result;i++) save = command(save,{type:'action',action:'basic'},now);
    expect(save.battle?.result).toBeTruthy();
    expect(save.daily.progress.battle).toBe(0);
    save = command(save,{type:'claim'},now);
    expect(save.daily.progress.battle).toBe(1);
    expect(() => command(save,{type:'claim'},now)).toThrow('battle');
  });
  it('uses disclosed weighted prizes and varied daily missions', () => {
    expect(WHEEL_PRIZES.reduce((sum,p) => sum+p.weight,0)).toBe(100);
    expect(wheelPrize(0)).toBe(0); expect(wheelPrize(0.9999)).toBe(7);
    expect(new Set(['2026-10-24','2026-10-25','2026-10-26'].map(day => dailyQuests(day).join(','))).size).toBe(3);
  });
});

describe('daily mission pool', () => {
  it('draws 3 different missions a day, the same all day, varying from day to day', () => {
    const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10));
    for (const day of days) {
      const ids = dailyQuests(day);
      expect(new Set(ids).size).toBe(3);
      expect(dailyQuests(day)).toEqual(ids);
    }
    expect(new Set(days.map((d) => dailyQuests(d).join())).size).toBeGreaterThan(10);
    expect(new Set(days.flatMap((d) => dailyQuests(d))).size).toBe(Object.keys(DAILY_QUESTS).length);
  });
  it('loads a save made with the old missions: new counters start at zero, stale claims are dropped', () => {
    const day = '2026-10-24';
    const today = dailyQuests(day);
    const stale = (Object.keys(DAILY_QUESTS) as DailyQuestId[]).find((id) => !today.includes(id))!;
    const old = { day, progress: { feed: 3, harvest: 2, craft: 1, battle: 1, expedition: 1 }, claimed: [stale], bonus: true, spin: 2 } as never;
    const fixed = normalizeDaily(old);
    expect(fixed.claimed).toEqual([]);
    expect(fixed.bonus).toBe(false);
    expect(fixed.progress.win).toBe(0);
    expect(fixed.spin).toBe(2);
    const save = newSave(Date.UTC(2026, 9, 24, 12));
    expect(() => parseSave(JSON.stringify({ ...save, daily: old }))).not.toThrow();
  });
  it('counts planting, starting crafts, gold collection and battle wins', () => {
    let save = newSave(now);
    save.dinos = [{ id: 'd', species: 'trex', element: 'fire', stage: 'juvenile', level: 15, nickname: 'Ignis' }];
    save.champion = 'd';
    save.gold = 10000; save.food = 10000;
    for (const [kind, x, y] of [['farm', 5, 8], ['workshop', 6, 1]] as const) save = command(save, { type: 'build', kind, x, y }, now);
    save = command(save, { type: 'plant' }, now);
    expect(save.daily.progress.plant).toBe(1);
    save = command(save, { type: 'craft', recipeId: 'planks' }, now);
    expect(save.daily.progress.startCraft).toBe(1);
    save.storedGold = 50;
    save = command(save, { type: 'collect' }, now);
    expect(save.daily.progress.collect).toBe(1);
    save = command(save, { type: 'battle', encounterId: 'training' }, now);
    for (let i = 0; i < 30 && !save.battle?.result; i++) save = command(save, { type: 'action', action: 'basic' }, now);
    expect(save.battle?.result).toBe('victory');
    save = command(save, { type: 'claim' }, now);
    expect(save.daily.progress.win).toBe(1);
    expect(save.daily.progress.battle).toBe(1);
  });
});
