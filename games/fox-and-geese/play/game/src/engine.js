// The fast engine behind the computer opponent, the hint button and the puzzles. rules.js stays the readable,
// authoritative rule book; this file is the same game on flat arrays so a search can visit 100,000s of positions.
//   position: { b: Uint8Array(49) (1 = goose), fox, geese (count), flock, turn: 0 geese | 1 fox, chain: -1 | fox point mid-chain, h1, h2 }
//   move (int): kind | from << 2 | to << 8 | over << 14 | wasChain << 20     kind: 0 goose step, 1 fox step, 2 fox jump, 3 stop
// A fox turn can be several jumps; each jump is one move here, and the turn stays with the fox while a chain is open.
// Everything here is deterministic and clock-free: work is measured in nodes, never in time.
import { STEPS, JUMPS, GSTEPS, PTS, CELLS, FOX_WINS_AT, clone, applyMove, key } from './rules.js';

const WIN = 100000;
export const mkind = (m) => m & 3, mfrom = (m) => (m >> 2) & 63, mto = (m) => (m >> 8) & 63, mover = (m) => (m >> 14) & 63, mwas = (m) => (m >> 20) & 1;

// Zobrist keys from a fixed stream (two 32-bit halves), so a position hashes to one number without ever being scanned.
const Z = (() => { let s = 20260921; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0)); const a = (n) => Array.from({ length: n }, r); return { g1: a(CELLS), g2: a(CELLS), f1: a(CELLS), f2: a(CELLS), s1: a(100), s2: a(100) }; })();

export function fromRules(s) {
  const b = new Uint8Array(CELLS); let fox = -1, geese = 0;
  for (let i = 0; i < CELLS; i++) { if (s.board[i] === 'F') { fox = i; b[i] = 2; } else if (s.board[i] === 'G') { b[i] = 1; geese++; } }
  const p = { b, fox, geese, flock: s.flock, turn: s.turn === 'F' ? 1 : 0, chain: s.chain, h1: 0, h2: 0 };
  for (let i = 0; i < CELLS; i++) if (b[i] === 1) { p.h1 ^= Z.g1[i]; p.h2 ^= Z.g2[i]; }
  p.h1 ^= Z.f1[fox]; p.h2 ^= Z.f2[fox];
  p.h1 ^= Z.s1[p.turn * 50 + p.chain + 1]; p.h2 ^= Z.s2[p.turn * 50 + p.chain + 1];
  return p;
}
// An engine move as a rules.js move.
export function toRulesMove(m) {
  const k = mkind(m);
  return k === 2 ? { type: 'jump', from: mfrom(m), over: mover(m), to: mto(m) } : k === 3 ? { type: 'stop', from: mfrom(m), to: mfrom(m) } : { type: 'move', from: mfrom(m), to: mto(m) };
}

export function gen(p, out = []) {
  out.length = 0;
  const b = p.b;
  if (p.turn === 0) {
    for (let k = 0; k < 33; k++) { const i = PTS[k]; if (b[i] === 1) { const st = GSTEPS[i]; for (let j = 0; j < st.length; j++) if (!b[st[j]]) out.push((i << 2) | (st[j] << 8)); } }
  } else {
    const f = p.fox, ju = JUMPS[f], was = p.chain >= 0 ? 1 << 20 : 0;
    for (let k = 0; k < ju.length; k++) if (b[ju[k][0]] === 1 && !b[ju[k][1]]) out.push(2 | (f << 2) | (ju[k][1] << 8) | (ju[k][0] << 14) | was);
    if (p.chain >= 0) out.push(3 | (f << 2) | was);
    else { const st = STEPS[f]; for (let k = 0; k < st.length; k++) if (!b[st[k]]) out.push(1 | (f << 2) | (st[k] << 8)); }
  }
  return out;
}
const canJump = (p) => { const ju = JUMPS[p.fox]; for (let k = 0; k < ju.length; k++) if (p.b[ju[k][0]] === 1 && !p.b[ju[k][1]]) return true; return false; };
const sx = (p) => { const i = p.turn * 50 + p.chain + 1; p.h1 ^= Z.s1[i]; p.h2 ^= Z.s2[i]; };
export function make(p, m) {
  const k = m & 3, f = mfrom(m), t = mto(m);
  sx(p);
  if (k === 0) { p.b[f] = 0; p.b[t] = 1; p.h1 ^= Z.g1[f] ^ Z.g1[t]; p.h2 ^= Z.g2[f] ^ Z.g2[t]; p.turn = 1; p.chain = -1; }
  else if (k === 1) { p.b[f] = 0; p.b[t] = 2; p.fox = t; p.h1 ^= Z.f1[f] ^ Z.f1[t]; p.h2 ^= Z.f2[f] ^ Z.f2[t]; p.turn = 0; p.chain = -1; }
  else if (k === 2) {
    const o = mover(m); p.b[o] = 0; p.geese--; p.b[f] = 0; p.b[t] = 2; p.fox = t; p.h1 ^= Z.g1[o] ^ Z.f1[f] ^ Z.f1[t]; p.h2 ^= Z.g2[o] ^ Z.f2[f] ^ Z.f2[t];
    if (canJump(p)) { p.chain = t; p.turn = 1; } else { p.chain = -1; p.turn = 0; }
  } else { p.turn = 0; p.chain = -1; }
  sx(p);
}
export function unmake(p, m) {
  const k = m & 3, f = mfrom(m), t = mto(m);
  sx(p);
  if (k === 0) { p.b[t] = 0; p.b[f] = 1; p.h1 ^= Z.g1[f] ^ Z.g1[t]; p.h2 ^= Z.g2[f] ^ Z.g2[t]; p.turn = 0; p.chain = -1; }
  else if (k === 1) { p.b[t] = 0; p.b[f] = 2; p.fox = f; p.h1 ^= Z.f1[f] ^ Z.f1[t]; p.h2 ^= Z.f2[f] ^ Z.f2[t]; p.turn = 1; p.chain = -1; }
  else if (k === 2) {
    const o = mover(m); p.b[o] = 1; p.geese++; p.b[t] = 0; p.b[f] = 2; p.fox = f; p.h1 ^= Z.g1[o] ^ Z.f1[f] ^ Z.f1[t]; p.h2 ^= Z.g2[o] ^ Z.f2[f] ^ Z.f2[t];
    p.turn = 1; p.chain = mwas(m) ? f : -1;
  } else { p.turn = 1; p.chain = f; }
  sx(p);
}

