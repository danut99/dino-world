import type { Encounter } from './content';
import type { RealmId, Species } from './game';

/** Dedicated champion artwork; tiers one and two retain their ordinary opponents. */
export const ARENA_BOSSES: Record<RealmId, { name: string; species: Species; art: string }> = {
  fire: { name: 'Furnace Sovereign', species: 'brachiosaurus', art: '/realms/bosses/fire.webp' },
  water: { name: 'Tidebreaker', species: 'trex', art: '/realms/bosses/water.webp' },
  earth: { name: 'Monolith Warden', species: 'raptor', art: '/realms/bosses/earth.webp' },
  nature: { name: 'Thorn Regent', species: 'triceratops', art: '/realms/bosses/nature.webp' },
  ice: { name: 'Glacier Colossus', species: 'ankylosaurus', art: '/realms/bosses/ice.webp' },
  lightning: { name: 'Storm Conductor', species: 'brachiosaurus', art: '/realms/bosses/lightning.webp' },
  wind: { name: 'Sky Marshal', species: 'trex', art: '/realms/bosses/wind.webp' },
  dark: { name: 'Eclipse Stalker', species: 'raptor', art: '/realms/bosses/dark.webp' },
  light: { name: 'Dawn Hierarch', species: 'triceratops', art: '/realms/bosses/light.webp' },
  arcane: { name: 'Sigil Overlord', species: 'ankylosaurus', art: '/realms/bosses/arcane.webp' },
};
export function arenaBoss(encounter: Encounter) {
  // Generation stopped at the user's request; unreleased art uses the normal opponent.
  return ['fire', 'water', 'earth', 'nature', 'ice'].includes(encounter.league ?? '') && encounter.mode === 'arena' && encounter.id === `arena-${encounter.league}-3`
    ? ARENA_BOSSES[encounter.league as RealmId] : undefined;
}
