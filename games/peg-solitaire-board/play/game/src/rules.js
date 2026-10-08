// The rule book. A position is an array of 0/1 (1 = a peg in that hole). One move = one jump: a peg leaps in a straight line over
// an adjacent peg into the empty hole just beyond; the jumped peg is removed. A turn may chain several jumps by the same peg (the
// game counts a chain as one move, as the traditional rules do).
export const fullBoard = (b, emptyHole) => { const h = new Array(b.n).fill(1); h[emptyHole] = 0; return h; };
export const count = (h) => { let c = 0; for (let i = 0; i < h.length; i++) c += h[i]; return c; };
export const legalJumps = (b, h) => { const out = []; for (const j of b.jumps) if (h[j.from] && h[j.over] && !h[j.to]) out.push(j); return out; };
export const jumpsFrom = (b, h, i) => (h[i] ? b.byFrom[i].filter((j) => h[j.over] && !h[j.to]) : []);
export const findJump = (b, h, from, to) => b.byFrom[from].find((j) => j.to === to && h[j.from] && h[j.over] && !h[j.to]) ?? null;
export function applyJump(h, j) { h[j.from] = 0; h[j.over] = 0; h[j.to] = 1; return h; }
export function undoJump(h, j) { h[j.from] = 1; h[j.over] = 1; h[j.to] = 0; return h; }
// moves (chains counted once) in a list of jumps
export const countMoves = (jumps) => { let m = 0, last = -1; for (const j of jumps) { if (j.from !== last) m++; last = j.to; } return m; };
// 0-4 pegs-left rating: 1 peg = perfect
export const pegStars = (left) => (left <= 1 ? 3 : left === 2 ? 2 : left <= 4 ? 1 : 0);

// A symmetric key for the transposition table: bits packed into two 26-bit halves joined in one safe integer (n <= 52).
export const keyOf = (h) => { let lo = 0, hi = 0; for (let i = 0; i < h.length; i++) { if (h[i]) { if (i < 26) lo |= 1 << i; else hi |= 1 << (i - 26); } } return hi * 67108864 + lo; };
