// One puzzle in play: the blocks, dragging, tap-to-move, hints, undo, animation and particles.
// Pure state + maths (no drawing). Positions are in cell units; the screen maps them with CELL.
import { parseLayout, reachable, allMoves, applyMove, isSolved, solve, bestMove, keyOf, DIMS, COLS, ROWS, GATE } from './engine.js';
import { CELL, BOARD_ORIGIN } from './layout.js';

export const SLOT = 0.2;          // seconds a block takes to slide one cell when the game moves it
const SEG = 0.085;
export const TAP_SLOP = 16;       // px a finger may wander and still count as a tap
export const FOLLOW = 0.42;       // how far (in cells) a held block may trail its finger beyond the snapped cell

const NAMES = [
  { zh: '关羽', en: 'Guan Yu' }, { zh: '张飞', en: 'Zhang Fei' }, { zh: '赵云', en: 'Zhao Yun' },
  { zh: '马超', en: 'Ma Chao' }, { zh: '黄忠', en: 'Huang Zhong' },
];
export const COMMANDER = { zh: '曹操', en: 'Cao Cao' };
export const SOLDIER = { zh: '卒', en: 'Soldier' };

export function nameBlocks(pieces) {
  // Commander is Cao Cao; the five generals take their names in board order, Guan Yu going to the first
  // horizontal block when there is one; soldiers are soldiers.
  const gens = pieces.filter((p) => p.t === 'V' || p.t === 'H');
  const firstH = gens.find((p) => p.t === 'H');
  const rest = gens.filter((p) => p !== firstH);
  const order = firstH ? [firstH, ...rest] : rest;
  const label = new Map();
  order.forEach((p, i) => label.set(p.id, NAMES[i % NAMES.length]));
  return label;
}

export function createPuzzle(level, rng) {
  const pieces = parseLayout(level.rows).map((p) => ({
    ...p, dx: p.x, dy: p.y, anim: null, pop: 0, lift: 0, glow: 0, tint: 0,
  }));
  const names = nameBlocks(pieces);
  for (const p of pieces) p.name = p.t === 'C' ? COMMANDER : p.t === 'S' ? SOLDIER : names.get(p.id);
  return {
    level, pieces, moves: 0, history: [], hints: 0, hint: null, selected: -1, drag: null, done: false, doneT: 0, stars: 0,
    parts: [], events: [], t: 0, sol: null, glide: false, exit: 0, order: pieces.map((p) => p.id), shake: 0, bumped: null,
    rngSeed: rng ? rng.int(1e9) : 0,
  };
}

const logical = (puz) => puz.pieces.map((p) => ({ id: p.id, t: p.t, x: p.x, y: p.y }));
export const ensureSol = (puz) => { if (!puz.sol) puz.sol = solve(logical(puz)); return puz.sol; };

// ---- geometry -----------------------------------------------------------------------------------------
export const cellToPx = (cx, cy) => [BOARD_ORIGIN.x + cx * CELL, BOARD_ORIGIN.y + cy * CELL];
export const pxToCell = (x, y) => [(x - BOARD_ORIGIN.x) / CELL, (y - BOARD_ORIGIN.y) / CELL];
export const rectOf = (p) => {
  const [w, h] = DIMS[p.t];
  const [x, y] = cellToPx(p.dx, p.dy);
  return { x, y, w: w * CELL, h: h * CELL };
};
const hitPiece = (puz, x, y) => {
  // topmost first: the held block is drawn last
  for (let i = puz.order.length - 1; i >= 0; i--) {
    const p = puz.pieces[puz.order[i]];
    const r = rectOf(p);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return p;
  }
  return null;
};

export function movesFor(puz, id) {
  return reachable(logical(puz), id);
}

// ---- events / particles ---------------------------------------------------------------------------------
export function burst(puz, x, y, rng, n, colors, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), s = rng.range(opts.min ?? 60, opts.max ?? 260);
    puz.parts.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up ?? 80), life: rng.range(0.4, opts.life ?? 1.1), max: opts.life ?? 1.1,
      size: rng.range(opts.size0 ?? 3, opts.size1 ?? 7), color: rng.pick(colors), g: opts.g ?? 520, drag: opts.drag ?? 1.2,
      shape: opts.shape ?? 'dot', rot: rng.range(0, 6), spin: rng.range(-8, 8),
    });
  }
}

