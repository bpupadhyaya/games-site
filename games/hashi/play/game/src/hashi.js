// Hashi engine: puzzle model, counting solver (proves one solution), human solver with named techniques, grading and symmetries.
// Pure and deterministic (no clock, no random). Puzzles are strings: "7x7:..3.2../.1...../..." (rows split by "/", "." empty, 1-8 an island).
//
// A puzzle P is immutable: islands, the candidate lanes (edges) between line-of-sight neighbours and which lanes cross.
// A position is { br, cap }: bridges placed per lane (0..2) and a stored upper limit per lane (2 unless a hint proved less).

export const TECH_ORDER = ['forced', 'must', 'noloop', 'whatif'];
const NAMES = { forced: 'Full House', must: 'Must Reach', noloop: 'No Cut-Off', whatif: 'What If' };
export const TECH_NAME = (id) => NAMES[id] ?? id;

// ---- parsing and building ---------------------------------------------------------------------------------------------------
export function parse(str) {
  const m = /^(\d+)x(\d+):(.*)$/.exec(str);
  const w = Number(m[1]), h = Number(m[2]), rows = m[3].split('/');
  return { w, h, rows };
}
export function stringify(w, h, grid) {
  const rows = [];
  for (let y = 0; y < h; y++) { let r = ''; for (let x = 0; x < w; x++) r += grid[y * w + x] ? String(grid[y * w + x]) : '.'; rows.push(r); }
  return `${w}x${h}:${rows.join('/')}`;
}
export function gridOf(str) {
  const { w, h, rows } = parse(str), g = new Array(w * h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = (rows[y] ?? '')[x] ?? '.'; g[y * w + x] = c === '.' ? 0 : Number(c); }
  return { w, h, g };
}

const cache = new Map();
export function build(str) {
  let P = cache.get(str);
  if (P) return P;
  const { w, h, g } = gridOf(str), isl = [], at = new Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y * w + x]) { at[y * w + x] = isl.length; isl.push({ x, y, n: g[y * w + x] }); }
  const ea = [], eb = [], eh = [];
  for (let i = 0; i < isl.length; i++) {
    const { x, y } = isl[i];
    for (let xx = x + 1; xx < w; xx++) if (at[y * w + xx] >= 0) { ea.push(i); eb.push(at[y * w + xx]); eh.push(true); break; }
    for (let yy = y + 1; yy < h; yy++) if (at[yy * w + x] >= 0) { ea.push(i); eb.push(at[yy * w + x]); eh.push(false); break; }
  }
  const E = ea.length, inc = isl.map(() => []), cross = Array.from({ length: E }, () => []);
  for (let e = 0; e < E; e++) { inc[ea[e]].push(e); inc[eb[e]].push(e); }
  for (let e = 0; e < E; e++) {
    if (!eh[e]) continue;
    const a = isl[ea[e]], b = isl[eb[e]];
    for (let f = 0; f < E; f++) {
      if (eh[f]) continue;
      const c = isl[ea[f]], d = isl[eb[f]];
      if (c.x > a.x && c.x < b.x && a.y > c.y && a.y < d.y) { cross[e].push(f); cross[f].push(e); }
    }
  }
  P = { str, w, h, n: isl.length, isl, at, E, ea, eb, eh, inc, cross, total: isl.reduce((s, i) => s + i.n, 0) / 2 };
  if (cache.size > 200) cache.clear();
  cache.set(str, P);
  return P;
}
export const other = (P, e, i) => (P.ea[e] === i ? P.eb[e] : P.ea[e]);
export const edgeBetween = (P, a, b) => { for (const e of P.inc[a]) if (other(P, e, a) === b) return e; return -1; };
export const rcName = (P, i) => `row ${P.isl[i].y + 1}, column ${P.isl[i].x + 1}`;
export const newState = (P) => ({ br: new Array(P.E).fill(0), cap: new Array(P.E).fill(2) });
export const cloneState = (st) => ({ br: st.br.slice(), cap: st.cap.slice() });

