// The engine of Tiebele House Painting: pure and deterministic (no clock, no DOM, no Math.random).
// A wall is a W x H grid of cells holding 0 (bare mud) or a pigment id 1..3. The elder paints the "source" region; the rest of the
// panel must be its symmetric copy under the wall's symmetry kind. Everything the Rules page quotes comes from the constants here.

export const PIGMENTS = [
  null,
  { id: 1, name: 'Kaolin white', short: 'White', hex: '#f3ead3', edge: '#b8ab8c' },
  { id: 2, name: 'Charcoal black', short: 'Black', hex: '#241c18', edge: '#0d0907' },
  { id: 3, name: 'Red earth', short: 'Red', hex: '#b5452b', edge: '#6f2414' },
];
export const MAX_W = 10;
export const MAX_H = 8;
export const SHIELD_WARN = 0.9;        // seconds between a warning ring and the drop landing (later walls shorten it)
export const REPAIR_MIN_ACC = 0.75;    // one star
export const TWO_STAR_ACC = 0.92;
export const PAR_SLACK = 1.5;          // three stars need strokes within 1.5 x par (rounded up) plus one
export const SCORE = { cell: 10, shield: 5, strokeBonus: 5, pigment: 2, repairStroke: 2 };
export const UNDO_NOTE = 'Undo returns the pigment, but the stroke stays counted.';

export const KIND_INFO = {
  mirrorV: { name: 'Mirror, left to right', short: 'Mirror', brief: 'Paint the right half as the mirror image of the elder\'s left half.', rel: 'mirror image' },
  mirrorH: { name: 'Mirror, top to bottom', short: 'Mirror', brief: 'Paint the lower half as the mirror image of the elder\'s upper half.', rel: 'mirror image' },
  quad: { name: 'Four-way mirror', short: 'Four mirrors', brief: 'Mirror the elder\'s top-left quarter across both middle lines.', rel: 'mirror image' },
  rot2: { name: 'Half-turn', short: 'Half-turn', brief: 'Turn the elder\'s left half round by half a turn to fill the right half.', rel: 'half-turn' },
  rot4: { name: 'Quarter-turn', short: 'Quarter-turn', brief: 'Turn the elder\'s top-left quarter round the centre three times.', rel: 'quarter-turn' },
  repeat: { name: 'Repeat', short: 'Repeat', brief: 'Repeat the elder\'s first band across the whole wall, unchanged.', rel: 'repeat' },
  glide: { name: 'Glide', short: 'Glide', brief: 'Repeat the first band, flipped upside down every second time.', rel: 'glide' },
  diag: { name: 'Diagonal mirror', short: 'Diagonal', brief: 'Mirror the elder\'s lower-left triangle across the diagonal.', rel: 'mirror image' },
};

// ---- small seeded generator, independent of env.rng so a wall is a pure function of its config ---------------------------------
export function mkRng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n), pick: (arr) => arr[Math.floor(next() * arr.length)], chance: (p) => next() < p };
}

// ---- symmetry ---------------------------------------------------------------------------------------------------------------------
// partnerOf: the source cell a cell copies, or null when the cell belongs to the elder's region itself.
export function partnerOf(kind, W, H, p, x, y) {
  const hw = W / 2, hh = H / 2;
  switch (kind) {
    case 'mirrorV': return x < hw ? null : [W - 1 - x, y];
    case 'mirrorH': return y < hh ? null : [x, H - 1 - y];
    case 'quad': return (x < hw && y < hh) ? null : [Math.min(x, W - 1 - x), Math.min(y, H - 1 - y)];
    case 'rot2': return x < hw ? null : [W - 1 - x, H - 1 - y];
    case 'rot4': {
      if (x < hw && y < hh) return null;
      let cx = x, cy = y;
      for (let k = 0; k < 3; k++) { const nx = W - 1 - cy, ny = cx; cx = nx; cy = ny; if (cx < hw && cy < hh) return [cx, cy]; }
      return null;
    }
    case 'repeat': return x < p ? null : [x % p, y];
    case 'glide': return x < p ? null : [x % p, Math.floor(x / p) % 2 ? H - 1 - y : y];
    case 'diag': return x <= y ? null : [y, x];
    default: return null;
  }
}
export const isSource = (cfg, x, y) => partnerOf(cfg.kind, cfg.W, cfg.H, cfg.p || 0, x, y) === null;

