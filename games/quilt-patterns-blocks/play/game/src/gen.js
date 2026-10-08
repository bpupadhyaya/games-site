// Challenge generator, planner and explanations. Everything is seeded (mulberry32), so a seed always gives the same
// challenge and the daily brief is the same for every player. A generated brief always has a known solution (`sol`).
import { BLOCKS, BLOCK_IDS, blockOf } from './blocks.js';
import { FABRICS, FAB, PALETTES, ALL_IDS, fab, BAND_NAME } from './fabrics.js';
import { evalCon, conText, quiltConText, evalQuiltCon, evaluate, emptyQuilt, pct, usedFabrics, roleLum, clashes, darkCentroid, bandsUsed, quiltBlocksLum, quiltDark, adjacentSame, SASH_NAME } from './rules.js';

export function prng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const int = (n) => Math.floor(next() * n);
  const pick = (arr) => arr[int(arr.length)];
  const shuffle = (arr) => { const o = arr.slice(); for (let i = o.length - 1; i > 0; i--) { const j = int(i + 1); [o[i], o[j]] = [o[j], o[i]]; } return o; };
  return { next, int, pick, shuffle };
}

const GRADE = ['', 'Easy', 'Medium', 'Hard'];
export const gradeName = (g) => GRADE[g] ?? '';
const sortByLum = (ids) => ids.slice().sort((a, b) => fab(a).lum - fab(b).lum);

function pickTray(r, palette, n) {
  const ids = palette.ids.slice(), sorted = sortByLum(ids);
  const must = [sorted[0], sorted[sorted.length - 1]];
  const rest = r.shuffle(ids.filter((x) => !must.includes(x)));
  return r.shuffle([...must, ...rest.slice(0, Math.max(0, n - 2))]);
}

// ---- a role-consistent solution for one block ---------------------------------------------------------------------------------
function solveRoles(r, block, tray, grade) {
  const nR = block.nRoles, lightBg = r.next() < 0.72;
  const byL = sortByLum(tray);
  for (let attempt = 0; attempt < 80; attempt++) {
    const pool = r.shuffle(tray), a = (lightBg ? pool.filter((f) => fab(f).lum >= 0.55) : pool.filter((f) => fab(f).lum <= 0.35));
    if (!a.length) continue;
    const A = a[0], roles = [A];
    for (let k = 1; k < nR; k++) {
      const cand = pool.filter((f) => !roles.includes(f) && Math.abs(fab(f).lum - fab(A).lum) >= 0.24);
      if (!cand.length) break;
      roles.push(cand[0]);
    }
    if (roles.length === nR) return roles;
  }
  const A = lightBg ? byL[byL.length - 1] : byL[0], others = (lightBg ? byL.slice(0, -1) : byL.slice(1).reverse());
  return [A, ...others.slice(0, nR - 1)];
}
function paintFromRoles(block, roles, scrapRoles = null) {
  return block.patches.map((p, i) => (scrapRoles && scrapRoles[p.role] && block.byRole[p.role].indexOf(i) % 2 === 1 ? scrapRoles[p.role] : roles[p.role]));
}
function scrapPartners(r, block, tray, roles) {
  const out = roles.map(() => null);
  roles.forEach((f, k) => {
    if (block.byRole[k].length < 4) return;
    const c = tray.filter((x) => x !== f && !roles.includes(x) && Math.abs(fab(x).lum - fab(f).lum) < 0.22);
    if (c.length) out[k] = r.pick(c);
  });
  return out;
}

// ---- rules for a block brief --------------------------------------------------------------------------------------------------
function candidateCons(r, block, paint, roles, tray, scrapped) {
  const out = [], nR = block.nRoles;
  const L = (k) => roleLum(block, paint, k);
  const floorPct = (x) => Math.max(0.1, Math.floor((x * 0.85) * 20) / 20);
  for (let k = 1; k < nR; k++) { const d = Math.abs(L(0) - L(k)); if (d >= 0.2) out.push({ k: 'contrast', a: 0, b: k, min: Math.min(0.4, floorPct(d)), w: k === 1 ? 5 : 3 }); }
  for (let a = 0; a < nR; a++) for (let b = 0; b < nR; b++) if (a !== b) { const d = L(b) - L(a); if (d >= 0.25) out.push({ k: 'darker', a, b, min: Math.min(0.35, floorPct(d)), w: 2 }); }
  const nf = usedFabrics(paint).length;
  out.push({ k: 'maxf', n: nf, w: 2 });
  if (nf >= 3) out.push({ k: 'minf', n: nf - (scrapped ? 1 : 0), w: 1 });
  const counts = {}; paint.forEach((f) => { counts[f] = (counts[f] || 0) + 1; });
  for (const [f, n] of Object.entries(counts)) if (n >= 3) out.push({ k: 'feature', f, n, w: 2 });
  if (clashes(block, paint) === 0 && tray.filter((f) => fab(f).busy).length >= 2 && paint.length >= 6) out.push({ k: 'quiet', w: 3 });
  const asym = ['log-cabin', 'bear-paw', 'flying-geese'].includes(block.id) || scrapped;
  if (asym) { const d = darkCentroid(block, paint); out.push({ k: 'balance', tol: Math.max(0.03, Math.ceil((d + 0.025) * 100) / 100), w: 3 }); }
  if (bandsUsed(paint) >= 3) out.push({ k: 'values', w: 3 });
  return out;
}

