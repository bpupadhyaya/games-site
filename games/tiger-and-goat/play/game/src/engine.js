// The fast engine behind the computer opponent, the hint button and the puzzles. rules.js stays the readable,
// authoritative rule book; this file is the same game on bitboards so a search can visit 100,000s of positions.
//   position: { tig: [4 point indices], goats: 25-bit mask, hand: goats still to place, turn: 0 goats | 1 tigers }
//   move (int): kind | from << 2 | to << 7 | over << 12 | tigerSlot << 17     kind: 0 place, 1 goat step, 2 tiger step, 3 jump
// Everything here is deterministic and clock-free: work is measured in nodes, never in time.
import { STEPS, JUMPS, clone, applyMove, key } from './rules.js';

const WIN = 100000;
export const mkind = (m) => m & 3, mfrom = (m) => (m >> 2) & 31, mto = (m) => (m >> 7) & 31, mover = (m) => (m >> 12) & 31, mslot = (m) => (m >> 17) & 3;
const pop = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };

export function fromRules(s) {
  const tig = []; let goats = 0;
  for (let i = 0; i < 25; i++) { if (s.board[i] === 'T') tig.push(i); else if (s.board[i] === 'G') goats |= 1 << i; }
  return { tig, goats, hand: s.inHand, turn: s.turn === 'T' ? 1 : 0 };
}
// An engine move as a rules.js move.
export function toRulesMove(m) {
  const k = mkind(m);
  return k === 0 ? { type: 'place', to: mto(m) } : k === 3 ? { type: 'jump', from: mfrom(m), over: mover(m), to: mto(m) } : { type: 'move', from: mfrom(m), to: mto(m) };
}
const occOf = (p) => { let o = p.goats; for (let i = 0; i < p.tig.length; i++) o |= 1 << p.tig[i]; return o; };

export function gen(p, out = []) {
  out.length = 0;
  const occ = occOf(p);
  if (p.turn === 0) {
    if (p.hand > 0) { for (let i = 0; i < 25; i++) if (!(occ & (1 << i))) out.push(i << 7); }
    else for (let i = 0; i < 25; i++) if (p.goats & (1 << i)) { const st = STEPS[i]; for (let k = 0; k < st.length; k++) if (!(occ & (1 << st[k]))) out.push(1 | (i << 2) | (st[k] << 7)); }
  } else {
    for (let ti = 0; ti < p.tig.length; ti++) {                       // jumps first: best move ordering for free
      const f = p.tig[ti], ju = JUMPS[f];
      for (let k = 0; k < ju.length; k++) if ((p.goats & (1 << ju[k][0])) && !(occ & (1 << ju[k][1]))) out.push(3 | (f << 2) | (ju[k][1] << 7) | (ju[k][0] << 12) | (ti << 17));
    }
    for (let ti = 0; ti < p.tig.length; ti++) { const f = p.tig[ti], st = STEPS[f]; for (let k = 0; k < st.length; k++) if (!(occ & (1 << st[k]))) out.push(2 | (f << 2) | (st[k] << 7) | (ti << 17)); }
  }
  return out;
}
export function make(p, m) {
  const k = m & 3;
  if (k === 0) { p.goats |= 1 << mto(m); p.hand -= 1; }
  else if (k === 1) p.goats = (p.goats & ~(1 << mfrom(m))) | (1 << mto(m));
  else { p.tig[mslot(m)] = mto(m); if (k === 3) p.goats &= ~(1 << mover(m)); }
  p.turn ^= 1;
}
export function unmake(p, m) {
  const k = m & 3;
  p.turn ^= 1;
  if (k === 0) { p.goats &= ~(1 << mto(m)); p.hand += 1; }
  else if (k === 1) p.goats = (p.goats & ~(1 << mto(m))) | (1 << mfrom(m));
  else { p.tig[mslot(m)] = mfrom(m); if (k === 3) p.goats |= 1 << mover(m); }
}

