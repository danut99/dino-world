import type { Encounter } from './content';
import type { RealmId, Species } from './game';

/** Each league's champion boss: its name and the species its stats follow; every one has its own animation (AnimatedBoss). */
export const ARENA_BOSSES: Record<RealmId, { name: string; species: Species }> = {
  fire: { name: 'Ignaroth', species: 'brachiosaurus' },
  water: { name: 'Thalassion', species: 'trex' },
  earth: { name: 'Terragor', species: 'raptor' },
  nature: { name: 'Sylvaraa', species: 'triceratops' },
  ice: { name: 'Criothar', species: 'ankylosaurus' },
  lightning: { name: 'Zevoltus', species: 'brachiosaurus' },
  wind: { name: 'Aerion', species: 'trex' },
  dark: { name: 'Noxar', species: 'raptor' },
  light: { name: 'Solarius', species: 'triceratops' },
  arcane: { name: 'Arcanith', species: 'ankylosaurus' },
};
export function arenaBoss(encounter: Encounter) {
  return Object.hasOwn(ARENA_BOSSES, encounter.league ?? '') && encounter.mode === 'arena' && encounter.id === `arena-${encounter.league}-3`
    ? ARENA_BOSSES[encounter.league as RealmId] : undefined;
}
