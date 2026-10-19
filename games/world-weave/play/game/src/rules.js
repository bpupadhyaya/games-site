// The "weave-fit" rules every region shares (docs/WORLD-WEAVE-GAMEPLAY.md §1): for a tile about to
// be dropped at `cellIndex`, compare its 4 edges against whatever is already placed next to it.
// This file never changes per region — only each region's own `twist()` (see regions/*.js) adds
// the ONE extra construction-rule check layered on top, per §5b's "comfort and challenge" rule.
import { DIRS, OPPOSITE, neighborIndex, edgesMatch } from './grid.js';

// Base edge-fit for a tile at `cellIndex`, against neighbours already on `board`. `board` must NOT
// yet contain a tile at `cellIndex` — this looks only at what is already placed around it.
export function computeFit(level, board, cellIndex, edges) {
  const size = level.size;
  let applicable = 0, matches = 0;
  for (const dir of DIRS) {
    const n = neighborIndex(cellIndex, size, dir);
    if (n < 0) continue;
    const neighborTile = board[n];
    if (!neighborTile) continue;
    applicable += 1;
    if (edgesMatch(edges[dir], neighborTile.edges[OPPOSITE[dir]])) matches += 1;
  }
  const ratio = applicable === 0 ? 1 : matches / applicable;
  const quality = ratio === 1 ? 'perfect' : ratio >= 0.5 ? 'good' : 'poor';
  return { applicable, matches, quality };
}

// Full evaluation of one placement: base fit + the region's one extra construction-rule twist.
// `board` must not yet contain a tile at `cellIndex`.
export function evaluatePlacement(region, level, board, cellIndex, edges) {
  const fit = computeFit(level, board, cellIndex, edges);
  let special = null;
  if (typeof region.twist === 'function') {
    const tentative = board.slice();
    tentative[cellIndex] = { edges };
    special = region.twist({ level, board: tentative, cellIndex, fitQuality: fit.quality });
  }
  return { ...fit, special };
}

// Whole-panel finish check, called once every cell is filled. Each region's own extra condition
// (beyond every cell being a perfect edge-fit) is checked here, in the shape that region needs:
// Mesopotamia needs its rosette cells to have locked; Deccan/kolam needs the whole thread to have
// converged into one fragment; West Africa has no extra completion condition (Oware's propagation
// bonus already happened live, tile by tile, during play).
export function evaluatePanel(region, level, board) {
  let allPerfect = true;
  for (let i = 0; i < board.length; i++) {
    const tile = board[i];
    if (!tile) { allPerfect = false; continue; }
    const fit = computeFit(level, board, i, tile.edges);
    if (fit.quality !== 'perfect') allPerfect = false;
  }
  let specialsOk = true;
  if (region.id === 'mesopotamia') {
    specialsOk = level.rosetteCells.every((i) => board[i]?.special?.locked);
  } else if (region.id === 'kolam') {
    const thread = region.twist({ level, board });
    specialsOk = thread.fragments <= 1;
  }
  return { allPerfect, specialsOk, perfectWeave: allPerfect && specialsOk };
}
