// The computer's brain. Same game as rules.js on typed arrays: gen/make/unmake, mobility evaluation, negamax + alpha-beta +
// transposition table + iterative deepening. Work is counted in NODES (never time) so play stays deterministic.
// createThinker(...).step() searches at most CHUNK nodes and returns, so the screen never stalls; an interrupted search
// keeps everything it finished in the table and simply continues on the next step.
import { openingSquares } from './rules.js';

const WIN = 100000, CHUNK = 1000;
// Zobrist keys from a fixed generator (no Math.random).
const Z = (() => { let s = 12345; const nx = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0); const a = []; for (let i = 0; i < 100 * 3 + 2; i++) a.push([nx(), nx() & 0x1fffff]); return a; })();
const TURN = Z[300], DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];

export function fromRules(s) {
  const p = { n: s.n, b: Int8Array.from(s.b), turn: s.turn, ply: s.ply, hole: s.hole, h1: 0, h2: 0 };
  for (let i = 0; i < p.b.length; i++) if (p.b[i]) { p.h1 ^= Z[i * 3 + p.b[i]][0]; p.h2 ^= Z[i * 3 + p.b[i]][1]; }
  if (p.turn === 2) { p.h1 ^= TURN[0]; p.h2 ^= TURN[1]; }
  if (p.ply < 2) { p.h1 ^= Z[299][0] * (p.ply + 1); }
  return p;
}
// A move is an int: from*128 + to for a jump; 16384 + at for an opening removal.
const jm = (f, t) => f * 128 + t, isRemove = (m) => m >= 16384;
export function toRulesMove(p, m) { return isRemove(m) ? { type: 'remove', at: m - 16384 } : { type: 'jump', from: m >> 7, to: m & 127 }; }
export function fromRulesMove(m) { return m.type === 'remove' ? 16384 + m.at : jm(m.from, m.to); }

export function gen(p, out = []) {
  out.length = 0; const { n, b } = p;
  if (p.ply === 0) { for (const at of openingSquares(n)) out.push(16384 + at); return out; }
  if (p.ply === 1) { const hx = p.hole % n, hy = (p.hole - hx) / n; for (let d = 0; d < 4; d++) { const x = hx + DX[d], y = hy + DY[d]; if (x >= 0 && y >= 0 && x < n && y < n && b[x + n * y] === 2) out.push(16384 + x + n * y); } return out; }
  const me = p.turn, en = 3 - me;
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== me) continue;
    const x0 = i % n, y0 = (i - x0) / n;
    for (let d = 0; d < 4; d++) {
      let x = x0, y = y0;
      for (;;) {
        const lx = x + 2 * DX[d], ly = y + 2 * DY[d];
        if (lx < 0 || ly < 0 || lx >= n || ly >= n || b[x + DX[d] + n * (y + DY[d])] !== en || b[lx + n * ly] !== 0) break;
        out.push(jm(i, lx + n * ly)); x = lx; y = ly;
      }
    }
  }
  return out;
}
function mob(p, me) {
  const { n, b } = p, en = 3 - me; let c = 0;
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== me) continue;
    const x0 = i % n, y0 = (i - x0) / n;
    for (let d = 0; d < 4; d++) {
      let x = x0, y = y0;
      for (;;) {
        const lx = x + 2 * DX[d], ly = y + 2 * DY[d];
        if (lx < 0 || ly < 0 || lx >= n || ly >= n || b[x + DX[d] + n * (y + DY[d])] !== en || b[lx + n * ly] !== 0) break;
        c++; x = lx; y = ly;
      }
    }
  }
  return c;
}
export const mobility = mob;
const tog = (p, i, c) => { p.h1 ^= Z[i * 3 + c][0]; p.h2 ^= Z[i * 3 + c][1]; };
export function make(p, m) {
  const { n, b } = p;
  if (isRemove(m)) { const at = m - 16384; tog(p, at, b[at]); b[at] = 0; if (p.ply === 0) p.hole = at; }
  else {
    const f = m >> 7, t = m & 127, fx = f % n, fy = (f - fx) / n, tx = t % n, ty = (t - tx) / n, dx = Math.sign(tx - fx), dy = Math.sign(ty - fy), c = b[f];
    for (let x = fx + dx, y = fy + dy; x !== tx + dx || y !== ty + dy; x += 2 * dx, y += 2 * dy) { tog(p, x + n * y, b[x + n * y]); b[x + n * y] = 0; }
    tog(p, f, c); b[f] = 0; tog(p, t, c); b[t] = c;
  }
  if (p.ply < 2) p.h1 ^= Z[299][0] * (p.ply + 1) ^ Z[299][0] * (p.ply + 2);
  p.ply++; p.turn = 3 - p.turn; p.h1 ^= TURN[0]; p.h2 ^= TURN[1];
}
export function unmake(p, m, saved) {   // saved: the removed stone's colour for an opening removal
  const { n, b } = p;
  p.ply--; p.turn = 3 - p.turn; p.h1 ^= TURN[0]; p.h2 ^= TURN[1];
  if (p.ply < 2) p.h1 ^= Z[299][0] * (p.ply + 1) ^ Z[299][0] * (p.ply + 2);
  if (isRemove(m)) { const at = m - 16384; b[at] = saved; tog(p, at, saved); }
  else {
    const f = m >> 7, t = m & 127, fx = f % n, fy = (f - fx) / n, tx = t % n, ty = (t - tx) / n, dx = Math.sign(tx - fx), dy = Math.sign(ty - fy), c = b[t], en = 3 - c;
    tog(p, t, c); b[t] = 0; tog(p, f, c); b[f] = c;
    for (let x = fx + dx, y = fy + dy; x !== tx + dx || y !== ty + dy; x += 2 * dx, y += 2 * dy) { b[x + n * y] = en; tog(p, x + n * y, en); }
  }
}
// make/unmake wrappers that remember the removed stone for openings
const mk = (p, m) => { const c = isRemove(m) ? p.b[m - 16384] : 0; make(p, m); return c; };
const keyOf = (p) => p.h1 * 2097152 + (p.h2 & 0x1fffff);
const ABORT = { abort: true };

