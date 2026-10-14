// Sáhkku rules: the single source of truth for legality (the Rules page in content.js is cross-checked against this file).
// Pure and deterministic. Players are 0 (Red, camp bottom-left, sits at the bottom) and 1 (Blue, camp top-right, sits at the top).
// Cells are r * 7 + c on a 7x7 grid. The track is the 24 outer cells (clockwise) plus a cross through the middle.

export const N = 7;
export const MEN = 6;
export const DAWN = 0;                       // die face values: 0 is Dawn, 1..3 are numbers
export const NAMES = ['Red', 'Blue'];
export const cell = (r, c) => r * N + c;

// Outer ring, clockwise from the top-left corner.
export const RING = [];
for (let c = 0; c < N; c++) RING.push(cell(0, c));
for (let r = 1; r < N; r++) RING.push(cell(r, N - 1));
for (let c = N - 2; c >= 0; c--) RING.push(cell(N - 1, c));
for (let r = N - 2; r >= 1; r--) RING.push(cell(r, 0));
export const RING_LEN = RING.length;         // 24
export const ringIdx = new Array(N * N).fill(-1);
RING.forEach((c, i) => { ringIdx[c] = i; });
export const CENTRE = cell(3, 3);
export const GATES = [cell(0, 3), cell(3, N - 1), cell(N - 1, 3), cell(3, 0)];
export const CAMP = [cell(N - 1, 0), cell(0, N - 1)];
// inward step from a gate, and the cells of the cross
const inward = new Map([[cell(0, 3), cell(1, 3)], [cell(3, N - 1), cell(3, 5)], [cell(N - 1, 3), cell(5, 3)], [cell(3, 0), cell(3, 1)]]);
export const CROSS = [cell(1, 3), cell(2, 3), cell(4, 3), cell(5, 3), cell(3, 1), cell(3, 2), cell(3, 4), cell(3, 5)];
export const onTrack = (c) => ringIdx[c] >= 0 || c === CENTRE || CROSS.includes(c);
export const TRACK = [...RING, ...CROSS, CENTRE];
const crossSet = new Set([...CROSS, CENTRE]);
const rc = (c) => [Math.floor(c / N), c % N];

// Cells a piece may step to next. `prev` (the cell it just came from within the same move) is never stepped straight back to.
export function stepsFrom(c, prev, king) {
  const out = [];
  const add = (x) => { if (x !== undefined && x !== prev && !out.includes(x)) out.push(x); };
  if (ringIdx[c] >= 0) {
    add(RING[(ringIdx[c] + 1) % RING_LEN]);
    if (king) add(RING[(ringIdx[c] + RING_LEN - 1) % RING_LEN]);
    if (inward.has(c)) add(inward.get(c));
  } else if (crossSet.has(c)) {
    const [r, cc] = rc(c);
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const r2 = r + dr, c2 = cc + dc;
      if (r2 < 0 || r2 >= N || c2 < 0 || c2 >= N) continue;
      const x = cell(r2, c2);
      // along the axis of the cross only: a cross cell links to the neighbouring cross cell or to the gate it leads to
      const onAxis = (r === 3 && dr === 0) || (cc === 3 && dc === 0) || c === CENTRE;
      if (!onAxis) continue;
      if (crossSet.has(x) || (ringIdx[x] >= 0 && GATES.includes(x))) add(x);
    }
  }
  return out;
}

// Every cell a piece can reach in exactly n steps, with one path to it. Memoised: it only depends on the cell, the n and king-ness.
const reachMemo = new Map();
export function reach(c, n, king) {
  const key = `${c}|${n}|${king ? 1 : 0}`;
  let v = reachMemo.get(key);
  if (v) return v;
  let frontier = [{ c, prev: -1, path: [] }];
  for (let s = 0; s < n; s++) {
    const next = [], seen = new Set();
    for (const f of frontier) for (const x of stepsFrom(f.c, f.prev, king)) {
      const k = x * 64 + f.c;
      if (seen.has(k)) continue; seen.add(k);
      next.push({ c: x, prev: f.c, path: [...f.path, x] });
    }
    frontier = next;
  }
  const m = new Map();
  for (const f of frontier) if (!m.has(f.c)) m.set(f.c, f.path);
  v = m; reachMemo.set(key, v);
  return v;
}

export function newGame() {
  return {
    men: [new Array(N * N).fill(0), new Array(N * N).fill(0)], sleep: [MEN, MEN], king: { cell: CENTRE, owner: -1 },
    turn: 0, phase: 'roll', dice: [], used: [], extra: false, rolls: 0, quiet: 0, capThisTurn: false,
    winner: -1, reason: '', lost: [0, 0], moves: 0, last: null,
  };
}
export const clone = (g) => ({ ...g, men: [g.men[0].slice(), g.men[1].slice()], sleep: g.sleep.slice(), king: { ...g.king }, dice: g.dice.slice(), used: g.used.slice(), lost: g.lost.slice(), last: g.last ? { ...g.last } : null });
export const menLeft = (g, p) => g.sleep[p] + g.men[p].reduce((a, b) => a + b, 0);
export const stackKey = (g) => `${g.men[0].join('')}|${g.men[1].join('')}|${g.sleep}|${g.king.cell}.${g.king.owner}`;

