// THE RULE BOOK for Janggi (Korean chess). Pure and deterministic. The computer (engine.js) uses the same move
// generator, so there is one truth. Read this file first.
//
// Board: 9 files (x = 0..8, left to right as Cho sees it) by 10 ranks (y = 0..9, top to bottom). Square index = y * 9 + x.
// Cho (blue-green, moves first) sits at the bottom, its palace is x 3..5, y 7..9. Han (red) sits at the top, palace y 0..2.
// There is NO river. Pieces are numbers: type 1..7, positive = Cho, negative = Han.
//
// What makes Janggi Janggi, all in this file:
//   - palace diagonals: the general, guards, chariots, cannons and (going forward) soldiers may use the diagonal lines
//   - the cannon needs a screen even to MOVE and can never jump over, or take, another cannon
//   - the elephant steps one point straight and two diagonally (a 3-2 leap) and may go anywhere on the board
//   - a player may PASS (unless in check); two passes in a row end the game and the pieces are counted
//   - "bikjang": the two generals facing each other on an open file
//   - the pre-game choice of the horse / elephant layout (four set-ups)
export const GENERAL = 1, GUARD = 2, ELEPHANT = 3, HORSE = 4, CHARIOT = 5, CANNON = 6, SOLDIER = 7;
export const CHO = 1, HAN = -1;
export const TYPE_NAME = ['', 'general', 'guard', 'elephant', 'horse', 'chariot', 'cannon', 'soldier'];
export const SIDE_NAME = { 1: 'Cho', [-1]: 'Han' };
export const POINTS = [0, 0, 3, 3, 5, 13, 7, 2];          // counting values (the general is not counted)
export const HAN_BONUS = 1.5;                              // "dum": the second player's compensation when pieces are counted
export const sqOf = (x, y) => y * 9 + x;
export const xOf = (s) => s % 9;
export const yOf = (s) => (s / 9) | 0;
export const PASS = 90 | (90 << 7);                        // the packed "pass" move
const abs = Math.abs;

// ---- the four set-ups --------------------------------------------------------------------------------------
// Files 1,2 and 6,7 of the back rank hold two horses (H) and two elephants (E). Written from the owner's own left to right.
export const LAYOUTS = ['inner', 'outer', 'left', 'right'];
export const LAYOUT_NAME = { inner: 'Inner elephant', outer: 'Outer elephant', left: 'Left elephant', right: 'Right elephant' };
export const LAYOUT_KO = { inner: '안상', outer: '바깥상', left: '좌상', right: '우상' };
export const LAYOUT_SEQ = { inner: 'HEEH', outer: 'EHHE', left: 'EHEH', right: 'HEHE' };

// ---- geometry tables ------------------------------------------------------------------------------------
const inBoard = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 10;
export const inPalace = (side, s) => { const x = xOf(s), y = yOf(s); return x >= 3 && x <= 5 && (side === CHO ? y >= 7 : y <= 2); };
export const inAnyPalace = (s) => { const x = xOf(s), y = yOf(s); return x >= 3 && x <= 5 && (y <= 2 || y >= 7); };
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];                 // up, down, left, right
const DIAG = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const KNIGHT = [[1, 2], [-1, 2], [1, -2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]];
const idx = (side) => (side === CHO ? 0 : 1);

// A diagonal step (dx,dy) from (x,y) exists only on a palace diagonal line: between a palace corner and the palace centre.
export function diagEdge(x, y, dx, dy) {
  const x2 = x + dx, y2 = y + dy;
  if (!inBoard(x2, y2)) return false;
  const a = sqOf(x, y), b = sqOf(x2, y2);
  if (!inAnyPalace(a) || !inAnyPalace(b)) return false;
  if (yOf(a) <= 2 !== (yOf(b) <= 2)) return false;
  const cy = yOf(a) <= 2 ? 1 : 8;
  const aCenter = x === 4 && y === cy, bCenter = x2 === 4 && y2 === cy;
  return aCenter !== bCenter;                                      // exactly one end is the centre; the other is a corner
}

