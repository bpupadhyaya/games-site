// Fanorona rules: the single source of truth for legality (the Rules pages in content.js describe exactly
// what this file does). Pure and deterministic: no randomness, no clocks.
//
// The board is 5 lines by 9 lines of points. A point is r*9 + c with r = 0..4 and c = 0..8.
// Every point joins its orthogonal neighbours; a point where (r + c) is even is "strong" and also joins its
// four diagonal neighbours.
//
// A turn: the mover picks a stone and moves it one step along a line to an empty point.
//   APPROACH captures the unbroken run of enemy stones straight ahead of the point it lands on.
//   WITHDRAWAL captures the unbroken run straight behind the point it left.
// If the first step of a turn can capture, that stone may keep going (optional): each further step must capture,
// must land on a point the stone has not stood on this turn, and must not repeat the previous step's direction.
// A capturing turn is compulsory: when any stone can capture, a quiet move ("paika") is not allowed.
export const ROWS = 5, COLS = 9, N = 45;
export const EMPTY = 0, LIGHT = 1, DARK = 2;
export const other = (s) => 3 - s;
export const SIDE_NAME = { 1: 'Light', 2: 'Dark' };
export const NO_CAPTURE_LIMIT = 20; // turns in a row (both players together) without a capture => draw
export const idx = (r, c) => r * COLS + c;
export const rowOf = (p) => (p / COLS) | 0;
export const colOf = (p) => p % COLS;
export const isStrong = (p) => ((rowOf(p) + colOf(p)) & 1) === 0;

// direction index -> [dr, dc]; opposite of d is 7 - d
export const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
export const DIR_NAME = ['up-left', 'up', 'up-right', 'left', 'right', 'down-left', 'down', 'down-right'];

// NEI[p] = [{ d, to }] : the points joined to p by a line
export const NEI = [];
for (let p = 0; p < N; p++) {
  const r = rowOf(p), c = colOf(p), list = [];
  for (let d = 0; d < 8; d++) {
    const [dr, dc] = DIRS[d];
    if (dr !== 0 && dc !== 0 && !isStrong(p)) continue;
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
    list.push({ d, to: idx(nr, nc) });
  }
  NEI.push(list);
}
// every drawn line segment once: [p, q]
export const SEGMENTS = [];
for (let p = 0; p < N; p++) for (const { d, to } of NEI[p]) if (to > p) SEGMENTS.push([p, to]);

// The run of enemy stones starting at (r, c) and heading (dr, dc). Returns point indexes.
function run(board, enemy, r, c, dr, dc) {
  const out = [];
  while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === enemy) { out.push(r * COLS + c); r += dr; c += dc; }
  return out;
}
// Victims of moving from -> to (direction d). { approach: [...], withdraw: [...] }
export function stepVictims(board, side, from, to, d) {
  const enemy = other(side), [dr, dc] = DIRS[d];
  const tr = rowOf(to), tc = colOf(to), fr = rowOf(from), fc = colOf(from);
  return {
    approach: run(board, enemy, tr + dr, tc + dc, dr, dc),
    withdraw: run(board, enemy, fr - dr, fc - dc, -dr, -dc),
  };
}

export function startBoard() {
  const b = new Array(N).fill(EMPTY);
  for (let c = 0; c < COLS; c++) { b[idx(0, c)] = LIGHT; b[idx(1, c)] = LIGHT; b[idx(3, c)] = DARK; b[idx(4, c)] = DARK; }
  const mid = [DARK, LIGHT, DARK, LIGHT, EMPTY, DARK, LIGHT, DARK, LIGHT];
  for (let c = 0; c < COLS; c++) b[idx(2, c)] = mid[c];
  return b;
}
export const countOf = (board, side) => { let n = 0; for (let p = 0; p < N; p++) if (board[p] === side) n++; return n; };

