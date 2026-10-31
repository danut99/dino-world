/**
 * "What do I do now?": the single most useful thing the player can do this moment, with one plain sentence on why.
 * Claims and ready things come first, then the story goal when it can be done now, then the small things that keep
 * the island moving (feed, plant, incubate, train). When everything is waiting on a timer it says what and how long.
 */
import { REGIONS, UTILITY_BUILDINGS, regionNumber, stageLevel, type UtilityKind } from './content';
import { dailyState, DAILY_QUESTS } from './daily';
import { expeditionPlan } from './expeditionRules';
import {
  awayAt,
  farmReadyFood,
  feedCost,
  hatcherySlots,
  levelCap,
  PET,
  storyChapter,
  TRAINING,
  treasureReady,
  type Save,
} from './game';

type Text = readonly [string, string];
export type NextGo =
  | { kind: 'claimStory' }
  | { kind: 'panel'; panel: string; dinoId?: string; building?: UtilityKind }
  | { kind: 'harvest' }
  | { kind: 'home' };
export interface NextAction {
  id: string;
  icon: string;
  text: Text;
  why: Text;
  go: NextGo | null;
  /** Nothing to do right now: only timers running. */
  waiting?: boolean;
}

const minutes = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));
const span = (ms: number): Text => {
  const m = minutes(ms);
  return m >= 60
    ? [`${Math.floor(m / 60)}h ${m % 60}m`, `${Math.floor(m / 60)}h ${m % 60}m`]
    : [`${m} min`, `${m} min`];
};

