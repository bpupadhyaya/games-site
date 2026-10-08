// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }.
// Diagram pieces are [row, col, side, shape, value] with side 1 = Ivory, 2 = Ink and shape 1 = round, 2 = triangle, 3 = square.
import { mk, KINDS } from './rules.js';

const D = (cols, rows, pieces, extra = {}) => ({ k: 'd', spec: { cols, rows, pieces, ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });
const O = 1, K = 2;                      // Ivory, Ink
const RD = 1, TR = 2, SQ = 3;

export const RULES = [
  { title: 'The board and the armies', items: [
    P('Rithmomachia, the battle of numbers, is a game of the medieval European schools: two armies, each piece carrying a number, fighting on a board made of two chess boards joined end to end. This edition keeps the heart of the game and simplifies the rest.'),
    P('The board is 8 files wide and 16 ranks long. Ivory starts on the near half and moves first. Ink starts on the far half. Each army has 20 pieces: 8 rounds, 8 triangles and 4 squares, and every piece shows its number.'),
    D(5, 1, [[0, 0, O, RD, 6], [0, 1, O, TR, 21], [0, 2, O, SQ, 54], [0, 3, K, RD, 9], [0, 4, K, SQ, 96]], { cell: 56 }),
    P('The camps matter: the half of the board where an army starts is its own camp, and the other half is the enemy camp. Where you can build your winning arrangement (see Winning) depends on which camp you stand in.'),
  ] },
  { title: 'How the pieces move', items: [
    P('Pieces only ever move to an empty square, and they move in their own way every turn (there is no passing).'),
    H('Round'),
    P('A round moves one square straight: up, down, left or right.'),
    D(3, 3, [[1, 1, O, RD, 6]], { marks: [[0, 1, 'dot'], [2, 1, 'dot'], [1, 0, 'dot'], [1, 2, 'dot']], cell: 50 }),
    H('Triangle'),
    P('A triangle moves exactly two squares diagonally, jumping over whatever stands on the square between. It cannot stop on the middle square.'),
    D(5, 5, [[2, 2, O, TR, 21], [1, 1, K, RD, 4]], { marks: [[0, 0, 'dot'], [0, 4, 'dot'], [4, 0, 'dot'], [4, 4, 'dot']], cell: 42 }),
    H('Square'),
    P('A square moves exactly three squares straight, jumping over any pieces between.'),
    D(7, 7, [[3, 3, O, SQ, 54]], { marks: [[0, 3, 'dot'], [6, 3, 'dot'], [3, 0, 'dot'], [3, 6, 'dot']], cell: 36 }),
    P('A piece can only be moved to a square that is on its pattern and empty. If a move is not allowed, the game tells you why.'),
  ] },
  { title: 'Taking by touch: equal and ratio', items: [
    P('You take pieces by touching them. After your piece arrives on its new square, look at the up to four squares touching it (above, below, left, right). Every enemy piece there whose number stands in a simple relationship to yours is taken at once.'),
    P('The relationships that count are: equal (1 : 1), or the ratios 1 : 2, 1 : 3 and 2 : 3, in either order. So a 6 takes a 6, a 12, an 18 or a 9, and a 6 is also taken by touching 3 (1 : 2), 2 (1 : 3) or 4 (2 : 3).'),
    D(3, 3, [[2, 1, O, RD, 6], [0, 1, K, RD, 12]], { arrows: [[2, 1, 1, 1]], hl: [[0, 1, 'rgba(194,56,31,0.3)']], cell: 56 }),
    P('The 6 steps up and touches the 12 above it: 6 : 12 is 1 : 2, so the 12 is taken. The screen shows the sum for every piece taken.'),
    P('Touch is not a landing: you never move onto another piece. Pieces diagonal to yours do not count; only the four squares that share an edge.'),
  ] },
  { title: 'Taking by ambush: the sum', items: [
    P('There is a second way to take a piece. After your piece arrives, look along each of the four straight lines from it. If the first piece you meet is an enemy piece, and the next piece after that (with nothing in between) is one of your own, and your two numbers add up to the enemy piece’s number, the enemy piece is taken.'),
    D(7, 1, [[0, 0, O, TR, 4], [0, 3, K, RD, 9], [0, 5, O, RD, 5]], { hl: [[0, 3, 'rgba(194,56,31,0.3)']], cell: 46 }),
    P('4 + 5 = 9, so the 9 between them falls. Empty squares in between do not matter; any other piece in between stops the ambush.'),
    P('Only the piece that has just moved can be one end of an ambush. A move can take several pieces at once, by touch and by ambush together.'),
  ] },
  { title: 'Who can be taken, and when', items: [
    P('Only the side that has just moved takes pieces. You may walk next to an enemy piece, or between two enemy pieces whose numbers would add up to yours, and you are safe: you can only be taken when the other side moves a piece and the numbers fit.'),
    P('Your own pieces never take your own pieces. There is no check and no king: nothing needs to be protected except the chance to build your arrangement.'),
  ] },
  { title: 'Winning: the arrangement', items: [
    P('The great victory of the game is the arrangement, the “proportions” of the old number theory. Put three of your pieces in one straight line (a rank, a file or a diagonal), all of them inside the ENEMY camp, with nothing standing between them and at most one empty square between neighbours. Their numbers, read in line order, must be three different numbers with the middle piece’s number between the other two, and form one of three progressions:'),
    H('Arithmetic'),
    P('The steps are equal: the middle number is the average of the ends. Example 3, 6, 9: steps of 3.'),
    D(5, 1, [[0, 0, O, RD, 3], [0, 2, O, RD, 6], [0, 4, O, RD, 9]], { cell: 50 }),
    H('Geometric'),
    P('The ratio is equal: the middle number times itself equals the product of the ends. Example 3, 6, 12: each is twice the one before.'),
    D(3, 1, [[0, 0, O, RD, 3], [0, 1, O, RD, 6], [0, 2, O, TR, 12]], { cell: 50 }),
    H('Harmonic'),
    P('The reciprocals have equal steps: the middle number is the harmonic mean of the ends, 2 × (a × c) ÷ (a + c). Example 3, 4, 6: 2 × 18 ÷ 9 = 4.'),
    D(5, 1, [[0, 0, O, RD, 3], [0, 2, O, RD, 4], [0, 3, O, TR, 6]], { cell: 50 }),
    P('The moment your move completes an arrangement, you win. The side to move must watch for the other side’s arrangement as well as its own: a piece can be moved, or taken, to stop it.'),
  ] },
  { title: 'Other ways the game ends', items: [
    P('Victory of the body: take 10 enemy pieces and you win at once.'),
    P('No move: if the side to move has no legal move, it loses.'),
    P('Move limit: after 100 moves each, the side that has taken the greater total of numbers wins. Equal totals are a draw.'),
  ] },
  { title: 'About this edition', items: [
    P('The medieval game has many more victories, a pyramid piece built from stacked squares, and a long list of capture rules. This edition keeps three kinds of piece, capture by equality, ratio and sum, and the arithmetic, geometric and harmonic arrangements, so that a full game fits on a phone and every capture can be checked with simple arithmetic.'),
  ] },
];

export const HOWTO = [
  { title: 'The idea', items: [
    P('Two armies of numbered pieces. Take enemy pieces with simple arithmetic, and build a line of three whose numbers form a progression in the enemy camp to win.'),
    P('New here? Tap Learn to play on the menu: eight short lessons where you make every move yourself.'),
  ] },
  { title: 'Making a move', items: [
    P('Tap one of your pieces. It lifts, and every square it can reach glows. Tap a glowing square, or drag the piece there.'),
    P('A red ring means the move takes something. The ring shows how many pieces. After the move the screen shows each capture as a sum, such as 6 : 12 = 1 : 2 or 4 + 5 = 9, so you always see why a piece fell.'),
    P('Round: one square up, down, left or right. Triangle: exactly two squares diagonally, jumping. Square: exactly three squares straight, jumping.'),
  ] },
  { title: 'Reading the numbers', items: [
    P('Touch an enemy piece whose number is equal to yours, or in the ratio 1 : 2, 1 : 3 or 2 : 3, and it is taken. Arrive in line with an enemy piece and one of your own so that your two numbers add up to its number, and it is taken too.'),
  ] },
  { title: 'Helping yourself', items: [
    P('Hint shows a good move and says why. Danger marks are the red flags on your pieces that the other side can take next move. A warning line appears when the other side is one move from an arrangement. Take back undoes your last move.'),
    P('Auto Play lets you watch the computer play both sides, with time to think about each move before it is shown, and a Pause button.'),
  ] },
  { title: 'Winning', items: [
    P('Make an arithmetic, geometric or harmonic line of three of your pieces inside the enemy camp. Or take 10 pieces. See Rules for the exact lines and the move limit.'),
  ] },
];

export const ABOUT = [
  { title: 'The battle of numbers', items: [
    P('Rithmomachia (“the philosophers’ game”, “the battle of numbers”) was played across Europe from about the 11th century. It was a game for scholars: a way to practise the number theory of the Roman writer Boethius, with ratios, sums and the three “means” of arithmetic, geometry and harmony, on a board of two chess boards.'),
    P('Rithmomachia Number Battle is an Arcforge edition: a simplified, phone-sized version of the game with the rules explained in lessons and the arithmetic of every capture shown on the screen.'),
  ] },
  { title: 'This edition', items: [
    P('Five computer levels from Beginner to Master, two players on one device, hands-on lessons, hints, danger marks, take back, and a Watch and Learn mode. The board and pieces follow an illuminated manuscript: vellum, gold leaf, lapis and ink.'),
    P('Works in portrait and landscape on phones and tablets, with text zoom up to 300 percent on the reading screens and a reduced motion option. No ads. Your game is saved when you leave.'),
  ] },
  { title: 'Arcforge', items: [
    P('Arcforge is a collection of the world’s heritage games, each built to look and feel better than the usual store version. Tap the Arcforge mark on the menu to see the others.'),
  ] },
];

// ---- lessons. A lesson board is [rank, file, side, shape, value]; goals: to (a square), capture (n pieces), win (an arrangement).
const sq = (r, c) => r * 8 + c;
const board = (list) => { const b = new Array(128).fill(0); for (const [r, c, s, sh, v] of list) b[sq(r, c)] = mk(s, sh, v); return b; };
export const LESSONS = [
  { title: 'The round', board: board([[12, 3, O, RD, 6], [3, 4, K, RD, 9], [2, 1, K, SQ, 96]]), goal: { type: 'to', to: sq(11, 3) }, target: sq(11, 3),
    text: 'A round moves one square straight. Tap your round, then tap the ringed square above it.', done: 'Good. A round steps up, down, left or right.', hint: 'Tap the round with the 6, then the ringed square just above it.' },
  { title: 'The triangle jumps', board: board([[12, 2, O, TR, 21], [11, 3, K, RD, 4], [3, 6, K, TR, 10]]), goal: { type: 'to', to: sq(10, 4) }, target: sq(10, 4),
    text: 'A triangle moves exactly two squares diagonally and jumps whatever is in between. Jump over the ink piece to the ringed square.', done: 'It jumped. Triangles ignore what is on the middle square.', hint: 'Tap the triangle, then the ringed square: two up and two right.' },
  { title: 'The square leaps', board: board([[12, 3, O, SQ, 54], [11, 3, K, RD, 4], [10, 3, K, RD, 9], [2, 6, K, SQ, 96]]), goal: { type: 'to', to: sq(9, 3) }, target: sq(9, 3),
    text: 'A square moves exactly three squares in a straight line and jumps everything between. Leap to the ringed square.', done: 'Three squares exactly, over anything.', hint: 'Tap the square, then the ringed square three squares straight up.' },
  { title: 'Take by touch', board: board([[8, 3, O, RD, 6], [6, 3, K, RD, 12], [1, 6, K, RD, 9]]), goal: { type: 'capture', n: 1 },
    text: 'Your 6 and the ink 12 are in the ratio 1 : 2. Step the 6 up so it touches the 12 and the 12 is taken.', done: 'Taken. 6 : 12 is 1 : 2, so touching it takes it.', hint: 'Move the round with the 6 one square up so that it touches the 12.' },
  { title: 'The ratio 2 : 3', board: board([[9, 4, O, RD, 6], [7, 4, K, RD, 9], [1, 1, K, SQ, 96]]), goal: { type: 'capture', n: 1 },
    text: 'Equal numbers and the ratios 1 : 2, 1 : 3 and 2 : 3 all take. 6 and 9 are 2 : 3. Touch the 9.', done: '6 : 9 is 2 : 3. Take it.', hint: 'Move the 6 one square up so that it touches the 9.' },
  { title: 'Ambush by sum', board: board([[11, 2, O, TR, 4], [9, 5, K, RD, 9], [9, 6, O, RD, 5], [1, 1, K, SQ, 96]]), goal: { type: 'capture', n: 1 },
    text: 'The ink 9 sits next to your 5. Jump your 4 in line with them, on the other side: 4 + 5 = 9, and the 9 is ambushed.', done: '4 + 5 = 9. The piece between falls.', hint: 'Jump the triangle two up and two right: it then stands in the same rank as the 9 and the 5.' },
  { title: 'Two at once', board: board([[9, 4, O, RD, 6], [7, 4, K, RD, 12], [8, 5, K, RD, 9], [1, 1, K, SQ, 96]]), goal: { type: 'capture', n: 2 },
    text: 'One move can take several pieces. Step up so the 6 touches both the 12 (1 : 2) and the 9 (2 : 3).', done: 'Two pieces in one move.', hint: 'Move the 6 one square up. Both ink pieces will touch it.' },
  { title: 'The arrangement', board: board([[4, 2, O, RD, 3], [4, 6, O, RD, 9], [6, 2, O, TR, 6], [14, 5, K, RD, 8]]), goal: { type: 'win' },
    text: 'To win, line three pieces up in the enemy camp with an arithmetic, geometric or harmonic progression. 3, 6, 9 has steps of 3. Put the 6 between the 3 and the 9.', done: '3, 6, 9: an arithmetic arrangement in the enemy camp. That wins the game.', hint: 'Jump the triangle with the 6 two up and two right, to the middle of the line.' },
];
export { KINDS };
