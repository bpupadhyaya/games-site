// The hands-on lessons, as data. Each lesson has steps; each step sets up a small position (Red at the bottom,
// always to move) and waits for the player's move.
//   pieces: [ 'rk4,9', ... ]  side r/b + type (k general, a advisor, e elephant, h horse, r chariot, c cannon, p soldier) + x,y
//   rows:   ten strings of nine characters instead of pieces (upper case = Red, lower case = Black)
//   want:   { from:[x,y], to:[[x,y]...] }  a legal move of that piece to one of these points
//           { from:[x,y], any:true }        any legal move of that piece
//           { refuse:[x,y] }                the player must TRY an illegal move with the piece on [x,y]; the reason is shown
//           { check:true } / { mate:true } / { escape:true }   any move that gives check / checkmates / gets out of check
//   sol:    [[x,y],[x,y]] one accepted answer (the tests play it through real taps)
//   hint:   shown when the player asks for a hint
import { boardFromText, sqOf, RED } from './rules.js';

const T = { k: 1, a: 2, e: 3, h: 4, r: 5, c: 6, p: 7 };
export function stepBoard(step) {
  if (step.rows) return boardFromText(step.rows);
  const b = new Array(90).fill(0);
  for (const s of step.pieces) { const m = /^([rb])([kaehrcp])(\d),(\d)$/.exec(s); b[sqOf(+m[3], +m[4])] = (m[1] === 'r' ? 1 : -1) * T[m[2]]; }
  return b;
}
export const sq = (p) => sqOf(p[0], p[1]);
const KINGS = ['bk3,0'];

