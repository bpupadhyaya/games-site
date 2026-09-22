// The computer's brain. Negamax alpha-beta on the same game as rules.js (bitboards), with a transposition table,
// iterative deepening, mill-first move ordering and a mill extension at the horizon.
// STRENGTH, honestly: this is not a solved-game database (Gasser's full solution is about 10^10 positions).
// It is a deep tactical search. Work is counted in NODES, never in time, so the game stays deterministic.
// A thinker searches at most CHUNK nodes per step() and aborts; the table keeps every finished result, so the next
// step resumes where the last one stopped and the screen never stalls.
import { NONE, FULL, MILLS, MILLS_AT, ADJ, bit, pop, lowbit, formsMill, inMills, mvFrom, mvTo, mvTake, mkMove, clone, key, repeats, applyMove, legalMoves, total, flying } from './rules.js';

const WIN = 30000, INF = 32000;
export const CHUNK = 10000;
const ABORT = { abort: true };

export const LEVELS = [
  { name: 'Apprentice', depth: 2, budget: 2000, random: 0.35, tie: 30, flawP: 0, note: 'Learning the lines. Sees one move ahead and sometimes just guesses.' },
  { name: 'Journeyman', depth: 3, budget: 12000, random: 0.12, tie: 12, flawP: 0, note: 'Blocks simple mills and takes free men. Misses plans.' },
  { name: 'Guildsman', depth: 5, budget: 80000, random: 0.02, tie: 6, flawP: 0, note: 'Plans five plies ahead. A solid opponent.' },
  { name: 'Master', depth: 9, budget: 400000, random: 0, tie: 4, flawP: 0, note: 'Searches deep and punishes every slip.' },
  { name: 'Grandmaster', depth: 16, budget: 1600000, random: 0, tie: 3, flawP: 0.1, note: 'Searches as deep as it can, but its plans end at a horizon: a human can out-plan it.' },
];

// ---- engine instance (own transposition table, so two games never share state) ----------------------------------
export function createEngine(bits = 18) {
  const N = 1 << bits;
  return { N, mask: N - 1, k0: new Int32Array(N).fill(-1), k1: new Int32Array(N), sc: new Int32Array(N), dp: new Int8Array(N), fl: new Uint8Array(N), bm: new Int32Array(N), mv: [], ss: [], nodes: 0, limit: 0, maxPly: 0 };
}
const bufs = (E, ply) => { while (E.mv.length <= ply) { E.mv.push(new Int32Array(1024)); E.ss.push(new Int32Array(1024)); } };

// ---- position ---------------------------------------------------------------------------------------------------
const fromGame = (g) => ({ b: g.p.slice(), h: g.hand.slice(), t: g.turn });
function make(p, m) {
  const me = p.t, f = m & 31, t = (m >> 5) & 31, x = (m >> 10) & 31;
  if (f === NONE) p.h[me]--; else p.b[me] &= ~(1 << f);
  p.b[me] |= 1 << t;
  if (x !== NONE) p.b[1 - me] &= ~(1 << x);
  p.t = 1 - me;
}
function unmake(p, m) {
  const me = 1 - p.t, f = m & 31, t = (m >> 5) & 31, x = (m >> 10) & 31;
  p.t = me; p.b[me] &= ~(1 << t);
  if (f === NONE) p.h[me]++; else p.b[me] |= 1 << f;
  if (x !== NONE) p.b[1 - me] |= 1 << x;
}
const tot = (p, s) => pop(p.b[s]) + p.h[s];

// ---- evaluation: score for the side to move --------------------------------------------------------------------
const MID = [9, 11, 13, 15], MIDMASK = MID.reduce((a, i) => a | bit(i), 0);
const OTHERMID = (bit(1) | bit(3) | bit(5) | bit(7) | bit(17) | bit(19) | bit(21) | bit(23) | bit(9) | bit(11) | bit(13) | bit(15)) & ~MIDMASK;
function side(p, s, placingPhase, empty) {
  const A = p.b[s], B = p.b[1 - s];
  let v = 0;
  for (let i = 0; i < 16; i++) {
    const L = MILLS[i], a = pop(A & L);
    if (a === 3) {
      v += 8;
      if (!placingPhase) { for (let m = A & L; m; m &= m - 1) if (ADJ[lowbit(m)] & empty) { v += 16; break; } }   // a mill that can open and close again
    } else if (a === 2 && !(B & L)) {
      const third = L & ~A; v += placingPhase ? 12 : 8;
      if (!placingPhase && (ADJ[lowbit(third)] & A & ~L)) v += 26;                               // a man stands ready to close it
    }
  }
  v += 5 * pop(A & MIDMASK) + 2 * pop(A & OTHERMID);
  return v;
}
export function evaluate(p) {
  const me = p.t, op = 1 - me, occ = p.b[0] | p.b[1], empty = FULL & ~occ, placingPhase = p.h[0] + p.h[1] > 0;
  let v = 100 * (tot(p, me) - tot(p, op)) + side(p, me, placingPhase, empty) - side(p, op, placingPhase, empty) + 6;
  if (!placingPhase || (p.h[me] === 0 && p.h[op] === 0)) {
    const mob = (s) => { let n = 0, blocked = 0; for (let a = p.b[s]; a; a &= a - 1) { const c = pop(ADJ[lowbit(a)] & empty); n += c; if (!c) blocked++; } return [n, blocked]; };
    const [mm, bm] = mob(me), [om, bo] = mob(op);
    v += 3 * (mm - om) + 12 * (bo - bm);
    if (pop(p.b[op]) === 3 && p.h[op] === 0) v -= 45;             // a flying side is hard to trap and hard to stop
    if (pop(p.b[me]) === 3 && p.h[me] === 0) v += 45;
  }
  return v;
}

