// Crown Fields puzzle generator.
//
// A puzzle is: an NxN grid partitioned into N coloured regions, with exactly one crown per
// row, per column and per region, and no two crowns touching (including diagonally). We build
// one by:
//   1. Backtracking a valid crown placement (one per row, randomized column order from env.rng).
//   2. Growing N coloured regions outward from those crowns with a randomized flood-fill, so
//      every cell belongs to exactly one region and each region contains exactly one crown.
//   3. Verifying the resulting regions admit exactly one solution with a bounded backtracking
//      solver; if not (or if step 1/2 somehow fails), retry with fresh draws from the same rng.
//
// Everything here is deterministic given the rng passed in — no Math.random, no Date.

const neighbors4 = (index, size) => {
  const row = Math.floor(index / size);
  const col = index % size;
  const out = [];
  if (row > 0) out.push(index - size);
  if (row < size - 1) out.push(index + size);
  if (col > 0) out.push(index - 1);
  if (col < size - 1) out.push(index + 1);
  return out;
};

// One crown per row/column, no two crowns in vertically-adjacent rows within 1 column of each
// other (that is the only way two single-per-row crowns could ever touch, since touching
// requires a row difference of exactly 1).
function placeCrowns(rng, size) {
  const usedCols = new Array(size).fill(false);
  const rowCol = new Array(size).fill(-1);

  const backtrack = (row) => {
    if (row === size) return true;
    const order = rng.shuffle([...Array(size).keys()]);
    for (const col of order) {
      if (usedCols[col]) continue;
      if (row > 0 && Math.abs(col - rowCol[row - 1]) <= 1) continue;
      usedCols[col] = true;
      rowCol[row] = col;
      if (backtrack(row + 1)) return true;
      usedCols[col] = false;
      rowCol[row] = -1;
    }
    return false;
  };

  if (!backtrack(0)) return null;
  return rowCol.map((col, row) => ({ row, col }));
}

// Randomized region growing: each region starts as its crown's single cell, then on every step
// the CURRENTLY LARGEST region (random tie-break) claims one random unassigned cell adjacent to
// it, until every cell belongs to a region. The grid graph is connected, so there is always at
// least one unassigned cell adjacent to some already-assigned region while any remain unassigned.
//
// "Largest region grows next" (rather than uniform-random or smallest-first) matters a lot in
// practice: it produces one or two long, winding regions plus several small, tightly-packed
// ones — the same lopsided, irregular shapes hand-made Star Battle/Queens puzzles use to force a
// unique solution. A quick empirical check (see generator sanity notes in STATUS.md) found this
// heuristic yields a uniquely-solvable puzzle on the FIRST growth attempt in effectively every
// case tried (hundreds of seeds at sizes 7, 10 and 14), whereas uniform-random or
// smallest-first growth very rarely does, especially at 10x10 and above.
function growRegions(rng, size, crowns) {
  const total = size * size;
  const regionOf = new Array(total).fill(-1);
  const regionSize = new Array(crowns.length).fill(1);
  crowns.forEach((crown, regionId) => {
    regionOf[crown.row * size + crown.col] = regionId;
  });
  let unassigned = total - crowns.length;

  while (unassigned > 0) {
    const frontierByRegion = new Map();
    for (let cell = 0; cell < total; cell++) {
      if (regionOf[cell] !== -1) continue;
      const touchedRegions = new Set();
      for (const nb of neighbors4(cell, size)) {
        if (regionOf[nb] !== -1) touchedRegions.add(regionOf[nb]);
      }
      for (const regionId of touchedRegions) {
        if (!frontierByRegion.has(regionId)) frontierByRegion.set(regionId, []);
        frontierByRegion.get(regionId).push(cell);
      }
    }
    if (frontierByRegion.size === 0) return null; // should not happen on a connected grid

    let maxSize = -Infinity;
    for (const regionId of frontierByRegion.keys()) maxSize = Math.max(maxSize, regionSize[regionId]);
    const largestRegions = [...frontierByRegion.keys()].filter((id) => regionSize[id] === maxSize);
    const regionId = rng.pick(largestRegions);
    const cell = rng.pick(frontierByRegion.get(regionId));
    regionOf[cell] = regionId;
    regionSize[regionId] += 1;
    unassigned -= 1;
  }
  return regionOf;
}

// Counts solutions (capped at `limit`) to the placement puzzle described by `regions`, using
// the same row/column/region/no-touch rules as the real game. Bails out past `nodeBudget` nodes
// so a pathological layout can't hang generation; the caller treats that as "unknown, retry".
function countSolutions(size, regions, limit, nodeBudget) {
  const usedCols = new Array(size).fill(false);
  const usedRegions = new Array(size).fill(false);
  const rowCol = new Array(size).fill(-1);
  let solutions = 0;
  let nodes = 0;
  let exhausted = true;

  const backtrack = (row) => {
    if (solutions >= limit) return;
    if (nodes++ > nodeBudget) {
      exhausted = false;
      return;
    }
    if (row === size) {
      solutions += 1;
      return;
    }
    for (let col = 0; col < size; col++) {
      if (usedCols[col]) continue;
      const regionId = regions[row * size + col];
      if (usedRegions[regionId]) continue;
      if (row > 0 && Math.abs(col - rowCol[row - 1]) <= 1) continue;
      usedCols[col] = true;
      usedRegions[regionId] = true;
      rowCol[row] = col;
      backtrack(row + 1);
      usedCols[col] = false;
      usedRegions[regionId] = false;
      rowCol[row] = -1;
      if (solutions >= limit || !exhausted) return;
    }
  };

  backtrack(0);
  return { solutions, exhausted };
}

// Generates one NxN puzzle with a unique solution, deterministic from `rng`.
// Returns { size, regions, solution } or null if every attempt failed (caller should treat a
// null as "try again with a fresh rng.fork()" — with the attempt counts below this is not
// expected to happen in practice for size 7 or 10).
export function generatePuzzle(rng, size, { attempts = 150, nodeBudget = 200000 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const crowns = placeCrowns(rng, size);
    if (!crowns) continue;
    const regions = growRegions(rng, size, crowns);
    if (!regions) continue;
    const { solutions, exhausted } = countSolutions(size, regions, 2, nodeBudget);
    if (exhausted && solutions === 1) {
      return { size, regions, solution: crowns };
    }
  }
  return null;
}
