// All of the game's art, drawn on canvas: the layered paper-cut courtyards, the figures, the shuttle and the particles.
// Pure drawing: it reads state and never writes it (the only module-level state is a cache of the static backdrop).
import { FONT } from './ui.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clampv = (v, a, b) => Math.max(a, Math.min(b, v));
export const FX = { soft: true };

// ---- courtyards -------------------------------------------------------------------------------------------------------
export const YARDS = [
  { id: 0, name: 'Morning Courtyard', need: 0, sky: ['#fbe9c6', '#f6c590'], sun: '#fff6d8', far: '#d6c2a0', mid: '#8fa19e', roof: '#3f5963', roof2: '#51727a', wall: '#f1e6cc', wallEdge: '#bfae8a', floor: ['#d8cba8', '#b2a07a'], line: 'rgba(90,70,40,0.22)', accent: '#e2622b', tree: ['#e9b73c', '#f3cf62', '#c98f1d'] },
  { id: 1, name: 'River Park', need: 15, sky: ['#d4ebe8', '#f5f3d8'], sun: '#ffffff', far: '#b4d1bf', mid: '#74ad98', roof: '#3b7767', roof2: '#4f9382', wall: '#eaf1e2', wallEdge: '#a9bda0', floor: ['#c4d4ab', '#93ad7d'], line: 'rgba(40,80,40,0.2)', accent: '#2f9a8a', tree: ['#6fb46b', '#8fcc7e', '#4c8f52'], water: true },
  { id: 2, name: 'Teahouse Square', need: 30, sky: ['#25295a', '#e48a5b'], sun: '#ffd9a8', far: '#4b4378', mid: '#3a3266', roof: '#1d1a3b', roof2: '#2c2753', wall: '#5e4b72', wallEdge: '#33284f', floor: ['#6f6073', '#463a54'], line: 'rgba(255,220,180,0.14)', accent: '#ffb347', tree: ['#c97a4a', '#e09a5a', '#9b5632'], lanterns: true, night: true },
  { id: 3, name: 'Winter Pavilion', need: 50, sky: ['#dce7f1', '#f8f4ee'], sun: '#ffffff', far: '#c9d4e0', mid: '#a4b7c9', roof: '#6d8499', roof2: '#8aa0b4', wall: '#f3f5f7', wallEdge: '#c2ccd6', floor: ['#e3e8ed', '#bfc9d3'], line: 'rgba(80,100,130,0.2)', accent: '#c8402c', tree: ['#dfe6ec', '#f4f7fa', '#b3c0cc'], snow: true },
];

// ---- shuttles ---------------------------------------------------------------------------------------------------------
export const SHUTTLES = [
  { id: 0, name: 'White Goose', how: 'Always yours', f: ['#fbfaf1', '#d6dde6'], tip: '#ffffff', coin: '#b9833e' },
  { id: 1, name: 'Rooster Red', how: 'Reach a streak of 10', f: ['#e5503a', '#8d1d14'], tip: '#f2c14e', coin: '#c08a3a' },
  { id: 2, name: 'Peacock Teal', how: 'Pass a circle chain of 20', f: ['#24b3a4', '#0c5a63'], tip: '#2f56d8', coin: '#cfa04a' },
  { id: 3, name: 'Ginkgo Gold', how: 'Land 5 combos', f: ['#f6cf55', '#b57812'], tip: '#fff6d2', coin: '#a9712a' },
  { id: 4, name: 'Ink Black', how: 'Play a daily streak of 10', f: ['#3a3f52', '#10131c'], tip: '#e9e4d3', coin: '#c9a14a' },
  { id: 5, name: 'Festival Mix', how: 'Hit 100 perfect kicks', f: ['#e5503a', '#2f56d8'], tip: '#f6cf55', coin: '#d8ac52', mix: ['#e5503a', '#f6cf55', '#24b3a4', '#fbfaf1', '#2f56d8'] },
];

