// Tiger and Goat (Bagh-chal): the complete rules, pure and deterministic. See design/GDD.md.
// Board: 25 points, index = x + 5 * y. Lines join orthogonal neighbours everywhere; diagonals only
// through points where (x + y) is even. Pieces: '' empty, 'T' tiger, 'G' goat.
export const STEPS = [], JUMPS = [];        // STEPS[i] = neighbours of i; JUMPS[i] = [over, landing] pairs
for (let i = 0; i < 25; i++) {
  const x = i % 5, y = Math.floor(i / 5), dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if ((x + y) % 2 === 0) dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
  STEPS[i] = []; JUMPS[i] = [];
  for (const [dx, dy] of dirs) {
    const ok = (a, b) => a >= 0 && a < 5 && b >= 0 && b < 5;
    if (ok(x + dx, y + dy)) STEPS[i].push(x + dx + 5 * (y + dy));
    if (ok(x + 2 * dx, y + 2 * dy)) JUMPS[i].push([x + dx + 5 * (y + dy), x + 2 * dx + 5 * (y + 2 * dy)]);
  }
}

// One rule for every game (owner, 2026-09-20): there is no capture limit. Play continues until every goat is
// captured (tigers win) or no tiger can move (goats win).
export function newGame() {
  const board = Array(25).fill('');
  for (const c of [0, 4, 20, 24]) board[c] = 'T';
  return { board, inHand: 20, captured: 0, turn: 'G', winner: null, reason: '', moves: 0, seen: {} };
}

export const clone = (s) => ({ ...s, board: s.board.slice(), seen: { ...s.seen } });

export function legalMoves(s) {
  const out = [];
  if (s.winner) return out;
  if (s.turn === 'G') {
    if (s.inHand > 0) { for (let i = 0; i < 25; i++) if (!s.board[i]) out.push({ type: 'place', to: i }); }
    else for (let i = 0; i < 25; i++) if (s.board[i] === 'G') for (const n of STEPS[i]) if (!s.board[n]) out.push({ type: 'move', from: i, to: n });
  } else {
    for (let i = 0; i < 25; i++) if (s.board[i] === 'T') {
      for (const [over, to] of JUMPS[i]) if (s.board[over] === 'G' && !s.board[to]) out.push({ type: 'jump', from: i, over, to });
      for (const n of STEPS[i]) if (!s.board[n]) out.push({ type: 'move', from: i, to: n });
    }
  }
  return out;
}

export const key = (s) => s.board.map((c) => c || '.').join('') + s.turn;

// Apply a legal move (mutates s). `track` = count repetitions (off inside the computer's search).
export function applyMove(s, m, track = true) {
  if (m.type === 'place') { s.board[m.to] = 'G'; s.inHand -= 1; }
  else { s.board[m.to] = s.board[m.from]; s.board[m.from] = ''; if (m.type === 'jump') { s.board[m.over] = ''; s.captured += 1; } }
  s.turn = s.turn === 'G' ? 'T' : 'G'; s.moves += 1;
  const goatsLeft = s.inHand + s.board.filter((c) => c === 'G').length;
  if (goatsLeft === 0) { s.winner = 'T'; s.reason = 'The tigers captured every goat.'; }
  else if (legalMoves(s).length === 0) {
    if (s.turn === 'T') { s.winner = 'G'; s.reason = 'Every tiger is trapped.'; } else { s.winner = 'T'; s.reason = 'The goats have no move left.'; }
  } else if (track && s.inHand === 0) {
    const k = key(s); s.seen[k] = (s.seen[k] || 0) + 1;
    if (s.seen[k] >= 3) { s.winner = 'draw'; s.reason = 'The same position came up three times.'; }
  }
  return s;
}

// The move a player means by "this piece to that point", or a plain-language reason why it is not allowed.
export function tryMove(s, from, to) {
  const me = s.board[from], there = s.board[to];
  if (me === 'G' && s.inHand > 0) return { error: `Goats cannot move until all 20 are placed. ${s.inHand} still to place: tap an empty point.` };
  if (there === 'T') return { error: 'A tiger is standing there.' };
  if (there === 'G') {
    if (me !== 'T') return { error: 'A goat is standing there.' };
    // a tiger tapped the goat itself: explain why it cannot capture it from here
    if (!STEPS[from].includes(to)) return { error: 'To capture, first stand next to a goat. Then tap the empty point just behind it.' };
    const fx = from % 5, fy = Math.floor(from / 5), tx = to % 5, ty = Math.floor(to / 5), bx = tx + (tx - fx), by = ty + (ty - fy);
    if (bx < 0 || bx > 4 || by < 0 || by > 4) return { error: 'That goat is on the edge: there is nothing behind it for the tiger to land on, so it is safe from this side.' };
    const beyond = s.board[bx + 5 * by];
    if (beyond) return { error: beyond === 'G' ? 'That goat is protected: another goat stands right behind it, so the tiger has nowhere to land.' : 'The point behind that goat is taken by a tiger, so this tiger cannot jump.' };
    return { error: 'To capture, tap the empty point just behind the goat.' };
  }
  if (STEPS[from].includes(to)) return { move: { type: 'move', from, to } };
  const jump = JUMPS[from].find((j) => j[1] === to);
  if (jump) {
    if (me === 'G') return { error: 'Goats never jump. A goat moves one step along a line.' };
    if (s.board[jump[0]] === 'G') return { move: { type: 'jump', from, over: jump[0], to } };
    if (s.board[jump[0]] === 'T') return { error: 'A tiger cannot jump over another tiger.' };
    return { error: 'A tiger moves one step, or jumps over a goat. There is no goat to jump there.' };
  }
  const dx = Math.abs((from % 5) - (to % 5)), dy = Math.abs(Math.floor(from / 5) - Math.floor(to / 5));
  if (dx <= 1 && dy <= 1) return { error: 'No line joins those two points.' };
  if (dx <= 2 && dy <= 2 && (dx === dy || dx === 0 || dy === 0)) return { error: 'No line runs that way from this point.' };
  return { error: me === 'T' ? 'Too far. A tiger moves one step along a line, or jumps over one goat.' : 'Too far. A goat moves one step along a line.' };
}

// Goats a tiger could capture right now (shown as a warning when hints are on).
export function threatened(s) {
  const out = new Set();
  for (let i = 0; i < 25; i++) if (s.board[i] === 'T') for (const [over, to] of JUMPS[i]) if (s.board[over] === 'G' && !s.board[to]) out.add(over);
  return out;
}
