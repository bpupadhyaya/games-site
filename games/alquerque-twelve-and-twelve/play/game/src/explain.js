// Think and Watch & Learn: the advice and the plain-language reason. Every sentence is computed from the engine (a real capture
// test, a real threat test) before it is said, so the reason can never disagree with the board.
import { applyMove, legalMoves, mustCapture, threatened, turnYield, other } from './rules.js';
import { search, seeded, seedOf } from './ai.js';
import { tr, piecesObj, sideThe } from './content.js';

// The level Think uses: deeper than any opponent but Master, with a fixed node budget.
export const THINK_LEVEL = { id: 'think', depth: 8, cap: 200000 };

export function reasonFor(st, mv, neutral = false) {
  const me = st.turn;
  const mine = neutral ? tr('mineN', { side: sideThe(me) }) : tr('mineY');
  const legal = legalMoves(st);
  const after = applyMove(st, mv);
  const jump = mv.cap >= 0;
  const head = legal.length === 1 ? tr('hOnly') : tr(jump ? 'hJump' : 'hStep');
  if (after.over && after.over.winner === me) {
    if (after.over.why === 'captured') return { head, why: tr('wWin') };
    if (after.over.why === 'blocked') return { head, why: tr('wBlock') };
  }
  const parts = [];
  if (jump) {
    if (legal.length === 1) parts.push(tr('wOnly')); else parts.push(tr(mustCapture(st) ? 'wMust' : 'wJump'));
    if (after.chain >= 0) parts.push(tr('wGoOn'));
    else {
      const hit = threatened(after, me);
      if (hit.size === 0) parts.push(tr('wNoReply', { mine }));
      else if (hit.has(mv.to)) parts.push(tr('wLandHit'));
      else parts.push(tr('wReply', { n: hit.size, mine }));
    }
    return { head, why: parts.join(' ') };
  }
  const hitNow = threatened(st, me), hitAfter = threatened(after, me);
  if (legal.length === 1) parts.push(tr('wOnly'));
  if (hitNow.size > 0 && hitAfter.size < hitNow.size) parts.push(hitNow.has(mv.from) && !hitAfter.has(mv.to) ? tr('wEscape') : tr('wFewer', { mine }));
  else {
    const y = hitAfter.size === 0 ? turnYield(after, me) : 0;
    if (y > 0) parts.push(tr('wSetup', { n: piecesObj(y), mine }));
    else if (hitAfter.size === 0) parts.push(tr('wSafe', { mine }));
    else parts.push(tr('wDepth'));
  }
  return { head, why: parts.join(' ') };
}

// One Think decision as a generator (one root move per slice): returns { mv, head, why }.
export function* thinkAdvice(st) {
  const list = yield* search(st, THINK_LEVEL.depth, THINK_LEVEL.cap);
  if (!list.length) return null;
  const rng = seeded(seedOf(st));
  let best = -Infinity;
  for (const x of list) if (x.s > best) best = x.s;
  const top = list.filter((x) => x.s >= best);
  const mv = top[rng.int(top.length)].mv;
  return { mv: { from: mv.from, to: mv.to, cap: mv.cap }, ...reasonFor(st, mv) };
}
export { other };