function passRate(r, block, tray, cons, tries = 160) {
  let ok = 0;
  for (let t = 0; t < tries; t++) {
    const roles = Array.from({ length: block.nRoles }, () => r.pick(tray));
    const paint = block.patches.map((p) => roles[p.role]);
    if (cons.every((c) => evalCon(block, paint, c).ok)) ok += 1;
  }
  return ok / tries;
}

function genBlockBrief(r, blockId, grade, palette) {
  const block = blockOf(blockId), want = grade + 1, trayN = [0, 6, 7, 8][grade];
  let best = null;
  for (let attempt = 0; attempt < 14; attempt++) {
    const tray = pickTray(r, palette, trayN), roles = solveRoles(r, block, tray, grade);
    const partners = grade >= 3 ? scrapPartners(r, block, tray, roles) : null, paint = paintFromRoles(block, roles, partners);
    const scrapped = !!partners && partners.some(Boolean);
    const cand = candidateCons(r, block, paint, roles, tray, scrapped);
    const first = cand.filter((c) => c.k === 'contrast' && c.b === 1).slice(0, 1);
    const rest = r.shuffle(cand.filter((c) => !first.includes(c)));
    const pool = [...first, ...rest.sort((a, b) => b.w * (0.5 + r.next()) - a.w * (0.5 + r.next()))];
    const cons = []; const kinds = new Set();
    for (const c of pool) { const key = c.k + (c.a ?? '') + (c.b ?? '') + (c.f ?? ''); if (kinds.has(key) || (grade === 1 && c.k === 'contrast' && cons.length) || (c.k === 'maxf' && cons.some((x) => x.k === 'minf')) || (c.k === 'minf' && cons.some((x) => x.k === 'maxf'))) continue; kinds.add(key); cons.push(c); if (cons.length >= want) break; }
    if (cons.length < Math.min(want, 2)) continue;
    const rate = passRate(r, block, tray, cons);
    const cur = { tray, roles, partners, paint, cons, rate }; r.lastRate = rate;
    if (!best || rate < best.rate) best = cur;
    if (rate <= [0, 0.2, 0.1, 0.05][grade]) break;
  }
  return best;
}

