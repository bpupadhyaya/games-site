// THE RULE BOOK for Nine Men's Morris. Readable and authoritative; engine.js searches the same game.
// Points: index = ring * 8 + k. ring 0 = outer square, 1 = middle, 2 = inner. k = 0..7 clockwise from the top-left
// corner: 0 TL, 1 T, 2 TR, 3 R, 4 BR, 5 B, 6 BL, 7 L (odd k = side midpoints, which carry the four spokes).
// A game is plain JSON: p = [maskLight, maskDark] (24-bit masks), hand = [n, n], turn 0 (Light) or 1 (Dark),
// winner = null | 0 | 1 | 'draw'. A move is one integer: from | to << 5 | take << 10 (24 = none / from hand).
// Mill = row of three on one line. Forming one takes an enemy man; a man in a mill may be taken only when
// every enemy man is in a mill. Down to 3 men (none in hand) a side flies. Fewer than 3, or no legal move, loses.
// Draw: same position 3 times in the moving phase, or 100 plies without a mill.
export const NONE = 24, FULL = 0xffffff, MEN = 9, PLY_LIMIT = 100;
export const bit = (i) => 1 << i;
export const pop = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
export const lowbit = (x) => 31 - Math.clz32(x & -x);
export const NAMES = ['Light', 'Dark'];

export const ADJ = [];                 // neighbour masks
export const MILLS = [];               // the 16 lines as masks
export const MILL_IDX = [];            // the 16 lines as [a, b, c]
export const MILLS_AT = [];            // per point: masks of the (2 or 3) lines through it
for (let i = 0; i < 24; i++) { ADJ.push(0); MILLS_AT.push([]); }
const link = (a, b) => { ADJ[a] |= bit(b); ADJ[b] |= bit(a); };
for (let r = 0; r < 3; r++) for (let k = 0; k < 8; k++) {
  link(r * 8 + k, r * 8 + ((k + 1) % 8));
  if (k % 2 === 1 && r < 2) link(r * 8 + k, (r + 1) * 8 + k);
}
const addMill = (a, b, c) => { const m = bit(a) | bit(b) | bit(c); MILLS.push(m); MILL_IDX.push([a, b, c]); MILLS_AT[a].push(m); MILLS_AT[b].push(m); MILLS_AT[c].push(m); };
for (let r = 0; r < 3; r++) for (let s = 0; s < 4; s++) addMill(r * 8 + s * 2, r * 8 + s * 2 + 1, r * 8 + ((s * 2 + 2) % 8));
for (let k = 1; k < 8; k += 2) addMill(k, 8 + k, 16 + k);

export const mvFrom = (m) => m & 31, mvTo = (m) => (m >> 5) & 31, mvTake = (m) => (m >> 10) & 31;
export const mkMove = (f, t, x = NONE) => f | (t << 5) | (x << 10);
export const posName = (i) => ['outer', 'middle', 'inner'][i >> 3] + ' ' + ['top-left corner', 'top middle', 'top-right corner', 'right middle', 'bottom-right corner', 'bottom middle', 'bottom-left corner', 'left middle'][i & 7];

export function newGame() {
  return { p: [0, 0], hand: [MEN, MEN], turn: 0, plies: 0, since: 0, hist: [], winner: null, reason: '', lastTake: -1 };
}
export const clone = (g) => ({ p: g.p.slice(), hand: g.hand.slice(), turn: g.turn, plies: g.plies, since: g.since, hist: g.hist.slice(), winner: g.winner, reason: g.reason, lastTake: g.lastTake });
export const total = (g, s) => pop(g.p[s]) + g.hand[s];
export const placing = (g) => g.hand[0] + g.hand[1] > 0;
export const flying = (g, s) => g.hand[s] === 0 && pop(g.p[s]) === 3;
export const key = (g) => (g.p[0] + g.p[1] * 16777216) * 2 + g.turn;
export const inMills = (mask) => { let r = 0; for (let i = 0; i < 16; i++) if ((mask & MILLS[i]) === MILLS[i]) r |= MILLS[i]; return r; };
export const formsMill = (mask, to) => { const l = MILLS_AT[to]; for (let i = 0; i < l.length; i++) if ((mask & l[i]) === l[i]) return true; return false; };
// enemy men that may be taken after a mill by side s
export function takeable(g, s) { const o = g.p[1 - s], safe = inMills(o); return (o & ~safe) || o; }

