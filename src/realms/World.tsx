import { drawWorkshop, WORKSHOP_GROUND } from './animatedWorkshop';
import { drawFarm, FARM_GROUND } from './animatedFarm';
import { useEffect, useRef, useState } from 'react';
import { advance, canPlace, ELEMENTS, farmNextAt, type Building, type Save, type RealmId } from './game';
import { constrainPan, HOME_ART, SCENE } from './camera';
import { buildingLevel, groundLine, LEVELED, measureGround, tierArt } from './buildingTiers';
import { worldArt } from './worldArt';
import { ISLANDS, SKIES } from './islands';
import HOME_ISLAND from './islands/home.json';
import { UTILITY_BUILDINGS, type UtilityKind } from './content';
import { SPECIES, SPECIES_NAMES } from './dinosaurs';
import { BUILDABLE_CELLS, GRID, project, unproject } from './grid';
import { drawSprite, frameAt, loadAnimation, loadSpriteImage, type SpriteManifest } from './animation';
import { drawBuildingEffect, drawRealmAtmosphere } from './worldEffects';
import { useReducedMotion } from './useMotion';

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
  kind === 'market' ? '/realms/gameplay/market-building-pixel.webp' : '/realms/gameplay/utility-buildings-pixel.webp';
/** Camera zoom range; the wheel moves in small steps, the buttons in bigger ones. Zooming out stops while the
 *  artwork still fills the screen (see `minZoom`). */
const MAX_ZOOM = 2.5;
/** Insula principală e mare: pornește micșorată, cu tot platoul în cadru. */
const HOME_ZOOM = 0.8;
/** Drawn building size; 260 was the original. The lift keeps the base on the same 3×3 footprint. */
const BUILDING_SIZE = 196,
  BUILDING_LIFT = Math.round((BUILDING_SIZE * 205) / 260);
