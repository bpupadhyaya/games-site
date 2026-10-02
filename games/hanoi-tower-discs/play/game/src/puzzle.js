// One puzzle in play: the logical position (pegs, history) plus the animated discs. Logic changes the instant a
// move is committed; the discs then glide there (raise, slide, fall) on their own springs, so rapid taps, undo
// mid-flight and Watch & Learn all use the same path. Everything advances with dt only.
import { levelStart, levelMin, stars as starsFor } from './levels.js';
import { legalMoves, bestMove, isSolved, topOf, movesLeft } from './solver.js';
import { ryOf } from './art.js';

export const SCENE = { baseY: 1190, top: 330 };
export const DRAG_SLOP = 16;
export const DRAG_LIFT = 70;

export function geometry(n, P) {
  const spacing = P === 3 ? 230 : 176;
  const x0 = 360 - (spacing * (P - 1)) / 2;
  const pegX = Array.from({ length: P }, (_, i) => x0 + i * spacing);
  const maxW = spacing - 16;
  const minW = P === 3 ? 66 : 54;
  const sh = Math.min(72, Math.floor(580 / n));
  const w = (d) => (n === 1 ? maxW : minW + ((maxW - minW) * d) / (n - 1));
  const len = Math.max(n * sh + 170, 470);
  const rodR = P === 3 ? 11 : 9;
  // short towers sit a little higher so the scene stays centred between the stat chips and the toolbar
  const baseY = SCENE.baseY - Math.round(Math.max(0, 780 - (len + 100)) * 0.5);
  return { spacing, pegX, w, sh, len, rodR, baseY, pegTop: baseY - len, hoverY: baseY - len - 54 };
}

export function createPuzzle(level, rng, opts = {}) {
  const g = geometry(level.n, level.P);
  const start = levelStart(level);
  const puz = {
    level, n: level.n, P: level.P, goal: level.goal, g,
    pegOf: [...start], history: [], moves: 0, min: levelMin(level), start,
    discs: [], parts: [], events: [], sel: -1, ptr: null, hint: null,
    done: false, doneT: 0, stars: 0, flash: null, shake: [0, 0, 0, 0], t: 0, rng,
  };
  for (let d = 0; d < puz.n; d++) {
    const s = seat(puz, d);
    puz.discs.push({ id: d, x: s.x, y: s.y, vx: 0, vy: 0, mode: 'rest', dst: puz.pegOf[d], sqAmp: 0, sqT: 9, bob: 0 });
  }
  if (opts.history) for (const [a, b] of opts.history) commit(puz, a, b, true);
  return puz;
}

// Discs on a peg, bottom to top (largest first).
export const stackOf = (puz, peg) => {
  const out = [];
  for (let d = puz.n - 1; d >= 0; d--) if (puz.pegOf[d] === peg) out.push(d);
  return out;
};

export function seat(puz, d) {
  const peg = puz.pegOf[d];
  const k = stackOf(puz, peg).indexOf(d);
  return { x: puz.g.pegX[peg], y: puz.g.baseY - k * puz.g.sh };
}

export const topDisc = (puz, peg) => topOf(puz.pegOf, peg);
export const canMove = (puz, a, b) => {
  const ta = topDisc(puz, a), tb = topDisc(puz, b);
  return a !== b && ta >= 0 && (tb < 0 || ta < tb);
};

function spawn(puz, x, y, n, colors, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = puz.rng.range(0, Math.PI * 2), sp = puz.rng.range(o.min ?? 40, o.max ?? 180);
    puz.parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - (o.up ?? 40), g: o.g ?? 260, size: puz.rng.range(o.size0 ?? 2, o.size1 ?? 4.5),
      life: o.life ?? 0.6, max: o.life ?? 0.6, color: colors[i % colors.length], shape: o.shape ?? 'dot', rot: 0,
    });
  }
}
export const burst = spawn;

// Commit a move (logic + start the disc's travel). Returns false if illegal.
export function commit(puz, a, b, silent = false) {
  if (!canMove(puz, a, b)) return false;
  const d = topDisc(puz, a);
  puz.pegOf[d] = b;
  puz.history.push([a, b]);
  puz.moves = puz.history.length;
  puz.hint = null;
  const dsc = puz.discs[d];
  dsc.dst = b;
  if (silent) { const s = seat(puz, d); Object.assign(dsc, { x: s.x, y: s.y, vx: 0, vy: 0, mode: 'rest' }); }
  else { dsc.mode = 'raise'; puz.events.push({ type: 'move', d, from: a, to: b }); }
  checkDone(puz);
  return true;
}

function checkDone(puz) {
  if (!puz.done && isSolved(puz.pegOf, puz.goal)) {
    puz.done = true; puz.doneT = 0;
    puz.stars = starsFor(puz.moves, puz.min);
    puz.events.push({ type: 'solved' });
  }
}