// Every step a stone on `from` may take, given what it has already done this turn.
//   visited : array/Set of points already stood on this turn (excluded), lastD : previous direction or -1.
// `captureOnly` true => only capturing steps (turn continuation, or the compulsory-capture rule).
// A step is { from, to, d, kind: 'approach' | 'withdraw' | 'paika', victims: [...] }.
export function stepsFrom(board, side, from, visited, lastD, captureOnly) {
  const out = [];
  for (const { d, to } of NEI[from]) {
    if (board[to] !== EMPTY || d === lastD) continue;
    if (visited && (visited.has ? visited.has(to) : visited.includes(to))) continue;
    const v = stepVictims(board, side, from, to, d);
    if (v.approach.length) out.push({ from, to, d, kind: 'approach', victims: v.approach });
    if (v.withdraw.length) out.push({ from, to, d, kind: 'withdraw', victims: v.withdraw });
    if (!captureOnly && !v.approach.length && !v.withdraw.length) out.push({ from, to, d, kind: 'paika', victims: [] });
  }
  return out;
}
// Does `side` have any capturing step at all (turn start)?
export function canCapture(board, side) {
  for (let p = 0; p < N; p++) if (board[p] === side && stepsFrom(board, side, p, null, -1, true).length) return true;
  return false;
}

// ---- game state --------------------------------------------------------------------------------------------------
// g = { board, turn, chain: null | { pos, visited: [...], lastD, taken }, ply, quiet, result, log }
//   result: null | { winner: 0|1|2, why: 'wiped' | 'blocked' | 'draw-quiet' }
//   log: [{ side, steps: [{from,to,kind,victims}] }]   (one entry per finished turn)
export function newGame(board) {
  return { board: board ? board.slice() : startBoard(), turn: LIGHT, chain: null, ply: 0, quiet: 0, result: null, log: [], history: [] };
}
export function cloneGame(g) {
  return { board: g.board.slice(), turn: g.turn, chain: g.chain ? { pos: g.chain.pos, visited: g.chain.visited.slice(), lastD: g.chain.lastD, taken: g.chain.taken, steps: g.chain.steps.slice() } : null, ply: g.ply, quiet: g.quiet, result: g.result, log: g.log.slice(), history: g.history.slice() };
}

// Legal steps right now for the side to move (respects a turn in progress and the compulsory-capture rule).
export function legalSteps(g) {
  if (g.result) return [];
  if (g.chain) return stepsFrom(g.board, g.turn, g.chain.pos, g.chain.visited, g.chain.lastD, true);
  const caps = [], quiet = [];
  for (let p = 0; p < N; p++) {
    if (g.board[p] !== g.turn) continue;
    for (const s of stepsFrom(g.board, g.turn, p, null, -1, false)) (s.kind === 'paika' ? quiet : caps).push(s);
  }
  return caps.length ? caps : quiet;
}
// Does the side to move have to capture this turn?
export const mustCapture = (g) => !g.chain && !g.result && canCapture(g.board, g.turn);

// Is `step` legal now? Returns the matching legal step (same object shape) or null.
export function findStep(g, from, to, kind) {
  return legalSteps(g).find((s) => s.from === from && s.to === to && (kind ? s.kind === kind : true)) || null;
}

function finishTurn(g) {
  const entry = { side: g.turn, steps: g.chain ? g.chain.steps.slice() : [] };
  g.log.push(entry);
  const took = g.chain ? g.chain.taken : 0;
  g.chain = null;
  g.turn = other(g.turn); g.ply += 1;
  g.quiet = took ? 0 : g.quiet + 1;
  if (countOf(g.board, g.turn) === 0) g.result = { winner: other(g.turn), why: 'wiped' };
  else if (g.quiet >= NO_CAPTURE_LIMIT) g.result = { winner: 0, why: 'draw-quiet' };
  else if (legalSteps(g).length === 0) g.result = { winner: other(g.turn), why: 'blocked' };
}
// Snapshot taken at the start of each turn so Undo can return to it.
const snap = (g) => ({ board: g.board.slice(), turn: g.turn, ply: g.ply, quiet: g.quiet, logLen: g.log.length });

