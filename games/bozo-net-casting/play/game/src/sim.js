// Bozo Net Casting: the river, the shoals and the net. Pure and deterministic: nothing here reads a clock or the DOM.
//
// Units are metres on the water plane: x to the right, z away from the canoe. The camera (art.js) looks forward over the
// canoe's bow. A shoal swims on a smooth closed path, so where every fish is at any time is a plain function of time
// (fishPos). A cast is judged in closed form (evaluateCast): where the net lands, how open it is, how fast it sinks and
// which fish have darted out of its circle by the time it closes underneath them. The view plays the same numbers back.

export const TAU = Math.PI * 2;
export const SESSION_CASTS = 6;
export const TRAY_SIZE = 3;
export const FLIGHT = 0.55;          // seconds from release until the net touches the water
export const Z_MIN = 5.0;            // nearest and farthest water the fisher can reach
export const Z_MAX = 19.0;
export const WIDE_OPEN = 0.92;       // opening that counts as "wide open"
export const WIDE_BONUS = 1.25;
export const HOLD_MIN = 0.22;        // a press shorter than this is not a cast

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const seeded = (a) => {
  let st = a >>> 0;
  const next = () => { st = (st + 0x6d2b79f5) | 0; let t = Math.imul(st ^ (st >>> 15), 1 | st); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next, range: (lo, hi) => lo + next() * (hi - lo), chance: (p) => next() < p, int: (n) => Math.floor(next() * n), pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle(arr) { const o = arr.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; },
  };
};

// ---- the nets ------------------------------------------------------------------------------------------------------------------
// R: radius of the open circle in metres; sink: metres per second; T: seconds for one full swing of the net around the fisher;
// need: best single cast (points) that unlocks it; col: [rope, mesh, lead].
export const NETS = [
  { id: 0, name: 'Cotton Net', R: 2.2, sink: 1.4, T: 1.5, need: 0, col: ['#e8cf9a', '#c9a864', '#3a3028'], how: 'The all-round net: a steady swing, an even spread and a middling sink.' },
  { id: 1, name: 'Fine Mesh', R: 2.5, sink: 1.0, T: 1.3, need: 0, col: ['#f2e4bd', '#d8c08a', '#4a4036'], how: 'Spreads wide and swings quickly, but sinks slowly, so fish have time to dart away.' },
  { id: 2, name: 'Lead Line', R: 1.9, sink: 2.3, T: 1.8, need: 0, col: ['#c79a5a', '#9c7640', '#262220'], how: 'A heavy line: a small circle that closes fast on deep fish, with a slow swing that is easy to time.' },
  { id: 3, name: 'Wide Delta Net', R: 3.0, sink: 0.85, T: 1.7, need: 12, col: ['#e9d9a6', '#b5c9a0', '#3a3028'], how: 'The widest net of all: a slow sink suits fish that stay put near the surface.' },
  { id: 4, name: 'Quick Sinker', R: 1.7, sink: 3.2, T: 1.4, need: 20, col: ['#d9a35c', '#a8743a', '#1c1814'], how: 'A tight, fast net for deep, jumpy fish; it needs a near-perfect aim.' },
  { id: 5, name: "Master's Net", R: 2.7, sink: 1.9, T: 1.5, need: 30, col: ['#f6dc8c', '#e0b85c', '#2a2420'], how: 'Hand-knotted long ago: wide and fast-sinking at once. It rewards a clean swing.' },
];
// What the lead weights are tuned to: a lighter set spreads wider and sinks slower, a heavier set sinks faster and spreads less.
export const DEPTHS = [
  { id: 0, name: 'Shallow', sink: 0.65, R: 1.12, note: 'light weights' },
  { id: 1, name: 'Middle', sink: 1.0, R: 1.0, note: 'even weights' },
  { id: 2, name: 'Deep', sink: 1.7, R: 0.9, note: 'heavy weights' },
];

