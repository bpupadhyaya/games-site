// Scene painter: every card of every tale is drawn from data (sky, ground, props with states, characters).
// A card is a 400 x 300 picture. Bold ink lines and flat cut-paper colours, the way street picture cards were drawn.
// Pure drawing: reads only its arguments, never game state.

export const CW = 400, CH = 300;
const INK = '#2b1d16';
const TAU = Math.PI * 2;

const SKY = {
  dawn: ['#9d9bdc', '#ffb9a0', '#ffe3a8'],
  day: ['#6cbcf0', '#a9dcf8', '#e4f6ff'],
  dusk: ['#4b3f8c', '#d8638a', '#ffb56b'],
  night: ['#0b1433', '#1d2f6a', '#3a5599'],
  rain: ['#5d7890', '#8ea6b8', '#c1d0da'],
  snow: ['#a8b9cf', '#cfdae7', '#f1f5fa'],
  room: ['#f4e0b6', '#f4e0b6', '#f4e0b6'],
};
const GROUND = {
  grass: { y: 188, a: '#86cc6e', b: '#5faa52' },
  road: { y: 192, a: '#8bcd72', b: '#e3c895' },
  sand: { y: 200, a: '#f2dfab', b: '#e0c585' },
  snow: { y: 190, a: '#fbfdff', b: '#dde8f2' },
  water: { y: 150, a: '#58b2e0', b: '#2f86bd' },
  floor: { y: 215, a: '#c28a55', b: '#9c6a3e' },
  hill: { y: 175, a: '#8cd076', b: '#5fae56' },
};
const NIGHTY = new Set(['night']);

// ---- primitives --------------------------------------------------------------------------------------------------------------
function shape(ctx, build, fill, lw = 3, stroke = INK) {
  ctx.beginPath(); build();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
const ell = (ctx, x, y, rx, ry, fill, lw = 3, rot = 0) => shape(ctx, () => ctx.ellipse(x, y, rx, ry, rot, 0, TAU), fill, lw);
const circ = (ctx, x, y, r, fill, lw = 3) => shape(ctx, () => ctx.arc(x, y, r, 0, TAU), fill, lw);
const rect = (ctx, x, y, w, h, r, fill, lw = 3) => shape(ctx, () => ctx.roundRect(x, y, w, h, r), fill, lw);
const poly = (ctx, pts, fill, lw = 3) => shape(ctx, () => { pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }, fill, lw);
const line = (ctx, x1, y1, x2, y2, lw = 3, col = INK) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.stroke(); };
const curve = (ctx, x1, y1, cx, cy, x2, y2, lw = 3, col = INK) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.stroke(); };
const shadow = (ctx, x, y, rx) => { ctx.fillStyle = 'rgba(30,20,10,0.22)'; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.22, 0, 0, TAU); ctx.fill(); };
const shine = (ctx, x, y, rx, ry, rot = -0.5) => { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };

// ---- faces ---------------------------------------------------------------------------------------------------------------------
// Drawn around (0, 0) = head centre, radius r. look: -1 left, 0 centre, 1 right, 2 up.
function face(ctx, r, mood = 'happy', look = 0) {
  const ex = r * 0.4, ey = -r * 0.04, er = Math.max(2.4, r * 0.12);
  const eyeDots = () => {
    const ox = look === 2 ? 0 : look * er * 0.5, oy = look === 2 ? -er * 0.6 : 0;
    for (const sx of [-1, 1]) { circ(ctx, sx * ex + ox, ey + oy, er, INK, 0); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * ex + ox + er * 0.3, ey + oy - er * 0.3, er * 0.32, 0, TAU); ctx.fill(); }
  };
  const arcUp = (sx) => { ctx.beginPath(); ctx.arc(sx * ex, ey + er * 0.7, er * 1.15, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); };
  const cheeks = () => { ctx.fillStyle = 'rgba(255,110,110,0.45)'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * r * 0.62, r * 0.28, r * 0.17, r * 0.11, 0, 0, TAU); ctx.fill(); } };
  const smile = (w, d) => { ctx.beginPath(); ctx.moveTo(-r * w, r * 0.3); ctx.quadraticCurveTo(0, r * 0.3 + r * d, r * w, r * 0.3); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); };
  if (mood === 'happy') { eyeDots(); smile(0.28, 0.34); cheeks(); }
  else if (mood === 'proud') { arcUp(-1); arcUp(1); smile(0.36, 0.5); cheeks(); }
  else if (mood === 'sad') {
    eyeDots(); line(ctx, -ex - er, ey - er * 2.3, -ex + er, ey - er * 1.4, 2.4); line(ctx, ex + er, ey - er * 2.3, ex - er, ey - er * 1.4, 2.4);
    ctx.beginPath(); ctx.moveTo(-r * 0.22, r * 0.46); ctx.quadraticCurveTo(0, r * 0.28, r * 0.22, r * 0.46); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#7fc4ff'; ctx.beginPath(); ctx.ellipse(-ex - er * 0.2, ey + er * 2.4, er * 0.5, er * 0.9, 0, 0, TAU); ctx.fill();
  } else if (mood === 'wow') {
    for (const sx of [-1, 1]) { circ(ctx, sx * ex, ey, er * 1.35, '#fff', 2.2); circ(ctx, sx * ex, ey, er * 0.7, INK, 0); }
    ell(ctx, 0, r * 0.4, r * 0.13, r * 0.17, '#7a2b22', 2.2);
  } else if (mood === 'sleep') {
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * ex, ey - er * 0.4, er * 1.1, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); }
    ell(ctx, 0, r * 0.4, r * 0.1, r * 0.08, '#7a2b22', 2);
  } else if (mood === 'worry') {
    eyeDots(); line(ctx, -ex - er, ey - er * 2.1, -ex + er, ey - er * 2.6, 2.4); line(ctx, ex + er, ey - er * 2.6, ex - er, ey - er * 2.1, 2.4);
    ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.42); ctx.lineTo(-r * 0.07, r * 0.34); ctx.lineTo(r * 0.07, r * 0.44); ctx.lineTo(r * 0.2, r * 0.36); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
  } else { eyeDots(); smile(0.2, 0.15); }
}

