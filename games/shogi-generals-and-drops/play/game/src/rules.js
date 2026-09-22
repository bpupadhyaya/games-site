// Shogi rule book. The ONE implementation of the rules: the interface, the computer's search, the lessons and the
// puzzle maker all use it, so they can never disagree.
//
// Position: { n, b:[n*n cells], hand:[[8 counts],[8 counts]], turn, ply, kings:[sq,sq], rep:{}, checks:[], last }
//   side 0 = Sente (moves first, starts at the BOTTOM, moves toward row 0); side 1 = Gote (starts at the top).
//   cell = 0 (empty) or type | (side << 4). Types: P1 L2 N3 S4 G5 B6 R7 K8, promoted = base + 8
//   (+P 9, +L 10, +N 11, +S 12, +B 14, +R 15). hand[side][type] counts captured pieces (types 1..7).
// Move (int): from | to<<7 | promote<<14 | dropType<<15; from = 127 for a drop.
//
// Documented simplifications: repetition = the same position four times is a draw (the side that gave check on
// every move of the cycle loses); impasse (both kings entered) is not adjudicated, a game passing 400 plies is a
// draw; a pawn drop that interposes is not itself tested for drop-mate when the game tests the attacker's drop.

export const P = 1, L = 2, N = 3, S = 4, G = 5, B = 6, R = 7, K = 8;
export const LETTER = ['', 'P', 'L', 'N', 'S', 'G', 'B', 'R', 'K', '+P', '+L', '+N', '+S', '', '+B', '+R'];
export const NAME = ['', 'Pawn', 'Lance', 'Knight', 'Silver', 'Gold', 'Bishop', 'Rook', 'King', 'Tokin', 'Promoted Lance', 'Promoted Knight', 'Promoted Silver', '', 'Horse', 'Dragon'];
export const SHORT = ['', 'Pawn', 'Lance', 'Knight', 'Silver', 'Gold', 'Bishop', 'Rook', 'King', 'Tokin', 'Lance+', 'Knight+', 'Silver+', '', 'Horse', 'Dragon'];
export const HINT = [
  '',
  'Pawn: steps one point straight forward, and captures the same way.',
  'Lance: slides straight forward any distance. It never goes back.',
  'Knight: jumps two forward and one aside, over anything. Forward only.',
  'Silver: one step forward, or one step diagonally in any direction.',
  'Gold: one step forward, sideways or back, or diagonally forward.',
  'Bishop: slides diagonally any distance.',
  'Rook: slides along its row or column any distance.',
  'King: one step in any direction. Lose it and you lose the game.',
  'Tokin (promoted pawn): moves like a gold.',
  'Promoted lance: moves like a gold.',
  'Promoted knight: moves like a gold.',
  'Promoted silver: moves like a gold.',
  '',
  'Horse (promoted bishop): bishop slides plus one step straight.',
  'Dragon (promoted rook): rook slides plus one step diagonally.',
];
export const canPromote = (t) => t === P || t === L || t === N || t === S || t === B || t === R;
export const base = (t) => (t >= 9 ? t - 8 : t);

const GOLD = [[-1, 0], [-1, -1], [-1, 1], [0, -1], [0, 1], [1, 0]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ALL8 = [...ORTH, ...DIAG];
export const STEPS = [];
export const SLIDES = [];
for (let t = 0; t < 16; t++) { STEPS[t] = []; SLIDES[t] = []; }
STEPS[P] = [[-1, 0]]; STEPS[N] = [[-2, -1], [-2, 1]]; STEPS[S] = [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 1]];
STEPS[G] = GOLD; STEPS[K] = ALL8; STEPS[9] = STEPS[10] = STEPS[11] = STEPS[12] = GOLD;
STEPS[14] = ORTH; STEPS[15] = DIAG;
SLIDES[L] = [[-1, 0]]; SLIDES[B] = SLIDES[14] = DIAG; SLIDES[R] = SLIDES[15] = ORTH;
const TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15];

