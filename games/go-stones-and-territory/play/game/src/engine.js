// The computer's brain. The same rules as rules.js on typed arrays (fast), plus:
//  - playouts: quick imagined games played to the end with light tactical habits (capture, rescue) and never filling
//    an own eye;
//  - Monte-Carlo tree search (UCT) that runs in SLICES: step(k) does k playouts and returns, so a frame is never
//    blocked. Work is counted in playouts, never in time, so the game stays deterministic;
//  - ownership estimates from playouts, used to find dead stones automatically when a game ends.
import { nbs, opp, hashBoard, group } from './rules.js';

export const LEVELS = [
  { id: 'curious', name: 'Curious', sims: 0, blurb: 'Plays fast and simply: grabs a capture, saves a stone in atari, otherwise wanders. Kind to a first game.' },
  { id: 'learner', name: 'Learner', sims: 150, blurb: 'Looks a little ahead. Punishes stones left in atari but misses long plans.' },
  { id: 'club', name: 'Club', sims: 2500, blurb: 'Reads plenty of imagined games per move. Makes real territory and fights back.' },
  { id: 'strong', name: 'Strong', sims: 10000, blurb: 'Thinks longest. Strongest on 9x9; on 13x13 and 19x19 it sees less of the board and is weaker.' },
];
// playouts per frame, by board size: keeps a frame under a few milliseconds (measured, see STATUS.md)
export const PER_TICK = { 5: 80, 7: 60, 9: 50, 13: 26, 19: 10 };
// the bigger the board, the fewer imagined games we can afford: honest, weaker play on 13x13 and 19x19
export const SIM_SCALE = { 5: 0.5, 7: 0.8, 9: 1, 13: 0.55, 19: 0.3 };
export const simsFor = (level, n) => Math.round(LEVELS[level].sims * (SIM_SCALE[n] ?? 0.3));

