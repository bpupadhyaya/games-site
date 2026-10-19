// Pure grid math shared by every region. This is the one, never-changing "weave-fit" base: a
// square grid of cells, tiles carry an edge code on each of their 4 sides [N, E, S, W], and a
// tile can be rotated (90 degree steps) or flipped before it is placed. No region may alter this
// base — see design/GDD.md "Region-specific construction rules" and docs/WORLD-WEAVE-GAMEPLAY.md
// §5b's "Comfort and challenge" section: the base never changes, only ONE extra rule per region.

export const N = 0, E = 1, S = 2, W = 3;
export const DIRS = [N, E, S, W];
export const OPPOSITE = [S, W, N, E];
export const DELTA = [
  { dr: -1, dc: 0 }, // N
  { dr: 0, dc: 1 },  // E
  { dr: 1, dc: 0 },  // S
  { dr: 0, dc: -1 }, // W
];

export function rowCol(index, size) {
  return { row: Math.floor(index / size), col: index % size };
}

export function indexAt(row, col, size) {
  return row * size + col;
}

// The neighbour cell index in direction `dir`, or -1 if that would leave the board.
export function neighborIndex(index, size, dir) {
  const { row, col } = rowCol(index, size);
  const d = DELTA[dir];
  const r = row + d.dr, c = col + d.dc;
  if (r < 0 || r >= size || c < 0 || c >= size) return -1;
  return indexAt(r, c, size);
}

// Rotate a tile's 4 edges 90 degrees clockwise: the old West edge becomes the new North edge.
export function rotateCW(edges) {
  return [edges[W], edges[N], edges[E], edges[S]];
}

// Mirror a tile left-to-right (flip across a vertical axis): East and West swap.
export function flipH(edges) {
  return [edges[N], edges[W], edges[S], edges[E]];
}

// Apply `rot` 90-degree clockwise turns (0-3) and then an optional flip, to a tile's base edges.
export function transform(baseEdges, rot, flip) {
  let e = baseEdges;
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) e = rotateCW(e);
  if (flip) e = flipH(e);
  return e;
}

// The one rule every region shares: two facing edges continue each other when their codes match.
export function edgesMatch(a, b) {
  return a === b;
}
