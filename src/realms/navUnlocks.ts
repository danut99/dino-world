import type { Save } from './game';

/** The buttons of the bottom bar, in their order. */
export const NAV_KEYS = ['build', 'dino', 'collection', 'realms', 'expedition', 'arena', 'workshop', 'collect'] as const;
export type NavKey = (typeof NAV_KEYS)[number];

/**
 * Which bottom-bar buttons a player sees. A newcomer starts with only the worlds (the story card leads on);
 * each appears when the game first needs it, so the first minutes show one thing at a time:
 * - dinosaurs, building and collecting once the first egg hatched;
 * - expeditions once a dinosaur is old enough to go (juvenile);
 * - the collection after the first expedition stage (the worlds are always there);
 * - the arena and the workshop once their buildings stand.
 * A player already past the first minutes (an existing account) sees every main button at once.
 * `asked` is the panel the story card points to: its button always shows, so the guide never points at nothing.
 */
export function unlockedNav(
  s: Pick<Save, 'dinos' | 'cleared' | 'buildings' | 'expeditions' | 'habitats' | 'expeditionProgress'>,
  asked?: string | null,
): Set<NavKey> {
  const hatched = s.dinos.length > 0;
  // A first expedition stage brought back (or, for an older shape of the save, any cleared fight).
  const travelled = Object.values(s.expeditionProgress ?? {}).some((n) => (n ?? 0) > 0) || s.cleared.length > 0;
  const has = (kind: string) => s.buildings.some((b) => b.kind === kind);
  // The worlds are always reachable: the hub button in the middle of the bar.
  const open = new Set<NavKey>(['realms']);
  const established =
    travelled || s.dinos.length > 1 || s.buildings.some((b) => b.kind !== 'hatchery' && b.kind !== 'farm') || Object.keys(s.habitats).length > 1;
  if (established) open.add('dino').add('build').add('collect').add('expedition').add('collection');
  if (hatched) open.add('dino').add('build').add('collect');
  if (s.dinos.some((d) => d.stage !== 'baby') || travelled || s.expeditions.length) open.add('expedition');
  if (travelled || Object.keys(s.habitats).length > 1) open.add('collection');
  if (has('arena') || s.cleared.some((id) => id.startsWith('arena-'))) open.add('arena');
  if (has('workshop')) open.add('workshop');
  if (asked && (NAV_KEYS as readonly string[]).includes(asked)) open.add(asked as NavKey);
  return open;
}
