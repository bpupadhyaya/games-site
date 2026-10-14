// Everything the board and pieces look like. Pure drawing helpers, no game state. Sizes are in virtual units; `s` is a cell's width.
import { N, RING, CROSS, CENTRE, GATES, CAMP, cell as cellOf, ringIdx } from './rules.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
export const SIDE = [
  { name: 'Red', main: '#d23a2a', dark: '#7d1810', light: '#f58a6c', trim: '#ffd24a' },
  { name: 'Blue', main: '#2f6bd6', dark: '#143a86', light: '#8fb8ff', trim: '#ffd24a' },
];
export const WOODS = {
  birch: { name: 'Birch', frame: ['#8a5a30', '#4a2c14'], tile: ['#f6ebcf', '#dcc89b'], tile2: ['#e9d8ac', '#c9b07b'], line: 'rgba(90,56,22,0.55)', felt: ['#1c2a52', '#101a38'], need: 0 },
  spruce: { name: 'Spruce', frame: ['#5c3a1e', '#2d1a0a'], tile: ['#ecd9ac', '#cdb27a'], tile2: ['#dcc28d', '#b79a62'], line: 'rgba(60,36,12,0.6)', felt: ['#27343a', '#141d22'], need: 1 },
  rowan: { name: 'Rowan', frame: ['#7a3a2c', '#3a1710'], tile: ['#f1dcc0', '#d8b48e'], tile2: ['#e4c6a2', '#c39a72'], line: 'rgba(80,30,16,0.55)', felt: ['#3a1c2e', '#1f0e1b'], need: 3 },
};
export const WOOD_KEYS = Object.keys(WOODS);
export const STYLES = { four: { name: 'Four-winds cap', need: 0 }, round: { name: 'Round cap', need: 5 } };
export const STYLE_KEYS = Object.keys(STYLES);
const BAND = ['#d23a2a', '#ffd24a', '#2f6bd6', '#3fae5c'];          // the four colours of a traditional Sámi outfit

