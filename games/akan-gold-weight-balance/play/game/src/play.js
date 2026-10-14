// One order: where each weight is, the bag, the pours. No drawing, no storage.
import { RULES, weighUp } from './engine.js';

export const kindOf = (k) => (k === 'bag' ? 'bag' : 'weight');

export function newSession({ order, kind = 'free', ref = '', variant = 'right', level = 0 }) {
  const side = {};
  for (const w of order.weights) side[w] = 'tray';
  side.bag = 'tray';
  return { order, side, seq: [], bag: 0, pours: 0, undo: [], hints: 0, moves: 0, kind, ref, variant, level, done: false, counts: {} };
}
export const keysOf = (P) => (RULES[P.order.rule].bag ? [...P.order.weights, 'bag'] : P.order.weights.slice());
export const itemsOn = (P, side) => P.seq.filter((k) => P.side[k] === side);
export const onPans = (P) => P.seq.filter((k) => P.side[k] !== 'tray');

// Can this key go on this side under the order's rule?
export function allowed(P, key, side) {
  const R = RULES[P.order.rule];
  if (side === 'tray') return true;
  if (key === 'bag') return R.bag;
  if (side === 'left' && !R.left) return false;
  return P.order.weights.includes(key);
}
export function place(P, key, side) {
  if (P.done || !allowed(P, key, side) || P.side[key] === side) return false;
  P.side[key] = side;
  P.seq = P.seq.filter((k) => k !== key);
  if (side !== 'tray') P.seq.push(key);
  P.moves += 1;
  return true;
}
// Tap cycle: tray -> right -> left -> tray (left skipped when the rule does not allow it).
export function nextSide(P, key) {
  const cur = P.side[key], R = RULES[P.order.rule];
  if (cur === 'tray') return 'right';
  if (cur === 'right') return R.left ? 'left' : 'tray';
  return 'tray';
}
export function clearPans(P) {
  let any = false;
  for (const k of Object.keys(P.side)) if (P.side[k] !== 'tray') { P.side[k] = 'tray'; any = true; }
  P.seq = [];
  return any;
}
export function totals(P) {
  const R = RULES[P.order.rule], sides = P.order.weights.map((w) => P.side[w]);
  return weighUp(P.order.weights, sides, R.bag ? P.side.bag : 'tray', P.bag);
}
export const canPour = (P) => !P.done && totals(P).dust > 0;
export function pour(P) {
  const t = totals(P);
  if (P.done || t.dust <= 0) return null;
  P.undo.push({ bag: P.bag, pours: P.pours });
  P.bag += t.dust; P.pours += 1;
  return t.dust;
}
export function undoPour(P) {
  const u = P.undo.pop();
  if (!u) return false;
  P.bag = u.bag; P.pours = u.pours; P.done = false;
  return true;
}
export const solvedNow = (P) => P.bag === P.order.target;
export const overshoot = (P) => P.bag > P.order.target;
export function starsFor(P) {
  const over = P.pours - P.order.par;
  let s = over <= 0 ? 3 : over === 1 ? 2 : 1;
  if (P.hints > 0) s = Math.min(s, 2);
  return Math.max(1, s);
}
// Put the pans exactly as a move says (weights by assign index, bag by sb).
export function arrange(P, move) {
  clearPans(P);
  move.assign.forEach((sg, i) => { if (sg > 0) place(P, P.order.weights[i], 'right'); else if (sg < 0) place(P, P.order.weights[i], 'left'); });
  if (move.sb > 0) place(P, 'bag', 'right'); else if (move.sb < 0) place(P, 'bag', 'left');
}
