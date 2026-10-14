// Otedama: all the painting that is not interface. A lamp-lit tatami room at night: indigo wall, paper screens, paper lanterns, woven mats,
// cloth bags with original woven-pattern fabrics, sleeved hands, bean grains and sparkle. Pure canvas 2D, a function of its arguments.
import { FABRICS } from './pattern.js';
import { hooks } from './hooks.js';

export const PAL = {
  ink: '#0c1226', night: '#14204a', indigo: '#1c2c5c', indigoHi: '#3a5aa8', paper: '#f6e7c4', cream: '#fff4dc', vermilion: '#d9432e',
  gold: '#ffd77a', goldDeep: '#d29a34', ember: '#e8793a', matcha: '#9cc47a', sakura: '#f4a9bb', teal: '#4fd0b8', tealHi: '#9cf0dc',
  text: '#fbf3e0', dim: 'rgba(251,243,224,0.66)', rose: '#ff8aa0', mat: '#b7ad6a',
};
export const DISPLAY = 'Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif';
export const UI = 'Fredoka, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const ease = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => clamp(Math.round(v * k), 0, 255); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

// ---- the room -------------------------------------------------------------------------------------------------------------------------
// cam: { horizon } where the wall meets the mats, in screen units. pulse 0..1 on the beat; excite 0..1 lifts the lantern glow.
export function drawRoom(ctx, w, h, t, cam, pulse = 0, excite = 0) {
  const hz = cam.horizon;
  // wall: deep indigo with a faint wave print
  const wg = ctx.createLinearGradient(0, 0, 0, hz);
  wg.addColorStop(0, '#0a1030'); wg.addColorStop(0.6, '#16265a'); wg.addColorStop(1, '#22366f');
  ctx.fillStyle = wg; ctx.fillRect(0, 0, w, hz + 2);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, hz); ctx.clip();
  const wr = Math.max(46, w / 11);
  ctx.strokeStyle = 'rgba(160,190,255,0.07)'; ctx.lineWidth = 2;
  for (let row = 0; row * wr * 0.5 < hz + wr; row++) {
    for (let x = (row % 2 ? 0 : wr * 0.5) - wr; x < w + wr; x += wr) {
      const y = row * wr * 0.5 + wr * 0.4;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(x, y, wr * 0.5 * k / 3, Math.PI, 0); ctx.stroke(); }
    }
  }
  ctx.restore();
  // ceiling beam and a carved transom (ranma) of fine lattice above the screens
  {
    const bh = Math.max(20, hz * 0.07), rh = Math.max(22, hz * 0.075);
    const bg = ctx.createLinearGradient(0, 0, 0, bh);
    bg.addColorStop(0, '#1a0f08'); bg.addColorStop(0.5, '#4a2e18'); bg.addColorStop(1, '#2a180c');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, bh);
    ctx.fillStyle = 'rgba(255,214,150,0.18)'; ctx.fillRect(0, bh * 0.45, w, 2);
    ctx.fillStyle = 'rgba(8,6,20,0.62)'; ctx.fillRect(0, bh, w, rh);
    ctx.strokeStyle = 'rgba(214,170,110,0.28)'; ctx.lineWidth = 1.4;
    const cell = rh * 0.5;
    ctx.save(); ctx.beginPath(); ctx.rect(0, bh, w, rh); ctx.clip();
    for (let x = -rh; x < w + rh; x += cell) { ctx.beginPath(); ctx.moveTo(x, bh); ctx.lineTo(x + rh, bh + rh); ctx.moveTo(x + rh, bh); ctx.lineTo(x, bh + rh); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#2a180c'; ctx.fillRect(0, bh + rh, w, 5);
  }
  // paper screens (shoji) lit from the room's side, with a thin lattice
  const pw = clamp(w / 3.3, 150, 330), ph = clamp(hz * 0.52, 120, 420), gap = Math.max(18, pw * 0.12);
  const n = Math.max(2, Math.ceil(w / (pw + gap)) + 1), x0 = w / 2 - (n * (pw + gap) - gap) / 2, py = hz * 0.5 - ph * 0.38;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (pw + gap);
    if (i === 1 && n >= 3) { drawAlcove(ctx, x, py, pw, ph, t); continue; }
    ctx.fillStyle = '#0a0f26'; ctx.fillRect(x - 8, py - 8, pw + 16, ph + 16);
    const pg = ctx.createLinearGradient(0, py, 0, py + ph);
    pg.addColorStop(0, `rgba(250,226,170,${0.22 + excite * 0.12})`); pg.addColorStop(1, `rgba(255,200,130,${0.36 + excite * 0.14})`);
    ctx.fillStyle = pg; ctx.fillRect(x, py, pw, ph);
    ctx.strokeStyle = 'rgba(30,18,12,0.85)'; ctx.lineWidth = 3;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + pw * k / 4, py); ctx.lineTo(x + pw * k / 4, py + ph); ctx.stroke(); }
    for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x, py + ph * k / 6); ctx.lineTo(x + pw, py + ph * k / 6); ctx.stroke(); }
    ctx.lineWidth = 6; ctx.strokeRect(x, py, pw, ph);
    // a bamboo shadow on the paper
    ctx.save(); ctx.beginPath(); ctx.rect(x, py, pw, ph); ctx.clip();
    ctx.strokeStyle = 'rgba(40,52,30,0.38)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    const bx = x + pw * (0.25 + 0.5 * hash(i + 3));
    ctx.beginPath(); ctx.moveTo(bx, py + ph); ctx.lineTo(bx + 5 * Math.sin(t * 0.6 + i), py); ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const ly = py + ph * (0.15 + 0.2 * k), dir = k % 2 ? 1 : -1, sw = Math.sin(t * 0.8 + k + i) * 3;
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx, ly); ctx.quadraticCurveTo(bx + dir * pw * 0.2, ly - 12 + sw, bx + dir * pw * 0.34, ly + 14 + sw); ctx.stroke();
    }
    ctx.restore();
  }
  // wooden rail along the foot of the wall
  const rg = ctx.createLinearGradient(0, hz - 16, 0, hz + 10);
  rg.addColorStop(0, '#3a2414'); rg.addColorStop(0.5, '#6b4526'); rg.addColorStop(1, '#2a180c');
  ctx.fillStyle = rg; ctx.fillRect(0, hz - 12, w, 22);
  // mats: perspective rows, black cloth borders, a soft weave
  const fy = hz + 10, fh = h - fy, vx = w / 2, vy = hz - h * 0.9;
  const fg = ctx.createLinearGradient(0, fy, 0, h);
  fg.addColorStop(0, '#8a8450'); fg.addColorStop(0.5, '#b7ad6a'); fg.addColorStop(1, '#d2c684');
  ctx.fillStyle = fg; ctx.fillRect(0, fy, w, fh);
  ctx.strokeStyle = 'rgba(30,38,24,0.8)';
  const rows = 5;
  for (let r = 0; r <= rows; r++) {
    const y = fy + fh * (r / rows) ** 1.7;
    ctx.lineWidth = 2 + 4 * (r / rows); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  const cols = Math.max(4, Math.round(w / 180));
  for (let c = -cols; c <= cols * 2; c++) {
    const xb = (c / cols) * w;                    // seam position at the bottom edge
    const xt = vx + (xb - vx) * ((fy - vy) / (h - vy));
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xt, fy); ctx.lineTo(xb, h); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(60,70,30,0.12)'; ctx.lineWidth = 1;
  for (let y = fy + 6; y < h; y += 7 + (y - fy) * 0.03) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  // lantern glow pooling on the mats
  const gl = ctx.createRadialGradient(w / 2, fy + fh * 0.25, 10, w / 2, fy + fh * 0.25, Math.max(w, h) * 0.55);
  gl.addColorStop(0, `rgba(255,214,140,${0.3 + excite * 0.14 + pulse * 0.05})`); gl.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, fy, w, fh);
  // floor lamp (andon) and a lacquer tray with a teapot standing on the mats against the wall
  {
    const ax = w * 0.1, ay = hz + 42, aw = clamp(w * 0.07, 26, 50), ah = aw * 1.9, fl = 0.92 + 0.08 * Math.sin(t * 6.1) * Math.sin(t * 1.7 + 1);
    const g = ctx.createRadialGradient(ax, ay - ah * 0.5, 4, ax, ay - ah * 0.5, ah * 2.4);
    g.addColorStop(0, `rgba(255,200,120,${0.38 * fl})`); g.addColorStop(1, 'rgba(255,160,70,0)');
    ctx.fillStyle = g; ctx.fillRect(ax - ah * 2.4, ay - ah * 3, ah * 4.8, ah * 3.6);
    ctx.fillStyle = 'rgba(10,6,2,0.4)'; ctx.beginPath(); ctx.ellipse(ax, ay, aw * 0.85, aw * 0.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a170a'; ctx.fillRect(ax - aw / 2 - 3, ay - ah - 5, aw + 6, 8); ctx.fillRect(ax - aw / 2 - 3, ay - 6, aw + 6, 8);
    const pg = ctx.createLinearGradient(0, ay - ah, 0, ay);
    pg.addColorStop(0, `rgba(255,236,176,${fl})`); pg.addColorStop(1, `rgba(255,190,110,${fl})`);
    ctx.fillStyle = pg; ctx.fillRect(ax - aw / 2, ay - ah, aw, ah - 2);
    ctx.fillStyle = '#2a170a'; ctx.fillRect(ax - 2, ay - ah, 4, ah); ctx.fillRect(ax - aw / 2, ay - ah * 0.5 - 2, aw, 4);
    const tx = w * 0.9, ty = hz + 40, tw = clamp(w * 0.1, 40, 84);
    ctx.fillStyle = 'rgba(10,6,2,0.35)'; ctx.beginPath(); ctx.ellipse(tx, ty + 3, tw * 0.62, tw * 0.14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6a1a12'; ctx.beginPath(); ctx.ellipse(tx, ty - 2, tw * 0.6, tw * 0.15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8f2a1c'; ctx.beginPath(); ctx.ellipse(tx, ty - 5, tw * 0.55, tw * 0.12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d9d2c0'; ctx.beginPath(); ctx.ellipse(tx - tw * 0.16, ty - tw * 0.2, tw * 0.17, tw * 0.15, 0, 0, TAU); ctx.fill();    // teapot body
    ctx.fillRect(tx - tw * 0.2, ty - tw * 0.38, tw * 0.08, tw * 0.07);
    ctx.fillStyle = '#b9b2a2'; ctx.beginPath(); ctx.ellipse(tx + tw * 0.2, ty - tw * 0.1, tw * 0.1, tw * 0.07, 0, 0, TAU); ctx.fill();      // a cup
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(tx - tw * 0.2, ty - tw * 0.24, tw * 0.1, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
  }
  // warm light from the screens lying across the mats, and a few dust motes drifting up through the lantern light
  {
    const fy2 = hz + 10;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (pw + gap);
      const g = ctx.createLinearGradient(0, fy2, 0, fy2 + (h - fy2) * 0.55);
      g.addColorStop(0, `rgba(255,214,150,${0.11 + excite * 0.05})`); g.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(x, fy2); ctx.lineTo(x + pw, fy2); ctx.lineTo(x + pw * 1.25 + (x - w / 2) * 0.25, fy2 + (h - fy2) * 0.55); ctx.lineTo(x - pw * 0.25 + (x - w / 2) * 0.25, fy2 + (h - fy2) * 0.55); ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < 16; i++) {
      const sp = 5 + hash(i + 3) * 9, y = ((hash(i + 9) * hz * 1.5 - t * sp) % (hz * 1.2) + hz * 1.2) % (hz * 1.2), x = hash(i) * w + Math.sin(t * 0.35 + i * 1.7) * 18;
      const a = (0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 2.1))) * clamp(y / (hz * 0.25), 0, 1);
      ctx.fillStyle = `rgba(255,232,176,${a})`; ctx.beginPath(); ctx.arc(x, y, 1 + hash(i + 5) * 1.6, 0, TAU); ctx.fill();
    }
  }
  // paper lanterns hanging from above, swaying a little
  const ln = w > 900 ? 4 : 3;
  for (let i = 0; i < ln; i++) {
    const x = w * (i + 0.5) / ln + Math.sin(t * 0.9 + i * 2) * 5, top = -8, len = h * (0.07 + 0.045 * ((i * 7) % 3)), rr = clamp(w * 0.034, 18, 38);
    drawLantern(ctx, x, top, len, rr, t + i, 0.8 + excite * 0.2 + pulse * 0.1 + 0.07 * Math.sin(t * 7.3 + i * 3.1) * Math.sin(t * 2.3 + i));
  }
  // vignette
  const v = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(4,6,20,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

// A tokonoma alcove in place of one screen: a hanging scroll of ink hills and a vase with a blossoming branch on the low shelf.
function drawAlcove(ctx, x, y, w, h, t) {
  ctx.fillStyle = '#0a0f26'; ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
  const bg = ctx.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, '#8a7a56'); bg.addColorStop(1, '#4a3d28');
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  const sh = ctx.createLinearGradient(x, 0, x + w, 0);
  sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(0.2, 'rgba(0,0,0,0)'); sh.addColorStop(0.8, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = sh; ctx.fillRect(x, y, w, h);
  // the scroll: paper, indigo mounting, rollers, ink hills
  const sw = w * 0.34, sx = x + w * 0.3 - sw / 2, sy = y + h * 0.07, sh2 = h * 0.62;
  ctx.fillStyle = '#243a72'; ctx.fillRect(sx - 6, sy, sw + 12, sh2);
  ctx.fillStyle = '#efe2c0'; ctx.fillRect(sx, sy + sh2 * 0.1, sw, sh2 * 0.78);
  ctx.save(); ctx.beginPath(); ctx.rect(sx, sy + sh2 * 0.1, sw, sh2 * 0.78); ctx.clip();
  const iy = sy + sh2 * 0.1, ih = sh2 * 0.78;
  const hill = (cx, base, hw, hh, a) => { ctx.fillStyle = `rgba(30,34,44,${a})`; ctx.beginPath(); ctx.moveTo(cx - hw, base); ctx.quadraticCurveTo(cx - hw * 0.2, base - hh * 1.2, cx, base - hh); ctx.quadraticCurveTo(cx + hw * 0.3, base - hh * 0.9, cx + hw, base); ctx.closePath(); ctx.fill(); };
  hill(sx + sw * 0.7, iy + ih * 0.8, sw * 0.6, ih * 0.38, 0.28); hill(sx + sw * 0.3, iy + ih * 0.92, sw * 0.7, ih * 0.5, 0.55);
  ctx.fillStyle = 'rgba(210,60,40,0.55)'; ctx.beginPath(); ctx.arc(sx + sw * 0.72, iy + ih * 0.2, sw * 0.1, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(30,34,44,0.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx + sw * 0.18, iy + ih * 0.44); ctx.quadraticCurveTo(sx + sw * 0.3, iy + ih * 0.34, sx + sw * 0.46, iy + ih * 0.42); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#3a2412'; ctx.fillRect(sx - 8, sy + sh2 - 4, sw + 16, 7); ctx.fillRect(sx - 8, sy - 3, sw + 16, 6);
  // low shelf and a vase with a branch
  const shy = y + h * 0.84;
  const wg = ctx.createLinearGradient(0, shy, 0, y + h);
  wg.addColorStop(0, '#6b4526'); wg.addColorStop(1, '#2a180c');
  ctx.fillStyle = wg; ctx.fillRect(x, shy, w, y + h - shy);
  ctx.fillStyle = 'rgba(255,220,160,0.25)'; ctx.fillRect(x, shy, w, 2);
  const vx = x + w * 0.74, vb = shy;
  const vg = ctx.createLinearGradient(vx - w * 0.07, 0, vx + w * 0.07, 0);
  vg.addColorStop(0, '#3f6a60'); vg.addColorStop(0.45, '#8fc2b4'); vg.addColorStop(1, '#2e4f48');
  ctx.fillStyle = vg; ctx.beginPath(); ctx.moveTo(vx - w * 0.035, vb); ctx.quadraticCurveTo(vx - w * 0.1, vb - h * 0.09, vx - w * 0.04, vb - h * 0.17); ctx.lineTo(vx + w * 0.04, vb - h * 0.17); ctx.quadraticCurveTo(vx + w * 0.1, vb - h * 0.09, vx + w * 0.035, vb); ctx.closePath(); ctx.fill();
  const sw2 = Math.sin(t * 0.7) * 2;
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(vx, vb - h * 0.17); ctx.quadraticCurveTo(vx - w * 0.08 + sw2, vb - h * 0.34, vx - w * 0.14 + sw2, vb - h * 0.44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vx - w * 0.06 + sw2 * 0.6, vb - h * 0.31); ctx.quadraticCurveTo(vx - w * 0.02, vb - h * 0.42, vx + w * 0.02 + sw2, vb - h * 0.5); ctx.stroke();
  for (const [bx, by] of [[-0.14, 0.44], [-0.1, 0.4], [0.02, 0.5], [-0.05, 0.46], [-0.15, 0.36]]) {
    const fx = vx + w * bx + sw2, fy = vb - h * by;
    ctx.fillStyle = '#f4a9bb'; for (let p = 0; p < 5; p++) { const a = p * TAU / 5; ctx.beginPath(); ctx.ellipse(fx + Math.cos(a) * 4, fy + Math.sin(a) * 4, 3.4, 2.4, a, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, TAU); ctx.fill();
  }
}

function drawLantern(ctx, x, top, len, r, t, glow) {
  ctx.strokeStyle = 'rgba(20,12,8,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + len); ctx.stroke();
  const cy = top + len + r * 1.2;
  const g = ctx.createRadialGradient(x, cy, r * 0.2, x, cy, r * 3.2);
  g.addColorStop(0, `rgba(255,200,110,${0.5 * glow})`); g.addColorStop(1, 'rgba(255,160,70,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r * 3.2, cy - r * 3.2, r * 6.4, r * 6.4);
  const bg = ctx.createRadialGradient(x - r * 0.3, cy - r * 0.3, r * 0.1, x, cy, r * 1.3);
  bg.addColorStop(0, '#fff2c8'); bg.addColorStop(0.55, '#f08a3a'); bg.addColorStop(1, '#a8341c');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(x, cy, r, r * 1.25, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(70,16,8,0.55)'; ctx.lineWidth = 1.6;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(x, cy, r, r * 1.25 * (0.5 + Math.abs(k) * 0.12) * (k ? 1 : 0.3) + 0.01, 0, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#2a140a'; ctx.fillRect(x - r * 0.5, cy - r * 1.25 - 3, r, 6); ctx.fillRect(x - r * 0.5, cy + r * 1.25 - 3, r, 6);
}

// ---- fabrics and bags ---------------------------------------------------------------------------------------------------------------
// Paints the cloth pattern into the square [-s/2, s/2]^2 (caller has set the clip). Original geometric patterns in the spirit of
// traditional woven and printed cloth: nothing is traced from a particular textile.
function paintFabric(ctx, f, s) {
  const h = s / 2;
  ctx.fillStyle = f.base; ctx.fillRect(-h, -h, s, s);
  ctx.strokeStyle = f.ink; ctx.fillStyle = f.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (f.id === 'asanoha') {
    const c = s / 3; ctx.lineWidth = Math.max(1.2, s * 0.022);
    for (let gy = -1; gy <= 1; gy++) for (let gx = -1; gx <= 1; gx++) {
      const cx = gx * c, cy = gy * c, q = c / 2;
      ctx.beginPath();
      for (const [dx, dy] of [[-q, -q], [q, -q], [q, q], [-q, q], [0, -q], [q, 0], [0, q], [-q, 0]]) { ctx.moveTo(cx, cy); ctx.lineTo(cx + dx, cy + dy); }
      ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy - q); ctx.lineTo(cx + q, cy + q); ctx.lineTo(cx - q, cy + q); ctx.closePath();
      ctx.stroke();
    }
  } else if (f.id === 'seigaiha') {
    const r = s * 0.27; ctx.lineWidth = Math.max(1.2, s * 0.02);
    for (let row = -3; row <= 3; row++) for (let col = -3; col <= 3; col++) {
      const cx = col * r * 2 + (row % 2 ? r : 0), cy = row * r * 0.5 + s * 0.25;
      ctx.fillStyle = f.base; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.closePath(); ctx.fill();
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, r * (1 - k * 0.3), Math.PI, 0); ctx.stroke(); }
    }
  } else if (f.id === 'kasuri') {
    ctx.lineWidth = Math.max(1.5, s * 0.03);
    for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 7; gx++) {
      const x = -h + (gx + 0.5) * s / 7, y = -h + (gy + 0.5) * s / 7, k = hash(gx * 7 + gy), len = s / 7 * (0.25 + 0.5 * k);
      ctx.globalAlpha = 0.55 + 0.4 * hash(gx + gy * 9);
      ctx.beginPath(); ctx.moveTo(x - len, y); ctx.lineTo(x + len, y); ctx.stroke();
      if ((gx + gy) % 2 === 0) { ctx.beginPath(); ctx.moveTo(x, y - len * 0.7); ctx.lineTo(x, y + len * 0.7); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  } else if (f.id === 'shippo') {
    const r = s * 0.25; ctx.lineWidth = Math.max(1.4, s * 0.026);
    for (let gy = -3; gy <= 3; gy++) for (let gx = -3; gx <= 3; gx++) { ctx.beginPath(); ctx.arc(gx * r * 1.4142 + (gy % 2 ? r * 0.707 : 0), gy * r * 0.707, r, 0, TAU); ctx.stroke(); }
  } else if (f.id === 'ichimatsu') {
    const c = s / 4;
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) if ((gx + gy) % 2 === 0) ctx.fillRect(-h + gx * c, -h + gy * c, c, c);
  } else if (f.id === 'uroko') {
    const c = s / 4;
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 5; gx++) {
      const x = -h + gx * c - (gy % 2 ? c / 2 : 0), y = -h + gy * c * 0.9;
      ctx.beginPath(); ctx.moveTo(x, y + c * 0.9); ctx.lineTo(x + c / 2, y); ctx.lineTo(x + c, y + c * 0.9); ctx.closePath(); ctx.fill();
    }
  } else if (f.id === 'shima') {
    const c = s / 7;
    for (let k = 0; k < 7; k += 2) ctx.fillRect(-h + k * c, -h, c, s);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 1; k < 7; k += 2) ctx.fillRect(-h + k * c + c * 0.35, -h, c * 0.12, s);
  } else if (f.id === 'sakura') {
    for (let k = 0; k < 6; k++) {
      const x = (hash(k * 2 + 1) - 0.5) * s * 0.8, y = (hash(k * 2 + 2) - 0.5) * s * 0.8, r = s * (0.1 + 0.05 * hash(k + 40)), a0 = hash(k + 9) * TAU;
      for (let p = 0; p < 5; p++) { const a = a0 + p * TAU / 5; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5, r * 0.3, a, 0, TAU); ctx.fill(); }
    }
  }
}

