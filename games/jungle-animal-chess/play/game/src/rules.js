// Jungle (Dou Shou Qi) rules: the single source of truth for what is legal and what a move does. Pure and deterministic.
// Board: 7 columns by 9 rows, square i = row * 7 + col, row 0 at the TOP. Side 1 = Red (bottom, moves first), side 2 = Blue (top).
// A piece is a number: 1..8 for Red (rank 1 rat .. 8 elephant), 9..16 for Blue (rank = value - 8). 0 is an empty square.
// winner: 0 playing, 1 or 2, or 3 = draw.
export const COLS = 7, ROWS = 9, SZ = 63;
export const NAMES = ['', 'Red', 'Blue'];
export const ANIMALS = ['', 'Rat', 'Cat', 'Dog', 'Wolf', 'Leopard', 'Tiger', 'Lion', 'Elephant'];
export const QUIET_LIMIT = 100;       // plies (50 moves each) with no capture before the game is settled on material
export const MOVE_LIMIT = 400;        // plies before the game is called a draw
export const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// Terrain
export const LAND = 0, WATER = 1, TRAP1 = 2, TRAP2 = 3, DEN1 = 4, DEN2 = 5;   // TRAP1/DEN1 belong to Red (bottom), TRAP2/DEN2 to Blue (top)
export const TERR = new Array(SZ).fill(LAND);
for (let r = 3; r <= 5; r++) for (const c of [1, 2, 4, 5]) TERR[r * COLS + c] = WATER;
TERR[8 * COLS + 3] = DEN1; for (const i of [8 * COLS + 2, 8 * COLS + 4, 7 * COLS + 3]) TERR[i] = TRAP1;
TERR[3] = DEN2; for (const i of [2, 4, COLS + 3]) TERR[i] = TRAP2;
export const DEN_OF = [0, 8 * COLS + 3, 3];           // the den square of each side

export const rowOf = (i) => (i / COLS) | 0;
export const colOf = (i) => i % COLS;
export const sideOf = (v) => (v > 8 ? 2 : v > 0 ? 1 : 0);
export const rankOf = (v) => (v ? ((v - 1) & 7) + 1 : 0);
export const pieceOf = (side, rank) => (side === 1 ? rank : rank + 8);

// Neighbour table: NB[i * 4 + d] = square next to i in direction d, or -1 off the board.
export const NB = new Int8Array(SZ * 4);
for (let i = 0; i < SZ; i++) for (let d = 0; d < 4; d++) {
  const r = rowOf(i) + DIRS[d][0], c = colOf(i) + DIRS[d][1];
  NB[i * 4 + d] = r < 0 || r >= ROWS || c < 0 || c >= COLS ? -1 : r * COLS + c;
}

// Start position. Red at the bottom, Blue is the same set turned half way round.
export function startBoard() {
  const b = new Array(SZ).fill(0);
  // [row, col, rank] for Red; Blue mirrors through the centre (row -> 8 - row, col -> 6 - col)
  const red = [[8, 0, 6], [8, 6, 7], [7, 1, 2], [7, 5, 3], [6, 0, 8], [6, 2, 4], [6, 4, 5], [6, 6, 1]];
  for (const [r, c, k] of red) { b[r * COLS + c] = pieceOf(1, k); b[(8 - r) * COLS + (6 - c)] = pieceOf(2, k); }
  return b;
}

export function newGame() {
  const g = { board: startBoard(), turn: 1, moves: 0, lost: [0, 0, 0], gone: [], winner: 0, reason: '', seen: {}, last: null, quiet: 0 };
  g.seen[posKey(g)] = 1;
  return g;
}
export const clone = (g) => ({ ...g, board: g.board.slice(), lost: g.lost.slice(), gone: (g.gone || []).slice(), seen: { ...g.seen }, last: g.last ? { ...g.last } : null });
export const posKey = (g) => String.fromCharCode(...g.board.map((v) => v + 48)) + g.turn;
export const pieceCount = (g, side) => { let n = 0; for (let i = 0; i < SZ; i++) if (sideOf(g.board[i]) === side) n++; return n; };
export const materialOf = (b, side) => { let s = 0; for (let i = 0; i < SZ; i++) if (sideOf(b[i]) === side) s += rankOf(b[i]); return s; };

