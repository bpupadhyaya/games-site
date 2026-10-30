// All the drawing for Lapta: the village green seen from above and in front, the court chalk, birch trees, wooden fence and farmhouses,
// spectators, the batter / server / fielders (jointed figures with a run cycle), the ball and bat, particles and the rules diagrams.
// Pure canvas 2D, no DOM. World -> screen: P(g, x, y, z). x across, y toward the far line, z height; g comes from geom(area).
import { roundPath, FONT, NUM } from './ui.js';
import { K } from './sim.js';
import { GL } from './glbridge.js';
import { camState } from './cam.js';

export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const grad = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };

// Kit colours the batter can wear; more unlock with career points.
export const PALETTES = [
  { name: 'Sunflower', shirt: '#f1b91e', shade: '#b4820a', trim: '#3a2410', cap: '#6d4a06' },
  { name: 'Poppy red', shirt: '#d7402f', shade: '#9c2519', trim: '#fff1d6', cap: '#7a1d14' },
  { name: 'Cornflower', shirt: '#3b72d8', shade: '#244a99', trim: '#f4f8ff', cap: '#1b3568' },
  { name: 'Birch green', shirt: '#2f9a62', shade: '#1c6a40', trim: '#f5ffe8', cap: '#16482d' },
];
export const UNLOCKS = [0, 250, 700, 1400];
const SKIN = ['#f0c9a4', '#e3b48a', '#cf9a6f', '#b97d52'];
const HAIR = ['#3a2616', '#6b4423', '#1d1510', '#a8803f', '#8a8a86'];
const FIELD_KIT = [
  { shirt: '#f4f1e6', shade: '#c9c4b2', trim: '#274b8f' }, { shirt: '#e8e3d2', shade: '#bdb7a2', trim: '#8f2a2a' },
  { shirt: '#dfe9ee', shade: '#aebdc7', trim: '#1f6f78' },
];

