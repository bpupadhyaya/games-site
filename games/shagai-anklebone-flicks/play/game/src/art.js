// Static art: the steppe, the winding felt trail with its special stations, the felt mat, the ankle bones with their four
// engraved sides and the riders' bone-horses. Everything heavy is painted ONCE into an OffscreenCanvas layer (or sprite)
// and only blitted per frame. No text is baked in (fonts may still be loading): labels are drawn live by view.js.
import { W, H, PATH_LEN, STEP, TRAY, pathPoint, stationXY } from './layout.js';
import { FINISH, TILES } from './rules.js';

export const RIDER = ['#2f86d6', '#d9432f', '#e8a823', '#3fa05a'];
export const RIDER_LIGHT = ['#8cc4f5', '#f59a8a', '#ffd877', '#8fdba5'];
export const RIDER_DARK = ['#17497f', '#7d1f14', '#8a5b05', '#1c5a30'];
export const FACE_COL = ['#a8451f', '#9a6a12', '#2f5f93', '#2f7a45']; // engraving colours: horse, camel, sheep, goat
export const INK = '#2a1b12', ACC = '#8a1f26';
const TAU = Math.PI * 2;

export function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
export function mix(hex, to, f) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = (s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// ---- cached layers and sprites ------------------------------------------------------------------------------------------
// A layer is painted once into an OffscreenCanvas covering `rect` (canonical units) and blitted per frame. Scenery layers are
// keyed by screen size (so any aspect ratio gets a full-bleed backdrop) and only the last few are kept.
const layers = {};
function layer(key, rect, paint, ss = 2) {
  let L = layers[key];
  if (L === undefined) {
    L = null;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const k = Math.min(ss, Math.sqrt(4.6e6 / (rect.w * rect.h))), c = new OffscreenCanvas(Math.ceil(rect.w * k), Math.ceil(rect.h * k)), lc = c.getContext('2d');
        lc.scale(k, k); lc.translate(-rect.x, -rect.y); paint(lc, k); L = c;
      }
    } catch { L = null; }
    layers[key] = L;
  }
  return L;
}
const SS = 3, sprites = {};
function sprite(key, w, h, paint) {
  if (sprites[key] !== undefined) return sprites[key];
  let c = null;
  try { if (typeof OffscreenCanvas !== 'undefined') { const oc = new OffscreenCanvas(w * SS, h * SS), x = oc.getContext('2d'); x.scale(SS, SS); paint(x); c = oc; } } catch { c = null; }
  return (sprites[key] = c);
}

// ---- ornament: a band of paired ram-horn scrolls --------------------------------------------------------------------------
function spiral(ctx, cx, cy, r, dir, turns = 1.55) {
  ctx.beginPath();
  const n = 26;
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * turns * TAU, rad = r * (0.18 + 0.82 * (1 - k / n)), a = dir * t + (dir > 0 ? 0 : Math.PI);
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
function scrollRow(ctx, x, y, w, size, color, lw = 2.4) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const unit = size * 3.1, n = Math.max(1, Math.round(w / unit)), u = w / n;
  for (let k = 0; k < n; k++) {
    const cx = x + u * (k + 0.5);
    spiral(ctx, cx - size * 0.95, y, size, 1); spiral(ctx, cx + size * 0.95, y, size, -1);
    ctx.beginPath(); ctx.moveTo(cx - size * 0.95, y + size * 0.82); ctx.quadraticCurveTo(cx, y + size * 1.25, cx + size * 0.95, y + size * 0.82); ctx.stroke();
  }
  ctx.restore();
}
function scrollFrame(ctx, x, y, w, h, band, bg, fg, size = 8) {
  ctx.save(); rr(ctx, x, y, w, h, 22); ctx.clip();
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  scrollRow(ctx, x + 8, y + band / 2, w - 16, size, fg); scrollRow(ctx, x + 8, y + h - band / 2, w - 16, size, fg);
  ctx.save(); ctx.translate(x + band / 2, y + h / 2); ctx.rotate(-Math.PI / 2); scrollRow(ctx, -h / 2 + 8, 0, h - 16, size, fg); ctx.restore();
  ctx.save(); ctx.translate(x + w - band / 2, y + h / 2); ctx.rotate(Math.PI / 2); scrollRow(ctx, -h / 2 + 8, 0, h - 16, size, fg); ctx.restore();
  ctx.restore();
}

