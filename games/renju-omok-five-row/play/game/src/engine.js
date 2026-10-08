// The computer's brain. Pure and deterministic: no clock, no randomness except what env.rng hands in.
//
// How it thinks (the same ideas strong gomoku programs use, kept small):
//  * Pattern classes. For every empty point and each colour, each of the four lines through the point is classified as if that
//    colour stood there: nothing, two, open two, closed three, OPEN three, four, OPEN four (two ways to finish) or five. The
//    classes are kept up to date incrementally as stones go on and off the board, so reading them costs almost nothing.
//  * Tiers. The four classes of a point combine into a tier: "makes five", "makes an open four or a double four", "makes a four and
//    an open three" (4-3), "makes a four", "makes a double three", "makes an open three". Tiers drive move choice and the teaching hints.
//  * Search. Iterative-deepening alpha-beta over a handful of the best candidate points per move (forcing replies are forced), with
//    a transposition table and a "continuous fours" probe (VCF) that finds wins made only of fours. It is written as an explicit
//    stack, so it can be paused and resumed every frame: the game screen never freezes while the computer thinks, and Auto Play
//    can pause it mid-thought.
//  * Rules. Black's forbidden points in Renju and Omok come from rules.js, so the computer obeys exactly what the player obeys,
//    and as White it knows a forbidden point cannot be used to block.
import { MODES, BLACK, WHITE, foulOf, centerOf, inCentre5 } from './rules.js';

// ---- pattern classes ----------------------------------------------------------------------------------------------------------
const C_NONE = 0, C_ONE = 1, C_TWO = 2, C_TWO_O = 3, C_THREE_C = 4, C_THREE_O = 5, C_FOUR = 6, C_FOUR_O = 7, C_FIVE = 8;
const CW = [0, 1, 3, 9, 14, 55, 170, 1400, 40000];
// tiers: what a single stone at a point would do (both colours are scored the same way)
export const T = { NONE: 0, MINOR: 1, THREE: 4, DOUBLE_THREE: 5, FOUR: 6, FOUR_THREE: 7, WIN4: 8, FIVE: 9 };
const TV = [0, 12, 0, 0, 90, 260, 400, 1500, 6000, 100000];

// A line seen from the point: 9 cells, index 4 is the point (always "own"). 0 empty, 1 own, 2 blocked (opponent or edge).
function completionsOf(a, exact) {
  let out = 0, first = -1, second = -1;
  for (let s = 0; s <= 4; s++) {                                       // the five-windows that contain the point
    let own = 0, empty = -1, bad = false;
    for (let k = s; k < s + 5; k++) { const v = a[k]; if (v === 1) own++; else if (v === 0) { if (empty >= 0) bad = true; empty = k; } else bad = true; }
    if (bad || own !== 4 || empty < 0) continue;
    a[empty] = 1;
    let r = 1, k = empty - 1; while (k >= 0 && a[k] === 1) { r++; k--; } k = empty + 1; while (k <= 8 && a[k] === 1) { r++; k++; }
    a[empty] = 0;
    if (exact ? r === 5 : r >= 5) { if (empty !== first && empty !== second) { out++; if (first < 0) first = empty; else second = empty; } }
  }
  return out;
}
function classify(a, exact) {
  let r = 1, k = 3; while (k >= 0 && a[k] === 1) { r++; k--; } k = 5; while (k <= 8 && a[k] === 1) { r++; k++; }
  if (exact ? r === 5 : r >= 5) return C_FIVE;
  let m = 0;
  for (let s = 0; s <= 4; s++) { let own = 0, opp = 0; for (let j = s; j < s + 5; j++) { if (a[j] === 1) own++; else if (a[j] === 2) opp++; } if (!opp && own > m) m = own; }
  if (m < 4) {
    if (m === 3) {
      for (let e = 0; e <= 8; e++) if (a[e] === 0) { a[e] = 1; const c = completionsOf(a, exact); a[e] = 0; if (c >= 2) return C_THREE_O; }
      return C_THREE_C;
    }
    if (m === 2) {
      for (let e = 0; e <= 8; e++) if (a[e] === 0) {
        a[e] = 1;
        let ok = false;
        for (let f = 0; f <= 8 && !ok; f++) if (a[f] === 0) { a[f] = 1; if (completionsOf(a, exact) >= 2) ok = true; a[f] = 0; }
        a[e] = 0;
        if (ok) return C_TWO_O;
      }
      return C_TWO;
    }
    return m === 1 ? C_ONE : C_NONE;
  }
  const c = completionsOf(a, exact);
  return c >= 2 ? C_FOUR_O : c === 1 ? C_FOUR : C_THREE_C;
}
const tables = {}, building = {};
function buildChunk(exact, upto) {
  const key = exact ? 1 : 0;
  const bld = building[key] ?? (building[key] = { t: new Uint8Array(6561), code: 0, a: new Array(9) });
  const a = bld.a;
  while (bld.code < upto && bld.code < 6561) {
    let c = bld.code;
    for (let j = 0; j < 8; j++) { const v = c % 3; c = (c - v) / 3; a[j < 4 ? j : j + 1] = v; }
    a[4] = 1;
    bld.t[bld.code++] = classify(a, exact);
  }
  if (bld.code >= 6561) tables[key] = bld.t;
  return bld.code >= 6561;
}
function tableFor(exact) { const key = exact ? 1 : 0; if (!tables[key]) buildChunk(exact, 6561); return tables[key]; }
// Builds the two pattern tables a few hundred entries per call, so the title screen can do it between frames. Returns true when both are ready.
export function warmTables(chunk = 300) {
  for (const exact of [false, true]) { const key = exact ? 1 : 0; if (!tables[key]) { const b = building[key]; buildChunk(exact, (b ? b.code : 0) + chunk); return false; } }
  return true;
}

