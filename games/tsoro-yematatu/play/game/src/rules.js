// The rule book: the single source of truth for what is legal (the view, the AI, the lessons and the tests all ask this file).
// A position is a graph: points joined along straight lines. A man stands on a point. Three of one side on three neighbouring points of
// one line win. Each side first DROPS its stones one at a time, then SLIDES them one step along a line onto an empty point.
// Variants differ only in the graph and the number of stones, so every rule below is written once, for any triangle.
export const SIDE_NAMES = { 1: 'Sun', 2: 'River' };
export const NAMES = SIDE_NAMES;

// Points are in unit-square coordinates (x right, y down) with the triangle's apex on top.
const rowsLattice = (n) => {
  const pts = [], idx = [];
  for (let r = 0; r < n; r++) { idx.push([]); for (let c = 0; c <= r; c++) { idx[r].push(pts.length); pts.push({ x: 0.5 + (c - r / 2) * (0.8 / (n - 1)), y: 0.1 + r * (0.8 / (n - 1)) }); } }
  const lines = [];
  for (let r = 0; r < n; r++) lines.push(idx[r].slice());
  for (let c = 0; c < n; c++) { const l = []; for (let r = c; r < n; r++) l.push(idx[r][c]); lines.push(l); }       // down-left to down-right diagonals
  for (let c = 0; c < n; c++) { const l = []; for (let r = c; r < n; r++) l.push(idx[r][r - c]); lines.push(l); }
  return { pts, lines: lines.filter((l) => l.length >= 3) };
};
const grand = () => {
  const pts = [{ x: 0.5, y: 0.1 }];
  for (let k = 1; k <= 3; k++) for (const s of [-1, 0, 1]) pts.push({ x: 0.5 + s * 0.4 * ((k + 1) / 4), y: 0.1 + k * (0.8 / 3) });
  const at = (k, s) => 1 + (k - 1) * 3 + (s + 1);
  const lines = [];
  for (const s of [-1, 0, 1]) lines.push([0, at(1, s), at(2, s), at(3, s)]);
  for (let k = 1; k <= 3; k++) lines.push([at(k, -1), at(k, 0), at(k, 1)]);
  return { pts, lines };
};
const classic = {
  pts: [{ x: 0.5, y: 0.1 }, { x: 0.3, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.7, y: 0.5 }, { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 }],
  lines: [[0, 1, 4], [0, 2, 5], [0, 3, 6], [1, 2, 3], [4, 5, 6]],
};
const build = (key, name, blurb, stones, g) => {
  const n = g.pts.length, adj = Array.from({ length: n }, () => []), triples = [];
  for (const l of g.lines) {
    for (let k = 0; k + 1 < l.length; k++) { const a = l[k], b = l[k + 1]; if (!adj[a].includes(b)) adj[a].push(b); if (!adj[b].includes(a)) adj[b].push(a); }
    for (let k = 0; k + 2 < l.length; k++) triples.push([l[k], l[k + 1], l[k + 2]]);
  }
  let gap = 9; for (let i = 0; i < n; i++) for (const j of adj[i]) gap = Math.min(gap, Math.hypot(g.pts[i].x - g.pts[j].x, g.pts[i].y - g.pts[j].y));
  return { key, name, blurb, stones, n, pts: g.pts, lines: g.lines, adj, triples, gap, pieceScale: Math.max(0.72, Math.min(1.2, gap * 5 * 0.7)) };
};
export const VARIANTS = {
  classic: build('classic', 'Classic', 'Seven points, three stones each. The original.', 3, classic),
  grand: build('grand', 'Grand', 'Ten points on three bars, four stones each.', 4, grand()),
  tens: build('tens', 'Ten Points', 'A triangle of ten points, three stones each.', 3, rowsLattice(4)),
};
export const VARIANT_KEYS = ['classic', 'grand', 'tens'];
export const variantOf = (key) => VARIANTS[key] || VARIANTS.classic;
export const MOVE_CAP = 120;                                         // plies: a game that long is a draw

export const sideOf = (v) => v;
export function newGame(key = 'classic') {
  const V = variantOf(key);
  return { variant: V.key, board: new Int8Array(V.n), turn: 1, placed: [0, 0, 0], moves: 0, winner: 0, reason: '', line: null, last: null, seen: {} };
}
export function clone(g) { return { ...g, board: Int8Array.from(g.board), placed: g.placed.slice(), seen: { ...g.seen }, line: g.line ? g.line.slice() : null, last: g.last ? { ...g.last } : null }; }
export const inDrop = (g) => g.placed[g.turn] < variantOf(g.variant).stones;
export const stonesLeft = (g, side) => variantOf(g.variant).stones - g.placed[side];