// ---- characters (origin = feet; ~100 units tall at s = 1) -------------------------------------------------------------------------
function kid(ctx, s, a = {}, mood = 'happy', t = 0) {
  // Illustrated young person with natural proportions (about 5.5 heads), tapered limbs, shaded cloth, hands, ears, neck.
  const c = a.c ?? '#e2503c', hair = a.hair ?? '#2b1d16', bob = Math.sin(t * 3) * 1.2, SKIN = '#f3c8a0', SKIN_D = '#dca57c';
  const PANTS = '#38405e', ink = INK;
  if (a.flip) ctx.scale(-1, 1);
  shadow(ctx, 0, 2, 24);
  const step = a.walk ? Math.sin(t * 8) * 4 : 0;
  const limb = (pts, w, col, hand) => {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [lw, st] of [[w + 3.2, ink], [w, col]]) {
      ctx.beginPath(); pts.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.lineWidth = lw; ctx.strokeStyle = st; ctx.stroke();
    }
    if (hand) { const [hx, hy] = pts[pts.length - 1]; ell(ctx, hx, hy, 4.4, 4.9, SKIN, 2.2); ell(ctx, hx - 0.8, hy + 1.8, 1.5, 1.1, SKIN_D, 0); }
  };
  // legs and shoes (slightly tapered, darker inner leg for depth)
  for (const [sx, st] of [[-1, step], [1, -step]]) {
    const hx = sx * 6.5, kx = sx * 7 + st * 0.4, ax = sx * 7.5 + st;
    limb([[hx, -38], [kx, -21], [ax, -6]], 9.5, PANTS);
    shape(ctx, () => ctx.ellipse(ax + sx * 2.5, -3, 9, 4.6, 0, 0, TAU), '#2b1d16', 2.2);
    shine(ctx, ax + sx * 2.5 - 2, -5, 3.6, 1.2, 0);
  }
  const arm = a.arms ?? 'down';
  const far = arm === 'up' ? [[14, -60], [24, -76 + bob], [30, -92 + bob]] : arm === 'out' ? [[14, -60], [26, -57], [38, -52]] : arm === 'hold' ? [[14, -60], [21, -48], [27, -39]] : null;
  if (far) limb(far, 8, c, true);
  // neck
  rect(ctx, -4.5, -72, 9, 9, 3, SKIN_D, 2);
  // body: yukata-like coat flaring to the hem, cel-shaded right side, collar V, obi with knot
  shape(ctx, () => { ctx.moveTo(-14, -66); ctx.quadraticCurveTo(-20, -52, -15, -29); ctx.lineTo(15, -29); ctx.quadraticCurveTo(20, -52, 14, -66); ctx.quadraticCurveTo(0, -70, -14, -66); ctx.closePath(); }, c, 3);
  ctx.save(); ctx.beginPath(); ctx.moveTo(4, -68); ctx.quadraticCurveTo(14, -66, 14, -66); ctx.quadraticCurveTo(20, -52, 15, -29); ctx.lineTo(5, -29); ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,0.17)'; ctx.fill(); ctx.restore();
  poly(ctx, [[-7, -68], [0, -53], [7, -68], [3, -69], [0, -62], [-3, -69]], '#fbf1dc', 2);
  rect(ctx, -16, -46, 32, 9, 3, '#f7d86a', 2.4);
  rect(ctx, 6, -48, 9, 12, 3, '#e3b53a', 2);
  line(ctx, -13, -33, 13, -33, 1.6, 'rgba(0,0,0,0.25)');
  // near arm
  if (!far) limb([[-14, -60], [-19, -47], [-20, -35]], 8, c, true);
  else if (arm === 'out' || arm === 'up') limb([[-14, -60], [-24, -52], [arm === 'up' ? -32 : -36, arm === 'up' ? -42 : -48]], 8, c, true);
  // head: oval face, ears, layered hair with highlight
  ctx.save(); ctx.translate(0, -87 + bob);
  ell(ctx, -14, 2, 3.4, 4.4, SKIN, 2); ell(ctx, 14, 2, 3.4, 4.4, SKIN, 2);
  ell(ctx, 0, 0, 14, 16, SKIN, 3);
  shape(ctx, () => { ctx.moveTo(-15.5, 2); ctx.bezierCurveTo(-18, -17, -8, -22, 0, -22); ctx.bezierCurveTo(8, -22, 18, -17, 15.5, 2); ctx.lineTo(13, -7); ctx.quadraticCurveTo(0, -17, -13, -7); ctx.closePath(); }, hair, 2.6);
  rect(ctx, -17, -4, 5, 20, 3, hair, 2.2); rect(ctx, 12, -4, 5, 20, 3, hair, 2.2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(-2, -6, 12, Math.PI * 1.15, Math.PI * 1.5); ctx.stroke();
  if (a.topknot) circ(ctx, 0, -26, 6, hair, 2.6);
  face(ctx, 15.5, mood, a.look ?? 0);
  ctx.restore();
}

function fox(ctx, s, a = {}, mood = 'happy', t = 0) {
  if (a.flip) ctx.scale(-1, 1);
  const sway = Math.sin(t * 2.6) * 0.1;
  shadow(ctx, 0, 2, 30);
  ctx.save(); ctx.translate(-20, -20); ctx.rotate(-0.5 + sway);
  shape(ctx, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -14, -36, -42); ctx.quadraticCurveTo(-8, -40, 8, -16); ctx.closePath(); }, '#ec8a35', 3);
  shape(ctx, () => { ctx.moveTo(-31, -30); ctx.quadraticCurveTo(-36, -42, -36, -42); ctx.quadraticCurveTo(-22, -42, -18, -30); ctx.closePath(); }, '#fff6e6', 2);
  ctx.restore();
  ell(ctx, 0, -28, 24, 22, '#ee8f3a', 3);
  ell(ctx, 4, -22, 13, 14, '#fff3de', 0);
  rect(ctx, -14, -12, 9, 14, 4, '#7a3b17', 2.4); rect(ctx, 6, -12, 9, 14, 4, '#7a3b17', 2.4);
  // head
  ctx.save(); ctx.translate(16, -52);
  poly(ctx, [[-14, -10], [-9, -32], [0, -14]], '#ee8f3a', 3); poly(ctx, [[2, -14], [10, -32], [16, -8]], '#ee8f3a', 3);
  poly(ctx, [[-10, -14], [-8, -24], [-3, -15]], '#3a1c0c', 0); poly(ctx, [[5, -15], [9, -24], [12, -12]], '#3a1c0c', 0);
  shape(ctx, () => { ctx.moveTo(-18, 0); ctx.quadraticCurveTo(-18, -18, 0, -18); ctx.quadraticCurveTo(20, -18, 20, 0); ctx.quadraticCurveTo(20, 14, 6, 14); ctx.lineTo(-6, 14); ctx.quadraticCurveTo(-18, 14, -18, 0); }, '#ee8f3a', 3);
  shape(ctx, () => { ctx.moveTo(-14, 6); ctx.quadraticCurveTo(0, 0, 16, 6); ctx.quadraticCurveTo(10, 14, 0, 14); ctx.quadraticCurveTo(-10, 14, -14, 6); }, '#fff3de', 0);
  circ(ctx, 0, 2, 3.4, INK, 0);
  face(ctx, 18, mood === 'happy' ? 'proud' : mood, a.look ?? 0);
  ctx.restore();
}

