// Vallenato Accordion Trio: all the drawing that is not text. A warm Caribbean patio at dusk: deep teal night, mango and coral light,
// a red pearl-inlaid accordion, a wooden caja, a ridged guacharaca. Pure canvas, lit with gradients (no images).
import { BUTTONS } from './music.js';
import { v3 } from './v3.js';

export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const DISPLAY = '"Dela Gothic One", "Arial Black", system-ui, sans-serif';
export const PAL = {
  night: '#06191f', teal: '#0b3a40', sea: '#126a70', mint: '#7fe3c2', cream: '#fff1d6', paper: '#f6dfae', mango: '#ffb02e', coral: '#ff6b57', red: '#c8203c',
  redDark: '#7a0f24', ink: '#0a1a1f', text: '#fff4e0', dim: 'rgba(255,238,210,0.62)', gold: '#ffd166', push: '#ffb02e', pull: '#35d6c6',
};
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const TAU = Math.PI * 2;
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- the patio backdrop ----------------------------------------------------------------------------------------------------------------
export function drawBackdrop(ctx, w, h, t, o = {}) {
  if (v3.on) { ctx.clearRect(0, 0, w, h); v3.scrim = Math.max(v3.scrim, o.dim ?? 0); return; }   // the lit 3D patio shows through
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#04141a'); g.addColorStop(0.5, '#0a3238'); g.addColorStop(0.82, '#17504f'); g.addColorStop(1, '#2a3a2e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // a warm afterglow low on the wall
  const gl = ctx.createRadialGradient(w * 0.5, h * 0.98, 10, w * 0.5, h * 0.98, Math.max(w, h) * 0.75);
  gl.addColorStop(0, 'rgba(255,140,60,0.34)'); gl.addColorStop(0.5, 'rgba(255,90,70,0.1)'); gl.addColorStop(1, 'rgba(255,90,70,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
  if (o.dim) { ctx.fillStyle = `rgba(3,14,18,${o.dim})`; ctx.fillRect(0, 0, w, h); }
  // a painted wall's diamond tiles, very faint
  ctx.save(); ctx.globalAlpha = 0.05; ctx.strokeStyle = '#ffe9b8'; ctx.lineWidth = 2;
  const s = 84; for (let y = -s; y < h + s; y += s) for (let x = ((y / s) % 2 ? s / 2 : 0) - s; x < w + s; x += s) { ctx.beginPath(); ctx.moveTo(x, y - s / 2); ctx.lineTo(x + s / 2, y); ctx.lineTo(x, y + s / 2); ctx.lineTo(x - s / 2, y); ctx.closePath(); ctx.stroke(); }
  ctx.restore();
  // string lights: a sagging wire with bulbs that breathe
  if (!o.noLights) {
    const sway = o.calm ? 0 : Math.sin(t * 0.7) * 4, cols = ['#ffd166', '#ff8a5c', '#7fe3c2', '#ffe9b8'];
    for (const row of [0, 1]) {
      const y0 = 10 + row * 46, sag = 30 + row * 12;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const x = (i / 40) * w, y = y0 + Math.sin((i / 40) * Math.PI) * sag + sway * (i / 40); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      const n = Math.max(6, Math.round(w / 78));
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n, x = k * w, y = y0 + Math.sin(k * Math.PI) * sag + sway * k + 8, pulse = 0.75 + 0.25 * (o.calm ? 1 : Math.sin(t * 1.6 + i * 1.7 + row));
        const c = cols[(i + row) % cols.length], r = 9;
        const bg = ctx.createRadialGradient(x, y, 1, x, y, r * 4.2);
        bg.addColorStop(0, rgba(c, 0.55 * pulse)); bg.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = bg; ctx.fillRect(x - r * 4.2, y - r * 4.2, r * 8.4, r * 8.4);
        ctx.fillStyle = c; ctx.globalAlpha = 0.6 + 0.4 * pulse; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
  }
}

// A palm silhouette (for the title hero corners).
export function drawPalm(ctx, x, y, h, lean = 0.12, col = '#04161a') {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round';
  ctx.lineWidth = h * 0.035; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + h * lean * 0.4, y - h * 0.5, x + h * lean, y - h); ctx.stroke();
  const tx = x + h * lean, ty = y - h;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.95 + (i / 6) * Math.PI * 0.9, len = h * 0.42;
    ctx.lineWidth = h * 0.02; ctx.beginPath(); ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6 - h * 0.08, tx + Math.cos(a) * len, ty + Math.sin(a) * len + h * 0.12); ctx.stroke();
  }
  ctx.restore();
}

