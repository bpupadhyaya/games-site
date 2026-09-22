// Learn-to-play content as data. Boards are 24 characters: outer ring (points 0-7), middle ring (8-15), inner ring (16-23);
// 'D' = Dark, 'L' = Light, '.' = empty. hand = [Dark's cows in hand, Light's]. The learner always plays Dark.
// A step: want ('place' | 'move' | 'fly' | 'take' | 'win'), at (allowed destinations, or cows to shoot), from (allowed start points),
// text (shown while the step is open), hint (shown when the learner does something else), reply (a scripted answer by Light).
// solve = the taps a real player would make (used by the tests).
const B = (d, l) => { const a = Array(24).fill('.'); d.forEach((i) => { a[i] = 'D'; }); l.forEach((i) => { a[i] = 'L'; }); return a.join(''); };

export const LESSONS = [
  { title: 'Place a cow', board: B([], []), hand: [12, 12], solve: [5],
    steps: [{ want: 'place', text: 'Each player has twelve cows. TAP any empty point to place one.', hint: 'TAP an empty point on the board.' }],
    done: 'Placed. Dark and Light take turns placing all twelve cows before anyone slides.' },
  { title: 'Lines and diagonals', board: B([], [12]), hand: [12, 11], solve: [8],
    steps: [{ want: 'place', at: [8], text: 'Points are joined by lines, and four DIAGONALS run from corner to corner through all three squares. TAP the glowing point on the diagonal.', hint: 'TAP the glowing point.' }],
    done: 'That point sits on the diagonal from the outer corner to the inner corner. Cows may use it like any other line.' },
  { title: 'Make a mill', board: B([0, 1], [12, 21]), hand: [10, 10], solve: [2, 12],
    steps: [
      { want: 'place', at: [2], text: 'Three cows in a straight line are a MILL. You have two on the top edge. TAP the glowing point to close the mill.', hint: 'TAP the glowing point to complete the line.' },
      { want: 'take', at: [12, 21], text: 'Mill! You may shoot one Light cow. TAP a glowing cow.', hint: 'TAP one of the glowing cows.' }],
    done: 'Shot. Every mill you make shoots a cow, and a player left with fewer than three cows loses.' },
  { title: 'Protected cows', board: B([16, 17], [8, 9, 10, 13]), hand: [10, 8], solve: [18, 13],
    steps: [
      { want: 'place', at: [18], text: 'Close a mill on the inner top edge. TAP the glowing point.', hint: 'TAP the glowing point.' },
      { want: 'take', at: [13], text: 'Light has a mill of its own on the middle top edge. Cows standing in a mill are PROTECTED. TAP one of them to see why, then TAP the free glowing cow.', hint: 'Only the free cow can be shot: TAP the glowing one.' }],
    done: 'A cow in a mill is safe, unless every cow of that side stands in a mill.' },
  { title: 'Diagonal mills', board: B([0, 8], [12, 14]), hand: [10, 10], solve: [16, 12],
    steps: [
      { want: 'place', at: [16], text: 'Diagonals make mills too. Two cows already stand on the diagonal. TAP the glowing point at its end.', hint: 'TAP the glowing point on the diagonal.' },
      { want: 'take', at: [12, 14], text: 'A diagonal mill. TAP a glowing cow to shoot it.', hint: 'TAP one of the glowing cows.' }],
    done: 'There are twenty lines of three: the sides of the squares, the four middle lines and the four diagonals.' },
  { title: 'Slide a cow', board: B([0, 3, 13, 21], [5, 11, 17, 23]), hand: [0, 0], solve: [0, 1],
    steps: [{ want: 'move', text: 'When all cows are placed, cows SLIDE one step along a line to an empty point. TAP your cow, then TAP a glowing point (or DRAG the cow there).', hint: 'TAP one of your dark cows, then an empty point next to it.' }],
    done: 'Cows slide one step along any line, diagonals included. Try a longer move later and you will see why it is refused.' },
  { title: 'Open and close a mill', board: B([0, 1, 2, 20], [12, 14, 19, 22, 23]), hand: [0, 0], solve: [1, 9, 9, 1, 12],
    steps: [
      { want: 'move', from: [1], at: [9], text: 'A mill can be reused. First OPEN it: slide the top middle cow down to the glowing point.', hint: 'TAP the top middle cow, then the glowing point.', reply: { type: 'move', from: 22, to: 21, take: -1 } },
      { want: 'move', from: [9], at: [1], text: 'Now CLOSE it again by sliding the cow back. TAP the cow, then the glowing point.', hint: 'Slide the same cow back up.' },
      { want: 'take', at: [12, 14, 19, 21, 23], text: 'The mill is closed again, so you shoot again. TAP a glowing cow.', hint: 'TAP one of the glowing cows.' }],
    done: 'Opening and closing a mill again and again is the heart of the moving game.' },
  { title: 'Blocked cows', board: B([1, 3, 5, 8, 10, 12, 14, 15], [0, 2, 4, 6]), hand: [0, 0], solve: [15, 7],
    steps: [{ want: 'win', from: [15], at: [7], text: 'A player who cannot move loses. Every Light cow has one point still open next to it. TAP your cow on the left, then the glowing point that shuts the last gap.', hint: 'Move the cow on the middle left up to the glowing point.' }],
    done: 'Light cannot move, so Dark wins. Watch for blocks while you shoot: cows with nowhere to go are as good as lost.' },
  { title: 'Flying at three', board: B([0, 1, 20], [5, 12, 18]), hand: [0, 0], solve: [20, 2, 5],
    steps: [
      { want: 'fly', from: [20], at: [2], text: 'With only three cows left you may FLY: a cow jumps to ANY empty point. TAP the cow on the inner bottom left, then the glowing point to close your top row.', hint: 'TAP the cow at the bottom, then the glowing point at the top right.' },
      { want: 'take', at: [5, 12, 18], text: 'Mill! TAP a glowing cow to shoot it.', hint: 'TAP one of the glowing cows.' }],
    done: 'Light is left with two cows and loses. Flying makes the last three cows dangerous, so keep your mills alive.' },
];
export const boardOf = (str) => str.split('').map((c) => (c === 'D' ? 1 : c === 'L' ? 2 : 0));
