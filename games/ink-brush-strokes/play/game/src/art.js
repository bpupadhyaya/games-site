// Drawing helpers: palette, backdrop, xuan paper, mounting, seals, the brush and the ink stone. Pure canvas.
import { hash } from './brush.js';

export const PAL = {
  ink: '#0e1114', night: '#12181b', teal: '#1d2e30', tealHi: '#2f4a4b', jade: '#58c2a3', cinnabar: '#c8412f', cinnabarHi: '#ef6a52',
  gold: '#ecd08a', goldDeep: '#b78f3c', paper: '#efe5cc', paperDark: '#d6c7a0', text: '#f4ecd8', dim: 'rgba(244,236,216,0.64)', bamboo: '#b99a52',
};
export const DISPLAY = '"Cormorant Garamond", "Songti SC", "Noto Serif CJK SC", Georgia, serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Noto Sans CJK SC", sans-serif';
export const CJK = '"Songti SC", "STSong", "Noto Serif CJK SC", "Noto Serif SC", "Source Han Serif SC", "SimSun", serif';
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let fallbackCanvas = null;
export const setCanvasFactory = (f) => { fallbackCanvas = f; };
export const mk = (w, h) => {
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
  if (typeof OffscreenCanvas !== 'undefined') { try { return new OffscreenCanvas(W, H); } catch { /* fall through */ } }
  return fallbackCanvas ? fallbackCanvas(W, H) : null;      // older iOS Safari has no OffscreenCanvas: main.js supplies a DOM canvas factory
};

// ---- backdrop: lacquer desk with misty mountains --------------------------------------------------------------------------------------------
let bgKey = '', bgImg = null;
export function drawBackdrop(ctx, w, h, t, calm) {
  const key = `${Math.round(w)}x${Math.round(h)}`;
  if (key !== bgKey) {
    bgKey = key; bgImg = mk(w, h);
    if (bgImg) {
      const g = bgImg.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#101619'); gr.addColorStop(0.55, '#1b2a2c'); gr.addColorStop(1, '#0d1214');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let layer = 0; layer < 3; layer++) {                      // far to near ridges
        const base = h * (0.42 + layer * 0.13), amp = h * (0.07 + layer * 0.02);
        g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w + 20; x += 14) {
          const n = Math.sin(x * 0.006 + layer * 2.1) * 0.55 + Math.sin(x * 0.017 + layer * 5.3) * 0.28 + Math.sin(x * 0.041 + layer) * 0.1;
          g.lineTo(x, base - Math.abs(n) * amp * 1.4 - amp * 0.3);
        }
        g.lineTo(w + 20, h); g.closePath();
        const fg = g.createLinearGradient(0, base - amp * 2, 0, h);
        fg.addColorStop(0, `rgba(70,102,104,${0.22 + layer * 0.1})`); fg.addColorStop(1, 'rgba(16,26,28,0.9)');
        g.fillStyle = fg; g.fill();
      }
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
      g.fillStyle = vg; g.fillRect(0, 0, w, h);
    }
  }
  if (bgImg) ctx.drawImage(bgImg, 0, 0); else { ctx.fillStyle = '#131c1f'; ctx.fillRect(0, 0, w, h); }
  if (!calm) {                                                       // slow drifting mist
    for (let i = 0; i < 3; i++) {
      const cx = ((t * (6 + i * 3) + i * w * 0.4) % (w * 1.6)) - w * 0.3, cy = h * (0.46 + i * 0.12), rx = w * (0.55 + i * 0.1), ry = h * 0.05;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, 'rgba(190,215,210,0.07)'); g.addColorStop(1, 'rgba(190,215,210,0)');
      ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
    }
  }
}

