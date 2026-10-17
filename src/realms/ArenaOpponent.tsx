import type { Encounter } from './content';
import type { RealmId, Species, Stage } from './game';
import { DinosaurArt } from './DinosaurArt';
import { arenaBoss } from './arenaBosses';

export function ArenaOpponent({ encounter, species, element, stage, className = '' }: {
  encounter: Encounter; species: Species; element: RealmId; stage: Stage; className?: string;
}) {
  const boss = arenaBoss(encounter);
  return boss ? <img className={`realm-hero arena-boss-art ${className}`} src={boss.art}
    alt={`${boss.name} · ${element} ${boss.species} arena boss`} data-boss={encounter.league} />
    : <DinosaurArt species={species} element={element} stage={stage} className={className} />;
}