function evaluate(p) { return mob(p, p.turn) - mob(p, 3 - p.turn); }        // side to move's view: more jumps than the opponent is good

function search(p, depth, alpha, beta, ply, ctx) {
  if (++ctx.nodes > ctx.limit) throw ABORT;
  const ms = gen(p, ctx.bufs[ply] || (ctx.bufs[ply] = []));
  if (ms.length === 0) return -WIN + ply;                                    // cannot jump: loses
  if (depth <= 0) return evaluate(p);
  const k = keyOf(p), e = ctx.tt.get(k);
  let first = -1;
  if (e) {
    if (e.d >= depth) { if (e.f === 0) return e.v; if (e.f === 1 && e.v >= beta) return e.v; if (e.f === 2 && e.v <= alpha) return e.v; }
    first = e.m;
  }
  if (first >= 0) { const i = ms.indexOf(first); if (i > 0) { ms[i] = ms[0]; ms[0] = first; } }
  let best = -Infinity, bm = ms[0], a0 = alpha;
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i], c = mk(p, m);
    const v = -search(p, depth - 1, -beta, -alpha, ply + 1, ctx);
    unmake(p, m, c);
    if (v > best) { best = v; bm = m; if (v > alpha) alpha = v; }
    if (alpha >= beta) break;
  }
  if (ctx.tt.size > 400000) ctx.tt.clear();
  ctx.tt.set(k, { d: depth, v: best, f: best >= beta ? 1 : best <= a0 ? 2 : 0, m: bm });
  return best;
}

// How strong each level is. noise = random points added to each root move's score; random = chance of a random move.
export const LEVELS = [
  { name: 'Easy', depth: 1, budget: 1500, noise: 4, random: 0.3, blurb: 'Plays the first jump that looks fine. Often blunders.' },
  { name: 'Medium', depth: 3, budget: 8000, noise: 1.5, random: 0.06, blurb: 'Looks a few jumps ahead. Still makes slips.' },
  { name: 'Hard', depth: 6, budget: 30000, noise: 0, random: 0, blurb: 'Counts jumps six moves ahead.' },
  { name: 'Master', depth: 30, budget: 120000, noise: 0, random: 0, blurb: 'Searches as deep as it can and plays endgames perfectly.' },
];