// ---- committing a move ------------------------------------------------------------------------------------
function commit(puz, p, x, y, path, how) {
  const fromX = p.x, fromY = p.y;
  puz.history.push({ id: p.id, fromX, fromY, toX: x, toY: y });
  puz.moves += 1;
  p.x = x; p.y = y;
  if (how === 'drag') { p.anim = null; } else if (path && path.length > 1) p.anim = { cells: path.map(([cx, cy]) => [cx, cy]), t: 0, from: [p.dx, p.dy] };
  puz.events.push({ type: 'move', id: p.id, how, dist: path ? path.length - 1 : 1 });
  puz.hint = null;
  afterMove(puz);
}

function afterMove(puz) {
  if (isSolved(logical(puz)) && !puz.done) {
    puz.done = true; puz.doneT = 0; puz.selected = -1; puz.drag = null;
    puz.stars = starsFor(puz);
    puz.events.push({ type: 'win' });
  }
}

// Stars: 3 for finishing within a quarter more than the minimum with no Think presses, 2 within double
// the minimum (or three stars lost to a Think), 1 otherwise.
export function starsFor(puz) {
  const min = puz.level.min, m = puz.moves;
  let s = m <= Math.ceil(min * 1.25) ? 3 : m <= min * 2 ? 2 : 1;
  if (puz.hints > 0) s = Math.min(s, 2);
  return s;
}

export function slideTo(puz, id, x, y) {
  const p = puz.pieces[id];
  if (!p || puz.done) return false;
  const found = reachable(logical(puz), id).find((r) => r.x === x && r.y === y);
  if (!found) return false;
  p.anim = null;
  commit(puz, p, x, y, found.path, 'tap');
  return true;
}

// One step in a direction for the selected block (keyboard).
export function nudge(puz, dx, dy) {
  const p = puz.pieces[puz.selected];
  if (!p || puz.done || puz.drag) return false;
  return slideTo(puz, p.id, p.x + dx, p.y + dy);
}

// ---- pointer ----------------------------------------------------------------------------------------------
export function pointerDown(puz, x, y) {
  if (puz.done) return false;
  puz.bumped = null;
  const p = hitPiece(puz, x, y);
  if (!p) {
    // a tap on a ghost destination of the selected block moves it there
    if (puz.selected >= 0) {
      const sel = puz.pieces[puz.selected];
      const [cx, cy] = pxToCell(x, y);
      const dest = movesFor(puz, sel.id).find((r) => {
        const [w, h] = DIMS[sel.t];
        return cx >= r.x && cx < r.x + w && cy >= r.y && cy < r.y + h;
      });
      if (dest) { slideTo(puz, sel.id, dest.x, dest.y); return false; }
      puz.selected = -1;
    }
    return false;
  }
  p.anim = null;
  const reach = movesFor(puz, p.id);
  const cells = [{ x: p.x, y: p.y, path: [[p.x, p.y]] }, ...reach];
  puz.drag = { id: p.id, sx: x, sy: y, ox: x - rectOf(p).x, oy: y - rectOf(p).y, cells, cur: cells[0], moved: false, wasSelected: puz.selected === p.id };
  puz.order = puz.order.filter((i) => i !== p.id).concat(p.id);
  puz.events.push({ type: 'lift', id: p.id });
  if (!reach.length) puz.bumped = p.id;
  return true;
}

export function pointerMove(puz, x, y) {
  const d = puz.drag;
  if (!d) return;
  const p = puz.pieces[d.id];
  if (!d.moved && Math.hypot(x - d.sx, y - d.sy) > TAP_SLOP) d.moved = true;
  if (!d.moved) return;
  // where the top-left corner of the block wants to be, in cell units
  const [wx, wy] = pxToCell(x - d.ox, y - d.oy);
  // the reachable cell closest to that spot (the block's own cell counts)
  let best = d.cells[0], bd = Infinity;
  for (const c of d.cells) {
    const dd = (c.x - wx) ** 2 + (c.y - wy) ** 2;
    if (dd < bd - 1e-9 || (dd < bd + 1e-9 && c === d.cur)) { bd = dd; best = c; }
  }
  // hysteresis: keep the current cell until another is clearly nearer, so the block never flickers
  const cd = (d.cur.x - wx) ** 2 + (d.cur.y - wy) ** 2;
  if (best !== d.cur && cd - bd < 0.06) best = d.cur;
  if (best !== d.cur) { d.cur = best; puz.events.push({ type: 'step', id: p.id }); }
  // the block rides near the snapped cell but trails toward the finger a little, so it feels held
  const fx = Math.max(-FOLLOW, Math.min(FOLLOW, wx - d.cur.x)), fy = Math.max(-FOLLOW, Math.min(FOLLOW, wy - d.cur.y));
  d.fx = fx * 0.55; d.fy = fy * 0.55;
  p.pending = d.cur;
}

