import type { RealmId } from './game';

import { ISLANDS } from './islands';

export const worldArt = (realm: RealmId) => ISLANDS[realm].art;
/** 480 px preview for cards (scripts/realms-images.py), so lists never download the full landscapes. */
export const worldThumb = (realm: RealmId) => `/realms/worlds/${realm}-island-thumb.png`;
/** Retain the saved grid while drawing wide landscapes centered behind it. */
export const worldArtSize = (image: Pick<HTMLImageElement, 'naturalWidth' | 'naturalHeight'>) => ({
  width: (image.naturalWidth / image.naturalHeight) * 1024,
  height: 1024,
});
