// Morra: all painting that is not interface. An osteria table seen from above at dusk: gingham cloth, a warm lamp pool, a carafe,
// tumblers and olives; two lit, shaded vector hands with nails, creases, sleeves and rings. Pure canvas 2D, no DOM, no clock:
// every function depends only on its arguments.
export const PAL = {
  ink: '#140d1c', night: '#231730', wine: '#7a1f35', wineHi: '#b8374d', cloth: '#b5352b', cream: '#f6e8c8', chalk: '#fff4de',
  wood: '#5a3418', woodDark: '#2c180c', lamp: '#ffd27a', gold: '#ffd36a', goldDark: '#9a6a12', basil: '#6fae5a', basilDark: '#2f5a28',
  olive: '#8a9a3a', text: '#fff4de', dim: 'rgba(255,244,222,0.66)', teal: '#3cb8a6', rose: '#ff7a68',
};
export const DISPLAY = '"Dela Gothic One", Impact, "Arial Black", system-ui, sans-serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const TAU = Math.PI * 2;
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOutBack = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

// ---- the table (cached; the heavy static background) ------------------------------------------------------------------------------------------
const caches = new Map();
function cached(key, w, h, paint) {
  if (typeof OffscreenCanvas !== 'function') return null;
  let c = caches.get(key);
  if (c === undefined) {
    if (caches.size > 4) caches.clear();
    try { c = new OffscreenCanvas(Math.max(2, Math.round(w)), Math.max(2, Math.round(h))); paint(c.getContext('2d'), w, h); } catch { c = null; }
    caches.set(key, c);
  }
  return c;
}

function paintTable(g, w, h) {
  const u = Math.min(w, h);
  // wood under the cloth
  const wd = g.createLinearGradient(0, 0, w, h);
  wd.addColorStop(0, '#3a2210'); wd.addColorStop(0.5, '#5a3418'); wd.addColorStop(1, '#2c180c');
  g.fillStyle = wd; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2;
  for (let x = u * 0.05; x < w; x += u * 0.11) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + u * 0.02, h); g.stroke(); }
  // the gingham cloth, a little inset and rounded
  const m = u * 0.035, cx = m, cy = m, cw = w - m * 2, ch = h - m * 2, rad = u * 0.04;
  g.save(); g.beginPath(); g.roundRect(cx, cy, cw, ch, rad); g.clip();
  g.fillStyle = '#f2e2bd'; g.fillRect(cx, cy, cw, ch);
  const c = u / 9;
  g.fillStyle = 'rgba(181,53,43,0.46)';
  for (let x = cx - c; x < cx + cw + c; x += c * 2) g.fillRect(x, cy, c, ch);
  for (let y = cy - c; y < cy + ch + c; y += c * 2) g.fillRect(cx, y, cw, c);
  // soft folds
  for (let i = 0; i < 6; i++) {
    const fx = cx + cw * (0.1 + i * 0.16), gr = g.createLinearGradient(fx - u * 0.05, 0, fx + u * 0.05, 0);
    gr.addColorStop(0, 'rgba(60,20,10,0)'); gr.addColorStop(0.5, i % 2 ? 'rgba(60,20,10,0.1)' : 'rgba(255,240,210,0.1)'); gr.addColorStop(1, 'rgba(60,20,10,0)');
    g.fillStyle = gr; g.fillRect(fx - u * 0.05, cy, u * 0.1, ch);
  }
  // the lamp pool and the dusk vignette
  const lamp = g.createRadialGradient(w * 0.5, h * 0.5, u * 0.05, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
  lamp.addColorStop(0, 'rgba(255,214,140,0.35)'); lamp.addColorStop(0.45, 'rgba(255,170,90,0.06)'); lamp.addColorStop(1, 'rgba(18,8,26,0.78)');
  g.fillStyle = lamp; g.fillRect(cx, cy, cw, ch);
  g.restore();
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,230,190,0.25)'; g.beginPath(); g.roundRect(cx, cy, cw, ch, rad); g.stroke();
  // things on the table: carafe, tumblers, olives, bread (corners, never under the hands)
  carafe(g, w * 0.12, h * 0.1, u * 0.075);
  tumbler(g, w * 0.88, h * 0.9, u * 0.05);
  tumbler(g, w * 0.82, h * 0.94, u * 0.036);
  olives(g, w * 0.88, h * 0.12, u * 0.07);
  bread(g, w * 0.12, h * 0.9, u * 0.085);
}

