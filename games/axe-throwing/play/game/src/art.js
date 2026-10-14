// Drawing primitives for Axe Throwing: the venue rooms, the painted timber board, steel axes, stuck axes and the reticle.
// Everything is canvas paths and gradients. Board art is drawn in board units (BS x BS, centred on 0,0) after translate + scale.
import { BS, HALF, RINGS, CLUTCH } from './sim.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

// One palette per venue. wall: [top, bottom]; paint: ring colours from the rim inwards [1, 2, 3, 4, 6].
export const THEMES = [
  { key: 'camp', wall: ['#b98349', '#7a4b24'], seam: 'rgba(40,20,8,0.45)', floor: ['#8c6238', '#5a3a1c'], glow: 'rgba(255,226,160,0.30)', vig: 'rgba(30,14,4,0.55)',
    paint: ['#ffcf4a', '#c4372a', '#f2e6c8', '#27507d', '#ecdcb4'], board: ['#d6a468', '#b9854a'], frame: '#4a2c14', accent: '#ffcf4a', toe: '#d83a2a' },
  { key: 'lodge', wall: ['#8a5a34', '#4b2c16'], seam: 'rgba(20,8,2,0.6)', floor: ['#6b4424', '#3b2410'], glow: 'rgba(255,190,110,0.34)', vig: 'rgba(14,6,2,0.65)',
    paint: ['#f2c04a', '#a3321f', '#efe2c2', '#1f4a43', '#e6d4a8'], board: ['#cf9a5e', '#a77440'], frame: '#3a210f', accent: '#ffb84a', toe: '#e24a2a' },
  { key: 'yard', wall: ['#f7a86a', '#6a4c88'], seam: 'rgba(40,24,10,0.5)', floor: ['#5f7f3a', '#3a5222'], glow: 'rgba(255,214,150,0.22)', vig: 'rgba(24,10,40,0.5)',
    paint: ['#ffd24a', '#d0432a', '#f6ead0', '#2a5a8a', '#f0e0bc'], board: ['#d9aa6e', '#b88a4e'], frame: '#563418', accent: '#ffd24a', toe: '#ffffff' },
  { key: 'night', wall: ['#1d2748', '#0b1128'], seam: 'rgba(0,0,0,0.5)', floor: ['#27315a', '#10172e'], glow: 'rgba(150,200,255,0.30)', vig: 'rgba(0,0,10,0.7)',
    paint: ['#ffd24a', '#e0372f', '#e9eefc', '#2d4fa6', '#d6def5'], board: ['#c9b08a', '#9f8460'], frame: '#242a40', accent: '#7fc8ff', toe: '#42d2ff' },
];

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- the room ---------------------------------------------------------------------------------------------------------------
// stage: screen rect to fill; br: board rect (square); bo: board offset in board units; wind: current wind in board units.
export function drawRoom(ctx, stage, br, th, t, o = {}) {
  const { x, y, w, h } = stage, s = br.w / BS, cx = br.x + br.w / 2, cy = br.y + br.h / 2;
  const floorTop = Math.min(y + h - 40, br.y + br.h + br.h * 0.035);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  // wall
  let g = ctx.createLinearGradient(0, y, 0, floorTop); g.addColorStop(0, th.wall[0]); g.addColorStop(1, th.wall[1]);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  if (th.key === 'camp') {
    const pw = Math.max(46, br.w * 0.1);
    for (let px = x - ((x - cx) % pw) - pw; px < x + w + pw; px += pw) {
      ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(px, y, pw / 2, floorTop - y);
      ctx.fillStyle = th.seam; ctx.fillRect(px, y, 2.5, floorTop - y);
      for (let k = 0; k < 4; k++) { ctx.strokeStyle = 'rgba(60,30,10,0.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); const gx = px + 8 + k * pw * 0.2; ctx.moveTo(gx, y); ctx.bezierCurveTo(gx + 6, y + h * 0.3, gx - 6, y + h * 0.6, gx + 2, floorTop); ctx.stroke(); }
    }
    // a sun beam through the roof boards
    g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h * 0.7); g.addColorStop(0, 'rgba(255,240,190,0.28)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + w * 0.05, y); ctx.lineTo(x + w * 0.32, y); ctx.lineTo(x + w * 0.78, floorTop); ctx.lineTo(x + w * 0.3, floorTop); ctx.closePath(); ctx.fill();
    // log piles at the sides
    const pile = (px, py, r) => { for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) { const lx = px + (j - i / 2) * r * 2.05, ly = py - (2 - i) * r * 1.78; logEnd(ctx, lx, ly, r); } };
    const rr = Math.max(14, br.w * 0.045);
    if (cx - br.w / 2 - x > rr * 3.5) pile(x + rr * 2.1, floorTop - rr * 0.1, rr);
    if (x + w - (cx + br.w / 2) > rr * 3.5) pile(x + w - rr * 2.1, floorTop - rr * 0.1, rr);
  } else if (th.key === 'lodge') {
    const lh = Math.max(40, br.w * 0.085);
    for (let ly = y - (y % lh); ly < floorTop; ly += lh) {
      const lg = ctx.createLinearGradient(0, ly, 0, ly + lh); lg.addColorStop(0, 'rgba(255,200,130,0.13)'); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = lg; ctx.fillRect(x, ly, w, lh);
      ctx.fillStyle = th.seam; ctx.fillRect(x, ly + lh - 2.5, w, 3);
      ctx.strokeStyle = 'rgba(40,16,4,0.22)'; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let k = 0; k < 3; k++) { const gy = ly + lh * (0.25 + k * 0.22); ctx.moveTo(x, gy); for (let gx = x; gx <= x + w; gx += 30) ctx.lineTo(gx, gy + Math.sin(gx * 0.04 + ly) * 2); }
      ctx.stroke();
    }
    for (const lxp of [x + w * 0.08, x + w * 0.92]) lantern(ctx, lxp, y + h * 0.05, Math.max(14, br.w * 0.05), t, lxp);
  } else if (th.key === 'yard') {
    // dusk sky with a pine line and a plank fence
    g = ctx.createLinearGradient(0, y, 0, floorTop); g.addColorStop(0, '#5a4a8a'); g.addColorStop(0.55, '#f08a66'); g.addColorStop(1, '#ffd29a');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, floorTop - y);
    ctx.fillStyle = 'rgba(30,22,52,0.85)';
    const base = floorTop - br.h * 0.1;
    for (let px = x - 10; px < x + w + 30; px += 34) { const ph = br.h * (0.16 + 0.1 * Math.abs(Math.sin(px * 0.07 + 1))); ctx.beginPath(); ctx.moveTo(px, base); ctx.lineTo(px + 17, base - ph); ctx.lineTo(px + 34, base); ctx.fill(); }
    ctx.fillStyle = '#6d4a28'; ctx.fillRect(x, base - 4, w, floorTop - base + 4);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let px = x; px < x + w; px += 26) ctx.fillRect(px, base - 4, 2, floorTop - base + 4);
    // pennant string, flapping with the wind
    const wy = y + h * 0.05, wn = Math.max(8, Math.round(w / 70)), wd = o.wind || 0, bend = Math.max(-1, Math.min(1, wd / 95));
    ctx.strokeStyle = 'rgba(30,20,10,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, wy); ctx.quadraticCurveTo(x + w / 2, wy + 22, x + w, wy); ctx.stroke();
    for (let i = 0; i < wn; i++) {
      const u = (i + 0.5) / wn, px = x + u * w, py = wy + 22 * 4 * u * (1 - u) * 0.5 + 2, sz = Math.max(14, w / wn * 0.34), fl = bend * sz * 0.9 + Math.sin(t * 5 + i) * sz * 0.1;
      ctx.fillStyle = ['#e8573a', '#ffd24a', '#f6ead0', '#2f7fb8'][i % 4];
      ctx.beginPath(); ctx.moveTo(px - sz * 0.35, py); ctx.lineTo(px + sz * 0.35, py); ctx.lineTo(px + fl, py + sz); ctx.closePath(); ctx.fill();
    }
  } else {
    // night hall: dark wall, bleachers, spotlight cones and a rail above the board
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let r2 = 0; r2 < 4; r2++) for (let px = x + 10; px < x + w; px += 22) { const py = y + h * 0.12 + r2 * h * 0.07; ctx.beginPath(); ctx.arc(px + (r2 % 2) * 11, py, 4, 0, TAU); ctx.fill(); }
    for (const sx of [x + w * 0.14, x + w * 0.86]) {
      g = ctx.createLinearGradient(sx, y, cx, cy); g.addColorStop(0, 'rgba(190,225,255,0.38)'); g.addColorStop(1, 'rgba(190,225,255,0.04)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - 12, y); ctx.lineTo(sx + 12, y); ctx.lineTo(cx + br.w * 0.55, floorTop); ctx.lineTo(cx - br.w * 0.55, floorTop); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c9dcff'; ctx.beginPath(); ctx.arc(sx, y + 6, 12, 0, TAU); ctx.fill();
    }
    const ry = br.y - br.h * 0.075;
    ctx.fillStyle = '#58627e'; ctx.fillRect(x, ry - 6, w, 12); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, ry - 6, w, 3);
    for (let px = x + 20; px < x + w; px += 60) { ctx.fillStyle = '#3a4260'; ctx.fillRect(px, ry - 6, 6, 12); }
  }
  // floor in perspective
  g = ctx.createLinearGradient(0, floorTop, 0, y + h); g.addColorStop(0, th.floor[0]); g.addColorStop(1, th.floor[1]);
  ctx.fillStyle = g; ctx.fillRect(x, floorTop, w, y + h - floorTop);
  const vpY = floorTop - br.h * 0.35, fh = y + h - floorTop;
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 2;
  for (let k = -9; k <= 9; k++) { ctx.beginPath(); ctx.moveTo(cx + k * br.w * 0.1, floorTop); ctx.lineTo(cx + k * br.w * 0.1 * (1 + fh / (floorTop - vpY)), y + h); ctx.stroke(); }
  for (let k = 1; k < 5; k++) { const yy = floorTop + fh * (k / 5) ** 1.5; ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(x, yy, w, 2); }
  g = ctx.createLinearGradient(0, floorTop, 0, floorTop + 14); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x, floorTop, w, 14);
  // throwing line
  const ty = y + h - Math.max(26, fh * 0.2);
  ctx.fillStyle = th.toe; ctx.globalAlpha = 0.9; ctx.fillRect(x, ty, w, Math.max(5, fh * 0.035)); ctx.globalAlpha = 1;
  // light on the board and corner shade
  g = ctx.createRadialGradient(cx, cy, br.w * 0.1, cx, cy, br.w * 0.95); g.addColorStop(0, th.glow); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  g = ctx.createRadialGradient(x + w / 2, y + h * 0.42, Math.min(w, h) * 0.3, x + w / 2, y + h * 0.42, Math.max(w, h) * 0.78); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, th.vig);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
  void s;
}
function logEnd(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
  g.addColorStop(0, '#e6c48c'); g.addColorStop(0.7, '#c4955a'); g.addColorStop(1, '#6d4524');
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(40,20,8,0.7)'; ctx.stroke();
  ctx.strokeStyle = 'rgba(90,50,20,0.55)'; ctx.lineWidth = 1.2;
  for (const k of [0.35, 0.62]) { ctx.beginPath(); ctx.arc(x, y, r * k, 0, TAU); ctx.stroke(); }
}
function lantern(ctx, x, y, r, t, seed) {
  const fl = 0.85 + 0.15 * Math.sin(t * 7 + seed);
  const g = ctx.createRadialGradient(x, y + r, 2, x, y + r, r * 6); g.addColorStop(0, `rgba(255,190,90,${0.5 * fl})`); g.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r * 6, y - r * 4, r * 12, r * 12);
  ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - r * 2); ctx.lineTo(x, y); ctx.stroke();
  roundRectPath(ctx, x - r * 0.7, y, r * 1.4, r * 2, r * 0.3); ctx.fillStyle = '#ffd98a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2a1a0c'; ctx.stroke();
  ctx.fillStyle = '#2a1a0c'; ctx.fillRect(x - r * 0.85, y - 4, r * 1.7, 8); ctx.fillRect(x - r * 0.85, y + r * 2 - 2, r * 1.7, 8);
}

