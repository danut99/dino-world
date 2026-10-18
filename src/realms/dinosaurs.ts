import { ELEMENTS, SPECIES_NAMES, type Stage } from './game';
import { PLAYABLE_DINOSAURS } from './playableDinosaurs';

export { SPECIES, SPECIES_NAMES } from './game';
export type { Species } from './game';
export const STAGES: Stage[] = ['baby', 'juvenile', 'adult'];
export const DINOSAURS = PLAYABLE_DINOSAURS.map(({ species, element }) => ({
  id: `${species}_${element}`, species, element,
  name: SPECIES_NAMES[species], role: ELEMENTS.find(e => e.id === element)!.role,
}));
export const worldResidents = (element: string) => DINOSAURS.filter(d => d.element === element);
