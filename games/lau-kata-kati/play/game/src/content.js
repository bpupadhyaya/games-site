// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality). Items: { k: 'h' | 'p' | 'd', t / spec }.
// Diagram specs: { stones: { point: 1 (Gold) | 2 (Ruby) }, marks: [[point, 'dot'|'ring'|'cross'|'target']], hl: [[point, colour]], arrows: [[from, to]], cell }.
// Points: 0 is the waist where the triangles meet. Ruby's triangle (top): level 1 = 1,2,3, level 2 = 4,5,6, level 3 = 7,8,9. Gold's triangle
// (bottom): level 1 = 10,11,12, level 2 = 13,14,15, level 3 = 16,17,18. Left, middle, right in each level.
const D = (stones, extra = {}) => ({ k: 'd', spec: { stones, cell: 52, ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });
const RED = 'rgba(255,70,50,0.45)';
const START = {}; for (let i = 1; i <= 9; i++) { START[i] = 2; START[9 + i] = 1; }

export const RULES = [
  { title: 'The board and the pieces', items: [
    P('Lau Kata Kati is a traditional two-player jumping and capturing game of Bengal, in Bangladesh and West Bengal. It was drawn on the ground or on cloth and played with small markers. Little is recorded about how it was played in recent times, so this is a careful revival of the rules that are known.'),
    P('The board is two triangles that meet at one point, the waist. Every triangle has three cross lines of three points each, and three straight lines run out from the waist through them: one down the middle and two diagonals. The diagonals carry on straight through the waist into the other triangle. That makes 19 points. Pieces sit on the points.'),
    P('Each side has nine pieces: Gold (yellow patches with a diamond) and Ruby (red patches with a ring). Each side fills all nine points of its own triangle. The waist is empty.'),
    D(START, { cell: 46 }),
    P('Gold starts in the bottom triangle and moves first. Ruby starts in the top triangle. In the app the board turns on its side on wide screens; nothing else changes.'),
  ] },
  { title: 'Taking turns', items: [
    P('You take one turn at a time, and in your turn you move one piece: either a step or a jump (below). There is no passing. If you have no legal move at all, you lose.'),
  ] },
  { title: 'Stepping', items: [
    P('A piece steps to any empty point that is joined to it by a drawn line, in any direction: toward the enemy, back, or sideways along a cross line. Pieces are never promoted and never change.'),
    D({ 0: 1 }, { marks: [[1, 'dot'], [2, 'dot'], [3, 'dot'], [10, 'dot'], [11, 'dot'], [12, 'dot']], cell: 52 }),
    P('The piece on the waist can step to any of the six points around it. A piece on a middle point of a cross line can step along the line to the left or right, and along the straight line toward or away from the waist.'),
  ] },
  { title: 'Capturing: the jump', items: [
    P('You capture by jumping. A piece jumps over an enemy piece that is right next to it, along a drawn line and in a straight line, and lands on the empty point immediately behind it. The enemy piece is removed from the board.'),
    D({ 11: 1, 0: 2 }, { arrows: [[11, 2]], hl: [[0, RED]], cell: 52 }),
    P('A jump may go along a diagonal or a cross line too, as long as the landing point is on the same straight line.'),
    D({ 10: 1, 11: 2 }, { arrows: [[10, 12]], hl: [[11, RED]], cell: 52 }),
    P('You may not jump your own piece, you may not jump two pieces in a row, and the point behind the enemy piece must be empty and on the board. A piece in a corner of a triangle has no jump past its neighbour along the outside, because there is no point beyond.'),
  ] },
  { title: 'Jumping several times', items: [
    P('If after a jump the same piece can jump again, it may keep going in the same turn. It can change direction between jumps. You may stop after any jump: you are never forced to continue.'),
    D({ 14: 1, 11: 2, 2: 2, 8: 2 }, { arrows: [[14, 0], [0, 5]], hl: [[11, RED], [2, RED]], cell: 52 }),
    P('All pieces jumped in one turn are removed. Only one piece moves in a turn, and a turn is either a step or one or more jumps, never both.'),
    P('Arcforge note: when two different chains of jumps would end on the same point, the app counts the chain that captures more pieces.'),
  ] },
  { title: 'Capturing is your choice', items: [
    P('In Classic play captures are not compulsory. If you see a jump you can take it, and you can leave it. Leaving an enemy piece alone is sometimes the better move, and the computer may do the same.'),
    P('The Must capture rule set adds the draughts-style compulsion: if any of your pieces can jump, you must make a jump (which one, and how far, is your choice).'),
  ] },
  { title: 'The opening', items: [
    P('At the start the only empty point is the waist, so the first move is a step into it. The step leaves a gap behind the piece, and an enemy piece on the far side of the waist may be able to jump over it into that gap. Whether to take such a trade, and how to answer it, is the first decision of every game.'),
    D(START, { arrows: [[11, 0]], cell: 46 }),
  ] },
  { title: 'Winning', items: [
    P('Classic and Must capture: you win by capturing all nine enemy pieces, or by leaving the other side with no legal move (all its pieces blocked in). A player who cannot move loses.'),
    P('Quick: the same game, but the first player to capture 5 pieces wins.'),
  ] },
  { title: 'Draws and quiet games', items: [
    P('If the same position, with the same player to move, comes up three times, the game is a draw. The game is also drawn after 120 moves each.'),
    P('If 20 moves each go by without a capture, the game is settled on the spot: the side with more pieces left wins. With equal pieces it is a draw. Any capture starts the count again. This keeps careful games from dragging on. It is an Arcforge house rule, not part of the traditional game.'),
  ] },
  { title: 'Rule sets in this app', items: [
    P('Classic: the traditional game with optional captures. Must capture: if you can jump, you have to. Quick: first to capture 5. Choose the rule set in Settings. The computer plays by the same rules as you.'),
    P('What is simplified: the traditional game may have been played with slightly different local customs about who starts and whether capturing is compulsory. This app offers both capturing rules so that you can play either way.'),
  ] },
  { title: 'Playing in this app', items: [
    P('Tap a piece and its legal points light up. A point with a red ring means the move captures; the number shows how many pieces. Tap a point to move, or drag the piece there. A jump chain is played as one move and shows its whole path.'),
    P('Hint shows a good move and says why it is good. Danger marks (in Settings) put a red mark on any of your pieces that the other side could capture on its next move. Take back undoes your last move and the computer’s reply.'),
    P('Auto Play lets you watch the computer play both sides, with time to think and a pause button. Your game is saved when you leave.'),
  ] },
];

export const HOWTO = [
  { title: 'The goal', items: [
    P('Jump over the other side’s pieces to capture them, until none are left or they cannot move. Each side starts with nine pieces in its own triangle, Gold at the bottom (it moves first) and Ruby at the top.'),
    D(START, { cell: 40 }),
  ] },
  { title: 'Move', items: [
    P('Tap one of your pieces. The points it can reach glow. A piece steps to a joined empty point along a line, in any direction.'),
    P('Tap a glowing point, or drag the piece there.'),
  ] },
  { title: 'Capture', items: [
    P('Jump over an enemy piece right next to yours, along a line, to the empty point just behind it. The piece is removed. Keep jumping in the same turn if you can, or stop when you like.'),
    P('A point with a red ring and a number shows a capturing move and how many pieces it takes. Captures are your choice in Classic play. In Must capture play you have to take.'),
    D({ 11: 1, 0: 2 }, { arrows: [[11, 2]], cell: 46 }),
  ] },
  { title: 'Win', items: [
    P('Capture all nine enemy pieces, or block them so that they cannot move. In Quick play the first to capture 5 wins. If you cannot move, you lose.'),
  ] },
  { title: 'Learn more', items: [
    P('Tap Learn on the main menu for short hands-on lessons. Use Hint if you are stuck and Take back if you slip. Danger marks warn you before the other side strikes.'),
  ] },
];

export const ABOUT = [
  { title: 'Lau Kata Kati', items: [
    P('Lau Kata Kati is a traditional board game of Bengal, in Bangladesh and West Bengal, described in a nineteenth-century source. Two sides of nine pieces face each other across a board of two triangles that meet at a single point, and capture by jumping, as in draughts.'),
    P('Only a little is recorded about how it was played, and it is rarely seen today, so this version is a revival: the board, the nine pieces and the jumping capture are traditional; the extra rule sets and the draw rules are Arcforge’s.'),
  ] },
  { title: 'What you get', items: [
    P('Three rule sets: Classic with optional captures, Must capture for a sharper game, and Quick, first to five. Five computer levels from Beginner to Master, two players on one phone, hands-on lessons, Hint, danger marks, take back, and Auto Play (Watch & Learn).'),
    P('Three cloth boards (indigo, madder red, plain cotton) and two piece styles to earn by winning. Large text, reduced motion and sound options. Works offline.'),
  ] },
  { title: 'Credits', items: [
    P('The board, pieces, sounds and the computer player were made for Arcforge. The board is drawn as quilted cloth in running stitch, in the manner of Bengal’s kantha embroidery. Titles are set in Barlow Condensed (SIL Open Font License 1.1). The 3D scene uses the shared three.js renderer (MIT licence).'),
    P('Arcforge: World Heritage Games.'),
  ] },
];

// Lessons. `stones` maps a point to 1 (Gold, you) or 2 (Ruby). `goal`: { type: 'to', to } | 'capture' (n) | 'win'. Gold always moves.
export const LESSONS = [
  { title: 'Step along the lines', variant: 'classic', stones: { 11: 1, 8: 2 }, goal: { type: 'to', to: 0 }, target: 0,
    text: 'A piece steps to a joined empty point. Tap your piece, then the ringed point at the waist.', done: 'Good. The waist joins six points, three from each triangle.', hint: 'Tap your piece first, then the ringed point just above it.' },
  { title: 'Sideways and back', variant: 'classic', stones: { 14: 1, 8: 2 }, goal: { type: 'to', to: 13 }, target: 13,
    text: 'Cross lines let a piece slide sideways. Step to the ringed point on the left.', done: 'Any direction along a line is allowed, even backward.', hint: 'Tap your piece, then the ringed point beside it.' },
  { title: 'Jump to capture', variant: 'classic', stones: { 11: 1, 0: 2, 8: 2 }, goal: { type: 'capture', n: 1 },
    text: 'The Ruby piece is right next to yours with an empty point behind it. Jump over it.', done: 'Captured. The piece you jumped is taken off the board.', hint: 'Tap your piece, then the point on the far side of the Ruby piece.' },
  { title: 'Jump on a diagonal', variant: 'classic', stones: { 13: 1, 10: 2, 9: 2 }, goal: { type: 'capture', n: 1 },
    text: 'Jumps follow the drawn lines, diagonals too. Capture the Ruby piece.', done: 'The jump lands on the same straight line, here at the waist.', hint: 'Jump along the diagonal, landing on the point just beyond the piece.' },
  { title: 'Two jumps in one turn', variant: 'classic', stones: { 14: 1, 11: 2, 2: 2, 8: 2 }, goal: { type: 'capture', n: 2 },
    text: 'After a jump, the same piece may jump again. Take both Ruby pieces in one turn: first to the waist, then straight on.', done: 'Two pieces in one turn. You may stop after any jump, too.', hint: 'Tap the lower piece, then the far point of the second jump.' },
  { title: 'Across a cross line', variant: 'classic', stones: { 10: 1, 11: 2, 8: 2 }, goal: { type: 'capture', n: 1 },
    text: 'Cross lines carry jumps as well. Jump sideways over the Ruby piece.', done: 'Jumps can go along any drawn line.', hint: 'Jump along the cross line to the empty point on the other side.' },
  { title: 'Must capture', variant: 'forced', stones: { 13: 1, 10: 2, 18: 1, 5: 2 }, goal: { type: 'capture', n: 1 },
    text: 'In Must capture play a jump is compulsory. You have one: take it.', done: 'If you can capture in this rule set, you must.', hint: 'Jump over the Ruby piece next to your left-hand piece.' },
  { title: 'Take the last piece', variant: 'classic', stones: { 14: 1, 11: 2 }, goal: { type: 'win' },
    text: 'Capture every enemy piece and you win. One jump finishes this game.', done: 'No Ruby pieces left: you win Lau Kata Kati.', hint: 'Jump over the last Ruby piece.' },
];