// Play one step. Returns { ok, victims, ended } (ended = the turn is over, either a quiet move or no capture can follow).
export function applyStep(g, step) {
  const legal = findStep(g, step.from, step.to, step.kind);
  if (!legal) return { ok: false };
  if (!g.chain) g.history.push(snap(g));
  const side = g.turn;
  g.board[legal.from] = EMPTY; g.board[legal.to] = side;
  for (const v of legal.victims) g.board[v] = EMPTY;
  const rec = { from: legal.from, to: legal.to, d: legal.d, kind: legal.kind, victims: legal.victims.slice() };
  if (legal.kind === 'paika') {
    g.chain = { pos: legal.to, visited: [legal.from, legal.to], lastD: legal.d, taken: 0, steps: [rec] };
    finishTurn(g);
    return { ok: true, victims: [], ended: true, step: rec };
  }
  if (!g.chain) g.chain = { pos: legal.from, visited: [legal.from], lastD: -1, taken: 0, steps: [] };
  g.chain.pos = legal.to; g.chain.visited.push(legal.to); g.chain.lastD = legal.d; g.chain.taken += legal.victims.length; g.chain.steps.push(rec);
  const more = countOf(g.board, other(side)) > 0 && stepsFrom(g.board, side, g.chain.pos, g.chain.visited, g.chain.lastD, true).length > 0;
  if (!more) { finishTurn(g); return { ok: true, victims: rec.victims, ended: true, step: rec }; }
  return { ok: true, victims: rec.victims, ended: false, step: rec };
}
// Stop capturing early (only legal mid-chain).
export function endChain(g) {
  if (!g.chain || g.result) return false;
  finishTurn(g);
  return true;
}
// Undo the last full turn (the snapshot taken when it started). Also cancels a turn in progress.
export function undoTurn(g) {
  const s = g.history.pop();
  if (!s) return false;
  g.board = s.board; g.turn = s.turn; g.ply = s.ply; g.quiet = s.quiet; g.log.length = s.logLen; g.chain = null; g.result = null;
  return true;
}
// Throw away an unfinished turn (back to its start).
export function cancelChain(g) {
  if (!g.chain) return false;
  return undoTurn(g);
}

// ---- whole-turn generation (AI, hints, tests) ----------------------------------------------------------------------
// Every complete turn the side to move may choose from: { steps, board, caps, from, to }.
// Different step sequences that end in the same position are merged.
export function genTurns(board, side) {
  const out = [], seen = new Set();
  const key = (b) => b.join('');
  const first = [];
  let anyCap = false;
  for (let p = 0; p < N; p++) {
    if (board[p] !== side) continue;
    for (const s of stepsFrom(board, side, p, null, -1, false)) { first.push(s); if (s.kind !== 'paika') anyCap = true; }
  }
  if (!anyCap) {
    for (const s of first) {
      const b = board.slice(); b[s.from] = EMPTY; b[s.to] = side;
      const k = key(b); if (seen.has(k)) continue; seen.add(k);
      out.push({ steps: [{ from: s.from, to: s.to, d: s.d, kind: 'paika', victims: [] }], board: b, caps: 0, from: s.from, to: s.to, key: k });
    }
    return out;
  }
  const dfs = (b, s, visited, steps, caps, startFrom) => {
    const b2 = b.slice(); b2[s.from] = EMPTY; b2[s.to] = side;
    for (const v of s.victims) b2[v] = EMPTY;
    const st = steps.concat([{ from: s.from, to: s.to, d: s.d, kind: s.kind, victims: s.victims }]);
    const total = caps + s.victims.length;
    const k = key(b2);
    if (!seen.has(k)) { seen.add(k); out.push({ steps: st, board: b2, caps: total, from: startFrom, to: s.to, key: k }); }
    visited.push(s.to);
    for (const nxt of stepsFrom(b2, side, s.to, visited, s.d, true)) dfs(b2, nxt, visited, st, total, startFrom);
    visited.pop();
  };
  for (const s of first) if (s.kind !== 'paika') dfs(board, s, [s.from], [], 0, s.from);
  return out;
}
