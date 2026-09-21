// Fox and Geese: the complete rules, pure and deterministic. See design/GDD.md.
// Board: the 33-point cross on a 7 x 7 grid, index = x + 7 * y, row 0 is the FAR side (the top of the screen).
// A point exists where the column is 2..4 or the row is 2..4. Lines join orthogonal neighbours only.
// Pieces: '' empty, 'F' the fox, 'G' a goose.
export const N = 7, CELLS = 49;
export const onBoard = (x, y) => x >= 0 && x < N && y >= 0 && y < N && ((x >= 2 && x <= 4) || (y >= 2 && y <= 4));
export const PTS = [];                       // the 33 real points, in index order
export const STEPS = [], JUMPS = [], GSTEPS = [];   // fox steps; fox jumps as [over, landing]; goose steps (forward = up, or sideways)
for (let i = 0; i < CELLS; i++) {
  STEPS[i] = []; JUMPS[i] = []; GSTEPS[i] = [];
  const x = i % N, y = Math.floor(i / N);
  if (!onBoard(x, y)) continue;
  PTS.push(i);
  for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
    if (onBoard(x + dx, y + dy)) STEPS[i].push(x + dx + N * (y + dy));
    if (onBoard(x + 2 * dx, y + 2 * dy) && onBoard(x + dx, y + dy)) JUMPS[i].push([x + dx + N * (y + dy), x + 2 * dx + N * (y + 2 * dy)]);
  }
  for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0]]) if (onBoard(x + dx, y + dy)) GSTEPS[i].push(x + dx + N * (y + dy));
}
export const FLOCKS = [7, 9, 11, 13, 15, 17];
// The fox wins when this many geese or fewer are left: too few to close every gap around it.
export const FOX_WINS_AT = 5;
export const CENTRE = 3 + N * 3;

// The classic start: the geese fill the bottom three rows of the cross (13) and the fox stands on the centre point.
// A smaller flock takes geese away from the back corners of the row nearest the fox; a bigger flock adds geese to
// the fox's own row, from the edges in. Fewer geese is harder for the geese.
export function newGame(flock = 13) {
  const board = Array(CELLS).fill('');
  for (let y = 5; y <= 6; y++) for (let x = 2; x <= 4; x++) board[x + N * y] = 'G';        // the two back rows of the arm: 6 geese
  const wing = [3, 2, 4, 1, 5, 0, 6].slice(0, Math.max(1, Math.min(7, flock - 6)));          // then row 4, from the middle out
  for (const x of wing) board[x + N * 4] = 'G';                                            // (13 geese fill the whole row)
  const extra = flock >= 17 ? [0, 6, 1, 5] : flock >= 15 ? [0, 6] : [];
  for (const x of extra) board[x + N * 3] = 'G';
  board[CENTRE] = 'F';
  return { board, flock, captured: 0, turn: 'G', chain: -1, winner: null, reason: '', moves: 0, seen: {} };
}
// The geese always move first.

export const clone = (s) => ({ ...s, board: s.board.slice(), seen: { ...s.seen } });
export const foxAt = (s) => s.board.indexOf('F');
export const geeseLeft = (s) => s.flock - s.captured;

function foxMoves(s, out) {
  const f = foxAt(s);
  for (const [over, to] of JUMPS[f]) if (s.board[over] === 'G' && !s.board[to]) out.push({ type: 'jump', from: f, over, to });
  if (s.chain >= 0) out.push({ type: 'stop', from: f, to: f });          // in the middle of a chain the fox may stop
  else for (const n of STEPS[f]) if (!s.board[n]) out.push({ type: 'move', from: f, to: n });
}
export function legalMoves(s) {
  const out = [];
  if (s.winner) return out;
  if (s.turn === 'G') {
    for (const i of PTS) if (s.board[i] === 'G') for (const n of GSTEPS[i]) if (!s.board[n]) out.push({ type: 'move', from: i, to: n });
  } else foxMoves(s, out);
  return out;
}

export const key = (s) => s.board.map((c) => c || '.').join('') + s.turn + s.chain;

