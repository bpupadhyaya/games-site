// Hand-off between the 2D screens (view.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never reads
// this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D art is
// the fallback for no WebGL, a lost context and the headless tests).
import { pathPoint } from './layout.js';

export const v3 = {
  on: false,
  fade: 1,        // 0..1 right after the 3D scene takes over: the flat art fades out on top of it (crossfade)
  tp: null,       // (x, y, h) trail-plane point (canonical units, h = height above the ground) -> [x, y] in the trail band's frame
  mp: null,       // the same for the felt mat
  minv: null,     // (bx, by) a point in the mat band's frame -> [x, y] on the mat plane (canonical mat units)
  tokens: [],     // riders the 2D layer wants drawn this frame: { i, s (arc length), k, n (slot among n at the station), lift, turn, win, fly }
  bones: [],      // ankle bones: { i, x, y, rot, lift, face, roll?, hold, alpha, hint }
  mode: '',
};
// Alpha for the flat backdrop layers: 1 without 3D, fading to 0 during the crossfade, then 0.
export const flatAlpha = () => (v3.on ? Math.max(0, 1 - v3.fade) : 1);
export const Tp = (x, y, h = 0) => (v3.on && v3.tp ? v3.tp(x, y, h) : [x, y]);
export const Mp = (x, y, h = 0) => (v3.on && v3.mp ? v3.mp(x, y, h) : [x, y]);

// where rider k of n standing on arc length s sits: along the trail, a little to alternate sides (canonical ground units, + heading)
export function slotPos(s, k = 0, n = 1) {
  const p = pathPoint(s);
  if (n <= 1) return { x: p.x, y: p.y, ang: p.ang };
  const off = (k - (n - 1) / 2) * 23, lat = (k % 2 ? 1 : -1) * 7, c = Math.cos(p.ang), sn = Math.sin(p.ang);
  return { x: p.x + c * off - sn * lat, y: p.y + sn * off + c * lat, ang: p.ang };
}