export const LESSONS = [
  { id: 'l-nine', block: 'nine-patch', mode: 'copy', title: 'Nine squares, two cloths', teach: ['A block is a small picture pieced from patches. Cut every patch from its own fabric, then sew them in rows.', 'The Nine-Patch is nine equal squares. The four corners and the centre take the print, the four edges take the plain.', 'Seam allowance (a quarter inch) is why quilters cut each piece slightly larger than it will finish.'] },
  { id: 'l-pinwheel', block: 'pinwheel', mode: 'copy', title: 'Triangles that turn', teach: ['A half-square triangle is a square cut once corner to corner. Two of them make a square again.', 'Turn four of them a quarter turn each and the blades of a Pinwheel appear. The same pieces turned differently would make a diamond.', 'Each triangle has two short edges on the straight grain and one long bias edge, which stretches. Press, do not pull.'] },
  { id: 'l-geese', block: 'flying-geese', mode: 'copy', title: 'Geese fly point-up', teach: ['A flying goose is one tall triangle between two small ones. The rectangle is twice as wide as it is tall.', 'The sky triangles meet the goose along its two long sides. Every goose points the way the row is going.', 'Stack geese tip to tail and the points make a sawtooth line.'] },
  { id: 'l-log', block: 'log-cabin', mode: 'brief', title: 'Light side, dark side', teach: ['Log Cabin starts from one centre square, traditionally a warm colour for the hearth.', 'Strips (logs) are added round it in turn. Two sides of the block are light and two are dark, which splits the block along a diagonal.', 'Where the light and dark logs meet, the block gets its sense of light falling from one corner.'] },
  { id: 'l-star', block: 'ohio-star', mode: 'brief', title: 'Star points and sky', teach: ['The Ohio Star is a nine-patch whose four edge squares are hourglass units. The star points need to stand out from the sky behind them.', 'Corners and sky are the quiet background. The points and the centre are the star.', 'Count the pieces: five squares and sixteen triangles. Twenty-one patches, one star.'] },
  { id: 'l-paw', block: 'bear-paw', mode: 'brief', title: 'Pad and toes', teach: ['Bear Paw pairs a big square pad with a row of four pointed toes.', 'Large patches and small ones in one block need balance: if every dark piece sits at one edge, the block feels heavy on that side.', 'Try keeping the pad and the toes in different values so each shape reads on its own.'] },
  { id: 'l-value', block: 'log-cabin', mode: 'brief', title: 'Value: light, medium, dark', teach: ['Value is how light or dark a fabric is, whatever its colour. It is what makes a pattern readable from across the room.', 'Squint at your work (the Squint tool) and colours melt into greys. If two neighbouring pieces turn into the same grey, the pattern disappears.', 'A balanced block usually holds all three values: light, medium and dark.'], cons: [{ k: 'values' }, { k: 'contrast', a: 0, b: 1, min: 0.25 }] },
  { id: 'l-quiet', block: 'flying-geese', mode: 'brief', title: 'Quiet beside busy', teach: ['A busy print (plaid, stripe, floral, gingham) next to another busy print makes the eye jump. Set a quiet fabric between them.', 'Solids and small dots are the quiet cloths. Plaids, stripes, ditsy flowers and lattice are busy.', 'Rule of thumb: never let two busy prints share a seam.'], cons: [{ k: 'quiet' }, { k: 'contrast', a: 0, b: 1, min: 0.2 }] },
];

function lessonChallenge(L, seed) {
  const r = prng(seed ^ 0x5eed);
  const palette = PALETTES[L.id.length % 3];
  const block = blockOf(L.block);
  if (L.mode === 'copy') return copyBlock(r, block.id, 1, palette, { id: L.id, lesson: L.id, title: L.title });
  // lessons with fixed rules: build a solution that satisfies them, with the usual quality loop
  for (let attempt = 0; attempt < 60; attempt++) {
    const tray = pickTray(r, palette, 6), roles = solveRoles(r, block, tray, 1), paint = paintFromRoles(block, roles, null);
    const cons = L.cons ? L.cons.map((c) => ({ ...c })) : candidateCons(r, block, paint, roles, tray, false).filter((c) => c.w >= 2).slice(0, 2);
    if (!cons.every((c) => evalCon(block, paint, c).ok)) continue;
    return { kind: 'block', mode: 'brief', id: L.id, lesson: L.id, title: L.title, grade: 1, block: block.id, tray, sol: { paint }, cons, par: paint.length, roles };
  }
  const tray = pickTray(r, palette, 6), roles = solveRoles(r, block, tray, 1), paint = paintFromRoles(block, roles, null);
  return { kind: 'block', mode: 'brief', id: L.id, lesson: L.id, title: L.title, grade: 1, block: block.id, tray, sol: { paint }, cons: [{ k: 'contrast', a: 0, b: 1, min: 0.2 }], par: paint.length, roles };
}

function copyBlock(r, blockId, grade, palette, extra = {}) {
  const block = blockOf(blockId), tray = pickTray(r, palette, grade === 1 ? 5 : 7), roles = solveRoles(r, block, tray, grade);
  const partners = grade >= 2 ? scrapPartners(r, block, tray, roles) : null, paint = paintFromRoles(block, roles, partners);
  return { kind: 'block', mode: 'copy', grade, block: blockId, tray, sol: { paint }, cons: [], par: paint.length, roles, title: `Copy the ${block.name}`, ...extra };
}

