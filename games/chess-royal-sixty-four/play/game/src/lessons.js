// The tutorial: 12 hands-on lessons. Each step loads a real position and asks for a real move; the
// player taps or drags it in exactly the way they would in a real game. Wrong or illegal attempts
// get the engine's own plain-language reason (rules.js `tryMove`); a `want.refuse` step deliberately
// asks the player to try an illegal move, to feel why it is refused.
//
// Positions are built from explicit piece placements (e.g. 'Ke1', 'pd3') rather than hand-typed FEN
// rows, which are easy to miscount by one rank; every position is also checked by
// test/lessons.verify.mjs-style assertions in test/game.test.js.
import {
  sqFromName, sqName, applyMove, tryMove, legalTargets, legalMovesRaw, fromState,
  KING, QUEEN, ROOK, BISHOP, KNIGHT, PAWN, WHITE, BLACK, WK, WQ, BK, BQ,
} from './rules.js';
import { chooseMove } from './engine.js';

const sq = (name) => sqFromName(name);
const to = (names) => names.map(sq);
const LETTER = { K: KING, Q: QUEEN, R: ROOK, B: BISHOP, N: KNIGHT, P: PAWN };

// pieces: array of tokens like 'Ke1' (White King e1) / 'pd3' (black pawn d3). turn: 'w' | 'b'.
function place(pieces, turn, opts = {}) {
  const board = new Array(64).fill(0);
  for (const tok of pieces) {
    const letter = tok[0], white = letter >= 'A' && letter <= 'Z';
    const type = LETTER[letter.toUpperCase()];
    board[sq(tok.slice(1))] = white ? type : -type;
  }
  const wk = board.indexOf(KING), bk = board.indexOf(-KING);
  let castle = 0;
  if (opts.castle) for (const c of opts.castle) castle |= c === 'K' ? WK : c === 'Q' ? WQ : c === 'k' ? BK : c === 'q' ? BQ : 0;
  const ep = opts.ep ? sq(opts.ep) : -1;
  return { board, turn: turn === 'b' ? BLACK : WHITE, castle, ep, halfmove: 0, fullmove: 1, wk, bk };
}

