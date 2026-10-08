// The Fold Workshop: seven guided steps that fold two sheets into a tile. Each step is a drag along an arrow (or a hold for the
// last one); the model keeps a progress p (0..1) per step and a crispness score per step. Drawing is top-down, with the moving
// flap foreshortened as it lifts and shadowed on the paper below, so the fold reads as real paper turning over.
import { drawFlatTile, PATTERNS, FONT } from './art.js';

export const STEPS = [
  { id: 'a1', title: 'Fold the first sheet in half', hint: 'Drag down along the arrow to bring the top edge to the bottom edge.', dir: { x: 0, y: 1 }, len: 150, at: { x: 0, y: -40 } },
  { id: 'a2', title: 'Fold it in half again', hint: 'Once more: top edge down to the bottom edge. The strip is now four layers thick.', dir: { x: 0, y: 1 }, len: 90, at: { x: 0, y: 20 } },
  { id: 'b1', title: 'Fold the second sheet in half', hint: 'Same again with the second sheet: top edge down.', dir: { x: 0, y: 1 }, len: 150, at: { x: 0, y: -40 } },
  { id: 'b2', title: 'Fold it in half again', hint: 'Fold the strip in half once more, matching the edges exactly.', dir: { x: 0, y: 1 }, len: 90, at: { x: 0, y: 20 } },
  { id: 'cross', title: 'Cross the two strips', hint: 'Slide the second strip across the first so they form a plus.', dir: { x: -1, y: 0 }, len: 190, at: { x: 130, y: 0 } },
  { id: 'tuck', title: 'Fold the arm ends back', hint: 'Swipe across: each arm end folds back over its own arm, one after the other.', dir: { x: 1, y: 0 }, len: 190, at: { x: -60, y: 0 } },
  { id: 'press', title: 'Press it flat', hint: 'Press and hold on the tile with a steady finger until it is firm.', dir: null, len: 1.3, at: { x: 0, y: 0 } },
];
export const DONE_AT = 0.8;

export const createFold = () => ({ step: 0, p: 0, drag: null, crisp: [], done: false, back: null, show: false, showT: 0, celebrate: 0, result: null, t: 0, shake: 0 });
export const foldReset = (f) => Object.assign(f, createFold());
export const crispness = (f) => (f.crisp.length ? f.crisp.reduce((a, b) => a + b, 0) / f.crisp.length : 0.6);

// Called by game.js with the pointer already converted to stage units (stage is 480 x 480, origin at the centre).
export function foldPress(f, x, y) {
  if (f.done || f.show) return;
  const st = STEPS[f.step];
  f.drag = { x0: x, y0: y, dev: 0, maxp: 0, hold: 0, jitter: 0, lx: x, ly: y };
  f.back = null;
  void st;
}
export function foldMove(f, x, y) {
  const d = f.drag; if (!d || f.done) return;
  const st = STEPS[f.step];
  if (st.dir) {
    const dx = x - d.x0, dy = y - d.y0, along = dx * st.dir.x + dy * st.dir.y, lat = Math.abs(dx * -st.dir.y + dy * st.dir.x);
    f.p = Math.max(0, Math.min(1, along / st.len)); d.maxp = Math.max(d.maxp, f.p); d.dev = Math.max(d.dev, lat / st.len);
  } else d.jitter += Math.hypot(x - d.lx, y - d.ly);
  d.lx = x; d.ly = y;
}
export function foldRelease(f) {
  const d = f.drag; f.drag = null; if (!d || f.done) return null;
  const st = STEPS[f.step];
  if (st.dir ? d.maxp >= DONE_AT && f.p >= DONE_AT - 0.05 : f.p >= 0.98) {
    const sc = st.dir ? Math.max(0.35, Math.min(1, 1 - d.dev * 1.5)) : Math.max(0.5, Math.min(1, 1 - d.jitter / 400));
    f.crisp.push(sc); f.p = 1; f.pending = true; f.lastScore = sc;
    return sc;
  }
  f.back = f.p;   // springs back
  return null;
}
// dt: seconds. Moves the sheet: spring back, finish a step, Show me, the celebration.
export function foldUpdate(f, dt, holding) {
  f.t += dt;
  const st = STEPS[f.step];
  if (f.done) { f.celebrate += dt; return null; }
  if (f.drag && !st.dir) { f.drag.hold += holding ? dt : 0; if (holding) f.p = Math.min(1, f.drag.hold / st.len); else f.p = Math.max(0, f.p - dt * 2); }
  if (f.show) {
    f.showT += dt; const k = (f.showT % 3.0);
    f.p = k < 1.9 ? 1 - Math.pow(1 - Math.min(1, k / 1.9), 2) : k < 2.5 ? 1 : 0;
  } else if (f.back !== null && !f.drag) {
    f.p = Math.max(0, f.p - dt * 3.2); if (f.p <= 0) f.back = null;
  }
  if (f.pending) {
    f.p = 1;
    f.advT = (f.advT || 0) + dt;
    if (f.advT > 0.55) {
      f.pending = false; f.advT = 0;
      if (f.step >= STEPS.length - 1) { f.done = true; f.celebrate = 0; f.result = crispness(f); return 'done'; }
      f.step++; f.p = 0; return 'step';
    }
  }
  return null;
}