function carafe(g, x, y, r) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(r * 0.18, r * 0.2, r * 1.05, r * 1.05, 0, 0, TAU); g.fill();
  const gl = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  gl.addColorStop(0, 'rgba(255,255,255,0.55)'); gl.addColorStop(0.25, 'rgba(150,40,60,0.9)'); gl.addColorStop(1, 'rgba(60,8,24,0.95)');
  g.fillStyle = gl; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,230,240,0.55)'; g.lineWidth = Math.max(1.5, r * 0.07); g.beginPath(); g.arc(0, 0, r * 0.62, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(-r * 0.38, -r * 0.42, r * 0.2, r * 0.1, -0.7, 0, TAU); g.fill();
  g.restore();
}
function tumbler(g, x, y, r) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.arc(r * 0.2, r * 0.22, r, 0, TAU); g.fill();
  const gl = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  gl.addColorStop(0, 'rgba(255,255,255,0.7)'); gl.addColorStop(0.5, 'rgba(255,225,170,0.55)'); gl.addColorStop(1, 'rgba(200,120,60,0.55)');
  g.fillStyle = gl; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,250,235,0.7)'; g.lineWidth = Math.max(1.5, r * 0.09); g.beginPath(); g.arc(0, 0, r * 0.82, 0, TAU); g.stroke();
  g.restore();
}
function olives(g, x, y, r) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.arc(r * 0.15, r * 0.2, r, 0, TAU); g.fill();
  const pl = g.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
  pl.addColorStop(0, '#fff8e8'); pl.addColorStop(1, '#cdbf9c');
  g.fillStyle = pl; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  const pts = [[-0.3, -0.1], [0.12, -0.3], [0.32, 0.1], [-0.05, 0.25], [-0.34, 0.28]];
  for (const [px, py] of pts) {
    const og = g.createRadialGradient(px * r - r * 0.05, py * r - r * 0.05, 0.5, px * r, py * r, r * 0.2);
    og.addColorStop(0, '#c9d870'); og.addColorStop(1, '#4e5e1a');
    g.fillStyle = og; g.beginPath(); g.ellipse(px * r, py * r, r * 0.2, r * 0.15, 0.5, 0, TAU); g.fill();
  }
  g.restore();
}
function bread(g, x, y, r) {
  g.save(); g.translate(x, y); g.rotate(-0.45);
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(r * 0.1, r * 0.2, r * 1.1, r * 0.5, 0, 0, TAU); g.fill();
  const gr = g.createLinearGradient(0, -r * 0.4, 0, r * 0.4);
  gr.addColorStop(0, '#f0c070'); gr.addColorStop(0.6, '#c9843a'); gr.addColorStop(1, '#8a4f1c');
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r * 1.05, r * 0.42, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,230,170,0.75)'; g.lineWidth = Math.max(2, r * 0.08); g.lineCap = 'round';
  for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(k * r - r * 0.12, -r * 0.2); g.lineTo(k * r + r * 0.12, r * 0.2); g.stroke(); }
  g.restore();
}

