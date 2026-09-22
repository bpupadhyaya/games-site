// All the pictures: cards (cream faces, Gzhel-blue or Khokhloma backs), the veranda, samovar, linen and embroidery,
// lacquer buttons. Pure canvas paths; static pieces are cached to OffscreenCanvas when the browser has one.
import { W, H, CARD, FONT } from './layout.js';
import { suitOf, rankOf, RANK_LABELS } from './rules.js';

export const SPR = 2;                       // cached sprite resolution multiplier
const caches = new Map();
export function sprite(key, w, h, draw) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  let s = caches.get(key);
  if (!s) {
    s = new OffscreenCanvas(Math.ceil(w * SPR), Math.ceil(h * SPR));
    const c = s.getContext('2d'); c.scale(SPR, SPR); draw(c);
    caches.set(key, s);
  }
  return s;
}
const lcg = (seed) => { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; };

export const INK = '#1d2027', RED = '#bf2430', BLUE4 = '#1f5fae', GREEN4 = '#1f7a3a';
export const GOLD = '#e2b455', GOLD_D = '#a67a25', LACQUER = '#2a1410', LACQUER_L = '#4a231a', CREAM = '#f7efdc', COBALT = '#1f4aa8';

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function txt(ctx, s, x, y, o = {}) {
  ctx.font = `${o.weight || 700} ${o.size || 32}px ${FONT}`;
  ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle';
  if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(s, x + 1.5, y + 2.5); }
  if (o.stroke) { ctx.lineWidth = o.sw || 5; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.color || CREAM; ctx.fillText(s, x, y);
}
export const suitColor = (s, four) => (s === 1 ? RED : s === 2 ? (four ? BLUE4 : RED) : s === 3 ? (four ? GREEN4 : INK) : INK);

// ---- suits -------------------------------------------------------------------------------------------------------
export function suitPath(ctx, s, cx, cy, size) {
  const r = size / 2;
  ctx.beginPath();
  if (s === 1) {
    ctx.moveTo(cx, cy + r * 0.98);
    ctx.bezierCurveTo(cx - r * 1.5, cy + r * 0.05, cx - r * 1.1, cy - r * 1.0, cx, cy - r * 0.38);
    ctx.bezierCurveTo(cx + r * 1.1, cy - r * 1.0, cx + r * 1.5, cy + r * 0.05, cx, cy + r * 0.98);
  } else if (s === 2) {
    ctx.moveTo(cx, cy - r * 1.05); ctx.quadraticCurveTo(cx + r * 0.25, cy - r * 0.25, cx + r * 0.78, cy);
    ctx.quadraticCurveTo(cx + r * 0.25, cy + r * 0.25, cx, cy + r * 1.05); ctx.quadraticCurveTo(cx - r * 0.25, cy + r * 0.25, cx - r * 0.78, cy);
    ctx.quadraticCurveTo(cx - r * 0.25, cy - r * 0.25, cx, cy - r * 1.05);
  } else if (s === 0) {
    ctx.moveTo(cx, cy - r * 1.0);
    ctx.bezierCurveTo(cx - r * 0.3, cy - r * 0.5, cx - r * 1.35, cy - r * 0.05, cx - r * 1.0, cy + r * 0.5);
    ctx.bezierCurveTo(cx - r * 0.75, cy + r * 0.9, cx - r * 0.2, cy + r * 0.75, cx - r * 0.12, cy + r * 0.45);
    ctx.quadraticCurveTo(cx - r * 0.1, cy + r * 0.85, cx - r * 0.42, cy + r * 1.02); ctx.lineTo(cx + r * 0.42, cy + r * 1.02);
    ctx.quadraticCurveTo(cx + r * 0.1, cy + r * 0.85, cx + r * 0.12, cy + r * 0.45);
    ctx.bezierCurveTo(cx + r * 0.2, cy + r * 0.75, cx + r * 0.75, cy + r * 0.9, cx + r * 1.0, cy + r * 0.5);
    ctx.bezierCurveTo(cx + r * 1.35, cy - r * 0.05, cx + r * 0.3, cy - r * 0.5, cx, cy - r * 1.0);
  } else {
    const k = r * 0.5;
    ctx.moveTo(cx - r * 0.42, cy + r * 1.02);
    ctx.quadraticCurveTo(cx - r * 0.1, cy + r * 0.8, cx - r * 0.1, cy + r * 0.3);
    ctx.arc(cx - k * 0.98, cy + k * 0.32, k * 0.92, -0.3, Math.PI * 1.5 - 0.12, true);
    ctx.arc(cx, cy - k * 0.72, k * 0.98, Math.PI * 0.62, Math.PI * 0.38, false);
    ctx.arc(cx + k * 0.98, cy + k * 0.32, k * 0.92, Math.PI * 1.5 + 0.12, Math.PI + 0.3, true);
    ctx.quadraticCurveTo(cx + r * 0.1, cy + r * 0.8, cx + r * 0.42, cy + r * 1.02);
    ctx.closePath();
    return;
  }
  ctx.closePath();
}
export function drawSuit(ctx, s, cx, cy, size, color, flip) {
  ctx.save(); ctx.translate(cx, cy); if (flip) ctx.rotate(Math.PI);
  suitPath(ctx, s, 0, 0, size); ctx.fillStyle = color; ctx.fill(); ctx.restore();
}