export function undo(puz) {
  if (puz.done || !puz.history.length) return false;
  cancelHold(puz);
  const [a, b] = puz.history.pop();
  const d = topDisc(puz, b);
  puz.pegOf[d] = a;
  puz.moves = puz.history.length;
  puz.hint = null;
  const dsc = puz.discs[d];
  dsc.dst = a; dsc.mode = 'raise';
  puz.events.push({ type: 'undo', d });
  return true;
}

export function restart(puz) {
  cancelHold(puz);
  puz.pegOf = [...puz.start]; puz.history = []; puz.moves = 0; puz.hint = null; puz.done = false; puz.doneT = 0; puz.stars = 0;
  for (const dsc of puz.discs) { dsc.dst = puz.pegOf[dsc.id]; dsc.mode = 'raise'; }
  puz.events.push({ type: 'undo' });
}

export function think(puz) {
  if (puz.done) return null;
  const mv = bestMove([...puz.pegOf], puz.P, puz.goal);
  if (!mv) return null;
  puz.hint = { from: mv[0], to: mv[1], disc: topDisc(puz, mv[0]), t: 0 };
  puz.events.push({ type: 'think' });
  return puz.hint;
}

// ---------------------------------------------------------------------------------------------- input
export function pegAt(puz, x, y, loose = false) {
  if (!loose && (y < puz.g.pegTop - 120 || y > puz.g.baseY + 150)) return -1;
  let best = -1, bd = Infinity;
  puz.g.pegX.forEach((px, i) => { const d = Math.abs(px - x); if (d < bd) { bd = d; best = i; } });
  return bd <= puz.g.spacing / 2 + 4 ? best : -1;
}

function cancelHold(puz) {
  if (puz.sel >= 0) { const d = topDisc(puz, puz.sel); if (d >= 0) { const dsc = puz.discs[d]; dsc.dst = puz.sel; dsc.mode = 'raise'; } }
  puz.sel = -1; puz.ptr = null;
}

function holdFlash(puz, peg) { puz.flash = { peg, t: 0 }; }

function attempt(puz, a, b) {
  if (a === b) { cancelHold(puz); return; }
  if (canMove(puz, a, b)) { puz.sel = -1; commit(puz, a, b); return; }
  // refused: the disc goes back where it came from
  puz.events.push({ type: 'refuse', peg: b });
  puz.shake[b] = 0.4;
  puz.wiggleDisc = topDisc(puz, a);
  holdFlash(puz, b);
  puz.refused = { t: 2.4, peg: b };
  const d = topDisc(puz, a);
  if (d >= 0) { puz.discs[d].dst = a; puz.discs[d].mode = 'raise'; }
  puz.sel = -1;
}

export function pointerDown(puz, x, y) {
  if (puz.done) return false;
  const peg = pegAt(puz, x, y);
  if (puz.sel >= 0) { puz.ptr = { kind: 'target', peg, x0: x, y0: y }; return peg >= 0; }
  if (peg < 0 || topDisc(puz, peg) < 0) { puz.ptr = null; return false; }
  const d = topDisc(puz, peg);
  puz.hint = null;
  puz.discs[d].mode = 'lift'; puz.discs[d].dst = peg;
  puz.ptr = { kind: 'src', peg, x0: x, y0: y, dragging: false, disc: d };
  puz.events.push({ type: 'lift', d });
  return true;
}

export function pointerMove(puz, x, y) {
  const p = puz.ptr;
  if (!p || p.kind !== 'src') return;
  if (!p.dragging && Math.hypot(x - p.x0, y - p.y0) > DRAG_SLOP) { p.dragging = true; puz.discs[p.disc].mode = 'drag'; }
  if (p.dragging) p.fx = x, p.fy = y;
}

export function pointerUp(puz, x, y) {
  const p = puz.ptr;
  puz.ptr = null;
  if (!p) return;
  if (p.kind === 'target') {
    const peg = pegAt(puz, x, y);
    if (peg < 0) cancelHold(puz); else attempt(puz, puz.sel, peg);
    return;
  }
  if (p.dragging) {
    const peg = pegAt(puz, x, y - DRAG_LIFT * 0.3, true);
    puz.sel = p.peg;
    if (peg < 0) cancelHold(puz); else attempt(puz, p.peg, peg);
  } else {
    puz.sel = p.peg; // a tap: the disc stays lifted until a destination is tapped
  }
}

// Keyboard / assistive: pick a peg by number. First press lifts its top disc, second press chooses the destination.
export function tapPeg(puz, peg) {
  if (puz.done || peg < 0 || peg >= puz.P) return;
  if (puz.sel < 0) {
    const d = topDisc(puz, peg);
    if (d < 0) return;
    puz.hint = null; puz.discs[d].mode = 'lift'; puz.discs[d].dst = peg; puz.sel = peg;
    puz.events.push({ type: 'lift', d });
  } else attempt(puz, puz.sel, peg);
}