export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  b: Building,
  texture?: HTMLImageElement | null,
  standalone = false,
  animationMs = 0,
) {
  const p = project(b.x + 1.5, b.y + 1.5);
  if (b.kind === 'workshop' && texture && standalone) {
    drawWorkshop(ctx, texture, animationMs, Math.round(p.x - BUILDING_SIZE / 2), Math.round(p.y - WORKSHOP_GROUND * BUILDING_SIZE), BUILDING_SIZE);
    return;
  }
  if (b.kind === 'farm' && texture && standalone) {
    drawFarm(ctx, texture, animationMs, Math.round(p.x - BUILDING_SIZE / 2), Math.round(p.y - FARM_GROUND * BUILDING_SIZE), BUILDING_SIZE);
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
    const residents = realm === 'home' ? [] : save.dinos.filter(d => d.element === realm);
    for (const d of residents) {
      const id = `${d.species}_${d.element}_${d.stage}`;
      if (animatedArt.current.has(id)) continue;
      loadAnimation(d.species, d.element, d.stage).then(async manifest => {
        if (!manifest || !active) return;
        const images = new Map<string, HTMLImageElement>();
        await Promise.all(Object.values(manifest.clips).flatMap(clips => Object.values(clips ?? {}))
          .map(async clip => { try { images.set(clip.sheet, await loadSpriteImage(clip.sheet)); } catch { /* Retain concept fallback. */ } }));
        if (active) {
          animatedArt.current.set(id, { manifest, images });
          setLoaded(n => n + 1);
        }
      });
    }
    return () => { active = false; animatedArt.current.clear(); };
  }, [realm, save.dinos]);
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
  const [viewport, setViewport] = useState({ width: SCENE.width, height: SCENE.height });
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
  const artSize = realm === 'home' ? HOME_ART : SCENE;
  const boundPan = (point: { x: number; y: number }, scale: number, view: { width: number; height: number }) =>
    constrainPan(point, scale, view, artSize);
  const cameraPan = boundPan(pan, zoom, viewport);
  // Zooming out stops while the artwork still covers the whole screen, so no empty margin ever shows.
  // Cerul de noapte se întinde dincolo de scenă, deci se poate micșora până se vede toată insula.
  const minZoom = 0.7;
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
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
        return Math.abs(p.x - q.x) < BUILDING_SIZE / 2 && p.y < q.y + 40 && p.y > q.y - BUILDING_LIFT;
      });
  // Target top-left cell for the held building, keeping the grab point under the pointer.
  const heldCell = (p: { x: number; y: number }, h: { ox: number; oy: number }) => {
    const c = unproject(p.x - h.ox, p.y - h.oy);
    return { x: c.x - 1, y: c.y - 1 };
  };
  const showGhost = placing || held !== null;
  const ghostId = held?.id ?? moving;
  useEffect(() => {
    const canvas = ref.current,
      host = canvas?.parentElement;
    if (!canvas || !host) return;
    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width)
        setResolution(Math.min(3, Math.max(1, Math.ceil((rect.width * (window.devicePixelRatio || 1)) / SCENE.width))));
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
    for (const kind of LEVELED) {
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
    return img ? [img, true] : [utilityArt.current[kind] ?? (kind === 'market' ? null : buildings.current), false];
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
  // The view shows only once its real artwork is in, so the drawn stand-ins never flash on screen.
  const needed =
    realm === 'home'
      ? [
          HOME_SRC,
          CONCEPTS_SRC,
          ...(['workshop', 'portal', 'arena', 'market'] as const)
            .filter((kind) => save.buildings.some((b) => b.kind === kind))
            .map(utilitySrc),
          ...LEVELED.map((kind) => tierArt(save, kind)).filter((art): art is string => !!art),
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
  useEffect(() => {
    const canvas = ref.current,
      ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const owned = realm === 'home' ? [] : save.dinos.filter((x) => x.element === realm);
    let raf = 0, lastPaint = -Infinity;
    const paint = (time: number) => {
    if (!document.hidden && (time - lastPaint >= 80 || reducedMotion || covered)) {
    lastPaint = time;
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
      ctx.fillRect(-480, -240, 2496, 1504);
      // stele pixel, fixe, cu o licărire lentă
      for (let i = 0; i < 110; i++) {
        const twinkle = reducedMotion ? 1 : 0.55 + 0.45 * Math.sin(time / 700 + i * 1.7);
        ctx.globalAlpha = (i % 4 ? 0.55 : 0.9) * twinkle;
        ctx.fillStyle = i % 5 ? '#ffffff' : glow;
        const sz = i % 7 ? 2 : 4;
        ctx.fillRect((((i * 317 + 43) % 2496) - 480) & ~1, (((i * 211 + 61) % 1504) - 240) & ~1, sz, sz);
      }
      ctx.globalAlpha = 1;
    }
    // insula plutește ușor (2 px de scenă = 1 pixel de artă, deci rămâne pe grilă)
    const bob = reducedMotion || realm === 'home' ? 0 : Math.round(Math.sin(time / 1400) * 2) * 2;
    if (realm === 'home') {
      if (image.current)
        ctx.drawImage(image.current, HOME_ISLAND.offset[0], HOME_ISLAND.offset[1], HOME_ISLAND.size[0] * 2, HOME_ISLAND.size[1] * 2);
    } else {
      const environment = worlds.current[realm];
      if (environment) {
        const isl = ISLANDS[realm];
        ctx.drawImage(environment, isl.offset[0], isl.offset[1] + bob, isl.size[0] * isl.scale, isl.size[1] * isl.scale);
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
    if (realm === 'home')
      [...save.buildings]
        .sort((a, b) => a.x + a.y - b.x - b.y)
        .forEach((b) => {
          if (b.id === held?.id) ctx.globalAlpha = 0.3;
          drawBuilding(ctx, b, ...artFor(b.kind as UtilityKind), reducedMotion ? 0 : time);
          if (b.kind !== 'farm' && b.kind !== 'workshop') drawBuildingEffect(ctx, b.kind, project(b.x + 1.5, b.y + 1.5).x, project(b.x + 1.5, b.y + 1.5).y, reducedMotion ? 0 : time);
          ctx.globalAlpha = 1;
        });
    if (realm === 'home')
      for (let i = 0; i < save.lanterns; i++) {
        const p = project(2 + i * 2, 10);
        ctx.fillStyle = '#584332';
        ctx.fillRect(p.x - 3, p.y - 32, 6, 32);
        ctx.fillStyle = '#f6d277';
        ctx.fillRect(p.x - 8, p.y - 43, 16, 13);
        ctx.fillStyle = '#fff0af';
        ctx.fillRect(p.x - 4, p.y - 40, 8, 7);
      }
    // Worlds show only the dinosaurs the player owns there.
    if (realm !== 'home')
      owned.forEach((x, i) => {
        const spots = ISLANDS[realm as RealmId].spots;
        const anchor = spots[i % spots.length];
        const phase = reducedMotion ? 0 : ((time + i * 1700) % 10000) / 1000;
        const walking = (phase >= 3 && phase < 5) || phase >= 8;
        const returning = phase >= 8;
        const travel = phase < 3 ? 0 : phase < 5 ? (phase - 3) / 2 : phase < 8 ? 1 : 1 - (phase - 8) / 2;
        const art = animatedArt.current.get(`${x.species}_${x.element}_${x.stage}`);
        const facing = 'se';
        const clip = art?.manifest.clips[facing]?.[walking ? 'walk' : 'idle'];
        const sheet = clip && art?.images.get(clip.sheet);
        const p = { x: anchor.x + (sheet ? travel * 64 : 0), y: anchor.y };
        if (clip && sheet && art) {
          const size = x.stage === 'baby' ? 128 : x.stage === 'juvenile' ? 176 : 224;
          const m = art.manifest;
          const factor = size / m.sourceSize.height;
          ctx.save();
          ctx.translate(Math.round(p.x), Math.round(p.y));
          if (returning) ctx.scale(-1, 1);
          const clipTime = walking ? (phase - (returning ? 8 : 3)) * 1000 : time + i * 137;
          drawSprite(ctx, sheet, clip, frameAt(clip, reducedMotion ? 0 : clipTime),
            -m.pivot.x * factor, -m.pivot.y * factor, m.sourceSize.width * factor, size);
          ctx.restore();
        }
        const label = `${x.id === save.champion ? '★ ' : ''}${x.nickname} · ${x.level}`;
        ctx.font = "600 13px 'Pixelify Sans', sans-serif";
        ctx.textAlign = 'center';
        const width = ctx.measureText(label).width + 16;
        ctx.fillStyle = '#183342';
        ctx.fillRect(p.x - width / 2, p.y + 4, width, 22);
        ctx.fillStyle = '#f6dfae';
        ctx.fillText(label, p.x, p.y + 19);
      });
    if (cell && showGhost) {
      const p = project(cell.x, cell.y),
        valid = canPlace(save, cell.x, cell.y, ghostId ?? undefined),
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
    ctx.restore();
    }
    if (!reducedMotion && !covered) raf = requestAnimationFrame(paint);
    };
    paint(performance.now());
    const resume = () => { if (!document.hidden) { cancelAnimationFrame(raf); lastPaint = -Infinity; paint(performance.now()); } };
    document.addEventListener('visibilitychange', resume);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', resume); };
  }, [
    save.buildings,
    save.dinos,
    save.champion,
    save.lanterns,
    loaded,
    placing,
    moving,
    held,
    resolution,
    placementKind,
    cell,
    zoom,
    cameraPan.x,
    cameraPan.y,
    realm,
    reducedMotion,
    covered,
  ]);
  const here = realm === 'home' ? [] : save.dinos.filter((x) => x.element === realm);
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
      x: (((e.clientX - r.left) / r.width) * 1536 - 768 - cameraPan.x) / zoom + 768,
      y: (((e.clientY - r.top) / r.height) * 1024 - 512 - cameraPan.y) / zoom + 512,
    };
  };
  return (
    <div
      className={`realm-world${held ? ' holding' : ''}${panning ? ' panning' : ''}${placing ? ' placing' : ''}${hovering ? ' hovering' : ''}${ready ? '' : ' loading'}`}
      data-realm={realm}
      data-residents={here.length}
      data-preview-residents={0}
      data-dinosaur-art-ready={realm === 'home' || save.dinos.filter(d => d.element === realm).every(d => animatedArt.current.has(`${d.species}_${d.element}_${d.stage}`))}
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
        width={1536 * resolution}
        height={1024 * resolution}
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
          drag.current = { x: e.clientX, y: e.clientY, px: cameraPan.x, py: cameraPan.y, moved: false };
          const p = coords(e);
          setCell(unproject(p.x, p.y));
          cancelHold();
          const b = !placing && realm === 'home' && onMove ? buildingAt(p) : undefined;
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
                ? !!buildingAt(p)
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
              setPan(boundPan({ x: d.px + (dx * 1536) / r.width, y: d.py + (dy * 1024) / r.height }, zoom, viewport));
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
          const d = drag.current;
          drag.current = null;
          setPanning(false);
          cancelHold();
          if (held) {
            const c = heldCell(coords(e), held),
              b = save.buildings.find((b) => b.id === held.id);
            setHeld(null);
            setCell(null);
            if (b && (b.x !== c.x || b.y !== c.y)) onMove?.(held.id, c.x, c.y);
            return;
          }
          if (d?.moved) return;
          const p = coords(e),
            c = unproject(p.x, p.y);
          if (placing) return onPlace(c.x, c.y);
          const picked = here.find((x, i) => {
            const dp = OWNED_SPOTS[i % OWNED_SPOTS.length];
            return Math.abs(p.x - dp.x) < 60 && p.y > dp.y - STAGE_HEIGHT[x.stage] && p.y < dp.y + 25;
          });
          if (picked) return onSelect(`dino:${picked.id}`);
          if (realm !== 'home') return onSelect('collection');
          const b = buildingAt(p);
          if (b) onSelect(b.id);
        }}
        onPointerLeave={() => setHovering(false)}
        onPointerCancel={(e) => {
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
      {realm !== 'home' && (
        <button className="world-resident-book" onClick={() => onSelect('collection')}>
          {here.length
            ? `🦖 ${here.length} · ${lang ? 'Your dinosaurs here' : 'Dinozaurii tăi de aici'}`
            : lang
              ? 'No dinosaurs here yet · Market →'
              : 'Niciun dinozaur aici încă · Piață →'}
          <span className="sr-only">{SPECIES.map((s) => SPECIES_NAMES[s]).join(', ')}</span>
        </button>
      )}
      {!showGhost && (
        <div className="realm-object-overlay">
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
            <button
              className="production-bubble ready"
              style={{
                // Top-right of the platform, clear of the dinosaurs' spots.
                left: `${((768 + (1180 - 768) * zoom + cameraPan.x) / 1536) * 100}%`,
                top: `${((512 + (330 - 512) * zoom + cameraPan.y) / 1024) * 100}%`,
              }}
              onClick={() => onSelect('income')}
            >
              ● {Math.floor(advance(save, now).storedGold)}
            </button>
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
        <button onClick={() => zoomAt(zoom + 0.5)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
          +
        </button>
        <button onClick={() => zoomAt(zoom - 0.5)} disabled={zoom <= minZoom + 0.001} aria-label="Zoom out">
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
