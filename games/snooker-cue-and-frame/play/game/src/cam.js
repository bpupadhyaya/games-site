// The fixed table camera: a true pinhole perspective looking up the table from behind the baulk end. It is built once per
// layout and never changes while the table is on screen. proj() maps a table point (metres, z up) to the screen;
// unproj() maps a screen point back onto the cloth; ballR() is the drawn radius of a ball at table position y.
import { TW, TL, R } from './sim.js';
import { W } from './layout.js';

export const MARGIN = 0.13;            // visible wooden rail around the cushions (m)
const DIST = 7.2;

function frame(phi, dist) {
  const c = Math.cos(phi), s = Math.sin(phi), yT = TL / 2;
  const E = [TW / 2, yT - dist * c, dist * s];
  // camera axes (right = +x)
  const F = [0, c, -s], U = [0, s, c];
  const proj1 = (x, y, z) => {
    const rx = x - E[0], ry = y - E[1], rz = z - E[2];
    const zc = ry * F[1] + rz * F[2], yc = ry * U[1] + rz * U[2];
    return { u: rx / zc, v: -yc / zc, zc };
  };
  return { E, F, U, proj1 };
}
function extents(phi, dist) {
  const fr = frame(phi, dist);
  const nl = fr.proj1(-MARGIN, -MARGIN, 0), nr = fr.proj1(TW + MARGIN, -MARGIN, 0), far = fr.proj1(-MARGIN, TL + MARGIN, 0);
  return { wn: nr.u - nl.u, h: nl.v - far.v, vTop: far.v, vBot: nl.v, fr };
}

export function makeCamera(top, bottom, maxW = W - 6) {
  const rh = bottom - top;
  const g = (phi) => { const e = extents(phi, DIST); return { fW: maxW / e.wn, fH: rh / e.h, e }; };
  let lo = 0.62, hi = 1.25;                                       // pitch range (radians)
  const a = g(lo), b = g(hi);
  let phi;
  if (a.fH - a.fW <= 0) phi = lo;                               // even the flattest view is too tall: fit the height
  else if (b.fH - b.fW >= 0) phi = hi;
  else { for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; const r = g(mid); if (r.fH - r.fW > 0) lo = mid; else hi = mid; } phi = (lo + hi) / 2; }
  const { fW, fH, e } = g(phi);
  const f = Math.min(fW, fH);
  const cy = (top + bottom) / 2 - f * (e.vTop + e.vBot) / 2;
  const fr = e.fr;
  const cx = W / 2;
  const proj = (x, y, z = 0) => { const p = fr.proj1(x, y, z); return { X: cx + f * p.u, Y: cy + f * p.v, d: p.zc }; };
  const px = (x, y, z = 0) => { const p = fr.proj1(x, y, z); return [cx + f * p.u, cy + f * p.v]; };
  const unproj = (sx, sy) => {
    const a2 = (sx - cx) / f, b2 = -(sy - cy) / f;
    const dir = [a2, b2 * fr.U[1] + fr.F[1], b2 * fr.U[2] + fr.F[2]];
    const t = -fr.E[2] / dir[2];
    return { x: fr.E[0] + dir[0] * t, y: fr.E[1] + dir[1] * t };
  };
  const ballR = (y) => { const p = fr.proj1(TW / 2, y, R); return f * R / p.zc; };
  const scaleAt = (y) => { const p = fr.proj1(TW / 2, y, 0); return f / p.zc; };
  return { top, bottom, f, cy, phi, proj, px, unproj, ballR, scaleAt, E: fr.E };
}
