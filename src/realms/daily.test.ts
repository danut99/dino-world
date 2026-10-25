import { describe, expect, it } from 'vitest';
import { command, newSave, parseSave, advance, currentTrip, GEMS, STORY_CHAPTERS, storyLevel, type Save } from './game';
import {
  availableQuests,
  dailyDay,
  dailyQuests,
  dailyReset,
  dailyScale,
  DAILY_QUESTS,
  normalizeDaily,
  scaleDailyReward,
  weekId,
  wheelPrize,
  WHEEL_PRIZES,
  type DailyQuestId,
} from './daily';
const now = Date.UTC(2026, 9, 24, 12);
/** A juvenile champion with the arena built and fire tickets. */
function fighter(level = 15): Save {
  const save = newSave(now);
  save.dinos = [{ id: 'd', species: 'trex', element: 'fire', stage: 'juvenile', level, nickname: 'Ignis' }];
  save.champion = 'd';
  save.team = ['d'];
  save.buildings.push({ id: 'arena', kind: 'arena', x: 1, y: 8 });
  save.arenaTickets.fire = 5;
  return save;
}
describe('daily rewards', () => {
  it('follows the day in Bucharest, summer and winter time alike', () => {
    // Summer time (UTC+3) until the last Sunday of October, then winter time (UTC+2).
    expect(dailyDay(Date.UTC(2026, 9, 24, 20, 59))).toBe('2026-10-24');
    expect(dailyDay(Date.UTC(2026, 9, 24, 21, 30))).toBe('2026-10-25');
    expect(dailyDay(Date.UTC(2026, 9, 25, 21, 30))).toBe('2026-10-25');
    expect(dailyDay(Date.UTC(2026, 9, 25, 22, 30))).toBe('2026-10-26');
    expect(dailyReset('2026-10-24')).toBe(Date.UTC(2026, 9, 24, 21));
    expect(dailyReset('2026-10-25')).toBe(Date.UTC(2026, 9, 25, 22));
    // Weeks start on Monday in Bucharest.
    expect(weekId(Date.UTC(2026, 9, 25, 21))).toBe('2026-10-19');
    expect(weekId(Date.UTC(2026, 9, 25, 22, 30))).toBe('2026-10-26');
    expect(weekId(Date.UTC(2026, 10, 1, 12))).toBe('2026-10-26');
    // A new day starts at midnight in Bucharest, not in London.
    const late = newSave(Date.UTC(2026, 9, 24, 20));
    expect(advance(late, Date.UTC(2026, 9, 24, 21, 30)).daily.day).toBe('2026-10-25');
  });
  it('awards one free spin per day from a seeded roll, replayable and persisted', () => {
    const original = newSave(now);
    const won = command(original, { type: 'spinDaily' }, now);
    expect(won.daily).toMatchObject({ spins: 1 });
    const prize = WHEEL_PRIZES[won.daily.spin!];
    expect(won.gold + won.food).toBe(original.gold + original.food + (prize.reward.gold ?? 0) + (prize.reward.food ?? 0));
    // The same save and moment give the same prize; another moment may not.
    expect(command(original, { type: 'spinDaily' }, now)).toEqual(won);
    expect(new Set(Array.from({ length: 40 }, (_, i) => command(original, { type: 'spinDaily' }, now + i * 1000).daily.spin)).size).toBeGreaterThan(2);
    expect(parseSave(JSON.stringify(won))).toEqual(won);
    expect(() => command(won, { type: 'spinDaily' }, now + 1000)).toThrow('dailyClaimed');
    expect(() => command(won, { type: 'spinDaily' }, now - 86400000)).toThrow('dailyClaimed');
    expect(command(won, { type: 'spinDaily' }, Date.UTC(2026, 9, 25, 12)).daily).toMatchObject({ day: '2026-10-25', spins: 1 });
  });
  it('keeps progression, pays quests and completion bonus once, resets counters daily', () => {
    let save = newSave(now);
    const ids = save.daily.quests;
    // A newcomer gets missions it can do: feeding, collecting and the farm that comes next.
    expect(ids).toEqual(dailyQuests(save.daily.day, (id) => DAILY_QUESTS[id].available(save)));
    expect([...ids].sort()).toEqual(['collect', 'feed', 'plant']);
    expect(ids).toHaveLength(3);
    expect(() => command(save, { type: 'claimDailyBonus' }, now)).toThrow('dailyIncomplete');
    expect(() => command(save, { type: 'claimDailyQuest', quest: ids[0] }, now)).toThrow('dailyIncomplete');
    const other = (Object.keys(DAILY_QUESTS) as DailyQuestId[]).find((id) => !ids.includes(id))!;
    save.daily.progress[other] = DAILY_QUESTS[other].target;
    expect(() => command(save, { type: 'claimDailyQuest', quest: other }, now)).toThrow('dailyQuest');
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
    expect(tomorrow.daily).toMatchObject({ spins: 0, rerolls: 0, patrols: 0, spin: null });
    expect(tomorrow.gold).toBe(save.gold);
  });
  it('tracks successful feeding, plot harvests, crafts and completed trips automatically', () => {
    let save = newSave(now);
    save.dinos = [{ id: 'd', species: 'trex', element: 'fire', stage: 'juvenile', level: 10, nickname: 'Ignis' }]; save.champion = 'd';
    save.gold = 10000; save.food = 10000;
    for (const [kind, x, y] of [['farm',5,8],['workshop',6,1],['portal',8,5]] as const) save = command(save,{type:'build',kind,x,y},now);
    save = command(save, { type: 'feed' }, now);
    expect(save.daily.progress.feed).toBe(1);
    // Feeding several levels at once counts each of them.
    save = command(save, { type: 'feed', times: 2 }, now);
    expect(save.daily.progress.feed).toBe(3);
    save = command(save,{type:'plant'},now);
    expect(() => command(save,{type:'harvest'},now)).toThrow('timer');
    expect(save.daily.progress.harvest).toBe(0);
    save = command(save,{type:'harvest'},now+120000);
    expect(save.daily.progress.harvest).toBe(1);
    save = command(save,{type:'craft',recipeId:'provisions'},now+120000);
    const job = save.crafting[0];
    save = command(save,{type:'claimCraft',jobId:job.id},job.endsAt);
    expect(save.daily.progress.craft).toBe(1);
    save = command(save,{type:'expedition',regionId:'training',team:['d']},job.endsAt);
    expect(save.daily.progress.expedition).toBe(0);
    save = command(save,{type:'claimExpedition'},currentTrip(save)!.endsAt);
    expect(save.daily.progress.expedition).toBe(1);
    expect(parseSave(JSON.stringify(save))).toEqual(save);
  });
  it('rejects invalid or unearned claims', () => {
    const save = newSave(now);
    // A claim without the progress behind it is dropped on load, so it can never pay out.
    save.daily.claimed = [save.daily.quests[0]];
    expect(parseSave(JSON.stringify(save)).daily.claimed).toEqual([]);
    for (const daily of [{ spin: 99, spins: 1 }, { spin: 0, spins: 0 }, { quests: ['feed', 'feed', 'win'] }, { quests: ['dance', 'feed', 'win'] }, { rerolls: -1 }]) {
      const invalid = newSave(now);
      expect(() => parseSave(JSON.stringify({ ...invalid, daily: { ...invalid.daily, ...daily } })), JSON.stringify(daily)).toThrow('Invalid daily');
    }
  });
  it('counts a finished battle only after the result is collected', () => {
    let save = fighter();
    save = command(save,{type:'battle',encounterId:'arena-fire-1'},now);
    for(let i=0;i<30 && !save.battle?.result;i++) save = command(save,{type:'action',action:'basic'},now);
    expect(save.battle?.result).toBeTruthy();
    expect(save.daily.progress.battle).toBe(0);
    save = command(save,{type:'claim'},now);
    expect(save.daily.progress.battle).toBe(1);
    expect(() => command(save,{type:'claim'},now)).toThrow('battle');
  });
  it('uses disclosed weighted prizes and varied daily missions', () => {
    expect(WHEEL_PRIZES.reduce((sum,p) => sum+p.weight,0)).toBe(100);
    expect(wheelPrize(0)).toBe(0); expect(wheelPrize(0.9999)).toBe(WHEEL_PRIZES.length - 1);
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
  it('loads a day stored before newer missions and counters: they start at zero, stale claims are dropped', () => {
    const day = '2026-10-24';
    const today = dailyQuests(day);
    const stale = (Object.keys(DAILY_QUESTS) as DailyQuestId[]).find((id) => !today.includes(id))!;
    const old = { day, progress: { feed: 3, harvest: 2, craft: 1, battle: 1, expedition: 1 }, claimed: [stale], bonus: true, spin: 2 } as never;
    const fixed = normalizeDaily(old);
    expect(fixed.claimed).toEqual([]);
    expect(fixed.bonus).toBe(false);
    expect(fixed.progress.win).toBe(0);
    expect(fixed).toMatchObject({ spin: 2, spins: 1, rerolls: 0, patrols: 0, quests: today });
    const save = newSave(Date.UTC(2026, 9, 24, 12));
    expect(() => parseSave(JSON.stringify({ ...save, daily: old }))).not.toThrow();
  });
  it('counts planting, starting crafts, gold collection and battle wins', () => {
    let save = fighter();
    save.gold = 10000; save.food = 10000;
    for (const [kind, x, y] of [['farm', 5, 8], ['workshop', 6, 1]] as const) save = command(save, { type: 'build', kind, x, y }, now);
    save = command(save, { type: 'plant' }, now);
    expect(save.daily.progress.plant).toBe(1);
    save = command(save, { type: 'craft', recipeId: 'provisions' }, now);
    expect(save.daily.progress.startCraft).toBe(1);
    save.storedGold = 50;
    save = command(save, { type: 'collect' }, now);
    expect(save.daily.progress.collect).toBe(1);
    save = command(save, { type: 'battle', encounterId: 'arena-fire-1' }, now);
    for (let i = 0; i < 30 && !save.battle?.result; i++) save = command(save, { type: 'action', action: 'basic' }, now);
    expect(save.battle?.result).toBe('victory');
    save = command(save, { type: 'claim' }, now);
    expect(save.daily.progress.win).toBe(1);
    expect(save.daily.progress.battle).toBe(1);
  });
});

describe('daily missions the player can do', () => {
  /** A player with a juvenile, the farm, workshop, arena and portal, and the fire region crossed to stage 3. */
  function established(): Save {
    const save = fighter(14);
    save.gold = 10_000;
    save.food = 10_000;
    save.buildings.push({ id: 'farm', kind: 'farm', x: 5, y: 8 }, { id: 'workshop', kind: 'workshop', x: 6, y: 1 }, { id: 'portal', kind: 'portal', x: 8, y: 5 });
    save.portalLevel = 1;
    save.expeditionProgress = { training: 3 };
    save.inventory.provisions = 5;
    return save;
  }
  /** The save on a fresh day: its missions drawn among those it can do. */
  const newDay = (save: Save, t = now) => advance({ ...save, daily: { ...save.daily, day: '2000-01-01' } }, t);
  it('knows what each mission needs', () => {
    const fresh = newSave(now);
    expect(availableQuests(fresh).sort()).toEqual(['collect', 'feed']);
    const all = established();
    expect(availableQuests(all).sort()).toEqual(Object.keys(DAILY_QUESTS).sort());
    // Patrols open at a region's third stage; the arena needs a dinosaur old enough to fight.
    expect(DAILY_QUESTS.patrol.available({ ...all, expeditionProgress: { training: 2 } })).toBe(false);
    expect(DAILY_QUESTS.win.available({ ...all, dinos: [{ ...all.dinos[0], stage: 'baby', level: 5 }] })).toBe(false);
    expect(DAILY_QUESTS.startCraft.available({ ...all, buildings: all.buildings.filter((b) => b.kind !== 'workshop') })).toBe(false);
  });
  it('draws the day once, seeded, only among available missions', () => {
    const save = established();
    save.buildings = save.buildings.filter((b) => b.kind !== 'arena');
    const allowed = new Set(availableQuests(save));
    const seen = new Set<string>();
    for (let day = 0; day < 20; day++) {
      const t = now + day * 86_400_000;
      const drawn = newDay(save, t).daily.quests;
      expect(new Set(drawn).size).toBe(3);
      for (const id of drawn) {
        expect(allowed.has(id), id).toBe(true);
        seen.add(id);
      }
      // The same day draws the same missions.
      expect(newDay(save, t + 1000).daily.quests).toEqual(drawn);
    }
    expect(seen.size).toBeGreaterThan(4);
    // Once drawn, the day keeps its missions even if more become available.
    const today = newDay(save);
    today.buildings.push({ id: 'arena', kind: 'arena', x: 1, y: 8 });
    expect(advance(today, now + 60_000).daily.quests).toEqual(today.daily.quests);
  });
  it('swaps an unfinished mission: free once a day, then for diamonds', () => {
    let save = newDay(established());
    save.gems = 4;
    const [first, second] = save.daily.quests;
    save = command(save, { type: 'rerollDailyQuest', quest: first }, now);
    expect(save.daily.rerolls).toBe(1);
    expect(save.gems).toBe(4);
    expect(save.daily.quests).not.toContain(first);
    expect(new Set(save.daily.quests).size).toBe(3);
    // The newcomer takes the swapped mission's place, and is one the player can do.
    expect(availableQuests(save)).toContain(save.daily.quests[0]);
    expect(save.daily.quests.slice(1)).toEqual([second, save.daily.quests[2]]);
    expect(parseSave(JSON.stringify(save))).toEqual(save);
    // The second swap costs GEMS.reroll.
    save = command(save, { type: 'rerollDailyQuest', quest: second }, now);
    expect(save.gems).toBe(4 - GEMS.reroll);
    expect(() => command(save, { type: 'rerollDailyQuest', quest: save.daily.quests[2] }, now)).toThrow('gems');
    // A finished mission stays; one not drawn today cannot be swapped.
    const last = save.daily.quests[2];
    const done = { ...save, gems: 50, daily: { ...save.daily, progress: { ...save.daily.progress, [last]: DAILY_QUESTS[last].target } } };
    expect(() => command(done, { type: 'rerollDailyQuest', quest: last }, now)).toThrow('dailyReroll');
    const missing = (Object.keys(DAILY_QUESTS) as DailyQuestId[]).find((id) => !save.daily.quests.includes(id))!;
    expect(() => command({ ...save, gems: 50 }, { type: 'rerollDailyQuest', quest: missing }, now)).toThrow('dailyQuest');
    // The next day starts with a free swap again.
    expect(advance(save, now + 86_400_000).daily.rerolls).toBe(0);
  });
  it('refuses a swap when nothing else is available', () => {
    const save = newSave(now);
    // A newcomer can only feed and collect, and has both already (plus the farm starter).
    expect(() => command(save, { type: 'rerollDailyQuest', quest: save.daily.quests[0] }, now)).toThrow('dailyReroll');
  });
  it('pays more in later chapters: ×(1 + 0.15 · (chapter − 1)), the chest diamond as it is', () => {
    expect([1, 2, 3, 10].map(dailyScale)).toEqual([1, 1.15, 1.3, 2.35]);
    expect(scaleDailyReward({ gold: 80, materials: { fiber: 5 }, gems: 1 }, 3)).toEqual({ gold: 104, materials: { fiber: 7 }, gems: 1 });
    let save = established();
    save.questEggs = STORY_CHAPTERS.slice(0, 2).flatMap((c) => c.steps.map((q) => q.id));
    expect(storyLevel(save)).toBe(3);
    save = newDay(save);
    for (const id of save.daily.quests) {
      save.daily.progress[id] = DAILY_QUESTS[id].target;
      const gold = save.gold;
      save = command(save, { type: 'claimDailyQuest', quest: id }, now);
      expect(save.gold - gold).toBe(Math.round((DAILY_QUESTS[id].reward.gold ?? 0) * 1.3));
    }
    const { gold, food, gems } = save,
      crystal = save.inventory.crystal;
    save = command(save, { type: 'claimDailyBonus' }, now);
    expect(save.gold - gold).toBe(260);
    expect(save.food - food).toBe(130);
    expect(save.inventory.crystal - crystal).toBe(Math.round(5 * 1.3));
    expect(save.gems - gems).toBe(1);
  });
  it('counts a claimed patrol for the patrol mission', () => {
    let save = established();
    save.dinos.push({ id: 'w', species: 'thalassaur', element: 'water', stage: 'juvenile', level: 14, nickname: 'W' });
    save.habitats.water = 1;
    save = command(save, { type: 'patrol', regionId: 'training', hours: 1, team: ['w'] }, now);
    save = command(save, { type: 'claimExpedition', runId: save.expeditions[0].id }, now + 3_600_000);
    expect(save.daily.progress.patrol).toBe(1);
    expect(save.daily.progress.expedition).toBe(1);
  });
});

describe('the daily wheel', () => {
  it('has the planned slices, in percent, with two arena tickets for a world', () => {
    expect(WHEEL_PRIZES.map((p) => [p.label[1], p.weight])).toEqual([
      ['150 gold', 22],
      ['100 food', 22],
      ['20 wood', 13],
      ['20 stone', 13],
      ['2 supply packs', 10],
      ['2 arena tickets', 6],
      ['6 crystals', 6],
      ['1 evolution crystal', 3],
      ['1 habitat kit', 2],
      ['3 diamonds', 3],
    ]);
    expect(WHEEL_PRIZES.reduce((n, p) => n + p.weight, 0)).toBe(100);
  });
  it('gives the ticket slice to an open league, the same for the same spin', () => {
    const slice = WHEEL_PRIZES.findIndex((p) => p.reward.tickets);
    const save = fighter();
    save.habitats = { fire: 1, water: 1, earth: 1, lightning: 1 };
    save.arenaTickets = {};
    let t = now;
    while (command(save, { type: 'spinDaily' }, t).daily.spin !== slice) t += 1000;
    const spun = command(save, { type: 'spinDaily' }, t);
    expect(spun.notice?.tickets?.count).toBe(2);
    const realm = spun.notice!.tickets!.realm;
    // The lightning league needs the Arena Gate at level 2.
    expect(['fire', 'water', 'earth']).toContain(realm);
    expect(spun.arenaTickets).toEqual({ [realm]: 2 });
    expect(command(save, { type: 'spinDaily' }, t)).toEqual(spun);
    expect(parseSave(JSON.stringify(spun))).toEqual(spun);
  });
});
