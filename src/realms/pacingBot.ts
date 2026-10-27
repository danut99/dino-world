/**
 * The pacing bot: a steady, diamond-free player that only uses `command()` (and the read-only helpers the UI uses),
 * playing a few short sessions a day at fixed Bucharest times. `pacing.test.ts` runs it to check that the content
 * lasts about a month and that nothing deadlocks. Only the tests import this file, so it never reaches the app.
 *
 * Every session is a handful of passes two minutes apart (about twelve minutes of play). Each pass claims what is
 * ready, keeps the story, the daily missions, the farm, the workshop and the builder busy, levels the strongest
 * dinosaurs, fights the arena tiers its best team can win and sends teams out through every portal slot.
 */
import { autoPlay, predictFight } from './autoBattle';
import {
  CROPS,
  ENCOUNTERS,
  RECIPES,
  REGIONS,
  REGION_STAGES,
  UTILITY_BUILDINGS,
  regionNumber,
  regionTeamSize,
  stageLevel,
  type ItemId,
  type UtilityKind,
} from './content';
import { expeditionPlan, patrolPlan, PATROL, suggestTeam, type PatrolHours } from './expeditionRules';
import {
  arenaTicketPrice,
  busyDinos,
  canBuild,
  COLLECTION,
  command,
  eggPrice,
  ELEMENTS,
  elementEdge,
  familyId,
  feedCost,
  GATE_LEAGUES,
  habitatCapacity,
  hatcherySlots,
  isTired,
  LEAGUE_EGG_ELEMENTS,
  levelCap,
  levelEdge,
  MARKET_ELEMENTS,
  newSave,
  nextUpgrade,
  RARITY_POWER,
  rarityOf,
  residents,
  starTotal,
  dinoStats,
  storyChapter,
  WORLD_UNLOCK,
  worldLock,
  workshop,
  type BuildTarget,
  type Command,
  type Dino,
  type RealmId,
  type Save,
} from './game';
import { DAILY_QUESTS } from './daily';
import { playableSpecies } from './playableDinosaurs';

const MIN = 60_000,
  HOUR = 60 * MIN,
  DAY = 24 * HOUR;
/** Midnight in Bucharest (UTC+2 all November and December) on Monday 2 November 2026. */
export const BOT_START = Date.UTC(2026, 10, 2) - 2 * HOUR;
/** The moment `hour` (local, may be fractional) of day `day` (1-based). */
export const at = (day: number, hour: number) => BOT_START + (day - 1) * DAY + hour * HOUR;

export interface BotOptions {
  /** Local session hours, e.g. [8, 13, 18, 22]. */
  sessions: number[];
  /** Days to play at most. */
  days: number;
  /** Minutes one session lasts; passes run every two minutes within it. */
  sessionMinutes?: number;
  /** Called with the save after every day, e.g. to keep mid-game snapshots. */
  onDay?: (day: number, s: Save) => void;
}
export interface DayRecord {
  day: number;
  /** Regions crossed (all five stages) and stages done in all. */
  regions: number;
  stages: number;
  worlds: number;
  stars: number;
  collection: number;
  /** Habitat levels, all worlds together (50 at most). */
  habitatLevels: number;
  chapter: number;
  gold: number;
  food: number;
  /** Levels of the arena team (or the three strongest dinosaurs). */
  team: number[];
  gemsEarned: number;
  dinos: number;
}
export interface BotResult {
  records: DayRecord[];
  /** First day every region stage is done, every goal of the story claimed, 90 stars, 30/30, every habitat L5. */
  doneDay: number | null;
  regionsDay: number | null;
  /** The lowest gold, food, stored gold, material or ticket count ever seen (never below 0). */
  lowest: number;
  save: Save;
  /** Commands that ran, for the curious. */
  commands: number;
  /** Gold and food each kind of command brought (or cost), all game long. */
  flows: Record<string, { gold: number; food: number; n: number }>;
}