// Positive = good for the fox. Material first; then how much room the fox still has and what it threatens.
const seen = new Int32Array(CELLS), stack = new Int32Array(CELLS);
export function evaluate(p) {
  const b = p.b, f = p.fox; let steps = 0, jumps = 0;
  const st = STEPS[f], ju = JUMPS[f];
  for (let k = 0; k < st.length; k++) if (!b[st[k]]) steps++;
  for (let k = 0; k < ju.length; k++) if (b[ju[k][0]] === 1 && !b[ju[k][1]]) jumps++;
  // room: empty points the fox can reach by plain steps (the geese win by shrinking it to nothing)
  let sp = 0, room = 0; seen.fill(0); stack[sp++] = f; seen[f] = 1;
  while (sp) { const c = stack[--sp], s2 = STEPS[c]; for (let k = 0; k < s2.length; k++) { const n = s2[k]; if (!seen[n] && !b[n]) { seen[n] = 1; room++; stack[sp++] = n; } } }
  // exposed geese: a goose with empty points on both sides of it along a line can be jumped once the fox arrives
  let exposed = 0, advance = 0;
  for (let k = 0; k < 33; k++) {
    const i = PTS[k]; if (b[i] !== 1) continue;
    advance += 6 - Math.floor(i / 7);
    const x = i % 7, y = Math.floor(i / 7);
    const e = (a, c) => a >= 0 && a < 7 && c >= 0 && c < 7 && (((a >= 2 && a <= 4) || (c >= 2 && c <= 4))) && !b[a + 7 * c];
    if (e(x - 1, y) && e(x + 1, y)) exposed++;
    if (e(x, y - 1) && e(x, y + 1)) exposed++;
  }
  const taken = p.flock - p.geese;
  return taken * 130 + steps * 5 + jumps * 30 + room * 3 + exposed * 4 - advance * 2;
}

const posKey = (p) => p.h1 * 2097152 + (p.h2 >>> 11);

// Negamax, alpha-beta, transposition table. The value is from the point of view of the side to move; a fox chain
// keeps the same side to move, so the window is passed on unchanged and the sign is not flipped.
// ctx = { nodes, limit, tt: Map, bufs: [] }
function search(p, depth, alpha, beta, ply, ctx) {
  ctx.nodes++;
  const sign = p.turn === 1 ? 1 : -1;
  if (p.geese <= FOX_WINS_AT) return sign * (WIN - ply);
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
    const v = child(p, m, depth - 1, alpha, beta, ply, ctx);
    if (v > best) { best = v; bestM = m; }
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  if (ctx.tt.size < 300000) ctx.tt.set(k, { d: depth, v: best, f: best <= a0 ? 2 : best >= beta ? 1 : 0, m: bestM });
  return best;
}
// The value of move m for the side that plays it (same side again after a jump that leaves a chain open).
function child(p, m, depth, alpha, beta, ply, ctx) {
  const t = p.turn; make(p, m);
  const v = p.turn === t ? search(p, depth, alpha, beta, ply + 1, ctx) : -search(p, depth, -beta, -alpha, ply + 1, ctx);
  unmake(p, m); return v;
}