// ---- camera -----------------------------------------------------------------------------------------------------------
// World metres to screen: x lateral, y up, z away from the viewer. Far things are smaller and sit higher.
// The ground rises with depth as GROUND_K * z / (1 + 0.075 z): a true pinhole map, so the 3D presenter matches every 2D mark exactly.
export const GROUND_K = 0.5, PERSP_K = 0.075;
// Real size of the shuttle (a 4.2 cm coin and 6.5 cm plume), drawn at the stated maximum of 1.25 x: one drawing unit u is 2.43 cm.
export const SHUTTLE_U = 0.0243;
export function makeCam(stage, circle) {
  const s = Math.max(40, Math.min(stage.w / (circle ? 6.0 : 3.7), stage.h / 4.1));
  const cx = stage.x + stage.w / 2;
  const gy = clampv(stage.y + stage.h / 2 + 2.3 * s, stage.y + 2.3 * s, stage.y + stage.h - 0.42 * s);
  const persp = (z) => 1 / (1 + PERSP_K * z);
  return {
    s, cx, gy, stage, persp, circle,
    X: (x, z = 0) => cx + x * s * persp(z),
    Y: (y, z = 0) => gy - GROUND_K * z * s * persp(z) - y * s * persp(z),
    horizon: gy - 0.27 * s * 4.4,
  };
}