// Legal moves for the side to move: { kind: 'drop'|'slide', from (-1 for a drop), to }
export function genMoves(board, side, placed, V) {
  const out = [];
  if (placed[side] < V.stones) { for (let i = 0; i < V.n; i++) if (!board[i]) out.push({ kind: 'drop', from: -1, to: i }); return out; }
  for (let i = 0; i < V.n; i++) if (board[i] === side) for (const j of V.adj[i]) if (!board[j]) out.push({ kind: 'slide', from: i, to: j });
  return out;
}
export const legalMoves = (g) => (g.winner ? [] : genMoves(g.board, g.turn, g.placed, variantOf(g.variant)));
export const legalFrom = (g, from) => legalMoves(g).filter((m) => m.from === from);
// The three-in-a-row a side holds on this board, or null.
export function lineOf(board, side, V) {
  for (const t of V.triples) if (board[t[0]] === side && board[t[1]] === side && board[t[2]] === side) return t;
  return null;
}
export const key = (g) => Array.prototype.join.call(g.board, '') + '|' + g.turn + '|' + g.placed[1] + g.placed[2];

export function tryMove(g, from, to) {
  const V = variantOf(g.variant);
  if (g.winner) return { error: 'The game is over.' };
  if (to < 0 || to >= V.n) return { error: 'That is not a point on the board.' };
  if (g.board[to]) return { error: 'That point is taken.' };
  if (inDrop(g)) { if (from >= 0) return { error: 'You still have stones to place: tap an empty point to drop one.' }; return { move: { kind: 'drop', from: -1, to } }; }
  if (from < 0 || g.board[from] !== g.turn) return { error: 'Tap one of your stones first.' };
  if (!V.adj[from].includes(to)) return { error: 'A stone slides one step along a line, to a point next to it.' };
  return { move: { kind: 'slide', from, to } };
}

// Applies a legal move in place and settles the game: a line wins, a blocked opponent loses, a third repetition or the cap is a draw.
export function applyMove(g, m) {
  const V = variantOf(g.variant), me = g.turn;
  if (m.kind === 'drop') { g.board[m.to] = me; g.placed[me]++; } else { g.board[m.from] = 0; g.board[m.to] = me; }
  g.moves++; g.last = { from: m.from, to: m.to, kind: m.kind, side: me };
  const ln = lineOf(g.board, me, V);
  if (ln) { g.winner = me; g.line = ln; g.reason = `${SIDE_NAMES[me]} made three in a row.`; return g; }
  g.turn = 3 - me;
  if (genMoves(g.board, g.turn, g.placed, V).length === 0) { g.winner = me; g.reason = `${SIDE_NAMES[g.turn]} cannot move: every stone is blocked.`; return g; }
  const k = key(g); g.seen[k] = (g.seen[k] || 0) + 1;
  if (g.seen[k] >= 3) { g.winner = 3; g.reason = 'The same position came up three times.'; return g; }
  if (g.moves >= MOVE_CAP) { g.winner = 3; g.reason = 'No one broke through in a long game.'; return g; }
  return g;
}
// Points where `side` would complete a line if it were to move now (used for threat marks, hints and the tutor).
export function threats(g, side) {
  const V = variantOf(g.variant), out = new Set(), b = Int8Array.from(g.board);
  for (const m of genMoves(b, side, g.placed, V)) {
    if (m.kind === 'drop') b[m.to] = side; else { b[m.from] = 0; b[m.to] = side; }
    if (lineOf(b, side, V)) out.add(m.to);
    if (m.kind === 'drop') b[m.to] = 0; else { b[m.to] = 0; b[m.from] = side; }
  }
  return out;
}
// Plain-words names for the points, for the tutor lines ("the top point", "row 3, middle").
const CLASSIC_NAMES = ['the top point', 'the upper left point', 'the centre point', 'the upper right point', 'the bottom left corner', 'the bottom middle point', 'the bottom right corner'];
export function pointName(variant, i) {
  const V = variantOf(variant);
  if (V.key === 'classic') return CLASSIC_NAMES[i];
  const ys = [...new Set(V.pts.map((p) => p.y.toFixed(3)))].sort((a, b) => a - b), p = V.pts[i], r = ys.indexOf(p.y.toFixed(3));
  if (r === 0) return 'the top point';
  const row = V.pts.map((q, k) => ({ k, x: q.x, y: q.y.toFixed(3) })).filter((q) => q.y === ys[r]).sort((a, b) => a.x - b.x), c = row.findIndex((q) => q.k === i);
  const labels = { 2: ['left', 'right'], 3: ['left', 'middle', 'right'], 4: ['far left', 'left', 'right', 'far right'] }[row.length] || row.map((_, k) => String(k + 1));
  return `row ${r + 1}, ${labels[c]}`;
}
export function describeMove(g, m) {
  return m.kind === 'drop' ? `drop a stone on ${pointName(g.variant, m.to)}` : `slide the stone on ${pointName(g.variant, m.from)} to ${pointName(g.variant, m.to)}`;
}
