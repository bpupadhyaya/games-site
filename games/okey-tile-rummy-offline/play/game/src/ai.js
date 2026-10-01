// The computer players. Everything an AI uses is information a human at the table also has: its own rack, the
// piles, the indicator, which tiles each player picked up. It never peeks at the stack or other racks.
//
// Evaluation = rules.js value search: complete melds count fully, near-melds count by how many unseen tiles would
// complete them ("outs"). Three levels:
//   0 Casual  - no out-counting, no pair plan, sometimes makes a human-sized slip
//   1 Club    - counts outs, takes a useful discard, aims for pairs when the hand is full of them
//   2 Master  - Club plus reading the next player (it avoids discarding what they were collecting), expected value
//               of the blind draw, always prefers the okey finish
import {
  isWild, faceKey, faceColor, faceNum, keyName, tileName, finishingDiscards, valueOfCounts, solveValue,
  unseenCounts, nextSeat, prevSeat, isFake,
} from './rules.js';

export const LEVEL_NAMES = ['Casual', 'Club', 'Master'];

// Seven-pairs plan value: complete pairs (a wild pairs with any single) plus the chance of pairing the rest.
function pairsValue(cnt, w, un) {
  let pairs = 0, singles = 0, sv = 0;
  for (let k = 0; k < 52; k++) {
    pairs += cnt[k] >> 1;
    if (cnt[k] & 1) { singles++; sv += un ? (un[k] > 0 ? 0.9 : 0.15) : 0.6; }
  }
  const fill = Math.min(w, singles);
  pairs += fill;
  singles -= fill;
  const rest = w - fill;
  pairs += rest >> 1;
  return { pairs, value: 6 * pairs + 0.5 * sv };
}

function countsOf(ids, okey) {
  const cnt = new Array(52).fill(0);
  let w = 0;
  for (const id of ids) { if (isWild(id, okey)) w++; else cnt[faceKey(id, okey)]++; }
  return { cnt, w };
}

// Value of a hand (any size) under a level's thinking. `memo` is shared across a decision (same unseen info).
function handValue(cnt, w, un, memo, level) {
  const sets = valueOfCounts(cnt, w, level >= 1 ? un : null, memo);
  if (level < 1) return sets;
  const p = pairsValue(cnt, w, un);
  if (p.pairs >= 5) {
    const pv = p.value - 0.8; // pairs are harder to finish: a small handicap
    if (pv > sets) return pv;
  }
  return sets;
}

// Each computer player has a temperament: Elif grabs useful discards eagerly, Mehmet waits for the stack, Deniz is in between.
const STYLE = [null, { need: -0.25 }, { need: 0.15 }, { need: -0.05 }];
export const TUNE = { noise: [1.8, 1.0, 0.06], need: [2.4, 1.2, 0.55], danger: 1, slip: [0.4, 0.14, 0], miss: [0.4, 0.3, 0], look: 4, lookW: 1.0 };

// ---- reading the next player (Master) ----------------------------------------------------------------------
function danger(d, seat, id) {
  const next = nextSeat(seat);
  const k = faceKey(id, d.okey);
  const c = Math.floor(k / 13), n = (k % 13) + 1;
  let pen = 0;
  for (const kk of d.takes[next]) {
    const kc = Math.floor(kk / 13), kn = (kk % 13) + 1;
    if (kn === n && kc !== c) pen += 0.55; // they are collecting that number
    else if (kc === c && Math.abs(kn - n) <= 2 && kn !== n) pen += 0.5; // or a run in that colour
    else if (kk === k) pen += 0.3;
  }
  for (const e of d.discards) {
    if (e.seat !== next) continue;
    if (faceKey(e.id, d.okey) === k) pen -= 0.35; // they threw that very tile away: they do not want it
  }
  const late = 1 + (48 - d.stack.length) / 40; // later in the deal everything is more dangerous
  return Math.max(-0.5, Math.min(1.8, pen)) * late;
}

