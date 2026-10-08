// Text for the Rules, How to Play and About pages, plus small strings. Every statement in RULES matches rules.js / solver.js / game.js;
// the figure specs are drawn with the game's own holes and pegs (view.js drawFigure).
// Figure cells: [x, y, s] with s = 'p' peg, 'e' empty hole, 'g' golden target hole, 'x' removed peg (faded). Arrows: [x1, y1, x2, y2].
export const FIGS = {
  jumpBefore: { w: 3, h: 1, cells: [[0, 0, 'p'], [1, 0, 'p'], [2, 0, 'g']], arrows: [[0, 0, 2, 0]], cap: 'Before' },
  jumpAfter: { w: 3, h: 1, cells: [[0, 0, 'e'], [1, 0, 'x'], [2, 0, 'p']], arrows: [], cap: 'After' },
  noGap: { w: 3, h: 1, cells: [[0, 0, 'p'], [1, 0, 'e'], [2, 0, 'e']], arrows: [], cap: 'Cannot jump: nothing to jump over', bad: true },
  noFull: { w: 3, h: 1, cells: [[0, 0, 'p'], [1, 0, 'p'], [2, 0, 'p']], arrows: [], cap: 'Cannot jump: landing hole is full', bad: true },
  noDiag: { w: 3, h: 3, cells: [[0, 0, 'p'], [1, 1, 'p'], [2, 2, 'e'], [1, 0, 'e'], [2, 0, 'e'], [0, 1, 'e'], [2, 1, 'e'], [0, 2, 'e'], [1, 2, 'e']], arrows: [], cap: 'No diagonal jumps on square boards', bad: true },
  chainA: { w: 5, h: 1, cells: [[0, 0, 'p'], [1, 0, 'p'], [2, 0, 'g'], [3, 0, 'p'], [4, 0, 'g']], arrows: [[0, 0, 2, 0]], cap: 'First jump' },
  chainB: { w: 5, h: 1, cells: [[0, 0, 'e'], [1, 0, 'x'], [2, 0, 'p'], [3, 0, 'p'], [4, 0, 'g']], arrows: [[2, 0, 4, 0]], cap: 'Same peg jumps again: one move' },
  chainC: { w: 5, h: 1, cells: [[0, 0, 'e'], [1, 0, 'x'], [2, 0, 'e'], [3, 0, 'x'], [4, 0, 'p']], arrows: [], cap: 'Two jumps, counted as one move' },
  triDirs: { tri: true, rows: 3, cells: [[0, 0, 'p'], [0, 1, 'p'], [1, 1, 'g'], [0, 2, 'e'], [1, 2, 'p'], [2, 2, 'e']], arrows: [], cap: 'Triangle: along rows and both diagonals' },
};

const P = (s) => ({ t: 'p', s }), H = (s) => ({ t: 'h', s }), LI = (...items) => ({ t: 'li', items }), F = (...figs) => ({ t: 'fig', figs });