// Every legal move for the side to move (a move that makes a mill appears once per man it may take).
export function legalMoves(g, out = []) {
  out.length = 0;
  if (g.winner !== null) return out;
  const me = g.turn, A = g.p[me], B = g.p[1 - me], empty = FULL & ~(A | B), safe = inMills(B), takes = (B & ~safe) || B;
  const add = (f, t, newA) => {
    if (formsMill(newA, t) && B) { for (let x = takes; x; x &= x - 1) out.push(mkMove(f, t, lowbit(x))); }
    else out.push(mkMove(f, t));
  };
  if (g.hand[me] > 0) { for (let e = empty; e; e &= e - 1) { const t = lowbit(e); add(NONE, t, A | bit(t)); } return out; }
  const fly = pop(A) === 3;
  for (let a = A; a; a &= a - 1) {
    const f = lowbit(a);
    for (let d = (fly ? empty : ADJ[f] & empty); d; d &= d - 1) { const t = lowbit(d); add(f, t, (A & ~bit(f)) | bit(t)); }
  }
  return out;
}

// Play a legal move. Updates counters, the winner and the reason.
export function applyMove(g, m) {
  const me = g.turn, op = 1 - me, f = mvFrom(m), t = mvTo(m), x = mvTake(m);
  if (f === NONE) g.hand[me]--; else g.p[me] &= ~bit(f);
  g.p[me] |= bit(t);
  g.lastTake = -1;
  if (x !== NONE) { g.p[op] &= ~bit(x); g.lastTake = x; }
  g.plies++; g.since = x !== NONE || placing(g) ? 0 : g.since + 1;
  g.turn = op;
  if (total(g, op) < 3) { g.winner = me; g.reason = `${NAMES[op]} is down to two men.`; return g; }
  if (legalMoves(g, []).length === 0) { g.winner = me; g.reason = `${NAMES[op]} has no move: every man is blocked.`; return g; }
  if (!placing(g)) {
    g.hist.push(key(g));
    const k = key(g); let n = 0; for (const h of g.hist) if (h === k) n++;
    if (n >= 3) { g.winner = 'draw'; g.reason = 'The same position came up three times.'; }
    else if (g.since >= PLY_LIMIT) { g.winner = 'draw'; g.reason = 'Fifty moves each without a mill.'; }
  }
  return g;
}
export const repeats = (g) => { if (placing(g)) return 0; const k = key(g); let n = 0; for (const h of g.hist) if (h === k) n++; return n; };

// The move a player's tap describes, or a plain-language reason it is refused. from = -1 places from the hand.
// A result with several moves means the mill made lets the player choose which man to take (see takeable).
export function tryMove(g, from, to) {
  const me = g.turn, name = NAMES[me], all = legalMoves(g, []);
  const f = from < 0 ? NONE : from, ms = all.filter((m) => mvFrom(m) === f && mvTo(m) === to);
  if (ms.length) return { moves: ms };
  const occ = g.p[0] | g.p[1];
  if (from < 0) return { error: g.hand[me] === 0 ? 'All nine men are on the board. Now slide one along a line.' : 'That point is taken.' };
  if (g.hand[me] > 0) return { error: `You still have ${g.hand[me]} ${g.hand[me] === 1 ? 'man' : 'men'} to place. Men only start sliding when all nine are placed.` };
  if (occ & bit(to)) return { error: 'That point is taken. A man can only slide onto an empty point.' };
  if (!flying(g, me) && !(ADJ[from] & bit(to))) return { error: 'A man slides along a line to the very next point only. Look for a glowing point touching this man.' };
  return { error: 'That move is not allowed.' };
}

export function reasonNoMoves(g, from) {
  if (g.hand[g.turn] > 0) return 'Place all nine men first, then you can slide them.';
  const A = g.p[g.turn], empty = FULL & ~(g.p[0] | g.p[1]);
  if (!flying(g, g.turn) && !(ADJ[from] & empty)) return 'That man is blocked: every point beside it is taken.';
  return '';
}

// Which enemy men could an immediate mill next turn threaten? (for hints and warnings)
export function openTwos(g, s) {
  const A = g.p[s], B = g.p[1 - s], out = [];
  for (let i = 0; i < 16; i++) { const L = MILLS[i]; if (pop(A & L) === 2 && !(B & L)) out.push(lowbit(L & ~A)); }
  return out;
}
