// The computer players and the "why?" hints. Uses only rules.js. Randomness comes from the rng passed in.
//
// Levels (LEVELS[i]):
//   0 Beginner     keeps a hand together only half the time, plays a random loose tile otherwise, claims on impulse
//   1 Intermediate keeps tile efficiency (fewest steps from ready, most useful tiles left), avoids obvious danger
//   2 Strong       also plays for value (dragons, winds, one suit), folds to safe tiles when an opponent looks close
//                  and its own hand is far away, and only claims when the hand keeps a way to score
import { kindOf, kindCounts, shanten, outsFor, visibleCounts, ownKongs, fullHand, seatWind, isHonor, isTerminal, kindName, suitOf, claimOptions, LIMIT } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', note: 'Plays loosely and misses chances.' },
  { name: 'Intermediate', note: 'Keeps its hand efficient.' },
  { name: 'Strong', note: 'Plays for value and defends.' },
];

const rankOfNum = (k) => k % 9;
const hasNeighbour = (c, k) => k < 27 && [-2, -1, 1, 2].some((d) => { const j = k + d; return j >= 0 && j < 27 && Math.floor(j / 9) === Math.floor(k / 9) && c[j] > 0; });

// Every distinct discard from the full hand, with what it leaves behind. Best first for an efficient player.
export function analyseDiscards(s, p) {
  const full = fullHand(s, p), melds = s.melds[p].length, c = kindCounts(full), seen = visibleCounts(s, p);
  const before = shanten(c, melds), out = [], done = new Set();
  for (const t of full) {
    const k = kindOf(t);
    if (done.has(k)) continue; done.add(k);
    c[k]--;
    const sh = shanten(c, melds), outs = sh >= 0 ? outsFor(c, melds, seen) : [];
    c[k]++;
    const left = outs.reduce((a, o) => a + o.left, 0);
    out.push({ tile: pickTile(full, k, s, p), kind: k, sh, outs, left, before, alone: c[k] === 1 && !hasNeighbour(c, k) });
  }
  return out;
}
// prefer discarding the copy that was just drawn if it is that kind (keeps the hand order stable)
const pickTile = (full, k, s, p) => (s.drawn >= 0 && s.turn === p && kindOf(s.drawn) === k ? s.drawn : full.find((t) => kindOf(t) === k));

// A rough danger number for discarding kind k, given who looks close to winning.
function danger(s, p, k, seen) {
  let d = 0;
  for (let o = 0; o < 4; o++) {
    if (o === p) continue;
    const open = s.melds[o].filter((m) => m.open).length;
    const threat = open >= 3 ? 3 : open === 2 ? 1.6 : open === 1 ? 0.6 : s.rivers[o].length > 9 ? 0.5 : 0.2;
    if (s.rivers[o].some((t) => kindOf(t) === k)) continue;          // they threw it themselves: safe from them
    let v;
    if (isHonor(k)) v = seen[k] >= 2 ? 1 : 2.2;
    else if (isTerminal(k)) v = 2;
    else { const r = rankOfNum(k); v = r === 1 || r === 7 ? 3 : 4.2; }
    // a player collecting one suit is dangerous for that suit
    const suits = s.melds[o].filter((m) => m.open && kindOf(m.tiles[0]) < 27).map((m) => suitOf(kindOf(m.tiles[0])));
    if (k < 27 && suits.length >= 2 && suits.every((x) => x === suits[0]) && suits[0] === suitOf(k)) v *= 1.8;
    // a pung of this kind already in their hand's open sets means the rest are mostly safe
    if (s.melds[o].some((m) => m.open && kindOf(m.tiles[0]) === k)) v = 0.4;
    d += v * threat;
  }
  return d;
}

