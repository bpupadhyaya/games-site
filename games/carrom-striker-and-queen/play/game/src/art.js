// The table, the board and the pieces. Everything here is painted ONCE into cached layers (never per frame).
// One light, from the upper left, warm. The board is plywood in a wooden frame with a printed red circle.
import { W, H, K, BX, BY, PLAY, CX, CY, FRAME, sx, sy } from './layout.js';
import { S, R_COIN, R_STR, R_POCKET, POCKETS, BASE_Y, BASE_X0, BASE_X1 } from './physics.js';

const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

export const THEMES = {
  plywood: { name: 'Plywood', frame: ['#9c6238', '#6e3f1f', '#3e2010'], grain: '70,34,12', face: ['#f2d497', '#e2b96d', '#d1a052'], fgrain: '140,84,30' },
  walnut: { name: 'Walnut', frame: ['#6d4128', '#4a2916', '#2a150a'], grain: '30,14,6', face: ['#e2b878', '#d09f5c', '#b98446'], fgrain: '110,66,26' },
  ash: { name: 'Ash', frame: ['#b99a70', '#98784f', '#6e5232'], grain: '90,64,34', face: ['#f8ecc8', '#efdcac', '#e0c78a'], fgrain: '160,120,64' },
};
export const THEME_KEYS = Object.keys(THEMES);

const mk = (w, h, scale, fn) => {
  try {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const c = new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale)), g = c.getContext('2d'); g.scale(scale, scale); fn(g); return c;
  } catch { return null; }
};

// --- the room ---------------------------------------------------------------------------------------------
function paintTable(g) {
  const r = lcg(11);
  g.fillStyle = '#24140a'; g.fillRect(0, 0, W, H);
  // planks
  for (let y = 0, i = 0; y < H; y += 130, i++) {
    const t = 0.35 + r() * 0.3, gr = g.createLinearGradient(0, y, 0, y + 130);
    gr.addColorStop(0, `rgba(${90 * t + 30},${52 * t + 18},${26 * t + 8},1)`); gr.addColorStop(1, `rgba(${70 * t + 26},${40 * t + 14},${20 * t + 6},1)`);
    g.fillStyle = gr; g.fillRect(0, y, W, 130);
    for (let k = 0; k < 40; k++) { const yy = y + 4 + r() * 122; g.strokeStyle = `rgba(20,8,2,${0.05 + r() * 0.1})`; g.lineWidth = 0.6 + r() * 1.2; g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(W * 0.3, yy + (r() - 0.5) * 8, W * 0.6, yy + (r() - 0.5) * 8, W, yy + (r() - 0.5) * 6); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, y, W, 2.5); g.fillStyle = 'rgba(255,190,120,0.06)'; g.fillRect(0, y + 2.5, W, 1.5);
  }
  // warm light from the upper left and a vignette
  let l = g.createRadialGradient(140, 300, 40, 140, 300, 1200); l.addColorStop(0, 'rgba(255,196,120,0.34)'); l.addColorStop(0.5, 'rgba(255,170,90,0.08)'); l.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = l; g.fillRect(0, 0, W, H);
  l = g.createRadialGradient(CX, CY, 320, CX, CY, 1000); l.addColorStop(0, 'rgba(0,0,0,0)'); l.addColorStop(1, 'rgba(6,2,0,0.72)'); g.fillStyle = l; g.fillRect(0, 0, W, H);
}