export function cancel(puz) { if (puz.sel >= 0 || puz.ptr) cancelHold(puz); }

// -------------------------------------------------------------------------------------------- animation
const follow = (d, tx, ty, dt, k) => {
  const c = 2 * Math.sqrt(k) * 0.92;
  d.vx += ((tx - d.x) * k - c * d.vx) * dt;
  d.vy += ((ty - d.y) * k - c * d.vy) * dt;
  d.x += d.vx * dt; d.y += d.vy * dt;
};
const GRAV = 9000;

export const allRest = (puz) => puz.discs.every((d) => d.mode === 'rest');

export function updatePuzzle(puz, dt) {
  const g = puz.g;
  puz.t += dt;
  if (puz.done && allRest(puz)) puz.doneT += dt;
  if (puz.flash) { puz.flash.t += dt; if (puz.flash.t > 0.6) puz.flash = null; }
  if (puz.refused) { puz.refused.t -= dt; if (puz.refused.t <= 0) puz.refused = null; }
  if (puz.hint) puz.hint.t += dt;
  for (let i = 0; i < puz.shake.length; i++) puz.shake[i] = Math.max(0, puz.shake[i] - dt);
  for (const d of puz.discs) {
    d.sqT += dt;
    const sx = g.pegX[d.dst];
    if (d.mode === 'rest') { const s = seat(puz, d.id); d.x = s.x; d.y = s.y; d.vx = d.vy = 0; continue; }
    if (d.mode === 'lift') { d.bob += dt; follow(d, sx, g.hoverY - 4 * Math.sin(d.bob * 4), dt, 520); continue; }
    if (d.mode === 'drag') {
      const p = puz.ptr;
      if (p && p.fx != null) follow(d, p.fx, p.fy - DRAG_LIFT, dt, 2600);
      else { d.dst = puz.pegOf[d.id]; d.mode = 'raise'; }
      continue;
    }
    if (d.mode === 'raise') {
      follow(d, d.x, g.hoverY, dt, 900);
      // rise straight up (x held) until clear of the pegs, then slide
      d.vx *= 0.8;
      if (d.y <= g.hoverY + 14) d.mode = 'slide';
      continue;
    }
    if (d.mode === 'slide') {
      follow(d, sx, g.hoverY, dt, 700);
      if (Math.abs(d.x - sx) < 5 && Math.abs(d.vx) < 90) { d.x = sx; d.vx = 0; d.mode = 'drop'; d.vy = Math.max(d.vy, 0); }
      continue;
    }
    if (d.mode === 'drop') {
      d.x += (sx - d.x) * Math.min(1, dt * 30);
      d.vy += GRAV * dt;
      d.y += d.vy * dt;
      const s = seat(puz, d.id);
      if (d.y >= s.y) {
        const v = d.vy;
        d.y = s.y; d.x = s.x; d.vx = d.vy = 0; d.mode = 'rest';
        d.sqAmp = Math.min(0.16, 0.04 + v / 14000); d.sqT = 0;
        puz.events.push({ type: 'land', d: d.id, v });
        const w = g.w(d.id);
        spawn(puz, s.x - w / 2, s.y + ryOf(g.sh) * 0.6, 3, ['rgba(255,226,170,0.8)'], { min: 20, max: 90, up: 30, life: 0.45, size0: 1.5, size1: 3.5 });
        spawn(puz, s.x + w / 2, s.y + ryOf(g.sh) * 0.6, 3, ['rgba(255,226,170,0.8)'], { min: 20, max: 90, up: 30, life: 0.45, size0: 1.5, size1: 3.5 });
      }
      continue;
    }
  }
  for (const q of puz.parts) { q.life -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += dt * 3; }
  puz.parts = puz.parts.filter((q) => q.life > 0);
}

const nearestPeg = (g, x) => { let b = 0; g.pegX.forEach((px, i) => { if (Math.abs(px - x) < Math.abs(g.pegX[b] - x)) b = i; }); return b; };

export const squashOf = (d) => (d.sqT < 0.6 ? d.sqAmp * Math.exp(-d.sqT * 11) * Math.cos(d.sqT * 28) : 0);

export function winBurst(puz) {
  const cols = ['#ffe9a8', '#ffd45a', '#fff', '#f08a4b', '#ff9bb0'];
  for (const px of puz.g.pegX) spawn(puz, px, puz.g.pegTop - 20, 18, cols, { min: 80, max: 360, up: 220, life: 1.6, size0: 3, size1: 6.5, g: 520 });
  spawn(puz, puz.g.pegX[puz.goal], puz.g.baseY - 100, 40, cols, { min: 100, max: 460, up: 260, life: 1.9, size0: 3, size1: 7, g: 560, shape: 'tile' });
}

export { legalMoves, movesLeft, bestMove, isSolved };