// ---- move generation for search (packed, ordered) -----------------------------------------------------------------
function gen(E, p, ply, ttMove) {
  bufs(E, ply);
  const mv = E.mv[ply], sc = E.ss[ply], me = p.t, A = p.b[me], B = p.b[1 - me], empty = FULL & ~(A | B);
  const safe = inMills(B), takes = (B & ~safe) || B;
  // points where the enemy would complete a mill: blocking them ranks high
  let danger = 0;
  for (let i = 0; i < 16; i++) { const L = MILLS[i]; if (pop(B & L) === 2 && !(A & L)) danger |= L & ~B; }
  let n = 0;
  const add = (f, t, newA) => {
    const base = (danger & bit(t) ? 500 : 0) + (bit(t) & MIDMASK ? 6 : 0) + (f === NONE ? 0 : 2);
    if (B && formsMill(newA, t)) {
      for (let x = takes; x; x &= x - 1) { const c = lowbit(x); let s = 2000 + base; for (let k = 0; k < 3; k++) { const l = MILLS_AT[c][k]; if (l !== undefined && pop(B & l) === 2 && !(A & l)) s += 40; } sc[n] = s + pop(ADJ[c] & empty); mv[n++] = mkMove(f, t, c); }
    } else { sc[n] = base; mv[n++] = mkMove(f, t); }
  };
  if (p.h[me] > 0) { for (let e = empty; e; e &= e - 1) { const t = lowbit(e); add(NONE, t, A | bit(t)); } }
  else {
    const fly = pop(A) === 3;
    for (let a = A; a; a &= a - 1) { const f = lowbit(a); for (let d = fly ? empty : ADJ[f] & empty; d; d &= d - 1) { const t = lowbit(d); add(f, t, (A & ~bit(f)) | bit(t)); } }
  }
  if (ttMove >= 0) for (let i = 0; i < n; i++) if (mv[i] === ttMove) { sc[i] += 5000; break; }
  for (let i = 1; i < n; i++) { const m = mv[i], s = sc[i]; let j = i - 1; while (j >= 0 && sc[j] < s) { mv[j + 1] = mv[j]; sc[j + 1] = sc[j]; j--; } mv[j + 1] = m; sc[j + 1] = s; }
  return n;
}
function canMill(p) {           // can the side to move close a mill right now?
  const me = p.t, A = p.b[me], B = p.b[1 - me], empty = FULL & ~(A | B);
  if (p.h[me] > 0) { for (let e = empty; e; e &= e - 1) if (formsMill(A | (e & -e), lowbit(e))) return true; return false; }
  const fly = pop(A) === 3;
  for (let a = A; a; a &= a - 1) { const f = lowbit(a); for (let d = fly ? empty : ADJ[f] & empty; d; d &= d - 1) if (formsMill((A & ~bit(f)) | (d & -d), lowbit(d))) return true; }
  return false;
}

// ---- search -------------------------------------------------------------------------------------------------------
function search(E, p, depth, alpha, beta, ply) {
  if (++E.nodes > E.limit) throw ABORT;
  const me = p.t;
  if (tot(p, me) < 3) return -WIN + ply;
  if (depth <= 0) { if (ply < E.maxPly && canMill(p)) depth = 1; else return evaluate(p); }
  const key0 = p.b[0] | (p.h[0] << 24) | (me << 28), key1 = p.b[1] | (p.h[1] << 24);
  const idx = (Math.imul(key0, 0x9e3779b1) ^ Math.imul(key1 + 0x7f4a7c15, 0x85ebca6b)) >>> 0 & E.mask;
  let ttMove = -1;
  if (E.k0[idx] === key0 && E.k1[idx] === key1) {
    ttMove = E.bm[idx];
    if (E.dp[idx] >= depth) {
      let s = E.sc[idx]; if (s > WIN - 1000) s -= ply; else if (s < -WIN + 1000) s += ply;
      const f = E.fl[idx];
      if (f === 0) return s;
      if (f === 1 && s >= beta) return s;
      if (f === 2 && s <= alpha) return s;
    }
  }
  const n = gen(E, p, ply, ttMove);
  if (n === 0) return -WIN + ply;
  const mv = E.mv[ply], a0 = alpha;
  let best = -INF, bestM = mv[0];
  for (let i = 0; i < n; i++) {
    const m = mv[i];
    make(p, m);
    let v;
    try { v = -search(E, p, depth - 1, -beta, -alpha, ply + 1); } finally { unmake(p, m); }
    if (v > best) { best = v; bestM = m; if (v > alpha) { alpha = v; if (alpha >= beta) break; } }
  }
  let s = best; if (s > WIN - 1000) s += ply; else if (s < -WIN + 1000) s -= ply;
  E.k0[idx] = key0; E.k1[idx] = key1; E.sc[idx] = s; E.dp[idx] = depth; E.bm[idx] = bestM;
  E.fl[idx] = best <= a0 ? 2 : best >= beta ? 1 : 0;
  return best;
}

