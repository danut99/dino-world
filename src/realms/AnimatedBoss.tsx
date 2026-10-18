import { useEffect, useState } from 'react';
import { AnimatedDinosaur } from './AnimatedDinosaur';
import { loadBossAnimation, loadSpriteImage, type Clip, type SpriteManifest } from './animation';
import type { RealmId } from './game';

export function AnimatedBoss({ element, name, animation, className }: {
  element: RealmId; name: string; animation: Clip; className: string;
}) {
  const [manifest, setManifest] = useState<SpriteManifest | null>(null);
  useEffect(() => {
    let active = true;
    setManifest(null);
    loadBossAnimation(element).then(async m => {
      if (!m || !active) return;
      await Promise.all(Object.values(m.clips.se ?? {}).map(clip => loadSpriteImage(clip.sheet)));
      if (active) setManifest(m);
    }).catch(() => {});
    return () => { active = false; };
  }, [element]);
  return manifest?.variantId === `boss_${element}`
      ? <AnimatedDinosaur manifest={manifest} clip={manifest.clips.se?.[animation] ? animation : 'idle'} label={`${name} arena boss`}
          bossElement={element} className={`arena-boss-art ${className}`} />
      : <span role="status" aria-label={name} />;
}
