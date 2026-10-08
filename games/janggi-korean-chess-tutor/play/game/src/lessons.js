// The hands-on lessons, as data. Each lesson has steps; each step sets up a small position (Cho at the bottom, always to move)
// and waits for the player's move.
//   pieces: [ 'K4,8', ... ]  one letter (UPPER CASE = Cho, lower case = Han) + x,y. k general, g guard, e elephant, h horse, r chariot, c cannon, p soldier
//   want:   { from:[x,y], to:[[x,y]...] }  a legal move of that piece to one of these points
//           { from:[x,y], any:true }        any legal move of that piece
//           { refuse:[x,y] }                the player must TRY an illegal move with the piece on [x,y]; the reason is shown
//           { check:true } / { mate:true } / { escape:true }   any move that gives check / checkmates / gets out of check
//           { pass:true }                   the player must tap Pass
//           { read:true }                   a reading step: nothing to play, Next is available at once
//   sol:    [[x,y],[x,y]] one accepted answer (the tests play it through real taps), or 'pass'
//   hint:   shown when the player asks for a hint
import { sqOf, startBoard } from './rules.js';

const T = { k: 1, g: 2, e: 3, h: 4, r: 5, c: 6, p: 7 };
export function stepBoard(step) {
  if (step.start) return startBoard(step.start, step.start);
  const b = new Array(90).fill(0);
  for (const s of step.pieces) { const m = /^([a-zA-Z])(\d),(\d)$/.exec(s); b[sqOf(+m[2], +m[3])] = (m[1] === m[1].toUpperCase() ? 1 : -1) * T[m[1].toLowerCase()]; }
  return b;
}
export const sq = (p) => sqOf(p[0], p[1]);

