// Art: the dartboard, the pub wall behind it and the darts. All procedural and deterministic. The board (with its sisal grain)
// is baked once into an OffscreenCanvas when the host has one and drawn directly otherwise (headless tests).
import { ORDER } from './engine.js';
import { BOARD, W, H } from './layout.js';

export const TAU = Math.PI * 2;
const SEG = Math.PI / 10;

// ---- offscreen surfaces ---------------------------------------------------------------------------
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
export const canBake = () => typeof OffscreenCanvas !== 'undefined' || hostDoc !== null;
export const newCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
};
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

// ---- geometry helpers -----------------------------------------------------------------------------
const pt = (cx, cy, r, a) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
function sector(ctx, cx, cy, r0, r1, a0, a1) {
  ctx.beginPath();
  ctx.arc(cx, cy, r1, a0 - Math.PI / 2, a1 - Math.PI / 2);
  ctx.arc(cx, cy, r0, a1 - Math.PI / 2, a0 - Math.PI / 2, true);
  ctx.closePath();
}
const mmR = (R, mm) => (mm / 170) * R;

// Add the outline of a target region (T20, D16, 20, Bull, 25) to the current path.
export function regionPath(ctx, label, cx, cy, R) {
  ctx.beginPath();
  if (label === 'Bull') { ctx.arc(cx, cy, mmR(R, 6.35), 0, TAU); return; }
  if (label === '25') { ctx.arc(cx, cy, mmR(R, 15.9), 0, TAU); ctx.arc(cx, cy, mmR(R, 6.35), 0, TAU, true); return; }
  const kind = label[0] === 'T' ? 'T' : label[0] === 'D' ? 'D' : 'S';
  const seg = kind === 'S' ? Number(label) : Number(label.slice(1));
  const i = ORDER.indexOf(seg), a0 = i * SEG - SEG / 2, a1 = i * SEG + SEG / 2;
  const r = (mm) => mmR(R, mm);
  const add = (ri, ro) => { ctx.moveTo(...pt(cx, cy, ro, a0)); ctx.arc(cx, cy, ro, a0 - Math.PI / 2, a1 - Math.PI / 2); ctx.arc(cx, cy, ri, a1 - Math.PI / 2, a0 - Math.PI / 2, true); ctx.closePath(); };
  if (kind === 'T') add(r(99), r(107));
  else if (kind === 'D') add(r(162), r(170));
  else { add(r(15.9), r(99)); add(r(107), r(162)); }
}

