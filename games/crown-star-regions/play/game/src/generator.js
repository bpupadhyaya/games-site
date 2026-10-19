// Crown Fields puzzle generator.
//
// A puzzle is: an NxN grid partitioned into N coloured regions, with exactly one crown per
// row, per column and per region, and no two crowns touching (including diagonally). We build
// one by:
//   1. Backtracking a valid crown placement (one per row, randomized column order from the rng).
//   2. Growing N regions outward from those crowns. Each step picks a RANDOM region, weighted so
//      that small regions are favoured (and each region gets its own random appetite, so sizes
//      vary the way hand-made boards do), and gives it a random neighbouring free cell.
//   3. Asking a real solver for a second solution. While one exists, repair the board: take a cell
//      where the other solution puts a crown and hand it to a neighbouring region. That solution
//      now has two crowns in one region, so it is dead; the intended solution is untouched. Moves
//      that would disconnect a region, empty it, or make one region too large are not allowed.
//   4. Rating the unique board with a step-by-step logic solver (the same deductions a player
//      makes). Boards that need no deduction are rejected; among the rest, the one closest to the
//      wanted difficulty for the board size is kept.
//
// Everything is bounded (attempts, repairs, solver nodes), so generation can never hang; if the
// ideal board is not found in budget, the best valid unique board seen so far is returned.
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

// Shape limits: no region may dominate the board, and one-cell regions (which give their crown
// away) are kept rare.
const maxRegionCells = (size) => Math.floor(size * size * 0.3);
const MAX_SINGLE_CELL_REGIONS = 1;
const MIN_REGION_CELLS = 3; // repairs never shrink a region below this

// One crown per row/column, no two crowns in vertically-adjacent rows within 1 column of each
// other (that is the only way two single-per-row crowns could ever touch, since touching
// requires a row difference of exactly 1). Returns rowCol: the crown's column for every row.
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

  return backtrack(0) ? rowCol : null;
}

// Weighted random region growing. Region r starts as the crown cell of row r. On every step one
// region that still has a free neighbour is chosen with probability proportional to
// appetite[r] / cells[r]^2 — so small regions usually catch up, but not always — and claims one
// random free neighbouring cell. Regions at the size cap stop growing unless nobody else can.
function growRegions(rng, size, rowCol) {
  const total = size * size;
  const cap = maxRegionCells(size);
  const regionOf = new Array(total).fill(-1);
  const regionSize = new Array(size).fill(1);
  const appetite = [];
  for (let r = 0; r < size; r++) {
    regionOf[r * size + rowCol[r]] = r;
    appetite.push(0.35 + rng.next() * 1.65);
  }
  let unassigned = total - size;

  while (unassigned > 0) {
    const frontier = [];
    for (let r = 0; r < size; r++) frontier.push([]);
    for (let cell = 0; cell < total; cell++) {
      if (regionOf[cell] !== -1) continue;
      for (const nb of neighbors4(cell, size)) {
        const r = regionOf[nb];
        if (r !== -1 && !frontier[r].includes(cell)) frontier[r].push(cell);
      }
    }
    let open = [];
    for (let r = 0; r < size; r++) if (frontier[r].length > 0 && regionSize[r] < cap) open.push(r);
    if (open.length === 0) for (let r = 0; r < size; r++) if (frontier[r].length > 0) open.push(r);
    if (open.length === 0) return null; // cannot happen on a connected grid

    const weights = open.map((r) => appetite[r] / (regionSize[r] * regionSize[r]));
    let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
    let chosen = open[open.length - 1];
    for (let i = 0; i < open.length; i++) {
      roll -= weights[i];
      if (roll < 0) {
        chosen = open[i];
        break;
      }
    }
    const cell = rng.pick(frontier[chosen]);
    regionOf[cell] = chosen;
    regionSize[chosen] += 1;
    unassigned -= 1;
  }
  return regionOf;
}

