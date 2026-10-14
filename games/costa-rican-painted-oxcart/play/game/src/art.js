// Pictures: paint, the wheel, panels and yokes, paint jars, the cart and its road. Reads data, never changes game state.
import { TAU, HUB, RIM0 } from './geo.js';
import { makeCommission, COLORS, pieceOf } from './puzzle.js';
import { mix, rgba, rr } from './ui.js';
import { v3, live } from './v3.js';

export const PAINT = {
  red: { base: '#dc3a2c', light: '#ff8062', dark: '#8f1a12', ink: '#ffffff' },
  yellow: { base: '#f8c623', light: '#ffe887', dark: '#b88a00', ink: '#3a2a00' },
  blue: { base: '#2168d4', light: '#78aaff', dark: '#0f3a86', ink: '#ffffff' },
  green: { base: '#1fa35d', light: '#6fe3a0', dark: '#0d6a38', ink: '#ffffff' },
  orange: { base: '#f58a20', light: '#ffc07a', dark: '#b4540a', ink: '#3a1a00' },
  white: { base: '#f7f0dc', light: '#ffffff', dark: '#b8ab88', ink: '#3a2a10' },
};
const hash = (n) => { let h = Math.imul(n + 1, 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h >>> 0) / 4294967296; };

// colour-blind marks: a small, distinct glyph per paint (drawn on jars and, if enabled, on segments)
export function drawMark(ctx, id, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.4, s * 0.16); ctx.lineCap = 'round';
  const r = s * 0.5;
  ctx.beginPath();
  if (id === 'red') ctx.arc(0, 0, r * 0.7, 0, TAU);
  else if (id === 'yellow') { ctx.moveTo(0, -r); ctx.lineTo(r * 0.9, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.9, 0); ctx.closePath(); }
  else if (id === 'blue') ctx.rect(-r * 0.62, -r * 0.62, r * 1.24, r * 1.24);
  else if (id === 'green') { ctx.moveTo(0, -r * 0.9); ctx.lineTo(r * 0.9, r * 0.7); ctx.lineTo(-r * 0.9, r * 0.7); ctx.closePath(); }
  else if (id === 'orange') { ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke(); ctx.restore(); return; }
  else { ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.stroke(); ctx.restore(); return; }
  ctx.fill(); ctx.restore();
}

// ================================================================ the wheel ===========================================================
function cellPath(ctx, cx, cy, R, c, rot) {
  ctx.beginPath();
  if (c.shape === 'disc') ctx.arc(cx, cy, c.r1 * R, 0, TAU);
  else { ctx.arc(cx, cy, c.r1 * R, c.a0 + rot, c.a1 + rot); ctx.arc(cx, cy, c.r0 * R, c.a1 + rot, c.a0 + rot, true); ctx.closePath(); }
}
const rotPt = (p, rot) => { const c = Math.cos(rot), s = Math.sin(rot); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };

function drawWheel(ctx, P, a, rect, o) {
  const R = Math.min(rect.w, rect.h) / 2 * 0.97, cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, rot = o.rot || 0, t = o.t || 0, dark = o.dark !== false;
  // shadow on the table
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(cx + R * 0.04, cy + R * 0.07, R * 1.02, R * 1.0, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.arc(cx + R * 0.02, cy + R * 0.035, R * 1.0, 0, TAU); ctx.fill();
  ctx.restore();
  // timber tyre
  const tg = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.2, cx, cy, R);
  tg.addColorStop(0, '#9a6a3a'); tg.addColorStop(0.7, '#6a4020'); tg.addColorStop(1, '#3c2210');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1, R * 0.012); ctx.strokeStyle = 'rgba(255,220,160,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.995, 0, TAU); ctx.stroke();
  const studs = P.geom.sectors ? Math.min(32, P.geom.sectors * 2) : 24;
  for (let i = 0; i < studs; i++) {
    const an = (i / studs) * TAU + rot, rr0 = R * (RIM0 + (1 - RIM0) * 0.5);
    const sx = cx + Math.cos(an) * rr0, sy = cy + Math.sin(an) * rr0, sr = R * 0.017;
    ctx.fillStyle = '#e8c15a'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(sx - sr * 0.3, sy - sr * 0.3, sr * 0.4, 0, TAU); ctx.fill();
  }
  // painted face
  const fg = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.1, cx, cy, R * RIM0);
  fg.addColorStop(0, mix('#f0d9ac', '#ffffff', 0.2)); fg.addColorStop(1, '#c9a46c');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx, cy, R * RIM0, 0, TAU); ctx.fill();
  const light = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  light.addColorStop(0, 'rgba(255,255,255,0.30)'); light.addColorStop(0.5, 'rgba(255,255,255,0)'); light.addColorStop(1, 'rgba(0,0,0,0.26)');
  for (const c of P.cells) {
    const col = a[c.orbit], age = o.pop ? o.pop[c.id] : 99;
    ctx.save();
    if (age < 0.42) { const k = age / 0.42, s = 0.84 + 0.16 * (1 - (1 - k) * (1 - k)), m = rotPt(c.mid, rot); ctx.translate(cx + m[0] * R, cy + m[1] * R); ctx.scale(s, s); ctx.translate(-(cx + m[0] * R), -(cy + m[1] * R)); }
    cellPath(ctx, cx, cy, R, c, rot);
    if (col) {
      const p = PAINT[col];
      ctx.fillStyle = p.base; ctx.fill();
      ctx.fillStyle = light; ctx.fill();
      // a petal of lighter paint with a dark edge, the hand-painted flower of the sunburst
      if (c.shape === 'sector') {
        const am = (c.a0 + c.a1) / 2 + rot, dr = c.r1 - c.r0, ri = c.r0 + dr * 0.14, ro = c.r1 - dr * 0.1, rm = (ri + ro) / 2, half = ((c.a1 - c.a0) / 2) * 0.62;
        const pt = (rad, an) => [cx + Math.cos(an) * rad * R, cy + Math.sin(an) * rad * R];
        const p0 = pt(ri, am), p1 = pt(ro, am), k1 = pt(rm / Math.cos(half), am - half), k2 = pt(rm / Math.cos(half), am + half);
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(k1[0], k1[1], p1[0], p1[1]); ctx.quadraticCurveTo(k2[0], k2[1], p0[0], p0[1]);
        ctx.fillStyle = rgba(p.light, 0.42); ctx.fill(); ctx.lineWidth = Math.max(1, R * 0.007); ctx.strokeStyle = rgba(p.dark, 0.5); ctx.stroke();
        if (c.ring >= P.geom.rings - 1 || c.ring === 0) { const m = pt(rm, am); ctx.fillStyle = 'rgba(255,248,226,0.85)'; ctx.beginPath(); ctx.arc(m[0], m[1], R * 0.012, 0, TAU); ctx.fill(); }
      }
      // dry-brush streaks along the ring
      if (c.shape === 'sector') {
        ctx.save(); cellPath(ctx, cx, cy, R, c, rot); ctx.clip();
        ctx.lineWidth = Math.max(1, R * 0.008);
        for (let k = 0; k < 3; k++) {
          const rr0 = c.r0 + (c.r1 - c.r0) * (0.2 + 0.3 * k + hash(c.id * 7 + k) * 0.12);
          ctx.strokeStyle = rgba(k % 2 ? p.light : p.dark, 0.34);
          ctx.beginPath(); ctx.arc(cx, cy, rr0 * R, c.a0 + rot + (c.a1 - c.a0) * 0.1, c.a1 + rot - (c.a1 - c.a0) * (0.1 + hash(c.id + k) * 0.3)); ctx.stroke();
        }
        ctx.restore();
      } else {
        const g = ctx.createRadialGradient(cx - R * 0.03, cy - R * 0.04, 0, cx, cy, c.r1 * R);
        g.addColorStop(0, rgba(p.light, 0.65)); g.addColorStop(1, rgba(p.dark, 0.2)); cellPath(ctx, cx, cy, R, c, rot); ctx.fillStyle = g; ctx.fill();
        ctx.beginPath();
        for (let i = 0; i < 16; i++) { const an = (i / 16) * TAU + rot, rad = (i % 2 ? 0.098 : 0.158) * R; ctx.lineTo(cx + Math.cos(an) * rad, cy + Math.sin(an) * rad); }
        ctx.closePath(); ctx.fillStyle = rgba(p.light, 0.55); ctx.fill(); ctx.lineWidth = Math.max(1, R * 0.006); ctx.strokeStyle = rgba(p.dark, 0.55); ctx.stroke();
      }
      if (age < 0.42) { cellPath(ctx, cx, cy, R, c, rot); ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - age / 0.42)})`; ctx.fill(); }
    } else {
      const h = hash(c.id);
      ctx.fillStyle = mix('#dcc08f', '#b99763', h * 0.5); ctx.fill();
      ctx.fillStyle = light; ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  // pinstripe: dark then cream, the painter's edge line
  ctx.lineJoin = 'round';
  for (const c of P.cells) { cellPath(ctx, cx, cy, R, c, rot); ctx.lineWidth = R * 0.024; ctx.strokeStyle = 'rgba(40,20,8,0.55)'; ctx.stroke(); }
  for (const c of P.cells) { cellPath(ctx, cx, cy, R, c, rot); ctx.lineWidth = R * 0.0085; ctx.strokeStyle = a[c.orbit] ? 'rgba(255,248,226,0.9)' : 'rgba(255,248,226,0.4)'; ctx.stroke(); }
  // marks and master pegs
  for (const c of P.cells) {
    const m = rotPt(c.mid, rot), x = cx + m[0] * R, y = cy + m[1] * R, col = a[c.orbit];
    if (o.marks && col) drawMark(ctx, col, x, y, R * (c.shape === 'disc' ? 0.07 : 0.062), PAINT[col].ink);
    if (o.given && o.given.has(c.orbit) && (c.shape === 'sector' ? c.id % 1 === 0 : false)) {
      const pr = R * 0.018, px = cx + Math.cos((c.a0 + c.a1) / 2 + rot) * (c.r0 + (c.r1 - c.r0) * 0.82) * R, py = cy + Math.sin((c.a0 + c.a1) / 2 + rot) * (c.r0 + (c.r1 - c.r0) * 0.82) * R;
      ctx.fillStyle = '#f2c85a'; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(px - pr * 0.3, py - pr * 0.3, pr * 0.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,0,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.stroke();
    }
  }
  // highlights (hint target, finger)
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  for (const [set, col, wid] of [[o.hi, '#ffe27a', 0.03], [o.sel, '#ffffff', 0.022]]) {
    if (!set || !set.size) continue;
    for (const c of P.cells) if (set.has(c.orbit)) { cellPath(ctx, cx, cy, R, c, rot); ctx.lineWidth = R * wid * (col === '#ffe27a' ? 0.8 + 0.5 * pulse : 1); ctx.strokeStyle = col; ctx.stroke(); }
  }
  // smudges where touching segments share a colour
  if (o.conflicts) for (const i of o.conflicts) {
    const e = P.edges[i], m = rotPt(e.at, rot), x = cx + m[0] * R, y = cy + m[1] * R, br = R * 0.042;
    ctx.fillStyle = '#ff3b2e'; ctx.beginPath(); ctx.arc(x, y, br, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, R * 0.011); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - br * 0.45, y - br * 0.45); ctx.lineTo(x + br * 0.45, y + br * 0.45); ctx.moveTo(x + br * 0.45, y - br * 0.45); ctx.lineTo(x - br * 0.45, y + br * 0.45); ctx.stroke();
  }
  // brass hub cap with a cross of bolts
  const capR = R * 0.082;
  const bg = ctx.createRadialGradient(cx - capR * 0.4, cy - capR * 0.4, capR * 0.1, cx, cy, capR);
  bg.addColorStop(0, '#fff2b8'); bg.addColorStop(0.5, '#d9a93a'); bg.addColorStop(1, '#7a5410');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, capR, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,0,0.6)'; ctx.lineWidth = Math.max(1, R * 0.008); ctx.stroke();
  ctx.fillStyle = 'rgba(60,30,0,0.6)'; ctx.beginPath(); ctx.arc(cx, cy, capR * 0.28, 0, TAU); ctx.fill();
  return { cx, cy, R };
}

// ================================================================ panels and yokes =========================================================
function gridGeo(P, rect) {
  const g = P.geom, m = 0.34, W = g.cols + 2 * m, H = g.rows + 2 * m, k = Math.min(rect.w / W, rect.h / H);
  return { k, m, x0: rect.x + (rect.w - W * k) / 2, y0: rect.y + (rect.h - H * k) / 2, W, H, ox: rect.x + (rect.w - W * k) / 2 + m * k, oy: rect.y + (rect.h - H * k) / 2 + m * k };
}
function drawGrid(ctx, P, a, rect, o) {
  const G = gridGeo(P, rect), k = G.k, g = P.geom, t = o.t || 0, yoke = g.kind === 'yoke';
  // shadow and timber frame
  rr(ctx, G.x0 + k * 0.06, G.y0 + k * 0.1, G.W * k, G.H * k, k * (yoke ? 0.5 : 0.18)); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  const fg = ctx.createLinearGradient(0, G.y0, 0, G.y0 + G.H * k);
  fg.addColorStop(0, '#9a6a3a'); fg.addColorStop(0.5, '#6a4020'); fg.addColorStop(1, '#40240f');
  rr(ctx, G.x0, G.y0, G.W * k, G.H * k, k * (yoke ? 0.5 : 0.18)); ctx.fillStyle = fg; ctx.fill();
  ctx.lineWidth = Math.max(1, k * 0.03); ctx.strokeStyle = 'rgba(255,220,160,0.35)'; ctx.stroke();
  // nails (or rope holes on a yoke)
  const nail = (x, y) => { ctx.fillStyle = '#e8c15a'; ctx.beginPath(); ctx.arc(x, y, k * 0.05, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - k * 0.015, y - k * 0.015, k * 0.02, 0, TAU); ctx.fill(); };
  const mm = G.m * k * 0.5;
  for (let i = 0; i <= g.cols; i += 1) { if (i % 2 === 0) { nail(G.ox + i * k, G.y0 + mm); nail(G.ox + i * k, G.y0 + G.H * k - mm); } }
  for (let j = 0; j <= g.rows; j += 1) { nail(G.x0 + mm, G.oy + j * k); nail(G.x0 + G.W * k - mm, G.oy + j * k); }
  const light = ctx.createLinearGradient(G.ox, G.oy, G.ox + g.cols * k, G.oy + g.rows * k);
  light.addColorStop(0, 'rgba(255,255,255,0.28)'); light.addColorStop(0.5, 'rgba(255,255,255,0)'); light.addColorStop(1, 'rgba(0,0,0,0.24)');
  const pad = k * 0.04;
  for (const c of P.cells) {
    const x = G.ox + c.x * k, y = G.oy + c.y * k, col = a[c.orbit], age = o.pop ? o.pop[c.id] : 99;
    ctx.save();
    if (age < 0.42) { const s = 0.84 + 0.16 * (1 - (1 - age / 0.42) ** 2); ctx.translate(x + k / 2, y + k / 2); ctx.scale(s, s); ctx.translate(-(x + k / 2), -(y + k / 2)); }
    if (col) {
      const p = PAINT[col];
      ctx.fillStyle = p.base; ctx.fillRect(x, y, k, k);
      ctx.fillStyle = light; ctx.fillRect(x, y, k, k);
      // a painted diamond inside every square: the sunburst in miniature
      ctx.beginPath(); ctx.moveTo(x + k / 2, y + k * 0.16); ctx.lineTo(x + k * 0.84, y + k / 2); ctx.lineTo(x + k / 2, y + k * 0.84); ctx.lineTo(x + k * 0.16, y + k / 2); ctx.closePath();
      ctx.fillStyle = rgba(p.light, 0.5); ctx.fill(); ctx.lineWidth = Math.max(1, k * 0.025); ctx.strokeStyle = rgba(p.dark, 0.6); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.moveTo(x + pad, y + k * 0.12); ctx.lineTo(x + k - pad, y + k * 0.12); ctx.stroke();
      if (age < 0.42) { ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - age / 0.42)})`; ctx.fillRect(x, y, k, k); }
    } else {
      ctx.fillStyle = mix('#dcc08f', '#b99763', hash(c.id) * 0.5); ctx.fillRect(x, y, k, k);
      ctx.fillStyle = light; ctx.globalAlpha = 0.5; ctx.fillRect(x, y, k, k); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  ctx.lineJoin = 'round';
  for (const c of P.cells) { ctx.lineWidth = k * 0.06; ctx.strokeStyle = 'rgba(40,20,8,0.55)'; ctx.strokeRect(G.ox + c.x * k, G.oy + c.y * k, k, k); }
  for (const c of P.cells) { ctx.lineWidth = k * 0.022; ctx.strokeStyle = a[c.orbit] ? 'rgba(255,248,226,0.9)' : 'rgba(255,248,226,0.4)'; ctx.strokeRect(G.ox + c.x * k, G.oy + c.y * k, k, k); }
  for (const c of P.cells) {
    const col = a[c.orbit], x = G.ox + c.x * k, y = G.oy + c.y * k;
    if (o.marks && col) drawMark(ctx, col, x + k / 2, y + k / 2, k * 0.2, PAINT[col].ink);
    if (o.given && o.given.has(c.orbit)) { const pr = k * 0.07, px = x + k * 0.84, py = y + k * 0.16; ctx.fillStyle = '#f2c85a'; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(60,30,0,0.6)'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(px - pr * 0.3, py - pr * 0.3, pr * 0.4, 0, TAU); ctx.fill(); }
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  for (const [set, col, wid] of [[o.hi, '#ffe27a', 0.09], [o.sel, '#ffffff', 0.07]]) {
    if (!set || !set.size) continue;
    for (const c of P.cells) if (set.has(c.orbit)) { ctx.lineWidth = k * wid * (col === '#ffe27a' ? 0.8 + 0.5 * pulse : 1); ctx.strokeStyle = col; ctx.strokeRect(G.ox + c.x * k + k * 0.04, G.oy + c.y * k + k * 0.04, k * 0.92, k * 0.92); }
  }
  if (o.conflicts) for (const i of o.conflicts) {
    const e = P.edges[i], x = G.ox + e.at[0] * k, y = G.oy + e.at[1] * k, br = k * 0.17;
    ctx.fillStyle = '#ff3b2e'; ctx.beginPath(); ctx.arc(x, y, br, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, k * 0.05); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - br * 0.45, y - br * 0.45); ctx.lineTo(x + br * 0.45, y + br * 0.45); ctx.moveTo(x + br * 0.45, y - br * 0.45); ctx.lineTo(x - br * 0.45, y + br * 0.45); ctx.stroke();
  }
  return { G };
}

// Draw any piece. rect is the box it must fit; returns the geometry the hit test needs.
export function drawPiece(ctx, P, a, rect, o = {}) {
  return P.kind === 'wheel' ? drawWheel(ctx, P, a, rect, o) : drawGrid(ctx, P, a, rect, o);
}
// The piece's own frame coordinates under a screen point (for hit testing). Wheel: unit circle; grid: cell units.
export function toFrame(P, rect, x, y) {
  if (live(rect)) return v3.unproject(x, y);
  if (P.kind === 'wheel') { const R = Math.min(rect.w, rect.h) / 2 * 0.97; return [(x - (rect.x + rect.w / 2)) / R, (y - (rect.y + rect.h / 2)) / R]; }
  const G = gridGeo(P, rect);
  return [(x - G.ox) / G.k, (y - G.oy) / G.k];
}
export function fromFrame(P, rect, u, v) {
  if (live(rect)) return v3.project(u, v);
  if (P.kind === 'wheel') { const R = Math.min(rect.w, rect.h) / 2 * 0.97; return [rect.x + rect.w / 2 + u * R, rect.y + rect.h / 2 + v * R]; }
  const G = gridGeo(P, rect);
  return [G.ox + u * G.k, G.oy + v * G.k];
}
// Fit rect for a piece inside a box (wheel square, grids by aspect)
export function fitRect(P, box) {
  const asp = P.kind === 'wheel' ? 1 : (P.geom.cols + 0.68) / (P.geom.rows + 0.68);
  let w = box.w, h = w / asp;
  if (h > box.h) { h = box.h; w = h * asp; }
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

// ================================================================ paint jars =============================================================
export function drawJar(ctx, r, id, frac, { sel = false, empty = false, count = null, marks = true, shake = 0, locked = false, dark = true, t = 0 } = {}) {
  const p = PAINT[id], sx = shake ? Math.sin(t * 60) * shake * r.w * 0.04 : 0;
  const x = r.x + sx, w = r.w, y = r.y + (sel ? -r.h * 0.04 : 0), h = r.h;
  const bw = Math.min(w, h * 0.92), bx = x + (w - bw) / 2, lidH = h * 0.17, bodyY = y + lidH * 0.8, bodyH = h - lidH * 0.8 - h * 0.02;
  const in3 = v3.on && ctx.globalAlpha > 0.9;
  if (in3) {
    v3.jars.push({ r: { x: bx, y: y + v3.off, w: bw, h, bodyY: bodyY + v3.off, bodyH, lidH }, id, frac, sel, empty, shake, locked, clip: v3.clip });
    ctx.save();
    if (empty) ctx.globalAlpha = 0.62;
    if (sel) { rr(ctx, bx - 2, bodyY - lidH * 0.9, bw + 4, bodyH + lidH * 0.9 + 4, bw * 0.22); ctx.lineWidth = 4; ctx.strokeStyle = '#ffe27a'; ctx.stroke(); }
    if (bodyH > 46) {
      const plate = { x: bx + bw * 0.12, y: bodyY + bodyH * 0.5, w: bw * 0.76, h: bodyH * 0.4 };
      rr(ctx, plate.x, plate.y, plate.w, plate.h, plate.h * 0.3); ctx.fillStyle = 'rgba(255,250,236,0.93)'; ctx.fill();
      ctx.fillStyle = '#3a2410'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fs = Math.min(plate.h * 0.62, bw * 0.3);
      if (marks) drawMark(ctx, id, plate.x + plate.w * 0.26, plate.y + plate.h / 2, plate.h * 0.4, p.dark);
      ctx.font = `700 ${fs}px Barlow, system-ui, sans-serif`;
      ctx.fillText(count === null ? '∞' : String(count), plate.x + plate.w * (marks ? 0.62 : 0.5), plate.y + plate.h / 2 + 1);
    } else if (marks) drawMark(ctx, id, bx + bw / 2, bodyY + bodyH * 0.6, bodyH * 0.3, PAINT[id].ink);
    ctx.restore();
    return;
  }
  ctx.save();
  if (empty) ctx.globalAlpha = 0.62;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(bx + bw / 2, y + h * 0.99, bw * 0.46, h * 0.045, 0, 0, TAU); ctx.fill();
  // glass body
  rr(ctx, bx, bodyY, bw, bodyH, bw * 0.2); ctx.fillStyle = dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'; ctx.fill();
  // paint level
  ctx.save(); rr(ctx, bx, bodyY, bw, bodyH, bw * 0.2); ctx.clip();
  const lv = frac <= 0 ? 0 : Math.max(0.12, frac), ly = bodyY + bodyH * (1 - lv);
  if (lv > 0) {
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, p.dark); g.addColorStop(0.35, p.base); g.addColorStop(0.7, p.base); g.addColorStop(1, p.dark);
    ctx.fillStyle = g; ctx.fillRect(bx, ly, bw, bodyY + bodyH - ly);
    ctx.fillStyle = p.light; ctx.globalAlpha = (empty ? 0.62 : 1) * 0.9; ctx.fillRect(bx, ly, bw, Math.max(2, bodyH * 0.04)); ctx.globalAlpha = empty ? 0.62 : 1;
  }
  ctx.restore();
  rr(ctx, bx, bodyY, bw, bodyH, bw * 0.2); ctx.lineWidth = sel ? 4 : 2; ctx.strokeStyle = sel ? '#ffe27a' : 'rgba(255,255,255,0.5)'; ctx.stroke();
  // glass shine
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(2, bw * 0.05); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bx + bw * 0.2, bodyY + bodyH * 0.14); ctx.lineTo(bx + bw * 0.2, bodyY + bodyH * 0.5); ctx.stroke();
  // lid
  const lg = ctx.createLinearGradient(0, y, 0, y + lidH); lg.addColorStop(0, '#f2d37a'); lg.addColorStop(1, '#a8761c');
  rr(ctx, bx + bw * 0.14, y, bw * 0.72, lidH, lidH * 0.28); ctx.fillStyle = lg; ctx.fill();
  // label plate with the count and the mark
  if (bodyH > 46) {
    const plate = { x: bx + bw * 0.12, y: bodyY + bodyH * 0.5, w: bw * 0.76, h: bodyH * 0.4 };
    rr(ctx, plate.x, plate.y, plate.w, plate.h, plate.h * 0.3); ctx.fillStyle = 'rgba(255,250,236,0.9)'; ctx.fill();
    ctx.fillStyle = '#3a2410'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = Math.min(plate.h * 0.62, bw * 0.3);
    if (marks) drawMark(ctx, id, plate.x + plate.w * 0.26, plate.y + plate.h / 2, plate.h * 0.4, p.dark);
    ctx.font = `700 ${fs}px Barlow, system-ui, sans-serif`;
    ctx.fillText(count === null ? '∞' : String(count), plate.x + plate.w * (marks ? 0.62 : 0.5), plate.y + plate.h / 2 + 1);
  } else if (marks) drawMark(ctx, id, bx + bw / 2, bodyY + bodyH * 0.6, bodyH * 0.3, PAINT[id].ink);
  if (locked) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, bx, bodyY, bw, bodyH, bw * 0.2); ctx.fill(); }
  ctx.restore();
}
// A small brush that follows the selected colour (used beside the hint and for the loaded-brush badge)
export function drawBrush(ctx, x, y, s, id) {
  const p = PAINT[id];
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.7);
  ctx.fillStyle = '#9a6a3a'; rr(ctx, -s * 0.06, -s * 0.5, s * 0.12, s * 0.7, s * 0.06); ctx.fill();
  ctx.fillStyle = '#c8c8d0'; ctx.fillRect(-s * 0.08, s * 0.14, s * 0.16, s * 0.1);
  ctx.fillStyle = p.base; ctx.beginPath(); ctx.moveTo(-s * 0.08, s * 0.24); ctx.quadraticCurveTo(0, s * 0.56, s * 0.08, s * 0.24); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ================================================================ the cart and its road ====================================================