// ---- describing a plan (used by hints and the Watch & Learn reveal) -------------------------------------------
const nm = (id, okey) => (isWild(id, okey) ? 'the okey' : tileName(id, okey));
function describeMeldFor(sol, id, okey) {
  for (const m of sol.melds) {
    if (!m.ids.includes(id)) continue;
    const real = m.ids.filter((x) => !isWild(x, okey));
    if (m.type === 'run') return { kind: 'run', text: `the run ${m.ids.map((x) => (isWild(x, okey) ? '*' : faceNum(x, okey))).join('-')} in ${['red', 'blue', 'black', 'yellow'][faceColor(real[0], okey)]}` };
    if (m.type === 'group') return { kind: 'group', text: `the set of ${faceNum(real[0], okey)}s` };
    if (m.type === 'prun') return { kind: 'prun', text: `a run in the making (${m.ids.map((x) => nm(x, okey)).join(' + ')})` };
    if (m.type === 'pgroup') return { kind: 'pgroup', text: `a set of ${faceNum(real[0], okey)}s in the making` };
    if (m.type === 'wilds') return { kind: 'wild', text: 'a flexible okey' };
  }
  return null;
}

// Expected value of the best 15-tile hand after one more blind draw from `cnt/w` (14 tiles), over unseen tiles.
function drawExpectation(cnt, w, un, memo, level) {
  let tot = 0, ev = 0;
  for (let k = 0; k < 53; k++) {
    const u = un[k];
    if (u <= 0) continue;
    let v;
    if (k === 52) v = handValue(cnt, w + 1, un, memo, level);
    else { cnt[k]++; v = handValue(cnt, w, un, memo, level); cnt[k]--; }
    ev += u * v; tot += u;
  }
  return tot ? ev / tot : 0;
}

// ---- 1. where to draw from -----------------------------------------------------------------------------------
// Returns { src: 'stack'|'pile', why, win? }.
export function planDraw(d, seat, level, rng) {
  const hand = d.hands[seat], okey = d.okey;
  const from = prevSeat(seat);
  const pile = d.piles[from];
  const top = pile.length ? pile[pile.length - 1] : -1;
  if (d.stack.length === 0 && top < 0) return { src: 'stack', why: 'No tiles left.' };
  if (top < 0) return { src: 'stack', why: 'The pile on your left is empty, so draw from the stack.' };
  if (d.stack.length === 0) return { src: 'pile', why: 'The stack is empty.' };
  const fin = finishingDiscards([...hand, top], okey);
  if (fin.length && !(level < 2 && rng.chance(TUNE.miss[level]))) {
    return { src: 'pile', why: `Take ${nm(top, okey)}: it completes your rack, and you can finish on the next discard.`, win: true };
  }
  const un = unseenCounts(d, seat);
  const memo = new Map();
  const { cnt, w } = countsOf(hand, okey);
  const tk = countsOf([...hand, top], okey);
  const vTake = handValue(tk.cnt, tk.w, un, memo, level);
  // blind draw: expected value over what could still be in the stack
  const vStack = drawExpectation(cnt, w, un, memo, level) || vTake - 1;
  // a draw from the pile also tells the table what you want; Master asks for a clear edge
  const need = TUNE.need[level] + (STYLE[seat]?.need ?? 0);
  const noise = (rng.next() - 0.5) * 2 * TUNE.noise[level];
  const take = vTake - vStack + noise > need;
  const sol = solveValue([...hand, top], okey, level >= 1 ? un : null);
  const desc = describeMeldFor(sol, top, okey);
  if (take) {
    let why = `Take ${nm(top, okey)}`;
    if (desc && (desc.kind === 'run' || desc.kind === 'group')) why += `: it completes ${desc.text}.`;
    else if (desc) why += `: it joins ${desc.text}.`;
    else why += '.';
    return { src: 'pile', why, vTake, vStack };
  }
  let why = `${nm(top, okey)} on the pile does not help enough; draw blind from the stack.`;
  if (desc && (desc.kind === 'prun' || desc.kind === 'pgroup')) why = `${nm(top, okey)} would only make ${desc.text}; the stack gives better odds.`;
  return { src: 'stack', why, vTake, vStack };
}