// ---- the board ------------------------------------------------------------------------------------
const COL = {
  black: '#1a1713', cream: '#eadfb9', red: '#c1282b', green: '#1f7b47', wire: '#cfd2d8', ring: '#14110e', brass: '#c9a24a', numbers: '#f3ecd8',
};
export function drawBoard(ctx, cx, cy, R, o = {}) {
  const r = (mm) => mmR(R, mm);
  const outer = R * 1.22;
  // drop shadow and the number ring
  ctx.save();
  if (o.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = R * 0.12; ctx.shadowOffsetY = R * 0.03; }
  ctx.fillStyle = COL.ring; ctx.beginPath(); ctx.arc(cx, cy, outer, 0, TAU); ctx.fill();
  ctx.restore();
  // segments
  for (let i = 0; i < 20; i++) {
    const a0 = i * SEG - SEG / 2, a1 = i * SEG + SEG / 2, even = i % 2 === 0;
    sector(ctx, cx, cy, r(15.9), r(99), a0, a1); ctx.fillStyle = even ? COL.black : COL.cream; ctx.fill();
    sector(ctx, cx, cy, r(99), r(107), a0, a1); ctx.fillStyle = even ? COL.red : COL.green; ctx.fill();
    sector(ctx, cx, cy, r(107), r(162), a0, a1); ctx.fillStyle = even ? COL.black : COL.cream; ctx.fill();
    sector(ctx, cx, cy, r(162), r(170), a0, a1); ctx.fillStyle = even ? COL.red : COL.green; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(cx, cy, r(15.9), 0, TAU); ctx.fillStyle = COL.green; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r(6.35), 0, TAU); ctx.fillStyle = COL.red; ctx.fill();
  // sisal grain, clipped to the board
  if (o.grain) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r(170), 0, TAU); ctx.clip();
    const rnd = lcg(77);
    for (let i = 0; i < 3400; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * r(170), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, ang = rnd() * TAU, len = 2 + rnd() * 5;
      ctx.strokeStyle = rnd() < 0.5 ? `rgba(0,0,0,${0.08 + rnd() * 0.1})` : `rgba(255,244,214,${0.05 + rnd() * 0.09})`;
      ctx.lineWidth = 0.8 + rnd() * 0.8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke();
    }
    ctx.restore();
  }
  // wires: a dark shadow line, then the bright wire
  const wires = (dx, dy, col, w) => {
    ctx.save(); ctx.translate(dx, dy); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    for (const mm of [6.35, 15.9, 99, 107, 162, 170]) { ctx.beginPath(); ctx.arc(cx, cy, r(mm), 0, TAU); ctx.stroke(); }
    ctx.beginPath();
    for (let i = 0; i < 20; i++) { const a = i * SEG + SEG / 2; ctx.moveTo(...pt(cx, cy, r(15.9), a)); ctx.lineTo(...pt(cx, cy, r(170), a)); }
    ctx.stroke(); ctx.restore();
  };
  const wk = Math.max(1, R / 170);
  wires(R * 0.004, R * 0.006, 'rgba(0,0,0,0.5)', 1.5 * wk);
  wires(0, 0, COL.wire, 1.1 * wk);
  // brass rim and numbers
  ctx.strokeStyle = COL.brass; ctx.lineWidth = Math.max(2, R * 0.018);
  ctx.beginPath(); ctx.arc(cx, cy, outer, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, outer - R * 0.012, 0, TAU); ctx.stroke();
  if (o.numbers !== false) {
    ctx.font = `800 ${Math.round(R * 0.125)}px 'Avenir Next Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = COL.numbers;
    ORDER.forEach((n, i) => { const [x, y] = pt(cx, cy, R * 1.105, i * SEG); ctx.fillText(String(n), x, y + R * 0.005); });
  }
  // lighting
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.45, R * 0.1, cx, cy, outer);
  g.addColorStop(0, 'rgba(255,238,190,0.14)'); g.addColorStop(0.55, 'rgba(255,238,190,0)'); g.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, outer, 0, TAU); ctx.fill();
}

const sprites = new Map();
export function drawBoardAt(ctx, cx, cy, R, o = {}) {
  setHost(ctx);
  const key = Math.round(R);
  if (sprites.size >= 8 && !sprites.has(key)) sprites.clear();
  let sp = sprites.get(key);
  if (!sp && canBake() && sprites.size < 8) {
    const S = 2, half = Math.ceil(R * 1.3);
    const cv = newCanvas(half * 2 * S, half * 2 * S);
    const c = cv && cv.getContext('2d');
    if (c) { c.scale(S, S); c.translate(half, half); drawBoard(c, 0, 0, R, { grain: true }); sp = { cv, half }; sprites.set(key, sp); }
  }
  if (sp) {
    ctx.save(); ctx.translate(cx, cy);
    if (o.dim !== undefined) ctx.globalAlpha = o.dim;
    ctx.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2);
    ctx.restore();
  } else drawBoard(ctx, cx, cy, R, { shadow: !!o.shadow, grain: false });
}

// ---- the pub wall ---------------------------------------------------------------------------------
let wallSprite = null, wallKey = '';
function drawWall(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0c1713'); g.addColorStop(0.55, '#14261f'); g.addColorStop(1, '#0a120f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // damask-ish diamond pattern, very low contrast
  ctx.strokeStyle = 'rgba(120,170,140,0.07)'; ctx.lineWidth = 2;
  for (let y = -20; y < H + 60; y += 64) {
    for (let x = ((y / 64) % 2 ? 0 : 36) - 36; x < W + 72; x += 72) {
      ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x + 24, y); ctx.lineTo(x, y + 24); ctx.lineTo(x - 24, y); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.stroke();
    }
  }
  // warm pool of light on the board, dark corners
  const l = ctx.createRadialGradient(BOARD.cx, BOARD.cy - 30, 60, BOARD.cx, BOARD.cy, 700);
  l.addColorStop(0, 'rgba(255,214,140,0.30)'); l.addColorStop(0.45, 'rgba(255,196,110,0.10)'); l.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = l; ctx.fillRect(0, 0, W, H);
  // wooden dado rail and panelling at the bottom
  const y0 = H - 162;
  const wd = ctx.createLinearGradient(0, y0, 0, H);
  wd.addColorStop(0, '#4a2e1b'); wd.addColorStop(0.06, '#3a2314'); wd.addColorStop(1, '#22150c');
  ctx.fillStyle = wd; ctx.fillRect(0, y0, W, H - y0);
  ctx.fillStyle = '#6a4427'; ctx.fillRect(0, y0 - 8, W, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, y0 + 2, W, 5);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 180) { ctx.beginPath(); ctx.moveTo(x, y0 + 8); ctx.lineTo(x, H); ctx.stroke(); }
}
export function drawBackdrop(ctx) {
  setHost(ctx);
  const wk = `${W}x${H}|${BOARD.cx},${BOARD.cy}`;
  if (wallKey !== wk) { wallSprite = null; wallKey = wk; }
  if (!wallSprite && canBake()) {
    const cv = newCanvas(W, H), c = cv && cv.getContext('2d');
    if (c) { drawWall(c); wallSprite = cv; }
  }
  if (wallSprite) ctx.drawImage(wallSprite, 0, 0, W, H);
  else drawWall(ctx);
}

// ---- darts ----------------------------------------------------------------------------------------
export const DART_STYLE = [
  { barrel: ['#e3c36f', '#a8802c', '#fff0b8'], shaft: '#2a2a2a', flightA: '#d3363b', flightB: '#8f1f26', star: '#fff2e0' },
  { barrel: ['#c9ced6', '#7c838f', '#ffffff'], shaft: '#22384f', flightA: '#2f8fe0', flightB: '#1b5a99', star: '#ffffff' },
];
// A dart seen from the thrower's side with its tip at (x, y): barrel, shaft and a four-fin flight leaning toward the viewer.
export function drawDart(ctx, x, y, o = {}) {
  const { scale = 1, ang = -0.27, style = 0, alpha = 1, shadow = true } = o;
  const S = DART_STYLE[style % 2];
  ctx.save();
  ctx.translate(x, y); ctx.globalAlpha *= alpha;
  if (shadow) {
    ctx.save(); ctx.translate(4 * scale, 5 * scale); ctx.rotate(ang); ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(-4, 6, 8, 70);
    ctx.beginPath(); ctx.ellipse(0, 88, 22, 26, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.rotate(ang); ctx.scale(scale, scale);
  // back fins (seen edge-on), then the side fins
  ctx.fillStyle = S.flightB;
  ctx.beginPath(); ctx.moveTo(-1.5, 66); ctx.lineTo(1.5, 66); ctx.lineTo(2.5, 104); ctx.lineTo(-2.5, 104); ctx.closePath(); ctx.fill();
  const fin = (sg, c0) => {
    ctx.fillStyle = c0;
    ctx.beginPath(); ctx.moveTo(0, 67); ctx.bezierCurveTo(sg * 12, 70, sg * 29, 82, sg * 27, 100); ctx.quadraticCurveTo(sg * 20, 112, 0, 104); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = S.star; ctx.globalAlpha *= 0.55; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sg * 4, 76); ctx.quadraticCurveTo(sg * 15, 88, sg * 14, 100); ctx.stroke(); ctx.globalAlpha /= 0.55;
  };
  fin(-1, S.flightB); fin(1, S.flightA);
  // shaft
  ctx.fillStyle = S.shaft; ctx.fillRect(-2.8, 44, 5.6, 26);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-2.8, 44, 1.6, 26);
  // barrel
  const bg = ctx.createLinearGradient(-6, 0, 6, 0);
  bg.addColorStop(0, S.barrel[1]); bg.addColorStop(0.35, S.barrel[2]); bg.addColorStop(0.6, S.barrel[0]); bg.addColorStop(1, S.barrel[1]);
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.moveTo(-2.2, 8); ctx.lineTo(2.2, 8); ctx.lineTo(6, 14); ctx.lineTo(6.4, 44); ctx.lineTo(-6.4, 44); ctx.lineTo(-6, 14); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
  for (let k = 0; k < 8; k++) { const yy = 17 + k * 3.4; ctx.beginPath(); ctx.moveTo(-6.2, yy); ctx.lineTo(6.2, yy); ctx.stroke(); }
  // steel point
  ctx.fillStyle = '#d7dadf'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2.2, 8); ctx.lineTo(-2.2, 8); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// The dart's lean as it settles: a damped wobble about the tip.
export const wobbleAng = (age, amp = 0.2, phase = 0) => -0.27 + amp * Math.exp(-5.5 * age) * Math.sin(36 * age + phase);

// A small dart icon for chips and panels.
export function dartIcon(ctx, x, y, size, style = 0, alpha = 1) {
  drawDart(ctx, x - size * 0.2, y - size * 0.55, { scale: size / 120, ang: -0.35, style, alpha, shadow: false });
}