export const LESSONS = [
  { title: 'The general', steps: [
    { text: 'Your general (帥) is the piece you must never lose. TAP it, then TAP a glowing point (or DRAG it there). It takes one step straight.',
      pieces: ['rk4,8', ...KINGS], want: { from: [4, 8], to: [[4, 7], [3, 8], [5, 8], [4, 9]] }, sol: [[4, 8], [4, 7]], hint: 'Tap the general, then tap any glowing point.',
      done: 'Right. One step, straight, and always inside the palace.' },
    { text: 'The general can never leave the palace, the 3 by 3 fortress with the crossed lines. Try it: TAP the general, then TAP the point above it.',
      pieces: ['rk5,7', ...KINGS], want: { refuse: [5, 7] }, sol: [[5, 7], [5, 6]], hint: 'Tap the general, then the point just above it (outside the palace).',
      done: 'The palace walls hold. That is why the generals are safe when they are guarded.' },
  ] },
  { title: 'The advisors', steps: [
    { text: 'The advisor (仕) also stays in the palace, but it steps one point along the diagonal lines. Move it to the glowing point.',
      pieces: ['rk5,9', 'ra3,9', ...KINGS], want: { from: [3, 9], to: [[4, 8]] }, sol: [[3, 9], [4, 8]], hint: 'Tap the advisor, then the glowing centre of the palace.',
      done: 'Good. Diagonal steps, inside the palace.' },
    { text: 'Never straight! Try to step the advisor straight up.',
      pieces: ['rk5,9', 'ra4,8', ...KINGS], want: { refuse: [4, 8] }, sol: [[4, 8], [4, 7]], hint: 'Tap the advisor, then the point straight above it.',
      done: 'Advisors only walk the diagonals.' },
  ] },
  { title: 'The elephants', steps: [
    { text: 'The elephant (相) leaps exactly two points diagonally. Move it to a glowing point.',
      pieces: ['rk4,9', 're2,9', ...KINGS], want: { from: [2, 9], to: [[4, 7], [0, 7]] }, sol: [[2, 9], [4, 7]], hint: 'Two points diagonally, up and to the right or left.',
      done: 'Good. Two points on the diagonal.' },
    { text: 'If a piece sits on the point in between (the elephant\'s eye), it is blocked. Try to leap over the soldier.',
      pieces: ['rk4,9', 're2,9', 'rp3,8', ...KINGS], want: { refuse: [2, 9] }, sol: [[2, 9], [4, 7]], hint: 'Tap the elephant, then the point two steps up and right.',
      done: 'Blocked eye. Keep the eye clear.' },
    { text: 'And an elephant can never cross the river. Try to send this one over.',
      pieces: ['rk4,9', 're2,5', ...KINGS], want: { refuse: [2, 5] }, sol: [[2, 5], [4, 3]], hint: 'Tap the elephant, then the point two steps up and right, across the river.',
      done: 'It guards its own half only.' },
  ] },
  { title: 'The horses', steps: [
    { text: 'The horse (傌) steps one point straight, then one diagonally outward: an L. Move it to any glowing point.',
      pieces: ['rk4,9', 'rh4,7', ...KINGS], want: { from: [4, 7], any: true }, sol: [[4, 7], [5, 5]], hint: 'Tap the horse, then any glowing point.',
      done: 'That is the horse\'s L.' },
    { text: 'The horse can be hobbled: a piece right next to it blocks that direction (its leg). Try to go up-right over your own soldier.',
      pieces: ['rk4,9', 'rh4,7', 'rp4,6', ...KINGS], want: { refuse: [4, 7] }, sol: [[4, 7], [5, 5]], hint: 'Tap the horse, then the point up one and right one from the soldier.',
      done: 'Hobbled. The leg must be free.' },
    { text: 'Horses capture by landing on an enemy. Capture the black soldier.',
      pieces: ['rk4,9', 'rh4,7', 'bp5,5', ...KINGS], want: { from: [4, 7], to: [[5, 5]] }, sol: [[4, 7], [5, 5]], hint: 'Tap the horse, then the black soldier.',
      done: 'Captured. The piece you land on is removed.' },
  ] },
  { title: 'The chariots', steps: [
    { text: 'The chariot (俥) is the strongest piece: any distance along a rank or file. Move it up the board.',
      pieces: ['rk4,9', 'rr0,9', ...KINGS], want: { from: [0, 9], any: true }, sol: [[0, 9], [0, 4]], hint: 'Tap the chariot, then any glowing point.',
      done: 'Straight lines, any distance.' },
    { text: 'It captures by landing on an enemy. Capture the black soldier at the end of the file.',
      pieces: ['rk4,9', 'rr0,9', 'bp0,3', ...KINGS], want: { from: [0, 9], to: [[0, 3]] }, sol: [[0, 9], [0, 3]], hint: 'Tap the chariot, then the black soldier.',
      done: 'Captured!' },
    { text: 'It cannot jump. Try to pass through your own soldier.',
      pieces: ['rk4,9', 'rr0,9', 'rp0,7', ...KINGS], want: { refuse: [0, 9] }, sol: [[0, 9], [0, 5]], hint: 'Tap the chariot, then a point beyond the soldier.',
      done: 'Nothing can be jumped, except by a cannon.' },
  ] },
  { title: 'The cannons', steps: [
    { text: 'The cannon (炮) moves like a chariot when it is not capturing. Move it up the file.',
      pieces: ['rk4,9', 'rc1,7', ...KINGS], want: { from: [1, 7], any: true }, sol: [[1, 7], [1, 5]], hint: 'Tap the cannon, then any glowing point.',
      done: 'Same as the chariot when it just moves.' },
    { text: 'To capture, it must jump over exactly one piece, the screen. Capture the black chariot by jumping your soldier.',
      pieces: ['rk4,9', 'rc1,7', 'rp1,5', 'br1,3', ...KINGS], want: { from: [1, 7], to: [[1, 3]] }, sol: [[1, 7], [1, 3]], hint: 'Tap the cannon, then the black chariot beyond the soldier.',
      done: 'A jump capture. One screen, no more, no less.' },
    { text: 'With no screen it cannot capture. Try to take the soldier straight ahead.',
      pieces: ['rk4,9', 'rc1,7', 'bp1,3', ...KINGS], want: { refuse: [1, 7] }, sol: [[1, 7], [1, 3]], hint: 'Tap the cannon, then the black soldier.',
      done: 'It needs a screen to fire.' },
  ] },
  { title: 'The soldiers', steps: [
    { text: 'The soldier (兵) steps one point forward. Advance it.',
      pieces: ['rk4,9', 'rp4,6', ...KINGS], want: { from: [4, 6], to: [[4, 5]] }, sol: [[4, 6], [4, 5]], hint: 'Tap the soldier, then the point ahead.',
      done: 'Forward, one step.' },
    { text: 'Once across the river a soldier may also step sideways. This one has crossed: step it sideways.',
      pieces: ['rk4,9', 'rp4,3', ...KINGS], want: { from: [4, 3], to: [[3, 3], [5, 3]] }, sol: [[4, 3], [3, 3]], hint: 'Tap the soldier, then a glowing point beside it.',
      done: 'Across the river, sideways is allowed.' },
    { text: 'But never backward. Try to step it back.',
      pieces: ['rk4,9', 'rp4,3', ...KINGS], want: { refuse: [4, 3] }, sol: [[4, 3], [4, 4]], hint: 'Tap the soldier, then the point behind it.',
      done: 'Soldiers never retreat, and they never promote.' },
  ] },
  { title: 'Generals face to face', steps: [
    { text: 'The two generals may never face each other on an open file. Your chariot shields yours. Try to slide it aside.',
      pieces: ['rk4,9', 'rr4,5', 'bk4,0'], want: { refuse: [4, 5] }, sol: [[4, 5], [3, 5]], hint: 'Tap the chariot, then the point to its left.',
      done: 'That move would leave the generals facing, so it is not allowed.' },
    { text: 'The chariot can still move along the file, keeping the shield. Move it up.',
      pieces: ['rk4,9', 'rr4,5', 'bk4,0'], want: { from: [4, 5], to: [[4, 4], [4, 3], [4, 2], [4, 1], [4, 6], [4, 7], [4, 8]] }, sol: [[4, 5], [4, 3]], hint: 'Tap the chariot, then a glowing point on the same file.',
      done: 'Good. The generals stay covered.' },
  ] },
  { title: 'Check', steps: [
    { text: 'Attack the black general and you give check. Move the chariot to attack it along the top rank.',
      pieces: ['rk5,9', 'rr0,6', 'bk4,0'], want: { check: true }, sol: [[0, 6], [0, 0]], hint: 'Tap the chariot, then the top-left corner.',
      done: 'Check! The opponent must answer it.' },
    { text: 'Now you are in check from the black chariot. Get out: move the general, or block, or capture the attacker.',
      pieces: ['rk4,9', 'rr1,6', 'br0,9', ...KINGS], want: { escape: true }, sol: [[4, 9], [4, 8]], hint: 'Step the general up one, or block with the chariot at the bottom rank.',
      done: 'Escaped. A general in check must always be saved at once.' },
  ] },
  { title: 'Checkmate', steps: [
    { text: 'When check cannot be answered, it is checkmate and the game is won. Two cannons make a strong pair. Find the mate.',
      rows: ['...a.k...', '.........', '.....C...', '.........', '.........', '.........', '.........', '.......C.', '....K....', '.........'],
      want: { mate: true }, sol: [[7, 7], [5, 7]], hint: 'Bring the second cannon onto the same file behind the first.',
      done: 'Checkmate! (Stalemate, with no move at all, is also a loss for that side.)' },
    { text: 'One more. A chariot and a cannon: find the checkmate.',
      rows: ['...a.k...', '.C.......', '.........', '.........', '.........', '.........', '.........', '.......R.', '....K....', '.........'],
      want: { mate: true }, sol: [[7, 7], [5, 7]], hint: 'Which file does the black general stand on?',
      done: 'That is the whole game. Now play!' },
  ] },
];
