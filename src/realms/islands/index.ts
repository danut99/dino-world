import type { RealmId } from '../game';
import arcane from './arcane.json';
import dark from './dark.json';
import earth from './earth.json';
import fire from './fire.json';
import ice from './ice.json';
import light from './light.json';
import lightning from './lightning.json';
import nature from './nature.json';
import water from './water.json';
import wind from './wind.json';

/** One elemental world: a whole floating island generated with PixelLab (scripts/fit-island.py fitted its grid). */
export interface Island {
  plateau: { top: number[]; right: number[]; bottom: number[]; left: number[] };
  art: string;
  /** Art size in art pixels; drawn at `scale` scene pixels per art pixel, at `offset` in the 1536×1024 scene. */
  size: number[];
  offset: number[];
  scale: number;
  grid: { x: number; y: number; w: number; h: number };
  cells: number;
  buildable: number[][];
  /** Where resident dinosaurs stand and wander, in scene pixels. */
  spots: { x: number; y: number }[];
}
export const ISLANDS: Record<RealmId, Island> = { arcane, dark, earth, fire, ice, light, lightning, nature, water, wind };
/** Night sky behind each island: top and bottom of the gradient, plus the tint of its drifting clouds and stars. */
export const SKIES: Record<RealmId, [string, string, string]> = {
  fire: ['#1a0f22', '#4a1d24', '#ff8a4a'],
  water: ['#0f1d3d', '#1f4d73', '#9ee8ff'],
  earth: ['#1c1530', '#4a2a2a', '#ffc98a'],
  nature: ['#0f1a2e', '#1d3d3a', '#b6f0a0'],
  ice: ['#101a36', '#2a4a78', '#dff6ff'],
  lightning: ['#110f26', '#2b2850', '#ffe14d'],
  wind: ['#14203f', '#3b5d86', '#ffffff'],
  dark: ['#0d0a1c', '#2a1a48', '#c38bff'],
  light: ['#1a1838', '#4a3f5a', '#ffe7a3'],
  arcane: ['#120c2a', '#3a1f5c', '#7ef3ff'],
};