// ---- geometry --------------------------------------------------------------------------------------------------------------------------
// The playing area `a` = {x, y, w, h} (screen units). Home is near the bottom, the far line near the top.
// Two projections share every call site:
//  * the 2D fallback keeps the old oblique 3/4 view (ty squashes depth);
//  * with the 3D layer on, g.cam is a real perspective camera behind the batter. P / unP and the WebGL camera use the SAME matrix, so every
//    2D guide (aim fan, ring, landing mark, floating text) lands on the pixel it belongs to.
// World axes of the camera model: X = sim x, Y = height, Z = -(sim y).
const PITCH = (a) => (a.w / a.h > 1.15 ? 0.44 : 0.66);       // camera looks down this many radians (landscape lower, portrait higher)
export function makeCam(a, pts, o = {}) {
  const pitch = o.pitch ?? PITCH(a), fov = o.fov ?? 0.78;
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  const fwd = [0, -sp, -cp], up = [0, cp, -sp];
  const f = (a.h * 0.5) / Math.tan(fov / 2);
  const T = o.target ?? [0, 0, -K.D * 0.42];
  const proj = (pos, p) => {
    const vx = p[0] - pos[0], vy = p[1] - pos[1], vz = p[2] - pos[2];
    const zc = vy * fwd[1] + vz * fwd[2], yc = vy * up[1] + vz * up[2];
    return [f * vx / zc, -f * yc / zc, zc];
  };
  const fitW = a.w * (o.fillX ?? 0.97), fitH = a.h * (o.fillY ?? 1.2);
  let lo = 6, hi = 400, pos = null, bb = null;
  for (let it = 0; it < 28; it++) {
    const d = (lo + hi) / 2;
    pos = [T[0] - fwd[0] * d, T[1] - fwd[1] * d, T[2] - fwd[2] * d];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, ok = true;
    for (const p of pts) { const q = proj(pos, p); if (q[2] < 1) { ok = false; break; } x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    bb = { x0, x1, y0, y1 };
    if (ok && x1 - x0 <= fitW && y1 - y0 <= fitH) hi = d; else lo = d;
  }
  pos = [T[0] - fwd[0] * hi, T[1] - fwd[1] * hi, T[2] - fwd[2] * hi];
  let x0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { const q = proj(pos, p); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  const cx = a.x + a.w / 2 - (x0 + x1) / 2;
  const cy = o.anchorY !== undefined ? o.anchorY - y1 : a.y + a.h - 6 - y1;       // the nearest point of the court sits on the bottom edge
  return { pos, fwd, up, f, cx, cy, pitch, near: 0.5, far: 400 };
}
const projCam = (c, x, y, z) => {
  const X = x - c.pos[0], Y = z - c.pos[1], Z = -y - c.pos[2];
  const zc = Y * c.fwd[1] + Z * c.fwd[2], yc = Y * c.up[1] + Z * c.up[2];
  const k = c.f / Math.max(0.05, zc);
  return { x: c.cx + X * k, y: c.cy - yc * k, k, d: zc };
};
// the framing of the playing court: the far line (Wv metres either side of the centre), the home area, and the fielders' heads
const COURT_PTS = (Wv) => {
  const p = [];
  for (const x of [-Wv, Wv]) p.push([x, 0, -(K.D + 1.5)], [x, 2.0, -(K.D - 1)]);
  p.push([-4, 0, 3.2], [4, 0, 3.2], [0, 2.3, -(K.HOME_Y - 0.4)]);
  return p;
};
let _camKey = '', _cam = null;
export function geom(a) {
  const XV = 18.2, yNeed = K.FENCE_Y + 3.5 + 2.5;
  let s = a.w / (2 * XV);
  s = Math.max(6, Math.min(s, a.h / (yNeed * 0.74)));
  const ty = clamp(a.h / (yNeed * s), 0.74, 1.3);
  const land = a.w / a.h > 1.15;
  if (GL.on) {
    const key = `${Math.round(a.x)},${Math.round(a.y)},${Math.round(a.w)},${Math.round(a.h)}`;
    if (key !== _camKey) {
      _camKey = key;

      _cam = makeCam(a, COURT_PTS(land ? 14.5 : 10.2), { target: [0, 0, -K.D * 0.36], fillX: 1.0, fillY: land ? 0.9 : 1.18, fov: land ? 0.74 : 0.82 });
    }
    const cam = { ..._cam, pos: [_cam.pos[0] + camState.x, _cam.pos[1], _cam.pos[2]] };
    const home = projCam(cam, 0, K.HOME_Y, 0);
    return { s: home.k, ty, zs: a.w / a.h > 1.15 ? 1 : 1.4, cx: a.x + a.w / 2, bottom: a.y + a.h - 6, y0: -3.5, a, u: s * 1.42, topY: -3.5 + a.h / (s * ty), cam };
  }
  return { s, ty, zs: 1, cx: a.x + a.w / 2, bottom: a.y + a.h - 6, y0: -3.5, a, u: s * 1.42, topY: -3.5 + a.h / (s * ty) };
}
export const P = (g, x, y, z = 0) => (g.cam ? projCam(g.cam, x, y, z) : { x: g.cx + x * g.s, y: g.bottom - (y - g.y0) * g.s * g.ty - z * g.s * 0.92 });
// Screen point -> ground point (z = 0).
export const unP = (g, sx, sy) => {
  if (!g.cam) return { x: (sx - g.cx) / g.s, y: g.y0 + (g.bottom - sy) / (g.s * g.ty) };
  const c = g.cam, vx = (sx - c.cx) / c.f, vy = -(sy - c.cy) / c.f;
  const dy = vy * c.up[1] + c.fwd[1], dz = vy * c.up[2] + c.fwd[2];            // ray direction (x: vx) in world Y and Z
  const t = dy < -1e-4 ? -c.pos[1] / dy : 400;
  return { x: c.pos[0] + vx * t, y: -(c.pos[2] + dz * t) };
};
// A circle (or arc) on the ground, as a path in screen space.
export function groundRing(ctx, g, x, y, r, a0 = 0, a1 = Math.PI * 2, z = 0) {
  const n = Math.max(12, Math.ceil(Math.abs(a1 - a0) / 0.22));
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, p = P(g, x + Math.cos(a) * r, y + Math.sin(a) * r, z); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
}

// ---- ground -------------------------------------------------------------------------------------------------------------------------------
export function drawGround(ctx, g, W, H, t) {
  // meadow with mowing stripes, slightly different inside the court
  ctx.fillStyle = '#4c9a3e'; ctx.fillRect(0, 0, W, H);
  const yTop = g.topY + 1, step = 3;
  for (let y = Math.floor(-12 / step) * step; y < yTop + step; y += step) {
    const a = P(g, 0, y).y, b = P(g, 0, y + step).y, k = Math.round(y / step) & 1;
    ctx.fillStyle = k ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, Math.min(a, b), W, Math.abs(a - b) + 1);
  }
  // the court: a lighter, evenly mown rectangle
  const c0 = P(g, -K.W, K.D + 3.5), c1 = P(g, K.W, -3);
  ctx.fillStyle = grad(ctx, 0, c0.y, 0, c1.y, [[0, '#6bb34c'], [1, '#5fa944']]);
  roundPath(ctx, c0.x, c0.y, c1.x - c0.x, c1.y - c0.y, 10 * g.s * 0.1 + 4); ctx.fill();
  for (let y = -3; y < K.D + 3.5; y += 2.2) {
    const a = P(g, 0, y).y, b = P(g, 0, Math.min(K.D + 3.5, y + 2.2)).y;
    if (Math.round((y + 3) / 2.2) & 1) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(c0.x, Math.min(a, b), c1.x - c0.x, Math.abs(a - b)); }
  }
  // worn earth: home ground, the server's spot and the far line strip
  const earth = (x, y, rx, ry) => { const p = P(g, x, y); ctx.fillStyle = 'rgba(143,112,66,0.55)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * g.s, ry * g.s * g.ty, 0, 0, 7); ctx.fill(); };
  earth(0, 0.6, 3.6, 2.4); earth(0, K.THROW_Y, 1.6, 1.0); earth(0, K.D + 0.2, 6.5, 1.0);
  // chalk
  ctx.strokeStyle = 'rgba(250,248,235,0.92)'; ctx.lineWidth = Math.max(2, g.s * 0.16); ctx.lineCap = 'round';
  const line = (x0, y0, x1, y1, dash) => { const a = P(g, x0, y0), b = P(g, x1, y1); ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); };
  line(-K.W, 0, K.W, 0);                          // home line
  line(-K.W, K.D, K.W, K.D);                      // far line
  line(-K.W, 0, -K.W, K.D, [g.s * 0.7, g.s * 0.7]); line(K.W, 0, K.W, K.D, [g.s * 0.7, g.s * 0.7]);
  // the batter's house: a short chalk box
  ctx.lineWidth = Math.max(2, g.s * 0.13);
  const h0 = P(g, -2.2, -1.8), h1 = P(g, 2.2, 1.8);
  ctx.strokeRect(h0.x, h1.y, h1.x - h0.x, h0.y - h1.y);
  // far-line posts
  for (const sx of [-K.W, K.W]) { const p = P(g, sx, K.D); postAt(ctx, p.x, p.y, g.s); }
}
function postAt(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + s * 0.2, y + s * 0.05, s * 0.45, s * 0.18, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#9b6a35'; roundPath(ctx, x - s * 0.18, y - s * 1.4, s * 0.36, s * 1.4, s * 0.08); ctx.fill();
  ctx.fillStyle = '#e9d6a8'; ctx.fillRect(x - s * 0.18, y - s * 1.0, s * 0.36, s * 0.22);
  ctx.restore();
}

