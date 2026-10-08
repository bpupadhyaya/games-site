// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }. Diagram rows: B black disc, W white disc, . empty.
const D = (rows, extra = {}) => ({ k: 'd', spec: { rows, ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });

export const RULES = [
  { title: 'The board and the discs', items: [
    P('Reversi is a game for two players on a square board. The standard board has 8 by 8 squares. The discs are black on one face and white on the other, so a disc can be turned over, and the whole game is about turning your opponent’s discs into yours.'),
    P('Black plays the black faces and White plays the white faces. Four discs start in the middle, two of each colour, set diagonally.'),
    D(['........', '........', '........', '...WB...', '...BW...', '........', '........', '........'], { cell: 34 }),
    P('Black always moves first. In this app you can play either side; when you play White the board is turned round so that you are still at the bottom.'),
  ] },
  { title: 'Taking turns', items: [
    P('Players take turns. On your turn you place one new disc of your colour on an empty square. You never move a disc after it is placed; it can only be flipped.'),
    P('A move is only legal if it flips at least one of your opponent’s discs. Every square that is legal for you is marked on the board while it is your turn (you can change this in Settings).'),
  ] },
  { title: 'What makes a move legal', items: [
    P('Your new disc must trap a straight line of one or more enemy discs between itself and another disc of yours that is already on the board. The line can run along a row, a column or a diagonal. This is called outflanking.'),
    D(['.......', '.BWW...', '.......'], { cell: 46, marks: [[1, 4, 'ring']], arrows: [[1, 4, 1, 3]] }),
    P('Here Black may place a disc on the ringed square: the two white discs lie in a straight line between it and the black disc, with no gap.'),
    P('The enemy discs must be unbroken. If there is an empty square, or one of your own discs, anywhere inside the line before your anchor disc, nothing is flipped in that direction. Nothing is flipped if the line runs off the edge of the board without reaching a disc of yours.'),
  ] },
  { title: 'Flipping', items: [
    P('When you place a disc, every enemy disc that is trapped in this way is flipped to your colour at once.'),
    D(['.......', '.BWW...', '.......'], { cell: 46, marks: [[1, 4, 'dot']] }),
    D(['.......', '.BBBB..', '.......'], { cell: 46 }),
    P('One disc can flip lines in several directions at once. In this position a disc on the dotted square traps a white disc to the left, one above and one on the diagonal, and all three turn.'),
    D(['B.B..', '.WW..', 'BW...'], { cell: 50, marks: [[2, 2, 'dot']] }),
    P('Only the discs trapped by the disc you just placed are flipped. Discs that were already on the board and discs that have just turned do not start new flips.'),
  ] },
  { title: 'No legal move: passing', items: [
    P('If you have no legal move, you must pass and your opponent plays again. If you do have a legal move you must play one: there is no passing by choice.'),
    P('The app passes for you automatically and tells you when it happens. A player may have to pass more than once in a game.'),
  ] },
  { title: 'The end of the game', items: [
    P('The game ends when neither player can make a legal move. This usually happens when all 64 squares are full, but a game can also end early, for example when one colour has been wiped off the board.'),
    P('Count the discs. The player with more discs of their colour wins. Equal numbers is a draw.'),
  ] },
  { title: 'Corners, edges and mobility', items: [
    P('A disc in a corner can never be flipped, because no line can pass through a corner. Corners are very valuable, and so are the discs next to them on the edge once the corner is yours.'),
    D(['......', '.B....', '......'], { cell: 44, marks: [[0, 0, 'target'], [1, 1, 'cross']] }),
    P('The squares diagonally next to a corner are dangerous: placing a disc there early often lets your opponent take the corner. The app’s hints warn you about this.'),
    P('Having more discs in the middle of the game is not always good. Usually the better plan is to keep more choices than your opponent (this is called mobility) and to make them run out of safe moves.'),
  ] },
  { title: 'Mini Reversi', items: [
    P('Mini uses a 6 by 6 board with the same four discs in the middle. Every rule above is unchanged; the game is just shorter. With 36 squares it fills in at most 32 moves.'),
    D(['......', '......', '..WB..', '..BW..', '......', '......'], { cell: 40 }),
  ] },
  { title: 'Reverse Reversi', items: [
    P('Reverse is played on the 8 by 8 board with exactly the same moves, flips and passes. Only the winner changes: when the game ends, the player with the FEWEST discs wins. Equal numbers is a draw.'),
    P('Everything feels backwards. Corners stop being a prize, because they are discs you can never lose. You want to keep few discs and force your opponent to take more.'),
  ] },
  { title: 'In this app', items: [
    P('Tap a marked square to place your disc. The flip takes a moment; each flipped disc turns over with a short sound. A small gold dot marks the disc that was just placed.'),
    P('Hint finds a good move and explains it in a sentence. You have 3 hints per game. Take back undoes your last move (and the computer’s reply). Menu saves your game so you can come back to it.'),
    P('Auto Play (Watch & Learn) shows the computer playing both sides, naming each move before it plays it. You can pause it, and set how long it thinks.'),
    P('Winning games against the computer opens extra boards and disc styles in Settings. They are cosmetic only.'),
  ] },
];

export const HOWTO = [
  { title: 'The goal', items: [
    P('Finish with more discs of your colour than your opponent. (In Reverse, finish with fewer.)'),
    D(['........', '........', '........', '...WB...', '...BW...', '........', '........', '........'], { cell: 30 }),
  ] },
  { title: 'Place a disc', items: [
    P('On your turn tap one of the marked squares. A marked square is one where your new disc traps a straight line of enemy discs against one of your own.'),
    D(['.......', '.BWW...', '.......'], { cell: 44, marks: [[1, 4, 'ring']] }),
  ] },
  { title: 'Flip', items: [
    P('Every enemy disc you trapped turns over to your colour, in every direction at once. Look for squares that flip several lines.'),
    D(['.......', '.BBBB..', '.......'], { cell: 44 }),
  ] },
  { title: 'Win', items: [
    P('When neither side can move the game is over and the discs are counted. Grab the corners: they can never be flipped. Be careful with the squares next to an empty corner.'),
  ] },
  { title: 'Learn more', items: [
    P('Tap Learn on the main menu for short hands-on lessons. Use Hint if you are stuck and Take back if you slip. Rules has every detail.'),
  ] },
];

export const ABOUT = [
  { title: 'Reversi Flip Board', items: [
    P('Reversi is a game of flipping. Two players take turns placing discs that are black on one side and white on the other, and every line of enemy discs trapped between two of yours turns over. It takes a minute to learn and a lifetime to master.'),
    P('The game was published in England in the 1880s, where it became a fashionable parlour game, and a version with a fixed starting position became hugely popular in Japan in the twentieth century. Today it is played all over the world.'),
  ] },
  { title: 'What you get', items: [
    P('Three rule sets: Classic (8 by 8), Mini (6 by 6, quick) and Reverse (fewest discs wins).'),
    P('Five computer levels from Beginner to Master, two players on one phone, hands-on lessons, Hint, legal-move marks, take back, and Auto Play (Watch & Learn).'),
    P('Three felt boards and two disc styles to earn. Large text, reduced motion and sound options. No ads, and it works offline.'),
  ] },
  { title: 'Credits', items: [
    P('Board, discs, sounds and the computer player were made for Arcforge. Titles are set in Cormorant Garamond (SIL Open Font License 1.1).'),
    P('Arcforge: World Heritage Games.'),
  ] },
];

// Lessons. Boards are 8 rows of 8 characters (B black, W white). `goal`: { type: 'to', to } | 'flips' (n) | 'win'. Black always moves.
const rowsOf = (cells) => { const rows = Array.from({ length: 8 }, () => '........'.split('')); for (const [r, c, ch] of cells) rows[r][c] = ch; return rows.map((x) => x.join('')); };
export const LESSONS = [
  { title: 'Place a disc', variant: 'classic', board: rowsOf([[3, 3, 'B'], [3, 4, 'W'], [6, 1, 'W']]), goal: { type: 'to', to: 3 * 8 + 5 }, target: 3 * 8 + 5,
    text: 'Your white neighbour sits next to your black disc. Place a disc on the other side of it, on the ringed square.', done: 'The white disc was trapped and turned black.', hint: 'Tap the ringed square, on the same row.' },
  { title: 'A whole line', variant: 'classic', board: rowsOf([[4, 1, 'B'], [4, 2, 'W'], [4, 3, 'W'], [4, 4, 'W'], [1, 6, 'W']]), goal: { type: 'flips', n: 3 },
    text: 'A line of enemy discs between two of yours flips all together. Make a move that flips all three white discs.', done: 'Three discs in one move.', hint: 'Place a disc at the end of the white line, next to the last white disc.' },
  { title: 'Several directions', variant: 'classic', board: rowsOf([[4, 2, 'B'], [4, 3, 'W'], [2, 4, 'B'], [3, 4, 'W'], [2, 2, 'B'], [3, 3, 'W']]), goal: { type: 'flips', n: 3 }, target: 4 * 8 + 4,
    text: 'One disc can flip in several directions at once. The ringed square traps white discs three ways.', done: 'Row, column and diagonal in one move.', hint: 'Tap the ringed square.' },
  { title: 'Corners are gold', variant: 'classic', board: rowsOf([[0, 1, 'W'], [0, 2, 'B'], [5, 0, 'B'], [5, 1, 'W'], [5, 2, 'W'], [5, 3, 'W']]), goal: { type: 'to', to: 0 }, target: 0,
    text: 'You could flip three discs on the left, but a corner can never be flipped. Take the corner.', done: 'A corner stays yours for the rest of the game.', hint: 'Tap the ringed corner square.' },
  { title: 'Wipe them out', variant: 'classic', board: rowsOf([[3, 2, 'B'], [3, 3, 'W'], [3, 4, 'W']]), goal: { type: 'win' }, target: 3 * 8 + 5,
    text: 'If your opponent is left with no discs, nobody can move and the game ends. Flip both white discs.', done: 'No white discs left: the game is over and you win.', hint: 'Place a disc at the end of the white line.' },
];