// Apply a legal move (mutates s). `track` = count repetitions (off inside the computer's search).
export function applyMove(s, m, track = true) {
  if (m.type === 'stop') { s.turn = 'G'; s.chain = -1; }
  else if (m.type === 'move' && s.turn === 'G') { s.board[m.to] = 'G'; s.board[m.from] = ''; s.turn = 'F'; s.chain = -1; }
  else if (m.type === 'move') { s.board[m.to] = 'F'; s.board[m.from] = ''; s.turn = 'G'; s.chain = -1; }
  else {                                                     // a jump: the goose is captured; the fox may go on jumping
    s.board[m.to] = 'F'; s.board[m.from] = ''; s.board[m.over] = ''; s.captured += 1;
    if (JUMPS[m.to].some(([o, l]) => s.board[o] === 'G' && !s.board[l])) s.chain = m.to; else { s.chain = -1; s.turn = 'G'; }
  }
  s.moves += 1;
  if (geeseLeft(s) <= FOX_WINS_AT) { s.winner = 'F'; s.reason = 'Too few geese are left to trap the fox.'; }
  else if (legalMoves(s).length === 0) {
    if (s.turn === 'F') { s.winner = 'G'; s.reason = 'The fox is trapped.'; } else { s.winner = 'F'; s.reason = 'The geese have no move left.'; }
  } else if (track && s.chain < 0) {
    const k = key(s); s.seen[k] = (s.seen[k] || 0) + 1;
    if (s.seen[k] >= 3) { s.winner = 'draw'; s.reason = 'The same position came up three times.'; }
  }
  return s;
}

// The move a player means by "this piece to that point", or a plain-language reason why it is not allowed.
export function tryMove(s, from, to) {
  const me = s.board[from], there = s.board[to];
  const fx = from % N, fy = Math.floor(from / N), tx = to % N, ty = Math.floor(to / N), dx = tx - fx, dy = ty - fy;
  if (there === 'F') return { error: 'The fox is standing there.' };
  if (me === 'F') {
    if (there === 'G') {
      // the fox tapped the goose itself: explain why it cannot capture it from here
      if ((dx === 0 || dy === 0) && Math.abs(dx + dy) === 2 && s.board[from + (dx + N * dy) / 2] === 'G') return { error: 'The fox can only land on an empty point. Another goose stands behind that goose, so it is protected.' };
      if (Math.abs(dx) + Math.abs(dy) !== 1) return { error: 'To capture, first stand right next to a goose. Then tap the empty point just behind it.' };
      const bx = tx + dx, by = ty + dy;
      if (!onBoard(bx, by)) return { error: 'That goose is on the edge: there is no point behind it for the fox to land on, so it is safe from this side.' };
      if (s.board[bx + N * by]) return { error: 'That goose is protected: another goose stands right behind it, so the fox has nowhere to land.' };
      return { error: 'To capture, tap the empty point just behind the goose.' };
    }
    if (s.chain >= 0 && !JUMPS[from].some((j) => j[1] === to)) return { error: 'The fox is in the middle of a chain. Jump again, or tap Stop here to end its turn.' };
    if (STEPS[from].includes(to)) return { move: { type: 'move', from, to } };
    const jump = JUMPS[from].find((j) => j[1] === to);
    if (jump) {
      if (s.board[jump[0]] === 'G') return { move: { type: 'jump', from, over: jump[0], to } };
      return { error: 'A fox steps one point, or jumps over a goose. There is no goose to jump there.' };
    }
    if (Math.abs(dx) === 1 && Math.abs(dy) === 1) return { error: 'Foxes never move diagonally. Follow the lines: up, down, left or right.' };
    if (dx === 0 || dy === 0) return { error: 'Too far. A fox moves one step, or jumps over one goose.' };
    return { error: 'No line runs that way. Follow the lines: up, down, left or right.' };
  }
  // a goose
  if (there === 'G') return { error: 'Another goose is standing there.' };
  if (dx === 0 && dy === 1) return { error: 'Geese never move backward. A goose goes forward (up the board) or sideways.' };
  if (Math.abs(dx) + Math.abs(dy) === 1) return { move: { type: 'move', from, to } };
  if (Math.abs(dx) === 1 && Math.abs(dy) === 1) return { error: 'Geese never move diagonally. Follow the lines: forward or sideways.' };
  if ((dx === 0 || dy === 0) && Math.abs(dx + dy) === 2) return { error: 'Geese never jump. A goose moves one step.' };
  return { error: 'Too far. A goose moves one step, forward or sideways.' };
}

// Geese the fox could capture right now (shown as a warning when hints are on).
export function threatened(s) {
  const out = new Set(), f = foxAt(s);
  if (f < 0) return out;
  for (const [over, to] of JUMPS[f]) if (s.board[over] === 'G' && !s.board[to]) out.add(over);
  return out;
}
// The row in which a piece stands, counted from the goose side (used only for the flock display).
export const rowOf = (i) => Math.floor(i / N);
