// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }. Diagram rows: B black piece, W white piece, . empty.
const D = (rows, extra = {}) => ({ k: 'd', spec: { rows, ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });

export const RULES = [
  { title: 'The board and the pieces', items: [
    P('Hasami shogi means "sandwich chess": hasami is Japanese for sandwich, and shogi is Japanese chess. It is played on a board of 9 by 9 squares, the same board that is used for shogi, but the game is completely different.'),
    P('Black sits at the bottom and moves first. White sits at the top. In Classic and Quick play each side has 9 pieces, all on its own back row. In Dai play each side has 18 pieces, filling its two back rows.'),
    D(['WWWWWWWWW', '.........', '.........', '.........', '.........', '.........', '.........', '.........', 'BBBBBBBBB'], { cell: 34 }),
    P('Black pieces show the letter B and White pieces show W. (In Settings you can switch to the traditional shogi characters, the pawn mark on Black and the promoted-pawn mark on White.) Every piece is the same kind: there is no king and nothing to promote.'),
  ] },
  { title: 'How a piece moves', items: [
    P('Every piece moves like a rook in chess: any number of empty squares in a straight line along its row or its column.'),
    D(['.....', '..W..', '.....', '..B..', '.....'], { marks: [[0, 2, 'dot'], [2, 2, 'dot'], [3, 0, 'dot'], [3, 1, 'dot'], [3, 3, 'dot'], [3, 4, 'dot'], [4, 2, 'dot'], [2, 2, 'dot']], cell: 46 }),
    P('A piece may not move diagonally, may not land on a square that is taken, and may not pass over another piece. In Classic and Quick play there is no jumping at all.'),
    P('You must move on your turn: there is no passing. If you have no legal move at all, you lose the game.'),
  ] },
  { title: 'Capturing: the sandwich', items: [
    P('You capture an enemy piece by sandwiching it: it must stand between two of your pieces, side by side on a row or one above the other on a column.'),
    D(['...B...', '...W...', 'B......'], { arrows: [[2, 0, 2, 3]], cell: 40 }),
    D(['.......', '.BWB...', '.......'], { hl: [[1, 2, 'rgba(214,41,31,0.35)']], cell: 40 }),
    P('The capture happens when you move: the piece you have just moved must be one of the two jaws of the sandwich. The captured piece is taken off the board.'),
  ] },
  { title: 'Moving into a sandwich is safe', items: [
    P('A piece may move into the gap between two enemy pieces. It is not captured. Captures are made only by the player who has just moved.'),
    D(['.......', '.W.B.W.', '.......', '...B...'], { arrows: [[3, 3, 1, 3]], cell: 40 }),
    P('If an enemy piece later leaves and comes back, or one jaw is moved away and another piece takes its place, the sandwich can be made again with a fresh move.'),
  ] },
  { title: 'Capturing several pieces at once', items: [
    P('If a whole unbroken line of enemy pieces stands between two of your pieces, the whole line is captured together.'),
    D(['.......', 'BWWWB..', '.......'], { hl: [[1, 1, 'rgba(214,41,31,0.35)'], [1, 2, 'rgba(214,41,31,0.35)'], [1, 3, 'rgba(214,41,31,0.35)']], cell: 40 }),
    P('The line must be all enemy pieces with no gap and none of your own inside it. A line that has one of your pieces in the middle is not captured.'),
    P('One move can capture in several directions at once: along the row, up the column and down the column, wherever the piece you moved closes a sandwich.'),
    D(['..B..', '..W..', 'BW.WB', '..W..', '..B..'], { marks: [[2, 2, 'target']], cell: 40 }),
    P('Here a piece landing on the ringed square would capture all four pieces around it at once.'),
  ] },
  { title: 'The edge of the board', items: [
    P('The edge of the board is not a jaw. A piece that stands on the edge cannot be sandwiched against it, and a line of enemy pieces that runs to the edge is not captured.'),
    D(['WWWB.', '.....', '.....'], { cell: 40 }),
    P('The four corners are the one exception, see the next section.'),
  ] },
  { title: 'Capturing in a corner', items: [
    P('A piece in a corner of the board is captured when both squares next to it are held by your pieces, and one of them is the piece you have just moved there.'),
    D(['W.B..', 'B....', '.....', '.....'], { hl: [[0, 0, 'rgba(214,41,31,0.35)']], cell: 46 }),
    P('The corner rule is the only way to capture a piece that stands on the very edge of the board.'),
  ] },
  { title: 'Winning: Classic', items: [
    P('Classic Hasami Shogi: you win when only one piece of your opponent is left. In other words, capture 8 of the 9.'),
    P('This is the standard form of the game and the default in this app.'),
  ] },
  { title: 'Winning: Quick', items: [
    P('Quick Hasami Shogi uses the same board, pieces and captures, and a shorter goal: the first player to capture 5 pieces wins.'),
  ] },
  { title: 'Dai Hasami Shogi', items: [
    P('Dai Hasami Shogi (dai means "large") starts with 18 pieces each: your two back rows are full.'),
    P('There is one extra move. A piece may jump over a single piece standing right next to it, of either colour, and land on the empty square straight behind it. A jump is one whole move: nothing is captured by being jumped over, only one jump is allowed per move, and a piece cannot jump a gap.'),
    D(['.....', '.BW..', '.....'], { arrows: [[1, 1, 1, 3]], cell: 46 }),
    P('The piece that has jumped captures as usual from the square where it lands.'),
  ] },
  { title: 'Winning: five in a row', items: [
    P('In Dai play you win by making an unbroken line of five of your own pieces, side by side along a row or one above another down a column.'),
    P('Your line may not use your own two starting rows. Black’s line must lie in the seven rows above Black’s two home rows; White’s in the seven rows below White’s. So a row of five along your own back row does not count.'),
    D(['.....', 'BBBBB', '.....'], { cell: 46 }),
    P('Captured pieces still matter: a player left with fewer than five pieces can no longer make a line, so that player loses.'),
  ] },
  { title: 'Draws', items: [
    P('If the same position, with the same player to move, appears three times, the game is a draw.'),
    P('The game is also drawn after 200 moves each.'),
  ] },
  { title: 'Quiet games (Classic and Quick)', items: [
    P('If 30 moves each go by without a single capture, the game is settled on the spot: the side with more pieces left wins. With equal pieces it is a draw.'),
    P('The app tells you when 20 moves each have passed without a capture. Any capture starts the count again. Dai play has no such rule: the aim there is the line of five.'),
  ] },
  { title: 'In this app', items: [
    P('Tap a piece and its legal squares light up. A square ringed in red means the move captures; the number shows how many pieces. Tap a square to move, or drag the piece.'),
    P('Hint shows a good move and says why it is good. Danger marks (in Settings) put a red mark on any of your pieces that the other side could capture on its next move. Take back undoes your last move and the computer’s reply.'),
    P('Auto Play lets you watch the computer play both sides, with time to think and a pause button. Games are saved when you leave.'),
  ] },
];

export const HOWTO = [
  { title: 'The goal', items: [
    P('Capture your opponent’s pieces by sandwiching them between two of yours. In Classic play, leave your opponent with just one piece.'),
    D(['.......', '.BWB...'], { hl: [[1, 2, 'rgba(214,41,31,0.35)']], cell: 40 }),
  ] },
  { title: 'Move', items: [
    P('Tap one of your pieces. The squares it can reach glow. Every piece slides like a rook, as far as you like along a row or column.'),
    P('Tap a glowing square, or drag the piece there. A red ring means that move captures, and the number tells you how many pieces.'),
  ] },
  { title: 'Capture', items: [
    P('Put a piece on the far side of an enemy piece that already has one of yours on its other side. It is removed. A whole line of enemy pieces can go at once.'),
    P('You are safe if you step into a sandwich yourself: only the player who has just moved can capture.'),
    D(['..B....', '..W....', '.......', '.......'], { cell: 40 }),
  ] },
  { title: 'Win', items: [
    P('Classic: only one enemy piece left. Quick: capture 5. Dai: make a line of five of your own, outside your two home rows, and jump pieces to get there.'),
  ] },
  { title: 'Learn more', items: [
    P('Tap Learn on the main menu for short hands-on lessons. Use Hint if you are stuck and Take back if you slip. Danger marks warn you before the other side strikes.'),
  ] },
];

export const ABOUT = [
  { title: 'Hasami Shogi: Pairs', items: [
    P('Hasami shogi (hasami means sandwich, shogi means Japanese chess) is a traditional Japanese board game, often played on a shogi board. Every piece moves like a rook and the whole game is about sandwiches: trap an enemy piece between two of yours and it is gone.'),
    P('The rules take a minute to learn. The tactics take much longer. Threats, double threats and the safe step into a sandwich make every game different.'),
  ] },
  { title: 'What you get', items: [
    P('Three rule sets: Classic (the standard game), Quick (first to five captures) and Dai ("large") with jumping and five in a row.'),
    P('Five computer levels from Beginner to Master, two players on one phone, hands-on lessons, Hint, danger marks, take back, and Auto Play (Watch & Learn).'),
    P('Three board woods and two piece styles. Large text, reduced motion and sound options. No ads, and it works offline.'),
  ] },
  { title: 'Credits', items: [
    P('Board, pieces, sounds and the computer player were made for Arcforge. Titles are set in Cormorant Garamond (SIL Open Font License 1.1). Kaya, the first board, is named for a pale Japanese wood traditionally used for game boards.'),
    P('Arcforge: World Heritage Games.'),
  ] },
];

// Lessons. Boards are 9 rows of 9 characters (B black, W white). `goal`: { type: 'to', to } | 'capture' (n) | 'jump' | 'win'. Black always moves.
const rowsOf = (cells) => { const rows = Array.from({ length: 9 }, () => '.........'.split('')); for (const [r, c, ch] of cells) rows[r][c] = ch; return rows.map((x) => x.join('')); };
export const LESSONS = [
  { title: 'Slide like a rook', variant: 'classic', board: rowsOf([[6, 3, 'B'], [1, 6, 'W']]), goal: { type: 'to', to: 6 * 9 + 7 }, target: 6 * 9 + 7,
    text: 'Every piece slides like a rook. Tap your piece, then tap the ringed square.', done: 'Good. Pieces slide as far as the row or column is open.', hint: 'Tap your piece first, then the ringed square on the same row.' },
  { title: 'The sandwich', variant: 'classic', board: rowsOf([[4, 5, 'W'], [4, 6, 'B'], [8, 4, 'B'], [0, 0, 'W']]), goal: { type: 'capture', n: 1 },
    text: 'Capture the white piece: it has your piece on one side. Slide your other piece to its other side.', done: 'Captured. A piece between two of yours is taken.', hint: 'Move the bottom piece up the column to the square beside the white piece.' },
  { title: 'A whole line', variant: 'classic', board: rowsOf([[3, 3, 'W'], [3, 4, 'W'], [3, 5, 'W'], [3, 2, 'B'], [8, 6, 'B']]), goal: { type: 'capture', n: 3 },
    text: 'A line of enemy pieces between two of yours is captured together. Take all three.', done: 'Three pieces in one move.', hint: 'Slide the bottom piece up its column to close the line.' },
  { title: 'Up and down too', variant: 'classic', board: rowsOf([[4, 4, 'W'], [2, 4, 'B'], [5, 0, 'B'], [8, 8, 'W']]), goal: { type: 'capture', n: 1 },
    text: 'Sandwiches work on columns as well as rows. Capture the white piece.', done: 'Rows and columns both work.', hint: 'Slide the left piece along its row to the square below the white piece.' },
  { title: 'The corner', variant: 'classic', board: rowsOf([[0, 0, 'W'], [1, 0, 'B'], [4, 1, 'B'], [8, 8, 'W']]), goal: { type: 'capture', n: 1 },
    text: 'A piece in a corner is captured by holding both squares beside it. One is already yours.', done: 'The corner rule is the only way to take a piece on the edge.', hint: 'Slide the other piece up its column to the square beside the corner.' },
  { title: 'Safe in the gap', variant: 'classic', board: rowsOf([[4, 3, 'W'], [4, 5, 'W'], [8, 4, 'B'], [0, 8, 'W']]), goal: { type: 'to', to: 4 * 9 + 4 }, target: 4 * 9 + 4,
    text: 'Step between the two white pieces. You are safe: only the player who has just moved can capture.', done: 'Safe. Walking into a sandwich is allowed and harmless.', hint: 'Slide the piece up its column to the ringed square.' },
  { title: 'Dai: jumping', variant: 'dai', board: rowsOf([[4, 4, 'B'], [4, 5, 'W'], [0, 0, 'W'], [8, 8, 'B']]), goal: { type: 'jump' },
    text: 'In Dai play a piece may jump one neighbouring piece and land right behind it. Jump the white piece.', done: 'Nothing is captured by a jump; it is just a move.', hint: 'Tap the piece next to the white one, then the empty square behind it.' },
  { title: 'Dai: five in a row', variant: 'dai', board: rowsOf([[3, 0, 'B'], [3, 1, 'B'], [3, 2, 'B'], [3, 3, 'B'], [7, 4, 'B'], [0, 8, 'W']]), goal: { type: 'win' },
    text: 'Make five in a row outside your two home rows. One slide finishes it.', done: 'Five in a row wins Dai Hasami Shogi.', hint: 'Slide the lower piece up its column next to the line of four.' },
];
