// The fixed table camera: a true pinhole perspective looking at the table from one end or one long side. It is built once per layout
// and never changes while the table is on screen. px() maps a table point (metres, z up) to the screen; unproj() maps a screen
// point back onto the cloth; ballR(y, x) is the drawn radius of a ball at that table position.
//   orient 'v': the table stands up the screen, seen from the baulk end (the approved phone look).
//   orient 'h': the table lies across the screen (baulk end on the left), seen from the long side nearest the bottom of the screen;
//               a pure 90-degree turn of the same scene (no mirroring), used by the landscape and tablet layouts.
import { TW, TL, R } from './sim.js';

export const MARGIN = 0.10;            // visible wooden rail around the cushions (m)
const DIST = 7.2;

function frame(phi, dist, TA, TD) {
  const c = Math.cos(phi), s = Math.sin(phi), dT = TD / 2;
  const E = [TA / 2, dT - dist * c, dist * s];
  const F = [0, c, -s], U = [0, s, c];
  const proj1 = (a, d, z) => {
    const rx = a - E[0], ry = d - E[1], rz = z - E[2];
    const zc = ry * F[1] + rz * F[2], yc = ry * U[1] + rz * U[2];
    return { u: rx / zc, v: -yc / zc, zc };
  };
  return { E, F, U, proj1 };
}
function extents(phi, dist, TA, TD) {
  const fr = frame(phi, dist, TA, TD);
  const nl = fr.proj1(-MARGIN, -MARGIN, 0), nr = fr.proj1(TA + MARGIN, -MARGIN, 0), far = fr.proj1(-MARGIN, TD + MARGIN, 0);
  return { wn: nr.u - nl.u, h: nl.v - far.v, vTop: far.v, vBot: nl.v, fr };
}

// region: { x, y, w, h } the table must fit inside (screen units).
export function makeCamera(region, orient = 'v') {
  const horiz = orient === 'h';
  const TA = horiz ? TL : TW, TD = horiz ? TW : TL;                      // across / depth extent in camera terms
  const toCam = horiz ? (x, y) => [y, TW - x] : (x, y) => [x, y];
  const fromCam = horiz ? (a, d) => ({ x: TW - d, y: a }) : (a, d) => ({ x: a, y: d });
  const maxW = region.w - 6, rh = region.h;
  const g = (phi) => { const e = extents(phi, DIST, TA, TD); return { fW: maxW / e.wn, fH: rh / e.h, e }; };
  let lo = 0.62, hi = horiz ? 1.5 : 1.25;                                // pitch range (radians)
  const a = g(lo), b = g(hi);
  let phi;
  if (a.fH - a.fW <= 0) phi = lo;                                       // even the flattest view is too tall: fit the height
  else if (b.fH - b.fW >= 0) phi = hi;
  else { for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; const r = g(mid); if (r.fH - r.fW > 0) lo = mid; else hi = mid; } phi = (lo + hi) / 2; }
  const { fW, fH, e } = g(phi);
  const f = Math.min(fW, fH);
  const cy = region.y + region.h / 2 - f * (e.vTop + e.vBot) / 2;
  const cx = region.x + region.w / 2;
  const fr = e.fr;
  const proj = (x, y, z = 0) => { const [a2, d2] = toCam(x, y); const p = fr.proj1(a2, d2, z); return { X: cx + f * p.u, Y: cy + f * p.v, d: p.zc }; };
  const px = (x, y, z = 0) => { const [a2, d2] = toCam(x, y); const p = fr.proj1(a2, d2, z); return [cx + f * p.u, cy + f * p.v]; };
  const unproj = (sx, sy) => {
    const a2 = (sx - cx) / f, b2 = -(sy - cy) / f;
    const dir = [a2, b2 * fr.U[1] + fr.F[1], b2 * fr.U[2] + fr.F[2]];
    const t = -fr.E[2] / dir[2];
    return fromCam(fr.E[0] + dir[0] * t, fr.E[1] + dir[1] * t);
  };
  const ballR = (y, x = TW / 2) => { const [a2, d2] = toCam(x, y); const p = fr.proj1(a2, d2, R); return f * R / p.zc; };
  const scaleAt = (y, x = TW / 2) => { const [a2, d2] = toCam(x, y); const p = fr.proj1(a2, d2, 0); return f / p.zc; };
  return { region, top: region.y, bottom: region.y + region.h, orient, f, cx, cy, phi, proj, px, unproj, ballR, scaleAt, E: fr.E };
}