// ---- static board data (per board size) -----------------------------------------------------------------------------------------
const DX = [1, 0, 1, 1], DY = [0, 1, 1, -1];
const geoCache = {};
function geoFor(n) {
  if (geoCache[n]) return geoCache[n];
  const N = n * n, nb = new Int16Array(N * 4 * 8).fill(-1), winsOf = Array.from({ length: N }, () => []), winCells = [];
  for (let i = 0; i < N; i++) {
    const x = i % n, y = (i / n) | 0;
    for (let d = 0; d < 4; d++) {
      let j = 0;
      for (let k = -4; k <= 4; k++) {
        if (k === 0) continue;
        const px = x + k * DX[d], py = y + k * DY[d];
        nb[(i * 4 + d) * 8 + j] = px < 0 || py < 0 || px >= n || py >= n ? -1 : py * n + px;
        j++;
      }
    }
  }
  for (let d = 0; d < 4; d++) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const ex = x + 4 * DX[d], ey = y + 4 * DY[d];
      if (ex < 0 || ey < 0 || ex >= n || ey >= n) continue;
      const w = winCells.length / 5;
      for (let k = 0; k < 5; k++) { const c = (y + k * DY[d]) * n + x + k * DX[d]; winCells.push(c); winsOf[c].push(w); }
    }
  }
  // cells within distance 2 (Chebyshev) of each cell
  const near2 = Array.from({ length: N }, (_, i) => { const x = i % n, y = (i / n) | 0, out = []; for (let yy = Math.max(0, y - 2); yy <= Math.min(n - 1, y + 2); yy++) for (let xx = Math.max(0, x - 2); xx <= Math.min(n - 1, x + 2); xx++) out.push(yy * n + xx); return Int16Array.from(out); });
  return (geoCache[n] = { n, N, nb, winsOf: winsOf.map((w) => Int16Array.from(w)), W: winCells.length / 5, near2 });
}

const WT = [0, 1, 6, 50, 500, 60000];     // value of a live five-window holding 0..5 stones of one colour