// Rank a piece fights with on square i: zero while it stands in a trap that belongs to the other side.
export function effRank(v, i) {
  const t = TERR[i], s = sideOf(v);
  if ((s === 1 && t === TRAP2) || (s === 2 && t === TRAP1)) return 0;
  return rankOf(v);
}

// May the piece `v` standing on `from` capture the piece `w` standing on `to`? (Sides are checked by the caller.)
export function canCapture(v, from, w, to) {
  const aw = TERR[from] === WATER, dw = TERR[to] === WATER;
  if (aw !== dw) return false;                                  // nothing fights across the shore: land animals cannot touch a swimming rat, a swimming rat cannot touch land
  const ra = effRank(v, from), rd = effRank(w, to);
  if (rd === 0) return true;                                    // a trapped animal can be eaten by anything
  if (ra === 1 && rd === 8) return true;                        // the rat eats the elephant
  if (ra === 8 && rd === 1) return false;                       // but the elephant cannot eat the rat
  return ra >= rd;
}

// Legal moves for `side` on board b (any array of 63). Each move is the number from | to << 6 | jump << 12. Pushes into `out`.
export function genMoves(b, side, out = []) {
  const ownDen = DEN_OF[side];
  for (let i = 0; i < SZ; i++) {
    const v = b[i]; if (!v || sideOf(v) !== side) continue;
    const rank = rankOf(v);
    for (let d = 0; d < 4; d++) {
      const t = NB[i * 4 + d]; if (t < 0) continue;
      if (TERR[t] === WATER) {
        if (rank === 1) {                                        // the rat swims
          const w = b[t];
          if (!w || (sideOf(w) !== side && canCapture(v, i, w, t))) out.push(i | (t << 6));
        } else if (rank >= 6) {                                  // tiger and lion leap the lake in a straight line
          let j = t, blocked = false;
          while (j >= 0 && TERR[j] === WATER) { if (b[j]) { blocked = true; break; } j = NB[j * 4 + d]; }
          if (!blocked && j >= 0) {
            const w = b[j];
            if (!w || (sideOf(w) !== side && canCapture(v, i, w, j))) out.push(i | (j << 6) | (1 << 12));
          }
        }
        continue;
      }
      if (t === ownDen) continue;
      const w = b[t];
      if (w) { if (sideOf(w) === side || !canCapture(v, i, w, t)) continue; }
      out.push(i | (t << 6));
    }
  }
  return out;
}
export const mFrom = (m) => m & 63;
export const mTo = (m) => (m >> 6) & 63;
export const mJump = (m) => (m >> 12) & 1;

export function legalMoves(g) { return genMoves(g.board, g.turn).map((m) => ({ from: mFrom(m), to: mTo(m), jump: !!mJump(m) })); }
export function legalFrom(g, i) {
  if (sideOf(g.board[i]) !== g.turn) return [];
  return genMoves(g.board, g.turn).filter((m) => mFrom(m) === i).map((m) => ({ to: mTo(m), jump: !!mJump(m), cap: g.board[mTo(m)] !== 0 }));
}

// Apply a move (from, to) for the side to move. Mutates g, decides winner, returns { captured: piece or 0, jump }.
export function applyMove(g, move) {
  const b = g.board, side = g.turn, opp = 3 - side, v = b[move.from], w = b[move.to];
  const jump = !!move.jump || (Math.abs(rowOf(move.to) - rowOf(move.from)) + Math.abs(colOf(move.to) - colOf(move.from)) > 1);
  b[move.to] = v; b[move.from] = 0;
  if (w) { g.lost[opp] += 1; (g.gone = g.gone || []).push(w); }
  g.last = { from: move.from, to: move.to, cap: w, jump };
  g.moves += 1; g.quiet = w ? 0 : g.quiet + 1;
  g.turn = opp;
  if (move.to === DEN_OF[opp]) { g.winner = side; g.reason = `${ANIMALS[rankOf(v)]} entered the ${NAMES[opp]} den.`; }
  else if (!pieceCount(g, opp)) { g.winner = side; g.reason = `${NAMES[opp]} has no animals left.`; }
  else if (!genMoves(b, opp).length) { g.winner = side; g.reason = `${NAMES[opp]} cannot move.`; }
  else {
    const k = posKey(g); g.seen[k] = (g.seen[k] || 0) + 1;
    if (g.seen[k] >= 3) { g.winner = 3; g.reason = 'The same position came up three times.'; }
    else if (g.moves >= MOVE_LIMIT) { g.winner = 3; g.reason = 'Too many moves: a draw.'; }
    else if (g.quiet >= QUIET_LIMIT) {
      const a = materialOf(b, 1), c = materialOf(b, 2);
      g.winner = a === c ? 3 : a > c ? 1 : 2;
      g.reason = a === c ? 'Fifty moves each with no capture, and equal strength: a draw.' : `Fifty moves each with no capture: ${NAMES[g.winner]} has the stronger animals left.`;
    }
  }
  return { captured: w, jump };
}

