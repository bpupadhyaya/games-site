// Think and Watch & Learn: the advice and the plain-language reason. Every sentence below is computed from the engine
// (a real capture count, a real threat test), so the reason can never disagree with the board.
import {
  ADJ, DUX, applyMove, other, threats, bestYield, isCorner, isDux,
} from './rules.js';
import { seeded, seedOf, movementSearch } from './ai.js';
import { tr, cellWords, soldiersObj } from './content.js';

export const THINK_DEPTH = 4;

export function describeMove(st, mv) { return tr('hSlide', { a: cellWords(mv.from), b: cellWords(mv.to) }); }

export function explainMove(st, mv, depth = THINK_DEPTH) {
  const me = st.turn, foe = other(me);
  const s1 = applyMove(st, mv);
  const caps = s1.last.captured.length;
  if (s1.over && s1.over.winner === me) {
    if (s1.over.why === 'dux') return tr('wWinDux');
    if (s1.over.why === 'soldiers') return `${caps === 1 ? tr('wCapOne') : tr('wCapMany', { n: soldiersObj(caps) })} ${tr('wWinSoldiers')}`;
    if (s1.over.why === 'blocked') return caps ? `${caps === 1 ? tr('wCapOne') : tr('wCapMany', { n: soldiersObj(caps) })} ${tr('wWinBlocked')}` : tr('wWinBlocked');
  }
  if (caps) {
    let t = caps === 1 ? tr('wCapOne') : tr('wCapMany', { n: soldiersObj(caps) });
    if (s1.last.captured.some((c) => isCorner(c))) t += ` ${tr('wCapCorner')}`;
    if (s1.over) return t;
    const y = bestYield(s1, foe);
    t += y === 0 ? ` ${tr('wNoReply')}` : y >= 99 ? ` ${tr('wReplyDux')}` : ` ${tr('wReply', { n: soldiersObj(y) })}`;
    return t;
  }
  const before = threats(st, me);
  const after = s1.over ? { soldiers: new Set(), dux: false } : threats(s1, me);
  if (before.dux && !after.dux) {
    const dp = st.cells.indexOf(DUX[me]);
    return mv.from === dp ? tr('wDuxEscape') : tr('wBlockDux');
  }
  if (before.soldiers.has(mv.from) && !after.soldiers.has(mv.to)) return tr('wEscape');
  const mine = s1.over ? 0 : bestYield(s1, me);
  if (mine > 0 && after.soldiers.size === 0 && !after.dux) return mine >= 99 ? tr('wSetupDux') : tr('wSetup', { n: soldiersObj(mine) });
  const dp = st.cells.indexOf(DUX[foe]);
  if (dp >= 0 && ADJ[dp].includes(mv.to) && after.soldiers.size === 0) return tr('wBeside');
  if (before.soldiers.size > after.soldiers.size) return tr('wFewer');
  if (after.soldiers.size === 0 && !after.dux) return tr('wNone');
  return tr('wDepth', { d: depth });
}

// Think as a generator the game steps over frames. Resolves to { mv, head, why }.
export function* thinkAdvice(st) {
  const list = yield* movementSearch(st, THINK_DEPTH, 60000, 3);
  let best = list[0];
  const rng = seeded(seedOf(st));
  for (const x of list) if (x.s > best.s || (x.s === best.s && x.caps > best.caps)) best = x;
  const ties = list.filter((x) => x.s === best.s && x.caps === best.caps);
  if (ties.length > 1) best = ties[rng.int(ties.length)];
  return { mv: best.mv, head: describeMove(st, best.mv), why: explainMove(st, best.mv) };
}

export function adviceNow(st) { const g = thinkAdvice(st); for (;;) { const r = g.next(); if (r.done) return r.value; } }
export { isDux };
