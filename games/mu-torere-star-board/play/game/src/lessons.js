// Learn-to-play content as data. Each lesson is a real position; the player makes every move.
// Fields: board (9 chars: '0' empty, '1' Shell, '2' Greenstone; the first 8 are the star points clockwise from the top,
// the 9th is the putahi), turn (the side the player controls), steps[]. A step:
//   text   what to do (uses the same verbs everywhere: TAP a stone, TAP a glowing point, or DRAG it there)
//   want   'refuse' {from,to}: try this move and be told why not | 'moves' [{from,to}] | 'any' | 'ring' | 'safe' | 'best'
//   show   points that pulse to draw the eye
//   hint   what to say when the wrong (legal) move is tried
// After each step that is not the last, the computer's forced or best reply is played by itself.
import { wonPositions } from './solver.js';

export const LESSONS = [
  { title: 'The star', board: '111122220', turn: 1, steps: [
    { text: 'Four Shell stones (pale) face four Greenstone stones on an eight-pointed star. The pit in the middle is the putahi. Try it: TAP the Shell stone on the right, then TAP the putahi.', want: { kind: 'refuse', from: 2, to: 8 }, show: [2, 8] },
  ] },
  { title: 'Into the putahi', board: '111122220', turn: 1, steps: [
    { text: 'A stone may enter the putahi only when it stands beside an enemy stone. Only the two ends of your row do. TAP one of them, then TAP the putahi.', want: { kind: 'moves', moves: [{ from: 0, to: 8 }, { from: 3, to: 8 }] }, show: [0, 3, 8], hint: 'Use a stone at either end of your row: they stand beside Greenstone.' },
    { text: 'Your stone in the putahi may step out to any empty point. TAP it, then TAP an empty point (or DRAG it there).', want: { kind: 'any' } },
  ] },
  { title: 'Around the rim', board: '012122211', turn: 1, steps: [
    { text: 'Stones also slide one step along the rim into an empty point. TAP a stone next to the gap, then TAP the gap.', want: { kind: 'ring' }, show: [0], hint: 'Slide along the rim: pick a stone beside the empty point, not the one in the putahi.' },
  ] },
  { title: 'Stuck means beaten', board: '011122221', turn: 1, steps: [
    { text: 'You win when your opponent has no legal move. One move here leaves Greenstone completely stuck. Find it.', want: { kind: 'best' }, hint: 'Greenstone still has a move after that. Try the other one.' },
  ] },
  { title: 'Look before you slide', board: '101212212', turn: 1, steps: [
    { text: 'Two moves are possible and one walks into a trap. Think about what Greenstone can do next, then move.', want: { kind: 'safe' } },
    { text: 'Good. Keep it safe: again one move is a trap.', want: { kind: 'safe' } },
  ] },
  { title: 'Win in two', board: '112102221', turn: 1, steps: [
    { text: 'You can force a win in two moves. Only some moves work. Find the first one.', want: { kind: 'best' }, hint: 'That lets Greenstone escape. Look for the move that keeps them boxed in.' },
    { text: 'Now finish it.', want: { kind: 'best' } },
  ] },
  { title: 'Win in three', board: '011122212', turn: 1, steps: [
    { text: 'A longer trap: three moves. One of your two moves loses at once; the other wins by force.', want: { kind: 'best' } },
    { text: 'Keep the net closed.', want: { kind: 'best' } },
    { text: 'Last one.', want: { kind: 'best' } },
  ] },
  { title: 'Playing Greenstone', board: '', turn: 2, steps: [
    { text: 'Now you are Greenstone, moving second. The ideas are the same. You can force a win in two moves: find it.', want: { kind: 'best' } },
    { text: 'Finish it.', want: { kind: 'best' } },
  ] },
];
// lesson 8's position is found in the solved table: a win in two for Greenstone
{
  const p = wonPositions().find((x) => x.turn === 2 && x.plies === 3 && x.board[8] === 0);
  LESSONS[7].board = p.board.join('');
}
export const boardOf = (s) => [...s].map(Number);
