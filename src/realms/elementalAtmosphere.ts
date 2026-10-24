import { ISLANDS } from './islands';
import type { RealmId } from './game';
import { drawCascadeSpray } from './islandAtmosphere';

export type AmbientRealm = Exclude<RealmId, 'water' | 'fire'>;
type Point = { x: number; y: number; p: number; flow: boolean; cloud: boolean };
type Layer = {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; source: Uint8ClampedArray;
  output: ImageData; mask: Uint8Array; points: Point[]; frame: number;
};
const layers = new WeakMap<HTMLImageElement, Layer>();
const COLORS: Record<AmbientRealm, string[]> = {
  earth: ['#dca477', '#ffe0a0'], nature: ['#c2ed73', '#ffe9a0'], ice: ['#d8f7ff', '#ffffff'],
  lightning: ['#ffe04f', '#fff9c5'], wind: ['#baddff', '#f3fbff'], dark: ['#b356ff', '#f0a4ff'],
  light: ['#ffe08a', '#fff8da'], arcane: ['#40e5ff', '#d7a1ff'],
};

/** The whole playable plateau is excluded from texture effects and ambient particles. */
export function insidePlateau(realm: AmbientRealm, x: number, y: number) {
  const p = ISLANDS[realm].plateau;
  const vertices = [p.top, p.right, p.bottom, p.left];
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const [xi, yi] = vertices[i], [xj, yj] = vertices[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function falling(realm: AmbientRealm, x: number, y: number) {
  switch (realm) {
    case 'earth': return (x > 200 && x < 230 && y > 355) || (x > 387 && x < 413 && y > 280);
    case 'nature': return (x > 121 && x < 154 && y > 265) || (x > 326 && x < 355 && y > 303);
    case 'dark': return (x > 207 && x < 239 && y > 350) || (x > 348 && x < 381 && y > 335);
    case 'light': return (x > 115 && x < 154 && y > 279) || (x > 225 && x < 279 && y > 348) || (x > 361 && x < 391 && y > 278);
    case 'arcane': return (x > 81 && x < 102 && y > 238 && y < 345)
      || (x > 186 && x < 217 && y > 294 && y < 433)
      || (x > 298 && x < 328 && y > 316 && y < 465)
      || (x > 404 && x < 432 && y > 246 && y < 365);
    default: return false;
  }
}

function prepare(image: HTMLImageElement, realm: AmbientRealm): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const source = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const output = ctx.createImageData(canvas.width, canvas.height);
  const mask = new Uint8Array(canvas.width * canvas.height);
  const points: Point[] = [];
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const p = (y * canvas.width + x) * 4;
    if (source[p + 3] < 220 || insidePlateau(realm, x, y)) continue;
    const r = source[p], g = source[p + 1], b = source[p + 2];
    const cyan = b > 175 && g > 140 && r < g * 0.8;
    const flow = falling(realm, x, y) && (realm !== 'arcane' || cyan);
    const cloud = realm === 'wind' || (realm === 'lightning' && (y < 140 || ((x < 73 || x > 437) && y < 270))
      && r > 60 && g > 40 && b > 90 && b > r * 0.95 && g < 180);
    let selected = false;
    switch (realm) {
      case 'earth': selected = flow && r > 100 && g > 80 && b > 65; break;
      case 'nature': selected = (b > 130 && g > 140 && r < g * 0.9) || (g > 95 && g > r * 1.22 && g > b * 1.4); break;
      case 'ice': selected = b > 175 && g > 100 && g < 230 && r < 175; break;
      case 'lightning': selected = cloud || (r > 165 && g > 110 && b < g * 0.8); break;
      case 'wind': selected = b > 190 && g > 160 && b > r * 1.07; break;
      case 'dark': selected = b > 150 && r > 100 && b > g * 1.45; break;
      case 'light': selected = (r > 210 && g > 140 && b < g * 0.8) || (flow && r > 200 && g > 190 && b > 130); break;
      case 'arcane': selected = cyan || (b > 200 && r > 170 && g > 90 && g < b * 0.75); break;
    }
    if (!selected) continue;
    mask[y * canvas.width + x] = cloud ? 2 : 1;
    points.push({ x, y, p, flow, cloud });
  }
  return { canvas, ctx, source, output, mask, points, frame: -1 };
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let row = -4; row < 4; row += 2) {
    const width = Math.round(radius * (Math.abs(row + 1) > 2 ? 0.65 : 1));
    ctx.rect(Math.round(x) - width, Math.round(y) + row, width * 2, 2);
  }
  ctx.fill();
}