const RAYS = [], PALNB = [], HMOV = [], HORSE_ATT = [], EMOV = [], ELEPH_ATT = [], SOLD = [[], []], SOLD_ATT = [[], []];
for (let s = 0; s < 90; s++) {
  const x = xOf(s), y = yOf(s);
  // rays: 4 straight, then up to 4 palace-diagonal rays
  const rays = DIRS.map(([dx, dy]) => { const r = []; for (let a = x + dx, b = y + dy; inBoard(a, b); a += dx, b += dy) r.push(sqOf(a, b)); return r; });
  for (const [dx, dy] of DIAG) { const r = []; let a = x, b = y; while (diagEdge(a, b, dx, dy)) { a += dx; b += dy; r.push(sqOf(a, b)); } if (r.length) rays.push(r); }
  RAYS[s] = rays;
  // palace neighbours (general and guards): straight steps inside the palace, plus the diagonal edges
  PALNB[s] = [];
  if (inAnyPalace(s)) {
    for (const [dx, dy] of DIRS) if (inBoard(x + dx, y + dy) && inAnyPalace(sqOf(x + dx, y + dy)) && (yOf(sqOf(x + dx, y + dy)) <= 2) === (y <= 2)) PALNB[s].push(sqOf(x + dx, y + dy));
    for (const [dx, dy] of DIAG) if (diagEdge(x, y, dx, dy)) PALNB[s].push(sqOf(x + dx, y + dy));
  }
  HMOV[s] = []; HORSE_ATT[s] = []; EMOV[s] = []; ELEPH_ATT[s] = [];
  for (const [dx, dy] of KNIGHT) {
    if (inBoard(x + dx, y + dy)) HMOV[s].push([sqOf(x + dx, y + dy), sqOf(x + (abs(dx) === 2 ? dx / 2 : 0), y + (abs(dy) === 2 ? dy / 2 : 0))]);
    const hx = x - dx, hy = y - dy;
    if (inBoard(hx, hy)) HORSE_ATT[s].push([sqOf(hx, hy), sqOf(hx + (abs(dx) === 2 ? dx / 2 : 0), hy + (abs(dy) === 2 ? dy / 2 : 0))]);
  }
  // elephant: (2,3) / (3,2) leaps. Path: one straight step along the long axis, then two diagonal steps.
  for (const [dx, dy] of [[2, 3], [-2, 3], [2, -3], [-2, -3], [3, 2], [-3, 2], [3, -2], [-3, -2]]) {
    const path = (ox, oy) => {                                       // intermediate points from (ox,oy) to (ox+dx,oy+dy)
      const sx = abs(dx) === 3 ? Math.sign(dx) : 0, sy = abs(dy) === 3 ? Math.sign(dy) : 0;
      const p1 = [ox + sx, oy + sy], rx = Math.sign(dx), ry = Math.sign(dy);
      return [sqOf(p1[0], p1[1]), sqOf(p1[0] + rx, p1[1] + ry)];
    };
    if (inBoard(x + dx, y + dy)) EMOV[s].push([sqOf(x + dx, y + dy), ...path(x, y)]);
    const ex = x - dx, ey = y - dy;
    if (inBoard(ex, ey)) ELEPH_ATT[s].push([sqOf(ex, ey), ...path(ex, ey)]);
  }
  for (const side of [CHO, HAN]) {
    const i = idx(side), fwd = side === CHO ? -1 : 1, out = [], att = [];
    if (inBoard(x, y + fwd)) out.push(sqOf(x, y + fwd));
    for (const dx of [-1, 1]) if (inBoard(x + dx, y)) out.push(sqOf(x + dx, y));
    for (const dx of [-1, 1]) if (diagEdge(x, y, dx, fwd)) out.push(sqOf(x + dx, y + fwd));
    SOLD[i][s] = out;
  }
}
// soldier attack reverse table: SOLD_ATT[i][s] = squares from which an i-side soldier could reach s
for (const side of [CHO, HAN]) { const i = idx(side); for (let s = 0; s < 90; s++) SOLD_ATT[i][s] = []; for (let f = 0; f < 90; f++) for (const t of SOLD[i][f]) SOLD_ATT[i][t].push(f); }
export { RAYS, PALNB };