const zoneRows = (n) => (n === 9 ? 3 : 1);
export const inZone = (n, side, r) => (side === 0 ? r < zoneRows(n) : r >= n - zoneRows(n));
const deadRows = (n, side, t, r) => { const f = side === 0 ? r : n - 1 - r; return t === N ? f <= 1 : (t === P || t === L) && f === 0; };  // no move possible from here

export function newGame(kind = 'standard') {
  const n = kind === 'mini' ? 5 : 9;
  const pos = { n, b: new Array(n * n).fill(0), hand: [new Array(8).fill(0), new Array(8).fill(0)], turn: 0, ply: 0, kings: [-1, -1], rep: {}, checks: [], last: null };
  const put = (r, c, t, side) => { pos.b[r * n + c] = t | (side << 4); };
  if (n === 9) {
    const back = [L, N, S, G, K, G, S, N, L];
    for (let c = 0; c < 9; c++) { put(0, c, back[c], 1); put(8, c, back[c], 0); put(2, c, P, 1); put(6, c, P, 0); }
    put(1, 1, R, 1); put(1, 7, B, 1); put(7, 7, R, 0); put(7, 1, B, 0);
  } else {
    const back = [R, B, S, G, K];
    for (let c = 0; c < 5; c++) { put(0, c, back[c], 1); put(4, 4 - c, back[c], 0); }
    put(1, 4, P, 1); put(3, 0, P, 0);
  }
  finish(pos); recordRep(pos);
  return pos;
}

// Build a position from rows of text (for lessons and puzzles). Row 0 is the top. Tokens are space-separated:
// "." empty; a piece letter (P L N S G B R K, '+' before it to promote) then 'b' (Sente/you) or 'w' (Gote).
export function fromRows(rows, hand = {}, turn = 0) {
  const n = rows.length;
  const pos = { n, b: new Array(n * n).fill(0), hand: [new Array(8).fill(0), new Array(8).fill(0)], turn, ply: 0, kings: [-1, -1], rep: {}, checks: [], last: null };
  rows.forEach((row, r) => {
    row.trim().split(/\s+/).forEach((tk, c) => {
      if (tk === '.') return;
      const side = tk.endsWith('w') ? 1 : 0, t = LETTER.indexOf(tk.slice(0, -1));
      if (t < 1) throw new Error('bad token ' + tk);
      pos.b[r * n + c] = t | (side << 4);
    });
  });
  for (const s of [0, 1]) for (const [k, v] of Object.entries(hand[s === 0 ? 'b' : 'w'] || {})) pos.hand[s][LETTER.indexOf(k)] = v;
  finish(pos); recordRep(pos);
  return pos;
}

function finish(pos) {
  pos.kings = [-1, -1];
  for (let i = 0; i < pos.b.length; i++) { const c = pos.b[i]; if (c && (c & 15) === K) pos.kings[c >> 4] = i; }
}
export function clone(pos) {
  return { n: pos.n, b: pos.b.slice(), hand: [pos.hand[0].slice(), pos.hand[1].slice()], turn: pos.turn, ply: pos.ply, kings: pos.kings.slice(), rep: { ...pos.rep }, checks: pos.checks.slice(), last: pos.last };
}
// A cheap copy for searching (no history).
export function forSearch(pos) {
  return { n: pos.n, b: pos.b.slice(), hand: [pos.hand[0].slice(), pos.hand[1].slice()], turn: pos.turn, ply: pos.ply, kings: pos.kings.slice(), rep: {}, checks: [], last: null };
}

export const mFrom = (m) => m & 127;
export const mTo = (m) => (m >> 7) & 127;
export const mPromo = (m) => (m >> 14) & 1;
export const mDrop = (m) => (m >> 15) & 15;
export const isDrop = (m) => (m & 127) === 127;
export const mk = (from, to, promo = 0, drop = 0) => from | (to << 7) | (promo << 14) | (drop << 15);
export const dropMove = (t, to) => mk(127, to, 0, t);