/** Short, branching discharges stay around the cloud banks and cliff edges. */
function lightningBolts(ctx: CanvasRenderingContext2D, t: number) {
  const paths = [[89, 65, 59, 120], [294, 65, 316, 114], [437, 187, 466, 226],
    [112, 280, 88, 364], [178, 355, 155, 451], [404, 288, 422, 397]];
  ctx.save();
  ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
  for (let i = 0; i < paths.length; i++) {
    const cycle = t / 3.2 + i * 0.381966;
    const age = (cycle % 1) * 3.2;
    if (age >= 0.85) continue;
    const [x1, y1, x2, y2] = paths[i];
    const seed = Math.floor(cycle) * 1.73 + i * 2.91;
    const reveal = Math.min(1, age / 0.12);
    const opacity = Math.min(1, age / 0.04) * (1 - Math.max(0, age - 0.16) / 0.69);
    const points: number[][] = [];
    for (let step = 0; step <= 9; step++) {
      const p = Math.min(step / 9, reveal);
      points.push([x1 + (x2 - x1) * p + Math.sin(step * 7.3 + seed) * Math.sin(p * Math.PI) * 8,
        y1 + (y2 - y1) * p]);
      if (step / 9 >= reveal) break;
    }
    const stroke = (width: number, color: string, alpha: number) => {
      ctx.globalAlpha = opacity * alpha;
      ctx.lineWidth = width; ctx.strokeStyle = color;
      ctx.beginPath();
      points.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.stroke();
    };
    stroke(6, '#ffb52e', 0.18);
    stroke(2.5, '#ffda49', 0.9);
    stroke(1, '#fff8d1', 1);
    if (points.length > 5) {
      const [x, y] = points[4];
      const direction = i % 2 ? 1 : -1;
      ctx.globalAlpha = opacity * 0.8; ctx.lineWidth = 1; ctx.strokeStyle = '#fff0a3';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + direction * 10, y + 5);
      ctx.lineTo(x + direction * 7, y + 11); ctx.lineTo(x + direction * 17, y + 17); ctx.stroke();
    }
  }
  ctx.restore();
}

/** Visible geometry moves continuously; no texture offsets or modulo resets. */
function arcaneMagic(ctx: CanvasRenderingContext2D, t: number) {
  ctx.save();
  ctx.lineCap = 'round';
  // The portal's three spiral arms turn within its existing opening.
  const cx = 350, cy = 119;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, 16, 21, 0, 0, Math.PI * 2); ctx.clip();
  ctx.globalAlpha = 0.55; ctx.fillStyle = '#123989';
  ctx.fillRect(cx - 16, cy - 21, 32, 42);
  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath();
    for (let step = 0; step <= 36; step++) {
      const p = step / 36;
      const angle = t * 1.4 + arm * Math.PI * 2 / 3 + p * Math.PI * 1.6;
      const radius = 1 + p * 16;
      const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius * 1.3;
      if (step) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.globalAlpha = 0.3; ctx.strokeStyle = '#20bdff'; ctx.lineWidth = 5; ctx.stroke();
    ctx.globalAlpha = 0.95; ctx.strokeStyle = arm % 2 ? '#c1fcff' : '#42ecff'; ctx.lineWidth = 1.3; ctx.stroke();
  }
  ctx.restore();
  // Rotating arc segments and comet trails around the floating crystals.
  const anchors = [[350, 119, 25, 30], [111, 126, 12, 18], [295, 19, 11, 17], [410, 109, 11, 18]];
  for (let a = 0; a < anchors.length; a++) {
    const [x, y, rx, ry] = anchors[a];
    for (let comet = 0; comet < 2; comet++) {
      const angle = t * (a ? 0.9 : -0.65) + a * 1.7 + comet * Math.PI;
      ctx.beginPath();
      for (let j = 0; j <= 12; j++) {
        const phase = angle - j * 0.045;
        const px = x + Math.cos(phase) * rx, py = y + Math.sin(phase) * ry;
        if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.globalAlpha = a ? 0.55 : 0.8;
      ctx.strokeStyle = comet ? '#c29cff' : '#67f4ff'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.globalAlpha = 0.95; ctx.fillStyle = '#dcffff';
      ctx.fillRect(x + Math.cos(angle) * rx - 1, y + Math.sin(angle) * ry - 1, 2, 2);
    }
  }
  ctx.restore();
}