const stock = new Map();
function stockDesign(geom, seed) {
  const k = JSON.stringify(geom);
  let v = stock.get(k);
  if (!v) { const c = makeCommission({ geom, colors: COLORS.slice(0, 5), forbid: 0, distinct: false, givens: 0, seed }); v = { P: c.piece, a: c.sol }; stock.set(k, v); }
  return v;
}
export const STOCK_GEOM = { wheel: { kind: 'wheel', rings: 3, sectors: 12, fold: 3, mirror: false, hub: true }, panel: { kind: 'panel', cols: 12, rows: 3, mirrorX: true, mirrorY: false }, yoke: { kind: 'yoke', cols: 10, rows: 2, mirrorX: true, mirrorY: false } };
const sceneCache = new Map();
export function stockWheels() {
  if (!sceneCache.has('w')) {
    const geoms = [{ kind: 'wheel', rings: 3, sectors: 12, fold: 3, mirror: false, hub: true }, { kind: 'wheel', rings: 4, sectors: 16, fold: 4, mirror: true, hub: true }, { kind: 'wheel', rings: 3, sectors: 16, fold: 2, mirror: true, hub: true }];
    sceneCache.set('w', geoms.map((g, i) => { const c = makeCommission({ geom: g, colors: COLORS.slice(0, 5 + (i % 2)), forbid: 0, distinct: false, givens: 0, seed: 301 + i * 17 }); return { P: c.piece, a: c.sol, colors: c.colors }; }));
  }
  return sceneCache.get('w');
}
export const stockPanel = () => stockDesign(STOCK_GEOM.panel, 31);
export const stockYoke = () => stockDesign(STOCK_GEOM.yoke, 53);
// decorative colouring for thumbnails of pieces nobody has painted yet
export function thumbDesign(P, n) { return P.orbits.map((o, i) => COLORS[(i * 2 + Math.max(0, o.ring) + (i >> 2)) % Math.max(2, n)]); }

