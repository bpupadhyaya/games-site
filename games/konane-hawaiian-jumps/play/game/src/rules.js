// Konane: THE RULE BOOK (authoritative; engine.js must generate exactly the same moves).
// Board: n x n, index = x + n*y, row 0 is the top. Stones: 0 empty, 1 black, 2 white. Black stones stand on squares where
// (x + y) is even, white on odd, so a stone always lands on a square of its own colour.
// Opening (as traditionally described): Black removes one of its own stones from the centre or from a corner; White then
// removes a white stone next to that empty square. Black moves next. Every later move is a jump over an adjacent enemy stone
// into the empty square straight behind it; the jump may continue in the SAME direction over further enemy stones. The
// player who cannot jump loses (no draws, no passing).
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const NAMES = { 1: 'Black', 2: 'White' };

export function newGame(n = 6) {
  const b = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) b.push((x + y) % 2 === 0 ? 1 : 2);
  return { n, b, turn: 1, ply: 0, hole: -1, winner: 0, reason: '', moves: 0 };
}
export const clone = (s) => ({ ...s, b: s.b.slice() });

// Black's opening choices: the two black centre stones and the two black corners.
export function openingSquares(n) {
  const c = n / 2, out = [];
  for (const [x, y] of [[c - 1, c - 1], [c, c], [0, 0], [n - 1, n - 1]]) out.push(x + n * y);
  return out;
}
// Jumps for `color` from stone at i: [{from,to}] one per landing square (1 jump, 2 jumps...). Same direction only.
export function jumpsFrom(s, i, color = s.b[i]) {
  const { n, b } = s, out = [], x0 = i % n, y0 = (i - x0) / n, enemy = 3 - color;
  for (const [dx, dy] of DIRS) {
    let x = x0, y = y0;
    for (;;) {
      const ox = x + dx, oy = y + dy, lx = x + 2 * dx, ly = y + 2 * dy;
      if (lx < 0 || ly < 0 || lx >= n || ly >= n) break;
      if (b[ox + n * oy] !== enemy || b[lx + n * ly] !== 0) break;
      out.push({ type: 'jump', from: i, to: lx + n * ly }); x = lx; y = ly;
    }
  }
  return out;
}
export function legalMoves(s) {
  if (s.winner) return [];
  if (s.ply === 0) return openingSquares(s.n).map((at) => ({ type: 'remove', at }));
  if (s.ply === 1) {
    const { n } = s, hx = s.hole % n, hy = (s.hole - hx) / n, out = [];
    for (const [dx, dy] of DIRS) { const x = hx + dx, y = hy + dy; if (x >= 0 && y >= 0 && x < n && y < n && s.b[x + n * y] === 2) out.push({ type: 'remove', at: x + n * y }); }
    return out;
  }
  const out = [];
  for (let i = 0; i < s.b.length; i++) if (s.b[i] === s.turn) for (const m of jumpsFrom(s, i)) out.push(m);
  return out;
}
export const countMoves = (s, color) => { let c = 0; for (let i = 0; i < s.b.length; i++) if (s.b[i] === color) c += jumpsFrom(s, i, color).length; return c; };
// The squares jumped over by a jump from -> to (all enemy stones).
export function overSquares(n, from, to) {
  const fx = from % n, fy = (from - fx) / n, tx = to % n, ty = (to - tx) / n, dx = Math.sign(tx - fx), dy = Math.sign(ty - fy), out = [];
  for (let x = fx + dx, y = fy + dy; x !== tx + dx || y !== ty + dy; x += 2 * dx, y += 2 * dy) out.push(x + n * y);
  return out;
}
export function applyMove(s, m) {
  if (m.type === 'remove') { s.b[m.at] = 0; if (s.ply === 0) s.hole = m.at; }
  else { for (const o of overSquares(s.n, m.from, m.to)) s.b[o] = 0; s.b[m.to] = s.b[m.from]; s.b[m.from] = 0; }
  s.ply += 1; s.moves += 1; s.turn = 3 - s.turn;
  if (s.ply >= 2 && legalMoves(s).length === 0) { s.winner = 3 - s.turn; s.reason = `${NAMES[s.turn]} has no jump left.`; }
  return s;
}
export const stones = (s, color) => s.b.reduce((a, v) => a + (v === color ? 1 : 0), 0);
// Any tap on stone `from` followed by a tap on square `to`: the legal move, or a plain-language reason.
export function tryMove(s, from, to) {
  const { n, b } = s;
  if (b[from] !== s.turn) return { error: 'That is not your stone.' };
  for (const m of jumpsFrom(s, from)) if (m.to === to) return { move: m };
  if (to === from) return { error: 'Tap a glowing square to jump there.' };
  if (b[to] !== 0) return { error: b[to] === b[from] ? 'You cannot land on a stone. A jump must end on an empty square.' : 'You jump OVER an enemy stone, you do not land on it. Land on the empty square beyond.' };
  const fx = from % n, fy = (from - fx) / n, tx = to % n, ty = (to - tx) / n, dx = tx - fx, dy = ty - fy;
  if (dx !== 0 && dy !== 0) return { error: 'Jumps go in a straight line, never sideways or diagonally, and never around a corner.' };
  const steps = Math.abs(dx + dy);
  if (steps % 2 === 1) return { error: 'A jump moves two squares for each stone it hops over. That square is not a landing square.' };
  const ux = Math.sign(dx), uy = Math.sign(dy);
  for (let k = 1; k <= steps; k++) {
    const v = b[fx + ux * k + n * (fy + uy * k)];
    if (k % 2 === 1 && v !== 3 - s.turn) return { error: v === s.turn ? 'You can only jump over enemy stones, never your own.' : 'There is no enemy stone to jump over on the way there.' };
    if (k % 2 === 0 && v !== 0) return { error: 'The square just beyond the stone you jump must be empty.' };
  }
  return { error: 'That jump is not possible.' };
}
export const key = (s) => s.b.join('') + s.turn + s.ply;
