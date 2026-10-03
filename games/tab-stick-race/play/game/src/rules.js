// Tab (stick-dice race): the rules engine. Pure and deterministic: no clock, no randomness (the throw result is passed in).
//
// Board: 4 rows x 7 columns, one shared path of 28 squares that snakes row by row (path index 0 is the bottom-left square,
// row 0 runs left to right, row 1 right to left, and so on up to index 27 at the top-left). Side 0 (Ivory, bottom) walks the path
// 0 -> 27; side 1 (Clay, top) walks it the other way, 27 -> 0. A side's own position `i` (0..27) is board square `sqOf(p, i)`.
// A piece's position is -1 (waiting off the board), 0..27 (on the path) or 28 (home: borne off past the far end).
export const COLS = 7, ROWS = 4, N = 28, PIECES = 7, HOME = 28, WAIT = -1;
export const SAFE = [3, 10, 17, 24];            // the middle square of each row: nothing may be captured or landed on there
export const isSafe = (sq) => sq === 3 || sq === 10 || sq === 17 || sq === 24;
export const FLAT_TO_VALUE = [6, 1, 2, 3, 4];    // number of flat sides up (0..4) -> the count thrown
export const FLAT_ODDS = [1, 4, 6, 4, 1];        // out of 16
export const extraThrow = (v) => v === 1 || v === 4 || v === 6;
export const other = (p) => 1 - p;
export const sqOf = (p, i) => (p === 0 ? i : N - 1 - i);
export const posOf = (p, sq) => (p === 0 ? sq : N - 1 - sq);
// Board cell of a path index in "white orientation": row 0 is Ivory's home row (bottom of the screen when Ivory is at the bottom).
export const cellOf = (sq) => { const r = Math.floor(sq / COLS), k = sq % COLS; return { r, c: r % 2 === 0 ? k : COLS - 1 - k }; };
export const sideName = (p) => (p === 0 ? 'Ivory' : 'Clay');

export function newGame(opts = {}) {
  const n = opts.pieces ?? PIECES;
  return { pos: [new Array(n).fill(WAIT), new Array(n).fill(WAIT)], turn: opts.first ?? 0, phase: 'throw', pending: [], throws: [], winner: -1, plies: 0 };
}
// A position built by hand (lessons, staged screenshots): ivory / clay are lists of positions (-1 waiting, 28 home).
export function makeState(ivory, clay, pending = [], phase = 'move', turn = 0) {
  const st = newGame({ pieces: ivory.length, first: turn });
  st.pos = [ivory.slice(), clay.slice()]; st.pending = pending.slice(); st.throws = pending.slice(); st.phase = phase;
  return st;
}
export const clone = (st) => ({ pos: [st.pos[0].slice(), st.pos[1].slice()], turn: st.turn, phase: st.phase, pending: st.pending.slice(), throws: st.throws.slice(), winner: st.winner, plies: st.plies });
export const homeCount = (st, p) => st.pos[p].filter((x) => x === HOME).length;
export const waitCount = (st, p) => st.pos[p].filter((x) => x === WAIT).length;
export const boardCount = (st, p) => st.pos[p].length - homeCount(st, p) - waitCount(st, p);

// Which side (if any) stands on board square sq.
export function occupant(st, sq) {
  if (st.pos[0].includes(sq)) return 0;
  if (st.pos[1].includes(N - 1 - sq)) return 1;
  return -1;
}

// ---- moves --------------------------------------------------------------------------------------------------------
// A move: { from (own position, -1 = enter), to (own position, 28 = bear off), v, cap (enemy piece captured), sq (board square landed on) }.
export function movesWith(st, v) {
  const p = st.turn, out = [];
  const seen = new Set();
  for (const from of st.pos[p]) {
    if (from === HOME || seen.has(from)) continue;
    seen.add(from);
    let to;
    if (from === WAIT) { if (v !== 1) continue; to = 0; } else to = from + v;
    if (to >= N) { out.push({ from, to: HOME, v, cap: false, sq: -1, off: true }); continue; }
    if (st.pos[p].includes(to)) continue;                                        // own piece in the way
    const sq = sqOf(p, to), enemy = st.pos[other(p)].includes(posOf(other(p), sq));
    if (enemy && isSafe(sq)) continue;                                          // an enemy on a safe square cannot be hit
    out.push({ from, to, v, cap: enemy, sq, off: false });
  }
  return out;
}
export function legalMoves(st) {
  if (st.phase !== 'move') return [];
  const out = [], vs = [...new Set(st.pending)];
  for (const v of vs) for (const m of movesWith(st, v)) out.push(m);
  return out;
}