const ALL_HABITATS_LEVEL = 5;
/** The record of one save. */
export function snapshot(day: number, s: Save, gemsEarned: number): DayRecord {
  const strongest = [...s.dinos].sort((a, b) => b.level - a.level).slice(0, 3);
  return {
    day,
    regions: REGIONS.filter((r) => (s.expeditionProgress[r.id] ?? 0) >= REGION_STAGES).length,
    stages: REGIONS.reduce((n, r) => n + (s.expeditionProgress[r.id] ?? 0), 0),
    worlds: Object.keys(s.habitats).length,
    stars: starTotal(s),
    collection: s.discovered.length,
    habitatLevels: Object.values(s.habitats).reduce((n, l) => n + (l ?? 0), 0),
    chapter: storyChapter(s)?.chapter.number ?? 11,
    gold: Math.round(s.gold),
    food: Math.round(s.food),
    team: strongest.map((d) => d.level),
    gemsEarned,
    dinos: s.dinos.length,
  };
}
/** Whether the save has finished everything the content offers. */
export function everythingDone(s: Save) {
  return (
    !storyChapter(s) &&
    REGIONS.every((r) => (s.expeditionProgress[r.id] ?? 0) >= REGION_STAGES) &&
    starTotal(s) >= 90 &&
    s.discovered.length >= COLLECTION.length &&
    ELEMENTS.every((e) => (s.habitats[e.id] ?? 0) >= ALL_HABITATS_LEVEL)
  );
}

/** Building upgrades, each one's next level in this order (story goals and full habitats jump the queue). */
const BUILD_ORDER: BuildTarget[] = ['farm', 'hatchery', 'workshop', 'portal', 'arena'];
const UPGRADE_COMMAND = (target: BuildTarget): Command =>
  target === 'farm'
    ? { type: 'upgradeFarm' }
    : target === 'hatchery'
      ? { type: 'upgradeHatchery' }
      : target === 'workshop'
        ? { type: 'upgradeWorkshop' }
        : target === 'portal'
          ? { type: 'upgradePortal' }
          : target === 'arena'
            ? { type: 'upgradeArena' }
            : { type: 'upgradeHabitat', realm: target.slice(8) as RealmId };
/** Buildings placed in this order once the story (or the bot) wants them. */
const PLACE_ORDER: UtilityKind[] = ['farm', 'portal', 'workshop', 'arena', 'market'];

