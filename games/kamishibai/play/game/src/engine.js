// Rules of Kamishibai: ordering a tale's cards, and judging the timing of each pull. Pure and deterministic.
import { STORIES, beatFor, parTries } from './stories.js';

// A session. order[slot] = index of the card lying in that slot; the right order is order[i] === i.
export function newSession({ story, tier, rng, kind = 'free', ref = '' }) {
  const n = STORIES[story].cards.length;
  const fixed = tier === 0 ? new Set([0, n - 1]) : new Set();
  const freeSlots = Array.from({ length: n }, (_, i) => i).filter((i) => !fixed.has(i));
  let order = Array.from({ length: n }, (_, i) => i);
  for (let tries = 0; tries < 20; tries++) {
    const sh = rng.shuffle(freeSlots);
    order = order.map((c, slot) => (fixed.has(slot) ? slot : sh[freeSlots.indexOf(slot)]));
    if (order.some((c, i) => c !== i)) break;
  }
  if (order.every((c, i) => c === i)) [order[freeSlots[0]], order[freeSlots[1]]] = [order[freeSlots[1]], order[freeSlots[0]]];
  return { story, tier, kind, ref, n, order, locked: order.map((c, i) => fixed.has(i)), tries: 0, hints: 0, swaps: 0, undo: [], flipped: {}, phase: 'arrange', t: 0, solved: false };
}

export const isSolvedOrder = (P) => P.order.every((c, i) => c === i);

export function swap(P, a, b) {
  if (a === b || P.locked[a] || P.locked[b] || a < 0 || b < 0 || a >= P.n || b >= P.n) return false;
  P.undo.push(P.order.slice());
  if (P.undo.length > 60) P.undo.shift();
  [P.order[a], P.order[b]] = [P.order[b], P.order[a]];
  P.swaps += 1;
  return true;
}
export function undo(P) {
  const o = P.undo.pop();
  if (!o) return false;
  P.order = o; return true;
}

// "Hang the cards": every card that is in its right place locks; the rest stay free.
export function check(P) {
  P.tries += 1;
  const fresh = [], wrong = [];
  P.order.forEach((c, i) => { if (P.locked[i]) return; if (c === i) { P.locked[i] = true; fresh.push(i); } else wrong.push(i); });
  P.undo = [];
  if (wrong.length === 0) P.solved = true;
  return { fresh, wrong, solved: P.solved };
}

// A teaching hint: the first open slot, the card that belongs there and why.
export function findHint(P) {
  const slot = P.order.findIndex((c, i) => !P.locked[i] && c !== i);
  if (slot < 0) return null;
  const card = slot, from = P.order.indexOf(card), S = STORIES[P.story];
  const prev = slot > 0 ? S.cards[slot - 1] : null;
  const look = slot === 0 ? 'Look for the card where the story begins.' : `Look for what happens right after: "${short(prev.cap)}"`;
  return { slot, card, from, look, why: S.cards[card].why };
}
const short = (s) => (s.length > 70 ? `${s.slice(0, 67).replace(/\s+\S*$/, '')}...` : s);

// ---- performing ------------------------------------------------------------------------------------------------------------------------
// err = pull time minus the beat, in seconds. Negative = rushed.
export const GRADES = ['perfect', 'good', 'ok', 'rushed', 'late'];
export function gradeOf(err) {
  const a = Math.abs(err);
  if (a <= 0.3) return 'perfect';
  if (a <= 0.65) return 'good';
  if (err > 0 && a <= 1.3) return 'ok';
  if (err < 0 && a <= 1.1) return 'ok';
  return err < 0 ? 'rushed' : 'late';
}
export const ATT_DELTA = { perfect: 0.6, good: 0.25, ok: -0.15, rushed: -0.9, late: -0.9 };
export const LATE_DRAIN = 0.35;       // lantern per second after the beat has passed by more than 1.3 s
export const ATT_START = 4;

export function newShow(P) {
  const S = STORIES[P.story];
  return { i: 0, t: 0, beat: beatFor(S.cards[0]), att: ATT_START, grades: [], errs: [], failed: false, done: false, lowest: ATT_START, pulledAt: -1, out: 0 };
}

export function starsFor(P, show) {
  const par = parTries(P.n) + (P.tier === 2 ? 1 : 0);
  const perfect = show.grades.filter((g) => g === 'perfect' || g === 'good').length / Math.max(1, show.grades.length);
  if (P.tries <= par && perfect >= 0.7 && show.att >= 3) return 3;
  if (P.tries <= par + 2 && perfect >= 0.4) return 2;
  return 1;
}
export const score = (P, show) => show.grades.reduce((a, g) => a + (g === 'perfect' ? 100 : g === 'good' ? 70 : g === 'ok' ? 40 : 10), 0) + Math.max(0, 60 - 15 * (P.tries - 1)) + Math.round(show.att * 20);
