// The Learn path: six lessons. Five are real positions where one idea decides the move; the sixth is a whole game.
// Positions were found by search (dev/find-lessons.mjs) so that the right answer is unique, then fixed here.
import { outcome, legalMoves, play } from './engine.js';
import { bestReply, moveWords } from './explain.js';
import { tr } from './content.js';

const mk = (cells, pd) => ({ cells, pd, turn: 1, plies: 0, over: null });

export const LESSONS = [
  { id: 'capture', type: 'task', judge: 'best', state: mk([2, 0, 1, 0, 5, 0, 1, 1, 0, 0, 0, 2, 0, 2, 1, 1, 3, 0], [17, 18]) },
  { id: 'relay', type: 'task', judge: 'best', state: mk([1, 1, 3, 6, 0, 2, 2, 0, 1, 5, 0, 1, 0, 0, 5, 2, 1, 1], [11, 12]) },
  { id: 'column', type: 'task', judge: 'best', state: mk([1, 5, 8, 1, 0, 1, 2, 1, 0, 1, 0, 1, 0, 0, 6, 1, 0, 0], [8, 18]) },
  { id: 'wrap', type: 'task', judge: 'best', state: mk([0, 0, 6, 0, 0, 1, 3, 0, 2, 0, 1, 0, 0, 1, 5, 0, 1, 0], [15, 19]) },
  { id: 'defend', type: 'task', judge: 'defend', state: mk([2, 1, 1, 0, 0, 0, 3, 1, 6, 5, 0, 1, 5, 0, 0, 2, 1, 1], [13, 12]) },
  { id: 'game', type: 'game', level: 'novice', human: 1 },
];

// The lesson wording is English in both language modes (only menus, buttons and game screens are translated).
const TEXT = {
  capture: { title: 'Capture a column', task: 'Find the move that captures. Its last seed must fall into one of your empty holes, with the opponent\'s seeds in the same column.', done: 'Right: the last seed fell into an empty hole of yours, and every opponent seed in that column was captured. Look down the column before you choose.' },
  relay: { title: 'Keep sowing', task: 'Find the move that captures the most. Remember: when the last seed falls into a hole that already holds seeds, you pick them all up and sow on.', done: 'Right: the sowing carried on through a hole that was not empty and only stopped, with a capture, in an empty one. Always follow the relay to its end before you choose.' },
  column: { title: 'Two holes at once', task: 'The middle row is shared out: half of it is the opponent\'s. Find the move whose capture takes seeds from both of the opponent\'s holes in a column.', done: 'Right: in the columns where the middle hole is the opponent\'s, a capture takes the middle hole and the top hole together.' },
  wrap: { title: 'Round the corner', task: 'Your nine holes form a loop: the near row, then back along your half of the middle row, then round to the start. Find the move whose sowing wraps round and captures.', done: 'Right: after your last middle hole the sowing returns to the first hole of your near row, and the capture came from going all the way round.' },
  defend: { title: 'Defend', task: 'Nothing can be captured this turn. Find the move that leaves the opponent no good capture in reply.', done: 'Right: your move left the opponent no good capture. Before every move, look at what the other side could take in answer.' },
  game: { title: 'A whole game', task: 'Play a whole game against the Novice opponent.', done: 'Well played: you finished a whole game.' },
};
export const lessonText = (id) => TEXT[id];

export function lessonStart(L) { return L.state; }

// Is the move right? Returns { ok, text } (text: why not, or why yes).
export function judge(L, st, mv) {
  const outs = legalMoves(st).map((m) => ({ m, o: outcome(st, m) }));
  const mine = outs.find((x) => x.m.cell === mv.cell).o;
  if (L.judge === 'best') {
    const best = Math.max(...outs.map((x) => x.o.gain));
    if (mine.gain >= best) return { ok: true, text: lessonText(L.id).done };
    return { ok: false, text: mine.gain === 0 ? tr('lessonWrongNone') : tr('lessonWrongLess', { a: mine.gain, b: best }) };
  }
  const reps = outs.map((x) => bestReply(x.o.after));
  const min = Math.min(...reps), my = bestReply(mine.after);
  if (my <= min) return { ok: true, text: lessonText(L.id).done };
  return { ok: false, text: tr('lessonWrongDef', { a: my }) };
}
export { moveWords, play };
