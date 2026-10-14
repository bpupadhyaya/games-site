// Disc-flip engine: the mat, the winks, the cup, and what happens when a wink is pressed and hops. Pure and deterministic:
// every random number comes from the `rng` passed in (anything with next() in [0,1)).
//
// World: a felt mat 600 x 900 units, the cup in the middle, each side's winks on a baseline at one end.
// A wink is a small disc (radius 17). A shot = wink + squidger + direction + power (0..1). The wink hops a distance that
// grows with power and lands with a spread that grows with distance, the squidger's scatter and a "steadiness" factor.
export const MAT_W = 600;
export const MAT_H = 900;
export const WR = 15;                       // wink radius
export const POT = { x: 300, y: 450, r: 32 };
export const POT_IN = 19;               // a wink whose middle lands this close to the cup middle drops in
export const TOUCH = 2 * WR - 1.5;          // winks closer than this overlap
export const MAX_BONUS = 2;

// range = hop distance at full power, scatter = spread factor, r = drawn radius, bomb = can blast a pile apart.
export const SQUIDGERS = [
  { id: 0, name: 'Potter', range: 190, scatter: 0.7, r: 25, bomb: false, tag: 'Short and accurate' },
  { id: 1, name: 'Squidger', range: 330, scatter: 1.0, r: 33, bomb: false, tag: 'All round' },
  { id: 2, name: 'Bomber', range: 560, scatter: 1.7, r: 43, bomb: true, tag: 'Long, wild, blasts piles' },
];
export const POWER_EXP = 1.35;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function makeMat(n) {
  const winks = [];
  let id = 0;
  for (const side of [0, 1]) {
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? MAT_W / 2 : 76 + (i * (MAT_W - 152)) / (n - 1);
      const y = side === 0 ? MAT_H - 32 : 32;
      winks.push({ id: id++, side, tone: i % 2, x, y, z: 0, pot: false, air: false });
    }
  }
  return { winks, potted: [0, 0], n };
}
export const cloneMat = (m) => ({ winks: m.winks.map((w) => ({ ...w })), potted: [m.potted[0], m.potted[1]], n: m.n });
export const getWink = (m, id) => m.winks.find((w) => w.id === id);

const resting = (w) => !w.pot && !w.air;
export function isSquopped(mat, w) {
  for (const o of mat.winks) if (o !== w && resting(o) && o.z > w.z && dist(o.x, o.y, w.x, w.y) < TOUCH) return true;
  return false;
}
// winks a side may shoot: still on the mat and not under another wink
export function freeWinks(mat, side) {
  return mat.winks.filter((w) => w.side === side && resting(w) && !isSquopped(mat, w));
}
export const unpotted = (mat, side) => mat.winks.filter((w) => w.side === side && !w.pot);
// how many winks sit on the mat overlapping w (its pile) including w; 1 = alone
export function pileOf(mat, w) {
  const seen = new Set([w.id]), q = [w];
  while (q.length) {
    const c = q.pop();
    for (const o of mat.winks) if (resting(o) && !seen.has(o.id) && dist(o.x, o.y, c.x, c.y) < TOUCH) { seen.add(o.id); q.push(o); }
  }
  return [...seen].map((i) => getWink(mat, i)).sort((a, b) => a.id - b.id);
}

export const hopDistance = (sq, power) => SQUIDGERS[sq].range * Math.pow(clamp(power, 0.03, 1), POWER_EXP);
export const powerFor = (sq, d) => clamp(Math.pow(d / SQUIDGERS[sq].range, 1 / POWER_EXP), 0.03, 1);
const tri = (rng) => rng.next() + rng.next() - 1;
// error radii of a shot for display: radial and lateral half-extent at distance D with spread factor m
export const spread = (D, m) => ({ radial: (14 + 0.3 * D) * m, lateral: Math.max(4, D * 0.1 * m) });

// effective spread of a shot: the hand's steadiness times the squidger's own scatter
export const effSpread = (sq, m) => (m ?? 1) * SQUIDGERS[sq].scatter;
function landing(w, sq, angle, power, mHand, rng) {
  const m = effSpread(sq, mHand);
  const D = hopDistance(sq, power), e = spread(D, m);
  const a = angle + 0.1 * m * tri(rng);
  const d = Math.max(4, D + e.radial * tri(rng));
  return { x: w.x + Math.cos(a) * d, y: w.y + Math.sin(a) * d };
}

