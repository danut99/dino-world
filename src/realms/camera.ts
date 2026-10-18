export const SCENE = { width: 1536, height: 1024 };
// Wider art is centered on the existing grid, keeping saved building coordinates stable.
/** The home island, composed from PixelLab tiles at 910×512 art pixels and drawn at 2 scene pixels per art pixel. */
export const HOME_ART = { width: 1820, height: 1024 };
export interface Point {
  x: number;
  y: number;
}
export interface Viewport {
  width: number;
  height: number;
}

/** Pan uses canvas units after zoom; only the part visible through the viewport needs coverage. */
export function constrainPan(pan: Point, zoom: number, viewport: Viewport, artwork: Viewport = SCENE): Point {
  const limitX = Math.max(0, (artwork.width * zoom - viewport.width) / 2);
  const limitY = Math.max(0, (artwork.height * zoom - viewport.height) / 2);
  return { x: Math.max(-limitX, Math.min(limitX, pan.x)), y: Math.max(-limitY, Math.min(limitY, pan.y)) };
}
