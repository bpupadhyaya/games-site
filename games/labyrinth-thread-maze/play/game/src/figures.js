// Pictures for the Rules, How to Play and About pages. They are drawn by the game's own maze renderer (scene.js)
// on small REAL generated mazes, so a player sees exactly the art of the board.
import { generate, GRADES, lightFrom, describeFork, openCount, exits, step as mstep, DIRS, S, OPP, bfs } from './maze.js';
import { routeOf, goalDist, threadPoints, centerOf } from './play.js';
import { makeView, drawMaze, fitCam } from './scene.js';
import { theme, rr, txt, F } from './ui.js';

const memo = new Map();
const once = (k, f) => { let v = memo.get(k); if (!v) { v = f(); memo.set(k, v); } return v; };
const base = () => once('base', () => generate(3, 1));

// A route prefix that ends in a dead-end side branch: the picture of "wind the thread back".
function detour() {
  return once('detour', () => {
    const m = base(), route = routeOf(m), gd = goalDist(m);
    for (let i = 1; i < route.length - 1; i++) {
      if (openCount(m, route[i]) < 3) continue;
      const rows = describeFork(m, route[i], route[i - 1], gd).filter((r) => r.kind === 'dead' && r.size >= 2);
      if (!rows.length) continue;
      const cells = route.slice(0, i + 1);
      let prev = route[i], cur = rows[0].cell;
      for (let g = 0; g < 12; g++) { cells.push(cur); const nx = exits(m, cur).filter((k) => k !== prev); if (!nx.length) break; prev = cur; cur = nx[0]; }
      return { m, cells, fork: route[i] };
    }
    return { m, cells: route.slice(0, 7), fork: route[6] };
  });
}
function loopMaze() {
  return once('loop', () => {
    const m = generate(9, 1), route = routeOf(m);
    let best = null;
    for (let c = 0; c < m.cols * m.rows && !best; c++) for (const d of [2, 4]) {
      const k = mstep(m, c, d);
      if (k < 0 || (m.o[c] & d)) continue;
      const { dist } = bfs(m, c);
      if (dist[k] >= 9) best = { c, d, k };
    }
    if (best) { m.o[best.c] |= best.d; m.o[best.k] |= OPP[best.d]; }
    m.opt = routeOf({ ...m, id: m.id + 'L' }).length - 1;
    return m;
  });
}

function fit(rect) { const s = Math.min(rect.w, rect.h); return { x: rect.x + (rect.w - s) / 2, y: rect.y + (rect.h - s) / 2, w: s, h: s }; }

export function drawFigure(ctx, rect, id, t) {
  const T = theme(), r = fit(rect);
  if (id === 'grades') return drawGrades(ctx, rect, t);
  let m = base(), V;
  const route = routeOf(m);
  const lampAt = (i) => centerOf(m, route[i]);
  if (id === 'hero' || id === 'maze') V = makeView(m, { lamp: centerOf(m, m.start), t });
  else if (id === 'thread') { const k = Math.min(9, route.length - 2), cells = route.slice(0, k + 1); V = makeView(m, { thread: threadPoints(m, cells, lampAt(k)), lamp: lampAt(k), visited: cells.reduce((a, c) => { a[c] = 1; return a; }, new Array(m.cols * m.rows).fill(0)), t }); }
  else if (id === 'retrace') {
    const d = detour(); m = d.m; const last = d.cells[d.cells.length - 1];
    V = makeView(m, { thread: threadPoints(m, d.cells, centerOf(m, last)), lamp: centerOf(m, last), look: d.fork, t });
  } else if (id === 'fork') {
    const d = detour(); m = d.m; const rt = routeOf(m), i = rt.indexOf(d.fork);
    V = makeView(m, { thread: threadPoints(m, rt.slice(0, i + 1), centerOf(m, d.fork)), lamp: centerOf(m, d.fork), look: d.fork, hint: rt.slice(i, i + 5), hintA: 0.9, t });
  } else if (id === 'hint') {
    const k = 3; V = makeView(m, { thread: threadPoints(m, route.slice(0, k + 1), lampAt(k)), lamp: lampAt(k), hint: route.slice(k, Math.min(route.length, k + 13)), hintA: 1, t });
  } else if (id === 'loop') {
    m = loopMaze(); V = makeView(m, { lamp: centerOf(m, m.start), route: routeOf({ ...m, id: m.id + 'L' }), t });
  } else if (id === 'fog') {
    const k = Math.min(10, route.length - 3), seen = new Array(m.cols * m.rows).fill(0);
    for (let i = 0; i <= k; i++) for (const [c] of lightFrom(m, route[i], 3)) seen[c] = 1;
    const light = new Map([...lightFrom(m, route[k], 3)].map(([c, d]) => [c, 1 - d / 3.4]));
    V = makeView(m, { thread: threadPoints(m, route.slice(0, k + 1), lampAt(k)), lamp: lampAt(k), seen, light, torch: 3, t });
  } else V = makeView(m, { lamp: centerOf(m, m.start), t });
  V.cam = fitCam(m);
  drawMaze(ctx, r, V);
}

function drawGrades(ctx, rect, t) {
  const T = theme(), cols = rect.w > rect.h * 1.3 ? 3 : 2, rows = Math.ceil(6 / cols), gap = 14;
  const cw = (rect.w - gap * (cols - 1)) / cols, ch = (rect.h - gap * (rows - 1)) / rows, s = Math.min(cw, ch - 30);
  for (let g = 1; g <= 6; g++) {
    const c = (g - 1) % cols, rw = Math.floor((g - 1) / cols), x = rect.x + c * (cw + gap) + (cw - s) / 2, y = rect.y + rw * (ch + gap);
    const m = once('g' + g, () => generate(40 + g, g));
    const V = makeView(m, { lamp: centerOf(m, m.start), t, night: 0.3 });
    V.cam = fitCam(m);
    drawMaze(ctx, { x, y, w: s, h: s }, V);
    txt(ctx, `${g}  ${GRADES[g].name}`, x + s / 2, y + s + 16, { size: F(22), weight: 600, color: T.text, align: 'center', maxW: cw, min: 12 });
  }
}
