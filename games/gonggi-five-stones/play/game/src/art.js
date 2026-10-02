// Drawing for the mat, the pebbles, the palm marker (a glass ring, not a drawn hand), routes and particles.
// Pure canvas drawing. World units: the mat is 660 x 800.
import { R, WORLD } from './sim.js';
import { roundPath } from './ui.js';

const TAU = Math.PI * 2;

export const STONE_PAL = [
  { hi: '#fffdf4', mid: '#ece4d2', lo: '#a89f8a', dot: 'rgba(120,108,88,0.35)', name: 'Ivory' },
  { hi: '#dce8f6', mid: '#8ea6c9', lo: '#4a5f88', dot: 'rgba(40,56,92,0.3)', name: 'Slate' },
  { hi: '#ffe6e4', mid: '#eba9ae', lo: '#b3636d', dot: 'rgba(120,50,60,0.28)', name: 'Rose' },
  { hi: '#e4f8ea', mid: '#92cfae', lo: '#4a8a6e', dot: 'rgba(30,80,60,0.28)', name: 'Jade' },
  { hi: '#fff0cc', mid: '#e8b862', lo: '#a9742a', dot: 'rgba(110,70,20,0.3)', name: 'Amber' },
];

// ---- room and mat ---------------------------------------------------------------------------------
export function drawFloor(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2b1f2f'); g.addColorStop(0.5, '#3a2a33'); g.addColorStop(1, '#241b26');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // long floor-paper strips
  ctx.fillStyle = 'rgba(255,230,190,0.035)';
  for (let x = 0; x < W; x += 90) ctx.fillRect(x, 0, 2, H);
  const v = ctx.createRadialGradient(W / 2, H * 0.45, 120, W / 2, H * 0.45, H * 0.8);
  v.addColorStop(0, 'rgba(255,210,150,0.1)'); v.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// The mat is a bojagi-style patchwork cloth: pieced rectangles joined with flat seams and running stitches.
const PATCH_COLS = [0, 205, 440, 660], PATCH_ROWS = [0, 175, 330, 520, 665, 800];
const PATCH_COL = [
  ['#3b4f94', '#d8683c', '#2d7f78'],
  ['#dca94a', '#f0e3c6', '#8c4c80'],
  ['#2d7f78', '#3b4f94', '#d8683c'],
  ['#c5546b', '#2d7f78', '#dca94a'],
  ['#f0e3c6', '#8c4c80', '#3b4f94'],
];
export function drawMat(ctx, t = 0) {
  const { w, h } = WORLD;
  ctx.save();
  // soft contact shadow
  roundPath(ctx, 6, 14, w, h, 26); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill();
  roundPath(ctx, 0, 0, w, h, 26); ctx.clip();
  for (let r = 0; r < PATCH_ROWS.length - 1; r++) {
    for (let c = 0; c < PATCH_COLS.length - 1; c++) {
      const x0 = PATCH_COLS[c], x1 = PATCH_COLS[c + 1], y0 = PATCH_ROWS[r], y1 = PATCH_ROWS[r + 1];
      ctx.fillStyle = PATCH_COL[r][c]; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      // a lighter inner panel gives each patch a pieced, folded look
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x0 + 9, y0 + 9, x1 - x0 - 18, y1 - y0 - 18);
    }
  }
  // weave
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let y = 4; y < h; y += 7) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.beginPath();
  for (let x = 4; x < w; x += 7) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  ctx.stroke();
  // seams + running stitches
  ctx.strokeStyle = 'rgba(250,240,215,0.9)'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (const x of PATCH_COLS.slice(1, -1)) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (const y of PATCH_ROWS.slice(1, -1)) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.setLineDash([9, 7]); ctx.strokeStyle = 'rgba(70,40,40,0.5)'; ctx.lineWidth = 2; ctx.beginPath();
  for (const x of PATCH_COLS.slice(1, -1)) { ctx.moveTo(x - 7, 0); ctx.lineTo(x - 7, h); ctx.moveTo(x + 7, 0); ctx.lineTo(x + 7, h); }
  for (const y of PATCH_ROWS.slice(1, -1)) { ctx.moveTo(0, y - 7); ctx.lineTo(w, y - 7); ctx.moveTo(0, y + 7); ctx.lineTo(w, y + 7); }
  ctx.stroke(); ctx.setLineDash([]);
  // light falling from the upper left
  const g = ctx.createRadialGradient(w * 0.35, h * 0.28, 40, w * 0.5, h * 0.5, h * 0.8);
  g.addColorStop(0, 'rgba(255,240,200,0.2)'); g.addColorStop(0.6, 'rgba(255,240,200,0)'); g.addColorStop(1, 'rgba(10,6,24,0.38)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // hem
  roundPath(ctx, 5, 5, w - 10, h - 10, 22); ctx.strokeStyle = 'rgba(250,240,215,0.75)'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.stroke(); ctx.setLineDash([]);
  roundPath(ctx, 0, 0, w, h, 26); ctx.strokeStyle = 'rgba(30,18,40,0.55)'; ctx.lineWidth = 3; ctx.stroke();
  void t;
}

