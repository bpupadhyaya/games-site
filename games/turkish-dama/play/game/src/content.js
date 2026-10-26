// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }.
// Diagram rows: I ivory man, i ivory king, R ruby man, r ruby king, . empty. The Ivory side starts at the bottom and moves up the board.
const D = (rows, extra = {}) => ({ k: 'd', spec: { rows, ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });
const HL = 'rgba(255,90,70,0.38)';

export const RULES = [
  { title: 'The board and the pieces', items: [
    P('Dama is the Turkish word for draughts, and "Dama oyunu" means "the dama game". It is played on a board of 8 by 8 squares, and every square is used, not only the dark ones.'),
    P('Each side has 16 men. They stand on the second and third rows from the player’s own edge, so the back row is empty at the start. Ivory sits at the bottom and moves first. Ruby sits at the top.'),
    D(['........', 'RRRRRRRR', 'RRRRRRRR', '........', '........', 'IIIIIIII', 'IIIIIIII', '........'], { cell: 34 }),
    P('A man is a plain disc. A king, which a man becomes when it is crowned, has a gold rim and a crown.'),
  ] },
  { title: 'How a man moves', items: [
    P('A man steps one square straight forward, or one square to the left or right. It never moves diagonally and it never moves backwards.'),
    D(['.....', '.....', '..I..', '.....'], { marks: [[1, 2, 'dot'], [2, 1, 'dot'], [2, 3, 'dot']], cell: 46 }),
    P('There is no passing. If you have no legal move at all, you lose the game.'),
  ] },
  { title: 'Capturing with a man', items: [
    P('A man captures by jumping. If an enemy piece stands right next to it, straight ahead or to either side, and the square just beyond that piece is empty, the man jumps over it and lands there. The jumped piece is taken off the board.'),
    D(['.....', '..R..', '..I..', '.....'], { arrows: [[2, 2, 0, 2]], hl: [[1, 2, HL]], cell: 46 }),
    D(['.....', '.....', '.IR..', '.....'], { arrows: [[2, 1, 2, 3]], hl: [[2, 2, HL]], cell: 46 }),
    P('A man never captures backwards, and never captures diagonally. Like every move in dama, a jump runs along a row or a column.'),
    P('Capturing is compulsory. If you can capture, you must: you may not make an ordinary step instead.'),
  ] },
  { title: 'Several captures in one move', items: [
    P('After a jump, the same piece must keep jumping if it can. It may turn a corner: forward, then sideways, then forward again. One whole sequence counts as one move.'),
    D(['.....', '..R..', '.R...', '.I...'], { arrows: [[3, 1, 1, 1], [1, 1, 1, 3]], hl: [[2, 1, HL], [1, 2, HL]], cell: 44 }),
    P('Captured pieces are not lifted until the whole sequence is finished. So a piece cannot be jumped twice, and a piece that has already been jumped still blocks the way.'),
  ] },
  { title: 'You must take the most', items: [
    P('In the Standard rule set, if more than one capture is possible you must choose the sequence that takes the most pieces. A sequence of three beats a sequence of two, even if it starts with a different piece.'),
    D(['.....', '.R.R.', '.IR..'], { arrows: [[2, 1, 2, 3], [2, 3, 0, 3]], hl: [[2, 2, HL], [1, 3, HL]], marks: [[0, 3, 'target']], cell: 44 }),
    P('Here Ivory could jump up over the ruby piece in front of it, but that takes only one piece. The route sideways and then up takes two, so that is the one that must be played.'),
    P('Kings count the same as men: only the number of captured pieces matters, not which pieces they are. If two sequences take the same number, you may choose either.'),
    P('The Easy capture rule set relaxes only this one rule: you must still capture, and you must still keep jumping, but you may choose any route.'),
  ] },
  { title: 'Crowning a king', items: [
    P('A man that finishes its move on the far row, the row at the opponent’s edge, is crowned and becomes a king. Ivory is crowned on the top row, Ruby on the bottom row.'),
    D(['.....', '..I..', '.....', '.....'], { arrows: [[1, 2, 0, 2]], marks: [[0, 2, 'target']], cell: 46 }),
    P('If a man reaches the far row in the middle of a capture and can jump again, it carries on as a man. It is crowned only if its move ends on that row.'),
  ] },
  { title: 'The king', items: [
    P('A king moves any number of empty squares along a row or a column, forward, backward or sideways, like a rook in chess.'),
    D(['........', '........', '...i....', '........', '........'], { marks: [[0, 3, 'dot'], [1, 3, 'dot'], [3, 3, 'dot'], [4, 3, 'dot'], [2, 0, 'dot'], [2, 1, 'dot'], [2, 2, 'dot'], [2, 4, 'dot'], [2, 5, 'dot'], [2, 6, 'dot'], [2, 7, 'dot']], cell: 36 }),
    P('A king captures from a distance. It slides over any number of empty squares, jumps over one enemy piece, and may land on any empty square beyond it, as long as nothing stands in between.'),
    D(['........', '.i..R...', '........'], { arrows: [[1, 1, 1, 6]], hl: [[1, 4, HL]], cell: 36 }),
    P('After a jump the king may turn and jump again from the square where it landed. It cannot jump over two pieces in a row, and it cannot jump over its own pieces.'),
    P('The king’s choice of landing square matters. It is often the difference between ending the move in danger and finding the next capture, and in the Standard rules the longest sequence is the one you must play.'),
  ] },
  { title: 'Winning', items: [
    P('You win when your opponent has no pieces left, or when it is your opponent’s turn and none of their pieces can move.'),
    P('With so little room, a blocked position is a real way to win: a side whose men are jammed against its own pieces or the edge of the board can run out of moves.'),
  ] },
  { title: 'Draws', items: [
    P('If the same position, with the same player to move, appears three times, the game is a draw.'),
    P('If 40 moves each go by with no capture and no man moving forward, the game is a draw. Kings shuffling about, or men stepping from side to side, do not count as progress.'),
    P('The game is also drawn after 200 moves each.'),
  ] },
  { title: 'In this app', items: [
    P('Tap a piece and the squares it may move to light up. When a capture is compulsory only the pieces that can capture are allowed to move, and the number on a ringed square is how many pieces that route takes.'),
    P('A capture of several pieces is made one jump at a time: tap the first landing square, then the next, and so on. The glowing squares always show what is still allowed.'),
    P('Hint shows a good move and says why it is good. Danger marks (in Settings) put a red mark on any of your pieces that the other side could capture on its next move. Take back undoes your last move and the computer’s reply.'),
    P('Auto Play lets you watch the computer play both sides, with time to think and a pause button. Games are saved when you leave.'),
  ] },
];

export const HOWTO = [
  { title: 'The goal', items: [
    P('Capture all of your opponent’s pieces, or leave them with no move. Men step forward and sideways; kings fly.'),
    D(['....', '.IR.', '....'], { arrows: [[1, 1, 1, 3]], hl: [[1, 2, HL]], cell: 40 }),
  ] },
  { title: 'Move', items: [
    P('Tap one of your pieces. The squares it can reach glow. A man steps one square forward or sideways, never backwards and never diagonally.'),
    P('Tap a glowing square, or drag the piece there.'),
  ] },
  { title: 'Capture', items: [
    P('Jump over an enemy piece that stands next to you, straight ahead or sideways, onto the empty square behind it. Capturing is compulsory, and you must keep jumping while you can.'),
    P('In the Standard rules you must take the route that captures the most pieces. A red ring with a number shows how many a route takes.'),
    D(['.....', '..R..', '..I..', '.....'], { cell: 40 }),
  ] },
  { title: 'Crown', items: [
    P('Reach the far row with a man and it becomes a king. A king moves and captures along a row or a column over any distance, and may also go backwards.'),
  ] },
  { title: 'Learn more', items: [
    P('Tap Learn on the main menu for short hands-on lessons. Use Hint if you are stuck and Take back if you slip. Danger marks warn you before the other side strikes.'),
  ] },
];

export const ABOUT = [
  { title: 'Turkish Dama', items: [
    P('Dama is the Turkish word for draughts, and Turkish dama (also called Turkish draughts, or "Dama oyunu") is the traditional draughts game of Turkey, played in coffee houses and at family tables, and across the lands around it. Its roots are old and its exact origins are uncertain. It is a part of the living heritage of Turkey.'),
    P('It is not the diagonal draughts or checkers you may know. Pieces move along rows and columns and use every square of the board, a capture is compulsory, and the player must take the most pieces. Kings fly the length of the board. This is its own game, with its own rules and its own tactics.'),
  ] },
  { title: 'What you get', items: [
    P('The traditional Standard rules, and an Easy capture option that lets you choose any capture route. Five computer levels from Beginner to Master, two players on one phone, seven hands-on lessons, Hint, danger marks, take back, and Auto Play (Watch & Learn).'),
    P('Three tile boards and two piece sets to earn by winning. Large text up to 300 percent, reduced motion, and sound options. It works offline.'),
  ] },
  { title: 'Credits', items: [
    P('Board, pieces, sounds and the computer player were made for Arcforge. Titles are set in Cinzel (SIL Open Font License 1.1). The board takes its look from the inlaid woodwork, glazed tile work and tulip designs of Turkish decorative arts.'),
    P('The 3D table scene is drawn with three.js (MIT licence, the three.js authors); the board, pieces, rug and tea set are built in code for this game.'),
    P('Arcforge: World Heritage Games.'),
  ] },
];

// Lessons. Boards are 8 rows of 8 characters (I ivory man, i ivory king, R ruby man, r ruby king). Ivory always moves, up the board.
// `goal`: { type: 'to', to } | { type: 'capture', n }.
const rowsOf = (cells) => { const rows = Array.from({ length: 8 }, () => '........'.split('')); for (const [r, c, ch] of cells) rows[r][c] = ch; return rows.map((x) => x.join('')); };
export const LESSONS = [
  { title: 'Step forward or sideways', variant: 'standard', board: rowsOf([[6, 3, 'I'], [1, 6, 'R']]), goal: { type: 'to', to: 5 * 8 + 3 }, target: 5 * 8 + 3,
    text: 'A man steps one square forward or to the side, never backwards. Tap your piece, then the ringed square.', done: 'Good. Men go forward or sideways, one square at a time.', hint: 'Tap your piece first, then the ringed square straight above it.' },
  { title: 'Jump to capture', variant: 'standard', board: rowsOf([[5, 3, 'I'], [4, 3, 'R'], [1, 6, 'R']]), goal: { type: 'capture', n: 1 },
    text: 'Capture the ruby piece in front of you: jump over it onto the empty square behind it.', done: 'Captured. You jump over a piece that stands next to you.', hint: 'Tap your piece, then the empty square beyond the ruby piece.' },
  { title: 'Jumping sideways', variant: 'standard', board: rowsOf([[4, 2, 'I'], [4, 3, 'R'], [1, 6, 'R']]), goal: { type: 'capture', n: 1 },
    text: 'A man can also capture to the side. Jump the ruby piece next to you.', done: 'Sideways works too, but a man never captures backwards.', hint: 'Tap your piece, then the empty square on the other side of the ruby piece.' },
  { title: 'A chain of captures', variant: 'standard', board: rowsOf([[6, 1, 'I'], [5, 1, 'R'], [4, 2, 'R'], [0, 7, 'R']]), goal: { type: 'capture', n: 2 },
    text: 'Keep jumping while you can, even round a corner. Jump up, then sideways: tap your piece, the first landing square, then the second.', done: 'Two pieces in one move. The whole chain is one turn.', hint: 'Tap your piece, then the square above the first ruby piece, then the square past the second.' },
  { title: 'Take the most', variant: 'standard', board: rowsOf([[6, 3, 'I'], [5, 3, 'R'], [6, 4, 'R'], [5, 5, 'R']]), goal: { type: 'capture', n: 2 },
    text: 'Two captures are possible, but the rules say you must take the route with the most pieces. Find it.', done: 'Right. When you can capture, you must take the longest route.', hint: 'Jump sideways first, then up. Only the route that takes two pieces is allowed.' },
  { title: 'Crown a king', variant: 'standard', board: rowsOf([[1, 4, 'I'], [6, 0, 'R']]), goal: { type: 'to', to: 4 }, target: 4,
    text: 'Reach the far row and your man is crowned. Step onto the ringed square.', done: 'A king: it moves any distance, in any of the four directions.', hint: 'Step straight up onto the ringed square.' },
  { title: 'The flying king', variant: 'standard', board: rowsOf([[4, 0, 'i'], [4, 5, 'R'], [1, 6, 'R']]), goal: { type: 'capture', n: 1 },
    text: 'A king captures from a distance. Fly along the row, jump the ruby piece and land beyond it.', done: 'A king may land on any empty square past the piece it jumps.', hint: 'Tap the king, then a glowing square beyond the ruby piece.' },
];
