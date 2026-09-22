// THE RULE BOOK for Xiangqi. Pure and deterministic. The computer (engine.js) uses the same move generator, so
// there is one truth. Read this file first.
//
// Board: 9 files (x = 0..8, left to right as Red sees it) by 10 ranks (y = 0..9, top to bottom). Square index = y * 9 + x.
// Red sits at the bottom (y 5..9), Black at the top (y 0..4). The river lies between y = 4 and y = 5.
// Pieces are numbers: type 1..7, positive = Red, negative = Black.
export const GENERAL = 1, ADVISOR = 2, ELEPHANT = 3, HORSE = 4, CHARIOT = 5, CANNON = 6, SOLDIER = 7;
export const RED = 1, BLACK = -1;
export const TYPE_NAME = ['', 'general', 'advisor', 'elephant', 'horse', 'chariot', 'cannon', 'soldier'];
export const SIDE_NAME = { 1: 'Red', [-1]: 'Black' };
export const sqOf = (x, y) => y * 9 + x;
export const xOf = (s) => s % 9;
export const yOf = (s) => (s / 9) | 0;
const abs = Math.abs;

// ---- geometry tables ------------------------------------------------------------------------------------
const inBoard = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 10;
export const inPalace = (side, s) => { const x = xOf(s), y = yOf(s); return x >= 3 && x <= 5 && (side === RED ? y >= 7 : y <= 2); };
export const ownHalf = (side, s) => (side === RED ? yOf(s) >= 5 : yOf(s) <= 4);
export const crossed = (side, s) => !ownHalf(side, s);
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];                 // up, down, left, right
const DIAG = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const KNIGHT = [[1, 2], [-1, 2], [1, -2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]];
const idx = (side) => (side === RED ? 0 : 1);

const RAYS = [], STEP4 = [[], []], STEP_DIAG = [[], []], ELEPH = [[], []], HMOV = [], HORSE_ATT = [], SOLD = [[], []];
for (let s = 0; s < 90; s++) {
  const x = xOf(s), y = yOf(s);
  RAYS[s] = DIRS.map(([dx, dy]) => { const r = []; for (let a = x + dx, b = y + dy; inBoard(a, b); a += dx, b += dy) r.push(sqOf(a, b)); return r; });
  HMOV[s] = []; HORSE_ATT[s] = [];
  for (const [dx, dy] of KNIGHT) {
    if (inBoard(x + dx, y + dy)) HMOV[s].push([sqOf(x + dx, y + dy), sqOf(x + (abs(dx) === 2 ? dx / 2 : 0), y + (abs(dy) === 2 ? dy / 2 : 0))]);
    // a horse standing at (x-dx, y-dy) reaches s through its leg at (x-dx+sx, y-dy+sy)
    const hx = x - dx, hy = y - dy;
    if (inBoard(hx, hy)) HORSE_ATT[s].push([sqOf(hx, hy), sqOf(hx + (abs(dx) === 2 ? dx / 2 : 0), hy + (abs(dy) === 2 ? dy / 2 : 0))]);
  }
  for (const side of [RED, BLACK]) {
    const i = idx(side);
    STEP4[i][s] = DIRS.filter(([dx, dy]) => inBoard(x + dx, y + dy) && inPalace(side, sqOf(x + dx, y + dy))).map(([dx, dy]) => sqOf(x + dx, y + dy));
    STEP_DIAG[i][s] = DIAG.filter(([dx, dy]) => inBoard(x + dx, y + dy) && inPalace(side, sqOf(x + dx, y + dy))).map(([dx, dy]) => sqOf(x + dx, y + dy));
    ELEPH[i][s] = DIAG.filter(([dx, dy]) => inBoard(x + 2 * dx, y + 2 * dy) && ownHalf(side, sqOf(x + 2 * dx, y + 2 * dy))).map(([dx, dy]) => [sqOf(x + 2 * dx, y + 2 * dy), sqOf(x + dx, y + dy)]);
    const fwd = side === RED ? -1 : 1, out = [];
    if (inBoard(x, y + fwd)) out.push(sqOf(x, y + fwd));
    if (crossed(side, s)) for (const dx of [-1, 1]) if (inBoard(x + dx, y)) out.push(sqOf(x + dx, y));
    SOLD[i][s] = out;
  }
}
export { RAYS };