export const LESSONS = [
  { title: 'The Pawn', steps: [
    { pos: () => place(['Ka1', 'ka8', 'Pe2'], 'w'), text: 'Pawns move straight ahead. TAP the pawn, then TAP the square in front of it.', want: { from: sq('e2'), to: to(['e3']) }, hint: 'e2 to e3.' },
    { pos: () => place(['Ka1', 'ka8', 'Pe2'], 'w'), text: 'From its very first move, a pawn may advance two squares instead of one. Try it.', want: { from: sq('e2'), to: to(['e4']) }, hint: 'e2 to e4.' },
    { pos: () => place(['Ka1', 'ka8', 'Pe2', 'pd3'], 'w'), text: 'A pawn never captures straight ahead - only diagonally. Capture the black pawn.', want: { from: sq('e2'), to: to(['d3']) }, hint: 'e2 takes on d3.' },
  ] },
  { title: 'Minor Pieces: Knight & Bishop', steps: [
    { pos: () => place(['Kh1', 'kh8', 'Nb1'], 'w'), text: 'The knight jumps in an L: two squares one way, one square across - and it can leap over anything. TAP it, then TAP c3.', want: { from: sq('b1'), to: to(['c3']) }, hint: 'b1 to c3.' },
    { pos: () => place(['Kh1', 'kh8', 'Bc1'], 'w'), text: 'The bishop glides any distance along one diagonal. TAP it, then TAP a square far along its diagonal.', want: { from: sq('c1'), to: to(['b2', 'a3', 'd2', 'e3', 'f4', 'g5', 'h6']) }, hint: 'c1 to g5, or any square on that diagonal.' },
  ] },
  { title: 'Major Pieces: Rook & Queen', steps: [
    { pos: () => place(['Kh1', 'kh8', 'Ra1'], 'w'), text: 'The rook glides any distance along a rank or a file. Move it far up its file.', want: { from: sq('a1'), to: to(['a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1']) }, hint: 'a1 to a8, or anywhere along the a-file or the first rank.' },
    { pos: () => place(['Kh1', 'kh8', 'Qa1'], 'w'), text: 'The queen is a rook and a bishop combined: any distance, in any straight line. Move it anywhere legal.', want: { from: sq('a1'), any: true }, hint: 'Try a1 to a8, h8, or anywhere on a rank, file or diagonal.' },
  ] },
  { title: 'The King', steps: [
    { pos: () => place(['Ke1', 'kh8'], 'w'), text: 'The king moves just one square, in any direction. Move it.', want: { from: sq('e1'), any: true }, hint: 'Any one of d1, d2, e2, f1, f2.' },
    { pos: () => place(['Ke1', 'kh8', 'rd8'], 'w'), text: 'A rook on d8 controls the whole d-file. Try moving the king to d1 - watch what happens.', want: { refuse: sq('e1'), refuseTo: sq('d1') }, hint: 'TAP the king, then TAP d1.' },
  ] },
  { title: 'Check', steps: [
    { pos: () => place(['Ke1', 'kh8', 're8'], 'w'), text: 'White is in check from the rook on e8. You must answer every check: capture the attacker, block its line, or move the king to safety. Make the only kind of move that is legal right now.', want: { any: true }, hint: 'The king must step off the e-file, e.g. to d1, d2, f1 or f2.' },
  ] },
  { title: 'Checkmate', steps: [
    { pos: () => place(['Kg6', 'kh8', 'Qa7'], 'w'), text: 'The white king already guards g7. Deliver checkmate with the queen.', want: { from: sq('a7'), to: to(['g7']), mate: true }, hint: 'Qa7 to g7 is checkmate: the king on h8 has nowhere to go and cannot capture a defended queen.' },
  ] },
  { title: 'Stalemate', steps: [
    { pos: () => place(['Ka6', 'ka8', 'Qb1'], 'w'), text: 'White is completely winning - but one natural-looking move here throws the win away entirely. Play the queen to b6 and see why.', want: { from: sq('b1'), to: to(['b6']) }, hint: 'Qb1 to b6: the black king on a8 now has no legal move anywhere, but it is also not in check. That is stalemate: an immediate draw, however much material White has. Always double check the king has a legal move (or is checkmated) before you play what looks like the final blow.' },
  ] },
  { title: 'Castling', steps: [
    { pos: () => place(['Ke1', 'Rh1', 'ke8'], 'w', { castle: 'K' }), text: 'Castling kingside: TAP the king, then TAP two squares toward the rook. The rook jumps to the other side automatically.', want: { from: sq('e1'), to: to(['g1']) }, hint: 'TAP e1, then TAP g1.' },
    { pos: () => place(['Ke1', 'Ra1', 'ke8'], 'w', { castle: 'Q' }), text: 'Castling queenside works the same way, toward the other rook.', want: { from: sq('e1'), to: to(['c1']) }, hint: 'TAP e1, then TAP c1.' },
  ] },
  { title: 'En Passant', steps: [
    { pos: () => place(['Ke1', 'ke8', 'Pe5', 'pd5'], 'w', { ep: 'd6' }), text: 'Black\'s pawn just advanced two squares from d7 to d5, landing beside your pawn. For one move only, you may capture it as if it had moved just one square: TAP your pawn, then TAP d6.', want: { from: sq('e5'), to: to(['d6']) }, hint: 'e5 takes on d6, en passant.' },
  ] },
  { title: 'Promotion', steps: [
    { pos: () => place(['Ka1', 'kh8', 'Pg7'], 'w'), text: 'A pawn reaching the far rank must become a queen, rook, bishop or knight - never a pawn. TAP it, then TAP g8, and choose a piece in the picker.', want: { from: sq('g7'), to: to(['g8']) }, hint: 'g7 to g8, then choose Queen.' },
  ] },
  { title: 'Tactics: Fork, Pin, Skewer', steps: [
    { pos: () => place(['Ke1', 'ke8', 'ra8', 'Nd5'], 'w'), text: 'FORK: one move by this knight attacks the king AND the rook at once. Find it.', want: { from: sq('d5'), to: to(['c7']), check: true }, hint: 'Nd5 to c7: check, and the rook on a8 falls next move.' },
    { pos: () => place(['Ka1', 'ke8', 'ne5', 'Rh1'], 'w'), text: 'PIN: move your rook onto the e-file. The knight will no longer be able to move at all - it is pinned to its own king.', want: { from: sq('h1'), to: to(['e1']) }, hint: 'Rh1 to e1 pins the knight on e5 to the king on e8.' },
    { pos: () => place(['Ka1', 'ke4', 'qe8', 'Rh1'], 'w'), text: 'SKEWER: move your rook to attack the king first. When it must step aside, the queen behind it falls next.', want: { from: sq('h1'), to: to(['e1']), check: true }, hint: 'Rh1 to e1 is check; after the king moves, Rxe8 wins the queen.' },
  ] },
  { title: 'Play a Full Game', steps: [
    { pos: () => place(['Ka1', 'Qd4', 'Rf1', 'ke8'], 'w'), minigame: true, text: 'Now play a complete short game to the end. You have a huge material lead - find checkmate.', hint: 'Bring the queen and rook together; keep the king boxed against the edge.' },
  ] },
];

export function loadStep(step) { return fromState(step.pos()); }
export { sq, sqName };

// The "notice this" matcher shared by lesson play and by the target-highlighter.
export function wantMatches(g, want, from, to_) {
  if (!want) return false;
  if (want.refuse) return false; // handled separately (an illegal attempt), never a legal match
  if (want.from !== undefined && from !== want.from) return false;
  if (want.to) return want.to.includes(to_);
  const trial = { st: { ...g.st, board: g.st.board.slice() }, log: [], keyCounts: new Map(g.keyCounts), result: null };
  const r = tryMove(trial, from, to_, 5);
  if (!r.ok) return false;
  const after = applyMove(trial, r.move);
  if (want.mate) return !!trial.result && trial.result.why === 'checkmate';
  if (want.check) return after.chk;
  if (want.any) return true;
  return false;
}
export function lessonTargets(g, step, from) {
  const want = step.want;
  if (!want || want.refuse) return [];
  if (want.from !== undefined && from !== want.from) return [];
  const all = legalTargets(g.st, from).map((t) => t.to);
  if (want.to) return [...new Set(all.filter((t) => want.to.includes(t)))];
  if (want.any) return [...new Set(all)];
  return [...new Set(all.filter((t) => wantMatches(g, want, from, t)))];
}
// Drive the opponent's reply in the mini-game lesson with the real engine (deterministic given rng).
export function miniGameReply(g, rng) { return chooseMove(g, 1, rng); }