// Apply a throw result (the number of flat sides up). Returns the new state; passes the turn when nothing can be played.
export function applyThrow(st, flats) {
  const s = clone(st);
  const v = FLAT_TO_VALUE[flats];
  s.pending.push(v); s.throws.push(v);
  s.phase = extraThrow(v) ? 'throw' : 'move';
  return settle(s);
}

// After a throw or a move: pass the turn when every value is spent or nothing can be played.
export function settle(s) {
  if (s.winner >= 0) return s;
  if (s.phase === 'move') {
    if (!s.pending.length || legalMoves(s).length === 0) { s.pending = []; s.throws = []; s.turn = other(s.turn); s.phase = 'throw'; s.plies += 1; }
  }
  return s;
}

export function applyMove(st, mv) {
  const s = clone(st), p = s.turn;
  const idx = s.pending.indexOf(mv.v);
  if (idx >= 0) s.pending.splice(idx, 1);
  const k = s.pos[p].indexOf(mv.from);
  s.pos[p][k] = mv.to;
  if (mv.cap) { const e = s.pos[other(p)].indexOf(posOf(other(p), mv.sq)); if (e >= 0) s.pos[other(p)][e] = WAIT; }
  if (homeCount(s, p) === s.pos[p].length) { s.winner = p; s.phase = 'over'; s.pending = []; return s; }
  return settle(s);
}

export const result = (st) => (st.winner >= 0 ? { winner: st.winner } : null);

// ---- probabilities (exact, from the throw rules) ---------------------------------------------------------------------
// One turn = throws until a 2 or 3 appears; the collected values may be spent in any order. TURN_DIST lists every multiset of
// values with its probability (sequences longer than MAXLEN throws, about 0.3 percent, are folded into the longest).
const MAXLEN = 6;
export const TURN_DIST = (() => {
  const map = new Map();
  const flatP = FLAT_ODDS.map((n) => n / 16);
  const rec = (vals, p) => {
    for (let f = 0; f <= 4; f++) {
      const v = FLAT_TO_VALUE[f], q = p * flatP[f];
      const next = vals.concat(v);
      if (!extraThrow(v) || next.length >= MAXLEN) {
        const key = next.slice().sort((a, b) => a - b).join(',');
        const e = map.get(key);
        if (e) e.p += q; else map.set(key, { vals: next.slice().sort((a, b) => a - b), p: q });
      } else rec(next, q);
    }
  };
  rec([], 1);
  const list = [...map.values()];
  const tot = list.reduce((s, e) => s + e.p, 0);
  for (const e of list) {
    e.p /= tot;
    let mask = 1;                                           // bit d set = d squares reachable by some subset of the values
    for (const v of e.vals) mask |= (mask << v) >>> 0;
    e.sums = mask >>> 0;
    // sums when one 1 is spent entering (a waiting piece lands on position 0, then walks the rest)
    const i1 = e.vals.indexOf(1);
    if (i1 >= 0) { let m2 = 1; e.vals.forEach((v, k) => { if (k !== i1) m2 |= (m2 << v) >>> 0; }); e.enter = m2 >>> 0; } else e.enter = 0;
  }
  list.sort((a, b) => b.p - a.p);
  return list;
})();

const bit = (mask, d) => (d >= 0 && d < 31 ? ((mask >>> d) & 1) === 1 : false);

// Probability that, on its next turn, side q can put a piece on board square sq (an upper bound: it ignores its own blockers).
export function hitChance(st, q, sq) {
  if (isSafe(sq)) return 0;
  const tp = posOf(q, sq);
  const pcs = st.pos[q].filter((x) => x !== HOME);
  if (!pcs.length) return 0;
  let waiting = false; const onb = [];
  for (const x of pcs) { if (x === WAIT) waiting = true; else if (x < tp) onb.push(x); }
  let tot = 0;
  for (const e of TURN_DIST) {
    let hit = false;
    for (const x of onb) if (bit(e.sums, tp - x)) { hit = true; break; }
    if (!hit && waiting && bit(e.enter, tp)) hit = true;
    if (hit) tot += e.p;
  }
  return tot;
}

// Position-key for memoising searches.
export const keyOf = (st) => `${st.pos[0].slice().sort().join('.')}|${st.pos[1].slice().sort().join('.')}|${st.turn}|${st.pending.slice().sort().join('')}|${st.phase}`;
