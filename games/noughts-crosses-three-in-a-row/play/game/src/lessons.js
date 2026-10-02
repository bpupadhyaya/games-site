// The tutor path. Each lesson is a real position; the answer is judged by the same analysis and solver the
// opponents and Think use, so a lesson can never accept a move the engine knows to be wrong.
import { parse, applyMove, result, other, wordsOf, isPlacing } from './rules.js';
import { scoreMoves } from './solver.js';
import { winSquares, winMoves, forkMoves, markName } from './analysis.js';
import { reasonFor } from './explain.js';

export const LESSONS = [
  { id: 'win', title: 'Three in a row', mode: 'classic', board: 'XX./OO./...', turn: 1, accept: 'win',
    task: 'You are X. You already have two in the top row. Finish the line to win.',
    done: 'That is the goal of the game. Always look for a line where you hold two marks and the third square is empty.' },
  { id: 'block', title: 'Block the threat', mode: 'classic', board: 'OO./X../.X.', turn: 1, accept: 'block',
    task: 'You are X. O has two in the top row and threatens to complete it. Stop it.',
    done: 'A block is always urgent: if the opponent can complete a line next turn, take that square first, unless you can win right now.' },
  { id: 'fork', title: 'Make a fork', mode: 'classic', board: 'XO./O../.X./', turn: 1, accept: 'fork',
    task: 'You are X. Find the square that makes two lines of two at once, so O cannot block both.',
    done: 'A fork is two threats at the same time. The opponent can stop only one, so you win. Forks are how every won game of noughts and crosses is decided.' },
  { id: 'stopfork', title: 'Stop a fork', mode: 'classic', board: 'X../.O./..X', turn: 2, accept: 'safe',
    task: 'You are O. X holds two opposite corners. Which squares are safe? Hint: a corner move lets X fork.',
    done: 'Playing an edge forces X to answer your threat, which breaks up the fork. Always ask: what could my opponent do next to make two threats?' },
  { id: 'centre', title: 'The best openings', mode: 'classic', board: '.../.../...', turn: 1, accept: 'set', cells: [0, 2, 4, 6, 8],
    task: 'You are X and move first. Play one of the strongest first moves: the centre or a corner.',
    done: 'The centre lies on four lines and a corner on three; an edge lies on only two. Strong openings give you more ways to make a fork.' },
  { id: 'corner', title: 'Answer a corner', mode: 'classic', board: 'X../.../...', turn: 2, accept: 'best',
    task: 'You are O. X opened in a corner. There is exactly one reply that does not lose. Find it.',
    done: 'The centre is the only safe reply to a corner opening. Every other reply lets X build a fork.' },
  { id: 'draw', title: 'Perfect play is a draw', mode: 'classic', type: 'game', level: 'perfect', human: 1,
    task: 'Play a whole game as X against the Perfect opponent. Block every threat and stop every fork, and the game will end in a draw.',
    done: 'A draw is not a failure: with perfect play from both sides, classic noughts and crosses is always a draw. The Perfect opponent never misses; you can only lose by missing something, and you can only win if it does.' },
  { id: 'misere', title: 'Misère: do not make three', mode: 'misere', board: 'XX./OO./...', turn: 1, accept: 'safe',
    task: 'In Misère, completing three in a row loses. You are X. Pick a safe square: one that does not lose.',
    done: 'Think backwards: you want the opponent to run out of safe squares. In Misère the centre is the only opening that does not lose against perfect play.' },
  { id: 'terni-open', title: 'Terni Lapilli: the centre', mode: 'terni', board: '.../.../...', turn: 1, accept: 'best',
    task: 'This is the Roman game: three pieces each, placed, then slid along the lines. As the first player, open with the best point.',
    done: 'In Terni Lapilli the first player who opens in the centre can force a win; an edge opening loses and a corner opening only draws. The centre is joined to every other point.' },
  { id: 'terni-slide', title: 'Terni Lapilli: slide to win', mode: 'terni', board: 'XX./OXO/O../', turn: 1, accept: 'win',
    task: 'All six pieces are placed, so now you slide. You are X. Slide one piece along a line to make three in a row.',
    done: 'Sliding along a line, diagonals included, can complete a row in one step. Moving a piece also unblocks the point it left, so check what your move gives away.' },
  { id: 'quad', title: 'Quad: four in a square', mode: 'quad', board: 'O..O/.XX./.X../...O', turn: 1, accept: 'win',
    task: 'On the 4x4 board a 2x2 square of your marks also wins. You are X. Complete a square or a line.',
    done: 'Squares make 4x4 much sharper than a plain four in a row: every mark can be part of many threats at once.' },
];

export const lessonStart = (L) => (L.board ? parse(L.mode, L.board, L.turn) : null);

// Judge a move in a lesson. Returns { ok, text }.
export function judge(L, st, mv) {
  const me = st.turn, opp = other(me), O = markName(opp);
  const after = applyMove(st, mv);
  const list = scoreMoves(st);
  const mine = list.find((x) => x.mv.from === mv.from && x.mv.to === mv.to);
  const best = Math.max(...list.map((x) => x.s));
  const r = result(after);
  const explain = reasonFor(st, mv, list).why;
  let ok = false, why = '';
  switch (L.accept) {
    case 'win':
      ok = Boolean(r && r.winner === me);
      why = winSquares(st, me).length ? 'You have a move that wins right now. Look for a line with two of your marks and an empty third square.' : 'Look for a line where you hold two marks.';
      break;
    case 'block':
      ok = !winMoves(after, opp).length;
      why = `${O} would complete three in a row next turn. Take the square ${O} needs.`;
      break;
    case 'fork':
      ok = winSquares(after, me).length >= 2;
      why = 'A fork needs two separate lines that each hold two of your marks and an empty third square.';
      break;
    case 'safe':
      ok = mine.s >= 0 && !(r && r.winner === opp);
      why = r && r.winner === opp ? 'That completes a line, which loses here.' : forkMoves(after, opp).length ? `${O} could then make a fork and win.` : `That loses against best play.`;
      break;
    case 'set':
      ok = L.cells.includes(mv.to);
      why = 'That works, but an edge lies on fewer lines. Try the centre or a corner.';
      break;
    default: // 'best'
      ok = mine.s === best;
      why = mine.s < best ? (mine.s < 0 ? 'That loses against perfect play.' : 'That is not the strongest move here.') : '';
  }
  return ok ? { ok, text: `${explain} ${L.done}` } : { ok, text: `Not quite. ${why}` };
}
export { wordsOf, isPlacing };
