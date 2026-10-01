// The Learn mode: short guided positions. Each lesson sets up a small board (5 rows of 9 characters: L = Light,
// D = Dark, . = empty; row 0 is the left-hand line on screen) and asks the player to make one kind of move.
// `goal(entry)` receives the finished turn { steps:[{from,to,kind,victims}], taken } and says whether it counts.
import { EMPTY, LIGHT, DARK, idx, startBoard } from './rules.js';

export const boardFromRows = (rows) => {
  const b = new Array(45).fill(EMPTY);
  rows.forEach((row, r) => { for (let c = 0; c < 9; c++) b[idx(r, c)] = row[c] === 'L' ? LIGHT : row[c] === 'D' ? DARK : EMPTY; });
  return b;
};
const taken = (e) => e.steps.reduce((a, s) => a + s.victims.length, 0);

export const LESSONS = [
  {
    title: 'Approach',
    text: 'To APPROACH, move a stone one step straight toward an enemy stone. The line of enemy stones right in front of it is captured. Tap your stone, then the glowing point.',
    rows: ['L........', '.........', '..L.DD...', '.........', '........D'],
    goal: (e) => e.steps[0].kind === 'approach' && taken(e) >= 2,
    fail: 'Move your stone toward the two Dark stones to approach them.',
  },
  {
    title: 'Withdrawal',
    text: 'To WITHDRAW, move a stone one step straight AWAY from an enemy stone. The line of enemies right behind the point you left is captured.',
    rows: ['........L', '.........', '.DDL.....', '.........', 'D........'],
    goal: (e) => e.steps[0].kind === 'withdraw' && taken(e) >= 2,
    fail: 'Step directly away from the Dark stones to withdraw from them.',
  },
  {
    title: 'Your choice',
    text: 'One step can sometimes do both. Then you choose: approach the line ahead, or withdraw from the line behind. Pick the bigger capture.',
    rows: ['.........', '.........', '.DDL.DDD.', '.........', '.........'],
    goal: (e) => taken(e) >= 3,
    fail: 'Both captures are open. Choose the one that takes three stones.',
  },
  {
    title: 'Capture chains',
    text: 'After a capture, the same stone may keep capturing along a different line. It cannot return to a point it has stood on this turn, or move the same way twice in a row.',
    rows: ['.........', 'DD.......', '..L.D....', '...D.....', '...D.....'],
    goal: (e) => e.steps.length >= 3,
    fail: 'Keep going with the same stone: three captures in one turn.',
  },
  {
    title: 'Capturing is compulsory',
    text: 'When any of your stones can capture, you must capture. Stones that cannot are not allowed to move. Your capturing stone glows.',
    rows: ['.........', '.L.D.....', '.........', '.........', 'L.....D..'],
    goal: (e) => taken(e) >= 1,
    fail: 'Only the glowing stone may move. Capture with it.',
  },
  {
    title: 'The quiet move',
    text: 'If no stone can capture, you move one stone one step to an empty point, with no capture. This is called paika. Use it to set a trap.',
    rows: ['.........', '.L.......', '.........', '.....D...', '.........'],
    goal: (e) => e.steps[0].kind === 'paika',
    fail: 'Nothing can capture right now. Move any stone one step.',
  },
  {
    title: 'Strong points',
    text: 'Diagonal lines run only through the strong points, the ones marked with a ring. A stone standing on one can capture along a diagonal.',
    rows: ['.........', '.........', '..L......', '.........', '....D....'],
    goal: (e) => [0, 2, 5, 7].includes(e.steps[0].d) && taken(e) >= 1,
    fail: 'Use the diagonal line from your stone on the strong point.',
  },
  {
    title: 'The opening',
    text: 'In the real game, Light always begins with a capture into the empty centre. There are five ways to open. Try any one and see what it takes.',
    rows: null,
    goal: (e) => taken(e) >= 1,
    fail: 'Move a stone into the centre point to open.',
  },
];
export const lessonBoard = (i) => (LESSONS[i].rows ? boardFromRows(LESSONS[i].rows) : startBoard());