// ---- quilts ---------------------------------------------------------------------------------------------------------------------------
function genQuilt(r, mode, grade, palette) {
  const cols = grade >= 3 ? 4 : 3, nTiles = grade === 1 ? 2 : 3, tray = pickTray(r, palette, 8);
  const types = r.shuffle(BLOCK_IDS).slice(0, nTiles);
  const tiles = types.map((t) => {
    const b = blockOf(t), roles = solveRoles(r, b, r.shuffle(tray).slice(0, 6).concat(sortByLum(tray)[0], sortByLum(tray).at(-1)), 1);
    return { type: t, paint: paintFromRoles(b, roles, null) };
  });
  const n = cols * cols;
  for (let attempt = 0; attempt < 120; attempt++) {
    const cells = Array.from({ length: n }, (_, i) => ({ t: (i + r.int(2)) % nTiles, r: r.int(4) }));
    const sol = { cells, sashW: 1 + r.int(2), sashF: r.pick(tray), bordW: 1 + r.int(2), bordF: r.pick(tray) };
    const ch = { kind: 'quilt', cols, tiles };
    const dBl = quiltBlocksLum(ch, sol);
    const cand = [];
    const ds = Math.abs(fab(sol.sashF).lum - dBl), db = Math.abs(fab(sol.bordF).lum - dBl);
    if (ds >= 0.15) cand.push({ k: 'qsash', min: Math.max(0.1, Math.floor(ds * 0.85 * 20) / 20), w: 5 });
    if (db >= 0.15) cand.push({ k: 'qborder', min: Math.max(0.1, Math.floor(db * 0.85 * 20) / 20), w: 4 });
    cand.push({ k: 'qrepeat', n: Math.min(...tiles.map((_, i) => cells.filter((c) => c.t === i).length)), w: 2 });
    if (tiles.some((t) => t.paint.includes(sol.bordF))) cand.push({ k: 'qecho', w: 3 });
    if (adjacentSame(ch, sol) === 0) cand.push({ k: 'qnoadj', w: 3 });
    cand.push({ k: 'qbalance', tol: Math.max(0.04, Math.ceil((quiltDark(ch, sol) + 0.03) * 100) / 100), w: 2 });
    if (sol.sashF !== sol.bordF) cand.push({ k: 'qdiff', w: 1 });
    if (!cand.some((c) => c.k === 'qsash')) continue;
    const need = Math.min(cand.length, grade + 1), pick = [cand.find((c) => c.k === 'qsash'), ...r.shuffle(cand.filter((c) => c.k !== 'qsash'))].slice(0, need);
    if (pick.some((c) => c.k === 'qrepeat' && c.n < 1)) continue;
    return { kind: 'quilt', mode, grade, cols, tiles, tray, sol, cons: mode === 'copy' ? [] : pick, par: n + 4, title: mode === 'copy' ? 'Copy the quilt' : 'Quilt brief' };
  }
  return null;
}

// ---- public: build any challenge from a card id and a seed ---------------------------------------------------------------------------
export const CARDS = [
  { id: 'copy1', group: 'Block challenges', kind: 'block', mode: 'copy', grade: 1, name: 'Copy the sample', sub: 'Easy · one fabric per shape' },
  { id: 'copy2', group: 'Block challenges', kind: 'block', mode: 'copy', grade: 2, name: 'Copy the scrappy sample', sub: 'Medium · two cloths per shape' },
  { id: 'brief1', group: 'Block challenges', kind: 'block', mode: 'brief', grade: 1, name: 'Design brief', sub: 'Easy · two rules' },
  { id: 'brief2', group: 'Block challenges', kind: 'block', mode: 'brief', grade: 2, name: 'Design brief', sub: 'Medium · three rules' },
  { id: 'brief3', group: 'Block challenges', kind: 'block', mode: 'brief', grade: 3, name: 'Design brief', sub: 'Hard · four rules, scrap cloth' },
  { id: 'qcopy', group: 'Quilt challenges', kind: 'quilt', mode: 'copy', grade: 1, name: 'Copy the quilt', sub: 'Match the sample top' },
  { id: 'qbrief2', group: 'Quilt challenges', kind: 'quilt', mode: 'brief', grade: 2, name: 'Quilt brief', sub: 'Three by three, three blocks' },
  { id: 'qbrief3', group: 'Quilt challenges', kind: 'quilt', mode: 'brief', grade: 3, name: 'Quilt brief', sub: 'Four by four, four rules' },
];
export function makeChallenge(cardId, seed) {
  const r = prng(seed * 2654435761 + 12345);
  const card = CARDS.find((c) => c.id === cardId);
  if (!card) return null;
  const palette = r.pick(PALETTES);
  let ch;
  if (card.kind === 'block') {
    const types = card.grade === 1 ? ['nine-patch', 'pinwheel', 'flying-geese', 'log-cabin'] : BLOCK_IDS;
    const blockId = r.pick(types), block = blockOf(blockId);
    if (card.mode === 'copy') ch = copyBlock(r, blockId, card.grade, palette, { id: cardId });
    else {
      const b = genBlockBrief(r, blockId, card.grade, palette);
      ch = { kind: 'block', mode: 'brief', id: cardId, grade: card.grade, block: blockId, tray: b.tray, sol: { paint: b.paint }, cons: b.cons, par: b.paint.length, roles: b.roles, title: `${block.name} brief` };
    }
  } else {
    ch = genQuilt(r, card.mode, card.grade, palette);
    ch.id = cardId;
  }
  ch.seed = seed; ch.palette = palette.id; ch.sub = card.sub;
  return ch;
}
export function makeLesson(id) { const L = LESSONS.find((l) => l.id === id); const ch = lessonChallenge(L, 1000 + LESSONS.indexOf(L)); ch.sub = `Lesson ${LESSONS.indexOf(L) + 1}`; return ch; }
export const DAILY_CARDS = ['brief1', 'brief2', 'brief2', 'brief3', 'qbrief2', 'copy2', 'brief3'];
export function makeDaily(day) { const ch = makeChallenge(DAILY_CARDS[(((day + 4) % 7) + 7) % 7], day * 7919 + 13); ch.daily = day; ch.title = `Daily: ${ch.title}`; return ch; }