// Real backtracking solver: walks every crown placement allowed by the game's rules (one per
// row, column and region, none touching) and collects up to `limit` full solutions as rowCol
// arrays. `count` keeps counting past `limit` up to `countCap`. `order` (optional) is the order
// columns are tried in, which only changes WHICH solutions are sampled first. Stops past `nodeBudget` nodes and
// reports `exhausted: false`, which callers treat as "unknown — do not trust this board".
export function findSolutions(size, regions, limit, nodeBudget, countCap = limit, order = null) {
  const cols = order ?? [...Array(size).keys()];
  const rowCol = new Array(size).fill(-1);
  const solutions = [];
  let count = 0;
  let nodes = 0;
  let stopped = false;

  const backtrack = (row, colMask, regionMask, prevCol) => {
    if (row === size) {
      count += 1;
      if (solutions.length < limit) solutions.push(rowCol.slice());
      if (count >= countCap) stopped = true;
      return;
    }
    if (++nodes > nodeBudget) {
      stopped = true;
      return;
    }
    const base = row * size;
    for (let i = 0; i < size; i++) {
      const col = cols[i];
      if (colMask & (1 << col)) continue;
      if (col - prevCol <= 1 && prevCol - col <= 1) continue;
      const regionBit = 1 << regions[base + col];
      if (regionMask & regionBit) continue;
      rowCol[row] = col;
      backtrack(row + 1, colMask | (1 << col), regionMask | regionBit, col);
      if (stopped) return;
    }
  };

  backtrack(0, 0, 0, -9);
  return { solutions, count, nodes, exhausted: nodes <= nodeBudget && count < countCap };
}

// Cells that must leave region `from` together with `path`: the path itself plus any part of
// the region that would be cut off from `keep` (the region's intended crown) without it. Those
// parts all touch the path, so the receiving region stays connected too.
function cellsLeavingWith(size, regions, from, path, keep) {
  const staying = new Set([keep]);
  const stack = [keep];
  while (stack.length > 0) {
    const cell = stack.pop();
    for (const nb of neighbors4(cell, size)) {
      if (regions[nb] !== from || path.includes(nb) || staying.has(nb)) continue;
      staying.add(nb);
      stack.push(nb);
    }
  }
  const leaving = [];
  for (let cell = 0; cell < regions.length; cell++) {
    if (regions[cell] === from && !staying.has(cell)) leaving.push(cell);
  }
  return leaving;
}

// Shortest corridors from `cell` through its own region to each neighbouring region, at most
// `maxLength` cells long and never crossing `keep` (the region's intended crown). Handing a
// whole corridor to the neighbour moves `cell` out of its region even when it is not on the
// border. Returns [{ path, to }], one per reachable neighbouring region.
function corridors(size, regions, cell, keep, maxLength) {
  const from = regions[cell];
  const found = new Map();
  let layer = [[cell]];
  const seen = new Set([cell]);
  for (let length = 1; length <= maxLength && layer.length > 0; length++) {
    const next = [];
    for (const path of layer) {
      const tip = path[path.length - 1];
      for (const nb of neighbors4(tip, size)) {
        if (regions[nb] !== from) {
          if (!found.has(regions[nb])) found.set(regions[nb], path);
        } else if (nb !== keep && !seen.has(nb)) {
          seen.add(nb);
          next.push([...path, nb]);
        }
      }
    }
    layer = next;
  }
  return [...found].map(([to, path]) => ({ to, path }));
}