// ---- Zobrist keys (fixed, so every run agrees) ---------------------------------------------------------------
const ZL = new Int32Array(15 * 90), ZH = new Int32Array(15 * 90);
{ let a = 0x9e3779b9; const next = () => { a = (Math.imul(a ^ (a >>> 15), 0x2c1b3c6d) + 0x297a2d39) | 0; a ^= a >>> 12; a = Math.imul(a, 0x85ebca6b); a ^= a >>> 13; return a | 0; };
  for (let i = 0; i < ZL.length; i++) { ZL[i] = next(); ZH[i] = next(); } }
export const ZOB_L = ZL, ZOB_H = ZH;
export const SIDE_L = 0x5bd1e995 | 0, SIDE_H = 0x1b873593 | 0;
export const zIndex = (p, s) => (p + 7) * 90 + s;
export const keyNum = (hl, hh) => (hh & 0x1fffff) * 4294967296 + (hl >>> 0);
export function positionKey(board, turn) {
  let hl = turn === BLACK ? SIDE_L : 0, hh = turn === BLACK ? SIDE_H : 0;
  for (let s = 0; s < 90; s++) { const p = board[s]; if (p) { hl ^= ZL[zIndex(p, s)]; hh ^= ZH[zIndex(p, s)]; } }
  return keyNum(hl, hh);
}

// ---- start position --------------------------------------------------------------------------------------------
export function startBoard() {
  const b = new Array(90).fill(0), back = [CHARIOT, HORSE, ELEPHANT, ADVISOR, GENERAL, ADVISOR, ELEPHANT, HORSE, CHARIOT];
  for (let x = 0; x < 9; x++) { b[sqOf(x, 0)] = -back[x]; b[sqOf(x, 9)] = back[x]; }
  b[sqOf(1, 2)] = b[sqOf(7, 2)] = -CANNON; b[sqOf(1, 7)] = b[sqOf(7, 7)] = CANNON;
  for (let x = 0; x < 9; x += 2) { b[sqOf(x, 3)] = -SOLDIER; b[sqOf(x, 6)] = SOLDIER; }
  return b;
}

// ---- move generation (pseudo-legal: does not yet check the general's safety) -----------------------------------
// A move is packed as from | (to << 7). buf is an Int32Array (or array); returns the new count.
export function genInto(b, side, buf, n, capsOnly) {
  const i = idx(side);
  for (let s = 0; s < 90; s++) {
    const p = b[s];
    if (p === 0 || (p > 0) !== (side > 0)) continue;
    const t = p > 0 ? p : -p;
    switch (t) {
      case GENERAL: { const l = STEP4[i][s]; for (let k = 0; k < l.length; k++) { const q = b[l[k]]; if (q === 0 ? !capsOnly : (q > 0) !== (side > 0)) buf[n++] = s | (l[k] << 7); } break; }
      case ADVISOR: { const l = STEP_DIAG[i][s]; for (let k = 0; k < l.length; k++) { const q = b[l[k]]; if (q === 0 ? !capsOnly : (q > 0) !== (side > 0)) buf[n++] = s | (l[k] << 7); } break; }
      case ELEPHANT: { const l = ELEPH[i][s]; for (let k = 0; k < l.length; k++) { const e = l[k]; if (b[e[1]] !== 0) continue; const q = b[e[0]]; if (q === 0 ? !capsOnly : (q > 0) !== (side > 0)) buf[n++] = s | (e[0] << 7); } break; }
      case HORSE: { const l = HMOV[s]; for (let k = 0; k < l.length; k++) { const e = l[k]; if (b[e[1]] !== 0) continue; const q = b[e[0]]; if (q === 0 ? !capsOnly : (q > 0) !== (side > 0)) buf[n++] = s | (e[0] << 7); } break; }
      case CHARIOT: for (let d = 0; d < 4; d++) { const r = RAYS[s][d]; for (let k = 0; k < r.length; k++) { const q = b[r[k]]; if (q === 0) { if (!capsOnly) buf[n++] = s | (r[k] << 7); } else { if ((q > 0) !== (side > 0)) buf[n++] = s | (r[k] << 7); break; } } } break;
      case CANNON: for (let d = 0; d < 4; d++) { const r = RAYS[s][d]; let screen = false; for (let k = 0; k < r.length; k++) { const q = b[r[k]]; if (!screen) { if (q === 0) { if (!capsOnly) buf[n++] = s | (r[k] << 7); } else screen = true; } else if (q !== 0) { if ((q > 0) !== (side > 0)) buf[n++] = s | (r[k] << 7); break; } } } break;
      default: { const l = SOLD[i][s]; for (let k = 0; k < l.length; k++) { const q = b[l[k]]; if (q === 0 ? !capsOnly : (q > 0) !== (side > 0)) buf[n++] = s | (l[k] << 7); } }
    }
  }
  return n;
}

