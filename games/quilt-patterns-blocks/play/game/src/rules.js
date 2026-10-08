// The rule evaluator: given a challenge and the player's design, which rules hold? Pure functions, no drawing.
// Block design: { paint: [fabricId | '' per patch] }.  Quilt design: { cells: [{t, r}], sashW, sashF, bordW, bordF }.
import { blockOf, BLOCKS } from './blocks.js';
import { fab, BAND_NAME } from './fabrics.js';

export const SASH = [0, 0.14, 0.26];
export const BORD = [0, 0.22, 0.4];
export const SASH_NAME = ['None', 'Narrow', 'Wide'];
export const pct = (x) => `${Math.round(x * 100)}%`;
const lumOf = (id) => fab(id)?.lum ?? 0.5;

// ---- block maths ---------------------------------------------------------------------------------------------------------
export function roleLum(block, paint, role) {
  let a = 0, s = 0;
  for (const i of block.byRole[role]) if (paint[i]) { a += block.area[i]; s += block.area[i] * lumOf(paint[i]); }
  return a ? s / a : null;
}
export const usedFabrics = (paint) => [...new Set(paint.filter(Boolean))];
export function clashes(block, paint) {
  let n = 0;
  for (const [i, j] of block.adj) if (paint[i] && paint[j] && fab(paint[i])?.busy && fab(paint[j])?.busy) n += 1;
  return n;
}
export function darkCentroid(block, paint) {
  let w = 0, x = 0, y = 0;
  paint.forEach((f, i) => { if (!f) return; const k = block.area[i] * (1 - lumOf(f)); w += k; x += k * block.mid[i][0]; y += k * block.mid[i][1]; });
  return w ? Math.hypot(x / w - 0.5, y / w - 0.5) : 0;
}
export const meanLum = (block, paint) => { let a = 0, s = 0; paint.forEach((f, i) => { if (f) { a += block.area[i]; s += block.area[i] * lumOf(f); } }); return a ? s / a : 0.5; };
export const bandsUsed = (paint) => new Set(paint.filter(Boolean).map((f) => fab(f).band)).size;

const roleName = (block, r) => block.roles[r] ?? 'Pieces';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function conText(block, c) {
  switch (c.k) {
    case 'contrast': return `${cap(roleName(block, c.a))} and ${roleName(block, c.b).toLowerCase()} at least ${pct(c.min)} apart in value`;
    case 'darker': return `${cap(roleName(block, c.a))} darker than ${roleName(block, c.b).toLowerCase()} by at least ${pct(c.min)}`;
    case 'maxf': return `Use at most ${c.n} different fabrics`;
    case 'minf': return `Use at least ${c.n} different fabrics`;
    case 'feature': return `Use ${fab(c.f)?.name ?? 'the feature fabric'} in at least ${c.n} pieces`;
    case 'quiet': return 'No two touching pieces both in busy prints';
    case 'balance': return 'Keep the dark weight near the middle of the block';
    case 'values': return 'Use a light, a medium and a dark fabric';
    case 'same': return `All ${roleName(block, c.a).toLowerCase()} in one fabric`;
    default: return c.k;
  }
}
// -> { ok, detail }
export function evalCon(block, paint, c) {
  const fullRole = (r) => block.byRole[r].every((i) => paint[i]);
  switch (c.k) {
    case 'contrast': { const a = roleLum(block, paint, c.a), b = roleLum(block, paint, c.b); if (a === null || b === null) return { ok: false, detail: '' }; const d = Math.abs(a - b); return { ok: d >= c.min - 1e-9, detail: `now ${pct(d)}` }; }
    case 'darker': { const a = roleLum(block, paint, c.a), b = roleLum(block, paint, c.b); if (a === null || b === null) return { ok: false, detail: '' }; const d = b - a; return { ok: d >= c.min - 1e-9, detail: `now ${pct(Math.max(0, d))}` }; }
    case 'maxf': { const n = usedFabrics(paint).length; return { ok: n > 0 && n <= c.n, detail: `now ${n}` }; }
    case 'minf': { const n = usedFabrics(paint).length; return { ok: n >= c.n, detail: `now ${n}` }; }
    case 'feature': { const n = paint.filter((f) => f === c.f).length; return { ok: n >= c.n, detail: `now ${n}` }; }
    case 'quiet': { const n = clashes(block, paint); return { ok: n === 0 && paint.some(Boolean), detail: n ? `${n} clash${n > 1 ? 'es' : ''}` : '' }; }
    case 'balance': { if (!paint.some(Boolean)) return { ok: false, detail: '' }; const d = darkCentroid(block, paint); return { ok: d <= c.tol + 1e-9, detail: `off by ${pct(d)}` }; }
    case 'values': { const n = bandsUsed(paint); return { ok: n >= 3, detail: `${n} of 3` }; }
    case 'same': { const fs = new Set(block.byRole[c.a].map((i) => paint[i])); return { ok: fullRole(c.a) && fs.size === 1, detail: fs.size > 1 ? `${fs.size} fabrics` : '' }; }
    default: return { ok: false, detail: '' };
  }
}