// One bag centred at (x, y), `s` wide, rotated by `rot`, squashed by `sq` (0 none .. 1 flat), fabric index `fi` into FABRICS.
export function drawBag(ctx, x, y, s, rot, fi, sq = 0, alpha = 1) {
  const f = FABRICS[fi % FABRICS.length];
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1 + sq * 0.22, 1 - sq * 0.2);
  const w = s, hgt = s * 0.94, rad = s * 0.3;
  const path = () => { ctx.beginPath(); ctx.roundRect(-w / 2, -hgt / 2, w, hgt, rad); };
  // contact shadow edge
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.roundRect(-w / 2 + 2, -hgt / 2 + 5, w, hgt, rad); ctx.fill();
  path(); ctx.save(); ctx.clip();
  paintFabric(ctx, f, s * 1.05);
  // plump lighting: highlight upper-left, shade lower-right, a crease where the cloth is gathered
  const hg = ctx.createRadialGradient(-s * 0.2, -s * 0.24, s * 0.04, -s * 0.05, -s * 0.05, s * 0.78);
  hg.addColorStop(0, 'rgba(255,255,255,0.5)'); hg.addColorStop(0.45, 'rgba(255,255,255,0.06)'); hg.addColorStop(1, 'rgba(10,6,30,0.5)');
  ctx.fillStyle = hg; ctx.fillRect(-s, -s, s * 2, s * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = Math.max(1.5, s * 0.03);
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(0, s * 0.08, w / 2, 0); ctx.stroke();
  ctx.restore();
  // stitched seam just inside the edge
  ctx.setLineDash([s * 0.07, s * 0.06]); ctx.strokeStyle = 'rgba(255,245,225,0.55)'; ctx.lineWidth = Math.max(1.2, s * 0.022);
  ctx.beginPath(); ctx.roundRect(-w / 2 + s * 0.07, -hgt / 2 + s * 0.07, w - s * 0.14, hgt - s * 0.14, rad * 0.8); ctx.stroke(); ctx.setLineDash([]);
  path(); ctx.lineWidth = Math.max(2, s * 0.04); ctx.strokeStyle = 'rgba(14,8,34,0.7)'; ctx.stroke();
  ctx.restore();
}

