// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }.
// Diagram rows: R Red piece, J Jade piece, . empty point. A diagram is a crop of the real 5x5 board: `r0` / `c0` say where its top-left
// corner sits on the board, so the lines (and the diagonals, which only run through points whose row + column is even) are the real ones.
const D = (rows, extra = {}) => ({ k: 'd', spec: { rows, ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });

export const RULES = [
  { title: 'The board and the pieces', items: [
    P('Co Ganh (Cờ gánh) is a Vietnamese game of flanking. It is played on a square of 5 by 5 points joined by lines: the straight lines of a grid, plus diagonal lines through some of the points. Each side has 8 pieces.'),
    P('Red sits at the bottom and moves first. Jade sits at the top. Each side fills its own back row and holds both corners of the next row and one point on the middle row.'),
    D(['JJJJJ', 'J...J', 'J...R', 'R...R', 'RRRRR'], { cell: 46 }),
    P('The nine points in the middle start empty. A piece never leaves the lines: it can only go where a line leads.'),
  ] },
  { title: 'How a piece moves', items: [
    P('On your turn you move one piece one step along a line to a neighbouring EMPTY point. You may not jump, you may not skip your turn, and you may not move two pieces.'),
    P('The diagonals do not run through every point. A point whose row number and column number add up to an even number (the four corners, the centre, and every other point in a chequered pattern) has diagonal lines as well as straight ones. All the other points have only the four straight lines.'),
    D(['...', '.R.', '...'], { r0: 1, c0: 1, cell: 46, marks: [[0, 0, 'dot'], [0, 1, 'dot'], [0, 2, 'dot'], [1, 0, 'dot'], [1, 2, 'dot'], [2, 0, 'dot'], [2, 1, 'dot'], [2, 2, 'dot']] }),
    P('The centre piece above stands on a point with diagonals, so it has eight steps. The piece below stands on a point without diagonals, so it has four.'),
    D(['...', '.R.', '...'], { r0: 0, c0: 1, cell: 46, marks: [[0, 1, 'dot'], [1, 0, 'dot'], [1, 2, 'dot'], [2, 1, 'dot']] }),
  ] },
  { title: 'Flanking (ganh)', items: [
    P('When you step a piece onto a point, look at every line through that point. If an enemy piece stands on each side of your piece along one line, with your piece exactly between them, both enemy pieces are flipped and become yours.'),
    D(['...', 'J.J', '.R.'], { r0: 1, c0: 1, cell: 46, arrows: [[2, 1, 1, 1]] }),
    D(['...', 'RRR', '...'], { r0: 1, c0: 1, cell: 46, marks: [[1, 0, 'flip'], [1, 2, 'flip']] }),
    P('The line can be straight or diagonal, as long as the line really exists on the board. Stepping to the centre between two enemy pieces on a diagonal flips both.'),
    D(['J..', '...', '.RJ'], { r0: 1, c0: 1, cell: 46, arrows: [[2, 1, 1, 1]] }),
    P('A flipped piece stays where it is; only its colour changes. If your step flanks on several lines at once, every flanked piece flips.'),
    P('Only the piece that has just stepped flanks. If you step between two enemy pieces yourself, nothing happens to you: you were not flanked, you walked in.'),
  ] },
  { title: 'Trapping (vay)', items: [
    P('After your step, look at every enemy group: pieces that touch along the lines form a group, and a single piece on its own is a group of one. If a group has no empty point next to any of its pieces, it cannot move, and the whole group is flipped.'),
    D(['JR.', 'R..', '.R.'], { r0: 0, c0: 0, cell: 46, arrows: [[2, 1, 1, 1]] }),
    D(['RR.', 'RR.', '...'], { r0: 0, c0: 0, cell: 46, marks: [[0, 0, 'flip']] }),
    P('A group may be big. All the pieces of a trapped group flip together, which can swing the game at once.'),
    D(['JJR', 'R..', '.R.'], { r0: 0, c0: 0, cell: 46, arrows: [[2, 1, 1, 1]] }),
    P('A group that has walked into a trap by itself is flipped on your next step, whatever you step.'),
  ] },
  { title: 'The open point (mo)', items: [
    P('If you step a piece away from a point and, as a result, your opponent can flank by stepping into the point you just left, your opponent must do it. It is not optional.'),
    D(['...', 'JJJ', '.R.'], { r0: 1, c0: 1, cell: 46, arrows: [[1, 1, 0, 1]] }),
    P('Above, Jade steps the middle piece up. Red now has to step into the gap, which flanks both Jade pieces beside it. Use this to pull the enemy where you want, and be careful not to open a gap you will regret.'),
    P('Only a step that flanks is forced. A step into the gap that would not flip anything is an ordinary move. If several of your pieces can enter, you choose which one does.'),
  ] },
  { title: 'Winning', items: [
    P('You win when every enemy piece has been flipped to your colour, or when it is your opponent’s turn and they have no legal step.'),
    P('Flips swing the count fast: a game can turn in one step. Counting what each step might flip, for both sides, is the whole game.'),
  ] },
  { title: 'Draws and quiet games', items: [
    P('If the same position, with the same side to move, appears three times, the game is a draw. The game is also a draw after 120 moves each.'),
    P('If 40 moves each go by with no flips at all, the game is settled on the spot: the side with more pieces wins, and with equal numbers it is a draw. The app tells you when 30 moves each have passed.'),
  ] },
  { title: 'In this app', items: [
    P('Tap a piece and the points it can step to light up. A gold ring marks a step that flips; the number shows how many pieces change colour. Tap a point to step, or drag the piece.'),
    P('Hint shows a good move and says why. Danger marks (in Settings) put a red mark on any of your pieces the other side could flip on its next step. Take back undoes your last move and the computer’s reply.'),
    P('Auto Play lets you watch the computer play both sides, with time to think and a pause button. Games are saved when you leave.'),
    P('Where this app simplifies: Co Ganh is played with many house rules in different places. Here the opening layout is the common 8 against 8, trapping is checked after every step, and the open point must be taken only when stepping in flanks.'),
  ] },
];

export const HOWTO = [
  { title: 'The goal', items: [
    P('Turn every enemy piece into yours. Step a piece so that an enemy piece stands on each side of it, and both change colour.'),
    D(['...', 'J.J', '.R.'], { r0: 1, c0: 1, cell: 40, arrows: [[2, 1, 1, 1]] }),
  ] },
  { title: 'Move', items: [
    P('Tap one of your pieces. The points it can step to glow. Tap a glowing point, or drag the piece there. One step along a line, no jumps.'),
    P('A gold ring means that step flips pieces, and the number tells you how many.'),
  ] },
  { title: 'Flip and trap', items: [
    P('Flank: step between two enemy pieces on a line, straight or diagonal. Trap: close the last empty point round an enemy group, and the group flips.'),
  ] },
  { title: 'Take the gap', items: [
    P('If the enemy steps away and leaves a point where you can flank, you must step in. The pieces that must are ringed. Think ahead: you can use the same rule to pull your opponent into a gap.'),
  ] },
  { title: 'Learn more', items: [
    P('Tap Learn on the main menu for six short hands-on lessons. Use Hint if you are stuck and Take back if you slip. Danger marks warn you before the other side strikes.'),
  ] },
];

export const ABOUT = [
  { title: 'Co Ganh', items: [
    P('Co Ganh (Cờ gánh, “the carrying game”) is a traditional two-player game from Vietnam, played on a small board of 5 by 5 points that anyone can draw in a minute on paper, on a table or with chalk on the ground, using stones, bottle caps or seeds as pieces.'),
    P('The rules take a minute to learn and the game is full of sudden swings: a single step can flip a whole line of pieces, or trap a group that has run out of room.'),
  ] },
  { title: 'What you get', items: [
    P('Five computer levels from Beginner to Master, two players on one phone, six hands-on lessons, Hint, danger marks, take back, and Auto Play (Watch & Learn).'),
    P('Three boards (lacquer and pearl, pavement chalk and lotus pink) and two piece styles, earned by winning. Large text, reduced motion and sound options. It works offline.'),
  ] },
  { title: 'Credits', items: [
    P('Board, pieces, sounds and the computer player were made for Arcforge. Titles are set in Fredoka (SIL Open Font License 1.1).'),
    P('Arcforge: World Heritage Games.'),
  ] },
];

// Lessons. Boards are 5 rows of 5 characters (R Red, J Jade, . empty). Red always moves.
// `goal`: { type: 'to', to } | { type: 'flip', n }; `target` rings a point on the board; `last` = the point Jade has just left.
const rowsOf = (cells) => { const rows = Array.from({ length: 5 }, () => '.....'.split('')); for (const [r, c, ch] of cells) rows[r][c] = ch; return rows.map((x) => x.join('')); };
export const LESSONS = [
  { title: 'Step along a line', board: rowsOf([[4, 2, 'R'], [0, 0, 'J'], [0, 4, 'J']]), goal: { type: 'to', to: 3 * 5 + 2 }, target: 3 * 5 + 2,
    text: 'A piece steps one point along a line onto an empty point. Tap your piece, then tap the ringed point.', done: 'Good. One step, along a line.', hint: 'Tap the red piece first, then the ringed point just ahead of it.' },
  { title: 'Diagonals', board: rowsOf([[2, 2, 'R'], [0, 0, 'J'], [0, 4, 'J']]), goal: { type: 'to', to: 1 * 5 + 1 }, target: 1 * 5 + 1,
    text: 'Diagonal lines run only through points whose row plus column is even: the corners, the centre and a chequered pattern. Step diagonally to the ringed point.', done: 'Yes. The centre has all eight lines; a point with no diagonal line has four.', hint: 'Tap the piece in the middle, then the ringed point up and to the left.' },
  { title: 'Flank two pieces', board: rowsOf([[3, 2, 'R'], [2, 1, 'J'], [2, 3, 'J'], [0, 0, 'J'], [4, 0, 'R']]), goal: { type: 'flip', n: 2 },
    text: 'Step between the two jade pieces. When your piece lands with an enemy piece on each side of it, both flip.', done: 'Two pieces flipped with one step.', hint: 'Step the piece in front of the gap up into the middle, between the jade pieces.' },
  { title: 'Flank on a diagonal', board: rowsOf([[3, 2, 'R'], [1, 1, 'J'], [3, 3, 'J'], [0, 4, 'J'], [4, 0, 'R']]), goal: { type: 'flip', n: 2 },
    text: 'A flank can run along a diagonal. Step to the centre: the jade pieces are on opposite corners of it.', done: 'The diagonal line counts like any other.', hint: 'Step the red piece up into the centre of the board.' },
  { title: 'Trap a group', board: rowsOf([[0, 0, 'J'], [0, 1, 'R'], [1, 0, 'R'], [2, 1, 'R'], [0, 4, 'J'], [4, 4, 'R']]), goal: { type: 'flip', n: 1 },
    text: 'The jade piece in the corner has one empty point beside it, diagonally. Step in there to leave it nowhere to go: it flips.', done: 'A piece (or a group) with no room to move is flipped.', hint: 'Step the red piece below up one point, onto the point that touches the corner piece on the diagonal.' },
  { title: 'The open point', board: rowsOf([[2, 1, 'J'], [2, 3, 'J'], [3, 2, 'R'], [4, 0, 'R'], [0, 4, 'J']]), goal: { type: 'flip', n: 2 }, last: 12,
    text: 'Jade has just stepped out of the middle point. Stepping into it flanks two pieces, so you must. Try another piece and see what the game says.', done: 'When the enemy opens a point you can flank into, you have to take it.', hint: 'Only the piece below the middle gap can step in. It has to.' },
];
