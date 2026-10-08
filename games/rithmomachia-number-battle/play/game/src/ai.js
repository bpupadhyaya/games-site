// The computer player: iterative-deepening alpha-beta over the real rules (rules.js), cut into small slices so a frame never stalls.
// Deterministic: budgets are counted in search nodes (never a clock) and the only randomness is the seeded env.rng, used to choose among
// near-equal moves so the computer does not play the same game twice. `step()` does a little work and returns { move } when it has decided.
import { destinations, ambushes, touches, findArr, progression, inEnemyHalf, ratioKind, DIRS, TAKE_TARGET, SZ, START } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', depth: 1, budget: 300, margin: 120, slip: 0.3, pot: false },
  { name: 'Easy', depth: 2, budget: 2500, margin: 60, slip: 0.08, pot: false },
  { name: 'Medium', depth: 3, budget: 16000, margin: 25, slip: 0, pot: true },
  { name: 'Hard', depth: 4, budget: 40000, margin: 10, slip: 0, pot: true },
  { name: 'Master', depth: 5, budget: 100000, margin: 4, slip: 0, pot: true },
];
const NB = [[0, 1], [0, -1], [1, 0], [-1, 0]];
const WIN = 100000, INF = 1e9, SLICE = 600;
const WEIGHT = [0, 100, 150, 210];

// ---- the search position ---------------------------------------------------------------------------------------------------
function makeSearch(game, pot) {
  const b = Int32Array.from(game.board);
  const S = { b, cnt: [0, 0, 0], mat: [0, 0, 0], own: [null, new Uint8Array(256), new Uint8Array(256)], pend: game.pend ? { side: game.pend.side, sq: game.pend.arr.sq, codes: game.pend.arr.codes } : null, nodes: 0, stop: false, budget: Infinity, pot };
  for (let i = 0; i < SZ; i++) { const p = b[i]; if (p) { const s = p >> 16; S.cnt[s]++; S.mat[s] += WEIGHT[(p >> 12) & 15]; S.own[s][p & 4095]++; } }
  const tmp = [];
  S.gen = (side) => {               // all moves for `side`, most promising first
    const out = [];
    for (let i = 0; i < SZ; i++) {
      const p = b[i]; if (!p || (p >> 16) !== side) continue;
      tmp.length = 0; destinations(b, i, tmp);
      const sh = (p >> 12) & 15;
      for (let k = 0; k < tmp.length; k++) {
        const to = tmp[k];
        let o = 0;
        for (const [dr, dc] of NB) { const nr = (to >> 3) + dr, nc = (to & 7) + dc; if (nr < 0 || nr > 15 || nc < 0 || nc > 7) continue; const e = b[nr * 8 + nc]; if (e && (e >> 16) !== side && ratioKind(p & 4095, e & 4095)) o += 3000 + WEIGHT[(e >> 12) & 15]; }
        const r = to >> 3, adv = side === 1 ? 15 - r : r;     // steps made from the home edge
        o += adv * (sh === 1 ? 2 : 1) + 8 - Math.abs((to & 7) - 3.5);
        out.push([o, i, to]);
      }
    }
    out.sort((x, y) => y[0] - x[0]);
    return out;
  };
  return S;
}

function make(S, side, from, to) {
  const b = S.b, opp = 3 - side, p = b[from], t = b[to];
  const rec = { from, to, p, t, amb: null, pend: S.pend, win: 0 };
  b[to] = p; b[from] = 0;
  const am = touches(b, to, side), am2 = ambushes(b, to, side);
  for (const a of am2) if (!am.some((x) => x.sq === a.sq)) am.push(a);
  if (am.length) {
    rec.amb = [];
    for (const a of am) { const e = b[a.sq]; rec.amb.push(a.sq, e); b[a.sq] = 0; S.cnt[opp]--; S.mat[opp] -= WEIGHT[(e >> 12) & 15]; S.own[opp][e & 4095]--; }
  }
  const arr = findArr(b, side, to);
  if (arr) rec.win = side;
  else if (S.cnt[opp] <= START - TAKE_TARGET) rec.win = side;
  return rec;
}
function unmake(S, side, rec) {
  const b = S.b, opp = 3 - side;
  if (rec.amb) for (let k = 0; k < rec.amb.length; k += 2) { const e = rec.amb[k + 1]; b[rec.amb[k]] = e; S.cnt[opp]++; S.mat[opp] += WEIGHT[(e >> 12) & 15]; S.own[opp][e & 4095]++; }
  b[rec.from] = rec.p; b[rec.to] = rec.t;
  S.pend = rec.pend;
}