export function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export function makeSim(n) {
  const N2 = n * n, NBI = nbs(n);
  const NB = new Int16Array(N2 * 4).fill(-1), diag = new Int16Array(N2 * 4).fill(-2);
  for (let i = 0; i < N2; i++) {
    NBI[i].forEach((j, k) => { NB[i * 4 + k] = j; });
    const x = i % n, y = (i / n) | 0; let k = 0;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const X = x + dx, Y = y + dy; diag[i * 4 + k++] = X < 0 || Y < 0 || X >= n || Y >= n ? -1 : Y * n + X; }
  }
  const b = new Uint8Array(N2), seen = new Int32Array(N2), libm = new Int32Array(N2), stack = new Int16Array(N2 + 4);
  const emp = new Int16Array(N2), where = new Int16Array(N2);
  let ne = 0, ko = -1, st = 0, lastLib = -1, lastCap = -1;

  function load(src, koPoint) {
    ne = 0;
    for (let i = 0; i < N2; i++) { b[i] = src[i]; if (!b[i]) { where[i] = ne; emp[ne++] = i; } else where[i] = -1; }
    ko = koPoint;
  }
  function addEmpty(i) { where[i] = ne; emp[ne++] = i; }
  function delEmpty(i) { const w = where[i], l = emp[--ne]; emp[w] = l; where[l] = w; where[i] = -1; }
  function libs(i, limit) {
    const c = b[i]; st++; let sp = 0, cnt = 0; stack[sp++] = i; seen[i] = st;
    while (sp) {
      const s = stack[--sp];
      for (let k = 0; k < 4; k++) {
        const j = NB[s * 4 + k]; if (j < 0) break;
        const v = b[j];
        if (v === 0) { if (libm[j] !== st) { libm[j] = st; cnt++; lastLib = j; if (cnt >= limit) return cnt; } }
        else if (v === c && seen[j] !== st) { seen[j] = st; stack[sp++] = j; }
      }
    }
    return cnt;
  }
  function removeGroup(i) {
    const c = b[i]; let sp = 0, cnt = 0; stack[sp++] = i; b[i] = 0; addEmpty(i); cnt++; lastCap = i;
    while (sp) {
      const s = stack[--sp];
      for (let k = 0; k < 4; k++) { const j = NB[s * 4 + k]; if (j < 0) break; if (b[j] === c) { b[j] = 0; addEmpty(j); cnt++; stack[sp++] = j; } }
    }
    return cnt;
  }
  // Returns the number of stones captured, or -1 if the move is illegal (nothing changed).
  function play(i, c) {
    if (b[i] !== 0 || i === ko) return -1;
    const o = 3 - c; b[i] = c; let cap = 0, capPt = -1;
    for (let k = 0; k < 4; k++) { const j = NB[i * 4 + k]; if (j < 0) break; if (b[j] === o && libs(j, 1) === 0) { cap += removeGroup(j); capPt = lastCap; } }
    if (cap === 0 && libs(i, 1) === 0) { b[i] = 0; return -1; }
    delEmpty(i);
    ko = -1;
    if (cap === 1) { let own = 0; for (let k = 0; k < 4; k++) { const j = NB[i * 4 + k]; if (j < 0) break; if (b[j] === c) own++; } if (own === 0 && libs(i, 2) === 1) ko = capPt; }
    return cap;
  }
  function isEye(i, c) {
    for (let k = 0; k < 4; k++) { const j = NB[i * 4 + k]; if (j < 0) break; if (b[j] !== c) return false; }
    let bad = 0, off = 0;
    for (let k = 0; k < 4; k++) { const d = diag[i * 4 + k]; if (d === -1) off++; else if (b[d] !== c) bad++; }
    return off > 0 ? bad === 0 : bad <= 1;
  }
  // a tactical reply near the last move: capture an enemy group in atari, or rescue our own
  function tactical(color, last) {
    if (last < 0) return -1;
    const o = 3 - color;
    if (b[last] === o && libs(last, 2) === 1) return lastLib;
    for (let k = 0; k < 4; k++) {
      const j = NB[last * 4 + k]; if (j < 0) break;
      if (b[j] === o && libs(j, 2) === 1) return lastLib;
    }
    for (let k = 0; k < 4; k++) {
      const j = NB[last * 4 + k]; if (j < 0) break;
      if (b[j] === color && libs(j, 2) === 1) return lastLib;
    }
    return -1;
  }
  // a random legal move that does not fill an own eye; -1 = pass
  function randomMove(color, rnd) {
    let k = ne;
    while (k > 0) {
      const r = (rnd() * k) | 0, p = emp[r];
      if (p !== ko && !isEye(p, color) && play(p, color) >= 0) return p;
      const l = emp[k - 1]; emp[r] = l; emp[k - 1] = p; where[l] = r; where[p] = k - 1; k--;
    }
    return -1;
  }
  // Play to the end from the loaded position; returns nothing, board holds the result.
  function playout(color, rnd, last = -1, maxMoves = N2 * 2 + 20) {
    let passes = 0, moves = 0;
    while (passes < 2 && moves < maxMoves) {
      let mv = -1;
      if (last >= 0 && rnd() < 0.8) { const t = tactical(color, last); if (t >= 0 && !isEye(t, color) && play(t, color) >= 0) mv = t; }
      if (mv < 0) mv = randomMove(color, rnd);
      if (mv < 0) { passes++; ko = -1; last = -1; } else { passes = 0; last = mv; }
      color = 3 - color; moves++;
    }
  }
  // area difference (black - white), optionally adding black ownership into own[]
  const mark = new Int32Array(N2); let mk = 0;
  function areaDiff(own) {
    let diff = 0; mk++;
    for (let i = 0; i < N2; i++) {
      const v = b[i];
      if (v) { diff += v === 1 ? 1 : -1; if (own && v === 1) own[i]++; continue; }
      if (mark[i] === mk) continue;
      let sp = 0, cnt = 0, touch = 0; stack[sp++] = i; mark[i] = mk; const reg = [];
      while (sp) {
        const s = stack[--sp]; cnt++; reg.push(s);
        for (let k = 0; k < 4; k++) { const j = NB[s * 4 + k]; if (j < 0) break; if (b[j] === 0) { if (mark[j] !== mk) { mark[j] = mk; stack[sp++] = j; } } else touch |= b[j]; }
      }
      if (touch === 1) { diff += cnt; if (own) for (const s of reg) own[s]++; } else if (touch === 2) diff -= cnt;
    }
    return diff;
  }
  return { n, N2, b, load, play, isEye, playout, areaDiff, randomMove, tactical, libs, get ko() { return ko; }, get lastLib() { return lastLib; }, get ne() { return ne; }, emp };
}
const sims = {};
export const simFor = (n) => (sims[n] ||= makeSim(n));