// Why can't the piece on `from` go to `to`? Plain-English answer for the tutor line; or { ok: true, move }.
export function tryMove(g, from, to) {
  const b = g.board, v = b[from], w = b[to];
  if (!v || sideOf(v) !== g.turn) return { error: 'That is not your animal.' };
  const m = legalFrom(g, from).find((q) => q.to === to);
  if (m) return { ok: true, move: { from, to, jump: m.jump } };
  const name = ANIMALS[rankOf(v)], rank = rankOf(v);
  const dr = Math.abs(rowOf(to) - rowOf(from)), dc = Math.abs(colOf(to) - colOf(from));
  if (w && sideOf(w) === sideOf(v)) return { error: 'That square holds your own animal.' };
  if (to === DEN_OF[sideOf(v)]) return { error: 'You cannot step into your own den.' };
  if (TERR[to] === WATER && !w && !(dr + dc === 1)) return { error: 'Only the lion and the tiger can leap, and only straight over a lake.' };
  if (TERR[to] === WATER) return { error: `The ${name.toLowerCase()} cannot swim. Only the rat can enter the water.` };
  if (dr + dc !== 1) {
    if (rank >= 6 && (dr === 0 || dc === 0)) return { error: `The ${name.toLowerCase()} can only leap straight over a lake, and the leap is blocked if a rat is in the water.` };
    return { error: 'Animals move one square: up, down, left or right.' };
  }
  if (w) {
    const wn = ANIMALS[rankOf(w)].toLowerCase();
    if (TERR[from] === WATER) return { error: 'A swimming rat cannot attack an animal on land.' };
    if (rankOf(w) === 1 && rank === 8) return { error: 'The elephant is afraid of the rat and cannot eat it.' };
    return { error: `The ${name.toLowerCase()} is not strong enough to eat the ${wn}.` };
  }
  return { error: 'That move is not allowed.' };
}

// The animals of `side` that the other side could eat on its next move.
export function endangered(g, side) {
  const out = new Set(); const opp = 3 - side;
  for (const m of genMoves(g.board, opp)) { const t = mTo(m); if (sideOf(g.board[t]) === side) out.add(t); }
  return out;
}

export function describeMove(g, m) {
  const b = g.board, v = b[m.from], w = b[m.to], name = ANIMALS[rankOf(v)], side = sideOf(v);
  if (m.to === DEN_OF[3 - side]) return `The ${name.toLowerCase()} steps into the den and wins.`;
  const jump = Math.abs(rowOf(m.to) - rowOf(m.from)) + Math.abs(colOf(m.to) - colOf(m.from)) > 1;
  if (w) {
    const wn = ANIMALS[rankOf(w)].toLowerCase();
    if (rankOf(v) === 1 && rankOf(w) === 8) return `The rat eats the elephant.`;
    return `The ${name.toLowerCase()} ${jump ? 'leaps the lake and ' : ''}eats the ${wn}.`;
  }
  if (jump) return `The ${name.toLowerCase()} leaps over the lake.`;
  if (TERR[m.to] === WATER) return 'The rat swims into the lake.';
  if (TERR[m.to] === (side === 1 ? TRAP2 : TRAP1)) return `The ${name.toLowerCase()} walks into a trap, where it is weak. Careful.`;
  if (rowOf(m.to) === rowOf(m.from)) return `The ${name.toLowerCase()} steps sideways.`;
  const adv = side === 1 ? rowOf(m.to) < rowOf(m.from) : rowOf(m.to) > rowOf(m.from);
  return `The ${name.toLowerCase()} steps ${adv ? 'forward' : 'back'}.`;
}