// ---- the position ---------------------------------------------------------------------------------------------------------------
const POW3 = [1, 3, 9, 27, 81, 243, 729, 2187];
class Pos {
  constructor(g) {
    const m = MODES[g.mode], G = geoFor(g.n), N = G.N;
    this.m = m; this.n = g.n; this.N = N; this.G = G;
    this.third = g.opening === 'restricted' && g.moves.length === 2 && g.turn === BLACK;     // root-only opening restriction (see rules.js)
    this.stones0 = g.moves.length;
    this.cells = new Int8Array(N);
    this.tab = [null, tableFor(m.blackExact), tableFor(false)];
    this.cls = [null, new Uint8Array(4 * N), new Uint8Array(4 * N)];       // [colour][dir * N + i]: pattern class of the point for that colour
    this.code = [null, new Int16Array(4 * N), new Int16Array(4 * N)];      // base-3 neighbourhood code behind each class (kept up to date)
    this.sc = [null, new Int32Array(N), new Int32Array(N)];                // sum of class weights per point
    this.tr = [null, new Uint8Array(N), new Uint8Array(N)];                // cached tier per point and colour
    this.near = new Int8Array(N);
    this.cnt = [null, new Uint8Array(G.W), new Uint8Array(G.W)];
    this.score = [0, 0, 0];
    this.h1 = 0; this.h2 = 0; this.stones = 0;
    const rnd = mulberry(0x9e3779b9);
    this.z1 = [null, new Int32Array(N), new Int32Array(N)]; this.z2 = [null, new Int32Array(N), new Int32Array(N)];
    for (let c = 1; c <= 2; c++) for (let i = 0; i < N; i++) { this.z1[c][i] = rnd(); this.z2[c][i] = rnd(); }
    this.zTurn = rnd();
    for (let i = 0; i < N; i++) for (let d = 0; d < 4; d++) {
      let code = 0;
      for (let j = 0; j < 8; j++) if (G.nb[(i * 4 + d) * 8 + j] < 0) code += 2 * POW3[j];     // the edge counts as blocked
      for (let c = 1; c <= 2; c++) { this.code[c][d * N + i] = code; this.setCls(c, d, i, this.tab[c][code]); }
    }
    for (const idx of g.moves) this.place(idx, g.cells[idx]);
    for (let i = 0; i < N; i++) if (g.cells[i] && !this.cells[i]) this.place(i, g.cells[i]);
  }
  setCls(c, d, i, v) {
    const cl = this.cls[c], k = d * this.N + i, old = cl[k];
    if (v === old) return;
    cl[k] = v; this.sc[c][i] += CW[v] - CW[old];
    this.tr[c][i] = this.computeTier(c, i);
  }
  computeTier(c, i) {
    const cl = this.cls[c], N = this.N;
    let five = 0, fo = 0, f4 = 0, t3 = 0, minor = 0;
    for (let d = 0; d < 4; d++) {
      const v = cl[d * N + i];
      if (v === C_FIVE) five++; else if (v === C_FOUR_O) fo++; else if (v === C_FOUR) f4++; else if (v === C_THREE_O) t3++; else if (v >= C_TWO_O) minor++;
    }
    if (five) return T.FIVE;
    if (fo || f4 >= 2) return T.WIN4;
    if (f4 && t3) return T.FOUR_THREE;
    if (f4) return T.FOUR;
    if (t3 >= 2) return T.DOUBLE_THREE;
    if (t3) return T.THREE;
    return minor ? T.MINOR : T.NONE;
  }
  // a stone of colour c appears at p (sign = +1) or disappears (sign = -1)
  shift(p, c, sign) {
    const o = 3 - c, N = this.N, nb = this.G.nb, cells = this.cells, cc = this.code[c], co = this.code[o], tc = this.tab[c], to = this.tab[o];
    for (let d = 0; d < 4; d++) {
      const base = (p * 4 + d) * 8, dn = d * N;
      for (let j = 0; j < 8; j++) {
        const q = nb[base + j];
        if (q < 0) continue;
        const pw = POW3[7 - j] * sign;                                   // p sits at the opposite offset in q's neighbourhood
        cc[dn + q] += pw; co[dn + q] += 2 * pw;
        if (!cells[q]) { this.setCls(c, d, q, tc[cc[dn + q]]); this.setCls(o, d, q, to[co[dn + q]]); }
      }
    }
  }
  place(p, c) {
    const o = 3 - c, G = this.G, N = this.N;
    this.cells[p] = c; this.stones++;
    this.h1 ^= this.z1[c][p]; this.h2 ^= this.z2[c][p];
    for (let d = 0; d < 4; d++) { this.setCls(1, d, p, 0); this.setCls(2, d, p, 0); }
    this.shift(p, c, 1);
    const ws = G.winsOf[p], cc = this.cnt[c], co = this.cnt[o];
    for (let k = 0; k < ws.length; k++) {
      const w = ws[k];
      if (co[w] === 0) this.score[c] += WT[cc[w] + 1] - WT[cc[w]]; else if (cc[w] === 0) this.score[o] -= WT[co[w]];
      cc[w]++;
    }
    const n2 = G.near2[p]; for (let k = 0; k < n2.length; k++) this.near[n2[k]]++;
  }
  unplace(p) {
    const c = this.cells[p], o = 3 - c, G = this.G, N = this.N;
    const ws = G.winsOf[p], cc = this.cnt[c], co = this.cnt[o];
    for (let k = 0; k < ws.length; k++) {
      const w = ws[k];
      cc[w]--;
      if (co[w] === 0) this.score[c] -= WT[cc[w] + 1] - WT[cc[w]]; else if (cc[w] === 0) this.score[o] += WT[co[w]];
    }
    this.cells[p] = 0; this.stones--;
    this.h1 ^= this.z1[c][p]; this.h2 ^= this.z2[c][p];
    this.shift(p, c, -1);
    for (let d = 0; d < 4; d++) { this.setCls(1, d, p, this.tab[1][this.code[1][d * N + p]]); this.setCls(2, d, p, this.tab[2][this.code[2][d * N + p]]); }
    const n2 = G.near2[p]; for (let k = 0; k < n2.length; k++) this.near[n2[k]]--;
  }
  // tier of a point for colour c (see T)
  tier(c, i) { return this.tr[c][i]; }
  foul(i) { return this.m.ban3 || this.m.ban4 || this.m.banOver ? foulOf(this.cells, this.n, i, this.m) : null; }
}
function mulberry(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (t ^ (t >>> 14)) | 0; }; }

