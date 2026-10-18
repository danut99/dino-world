import type { RealmId, Species, Stage } from './game';
import inventory from './animation-inventory.json';

export type Clip = 'idle' | 'walk' | 'attack' | 'defend' | 'hurt' | 'death' | 'ultimate';
export type Facing = 'se' | 'ne';
export type SpriteClip = {
  sheet: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  durationsMs: number[];
  loop: boolean;
  impactFrame?: number;
};
export type SpriteManifest = {
  schemaVersion: 1;
  variantId: string;
  stage: Stage;
  status: 'prototype' | 'ready';
  sourceSize: { width: number; height: number };
  pivot: { x: number; y: number };
  clips: Partial<Record<Facing, Partial<Record<Clip, SpriteClip>>>>;
};
export const STAGE_CLIPS: Record<Stage, Clip[]> = {
  baby: ['idle', 'walk'],
  juvenile: ['idle', 'walk', 'attack', 'defend', 'hurt', 'death'],
  adult: ['idle', 'walk', 'attack', 'defend', 'hurt', 'death', 'ultimate'],
};
export function validateManifest(m: SpriteManifest): SpriteManifest {
  if (
    m.schemaVersion !== 1 ||
    !STAGE_CLIPS[m.stage] ||
    !Number.isFinite(m.pivot.x) ||
    !Number.isFinite(m.pivot.y) ||
    !Number.isInteger(m.sourceSize.width) ||
    !Number.isInteger(m.sourceSize.height) ||
    m.sourceSize.width < 1 ||
    m.sourceSize.width > 2048 ||
    m.sourceSize.height < 1 ||
    m.sourceSize.height > 2048 ||
    m.pivot.x < 0 ||
    m.pivot.x > m.sourceSize.width ||
    m.pivot.y < 0 ||
    m.pivot.y > m.sourceSize.height
  )
    throw new Error('Invalid dinosaur animation manifest');
  for (const direction of Object.values(m.clips))
    for (const [name, clip] of Object.entries(direction ?? {})) {
      if (
        !STAGE_CLIPS[m.stage].includes(name as Clip) ||
        !clip.sheet.startsWith('/realms/animations/') ||
        !Number.isInteger(clip.columns) ||
        clip.columns < 1 ||
        clip.frameWidth !== m.sourceSize.width ||
        clip.frameHeight !== m.sourceSize.height ||
        clip.columns * clip.frameWidth > 2048 ||
        Math.ceil(clip.durationsMs.length / clip.columns) * clip.frameHeight > 2048 ||
        !clip.durationsMs.length ||
        clip.durationsMs.some((ms) => !Number.isFinite(ms) || ms <= 0) ||
        (clip.impactFrame !== undefined && (clip.impactFrame < 0 || clip.impactFrame >= clip.durationsMs.length))
      )
        throw new Error(`Invalid ${m.variantId}/${m.stage}/${name} animation`);
    }
  return m;
}
/** Duration-aware sampling. One-shot clips retain their final pose. */
export function frameAt(clip: SpriteClip, elapsed: number) {
  const total = clip.durationsMs.reduce((a, b) => a + b, 0);
  let t = Math.max(0, elapsed);
  if (clip.loop) t %= total;
  for (let i = 0; i < clip.durationsMs.length; i++) {
    if (t < clip.durationsMs[i]) return i;
    t -= clip.durationsMs[i];
  }
  return clip.durationsMs.length - 1;
}

// Explicit inventory: concept sheets never masquerade as finished animation.
const AVAILABLE = new Set<string>(inventory);
const manifests = new Map<string, Promise<SpriteManifest | null>>();
export function loadAnimation(species: Species, element: RealmId, stage: Stage) {
  const id = `${species}_${element}_${stage}`;
  if (!AVAILABLE.has(id)) return Promise.resolve(null);
  return loadManifest(id);
}
export const ANIMATED_BOSS_ELEMENTS = ['fire', 'water', 'earth', 'nature', 'lightning'] as const;
export function loadBossAnimation(element: RealmId) {
  return ANIMATED_BOSS_ELEMENTS.some(id => id === element)
    ? loadManifest(`boss_${element}_adult`) : Promise.resolve(null);
}
function loadManifest(id: string) {
  if (!manifests.has(id))
    manifests.set(
      id,
      fetch(`/realms/animations/${id}/manifest.json`)
        .then(async (r) => {
          if (!r.ok) return null;
          return validateManifest(await r.json());
        })
        .catch(() => null),
    );
  return manifests.get(id)!;
}
const images = new Map<string, Promise<HTMLImageElement>>();
export function loadSpriteImage(src: string) {
  if (images.size >= 24 && !images.has(src)) images.delete(images.keys().next().value!);
  if (!images.has(src))
    images.set(
      src,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      }),
    );
  return images.get(src)!;
}
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  clip: SpriteClip,
  frame: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.drawImage(
    image,
    (frame % clip.columns) * clip.frameWidth,
    Math.floor(frame / clip.columns) * clip.frameHeight,
    clip.frameWidth,
    clip.frameHeight,
    Math.round(x),
    Math.round(y),
    Math.round(width),
    Math.round(height),
  );
}