// ---- village scenery ------------------------------------------------------------------------------------------------------------------------
export function birch(ctx, x, y, s, k = 0) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x + s * 1.1, y + s * 0.15, s * 1.5, s * 0.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#f2efe6'; roundPath(ctx, x - s * 0.16, y - s * 3.4, s * 0.32, s * 3.4, s * 0.1); ctx.fill();
  ctx.fillStyle = '#2b2a28'; for (let i = 0; i < 5; i++) ctx.fillRect(x - s * 0.16, y - s * (0.5 + i * 0.6 + hash(k + i) * 0.2), s * 0.32 * (0.4 + hash(k + i * 3) * 0.6), s * 0.09);
  const blobs = [[0, -4.6, 1.55, '#79b94a'], [-0.9, -3.8, 1.15, '#6aa83f'], [0.95, -3.9, 1.2, '#86c653'], [0.1, -5.4, 1.0, '#92d05a']];
  for (const [bx, by, r, c] of blobs) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + bx * s, y + by * s, r * s, 0, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(x - s * 0.4, y - s * 5.0, s * 0.8, 0, 7); ctx.fill();
  ctx.restore();
}
function izba(ctx, x, y, s, k) {
  // a log farmhouse seen from the front: logs, a steep roof, carved window trim, a little chimney
  const w = 8 * s, h = 3.4 * s, rh = 3.2 * s;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x + s * 0.8, y + s * 0.2, w * 0.62, s * 0.9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = grad(ctx, x, y - h, x, y, [[0, '#b27a3c'], [1, '#8f5d2b']]); ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.strokeStyle = 'rgba(60,35,12,0.55)'; ctx.lineWidth = Math.max(1, s * 0.07);
  for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2, y - h * i / 6); ctx.lineTo(x + w / 2, y - h * i / 6); ctx.stroke(); }
  const roof = ['#9b3f2a', '#6f8f3a', '#5b6c8f'][k % 3];
  ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - w / 2 - s * 0.5, y - h + s * 0.1); ctx.lineTo(x, y - h - rh); ctx.lineTo(x + w / 2 + s * 0.5, y - h + s * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.moveTo(x, y - h - rh); ctx.lineTo(x + w / 2 + s * 0.5, y - h + s * 0.1); ctx.lineTo(x, y - h + s * 0.1); ctx.closePath(); ctx.fill();
  for (const wx of [-2.2, 2.2]) {
    ctx.fillStyle = '#fff6df'; ctx.fillRect(x + wx * s - s * 0.9, y - h * 0.85, s * 1.8, s * 1.7);
    ctx.fillStyle = '#7fb3e0'; ctx.fillRect(x + wx * s - s * 0.7, y - h * 0.85 + s * 0.2, s * 1.4, s * 1.3);
    ctx.fillStyle = '#fff6df'; ctx.fillRect(x + wx * s - s * 0.05, y - h * 0.85 + s * 0.2, s * 0.1, s * 1.3);
  }
  ctx.fillStyle = '#5a3b25'; ctx.fillRect(x + w * 0.22, y - s * 2.6, s * 1.5, s * 2.6);
  ctx.fillStyle = '#5c4636'; ctx.fillRect(x - w * 0.3, y - h - rh * 0.65, s * 0.7, s * 1.5);
  ctx.restore();
}
function haystack(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x + s * 0.5, y + s * 0.1, s * 1.5, s * 0.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = grad(ctx, x, y - s * 2.4, x, y, [[0, '#e9c768'], [1, '#c79a3a']]);
  ctx.beginPath(); ctx.moveTo(x - s * 1.4, y); ctx.quadraticCurveTo(x - s * 1.2, y - s * 1.8, x, y - s * 2.6); ctx.quadraticCurveTo(x + s * 1.2, y - s * 1.8, x + s * 1.4, y); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function fenceRun(ctx, g, x0, x1, y) {
  const a = P(g, x0, y), b = P(g, x1, y), n = Math.max(2, Math.round(Math.abs(b.x - a.x) / (g.s * 1.8)));
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(a.x, a.y - 1, b.x - a.x, g.s * 0.35);
  for (let r = 0; r < 2; r++) { ctx.fillStyle = r ? '#b78a4e' : '#a47a42'; ctx.fillRect(a.x, a.y - g.s * (0.55 + r * 0.55), b.x - a.x, g.s * 0.18); }
  for (let i = 0; i <= n; i++) { const px = lerp(a.x, b.x, i / n); ctx.fillStyle = '#8e6232'; roundPath(ctx, px - g.s * 0.14, a.y - g.s * 1.4, g.s * 0.28, g.s * 1.4, g.s * 0.06); ctx.fill(); }
  ctx.restore();
}
function sideFence(ctx, g, x, y0, y1) {
  const n = Math.round((y1 - y0) / 1.9);
  for (let i = 0; i <= n; i++) {
    const p = P(g, x, lerp(y0, y1, i / n));
    ctx.fillStyle = '#8e6232'; roundPath(ctx, p.x - g.s * 0.13, p.y - g.s * 1.25, g.s * 0.26, g.s * 1.25, g.s * 0.06); ctx.fill();
  }
  const a = P(g, x, y0), b = P(g, x, y1);
  ctx.strokeStyle = '#a47a42'; ctx.lineWidth = g.s * 0.18;
  for (const dz of [0.5, 1.0]) { ctx.beginPath(); ctx.moveTo(a.x, a.y - g.s * dz); ctx.lineTo(b.x, b.y - g.s * dz); ctx.stroke(); }
}

// Everything that stands in the world around the court. Drawn far to near; `fore` = items nearer than the player's baseline (drawn last).
export function drawScenery(ctx, g, t, cheer = 0) {
  const s = g.s * 0.62;
  fenceRun(ctx, g, -K.FENCE_X - 4, K.FENCE_X + 4, K.FENCE_Y);
  sideFence(ctx, g, -K.FENCE_X, K.BACK_Y, K.FENCE_Y); sideFence(ctx, g, K.FENCE_X, K.BACK_Y, K.FENCE_Y);
  // houses and haystacks beyond the far fence
  const row = [[-14, 41.5, 0], [-2, 43.5, 1], [11, 41, 2], [24, 43, 1], [-27, 43, 2]];
  for (const [hx, hy, k] of row) { const p = P(g, hx, hy); if (p.y > -g.s * 14) izba(ctx, p.x, p.y, s, k); }
  for (const [hx, hy] of [[-5, 36.5], [7, 37.5], [-19, 36], [19, 36.5]]) { const p = P(g, hx, hy); haystack(ctx, p.x, p.y, s * 0.9); }
  // trees along the far side and the corners
  const trees = [[-24, 34, 1.15], [-17.5, 31.5, 1.0], [-9, 33.5, 0.9], [4, 34.5, 1.1], [14, 32.5, 1.0], [22, 34, 1.2], [-23, 12, 1.2], [23, 8, 1.25], [-23, 22, 1.0], [24, 24, 1.1]];
  trees.forEach(([tx, ty2, sc], i) => { const p = P(g, tx, ty2); birch(ctx, p.x, p.y, s * sc, i * 7); });
  // spectators on the benches along both sidelines
  spectators(ctx, g, t, cheer);
}
const SPEC = [['#c9473a', 0], ['#4a7fd0', 1], ['#e8b73a', 2], ['#7c5cc0', 0], ['#3f9a6a', 3], ['#d97fa3', 1], ['#e9e3d3', 2], ['#cf6a2d', 0]];
function spectators(ctx, g, t, cheer) {
  for (const side of [-1, 1]) {
    const x = side * (K.W + 2.4);
    // bench
    const a = P(g, x, 2), b = P(g, x, K.D - 1);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(Math.min(a.x, b.x) - g.s * 0.3, b.y, g.s * 0.9, a.y - b.y + g.s * 0.2);
    ctx.fillStyle = '#8c5f30'; ctx.fillRect(Math.min(a.x, b.x) - g.s * 0.25, b.y, g.s * 0.6, a.y - b.y);
    for (let i = 0; i < 6; i++) {
      const y = 4 + i * 3.4 + (side > 0 ? 1.3 : 0), p = P(g, x + side * 0.4, y), c = SPEC[(i + (side > 0 ? 3 : 0)) % SPEC.length];
      const wave = cheer > 0 ? Math.sin(t * 9 + i * 1.7) * 0.5 + 0.5 : 0;
      person(ctx, p.x, p.y, g.u * 0.78, { shirt: c[0], shade: 'rgba(0,0,0,0.25)', skin: SKIN[(i + 1) % 4], hair: HAIR[(i * 2 + 1) % 5], seated: true, arm: wave > 0.2 ? 'cheer' : 'idle', armT: wave, toward: side > 0 ? 'left' : 'right', scarf: i % 3 === 0 });
    }
  }
}

// ---- people --------------------------------------------------------------------------------------------------------------------------------
// o: shirt, shade, trim, pants, skin, hair, toward (true = we see the face, 'left'/'right' = side), run (phase, radians), moving, lean (-1..1),
//    arm: 'idle' | 'run' | 'throw' | 'catch' | 'bat' | 'cheer' | 'point', armT (0..1), cap, scarf, seated, alpha
export function person(ctx, x, y, u, o = {}) {
  const {
    shirt = '#c33', shade = 'rgba(0,0,0,0.25)', trim = null, pants = '#33405c', skin = SKIN[0], hair = HAIR[0], toward = false,
    run = 0, moving = false, lean = 0, arm = 'idle', armT = 0, cap = null, scarf = false, seated = false, alpha = 1,
  } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.beginPath(); ctx.ellipse(u * 0.12, u * 0.03, u * 0.4, u * 0.14, 0, 0, 7); ctx.fill();
  const sw = moving ? Math.sin(run) : 0, bob = moving ? Math.abs(Math.cos(run)) * u * 0.06 : 0;
  const hipY = (seated ? -0.55 : -0.88) * u - bob, shY = hipY - 0.5 * u, lx = lean * u * 0.1;
  // legs
  const leg = (side, ph) => {
    const lift = moving ? Math.max(0, ph) * 0.2 * u : 0, fwd = moving ? ph * 0.12 * u : 0;
    const fx = side * 0.11 * u, fy = seated ? -0.08 * u : -lift + fwd * 0.2;
    ctx.strokeStyle = pants; ctx.lineWidth = 0.17 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(side * 0.1 * u, hipY); ctx.lineTo(fx + (seated ? side * 0.05 * u : 0), fy + (seated ? 0 : -0.04 * u)); ctx.stroke();
    ctx.fillStyle = '#2a1d14'; ctx.beginPath(); ctx.ellipse(fx + side * 0.01 * u, fy, 0.11 * u, 0.065 * u, 0, 0, 7); ctx.fill();
  };
  leg(-1, sw); leg(1, -sw);
  // arms behind the torso
  const sh = [-0.25 * u + lx, 0.25 * u + lx];
  const armPose = (side) => {
    const sx = sh[side < 0 ? 0 : 1], sy = shY + 0.06 * u;
    let ex = sx + side * 0.07 * u, ey = sy + 0.5 * u;               // hand position, relaxed
    if (arm === 'run' || (moving && arm === 'idle')) { const ph = side * sw; ex = sx + side * 0.06 * u; ey = sy + 0.44 * u - ph * 0.1 * u; }
    else if (arm === 'throw') {
      if (side > 0) { const a = clamp(armT, 0, 1); ex = sx + 0.26 * u * (1 - 2 * a); ey = sy - 0.52 * u * (1 - 0.55 * Math.abs(2 * a - 1)) + 0.5 * u * Math.max(0, a - 0.7); }
      else { ex = sx - 0.12 * u; ey = sy + 0.3 * u; }
    } else if (arm === 'catch') { ex = sx + side * 0.22 * u; ey = sy - 0.45 * u; }
    else if (arm === 'cheer') { ex = sx + side * (0.2 + 0.1 * armT) * u; ey = sy - (0.35 + 0.2 * armT) * u; }
    else if (arm === 'bat') { ex = sx * 0.2 + side * 0.05 * u + 0.18 * u; ey = sy + 0.18 * u; }
    else if (arm === 'point') { ex = sx + side * 0.2 * u; ey = sy + 0.1 * u; }
    return { sx, sy, ex, ey };
  };
  const drawArm = (side) => {
    const a = armPose(side);
    ctx.strokeStyle = shirt; ctx.lineWidth = 0.15 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(lerp(a.sx, a.ex, 0.62), lerp(a.sy, a.ey, 0.62)); ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = 0.12 * u;
    ctx.beginPath(); ctx.moveTo(lerp(a.sx, a.ex, 0.62), lerp(a.sy, a.ey, 0.62)); ctx.lineTo(a.ex, a.ey); ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(a.ex, a.ey, 0.075 * u, 0, 7); ctx.fill();
  };
  if (toward === true || arm !== 'bat') drawArm(-1);
  // torso
  const tw = 0.27 * u;
  ctx.fillStyle = grad(ctx, -tw, 0, tw, 0, [[0, shirt], [1, shade]]);
  ctx.beginPath(); ctx.moveTo(-tw + lx, shY); ctx.quadraticCurveTo(0 + lx, shY - 0.08 * u, tw + lx, shY); ctx.lineTo(tw * 0.85, hipY + 0.05 * u); ctx.lineTo(-tw * 0.85, hipY + 0.05 * u); ctx.closePath(); ctx.fill();
  if (trim) { ctx.fillStyle = trim; ctx.fillRect(-tw * 0.9, hipY - 0.1 * u, tw * 1.8, 0.1 * u); }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-tw * 0.85, hipY + 0.0 * u, tw * 1.7, 0.07 * u);
  if (arm !== 'bat' || toward === true) drawArm(1); else drawArm(1);
  // head
  const hx = lx * 1.3, hy = shY - 0.2 * u, hr = 0.185 * u;
  ctx.fillStyle = skin; roundPath(ctx, hx - 0.07 * u, hy + hr * 0.7, 0.14 * u, 0.14 * u, 0.04 * u); ctx.fill();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, 7); ctx.fill();
  if (toward === true) {
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.2, hr * 1.02, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.fillStyle = '#2a2018'; ctx.beginPath(); ctx.arc(hx - hr * 0.38, hy + hr * 0.05, hr * 0.09, 0, 7); ctx.arc(hx + hr * 0.38, hy + hr * 0.05, hr * 0.09, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(120,50,40,0.7)'; ctx.lineWidth = hr * 0.1; ctx.beginPath(); ctx.arc(hx, hy + hr * 0.25, hr * 0.3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  } else if (toward === 'left' || toward === 'right') {
    const d = toward === 'left' ? -1 : 1;
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(hx - d * hr * 0.2, hy - hr * 0.1, hr * 1.02, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
    ctx.fillStyle = '#2a2018'; ctx.beginPath(); ctx.arc(hx + d * hr * 0.45, hy + hr * 0.05, hr * 0.09, 0, 7); ctx.fill();
  } else { ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(hx, hy, hr * 1.04, 0, 7); ctx.fill(); ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(hx - hr * 0.95, hy + hr * 0.12, hr * 0.15, hr * 0.22, 0, 0, 7); ctx.ellipse(hx + hr * 0.95, hy + hr * 0.12, hr * 0.15, hr * 0.22, 0, 0, 7); ctx.fill(); }
  if (cap) {
    ctx.fillStyle = cap; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.15, hr * 1.08, Math.PI, 2 * Math.PI); ctx.fill();
    if (toward === true) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(hx - hr * 1.1, hy - hr * 0.2, hr * 2.2, hr * 0.14); }
  }
  if (scarf) { ctx.fillStyle = '#e2523f'; ctx.beginPath(); ctx.arc(hx, hy - hr * 0.1, hr * 1.1, Math.PI * 0.95, Math.PI * 2.05); ctx.fill(); ctx.fillStyle = '#f4d35e'; ctx.fillRect(hx - hr * 0.2, hy - hr * 0.6, hr * 0.4, hr * 0.4); }
  ctx.restore();
  return { hx: x + hx, hy: y + hy, top: y + hy - hr, hands: armPose(1) };
}

