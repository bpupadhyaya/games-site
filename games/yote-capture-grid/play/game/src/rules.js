// Yote rules: the single source of truth for what is legal and what a move does. Pure and deterministic.
// The board is 5 rows by 6 columns of pits, numbered 0..29 row by row (square = row * 6 + column). Side 1 = Indigo (moves first),
// side 2 = Ivory. Board values: 0 empty, 1 Indigo pebble, 2 Ivory pebble. Each side starts with 12 pebbles IN HAND and an empty board.
// winner: 0 playing, 1, 2, or 3 = draw.
//
// A turn is exactly one of:
//   drop  - put a pebble from your hand on any empty pit
//   step  - move a pebble on the board one pit up, down, left or right onto an empty pit
//   jump  - leap an orthogonally adjacent enemy pebble onto the empty pit right behind it; that pebble is captured and you ALSO remove any
//           other enemy pebble of your choice (the bonus). Capture is never compulsory and there are no chains.
// The bonus comes from the enemy's board; when none is left there, from the enemy's hand; when that is empty too, there is no bonus.
export const ROWS = 5;
export const COLS = 6;
export const SZ = ROWS * COLS;
export const START_PIECES = 12;
export const QUIET_LIMIT = 80;          // plies (40 each) without a capture before the game is settled on piece count
export const MOVE_LIMIT = 300;          // plies (150 each) before the game is called a draw
export const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
export const NAMES = ['', 'Indigo', 'Ivory'];
export const NO_BONUS = -1, HAND_BONUS = -2;
export const rowOf = (i) => (i / COLS) | 0;
export const colOf = (i) => i % COLS;

export function newGame() {
  const g = { board: new Array(SZ).fill(0), hand: [0, START_PIECES, START_PIECES], turn: 1, moves: 0, lost: [0, 0, 0], winner: 0, reason: '', seen: {}, last: null, quiet: 0 };
  g.seen[posKey(g)] = 1;
  return g;
}
export const clone = (g) => ({ ...g, board: g.board.slice(), hand: g.hand.slice(), lost: g.lost.slice(), seen: { ...g.seen }, last: g.last ? { ...g.last } : null });
export const posKey = (g) => g.board.join('') + '|' + g.hand[1] + ',' + g.hand[2] + '|' + g.turn;
export const onBoard = (b, side) => { let n = 0; for (let i = 0; i < SZ; i++) if (b[i] === side) n++; return n; };
export const pieceCount = (g, side) => onBoard(g.board, side) + g.hand[side];

// ---- move generation -------------------------------------------------------------------------------------------------------
// A move is { kind: 'drop' | 'step' | 'jump', from (-1 for a drop), to, cap (jumped square, -1 if none), bonus }.
// `bonus` is the square the bonus pebble is taken from, HAND_BONUS (-2) for the enemy's hand, NO_BONUS (-1) for none (and for drops/steps).
const mv = (kind, from, to, cap = -1, bonus = NO_BONUS) => ({ kind, from, to, cap, bonus });

// Steps and jumps of the pebble on i for `side` (no bonus chosen yet).
function movesFrom(b, i, side, out, jumpsOnly = false) {
  const r = rowOf(i), c = colOf(i), opp = 3 - side;
  for (let d = 0; d < 4; d++) {
    const r1 = r + DIRS[d][0], c1 = c + DIRS[d][1];
    if (r1 < 0 || r1 >= ROWS || c1 < 0 || c1 >= COLS) continue;
    const q = r1 * COLS + c1;
    if (b[q] === 0) { if (!jumpsOnly) out.push(mv('step', i, q)); continue; }
    if (b[q] !== opp) continue;
    const r2 = r1 + DIRS[d][0], c2 = c1 + DIRS[d][1];
    if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) continue;
    const t = r2 * COLS + c2;
    if (b[t] === 0) out.push(mv('jump', i, t, q));
  }
  return out;
}
export function jumpsOf(b, side, out = []) {
  for (let i = 0; i < SZ; i++) if (b[i] === side) movesFrom(b, i, side, out, true);
  return out;
}