// Is square s attacked by side `by`? Includes the "flying general" (the two generals facing along an open file).
export function attacked(b, s, by) {
  const ray = RAYS[s];
  for (let d = 0; d < 4; d++) {
    const r = ray[d]; let screen = false;
    for (let k = 0; k < r.length; k++) {
      const q = b[r[k]]; if (q === 0) continue;
      if (!screen) { if ((q > 0) === (by > 0)) { const t = q > 0 ? q : -q; if (t === CHARIOT || (t === GENERAL && d < 2)) return true; } screen = true; }
      else { if ((q > 0) === (by > 0) && (q > 0 ? q : -q) === CANNON) return true; break; }
    }
  }
  const h = HORSE_ATT[s], hp = by * HORSE;
  for (let k = 0; k < h.length; k++) if (b[h[k][0]] === hp && b[h[k][1]] === 0) return true;
  const x = xOf(s), y = yOf(s), fwd = by === RED ? -1 : 1, sp = by * SOLDIER;
  if (y - fwd >= 0 && y - fwd < 10 && b[sqOf(x, y - fwd)] === sp) return true;
  if (crossed(by, s)) { if (x > 0 && b[s - 1] === sp) return true; if (x < 8 && b[s + 1] === sp) return true; }
  return false;
}
export function kingSquare(b, side) {
  const y0 = side === RED ? 7 : 0, g = side * GENERAL;
  for (let y = y0; y < y0 + 3; y++) for (let x = 3; x <= 5; x++) if (b[sqOf(x, y)] === g) return sqOf(x, y);
  return -1;
}
export function inCheckBoard(b, side) { const k = kingSquare(b, side); return k >= 0 && attacked(b, k, -side); }

const scratch = new Int32Array(160);
function legalFrom(b, side) {                           // array of packed legal moves
  const n = genInto(b, side, scratch, 0, false), out = [];
  for (let i = 0; i < n; i++) {
    const m = scratch[i], f = m & 127, t = m >> 7, cap = b[t]; b[t] = b[f]; b[f] = 0;
    const k = kingSquare(b, side), bad = k >= 0 && attacked(b, k, -side);
    b[f] = b[t]; b[t] = cap;
    if (!bad) out.push(m);
  }
  return out;
}
export const legalPacked = legalFrom;

// ---- the game ---------------------------------------------------------------------------------------------------
// state g = { board[90], turn, log: [{f,t,cap,nc,chk}], keys: [positionKey...], nc (plies since a capture), result }
// result = null while playing, else { winner: 1 | -1 | 0, why }  why: checkmate | stalemate | perpetual | repetition | quiet
export const NO_CAPTURE_LIMIT = 120;
export function newGame() { return fromBoard(startBoard(), RED); }
export function fromBoard(board, turn = RED) {
  const g = { board: board.slice(), turn, log: [], keys: [], nc: 0, result: null };
  g.keys.push(positionKey(g.board, turn));
  judge(g);
  return g;
}
export const clone = (g) => JSON.parse(JSON.stringify(g));
export const legalMoves = (g) => legalFrom(g.board, g.turn).map((m) => ({ from: m & 127, to: m >> 7 }));
export const legalFor = (g, from) => legalMoves(g).filter((m) => m.from === from).map((m) => m.to);
export const inCheck = (g, side = g.turn) => inCheckBoard(g.board, side);
export const isLegal = (g, from, to) => legalFrom(g.board, g.turn).includes(from | (to << 7));