function cat(ctx, s, a = {}, mood = 'happy', t = 0) {
  if (a.flip) ctx.scale(-1, 1);
  const col = a.c ?? '#f1e4cf', sway = Math.sin(t * 2) * 0.12;
  shadow(ctx, 0, 2, 26);
  if (a.sleep) { ell(ctx, 0, -17, 30, 17, col, 3); circ(ctx, 18, -22, 15, col, 3); poly(ctx, [[8, -34], [10, -46], [18, -35]], col, 2.6); poly(ctx, [[20, -35], [27, -45], [30, -30]], col, 2.6); ctx.save(); ctx.translate(18, -22); face(ctx, 15, 'sleep'); ctx.restore(); curve(ctx, -28, -14, -40, -6, -30, 2, 7, INK); curve(ctx, -28, -14, -40, -6, -30, 2, 4, col); return; }
  ctx.save(); ctx.translate(-22, -22); ctx.rotate(-0.4 + sway); curve(ctx, 0, 0, -16, -10, -14, -34, 9, INK); curve(ctx, 0, 0, -16, -10, -14, -34, 5.4, col); ctx.restore();
  shape(ctx, () => { ctx.moveTo(-20, 0); ctx.quadraticCurveTo(-26, -38, -4, -44); ctx.quadraticCurveTo(18, -38, 18, 0); ctx.closePath(); }, col, 3);
  line(ctx, -14, -22, -6, -22, 3, '#c98f5a'); line(ctx, -14, -30, -6, -30, 3, '#c98f5a');
  ctx.save(); ctx.translate(0, -52);
  poly(ctx, [[-17, -8], [-14, -28], [-3, -14]], col, 3); poly(ctx, [[3, -14], [14, -28], [17, -8]], col, 3);
  poly(ctx, [[-13, -12], [-12, -22], [-6, -14]], '#f3a2a2', 0); poly(ctx, [[6, -14], [12, -22], [13, -12]], '#f3a2a2', 0);
  ell(ctx, 0, 0, 20, 17, col, 3);
  face(ctx, 18, mood, a.look ?? 0);
  line(ctx, -26, 4, -14, 6, 2, INK); line(ctx, -26, 10, -14, 9, 2, INK); line(ctx, 26, 4, 14, 6, 2, INK); line(ctx, 26, 10, 14, 9, 2, INK);
  ctx.restore();
}

function bird(ctx, s, a = {}, mood = 'happy', t = 0) {
  if (a.flip) ctx.scale(-1, 1);
  const col = a.c ?? '#c9894e', fl = a.fly ? Math.sin(t * 14) * 0.6 : 0;
  if (!a.fly) shadow(ctx, 0, 2, 16);
  ctx.save(); ctx.translate(0, a.fly ? -20 : -17);
  poly(ctx, [[-12, 2], [-30, 12], [-14, 10]], '#8a5a2e', 2.6);
  ell(ctx, 0, 0, 20, 17, col, 3);
  ell(ctx, 3, 5, 12, 9, '#fff0d4', 0);
  ctx.save(); ctx.translate(-2, -4); ctx.rotate(-0.4 + fl); ell(ctx, -4, 0, 12, 7, '#a9703a', 2.6); ctx.restore();
  poly(ctx, [[16, -8], [28, -4], [16, 0]], '#f7b733', 2.4);
  ctx.save(); ctx.translate(10, -8); face(ctx, 9, mood === 'happy' ? 'worry' : mood); ctx.restore();
  if (!a.fly) { line(ctx, -4, 16, -4, 24, 2.4); line(ctx, 6, 16, 6, 24, 2.4); }
  ctx.restore();
}