// The value a third piece must have to finish a progression with two known ones; `slot` is the empty position (0, 1 or 2).
function needed(slot, x, y, z) {
  const out = [];
  if (slot === 1) { if (((x + z) & 1) === 0) out.push((x + z) / 2); const g = Math.round(Math.sqrt(x * z)); if (g * g === x * z) out.push(g); if (((2 * x * z) % (x + z)) === 0) out.push((2 * x * z) / (x + z)); }
  else {
    const k = slot === 0 ? z : x, y2 = y;                  // known end, known middle
    out.push(2 * y2 - k); if ((y2 * y2) % k === 0) out.push((y2 * y2) / k); if (2 * k > y2 && (y2 * k) % (2 * k - y2) === 0) out.push((y2 * k) / (2 * k - y2));
  }
  return out;
}
const LD = [[0, 1], [1, 0], [1, 1], [1, -1]];
// How near is `side` to an arrangement? Windows in the enemy half with two of its pieces, no enemy piece, and a free third square that
// one of its remaining pieces could fill.
function potential(S, side) {
  const b = S.b, have = S.own[side]; let s = 0;
  for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) for (let d = 0; d < 4; d++) {
    const dr = LD[d][0], dc = LD[d][1], r2 = r + 2 * dr, c2 = c + 2 * dc;
    if (r2 > 15 || c2 < 0 || c2 > 7) continue;
    const s0 = r * 8 + c, s1 = (r + dr) * 8 + c + dc, s2 = r2 * 8 + c2;
    if (!inEnemyHalf(side, s0) || !inEnemyHalf(side, s2)) continue;
    const p0 = b[s0], p1 = b[s1], p2 = b[s2];
    let own = 0, empty = -1, bad = false;
    const ps = [p0, p1, p2];
    for (let k = 0; k < 3; k++) { const p = ps[k]; if (!p) empty = k; else if ((p >> 16) === side) own++; else bad = true; }
    if (bad || own < 2 || empty < 0) continue;
    const v = ps.map((p) => p & 4095);
    const need = needed(empty, v[0], v[1], v[2]);
    for (const n of need) if (n > 0 && n < 256 && have[n] && !(v.includes(n))) { s += 70; break; }
  }
  return s;
}

function evaluate(S, side) {
  const opp = 3 - side, b = S.b;
  let v = (S.mat[side] - S.mat[opp]) + (S.cnt[opp] < 20 ? (20 - S.cnt[opp]) * 18 : 0) - (S.cnt[side] < 20 ? (20 - S.cnt[side]) * 18 : 0);
  let adv = 0;
  for (let i = 0; i < SZ; i++) {
    const p = b[i]; if (!p) continue;
    const s = p >> 16, r = i >> 3, prog = s === 1 ? 15 - r : r;
    const val = inEnemyHalf(s, i) ? 7 + (prog - 7) * 2 : prog;
    adv += s === side ? val : -val;
  }
  v += adv;
  if (S.pot) v += potential(S, side) - potential(S, opp);
  return v;
}

function negamax(S, depth, alpha, beta, side, ply) {
  S.nodes++;
  if (S.nodes > S.budget) S.stop = true;
  const opp = 3 - side;
  if (depth <= 0 && !(S.pend && ply < 9)) return evaluate(S, side);
  const moves = S.gen(side);
  if (moves.length === 0) return -(WIN - ply);
  let best = -INF;
  for (let k = 0; k < moves.length; k++) {
    const rec = make(S, side, moves[k][1], moves[k][2]);
    let score;
    if (rec.win) score = rec.win === side ? WIN - ply : -(WIN - ply);
    else {
      const cap = rec.amb;
      score = -negamax(S, cap && depth === 1 && ply < 8 ? 1 : depth - 1, -beta, -alpha, opp, ply + 1);
    }
    unmake(S, side, rec);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta || S.stop) break;
  }
  return best;
}