// ---- the board (board units, ctx already translated to its centre and scaled) -------------------------------------------------
export function drawBoardUnits(ctx, th, o = {}) {
  const pl = 5, pw = BS / pl;
  // planks
  for (let i = 0; i < pl; i++) {
    const x0 = -HALF + i * pw, tone = ((i * 37) % 5) / 5;
    const g = ctx.createLinearGradient(x0, 0, x0 + pw, 0); g.addColorStop(0, th.board[0]); g.addColorStop(1, th.board[1]);
    ctx.fillStyle = g; ctx.fillRect(x0, -HALF, pw, BS);
    ctx.fillStyle = `rgba(${tone > 0.5 ? '255,235,190' : '40,20,6'},${0.07 + tone * 0.06})`; ctx.fillRect(x0, -HALF, pw, BS);
    ctx.strokeStyle = 'rgba(70,36,12,0.28)'; ctx.lineWidth = 2.2;
    for (let k = 0; k < 7; k++) {
      const gx = x0 + 18 + k * (pw - 30) / 6 + ((i * 13 + k * 7) % 9);
      ctx.beginPath(); ctx.moveTo(gx, -HALF); ctx.bezierCurveTo(gx + 14, -HALF + BS * 0.3, gx - 14, -HALF + BS * 0.65, gx + 5, HALF); ctx.stroke();
    }
    // knot
    const kx = x0 + pw * (0.3 + ((i * 29) % 5) * 0.1), ky = -HALF + BS * (0.2 + ((i * 53) % 7) * 0.1);
    ctx.fillStyle = 'rgba(70,34,10,0.4)'; ctx.beginPath(); ctx.ellipse(kx, ky, 15, 24, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(70,34,10,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(kx, ky, 27, 40, 0, 0, TAU); ctx.stroke();
    // seam
    if (i) { ctx.fillStyle = 'rgba(30,14,4,0.7)'; ctx.fillRect(x0 - 2.5, -HALF, 5, BS); ctx.fillStyle = 'rgba(255,230,180,0.2)'; ctx.fillRect(x0 + 2.5, -HALF, 2, BS); }
  }
  // painted rings, outermost first
  for (let i = RINGS.length - 1; i >= 0; i--) {
    ctx.beginPath(); ctx.arc(0, 0, RINGS[i].r, 0, TAU);
    ctx.globalAlpha = 0.94; ctx.fillStyle = th.paint[i]; ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,10,4,0.7)'; ctx.stroke();
  }
  // grain showing through the paint
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, RINGS[RINGS.length - 1].r, 0, TAU); ctx.clip();
  ctx.strokeStyle = 'rgba(60,30,10,0.12)'; ctx.lineWidth = 2;
  for (let k = -9; k <= 9; k++) { ctx.beginPath(); ctx.moveTo(k * 50 + 10, -HALF); ctx.bezierCurveTo(k * 50 + 30, -150, k * 50 - 20, 150, k * 50 + 12, HALF); ctx.stroke(); }
  ctx.restore();
  // bull centre dot and point numbers
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fillStyle = '#b8261a'; ctx.fill();
  ctx.font = '800 36px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const rs = [0, RINGS[0].r, RINGS[1].r, RINGS[2].r, RINGS[3].r, RINGS[4].r];
  RINGS.forEach((rg, i) => {
    if (i === 0) return;
    const rm = (rs[i] + rs[i + 1]) / 2, dark = i === 1 || i === 3;
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.9)' : 'rgba(30,16,8,0.82)';
    ctx.fillText(String(rg.pts), 0, -rm); ctx.fillText(String(rg.pts), 0, rm);
  });
  // clutch spots
  for (const c of CLUTCH) {
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fillStyle = th.accent; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#3a1608'; ctx.stroke();
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.6, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(58,22,8,0.6)'; ctx.stroke();
    ctx.fillStyle = '#3a1608'; ctx.font = '800 40px system-ui, sans-serif'; ctx.fillText('7', c.x, c.y + 2);
  }
  // frame, bolts
  ctx.lineWidth = 26; ctx.strokeStyle = th.frame; ctx.strokeRect(-HALF - 2, -HALF - 2, BS + 4, BS + 4);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,230,180,0.22)'; ctx.strokeRect(-HALF + 10, -HALF + 10, BS - 20, BS - 20);
  for (const [bx, by] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const gx = bx * (HALF - 4), gy = by * (HALF - 4), g = ctx.createRadialGradient(gx - 3, gy - 3, 1, gx, gy, 12);
    g.addColorStop(0, '#e8edf2'); g.addColorStop(1, '#4a5360'); ctx.beginPath(); ctx.arc(gx, gy, 11, 0, TAU); ctx.fillStyle = g; ctx.fill();
  }
  // old dents and cuts: the board has been used
  ctx.strokeStyle = 'rgba(30,14,4,0.5)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  [[-210, 120, -190, 205], [170, -190, 160, -110], [250, 200, 276, 270], [-120, -260, -92, -190], [60, 330, 80, 395], [-330, -40, -312, 30]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); });
  ctx.lineCap = 'butt';
  void o;
}

