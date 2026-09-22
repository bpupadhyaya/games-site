// All the painting that is expensive: the table, the kaya-wood board, the slate and shell stones, the bowls (go-ke).
// Painted once into cached sprites/layers (OffscreenCanvas); view.js only blits them. One warm lamp, upper left.
import { W, H, px, py, stoneR, starPoints } from './layout.js';

const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null);

export const THEMES = {
  kaya: { name: 'Kaya', face: ['#efcb86', '#e2b467', '#d6a458'], grain: [122, 78, 28], edge: ['#a9773a', '#6d4820'], line: '#2b1a0a', side: ['#b98544', '#7a4f23'] },
  dark: { name: 'Dark kaya', face: ['#c99958', '#b7823f', '#a06e32'], grain: [80, 44, 14], edge: ['#7c5226', '#43280f'], line: '#1d1006', side: ['#8b5c28', '#4c2f12'] },
  ash: { name: 'Pale', face: ['#f3e2b8', '#e8d09a', '#dcc084'], grain: [150, 112, 60], edge: ['#b5935a', '#7b5f32'], line: '#33210e', side: ['#c9a46a', '#8a6a3a'] },
};

// ---- the table (a dark lacquered surface with lamplight) --------------------------------------------------------------
function paintTable(c) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1b1512'); g.addColorStop(0.5, '#241a14'); g.addColorStop(1, '#120d0a');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // long soft wood grain across the table
  const r = lcg(77);
  for (let i = 0; i < 90; i++) {
    const y = r() * H, a = 0.03 + r() * 0.05, th = 1 + r() * 3;
    c.strokeStyle = `rgba(${r() < 0.5 ? '255,214,160' : '0,0,0'},${a})`; c.lineWidth = th;
    c.beginPath(); c.moveTo(-10, y);
    c.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 30, W * 0.7, y + (r() - 0.5) * 30, W + 10, y + (r() - 0.5) * 24); c.stroke();
  }
  const v = c.createRadialGradient(W / 2, H * 0.48, H * 0.32, W / 2, H * 0.48, H * 0.82);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}

