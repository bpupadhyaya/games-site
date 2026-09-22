// Daily challenge: three "which tile do you discard?" puzzles, the same for everyone on a given day.
// Each puzzle is built from a real winning hand with a few tiles swapped out, and is only kept when exactly one
// discard is best by the same measure the computer and the hints use (steps from ready, then useful tiles left).
import { fakeState, withDraw } from './lessons.js';
import { analyseDiscards, bestKinds, discardHint } from './ai.js';
import { kindName } from './rules.js';

const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function randomWinningHand(rnd) {
  for (let tries = 0; tries < 50; tries++) {
    const suits = [Math.floor(rnd() * 3), Math.floor(rnd() * 3)], used = new Array(34).fill(0), kinds = [];
    let ok = true;
    for (let i = 0; i < 4 && ok; i++) {
      const suit = suits[rnd() < 0.7 ? 0 : 1];
      if (rnd() < 0.22) { const k = 27 + Math.floor(rnd() * 7); used[k] += 3; kinds.push(k, k, k); }
      else if (rnd() < 0.3) { const k = suit * 9 + Math.floor(rnd() * 9); used[k] += 3; kinds.push(k, k, k); }
      else { const r = Math.floor(rnd() * 7), k = suit * 9 + r; used[k]++; used[k + 1]++; used[k + 2]++; kinds.push(k, k + 1, k + 2); }
    }
    const pk = rnd() < 0.3 ? 27 + Math.floor(rnd() * 7) : suits[0] * 9 + Math.floor(rnd() * 9); used[pk] += 2; kinds.push(pk, pk);
    if (used.every((c) => c <= 4) && ok) return kinds;
  }
  return null;
}

export function makePuzzle(day, n) {
  const rnd = mulberry32(day * 1013 + n * 7919 + 17);
  for (let attempt = 0; attempt < 600; attempt++) {
    const win = randomWinningHand(rnd); if (!win) continue;
    const kinds = win.slice(), swaps = 1 + n;
    for (let s = 0; s < swaps; s++) {
      const i = Math.floor(rnd() * kinds.length), k = rnd() < 0.35 ? 27 + Math.floor(rnd() * 7) : Math.floor(rnd() * 27);
      kinds[i] = k;
    }
    const cnt = new Array(34).fill(0); kinds.forEach((k) => cnt[k]++);
    if (cnt.some((c) => c > 4)) continue;
    const di = Math.floor(rnd() * 14), draw = kinds[di], hand = kinds.filter((_, i) => i !== di);
    const s = fakeState(hand); withDraw(s, draw);
    const list = analyseDiscards(s, 0), best = bestKinds(list);
    if (best.length !== 1) continue;
    const top = list.find((x) => x.kind === best[0]);
    if (top.sh < 0) continue;
    const rest = list.filter((x) => x.kind !== best[0]);
    if (!rest.some((x) => x.sh === top.sh && top.left - x.left <= 1) && rest.every((x) => x.sh > top.sh || top.left - x.left >= 2)) {
      const hint = discardHint(s, 0);
      return { hand, draw, best: best[0], text: hint.text, name: kindName(best[0]), sh: top.sh };
    }
  }
  // a fixed fallback so a day is never empty
  const s = fakeState([0, 1, 2, 12, 13, 14, 18, 19, 20, 27, 27, 27, 31]); withDraw(s, 5);
  const hint = discardHint(s, 0);
  return { hand: [0, 1, 2, 12, 13, 14, 18, 19, 20, 27, 27, 27, 31], draw: 5, best: hint.kind, text: hint.text, name: kindName(hint.kind), sh: hint.sh };
}
