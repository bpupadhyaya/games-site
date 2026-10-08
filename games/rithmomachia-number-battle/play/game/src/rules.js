// Rithmomachia Number Battle: the rule book as code. The single source of truth for legality; content.js is cross-checked against it.
// Board: 8 files by 16 ranks (two chess boards end to end). Square index i = rank * 8 + file; rank 0 is Ink's back rank, rank 15 is Ivory's.
// A piece is one integer: (side << 16) | (shape << 12) | value. Side 1 = Ivory (moves first, starts at the bottom), side 2 = Ink.
export const COLS = 8, ROWS = 16, SZ = 128;
export const ROUND = 1, TRI = 2, SQR = 3;
export const NAMES = ['', 'Ivory', 'Ink'];
export const SHAPE_NAME = ['', 'round', 'triangle', 'square'];
export const TAKE_TARGET = 10;       // pieces to take for the victory of the body
export const PLY_LIMIT = 200;        // 100 moves each, then the heavier haul wins
export const mk = (side, shape, val) => (side << 16) | (shape << 12) | val;
export const sideOf = (p) => p >> 16;
export const shapeOf = (p) => (p >> 12) & 15;
export const valOf = (p) => p & 4095;

// Each side: back rank squares, second rank triangles, a free rank, then the front rank of rounds (left to right as Ivory sees them).
const SQUARES = { 1: [48, 96, 54, 81], 2: [36, 54, 96, 64] };
const SQUARE_FILES = [1, 3, 4, 6];
const TRIS = { 1: [12, 21, 15, 24, 8, 32, 36, 64], 2: [10, 15, 14, 24, 48, 18, 32, 21] };
const ROUNDS = { 1: [3, 5, 7, 9, 27, 6, 18, 16], 2: [2, 4, 6, 8, 9, 12, 16, 27] };
export function startBoard() {
  const b = new Array(SZ).fill(0);
  for (const side of [1, 2]) {
    const put = (rel, file, shape, val) => {
      const r = side === 1 ? 15 - rel : rel, c = side === 1 ? file : 7 - file;
      b[r * 8 + c] = mk(side, shape, val);
    };
    SQUARE_FILES.forEach((f, k) => put(0, f, SQR, SQUARES[side][k]));
    TRIS[side].forEach((v, f) => put(1, f, TRI, v));
    ROUNDS[side].forEach((v, f) => put(3, f, ROUND, v));
  }
  return b;
}
export const START = 20;

export function newGame() {
  return { board: startBoard(), turn: 1, moves: 0, lost: [0, 0, 0], haul: [0, 0, 0], last: null, info: [], winner: 0, reason: '', pend: null, arr: null };
}
export const clone = (g) => JSON.parse(JSON.stringify(g));
export const pieceCount = (g, side) => { let n = 0; for (let i = 0; i < SZ; i++) if (g.board[i] && sideOf(g.board[i]) === side) n++; return n; };

// ---- movement
const D_ROUND = [[0, 1], [0, -1], [1, 0], [-1, 0]];
const D_TRI = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
const D_SQR = [[0, 3], [0, -3], [3, 0], [-3, 0]];
export const DIRS = [null, D_ROUND, D_TRI, D_SQR];
export const MOVE_TEXT = ['', 'one square straight (up, down, left or right)', 'exactly two squares diagonally, jumping the square between', 'exactly 3 squares straight, jumping the squares between'];