// ---- the static backdrop (cached) --------------------------------------------------------------------------------------
let CACHE = { key: '', canvas: null };
function paintBackdrop(ctx, W, H, cam, yard) {
  const hz = cam.horizon, s = cam.s, cx = cam.cx;
  const sky = ctx.createLinearGradient(0, 0, 0, hz + s * 0.4);
  sky.addColorStop(0, yard.sky[0]); sky.addColorStop(1, yard.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + s * 0.5);
  // sun or moon with a soft halo
  const sx = W * 0.76, sy = Math.max(s * 1.0, hz - s * 2.8), sr = s * 0.55;
  const halo = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 3.2);
  halo.addColorStop(0, yard.night ? 'rgba(255,230,190,0.5)' : 'rgba(255,248,220,0.7)'); halo.addColorStop(1, 'rgba(255,248,220,0)');
  ctx.fillStyle = halo; ctx.fillRect(sx - sr * 3.2, sy - sr * 3.2, sr * 6.4, sr * 6.4);
  ctx.fillStyle = yard.sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
  const layerShadow = (on) => { if (!FX.soft) return; ctx.shadowColor = 'rgba(14,18,40,0.35)'; ctx.shadowBlur = on ? s * 0.18 : 0; ctx.shadowOffsetY = on ? -s * 0.05 : 0; };
  // far hills: paper layer 3
  const hills = (base, amp, col, seed) => {
    ctx.beginPath(); ctx.moveTo(0, hz + s * 0.6);
    for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, base - amp * (0.55 * Math.sin(x / (s * 1.3) + seed) + 0.3 * Math.sin(x / (s * 0.55) + seed * 2.1) + 0.15 * Math.sin(x / (s * 0.27) + seed * 3)));
    ctx.lineTo(W + 8, hz + s * 0.6); ctx.closePath(); layerShadow(true); ctx.fillStyle = col; ctx.fill(); layerShadow(false);
  };
  hills(hz - s * 1.15, s * 0.7, yard.far, 1.3);
  hills(hz - s * 0.62, s * 0.5, yard.mid, 4.1);
  // roofs: paper layer 2, a row of pavilions with upturned eaves
  const roof = (x, y, w, h, col) => {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.04, y + h * 0.7); ctx.quadraticCurveTo(x + w * 0.12, y + h * 0.82, x + w * 0.24, y + h * 0.36);
    ctx.lineTo(x + w * 0.3, y); ctx.lineTo(x + w * 0.7, y); ctx.lineTo(x + w * 0.76, y + h * 0.36);
    ctx.quadraticCurveTo(x + w * 0.88, y + h * 0.82, x + w * 1.04, y + h * 0.7);
    ctx.lineTo(x + w * 0.97, y + h * 0.95); ctx.lineTo(x + w * 0.9, y + h); ctx.lineTo(x + w * 0.1, y + h); ctx.lineTo(x + w * 0.03, y + h * 0.95); ctx.closePath();
    layerShadow(true); ctx.fillStyle = col; ctx.fill(); layerShadow(false);
    // hall body
    ctx.fillStyle = yard.wall; ctx.fillRect(x + w * 0.12, y + h, w * 0.76, s * 0.55);
    ctx.fillStyle = yard.wallEdge;
    for (let i = 0; i < 4; i++) ctx.fillRect(x + w * (0.16 + i * 0.2), y + h, Math.max(2, w * 0.025), s * 0.55);
    if (yard.night) { ctx.fillStyle = 'rgba(255,200,120,0.85)'; for (let i = 0; i < 3; i++) ctx.fillRect(x + w * (0.22 + i * 0.2), y + h + s * 0.12, w * 0.12, s * 0.3); }
  };
  const bh = s * 0.5;
  roof(-s * 0.4, hz - s * 1.32, s * 2.5, bh, yard.roof2); roof(cx - s * 1.5, hz - s * 1.62, s * 3, bh * 1.2, yard.roof); roof(W - s * 2.2, hz - s * 1.28, s * 2.6, bh, yard.roof2);
  if (W > s * 7.5) roof(cx + s * 2.9, hz - s * 1.1, s * 2, bh * 0.8, yard.roof);
  // near wall with a moon gate: paper layer 1
  const wTop = hz - s * 0.95, wBot = hz + s * 0.12;
  ctx.beginPath(); ctx.rect(-4, wTop, W + 8, wBot - wTop);
  const gx = cx - s * 2.1, gr = (wBot - wTop) * 0.42, gy = wTop + (wBot - wTop) * 0.55;
  ctx.moveTo(gx + gr, gy); ctx.arc(gx, gy, gr, 0, TAU, true);
  layerShadow(true); ctx.fillStyle = yard.wall; ctx.fill('evenodd'); layerShadow(false);
  ctx.fillStyle = yard.wallEdge; ctx.fillRect(-4, wTop - s * 0.07, W + 8, s * 0.1);
  ctx.strokeStyle = yard.wallEdge; ctx.lineWidth = Math.max(2, s * 0.05); ctx.beginPath(); ctx.arc(gx, gy, gr + s * 0.02, 0, TAU); ctx.stroke();
  // round lattice window on the other side
  const wx = cx + s * 2.2, wr = gr * 0.5;
  ctx.fillStyle = yard.wallEdge; ctx.beginPath(); ctx.arc(wx, gy, wr, 0, TAU); ctx.fill();
  ctx.strokeStyle = yard.wall; ctx.lineWidth = Math.max(1.5, s * 0.03);
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(wx + (i / 2.5) * wr, gy - wr); ctx.lineTo(wx + (i / 2.5) * wr, gy + wr); ctx.stroke(); ctx.beginPath(); ctx.moveTo(wx - wr, gy + (i / 2.5) * wr); ctx.lineTo(wx + wr, gy + (i / 2.5) * wr); ctx.stroke(); }
  if (yard.water) {
    const wy = hz + s * 0.12;
    const wg = ctx.createLinearGradient(0, wy, 0, wy + s * 0.9); wg.addColorStop(0, '#9fd1d2'); wg.addColorStop(1, '#6fb0b6');
    ctx.fillStyle = wg; ctx.fillRect(0, wy, W, s * 0.9);
  }
  // floor with flagstones in perspective
  const fy = yard.water ? hz + s * 1.02 : hz + s * 0.12;
  const fg = ctx.createLinearGradient(0, fy, 0, H); fg.addColorStop(0, yard.floor[0]); fg.addColorStop(1, yard.floor[1]);
  ctx.fillStyle = fg; ctx.fillRect(0, fy, W, H - fy);
  if (yard.water) { ctx.fillStyle = yard.wallEdge; ctx.fillRect(0, fy - s * 0.06, W, s * 0.08); }
  ctx.strokeStyle = yard.line; ctx.lineWidth = Math.max(1.2, s * 0.018);
  const rows = 9;
  for (let i = 0; i <= rows; i++) { const y = fy + (H - fy) * Math.pow(i / rows, 1.7); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const vpy = fy - (H - fy) * 0.9;
  for (let i = -9; i <= 9; i++) { ctx.beginPath(); ctx.moveTo(cx + i * s * 0.55, fy); ctx.lineTo(cx + i * s * 2.1 * (H - vpy) / (H - fy) * 0.85, H); ctx.stroke(); }
  // ginkgo: trunk and canopy on the left, in front of the wall
  const tx = Math.min(s * 0.9, W * 0.12), ty = fy + s * 0.15;
  ctx.fillStyle = yard.night ? '#2c2036' : '#5a4430';
  ctx.beginPath(); ctx.moveTo(tx - s * 0.16, ty); ctx.quadraticCurveTo(tx - s * 0.08, ty - s * 1.4, tx - s * 0.04, ty - s * 2.5); ctx.lineTo(tx + s * 0.1, ty - s * 2.5); ctx.quadraticCurveTo(tx + s * 0.12, ty - s * 1.3, tx + s * 0.2, ty); ctx.closePath(); ctx.fill();
  const blob = (x, y, r, c) => { ctx.beginPath(); ctx.ellipse(x, y, r * 1.15, r * 0.85, 0, 0, TAU); ctx.fillStyle = c; ctx.fill(); };
  layerShadow(true);
  blob(tx - s * 0.25, ty - s * 2.7, s * 0.85, yard.tree[2]); blob(tx + s * 0.55, ty - s * 2.55, s * 0.7, yard.tree[2]);
  blob(tx - s * 0.1, ty - s * 2.95, s * 0.7, yard.tree[0]); blob(tx + s * 0.7, ty - s * 2.95, s * 0.52, yard.tree[0]);
  blob(tx + s * 0.1, ty - s * 3.2, s * 0.45, yard.tree[1]); blob(tx - s * 0.55, ty - s * 3.0, s * 0.42, yard.tree[1]);
  layerShadow(false);
  if (yard.lanterns) {
    for (let i = 0; i < 5; i++) {
      const lx = W * (0.2 + i * 0.15), ly = hz - s * (0.2 + (i % 2) * 0.18);
      ctx.strokeStyle = 'rgba(20,16,30,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lx, hz - s * 0.95); ctx.lineTo(lx, ly - s * 0.1); ctx.stroke();
      const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, s * 0.55); g.addColorStop(0, 'rgba(255,190,90,0.55)'); g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g; ctx.fillRect(lx - s * 0.55, ly - s * 0.55, s * 1.1, s * 1.1);
      ctx.fillStyle = '#e8572a'; ctx.beginPath(); ctx.ellipse(lx, ly, s * 0.1, s * 0.13, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd37a'; ctx.fillRect(lx - s * 0.06, ly - s * 0.03, s * 0.12, s * 0.02);
      ctx.fillStyle = '#2a1a1a'; ctx.fillRect(lx - s * 0.05, ly - s * 0.145, s * 0.1, s * 0.03); ctx.fillRect(lx - s * 0.05, ly + s * 0.115, s * 0.1, s * 0.03);
    }
  }
}
export function drawBackdrop(ctx, W, H, cam, yardIdx) {
  const yard = YARDS[yardIdx] ?? YARDS[0];
  const tr = ctx.getTransform ? ctx.getTransform() : null;
  const k = clampv(tr && tr.a ? tr.a : 1, 1, 2.2);
  const key = `${Math.round(W)}x${Math.round(H)}|${Math.round(cam.s)}|${Math.round(cam.gy)}|${Math.round(cam.cx)}|${yardIdx}|${FX.soft ? 1 : 0}|${k.toFixed(1)}`;
  if (typeof OffscreenCanvas !== 'undefined') {
    if (CACHE.key !== key) {
      try {
        const c = new OffscreenCanvas(Math.max(2, Math.round(W * k)), Math.max(2, Math.round(H * k)));
        const cc = c.getContext('2d'); cc.scale(k, k);
        paintBackdrop(cc, W, H, cam, yard);
        CACHE = { key, canvas: c };
      } catch { CACHE = { key: '', canvas: null }; }
    }
    if (CACHE.canvas && CACHE.key === key) { ctx.drawImage(CACHE.canvas, 0, 0, W, H); return; }
  }
  paintBackdrop(ctx, W, H, cam, yard);
}
export const resetArt = () => { CACHE = { key: '', canvas: null }; };

