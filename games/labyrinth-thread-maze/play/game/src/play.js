// One maze session: the lamp, the thread (a stack of cells), steps, hints and light. Plain JSON data + pure functions.
import { GRADES, DIRS, OPP, DX, DY, step, bfs, pathBetween, lightFrom, openCount, cellX, cellY, dirBetween, generate, N, E, S, W } from './maze.js';

export const MARGIN = 1;             // stone frame around the maze, in cells
const LOOK = 5;                      // how far ahead of the lamp the finger may point, in cells
const RADIUS = 0.3, SPACING = 0.22;  // thread corner radius and sample spacing, in cells

const cache = new Map();
function memo(key, f) { let v = cache.get(key); if (!v) { v = f(); cache.set(key, v); if (cache.size > 24) cache.delete(cache.keys().next().value); } return v; }
export const goalDist = (m) => memo(`gd${m.id}`, () => bfs(m, m.goal).dist);
export const routeOf = (m) => memo(`rt${m.id}`, () => pathBetween(m, m.start, m.goal));
export const centerOf = (m, i) => ({ x: cellX(m, i) + 0.5, y: cellY(m, i) + 0.5 });
export const spoolOf = (m) => { const c = centerOf(m, m.start); return { x: c.x + DX[m.door] * (0.5 + MARGIN * 0.55), y: c.y + DY[m.door] * (0.5 + MARGIN * 0.55) }; };

export function newSession({ seed, grade, kind = 'free', day = 0, maze = null }) {
  const m = maze ?? generate(seed, grade), n = m.cols * m.rows, c = centerOf(m, m.start);
  const P = {
    seed, grade, kind, day, maze: m, cell: m.start, stack: [m.start], q: [], qfree: false, x: c.x, y: c.y,
    walked: 0, hints: 0, t: 0, done: false, visited: new Array(n).fill(0), seen: new Array(n).fill(0), th: { o: [], v: [] }, steps: 0,
  };
  P.visited[m.start] = 1;
  reveal(P, m.start);
  return P;
}

export const torchOf = (P) => GRADES[P.grade].torch;
export const fogged = (P) => GRADES[P.grade].torch > 0;
function reveal(P, c) {
  const r = torchOf(P);
  if (!r) return;
  for (const [k] of lightFrom(P.maze, c, r)) P.seen[k] = 1;
}

// Point the lamp at a cell: it follows only along open corridors, at most LOOK cells beyond where it will be.
export function aim(P, target) {
  if (P.done || target < 0) return false;
  const m = P.maze, last = P.q.length ? P.q[P.q.length - 1] : P.cell;
  if (target === last) return false;
  const k = P.q.indexOf(target);
  if (k >= 0) { P.q.length = k + 1; return true; }
  if (target === P.cell) { P.q.length = 0; return true; }
  const path = pathBetween(m, last, target, LOOK);
  if (!path) return false;
  for (let i = 1; i < path.length; i++) P.q.push(path[i]);
  return true;
}
export function stepDir(P, d) {
  const last = P.q.length ? P.q[P.q.length - 1] : P.cell;
  if (!(P.maze.o[last] & d)) return false;
  const k = step(P.maze, last, d);
  if (P.q.length >= 3) return false;
  P.q.push(k);
  return true;
}

// Walk the thread back to the most recent fork (a cell with another way to go). Free: not counted as steps.
export function backToFork(P) {
  if (P.done) return false;
  const m = P.maze, st = P.stack;
  let i = st.length - 2;
  while (i > 0 && openCount(m, st[i]) < 3) i -= 1;
  if (i < 0 || st.length < 2) return false;
  P.q = []; for (let k = st.length - 2; k >= Math.max(0, i); k--) P.q.push(st[k]);
  P.qfree = true;
  return true;
}
export function rewindAll(P) {
  if (P.done || P.stack.length < 2) return false;
  P.q = P.stack.slice(0, -1).reverse(); P.qfree = true;
  return true;
}

// Advance the lamp by dt seconds. Returns events: { type: 'step' | 'fork' | 'dead' | 'win' | 'back', cell }.
export function advance(P, dt) {
  const ev = [], m = P.maze;
  let budget = dt * Math.min(18, (P.qfree ? 13 : 7.5) + 1.3 * P.q.length);
  for (let guard = 0; guard < 8 && budget > 0; guard++) {
    const tc = centerOf(m, P.q.length ? P.q[0] : P.cell), dx = tc.x - P.x, dy = tc.y - P.y, d = Math.hypot(dx, dy);
    if (d > budget) { P.x += (dx / d) * budget; P.y += (dy / d) * budget; budget = 0; break; }
    P.x = tc.x; P.y = tc.y; budget -= d;
    if (!P.q.length) break;
    const c = P.q.shift();
    const st = P.stack;
    if (st.length >= 2 && st[st.length - 2] === c) { st.pop(); ev.push({ type: 'back', cell: c }); }
    else { const at = st.indexOf(c); if (at >= 0) { st.length = at + 1; ev.push({ type: 'back', cell: c }); } else st.push(c); }
    P.cell = c; P.visited[c] = 1; P.steps += 1;
    if (!P.qfree) P.walked += 1;
    reveal(P, c);
    if (c === m.goal) { P.done = true; P.q = []; ev.push({ type: 'win', cell: c }); break; }
    const oc = openCount(m, c);
    if (oc >= 3) ev.push({ type: 'fork', cell: c }); else if (oc === 1 && c !== m.start) ev.push({ type: 'dead', cell: c });
    else ev.push({ type: 'step', cell: c });
  }
  if (!P.q.length) P.qfree = false;
  return ev;
}