// ---- the elder's motif: horizontal bands built from a few classic arrangements -------------------------------------------------------
const MOTIFS = ['solid', 'alt', 'dots', 'saw', 'zig', 'checks', 'bars'];
function genSource(cfg, rng) {
  const { W, H, colors } = cfg;
  const bands = [];
  let y = 0;
  while (y < H) {
    const h = Math.min(H - y, 1 + rng.int(2));
    const motif = rng.pick(MOTIFS);
    const c1 = rng.pick(colors);
    const pool = [0, 0, ...colors.filter((c) => c !== c1)];
    const c2 = rng.pick(pool);
    bands.push({ y0: y, h, motif, c1, c2, p: 2 + rng.int(3), ph: rng.int(4) });
    y += h;
  }
  const val = (x, yy) => {
    const b = bands.find((q) => yy >= q.y0 && yy < q.y0 + q.h), r = yy - b.y0, p = b.p, xx = x + b.ph;
    switch (b.motif) {
      case 'solid': return b.c1;
      case 'alt': return xx % 2 ? b.c1 : b.c2;
      case 'dots': return xx % p === 0 ? b.c1 : b.c2;
      case 'saw': return (xx % (p + 1)) <= r + 1 ? b.c1 : b.c2;
      case 'zig': { const t = Math.abs((xx % (2 * p)) - p); return (r === 0 ? t < p / 2 + 0.5 : t >= p / 2) ? b.c1 : b.c2; }
      case 'checks': return (xx + r) % 2 ? b.c1 : b.c2;
      case 'bars': return (xx % (p + 1)) < p ? b.c1 : b.c2;
      default: return b.c1;
    }
  };
  const src = new Array(W * H).fill(0);
  for (let yy = 0; yy < H; yy++) for (let x = 0; x < W; x++) if (isSource(cfg, x, yy)) src[yy * W + x] = val(x, yy);
  return src;
}

// ---- a wall -----------------------------------------------------------------------------------------------------------------------
export function buildWall(cfg) {
  const { W, H } = cfg, N = W * H, p = cfg.p || 0;
  let src = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const rng = mkRng(cfg.seed * 31 + attempt * 1013 + 7);
    src = genSource(cfg, rng);
    const painted = src.filter((v) => v > 0).length, srcCount = src.length && (() => { let n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isSource(cfg, x, y)) n++; return n; })();
    if (painted >= srcCount * 0.34 && painted <= srcCount * 0.9) break;
  }
  const target = new Array(N).fill(0), init = new Array(N).fill(0), elder = new Array(N).fill(false);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, q = partnerOf(cfg.kind, W, H, p, x, y);
    if (q === null) { target[i] = src[i]; init[i] = src[i]; elder[i] = true; } else target[i] = src[q[1] * W + q[0]];
  }
  // a few of the empty half's cells may be pre-painted so the first walls are gentler
  const grng = mkRng(cfg.seed * 17 + 3);
  const cand = [];
  for (let i = 0; i < N; i++) if (!elder[i] && target[i] > 0) cand.push(i);
  const nGiven = Math.floor(cand.length * (cfg.given || 0));
  for (let k = 0; k < nGiven; k++) { const j = grng.int(cand.length); init[cand[j]] = target[cand[j]]; cand.splice(j, 1); }
  const need = [0, 0, 0, 0];
  for (let i = 0; i < N; i++) if (init[i] !== target[i] && target[i] > 0) need[target[i]]++;
  const rainDrops = cfg.rain ? cfg.rain.n : 0;
  const reserve = Math.ceil(rainDrops * (cfg.rain && cfg.rain.streak ? 1.4 : 1) * 0.45);
  const cap = [0, 0, 0, 0];
  const used = cfg.colors.filter((c) => need[c] > 0 || elder.some((e, i) => e && init[i] === c));
  for (const c of cfg.colors) {
    if (!used.includes(c) && need[c] === 0) { cap[c] = 0; continue; }
    cap[c] = need[c] + Math.ceil(need[c] * (cfg.slack ?? 0.12)) + Math.ceil(reserve / Math.max(1, used.length)) + 2;
  }
  const wall = { cfg, W, H, N, kind: cfg.kind, p, target, init, elder, need, cap };
  wall.par = Math.max(1, countStrokes(wall, init));
  return wall;
}
export const paletteOf = (wall) => wall.cfg.colors.filter((c) => wall.cap[c] > 0);