// ---- the accordion --------------------------------------------------------------------------------------------------------------------
// The whole instrument, side-on, for the title and the Rules figures. spread 0..1 = how far the bellows is pulled open.
export function drawAccordion(ctx, x, y, w, h, o = {}) {
  const spread = o.spread ?? 0.5, boxW = w * 0.2, bw = w - boxW * 2, folds = 11;
  ctx.save(); ctx.translate(x, y);
  // contact shadow
  const shg = ctx.createRadialGradient(w / 2, h * 1.03, 2, w / 2, h * 1.03, w * 0.5);
  shg.addColorStop(0, 'rgba(0,0,0,0.5)'); shg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.translate(0, h * 1.03); ctx.scale(1, 0.14); ctx.translate(0, -h * 1.03 * 1); ctx.fillStyle = shg; ctx.beginPath(); ctx.arc(w / 2, h * 1.03, w * 0.5, 0, TAU); ctx.fill(); ctx.restore();
  // the bellows first, so the end boxes overlap it: pleats with a lit face and a shaded face, cream edge guards
  const bx0 = boxW * 0.9, bwid = w - boxW * 1.8, fw = bwid / folds;
  for (let i = 0; i < folds; i++) {
    const fx = bx0 + i * fw, inset = h * 0.1 * (0.4 + spread * 0.9);
    const lit = ctx.createLinearGradient(fx, 0, fx + fw * 0.55, 0);
    lit.addColorStop(0, '#ff7a86'); lit.addColorStop(1, '#c91f3d');
    ctx.fillStyle = lit; ctx.beginPath(); ctx.moveTo(fx, inset); ctx.lineTo(fx + fw * 0.55, 0); ctx.lineTo(fx + fw * 0.55, h); ctx.lineTo(fx, h - inset); ctx.closePath(); ctx.fill();
    const dk = ctx.createLinearGradient(fx + fw * 0.55, 0, fx + fw, 0);
    dk.addColorStop(0, '#8c1230'); dk.addColorStop(1, '#4a0716');
    ctx.fillStyle = dk; ctx.beginPath(); ctx.moveTo(fx + fw * 0.55, 0); ctx.lineTo(fx + fw, inset); ctx.lineTo(fx + fw, h - inset); ctx.lineTo(fx + fw * 0.55, h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,238,205,0.85)'; ctx.lineWidth = Math.max(1.5, h * 0.011);
    ctx.beginPath(); ctx.moveTo(fx + fw * 0.55, 0); ctx.lineTo(fx + fw * 0.55, h); ctx.stroke();
  }
  // cream guard strips follow the zig-zag of the top and bottom edges
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const insetG = h * 0.1 * (0.4 + spread * 0.9);
  for (const top of [true, false]) {
    ctx.beginPath();
    for (let i = 0; i <= folds; i++) {
      const fx = bx0 + i * fw, pts = [[fx, insetG], [fx + fw * 0.55, 0]];
      for (const [px, py] of pts) { if (px > bx0 + bwid + 0.1) continue; const yy = top ? py : h - py; i === 0 && px === fx ? ctx.moveTo(px, yy) : ctx.lineTo(px, yy); }
    }
    ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = Math.max(2.5, h * 0.03); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,80,40,0.55)'; ctx.lineWidth = Math.max(1, h * 0.008); ctx.translate(0, h * 0.012); ctx.stroke(); ctx.translate(0, -h * 0.012);
  }
  const box = (bx, key) => {
    // lacquered body with a bevelled edge
    const g = ctx.createLinearGradient(bx, 0, bx + boxW, 0);
    g.addColorStop(0, '#46060f'); g.addColorStop(0.12, '#e43a54'); g.addColorStop(0.5, '#b81c38'); g.addColorStop(0.9, '#66091c'); g.addColorStop(1, '#2e030a');
    ctx.fillStyle = g; rr(ctx, bx, -h * 0.01, boxW, h * 1.02, h * 0.09); ctx.fill();
    // chrome corner guards
    const cg = ctx.createLinearGradient(bx, 0, bx + boxW, h);
    cg.addColorStop(0, '#fbfdff'); cg.addColorStop(0.45, '#aab4c6'); cg.addColorStop(1, '#5f6a80');
    ctx.strokeStyle = cg; ctx.lineWidth = Math.max(3, h * 0.03); rr(ctx, bx + h * 0.012, h * 0.0, boxW - h * 0.024, h, h * 0.085); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,200,0.75)'; ctx.lineWidth = Math.max(1.5, h * 0.01); rr(ctx, bx + boxW * 0.1, h * 0.07, boxW * 0.8, h * 0.86, h * 0.06); ctx.stroke();
    if (key === 'l') {
      // bass side: strap loop and round bass buttons in a grid
      ctx.fillStyle = 'rgba(30,6,10,0.55)';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const px = bx + boxW * (0.34 + c * 0.32), py = h * (0.2 + r * 0.2), pr = Math.min(boxW * 0.1, h * 0.038); ctx.beginPath(); ctx.arc(px, py + pr * 0.18, pr * 1.1, 0, TAU); ctx.fill(); }
    }
    const cols = key === 'r' ? 3 : 2, rows = key === 'r' ? 7 : 4;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const px = bx + boxW * (0.5 + (c - (cols - 1) / 2) * 0.24), py = h * (0.5 + (r - (rows - 1) / 2) * (key === 'r' ? 0.1 : 0.18));
      const pr = Math.min(boxW * 0.09, h * 0.036);
      ctx.fillStyle = 'rgba(25,3,8,0.6)'; ctx.beginPath(); ctx.arc(px, py + pr * 0.22, pr * 1.12, 0, TAU); ctx.fill();         // seat + drop shadow
      const pg = ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.38, pr * 0.1, px, py, pr * 1.1);
      pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.5, '#f7e8d0'); pg.addColorStop(1, '#a88a62');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(px - pr * 0.3, py - pr * 0.42, pr * 0.34, pr * 0.18, -0.5, 0, TAU); ctx.fill();
    }
    // lacquer gloss
    const sh = ctx.createLinearGradient(bx, 0, bx + boxW * 0.9, h * 0.7); sh.addColorStop(0, 'rgba(255,255,255,0.30)'); sh.addColorStop(0.45, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; rr(ctx, bx, 0, boxW, h, h * 0.09); ctx.fill();
  };
  box(0, 'l'); box(w - boxW, 'r');
  ctx.restore();
}

