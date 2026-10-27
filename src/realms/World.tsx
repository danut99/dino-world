import { RARITY_CANVAS } from './Rarity';
import { drawIslandAtmosphere, islandBaseImage } from './islandAtmosphere';
import { drawElementalAtmosphere } from './elementalAtmosphere';
import { drawPortal, PORTAL_ART, PORTAL_GROUND } from './animatedPortal';
import { drawHatchery, hatcheryState } from './animatedHatchery';
import { drawWorkshopTier, workshopState } from './workshopTiers';
import { drawArena, arenaState } from './animatedArena';
import { drawWorkshop, WORKSHOP_ART, WORKSHOP_GROUND } from './animatedWorkshop';
import { drawFarm, farmGround, isAnimatedFarm } from './animatedFarm';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  advance,
  canBuild,
  canLamp,
  ELEMENTS,
  farmNextAt,
  rarityOf,
  REALM_NAMES,
  treasureReady,
  treasureSpot,
  type Building,
  type Save,
  type RealmId,
} from './game';
import { constrainPan, constrainHomePan, SCENE } from './camera';
import { buildingLevel, groundLine, LEVELED, measureGround, TIERED, tierArt } from './buildingTiers';
import { worldArt } from './worldArt';
import { ISLANDS, SKIES } from './islands';
import HOME_ISLAND from './islands/home.json';
import { UTILITY_BUILDINGS, type UtilityKind } from './content';
import { BUILDABLE_CELLS, GRID, project, unproject } from './grid';
import { drawSprite, frameAt, loadAnimation, loadSpriteImage, type SpriteManifest } from './animation';
import { drawRealmAtmosphere } from './worldEffects';
import { useReducedMotion } from './useMotion';
import { Icon } from './ui/Icon';
import { clock } from './PanelKit';

export { project, unproject };
/**
 * Where owned dinosaurs stand in their world, in scene pixels: spread over the platform of every
 * *-wide-v1.png world so bodies and name labels never overlap (a habitat holds at most five).
 */
