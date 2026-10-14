// Pinisi painters: sea, islands, ships (top and side view), goods icons, compass. Pure canvas; every shape is a function of
// (state, time) so the picture is the same for the same inputs. Colours: lagoon teal, sand, coral red, brass gold.
import { hash, PORTS } from './engine.js';

export const DISPLAY = '"Cormorant Garamond", "Palatino Linotype", Georgia, serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const PAL = {
  deep: '#06222e', sea0: '#0b4a5e', sea1: '#127487', sea2: '#2aa3ad', foam: '#e8f6f2',
  sand: '#f1deb0', sandDk: '#c9a766', jungle: '#2f7d4f', jungleDk: '#1d5a3a', jungleHi: '#5fae6a',
  coral: '#e8553f', coralHi: '#ff7a5c', gold: '#f2c65a', goldDk: '#b8892b', cream: '#f8efd6', text: '#f6ead0', dim: '#a9c9c4',
  teak: '#9a6a32', ink: '#0b2430', panel: 'rgba(5,26,38,0.86)',
};
export const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const clamp01 = (v) => clamp(v, 0, 1);
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

// ---- sea ---------------------------------------------------------------------------------------------------------------------------
export function drawSea(ctx, r, t, wind, calm = false) {
  ctx.save();
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.3, r.y + r.h);
  g.addColorStop(0, PAL.sea1); g.addColorStop(0.55, PAL.sea0); g.addColorStop(1, '#073a4c');
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  // slow light pools
  for (let i = 0; i < 4; i++) {
    const cx = r.x + r.w * (0.15 + 0.7 * hash(3, i)), cy = r.y + r.h * (0.1 + 0.8 * hash(5, i)), rad = Math.max(r.w, r.h) * 0.4;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    rg.addColorStop(0, 'rgba(60,190,190,0.16)'); rg.addColorStop(1, 'rgba(60,190,190,0)');
    ctx.fillStyle = rg; ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  // wave strokes drift with the wind
  const dx = wind ? Math.cos(wind.dir) : 1, dy = wind ? Math.sin(wind.dir) : 0.2, sp = wind ? 12 + 26 * wind.str : 14;
  const cell = Math.max(46, Math.min(r.w, r.h) / 9), cols = Math.ceil(r.w / cell) + 2, rows = Math.ceil(r.h / cell) + 2;
  ctx.lineWidth = Math.max(1.6, cell * 0.045); ctx.lineCap = 'round';
  const off = calm ? 0 : t * sp;
  for (let j = -1; j < rows; j++) for (let i = -1; i < cols; i++) {
    const hx = hash(7, i, j), hy = hash(8, i, j);
    let x = r.x + i * cell + hx * cell, y = r.y + j * cell + hy * cell;
    x = r.x + (((x - r.x + dx * off) % (cols * cell)) + cols * cell) % (cols * cell) - cell;
    y = r.y + (((y - r.y + dy * off) % (rows * cell)) + rows * cell) % (rows * cell) - cell;
    const a = 0.1 + 0.12 * hash(9, i, j), w = cell * (0.28 + 0.18 * hash(10, i, j));
    ctx.strokeStyle = `rgba(220,250,245,${a})`;
    ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y - w * 0.35, x + w, y); ctx.stroke();
  }
  ctx.restore();
}

export function windStreaks(ctx, r, t, wind, calm) {
  if (calm || !wind) return;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const dx = Math.cos(wind.dir), dy = Math.sin(wind.dir), n = 5 + Math.round(wind.str * 7), len = 60 + wind.str * 70;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const sp = 90 + 140 * wind.str, u = ((t * sp * (0.7 + 0.6 * hash(21, i)) / (Math.max(r.w, r.h) * 1.4)) + hash(22, i)) % 1;
    const bx = r.x + r.w * hash(23, i), by = r.y + r.h * hash(24, i);
    const x = bx + dx * (u - 0.5) * r.w * 1.2, y = by + dy * (u - 0.5) * r.w * 1.2;
    const a = Math.sin(u * Math.PI) * 0.4;
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - dx * len / 2, y - dy * len / 2); ctx.lineTo(x + dx * len / 2, y + dy * len / 2); ctx.stroke();
  }
  ctx.restore();
}