// --- the board --------------------------------------------------------------------------------------------
function grainStrip(g, x0, y0, x1, y1, horizontal, rgb, n, seed) {
  const r = lcg(seed);
  g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
  for (let i = 0; i < n; i++) {
    const a = 0.03 + r() * r() * 0.16, w = 0.4 + r() * 1.3; g.strokeStyle = `rgba(${rgb},${a})`; g.lineWidth = w; g.beginPath();
    if (horizontal) { const y = y0 + r() * (y1 - y0), d = (r() - 0.5) * 7; g.moveTo(x0, y); g.bezierCurveTo(x0 + (x1 - x0) * 0.33, y + d, x0 + (x1 - x0) * 0.66, y - d, x1, y + d * 0.4); }
    else { const x = x0 + r() * (x1 - x0), d = (r() - 0.5) * 7; g.moveTo(x, y0); g.bezierCurveTo(x + d, y0 + (y1 - y0) * 0.33, x - d, y0 + (y1 - y0) * 0.66, x + d * 0.4, y1); }
    g.stroke();
  }
  g.restore();
}

function paintBoard(g, th) {
  const T = THEMES[th] || THEMES.plywood, half = PLAY / 2 + FRAME, fx = CX - half, fy = CY - half, fs = half * 2, ix = BX, iy = BY;
  // shadow on the table
  g.save(); g.shadowColor = 'rgba(0,0,0,0.65)'; g.shadowBlur = 46; g.shadowOffsetY = 22; g.fillStyle = '#000'; g.beginPath(); g.roundRect(fx, fy, fs, fs, 20); g.fill(); g.restore();
  // frame: four mitred strips, grain running along each
  const strip = (pts, horizontal, seed, shade) => {
    g.save(); g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.clip();
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, T.frame[0]); gr.addColorStop(0.55, T.frame[1]); gr.addColorStop(1, T.frame[2]);
    g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    grainStrip(g, x0, y0, x1, y1, horizontal, T.grain, 70, seed);
    g.fillStyle = `rgba(0,0,0,${shade})`; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.restore();
  };
  g.save(); g.beginPath(); g.roundRect(fx, fy, fs, fs, 20); g.clip();
  strip([[fx, fy], [fx + fs, fy], [ix + PLAY, iy], [ix, iy]], true, 5, 0);
  strip([[fx, fy + fs], [fx + fs, fy + fs], [ix + PLAY, iy + PLAY], [ix, iy + PLAY]], true, 6, 0.28);
  strip([[fx, fy], [ix, iy], [ix, iy + PLAY], [fx, fy + fs]], false, 7, 0.1);
  strip([[fx + fs, fy], [ix + PLAY, iy], [ix + PLAY, iy + PLAY], [fx + fs, fy + fs]], false, 8, 0.2);
  g.restore();
  // mitre seams and bevels
  g.strokeStyle = 'rgba(20,8,0,0.55)'; g.lineWidth = 1.5; g.beginPath();
  g.moveTo(fx + 6, fy + 6); g.lineTo(ix, iy); g.moveTo(fx + fs - 6, fy + 6); g.lineTo(ix + PLAY, iy); g.moveTo(fx + 6, fy + fs - 6); g.lineTo(ix, iy + PLAY); g.moveTo(fx + fs - 6, fy + fs - 6); g.lineTo(ix + PLAY, iy + PLAY); g.stroke();
  g.strokeStyle = 'rgba(255,214,150,0.5)'; g.lineWidth = 2; g.beginPath(); g.roundRect(fx + 1.5, fy + 1.5, fs - 3, fs - 3, 19); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.beginPath(); g.roundRect(fx - 0.5, fy - 0.5, fs + 1, fs + 1, 20.5); g.stroke();
  // inlay line and brass studs on the frame
  g.strokeStyle = 'rgba(232,186,96,0.55)'; g.lineWidth = 1.6; g.strokeRect(fx + 15, fy + 15, fs - 30, fs - 30);
  g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.strokeRect(fx + 17, fy + 17, fs - 34, fs - 34);
  for (const [px, py] of [[fx + 31, fy + 31], [fx + fs - 31, fy + 31], [fx + 31, fy + fs - 31], [fx + fs - 31, fy + fs - 31]]) { /* under the pockets */ void px; void py; }
  for (const t of [0.25, 0.5, 0.75]) for (const [px, py] of [[fx + fs * t, fy + 31], [fx + fs * t, fy + fs - 31], [fx + 31, fy + fs * t], [fx + fs - 31, fy + fs * t]]) { const sg = g.createRadialGradient(px - 1.5, py - 1.5, 0.5, px, py, 5); sg.addColorStop(0, '#fff1c4'); sg.addColorStop(0.5, '#d2a24a'); sg.addColorStop(1, '#6b4514'); g.fillStyle = sg; g.beginPath(); g.arc(px, py, 4.5, 0, TAU); g.fill(); }
  // inner cushion lip: a raised rail with a shadow that falls on the playing surface
  g.save(); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(ix - 9, iy - 9, PLAY + 18, PLAY + 18); g.restore();
  g.strokeStyle = 'rgba(255,220,160,0.35)'; g.lineWidth = 2; g.strokeRect(ix - 10, iy - 10, PLAY + 20, PLAY + 20);
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3; g.strokeRect(ix - 5.5, iy - 5.5, PLAY + 11, PLAY + 11);
  // playing surface
  const fg = g.createLinearGradient(ix, iy, ix + PLAY, iy + PLAY); fg.addColorStop(0, T.face[0]); fg.addColorStop(0.5, T.face[1]); fg.addColorStop(1, T.face[2]);
  g.fillStyle = fg; g.fillRect(ix, iy, PLAY, PLAY);
  // soft blotches of colour, then sparse, uneven grain
  const br = lcg(9); for (let i = 0; i < 14; i++) { const x = ix + br() * PLAY, y = iy + br() * PLAY, rr = 70 + br() * 150, gg = g.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, `rgba(${br() > 0.5 ? '255,244,205' : '150,96,40'},${0.05 + br() * 0.06})`); gg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gg; g.fillRect(ix, iy, PLAY, PLAY); }
  grainStrip(g, ix, iy, ix + PLAY, iy + PLAY, true, T.fgrain, 190, 21);
  grainStrip(g, ix, iy, ix + PLAY, iy + PLAY, true, '255,246,214', 50, 22);
  // knots
  const kr = lcg(33);
  for (let i = 0; i < 3; i++) { const x = ix + 40 + kr() * (PLAY - 80), y = iy + 40 + kr() * (PLAY - 80); for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(${T.fgrain},${0.12 - k * 0.015})`; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, 4 + k * 3.4, 2 + k * 1.3, 0, 0, TAU); g.stroke(); } }
  // markings (black and red print)
  const P = (x, y) => [sx(x), sy(y)], line = 'rgba(46,24,14,0.86)', red = 'rgba(176,36,30,0.92)';
  g.lineCap = 'round';
  g.strokeStyle = line; g.lineWidth = 1.6; g.strokeRect(sx(38), sy(38), (S - 76) * K, (S - 76) * K);
  const baselines = [BASE_Y.W, BASE_Y.B];
  for (const by of baselines) {
    g.strokeStyle = line; g.lineWidth = 1.5;
    for (const d of [-R_STR - 3, R_STR + 3]) { g.beginPath(); g.moveTo(sx(BASE_X0), sy(by + d)); g.lineTo(sx(BASE_X1), sy(by + d)); g.stroke(); }
    for (const bx of [BASE_X0, BASE_X1]) { const [cx, cy] = P(bx, by); g.beginPath(); g.arc(cx, cy, (R_STR + 3) * K, 0, TAU); g.fillStyle = 'rgba(176,36,30,0.10)'; g.fill(); g.strokeStyle = line; g.stroke(); g.beginPath(); g.arc(cx, cy, (R_STR - 4) * K, 0, TAU); g.strokeStyle = red; g.lineWidth = 2.4; g.stroke(); }
  }
  // centre: rosette of a red ring, black ring and eight petals
  const [cx, cy] = P(S / 2, S / 2);
  g.lineWidth = 2; g.strokeStyle = red; g.beginPath(); g.arc(cx, cy, 82 * K, 0, TAU); g.stroke();
  g.lineWidth = 1.4; g.strokeStyle = line; g.beginPath(); g.arc(cx, cy, 88 * K, 0, TAU); g.stroke();
  g.beginPath(); g.arc(cx, cy, 46 * K, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(176,36,30,0.16)'; g.beginPath(); g.arc(cx, cy, 46 * K, 0, TAU); g.fill();
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.save(); g.translate(cx, cy); g.rotate(a); g.strokeStyle = red; g.lineWidth = 1.8; g.beginPath(); g.moveTo(48 * K, 0); g.quadraticCurveTo(62 * K, -12 * K, 80 * K, 0); g.quadraticCurveTo(62 * K, 12 * K, 48 * K, 0); g.stroke(); g.restore(); }
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + TAU / 16; g.strokeStyle = line; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 20 * K, cy + Math.sin(a) * 20 * K); g.lineTo(cx + Math.cos(a) * 44 * K, cy + Math.sin(a) * 44 * K); g.stroke(); }
  // corner arrows: a line from each pocket toward the centre with an arrowhead and a small red circle
  for (const p of POCKETS) {
    const dx = S / 2 - p.x, dy = S / 2 - p.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d, sxp = p.x + ux * 70, syp = p.y + uy * 70, ex = p.x + ux * 158, ey = p.y + uy * 158;
    g.strokeStyle = line; g.lineWidth = 1.6; g.beginPath(); g.moveTo(...P(sxp, syp)); g.lineTo(...P(ex, ey)); g.stroke();
    const [hx, hy] = P(ex, ey), ang = Math.atan2(uy, ux); g.fillStyle = line; g.beginPath(); g.moveTo(hx + Math.cos(ang) * 9, hy + Math.sin(ang) * 9); g.lineTo(hx + Math.cos(ang + 2.5) * 8, hy + Math.sin(ang + 2.5) * 8); g.lineTo(hx + Math.cos(ang - 2.5) * 8, hy + Math.sin(ang - 2.5) * 8); g.fill();
    g.strokeStyle = red; g.lineWidth = 2; g.beginPath(); g.arc(...P(p.x + ux * 60, p.y + uy * 60), 6 * K + 2, 0, TAU); g.stroke();
    // a small curved sweep beside the arrow
    const nx = -uy, ny = ux; g.strokeStyle = line; g.lineWidth = 1.2; g.beginPath(); g.moveTo(...P(sxp + nx * 22, syp + ny * 22)); g.quadraticCurveTo(...P(p.x + ux * 120 + nx * 34, p.y + uy * 120 + ny * 34), ...P(ex - ux * 6 + nx * 8, ey - uy * 6 + ny * 8)); g.stroke();
    g.beginPath(); g.moveTo(...P(sxp - nx * 22, syp - ny * 22)); g.quadraticCurveTo(...P(p.x + ux * 120 - nx * 34, p.y + uy * 120 - ny * 34), ...P(ex - ux * 6 - nx * 8, ey - uy * 6 - ny * 8)); g.stroke();
  }
  // light: a soft warm sheen, and the rail's shadow along the edges
  let l = g.createRadialGradient(ix + PLAY * 0.28, iy + PLAY * 0.22, 20, ix + PLAY * 0.28, iy + PLAY * 0.22, PLAY * 0.95); l.addColorStop(0, 'rgba(255,248,220,0.32)'); l.addColorStop(0.6, 'rgba(255,240,200,0.04)'); l.addColorStop(1, 'rgba(70,30,0,0.16)');
  g.fillStyle = l; g.fillRect(ix, iy, PLAY, PLAY);
  for (const [x0, y0, x1, y1] of [[ix, iy, ix + PLAY, iy], [ix, iy + PLAY, ix + PLAY, iy + PLAY], [ix, iy, ix, iy + PLAY], [ix + PLAY, iy, ix + PLAY, iy + PLAY]]) {
    const gg = g.createLinearGradient(x0, y0, x0 + (x1 === x0 ? (x0 === ix ? 22 : -22) : 0), y0 + (y1 === y0 ? (y0 === iy ? 22 : -22) : 0)); gg.addColorStop(0, 'rgba(50,20,0,0.34)'); gg.addColorStop(1, 'rgba(50,20,0,0)');
    g.fillStyle = gg; g.fillRect(Math.min(x0, x1) - (x1 === x0 && x0 !== ix ? 22 : 0), Math.min(y0, y1) - (y1 === y0 && y0 !== iy ? 22 : 0), x1 === x0 ? 22 : PLAY, y1 === y0 ? 22 : PLAY);
  }
  // powder: fine white dust, denser near the middle where strokes pass, plus faint sweep marks
  const pr = lcg(77);
  for (let i = 0; i < 1500; i++) { const x = ix + pr() * PLAY, y = iy + pr() * PLAY; g.fillStyle = `rgba(255,252,240,${0.05 + pr() * 0.16})`; g.beginPath(); g.arc(x, y, 0.4 + pr() * 1.0, 0, TAU); g.fill(); }
  for (let i = 0; i < 26; i++) { const x = ix + 40 + pr() * (PLAY - 80), y = iy + 40 + pr() * (PLAY - 80), a = pr() * TAU, len = 30 + pr() * 90; g.strokeStyle = `rgba(255,252,238,${0.02 + pr() * 0.03})`; g.lineWidth = 2 + pr() * 3; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + 10, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke(); }
  // pockets: a dark bag with a net, a thin brass rim
  for (const p of POCKETS) {
    const [px, py] = P(p.x, p.y), R = R_POCKET * K;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 10; g.fillStyle = '#000'; g.beginPath(); g.arc(px, py, R + 2, 0, TAU); g.fill(); g.restore();
    const gr = g.createRadialGradient(px - R * 0.2, py - R * 0.25, 1, px, py, R); gr.addColorStop(0, '#1b120c'); gr.addColorStop(0.75, '#060302'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.beginPath(); g.arc(px, py, R, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(px, py, R - 1, 0, TAU); g.clip(); g.strokeStyle = 'rgba(214,190,146,0.32)'; g.lineWidth = 0.9;
    for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(px - R + i * 5, py - R); g.lineTo(px + R + i * 5, py + R); g.stroke(); g.beginPath(); g.moveTo(px - R + i * 5, py + R); g.lineTo(px + R + i * 5, py - R); g.stroke(); }
    const sh = g.createRadialGradient(px, py, R * 0.2, px, py, R); sh.addColorStop(0, 'rgba(0,0,0,0.85)'); sh.addColorStop(1, 'rgba(0,0,0,0.05)'); g.fillStyle = sh; g.fillRect(px - R, py - R, 2 * R, 2 * R);
    g.restore();
    g.strokeStyle = 'rgba(210,166,86,0.95)'; g.lineWidth = 2.6; g.beginPath(); g.arc(px, py, R, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,238,190,0.6)'; g.lineWidth = 1; g.beginPath(); g.arc(px, py, R - 1.6, Math.PI * 0.95, Math.PI * 1.65); g.stroke();
  }
}

const layers = {};
export function drawTable(ctx) {
  if (!layers.table && layers.table !== 0) layers.table = mk(W, H, 2, paintTable) || 0;
  if (layers.table) ctx.drawImage(layers.table, 0, 0, W, H); else paintTable(ctx);
}
export function drawBoardOnly(ctx, theme = 'plywood') {
  if (!(theme in layers)) layers[theme] = mk(W, H, 2, (g) => paintBoard(g, theme)) || 0;
  if (layers[theme]) ctx.drawImage(layers[theme], 0, 0, W, H); else paintBoard(ctx, theme);
}
export function drawBoard(ctx, theme = 'plywood') { drawTable(ctx); drawBoardOnly(ctx, theme); }

// --- pieces -----------------------------------------------------------------------------------------------
const SC = 3, sprites = {};
const TONES = {
  W: { hi: '#fffaf0', mid: '#eadcbc', lo: '#b8a47a', edge: '#8d7a54', ring: 'rgba(120,96,58,0.55)', face: ['#fbf3df', '#e3d3ac'] },
  B: { hi: '#6a6a74', mid: '#25252b', lo: '#08080a', edge: '#000', ring: 'rgba(0,0,0,0.6)', face: ['#3b3b44', '#111114'] },
  Q: { hi: '#ff8a7a', mid: '#cc2a2c', lo: '#6d0c12', edge: '#4a070c', ring: 'rgba(60,0,4,0.5)', face: ['#e2413f', '#a01820'] },
};
function paintDisc(g, k, R) {
  const t = TONES[k];
  // thickness: a darker disc a little lower, then the top face
  g.fillStyle = t.edge; g.beginPath(); g.arc(0, 1.6, R, 0, TAU); g.fill();
  let gr = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.15); gr.addColorStop(0, t.hi); gr.addColorStop(0.5, t.mid); gr.addColorStop(1, t.lo);
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
  // bevel band
  gr = g.createLinearGradient(-R, -R, R, R); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.strokeStyle = gr; g.lineWidth = R * 0.16; g.beginPath(); g.arc(0, 0, R * 0.92, 0, TAU); g.stroke();
  // inner face
  gr = g.createLinearGradient(-R * 0.6, -R * 0.7, R * 0.6, R * 0.7); gr.addColorStop(0, t.face[0]); gr.addColorStop(1, t.face[1]);
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.68, 0, TAU); g.fill();
  g.strokeStyle = t.ring; g.lineWidth = R * 0.05; g.beginPath(); g.arc(0, 0, R * 0.68, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = R * 0.03; g.beginPath(); g.arc(0, 0, R * 0.62, Math.PI * 0.85, Math.PI * 1.7); g.stroke();
  // engraved rosette
  g.strokeStyle = t.ring; g.lineWidth = R * 0.045;
  for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * TAU / 8); g.beginPath(); g.moveTo(R * 0.12, 0); g.quadraticCurveTo(R * 0.3, -R * 0.13, R * 0.5, 0); g.quadraticCurveTo(R * 0.3, R * 0.13, R * 0.12, 0); g.stroke(); g.restore(); }
  if (k === 'Q') { g.fillStyle = 'rgba(255,220,200,0.35)'; g.beginPath(); g.arc(0, 0, R * 0.1, 0, TAU); g.fill(); }
  // specular
  gr = g.createRadialGradient(-R * 0.38, -R * 0.42, 0, -R * 0.38, -R * 0.42, R * 0.55); gr.addColorStop(0, k === 'B' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(-R * 0.36, -R * 0.4, R * 0.5, R * 0.32, -0.7, 0, TAU); g.fill();
  // reflection of the room: a cool bounce along the lower edge
  gr = g.createLinearGradient(0, R * 0.4, 0, R); gr.addColorStop(0, 'rgba(255,190,120,0)'); gr.addColorStop(1, k === 'W' ? 'rgba(255,170,90,0.22)' : 'rgba(255,190,120,0.3)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.9, 0.15, Math.PI - 0.15); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = R * 0.03; g.beginPath(); g.arc(0, 0, R * 0.97, Math.PI * 1.05, Math.PI * 1.55); g.stroke();
}
function paintStriker(g, R) {
  g.fillStyle = '#3a2a10'; g.beginPath(); g.arc(0, 2.2, R, 0, TAU); g.fill();
  // steel weight ring
  let gr = g.createLinearGradient(-R, -R, R, R); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, '#c9ced6'); gr.addColorStop(0.6, '#7b828e'); gr.addColorStop(1, '#3d434d');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = R * 0.05; g.beginPath(); g.arc(0, 0, R * 0.95, Math.PI * 0.95, Math.PI * 1.7); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = R * 0.05; g.beginPath(); g.arc(0, 0, R * 0.95, -0.2, Math.PI * 0.75); g.stroke();
  // amber acrylic face
  gr = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.05, 0, 0, R * 0.8); gr.addColorStop(0, '#ffe7a3'); gr.addColorStop(0.55, '#e5a23a'); gr.addColorStop(1, '#8e4f12');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.74, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(70,30,0,0.5)'; g.lineWidth = R * 0.05; g.beginPath(); g.arc(0, 0, R * 0.74, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = R * 0.04; g.beginPath(); g.arc(0, 0, R * 0.5, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(90,40,0,0.5)'; g.lineWidth = R * 0.05;
  for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * TAU / 6); g.beginPath(); g.moveTo(R * 0.1, 0); g.lineTo(R * 0.46, 0); g.stroke(); g.restore(); }
  gr = g.createRadialGradient(-R * 0.35, -R * 0.4, 0, -R * 0.35, -R * 0.4, R * 0.55); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(-R * 0.34, -R * 0.38, R * 0.48, R * 0.3, -0.7, 0, TAU); g.fill();
}
// a soft round shadow, painted once and scaled per use
function paintShadow(g, R) { const gr = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.35); gr.addColorStop(0, 'rgba(20,8,0,0.55)'); gr.addColorStop(0.65, 'rgba(20,8,0,0.28)'); gr.addColorStop(1, 'rgba(20,8,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 1.35, 0, TAU); g.fill(); }

export function sprite(k) {
  if (k in sprites) return sprites[k];
  const R = (k === 'S' ? R_STR : R_COIN) * K, pad = 4, size = (R + pad) * 2;
  sprites[k] = mk(size, size, SC, (g) => { g.translate(size / 2, size / 2); if (k === 'S') paintStriker(g, R); else if (k === 'sh') paintShadow(g, R); else paintDisc(g, k, R); }) || 0;
  return sprites[k];
}
export function shadowSprite(k) {
  const key = 'sh' + k; if (key in sprites) return sprites[key];
  const R = (k === 'S' ? R_STR : R_COIN) * K, size = (R * 1.4 + 2) * 2;
  sprites[key] = mk(size, size, 2, (g) => { g.translate(size / 2, size / 2); paintShadow(g, R); }) || 0; return sprites[key];
}

// Draw a piece centred at screen (x, y) with radius scale s and lift (0..1, raises it above the shadow).
export function drawPiece(ctx, k, x, y, s = 1, lift = 0, alpha = 1) {
  const R = (k === 'S' ? R_STR : R_COIN) * K * s;
  const sh = shadowSprite(k), sp = sprite(k), so = 2.6 + lift * 9;
  ctx.globalAlpha = alpha;
  if (sh) { const sz = (R * 1.4 + 2 * s) * 2; ctx.globalAlpha = alpha * (1 - lift * 0.4); ctx.drawImage(sh, x - sz / 2 + so * 0.6, y - sz / 2 + so, sz, sz); ctx.globalAlpha = alpha; }
  else { ctx.fillStyle = 'rgba(20,8,0,0.35)'; ctx.beginPath(); ctx.arc(x + so * 0.6, y + so, R, 0, TAU); ctx.fill(); }
  const dy = -lift * 6;
  if (sp) { const sz = (R / ((k === 'S' ? R_STR : R_COIN) * K) * ((k === 'S' ? R_STR : R_COIN) * K + 4)) * 2; ctx.drawImage(sp, x - sz / 2, y - sz / 2 + dy, sz, sz); }
  else { ctx.fillStyle = k === 'W' ? '#eee' : k === 'B' ? '#222' : k === 'Q' ? '#c22' : '#e5a23a'; ctx.beginPath(); ctx.arc(x, y + dy, R, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
}
