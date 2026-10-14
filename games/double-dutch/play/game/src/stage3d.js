// Where the street picture sits on screen for each scene, and the 2D geometry the HUD uses when the 3D presenter is active.
import { fit3 } from './geo3d.js';

// The rectangle (virtual units) the three-quarter view is fitted to.
export function stageRect(st, L) {
  if (st.scene === 'play') return L.play.stage;
  const wide = L.mode === 'wide', T = L.title;
  if (st.scene === 'title') return wide ? { x: T.hero.x, y: T.hero.y + T.hero.h * 0.3, w: T.hero.w, h: T.hero.h * 0.7 } : { x: 0, y: T.hero.y + T.hero.h * 0.3, w: L.w, h: T.hero.h * 0.7 };
  return { x: 0, y: L.h * 0.26, w: L.w, h: L.h * 0.74 };
}
// HUD geometry in 3D mode: same fields as art.stageGeo (k = the jumper's height on screen, gy = feet, jx = middle).
export const geo3 = (rect) => fit3(rect).g;
