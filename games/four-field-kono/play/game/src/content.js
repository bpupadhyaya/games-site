// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }.
// Diagram rows: J a Jade stone, E an Ember stone, j / e a faint "was here" stone, . an empty point. Arrows: [row, col, row, col, 'step' | 'jump'].
const D = (rows, extra = {}) => ({ k: 'd', spec: { rows, ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });

export const RULES = [
  { title: 'The board and the stones', items: [
    P('Kono is a family of old Korean folk games played with a handful of small stones on a board of crossing lines. The board is described by its fields: a field is one square of the grid. Four-Field Kono has four fields along each side, which makes five lines each way and 5 by 5 = 25 points. The stones stand on the points where the lines cross, not inside the squares.'),
    P('Jade is the pale green stone with a ring engraved on it. Ember is the deep orange stone with a diamond engraved on it. Jade sits at the bottom of the board and Ember at the top.'),
    D(['EEEEE', '.EEE.', '.....', '.JJJ.', 'JJJJJ'], { cell: 40 }),
    P('On the Four-Field board each side has 8 stones: its whole back row of five, and the three middle points of the row in front. On the Six-Field board (7 by 7 points) each side has 12 stones in the same pattern: the back row of seven and the five middle points of the next row. On the Two-Field board (3 by 3 points) each side has the three stones of its back row.'),
    P('Every stone is the same kind. There is no king, nothing to promote and no stone that is worth more than another.'),
  ] },
  { title: 'Who moves first', items: [
    P('Jade moves first on the Four-Field and Six-Field boards. The players then take turns, one move each. You may not pass.'),
    P('On the tiny Two-Field board the side that moves first is at a disadvantage, so Ember moves first there and Jade replies. Everything else is the same.'),
  ] },
  { title: 'Moving: one step forward', items: [
    P('On its turn a stone may step one point straight ahead onto an empty point. For Jade ahead is up the board, for Ember it is down the board.'),
    D(['.....', '.....', '..j..', '..J..', '.....'], { arrows: [[3, 2, 2, 2, 'step']], cell: 44 }),
    P('A stone never steps sideways, never steps back and never steps diagonally. A step needs an empty point: stones cannot move onto a taken point and cannot pass over a stone by stepping.'),
    P('Because steps only go forward, no game can go on for ever: every game ends with a winner. A draw is not possible.'),
  ] },
  { title: 'Capturing: the jump', items: [
    P('Instead of stepping, a stone may jump. If an enemy stone stands on the point right beside yours, and the point straight behind it (on the same line) is empty, you may jump over it and land on that empty point. The enemy stone is taken off the board.'),
    D(['..j..', '..E..', '..J..'], { cell: 44, arrows: [[2, 2, 0, 2, 'jump']] }),
    P('A jump may go in any of the four directions: forward, sideways or even backward. A stone that has only ever been allowed to step forward can still jump back and take a stone that has slipped past it.'),
    D(['.....', '.JEj.', '.....'], { cell: 44, arrows: [[1, 1, 1, 3, 'jump']] }),
    P('You can only jump a single stone at a time, and only an enemy stone. You cannot jump your own stones. You cannot jump a stone if the point behind it is taken (by either side) or if it is off the edge of the board, so a stone is safe when something stands right behind it, and a stone on the edge cannot be jumped towards the edge.'),
    D(['..E..', '..E..', '..J..'], { cell: 44, cross: [[1, 2]] }),
    P('A jump is optional. You may choose a step even when a jump is available. (The stone next to a jump you did not take can be jumped by the other side, so look before you decline.)'),
  ] },
  { title: 'Chains of jumps', items: [
    P('If your stone lands after a jump and can jump again straight away, in any direction, it may carry on in the same move. This is called a chain. Every stone jumped is taken, and you may stop after any jump in the chain.'),
    D(['..j..', '..E..', '.....', '..E..', '..J..'], { cell: 40, arrows: [[4, 2, 2, 2, 'jump'], [2, 2, 0, 2, 'jump']] }),
    P('A chain can turn corners: jump up, then sideways, then up again. The stones are taken one by one as the chain goes along, so a jumped point becomes empty and can be used as a landing point later in the same chain.'),
    P('On the board you tap the stone, then the point where you want it to end. The glowing points include every point a chain can reach, and the small red number tells you how many stones you will take.'),
  ] },
  { title: 'Winning and losing', items: [
    P('You win by capturing every stone the other side has, or by leaving the other side with no legal move on its turn. A side that cannot step or jump loses at once.'),
    D(['.....', '.....', '.....', '.E...', '.J...'], { cell: 40, cross: [[3, 1]] }),
    P('In the position above Ember has one stone, and it is blocked by the Jade stone in front. It cannot step, and it cannot jump (the point behind is off the board). If it is Ember to move, Ember loses.'),
    P('The result also ends the game at once if you take the last stone. There is no scoring, no time limit and no draw.'),
  ] },
  { title: 'Reading the board', items: [
    P('Tap one of your stones and it lifts. Every point it can reach glows. A red ring means the move takes a stone, and the number says how many.'),
    P('Danger marks (on by default, an option in Settings) put a small red mark on your stones that the other side could take on its next move.'),
    P('A coloured wash along one edge of the board shows each side\'s home row. Points are named like a chess board: a to e along the bottom, 1 to 5 up the side (a to g and 1 to 7 on the Six-Field board).'),
  ] },
  { title: 'Differences from village play', items: [
    P('Kono was played from village to village with stones on lines scratched on the ground, and the rules were not written down in one place, so players differed on details. The version in this app is one clear, simple set of rules: forward-only steps, jumps in every direction, optional chains, and a win by capture or by leaving the other side without a move.'),
    P('The three board sizes (two, four and six fields) belong to the same family. The extra boards here use the same rules on a smaller or larger grid.'),
  ] },
];

export const HOWTO = [
  { title: 'Quick start', items: [
    P('Tap a stone of yours. It lifts and the points it can reach glow. Tap a glowing point, or drag the stone there.'),
    P('A step moves one point straight forward. A jump goes over an enemy stone that stands right beside yours and lands on the empty point behind it. The jumped stone is taken.'),
    P('Capture every enemy stone, or leave the other side with no move, to win.'),
  ] },
  { title: 'Helpful things', items: [
    P('Hint finds a good move for you and says what it does. You have three hints in each game.'),
    P('Danger marks show which of your stones can be taken next move.'),
    P('Take back undoes your last move (and the computer\'s reply).'),
    P('Learn to play is a set of short hands-on lessons.'),
    P('Auto Play lets you watch the computer play both sides. It shows the move it is thinking about before it plays it, and it has a Pause button.'),
  ] },
  { title: 'Three boards, five levels', items: [
    P('Choose Two-Field, Four-Field or Six-Field in Settings. Four-Field is the classic game.'),
    P('Five computer levels run from Beginner to Master. You can play Jade or Ember, or pass the phone and play a friend.'),
  ] },
];

export const ABOUT = [
  { title: 'About this game', items: [
    P('Kono (also written gonu) is a family of traditional Korean board games for two, played with a few stones on a board of crossing lines. The versions are named for the number of fields on the board: two-field, four-field, six-field and more. They have been played by children and adults, on boards drawn on the ground, on paper or on wood.'),
    P('The four-field board was written down by the American collector Stewart Culin, who described Korean games in the 1890s, and the game stayed a familiar part of school and village life long after. It is a quick game: a few minutes for a full game, and a lot of thinking inside those minutes.'),
    P('This is a new Arcforge version with a painted paper board, a computer opponent with five levels, lessons, hints and an Auto Play mode. The rules here are one clear modern set; village rules differed in the small details (see Rules, "Differences from village play").'),
  ] },
  { title: 'Credits', items: [
    P('Tradition: Korean folk game. Board, stones, sound and software: Arcforge. Display font Fredoka (SIL Open Font License 1.1). 3D scene: three.js (MIT licence), models and materials built by Arcforge.'),
  ] },
];

// Lesson boards are 5 by 5 points (Four-Field), rows from the top; goal types: to (reach a point), capture (n stones in one move), win.
const rowsOf = (rows) => rows.map((r) => r.padEnd(5, '.'));
const at = (r, c) => r * 5 + c;
export const LESSONS = [
  { title: 'One step forward', variant: 'four', board: rowsOf(['E....', '.....', '.....', '..J..', '.....']), goal: { type: 'to', to: at(2, 2) }, target: at(2, 2),
    text: 'A stone steps one point straight ahead. Jade goes up the board. Tap your stone, then the ringed point.', done: 'Good. A stone never steps sideways or back.', hint: 'Tap the Jade stone, then the ringed point right above it.' },
  { title: 'The jump', variant: 'four', board: rowsOf(['E....', '.....', '..E..', '..J..', '.....']), goal: { type: 'capture', n: 1 },
    text: 'An enemy stone stands right beside yours and the point behind it is empty. Jump over it to take it.', done: 'Taken. The stone jumps over and lands on the empty point behind.', hint: 'Tap your stone, then the empty point just beyond the Ember stone.' },
  { title: 'Sideways jump', variant: 'four', board: rowsOf(['E....', '.....', '.JE..', '.....', '....J']), goal: { type: 'capture', n: 1 },
    text: 'Stones step only forward, but a jump can go any way. Jump the Ember stone sideways.', done: 'A jump can go sideways, and backward too.', hint: 'Tap the Jade stone in the middle row, then the empty point on the far side of the Ember stone.' },
  { title: 'Jumping back', variant: 'four', board: rowsOf(['E....', '..J..', '..E..', '.....', '....J']), goal: { type: 'capture', n: 1 },
    text: 'The Ember stone has slipped past your stone. A jump can go backward: take it.', done: 'A stone that has passed on is still in danger from behind.', hint: 'Tap the Jade stone near the top, then the point below the Ember stone.' },
  { title: 'A chain', variant: 'four', board: rowsOf(['.....', '..E..', '.....', '..E..', '..J..']), goal: { type: 'capture', n: 2 },
    text: 'After a jump your stone can jump again in the same move. Take both Ember stones.', done: 'Two stones in one move. A chain goes on as long as there is a stone to jump.', hint: 'Tap your stone, then the empty point at the top of the column: it jumps twice.' },
  { title: 'Blocked means beaten', variant: 'four', board: rowsOf(['.....', '.....', '...J.', 'E....', 'J....']), goal: { type: 'win' },
    text: 'The Ember stone is blocked by the Jade stone below it and has nowhere to go. A side with no move loses. Make a move.', done: 'Ember has no move left, so Jade wins.', hint: 'Step the stone on the right one point up. Ember is stuck.' },
  { title: 'The last stone', variant: 'four', board: rowsOf(['.....', '.E...', '.J...', '.....', '.....']), goal: { type: 'win' },
    text: 'Only one Ember stone is left. Jump it and the game is won.', done: 'Every enemy stone is taken. That wins.', hint: 'Tap your stone, then the empty point beyond the Ember stone.' },
];
