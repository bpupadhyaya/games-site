// Deccan & South Indian river basins (South Asia, Tier 1 — docs/WORLD-WEAVE-TAXONOMY.md).
// Sourcing: see design/RESEARCH-NOTES.md §2. Per docs/WORLD-WEAVE-GAMEPLAY.md §5b, South Asia is
// "an unusually direct source": kolam is itself the real practice of building a geometric pattern
// by hand, on a grid of dots, as a single continuous line that never crosses itself.
//
// The ONE region-specific twist: each tile carries a short thread-segment (through one or two of
// its edges). The panel's construction-rule bonus is whether the growing thread stays a SINGLE
// connected, unbroken run rather than several disconnected fragments — literally kolam's own
// one-stroke rule, checked cell by cell instead of stroke by stroke. The base weave-fit mechanic
// (edge matching, rotate/flip/place) is unchanged from every other region.

import { rowCol, indexAt, N, E, S, W } from '../grid.js';

export const id = 'kolam';
export const name = 'Deccan & South India';
export const continent = 'South Asia';
export const levelSizes = [3, 4];

export const THROUGH = 'T';
export const BLANK = 'B';

export const aboutText = "South India's river basins (the Godavari, Krishna and Kaveri) supported "
  + 'dense farming communities and a rich tradition of geometric folk art, including the hand-drawn '
  + 'dot-grid patterns this region is known for.';

export const twistText = "This region's twist: your tiles carry a single thread. Keep it connecting "
  + 'edge to edge and the whole panel should finish as one unbroken line, the way a real kolam is '
  + 'drawn in a single stroke.';

export const notes = [
  'Kolam are geometric patterns drawn by hand on a grid of dots, most often across South India.',
  'A single kolam line can loop around every dot in the grid without ever crossing itself or '
    + 'lifting away — a genuine one-stroke drawing.',
  'In the 1970s, researchers Gift and Rani Siromoney showed that kolam patterns follow describable, '
    + 'rule-based grammars — an early bridge between traditional art and computer science.',
  'Kolam loops have since been studied as Eulerian circuits, the same graph-theory idea used to '
    + 'describe any path that crosses every connection exactly once.',
];

export const deepNote = "Because a real kolam is drawn free-hand, no two are ever quite identical "
  + "— even the same remembered design changes a little every time it's redrawn.";

// A simple, always-valid boustrophedon ("ox-plough") path visits every cell exactly once, moving
// to an orthogonal neighbour each step — a real, minimal case of the one-stroke property kolam is
// known for. Level 0 sweeps by rows, level 1 by columns, for a little shape variety.
function pathOrder(size, style) {
  const order = [];
  if (style === 'row') {
    for (let r = 0; r < size; r++) {
      if (r % 2 === 0) for (let c = 0; c < size; c++) order.push(indexAt(r, c, size));
      else for (let c = size - 1; c >= 0; c--) order.push(indexAt(r, c, size));
    }
  } else {
    for (let c = 0; c < size; c++) {
      if (c % 2 === 0) for (let r = 0; r < size; r++) order.push(indexAt(r, c, size));
      else for (let r = size - 1; r >= 0; r--) order.push(indexAt(r, c, size));
    }
  }
  return order;
}

// Not seeded by env.rng — the path shape is a fixed, always-valid construction per level, matching
// docs/GAME-CONTRACT.md's determinism rule trivially (no randomness needed to already be correct).
// The player-facing randomness (draw order, starting rotation/flip) is added afterwards in
// generator.js, exactly the same way for every region.
export function buildLevel(rng, levelIndex) {
  const size = levelSizes[levelIndex];
  const style = levelIndex % 2 === 0 ? 'row' : 'col';
  const order = pathOrder(size, style);
  const cells = Array.from({ length: size * size }, () => [BLANK, BLANK, BLANK, BLANK]);
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i], b = order[i + 1];
    const ar = rowCol(a, size), br = rowCol(b, size);
    let dirA, dirB;
    if (br.row === ar.row - 1) { dirA = N; dirB = S; }
    else if (br.row === ar.row + 1) { dirA = S; dirB = N; }
    else if (br.col === ar.col + 1) { dirA = E; dirB = W; }
    else { dirA = W; dirB = E; }
    cells[a][dirA] = THROUGH;
    cells[b][dirB] = THROUGH;
  }
  return { size, cells, endpoints: [order[0], order[order.length - 1]] };
}

// Whole-board metric, recomputed after every placement: how many separate thread fragments are
// currently on the board (union-find over matched THROUGH-THROUGH edges between placed neighbours).
// A finished panel is only a "perfect weave" when this is exactly 1 — one unbroken thread.
export function twist(ctx) {
  const { level, board } = ctx;
  const size = level.size;
  const parent = Array.from({ length: size * size }, (_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  for (let i = 0; i < board.length; i++) {
    const tile = board[i];
    if (!tile) continue;
    const { row, col } = rowCol(i, size);
    if (col + 1 < size) {
      const e = indexAt(row, col + 1, size);
      if (board[e] && tile.edges[E] === THROUGH && board[e].edges[W] === THROUGH) union(i, e);
    }
    if (row + 1 < size) {
      const sIdx = indexAt(row + 1, col, size);
      if (board[sIdx] && tile.edges[S] === THROUGH && board[sIdx].edges[N] === THROUGH) union(i, sIdx);
    }
  }
  const roots = new Set();
  let threadCells = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] && board[i].edges.includes(THROUGH)) { roots.add(find(i)); threadCells++; }
  }
  const fragments = roots.size;
  return {
    kind: 'thread',
    fragments,
    threadCells,
    label: threadCells === 0 ? 'No thread placed yet' : fragments <= 1 ? 'One unbroken thread' : `${fragments} separate thread fragments`,
  };
}

// Draws one tile: a cream dot at the centre-ish grid point, with a thread stroke running from the
// centre out to each edge the tile carries a THROUGH port on.
export function drawTile(ctx, x, y, s, tile, opts = {}) {
  const cx = x + s / 2, cy = y + s / 2;
  ctx.save();
  ctx.fillStyle = opts.dim ? 'rgba(60,18,20,0.35)' : '#4a1620';
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.strokeStyle = 'rgba(255,235,210,0.25)';
  ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);

  const pts = [[cx, y], [x + s, cy], [cx, y + s], [x, cy]];
  const hasThread = tile.edges.includes(THROUGH);
  if (hasThread) {
    ctx.strokeStyle = opts.fragmentBad ? '#ffb37a' : '#fdf3df';
    ctx.lineWidth = Math.max(3, s * 0.09);
    ctx.lineCap = 'round';
    tile.edges.forEach((code, i) => {
      if (code !== THROUGH) return;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx, cy, pts[i][0], pts[i][1]);
      ctx.stroke();
    });
  }
  // the dot every kolam line loops around
  ctx.beginPath();
  ctx.fillStyle = hasThread ? '#fdf3df' : 'rgba(253,243,223,0.35)';
  ctx.arc(cx, cy, Math.max(2.5, s * 0.05), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