// Ratio rule: the two numbers are equal (1:1) or stand in one of the simple ratios 1:2, 1:3 or 2:3 (either way round).
export function ratioKind(m, t) {
  if (m === t) return 'equal';
  if (t === 2 * m || t === 3 * m || m === 2 * t || m === 3 * t || 3 * m === 2 * t || 2 * m === 3 * t) return 'ratio';
  return null;
}
export function ratioOf(m, t) {          // the simple ratio of the smaller to the larger, e.g. [2, 3]
  const lo = Math.min(m, t), hi = Math.max(m, t);
  for (const [p, q] of [[1, 2], [1, 3], [2, 3]]) if (lo * q === hi * p) return [p, q];
  return null;
}
// Destinations of the piece on square i: empty squares only (pieces are taken by touching, not by landing).
export function destinations(b, i, out) {
  const p = b[i], r = (i >> 3), c = i & 7;
  const dirs = DIRS[(p >> 12) & 15];
  for (let k = 0; k < 4; k++) {
    const nr = r + dirs[k][0], nc = c + dirs[k][1];
    if (nr < 0 || nr > 15 || nc < 0 || nc > 7) continue;
    const to = nr * 8 + nc;
    if (!b[to]) out.push(to);
  }
}
// Touch: after a piece arrives on `to`, every enemy piece on the four squares touching it (up, down, left, right) whose number stands to
// the mover's in equality or a simple ratio is taken. Returns [{ sq, kind, m, t }] (no board change).
const AD4 = [[0, 1], [0, -1], [1, 0], [-1, 0]];
export function touches(b, to, side) {
  const out = [], m = b[to] & 4095, r0 = to >> 3, c0 = to & 7;
  for (let k = 0; k < 4; k++) {
    const r = r0 + AD4[k][0], c = c0 + AD4[k][1];
    if (r < 0 || r > 15 || c < 0 || c > 7) continue;
    const e = b[r * 8 + c];
    if (e && (e >> 16) !== side) { const kind = ratioKind(m, e & 4095); if (kind) out.push({ sq: r * 8 + c, kind, m, t: e & 4095 }); }
  }
  return out;
}

// Ambush: from the mover's square, in each direction the first piece met is an enemy piece E and the next piece beyond E (nothing between)
// is one of the mover's own pieces Y; if mover + Y = E, E is taken. Returns [{sq, y, ysq}] (no board change).
const AD = [[0, 1], [0, -1], [1, 0], [-1, 0]];
export function ambushes(b, to, side) {
  const out = [], m = b[to] & 4095;
  const r0 = to >> 3, c0 = to & 7;
  for (let k = 0; k < 4; k++) {
    let r = r0 + AD[k][0], c = c0 + AD[k][1];
    while (r >= 0 && r < 16 && c >= 0 && c < 8 && !b[r * 8 + c]) { r += AD[k][0]; c += AD[k][1]; }
    if (r < 0 || r > 15 || c < 0 || c > 7) continue;
    const e = b[r * 8 + c]; if ((e >> 16) === side) continue;
    let r2 = r + AD[k][0], c2 = c + AD[k][1];
    while (r2 >= 0 && r2 < 16 && c2 >= 0 && c2 < 8 && !b[r2 * 8 + c2]) { r2 += AD[k][0]; c2 += AD[k][1]; }
    if (r2 < 0 || r2 > 15 || c2 < 0 || c2 > 7) continue;
    const y = b[r2 * 8 + c2];
    if ((y >> 16) === side && m + (y & 4095) === (e & 4095)) out.push({ sq: r * 8 + c, y: y & 4095, ysq: r2 * 8 + c2 });
  }
  return out;
}