// ---- thinker: time-sliced choice of a move for the side to move in game g -----------------------------------------
export function createThinker(g, level, rng, engine) {
  const L = LEVELS[level] ?? LEVELS[1], E = engine ?? createEngine(), p = fromGame(g);
  const all = legalMoves(g, []).slice();
  let depth = 1, i = 0, vals = all.map(() => 0), order = all.slice(), best = -INF, total_ = 0, done = all.length <= 1, result = null;
  const margin = Math.max(L.tie, L.flawP ? 40 : 1, 1);
  const hard = L.budget * 1.5;
  const finish = () => {
    if (all.length === 0) return null;
    if (all.length === 1) return all[0];
    if (rng.next() < L.random) return all[rng.int(all.length)];
    const { moves, v } = result ?? { moves: order, v: vals };
    const top = v[0];
    if (top > WIN - 1000) return moves[0];
    const cand = [];
    for (let k = 0; k < moves.length; k++) if (k === 0 || (v[k] >= top - margin && v[k] > -WIN + 1000)) cand.push(k);
    // do not shuffle: when not behind, prefer a move that does not repeat a position
    let pick = 0, score = -Infinity;
    const noise = (k) => (v[k] === top ? 0 : -(top - v[k]) * 0.3) + rng.next() * L.tie;
    for (const k of cand) {
      let s = noise(k);
      if (top >= -20 && repeats(g) + 1 > 0 && g.hist.length) { const a = clone(g); applyMove(a, moves[k]); s -= 28 * (a.winner === 'draw' ? 3 : a.hist.filter((h) => h === key(a)).length - 1); }
      if (s > score) { score = s; pick = k; }
    }
    if (L.flawP && g.hand[g.turn] > 0 && cand.length > 1 && rng.next() < L.flawP) pick = cand[cand[0] === pick ? 1 : 0];
    return moves[pick];
  };
  return {
    get nodes() { return total_; },
    get depth() { return result ? depth - 1 : 0; },
    step(chunk = CHUNK) {
      if (done) return { move: finish() };
      E.nodes = 0; E.limit = chunk;
      try {
        for (;;) {
          E.maxPly = depth + 5;
          while (i < order.length) {
            const m = order[i], alpha = best === -INF ? -INF : best - margin;
            make(p, m);
            let v;
            try { v = -search(E, p, depth - 1, -INF, best === -INF ? INF : -alpha, 1); } finally { unmake(p, m); }
            vals[i] = v; if (v > best) best = v; i++;
          }
          total_ += E.nodes; E.nodes = 0; E.limit = chunk;
          const idxs = order.map((m, k) => k).sort((a, b) => vals[b] - vals[a] || a - b);
          order = idxs.map((k) => order[k]); vals = idxs.map((k) => vals[k]);
          result = { moves: order.slice(), v: vals.slice() };
          if (depth >= L.depth || total_ > L.budget || Math.abs(vals[0]) > WIN - 1000) { done = true; return { move: finish() }; }
          depth++; i = 0; best = -INF;
        }
      } catch (e) {
        if (e !== ABORT) throw e;
        total_ += E.nodes; E.nodes = 0;
        if (total_ > hard && result) { done = true; return { move: finish() }; }
        return { move: undefined };
      }
    },
  };
}
export function chooseMove(g, level, rng, engine) { const t = createThinker(g, level, rng, engine), E = engine; for (;;) { const r = t.step(1e9); if (r.move !== undefined) return r.move; } }

// Short plain-language reason for a move (hints, coaching).
export function explain(g, m) {
  const me = g.turn, op = 1 - me, f = mvFrom(m), t = mvTo(m), x = mvTake(m), A = g.p[me], B = g.p[op];
  const nA = f === NONE ? A | bit(t) : (A & ~bit(f)) | bit(t);
  if (x !== NONE) return 'This closes a mill: three in a row. Then you take an enemy man.';
  for (const L of MILLS_AT[t]) if (pop(B & L) === 2 && !(A & L)) return 'This blocks the enemy: they had two in a row here and could have closed a mill.';
  let twos = 0; for (const L of MILLS_AT[t]) if (pop(nA & L) === 2 && !(B & L)) twos++;
  if (twos >= 2) return 'This makes two lines of two at once: the enemy cannot block both.';
  if (twos === 1) return 'This makes two in a row with an open third point: a mill threat.';
  if (f !== NONE) { if (MILLS_AT[f].some((L) => (A & L) === L)) return 'Opening a mill now lets you close it again next move.'; return 'A quiet move that keeps your men free to slide.'; }
  return 'A good point: it joins several lines and keeps your men free to move.';
}