// ---- thread geometry -----------------------------------------------------------------------------------------------------------------
// Polyline through the spool, the doorway, the cells of the thread and the lamp, corners rounded, resampled evenly.
export function threadPoints(m, cells, tip) {
  const pts = [spoolOf(m)];
  for (const c of cells) pts.push(centerOf(m, c));
  if (tip) { const l = pts[pts.length - 1]; if (Math.hypot(tip.x - l.x, tip.y - l.y) > 0.01) pts.push({ x: tip.x, y: tip.y }); }
  const sm = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1], ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y, lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    if (lu < 1e-6 || lv < 1e-6 || Math.abs(ux * vy - uy * vx) / (lu * lv) < 0.05) { sm.push(b); continue; }
    const r = Math.min(RADIUS, lu * 0.5, lv * 0.5), p0 = { x: b.x - (ux / lu) * r, y: b.y - (uy / lu) * r }, p1 = { x: b.x + (vx / lv) * r, y: b.y + (vy / lv) * r };
    for (let k = 0; k <= 5; k++) { const t = k / 5, s = 1 - t; sm.push({ x: s * s * p0.x + 2 * s * t * b.x + t * t * p1.x, y: s * s * p0.y + 2 * s * t * b.y + t * t * p1.y }); }
  }
  if (pts.length > 1) sm.push(pts[pts.length - 1]);
  const out = [{ x: sm[0].x, y: sm[0].y }];
  let carry = 0;
  for (let i = 1; i < sm.length; i++) {
    const a = sm[i - 1], b = sm[i], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-9) continue;
    let pos = SPACING - carry;
    while (pos <= len) { out.push({ x: a.x + ((b.x - a.x) * pos) / len, y: a.y + ((b.y - a.y) * pos) / len }); pos += SPACING; }
    carry = len - (pos - SPACING);
  }
  const last = sm[sm.length - 1], lo = out[out.length - 1];
  if (Math.hypot(last.x - lo.x, last.y - lo.y) > 0.02) out.push({ x: last.x, y: last.y });
  return out;
}
// The thread as it is laid right now (while retracing, the folded-back cell is not part of it).
export function threadOf(P) {
  const st = P.stack, back = P.q.length && st.length >= 2 && st[st.length - 2] === P.q[0];
  return threadPoints(P.maze, back ? st.slice(0, -1) : st, { x: P.x, y: P.y });
}

// A damped spring chain gives the thread a little life: it wobbles sideways when the lamp moves and settles when it stops.
export function relaxThread(P, dt, moving) {
  const pts = threadOf(P), n = pts.length, th = P.th;
  while (th.o.length < n) { th.o.push(0); th.v.push(0); }
  th.o.length = n; th.v.length = n;
  const o = th.o, v = th.v, k = 60, c = 40, damp = Math.pow(0.012, dt), lim = 0.15;
  if (moving && n > 2) v[n - 1] += Math.sin(P.steps * 2.1 + n * 0.7) * 0.9 * dt * 12;
  for (let i = 1; i < n; i++) {
    const a = i + 1 < n ? o[i + 1] : o[i];
    v[i] += (-k * o[i] + c * (o[i - 1] + a - 2 * o[i])) * dt;
    v[i] *= damp;
  }
  for (let i = 1; i < n; i++) { o[i] += v[i] * dt; if (o[i] > lim) { o[i] = lim; v[i] = 0; } else if (o[i] < -lim) { o[i] = -lim; v[i] = 0; } }
  o[0] = 0;
}

// ---- hints ---------------------------------------------------------------------------------------------------------------------------------
// The way on from where the lamp is (or will be): shortest path to the heart.
export function wayOn(P) { const from = P.q.length ? P.q[P.q.length - 1] : P.cell; return pathBetween(P.maze, from, P.maze.goal) ?? [from]; }
export function hintLook(P) {
  const m = P.maze, way = wayOn(P), from = way[0], prev = P.stack.length >= 2 ? P.stack[P.stack.length - 2] : -1;
  const lost = prev >= 0 && way[1] === prev;
  let k = 0;
  for (let i = 1; i < way.length; i++) if (way[i] === m.goal || openCount(m, way[i]) >= 3) { k = i; break; }
  const jf = way[k], branches = openCount(m, jf) - 1;
  let text;
  if (from === m.goal) text = 'You are at the heart.';
  else if (lost && P.stack.length > 1) text = `This passage does not lead on. The way to the heart is back the way you came${k ? `, ${k} ${k === 1 ? 'cell' : 'cells'} to the fork` : ''}.`;
  else if (jf === m.goal) text = `No more forks: the heart is ${way.length - 1} ${way.length === 2 ? 'cell' : 'cells'} ahead. Follow the corridor.`;
  else text = `The next fork is ${k} ${k === 1 ? 'cell' : 'cells'} ahead and it has ${branches} ways on. Not every branch reaches the heart.`;
  return { text, fork: jf, lost };
}
export function hintShow(P, n = 12) { return wayOn(P).slice(0, n + 1); }

// ---- result ------------------------------------------------------------------------------------------------------------------------------------
export function starsFor(P) {
  const opt = Math.max(1, P.maze.opt), ratio = P.walked / opt, fog = fogged(P);
  let s = ratio <= (fog ? 3.5 : 2.2) ? 3 : ratio <= (fog ? 6 : 4) ? 2 : 1;
  if (P.hints >= 3) s -= 1;
  return Math.max(1, s);
}
export const fmtTime = (t) => { const s = Math.floor(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export { N, E, S, W, DIRS, OPP, dirBetween };
