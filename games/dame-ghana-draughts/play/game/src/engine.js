// Dame (West African draughts): rules and the computer's brain. Pure and deterministic (no clock, no DOM).
//
// Board: n x n (10 = Ghanaian Damii, 8 = school board). Row 0 is the top, white starts at the bottom and moves up the screen.
// Dark (playable) squares are those with (row + col) odd, so the bottom-left corner is dark. Cell values:
//   0 empty, 1 white man, 2 white king, -1 black man, -2 black king.
// Flags: lone (a side left with a single piece has lost), majority (must take the longest chain; off = free choice).
export const VARIANTS = {
  damii: { id: 'damii', name: 'Ghanaian Damii', short: '10 x 10', n: 10, rows: 4, lone: true, majority: false },
  dame8: { id: 'dame8', name: 'Dame 8 x 8', short: '8 x 8', n: 8, rows: 3, lone: false, majority: false },
};
export const LEVELS = [
  { name: 'Easy', depth: 2, nodes: 1500, noise: 90 },
  { name: 'Medium', depth: 4, nodes: 20000, noise: 25 },
  { name: 'Hard', depth: 6, nodes: 90000, noise: 6 },
  { name: 'Master', depth: 11, nodes: 700000, noise: 0 },
];
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const STEP_NODES = 24000;

export const rc = (n, i) => [Math.floor(i / n), i % n];
export const sq = (n, r, c) => r * n + c;
export const isDark = (r, c) => (r + c) % 2 === 1;
export const sqName = (n, i) => 'abcdefghij'[i % n] + (n - Math.floor(i / n));

export function newGame(v = VARIANTS.damii, opts = {}) {
  const n = v.n, cells = new Array(n * n).fill(0);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!isDark(r, c)) continue;
    if (r < v.rows) cells[sq(n, r, c)] = -1;
    else if (r >= n - v.rows) cells[sq(n, r, c)] = 1;
  }
  const g = { n, variant: v.id, cells, turn: 1, lone: opts.lone ?? v.lone, majority: opts.majority ?? v.majority, quiet: 0, moves: 0, last: null, hist: {}, log: [], winner: 0, reason: '' };
  g.hist[key(g)] = 1;
  return g;
}
const key = (g) => g.cells.join('') + g.turn;
export const clone = (g) => ({ ...g, cells: g.cells.slice(), hist: { ...g.hist }, log: (g.log || []).slice(), last: g.last });
export const count = (g, side) => { let k = 0; for (const x of g.cells) if (x * side > 0) k++; return k; };

// ---- move generation ----------------------------------------------------------------------------------------------------
// A move is { from, to, path: [landing squares], caps: [captured squares] }. A simple move has caps = [].
function captureChains(cells, n, from, side, out) {
  const piece = cells[from], king = Math.abs(piece) === 2;
  const dead = new Set();
  const walk = (at, path, caps) => {
    let extended = false;
    for (const [dr, dc] of DIRS) {
      let r = Math.floor(at / n) + dr, c = (at % n) + dc;
      if (king) while (r >= 0 && r < n && c >= 0 && c < n && cells[r * n + c] === 0) { r += dr; c += dc; }
      if (r < 0 || r >= n || c < 0 || c >= n) continue;
      const over = r * n + c, t = cells[over];
      if (t * side >= 0 || dead.has(over)) continue;                          // empty is impossible here; own piece or already jumped
      let lr = r + dr, lc = c + dc;
      if (lr < 0 || lr >= n || lc < 0 || lc >= n || cells[lr * n + lc] !== 0) continue;
      dead.add(over);
      do {
        const land = lr * n + lc;
        extended = true;
        walk(land, path.concat(land), caps.concat(over));
        if (!king) break;
        lr += dr; lc += dc;
      } while (lr >= 0 && lr < n && lc >= 0 && lc < n && cells[lr * n + lc] === 0);
      dead.delete(over);
    }
    if (!extended && caps.length) out.push({ from, to: at, path, caps });
  };
  cells[from] = 0;                                                            // the mover leaves its square (it may pass over it)
  walk(from, [], []);
  cells[from] = piece;
}

export function legalMoves(g, side = g.turn) {
  const { n, cells } = g, caps = [], simple = [];
  for (let i = 0; i < cells.length; i++) {
    const p = cells[i];
    if (p * side <= 0) continue;
    captureChains(cells, n, i, side, caps);
  }
  if (caps.length) {
    if (!g.majority) return caps;
    const best = Math.max(...caps.map((m) => m.caps.length));
    return caps.filter((m) => m.caps.length === best);
  }
  for (let i = 0; i < cells.length; i++) {
    const p = cells[i];
    if (p * side <= 0) continue;
    const r0 = Math.floor(i / n), c0 = i % n, king = Math.abs(p) === 2;
    for (const [dr, dc] of DIRS) {
      if (!king && dr !== -side) continue;
      let r = r0 + dr, c = c0 + dc;
      while (r >= 0 && r < n && c >= 0 && c < n && cells[r * n + c] === 0) {
        simple.push({ from: i, to: r * n + c, path: [r * n + c], caps: [] });
        if (!king) break;
        r += dr; c += dc;
      }
    }
  }
  return simple;
}

