import { useEffect, useRef } from 'react';
import { drawWorkshop, WORKSHOP_ART } from './animatedWorkshop';
import { loadSpriteImage } from './animation';
import { useReducedMotion } from './useMotion';

export function AnimatedWorkshopSprite() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    let active = true, raf = 0, elapsed = 0, previous = 0;
    loadSpriteImage(WORKSHOP_ART).then(image => {
      if (!active) return;
      const paint = (now: number) => {
        const ctx = ref.current?.getContext('2d');
        if (!active || !ctx) return;
        if (!document.hidden && previous && !reduced) elapsed += Math.min(now - previous, 100);
        previous = now;
        ctx.clearRect(0, 0, 400, 400);
        drawWorkshop(ctx, image, elapsed, 0, 0, 400);
        if (!reduced) raf = requestAnimationFrame(paint);
      };
      paint(performance.now());
    }).catch(() => {});
    return () => { active = false; cancelAnimationFrame(raf); };
  }, [reduced]);
  return <canvas ref={ref} width={400} height={400} className="utility-sprite" aria-hidden="true" />;
}