// The treble keyboard in play: seven pearl buttons on a red lacquer panel. st: { flash[7], pull, ghost: btn|-1, nextPull, wrong }
export function drawKeyboard(ctx, G, st, t) {
  const p = G.panel;
  if (v3.on) {      // the lacquered panel, chrome frame and pearl buttons are 3D; only the numbers and note names are drawn here
    for (const b of G.btns) {
      const r = b.r * (1 - 0.1 * (st.flash[b.i] || 0)), cx = b.cx, cy = b.cy;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#4a0c1a';
      ctx.font = `800 ${Math.max(18, r * 0.62)}px ${UI}`; ctx.fillText(String(b.i + 1), cx, cy);
      if (st.labels !== false) {
        ctx.font = `700 ${Math.max(13, r * 0.34)}px ${UI}`;
        ctx.globalAlpha = st.pull ? 0.4 : 1; ctx.fillStyle = '#8a5200'; ctx.fillText(BUTTONS.push[b.i], cx, cy - r * 0.62);
        ctx.globalAlpha = st.pull ? 1 : 0.4; ctx.fillStyle = '#00696b'; ctx.fillText(BUTTONS.pull[b.i], cx, cy + r * 0.64); ctx.globalAlpha = 1;
      }
    }
    return;
  }
  const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
  g.addColorStop(0, '#7e1228'); g.addColorStop(0.45, '#b81f3a'); g.addColorStop(1, '#5a0c1d');
  ctx.fillStyle = g; rr(ctx, p.x, p.y, p.w, p.h, 30); ctx.fill();
  ctx.strokeStyle = 'rgba(255,238,205,0.9)'; ctx.lineWidth = 4; rr(ctx, p.x + 8, p.y + 8, p.w - 16, p.h - 16, 24); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,238,205,0.35)'; ctx.lineWidth = 2; rr(ctx, p.x + 16, p.y + 16, p.w - 32, p.h - 32, 20); ctx.stroke();
  const sh = ctx.createLinearGradient(0, p.y, 0, p.y + p.h * 0.45); sh.addColorStop(0, 'rgba(255,255,255,0.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; rr(ctx, p.x, p.y, p.w, p.h * 0.45, 30); ctx.fill();
  // the other rows of a real vallenato accordion: decoration only
  for (const dy of [0.13, 0.87]) for (let i = 0; i < 7; i++) {
    const cx = p.x + 12 + G.cell * (i + 0.5) + (dy > 0.5 ? G.cell * 0.0 : 0), cy = p.y + p.h * dy, r = Math.min(G.r * 0.28, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(cx, cy + 2, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,238,205,0.3)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  }
  for (const b of G.btns) {
    const f = st.flash[b.i] || 0, want = st.want === b.i, cx = b.cx, cy = b.cy, r = b.r * (1 - 0.1 * f);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.2, r * 1.06, r * 1.02, 0, 0, TAU); ctx.fill();
    if (want) { ctx.save(); ctx.globalAlpha = 0.5 + 0.35 * Math.sin(t * 9); ctx.strokeStyle = st.wantPull ? PAL.pull : PAL.push; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, TAU); ctx.stroke(); ctx.restore(); }
    const pg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 2, cx, cy, r * 1.15);
    pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.55, f > 0.2 ? '#ffe7a8' : '#f3e1c4'); pg.addColorStop(1, '#b0926a');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = st.pull ? PAL.pull : PAL.push; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    if (f > 0) { ctx.fillStyle = `rgba(255,236,160,${0.5 * f})`; ctx.beginPath(); ctx.arc(cx, cy, r * (1 + 0.35 * f), 0, TAU); ctx.fill(); }
    // number, and the two notes this button plays (push above, pull below)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#4a0c1a';
    ctx.font = `800 ${Math.max(18, r * 0.62)}px ${UI}`; ctx.fillText(String(b.i + 1), cx, cy);
    if (st.labels !== false) {
      ctx.font = `700 ${Math.max(13, r * 0.34)}px ${UI}`;
      ctx.globalAlpha = st.pull ? 0.4 : 1; ctx.fillStyle = '#8a5200'; ctx.fillText(BUTTONS.push[b.i], cx, cy - r * 0.62);
      ctx.globalAlpha = st.pull ? 1 : 0.4; ctx.fillStyle = '#00696b'; ctx.fillText(BUTTONS.pull[b.i], cx, cy + r * 0.64); ctx.globalAlpha = 1;
    }
  }
}