function judge(g) {
  g.result = null;
  const moves = legalFrom(g.board, g.turn);
  if (moves.length === 0) { g.result = { winner: -g.turn, why: inCheckBoard(g.board, g.turn) ? 'checkmate' : 'stalemate' }; return; }
  const n = g.keys.length - 1, key = g.keys[n];
  let count = 0, prev = -1;
  for (let i = n; i >= 0; i -= 2) if (g.keys[i] === key) { count++; if (i < n && prev < 0) prev = i; }
  if (count >= 3 && prev >= 0) {
    // the cycle is the plies after `prev`; a side that gave check with every one of its moves in it is checking perpetually
    let redAll = true, blackAll = true;
    const firstIsRed = g.startTurn !== BLACK, moverRed = (i) => (i % 2 === 0) === firstIsRed;
    for (let i = prev; i < n; i++) { const e = g.log[i]; if (!e.chk) { if (moverRed(i)) redAll = false; else blackAll = false; } }
    if (redAll && !blackAll) g.result = { winner: BLACK, why: 'perpetual' };
    else if (blackAll && !redAll) g.result = { winner: RED, why: 'perpetual' };
    else g.result = { winner: 0, why: 'repetition' };
    return;
  }
  if (g.nc >= NO_CAPTURE_LIMIT) g.result = { winner: 0, why: 'quiet' };
}

// Plays a move that is already known to be legal.
export function applyMove(g, m) {
  const b = g.board, cap = b[m.to], side = g.turn;
  if (g.log.length === 0) g.startTurn = side;
  b[m.to] = b[m.from]; b[m.from] = 0;
  const chk = inCheckBoard(b, -side);
  g.log.push({ f: m.from, t: m.to, cap, nc: g.nc, chk });
  g.nc = cap ? 0 : g.nc + 1;
  g.turn = -side;
  g.keys.push(positionKey(b, g.turn));
  judge(g);
  return { cap, chk };
}
export function undoMove(g) {
  const e = g.log.pop(); if (!e) return false;
  const b = g.board; b[e.f] = b[e.t]; b[e.t] = e.cap;
  g.turn = -g.turn; g.nc = e.nc; g.keys.pop(); judge(g);
  return true;
}

