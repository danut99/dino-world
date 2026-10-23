import { useEffect, useRef } from 'react';
import { drawHatchery, HATCHERY_STATES } from './animatedHatchery';
import { loadSpriteImage } from './animation';
import { useReducedMotion } from './useMotion';

export function AnimatedHatcherySprite({ art = HATCHERY_STATES[0].art }: { art?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    let active = true, raf = 0, elapsed = 0, previous = 0;
    loadSpriteImage(art).then(image => {
      if (!active) return;
      const paint = (now: number) => {
        const ctx = ref.current?.getContext('2d');
        if (!active || !ctx) return;
        if (!document.hidden && previous && !reduced) elapsed += Math.min(now - previous, 100);
        previous = now;
        ctx.clearRect(0, 0, 480, 480);
        drawHatchery(ctx, image, elapsed, 0, 0, 480);
        if (!reduced) raf = requestAnimationFrame(paint);
      };
      paint(performance.now());
    }).catch(() => {});
    return () => { active = false; cancelAnimationFrame(raf); };
  }, [reduced, art]);
  return <canvas ref={ref} width={480} height={480} className="utility-sprite pixel" aria-hidden="true" />;
}