// Repairs `regions` in place until the intended solution is the only one. Each round looks at a
// sample of the other solutions and finds the cells they most often crown. Handing such a cell
// (with a short corridor if it is not on a border) to a neighbouring region kills every sampled
// solution that used it. While the board still has a huge number of solutions the most-used cell
// is simply moved; once the count is small enough to measure, a few candidate moves are compared
// and the one leaving the fewest solutions is kept. Recently moved cells are left alone for a
// while so the search cannot circle. Returns true once the solver proves the intended solution
// is the only one; false if the budget ran out or no legal change exists.
function makeUnique(rng, size, regions, rowCol, maxRepairs, nodeBudget, work) {
  const cap = maxRegionCells(size);
  const regionSize = new Array(size).fill(0);
  for (const r of regions) regionSize[r] += 1;
  const COUNT_CAP = 3000;
  const SAMPLE = 40;
  const recentlyMoved = [];

  // A search that ran out of budget is read as "still a huge number of solutions".
  const solve = () => {
    const result = findSolutions(size, regions, SAMPLE, nodeBudget, COUNT_CAP, rng.shuffle([...Array(size).keys()]));
    if (!result.exhausted) result.count = COUNT_CAP;
    work.nodes += result.nodes;
    return result;
  };

  let current = solve();
  for (let repair = 0; repair < maxRepairs; repair++) {
    if (current.count === 1) return true; // proven: the search finished and found only ours
    if (current.solutions.length === 0 || work.nodes > work.hardLimit) return false;

    const votes = new Map();
    for (const other of current.solutions) {
      for (let row = 0; row < size; row++) {
        if (other[row] === rowCol[row]) continue;
        const cell = row * size + other[row];
        if (recentlyMoved.includes(cell)) continue;
        votes.set(cell, (votes.get(cell) ?? 0) + 1 + rng.next() * 0.5);
      }
    }
    const targets = [...votes].sort((a, b) => b[1] - a[1]).map(([cell]) => cell);
    const blind = current.count >= COUNT_CAP;
    const maxTries = blind ? 1 : current.count > 60 ? 4 : 10;

    let best = null;
    let tried = 0;
    for (const cell of targets) {
      if (tried >= maxTries) break;
      const from = regions[cell];
      const keep = from * size + rowCol[from];
      for (const { to, path: corridor } of corridors(size, regions, cell, keep, 3)) {
        if (tried >= maxTries) break;
        const path = cellsLeavingWith(size, regions, from, corridor, keep);
        if (regionSize[from] - path.length < MIN_REGION_CELLS || regionSize[to] + path.length > cap) continue;
        for (const c of path) regions[c] = to;
        const result = solve();
        for (const c of path) regions[c] = from;
        tried += 1;
        if ((!best || result.count < best.result.count)) best = { path, from, to, result };
      }
    }
    if (!best) return false;
    for (const c of best.path) regions[c] = best.to;
    regionSize[best.from] -= best.path.length;
    regionSize[best.to] += best.path.length;
    recentlyMoved.push(...best.path);
    while (recentlyMoved.length > 12) recentlyMoved.shift();
    current = best.result;
  }
  return false;
}