// ---- reasons ------------------------------------------------------------------------------------------------------
const NAME = (p) => TYPE_NAME[abs(p)];
function facing(b) {
  const r = kingSquare(b, RED), k = kingSquare(b, BLACK);
  if (r < 0 || k < 0 || xOf(r) !== xOf(k)) return false;
  for (let y = yOf(k) + 1; y < yOf(r); y++) if (b[sqOf(xOf(k), y)] !== 0) return false;
  return true;
}
// Try a move: { ok: true, move } when legal, otherwise { ok: false, code, why } explaining in plain words.
export function tryMove(g, from, to) {
  const b = g.board, p = b[from];
  if (!p || (p > 0) !== (g.turn > 0)) return { ok: false, code: 'notyours', why: p ? 'That is not your piece. Wait for your turn, or pick one of your own pieces.' : 'There is no piece on that point.' };
  if (isLegal(g, from, to)) return { ok: true, move: { from, to } };
  const side = g.turn, t = abs(p), q = b[to], fx = xOf(from), fy = yOf(from), tx = xOf(to), ty = yOf(to), dx = tx - fx, dy = ty - fy, adx = abs(dx), ady = abs(dy);
  const fail = (code, why) => ({ ok: false, code, why });
  if (to === from) return fail('same', '');
  if (q !== 0 && (q > 0) === (p > 0)) return fail('own', 'One of your own pieces is on that point. You can only capture the opponent\'s pieces.');
  const pieceBetween = (a, c) => { let n = 0; if (xOf(a) === xOf(c)) { for (let y = Math.min(yOf(a), yOf(c)) + 1; y < Math.max(yOf(a), yOf(c)); y++) if (b[sqOf(xOf(a), y)]) n++; } else for (let x = Math.min(xOf(a), xOf(c)) + 1; x < Math.max(xOf(a), xOf(c)); x++) if (b[sqOf(x, yOf(a))]) n++; return n; };
  switch (t) {
    case GENERAL:
      if (!inPalace(side, to)) return fail('palace', 'The general never leaves the palace, the 3 by 3 fortress marked with the two diagonals.');
      if (adx + ady !== 1) return fail('shape', 'The general takes one step straight, never diagonally and never more than one point.');
      break;
    case ADVISOR:
      if (!inPalace(side, to)) return fail('palace', 'The advisor never leaves the palace, the 3 by 3 fortress marked with the two diagonals.');
      if (adx !== 1 || ady !== 1) return fail('shape', 'The advisor takes one step diagonally, along the palace lines.');
      break;
    case ELEPHANT:
      if (adx !== 2 || ady !== 2) return fail('shape', 'The elephant moves exactly two points diagonally, like a leap over the point in between.');
      if (!ownHalf(side, to)) return fail('river', 'The elephant can never cross the river. It guards its own half.');
      if (b[sqOf(fx + dx / 2, fy + dy / 2)] !== 0) return fail('eye', 'The elephant\'s eye is blocked: a piece stands on the point between, so the elephant cannot pass.');
      break;
    case HORSE:
      if (!((adx === 1 && ady === 2) || (adx === 2 && ady === 1))) return fail('shape', 'The horse goes one point straight, then one point diagonally outward, like the letter L.');
      if (b[sqOf(fx + (adx === 2 ? dx / 2 : 0), fy + (ady === 2 ? dy / 2 : 0))] !== 0) return fail('leg', 'The horse is hobbled: a piece stands right next to it in the direction it must first step (its leg), so it cannot go that way.');
      break;
    case CHARIOT:
      if (dx !== 0 && dy !== 0) return fail('shape', 'The chariot moves in straight lines, along a rank or a file, any distance.');
      if (pieceBetween(from, to) > 0) return fail('blocked', 'A piece is in the way. The chariot cannot jump over other pieces.');
      break;
    case CANNON: {
      if (dx !== 0 && dy !== 0) return fail('shape', 'The cannon moves in straight lines, along a rank or a file, like the chariot.');
      const n = pieceBetween(from, to);
      if (q === 0 && n > 0) return fail('blocked', 'A piece is in the way. The cannon moves like a chariot and cannot jump when it is not capturing.');
      if (q !== 0 && n === 0) return fail('nocreen', 'To capture, the cannon must jump over exactly one piece (the screen). There is no screen between here and that piece.');
      if (q !== 0 && n > 1) return fail('twoscreens', 'To capture, the cannon jumps over exactly one piece. Here there are two or more in the way.');
      break;
    }
    default: {
      const fwd = side === RED ? -1 : 1;
      if (dy === -fwd) return fail('back', 'A soldier never steps backward.');
      if (dy === 0 && adx === 1 && !crossed(side, from)) return fail('side', 'A soldier may step sideways only after it has crossed the river.');
      if (!((dy === fwd && dx === 0) || (dy === 0 && adx === 1))) return fail('shape', 'A soldier steps one point forward. After crossing the river it may also step one point sideways.');
    }
  }
  // the move itself is fine; it must be leaving the general in danger
  b[to] = p; b[from] = 0;
  const face = facing(b);
  b[from] = p; b[to] = q;
  if (face) return fail('facing', 'The two generals may never face each other along an open file. That move would leave them facing, so it is not allowed.');
  if (inCheckBoard(b, side)) return fail('incheck', 'Your general is in check. You must answer it: capture the attacker, block its line, or move the general to safety. That move does not.');
  return fail('selfcheck', 'That would leave your own general under attack, so it is not allowed.');
}

// Plain-language name of a move, for the message line.
export function describe(g, m) {
  const p = g.board[m.from], q = g.board[m.to];
  return `${SIDE_NAME[p > 0 ? 1 : -1]} ${NAME(p)}${q ? ' takes ' + NAME(q) : ''}`;
}
// Points the opponent could capture on their next move (own pieces in danger), for the warning marks.
export function threatenedSquares(g, side) {
  const b = g.board, buf = new Int32Array(160), n = genInto(b, -side, buf, 0, true), out = new Set();
  for (let i = 0; i < n; i++) { const m = buf[i], t = m >> 7; if (b[t] > 0 === side > 0 && b[t]) out.add(t); }
  return out;
}
export function boardToText(b) {
  const L = ['', 'k', 'a', 'e', 'h', 'r', 'c', 'p']; let out = '';
  for (let y = 0; y < 10; y++) { for (let x = 0; x < 9; x++) { const p = b[sqOf(x, y)]; out += p === 0 ? '.' : p > 0 ? L[p].toUpperCase() : L[-p]; } out += '\n'; }
  return out;
}
export function boardFromText(rows, turn = RED) {
  const map = { k: 1, a: 2, e: 3, h: 4, r: 5, c: 6, p: 7 }, b = new Array(90).fill(0);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '.' || ch === ' ') return; const l = ch.toLowerCase(); b[sqOf(x, y)] = (ch === l ? -1 : 1) * map[l]; }));
  return b;
}