// ---- quilt maths --------------------------------------------------------------------------------------------------------
export const emptyQuilt = (n) => ({ cells: Array.from({ length: n * n }, () => ({ t: -1, r: 0 })), sashW: 0, sashF: '', bordW: 0, bordF: '' });
export function quiltGeo(q, n, S) {
  const sw = SASH[q.sashW | 0], bw = BORD[q.bordW | 0], W = n + (n - 1) * sw + 2 * bw, k = S / W;
  const cells = [], hs = [], vs = [], corners = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) cells.push({ x: (bw + i * (1 + sw)) * k, y: (bw + j * (1 + sw)) * k, s: k });
  if (sw > 0) {
    for (let i = 0; i < n - 1; i++) {
      vs.push({ x: (bw + i * (1 + sw) + 1) * k, y: bw * k, w: sw * k, h: (W - 2 * bw) * k });
      hs.push({ x: bw * k, y: (bw + i * (1 + sw) + 1) * k, w: (W - 2 * bw) * k, h: sw * k });
      for (let j = 0; j < n - 1; j++) corners.push({ x: (bw + i * (1 + sw) + 1) * k, y: (bw + j * (1 + sw) + 1) * k, w: sw * k, h: sw * k });
    }
  }
  return { n, S, k, sw, bw, W, cells, hs, vs, corners, inner: { x: bw * k, y: bw * k, w: (W - 2 * bw) * k, h: (W - 2 * bw) * k }, bord: bw > 0 ? [{ x: 0, y: 0, w: S, h: bw * k }, { x: 0, y: S - bw * k, w: S, h: bw * k }, { x: 0, y: bw * k, w: bw * k, h: S - 2 * bw * k }, { x: S - bw * k, y: bw * k, w: bw * k, h: S - 2 * bw * k }] : [] };
}
export const tileLum = (t) => meanLum(blockOf(t.type), t.paint);
export function quiltBlocksLum(ch, d) {
  let s = 0, n = 0;
  for (const c of d.cells) if (c.t >= 0) { s += tileLum(ch.tiles[c.t]); n += 1; }
  return n ? s / n : 0.5;
}
export function quiltDark(ch, d) {
  const n = ch.cols; let w = 0, x = 0, y = 0;
  d.cells.forEach((c, i) => { if (c.t < 0) return; const k = 1 - tileLum(ch.tiles[c.t]); w += k; x += k * ((i % n) + 0.5) / n; y += k * (Math.floor(i / n) + 0.5) / n; });
  return w ? Math.hypot(x / w - 0.5, y / w - 0.5) : 0;
}
export function adjacentSame(ch, d) {
  const n = ch.cols; let c = 0;
  d.cells.forEach((a, i) => {
    if (a.t < 0) return;
    const x = i % n, y = Math.floor(i / n);
    for (const j of [x < n - 1 ? i + 1 : -1, y < n - 1 ? i + n : -1]) if (j >= 0 && d.cells[j].t === a.t && d.cells[j].r === a.r) c += 1;
  });
  return c;
}
export function quiltConText(c) {
  switch (c.k) {
    case 'qsash': return `Add sashing at least ${pct(c.min)} apart in value from the blocks`;
    case 'qborder': return `Add a border at least ${pct(c.min)} apart in value from the blocks`;
    case 'qrepeat': return `Use every block at least ${c.n} times`;
    case 'qecho': return 'Echo a block fabric in the border';
    case 'qnoadj': return 'No two touching blocks the same block and turn';
    case 'qbalance': return 'Keep the dark weight near the middle of the quilt';
    case 'qdiff': return 'Sashing and border in different fabrics';
    default: return c.k;
  }
}
export function evalQuiltCon(ch, d, c) {
  switch (c.k) {
    case 'qsash': { if (!d.sashW || !d.sashF) return { ok: false, detail: 'add sashing' }; const x = Math.abs(lumOf(d.sashF) - quiltBlocksLum(ch, d)); return { ok: x >= c.min - 1e-9, detail: `now ${pct(x)}` }; }
    case 'qborder': { if (!d.bordW || !d.bordF) return { ok: false, detail: 'add a border' }; const x = Math.abs(lumOf(d.bordF) - quiltBlocksLum(ch, d)); return { ok: x >= c.min - 1e-9, detail: `now ${pct(x)}` }; }
    case 'qrepeat': { const cnt = ch.tiles.map((_, i) => d.cells.filter((x) => x.t === i).length); const m = Math.min(...cnt); return { ok: m >= c.n, detail: `fewest ${m}` }; }
    case 'qecho': { if (!d.bordW || !d.bordF) return { ok: false, detail: 'add a border' }; return { ok: ch.tiles.some((t) => t.paint.includes(d.bordF)), detail: '' }; }
    case 'qnoadj': { const n = adjacentSame(ch, d); return { ok: d.cells.every((x) => x.t >= 0) && n === 0, detail: n ? `${n} match${n > 1 ? '' : ''}` : '' }; }
    case 'qbalance': { const x = quiltDark(ch, d); return { ok: x <= c.tol + 1e-9 && d.cells.some((z) => z.t >= 0), detail: `off by ${pct(x)}` }; }
    case 'qdiff': return { ok: !!d.sashW && !!d.bordW && !!d.sashF && !!d.bordF && d.sashF !== d.bordF, detail: '' };
    default: return { ok: false, detail: '' };
  }
}