export const LESSONS = [
  { title: 'The general', steps: [
    { text: 'Your general (楚) is the piece you must never lose. It lives in the palace, the 3 by 3 fortress with the crossed lines. TAP it, then TAP a glowing point. It steps one point along ANY line of the palace, diagonals included.',
      pieces: ['K4,8', 'k3,0'], want: { from: [4, 8], any: true }, sol: [[4, 8], [3, 7]], hint: 'Tap the general, then tap any glowing point.',
      done: 'Right. One step along the palace lines, straight or diagonal.' },
    { text: 'The general can never leave the palace. Try it: TAP the general, then TAP the point above it, outside the walls.',
      pieces: ['K5,7', 'k3,0'], want: { refuse: [5, 7] }, sol: [[5, 7], [5, 6]], hint: 'Tap the general, then the point just above it (outside the palace).',
      done: 'The palace walls hold. The general is safe as long as it is guarded.' },
  ] },
  { title: 'The guards', steps: [
    { text: 'The two guards (士) also stay in the palace and move exactly like the general: one step along the lines. Move this guard along the diagonal to the glowing centre.',
      pieces: ['K5,9', 'G3,9', 'k3,0'], want: { from: [3, 9], to: [[4, 8]] }, sol: [[3, 9], [4, 8]], hint: 'Tap the guard, then the centre of the palace.',
      done: 'Good. Guards use the palace diagonals too.' },
    { text: 'A guard can never step outside. Try to move this guard to the left, out of the palace.',
      pieces: ['K5,9', 'G3,7', 'k3,0'], want: { refuse: [3, 7] }, sol: [[3, 7], [2, 7]], hint: 'Tap the guard, then the point to its left.',
      done: 'Guards guard: they never leave the fortress.' },
  ] },
  { title: 'The chariot', steps: [
    { text: 'The chariot (車) is the strongest piece, worth 13 points. It runs any distance along a rank or a file. Move it to any glowing point.',
      pieces: ['K4,9', 'R2,5', 'k3,0'], want: { from: [2, 5], any: true }, sol: [[2, 5], [2, 1]], hint: 'Tap the chariot, then a point far along its file.',
      done: 'It slides as far as it likes until something blocks it.' },
    { text: 'It captures by landing on an enemy piece. Take the enemy soldier on the glowing red point.',
      pieces: ['K4,9', 'R2,5', 'k3,0', 'p2,2'], want: { from: [2, 5], to: [[2, 2]] }, sol: [[2, 5], [2, 2]], hint: 'Tap the chariot, then the red point.',
      done: 'Captured. The chariot never jumps: pieces in its way stop it.' },
    { text: 'Inside a palace the chariot may also run along the two crossing diagonals. Slide it across the centre to the far corner of your own palace.',
      pieces: ['K4,9', 'R3,7', 'k3,0'], want: { from: [3, 7], to: [[5, 9], [4, 8]] }, sol: [[3, 7], [5, 9]], hint: 'Tap the chariot, then the glowing corner diagonally opposite.',
      done: 'Diagonals are only on the palace lines, in both palaces.' },
    { text: 'A chariot cannot jump. Your own soldier stands in the way: try to send the chariot up the file anyway.',
      pieces: ['K4,9', 'R2,5', 'P2,3', 'k3,0'], want: { refuse: [2, 5] }, sol: [[2, 5], [2, 1]], hint: 'Tap the chariot, then a point beyond the soldier.',
      done: 'Blocked. Only the cannon may jump.' },
  ] },
  { title: 'The horse', steps: [
    { text: 'The horse (馬) goes one point straight and then one diagonally outward, worth 5 points. Move it to any glowing point.',
      pieces: ['K4,9', 'H4,6', 'k3,0'], want: { from: [4, 6], any: true }, sol: [[4, 6], [5, 4]], hint: 'Tap the horse, then any glowing point.',
      done: 'An L-shaped step.' },
    { text: 'A horse can be hobbled: if a piece stands on the point right next to it in the direction it first steps, it cannot go that way. A soldier stands above this horse. Try to jump up and to the right.',
      pieces: ['K4,9', 'H4,6', 'P4,5', 'k3,0'], want: { refuse: [4, 6] }, sol: [[4, 6], [5, 4]], hint: 'Tap the horse, then the point two up and one right.',
      done: 'Hobbled! The point directly in front is its "leg".' },
    { text: 'Capture the enemy chariot with the horse: it is on a glowing red point.',
      pieces: ['K4,9', 'H4,6', 'k3,0', 'r5,4'], want: { from: [4, 6], to: [[5, 4]] }, sol: [[4, 6], [5, 4]], hint: 'Tap the horse, then the red point.',
      done: 'A 5-point horse took a 13-point chariot. That is a great trade.' },
  ] },
  { title: 'The elephant', steps: [
    { text: 'The elephant (象) goes one point straight, then two points diagonally outward: a long leap, worth 3 points. Unlike in Chinese chess it can go anywhere on the board. Move it.',
      pieces: ['K4,9', 'E2,9', 'k3,0'], want: { from: [2, 9], any: true }, sol: [[2, 9], [4, 6]], hint: 'Tap the elephant, then a glowing point.',
      done: 'A 3 by 2 leap.' },
    { text: 'The elephant is blocked if a piece stands on the point it first steps to, or on the diagonal point it crosses. A soldier stands directly above it. Try to leap up and to the right.',
      pieces: ['K4,9', 'E2,9', 'P2,8', 'k3,0'], want: { refuse: [2, 9] }, sol: [[2, 9], [4, 6]], hint: 'Tap the elephant, then the point two right and three up.',
      done: 'Blocked on its first step.' },
  ] },
  { title: 'The cannon', steps: [
    { text: 'The cannon (包) is special: it must jump over exactly one piece, even to MOVE. Your soldier is the screen. Jump the cannon over it to any glowing point beyond.',
      pieces: ['K4,9', 'C1,7', 'P1,5', 'k3,0'], want: { from: [1, 7], any: true }, sol: [[1, 7], [1, 3]], hint: 'Tap the cannon, then a glowing point beyond the soldier.',
      done: 'Over the screen and down the line, worth 7 points.' },
    { text: 'It captures the same way: over one screen onto an enemy piece. Take the enemy chariot.',
      pieces: ['K4,9', 'C1,7', 'P1,5', 'k3,0', 'r1,2'], want: { from: [1, 7], to: [[1, 2]] }, sol: [[1, 7], [1, 2]], hint: 'Tap the cannon, then the red point.',
      done: 'A cannon takes by jumping.' },
    { text: 'With no screen a cannon cannot move at all. This cannon has nothing to jump: try moving it.',
      pieces: ['K4,9', 'C1,7', 'k3,0'], want: { refuse: [1, 7] }, sol: [[1, 7], [1, 3]], hint: 'Tap the cannon, then any point.',
      done: 'No screen, no move.' },
    { text: 'One more rule: a cannon can never capture another cannon, and a cannon is never a valid screen. Try to take the enemy cannon.',
      pieces: ['K4,9', 'C1,7', 'P1,5', 'k3,0', 'c1,2'], want: { refuse: [1, 7] }, sol: [[1, 7], [1, 2]], hint: 'Tap the cannon, then the enemy cannon.',
      done: 'Cannons cannot capture each other.' },
  ] },
  { title: 'The soldier', steps: [
    { text: 'The soldier (卒 / 兵) is worth 2 points. It steps one point forward or sideways, never back. Move it.',
      pieces: ['K4,9', 'P4,6', 'k3,0'], want: { from: [4, 6], to: [[4, 5], [3, 6], [5, 6]] }, sol: [[4, 6], [4, 5]], hint: 'Tap the soldier, then a glowing point.',
      done: 'Forward or sideways, one point at a time.' },
    { text: 'There is no way back. Try to step this soldier backward.',
      pieces: ['K4,9', 'P4,5', 'k3,0'], want: { refuse: [4, 5] }, sol: [[4, 5], [4, 6]], hint: 'Tap the soldier, then the point behind it.',
      done: 'Soldiers only advance, so push them with a plan.' },
    { text: 'In the enemy palace a soldier may also step forward along the diagonals. Step this one into the centre: it gives check to the general!',
      pieces: ['K4,9', 'P3,2', 'k5,0'], want: { from: [3, 2], to: [[4, 1]] }, sol: [[3, 2], [4, 1]], hint: 'Tap the soldier, then the centre of the enemy palace.',
      done: 'A soldier on the palace diagonal threatens the corners.' },
  ] },
  { title: 'Check and mate', steps: [
    { text: 'When a general can be captured next move it is in CHECK. Give check: slide your chariot along the top rank towards the enemy general.',
      pieces: ['K4,9', 'R0,5', 'k3,0'], want: { check: true }, sol: [[0, 5], [0, 0]], hint: 'Tap the chariot and move it to the far end of the top rank.',
      done: 'Check! The general must answer.' },
    { text: 'Your general is in check from the enemy chariot. You must answer: capture it, block it, or move the general. Any answer will do.',
      pieces: ['K4,8', 'R0,5', 'k3,0', 'r4,3'], want: { escape: true }, sol: [[0, 5], [4, 5]], hint: 'Block the file with your chariot, or step the general aside.',
      done: 'Safe. A general in check may not pass.' },
    { text: 'CHECKMATE ends the game: the general is attacked and cannot escape. One chariot already covers the second rank; deliver the final blow with the other.',
      pieces: ['K4,9', 'R0,1', 'R8,2', 'k3,0'], want: { mate: true }, sol: [[8, 2], [8, 0]], hint: 'Move the right-hand chariot to the top corner.',
      done: 'Checkmate. You win the game.' },
  ] },
  { title: 'Bikjang', steps: [
    { text: 'When the two generals face each other on an open file it is called BIKJANG. Make it happen: step the soldier aside, so nothing stands between the generals.',
      pieces: ['K4,8', 'P4,5', 'R0,9', 'k4,1'], want: { from: [4, 5], to: [[3, 5], [5, 5]] }, sol: [[4, 5], [3, 5]], hint: 'Tap the soldier, then sidestep it.',
      done: 'Bikjang! Now your opponent must break it, or may call it a draw.' },
    { text: 'Now YOU are facing the enemy general. You may not simply play on: you must block, capture or move your general. Block the file with your chariot.',
      pieces: ['K4,8', 'P3,5', 'R8,5', 'k4,1'], want: { from: [8, 5], to: [[4, 5]] }, sol: [[8, 5], [4, 5]], hint: 'Slide the chariot along the rank onto the open file.',
      done: 'Broken. Bikjang is a way to force a draw when you are behind.' },
  ] },
  { title: 'Passing and counting', steps: [
    { text: 'Janggi lets you PASS (unless you are in check): use it when every move would hurt. Tap the Pass button.',
      pieces: ['K4,8', 'k3,0'], want: { pass: true }, sol: 'pass', hint: 'Tap the Pass button below the board.',
      done: 'Passed. If both players pass in a row, the game ends and the pieces are counted.' },
    { text: 'COUNTING: chariot 13, cannon 7, horse 5, elephant 3, guard 3, soldier 2, general 0. Here Cho has 13 + 7 + 5 + 3 + 3 + 2 = 33. Han has chariot 13 + elephant 3 = 16, plus 1.5 for moving second = 17.5. Cho wins on points.',
      pieces: ['K4,9', 'R0,5', 'C1,7', 'H2,6', 'E6,9', 'G3,9', 'P0,6', 'k3,0', 'r8,4', 'e4,0'], want: { read: true }, sol: null, hint: '',
      done: 'Whoever has more points wins. That is also how a very long game is settled.' },
  ] },
  { title: 'The four set-ups', steps: [
    { text: 'Before the first move each player chooses how the two horses and two elephants stand on the back rank: INNER elephant, OUTER elephant, LEFT elephant or RIGHT elephant. Cho (green) moves first and sets up first; Han (red) sets up after seeing Cho\'s choice.',
      start: 'inner', want: { read: true }, sol: null, hint: '',
      done: 'Choose the set-up that suits your style on the Set-up screen.' },
  ] },
];