// Put a wink down at (x, y): off the mat (boondocked back to the edge), into the cup, on the rim, on top of others, or alone.
function place(mat, w, x, y) {
  let off = false;
  if (x < 0 || x > MAT_W || y < 0 || y > MAT_H) {
    off = true; x = clamp(x, WR * 1.5, MAT_W - WR * 1.5); y = clamp(y, WR * 1.5, MAT_H - WR * 1.5);
  }
  const dp = dist(x, y, POT.x, POT.y);
  if (dp < POT_IN) { w.pot = true; w.air = false; w.z = 0; w.x = POT.x; w.y = POT.y; mat.potted[w.side]++; return { kind: 'pot', x: POT.x, y: POT.y, under: [] }; }
  if (dp < POT.r + WR * 0.7) { const k = (POT.r + WR * 0.75) / Math.max(dp, 0.01); x = POT.x + (x - POT.x) * k; y = POT.y + (y - POT.y) * k; }
  let z = 0;
  const under = [];
  for (const o of mat.winks) if (o !== w && resting(o) && dist(o.x, o.y, x, y) < TOUCH) { under.push(o.id); z = Math.max(z, o.z + 1); }
  w.x = x; w.y = y; w.z = z; w.air = false;
  return { kind: off ? 'off' : under.length ? 'squop' : 'rest', x, y, under };
}

// shot: { id, sq, angle, power, m } (m = spread multiplier: steadiness x skill). Mutates `mat`. Returns the result record.
export function takeShot(mat, shot, rng) {
  const w = getWink(mat, shot.id), sq = SQUIDGERS[shot.sq];
  const from = { x: w.x, y: w.y };
  w.air = true;
  const L = landing(w, shot.sq, shot.angle, shot.power, shot.m ?? 1, rng);
  const res = { id: w.id, side: w.side, sq: shot.sq, power: shot.power, angle: shot.angle, from, aim: { x: L.x, y: L.y }, kind: 'rest', final: null, under: [], scatter: [], pots: [0, 0], bonus: false };
  let cluster = [];
  if (sq.bomb) {
    const hit = mat.winks.filter((o) => resting(o) && dist(o.x, o.y, L.x, L.y) < TOUCH);
    if (hit.length) {
      const set = new Set();
      for (const h of hit) for (const p of pileOf(mat, h)) set.add(p.id);
      cluster = [...set].map((i) => getWink(mat, i)).sort((a, b) => a.id - b.id);
      if (cluster.length < 2) cluster = [];
    }
  }
  if (cluster.length) {
    for (const c of cluster) c.air = true;
    const p = place(mat, w, L.x, L.y);
    res.kind = 'bomb'; res.final = { x: p.x, y: p.y }; res.under = p.under;
    if (p.kind === 'pot') { res.kind = 'pot'; res.pots[w.side]++; }
    for (const c of cluster) {
      const dd = dist(c.x, c.y, L.x, L.y);
      const a0 = dd < 1 ? rng.next() * Math.PI * 2 : Math.atan2(c.y - L.y, c.x - L.x);
      const a = a0 + (rng.next() - 0.5) * 1.7;
      const d = (42 + rng.next() * 92) * (0.7 + 0.5 * shot.power);
      const ox = c.x, oy = c.y;
      const r = place(mat, c, ox + Math.cos(a) * d, oy + Math.sin(a) * d);
      res.scatter.push({ id: c.id, side: c.side, from: { x: ox, y: oy }, to: { x: r.x, y: r.y }, kind: r.kind, under: r.under });
      if (r.kind === 'pot') res.pots[c.side]++;
    }
    res.bonus = p.kind === 'pot';
    return res;
  }
  const p = place(mat, w, L.x, L.y);
  res.kind = p.kind; res.final = { x: p.x, y: p.y }; res.under = p.under;
  if (p.kind === 'pot') { res.pots[w.side]++; res.bonus = true; }
  return res;
}

// ---- odds for the aim preview and the AI (deterministic: own tiny generator, never the game rng) -----------------------
export function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return { next() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; } };
}
export function shotOdds(mat, shot, n = 36, seed = 7) {
  const rng = lcg(seed + shot.id * 131 + shot.sq * 17);
  let pot = 0, squop = 0, off = 0, bomb = 0, rivalPot = 0;
  const side = getWink(mat, shot.id).side;
  for (let i = 0; i < n; i++) {
    const m2 = cloneMat(mat);
    const r = takeShot(m2, shot, rng);
    if (r.kind === 'pot') pot++;
    else if (r.kind === 'squop') squop++;
    else if (r.kind === 'off') off++;
    else if (r.kind === 'bomb') bomb++;
    rivalPot += r.pots[1 - side] > 0 ? 1 : 0;
  }
  return { pot: pot / n, squop: squop / n, off: off / n, bomb: bomb / n, rivalPot: rivalPot / n };
}