// ---- Zobrist keys (fixed, so every run agrees) ---------------------------------------------------------------
const ZL = new Int32Array(15 * 90), ZH = new Int32Array(15 * 90);
{ let a = 0x2f6e2b1; const next = () => { a = (Math.imul(a ^ (a >>> 15), 0x2c1b3c6d) + 0x297a2d39) | 0; a ^= a >>> 12; a = Math.imul(a, 0x85ebca6b); a ^= a >>> 13; return a | 0; };
  for (let i = 0; i < ZL.length; i++) { ZL[i] = next(); ZH[i] = next(); } }
export const ZOB_L = ZL, ZOB_H = ZH;
export const SIDE_L = 0x5bd1e995 | 0, SIDE_H = 0x1b873593 | 0;
export const zIndex = (p, s) => (p + 7) * 90 + s;
export const keyNum = (hl, hh) => (hh & 0x1fffff) * 4294967296 + (hl >>> 0);
export function positionKey(board, turn) {
  let hl = turn === HAN ? SIDE_L : 0, hh = turn === HAN ? SIDE_H : 0;
  for (let s = 0; s < 90; s++) { const p = board[s]; if (p) { hl ^= ZL[zIndex(p, s)]; hh ^= ZH[zIndex(p, s)]; } }
  return keyNum(hl, hh);
}

// ---- start position --------------------------------------------------------------------------------------------
// layoutCho / layoutHan: one of LAYOUTS. A side's "left" is its own left (for Han that is the right-hand side of the screen).
export function startBoard(layoutCho = 'inner', layoutHan = 'inner') {
  const b = new Array(90).fill(0);
  const put = (side, ox, oy, piece) => { const x = side === CHO ? ox : 8 - ox, y = side === CHO ? 9 - oy : oy; b[sqOf(x, y)] = side * piece; };
  for (const [side, lay] of [[CHO, layoutCho], [HAN, layoutHan]]) {
    const seq = LAYOUT_SEQ[lay] ?? LAYOUT_SEQ.inner;
    put(side, 0, 0, CHARIOT); put(side, 8, 0, CHARIOT); put(side, 3, 0, GUARD); put(side, 5, 0, GUARD); put(side, 4, 1, GENERAL);
    [1, 2, 6, 7].forEach((ox, k) => put(side, ox, 0, seq[k] === 'H' ? HORSE : ELEPHANT));
    put(side, 1, 2, CANNON); put(side, 7, 2, CANNON);
    for (let ox = 0; ox < 9; ox += 2) put(side, ox, 3, SOLDIER);
  }
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
      case GENERAL: case GUARD: { const l = PALNB[s]; for (let k = 0; k < l.length; k++) { const q = b[l[k]]; if (inPalace(side, l[k]) && (q === 0 ? !capsOnly : (q > 0) !== (side > 0))) buf[n++] = s | (l[k] << 7); } break; }
      case ELEPHANT: { const l = EMOV[s]; for (let k = 0; k < l.length; k++) { const e = l[k]; if (b[e[1]] !== 0 || b[e[2]] !== 0) continue; const q = b[e[0]]; if (q === 0 ? !capsOnly : (q > 0) !== (side > 0)) buf[n++] = s | (e[0] << 7); } break; }
      case HORSE: { const l = HMOV[s]; for (let k = 0; k < l.length; k++) { const e = l[k]; if (b[e[1]] !== 0) continue; const q = b[e[0]]; if (q === 0 ? !capsOnly : (q > 0) !== (side > 0)) buf[n++] = s | (e[0] << 7); } break; }
      case CHARIOT: { const rs = RAYS[s]; for (let d = 0; d < rs.length; d++) { const r = rs[d]; for (let k = 0; k < r.length; k++) { const q = b[r[k]]; if (q === 0) { if (!capsOnly) buf[n++] = s | (r[k] << 7); } else { if ((q > 0) !== (side > 0)) buf[n++] = s | (r[k] << 7); break; } } } break; }
      case CANNON: {
        const rs = RAYS[s];
        for (let d = 0; d < rs.length; d++) {
          const r = rs[d]; let k = 0;
          for (; k < r.length && b[r[k]] === 0; k++);                         // empty points up to the screen
          if (k >= r.length) continue;
          const sc = b[r[k]]; if (sc === CANNON || sc === -CANNON) continue;   // a cannon is never a screen
          for (k++; k < r.length; k++) {
            const q = b[r[k]];
            if (q === 0) { if (!capsOnly) buf[n++] = s | (r[k] << 7); }
            else { if ((q > 0) !== (side > 0) && q !== CANNON && q !== -CANNON) buf[n++] = s | (r[k] << 7); break; }
          }
        }
        break;
      }
      default: { const l = SOLD[i][s]; for (let k = 0; k < l.length; k++) { const q = b[l[k]]; if (q === 0 ? !capsOnly : (q > 0) !== (side > 0)) buf[n++] = s | (l[k] << 7); } }
    }
  }
  return n;
}

