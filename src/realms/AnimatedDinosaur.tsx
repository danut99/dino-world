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
  const drawingScale = manifest.variantId === 'ankylobiped_lightning' ? 3 : 1.5;
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
          // Extra drawing room keeps enlarged attack effects inside the canvas.
          // The CSS scale compensates for this padding without changing layout.
          const width = canvas.width / drawingScale, height = canvas.height / drawingScale;
          const left = (canvas.width - width) / 2;
          const top = (canvas.height - height) / 2;
          drawSprite(ctx, image, selected, index, left, top, width, height, manifest);
          canvas.dataset.frame = String(index);
          if (bounds) {
            ctx.strokeStyle = '#68e5c4';
            ctx.lineWidth = 1;
            ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);
            const p = manifest.pivot;
            ctx.fillStyle = '#ff75ae';
            ctx.fillRect(left + p.x - 5, top + p.y, 11, 1);
            ctx.fillRect(left + p.x, top + p.y - 5, 1, 11);
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
  }, [selected, paused, reduced, frame, bounds, manifest, speed, drawingScale]);
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
      width={manifest.sourceSize.width * drawingScale}
      height={manifest.sourceSize.height * drawingScale}
      style={{ scale: drawingScale, transformOrigin: 'center' }}
      role="img"
      aria-label={label}
      data-animation={clip}
      data-art-ready="true"
      data-boss={bossElement}
    />
  );
}
