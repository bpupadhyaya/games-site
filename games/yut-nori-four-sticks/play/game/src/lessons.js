// Learn to play: ten short hands-on lessons. A lesson is a position, the throws it will give you, a sentence, and what counts.
// Fields: blue / red: token positions ([pos, n]) ; wait / home: tokens off the board / finished ([blue, red]);
//   phase: 'throw' (the sticks are yours to throw) or 'move' with pending: the throws already held;
//   force: the throws the sticks will show (so every learner sees the same thing);
//   goal: 'throw' (count), 'move' (any move, optional `to` list), 'short', 'stack', 'capture', 'back', 'home', 'both' (spend every held throw)
import { newGame } from './rules.js';

export const LESSONS = [
  { title: 'Throw the sticks', blue: [], red: [], phase: 'throw', force: [2], goal: 'throw', count: 1,
    texts: ['TAP the felt pad, or SWIPE up on it, to throw the four sticks. Then read what landed.'],
    done: 'Two flat sides up is GAE: 2 steps. One flat side is DO (1 step), three is GEOL (3), all four is YUT (4), none is MO (5).' },
  { title: 'Bring a token in', blue: [], red: [], phase: 'move', pending: [3], goal: 'move', to: [3],
    texts: ['You threw GEOL: 3 steps. TAP a waiting token, then TAP the glowing point.'],
    done: 'A token enters the track counting from the start corner. The track runs counter-clockwise: up the right side first.' },
  { title: 'Yut and mo throw again', blue: [], red: [], phase: 'throw', force: [4, 2], goal: 'throw', count: 2,
    texts: ['Throw the sticks. A lucky throw earns another one.', 'Four flat sides: that is YUT, 4 steps, and you throw AGAIN. TAP the pad again.'],
    done: 'Yut (four flat) and mo (no flat) both earn another throw. You keep every throw and spend them afterwards.' },
  { title: 'Two throws to spend', blue: [[3, 1]], red: [[10, 1]], wait: [3, 3], phase: 'move', pending: [2, 1], goal: 'both',
    texts: ['You hold GAE and DO. TAP a throw chip to choose which to spend, then move a token. Spend both.'],
    done: 'Each throw can go on any token, in any order. Choose the order that helps you most.' },
  { title: 'The corner shortcut', blue: [[5, 1]], red: [[12, 1]], wait: [3, 3], phase: 'move', pending: [2], goal: 'short', to: [21],
    texts: ['A token standing on a corner may leave by the diagonal. TAP the token, then the glowing point on the diagonal, heading to the middle.'],
    done: 'The diagonal is much shorter. Only a token that starts its move ON a corner may take it: passing a corner does not count.',
    hint: 'Choose the glowing point on the diagonal, the one heading toward the middle of the board.' },
  { title: 'The middle point', blue: [[22, 1]], red: [[12, 1]], wait: [3, 3], phase: 'move', pending: [2], goal: 'move', to: [28],
    texts: ['A token that stops on the middle point goes home the short way. TAP it, then the glowing point.'],
    done: 'From the middle the way home is only 3 steps. A token that just passes through the middle keeps going straight on.' },
  { title: 'Stack your tokens', blue: [[3, 1], [6, 1]], red: [[13, 1]], wait: [2, 3], phase: 'move', pending: [3], goal: 'stack',
    texts: ['Land exactly on your own token and they stack: they travel together. TAP the token on 3 steps away from your other token, then the point where the other one stands.'],
    done: 'A stack moves as one with every throw, and it is captured as one. Fast, but risky.',
    hint: 'Move the rear token forward 3 steps so that it lands on your own token.' },
  { title: 'Capture', blue: [[6, 1]], red: [[8, 1]], wait: [3, 3], phase: 'move', pending: [2], goal: 'capture',
    texts: ['Land exactly on a rival token to capture it. The glowing red point holds one. TAP your token, then that point.'],
    done: 'The rival goes back to the start and you earn an extra throw. Passing over a rival does nothing.',
    hint: 'Your token is 2 steps behind the red token. TAP your token, then TAP the red one.' },
  { title: 'Back-do', blue: [[8, 1]], red: [[7, 1]], wait: [3, 3], phase: 'move', pending: [-1], goal: 'back',
    texts: ['One stick carries a red mark. If it is the ONLY flat side, the throw is BACK-DO: one step backward. TAP your token, then the point behind it.'],
    done: 'Back-do moves a token one step back the way it came, and it can capture too. It gives no extra throw. With no token on the board it is lost.' },
  { title: 'Going home', blue: [[18, 1]], red: [[12, 1]], wait: [3, 3], phase: 'move', pending: [4], goal: 'home',
    texts: ['Your token is close to home. YUT is 4 steps: TAP the token, then the glowing start corner.'],
    done: 'Reaching OR passing the start corner brings a token home. The first team to bring all four home wins.' },
];

const defPrev = (p) => (p === 1 ? -1 : { 20: 5, 21: 20, 22: 21, 23: 22, 24: 23, 25: 10, 26: 25, 27: 22, 28: 27 }[p] ?? p - 1);
export function lessonGame(l) {
  const s = newGame(0);
  const put = (t, list) => { for (const [pos, n] of list || []) { s.g[t].push({ pos, n, prev: defPrev(pos) }); } };
  put(0, l.blue); put(1, l.red);
  const on = (t) => s.g[t].reduce((a, g) => a + g.n, 0);
  s.wait = l.wait ? l.wait.slice() : [4 - on(0), 4 - on(1)];
  s.home = l.home ? l.home.slice() : [0, 0];
  s.phase = l.phase; s.pending = (l.pending || []).slice();
  return s;
}
