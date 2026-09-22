// Learn to play: short hands-on lessons. Each is a position, a fixed roll, a sentence, and what counts as doing it right.
// Fields: pos0/pos1: the seven path positions of each side (0 = waiting, 15 = home); roll: the roll you are given (0 = you roll it)
//   want: 'move' any legal move | 'to' a move ending on `at` | 'roll' tap the dice | 'refused' see a move refused | 'win' the game-winning move | 'off' bring a piece home
//   text: what to do; done: what to say when they did it; hint: shown when they try something else.
export const LESSONS = [
  { title: 'Your first step', pos0: [0, 0, 0, 0, 0, 0, 0], pos1: [0, 0, 0, 0, 0, 0, 0], roll: 2, want: 'move',
    text: 'Seven pieces wait on your side. You rolled a 2. Tap a waiting piece, then tap the glowing square two steps in.',
    done: 'Every piece enters on the square nearest the bridge in your own lane, then runs down your lane, up the middle lane and home along your lane at the top.' },
  { title: 'The four dice', pos0: [3, 0, 0, 0, 0, 0, 0], pos1: [0, 0, 0, 0, 0, 0, 0], roll: 0, rolls: [3], want: 'roll',
    text: 'You roll four pyramid dice. Each counts 1 if its gold tip is up, so a roll is 0 to 4. Tap the dice tray to roll.',
    done: 'The dice add up. Two is the most common roll (6 in 16); zero and four come up only 1 time in 16. A zero passes the turn.' },
  { title: 'Rosettes', pos0: [2, 0, 0, 0, 0, 0, 0], pos1: [0, 0, 0, 0, 0, 0, 0], roll: 2, want: 'to', at: 4,
    text: 'The flower squares are rosettes. Your piece is on the second square of your lane: with this 2 it can land on the rosette. Tap the piece, then the rosette.',
    done: 'Landing on a rosette earns another roll, and a piece on a rosette cannot be captured. There are three on your path: the 4th, 8th and 14th squares.',
    hint: 'Not that one: move the piece already on the board to the flower square.' },
  { title: 'Sending a piece back', pos0: [5, 0, 0, 0, 0, 0, 0], pos1: [7, 0, 0, 0, 0, 0, 0], roll: 2, want: 'to', at: 7,
    text: 'The middle lane is shared. An enemy piece stands two squares ahead of yours. Tap your middle-lane piece, then the square the enemy is on.',
    done: 'Landing on an enemy piece sends it off the board: it must start again. Captures happen only in the middle lane.',
    hint: 'Use the piece already in the middle lane to land on the enemy piece.' },
  { title: 'The safe centre', pos0: [6, 0, 0, 0, 0, 0, 0], pos1: [8, 0, 0, 0, 0, 0, 0], roll: 2, want: 'refused',
    text: 'An enemy piece sits on the central rosette. Try to capture it: tap your middle-lane piece, which would land there with this 2.',
    done: 'The central rosette is safe. Nobody can capture a piece there, or land on it while it is occupied. Holding it blocks the whole lane.',
    hint: 'Tap your piece in the middle lane: it is the one that would land on the rosette.' },
  { title: 'No stacking', pos0: [3, 5, 0, 0, 0, 0, 0], pos1: [0, 0, 0, 0, 0, 0, 0], roll: 2, want: 'refused',
    text: 'You may not land on a piece of your own colour. Tap the piece on the third square of your lane and see why it cannot move 2.',
    done: 'Blocked by your own piece. When only one move is left, you must take it; when none is left, the turn passes.',
    hint: 'Tap the piece on your third square, the one behind your own piece.' },
  { title: 'Bearing off', pos0: [13, 14, 15, 15, 15, 15, 15], pos1: [0, 0, 0, 0, 0, 0, 0], roll: 2, want: 'off',
    text: 'Pieces leave the board only with the exact roll. The piece on square 13 needs a 2, the one on 14 needs a 1. Tap the piece that can go home now.',
    done: 'Home. A piece needs the exact number to leave: a roll that is too high cannot be used by that piece.',
    hint: 'The piece on square 13 needs exactly 2: that is the one.' },
  { title: 'Taking the centre', pos0: [6, 3, 0, 0, 0, 0, 0], pos1: [5, 0, 0, 0, 0, 0, 0], roll: 2, want: 'to', at: 8,
    text: 'Three moves are possible. One takes the central rosette: safe, another roll, and a wall in the middle lane. Find it.',
    done: 'The best player is usually the one holding the centre. Lands on a rosette, takes another roll, and cannot be hit there.',
    hint: 'Move the middle-lane piece two squares onto the central flower.' },
  { title: 'The winning move', pos0: [14, 15, 15, 15, 15, 15, 15], pos1: [9, 6, 0, 0, 0, 0, 0], roll: 1, want: 'win',
    text: 'Six of your pieces are home. The last one is on your final rosette and needs a 1: bring it home and win.',
    done: 'The first player to bring all seven pieces home wins.' },
];

export function lessonGame(l) {
  return { pos: [l.pos0.slice(), l.pos1.slice()], turn: 0, roll: l.roll || -1, winner: -1, moves: 0, extra: false };
}