// Is square s attacked by side `by`? (Used for the general's safety. The generals facing each other is NOT an attack here: see bikjang.)
export function attacked(b, s, by) {
  const rs = RAYS[s];
  for (let d = 0; d < rs.length; d++) {
    const r = rs[d]; let screenFound = false;
    for (let k = 0; k < r.length; k++) {
      const q = b[r[k]]; if (q === 0) continue;
      if (!screenFound) {
        if ((q > 0) === (by > 0) && (q > 0 ? q : -q) === CHARIOT) return true;
        if (q === CANNON || q === -CANNON) break;                                    // a cannon is no screen
        screenFound = true;
      } else { if ((q > 0) === (by > 0) && (q > 0 ? q : -q) === CANNON && b[s] !== CANNON && b[s] !== -CANNON) return true; break; }
    }
  }
  const h = HORSE_ATT[s], hp = by * HORSE;
  for (let k = 0; k < h.length; k++) if (b[h[k][0]] === hp && b[h[k][1]] === 0) return true;
  const e = ELEPH_ATT[s], ep = by * ELEPHANT;
  for (let k = 0; k < e.length; k++) if (b[e[k][0]] === ep && b[e[k][1]] === 0 && b[e[k][2]] === 0) return true;
  const sp = by * SOLDIER, sa = SOLD_ATT[idx(by)][s];
  for (let k = 0; k < sa.length; k++) if (b[sa[k]] === sp) return true;
  // an enemy general or guard next to s inside its own palace can take on s
  const nb = PALNB[s], gp = by * GENERAL, up = by * GUARD;
  for (let k = 0; k < nb.length; k++) { const q = b[nb[k]]; if ((q === gp || q === up) && inPalace(by, s)) return true; }
  return false;
}
export function kingSquare(b, side) {
  const y0 = side === CHO ? 7 : 0, g = side * GENERAL;
  for (let y = y0; y < y0 + 3; y++) for (let x = 3; x <= 5; x++) if (b[sqOf(x, y)] === g) return sqOf(x, y);
  return -1;
}
export function inCheckBoard(b, side) { const k = kingSquare(b, side); return k >= 0 && attacked(b, k, -side); }
// Bikjang: the two generals on one file with nothing between them.
export function facing(b) {
  const c = kingSquare(b, CHO), h = kingSquare(b, HAN);
  if (c < 0 || h < 0 || xOf(c) !== xOf(h)) return false;
  for (let y = yOf(h) + 1; y < yOf(c); y++) if (b[sqOf(xOf(c), y)] !== 0) return false;
  return true;
}

const scratch = new Int32Array(200);
function legalFrom(b, side) {                           // array of packed legal moves (never includes the pass)
  const n = genInto(b, side, scratch, 0, false), out = [], bik = facing(b);
  for (let i = 0; i < n; i++) {
    const m = scratch[i], f = m & 127, t = m >> 7, cap = b[t]; b[t] = b[f]; b[f] = 0;
    const k = kingSquare(b, side), bad = (k >= 0 && attacked(b, k, -side)) || (bik && facing(b));
    b[f] = b[t]; b[t] = cap;
    if (!bad) out.push(m);
  }
  return out;
}
export const legalPacked = legalFrom;