export function createThinker(game, level, rng, clock = null) {
  // clock (browser only): { now, sliceMs, maxMs }. Work per frame is then bounded by time, and a move never takes more than maxMs on a slow phone
  // (the best completed depth is played). Tests pass no clock, so they stay purely node-counted and deterministic.
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
  const S = makeSearch(game, cfg.pot), side = game.turn, opp = 3 - side;
  const root = S.gen(side).map((m) => ({ from: m[1], to: m[2], score: 0 }));
  if (root.length === 0) return { step: () => ({ move: null }), progress: () => 1 };
  const budget = cfg.budget;
  const t0 = clock ? clock.now() : 0;
  let depth = 1, idx = 0, alpha = -INF, done = false, result = null, used = 0, bestDone = null, cur = null;
  function choose() {
    // pick among the moves within `margin` of the best completed score (seeded), with a small chance of a plain slip at the lowest levels
    const list = bestDone || root;
    const top = Math.max(...list.map((m) => m.score));
    if (cfg.slip && rng.chance(cfg.slip)) return root[rng.int(root.length)];
    const pool = list.filter((m) => m.score >= top - cfg.margin);
    return pool[rng.int(pool.length)];
  }
  const finishMove = (m, score) => { m.score = score; if (score > alpha) alpha = score; idx++; cur = null; };
  return {
    progress: () => Math.min(1, clock ? Math.max(used / budget, (clock.now() - t0) / clock.maxMs) : used / budget),
    step() {
      if (done) return { move: result };
      let work = 0; const ts = clock ? clock.now() : 0;
      while (clock ? (clock.now() - ts < clock.sliceMs) : work < SLICE) {
        if (clock && bestDone && clock.now() - t0 > clock.maxMs) { done = true; if (cur) { unmake(S, side, cur.rec); cur = null; } const mv = choose(); result = { from: mv.from, to: mv.to }; return { move: result }; }
        if (idx >= root.length) {                                      // a depth finished: keep it, deepen
          bestDone = root.map((m) => ({ ...m }));
          root.sort((a2, c) => c.score - a2.score);
          const top = root[0].score;
          if (depth >= cfg.depth || used >= budget || top > WIN - 200) { done = true; const mv = choose(); result = { from: mv.from, to: mv.to }; return { move: result }; }
          depth++; idx = 0; alpha = -INF; continue;
        }
        const m = root[idx], before = S.nodes;
        S.budget = Infinity; S.stop = false;
        if (!cur) {                                                    // open this root move; its replies are searched one per slice step
          const rec = make(S, side, m.from, m.to);
          if (rec.win) { unmake(S, side, rec); finishMove(m, rec.win === side ? WIN : -WIN); work += 1; used += 1; continue; }
          if (depth - 1 <= 0) { const sc = -evaluate(S, opp); unmake(S, side, rec); finishMove(m, sc); work += 1; used += 1; continue; }
          const replies = S.gen(opp);
          if (replies.length === 0) { unmake(S, side, rec); finishMove(m, WIN - 1); work += 1; used += 1; continue; }
          cur = { rec, replies, k: 0, best: -INF, a: -INF, b: -(alpha - cfg.margin - 1) };
        } else {
          const r = cur.replies[cur.k], rec2 = make(S, opp, r[1], r[2]);
          let sc;
          if (rec2.win) sc = rec2.win === opp ? WIN - 2 : -(WIN - 2);
          else sc = -negamax(S, rec2.amb && depth === 2 ? 1 : depth - 2, -cur.b, -cur.a, side, 2);
          unmake(S, opp, rec2);
          if (sc > cur.best) cur.best = sc;
          if (cur.best > cur.a) cur.a = cur.best;
          cur.k++;
          if (cur.a >= cur.b || cur.k >= cur.replies.length) { const rec = cur.rec, best = cur.best; unmake(S, side, rec); finishMove(m, -best); }
        }
        const cost = S.nodes - before; work += cost + 1; used += cost + 1;
        if (used >= budget * 2) { done = true; const mv = (bestDone ? choose() : root.slice().sort((a2, c) => c.score - a2.score)[0]); result = { from: mv.from, to: mv.to }; if (cur) { unmake(S, side, cur.rec); cur = null; } return { move: result }; }
      }
      return { move: undefined };
    },
  };
}

// Convenience for tests and shots: run a thinker to completion.
export function chooseMove(game, level, rng) {
  const t = createThinker(game, level, rng); let r;
  do { r = t.step(); } while (r.move === undefined);
  return r.move;
}
export { progression, ratioKind };
