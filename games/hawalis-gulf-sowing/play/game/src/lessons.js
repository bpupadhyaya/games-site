// The Learn path: six lessons. Five are real positions where one idea decides the move; the sixth is a whole game.
// Positions were found by search (dev/find-lessons.mjs) so that the right answer is unique, then fixed here.
import { outcome, legalMoves, play } from './engine.js';
import { bestReply, moveWords } from './explain.js';
import { tr } from './content.js';

const mk = (cells, pd) => ({ cells, pd, turn: 1, plies: 0, over: null });

export const LESSONS = [
  { id: 'capture', type: 'task', judge: 'best', state: mk([0,0,0,1,1,0,1,0,4,3,0,0,0,1,1,1,0,1,4,4,1,3,0,3,0,0,3,0], [17, 7]) },
  { id: 'both', type: 'task', judge: 'best', state: mk([3,0,0,0,4,1,1,2,1,0,1,2,2,0,4,0,0,3,1,0,0,3,0,3,0,0,4,1], [11, 9]) },
  { id: 'relay', type: 'task', judge: 'best', state: mk([0,3,1,1,0,0,2,3,3,1,0,3,0,2,0,2,0,4,1,2,4,3,0,1,1,0,1,0], [9, 9]) },
  { id: 'outer', type: 'task', judge: 'best', state: mk([0,1,3,0,3,2,0,1,2,0,0,4,2,1,0,3,0,3,3,0,0,1,0,2,2,1,0,0], [9, 13]) },
  { id: 'defend', type: 'task', judge: 'defend', state: mk([0,1,0,0,1,3,1,0,0,0,1,2,0,4,1,4,2,4,0,0,4,0,2,0,0,1,1,1], [15, 8]) },
  { id: 'game', type: 'game', level: 'novice', human: 1 },
];

// The lesson wording is plain English.
const TEXT = {
  capture: { title: 'Capture from the inner row', task: 'Find the move that captures. Its last seed must land in a hole of your inner row (the row next to the middle of the board) that faces a hole of your opponent that holds seeds.', done: 'Right: your last seed fell in an inner-row hole, and the opponent\'s hole facing it held seeds, so they were captured. Count each hole\'s sowing to its end before you choose.' },
  both: { title: 'Two holes at once', task: 'Find the move that captures from both opponent holes in a column: the inner hole facing your landing hole, and the outer hole behind it.', done: 'Right: when the facing hole and the outer hole behind it both hold seeds, a capture takes both. That is the biggest prize on the board.' },
  relay: { title: 'Keep sowing', task: 'Find the move that captures the most. When your last seed falls in a hole that already holds seeds (and there is no capture), you pick them all up and sow on.', done: 'Right: the sowing carried on through full holes and only the final seed captured. Always follow a relay to its end before you choose.' },
  outer: { title: 'The outer row never captures', task: 'Some of these moves end on your outer row, where nothing can be captured. Find the one move that captures.', done: 'Right: only a last seed that lands in an inner-row hole can capture. A last seed in your outer row just carries on, or ends the turn.' },
  defend: { title: 'Defend', task: 'Nothing can be captured this turn. Find the move that leaves the opponent no capture in reply.', done: 'Right: your move left the opponent no capture. Before every move, look at what the other side could take in answer.' },
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