// ---- drawing ---------------------------------------------------------------------------------------------------
const FRONT = { a: '#e0702e', b: '#2f8a86' }, FRONT2 = { a: '#c85a1c', b: '#226e6a' }, CREAM = '#f1e5c4', CREAM2 = '#dccaa0';

function rect(c, x0, y0, x1, y1, fill, layers = 1, edge = 'rgba(70,44,20,0.55)') {
  c.save();
  for (let i = layers - 1; i >= 1; i--) { c.fillStyle = 'rgba(60,36,14,0.5)'; c.fillRect(x0 + i * 0.9 + 1.5, y0 + i * 1.3 + 2.5, x1 - x0, y1 - y0); }
  c.fillStyle = 'rgba(30,16,6,0.28)'; c.fillRect(x0 + 3, y0 + 5, x1 - x0, y1 - y0);
  c.fillStyle = fill; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.strokeStyle = edge; c.lineWidth = 1.4; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
  c.restore();
}
// A flap hinged on the segment (ax,ay)-(bx,by), extending `len` along unit d when flat; phi = 0..PI.
function flap(c, ax, ay, bx, by, dx, dy, len, phi, front, back) {
  const e = len * Math.cos(phi), sinp = Math.sin(phi);
  const q = [[ax, ay], [bx, by], [bx + dx * e, by + dy * e], [ax + dx * e, ay + dy * e]];
  // shadow it throws on the paper below while it is raised
  if (sinp > 0.02) {
    const sh = e + len * 0.22 * sinp;
    c.save(); c.fillStyle = `rgba(30,16,6,${0.26 * sinp})`; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(bx + dx * sh, by + dy * sh); c.lineTo(ax + dx * sh, ay + dy * sh); c.closePath(); c.fill(); c.restore();
  }
  c.save(); c.beginPath(); q.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
  const col = phi < Math.PI / 2 ? front : back; c.fillStyle = col; c.fill();
  const g = c.createLinearGradient(ax, ay, ax + dx * e, ay + dy * e); g.addColorStop(0, `rgba(255,255,255,${0.12 + 0.16 * sinp})`); g.addColorStop(1, `rgba(0,0,0,${0.08 + 0.1 * sinp})`); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(70,44,20,0.6)'; c.lineWidth = 1.4; c.stroke(); c.restore();
}
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function drawStrip(c, cx, cy, horizontal, tint, layers) {
  const w = 200, h = 50, x0 = horizontal ? cx - w / 2 : cx - h / 2, y0 = horizontal ? cy - h / 2 : cy - w / 2, x1 = horizontal ? x0 + w : x0 + h, y1 = horizontal ? y0 + h : y0 + w;
  rect(c, x0, y0, x1, y1, CREAM, layers);
  c.save(); c.strokeStyle = 'rgba(120,90,50,0.28)'; c.lineWidth = 1;
  for (let i = 1; i < 4; i++) { c.beginPath(); if (horizontal) { c.moveTo(x0 + (w * i) / 4, y0); c.lineTo(x0 + (w * i) / 4, y1); } else { c.moveTo(x0, y0 + (w * i) / 4); c.lineTo(x1, y0 + (w * i) / 4); } c.stroke(); }
  c.fillStyle = tint; if (horizontal) { c.fillRect(x0, y0, w, 6); c.fillRect(x0, y1 - 6, w, 6); } else { c.fillRect(x0, y0, 6, w); c.fillRect(x1 - 6, y0, 6, w); }
  c.restore();
}