// Does the hand keep a route to at least one fan? (dragon or wind pairs/pungs, a single suit, or already-scoring sets)
export function hasFanSource(s, p, c) {
  const seatK = 27 + seatWind(s, p), windK = 27 + s.wind;
  for (const m of s.melds[p]) { const k = kindOf(m.tiles[0]); if (k >= 31 || k === seatK || k === windK) return true; }
  if (s.flowers[p].some((t) => (kindOf(t) - 34) % 4 === seatWind(s, p))) return true;
  for (const k of [31, 32, 33, seatK, windK]) if (c[k] >= 2) return true;
  const perSuit = [0, 0, 0]; let honors = 0;
  for (let k = 0; k < 27; k++) perSuit[Math.floor(k / 9)] += c[k];
  for (let k = 27; k < 34; k++) honors += c[k];
  const mSuits = new Set(s.melds[p].filter((m) => kindOf(m.tiles[0]) < 27).map((m) => suitOf(kindOf(m.tiles[0]))));
  const total = perSuit.reduce((a, b) => a + b, 0) + honors;
  const best = Math.max(...perSuit);
  if (mSuits.size <= 1 && (best + honors) >= total - 2 && (mSuits.size === 0 || perSuit[[...mSuits][0]] >= best - 1)) return true;
  return false;
}

// Choose a discard for seat p. Returns { tile, kind, note } (note is for hints and the log).
export function chooseDiscard(s, p, level, rng) {
  const list = analyseDiscards(s, p);
  const c = kindCounts(fullHand(s, p)), seen = visibleCounts(s, p);
  const seatK = 27 + seatWind(s, p), windK = 27 + s.wind;
  const best = Math.min(...list.map((x) => x.sh));
  const threatened = [0, 1, 2, 3].some((o) => o !== p && s.melds[o].filter((m) => m.open).length >= 2);
  if (level === 0) {
    if (rng.chance(0.5)) {
      const loose = list.filter((x) => c[x.kind] === 1);
      const pool = loose.length ? loose : list;
      return { ...rng.pick(pool), note: 'random loose tile' };
    }
  }
  // suit focus for the strong player: the suit (with honors) holding most tiles
  let focus = -1;
  if (level >= 2) {
    const per = [0, 0, 0]; for (let k = 0; k < 27; k++) per[Math.floor(k / 9)] += c[k];
    const honors = c.slice(27, 34).reduce((a, b) => a + b, 0), m = Math.max(...per);
    if (m + honors >= 9 && m >= 6) focus = per.indexOf(m);
  }
  const fold = level >= 2 && threatened && best >= 2;
  let top = null, topScore = -1e9;
  for (const x of list) {
    let score = -x.sh * 100 + x.left * 3;
    if (x.sh >= 0 && x.left === 0) score -= 12;
    if (c[x.kind] === 1 && isHonor(x.kind)) score += 2;               // a lone honor is easy to let go
    if (c[x.kind] >= 2 && (x.kind >= 31 || x.kind === seatK || x.kind === windK)) score -= level >= 2 ? 14 : 3;   // keep value pairs
    if (level >= 2 && focus >= 0 && x.kind < 27 && suitOf(x.kind) !== focus) score += 10;
    if (level >= 2 && focus >= 0 && x.kind < 27 && suitOf(x.kind) === focus) score -= 6;
    const dg = danger(s, p, x.kind, seen);
    score -= dg * (level >= 2 ? (fold ? 22 : 4) : level === 1 ? 1.5 : 0);
    if (level >= 1 && seen[x.kind] >= 3 && c[x.kind] === 1) score += 3;   // the last copy is unlikely to ever pair up
    if (level === 0) score += rng.range(-40, 40);
    if (level === 1) score += rng.range(-1, 1);
    if (score > topScore) { topScore = score; top = x; }
  }
  return { ...top, note: fold ? 'defence' : 'efficiency' };
}