// ---- position queries -----------------------------------------------------------------------------------------------------------
export function remAll(P, br) {
  const r = P.isl.map((i) => i.n);
  for (let e = 0; e < P.E; e++) if (br[e]) { r[P.ea[e]] -= br[e]; r[P.eb[e]] -= br[e]; }
  return r;
}
export const crossedBy = (P, br, e) => { for (const c of P.cross[e]) if (br[c] > 0) return c; return -1; };
function maxAdd(P, st, e, rem) {
  const room = st.cap[e] - st.br[e];
  if (room <= 0) return 0;
  if (crossedBy(P, st.br, e) >= 0) return 0;
  return Math.max(0, Math.min(room, rem[P.ea[e]], rem[P.eb[e]]));
}
// How many more bridges this lane can take right now (crossings, limits and the islands' remaining bridges considered).
export const maxAddAt = (P, st, e) => maxAdd(P, st, e, remAll(P, st.br));
export function comps(P, br, rem = remAll(P, br)) {
  const par = Array.from({ length: P.n }, (_, i) => i);
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let e = 0; e < P.E; e++) if (br[e] > 0) par[find(P.ea[e])] = find(P.eb[e]);
  const id = new Array(P.n), size = new Array(P.n).fill(0), rsum = new Array(P.n).fill(0);
  for (let i = 0; i < P.n; i++) { const r = find(i); id[i] = r; size[r] += 1; rsum[r] += rem[i]; }
  return { id, size, rsum };
}
export function isSolved(P, br) {
  const rem = remAll(P, br);
  for (const r of rem) if (r !== 0) return false;
  return comps(P, br, rem).size[comps(P, br, rem).id[0]] === P.n;
}
export const bridgeCount = (br) => br.reduce((s, v) => s + v, 0);
// Islands that have exactly their number (or too many).
export const islandStatus = (P, br, i) => { const r = P.isl[i].n - P.inc[i].reduce((s, e) => s + br[e], 0); return r === 0 ? 'full' : r < 0 ? 'over' : 'open'; };

// ---- contradiction ------------------------------------------------------------------------------------------------------------------
function contradiction(P, st, rem = remAll(P, st.br)) {
  for (let i = 0; i < P.n; i++) {
    if (rem[i] < 0) return { kind: 'over', island: i };
    if (rem[i] > 0) {
      let tot = 0;
      for (const e of P.inc[i]) tot += maxAdd(P, st, e, rem);
      if (tot < rem[i]) return { kind: 'short', island: i };
    }
  }
  const c = comps(P, st.br, rem);
  for (let i = 0; i < P.n; i++) if (c.id[i] === i && c.rsum[i] === 0 && c.size[i] < P.n) return { kind: 'loop', island: i, size: c.size[i] };
  return null;
}

// ---- the techniques ------------------------------------------------------------------------------------------------------------------
// forced : an island's open lanes can carry exactly the bridges it still needs, so every lane is filled to its limit.
// must   : the other lanes cannot carry all it needs, so this lane must carry at least some.
// noloop : a bridge here would use up a group of islands and cut them off from the rest.
// whatif : assume one lane is empty (or has a bridge); the simple rules then break something, so the assumption is false.
function stepForced(P, st, rem) {
  for (let i = 0; i < P.n; i++) {
    if (rem[i] <= 0) continue;
    const adds = P.inc[i].map((e) => maxAdd(P, st, e, rem)), tot = adds.reduce((s, v) => s + v, 0);
    if (tot === rem[i] && tot > 0) return { tech: 'forced', island: i, place: P.inc[i].map((e, k) => ({ e, to: st.br[e] + adds[k] })).filter((p, k) => adds[k] > 0) };
  }
  return null;
}
function stepMust(P, st, rem) {
  for (let i = 0; i < P.n; i++) {
    if (rem[i] <= 0) continue;
    const adds = P.inc[i].map((e) => maxAdd(P, st, e, rem)), tot = adds.reduce((s, v) => s + v, 0), place = [];
    adds.forEach((a, k) => { const need = rem[i] - (tot - a); if (need > 0 && a > 0) place.push({ e: P.inc[i][k], to: st.br[P.inc[i][k]] + need, need }); });
    if (place.length) return { tech: 'must', island: i, rem: rem[i], reach: tot, place };
  }
  return null;
}
function stepNoLoop(P, st, rem) {
  const c = comps(P, st.br, rem);
  for (let e = 0; e < P.E; e++) {
    const m = maxAdd(P, st, e, rem);
    if (!m) continue;
    const a = P.ea[e], b = P.eb[e], ca = c.id[a], cb = c.id[b];
    for (let k = 1; k <= m; k++) {
      const sum = (ca === cb ? c.rsum[ca] : c.rsum[ca] + c.rsum[cb]) - 2 * k, size = ca === cb ? c.size[ca] : c.size[ca] + c.size[cb];
      if (sum === 0 && size < P.n) return { tech: 'noloop', edge: e, cap: { e, to: st.br[e] + k - 1 }, size, k, same: ca === cb };
    }
  }
  return null;
}
export function applyStep(P, st, step) {
  if (step.place) for (const p of step.place) st.br[p.e] = p.to;
  if (step.cap) st.cap[step.cap.e] = step.cap.to;
  return st;
}
function simpleStep(P, st, rem) { return stepForced(P, st, rem) ?? stepMust(P, st, rem) ?? stepNoLoop(P, st, rem); }

