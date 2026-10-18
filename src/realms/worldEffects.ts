import type { RealmId } from './game';
import type { UtilityKind } from './content';

/** Separate, deterministic pixel effects. Terrain and building silhouettes stay fixed. */
export function drawRealmAtmosphere(ctx: CanvasRenderingContext2D, realm: 'home' | RealmId, ms: number) {
  const tick = Math.floor(ms / 100);
  const palette: Record<'home' | RealmId, string[]> = {
    home: ['#e9f6b4', '#a8e7cb'],
    fire: ['#ffcc70', '#f4774c'],
    water: ['#c0f5ff', '#7ad5ec'],
    earth: ['#efdb9d', '#c7a969'],
    nature: ['#d1ed9e', '#8ac69b'],
    ice: ['#eefaff', '#b2e2fa'],
    lightning: ['#f6e995', '#b69cff'],
    wind: ['#d7fff1', '#a0dec8'],
    dark: ['#d1a2ff', '#ab88db'],
    light: ['#fff4ba', '#f0d685'],
    arcane: ['#d4adff', '#83e9ec'],
  };
  ctx.save();
  // Sparse foreground motes, away from the buildable island centre.
  for (let i = 0; i < 28; i++) {
    const snow = realm === 'ice' || realm === 'water';
    const x = ((i * 317 + Math.floor(tick * (realm === 'wind' ? 5 : 1.2))) % 1836) - 150;
    const y = ((((i * 139 + (snow ? tick * 3 : -tick * 2)) % 1124) + 1124) % 1124) - 50;
    if (x > 360 && x < 1170 && y > 280 && y < 730) continue;
    ctx.globalAlpha = 0.3 + ((i + tick) % 8) / 16;
    ctx.fillStyle = palette[realm][i % 2];
    ctx.fillRect(Math.round(x), Math.round(y), realm === 'wind' ? 8 : 3, 3);
    if (realm === 'ice' && i % 3 === 0) ctx.fillRect(Math.round(x) + 1, Math.round(y) - 2, 1, 7);
  }
  ctx.restore();
}

export function drawBuildingEffect(
  ctx: CanvasRenderingContext2D,
  kind: UtilityKind | 'habitat',
  x: number,
  y: number,
  ms: number,
) {
  const tick = Math.floor(ms / 120);
  ctx.save();
  if (kind === 'workshop' || kind === 'hatchery') {
    for (let i = 0; i < 4; i++) {
      const age = (tick + i * 5) % 24;
      ctx.globalAlpha = (1 - age / 24) * 0.55;
      ctx.fillStyle = kind === 'workshop' ? '#c8bdd8' : '#ffe8b5';
      ctx.fillRect(
        Math.round(x - 25 + Math.floor(age / 6) * 3),
        Math.round(y - 140 - age * 2),
        5 + Math.floor(age / 5),
        5,
      );
    }
  } else if (kind === 'portal' || kind === 'arena') {
    for (let i = 0; i < 8; i++) {
      const a = ((tick % 32) / 32) * Math.PI * 2 + (i * Math.PI) / 4;
      ctx.fillStyle = i % 2 ? '#bda4ff' : '#a6f0e0';
      ctx.globalAlpha = 0.7;
      ctx.fillRect(Math.round(x + Math.cos(a) * 24), Math.round(y - 94 + Math.sin(a) * 37), 4, 4);
    }
  } else if (kind === 'farm') {
    ctx.fillStyle = '#e6f4a2';
    for (let i = 0; i < 3; i++) {
      const age = (tick + i * 8) % 28;
      ctx.globalAlpha = (1 - age / 28) * 0.7;
      ctx.fillRect(Math.round(x - 34 + i * 30), Math.round(y - 50 - age), 3, 5);
    }
  } else if (kind === 'market') {
    ctx.globalAlpha = 0.5 + (tick % 8) / 20;
    ctx.fillStyle = '#ffe5a0';
    ctx.fillRect(Math.round(x - 40), Math.round(y - 77), 4, 6);
    ctx.fillRect(Math.round(x + 40), Math.round(y - 77), 4, 6);
  }
  ctx.restore();
}