// The moving parts of the scene: drifting leaves or snow, water shimmer, lantern flicker.
export function drawAmbient(ctx, W, H, cam, yardIdx, t) {
  const yard = YARDS[yardIdx] ?? YARDS[0], s = cam.s;
  if (yard.snow) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 46; i++) {
      const sp = 0.05 + (i % 7) * 0.012, x = ((i * 0.6180339 + Math.sin(t * 0.5 + i) * 0.015) % 1) * W, y = (((i * 0.37) % 1) + t * sp) % 1 * H;
      ctx.beginPath(); ctx.arc(x, y, 1.4 + (i % 3) * 0.9, 0, TAU); ctx.fill();
    }
  } else {
    for (let i = 0; i < 14; i++) {
      const sp = 0.03 + (i % 5) * 0.011, ph = (i * 0.137) % 1;
      const x = ((ph + t * 0.012 * (1 + (i % 3)) + 0.05 * Math.sin(t * 0.7 + i)) % 1) * W, y = (((i * 0.29) % 1) * 0.7 + t * sp) % 0.8 * H * 1.1;
      const a = t * (0.8 + (i % 4) * 0.3) + i;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(a * 1.3)));
      ctx.fillStyle = yard.tree[(i % 2) ? 0 : 1]; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s * 0.075, Math.PI * 0.15, Math.PI * 0.85, true); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  if (yard.water) {
    const wy = cam.horizon + s * 0.12;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) { const x = ((i * 0.11 + t * 0.01) % 1) * W, y = wy + s * (0.15 + (i % 4) * 0.2), a = 0.5 + 0.5 * Math.sin(t * 2 + i); ctx.globalAlpha = 0.25 + 0.4 * a; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.3, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
}