// Positive = good for the tigers. Material first; then how free the tigers are and what they threaten.
export function evaluate(p) {
  const occ = occOf(p); let steps = 0, jumps = 0, trapped = 0;
  for (let ti = 0; ti < p.tig.length; ti++) {
    const f = p.tig[ti], st = STEPS[f], ju = JUMPS[f]; let m = 0;
    for (let k = 0; k < st.length; k++) if (!(occ & (1 << st[k]))) m++;
    for (let k = 0; k < ju.length; k++) if ((p.goats & (1 << ju[k][0])) && !(occ & (1 << ju[k][1]))) { m++; jumps++; }
    steps += m; if (m === 0) trapped++;
  }
  return (20 - p.hand - pop(p.goats)) * 100 + steps * 4 + jumps * 22 - trapped * 42;
}

const posKey = (p) => { const t = p.tig.slice().sort((a, b) => a - b); let tk = 0; for (let i = 0; i < t.length; i++) tk = tk * 32 + t[i]; return (p.goats * 1048576 + tk) * 64 + p.hand * 2 + p.turn; };

// Negamax, alpha-beta, transposition table. ctx = { nodes, limit, tt: Map, bufs: [] }
function search(p, depth, alpha, beta, ply, ctx) {
  ctx.nodes++;
  const sign = p.turn === 1 ? 1 : -1;
  if (p.hand + pop(p.goats) === 0) return sign * (WIN - ply);
  const moves = gen(p, ctx.bufs[ply] || (ctx.bufs[ply] = []));
  if (moves.length === 0) return -(WIN - ply);                                   // the side to move is stuck and loses
  if (depth <= 0 || ctx.nodes > ctx.limit) return sign * evaluate(p);
  const k = posKey(p), hit = ctx.tt.get(k), a0 = alpha;
  let first = 0;
  if (hit) {
    if (hit.d >= depth) { if (hit.f === 0) return hit.v; if (hit.f === 1 && hit.v >= beta) return hit.v; if (hit.f === 2 && hit.v <= alpha) return hit.v; }
    first = hit.m;
  }
  if (first) { const i = moves.indexOf(first); if (i > 0) { moves[i] = moves[0]; moves[0] = first; } }
  let best = -Infinity, bestM = moves[0];
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    make(p, m); const v = -search(p, depth - 1, -beta, -alpha, ply + 1, ctx); unmake(p, m);
    if (v > best) { best = v; bestM = m; }
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  if (ctx.tt.size < 300000) ctx.tt.set(k, { d: depth, v: best, f: best <= a0 ? 2 : best >= beta ? 1 : 0, m: bestM });
  return best;
}

// How strong each level is. noise = random points added to each root move's score (human-like slips).
export const LEVELS = [
  { name: 'Easy', depth: 1, budget: 4000, noise: 70, random: 0.22 },
  { name: 'Medium', depth: 3, budget: 30000, noise: 22, random: 0.04 },
  { name: 'Hard', depth: 5, budget: 90000, noise: 0, random: 0 },
  { name: 'Master', depth: 8, budget: 320000, noise: 0, random: 0 },
];
const CHUNK = 6000;   // nodes per step(): a few milliseconds, so the screen never stalls while the computer thinks