// Applies a move in place and decides the result. Returns the game.
export function applyMove(g, m) {
  const { n, cells } = g, p = cells[m.from], side = Math.sign(p);
  (g.log ??= []).push(moveText(g, m));
  cells[m.from] = 0;
  for (const c of m.caps) cells[c] = 0;
  const lastRow = side === 1 ? 0 : n - 1;
  cells[m.to] = Math.abs(p) === 1 && Math.floor(m.to / n) === lastRow ? 2 * side : p;
  g.quiet = m.caps.length || Math.abs(p) === 1 ? 0 : g.quiet + 1;
  g.moves += 1; g.last = { from: m.from, to: m.to, caps: m.caps.length, crowned: Math.abs(p) === 1 && Math.abs(cells[m.to]) === 2 };
  g.turn = -side;
  const k = key(g); g.hist[k] = (g.hist[k] || 0) + 1;
  settle(g);
  return g;
}

export function settle(g) {
  const w = count(g, 1), b = count(g, -1);
  if (g.lone && (w === 1 || b === 1) && w + b > 2) { g.winner = w === 1 ? -1 : 1; g.reason = 'The losing side is down to its last piece.'; return; }
  if (g.lone && w === 1 && b === 1) { g.winner = 2; g.reason = 'One piece each.'; return; }
  if (w === 0 || b === 0) { g.winner = w === 0 ? -1 : 1; g.reason = 'All pieces were captured.'; return; }
  if (!legalMoves(g).length) { g.winner = -g.turn; g.reason = 'No legal move left.'; return; }
  if (g.quiet >= 50) { g.winner = 2; g.reason = 'Twenty-five moves each without a capture or a man move.'; return; }
  if (g.hist[key(g)] >= 3) { g.winner = 2; g.reason = 'The same position came up three times.'; return; }
}

export const mustCapture = (g, side = g.turn) => legalMoves(g, side).some((m) => m.caps.length > 0);
export const moveText = (g, m) => `${sqName(g.n, m.from)}${m.caps.length ? 'x' : '-'}${m.path.map((s) => sqName(g.n, s)).join(m.caps.length ? 'x' : '-')}`;

// ---- evaluation + search ------------------------------------------------------------------------------------------------
function evaluate(g, side) {
  const { n, cells } = g;
  let s = 0, w = 0, b = 0;
  const mid = (n - 1) / 2;
  for (let i = 0; i < cells.length; i++) {
    const p = cells[i];
    if (!p) continue;
    const r = Math.floor(i / n), c = i % n, a = Math.abs(p), sg = Math.sign(p);
    const cen = 3 - (Math.abs(c - mid) + Math.abs(r - mid)) * 0.5;
    let v;
    if (a === 2) { v = 330 + cen * 3; }
    else {
      const adv = sg === 1 ? n - 1 - r : r;                                     // rows travelled
      v = 100 + adv * 3 + cen + ((sg === 1 && r === n - 1) || (sg === -1 && r === 0) ? 7 : 0);
      if (adv >= n - 2) v += 12;                                               // about to crown
    }
    s += sg * v;
    if (sg === 1) w++; else b++;
  }
  if (g.lone) { if (w <= 2) s -= 35; if (b <= 2) s += 35; }                    // a short side is one trade from losing
  return s * side;
}