// ---- the fish of the inland Niger delta ----------------------------------------------------------------------------------------
// pts: points per fish; depth: where the shoal swims (m); len: body length (m); flee: speed it darts away at (m/s);
// delay: reaction time (s); n: fish per shoal; col: [back, belly, fin].
export const SPECIES = [
  { id: 0, name: 'Tilapia', pts: 1, depth: [0.4, 1.5], len: 0.24, flee: 1.4, delay: 0.35, n: [9, 14], col: ['#5f7a5a', '#d7dcb0', '#a8b27c'], how: 'Common, calm and close to the surface: a good first target.' },
  { id: 1, name: 'Silver Alestes', pts: 1, depth: [0.3, 1.2], len: 0.15, flee: 2.7, delay: 0.15, n: [12, 18], col: ['#7d8f99', '#eef4f2', '#d9a05a'], how: 'Tiny, quick silver shoals that bolt at the first shadow.' },
  { id: 2, name: 'Labeo', pts: 2, depth: [0.8, 2.1], len: 0.32, flee: 1.6, delay: 0.3, n: [6, 9], col: ['#4a4f58', '#9aa0a4', '#d96f3a'], how: 'Grey river carp with red fins, feeding in the middle water.' },
  { id: 3, name: 'River Catfish', pts: 3, depth: [1.8, 3.2], len: 0.34, flee: 0.9, delay: 0.5, n: [4, 7], col: ['#5b4632', '#a79078', '#3c2f22'], how: 'Slow bottom feeders. They hardly flee, but they lie deep.' },
  { id: 4, name: 'Bony-tongue', pts: 3, depth: [0.8, 2.0], len: 0.46, flee: 1.2, delay: 0.4, n: [3, 5], col: ['#7a6a4a', '#d8c79a', '#b5864a'], how: 'Big bronze fish that cruise slowly in small groups.' },
  { id: 5, name: 'Elephantfish', pts: 4, depth: [1.0, 2.6], len: 0.34, flee: 2.0, delay: 0.2, n: [3, 5], col: ['#2f3440', '#6a7280', '#4a5160'], how: 'Dark, long-snouted fish that are quick to notice a net.' },
  { id: 6, name: 'Tigerfish', pts: 5, depth: [1.2, 2.8], len: 0.52, flee: 2.8, delay: 0.18, n: [2, 4], col: ['#8f9aa0', '#f1f3ee', '#d9503a'], how: 'Fast silver hunters with striped flanks: the hardest to hold.' },
  { id: 7, name: 'Nile Perch', pts: 8, depth: [2.0, 3.6], len: 0.82, flee: 1.8, delay: 0.45, n: [1, 2], col: ['#6f7a7c', '#d4d8d2', '#8a9496'], how: 'The giant of the river. One in the net makes the day.' },
];

// ---- the waters and the seasons -------------------------------------------------------------------------------------------------
// mix: how often each species (SPECIES order) turns up here; cur: river current (m/s); vis: how clearly the shoals show.
export const WATERS = [
  { id: 0, name: 'Niger at Dawn', pal: 0, need: 0, cur: 0.35, vis: 1.0, shoals: 3, mix: [3, 3, 2, 1, 1, 0.5, 0.3, 0.1], blurb: 'Still water under a soft pink sky; the shoals show clearly.' },
  { id: 1, name: 'Bani at Noon', pal: 1, need: 8, cur: 0.6, vis: 0.9, shoals: 3, mix: [2, 2, 3, 2, 2, 1, 1, 0.4], blurb: 'A brighter, brisker river with a steady current.' },
  { id: 2, name: 'Delta at Golden Hour', pal: 2, need: 16, cur: 0.5, vis: 0.75, shoals: 4, mix: [1.5, 1.5, 2, 3, 2, 2, 1.5, 0.8], blurb: 'Low sun on the backwaters; glare hides the deeper fish.' },
  { id: 3, name: 'Lagoon at Dusk', pal: 3, need: 26, cur: 0.25, vis: 0.6, shoals: 4, mix: [1, 1, 2, 3, 2, 2.5, 2.5, 1.5], blurb: 'Dark, deep water: big fish, faint shadows.' },
];
export const SEASONS = [
  { id: 0, name: 'Low water', depth: 0.62, cur: 0.7, vis: 1.0, shoals: 1, big: 0.6, blurb: 'Shallow, clear and crowded.' },
  { id: 1, name: 'Rising water', depth: 1.0, cur: 1.0, vis: 0.85, shoals: 0, big: 1.0, blurb: 'The river fills; fish spread to every depth.' },
  { id: 2, name: 'Flood', depth: 1.4, cur: 1.5, vis: 0.62, shoals: -0.5, big: 1.7, blurb: 'Deep, fast and murky, with the biggest fish.' },
];

