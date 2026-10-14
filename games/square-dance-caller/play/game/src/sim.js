// The engine of the floor: permutations of eight dancers, shortest way home (breadth-first search from home over the calls on the card),
// reproducible scrambles from a seed, and the paths the dancers walk. No DOM, no clock, no Math.random.
import { N, CALLS, CALL_BY_ID, LEVELS, TIPS, SWING } from './consts.js';

export const homeArr = () => Array.from({ length: N }, (_, i) => i);
// arr[slot] = dancer standing on that slot. Applying a call moves the dancer on slot s to to[s].
export function apply(arr, call) {
  const out = new Array(N);
  for (let s = 0; s < N; s++) out[call.to[s]] = arr[s];
  return out;
}
export const key = (arr) => { let k = 0; for (let i = 0; i < N; i++) k = k * 8 + arr[i]; return k; };
export const unkey = (k) => { const a = new Array(N); for (let i = N - 1; i >= 0; i--) { a[i] = k % 8; k = Math.floor(k / 8); } return a; };
export const isHome = (arr) => arr.every((d, i) => d === i);
export const homeCount = (arr) => arr.reduce((n, d, i) => n + (d === i ? 1 : 0), 0);
const invert = (to) => { const t = new Array(N); for (let s = 0; s < N; s++) t[to[s]] = s; return t; };

// dist table for a card: number of calls needed to reach home from each reachable state. BFS from home over the INVERSE of every call.
const DIST_CACHE = new Map();
export function distFor(cardIds) {
  const ck = cardIds.join(',');
  let d = DIST_CACHE.get(ck);
  if (d) return d;
  const inv = cardIds.map((id) => ({ to: invert(CALL_BY_ID[id].to) }));
  d = new Map();
  let frontier = [homeArr()];
  d.set(key(frontier[0]), 0);
  let depth = 0;
  while (frontier.length) {
    const next = [];
    depth++;
    for (const a of frontier) for (const c of inv) {
      const b = apply(a, c), kb = key(b);
      if (!d.has(kb)) { d.set(kb, depth); next.push(b); }
    }
    frontier = next;
  }
  DIST_CACHE.set(ck, d);
  if (DIST_CACHE.size > 12) DIST_CACHE.delete(DIST_CACHE.keys().next().value);
  return d;
}
export const distOf = (cardIds, arr) => { const v = distFor(cardIds).get(key(arr)); return v === undefined ? Infinity : v; };

// a call that brings the floor one step closer (ties: the first on the card); null when already home or no way
export function bestCall(cardIds, arr) {
  const d = distFor(cardIds), here = d.get(key(arr));
  if (!here) return null;
  for (const id of cardIds) { const v = d.get(key(apply(arr, CALL_BY_ID[id]))); if (v === here - 1) return id; }
  return null;
}
export function wayHome(cardIds, arr) { const out = []; let a = arr; for (let i = 0; i < 40; i++) { const id = bestCall(cardIds, a); if (!id) break; out.push(id); a = apply(a, CALL_BY_ID[id]); } return out; }

// a tiny seeded generator (the scramble must be the same on every device)
export function lcg(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

// A scrambled floor for a card whose shortest way home is exactly `want` calls long (or as near as the card allows).
export function makeSquare(cardIds, want, seed) {
  const d = distFor(cardIds), rnd = lcg(seed);
  let best = null;
  for (let tries = 0; tries < 400; tries++) {
    let a = homeArr(), last = -1;
    const len = want + 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < len; i++) {
      let c = Math.floor(rnd() * cardIds.length);
      if (c === last) c = (c + 1) % cardIds.length;
      last = c; a = apply(a, CALL_BY_ID[cardIds[c]]);
    }
    const v = d.get(key(a));
    if (v === undefined || v === 0) continue;
    if (v === want) return { arr: a, opt: v };
    if (!best || Math.abs(v - want) < Math.abs(best.opt - want)) best = { arr: a, opt: v };
  }
  return best;
}
export function levelSquare(idx) {
  const L = LEVELS[idx], t = TIPS[L.tip];
  const sq = makeSquare(t.cards, L.minOpt, 9100 + idx * 7919);
  return { ...sq, card: t.cards, tempo: L.tempo, tip: t, level: L };
}
// endless: square n (0-based) draws a growing card and a longer way home
export function marathonSquare(n, seed) {
  const ti = Math.min(TIPS.length - 1, Math.floor(n / 3));
  const t = TIPS[ti], want = Math.min(8, 2 + Math.floor(n / 2));
  const sq = makeSquare(t.cards, want, seed * 131 + n * 977 + 5);
  return { ...sq, card: t.cards, tempo: Math.min(132, 96 + n * 3), tip: t };
}
export function customSquare(cardIds, want, seed, tempo) {
  const sq = makeSquare(cardIds, want, seed * 53 + 11);
  return { ...sq, card: cardIds, tempo, tip: TIPS[0] };
}