// The resting place of the hand: a soft ring on the cloth.
export function drawHomeMark(ctx, x, y, glow = 0) {
  ctx.save();
  ctx.strokeStyle = `rgba(255,246,228,${0.35 + 0.35 * glow})`; ctx.lineWidth = 3; ctx.setLineDash([5, 8]);
  ctx.beginPath(); ctx.arc(x, y, 46, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

// ---- pebbles ---------------------------------------------------------------------------------------
const soft = (ctx, x, y, rx, ry, a) => {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(10,6,24,${a})`); g.addColorStop(0.6, `rgba(10,6,24,${a * 0.55})`); g.addColorStop(1, 'rgba(10,6,24,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore();
};
export function drawShadow(ctx, x, y, z = 0, scale = 1) {
  const k = 1 + z / 520;
  soft(ctx, x + 5 + z * 0.12, y + 11 + z * 0.06, R * 1.25 * k * scale, R * 0.95 * k * scale, 0.5 / (1 + z / 140));
}

// One pebble. o: { z, glow (0-1), ring (colour), alpha, scale, spin }
export function drawStone(ctx, s, o = {}) {
  const z = o.z ?? 0, sc = (o.scale ?? 1) * (1 + z / 380);
  const P = STONE_PAL[s.id % 5];
  if (!o.noShadow) drawShadow(ctx, s.x, s.y, z, o.scale ?? 1);
  const x = s.x, y = s.y - z * 0.55;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(x, y); ctx.rotate((s.rot ?? 0) + (o.spin ?? 0)); ctx.scale(sc, sc);
  if (o.glow) {
    const g = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 2.1);
    g.addColorStop(0, `rgba(255,236,170,${0.55 * o.glow})`); g.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 2.1, 0, TAU); ctx.fill();
  }
  // body: a slightly irregular pebble
  ctx.beginPath(); ctx.ellipse(0, 0, R * 1.07, R * 0.93, 0, 0, TAU);
  const lx = -R * 0.38, ly = -R * 0.42;
  const g = ctx.createRadialGradient(lx, ly, R * 0.1, 0, 0, R * 1.18);
  g.addColorStop(0, P.hi); g.addColorStop(0.5, P.mid); g.addColorStop(1, P.lo);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(30,20,40,0.45)'; ctx.stroke();
  // speckles (fixed per pebble, they turn with it)
  ctx.fillStyle = P.dot;
  const sp = [[0.3, 0.25, 2.2], [-0.15, 0.5, 1.6], [0.55, -0.1, 1.4], [-0.5, 0.05, 1.8]];
  for (const [a, b, r] of sp) { ctx.beginPath(); ctx.arc(a * R, b * R, r, 0, TAU); ctx.fill(); }
  ctx.restore();
  // specular stays upright (light does not turn with the pebble)
  ctx.save(); ctx.globalAlpha = (o.alpha ?? 1) * 0.85; ctx.translate(x - R * 0.34 * sc, y - R * 0.4 * sc); ctx.rotate(-0.5); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.3, R * 0.15, 0, 0, TAU); ctx.fill();
  ctx.restore();
  if (o.ring) { ctx.save(); ctx.strokeStyle = o.ring; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, R * 1.38, 0, TAU); ctx.stroke(); ctx.restore(); }
}

// ---- the palm marker -------------------------------------------------------------------------------
// A glass ring with a bright core. closed (0-1) tightens it as the hand closes on a stone; the trail fades behind.
export function drawTrail(ctx, trail) {
  if (trail.length < 2) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1], b = trail[i], k = i / trail.length;
    ctx.strokeStyle = `rgba(255,236,190,${0.32 * k})`; ctx.lineWidth = 4 + 18 * k;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.restore();
}
export function drawHand(ctx, x, y, o = {}) {
  const r = (o.r ?? 30) * (1 - 0.22 * (o.closed ?? 0)), a = o.alpha ?? 1;
  ctx.save(); ctx.globalAlpha = a;
  soft(ctx, x + 3, y + 22, r * 1.1, r * 0.7, 0.35);
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.9);
  g.addColorStop(0, `rgba(255,240,200,${0.5 + 0.3 * (o.glow ?? 0)})`); g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, TAU); ctx.fill();
  const gl = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 2, x, y, r);
  gl.addColorStop(0, 'rgba(255,255,255,0.55)'); gl.addColorStop(1, 'rgba(255,236,190,0.16)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,248,230,0.95)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(70,40,30,0.4)'; ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- routes, badges, rings --------------------------------------------------------------------------
export function drawRoute(ctx, pts, o = {}) {
  if (pts.length < 2) return;
  const col = o.bad ? '255,110,90' : '255,244,214';
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(${col},${o.alpha ?? 0.3})`; ctx.lineWidth = 24;
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  ctx.setLineDash([10, 12]); ctx.strokeStyle = `rgba(${col},${Math.min(1, (o.alpha ?? 0.3) * 3)})`; ctx.lineWidth = 3;
  ctx.lineDashOffset = -(o.t ?? 0) * 40;
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  ctx.restore();
}
export function drawBadge(ctx, x, y, label, o = {}) {
  ctx.save();
  const r = o.r ?? 17;
  ctx.fillStyle = o.fill ?? '#e2503c'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#fffaf0'; ctx.stroke();
  ctx.fillStyle = '#fffaf0'; ctx.font = `700 ${Math.round(r * 1.15)}px 'Avenir Next', 'Segoe UI', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 1);
  ctx.restore();
}
export function drawRing(ctx, x, y, r, col = 'rgba(255,240,190,0.9)', w = 4, dash = null) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
}

// ---- particles -------------------------------------------------------------------------------------
export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const k = p.t / p.max, a = Math.max(0, 1 - k);
    ctx.save(); ctx.globalAlpha = a;
    if (p.kind === 'ring') { ctx.strokeStyle = p.col ?? '#fff3c4'; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.2 + 0.8 * k), 0, TAU); ctx.stroke(); }
    else if (p.kind === 'dust') { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (0.6 + k)); g.addColorStop(0, 'rgba(255,240,215,0.5)'); g.addColorStop(1, 'rgba(255,240,215,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + k), 0, TAU); ctx.fill(); }
    else if (p.kind === 'petal') { ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, TAU); ctx.fill(); }
    else { // sparkle: a four-point star
      ctx.translate(p.x, p.y); ctx.rotate(p.rot ?? 0); ctx.fillStyle = p.col ?? '#fff6cf'; const s = p.size * (1 - k * 0.5);
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.18, -s * 0.18, s, 0); ctx.quadraticCurveTo(s * 0.18, s * 0.18, 0, s); ctx.quadraticCurveTo(-s * 0.18, s * 0.18, -s, 0); ctx.quadraticCurveTo(-s * 0.18, -s * 0.18, 0, -s); ctx.fill();
    }
    ctx.restore();
  }
}