// ---- card faces ---------------------------------------------------------------------------------------------------
const PIPS = {
  6: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]],
};
function pipLayout(n) {
  const L = 57, R = 93, C = 75;
  const rows3 = [54, 105, 156], rows4 = [50, 88, 122, 160];
  const col = (xs, ys) => xs.flatMap((x) => ys.map((y) => [x, y]));
  if (n === 6) return col([L, R], rows3);
  if (n === 7) return [...col([L, R], rows3), [C, 79]];
  if (n === 8) return [...col([L, R], rows3), [C, 79], [C, 131]];
  if (n === 9) return [...col([L, R], rows4), [C, 105]];
  return [...col([L, R], rows4), [C, 69], [C, 141]];
}
export function drawFace(ctx, c, o = {}) {
  const s = suitOf(c), r = rankOf(c), col = suitColor(s, o.four), w = CARD.w, h = CARD.h, big = !!o.big;
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#fffef8'); g.addColorStop(1, '#f2e8d0');
  rr(ctx, 1.5, 1.5, w - 3, h - 3, 13); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#a99568'; ctx.stroke();
  rr(ctx, 7, 7, w - 14, h - 14, 9); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(150,120,70,0.35)'; ctx.stroke();
  const label = RANK_LABELS[r];
  const idx = () => {
    txt(ctx, label, 26, big ? 33 : 30, { size: big ? 58 : 46, color: col, weight: 700 });
    drawSuit(ctx, s, 26, big ? 76 : 68, big ? 32 : 26, col);
  };
  idx();
  ctx.save(); ctx.translate(w, h); ctx.rotate(Math.PI); idx(); ctx.restore();
  if (r >= 6 - 6 && r <= 4) {
    const n = r + 6;
    for (const [x, y] of pipLayout(n)) drawSuit(ctx, s, x + (big ? 6 : 0), y, big ? 27 : 30, col, y > 105);
  } else if (r === 8) {
    drawSuit(ctx, s, 82, 105, 74, col);
    ctx.globalAlpha = 0.18; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(82, 105, 50, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  } else {
    // Court cards: a framed panel, a crest and the big letter (decorative, not portraits).
    const x0 = big ? 52 : 46, x1 = w - 20, y0 = 34, y1 = h - 34;
    rr(ctx, x0, y0, x1 - x0, y1 - y0, 10);
    const pg = ctx.createLinearGradient(0, y0, 0, y1); pg.addColorStop(0, '#f4e2ad'); pg.addColorStop(0.5, '#fbf3d9'); pg.addColorStop(1, '#f4e2ad');
    ctx.fillStyle = pg; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = GOLD_D; ctx.stroke();
    const cx = (x0 + x1) / 2;
    ctx.save(); rr(ctx, x0 + 4, y0 + 4, x1 - x0 - 8, y1 - y0 - 8, 7); ctx.clip();
    const rnd = lcg(c * 7 + 3);
    ctx.globalAlpha = 0.16; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); const yy = y0 + 18 + i * 28; ctx.moveTo(x0, yy + rnd() * 6); ctx.bezierCurveTo(cx - 20, yy - 16, cx + 20, yy + 20, x1, yy); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.restore();
    crest(ctx, r, cx, 84, col); ctx.save(); ctx.translate(cx * 2, h); ctx.rotate(Math.PI); crest(ctx, r, cx, 84, col); ctx.restore();
    txt(ctx, label, cx, h / 2 + 1, { size: 74, color: col, stroke: 'rgba(255,250,235,0.9)', sw: 5 });
    drawSuit(ctx, s, cx, h / 2 - 44, 22, col); drawSuit(ctx, s, cx, h / 2 + 46, 22, col, true);
  }
}
function crest(ctx, rank, cx, cy, col) {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = GOLD; ctx.strokeStyle = GOLD_D; ctx.lineWidth = 1.5;
  if (rank === 7) { // king: crown
    ctx.beginPath(); ctx.moveTo(-20, 10); ctx.lineTo(-24, -14); ctx.lineTo(-10, -2); ctx.lineTo(0, -18); ctx.lineTo(10, -2); ctx.lineTo(24, -14); ctx.lineTo(20, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; for (const x of [-10, 0, 10]) { ctx.beginPath(); ctx.arc(x, 3, 3, 0, 7); ctx.fill(); }
  } else if (rank === 6) { // queen: diadem with pearls
    ctx.beginPath(); ctx.arc(0, 8, 22, Math.PI * 1.08, Math.PI * 1.92); ctx.lineWidth = 5; ctx.strokeStyle = GOLD_D; ctx.stroke();
    ctx.fillStyle = col; for (const [x, y] of [[-16, -2], [-8, -10], [0, -13], [8, -10], [16, -2]]) { ctx.beginPath(); ctx.arc(x, y + 6, 3.2, 0, 7); ctx.fill(); }
  } else { // jack: cap with feather
    ctx.beginPath(); ctx.moveTo(-20, 8); ctx.quadraticCurveTo(-18, -14, 4, -12); ctx.quadraticCurveTo(16, -12, 20, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, -10); ctx.quadraticCurveTo(26, -26, 30, -2); ctx.stroke();
  }
  ctx.restore();
}

// ---- card backs: Gzhel (cobalt on porcelain) and Khokhloma (gold, red on black lacquer) ------------------------------
function petal(ctx, len, wid) {
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(wid, -len * 0.25, wid * 0.8, -len * 0.85, 0, -len); ctx.bezierCurveTo(-wid * 0.8, -len * 0.85, -wid, -len * 0.25, 0, 0); ctx.closePath();
}
function gzhelFlower(ctx, cx, cy, s) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.rotate((i * Math.PI) / 4); petal(ctx, 44, 15);
    const g = ctx.createLinearGradient(0, 0, 0, -44); g.addColorStop(0, '#0f2f7a'); g.addColorStop(0.55, '#2b5cc4'); g.addColorStop(1, '#9db8ee');
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
  }
  for (let i = 0; i < 8; i++) { ctx.save(); ctx.rotate((i * Math.PI) / 4 + Math.PI / 8); petal(ctx, 25, 7); ctx.fillStyle = '#d6e2fa'; ctx.globalAlpha = 0.85; ctx.fill(); ctx.restore(); }
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fillStyle = '#0f2f7a'; ctx.fill(); ctx.beginPath(); ctx.arc(-2, -2, 4, 0, 7); ctx.fillStyle = '#9db8ee'; ctx.fill();
  ctx.restore();
}
function gzhelSprig(ctx, x, y, rot, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.strokeStyle = '#2b5cc4'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(12, -14, 6, -30, 20, -40); ctx.stroke();
  for (const [ly, side] of [[-12, 1], [-24, -1], [-34, 1]]) { ctx.save(); ctx.translate(side * 4, ly); ctx.rotate(side * 0.9); petal(ctx, 16, 6); ctx.fillStyle = '#3a68c9'; ctx.fill(); ctx.restore(); }
  ctx.beginPath(); ctx.arc(20, -42, 4, 0, 7); ctx.fillStyle = '#0f2f7a'; ctx.fill();
  ctx.restore();
}
export function drawBack(ctx, theme = 'gzhel') {
  const w = CARD.w, h = CARD.h;
  if (theme === 'gzhel') {
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#fbfcff'); g.addColorStop(1, '#e3eaf7');
    rr(ctx, 1.5, 1.5, w - 3, h - 3, 13); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#8fa2c9'; ctx.stroke();
    rr(ctx, 9, 9, w - 18, h - 18, 8); ctx.lineWidth = 5; ctx.strokeStyle = COBALT; ctx.stroke();
    rr(ctx, 16, 16, w - 32, h - 32, 5); ctx.lineWidth = 1.5; ctx.strokeStyle = '#6c8bd0'; ctx.stroke();
    for (let i = 0; i < 9; i++) { for (const y of [22, h - 22]) { ctx.beginPath(); ctx.arc(24 + i * 12.75, y, 2.2, 0, 7); ctx.fillStyle = '#3a68c9'; ctx.fill(); } }
    gzhelFlower(ctx, w / 2, h / 2, 1.0);
    gzhelSprig(ctx, 22, 62, -0.2, 0.75); gzhelSprig(ctx, w - 22, 62, 0.2, 0.75);
    ctx.save(); ctx.translate(w, h); ctx.rotate(Math.PI); gzhelSprig(ctx, 22, 62, -0.2, 0.75); gzhelSprig(ctx, w - 22, 62, 0.2, 0.75); ctx.restore();
  } else {
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#3a1a12'); g.addColorStop(1, '#170b08');
    rr(ctx, 1.5, 1.5, w - 3, h - 3, 13); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = GOLD_D; ctx.stroke();
    rr(ctx, 10, 10, w - 20, h - 20, 8); ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.stroke();
    khokhloma(ctx, w / 2, h / 2, 1.5, 0); khokhloma(ctx, w / 2, 48, 0.55, Math.PI); khokhloma(ctx, w / 2, h - 48, 0.55, 0);
  }
  rr(ctx, 1.5, 1.5, w - 3, h - 3, 13); const sh = ctx.createLinearGradient(0, 0, w, h * 0.6); sh.addColorStop(0, 'rgba(255,255,255,0.16)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fill();
}
// Khokhloma-inspired sprig: gold curls, leaves and red berries. Pure decoration.
export function khokhloma(ctx, cx, cy, s, rot) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(s, s);
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side, 1);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(24, 6, 44, -10, 36, -32); ctx.bezierCurveTo(32, -46, 14, -44, 16, -32); ctx.stroke();
    for (const [x, y, a, l] of [[16, 6, 0.4, 20], [34, -8, 1.0, 18], [37, -32, 1.8, 15]]) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); petal(ctx, l, 7); ctx.fillStyle = GOLD; ctx.fill(); ctx.restore(); }
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, -4, 11, 0, 7); ctx.fillStyle = '#b3261e'; ctx.fill(); ctx.beginPath(); ctx.arc(-3, -7, 3.5, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
  for (const [x, y] of [[-26, -30], [26, -30], [0, -34]]) { ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 7); ctx.fillStyle = '#b3261e'; ctx.fill(); }
  ctx.restore();
}

