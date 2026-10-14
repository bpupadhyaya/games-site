// The level ladder: data comes from levels-data.js (built offline by verify/build-levels.mjs; every entry carries a solution that the
// tests replay through the real rules). This module turns it into puzzles, tiers and replays for the title screen and figures.
import { LEVEL_DATA, DAILY_DATA } from './levels-data.js';
import { makeRules, otherKeys, otherSegs, applyMove } from './wire.js';

export const TIER_NAMES = ['Bar Top', 'The Snug', 'Cellar', 'Rafters', "Landlord's Own"];
export const tierOf = (i) => Math.min(TIER_NAMES.length - 1, Math.floor(i / 6));
const METALS = ['brass', 'copper', 'steel'];

function decode(d, id, daily = false) {
  const puzzle = {
    frame: { paths: d.f },
    loose: d.l.map((l, i) => ({ shape: { paths: l.p }, pose: { o: l.o[0], x: l.o[1], y: l.o[2], z: l.o[3] }, kind: l.k, metal: l.m ?? METALS[i % 3] })),
  };
  const sol = d.s.map((c) => { const p = Math.floor(c / 12), r = c % 12; return r < 6 ? { p, k: 's', i: r } : { p, k: 't', i: r - 6 }; });
  return { id, daily, name: d.n, puzzle, sol, par: sol.length, turns: sol.filter((m) => m.k === 't').length };
}
export const LEVELS = LEVEL_DATA.map((d, i) => decode(d, i));
export const DAILY = DAILY_DATA.map((d, i) => decode(d, 1000 + i, true));
export const levelSeedNote = 'levels are authored data; see verify/';

// The rules object of a level (built once).
const rulesOf = new WeakMap();
export function rulesFor(lv) {
  let r = rulesOf.get(lv);
  if (!r) { r = makeRules(lv.puzzle); rulesOf.set(lv, r); }
  return r;
}

// Replay of the stored solution, forwards then backwards, for the title screen and the How to Play figures.
const replays = new WeakMap();
export function replay(lv) {
  let rp = replays.get(lv);
  if (rp) return rp;
  const rules = rulesFor(lv);
  let poses = lv.puzzle.loose.map((l) => ({ ...l.pose }));
  const states = [poses.map((p) => ({ ...p }))], steps = [];
  for (const m of lv.sol) {
    const shape = lv.puzzle.loose[m.p].shape, keys = otherKeys(rules, poses, m.p), segs = otherSegs(rules, poses, m.p);
    const np = applyMove(rules, shape, poses[m.p], m, keys, segs);
    if (!np) break;
    steps.push({ p: m.p, k: m.k, i: m.i });
    poses = poses.map((p, j) => (j === m.p ? np : p));
    states.push(poses.map((p) => ({ ...p })));
  }
  const STEP = 0.62, n = steps.length;
  rp = {
    rules, states, steps, n,
    at(t, pause = 1.2) {
      const cycle = 2 * n * STEP + 2 * pause, tt = ((t % cycle) + cycle) % cycle;
      let k, frac, back = false;
      if (tt < n * STEP) { k = Math.floor(tt / STEP); frac = (tt - k * STEP) / STEP; }
      else if (tt < n * STEP + pause) { return { poses: states[n], anim: null, sel: steps.length ? steps[n - 1].p : 0 }; }
      else if (tt < 2 * n * STEP + pause) { const u = tt - n * STEP - pause; k = Math.floor(u / STEP); frac = (u - k * STEP) / STEP; back = true; }
      else return { poses: states[0], anim: null, sel: steps.length ? steps[0].p : 0 };
      if (k >= n) return { poses: states[back ? 0 : n], anim: null, sel: 0 };
      const idx = back ? n - 1 - k : k, st = steps[idx], from = states[back ? idx + 1 : idx], to = states[back ? idx : idx + 1];
      const turn = st.k === 't' ? (back ? st.i ^ 1 : st.i) : 0;
      const e = Math.min(1, frac * 1.25);
      return { poses: to, sel: st.p, anim: { piece: st.p, kind: st.k, from: from[st.p], to: to[st.p], turn, e: e * e * (3 - 2 * e) } };
    },
  };
  replays.set(lv, rp);
  return rp;
}

const firstTurn = Math.max(0, LEVELS.findIndex((l, i) => i >= 2 && l.turns > 0));
export const FIGURES = {
  hero: { level: Math.min(LEVELS.length - 1, 4), speed: 0.55, pause: 1.6, zoom: 1.0 },
  ring: { level: 0, speed: 0.7, pause: 1.4 },
  slide: { level: 0, speed: 0.7, pause: 1.4 },
  turn: { level: firstTurn, speed: 0.7, pause: 1.4 },
  zone: { level: 1, speed: 0.7, pause: 1.4 },
  think: { level: Math.min(LEVELS.length - 1, 8), speed: 0.8, pause: 1.4 },
};