export function pointerUp(puz, x, y) {
  const d = puz.drag;
  puz.drag = null;
  if (!d) return;
  const p = puz.pieces[d.id];
  p.pending = null;
  if (!d.moved) {
    // a tap: select or deselect; selecting shows where the block can go
    if (puz.selected === p.id) puz.selected = -1; else puz.selected = p.id;
    puz.events.push({ type: 'select', id: p.id, bump: puz.bumped === p.id });
    if (puz.bumped === p.id) { p.shake = 0.35; }
    return;
  }
  if (d.cur.x === p.x && d.cur.y === p.y) {
    puz.events.push({ type: 'drop', id: p.id, moved: false });
    return;
  }
  puz.selected = -1;
  commit(puz, p, d.cur.x, d.cur.y, d.cur.path, 'drag');
}

// Put a saved run back: replays the moves instantly (each one must still be legal, otherwise it stops there).
export function restoreRun(puz, hist, hints) {
  for (const [id, x, y] of hist) {
    const p = puz.pieces[id];
    if (!p || !reachable(logical(puz), id).some((r) => r.x === x && r.y === y)) break;
    puz.history.push({ id, fromX: p.x, fromY: p.y, toX: x, toY: y });
    p.x = x; p.y = y; p.dx = x; p.dy = y;
    puz.moves += 1;
  }
  puz.hints = Math.max(0, Math.min(99, Number(hints) || 0));
  if (isSolved(logical(puz))) { puz.history.length = 0; puz.moves = 0; for (const p of puz.pieces) { const o = parseLayout(puz.level.rows)[p.id]; p.x = o.x; p.y = o.y; p.dx = o.x; p.dy = o.y; } }
}

// ---- undo / hint ------------------------------------------------------------------------------------------
export function undo(puz) {
  if (puz.done || !puz.history.length || puz.drag) return false;
  const h = puz.history.pop();
  const p = puz.pieces[h.id];
  const cur = logical(puz);
  const back = reachable(cur, h.id).find((r) => r.x === h.fromX && r.y === h.fromY);
  p.anim = back && back.path.length > 1 ? { cells: back.path, t: 0, from: [p.dx, p.dy] } : null;
  p.x = h.fromX; p.y = h.fromY;
  puz.moves = Math.max(0, puz.moves - 1);
  puz.hint = null; puz.selected = -1;
  puz.events.push({ type: 'undo', id: p.id });
  return true;
}

export function requestHint(puz) {
  if (puz.done || puz.drag) return null;
  const sol = ensureSol(puz);
  const m = bestMove(logical(puz), sol);
  if (!m) return null;
  if (puz.hint && puz.hint.id === m.id && puz.hint.x === m.x && puz.hint.y === m.y) {
    // second press: make the move for the player
    puz.hints += 1;
    const p = puz.pieces[m.id];
    puz.hint = null;
    commit(puz, p, m.x, m.y, m.path, 'hint');
    return m;
  }
  puz.hint = { id: m.id, x: m.x, y: m.y, left: m.left, t: 0, path: m.path };
  puz.selected = -1;
  puz.hints += 1;
  puz.events.push({ type: 'hint', id: m.id });
  return m;
}

// The solver's next move for Watch & Learn (does not touch hints or the move counter).
export function nextAutoMove(puz) {
  return bestMove(logical(puz), ensureSol(puz));
}

export function autoSlide(puz, move) {
  const p = puz.pieces[move.id];
  puz.hint = null; puz.selected = -1;
  commit(puz, p, move.x, move.y, move.path, 'auto');
}

export function movablePieces(puz) {
  const l = logical(puz);
  return puz.pieces.filter((p) => reachable(l, p.id).length > 0).map((p) => p.id);
}

export function selectNext(puz) {
  if (puz.done) return;
  const n = puz.pieces.length;
  for (let k = 1; k <= n; k++) {
    const id = (puz.selected + k + n) % n;
    if (reachable(logical(puz), id).length) { puz.selected = id; return; }
  }
}

