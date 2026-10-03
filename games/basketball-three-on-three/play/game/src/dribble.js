// Dribble physics: one bounce cycle solved for a given period. The hand carries the ball (push), the ball falls with an initial
// downward speed, bounces on the floor with restitution E and rises back into the hand. Pure maths, shared by the sim and the presenter.
import { G, BR } from './consts.js';
const E = 0.80, HH0 = 1.0, HP0 = 0.86, TP = 0.11;   // restitution, hand height at catch, hand height at release, hand carry time (s)
const cache = new Map();
function cycleFor(vd, HH, HP) {
  const d = HP - BR;
  const vi = Math.sqrt(vd * vd + 2 * G * d), tf = (vi - vd) / G;
  const vr = E * vi, h = HH - BR;
  const disc = vr * vr - 2 * G * h;
  if (disc <= 0) return null;
  const tr = (vr - Math.sqrt(disc)) / G;
  return { tf, tr, vi, vr, vc: vr - G * tr };
}
// `sc` is the player's body scale: the hand rides at waist height, which grows with the body
export function makeDribble(T, sc = 1) {
  const HH = HH0 * sc, HP = HP0 * sc;
  const key = Math.round(T * 200) + Math.round(sc * 1000) * 100000;
  const hit = cache.get(key);
  if (hit) return hit;
  const Tt = Math.round(T * 200) / 200;
  let lo = 2.0, hi = 9.0;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2, c = cycleFor(mid, HH, HP);
    const tot = c ? TP + c.tf + c.tr : 9;
    if (tot > Tt) lo = mid; else hi = mid;
  }
  const vd = (lo + hi) / 2, c = cycleFor(vd, HH, HP) || { tf: 0.1, tr: 0.2, vi: 5, vr: 4, vc: 0 };
  const total = TP + c.tf + c.tr;
  const out = { T: total, vd, tf: c.tf, tr: c.tr, vc: c.vc, uFloor: (TP + c.tf) / total, uCarry: TP / total, uCatch: 1,
    // ball centre height at phase u (0..1): hand carry, fall, bounce, rise
    y(u) {
      const t = u * total;
      if (t < TP) {
        const a = t / TP;     // carried: a small lift, then pressed down to the release height
        if (a < 0.35) { const k = a / 0.35; return HH + 0.05 * (1 - (1 - k) * (1 - k)); }
        const k = (a - 0.35) / 0.65; return HH + 0.05 - (HH + 0.05 - HP) * (k * k * (3 - 2 * k) * 0.35 + k * 0.65);
      }
      const t1 = t - TP;
      if (t1 < c.tf) return HP - vd * t1 - 0.5 * G * t1 * t1;
      const t2 = t1 - c.tf;
      return BR + c.vr * t2 - 0.5 * G * t2 * t2;
    },
  };
  cache.set(key, out);
  return out;
}
export const DRIBBLE_HAND = { hh: HH0, hp: HP0 };
