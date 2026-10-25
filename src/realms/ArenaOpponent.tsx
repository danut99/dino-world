import type { Foe } from './arenaTeams';
import type { Clip } from './animation';
import { DinosaurArt } from './DinosaurArt';
import { ARENA_BOSSES } from './arenaBosses';
import { AnimatedBoss } from './AnimatedBoss';

/** An arena opponent's art: the league boss's own animation, or the regular family's sprites. */
export function ArenaOpponent({ foe, className = '', animation = 'idle', speed, paused }: {
  foe: Pick<Foe, 'species' | 'element' | 'stage' | 'boss'>;
  className?: string;
  animation?: Clip;
  speed?: number;
  /** Holds the first frame: the battle portraits use a still. */
  paused?: boolean;
}) {
  const boss = foe.boss ? ARENA_BOSSES[foe.element] : undefined;
  if (boss) return <AnimatedBoss element={foe.element} name={boss.name} animation={animation} className={className} speed={speed} paused={paused} />;
  return (
    <DinosaurArt species={foe.species} element={foe.element} stage={foe.stage} className={className} animation={animation} speed={speed} paused={paused} frame={paused ? 0 : undefined} />
  );
}
