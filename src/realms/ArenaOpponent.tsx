import type { Encounter } from './content';
import type { RealmId, Species, Stage } from './game';
import type { Clip } from './animation';
import { DinosaurArt } from './DinosaurArt';
import { arenaBoss } from './arenaBosses';
import { AnimatedBoss } from './AnimatedBoss';

export function ArenaOpponent({ encounter, species, element, stage, className = '', animation = 'idle' }: {
  encounter: Encounter; species: Species; element: RealmId; stage: Stage; className?: string; animation?: Clip;
}) {
  const boss = arenaBoss(encounter);
  if (boss?.animated) return <AnimatedBoss element={encounter.league as RealmId} name={boss.name}
    animation={animation} className={className} />;
  return boss ? <img className={`realm-hero arena-boss-art ${className}`} src={boss.art}
    alt={`${boss.name} · ${element} ${boss.species} arena boss`} data-boss={encounter.league} data-animation={animation} />
    : <DinosaurArt species={species} element={element} stage={stage} className={className} animation={animation} />;
}
