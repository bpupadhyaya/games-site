// Tafl rule book. THE truth: engine.js searches with these same functions, so the two can never disagree.
//
// Board: n x n squares (7 or 11), index = x + n*y, y = 0 is the FAR (top) edge.
// Squares hold 0 empty, 1 attacker, 2 defender, 3 king (a defender that is also armed and escapes).
// Side to move: 1 = attackers (they move first), 2 = defenders.
//
// Ruleset (a documented simplification of Copenhagen Hnefatafl; 7x7 is a Brandubh-style small board):
//  - Every piece moves like a rook: any distance in a straight line over empty squares, never jumping.
//  - Only the king may stop on the throne (centre) or on a corner. Others may pass over the EMPTY throne.
//  - Capture (custodian): moving so that an enemy piece lies between the moved piece and another piece of
//    yours captures it. Moving in between two enemies is safe. The king counts as a capturing defender.
//  - The corners are hostile to everyone. The throne is hostile to attackers always, and to defenders
//    only while it is empty.
//  - The king reaches a corner: defenders win. The king is captured: attackers win.
//  - 11x11: the king is taken by four attackers around it (three plus the throne when he stands next to it;
//    on an edge, three attackers or two plus a corner). 7x7: an ordinary sandwich is enough away from the throne.
//  - Attackers also win by unbroken ring around every defender (diagonal links count). A side with no legal
//    move loses. The same position a third time is a draw, and so is move 300.
//  - Left out on purpose: shieldwall captures and the edge-fort rule.
export const ATT = 1, DEF = 2, KING = 3;
export const SIZES = { 7: { n: 7, name: 'Brandubh', sub: 'small board', att: 8, def: 4 }, 11: { n: 11, name: 'Copenhagen', sub: 'full board', att: 24, def: 12 } };
export const MAX_PLY = 300;

// starting positions as text rows (A attacker, D defender, K king)
const START = {
  7: ['...A...', '...A...', '...D...', 'AADKDAA', '...D...', '...A...', '...A...'],
  11: ['...AAAAA...', '.....A.....', '...........', 'A....D....A', 'A...DDD...A', 'AA.DDKDD.AA', 'A...DDD...A', 'A....D....A', '...........', '.....A.....', '...AAAAA...'],
};

export const throne = (n) => (n >> 1) + n * (n >> 1);
export const corners = (n) => [0, n - 1, n * (n - 1), n * n - 1];
export const isCorner = (n, i) => i === 0 || i === n - 1 || i === n * (n - 1) || i === n * n - 1;
export const xy = (n, i) => ({ x: i % n, y: (i / n) | 0 });

export function fromRows(rows, turn = ATT) {
  const n = rows.length, b = [];
  let king = -1;
  rows.forEach((r, y) => [...r].forEach((c, x) => { const v = c === 'A' ? ATT : c === 'D' ? DEF : c === 'K' ? KING : 0; b.push(v); if (v === KING) king = x + n * y; }));
  return { n, b, turn, king, winner: 0, reason: '', ply: 0, seen: {}, last: null, caps: [] };
}
export function newGame(size = 11) {
  const g = fromRows(START[size], ATT);
  g.seen[key(g)] = 1;
  return g;
}
export const clone = (g) => JSON.parse(JSON.stringify(g));
export const key = (g) => g.b.join('') + g.turn;
export const side = (v) => (v === ATT ? ATT : v === 0 ? 0 : DEF);
export const NAME = { 1: 'attackers', 2: 'defenders' };

const DIRS = (n) => [1, -1, n, -n];
const inRow = (n, i, d) => (d === 1 ? i % n < n - 1 : d === -1 ? i % n > 0 : d === n ? i < n * (n - 1) : i >= n);

// May a piece of this kind stop on square i?
export const canStop = (g, v, i) => v === KING || !(i === throne(g.n) || isCorner(g.n, i));

// Every legal destination of the piece on `from`.
export function destinations(g, from, out = []) {
  const n = g.n, v = g.b[from], th = throne(n);
  for (const d of DIRS(n)) {
    let i = from;
    while (inRow(n, i, d)) {
      i += d;
      if (g.b[i] !== 0) break;
      if (v === KING || (i !== th && !isCorner(n, i))) out.push(i);
    }
  }
  return out;
}
export function legalMoves(g) {
  const out = [], mine = g.turn;
  for (let i = 0; i < g.b.length; i++) {
    const v = g.b[i];
    if (v && side(v) === mine) { const ds = destinations(g, i); for (const to of ds) out.push({ from: i, to }); }
  }
  return out;
}

// Why can this piece not go there? Plain language for the player.
export function tryMove(g, from, to) {
  const n = g.n, v = g.b[from];
  if (!v) return { error: 'There is no piece there to move.' };
  if (side(v) !== g.turn) return { error: `It is the ${NAME[g.turn]}' turn.` };
  if (from === to) return { error: 'Tap a different square to move there.' };
  const a = xy(n, from), b = xy(n, to);
  if (a.x !== b.x && a.y !== b.y) return { error: 'Pieces move in straight lines, like a rook: along a row or a column, not diagonally.' };
  const d = a.x === b.x ? (b.y > a.y ? n : -n) : (b.x > a.x ? 1 : -1);
  for (let i = from + d; ; i += d) {
    if (g.b[i] !== 0) return { error: i === to ? 'That square is occupied.' : 'A piece is in the way. Pieces cannot jump over others.' };
    if (i === to) break;
  }
  if (!canStop(g, v, to)) return { error: isCorner(n, to) ? 'Only the king may stand on a corner.' : 'Only the king may stand on the throne in the centre.' };
  return { move: { from, to } };
}

