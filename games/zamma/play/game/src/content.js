// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }. Diagram rows: b / w a Basalt / Limestone man,
// B / W a Sultan, . empty. `diag: 'all'` draws every diagonal, `'alq'` the alternate-point diagonals of the Grand board.
const D = (rows, extra = {}) => ({ k: 'd', spec: { rows, diag: 'all', ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });
const RED = 'rgba(214,41,31,0.38)';

// Dots along the straight and diagonal rays of a point on a 5 by 5 diagram (a Sultan's reach).
const rays = (r, c, n = 5, skip = []) => {
  const out = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    for (let k = 1; ; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= n || cc < 0 || cc >= n) break; if (!skip.some((s) => s[0] === rr && s[1] === cc)) out.push([rr, cc, 'dot']); }
  }
  return out;
};

export const RULES = [
  { title: 'The board and the stones', items: [
    P('Zamma is a traditional jumping game of the Sahara and the Maghreb, a cousin of draughts and alquerque. The stones stand on the points of a net of lines, not inside squares. The classic game is played on a 5 by 5 net, and larger nets of 7 by 7 and 9 by 9 are played too.'),
    P('Basalt (the dark stones) sits at the bottom and moves first. Limestone (the pale stones) sits at the top. Every point is filled except the centre. Each side fills its own half of the board, and on the middle row each side holds the points to the right of the centre, seen from its own seat.'),
    D(['wwwww', 'wwwww', 'ww.bb', 'bbbbb', 'bbbbb'], { cell: 40 }),
    P('The small board has 12 stones a side, the medium board 24 and the grand board 40. You can choose the board in Settings.'),
  ] },
  { title: 'How a man moves', items: [
    P('An ordinary stone is called a man. A man moves one step forward, to the next point straight ahead or to the next point diagonally ahead, along a line, onto an empty point. It never moves sideways and never moves back.'),
    D(['.....', '.....', '..b..', '.....', '.....'], { marks: [[1, 1, 'dot'], [1, 2, 'dot'], [1, 3, 'dot']], cell: 46 }),
    P('You must move on your turn: there is no passing. If you have no legal move at all, you lose the game.'),
  ] },
  { title: 'Capturing: the jump', items: [
    P('A man captures an enemy stone by jumping over it. The stone must stand right next to your man, on a line, and the point straight behind it must be empty. Your man lands on that point and the jumped stone is taken.'),
    D(['.....', '.....', '.....', '..w..', '..b..'], { arrows: [[4, 2, 2, 2]], cell: 40 }),
    P('A man may jump in any of the eight directions: forward, sideways, backward and along the diagonals. Only the step is forward only; the jump is not.'),
    D(['.....', '..b..', '..w..', '.....'], { arrows: [[1, 2, 3, 2]], cell: 40 }),
  ] },
  { title: 'Chains of jumps', items: [
    P('If your man can jump again from the point where it lands, it must keep going. One move can take many stones, in different directions, and the chain may turn at every landing.'),
    D(['.....', '...w.', '.....', '.w...', 'b....'], { arrows: [[4, 0, 2, 2], [2, 2, 0, 4]], hl: [[3, 1, RED], [1, 3, RED]], cell: 46 }),
    P('The stones you jump are lifted off only when the whole move is finished. In the meantime they still stand in the way, and the same stone cannot be jumped twice.'),
    P('A man that passes through the far row in the middle of a chain is not crowned. It is crowned only when its move ends there.'),
  ] },
  { title: 'Capturing is compulsory', items: [
    P('If you can capture, you must capture. You may not make a quiet move instead. If several captures are possible, you must choose the one that takes the most stones. If two chains take the same number, you may choose between them.'),
    P('The app helps: when you must capture, the stones that are allowed to are ringed in teal, and the others will not move. A red ring on a point shows how many stones the move takes.'),
  ] },
  { title: 'The Sultan', items: [
    P('A man that ends its move on the far row, the row at the opponent’s end of the board, is crowned and becomes a Sultan. In several Saharan traditions the promoted stone is called the Sultan; it is marked with a carved star.'),
    P('A Sultan moves along any line, in any direction, forward, sideways or back, any number of empty points.'),
    D(['.....', '.....', '..B..', '.....', '.....'], { marks: rays(2, 2), cell: 40 }),
    P('A Sultan captures from a distance: it slides over any empty points, jumps one enemy stone and may land on any empty point beyond it, if the jumped stone is followed by an empty point. Then it may continue the chain in any direction, as a man does.'),
    D(['.....', '.....', '..w..', '.....', 'B....'], { arrows: [[4, 0, 2, 2]], marks: [[1, 3, 'dot'], [0, 4, 'dot']], cell: 40 }),
    P('When a Sultan has several landing points after a jump, you choose which one. The rule that you must take the most stones applies to Sultans too.'),
  ] },
  { title: 'The grand board', items: [
    P('On the small and medium boards every point has all eight lines, so stones can step and jump along straight lines and diagonals everywhere. This is the rule the app uses for those two sizes.'),
    P('On the grand 9 by 9 board the diagonal lines run only through every second point, as on an alquerque board. A stone on a point without diagonals can move and jump only along the straight lines.'),
    D(['.....', '.....', '.....', '.....', '.bb..'], { diag: 'alq', marks: [[3, 1, 'dot'], [3, 2, 'dot'], [3, 3, 'dot']], cell: 46 }),
    P('Here the stone on the left stands on a point with no diagonals and can only step straight ahead. The stone on the right stands on a point with diagonals and has three steps.'),
  ] },
  { title: 'Winning', items: [
    P('You win when the other side has no stones left, or has stones but no legal move.'),
  ] },
  { title: 'Draws and quiet games', items: [
    P('If the same position with the same side to move appears three times, the game is a draw. The game is also drawn after 200 moves each.'),
    P('If 25 moves each go by without a capture and without a step by any man, only Sultans are shuffling about, and the game is settled on the spot: the side with the stronger army wins, where a man counts 1 and a Sultan counts 3. Equal strength is a draw.'),
  ] },
  { title: 'Differences from village play', items: [
    P('Zamma is played with local variations. This app uses these choices: captured stones are lifted at the end of the move, the 7 by 7 board uses the same lines as the 5 by 5 board, the Grand board has alternate diagonals, and the quiet-game and repetition rules above keep a computer game from going on forever.'),
  ] },
  { title: 'In this app', items: [
    P('Tap a stone and the points it can reach glow. A red ring means the move captures; the number shows how many stones. Tap a point to move, or drag the stone there. When a stone can chain jumps in more than one way, tap the landings one at a time.'),
    P('Hint shows a good move and says why it is good. Danger marks (in Settings) put a red mark on any of your stones that the other side must capture next move. Take back undoes your last move and the computer’s reply.'),
    P('Auto Play lets you watch the computer play both sides, with time to think and a pause button. Games are saved when you leave.'),
  ] },
];