// ---- move scanning --------------------------------------------------------------------------------------------------------------
const WIN = 1000000;
const KEYBUF = new Float64Array(512), CANDBUF = new Int16Array(512);
// Looks at every point near a stone for colour `me` (to move). Fills `s` with what matters.
function scan(P, me, s) {
  const o = 3 - me, near = P.near, cells = P.cells, N = P.N, n = P.n, scm = P.sc[me], sco = P.sc[o];
  s.five = -1; s.oppFive.length = 0; s.myWin.length = 0; s.oppWin.length = 0; s.myFour = 0; s.oppFour = 0; s.nc = 0;
  const half = (n - 1) / 2;
  for (let i = 0; i < N; i++) {
    if (!near[i] || cells[i]) continue;
    let tm = P.tier(me, i), to = P.tier(o, i);
    if (tm === T.FIVE && me === BLACK && P.m.blackExact && P.foul(i)) tm = T.FOUR;       // a six, not a five: the pattern table cannot see past 4 points
    if (to === T.FIVE && o === BLACK && P.m.blackExact && P.foul(i)) to = T.FOUR;
    if (tm === T.FIVE && s.five < 0) s.five = i;
    if (to === T.FIVE) s.oppFive.push(i);
    if (tm >= T.FOUR_THREE && tm < T.FIVE) s.myWin.push(i);
    if (to >= T.FOUR_THREE && to < T.FIVE) s.oppWin.push(i);
    if (tm >= T.FOUR) s.myFour++;
    if (to >= T.FOUR) s.oppFour++;
    const x = i % n, y = (i / n) | 0, dc = Math.abs(x - half) + Math.abs(y - half);
    KEYBUF[s.nc] = TV[tm] + TV[to] * 0.92 + scm[i] + sco[i] * 0.9 - dc * 0.35;
    CANDBUF[s.nc] = i; s.nc++;
    if (tm >= T.FOUR) KEYBUF[s.nc - 1] += 30;
  }
  return s;
}
const newScan = () => ({ five: -1, oppFive: [], myWin: [], oppWin: [], myFour: 0, oppFour: 0, nc: 0 });

// Is point i a legal move for `me`? (Only Black can be restricted.) A move that makes five is always legal.
function legalFor(P, me, i, tmKnown) {
  if (me !== BLACK) return true;
  if (P.third && P.stones === P.stones0 && inCentre5(P.n, i)) return false;
  return !P.foul(i);
}

// ---- VCF: a win made only of fours -----------------------------------------------------------------------------------------------
// Returns the first move of a continuous-fours win for `me` (to move), or -1. `st.budget` counts nodes down.
function vcf(P, me, depth, st) {
  if (st.budget <= 0) return -1;
  st.budget--;
  const o = 3 - me, n = P.n, N = P.N;
  // opponent already threatens five and I cannot finish first
  let fiveCell = -1, oppThreat = false;
  const near = P.near, cells = P.cells, four = st.fourBuf[depth] ?? (st.fourBuf[depth] = []);
  four.length = 0;
  for (let i = 0; i < N; i++) {
    if (!near[i] || cells[i]) continue;
    const tm = P.tier(me, i);
    if (tm === T.FIVE) { fiveCell = i; break; }
    if (tm >= T.FOUR && tm !== T.DOUBLE_THREE) four.push(i, tm);
    if (!oppThreat && P.tier(o, i) === T.FIVE) oppThreat = true;
  }
  if (fiveCell >= 0) return fiveCell;
  if (oppThreat || depth <= 0) return -1;
  for (let k = 0; k < four.length; k += 2) {
    const i = four[k], tm = four[k + 1];
    if (me === BLACK && P.foul(i)) continue;
    if (tm === T.WIN4) {
      // an open four or a double four: win unless it is a foul for Black
      return i;
    }
    // a plain four: the opponent must block the single completion point
    P.place(i, me);
    let q = -1;
    for (let j = 0; j < N; j++) { if (!near[j] || cells[j]) continue; if (P.tier(me, j) === T.FIVE) { q = j; break; } }
    let res = -1;
    if (q >= 0) {
      if (o === BLACK && P.foul(q)) res = i;                       // Black cannot legally block here: the four wins
      else if (P.tier(o, q) !== T.FIVE) {
        P.place(q, o);
        if (vcf(P, me, depth - 1, st) >= 0) res = i;
        P.unplace(q);
      }
    }
    P.unplace(i);
    if (res >= 0) return res;
    if (st.budget <= 0) return -1;
  }
  return -1;
}