const OWNED_SPOTS: { x: number; y: number }[] = [
  { x: 780, y: 400 },
  { x: 500, y: 470 },
  { x: 1060, y: 470 },
  { x: 640, y: 590 },
  { x: 930, y: 590 },
];
const STAGE_HEIGHT = { baby: 80, juvenile: 115, adult: 150 };
function polygon(ctx: CanvasRenderingContext2D, points: number[][], fill: string, stroke?: string) {
  ctx.beginPath();
  points.forEach(([x, y], i) =>
    i ? ctx.lineTo(Math.round(x), Math.round(y)) : ctx.moveTo(Math.round(x), Math.round(y)),
  );
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
const HOME_SRC = HOME_ISLAND.art,
  HOME_SKY: [string, string, string] = ['#13183a', '#2c4a7a', '#bfe8ff'],
  CONCEPTS_SRC = '/realms/building-concepts.webp';
const utilitySrc = (kind: UtilityKind) =>
  kind === 'portal'
    ? PORTAL_ART
    : kind === 'market'
      ? '/realms/gameplay/market-building-pixel.webp'
      : '/realms/gameplay/utility-buildings-pixel.webp';
/** Camera zoom range; buttons move in ten percentage point steps. Zooming out stops while the
 *  artwork still fills the screen (see `minZoom`). */
const MAX_ZOOM = 2.5;
const BUTTON_ZOOM_STEP = 0.1;
/** Insula principală e mare: pornește micșorată, cu tot platoul în cadru. */
const HOME_ZOOM = 0.8;
/** Open sky between the current island and its neighbours, in scene pixels. */
const ISLAND_GAP = 160;
/** Below this zoom the camera roams the whole chain of islands. */
const CHAIN_ZOOM = 0.6;
type Place = 'home' | RealmId;
const islandFrame = (id: Place) => {
  const isl = id === 'home' ? HOME_ISLAND : ISLANDS[id];
  return { x: isl.offset[0], y: isl.offset[1], w: isl.size[0] * isl.scale, h: isl.size[1] * isl.scale };
};
/** Two crossed chains with a padlock where they meet, over a locked world. */
function drawChains(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const count = 15,
    link = size / count;
  for (const dir of [-1, 1]) {
    const angle = Math.atan2(dir * 0.6, 1);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count - 0.5;
      ctx.save();
      ctx.translate(cx + t * size, cy + dir * t * size * 0.6);
      ctx.rotate(angle);
      for (const [color, width] of [
        ['#1d2029', link * 0.3],
        ['#9aa3b5', link * 0.14],
      ] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (i % 2) {
          ctx.beginPath();
          ctx.moveTo(-link * 0.6, 0);
          ctx.lineTo(link * 0.6, 0);
          ctx.stroke();
        } else ctx.strokeRect(-link * 0.55, -link * 0.28, link * 1.1, link * 0.56);
      }
      ctx.restore();
    }
  }
  const w = size * 0.14,
    h = w * 0.8;
  ctx.lineWidth = w * 0.16;
  ctx.strokeStyle = '#1d2029';
  ctx.beginPath();
  ctx.arc(cx, cy - h * 0.45, w * 0.3, Math.PI, 0);
  ctx.stroke();
  ctx.lineWidth = w * 0.08;
  ctx.strokeStyle = '#c3c9d6';
  ctx.stroke();
  ctx.fillStyle = '#1d2029';
  ctx.fillRect(cx - w / 2 - w * 0.06, cy - h * 0.45 - w * 0.06, w * 1.12, h + w * 0.12);
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(cx - w / 2, cy - h * 0.45, w, h);
  ctx.fillStyle = '#f6d277';
  ctx.fillRect(cx - w / 2, cy - h * 0.45, w, h * 0.18);
  ctx.fillStyle = '#1d2029';
  ctx.fillRect(cx - w * 0.07, cy - h * 0.1, w * 0.14, h * 0.35);
}
/** A label pill; `anchor` -1 puts `x` at its left edge, 1 at its right edge, 0 in the middle. */
function pill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  active: boolean,
  anchor: -1 | 0 | 1 = 0,
) {
  ctx.font = `600 ${size}px 'Pixelify Sans', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + size * 1.4,
    h = size * 1.9,
    cx = x - (anchor * w) / 2;
  ctx.fillStyle = active ? '#f6d277' : '#0d1428d9';
  ctx.fillRect(cx - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = active ? '#fff0af' : '#f0e6be66';
  ctx.lineWidth = Math.max(1, size / 8);
  ctx.strokeRect(cx - w / 2, y - h / 2, w, h);
  ctx.fillStyle = active ? '#2a1a0c' : '#ffffff';
  ctx.fillText(text, cx, y);
  ctx.textBaseline = 'alphabetic';
}
/**
 * Drawn building size, in scene pixels. 192 is the exact width of the 3×3 footprint; buildings are drawn a
 * quarter larger so they read clearly at the island's default zoom. The ground line keeps the base anchored on
 * the footprint's corners whatever the size, so the plate only overflows the cells visually.
 */
const BUILDING_SIZE = 240,
  BUILDING_LIFT = Math.round((BUILDING_SIZE * 205) / 260);
const HATCHERY_SIZE = 288;
/**
 * The farm sprites leave wider empty margins (content spans 90% of the frame, against 98% for the other
 * buildings) and the farm itself is low, so at the common size it reads smaller. It is drawn larger to match.
 */
const FARM_SIZE = Math.round(BUILDING_SIZE * 1.2);
export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  b: Building,
  texture?: HTMLImageElement | null,
  standalone = false,
  animationMs = 0,
) {
  const p = project(b.x + 1.5, b.y + 1.5);
  if (b.kind === 'workshop' && texture && standalone) {
    const state = workshopState(texture);
    if (state) {
      const size = (BUILDING_SIZE * 0.9 * 240) / state.width;
      drawWorkshopTier(
        ctx,
        texture,
        animationMs,
        Math.round(p.x - size / 2),
        Math.round(p.y - state.ground * size),
        size,
      );
      return;
    }
  }
  if (b.kind === 'portal' && texture && standalone && texture.src.endsWith(PORTAL_ART)) {
    drawPortal(
      ctx,
      texture,
      animationMs,
      Math.round(p.x - BUILDING_SIZE / 2),
      Math.round(p.y - PORTAL_GROUND * BUILDING_SIZE),
      BUILDING_SIZE,
    );
    return;
  }
  if (b.kind === 'workshop' && texture && standalone && texture.src.endsWith(WORKSHOP_ART)) {
    drawWorkshop(
      ctx,
      texture,
      animationMs,
      Math.round(p.x - BUILDING_SIZE / 2),
      Math.round(p.y - WORKSHOP_GROUND * BUILDING_SIZE),
      BUILDING_SIZE,
    );
    return;
  }
  if (b.kind === 'farm' && texture && standalone && isAnimatedFarm(texture)) {
    drawFarm(
      ctx,
      texture,
      animationMs,
      Math.round(p.x - FARM_SIZE / 2),
      Math.round(p.y - farmGround(texture) * FARM_SIZE),
      FARM_SIZE,
    );
    return;
  }

  if (b.kind === 'hatchery' && texture && standalone) {
    const state = hatcheryState(texture);
    if (state) {
      const size = HATCHERY_SIZE;
      drawHatchery(ctx, texture, animationMs, Math.round(p.x - size / 2), Math.round(p.y - state.ground * size), size);
      return;
    }
  }
  if (b.kind === 'arena' && texture && standalone && arenaState(texture)) {
    const ground = groundLine(texture);
    const top = ground === undefined ? BUILDING_LIFT : Math.round(ground * BUILDING_SIZE);
    drawArena(ctx, texture, animationMs, Math.round(p.x - BUILDING_SIZE / 2), Math.round(p.y - top), BUILDING_SIZE);
    return;
  }
  if (texture && (standalone || b.kind === 'market')) {
    const ground = groundLine(texture);
    const top = ground === undefined ? BUILDING_LIFT : Math.round(ground * BUILDING_SIZE);
    ctx.drawImage(texture, Math.round(p.x - BUILDING_SIZE / 2), Math.round(p.y - top), BUILDING_SIZE, BUILDING_SIZE);
    return;
  }
  if (texture && ['workshop', 'portal', 'arena'].includes(b.kind)) {
    const column = b.kind === 'workshop' ? 0 : b.kind === 'portal' ? 1 : 2,
      size = texture.naturalWidth / 3;
    ctx.drawImage(
      texture,
      column * size,
      0,
      size,
      texture.naturalHeight,
      Math.round(p.x - BUILDING_SIZE / 2),
      Math.round(p.y - BUILDING_LIFT),
      BUILDING_SIZE,
      BUILDING_SIZE,
    );
    return;
  }
  if (texture) {
    const cell = texture.naturalWidth / 3;
    ctx.drawImage(
      texture,
      (b.kind === 'hatchery' ? 0 : b.kind === 'farm' ? 2 : 1) * cell,
      0,
      cell,
      texture.naturalHeight,
      Math.round(p.x - BUILDING_SIZE / 2),
      Math.round(p.y - BUILDING_LIFT),
      BUILDING_SIZE,
      BUILDING_SIZE,
    );
    return;
  }
  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y));
  ctx.scale(BUILDING_SIZE / 260, BUILDING_SIZE / 260);
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  polygon(
    ctx,
    [
      [-105, 0],
      [0, -53],
      [105, 0],
      [0, 53],
    ],
    '#3d3828',
    '#272a26',
  );
  polygon(
    ctx,
    [
      [-100, -7],
      [0, -57],
      [100, -7],
      [0, 43],
    ],
    b.kind === 'habitat' ? '#714333' : '#8f9a50',
    '#d5bd7c',
  );
  if (b.kind === 'hatchery') {
    polygon(
      ctx,
      [
        [-54, -18],
        [0, 9],
        [0, -67],
        [-54, -94],
      ],
      '#a17b4a',
      '#392c25',
    );
    polygon(
      ctx,
      [
        [0, 9],
        [57, -20],
        [57, -95],
        [0, -67],
      ],
      '#624b33',
      '#392c25',
    );
    polygon(
      ctx,
      [
        [-65, -94],
        [0, -127],
        [68, -94],
        [0, -61],
      ],
      '#dabf7d',
      '#3e332b',
    );
    for (let i = 0; i < 3; i++) rect(-48 + i * 16, -84 + i * 8, 11, 10, '#c79b58');
    rect(15, -51, 23, 48, '#272c2c');
    rect(19, -48, 5, 43, '#dbb66b');
    rect(-41, -70, 18, 35, '#28586a');
    rect(-38, -67, 12, 5, '#75c1c0');
    polygon(
      ctx,
      [
        [-25, -119],
        [-31, -147],
        [-22, -176],
        [-6, -194],
        [11, -192],
        [29, -168],
        [35, -143],
        [24, -117],
        [0, -108],
      ],
      '#eadcb1',
      '#544739',
    );
    polygon(
      ctx,
      [
        [-20, -164],
        [-13, -179],
        [0, -174],
        [3, -163],
        [-7, -155],
      ],
      '#7b9b5c',
    );
    polygon(
      ctx,
      [
        [8, -141],
        [24, -152],
        [30, -138],
        [21, -121],
        [8, -124],
      ],
      '#6f9157',
    );
    rect(-56, -33, 6, 42, '#40352a');
    rect(-61, -44, 15, 15, '#f3ad45');
    rect(-56, -51, 5, 11, '#ffdc79');
  } else if (b.kind === 'market') {
    for (const [x, color] of [
      [-60, '#8b5a34'],
      [52, '#8b5a34'],
    ] as const)
      rect(x, -88, 8, 92, color);
    polygon(
      ctx,
      [
        [-70, -32],
        [0, -2],
        [70, -32],
        [0, -62],
      ],
      '#a97c43',
      '#513a2a',
    );
    for (let i = 0; i < 6; i++)
      polygon(
        ctx,
        [
          [-74 + i * 25, -88 + i * 6],
          [-49 + i * 25, -82 + i * 6],
          [-49 + i * 25, -66 + i * 6],
          [-74 + i * 25, -72 + i * 6],
        ],
        i % 2 ? '#f3e2b4' : '#c8503d',
        '#5a2e26',
      );
    for (const [x, y, color] of [
      [-40, -46, '#ee7541'],
      [-18, -38, '#65c8e1'],
      [6, -30, '#c4a16b'],
      [28, -38, '#a5dcf2'],
      [-4, -52, '#9ce2cf'],
    ] as const) {
      rect(x, y - 14, 12, 16, '#1d1a17');
      rect(x + 1, y - 13, 10, 14, color);
      rect(x + 3, y - 11, 2, 4, '#ffffffa0');
    }
  } else if (b.kind === 'farm') {
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 5; col++) {
        const x = -63 + col * 21 + row * 11,
          y = -17 - col * 9 + row * 12;
        rect(x, y, 13, 10, '#725035');
        rect(x + 3, y - 9, 7, 11, '#d98737');
        rect(x, y - 12, 6, 5, '#6caa4c');
      }
    for (const x of [-81, 71]) {
      rect(x, -35, 7, 62, '#69432b');
      rect(x - 3, -40, 13, 7, '#d2aa65');
    }
    rect(-76, 12, 145, 6, '#aa7946');
    polygon(
      ctx,
      [
        [-54, -72],
        [-15, -91],
        [25, -70],
        [-16, -48],
      ],
      '#edba63',
      '#513a2a',
    );
    polygon(
      ctx,
      [
        [-54, -72],
        [-54, -37],
        [-16, -18],
        [-16, -48],
      ],
      '#a97c43',
    );
    polygon(
      ctx,
      [
        [-16, -48],
        [25, -70],
        [25, -37],
        [-16, -18],
      ],
      '#765334',
    );
    rect(36, -122, 7, 104, '#a38158');
    rect(15, -98, 48, 6, '#ebd7a1');
    rect(35, -119, 7, 48, '#ebd7a1');
    rect(32, -101, 13, 13, '#584b3a');
  } else {
    polygon(
      ctx,
      [
        [-82, -5],
        [-23, -39],
        [51, -24],
        [80, -4],
        [15, 30],
      ],
      '#382d2b',
    );
    for (const [x, y, h] of [
      [-59, -19, 45],
      [-23, -37, 70],
      [11, -25, 49],
      [57, -5, 38],
    ]) {
      polygon(
        ctx,
        [
          [x - 18, y],
          [x - 15, y - h + 14],
          [x, y - h],
          [x + 19, y - h + 13],
          [x + 24, y],
          [x, y + 10],
        ],
        '#494147',
        '#292c32',
      );
      polygon(
        ctx,
        [
          [x - 3, y - h + 7],
          [x + 5, y - h + 24],
          [x, y - 7],
          [x + 7, y + 2],
          [x + 10, y - 30],
        ],
        '#ef883f',
      );
    }
    polygon(
      ctx,
      [
        [-55, 11],
        [-20, -4],
        [-3, 4],
        [33, -5],
        [52, 7],
        [14, 24],
        [-7, 13],
        [-40, 23],
      ],
      '#e67b32',
    );
    polygon(
      ctx,
      [
        [-45, 11],
        [-20, 5],
        [1, 10],
        [27, 2],
        [35, 7],
        [13, 16],
        [-8, 9],
      ],
      '#fbd069',
    );
  }
  ctx.restore();
}

/** An ornamental lamp standing with its foot at (x, y). */
function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = '#00000044';
  ctx.beginPath();
  ctx.ellipse(x, y, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b2c22';
  ctx.fillRect(x - 10, y - 8, 20, 8);
  ctx.fillStyle = '#584332';
  ctx.fillRect(x - 4, y - 58, 8, 52);
  ctx.shadowColor = '#ffd36e';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#3b2c22';
  ctx.fillRect(x - 15, y - 80, 30, 24);
  ctx.fillStyle = '#f6d277';
  ctx.fillRect(x - 12, y - 77, 24, 18);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff0af';
  ctx.fillRect(x - 6, y - 73, 12, 10);
  ctx.fillStyle = '#3b2c22';
  ctx.fillRect(x - 18, y - 86, 36, 6);
  ctx.restore();
}

export default function World({
  save,
  placing,
  moving,
  onPlace,
  onMove,
  onSelect,
  lang,
  realm,
  placementKind = 'farm',
  now = Date.now(),
  covered = false,
  onProgress,
  cameraAction,
  neighbors,
  onNavigate,
  treasures = false,
  lampMode = false,
}: {
  save: Save;
  placing: boolean;
  moving: string | null;
  onPlace: (x: number, y: number) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onSelect: (id: string) => void;
  lang: number;
  realm: 'home' | RealmId;
  placementKind?: UtilityKind;
  now?: number;
  /** True while a window covers the island. */
  covered?: boolean;
  /** Reports how many of the images this view needs have loaded, until all of them have. */
  onProgress?: (done: number, total: number) => void;
  cameraAction?: ReactNode;
  /** Islands beside this one: shown when zoomed out, reached by dragging past the edge or tapping them. */
  neighbors?: { order: Place[]; locked: Place[] };
  onNavigate?: (to: Place) => void;
  /** Shows the lost treasure on the main island when one waits (your own island only). */
  treasures?: boolean;
  /** While placing: a lamp (one cell) instead of a building. */
  lampMode?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    image = useRef<HTMLImageElement | null>(null),
    buildings = useRef<HTMLImageElement | null>(null),
    worlds = useRef<Partial<Record<RealmId, HTMLImageElement>>>({});
  const utilityArt = useRef<Partial<Record<UtilityKind, HTMLImageElement>>>({});
  /** Milestone art by path; `null` marks a file that is not drawn yet, so it is requested only once. */
  const tierImages = useRef<Record<string, HTMLImageElement | null>>({});
  const animatedArt = useRef(new Map<string, { manifest: SpriteManifest; images: Map<string, HTMLImageElement> }>());
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    let active = true;
    const residents = save.dinos.filter(
      (d) => d.element === realm || (neighbors?.order.includes(d.element) && !neighbors.locked.includes(d.element)),
    );
    for (const d of residents) {
      const id = `${d.species}_${d.element}_${d.stage}`;
      if (animatedArt.current.has(id)) continue;
      loadAnimation(d.species, d.element, d.stage).then(async (manifest) => {
        if (!manifest || !active) return;
        const images = new Map<string, HTMLImageElement>();
        await Promise.all(
          Object.values(manifest.clips)
            .flatMap((clips) => Object.values(clips ?? {}))
            .map(async (clip) => {
              try {
                images.set(clip.sheet, await loadSpriteImage(clip.sheet));
              } catch {
                /* Retain concept fallback. */
              }
            }),
        );
        if (active) {
          animatedArt.current.set(id, { manifest, images });
          setLoaded((n) => n + 1);
        }
      });
    }
    return () => {
      active = false;
      animatedArt.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realm, save.dinos, neighbors?.order.join(), neighbors?.locked.join()]);
  /** Images that finished loading or failed: either way, nothing more to wait for. */
  const settled = useRef(new Set<string>());
  const settle = (src: string) => {
    settled.current.add(src);
    setLoaded((n) => n + 1);
  };
  const [loaded, setLoaded] = useState(0),
    [cell, setCell] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(realm === 'home' ? HOME_ZOOM : 1),
    [pan, setPan] = useState({ x: 0, y: 0 });
  // Keep active dragging on the animation frame path, without a React render per pointer event.
  const livePan = useRef(pan);
  const committedPan = useRef(pan);
  const cameraDirty = useRef(false);
  const overlay = useRef<HTMLDivElement>(null);
  const displayScale = useRef(1);
  const drawNow = useRef<((time: number) => void) | null>(null);
  const pendingPan = useRef<{ x: number; y: number } | null>(null);
  const panFrame = useRef<number | null>(null);
  const queuePan = (point: { x: number; y: number }) => {
    livePan.current = point;
    pendingPan.current = point;
    cameraDirty.current = true;
    if (reducedMotion && panFrame.current === null) {
      panFrame.current = requestAnimationFrame((time) => {
        panFrame.current = null;
        drawNow.current?.(time);
      });
    }
  };
  const commitPan = () => {
    if (panFrame.current !== null) cancelAnimationFrame(panFrame.current);
    panFrame.current = null;
    if (pendingPan.current) setPan(pendingPan.current);
    pendingPan.current = null;
  };
  /** How far the camera is pulled past its limit towards a neighbour (scene px, + reveals `prev`). */
  const swipe = useRef({ offset: 0, trigger: 1, ready: false });
  const spring = useRef<number | null>(null),
    springTo = useRef<{ x: number; y: number } | null>(null);
  const springBack = (to: { x: number; y: number }) => {
    const from = livePan.current,
      start = performance.now();
    if (reducedMotion) {
      queuePan(to);
      commitPan();
      return;
    }
    springTo.current = to;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 180),
        e = 1 - (1 - k) ** 3;
      queuePan({ x: from.x + (to.x - from.x) * e, y: to.y });
      if (k < 1) spring.current = requestAnimationFrame(step);
      else {
        spring.current = springTo.current = null;
        commitPan();
      }
    };
    spring.current = requestAnimationFrame(step);
  };
  useEffect(
    () => () => {
      if (panFrame.current !== null) cancelAnimationFrame(panFrame.current);
      if (spring.current !== null) cancelAnimationFrame(spring.current);
    },
    [],
  );
  const order = neighbors?.order ?? [],
    at = order.indexOf(realm),
    prev = at < 0 ? undefined : order[at - 1],
    next = at < 0 ? undefined : order[at + 1];
  // Every other island in the chain, laid out outwards from the current one; the first per side is adjacent.
  const sides: { side: -1 | 1; id: Place; locked: boolean; x: number; y: number; w: number; h: number }[] = [];
  if (at >= 0)
    for (const side of [-1, 1] as const) {
      let edge = islandFrame(realm).w / 2;
      for (let i = at + side; i >= 0 && i < order.length; i += side) {
        const id = order[i],
          f = islandFrame(id),
          centre = edge + ISLAND_GAP + f.w / 2;
        sides.push({ side, id, locked: !!neighbors?.locked.includes(id), ...f, x: f.x + side * centre });
        edge = centre + f.w / 2;
      }
    }
  const reach = {
    left: Math.min(islandFrame(realm).x, ...sides.map((n) => n.x)),
    right: Math.max(islandFrame(realm).x + islandFrame(realm).w, ...sides.map((n) => n.x + n.w)),
  };
  const placeName = (id: Place) =>
    `${neighbors?.locked?.includes(id) ? '🔒 ' : ''}${id === 'home' ? (lang ? 'Main island' : 'Insula principală') : REALM_NAMES[id][lang]}`;
  const [viewport, setViewport] = useState({ width: SCENE.width, height: SCENE.height });
  const view = useRef(viewport);
  view.current = viewport;
  // Canvas pixels per scene pixel, so the canvas matches the screen instead of being stretched by CSS.
  const [resolution, setResolution] = useState(1);
  const [panning, setPanning] = useState(false),
    [hovering, setHovering] = useState(false);
  const [hint, setHint] = useState(() => {
    try {
      return !localStorage.getItem('dino-realms-camera-hint');
    } catch {
      return true;
    }
  });
  const dismissHint = () => {
    setHint(false);
    try {
      localStorage.setItem('dino-realms-camera-hint', '1');
    } catch {
      /* Optional preference. */
    }
  };
  // Elemental worlds are a whole island on a night sky that fills the scene; the camera keeps the scene in view.
  const boundPan = (point: { x: number; y: number }, scale: number, view: { width: number; height: number }) => {
    const p = realm === 'home' ? constrainHomePan(point, scale, view) : constrainPan(point, scale, view);
    // Zoomed out, the camera travels the whole chain; closer in, dragging past the edge switches island.
    if (!sides.length || scale >= CHAIN_ZOOM) return p;
    return { x: Math.max(-(reach.right - 768) * scale, Math.min(-(reach.left - 768) * scale, point.x)), y: p.y };
  };
  const cameraPan = boundPan(pan, zoom, viewport);
  useLayoutEffect(() => {
    livePan.current = cameraPan;
    committedPan.current = cameraPan;
    cameraDirty.current = true;
    if (overlay.current) overlay.current.style.translate = '';
  }, [cameraPan.x, cameraPan.y, zoom, realm]);

  // Zooming out stops while the artwork still covers the whole screen, so no empty margin ever shows.
  // Cerul de noapte se întinde dincolo de scenă, deci se poate micșora până se vede toată insula.
  // With neighbours, zooming further out brings them into view.
  const minZoom = sides.length ? 0.15 : realm === 'home' ? 0.4 : 0.7;
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean; over: number } | null>(null);
  // Press and hold a building on the home island to pick it up and drag it to a new spot.
  const holdTimer = useRef<number | null>(null);
  const [held, setHeld] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const cancelHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  useEffect(() => cancelHold, []);
  const buildingAt = (p: { x: number; y: number }) =>
    [...save.buildings]
      .sort((a, b) => a.x + a.y - b.x - b.y)
      .reverse()
      .find((b) => {
        const q = project(b.x + 1.5, b.y + 1.5);
        const size = b.kind === 'hatchery' ? HATCHERY_SIZE : b.kind === 'farm' ? FARM_SIZE : BUILDING_SIZE;
        const lift = (BUILDING_LIFT * size) / BUILDING_SIZE;
        return Math.abs(p.x - q.x) < size / 2 && p.y < q.y + (40 * size) / BUILDING_SIZE && p.y > q.y - lift;
      });
  // Target top-left cell for the held building, keeping the grab point under the pointer.
  const heldCell = (p: { x: number; y: number }, h: { id: string; ox: number; oy: number }) => {
    const c = unproject(p.x - h.ox, p.y - h.oy);
    return h.id.startsWith('lamp:') ? c : { x: c.x - 1, y: c.y - 1 };
  };
  /** The front-most lamp under the pointer, or -1. */
  const lampAt = (p: { x: number; y: number }) => {
    let found = -1;
    save.lampSpots.forEach((l, i) => {
      const q = project(l.x + 0.5, l.y + 0.5);
      const hit = Math.abs(p.x - q.x) < 20 && p.y < q.y + 10 && p.y > q.y - 90;
      if (hit && (found < 0 || l.x + l.y >= save.lampSpots[found].x + save.lampSpots[found].y)) found = i;
    });
    return found;
  };
  const heldLamp = held?.id.startsWith('lamp:') ? Number(held.id.slice(5)) : -1;
  const showGhost = placing || held !== null;
  const ghostId = held?.id ?? moving;
  useEffect(() => {
    const canvas = ref.current,
      host = canvas?.parentElement;
    if (!canvas || !host) return;
    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      displayScale.current = rect.width / SCENE.width;
      if (rect.width)
        setResolution(Math.min(2, Math.max(1, (rect.width * (window.devicePixelRatio || 1)) / SCENE.width)));
      if (rect.width && rect.height)
        setViewport({
          width: (host.clientWidth / rect.width) * SCENE.width,
          height: (host.clientHeight / rect.height) * SCENE.height,
        });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setPan((p) => boundPan(p, zoom, viewport));
    drag.current = null;
  }, [zoom, viewport]);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      image.current = img;
      settle(HOME_SRC);
    };
    img.onerror = () => settle(HOME_SRC);
    img.src = HOME_SRC;
  }, []);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      buildings.current = img;
      settle(CONCEPTS_SRC);
    };
    img.onerror = () => settle(CONCEPTS_SRC);
    img.src = CONCEPTS_SRC;
  }, []);
  useEffect(() => {
    for (const kind of TIERED) {
      const art = tierArt(save, kind);
      if (!art || art in tierImages.current) continue;
      tierImages.current[art] = null;
      const img = new Image();
      img.onload = () => {
        measureGround(img);
        tierImages.current[art] = img;
        settle(art);
      };
      img.onerror = () => settle(art);
      img.src = art;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.farmLevel, save.hatcheryLevel, save.workshopLevel, save.arenaLevel]);
  /** The image a building is drawn with: its milestone art once loaded, else its base art. */
  const artFor = (kind: UtilityKind): [HTMLImageElement | null, boolean] => {
    const tier = tierArt(save, kind),
      img = tier ? tierImages.current[tier] : null;
    return img
      ? [img, true]
      : [
          utilityArt.current[kind] ?? (kind === 'market' ? null : buildings.current),
          kind === 'portal' && !!utilityArt.current[kind],
        ];
  };
  // A short burst over a building the moment it reaches a new level.
  const levelOf = (kind: UtilityKind) => buildingLevel(save, kind)?.level ?? 0;
  const levels = useRef(LEVELED.map(levelOf));
  const [burst, setBurst] = useState<{ kind: UtilityKind; level: number; key: number } | null>(null);
  useEffect(() => {
    const before = levels.current;
    levels.current = LEVELED.map(levelOf);
    const i = LEVELED.findIndex((_, k) => levels.current[k] > before[k]);
    if (i < 0) return;
    setBurst({ kind: LEVELED[i], level: levels.current[i], key: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.farmLevel, save.hatcheryLevel, save.workshopLevel, save.arenaLevel]);
  // Upgrades happen inside a window over the island, so the burst waits until the island is visible again.
  useEffect(() => {
    if (!burst || covered) return;
    const id = window.setTimeout(() => setBurst(null), 1800);
    return () => window.clearTimeout(id);
  }, [burst, covered]);
  useEffect(() => {
    for (const kind of ['workshop', 'portal', 'arena', 'market'] as const) {
      const img = new Image(),
        src = utilitySrc(kind);
      img.onload = () => {
        utilityArt.current[kind] = img;
        settle(src);
      };
      img.onerror = () => settle(src);
      img.src = src;
    }
  }, []);
  useEffect(() => {
    if (realm === 'home' || worlds.current[realm]) return;
    let active = true;
    const img = new Image();
    img.onload = () => {
      worlds.current[realm] = img;
      if (active) settle(worldArt(realm));
    };
    img.onerror = () => active && settle(worldArt(realm));
    img.src = worldArt(realm);
    return () => {
      active = false;
    };
  }, [realm]);
  useEffect(() => {
    for (const id of order) {
      if (id === 'home' || worlds.current[id]) continue;
      const img = new Image();
      img.onload = () => {
        worlds.current[id] = img;
        settle(worldArt(id));
      };
      img.onerror = () => settle(worldArt(id));
      img.src = worldArt(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.join()]);
  // The view shows only once its real artwork is in, so the drawn stand-ins never flash on screen.
  const needed =
    realm === 'home'
      ? [
          HOME_SRC,
          CONCEPTS_SRC,
          ...(['workshop', 'portal', 'arena', 'market'] as const)
            .filter((kind) => save.buildings.some((b) => b.kind === kind))
            .map(utilitySrc),
          ...TIERED.filter((kind) => save.buildings.some((b) => b.kind === kind))
            .map((kind) => tierArt(save, kind))
            .filter((art): art is string => !!art),
        ]
      : [worldArt(realm)];
  const pending = [...new Set(needed)],
    done = pending.filter((src) => settled.current.has(src)).length,
    ready = done === pending.length;
  useEffect(() => {
    onProgress?.(done, pending.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, pending.length]);
  useEffect(() => {
    setZoom(realm === 'home' ? HOME_ZOOM : 1);
    setPan({ x: 0, y: 0 });
    setCell(null);
    setHeld(null);
    cancelHold();
  }, [realm]);
  useLayoutEffect(() => {
    const canvas = ref.current,
      ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const owned = realm === 'home' ? [] : save.dinos.filter((x) => x.element === realm);
    let raf = 0,
      lastPaint = -Infinity;
    const paint = (time: number) => {
      const cameraPan = livePan.current;
      const dragging = !!drag.current?.moved;
      const paintInterval = realm === 'arcane' || realm === 'lightning' ? 1000 / 30 - 0.5 : 80;
      if (
        !document.hidden &&
        (cameraDirty.current ||
          time - lastPaint >= (dragging || held || placing ? 0 : paintInterval) ||
          reducedMotion ||
          covered)
      ) {
        cameraDirty.current = false;
        lastPaint = time;
        const host = canvas.parentElement;
        if (host) {
          host.dataset.cameraX = String(cameraPan.x);
          host.dataset.cameraY = String(cameraPan.y);
        }
        if (overlay.current) {
          overlay.current.style.translate = `${(cameraPan.x - committedPan.current.x) * displayScale.current}px ${(cameraPan.y - committedPan.current.y) * displayScale.current}px`;
        }
        ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
        ctx.clearRect(0, 0, 1536, 1024);
        // A sky matching the artwork's border, under it in case rounding leaves a sliver at the edge.
        const margin = ctx.createLinearGradient(0, 0, 0, 1024);
        margin.addColorStop(0, realm === 'home' ? '#338bfd' : '#10223d');
        margin.addColorStop(1, realm === 'home' ? '#c4d5fa' : '#29445c');
        ctx.fillStyle = margin;
        ctx.fillRect(0, 0, 1536, 1024);
        // Zoomed in, smoothing blurs the pixel art; nearest-neighbour keeps every pixel crisp.
        ctx.imageSmoothingEnabled = false;
        ctx.imageSmoothingQuality = 'high';
        ctx.save();
        ctx.translate(768 + cameraPan.x, 512 + cameraPan.y);
        ctx.scale(zoom, zoom);
        ctx.translate(-768, -512);
        {
          const [skyTop, skyBottom, glow] = realm === 'home' ? HOME_SKY : SKIES[realm];
          const sky = ctx.createLinearGradient(0, 0, 0, 1024);
          sky.addColorStop(0, skyTop);
          sky.addColorStop(1, skyBottom);
          ctx.fillStyle = sky;
          // Fill the entire visible canvas in world coordinates, even at the drag limits.
          const left = 768 + (-768 - cameraPan.x) / zoom;
          const top = 512 + (-512 - cameraPan.y) / zoom;
          ctx.fillRect(left - 2, top - 2, 1536 / zoom + 4, 1024 / zoom + 4);
          // stele pixel, fixe, cu o licărire lentă; cu vecini, cerul larg se repetă pe toată lungimea lanțului
          const right = left + 1536 / zoom;
          for (let i = 0; i < (sides.length ? 440 : 110); i++) {
            const wide = i >= 110,
              bx = wide ? ((i * 317 + 43) % 5376) - 1920 : ((i * 317 + 43) % 2496) - 480,
              y = wide ? ((i * 211 + 61) % 3072) - 1024 : ((i * 211 + 61) % 1504) - 240;
            const twinkle = reducedMotion ? 1 : 0.55 + 0.45 * Math.sin(time / 700 + i * 1.7);
            ctx.globalAlpha = (i % 4 ? 0.55 : 0.9) * twinkle;
            ctx.fillStyle = i % 5 ? '#ffffff' : glow;
            const sz = i % 7 ? 2 : 4;
            if (!wide) {
              ctx.fillRect(bx & ~1, y & ~1, sz, sz);
              continue;
            }
            for (let k = Math.ceil((left - 4 - bx) / 5376); bx + k * 5376 < right; k++) {
              const x = bx + k * 5376;
              if (x >= -480 && x < 2016 && y >= -240 && y < 1264) continue;
              ctx.fillRect(x & ~1, y & ~1, sz, sz);
            }
          }
          ctx.globalAlpha = 1;
        }
        if (realm === 'home') {
          if (image.current) {
            ctx.drawImage(
              image.current,
              HOME_ISLAND.offset[0],
              HOME_ISLAND.offset[1],
              HOME_ISLAND.size[0] * 2,
              HOME_ISLAND.size[1] * 2,
            );
            if (!reducedMotion) {
              drawIslandAtmosphere(
                ctx,
                image.current,
                'home',
                time,
                HOME_ISLAND.offset,
                (HOME_ISLAND.size[0] * 2) / image.current.naturalWidth,
              );
            }
          }
        } else {
          const environment = worlds.current[realm];
          if (environment) {
            const isl = ISLANDS[realm];
            ctx.drawImage(
              realm === 'fire' && !reducedMotion ? islandBaseImage(environment, 'fire') : environment,
              isl.offset[0],
              isl.offset[1],
              isl.size[0] * isl.scale,
              isl.size[1] * isl.scale,
            );
            if (!reducedMotion) {
              if (realm === 'water' || realm === 'fire')
                drawIslandAtmosphere(ctx, environment, realm, time, isl.offset, isl.scale);
              else drawElementalAtmosphere(ctx, environment, realm, time, isl.offset, isl.scale);
            }
          }
        }
        const drawHomeObjects = () => {
          const lamps = save.lampSpots.map((l, i) => ({ lamp: true as const, i, ...l, depth: l.x + l.y }));
          [...save.buildings.map((b) => ({ lamp: false as const, b, depth: b.x + b.y + 2 })), ...lamps]
            .sort((a, b) => a.depth - b.depth)
            .forEach((o) => {
              if (o.lamp) {
                const p = project(o.x + 0.5, o.y + 0.5);
                if (o.i === heldLamp) ctx.globalAlpha = 0.3;
                drawLamp(ctx, p.x, p.y);
                ctx.globalAlpha = 1;
                return;
              }
              const b = o.b;
              if (b.id === held?.id) ctx.globalAlpha = 0.3;
              drawBuilding(ctx, b, ...artFor(b.kind as UtilityKind), reducedMotion ? 0 : time);
              ctx.globalAlpha = 1;
            });
        };
        for (const n of sides) {
          const img = n.id === 'home' ? image.current : worlds.current[n.id];
          if (!img) continue;
          ctx.globalAlpha = n.locked ? 0.75 : 0.9;
          if (n.locked) ctx.filter = 'grayscale(0.75) brightness(0.55)';
          ctx.drawImage(img, n.x, n.y, n.w, n.h);
          ctx.filter = 'none';
          ctx.globalAlpha = 1;
          if (n.locked) drawChains(ctx, n.x + n.w / 2, n.y + n.h / 2, Math.min(n.w, n.h) * 0.8);
          if (n.id === 'home') {
            ctx.save();
            ctx.translate(n.x - islandFrame('home').x, 0);
            drawHomeObjects();
            ctx.restore();
          }
        }
        ctx.imageSmoothingEnabled = false;
        if (showGhost) {
          for (const { x, y } of BUILDABLE_CELLS) {
            const p = project(x, y);
            polygon(
              ctx,
              [
                [p.x, p.y],
                [p.x + GRID.w, p.y + GRID.h],
                [p.x, p.y + GRID.h * 2],
                [p.x - GRID.w, p.y + GRID.h],
              ],
              (x + y) % 2 ? '#e5f4b01c' : '#284a3820',
              '#f0e6be35',
            );
          }
        }
        if (realm === 'home') drawHomeObjects();
        // Worlds show only the dinosaurs the player owns there; open neighbours show theirs too.
        const groups = [
          ...(realm === 'home' ? [] : [{ dinos: owned, spots: ISLANDS[realm].spots, dx: 0 }]),
          ...sides
            .filter((n) => n.id !== 'home' && !n.locked)
            .map((n) => ({
              dinos: save.dinos.filter((d) => d.element === n.id),
              spots: ISLANDS[n.id as RealmId].spots,
              dx: n.x - islandFrame(n.id).x,
            })),
        ];
        for (const { dinos, spots, dx } of groups)
          dinos.forEach((x, i) => {
            const anchor = spots[i % spots.length];
            const phase = reducedMotion ? 0 : ((time + i * 1700) % 10000) / 1000;
            const walking = (phase >= 3 && phase < 5) || phase >= 8;
            const returning = phase >= 8;
            const travel = phase < 3 ? 0 : phase < 5 ? (phase - 3) / 2 : phase < 8 ? 1 : 1 - (phase - 8) / 2;
            const art = animatedArt.current.get(`${x.species}_${x.element}_${x.stage}`);
            const facing = 'se';
            const clip = art?.manifest.clips[facing]?.[walking ? 'walk' : 'idle'];
            const sheet = clip && art?.images.get(clip.sheet);
            const p = { x: anchor.x + dx + (sheet ? travel * 64 : 0), y: anchor.y };
            if (clip && sheet && art) {
              const size = x.stage === 'baby' ? 128 : x.stage === 'juvenile' ? 176 : 224;
              const m = art.manifest;
              const factor = size / m.sourceSize.height;
              ctx.save();
              ctx.translate(Math.round(p.x), Math.round(p.y));
              if (returning) ctx.scale(-1, 1);
              const clipTime = walking ? (phase - (returning ? 8 : 3)) * 1000 : time + i * 137;
              // Rare, epic and legendary residents glow in their rarity's colour; the glow breathes unless motion is reduced.
              const glow = RARITY_CANVAS[rarityOf(x)].glow;
              if (glow) {
                ctx.shadowColor = glow;
                ctx.shadowBlur = (rarityOf(x) === 'rare' ? 6 : 12) + (reducedMotion ? 0 : 4 * Math.sin(time / 400 + i));
              }
              drawSprite(
                ctx,
                sheet,
                clip,
                frameAt(clip, reducedMotion ? 0 : clipTime),
                -m.pivot.x * factor,
                -m.pivot.y * factor,
                m.sourceSize.width * factor,
                size,
                m,
              );
              ctx.restore();
            }
            const label = `${x.id === save.champion ? '★ ' : ''}${x.nickname} · ${x.level}`;
            ctx.font = "600 13px 'Pixelify Sans', sans-serif";
            ctx.textAlign = 'center';
            const width = ctx.measureText(label).width + 16;
            const tone = RARITY_CANVAS[rarityOf(x)];
            ctx.fillStyle = tone.bg;
            ctx.fillRect(p.x - width / 2, p.y + 4, width, 22);
            if (tone.glow) {
              ctx.strokeStyle = tone.glow;
              ctx.lineWidth = 2;
              ctx.strokeRect(p.x - width / 2 + 1, p.y + 5, width - 2, 20);
            }
            ctx.fillStyle = tone.text;
            ctx.fillText(label, p.x, p.y + 19);
          });
        if (cell && showGhost && (lampMode || heldLamp >= 0)) {
          const p = project(cell.x, cell.y),
            valid = canLamp(save, cell.x, cell.y, heldLamp >= 0 ? heldLamp : undefined);
          ctx.globalAlpha = 0.75;
          const c = project(cell.x + 0.5, cell.y + 0.5);
          drawLamp(ctx, c.x, c.y);
          ctx.globalAlpha = 1;
          polygon(
            ctx,
            [
              [p.x, p.y],
              [p.x + GRID.w, p.y + GRID.h],
              [p.x, p.y + GRID.h * 2],
              [p.x - GRID.w, p.y + GRID.h],
            ],
            valid ? '#74e99e59' : '#f06c6966',
          );
          ctx.save();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = valid ? '#c1ffbf' : '#ffb6a7';
          ctx.stroke();
          ctx.restore();
        } else if (cell && showGhost) {
          const p = project(cell.x, cell.y),
            valid = canBuild(save, cell.x, cell.y, ghostId ?? undefined),
            ghostKind = ghostId ? (save.buildings.find((b) => b.id === ghostId)?.kind ?? placementKind) : placementKind;
          ctx.globalAlpha = 0.65;
          drawBuilding(ctx, { id: 'ghost', kind: ghostKind, ...cell }, ...artFor(ghostKind as UtilityKind));
          ctx.globalAlpha = 1;
          // The footprint marker goes on top: newer building art covers its whole 3x3 plate and would hide it.
          const footprint = [
            [p.x, p.y],
            [p.x + GRID.w * 3, p.y + GRID.h * 3],
            [p.x, p.y + GRID.h * 6],
            [p.x - GRID.w * 3, p.y + GRID.h * 3],
          ];
          polygon(ctx, footprint, valid ? '#74e99e59' : '#f06c6966');
          ctx.save();
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#00000066';
          ctx.stroke();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = valid ? '#c1ffbf' : '#ffb6a7';
          ctx.stroke();
          ctx.restore();
        }
        if (!showGhost) drawRealmAtmosphere(ctx, realm, reducedMotion ? 0 : time);
        const unit = 1 / (displayScale.current * zoom);
        for (const n of sides)
          pill(
            ctx,
            n.side < 0 ? `← ${placeName(n.id)}` : `${placeName(n.id)} →`,
            n.x + n.w / 2,
            n.y + n.h * 0.12,
            15 * unit,
            false,
          );
        ctx.restore();
        // While pulled past the edge, the next island's name waits at that edge of the screen.
        const pull = swipe.current,
          target = pull.offset ? sides.find((n) => n.side === (pull.offset > 0 ? -1 : 1)) : undefined;
        if (target) {
          const vw = Math.min(1536, view.current.width),
            s = 1 / displayScale.current,
            name = pull.ready ? `${lang ? 'Go to' : 'Mergi la'} ${placeName(target.id)}` : placeName(target.id);
          ctx.globalAlpha = Math.min(1, Math.abs(pull.offset) / pull.trigger);
          pill(
            ctx,
            target.side < 0 ? `← ${name}` : `${name} →`,
            768 + target.side * (vw / 2 - 16 * s),
            512,
            16 * s,
            pull.ready,
            target.side,
          );
          ctx.globalAlpha = 1;
        }
      }
      if (!reducedMotion && !covered) raf = requestAnimationFrame(paint);
    };
    drawNow.current = paint;
    paint(performance.now());
    const resume = () => {
      if (!document.hidden) {
        cancelAnimationFrame(raf);
        lastPaint = -Infinity;
        paint(performance.now());
      }
    };
    document.addEventListener('visibilitychange', resume);
    return () => {
      cancelAnimationFrame(raf);
      if (drawNow.current === paint) drawNow.current = null;
      document.removeEventListener('visibilitychange', resume);
    };
  }, [
    save.buildings,
    save.dinos,
    save.champion,
    save.lamps,
    save.lampSpots,
    lampMode,
    loaded,
    placing,
    moving,
    held,
    panning,
    resolution,
    placementKind,
    cell,
    zoom,
    cameraPan.x,
    cameraPan.y,
    realm,
    reducedMotion,
    covered,
    order.join(),
    neighbors?.locked.join(),
    lang,
  ]);
  const here = realm === 'home' ? [] : save.dinos.filter((x) => x.element === realm);
  const availableGold = Math.floor(advance(save, now).storedGold);
  // Two-finger pinch on phones: the scene point between the fingers stays under them while zooming and moving.
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number; wx: number; wy: number } | null>(null);
  /** Set while a pinch is in progress and until every finger is lifted, so lifting one never counts as a tap. */
  const pinched = useRef(false);
  const scenePoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 1536, y: ((e.clientY - r.top) / r.height) * 1024 };
  };
  const twoFingers = () => {
    const [a, b] = [...fingers.current.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(minZoom, Math.abs(z - 1) < 0.05 ? 1 : z));
  const zoomAt = (next: number, cx = 768, cy = 512) => {
    const z = clampZoom(next);
    if (z === zoom) return;
    const wx = (cx - 768 - cameraPan.x) / zoom + 768,
      wy = (cy - 512 - cameraPan.y) / zoom + 512;
    setZoom(z);
    setPan(boundPan({ x: cx - 768 - (wx - 768) * z, y: cy - 512 - (wy - 512) * z }, z, viewport));
    if (hint) dismissHint();
  };
  const coords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: (((e.clientX - r.left) / r.width) * 1536 - 768 - livePan.current.x) / zoom + 768,
      y: (((e.clientY - r.top) / r.height) * 1024 - 512 - livePan.current.y) / zoom + 512,
    };
  };
  return (
    <div
      className={`realm-world${held ? ' holding' : ''}${panning ? ' panning' : ''}${placing ? ' placing' : ''}${hovering ? ' hovering' : ''}${ready ? '' : ' loading'}`}
      data-realm={realm}
      data-residents={here.length}
      data-preview-residents={0}
      data-dinosaur-art-ready={
        realm === 'home' ||
        save.dinos
          .filter((d) => d.element === realm)
          .every((d) => animatedArt.current.has(`${d.species}_${d.element}_${d.stage}`))
      }
      data-environment-ready={realm === 'home' ? !!image.current : !!worlds.current[realm]}
      data-camera-x={cameraPan.x}
      data-camera-y={cameraPan.y}
      data-camera-zoom={zoom}
    >
      {!ready && (
        <div className="realm-world-loading" role="status">
          <span>
            {lang ? 'Loading the world…' : 'Se încarcă lumea…'} {done}/{pending.length}
          </span>
        </div>
      )}
      <canvas
        ref={ref}
        width={Math.round(1536 * resolution)}
        height={Math.round(1024 * resolution)}
        aria-label={
          realm === 'home'
            ? lang
              ? 'Home island. Select buildings or use the controls.'
              : 'Insula principală. Selectează clădiri sau folosește comenzile.'
            : ELEMENTS.find((el) => el.id === realm)!.name[lang]
        }
        onContextMenu={(e) => e.preventDefault()}
        onWheel={(e) => {
          if (placing && !e.deltaY) return;
          const r = e.currentTarget.getBoundingClientRect();
          zoomAt(
            zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15),
            ((e.clientX - r.left) / r.width) * 1536,
            ((e.clientY - r.top) / r.height) * 1024,
          );
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fingers.current.set(e.pointerId, scenePoint(e));
          if (fingers.current.size === 2 && !placing && !held) {
            const f = twoFingers();
            cancelHold();
            setPanning(false);
            drag.current = null;
            pinched.current = true;
            pinch.current = {
              distance: Math.max(1, f.distance),
              zoom,
              wx: (f.x - 768 - cameraPan.x) / zoom + 768,
              wy: (f.y - 512 - cameraPan.y) / zoom + 512,
            };
            if (hint) dismissHint();
            return;
          }
          if (pinched.current) return;
          if (spring.current !== null) cancelAnimationFrame(spring.current);
          const from = springTo.current ?? livePan.current;
          spring.current = springTo.current = null;
          drag.current = { x: e.clientX, y: e.clientY, px: from.x, py: from.y, moved: false, over: 0 };
          const p = coords(e);
          if (placing) setCell(unproject(p.x, p.y));
          cancelHold();
          const lamp = !placing && realm === 'home' && onMove ? lampAt(p) : -1;
          const b = !placing && realm === 'home' && onMove && lamp < 0 ? buildingAt(p) : undefined;
          if (lamp >= 0) {
            const l = save.lampSpots[lamp],
              q = project(l.x + 0.5, l.y + 0.5),
              grab = { id: `lamp:${lamp}`, ox: p.x - q.x, oy: p.y - q.y };
            holdTimer.current = window.setTimeout(() => {
              holdTimer.current = null;
              navigator.vibrate?.(30);
              setHeld(grab);
              setCell({ x: l.x, y: l.y });
            }, 400);
          }
          if (b) {
            const q = project(b.x + 1.5, b.y + 1.5),
              grab = { id: b.id, ox: p.x - q.x, oy: p.y - q.y };
            holdTimer.current = window.setTimeout(() => {
              holdTimer.current = null;
              navigator.vibrate?.(30);
              setHeld(grab);
              setCell({ x: b.x, y: b.y });
            }, 400);
          }
        }}
        onPointerMove={(e) => {
          if (fingers.current.has(e.pointerId)) fingers.current.set(e.pointerId, scenePoint(e));
          if (pinch.current && fingers.current.size >= 2) {
            const f = twoFingers(),
              start = pinch.current,
              z = clampZoom((start.zoom * f.distance) / start.distance);
            setZoom(z);
            setPan(boundPan({ x: f.x - 768 - (start.wx - 768) * z, y: f.y - 512 - (start.wy - 512) * z }, z, viewport));
            return;
          }
          if (pinched.current) return;
          if (!drag.current && !placing && !held) {
            const p = coords(e);
            setHovering(
              realm === 'home'
                ? !!buildingAt(p) || lampAt(p) >= 0
                : here.some((x, i) => {
                    const spots = ISLANDS[realm as RealmId].spots;
                    const dp = spots[i % spots.length];
                    return Math.abs(p.x - dp.x) < 60 && p.y > dp.y - STAGE_HEIGHT[x.stage] && p.y < dp.y + 25;
                  }),
            );
          }
          if (held) {
            setCell(heldCell(coords(e), held));
            return;
          }
          if (placing) {
            const p = coords(e);
            setCell(unproject(p.x, p.y));
          }
          const d = drag.current;
          if (d && !placing) {
            const dx = e.clientX - d.x,
              dy = e.clientY - d.y;
            if (Math.hypot(dx, dy) > 6) {
              if (!d.moved) {
                setPanning(true);
                if (hint) dismissHint();
              }
              d.moved = true;
              cancelHold();
            }
            if (d.moved) {
              const r = e.currentTarget.getBoundingClientRect();
              const sx = (dx * 1536) / r.width;
              // A pull past the edge is spent first when the drag turns back.
              let x = d.px + sx,
                over = d.over;
              if (over) {
                const sum = over + sx;
                if (Math.sign(sum) === Math.sign(over)) {
                  over = sum;
                  x = d.px;
                } else {
                  over = 0;
                  x = d.px + sum;
                }
              }
              const next = boundPan({ x, y: d.py + (dy * 1024) / r.height }, zoom, viewport);
              over += x - next.x;
              if (!(over > 0 ? prev : next)) over = 0;
              // Re-anchor even at a limit: reversing must not replay overshoot before the island moves.
              d.x = e.clientX;
              d.y = e.clientY;
              d.px = next.x;
              d.py = next.y;
              d.over = over;
              const trigger = Math.min(150, viewport.width * 0.15),
                shown = Math.sign(over) * Math.min(trigger * 1.6, Math.abs(over) * 0.45);
              swipe.current = { offset: shown, trigger, ready: Math.abs(shown) >= trigger };
              queuePan({ x: next.x + shown, y: next.y });
            }
          }
        }}
        onPointerUp={(e) => {
          fingers.current.delete(e.pointerId);
          if (pinched.current) {
            if (fingers.current.size < 2) pinch.current = null;
            if (fingers.current.size === 0) pinched.current = false;
            return;
          }
          const d = drag.current,
            pull = swipe.current;
          swipe.current = { ...pull, offset: 0, ready: false };
          const travel = pull.ready ? (pull.offset > 0 ? prev : next) : undefined;
          if (d && pull.offset && !travel) springBack({ x: d.px, y: d.py });
          else {
            if (d && pull.offset) queuePan({ x: d.px, y: d.py });
            commitPan();
          }
          drag.current = null;
          setPanning(false);
          cancelHold();
          if (travel) return onNavigate?.(travel);
          if (held) {
            const c = heldCell(coords(e), held),
              b = heldLamp >= 0 ? save.lampSpots[heldLamp] : save.buildings.find((b) => b.id === held.id);
            setHeld(null);
            setCell(null);
            if (b && (b.x !== c.x || b.y !== c.y)) onMove?.(held.id, c.x, c.y);
            return;
          }
          if (d?.moved) return;
          const p = coords(e),
            c = unproject(p.x, p.y);
          if (placing) return onPlace(c.x, c.y);
          const beside = sides.find((n) => p.x >= n.x && p.x <= n.x + n.w && p.y >= n.y && p.y <= n.y + n.h);
          if (beside && onNavigate) return onNavigate(beside.id);
          const picked = here.find((x, i) => {
            const dp = OWNED_SPOTS[i % OWNED_SPOTS.length];
            return Math.abs(p.x - dp.x) < 60 && p.y > dp.y - STAGE_HEIGHT[x.stage] && p.y < dp.y + 25;
          });
          if (picked) return onSelect(`dino:${picked.id}`);
          if (realm !== 'home') return onSelect('habitat');
          const b = buildingAt(p);
          if (b) onSelect(b.id);
        }}
        onPointerLeave={() => setHovering(false)}
        onPointerCancel={(e) => {
          if (drag.current && swipe.current.offset) queuePan({ x: drag.current.px, y: drag.current.py });
          swipe.current = { ...swipe.current, offset: 0, ready: false };
          commitPan();
          fingers.current.delete(e.pointerId);
          if (fingers.current.size < 2) pinch.current = null;
          if (fingers.current.size === 0) pinched.current = false;
          drag.current = null;
          setPanning(false);
          cancelHold();
          setHeld(null);
          setCell(null);
        }}
      />
      {!showGhost && (
        <div ref={overlay} className="realm-object-overlay">
          {realm === 'home' &&
            treasures &&
            treasureReady(save, now) &&
            (() => {
              const spot = treasureSpot(save, now);
              if (!spot) return null;
              const p = project(spot.x + 0.5, spot.y + 0.5);
              return (
                <button
                  className="realm-treasure"
                  aria-label={lang ? 'Lost treasure: pick it up' : 'Comoară pierdută: ia-o'}
                  title={lang ? 'Lost treasure!' : 'Comoară pierdută!'}
                  style={{
                    left: `${((768 + (p.x - 768) * zoom + cameraPan.x) / 1536) * 100}%`,
                    top: `${((512 + (p.y - 512) * zoom + cameraPan.y) / 1024) * 100}%`,
                  }}
                  onClick={() => onSelect('treasure')}
                >
                  <Icon name="chest" scale={2} />
                </button>
              );
            })()}
          {realm === 'home' ? (
            save.buildings.map((b) => {
              const p = project(b.x + 1.5, b.y + 1.5),
                kind = b.kind as UtilityKind;
              const at =
                kind === 'hatchery'
                  ? save.eggs.reduce<number | null>(
                      (at, egg) => (egg.hatchAt !== null && (at === null || egg.hatchAt < at) ? egg.hatchAt : at),
                      null,
                    )
                  : kind === 'farm'
                    ? farmNextAt(save)
                    : kind === 'workshop'
                      ? (save.crafting.find((j) => j.endsAt > now)?.endsAt ?? null)
                      : null;
              const ready = kind === 'workshop' ? save.crafting.some((j) => j.endsAt <= now) : at !== null && now >= at;
              // A building being upgraded shows the builder's countdown instead of its production.
              const building =
                save.construction && save.construction.target === kind && save.construction.endsAt > now
                  ? save.construction
                  : null;
              if (building)
                return (
                  <button
                    key={b.id}
                    aria-label={`${UTILITY_BUILDINGS[kind].name[lang]} · ${lang ? 'being built' : 'în construcție'}`}
                    className="production-bubble constructing"
                    style={{
                      left: `${((768 + (p.x - 768) * zoom + cameraPan.x) / 1536) * 100}%`,
                      top: `${((512 + (p.y - BUILDING_LIFT - 10 - 512) * zoom + cameraPan.y) / 1024) * 100}%`,
                    }}
                    onClick={() => onSelect(b.id)}
                  >
                    <Icon name="build" scale={1} /> {clock(building.endsAt - now)}
                    <i className="building-level" title={lang ? 'Level being built' : 'Nivelul în construcție'}>
                      → {lang ? 'Lv' : 'Nv'} {building.level}
                    </i>
                  </button>
                );
              const label = ready
                ? lang
                  ? 'Collect'
                  : 'Colectează'
                : at
                  ? `${Math.max(0, Math.ceil((at - now) / 1000))}s`
                  : UTILITY_BUILDINGS[kind].name[lang];
              return (
                <button
                  key={b.id}
                  aria-label={UTILITY_BUILDINGS[kind].name[lang]}
                  className={`production-bubble ${ready ? 'ready' : ''}`}
                  style={{
                    left: `${((768 + (p.x - 768) * zoom + cameraPan.x) / 1536) * 100}%`,
                    top: `${((512 + (p.y - BUILDING_LIFT - 10 - 512) * zoom + cameraPan.y) / 1024) * 100}%`,
                  }}
                  onClick={() => onSelect(b.id)}
                >
                  {UTILITY_BUILDINGS[kind].icon} {label}
                  {buildingLevel(save, kind) && (
                    <i className="building-level" title={lang ? 'Building level' : 'Nivelul clădirii'}>
                      {lang ? 'Lv' : 'Nv'} {buildingLevel(save, kind)!.level}
                    </i>
                  )}
                </button>
              );
            })
          ) : save.habitats[realm] ? (
            <>
              {save.construction &&
                save.construction.target === `habitat:${realm}` &&
                save.construction.endsAt > now && (
                  <button
                    className="production-bubble constructing habitat-building"
                    aria-label={lang ? 'Habitat being upgraded' : 'Habitat în construcție'}
                    style={{
                      left: `${((768 + (960 - 768) * zoom + cameraPan.x) / 1536) * 100}%`,
                      top: `${((512 + (170 - 512) * zoom + cameraPan.y) / 1024) * 100}%`,
                    }}
                    onClick={() => onSelect('habitat')}
                  >
                    <Icon name="build" scale={1} /> {clock(save.construction.endsAt - now)}
                    <i className="building-level">
                      → {lang ? 'Lv' : 'Nv'} {save.construction.level}
                    </i>
                  </button>
                )}
              <button
                className="production-bubble habitat-gold"
                aria-label={lang ? `Collect ${availableGold} gold` : `Colectează ${availableGold} aur`}
                style={{
                  // Above the platform, right of centre: still inside a portrait phone's view.
                  left: `${((768 + (960 - 768) * zoom + cameraPan.x) / 1536) * 100}%`,
                  top: `${((512 + (250 - 512) * zoom + cameraPan.y) / 1024) * 100}%`,
                }}
                onClick={() => onSelect('income')}
              >
                <Icon name="gold" scale={1} />
                <strong>{availableGold.toLocaleString(lang ? 'en-US' : 'ro-RO')}</strong>
              </button>
            </>
          ) : null}
        </div>
      )}
      {realm === 'home' &&
        burst &&
        !covered &&
        (() => {
          const b = save.buildings.find((x) => x.kind === burst.kind);
          if (!b) return null;
          const p = project(b.x + 1.5, b.y + 1.5);
          return (
            <div
              key={burst.key}
              className="building-upgrade-burst"
              aria-hidden="true"
              style={{
                left: `${((768 + (p.x - 768) * zoom + cameraPan.x) / 1536) * 100}%`,
                top: `${((512 + (p.y - BUILDING_LIFT / 2 - 512) * zoom + cameraPan.y) / 1024) * 100}%`,
              }}
            >
              <span className="burst-ring" />
              <span className="burst-ring late" />
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} style={{ '--a': `${i * 36}deg` } as React.CSSProperties} />
              ))}
              <strong>
                {lang ? 'Lv' : 'Nv'} {burst.level}!
              </strong>
            </div>
          );
        })()}
      <div className="realm-camera">
        {cameraAction && <div className="realm-camera-action">{cameraAction}</div>}
        {hint && !placing && (
          <div className="realm-world-hint" role="note">
            <span>
              🖐{' '}
              {lang
                ? 'Drag to move around · mouse wheel or pinch to zoom'
                : 'Trage ca să te miști · rotița mouse-ului sau două degete pentru zoom'}
              {realm === 'home' && (
                <small>{lang ? 'Press and hold a building to move it' : 'Ține apăsat pe o clădire ca s-o muți'}</small>
              )}
            </span>
            <button onClick={dismissHint} aria-label={lang ? 'Got it' : 'Am înțeles'}>
              ×
            </button>
          </div>
        )}
        <button
          onClick={() => zoomAt(Math.round((zoom + BUTTON_ZOOM_STEP) * 1000) / 1000)}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => zoomAt(Math.round((zoom - BUTTON_ZOOM_STEP) * 1000) / 1000)}
          disabled={zoom <= minZoom + 0.001}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => {
            setZoom(realm === 'home' ? HOME_ZOOM : 1);
            setPan({ x: 0, y: 0 });
          }}
          aria-label={lang ? 'Center island' : 'Centrează insula'}
          className="realm-recenter"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <span>{lang ? 'Center' : 'Centru'}</span>
        </button>
      </div>
    </div>
  );
}
