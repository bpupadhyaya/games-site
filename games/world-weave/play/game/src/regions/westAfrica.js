// Niger River & West African savanna/forest belt (Africa, Tier 1 — docs/WORLD-WEAVE-TAXONOMY.md).
// Sourcing: see design/RESEARCH-NOTES.md §3. Decorative motif = strip-weaving (kente and related
// traditions): cloth woven as long narrow strips, each carrying its own repeating color sequence,
// then sewn strip to strip. This game reproduces only that generic structural idea (a woven strip
// of repeating color), never a specific named/owned pattern — the same "pure decoration" line
// games/ow/oware-seed-sowing's own art direction already draws for adinkra motifs.
//
// The ONE region-specific twist: Oware (already shipped for this lineage) captures backward through
// a consecutive run of pits left on 2 or 3, one at a time. Translated here: when a placed tile
// continues a run of matching color along its row, the fit bonus sows backward through the whole
// run just completed, one cell at a time. The base weave-fit mechanic itself is unchanged.

import { rowCol, indexAt, N, E, S, W, edgesMatch } from '../grid.js';

export const id = 'west-africa';
export const name = 'Niger River & West Africa';
export const continent = 'Africa';
export const levelSizes = [3, 4];

export const STRANDS = ['#d9a441', '#2f3d7a', '#b5502e', '#e8dcc3']; // gold, indigo, terracotta, cream

export const aboutText = 'Along the Niger River and the savanna and forest belt behind it, farming, '
  + 'trade and metalworking towns grew for over a thousand years, connected by the river itself and '
  + 'by overland caravan routes.';

export const twistText = "This region's twist: line up a run of matching color along a row and the "
  + 'bonus sows backward through the whole run — the same backward, one-by-one gathering Oware uses '
  + 'when it captures a line of pits.';

export const notes = [
  'Across West Africa, cloth is often woven in long narrow strips, each strip carrying its own '
    + 'repeating sequence of color.',
  'Many strips are woven separately, then sewn edge to edge — the finished cloth is a patchwork of '
    + 'independent bands, not one continuous weave.',
  "Ghana's Asante and Ewe weavers each developed their own strip-weaving style: bold geometric "
    + 'blocks for one, a tweed-like mix of plied threads for the other.',
  'The same region gave the world Oware, a sowing game where seeds are dropped one by one around a '
    + 'circuit of pits, and a full run can be gathered in a single sweep.',
];

export const deepNote = 'A finished strip-woven cloth can use dozens of separately woven strips, '
  + "each one a small, complete pattern in its own right before it ever meets its neighbors.";

export function pickEdgeValue(rng) {
  return rng.int(STRANDS.length);
}

// ctx: { level, board, cellIndex } — walk backward (west) through the row while consecutive shared
// edges keep matching, exactly the way Oware checks backward through consecutive 2-or-3 pits.
export function twist(ctx) {
  const { level, board, cellIndex } = ctx;
  const size = level.size;
  const { row, col } = rowCol(cellIndex, size);
  const runCells = [cellIndex];
  let c = col;
  while (c > 0) {
    const leftIdx = indexAt(row, c - 1, size);
    const hereIdx = indexAt(row, c, size);
    const leftTile = board[leftIdx], hereTile = board[hereIdx];
    if (!leftTile || !hereTile) break;
    if (!edgesMatch(hereTile.edges[W], leftTile.edges[E])) break;
    runCells.push(leftIdx);
    c -= 1;
  }
  const propagated = runCells.length >= 2;
  return {
    kind: 'strip',
    runCells,
    propagated,
    label: propagated ? `Sown backward through ${runCells.length - 1} strip cell(s)` : 'Start of a new strip run',
  };
}

// Draws one tile as a small woven swatch: a neutral undyed-cotton centre with a colored edge band
// on each of its 4 sides — the band color is what must continue into the next strip cell, the same
// "thread on each edge" visual language every region uses (see mesopotamia.js), read here as dyed
// weft bands rather than guilloche thread.
export function drawTile(ctx, x, y, s, tile, opts = {}) {
  ctx.save();
  ctx.fillStyle = opts.dim ? 'rgba(40,28,16,0.35)' : '#3a2c1c';
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  const bw = Math.max(6, s * 0.17);
  const bandColor = (code) => (opts.dim ? 'rgba(120,100,70,0.35)' : STRANDS[code] ?? '#8a7a5e');
  ctx.fillStyle = bandColor(tile.edges[N]);
  ctx.fillRect(x + 1, y + 1, s - 2, bw);
  ctx.fillStyle = bandColor(tile.edges[S]);
  ctx.fillRect(x + 1, y + s - bw - 1, s - 2, bw);
  ctx.fillStyle = bandColor(tile.edges[W]);
  ctx.fillRect(x + 1, y + 1, bw, s - 2);
  ctx.fillStyle = bandColor(tile.edges[E]);
  ctx.fillRect(x + s - bw - 1, y + 1, bw, s - 2);
  // weft texture across the centre
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 1;
  for (let k = 1; k < 3; k++) {
    const ly = y + bw + ((s - 2 * bw) * k) / 3;
    ctx.beginPath();
    ctx.moveTo(x + bw + 2, ly);
    ctx.lineTo(x + s - bw - 2, ly);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(20,12,6,0.35)';
  ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
  if (opts.propagated) {
    ctx.strokeStyle = 'rgba(255,246,214,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
  }
  ctx.restore();
}
