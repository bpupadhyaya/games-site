// The tutor path. Each lesson is a real position; the answer is judged by the game engine itself (the same capture and threat
// tests the opponents and Think use), so a lesson can never accept a move the engine knows to be wrong.
// Boards: X = Ivory soldier, x = Ivory dux, O = Jet soldier, o = Jet dux, . = empty; eight rows of eight. The learner is Ivory.
import { parse, applyMove, legalMoves, bestYield, quickGain, other } from './rules.js';
import { tr, soldiersObj } from './content.js';

export const LESSONS = [
  { id: 'slide', title: 'How pieces slide', accept: 'target', marks: [19], focus: [51],
    board: 'O......./.......o/......../......../......../......../...X..../x.......', turn: 1,
    task: 'A piece slides along its row or column over empty squares, like a rook. Slide the marked soldier up the file to the marked square.',
    done: 'A piece can go as far as the empty squares allow, in a straight line along a row or a column. It cannot jump over a piece and cannot go diagonally.' },
  { id: 'capture', title: 'Capture by sandwich', accept: 'bestturn',
    board: 'O......./......../......../......../...OX.../......../..X...../x......o', turn: 1,
    task: 'Find the slide that traps a Jet soldier between two of your pieces, in a row or a column.',
    done: 'You capture by moving a piece so that an enemy soldier has one of yours on each side. The taken soldier is removed at once.' },
  { id: 'double', title: 'Two at once', accept: 'bestturn',
    board: '.......o/......../......../.XO.OX../......../......../...X..../x.......', turn: 1,
    task: 'One slide can close two sandwiches. Find the move that takes two soldiers.',
    done: 'The piece you slide can close several sandwiches at once, in any of its directions. Look for a square with an enemy on two sides, each backed by one of your pieces.' },
  { id: 'between', title: 'Between two enemies', accept: 'target', marks: [27], focus: [51],
    board: '.......o/......../......../..O.O.../......../......../...X..../x.......', turn: 1,
    task: 'Slide your soldier into the gap between the two Jet soldiers. It is safe there.',
    done: 'Only the piece that moves can capture. A piece that slides in between two enemies is not taken, and it blocks both of them from closing the gap.' },
  { id: 'edge', title: 'Along the edge', accept: 'bestturn',
    board: '..XO...o/......../......../......../....X.../......../......../x.......', turn: 1,
    task: 'A soldier on the edge can only be taken along the edge. Take the Jet soldier on the top edge.',
    done: 'On an edge there is no square beyond a soldier across the edge, so a sandwich can only run along it.' },
  { id: 'corner', title: 'The corner soldier', accept: 'bestturn',
    board: 'O..X...o/X......./......../......../......../......../......../x.......', turn: 1,
    task: 'A soldier in a corner is taken by the two squares beside it. One is already yours: take the Jet soldier in the corner.',
    done: 'A corner soldier has no line through it, so it falls when your pieces hold both squares beside the corner.' },
  { id: 'safe', title: 'Do not get sandwiched', accept: 'safe',
    board: 'o......./......../......../..OX...O/......../......../......../...x....', turn: 1,
    task: 'A Jet soldier is about to slide in and take your soldier. Make a move after which Jet cannot capture anything.',
    done: 'Before every move ask what the other side could take next. You can move the soldier away, or fill the square the enemy needs.' },
  { id: 'dux', title: 'Enclose the dux', accept: 'win',
    board: 'O......./......../...X..../..Xo...X/...X..../......../......../x.......', turn: 1,
    task: 'The Jet dux stands in the open with three of your pieces beside it. Close the fourth side and win.',
    done: 'The dux cannot be sandwiched, but when every square beside it is held by the other side or is off the board, it is lost. In the middle that takes four pieces, on an edge three, in a corner two.' },
  { id: 'guard', title: 'Guard your dux', accept: 'duxsafe',
    board: 'o......./......../......../......../.X....../......../O......./x......O', turn: 1,
    task: 'Your dux is in the corner with a Jet soldier above it, and another Jet soldier can slide in on its right to enclose it. Stop that.',
    done: 'A dux in a corner is enclosed by only two pieces. Move it out, or put a piece of your own beside it: a friendly piece keeps it safe.' },
  { id: 'blocked', title: 'No moves left', accept: 'blockade', finish: 'accept',
    board: 'OoX...../X.....X./......../......../......../......../......../.......x', turn: 1,
    task: 'The Jet pieces in the corner are nearly boxed in. Make the move that leaves Jet with no move at all.',
    done: 'A side with no legal move loses. Here every Jet piece is blocked, so Jet cannot move and Ivory wins.' },
];
export const lessonTitle = (l) => l.title;
export const lessonTask = (l) => l.task;
export const lessonDone = (l) => l.done;

export function lessonStart(L) { return parse(L.board, L.turn); }

// The most soldiers this move takes (9 for enclosing the dux).
export const turnValue = (st, mv) => quickGain(st.cells.slice(), mv, st.turn);

// Judge a move in a lesson. Returns { ok, text }.
export function judge(L, st, mv) {
  const foe = other(st.turn);
  if (L.accept === 'target') {
    if (L.marks.includes(mv.to) && (!L.focus || L.focus.includes(mv.from))) return { ok: true, text: L.done };
    return { ok: false, text: tr('jTarget') };
  }
  if (L.accept === 'bestturn') {
    const best = Math.max(...legalMoves(st).map((m) => turnValue(st, m)));
    const mine = turnValue(st, mv);
    if (mine === best) return { ok: true, text: L.done };
    if (mine === 0) return { ok: false, text: tr('jNothing') };
    return { ok: false, text: tr('jLess', { a: soldiersObj(mine), b: soldiersObj(best) }) };
  }
  if (L.accept === 'safe') {
    const n = applyMove(st, mv);
    const y = n.over ? 0 : bestYield(n, foe);
    if (y === 0) return { ok: true, text: L.done };
    return { ok: false, text: tr('jUnsafe', { n: soldiersObj(y >= 99 ? 1 : y) }) };
  }
  if (L.accept === 'win') {
    const n = applyMove(st, mv);
    if (n.over && n.over.winner === st.turn && n.over.why === 'dux') return { ok: true, text: L.done };
    return { ok: false, text: tr('jWin') };
  }
  if (L.accept === 'duxsafe') {
    const n = applyMove(st, mv);
    if (n.over) return { ok: false, text: tr('jDuxUnsafe') };
    if (bestYield(n, foe) < 99) return { ok: true, text: L.done };
    return { ok: false, text: tr('jDuxUnsafe') };
  }
  if (L.accept === 'blockade') {
    const n = applyMove(st, mv);
    if (n.over && n.over.why === 'blocked' && n.over.winner === st.turn) return { ok: true, text: L.done };
    return { ok: false, text: tr('jBlock') };
  }
  return { ok: true, text: L.done };
}