export const HOWTO = [
  { title: 'The goal', items: [
    P('Capture all of the other side’s stones, or leave them with no move. You capture by jumping over a stone that stands next to yours.'),
    D(['.....', '..w..', '..b..'], { arrows: [[2, 2, 0, 2]], cell: 40 }),
  ] },
  { title: 'Move', items: [
    P('Tap one of your stones. The points it can reach glow. A man steps one point forward, straight or diagonally. Tap a glowing point, or drag the stone there.'),
  ] },
  { title: 'Capture', items: [
    P('Jump over an enemy stone that is next to yours, onto the empty point behind it. You can jump in every direction, and chain jumps. A red ring and a number show a capture.'),
    P('Capturing is compulsory, and you must take the most stones you can. Ringed stones are the ones that may move.'),
  ] },
  { title: 'Crown a Sultan', items: [
    P('Finish a move on the far row and your man becomes a Sultan. A Sultan slides any distance in any direction and captures from afar.'),
  ] },
  { title: 'Learn more', items: [
    P('Tap Learn on the main menu for short hands-on lessons. Use Hint if you are stuck and Take back if you slip. Danger marks warn you before the other side strikes.'),
  ] },
];

export const ABOUT = [
  { title: 'Zamma', items: [
    P('Zamma is a traditional jumping game of the Sahara and the Maghreb, played with carved stones on a net of lines scratched into the sand. It belongs to the draughts family: stones step forward, jump to capture, and are crowned on the far row.'),
    P('The rules take a minute to learn. The tactics take much longer: compulsory captures, the majority rule and the Sultan’s long flight make every game a puzzle of forcing moves.'),
  ] },
  { title: 'What you get', items: [
    P('Three board sizes: Small (5 by 5, the classic board), Medium (7 by 7) and Grand (9 by 9, with alquerque-style diagonals).'),
    P('Five computer levels from Beginner to Master, two players on one phone, hands-on lessons, Hint, danger marks, take back, and Auto Play (Watch & Learn).'),
    P('Three boards and two stone styles. Large text, reduced motion and sound options. It works offline.'),
  ] },
  { title: 'Credits', items: [
    P('Zamma comes from the living game traditions of the Sahara and North Africa, with players recorded in Algeria and Morocco. This version is a respectful simplification of village play, and the Rules page says exactly which choices were made.'),
    P('Board, stones, sounds and the computer player were made for Arcforge. Titles are set in Cormorant Garamond (SIL Open Font License 1.1).'),
    P('Arcforge: World Heritage Games.'),
  ] },
];