// ---- counting ----------------------------------------------------------------------------------------------------
export function countPoints(b) {
  let cho = 0, han = 0;
  for (let s = 0; s < 90; s++) { const p = b[s]; if (p > 0) cho += POINTS[p]; else if (p < 0) han += POINTS[-p]; }
  return { cho, han: han + HAN_BONUS, hanRaw: han };
}

// ---- the game ---------------------------------------------------------------------------------------------------
// state g = { board[90], turn, log: [{f,t,cap,nc,chk,pass}], keys: [positionKey...], nc (plies since a capture), bik, result,
//             layouts: {cho, han} }
// result = null while playing, else { winner: 1 | -1 | 0, why, cho?, han? }
// why: checkmate | repetition | bikjang | count (two passes) | quiet (long game without a capture, settled by counting)
export const MIN_PLIES_TO_COUNT = 40;               // two passes in a row end (and count) the game only after this many plies
export const NO_CAPTURE_LIMIT = 100;                    // plies without a capture before the pieces are counted
export function newGame(layoutCho = 'inner', layoutHan = 'inner') { const g = fromBoard(startBoard(layoutCho, layoutHan), CHO); g.layouts = { cho: layoutCho, han: layoutHan }; return g; }
export function fromBoard(board, turn = CHO) {
  const g = { board: board.slice(), turn, log: [], keys: [], nc: 0, result: null, bik: false };
  g.keys.push(positionKey(g.board, turn));
  judge(g);
  return g;
}
export const clone = (g) => JSON.parse(JSON.stringify(g));
export const legalMoves = (g) => legalFrom(g.board, g.turn).map((m) => ({ from: m & 127, to: m >> 7 }));
export const legalFor = (g, from) => legalMoves(g).filter((m) => m.from === from).map((m) => m.to);
export const inCheck = (g, side = g.turn) => inCheckBoard(g.board, side);
export const isLegal = (g, from, to) => legalFrom(g.board, g.turn).includes(from | (to << 7));
// May the side to move pass? Never while in check; and not while the generals face each other (that must be answered).
export const canPass = (g) => { if (g.result || g.bik || inCheckBoard(g.board, g.turn)) return false; const l = g.log[g.log.length - 1]; return !(l && l.pass && g.log.length < MIN_PLIES_TO_COUNT); };
// May the side to move call the facing generals a draw?
export const canCallBikjang = (g) => !g.result && g.bik;

function judge(g) {
  g.result = null; g.bik = facing(g.board);
  const moves = legalFrom(g.board, g.turn);
  if (moves.length === 0) {
    if (inCheckBoard(g.board, g.turn)) { g.result = { winner: -g.turn, why: 'checkmate' }; return; }
    if (g.bik) { g.result = { winner: 0, why: 'bikjang' }; return; }     // the only thing left is to call it
    return;                                                              // no move but passing is possible: the game goes on
  }
  const n = g.keys.length - 1, key = g.keys[n];
  let count = 0;
  for (let i = n; i >= 0; i -= 2) if (g.keys[i] === key) count++;
  if (count >= 3) { g.result = { winner: 0, why: 'repetition' }; return; }
  const L = g.log, last = L[L.length - 1], prev = L[L.length - 2];
  if (last && prev && last.pass && prev.pass) { g.result = countResult(g, 'count'); return; }
  if (g.nc >= NO_CAPTURE_LIMIT) g.result = countResult(g, 'quiet');
}
export function countResult(g, why) {
  const c = countPoints(g.board);
  return { winner: c.cho > c.han ? CHO : HAN, why, cho: c.cho, han: c.han };
}

