// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }. Diagram rows: 1 Blue peg, 2 Red peg, 3 Green, 4 Gold, . empty.
import { geo, newGame } from './rules.js';
const D = (rows, extra = {}) => ({ k: 'd', spec: { rows, ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });
const QK = geo('quick');
const START_ROWS = (() => { const g = newGame('quick'); return Array.from({ length: 10 }, (_, r) => g.board.slice(r * 10, r * 10 + 10).map((v) => (v ? String(v) : '.')).join('')); })();
const CAMP_TINT = [1, 2].flatMap((s) => QK.camps[QK.startC[s]].map((q) => [(q / 10) | 0, q % 10, s]));

export const RULES = [
  { title: 'The board and the pegs', items: [
    P('Halma (from the Greek word for a jump) is a race. Each player has a team of pegs that starts in one corner camp of the board. The first player to bring a whole team across to the camp in the opposite corner wins.'),
    P('Classic is played on a board of 16 by 16 squares with 19 pegs each. Quick uses 10 by 10 squares and 15 pegs each. Four players uses the 16 by 16 board with 13 pegs each, one team in every corner. The tinted squares are the camps.'),
    D(START_ROWS, { cell: 30, camp: CAMP_TINT }),
    P('Blue starts at the bottom left and Red at the top right. In the four-player game Blue, Red, Green and Gold sit at the bottom left, top left, top right and bottom right, and take their turns in that order. Every team has its own mark on top of its pegs (circle, diamond, triangle, square), so the sides never depend on colour alone.'),
  ] },
  { title: 'Taking turns', items: [
    P('Blue moves first and then the turn passes round the table. On your turn you move one peg, and only one: either a single step, or a hop (which may be a whole chain of hops). You cannot pass. If a player has no legal move at all, that player is skipped.'),
  ] },
  { title: 'Steps', items: [
    P('A step moves a peg to any empty square next to it. Squares touching at a corner count, so a peg has up to eight neighbours and can go in all eight directions: along a row, along a column or diagonally.'),
    D(['.....', '.....', '..1..', '.....', '.....'], { marks: [[1, 1, 'dot'], [1, 2, 'dot'], [1, 3, 'dot'], [2, 1, 'dot'], [2, 3, 'dot'], [3, 1, 'dot'], [3, 2, 'dot'], [3, 3, 'dot']], cell: 46 }),
  ] },
  { title: 'Hops', items: [
    P('A peg can hop over a piece that stands right next to it, landing on the empty square directly behind it, in a straight line. You may hop over any piece, yours or the other side’s, but only one piece at a time, and the square you land on must be empty. Hopping never captures anything: the piece you jumped stays where it is.'),
    D(['.....', '.....', '12...', '.....'], { paths: [[[2, 0], [2, 2]]], marks: [[2, 2, 'hop']], cell: 46 }),
    P('The hop is also allowed diagonally. You cannot hop over two pieces in a row, and you cannot hop over an empty square.'),
    D(['1.....', '.2....', '......'], { paths: [[[0, 0], [2, 2]]], marks: [[2, 2, 'hop']], cell: 46 }),
  ] },
  { title: 'Chains of hops', items: [
    P('This is what makes Halma special. After a hop, if the peg can hop again from where it landed, you may keep going, over any pieces and in any directions, as many hops as you like, all in the same turn. You may stop after any hop in the chain.'),
    D(['.......', '.12.2..', '.......'], { paths: [[[1, 1], [1, 3], [1, 5]]], marks: [[1, 3, 'hop'], [1, 5, 'hop']], cell: 44 }),
    P('A move is either one step or a chain of hops: you cannot step and then hop. The route may turn corners, and it may even pass back over the square the peg started on. When you tap a peg, every square it can reach, by any route, lights up; if there are several routes to the same square, the shortest one is played.'),
    P('Lines of pieces with one empty square between them, called a ladder, let a peg fly across the board in a single turn. Building ladders, and using the ones the other side leaves behind, is the heart of the game.'),
  ] },
  { title: 'The goal camp', items: [
    P('Your goal camp is the camp in the opposite corner: the squares your opponent’s team started on. In the four-player game each team heads for the camp diagonally across the board.'),
    P('Once one of your pegs is inside your goal camp it may no longer leave it. It can still step or hop to other squares inside the camp, for example to make room deeper in the corner for the pegs behind it.'),
  ] },
  { title: 'Winning', items: [
    P('You win the moment every square of your goal camp is occupied and at least one of the pegs there is yours. Normally those are all your own pegs.'),
    P('A peg that the other side leaves standing in your goal camp still fills its square, so a straggler never stops you from finishing, but it means that player has not yet brought the whole team home, and will lose the race.'),
    P('Staying at home is a bad plan: pegs left in your starting camp are the ones furthest from your goal. Bring the rearmost pegs up as well, and do not let the last peg get stuck behind.'),
  ] },
  { title: 'The move limit', items: [
    P('To make sure that every game ends, there is a move limit: 100 moves per player in Classic, 60 in Quick and 80 in Four players. When it is reached the game stops and the player furthest along wins. Progress is measured by how far all of a team’s pegs have travelled towards the goal corner, as a share of the whole journey (the percentage on each player’s card). If two players are exactly level the game is a draw.'),
  ] },
  { title: 'Rule sets', items: [
    P('Classic: 16 by 16, 19 pegs each, two players, 100 moves each at most. Quick: 10 by 10, 15 pegs each, two players, 60 moves each at most. Four players: 16 by 16, 13 pegs each, you against three computer players, or four people on one device, 80 moves each at most. In every rule set the moves are the same.'),
  ] },
  { title: 'Tips', items: [
    P('Build short ladders along the main diagonal and keep your pegs together: a lonely peg cannot hop. Use the other side’s pegs as stepping stones. Bring up your stragglers in time. In the end game count the squares you still have to fill and make sure the last pegs have a path.'),
  ] },
];

export const HOWTO = [
  { title: 'The goal', items: [
    P('Move all your pegs from your corner camp to the camp in the opposite corner before the other players do.'),
    D(START_ROWS, { cell: 28, camp: CAMP_TINT }),
  ] },
  { title: 'Move', items: [
    P('Tap one of your pegs. Every square it can reach this turn lights up: a small dot is a step, a gold ring is a hop (the number says how many hops). Tap a lit square, or drag the peg there.'),
    P('On a small phone the squares are small, so a magnifier follows your finger: press and slide until the green frame sits on the square you want, then lift to choose it. Tap the same peg again to put it down.'),
  ] },
  { title: 'Step and hop', items: [
    P('A peg steps to any empty square next to it, or hops over a piece next to it onto the empty square behind. Hop over anyone’s pieces: nothing is ever captured.'),
    D(['.....', '.....', '12...', '.....'], { paths: [[[2, 0], [2, 2]]], marks: [[2, 2, 'hop']], cell: 40 }),
  ] },
  { title: 'Chains', items: [
    P('If a peg can hop again after landing, it can keep going in the same turn. Look for ladders: pieces with a gap between them.'),
  ] },
  { title: 'Win', items: [
    P('Fill every square of the goal camp with your pegs. When time runs out (100 moves each in Classic) the player furthest along wins.'),
  ] },
  { title: 'Learn more', items: [
    P('Tap Learn on the main menu for five short hands-on lessons. Hint shows a good move, Take back undoes your last move, and Auto Play lets you watch the computer play both sides.'),
  ] },
];

export const ABOUT = [
  { title: 'Halma: Hop and Leap', items: [
    P('Halma is a family board game from the 1880s. The name comes from the Greek word for a jump. Players race a team of pegs from one corner of the board to the opposite corner, stepping one square at a time or hopping over any pieces in the way, and chaining hops together into long leaps.'),
    P('The rules take a minute to learn. The skill is in building ladders of pieces that carry a peg across the board in a single turn, and in not leaving a peg behind.'),
  ] },
  { title: 'What you get', items: [
    P('Three rule sets: Classic (16 by 16, two players), Quick (10 by 10) and a four-player game. Five computer levels from Beginner to Master, two to four players on one device, five hands-on lessons, Hint, take back, and Auto Play (Watch & Learn).'),
    P('Three boards and two peg styles to earn. Large text up to 300 percent, reduced motion and sound options. No ads, and it works offline.'),
  ] },
  { title: 'Credits', items: [
    P('Board, pegs, sounds and the computer player were made for Arcforge. Titles are set in Fredoka (SIL Open Font License 1.1).'),
    P('Arcforge: World Heritage Games.'),
  ] },
];

// Lessons: boards are 10 rows of 10 characters on the Quick board (1 Blue, 2 Red). Blue always moves. `goal`: { type: 'to', to } | 'hops' (n) | 'win'.
const rowsOf = (cells) => { const rows = Array.from({ length: 10 }, () => '..........'.split('')); for (const [r, c, ch] of cells) rows[r][c] = ch; return rows.map((x) => x.join('')); };
const campFull = (gap, extra) => { const cells = QK.camps[QK.targetC[1]].filter((q) => q !== gap).map((q) => [(q / 10) | 0, q % 10, '1']); return rowsOf([...cells, ...extra]); };
export const LESSONS = [
  { title: 'Take a step', board: rowsOf([[7, 2, '1'], [2, 7, '2']]), goal: { type: 'to', to: 6 * 10 + 3 }, target: 6 * 10 + 3,
    text: 'A peg steps to any empty square next to it, even diagonally. Tap your peg, then the ringed square.', done: 'Good. Eight directions, one square.', hint: 'Tap the blue peg first, then the ringed square beside it.' },
  { title: 'Hop over a piece', board: rowsOf([[6, 3, '1'], [5, 3, '2'], [1, 8, '2']]), goal: { type: 'to', to: 4 * 10 + 3 }, target: 4 * 10 + 3,
    text: 'Jump over the red peg: land on the empty square right behind it. Nothing is captured.', done: 'A hop. You may jump any colour, yours too.', hint: 'Tap your peg, then the ringed square behind the red peg.' },
  { title: 'Keep hopping', board: rowsOf([[8, 1, '1'], [8, 2, '2'], [8, 4, '2'], [1, 8, '2']]), goal: { type: 'hops', n: 2 },
    text: 'After a hop you may hop again. Reach the far end of the row in a single move: two hops.', done: 'A chain of two hops in one turn.', hint: 'Tap your peg, then the farthest lit square on the row.' },
  { title: 'Ride the ladder', board: rowsOf([[9, 0, '1'], [8, 1, '2'], [6, 3, '2'], [4, 5, '1'], [1, 8, '2']]), goal: { type: 'hops', n: 3 },
    text: 'Pieces with one empty square between them make a ladder. Ride this one all the way: three hops in one turn.', done: 'Ladders are how you win. Build them, and use the ones your opponent leaves.', hint: 'Tap the peg in the corner, then the lit square at the top of the ladder.' },
  { title: 'Fill the camp', board: campFull(QK.camps[QK.targetC[1]][4], [[1, 5, '1'], [8, 1, '2']]), goal: { type: 'win' },
    text: 'The top right corner is your goal camp. One square is still empty. Step your last peg in and win.', done: 'The camp is full: that is how a game is won.', hint: 'Tap the lone peg next to the camp, then the empty camp square.' },
];