// ---- planning ------------------------------------------------------------------------------------------------------------------------
// The best next stroke from `cells`: the longest straight run of cells that need the same action (a pigment, or 0 = wipe).
// `pig` limits runs to the units left (pass null for unlimited). Returns { idx:[...], color, vertical } or null when nothing is left.
export function planStroke(wall, cells, pig, out) {
  const { W, H, target } = wall;
  let best = null;
  const consider = (idx, color, vertical) => {
    if (!idx.length) return;
    let list = idx;
    if (color > 0 && pig) { const left = pig[color]; if (left <= 0) return; if (list.length > left) list = list.slice(0, left); }
    const over = list.filter((i) => cells[i] !== 0 && color > 0).length;
    const score = list.length - over * 0.4 + (color === 0 ? -0.3 : 0);
    if (out) out.push({ idx: list.slice(), color, vertical, score });
    if (!best || score > best.score + 1e-9) best = { idx: list.slice(), color, vertical, score, over };
  };
  for (let y = 0; y < H; y++) {
    let run = [], col = -1;
    for (let x = 0; x <= W; x++) {
      const i = y * W + x, need = x < W && cells[i] !== target[i], c = need ? target[i] : -1;
      if (need && c === col) run.push(i);
      else { if (col >= 0) consider(run, col, false); run = need ? [i] : []; col = need ? c : -1; }
    }
  }
  for (let x = 0; x < W; x++) {
    let run = [], col = -1;
    for (let y = 0; y <= H; y++) {
      const i = y * W + x, need = y < H && cells[i] !== target[i], c = need ? target[i] : -1;
      if (need && c === col) run.push(i);
      else { if (col >= 0) consider(run, col, true); run = need ? [i] : []; col = need ? c : -1; }
    }
  }
  return best;
}
export function countStrokes(wall, cells) {
  const c = cells.slice();
  let n = 0;
  for (let guard = 0; guard < 400; guard++) {
    const s = planStroke(wall, c, null);
    if (!s) break;
    for (const i of s.idx) c[i] = s.color;
    n++;
  }
  return n;
}
export const cellName = (wall, i) => `column ${(i % wall.W) + 1}, row ${Math.floor(i / wall.W) + 1}`;
// Words for a planned stroke: which cells, what colour, and which of the elder's cells they copy.
export function explainStroke(wall, cells, s) {
  const { W, kind, p, H } = wall, n = s.idx.length;
  const first = s.idx[0], x = first % W, y = Math.floor(first / W);
  const where = s.vertical ? `column ${x + 1}, rows ${y + 1} to ${Math.floor(s.idx[n - 1] / W) + 1}` : `row ${y + 1}, columns ${x + 1} to ${(s.idx[n - 1] % W) + 1}`;
  if (s.color === 0) return `Wipe ${n} cell${n === 1 ? '' : 's'} in ${where} back to bare mud: the pattern leaves them empty.`;
  const q = partnerOf(kind, W, H, p, x, y), pg = PIGMENTS[s.color];
  let why;
  if (q) why = `They are the ${KIND_INFO[kind].rel} of the elder's ${PIGMENTS[wall.target[q[1] * W + q[0]]] ? PIGMENTS[wall.target[q[1] * W + q[0]]].short.toLowerCase() : 'bare'} cells, starting from column ${q[0] + 1}, row ${q[1] + 1}.`;
  else why = 'They belong to the elder\'s own half, so they should match what the elder painted.';
  return `${pg.short} for ${n} cell${n === 1 ? '' : 's'} in ${where}. ${why}${s.over ? ` It paints over ${s.over} wrong cell${s.over === 1 ? '' : 's'}.` : ''}`;
}

