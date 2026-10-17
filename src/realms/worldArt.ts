import type { RealmId } from './game';

export const worldArt = (realm: RealmId) => `/realms/worlds/${realm}-wide-v1.webp`;
/** 480 px preview for cards (scripts/realms-images.py), so lists never download the full landscapes. */
export const worldThumb = (realm: RealmId) => `/realms/worlds/${realm}-thumb.webp`;
/** Retain the saved grid while drawing wide landscapes centered behind it. */
export const worldArtSize = (image: Pick<HTMLImageElement, 'naturalWidth' | 'naturalHeight'>) => ({
  width: (image.naturalWidth / image.naturalHeight) * 1024,
  height: 1024,
});
