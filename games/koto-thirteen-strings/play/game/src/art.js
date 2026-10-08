// Koto: all the painting that is not UI. A quiet room at dusk, the paulownia-wood instrument with silk strings and ivory bridges,
// plectrum-disc notes, a teacher's fingertip, petals and sparks. Pure canvas 2D; no DOM. Everything is a function of its arguments.
import { NSTR, GEO, KANJI } from './music.js';
import { BODY, makeInst } from './layout.js';

export const PAL = {
  ink: '#0d0c1c', night: '#171629', wall: '#1d2036', paper: '#f1e2bc', lacquer: '#c8281f', lacquerHi: '#ff7a58', vermilion: '#e8452c',
  gold: '#f0d28a', goldDeep: '#b58a32', ivory: '#fff6df', silk: '#efe4c6', wood: '#e4c896', woodDark: '#8c6a3c', ebony: '#2a1a14',
  ember: '#e8452c', emberHi: '#ffc2a0', ice: '#4fc3ff', iceHi: '#dff5ff', tea: '#8fd6c4', sky: '#9fd0ff', sakura: '#ffc2d4', text: '#f8eed8', dim: 'rgba(248,238,216,0.64)',
};
export const DISPLAY = '"Cormorant Garamond", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", Georgia, serif';
export const MINCHO = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", "Noto Serif JP", "Songti SC", serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, k) => a + (b - a) * k;
const hash = (i) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// ---- cache for the heavy static pictures (OffscreenCanvas when the browser has one; otherwise they are drawn directly) -------------------
const caches = new Map();
function cached(key, x, y, w, h, scale, paint) {
  if (typeof OffscreenCanvas !== 'function') return null;
  let c = caches.get(key);
  if (!c) {
    if (caches.size > 14) caches.clear();
    try {
      const cv = new OffscreenCanvas(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale))), g = cv.getContext('2d');
      g.scale(scale, scale); g.translate(-x, -y); paint(g); c = { cv, x, y, w, h };
    } catch { c = null; }
    caches.set(key, c);
  }
  return c;
}

