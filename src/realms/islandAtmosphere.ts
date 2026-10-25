/** Animate only the water/lava pixels; terrain, plants and the playable grid stay still. */
type Material = 'water' | 'fire' | 'home';
type Pixel = { offset: number; x: number; y: number; falling: boolean; impact: boolean };
type Layer = {
  canvas: HTMLCanvasElement;
  base: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  original: Uint8ClampedArray;
  pixels: Pixel[];
  mask: Uint8Array;
  output: ImageData;
  frame: number;
};
const layers = new WeakMap<HTMLImageElement, Layer>();
const WATERFALL_BASES = {
  home: [[196, 324, 1], [444, 330, 0.85], [537, 349, 0.4]],
  water: [[116, 334, 1], [372, 364, 1]],
};
const SMOKE_BOUNDS = [[126, 86, 155, 125], [309, 76, 338, 121], [387, 108, 412, 142], [424, 133, 448, 161]];

/** Replace painted smoke with live plumes; preserve the original for reduced motion. */
export function islandBaseImage(image: HTMLImageElement, material: Material): CanvasImageSource {
  if (material !== 'fire') return image;
  let layer = layers.get(image);
  if (!layer) { layer = createLayer(image, material); layers.set(image, layer); }
  return layer.base;
}

function pixelCloud(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, height: number) {
  ctx.beginPath();
  for (let row = -height; row < height; row += 2) {
    const width = Math.max(1, Math.round(radius * Math.sqrt(Math.max(0, 1 - ((row + 1) / height) ** 2))));
    ctx.rect(Math.round(x) - width, Math.round(y) + row, width * 2, 2);
  }
  ctx.fill();
}

/** Spray is drawn in source-art pixels so it follows the island at every zoom. */
export function drawCascadeMist(ctx: CanvasRenderingContext2D, falls: number[][], time: number,
  colors: string[]) {
  const t = time / 1000;
  for (const [f, [x, y, strength]] of falls.entries()) {
    ctx.save(); ctx.translate(x, y); ctx.scale(strength, strength);
    for (let i = 0; i < 26; i++) {
      const age = (t / (2.2 + i % 3 * 0.4) + i * 0.381966 + f * 0.23) % 1;
      const side = i % 2 ? 1 : -1;
      const px = side * age * (10 + i % 4 * 3) + Math.sin(t * 0.8 + i) * 2;
      const py = -age * (25 + i % 3 * 6);
      const radius = 3 + age * 7;
      ctx.globalAlpha = Math.sin(age * Math.PI) * 0.32;
      ctx.fillStyle = colors[i % colors.length];
      pixelCloud(ctx, px, py, radius, Math.round(radius * 0.75));
    }
    ctx.restore();
  }
}

export function drawCascadeSpray(ctx: CanvasRenderingContext2D, falls: number[][], time: number) {
  const t = Math.floor(time / 80) * 0.08;
  for (let f = 0; f < falls.length; f++) {
    const [x, y, strength] = falls[f];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(strength, strength);
    // Opaque rolling foam replaces the frozen white impact area, rather than just tinting it.
    for (let i = 0; i < 30; i++) {
      const age = (t / 0.95 + i * 0.381966 + f * 0.23) % 1;
      const angle = i * 2.39996;
      const radius = 3 + Math.sin(age * Math.PI) * 3;
      const px = Math.cos(angle) * (2 + age * 17);
      const py = Math.sin(angle) * (2 + age * 5) - Math.sin(age * Math.PI) * 5;
      ctx.globalAlpha = age < 0.8 ? 1 : (1 - age) / 0.2;
      ctx.fillStyle = i % 3 ? '#bceff9' : '#72d5ec';
      pixelCloud(ctx, px, py + 2, radius + 1, Math.round(radius * 0.75));
      ctx.fillStyle = i % 4 ? '#edffff' : '#ccf8ff';
      pixelCloud(ctx, px - 1, py, radius, Math.round(radius * 0.75));
    }
    // Expanding, broken foam rings around the impact point.
    for (let ring = 0; ring < 4; ring++) {
      const age = (t / 1.4 + ring / 4 + f * 0.27) % 1;
      ctx.globalAlpha = (1 - age) * 0.85;
      ctx.fillStyle = '#c8faff';
      for (let segment = 0; segment < 18; segment++) {
        if ((segment + ring) % 5 === 0) continue;
        const angle = segment / 18 * Math.PI * 2;
        ctx.fillRect(Math.round(Math.cos(angle) * (8 + age * 25)), Math.round(Math.sin(angle) * (3 + age * 8)), 4, 2);
      }
    }
    // Stepped cloud silhouettes preserve the pixel-art edges while drifting apart.
    for (let i = 0; i < 22; i++) {
      const age = (t / (2.2 + i % 3 * 0.3) + i * 0.381966 + f * 0.19) % 1;
      const side = i % 2 ? 1 : -1;
      const px = Math.round(side * (2 + age * (16 + i % 4 * 4)));
      const py = Math.round(-age * (19 + i % 3 * 7) + Math.sin(i * 2) * 3);
      const radius = Math.round(4 + age * 6);
      ctx.globalAlpha = Math.sin(age * Math.PI) * 0.48;
      ctx.fillStyle = i % 3 ? '#e0fbff' : '#8bdce8';
      pixelCloud(ctx, px, py, radius, Math.round(radius * 0.8));
    }
    // Bright droplets burst outward, then fall under gravity.
    for (let i = 0; i < 32; i++) {
      const age = (t / 1.05 + i * 0.381966 + f * 0.31) % 1;
      const side = i % 2 ? 1 : -1;
      const px = Math.round(side * age * (15 + i % 5 * 5));
      const py = Math.round(-Math.sin(age * Math.PI) * (15 + i % 4 * 5) + age * age * 13);
      ctx.globalAlpha = Math.sin(age * Math.PI) * 0.9;
      ctx.fillStyle = i % 3 ? '#eaffff' : '#83e4f1';
      ctx.fillRect(px, py, i % 4 ? 1 : 2, age < 0.6 ? 3 : 2);
    }
    ctx.restore();
  }
}

