import type { Encounter } from './content';
import type { RealmId, Species } from './game';

/** Dedicated released champions and reserved artwork for future leagues. */
export const ARENA_BOSSES: Record<RealmId, { name: string; species: Species; art?: string; animated?: boolean }> = {
  fire: { name: 'Ignaroth', species: 'brachiosaurus', animated: true },
  water: { name: 'Thalassion', species: 'trex', animated: true },
  earth: { name: 'Terragor', species: 'raptor', animated: true },
  nature: { name: 'Sylvaraa', species: 'triceratops', animated: true },
  ice: { name: 'Criothar', species: 'ankylosaurus', animated: true },
  lightning: { name: 'Zevoltus', species: 'brachiosaurus', animated: true },
  wind: { name: 'Aerion', species: 'trex', animated: true },
  dark: { name: 'Noxar', species: 'raptor', animated: true },
  light: { name: 'Solarius', species: 'triceratops', animated: true },
  arcane: { name: 'Arcanith', species: 'ankylosaurus', animated: true },
};
export function arenaBoss(encounter: Encounter) {
  return Object.hasOwn(ARENA_BOSSES, encounter.league ?? '') && encounter.mode === 'arena' && encounter.id === `arena-${encounter.league}-3`
    ? ARENA_BOSSES[encounter.league as RealmId] : undefined;
}