// ---- the brush -------------------------------------------------------------------------------------------------------------------------
// Apply `color` (0 = cloth) to cell i. Returns 'ok', 'same', 'dry' (pot empty).
export function paintCell(cells, pig, i, color) {
  if (cells[i] === color) return 'same';
  if (color > 0) { if (pig[color] <= 0) return 'dry'; pig[color]--; }
  cells[i] = color;
  return 'ok';
}

// ---- the rain -------------------------------------------------------------------------------------------------------------------------
export function makeRain(wall, cells, rng) {
  const r = wall.cfg.rain;
  if (!r) return null;
  const painted = [];
  for (let i = 0; i < wall.N; i++) if (cells[i] !== 0) painted.push(i);
  const n = Math.min(r.n, painted.length);
  const order = rng.shuffle(painted);
  const warn = r.warn ?? SHIELD_WARN;
  const gap = Math.max(0.35, (r.dur - 1.6 - warn) / Math.max(1, n));
  const drops = [];
  for (let k = 0; k < n; k++) {
    const t0 = 0.9 + k * gap + (rng.next() - 0.5) * gap * 0.55;
    drops.push({ i: order[k], t0: Math.max(0.5, t0), warn, streak: !!r.streak && rng.chance(0.55), st: 'wait', hitT: 0 });
  }
  drops.sort((a, b) => a.t0 - b.t0);
  return { drops, t: 0, dur: Math.max(r.dur, (drops.length ? drops[drops.length - 1].t0 + warn : 0) + 1.2) };
}

// ---- results -------------------------------------------------------------------------------------------------------------------------
export function judge(wall, cells) {
  let right = 0;
  const wrong = [];
  for (let i = 0; i < wall.N; i++) { if (cells[i] === wall.target[i]) right++; else wrong.push(i); }
  return { right, wrong, acc: right / wall.N };
}
export function scoreWall(wall, cells, run) {
  const j = judge(wall, cells);
  const paintLimit = Math.ceil(wall.par * PAR_SLACK) + 1;
  const pigLeft = run.pig.reduce((a, b) => a + b, 0);
  let stars = 0;
  if (j.acc >= REPAIR_MIN_ACC) stars = 1;
  if (j.acc >= TWO_STAR_ACC) stars = 2;
  if (j.wrong.length === 0 && run.paintStrokes <= paintLimit) stars = 3;
  const strokeBonus = Math.max(0, wall.par * 2 - run.paintStrokes) * SCORE.strokeBonus;
  const score = Math.max(0, j.right * SCORE.cell + run.shields * SCORE.shield + strokeBonus + pigLeft * SCORE.pigment - run.repairStrokes * SCORE.repairStroke);
  return { ...j, stars, score, paintLimit, pigLeft, strokeBonus };
}