// ---- a river scene --------------------------------------------------------------------------------------------------------------
export const latLimit = (z) => 0.3 * (z + 3.2);   // how far to the side a shoal's centre may wander at distance z

function pickWeighted(rng, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * sum;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}

// One scene: a few shoals of one species each, the current and the clarity. `rng` makes it reproducible (the daily water uses a
// seeded one, so everyone gets the same river).
export function makeConditions(waterIdx, seasonIdx, rng) {
  const W = WATERS[waterIdx], S = SEASONS[seasonIdx];
  const nShoals = clamp(Math.round(W.shoals + S.shoals + rng.range(-0.4, 0.6)), 2, 5);
  const side = rng.chance(0.5) ? -1 : 1;
  const cur = { x: side * W.cur * S.cur * rng.range(0.7, 1.3), z: rng.range(-0.12, 0.12) * W.cur };
  const weights = W.mix.map((m, i) => m * (i >= 5 ? S.big : i <= 1 ? 1.2 / Math.max(0.6, S.big) : 1));
  const shoals = [];
  const taken = [];
  for (let s = 0; s < nShoals; s++) {
    const sp = SPECIES[pickWeighted(rng, weights)];
    const n = rng.int(sp.n[1] - sp.n[0] + 1) + sp.n[0];
    // a centre that keeps clear of the other shoals
    let z = 0, x = 0;
    for (let tries = 0; tries < 12; tries++) {
      z = rng.range(7.5, 16.5); const lim = latLimit(z) * 0.78; x = rng.range(-lim, lim);
      if (taken.every((q) => Math.hypot(q.x - x, (q.z - z) * 1.2) > 3.4)) break;
    }
    taken.push({ x, z });
    const depth = clamp(rng.range(sp.depth[0], sp.depth[1]) * S.depth, 0.3, 3.9);
    const spread = 0.55 + 0.2 * Math.sqrt(n);
    const sh = {
      sp: sp.id, c0: { x, z }, ax: rng.range(0.7, 1.8), az: rng.range(0.4, 1.1), w1: rng.range(0.22, 0.42), w2: rng.range(0.2, 0.38),
      p1: rng.range(0, TAU), p2: rng.range(0, TAU), orb: rng.range(0.25, 0.5) * (rng.chance(0.5) ? -1 : 1), depth, fish: [],
    };
    for (let i = 0; i < n; i++) {
      sh.fish.push({
        r: spread * Math.sqrt((i + 0.5) / n) * rng.range(0.75, 1.15), a0: i * 2.399 + rng.range(-0.3, 0.3),
        depth: clamp(depth + rng.range(-0.28, 0.28), 0.2, 4.0), ph: rng.range(0, TAU), sz: rng.range(0.88, 1.14),
      });
    }
    shoals.push(sh);
  }
  return { water: waterIdx, season: seasonIdx, cur, vis: clamp(W.vis * S.vis, 0.25, 1), shoals };
}

// Where a fish is at time t (swimming with its shoal, before any dart away from a net).
export function fishPos(sh, f, t, out) {
  const cx = sh.c0.x + sh.ax * Math.sin(sh.w1 * t + sh.p1), cz = sh.c0.z + sh.az * Math.sin(sh.w2 * t + sh.p2);
  const a = f.a0 + sh.orb * t + 0.4 * Math.sin(0.7 * t + f.ph), r = f.r * (1 + 0.18 * Math.sin(1.3 * t + f.ph * 2));
  const o = out || {};
  o.x = cx + Math.cos(a) * r; o.z = cz + Math.sin(a) * r * 0.8;
  return o;
}

