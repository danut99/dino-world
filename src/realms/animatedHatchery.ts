// Coordinates use a 240px logical canvas; the PNGs are exact 2x pixel copies.
export const HATCHERY_STATES = [
  { from: 1, art: '/realms/buildings/hatchery-states/level-1.png', ground: 0.6375,
    flames: [[73, 148], [131, 148]], eggs: [[99, 120]], lights: [[100, 23]] },
  { from: 2, art: '/realms/buildings/hatchery-states/level-2.png', ground: 0.554167,
    flames: [[46, 119], [153, 119], [100, 140]], eggs: [[73, 110], [100, 122], [127, 110]], lights: [[99, 67]] },
  { from: 3, art: '/realms/buildings/hatchery-states/level-3.png', ground: 0.633333,
    flames: [[37, 148], [74, 168], [100, 179], [126, 168], [164, 148]],
    eggs: [[57, 127], [81, 141], [100, 154], [119, 141], [141, 127]], lights: [[91, 55], [93, 19]] },
];
const source = (image: HTMLImageElement | string) => typeof image === 'string' ? image : image.src;
export const hatcheryState = (image: HTMLImageElement | string) =>
  HATCHERY_STATES.find(state => source(image).endsWith(state.art));

export function drawHatchery(ctx: CanvasRenderingContext2D, image: HTMLImageElement, ms: number, x: number, y: number, size: number) {
  const state = hatcheryState(image);
  ctx.save();
  ctx.translate(x, y); ctx.scale(size / 240, size / 240);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, 240, 240);
  if (state) {
    const t = ms / 1000;
    // All effect positions are snapped to the source pixel grid, with no blur.
    state.flames.forEach(([sx, sy], i) => {
      const px = sx + 20, py = sy + 20;
      const height = 5 + Math.round((Math.sin(t * 9 + i * 2) + 1) * 1.5);
      ctx.fillStyle = '#c94d17'; ctx.fillRect(px - 3, py - 4, 6, 4);
      ctx.fillStyle = '#f6a523'; ctx.fillRect(px - 2, py - height, 4, height);
      ctx.fillStyle = '#ffeb8c'; ctx.fillRect(px - 1, py - height + 2, 2, height - 2);
      if (ms > 0) {
        const age = (t * .55 + i * .29) % 1;
        ctx.globalAlpha = 1 - age; ctx.fillStyle = '#ffe59a';
        ctx.fillRect(px + Math.round(Math.sin(age * 6 + i) * 2), py - 7 - Math.round(age * 10), 1, 1);
        ctx.globalAlpha = 1;
      }
    });
    [...state.lights, ...state.eggs].forEach(([sx, sy], i) => {
      const pulse = Math.max(0, Math.sin(t * 2.1 + i * 1.8));
      ctx.globalAlpha = .2 + pulse * .6;
      ctx.fillStyle = i < state.lights.length ? '#b9f5df' : '#fff0b0';
      ctx.fillRect(sx + 19, sy + 20, 3, 1);
      ctx.fillRect(sx + 20, sy + 19, 1, 3);
    });
  }
  ctx.restore();
}