// Plays a move that is already known to be legal. m = { from, to } or { pass: true }.
export function applyMove(g, m) {
  const b = g.board, side = g.turn;
  if (g.log.length === 0) g.startTurn = side;
  if (m.pass) {
    g.log.push({ f: -1, t: -1, cap: 0, nc: g.nc, chk: false, pass: true });
    g.nc++; g.turn = -side; g.keys.push(positionKey(b, g.turn)); judge(g);
    return { cap: 0, chk: false, pass: true };
  }
  const cap = b[m.to];
  b[m.to] = b[m.from]; b[m.from] = 0;
  const chk = inCheckBoard(b, -side);
  g.log.push({ f: m.from, t: m.to, cap, nc: g.nc, chk, p: b[m.to] });
  g.nc = cap ? 0 : g.nc + 1;
  g.turn = -side;
  g.keys.push(positionKey(b, g.turn));
  judge(g);
  return { cap, chk };
}
export function undoMove(g) {
  const e = g.log.pop(); if (!e) return false;
  const b = g.board;
  if (!e.pass) { b[e.f] = b[e.t]; b[e.t] = e.cap; }
  g.turn = -g.turn; g.nc = e.nc; g.keys.pop(); judge(g);
  return true;
}
// The side to move calls bikjang: a draw. (Only when the generals face each other.)
export function callBikjang(g) { if (!g.bik || g.result) return false; g.result = { winner: 0, why: 'bikjang' }; return true; }

// ---- reasons ------------------------------------------------------------------------------------------------------
const NAME = (p) => TYPE_NAME[abs(p)];
// Try a move: { ok: true, move } when legal, otherwise { ok: false, code, why } explaining in plain words.
export function tryMove(g, from, to) {
  const b = g.board, p = b[from];
  if (!p || (p > 0) !== (g.turn > 0)) return { ok: false, code: 'notyours', why: p ? 'That is not your piece. Wait for your turn, or pick one of your own pieces.' : 'There is no piece on that point.' };
  if (isLegal(g, from, to)) return { ok: true, move: { from, to } };
  const side = g.turn, t = abs(p), q = b[to], fx = xOf(from), fy = yOf(from), tx = xOf(to), ty = yOf(to), dx = tx - fx, dy = ty - fy, adx = abs(dx), ady = abs(dy);
  const fail = (code, why) => ({ ok: false, code, why });
  if (to === from) return fail('same', '');
  if (q !== 0 && (q > 0) === (p > 0)) return fail('own', 'One of your own pieces is on that point. You can only capture the opponent\'s pieces.');
  const between = (a, c) => { let n = 0, last = 0; const ax = xOf(a), ay = yOf(a), cx = xOf(c), cy = yOf(c), sx = Math.sign(cx - ax), sy = Math.sign(cy - ay); for (let x = ax + sx, y = ay + sy; x !== cx || y !== cy; x += sx, y += sy) { const v = b[sqOf(x, y)]; if (v) { n++; last = v; } } return { n, last }; };
  const straight = dx === 0 || dy === 0;
  const onPalaceDiagonal = RAYS[from].slice(4).some((r) => r.includes(to));
  switch (t) {
    case GENERAL: case GUARD: {
      const nm = t === GENERAL ? 'general' : 'guard';
      if (!inPalace(side, to)) return fail('palace', `The ${nm} never leaves the palace, the 3 by 3 fortress marked with the crossed lines.`);
      if (!PALNB[from].includes(to)) return fail('shape', `The ${nm} takes one step along a line of the palace. Diagonal steps are allowed only on the two crossing diagonals.`);
      break;
    }
    case ELEPHANT: {
      if (!((adx === 2 && ady === 3) || (adx === 3 && ady === 2))) return fail('shape', 'The elephant goes one point straight, then two points diagonally outward: a long leap of 3 across and 2 along.');
      const e = EMOV[from].find((m) => m[0] === to);
      if (b[e[1]] !== 0) return fail('eye', 'The elephant\'s first step is blocked: a piece stands right next to it on the straight step, so it cannot start the leap.');
      if (b[e[2]] !== 0) return fail('eye', 'The elephant\'s path is blocked: a piece stands on the diagonal point it must cross.');
      break;
    }
    case HORSE:
      if (!((adx === 1 && ady === 2) || (adx === 2 && ady === 1))) return fail('shape', 'The horse goes one point straight, then one point diagonally outward, like the letter L.');
      if (b[sqOf(fx + (adx === 2 ? dx / 2 : 0), fy + (ady === 2 ? dy / 2 : 0))] !== 0) return fail('leg', 'The horse is hobbled: a piece stands right next to it in the direction it must first step, so it cannot go that way.');
      break;
    case CHARIOT:
      if (!straight && !onPalaceDiagonal) return fail('shape', 'The chariot moves in straight lines along a rank or file, any distance. Inside a palace it may also run along the two crossing diagonals.');
      if (between(from, to).n > 0) return fail('blocked', 'A piece is in the way. The chariot cannot jump over other pieces.');
      break;
    case CANNON: {
      if (!straight && !onPalaceDiagonal) return fail('shape', 'The cannon moves in straight lines (and along palace diagonals), always by jumping over exactly one piece.');
      const bt = between(from, to);
      if (bt.n === 0) return fail('noscreen', 'A cannon cannot move without a screen: it must jump over exactly one piece, and there is none between here and that point.');
      if (bt.n > 1) return fail('twoscreens', 'The cannon jumps over exactly one piece. Here there are two or more in the way.');
      if (abs(bt.last) === CANNON) return fail('cannonscreen', 'A cannon can never jump over another cannon, so it cannot be used as the screen.');
      if (q !== 0 && abs(q) === CANNON) return fail('cannontake', 'A cannon can never capture another cannon.');
      break;
    }
    default: {
      const fwd = side === CHO ? -1 : 1;
      if (dy === -fwd) return fail('back', 'A soldier never steps backward.');
      if (!((dy === fwd && dx === 0) || (dy === 0 && adx === 1) || (dy === fwd && adx === 1 && diagEdge(fx, fy, dx, dy)))) return fail('shape', 'A soldier steps one point forward or sideways, never backward. Inside the enemy palace it may also step forward along the diagonal lines.');
    }
  }
  // the move itself is fine; why is it not legal?
  b[to] = p; b[from] = 0;
  const face = g.bik && facing(b), ck = inCheckBoard(b, side);
  b[from] = p; b[to] = q;
  if (face) return fail('bikjang', 'The generals are facing each other (bikjang). You must break it: block with a piece, capture, or move your general. That move does not.');
  if (ck) {
    if (inCheckBoard(b, side)) return fail('incheck', 'Your general is in check. You must answer it: capture the attacker, block its line, or move the general to safety. That move does not.');
    return fail('selfcheck', 'That would leave your own general under attack, so it is not allowed.');
  }
  return fail('illegal', 'That move is not allowed.');
}