// ---- arrangements (the victories of the proportions)
// Three of your pieces in one line (rank, file or diagonal), all inside the enemy half, with nothing standing between them and at most one
// empty square between neighbours; their numbers in line order have the middle one strictly between the ends and form an arithmetic,
// geometric or harmonic progression.
export const KINDS = { arithmetic: 'Arithmetic', geometric: 'Geometric', harmonic: 'Harmonic' };
export function progression(x, y, z) {
  if (x === y || y === z || x === z) return null;
  const lo = Math.min(x, z), hi = Math.max(x, z);
  if (y <= lo || y >= hi) return null;
  if (2 * y === lo + hi) return 'arithmetic';
  if (y * y === lo * hi) return 'geometric';
  if (y * (lo + hi) === 2 * lo * hi) return 'harmonic';
  return null;
}
export const inEnemyHalf = (side, i) => (side === 1 ? (i >> 3) <= 7 : (i >> 3) >= 8);
const LD = [[0, 1], [1, 0], [1, 1], [1, -1]];
const GAPS = [[1, 1], [1, 2], [2, 1], [2, 2]];
// Arrangements of `side` that include square `at` (or all of them when at < 0). Returns { sq: [a,b,c], kind, vals, codes } or null.
export function findArr(b, side, at = -1) {
  const tryLine = (r, c, d, g1, g2) => {
    const r1 = r + g1 * d[0], c1 = c + g1 * d[1], r2 = r1 + g2 * d[0], c2 = c1 + g2 * d[1];
    if (r < 0 || r > 15 || c < 0 || c > 7 || r2 < 0 || r2 > 15 || c2 < 0 || c2 > 7 || c1 < 0 || c1 > 7) return null;
    const s0 = r * 8 + c, s1 = r1 * 8 + c1, s2 = r2 * 8 + c2, p0 = b[s0], p1 = b[s1], p2 = b[s2];
    if (!p0 || !p1 || !p2 || (p0 >> 16) !== side || (p1 >> 16) !== side || (p2 >> 16) !== side) return null;
    if (!inEnemyHalf(side, s0) || !inEnemyHalf(side, s1) || !inEnemyHalf(side, s2)) return null;
    if (g1 === 2 && b[(r + d[0]) * 8 + c + d[1]]) return null;
    if (g2 === 2 && b[(r1 + d[0]) * 8 + c1 + d[1]]) return null;
    const kind = progression(p0 & 4095, p1 & 4095, p2 & 4095);
    return kind ? { sq: [s0, s1, s2], kind, vals: [p0 & 4095, p1 & 4095, p2 & 4095], codes: [p0, p1, p2] } : null;
  };
  if (at >= 0) {
    const r0 = at >> 3, c0 = at & 7;
    for (const d of LD) for (const [g1, g2] of GAPS) {
      let a = tryLine(r0, c0, d, g1, g2); if (a) return a;                                  // `at` is the first piece
      a = tryLine(r0 - g1 * d[0], c0 - g1 * d[1], d, g1, g2); if (a) return a;               // the middle one
      a = tryLine(r0 - (g1 + g2) * d[0], c0 - (g1 + g2) * d[1], d, g1, g2); if (a) return a;  // the last one
    }
    return null;
  }
  for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) for (const d of LD) for (const [g1, g2] of GAPS) { const a = tryLine(r, c, d, g1, g2); if (a) return a; }
  return null;
}

// ---- legality and consequences (nothing here changes the game)
export function legalFrom(g, from) {
  const p = g.board[from]; if (!p || sideOf(p) !== g.turn) return [];
  const out = []; destinations(g.board, from, out); return out;
}
export function allMoves(g, side = g.turn) {
  const out = [], tmp = [];
  for (let i = 0; i < SZ; i++) {
    const p = g.board[i]; if (!p || sideOf(p) !== side) continue;
    tmp.length = 0; destinations(g.board, i, tmp);
    for (const to of tmp) out.push({ from: i, to });
  }
  return out;
}
// What a move would take: [{ sq, kind: 'equal' | 'ratio' | 'sum', m, t, y? }]
export function previewInfo(g, from, to) {
  const b = g.board.slice(), p = b[from], side = sideOf(p);
  b[to] = p; b[from] = 0;
  const info = touches(b, to, side);
  for (const a of ambushes(b, to, side)) if (!info.some((x) => x.sq === a.sq)) info.push({ sq: a.sq, kind: 'sum', m: valOf(p), y: a.y, ysq: a.ysq, t: valOf(b[a.sq]) });
  return info;
}
export const previewCaps = (g, from, to) => previewInfo(g, from, to).map((x) => x.sq);

export function tryMove(g, from, to) {
  const p = g.board[from];
  if (!p) return { error: 'There is no piece on that square.' };
  if (sideOf(p) !== g.turn) return { error: `It is ${NAMES[g.turn]}’s turn.` };
  const q = g.board[to];
  const r = (to >> 3) - (from >> 3), c = (to & 7) - (from & 7), dirs = DIRS[shapeOf(p)];
  if (!dirs.some((d) => d[0] === r && d[1] === c)) return { error: `A ${SHAPE_NAME[shapeOf(p)]} moves ${MOVE_TEXT[shapeOf(p)]}.` };
  if (q) return { error: 'That square is taken. Pieces never land on another piece; they take by touching.' };
  return { ok: true };
}