// Which enemy pieces does a piece of side `s` standing on `to` capture? (king excluded: see kingTaken)
export function captureList(g, to, s, out = []) {
  const n = g.n, b = g.b, th = throne(n);
  for (const d of DIRS(n)) {
    if (!inRow(n, to, d)) continue;
    const a = to + d, v = b[a];
    if (!v || v === KING || side(v) === s || !inRow(n, a, d)) continue;
    const c = a + d, w = b[c];
    let hostile = false;
    if (w && side(w) === s) hostile = true;                 // includes the armed king
    else if (w === 0) hostile = isCorner(n, c) || (c === th && (v === ATT || b[th] === 0));
    else if (c === th && v === ATT) hostile = true;         // king sitting on the throne is hostile to attackers too (covered above), kept for clarity
    if (hostile) out.push(a);
  }
  return out;
}

// Is the king taken, given attackers just moved to (or the board changed near) his square?
export function kingTaken(g) {
  if (g.king < 0) return false;
  const n = g.n, k = g.king, b = g.b, th = throne(n), { x, y } = xy(n, k);
  const hostileAt = (i) => (i >= 0 && b[i] === ATT) || isCorner(n, i) || (i === th && b[i] === 0);
  const nb = [];
  if (x > 0) nb.push(k - 1); if (x < n - 1) nb.push(k + 1); if (y > 0) nb.push(k - n); if (y < n - 1) nb.push(k + n);
  const nearThrone = k === th || nb.includes(th) || [th - 1, th + 1, th - n, th + n].includes(k);
  const strict = n === 11 || nearThrone;
  if (strict) {                                   // every open side must be an attacker (throne next to him counts, and so do corners on an edge)
    if (nb.length < 4) return nb.every((i) => b[i] === ATT || isCorner(n, i));   // on an edge
    return nb.every((i) => b[i] === ATT || (i === th && k !== th));
  }
  // 7x7 away from the throne: an ordinary sandwich along a row or a column
  if (x > 0 && x < n - 1 && hostileAt(k - 1) && hostileAt(k + 1)) return true;
  if (y > 0 && y < n - 1 && hostileAt(k - n) && hostileAt(k + n)) return true;
  return false;
}

// Core move: changes the board and turn, records captures; no history, no ring test (the search uses it directly).
// Returns an undo record for unmake.
export function make(g, from, to) {
  const b = g.b, v = b[from], s = side(v), rec = { from, to, v, caps: [], king: g.king, winner: g.winner, reason: g.reason };
  b[from] = 0; b[to] = v;
  if (v === KING) g.king = to;
  const caps = captureList(g, to, s);
  for (const c of caps) { rec.caps.push(c, b[c]); b[c] = 0; }
  g.turn = s === ATT ? DEF : ATT;
  if (v === KING && isCorner(g.n, to)) { g.winner = DEF; g.reason = 'The king reached a corner.'; }
  else if (s === ATT && kingTaken(g)) { g.winner = ATT; g.reason = 'The king is surrounded and taken.'; }
  return rec;
}
export function unmake(g, r) {
  const b = g.b;
  b[r.to] = 0; b[r.from] = r.v;
  for (let k = 0; k < r.caps.length; k += 2) b[r.caps[k]] = r.caps[k + 1];
  g.king = r.king; g.winner = r.winner; g.reason = r.reason;
  g.turn = side(r.v);
}

// Are all defenders shut in by an unbroken ring of attackers (diagonal links count)?
export function ringed(g) {
  const n = g.n, b = g.b, seen = new Uint8Array(n * n), stack = [];
  for (let i = 0; i < b.length; i++) if (b[i] === DEF || b[i] === KING) { seen[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop(), { x, y } = xy(n, i);
    if (x === 0 || y === 0 || x === n - 1 || y === n - 1) return false;
    for (const j of [i - 1, i + 1, i - n, i + n]) if (!seen[j] && b[j] !== ATT) { seen[j] = 1; stack.push(j); }
  }
  return true;
}

// The full move, with history, for real games. Returns the captured squares.
export function applyMove(g, m) {
  const before = g.b.slice(), rec = make(g, m.from, m.to);
  g.last = { from: m.from, to: m.to }; g.ply += 1;
  g.caps = []; for (let k = 0; k < rec.caps.length; k += 2) g.caps.push({ at: rec.caps[k], v: rec.caps[k + 1] });
  if (!g.winner) {
    if (side(rec.v) === ATT && ringed(g)) { g.winner = ATT; g.reason = 'The attackers have closed an unbroken ring around every defender.'; }
    else if (legalMoves(g).length === 0) { g.winner = side(rec.v); g.reason = `The ${NAME[g.turn]} have no move left.`; }
    else {
      const k = key(g); g.seen[k] = (g.seen[k] || 0) + 1;
      if (g.seen[k] >= 3) { g.winner = 'draw'; g.reason = 'The same position came up three times.'; }
      else if (g.ply >= MAX_PLY) { g.winner = 'draw'; g.reason = 'Three hundred moves without a result.'; }
    }
  }
  g.before = before;
  return g.caps;
}

// Open lines from the king to a corner (he could reach it next move).
export function openCorners(g) {
  if (g.king < 0) return 0;
  const n = g.n, k = g.king, b = g.b; let c = 0;
  for (const d of DIRS(n)) {
    let i = k;
    while (inRow(n, i, d)) { i += d; if (b[i] !== 0) break; if (isCorner(n, i)) { c++; break; } }
  }
  return c;
}
// Attacker pieces that stand between a threatened corner line: squares the attackers could block on.
export const countOf = (g, v) => g.b.reduce((a, c) => a + (c === v ? 1 : 0), 0);
