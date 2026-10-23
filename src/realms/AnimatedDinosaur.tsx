import { useEffect, useRef, useState } from 'react';
import { drawSprite, frameAt, loadSpriteImage, type Clip, type Facing, type SpriteManifest } from './animation';
import { useReducedMotion } from './useMotion';

export function AnimatedDinosaur({
  manifest,
  clip = 'idle',
  facing = 'se',
  paused = false,
  frame,
  className = '',
  label,
  bounds = false,
  bossElement,
  speed = 1,
}: {
  manifest: SpriteManifest;
  clip?: Clip;
  facing?: Facing;
  paused?: boolean;
  frame?: number;
  className?: string;
  label: string;
  bounds?: boolean;
  bossElement?: string;
  /** Playback rate: 2 plays the clip twice as fast (the battle's ×2 button). */
  speed?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const selected = manifest.clips[facing]?.[clip];
  useEffect(() => {
    const canvas = ref.current,
      ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !selected) return;
    let alive = true,
      raf = 0,
      time = 0,
      previous = 0;
    setFailed(false);
    loadSpriteImage(selected.sheet)
      .then((image) => {
        if (!alive) return;
        const paint = (now: number) => {
          if (!alive) return;
          if (!document.hidden && !paused && !reduced && previous) time += Math.min(now - previous, 100) * speed;
          previous = now;
          const index =
            frame === undefined
              ? frameAt(selected, time)
              : Math.max(0, Math.min(frame, selected.durationsMs.length - 1));
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingEnabled = false;
          drawSprite(ctx, image, selected, index, 0, 0, canvas.width, canvas.height);
          canvas.dataset.frame = String(index);
          if (bounds) {
            ctx.strokeStyle = '#68e5c4';
            ctx.lineWidth = 1;
            ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
            const p = manifest.pivot;
            ctx.fillStyle = '#ff75ae';
            ctx.fillRect(p.x - 5, p.y, 11, 1);
            ctx.fillRect(p.x, p.y - 5, 1, 11);
          }
          if (!paused && !reduced && (selected.loop || index < selected.durationsMs.length - 1))
            raf = requestAnimationFrame(paint);
        };
        paint(performance.now());
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [selected, paused, reduced, frame, bounds, manifest, speed]);
  if (!selected || failed)
    return (
      <span className="realm-note" role="status">
        {failed ? 'Sprite unavailable' : 'Clip unavailable'}
      </span>
    );
  return (
    <canvas
      ref={ref}
      className={`realm-hero dinosaur-art animated-dinosaur ${manifest.stage} ${className}`}
      width={manifest.sourceSize.width}
      height={manifest.sourceSize.height}
      role="img"
      aria-label={label}
      data-animation={clip}
      data-art-ready="true"
      data-boss={bossElement}
    />
  );
}
