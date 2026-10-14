// Learn: short one-move lessons. Each lesson is a small position (Ivory to move, the player is Ivory) and a goal. The player makes
// the move; if it meets the goal the lesson is done, otherwise the position resets with a hint. `goal(entry, game, res)` receives
// the log entry of the move just played, the game after it and the result of applyMove.
import {
  WHITE, PADATI, ASHVA, GAJA, RATHA, MANTRI, RAJA, ANCIENT, MODERN, parseSq, fromBoard, applyMove, legalMoves, cloneGame, sqName,
} from './rules.js';

const W = (n) => n, B = (n) => -n;
void W; void B;
// pieces: [square, signed type]
const P = (list) => list.map(([sq, t]) => [parseSq(sq), t]);

export const LESSONS = [
  {
    title: 'The Raja', era: ANCIENT, marks: ['e5'],
    text: 'Your Raja is the king: it steps one square in any direction and must never be captured. Take the lone Padati on e5 with it.',
    goalText: 'Capture on e5',
    pieces: P([['d4', RAJA], ['a2', PADATI], ['h8', -RAJA], ['h7', -PADATI], ['e5', -PADATI]]),
    goal: (e) => e.to === parseSq('e5') && Math.abs(e.piece) === RAJA,
    fail: 'The Raja steps one square: from d4 the Padati on e5 is a diagonal step away.', hint: 'Step the Raja from d4 to e5.',
  },
  {
    title: 'The Padati', era: ANCIENT, marks: ['e5'],
    text: 'A Padati (foot soldier) steps one square straight ahead but captures one square diagonally ahead. It cannot take what stands in front of it. Capture on e5.',
    goalText: 'Capture with the Padati',
    pieces: P([['d4', PADATI], ['a1', RAJA], ['h8', -RAJA], ['d5', -PADATI], ['e5', -ASHVA]]),
    goal: (e) => e.to === parseSq('e5') && Math.abs(e.piece) === PADATI,
    fail: 'The Padati captures diagonally forward, never straight ahead. Take the piece on e5.', hint: 'Capture diagonally: d4 takes e5.',
  },
  {
    title: 'Promotion', era: ANCIENT, marks: ['g8'],
    text: 'A Padati that reaches the far rank becomes a Mantri, and only a Mantri. Push your Padati on g7 to the last rank.',
    goalText: 'Promote the Padati',
    pieces: P([['g7', PADATI], ['a1', RAJA], ['a8', -RAJA], ['b7', -PADATI]]),
    goal: (e) => !!e.promo,
    fail: 'Step the Padati forward one square to the last rank.', hint: 'Step g7 to g8.',
  },
  {
    title: 'The Mantri', era: ANCIENT, marks: ['e5'],
    text: 'The Mantri is the counsellor: it steps one square diagonally, nothing more. It is the weakest of the pieces, but it is tough to catch. Take the Ratha on e5.',
    goalText: 'Capture the Ratha',
    pieces: P([['d4', MANTRI], ['a1', RAJA], ['h8', -RAJA], ['h7', -PADATI], ['e5', -RATHA]]),
    goal: (e) => e.to === parseSq('e5') && Math.abs(e.piece) === MANTRI,
    fail: 'The Mantri steps one square diagonally. The Ratha is on e5.', hint: 'Step the Mantri from d4 to e5.',
  },
  {
    title: 'The Gaja', era: ANCIENT, marks: ['e5'],
    text: 'The Gaja is the elephant: it leaps exactly two squares diagonally and may jump over anything in between. It can never reach a square of the other colour. Your Ashva stands in its way: leap over it and take on e5.',
    goalText: 'Leap and capture',
    pieces: P([['c3', GAJA], ['d4', ASHVA], ['a1', RAJA], ['h8', -RAJA], ['h7', -PADATI], ['e5', -RATHA]]),
    goal: (e) => e.to === parseSq('e5') && Math.abs(e.piece) === GAJA,
    fail: 'The Gaja leaps two squares diagonally. From c3 the Ratha on e5 is two squares away.', hint: 'Leap c3 to e5, over your own Ashva.',
  },
  {
    title: 'The Ashva', era: ANCIENT, marks: ['e6'],
    text: 'The Ashva is the horse: it moves in an L (two squares one way, one the other) and jumps over pieces. Take the Ratha on e6.',
    goalText: 'Capture with the Ashva',
    pieces: P([['d4', ASHVA], ['a1', RAJA], ['h8', -RAJA], ['h7', -PADATI], ['d5', -PADATI], ['e6', -RATHA]]),
    goal: (e) => e.to === parseSq('e6') && Math.abs(e.piece) === ASHVA,
    fail: 'The Ashva moves two squares one way and one the other. e6 is two up and one across from d4.', hint: 'Jump d4 to e6.',
  },
  {
    title: 'The Ratha', era: ANCIENT, marks: ['h1'],
    text: 'The Ratha is the chariot: it slides any distance along a rank or file, but cannot jump. The file is blocked by your own Padati, so use the rank. Take the Ashva on h1.',
    goalText: 'Slide and capture',
    pieces: P([['a1', RATHA], ['a3', PADATI], ['e2', RAJA], ['a8', -RAJA], ['h1', -ASHVA]]),
    goal: (e) => e.to === parseSq('h1') && Math.abs(e.piece) === RATHA,
    fail: 'The Ratha slides along a rank or file with nothing in the way: along the first rank to h1.', hint: 'Slide a1 to h1.',
  },
  {
    title: 'Check', era: ANCIENT, marks: ['c8'],
    text: 'When a piece attacks the enemy Raja it is check, and the other side must answer it at once. Give check with your Ratha.',
    goalText: 'Give check',
    pieces: P([['c1', RATHA], ['a1', RAJA], ['h8', -RAJA], ['a6', -PADATI]]),
    goal: (e, g, res) => !!res.chk,
    fail: 'A check is an attack on the enemy Raja. Slide the Ratha to the eighth rank, where it looks along the rank at h8.', hint: 'Slide c1 to c8.',
  },
  {
    title: 'Checkmate', era: ANCIENT, marks: ['c8'],
    text: 'Checkmate: the Raja is attacked and nothing can save it. The black Raja is hemmed in by its own Padati. Find the mate.',
    goalText: 'Checkmate in one',
    pieces: P([['c1', RATHA], ['a1', RAJA], ['h8', -RAJA], ['g7', -PADATI], ['h7', -PADATI]]),
    goal: (e, g, res) => !!res.mate,
    fail: 'Not mate yet. The black Raja has no flight squares: attack it along the eighth rank.', hint: 'Slide c1 to c8: mate.',
  },
  {
    title: 'A stalemate wins', era: ANCIENT, marks: ['f7'],
    text: 'In the ancient game, a player who has no legal move but is not in check LOSES. The black Raja has one square left to run to: take it away, without giving check. The Padati on a2 and a3 are locked together.',
    goalText: 'Stalemate the black side',
    pieces: P([['g6', RAJA], ['e6', MANTRI], ['a2', PADATI], ['h8', -RAJA], ['a3', -PADATI]]),
    goal: (e, g) => !!g.result && g.result.why === 'stalemate' && g.result.winner === WHITE,
    fail: 'Black can still move. Cover g8 with the Mantri and keep the Raja on g6 watching h7 and g7, without attacking h8.', hint: 'Mantri e6 to f7.',
  },
  {
    title: 'The bare Raja', era: ANCIENT, marks: ['c5'],
    text: 'If you capture every enemy piece except the Raja, you win at once (unless the bare Raja can take your last piece back). Take the last black piece.',
    goalText: 'Leave a bare Raja',
    pieces: P([['c1', RATHA], ['a2', PADATI], ['e1', RAJA], ['h8', -RAJA], ['c5', -ASHVA]]),
    goal: (e, g) => !!g.result && g.result.why === 'bare' && g.result.winner === WHITE,
    fail: 'Capture the black Ashva on c5: it is the last piece the black side has.', hint: 'Slide c1 to c5.',
  },
  {
    title: 'Modern: the Queen', era: MODERN, marks: ['h8'],
    text: 'In modern chess the Mantri became the Queen, the strongest piece: it slides any distance in any direction. Take the Rook on h8.',
    goalText: 'Capture with the Queen',
    pieces: P([['d4', MANTRI], ['a1', RAJA], ['a7', -RAJA], ['h8', -RATHA]]),
    goal: (e) => e.to === parseSq('h8') && Math.abs(e.piece) === MANTRI,
    fail: 'The Queen slides any distance. h8 is along the long diagonal from d4.', hint: 'Slide d4 to h8.',
  },
  {
    title: 'Modern: the Bishop', era: MODERN, marks: ['g7'],
    text: 'The Gaja became the Bishop: it slides any distance diagonally and stays on its colour. Take the Knight on g7.',
    goalText: 'Capture with the Bishop',
    pieces: P([['c3', GAJA], ['a2', PADATI], ['a1', RAJA], ['a8', -RAJA], ['g7', -ASHVA]]),
    goal: (e) => e.to === parseSq('g7') && Math.abs(e.piece) === GAJA,
    fail: 'The Bishop slides along a diagonal. g7 is on the diagonal from c3.', hint: 'Slide c3 to g7.',
  },
  {
    title: 'Modern: the Pawn', era: MODERN, marks: ['e4'],
    text: 'In modern chess a Pawn may step two squares on its first move. Advance the Pawn on e2 two squares.',
    goalText: 'Advance two squares',
    pieces: P([['e2', PADATI], ['a1', RAJA], ['h8', -RAJA]]),
    goal: (e) => e.from === parseSq('e2') && e.to === parseSq('e4'),
    fail: 'The Pawn may step two squares from its starting rank: e2 to e4.', hint: 'Advance e2 to e4.',
  },
];
export const LESSON_COUNT = LESSONS.length;

export function lessonBoard(i) {
  const L = LESSONS[i], b = new Int8Array(64);
  for (const [s, t] of L.pieces) b[s] = t;
  return fromBoard(b, WHITE, L.era);
}
// The moves that meet a lesson's goal (for Show me).
export function lessonSolutions(g, i) {
  const L = LESSONS[i], out = [];
  for (const mv of legalMoves(g)) {
    const c = cloneGame(g), res = applyMove(c, mv), e = c.log[c.log.length - 1];
    if (L.goal({ ...e, mate: res.mate }, c, res)) out.push(mv);
  }
  return out;
}
export { cloneGame };
void sqName;