// Apply the simple techniques until nothing more happens or something breaks. Returns the contradiction found, if any.
function propagate(P, st) {
  for (let guard = 0; guard < 400; guard++) {
    const rem = remAll(P, st.br), bad = contradiction(P, st, rem);
    if (bad) return bad;
    const s = simpleStep(P, st, rem);
    if (!s) return null;
    applyStep(P, st, s);
  }
  return null;
}

function stepWhatIf(P, st, rem) {
  for (let e = 0; e < P.E; e++) {
    const m = maxAdd(P, st, e, rem);
    if (!m) continue;
    const t = cloneState(st); t.cap[e] = t.br[e];
    const bad = propagate(P, t);
    if (bad) return { tech: 'whatif', edge: e, assume: 'empty', place: [{ e, to: st.br[e] + 1 }], bad };
  }
  for (let e = 0; e < P.E; e++) {
    const m = maxAdd(P, st, e, rem);
    if (!m) continue;
    const t = cloneState(st); t.br[e] += 1;
    const bad = propagate(P, t);
    if (bad) return { tech: 'whatif', edge: e, assume: 'bridge', cap: { e, to: st.br[e] }, bad };
  }
  return null;
}

// The simplest next logical step from this position, or null when the position is solved / the techniques run out.
export function nextStep(P, st) {
  const rem = remAll(P, st.br);
  if (contradiction(P, st, rem)) return null;
  return simpleStep(P, st, rem) ?? stepWhatIf(P, st, rem);
}

// ---- counting solver (proves uniqueness) ---------------------------------------------------------------------------------------
export function countSolutions(P, limit = 2, startSt = null) {
  let count = 0, first = null, nodes = 0;
  const dfs = (st) => {
    if (count >= limit || nodes > 200000) return;
    nodes += 1;
    if (propagate(P, st)) return;
    const rem = remAll(P, st.br);
    let best = -1, bestM = 0;
    for (let e = 0; e < P.E; e++) { const m = maxAdd(P, st, e, rem); if (m > bestM || (m && best < 0)) { best = e; bestM = m; } }
    if (best < 0) {
      if (rem.every((r) => r === 0) && isSolved(P, st.br)) { count += 1; if (!first) first = st.br.slice(); }
      return;
    }
    for (let k = bestM; k >= 0; k--) {
      const t = cloneState(st); t.br[best] += k; t.cap[best] = t.br[best];
      dfs(t);
      if (count >= limit) return;
    }
  };
  dfs(startSt ? cloneState(startSt) : newState(P));
  return { count, solution: first };
}
export function solve(P) { return countSolutions(P, 1).solution; }