// ---- the board ---------------------------------------------------------------------------------------------------------
export function paintBoard(c, L, th) {
  const T = THEMES[th] || THEMES.kaya, x = L.x, y = L.y, s = L.size, depth = 26, R = 14;
  // shadow on the table
  c.save(); c.filter = 'none';
  const sh = c.createRadialGradient(x + s / 2, y + s / 2 + depth + 22, s * 0.2, x + s / 2, y + s / 2 + depth + 22, s * 0.78);
  sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sh; c.fillRect(x - 90, y - 60, s + 180, s + 220); c.restore();
  // the thick side of the board
  const sg = c.createLinearGradient(0, y + s, 0, y + s + depth);
  sg.addColorStop(0, T.side[0]); sg.addColorStop(1, T.side[1]);
  c.fillStyle = sg; c.beginPath(); c.roundRect(x - 2, y + 8, s + 4, s + depth, R + 2); c.fill();
  // grain on the side
  const r = lcg(5 + L.n);
  c.strokeStyle = 'rgba(40,20,5,0.25)'; c.lineWidth = 1;
  for (let i = 0; i < 6; i++) { const yy = y + s + 3 + r() * (depth - 5); c.beginPath(); c.moveTo(x + 6, yy); c.lineTo(x + s - 6, yy + (r() - 0.5) * 3); c.stroke(); }
  // the face
  c.save(); c.beginPath(); c.roundRect(x, y, s, s, R); c.clip();
  const fg = c.createLinearGradient(x, y, x + s, y + s);
  fg.addColorStop(0, T.face[0]); fg.addColorStop(0.55, T.face[1]); fg.addColorStop(1, T.face[2]);
  c.fillStyle = fg; c.fillRect(x, y, s, s);
  // kaya grain: long slightly wandering strokes, a few darker "figure" lines
  const g = T.grain;
  for (let i = 0; i < 150; i++) {
    const gy = y + r() * s, a = 0.04 + r() * 0.11, wave = 3 + r() * 9, ph = r() * 6;
    c.strokeStyle = `rgba(${g[0]},${g[1]},${g[2]},${a})`; c.lineWidth = 0.7 + r() * 2.2;
    c.beginPath();
    for (let k = 0; k <= 12; k++) { const xx = x + (k / 12) * s; const yy = gy + Math.sin(ph + k * 0.7) * wave + (k / 12 - 0.5) * (r() * 0 + 8); k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
    c.stroke();
  }
  for (let i = 0; i < 26; i++) { // fine pores
    const gy = y + r() * s, gx = x + r() * s;
    c.strokeStyle = `rgba(${g[0]},${g[1]},${g[2]},0.10)`; c.lineWidth = 0.8; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + 20 + r() * 60, gy + (r() - 0.5) * 4); c.stroke();
  }
  // lamplight sheen from the upper left, and a darker lower right
  const sheen = c.createRadialGradient(x + s * 0.28, y + s * 0.2, 10, x + s * 0.28, y + s * 0.2, s * 0.95);
  sheen.addColorStop(0, 'rgba(255,240,200,0.30)'); sheen.addColorStop(0.5, 'rgba(255,225,170,0.06)'); sheen.addColorStop(1, 'rgba(60,30,0,0.22)');
  c.fillStyle = sheen; c.fillRect(x, y, s, s);
  c.restore();
  // bevel
  c.strokeStyle = 'rgba(255,240,200,0.55)'; c.lineWidth = 2; c.beginPath(); c.roundRect(x + 1, y + 1, s - 2, s - 2, R); c.stroke();
  c.strokeStyle = T.edge[1]; c.lineWidth = 1.5; c.beginPath(); c.roundRect(x, y, s, s, R); c.stroke();
  // lines
  const n = L.n, ax = px(L, 0), ay = py(L, 0), bx = px(L, n - 1), by = py(L, n * n - 1);
  c.strokeStyle = T.line; c.lineCap = 'butt';
  for (let k = 0; k < n; k++) {
    const p = ax + (bx - ax) * (k / (n - 1)), q = ay + (by - ay) * (k / (n - 1));
    c.lineWidth = k === 0 || k === n - 1 ? 2.6 : 1.5; c.globalAlpha = 0.9;
    c.beginPath(); c.moveTo(p, ay); c.lineTo(p, by); c.stroke();
    c.beginPath(); c.moveTo(ax, q); c.lineTo(bx, q); c.stroke();
  }
  c.globalAlpha = 1;
  for (const i of starPoints(n)) {
    const sx = px(L, i), sy = py(L, i), rr = Math.max(3.2, L.d * 0.085);
    c.fillStyle = 'rgba(255,240,200,0.35)'; c.beginPath(); c.arc(sx + 0.8, sy + 0.8, rr, 0, TAU); c.fill();
    c.fillStyle = T.line; c.beginPath(); c.arc(sx, sy, rr, 0, TAU); c.fill();
  }
  // coordinates in the margin (small, low contrast)
  if (n >= 9 && !L.plain) {
    c.fillStyle = 'rgba(60,35,10,0.6)'; c.font = `600 ${Math.max(12, L.d * 0.28)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let k = 0; k < n; k++) {
      c.fillText('ABCDEFGHJKLMNOPQRST'[k], px(L, k), y + L.m * 0.42);
      c.fillText(String(n - k), x + L.m * 0.42, py(L, k * n));
    }
    c.textBaseline = 'alphabetic';
  }
}

const layers = {};
export function drawTable(ctx) {
  if (!layers.table) {
    const cv = mk(W, H);
    if (cv) { paintTable(cv.getContext('2d')); layers.table = cv; }
    else layers.table = { direct: true };
  }
  if (layers.table.direct) { if (ctx.fillRect) paintTable(ctx); } else ctx.drawImage(layers.table, 0, 0);
}
export function drawBoardLayer(ctx, L, th) {
  const key = `${th}${L.n}:${L.x}:${L.y}:${L.size}${L.plain ? 'p' : ''}`;
  if (!layers[key]) {
    const pad = 100, cv = mk((L.size + pad * 2) * 1, (L.size + pad * 2 + 60) * 1);
    if (cv) {
      const c = cv.getContext('2d'); c.translate(pad - L.x, pad - L.y);
      paintBoard(c, L, th); layers[key] = { cv, pad };
    } else layers[key] = { direct: true };
  }
  const e = layers[key];
  if (e.direct) paintBoard(ctx, L, th); else ctx.drawImage(e.cv, L.x - e.pad, L.y - e.pad);
}

// ---- lamp glow (a cached soft light that breathes slightly) ---------------------------------------------------------------
function paintLamp(c) {
  const g = c.createRadialGradient(150, 140, 20, 150, 140, 900);
  g.addColorStop(0, 'rgba(255,196,110,0.34)'); g.addColorStop(0.35, 'rgba(255,170,80,0.11)'); g.addColorStop(1, 'rgba(255,150,60,0)');
  c.fillStyle = g; c.fillRect(0, 0, 1050, 1050);
}
export function drawLamp(ctx, t, calm) {
  if (layers.lamp === undefined) { const cv = mk(1050, 1050); if (cv) paintLamp(cv.getContext('2d')); layers.lamp = cv || false; }
  const k = calm ? 1 : 0.94 + Math.sin(t * 1.3) * 0.05 + Math.sin(t * 2.9 + 1) * 0.025;
  ctx.globalAlpha = Math.min(1, k);
  if (layers.lamp) ctx.drawImage(layers.lamp, 0, 0); else paintLamp(ctx);
  ctx.globalAlpha = 1;
}

// Called once per tick while the title is showing: builds one cached layer at a time so the first game frame is cheap.
let warmStep = 0;
export function warm(L9, L13, L19, th) {
  if (typeof OffscreenCanvas === 'undefined') return;
  const steps = [
    () => { drawTable({ drawImage() {}, direct: false, fillRect() {} }); },
    () => drawLamp({ drawImage() {}, set globalAlpha(v) {} }, 0, true),
    () => drawBowl({ drawImage() {} }, 1, 0, 0), () => drawBowl({ drawImage() {} }, 2, 0, 0),
    () => drawBoardLayer({ drawImage() {} }, L9, th),
    () => { for (const k of [1, 2]) drawStone({ drawImage() {}, set globalAlpha(v) {} }, k, 0, 0, stoneR(L9)); },
    () => drawShadow({ drawImage() {}, set globalAlpha(v) {} }, 0, 0, 30, 0),
    () => drawBoardLayer({ drawImage() {} }, L13, th),
    () => { for (const k of [1, 2]) drawStone({ drawImage() {}, set globalAlpha(v) {} }, k, 0, 0, stoneR(L13)); },
    () => drawBoardLayer({ drawImage() {} }, L19, th),
    () => { for (const k of [1, 2]) drawStone({ drawImage() {}, set globalAlpha(v) {} }, k, 0, 0, stoneR(L19)); },
  ];
  if (warmStep < steps.length) steps[warmStep++]();
}

// ---- stones ---------------------------------------------------------------------------------------------------------------
function paintStone(c, kind, r, seed) {
  const cx = 0, cy = 0;
  if (kind === 2) {   // shell (white): warm, milky, faint growth rings
    const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.38, r * 0.08, cx, cy, r * 1.02);
    g.addColorStop(0, '#fffefa'); g.addColorStop(0.45, '#f4efe2'); g.addColorStop(0.85, '#d6cfbb'); g.addColorStop(1, '#b8af99');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
    const rr = lcg(seed);
    c.strokeStyle = 'rgba(150,135,105,0.14)'; c.lineWidth = Math.max(0.6, r * 0.03);
    const ox = (rr() - 0.5) * r * 0.5, oy = (rr() - 0.5) * r * 0.5;
    for (let i = 1; i < 6; i++) { c.beginPath(); c.arc(ox, oy - r * 0.3, r * (0.25 + i * 0.24), 0.2, Math.PI - 0.2); c.stroke(); }
    const sh = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    sh.addColorStop(0, 'rgba(255,255,255,0.25)'); sh.addColorStop(0.55, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(90,75,50,0.22)');
    c.fillStyle = sh; c.fillRect(-r, -r, r * 2, r * 2);
    c.restore();
    c.strokeStyle = 'rgba(120,105,75,0.5)'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, r - 0.5, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(cx - r * 0.33, cy - r * 0.42, r * 0.26, r * 0.14, -0.6, 0, TAU); c.fill();
  } else {            // slate (black): deep, with a soft gloss and a cool rim light
    const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.38, r * 0.05, cx, cy, r * 1.02);
    g.addColorStop(0, '#5b5f69'); g.addColorStop(0.35, '#2b2d34'); g.addColorStop(0.8, '#121318'); g.addColorStop(1, '#07080b');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    const rim = c.createRadialGradient(cx + r * 0.25, cy + r * 0.55, r * 0.3, cx, cy, r);
    rim.addColorStop(0, 'rgba(120,130,150,0)'); rim.addColorStop(1, 'rgba(120,135,160,0.22)');
    c.fillStyle = rim; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.42)'; c.beginPath(); c.ellipse(cx - r * 0.34, cy - r * 0.44, r * 0.25, r * 0.13, -0.6, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.10)'; c.beginPath(); c.ellipse(cx - r * 0.2, cy - r * 0.2, r * 0.6, r * 0.42, -0.6, 0, TAU); c.fill();
  }
}
const stoneCache = {};
const SC = 2;
export function drawStone(ctx, kind, x, y, r, opts = {}) {
  const a = opts.alpha ?? 1, seedI = opts.seed ?? 0;
  const key = `${kind}:${Math.round(r * 2)}:${seedI % 4}`;
  let e = stoneCache[key];
  if (e === undefined) {
    const cv = mk(Math.ceil(r * 2 * SC + 8), Math.ceil(r * 2 * SC + 8));
    if (cv) { const c = cv.getContext('2d'); c.translate(cv.width / 2, cv.height / 2); c.scale(SC, SC); paintStone(c, kind, Math.round(r * 2) / 2, 11 + (seedI % 4) * 7); e = stoneCache[key] = cv; } else e = stoneCache[key] = null;
  }
  const sc = opts.scale ?? 1;
  if (a < 1) ctx.globalAlpha = a;
  if (e) { const w = (e.width / SC) * sc; ctx.drawImage(e, x - w / 2, y - w / 2, w, w); }
  else { ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); paintStone(ctx, kind, r, 11 + (seedI % 4) * 7); ctx.restore(); }
  if (a < 1) ctx.globalAlpha = 1;
}
// contact shadow: a soft ellipse below-right of the stone; `lift` spreads and fades it while the stone is in the air
let shadowSprite;
export function drawShadow(ctx, x, y, r, lift = 0) {
  if (shadowSprite === undefined) {
    const cv = mk(128, 128);
    if (cv) { const c = cv.getContext('2d'); const g = c.createRadialGradient(64, 64, 6, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.6, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }
    shadowSprite = cv;
  }
  const s = r * 2.5 * (1 + lift * 0.25), ox = r * (0.16 + lift * 0.5), oy = r * (0.24 + lift * 0.7);
  ctx.globalAlpha = 0.85 - lift * 0.4;
  if (shadowSprite) ctx.drawImage(shadowSprite, x + ox - s / 2, y + oy - s / 2, s, s);
  else { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + ox, y + oy, r, r * 0.9, 0, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
}

// ---- a go-ke: a round turned-wood bowl seen from above, heaped with stones ----------------------------------------------
function paintBowl(c, kind) {
  const R = 92;
  const sg = c.createRadialGradient(-10, R * 0.55, R * 0.5, 0, R * 0.55, R * 1.25);
  sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sg; c.beginPath(); c.ellipse(6, R * 0.34, R * 1.15, R * 0.98, 0, 0, TAU); c.fill();
  const g = c.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.05);
  g.addColorStop(0, '#d9a866'); g.addColorStop(0.5, '#a5723a'); g.addColorStop(1, '#5c3717');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,225,170,0.5)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, R - 2, 3.5, 5.6); c.stroke();
  const rr = lcg(kind * 31);
  c.strokeStyle = 'rgba(60,30,8,0.35)'; c.lineWidth = 1;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(0, 0, R - 5 - i * 3.2, rr() * 6, rr() * 6 + 1.2); c.stroke(); }
  const ig = c.createRadialGradient(0, 4, 8, 0, 0, R * 0.78);
  ig.addColorStop(0, '#2b1709'); ig.addColorStop(1, '#5a3618');
  c.fillStyle = ig; c.beginPath(); c.arc(0, 0, R * 0.74, 0, TAU); c.fill();
  // heap of stones
  const r0 = 15, pts = [];
  const r2 = lcg(kind * 97);
  for (let i = 0; i < 26; i++) { const a = r2() * TAU, d = Math.sqrt(r2()) * (R * 0.6); pts.push([Math.cos(a) * d, Math.sin(a) * d * 0.9, r0 * (0.92 + r2() * 0.16)]); }
  pts.sort((a, b) => a[1] - b[1]);
  for (const [x, y, rr2] of pts) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(2.5, 4, rr2, rr2 * 0.88, 0, 0, TAU); c.fill();
    paintStone(c, kind, rr2, Math.floor(x + y)); c.restore();
  }
}
const bowls = {};
export function drawBowl(ctx, kind, x, y, scale = 1) {
  if (bowls[kind] === undefined) { const cv = mk(280, 300); if (cv) { const c = cv.getContext('2d'); c.translate(140, 140); paintBowl(c, kind); } bowls[kind] = cv; }
  const cv = bowls[kind];
  if (cv) ctx.drawImage(cv, x - 140 * scale, y - 140 * scale, 280 * scale, 300 * scale);
  else { ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); paintBowl(ctx, kind); ctx.restore(); }
}