const WIN = 100000;
// +1 / -1 when the lone-piece rule has already decided the game for white / black, else 0
function loneResult(h) {
  if (!h.lone) return 0;
  const w = count(h, 1), b = count(h, -1);
  if (w + b <= 2) return 0;
  return w === 1 ? -1 : b === 1 ? 1 : 0;
}
// Zobrist keys (fixed, from a tiny LCG: deterministic) for the transposition table: two words per (square, piece kind).
const ZK = (() => { let s = 0x2545f491; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0)); const t = []; for (let i = 0; i < 100 * 4 + 2; i++) t.push([r(), r()]); return t; })();
const kindOf = (p) => (p === 1 ? 0 : p === 2 ? 1 : p === -1 ? 2 : 3);
function hashOf(g) {
  let h1 = g.turn === 1 ? ZK[400][0] : ZK[401][0], h2 = g.turn === 1 ? ZK[400][1] : ZK[401][1];
  const c = g.cells;
  for (let i = 0; i < c.length; i++) { const p = c[i]; if (p) { const z = ZK[i * 4 + kindOf(p)]; h1 ^= z[0]; h2 ^= z[1]; } }
  return (h1 >>> 11) * 4294967296 + (h2 >>> 0);
}
const sigOf = (m) => m.from * 10000 + m.to * 100 + m.path.length;
function negamax(g, depth, alpha, beta, ply, ctx) {
  if (++ctx.nodes > ctx.limit) { ctx.aborted = true; return 0; }
  const moves = legalMoves(g);
  if (!moves.length) return -WIN + ply;
  if (g.quiet >= 50) return 0;
  if (depth <= 0 && (moves[0].caps.length === 0 || ply > ctx.maxPly)) return evaluate(g, g.turn);
  const useTT = depth > 0 && ctx.tt, alpha0 = alpha;
  let key = 0, hint = -1;
  if (useTT) {
    key = hashOf(g);
    const e = ctx.tt.get(key);
    if (e) {
      hint = e.m;
      if (e.d >= depth) { if (e.f === 0) return e.v; if (e.f === 1 && e.v >= beta) return e.v; if (e.f === 2 && e.v <= alpha) return e.v; }
    }
  }
  if (moves.length > 1) moves.sort((a, b) => (sigOf(b) === hint ? 1000 : b.caps.length) - (sigOf(a) === hint ? 1000 : a.caps.length));
  const side = g.turn;
  let best = -Infinity, bestM = -1;
  for (const m of moves) {
    const h = { n: g.n, cells: g.cells.slice(), turn: g.turn, quiet: g.quiet, lone: g.lone, majority: g.majority };
    simulate(h, m);
    const lr = loneResult(h);
    const score = lr ? (lr === side ? WIN - ply : -WIN + ply) : -negamax(h, depth - 1, -beta, -alpha, ply + 1, ctx);
    if (ctx.aborted) return 0;
    if (score > best) { best = score; bestM = sigOf(m); }
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  if (useTT) {
    if (ctx.tt.size > 300000) ctx.tt.clear();
    ctx.tt.set(key, { d: depth, v: best, f: best <= alpha0 ? 2 : best >= beta ? 1 : 0, m: bestM });
  }
  return best;
}
// a lighter apply for the search (no history, no result checks)
function simulate(h, m) {
  const { n, cells } = h, p = cells[m.from], side = Math.sign(p);
  cells[m.from] = 0;
  for (const c of m.caps) cells[c] = 0;
  cells[m.to] = Math.abs(p) === 1 && Math.floor(m.to / n) === (side === 1 ? 0 : n - 1) ? 2 * side : p;
  h.quiet = m.caps.length || Math.abs(p) === 1 ? 0 : h.quiet + 1;
  h.turn = -side;
}

// A resumable search: each step() call searches ONE root move at one depth (a bounded slice of work), so a frame never stalls.
// step() returns { move: undefined } while thinking and { move } when done. Deterministic (node counts, never the clock).
export function createThinker(g, levelIdx, rng, opts = {}) {
  const L = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIdx))];
  const root = legalMoves(g);
  const budget = opts.nodes ?? L.nodes, maxDepth = opts.depth ?? L.depth, noise = opts.noise ?? L.noise, margin = noise * 2;
  const ctx = { nodes: 0, limit: STEP_NODES, aborted: false, maxPly: 14, tt: new Map() };
  let depth = 1, idx = 0, used = 0, done = false, curBest = -Infinity;
  let order = root.map((_, i) => i), scores = root.map(() => 0), next = root.map(() => -Infinity);
  const pick = () => {
    let bi = 0, bv = -Infinity;
    root.forEach((m, i) => { const v = scores[i] + (noise ? rng.range(-noise, noise) : 0); if (v > bv) { bv = v; bi = i; } });
    return root[bi];
  };
  return {
    count: root.length,
    info: () => ({ depth, used, scores: scores.slice(), root }),
    step() {
      if (root.length === 0) return { move: null };
      if (root.length === 1) return { move: root[0] };
      if (done) return { move: pick() };
      const i = order[idx], h = { n: g.n, cells: g.cells.slice(), turn: g.turn, quiet: g.quiet, lone: g.lone, majority: g.majority };
      simulate(h, root[i]);
      ctx.nodes = 0; ctx.aborted = false;
      const lr = loneResult(h);
      const v = lr ? (lr === g.turn ? WIN : -WIN) : -negamax(h, depth - 1, -Infinity, curBest === -Infinity ? Infinity : -(curBest - margin), 1, ctx);
      used += ctx.nodes;
      if (ctx.aborted) { done = true; return { move: undefined }; }         // too deep for this slice: keep the last finished depth's scores
      const floor = curBest - margin;                                       // a value at or below the window floor is only a bound
      if (curBest !== -Infinity && v <= floor) next[i] = floor - 1; else { next[i] = v; if (v > curBest) curBest = v; }
      if (++idx >= order.length) {                                          // a whole depth finished: adopt it and go deeper
        scores = next.slice(); next = root.map(() => -Infinity);
        order = order.slice().sort((a, b) => scores[b] - scores[a]);
        idx = 0; curBest = -Infinity; depth += 1;
        if (depth > maxDepth || used > budget || Math.abs(scores[order[0]]) > WIN / 2) done = true;
      }
      return { move: undefined };
    },
  };
}

// Synchronous convenience (tests, hints in headless runs).
export function chooseMove(g, levelIdx, rng, opts) {
  const t = createThinker(g, levelIdx, rng, opts);
  for (let i = 0; i < 100000; i++) { const r = t.step(); if (r.move !== undefined) { chooseMove.last = t.info(); return r.move; } }
  return null;
}
