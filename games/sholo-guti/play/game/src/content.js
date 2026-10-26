// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }.
// Diagram specs: { stones: { point: 1 (Ivory) | 2 (Indigo) }, marks: [[point, 'dot'|'ring'|'cross'|'target']], hl: [[point, colour]], arrows: [[from, to]], cell }.
// Points: 0..24 are the grid (row * 5 + column, row 0 on top), 25..30 the top block, 31..36 the bottom block.
const D = (stones, extra = {}) => ({ k: 'd', spec: { stones, cell: 52, ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });
const RED = 'rgba(255,70,50,0.45)';
const START = {}; for (let i = 0; i < 10; i++) { START[i] = 2; START[15 + i] = 1; } for (let i = 25; i <= 30; i++) START[i] = 2; for (let i = 31; i <= 36; i++) START[i] = 1;

export const RULES = [
  { title: 'The board and the stones', items: [
    P('Sholo Guti means "sixteen stones": sholo is sixteen and guti is a small stone or marble. It is a jumping and capturing game for two, known in Bangladesh and Bengal and, in related forms, across South Asia. It is often drawn with chalk or scratched on the ground and played with pebbles.'),
    P('The board has 37 points joined by lines: a square grid of 5 by 5 points with its diagonals, and a triangular block of six points on its top and on its bottom edge. Stones sit on the points, not in squares.'),
    P('Each side has 16 stones: Ivory (cream stones with a ring) and Indigo (blue stones with a flower). Each side fills its half of the grid, two rows of five, and the six points of the block at its end. The middle row is empty.'),
    D(START, { cell: 46 }),
    P('Ivory starts at the bottom and moves first. Indigo is at the top. In the app the board turns on its side on wide screens; nothing else changes.'),
  ] },
  { title: 'Taking turns', items: [
    P('You take one turn at a time, and in your turn you move one stone: either a step or a jump (below). There is no passing. If you have no legal move at all, you lose.'),
  ] },
  { title: 'Stepping', items: [
    P('A stone steps to any empty point that is joined to it by a drawn line, in any direction: forward, backward or sideways. Stones are never promoted and never change.'),
    D({ 12: 1 }, { marks: [[6, 'dot'], [7, 'dot'], [8, 'dot'], [11, 'dot'], [13, 'dot'], [16, 'dot'], [17, 'dot'], [18, 'dot']], cell: 52 }),
    P('The lines running along the diagonals are only drawn through every other point of the grid. A stone on one of the points where the diagonals cross can step diagonally; a stone on the other points steps only straight along the grid.'),
  ] },
  { title: 'Capturing: the jump', items: [
    P('You capture by jumping. A stone jumps over an enemy stone that is right next to it, along a drawn line and in a straight line, and lands on the empty point immediately behind it. The enemy stone is removed from the board.'),
    D({ 17: 1, 12: 2 }, { arrows: [[17, 7]], hl: [[12, RED]], cell: 52 }),
    P('A jump may go along a diagonal too, as long as the diagonal is a drawn line and the landing point is on the same straight line.'),
    D({ 16: 1, 12: 2 }, { arrows: [[16, 8]], hl: [[12, RED]], cell: 52 }),
    P('You may not jump your own stone, you may not jump two stones in a row, and the point behind the enemy stone must be empty and on the board.'),
  ] },
  { title: 'Jumping several times', items: [
    P('If after a jump the same stone can jump again, it may keep going in the same turn. It can change direction between jumps. You may stop after any jump: you are never forced to continue.'),
    D({ 22: 1, 17: 2, 8: 2 }, { arrows: [[22, 12], [12, 4]], hl: [[17, RED], [8, RED]], cell: 52 }),
    P('All stones jumped in one turn are removed. Only one stone moves in a turn, and a turn is either a step or one or more jumps, never both.'),
    P('Arcforge note: when two different chains of jumps would end on the same point, the app counts the chain that captures more stones.'),
  ] },
  { title: 'Capturing is your choice', items: [
    P('In Classic play captures are not compulsory. If you see a jump you can take it, and you can leave it. Leaving an enemy stone alone is sometimes the better move, and the computer may do the same.'),
    P('The Must capture rule set adds the draughts-style compulsion: if any of your stones can jump, you must make a jump (which one, and how far, is your choice).'),
  ] },
  { title: 'The triangle blocks', items: [
    P('The block of six points at each end is drawn as a triangle: a point at the tip, two below it and three along the edge of the grid. Its points are joined by the drawn lines and the three lowest ones are joined to the grid.'),
    P('You can jump into the block and out of it along any straight line, for example from the middle of the grid straight over the point in the middle of the top row and onto the middle point of the top block.'),
    D({ 7: 1, 2: 2 }, { arrows: [[7, 29]], hl: [[2, RED]], cell: 52 }),
    P('Real boards are drawn in several slightly different ways. This app uses a triangle of six points on each side, which gives the traditional 37 points and 16 stones a side.'),
  ] },
  { title: 'Winning', items: [
    P('Classic and Must capture: you win by capturing all 16 enemy stones. A player who cannot move also loses.'),
    P('Quick: the same game, but the first player to capture 8 stones wins.'),
  ] },
  { title: 'Draws and quiet games', items: [
    P('If the same position, with the same player to move, comes up three times, the game is a draw. The game is also drawn after 150 moves each.'),
    P('If 25 moves each go by without a capture, the game is settled on the spot: the side with more stones left wins. With equal stones it is a draw. Any capture starts the count again. This keeps endgames from dragging on.'),
  ] },
  { title: 'Rule sets in this app', items: [
    P('Classic: the traditional game with optional captures. Must capture: if you can jump, you have to. Quick: first to capture 8. Choose the rule set in Settings. The computer plays by the same rules as you.'),
  ] },
  { title: 'Playing in this app', items: [
    P('Tap a stone and its legal points light up. A point with a red ring means the move captures; the number shows how many stones. Tap a point to move, or drag the stone there. A jump chain is played as one move and shows its whole path.'),
    P('Hint shows a good move and says why it is good. Danger marks (in Settings) put a red mark on any of your stones that the other side could capture on its next move. Take back undoes your last move and the computer’s reply.'),
    P('Auto Play lets you watch the computer play both sides, with time to think and a pause button. Your game is saved when you leave.'),
  ] },
];

export const HOWTO = [
  { title: 'The goal', items: [
    P('Jump over the other side’s stones to capture them, and capture all 16 of them. Each side starts with 16 stones, Ivory at the bottom (it moves first) and Indigo at the top.'),
    D(START, { cell: 40 }),
  ] },
  { title: 'Move', items: [
    P('Tap one of your stones. The points it can reach glow. A stone steps to a joined empty point along a line, in any direction.'),
    P('Tap a glowing point, or drag the stone there.'),
  ] },
  { title: 'Capture', items: [
    P('Jump over an enemy stone right next to yours, along a line, to the empty point just behind it. The stone is removed. Keep jumping in the same turn if you can, or stop when you like.'),
    P('A point with a red ring and a number shows a capturing move and how many stones it takes. Captures are your choice in Classic play. In Must capture play you have to take.'),
    D({ 17: 1, 12: 2 }, { arrows: [[17, 7]], cell: 46 }),
  ] },
  { title: 'Win', items: [
    P('Capture all 16 enemy stones. In Quick play the first to capture 8 wins. If you cannot move, you lose.'),
  ] },
  { title: 'Learn more', items: [
    P('Tap Learn on the main menu for short hands-on lessons. Use Hint if you are stuck and Take back if you slip. Danger marks warn you before the other side strikes.'),
  ] },
];

export const ABOUT = [
  { title: 'Sholo Guti', items: [
    P('Sholo Guti ("sixteen stones", also called Sixteen Soldiers) is a traditional board game of Bangladesh and Bengal, with close cousins elsewhere in South Asia. It is the kind of game that is drawn with chalk on a courtyard, a pavement or a school yard and played with pebbles, seeds or bottle caps.'),
    P('Every stone steps along the lines and captures by jumping, and a single stone can jump again and again. The rules take a minute to learn; the tactics of sacrifices, traps and double jumps take much longer.'),
  ] },
  { title: 'What you get', items: [
    P('Three rule sets: Classic with optional captures, Must capture for a sharper game, and Quick, first to eight. Five computer levels from Beginner to Master, two players on one phone, hands-on lessons, Hint, danger marks, take back, and Auto Play (Watch & Learn).'),
    P('Three boards (courtyard clay, school slate, polished teak) and two stone styles to earn by winning. Large text, reduced motion and sound options. It works offline.'),
  ] },
  { title: 'Credits', items: [
    P('Board, stones, sounds and the computer player were made for Arcforge. Titles are set in Cormorant Garamond (SIL Open Font License 1.1). Boards of this game are drawn in several slightly different ways in different places; this version uses the common 37-point form.'),
    P('The 3D courtyard, board and stones are drawn with three.js (MIT licence) and the Arcforge view3d scene kit; the distant sky, rice fields and village backdrops are Arcforge scenery images made for this game family. The 3D art is made for Arcforge.'),
    P('Arcforge: World Heritage Games.'),
  ] },
];

// Lessons. `stones` maps a point to 1 (Ivory, you) or 2 (Indigo). `goal`: { type: 'to', to } | 'capture' (n) | 'win'. Ivory always moves.
export const LESSONS = [
  { title: 'Step along the lines', variant: 'classic', stones: { 12: 1, 3: 2 }, goal: { type: 'to', to: 7 }, target: 7,
    text: 'A stone steps to a joined empty point. Tap your stone, then the ringed point straight ahead.', done: 'Good. Any direction along a line is allowed, even backward.', hint: 'Tap your stone first, then the ringed point just above it.' },
  { title: 'Diagonals', variant: 'classic', stones: { 16: 1, 3: 2 }, goal: { type: 'to', to: 12 }, target: 12,
    text: 'Where the diagonal lines are drawn, a stone can step diagonally. Step to the ringed point.', done: 'Diagonals work only where a line is drawn.', hint: 'Tap your stone, then the ringed point on the diagonal line.' },
  { title: 'Jump to capture', variant: 'classic', stones: { 17: 1, 12: 2, 4: 2 }, goal: { type: 'capture', n: 1 },
    text: 'The Indigo stone is right next to yours with an empty point behind it. Jump over it.', done: 'Captured. The stone you jumped is taken off the board.', hint: 'Tap your stone, then the point on the far side of the Indigo stone.' },
  { title: 'Jump on a diagonal', variant: 'classic', stones: { 16: 1, 12: 2, 4: 2 }, goal: { type: 'capture', n: 1 },
    text: 'Jumps follow the drawn lines, diagonals too. Capture the Indigo stone.', done: 'The jump lands on the same straight line.', hint: 'Jump along the diagonal, landing on the point just beyond the stone.' },
  { title: 'Two jumps in one turn', variant: 'classic', stones: { 22: 1, 17: 2, 8: 2, 0: 2 }, goal: { type: 'capture', n: 2 },
    text: 'After a jump, the same stone may jump again. Take both Indigo stones in one turn: first up, then along the diagonal.', done: 'Two stones in one turn. You may stop after any jump, too.', hint: 'Tap the lower stone, then the far point of the second jump.' },
  { title: 'Into the triangle', variant: 'classic', stones: { 7: 1, 2: 2, 24: 2 }, goal: { type: 'capture', n: 1 },
    text: 'The blocks at the ends are part of the board. Jump over the Indigo stone and land in the triangle.', done: 'Jumps can go into the triangle blocks and out of them.', hint: 'Jump straight up over the stone at the top of the grid.' },
  { title: 'Must capture', variant: 'forced', stones: { 17: 1, 12: 2, 20: 1, 4: 2 }, goal: { type: 'capture', n: 1 },
    text: 'In Must capture play a jump is compulsory. You have one: take it.', done: 'If you can capture in this rule set, you must.', hint: 'Jump over the Indigo stone next to your middle stone.' },
  { title: 'Take the last stone', variant: 'classic', stones: { 17: 1, 12: 2 }, goal: { type: 'win' },
    text: 'Capture every enemy stone and you win. One jump finishes this game.', done: 'No Indigo stones left: you win Sholo Guti.', hint: 'Jump over the last Indigo stone.' },
];
