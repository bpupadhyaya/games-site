// Tatami engine: pure and deterministic. A room is a set of grid cells; the player covers every cell with full mats (2 x 1)
// and half mats (1 x 1) from a fixed supply, so that no point of the floor is touched by the corners of four different mats.
// Cells are indexed r * w + c. A tile is { a, b } with a <= b; a full mat has b = a + 1 (lying) or a + w (standing); a half mat has b = a.
export const KIND = { FULL: 'full', HALF: 'half' };
export const NAMES = { lying: 'lying', standing: 'standing' };

// ---- puzzle strings ---------------------------------------------------------------------------------------------------------------
// "w h room F H givens" : room is w*h chars of 0/1 in reading order, givens is "a:b,a:a,..." (or "-" when there are none).
export function parsePuzzle(str) {
  const [w, h, room, F, H, g] = str.trim().split(/\s+/);
  const W = Number(w), Hh = Number(h);
  const givens = g === '-' ? [] : g.split(',').map((t) => { const [a, b] = t.split(':').map(Number); return { a, b }; });
  return { w: W, h: Hh, room: Array.from(room, (c) => (c === '1' ? 1 : 0)), full: Number(F), half: Number(H), givens };
}
export function puzzleToStr(p) {
  return [p.w, p.h, p.room.join(''), p.full, p.half, p.givens.length ? p.givens.map((t) => `${t.a}:${t.b}`).join(',') : '-'].join(' ');
}

// 8 symmetries of the grid (0..7): bit0 flip horizontally, bit1 flip vertically, bit2 transpose.
export function transformPuzzle(p, sym) {
  let { w, h } = p;
  const map = (r, c) => {
    if (sym & 1) c = w - 1 - c;
    if (sym & 2) r = h - 1 - r;
    return [r, c];
  };
  const ow = w, oh = h, tr = !!(sym & 4);
  const nw = tr ? oh : ow, nh = tr ? ow : oh;
  const idx = new Array(ow * oh);
  for (let r = 0; r < oh; r++) for (let c = 0; c < ow; c++) {
    let [r2, c2] = map(r, c);
    if (tr) [r2, c2] = [c2, r2];
    idx[r * ow + c] = r2 * nw + c2;
  }
  const room = new Array(nw * nh).fill(0);
  p.room.forEach((v, i) => { room[idx[i]] = v; });
  const givens = p.givens.map((t) => { const x = idx[t.a], y = idx[t.b]; return { a: Math.min(x, y), b: Math.max(x, y) }; });
  return { w: nw, h: nh, room, full: p.full, half: p.half, givens };
}

// ---- board -------------------------------------------------------------------------------------------------------------------------
export function newBoard(p) {
  const B = { w: p.w, h: p.h, n: p.w * p.h, room: Uint8Array.from(p.room), cov: new Int16Array(p.w * p.h).fill(-1), tiles: [], supply: { full: p.full, half: p.half } };
  for (const t of p.givens) placeTile(B, t.a, t.b, true);
  return B;
}
export const cloneBoard = (B) => ({ w: B.w, h: B.h, n: B.n, room: B.room, cov: Int16Array.from(B.cov), tiles: B.tiles.slice(), supply: { ...B.supply } });
export const isFull = (t) => t.b !== t.a;
export const kindOf = (t) => (t.b === t.a ? KIND.HALF : KIND.FULL);
export const orientOf = (B, t) => (t.b === t.a ? 'half' : t.b === t.a + 1 ? 'lying' : 'standing');
export const rowOf = (B, i) => Math.floor(i / B.w);
export const colOf = (B, i) => i % B.w;
export const cellName = (B, i) => `${String.fromCharCode(65 + Math.floor(i / B.w))}${(i % B.w) + 1}`;
export const area = (B) => { let n = 0; for (let i = 0; i < B.n; i++) n += B.room[i]; return n; };
export const uncovered = (B) => { let n = 0; for (let i = 0; i < B.n; i++) if (B.room[i] && B.cov[i] < 0) n++; return n; };
export const supplyLeft = (B) => {
  let f = B.supply.full, h = B.supply.half;
  for (const t of B.tiles) if (t) { if (isFull(t)) f--; else h--; }
  return { full: f, half: h };
};
// Can a tile {a, b} be put down right now (geometry only, not the corner rule, not the supply)?
export function fits(B, a, b) {
  if (a < 0 || b < 0 || a >= B.n || b >= B.n) return false;
  if (!B.room[a] || !B.room[b] || B.cov[a] >= 0 || B.cov[b] >= 0) return false;
  if (a === b) return true;
  const d = b - a;
  if (d === 1) return Math.floor(a / B.w) === Math.floor(b / B.w);
  return d === B.w;
}
function compact(B) {   // renumber the mats so cover ids never run out of range in a very long session
  const live = B.tiles.filter(Boolean);
  B.tiles = live.map((t, i) => ({ ...t, id: i }));
  B.cov.fill(-1);
  for (const t of B.tiles) { B.cov[t.a] = t.id; B.cov[t.b] = t.id; }
}
export function placeTile(B, a, b, given = false) {
  if (B.tiles.length > 20000) compact(B);
  const id = B.tiles.length;
  B.tiles.push({ a, b, id, given });
  B.cov[a] = id; B.cov[b] = id;
  return id;
}
export function removeTile(B, id) {
  const t = B.tiles[id];
  if (!t) return null;
  B.cov[t.a] = -1; B.cov[t.b] = -1; B.tiles[id] = null;
  return t;
}
export const tileAt = (B, cell) => (B.cov[cell] >= 0 ? B.tiles[B.cov[cell]] : null);