// Should seat q take the discard? Returns { type, pair } or null. Winning is always taken (checked by the caller first).
export function chooseClaim(s, q, o, level, rng) {
  if (!o) return null;
  if (o.win) return { type: 'win' };
  const { tile } = s.last, k = kindOf(tile);
  const melds = s.melds[q].length, c = kindCounts(s.hands[q]);
  const now = shanten(c, melds);
  const afterShanten = (used, adds) => {                       // best shanten after taking the meld and discarding well
    const cc = c.slice(); for (const u of used) cc[kindOf(u)]--;
    let best = 99;
    for (let x = 0; x < 34; x++) { if (!cc[x]) continue; cc[x]--; best = Math.min(best, shanten(cc, melds + 1)); cc[x]++; }
    return best;
  };
  const valuable = k >= 31 || k === 27 + seatWind(s, q) || k === 27 + s.wind;
  if (level === 0) {
    if (o.pung && rng.chance(valuable ? 0.6 : 0.25)) return { type: 'pung' };
    if (o.chows.length && rng.chance(0.2)) return { type: 'chow', pair: o.chows[0] };
    return null;
  }
  if (o.kong) {
    const used = s.hands[q].filter((x) => kindOf(x) === k).slice(0, 3);
    if ((valuable || afterShanten(used) <= now) && (level < 2 || valuable || hasFanSource(s, q, c))) return { type: 'kong' };
  }
  if (o.pung) {
    const used = s.hands[q].filter((x) => kindOf(x) === k).slice(0, 2), a = afterShanten(used);
    const ok = a < now || (a === now && valuable);
    if (ok && (level < 2 || valuable || hasFanSource(s, q, c))) return { type: 'pung' };
  }
  if (o.chows.length) {
    let bestChow = null, bestA = 99;
    for (const pair of o.chows) { const a = afterShanten(pair); if (a < bestA) { bestA = a; bestChow = pair; } }
    if (bestA < now && (level < 2 || hasFanSource(s, q, c))) return { type: 'chow', pair: bestChow };
  }
  return null;
}

// Own-turn kong (concealed or added) for the computer, or null.
export function chooseKong(s, p, level) {
  if (level === 0) return null;
  const ks = ownKongs(s, p);
  if (!ks.length) return null;
  const melds = s.melds[p].length, c = kindCounts(fullHand(s, p));
  const before = Math.min(...analyseDiscards(s, p).map((x) => x.sh));
  for (const kg of ks) {
    const cc = c.slice(); cc[kg.kind] -= kg.type === 'ckong' ? 4 : 1;
    let best = 99;
    for (let x = 0; x < 34; x++) { if (!cc[x]) continue; cc[x]--; best = Math.min(best, shanten(cc, kg.type === 'ckong' ? melds + 1 : melds)); cc[x]++; }
    if (best <= before || kg.kind >= 27) return kg;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// HINTS for the human: what to discard and why, in plain words.
export const stepsText = (sh) => (sh < 0 ? 'a complete hand' : sh === 0 ? 'ready: one tile from winning' : sh === 1 ? '1 step from ready' : `${sh} steps from ready`);

export function discardHint(s, p) {
  const list = analyseDiscards(s, p);
  const c = kindCounts(fullHand(s, p));
  list.sort((a, b) => a.sh - b.sh || b.left - a.left || (b.alone ? 1 : 0) - (a.alone ? 1 : 0));
  const b = list[0];
  const name = kindName(b.kind);
  let why;
  if (b.sh < 0) why = `Your hand is complete: you can declare the win.`;
  else {
    const reason = b.alone ? `It is on its own: no pair and no neighbours to make a chow with.`
      : isHonor(b.kind) || isTerminal(b.kind) ? `A single ${isHonor(b.kind) ? 'wind or dragon' : '1 or 9'} is hard to use.`
        : `It helps your hand the least.`;
    if (b.sh === 0) {
      const names = b.outs.map((o) => kindName(o.kind)).slice(0, 4).join(', ');
      why = `${reason} After it you are ready, waiting for ${names || 'a tile'} (${b.left} left).`;
    } else why = `${reason} You stay ${stepsText(b.sh)}, with ${b.left} tiles that help.`;
  }
  return { tile: b.tile, kind: b.kind, text: `Discard the ${name}. ${why}`, sh: b.sh, list, count: c[b.kind] };
}

// Which kinds of discard are "as good as the best" (for daily puzzles and lessons).
export function bestKinds(list) {
  const top = [...list].sort((a, b) => a.sh - b.sh || b.left - a.left)[0];
  return list.filter((x) => x.sh === top.sh && x.left === top.left).map((x) => x.kind);
}
export { LIMIT };