function frog(ctx, s, a = {}, mood = 'happy', t = 0) {
  if (a.flip) ctx.scale(-1, 1);
  const col = '#78c850', puff = 1 + Math.sin(t * 4) * 0.03;
  shadow(ctx, 0, 2, 26);
  ell(ctx, 0, -16, 24 * puff, 17 * puff, col, 3); ell(ctx, 0, -9, 14, 8, '#e6f7b8', 0);
  rect(ctx, -30, -9, 16, 9, 4, col, 2.6); rect(ctx, 14, -9, 16, 9, 4, col, 2.6);
  for (const sx of [-1, 1]) { circ(ctx, sx * 12, -33, 8.5, col, 3); circ(ctx, sx * 12, -34, 4.2, '#fff', 1.8); circ(ctx, sx * 12 + (a.look ?? 0) * 1.4, -34, 2.2, INK, 0); }
  ctx.save(); ctx.translate(0, -20);
  if (mood === 'sad' || mood === 'worry') { ctx.beginPath(); ctx.moveTo(-9, 6); ctx.quadraticCurveTo(0, 0, 9, 6); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(-10, 2); ctx.quadraticCurveTo(0, 12, 10, 2); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.restore();
}

function turtle(ctx, s, a = {}, mood = 'happy', t = 0) {
  if (a.flip) ctx.scale(-1, 1);
  shadow(ctx, 0, 2, 30);
  rect(ctx, -22, -10, 12, 11, 5, '#9bd36a', 2.6); rect(ctx, 8, -10, 12, 11, 5, '#9bd36a', 2.6);
  poly(ctx, [[-30, -14], [-40, -10], [-30, -8]], '#9bd36a', 2.4);
  shape(ctx, () => { ctx.moveTo(-30, -9); ctx.quadraticCurveTo(-30, -48, 0, -48); ctx.quadraticCurveTo(30, -48, 30, -9); ctx.closePath(); }, '#4f9a53', 3);
  ctx.save(); ctx.clip(); line(ctx, -14, -46, -14, -9, 2, 'rgba(0,0,0,0.35)'); line(ctx, 8, -46, 8, -9, 2, 'rgba(0,0,0,0.35)'); line(ctx, -30, -28, 30, -28, 2, 'rgba(0,0,0,0.35)'); ctx.restore();
  ell(ctx, 38, -22, 14, 12, '#9bd36a', 3); ctx.save(); ctx.translate(40, -23); face(ctx, 11, mood); ctx.restore();
}

function fish(ctx, s, a = {}, mood, t = 0) {
  if (a.flip) ctx.scale(-1, 1);
  const w = Math.sin(t * 5) * 0.14;
  poly(ctx, [[-20, 0], [-38, -13 + w * 30], [-38, 13 - w * 30]], '#ff8a3d', 2.8);
  ell(ctx, 0, 0, 24, 14, '#ffa24a', 3); ell(ctx, 4, 4, 14, 6, '#ffe2b0', 0);
  circ(ctx, 12, -3, 3.4, '#fff', 1.6); circ(ctx, 13, -3, 1.6, INK, 0);
  curve(ctx, 20, 3, 23, 5, 20, 7, 2);
}

// ---- props -----------------------------------------------------------------------------------------------------------------------
const P = {
  sun(ctx, s, a, b, t) { ctx.save(); ctx.rotate(t * 0.15); for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); poly(ctx, [[-4, 30], [4, 30], [0, 44]], '#ffd23f', 2.2); } ctx.restore(); circ(ctx, 0, 0, 27, '#ffe066', 3); shine(ctx, -8, -9, 9, 5); },
  moon(ctx) { shape(ctx, () => { ctx.arc(0, 0, 26, 0, TAU); }, '#fff4c0', 3); ctx.save(); ctx.globalAlpha = 1; shape(ctx, () => ctx.arc(11, -5, 22, 0, TAU), '#1c2c63', 0); ctx.restore(); },
  cloud(ctx, s, a) {
    const g = a === 'dark' ? '#8d9aab' : '#ffffff', parts = [[-22, 0, 16], [0, -10, 21], [24, 0, 17], [2, 4, 15]];
    ctx.lineJoin = 'round'; ctx.fillStyle = INK;
    for (const [x, y, r] of parts) { ctx.beginPath(); ctx.arc(x, y, r + 2.4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = g; for (const [x, y, r] of parts) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.0)';
  },
  rainbow(ctx) { const cols = ['#ff5a5a', '#ffb347', '#ffe566', '#7ed957', '#5aa9ff', '#a77bff']; cols.forEach((c, i) => { ctx.beginPath(); ctx.arc(0, 0, 70 - i * 6.5, Math.PI, 0); ctx.lineWidth = 7; ctx.strokeStyle = c; ctx.stroke(); }); },
  stars(ctx) { for (let i = 0; i < 14; i++) { const x = ((i * 97) % 380) + 10, y = ((i * 53) % 110) + 8; ctx.fillStyle = '#fff7d0'; ctx.beginPath(); ctx.arc(x, y, i % 3 === 0 ? 2.4 : 1.6, 0, TAU); ctx.fill(); } },
  tree(ctx, s, a) {
    shadow(ctx, 0, 2, 40);
    shape(ctx, () => { ctx.moveTo(-9, 0); ctx.lineTo(-6, -64); ctx.lineTo(6, -64); ctx.lineTo(9, 0); ctx.closePath(); }, '#8b5a33', 3);
    const leaf = { green: ['#5cb85c', '#3f9a47'], blossom: ['#ffc0d4', '#ff9fbf'], autumn: ['#f0883e', '#d9622b'], fruit: ['#5cb85c', '#3f9a47'], bare: null, snow: ['#ffffff', '#dfe9f3'] }[a ?? 'green'];
    if (!leaf) { line(ctx, 0, -56, -26, -92, 5); line(ctx, 0, -50, 24, -88, 5); line(ctx, -14, -74, -34, -76, 3); line(ctx, 12, -72, 32, -70, 3); line(ctx, 0, -64, 0, -100, 5); return; }
    circ(ctx, -26, -76, 25, leaf[1], 3); circ(ctx, 26, -76, 25, leaf[1], 3); circ(ctx, 0, -98, 32, leaf[0], 3); circ(ctx, 0, -70, 28, leaf[0], 3);
    if (a === 'fruit') for (const [x, y] of [[-20, -80], [14, -66], [4, -104], [28, -86]]) circ(ctx, x, y, 5.5, '#e8382d', 2);
    if (a === 'blossom') for (let i = 0; i < 9; i++) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-30 + ((i * 29) % 62), -62 - ((i * 37) % 52), 3, 0, TAU); ctx.fill(); }
  },
  pine(ctx, s, a) { shadow(ctx, 0, 2, 28); rect(ctx, -5, -18, 10, 18, 2, '#7a4f2c', 2.6); for (let i = 0; i < 3; i++) poly(ctx, [[-30 + i * 6, -14 - i * 28], [30 - i * 6, -14 - i * 28], [0, -52 - i * 28]], a === 'snow' ? '#e8f1f8' : '#2f8a56', 3); },
  bush(ctx) { ctx.beginPath(); ctx.arc(-14, -10, 14, 0, TAU); ctx.arc(8, -14, 17, 0, TAU); ctx.arc(24, -8, 12, 0, TAU); ctx.fillStyle = '#4faa57'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); },
  rock(ctx) { shape(ctx, () => { ctx.moveTo(-24, 0); ctx.quadraticCurveTo(-26, -22, -6, -26); ctx.quadraticCurveTo(18, -30, 26, 0); ctx.closePath(); }, '#a7a9b0', 3); shine(ctx, -6, -16, 7, 3); },
  flower(ctx, s, a, b, t) {
    const st = Number(a ?? 3);
    ell(ctx, 0, -2, 20, 7, '#7a4f2c', 2.6);
    if (st === 0) { ell(ctx, 0, -10, 9, 5, '#6a3f1f', 0); return; }
    const sway = Math.sin(t * 1.8) * 1.5;
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(sway, -26 * st, sway * 1.5, -30 - st * 16); ctx.lineWidth = 4; ctx.strokeStyle = '#3f9a47'; ctx.lineCap = 'round'; ctx.stroke();
    const top = -30 - st * 16;
    if (st === 1) { ell(ctx, -9, top + 10, 10, 5, '#5cb85c', 2.2, -0.5); ell(ctx, 9, top + 10, 10, 5, '#5cb85c', 2.2, 0.5); }
    else { ell(ctx, -11, top + 28, 12, 5.5, '#5cb85c', 2.2, -0.5); ell(ctx, 11, top + 22, 12, 5.5, '#5cb85c', 2.2, 0.5); }
    if (st === 2) ell(ctx, sway * 1.5, top - 4, 8, 12, '#ff9fb8', 2.6);
    if (st === 3) { for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(sway * 1.5, top); ctx.rotate((i * TAU) / 6); ell(ctx, 0, -13, 8, 12, '#ff7fa6', 2.4); ctx.restore(); } circ(ctx, sway * 1.5, top, 8, '#ffd23f', 2.6); }
  },
  house(ctx, s, a) {
    shadow(ctx, 0, 2, 56);
    rect(ctx, -46, -66, 92, 66, 3, '#f6e8cc', 3);
    poly(ctx, [[-58, -62], [0, -108], [58, -62]], '#b84a3a', 3);
    for (let i = -40; i < 44; i += 12) line(ctx, i, -66, i + 5, -62, 1.6, 'rgba(0,0,0,0.25)');
    rect(ctx, -10, -40, 24, 40, 2, '#8b5a33', 2.6);
    rect(ctx, -38, -52, 20, 20, 2, a === 'lit' ? '#ffe27a' : '#9ad0ee', 2.6); line(ctx, -28, -52, -28, -32, 2); line(ctx, -38, -42, -18, -42, 2);
  },
  stall(ctx, s, a, b, t) {
    shadow(ctx, 0, 2, 50);
    rect(ctx, -40, -34, 80, 34, 3, '#c28a55', 3); rect(ctx, -44, -40, 88, 10, 3, '#9c6a3e', 2.6);
    line(ctx, -38, -70, -38, -40, 4); line(ctx, 38, -70, 38, -40, 4);
    for (let i = 0; i < 6; i++) poly(ctx, [[-46 + i * 15.3, -92], [-30.7 + i * 15.3, -92], [-30.7 + i * 15.3, -70], [-46 + i * 15.3, -70]], i % 2 ? '#fff6e6' : '#e2503c', 2.4);
    circ(ctx, -16, -46, 8, '#f3b24a', 2.4); circ(ctx, 4, -46, 8, '#f3b24a', 2.4); circ(ctx, 24, -46, 8, '#f3b24a', 2.4);
  },
  fence(ctx) { for (let i = 0; i < 5; i++) rect(ctx, -44 + i * 20, -34, 10, 36, 3, '#d9b27a', 2.6); line(ctx, -48, -24, 52, -24, 5); line(ctx, -48, -10, 52, -10, 5); line(ctx, -48, -24, 52, -24, 2.4, '#d9b27a'); line(ctx, -48, -10, 52, -10, 2.4, '#d9b27a'); },
  bridge(ctx) { shape(ctx, () => { ctx.moveTo(-90, 0); ctx.quadraticCurveTo(0, -60, 90, 0); ctx.lineTo(90, 12); ctx.quadraticCurveTo(0, -44, -90, 12); ctx.closePath(); }, '#c03a2b', 3); for (let i = -2; i <= 2; i++) line(ctx, i * 34, -30 + Math.abs(i) * 12, i * 34, 6, 3); },
  boat(ctx, s, a, b, t) { const bob = Math.sin(t * 2) * 2; ctx.translate(0, bob); if (a === 'paper') { poly(ctx, [[-34, -8], [34, -8], [18, 8], [-18, 8]], '#fffaf0', 2.8); poly(ctx, [[-4, -8], [-4, -38], [22, -8]], '#ffe9d0', 2.6); poly(ctx, [[-4, -8], [-4, -38], [-26, -8]], '#ffffff', 2.6); } else { shape(ctx, () => { ctx.moveTo(-48, -10); ctx.lineTo(48, -10); ctx.lineTo(30, 12); ctx.lineTo(-30, 12); ctx.closePath(); }, '#c27a45', 3); line(ctx, 0, -10, 0, -68, 4); poly(ctx, [[2, -66], [2, -18], [38, -18]], '#fff6e6', 2.8); } },
  lantern(ctx, s, a, b, t) { const lit = a !== 'off'; if (lit) { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 44); g.addColorStop(0, 'rgba(255,220,120,0.65)'); g.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.fill(); } line(ctx, 0, -22, 0, -12, 2.4); rect(ctx, -9, -13, 18, 4, 2, '#3a2a1a', 2); ell(ctx, 0, 2, 13, 15, lit ? '#ffb020' : '#a35a3a', 3); line(ctx, -7, -9, -7, 13, 1.6, 'rgba(0,0,0,0.35)'); line(ctx, 7, -9, 7, 13, 1.6, 'rgba(0,0,0,0.35)'); rect(ctx, -9, 15, 18, 4, 2, '#3a2a1a', 2); if (lit) shine(ctx, -4, -3, 3, 6); },
  umbrella(ctx, s, a) { const col = a === 'blue' ? '#3d7be0' : '#e2503c'; line(ctx, 0, -6, 0, 64, 4); shape(ctx, () => { ctx.moveTo(-52, 0); ctx.quadraticCurveTo(0, -62, 52, 0); ctx.quadraticCurveTo(26, -8, 0, 0); ctx.quadraticCurveTo(-26, -8, -52, 0); }, col, 3); line(ctx, 0, -42, 0, 0, 2, 'rgba(0,0,0,0.3)'); line(ctx, -26, -30, -22, -4, 2, 'rgba(0,0,0,0.3)'); line(ctx, 26, -30, 22, -4, 2, 'rgba(0,0,0,0.3)'); },
  kite(ctx, s, a, b, t) { const w = Math.sin(t * 3) * 0.08; ctx.rotate(a === 'new' ? 0.4 : -0.35 + w); poly(ctx, [[0, -34], [24, 0], [0, 40], [-24, 0]], '#ff5a5f', 3); poly(ctx, [[0, -34], [24, 0], [0, 0]], '#ffd23f', 2.4); poly(ctx, [[0, 0], [-24, 0], [0, 40]], '#3d9be0', 2.4); line(ctx, 0, -34, 0, 40, 2); line(ctx, -24, 0, 24, 0, 2); if (a !== 'new') { ctx.beginPath(); ctx.moveTo(0, 40); ctx.bezierCurveTo(-12, 56, 12, 66, -4, 84); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke(); for (const [x, y] of [[-6, 56], [3, 68]]) poly(ctx, [[x - 6, y], [x + 6, y], [x, y + 9]], '#ffd23f', 2); } },
  basket(ctx, s, a) { shape(ctx, () => { ctx.moveTo(-26, -22); ctx.lineTo(26, -22); ctx.lineTo(20, 0); ctx.lineTo(-20, 0); ctx.closePath(); }, '#c99a5b', 3); for (let i = -16; i < 20; i += 9) line(ctx, i, -22, i * 0.8, 0, 1.6, 'rgba(0,0,0,0.35)'); line(ctx, -26, -14, 26, -14, 1.6, 'rgba(0,0,0,0.35)'); ctx.beginPath(); ctx.arc(0, -22, 22, Math.PI, 0); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); if (a === 'pieces') { poly(ctx, [[-16, -22], [-6, -34], [0, -22]], '#d97a4a', 2); poly(ctx, [[2, -22], [12, -32], [18, -22]], '#d97a4a', 2); } if (a === 'egg') { ell(ctx, 0, -28, 12, 15, '#fff6e0', 2.6); } },
  pot(ctx, s, a) {
    const body = () => { ctx.moveTo(-18, -34); ctx.quadraticCurveTo(-34, -16, -20, 0); ctx.lineTo(20, 0); ctx.quadraticCurveTo(34, -16, 18, -34); ctx.closePath(); };
    shadow(ctx, 0, 2, 28);
    if (a === 'broken') { poly(ctx, [[-30, 0], [-16, -12], [-6, 0]], '#d97a4a', 2.6); poly(ctx, [[0, 0], [12, -20], [26, 0]], '#d97a4a', 2.6); poly(ctx, [[-10, -10], [2, -22], [8, -6]], '#e68b57', 2.6); poly(ctx, [[-36, 0], [-30, -6], [-24, 0]], '#c9693a', 2); return; }
    shape(ctx, body, '#d97a4a', 3); rect(ctx, -20, -42, 40, 10, 4, '#c9693a', 3); shine(ctx, -10, -20, 5, 11, -0.2);
    if (a === 'mended') { ctx.save(); ctx.beginPath(); ctx.moveTo(-14, -34); ctx.lineTo(-4, -22); ctx.lineTo(-12, -10); ctx.lineTo(0, 0); ctx.lineWidth = 3.4; ctx.strokeStyle = '#ffd23f'; ctx.stroke(); ctx.beginPath(); ctx.moveTo(10, -34); ctx.lineTo(2, -20); ctx.lineTo(14, -8); ctx.stroke(); ctx.restore(); }
  },
  riceball(ctx) { poly(ctx, [[-16, 0], [16, 0], [0, -30]], '#fffdf6', 3); poly(ctx, [[-6, 0], [6, 0], [6, -9], [-6, -9]], '#25302a', 2); },
  drum(ctx, s, a, b, t) { const hit = a === 'hit' ? Math.sin(t * 20) * 0.04 : 0; ctx.scale(1 + hit, 1 - hit); rect(ctx, -30, -46, 60, 46, 6, '#c03a2b', 3); ell(ctx, 0, -46, 30, 9, '#f7e3bc', 3); for (let i = -20; i <= 20; i += 13) { line(ctx, i, -40, i * 0.6, -4, 2.2, '#f7e3bc'); } line(ctx, -30, -24, 30, -24, 3, '#f7d86a'); },
  puddle(ctx, s, a, b, t) { ctx.fillStyle = 'rgba(90,150,200,0.85)'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 8, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(0, 0, 14 + (t * 6 % 10), 3.5 + (t * 2 % 3), 0, 0, TAU); ctx.stroke(); },
  snowman(ctx, s, a) {
    const st = Number(a ?? 2), W = '#ffffff';
    if (st === 3) { shadow(ctx, 0, 0, 36); ctx.fillStyle = 'rgba(160,200,235,0.9)'; ctx.beginPath(); ctx.ellipse(0, -2, 34, 8, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(43,29,22,0.5)'; ctx.stroke(); poly(ctx, [[8, -4], [20, -8], [20, 0]], '#ff8a3d', 2); circ(ctx, -12, -3, 2.6, INK, 0); circ(ctx, -4, -4, 2.6, INK, 0); return; }
    shadow(ctx, 0, 2, 34);
    if (st === 0) { ell(ctx, 0, -14, 28, 17, W, 3); shine(ctx, -8, -20, 8, 4); return; }
    circ(ctx, 0, -26, 26, W, 3); if (st >= 1) circ(ctx, 0, -66, 18, W, 3);
    if (st >= 2) { circ(ctx, -6, -69, 2.4, INK, 0); circ(ctx, 6, -69, 2.4, INK, 0); poly(ctx, [[0, -64], [16, -61], [0, -59]], '#ff8a3d', 2); for (const y of [-34, -22]) circ(ctx, 0, y, 2.8, INK, 0); curve(ctx, -16, -52, 0, -44, 16, -52, 8, INK); curve(ctx, -16, -52, 0, -44, 16, -52, 5, '#e2503c'); }
  },
  egg(ctx, s, a) {
    const st = Number(a ?? 0);
    shadow(ctx, 0, 2, 20);
    if (st === 2) { ctx.save(); poly(ctx, [[-20, -4], [-14, -14], [-7, -6], [0, -16], [7, -6], [14, -14], [20, -4], [14, 4], [-14, 4]], '#fff6e0', 2.6); ctx.restore(); ell(ctx, 0, -26, 16, 15, '#ffe27a', 3); circ(ctx, -5, -28, 2.2, INK, 0); circ(ctx, 5, -28, 2.2, INK, 0); poly(ctx, [[-3, -23], [3, -23], [0, -18]], '#ff9f2d', 1.8); return; }
    ell(ctx, 0, -20, 15, 20, '#fff6e0', 3);
    if (st === 1) { ctx.beginPath(); ctx.moveTo(-13, -22); ctx.lineTo(-6, -16); ctx.lineTo(0, -26); ctx.lineTo(6, -16); ctx.lineTo(13, -22); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke(); } else { circ(ctx, -4, -26, 2.2, '#e8d2a8', 0); circ(ctx, 5, -16, 2.6, '#e8d2a8', 0); }
  },
  nest(ctx) { shape(ctx, () => { ctx.moveTo(-28, -12); ctx.quadraticCurveTo(0, 14, 28, -12); ctx.quadraticCurveTo(0, -4, -28, -12); }, '#9c6a3e', 3); for (let i = -20; i <= 20; i += 10) line(ctx, i, -8, i + 6, 2, 1.8, 'rgba(0,0,0,0.4)'); },
  table(ctx, s, a) { rect(ctx, -46, -42, 92, 9, 3, '#b57a4a', 3); line(ctx, -38, -33, -38, 0, 5); line(ctx, 38, -33, 38, 0, 5); },
  pane(ctx, s, a) { rect(ctx, -34, -34, 68, 68, 4, a === 'night' ? '#16254f' : a === 'rain' ? '#9fb7c8' : a === 'dusk' ? '#f0a070' : '#8fd0f5', 4); if (a === 'night') { circ(ctx, 10, -10, 8, '#fff4c0', 0); circ(ctx, -14, 12, 1.8, '#fff', 0); } if (a === 'rain') for (let i = 0; i < 5; i++) line(ctx, -22 + i * 11, -24 + (i % 2) * 8, -26 + i * 11, -14 + (i % 2) * 8, 2, '#e8f3ff'); line(ctx, 0, -34, 0, 34, 4); line(ctx, -34, 0, 34, 0, 4); },
  door(ctx) { rect(ctx, -22, -64, 44, 64, 3, '#8b5a33', 3); circ(ctx, 12, -30, 3, '#ffd23f', 1.6); },
  cart(ctx, s, a) { rect(ctx, -34, -34, 68, 24, 3, '#c27a45', 3); circ(ctx, -18, -8, 12, '#6b4426', 3); circ(ctx, 18, -8, 12, '#6b4426', 3); line(ctx, 34, -26, 58, -14, 4); },
  cake(ctx, s, a) { shadow(ctx, 0, 2, 30); rect(ctx, -26, -22, 52, 22, 5, '#ffe9c2', 3); rect(ctx, -26, -22, 52, 8, 4, '#ff9fbf', 2.6); circ(ctx, 0, -30, 6, '#e2503c', 2.4); if (a === 'slice') poly(ctx, [[0, -22], [26, -22], [26, 0], [0, 0]], '#f6e0b6', 0); },
  bucket(ctx) { shape(ctx, () => { ctx.moveTo(-14, -26); ctx.lineTo(14, -26); ctx.lineTo(11, 0); ctx.lineTo(-11, 0); ctx.closePath(); }, '#7aa7d9', 3); ctx.beginPath(); ctx.arc(0, -26, 12, Math.PI, 0); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); },
  scarf(ctx) { curve(ctx, -16, 0, 0, 8, 16, 0, 9, INK); curve(ctx, -16, 0, 0, 8, 16, 0, 6, '#e2503c'); rect(ctx, 8, 2, 8, 22, 3, '#e2503c', 2.4); },
  hill(ctx, s, a) { shape(ctx, () => { ctx.moveTo(-140, 0); ctx.quadraticCurveTo(-60, -90, 20, -70); ctx.quadraticCurveTo(90, -50, 140, 0); ctx.closePath(); }, a ?? '#7cc664', 3); },
  mountain(ctx, s, a) { poly(ctx, [[-90, 0], [-10, -90], [70, 0]], a === 'snow' ? '#aebfd8' : '#8fa3c4', 0); poly(ctx, [[-27, -64], [-10, -90], [8, -64], [-2, -70], [-12, -62]], '#ffffff', 0); },
  grass(ctx) { for (let i = -3; i <= 3; i++) { line(ctx, i * 6, 0, i * 6 - 3, -10 - (i & 1) * 3, 2.4, '#3f8f3f'); } },
  reed(ctx) { for (let i = -2; i <= 2; i++) { line(ctx, i * 7, 0, i * 7 + 2, -34 - (i & 1) * 8, 2.6, '#6a8f3a'); ell(ctx, i * 7 + 2, -38 - (i & 1) * 8, 3, 7, '#8a5a2e', 1.8); } },
  campfire(ctx, s, a, b, t) { line(ctx, -16, 0, 16, -6, 6); line(ctx, 16, 0, -16, -6, 6); const f = Math.sin(t * 9) * 3; poly(ctx, [[-10, -4], [0, -34 - f], [10, -4]], '#ff8a2b', 2.6); poly(ctx, [[-5, -4], [0, -20 - f], [5, -4]], '#ffd23f', 0); },
  tent(ctx) { poly(ctx, [[-44, 0], [0, -62], [44, 0]], '#e9d6a8', 3); poly(ctx, [[-12, 0], [0, -34], [12, 0]], '#4a3a2a', 2.4); },
  firefly(ctx, s, a, b, t) { for (let i = 0; i < 5; i++) { const x = Math.sin(t * 0.8 + i * 1.7) * 36 + (i - 2) * 20, y = Math.cos(t * 1.1 + i * 2.3) * 14 - i * 6; ctx.fillStyle = 'rgba(255,240,120,0.35)'; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff6a8'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.fill(); } },
  sign(ctx, s, a) { line(ctx, 0, 0, 0, -48, 5); rect(ctx, -22, -64, 44, 22, 3, '#e8d2a0', 3); poly(ctx, [[-16, -53], [10, -53], [10, -56], [18, -53], [10, -50], [10, -53]], INK, 1.4); },
  ladder(ctx) { line(ctx, -10, 0, -14, -90, 5); line(ctx, 10, 0, 14, -90, 5); for (let i = 0; i < 5; i++) line(ctx, -11 - i * 0.6, -14 - i * 17, 11 + i * 0.6, -14 - i * 17, 4); },
  crowd(ctx, s, a, b, t) { const cols = ['#e2503c', '#3d7be0', '#f3b24a', '#5cb85c', '#a77bff']; for (let i = 0; i < 5; i++) { const x = (i - 2) * 30, y = Math.sin(t * 3 + i) * 1.5 + (i % 2) * 6; circ(ctx, x, -14 + y, 11, '#f8d3ae', 2.4); shape(ctx, () => ctx.arc(x, -16 + y, 12, Math.PI, 0), '#2b1d16', 2.2); ell(ctx, x, 6, 14, 10, cols[i], 2.6); } },
};
const CHARS = { kid, fox, cat, bird, frog, turtle, fish };
export const ELEMENT_KINDS = [...Object.keys(P), ...Object.keys(CHARS)];

// ---- backgrounds -----------------------------------------------------------------------------------------------------------------
function paintSky(ctx, sky, g, t, anim) {
  const [c0, c1, c2] = SKY[sky] ?? SKY.day;
  const grad = ctx.createLinearGradient(0, 0, 0, CH);
  grad.addColorStop(0, c0); grad.addColorStop(0.55, c1); grad.addColorStop(1, c2);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, CW, CH);
  if (sky === 'room') {
    // wall paper stripes, skirting board and a warm floor
    ctx.fillStyle = 'rgba(190,120,60,0.12)'; for (let x = 10; x < CW; x += 40) ctx.fillRect(x, 0, 14, 215);
    return;
  }
  if (NIGHTY.has(sky)) { P.stars(ctx); }
  if (sky === 'rain') {
    ctx.strokeStyle = 'rgba(235,245,255,0.75)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    const off = anim ? (t * 140) % 40 : 0;
    for (let i = 0; i < 44; i++) { const x = (i * 37) % 420, y = ((i * 61) % 300) + off; const yy = ((y % 300) + 300) % 300; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x - 5, yy + 14); ctx.stroke(); }
  }
  if (sky === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    const off = anim ? (t * 24) % 300 : 0;
    for (let i = 0; i < 40; i++) { const x = (i * 53) % 400 + Math.sin(t + i) * (anim ? 4 : 0), y = (((i * 37) % 300) + off) % 300; ctx.beginPath(); ctx.arc(x, y, 1.8 + (i % 3) * 0.6, 0, TAU); ctx.fill(); }
  }
}
function paintGround(ctx, g) {
  const G = GROUND[g];
  if (!G) return;
  if (g === 'floor') {
    ctx.fillStyle = G.a; ctx.fillRect(0, G.y, CW, CH - G.y);
    ctx.fillStyle = G.b; for (let x = -20; x < CW; x += 60) ctx.fillRect(x + ((x / 60) & 1) * 14, G.y, 2, CH - G.y);
    ctx.fillStyle = '#e8cf9e'; ctx.fillRect(0, G.y - 10, CW, 10);
    line(ctx, 0, G.y, CW, G.y, 3);
    return;
  }
  if (g === 'water') {
    const gr = ctx.createLinearGradient(0, G.y, 0, CH); gr.addColorStop(0, G.a); gr.addColorStop(1, G.b);
    ctx.fillStyle = gr; ctx.fillRect(0, G.y, CW, CH - G.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) { const x = ((i * 117 + r * 53) % 380) + 10, y = G.y + 18 + r * 28; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y - 6, x + 20, y); ctx.quadraticCurveTo(x + 30, y + 6, x + 40, y); ctx.stroke(); }
    line(ctx, 0, G.y, CW, G.y, 3);
    return;
  }
  // soft far hill then the near ground
  ctx.fillStyle = G.b; ctx.beginPath(); ctx.moveTo(0, G.y + 6); ctx.quadraticCurveTo(110, G.y - 30, 230, G.y - 6); ctx.quadraticCurveTo(330, G.y - 24, 400, G.y); ctx.lineTo(400, CH); ctx.lineTo(0, CH); ctx.fill();
  ctx.fillStyle = G.a; ctx.beginPath(); ctx.moveTo(0, G.y + 10); ctx.quadraticCurveTo(140, G.y - 8, 260, G.y + 8); ctx.quadraticCurveTo(340, G.y + 2, 400, G.y + 12); ctx.lineTo(400, CH); ctx.lineTo(0, CH); ctx.fill();
  if (g === 'road') { ctx.fillStyle = G.b; ctx.beginPath(); ctx.moveTo(0, 238); ctx.quadraticCurveTo(200, 214, 400, 244); ctx.lineTo(400, CH); ctx.lineTo(0, CH); ctx.fill(); ctx.strokeStyle = 'rgba(43,29,22,0.45)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 238); ctx.quadraticCurveTo(200, 214, 400, 244); ctx.stroke(); }
  if (g === 'snow') { ctx.strokeStyle = 'rgba(120,150,185,0.45)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, G.y + 10); ctx.quadraticCurveTo(140, G.y - 8, 260, G.y + 8); ctx.quadraticCurveTo(340, G.y + 2, 400, G.y + 12); ctx.stroke(); }
}

// ---- the scene -----------------------------------------------------------------------------------------------------------------
// card = { sky, g, e: [[kind, x, y, scale, attr, extra], ...] }. Draws into the 400 x 300 box at the origin of the current transform.
export function paintScene(ctx, card, t = 0, anim = true) {
  const sky = card.sky ?? 'day';
  paintSky(ctx, sky, card.g, t, anim);
  paintGround(ctx, card.g);
  for (const el of card.e ?? []) {
    const [kind, x, y, s = 1, a, b] = el;
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    if (CHARS[kind]) CHARS[kind](ctx, s, a && typeof a === 'object' ? a : {}, (typeof a === 'string' ? a : b) ?? 'happy', anim ? t : 0);
    else if (kind === 'line') line(ctx, 0, 0, a - x, b - y, 2.2, INK);
    else P[kind]?.(ctx, s, a, b, anim ? t : 0);
    ctx.restore();
  }
  // gentle vignette so every card feels printed
  const v = ctx.createRadialGradient(CW / 2, CH / 2, CH * 0.45, CW / 2, CH / 2, CH * 0.95);
  v.addColorStop(0, 'rgba(60,30,0,0)'); v.addColorStop(1, 'rgba(60,30,0,0.22)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, CW, CH);
}

// Draw a card (picture on cream paper with a soft shadow) into rect r. Returns nothing.
export function drawCard(ctx, card, r, { t = 0, anim = true, shadowAlpha = 0.35, radius = 0 } = {}) {
  const rad = radius || Math.min(r.w, r.h) * 0.06;
  if (shadowAlpha > 0) { ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + r.h * 0.03 + 3, r.w, r.h, rad); ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`; ctx.fill(); }
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = '#fbf4de'; ctx.fill();
  const m = r.w * 0.035, ir = { x: r.x + m, y: r.y + m, w: r.w - 2 * m, h: r.h - 2 * m };
  ctx.save();
  ctx.beginPath(); ctx.roundRect(ir.x, ir.y, ir.w, ir.h, rad * 0.5); ctx.clip();
  ctx.translate(ir.x, ir.y); ctx.scale(ir.w / CW, ir.h / CH);
  paintScene(ctx, card, t, anim);
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(ir.x, ir.y, ir.w, ir.h, rad * 0.5); ctx.lineWidth = Math.max(1.5, r.w * 0.008); ctx.strokeStyle = 'rgba(43,29,22,0.8)'; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(80,50,20,0.45)'; ctx.stroke();
}