// Solve the way a person would. Returns the grade (1 Easy .. 5 Master), technique counts and whether the techniques sufficed.
export function humanSolve(P) {
  const st = newState(P), counts = {};
  for (let guard = 0; guard < 600; guard++) {
    if (isSolved(P, st.br)) break;
    const s = nextStep(P, st);
    if (!s) return { solved: false, level: 0, counts };
    counts[s.tech] = (counts[s.tech] ?? 0) + 1;
    applyStep(P, st, s);
  }
  const solved = isSolved(P, st.br);
  return { solved, counts, level: solved ? gradeFrom(counts) : 0 };
}
export function gradeFrom(c) {
  if ((c.whatif ?? 0) >= 3) return 5;
  if ((c.whatif ?? 0) >= 1) return 4;
  if ((c.noloop ?? 0) >= 1) return 3;
  if ((c.must ?? 0) >= 1) return 2;
  return 1;
}
export const gradeOf = (P) => humanSolve(P);

// ---- explanations (hint card and Watch and Learn) -----------------------------------------------------------------------------
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const lane = (P, e) => `${P.isl[P.ea[e]].n} at ${rcName(P, P.ea[e])} and the ${P.isl[P.eb[e]].n} at ${rcName(P, P.eb[e])}`;
export function explain(P, st, step) {
  const rem = remAll(P, st.br), show = { focus: [], lanes: [] };
  if (step.tech === 'forced') {
    const i = step.island, r = rem[i], n = step.place.length;
    show.focus = [i]; for (const p of step.place) show.lanes.push({ e: p.e, kind: 'place' });
    return { name: TECH_NAME('forced'), show,
      look: `Look at the ${P.isl[i].n} at ${rcName(P, i)}. It still needs ${plural(r, 'bridge')}. How many can its open lanes carry?`,
      why: `The ${P.isl[i].n} at ${rcName(P, i)} still needs ${plural(r, 'bridge')}, and its ${n === 1 ? 'only open lane' : plural(n, 'open lane')} can carry exactly ${r} between them. So ${n === 1 ? 'that lane takes' : 'every lane takes'} as many as it can.` };
  }
  if (step.tech === 'must') {
    const i = step.island, p0 = step.place[0], need = p0.need;
    show.focus = [i]; for (const p of step.place) show.lanes.push({ e: p.e, kind: 'place' });
    const others = step.place.length === 1 ? ` can carry at most ${rem[i] - need}` : ' could not carry enough';
    return { name: TECH_NAME('must'), show,
      look: `Look at the ${P.isl[i].n} at ${rcName(P, i)}. It still needs ${plural(rem[i], 'bridge')}. Could its other lanes carry all of them?`,
      why: `The ${P.isl[i].n} at ${rcName(P, i)} still needs ${plural(rem[i], 'bridge')}. Without ${step.place.length > 1 ? 'a bridge on each marked lane' : 'the marked lane'}, its other lanes${others}. So ${step.place.length > 1 ? 'each marked lane carries' : 'the marked lane carries'} at least ${plural(need, 'bridge')}.` };
  }
  if (step.tech === 'noloop') {
    const e = step.edge, a = P.ea[e], b = P.eb[e];
    show.focus = [a, b]; show.lanes.push({ e, kind: 'forbid' });
    const group = step.size > 2 ? `those ${step.size} islands` : step.same ? 'that group' : 'those two islands';
    return { name: TECH_NAME('noloop'), show,
      look: `Look at the ${lane(P, e)}. What would joining them do?`,
      why: `A ${step.k === 1 ? 'bridge' : plural(step.k, 'bridge')} here would use up every bridge that ${group} have left, and they would be cut off from the rest of the islands. Everything must stay connected, so this lane ${step.cap.to === 0 ? 'stays empty' : `carries at most ${plural(step.cap.to, 'bridge')}`}.` };
  }
  // whatif
  const e = step.edge, a = P.ea[e], b = P.eb[e], bad = step.bad;
  show.focus = [a, b]; show.lanes.push({ e, kind: step.assume === 'empty' ? 'place' : 'forbid' });
  const why = bad.kind === 'loop' ? 'a group of islands is cut off from the rest' : bad.kind === 'over' ? `the ${P.isl[bad.island].n} at ${rcName(P, bad.island)} ends up with too many bridges` : `the ${P.isl[bad.island].n} at ${rcName(P, bad.island)} can no longer reach its number`;
  return { name: TECH_NAME('whatif'), show,
    look: `Look at the lane between the ${lane(P, e)}. Try an experiment.`,
    why: step.assume === 'empty'
      ? `Suppose this lane between the ${lane(P, e)} stayed empty. Following only the simple rules from there, ${why}. So the assumption is wrong and the lane needs a bridge.`
      : `Suppose there were another bridge on this lane between the ${lane(P, e)}. Following only the simple rules from there, ${why}. So the assumption is wrong and the lane carries no more than ${step.cap.to}.` };
}

