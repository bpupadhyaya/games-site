// Halma rules: the single source of truth for what is legal and what a move does. Pure and deterministic.
// Squares are numbered row by row from the TOP-left: index = row * n + col. Seats are 1..4 (0 = empty square). Seat colours: 1 Blue, 2 Red, 3 Green, 4 Gold.
// A move is { from, to, path } where `path` lists the squares landed on after `from` (one square for a step, one per hop for a leap).
// g.winner: 0 playing, 1..4 = that seat won, 9 = draw.
export const VARIANTS = {
  classic: { name: 'Classic', long: 'Classic Halma', n: 16, camp: [5, 5, 4, 3, 2], corners: [3, 1], limit: 100, blurb: '16 by 16 board, 19 pegs each, two players. The standard game.' },
  quick:   { name: 'Quick', long: 'Quick Halma', n: 10, camp: [5, 4, 3, 2, 1], corners: [3, 1], limit: 60, blurb: '10 by 10 board, 15 pegs each, two players. A game in about five minutes.' },
  quad:    { name: 'Four players', long: 'Four-player Halma', n: 16, camp: [4, 4, 3, 2], corners: [3, 0, 1, 2], limit: 80, blurb: '16 by 16 board, 13 pegs each, four players. Everyone races to the opposite corner.' },
};
export const VARIANT_KEYS = ['classic', 'quick', 'quad'];
export const NAMES = ['', 'Blue', 'Red', 'Green', 'Gold'];
export const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
export const seatsOf = (variant) => VARIANTS[variant].corners.length;
export const pegsOf = (variant) => VARIANTS[variant].camp.reduce((a, b) => a + b, 0);

// ---- geometry, built once per rule set: camps, which camp a square is in, and "advance" (how far a square is from a seat's own corner)
const geoCache = {};
export function geo(variant) {
  if (geoCache[variant]) return geoCache[variant];
  const V = VARIANTS[variant], n = V.n, camps = [[], [], [], []], campOf = new Int8Array(n * n).fill(-1);
  for (let k = 0; k < 4; k++) {
    V.camp.forEach((len, i) => {
      for (let j = 0; j < len; j++) {
        const r = k === 0 || k === 1 ? i : n - 1 - i, c = k === 0 || k === 3 ? j : n - 1 - j;
        if (V.corners.includes(k) || V.corners.includes((k + 2) % 4)) { camps[k].push(r * n + c); campOf[r * n + c] = k; }
      }
    });
  }
  const cornerRC = (k) => [k === 0 || k === 1 ? 0 : n - 1, k === 0 || k === 3 ? 0 : n - 1];
  const seats = V.corners.length, startC = [-1], targetC = [-1], adv = [null], startSum = [0], targetSum = [0];
  for (let s = 1; s <= seats; s++) {
    const k = V.corners[s - 1]; startC.push(k); targetC.push((k + 2) % 4);
    const [sr, sc] = cornerRC(k), a = new Int16Array(n * n);
    for (let i = 0; i < n * n; i++) a[i] = Math.abs(((i / n) | 0) - sr) + Math.abs((i % n) - sc);
    adv.push(a);
    startSum.push(camps[k].reduce((x, q) => x + a[q], 0)); targetSum.push(camps[(k + 2) % 4].reduce((x, q) => x + a[q], 0));
  }
  return (geoCache[variant] = { variant, n, N: n * n, seats, camps, campOf, startC, targetC, adv, startSum, targetSum, pegs: pegsOf(variant), limit: V.limit * seats });
}

export function newGame(variant = 'classic') {
  const G = geo(variant), board = new Array(G.N).fill(0);
  for (let s = 1; s <= G.seats; s++) for (const q of G.camps[G.startC[s]]) board[q] = s;
  return { variant, board, turn: 1, moves: 0, winner: 0, reason: '', last: null };
}
export const clone = (g) => ({ ...g, board: g.board.slice(), last: g.last ? { ...g.last, path: g.last.path.slice() } : null });
export const squareName = (i, n) => 'abcdefghijklmnop'[i % n] + (n - ((i / n) | 0));

