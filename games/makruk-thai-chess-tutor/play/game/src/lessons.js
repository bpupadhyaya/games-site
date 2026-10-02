// Eight short lessons. Each sets up a small position, the player (Gold) makes the move described, and the lesson checks
// the result. Lesson 8 plays on against the computer so the player can feel the count. Positions are written as
// tokens like "Pd3": upper case = Gold, lower case = Ruby; K Khun, M Met, S Khon, N Ma, R Rua, P Bia, G Bia-ngai.
import { newGame, applyMove, legalMoves, parseSq, WHITE, KHUN, MET, KHON, MA, RUA, BIA, NGAI } from './rules.js';

const LETTER = { K: KHUN, M: MET, S: KHON, N: MA, R: RUA, P: BIA, G: NGAI };
export function parseSetup(str) {
  const b = new Int8Array(64);
  for (const tok of str.split(/\s+/).filter(Boolean)) { const gold = tok[0] === tok[0].toUpperCase(); b[parseSq(tok.slice(1))] = (gold ? 1 : -1) * LETTER[tok[0].toUpperCase()]; }
  return b;
}
export const cloneGame = (g) => ({ board: g.board.slice(), turn: g.turn, hist: [], log: [], count: g.count ? { ...g.count } : null, result: null, keys: g.keys.slice() });

export const LESSONS = [
  {
    title: 'The Bia', goalText: 'Capture the Ruby Bia', setup: 'Ka1 kh8 Pd3 pe4 pd4',
    text: 'A Bia (cowrie) steps one square straight forward, but it captures one square diagonally forward. Capture the Ruby Bia with your Bia.',
    hint: 'Move your Bia from d3 to e4: diagonally forward.', fail: 'Not quite. A Bia captures diagonally forward. Try again.',
    goal: (e) => e.piece === BIA && e.cap !== 0,
  },
  {
    title: 'Promotion', goalText: 'Promote your Bia on the sixth rank', setup: 'Ka1 kh8 Pd5',
    text: 'A Bia that reaches the sixth rank becomes a Bia-ngai, a promoted Bia. The sixth rank is the dotted row. Promote your Bia.',
    hint: 'Step your Bia from d5 to d6.', fail: 'Move the Bia forward onto the dotted sixth rank.',
    goal: (e) => e.promo,
  },
  {
    title: 'The Met', goalText: 'Capture the Ma with your Met', setup: 'Ka1 kh8 Md4 ne5 pc6',
    text: 'The Met steps one square diagonally. It is slow, but it cannot be forgotten. Capture the Ruby Ma with your Met.',
    hint: 'Move your Met from d4 to e5.', fail: 'The Met moves one square diagonally. Capture the Ma.',
    goal: (e) => e.piece === MET && e.cap !== 0,
  },
  {
    title: 'The Khon', goalText: 'Capture the Bia with your Khon', setup: 'Ka1 kh8 Sd4 pd5',
    text: 'The Khon steps one square diagonally in any direction, or one square straight forward. Capture the Ruby Bia straight ahead.',
    hint: 'Move your Khon from d4 to d5.', fail: 'A Khon may step straight forward. Capture the Bia in front of it.',
    goal: (e) => e.piece === KHON && e.cap !== 0,
  },
  {
    title: 'The Ma', goalText: 'Capture the Rua with your Ma', setup: 'Ka1 kh8 Nd4 re6 pd5 pc5',
    text: 'The Ma jumps: two squares one way and one square to the side. It leaps over other pieces. Capture the Ruby Rua.',
    hint: 'Jump your Ma from d4 to e6.', fail: 'The Ma jumps two and one. Capture the Rua.',
    goal: (e) => e.piece === MA && e.cap !== 0,
  },
  {
    title: 'The Rua', goalText: 'Capture the Ma with your Rua', setup: 'Ka1 kh8 Rd1 nd7 pb4',
    text: 'The Rua slides any distance along a row or a file, but cannot jump. The way up the d-file is open. Capture the Ruby Ma.',
    hint: 'Slide your Rua from d1 up to d7.', fail: 'Slide the Rua up its file to take the Ma.',
    goal: (e) => e.piece === RUA && e.cap !== 0,
  },
  {
    title: 'Check and mate', goalText: 'Checkmate in one move', setup: 'Kg6 kh8 Ra1',
    text: 'A Khun in check must escape. If it cannot, that is checkmate and the game is won. Ruby\'s Khun is in the corner: give checkmate in one move.',
    hint: 'Slide your Rua from a1 to a8.', fail: 'That is not mate. Look for a check the Khun cannot escape.',
    goal: (e) => e.mate,
  },
  {
    title: 'The count', goalText: 'Checkmate before the count runs out', setup: 'Ke1 Ra2 Rb1 kg5', play: true,
    text: 'Ruby has only a Khun, so Pieces\' honour counting starts. With two Rua you must mate by count 8. Watch the Count strip and checkmate before it runs out.',
    hint: 'Use your Rua to cut off rows and files, then walk the Ruby Khun to the edge. Tap Think if stuck.', fail: 'The count ran out or the game ended without mate. Try again.',
    goal: (e, g) => !!g.result && g.result.winner === WHITE,
  },
];
export const lessonBoard = (i) => newGame(parseSetup(LESSONS[i].setup), WHITE);
// Every legal move that completes the lesson (used by "Show me").
export function lessonSolutions(g, i) {
  const L = LESSONS[i], out = [];
  for (const m of legalMoves(g)) {
    const c = cloneGame(g), r = applyMove(c, m);
    const e = { ...c.log[c.log.length - 1], mate: !!r.mate };
    if (L.goal(e, c)) out.push(m);
  }
  return out;
}
