// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }.
// Diagram rows: B Dark man, W Light man, M Dark Master, N Light Master, . empty.
const D = (rows, extra = {}) => ({ k: 'd', spec: { rows, ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });
const RED = 'rgba(214,41,31,0.35)';

export const RULES = [
  { title: 'The board and the pieces', items: [
    P('Kharbaga is a capturing game from North Africa, played in Algeria, Tunisia, Libya and neighbouring lands on a small square grid, often drawn in the sand or scratched on a stone. This app uses the common 5 by 5 board and 12 pieces for each side.'),
    P('Dark sits at the bottom and moves first. Light sits at the top. The first two rows of each side are full; the middle row is shared out two and two, which leaves one empty square in the very centre of the board.'),
    D(['WWWWW', 'WWWWW', 'WW.BB', 'BBBBB', 'BBBBB'], { cell: 44 }),
    P('Every piece starts as a man. A man that reaches the far side of the board is crowned and becomes a Master, drawn as a taller double stone with a lozenge cut into the top.'),
  ] },
  { title: 'How a man moves', items: [
    P('A man steps one square straight ahead, or one square sideways, onto an empty square. He never steps backwards and never moves diagonally. He cannot step onto an occupied square or pass over another piece.'),
    D(['.....', '.....', '..B..', '.....'], { marks: [[1, 2, 'dot'], [2, 1, 'dot'], [2, 3, 'dot']], cell: 46 }),
    P('You must move on your turn: there is no passing. If you have no legal move at all, you lose.'),
  ] },
  { title: 'Capturing: the jump', items: [
    P('A man captures by jumping: he leaps over an enemy piece that stands right next to him, along a row or a column, and lands on the empty square straight behind it. The jumped piece is removed.'),
    D(['.....', '..W..', '..B..', '.....'], { arrows: [[2, 2, 0, 2]], cell: 46 }),
    P('A man may jump in any of the four straight directions, backwards too. He only ever walks forward, but he can capture behind him. There are no diagonal jumps.'),
  ] },
  { title: 'Capturing is compulsory', items: [
    P('If you can capture, you must. You may not make a quiet step while any capture is open to you. If several pieces can capture, you choose which one does it, and which jump to make.'),
    P('The app marks the pieces that must capture with a ring, and says so if you try a quiet move by mistake. There is no rule to take the most pieces: any capture will do.'),
  ] },
  { title: 'Chains', items: [
    P('A capture goes on while it can: if the piece that has just landed can jump again, it must, and the whole run is one move. Each jump may turn a corner.'),
    D(['.....', '.....', 'BW.W.', '.....', '.....'], { arrows: [[2, 0, 2, 2], [2, 2, 2, 4]], cell: 44 }),
    P('Captured pieces are taken away as you jump, so a piece never has to be jumped twice.'),
  ] },
  { title: 'Becoming a Master', items: [
    P('A man that finishes a move on the far row of the board is crowned. For Dark the far row is the top row; for Light it is the bottom row.'),
    D(['.....', '..B..', '.....'], { arrows: [[1, 2, 0, 2]], cell: 46 }),
    P('If a man reaches the far row in the middle of a chain and can still jump, he carries on as a man; he is crowned only when his move ends there.'),
    P('A Master is a rook: he moves any number of empty squares along a row or a column, in all four directions, forwards or back.'),
    D(['.....', '..M..', '.....'], { marks: [[0, 2, 'dot'], [2, 2, 'dot'], [1, 0, 'dot'], [1, 1, 'dot'], [1, 3, 'dot'], [1, 4, 'dot']], cell: 46 }),
  ] },
  { title: 'How a Master captures', items: [
    P('A Master captures from a distance: he flies along a row or a column over any number of empty squares, jumps one enemy piece, and may land on any empty square beyond it, as long as nothing else is in between.'),
    D(['.....', 'M..W.', '.....'], { arrows: [[1, 0, 1, 4]], marks: [[1, 4, 'dot']], cell: 46 }),
    P('He can chain from there like any other piece, and capturing is just as compulsory for a Master. A Master can be captured by a man or a Master in the ordinary way: jumped when he stands next to an enemy man with an empty square behind him, or flown over by an enemy Master.'),
  ] },
  { title: 'Winning', items: [
    P('You win when every enemy piece has been captured, or when it is your opponent’s turn and they have no legal move.'),
    P('There is nothing else to remember: no points, no tie-break by count.'),
  ] },
  { title: 'Draws and quiet games', items: [
    P('If the same position, with the same side to move, appears three times, the game is a draw. The game is also a draw after 150 moves each.'),
    P('If 30 moves each go by with no capture, no man stepping forward and no crowning, the game is settled on the spot: the side with more strength wins (a man counts one, a Master two). With equal strength it is a draw. The app tells you when 20 moves each have passed.'),
  ] },
  { title: 'In this app', items: [
    P('Tap a piece and the squares it can reach light up. A red ring marks a move that captures; the number shows how many pieces fall in the chain. Tap a square to move, or drag the piece.'),
    P('Hint shows a good move and says why it is good. Danger marks (in Settings) put a red mark on any of your pieces the other side could capture on its next move. Take back undoes your last move and the computer’s reply.'),
    P('Auto Play lets you watch the computer play both sides, with time to think and a pause button. Games are saved when you leave.'),
    P('Where this app simplifies: Kharbaga is played on boards of several sizes and with local house rules. Here it is the 5 by 5 board with 12 pieces each, compulsory capture, backward jumps for men and a flying Master, the form that plays best on a phone.'),
  ] },
];

export const HOWTO = [
  { title: 'The goal', items: [
    P('Capture every piece of your opponent, or leave them with no move. Jump over a neighbouring enemy piece onto the empty square behind it.'),
    D(['.....', '..W..', '..B..'], { arrows: [[2, 2, 0, 2]], cell: 40 }),
  ] },
  { title: 'Move', items: [
    P('Tap one of your pieces. The squares it can reach glow. A man steps one square forward or sideways, never back. Tap a glowing square, or drag the piece there.'),
    P('A red ring means that move captures, and the number tells you how many pieces.'),
  ] },
  { title: 'You must capture', items: [
    P('If any capture is open to you, you have to take it. The pieces that can capture are ringed. Think ahead: a capture you are forced to make can open the door for your opponent.'),
  ] },
  { title: 'Crown a Master', items: [
    P('Walk a man to the far row to crown him. A Master slides like a rook and captures from far away. Protect yours, and take theirs.'),
    D(['.....', '..M..', '.....'], { cell: 40 }),
  ] },
  { title: 'Learn more', items: [
    P('Tap Learn on the main menu for six short hands-on lessons. Use Hint if you are stuck and Take back if you slip. Danger marks warn you before the other side strikes.'),
  ] },
];

export const ABOUT = [
  { title: 'Kharbaga', items: [
    P('Kharbaga is a traditional capturing game of the Maghreb, played in Algeria, Tunisia and Libya on a square board of 5 by 5 squares, scratched in the ground or carved in stone and played with pebbles, shells or clay discs.'),
    P('The rules take a minute to learn and the game is full of forced exchanges: you must capture whenever you can, so the way to win is to make your opponent’s forced captures work for you. A man that reaches the far side becomes a Master and flies along the board.'),
  ] },
  { title: 'What you get', items: [
    P('Five computer levels from Beginner to Master, two players on one phone, six hands-on lessons, Hint, danger marks, take back, and Auto Play (Watch & Learn).'),
    P('Three boards (sand, dusk and rose) and two piece styles, earned by winning. Large text, reduced motion and sound options. No ads, and it works offline.'),
  ] },
  { title: 'Credits', items: [
    P('Board, pieces, sounds and the computer player were made for Arcforge. Titles are set in Cormorant Garamond (SIL Open Font License 1.1). The 3D scene uses the shared three.js renderer (MIT licence).'),
    P('Arcforge: World Heritage Games.'),
  ] },
];

// Lessons. Boards are 5 rows of 5 characters (B Dark man, W Light man, M Dark Master, N Light Master). Dark always moves.
// `goal`: { type: 'to', to } | { type: 'capture', n }; `target` rings a square on the board.
const rowsOf = (cells) => { const rows = Array.from({ length: 5 }, () => '.....'.split('')); for (const [r, c, ch] of cells) rows[r][c] = ch; return rows.map((x) => x.join('')); };
export const LESSONS = [
  { title: 'Step forward or sideways', board: rowsOf([[3, 2, 'B'], [0, 0, 'W'], [4, 4, 'B']]), goal: { type: 'to', to: 2 * 5 + 2 }, target: 2 * 5 + 2,
    text: 'A man steps one square forward or sideways. Tap your piece, then tap the ringed square.', done: 'Good. A man never walks backwards.', hint: 'Tap the man in the middle first, then the ringed square just ahead of him.' },
  { title: 'The jump', board: rowsOf([[3, 2, 'B'], [2, 2, 'W'], [0, 4, 'W'], [4, 0, 'B']]), goal: { type: 'capture', n: 1 },
    text: 'Jump the white piece: leap over it and land on the empty square behind it.', done: 'Captured. A piece next to you with an empty square behind it can be jumped.', hint: 'Tap the man below the white piece, then the empty square beyond it.' },
  { title: 'You must capture', board: rowsOf([[3, 1, 'B'], [2, 1, 'W'], [3, 3, 'B'], [0, 4, 'W']]), goal: { type: 'capture', n: 1 },
    text: 'A capture is open to you, so you have to take it. Try stepping the other piece first and see what the game says.', done: 'When a capture is open it is compulsory. Plan for it.', hint: 'Only the piece beside the white one can move: it has to jump.' },
  { title: 'A chain', board: rowsOf([[4, 0, 'B'], [3, 0, 'W'], [2, 1, 'W'], [0, 4, 'W']]), goal: { type: 'capture', n: 2 },
    text: 'Jump up the column, then turn the corner and jump again: two pieces in one move.', done: 'Two pieces in one move. Captures go on for as long as they can.', hint: 'Tap the lower-left piece, then the far square two jumps away.' },
  { title: 'Become a Master', board: rowsOf([[1, 2, 'B'], [4, 4, 'W'], [4, 0, 'B']]), goal: { type: 'to', to: 2 }, target: 2,
    text: 'Walk the man to the far row to crown him a Master.', done: 'Crowned. A Master slides like a rook and flies over empty squares.', hint: 'Step straight ahead onto the top row.' },
  { title: 'The flying Master', board: rowsOf([[4, 0, 'M'], [4, 3, 'W'], [0, 4, 'W']]), goal: { type: 'capture', n: 1 },
    text: 'A Master captures from a distance. Fly along the row, jump the white piece and land behind it.', done: 'A Master captures at any distance, over empty squares.', hint: 'Tap the Master, then the square at the end of the row, behind the white piece.' },
];