// ---- 2. what to discard ----------------------------------------------------------------------------------------
// hand has 15 tiles. Returns { id, why, finish? { pairs, okeyDiscard, mult } }.
export function planDiscard(d, seat, level, rng, hint = false) {
  const hand = d.hands[seat], okey = d.okey;
  const fin = finishingDiscards(hand, okey);
  if (fin.length && !(level < 2 && !hint && rng.chance(TUNE.miss[level]))) {
    const f = fin[0];
    const why = f.okeyDiscard ? 'Discard the okey to finish: it scores double.' : f.pairs ? 'Seven pairs: discard to finish.' : `Discard ${nm(f.id, okey)} to finish with a complete rack.`;
    return { id: f.id, why, finish: f };
  }
  const un = unseenCounts(d, seat);
  const memo = new Map();
  const seen = new Set();
  const cands = [];
  const sigOf = (id) => (isWild(id, okey) ? 'w' : isFake(id) ? 'f' + faceKey(id, okey) : String(faceKey(id, okey)));
  for (const id of hand) {
    const sig = sigOf(id);
    if (seen.has(sig)) continue;
    seen.add(sig);
    const rest = hand.filter((x) => x !== id);
    const { cnt, w } = countsOf(rest, okey);
    let v = handValue(cnt, w, un, memo, level);
    if (isWild(id, okey)) v -= 50;
    if (level >= 2) v -= TUNE.danger * danger(d, seat, id);
    cands.push({ id, v });
  }
  cands.sort((a, b) => b.v - a.v);
  if (level >= 2) {
    // one-ply lookahead on the few best candidates: which 14 tiles draw best?
    for (const c of cands.slice(0, TUNE.look)) {
      const rest = hand.filter((x) => x !== c.id);
      const { cnt, w } = countsOf(rest, okey);
      c.v = drawExpectation(cnt, w, un, memo, level) * TUNE.lookW + c.v * (1 - TUNE.lookW) - (isWild(c.id, okey) ? 50 : 0) - TUNE.danger * danger(d, seat, c.id) * 0.6;
    }
    cands.splice(TUNE.look);
  }
  for (const c of cands) c.v += (rng.next() - 0.5) * 2 * TUNE.noise[level];
  cands.sort((a, b) => b.v - a.v);
  let pick = cands[0];
  if (level < 2 && cands.length > 2 && rng.chance(TUNE.slip[level])) pick = cands[1 + rng.int(Math.min(3, cands.length - 1))]; // a human-sized slip
  const sol = solveValue(hand, okey, level >= 1 ? un : null);
  const desc = describeMeldFor(sol, pick.id, okey);
  let why;
  if (!desc || desc.kind === 'wild') why = `${nm(pick.id, okey)} does not connect with anything: the least useful tile.`;
  else why = `${nm(pick.id, okey)} is the weakest link: it only belongs to ${desc.text}.`;
  if (level >= 2 && danger(d, seat, pick.id) < 0.1) why += ' It also looks safe against the next player.';
  return { id: pick.id, why };
}

// Hint for a human (always at least Club strength, Master reading of the table).
export function hintFor(d, seat, rng) {
  if (d.phase === 'draw') return { ...planDraw(d, seat, 2, rng), phase: 'draw' };
  return { ...planDiscard(d, seat, 2, rng, true), phase: 'discard' };
}

// Seat personalities: how long they ponder and how bold they are (purely cosmetic pacing).
export const SEAT_NAMES = ['You', 'Elif', 'Mehmet', 'Deniz'];
export const SEAT_TITLES = ['', 'Tea-house regular', 'Grandmaster', 'Night-owl'];
export const SEAT_NAMES_TR = ['Sen', 'Elif', 'Mehmet', 'Deniz'];
export const thinkTime = (seat, rng) => 0.4 + (seat === 2 ? 0.15 : 0) + rng.next() * 0.45;
