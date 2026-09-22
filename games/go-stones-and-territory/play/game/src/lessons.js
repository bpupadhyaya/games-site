// Learn-to-play content as data. A lesson = a small board + steps. Each step names what the player must do (`want`):
//   place {at:[[x,y],...]?}   play a stone (only at the listed points when `at` is given)
//   libs {at:[x,y]}           tap every liberty of that stone (no confirm needed)
//   capture                   play a stone that captures
//   atari                     play a stone that leaves an enemy group with exactly one liberty
//   refused {why}             try a move the rules refuse (the reason is shown)
//   quiz {q, options, correct}  answer a question by tapping an answer
//   pass | undo | hint        press that button
//   game                      play a whole game (the lesson finishes when the game ends)
// rows: '.' empty, 'X' black, 'O' white; row 0 is the TOP of the board. turn: 1 black, 2 white.
// Coordinates are [x, y] with (0,0) the top-left crossing.
export const LESSONS = [
  { id: 'stone', title: 'Your first stone', n: 5, rows: ['.....', '.....', '.....', '.....', '.....'], steps: [
    { turn: 1, text: 'Go is played on the crossings of the lines. TAP a crossing to aim: a ghost stone appears. TAP it again (or press Place) to play it. You can also DRAG your finger to move the ghost, then let go.', want: { kind: 'place' }, hint: 'Tap any crossing, then tap it again.' },
  ] },
  { id: 'tools', title: 'Undo and Hint', n: 5, rows: ['.....', '.....', '..X..', '.....', '.....'], steps: [
    { turn: 2, text: 'Everyone plays a wrong stone sometimes. Play any stone, then press UNDO to take it back.', want: { kind: 'place' }, hint: 'Aim, then press Place.' },
    { turn: 2, text: 'Now press UNDO.', want: { kind: 'undo' }, keep: true, hint: 'Undo is the second button in the bottom row.' },
    { turn: 2, text: 'Not sure what to play? Press HINT: a glowing point shows a good move and says why. You will see it on the board.', want: { kind: 'hint' }, keep: true, hint: 'Hint is the third button in the bottom row.' },
  ] },
  { id: 'libs', title: 'Liberties', n: 5, rows: ['.....', '.....', '..X..', '.....', '.....'], steps: [
    { turn: 1, text: 'The empty points next to a stone, up, down, left and right, are its liberties. A stone breathes through them. TAP each liberty of the black stone.', want: { kind: 'libs', at: [2, 2] }, hint: 'There are four: above, below, left and right.' },
    { turn: 1, text: 'At the edge a stone has fewer liberties. How many does the black stone on the edge have?', rows: ['.....', '.....', 'X....', '.....', '.....'], want: { kind: 'quiz', options: ['2', '3', '4'], correct: 1 }, hint: 'Count the empty points that touch it: the edge has no point beyond.' },
  ] },
  { id: 'capture', title: 'Capturing', n: 5, rows: ['.....', '..X..', '.XOX.', '.....', '.....'], steps: [
    { turn: 1, text: 'When a stone loses its last liberty it is captured and removed. The white stone has one liberty left. Play there to capture it.', want: { kind: 'capture', at: [[2, 3]] }, hint: 'The empty point below the white stone.' },
    { turn: 1, text: 'Stones that touch in a line live and die together as a group. Capture both white stones with one move.', rows: ['.....', '.XX..', 'XOOX.', '..X..', '.....'], want: { kind: 'capture', at: [[1, 3]] }, hint: 'The empty point below the left white stone.' },
  ] },
  { id: 'atari', title: 'Atari and escape', n: 5, rows: ['.....', '..X..', '.XO..', '.....', '.....'], steps: [
    { turn: 1, text: 'A stone with ONE liberty left is in "atari": it will be captured next move. Put the white stone in atari.', want: { kind: 'atari' }, hint: 'Play on one of the two liberties that are left.' },
    { turn: 1, text: 'Now your own stone is in atari! Escape by extending it: play the liberty to join a bigger, safer group.', rows: ['.....', '..O..', '.OXO.', '.....', '.....'], want: { kind: 'place', at: [[2, 3]] }, hint: 'The only empty point next to your stone.' },
  ] },
  { id: 'suicide', title: 'No suicide', n: 5, rows: ['.....', '.O...', 'O.O..', '.O...', '.....'], steps: [
    { turn: 1, text: 'You may not play a stone that has no liberties, unless it captures. Try playing in the middle of the four white stones and see what the game tells you.', want: { kind: 'refused', why: 'suicide', at: [[1, 2]] }, hint: 'The empty point surrounded on all four sides.' },
  ] },
  { id: 'ko', title: 'Ko', n: 5, rows: ['.....', '.XO..', 'XO.O.', '.XO..', '.....'], steps: [
    { turn: 1, text: 'Black can capture the white stone in the middle. Play the empty point next to it.', want: { kind: 'capture', at: [[2, 2]] }, hint: 'The gap in the middle of the shape.' },
    { turn: 2, text: 'White would like to capture straight back, but that could go on forever. Ko rule: you may not retake at once. Try it at the marked point.', want: { kind: 'refused', why: 'ko', at: [[1, 2]] }, keep: true, hint: 'The point where the black stone just captured.' },
  ] },
  { id: 'eyes', title: 'Eyes and life', n: 5, rows: ['...XO', 'XXXXO', 'OOOOO', '.....', '.....'], steps: [
    { turn: 1, text: 'A group is safe when it has two separate eyes: two empty points White can never fill. This black group has room for two eyes. Play the vital middle point of the three empty points.', want: { kind: 'place', at: [[1, 0]] }, hint: 'The middle of the three empty points along the edge.' },
    { turn: 2, text: 'Two eyes! If White plays inside one, it is suicide. Try it: play in an eye.', want: { kind: 'refused', why: 'suicide', at: [[0, 0], [2, 0]] }, keep: true, hint: 'Either empty point on the edge.' },
  ] },
  { id: 'territory', title: 'Territory', n: 5, rows: ['..XO.', '..XO.', '..XO.', '..XO.', '..XO.'], steps: [
    { turn: 1, text: 'Territory is empty space one player has walled off. How many empty points does Black surround on the left?', want: { kind: 'quiz', options: ['5', '10', '15'], correct: 1 }, hint: 'Two columns of five.' },
  ] },
  { id: 'score', title: 'Scoring and passing', n: 5, rows: ['..XO.', '..XO.', '..XO.', '..XO.', '..XO.'], steps: [
    { turn: 1, text: 'We use area scoring: your score is your stones plus your territory. Black has 5 stones and 10 points of territory. What is Black\'s score?', want: { kind: 'quiz', options: ['10', '15', '20'], correct: 1 }, hint: '5 + 10.' },
    { turn: 1, text: 'White has 5 stones and 5 points of territory: 10, plus a small bonus (komi) so that Black moving first is fair. Who wins?', want: { kind: 'quiz', options: ['Black', 'White'], correct: 0 }, hint: '15 against 10 and a half.' },
    { turn: 1, text: 'When neither player has a useful move left, press PASS. Two passes in a row end the game.', want: { kind: 'pass' }, hint: 'Pass is the first button in the bottom row.' },
  ] },
  { id: 'game', title: 'Your first game', n: 5, rows: ['.....', '.....', '.....', '.....', '.....'], steps: [
    { turn: 1, text: 'A whole game on a tiny board against the gentlest computer opponent. Make territory, capture what you can, and pass when nothing is left.', want: { kind: 'game' }, hint: 'Play on the middle first.' },
  ] },
];

export function boardOf(rows) {
  const n = rows.length, b = new Array(n * n).fill(0);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { b[y * n + x] = ch === 'X' ? 1 : ch === 'O' ? 2 : 0; }));
  return b;
}