// How strong each level is. noise = random points added to each root move's score (human-like slips).
export const LEVELS = [
  { name: 'Easy', depth: 1, budget: 4000, noise: 90, random: 0.25 },
  { name: 'Medium', depth: 3, budget: 30000, noise: 30, random: 0.05 },
  { name: 'Hard', depth: 5, budget: 90000, noise: 0, random: 0 },
  { name: 'Master', depth: 8, budget: 320000, noise: 0, random: 0 },
];
const CHUNK = 6000;   // nodes per step(): a few milliseconds, so the screen never stalls while the computer thinks

// A thinker searches a little each time step() is called and returns the chosen rules.js move when it is done.
export function createThinker(s, level, rng) {
  const L = LEVELS[level] ?? LEVELS[1], p = fromRules(s), root = gen(p).slice(), side = p.turn;
  const ctx = { nodes: 0, limit: 0, tt: new Map(), bufs: [] };
  let depth = 1, i = 0, vals = root.map(() => 0), best = -Infinity, done = root.length <= 1, total = 0, exact = L.noise > 0;
  const finish = () => {
    if (root.length === 0) return null;
    if (root.length === 1) return toRulesMove(root[0]);
    if (rng.next() < L.random) return toRulesMove(root[rng.int(root.length)]);
    const ahead = (side === 1 ? 1 : -1) * evaluate(p) >= -30;
    let pick = 0, top = -Infinity;
    for (let k = 0; k < root.length; k++) {
      let v = vals[k] + (L.noise ? (rng.next() * 2 - 1) * L.noise : 0) + rng.next() * 0.01;
      if (ahead) { const after = applyMove(clone(s), toRulesMove(root[k]), false); v -= 45 * (s.seen[key(after)] || 0); }   // do not shuffle back and forth when not losing
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
        const v = child(p, m, depth - 1, -Infinity, exact || best === -Infinity ? Infinity : -best + 1, 0, ctx);
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
// Every fox turn (a step, or a chain of jumps that it may stop at any time) ends with the geese to move: foxTurns
// calls fn(p) on each such final position and stops as soon as fn says false.
function foxTurns(p, fn) {
  for (const m of gen(p).slice()) {
    make(p, m);
    const ok = p.turn === 1 ? foxTurns(p, fn) : fn(p);
    unmake(p, m); if (!ok) return false;
  }
  return true;
}
function foxCatch(p, n, ctx) {                       // fox to move: can it force a capture within n fox turns?
  if (++ctx.nodes > ctx.limit) return false;
  const ms = gen(p).slice(); if (ms.length === 0) return false;
  for (const m of ms) if (mkind(m) === 2) return true;
  if (n <= 1) return false;
  for (const m of ms) { make(p, m); const r = geeseCannotStop(p, n - 1, ctx); unmake(p, m); if (r) return true; }
  return false;
}
function geeseCannotStop(p, n, ctx) {
  const ms = gen(p).slice(); if (ms.length === 0) return true;          // the geese cannot move: the fox has won
  for (const m of ms) { make(p, m); const r = foxCatch(p, n, ctx); unmake(p, m); if (!r) return false; }
  return true;
}
function geeseTrap(p, n, ctx) {                         // geese to move: can they leave the fox with no move within n goose moves?
  if (++ctx.nodes > ctx.limit) return false;
  for (const m of gen(p).slice()) {
    make(p, m);
    let r = gen(p).length === 0;
    if (!r && n > 1) r = foxTurns(p, (q) => q.geese > FOX_WINS_AT && geeseTrap(q, n - 1, ctx));
    unmake(p, m); if (r) return true;
  }
  return false;
}
// Every first move (as rules.js moves) that keeps the force alive. type: 'catch' | 'trap'; n = moves the solver's side has.
export function forcingMoves(s, type, n, limit = 60000) {
  const p = fromRules(s), out = [], ctx = { nodes: 0, limit };
  for (const m of gen(p).slice()) {
    let ok;
    if (type === 'catch') { if (mkind(m) === 2) ok = true; else if (n <= 1) ok = false; else { make(p, m); ok = geeseCannotStop(p, n - 1, ctx); unmake(p, m); } }
    else { make(p, m); ok = gen(p).length === 0; if (!ok && n > 1) ok = foxTurns(p, (q) => q.geese > FOX_WINS_AT && geeseTrap(q, n - 1, ctx)); unmake(p, m); }
    if (ctx.nodes > ctx.limit) return null;            // too hard to prove: not a usable puzzle
    if (ok) out.push(toRulesMove(m));
  }
  return out;
}