// Which enemy pebbles may be taken as the bonus after `m` (a jump whose bonus is not chosen yet): squares, or [HAND_BONUS] / [NO_BONUS].
export function bonusOptions(b, hand, side, m) {
  const opp = 3 - side, out = [];
  for (let i = 0; i < SZ; i++) if (b[i] === opp && i !== m.cap) out.push(i);
  if (out.length) return out;
  return [hand[opp] > 0 ? HAND_BONUS : NO_BONUS];
}

// Every legal move for `side`. With `topK` (the computer's search) each jump keeps only its K most dangerous bonus choices and the drops
// are narrowed to pits near the action; without it (the player, the rules page, tests) the list is complete, with one entry per bonus.
// `jumpsOnly` is for the search's capture extension.
export function genMoves(b, hand, side, topK = 0, jumpsOnly = false) {
  const out = [], base = [];
  for (let i = 0; i < SZ; i++) if (b[i] === side) movesFrom(b, i, side, base, jumpsOnly);
  for (const m of base) {
    if (m.kind !== 'jump') { out.push(m); continue; }
    const opts = bonusOptions(b, hand, side, m);
    let pick = opts;
    if (topK && opts.length > topK && opts[0] >= 0) pick = rankBonus(b, side, m, opts).slice(0, topK);
    for (const o of pick) out.push(mv('jump', m.from, m.to, m.cap, o));
  }
  if (!jumpsOnly && hand[side] > 0) {
    let near = null;
    if (topK) {                                                   // narrow the drops for the search: pits within two steps of a pebble
      let any = false; near = new Uint8Array(SZ);
      for (let i = 0; i < SZ; i++) if (b[i]) {
        any = true; const r = rowOf(i), c = colOf(i);
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) near[rr * COLS + cc] = 1; }
      }
      if (!any) { for (let i = 0; i < SZ; i++) { const r = rowOf(i), c = colOf(i); if (r >= 1 && r <= 3 && c >= 1 && c <= 4) near[i] = 1; } }
    }
    for (let i = 0; i < SZ; i++) if (b[i] === 0 && (!near || near[i])) out.push(mv('drop', -1, i));
  }
  return out;
}
// Order the bonus choices: an enemy pebble that could jump one of mine right now is the most valuable to remove.
function rankBonus(b, side, m, opts) {
  const opp = 3 - side;
  b[m.from] = 0; b[m.cap] = 0; b[m.to] = side;
  const score = new Map();
  for (const q of opts) {
    let s = 0; const r = rowOf(q), c = colOf(q);
    for (let d = 0; d < 4; d++) {
      const r1 = r + DIRS[d][0], c1 = c + DIRS[d][1];
      if (r1 < 0 || r1 >= ROWS || c1 < 0 || c1 >= COLS) continue;
      const n = b[r1 * COLS + c1];
      if (n === side) {
        const r2 = r1 + DIRS[d][0], c2 = c1 + DIRS[d][1];
        if (r2 >= 0 && r2 < ROWS && c2 >= 0 && c2 < COLS && b[r2 * COLS + c2] === 0) s += 10;      // it can jump this neighbour
        s += 1;
      } else if (n === opp) s += 1;                                                              // part of a cluster
    }
    score.set(q, s - Math.abs(r - 2) * 0.1 - Math.abs(c - 2.5) * 0.1);
  }
  b[m.to] = 0; b[m.cap] = opp; b[m.from] = side;
  return opts.slice().sort((x, y) => score.get(y) - score.get(x));
}

export const legalMoves = (g, side = g.turn) => genMoves(g.board, g.hand, side);
// What the player can do with the pebble on i: steps and jumps, no bonus chosen yet (the bonus is picked after the landing).
export function legalFrom(g, i) {
  if (g.board[i] !== g.turn) return [];
  return movesFrom(g.board, i, g.turn, []);
}
export const canJump = (g, side = g.turn) => jumpsOf(g.board, side).length > 0;

