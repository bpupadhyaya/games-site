// Static art, an illuminated manuscript: a leather-bound desk, a vellum board edged in gold leaf and lapis, and ivory and ink pieces.
// One light, from the upper left. The board is painted ONCE per size (OffscreenCanvas) and drawn scaled; where OffscreenCanvas does not
// exist (headless tests) the same painter draws directly.
import { host, FRAME, THICK } from './layout.js';
import { shapeOf, sideOf, valOf, ROUND, TRI, SQR } from './rules.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.4, 3);
const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';

export const GOLD = ['#fff0a8', '#e9c35a', '#b98a28', '#f4d77a', '#8a6218'];
export const INKS = { lapis: '#233f86', lapisDark: '#142a5c', verm: '#c2381f', ink: '#2a1b10', parch: ['#f6e8c0', '#e8d29b'] };
const goldGrad = (ctx, x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, GOLD[0]); g.addColorStop(0.25, GOLD[1]); g.addColorStop(0.5, GOLD[2]); g.addColorStop(0.72, GOLD[3]); g.addColorStop(1, GOLD[4]); return g; };

// ------------------------------------------------------------------------------------------------ the desk
export function drawTable(ctx, L, t = 0) {
  const { w, h } = L;
  const bg = ctx.createLinearGradient(0, 0, w * 0.3, h);
  bg.addColorStop(0, '#2c1620'); bg.addColorStop(0.5, '#1e0f17'); bg.addColorStop(1, '#120a10');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // gold tooling: a faint lattice of small diamonds, like stamped leather
  ctx.strokeStyle = 'rgba(233,195,90,0.055)'; ctx.lineWidth = 1.2; ctx.beginPath();
  const step = 46;
  for (let x = -h; x < w + h; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.moveTo(x + h, 0); ctx.lineTo(x, h); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(233,195,90,0.07)';
  for (let y = step / 2; y < h; y += step) for (let x = ((y / step) % 2 ? step / 2 : 0) + step / 2; x < w; x += step) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill(); }
  const b = L.board, cx = b ? b.x + b.W / 2 : w / 2, cy = b ? b.y + b.H / 2 : h / 2, rad = Math.max(w, h) * 0.62;
  const lamp = ctx.createRadialGradient(cx - rad * 0.12, cy - rad * 0.2, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,214,150,0.22)'); lamp.addColorStop(0.45, 'rgba(255,190,120,0.07)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one cell = 100. Grid position (u across, v down); the home camps depend on the orientation.
function paintBoard(ctx, tall, flip) {
  const cols = tall ? 8 : 16, rows = tall ? 16 : 8, F = FRAME * 100, W = cols * 100 + 2 * F, H = rows * 100 + 2 * F, rnd = lcg(311);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  // the slab's lower edge (thickness)
  const th = THICK * 100;
  const eg = ctx.createLinearGradient(0, H - 10, 0, H + th); eg.addColorStop(0, '#4a2a1e'); eg.addColorStop(1, '#1d0f0b');
  ctx.fillStyle = eg; rr(0, 24, W, H - 24 + th, 20); ctx.fill();
  ctx.fillStyle = 'rgba(255,220,150,0.2)'; ctx.fillRect(18, H + 1, W - 36, 2.5);
  // frame: dark leather edge, gold band, lapis band with gold studs, fine gold line
  const fg = ctx.createLinearGradient(0, 0, W, H); fg.addColorStop(0, '#5a2c24'); fg.addColorStop(0.5, '#3d1c1a'); fg.addColorStop(1, '#2a1213');
  ctx.fillStyle = fg; rr(0, 0, W, H, 20); ctx.fill();
  ctx.fillStyle = goldGrad(ctx, 0, 0, W, H); rr(7, 7, W - 14, H - 14, 15); ctx.fill();
  ctx.strokeStyle = 'rgba(80,50,10,0.55)'; ctx.lineWidth = 2; rr(7, 7, W - 14, H - 14, 15); ctx.stroke();
  const lg = ctx.createLinearGradient(0, 0, W, H); lg.addColorStop(0, '#2d4f9e'); lg.addColorStop(0.5, '#1c3677'); lg.addColorStop(1, '#122552');
  ctx.fillStyle = lg; rr(20, 20, W - 40, H - 40, 9); ctx.fill();
  // leaf-pattern in the lapis band: a repeated small flourish
  ctx.save(); rr(20, 20, W - 40, H - 40, 9); ctx.clip();
  ctx.strokeStyle = 'rgba(244,215,122,0.55)'; ctx.lineWidth = 1.6; ctx.fillStyle = 'rgba(244,215,122,0.85)';
  const stud = (x, y, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-9, 0); ctx.quadraticCurveTo(-4.5, -6, 0, 0); ctx.quadraticCurveTo(4.5, 6, 9, 0); ctx.stroke(); ctx.restore(); };
  for (let x = 40; x < W - 30; x += 36) { stud(x, 33, 0); stud(x, H - 33, 0); }
  for (let y = 40; y < H - 30; y += 36) { stud(33, y, Math.PI / 2); stud(W - 33, y, Math.PI / 2); }
  ctx.restore();
  ctx.strokeStyle = goldGrad(ctx, 0, 0, W, H); ctx.lineWidth = 3; rr(20, 20, W - 40, H - 40, 9); ctx.stroke();
  ctx.fillStyle = goldGrad(ctx, 0, 0, W, H); rr(F - 12, F - 12, W - 2 * F + 24, H - 2 * F + 24, 4); ctx.fill();
  // corner rosettes
  const rosette = (cx, cy) => {
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = goldGrad(ctx, -22, -22, 22, 22); ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU); ctx.fill();
    ctx.fillStyle = INKS.verm; ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.fill();
    ctx.fillStyle = INKS.lapis; for (let k = 0; k < 4; k++) { ctx.save(); ctx.rotate(k * Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, -9, 4.5, 8, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = GOLD[0]; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.fill();
    ctx.restore();
  };
  rosette(26, 26); rosette(W - 26, 26); rosette(26, H - 26); rosette(W - 26, H - 26);
  // the parchment: warm base, fibres, stains, then the checkered cells
  const gx = F, gy = F, GW = cols * 100, GH = rows * 100;
  ctx.save(); rr(gx - 6, gy - 6, GW + 12, GH + 12, 3); ctx.clip();
  const pg = ctx.createLinearGradient(gx, gy, gx + GW, gy + GH); pg.addColorStop(0, '#f8ecc6'); pg.addColorStop(0.5, '#efdcaa'); pg.addColorStop(1, '#e6cd92');
  ctx.fillStyle = pg; ctx.fillRect(gx - 6, gy - 6, GW + 12, GH + 12);
  for (let v = 0; v < rows; v++) for (let u = 0; u < cols; u++) {
    const dark = (u + v) % 2 === 1, t = rnd();
    ctx.fillStyle = dark ? `rgba(168,118,48,${0.14 + t * 0.07})` : `rgba(255,248,224,${0.12 + t * 0.1})`; ctx.fillRect(gx + u * 100, gy + v * 100, 100, 100);
  }
  for (let k = 0; k < Math.round(GW * GH / 2600); k++) {            // fibres
    const x = gx + rnd() * GW, y = gy + rnd() * GH, a = rnd() * TAU, l = 6 + rnd() * 18;
    ctx.strokeStyle = rnd() < 0.5 ? `rgba(120,80,30,${0.05 + rnd() * 0.07})` : `rgba(255,250,230,${0.08 + rnd() * 0.1})`; ctx.lineWidth = 0.8 + rnd();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5 - 3, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  for (let k = 0; k < 7; k++) {                                      // age stains
    const x = gx + rnd() * GW, y = gy + rnd() * GH, rad = 90 + rnd() * 200, sg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    sg.addColorStop(0, 'rgba(150,100,40,0.10)'); sg.addColorStop(1, 'rgba(150,100,40,0)'); ctx.fillStyle = sg; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // the two camps: Ink's end a little darker, Ivory's end a little paler
  const inkFirst = tall ? !flip : flip;                // is the Ink camp at grid-start (top / left)?
  const camp = (start, len, ivory) => {
    const x0 = tall ? gx : gx + start * 100, y0 = tall ? gy + start * 100 : gy, w2 = tall ? GW : len * 100, h2 = tall ? len * 100 : GH;
    ctx.fillStyle = ivory ? 'rgba(255,255,250,0.2)' : 'rgba(70,40,15,0.13)'; ctx.fillRect(x0, y0, w2, h2);
  };
  const half = tall ? rows / 2 : cols / 2;
  camp(0, half, !inkFirst); camp(half, half, inkFirst);
  // grid lines in iron-gall ink
  ctx.strokeStyle = 'rgba(70,40,15,0.7)'; ctx.lineWidth = 2.2; ctx.beginPath();
  for (let u = 0; u <= cols; u++) { ctx.moveTo(gx + u * 100, gy); ctx.lineTo(gx + u * 100, gy + GH); }
  for (let v = 0; v <= rows; v++) { ctx.moveTo(gx, gy + v * 100); ctx.lineTo(gx + GW, gy + v * 100); }
  ctx.stroke();
  // inner shading: the vellum sits slightly sunk
  const ish = (x0, y0, x1, y1, w0, h0, a) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(40,20,5,${a})`); g.addColorStop(1, 'rgba(40,20,5,0)'); ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), w0, h0); };
  ish(gx, gy, gx, gy + 36, GW, 36, 0.3); ish(gx, gy, gx + 30, gy, 30, GH, 0.22);
  ctx.restore();
  // the river between the camps: a gold-edged band with a chain of lozenges
  const mid = (tall ? rows : cols) / 2 * 100, bw = 34;
  ctx.save();
  const bx = tall ? gx - 6 : gx + mid - bw / 2, by = tall ? gy + mid - bw / 2 : gy - 6, bwid = tall ? GW + 12 : bw, bhei = tall ? bw : GH + 12;
  const rg = ctx.createLinearGradient(tall ? 0 : bx, tall ? by : 0, tall ? 0 : bx + bw, tall ? by + bw : 0); rg.addColorStop(0, '#2a4a98'); rg.addColorStop(0.5, '#1a3274'); rg.addColorStop(1, '#122552');
  ctx.fillStyle = rg; ctx.fillRect(bx, by, bwid, bhei);
  ctx.fillStyle = goldGrad(ctx, bx, by, bx + bwid, by + bhei);
  if (tall) { ctx.fillRect(bx, by - 3, bwid, 4); ctx.fillRect(bx, by + bw - 1, bwid, 4); } else { ctx.fillRect(bx - 3, by, 4, bhei); ctx.fillRect(bx + bw - 1, by, 4, bhei); }
  const n = Math.floor((tall ? GW : GH) / 50);
  for (let k = 0; k < n; k++) {
    const cxl = tall ? gx + 25 + k * 50 : bx + bw / 2, cyl = tall ? by + bw / 2 : gy + 25 + k * 50;
    ctx.save(); ctx.translate(cxl, cyl); ctx.rotate(Math.PI / 4); ctx.fillStyle = k % 2 ? INKS.verm : 'rgba(244,215,122,0.95)'; ctx.fillRect(-7, -7, 14, 14); ctx.restore();
  }
  ctx.restore();
  // soft light across the whole top
  const lgt = ctx.createLinearGradient(0, 0, W, H); lgt.addColorStop(0, 'rgba(255,245,215,0.16)'); lgt.addColorStop(0.5, 'rgba(255,245,215,0)'); lgt.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = lgt; rr(0, 0, W, H, 20); ctx.fill();
}
const boardCache = new Map();
export function drawBoard(ctx, B) {
  const { x, y, W, H, tall, flip } = B;
  // contact shadow on the desk
  ctx.save();
  for (let k = 4; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.09 + (4 - k) * 0.015})`; ctx.beginPath(); ctx.roundRect(x - 3 * k + 6, y + 16 + 2 * k, W + 6 * k - 12, H + THICK * B.cell - 8 + 3 * k, 24 + 3 * k); ctx.fill(); }
  ctx.restore();
  const key = `${tall ? 't' : 'w'}${flip ? 1 : 0}|${Math.round(W)}x${Math.round(H)}|${Math.round(px() * 20)}`;
  let spr = boardCache.get(key);
  const lw = W / B.cell * 100, lh = (H / B.cell) * 100 + THICK * 100;
  if (spr === undefined) {
    const sc = clamp(B.cell / 100 * px(), 0.1, 2.2), m = mk(lw * sc, lh * sc);
    if (m) { m.x.scale(sc, sc); paintBoard(m.x, tall, flip); spr = { c: m.c, sc }; } else spr = null;
    boardCache.set(key, spr); if (boardCache.size > 8) boardCache.delete(boardCache.keys().next().value);
  }
  ctx.save(); ctx.translate(x, y);
  if (spr) ctx.drawImage(spr.c, 0, 0, lw * B.cell / 100, lh * B.cell / 100);
  else { ctx.scale(B.cell / 100, B.cell / 100); paintBoard(ctx, tall, flip); }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ the pieces
const FACES = {
  1: { top: ['#fffbee', '#f3e4bb', '#d8bd84'], rim: ['#b79b5c', '#7d6431'], num: '#17275f', numHi: 'rgba(255,255,255,0.8)', ring: '#2c4fa0', ring2: '#d9a93a' },
  2: { top: ['#585066', '#2c2538', '#120e1b'], rim: ['#0d0a12', '#000000'], num: '#f6d98a', numHi: 'rgba(0,0,0,0.9)', ring: '#e9c35a', ring2: '#8a6218' },
};
function shapePath(ctx, shape, x, y, s, ang) {
  ctx.beginPath();
  if (shape === ROUND) ctx.arc(x, y, s * 0.4, 0, TAU);
  else if (shape === SQR) ctx.roundRect(x - s * 0.355, y - s * 0.355, s * 0.71, s * 0.71, s * 0.09);
  else {
    const R = s * 0.54, cy = y + R * 0.08;                              // circumradius; apex points toward `ang` (0 = up)
    for (let k = 0; k < 3; k++) { const a = ang - Math.PI / 2 + k * TAU / 3; const px2 = x + Math.cos(a) * R, py2 = cy + Math.sin(a) * R; if (k) ctx.lineTo(px2, py2); else ctx.moveTo(px2, py2); }
    ctx.closePath();
  }
}
// opts: lift (0..1.2 cells raised), glow (0..1), flash (0..1), alpha, scale, tilt (radians), ang (triangle apex direction), mini (no number shadow)
export function drawPiece(ctx, code, x, y, cell, o = {}) {
  const side = sideOf(code), shape = shapeOf(code), val = valOf(code), f = FACES[side];
  const sc = o.scale ?? 1, s = cell * sc, lift = (o.lift ?? 0) * cell * 0.22, th = s * 0.085, ang = o.ang ?? 0;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (o.tilt) { ctx.translate(x, y); ctx.rotate(o.tilt); ctx.translate(-x, -y); }
  const cy = y - lift;
  if (o.glow) {
    const gr = ctx.createRadialGradient(x, cy, s * 0.1, x, cy, s * 0.8);
    gr.addColorStop(0, `rgba(255,224,120,${0.55 * o.glow})`); gr.addColorStop(1, 'rgba(255,224,120,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, cy, s * 0.8, 0, TAU); ctx.fill();
  }
  // soft shadow on the board (further away and fainter when lifted)
  ctx.fillStyle = `rgba(30,12,2,${0.34 - Math.min(0.14, lift / cell)})`;
  shapePath(ctx, shape, x + s * 0.045 + lift * 0.2, y + th + s * 0.07 + lift * 0.5, s * 1.02, ang); ctx.fill();
  // thickness
  shapePath(ctx, shape, x, cy + th, s, ang);
  const rg = ctx.createLinearGradient(0, cy, 0, cy + th + s * 0.4); rg.addColorStop(0, f.rim[0]); rg.addColorStop(1, f.rim[1]); ctx.fillStyle = rg; ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.strokeStyle = side === 1 ? 'rgba(90,60,20,0.8)' : 'rgba(0,0,0,0.9)'; ctx.stroke();
  // top face
  shapePath(ctx, shape, x, cy, s, ang);
  const tg = ctx.createLinearGradient(x - s * 0.4, cy - s * 0.45, x + s * 0.4, cy + s * 0.45); tg.addColorStop(0, f.top[0]); tg.addColorStop(0.55, f.top[1]); tg.addColorStop(1, f.top[2]);
  ctx.fillStyle = tg; ctx.fill();
  ctx.lineWidth = Math.max(1.2, s * 0.045); ctx.strokeStyle = goldGrad(ctx, x - s * 0.4, cy - s * 0.4, x + s * 0.4, cy + s * 0.4); ctx.stroke();
  // inner ring
  shapePath(ctx, shape, x, cy + (shape === TRI ? s * 0.02 : 0), s * 0.8, ang);
  ctx.lineWidth = Math.max(1, s * 0.022); ctx.strokeStyle = f.ring; ctx.globalAlpha = (o.alpha ?? 1) * 0.75; ctx.stroke(); ctx.globalAlpha = o.alpha ?? 1;
  // specular
  ctx.save(); shapePath(ctx, shape, x, cy, s, ang); ctx.clip();
  const sp = ctx.createRadialGradient(x - s * 0.18, cy - s * 0.25, 0, x - s * 0.18, cy - s * 0.25, s * 0.5); sp.addColorStop(0, side === 1 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.fillRect(x - s, cy - s, 2 * s, 2 * s);
  if (o.flash) { ctx.fillStyle = `rgba(255,244,200,${o.flash})`; ctx.fillRect(x - s, cy - s, 2 * s, 2 * s); }
  ctx.restore();
  // the number
  const digits = String(val).length, base = shape === ROUND ? 0.4 : shape === SQR ? 0.37 : 0.31;
  const fs = s * (digits >= 3 ? base * 0.78 : digits === 2 ? base : base * 1.18);
  const ty = cy + (shape === TRI ? s * 0.12 * Math.cos(ang) : 0) + fs * 0.33, tx = x + (shape === TRI ? -s * 0.12 * Math.sin(ang) : 0);
  if (val) {
    ctx.font = `700 ${fs}px ${SERIF}`; ctx.textAlign = 'center';
    ctx.fillStyle = f.numHi; ctx.fillText(String(val), tx + s * 0.012, ty + s * 0.025);
    ctx.fillStyle = f.num; ctx.fillText(String(val), tx, ty);
  }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ rules diagrams
// spec: { cols, rows, cell, pieces: [[r, c, side, shape, val]], marks: [[r, c, 'dot'|'ring'|'cross']], hl: [[r, c, color]], arrows: [[r1, c1, r2, c2]], up: side pointing up (default 1) }
export function diagramSize(spec, cp) { return { w: spec.cols * cp + cp * 0.3, h: spec.rows * cp + cp * 0.3 }; }
export function drawDiagram(ctx, spec, x0, y0, cp) {
  const m = cp * 0.15, W = spec.cols * cp, H = spec.rows * cp, gx = x0 + m, gy = y0 + m;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(gx - m + 3, gy - m + 6, W + 2 * m, H + 2 * m, 8); ctx.fill();
  ctx.fillStyle = goldGrad(ctx, gx - m, gy - m, gx + W + m, gy + H + m); ctx.beginPath(); ctx.roundRect(gx - m, gy - m, W + 2 * m, H + 2 * m, 8); ctx.fill();
  ctx.fillStyle = INKS.parch[0]; ctx.fillRect(gx, gy, W, H);
  for (let r = 0; r < spec.rows; r++) for (let c = 0; c < spec.cols; c++) { ctx.fillStyle = (r + c) % 2 ? 'rgba(168,118,48,0.2)' : 'rgba(255,248,224,0.2)'; ctx.fillRect(gx + c * cp, gy + r * cp, cp, cp); }
  for (const [r, c, col] of spec.hl || []) { ctx.fillStyle = col; ctx.fillRect(gx + c * cp, gy + r * cp, cp, cp); }
  ctx.strokeStyle = 'rgba(70,40,15,0.7)'; ctx.lineWidth = Math.max(1, cp * 0.03); ctx.beginPath();
  for (let c = 0; c <= spec.cols; c++) { ctx.moveTo(gx + c * cp, gy); ctx.lineTo(gx + c * cp, gy + H); }
  for (let r = 0; r <= spec.rows; r++) { ctx.moveTo(gx, gy + r * cp); ctx.lineTo(gx + W, gy + r * cp); }
  ctx.stroke();
  const at = (r, c) => ({ x: gx + (c + 0.5) * cp, y: gy + (r + 0.5) * cp });
  for (const [r, c, kind] of spec.marks || []) {
    const p = at(r, c);
    if (kind === 'dot') { ctx.fillStyle = 'rgba(194,56,31,0.75)'; ctx.beginPath(); ctx.arc(p.x, p.y, cp * 0.12, 0, TAU); ctx.fill(); }
    else if (kind === 'ring') { ctx.strokeStyle = 'rgba(194,56,31,0.95)'; ctx.lineWidth = cp * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cp * 0.4, 0, TAU); ctx.stroke(); }
    else if (kind === 'cross') { ctx.strokeStyle = 'rgba(194,56,31,0.95)'; ctx.lineWidth = cp * 0.08; ctx.beginPath(); ctx.moveTo(p.x - cp * 0.3, p.y - cp * 0.3); ctx.lineTo(p.x + cp * 0.3, p.y + cp * 0.3); ctx.moveTo(p.x + cp * 0.3, p.y - cp * 0.3); ctx.lineTo(p.x - cp * 0.3, p.y + cp * 0.3); ctx.stroke(); }
  }
  for (const [r1, c1, r2, c2] of spec.arrows || []) {
    const a = at(r1, c1), b = at(r2, c2), ang = Math.atan2(b.y - a.y, b.x - a.x), hl = cp * 0.2;
    ctx.strokeStyle = INKS.lapis; ctx.fillStyle = INKS.lapis; ctx.lineWidth = cp * 0.07; ctx.setLineDash([cp * 0.16, cp * 0.1]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x - Math.cos(ang) * hl * 0.7, b.y - Math.sin(ang) * hl * 0.7); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - Math.cos(ang - 0.45) * hl, b.y - Math.sin(ang - 0.45) * hl); ctx.lineTo(b.x - Math.cos(ang + 0.45) * hl, b.y - Math.sin(ang + 0.45) * hl); ctx.closePath(); ctx.fill();
  }
  for (const [r, c, side, shape, val] of spec.pieces || []) { const p = at(r, c); drawPiece(ctx, (side << 16) | (shape << 12) | val, p.x, p.y, cp, { ang: side === (spec.up ?? 1) ? 0 : Math.PI }); }
  ctx.restore();
}