export function studioChallenge(kind, blockId = 'nine-patch', tiles = null) {
  if (kind === 'block') return { kind: 'block', mode: 'studio', id: 'studio', block: blockId, tray: ALL_IDS.slice(), cons: [], title: 'Free Studio', sub: 'Any fabrics, any order', par: 0 };
  return { kind: 'quilt', mode: 'studio', id: 'studio-quilt', cols: 3, tiles, tray: ALL_IDS.slice(), cons: [], title: 'Quilt Studio', sub: 'Arrange and frame', par: 0 };
}
export const STARTER_TILES = () => [
  { type: 'nine-patch', paint: ['parchment', 'brick', 'parchment', 'brick', 'butter', 'brick', 'parchment', 'brick', 'parchment'].map((f, i) => (i % 2 === 0 ? 'brick' : 'parchment')).map((f, i) => (i === 4 ? 'brick' : f)) },
  { type: 'pinwheel', paint: ['indigo', 'ivory', 'indigo', 'ivory', 'indigo', 'ivory', 'indigo', 'ivory'] },
  { type: 'ohio-star', paint: ['ivory', 'ivory', 'ivory', 'ivory', 'mustard', ...[0, 1, 2, 3].flatMap(() => ['denim', 'ivory', 'ivory', 'denim'])] },
];

export const newDesign = (ch) => (ch.kind === 'block' ? { paint: blockOf(ch.block).patches.map(() => '') } : emptyQuilt(ch.cols));