// Roll the cart: x is the world position in wheel radii, so the wheel turns exactly as far as it travels.
export function drawScene(ctx, rect, s, { P, a, kind, t, x, moving = true, marks = false }) {
  const sky = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h * 0.72);
  sky.addColorStop(0, '#6ec1ea'); sky.addColorStop(0.6, '#ffe6a8'); sky.addColorStop(1, '#ffc875');
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  ctx.fillStyle = sky; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const span = kind === 'yoke' ? 7.6 : 6.0, shift = kind === 'yoke' ? 1.3 : 0.45, u = Math.min(rect.w / span, rect.h * 0.255) * s, groundY = Math.max(rect.y + rect.h * 0.62, Math.min(rect.y + rect.h * 0.88, rect.y + rect.h * 0.5 + u * 1.9)), px = x * u;
  // sun
  ctx.fillStyle = 'rgba(255,255,230,0.9)'; ctx.beginPath(); ctx.arc(rect.x + rect.w * 0.78, rect.y + rect.h * 0.2, rect.h * 0.07, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,230,0.25)'; ctx.beginPath(); ctx.arc(rect.x + rect.w * 0.78, rect.y + rect.h * 0.2, rect.h * 0.11, 0, TAU); ctx.fill();
  // far hills and near hills (parallax)
  for (const [k, col, amp, base, sc] of [[0.12, '#5aa7a0', 0.12, 0.6, 0.0042], [0.28, '#3f8f62', 0.1, 0.68, 0.0065]]) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(rect.x, groundY);
    for (let i = 0; i <= 40; i++) { const gx = rect.x + (rect.w * i) / 40, wx = gx + px * k; ctx.lineTo(gx, rect.y + rect.h * (base - amp * (0.5 + 0.5 * Math.sin(wx * sc) * 0.7 + 0.3 * Math.sin(wx * sc * 2.3 + 1)))); }
    ctx.lineTo(rect.x + rect.w, groundY); ctx.closePath(); ctx.fill();
  }
  // coffee rows
  for (let i = -2; i < 14; i++) {
    const wx = i * u * 1.4 - ((px * 0.6) % (u * 1.4)), gx = rect.x + wx, gy = groundY - u * 0.05;
    ctx.fillStyle = '#1f7a45'; ctx.beginPath(); ctx.ellipse(gx, gy - u * 0.1, u * 0.34, u * 0.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c9322c'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(gx + (k - 1.5) * u * 0.14, gy - u * (0.12 + 0.05 * ((k * 3) % 2)), u * 0.03, 0, TAU); ctx.fill(); }
  }
  // road
  const rg = ctx.createLinearGradient(0, groundY, 0, rect.y + rect.h);
  rg.addColorStop(0, '#b98550'); rg.addColorStop(1, '#7a5230');
  ctx.fillStyle = rg; ctx.fillRect(rect.x, groundY, rect.w, rect.y + rect.h - groundY);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(rect.x, groundY, rect.w, 3);
  for (let i = -1; i < 16; i++) { const wx = i * u * 1.1 - (px % (u * 1.1)); ctx.fillStyle = 'rgba(60,35,15,0.35)'; ctx.beginPath(); ctx.ellipse(rect.x + wx, groundY + u * (0.3 + ((i * 5) % 4) * 0.15), u * 0.12, u * 0.04, 0, 0, TAU); ctx.fill(); }
  // dust kicked up behind the wheel while it rolls
  if (moving) {
    const dcx = rect.x + rect.w * 0.5 + u * shift - u * 0.9;
    for (let i = 0; i < 8; i++) {
      const ph = (x * 0.8 + i / 8) % 1, age = ph < 0 ? ph + 1 : ph;
      ctx.fillStyle = `rgba(232,202,152,${0.5 * (1 - age)})`;
      ctx.beginPath(); ctx.arc(dcx - age * u * 1.5, groundY - u * (0.04 + 0.28 * age + ((i * 7) % 5) * 0.02), u * (0.05 + 0.13 * age), 0, TAU); ctx.fill();
    }
  }
  // the cart, centred
  const cx = rect.x + rect.w * 0.5 + u * shift, bob = Math.sin(px * 0.02) * u * 0.012, cy = groundY - u * 1.0 + bob;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx, groundY + u * 0.04, u * 2.3, u * 0.12, 0, 0, TAU); ctx.fill();
  // bed, posts and side panel: the body sits behind the big wheel, which overlaps its lower part
  const panelBox = { x: cx - u * 2.0, y: cy - u * 1.92, w: u * 4.0, h: u * 1.22 };
  const sp = kind === 'panel' ? { P, a } : stockDesign(STOCK_GEOM.panel, 31);
  const wood = ctx.createLinearGradient(0, panelBox.y, 0, panelBox.y + panelBox.h + u * 0.3);
  wood.addColorStop(0, '#7a4a24'); wood.addColorStop(1, '#3c2210');
  rr(ctx, cx - u * 2.12, cy - u * 2.06, u * 4.24, u * 1.5, u * 0.09); ctx.fillStyle = wood; ctx.fill();                  // side frame
  drawPiece(ctx, sp.P, sp.a, fitRect(sp.P, panelBox), { t, marks: false });
  rr(ctx, cx - u * 2.3, cy - u * 0.62, u * 4.6, u * 0.22, u * 0.06); ctx.fillStyle = '#2e1a0b'; ctx.fill();            // bed plank
  ctx.fillStyle = 'rgba(255,220,160,0.25)'; ctx.fillRect(cx - u * 2.26, cy - u * 0.6, u * 4.52, u * 0.03);
  for (const sx of [-2.32, 2.16]) { rr(ctx, cx + sx * u, cy - u * 2.2, u * 0.16, u * 1.82, u * 0.05); ctx.fillStyle = '#5a3416'; ctx.fill(); ctx.fillStyle = 'rgba(255,220,160,0.25)'; ctx.fillRect(cx + sx * u + u * 0.02, cy - u * 2.2, u * 0.03, u * 1.82); }
  // pole, with the yoke board at its end when the piece being shown is a yoke
  ctx.strokeStyle = '#5a3416'; ctx.lineCap = 'round'; ctx.lineWidth = u * 0.14; ctx.beginPath(); ctx.moveTo(cx - u * 2.25, cy - u * 0.5); ctx.lineTo(cx - u * 3.5, cy - u * 0.12 + Math.sin(px * 0.03) * u * 0.012); ctx.stroke();
  if (kind === 'yoke') drawPiece(ctx, P, a, { x: cx - u * 4.75, y: cy - u * 0.5, w: u * 1.3, h: u * 0.7 }, { t });
  else { ctx.fillStyle = '#d9a93a'; ctx.beginPath(); ctx.arc(cx - u * 3.5, cy - u * 0.12, u * 0.1, 0, TAU); ctx.fill(); }
  // wheel (rolls)
  const wh = kind === 'wheel' ? { P, a } : stockDesign(STOCK_GEOM.wheel, 17);
  drawWheel(ctx, wh.P, wh.a, { x: cx - u, y: cy - u * 0 - u + u * 0, w: u * 2, h: u * 2 }, { rot: px / u, t, marks });
  ctx.restore();
}
export { HUB, pieceOf };