// ---- the corner rule ------------------------------------------------------------------------------------------------------------
// A floor point (vr, vc) with 1 <= vr < h and 1 <= vc < w touches cells (vr-1,vc-1) (vr-1,vc) (vr,vc-1) (vr,vc).
// It is a four-corner point when all four are covered by four DIFFERENT mats.
function vertexBad(B, vr, vc) {
  if (vr < 1 || vc < 1 || vr >= B.h || vc >= B.w) return false;
  const a = (vr - 1) * B.w + vc - 1, b = a + 1, c = a + B.w, d = c + 1;
  const A = B.cov[a], Bb = B.cov[b], C = B.cov[c], D = B.cov[d];
  if (A < 0 || Bb < 0 || C < 0 || D < 0) return false;
  return A !== Bb && A !== C && A !== D && Bb !== C && Bb !== D && C !== D;
}
export function badVertices(B) {
  const out = [];
  for (let vr = 1; vr < B.h; vr++) for (let vc = 1; vc < B.w; vc++) if (vertexBad(B, vr, vc)) out.push({ r: vr, c: vc });
  return out;
}
// Vertices that putting {a, b} down WOULD make bad (checked on a scratch cover id, board unchanged afterwards).
export function vertexConflicts(B, a, b) {
  const id = 30000;
  const sa = B.cov[a], sb = B.cov[b];
  B.cov[a] = id; B.cov[b] = id;
  const out = [], seen = new Set();
  for (const cell of a === b ? [a] : [a, b]) {
    const r = Math.floor(cell / B.w), c = cell % B.w;
    for (const [vr, vc] of [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]]) {
      const k = vr * (B.w + 1) + vc;
      if (!seen.has(k) && vertexBad(B, vr, vc)) { seen.add(k); out.push({ r: vr, c: vc }); }
    }
  }
  B.cov[a] = sa; B.cov[b] = sb;
  return out;
}
export const isSolved = (B) => uncovered(B) === 0 && badVertices(B).length === 0;

// ---- solver ----------------------------------------------------------------------------------------------------------------------------
// Backtracking over the first uncovered cell in reading order; its left and upper neighbours are already settled, so a mat
// can only extend right or down. `rnd` (optional, () => 0..1) shuffles the order of options for generation.
export function solve(B, { limit = 1, maxNodes = 4e6, rnd = null, maxHalf = Infinity } = {}) {
  const cov = Int16Array.from(B.cov), n = B.n, w = B.w, h = B.h, room = B.room;
  let nextId = Math.max(0, ...B.tiles.map((t) => (t ? t.id + 1 : 0)));
  const left = supplyLeft(B);
  let sf = left.full, sh = left.half;
  const sols = [], placed = [];
  let nodes = 0, aborted = false;
  const bad = (vr, vc) => {
    if (vr < 1 || vc < 1 || vr >= h || vc >= w) return false;
    const a = (vr - 1) * w + vc - 1, A = cov[a], Bb = cov[a + 1], C = cov[a + w], D = cov[a + w + 1];
    if (A < 0 || Bb < 0 || C < 0 || D < 0) return false;
    return A !== Bb && A !== C && A !== D && Bb !== C && Bb !== D && C !== D;
  };
  const badAround = (cell) => {
    const r = Math.floor(cell / w), c = cell % w;
    return bad(r, c) || bad(r, c + 1) || bad(r + 1, c) || bad(r + 1, c + 1);
  };
  const stranded = (cell) => {   // an uncovered cell with no free neighbour can only take a half mat
    const r = Math.floor(cell / w), c = cell % w;
    return !((c > 0 && room[cell - 1] && cov[cell - 1] < 0) || (c < w - 1 && room[cell + 1] && cov[cell + 1] < 0) || (r > 0 && room[cell - w] && cov[cell - w] < 0) || (r < h - 1 && room[cell + w] && cov[cell + w] < 0));
  };
  const free = (i) => i >= 0 && i < n && room[i] && cov[i] < 0;
  let start = 0;
  const rec = (from) => {
    if (aborted) return;
    let i = from;
    while (i < n && !(room[i] && cov[i] < 0)) i++;
    if (i >= n) { sols.push(placed.slice()); return; }
    if (++nodes > maxNodes) { aborted = true; return; }
    const r = Math.floor(i / w), c = i % w;
    const opts = [];
    if (sf > 0 && c < w - 1 && free(i + 1)) opts.push([i, i + 1]);
    if (sf > 0 && r < h - 1 && free(i + w)) opts.push([i, i + w]);
    if (sh > 0) opts.push([i, i]);
    if (rnd) for (let k = opts.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [opts[k], opts[j]] = [opts[j], opts[k]]; }
    for (const [a, b] of opts) {
      const full = a !== b;
      if (!full && maxHalf !== Infinity && (left.half - sh) >= maxHalf) continue;
      const id = nextId++;
      cov[a] = id; cov[b] = id;
      if (full) sf--; else sh--;
      let ok = !(badAround(a) || (full && badAround(b)));
      if (ok && sh === 0) {   // without half mats left, a cell cut off from every neighbour can never be covered
        const around = full ? [a - 1, a + 1, a - w, a + w, b - 1, b + 1, b - w, b + w] : [a - 1, a + 1, a - w, a + w];
        for (const k of around) if (k >= 0 && k < n && free(k) && stranded(k)) { ok = false; break; }
      }
      if (ok) { placed.push([a, b]); rec(i + 1); placed.pop(); }
      cov[a] = -1; cov[b] = -1; nextId--;
      if (full) sf++; else sh++;
      if (sols.length >= limit || aborted) return;
    }
  };
  rec(start);
  return { solutions: sols, aborted, nodes };
}
export const countSolutions = (B, limit = 2) => solve(B, { limit }).solutions.length;

