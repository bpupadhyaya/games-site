// Mesopotamia (Middle East / West Asia, Tier 1 — docs/WORLD-WEAVE-TAXONOMY.md).
// Sourcing: see design/RESEARCH-NOTES.md §1. Decorative motif = the rosette (a widespread ancient
// Near Eastern geometric ornament, used here purely as decoration, never as a religious symbol —
// matching the precedent already set by games/ro/royal-game-of-ur-race) plus guilloche interlace
// thread colors (gold / lapis / shell, the same three materials that game's own art direction uses).
//
// The ONE region-specific twist (docs/WORLD-WEAVE-GAMEPLAY.md §5b/§5c): a handful of fixed cells
// carry a rosette. Fitting one well locks it in, permanently safe from later mismatches — a direct
// translation of the Royal Game of Ur's rosette squares (safe, cannot be landed on) into a placement
// puzzle. The base weave-fit mechanic itself (edge matching, rotate/flip/place) is unchanged.

export const id = 'mesopotamia';
export const name = 'Mesopotamia';
export const continent = 'Middle East / West Asia';
export const levelSizes = [3, 4];

export const THREADS = ['#e9b64a', '#3d5fd0', '#efe6cf']; // gold, lapis, shell
export const FRAME = -1; // border edges: no thread reaches the panel's outer edge

export const aboutText = 'Mesopotamia grew up between the Tigris and Euphrates rivers, where '
  + 'seasonal floods left fertile silt behind — among the earliest places on Earth where farming '
  + 'towns grew into cities.';

export const twistText = "This region's twist: a few cells carry a rosette. Fit one well and it "
  + 'locks in safe for good, just like a rosette square in the Royal Game of Ur.';

export const notes = [
  'The rosette, a circle of radiating petals, decorated palace ceilings, floor tiles and gateway '
    + 'friezes across the ancient Near East.',
  'The Ishtar Gate of Babylon (about 569 BCE) was faced in glazed brick in blues and golds, framed '
    + 'by rows of rosettes.',
  'At Uruk, walls were studded with thousands of painted clay cone-tips pressed into wet plaster, '
    + 'their colored ends forming zigzags and diamonds — one of the oldest mosaic techniques known.',
  "Interlaced 'guilloche' bands, two or more ropes twisted around each other, framed Mesopotamian "
    + 'wall paintings and carvings for centuries.',
];

export const deepNote = 'The Royal Cemetery of Ur (about 2600-2400 BCE) held a wooden gaming board '
  + 'inlaid with shell, red limestone and lapis lazuli — a sibling of this same decorative language, '
  + 'now in the British Museum.';

// Fixed rosette cell positions per level (never randomised — a real rosette square sits at a fixed
// path position too, not a random one).
export function rosetteCells(size) {
  if (size === 3) return [4]; // centre
  return [5, 10]; // two cells on the diagonal, size 4
}

export function pickEdgeValue(rng, info) {
  if (info.orientation === 'border') return FRAME;
  return rng.int(THREADS.length);
}

// ctx: { level, cellIndex, fitQuality } — see rules.js for how fitQuality is computed from the
// same edge-match data every region shares.
export function twist(ctx) {
  const { level, cellIndex, fitQuality } = ctx;
  if (!level.rosetteCells.includes(cellIndex)) return null;
  const locked = fitQuality !== 'poor';
  return {
    kind: 'rosette',
    locked,
    label: locked ? 'Rosette locked safe' : 'Rosette unsettled — improve the fit to lock it',
  };
}

function threadColor(code) {
  return code === FRAME ? 'rgba(233,214,168,0.22)' : THREADS[code];
}

// Draws one tile: a diamond field with a colored thread running from the centre to each edge that
// carries one, plus a small rosette flower on cells the level marks special.
export function drawTile(ctx, x, y, s, tile, opts = {}) {
  const cx = x + s / 2, cy = y + s / 2;
  ctx.save();
  ctx.fillStyle = opts.dim ? 'rgba(30,18,54,0.35)' : '#241442';
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.strokeStyle = 'rgba(233,214,168,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);

  const pts = [
    [cx, y], // N
    [x + s, cy], // E
    [cx, y + s], // S
    [x, cy], // W
  ];
  ctx.lineWidth = Math.max(3, s * 0.09);
  ctx.lineCap = 'round';
  tile.edges.forEach((code, i) => {
    ctx.strokeStyle = threadColor(code);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  });

  if (opts.rosette) {
    const r = s * 0.2;
    ctx.fillStyle = opts.locked ? '#ffe9a8' : 'rgba(255,233,168,0.55)';
    ctx.strokeStyle = '#7a5410';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.42, r * 0.2, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = opts.locked ? '#fff6d8' : 'rgba(255,246,216,0.7)';
    ctx.fill();
    ctx.stroke();
    if (opts.locked) {
      ctx.strokeStyle = 'rgba(255,246,216,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.44, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