// ---- levels ----------------------------------------------------------------------------------------------------------------------
export const LEVELS = [
  { name: 'Learner', blurb: 'Gentle. Sees your fours, misses quieter plans.', depth: 0, nodes: 0, K: [8], vcfDepth: 0, noise: 0.5, slip: 0.3 },
  { name: 'Casual', blurb: 'Blocks threes and builds simple attacks.', depth: 2, nodes: 2500, K: [9, 7], vcfDepth: 0, noise: 0.22, slip: 0.1 },
  { name: 'Club', blurb: 'Sees combinations a few moves ahead.', depth: 4, nodes: 22000, K: [10, 8, 6, 5], vcfDepth: 4, noise: 0.06, slip: 0 },
  { name: 'Expert', blurb: 'Searches deep and finds long forcing wins.', depth: 7, nodes: 60000, K: [12, 9, 7, 6, 5, 5, 4], vcfDepth: 8, noise: 0, slip: 0 },
  { name: 'Master', blurb: 'The strongest: deep search and a hunter for forced wins.', depth: 11, nodes: 150000, K: [16, 11, 8, 7, 6, 6, 5, 5, 4, 4, 4], vcfDepth: 12, noise: 0, slip: 0 },
];

// ---- the thinker ----------------------------------------------------------------------------------------------------------------
const TT_BITS = 17, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
const MAXPLY = 40, MAXC = 24;

