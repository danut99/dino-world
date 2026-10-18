import type { Encounter } from './content';
import type { RealmId, Species } from './game';

/** Dedicated released champions and reserved artwork for future leagues. */
export const ARENA_BOSSES: Record<RealmId, { name: string; species: Species; art?: string; animated?: boolean }> = {
  fire: { name: 'Ignaroth', species: 'brachiosaurus', animated: true },
  water: { name: 'Thalassion', species: 'trex', animated: true },
  earth: { name: 'Terragor', species: 'raptor', animated: true },
  nature: { name: 'Sylvaraa', species: 'triceratops', animated: true },
  ice: { name: 'Glacier Colossus', species: 'ankylosaurus', art: '/realms/bosses/ice.webp' },
  lightning: { name: 'Zevoltus', species: 'brachiosaurus', animated: true },
  wind: { name: 'Sky Marshal', species: 'trex', art: '/realms/bosses/wind.webp' },
  dark: { name: 'Eclipse Stalker', species: 'raptor', art: '/realms/bosses/dark.webp' },
  light: { name: 'Dawn Hierarch', species: 'triceratops', art: '/realms/bosses/light.webp' },
  arcane: { name: 'Sigil Overlord', species: 'ankylosaurus', art: '/realms/bosses/arcane.webp' },
};
export function arenaBoss(encounter: Encounter) {
  return ['fire', 'water', 'earth', 'nature', 'ice', 'lightning'].includes(encounter.league ?? '') && encounter.mode === 'arena' && encounter.id === `arena-${encounter.league}-3`
    ? ARENA_BOSSES[encounter.league as RealmId] : undefined;
}