export function drawBat(ctx, x, y, u, ang, color = '#b98a4e') {
  // a flat wooden paddle; x,y = the hands, ang 0 = pointing straight up the screen
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = color; roundPath(ctx, -u * 0.055, -u * 0.95, u * 0.11, u * 0.95, u * 0.04); ctx.fill();
  ctx.fillStyle = grad(ctx, -u * 0.17, 0, u * 0.17, 0, [[0, '#d0a468'], [1, '#9a6c33']]);
  roundPath(ctx, -u * 0.17, -u * 1.5, u * 0.34, u * 0.65, u * 0.08); ctx.fill();
  ctx.strokeStyle = 'rgba(70,40,10,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -u * 1.45); ctx.lineTo(0, -u * 0.9); ctx.stroke();
  ctx.restore();
}

export function drawBall(ctx, g, b, t = 0) {
  const sp = P(g, b.x, b.y, 0), bp = P(g, b.x, b.y, b.z), r = Math.max(4, g.s * 0.34);
  const sh = clamp(1 - b.z / 6, 0.35, 1);
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.34 * sh})`; ctx.beginPath(); ctx.ellipse(sp.x + r * 0.2, sp.y + r * 0.1, r * 0.95 * sh + r * 0.3, r * 0.38 * sh + r * 0.1, 0, 0, 7); ctx.fill();
  const gr = ctx.createRadialGradient(bp.x - r * 0.35, bp.y - r * 0.35, r * 0.1, bp.x, bp.y, r);
  gr.addColorStop(0, '#fffdf2'); gr.addColorStop(0.6, '#f0e4be'); gr.addColorStop(1, '#bba66b');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bp.x, bp.y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,30,0.7)'; ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.beginPath(); ctx.arc(bp.x, bp.y, r * 0.72, 0.4 + t * 6, 2.3 + t * 6); ctx.stroke();
  ctx.restore();
}

// ---- particles ----------------------------------------------------------------------------------------------------------------------------
export function emit(list, kind, x, y, n, rnd, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.283, sp = (o.speed ?? 120) * (0.35 + rnd() * 0.75);
    list.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - (o.up ?? 40), life: (o.life ?? 0.7) * (0.6 + rnd() * 0.6), t: 0, size: (o.size ?? 6) * (0.6 + rnd() * 0.8), col: o.cols ? o.cols[Math.floor(rnd() * o.cols.length)] : '#fff', g: o.g ?? 160, rot: rnd() * 6 });
  }
}
export function stepFx(list, dt) {
  for (const p of list) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 1 - dt * 1.2; }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= list[i].life) list.splice(i, 1);
}
export function drawFx(ctx, list) {
  for (const p of list) {
    const k = 1 - p.t / p.life;
    ctx.save(); ctx.globalAlpha = clamp(k * 1.4, 0, 1); ctx.fillStyle = p.col; ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.t * 4);
    if (p.kind === 'star') { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283 - 1.57, a2 = a + 0.628; ctx.lineTo(Math.cos(a) * p.size, Math.sin(a) * p.size); ctx.lineTo(Math.cos(a2) * p.size * 0.45, Math.sin(a2) * p.size * 0.45); } ctx.closePath(); ctx.fill(); }
    else if (p.kind === 'blade') { ctx.fillRect(-p.size * 0.15, -p.size * 0.5, p.size * 0.3, p.size); }
    else { ctx.beginPath(); ctx.arc(0, 0, p.size * (0.6 + 0.4 * k), 0, 7); ctx.fill(); }
    ctx.restore();
  }
}

// ---- a fielder / runner / batter as the view needs them ------------------------------------------------------------------------------------
export const fielderLook = (i) => ({ ...FIELD_KIT[i % FIELD_KIT.length], skin: SKIN[(i * 3 + 1) % 4], hair: HAIR[(i * 2) % 5], pants: ['#3b4a6b', '#4d3b2c', '#2f4a3c'][i % 3], cap: i % 2 ? null : '#4a3a28' });
export const batterLook = (pal) => ({ shirt: pal.shirt, shade: pal.shade, trim: pal.trim, skin: SKIN[1], hair: HAIR[0], pants: '#2c3550', cap: pal.cap });
export const serverLook = () => ({ shirt: '#e8dfc6', shade: '#b9ac86', trim: '#c43d3d', skin: SKIN[2], hair: HAIR[3], pants: '#4a3a2c', cap: null, scarf: false });

// ---- title hero and wordmark ----------------------------------------------------------------------------------------------------------------
export function wordmark(ctx, text, x, y, size) {
  ctx.save();
  ctx.font = `900 italic ${Math.round(size)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // soft cast shadow on the grass
  ctx.save(); ctx.shadowColor = 'rgba(0,20,0,0.55)'; ctx.shadowBlur = size * 0.35; ctx.shadowOffsetY = size * 0.16;
  ctx.fillStyle = '#2a1206'; ctx.lineWidth = size * 0.2; ctx.strokeStyle = '#2a1206'; ctx.strokeText(text, x, y + size * 0.08); ctx.restore();
  // extrusion: stacked copies down and to the right give the letters real depth
  const depth = Math.max(4, Math.round(size * 0.1));
  for (let i = depth; i >= 1; i--) {
    ctx.lineWidth = size * 0.1; ctx.strokeStyle = i > depth * 0.6 ? '#3a1a08' : '#6a3a10'; ctx.fillStyle = ctx.strokeStyle;
    ctx.strokeText(text, x + i * 0.35, y + i * 0.7); ctx.fillText(text, x + i * 0.35, y + i * 0.7);
  }
  // rim and face: polished brass with a hard horizon highlight
  ctx.lineWidth = Math.max(3, size * 0.075); ctx.strokeStyle = '#5c2c06'; ctx.strokeText(text, x, y);
  const gr = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.2, '#ffe88a'); gr.addColorStop(0.48, '#f7bf3e'); gr.addColorStop(0.52, '#d9921c'); gr.addColorStop(0.8, '#f0b73c'); gr.addColorStop(1, '#a8610c');
  ctx.fillStyle = gr; ctx.fillText(text, x, y);
  ctx.lineWidth = Math.max(1.5, size * 0.02); ctx.strokeStyle = 'rgba(255,250,215,0.85)'; ctx.strokeText(text, x - 0.5, y - 0.8);
  ctx.restore();
}
// a folk ornament under the title: a line with a diamond and two leaves either side
export function ornament(ctx, cx, y, w, col = '#ffe08a') {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.globalAlpha = 0.9;
  const h = w / 2;
  ctx.beginPath(); ctx.moveTo(cx - h, y); ctx.lineTo(cx - 14, y); ctx.moveTo(cx + 14, y); ctx.lineTo(cx + h, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, y - 7); ctx.lineTo(cx + 7, y); ctx.lineTo(cx, y + 7); ctx.lineTo(cx - 7, y); ctx.closePath(); ctx.fill();
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 14, y); ctx.quadraticCurveTo(cx + s * 24, y - 9, cx + s * 36, y - 2); ctx.quadraticCurveTo(cx + s * 24, y + 1, cx + s * 14, y); ctx.fill(); }
  ctx.restore();
}

