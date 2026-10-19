// Deterministic panel + tile-bag generation, shared by every region (docs/GAME-CONTRACT.md: no
// randomness outside env.rng, same seed + same input => same result).
//
// Two regions (mesopotamia, west-africa) build their target grid the same generic way: pick a
// value once for every shared edge between adjacent cells, so both neighbours automatically read
// the same value on their touching side — a tiling is "valid" (weave-fit-satisfiable) by
// construction, with no repair/backtracking needed. `kolam` builds its target grid its own way
// (a traced path, see regions/kolam.js) because its edge alphabet only has two values and needs a
// connectivity property, not just a color; both paths converge back into the same tile-bag shape.
import { indexAt } from './grid.js';

export function buildSharedEdgeGrid(size, rng, pickValue) {
  const h = []; // h[r][c]: shared edge between (r,c) and (r,c+1)
  const v = []; // v[r][c]: shared edge between (r,c) and (r+1,c)
  for (let r = 0; r < size; r++) {
    h[r] = [];
    for (let c = 0; c < size - 1; c++) h[r][c] = pickValue(rng, { orientation: 'h', r, c });
  }
  for (let r = 0; r < size - 1; r++) {
    v[r] = [];
    for (let c = 0; c < size; c++) v[r][c] = pickValue(rng, { orientation: 'v', r, c });
  }
  const cells = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      cells.push([
        r > 0 ? v[r - 1][c] : pickValue(rng, { orientation: 'border', dir: 'N', r, c }),
        c < size - 1 ? h[r][c] : pickValue(rng, { orientation: 'border', dir: 'E', r, c }),
        r < size - 1 ? v[r][c] : pickValue(rng, { orientation: 'border', dir: 'S', r, c }),
        c > 0 ? h[r][c - 1] : pickValue(rng, { orientation: 'border', dir: 'W', r, c }),
      ]);
    }
  }
  return cells;
}

// Builds one panel's target grid + fixed layout data for a region/level.
export function buildPanel(region, rng, levelIndex) {
  if (typeof region.buildLevel === 'function') return region.buildLevel(rng, levelIndex);
  const size = region.levelSizes[levelIndex];
  const cells = buildSharedEdgeGrid(size, rng, region.pickEdgeValue);
  const extra = {};
  if (typeof region.rosetteCells === 'function') extra.rosetteCells = region.rosetteCells(size);
  return { size, cells, ...extra };
}

// Turns a panel's target cells into the player-facing draw order: every tile from the solved grid,
// shuffled into a random draw sequence, each starting at a random rotation/flip so the player has
// to manoeuvre it back into a good fit rather than simply reading off the answer.
export function makeBag(rng, cells) {
  const order = rng.shuffle(cells.map((_, i) => i));
  return order.map((cellIndex) => ({
    originCell: cellIndex, // bookkeeping only — never shown to the player, no "correct cell" hint
    baseEdges: cells[cellIndex],
    rot: rng.int(4),
    flip: rng.chance(0.5),
  }));
}

export function buildLevel(region, rng, levelIndex) {
  const panel = buildPanel(region, rng, levelIndex);
  const level = {
    regionId: region.id,
    levelIndex,
    size: panel.size,
    targetCells: panel.cells,
    rosetteCells: panel.rosetteCells ?? [],
    bag: makeBag(rng, panel.cells),
  };
  return level;
}

export { indexAt };