// A swatch of a fabric for menus (rounded square, not lit).
export function drawSwatch(ctx, x, y, s, fi, locked = false) {
  const f = FABRICS[fi % FABRICS.length];
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.26); ctx.save(); ctx.clip();
  paintFabric(ctx, f, s * 1.05);
  if (locked) { ctx.fillStyle = 'rgba(10,8,30,0.72)'; ctx.fillRect(-s, -s, s * 2, s * 2); }
  ctx.restore();
  ctx.lineWidth = 2.5; ctx.strokeStyle = locked ? 'rgba(255,240,220,0.3)' : 'rgba(255,244,220,0.8)'; ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.26); ctx.stroke();
  ctx.restore();
}

// ---- hands ---------------------------------------------------------------------------------------------------------------------------
// A sleeve coming up from the bottom edge and a cupped palm at (x, y) (the point where a bag sits). press 0..1 lifts and cups it.
export function drawHand(ctx, x, y, s, side, press, bottom, glow = 0) {
  const dir = side === 0 ? 1 : -1;         // sleeves lean in from the outer edge
  const lift = press * s * 0.16;
  ctx.save();
  // sleeve
  const topW = s * 0.78, botW = s * 1.9, sx = x + dir * s * 0.18, cuffY = y + s * 0.42 - lift;
  ctx.beginPath(); ctx.moveTo(sx - topW / 2, cuffY); ctx.lineTo(sx + topW / 2, cuffY);
  ctx.lineTo(x + dir * s * 0.55 + botW / 2, bottom + 4); ctx.lineTo(x + dir * s * 0.55 - botW / 2, bottom + 4); ctx.closePath();
  const sg = ctx.createLinearGradient(x - s, 0, x + s, 0);
  sg.addColorStop(0, '#1a2a63'); sg.addColorStop(0.5, '#34509a'); sg.addColorStop(1, '#15204a');
  ctx.fillStyle = sg; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(220,235,255,0.2)'; ctx.lineWidth = 2;
  for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(sx + dir * s * 0.15, cuffY + s * 0.55 + k * s * 0.42, s * 0.34, 0, TAU); ctx.stroke(); }
  ctx.restore();
  // cuff
  ctx.fillStyle = '#f6e7c4'; ctx.beginPath(); ctx.roundRect(sx - topW / 2 - 4, cuffY - s * 0.1, topW + 8, s * 0.2, s * 0.08); ctx.fill();
  ctx.fillStyle = '#d9432e'; ctx.fillRect(sx - topW / 2, cuffY + s * 0.04, topW, s * 0.035);
  // palm, fingers and thumb: a cupped open hand seen from the front, palm up, fingers curling up around the bag
  const py = y + s * 0.2 - lift, SK0 = '#fbe2c6', SK1 = '#d9a982', EDGE = 'rgba(110,62,36,0.55)';
  const skin = (x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, SK0); g.addColorStop(1, SK1); return g; };
  const cap = (cx, cy, len, wid, ang) => {           // a finger: a rounded bar from (cx, cy) growing along ang
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.beginPath(); ctx.roundRect(-wid / 2, -len, wid, len, wid / 2);
    ctx.fillStyle = skin(-wid / 2, -len, wid / 2, 0); ctx.fill(); ctx.strokeStyle = EDGE; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(110,62,36,0.28)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-wid * 0.3, -len * 0.5); ctx.lineTo(wid * 0.3, -len * 0.5); ctx.moveTo(-wid * 0.3, -len * 0.75); ctx.lineTo(wid * 0.3, -len * 0.75); ctx.stroke();
    ctx.restore();
  };
  // fingers fan out and up from the top of the palm (index nearest the thumb side)
  const fl = [0.34, 0.4, 0.38, 0.3], fw = s * 0.15;
  for (let i = 0; i < 4; i++) {
    const u = (i - 1.5) / 1.5, fx = x + dir * 0 + u * s * 0.3, fy = py - s * 0.1 + Math.abs(u) * s * 0.05;
    cap(fx, fy, s * fl[i] * (1 - lift / (s * 3)), fw, u * 0.22);
  }
  // palm
  const pg = ctx.createLinearGradient(0, py - s * 0.2, 0, py + s * 0.26);
  pg.addColorStop(0, SK0); pg.addColorStop(1, SK1);
  ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(x, py, s * 0.5, s * 0.21 * (1 + press * 0.25), 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = EDGE; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(110,62,36,0.3)'; ctx.beginPath(); ctx.arc(x - dir * s * 0.06, py + s * 0.02, s * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();   // the heart line
  // thumb on the inner side, lying across the edge of the palm
  const tx = x - dir * s * 0.42, ty = py + s * 0.02;
  cap(tx, ty + s * 0.02, s * 0.3, s * 0.17, -dir * 0.95);
  if (glow > 0) { ctx.strokeStyle = `rgba(255,236,160,${0.7 * glow})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, py, s * 0.62, s * 0.3, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// Both hands (and the performer behind them when the 3D layer is available). spec: { t, paused, bag, handY, bottom, xC, pull, hands:[{x, lift, press}x2], look }
export function drawHands(ctx, spec) {
  if (hooks.hands && hooks.hands(ctx, spec)) return;
  for (let h = 0; h < 2; h++) {
    const d = spec.hands[h], x = d.x;
    drawHand(ctx, x, spec.handY - d.lift, spec.bag * 1.05, h, d.press + spec.pull * 0.5, spec.bottom, 0);
  }
}

// ---- particles (bean grains and sparkle) ---------------------------------------------------------------------------------------------
export function burst(list, rng, x, y, n, col, power = 1, up = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), sp = rng.range(40, 190) * power;
    list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90 * up, life: 0, max: rng.range(0.45, 0.95), r: rng.range(2.2, 4.8), col, rot: a });
  }
  if (list.length > 160) list.splice(0, list.length - 160);
}
export function stepParticles(list, dt) {
  for (const p of list) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 1 - 1.4 * dt; p.rot += dt * 6; }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].life >= list[i].max) list.splice(i, 1);
}
export function drawParticles(ctx, list) {
  ctx.save();
  for (const p of list) {
    const a = 1 - p.life / p.max;
    ctx.globalAlpha = clamp(a * 1.4, 0, 1); ctx.fillStyle = p.col;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.35, p.r * 0.8, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}
export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.25) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * gap * 2;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? size * 0.45 : size, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    ctx.fillStyle = i < n ? '#ffd45a' : 'rgba(255,255,255,0.14)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = i < n ? '#a8741a' : 'rgba(255,255,255,0.25)'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
}
export { shade };