// A thinker searches a little each time step() is called and returns the chosen rules.js move when it is done.
export function createThinker(s, level, rng) {
  const L = LEVELS[level] ?? LEVELS[1], p = fromRules(s), root = gen(p).slice();
  const ctx = { nodes: 0, limit: 0, tt: new Map(), bufs: [] };
  let depth = 1, i = 0, vals = root.map(() => 0), best = -Infinity, done = root.length <= 1, total = 0, exact = L.noise > 0;
  const finish = () => {
    if (root.length === 0) return null;
    if (root.length === 1) return toRulesMove(root[0]);
    if (rng.next() < L.random) return toRulesMove(root[rng.int(root.length)]);
    const ahead = (p.turn === 1 ? 1 : -1) * evaluate(p) >= -30;
    let pick = 0, top = -Infinity;
    for (let k = 0; k < root.length; k++) {
      let v = vals[k] + (L.noise ? (rng.next() * 2 - 1) * L.noise : 0) + rng.next() * 0.01;
      if (ahead && s.inHand === 0) { const after = applyMove(clone(s), toRulesMove(root[k]), false); v -= 45 * (s.seen[key(after)] || 0); }   // do not shuffle back and forth when not losing
      if (v > top) { top = v; pick = k; }
    }
    return toRulesMove(root[pick]);
  };
  return {
    get nodes() { return total; },
    step() {
      if (done) return { move: finish() };
      ctx.nodes = 0; ctx.limit = CHUNK * 3;
      while (ctx.nodes < CHUNK) {
        const m = root[i];
        make(p, m); const v = -search(p, depth - 1, -Infinity, exact || best === -Infinity ? Infinity : -best + 1, 1, ctx); unmake(p, m);
        vals[i] = v; if (v > best) best = v; i++;
        if (i >= root.length) {
          total += ctx.nodes;
          const order = root.map((mv, k) => k).sort((a, b) => vals[b] - vals[a]);
          const r2 = order.map((k) => root[k]), v2 = order.map((k) => vals[k]);
          for (let k = 0; k < root.length; k++) { root[k] = r2[k]; vals[k] = v2[k]; }
          if (depth >= L.depth || total > L.budget || Math.abs(vals[0]) > WIN - 100) { done = true; return { move: finish() }; }
          depth++; i = 0; best = -Infinity; ctx.tt.clear();
        }
      }
      total += ctx.nodes;
      return { move: undefined };
    },
  };
}
// Run a thinker to the end (tests, simulations, puzzle self-play).
export function chooseMove(s, level, rng) { const t = createThinker(s, level, rng); for (;;) { const r = t.step(); if (r.move !== undefined) return r.move; } }

// ---- forced-line solver (puzzles) ------------------------------------------------------------------------
// ctx = { nodes, limit }. Returns false when the node limit is hit, so a "true" is always a proven force.
function tigersCatch(p, n, ctx) {                       // tigers to move: can they force a capture within n tiger moves?
  if (++ctx.nodes > ctx.limit) return false;
  const ms = gen(p).slice(); if (ms.length === 0) return false;
  for (const m of ms) if (mkind(m) === 3) return true;
  if (n <= 1) return false;
  for (const m of ms) { make(p, m); const r = goatsCannotStop(p, n - 1, ctx); unmake(p, m); if (r) return true; }
  return false;
}
function goatsCannotStop(p, n, ctx) {
  const ms = gen(p).slice(); if (ms.length === 0) return true;
  for (const m of ms) { make(p, m); const r = tigersCatch(p, n, ctx); unmake(p, m); if (!r) return false; }
  return true;
}
function goatsTrap(p, n, ctx) {                         // goats to move: can they leave the tigers with no move within n goat moves?
  if (++ctx.nodes > ctx.limit) return false;
  const ms = gen(p).slice();
  for (const m of ms) {
    make(p, m); const replies = gen(p).slice();
    let r = replies.length === 0;
    if (!r && n > 1) { r = true; for (const t of replies) { make(p, t); const ok = goatsTrap(p, n - 1, ctx); unmake(p, t); if (!ok) { r = false; break; } } }
    unmake(p, m); if (r) return true;
  }
  return false;
}
// Every first move (as rules.js moves) that keeps the force alive. type: 'catch' | 'trap'; n = moves the solver's side has.
export function forcingMoves(s, type, n, limit = 60000) {
  const p = fromRules(s), out = [], ctx = { nodes: 0, limit };
  for (const m of gen(p).slice()) {
    let ok;
    if (type === 'catch') { if (mkind(m) === 3) ok = true; else if (n <= 1) ok = false; else { make(p, m); ok = goatsCannotStop(p, n - 1, ctx); unmake(p, m); } }
    else { make(p, m); const replies = gen(p).slice(); ok = replies.length === 0; if (!ok && n > 1) { ok = true; for (const t of replies) { make(p, t); const r = goatsTrap(p, n - 1, ctx); unmake(p, t); if (!r) { ok = false; break; } } } unmake(p, m); }
    if (ctx.nodes > ctx.limit) return null;            // too hard to prove: not a usable puzzle
    if (ok) out.push(toRulesMove(m));
  }
  return out;
}
