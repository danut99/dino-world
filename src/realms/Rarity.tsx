import { RARITY_NAMES, type Rarity } from './game';
import './rarity.css';

/** The rarity as a small coloured tag: grey, blue, purple or gold. */
export function RarityBadge({ rarity = 'common', lang, short = false }: { rarity?: Rarity; lang: number; short?: boolean }) {
  const name = RARITY_NAMES[rarity][lang];
  return (
    <span className={`rarity-badge rarity-${rarity}`} title={name}>
      {short ? name[0] : name}
    </span>
  );
}
/** Class for a dinosaur's art or name, so rare ones get a coloured outline and epic ones a pulsing glow. */
export const rarityClass = (rarity: Rarity = 'common') => `rarity-${rarity}`;
/** Colours for canvas drawing (the island labels): background, text and glow. */
export const RARITY_CANVAS: Record<Rarity, { bg: string; text: string; glow?: string }> = {
  common: { bg: '#183342', text: '#f6dfae' },
  rare: { bg: '#163a6b', text: '#cfe6ff', glow: '#4aa3ff' },
  epic: { bg: '#3f1f6a', text: '#ecd7ff', glow: '#b26bff' },
  legendary: { bg: '#5e3f0c', text: '#fff1b8', glow: '#ffc94a' },
};