// The chalk circle the players stand in, projected on the floor.
export function drawChalk(ctx, cam, circle) {
  const c = circle ? { x: 0, z: 1.5, r: 3.35 } : { x: 0, z: 0, r: 1.5 };
  ctx.save();
  ctx.lineCap = 'round';
  const trace = () => { ctx.beginPath(); for (let i = 0; i <= 64; i++) { const a = (i / 64) * TAU, x = c.x + Math.cos(a) * c.r, z = c.z + Math.sin(a) * c.r * (circle ? 0.5 : 0.55); const px = cam.X(x, z), py = cam.Y(0, z); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); };
  trace(); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = cam.s * 0.07; ctx.stroke();
  trace(); ctx.strokeStyle = 'rgba(255,252,240,0.78)'; ctx.lineWidth = cam.s * 0.035; ctx.setLineDash([cam.s * 0.2, cam.s * 0.1]); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

// ---- the shuttle -------------------------------------------------------------------------------------------------------
// u = pixels per unit (a feather is about 3.4 u long). ang = 0 draws the feathers straight up from the coin.
export function drawShuttle(ctx, x, y, u, ang, design, t, alpha = 1) {
  const d = SHUTTLES[design] ?? SHUTTLES[0];
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha;
  const L = 3.5 * u, wd = 0.95 * u;
  const n = 5;
  const order = [0, 4, 1, 3, 2];
  for (const k of order) {
    const a = (k - 2) * 0.27 + Math.sin(t * 17 + k * 1.7) * 0.035 + (k - 2) * 0.02 * Math.sin(t * 9);
    const col = d.mix ? d.mix[k % d.mix.length] : d.f[0];
    ctx.save(); ctx.translate(0, -0.1 * u); ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.bezierCurveTo(-wd * 1.05, -L * 0.28, -wd * 0.75, -L * 0.82, 0, -L); ctx.bezierCurveTo(wd * 0.75, -L * 0.82, wd * 1.05, -L * 0.28, 0, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, -L);
    g.addColorStop(0, d.mix ? col : d.f[1]); g.addColorStop(0.55, col); g.addColorStop(1, d.tip);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(0.8, u * 0.07); ctx.strokeStyle = 'rgba(20,20,30,0.45)'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = Math.max(0.7, u * 0.06); ctx.beginPath(); ctx.moveTo(0, -0.2 * u); ctx.lineTo(0, -L * 0.93); ctx.stroke();
    ctx.restore();
  }
  void n;
  // coin base: bronze with a square hole, rim and a lead bead
  const cg = ctx.createRadialGradient(-0.3 * u, 0.2 * u, 0.1 * u, 0, 0.6 * u, 1.2 * u);
  cg.addColorStop(0, '#fff0b8'); cg.addColorStop(0.45, d.coin); cg.addColorStop(1, '#5c3b12');
  ctx.beginPath(); ctx.arc(0, 0.55 * u, 1.15 * u, 0, TAU); ctx.fillStyle = cg; ctx.fill();
  ctx.lineWidth = Math.max(1, u * 0.1); ctx.strokeStyle = '#4a2f0e'; ctx.stroke();
  ctx.fillStyle = '#2a1a08'; ctx.fillRect(-0.34 * u, 0.55 * u - 0.34 * u, 0.68 * u, 0.68 * u);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-0.45 * u, 0.1 * u, 0.28 * u, 0, TAU); ctx.fill();
  ctx.restore();
}