// ---- casting ----------------------------------------------------------------------------------------------------------------------
// How open the net is after the finger has been down for `hold` seconds on a net with swing period T. One swing is a full
// cycle: closed, open, closed. Each swing past the second tires the arm a little.
export function openness(hold, T) {
  const ph = (hold / T) % 1, s = 0.5 - 0.5 * Math.cos(TAU * ph), n = Math.floor(hold / T);
  return clamp(s * Math.max(0.8, 1 - 0.06 * Math.max(0, n - 1)), 0, 1);
}
export const openRadius = (net, depthIdx, open) => net.R * DEPTHS[depthIdx].R * (0.38 + 0.62 * clamp(open, 0, 1));
export const sinkRate = (net, depthIdx) => net.sink * DEPTHS[depthIdx].sink;

const P0 = { x: 0, z: 0 }, P1 = { x: 0, z: 0 };
// Judges one cast. cast = { x, z, net (index), depth (index), open (0..1), tRel (scene time of release, s) }.
// Returns the caught fish, the points, and the numbers the view needs to play it back.
export function evaluateCast(world, cast, wantFish = true) {
  const net = NETS[cast.net], R = openRadius(net, cast.depth, cast.open), sink = sinkRate(net, cast.depth);
  const tl = cast.tRel + FLIGHT, cur = world.cur;
  const alarmR = R * 1.45 + 0.4;
  let pts = 0, count = 0, tClose = 1.0;
  const caught = [];
  for (let si = 0; si < world.shoals.length; si++) {
    const sh = world.shoals[si], sp = SPECIES[sh.sp];
    for (let fi = 0; fi < sh.fish.length; fi++) {
      const f = sh.fish[fi];
      fishPos(sh, f, tl, P0);
      const dx = P0.x - cast.x, dz = P0.z - cast.z, d0 = Math.hypot(dx, dz);
      if (d0 > R * 1.7 + 0.8) continue;                  // far from the whole affair
      const tcDur = 0.2 + f.depth / sink, tc = tl + tcDur;
      if (tcDur > tClose && d0 <= alarmR) tClose = tcDur;
      fishPos(sh, f, tc, P1);
      if (d0 <= alarmR) {
        const run = Math.max(0, tcDur - sp.delay) * sp.flee;
        if (d0 < 0.05) { P1.x += Math.cos(f.a0) * run; P1.z += Math.sin(f.a0) * run; } else { P1.x += dx / d0 * run; P1.z += dz / d0 * run; }
      }
      // the net drifts a little with the current while it sinks
      const cx = cast.x + cur.x * 0.5 * tcDur, cz = cast.z + cur.z * 0.5 * tcDur;
      if (Math.hypot(P1.x - cx, P1.z - cz) <= R * 0.96) {
        pts += sp.pts; count++;
        if (wantFish) caught.push({ shoal: si, fish: fi, sp: sh.sp, tc: tcDur, x: P1.x, z: P1.z, pts: sp.pts });
      }
    }
  }
  const wide = cast.open >= WIDE_OPEN;
  const score = Math.round(pts * (wide ? WIDE_BONUS : 1));
  return { R, sink, tl, count, pts, score, wide, caught, sinkDur: clamp(tClose + 0.25, 1.1, 4.8), drift: { x: cur.x * 0.5, z: cur.z * 0.5 } };
}

