// THE RULE BOOK for Go. Readable and authoritative; engine.js re-implements the same rules on typed arrays for speed
// and the tests replay its games through this file to prove they agree.
//
// Rules used (all documented on the How-to-play page):
//  - Stones are placed on the crossings. Black moves first. A move may be a pass.
//  - A group with no liberties is captured. Capturing happens before the suicide check; suicide is not allowed.
//  - Ko: the simple-ko point is remembered (and shown); on top of it, POSITIONAL SUPERKO is enforced: a move may
//    never recreate an earlier whole-board position (hist holds a hash of each position).
//  - Two passes in a row end the game. Chinese AREA scoring: live stones + empty points that only one colour
//    touches, komi added to White. Dead stones are found automatically and can be changed by the player.
export const EMPTY = 0, BLACK = 1, WHITE = 2;
export const opp = (c) => 3 - c;
export const KOMI = { 5: 0.5, 7: 5.5, 9: 5.5, 13: 7.5, 19: 7.5 };

const NB = {};
export function nbs(n) {
  if (NB[n]) return NB[n];
  const t = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = [], i = y * n + x;
    if (y > 0) a.push(i - n);
    if (x > 0) a.push(i - 1);
    if (x < n - 1) a.push(i + 1);
    if (y < n - 1) a.push(i + n);
    t.push(a);
  }
  return (NB[n] = t);
}

export function hashBoard(b) {
  let h1 = 2166136261, h2 = 5381;
  for (let i = 0; i < b.length; i++) { h1 = Math.imul(h1 ^ (b[i] + 1), 16777619); h2 = (Math.imul(h2, 33) + b[i] + 1) | 0; }
  return (h1 >>> 0).toString(36) + '.' + (h2 >>> 0).toString(36);
}

export function newGame(n = 9, komi = KOMI[n] ?? 7.5) {
  const b = new Array(n * n).fill(0);
  return { n, b, turn: BLACK, ko: -1, caps: [0, 0, 0], passes: 0, moves: 0, last: -1, komi, hist: [hashBoard(b)], lastCaptured: [] };
}
export const clone = (g) => ({ ...g, b: g.b.slice(), caps: g.caps.slice(), hist: g.hist.slice(), lastCaptured: g.lastCaptured.slice() });

// The connected group of same-coloured stones containing point i, and its liberties.
export function group(b, n, i) {
  const c = b[i], N = nbs(n), seen = new Set([i]), stones = [i], libs = new Set();
  for (let k = 0; k < stones.length; k++) for (const j of N[stones[k]]) {
    if (b[j] === EMPTY) libs.add(j);
    else if (b[j] === c && !seen.has(j)) { seen.add(j); stones.push(j); }
  }
  return { stones, libs: [...libs] };
}

export const WHY = {
  occupied: 'That point already has a stone. Choose an empty crossing.',
  suicide: 'Not allowed: that stone would have no liberties and would capture nothing, so it would be removed at once (the suicide rule).',
  ko: 'Ko: you may not retake the single stone straight away, or the fight could repeat forever. Play somewhere else first.',
  superko: 'Not allowed: that would bring back a whole-board position that has already happened.',
  over: 'The game is over.',
  range: 'That is off the board.',
};

// Try a move (i = -1 is a pass) WITHOUT changing g. Returns { ok:true, b, captured, ko, ... } or { ok:false, why, msg }.
export function attempt(g, i) {
  if (i === -1) return { ok: true, pass: true, b: g.b, captured: [], ko: -1 };
  if (i < 0 || i >= g.n * g.n) return { ok: false, why: 'range', msg: WHY.range };
  if (g.b[i] !== EMPTY) return { ok: false, why: 'occupied', msg: WHY.occupied };
  if (i === g.ko) return { ok: false, why: 'ko', msg: WHY.ko };
  const n = g.n, b = g.b.slice(), me = g.turn, N = nbs(n);
  b[i] = me;
  const captured = [];
  for (const j of N[i]) if (b[j] === opp(me)) {
    const gr = group(b, n, j);
    if (gr.libs.length === 0) for (const s of gr.stones) if (b[s] !== EMPTY) { b[s] = EMPTY; captured.push(s); }
  }
  const mine = group(b, n, i);
  if (!captured.length && mine.libs.length === 0) return { ok: false, why: 'suicide', msg: WHY.suicide };
  if (g.hist.includes(hashBoard(b))) return { ok: false, why: 'superko', msg: WHY.superko };
  const ko = captured.length === 1 && mine.stones.length === 1 && mine.libs.length === 1 ? captured[0] : -1;
  return { ok: true, b, captured, ko, group: mine };
}

// Play a move for real. Returns the attempt result (with ok:false and a reason if refused; g unchanged).
export function play(g, i) {
  const r = attempt(g, i);
  if (!r.ok) return r;
  if (r.pass) { g.passes += 1; g.ko = -1; g.lastCaptured = []; }
  else { g.b = r.b; g.passes = 0; g.ko = r.ko; g.caps[g.turn] += r.captured.length; g.lastCaptured = r.captured; g.hist.push(hashBoard(g.b)); }
  g.last = i; g.moves += 1; g.turn = opp(g.turn);
  return r;
}
export const isOver = (g) => g.passes >= 2;

export function legalPoints(g) {
  const out = [];
  for (let i = 0; i < g.n * g.n; i++) if (g.b[i] === EMPTY && attempt(g, i).ok) out.push(i);
  return out;
}

// Chinese area score. dead = array/Set of point indices whose stones are treated as removed.
export function areaScore(g, dead = []) {
  const n = g.n, N = nbs(n), b = g.b.slice(), D = new Set(dead);
  for (const i of D) b[i] = EMPTY;
  const owner = new Array(n * n).fill(0);        // 1 black, 2 white, 3 neutral, 0 = a stone stands here
  const area = [0, 0, 0];
  const seen = new Array(n * n).fill(false);
  for (let i = 0; i < n * n; i++) {
    if (b[i] !== EMPTY) { area[b[i]] += 1; owner[i] = 0; continue; }
    if (seen[i]) continue;
    const region = [i]; seen[i] = true; let touch = 0;
    for (let k = 0; k < region.length; k++) for (const j of N[region[k]]) {
      if (b[j] === EMPTY) { if (!seen[j]) { seen[j] = true; region.push(j); } } else touch |= b[j];
    }
    const o = touch === BLACK ? BLACK : touch === WHITE ? WHITE : 3;
    if (o !== 3) area[o] += region.length;
    for (const s of region) owner[s] = o;
  }
  const black = area[BLACK], white = area[WHITE] + g.komi;
  return { black, white: area[WHITE], komi: g.komi, whiteTotal: white, diff: black - white, winner: black > white ? BLACK : WHITE, owner };
}

export const coord = (n, i) => 'ABCDEFGHJKLMNOPQRST'[i % n] + (n - Math.floor(i / n));