// ---------------------------------------------------------------------------------------------------------------
// Make / unmake (no legality). make returns the captured cell (0 if none); unmake needs it back.
// ---------------------------------------------------------------------------------------------------------------
export function make(pos, m) {
  const to = (m >> 7) & 127, side = pos.turn;
  let cap = 0;
  if ((m & 127) === 127) {
    const t = (m >> 15) & 15;
    pos.hand[side][t]--; pos.b[to] = t | (side << 4);
  } else {
    const from = m & 127, c = pos.b[from];
    cap = pos.b[to];
    if (cap) pos.hand[side][base(cap & 15)]++;
    pos.b[from] = 0;
    const t = c & 15, nt = (m >> 14) & 1 ? t + 8 : t;
    pos.b[to] = nt | (side << 4);
    if (t === K) pos.kings[side] = to;
  }
  pos.turn = 1 - side; pos.ply++;
  return cap;
}
export function unmake(pos, m, cap) {
  const to = (m >> 7) & 127, side = 1 - pos.turn;
  pos.turn = side; pos.ply--;
  if ((m & 127) === 127) {
    const t = (m >> 15) & 15;
    pos.hand[side][t]++; pos.b[to] = 0;
  } else {
    const from = m & 127, c = pos.b[to];
    const t = c & 15, ot = (m >> 14) & 1 ? t - 8 : t;
    pos.b[from] = ot | (side << 4);
    pos.b[to] = cap;
    if (cap) pos.hand[side][base(cap & 15)]--;
    if (ot === K) pos.kings[side] = from;
  }
}

// Is square sq attacked by side `by`?
export function attacked(pos, sq, by) {
  const n = pos.n, b = pos.b, r = (sq / n) | 0, c = sq - r * n, sg = by ? -1 : 1, hi = by << 4;
  for (let ti = 0; ti < 14; ti++) {
    const t = TYPES[ti], st = STEPS[t];
    for (let k = 0; k < st.length; k++) {
      const r0 = r - st[k][0] * sg, c0 = c - st[k][1];
      if (r0 >= 0 && r0 < n && c0 >= 0 && c0 < n && b[r0 * n + c0] === (t | hi)) return true;
    }
  }
  for (const t of SLIDERS) {
    const sl = SLIDES[t];
    for (let k = 0; k < sl.length; k++) {
      const dr = -sl[k][0] * sg, dc = -sl[k][1];
      let r0 = r + dr, c0 = c + dc;
      while (r0 >= 0 && r0 < n && c0 >= 0 && c0 < n) {
        const x = b[r0 * n + c0];
        if (x) { if (x === (t | hi)) return true; break; }
        r0 += dr; c0 += dc;
      }
    }
  }
  return false;
}
const SLIDERS = [L, B, R, 14, 15];
export const inCheck = (pos, side) => pos.kings[side] >= 0 && attacked(pos, pos.kings[side], 1 - side);

// ---------------------------------------------------------------------------------------------------------------
// Pseudo-legal generation (own king may be left in check; drop-mate not tested). Writes into `out`, returns count.
// capsOnly: only captures (used by the search's quiet-position extension).
// ---------------------------------------------------------------------------------------------------------------
export function gen(pos, out, capsOnly = false) {
  const n = pos.n, b = pos.b, side = pos.turn, sg = side ? -1 : 1, hi = side << 4;
  let k = 0;
  const add = (from, to, t, r0, r1) => {
    if (canPromote(t) && (inZone(n, side, r0) || inZone(n, side, r1))) {
      if (!deadRows(n, side, t, r1)) out[k++] = from | (to << 7);
      out[k++] = from | (to << 7) | (1 << 14);
    } else out[k++] = from | (to << 7);
  };
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (!c || (c >> 4) !== side) continue;
    const t = c & 15, r = (i / n) | 0, col = i - r * n;
    const st = STEPS[t];
    for (let j = 0; j < st.length; j++) {
      const r1 = r + st[j][0] * sg, c1 = col + st[j][1];
      if (r1 < 0 || r1 >= n || c1 < 0 || c1 >= n) continue;
      const to = r1 * n + c1, x = b[to];
      if (x && (x >> 4) === side) continue;
      if (capsOnly && !x) continue;
      add(i, to, t, r, r1);
    }
    const sl = SLIDES[t];
    for (let j = 0; j < sl.length; j++) {
      const dr = sl[j][0] * sg, dc = sl[j][1];
      let r1 = r + dr, c1 = col + dc;
      while (r1 >= 0 && r1 < n && c1 >= 0 && c1 < n) {
        const to = r1 * n + c1, x = b[to];
        if (x) { if ((x >> 4) !== side) add(i, to, t, r, r1); break; }
        if (!capsOnly) add(i, to, t, r, r1);
        r1 += dr; c1 += dc;
      }
    }
  }
  if (!capsOnly) {
    const h = pos.hand[side];
    let pawnCols = null;
    for (let t = 1; t <= 7; t++) {
      if (!h[t]) continue;
      if (t === P && !pawnCols) {
        pawnCols = new Array(n).fill(false);
        for (let i = 0; i < b.length; i++) if (b[i] === (P | hi)) pawnCols[i % n] = true;
      }
      for (let to = 0; to < b.length; to++) {
        if (b[to]) continue;
        const r = (to / n) | 0;
        if ((t === P || t === L || t === N) && deadRows(n, side, t, r)) continue;
        if (t === P && pawnCols[to % n]) continue;
        out[k++] = 127 | (to << 7) | (t << 15);
      }
    }
  }
  return k;
}