// A held block slides along the real route to the cell it is over (around corners, never through other
// blocks), then trails toward the finger a little so it feels held.
function pointAt(path, s) {
  if (path.length === 1) return [path[0][0], path[0][1]];
  const i = Math.max(0, Math.min(path.length - 2, Math.floor(s))), u = Math.max(0, Math.min(1, s - i));
  return [path[i][0] + (path[i + 1][0] - path[i][0]) * u, path[i][1] + (path[i + 1][1] - path[i][1]) * u];
}
function followPath(d, p, dt) {
  const path = d.cur.path;
  if (d.routed !== d.cur) {
    let best = Infinity, bs = 0, bo = [0, 0];
    if (path.length === 1) { best = 0; bs = 0; bo = [p.dx - path[0][0], p.dy - path[0][1]]; }
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i], b = path[i + 1];
      const t = Math.max(0, Math.min(1, (p.dx - a[0]) * (b[0] - a[0]) + (p.dy - a[1]) * (b[1] - a[1])));
      const qx = a[0] + (b[0] - a[0]) * t, qy = a[1] + (b[1] - a[1]) * t;
      const dd = (p.dx - qx) ** 2 + (p.dy - qy) ** 2;
      if (dd < best) { best = dd; bs = i + t; bo = [p.dx - qx, p.dy - qy]; }
    }
    d.s = bs; d.off = bo; d.routed = d.cur;
  }
  const goal = path.length - 1, ds = 15 * dt;
  d.s = Math.abs(goal - d.s) <= ds ? goal : d.s + Math.sign(goal - d.s) * ds;
  const k = Math.exp(-dt * 14);
  d.off[0] *= k; d.off[1] *= k;
  d.fxs = (d.fxs ?? 0) + ((d.fx ?? 0) - (d.fxs ?? 0)) * (1 - Math.exp(-dt * 20));
  d.fys = (d.fys ?? 0) + ((d.fy ?? 0) - (d.fys ?? 0)) * (1 - Math.exp(-dt * 20));
  const [x, y] = pointAt(path, d.s);
  p.dx = x + d.off[0] + d.fxs * (d.s === goal ? 1 : 0);
  p.dy = y + d.off[1] + d.fys * (d.s === goal ? 1 : 0);
}

// ---- time -------------------------------------------------------------------------------------------------
export function isSettled(puz) {
  return puz.pieces.every((p) => !p.anim && Math.abs(p.x - p.dx) < 0.01 && Math.abs(p.y - p.dy) < 0.01);
}

export function updatePuzzle(puz, dt) {
  puz.t += dt;
  const dragId = puz.drag && puz.drag.moved ? puz.drag.id : -1;
  for (const p of puz.pieces) {
    if (p.id === dragId) {
      followPath(puz.drag, p, dt);
      p.lift = Math.min(1, p.lift + dt * 10);
    } else if (p.anim) {
      const a = p.anim;
      a.t += dt;
      const n = a.cells.length - 1;
      const f = Math.min(n, a.t / SEG);
      const i = Math.min(n - 1, Math.floor(f)), u = f - i;
      const e = u * u * (3 - 2 * u) * 0.35 + u * 0.65; // nearly linear, softened at the joins
      const c0 = a.cells[i], c1 = a.cells[i + 1];
      p.dx = c0[0] + (c1[0] - c0[0]) * e; p.dy = c0[1] + (c1[1] - c0[1]) * e;
      p.lift = Math.min(1, p.lift + dt * 12);
      if (f >= n) { p.anim = null; p.dx = p.x; p.dy = p.y; p.pop = 1; puz.events.push({ type: 'land', id: p.id }); }
    } else {
      const k = 1 - Math.exp(-dt * 26);
      const wasAway = Math.abs(p.x - p.dx) + Math.abs(p.y - p.dy) > 0.06;
      p.dx += (p.x - p.dx) * k; p.dy += (p.y - p.dy) * k;
      if (Math.abs(p.x - p.dx) < 0.004) p.dx = p.x;
      if (Math.abs(p.y - p.dy) < 0.004) p.dy = p.y;
      if (wasAway && p.dx === p.x && p.dy === p.y) { p.pop = 1; puz.events.push({ type: 'land', id: p.id }); }
      p.lift = Math.max(0, p.lift - dt * 6);
    }
    if (p.pop > 0) p.pop = Math.max(0, p.pop - dt * 4);
    if (p.shake > 0) p.shake = Math.max(0, p.shake - dt);
  }
  if (puz.hint) puz.hint.t += dt;
  if (puz.done) {
    puz.doneT += dt;
    // the Commander walks out through the gate
    const c = puz.pieces.find((q) => q.t === 'C');
    if (c && puz.doneT > 0.45) puz.exit = Math.min(1, (puz.doneT - 0.45) / 0.9);
  }
  for (const q of puz.parts) {
    q.life -= dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vy += (q.g ?? 600) * dt;
    q.vx *= Math.exp(-dt * (q.drag ?? 0.8));
    q.rot = (q.rot ?? 0) + (q.spin ?? 0) * dt;
  }
  puz.parts = puz.parts.filter((q) => q.life > 0);
}

export { keyOf, allMoves, applyMove, COLS, ROWS, GATE, DIMS };