// ---- the veranda ------------------------------------------------------------------------------------------------------
function planks(ctx, x, y, w, h, base, seed) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, base[0]); g.addColorStop(1, base[1]); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const rnd = lcg(seed);
  for (let yy = y; yy < y + h; yy += 34) {
    ctx.fillStyle = 'rgba(60,35,10,0.30)'; ctx.fillRect(x, yy, w, 2.5); ctx.fillStyle = 'rgba(255,240,200,0.14)'; ctx.fillRect(x, yy + 2.5, w, 2);
    for (let k = 0; k < 4; k++) { const gx = x + rnd() * w; ctx.strokeStyle = 'rgba(70,40,12,0.10)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, yy + 6 + rnd() * 20); ctx.bezierCurveTo(gx + 40, yy + 10, gx + 80, yy + 24, gx + 140 + rnd() * 80, yy + 12 + rnd() * 12); ctx.stroke(); }
  }
}
function samovar(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const brass = (x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#7a5417'); g.addColorStop(0.22, '#e9c66a'); g.addColorStop(0.45, '#fff0b8'); g.addColorStop(0.7, '#c5952f'); g.addColorStop(1, '#6e4a12'); return g; };
  // feet + base
  ctx.fillStyle = brass(-48, 48); rr(ctx, -46, 132, 92, 18, 5); ctx.fill(); rr(ctx, -34, 118, 68, 20, 6); ctx.fill();
  // body
  ctx.beginPath(); ctx.moveTo(-34, 118); ctx.bezierCurveTo(-78, 100, -82, 20, -60, -20); ctx.lineTo(60, -20); ctx.bezierCurveTo(82, 20, 78, 100, 34, 118); ctx.closePath(); ctx.fillStyle = brass(-80, 80); ctx.fill();
  ctx.strokeStyle = 'rgba(80,50,10,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(90,55,12,0.35)'; ctx.lineWidth = 3; for (const yy of [8, 62]) { ctx.beginPath(); ctx.moveTo(-72 + (yy < 30 ? 6 : 0), yy); ctx.quadraticCurveTo(0, yy + 10, 72 - (yy < 30 ? 6 : 0), yy); ctx.stroke(); }
  // shoulder, lid, chimney
  ctx.fillStyle = brass(-62, 62); rr(ctx, -62, -34, 124, 18, 8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-42, -34); ctx.quadraticCurveTo(0, -78, 42, -34); ctx.closePath(); ctx.fillStyle = brass(-44, 44); ctx.fill();
  ctx.fillStyle = brass(-14, 14); rr(ctx, -13, -76, 26, 30, 6); ctx.fill(); ctx.beginPath(); ctx.arc(0, -82, 9, 0, 7); ctx.fill();
  // handles and tap
  ctx.strokeStyle = '#5a3a0c'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 68, -12); ctx.quadraticCurveTo(side * 104, -10, side * 96, 26); ctx.stroke(); }
  ctx.fillStyle = brass(60, 100); rr(ctx, 70, 62, 38, 12, 5); ctx.fill(); ctx.beginPath(); ctx.arc(110, 68, 8, 0, 7); ctx.fillStyle = '#8b5f16'; ctx.fill();
  // highlight
  ctx.globalAlpha = 0.28; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-30, 40, 8, 40, 0.05, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
}
function teaGlass(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#9a6a1c'; rr(ctx, -20, 20, 40, 38, 6); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(24, 38, 12, -1.3, 1.3); ctx.lineWidth = 5; ctx.strokeStyle = GOLD; ctx.stroke();
  const g = ctx.createLinearGradient(-15, 0, 15, 0); g.addColorStop(0, 'rgba(255,255,255,0.65)'); g.addColorStop(0.3, 'rgba(180,80,20,0.9)'); g.addColorStop(1, 'rgba(120,40,10,0.95)');
  ctx.beginPath(); ctx.moveTo(-16, -12); ctx.lineTo(16, -12); ctx.lineTo(13, 56); ctx.lineTo(-13, 56); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-13, -12, 5, 66); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, -12, 16, 4, 0, 0, 7); ctx.stroke();
  ctx.restore();
}
function birchWindow(ctx, x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h); sky.addColorStop(0, '#bfdde8'); sky.addColorStop(0.6, '#f0efd2'); sky.addColorStop(1, '#a9c47a'); ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
  const rnd = lcg(11);
  for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.arc(x + rnd() * w, y + 60 + rnd() * 100, 20 + rnd() * 34, 0, 7); ctx.fillStyle = `rgba(${90 + rnd() * 40 | 0},${150 + rnd() * 40 | 0},${70 + rnd() * 30 | 0},0.5)`; ctx.fill(); }
  for (let i = 0; i < 4; i++) { const tx = x + 26 + i * (w / 4) + rnd() * 12; ctx.fillStyle = '#f5f2e6'; ctx.fillRect(tx, y, 12 + rnd() * 6, h); ctx.fillStyle = '#3a3a36'; for (let k = 0; k < 6; k++) ctx.fillRect(tx + 1, y + 10 + k * 34 + rnd() * 14, 7 + rnd() * 6, 3); }
  ctx.restore();
  // frame and glazing bars
  ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 14; ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
  ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h * 0.5); ctx.lineTo(x + w, y + h * 0.5); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,100,70,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(x - 11, y - 11, w + 22, h + 22);
}
export function crossStitch(ctx, x, y, w, h, seed = 3) {
  // A linen band with a red cross-stitch row (diamonds and small stars). Decoration only.
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#f6eedb'); g.addColorStop(1, '#e6d9bd'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(150,120,80,0.16)'; ctx.lineWidth = 1; for (let xx = x; xx < x + w; xx += 4) { ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); ctx.stroke(); }
  const cell = Math.max(4, Math.floor(h / 9)), rows = 7, oy = y + (h - rows * cell) / 2;
  const motif = ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'];
  const star = ['#.#.#.#', '.#####.', '#.###.#', '.#####.', '#.###.#', '.#####.', '#.#.#.#'];
  let cx = x + cell; let k = 0;
  const px = (m, ox) => { for (let r = 0; r < rows; r++) for (let c = 0; c < 7; c++) if (m[r][c] === '#') { const X = ox + c * cell, Y = oy + r * cell; ctx.strokeStyle = '#b3242c'; ctx.lineWidth = Math.max(1.4, cell * 0.28); ctx.beginPath(); ctx.moveTo(X + 1, Y + 1); ctx.lineTo(X + cell - 1, Y + cell - 1); ctx.moveTo(X + cell - 1, Y + 1); ctx.lineTo(X + 1, Y + cell - 1); ctx.stroke(); } };
  while (cx + 7 * cell < x + w - cell) { px(k % 2 ? star : motif, cx); cx += 8 * cell; k++; }
  ctx.fillStyle = '#b3242c'; ctx.fillRect(x, y + 2, w, 3); ctx.fillRect(x, y + h - 5, w, 3);
}
function tableTop(ctx) {
  // wooden table rim then woven cloth
  planks(ctx, 0, 296, W, 40, ['#5b3417', '#3b210e'], 5);
  const hl = ctx.createLinearGradient(0, 296, 0, 340); hl.addColorStop(0, 'rgba(255,220,150,0.35)'); hl.addColorStop(0.3, 'rgba(255,220,150,0)'); ctx.fillStyle = hl; ctx.fillRect(0, 296, W, 44);
  const cl = ctx.createLinearGradient(0, 336, 0, H); cl.addColorStop(0, '#2a5a49'); cl.addColorStop(0.5, '#1d4a3b'); cl.addColorStop(1, '#123328'); ctx.fillStyle = cl; ctx.fillRect(0, 336, W, H - 336);
  ctx.lineWidth = 1; for (let x = 0; x < W; x += 5) { ctx.strokeStyle = x % 10 ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.05)'; ctx.beginPath(); ctx.moveTo(x, 336); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 336; y < H; y += 5) { ctx.strokeStyle = y % 10 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  crossStitch(ctx, 0, 340, W, 46);
  // cast shadow under the band
  const sh = ctx.createLinearGradient(0, 386, 0, 420); sh.addColorStop(0, 'rgba(0,0,0,0.3)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sh; ctx.fillRect(0, 386, W, 34);
  // play mat outline: stitched double line
  ctx.setLineDash([9, 7]); ctx.strokeStyle = 'rgba(232,220,190,0.28)'; ctx.lineWidth = 3; rr(ctx, 22, 552, W - 44, 494, 30); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(232,220,190,0.14)'; ctx.lineWidth = 1.5; rr(ctx, 30, 560, W - 60, 478, 24); ctx.stroke();
  const mat = ctx.createRadialGradient(360, 780, 40, 360, 780, 420); mat.addColorStop(0, 'rgba(255,240,200,0.10)'); mat.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = mat; rr(ctx, 22, 552, W - 44, 494, 30); ctx.fill();
}
export function drawSceneStatic(ctx) {
  planks(ctx, 0, 0, W, 300, ['#d8c497', '#b89e6a'], 21);
  // wainscot line
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, 0, W, 300);
  birchWindow(ctx, 470, 44, 214, 190);
  // curtain (linen with an embroidered hem)
  const cg = ctx.createLinearGradient(430, 0, 480, 0); cg.addColorStop(0, '#efe4cb'); cg.addColorStop(1, '#d8c8a4');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(436, 22); ctx.lineTo(492, 22); ctx.quadraticCurveTo(504, 130, 486, 248); ctx.lineTo(430, 248); ctx.quadraticCurveTo(446, 130, 436, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(120,90,50,0.25)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(444 + i * 12, 24); ctx.quadraticCurveTo(452 + i * 12, 130, 440 + i * 14, 246); ctx.stroke(); }
  ctx.save(); ctx.beginPath(); ctx.moveTo(430, 226); ctx.lineTo(486, 226); ctx.lineTo(486, 250); ctx.lineTo(430, 250); ctx.closePath(); ctx.clip(); crossStitch(ctx, 428, 226, 62, 24); ctx.restore();
  ctx.fillStyle = '#6b4520'; rr(ctx, 410, 14, 330, 10, 5); ctx.fill();
  // sideboard shelf with samovar and tea
  ctx.fillStyle = '#4a2c12'; rr(ctx, 16, 244, 300, 22, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,220,150,0.3)'; ctx.fillRect(16, 244, 300, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(120, 246, 76, 8, 0, 0, 7); ctx.fill();
  samovar(ctx, 118, 108, 0.86);
  teaGlass(ctx, 236, 176, 0.9);
  // jam jar
  ctx.fillStyle = '#7a1f28'; rr(ctx, 268, 208, 34, 36, 7); ctx.fill(); ctx.fillStyle = '#efe4cb'; rr(ctx, 266, 200, 38, 10, 4); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(272, 214, 5, 24);
  tableTop(ctx);
}
export function drawScene(ctx, t, o = {}) {
  const sp = sprite('scene', W, H, drawSceneStatic);
  if (sp) ctx.drawImage(sp, 0, 0, W, H); else drawSceneStatic(ctx);
  const calm = !!o.calm;
  // window light falling across the wall and the table
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const k = calm ? 0.5 : 0.5 + Math.sin(t * 0.35) * 0.12 + Math.sin(t * 0.9) * 0.05;
  const lg = ctx.createLinearGradient(560, 40, 220, 900); lg.addColorStop(0, `rgba(255,236,170,${0.34 * k})`); lg.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(470, 44); ctx.lineTo(684, 44); ctx.lineTo(500, 1000); ctx.lineTo(-100, 900); ctx.closePath(); ctx.fill();
  ctx.restore();
  // steam from the samovar and the glass
  if (!calm) {
    for (let i = 0; i < 5; i++) {
      const p = ((t * 0.16 + i * 0.2) % 1), a = Math.sin(p * Math.PI) * 0.22;
      ctx.beginPath(); ctx.arc(118 + Math.sin(t * 0.8 + i * 2) * 10 + p * 16, 26 - p * 42, 8 + p * 22, 0, 7); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
    }
    for (let i = 0; i < 3; i++) { const p = ((t * 0.2 + i * 0.33) % 1); ctx.beginPath(); ctx.arc(236 + Math.sin(t * 1.2 + i) * 5, 158 - p * 34, 5 + p * 12, 0, 7); ctx.fillStyle = `rgba(255,255,255,${Math.sin(p * Math.PI) * 0.18})`; ctx.fill(); }
    // dust motes in the light
    const r = lcg(9);
    for (let i = 0; i < 26; i++) {
      const bx = r() * 560 + 100, by = r() * 900 + 60, ph = r() * 6.28, sp2 = 0.2 + r() * 0.4;
      const x = bx + Math.sin(t * sp2 + ph) * 22, y = ((by - t * 6 * sp2) % 900 + 900) % 900 + 40;
      ctx.beginPath(); ctx.arc(x, y, 1.6 + r() * 1.6, 0, 7); ctx.fillStyle = `rgba(255,244,200,${0.15 + 0.15 * Math.sin(t * 1.3 + ph)})`; ctx.fill();
    }
  }
  // soft vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 1000); v.addColorStop(0, 'rgba(10,6,2,0)'); v.addColorStop(1, 'rgba(10,6,2,0.42)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---- lacquer UI -----------------------------------------------------------------------------------------------------
export function lacquer(ctx, r, o = {}) {
  const { x, y, w, h } = r, down = !!o.down, dis = !!o.disabled;
  ctx.save();
  ctx.translate(0, down ? 2 : 0);
  if (!down) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; rr(ctx, x + 2, y + 6, w, h, h / 2.6); ctx.fill(); }
  const base = o.kind === 'gold' ? ['#f0cd74', '#b98b2c'] : o.kind === 'green' ? ['#2f6b52', '#173d2f'] : o.kind === 'blue' ? ['#2a56b8', '#142c6e'] : ['#5a2a1e', '#26100b'];
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, base[0]); g.addColorStop(1, base[1]);
  rr(ctx, x, y, w, h, h / 2.6); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = o.kind === 'gold' ? '#7d5a14' : GOLD; ctx.stroke();
  rr(ctx, x + 6, y + 6, w - 12, h - 12, h / 2.6 - 4); ctx.lineWidth = 1.2; ctx.strokeStyle = o.kind === 'gold' ? 'rgba(255,255,255,0.5)' : 'rgba(226,180,85,0.5)'; ctx.stroke();
  const gl = ctx.createLinearGradient(0, y, 0, y + h * 0.5); gl.addColorStop(0, 'rgba(255,255,255,0.22)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); rr(ctx, x + 4, y + 3, w - 8, h * 0.5, h / 3); ctx.fillStyle = gl; ctx.fill();
  if (w > 200) { ctx.save(); ctx.globalAlpha = 0.9; khokhloma(ctx, x + 34, y + h / 2 + 6, 0.34, -Math.PI / 2); khokhloma(ctx, x + w - 34, y + h / 2 + 6, 0.34, Math.PI / 2); ctx.restore(); }
  if (o.label) {
    const dark = o.kind === 'gold';
    txt(ctx, o.label, x + w / 2, y + h / 2 + (o.sub ? -10 : 1), { size: o.size || Math.min(44, h * 0.5), color: dark ? '#3a2408' : dis ? 'rgba(247,239,220,0.45)' : CREAM, shadow: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)' });
    if (o.sub) txt(ctx, o.sub, x + w / 2, y + h / 2 + h * 0.26, { size: Math.min(24, h * 0.3), color: dark ? '#5a3c10' : dis ? 'rgba(226,180,85,0.4)' : GOLD, weight: 600 });
  }
  if (dis) { rr(ctx, x, y, w, h, h / 2.6); ctx.fillStyle = 'rgba(20,10,5,0.4)'; ctx.fill(); }
  ctx.restore();
}
export function panel(ctx, x, y, w, h, o = {}) {
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, x + 3, y + 8, w, h, 26); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, o.top || '#3a1e14'); g.addColorStop(1, o.bot || '#1e0e0a');
  rr(ctx, x, y, w, h, 26); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = GOLD; ctx.stroke();
  rr(ctx, x + 9, y + 9, w - 18, h - 18, 19); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(226,180,85,0.5)'; ctx.stroke();
  for (const [cx, cy, rot] of [[x + 30, y + 30, 0.8], [x + w - 30, y + 30, -0.8], [x + 30, y + h - 30, 2.4], [x + w - 30, y + h - 30, -2.4]]) khokhloma(ctx, cx, cy, 0.3, rot);
  ctx.restore();
}
export function plaque(ctx, cx, cy, w, h, o = {}) {
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, cx - w / 2 + 2, cy - h / 2 + 5, w, h, h / 2.4); ctx.fill();
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2); g.addColorStop(0, o.hot ? '#f0cd74' : '#6a4022'); g.addColorStop(1, o.hot ? '#b98b2c' : '#3a2010');
  rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2.4); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = o.hot ? '#7d5a14' : GOLD; ctx.stroke();
  ctx.restore();
}