// ---- symmetries ------------------------------------------------------------------------------------------------------------------------
// t in 0..7: bit0 mirror left-right, bit1 mirror top-bottom, bit2 transpose. A puzzle's solution count and grade are preserved.
export function transform(str, t) {
  const { w, h, g } = gridOf(str);
  let W = w, H = h, G = g.slice();
  if (t & 4) { const T = new Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) T[x * H + y] = G[y * W + x]; G = T; [W, H] = [H, W]; }
  if (t & 1) for (let y = 0; y < H; y++) for (let x = 0; x < (W >> 1); x++) { const a = y * W + x, b = y * W + (W - 1 - x); [G[a], G[b]] = [G[b], G[a]]; }
  if (t & 2) for (let y = 0; y < (H >> 1); y++) for (let x = 0; x < W; x++) { const a = y * W + x, b = (H - 1 - y) * W + x; [G[a], G[b]] = [G[b], G[a]]; }
  return stringify(W, H, G);
}

// ---- generator (used offline to make the library; also callable at run time with env.rng) ------------------------------------------
// Grow a connected archipelago by walking bridges outwards, then add loop bridges, then read the numbers off.
export function layout(rng, w, h, islands, { loops = 0.5, doubles = 0.3 } = {}) {
  const occ = new Array(w * h).fill(0), isl = [], br = [];     // occ: 0 free, 1 island, 2 bridge cell
  const put = (x, y) => { occ[y * w + x] = 1; isl.push({ x, y }); return isl.length - 1; };
  const nearIsland = (x, y, ex, ey) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || (xx === ex && yy === ey)) continue;
      if (occ[yy * w + xx] === 1) return true;
    }
    return false;
  };
  put(rng.int(w), rng.int(h));
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let tries = 0; tries < islands * 60 && isl.length < islands; tries++) {
    const a = rng.int(isl.length), [dx, dy] = rng.pick(dirs), cells = [];
    let x = isl[a].x + dx, y = isl[a].y + dy;
    while (x >= 0 && y >= 0 && x < w && y < h && occ[y * w + x] === 0) { cells.push([x, y]); x += dx; y += dy; }
    if (cells.length < 2) continue;
    const len = 2 + rng.int(Math.min(cells.length - 1, 5));      // distance 2..6
    const [nx, ny] = cells[len - 1];
    if (nearIsland(nx, ny, cells[len - 2][0], cells[len - 2][1])) continue;
    const b = put(nx, ny);
    for (let k = 0; k < len - 1; k++) occ[cells[k][1] * w + cells[k][0]] = 2;
    br.push({ a, b, n: rng.chance(doubles) ? 2 : 1 });
  }
  // loop bridges between line-of-sight neighbours over free cells
  for (let a = 0; a < isl.length; a++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    let x = isl[a].x + dx, y = isl[a].y + dy, cells = [];
    while (x >= 0 && y >= 0 && x < w && y < h && occ[y * w + x] === 0) { cells.push([x, y]); x += dx; y += dy; }
    if (x < 0 || y < 0 || x >= w || y >= h || occ[y * w + x] !== 1 || !cells.length) continue;
    const b = isl.findIndex((q) => q.x === x && q.y === y);
    if (!rng.chance(loops)) continue;
    for (const [cx, cy] of cells) occ[cy * w + cx] = 2;
    br.push({ a, b, n: rng.chance(doubles) ? 2 : 1 });
  }
  const deg = isl.map(() => 0);
  for (const b of br) { deg[b.a] += b.n; deg[b.b] += b.n; }
  if (deg.some((d) => d > 8)) return null;
  const g = new Array(w * h).fill(0);
  isl.forEach((q, i) => { g[q.y * w + q.x] = deg[i]; });
  return { str: stringify(w, h, g), count: isl.length };
}
