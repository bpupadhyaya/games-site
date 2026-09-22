// The computer's brain. The same game as millfamily.js on bitboards: gen / make / unmake, an evaluation, negamax with
// alpha-beta, a transposition table and iterative deepening. It is time-sliced: createThinker() searches a little each
// time step() is called (a NODE budget per frame, never wall-clock time, so the game stays deterministic). The top plies
// of the search are generators so a search can pause between two moves and resume on the next frame.
import { RULES } from './morabaraba.js';

const R = RULES, S = R.spec, N = S.n, ADJ = S.adj.map((a) => a.reduce((m, j) => m | (1 << j), 0));
const MILLS = S.mills.map((t) => (1 << t[0]) | (1 << t[1]) | (1 << t[2]));
const MILLS_OF = R.millsOf.map((ks) => ks.map((k) => MILLS[k]));
const ALL = (1 << N) - 1, NONE = 31, WIN = 100000;
const pop = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
const lowbit = (x) => 31 - Math.clz32(x & -x);
const JUNCTION = ADJ.map((a) => (pop(a) >= 4 ? 1 : 0));

// ---- position: m[0], m[1] = cows of side 1 and 2; h = hands; t = index of the side to move ----
export function fromRules(g) {
  const p = { m: [0, 0], h: [g.hand[1], g.hand[2]], t: g.turn - 1 };
  g.board.forEach((c, i) => { if (c) p.m[c - 1] |= 1 << i; });
  return p;
}
const enc = (type, from, to, take) => (type << 15) | ((from < 0 ? NONE : from) << 10) | (to << 5) | (take < 0 ? NONE : take);
const mType = (m) => m >> 15, mFrom = (m) => (m >> 10) & 31, mTo = (m) => (m >> 5) & 31, mTake = (m) => m & 31;
export const toRulesMove = (m) => ({ type: ['place', 'move', 'fly'][mType(m)], from: mFrom(m) === NONE ? -1 : mFrom(m), to: mTo(m), take: mTake(m) === NONE ? -1 : mTake(m) });
export const fromRulesMove = (m) => enc(m.type === 'place' ? 0 : m.type === 'move' ? 1 : 2, m.from, m.to, m.take);

const millMembers = (mask) => { let r = 0; for (const mm of MILLS) if ((mask & mm) === mm) r |= mm; return r; };
const shootMask = (opp) => { const free = opp & ~millMembers(opp); return free || opp; };
const closes = (own, to) => { for (const mm of MILLS_OF[to]) if ((own & mm) === mm) return true; return false; };

const SH = new Int32Array(600);
// Fills buf with every legal move; returns the count. Captures are listed first.
function gen(p, buf) {
  const t = p.t, o = 1 - t, own = p.m[t], opp = p.m[o], all = own | opp, empty = ~all & ALL;
  let c = 0;
  const shots = SH; let ns = 0;
  const add = (type, from, to, ownAfter) => {
    if (closes(ownAfter, to)) { let r = shootMask(opp); while (r) { const b = r & -r, q = 31 - Math.clz32(b); r ^= b; shots[ns++] = enc(type, from, to, q); } } else buf[c++] = enc(type, from, to, -1);
  };
  if (p.h[t] > 0) { let e = empty; while (e) { const b = e & -e, to = 31 - Math.clz32(b); e ^= b; add(0, -1, to, own | b); } }
  else {
    const fly = pop(own) === S.flyAt; let f = own;
    while (f) {
      const fb = f & -f, from = 31 - Math.clz32(fb); f ^= fb;
      let dest = fly ? empty : ADJ[from] & empty;
      while (dest) { const b = dest & -dest, to = 31 - Math.clz32(b); dest ^= b; add(fly ? 2 : 1, from, to, (own ^ fb) | b); }
    }
  }
  // shots first (good ordering), then the quiet moves
  if (ns) { for (let i = c - 1; i >= 0; i--) buf[i + ns] = buf[i]; for (let i = 0; i < ns; i++) buf[i] = shots[i]; c += ns; }
  return c;
}
function make(p, m) {
  const t = p.t, o = 1 - t, to = 1 << mTo(m), from = mFrom(m), take = mTake(m);
  if (mType(m) === 0) { p.h[t]--; p.m[t] |= to; } else p.m[t] ^= (1 << from) | to;
  if (take !== NONE) p.m[o] &= ~(1 << take);
  p.t = o;
}
function unmake(p, m) {
  const o = p.t, t = 1 - o, to = 1 << mTo(m), from = mFrom(m), take = mTake(m);
  if (take !== NONE) p.m[o] |= 1 << take;
  if (mType(m) === 0) { p.h[t]++; p.m[t] &= ~to; } else p.m[t] ^= (1 << from) | to;
  p.t = t;
}

