// The opponent and the hint. A planner tries many strikes (every edge of the target, a few sideways offsets and gaps, a ladder of
// strengths and twists), scores each by how often a ring of fixed scatter samples would flip the tile, and picks the best.
// Rivals score their own estimate with noise and add hand tremor when they throw; the hint uses the exact best, no noise.
import { quickQ, scatterSigma, MAT, clampMat, hinge, clamp, wrapPi, yawFor, lift } from './sim.js';

let QC = null;   // the lift quality at which the pivot just flips (found by bisection over the real integration)
export const flipQ = () => {
  if (QC !== null) return QC;
  let lo = 0.3, hi = 2.5;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (hinge(m).flipped) hi = m; else lo = m; }
  QC = hi; return QC;
};

const gauss = (rng) => (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 1.732;

export function plan(target, massA, prof, rng, o = {}) {
  const perfect = !!o.perfect, noise = perfect ? 0 : prof.noise, qc = flipQ();
  const samples = []; for (let i = 0; i < 18; i++) samples.push([gauss(rng), gauss(rng), rng.next()]);
  const cands = [];
  const c = Math.cos(target.yaw), s = Math.sin(target.yaw);
  for (let e = 0; e < 4; e++) {
    const a = e * Math.PI / 2, nx = Math.cos(a), ny = Math.sin(a), tx = -ny, ty = nx;
    for (const lat of [-0.22, 0, 0.22]) for (const gap of [0.03, 0.14, 0.28]) {
      const d = 1.0 + gap, lx = nx * d + tx * lat, ly = ny * d + ty * lat;
      const x = target.x + lx * c - ly * s, y = target.y + lx * s + ly * c;
      if (x < MAT.x0 + 0.5 || x > MAT.x1 - 0.5 || y < MAT.y0 + 0.5 || y > MAT.y1 - 0.2) continue;
      for (let si = 0; si < 9; si++) for (const w of [-1, -0.5, 0, 0.5, 1]) cands.push({ x, y, s: 0.5 + si * 0.05, w });
    }
  }
  let best = null; const scored = [];
  for (const k of cands) {
    const sg = scatterSigma(k.s, k.w, perfect ? 0 : prof.tremor);
    let wins = 0;
    for (const sm of samples) {
      const m = clampMat(k.x + sm[0] * sg, k.y + sm[1] * sg);
      const yaw = yawFor(m.x, m.y, k.w);
      const L = lift({ px: m.x, py: m.y, yaw, s: k.s, w: k.w, flat: 0.9 + sm[2] * 0.2 }, target, massA);
      if (L.kind === 'ok' && L.Q >= qc) wins++;
    }
    const p = wins / samples.length, score = p + (noise ? gauss(rng) * noise * 0.5 : 0);
    const item = { ...k, p, score };
    scored.push(item);
    if (!best || score > best.score) best = item;
  }
  scored.sort((a, b) => b.score - a.score);
  const alts = [];
  for (const it of scored) { if (it === best) continue; if (Math.hypot(it.x - best.x, it.y - best.y) > 0.5 && alts.length < 2) alts.push(it); }
  if (!best) best = { x: target.x, y: target.y - 1.15, s: 0.8, w: 0, p: 0, score: 0 };
  return { x: best.x, y: best.y, s: best.s, w: best.w, p: best.p, alts };
}

// A short plain-words description of a plan (used by Watch & Learn and the hint).
export function describe(pl, target) {
  const dx = pl.x - target.x, dy = pl.y - target.y;
  const near = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'far' : 'near');
  const side = near === 'near' ? 'the near edge' : near === 'far' ? 'the far edge' : `the ${near} edge`;
  const str = pl.s < 0.6 ? 'a gentle' : pl.s < 0.78 ? 'a firm' : 'a hard';
  const tw = Math.abs(pl.w) < 0.25 ? 'no twist' : pl.w > 0 ? 'a right twist' : 'a left twist';
  return `Slap beside ${side}: ${str} throw, ${tw}`;
}
void clamp; void wrapPi;