// The bellows pad: pleats that stretch while pulled. st: { pull (0..1 animated), held, mode, needPull (the next note's direction), label }
export function drawBellowsPad(ctx, pad, st, t) {
  if (v3.on) {      // pleated 3D bellows; only the "next needs pull / push" tag stays 2D
    if (st.hint !== undefined && st.hint !== null) {
      const need = st.hint ? 'PULL' : 'PUSH', c = st.hint ? PAL.pull : PAL.push;
      ctx.save(); rr(ctx, pad.x + pad.w - 150, pad.y + 10, 138, 40, 20); ctx.fillStyle = rgba(c, 0.95); ctx.fill();
      ctx.fillStyle = '#0a1a1f'; ctx.font = `800 24px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NEXT ' + need, pad.x + pad.w - 81, pad.y + 31); ctx.restore();
    }
    return;
  }
  const open = st.pull, n = 14;
  ctx.save();
  rr(ctx, pad.x, pad.y, pad.w, pad.h, 22); ctx.clip();
  ctx.fillStyle = '#1a0710'; ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
  const inner = pad.w - 28, fw = inner / n, x0 = pad.x + 14;
  for (let i = 0; i < n; i++) {
    const fx = x0 + i * fw, wob = Math.sin(i * 0.9 + t * 3) * 0.6 * open;
    const g = ctx.createLinearGradient(fx, 0, fx + fw, 0);
    g.addColorStop(0, i % 2 ? '#690c20' : '#c72a45'); g.addColorStop(0.55, i % 2 ? '#98173a' : '#ff6073'); g.addColorStop(1, i % 2 ? '#4f0716' : '#8c1630');
    ctx.fillStyle = g;
    const k = (1 - open) * pad.h * 0.2 + 8;
    ctx.beginPath(); ctx.moveTo(fx, pad.y + k); ctx.lineTo(fx + fw, pad.y + wob); ctx.lineTo(fx + fw, pad.y + pad.h - wob); ctx.lineTo(fx, pad.y + pad.h - k); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,238,205,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx + fw, pad.y); ctx.lineTo(fx + fw, pad.y + pad.h); ctx.stroke();
  }
  if (st.held) { ctx.fillStyle = 'rgba(53,214,198,0.22)'; ctx.fillRect(pad.x, pad.y, pad.w, pad.h); }
  ctx.restore();
  ctx.strokeStyle = st.held ? PAL.pull : 'rgba(255,238,205,0.55)'; ctx.lineWidth = st.held ? 5 : 3; rr(ctx, pad.x, pad.y, pad.w, pad.h, 22); ctx.stroke();
  // what the next note needs
  if (st.hint !== undefined && st.hint !== null) {
    const need = st.hint ? 'PULL' : 'PUSH', c = st.hint ? PAL.pull : PAL.push;
    ctx.save(); ctx.globalAlpha = 0.9; rr(ctx, pad.x + pad.w - 150, pad.y + 10, 138, 40, 20); ctx.fillStyle = rgba(c, 0.92); ctx.fill();
    ctx.fillStyle = '#0a1a1f'; ctx.font = `800 24px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NEXT ' + need, pad.x + pad.w - 81, pad.y + 31); ctx.restore();
  }
}

// ---- the caja -----------------------------------------------------------------------------------------------------------------------------
// One wooden drum head with two hands on it: the palm (left, tum) and the fingers (right, tak). st: { tum, tak } flashes 0..1.
export function drawCaja(ctx, G, st, t) {
  const L = G.tum, Rt = G.tak, x0 = L.x, w = Rt.x + Rt.w - L.x, y0 = L.y, h = L.h;
  const rx = Math.min(w * 0.5 - 8, h * 0.62), cx = x0 + w / 2, ry = Math.min(rx * 0.5, h * 0.3), hy = y0 + ry + 12;
  const bottom = y0 + h - 6, topW = rx, botW = rx * 0.7;
  if (v3.on) { cajaLabels(ctx, st, cx, hy, rx, ry); return; }
  // shadow on the floor
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx, bottom + 2, botW * 1.05, 14, 0, 0, TAU); ctx.fill();
  // wooden shell: a cone of planks with painted bands
  const sg = ctx.createLinearGradient(cx - topW, 0, cx + topW, 0);
  sg.addColorStop(0, '#2e1406'); sg.addColorStop(0.22, '#a05d28'); sg.addColorStop(0.55, '#d79448'); sg.addColorStop(0.85, '#7a3f16'); sg.addColorStop(1, '#2e1406');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(cx - topW, hy); ctx.lineTo(cx - botW, bottom - 10); ctx.quadraticCurveTo(cx, bottom + 14, cx + botW, bottom - 10); ctx.lineTo(cx + topW, hy); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(40,16,4,0.5)'; ctx.lineWidth = 2;
  for (let i = 1; i < 10; i++) { const k = i / 10, tx = cx - topW + topW * 2 * k, bx = cx - botW + botW * 2 * k; ctx.beginPath(); ctx.moveTo(tx, hy + 10); ctx.lineTo(bx, bottom - 6); ctx.stroke(); }
  // painted bands
  const band = (k0, k1, col) => { ctx.fillStyle = col; const y1 = hy + (bottom - hy) * k0, y2 = hy + (bottom - hy) * k1, w1 = topW + (botW - topW) * k0, w2 = topW + (botW - topW) * k1; ctx.beginPath(); ctx.moveTo(cx - w1, y1); ctx.lineTo(cx + w1, y1); ctx.lineTo(cx + w2, y2); ctx.lineTo(cx - w2, y2); ctx.closePath(); ctx.fill(); };
  band(0.5, 0.58, 'rgba(255,107,87,0.9)'); band(0.62, 0.66, 'rgba(255,241,214,0.85)'); band(0.7, 0.78, 'rgba(53,214,198,0.85)');
  // the head
  ctx.fillStyle = '#4a2a10'; ctx.beginPath(); ctx.ellipse(cx, hy + 7, rx + 12, ry + 13, 0, 0, TAU); ctx.fill();
  const hg = ctx.createRadialGradient(cx - rx * 0.25, hy - ry * 0.35, 8, cx, hy, rx);
  hg.addColorStop(0, '#fff6df'); hg.addColorStop(0.7, '#ecd29c'); hg.addColorStop(1, '#b08a48');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(cx, hy, rx, ry, 0, 0, TAU); ctx.fill();
  // the two zones
  const zone = (left, col, f, label, sub) => {
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, hy, rx, ry, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = rgba(col, 0.16 + 0.55 * f); ctx.fillRect(left ? cx - rx : cx, hy - ry, rx, ry * 2); ctx.restore();
    const lx = left ? cx - rx / 2 : cx + rx / 2;
    ctx.fillStyle = f > 0.15 ? '#fff' : '#4a2a10'; ctx.font = `400 ${Math.min(rx * 0.4, Math.max(14, Math.min(rx * 0.26, ry * 0.7)))}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, hy - ry * 0.12);
    ctx.font = `700 ${Math.max(14, Math.min(rx * 0.1, ry * 0.3))}px ${UI}`; ctx.fillStyle = f > 0.15 ? '#fff' : 'rgba(74,42,16,0.85)'; ctx.fillText(sub, lx, hy + ry * 0.4);
    if (f > 0.02) { ctx.strokeStyle = rgba(col, f * 0.9); ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(lx, hy, rx * 0.42 * (1.3 - f * 0.5), ry * 0.6 * (1.3 - f * 0.5), 0, 0, TAU); ctx.stroke(); }
  };
  zone(true, PAL.mango, st.tum || 0, 'TUM', 'palm');
  zone(false, PAL.coral, st.tak || 0, 'TAK', 'fingers');
  ctx.strokeStyle = 'rgba(90,50,16,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, hy - ry); ctx.lineTo(cx, hy + ry); ctx.stroke();
  // rope lugs: a few knotted ropes pulled down the shell
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.1 + 0.8 * i / 6), px = cx + Math.cos(a) * (rx + 4), py = hy + Math.sin(a) * (ry + 9), len = 20 + 8 * Math.sin(a);
    ctx.strokeStyle = 'rgba(40,16,4,0.6)'; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(px, py + 1); ctx.lineTo(px + (px - cx) * 0.03, py + len + 1); ctx.stroke();
    ctx.strokeStyle = '#ffe3b0'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (px - cx) * 0.03, py + len); ctx.stroke();
    ctx.fillStyle = '#fff6df'; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, TAU); ctx.fill();
  }
}

// zone names and the hit rings drawn over the 3D drum head
function cajaLabels(ctx, st, cx, hy, rx, ry) {
  const zone = (left, col, f, label, sub) => {
    const lx = left ? cx - rx / 2 : cx + rx / 2;
    ctx.save(); ctx.fillStyle = f > 0.15 ? '#fff' : '#4a2a10'; ctx.font = `400 ${Math.min(rx * 0.4, Math.max(14, Math.min(rx * 0.26, ry * 0.7)))}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, hy - ry * 0.12);
    ctx.font = `700 ${Math.max(14, Math.min(rx * 0.1, ry * 0.3))}px ${UI}`; ctx.fillStyle = f > 0.15 ? '#fff' : 'rgba(74,42,16,0.85)'; ctx.fillText(sub, lx, hy + ry * 0.4);
    if (f > 0.02) { ctx.strokeStyle = rgba(col, f * 0.9); ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(lx, hy, rx * 0.42 * (1.3 - f * 0.5), ry * 0.6 * (1.3 - f * 0.5), 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  };
  zone(true, PAL.mango, st.tum || 0, 'TUM', 'palm');
  zone(false, PAL.coral, st.tak || 0, 'TAK', 'fingers');
}

// ---- the guacharaca -------------------------------------------------------------------------------------------------------------------------
// A ridged tube with a three-pronged fork. st: { fork: -1..1 (position), lean, glow, trail: [{x, a}] }
export function drawGuacharaca(ctx, G, st, t) {
  const r = G.tube, cx = r.x + r.w / 2, tw = r.w, th = r.h * 0.62, ty = r.y + r.h * 0.5 - th / 2;
  if (G.zone) { ctx.save(); ctx.setLineDash([14, 12]); ctx.strokeStyle = 'rgba(255,238,210,0.22)'; ctx.lineWidth = 3; rr(ctx, G.zone.x + 6, G.zone.y + 4, G.zone.w - 12, G.zone.h - 8, 26); ctx.stroke(); ctx.restore(); }
  if (v3.on) return;      // the cane tube, ridges, steel fork and sparks are 3D
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx, ty + th + 18, tw * 0.46, 14, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, ty, 0, ty + th);
  g.addColorStop(0, '#6a4a1c'); g.addColorStop(0.2, '#e3b567'); g.addColorStop(0.45, '#c68e3f'); g.addColorStop(1, '#4a3010');
  ctx.fillStyle = g; rr(ctx, r.x + 20, ty, tw - 40, th, th * 0.22); ctx.fill();
  // ridges
  const n = Math.floor((tw - 80) / 15);
  for (let i = 0; i < n; i++) {
    const x = r.x + 40 + i * ((tw - 80) / (n - 1)), lit = Math.abs((x - (cx + (st.fork || 0) * (tw / 2 - 60)))) < 20 ? st.glow || 0 : 0;
    ctx.strokeStyle = lit > 0.05 ? rgba('#fff3c0', 0.5 + lit * 0.5) : 'rgba(40,24,6,0.55)'; ctx.lineWidth = lit > 0.05 ? 4 : 3;
    ctx.beginPath(); ctx.moveTo(x, ty + th * 0.08); ctx.lineTo(x + 5, ty + th * 0.92); ctx.stroke();
  }
  ctx.fillStyle = '#2a1a06'; for (const ex of [r.x + 20, r.x + tw - 20]) { ctx.beginPath(); ctx.ellipse(ex, ty + th / 2, 14, th / 2, 0, 0, TAU); ctx.fill(); }
  // the fork
  const fx = cx + (st.fork || 0) * (tw / 2 - 60), fy = ty + th * 0.5, lean = (st.lean || 0) * 0.35;
  ctx.save(); ctx.translate(fx, fy); ctx.rotate(lean);
  ctx.strokeStyle = '#d7dde0'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -th * 0.92); ctx.lineTo(0, -th * 0.2); ctx.stroke();
  ctx.lineWidth = 5; for (const dx of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(dx, -th * 0.2); ctx.lineTo(dx, th * 0.22); ctx.stroke(); }
  ctx.strokeStyle = '#8a4a1c'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(0, -th * 0.92); ctx.lineTo(0, -th * 1.25); ctx.stroke();
  ctx.restore();
  // sparks along the scrape
  for (const s of st.trail || []) { ctx.fillStyle = rgba('#fff0b0', clamp(s.a, 0, 1)); ctx.beginPath(); ctx.arc(s.x, ty + th * 0.5 + s.dy, 3 + s.a * 4, 0, TAU); ctx.fill(); }
}