// A soft halo that keeps the real-size shuttle findable: a warm glow behind it that pulses once a second.
export function glowDraw(ctx, x, y, mPx, t) {
  const r = Math.max(10, mPx * 0.28), pulse = 0.85 + 0.15 * Math.sin(t * 6);
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, `rgba(255,244,200,${0.55 * pulse})`); g.addColorStop(0.5, `rgba(255,226,150,${0.18 * pulse})`); g.addColorStop(1, 'rgba(255,226,150,0)');
  ctx.save(); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}

export function drawShadow(ctx, x, y, rx, ry, a = 0.28) {
  ctx.save(); ctx.fillStyle = `rgba(10,14,30,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.restore();
}

// ---- the figures --------------------------------------------------------------------------------------------------------
export const COSTUMES = [
  { tunic: '#2b4d86', sash: '#d4432c', trim: '#f3e2b3', trouser: '#222a40', hair: '#14141c' },
  { tunic: '#2f8f7a', sash: '#e8a93a', trim: '#f5ecd2', trouser: '#27343a', hair: '#1a1620' },
  { tunic: '#8a4a8f', sash: '#27a3a0', trim: '#f4e4cf', trouser: '#2b2540', hair: '#18121c' },
  { tunic: '#d38a2b', sash: '#27407a', trim: '#fff1d0', trouser: '#2d2a3a', hair: '#1c1612' },
];
const SKIN = '#e9b891';

function ik(hx, hy, ax, ay, L1, L2, bend) {
  let dx = ax - hx, dy = ay - hy, d = Math.hypot(dx, dy);
  const max = L1 + L2 - 1e-3;
  if (d > max) { const k = max / d; dx *= k; dy *= k; d = max; ax = hx + dx; ay = hy + dy; }
  if (d < 1e-4) d = 1e-4;
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const bx = hx + (dx * a) / d, by = hy + (dy * a) / d;
  const px = -dy / d, py = dx / d;
  let kx = bx + px * h, ky = by + py * h;
  const kx2 = bx - px * h, ky2 = by - py * h;
  if ((kx2 - bx) * bend > (kx - bx) * bend) { kx = kx2; ky = ky2; }
  return { kx, ky, ax, ay };
}

// Draw one figure. i = seat, p = { x, z } world foot position, anim = kick animation record or null, look = world x it faces.
export function drawKicker(ctx, cam, i, p, anim, look, t, opt = {}) {
  const co = COSTUMES[i], f = cam.s * cam.persp(p.z), X = (x, y) => cam.X(x, p.z), Yf = (y) => cam.Y(y, p.z);
  const sx = (x) => cam.cx + x * f, sy = (y) => cam.Y(0, p.z) - y * f;
  void X; void Yf;
  const x0 = p.x, bob = Math.sin(t * 2.1 + i * 1.7) * 0.012, lean = clampv((look - x0) * 0.08, -0.12, 0.12);
  const hipY = 0.93 + bob, shY = 1.5 + bob;
  const hip = { x: x0, y: hipY }, sh = { x: x0 + lean * 0.5, y: shY }, head = { x: x0 + lean, y: 1.7 + bob };
  // which leg strikes
  let kLeg = 1, kick = null;
  if (anim) {
    kLeg = anim.side > 0 ? 1 : anim.side < 0 ? -1 : (anim.cx >= x0 ? 1 : -1);
    let s = 0;
    const tt = anim.t;
    if (tt < 0.06) s = tt / 0.06; else s = Math.max(0, 1 - (tt - 0.06) / 0.38);
    s = s * s * (3 - 2 * s);
    kick = { s, tt };
  }
  const restA = (side) => ({ x: x0 + side * 0.12, y: 0.07 });
  const legPoints = (side) => {
    let a = restA(side), kneeOverride = null;
    if (kick && side === kLeg) {
      const cx = anim.cx, cy = anim.cy;
      if (anim.kind === 'knee') {
        const kn = { x: lerp(x0 + side * 0.1, clampv(cx, x0 - 1.0, x0 + 1.0), kick.s), y: lerp(0.5, Math.max(0.55, cy - 0.02), kick.s) };
        kneeOverride = kn; a = { x: kn.x + side * 0.05 * kick.s, y: kn.y - 0.42 };
      } else {
        const tgt = { x: clampv(cx, x0 - 1.0, x0 + 1.0), y: Math.max(0.06, cy - 0.04) };
        const back = { x: x0 - side * 0.05, y: 0.22 };
        a = kick.tt < 0.06 ? { x: lerp(restA(side).x, back.x, 0), y: 0.07 } : a;
        a = { x: lerp(restA(side).x, tgt.x, kick.s), y: lerp(restA(side).y, tgt.y, kick.s) };
        void back;
      }
    }
    const hx = x0 + side * 0.08;
    const r = ik(hx, hipY - 0.03, a.x, a.y, 0.44, 0.44, side * (kick && side === kLeg ? 1 : 0.3));
    if (kneeOverride) return { hx, hy: hipY - 0.03, kx: kneeOverride.x, ky: kneeOverride.y, ax: a.x, ay: a.y };
    return { hx, hy: hipY - 0.03, kx: r.kx, ky: r.ky, ax: r.ax, ay: r.ay };
  };
  const limb = (pts, w, col, edge) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((q, k) => (k ? ctx.lineTo(sx(q.x), sy(q.y)) : ctx.moveTo(sx(q.x), sy(q.y))));
    ctx.strokeStyle = edge; ctx.lineWidth = w * f + Math.max(2, f * 0.03); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w * f; ctx.stroke();
  };
  const shoe = (ax, ay, side, ang) => {
    ctx.save(); ctx.translate(sx(ax), sy(ay)); ctx.rotate(ang);
    ctx.fillStyle = '#1b1b24'; ctx.beginPath(); ctx.ellipse(side * 0.07 * f, 0.02 * f, 0.16 * f, 0.065 * f, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f1ead9'; ctx.fillRect(side * 0.07 * f - 0.16 * f, 0.055 * f, 0.32 * f, 0.03 * f);
    ctx.restore();
  };
  // soft ground shadow
  drawShadow(ctx, sx(x0), cam.Y(0, p.z) + f * 0.03, f * 0.42, f * 0.1, 0.3);
  const legs = [legPoints(-1), legPoints(1)];
  // order: the non-kicking leg first
  const order = kick ? [-kLeg, kLeg] : [-1, 1];
  const drawLeg = (side) => {
    const lg = legs[side < 0 ? 0 : 1];
    limb([{ x: lg.hx, y: lg.hy }, { x: lg.kx, y: lg.ky }, { x: lg.ax, y: lg.ay + 0.06 }], 0.15, co.trouser, 'rgba(8,10,24,0.55)');
    const aw = Math.atan2(lg.ay - lg.ky, lg.ax - lg.kx);
    shoe(lg.ax, lg.ay, side, clampv(aw + Math.PI / 2, -0.9, 0.9) * (kick && side === kLeg ? 0.8 : 0.2));
  };
  // arms (behind torso: far arm)
  const armPts = (side) => {
    const swing = kick ? (side === kLeg ? 0.2 * kick.s : -0.28 * kick.s) : Math.sin(t * 2.3 + side) * 0.03;
    const shx = sh.x + side * 0.17, shy = sh.y - 0.05;
    const hand = { x: x0 + side * (0.3 + 0.2 * Math.abs(swing) * 2.5), y: 1.0 + swing * 0.9 };
    const el = { x: (shx + hand.x) / 2 + side * 0.08, y: (shy + hand.y) / 2 - 0.02 };
    return [{ x: shx, y: shy }, el, hand];
  };
  drawLegLayer(order[0]);
  drawLegLayer(order[1]);
  function drawLegLayer(side) { drawLeg(side); }
  // far arm then torso then near arm
  const farSide = -kLeg;
  const arm = (side) => {
    const pts = armPts(side);
    limb(pts, 0.1, co.tunic, 'rgba(8,10,24,0.5)');
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(sx(pts[2].x), sy(pts[2].y), 0.055 * f, 0, TAU); ctx.fill();
  };
  arm(farSide);
  // tunic
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx(sh.x - 0.19), sy(sh.y)); ctx.lineTo(sx(sh.x + 0.19), sy(sh.y));
  ctx.quadraticCurveTo(sx(x0 + 0.21), sy(1.15), sx(x0 + 0.26), sy(0.76));
  ctx.lineTo(sx(x0 - 0.26), sy(0.76));
  ctx.quadraticCurveTo(sx(x0 - 0.21), sy(1.15), sx(sh.x - 0.19), sy(sh.y)); ctx.closePath();
  ctx.fillStyle = co.tunic; ctx.fill(); ctx.lineWidth = Math.max(1.5, f * 0.025); ctx.strokeStyle = 'rgba(8,10,24,0.55)'; ctx.stroke();
  // paper-cut details: trim along the hem, V collar and the sash
  ctx.clip();
  ctx.fillStyle = co.trim; ctx.fillRect(sx(x0 - 0.34), sy(0.82), 0.68 * f, 0.06 * f);
  ctx.fillStyle = co.sash; ctx.fillRect(sx(x0 - 0.34), sy(1.12), 0.68 * f, 0.11 * f);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sx(x0 - 0.34), sy(1.5), 0.2 * f, 0.8 * f);
  ctx.beginPath(); ctx.moveTo(sx(sh.x - 0.1), sy(sh.y)); ctx.lineTo(sx(sh.x), sy(sh.y - 0.2)); ctx.lineTo(sx(sh.x + 0.1), sy(sh.y)); ctx.closePath(); ctx.fillStyle = co.trim; ctx.fill();
  ctx.restore();
  // neck, head, hair (a faceless paper-cut silhouette)
  ctx.fillStyle = SKIN; ctx.fillRect(sx(sh.x) - 0.04 * f, sy(sh.y + 0.08), 0.08 * f, 0.1 * f);
  ctx.beginPath(); ctx.arc(sx(head.x), sy(head.y), 0.125 * f, 0, TAU); ctx.fillStyle = SKIN; ctx.fill(); ctx.lineWidth = Math.max(1.2, f * 0.02); ctx.strokeStyle = 'rgba(8,10,24,0.5)'; ctx.stroke();
  ctx.fillStyle = co.hair;
  ctx.beginPath(); ctx.arc(sx(head.x), sy(head.y + 0.02), 0.132 * f, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(sx(head.x - lean * 0.2), sy(head.y + 0.16), 0.06 * f, 0, TAU); ctx.fill();
  arm(kLeg);
  if (opt.mark) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.moveTo(sx(x0), sy(2.0) - 0.0); ctx.lineTo(sx(x0) - 0.09 * f, sy(2.18)); ctx.lineTo(sx(x0) + 0.09 * f, sy(2.18)); ctx.closePath(); ctx.fill();
  }
}

// ---- particles ----------------------------------------------------------------------------------------------------------
// kinds: 0 dust puff, 1 spark, 2 ring, 3 feather, 4 confetti paper
export function stepFx(list, dt) {
  for (const q of list) {
    q.t += dt;
    q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
    if (q.kind === 1 || q.kind === 4) q.vy -= 7 * dt;
    if (q.kind === 3) { q.vy -= 1.2 * dt; q.vx *= 1 - 1.6 * dt; q.vy *= 1 - 0.8 * dt; }
    if (q.kind === 0) { q.vx *= 1 - 3 * dt; q.vy *= 1 - 3 * dt; }
    if (q.spin) q.rot += q.spin * dt;
  }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= list[i].max) list.splice(i, 1);
}
export function drawFx(ctx, cam, list) {
  for (const q of list) {
    const k = q.t / q.max, a = 1 - k, px = cam.X(q.x, q.z), py = cam.Y(Math.max(0, q.y), q.z), u = cam.s * cam.persp(q.z);
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    if (q.kind === 0) { ctx.fillStyle = q.col || 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(px, py, u * q.size * (0.4 + k), 0, TAU); ctx.fill(); }
    else if (q.kind === 1) { ctx.fillStyle = q.col || '#ffe08a'; ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, u * q.size * (1 - k * 0.5)), 0, TAU); ctx.fill(); }
    else if (q.kind === 2) { ctx.strokeStyle = q.col || '#fff3b0'; ctx.lineWidth = Math.max(2, u * 0.06 * (1 - k)); ctx.beginPath(); ctx.arc(px, py, u * q.size * (0.3 + k * 1.1), 0, TAU); ctx.stroke(); }
    else if (q.kind === 3) { ctx.translate(px, py); ctx.rotate(q.rot); ctx.fillStyle = q.col; ctx.beginPath(); ctx.ellipse(0, 0, u * 0.045, u * 0.16, 0, 0, TAU); ctx.fill(); }
    else { ctx.translate(px, py); ctx.rotate(q.rot); ctx.fillStyle = q.col; ctx.fillRect(-u * q.size, -u * q.size * 0.5, u * q.size * 2, u * q.size); }
    ctx.restore();
  }
}
export const labelFont = (px, w = 700) => `${w} ${px}px ${FONT}`;