export function endangered(g, side) {
  const set = new Set(), opp = 3 - side;
  const gg = { board: g.board, turn: opp };
  for (const m of allMoves(gg, opp)) for (const sq of previewCaps(gg, m.from, m.to)) set.add(sq);
  return set;
}

// The arrangement a move would complete, or null.
export function arrAfter(g, from, to) {
  const b = g.board.slice(), p = b[from]; b[to] = p; b[from] = 0;
  return findArr(b, sideOf(p), to);
}
// Moves by `side` that would complete an arrangement: [{ from, to, arr }]
export function arrThreats(g, side) {
  const out = [], gg = { board: g.board, turn: side };
  for (const m of allMoves(gg, side)) { const arr = arrAfter(g, m.from, m.to); if (arr) out.push({ from: m.from, to: m.to, arr }); }
  return out;
}
export function describeMove(g, m) {
  const p = g.board[m.from], info = previewInfo(g, m.from, m.to), arr = arrAfter(g, m.from, m.to);
  const base = `the ${valOf(p)} ${SHAPE_NAME[shapeOf(p)]}`;
  if (arr) return `Move ${base}: it completes the ${KINDS[arr.kind]} arrangement ${arr.vals.join(', ')} and wins.`;
  if (!info.length) return `Move ${base}.`;
  return `Move ${base}: ${info.map(captureText).join('; ')}.`;
}
export function captureText(x) {
  if (x.kind === 'equal') return `${x.m} touches ${x.t}, equal, taken`;
  if (x.kind === 'ratio') { const [p, q] = ratioOf(x.m, x.t); return `${x.m} : ${x.t} is ${x.m < x.t ? p + ' : ' + q : q + ' : ' + p}, taken`; }
  return `${x.m} + ${x.y} = ${x.t}, ambushed`;
}
export function mathLine(x) {
  if (x.kind === 'equal') return `${x.m} = ${x.t}`;
  if (x.kind === 'ratio') { const [p, q] = ratioOf(x.m, x.t); return `${x.m} : ${x.t} = ${x.m < x.t ? p + ' : ' + q : q + ' : ' + p}`; }
  return `${x.m} + ${x.y} = ${x.t}`;
}

// ---- making a move. Returns the squares taken (in order); records g.info (what was taken and why) for the screen.
export function applyMove(g, m) {
  const b = g.board, side = g.turn, opp = 3 - side, p = b[m.from];
  const info = previewInfo(g, m.from, m.to);
  b[m.to] = p; b[m.from] = 0;
  for (const x of info) { g.lost[opp] += 1; g.haul[opp] += x.t; b[x.sq] = 0; }
  g.last = { from: m.from, to: m.to, side }; g.info = info; g.moves += 1; g.turn = opp;
  const arr = findArr(b, side, m.to);
  if (arr) { g.arr = arr; g.winner = side; g.reason = `${NAMES[side]} formed the ${arr.kind} arrangement ${arr.vals.join(' · ')} in the enemy camp.`; return info.map((x) => x.sq); }
  if (g.lost[opp] >= TAKE_TARGET) { g.winner = side; g.reason = `${NAMES[side]} took ${TAKE_TARGET} pieces: the victory of the body.`; }
  else if (g.moves >= PLY_LIMIT) {
    const a = g.haul[2], c = g.haul[1];     // haul[opp] = value of opp's pieces lost
    if (a === c) { g.winner = 3; g.reason = 'Move limit reached with equal hauls.'; }
    else { g.winner = a > c ? 1 : 2; g.reason = `Move limit reached: ${NAMES[g.winner]} took the greater total of numbers (${Math.max(a, c)} to ${Math.min(a, c)}).`; }
  } else if (!allMoves(g, opp).length) { g.winner = side; g.reason = `${NAMES[opp]} has no move.`; }
  return info.map((x) => x.sq);
}