export function createThinker(s, level, rng) {
  const L = LEVELS[level] ?? LEVELS[1], p = fromRules(s), chunk = s.n >= 10 ? 500 : 1000, root = gen(p).slice();
  const ctx = { nodes: 0, limit: 0, tt: new Map(), bufs: [] };
  let depth = 1, i = 0, vals = root.map(() => 0), best = -Infinity, done = root.length <= 1, total = 0, dTop = 0;
  const finish = () => {
    if (root.length === 0) return null;
    const conv = (m) => toRulesMove(p, m);
    if (root.length === 1) return conv(root[0]);
    if (rng.next() < L.random) return conv(root[rng.int(root.length)]);
    let pick = 0, top = -Infinity;
    for (let k = 0; k < root.length; k++) { const v = vals[k] + (L.noise ? (rng.next() * 2 - 1) * L.noise : 0) + rng.next() * 0.01; if (v > top) { top = v; pick = k; } }
    return conv(root[pick]);
  };
  const info = () => ({ score: vals[0] ?? 0, depth: dTop, nodes: total });
  return {
    get nodes() { return total; },
    step() {
      if (done) return { move: finish(), ...info() };
      ctx.nodes = 0; ctx.limit = chunk;
      while (ctx.nodes < chunk) {
        const m = root[i], snapB = Int8Array.from(p.b), h1 = p.h1, h2 = p.h2, turn = p.turn, ply = p.ply, hole = p.hole;
        try {
          const c = mk(p, m); const v = -search(p, depth - 1, -Infinity, Infinity, 1, ctx); unmake(p, m, c);
          vals[i] = v; if (v > best) best = v; i++;
        } catch (e) {
          if (e !== ABORT) throw e;
          p.b.set(snapB); p.h1 = h1; p.h2 = h2; p.turn = turn; p.ply = ply; p.hole = hole;
          total += ctx.nodes; return { move: undefined };                     // finished parts are in the table: continue next step
        }
        if (i >= root.length) {
          dTop = depth;
          const order = root.map((mv, k) => k).sort((a, b) => vals[b] - vals[a]), r2 = order.map((k) => root[k]), v2 = order.map((k) => vals[k]);
          for (let k = 0; k < root.length; k++) { root[k] = r2[k]; vals[k] = v2[k]; }
          total += ctx.nodes; ctx.nodes = 0;
          if (depth >= L.depth || total > L.budget || Math.abs(vals[0]) > WIN - 200) { done = true; return { move: finish(), ...info() }; }
          depth++; i = 0; best = -Infinity;
          if (total > L.budget * 0.5 && depth > 3) ctx.limit = chunk;
        }
      }
      total += ctx.nodes; return { move: undefined };
    },
  };
}
export function chooseMove(s, level, rng) { const t = createThinker(s, level, rng); for (;;) { const r = t.step(); if (r.move !== undefined) return r.move; } }

// ---- exact solver (puzzles): does the side to move win by force? -------------------------------------------
// Returns true/false, or throws ABORT when the node limit is hit (caller catches through winningMoves).
function wins(p, memo, ctx, bufs, ply) {
  if (++ctx.nodes > ctx.limit) throw ABORT;
  const k = keyOf(p), c = memo.get(k); if (c !== undefined) return c;
  const ms = gen(p, bufs[ply] || (bufs[ply] = [])).slice();
  let r = false;
  for (const m of ms) { const cc = mk(p, m); const w = wins(p, memo, ctx, bufs, ply + 1); unmake(p, m, cc); if (!w) { r = true; break; } }
  memo.set(k, r); return r;
}
// Every move (rules.js form) after which the mover wins by force; null when the position is too big to prove.
export function winningMoves(s, limit = 60000) {
  const p = fromRules(s), ctx = { nodes: 0, limit }, memo = new Map(), out = [], bufs = [];
  try {
    for (const m of gen(p).slice()) { const c = mk(p, m); const w = wins(p, memo, ctx, bufs, 1); unmake(p, m, c); if (!w) out.push(toRulesMove(p, m)); }
  } catch (e) { if (e === ABORT) return null; throw e; }
  return out;
}