export function runBot(options: BotOptions): BotResult {
  const sessionMinutes = options.sessionMinutes ?? 12;
  const sessions = [...options.sessions].sort((a, b) => a - b);
  let s = newSave(at(1, sessions[0]));
  let now = s.updatedAt,
    next = now,
    lowest = Infinity,
    commands = 0,
    gemsEarned = s.gems,
    doneDay: number | null = null,
    regionsDay: number | null = null;
  const records: DayRecord[] = [];
  const flows: Record<string, { gold: number; food: number; n: number }> = {};

  const watch = (x: Save) => {
    const values = [
      x.gold,
      x.food,
      x.storedGold,
      ...Object.values(x.inventory),
      ...Object.values(x.arenaTickets).map((n) => n ?? 0),
    ];
    lowest = Math.min(lowest, ...values);
  };
  /** Runs a command; a refused one changes nothing. */
  const run = (c: Command) => {
    try {
      const before = s.gems,
        gold0 = s.gold,
        food0 = s.food;
      s = command(s, c, now);
      const key = c.type;
      flows[key] ??= { gold: 0, food: 0, n: 0 };
      flows[key].gold += s.gold - gold0;
      flows[key].food += s.food - food0;
      flows[key].n++;
      if (s.gems > before) gemsEarned += s.gems - before;
      commands++;
      watch(s);
      return true;
    } catch {
      return false;
    }
  };
  const has = (kind: UtilityKind) => s.buildings.some((b) => b.kind === kind);
  const free = () => {
    const busy = busyDinos(s);
    return s.dinos.filter((d) => !busy.has(d.id));
  };
  /** The region whose next stage is open (first region not crossed yet). */
  const frontier = () => REGIONS.find((r) => (s.expeditionProgress[r.id] ?? 0) < REGION_STAGES);
  const openWorlds = () => ELEMENTS.map((e) => e.id).filter((id) => s.habitats[id]);
  const value = (d: Dino) => d.level * 10 + RARITY_POWER[rarityOf(d)] * 5;
  /** How much a dinosaur is worth raising: its level, and a head start for rarer ones (a boss most of all). */
  const promise = (d: Dino) => d.level + { common: 0, rare: 3, epic: 6, legendary: 20 }[rarityOf(d)];
  let coreIds: string[] = [];
  /**
   * The dinosaurs the food goes to: as many as the coming stages and the arena need. Once chosen they stay, unless a
   * much more promising one comes along (a young boss early on); new places go to the most promising.
   */
  const core = () => {
    const f = frontier(),
      size = f ? Math.max(regionTeamSize(regionNumber(f.id)), regionNumber(f.id) >= 3 ? 3 : 1) : 3;
    const byId = (id: string) => s.dinos.find((d) => d.id === id);
    coreIds = coreIds.filter((id) => byId(id));
    const others = () =>
      s.dinos
        .filter((d) => !coreIds.includes(d.id))
        .sort((a, b) => promise(b) - promise(a) || a.id.localeCompare(b.id));
    while (coreIds.length < size && others().length) coreIds.push(others()[0].id);
    const best = others()[0];
    if (best && coreIds.length) {
      const weakest = coreIds.map((id) => byId(id)!).sort((a, b) => promise(a) - promise(b))[0];
      if (promise(best) > promise(weakest) + 4) coreIds = coreIds.map((id) => (id === weakest.id ? best.id : id));
    }
    return coreIds.map((id) => byId(id)!).sort((a, b) => value(b) - value(a));
  };

  // ---- claiming -------------------------------------------------------------------------------------------
  function claimAll() {
    if (s.battle) run({ type: 'claim' });
    for (const x of [...s.expeditions]) if (x.endsAt <= now) run({ type: 'claimExpedition', runId: x.id });
    if (s.storedGold >= 1 || s.plots.some((p) => p && p.readyAt <= now) || s.crafting.some((j) => j.endsAt <= now))
      run({ type: 'collectAvailable' });
    hatchReady();
    claimStory();
    claimDaily();
  }
  function claimStory() {
    for (let step = storyChapter(s)?.step; step && step.done(s); step = storyChapter(s)?.step)
      if (!run({ type: 'claimQuestEgg', questId: step.id })) break;
  }
  function claimDaily() {
    if (s.daily.spins === 0) run({ type: 'spinDaily' });
    for (const q of s.daily.quests)
      if (!s.daily.claimed.includes(q) && s.daily.progress[q] >= DAILY_QUESTS[q].target)
        run({ type: 'claimDailyQuest', quest: q });
    if (!s.daily.bonus && s.daily.quests.every((q) => s.daily.claimed.includes(q))) run({ type: 'claimDailyBonus' });
  }

  // ---- eggs -----------------------------------------------------------------------------------------------
  const isNew = (e: { species: Dino['species']; element: RealmId }) => !s.discovered.includes(familyId(e));
  /** Room for one more dinosaur of `element`, counting the eggs already incubating for it. */
  const room = (element: RealmId) =>
    habitatCapacity(s, element) -
    residents(s, element).length -
    s.eggs.filter((e) => e.hatchAt !== null && e.element === element).length;
  /** Makes room in a full habitat by releasing its weakest dinosaur outside the core (never a boss or the team). */
  function release(element: RealmId) {
    const keep = new Set([...core().map((d) => d.id), ...s.team]);
    const busy = busyDinos(s);
    const victim = residents(s, element)
      .filter((d) => !keep.has(d.id) && !busy.has(d.id) && d.species !== 'boss' && rarityOf(d) !== 'legendary')
      .sort((a, b) => value(a) - value(b))[0];
    return !!victim && run({ type: 'releaseDino', dinoId: victim.id });
  }
  function hatchReady() {
    for (const egg of s.eggs.filter((e) => e.hatchAt !== null && e.hatchAt <= now)) {
      if (residents(s, egg.element).length >= habitatCapacity(s, egg.element) && isNew(egg)) release(egg.element);
      run({ type: 'hatch', eggId: egg.id });
    }
  }
  function eggs() {
    // Eggs of families already found are sold when their world has no room for them.
    for (const egg of s.eggs.filter((e) => e.hatchAt === null && e.species !== 'boss' && e.id !== 'egg-ignis'))
      if (!isNew(egg) && room(egg.element) <= 0) run({ type: 'sellEgg', eggId: egg.id });
    // New families (bosses included) first, then any egg its world has room for.
    const waiting = s.eggs
      .filter((e) => e.hatchAt === null)
      .sort(
        (a, b) => Number(isNew(b)) - Number(isNew(a)) || Number(b.species === 'boss') - Number(a.species === 'boss'),
      );
    for (const egg of waiting) {
      if (s.eggs.filter((e) => e.hatchAt !== null).length >= hatcherySlots(s)) break;
      if (!s.habitats[egg.element]) continue;
      if (room(egg.element) <= 0 && !isNew(egg)) continue;
      run({ type: 'incubate', eggId: egg.id });
    }
    // The Market: the families it sells that are still missing.
    if (has('market'))
      for (const element of MARKET_ELEMENTS.filter((e) => s.habitats[e]))
        for (const species of playableSpecies(element)) {
          const kind = { species, element };
          const pending = [...s.eggs, ...s.owedEggs].some((e) => familyId(e) === familyId(kind));
          if (isNew(kind) && !pending && s.gold >= eggPrice(element) + reserve())
            run({ type: 'buyEgg', species, element });
        }
  }

  // ---- gold planning ----------------------------------------------------------------------------------------
  /** The next world to open, once its region allows it. */
  const nextWorld = () => ELEMENTS.map((e) => e.id).find((id) => !s.habitats[id]);
  /** Gold kept for the next world while it is open to unlock. */
  function reserve() {
    const w = nextWorld();
    return w && !worldLock(s, w) ? WORLD_UNLOCK[w].gold : 0;
  }
  function unlockWorld() {
    const w = nextWorld();
    if (w && !worldLock(s, w)) run({ type: 'unlockHabitat', realm: w });
  }
  function placeBuildings() {
    for (const kind of PLACE_ORDER) {
      if (has(kind)) continue;
      // The market waits until the island earns enough; the rest come as soon as they are affordable.
      if (kind === 'market' && !s.habitats.water) continue;
      if (s.gold < UTILITY_BUILDINGS[kind].cost + (kind === 'farm' || kind === 'portal' ? 0 : reserve())) return;
      let placed = false;
      for (let y = 0; y < 24 && !placed; y++)
        for (let x = 0; x < 24 && !placed; x++) if (canBuild(s, x, y)) placed = run({ type: 'build', kind, x, y });
      if (!placed) return;
    }
  }
  /** Builder candidates, most wanted first. */
  function buildQueue(): BuildTarget[] {
    const wanted: BuildTarget[] = [];
    const goal = storyChapter(s)?.step.id ?? '';
    const story: Record<string, BuildTarget[]> = {
      'w-earth-hatchery': ['hatchery'],
      'w-nature-farm': ['farm'],
      'w-nature-habitat': ['habitat:fire'],
      'w-ice-portal': ['portal'],
      'w-lightning-gate': ['arena'],
      'w-wind-farm': ['farm'],
      'w-dark-portal': ['portal'],
      'w-light-builder': ['farm', 'workshop'],
    };
    wanted.push(...(story[goal] ?? []));
    // A habitat with a new family waiting for room.
    for (const egg of s.eggs)
      if (isNew(egg) && s.habitats[egg.element] && room(egg.element) <= 0) wanted.push(`habitat:${egg.element}`);
    // The Arena Gate's second level waits until the gated leagues are near (the ice world is open).
    const ok = (t: BuildTarget) =>
      t === 'arena'
        ? has('arena') && (s.habitats.ice ?? 0) > 0
        : t === 'workshop'
          ? has('workshop')
          : t === 'portal'
            ? s.portalLevel > 0
            : true;
    wanted.push(...BUILD_ORDER);
    // Then every habitat, level by level.
    for (let level = 2; level <= ALL_HABITATS_LEVEL; level++)
      for (const w of openWorlds()) if ((s.habitats[w] ?? 0) < level) wanted.push(`habitat:${w}`);
    return [...new Set(wanted)].filter((t) => ok(t) && nextUpgrade(s, t));
  }
  function upgrade() {
    if (s.construction) return;
    const spare = s.gold - reserve();
    for (const t of buildQueue()) {
      const step = nextUpgrade(s, t)!;
      const affordable =
        spare >= step.gold &&
        (Object.entries(step.materials) as [ItemId, number][]).every(([id, n]) => s.inventory[id] >= n);
      if (affordable) {
        run(UPGRADE_COMMAND(t));
        return;
      }
    }
  }

  // ---- workshop -----------------------------------------------------------------------------------------------
  /** Materials the next few purchases need: the next world, and unless `upgrades` is false the next upgrades. */
  function wishes(upgrades = true) {
    const need: Partial<Record<ItemId, number>> = {};
    const add = (m: Partial<Record<ItemId, number>>) => {
      for (const [id, n] of Object.entries(m) as [ItemId, number][]) need[id] = Math.max(need[id] ?? 0, n);
    };
    const w = nextWorld();
    if (w) add(WORLD_UNLOCK[w].materials);
    if (!upgrades) return need;
    const queue = buildQueue().slice(0, 3);
    const sum: Partial<Record<ItemId, number>> = {};
    for (const t of queue)
      for (const [id, n] of Object.entries(nextUpgrade(s, t)!.materials) as [ItemId, number][])
        sum[id] = (sum[id] ?? 0) + n;
    add(sum);
    return need;
  }
  function craft() {
    if (!has('workshop')) return;
    const queued = (id: string) => s.crafting.filter((j) => j.recipeId === id).length;
    const room = () => s.crafting.filter((j) => j.endsAt > now).length < workshop(s).slots;
    const need = wishes(),
      worldNeed = wishes(false);
    const f = frontier();
    const stageSupplies = f && regionNumber(f.id) > 1 ? regionTeamSize(regionNumber(f.id)) : 0;
    const supplies =
      stageSupplies + (Object.values(s.expeditionProgress).some((n) => (n ?? 0) >= PATROL.unlockStage) ? 3 : 0);
    const crystalsWanted = core().filter((d) => d.stage === 'juvenile' && d.level >= 20).length;
    const kitsWanted = Math.min(2, buildQueue().filter((t) => t.startsWith('habitat:')).length * 2);
    const plan: [string, () => boolean][] = [
      ['provisions', () => s.inventory.provisions + queued('provisions') < supplies && s.food >= 30 + 50],
      ['evolution', () => s.inventory.evolutionCrystal + queued('evolution') < crystalsWanted],
      ['kit', () => s.inventory.habitatKit + queued('kit') < Math.max(kitsWanted, need.habitatKit ?? 0)],
      [
        'lamp',
        () =>
          s.lamps + s.inventory.lamp + queued('lamp') < 5 &&
          s.inventory.crystal >= 6 + (need.crystal ?? 0) + 16 &&
          s.inventory.stone >= 20 + (need.stone ?? 0),
      ],
    ];
    for (let guard = 0; guard < 10 && room(); guard++) {
      const pick = plan.find(([id, want]) => {
        if (!want()) return false;
        const recipe = RECIPES.find((r) => r.id === id)!;
        // Raw materials the next world needs stay untouched (except by supply packs: without them no patrol leaves to
        // bring the wood back), and supply packs always keep a little wood and fiber back
        // for themselves (without them no patrol leaves, and patrols bring the wood). Supplies and kits feed the next
        // upgrades instead of waiting behind them; only the optional lamps also leave the upgrades' materials alone.
        const kept = (item: ItemId) => (id !== 'provisions' && (item === 'wood' || item === 'fiber') ? 12 : 0);
        const reserve = id === 'lamp' ? need : worldNeed;
        return (Object.entries(recipe.cost) as [ItemId, number][]).every(
          ([item, n]) =>
            s.inventory[item] - n >=
            (['wood', 'stone', 'fiber', 'crystal'].includes(item) && id !== 'evolution' && id !== 'provisions' ? (reserve[item] ?? 0) : 0) +
              kept(item),
        );
      });
      if (!pick || !run({ type: 'craft', recipeId: pick[0] })) break;
    }
    if (s.inventory.lamp > 0) run({ type: 'placeLamp' });
  }

  // ---- farm ---------------------------------------------------------------------------------------------------
  function farm() {
    if (!has('farm')) return;
    const gap = next - now;
    const crops = CROPS.filter((c) => c.level <= s.farmLevel && c.seconds * 1000 <= gap + 30 * MIN);
    const crop = crops[crops.length - 1] ?? CROPS[0];
    for (let i = 0; i < s.plots.length; i++)
      if (!s.plots[i] && s.gold >= crop.cost) run({ type: 'plant', crop: crop.id, plot: i });
  }

  // ---- dinosaurs -----------------------------------------------------------------------------------------------
  /**
   * What the food is for, most urgent first: the core up to the next stage's level, then an edge dinosaur for each
   * open league still missing stars on its Champion tier (its best dinosaur of the element that beats the league,
   * up to a few levels over the boss), then the core up to level 50.
   */
  function feedWishes(): [Dino, number][] {
    const wishes: [Dino, number][] = [];
    const team = core();
    const f = frontier();
    if (f) {
      const level = stageLevel(regionNumber(f.id), Math.min(REGION_STAGES, (s.expeditionProgress[f.id] ?? 0) + 1));
      for (const d of team.slice(0, regionTeamSize(regionNumber(f.id)))) wishes.push([d, level]);
    }
    for (const league of openWorlds()) {
      const champion = ENCOUNTERS.find((e) => e.id === `arena-${league}-3`)!;
      if ((s.stars[champion.id] ?? 0) >= 3 || !(s.stars[`arena-${league}-2`] ?? 0)) continue;
      const edge = s.dinos
        .filter((d) => elementEdge(d.element, league) === 1)
        .sort((a, b) => RARITY_POWER[rarityOf(b)] - RARITY_POWER[rarityOf(a)] || b.level - a.level)[0];
      if (edge) wishes.push([edge, Math.min(50, champion.level + 4)]);
    }
    for (const d of team) wishes.push([d, 50]);
    return wishes;
  }
  function feed() {
    const keep = 60;
    for (let guard = 0; guard < 400; guard++) {
      const wish = feedWishes().find(([d, level]) => d.level < level);
      if (!wish) break;
      const d = wish[0];
      if (s.food < feedCost(d.level) + keep) break;
      if (
        !run(
          d.level === levelCap(d.stage) ? { type: 'evolve', dinoId: d.id } : { type: 'feed', dinoId: d.id, times: 1 },
        )
      )
        break;
    }
  }

  // ---- arena -----------------------------------------------------------------------------------------------------
  /** How strong a dinosaur is against a league at a level: health × power, its element edge and its level edge. */
  function strength(d: Dino, league: RealmId, level: number) {
    const st = dinoStats(d),
      edge = elementEdge(d.element, league);
    return st.hp * st.power * (edge === 1 ? 1.6 : edge === -1 ? 0.6 : 1) * levelEdge(d.level - level) ** 2;
  }
  function bestTeam(encounterId: string) {
    const e = ENCOUNTERS.find((x) => x.id === encounterId)!;
    return free()
      .filter((d) => d.stage !== 'baby' && d.level >= e.level && !isTired(s, d.id, now))
      .sort((a, b) => strength(b, e.league as RealmId, e.level) - strength(a, e.league as RealmId, e.level))
      .slice(0, 3)
      .map((d) => d.id);
  }
  /** Fights one tier with its best team, buying the ticket; true when a fight took place. */
  function fight(encounterId: string, minStars: number) {
    const team = bestTeam(encounterId);
    if (!team.length) return false;
    if (!run({ type: 'setTeam', dinoIds: team })) return false;
    const forecast = predictFight(s, encounterId, now);
    if (!forecast || !forecast.win || forecast.stars < minStars) return false;
    const league = ENCOUNTERS.find((x) => x.id === encounterId)!.league as RealmId;
    if (!(s.arenaTickets[league] ?? 0)) {
      if (s.gold < arenaTicketPrice(league) + reserve()) return false;
      if (!run({ type: 'buyArenaTicket', realm: league, quantity: 1 })) return false;
    }
    if (!run({ type: 'battle', encounterId })) return false;
    s = autoPlay(s, now);
    run({ type: 'claim' });
    return true;
  }
  function arena() {
    if (!has('arena')) return;
    const open = (league: string) =>
      s.habitats[league as RealmId] && (!GATE_LEAGUES.includes(league) || s.arenaLevel >= 2);
    // Stars first: every tier the team can win with more stars than before, easiest first.
    const tiers = ENCOUNTERS.filter(
      (e) => open(e.league!) && (s.stars[e.id] ?? 0) < 3 && (!e.requires || (s.stars[e.requires] ?? 0) >= 2),
    ).sort((a, b) => a.level - b.level);
    for (const e of tiers) if (fight(e.id, (s.stars[e.id] ?? 0) + 1)) return;
    // Then eggs: missing families of a league that drops them, on its hardest tier the team wins.
    for (const league of openWorlds().filter((w) => LEAGUE_EGG_ELEMENTS.includes(w) && open(w))) {
      if (!playableSpecies(league).some((species) => isNew({ species, element: league }))) continue;
      if ([...s.eggs, ...s.owedEggs].some((e) => e.element === league && isNew(e))) continue;
      for (const tier of [3, 2, 1])
        if ((s.stars[`arena-${league}-${tier}`] ?? 0) >= 1 && fight(`arena-${league}-${tier}`, 1)) return;
    }
  }

  // ---- expeditions ---------------------------------------------------------------------------------------------
  function expeditions(last: boolean) {
    const f = frontier();
    if (f && s.habitats[f.element]) {
      const team = suggestTeam(s, f.id, 'stage');
      const plan = expeditionPlan(s, f.id, team);
      // Short stages leave at once; long ones at the end of the session, after the arena.
      if (plan.canSend && (last || plan.duration <= 30 * MIN)) run({ type: 'expedition', regionId: f.id, team });
    }
    if (!last) return;
    // Patrols fill the other slots until the next session: the richest region the free dinosaurs can patrol.
    const gap = next - now;
    const hours = ([8, 3, 1] as PatrolHours[]).find((h) => h * HOUR <= gap + 15 * MIN);
    if (!hours) return;
    for (let guard = 0; guard < 3; guard++) {
      // The richest region first, but one that brings the scarcest raw material when stocks run low.
      const scarce = (['wood', 'stone', 'fiber', 'crystal'] as const)
        .filter((id) => s.inventory[id] < 150)
        .sort((a, b) => s.inventory[a] - s.inventory[b]);
      const rank = (r: (typeof REGIONS)[number]) => {
        const i = scarce.findIndex((m) => r.materials.includes(m));
        return i < 0 ? scarce.length : i;
      };
      const regions = REGIONS.filter((r) => (s.expeditionProgress[r.id] ?? 0) >= PATROL.unlockStage)
        .reverse()
        .sort((a, b) => rank(a) - rank(b));
      let sent = false;
      for (const r of regions) {
        const team = suggestTeam(s, r.id, 'patrol');
        if (
          team.length &&
          patrolPlan(s, r.id, hours, team).canSend &&
          run({ type: 'patrol', regionId: r.id, hours, team })
        ) {
          sent = true;
          break;
        }
      }
      if (!sent) break;
    }
  }

  // ---- one pass and the days ------------------------------------------------------------------------------------
  function pass(last: boolean) {
    claimAll();
    placeBuildings();
    unlockWorld();
    eggs();
    upgrade();
    craft();
    feed();
    for (let i = 0; i < 2; i++) arena();
    claimStory();
    feed();
    expeditions(last);
    farm();
    claimStory();
  }

  for (let day = 1; day <= options.days; day++) {
    for (let i = 0; i < sessions.length; i++) {
      const start = at(day, sessions[i]);
      next = i + 1 < sessions.length ? at(day, sessions[i + 1]) : at(day + 1, sessions[0]);
      for (let m = 0; m <= sessionMinutes; m += 2) {
        now = start + m * MIN;
        pass(m + 2 > sessionMinutes);
      }
    }
    if (regionsDay === null && REGIONS.every((r) => (s.expeditionProgress[r.id] ?? 0) >= REGION_STAGES))
      regionsDay = day;
    records.push(snapshot(day, s, gemsEarned));
    options.onDay?.(day, s);
    if (everythingDone(s)) {
      doneDay = day;
      break;
    }
  }
  return { records, doneDay, regionsDay, lowest, save: s, commands, flows };
}
/** Formats records as a compact table. */
export function dayTable(records: DayRecord[], days: number[]) {
  const pick = records.filter((r, i) => days.includes(r.day) || i === records.length - 1);
  const head = 'day | regions stages | worlds | stars | coll | hab | ch | gold | food | team | gems | dinos';
  return [
    head,
    ...[...new Set(pick)].map((r) =>
      [
        r.day,
        `${r.regions} ${r.stages}`,
        r.worlds,
        r.stars,
        r.collection,
        r.habitatLevels,
        r.chapter,
        r.gold,
        r.food,
        r.team.join('/'),
        r.gemsEarned,
        r.dinos,
      ].join(' | '),
    ),
  ].join('\n');
}