// ---- the room ------------------------------------------------------------------------------------------------------------------------------------
function paintRoom(g, w, h) {
  const vert = h > w, hz = Math.round(h * (vert ? 0.2 : 0.27));
  // wall
  const wg = g.createLinearGradient(0, 0, 0, hz); wg.addColorStop(0, '#12142a'); wg.addColorStop(1, '#262337');
  g.fillStyle = wg; g.fillRect(0, 0, w, hz + 2);
  // shoji screens: warm paper panels with a lattice, lit from behind, a moon and bamboo shadows on one of them
  const n = vert ? 3 : Math.max(3, Math.round(w / 330)), pw = (w - 16) / n, top = 10, bot = hz - 14;
  for (let i = 0; i < n; i++) {
    const x = 8 + i * pw, glow = g.createLinearGradient(0, top, 0, bot);
    glow.addColorStop(0, 'rgba(236,214,160,0.20)'); glow.addColorStop(1, 'rgba(255,226,170,0.34)');
    g.fillStyle = glow; g.fillRect(x + 5, top, pw - 10, bot - top);
    if (i === Math.floor(n / 2)) {                                       // a pale moon and bamboo behind the paper
      const mx = x + pw * 0.62, my = top + (bot - top) * 0.34, mr = Math.min(pw * 0.2, (bot - top) * 0.2);
      const mg = g.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 2.6); mg.addColorStop(0, 'rgba(255,246,214,0.55)'); mg.addColorStop(1, 'rgba(255,246,214,0)');
      g.fillStyle = mg; g.fillRect(x + 5, top, pw - 10, bot - top);
      g.fillStyle = 'rgba(255,248,222,0.55)'; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
    }
    if (i !== 1 || n === 3) {
      g.save(); g.beginPath(); g.rect(x + 5, top, pw - 10, bot - top); g.clip();
      g.strokeStyle = 'rgba(40,28,20,0.22)'; g.lineWidth = 5; g.lineCap = 'round';
      const bx = x + pw * (i % 2 ? 0.22 : 0.78);
      g.beginPath(); g.moveTo(bx, bot + 10); g.lineTo(bx + 4, top - 10); g.stroke();
      for (let k = 0; k < 9; k++) {
        const ly = top + (bot - top) * (0.1 + 0.1 * k), side = k % 2 ? 1 : -1, a = -0.5 * side + (hash(i * 9 + k) - 0.5) * 0.4;
        g.save(); g.translate(bx + 2, ly); g.rotate(a + (side > 0 ? 0 : Math.PI)); g.fillStyle = 'rgba(40,40,24,0.2)';
        g.beginPath(); g.ellipse(26, 0, 30, 5, 0, 0, TAU); g.fill(); g.restore();
      }
      g.restore();
    }
    // lattice (kumiko): dark wood frame and thin bars
    g.strokeStyle = 'rgba(30,20,14,0.92)'; g.lineWidth = 7; g.strokeRect(x + 3, top - 2, pw - 6, bot - top + 4);
    g.lineWidth = 3; const cols = 3, rows = Math.max(4, Math.round((bot - top) / 70));
    for (let c = 1; c < cols; c++) { g.beginPath(); g.moveTo(x + (pw * c) / cols, top); g.lineTo(x + (pw * c) / cols, bot); g.stroke(); }
    for (let r = 1; r < rows; r++) { g.beginPath(); g.moveTo(x, top + ((bot - top) * r) / rows); g.lineTo(x + pw, top + ((bot - top) * r) / rows); g.stroke(); }
    g.strokeStyle = 'rgba(255,226,170,0.1)'; g.lineWidth = 1.2;
    for (let c = 1; c < cols; c++) { g.beginPath(); g.moveTo(x + (pw * c) / cols + 3, top); g.lineTo(x + (pw * c) / cols + 3, bot); g.stroke(); }
  }
  // the beam where the wall meets the floor
  const bg = g.createLinearGradient(0, hz - 14, 0, hz + 12); bg.addColorStop(0, '#2a1a12'); bg.addColorStop(0.5, '#4a2f1d'); bg.addColorStop(1, '#1c110b');
  g.fillStyle = bg; g.fillRect(0, hz - 14, w, 26);
  g.fillStyle = 'rgba(255,220,160,0.18)'; g.fillRect(0, hz - 14, w, 2);
  // tatami floor: straw mats with dark cloth borders
  const fg = g.createLinearGradient(0, hz, 0, h); fg.addColorStop(0, '#3b3b22'); fg.addColorStop(0.55, '#2c2c19'); fg.addColorStop(1, '#17170d');
  g.fillStyle = fg; g.fillRect(0, hz + 12, w, h - hz);
  const mw = vert ? w / 2 : Math.max(240, w / 4), mh = mw * 2;
  g.save(); g.beginPath(); g.rect(0, hz + 12, w, h); g.clip();
  for (let y0 = hz + 12, row = 0; y0 < h + mh; y0 += mh / 2, row++) {
    for (let x0 = -(row % 2) * (mw / 2); x0 < w + mw; x0 += mw) {
      // weave
      g.strokeStyle = 'rgba(190,200,120,0.045)'; g.lineWidth = 1;
      for (let k = 0; k < mh / 2; k += 7) { g.beginPath(); g.moveTo(x0, y0 + k); g.lineTo(x0 + mw, y0 + k); g.stroke(); }
      g.strokeStyle = 'rgba(12,12,6,0.65)'; g.lineWidth = 6; g.strokeRect(x0, y0, mw, mh / 2);
      g.strokeStyle = 'rgba(120,130,70,0.14)'; g.lineWidth = 1.5; g.strokeRect(x0 + 4, y0 + 4, mw - 8, mh / 2 - 8);
    }
  }
  g.restore();
  // lamplight and vignette
  const lg = g.createRadialGradient(w / 2, h * 0.62, Math.min(w, h) * 0.1, w / 2, h * 0.62, Math.max(w, h) * 0.7);
  lg.addColorStop(0, 'rgba(255,190,110,0.16)'); lg.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = lg; g.fillRect(0, hz, w, h);
  const vg = g.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(3,2,10,0.62)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
}
export function drawRoom(ctx, w, h) {
  const c = cached(`room${Math.round(w)}x${Math.round(h)}`, 0, 0, w, h, 1, (g) => paintRoom(g, w, h));
  if (c) ctx.drawImage(c.cv, 0, 0, w, h);
  else { ctx.fillStyle = '#1d2036'; ctx.fillRect(0, 0, w, h); }
}