// ---- axes --------------------------------------------------------------------------------------------------------------------
// A steel axe in side profile, head up, handle length L pixels; x,y is the middle of the handle-and-head body.
export function drawAxe(ctx, x, y, L, rot = 0, col = '#ffb83a', o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(L, L);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.translate(0, 0.05);
  const lw = 1 / L;
  // handle
  let g = ctx.createLinearGradient(-0.045, 0, 0.045, 0); g.addColorStop(0, '#6b4220'); g.addColorStop(0.45, '#e0a964'); g.addColorStop(1, '#6f4622');
  ctx.beginPath(); ctx.moveTo(-0.026, -0.3); ctx.lineTo(0.026, -0.3); ctx.lineTo(0.034, 0.42); ctx.quadraticCurveTo(0.06, 0.44, 0.058, 0.5); ctx.quadraticCurveTo(0, 0.54, -0.058, 0.5); ctx.quadraticCurveTo(-0.06, 0.44, -0.034, 0.42); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.6 * lw; ctx.strokeStyle = 'rgba(40,20,6,0.85)'; ctx.stroke();
  // grip wrap
  ctx.save(); ctx.clip();
  ctx.fillStyle = col; for (let k = 0; k < 6; k++) ctx.fillRect(-0.07, 0.17 + k * 0.045, 0.14, 0.024);
  ctx.restore();
  // head: poll on the left, bearded blade on the right
  g = ctx.createLinearGradient(-0.12, -0.5, 0.36, -0.1); g.addColorStop(0, '#f4f7fa'); g.addColorStop(0.45, '#aeb9c4'); g.addColorStop(1, '#5f6a77');
  ctx.beginPath(); ctx.moveTo(-0.115, -0.37); ctx.lineTo(0.03, -0.385); ctx.bezierCurveTo(0.14, -0.42, 0.24, -0.47, 0.285, -0.525);
  ctx.bezierCurveTo(0.375, -0.42, 0.375, -0.2, 0.29, -0.1); ctx.bezierCurveTo(0.2, -0.18, 0.1, -0.215, 0.03, -0.225); ctx.lineTo(-0.115, -0.24); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.8 * lw; ctx.strokeStyle = 'rgba(20,26,36,0.9)'; ctx.stroke();
  // bevel highlight along the edge, dark eye hole shading
  ctx.beginPath(); ctx.moveTo(0.285, -0.505); ctx.bezierCurveTo(0.35, -0.42, 0.35, -0.21, 0.28, -0.12); ctx.lineWidth = 4 * lw; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.03, -0.37); ctx.bezierCurveTo(0.12, -0.36, 0.2, -0.32, 0.25, -0.24); ctx.lineWidth = 2 * lw; ctx.strokeStyle = 'rgba(40,50,64,0.5)'; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-0.115, -0.31, 0.145, 0.025);
  if (o.dbl) {
    ctx.save(); ctx.scale(-1, 1);
    ctx.beginPath(); ctx.moveTo(0.03, -0.385); ctx.bezierCurveTo(0.14, -0.42, 0.24, -0.47, 0.285, -0.525);
    ctx.bezierCurveTo(0.375, -0.42, 0.375, -0.2, 0.29, -0.1); ctx.bezierCurveTo(0.2, -0.18, 0.1, -0.215, 0.03, -0.225); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.8 * lw; ctx.strokeStyle = 'rgba(20,26,36,0.9)'; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// An axe stuck in the board, seen from the front, in board units. a: { x, y, ang, side }.
export function drawStuck(ctx, a, th, age = 1) {
  const col = a.side === 'you' ? '#ffb83a' : '#35c9b6', tilt = a.ang * 0.5, k = Math.min(1, age * 5);
  ctx.save(); ctx.translate(a.x, a.y);
  // shadow on the board
  ctx.save(); ctx.translate(18, 22); ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(0, 70, 34, 120, tilt, 0, TAU); ctx.fill(); ctx.restore();
  // handle coming toward us and down
  ctx.save(); ctx.rotate(tilt * 0.6);
  const hl = 165 * k, g = ctx.createLinearGradient(-30, 0, 30, 0); g.addColorStop(0, '#6a421f'); g.addColorStop(0.5, '#dba760'); g.addColorStop(1, '#6a421f');
  ctx.beginPath(); ctx.moveTo(-15, 20); ctx.lineTo(15, 20); ctx.lineTo(27, 20 + hl); ctx.quadraticCurveTo(0, 20 + hl + 18, -27, 20 + hl); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,20,6,0.85)'; ctx.stroke();
  ctx.save(); ctx.clip(); ctx.fillStyle = col;
  for (let i = 0; i < 4; i++) ctx.fillRect(-40, 20 + hl * 0.45 + i * hl * 0.12, 80, hl * 0.06);
  ctx.restore();
  ctx.restore();
  // head: steel cheek around the cut
  ctx.save(); ctx.rotate(tilt);
  const hg = ctx.createLinearGradient(-30, -70, 30, 70); hg.addColorStop(0, '#f4f7fa'); hg.addColorStop(0.5, '#a9b4c0'); hg.addColorStop(1, '#5d6875');
  roundRectPath(ctx, -26, -74, 52, 130, 18); ctx.fillStyle = hg; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,26,36,0.9)'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-18, -62, 7, 100);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-4, -70, 8, 126);   // the cut
  roundRectPath(ctx, -10, 20, 20, 24, 6); ctx.fillStyle = '#4a3320'; ctx.fill();
  ctx.restore();
  ctx.restore();
}