// Where a fish is while a net is sinking: its shoal path, plus a dart away from the net once it is alarmed.
export function fishPosDuring(world, res, cast, si, fi, t, out) {
  const sh = world.shoals[si], f = sh.fish[fi], sp = SPECIES[sh.sp];
  fishPos(sh, f, t, out);
  if (!res || t <= res.tl) return out;
  const tl = res.tl;
  fishPos(sh, f, tl, P0);
  const dx = P0.x - cast.x, dz = P0.z - cast.z, d0 = Math.hypot(dx, dz);
  if (d0 > res.R * 1.45 + 0.4) return out;
  const run = Math.max(0, t - tl - sp.delay) * sp.flee;
  if (d0 < 0.05) { out.x += Math.cos(f.a0) * run; out.z += Math.sin(f.a0) * run; } else { out.x += dx / d0 * run; out.z += dz / d0 * run; }
  return out;
}

// ---- the helper: the best cast the net tray allows right now ------------------------------------------------------------------------
// Tries every net in the tray, every depth, and a grid of landing spots, assuming the net is released wide open at the peak of
// its swing. `now` is the scene time at which the swing would start.
export function advise(world, trayNets, now) {
  let best = null;
  const spots = [];
  for (let z = 6; z <= 18; z += 1) { const lim = latLimit(z) * 1.05; for (let x = -lim; x <= lim + 0.01; x += 0.6) spots.push([x, z]); }
  const cast = { x: 0, z: 0, net: 0, depth: 0, open: 1, tRel: 0 };
  for (const ni of trayNets) {
    const net = NETS[ni];
    cast.net = ni; cast.tRel = now + net.T * 0.5;
    for (let d = 0; d < DEPTHS.length; d++) {
      cast.depth = d;
      for (const [x, z] of spots) {
        cast.x = x; cast.z = z;
        const r = evaluateCast(world, cast, false);
        if (!best || r.score > best.score + 1e-9 || (r.score === best.score && r.sinkDur < best.sinkDur - 1e-9)) best = { net: ni, depth: d, x, z, score: r.score, count: r.count, sinkDur: r.sinkDur, T: net.T, tRel: cast.tRel };
      }
    }
  }
  if (!best) return null;
  // refine the landing spot around the best coarse spot
  const c2 = { x: 0, z: 0, net: best.net, depth: best.depth, open: 1, tRel: best.tRel };
  for (let dx = -0.6; dx <= 0.61; dx += 0.2) for (let dz = -0.6; dz <= 0.61; dz += 0.2) {
    c2.x = best.x + dx; c2.z = clamp(best.z + dz, Z_MIN, Z_MAX);
    const r = evaluateCast(world, c2, false);
    if (r.score > best.score) { best.x = c2.x; best.z = c2.z; best.score = r.score; best.count = r.count; best.sinkDur = r.sinkDur; }
  }
  return best;
}

// A short sentence about why the helper chose what it chose, from the numbers of the scene.
export function adviceWhy(adv, world) {
  if (!adv) return 'no shoal is in reach';
  const net = NETS[adv.net], dep = DEPTHS[adv.depth];
  const res = evaluateCast(world, { x: adv.x, z: adv.z, net: adv.net, depth: adv.depth, open: 1, tRel: adv.tRel }, true);
  const tally = {};
  res.caught.forEach((c) => { tally[c.sp] = (tally[c.sp] || 0) + 1; });
  const top = Object.keys(tally).sort((a, b) => tally[b] * SPECIES[b].pts - tally[a] * SPECIES[a].pts)[0];
  if (top === undefined) return `the ${net.name} at ${dep.name.toLowerCase()} depth gives the best chance, with the net released wide open`;
  const sp = SPECIES[top];
  const fast = sinkRate(net, adv.depth) >= 2.2;
  const lean = Math.abs(world.cur.x) > 0.5 ? ' and the current leans the net a little downstream' : '';
  return `go for the ${sp.name} shoal: the ${net.name} at ${dep.name.toLowerCase()} depth ${fast ? 'closes quickly under them' : 'spreads wide over them'}${lean}; release when the net is fully open`;
}

export const RANKS = [[110, 'Delta Legend'], [85, 'Master Caster'], [60, 'Skilled Fisher'], [35, 'Steady Hand'], [15, 'River Apprentice'], [0, 'First Casts']];
export const rankFor = (total) => RANKS.find((r) => total >= r[0])[1];