// Pre-rendered 3D sprites (filled in by view3d/presenter.js once WebGL works; empty = classic flat art).
export const sprites = { ready: false, herder: {}, king: {}, die: {}, board: {} };
export const FRAME = 0.5;                                          // board frame width, in cells
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// ---------------------------------------------------------------- backdrop: night sky, aurora ribbons, stars, snow
export function drawBackdrop(ctx, L, t, calm) {
  const { w, h } = L;
  if (v3.on) {
    ctx.clearRect(0, 0, w, h);
    const vg = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(3,7,20,0)'); vg.addColorStop(1, 'rgba(3,7,20,0.62)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#050a1c'); g.addColorStop(0.55, '#0c1a38'); g.addColorStop(1, '#13264a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let k = 0; k < 46; k++) {                                     // stars
    const x = (k * 197.3) % w, y = ((k * 89.7) % (h * 0.7)), a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.7 + k * 1.3));
    ctx.fillStyle = `rgba(230,240,255,${calm ? 0.4 : a})`; ctx.fillRect(x, y, k % 5 === 0 ? 2.5 : 1.6, k % 5 === 0 ? 2.5 : 1.6);
  }
  const ribbons = [[0.16, 60, '90,255,190', 0.28, 0.5, 0], [0.26, 46, '120,190,255', 0.2, 0.37, 2.1], [0.1, 38, '190,130,255', 0.16, 0.6, 4.2]];
  for (const [yb, amp, col, al, sp, ph] of ribbons) {
    const top = [], bot = [], steps = 14;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * w, y = h * yb + Math.sin(i * 0.55 + (calm ? 0 : t * sp) + ph) * amp + Math.sin(i * 0.23 + ph) * amp * 0.6;
      top.push([x, y]); bot.push([x, y + h * 0.2 + Math.sin(i * 0.8 + t * sp * 0.7) * 18]);
    }
    ctx.beginPath(); top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = steps; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.closePath();
    const gr = ctx.createLinearGradient(0, h * yb - amp, 0, h * yb + h * 0.26); gr.addColorStop(0, `rgba(${col},${al})`); gr.addColorStop(0.45, `rgba(${col},${al * 0.45})`); gr.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gr; ctx.fill();
  }
  if (!calm) for (let k = 0; k < 26; k++) {                          // snow
    const sp = 14 + (k % 5) * 6, x = ((k * 151.7 + Math.sin(t * 0.4 + k) * 22) % w + w) % w, y = (k * 61.3 + t * sp) % (h + 20) - 10;
    ctx.fillStyle = `rgba(240,248,255,${0.12 + 0.12 * (k % 3)})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + (k % 3) * 0.8, 0, TAU); ctx.fill();
  }
}

// ---------------------------------------------------------------- the board
// B = layout board: { x, y, S, cell, gx, gy, sq(i) -> {x,y} }. Draws the frame, the track tiles, the felt, camps and the centre.
export function drawBoard(ctx, B, woodKey, o = {}) {
  const bsp = sprites.ready && sprites.board[woodKey];
  if (bsp) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(B.x + 3, B.y + 8, B.S, B.S, B.cell * 0.34); ctx.fill(); ctx.drawImage(bsp, B.x, B.y, B.S, B.S); ctx.restore(); return; }
  const pal = WOODS[woodKey] || WOODS.birch, c = B.cell, t = c * 0.2;
  const x0 = B.x, y0 = B.y, S = B.S;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; rr(ctx, x0 + 3, y0 + t + 8, S, S, c * 0.32); ctx.fill();     // drop shadow
  let g = ctx.createLinearGradient(0, y0 + S - c * 0.2, 0, y0 + S + t); g.addColorStop(0, pal.frame[1]); g.addColorStop(1, '#150a04');
  ctx.fillStyle = g; rr(ctx, x0, y0 + t * 0.8, S, S, c * 0.32); ctx.fill();                          // slab edge
  g = ctx.createLinearGradient(x0, y0, x0 + S, y0 + S); g.addColorStop(0, pal.frame[0]); g.addColorStop(1, pal.frame[1]);
  ctx.fillStyle = g; rr(ctx, x0, y0, S, S, c * 0.32); ctx.fill();
  // the woven band: four colours in short dashes round the frame
  const bandW = c * FRAME * 0.34, bx = x0 + c * FRAME * 0.33, by = y0 + c * FRAME * 0.33, bs = S - c * FRAME * 0.66;
  ctx.save(); ctx.lineWidth = bandW; ctx.lineCap = 'butt';
  ctx.strokeStyle = '#1b0f06'; rr(ctx, bx, by, bs, bs, c * 0.2); ctx.stroke();
  ctx.lineWidth = bandW * 0.7; rr(ctx, bx, by, bs, bs, c * 0.2); ctx.setLineDash([c * 0.26, c * 0.26]);
  for (let k = 0; k < 4; k++) { ctx.strokeStyle = BAND[k]; ctx.lineDashOffset = -k * c * 0.13; ctx.stroke(); ctx.setLineDash([c * 0.26, c * 1.04]); ctx.lineDashOffset = -k * c * 0.26; ctx.stroke(); }
  ctx.restore();
  ctx.setLineDash([]);
  // felt well under the track
  const gx = B.gx, gy = B.gy;
  g = ctx.createLinearGradient(gx, gy, gx + c * N, gy + c * N); g.addColorStop(0, pal.felt[0]); g.addColorStop(1, pal.felt[1]);
  ctx.fillStyle = g; rr(ctx, gx - c * 0.06, gy - c * 0.06, c * N + c * 0.12, c * N + c * 0.12, c * 0.14); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  // felt pattern: quiet diamonds in the inner corners
  ctx.save(); ctx.beginPath(); ctx.rect(gx, gy, c * N, c * N); ctx.clip();
  ctx.strokeStyle = 'rgba(255,214,110,0.16)'; ctx.lineWidth = Math.max(1, c * 0.025);
  for (const [qr, qc] of [[1.5, 1.5], [1.5, 5.5], [5.5, 1.5], [5.5, 5.5]]) {
    const cx = gx + qc * c, cy = gy + qr * c;
    for (const k of [0.62, 0.4, 0.18]) { ctx.beginPath(); ctx.moveTo(cx, cy - k * c); ctx.lineTo(cx + k * c, cy); ctx.lineTo(cx, cy + k * c); ctx.lineTo(cx - k * c, cy); ctx.closePath(); ctx.stroke(); }
  }
  ctx.restore();
  // tiles
  const tile = (i, alt) => {
    const p = B.sq(i), tw = c * 0.9, x = p.x - tw / 2, y = p.y - tw / 2;
    const tg = ctx.createLinearGradient(x, y, x + tw, y + tw), cols = alt ? pal.tile2 : pal.tile; tg.addColorStop(0, cols[0]); tg.addColorStop(1, cols[1]);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, x + 1, y + 3, tw, tw, c * 0.12); ctx.fill();
    ctx.fillStyle = tg; rr(ctx, x, y, tw, tw, c * 0.12); ctx.fill();
    ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1, c * 0.02); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(x + c * 0.1, y + c * 0.04); ctx.lineTo(x + tw - c * 0.1, y + c * 0.04); ctx.stroke();   // lit top edge
  };
  RING.forEach((i, k) => tile(i, k % 2 === 1));
  CROSS.forEach((i, k) => tile(i, true));
  tile(CENTRE, false);
  // camps: a tinted tile with a small lavvu (tent) shape
  CAMP.forEach((i, p) => {
    const q = B.sq(i), s = SIDE[p], tw = c * 0.9;
    ctx.fillStyle = s.main; ctx.globalAlpha = 0.42; rr(ctx, q.x - tw / 2, q.y - tw / 2, tw, tw, c * 0.12); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = s.main; ctx.lineWidth = Math.max(2, c * 0.05); rr(ctx, q.x - tw / 2 + 2, q.y - tw / 2 + 2, tw - 4, tw - 4, c * 0.1); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.moveTo(q.x - c * 0.3, q.y + c * 0.3); ctx.lineTo(q.x, q.y - c * 0.3); ctx.lineTo(q.x + c * 0.3, q.y + c * 0.3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = s.dark; ctx.lineWidth = 1.5; ctx.stroke();
  });
  // gates: a small diamond
  for (const i of GATES) {
    const q = B.sq(i); ctx.fillStyle = 'rgba(90,50,10,0.55)'; ctx.beginPath(); ctx.moveTo(q.x, q.y - c * 0.36); ctx.lineTo(q.x + c * 0.36, q.y); ctx.lineTo(q.x, q.y + c * 0.36); ctx.lineTo(q.x - c * 0.36, q.y); ctx.closePath(); ctx.fill();
  }
  // the centre: an eight-pointed sun
  const cq = B.sq(CENTRE);
  ctx.fillStyle = 'rgba(160,40,20,0.55)';
  ctx.beginPath(); for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU - Math.PI / 2, r = k % 2 ? c * 0.2 : c * 0.4; ctx.lineTo(cq.x + Math.cos(a) * r, cq.y + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- pieces
// A herder: carved wooden figure in a coloured outfit. o: { lift, glow, alpha, scale, flash, tilt, style }.
export function drawHerder(ctx, p, x, y, s, o = {}) {
  const sd = SIDE[p], sc = (o.scale || 1) * s, lift = (o.lift || 0) * sc * 0.3;
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(x, y - lift); if (o.tilt) ctx.rotate(o.tilt);
  const u = sc;
  const sp = sprites.ready && sprites.herder[`${p}|${o.style || 'four'}`];
  if (sp) {
    ctx.fillStyle = `rgba(0,0,0,${0.28 - lift / sc * 0.3})`; ctx.beginPath(); ctx.ellipse(0, u * 0.33 + lift, u * 0.27, u * 0.085, 0, 0, TAU); ctx.fill();
    if (o.glow) { const gg = ctx.createRadialGradient(0, 0, u * 0.05, 0, 0, u * 0.62); gg.addColorStop(0, `rgba(255,236,150,${0.5 * o.glow})`); gg.addColorStop(1, 'rgba(255,220,100,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, u * 0.62, 0, TAU); ctx.fill(); }
    const H = u * 0.98; ctx.drawImage(sp, -H / 2, u * 0.37 - H * 0.935, H, H);
    if (o.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${o.flash * 0.5})`; ctx.beginPath(); ctx.ellipse(0, 0, u * 0.3, u * 0.42, 0, 0, TAU); ctx.fill(); }
    ctx.restore(); return;
  }
  ctx.fillStyle = `rgba(0,0,0,${0.34 - lift / sc * 0.4})`; ctx.beginPath(); ctx.ellipse(0, u * 0.33 + lift, u * 0.27, u * 0.085, 0, 0, TAU); ctx.fill();
  if (o.glow) { const gg = ctx.createRadialGradient(0, 0, u * 0.05, 0, 0, u * 0.62); gg.addColorStop(0, `rgba(255,236,150,${0.55 * o.glow})`); gg.addColorStop(1, 'rgba(255,220,100,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, u * 0.62, 0, TAU); ctx.fill(); }
  // body (a rounded cone with a trim band)
  let g = ctx.createLinearGradient(-u * 0.26, 0, u * 0.26, 0); g.addColorStop(0, sd.light); g.addColorStop(0.35, sd.main); g.addColorStop(1, sd.dark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-u * 0.27, u * 0.3); ctx.quadraticCurveTo(-u * 0.3, u * 0.34, -u * 0.2, u * 0.34); ctx.lineTo(u * 0.2, u * 0.34); ctx.quadraticCurveTo(u * 0.3, u * 0.34, u * 0.27, u * 0.3);
  ctx.quadraticCurveTo(u * 0.16, -u * 0.02, u * 0.12, -u * 0.06); ctx.lineTo(-u * 0.12, -u * 0.06); ctx.quadraticCurveTo(-u * 0.16, -u * 0.02, -u * 0.27, u * 0.3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = Math.max(1, u * 0.02); ctx.stroke();
  ctx.strokeStyle = sd.trim; ctx.lineWidth = u * 0.045; ctx.beginPath(); ctx.moveTo(-u * 0.25, u * 0.26); ctx.quadraticCurveTo(0, u * 0.3, u * 0.25, u * 0.26); ctx.stroke();   // hem
  ctx.fillStyle = sd.trim; ctx.fillRect(-u * 0.04, u * 0.02, u * 0.08, u * 0.1);                                                                                              // belt buckle
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(-u * 0.1, u * 0.12, u * 0.035, u * 0.12, 0.2, 0, TAU); ctx.fill();
  // head
  g = ctx.createRadialGradient(-u * 0.04, -u * 0.2, u * 0.01, 0, -u * 0.15, u * 0.15); g.addColorStop(0, '#fbe3c0'); g.addColorStop(1, '#c58a5c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -u * 0.15, u * 0.12, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(60,30,10,0.55)'; ctx.lineWidth = Math.max(1, u * 0.018); ctx.stroke();
  // cap
  ctx.fillStyle = sd.main; ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  if ((o.style || 'four') === 'four') {                              // the four-winds cap: a band with four points
    ctx.beginPath(); ctx.moveTo(-u * 0.14, -u * 0.2); ctx.lineTo(-u * 0.19, -u * 0.38); ctx.lineTo(-u * 0.07, -u * 0.3); ctx.lineTo(0, -u * 0.43); ctx.lineTo(u * 0.07, -u * 0.3); ctx.lineTo(u * 0.19, -u * 0.38); ctx.lineTo(u * 0.14, -u * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = sd.trim; ctx.fillRect(-u * 0.14, -u * 0.235, u * 0.28, u * 0.04);
  } else {
    ctx.beginPath(); ctx.arc(0, -u * 0.2, u * 0.145, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = sd.trim; ctx.fillRect(-u * 0.145, -u * 0.22, u * 0.29, u * 0.04); ctx.beginPath(); ctx.arc(0, -u * 0.35, u * 0.03, 0, TAU); ctx.fill();
  }
  if (o.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${o.flash * 0.5})`; ctx.beginPath(); ctx.ellipse(0, 0, u * 0.3, u * 0.42, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// The king: a white reindeer with branching antlers, on a ring in its owner's colour (silver while neutral).
export function drawKing(ctx, owner, x, y, s, t, o = {}) {
  const u = (o.scale || 1) * s * 1.05, lift = (o.lift || 0) * u * 0.3, ring = owner < 0 ? '#dfe8ff' : SIDE[owner].main;
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.translate(x, y - lift);
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.beginPath(); ctx.ellipse(0, u * 0.33 + lift, u * 0.3, u * 0.09, 0, 0, TAU); ctx.fill();
  const ks = sprites.ready && sprites.king[String(owner)];
  if (ks) {
    const gg = ctx.createRadialGradient(0, 0, u * 0.05, 0, 0, u * 0.7); gg.addColorStop(0, `rgba(255,240,170,${0.35 + 0.15 * pulse})`); gg.addColorStop(1, 'rgba(255,230,140,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, u * 0.7, 0, TAU); ctx.fill();
    const H = u * 1.1; ctx.drawImage(ks, -H / 2, u * 0.37 - H * 0.935, H, H);
    if (o.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${o.flash * 0.5})`; ctx.beginPath(); ctx.ellipse(0, 0, u * 0.35, u * 0.45, 0, 0, TAU); ctx.fill(); }
    ctx.restore(); return;
  }
  const gg = ctx.createRadialGradient(0, 0, u * 0.05, 0, 0, u * 0.7); gg.addColorStop(0, `rgba(255,240,170,${0.45 + 0.2 * pulse})`); gg.addColorStop(1, 'rgba(255,230,140,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, u * 0.7, 0, TAU); ctx.fill();
  ctx.strokeStyle = ring; ctx.lineWidth = u * 0.07; ctx.beginPath(); ctx.ellipse(0, u * 0.3, u * 0.3, u * 0.1, 0, 0, TAU); ctx.stroke();
  // antlers
  ctx.strokeStyle = '#e9c777'; ctx.lineWidth = Math.max(1.5, u * 0.045); ctx.lineCap = 'round';
  for (const sgn of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sgn * u * 0.05, -u * 0.24); ctx.quadraticCurveTo(sgn * u * 0.2, -u * 0.34, sgn * u * 0.2, -u * 0.52);
    ctx.moveTo(sgn * u * 0.15, -u * 0.36); ctx.lineTo(sgn * u * 0.31, -u * 0.38); ctx.moveTo(sgn * u * 0.19, -u * 0.46); ctx.lineTo(sgn * u * 0.07, -u * 0.55); ctx.moveTo(sgn * u * 0.2, -u * 0.52); ctx.lineTo(sgn * u * 0.3, -u * 0.58); ctx.stroke();
  }
  // body, legs, neck, head
  let g = ctx.createLinearGradient(0, -u * 0.1, 0, u * 0.3); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c4d0e8');
  ctx.fillStyle = g; ctx.strokeStyle = 'rgba(40,50,90,0.55)'; ctx.lineWidth = Math.max(1, u * 0.02);
  ctx.beginPath(); ctx.ellipse(0, u * 0.1, u * 0.28, u * 0.17, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d6dff2'; for (const lx of [-0.17, -0.07, 0.07, 0.17]) { ctx.fillRect(u * lx - u * 0.025, u * 0.2, u * 0.05, u * 0.12); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(u * 0.1, u * 0.02); ctx.lineTo(u * 0.1, -u * 0.12); ctx.lineTo(u * 0.2, -u * 0.12); ctx.lineTo(u * 0.22, u * 0.05); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(u * 0.04, -u * 0.18, u * 0.14, u * 0.11, -0.2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#232b4a'; ctx.beginPath(); ctx.arc(u * 0.0, -u * 0.2, u * 0.022, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8a4d3a'; ctx.beginPath(); ctx.arc(-u * 0.1, -u * 0.15, u * 0.028, 0, TAU); ctx.fill();
  if (o.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${o.flash * 0.5})`; ctx.beginPath(); ctx.ellipse(0, 0, u * 0.35, u * 0.45, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// A die: carved bone. val 0 = Dawn (a sun), 1..3 = pips. o: { used, sel, spin (0..1 rolling), t, can }.
export function drawDie(ctx, val, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y);
  if (o.spin) { ctx.rotate(Math.sin(o.spin * 18) * 0.35 * (1 - o.spin)); ctx.translate(0, -Math.sin(o.spin * Math.PI) * s * 0.35); }
  const r = s * 0.2, half = s / 2;
  ctx.globalAlpha = o.used ? 0.38 : 1;
  const ds = sprites.ready && sprites.die[o.blank ? 'blank' : val];
  if (ds) {
    const H = s * 1.22;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, half * 0.82, half * 0.9, half * 0.22, 0, 0, TAU); ctx.fill();
    ctx.drawImage(ds, -H / 2, -H * 0.5 - s * 0.04, H, H);
    if (o.sel || o.can) { ctx.lineWidth = o.sel ? 4 : 3; ctx.strokeStyle = o.sel ? '#ffb020' : 'rgba(90,230,150,0.95)'; rr(ctx, -half - 3, -half - 3, s + 6, s + 6, r); ctx.stroke(); }
    ctx.restore(); return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; rr(ctx, -half + 2, -half + 6, s, s, r); ctx.fill();
  const g = ctx.createLinearGradient(-half, -half, half, half); g.addColorStop(0, '#fff7e3'); g.addColorStop(1, '#d9c597');
  ctx.fillStyle = g; rr(ctx, -half, -half, s, s, r); ctx.fill();
  ctx.lineWidth = o.sel ? 4 : 2; ctx.strokeStyle = o.sel ? '#ffb020' : o.can ? 'rgba(90,230,150,0.95)' : 'rgba(80,48,20,0.7)'; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; rr(ctx, -half + 4, -half + 4, s - 8, s - 8, r * 0.7); ctx.stroke();
  if (o.blank) { ctx.fillStyle = 'rgba(80,48,20,0.35)'; ctx.font = `800 ${s * 0.45}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('?', 0, s * 0.16); }
  else if (val === 0) {                                             // Dawn: a sun with rays
    ctx.fillStyle = '#e8821a'; ctx.beginPath(); ctx.arc(0, 0, s * 0.17, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e8821a'; ctx.lineWidth = Math.max(2, s * 0.05); ctx.lineCap = 'round';
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.25, Math.sin(a) * s * 0.25); ctx.lineTo(Math.cos(a) * s * 0.36, Math.sin(a) * s * 0.36); ctx.stroke(); }
  } else {
    const spots = val === 1 ? [[0, 0]] : val === 2 ? [[-0.2, -0.2], [0.2, 0.2]] : [[-0.24, -0.24], [0, 0], [0.24, 0.24]];
    for (const [px, py] of spots) { ctx.fillStyle = '#3a2310'; ctx.beginPath(); ctx.arc(px * s, py * s, s * 0.095, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(px * s - s * 0.025, py * s - s * 0.03, s * 0.03, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// A little board for the Rules page: spec = { men: [[cell, p], ...], king: cell|null, kingOwner, marks: [[cell,'dot'|'cap'|'ring'|'x'],...], arrows: [[from,to],...], label: {cell: 'text'} }.
export function miniBoard(ctx, spec, x, y, c, woodKey) {
  const B = { x, y, S: c * (N + 2 * FRAME), cell: c, gx: x + c * FRAME, gy: y + c * FRAME, sq: (i) => ({ x: x + c * FRAME + ((i % N) + 0.5) * c, y: y + c * FRAME + (Math.floor(i / N) + 0.5) * c }) };
  drawBoard(ctx, B, woodKey);
  for (const [i, kind] of spec.marks || []) {
    const q = B.sq(i);
    if (kind === 'dot') { ctx.fillStyle = 'rgba(40,160,90,0.85)'; ctx.beginPath(); ctx.arc(q.x, q.y, c * 0.15, 0, TAU); ctx.fill(); }
    else if (kind === 'cap') { ctx.strokeStyle = '#e23c24'; ctx.lineWidth = c * 0.08; ctx.beginPath(); ctx.arc(q.x, q.y, c * 0.4, 0, TAU); ctx.stroke(); }
    else if (kind === 'ring') { ctx.strokeStyle = '#ffb020'; ctx.lineWidth = c * 0.07; ctx.beginPath(); ctx.arc(q.x, q.y, c * 0.42, 0, TAU); ctx.stroke(); }
  }
  const seen = {};
  for (const [i, p] of spec.men || []) { const q = B.sq(i), k = (seen[i] = (seen[i] || 0) + 1), dx = k === 1 ? 0 : c * 0.18; drawHerder(ctx, p, q.x + (k > 1 ? dx : 0) - ((spec.men || []).filter((m) => m[0] === i).length > 1 ? c * 0.09 : 0), q.y + c * 0.02, c * (k > 1 || (spec.men || []).filter((m) => m[0] === i).length > 1 ? 0.8 : 0.95)); }
  if (spec.king !== undefined && spec.king !== null) { const q = B.sq(spec.king); drawKing(ctx, spec.kingOwner ?? -1, q.x, q.y, c * 0.95, 0); }
  for (const [a, b] of spec.arrows || []) {
    const p0 = B.sq(a), p1 = B.sq(b), ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    ctx.strokeStyle = '#ffb020'; ctx.fillStyle = '#ffb020'; ctx.lineWidth = c * 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x - Math.cos(ang) * c * 0.2, p1.y - Math.sin(ang) * c * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p1.x - Math.cos(ang - 0.5) * c * 0.3, p1.y - Math.sin(ang - 0.5) * c * 0.3); ctx.lineTo(p1.x - Math.cos(ang + 0.5) * c * 0.3, p1.y - Math.sin(ang + 0.5) * c * 0.3); ctx.closePath(); ctx.fill();
  }
  return B;
}
export const miniSize = (c) => c * (N + 2 * FRAME) + c * 0.3;
