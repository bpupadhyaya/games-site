// The rule book of the Chinese rings (baguenaudier). The single source of truth for legality, counting and hints: view, hints, Auto Play,
// Rules text and the tests all read this file.
//
// A puzzle with n rings is an array `bits` of length n. bits[0] is ring 1, the ring nearest the free end of the bar (the end the rings slide
// over). 1 = on the bar, 0 = off the bar. One move changes exactly one ring.
//   Ring 1 may always move.
//   Ring k (k > 1) may move only when ring k-1 is ON the bar and rings 1 .. k-2 are all OFF.
// Reading the rings as a binary number (ring 1 = lowest digit) this rule IS the reflected Gray code: the legal move sequence is the Gray code
// sequence, so the exact number of moves left from any position is the Gray-code rank of that position.

export const MIN_RINGS = 3, MAX_RINGS = 9;

export const allOn = (n) => Array(n).fill(1);
export const isSolved = (bits) => bits.every((b) => !b);
export const clone = (bits) => bits.slice();

// Can ring k (0-based: k = 0 is ring 1) move now?
export function canMove(bits, k) {
  if (k < 0 || k >= bits.length) return false;
  if (k === 0) return true;
  if (!bits[k - 1]) return false;
  for (let i = 0; i < k - 1; i++) if (bits[i]) return false;
  return true;
}

// Why not? A plain sentence for the player, or '' when the ring can move.
export function whyNot(bits, k) {
  if (canMove(bits, k)) return '';
  const name = `Ring ${k + 1}`;
  if (!bits[k - 1]) {
    const prev = `ring ${k}`;
    const others = k >= 2 ? ` and rings 1 to ${k - 1}` : '';
    void others;
    return `${name} cannot move yet: ${prev} must be on the bar first.`;
  }
  const on = [];
  for (let i = 0; i < k - 1; i++) if (bits[i]) on.push(i + 1);
  const list = on.length === 1 ? `ring ${on[0]} is` : `rings ${on.slice(0, -1).join(', ')} and ${on[on.length - 1]} are`;
  return `${name} cannot move yet: ${k >= 3 ? `rings 1 to ${k - 1}` : 'ring 1'} must be off the bar, and ${list} still on it.`;
}

export function toggle(bits, k) { const b = bits.slice(); b[k] = b[k] ? 0 : 1; return b; }
export function legalRings(bits) { const out = []; for (let k = 0; k < bits.length; k++) if (canMove(bits, k)) out.push(k); return out; }

// ---- counting: bits <-> Gray code number (ring 1 = bit 0)
const toNum = (bits) => bits.reduce((a, b, i) => a + (b ? 2 ** i : 0), 0);
const fromNum = (g, n) => Array.from({ length: n }, (_, i) => Math.floor(g / 2 ** i) % 2);
// Gray number -> its rank in the Gray sequence (inverse Gray code); rank 0 is all rings off.
function rankOf(g) { let r = 0; while (g > 0) { r ^= g; g = Math.floor(g / 2); } return r; }
const grayOf = (r) => (r ^ (r >> 1));

// The fewest moves that finish the puzzle from this position (all rings off).
export function movesLeft(bits) { return rankOf(toNum(bits)); }
// The fewest moves for n rings starting with every ring on the bar: 1, 2, 5, 10, 21, 43, 85, 171, 341 for n = 1..9.
export const parAll = (n) => rankOf(2 ** n - 1);

// The next move of a shortest solution: { ring: 0-based index, on: the state the ring goes to } or null when solved.
export function nextMove(bits) {
  const r = movesLeft(bits); if (r === 0) return null;
  const g = toNum(bits), want = grayOf(r - 1), diff = g ^ want;
  const k = Math.round(Math.log2(diff));
  return { ring: k, on: bits[k] ? 0 : 1 };
}

// The reason behind a hint, for the player. Works toward the highest ring still on the bar (the one that has to be freed last-but-hardest).
export function hintWhy(bits) {
  const m = nextMove(bits); if (!m) return 'Every ring is off the bar. Solved!';
  const k = m.ring; let top = -1; for (let i = bits.length - 1; i >= 0; i--) if (bits[i]) { top = i; break; }
  const verb = m.on ? 'Put' : 'Take';
  const act = `${verb} ring ${k + 1} ${m.on ? 'back on the bar' : 'off the bar'}`;
  if (k === top && !m.on) return `${act}: it is the highest ring still on, and it is free to move now.`;
  if (k === 0) return `${act}. Ring 1 may always move, and this move opens the way for the next ring.`;
  if (k === top) return `${act}: it has to be on the bar before the lower rings can be cleared.`;
  return `${act}: it is free now (ring ${k} is on, the rings before it are off), and it gets ring ${top + 1} closer to coming off.`;
}

// A random legal start for Scramble: a position at least `minFrac` of the way from solved to the hardest one.
export function scramble(n, rng, minFrac = 0.4) {
  const max = parAll(n), lo = Math.max(2, Math.ceil(max * minFrac));
  const r = lo + rng.int(max - lo + 1);
  return fromNum(grayOf(r), n);
}
export const fromRank = (r, n) => fromNum(grayOf(r), n);
export { toNum as bitsToNum };

// A whole shortest solution from `bits`, as a list of ring indices (used by tests and diagrams).
export function solution(bits) {
  const out = []; let b = bits.slice();
  for (let guard = 0; guard < 2000; guard++) { const m = nextMove(b); if (!m) break; out.push(m.ring); b = toggle(b, m.ring); }
  return out;
}

export function describe(ring, on) { return `Ring ${ring + 1} ${on ? 'goes on the bar' : 'comes off the bar'}`; }