// ---- evaluation: from the point of view of the side to move ----
function evaluate(p) {
  const t = p.t, o = 1 - t, me = p.m[t], op = p.m[o], all = me | op, empty = ~all & ALL;
  const tm = pop(me) + p.h[t], to = pop(op) + p.h[o];
  let v = 100 * (tm - to);
  let closed = 0, myTwo = 0, opTwo = 0;
  for (const mm of MILLS) {
    const a = me & mm, b = op & mm, pa = pop(a), pb = pop(b);
    if (pa === 3) closed++; else if (pb === 3) closed--;
    else if (pa === 2 && pb === 0) myTwo++; else if (pb === 2 && pa === 0) opTwo++;
  }
  v += 9 * closed + 12 * myTwo - 14 * opTwo;
  const placing = p.h[t] + p.h[o] > 0;
  if (!(pop(me) === S.flyAt && p.h[t] === 0) && !(pop(op) === S.flyAt && p.h[o] === 0)) {
    let mob = 0, blockedOp = 0;
    let f = me; while (f) { const b = f & -f, i = 31 - Math.clz32(b); f ^= b; mob += pop(ADJ[i] & empty); }
    f = op; while (f) { const b = f & -f, i = 31 - Math.clz32(b); f ^= b; const k = pop(ADJ[i] & empty); mob -= k; if (!k) blockedOp++; }
    v += (placing ? 3 : 5) * mob + 6 * blockedOp;
  } else {
    // a flying side threatens any two-in-a-line with a free third point
    if (pop(op) === S.flyAt && p.h[o] === 0) v -= 30 * opTwo;
    if (pop(me) === S.flyAt && p.h[t] === 0) v += 30 * myTwo;
  }
  if (placing) { let f = me; while (f) { const b = f & -f, i = 31 - Math.clz32(b); f ^= b; v += 3 * JUNCTION[i]; } f = op; while (f) { const b = f & -f, i = 31 - Math.clz32(b); f ^= b; v -= 3 * JUNCTION[i]; } }
  return v + 6;
}

// ---- search ----
const bufs = Array.from({ length: 40 }, () => new Int32Array(600));
const YPLY = 5;               // plies below the root that are generators (able to pause); deeper plies are plain recursion
const tkey = (p) => p.m[p.t] * 16777216 + p.m[1 - p.t];

function tprobe(ctx, p, depth, alpha, beta) {
  const e = ctx.tt.get(tkey(p));
  if (!e || e.ht !== p.h[p.t] || e.ho !== p.h[1 - p.t]) return null;
  return e;
}
function tstore(ctx, p, depth, v, flag, best) {
  ctx.tt.set(tkey(p), { d: depth, v, f: flag, b: best, ht: p.h[p.t], ho: p.h[1 - p.t] });
}
// Orders moves in place: the hash move first.
function order(buf, c, hm) { if (hm < 0) return; for (let i = 0; i < c; i++) if (buf[i] === hm) { const x = buf[i]; for (let j = i; j > 0; j--) buf[j] = buf[j - 1]; buf[0] = x; return; } }

function search(p, depth, alpha, beta, ply, ctx) {
  ctx.nodes++;
  const t = p.t;
  if (pop(p.m[t]) + p.h[t] < S.minCows) return -(WIN - ply);
  if (depth <= 0) return evaluate(p);
  const buf = bufs[ply], c = gen(p, buf);
  if (c === 0) return p.h[0] + p.h[1] === 0 && (p.m[0] | p.m[1]) === ALL ? 0 : -(WIN - ply);
  const a0 = alpha, e = tprobe(ctx, p);
  let hm = -1;
  if (e) {
    hm = e.b;
    if (e.d >= depth) { if (e.f === 0) return e.v; if (e.f === 1 && e.v >= beta) return e.v; if (e.f === 2 && e.v <= alpha) return e.v; }
  }
  order(buf, c, hm);
  let best = -Infinity, bm = -1;
  for (let i = 0; i < c; i++) {
    const m = buf[i];
    make(p, m); const v = -search(p, depth - 1, -beta, -alpha, ply + 1, ctx); unmake(p, m);
    if (v > best) { best = v; bm = m; if (v > alpha) alpha = v; if (alpha >= beta) break; }
  }
  tstore(ctx, p, depth, best, best <= a0 ? 2 : best >= beta ? 1 : 0, bm);
  return best;
}
// The same search as a generator for the first plies: yields (pauses) between moves once the frame budget is used.
function* gsearch(p, depth, alpha, beta, ply, ctx) {
  ctx.nodes++;
  const t = p.t;
  if (pop(p.m[t]) + p.h[t] < S.minCows) return -(WIN - ply);
  if (depth <= 0) return evaluate(p);
  const buf = bufs[ply], c = gen(p, buf);
  if (c === 0) return p.h[0] + p.h[1] === 0 && (p.m[0] | p.m[1]) === ALL ? 0 : -(WIN - ply);
  const a0 = alpha, e = tprobe(ctx, p);
  let hm = -1;
  if (e) {
    hm = e.b;
    if (e.d >= depth) { if (e.f === 0) return e.v; if (e.f === 1 && e.v >= beta) return e.v; if (e.f === 2 && e.v <= alpha) return e.v; }
  }
  order(buf, c, hm);
  const moves = Array.from(buf.subarray(0, c));           // the buffer is reused by children, so keep our own copy here
  let best = -Infinity, bm = -1;
  for (const m of moves) {
    make(p, m);
    const v = -(ply + 1 < YPLY && depth > 3 ? yield* gsearch(p, depth - 1, -beta, -alpha, ply + 1, ctx) : search(p, depth - 1, -beta, -alpha, ply + 1, ctx));
    unmake(p, m);
    if (v > best) { best = v; bm = m; if (v > alpha) alpha = v; if (alpha >= beta) break; }
    if (ctx.nodes >= ctx.chunk) yield;
  }
  tstore(ctx, p, depth, best, best <= a0 ? 2 : best >= beta ? 1 : 0, bm);
  return best;
}