let tableImgs = { p: null, l: null };
export function setTableImage(key, img) { tableImgs[key] = img; caches.clear(); }
// The lit 3D tablecloth (rendered offline): cover-fit the portrait or landscape picture, then a warm lamp pool and dusk vignette.
function paintTable3D(g, w, h) {
  const img = w >= h ? tableImgs.l : tableImgs.p;
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k;
  g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
  const u = Math.min(w, h);
  const lamp = g.createRadialGradient(w * 0.5, h * 0.5, u * 0.08, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  lamp.addColorStop(0, 'rgba(255,214,140,0.16)'); lamp.addColorStop(0.5, 'rgba(255,170,90,0)'); lamp.addColorStop(1, 'rgba(18,8,26,0.62)');
  g.fillStyle = lamp; g.fillRect(0, 0, w, h);
}
export function drawTable(ctx, w, h, x = 0, y = 0) {
  const ti = w >= h ? tableImgs.l : tableImgs.p;
  if (ti && ti.naturalWidth) {
    const c3 = cached(`3d${Math.round(w)}x${Math.round(h)}`, w, h, paintTable3D);
    if (c3) { ctx.drawImage(c3, x, y, w, h); return; }
  }
  const c = cached(`t${Math.round(w)}x${Math.round(h)}`, w, h, paintTable);
  if (c) ctx.drawImage(c, x, y, w, h);
  else { ctx.fillStyle = '#7a3a22'; ctx.fillRect(x, y, w, h); }
}

// The wooden rail of the table that the interface sits on. `edge` is the side that faces the cloth: 'bottom' for a rail across the top of
// the screen, 'top' for one across the bottom, 'left' for a column on the right.
export function drawRail(ctx, r, edge) {
  ctx.save();
  const horiz = edge === 'top' || edge === 'bottom';
  const lin = horiz ? ctx.createLinearGradient(0, r.y, 0, r.y + r.h) : ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
  const face = edge === 'bottom' || edge === 'right' ? 1 : 0;
  lin.addColorStop(face, '#5a3418'); lin.addColorStop(Math.abs(face - 0.35), '#3a2010'); lin.addColorStop(1 - face, '#1c0e08');
  ctx.fillStyle = lin; ctx.fillRect(r.x, r.y, r.w, r.h);
  // grain
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2;
  if (horiz) { for (let y = r.y + 10; y < r.y + r.h; y += 11) { ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y + 3); ctx.stroke(); } }
  else { for (let x = r.x + 10; x < r.x + r.w; x += 11) { ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x + 3, r.y + r.h); ctx.stroke(); } }
  // lit edge and the shadow it throws on the cloth
  const ex = edge === 'left' ? r.x : edge === 'right' ? r.x + r.w : 0, ey = edge === 'top' ? r.y : edge === 'bottom' ? r.y + r.h : 0;
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,205,140,0.55)';
  ctx.beginPath();
  if (horiz) { ctx.moveTo(r.x, ey); ctx.lineTo(r.x + r.w, ey); } else { ctx.moveTo(ex, r.y); ctx.lineTo(ex, r.y + r.h); }
  ctx.stroke();
  const sh = 26;
  let g2;
  if (edge === 'bottom') { g2 = ctx.createLinearGradient(0, ey, 0, ey + sh); ctx.fillStyle = g2; g2.addColorStop(0, 'rgba(0,0,0,0.45)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillRect(r.x, ey, r.w, sh); }
  else if (edge === 'top') { g2 = ctx.createLinearGradient(0, ey, 0, ey - sh); ctx.fillStyle = g2; g2.addColorStop(0, 'rgba(0,0,0,0.45)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillRect(r.x, ey - sh, r.w, sh); }
  else if (edge === 'left') { g2 = ctx.createLinearGradient(ex, 0, ex - sh, 0); ctx.fillStyle = g2; g2.addColorStop(0, 'rgba(0,0,0,0.45)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillRect(ex - sh, r.y, sh, r.h); }
  ctx.restore();
}

// A warm glow that breathes behind the title and the hands (cheap: one radial gradient).
export function drawGlow(ctx, x, y, r, a = 0.25) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,205,120,${a})`); g.addColorStop(1, 'rgba(255,205,120,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ---- hands --------------------------------------------------------------------------------------------------------------------------------------
// Skin tones, light to deep: hi / mid / lo are the gradient across a finger, line the outline, nail the nail bed.
export const SKINS = [
  { hi: '#fbdcc0', mid: '#eebb92', lo: '#c98a64', line: '#8d5538', nail: '#f9e6da' },
  { hi: '#f1c79d', mid: '#dba076', lo: '#b67448', line: '#7c4526', nail: '#f3d9c6' },
  { hi: '#d9a679', mid: '#bf8458', lo: '#94593a', line: '#5f3320', nail: '#e6c5ab' },
  { hi: '#a8714a', mid: '#8a5636', lo: '#64391f', line: '#3f2212', nail: '#caa07f' },
];
export const SKIN_NAMES = ['Light', 'Warm', 'Olive', 'Deep'];

// Which fingers are out for a throw of n: [thumb, index, middle, ring, pinky].
export const FINGERS = [
  [0, 0, 0, 0, 0], [0, 1, 0, 0, 0], [0, 1, 1, 0, 0], [0, 1, 1, 1, 0], [0, 1, 1, 1, 1], [1, 1, 1, 1, 1],
];
// Per-finger extension 0..1 for a throw n at progress k (0 fist .. 1 open); fingers spring out one after another with a little overshoot.
export function extFor(n, k) {
  const set = FINGERS[clamp(n | 0, 0, 5)], order = [1, 2, 3, 4, 0], out = [0, 0, 0, 0, 0];
  let r = 0;
  for (const i of order) {
    if (!set[i]) continue;
    const kk = clamp((k - r * 0.09) / 0.55, 0, 1);
    out[i] = kk >= 1 ? 1 : kk <= 0 ? 0 : easeOutBack(kk);
    r += 1;
  }
  return out;
}

const FING = [   // index, middle, ring, pinky: base x, base y, full length, width
  { x: -0.285, y: -0.66, L: 0.62, w: 0.2 }, { x: -0.095, y: -0.7, L: 0.7, w: 0.205 }, { x: 0.095, y: -0.67, L: 0.62, w: 0.2 }, { x: 0.275, y: -0.6, L: 0.48, w: 0.18 },
];

function capsule(g, x, y, w, len) {   // from base (x, y) upwards `len`, width w, rounded ends; extends a little below the base so it sits in the palm
  g.beginPath(); g.roundRect(x - w / 2, y - len, w, len + w * 0.7, w / 2);
}

function pass(g, o, shadow) {
  const sk = o.skin, ext = o.ext;
  const flat = (c) => { g.fillStyle = c; };
  const grad = (x0, x1) => {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, sk.hi); gr.addColorStop(0.55, sk.mid); gr.addColorStop(1, sk.lo);
    return gr;
  };
  g.lineJoin = 'round'; g.lineCap = 'round';
  const fill = (x0, x1) => { if (shadow) flat('#000'); else g.fillStyle = grad(x0, x1); g.fill(); };
  const edge = () => { if (shadow) return; g.lineWidth = 0.013; g.strokeStyle = sk.line; g.globalAlpha = 0.85; g.stroke(); g.globalAlpha = 1; };

  // sleeve and forearm (they run off the bottom of the screen)
  if (!o.spr) {
    g.beginPath(); g.moveTo(-0.33, 0.02); g.lineTo(0.33, 0.02); g.lineTo(0.42, 1.2); g.lineTo(-0.42, 1.2); g.closePath();
    fill(-0.4, 0.4); edge();
  }
  g.beginPath(); g.moveTo(-0.47, 0.34); g.lineTo(0.47, 0.34); g.lineTo(0.66, 3.4); g.lineTo(-0.66, 3.4); g.closePath();
  if (shadow) { flat('#000'); g.fill(); } else {
    const sg = g.createLinearGradient(-0.6, 0, 0.6, 0);
    sg.addColorStop(0, o.sleeve); sg.addColorStop(0.5, o.sleeve); sg.addColorStop(1, '#000');
    g.fillStyle = o.sleeve; g.fill();
    const sh = g.createLinearGradient(-0.6, 0, 0.6, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(0.45, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.38)');
    g.fillStyle = sh; g.fill();
    if (o.pattern === 'stripe') {
      g.save(); g.clip(); g.fillStyle = o.trim; g.globalAlpha = 0.9;
      for (let y = 0.7; y < 3.4; y += 0.3) g.fillRect(-0.7, y, 1.4, 0.07);
      g.restore();
    } else if (o.pattern === 'dots') {
      g.save(); g.clip(); g.fillStyle = o.trim; g.globalAlpha = 0.8;
      for (let y = 0.62, r = 0; y < 3.4; y += 0.24, r++) for (let x = -0.55 + (r % 2) * 0.1; x < 0.6; x += 0.2) { g.beginPath(); g.arc(x, y, 0.028, 0, TAU); g.fill(); }
      g.restore();
    }
    // cuff band
    g.beginPath(); g.moveTo(-0.47, 0.34); g.lineTo(0.47, 0.34); g.lineTo(0.485, 0.5); g.lineTo(-0.485, 0.5); g.closePath();
    g.fillStyle = o.trim; g.fill(); g.lineWidth = 0.01; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke();
    // bracelet / watch
    if (o.bracelet) {
      g.beginPath(); g.roundRect(-0.35, 0.1, 0.7, 0.1, 0.05); g.fillStyle = o.accent; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(-0.3, 0.12, 0.6, 0.02);
    }
    if (o.spr) {   // soft folds and a rounded cuff lip so the sleeve reads as cloth over a real arm
      g.save(); g.beginPath(); g.moveTo(-0.47, 0.5); g.lineTo(0.47, 0.5); g.lineTo(0.66, 3.4); g.lineTo(-0.66, 3.4); g.closePath(); g.clip();
      g.lineCap = 'round';
      for (const [fx, a] of [[-0.25, 0.14], [0.05, 0.1], [0.3, 0.16]]) {
        g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = 0.05; g.beginPath(); g.moveTo(fx, 0.55); g.quadraticCurveTo(fx + 0.08, 1.2, fx * 1.2, 2.2); g.stroke();
        g.strokeStyle = `rgba(255,255,255,${a * 0.7})`; g.lineWidth = 0.025; g.beginPath(); g.moveTo(fx - 0.05, 0.55); g.quadraticCurveTo(fx + 0.03, 1.2, fx * 1.2 - 0.05, 2.2); g.stroke();
      }
      const cs = g.createLinearGradient(0, 0.5, 0, 0.82); cs.addColorStop(0, 'rgba(0,0,0,0.35)'); cs.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = cs; g.fillRect(-0.7, 0.5, 1.4, 0.32);
      g.restore();
      const hl = g.createLinearGradient(-0.5, 0, 0.5, 0); hl.addColorStop(0, 'rgba(255,255,255,0.5)'); hl.addColorStop(0.5, 'rgba(255,255,255,0.05)'); hl.addColorStop(1, 'rgba(0,0,0,0.3)');
      g.fillStyle = hl; g.beginPath(); g.roundRect(-0.485, 0.34, 0.97, 0.16, 0.03); g.fill();
      return;
    }
  }
  if (o.spr) return;

  // ---- the back of a hand: palm, knuckles, tapered jointed fingers with nails, a thumb with a thenar mound ----
  const skinFill = (x0, x1) => {   // light from the upper left: bright just left of centre, falling away to the right edge
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, sk.mid); gr.addColorStop(0.28, sk.hi); gr.addColorStop(0.62, sk.mid); gr.addColorStop(1, sk.lo);
    return gr;
  };
  // palm / back of hand outline (wrist at the bottom, four knuckles along the top)
  const palmPath = () => {
    g.beginPath();
    g.moveTo(-0.33, 0.06);
    g.bezierCurveTo(-0.42, -0.18, -0.5, -0.42, -0.45, -0.66);
    g.bezierCurveTo(-0.4, -0.84, -0.3, -0.86, -0.2, -0.82);
    g.bezierCurveTo(-0.12, -0.9, -0.02, -0.92, 0.07, -0.86);
    g.bezierCurveTo(0.17, -0.9, 0.28, -0.86, 0.34, -0.78);
    g.bezierCurveTo(0.42, -0.74, 0.48, -0.62, 0.45, -0.5);
    g.bezierCurveTo(0.43, -0.3, 0.38, -0.12, 0.33, 0.06);
    g.closePath();
  };
  const drawPalm = () => {
  palmPath();
    if (shadow) { g.fillStyle = '#000'; g.fill(); } else {
      g.fillStyle = skinFill(-0.5, 0.48); g.fill();
      g.save(); palmPath(); g.clip();
      // form shading: broad light on the upper left, a warm shadow rolling off to the right and toward the wrist
      const lg = g.createRadialGradient(-0.18, -0.5, 0.04, -0.1, -0.35, 0.7);
      lg.addColorStop(0, 'rgba(255,248,235,0.38)'); lg.addColorStop(1, 'rgba(255,248,235,0)');
      g.fillStyle = lg; g.fillRect(-0.6, -1, 1.2, 1.2);
      const wg = g.createLinearGradient(0, -0.1, 0, 0.08);
      wg.addColorStop(0, 'rgba(120,50,30,0)'); wg.addColorStop(1, 'rgba(120,50,30,0.28)');
      g.fillStyle = wg; g.fillRect(-0.6, -0.1, 1.2, 0.2);
      // tendons running to the knuckles and two faint veins
      g.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const f = FING[i];
        g.strokeStyle = sk.line; g.globalAlpha = 0.16; g.lineWidth = 0.022;
        g.beginPath(); g.moveTo(f.x, f.y + 0.1); g.quadraticCurveTo(f.x * 0.8, -0.3, f.x * 0.35, -0.02); g.stroke();
        g.strokeStyle = '#fff'; g.globalAlpha = 0.12; g.lineWidth = 0.014;
        g.beginPath(); g.moveTo(f.x - 0.02, f.y + 0.1); g.quadraticCurveTo(f.x * 0.8 - 0.02, -0.3, f.x * 0.35 - 0.02, -0.02); g.stroke();
      }
      g.globalAlpha = 0.14; g.strokeStyle = '#5a6a9a'; g.lineWidth = 0.02;
      g.beginPath(); g.moveTo(0.22, -0.55); g.bezierCurveTo(0.16, -0.4, 0.12, -0.25, 0.08, -0.08); g.stroke();
      g.beginPath(); g.moveTo(-0.05, -0.6); g.bezierCurveTo(-0.08, -0.42, -0.04, -0.25, -0.06, -0.1); g.stroke();
      g.globalAlpha = 1;
      // knuckles: a soft lit bump with a crease under it
      for (let i = 0; i < 4; i++) {
        const f = FING[i], ky = f.y + 0.03;
        const kg = g.createRadialGradient(f.x - f.w * 0.15, ky - 0.02, 0.005, f.x, ky, f.w * 0.62);
        kg.addColorStop(0, 'rgba(255,248,235,0.4)'); kg.addColorStop(1, 'rgba(255,248,235,0)');
        g.fillStyle = kg; g.beginPath(); g.ellipse(f.x, ky, f.w * 0.62, f.w * 0.5, 0, 0, TAU); g.fill();
        g.strokeStyle = sk.line; g.globalAlpha = 0.28; g.lineWidth = 0.011;
        g.beginPath(); g.moveTo(f.x - f.w * 0.3, ky + 0.07); g.quadraticCurveTo(f.x, ky + 0.1, f.x + f.w * 0.3, ky + 0.07); g.stroke(); g.globalAlpha = 1;
      }
      g.restore();
      palmPath(); g.lineWidth = 0.012; g.strokeStyle = sk.line; g.globalAlpha = 0.5; g.lineJoin = 'round'; g.stroke(); g.globalAlpha = 1;
    }
  };

  // one finger (or thumb) in its own frame: base at (0,0), tip at (0,-len); jointed taper, knuckle swells, creases and a nail
  const digit = (w, len, e, o2) => {
    const N = 14, hwAt = (t) => (w / 2) * (1 - 0.2 * t + 0.045 * Math.exp(-Math.pow((t - 0.36) / 0.09, 2)) + 0.04 * Math.exp(-Math.pow((t - 0.7) / 0.09, 2)));
    const tipH = hwAt(1);
    const side = (open) => {
      g.beginPath();
      g.moveTo(-hwAt(0), w * 0.55); if (!open) g.lineTo(-hwAt(0), w * 0.55); else g.moveTo(-hwAt(0), 0);
      for (let i = 0; i <= N; i++) { const t = i / N; g.lineTo(-hwAt(t), -len * t); }
      for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI; g.lineTo(-Math.cos(a) * tipH, -len - Math.sin(a) * tipH * 0.95); }
      for (let i = N; i >= 0; i--) { const t = i / N; g.lineTo(hwAt(t), -len * t); }
      if (!open) { g.lineTo(hwAt(0), w * 0.55); g.closePath(); }
    };
    side(false);
    if (shadow) { g.fillStyle = '#000'; g.fill(); return; }
    g.fillStyle = skinFill(-w / 2, w / 2); g.fill();
    g.save(); g.clip();
    // rounded-form shading: a bright ridge left of centre, a warm core shadow on the right
    const rg = g.createLinearGradient(-w / 2, 0, w / 2, 0);
    rg.addColorStop(0, 'rgba(255,250,240,0)'); rg.addColorStop(0.3, 'rgba(255,250,240,0.32)'); rg.addColorStop(0.5, 'rgba(255,250,240,0)'); rg.addColorStop(0.82, 'rgba(110,40,25,0.16)'); rg.addColorStop(1, 'rgba(80,25,15,0.36)');
    g.fillStyle = rg; g.fillRect(-w, -len - w, w * 2, len + w * 2);
    // tip: flesh reads a touch warmer
    const tg = g.createLinearGradient(0, -len - tipH, 0, -len * 0.7);
    tg.addColorStop(0, 'rgba(200,90,70,0.18)'); tg.addColorStop(1, 'rgba(200,90,70,0)');
    g.fillStyle = tg; g.fillRect(-w, -len - w, w * 2, len * 0.4 + w);
    g.restore();
    side(true); g.lineWidth = 0.011; g.strokeStyle = sk.line; g.globalAlpha = 0.55; g.lineJoin = 'round'; g.stroke(); g.globalAlpha = 1;
    if (e < 0.08) {
      // curled finger: the folded second knuckle shows as a lit crest with creases
      g.strokeStyle = sk.line; g.globalAlpha = 0.5; g.lineWidth = 0.014;
      g.beginPath(); g.moveTo(-w * 0.34, -len + w * 0.28); g.quadraticCurveTo(0, -len + w * 0.42, w * 0.34, -len + w * 0.28); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,250,240,0.4)'; g.beginPath(); g.ellipse(-w * 0.14, -len + w * 0.02, w * 0.14, w * 0.09, -0.3, 0, TAU); g.fill();
      return;
    }
    // joint creases (two short wrinkles each) with a faint highlight above the lower one
    g.strokeStyle = sk.line; g.lineCap = 'round';
    for (const [t, n] of [[0.36, 3], [0.7, 2]]) {
      const cy = -len * t;
      for (let k = 0; k < n; k++) {
        const yy = cy + (k - (n - 1) / 2) * w * 0.12, hw = hwAt(t) * (0.62 - Math.abs(k - (n - 1) / 2) * 0.12);
        g.globalAlpha = 0.34; g.lineWidth = 0.009;
        g.beginPath(); g.moveTo(-hw, yy); g.quadraticCurveTo(0, yy + 0.014, hw, yy); g.stroke();
      }
      g.globalAlpha = 1; g.fillStyle = 'rgba(255,250,240,0.18)'; g.beginPath(); g.ellipse(-hwAt(t) * 0.25, cy - w * 0.22, hwAt(t) * 0.5, w * 0.1, 0, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    // nail: cuticle arc, bed, edge, specular streak
    if (o2.nail !== false) {
      const nh = Math.min(len * 0.3, w * 0.78), nw = tipH * 1.3, top = -len - tipH * 0.55, bot = top + nh;
      g.beginPath(); g.moveTo(-nw / 2, bot); g.bezierCurveTo(-nw / 2, top + nh * 0.25, -nw * 0.3, top, 0, top); g.bezierCurveTo(nw * 0.3, top, nw / 2, top + nh * 0.25, nw / 2, bot);
      g.quadraticCurveTo(0, bot + nh * 0.14, -nw / 2, bot); g.closePath();
      const ng = g.createLinearGradient(-nw / 2, 0, nw / 2, 0);
      ng.addColorStop(0, sk.nail); ng.addColorStop(0.35, '#ffffff'); ng.addColorStop(1, sk.nail);
      g.fillStyle = ng; g.globalAlpha = 0.92; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = sk.line; g.globalAlpha = 0.4; g.lineWidth = 0.008; g.stroke(); g.globalAlpha = 1;
      g.fillStyle = 'rgba(214,128,112,0.28)'; g.beginPath(); g.ellipse(0, bot - nh * 0.1, nw * 0.4, nh * 0.18, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(-nw * 0.18, top + nh * 0.4, nw * 0.07, nh * 0.26, 0.15, 0, TAU); g.fill();
    }
  };

  // fingers, outer ones first so the index finger overlaps its neighbour; a little spread fans them like a real hand
  const SPREAD = [-0.07, -0.02, 0.03, 0.09];
  for (let i = 3; i >= 0; i--) {
    const f = FING[i], e = clamp(ext[i + 1] ?? 0, 0, 1.12);
    const len = 0.31 + (f.L + 0.22 - 0.31) * e, wd = f.w * (e < 0.08 ? 1.16 : 1.08);
    g.save(); g.translate(f.x, f.y + 0.05); g.rotate(SPREAD[i] * Math.min(1, e));
    digit(wd, len, e, {});
    if (!shadow && o.ring && i === 2) {   // a wedding band on the ring finger
      const ry = e < 0.08 ? -len * 0.35 : -len * 0.18;
      const rg = g.createLinearGradient(-f.w / 2, 0, f.w / 2, 0);
      rg.addColorStop(0, '#fff2b0'); rg.addColorStop(0.45, '#e0a82a'); rg.addColorStop(1, '#8a5e10');
      g.fillStyle = rg; g.beginPath(); g.roundRect(-f.w / 2 * 0.96, ry, f.w * 0.96, 0.05, 0.02); g.fill();
      g.strokeStyle = 'rgba(70,40,5,0.5)'; g.lineWidth = 0.006; g.stroke();
    }
    g.restore();
  }

  drawPalm();   // the palm covers the finger roots, so fingers emerge cleanly from the knuckle line

  // thumb: a thenar mound at its root; extended it points out to the left, folded it lies across the palm
  {
    const e = clamp(ext[0] ?? 0, 0, 1.12), ang = 0.95 - 1.75 * Math.min(e, 1), len = 0.24 + 0.26 * e, w = 0.215;
    g.save(); g.translate(-0.34, -0.12);
    if (!shadow) {
      const tg = g.createRadialGradient(-0.06, 0.02, 0.01, -0.04, 0.04, 0.26);
      tg.addColorStop(0, 'rgba(255,248,235,0.3)'); tg.addColorStop(1, 'rgba(255,248,235,0)');
      g.fillStyle = tg; g.beginPath(); g.ellipse(-0.04, 0.03, 0.26, 0.28, 0.5, 0, TAU); g.fill();
    }
    g.rotate(ang);
    digit(w, len, e < 0.08 ? 0.5 : e, { nail: e > 0.5 });
    g.restore();
  }
}

// o: { ext[5], skin (index or object), sleeve, trim, accent, ring, bracelet, pattern, rot (radians, 0 = fingers up), mirror }
// (x, y) is the wrist at the base of the palm; s is the palm width in px.
export function drawHand(ctx, x, y, s, o) {
  const sk = typeof o.skin === 'number' ? SKINS[o.skin % SKINS.length] : o.skin ?? SKINS[0];
  const op = { ...o, skin: sk, ext: o.ext ?? [0, 0, 0, 0, 0], sleeve: o.sleeve ?? '#3a5a7a', trim: o.trim ?? '#f2eee2', accent: o.accent ?? '#c9a24b' };
  if (HANDS.ready) { drawHandSprite(ctx, x, y, s, op); return; }
  const place = (dx, dy) => { ctx.translate(x + dx * s, y + dy * s); ctx.rotate(o.rot ?? 0); ctx.scale(o.mirror ? -s : s, s); };
  // two soft shadow layers (the light always comes from the upper left of the screen), then the hand
  ctx.save(); place(0.09, 0.1); ctx.globalAlpha = 0.14; pass(ctx, op, true); ctx.restore();
  ctx.save(); place(0.045, 0.05); ctx.globalAlpha = 0.18; pass(ctx, op, true); ctx.restore();
  ctx.save(); place(0, 0); pass(ctx, op, false); ctx.restore();
}

// ---- pre-rendered 3D hand sprites (web/hands/h_<y|r><skin>_<n>.webp, rendered offline from a jointed three.js hand) ----------------------------
// 'y' sprites: wrist at (380, 634) fingers up; 'r' sprites: the same hand seen from across the table, wrist at (380, 306) fingers down.
// 335 px = one palm width unit.
const HANDS = { ready: false, img: {} };
export function setHandSprite(key, img) { HANDS.img[key] = img; HANDS.ready = HANDS.img.y0_0 && HANDS.img.y0_0.complete && HANDS.img.y0_0.naturalWidth > 0; }
const SPR = { y: [380, 710], r: [380, 214], unit: 335 };
const poseOf = (ext, sk) => {   // nearest of the six throws from per-finger extension
  const th = ext[0] > 0.5 ? 1 : 0; let n = 0;
  for (let i = 1; i < 5; i++) if (ext[i] > 0.5) n++;
  return th && n === 4 ? 5 : n;
};
function drawHandSprite(ctx, x, y, s, o) {
  const skIdx = typeof o.skinIdx === 'number' ? o.skinIdx : Math.max(0, SKINS.indexOf(o.skin));
  const rival = Math.abs(((o.rot ?? 0) % TAU + TAU) % TAU - Math.PI) < 0.6;
  const side = rival ? 'r' : 'y';
  const ext = o.ext;
  const target = poseOf(ext, o.skin);
  const get = (n) => HANDS.img[`${side}${skIdx % 4}_${n}`];
  const blit = (img, a) => {
    if (!img || !img.complete || !img.naturalWidth) return;
    const [ax, ay] = SPR[side], k = s / SPR.unit * (o.zoom ?? 1);
    ctx.save(); ctx.translate(x, y); ctx.rotate((o.rot ?? 0) - (rival ? Math.PI : 0)); if (o.mirror) ctx.scale(-1, 1);
    ctx.globalAlpha *= a; ctx.drawImage(img, -ax * k, -ay * k, img.naturalWidth * k, img.naturalHeight * k); ctx.restore();
  };
  // fingers spring out: the fist sprite fades into the final pose sprite while the fingers extend
  let prog = 0, cnt = 0;
  for (let i = 0; i < 5; i++) if (FINGERS[target][i]) { prog += Math.min(1, ext[i]); cnt++; }
  prog = cnt ? prog / cnt : 1;
  const sleeve = () => {
    const sl = { ...o, spr: true };
    const place = (dx, dy) => { ctx.translate(x + dx * s, y + dy * s); ctx.rotate(o.rot ?? 0); ctx.scale(o.mirror ? -s : s, s); };
    ctx.save(); place(0.05, 0.0); ctx.globalAlpha = 0.3; pass(ctx, sl, true); ctx.restore();
    ctx.save(); place(0, -0.28); pass(ctx, sl, false); ctx.restore();   // the cuff sits right at the wrist, covering the skin-texture seam
  };
  if (target === 0 || prog >= 0.98) blit(get(target), 1);
  else { blit(get(0), 1); blit(get(target), prog); }
  if (!o.icon) sleeve();
}

// ---- particles and bubbles --------------------------------------------------------------------------------------------------------------------------
export function burst(parts, rng, x, y, n, col = '#ffd45a', speed = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), v = rng.range(80, 340) * speed;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rng.range(0.5, 1.0), age: 0, r: rng.range(3, 7), col });
  }
}
export function stepParticles(parts, dt) {
  for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 0.99; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
}
export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const k = 1 - p.age / p.life;
    ctx.globalAlpha = Math.max(0, k); ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + k * 0.6), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// A speech bubble: rounded rect with a tail. (x, y) = the point the tail touches; dir -1 tail up, +1 tail down. Returns the body rect.
export function bubbleShape(ctx, cx, cy, w, h, tailX, tailY, fill, stroke) {
  const r = Math.min(h * 0.32, 26), x = cx - w / 2, y = cy - h / 2;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  const down = tailY > cy;
  const bx = clamp(tailX, x + r + 14, x + w - r - 14), by = down ? y + h : y;
  ctx.moveTo(bx - 14, by); ctx.lineTo(tailX, tailY); ctx.lineTo(bx + 14, by);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
  return { x, y, w, h };
}