export function drawHero(ctx, w, h, t, pal) {
  // a small green: the batter mid-swing, the server, two fielders watching, birches either side and a ball arcing over
  ctx.save();
  const s = Math.min(w / 15, h / 8.2), cx = w / 2, base = h * 0.94;
  const g = { s, ty: 0.8, cx, bottom: base, y0: 0, u: s * 1.5 };
  const pg = ctx.createRadialGradient(cx, base - s * 1.6, s, cx, base - s * 1.6, s * 9);
  pg.addColorStop(0, 'rgba(120,190,85,0.95)'); pg.addColorStop(0.7, 'rgba(110,180,80,0.5)'); pg.addColorStop(1, 'rgba(110,180,80,0)');
  ctx.fillStyle = pg; ctx.fillRect(0, h * 0.15, w, h);
  // chalk and earth
  ctx.fillStyle = 'rgba(143,112,66,0.5)'; const e = P(g, 0, 0.7); ctx.beginPath(); ctx.ellipse(e.x, e.y, s * 3.2, s * 1.5, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(250,248,235,0.85)'; ctx.lineWidth = Math.max(2, s * 0.14);
  const l0 = P(g, -7, 0), l1 = P(g, 7, 0); ctx.beginPath(); ctx.moveTo(l0.x, l0.y); ctx.lineTo(l1.x, l1.y); ctx.stroke();
  // birches
  const b1 = P(g, -6.8, 3.4), b2 = P(g, 6.9, 4.4); birch(ctx, b1.x, b1.y, s * 0.75, 3); birch(ctx, b2.x, b2.y, s * 0.7, 11);
  const ph = (t * 0.5) % 1;
  for (const [fx, fy, k, a] of [[-3.8, 5.3, 0, 'catch'], [3.9, 6.0, 1, 'idle']]) { const p = P(g, fx, fy); person(ctx, p.x, p.y, g.u * 0.75, { ...fielderLook(k), toward: true, arm: a, armT: 0.6 }); }
  const sp = P(g, 1.6, 3.4); person(ctx, sp.x, sp.y, g.u * 0.85, { ...serverLook(), toward: true, arm: ph < 0.25 ? 'throw' : 'catch', armT: clamp(ph / 0.25, 0, 1) });
  const bp = P(g, -0.6, 0.5), swing = clamp((ph - 0.5) / 0.14, 0, 1);
  const ang = lerp(0.9, -1.5, swing * swing * (3 - 2 * swing));
  const pp = person(ctx, bp.x, bp.y, g.u * 1.15, { ...batterLook(pal), toward: false, arm: 'bat', lean: swing * 0.5 });
  drawBat(ctx, bp.x + pp.hands.ex, bp.y + pp.hands.ey, g.u * 1.1, ang);
  // the ball: tossed from the server, struck, then away over the fielders
  let ball;
  if (ph < 0.5) { const f = clamp((ph - 0.05) / 0.45, 0, 1); ball = { x: lerp(1.6, -0.5, f), y: lerp(3.4, 0.9, f), z: 1.3 + Math.sin(f * Math.PI) * 3.2 }; }
  else { const f = clamp((ph - 0.5) / 0.5, 0, 1); ball = { x: lerp(-0.5, -5.5, f), y: lerp(0.9, 9, f), z: 1.0 + Math.sin(f * Math.PI) * 4.4 }; }
  if (ph > 0.05 && ph < 0.97) drawBall(ctx, g, ball, t);
  ctx.restore();
}

// ---- the diagrams on the How to Play / Rules pages ----------------------------------------------------------------------------------------
// Diagrams are plans, not pictures of people: every player is a plain round marker (shirt colour, white ring) standing on the chalk.
function pawn(ctx, x, y, u, o = {}) {
  const r = u * 0.36, cy = y - r * 1.05;
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x + r * 0.2, y, r * 1.05, r * 0.4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = o.shirt || '#d7402f'; ctx.beginPath(); ctx.arc(x, cy, r, 0, 7); ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.22); ctx.strokeStyle = '#fff6dc'; ctx.stroke();
  if (o.cap) { ctx.fillStyle = o.cap; ctx.beginPath(); ctx.arc(x, cy, r * 0.42, 0, 7); ctx.fill(); }
  ctx.restore();
  return { hx: x, hy: cy, top: cy - r, hands: { ex: u * 0.3, ey: -u * 0.5 } };
}