function waterfall(material: Material, x: number, y: number) {
  if (material === 'home') return (x >= 166 && x <= 225 && y >= 208)
    || (x >= 425 && x <= 464 && y >= 246) || (x >= 527 && x <= 550 && y >= 312);
  return material === 'water'
    ? (x >= 95 && x <= 140 && y >= 235) || (x >= 350 && x <= 394 && y >= 280)
      || (x >= 247 && x <= 270 && y >= 65 && y <= 99)
      || (x >= 367 && x <= 387 && y >= 135 && y <= 159)
    : (x >= 70 && x <= 98 && y >= 257) || (x >= 205 && x <= 226 && y >= 330)
      || (x >= 330 && x <= 355 && y >= 315) || (x >= 425 && x <= 442 && y >= 251);
}

function createLayer(image: HTMLImageElement, material: Material): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const original = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const base = document.createElement('canvas');
  base.width = canvas.width; base.height = canvas.height;
  const baseContext = base.getContext('2d')!;
  const baseData = new ImageData(new Uint8ClampedArray(original), canvas.width, canvas.height);
  if (material === 'fire') {
    for (const [left, top, right, bottom] of SMOKE_BOUNDS) {
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        const p = (y * canvas.width + x) * 4;
        const r = original[p], g = original[p + 1], b = original[p + 2];
        if ((r === 84 && g === 74 && b === 83) || (r === 138 && g === 80 && b === 68)
          || (r === 158 && g === 79 && b === 59) || (r === 148 && g === 130 && b === 137)) baseData.data[p + 3] = 0;
      }
    }
  }
  baseContext.putImageData(baseData, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  const output = context.createImageData(canvas.width, canvas.height);
  const mask = new Uint8Array(canvas.width * canvas.height);
  const pixels: Pixel[] = [];
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const offset = (y * canvas.width + x) * 4;
      const r = original[offset], g = original[offset + 1], b = original[offset + 2], a = original[offset + 3];
      const impact = material !== 'fire' && WATERFALL_BASES[material].some(([cx, cy, size]) =>
        ((x - cx) / (25 * size)) ** 2 + ((y - cy + 3) / (19 * size)) ** 2 < 1);
      // Distinct material palettes avoid tinting the rocks and palm trees.
      const matches = material !== 'fire'
        ? b > 115 && g > 120 && g > r * 1.12 && b > r * 1.08
        : r > 135 && g > 28 && g < r * 0.99 && b < g * 0.78;
      const foam = impact && r > 135 && g > 180 && b > 190 && b >= r * 0.96;
      if (a < 220 || (!matches && !foam) || (material === 'home' && !waterfall(material, x, y) && !foam)) continue;
      mask[y * canvas.width + x] = 1;
      pixels.push({ offset, x, y, falling: waterfall(material, x, y), impact });
    }
  }
  return { canvas, base, context, original, pixels, mask, output, frame: -1 };
}