// What the 2D layer still draws on top of the 3D piece: colour marks, smudge badges (positions come from the 3D camera).
export function drawPieceOverlay(ctx, P, a, rect, o = {}) {
  const wheel = P.kind === 'wheel', U = v3.fit ? v3.fit.unit : 100, rot = o.rot || 0;
  const at = (m) => v3.project(...(wheel && rot ? rotPt(m, rot) : m));
  if (o.marks) for (const c of P.cells) {
    const col = a[c.orbit]; if (!col) continue;
    const [x, y] = at(c.mid);
    drawMark(ctx, col, x, y, U * (wheel ? (c.shape === 'disc' ? 0.07 : 0.062) : 0.2), PAINT[col].ink);
  }
  if (o.conflicts) for (const i of o.conflicts) {
    const e = P.edges[i], [x, y] = at(e.at), br = U * (wheel ? 0.042 : 0.17);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x + br * 0.12, y + br * 0.2, br, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff3b2e'; ctx.beginPath(); ctx.arc(x, y, br, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x - br * 0.28, y - br * 0.32, br * 0.36, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, br * 0.26); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - br * 0.45, y - br * 0.45); ctx.lineTo(x + br * 0.45, y + br * 0.45); ctx.moveTo(x + br * 0.45, y - br * 0.45); ctx.lineTo(x - br * 0.45, y + br * 0.45); ctx.stroke();
    ctx.restore();
  }
}