// ---- reticle and small things ----------------------------------------------------------------------------------------------------
export function drawReticle(ctx, x, y, r, o = {}) {
  const col = o.col || '#ffd24a', a = o.alpha ?? 1;
  ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(20,10,4,0.55)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = col; if (o.dash) ctx.setLineDash([10, 8]); ctx.stroke(); ctx.setLineDash([]);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.beginPath(); ctx.moveTo(x + dx * (r * 0.5), y + dy * (r * 0.5)); ctx.lineTo(x + dx * (r * 1.45), y + dy * (r * 1.45)); ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}

export function drawChip(ctx, c, s) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.globalAlpha = Math.max(0, 1 - c.t / c.max);
  ctx.fillStyle = c.col; ctx.fillRect(-c.w * s / 2, -c.h * s / 2, c.w * s, c.h * s);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-c.w * s / 2, 0, c.w * s, c.h * s / 2);
  ctx.restore();
}

// ---- icons for the collection and rules ----------------------------------------------------------------------------------------
export function drawAxeIcon(ctx, id, cx, cy, size, dim = false, rot = -0.4) {
  ctx.save(); ctx.globalAlpha = dim ? 0.35 : 1;
  const spec = [{ L: 1.0, col: '#ffb83a' }, { L: 1.15, col: '#9be8b0' }, { L: 0.95, col: '#ff7a6a', dbl: true }, { L: 0.82, col: '#7fc8ff' }][id] || { L: 1, col: '#ffb83a' };
  drawAxe(ctx, cx, cy, size * spec.L, rot, spec.col, { dbl: spec.dbl });
  ctx.restore();
}
export function drawVenueThumb(ctx, i, x, y, w, h, t = 0) {
  const th = THEMES[i], bs = Math.min(w * 0.62, h * 0.78), br = { x: x + (w - bs) / 2, y: y + h * 0.06, w: bs, h: bs };
  ctx.save(); roundRectPath(ctx, x, y, w, h, 14); ctx.clip();
  drawRoom(ctx, { x, y, w, h }, br, th, t, { wind: 0 });
  ctx.translate(br.x + bs / 2, br.y + bs / 2); ctx.scale(bs / BS, bs / BS); drawBoardUnits(ctx, th);
  ctx.restore();
}