// Step-by-step logic solver used to rate a board. It only ever applies deductions a player can
// make, always trying the simplest first:
//   tier 0  a row/column/region with one cell left gets its crown; a crown crosses out its row,
//           column, region and the eight cells around it
//   tier 1  a region whose open cells all sit in one row/column claims that line (and the
//           mirror: a line whose open cells all sit in one region claims that region)
//   tier 2  a cell is crossed out if a crown there would leave some row/column/region with no
//           open cell
//   tier 3  k regions locked inside k neighbouring lines claim those lines (and the mirror:
//           k neighbouring lines touched by only k regions claim those regions)
// Returns { solved, maxTier, steps: [count per tier], givenAway } where `givenAway` is how many
// crowns fall out using tier 0 alone.
export function rateDifficulty(size, regions) {
  const total = size * size;
  const open = new Array(total).fill(true);
  const crowned = new Array(total).fill(false);
  const units = [];
  for (let i = 0; i < size; i++) {
    const rowCells = [];
    const colCells = [];
    for (let j = 0; j < size; j++) {
      rowCells.push(i * size + j);
      colCells.push(j * size + i);
    }
    units.push(rowCells, colCells);
  }
  const regionCells = [];
  for (let r = 0; r < size; r++) regionCells.push([]);
  for (let cell = 0; cell < total; cell++) regionCells[regions[cell]].push(cell);
  units.push(...regionCells);
  const unitDone = new Array(units.length).fill(false);

  // Cells a crown at `cell` rules out (same row, column, region, and the 8 around it).
  const reach = [];
  for (let cell = 0; cell < total; cell++) {
    const row = Math.floor(cell / size);
    const col = cell % size;
    const list = [];
    for (let other = 0; other < total; other++) {
      if (other === cell) continue;
      const oRow = Math.floor(other / size);
      const oCol = other % size;
      if (
        oRow === row ||
        oCol === col ||
        regions[other] === regions[cell] ||
        (Math.abs(oRow - row) <= 1 && Math.abs(oCol - col) <= 1)
      ) {
        list.push(other);
      }
    }
    reach.push(list);
  }

  let crowns = 0;
  let broken = false;
  const place = (cell) => {
    crowned[cell] = true;
    crowns += 1;
    for (const other of reach[cell]) open[other] = false;
    units.forEach((unit, u) => {
      if (unit.includes(cell)) unitDone[u] = true;
    });
  };

  const tier0 = () => {
    for (let u = 0; u < units.length; u++) {
      if (unitDone[u]) continue;
      const left = units[u].filter((cell) => open[cell]);
      if (left.length === 0) {
        broken = true;
        return false;
      }
      if (left.length === 1) {
        place(left[0]);
        return true;
      }
    }
    return false;
  };

  const rowOf = (cell) => Math.floor(cell / size);
  const colOf = (cell) => cell % size;

  const tier1 = () => {
    let changed = false;
    for (let r = 0; r < size; r++) {
      const left = regionCells[r].filter((cell) => open[cell] && !crowned[cell]);
      if (left.length === 0 || unitDone[2 * size + r]) continue;
      for (const lineOf of [rowOf, colOf]) {
        const line = lineOf(left[0]);
        if (!left.every((cell) => lineOf(cell) === line)) continue;
        for (let cell = 0; cell < total; cell++) {
          if (open[cell] && lineOf(cell) === line && regions[cell] !== r) {
            open[cell] = false;
            changed = true;
          }
        }
      }
    }
    for (let u = 0; u < 2 * size; u++) {
      if (unitDone[u]) continue;
      const left = units[u].filter((cell) => open[cell]);
      if (left.length === 0) continue;
      const r = regions[left[0]];
      if (!left.every((cell) => regions[cell] === r)) continue;
      for (const cell of regionCells[r]) {
        if (open[cell] && !units[u].includes(cell)) {
          open[cell] = false;
          changed = true;
        }
      }
    }
    return changed;
  };

  const tier2 = () => {
    for (let cell = 0; cell < total; cell++) {
      if (!open[cell] || crowned[cell]) continue;
      const hit = new Set(reach[cell]);
      for (let u = 0; u < units.length; u++) {
        if (unitDone[u] || units[u].includes(cell)) continue;
        if (units[u].every((other) => !open[other] || hit.has(other))) {
          open[cell] = false;
          return true;
        }
      }
    }
    return false;
  };

  const tier3 = () => {
    for (const lineOf of [rowOf, colOf]) {
      for (let span = 2; span < size; span++) {
        for (let first = 0; first + span <= size; first++) {
          const last = first + span - 1;
          const inside = (cell) => lineOf(cell) >= first && lineOf(cell) <= last;
          const locked = [];
          const touching = [];
          for (let r = 0; r < size; r++) {
            const left = regionCells[r].filter((cell) => open[cell]);
            if (left.length === 0) continue;
            if (left.every(inside)) locked.push(r);
            if (left.some(inside)) touching.push(r);
          }
          let changed = false;
          if (locked.length === span) {
            for (let cell = 0; cell < total; cell++) {
              if (open[cell] && !crowned[cell] && inside(cell) && !locked.includes(regions[cell])) {
                open[cell] = false;
                changed = true;
              }
            }
          }
          if (touching.length === span) {
            for (let cell = 0; cell < total; cell++) {
              if (open[cell] && !crowned[cell] && !inside(cell) && touching.includes(regions[cell])) {
                open[cell] = false;
                changed = true;
              }
            }
          }
          if (changed) return true;
        }
      }
    }
    return false;
  };

  const tiers = [tier0, tier1, tier2, tier3];
  const steps = [0, 0, 0, 0];
  let maxTier = 0;
  let givenAway = -1;
  while (crowns < size && !broken) {
    let progressed = false;
    for (let t = 0; t < tiers.length; t++) {
      if (t === 1 && givenAway === -1) givenAway = crowns;
      if (tiers[t]()) {
        steps[t] += 1;
        maxTier = Math.max(maxTier, t);
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }
  if (givenAway === -1) givenAway = crowns;
  return { solved: crowns === size && !broken, maxTier, steps, givenAway };
}

// One number for "how much thinking": harder deductions count for more.
const difficultyScore = (rating) =>
  rating.steps[1] + 3 * rating.steps[2] + 6 * rating.steps[3] + (rating.solved ? 0 : 12);

function shapeOk(size, regions) {
  const regionSize = new Array(size).fill(0);
  for (const r of regions) regionSize[r] += 1;
  const singles = regionSize.filter((n) => n === 1).length;
  return singles <= MAX_SINGLE_CELL_REGIONS && Math.max(...regionSize) <= Math.floor(size * size * 0.4);
}

// What each board size asks of the player. `minScore` is the difficulty a board must reach to be
// taken straight away; otherwise the best board seen within `candidates` unique boards wins.
const profileFor = (size) =>
  size >= 10 ? { minScore: 14, candidates: 6 } : { minScore: 4, candidates: 4 };

// Generates one NxN puzzle with a unique solution, deterministic from `rng`.
// Returns { size, regions, solution, difficulty } or null if no attempt produced a unique board
// (callers retry with a fresh rng.fork(); with the budgets below that is not expected for 7/10).
export function generatePuzzle(
  rng,
  size,
  {
    attempts = 60,
    nodeBudget = 60000,
    maxRepairs = 40,
    hardNodeLimit = size >= 10 ? 60000000 : 5000000,
    softNodeLimit = hardNodeLimit / 5,
  } = {},
) {
  const profile = profileFor(size);
  // Total solver work for this call. Past the soft limit the best board so far is returned;
  // past the hard limit generation stops no matter what.
  const work = { nodes: 0, hardLimit: hardNodeLimit };
  let best = null;
  let uniqueSeen = 0;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const rowCol = placeCrowns(rng, size);
    if (!rowCol) continue;
    const regions = growRegions(rng, size, rowCol);
    if (!regions) continue;
    if (work.nodes > hardNodeLimit || (best && work.nodes > softNodeLimit)) break;
    if (!makeUnique(rng, size, regions, rowCol, maxRepairs, nodeBudget, work)) continue;
    if (!shapeOk(size, regions)) continue;

    const rating = rateDifficulty(size, regions);
    // A board whose crowns all fall out from forced single cells is not a puzzle.
    if (rating.givenAway >= size) continue;
    // Prefer boards a player can finish by pure deduction (no guessing), then by difficulty.
    const score = difficultyScore(rating);
    const rank = (rating.solved ? 1000 : 0) + Math.min(score, 999);
    if (!best || rank > best.rank) {
      best = {
        rank,
        puzzle: {
          size,
          regions,
          solution: rowCol.map((col, row) => ({ row, col })),
          difficulty: { score, tier: rating.maxTier, logical: rating.solved },
        },
      };
    }
    uniqueSeen += 1;
    if ((rating.solved && score >= profile.minScore) || uniqueSeen >= profile.candidates) break;
  }
  return best ? best.puzzle : null;
}
