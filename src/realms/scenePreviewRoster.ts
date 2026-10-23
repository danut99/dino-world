import { PLAYABLE_DINOSAURS } from './playableDinosaurs';
import { ANIMATED_BOSS_ELEMENTS } from './animation';
import { ARENA_BOSSES } from './arenaBosses';
import { newSave, SPECIES_NAMES, type Dino, type RealmId, type Save, type Species, type Stage } from './game';

/** Pure helpers for the scene preview page (`?mode=preview`): the roster, URL ids and the synthetic save. */
export const STAGES: Stage[] = ['baby', 'juvenile', 'adult'];
export type RosterEntry = { id: string; species: Species; element: RealmId; stage: Stage };
/** Every animated dinosaur the game can show, one entry per growth stage. */
export const ROSTER: RosterEntry[] = PLAYABLE_DINOSAURS.flatMap(({ species, element }) =>
  STAGES.map((stage) => ({ id: `${species}_${element}_${stage}`, species, element, stage })),
);
export const FAMILIES = PLAYABLE_DINOSAURS.map(({ species, element }) => ({ id: `${species}_${element}`, species, element }));
/** Arena champions with produced animation; they fight as adults and never live in a habitat. */
export const BOSSES = ANIMATED_BOSS_ELEMENTS.map((element) => ({ id: `boss_${element}`, element, name: ARENA_BOSSES[element].name }));
export type Combatant = { kind: 'dino'; entry: RosterEntry } | { kind: 'boss'; element: RealmId; name: string };

export const stageLabel = (stage: Stage, lang: number) =>
  (lang ? { baby: 'Baby', juvenile: 'Juvenile', adult: 'Adult' } : { baby: 'Copil', juvenile: 'Juvenil', adult: 'Adult' })[stage];

export function rosterEntry(id: string | null | undefined) {
  return ROSTER.find((entry) => entry.id === id);
}
export function combatant(id: string | null | undefined): Combatant | undefined {
  const boss = BOSSES.find((b) => b.id === id);
  if (boss) return { kind: 'boss', element: boss.element, name: boss.name };
  const entry = rosterEntry(id);
  return entry && { kind: 'dino', entry };
}
export const combatantId = (c: Combatant) => (c.kind === 'boss' ? `boss_${c.element}` : c.entry.id);
export const combatantElement = (c: Combatant) => (c.kind === 'boss' ? c.element : c.entry.element);
/** Growth stage that decides the clips and commands on offer: champions are always adults. */
export const combatantStage = (c: Combatant): Stage => (c.kind === 'boss' ? 'adult' : c.entry.stage);
export const combatantName = (c: Combatant, lang: number) =>
  c.kind === 'boss' ? `BOSS ${c.name}` : `${SPECIES_NAMES[c.entry.species]} ${stageLabel(c.entry.stage, lang)}`;
/** A sparring partner from another family at the same stage, so both sides are drawn at a matching size. */
export function defaultOpponent(ally: Combatant): Combatant {
  const stage = combatantStage(ally);
  const other = ROSTER.find(
    (e) => e.stage === stage && (ally.kind === 'boss' || e.species !== ally.entry.species || e.element !== ally.entry.element),
  );
  return { kind: 'dino', entry: other ?? ROSTER[0] };
}

/** Residents of the habitat scene: the chosen dinosaur, optionally with its siblings and neighbours. */
export function habitatResidents(
  entry: RosterEntry,
  options: { allStages?: boolean; allFamilies?: boolean },
  lang: number,
): Dino[] {
  const families = options.allFamilies
    ? FAMILIES.filter((f) => f.element === entry.element)
    : [{ species: entry.species, element: entry.element }];
  const stages = options.allStages ? STAGES : [entry.stage];
  return families.flatMap(({ species, element }) =>
    stages.map((stage) => ({
      id: `${species}_${element}_${stage}`,
      species,
      element,
      stage,
      level: stage === 'baby' ? 1 : stage === 'juvenile' ? 8 : 20,
      nickname: families.length > 1 ? `${species} ${stageLabel(stage, lang)}` : stageLabel(stage, lang),
    })),
  );
}
/** A throwaway save for the world renderer: no buildings, no eggs, only the previewed residents. */
export function previewSave(dinos: Dino[]): Save {
  return { ...newSave(0), buildings: [], eggs: [], habitats: {}, dinos, champion: dinos[0]?.id ?? null };
}
