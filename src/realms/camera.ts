import home from './islands/home.json';
export const SCENE = { width: 1536, height: 1024 };
/** Include the current island's full extents around the camera's scene center. */
export const HOME_ART = {
  width: 2 * Math.max(SCENE.width / 2 - home.offset[0], home.offset[0] + home.size[0] * home.scale - SCENE.width / 2),
  height: 2 * Math.max(SCENE.height / 2 - home.offset[1], home.offset[1] + home.size[1] * home.scale - SCENE.height / 2),
};
export interface Point {
  x: number;
  y: number;
}
export interface Viewport {
  width: number;
  height: number;
}

/** The home sky fills the viewport; allow panning over it while keeping part of the island visible. */
export function constrainHomePan(pan: Point, zoom: number, viewport: Viewport): Point {
  const visibleX = Math.min(128, viewport.width / 4, home.size[0] * home.scale * zoom / 4);
  const visibleY = Math.min(128, viewport.height / 4, home.size[1] * home.scale * zoom / 4);
  const left = (home.offset[0] - SCENE.width / 2) * zoom;
  const right = (home.offset[0] + home.size[0] * home.scale - SCENE.width / 2) * zoom;
  const top = (home.offset[1] - SCENE.height / 2) * zoom;
  const bottom = (home.offset[1] + home.size[1] * home.scale - SCENE.height / 2) * zoom;
  return {
    x: Math.max(-viewport.width / 2 + visibleX - right, Math.min(viewport.width / 2 - visibleX - left, pan.x)),
    y: Math.max(-viewport.height / 2 + visibleY - bottom, Math.min(viewport.height / 2 - visibleY - top, pan.y)),
  };
}

/** Pan uses canvas units after zoom; only the part visible through the viewport needs coverage. */
export function constrainPan(pan: Point, zoom: number, viewport: Viewport, artwork: Viewport = SCENE): Point {
  const limitX = Math.max(0, (artwork.width * zoom - viewport.width) / 2);
  const limitY = Math.max(0, (artwork.height * zoom - viewport.height) / 2);
  return { x: Math.max(-limitX, Math.min(limitX, pan.x)), y: Math.max(-limitY, Math.min(limitY, pan.y)) };
}