// ---- the one entry point the game uses ---------------------------------------------------------------------------------------
// -> { items: [{ text, ok, detail }], complete, done, match }
export function evaluate(ch, d) {
  if (ch.kind === 'block') {
    const block = blockOf(ch.block), paint = d.paint, n = paint.length;
    const complete = paint.every(Boolean);
    if (ch.mode === 'copy') {
      const m = paint.filter((f, i) => f && f === ch.sol.paint[i]).length;
      return { items: [{ text: 'Pieces that match the sample', ok: m === n, detail: `${m} of ${n}` }], complete, done: m === n, match: m };
    }
    if (ch.mode === 'studio') return { items: [], complete, done: false, match: 0 };
    const items = ch.cons.map((c) => ({ text: conText(block, c), ...evalCon(block, paint, c) }));
    items.push({ text: 'Every piece has a fabric', ok: complete, detail: `${paint.filter(Boolean).length} of ${n}` });
    return { items, complete, done: complete && items.every((i) => i.ok), match: 0 };
  }
  const n = ch.cols * ch.cols, complete = d.cells.every((c) => c.t >= 0);
  if (ch.mode === 'copy') {
    let m = d.cells.filter((c, i) => c.t === ch.sol.cells[i].t && c.r === ch.sol.cells[i].r).length;
    const sash = d.sashW === ch.sol.sashW && d.sashF === ch.sol.sashF, bord = d.bordW === ch.sol.bordW && d.bordF === ch.sol.bordF;
    const items = [{ text: 'Blocks placed and turned like the sample', ok: m === n, detail: `${m} of ${n}` }, { text: 'Sashing like the sample', ok: sash, detail: '' }, { text: 'Border like the sample', ok: bord, detail: '' }];
    return { items, complete, done: items.every((i) => i.ok), match: m };
  }
  if (ch.mode === 'studio') return { items: [], complete, done: false, match: 0 };
  const items = ch.cons.map((c) => ({ text: quiltConText(c), ...evalQuiltCon(ch, d, c) }));
  items.push({ text: 'Every space has a block', ok: complete, detail: `${d.cells.filter((c) => c.t >= 0).length} of ${n}` });
  return { items, complete, done: complete && items.every((i) => i.ok), match: 0 };
}
export const BLOCK_COUNT = BLOCKS.length;
export { BAND_NAME };