// Draws the stage (480 x 480 units, origin at its centre) for the fold state f. pat = the player's pattern for the finished tile.
export function drawFold(ctx, f, pat) {
  const c = ctx, st = f.step, p = ease(f.p), done = f.done;
  c.save();
  // table
  const g = c.createLinearGradient(0, -240, 0, 240); g.addColorStop(0, '#d8b06a'); g.addColorStop(1, '#c4934a'); c.fillStyle = g; c.beginPath(); c.roundRect(-240, -240, 480, 480, 28); c.fill();
  c.strokeStyle = 'rgba(90,50,10,0.5)'; c.lineWidth = 3; c.stroke();
  c.save(); c.beginPath(); c.roundRect(-240, -240, 480, 480, 28); c.clip();
  c.strokeStyle = 'rgba(110,64,14,0.12)'; c.lineWidth = 2; for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(i * 40, -240); c.lineTo(i * 40 + 12, 240); c.stroke(); }
  const park = (cx, tint, layers) => { c.save(); c.translate(cx, -196); c.scale(0.42, 0.42); drawStrip(c, 0, 0, true, tint, layers); c.restore(); };

  if (done) {
    const k = Math.min(1, f.celebrate / 0.5), s = 190 * (0.6 + 0.4 * (1 - Math.pow(1 - k, 3))) * (1 + 0.04 * Math.sin(f.celebrate * 3));
    drawFlatTile(c, 0, -6, s, pat, { shadow: true });
    c.restore(); c.restore(); return;
  }
  if (st >= 2 && st < 4) park(-130, FRONT.a, 4);
  if (st >= 4) { /* strips are on the table */ }

  const sheet = (which, step) => {
    // returns drawing of sheet at fold step (0 or 1 within sheet) with progress p
    const F = FRONT[which], F2 = FRONT2[which];
    if (step === 0) {
      // 200x200 sheet, crease y=0, top half folds down
      rect(c, -100, 0, 100, 100, F, 1);
      c.fillStyle = F2; c.fillRect(-100, 0, 200, 4);
      c.save(); c.globalAlpha = 0.55; c.fillStyle = CREAM; c.fillRect(-100, -100, 200, 0.01); c.restore();
      if (p < 0.999) { rect(c, -100, -100, 100, 0, F, 1); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(-100, -100, 200, 100); }
      // draw the moving half as a flap over the bottom half: remove the static top via painting only when p < 1 above, then flap
      return;
    }
  };
  void sheet;

  const foldHalf = (which, stage) => {
    const F = FRONT[which];
    if (stage === 0) {
      // static bottom half (y 0..100); the top half is the flap
      rect(c, -100, 0, 100, 100, F, 1);
      flap(c, -100, 0, 100, 0, 0, -1, 100, p * Math.PI, F, CREAM);
      c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(-100, 0, 200, 100);
    } else {
      // after the first fold: a 200x100 rectangle (two layers), cream on top; fold its top half down
      rect(c, -100, 0, 100, 100, CREAM, 2);
      c.fillStyle = FRONT[which]; c.fillRect(-100, 94, 200, 6);
      rect(c, -100, 50, 100, 100, CREAM, 2);
      flap(c, -100, 50, 100, 50, 0, -1, 50, p * Math.PI, CREAM, CREAM2);
    }
  };

  if (st === 0) foldHalf('a', 0);
  else if (st === 1) foldHalf('a', 1);
  else if (st === 2) foldHalf('b', 0);
  else if (st === 3) foldHalf('b', 1);
  else if (st === 4) {
    // A lies horizontally; B slides in from the right to cross on top
    drawStrip(c, 0, 0, true, FRONT.a, 4);
    const bx = lerp(250, 0, p);
    c.save(); c.globalAlpha = 1; drawStrip(c, bx, 0, false, FRONT.b, 4); c.restore();
  } else if (st === 5 || st === 6) {
    drawStrip(c, 0, 0, true, FRONT.a, 4); drawStrip(c, 0, 0, false, FRONT.b, 4);
    // four arms fold back, one after another (step 5); fully folded in step 6
    const ph = (i) => (st === 6 ? 1 : Math.max(0, Math.min(1, p * 4 - i)));
    const arms = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    arms.forEach(([ux, uy], i) => {
      const a = 62.5, px = -uy, py = ux, hw = 25;
      const ax = ux * a + px * hw, ay = uy * a + py * hw, bx = ux * a - px * hw, by = uy * a - py * hw;
      const phi = ease(ph(i)) * Math.PI;
      // the part beyond the crease is hidden by a patch of table while it lifts
      if (ph(i) > 0.001) { c.fillStyle = '#cda052'; const x0 = Math.min(ux * a, ux * 100) - (uy ? hw : 0), x1 = Math.max(ux * a, ux * 100) + (uy ? hw : 0), y0 = Math.min(uy * a, uy * 100) - (ux ? hw : 0), y1 = Math.max(uy * a, uy * 100) + (ux ? hw : 0); c.fillRect(x0, y0, x1 - x0, y1 - y0); }
      flap(c, ax, ay, bx, by, ux, uy, 37.5, phi, CREAM, st === 5 ? CREAM2 : CREAM2);
    });
    if (st === 6) {
      // the corners fill and the whole thing is pressed square
      const k = ease(f.p);
      c.fillStyle = CREAM; c.globalAlpha = k;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.fillRect(sx > 0 ? 25 : -62.5, sy > 0 ? 25 : -62.5, 37.5, 37.5);
      c.globalAlpha = 1; c.strokeStyle = `rgba(70,44,20,${0.15 + 0.5 * k})`; c.lineWidth = 1.5; c.strokeRect(-62.5, -62.5, 125, 125);
      if (k > 0.5) { c.fillStyle = `rgba(255,255,255,${(k - 0.5) * 0.3})`; c.fillRect(-62.5, -62.5, 125, 125); }
    }
  }
  // the arrow (what to do)
  const s = STEPS[st];
  if (!done && !f.drag && !f.pending && !f.show) {
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 4);
    c.save(); c.globalAlpha = 0.55 + 0.4 * pulse; c.strokeStyle = '#fff6dc'; c.fillStyle = '#fff6dc'; c.lineWidth = 7; c.lineCap = 'round';
    if (s.dir) {
      const ax = s.at.x, ay = s.at.y, bx = ax + s.dir.x * s.len * 0.95, by = ay + s.dir.y * s.len * 0.95;
      c.shadowColor = 'rgba(20,10,0,0.6)'; c.shadowBlur = 8; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      const ang = Math.atan2(by - ay, bx - ax); c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - 20 * Math.cos(ang - 0.5), by - 20 * Math.sin(ang - 0.5)); c.lineTo(bx - 20 * Math.cos(ang + 0.5), by - 20 * Math.sin(ang + 0.5)); c.closePath(); c.fill();
    } else { c.beginPath(); c.arc(0, 0, 40 + pulse * 10, 0, Math.PI * 2); c.stroke(); }
    c.restore();
  }
  if (s && !s.dir && f.drag) { c.save(); c.strokeStyle = 'rgba(255,246,220,0.9)'; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, 74, -Math.PI / 2, -Math.PI / 2 + f.p * Math.PI * 2); c.stroke(); c.restore(); }
  c.restore();
  c.restore();
  void FONT; void PATTERNS;
}