export function nextAction(s: Save, now: number): NextAction | null {
  if (!s.dinos.length) return null;
  const story = storyChapter(s)?.step;
  const day = dailyState(s, now);
  const home = s.dinos.filter((d) => !awayAt(s, d.id, now));
  const has = (kind: UtilityKind) => s.buildings.some((b) => b.kind === kind);

  // ---- ready to collect ----
  if (story?.done(s))
    return {
      id: 'story-claim',
      icon: '🎁',
      text: [`Ia premiul: ${story.task[0]}`, `Claim: ${story.task[1]}`],
      why: story.species
        ? [
            'Ai terminat pasul din poveste. Premiul are și un ou nou!',
            'You finished the story step. The reward includes a new egg!',
          ]
        : [
            'Ai terminat pasul din poveste: aur și hrană te așteaptă.',
            'You finished the story step: gold and food are waiting.',
          ],
      go: { kind: 'claimStory' },
    };
  if (s.eggs.some((e) => e.hatchAt !== null && e.hatchAt <= now))
    return {
      id: 'hatch',
      icon: '🥚',
      text: ['Eclozează oul', 'Hatch the egg'],
      why: [
        'Un ou din Incubator e gata: un dinozaur nou te așteaptă.',
        'An egg in the Hatchery is ready: a new dinosaur is waiting.',
      ],
      go: { kind: 'panel', panel: 'hatchery' },
    };
  if (s.expeditions.some((x) => x.endsAt <= now))
    return {
      id: 'trip-back',
      icon: '🧭',
      text: ['Echipa s-a întors: ia prăzile', 'Your team is back: claim the loot'],
      why: [
        'Expediția s-a terminat. Ia premiile și trimite-i mai departe.',
        'The trip is over. Take the loot and send them on.',
      ],
      go: { kind: 'panel', panel: 'expedition' },
    };
  if (s.training && s.training.endsAt <= now)
    return {
      id: 'training-done',
      icon: '⬆',
      text: ['Ia nivelul din antrenament', 'Claim the training level'],
      why: ['Antrenamentul s-a terminat: +1 nivel gratuit.', 'Training is over: +1 free level.'],
      go: { kind: 'panel', panel: 'dino', dinoId: s.training.dinoId },
    };
  if (farmReadyFood(s, now) > 0)
    return {
      id: 'harvest',
      icon: '🌾',
      text: [`Recoltează +${farmReadyFood(s, now)} hrană`, `Harvest +${farmReadyFood(s, now)} food`],
      why: [
        'Hrana crește dinozaurii. Replantează după ce culegi.',
        'Food grows your dinosaurs. Replant after you harvest.',
      ],
      go: { kind: 'harvest' },
    };
  if (s.crafting.some((j) => j.endsAt <= now))
    return {
      id: 'craft-done',
      icon: '⚒',
      text: ['Ia obiectele din Atelier', 'Collect from the Workshop'],
      why: ['Atelierul a terminat ce i-ai cerut.', 'The Workshop finished what you asked for.'],
      go: { kind: 'panel', panel: 'workshop' },
    };
  if (day.spin === null)
    return {
      id: 'wheel',
      icon: '🎡',
      text: ['Învârte roata zilei (gratuit)', 'Spin the daily wheel (free)'],
      why: [
        'O rotire gratuită pe zi: aur, hrană, materiale sau diamante.',
        'One free spin a day: gold, food, materials or diamonds.',
      ],
      go: { kind: 'panel', panel: 'daily' },
    };
  if (day.quests.some((id) => !day.claimed.includes(id) && day.progress[id] >= DAILY_QUESTS[id].target))
    return {
      id: 'daily-claim',
      icon: '📜',
      text: ['Ia premiul misiunii zilnice', 'Claim a daily mission'],
      why: [
        'Ai terminat o misiune zilnică: premiul te așteaptă în „Zilnic”.',
        'You finished a daily mission: the reward waits under "Daily".',
      ],
      go: { kind: 'panel', panel: 'daily' },
    };

  // ---- the champion at its evolution gate ----
  const gate = home.find((d) => d.stage !== 'adult' && d.level === levelCap(d.stage) && d.stage === 'baby');
  if (gate && s.food >= feedCost(gate.level))
    return {
      id: 'evolve',
      icon: '✦',
      text: [`Evoluează-l pe ${gate.nickname}`, `Evolve ${gate.nickname}`],
      why: [
        'A ajuns la nivelul 9: devine juvenil, mai puternic, și poate pleca în expediții.',
        'It reached level 9: it becomes a stronger juvenile that can go on expeditions.',
      ],
      go: { kind: 'panel', panel: 'dino', dinoId: gate.id },
    };

  // ---- the story goal, when it can be done now ----
  let foodGoal: NextAction | null = null;
  if (story) {
    if (story.building && !has(story.building)) {
      const cost = UTILITY_BUILDINGS[story.building].cost;
      if (s.gold >= cost)
        return {
          id: 'story-build',
          icon: '🏗',
          text: [
            `Construiește: ${UTILITY_BUILDINGS[story.building].name[0]}`,
            `Build: ${UTILITY_BUILDINGS[story.building].name[1]}`,
          ],
          why: story.hint,
          go: { kind: 'panel', panel: 'build', building: story.building },
        };
    } else if (story.panel === 'expedition') {
      const region = REGIONS.find((r) => s.habitats[r.element] && (s.expeditionProgress[r.id] ?? 0) < 5);
      if (region && s.portalLevel > 0 && !s.expeditions.some((x) => x.kind === 'stage' && x.regionId === region.id)) {
        const level = stageLevel(regionNumber(region.id), (s.expeditionProgress[region.id] ?? 0) + 1);
        const ready = home.filter((d) => d.stage !== 'baby' && d.level >= level);
        const plan = expeditionPlan(
          s,
          region.id,
          ready.slice(0, 1).map((d) => d.id),
        );
        if (ready.length && (plan.blocker === null || plan.blocker === 'teamSize'))
          return {
            id: 'story-trip',
            icon: '🧭',
            text: [
              `Pornește etapa ${plan.stage + 1}: ${region.name[0]}`,
              `Start stage ${plan.stage + 1}: ${region.name[1]}`,
            ],
            why: [
              `Durează ${Math.round(plan.duration / 60_000)} min și aduce aur, hrană și materiale.`,
              `It takes ${Math.round(plan.duration / 60_000)} min and brings gold, food and materials.`,
            ],
            go: { kind: 'panel', panel: 'expedition' },
          };
        // Not strong enough yet: food is the way there.
        const best = home.filter((d) => d.stage !== 'baby').sort((a, b) => b.level - a.level)[0];
        if (best && best.level < level && best.level < levelCap(best.stage) && s.food >= feedCost(best.level))
          return {
            id: 'feed-for-trip',
            icon: '🍖',
            text: [
              `Hrănește-l pe ${best.nickname} (${feedCost(best.level)} hrană)`,
              `Feed ${best.nickname} (${feedCost(best.level)} food)`,
            ],
            why: [
              `Etapa următoare cere nivelul ${level}; ${best.nickname} e la ${best.level}.`,
              `The next stage needs level ${level}; ${best.nickname} is at ${best.level}.`,
            ],
            go: { kind: 'panel', panel: 'dino', dinoId: best.id },
          };
        if (best && best.level < level)
          foodGoal = {
            id: 'food-for-trip',
            icon: '🌾',
            text: [
              `Strânge ${feedCost(best.level) - Math.floor(s.food)} hrană pentru ${best.nickname}`,
              `Gather ${feedCost(best.level) - Math.floor(s.food)} food for ${best.nickname}`,
            ],
            why: [
              `Etapa următoare cere nivelul ${level}. Hrana vine din fermă, mângâieri, roată și misiunile zilei.`,
              `The next stage needs level ${level}. Food comes from the farm, pets, the wheel and daily missions.`,
            ],
            go: has('farm') ? { kind: 'panel', panel: 'farm' } : null,
            waiting: true,
          };
      }
    } else if (!['expedition', 'arena', 'realms'].includes(story.panel) && story.panel !== 'dino') {
      return {
        id: 'story-go',
        icon: '✦',
        text: [story.task[0], story.task[1]],
        why: story.hint,
        go: { kind: 'panel', panel: story.panel, building: story.building },
      };
    }
  }

  // ---- small things that keep the island moving ----
  const nests = s.eggs.filter((e) => e.hatchAt !== null).length;
  const shelf = s.eggs.find((e) => e.hatchAt === null && s.habitats[e.element]);
  if (shelf && nests < hatcherySlots(s))
    return {
      id: 'incubate',
      icon: '🥚',
      text: ['Pune un ou la incubat', 'Put an egg in the nest'],
      why: [
        'Ai un ou pe raft și un cuib liber. Ouăle nu eclozează singure.',
        'You have an egg on the shelf and a free nest. Eggs never hatch by themselves.',
      ],
      go: { kind: 'panel', panel: 'hatchery' },
    };
  const hungry = home
    .filter((d) => d.level < levelCap(d.stage) && s.food >= feedCost(d.level))
    .sort((a, b) => b.level - a.level)[0];
  if (hungry)
    return {
      id: 'feed',
      icon: '🍖',
      text: [
        `Hrănește-l pe ${hungry.nickname} (${feedCost(hungry.level)} hrană)`,
        `Feed ${hungry.nickname} (${feedCost(hungry.level)} food)`,
      ],
      why: [
        'Fiecare masă = +1 nivel. Nivelurile deschid etape noi și lupte.',
        'Every meal = +1 level. Levels open new stages and fights.',
      ],
      go: { kind: 'panel', panel: 'dino', dinoId: hungry.id },
    };
  if (has('farm') && s.plots.some((p) => !p))
    return {
      id: 'plant',
      icon: '🌿',
      text: ['Plantează la fermă', 'Plant at the farm'],
      why: [
        'Un strat e gol. Ferigile sunt gata în 5 minute, gratuit.',
        'A plot is empty. Ferns are ready in 5 minutes, for free.',
      ],
      go: { kind: 'panel', panel: 'farm' },
    };
  if (day.pets < PET.perDay && home.length)
    return {
      id: 'pet',
      icon: '❤',
      text: [`Mângâie-l pe ${home[0].nickname} (+${PET.food} hrană)`, `Pet ${home[0].nickname} (+${PET.food} food)`],
      why: [
        `De ${PET.perDay} ori pe zi, fiecare mângâiere dă hrană.`,
        `${PET.perDay} times a day, every pet gives food.`,
      ],
      go: { kind: 'panel', panel: 'dino', dinoId: home[0].id },
    };
  const trainee = home.find((d) => d.level < levelCap(d.stage));
  if (!s.training && day.trainings < TRAINING.perDay && trainee)
    return {
      id: 'train',
      icon: '⬆',
      text: [`Antrenează-l pe ${trainee.nickname} (gratuit)`, `Train ${trainee.nickname} (free)`],
      why: [
        `${TRAINING.minutes} de minute pentru +1 nivel, fără hrană.`,
        `${TRAINING.minutes} minutes for +1 level, no food needed.`,
      ],
      go: { kind: 'panel', panel: 'dino', dinoId: trainee.id },
    };
  if (treasureReady(s, now))
    return {
      id: 'treasure',
      icon: '💎',
      text: ['Ia comoara de pe insulă', 'Pick up the island treasure'],
      why: ['O comoară a apărut pe insulă. Atinge-o.', 'A treasure appeared on the island. Tap it.'],
      go: { kind: 'home' },
    };
  if (foodGoal) return foodGoal;
  if (story && story.building && !has(story.building)) {
    const missing = UTILITY_BUILDINGS[story.building].cost - Math.floor(s.gold);
    return {
      id: 'story-gold',
      icon: '🪙',
      text: [
        `Strânge ${missing} aur pentru ${UTILITY_BUILDINGS[story.building].name[0]}`,
        `Save ${missing} gold for the ${UTILITY_BUILDINGS[story.building].name[1]}`,
      ],
      why: [
        'Dinozaurii din lumi fac aur singuri: apasă „Colectează” jos.',
        'Dinosaurs in their worlds make gold on their own: tap "Collect" below.',
      ],
      go: null,
      waiting: true,
    };
  }

  // ---- only timers left ----
  const timers: { at: number; text: Text }[] = [
    ...s.expeditions.map((x) => ({ at: x.endsAt, text: ['Echipa revine', 'The team is back'] as Text })),
    ...s.eggs
      .filter((e) => e.hatchAt !== null)
      .map((e) => ({ at: e.hatchAt!, text: ['Oul e gata', 'The egg is ready'] as Text })),
    ...s.plots.flatMap((p) => (p ? [{ at: p.readyAt, text: ['Recolta e gata', 'The crop is ready'] as Text }] : [])),
    ...(s.training ? [{ at: s.training.endsAt, text: ['Antrenamentul e gata', 'Training is done'] as Text }] : []),
    ...(s.construction
      ? [{ at: s.construction.endsAt, text: ['Construcția e gata', 'The build is done'] as Text }]
      : []),
  ].filter((t) => t.at > now);
  const soonest = timers.sort((a, b) => a.at - b.at)[0];
  if (soonest) {
    const left = span(soonest.at - now);
    return {
      id: 'wait',
      icon: '⏳',
      text: [`${soonest.text[0]} în ${left[0]}`, `${soonest.text[1]} in ${left[1]}`],
      why: [
        'Totul lucrează pentru tine. Poți închide jocul liniștit: progresul continuă și fără tine.',
        'Everything is working for you. You can close the game: progress keeps going without you.',
      ],
      go: null,
      waiting: true,
    };
  }
  return null;
}