// A move the player asks for from a pebble. Returns { move } or { error } with a plain-words reason.
export function tryMove(g, from, to) {
  const b = g.board;
  if (b[from] !== g.turn) return { error: 'That is not your pebble.' };
  if (from === to) return { error: 'Tap a different pit.' };
  const m = legalFrom(g, from).find((x) => x.to === to);
  if (m) return { move: m };
  if (b[to] !== 0) return { error: 'That pit is already taken.' };
  const dr = Math.abs(rowOf(to) - rowOf(from)), dc = Math.abs(colOf(to) - colOf(from));
  if (dr === 1 && dc === 1) return { error: 'No diagonal moves. Step up, down, left or right.' };
  if (dr + dc === 2) return { error: 'A pebble steps one pit, or jumps an enemy pebble that is right next to it.' };
  return { error: 'A pebble moves just one pit. Tap an empty pit with nothing selected to drop a new pebble.' };
}

// Plays the move on g (mutates). Sets winner/reason when the game ends.
export function applyMove(g, m) {
  const side = g.turn, b = g.board, opp = 3 - side;
  let bonusSq = -1, fromHand = false;
  if (m.kind === 'drop') { b[m.to] = side; g.hand[side]--; }
  else {
    b[m.from] = 0; b[m.to] = side;
    if (m.kind === 'jump') {
      b[m.cap] = 0; g.lost[opp]++;
      if (m.bonus >= 0) { b[m.bonus] = 0; g.lost[opp]++; bonusSq = m.bonus; }
      else if (m.bonus === HAND_BONUS) { g.hand[opp]--; g.lost[opp]++; fromHand = true; }
    }
  }
  const captured = m.kind === 'jump';
  g.moves++;
  g.last = { kind: m.kind, from: m.from, to: m.to, cap: captured ? m.cap : -1, bonus: bonusSq, fromHand, side };
  g.quiet = captured ? 0 : (g.quiet || 0) + 1;
  g.turn = opp;
  if (pieceCount(g, opp) === 0) { g.winner = side; g.reason = 'Every enemy pebble has been captured.'; }
  else if (genMoves(b, g.hand, opp).length === 0) { g.winner = side; g.reason = 'The other side has no legal move.'; }
  if (!g.winner) {
    const k = posKey(g); g.seen[k] = (g.seen[k] || 0) + 1;
    if (g.quiet >= QUIET_LIMIT) {
      const a = pieceCount(g, 1), c = pieceCount(g, 2);
      if (a === c) { g.winner = 3; g.reason = '40 moves each without a capture, with equal pebbles.'; }
      else { g.winner = a > c ? 1 : 2; g.reason = '40 moves each without a capture: the side with more pebbles wins.'; }
    } else if (g.seen[k] >= 3) { g.winner = 3; g.reason = 'The same position came up three times.'; }
    else if (g.moves >= MOVE_LIMIT) { g.winner = 3; g.reason = 'Move limit reached.'; }
  }
}

// Pebbles of `side` the other side could jump with its very next move (danger marks).
export function endangered(g, side) {
  const out = new Set();
  for (const m of jumpsOf(g.board, 3 - side)) out.add(m.cap);
  return out;
}

// One plain sentence describing a move for the tutor / hint.
export function describeMove(g, m) {
  const side = g.turn;
  if (m.kind === 'jump') return m.bonus === NO_BONUS ? 'This jumps and captures a pebble.' : 'This jumps a pebble and takes a bonus pebble too.';
  const c = clone(g), before = endangered(c, side);
  applyMove(c, m);
  if (c.winner === side) return 'This wins the game.';
  if (m.kind === 'step' && before.has(m.from)) return 'This steps a pebble out of danger.';
  const probe = clone(c); probe.turn = side;
  if (canJump(probe, side)) return m.kind === 'drop' ? 'This drop sets up a jump for your next move.' : 'This sets up a jump for your next move.';
  return m.kind === 'drop' ? 'A solid drop that builds your position.' : 'A solid step that improves your position.';
}