// ---- reading a position (hints, Watch and Learn) ---------------------------------------------------------------------------------------
const dirText = { right: 'a lying mat to the right', down: 'a standing mat going down', half: 'a half mat' };
// Options for covering `cell` (the first free cell of its area: its left and upper neighbours may be free too; all four directions allowed here).
export function cellOptions(B, cell) {
  const w = B.w, r = Math.floor(cell / w), c = cell % w, left = supplyLeft(B), out = [];
  const add = (kind, a, b, label, why) => out.push({ kind, a: Math.min(a, b), b: Math.max(a, b), label, ...why });
  const tries = [
    ['right', c < w - 1, cell + 1, 'lying mat covering the next square to the right'],
    ['left', c > 0, cell - 1, 'lying mat covering the square to the left'],
    ['down', r < B.h - 1, cell + w, 'standing mat covering the square below'],
    ['up', r > 0, cell - w, 'standing mat covering the square above'],
  ];
  for (const [dir, inGrid, other, label] of tries) {
    const o = { dir, label, a: Math.min(cell, other), b: Math.max(cell, other), full: true, ok: false, reason: '' };
    if (!inGrid || !B.room[other]) o.reason = 'wall';
    else if (B.cov[other] >= 0) o.reason = 'taken';
    else if (left.full <= 0) o.reason = 'nofull';
    else {
      const v = vertexConflicts(B, o.a, o.b);
      if (v.length) { o.reason = 'corner'; o.vertex = v[0]; } else o.ok = true;
    }
    if (inGrid && B.room[other] && B.cov[other] < 0) o.other = other;
    out.push(o);
  }
  const half = { dir: 'half', label: 'half mat', a: cell, b: cell, full: false, ok: false, reason: '' };
  if (left.half <= 0) half.reason = 'nohalf';
  else { const v = vertexConflicts(B, cell, cell); if (v.length) { half.reason = 'corner'; half.vertex = v[0]; } else half.ok = true; }
  out.push(half);
  return out;
}

function sameTile(t, a, b) { return t.a === a && t.b === b; }
// Where a placed (non-given) mat disagrees with the one solution of the puzzle.
export function mistakes(B, sol) {
  const bad = [];
  for (const t of B.tiles) if (t && !t.given && !sol.some(([a, b]) => sameTile(t, a, b))) bad.push(t);
  return bad;
}

// Why a rule-legal option still fails: put it down, then see what the room can no longer do.
function deadEndReason(B, a, b) {
  const T = cloneBoard(B);
  placeTile(T, a, b, false);
  const left = supplyLeft(T);
  const w = B.w;
  for (let i = 0; i < T.n; i++) {
    if (!T.room[i] || T.cov[i] >= 0) continue;
    const r = Math.floor(i / w), c = i % w;
    const nb = [c > 0 && T.room[i - 1] && T.cov[i - 1] < 0, c < w - 1 && T.room[i + 1] && T.cov[i + 1] < 0, r > 0 && T.room[i - w] && T.cov[i - w] < 0, r < T.h - 1 && T.room[i + w] && T.cov[i + w] < 0];
    if (!nb.some(Boolean) && left.half <= 0) return { kind: 'stranded', cell: i };
  }
  return { kind: 'search' };
}