// ---- dancer geometry (floor units: the floor spans -1.25..1.25, y points up) ---------------------------------------------------------------
const OFF = 0.23;
export function slotPos(s) {
  const c = s >> 1, lady = s & 1;
  let x = lady ? OFF : -OFF, y = -1;      // couple 1 at the bottom, gent on the left looking at the centre
  for (let i = 0; i < c; i++) { const nx = -y, ny = x; x = nx; y = ny; }
  return { x, y };
}
export const slotAng = (s) => { const p = slotPos(s); return Math.atan2(p.y, p.x); };
const PI = Math.PI, TAU = Math.PI * 2;
const ccwDelta = (a, b) => { let d = b - a; while (d < 0) d += TAU; while (d >= TAU) d -= TAU; return d; };
const cwDelta = (a, b) => -ccwDelta(b, a);
const smooth = (u) => u * u * (3 - 2 * u);
const lerp = (a, b, t) => a + (b - a) * t;
const polar = (ang, r) => ({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
const radOf = (s) => { const p = slotPos(s); return Math.hypot(p.x, p.y); };

// Where is the dancer who goes from slot a to slot b at time u (0..1 through the phrase) for this call? Returns x, y (floor units), face (radians),
// step (how hard the feet are moving, 0..1) and spin (extra turn in radians for the skirt).
export function dancerAt(call, a, b, u) {
  const A = slotPos(a), B = slotPos(b), k = call.kind;
  const lady = (a & 1) === 1;
  const pa = slotAng(a), pb = slotAng(b);
  const e = smooth(Math.min(1, Math.max(0, u / 0.9)));
  const ring = (cw = false) => {
    const d = cw ? cwDelta(pa, pb) : ccwDelta(pa, pb);
    const ang = pa + (d === 0 ? 0 : d) * e, r = lerp(radOf(a), radOf(b), e);
    const p = polar(ang, r);
    return { ...p, face: ang + (cw ? -PI / 2 : PI / 2), step: a === b ? 0.2 : 1, spin: 0 };
  };
  const faceCentre = (x, y) => Math.atan2(-y, -x);
  if (a === b && k !== 'swing' && k !== 'star' && k !== 'grand' && k !== 'chain' && k !== 'sashay' && k !== 'rlt') return { ...A, face: faceCentre(A.x, A.y), step: 0.15, spin: 0 };
  switch (k) {
    case 'rot': return ring(false);
    case 'swing': {
      // the pair turns around its middle
      const mate = a ^ 1, M = slotPos(mate);
      const cx = (A.x + M.x) / 2, cy = (A.y + M.y) / 2, ang0 = Math.atan2(A.y - cy, A.x - cx), r = Math.hypot(A.x - cx, A.y - cy);
      const ang = ang0 + e * TAU * 1.5 + (u > 0.9 ? 0 : 0);
      const back = u > 0.9 ? smooth((u - 0.9) / 0.1) : 0;
      const ang2 = ang0 + (e * 1.5 - 1.5 * 0) * TAU, ax = cx + Math.cos(ang2) * r * (1 + 0.0), ay = cy + Math.sin(ang2) * r;
      return { x: lerp(ax, A.x, back), y: lerp(ay, A.y, back), face: ang2 + PI / 2, step: 1, spin: e * TAU * 1.5 };
    }
    case 'chain': {
      if (!lady || a === b) return { x: A.x + (faceCentre(A.x, A.y) && 0), y: A.y, ...gentTurn(A, u), step: 0.4, spin: 0 };
      // the lady crosses the middle on a slightly curved line, passing the other lady by the right shoulder
      const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const bow = Math.sin(PI * e) * 0.17;
      return { x: lerp(A.x, B.x, e) + nx * bow, y: lerp(A.y, B.y, e) + ny * bow, face: Math.atan2(dy, dx), step: 1, spin: e * TAU };
    }
    case 'rlt': {
      const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const lane = Math.sin(PI * e) * 0.26 * ((a >> 1) < (b >> 1) ? 1 : 1);
      const turn = u > 0.65 ? smooth((u - 0.65) / 0.3) : 0;     // courtesy turn: the pair swings around at the end
      const base = { x: lerp(A.x, B.x, e) + nx * lane, y: lerp(A.y, B.y, e) + ny * lane };
      const mate = a ^ 1, tx = lerp(slotPos(mate).x, slotPos(b ^ 1).x, e), ty = lerp(slotPos(mate).y, slotPos(b ^ 1).y, e);
      const mx = (base.x + tx) / 2, my = (base.y + ty) / 2, ex = base.x - mx, ey = base.y - my, ang = turn * PI;
      const rx = ex * Math.cos(ang) - ey * Math.sin(ang), ry = ex * Math.sin(ang) + ey * Math.cos(ang);
      const fin = turn > 0 ? faceCentre(B.x, B.y) : Math.atan2(dy, dx);
      return { x: mx + rx * (turn > 0 ? 1 : 1), y: my + ry, face: lerp(Math.atan2(dy, dx), fin, turn) + (turn > 0 ? 0 : 0), step: 1, spin: 0 };
    }
    case 'grand': {
      // phase 1 (0..0.62): grand right and left, gents counter-clockwise, ladies clockwise, passing n dancers, then phase 2: promenade home
      const n = call.n, P1 = 0.62;
      const gentA = lady ? (a ^ 1) : a;                          // the gent of this pair in the starting set (or this dancer if a gent)
      // net movement: gents stay (home), ladies go to b. In the picture: everybody walks the ring one way or the other for n places, then pairs
      // promenade to the gent's home place.
      const ringR = lady ? 0.74 : 0.96;
      const dirCCW = !lady;
      const slotsWalked = n * 1.0;
      const phase1 = Math.min(1, u / P1), ph = smooth(phase1);
      const walked = ph * slotsWalked * (PI / 4) * (dirCCW ? 1 : -1);
      if (u <= P1) {
        const ang = pa + walked;
        const p = polar(ang, ringR + (lady ? 0 : 0));
        return { ...p, face: ang + (dirCCW ? PI / 2 : -PI / 2), step: 1, spin: lady ? ph * PI * 2 * n * 0.5 : 0 };
      }
      const ph2 = smooth((u - P1) / (1 - P1));
      const angMid = pa + slotsWalked * (PI / 4) * (dirCCW ? 1 : -1);
      const angEnd = pb;
      const d = ccwDelta(angMid, angEnd) ;
      const dd = lady ? (d > PI * 1.2 ? d - TAU : d) : d;
      const ang = angMid + dd * ph2;
      const r = lerp(ringR, radOf(b), ph2);
      const p = polar(ang, r);
      return { ...p, face: ang + PI / 2, step: 1, spin: 0 };
    }
    case 'star': {
      if (lady) return { x: A.x, y: A.y, face: faceCentre(A.x, A.y), step: 0.5, spin: e * TAU };
      // gents reach into the middle, walk the star and step back to the ring
      const inN = u < 0.18 ? smooth(u / 0.18) : u > 0.8 ? 1 - smooth((u - 0.8) / 0.2) : 1;
      const d = ccwDelta(pa, pb), ang = pa + d * smooth(Math.min(1, Math.max(0, (u - 0.12) / 0.7)));
      const r = lerp(radOf(a), 0.36, inN);
      const rr = u > 0.8 ? lerp(0.36, radOf(b), smooth((u - 0.8) / 0.2)) : r;
      const p = polar(ang, u > 0.8 ? rr : r);
      return { ...p, face: ang + PI / 2, step: 1, spin: 0 };
    }
    case 'sashay': {
      // the pair trades places: one passes in front, the other behind (bow in and out)
      const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const bow = Math.sin(PI * e) * 0.09 * (lady ? -1 : 1);
      return { x: lerp(A.x, B.x, e) + nx * bow, y: lerp(A.y, B.y, e) + ny * bow, face: faceCentre(A.x, A.y), step: 0.9, spin: 0 };
    }
    default: return { ...A, face: faceCentre(A.x, A.y), step: 0.2, spin: 0 };
  }
}
function gentTurn(A, u) { return { x: A.x, y: A.y, face: Math.atan2(-A.y, -A.x) + Math.sin(PI * Math.min(1, u / 0.9)) * 0.9 }; }
export { SWING, CALLS };
