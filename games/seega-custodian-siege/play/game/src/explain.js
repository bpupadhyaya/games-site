// Think and Watch & Learn: the advice and the plain-language reason. Every sentence below is computed from the engine
// (a real capture count, a real threat test), so the reason can never disagree with the board.
import {
  CENTRE, ADJ, applyMove, isCorner, isEdge, other, isEnd, turnYield, threatened,
} from './rules.js';
import { seeded, seedOf, movementSearch, placementSearch } from './ai.js';
import { tr, cellWords, stonesObj } from './content.js';

export const THINK_DEPTH = 5;

export function describeMove(st, mv) {
  if (mv.from === -2) return tr('hEnd');
  if (mv.from === -1) return tr('hPlace', { cell: cellWords(mv.to) });
  return tr('hSlide', { a: cellWords(mv.from), b: cellWords(mv.to) });
}

export function explainPlacement(st, cell) {
  const me = st.turn;
  const bits = [];
  if (isCorner(cell)) bits.push(tr('wCorner'));
  else if (isEdge(cell)) bits.push(tr('wEdge'));
  const mates = ADJ[cell].filter((j) => st.cells[j] === me).length;
  if (mates) bits.push(tr(mates > 1 ? 'wMates' : 'wMate'));
  if (me === 2 && ADJ[CENTRE].includes(cell)) bits.push(tr('wLast'));
  if (me === 1 && ADJ[CENTRE].includes(cell)) bits.push(tr('wFirstOpp'));
  if (!bits.length) bits.push(tr('wInner'));
  bits.push(tr('wScored'));
  return bits.join(' ');
}

export function explainMove(st, mv, depth = THINK_DEPTH) {
  const me = st.turn, foe = other(me);
  if (isEnd(mv)) return tr('wStop');
  const s1 = applyMove(st, mv);
  const caps = s1.last.captured.length;
  if (caps) {
    let t = caps === 1 ? tr('wCapOne') : tr('wCapMany', { n: stonesObj(caps) });
    if (s1.over) return `${t} ${tr('wWinOne')}`;
    if (s1.turn === me) return `${t} ${tr('wGoOn')}`;
    const y = turnYield(s1, foe);
    t += y === 0 ? ` ${tr('wNoReply')}` : ` ${tr('wReply', { n: stonesObj(y) })}`;
    return t;
  }
  const before = threatened(st, me);
  const after = s1.over ? new Set() : threatened(s1, me);
  if (before.has(mv.from) && !after.has(mv.to)) return tr('wEscape');
  if (mv.to === CENTRE) return tr('wCentreMove');
  const mine = s1.over ? 0 : turnYield({ ...s1, turn: me }, me);
  if (mine > 0 && after.size === 0) return tr('wSetup', { n: stonesObj(mine) });
  if (before.size > after.size) return tr('wFewer');
  if (after.size === 0) return tr('wNone');
  return tr('wDepth', { d: depth });
}

// Think as a generator the game steps over frames. Resolves to { mv, head, why }.
export function* thinkAdvice(st) {
  const rng = seeded(seedOf(st));
  if (st.phase === 'place') {
    const r = yield* placementSearch(st, 'expert', rng);
    const mv = { from: -1, to: r.cell };
    return { mv, head: describeMove(st, mv), why: explainPlacement(st, r.cell) };
  }
  const list = yield* movementSearch(st, THINK_DEPTH, 40000);
  let best = list[0];
  for (const x of list) if (x.s > best.s || (x.s === best.s && x.caps > best.caps)) best = x;
  return { mv: best.mv, head: describeMove(st, best.mv), why: explainMove(st, best.mv) };
}

export function adviceNow(st) { const g = thinkAdvice(st); for (;;) { const r = g.next(); if (r.done) return r.value; } }