// The next teaching step for this position, or null when it is finished. `sol` = the puzzle's one solution as [[a,b],...].
export function nextStep(B, sol) {
  const wrong = mistakes(B, sol);
  if (wrong.length) return { type: 'mistake', tile: wrong[0], cell: wrong[0].a };
  let best = null;
  for (let cell = 0; cell < B.n; cell++) {
    if (!B.room[cell] || B.cov[cell] >= 0) continue;
    const opts = cellOptions(B, cell).filter((o) => o.reason !== 'wall');
    const legal = opts.filter((o) => o.ok);
    const key = legal.length * 1000 + cell;
    if (!best || key < best.key) best = { key, cell, opts, legal };
  }
  if (!best) return null;
  const want = sol.find(([a, b]) => (a === best.cell || b === best.cell) && B.cov[a] < 0 && B.cov[b] < 0);
  if (!want) return null;
  const [wa, wb] = want;
  const options = best.opts.map((o) => {
    const isAnswer = o.ok && o.a === wa && o.b === wb;
    const out = { ...o, answer: isAnswer };
    if (o.ok && !isAnswer) out.dead = deadEndReason(B, o.a, o.b);
    return out;
  });
  const answer = options.find((o) => o.answer) ?? null;
  if (!answer) return null;
  const only = best.legal.length === 1;
  return { type: 'place', cell: best.cell, a: wa, b: wb, options, answer, technique: only ? 'only-fit' : 'look-ahead', legalCount: best.legal.length };
}

// ---- words for the teaching text ----------------------------------------------------------------------------------------------------------------
export function nameOption(o) { return o.dir === 'half' ? 'a half mat' : (o.dir === 'left' || o.dir === 'right') ? 'a lying mat' : 'a standing mat'; }
export function look(B, step) {
  const nm = cellName(B, step.cell);
  if (step.type === 'mistake') return `Look at the mat on ${cellName(B, step.tile.a)}${step.tile.b !== step.tile.a ? ' and ' + cellName(B, step.tile.b) : ''}. Something about it will not fit the finished room.`;
  return `Look at square ${nm}. Which mat can cover it? Try each direction in turn and check the corners.`;
}
export function why(B, step) {
  const nm = cellName(B, step.cell);
  if (step.type === 'mistake') {
    return 'That mat is not part of the only way to tile this room. Tap Fix it to pick it up, then look at the squares around it again.';
  }
  const SIDE = { right: 'to the right', left: 'to the left', down: 'below', up: 'above' };
  const list = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const parts = [];
  const blocked = step.options.filter((o) => o.dir !== 'half' && (o.reason === 'taken' || o.reason === 'wall')).map((o) => SIDE[o.dir]);
  if (blocked.length) parts.push(`The square${blocked.length > 1 ? 's' : ''} ${list(blocked)} of ${nm} ${blocked.length > 1 ? 'are' : 'is'} already covered or walled off.`);
  const nofull = step.options.some((o) => o.dir !== 'half' && o.reason === 'nofull');
  if (nofull) parts.push('Every full mat is already down.');
  for (const o of step.options) {
    if (o.answer || o.dir === 'half' && o.reason === 'nohalf') continue;
    const what = o.dir === 'half' ? 'A half mat' : `A mat reaching ${SIDE[o.dir]}`;
    if (o.reason === 'corner') parts.push(`${what} would put four corners together at the red point.`);
    else if (o.ok) {
      if (o.dead?.kind === 'stranded') parts.push(`${what} looks fine, but it would strand ${cellName(B, o.dead.cell)}: no mat could ever reach that square.`);
      else parts.push(`${what} looks fine, but checking ahead shows the rest of the room could not be finished.`);
    }
  }
  if (step.options.some((o) => o.dir === 'half' && o.reason === 'nohalf')) parts.push('No half mats are left.');
  const ans = step.answer;
  const end = ans.dir === 'half' ? `So ${nm} takes a half mat.` : `So ${nm} takes the ${ans.dir === 'left' || ans.dir === 'right' ? 'lying' : 'standing'} mat from ${cellName(B, ans.a)} to ${cellName(B, ans.b)}.`;
  const head = step.technique === 'only-fit' ? `Only one mat fits ${nm}.` : `More than one mat seems to fit ${nm}.`;
  return `${head} ${parts.join(' ')} ${end}`.replace(/\s+/g, ' ').trim();
}
export const TECH_NAME = (t) => ({ 'only-fit': 'Only one fit', 'look-ahead': 'Look ahead', mistake: 'Fix a mat' }[t] ?? t);
