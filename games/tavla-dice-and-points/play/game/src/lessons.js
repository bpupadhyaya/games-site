// Learn-to-play content as data. Points are written as point NUMBERS (1-24) as printed on the board.
//   mine / theirs : [[point, checkers], ...]   bar: [mine, theirs]   dice: the forced roll
//   want: 'move' (any legal step) | 'to' (a step landing on one of `at`) | 'refused' (try to land on a point in `at`)
//         | 'hit' | 'enter' | 'all' (play every die; `end` is an extra check) | 'off' (bear off `count` checkers)
//   only: [[from, to], ...] the only steps the lesson accepts (point numbers; 'bar' and 'off' allowed); anything else gets `hint`.
export const START = { mine: [[24, 2], [13, 5], [8, 3], [6, 5]], theirs: [[1, 2], [12, 5], [17, 3], [19, 5]] };
export const LESSONS = [
  { title: 'Roll and move', mine: START.mine, theirs: START.theirs, dice: [4, 2], want: 'move', rollFirst: true,
    text: 'You play the light checkers and move DOWN toward point 1. TAP the dice to roll them. Then TAP one of your checkers: the points it can reach glow. TAP a glowing point to move there.',
    done: 'A checker moves exactly the number on a die. You can also DRAG a checker and drop it on a glowing point.' },
  { title: 'Two dice, two moves', mine: START.mine, theirs: START.theirs, dice: [5, 3], want: 'all',
    text: 'Each die is its own move. Play the 5 and the 3: use one checker twice, or two checkers once each. If you slip, TAP Undo.',
    done: 'Both dice played. You must always play as many dice as you legally can.' },
  { title: 'Blocked points', mine: [[13, 2], [8, 3], [6, 5], [24, 2]], theirs: [[5, 2], [1, 2], [12, 5], [17, 3], [19, 3]], dice: [3, 6], want: 'refused', at: [5],
    text: 'Two or more checkers on a point hold it: you cannot land there. Point 5 belongs to the opponent. TAP your checker on point 8, then TAP point 5 and see why it refuses.',
    done: 'A held point is blocked. Points held in a row make a wall that stops the opponent.' },
  { title: 'Hitting a blot', mine: [[13, 2], [8, 3], [6, 4], [24, 2]], theirs: [[5, 1], [1, 2], [12, 5], [17, 3], [19, 3]], dice: [3, 1], want: 'hit', only: [[8, 5], [6, 5]],
    text: 'A single checker is a blot. Land on it and it goes to the bar. The opponent has a blot on point 5: hit it with the 3 from point 8 (or the 1 from point 6). TAP the checker, then the glowing point 5.',
    done: 'Hit! The opponent must now enter from the bar before doing anything else.', hint: 'Look for the lone opposing checker on point 5 and land on it.' },
  { title: 'The bar', mine: [[13, 3], [8, 3], [6, 5], [24, 1]], bar: [1, 0], theirs: [[23, 2], [12, 5], [17, 3], [19, 4], [1, 1]], dice: [2, 5], want: 'enter', only: [['bar', 20]],
    text: 'You were hit: a checker of yours waits on the bar and must come in first. A die of N enters on point 25 minus N. The 2 points to 23, which is blocked. The 5 points to 20, which is open. TAP the glowing point.',
    done: 'Entered. Now the other die is free for any checker.', hint: 'Enter with the 5: it lands on point 20.' },
  { title: 'Make a point', mine: [[24, 2], [13, 5], [8, 3], [6, 4], [5, 1]], theirs: [[1, 2], [12, 5], [17, 3], [19, 5]], dice: [3, 1], want: 'to', at: [5], only: [[8, 5], [6, 5]],
    text: 'One checker alone can be hit; two together are safe and block the opponent. Point 5 has one of yours. Bring another there: move from 8 with the 3 (or from 6 with the 1).',
    done: 'A made point. Two checkers on it: the opponent cannot land there and cannot hit them.', hint: 'Land on point 5, where you already have a checker.' },
  { title: 'Blocks and primes', mine: [[6, 2], [5, 2], [4, 2], [8, 2], [13, 3], [24, 2]], theirs: [[1, 2], [12, 5], [17, 3], [19, 3]], dice: [6, 1], want: 'all', only: [[8, 7], [13, 7]], end: (g) => g.board[6] >= 2,
    text: 'Points side by side make a prime, a wall the opponent cannot jump. You hold 4, 5 and 6. Make point 7 too: play the 1 from point 8 and the 6 from point 13, both to point 7.',
    done: 'Four points in a row. Six in a row is a full prime that cannot be passed at all.', hint: 'Both dice should end on point 7: 8 minus 1, and 13 minus 6.' },
  { title: 'Doubles', mine: START.mine, theirs: START.theirs, dice: [3, 3], want: 'all',
    text: 'The same number on both dice is a double: you play that number FOUR times. You have four 3s. Move any of your checkers, one 3 at a time.',
    done: 'Doubles are a big gift: four moves at once.' },
  { title: 'Bearing off', mine: [[6, 3], [5, 3], [4, 3], [3, 2], [2, 2], [1, 2]], theirs: [[17, 15]], dice: [6, 3], want: 'off', count: 2,
    text: 'When all 15 of your checkers are in your home board (points 1 to 6) you may bear them off. A 6 removes a checker from point 6, a 3 from point 3. TAP a checker, then TAP the tray below the board.',
    done: 'Borne off. The first player to bear off all 15 wins. Then play your first game: it is the same, with the computer.', hint: 'Bear off the checker on point 6 with the 6, and the one on point 3 with the 3.' },
];

export function setup(l, g) {
  g.board.fill(0); g.bar = [l.bar?.[0] ?? 0, l.bar?.[1] ?? 0]; g.off = [0, 0]; g.turn = 0; g.moves = 0;
  for (const [pt, n] of l.mine) g.board[pt - 1] += n;
  for (const [pt, n] of l.theirs) g.board[pt - 1] -= n;
  return g;
}
export const ptOf = (i) => (i === 24 ? 'bar' : i === 25 ? 'off' : i + 1);