export function drawElementalAtmosphere(ctx: CanvasRenderingContext2D, image: HTMLImageElement,
  realm: AmbientRealm, time: number, offset: number[], scale: number) {
  let layer = layers.get(image);
  if (!layer) { layer = prepare(image, realm); layers.set(image, layer); }
  const smooth = realm === 'arcane' || realm === 'lightning';
  const frame = Math.floor(time / (smooth ? 1000 / 30 : 80));
  const t = smooth ? time / 1000 : frame * 0.08;
  if (frame !== layer.frame) {
    const { canvas, source, output, mask } = layer;
    for (const { x, y, p, flow, cloud } of layer.points) {
      const speed = realm === 'earth' ? 12 : 22;
      const dx = cloud ? Math.round(Math.sin(t * 1.4 + y * 0.08) * 5)
        : realm === 'nature' && !flow ? Math.round(Math.sin(t * 1.8 + y * 0.04) * 1.5) : 0;
      const dy = flow && realm !== 'arcane' ? -Math.floor(t * speed) % 16 : 0;
      const sx = Math.max(0, Math.min(canvas.width - 1, x + dx));
      const sy = Math.max(0, Math.min(canvas.height - 1, y + dy));
      const sample = mask[sy * canvas.width + sx] === mask[p / 4] ? (sy * canvas.width + sx) * 4 : p;
      const wave = realm === 'arcane' ? Math.sin(x * 0.035 + y * (flow ? 0.12 : 0.04) - t * (flow ? 2.2 : 0.8))
        : Math.sin(x * 0.13 + y * (flow ? 0.4 : 0.17) - t * (flow ? 8 : 2));
      const energy = ['dark', 'arcane', 'lightning', 'light'].includes(realm);
      const brightness = 0.98 + wave * (realm === 'arcane' ? (flow ? 0.08 : 0.045)
        : cloud ? 0.08 : energy ? (flow ? 0.14 : 0.24) : realm === 'nature' ? 0.07 : 0.12);
      // Bright packets travel down the cyan streams, keeping the rock texture still.
      const current = realm === 'arcane' && flow
        ? Math.pow((1 + Math.sin(y * 0.12 - t * 4.5 + x * 0.08)) / 2, 5) * 0.62 : 0;
      const currentColor = [174, 250, 255];
      for (let c = 0; c < 3; c++) {
        const value = source[sample + c] * brightness;
        output.data[p + c] = value * (1 - current) + currentColor[c] * current;
      }
      output.data[p + 3] = source[p + 3];
    }
    layer.ctx.putImageData(output, 0, 0);
    layer.frame = frame;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer.canvas, offset[0], offset[1], image.naturalWidth * scale, image.naturalHeight * scale);
  ctx.translate(offset[0], offset[1]); ctx.scale(scale, scale);
  if (realm === 'lightning') lightningBolts(ctx, t);
  if (realm === 'arcane') arcaneMagic(ctx, t);
  if (realm === 'nature') drawCascadeSpray(ctx, [[142, 397, 0.65], [340, 428, 0.65]], time);
  if (realm === 'earth') drawCascadeSpray(ctx, [[217, 424, 0.45], [400, 365, 0.4]], time);
  // Drifting snow, dust, leaves, sparks and magic follow the island's rim.
  for (let i = 0; i < 48; i++) {
    const age = (t / (realm === 'wind' ? 3.5 : 5) + i * 0.381966) % 1;
    const angle = i * 2.39996;
    let x = 256 + Math.cos(angle) * (155 + i % 4 * 13);
    let y = 236 + Math.sin(angle) * (125 + i % 3 * 24);
    if (realm === 'ice' || realm === 'earth') { x += age * 15; y += age * 35; }
    else if (realm === 'wind') { x += age * 44; y += Math.sin(age * 6 + i) * 5; }
    else { x += Math.sin(age * 5 + i) * 7; y -= age * 28; }
    if (insidePlateau(realm, x, y) || (realm === 'wind' &&
      [x - 12, x + 12].some(px => [y - 6, y + 6].some(py => insidePlateau(realm, px, py))))) continue;
    const opacity = Math.sin(age * Math.PI) * (realm === 'arcane' ? 0.5 : 0.75);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = COLORS[realm][i % 2];
    if (realm === 'wind') cloud(ctx, x, y, 5 + age * 7);
    else {
      const px = realm === 'arcane' ? x : Math.round(x), py = realm === 'arcane' ? y : Math.round(y);
      // Keep the whole mote outside the playable plateau.
      if (realm === 'arcane' && [x - 5, x + 5].some(sx => [y - 5, y + 5].some(sy => insidePlateau(realm, sx, sy)))) continue;
      ctx.fillRect(px, py, realm === 'nature' ? 3 : 2, 2);
      if (['ice', 'light', 'arcane'].includes(realm) && i % 4 === 0) {
        ctx.globalAlpha *= 0.7;
        ctx.fillRect(px - 2, py + 1, 6, 1);
        ctx.fillRect(px + 1, py - 2, 1, 6);
      }
    }
  }
  ctx.restore();
}
