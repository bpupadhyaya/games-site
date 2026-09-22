// Learn to play: short hands-on lessons. Each is a position, a sentence, and what counts as doing it right.
//   n: board size (6). Either `rows` (six strings of 'B' 'W' '.' from the top) or `holes` (squares emptied from a full board).
//   turn: 1 black | 2 white; ply: 0 = black's opening removal, 1 = white's, 2 = normal play (default)
//   want: 'remove' | 'jump' (any jump; `hops` = minimum stones jumped, `at` = allowed landing squares) | 'refused' | 'win' (a jump that leaves the opponent without a jump)
//   mark: squares that pulse to show where to look;  text / done / hint: what to say
import { newGame, clone } from './rules.js';
const at = (x, y) => x + 6 * y;
export const LESSONS = [
  { title: 'The slab and the stones', turn: 1, ply: 0, holes: [], want: 'remove',
    text: 'Black and white stones fill the slab. Black moves first and takes away ONE black stone from a glowing square (a corner or the middle). TAP a glowing square.',
    done: 'That square is now empty. Jumps need empty squares to land on.' },
  { title: 'White takes one too', turn: 2, ply: 1, holes: [at(2, 2)], want: 'remove',
    text: 'Now White takes away one white stone that touches the empty square. TAP a glowing white stone.',
    done: 'Two stones are gone and the game can begin. Black jumps first.' },
  { title: 'Your first jump', turn: 1, ply: 2, holes: [at(2, 2), at(3, 2)], want: 'jump', mark: [at(2, 2)],
    text: 'Jump over an enemy stone into an empty square right behind it. TAP a black stone, then TAP a glowing square.',
    done: 'The white stone you jumped is captured and lifted off the slab.' },
  { title: 'Jump again, in a line', turn: 1, ply: 2, holes: [at(2, 2), at(4, 2)], want: 'jump', hops: 2, at: [at(4, 2)], mark: [at(0, 2), at(4, 2)],
    text: 'One move may hop over several stones, if you keep going straight. TAP the black stone at the far left of the marked row, then TAP the far glowing square.',
    hint: 'That is a single hop. This time TAP the far end of the row, over both white stones.',
    done: 'Two captures in one move. You may also stop after any hop.' },
  { title: 'No turning corners', turn: 1, ply: 2, holes: [at(2, 2), at(2, 4)], want: 'refused', from: at(0, 2), mark: [at(0, 2), at(2, 4)],
    text: 'A jump can never turn. TAP the black stone at the left of the marked row, then TAP the far square below to try it.',
    done: 'Refused, and the slab told you why: jumps stay in one straight line.' },
  { title: 'Only one jump', turn: 1, ply: 2, rows: ['BW....', '......', '......', '......', '....BW', '......'], want: 'jump', at: [at(2, 0)],
    text: 'When you can jump you must: there is no passing. Only one jump exists here. Find it.',
    hint: 'Only the black stone in the top-left corner can jump. TAP it, then TAP the glowing square.',
    done: 'Correct. In Konane you can always work out every jump you have.' },
  { title: 'The last jumper wins', turn: 1, ply: 2, rows: ['BW....', '......', '.....W', '......', '......', '......'], want: 'win', at: [at(2, 0)],
    text: 'The player who cannot jump loses. If you jump here, can White still jump? Make the move that leaves White without one.',
    done: 'White has no jump. You win! Every game ends this way.' },
  { title: 'Keep going, or stop?', turn: 1, ply: 2, rows: ['BW.W..', '......', '.....W', '......', '......', '......'], want: 'win', at: [at(4, 0)],
    text: 'If you stop after one hop, the white stone beside you could jump back. Find the move that leaves White with nothing.',
    hint: 'Try the far square: hop over both white stones in one move.',
    done: 'Stopping early gave White a reply. Going on won. Count their jumps before you choose.' },
];
export function lessonGame(l) {
  const g = newGame(l.n ?? 6);
  if (l.rows) g.b = l.rows.join('').split('').map((c) => (c === 'B' ? 1 : c === 'W' ? 2 : 0));
  else for (const h of l.holes) g.b[h] = 0;
  g.turn = l.turn; g.ply = l.ply ?? 2; g.hole = l.holes && l.holes.length ? l.holes[0] : -1;
  return clone(g);
}