// ---- the instrument body ----------------------------------------------------------------------------------------------------------------------
function paintBody(g, inst) {
  const { len, W, m } = inst, x0 = BODY.a0 * len, x1 = BODY.a1 * len, rad = m * 0.9;
  g.save(); inst.apply(g);
  const rr = (a, b, c, d, r) => { g.beginPath(); g.roundRect(a, b, c - a, d - b, r); };
  // shadow on the mats
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 34; g.shadowOffsetY = 12; g.fillStyle = '#5a4020'; rr(x0, -m, x1, W + m, rad); g.fill(); g.restore();
  // wood: an arched top is lit along its ridge and falls away at both edges
  const wg = g.createLinearGradient(0, -m, 0, W + m);
  [[0, '#a88150'], [0.07, '#c7a26c'], [0.26, '#e9d0a0'], [0.46, '#f4e2b8'], [0.64, '#ead09f'], [0.9, '#c29d65'], [1, '#8f6c3d']].forEach(([o, c]) => wg.addColorStop(o, c));
  g.fillStyle = wg; rr(x0, -m, x1, W + m, rad); g.fill();
  g.save(); rr(x0, -m, x1, W + m, rad); g.clip();
  // grain
  for (let i = 0; i < 120; i++) {
    const y = -m + (W + 2 * m) * hash(i), a = 0.035 + 0.07 * hash(i + 300), amp = 1 + 3 * hash(i + 600), ph = hash(i + 900) * 6, sx = x0 + (x1 - x0) * hash(i + 1200) * 0.3, ex = sx + (x1 - x0) * (0.55 + 0.45 * hash(i + 1500));
    g.strokeStyle = `rgba(${hash(i + 50) > 0.5 ? '120,82,40' : '150,110,60'},${a})`; g.lineWidth = 0.8 + 1.4 * hash(i + 77);
    g.beginPath();
    for (let x = sx; x <= Math.min(ex, x1); x += (x1 - x0) / 36) { const yy = y + Math.sin(x / (len * 0.11) + ph) * amp; x === sx ? g.moveTo(x, yy) : g.lineTo(x, yy); }
    g.stroke();
  }
  // broad sheen on the arch, soft shade at the edges
  const sg = g.createLinearGradient(0, -m, 0, W + m); sg.addColorStop(0.12, 'rgba(255,255,255,0)'); sg.addColorStop(0.3, 'rgba(255,250,230,0.28)'); sg.addColorStop(0.42, 'rgba(255,250,230,0)'); sg.addColorStop(0.78, 'rgba(255,240,200,0.1)'); sg.addColorStop(0.9, 'rgba(255,240,200,0)');
  g.fillStyle = sg; g.fillRect(x0, -m, x1 - x0, W + 2 * m);
  const eg = g.createLinearGradient(0, -m, 0, W + m); eg.addColorStop(0, 'rgba(40,20,5,0.42)'); eg.addColorStop(0.1, 'rgba(40,20,5,0)'); eg.addColorStop(0.9, 'rgba(40,20,5,0)'); eg.addColorStop(1, 'rgba(40,20,5,0.5)');
  g.fillStyle = eg; g.fillRect(x0, -m, x1 - x0, W + 2 * m);
  // end panels: ebony lacquer with a gold wave pattern
  const panel = (a, b) => {
    const pg = g.createLinearGradient(0, -m, 0, W + m); pg.addColorStop(0, '#1b100c'); pg.addColorStop(0.45, '#3b261a'); pg.addColorStop(1, '#1a0f0a');
    g.fillStyle = pg; g.fillRect(a, -m, b - a, W + 2 * m);
    g.save(); g.beginPath(); g.rect(a, -m, b - a, W + 2 * m); g.clip();
    g.strokeStyle = 'rgba(240,206,120,0.28)'; g.lineWidth = 1.6; const R = Math.max(10, (b - a) * 0.34);
    for (let r = 0, y = -m; y < W + m + R; r++, y += R * 0.5) for (let x = a - (r % 2) * R; x < b + R; x += R * 2) for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + R, y, R * (1 - k * 0.3), Math.PI * 0.5, Math.PI * 1.5); g.stroke(); }
    g.restore();
    g.strokeStyle = 'rgba(240,206,120,0.7)'; g.lineWidth = 2; g.strokeRect(a + 3, -m + 3, b - a - 6, W + 2 * m - 6);
  };
  panel(x0, GEO.uFar * len - 8); panel(GEO.uNear * len + 8, x1);
  g.restore();
  // nuts (the bridges at both ends that the strings are tied over)
  for (const u of [GEO.uFar, GEO.uNear]) {
    const x = u * len, ng = g.createLinearGradient(x - 7, 0, x + 7, 0); ng.addColorStop(0, '#120a07'); ng.addColorStop(0.45, '#4c3220'); ng.addColorStop(0.55, '#5c3d28'); ng.addColorStop(1, '#120a07');
    g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 8; g.shadowOffsetX = 2; g.fillStyle = ng; rr(x - 7, -m * 0.55, x + 7, W + m * 0.55, 6); g.fill(); g.restore();
    g.strokeStyle = 'rgba(240,206,120,0.65)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, -m * 0.4); g.lineTo(x, W + m * 0.4); g.stroke();
  }
  // edge lines
  g.strokeStyle = 'rgba(90,60,25,0.55)'; g.lineWidth = 2; rr(x0 + 5, -m + 5, x1 - 5, W + m - 5, rad * 0.8); g.stroke();
  g.strokeStyle = 'rgba(255,244,214,0.5)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0 + rad, -m + 2.5); g.lineTo(x1 - rad, -m + 2.5); g.stroke();
  g.strokeStyle = 'rgba(30,18,6,0.9)'; g.lineWidth = 3; rr(x0, -m, x1, W + m, rad); g.stroke();
  g.restore();
}
export function drawBody(ctx, inst, size) {
  const pad = 46, r = inst.r;
  if (!size) { paintBody(ctx, inst); return; }                           // small figures are painted directly
  const c = cached(`body${inst.key}`, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 1.25, (g) => paintBody(g, inst));
  if (c) ctx.drawImage(c.cv, c.x, c.y, c.w, c.h); else paintBody(ctx, inst);
}