// Levels. depth = plies searched, budget = total nodes, noise = random wobble (100 = one cow), random = chance of a random move.
export const LEVELS = [
  { name: 'Calf', blurb: 'Learns as it goes and sometimes blunders.', depth: 2, budget: 4000, noise: 110, random: 0.22 },
  { name: 'Herder', blurb: 'Sees mills a few moves ahead.', depth: 4, budget: 30000, noise: 40, random: 0.05 },
  { name: 'Elder', blurb: 'Plans several moves and rarely errs.', depth: 6, budget: 120000, noise: 6, random: 0 },
  { name: 'Master', blurb: 'Searches deeply. Hard to beat.', depth: 9, budget: 400000, noise: 0, random: 0 },
];
export const CHUNK = 2500;      // nodes per step(): a few milliseconds, so a frame never stalls while the computer thinks

export function createThinker(g, level, rng, chunk = CHUNK) {
  const L = LEVELS[level] ?? LEVELS[1], p = fromRules(g), tmp = new Int32Array(600), c0 = gen(p, tmp), root = Array.from(tmp.subarray(0, c0));
  const ctx = { nodes: 0, chunk, tt: new Map() };
  let total = 0, vals = root.map(() => 0), doneDepth = 0, finished = root.length <= 1, run = null;
  function* iterate() {
    const noisy = L.noise > 0;
    for (let depth = 1; depth <= L.depth; depth++) {
      let alpha = -Infinity; const nv = root.map(() => -Infinity);
      for (let i = 0; i < root.length; i++) {
        make(p, root[i]);
        const v = -(yield* gsearch(p, depth - 1, -Infinity, noisy ? Infinity : -alpha + 40, 1, ctx));
        unmake(p, root[i]);
        nv[i] = v; if (v > alpha) alpha = v;
        if (ctx.nodes >= ctx.chunk) yield;
      }
      const idx = root.map((_, k) => k).sort((a, b) => nv[b] - nv[a]);
      const r2 = idx.map((k) => root[k]), v2 = idx.map((k) => nv[k]);
      for (let k = 0; k < root.length; k++) { root[k] = r2[k]; vals[k] = v2[k]; }
      doneDepth = depth;
      if (Math.abs(vals[0]) > WIN - 100 || ctx.total + ctx.nodes > L.budget) return;
    }
  }
  const pick = () => {
    if (root.length === 0) return null;
    if (root.length === 1) return toRulesMove(root[0]);
    if (rng.next() < L.random) return toRulesMove(root[rng.int(root.length)]);
    let bi = 0, top = -Infinity;
    for (let k = 0; k < root.length; k++) {
      let v = vals[k] + (L.noise ? (rng.next() * 2 - 1) * L.noise : 0) + rng.next() * 0.01;
      if (g.hand[1] + g.hand[2] === 0) { const after = R.apply(R.clone(g), toRulesMove(root[k])); v -= 35 * (g.seen[R.key(after)] || 0); }
      if (v > top) { top = v; bi = k; }
    }
    return toRulesMove(root[bi]);
  };
  ctx.total = 0;
  return {
    get nodes() { return ctx.total; },
    get depth() { return doneDepth; },
    // returns { move: undefined } while thinking; { move } (null when there is none) when finished
    step() {
      if (finished) return { move: pick() };
      if (!run) run = iterate();
      ctx.nodes = 0;
      const r = run.next();
      ctx.total += ctx.nodes;
      if (r.done) { finished = true; return { move: pick() }; }
      return { move: undefined };
    },
  };
}
export function chooseMove(g, level, rng) { const t = createThinker(g, level, rng); for (;;) { const r = t.step(); if (r.move !== undefined) return r.move; } }
export { gen, make, unmake, pop, WIN };