// ---- moves
const stamp = new Int32Array(256), parent = new Int16Array(256), hopsAt = new Int16Array(256), queue = new Int16Array(256); let stampN = 0;
// Every square the peg on `i` can reach this turn: single steps, and hops (jump over any one adjacent piece onto the empty square straight behind it,
// then keep hopping from there). Each destination comes with its shortest route. A peg already inside its goal camp may only move within it.
export function reachFrom(b, i, G, seat, out = []) {
  const n = G.n, r0 = (i / n) | 0, c0 = i % n, lock = G.campOf[i] === G.targetC[seat] ? G.targetC[seat] : -1;
  const ok = (q) => lock < 0 || G.campOf[q] === lock;
  const was = b[i]; b[i] = 0;
  stampN++; let qh = 0, qt = 0;
  for (const [dr, dc] of DIRS) {                                  // steps
    const r = r0 + dr, c = c0 + dc; if (r < 0 || r >= n || c < 0 || c >= n) continue;
    const q = r * n + c; if (b[q] === 0 && ok(q)) { out.push({ from: i, to: q, path: [q], hops: 0 }); stamp[q] = stampN; }
  }
  stamp[i] = stampN; parent[i] = -1; hopsAt[i] = 0; queue[qt++] = i;
  while (qh < qt) {                                               // hops, breadth first so every route is a shortest one
    const cur = queue[qh++], r1 = (cur / n) | 0, c1 = cur % n;
    for (const [dr, dc] of DIRS) {
      const rm = r1 + dr, cm = c1 + dc, rl = r1 + 2 * dr, cl = c1 + 2 * dc;
      if (rl < 0 || rl >= n || cl < 0 || cl >= n) continue;
      const mid = rm * n + cm, land = rl * n + cl;
      if (b[mid] === 0 || b[land] !== 0 || stamp[land] === stampN || !ok(land)) continue;
      stamp[land] = stampN; parent[land] = cur; hopsAt[land] = hopsAt[cur] + 1; queue[qt++] = land;
      const path = []; for (let q = land; q !== i; q = parent[q]) path.push(q); path.reverse();
      out.push({ from: i, to: land, path, hops: hopsAt[land] });
    }
  }
  b[i] = was;
  return out;
}
export function legalMoves(g, seat = g.turn, G = geo(g.variant)) {
  const out = [];
  for (let i = 0; i < G.N; i++) if (g.board[i] === seat) reachFrom(g.board, i, G, seat, out);
  return out;
}
export const legalFrom = (g, i) => (g.board[i] === g.turn ? reachFrom(g.board, i, geo(g.variant), g.turn) : []);
export function tryMove(g, from, to) {
  if (g.winner) return { error: 'The game is over.' };
  if (g.board[from] !== g.turn) return { error: 'That is not your peg.' };
  if (g.board[to] !== 0) return { error: 'That square is taken.' };
  const m = legalFrom(g, from).find((x) => x.to === to);
  if (!m) return { error: 'A peg steps to a neighbouring square or hops over pieces. That square cannot be reached.' };
  return { move: m };
}

// ---- progress and the end of the game
export function progress(g, seat, G = geo(g.variant)) {
  let s = 0; const a = G.adv[seat];
  for (let i = 0; i < G.N; i++) if (g.board[i] === seat) s += a[i];
  return Math.max(0, Math.min(1, (s - G.startSum[seat]) / (G.targetSum[seat] - G.startSum[seat])));
}
export function pegsHome(g, seat, G = geo(g.variant)) { let n = 0; for (const q of G.camps[G.targetC[seat]]) if (g.board[q] === seat) n++; return n; }
// A seat wins when every square of its goal camp is occupied and at least one of those pegs is its own.
export function reachedGoal(g, seat, G = geo(g.variant)) {
  let own = 0; for (const q of G.camps[G.targetC[seat]]) { const v = g.board[q]; if (!v) return false; if (v === seat) own++; }
  return own > 0;
}
const canMove = (g, seat, G) => { for (let i = 0; i < G.N; i++) if (g.board[i] === seat && reachFrom(g.board, i, G, seat).length) return true; return false; };

export function applyMove(g, m) {
  const G = geo(g.variant), seat = g.turn;
  g.board[m.to] = seat; g.board[m.from] = 0; g.moves++;
  g.last = { from: m.from, to: m.to, seat, path: [m.from, ...m.path] };
  if (reachedGoal(g, seat, G)) { g.winner = seat; g.reason = `${NAMES[seat]} filled the goal camp.`; return; }
  let nxt = seat, found = false;
  for (let k = 0; k < G.seats && !found; k++) { nxt = nxt % G.seats + 1; found = canMove(g, nxt, G); }
  g.turn = nxt;
  if (!found) { g.winner = 9; g.reason = 'Nobody can move.'; return; }
  if (g.moves >= G.limit) {
    let best = 0, bs = -1, tie = false;
    for (let s = 1; s <= G.seats; s++) { const p = progress(g, s, G); if (p > bs + 1e-9) { bs = p; best = s; tie = false; } else if (Math.abs(p - bs) <= 1e-9) tie = true; }
    g.winner = tie ? 9 : best;
    g.reason = tie ? 'Move limit reached with equal progress.' : `Move limit reached. ${NAMES[best]} was furthest ahead.`;
  }
}

export function describeMove(g, m) {
  const n = geo(g.variant).n;
  if (!m.hops) return `Step from ${squareName(m.from, n)} to ${squareName(m.to, n)}.`;
  return `${m.hops === 1 ? 'Hop' : `Hop ${m.hops} times`} from ${squareName(m.from, n)} to ${squareName(m.to, n)}.`;
}