const tmp = new Int32Array(1024);
export function hasLegalMove(pos) {
  const k = gen(pos, tmp), side = pos.turn, list = tmp.slice(0, k);
  for (let i = 0; i < k; i++) {
    const m = list[i], cap = make(pos, m);
    const bad = pos.kings[side] >= 0 && attacked(pos, pos.kings[side], 1 - side);
    unmake(pos, m, cap);
    if (!bad) return true;
  }
  return false;
}
// Legal in full (own king safe; a pawn drop may not give checkmate).
export function isLegalMove(pos, m) {
  const side = pos.turn, cap = make(pos, m);
  let ok = !(pos.kings[side] >= 0 && attacked(pos, pos.kings[side], 1 - side));
  if (ok && (m & 127) === 127 && ((m >> 15) & 15) === P && inCheck(pos, pos.turn) && !hasLegalMove(pos)) ok = false;
  unmake(pos, m, cap);
  return ok;
}
export function legalMoves(pos) {
  const buf = new Int32Array(1024), k = gen(pos, buf), out = [];
  for (let i = 0; i < k; i++) if (isLegalMove(pos, buf[i])) out.push(buf[i]);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The game: applying a move, repetition, result.
// ---------------------------------------------------------------------------------------------------------------
export function key(pos) {
  return pos.b.join(',') + '|' + pos.hand[0].join('') + '|' + pos.hand[1].join('') + '|' + pos.turn;
}
function recordRep(pos) { const k = key(pos); pos.rep[k] = (pos.rep[k] || 0) + 1; }

// Apply a legal move to a game position (keeps history). Returns { cap } (captured cell).
export function applyMove(pos, m) {
  const cap = make(pos, m);
  pos.last = m;
  pos.checks.push(inCheck(pos, pos.turn) ? 1 : 0);
  recordRep(pos);
  return { cap };
}

// null while the game goes on, otherwise { over:true, winner: 0|1|null, why }
export function result(pos) {
  const side = pos.turn;
  if (!hasLegalMove(pos)) return { over: true, winner: 1 - side, why: inCheck(pos, side) ? 'checkmate' : 'no legal move' };
  if ((pos.rep[key(pos)] || 0) >= 4) {
    // perpetual check: the side that gave check on every move of the last cycle loses
    const cs = pos.checks, last = cs.slice(-8), mover = 1 - side, offset = cs.length - last.length;
    const theirs = last.filter((_, i) => ((offset + i) % 2) === ((cs.length - 1) % 2));   // moves by the side that just moved
    if (theirs.length >= 3 && theirs.every((x) => x)) return { over: true, winner: side, why: 'perpetual check' };
    void mover;
    return { over: true, winner: null, why: 'repetition' };
  }
  if (pos.ply >= 400) return { over: true, winner: null, why: 'move limit' };
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Explaining refusals. Each returns a plain-language reason a beginner understands.
// ---------------------------------------------------------------------------------------------------------------
export function reachable(pos, from, to) {
  // Ignoring blockers, pins and check: can this piece geometrically get from -> to?
  const n = pos.n, c = pos.b[from], t = c & 15, side = c >> 4, sg = side ? -1 : 1;
  const r0 = (from / n) | 0, c0 = from % n, r1 = (to / n) | 0, c1 = to % n;
  for (const [dr, dc] of STEPS[t]) if (r0 + dr * sg === r1 && c0 + dc === c1) return 'step';
  for (const [dr, dc] of SLIDES[t]) for (let k = 1; k < n; k++) if (r0 + dr * sg * k === r1 && c0 + dc * k === c1) return 'slide';
  return false;
}
export function whyNotMove(pos, from, to) {
  const n = pos.n, c = pos.b[from], t = c & 15, side = pos.turn, x = pos.b[to];
  if (from === to) return 'Tap a highlighted point to move there, or tap the piece again to put it down.';
  if (x && (x >> 4) === side) return 'That point already holds one of your own pieces.';
  const how = reachable(pos, from, to);
  if (!how) return NAME[t] + ' cannot move like that. ' + HINT[t].replace(/^[^:]*: /, '');
  if (how === 'slide') {
    const r0 = (from / n) | 0, c0 = from % n, r1 = (to / n) | 0, c1 = to % n;
    const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
    for (let r = r0 + dr, cc = c0 + dc; r !== r1 || cc !== c1; r += dr, cc += dc) if (pos.b[r * n + cc]) return 'A ' + NAME[t].toLowerCase() + ' slides but cannot jump over pieces: something is in the way.';
  }
  return inCheck(pos, side)
    ? 'Your king is in check. You must get out of check: capture the attacker, block it, or move the king.'
    : 'That would leave your king in check. This piece is guarding your king.';
}
export function whyNotDrop(pos, t, to) {
  const n = pos.n, side = pos.turn, r = (to / n) | 0;
  if (pos.b[to]) return 'A captured piece can only be dropped on an empty point.';
  if ((t === P || t === L || t === N) && deadRows(n, side, t, r)) return 'A ' + NAME[t].toLowerCase() + ' dropped there could never move again, so it is not allowed.';
  if (t === P) for (let i = 0; i < pos.b.length; i++) if (pos.b[i] === (P | (side << 4)) && i % n === to % n) return 'Two unpromoted pawns of yours may never share a column (nifu).';
  const m = dropMove(t, to), cap = make(pos, m);
  const mine = pos.kings[side] >= 0 && attacked(pos, pos.kings[side], 1 - side);
  const mate = t === P && inCheck(pos, pos.turn) && !hasLegalMove(pos);
  unmake(pos, m, cap);
  if (mine) return inCheck(pos, side) ? 'Your king is in check. A drop there does not stop it.' : 'That drop would leave your king in check.';
  if (mate) return 'A pawn may not be dropped to give checkmate (uchifuzume). Win with a move, not a pawn drop.';
  return 'That drop is not allowed.';
}

// Short plain-language reasons for a move (used by hints).
export function describe(pos, m) {
  const side = pos.turn, out = [], to = mTo(m);
  if (isDrop(m)) out.push('drops a ' + NAME[mDrop(m)].toLowerCase() + ' from your stand');
  else {
    const from = mFrom(m), t = pos.b[from] & 15, x = pos.b[to];
    if (x) out.push('captures their ' + NAME[x & 15].toLowerCase());
    if (mPromo(m)) out.push('promotes the ' + NAME[t].toLowerCase());
    if (!x && !mPromo(m) && attacked(pos, from, 1 - side)) out.push('moves your ' + NAME[t].toLowerCase() + ' out of danger');
  }
  const wasCheck = inCheck(pos, side), cap = make(pos, m);
  const chk = inCheck(pos, pos.turn), mate = chk && !hasLegalMove(pos);
  unmake(pos, m, cap);
  if (wasCheck) out.unshift('gets your king out of check');
  if (mate) out.push('gives checkmate');
  else if (chk) out.push('gives check');
  return out;
}

export function sqName(pos, i) { const n = pos.n; return (n - (i % n)) + String.fromCharCode(97 + ((i / n) | 0)); }