// Plain-language name of a move, for the message line.
export function describe(g, m) {
  if (m.pass) return `${SIDE_NAME[g.turn]} passes`;
  const p = g.board[m.from], q = g.board[m.to];
  return `${SIDE_NAME[p > 0 ? 1 : -1]} ${NAME(p)}${q ? ' takes ' + NAME(q) : ''}`;
}
// Points the opponent could capture on their next move (own pieces in danger), for the warning marks.
export function threatenedSquares(g, side) {
  const b = g.board, buf = new Int32Array(200), n = genInto(b, -side, buf, 0, true), out = new Set();
  for (let i = 0; i < n; i++) { const m = buf[i], t = m >> 7; if (b[t] > 0 === side > 0 && b[t]) out.add(t); }
  return out;
}
export function boardToText(b) {
  const L = ['', 'k', 'g', 'e', 'h', 'r', 'c', 'p']; let out = '';
  for (let y = 0; y < 10; y++) { for (let x = 0; x < 9; x++) { const p = b[sqOf(x, y)]; out += p === 0 ? '.' : p > 0 ? L[p].toUpperCase() : L[-p]; } out += '\n'; }
  return out;
}
export function boardFromText(rows) {
  const map = { k: 1, g: 2, e: 3, h: 4, r: 5, c: 6, p: 7 }, b = new Array(90).fill(0);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '.' || ch === ' ') return; const l = ch.toLowerCase(); b[sqOf(x, y)] = (ch === l ? -1 : 1) * map[l]; }));
  return b;
}
