// Learn to play: short hands-on lessons. Each is a position, a sentence, and what counts as doing it right.
// Add lessons by adding data here. Fields:
//   board: 11 characters ('.', 'H', 'D') in point order (0 the hounds' end, 1-9 the grid, 10 the hare's end); turn: 'H' | 'D'
//   want:  'step' any legal step | 'refused' (the lesson is to see a move refused) | 'win' a move that ends the game in your favour
//   at:    optional list of points; the move's destination must be one of them
//   hm, limit: optional hunt clock (hound moves made so far, and the limit)
//   hint:  optional text shown when they try something else;  text: what to do;  done: what to say when they did it
export const LESSONS = [
  { title: 'The hare', turn: 'H', want: 'step', board: 'DD.D......H',
    text: 'One hare runs from three hounds. Tap the hare, then tap a glowing point next to it.',
    done: 'The hare moves one step along a line, in any direction: forward, back or sideways.' },
  { title: 'The hounds', turn: 'D', want: 'step', board: 'DD.D......H',
    text: 'The hounds go first. Tap a hound, then tap a glowing point next to it.',
    done: 'A hound also moves one step along a line. Hounds never jump and never capture.' },
  { title: 'No going back', turn: 'D', want: 'refused', board: '.D.D.D....H',
    text: 'Hounds may never move backward. Try it: tap the middle hound, then tap the point right behind it.',
    done: 'Refused, and the game told you why. Hounds only go forward or sideways, so they must work together.' },
  { title: 'Trap the hare', turn: 'D', want: 'win', at: [9], board: '......DDD.H',
    hint: 'The hare has one free point left. Tap the hound at the bottom right and close it.',
    text: 'The hounds win when the hare cannot move. One point is still open: close it.',
    done: 'The hare is boxed in. The hounds win! They never capture: they win by trapping.' },
  { title: 'Slip past', turn: 'H', want: 'win', board: '....HDD..D.',
    hint: 'Move the hare to the point nearer the hounds\' end than every hound.',
    text: 'The hare wins by getting past the hounds. Tap the hare, then tap the point beyond every hound.',
    done: 'Past them! Hounds can never move backward, so they can never catch it. The hare wins.' },
  { title: 'Diagonals', turn: 'H', want: 'step', at: [1, 3, 7, 9], board: '..D.DHD....',
    hint: 'Look for the slanted lines that run out of the middle of the board.',
    text: 'Some points have diagonal lines: the ends, the corners of the grid and its centre. The hare is boxed on three sides. Tap it, then tap a diagonal point.',
    done: 'Diagonals are lines like any other. The middle point is the most powerful: it has eight.' },
  { title: 'The hunt clock', turn: 'D', want: 'step', hm: 8, limit: 12, board: '.D.D.D..H..',
    text: 'The hounds have a limited number of moves. The clock at the top shows how many are left: only four now. Make a move.',
    done: 'If the hare is not trapped before the clock runs out, the hare wins. Hounds must hurry, but never open a gap.' },
  { title: 'Find the net', turn: 'D', want: 'step', at: [9], board: '.....DDDH..',
    hint: 'One hound move traps the hare for certain in two moves. Try the hound at the bottom right.',
    text: 'The hare is nearly cornered. Only one move leads to a certain trap in two moves. Find it.',
    done: 'Whatever the hare does now, the next move closes the net. Thinking two moves ahead is the whole game.' },
  { title: 'The gap', turn: 'H', want: 'step', at: [2], board: '.D.DDH.....',
    hint: 'Head for the middle of the column on the hounds\' side: the gap there leads out.',
    text: 'The hounds have left a gap. Only one step for the hare leads to a certain escape. Find it.',
    done: 'Through! Next move the hare is past all three hounds. Every hound that steps forward leaves a gap behind it.' },
];
export const boardOf = (str) => str.split('').map((c) => (c === '.' ? '' : c));