// ---- the Monte-Carlo thinker ----------------------------------------------------------------------------------
// createThinker(game, opts): opts = { sims, seed, banned:Set (root points not allowed by the full rules) , color }
// thinker.step(k) -> null while thinking, then { move, winrate, playouts, moves:[{mv, v, w}] }; move -1 = pass.
export function createThinker(g, opts) {
  const n = g.n, sim = simFor(n), N2 = n * n, color = opts.color ?? g.turn, rnd = makeRng(opts.seed ?? 1), komi = g.komi;
  const root = { mv: -1, parent: null, kids: [], untried: null, w: 0, v: 0, mover: opp(color), ko: g.ko };
  const rootB = Uint8Array.from(g.b), banned = opts.banned || new Set();
  let done = 0;
  const target = opts.sims;

  function legalList(color2) {
    const out = [];
    for (let k = 0; k < sim.ne; k++) { const p = sim.emp[k]; out.push(p); }
    const res = [];
    for (const p of out) {
      if (p === sim.ko || sim.isEye(p, color2)) continue;
      res.push(p);
    }
    return res;
  }
  // untried moves for a node whose position is currently loaded in sim, side to move = `side`
  function fillUntried(node, side) {
    const list = legalList(side).filter((p) => (node === root ? !banned.has(p) : true));
    // shuffle
    for (let i = list.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
    node.untried = list;
  }
  function one() {
    sim.load(rootB, g.ko);
    let node = root, side = color, last = g.last;
    if (!root.untried) fillUntried(root, color);
    // descend
    for (;;) {
      if (node.untried.length) break;
      if (!node.kids.length) break;                     // no moves: leaf
      let best = null, bs = -1;
      const lnN = Math.log(node.v + 1);
      for (const k of node.kids) {
        const s = k.w / k.v + 0.55 * Math.sqrt(lnN / k.v);
        if (s > bs) { bs = s; best = k; }
      }
      if (sim.play(best.mv, side) < 0) { node.kids.splice(node.kids.indexOf(best), 1); if (!node.kids.length && !node.untried.length) break; continue; }
      node = best; last = best.mv; side = opp(side);
    }
    // expand
    if (node.untried && node.untried.length) {
      let child = null;
      while (node.untried.length) {
        const p = node.untried.pop();
        if (sim.play(p, side) >= 0) { child = { mv: p, parent: node, kids: [], untried: null, w: 0, v: 0, mover: side }; break; }
      }
      if (child) { node.kids.push(child); node = child; last = child.mv; side = opp(side); fillUntried(child, side); }
    }
    sim.playout(side, rnd, last);
    const blackWins = sim.areaDiff() - komi > 0;
    for (let nd = node; nd; nd = nd.parent) { nd.v++; if (nd.mover === 1 ? blackWins : !blackWins) nd.w++; }
  }
  return {
    get done() { return done; },
    step(k) {
      for (let i = 0; i < k && done < target; i++) { one(); done++; }
      if (done < target) return null;
      return result();
    },
    result,
    progress: () => (target ? Math.min(1, done / target) : 1),
  };
  function result() {
    const kids = root.kids.slice().sort((a, b) => b.v - a.v);
    const moves = kids.map((k) => ({ mv: k.mv, v: k.v, w: k.w / Math.max(1, k.v) }));
    if (!kids.length) return { move: -1, winrate: 0.5, playouts: done, moves };
    return { move: kids[0].mv, winrate: kids[0].w / Math.max(1, kids[0].v), playouts: done, moves };
  }
}

// ---- the no-search player (level "Curious") and tactical scoring of a move ---------------------------------------
// Returns a move for the side to move: capture > rescue > atari > random near stones. Deterministic given rnd.
export function quickMove(g, rnd, banned = new Set()) {
  const n = g.n, N = nbs(n), me = g.turn, sim = simFor(n);
  const scored = [];
  for (let i = 0; i < n * n; i++) {
    if (g.b[i] || banned.has(i) || i === g.ko) continue;
    sim.load(g.b, g.ko); if (sim.isEye(i, me)) continue;
    let s = rnd() * 2;
    for (const j of N[i]) {
      if (!g.b[j]) continue;
      const gr = group(g.b, n, j);
      if (g.b[j] === me) { if (gr.libs.length === 1) s += 6; else s += 0.6; }
      else { if (gr.libs.length === 1) s += 9 + gr.stones.length; else if (gr.libs.length === 2) s += 2.5; else s += 0.6; }
    }
    // avoid filling our own last liberties
    const cap = sim.play(i, me);
    if (cap < 0) continue;
    if (cap === 0 && sim.libs(i, 3) === 1) s -= 8;
    const x = i % n, y = (i / n) | 0, m = Math.min(x, y, n - 1 - x, n - 1 - y);
    if (g.moves < n && m === 0) s -= 1.5;                    // opening: not on the very edge
    if (g.moves < n && m >= 2 && m <= 3) s += 1;
    scored.push([s, i]);
  }
  if (!scored.length) return -1;
  scored.sort((a, b) => b[0] - a[0]);
  return scored[0][1];
}

// ---- dead stones by ownership --------------------------------------------------------------------------------
// createScorer(g): time-sliced. step(k) -> null while working, then { dead:[points], own:Float32Array (black share 0..1) }.
export function createScorer(g, seed, total = 240) {
  const n = g.n, sim = simFor(n), rnd = makeRng(seed), own = new Int32Array(n * n), b = Uint8Array.from(g.b);
  let done = 0;
  return {
    get done() { return done; }, total,
    step(k) {
      for (let i = 0; i < k && done < total; i++) {
        sim.load(b, -1);
        sim.playout(done % 2 ? 1 : 2, rnd, -1);
        sim.areaDiff(own);
        done++;
      }
      if (done < total) return null;
      const share = new Float32Array(n * n);
      for (let i = 0; i < n * n; i++) share[i] = own[i] / total;
      const dead = [], seen = new Set();
      for (let i = 0; i < n * n; i++) {
        if (!g.b[i] || seen.has(i)) continue;
        const gr = group(g.b, n, i); gr.stones.forEach((s) => seen.add(s));
        let avg = 0; for (const s of gr.stones) avg += share[s]; avg /= gr.stones.length;
        const black = g.b[i] === 1;
        if (black ? avg < 0.25 : avg > 0.75) dead.push(...gr.stones);
      }
      return { dead, own: share };
    },
  };
}

// Why is this move good? A short honest reason for hints.
export function reasonFor(g, mv) {
  if (mv < 0) return 'Nothing useful is left to play: passing is fine here.';
  const n = g.n, me = g.turn, N = nbs(n);
  const before = g.b;
  const r = { b: before.slice() };
  const b = before.slice(); b[mv] = me;
  let caps = 0;
  for (const j of N[mv]) if (b[j] === opp(me)) { const gr = group(b, n, j); if (!gr.libs.length) { caps += gr.stones.length; gr.stones.forEach((s) => { b[s] = 0; }); } }
  if (caps) return caps === 1 ? 'This captures a stone.' : `This captures ${caps} stones.`;
  let saves = false, atari = false;
  for (const j of N[mv]) {
    if (before[j] === me && group(before, n, j).libs.length === 1) saves = true;
    if (before[j] === opp(me)) { const gr = group(b, n, j); if (gr.libs.length === 1) atari = true; }
  }
  if (saves) return 'This saves your group that was in atari.';
  if (atari) return 'This puts a group in atari: it threatens to capture next move.';
  let stones = 0; for (const c of before) if (c) stones++;
  const x = mv % n, y = (mv / n) | 0, m = Math.min(x, y, n - 1 - x, n - 1 - y);
  if (stones < n * 1.2 && m <= 3) return 'A good opening point: corners and sides are the easiest places to make territory.';
  for (const j of N[mv]) if (before[j] === me) return 'This strengthens your stones and builds territory.';
  for (const j of N[mv]) if (before[j] === opp(me)) return 'This presses on the opponent and takes space.';
  return 'This takes territory and keeps your stones connected to good points.';
}
export { hashBoard };
