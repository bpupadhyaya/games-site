// Deterministic noise for a throw: the same match seed, end and stone number always give the same wobble, so a
// resumed match repeats the same ice. Not the game's rng stream (that would shift whenever other features draw).
export function hash(a, b, c, d) {
  let h = 2166136261 >>> 0;
  for (const v of [a, b, c, d]) { h ^= (v | 0) + 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; }
  return (h >>> 0) / 4294967296;
}
// roughly normal, mean 0, spread 1
export function gauss(a, b, c, d) { return (hash(a, b, c, d * 3) + hash(a, b, c, d * 3 + 1) + hash(a, b, c, d * 3 + 2) - 1.5) * 2; }

// Raw wobble of one delivery: weight (fraction of speed), line (rad), and the ice under that stone.
export function throwNoise(seed, end, shotNo, sigV, sigA) {
  return {
    dv: gauss(seed, end, shotNo, 1) * sigV,
    dth: gauss(seed, end, shotNo, 2) * sigA,
    fr: 1 + gauss(seed, end, shotNo, 3) * 0.012,
    cv: 1 + gauss(seed, end, shotNo, 4) * 0.07,
  };
}
export const HUMAN = { sigV: 0.009, sigA: 0.0012 };

export function applyNoise(p, nz) {
  return { v0: p.v0 * (1 + nz.dv), theta: p.theta + nz.dth, turn: p.turn, fr: nz.fr, cv: nz.cv };
}