// ---- the campaign ---------------------------------------------------------------------------------------------------------------------
const RN = (n, dur, o = {}) => ({ n, dur, ...o });
export const COURTYARDS = ['First Wall', 'After the Rains', 'The Long Wall', 'The Corner House', 'The Courtyard Gate', 'The Master Wall'];
export const LEVELS = [
  { kind: 'mirrorV', W: 6, H: 4, colors: [2], given: 0.3, slack: 0.3, guide: true, seed: 101 },
  { kind: 'mirrorV', W: 8, H: 4, colors: [2, 1], given: 0.2, slack: 0.25, guide: true, seed: 102 },
  { kind: 'mirrorH', W: 6, H: 6, colors: [2, 1], given: 0.15, slack: 0.2, guide: true, seed: 103 },
  { kind: 'mirrorV', W: 8, H: 6, colors: [2, 1], given: 0.1, slack: 0.2, guide: true, rain: RN(5, 10, { warn: 1.3 }), seed: 104 },
  { kind: 'rot2', W: 8, H: 6, colors: [2, 1], given: 0.1, slack: 0.18, rain: RN(6, 11, { warn: 1.25 }), seed: 105 },
  { kind: 'quad', W: 8, H: 8, colors: [2, 1, 3], given: 0.1, slack: 0.18, rain: RN(7, 12, { warn: 1.2 }), seed: 106 },
  { kind: 'repeat', W: 9, H: 4, p: 3, colors: [2, 1], given: 0.1, slack: 0.18, rain: RN(6, 11, { warn: 1.15 }), seed: 107 },
  { kind: 'glide', W: 8, H: 5, p: 4, colors: [2, 1, 3], given: 0, slack: 0.15, rain: RN(7, 12, { warn: 1.1 }), seed: 108 },
  { kind: 'diag', W: 8, H: 8, colors: [2, 1, 3], given: 0, slack: 0.15, rain: RN(8, 12, { warn: 1.05 }), seed: 109 },
  { kind: 'rot4', W: 8, H: 8, colors: [2, 1, 3], given: 0, slack: 0.15, rain: RN(8, 13, { warn: 1.0 }), seed: 110 },
  { kind: 'mirrorV', W: 10, H: 6, colors: [2, 1, 3], given: 0, slack: 0.14, rain: RN(10, 14, { streak: true, warn: 0.95 }), seed: 111 },
  { kind: 'quad', W: 10, H: 8, colors: [2, 1, 3], given: 0, slack: 0.14, rain: RN(10, 14, { streak: true, warn: 0.95 }), seed: 112 },
  { kind: 'rot2', W: 10, H: 6, colors: [2, 1, 3], given: 0, slack: 0.12, rain: RN(11, 15, { streak: true, warn: 0.95 }), seed: 113 },
  { kind: 'glide', W: 10, H: 6, p: 5, colors: [2, 1, 3], given: 0, slack: 0.12, rain: RN(11, 15, { streak: true, warn: 0.95 }), seed: 114 },
  { kind: 'repeat', W: 10, H: 6, p: 5, colors: [2, 1, 3], given: 0, slack: 0.12, rain: RN(12, 16, { streak: true, warn: 0.9 }), seed: 115 },
  { kind: 'rot4', W: 8, H: 8, colors: [2, 1, 3], given: 0, slack: 0.1, rain: RN(13, 16, { streak: true, warn: 0.85 }), seed: 116 },
  { kind: 'glide', W: 10, H: 8, p: 5, colors: [2, 1, 3], given: 0, slack: 0.1, rain: RN(14, 17, { streak: true, warn: 0.8 }), seed: 117 },
  { kind: 'quad', W: 10, H: 8, colors: [2, 1, 3], given: 0, slack: 0.08, rain: RN(16, 18, { streak: true, warn: 0.75 }), seed: 118 },
].map((l, i) => ({ ...l, id: i, court: Math.floor(i / 3), name: `Wall ${i + 1}` }));

// The Daily Wall: a mid-to-hard configuration chosen from the calendar day.
export function dailyLevel(day) {
  const r = mkRng((day | 0) * 2654435761 + 11);
  const kinds = ['mirrorV', 'mirrorH', 'quad', 'rot2', 'rot4', 'repeat', 'glide', 'diag'];
  const kind = r.pick(kinds);
  const sq = kind === 'rot4' || kind === 'diag';
  const W = sq ? 8 : r.pick([8, 10]), H = sq ? 8 : r.pick([4, 6, 8]);
  const p = kind === 'repeat' || kind === 'glide' ? (W === 10 ? 5 : r.pick([2, 4])) : 0;
  const colors = r.chance(0.5) ? [2, 1, 3] : [2, 1];
  const n = 7 + r.int(6);
  return { id: -1, court: -1, name: 'Daily Wall', kind, W, H, p, colors, given: 0, slack: 0.14, rain: RN(n, 11 + n, { streak: r.chance(0.5) }), seed: 5000 + ((day | 0) % 9973) };
}
// Watch & Learn walls: small, calm, one new idea each time.
export const WATCH_LEVELS = [
  { kind: 'mirrorV', W: 6, H: 4, colors: [2, 1], given: 0, slack: 0.3, guide: true, rain: RN(3, 9), seed: 901, id: -2, court: -1, name: 'Watch' },
  { kind: 'rot2', W: 6, H: 4, colors: [2, 1], given: 0, slack: 0.3, guide: true, rain: RN(3, 9), seed: 902, id: -2, court: -1, name: 'Watch' },
  { kind: 'quad', W: 6, H: 6, colors: [2, 1, 3], given: 0, slack: 0.3, guide: true, rain: RN(4, 10), seed: 903, id: -2, court: -1, name: 'Watch' },
];
export const levelUnlocked = (record, i) => i === 0 || (record.stars[i - 1] || 0) >= 1;
