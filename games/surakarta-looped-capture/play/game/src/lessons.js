// The Learn path. Each lesson is a real position; the answer is judged by the real rules engine (the same one the
// opponents and Think use), so a lesson can never accept a move the engine does not allow. The player is always Light.
import { parse, applyMove, attackedBy } from './rules.js';

export const LESSONS = [
  { id: 'step', title: 'Step one point', board: 'OOOOOO/OOOOOO/....../....../XXXXXX/XXXXXX', turn: 1, accept: 'step',
    task: 'You are Light, at the bottom. A piece that is not capturing moves one step to any free neighbouring point, forwards, sideways or diagonally. Step any piece.',
    done: 'That is every quiet move in the game: one step, in any of eight directions, onto a free point. The real action is in the captures.' },
  { id: 'outer', title: 'Capture round a loop', board: '.....O/.....O/..O.../....../....X./X.....', turn: 1, accept: 'capture',
    task: 'Select your piece near the bottom right (the one that is not in the corner). A glowing route shows its one capture: it runs along the outer circuit, round a loop in the corner and onto a Dark piece. Make that capture.',
    done: 'A capture travels along a circuit (here the outer one, the gold line) over empty points and must pass round at least one loop before it lands on an enemy piece.' },
  { id: 'inner', title: 'The inner circuit', board: 'O...../....O./O...../X.X.../....../......', turn: 1, accept: 'capture',
    task: 'The inner circuit (the green line) has the big loops. One of your pieces can capture along it. Select a piece to see its route, then capture.',
    done: 'The inner circuit uses the third and fourth lines and the large loops. Pieces on a crossing point can use either circuit.' },
  { id: 'own', title: 'Through your own square', board: '.....O/O....O/...O../...X../....../.....X', turn: 1, accept: 'capture',
    task: 'The Dark piece right above your piece in the middle looks too close to capture, but it can be. Select your piece and see how the route leaves the board and comes back.',
    done: 'The moving piece may pass over the point it started from, because that point is empty once it has left. Here the route swings round a loop and crosses its own starting point on the way.' },
  { id: 'defend', title: 'Defend a piece', board: '.O...O/....O./O...X./....OX/....../X..X..', turn: 1, accept: 'safe',
    task: 'One of your pieces is under attack: a Dark piece can reach it along a circuit. There is no capture for you, so move to safety. Find a move after which none of your pieces can be captured. (Think shows the threats too.)',
    done: 'Stepping off the circuit line the attacker uses, or blocking the path, ends the threat. Before every move ask: which of my pieces can they capture now?' },
  { id: 'trap', title: 'Look before you capture', board: '.OO.O./OO...O/....../X..X.X/..X.X./.X....', turn: 1, accept: 'safecap',
    task: 'You have two captures. One leaves your capturing piece, or others, open to a capture back; the other is clean. Find the clean one: after it, none of your pieces can be captured.',
    done: 'A capture lands your piece on the enemy point. If a Dark piece can reach that point along a circuit, it takes your piece back. Check the landing point first.' },
  { id: 'game', title: 'Play a whole game', type: 'game', level: 'casual', human: 1,
    task: 'Play a full game as Light against the Casual opponent. Win by capturing every Dark piece (or having more pieces when 60 moves pass without a capture).',
    done: 'Well played. Every Surakarta game is a mix of what you have just practised: keep your pieces off live circuits, and look for captures that cannot be taken back.' },
];

export const lessonStart = (L) => (L.board ? parse(L.board, L.turn) : null);

// Judge a move in a lesson. Returns { ok, text }.
export function judge(L, st, mv) {
  const after = applyMove(st, mv);
  const cap = st.cells[mv.to] !== 0;
  const threats = attackedBy(after.cells, 2).size;
  let ok = false, why = '';
  switch (L.accept) {
    case 'step':
      ok = !cap;
      why = 'That was a capture. Here, just step one point.';
      break;
    case 'capture':
      ok = cap;
      why = 'That was only a step. Select your piece to see its glowing capture route, then tap the Dark piece at the end of it.';
      break;
    case 'safe':
      ok = threats === 0;
      why = `After that move ${threats === 1 ? 'a piece of yours can' : 'pieces of yours can'} still be captured. Use the threat view (the eye button) to see the danger, then find a step that ends it.`;
      break;
    case 'safecap':
      ok = cap && threats === 0;
      why = !cap ? 'That is a step. Look for the clean capture.' : 'That capture can be answered: a Dark piece can capture one of yours afterwards. Try the other capture.';
      break;
    default:
      ok = true;
  }
  return ok ? { ok, text: L.done } : { ok, text: `Not quite. ${why}` };
}