export function drawDiagram(kind, ctx, w, h) {
  const person = pawn;
  ctx.save();
  ctx.beginPath(); roundPath(ctx, 0, 0, w, h, 18); ctx.clip();
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#6fb64f'], [1, '#4f9c40']]); ctx.fillRect(0, 0, w, h);
  const s = Math.min(w / 36, h / 14), g = { s, ty: 0.8, cx: w / 2, bottom: h - 6, y0: -1.5, u: s * 1.28 };
  const sc = kind === 'field' || kind === 'score' || kind === 'rival' ? 0.52 : 1;
  const G = kind === 'field' || kind === 'score' || kind === 'rival' ? { s: Math.min(w / 40, h / (13 * 0.8)), ty: 0.8, cx: w / 2, bottom: h - 8, y0: -3, u: Math.min(w / 40, h / 10.4) * 1.28 } : g;
  void sc;
  const chalk = (x0, y0, x1, y1, dash) => { const a = P(G, x0, y0), b = P(G, x1, y1); ctx.strokeStyle = 'rgba(250,248,235,0.95)'; ctx.lineWidth = Math.max(2, G.s * 0.16); ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); };
  const label = (txt, x, y, size, col = '#fff6dc') => { ctx.save(); ctx.font = `800 ${size}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(20,50,20,0.85)'; ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y); ctx.restore(); };
  const arrow = (a, b, col = '#ffe08a', lw = 4) => { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); const an = Math.atan2(b.y - a.y, b.x - a.x); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - Math.cos(an - 0.45) * 14, b.y - Math.sin(an - 0.45) * 14); ctx.lineTo(b.x - Math.cos(an + 0.45) * 14, b.y - Math.sin(an + 0.45) * 14); ctx.closePath(); ctx.fill(); };
  const bat = batterLook(PALETTES[0]);
  if (kind === 'field' || kind === 'score' || kind === 'rival' || kind === 'outs') {
    const W = 11, D = 9;
    chalk(-W, 0, W, 0); chalk(-W, D, W, D); chalk(-W, 0, -W, D, [6, 6]); chalk(W, 0, W, D, [6, 6]);
    const spots = [[-5, 3.4], [5, 3.6], [0, 5.2], [-8, 6], [8, 6], [-2.5, 7.5]];
    spots.forEach(([x, y], i) => { const p = P(G, x, y); person(ctx, p.x, p.y, G.u * 0.9, { ...fielderLook(i), toward: true, arm: 'idle' }); });
    const bp = P(G, 0, 0.3); person(ctx, bp.x, bp.y, G.u * 1.0, { ...bat, toward: false, arm: 'bat' });
    const sp = P(G, 0, 1.9); person(ctx, sp.x, sp.y, G.u * 0.85, { ...serverLook(), toward: true, arm: 'throw', armT: 0.2 });
    label('FAR LINE', G.cx, P(G, 0, D).y - 14, Math.max(14, Math.round(G.s * 1.1)));
    label('HOME', G.cx, P(G, 0, 0).y + 16, Math.max(14, Math.round(G.s * 1.1)));
    if (kind === 'score') { arrow(P(G, 4, 0.3), P(G, 4, D - 0.4), '#ffe08a'); label('+1', P(G, 6.3, D * 0.7).x, P(G, 0, D * 0.7).y, Math.round(G.s * 1.8), '#ffe08a'); arrow(P(G, -4, D - 0.4), P(G, -4, 0.3), '#9ff0ff'); label('+2', P(G, -6.3, D * 0.4).x, P(G, 0, D * 0.4).y, Math.round(G.s * 1.8), '#9ff0ff'); }
    if (kind === 'outs') { const q = P(G, 3.4, 5.5); label('CAUGHT', q.x, q.y - 24, Math.round(G.s * 1.0), '#ffb3a0'); const r = P(G, -3, 4.5); label('TAGGED', r.x, r.y - 24, Math.round(G.s * 1.0), '#ffb3a0'); }
    if (kind === 'rival') { label('YOU BAT', G.cx - G.s * 7, P(G, 0, 4).y, Math.round(G.s * 1.1)); label('THEN THEY BAT', G.cx + G.s * 6.5, P(G, 0, 4).y, Math.round(G.s * 1.0)); }
  } else if (kind === 'serve') {
    const bp = P(G, 0, 0.5); person(ctx, bp.x, bp.y, G.u * 1.2, { ...bat, toward: false, arm: 'bat' });
    drawBat(ctx, bp.x + G.u * 0.2, bp.y - G.u * 1.2, G.u * 1.2, -0.5);
    const sp = P(G, 0, 7.3); person(ctx, sp.x, sp.y, G.u * 0.9, { ...serverLook(), toward: true, arm: 'throw', armT: 0.6 });
    for (let i = 0; i < 4; i++) { const f = i / 3, p = P(G, 0, 7 - f * 6.2, 1.3 + Math.sin(f * Math.PI) * 3.4); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); }
    drawBall(ctx, G, { x: 0, y: 1.2, z: 1.1 }, 0);
    const c = P(G, 0, 1.2, 1.1);
    for (const [r, a] of [[3.2, 0.25], [2.0, 0.5], [1.0, 0.9]]) { ctx.strokeStyle = `rgba(255,224,138,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, r * G.s, 0, 7); ctx.stroke(); }
    label('swing as the ring closes', G.cx, h * 0.14, Math.round(clamp(h * 0.12, 15, 26)));
  } else if (kind === 'aim') {
    const bp = P(G, 0, 0.5); person(ctx, bp.x, bp.y, G.u * 1.15, { ...bat, toward: false, arm: 'bat' });
    const o = P(G, 0, 1.4);
    for (const a of [-40, -20, 0, 20, 40]) { const r = (a * Math.PI) / 180, e = { x: o.x + Math.sin(r) * G.s * 9.5, y: o.y - Math.cos(r) * G.s * 9.5 * G.ty }; ctx.strokeStyle = a === 20 ? '#ffe08a' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = a === 20 ? 4 : 2; ctx.setLineDash(a === 20 ? [] : [6, 7]); ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.setLineDash([]); if (a === 20) arrow(o, e); }
    label('drag to aim, release to swing', G.cx, h * 0.12, Math.round(clamp(h * 0.12, 15, 26)));
  } else if (kind === 'run') {
    chalk(-9, 0, 9, 0); chalk(-9, 9, 9, 9);
    const r0 = P(G, 0, 0.5); person(ctx, r0.x, r0.y, G.u, { ...bat, toward: false, arm: 'run', moving: true, run: 1 });
    const r1 = P(G, 0, 6); person(ctx, r1.x, r1.y, G.u, { ...bat, toward: false, arm: 'run', moving: true, run: 2, alpha: 0.55 });
    arrow(P(G, 2.5, 1), P(G, 2.5, 8.2), '#ffe08a'); arrow(P(G, -2.5, 8.2), P(G, -2.5, 1), '#9ff0ff');
    const f = P(G, 7, 7); person(ctx, f.x, f.y, G.u * 0.9, { ...fielderLook(1), toward: true, arm: 'throw', armT: 0.3 });
    label('RUN', G.cx - G.s * 6, P(G, 0, 3).y, Math.round(G.s * 1.2)); label('stay or return', G.cx + G.s * 6, P(G, 0, 3).y, Math.round(G.s * 1.0));
  } else if (kind === 'dodge') {
    chalk(-9, 0, 9, 0);
    const a = P(G, 6, 8.5), b = P(G, 0, 3.6);
    const f = P(G, 6, 8.5); person(ctx, f.x, f.y, G.u * 0.9, { ...fielderLook(0), toward: true, arm: 'throw', armT: 0.6 });
    ctx.setLineDash([8, 8]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y - G.s * 1.4); ctx.lineTo(b.x, b.y - G.s * 0.9); ctx.stroke(); ctx.setLineDash([]);
    const r0 = P(G, 0, 3.6); person(ctx, r0.x, r0.y, G.u, { ...bat, toward: false, arm: 'run', moving: true, run: 0.6 });
    const r1 = P(G, -2.6, 3.7); person(ctx, r1.x, r1.y, G.u, { ...bat, toward: false, arm: 'run', moving: true, run: 2.4, lean: -0.7, alpha: 0.8 });
    arrow(P(G, 0.4, 3.0), P(G, -2.2, 3.0), '#9ff0ff');
    drawBall(ctx, G, { x: 3.2, y: 6.1, z: 1.0 }, 0.2);
  }
  ctx.restore();
}