export function createThinker(game, level, rng, opts = {}) {
  let lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, (opts.level ?? level) - (opts.zeroBased ? 0 : 1)))];
  const me = game.turn, o = 3 - me, P = new Pos(game), st = { budget: 0, fourBuf: [] };
  let slice = opts.slice ?? 600; const nodeCap = Math.round((opts.nodes ?? lv.nodes) * (opts.scale ?? 1));
  let done = null, phase = 'start', nodes = 0, limit = 0;
  const info = { depth: 0, value: 0, nodes: 0, kind: '' };
  const sc0 = newScan();

  // quick ordering of the root candidates
  const rootMoves = [];
  const finishWith = (move, kind) => { done = { move }; info.kind = kind ?? info.kind; info.nodes = nodes; };

  // pick among near-equal best moves with the level's noise (variety without blunders at the top levels)
  const pickNoisy = (list) => {
    if (!list.length) return -1;
    if (lv.noise <= 0) {
      // ties at the very top: choose by rng among moves within 2% of the best key
      const top = list[0].key, tied = list.filter((x) => x.key >= top - Math.abs(top) * 0.02 - 0.5);
      return tied[rng.int(tied.length)].idx;
    }
    const top = list[0].key, band = Math.max(1, Math.abs(top) * lv.noise);
    const pool = list.filter((x, k) => k < 6 && x.key >= top - band);
    return pool[rng.int(pool.length)].idx;
  };

  // ---- opening and forced situations --------------------------------------------------------------------------
  function begin() {
    const n = game.n, centre = centerOf(n);
    if (P.stones === 0) return finishWith(centre, 'opening');
    scan(P, me, sc0);
    // five now
    if (sc0.five >= 0) return finishWith(sc0.five, 'win');
    // a very early reply: stay close to the stones, with some variety
    if (P.stones <= 2) {
      const cands = []; for (let i = 0; i < sc0.nc; i++) if (P.near[CANDBUF[i]] > 0) cands.push(CANDBUF[i]);
      const close = cands.filter((i) => { const x = i % n, y = (i / n) | 0, cx = centre % n, cy = (centre / n) | 0; return Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= 1; });
      if (close.length && P.stones === 1) return finishWith(close[rng.int(close.length)], 'opening');
    }
    // must block a five (several: lost anyway, block the first legal one)
    if (sc0.oppFive.length) {
      const legal = sc0.oppFive.filter((i) => legalFor(P, me, i, 0));
      if (legal.length) return finishWith(legal[0], 'block-five');
      phase = 'order'; lv = { ...lv, depth: 0, nodes: 0, noise: 0, slip: 0 }; return;       // Black may not block there: lost, play any legal move
    }
    // sure win in two: an open four / double four / four-three while the opponent cannot answer with fours
    if (sc0.myWin.length && sc0.oppFour === 0 && lv.depth >= 2) {
      const w = sc0.myWin.find((i) => legalFor(P, me, i, 0));
      if (w !== undefined) return finishWith(w, 'combo');
    }
    // continuous fours
    if (lv.vcfDepth > 0) {
      st.budget = 1500 + lv.vcfDepth * 350;
      const v = vcf(P, me, lv.vcfDepth, st);
      if (v >= 0 && legalFor(P, me, v, P.tier(me, v))) return finishWith(v, 'vcf');
    }
    phase = 'order';
  }

  // the legal, ordered root list
  function buildRoot() {
    const items = [];
    for (let i = 0; i < sc0.nc; i++) items.push({ idx: CANDBUF[i], key: KEYBUF[i] });
    items.sort((a, b) => b.key - a.key || a.idx - b.idx);
    const out = [];
    for (const it of items) {
      if (out.length >= Math.max(lv.K[0], 4) + 6) break;
      if (!legalFor(P, me, it.idx, 0)) continue;
      out.push(it);
    }
    // forced defence: when the opponent threatens a win, make sure those points are in the list
    for (const w of sc0.oppWin) if (!out.some((x) => x.idx === w) && legalFor(P, me, w, 0)) out.push({ idx: w, key: 0 });
    return out;
  }

  // ---- explicit-stack alpha-beta ------------------------------------------------------------------------------
  const ttK1 = new Int32Array(TT_SIZE), ttK2 = new Int32Array(TT_SIZE), ttV = new Int32Array(TT_SIZE), ttM = new Int16Array(TT_SIZE).fill(-1), ttD = new Int8Array(TT_SIZE).fill(-1), ttF = new Int8Array(TT_SIZE);
  const F = Array.from({ length: MAXPLY }, () => ({ moves: new Int16Array(MAXC), n: 0, i: 0, alpha: 0, beta: 0, best: 0, bestM: -1, depth: 0, color: 0, move: -1, a0: 0, scan: newScan(), ext: 0 }));
  let rootItems = [], rootDepth = 0, bestMove = -1, bestValue = 0, lastDone = null, rootIndex = 0, rootAlpha = 0;
  let ret = 0, ply = 0, mode = 'enter';       // 'enter' | 'ret'

  function evalLeaf(color) {
    const v = P.score[color] - P.score[3 - color] * 1.05;
    return v > 90000 ? 90000 : v < -90000 ? -90000 : v | 0;
  }
  const stage = (p) => lv.K[Math.min(p, lv.K.length - 1)];

  // Fills frame f (at `ply`) for a node; returns true when the node is already decided (value in `ret`).
  function enterNode(p) {
    const f = F[p], color = f.color, s = f.scan;
    nodes++;
    // transposition table
    const hi = (P.h1 ^ (color === WHITE ? P.zTurn : 0)) | 0, ix = hi & TT_MASK, lo = P.h2 | 0;
    let ttMove = -1;
    if (ttK1[ix] === hi && ttK2[ix] === lo) {
      ttMove = ttM[ix];
      if (ttD[ix] >= f.depth && p > 0) {
        const v = ttV[ix], fl = ttF[ix];
        if (fl === 0 || (fl === 1 && v >= f.beta) || (fl === 2 && v <= f.alpha)) { ret = v; return true; }
      }
    }
    f.ttIx = ix; f.ttHi = hi; f.ttLo = lo;
    if (p >= MAXPLY - 3) { ret = evalLeaf(color); return true; }
    scan(P, color, s);
    if (s.five >= 0) { ret = WIN - p; return true; }
    const oc = 3 - color;
    let forced = false;
    f.n = 0; f.i = 0;
    if (s.oppFive.length) {
      let legalN = 0;
      for (const q of s.oppFive) if (legalFor(P, color, q, 0) && legalN < MAXC) f.moves[legalN++] = q;
      if (!legalN) { ret = -(WIN - p - 1); return true; }
      // two different five-points cannot both be blocked
      if (legalN >= 2) { const a = new Set(s.oppFive); if (a.size >= 2 && legalN === a.size) { ret = -(WIN - p - 1); return true; } }
      f.n = legalN; forced = true;
    } else {
      // a sure win: open four / double four / four-three, and the opponent has no four to interfere with
      if (s.myWin.length && s.oppFour === 0) {
        for (const q of s.myWin) if (legalFor(P, color, q, 0)) { ret = WIN - p - 2; return true; }
      }
      if (f.depth <= 0) {
        // leaf: look for a win made of fours, then fall back to the static score
        if (lv.vcfDepth > 0 && p < MAXPLY - 6) {
          st.budget = 120;
          const v = vcf(P, color, Math.min(6, lv.vcfDepth), st);
          if (v >= 0 && legalFor(P, color, v, P.tier(color, v))) { ret = WIN - p - 4; return true; }
        }
        let e = evalLeaf(color);
        // opponent threatens an open four / four-three and I have no four to answer: that is nearly lost
        if (s.oppWin.length && s.myFour === 0) e -= 6000;
        if (s.myWin.length) e += 3000;
        ret = e; return true;
      }
      // candidates: best keys first, legal only; opponent's winning points and my fours are always included
      const K = stage(p), mv = f.moves, want = K + s.oppWin.length + 2;
      let nsel = 0;
      const has = (q) => { for (let k = 0; k < nsel; k++) if (mv[k] === q) return true; return false; };
      const take = (q) => { if (nsel < MAXC && !has(q) && legalFor(P, color, q, 0)) { mv[nsel++] = q; } };
      if (ttMove >= 0 && !P.cells[ttMove]) take(ttMove);
      for (let k = 0; k < s.oppWin.length; k++) take(s.oppWin[k]);
      // repeated selection of the best remaining key (K is small, so this beats sorting every point)
      const nc = s.nc;
      for (let r = 0; r < want && nsel < want && r < nc; r++) {
        let bi = -1, bk = -Infinity;
        for (let k = 0; k < nc; k++) { const kk = KEYBUF[k]; if (kk > bk) { bk = kk; bi = k; } }
        if (bi < 0) break;
        KEYBUF[bi] = -Infinity;
        take(CANDBUF[bi]);
      }
      f.n = nsel;
      if (!f.n) { ret = 0; return true; }
    }
    // search extension for forced replies
    f.forced = forced;
    f.best = -WIN - 10; f.bestM = -1; f.a0 = f.alpha;
    return false;
  }

  // Runs the stack machine for at most the current node budget. Returns true when the whole iteration is finished.
  function run() {
    for (;;) {
      if (nodes >= limit) return false;
      if (mode === 'enter') {
        if (enterNode(ply)) mode = 'ret'; else mode = 'next';
      } else if (mode === 'next') {
        const f = F[ply];
        if (f.i < f.n) {
          const m = f.moves[f.i++];
          f.move = m;
          P.place(m, f.color);
          const g = F[ply + 1];
          g.color = 3 - f.color; g.alpha = -f.beta; g.beta = -f.alpha;
          g.depth = f.depth - 1 + (f.forced && ply < rootDepth + 6 && f.depth <= 1 ? 1 : 0);
          ply++; mode = 'enter';
        } else {
          // node finished: store
          const f2 = F[ply];
          if (ply > 0 && f2.bestM >= 0 && (ttD[f2.ttIx] <= f2.depth || ttK1[f2.ttIx] !== f2.ttHi)) {
            const fl = f2.best <= f2.a0 ? 2 : f2.best >= f2.beta ? 1 : 0;
            ttK1[f2.ttIx] = f2.ttHi; ttK2[f2.ttIx] = f2.ttLo; ttV[f2.ttIx] = f2.best; ttM[f2.ttIx] = f2.bestM; ttD[f2.ttIx] = f2.depth; ttF[f2.ttIx] = fl;
          }
          ret = f2.best; mode = 'ret';
        }
      } else {                       // 'ret': hand `ret` to the parent
        if (ply === 0) return true;
        ply--;
        const f = F[ply];
        P.unplace(f.move);
        const v = -ret;
        if (v > f.best) { f.best = v; f.bestM = f.move; if (ply === 0) { rootBestNow(f.move, v); } }
        if (v > f.alpha) f.alpha = v;
        if (f.alpha >= f.beta) f.i = f.n;           // cutoff
        mode = 'next';
      }
    }
  }
  let rootBest = { move: -1, value: -WIN * 2 };
  function rootBestNow(m, v) { rootBest = { move: m, value: v }; }

  // ---- iterative deepening driver -------------------------------------------------------------------------------
  function startDepth(d) {
    rootDepth = d;
    const f = F[0];
    f.color = me; f.depth = d; f.alpha = -WIN - 10; f.beta = WIN + 10;
    // the root has its own move list (ordered, previous best first)
    f.n = 0; f.i = 0; f.forced = false;
    const seq = rootItems.slice();
    if (bestMove >= 0) { const k = seq.findIndex((x) => x.idx === bestMove); if (k > 0) { const [it] = seq.splice(k, 1); seq.unshift(it); } }
    for (const it of seq) if (f.n < MAXC) f.moves[f.n++] = it.idx;
    f.best = -WIN - 10; f.bestM = -1; f.a0 = f.alpha; f.ttIx = 0; f.ttHi = 0; f.ttLo = 0;
    ply = 0; mode = 'next';
    rootBest = { move: -1, value: -WIN * 2 };
  }

  function thinkStep() {
    limit = nodes + slice;
    if (phase === 'start') { begin(); if (done) return; }
    if (phase === 'order') {
      rootItems = buildRoot();
      if (!rootItems.length) { finishWith(-1, 'none'); return; }
      info.rootCount = rootItems.length;
      // level 1 (and any level with no search budget): pick by key with noise
      if (lv.depth === 0 || !nodeCap) {
        let list = rootItems;
        if (lv.slip && rng.chance(lv.slip)) {                       // a learner sometimes forgets to defend: it only looks at its own attack
          const mine = rootItems.map((it) => ({ idx: it.idx, key: P.tier(me, it.idx) * 400 + P.sc[me][it.idx] })).sort((a, b) => b.key - a.key);
          if (mine[0].key > 0) list = mine;
        }
        finishWith(pickNoisy(list), 'pick'); return;
      }
      if (rootItems.length === 1) { finishWith(rootItems[0].idx, 'only'); return; }
      bestMove = rootItems[0].idx; bestValue = 0;
      startDepth(2);
      phase = 'search';
    }
    if (phase === 'search') {
      const finished = run();
      if (finished) {
        // a depth is complete
        lastDone = { move: F[0].bestM, value: F[0].best, depth: rootDepth };
        info.depth = rootDepth; info.value = F[0].best;
        bestMove = F[0].bestM; bestValue = F[0].best;
        if (Math.abs(bestValue) >= WIN - 200 || rootDepth >= lv.depth || nodes >= nodeCap) {
          if (bestValue <= -(WIN - 200) && rootItems.length > 1) { /* lost anyway: keep the move that resists longest */ }
          return finishSearch();
        }
        startDepth(rootDepth + 1);
      } else if (nodes >= nodeCap) {
        // out of budget in the middle of a depth: use the best known root move if this depth already improved it
        if (rootBest.move >= 0 && rootBest.value >= bestValue) bestMove = rootBest.move;
        return finishSearch();
      }
    }
  }
  function finishSearch() {
    // among root moves that are (nearly) as good, vary with rng at the lower levels; always take the proven best at the top.
    let m = bestMove;
    if (m < 0) m = rootItems[0].idx;
    finishWith(m, Math.abs(bestValue) >= WIN - 200 ? (bestValue > 0 ? 'forced-win' : 'lost') : 'search');
  }

  return {
    info,
    // advance the thought by one slice; returns { move } when finished, otherwise { move: undefined, progress }
    step(sliceNow) {
      if (sliceNow > 0) slice = sliceNow;
      if (!done) thinkStep();
      if (done) return { move: done.move, info };
      const prog = nodeCap ? Math.min(0.99, nodes / nodeCap) : 0.5;
      info.nodes = nodes;
      return { move: undefined, progress: prog };
    },
  };
}

