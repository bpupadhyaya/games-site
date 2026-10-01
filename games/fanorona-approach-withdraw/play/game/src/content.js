// Text for How to Play, About and the full Rules reference. Pages are short and single-concept on purpose: the text
// size stepper goes up to 300%, and every page here still fits at that size (the renderer only shrinks text as a
// last resort). Every rule claim below is cross-checked against rules.js, which is the single source of truth;
// the diagrams reuse the game's own board and stone painting (view.js drawDiagram).
import { NO_CAPTURE_LIMIT, startBoard, idx } from './rules.js';
import { boardBox } from './art.js';

const L = 1, D = 2;
const pt = (r, c) => idx(r, c);
// d({ r0, c0, grid: ['..L.D', ...] , ... }): grid[r - r0][c - c0]
function dia({ r0, c0, grid, S = 54, arrows = [], vics = [], marks = [], lift }) {
  const rows = grid.length, cols = grid[0].length, r1 = r0 + rows - 1, c1 = c0 + cols - 1;
  const stones = [];
  grid.forEach((row, i) => { for (let j = 0; j < cols; j++) { const ch = row[j]; if (ch === 'L') stones.push([pt(r0 + i, c0 + j), L]); else if (ch === 'D') stones.push([pt(r0 + i, c0 + j), D]); } });
  const o = { S, F: 36, r0, r1, c0, c1 };
  return { r0, r1, c0, c1, S, stones, arrows, vics, marks, lift, height: boardBox(o).h };
}
const fullStart = () => {
  const b = startBoard(), stones = [];
  b.forEach((v, p) => { if (v) stones.push([p, v]); });
  return { r0: 0, r1: 4, c0: 0, c1: 8, S: 34, stones, arrows: [], vics: [], marks: [], height: boardBox({ S: 34, F: 36, r0: 0, r1: 4, c0: 0, c1: 8 }).h };
};
const AM = 'amber', CY = 'cyan';
function openGrid() {
  const b = startBoard(), rows = [];
  for (let r = 0; r < 5; r++) { let row = ''; for (let c = 2; c <= 6; c++) row += b[idx(r, c)] === 1 ? 'L' : b[idx(r, c)] === 2 ? 'D' : '.'; rows.push(row); }
  return rows;
}

export const RULES = [
  { title: 'The board', diagram: fullStart(), lines: ['Five lines by nine lines: 45 points.'] },
  { title: 'Lines', lines: ['Stones move one step at a time along the drawn lines, from a point to an empty point next to it.'] },
  { title: 'Strong points', diagram: dia({ r0: 0, c0: 0, S: 70, grid: ['...', '...', '...'] }), lines: ['Diagonals run only through strong points: the ringed ones.'] },
  { title: 'Weak points', lines: ['A weak point has no diagonals. It joins only its straight neighbours.'] },
  { title: 'The stones', lines: ['Each side has 22 stones. One side is Light and the other is Dark.'] },
  { title: 'The start', diagram: fullStart(), lines: ['Each side fills its two near lines.'] },
  { title: 'The middle line', lines: ['The middle line holds four stones of each side, alternating. Its centre point is empty.'] },
  { title: 'Who moves', lines: ['Light moves first. Then the players take turns.'] },
  { title: 'A turn', lines: ['On your turn, move one stone one step along a line to an empty point.'] },
  { title: 'Capturing', lines: ['A move can capture enemy stones in two ways: by approach or by withdrawal.'] },
  { title: 'Approach', diagram: dia({ r0: 1, c0: 0, S: 52, grid: ['.....', 'L.DD.', '.....'], arrows: [[pt(2, 0), pt(2, 1)]], vics: [[[pt(2, 2), pt(2, 3)], AM]] }), lines: ['Move toward an enemy stone. If one is next in line past where you land, you capture it.'] },
  { title: 'The whole line', lines: ['An approach takes the stone directly ahead and every enemy stone behind it in an unbroken row.'] },
  { title: 'Withdrawal', diagram: dia({ r0: 1, c0: 0, S: 52, grid: ['.....', 'DDL..', '.....'], arrows: [[pt(2, 2), pt(2, 3)]], vics: [[[pt(2, 1), pt(2, 0)], CY]] }), lines: ['Move directly away from an enemy stone. If one is right behind where you started, you capture it.'] },
  { title: 'The whole line, again', lines: ['A withdrawal takes the stone directly behind you and the unbroken enemy row behind it.'] },
  { title: 'Unbroken runs', diagram: dia({ r0: 1, c0: 0, S: 52, grid: ['.....', 'L.D.D', '.....'], arrows: [[pt(2, 0), pt(2, 1)]], vics: [[[pt(2, 2)], AM]] }), lines: ['A gap, or any other stone, ends the run. Stones past it are safe.'] },
  { title: 'Diagonal captures', diagram: dia({ r0: 0, c0: 0, S: 70, grid: ['L..', '...', '..D'], arrows: [[pt(0, 0), pt(1, 1)]], vics: [[[pt(2, 2)], AM]] }), lines: ['On strong points, both captures also work along diagonals.'] },
  { title: 'Your choice', diagram: dia({ r0: 1, c0: 0, S: 52, grid: ['.....', 'DDL.D', '.....'], arrows: [[pt(2, 2), pt(2, 3)]], vics: [[[pt(2, 4)], AM], [[pt(2, 1), pt(2, 0)], CY]] }), lines: ['One step can allow both. Then you choose which line to take.'] },
  { title: 'Capturing is compulsory', lines: ['If any of your stones can capture, you must capture this turn.'] },
  { title: 'Which stone', lines: ['You may pick any stone that can capture. Stones that cannot capture may not move.'] },
  { title: 'The quiet move', lines: ['If nothing can capture, move one stone one step with no capture. This is called paika.'] },
  { title: 'Paika ends the turn', lines: ['A quiet move captures nothing and always ends your turn.'] },
  { title: 'Capture chains', lines: ['After a capturing step, the same stone may capture again. This is a chain.'] },
  { title: 'Chain: must capture', lines: ['Every further step in a chain must itself capture.'] },
  { title: 'Chain: no repeats', lines: ['The stone may not stop on any point it already stood on during this turn.'] },
  { title: 'Chain: new direction', lines: ['It may not move in the same direction twice in a row.'] },
  { title: 'Chain: optional', lines: ['You may stop at any point in a chain. Continuing is your choice.'] },
  { title: 'Chain example', diagram: dia({ r0: 0, c0: 0, S: 42, grid: ['.....', 'DD...', '..L.D', '...D.', '...D.'], arrows: [[pt(2, 2), pt(2, 3)], [pt(2, 3), pt(1, 3)], [pt(1, 3), pt(1, 2)]], vics: [[[pt(2, 4)], AM], [[pt(3, 3), pt(4, 3)], CY], [[pt(1, 1), pt(1, 0)], AM]] }), lines: ['Approach, withdraw, approach: five stones in one turn.'] },
  { title: 'Ending a turn', lines: ['Your turn ends when you stop, or when your stone has no capture left to make.'] },
  { title: 'The opening', diagram: dia({ r0: 0, c0: 2, S: 40, grid: openGrid(), arrows: [[pt(1, 3), pt(2, 4)], [pt(1, 4), pt(2, 4)], [pt(1, 5), pt(2, 4)], [pt(2, 3), pt(2, 4)]] }), lines: ['Only the centre is empty, so Light has five opening captures.'] },
  { title: 'Opening choices', lines: ['Three take two stones each. The other two, by the stone beside the centre, take one each.'] },
  { title: 'Winning', lines: ['You win when every stone of your opponent has been captured.'] },
  { title: 'No move', lines: ['If a player has stones but no legal move at all, that player loses.'] },
  { title: 'Draws', lines: [`If ${NO_CAPTURE_LIMIT} turns in a row pass with no capture, the game is a draw.`] },
  { title: 'The draw clock', lines: ['Any capture resets the count. The count is shown under the board.'] },
  { title: 'Taking back', lines: ['Undo returns to the start of your last turn. It is also available mid-chain.'] },
  { title: 'A note on this version', lines: ['Standard rules, plus one simplification: the twenty-turn draw rule.'] },
];

