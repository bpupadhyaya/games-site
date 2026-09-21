// Learn to play: short hands-on lessons. Each is a position, a sentence, and what counts as doing it right.
// Add lessons by adding data here. Fields:
//   rows: seven strings of seven characters, top row first ('.' empty or off the board, 'F' fox, 'G' goose); turn: 'F' | 'G'
//   want: 'step' any legal step | 'jump' any capture | 'jumps' (with n) n captures in ONE fox turn | 'refused' (the lesson is to see
//         a move refused) | 'win' a move that ends the game in the geese's favour
//   at:   optional list of points; the move's destination must be one of them
//   hint: optional text shown when they try something else
//   text: what to do;  done: what to say when they did it
// Every lesson keeps at least 8 geese on the board, so the fox never wins by count in the middle of a lesson.
import { N } from './rules.js';
export const LESSONS = [
  { title: 'The fox\'s step', turn: 'F', want: 'step',
    rows: ['.......', '.......', '.......', '...F...', '..GGG..', '..GGG..', '..GGG..'],
    text: 'The fox moves one step along a line: up, down, left or right. Tap the fox, then tap a glowing point next to it.',
    done: 'The fox moves one step to an empty point. It never goes diagonally.' },
  { title: 'The jump', turn: 'F', want: 'jump',
    rows: ['.......', '.......', '.......', '...F...', '..GGG..', '..G.G..', '..GGG..'],
    text: 'The fox captures by jumping over a goose to the empty point straight behind it. Tap the fox, then the red point.',
    done: 'The goose is captured. Capturing is never forced: the fox may always take a plain step instead.' },
  { title: 'Chains of jumps', turn: 'F', want: 'jumps', n: 2,
    rows: ['.......', '.......', '.......', 'FG.G...', '..GGG..', '..GGG..', '..GGG..'],
    text: 'After a jump the fox may jump again, in the same turn. Take BOTH geese: jump the first, then jump the second.',
    done: 'Two geese in one turn. After any jump the fox may stop by tapping Stop here, but it never has to.' },
  { title: 'Geese on the move', turn: 'G', want: 'step',
    rows: ['.......', '...F...', '.......', '.......', '..GGG..', '..GGG..', '..GGG..'],
    text: 'The geese go first. A goose moves one step: forward (up the board) or sideways. Tap a goose, then a glowing point.',
    done: 'One step forward or sideways. The geese win by closing in on the fox.' },
  { title: 'Never backward', turn: 'G', want: 'refused', at: [3 + N * 5],
    rows: ['.......', '...F...', '.......', '.......', '..GGG..', '..G.G..', '..GGG..'],
    text: 'Geese can never move backward. Tap the middle goose in the front row, then tap the empty point behind it.',
    done: 'Refused, and the game told you why. Every step a goose takes forward is one it cannot take back: move with care.' },
  { title: 'Safe in pairs', turn: 'F', want: 'refused', at: [3 + N * 5],
    rows: ['.......', '.......', '.......', '...F...', '..GGG..', '..GGG..', '..GGG..'],
    text: 'A goose with a friend right behind it cannot be jumped. Try it: tap the fox, then the far goose, where the fox would have to land.',
    done: 'Refused. Geese protect each other by standing in pairs and lines, so there is never an empty point behind them.' },
  { title: 'Edges are safe', turn: 'F', want: 'refused', at: [0 + N * 3],
    rows: ['.......', '.......', '.......', 'GF.....', '..GGG..', '..GGG..', '..GGG..'],
    text: 'A goose on the edge of the board has nothing behind it. Tap the fox, then tap the goose beside it.',
    done: 'Refused: with no point behind it, the fox cannot jump. Geese on the edge are hard to catch.' },
  { title: 'The fork', turn: 'G', want: 'step', at: [3 + N * 5, 5 + N * 3],
    rows: ['.......', '.......', '.......', '...FG..', '..GGGG.', '..G.G..', '..GGG..'],
    hint: 'The fox can jump the goose below it or the goose beside it. Fill one of the two empty points right behind a goose.',
    text: 'The fox threatens two geese at once: a fork. Save one by filling the point it would land on.',
    done: 'You saved one, and the fox takes the other. Keep geese in pairs and lines so the fox never finds a fork.' },
  { title: 'Trapping the fox', turn: 'G', want: 'win', at: [3 + N * 1],
    rows: ['..GFG..', '..G....', '...G...', '...G...', '..GGG..', '..G....', '.......'],
    hint: 'One open point beside the fox lets it escape. Slide the goose on its left sideways into it.',
    text: 'The geese win when the fox cannot move. The fox is in a corner with one point open: close it.',
    done: 'The fox is trapped: it has no step and no jump. The geese win! The fox wins by capturing so many geese that they can no longer trap it.' },
];
export const boardOf = (rows) => { const b = Array(49).fill(''); rows.join('').split('').forEach((c, i) => { if (c === 'F' || c === 'G') b[i] = c; }); return b; };