export const DOCS = {
  howto: {
    title: 'How to Play',
    pages: [
      { title: 'The aim', blocks: [
        P('Every hole on the board holds a peg except one. Jump a peg over a neighbouring peg into the empty hole straight beyond it, and the peg you jumped over is taken off the board.'),
        F('jumpBefore', 'jumpAfter'),
        P('Keep jumping until no jump is left. Leaving a single peg is the perfect finish. There is no clock: take as long as you like.'),
      ] },
      { title: 'Making a move', blocks: [
        LI('Tap a peg. It lifts, and golden holes show where it can jump. A peg with no jump gives a small shake.', 'Tap a golden hole and the peg leaps there. You can also drag the peg and let go over a golden hole.', 'If the same peg can jump again it stays lifted, so you can chain jumps. Tap an empty place to put it down.', 'Undo takes back one jump at a time, as often as you like.'),
        H('Hint and Watch'),
        P('Hint shows the next jump on a route the solver found to a single peg. Watch plays that route for you, one step at a time, with a pause button and a think-time setting. If a position cannot be finished, the solver says so and you can undo a few jumps.'),
      ] },
      { title: 'Ways to play', blocks: [
        LI('Puzzles: five boards, twelve puzzles each, from a few pegs to a crowded board. Every puzzle can be solved down to one peg.', 'Classic: a full board. You remove the first peg, then clear as many as you can. The English board can finish on one peg, and so can the French board from the right starting holes.', 'Daily: one new puzzle for everyone each day, with a streak.', 'Auto Play: sit back and watch a whole classic game solved.'),
        H('Stars'),
        P('One peg left earns three stars, two pegs earn two, three or four pegs earn one. Using a hint keeps a perfect finish at two stars. One star or more clears a puzzle and opens the next.'),
      ] },
      { title: 'Tips', blocks: [
        LI('Look for the empty hole first, then for the pegs that can reach it.', 'Try to keep your pegs in a connected group. A lonely peg with no neighbour can never jump or be jumped.', 'Pegs on the rim and in the corners are hard to remove: bring them toward the middle early.', 'Decide where the last peg should finish and work backwards from there.', 'Stuck? Undo a few jumps and try the other order. Order matters more than anything.'),
      ] },
    ],
  },
  rules: {
    title: 'Rules',
    pages: [
      { title: 'The boards', blocks: [
        P('Peg Solitaire is played on a board of holes. Each hole holds one peg or is empty. This game has five boards:'),
        LI('Triangle: 15 holes in five rows.', 'English: 33 holes in a cross. The cross most people know.', 'French (European): 37 holes, the English cross with four extra corner holes.', 'Diamond: 41 holes in a diamond.', 'Grand Cross: 45 holes in a larger cross.'),
        P('In Classic play every hole starts full and you take away one peg to begin. In a puzzle, the starting pegs are set out for you and every other hole is empty.'),
      ] },
      { title: 'The jump', blocks: [
        P('A move is a jump. A peg leaps in a straight line over one peg that is right next to it and lands in the empty hole directly beyond. The peg that was jumped over is removed.'),
        F('jumpBefore', 'jumpAfter'),
        LI('You must jump over exactly one peg, and it must be adjacent.', 'The landing hole must be on the board and empty.', 'Jumps may go in any straight direction, backwards as well as forwards.', 'You cannot slide a peg into a hole without jumping, and you cannot jump over an empty hole.'),
        F('noGap', 'noFull'),
      ] },
      { title: 'Directions', blocks: [
        P('On the English, French, Diamond and Grand Cross boards the pegs jump along rows and columns only: up, down, left and right. Diagonal jumps are not allowed.'),
        F('noDiag'),
        P('On the Triangle board the holes are joined along rows and along both diagonals, so a peg can jump in six directions.'),
        F('triDirs'),
      ] },
      { title: 'Chains and moves', blocks: [
        P('If a peg lands where it can jump again, you may jump it again straight away. In this game consecutive jumps by the same peg are counted as one move. A jump by a different peg starts a new move.'),
        F('chainA', 'chainB'),
        F('chainC'),
        P('The move counter and each puzzle\'s par use this way of counting. Undo takes back one jump at a time.'),
      ] },
      { title: 'How a game ends', blocks: [
        P('A game ends when no peg on the board can make a jump. The pegs still on the board are your score: fewer is better.'),
        LI('One peg: a perfect finish. In Classic play, if that last peg sits in the hole you first emptied, it is called out as a finish in the starting hole.', 'More than one peg: no further jump exists. Undo to try again, or start over.'),
        P('There is no turn limit and no clock. A puzzle is cleared when you reach one star or more.'),
      ] },
      { title: 'Stars and ratings', blocks: [
        LI('One peg left: three stars.', 'Two pegs left: two stars.', 'Three or four pegs left: one star.', 'Five or more: no stars. The puzzle is not cleared yet.'),
        P('If you asked for a hint during the puzzle, a one-peg finish earns two stars instead of three. Undo does not cost stars. Watching Auto Play never changes your stars.'),
        P('Classic play rates the finish by pegs left: one peg is Master, two Expert, three Skilled, four Fair, and more is practice. Your best result for each board is kept.'),
      ] },
      { title: 'Puzzles, par and the daily', blocks: [
        P('Puzzles are made by playing a game backwards from a single peg, so each one is guaranteed to have a way down to one peg. The par shown for a puzzle is the true fewest number of moves, found by an exhaustive search and counting a chain as one move.'),
        P('The Daily puzzle is built from the date, so everyone gets the same one. Solving it down to one peg extends your streak. Missing a day starts the streak again.'),
        P('Hint and Watch use the same solver. On the classic English, French and Triangle starts they follow the shortest route known to the game (English: 18 moves; Triangle: 11; French from the marked start: 21 moves, the shortest the search found) while you stay on it. From other positions they search for a route to one peg, and look for the shortest one when few pegs are left. If no route exists, they say so instead of guessing.'),
      ] },
      { title: 'What is known about the boards', blocks: [
        LI('English board: starting with the centre hole empty, a single peg can be left. The shortest known solution takes 18 moves when chains count as one, and finishes in the centre.', 'French board: with the centre hole empty it is impossible to finish on one peg using row and column jumps. Starting from other holes it can be done. This game suggests a starting hole that works.', 'Triangle board: starting from the middle hole it can be solved down to one peg.', 'Diamond and Grand Cross: Classic play there is a challenge. It is not promised that one peg is possible from every start, so aim for as few as you can.'),
        P('On the large boards from crowded positions the solver only promises a route to one peg, not the shortest one.'),
      ] },
    ],
  },
  about: {
    title: 'About',
    pages: [
      { title: 'Peg Solitaire', blocks: [
        P('Peg Solitaire is a game for one player, played for more than three hundred years. You jump pegs over their neighbours and clear the board until only one is left. The rules fit in a sentence; the thinking can fill an evening.'),
        P('This version has five boards, sixty curated puzzles, a daily puzzle, undo, hints from a solver and an Auto Play mode that shows a full solution. The board is turned wood, the pegs are glass or boxwood, and there is no clock.'),
        H('Quiet, focused play'),
        P('One decision at a time, nothing flashing, nothing chasing you. A game that rewards looking carefully and planning a few jumps ahead.'),
      ] },
      { title: 'A game of the French court', blocks: [
        P('The first printed account of the game is French. Rules for it appeared in the Mercure galant in 1697, when it was a fashion at the court of Louis XIV. A well-known engraving by Claude Auguste Berey shows the Princess de Soubise with a solitaire board.'),
        P('The philosopher and mathematician Gottfried Leibniz wrote about it in 1710, and mathematicians have studied it since. The round board with 37 holes became the standard in France and across Europe, while the 33-hole cross became the usual board in English-speaking countries. It is also known simply as Solitaire.'),
        P('Many legends place its invention in a prison cell or in faraway lands. None is proven. What is certain is that it spread across Europe and the world as a pocket puzzle.'),
      ] },
      { title: 'Credits', blocks: [
        P('Made by Arcforge, a collection of heritage games from around the world.'),
        P('The titles use Cormorant Garamond (SIL Open Font License 1.1). Board, pegs and sounds are drawn and synthesised in the game itself.'),
        P('Your progress is saved on this device only.'),
      ] },
    ],
  },
};

export const LABELS = ['', 'Master', 'Expert', 'Skilled', 'Fair'];
export const labelFor = (left) => (left >= 1 && left <= 4 ? LABELS[left] : left === 0 ? '' : 'Keep practising');
export const START_NOTE = {
  triangle: 'Start from the centre hole to reach one peg.',
  english: 'The centre start can reach one peg.',
  french: 'The ringed start can reach one peg; the centre cannot.',
  diamond: 'A challenge board: aim for as few pegs as you can.',
  cross: 'A challenge board: aim for as few pegs as you can.',
};
// recommended first hole to empty on each Classic board (index into the board's holes): the centre, except French where the centre cannot be solved
export const CLASSIC_START = { triangle: 4, english: 16, french: 5, diamond: 20, cross: 22 };