// Lessons. Boards are 5 rows of 5 characters (b Basalt man, w Limestone man, B Basalt Sultan, W Limestone Sultan). `goal`: { type: 'to', to } |
// 'capture' (n) | 'promote'. Basalt always moves. Point index = row * 5 + column.
const rowsOf = (cells) => { const rows = Array.from({ length: 5 }, () => '.....'.split('')); for (const [r, c, ch] of cells) rows[r][c] = ch; return rows.map((x) => x.join('')); };
export const LESSONS = [
  { title: 'Step forward', variant: 'small', board: rowsOf([[4, 2, 'b'], [0, 0, 'w']]), goal: { type: 'to', to: 3 * 5 + 3 }, target: 3 * 5 + 3,
    text: 'A man steps one point forward: straight on, or diagonally. Tap your stone, then the ringed point.', done: 'Good. Steps go forward only, along a line.', hint: 'Tap your stone first, then the ringed point diagonally ahead of it.' },
  { title: 'Jump to capture', variant: 'small', board: rowsOf([[4, 2, 'b'], [3, 2, 'w'], [0, 4, 'w']]), goal: { type: 'capture', n: 1 },
    text: 'Jump over the pale stone: it is next to yours and the point behind it is empty. Tap your stone, then the point beyond.', done: 'Captured. The jumped stone is taken.', hint: 'Tap your stone, then the ringed point straight beyond the pale stone.' },
  { title: 'Diagonals and chains', variant: 'small', board: rowsOf([[4, 0, 'b'], [3, 1, 'w'], [1, 3, 'w'], [0, 0, 'w']]), goal: { type: 'capture', n: 2 },
    text: 'Jumps go along diagonals too, and a chain must go on. Take both pale stones in one move.', done: 'Two stones in one move, and the man ended on the far row.', hint: 'Tap your stone, then the landing beyond the first pale stone, then the landing beyond the second.' },
  { title: 'Capturing is compulsory', variant: 'small', board: rowsOf([[4, 0, 'b'], [4, 4, 'b'], [3, 3, 'w'], [0, 0, 'w']]), goal: { type: 'capture', n: 1 },
    text: 'When you can capture, you must. Try the stone on the left: it will not move. Only the stone that can jump may move.', done: 'You must capture when you can.', hint: 'Only the ringed stone on the right can capture. Jump over the pale stone.' },
  { title: 'Take the most', variant: 'small', board: rowsOf([[4, 2, 'b'], [3, 2, 'w'], [1, 2, 'w'], [4, 4, 'b'], [3, 4, 'w']]), goal: { type: 'capture', n: 2 },
    text: 'Two captures are possible. You must take the one that captures more stones.', done: 'The longest capture is the one you have to take.', hint: 'Jump with the middle stone: it takes two pale stones.' },
  { title: 'Become a Sultan', variant: 'small', board: rowsOf([[1, 2, 'b'], [4, 4, 'w']]), goal: { type: 'promote' },
    text: 'Reach the far row and your man is crowned. Step onto the top row.', done: 'A Sultan: it slides any distance in any direction.', hint: 'Tap your stone, then any point on the top row.' },
  { title: 'The Sultan flies', variant: 'small', board: rowsOf([[4, 0, 'B'], [2, 2, 'w'], [0, 0, 'w']]), goal: { type: 'capture', n: 1 },
    text: 'A Sultan captures from a distance. Jump the pale stone in the middle and land anywhere beyond it.', done: 'A Sultan captures along the whole line.', hint: 'Tap the Sultan, then a point on the diagonal beyond the pale stone.' },
];