// ---- xuan paper ------------------------------------------------------------------------------------------------------------------------------------
const paperCache = new Map();
export function paperImage(pw, ph, res, seed = 1) {
  const key = `${pw}x${ph}@${res}#${seed}`;
  if (paperCache.has(key)) return paperCache.get(key);
  const c = mk(pw * res, ph * res);
  if (c) {
    const g = c.getContext('2d'); g.scale(res, res);
    const gr = g.createLinearGradient(0, 0, pw, ph); gr.addColorStop(0, '#f3ead3'); gr.addColorStop(1, '#e8dcc0');
    g.fillStyle = gr; g.fillRect(0, 0, pw, ph);
    for (let i = 0; i < Math.round((pw * ph) / 9000); i++) {                    // soft mottling
      const x = hash(i, 1, seed) * pw, y = hash(i, 2, seed) * ph, r = 30 + hash(i, 3, seed) * 90, dark = hash(i, 4, seed) < 0.55;
      const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, dark ? 'rgba(150,120,70,0.07)' : 'rgba(255,252,240,0.14)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.lineCap = 'round';
    for (let i = 0; i < Math.round((pw * ph) / 130); i++) {                      // fibres
      const x = hash(i, 5, seed) * pw, y = hash(i, 6, seed) * ph, a = hash(i, 7, seed) * TAU, l = 5 + hash(i, 8, seed) * 18, light = hash(i, 9, seed) < 0.5;
      g.strokeStyle = light ? `rgba(255,252,238,${0.18 + hash(i, 10, seed) * 0.25})` : `rgba(140,110,70,${0.05 + hash(i, 10, seed) * 0.09})`;
      g.lineWidth = 0.5 + hash(i, 11, seed) * 0.6;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (hash(i, 12, seed) - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (hash(i, 13, seed) - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    const eg = g.createRadialGradient(pw / 2, ph / 2, Math.min(pw, ph) * 0.45, pw / 2, ph / 2, Math.hypot(pw, ph) * 0.52);
    eg.addColorStop(0, 'rgba(120,90,40,0)'); eg.addColorStop(1, 'rgba(120,90,40,0.2)');
    g.fillStyle = eg; g.fillRect(0, 0, pw, ph);
  }
  if (paperCache.size > 6) paperCache.clear();
  paperCache.set(key, c);
  return c;
}

// A mounted painting: shadow, silk border, gold line, then the paper image is drawn by the caller inside `r`.
export function drawMount(ctx, r, pad = 14) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 8;
  const o = { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
  const g = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h); g.addColorStop(0, '#3a5a58'); g.addColorStop(0.5, '#2a4543'); g.addColorStop(1, '#223936');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(o.x, o.y, o.w, o.h, 6); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(236,208,138,0.55)'; ctx.lineWidth = 1.5; ctx.strokeRect(o.x + pad * 0.45, o.y + pad * 0.45, o.w - pad * 0.9, o.h - pad * 0.9);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
}

// ---- seals ------------------------------------------------------------------------------------------------------------------------------------------------
const sealCache = new Map();
function sealDesign(g, id, s) {
  g.globalCompositeOperation = 'destination-out'; g.lineCap = 'round'; g.lineJoin = 'round'; g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineWidth = s * 0.07;
  const u = (v) => v * s;
  if (id === 'mountain') { g.beginPath(); g.moveTo(u(0.14), u(0.78)); g.lineTo(u(0.36), u(0.34)); g.lineTo(u(0.5), u(0.58)); g.lineTo(u(0.64), u(0.24)); g.lineTo(u(0.86), u(0.78)); g.stroke(); g.beginPath(); g.moveTo(u(0.2), u(0.86)); g.lineTo(u(0.8), u(0.86)); g.stroke(); }
  else if (id === 'bamboo') { for (const x of [0.34, 0.5, 0.66]) { g.beginPath(); g.moveTo(u(x), u(0.14)); g.lineTo(u(x), u(0.86)); g.stroke(); for (const y of [0.34, 0.6]) { g.beginPath(); g.moveTo(u(x - 0.07), u(y)); g.lineTo(u(x + 0.07), u(y)); g.stroke(); } } }
  else if (id === 'moon') { g.beginPath(); g.arc(u(0.5), u(0.5), u(0.3), 0, TAU); g.stroke(); g.beginPath(); g.arc(u(0.58), u(0.46), u(0.2), 0, TAU); g.fill(); }
  else if (id === 'plum') { for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - 1.57; g.beginPath(); g.arc(u(0.5 + Math.cos(a) * 0.23), u(0.5 + Math.sin(a) * 0.23), u(0.12), 0, TAU); g.fill(); } }
  else if (id === 'cloud') { g.beginPath(); g.arc(u(0.34), u(0.56), u(0.14), Math.PI * 0.4, Math.PI * 1.9); g.arc(u(0.5), u(0.4), u(0.14), Math.PI, TAU + 0.5); g.arc(u(0.68), u(0.56), u(0.14), -1.6, Math.PI * 0.6); g.stroke(); g.beginPath(); g.moveTo(u(0.22), u(0.76)); g.lineTo(u(0.78), u(0.76)); g.stroke(); }
  else { g.strokeRect(u(0.22), u(0.22), u(0.56), u(0.56)); g.strokeRect(u(0.38), u(0.38), u(0.24), u(0.24)); g.beginPath(); g.arc(u(0.5), u(0.5), u(0.04), 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-over';
}
// Paint a seal into a canvas context (transparent where carved away). The caller composites with multiply.
export function paintSeal(g, id, x, y, size, rot = 0, seedv = 3, res = 1) {
  const px = Math.max(8, Math.round(size * res)), key = `${id}|${px}|${seedv}`;
  let img = sealCache.get(key);
  if (img === undefined) {
    img = mk(px, px);
    if (img) {
      const s = img.getContext('2d');
      s.fillStyle = '#c23b2a'; s.beginPath();
      const N = 28;
      for (let i = 0; i < N; i++) {                                   // slightly worn square outline
        const f = i / N, side = Math.floor(f * 4), t = (f * 4) % 1, a = [[0, 0], [1, 0], [1, 1], [0, 1]][side], b = [[1, 0], [1, 1], [0, 1], [0, 0]][side];
        const j = (hash(i, seedv, 5) - 0.5) * 0.025, X = (a[0] + (b[0] - a[0]) * t) * 0.94 + 0.03 + j, Y = (a[1] + (b[1] - a[1]) * t) * 0.94 + 0.03 + j;
        i ? s.lineTo(X * px, Y * px) : s.moveTo(X * px, Y * px);
      }
      s.closePath(); s.fill();
      sealDesign(s, id, px);
      s.globalCompositeOperation = 'destination-out';                  // age: tiny specks
      for (let i = 0; i < px * 0.9; i++) { s.globalAlpha = 0.35 + hash(i, 1, seedv) * 0.5; s.beginPath(); s.arc(hash(i, 2, seedv) * px, hash(i, 3, seedv) * px, 0.4 + hash(i, 4, seedv) * px * 0.012, 0, TAU); s.fill(); }
      s.globalAlpha = 1; s.globalCompositeOperation = 'source-over';
    }
    if (sealCache.size > 60) sealCache.clear();
    sealCache.set(key, img);
  }
  if (!img) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(img, -size / 2, -size / 2, size, size); g.restore();
}

// ---- the brush (cursor) ------------------------------------------------------------------------------------------------------------------------------
// Tip at (x, y); handle rises to the upper right. `tone` 0..1 colours the bristles, `load` 0..1 their fullness.
export function drawBrush(ctx, x, y, s, load, tone, down) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.38); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const L = s * 6.2, tipL = s * 1.05, wBody = s * 0.34;
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 6;
  const hg = ctx.createLinearGradient(-wBody, 0, wBody, 0); hg.addColorStop(0, '#6e5524'); hg.addColorStop(0.35, '#d8bd7a'); hg.addColorStop(1, '#8a6c2e');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(-wBody * 0.55, -tipL - s * 0.5); ctx.lineTo(wBody * 0.7, -tipL - s * 0.5); ctx.lineTo(wBody * 0.45, -tipL - L); ctx.lineTo(-wBody * 0.4, -tipL - L); ctx.closePath(); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#c9ad63'; ctx.fillRect(-wBody * 0.72, -tipL - s * 0.78, wBody * 1.5, s * 0.28);                 // ferrule
  const dark = Math.round(12 + (1 - tone) * 90), hair = `rgb(${dark},${dark + 2},${dark + 6})`;
  ctx.fillStyle = load > 0.02 ? hair : '#6a5a45';
  ctx.beginPath(); ctx.moveTo(-wBody * 0.72, -tipL - s * 0.5); ctx.quadraticCurveTo(-wBody * 1.05, -tipL * 0.4, 0, down ? 0 : s * 0.06); ctx.quadraticCurveTo(wBody * 1.05, -tipL * 0.4, wBody * 0.72, -tipL - s * 0.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(-wBody * 0.22, -tipL * 0.78, wBody * 0.12, tipL * 0.34, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- ink stone (grind screen) ---------------------------------------------------------------------------------------------------------------------------
export function drawStone(ctx, st, density, grindT, stickPos) {
  const { x, y, rx, ry } = st;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
  const body = ctx.createLinearGradient(0, y - ry * 1.2, 0, y + ry * 1.4); body.addColorStop(0, '#4a5154'); body.addColorStop(1, '#1c2123');
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(x, y + ry * 0.14, rx * 1.12, ry * 1.18, 0, 0, TAU); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#2a3033'; ctx.beginPath(); ctx.ellipse(x, y, rx * 1.02, ry * 1.04, 0, 0, TAU); ctx.fill();
  const wet = ctx.createRadialGradient(x - rx * 0.2, y - ry * 0.2, 0, x, y, rx);                   // the ink pool darkens with density
  const c = Math.round(60 - density * 52);
  wet.addColorStop(0, `rgb(${c},${c + 4},${c + 8})`); wet.addColorStop(1, `rgb(${c + 14},${c + 18},${c + 22})`);
  ctx.fillStyle = wet; ctx.beginPath(); ctx.ellipse(x, y + ry * 0.04, rx * 0.8, ry * 0.8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.ellipse(x - rx * 0.28, y - ry * 0.34, rx * 0.34, ry * 0.12, -0.2, 0, TAU); ctx.fill();
  if (stickPos) {                                                                                  // the ink stick
    ctx.save(); ctx.translate(stickPos.x, stickPos.y); ctx.rotate(-0.25);
    const sw = rx * 0.2, sl = rx * 0.9;
    const sg = ctx.createLinearGradient(-sw, 0, sw, 0); sg.addColorStop(0, '#0b0c0e'); sg.addColorStop(0.5, '#2b2d33'); sg.addColorStop(1, '#0b0c0e');
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 8;
    ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(-sw / 2, -sl, sw, sl, 4); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.fillStyle = PAL.gold; ctx.fillRect(-sw / 2 + 3, -sl + sl * 0.18, sw - 6, 3); ctx.fillRect(-sw / 2 + 3, -sl + sl * 0.3, sw - 6, 2);
    ctx.restore();
  }
  ctx.restore();
}

// ---- stars ----------------------------------------------------------------------------------------------------------------------------------------------------
export function drawStar(ctx, x, y, r, fill, glow = 0) {
  ctx.save();
  if (glow) { ctx.shadowColor = 'rgba(236,208,138,0.8)'; ctx.shadowBlur = r * glow; }
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.46 : r; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
  ctx.fillStyle = fill ? PAL.gold : 'rgba(244,236,216,0.14)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = fill ? PAL.goldDeep : 'rgba(244,236,216,0.28)'; ctx.stroke();
  ctx.restore();
}
export { clamp };
