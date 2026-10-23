import { ENCOUNTERS } from './content';
import type { Save } from './game';

export const EXPEDITION_STAGES = [
  ['Explorare', 'Scouting'], ['Descoperire', 'Discovery'], ['Securizare', 'Securing the route'],
] as const;
const minutes = [1, 3, 5, 10, 15, 20, 30, 40, 50, 60];
export const expeditionStageCount = (id: string) => id === 'training' ? 1 : 3;
export function expeditionMs(id: string, stage = 0) {
  const index = ENCOUNTERS.filter(e => e.mode === 'expedition').findIndex(e => e.id === id);
  return (minutes[Math.max(0, index)] ?? 60) * 60_000 * [1, 1.5, 2][stage];
}
/** All preparation checks are shared by the UI and command reducer. */
export function expeditionPlan(save: Save, id: string) {
  const encounter = ENCOUNTERS.find(e => e.id === id && e.mode === 'expedition')!;
  const index = ENCOUNTERS.filter(e => e.mode === 'expedition').findIndex(e => e.id === id);
  const total = expeditionStageCount(id);
  const completed = save.cleared.includes(id) ? total : save.expeditionProgress?.[id] ?? 0;
  const stage = Math.min(completed, total - 1);
  const supplies = index === 0 ? 0 : index < 4 ? 1 : index < 7 ? 2 : 3;
  const level = encounter.level + (total === 1 ? 0 : stage);
  const hero = save.dinos.find(d => d.id === save.champion);
  const previous = !encounter.requires || save.cleared.includes(encounter.requires);
  const trained = !!hero && hero.stage !== 'baby' && hero.level >= level;
  const portal = id === 'training' || save.buildings.some(b => b.kind === 'portal');
  const stocked = save.inventory.provisions >= supplies;
  const available = !!hero && save.battle?.dinoId !== hero.id && !save.expedition;
  return { encounter, total, completed, stage, supplies, level, hero, previous, trained, portal, stocked,
    available, duration: expeditionMs(id, stage), canSend: previous && trained && portal && stocked && available };
}
