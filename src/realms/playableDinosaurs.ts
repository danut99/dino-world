import { ARENA_BOSSES } from './arenaBosses';
import inventory from './animation-inventory.json';
import type { RealmId, Species } from './game';

const stages = ['baby', 'juvenile', 'adult'];
const ids = new Set(inventory);
/** Only families with all three animated ages can enter the playable roster. */
export const PLAYABLE_DINOSAURS = inventory.filter(id => id.endsWith('_adult'))
  .map(id => {
    const [species, element] = id.split('_') as [Species, RealmId];
    return { species, element };
  })
  .filter(({ species, element }) => stages.every(stage => ids.has(`${species}_${element}_${stage}`)));
export const isPlayableDinosaur = (species: Species, element: RealmId) =>
  species === 'boss' ? Object.hasOwn(ARENA_BOSSES, element) : PLAYABLE_DINOSAURS.some(d => d.species === species && d.element === element);
export const playableSpecies = (element: RealmId) =>
  PLAYABLE_DINOSAURS.filter(d => d.element === element).map(d => d.species);