// ---- hint planner: the steps still needed to reach the solution ---------------------------------------------------------------------
export function plan(ch, d) {
  const steps = [];
  if (!ch.sol) return steps;
  if (ch.kind === 'block') {
    const block = blockOf(ch.block);
    const order = block.patches.map((p, i) => i).sort((a, b) => block.patches[a].role - block.patches[b].role || a - b);
    for (const i of order) if (d.paint[i] !== ch.sol.paint[i]) steps.push({ op: 'paint', i, f: ch.sol.paint[i], role: block.patches[i].role });
    return steps;
  }
  ch.sol.cells.forEach((c, i) => { if (d.cells[i].t !== c.t || d.cells[i].r !== c.r) steps.push({ op: 'cell', i, t: c.t, r: c.r }); });
  if (d.sashW !== ch.sol.sashW) steps.push({ op: 'sashw', w: ch.sol.sashW });
  if (d.sashF !== ch.sol.sashF) steps.push({ op: 'sashf', f: ch.sol.sashF });
  if (d.bordW !== ch.sol.bordW) steps.push({ op: 'bordw', w: ch.sol.bordW });
  if (d.bordF !== ch.sol.bordF) steps.push({ op: 'bordf', f: ch.sol.bordF });
  return steps;
}
export function applyStep(ch, d, s) {
  if (s.op === 'paint') d.paint[s.i] = s.f;
  else if (s.op === 'cell') d.cells[s.i] = { t: s.t, r: s.r };
  else if (s.op === 'sashw') d.sashW = s.w;
  else if (s.op === 'sashf') d.sashF = s.f;
  else if (s.op === 'bordw') d.bordW = s.w;
  else if (s.op === 'bordf') d.bordF = s.f;
}
const printWord = { solid: 'solid', dot: 'pin-dot', stripe: 'striped', gingham: 'gingham', ditsy: 'little-flower', plaid: 'plaid', lattice: 'lattice' };
const describe = (f) => `${fab(f).name} (${BAND_NAME[fab(f).band]}, ${fab(f).busy ? 'busy' : 'quiet'})`;
// -> { look, why, patches: [indices], cell }
export function explain(ch, step) {
  if (ch.kind === 'block') {
    const block = blockOf(ch.block), role = step.role, rn = block.roles[role].toLowerCase(), sol = ch.sol.paint, f = step.f, fa = fab(f);
    const sibs = block.byRole[role];
    if (ch.mode === 'copy') return { look: `Look at the ${rn} in the sample. Which cloth is it?`, why: `The sample uses ${describe(f)} for the ${rn}. Copy it onto this piece.`, patches: [step.i] };
    const bits = [`${describe(f)} for the ${rn}.`];
    for (const c of ch.cons) {
      if ((c.k === 'contrast' || c.k === 'darker') && (c.a === role || c.b === role)) {
        const other = c.a === role ? c.b : c.a, ofa = sol[block.byRole[other][0]];
        bits.push(c.k === 'contrast' ? `Against the ${block.roles[other].toLowerCase()} in ${fab(ofa).name} it is ${pct(Math.abs(fa.lum - fab(ofa).lum))} apart in value, which meets the contrast rule.` : `It is ${c.a === role ? 'darker' : 'lighter'} than the ${block.roles[other].toLowerCase()}, as the rule asks.`);
        break;
      }
    }
    if (bits.length === 1) {
      const c = ch.cons.find((x) => x.k === 'quiet' || x.k === 'feature' || x.k === 'values' || x.k === 'maxf' || x.k === 'minf' || x.k === 'balance');
      if (c?.k === 'quiet') bits.push(fa.busy ? 'This print is busy, so it is kept away from other busy prints.' : 'A quiet print gives the eye somewhere to rest beside busy ones.');
      else if (c?.k === 'feature') bits.push(`${fa.name} is the feature fabric the brief wants repeated.`);
      else if (c?.k === 'values') bits.push(`It supplies the ${BAND_NAME[fa.band]} value the block needs.`);
      else if (c?.k === 'balance') bits.push('Placing it here keeps the dark weight near the middle of the block.');
      else bits.push('It keeps within the number of fabrics the brief allows.');
    }
    return { look: `Look at the ${rn}. Check the rules above: which one is not yet met?`, why: bits.join(' '), patches: sibs.length > 1 ? [step.i] : [step.i] };
  }
  if (step.op === 'cell') return { look: `Look at the ${(step.i % ch.cols) + 1}${['st', 'nd', 'rd'][step.i % ch.cols] ?? 'th'} block of row ${Math.floor(step.i / ch.cols) + 1}. Which block belongs here?`, why: `${blockOf(ch.tiles[step.t].type).name}, turned ${step.r ? step.r + ' quarter' + (step.r > 1 ? 's' : '') : 'upright'}. ${ch.mode === 'copy' ? 'That is what the sample shows.' : 'It helps the rules: it keeps touching blocks different and the dark weight spread.'}`, cell: step.i };
  if (step.op === 'sashw') return { look: 'Look at the gaps between the blocks.', why: `${SASH_NAME[step.w]} sashing frames each block so it can be seen on its own.`, cell: -1 };
  if (step.op === 'sashf') return { look: 'Choose the sashing cloth.', why: `${describe(step.f)}: ${ch.mode === 'copy' ? 'as in the sample.' : 'far enough from the blocks in value that each block stands out.'}`, cell: -1 };
  if (step.op === 'bordw') return { look: 'Look at the edge of the quilt.', why: `A ${SASH_NAME[step.w].toLowerCase()} border finishes the top like a mat finishes a picture.`, cell: -1 };
  return { look: 'Choose the border cloth.', why: `${describe(step.f)}: ${ch.mode === 'copy' ? 'as in the sample.' : 'it frames the blocks, and echoes a cloth used inside them.'}`, cell: -1 };
}
export function starsFor(ch, S) {
  const par = Math.max(1, ch.par || 1), mv = S.moves, h = S.hints;
  if (h === 0 && mv <= par * 1.6) return 3;
  if (h <= 2 && mv <= par * 3) return 2;
  return 1;
}
export { evaluate, FABRICS };