// ---- islands ---------------------------------------------------------------------------------------------------------------------
function blob(ctx, cx, cy, rad, seed, k = 1) {
  const n = 40;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i % n) / n * TAU;
    const rr = rad * k * (1 + 0.22 * Math.sin(a * 2 + seed * 1.7) + 0.14 * Math.sin(a * 3 + seed * 3.1) + 0.08 * Math.sin(a * 5 + seed * 0.7));
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.82;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
export function drawIsland(ctx, cx, cy, rad, seed, t = 0, volcano = false) {
  ctx.save();
  blob(ctx, cx, cy + rad * 0.06, rad * 1.5, seed); ctx.fillStyle = 'rgba(70,200,195,0.22)'; ctx.fill();         // shallows
  blob(ctx, cx, cy + rad * 0.05, rad * 1.25, seed); ctx.fillStyle = 'rgba(120,225,205,0.30)'; ctx.fill();
  blob(ctx, cx, cy, rad * 1.07, seed); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();                       // surf line
  blob(ctx, cx, cy, rad, seed); ctx.fillStyle = PAL.sand; ctx.fill();
  const g = ctx.createRadialGradient(cx - rad * 0.2, cy - rad * 0.25, rad * 0.1, cx, cy, rad * 0.85);
  g.addColorStop(0, PAL.jungleHi); g.addColorStop(0.55, PAL.jungle); g.addColorStop(1, PAL.jungleDk);
  blob(ctx, cx, cy, rad, seed, 0.74); ctx.fillStyle = g; ctx.fill();
  if (volcano) {
    ctx.fillStyle = '#6a5a4a'; ctx.beginPath(); ctx.moveTo(cx - rad * 0.55, cy + rad * 0.15); ctx.lineTo(cx - rad * 0.12, cy - rad * 0.6); ctx.lineTo(cx + rad * 0.12, cy - rad * 0.6); ctx.lineTo(cx + rad * 0.55, cy + rad * 0.15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(cx + rad * 0.2, cy - rad * 0.8 - Math.sin(t) * 2, rad * 0.25, rad * 0.14, 0, 0, TAU); ctx.fill();
  } else {
    for (let i = 0; i < 4; i++) {                                                                                 // palm tufts
      const a = hash(seed, i) * TAU, d = rad * (0.15 + 0.35 * hash(seed, i, 2)), px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.8;
      ctx.fillStyle = PAL.jungleDk;
      for (let k = 0; k < 5; k++) { const aa = k / 5 * TAU; ctx.beginPath(); ctx.ellipse(px + Math.cos(aa) * rad * 0.1, py + Math.sin(aa) * rad * 0.08, rad * 0.12, rad * 0.04, aa, 0, TAU); ctx.fill(); }
    }
  }
  ctx.restore();
}
export function drawIslets(ctx, mapToScreen, scale, t) {
  const decor = [[0.16, 0.38, 0.02], [0.52, 0.5, 0.025], [0.62, 0.62, 0.016], [0.9, 0.82, 0.02], [0.14, 0.97, 0.018], [0.85, 0.12, 0.02], [0.3, 0.3, 0.024], [0.58, 0.12, 0.014], [0.95, 0.4, 0.018]];
  decor.forEach(([x, y, r], i) => { const p = mapToScreen(x, y); drawIsland(ctx, p.x, p.y, r * scale, 40 + i, t); });
}

// ---- compass and wind arrow ------------------------------------------------------------------------------------------------------
export function drawCompass(ctx, cx, cy, r, alpha = 0.85) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy);
  ctx.strokeStyle = PAL.sand; ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, TAU); ctx.lineWidth = 1; ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 - Math.PI / 2, long = i % 2 === 0, L = long ? r * 1.0 : r * 0.62;
    ctx.fillStyle = i === 0 ? PAL.coral : PAL.sand;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * L, Math.sin(a) * L);
    ctx.lineTo(Math.cos(a + 0.28) * r * 0.2, Math.sin(a + 0.28) * r * 0.2); ctx.lineTo(Math.cos(a - 0.28) * r * 0.2, Math.sin(a - 0.28) * r * 0.2);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = PAL.sand; ctx.font = `700 ${r * 0.34}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -r * 1.25);
  ctx.restore();
}
export function drawWindArrow(ctx, cx, cy, size, dir, str, col = PAL.foam) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(dir);
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(3, size * 0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const L = size * (0.7 + 0.3 * clamp01(str / 1.4));
  ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L * 0.7, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(L * 0.45, -size * 0.38); ctx.lineTo(L * 0.45, size * 0.38); ctx.closePath(); ctx.fill();
  const bars = str >= 1.4 ? 3 : str >= 0.95 ? 2 : str >= 0.55 ? 1 : 0;
  for (let i = 0; i < bars; i++) { const x = -L + i * size * 0.3; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - size * 0.18, -size * 0.3); ctx.stroke(); }
  ctx.restore();
}

// ---- ships -------------------------------------------------------------------------------------------------------------------------
const TIMBER_COL = { ironwood: ['#5a3420', '#3a2012', '#7a4a2a'], teak: ['#b88143', '#8a5a2a', '#d6a15f'], meranti: ['#c98a5c', '#a06438', '#e3b085'] };

// Top view, bow pointing along `heading`. Sails swing to leeward of `windDir`. len = hull length in units.
export function drawShipTop(ctx, x, y, len, heading, windDir, spec, setting = 'full', t = 0, anchored = false) {
  ctx.save(); ctx.translate(x, y);
  ctx.save(); ctx.rotate(heading + Math.sin(t * 1.4) * 0.03);
  const w = len * 0.28, col = TIMBER_COL[spec?.timber ?? 'teak'];
  ctx.fillStyle = 'rgba(0,20,30,0.35)'; ctx.beginPath(); ctx.ellipse(len * 0.04, w * 0.35, len * 0.52, w * 0.9, 0, 0, TAU); ctx.fill();
  // wake
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
  if (setting !== 'anchor') for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-len * 0.4, s * w * 0.45); ctx.quadraticCurveTo(-len * 0.8, s * w * 1.1, -len * 1.2, s * w * 1.5); ctx.stroke(); }
  // hull
  const hg = ctx.createLinearGradient(0, -w, 0, w); hg.addColorStop(0, col[2]); hg.addColorStop(0.5, col[0]); hg.addColorStop(1, col[1]);
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.moveTo(len * 0.52, 0); ctx.quadraticCurveTo(len * 0.25, -w * 1.0, -len * 0.1, -w * 0.95); ctx.lineTo(-len * 0.42, -w * 0.7); ctx.lineTo(-len * 0.46, w * 0.7); ctx.lineTo(-len * 0.1, w * 0.95); ctx.quadraticCurveTo(len * 0.25, w * 1.0, len * 0.52, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(30,12,4,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(40,20,8,0.35)';
  for (const s of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(len * 0.4, s * w * 0.2); ctx.quadraticCurveTo(0, s * w * 0.95, -len * 0.4, s * w * 0.65); ctx.stroke(); }
  // deck house
  ctx.fillStyle = '#d8b878'; ctx.beginPath(); ctx.roundRect(-len * 0.38, -w * 0.38, len * 0.2, w * 0.76, 3); ctx.fill();
  ctx.restore();
  // sails (drawn in world rotation so they swing off the wind side)
  const rel = ((windDir - heading) % TAU + TAU) % TAU, sideSign = rel < Math.PI ? 1 : -1;       // wind on the starboard (+) or port side
  const spread = setting === 'full' ? 1 : setting === 'reef' ? 0.55 : 0.2;
  const swing = clamp(Math.abs(Math.sin(rel)) * 0.9 + 0.1, 0.1, 1) * sideSign;
  const masts = [len * 0.1, -len * 0.18];
  masts.forEach((mx, k) => {
    const px = Math.cos(heading) * mx, py = Math.sin(heading) * mx;
    const a = heading + Math.PI + swing * 0.9 * (Math.PI / 2) * 0.55 * (anchored ? 0.1 : 1);
    const sl = len * (k === 0 ? 0.38 : 0.32) * spread;
    ctx.fillStyle = 'rgba(0,20,30,0.25)'; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + Math.cos(a - sideSign * 0.4) * sl * 0.6 + 4, py + Math.sin(a - sideSign * 0.4) * sl * 0.6 + 6, px + Math.cos(a) * sl + 4, py + Math.sin(a) * sl + 6); ctx.lineTo(px + 4, py + 6); ctx.fill();
    ctx.fillStyle = PAL.cream; ctx.strokeStyle = 'rgba(80,60,30,0.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(px, py);
    const bx = px + Math.cos(a) * sl, by = py + Math.sin(a) * sl, nx = -Math.sin(a), ny = Math.cos(a);
    ctx.quadraticCurveTo(px + Math.cos(a) * sl * 0.5 + nx * sl * 0.18 * sideSign * -1, py + Math.sin(a) * sl * 0.5 + ny * sl * 0.18 * sideSign * -1, bx, by);
    ctx.lineTo(px + Math.cos(heading) * len * 0.12, py + Math.sin(heading) * len * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a2c14'; ctx.beginPath(); ctx.arc(px, py, Math.max(2, len * 0.025), 0, TAU); ctx.fill();
  });
  ctx.restore();
}

// Cloth shading + seams for the sail path that is current on the context (call right after fill/stroke).
function sailShade(ctx, x0, y0, x1, y1, seams = 7) {
  ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(Math.min(x0, x1), 0, Math.max(x0, x1), 0);
  g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(0.5, 'rgba(255,240,210,0.0)'); g.addColorStop(1, 'rgba(110,70,30,0.34)');
  ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1) - 4, Math.min(y0, y1) - 4, Math.abs(x1 - x0) + 8, Math.abs(y1 - y0) + 8);
  ctx.strokeStyle = 'rgba(110,85,50,0.3)'; ctx.lineWidth = 1;
  for (let i = 1; i <= seams; i++) { const yy = y0 + ((y1 - y0) * i) / (seams + 1); ctx.beginPath(); ctx.moveTo(x0 - 4, yy); ctx.lineTo(x1 + 4, yy + (y1 - y0) * 0.012); ctx.stroke(); }
  ctx.restore();
}

// Side view of the ship being built or finished. build: 0..1 planks fraction (0 = keel and ribs only); rig: 0..1 sail reveal.
export function drawShipSide(ctx, cx, cy, W, spec, build = 1, rig = 1, t = 0, afloat = false) {
  const H = W * 0.62;
  ctx.save(); ctx.translate(cx - W / 2, cy);
  const col = TIMBER_COL[spec.timber] ?? TIMBER_COL.teak, sizeK = { prahu: 0.82, pinisi: 1, grand: 1.12 }[spec.size] ?? 1;
  const hw = W * 0.9 * (0.88 + 0.12 * sizeK), x0 = (W - hw) / 2, hh = H * 0.22 * sizeK;
  const sway = Math.sin(t * 1.1) * 0.012;
  ctx.translate(W / 2, hh); ctx.rotate(sway); ctx.translate(-W / 2, -hh);
  // water line shadow
  ctx.fillStyle = 'rgba(0,30,40,0.35)'; ctx.beginPath(); ctx.ellipse(W / 2, hh * 1.35, hw * 0.52, hh * 0.12, 0, 0, TAU); ctx.fill();
  const bowX = x0 + hw, sternX = x0, deckY = 0;
  const hullPath = (k) => {                                                                                 // k = fraction of the hull depth that is planked
    const dep = hh * k;
    ctx.beginPath();
    ctx.moveTo(sternX, deckY - hh * 0.12);
    ctx.quadraticCurveTo(sternX - hw * 0.02, deckY + dep * 0.6, sternX + hw * 0.12, deckY + dep);
    ctx.lineTo(bowX - hw * 0.18, deckY + dep);
    ctx.quadraticCurveTo(bowX - hw * 0.02, deckY + dep * 0.55, bowX + hw * 0.04, deckY - hh * 0.3);
    ctx.lineTo(bowX - hw * 0.05, deckY - hh * 0.04);
    ctx.quadraticCurveTo((sternX + bowX) / 2, deckY + hh * 0.1, sternX, deckY - hh * 0.12);
    ctx.closePath();
  };
  const rows = 6, filled = Math.floor(clamp01(build) * rows + 1e-6), partial = clamp01(build) * rows - filled;
  // ribs (always visible, the frame)
  ctx.strokeStyle = 'rgba(210,170,110,0.75)'; ctx.lineWidth = Math.max(2, W * 0.008);
  for (let i = 0; i <= 12; i++) {
    const u = i / 12, x = lerp(sternX + hw * 0.1, bowX - hw * 0.06, u), depth = hh * (0.55 + 0.45 * Math.sin(u * Math.PI)) * 0.92;
    ctx.beginPath(); ctx.moveTo(x, deckY); ctx.lineTo(x, deckY + depth); ctx.stroke();
  }
  ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = Math.max(4, W * 0.014);   // keel
  ctx.beginPath(); ctx.moveTo(sternX + hw * 0.08, deckY + hh); ctx.lineTo(bowX - hw * 0.14, deckY + hh); ctx.stroke();
  // planks: clip to the hull, fill strake by strake from the keel upward
  ctx.save(); hullPath(1); ctx.clip();
  const total = rows;
  for (let r = 0; r < total; r++) {
    const frac = r < filled ? 1 : r === filled ? partial : 0;
    if (frac <= 0) continue;
    const y1 = deckY + hh * (1 - r / total), y0 = deckY + hh * (1 - (r + 1) / total);
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, col[r % 2 ? 0 : 2]); g.addColorStop(1, col[r % 2 ? 1 : 0]);
    ctx.fillStyle = g;
    ctx.fillRect(sternX - hw * 0.05, y0 - 1, (hw * 1.15) * frac, y1 - y0 + 1);
    ctx.fillStyle = 'rgba(20,8,0,0.4)'; ctx.fillRect(sternX - hw * 0.05, y0 - 1, hw * 1.15 * frac, 2);
  }
  ctx.restore();
  hullPath(1); ctx.strokeStyle = 'rgba(25,10,2,0.8)'; ctx.lineWidth = Math.max(2, W * 0.006); ctx.stroke();
  // wale strake and a bright gunwale rail with stanchions, once the hull is planked
  if (build > 0.95) {
    ctx.save(); hullPath(1); ctx.clip();
    ctx.strokeStyle = 'rgba(40,18,6,0.55)'; ctx.lineWidth = Math.max(3, W * 0.011);
    ctx.beginPath(); ctx.moveTo(sternX, deckY + hh * 0.2); ctx.quadraticCurveTo((sternX + bowX) / 2, deckY + hh * 0.34, bowX, deckY + hh * 0.08); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,225,170,0.35)'; ctx.lineWidth = Math.max(1.5, W * 0.004);
    ctx.beginPath(); ctx.moveTo(sternX, deckY + hh * 0.26); ctx.quadraticCurveTo((sternX + bowX) / 2, deckY + hh * 0.4, bowX, deckY + hh * 0.14); ctx.stroke();
    ctx.restore();
    // waterline: darker bottom paint
    ctx.save(); hullPath(1); ctx.clip(); const wl = ctx.createLinearGradient(0, deckY + hh * 0.72, 0, deckY + hh); wl.addColorStop(0, 'rgba(20,6,0,0)'); wl.addColorStop(1, 'rgba(20,6,0,0.5)'); ctx.fillStyle = wl; ctx.fillRect(sternX - hw * 0.1, deckY + hh * 0.7, hw * 1.3, hh * 0.4); ctx.restore();
  }
  // gunwale
  ctx.strokeStyle = '#e8c690'; ctx.lineWidth = Math.max(3, W * 0.01);
  if (build > 0.95) {
    ctx.beginPath(); ctx.moveTo(sternX, deckY - hh * 0.12); ctx.quadraticCurveTo((sternX + bowX) / 2, deckY + hh * 0.1, bowX - hw * 0.05, deckY - hh * 0.04); ctx.stroke();
  }
  // deckhouse
  if (build > 0.95) {
    const cx0 = sternX + hw * 0.07, cw = hw * 0.22, cy0 = deckY - hh * 0.52, chh = hh * 0.5;
    const cg = ctx.createLinearGradient(0, cy0, 0, cy0 + chh); cg.addColorStop(0, '#f0d9a2'); cg.addColorStop(1, '#c79a5a');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect(cx0, cy0, cw, chh, 3); ctx.fill(); ctx.strokeStyle = 'rgba(40,20,6,0.7)'; ctx.lineWidth = Math.max(1.5, W * 0.0035); ctx.stroke();
    ctx.fillStyle = '#6a4220'; ctx.beginPath(); ctx.roundRect(cx0 - hw * 0.012, cy0 - hh * 0.07, cw + hw * 0.024, hh * 0.09, 2); ctx.fill();           // roof
    ctx.fillStyle = '#2c3a40'; for (let q = 0; q < 2; q++) ctx.fillRect(cx0 + cw * (0.14 + q * 0.42), cy0 + chh * 0.25, cw * 0.28, chh * 0.34);        // windows
  }
  // rig
  const rv = clamp01(rig);
  if (rv > 0) {
    const mastH = H * 0.78 * sizeK * (0.7 + 0.3 * rv);
    const lean = spec.rig === 'lean' ? 1.12 : spec.rig === 'storm' ? 0.88 : 1;
    const masts = [sternX + hw * 0.58, sternX + hw * 0.31];
    ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = Math.max(4, W * 0.012); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bowX - hw * 0.08, deckY - hh * 0.05); ctx.lineTo(bowX + hw * 0.16, deckY - hh * 0.4); ctx.stroke();       // bowsprit
    masts.forEach((mx, k) => {
      const mh = mastH * (k === 0 ? 0.9 : 1) * lean;
      ctx.strokeStyle = '#5a3a1c'; ctx.beginPath(); ctx.moveTo(mx, deckY); ctx.lineTo(mx - W * 0.012, deckY - mh); ctx.stroke();
      const flap = Math.sin(t * 2 + k) * 0.015 * W;
      // main (gaff) sail and topsail
      const sx0 = mx - hw * 0.2, gaffY = deckY - mh * 0.55, topY = deckY - mh * 0.98;
      ctx.fillStyle = PAL.cream; ctx.strokeStyle = 'rgba(90,70,40,0.7)'; ctx.lineWidth = 1.5;
      ctx.globalAlpha = rv;
      ctx.beginPath(); ctx.moveTo(mx - 2, deckY - hh * 0.2); ctx.lineTo(mx - 2, gaffY); ctx.lineTo(sx0 + flap, gaffY + (deckY - gaffY) * 0.15); ctx.quadraticCurveTo(sx0 + hw * 0.1, deckY - hh * 0.6, sx0 + hw * 0.04, deckY - hh * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); sailShade(ctx, sx0, gaffY, mx, deckY - hh * 0.2, 8);
      ctx.beginPath(); ctx.moveTo(mx - 3, gaffY - 2); ctx.lineTo(mx - 4, topY); ctx.lineTo(mx - hw * 0.14 + flap, gaffY - mh * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke(); sailShade(ctx, mx - hw * 0.14, topY, mx, gaffY, 4);
      ctx.globalAlpha = 1;
    });
    // standing rigging: forestay to the bowsprit, backstay to the stern, shrouds
    ctx.strokeStyle = 'rgba(40,24,10,0.75)'; ctx.lineWidth = Math.max(1, W * 0.0025); ctx.globalAlpha = rv;
    { const fT = deckY - mastH * 0.9 * lean, mT = deckY - mastH * lean; const fx = masts[0], mx2 = masts[1];
      ctx.beginPath(); ctx.moveTo(fx, fT); ctx.lineTo(bowX + hw * 0.16, deckY - hh * 0.4);
      ctx.moveTo(mx2, mT); ctx.lineTo(sternX + hw * 0.02, deckY - hh * 0.1);
      ctx.moveTo(fx, fT); ctx.lineTo(mx2, mT);
      for (const m of [fx, mx2]) { const top = deckY - mastH * 0.8 * lean; ctx.moveTo(m, top); ctx.lineTo(m - hw * 0.07, deckY - hh * 0.04); ctx.moveTo(m, top); ctx.lineTo(m + hw * 0.07, deckY - hh * 0.04); }
      ctx.stroke(); }
    ctx.globalAlpha = 1;
    // three jibs between bowsprit tip and the fore mast
    ctx.globalAlpha = rv; ctx.fillStyle = '#fbf3dc';
    const tipX = bowX + hw * 0.16, tipY = deckY - hh * 0.4, foreX = masts[0], foreTop = deckY - mastH * 0.9 * lean * 0.85;
    for (let j = 0; j < 3; j++) {
      const u0 = j / 3, u1 = (j + 1) / 3;
      const ax = lerp(tipX, foreX, u0), ay = lerp(tipY, foreTop, u0), bx = lerp(tipX, foreX, u1), by = lerp(tipY, foreTop, u1);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(lerp(bowX - hw * 0.04, bowX - hw * 0.06, u1), deckY - hh * 0.06); ctx.closePath(); ctx.fill(); ctx.stroke();
      sailShade(ctx, Math.min(ax, bx), Math.min(ay, by, deckY - hh * 0.06), Math.max(ax, bx), deckY - hh * 0.06, 4);
    }
    ctx.globalAlpha = 1;
  }
  if (afloat) {
    // sit the hull in the sea: a translucent wavy water band over the lower hull, foam line, bow wave
    const wl = deckY + hh * 0.8, amp = hh * 0.05, x1 = x0 - hw * 0.1, x2 = x0 + hw * 1.12;
    ctx.beginPath(); ctx.moveTo(x1, wl + hh);
    for (let x = x1; x <= x2; x += hw * 0.02) ctx.lineTo(x, wl + Math.sin(x * 0.045 + t * 1.6) * amp + Math.sin(x * 0.019 - t) * amp * 0.8);
    ctx.lineTo(x2, wl + hh); ctx.closePath();
    ctx.save(); ctx.clip();
    const mx = (x1 + x2) / 2, rx = (x2 - x1) / 2;
    ctx.translate(mx, wl); ctx.scale(1, (hh * 0.62) / rx);
    const wg = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
    wg.addColorStop(0, 'rgba(60,160,185,0.85)'); wg.addColorStop(0.7, 'rgba(20,100,125,0.55)'); wg.addColorStop(1, 'rgba(8,60,80,0)');
    ctx.fillStyle = wg; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
    const fg = ctx.createLinearGradient(x1, 0, x2, 0); fg.addColorStop(0, 'rgba(235,250,250,0)'); fg.addColorStop(0.15, 'rgba(235,250,250,0.8)'); fg.addColorStop(0.85, 'rgba(235,250,250,0.8)'); fg.addColorStop(1, 'rgba(235,250,250,0)');
    ctx.strokeStyle = fg; ctx.lineWidth = Math.max(2, W * 0.005); ctx.beginPath();
    for (let x = x1; x <= x2; x += hw * 0.02) { const y = wl + Math.sin(x * 0.045 + t * 1.6) * amp + Math.sin(x * 0.019 - t) * amp * 0.8; if (x === x1) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
}

// ---- goods icons ------------------------------------------------------------------------------------------------------------------
export function drawGood(ctx, id, cx, cy, s) {
  ctx.save(); ctx.translate(cx, cy); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lw = Math.max(1.5, s * 0.06);
  if (id === 'cloves') {
    ctx.strokeStyle = '#5a2a14'; ctx.fillStyle = '#7a3a1c'; ctx.lineWidth = lw;
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.6; ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, s * 0.42); ctx.lineTo(0, -s * 0.15); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -s * 0.22, s * 0.12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#9a5a2a'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(Math.cos(k * 1.57) * s * 0.12, -s * 0.22 + Math.sin(k * 1.57) * s * 0.12, s * 0.05, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#7a3a1c'; ctx.restore();
    }
  } else if (id === 'nutmeg') {
    ctx.fillStyle = '#c9a56a'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.3, s * 0.38, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a6a34'; ctx.lineWidth = lw; ctx.stroke();
    ctx.strokeStyle = '#a8803e'; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * s * 0.1, -s * 0.28); ctx.quadraticCurveTo(k * s * 0.14, 0, k * s * 0.1, s * 0.28); ctx.stroke(); }
    ctx.fillStyle = '#e04a30'; ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.36); ctx.quadraticCurveTo(s * 0.45, -s * 0.2, s * 0.28, s * 0.2); ctx.quadraticCurveTo(s * 0.3, -s * 0.05, s * 0.1, -s * 0.2); ctx.fill();
  } else if (id === 'sandalwood') {
    for (let i = 0; i < 3; i++) {
      const y = (i - 1) * s * 0.26;
      ctx.fillStyle = '#d8b07a'; ctx.beginPath(); ctx.roundRect(-s * 0.42, y - s * 0.1, s * 0.84, s * 0.2, s * 0.1); ctx.fill();
      ctx.strokeStyle = '#8a6030'; ctx.lineWidth = lw; ctx.stroke();
      ctx.fillStyle = '#efd2a0'; ctx.beginPath(); ctx.ellipse(s * 0.4, y, s * 0.06, s * 0.1, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }
  } else if (id === 'copra') {
    ctx.fillStyle = '#6a4326'; ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f6f0e0'; ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.3, 0.2, Math.PI - 0.2); ctx.fill();
    ctx.fillStyle = '#4a2c14'; ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.1, s * 0.035, 0, TAU); ctx.arc(s * 0.1, -s * 0.1, s * 0.035, 0, TAU); ctx.arc(0, s * 0.0, s * 0.035, 0, TAU); ctx.fill();
  } else if (id === 'rice') {
    ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.4); ctx.quadraticCurveTo(-s * 0.46, 0, -s * 0.22, -s * 0.28); ctx.lineTo(s * 0.22, -s * 0.28); ctx.quadraticCurveTo(s * 0.46, 0, s * 0.3, s * 0.4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a89870'; ctx.lineWidth = lw; ctx.stroke();
    ctx.fillStyle = '#c9b88a'; ctx.fillRect(-s * 0.24, -s * 0.34, s * 0.48, s * 0.1);
    ctx.fillStyle = '#e8b040'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(-s * 0.08 + k * s * 0.08, -s * 0.42 - k % 2 * s * 0.03, s * 0.025, s * 0.07, 0.4, 0, TAU); ctx.fill(); }
  } else if (id === 'teak') {
    for (let i = 0; i < 3; i++) {
      const y = s * 0.26 - i * s * 0.22;
      ctx.fillStyle = i % 2 ? '#a77540' : '#8a5a2c'; ctx.beginPath(); ctx.roundRect(-s * 0.42 + i * s * 0.04, y - s * 0.09, s * 0.8, s * 0.18, 2); ctx.fill();
      ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = lw; ctx.stroke();
    }
  } else if (id === 'cloth') {
    ctx.fillStyle = '#d83f4f'; ctx.beginPath(); ctx.roundRect(-s * 0.4, -s * 0.2, s * 0.8, s * 0.42, s * 0.06); ctx.fill();
    ctx.fillStyle = '#f2c65a'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-s * 0.3 + k * s * 0.2, -s * 0.2); ctx.lineTo(-s * 0.2 + k * s * 0.2, 0); ctx.lineTo(-s * 0.3 + k * s * 0.2, s * 0.22); ctx.lineTo(-s * 0.38 + k * s * 0.2, 0); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = '#7a1c28'; ctx.lineWidth = lw; ctx.beginPath(); ctx.roundRect(-s * 0.4, -s * 0.2, s * 0.8, s * 0.42, s * 0.06); ctx.stroke();
    ctx.fillStyle = '#f0e0c0'; ctx.beginPath(); ctx.ellipse(s * 0.4, 0.01 * s, s * 0.06, s * 0.21, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- port marker, route lines, particles ------------------------------------------------------------------------------------------
export function drawPortMarker(ctx, x, y, r, o = {}) {
  ctx.save();
  if (o.sel) { ctx.strokeStyle = 'rgba(255,230,140,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * (1.5 + 0.12 * Math.sin((o.t ?? 0) * 5)), 0, TAU); ctx.stroke(); }
  ctx.fillStyle = o.here ? PAL.coral : PAL.gold; ctx.strokeStyle = PAL.deep; ctx.lineWidth = Math.max(2, r * 0.22);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PAL.deep; ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, TAU); ctx.fill();
  if (o.yard) { ctx.fillStyle = PAL.deep; ctx.fillRect(x - r * 0.12, y - r * 2.1, r * 0.24, r * 1.2); ctx.fillRect(x - r * 0.6, y - r * 1.75, r * 1.2, r * 0.2); }
  ctx.restore();
}
export function dottedRoute(ctx, ax, ay, bx, by, o = {}) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = o.col ?? 'rgba(248,239,214,0.5)'; ctx.lineWidth = o.w ?? 3; ctx.setLineDash(o.dash ?? [2, 10]);
  ctx.lineDashOffset = -(o.t ?? 0) * (o.flow ?? 0);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore();
}
export function burst(parts, rng, x, y, kind, n, speed, col, size) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), v = rng.range(0.3, 1) * speed * 160;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'coin' ? 120 : 0), age: 0, life: rng.range(0.5, 0.95), kind, col, size: size * rng.range(0.6, 1.1) });
  }
}
export function stepParticles(parts, dt) {
  for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'coin' ? 420 : 120) * dt; p.vx *= 0.985; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
}
export function drawParticles(ctx, parts) {
  ctx.save();
  for (const p of parts) {
    const a = 1 - p.age / p.life; ctx.globalAlpha = clamp01(a * 1.4);
    ctx.fillStyle = p.col;
    if (p.kind === 'coin') { ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 0.5, p.size * (0.5 + 0.5 * Math.abs(Math.sin(p.age * 12))), 0, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * a), 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}
export const portSeed = (i) => 3 + i * 7 + PORTS.length;
