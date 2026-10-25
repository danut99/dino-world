import { ARENA_BOSSES } from './arenaBosses';
import { SPECIES_NAMES, type Species } from './dinosaurs';
import type { RealmId, Stage } from './game';
import { useEffect, useState } from 'react';
import { loadAnimation, type Clip, type Facing, type SpriteManifest } from './animation';
import { AnimatedDinosaur } from './AnimatedDinosaur';

export function DinosaurArt({
  species,
  element,
  stage,
  className = '',
  animation = 'idle',
  facing = 'se',
  paused,
  frame,
  bounds,
  speed,
}: {
  species: Species;
  element: RealmId;
  stage: Stage;
  className?: string;
  animation?: Clip;
  facing?: Facing;
  paused?: boolean;
  frame?: number;
  bounds?: boolean;
  speed?: number;
}) {
  const [manifest, setManifest] = useState<SpriteManifest | null>(null);
  useEffect(() => {
    let active = true;
    setManifest(null);
    loadAnimation(species, element, stage).then((m) => {
      if (active) setManifest(m);
    });
    return () => {
      active = false;
    };
  }, [species, element, stage]);
  // A young boss borrows its adult sprites (the only ones bosses have), a size smaller.
  const youngBoss = species === 'boss' && stage !== 'adult';
  if (manifest?.variantId === `${species}_${element}` && (manifest.stage === stage || youngBoss) && (manifest.clips[facing]?.[animation] || manifest.clips[facing]?.idle))
    return (
      <AnimatedDinosaur
        manifest={manifest}
        clip={manifest.clips[facing]?.[animation] ? animation : 'idle'}
        facing={facing}
        paused={paused}
        frame={frame}
        bounds={bounds}
        speed={speed}
        className={youngBoss ? `young-boss ${className}` : className}
        label={species === 'boss' ? ARENA_BOSSES[element].name : `${element} ${SPECIES_NAMES[species]} ${stage}`}
        bossElement={species === 'boss' ? element : undefined}
      />
    );
  return <span className={`dinosaur-art ${className}`} role="status" aria-label="Loading animation" />;
}
