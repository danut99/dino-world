export const ARENA_STATES = [
  { art: '/realms/buildings/px/arena-1.png', flames: [[25, 27], [75, 27], [41, 65], [70, 62]] },
  { art: '/realms/buildings/px/arena-2.png', flames: [[25, 12], [72, 14], [25, 31], [75, 32], [41, 70], [72, 67]] },
];
export const arenaState = (image: HTMLImageElement | string) => {
  const src = typeof image === 'string' ? image : image.src;
  return ARENA_STATES.find(state => src.endsWith(state.art));
};

export function drawArena(ctx: CanvasRenderingContext2D, image: HTMLImageElement, ms: number, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(size / 96, size / 96);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, 96, 96);
  const t = ms / 1000;
  arenaState(image)?.flames.forEach(([px, py], i) => {
    const height = 8 + Math.round((Math.sin(t * 8 + i * 2.3) + 1) * 1.5);
    const sway = Math.round(Math.sin(t * 11 + i));
    ctx.fillStyle = '#c74316'; ctx.fillRect(px - 3, py - 5, 6, 5);
    ctx.fillStyle = '#f47b16'; ctx.fillRect(px - 2, py - height + 2, 4, height - 2);
    ctx.fillRect(px + sway - 1, py - height, 2, 4);
    ctx.fillStyle = '#ffc840'; ctx.fillRect(px - 1, py - height + 3, 3, height - 3);
    ctx.fillStyle = '#fff0a3'; ctx.fillRect(px, py - 4, 1, 4);
    if (ms > 0) {
      const age = (t * .6 + i * .31) % 1;
      ctx.globalAlpha = (1 - age) * .8; ctx.fillStyle = '#ffe599';
      ctx.fillRect(px + Math.round(Math.sin(age * 5 + i) * 2), Math.max(0, py - height - Math.round(age * 5)), 1, 1);
      ctx.globalAlpha = 1;
    }
  });
  ctx.restore();
}