// ---- ribbon notes -------------------------------------------------------------------------------------------------------------------------
export function drawAccNote(ctx, x, y, r, n, o = {}) {
  const col = n.pull ? PAL.pull : PAL.push;
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
  if (o.glow) { const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2); g.addColorStop(0, rgba(col, 0.55)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4); }
  const pg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r * 1.1);
  pg.addColorStop(0, '#fff'); pg.addColorStop(1, o.ghost ? '#cdb58a' : '#e8d3ac');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(3, r * 0.2); ctx.strokeStyle = col; ctx.stroke();
  if (!o.ghost) {
    ctx.fillStyle = '#3a0a16'; ctx.font = `800 ${r * 1.0}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n.btn + 1), x, y + r * 0.04);
    // push closes in, pull opens out: two tiny chevrons either side of the disc
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, r * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of [-1, 1]) { const ax = x + s * (r * 1.5), d = n.pull ? s : -s; ctx.beginPath(); ctx.moveTo(ax - d * r * 0.2, y - r * 0.32); ctx.lineTo(ax + d * r * 0.2, y); ctx.lineTo(ax - d * r * 0.2, y + r * 0.32); ctx.stroke(); }
  }
  ctx.restore();
}
export function drawCajaNote(ctx, x, y, r, n, o = {}) {
  ctx.save(); ctx.globalAlpha = (o.alpha ?? 1) * (n.soft ? 0.78 : 1);
  const rad = n.soft ? r * 0.78 : r;
  if (n.kind === 'tum') {
    const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 1, x, y, rad); g.addColorStop(0, '#ffe3a0'); g.addColorStop(1, '#e8920f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); ctx.strokeStyle = '#6a3a00'; ctx.lineWidth = 3; ctx.stroke();
  } else {
    ctx.lineWidth = Math.max(4, rad * 0.3); ctx.strokeStyle = PAL.coral; ctx.beginPath(); ctx.arc(x, y, rad * 0.78, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffd9cf'; ctx.beginPath(); ctx.arc(x, y, rad * 0.26, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
export function drawGuaNote(ctx, x, y, r, n, o = {}) {
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
  const big = n.acc ? 1.25 : 1, w = r * 2.2 * big, h = r * 1.3 * big, dir = n.dir === 'R' ? 1 : -1;
  if (n.acc) { ctx.shadowColor = PAL.mint; ctx.shadowBlur = 12; }
  ctx.fillStyle = n.acc ? '#7fe3c2' : '#46b89d'; rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#06322b'; ctx.lineWidth = Math.max(3, r * 0.2); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - dir * w * 0.26, y); ctx.lineTo(x + dir * w * 0.26, y); ctx.moveTo(x + dir * w * 0.08, y - h * 0.26); ctx.lineTo(x + dir * w * 0.26, y); ctx.lineTo(x + dir * w * 0.08, y + h * 0.26); ctx.stroke();
  ctx.restore();
}

// ---- small things -----------------------------------------------------------------------------------------------------------------------
export function drawStars(ctx, cx, cy, size, n, max = 3, alpha = 1) {
  const gap = size * 1.25;
  for (let i = 0; i < max; i++) {
    const x = cx + (i - (max - 1) / 2) * gap, on = i < n;
    ctx.save(); ctx.translate(x, cy); ctx.globalAlpha = alpha * (on ? 1 : 0.35);
    ctx.fillStyle = on ? '#ffd166' : 'rgba(255,255,255,0.25)'; ctx.strokeStyle = on ? '#8a5a00' : 'rgba(0,0,0,0.3)'; ctx.lineWidth = size * 0.1;
    ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rad = k % 2 ? size * 0.22 : size * 0.5; const px = Math.cos(a) * rad, py = Math.sin(a) * rad; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
}

// part icons: a tiny accordion / caja / guacharaca glyph
export function drawPartIcon(ctx, part, cx, cy, s, col = '#fff4e0') {
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (part === 'acc') {
    rr(ctx, -s * 0.9, -s * 0.5, s * 0.5, s, s * 0.1); ctx.stroke(); rr(ctx, s * 0.4, -s * 0.5, s * 0.5, s, s * 0.1); ctx.stroke();
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.35 + (i + 2) * s * 0.15, -s * 0.38); ctx.lineTo(-s * 0.35 + (i + 2) * s * 0.15, s * 0.38); ctx.stroke(); }
  } else if (part === 'caja') {
    ctx.beginPath(); ctx.ellipse(0, -s * 0.25, s * 0.7, s * 0.28, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 0.25); ctx.lineTo(-s * 0.55, s * 0.55); ctx.lineTo(s * 0.55, s * 0.55); ctx.lineTo(s * 0.7, -s * 0.25); ctx.stroke();
  } else {
    rr(ctx, -s * 0.8, -s * 0.28, s * 1.6, s * 0.56, s * 0.2); ctx.stroke();
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.55 + i * s * 0.22, -s * 0.2); ctx.lineTo(-s * 0.55 + i * s * 0.22, s * 0.2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(s * 0.4, -s * 0.8); ctx.lineTo(s * 0.4, -s * 0.28); ctx.stroke();
  }
  ctx.restore();
}

// ---- particles -------------------------------------------------------------------------------------------------------------------------
export function burst(parts, rng, x, y, n, col, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(-Math.PI, 0.2) , sp = rng.range(80, 300) * power;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: rng.range(0.35, 0.75), age: 0, r: rng.range(3, 7), col });
  }
  if (parts.length > 160) parts.splice(0, parts.length - 160);
}
export function stepParticles(parts, dt) {
  for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.vx *= 0.99; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
}
export function drawParticles(ctx, parts) {
  for (const p of parts) { ctx.globalAlpha = Math.max(0, 1 - p.age / p.life); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
}
