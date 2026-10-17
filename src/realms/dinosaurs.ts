import { ELEMENTS, SPECIES, SPECIES_NAMES, type RealmId, type Species, type Stage } from './game';

export { SPECIES, SPECIES_NAMES };
export type { Species };
export const STAGES: Stage[] = ['baby', 'juvenile', 'adult'];
export const DINOSAURS = ELEMENTS.flatMap(element => SPECIES.map(species => ({
  id: `${species}_${element.id}`, species, element: element.id,
  name: SPECIES_NAMES[species], role: element.role,
  art: `/realms/dinosaurs/${element.id}.webp`,
})));
export function dinosaurCell(species: Species, stage: Stage) {
  return { column: STAGES.indexOf(stage), row: SPECIES.indexOf(species) };
}
export const worldResidents = (element: RealmId) => DINOSAURS.filter(d => d.element === element);
type Crop = { x: number; y: number; width: number; height: number; path?: string };
type Sheet = { width: number; height: number; cells: Crop[] };
const sheets: Partial<Record<RealmId, Sheet>> = {};
const loaders = {
  fire: () => import('./dinosaur-crop-data/fire.json'),
  water: () => import('./dinosaur-crop-data/water.json'),
  earth: () => import('./dinosaur-crop-data/earth.json'),
  nature: () => import('./dinosaur-crop-data/nature.json'),
  ice: () => import('./dinosaur-crop-data/ice.json'),
  lightning: () => import('./dinosaur-crop-data/lightning.json'),
  wind: () => import('./dinosaur-crop-data/wind.json'),
  dark: () => import('./dinosaur-crop-data/dark.json'),
  light: () => import('./dinosaur-crop-data/light.json'),
  arcane: () => import('./dinosaur-crop-data/arcane.json'),
};
const pending: Partial<Record<RealmId, Promise<void>>> = {};
export function loadDinosaurArt(element: RealmId): Promise<void> {
  if (sheets[element]) return Promise.resolve();
  return pending[element] ??= loaders[element]().then(module => { sheets[element] = module.default; });
}
export function dinosaurCrop(element: RealmId, species: Species, stage: Stage) {
  const { column, row } = dinosaurCell(species, stage);
  const sheet = sheets[element];
  return sheet ? { ...sheet.cells[row * 3 + column], sheetWidth: sheet.width, sheetHeight: sheet.height }
    : { x: column * 100, y: row * 100, width: 100, height: 100, sheetWidth: 300, sheetHeight: 500, path: undefined };
}