// Swap opening: should the side that plays White swap to Black after the third stone? True when Black's edge is clear.
export function swapChoice(game) {
  const P = new Pos(game), diff = P.score[BLACK] - P.score[WHITE] * 1.0;
  return diff > 18;
}

// Synchronous convenience for tests and tools.
export function chooseMove(game, level, rng, opts = {}) {
  const t = createThinker(game, level, rng, { slice: 1e9, ...opts });
  for (let k = 0; k < 10000; k++) { const r = t.step(); if (r.move !== undefined) return r.move; }
  return -1;
}

// ---- teaching helpers -----------------------------------------------------------------------------------------------------------
// What the board looks like to a coach: the points where each side would make five / a winning combination, and Black's fouls.
export function threatsOf(game) {
  const P = new Pos(game), out = { five: { 1: [], 2: [] }, win: { 1: [], 2: [] }, four: { 1: [], 2: [] }, three: { 1: [], 2: [] } };
  for (let i = 0; i < P.N; i++) {
    if (P.cells[i] || !P.near[i]) continue;
    for (const c of [BLACK, WHITE]) {
      const t = P.tier(c, i);
      if (t === T.FIVE) out.five[c].push(i);
      else if (t >= T.FOUR_THREE) { if (c === BLACK && P.foul(i)) continue; out.win[c].push(i); }
      else if (t === T.FOUR) { if (c === BLACK && P.foul(i)) continue; out.four[c].push(i); }
      else if (t >= T.THREE) { if (c === BLACK && P.foul(i)) continue; out.three[c].push(i); }
    }
  }
  return out;
}
// One short sentence about a move, for the hint and the Auto Play commentary. `colorName` names the mover ("Black"/"White").
export function explainMove(game, idx) {
  const c = game.turn, o = 3 - c, P = new Pos(game), nm = c === BLACK ? 'Black' : 'White', on = c === BLACK ? 'White' : 'Black';
  const tm = P.tier(c, idx), to = P.tier(o, idx);
  if (tm === T.FIVE) return 'This makes five in a row and wins.';
  if (to === T.FIVE) return `This blocks ${on}'s five. It has to be stopped here.`;
  if (tm === T.WIN4) return 'This makes an open four (or two fours at once): the opponent cannot stop both ends.';
  if (tm === T.FOUR_THREE) return 'This makes a four and an open three together: a winning combination.';
  if (to >= T.FOUR_THREE) return `This takes the point where ${on} would make a winning combination.`;
  if (tm === T.FOUR) return 'This makes a four. The opponent must block at once, which gives you the next move.';
  if (tm === T.DOUBLE_THREE) return 'This makes two open threes at once, a strong threat.';
  if (to === T.THREE || to === T.DOUBLE_THREE) return `This stops ${on}'s open three before it becomes an open four.`;
  if (tm === T.THREE) return 'This makes an open three: next turn it can become an open four.';
  if (to === T.FOUR) return `This blocks a line ${on} was building.`;
  const x = idx % game.n, y = (idx / game.n) | 0, h = (game.n - 1) / 2;
  if (Math.abs(x - h) + Math.abs(y - h) <= 2 && game.moves.length < 6) return 'A flexible point near the centre, where lines can go in every direction.';
  return `${nm} builds a position here: it joins stones and keeps options open.`;
}
export { Pos };