// The string numerals at the player's end (screen space, always upright).
export function drawLabels(ctx, inst, size, hi = null, numbers = true) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const u = (GEO.uNear + BODY.a1) / 2 + 0.003;
  for (let s = 0; s < NSTR; s++) {
    const p = inst.pt(u, s), on = hi && hi.has(s);
    ctx.font = `700 ${size}px ${MINCHO}`; ctx.fillStyle = on ? '#fff0b8' : 'rgba(240,214,150,0.86)';
    if (on) { ctx.shadowColor = 'rgba(255,220,120,0.9)'; ctx.shadowBlur = 12; }
    ctx.fillText(KANJI[s], p.x, p.y - (numbers ? size * 0.28 : 0)); ctx.shadowBlur = 0;
    if (numbers) { ctx.font = `600 ${size * 0.5}px ${UI}`; ctx.fillStyle = 'rgba(240,214,150,0.55)'; ctx.fillText(String(s + 1), p.x, p.y + size * 0.52); }
  }
  ctx.restore();
}

// ---- strings and bridges --------------------------------------------------------------------------------------------------------------------------
// ss[s] = { vib (0..1 amplitude), ph (phase), glow (0..1), press (0..2) }; bu[s] = bridge position (u); focus = Set of strings to light softly.
export function drawStrings(ctx, inst, ss, bu, o = {}) {
  const { len, sp } = inst, th0 = clamp(sp * 0.12, 1.8, 6.5);
  ctx.save(); inst.apply(ctx); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let s = 0; s < NSTR; s++) {
    const st = ss[s] ?? {}, ly = (s + 0.5) * sp, th = th0 * (1.3 - 0.62 * s / (NSTR - 1)), xa = GEO.uFar * len, xb = bu[s] * len, xn = GEO.uNear * len;
    const amp = (st.vib ?? 0) * sp * 0.5, ph = st.ph ?? 0, pr = st.press ?? 0, soft = o.focus && o.focus.has(s);
    const path = (dy, dx = 0) => {
      ctx.beginPath(); ctx.moveTo(xa, ly + dy);
      if (pr) { ctx.lineTo(xb - 0.02 * len, ly + dy); ctx.lineTo(xb, ly + dy + sp * 0.07 * pr * (s % 2 ? 1 : -1)); } else ctx.lineTo(xb, ly + dy);
      const N = amp > 0.4 ? 22 : 1;
      for (let i = 1; i <= N; i++) { const x = xb + ((xn - xb) * i) / N, k = (i / N); ctx.lineTo(x + dx, ly + dy + (N > 1 ? Math.sin(Math.PI * k) * amp * Math.cos(ph) : 0)); }
    };
    ctx.strokeStyle = 'rgba(40,24,6,0.38)'; ctx.lineWidth = th + 1.5; path(th * 0.9 + 1.5); ctx.stroke();
    if ((st.glow ?? 0) > 0.02 || soft) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,214,140,${0.1 + 0.4 * (st.glow ?? 0) + (soft ? 0.14 : 0)})`; ctx.lineWidth = th * 4.2; path(0); ctx.stroke(); ctx.restore();
    }
    ctx.strokeStyle = '#efe3c3'; ctx.lineWidth = th; path(0); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(0.8, th * 0.34); path(-th * 0.22); ctx.stroke();
  }
  ctx.restore();
}
export function drawBridges(ctx, inst, bu, o = {}) {
  const { len, sp } = inst, d = clamp(sp * 0.46, 10, 26), wd = sp * 0.82;
  ctx.save(); inst.apply(ctx);
  for (let s = 0; s < NSTR; s++) {
    const x = bu[s] * len, y = (s + 0.5) * sp, lift = o.drag === s ? 1 : 0;
    ctx.save(); ctx.translate(0, 0);
    ctx.fillStyle = 'rgba(30,16,4,0.34)'; ctx.beginPath(); ctx.roundRect(x - d / 2 + 4, y - wd / 2 + 4 + lift * 3, d, wd, 5); ctx.fill();
    const g = ctx.createLinearGradient(x - d / 2, 0, x + d / 2, 0); g.addColorStop(0, '#cfc19c'); g.addColorStop(0.45, '#fffcf0'); g.addColorStop(0.55, '#f8f0da'); g.addColorStop(1, '#bfb08a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x - d / 2, y - wd / 2 - lift * 2, d, wd, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(90,70,35,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - d * 0.1, y - wd / 2 + 4); ctx.lineTo(x - d * 0.1, y + wd / 2 - 4); ctx.stroke();
    if (o.hot && o.hot.has(s)) { ctx.strokeStyle = 'rgba(255,214,120,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - d / 2 - 3, y - wd / 2 - 3, d + 6, wd + 6, 7); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
}

// A pad that shows where a string is being pressed (behind its bridge).
export function drawPress(ctx, inst, s, b, level, a = 1) {
  const p0 = inst.pt(GEO.uFar + 0.01, s), p1 = inst.pt(b - 0.005, s), { sp } = inst;
  ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,214,120,0.16)'; ctx.lineWidth = sp * 0.9; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  const pm = inst.pt(b - GEO.halfBand, s);
  ctx.strokeStyle = 'rgba(255,214,120,0.5)'; ctx.lineWidth = 2;
  const nrm = inst.across, hw = sp * 0.5;
  ctx.beginPath(); ctx.moveTo(pm.x - nrm.x * hw, pm.y - nrm.y * hw); ctx.lineTo(pm.x + nrm.x * hw, pm.y + nrm.y * hw); ctx.stroke();
  if (level) {
    const where = inst.pt(level === 1 ? b - GEO.halfBand / 2 : b - GEO.halfBand - 0.08, s);
    const g = ctx.createRadialGradient(where.x, where.y, 2, where.x, where.y, sp * 0.9); g.addColorStop(0, 'rgba(255,236,170,0.95)'); g.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(where.x, where.y, sp * 0.9, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- notes ------------------------------------------------------------------------------------------------------------------------------------------
// kind: 'note' (lacquer disc) | 'ghost' (the teacher's note) | 'sweep'. press 0-2 adds the gold oshide ring. dir = unit vector the disc travels along.
export function drawDisc(ctx, x, y, r, kind, press, alpha, dir, flash = 0) {
  ctx.save(); ctx.globalAlpha = alpha;
  if (dir) {                                                             // a soft trail back along the string
    const tl = r * 3.4, tg = ctx.createLinearGradient(x, y, x - dir.x * tl, y - dir.y * tl);
    const c = kind === 'ghost' ? '159,208,255' : kind === 'sweep' ? '70,200,180' : '255,110,80';
    tg.addColorStop(0, `rgba(${c},0.45)`); tg.addColorStop(1, `rgba(${c},0)`);
    ctx.strokeStyle = tg; ctx.lineWidth = r * 1.3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dir.x * tl, y - dir.y * tl); ctx.stroke();
  }
  const rr = kind === 'sweep' ? r * 0.84 : r;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(x + 2, y + 3, rr, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.35, rr * 0.1, x, y, rr);
  if (kind === 'ghost') { g.addColorStop(0, 'rgba(225,240,255,0.95)'); g.addColorStop(1, 'rgba(110,160,230,0.85)'); }
  else if (kind === 'sweep') { g.addColorStop(0, '#9af0dc'); g.addColorStop(0.6, '#2fb6a3'); g.addColorStop(1, '#17695f'); }
  else { g.addColorStop(0, '#ff9a78'); g.addColorStop(0.55, '#d92e22'); g.addColorStop(1, '#7c140e'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
  ctx.strokeStyle = kind === 'ghost' ? 'rgba(255,255,255,0.8)' : 'rgba(255,240,210,0.9)'; ctx.lineWidth = Math.max(1.6, rr * 0.09); ctx.beginPath(); ctx.arc(x, y, rr * 0.9, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(x - rr * 0.32, y - rr * 0.4, rr * 0.3, rr * 0.16, -0.6, 0, TAU); ctx.fill();
  if (flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,240,200,${0.6 * flash})`; ctx.beginPath(); ctx.arc(x, y, rr * (1 + flash * 0.5), 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
  if (press) {
    ctx.strokeStyle = '#f6d98a'; ctx.lineWidth = Math.max(3, rr * 0.2); ctx.beginPath(); ctx.arc(x, y, rr * 1.16, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffe9a8'; ctx.font = `800 ${rr * 0.95}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(80,12,6,0.9)'; const lab = press === 1 ? '½' : '1';
    ctx.strokeText(lab, x, y + rr * 0.04); ctx.fillText(lab, x, y + rr * 0.04);
  }
  ctx.restore();
}
export function drawTarget(ctx, x, y, r, flash = 0, glow = 0) {
  ctx.save();
  ctx.strokeStyle = `rgba(255,236,200,${0.26 + 0.5 * glow})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, TAU); ctx.stroke();
  ctx.fillStyle = `rgba(255,236,200,${0.05 + 0.1 * glow})`; ctx.fill();
  if (flash > 0) { ctx.strokeStyle = `rgba(255,220,150,${flash})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * (1.12 + (1 - flash) * 1.2), 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// The teacher's fingertip with its pick (tsume), coming from the player's end. dir = unit vector pointing away from the player (towards the far end).
export function drawFinger(ctx, x, y, dir, down = 0, glow = 0, scale = 1) {
  ctx.save(); const r = 21 * scale, back = { x: -dir.x, y: -dir.y }, dx = back.x * (r * 0.6 + down * 4), dy = back.y * (r * 0.6 + down * 4);
  ctx.translate(x + dx, y + dy);
  const len = 150 * scale, g = ctx.createLinearGradient(0, 0, back.x * len, back.y * len); g.addColorStop(0, 'rgba(236,190,150,0.95)'); g.addColorStop(1, 'rgba(236,190,150,0)');
  ctx.strokeStyle = g; ctx.lineWidth = r * 1.9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(back.x * len, back.y * len); ctx.stroke();
  const tg = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r); tg.addColorStop(0, '#fbe0c4'); tg.addColorStop(1, '#d99d72');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,40,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  // the pick (tsume): an ivory ring round the fingertip with a slim pointed blade reaching past it along the string
  const nx = -dir.y, ny = dir.x, tipx = dir.x * r * 2.2, tipy = dir.y * r * 2.2;
  ctx.strokeStyle = '#fff8e6'; ctx.lineWidth = r * 0.42; ctx.beginPath(); ctx.moveTo(nx * r * 0.92 + dir.x * r * 0.35, ny * r * 0.92 + dir.y * r * 0.35); ctx.lineTo(-nx * r * 0.92 + dir.x * r * 0.35, -ny * r * 0.92 + dir.y * r * 0.35); ctx.stroke();
  ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = 'rgba(120,100,60,0.75)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(nx * r * 0.34 + dir.x * r * 0.7, ny * r * 0.34 + dir.y * r * 0.7); ctx.quadraticCurveTo(nx * r * 0.2 + dir.x * r * 1.6, ny * r * 0.2 + dir.y * r * 1.6, tipx, tipy);
  ctx.quadraticCurveTo(-nx * r * 0.2 + dir.x * r * 1.6, -ny * r * 0.2 + dir.y * r * 1.6, -nx * r * 0.34 + dir.x * r * 0.7, -ny * r * 0.34 + dir.y * r * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
  const px = tipx, py = tipy;
  if (glow > 0) { ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(px, py, 1, px, py, r * 2.2); gg.addColorStop(0, `rgba(255,230,160,${0.8 * glow})`); gg.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(px, py, r * 2.2, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// A touch ring while a finger is on the instrument.
export function drawTouch(ctx, x, y, r, press) {
  ctx.save(); ctx.strokeStyle = press ? 'rgba(255,214,120,0.9)' : 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = press ? 'rgba(255,214,120,0.22)' : 'rgba(255,255,255,0.14)'; ctx.fill(); ctx.restore();
}

// "Ma": a rest. A pale band across the strings with the character for ma.
export function drawMaBand(ctx, inst, u0, u1, a, active) {
  const A = inst.pt(u0, -0.5), B = inst.pt(u1, NSTR - 0.5), x = Math.min(A.x, B.x), y = Math.min(A.y, B.y), w = Math.abs(B.x - A.x), h = Math.abs(B.y - A.y);
  ctx.save(); ctx.globalAlpha = a;
  const g = inst.vert ? ctx.createLinearGradient(0, y, 0, y + h) : ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(190,225,255,0.05)'); g.addColorStop(0.5, `rgba(190,225,255,${active ? 0.3 : 0.17})`); g.addColorStop(1, 'rgba(190,225,255,0.05)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = `rgba(200,230,255,${active ? 0.55 : 0.3})`; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.setLineDash([]);
  ctx.fillStyle = `rgba(230,244,255,${active ? 0.95 : 0.6})`; ctx.font = `700 ${clamp(Math.min(w, h) * 0.5, 22, 74)}px ${MINCHO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('間', x + w / 2, y + h / 2); ctx.restore();
}

// ---- pops, particles ----------------------------------------------------------------------------------------------------------------------------------
export function drawPopup(ctx, p) {
  const k = clamp01(p.age / 0.8), a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, up = (k * k * (3 - 2 * k)) * 46;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sz = p.size * (1 + 0.25 * (1 - Math.min(1, p.age / 0.12)));
  ctx.font = `700 ${sz}px ${DISPLAY}`; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, sz * 0.2); ctx.strokeStyle = 'rgba(10,6,24,0.9)';
  const x = p.x - (p.dx ?? 0) * up, y = p.y - (p.dy ?? 1) * up;
  ctx.strokeText(p.text, x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, x, y);
  ctx.restore();
}
export function drawParticles(ctx, list) {
  ctx.save();
  for (const p of list) {
    const k = clamp01(p.life / p.max);
    if (p.petal) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, k * 2) * 0.9;
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-p.size * 0.2, -p.size * 0.1, p.size * 0.5, p.size * 0.18, 0, 0, TAU); ctx.fill();
      ctx.restore();
    } else {
      ctx.globalCompositeOperation = 'lighter'; const r = p.size * (0.4 + 0.6 * k), g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
      g.addColorStop(0, `rgba(${p.c},${0.9 * k})`); g.addColorStop(1, `rgba(${p.c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.2, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
}
export function stepParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt; if (p.life <= 0) { list.splice(i, 1); continue; }
    if (p.petal) { p.vx += Math.sin(p.life * 3 + p.rot) * 30 * dt; p.vy += (p.g ?? 30) * dt; p.vx *= 1 - 0.8 * dt; p.vy *= 1 - 0.8 * dt; p.rot += p.spin * dt; }
    else { p.vx *= 1 - 1.6 * dt; p.vy *= 1 - 1.6 * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
// A pluck: sparks of gold and a few cherry petals that drift away from the string.
export function burst(list, rng, x, y, n, power = 1, nrm = { x: 1, y: 0 }) {
  for (let i = 0; i < n; i++) {
    const sgn = rng.chance(0.5) ? 1 : -1, sp = rng.range(40, 190) * power, jit = rng.range(-0.5, 0.5);
    const vx = nrm.x * sgn * sp + jit * 60, vy = nrm.y * sgn * sp + jit * 60 - 20;
    if (i % 3 === 0) list.push({ x, y, vx, vy, life: rng.range(1, 1.8), max: 1.8, size: rng.range(6, 10), c: PAL.sakura, petal: true, rot: rng.range(0, 6), spin: rng.range(-3, 3), g: 40 });
    else list.push({ x, y, vx, vy, life: rng.range(0.3, 0.7), max: 0.7, size: rng.range(3, 6), c: '255,226,160' });
  }
  while (list.length > 220) list.shift();
}

export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.15) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * gap * 1.2;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? size * 0.22 : size * 0.5; k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    if (i < n) { const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5); g.addColorStop(0, '#fff2b0'); g.addColorStop(1, '#e0a62e'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#7a5410'; ctx.lineWidth = 1.5; ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,240,210,0.3)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.restore();
  }
}

// A little koto lying on the mats (title hero, figures). r = the rectangle it fills; strings are drawn straight, bridges follow `bu`.
export function drawMiniKoto(ctx, r, bu, o = {}) {
  const inst = makeInst(r, !!o.vert);
  drawBody(ctx, inst, 1);
  const ss = o.ss ?? [];
  drawStrings(ctx, inst, ss, bu, { focus: o.focus });
  drawBridges(ctx, inst, bu, { hot: o.hot });
  if (o.labels) drawLabels(ctx, inst, clamp(inst.sp * 0.85, 9, 22), o.focus, false);
  return inst;
}
export { lerp };