// ---- the steppe backdrop (sky, hills, gers, grass) -----------------------------------------------------------------------------
const HORIZON = 196;
let CW = W, CH = H;   // the size being painted (the scenery fills any screen)
function ger(ctx, x, y, s, door = '#9d2f2a') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(2, 2, 40, 6, 0, 0, TAU); ctx.fill();
  let g = ctx.createLinearGradient(-34, 0, 34, 0); g.addColorStop(0, '#d9ccb0'); g.addColorStop(0.45, '#fff8e6'); g.addColorStop(1, '#b9a98a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-34, -20); ctx.lineTo(34, -20); ctx.lineTo(34, 0); ctx.closePath(); ctx.fill();
  g = ctx.createLinearGradient(-34, -44, 34, -18); g.addColorStop(0, '#f3ead2'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#c6b794');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-38, -19); ctx.quadraticCurveTo(0, -62, 38, -19); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = door; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-36, -18); ctx.lineTo(36, -18); ctx.stroke();
  ctx.fillStyle = door; ctx.beginPath(); ctx.roundRect(-7, -17, 14, 17, [5, 5, 0, 0]); ctx.fill();
  ctx.strokeStyle = 'rgba(120,90,50,0.45)'; ctx.lineWidth = 1; for (const px of [-22, 22]) { ctx.beginPath(); ctx.moveTo(px, -19); ctx.lineTo(px, 0); ctx.stroke(); }
  ctx.restore();
}
function paintSky(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 30);
  g.addColorStop(0, '#0d3a80'); g.addColorStop(0.5, '#2f7fc8'); g.addColorStop(0.85, '#9cc7e6'); g.addColorStop(1, '#f6d9a4');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, HORIZON + 40);
  const SX = CW * 0.78;
  const sun = ctx.createRadialGradient(SX, 150, 6, SX, 150, 190); sun.addColorStop(0, 'rgba(255,248,214,0.95)'); sun.addColorStop(0.2, 'rgba(255,224,150,0.55)'); sun.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, CW, HORIZON + 40);
  ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(SX, 150, 22, 0, TAU); ctx.fill();
  const r = lcg(11);
  for (let k = 0; k < Math.round(7 * CW / 720); k++) {
    const cx = r() * CW, cy = 70 + r() * 90, w = 90 + r() * 120;
    ctx.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.12})`;
    for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.ellipse(cx + (q - 1.5) * w * 0.24, cy + Math.sin(q * 2) * 5, w * 0.26, 12 + r() * 6, 0, 0, TAU); ctx.fill(); }
  }
  const ridge = (base, amp, col, seed, step) => {
    const q = lcg(seed); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, HORIZON + 10);
    let y = base; for (let x = 0; x <= CW + step; x += step) { y = base - amp * (0.25 + 0.75 * q()); ctx.lineTo(x, y); }
    ctx.lineTo(CW, HORIZON + 10); ctx.closePath(); ctx.fill();
  };
  ridge(HORIZON - 34, 34, '#6d8fb6', 5, 60); ridge(HORIZON - 14, 22, '#4f7b6a', 9, 44); ridge(HORIZON + 2, 12, '#6f8d4a', 21, 30);
}
function paintGers(ctx) {
  const gx = (x) => x * CW / 720;
  ger(ctx, gx(112), HORIZON + 34, 0.8); ger(ctx, gx(176), HORIZON + 40, 0.6, '#2f86d6'); ger(ctx, gx(628), HORIZON + 36, 0.74);
  if (CW > 900) { ger(ctx, gx(330), HORIZON + 38, 0.66, '#d9432f'); ger(ctx, gx(430), HORIZON + 42, 0.52); }
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(gx(128), HORIZON - 12); ctx.quadraticCurveTo(gx(138), HORIZON - 30, gx(126), HORIZON - 46); ctx.stroke();
}
function paintField(ctx) {
  const r = lcg(3);
  const g = ctx.createLinearGradient(0, HORIZON, 0, CH);
  g.addColorStop(0, '#9bb85a'); g.addColorStop(0.3, '#b3ba62'); g.addColorStop(0.62, '#a39a52'); g.addColorStop(1, '#4b4226');
  ctx.fillStyle = g; ctx.fillRect(0, HORIZON, CW, CH - HORIZON);
  const area = CW * (CH - HORIZON) / (720 * 1364);
  for (let k = 0; k < Math.round(14 * area); k++) { // soft patches of fresher and drier grass
    const x = r() * CW, y = HORIZON + r() * (CH - HORIZON) * 0.6, rad = 70 + r() * 150;
    const pg = ctx.createRadialGradient(x, y, 4, x, y, rad); const fresh = r() < 0.5;
    pg.addColorStop(0, fresh ? 'rgba(120,170,70,0.22)' : 'rgba(210,180,100,0.2)'); pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let k = 0; k < Math.round(4200 * area); k++) {
    const x = r() * CW, y = HORIZON + 6 + r() * (CH - HORIZON), l = 5 + r() * 9, a = -Math.PI / 2 + (r() - 0.5) * 0.9;
    ctx.strokeStyle = r() < 0.5 ? 'rgba(60,90,30,0.30)' : 'rgba(235,225,150,0.26)'; ctx.lineWidth = 1 + r() * 0.9;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  const fl = ['#fffbe8', '#ffe27a', '#d7a8ff', '#ffb0b0'];
  for (let k = 0; k < Math.round(170 * area); k++) { ctx.fillStyle = fl[k % 4]; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(r() * CW, HORIZON + 20 + r() * (CH - HORIZON) * 0.56, 1.4 + r() * 1.6, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  const vr = Math.max(CW * 0.7, CH * 0.64), v = ctx.createRadialGradient(CW / 2, CH * 0.45, vr * 0.38, CW / 2, CH * 0.49, vr); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,6,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, HORIZON, CW, CH - HORIZON);
}

// ---- the winding trail -------------------------------------------------------------------------------------------------------------
function strokePath(ctx, width, color, dx = 0, dy = 0) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  for (let s = -STEP * 0.6; s <= PATH_LEN + STEP * 0.6; s += 7) { const p = pathPoint(s); if (s < -STEP * 0.6 + 1) ctx.moveTo(p.x + dx, p.y + dy); else ctx.lineTo(p.x + dx, p.y + dy); }
  ctx.stroke();
}
export function drawTileIcon(ctx, kind, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const patch = (c1, c2) => { const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, 20); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.stroke(); };
  if (kind === 'wind') {
    patch('#8fd0ff', '#2f86d6');
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const dy of [-6, 6]) { ctx.beginPath(); ctx.moveTo(-11, dy); ctx.lineTo(8, dy); ctx.arc(8, dy - 3.5, 3.5, Math.PI / 2, -Math.PI * 0.9, true); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(12, 0); ctx.stroke();
  } else if (kind === 'burrow') {
    patch('#9a7a52', '#4b3320');
    ctx.fillStyle = '#1a0f08'; ctx.beginPath(); ctx.ellipse(0, 3, 10, 7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,180,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 3, 10, 7, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.fillStyle = '#e9d3a6'; ctx.beginPath(); ctx.arc(-9, -9, 2.2, 0, TAU); ctx.arc(9, -8, 1.8, 0, TAU); ctx.arc(2, -12, 1.6, 0, TAU); ctx.fill();
  } else if (kind === 'stream') {
    patch('#7fd6e8', '#1f6fb0');
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const dy of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(-12, dy); ctx.quadraticCurveTo(-6, dy - 5, 0, dy); ctx.quadraticCurveTo(6, dy + 5, 12, dy); ctx.stroke(); }
  } else if (kind === 'camp') {
    patch('#ffe7a8', '#d79a3a');
    const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 12); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e2d4b2');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill(); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fillStyle = '#6b4a2a'; ctx.fill();
    for (let a = 0; a < 8; a++) { ctx.beginPath(); ctx.moveTo(Math.cos(a * TAU / 8) * 3.4, Math.sin(a * TAU / 8) * 3.4); ctx.lineTo(Math.cos(a * TAU / 8) * 11, Math.sin(a * TAU / 8) * 11); ctx.stroke(); }
    ctx.fillStyle = '#9d2f2a'; ctx.beginPath(); ctx.roundRect(-3, 9, 6, 6, 1.5); ctx.fill();
  }
  ctx.restore();
}
function paintTrail(ctx) {
  const r = lcg(17);
  strokePath(ctx, 62, 'rgba(20,12,2,0.28)', 0, 5);
  strokePath(ctx, 56, '#6a4a28'); strokePath(ctx, 50, '#c9a96c'); strokePath(ctx, 42, '#dcc58c'); strokePath(ctx, 24, 'rgba(240,226,176,0.65)');
  for (let k = 0; k < 900; k++) { // dust and pebbles
    const p = pathPoint(r() * PATH_LEN), nx = -Math.sin(p.ang), ny = Math.cos(p.ang), o = (r() - 0.5) * 40;
    ctx.fillStyle = r() < 0.5 ? 'rgba(120,85,40,0.35)' : 'rgba(255,245,210,0.4)'; ctx.fillRect(p.x + nx * o, p.y + ny * o, 1.8, 1.8);
  }
  for (let i = 1; i < FINISH; i++) { // station stamps
    const p = stationXY(i);
    if (TILES[i]) continue;
    ctx.fillStyle = 'rgba(110,76,36,0.16)'; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(110,76,36,0.5)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,248,220,0.5)'; ctx.beginPath(); ctx.arc(p.x, p.y + 1.4, 16, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
  }
  for (const [i, kind] of Object.entries(TILES)) { const p = stationXY(Number(i)); ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2; drawTileIcon(ctx, kind, p.x, p.y, 1); ctx.restore(); }
  // start line
  const s0 = stationXY(0);
  ctx.fillStyle = '#fff8e6'; ctx.fillRect(s0.x - 5, s0.y - 31, 10, 62);
  ctx.fillStyle = '#9d2f2a'; for (let k = 0; k < 4; k++) ctx.fillRect(s0.x - 5, s0.y - 31 + k * 16 + 4, 10, 8);
  // finish: a chequered band between two posts
  const f = stationXY(FINISH);
  for (let row = 0; row < 6; row++) for (let col = 0; col < 2; col++) { ctx.fillStyle = (row + col) % 2 ? '#1c1410' : '#fff8e6'; ctx.fillRect(f.x - 4 + col * 10 - 6, f.y - 30 + row * 10, 10, 10); }
  for (const dy of [-36, 36]) {
    ctx.fillStyle = '#5b3a1c'; ctx.beginPath(); ctx.roundRect(f.x - 4, f.y + dy - 5, 8, 10, 3); ctx.fill();
  }
  ctx.fillStyle = '#e8a823'; ctx.beginPath(); ctx.moveTo(f.x + 4, f.y - 40); ctx.lineTo(f.x + 26, f.y - 33); ctx.lineTo(f.x + 4, f.y - 26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d9432f'; ctx.beginPath(); ctx.moveTo(f.x + 4, f.y + 26); ctx.lineTo(f.x + 26, f.y + 33); ctx.lineTo(f.x + 4, f.y + 40); ctx.closePath(); ctx.fill();
}

// ---- the felt mat ----------------------------------------------------------------------------------------------------------------------
function paintMat(ctx) {
  const { x, y, w, h } = TRAY, r = lcg(23);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12; rr(ctx, x, y, w, h, 22); ctx.fillStyle = '#10264a'; ctx.fill(); ctx.restore();
  scrollFrame(ctx, x, y, w, h, 34, '#8f2a26', '#f1d79a', 8);
  const ix = x + 36, iy = y + 36, iw = w - 72, ih = h - 72;
  ctx.save(); rr(ctx, ix, iy, iw, ih, 12); ctx.clip();
  const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 20, x + w / 2, y + h / 2, w * 0.6); g.addColorStop(0, '#2f6fb5'); g.addColorStop(1, '#173f78');
  ctx.fillStyle = g; ctx.fillRect(ix, iy, iw, ih);
  for (let k = 0; k < 1600; k++) { const px = ix + r() * iw, py = iy + r() * ih, a = r() * TAU, l = 3 + r() * 5; ctx.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,10,40,0.16)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(241,215,154,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]); rr(ctx, ix + 5, iy + 5, iw - 10, ih - 10, 9); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, x, y, w, h, 22); ctx.stroke();
}

// Full-bleed steppe for a screen of w x h virtual units (cached per size, last 4 sizes kept).
const sceneKeys = [];
export function drawScenery(ctx, w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `scenery|${w}x${h}`, paint = (c) => { CW = w; CH = h; paintSky(c); paintField(c); paintGers(c); };
  if (layers[key] === undefined) { sceneKeys.push(key); if (sceneKeys.length > 4) delete layers[sceneKeys.shift()]; }
  const L = layer(key, { x: 0, y: 0, w, h }, paint);
  if (L) ctx.drawImage(L, 0, 0, w, h); else paint(ctx);
}
// The trail and the mat are transparent layers in canonical coordinates, drawn inside their band transform.
const TRAIL_RECT = { x: 10, y: 270, w: 700, h: 660 }, MAT_RECT = { x: 0, y: 972, w: 720, h: 370 };
export function drawTrail(ctx) { const L = layer('trail', TRAIL_RECT, paintTrail); if (L) ctx.drawImage(L, TRAIL_RECT.x, TRAIL_RECT.y, TRAIL_RECT.w, TRAIL_RECT.h); else paintTrail(ctx); }
export function drawMat(ctx) { const L = layer('mat', MAT_RECT, paintMat); if (L) ctx.drawImage(L, MAT_RECT.x, MAT_RECT.y, MAT_RECT.w, MAT_RECT.h); else paintMat(ctx); }

// a cream felt card with a scroll border (every text screen)
// The panel (shadow + scroll-border frame + felt) is painted once per size into a cached layer and blitted per frame; only the last few sizes are kept.
const panelKeys = [];
export const artStats = { panelPaints: 0 };   // how often a panel was actually painted (tests read it)
export function drawPanel(ctx, x, y, w, h) {
  const key = `panel|${x}|${y}|${w}|${h}`, M = 70, rect = { x: x - M, y: y - M, w: w + 2 * M, h: h + 2 * M };
  if (!(key in layers) && panelKeys.length >= 8) delete layers[panelKeys.shift()];
  const had = key in layers, L = layer(key, rect, (c, k) => paintPanel(c, x, y, w, h, k));
  if (!had) panelKeys.push(key);
  if (L) ctx.drawImage(L, rect.x, rect.y, rect.w, rect.h); else paintPanel(ctx, x, y, w, h);
}
function paintPanel(ctx, x, y, w, h, k = 1) {
  artStats.panelPaints++;   // k: the layer's pixel scale (shadow blur/offset are in canvas pixels, not units)
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 28 * k; ctx.shadowOffsetY = 12 * k; rr(ctx, x, y, w, h, 24); ctx.fillStyle = '#10264a'; ctx.fill(); ctx.restore();
  scrollFrame(ctx, x, y, w, h, 30, '#1f4f8f', '#f1d79a', 7);
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#fff6dc'); g.addColorStop(1, '#efdfb4');
  rr(ctx, x + 30, y + 30, w - 60, h - 60, 12); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#c9a85a'; ctx.lineWidth = 2; rr(ctx, x + 30, y + 30, w - 60, h - 60, 12); ctx.stroke();
}

// ---- the four engraved sides (unit box, +-1) -----------------------------------------------------------------------------------
function poly(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
export function faceIconPath(ctx, face) {
  if (face === 0) { // horse: head in profile with ears and a mane
    poly(ctx, [[-0.62, 0.95], [-0.55, -0.25], [-0.4, -0.72], [-0.3, -1.02], [-0.12, -0.72], [0.3, -0.5], [0.78, 0.05], [0.95, 0.3], [0.88, 0.52], [0.52, 0.5], [0.32, 0.72], [0.2, 0.95]]);
  } else if (face === 1) { // camel: two humps, long neck, head, four legs
    ctx.beginPath();
    ctx.moveTo(0.6, 0.12); ctx.ellipse(-0.1, 0.12, 0.7, 0.34, 0, 0, TAU);
    for (const [x, y, r] of [[-0.42, -0.2, 0.27], [0.06, -0.24, 0.27]]) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
    ctx.moveTo(0.42, 0.0); ctx.lineTo(0.64, -0.06); ctx.lineTo(0.9, -0.72); ctx.lineTo(0.68, -0.8); ctx.closePath();
    ctx.moveTo(1.04, -0.8); ctx.ellipse(0.86, -0.82, 0.22, 0.14, 0.3, 0, TAU);
    for (const x of [-0.68, -0.4, 0.14, 0.42]) { ctx.rect(x, 0.3, 0.14, 0.6); }
  } else if (face === 2) { // sheep: woolly body and a small head
    ctx.beginPath();
    for (const [x, y, r] of [[-0.45, -0.1, 0.42], [-0.05, -0.32, 0.46], [0.32, -0.12, 0.4], [-0.3, 0.28, 0.4], [0.1, 0.34, 0.4]]) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  } else { // goat: face with swept-back horns and a beard
    poly(ctx, [[-0.4, -0.35], [0.4, -0.35], [0.46, 0.15], [0.18, 0.55], [0.0, 0.98], [-0.18, 0.55], [-0.46, 0.15]]);
    ctx.moveTo(-0.38, -0.34); ctx.quadraticCurveTo(-0.95, -0.55, -0.9, -1.0); ctx.quadraticCurveTo(-0.72, -0.62, -0.2, -0.45); ctx.closePath();
    ctx.moveTo(0.38, -0.34); ctx.quadraticCurveTo(0.95, -0.55, 0.9, -1.0); ctx.quadraticCurveTo(0.72, -0.62, 0.2, -0.45); ctx.closePath();
  }
}
// draws the engraved icon at (x, y), size s (half-width), in a colour, with a light lower edge so it looks cut into the bone
export function drawFaceIcon(ctx, face, x, y, s, col, engraved = true) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (engraved) { ctx.save(); ctx.translate(0.05, 0.07); faceIconPath(ctx, face); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill('nonzero'); ctx.restore(); }
  faceIconPath(ctx, face); ctx.fillStyle = col; ctx.fill('nonzero');
  ctx.fillStyle = '#f6edd2';
  if (face === 0) { ctx.beginPath(); ctx.arc(0.34, -0.1, 0.07, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f6edd2'; ctx.lineWidth = 0.07; ctx.lineCap = 'round'; for (const k of [0, 1, 2]) { ctx.beginPath(); ctx.moveTo(-0.5 + k * 0.05, -0.2 + k * 0.28); ctx.lineTo(-0.2 + k * 0.05, -0.05 + k * 0.28); ctx.stroke(); } }
  if (face === 2) { ctx.beginPath(); ctx.ellipse(0.62, -0.05, 0.2, 0.26, 0, 0, TAU); ctx.fillStyle = mix(col, '#000000', 0.45); ctx.fill(); }
  if (face === 3) { ctx.beginPath(); ctx.arc(-0.16, -0.12, 0.07, 0, TAU); ctx.arc(0.16, -0.12, 0.07, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---- the ankle bone (cached sprite per side) -------------------------------------------------------------------------------
export const BONE = { w: 140, h: 104, hw: 54, hh: 36 };
function bonePath(ctx, k = 1) {
  const hw = BONE.hw * k, hh = BONE.hh * k, wst = 9 * k;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.62, -hh); ctx.bezierCurveTo(-hw * 0.2, -hh + wst, hw * 0.2, -hh + wst, hw * 0.62, -hh);
  ctx.bezierCurveTo(hw * 1.14, -hh, hw * 1.14, hh, hw * 0.62, hh);
  ctx.bezierCurveTo(hw * 0.2, hh - wst, -hw * 0.2, hh - wst, -hw * 0.62, hh);
  ctx.bezierCurveTo(-hw * 1.14, hh, -hw * 1.14, -hh, -hw * 0.62, -hh); ctx.closePath();
}
function paintBone(ctx, face) {
  ctx.translate(BONE.w / 2, BONE.h / 2);
  const g = ctx.createRadialGradient(-22, -18, 4, 0, 0, 70); g.addColorStop(0, '#fffdf4'); g.addColorStop(0.55, '#f1e6c8'); g.addColorStop(1, '#c8b58a');
  bonePath(ctx); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(90,60,25,0.75)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); bonePath(ctx, 0.9); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
  const r = lcg(41 + face * 7); ctx.save(); bonePath(ctx); ctx.clip();
  for (let k = 0; k < 120; k++) { ctx.fillStyle = r() < 0.5 ? 'rgba(120,90,40,0.16)' : 'rgba(255,255,255,0.3)'; ctx.fillRect((r() - 0.5) * 120, (r() - 0.5) * 80, 1.4, 1.4); }
  ctx.restore();
  // the inlay: a tinted oval with a fine rim, then the engraved animal
  ctx.beginPath(); ctx.ellipse(0, 0, 38, 28, 0, 0, TAU); ctx.fillStyle = mix(FACE_COL[face], '#ffffff', 0.78); ctx.fill();
  ctx.strokeStyle = mix(FACE_COL[face], '#ffffff', 0.35); ctx.lineWidth = 1.8; ctx.stroke();
  drawFaceIcon(ctx, face, 0, 1, 23, FACE_COL[face]);
  ctx.beginPath(); ctx.ellipse(-20, -21, 20, 6, -0.35, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
}
// draw a bone with its centre at (x, y): rotation, scale, lift (pixels above the mat) and a soft shadow
export function drawBone(ctx, face, x, y, rot = 0, k = 1, lift = 0, o = {}) {
  const { alpha = 1, glow = 0, hold = false } = o;
  ctx.save();
  ctx.globalAlpha = 0.4 * alpha / (1 + lift * 0.012); ctx.fillStyle = '#04122a';
  ctx.translate(x + 5 + lift * 0.25, y + 8 + lift * 0.55); ctx.rotate(rot); bonePath(ctx, k * 0.98); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y - lift); ctx.rotate(rot);
  if (hold || glow > 0) { ctx.save(); ctx.shadowColor = hold ? '#ffe27a' : '#ffd45a'; ctx.shadowBlur = hold ? 24 : 24 * glow; bonePath(ctx, k * 1.02); ctx.fillStyle = '#fff4c0'; ctx.fill(); ctx.restore(); }
  const sp = sprite('bone' + face, BONE.w, BONE.h, (c) => paintBone(c, face));
  if (sp) ctx.drawImage(sp, -BONE.w / 2 * k, -BONE.h / 2 * k, BONE.w * k, BONE.h * k);
  else { ctx.scale(k, k); ctx.translate(-BONE.w / 2, -BONE.h / 2); paintBone(ctx, face); }
  if (hold) { bonePath(ctx, k * 1.02); ctx.strokeStyle = '#ffd45a'; ctx.lineWidth = 4; ctx.stroke(); }
  ctx.restore();
}

// ---- a rider's bone-horse on the trail -----------------------------------------------------------------------------------------------
export const TOKEN = { w: 64, h: 54 };
function paintToken(ctx, i) {
  ctx.translate(TOKEN.w / 2, TOKEN.h / 2 + 2);
  const col = RIDER[i], lt = RIDER_LIGHT[i], dk = RIDER_DARK[i];
  ctx.save(); ctx.rotate(-0.18);
  const g = ctx.createRadialGradient(-10, -9, 2, 0, 0, 34); g.addColorStop(0, '#fffdf4'); g.addColorStop(0.6, '#eadfc0'); g.addColorStop(1, '#bfaa7c');
  bonePath(ctx, 0.5); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(80,55,22,0.8)'; ctx.lineWidth = 1.6; ctx.stroke();
  // saddle cloth in the rider's colour
  ctx.save(); bonePath(ctx, 0.5); ctx.clip();
  const sg = ctx.createLinearGradient(0, -18, 0, 18); sg.addColorStop(0, lt); sg.addColorStop(0.5, col); sg.addColorStop(1, dk);
  ctx.fillStyle = sg; ctx.fillRect(-11, -20, 22, 40); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-11, -20, 2, 40); ctx.fillRect(9, -20, 2, 40);
  ctx.restore(); ctx.restore();
  ctx.beginPath(); ctx.arc(-9, -9, 4, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
}
// the token stands with its foot at (x, y); the rider's number is drawn live by the caller
export function drawToken(ctx, i, x, y, k = 1, lift = 0, alpha = 1, num = true) {
  ctx.save();
  ctx.globalAlpha = 0.34 * alpha; ctx.fillStyle = '#140a04'; ctx.beginPath(); ctx.ellipse(x + 2, y + 3, 24 * k * (1 - lift * 0.004), 8 * k, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = alpha;
  const sp = sprite('token' + i, TOKEN.w, TOKEN.h, (c) => paintToken(c, i)), dx = x - TOKEN.w / 2 * k, dy = y - lift - TOKEN.h * 0.62 * k;
  if (sp) ctx.drawImage(sp, dx, dy, TOKEN.w * k, TOKEN.h * k); else { ctx.translate(dx, dy); ctx.scale(k, k); paintToken(ctx, i); }
  ctx.restore();
  if (num) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(17 * k)}px "Fredoka", system-ui, sans-serif`; ctx.fillStyle = '#fff'; ctx.shadowColor = RIDER_DARK[i]; ctx.shadowBlur = 4;
    ctx.fillText(String(i + 1), x - 1 * k, y - lift - TOKEN.h * 0.62 * k + TOKEN.h * 0.5 * k + 6 * k); ctx.restore();
  }
}
