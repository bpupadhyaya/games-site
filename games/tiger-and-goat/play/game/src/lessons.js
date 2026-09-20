// Learn to play: short hands-on lessons. Each is a position, a sentence, and what counts as doing it right.
// Add lessons by adding data here. Fields:
//   board: 25 characters ('.', 'T', 'G'), row by row from the far side; hand: goats still to place; turn: 'G' | 'T'
//   want:  'place' any placement | 'step' any legal step | 'jump' any capture | 'refused' (the lesson is to see a move refused)
//          | 'win' a move that ends the game in your favour
//   at:    optional list of points; the move's destination (or placement) must be one of them
//   hint:  optional text shown when they try something else
//   text:  what to do;  done: what to say when they did it
export const LESSONS = [
  { title: 'Placing goats', turn: 'G', hand: 20, want: 'place',
    board: 'T...T...............T...T',
    text: 'The goats go first. Tap any empty point to place a goat.',
    done: 'A goat is placed each turn until all 20 are on the board. Only then may goats move.' },
  { title: 'The tiger\'s step', turn: 'T', hand: 19, want: 'step',
    board: 'T...T.......G.......T...T',
    text: 'Tigers move from the very first turn. Tap a tiger, then tap a glowing point next to it.',
    done: 'A tiger moves one step along a line to an empty point.' },
  { title: 'The tiger\'s jump', turn: 'T', hand: 18, want: 'jump',
    board: 'T...T......GTG......T....',
    text: 'A tiger captures by jumping over a goat to the empty point straight behind it. Tap the middle tiger, then a red point.',
    done: 'The goat is captured. One jump per turn, and capturing is never forced.' },
  { title: 'Safety in pairs', turn: 'T', hand: 18, want: 'refused',
    board: 'T...T......TGG......T....',
    text: 'A goat with a friend right behind it cannot be jumped. Try it: tap the tiger beside the two goats, then the second goat, where the tiger would have to land.',
    done: 'Refused, and the game told you why. Goats protect each other by standing in lines.' },
  { title: 'Goats on the move', turn: 'G', hand: 0, want: 'step',
    board: 'T.G.T.G.G.......G.G.T.G.T',
    text: 'All goats are placed, so now they move. Tap a goat, then a glowing point one step away.',
    done: 'A goat moves one step along a line. Goats never jump.' },
  { title: 'Trapping the tigers', turn: 'G', hand: 0, want: 'win',
    board: 'TGGGTGGGGGGG.GGGGGGGTGGGT',
    text: 'The goats win when no tiger can move. One point is still open: close it.',
    done: 'Every tiger is trapped. The goats win! The tigers win by capturing every goat.' },
  { title: 'The fork', turn: 'G', hand: 17, want: 'place', at: [2, 14],
    board: 'T......G....TG......T...T',
    hint: 'The middle tiger can jump the goat above it or the goat beside it. Fill one of the empty points right behind a goat.',
    text: 'One tiger threatens two goats at once: a fork. Save one by filling the point it would land on.',
    done: 'You saved one, and the tiger takes the other. Keep goats in pairs and lines so no tiger can fork them.' },
  { title: 'Edges are safe', turn: 'T', hand: 19, want: 'refused',
    board: '..G.T..T............T...T',
    text: 'A goat on the edge has nothing behind it. Tap the tiger below the top goat, then tap that goat.',
    done: 'Refused: with no point behind it, the tiger cannot jump. Goats on the edge are hard to catch.' },
  { title: 'The squeeze', turn: 'G', hand: 0, want: 'win', at: [12],
    board: 'TGGGTGGGGGG...GGG.GGTGGGT',
    hint: 'One empty point in the middle keeps a tiger alive. Slide the goat just above it down into that point.',
    text: 'All goats are placed. One open point in the middle still gives the tigers a jump. Close it with a goat.',
    done: 'Every tiger is boxed in: the goats win. The end of a game is about closing the last gaps.' },
];
export const boardOf = (str) => str.split('').map((c) => (c === '.' ? '' : c));