export function drawIslandAtmosphere(
  ctx: CanvasRenderingContext2D, image: HTMLImageElement, material: Material,
  time: number, offset: number[], scale: number,
) {
  let layer = layers.get(image);
  if (!layer) {
    layer = createLayer(image, material);
    layers.set(image, layer);
  }
  // Reuse one small surface, updating at the world's existing ~12fps cadence.
  const frame = Math.floor(time / 80);
  if (frame !== layer.frame) {
    const { original, output, canvas, mask } = layer;
    const t = frame * 0.08;
    for (const pixel of layer.pixels) {
      const { x, y, offset: p, falling, impact } = pixel;
      // Advect the source texture down falls; sample only inside the material mask.
      const drift = falling ? Math.floor(t * (material !== 'fire' ? 24 : 13)) % 18 : 0;
      const river = material === 'fire' && !falling;
      const sourceY = Math.max(0, Math.min(canvas.height - 1, impact ? y + Math.round(Math.sin(x * 0.4 + t * 8) * 5)
        : river ? y + Math.round(Math.sin(x * 0.08 - t * 2.4) * 4) : y - drift));
      const sourceX = Math.max(0, Math.min(canvas.width - 1, impact ? x + Math.round(Math.sin(y * 0.5 - t * 7) * 4)
        : river ? x + Math.round(Math.sin(y * 0.09 - t * 2) * 7) : x));
      const sample = mask[sourceY * canvas.width + sourceX] ? (sourceY * canvas.width + sourceX) * 4 : p;
      const wave = Math.sin((falling ? y * 0.28 : x * 0.16 + y * 0.24) - t * (falling ? 8 : 3.2));
      const glint = Math.max(0, Math.sin(x * 0.31 + y * 0.12 - t * 2.4));
      const brightness = material !== 'fire' ? 0.94 + wave * 0.09 : 0.97 + wave * 0.25;
      for (let channel = 0; channel < 3; channel++) {
        output.data[p + channel] = original[sample + channel] * brightness
          + (material !== 'fire' ? glint * 15 : channel === 0 ? glint * 24 : channel === 1 ? glint * 20 : 0);
      }
      output.data[p + 3] = original[p + 3];
    }
    layer.context.putImageData(output, 0, 0);
    layer.frame = frame;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer.canvas, offset[0], offset[1], image.naturalWidth * scale, image.naturalHeight * scale);
  if (material !== 'fire') {
    ctx.save();
    ctx.translate(offset[0], offset[1]);
    ctx.scale(scale, scale);
    drawCascadeSpray(ctx, WATERFALL_BASES[material], time);
    ctx.restore();
  }
  if (material === 'fire') {
    ctx.save();
    ctx.translate(offset[0], offset[1]);
    ctx.scale(scale, scale);
    const chimneys = [[145, 126, 1], [320, 119, 1.1], [397, 142, 0.85], [432, 161, 0.8], [257, 93, 0.65]];
    const t = Math.floor(time / 80) * 0.08;
    for (let vent = 0; vent < chimneys.length; vent++) {
      const [x, y, size] = chimneys[vent];
      for (let i = 0; i < 12; i++) {
        const age = (t / 3.8 + i / 12 + vent * 0.27) % 1;
        const px = x + (Math.sin(age * 5 + vent) * 7 + age * 8) * size;
        const py = y - age * 47 * size;
        const radius = (3 + age * 8) * size;
        ctx.globalAlpha = Math.min(1, age * 9) * (1 - age) * 0.8;
        ctx.fillStyle = age < 0.25 ? '#9e4f3b' : '#544a53';
        pixelCloud(ctx, px, py, radius, Math.max(2, Math.round(radius * 0.8)));
        ctx.globalAlpha *= 0.6;
        ctx.fillStyle = age < 0.3 ? '#b76b48' : '#948289';
        pixelCloud(ctx, px - radius * 0.25, py - radius * 0.3, radius * 0.65, Math.max(2, Math.round(radius * 0.5)));
      }
    }
    ctx.restore();
    // Small sparks rise from the volcanic rim, behind the dinosaurs.
    const vents = [[145, 137], [257, 101], [317, 137], [397, 154], [81, 257], [343, 321]];
    for (let i = 0; i < 30; i++) {
      const vent = vents[i % vents.length];
      const phase = (time / 2400 + i * 0.381966) % 1;
      const x = vent[0] + Math.sin(i * 2.7 + phase * 4) * 7;
      const y = vent[1] - phase * (24 + i % 5 * 4);
      ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.8;
      ctx.fillStyle = i % 3 ? '#ffb34b' : '#ffe8a1';
      ctx.fillRect(Math.round(offset[0] + x * scale), Math.round(offset[1] + y * scale), scale, scale);
    }
  }
  if (material === 'home') {
    // Light leaves and pollen drift around the rim, away from the building area.
    const groves = [[146, 155], [221, 65], [339, 46], [544, 157], [288, 274], [464, 256]];
    for (let i = 0; i < 18; i++) {
      const grove = groves[i % groves.length];
      const phase = (time / 6500 + i * 0.381966) % 1;
      const x = grove[0] + phase * 19 + Math.sin(phase * 6 + i) * 3;
      const y = grove[1] + phase * 11 + Math.cos(phase * 5 + i) * 3;
      ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.65;
      ctx.fillStyle = i % 3 ? '#d5e998' : '#8abc42';
      ctx.fillRect(Math.round(offset[0] + x * scale), Math.round(offset[1] + y * scale), scale * (i % 3 ? 0.7 : 1.4), scale * 0.7);
    }
  }
  ctx.restore();
}