// Is `c` safe from player p's rival: a pair, a man on his own camp, or a man in the company of his own king.
export function protectedMan(g, c, p) {
  const n = g.men[p][c];
  if (n <= 0) return false;
  if (n >= 2) return true;
  if (c === CAMP[p]) return true;
  if (g.king.cell === c && g.king.owner === p) return true;
  return false;
}

// Can a piece of player p land on c? Returns null (no) or { cap, flip }. A man may not join two of his own.
export function landing(g, c, p, king) {
  const q = 1 - p;
  if (g.men[q][c] > 0 && protectedMan(g, c, q)) return null;
  const cap = g.men[q][c] === 1;
  if (!king && g.men[p][c] >= 2) return null;
  const flip = g.king.cell === c && g.king.owner !== p && !king;
  return { cap, flip };
}

// All legal moves with the unused dice, one entry per distinct (die value, kind, from, to).
export function legalMoves(g) {
  if (g.phase !== 'move') return [];
  const p = g.turn, out = [], seen = new Set();
  const push = (m) => { const k = `${m.val}|${m.kind}|${m.from}|${m.to}`; if (!seen.has(k)) { seen.add(k); out.push(m); } };
  for (let d = 0; d < g.dice.length; d++) {
    if (g.used[d]) continue;
    const val = g.dice[d], n = val === DAWN ? 1 : val;
    if (val === DAWN && g.sleep[p] > 0) {
      const l = landing(g, CAMP[p], p, false);
      if (l) push({ die: d, val, kind: 'wake', from: -1, to: CAMP[p], path: [CAMP[p]], cap: l.cap, flip: l.flip });
    }
    for (let c = 0; c < N * N; c++) {
      if (g.men[p][c] > 0) {
        for (const [to, path] of reach(c, n, false)) { const l = landing(g, to, p, false); if (l && to !== c) push({ die: d, val, kind: 'man', from: c, to, path, cap: l.cap, flip: l.flip }); }
      }
    }
    if (g.king.owner === p) {
      const c = g.king.cell;
      for (const [to, path] of reach(c, n, true)) { const l = landing(g, to, p, true); if (l && to !== c) push({ die: d, val, kind: 'king', from: c, to, path, cap: l.cap, flip: false }); }
    }
  }
  return out;
}

// Applies one move (mutates g). Handles capture, king flip, the end of the turn and the end of the game.
export function applyMove(g, m) {
  const p = g.turn, q = 1 - p;
  let cap = false, flip = false;
  if (m.kind === 'wake') g.sleep[p] -= 1; else if (m.kind === 'man') g.men[p][m.from] -= 1;
  if (m.kind === 'king') { g.king.cell = m.to; }
  else {
    g.men[p][m.to] += 1;
  }
  if (g.men[q][m.to] === 1) { g.men[q][m.to] = 0; g.lost[q] += 1; cap = true; g.capThisTurn = true; }   // legality guarantees it is a lone, unprotected man
  if (m.kind !== 'king' && g.king.cell === m.to && g.king.owner !== p) { g.king.owner = p; flip = true; }
  if (m.kind === 'king' && g.king.owner !== p) g.king.owner = p;
  g.used[m.die] = true; g.moves += 1;
  g.last = { from: m.from, to: m.to, p, kind: m.kind, cap, flip };
  if (menLeft(g, q) === 0) { g.winner = p; g.reason = `${NAMES[p]} has captured every ${NAMES[q]} herder.`; g.phase = 'over'; return { cap, flip }; }
  if (!legalMoves(g).length) endTurn(g);
  return { cap, flip };
}

function endTurn(g) {
  if (g.winner >= 0) return;
  if (!g.capThisTurn) g.quiet += 1; else g.quiet = 0;
  g.capThisTurn = false;
  const matched = g.dice.length === 4 && g.dice.every((v) => v === g.dice[0]);
  g.dice = []; g.used = []; g.phase = 'roll';
  if (g.quiet >= 160) {                       // 80 rolls each without a capture
    const a = menLeft(g, 0), b = menLeft(g, 1);
    g.winner = a === b ? 2 : a > b ? 0 : 1; g.phase = 'over';
    g.reason = a === b ? 'Eighty rolls each without a capture, and the sides are level.' : `Eighty rolls each without a capture: ${NAMES[g.winner]} has more herders.`;
    return;
  }
  g.extra = matched;
  if (!matched) g.turn = 1 - g.turn;
}

// Roll the four dice for the player to move. Returns false when none of the dice can be used (the turn passes).
export function rollDice(g, rng) {
  g.dice = [rng.int(4), rng.int(4), rng.int(4), rng.int(4)]; g.used = [false, false, false, false]; g.phase = 'move'; g.rolls += 1; g.extra = false;
  if (!legalMoves(g).length) { endTurn(g); return false; }
  return true;
}

export const describeMove = (g, m) => {
  const what = m.kind === 'wake' ? 'Wake a herder' : m.kind === 'king' ? 'Move the reindeer king' : 'Move a herder';
  const tail = m.cap ? ' and capture a rival' : m.flip ? ' and win the king over' : '';
  return `${what} with ${m.val === DAWN ? 'Dawn' : m.val}${tail}.`;
};