export const HOWTO = [
  { title: 'Choose a stone', lines: ['Tap one of your stones. It lifts, and the points it can reach light up.'] },
  { title: 'Choose a point', lines: ['Tap a lit point to move there. A number shows how many stones the move captures.'] },
  { title: 'Or drag', lines: ['You can also drag a stone and let go on a lit point.'] },
  { title: 'Must capture', lines: ['When a capture is possible you must take it. Stones that can capture pulse gold.'] },
  { title: 'Approach or withdraw', lines: ['If a step can do both, two buttons appear: gold approach, blue withdraw.'] },
  { title: 'Chains', lines: ['After a capture, your stone may keep going. Tap End turn to stop.'] },
  { title: 'Think', lines: ['Think shows a good move with numbered arrows, and what it takes.'] },
  { title: 'Danger', lines: ['Danger rings your stones the opponent could capture next turn.'] },
  { title: 'Undo', lines: ['Undo takes back your last turn. During a chain it returns to the start of that turn.'] },
  { title: 'Levels', lines: ['Choose from six levels, from Beginner to Master. Master looks many turns ahead.'] },
  { title: 'Learn', lines: ['Learn walks you through eight short positions: approach, withdrawal, chains and more.'] },
  { title: 'Watch & Learn', lines: ['Two computers play a whole game: Think, Reveal, Act. Guess the move first.'] },
  { title: 'Pause and pace', lines: ['Pause freezes everything. Plus and minus set the think time.'] },
  { title: 'Keyboard', lines: ['Arrows move, Space taps. U undo, H think, D danger, E end turn.'] },
  { title: 'Text size', lines: ['A- and A+ on every reading page change the text size, up to 300%.'] },
];

export const ABOUT = [
  { title: 'Fanorona', lines: ['A strategy board game from Madagascar, widely regarded as its national game.'] },
  { title: 'The name', lines: ['The name is Malagasy. This is the standard form, played on a board of five lines by nine.'] },
  { title: 'Boards', lines: ['Boards were carved in wood, cut in stone or drawn in the ground, with seeds or pebbles.'] },
  { title: 'Smaller boards', lines: ['Smaller relatives are also played, such as Fanoron-telo on a three by three board.'] },
  { title: 'A famous opening', lines: ['Every game begins the same way: a capture into the single empty point at the centre.'] },
  { title: 'Why it is hard', lines: ['Captures work two ways and chain along changing lines, so positions swing fast.'] },
  { title: 'Solved', lines: ['Computer analysis in 2008 showed the standard game is a draw with perfect play.'] },
  { title: 'This version', lines: ['Every rule, six computer levels, hints, a danger display and short lessons.'] },
  { title: 'Look and sound', lines: ['Drawn in the spirit of carved wood and woven borders.'] },
  { title: 'Thanks', lines: ['Thank you for playing a game that has been enjoyed on the island for generations.'] },
];
export const page = (scene) => (scene === 'rules' ? RULES : scene === 'howto' ? HOWTO : ABOUT);
