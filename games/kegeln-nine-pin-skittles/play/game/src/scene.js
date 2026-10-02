// The view down the lane: a stylised perspective (the lane is drawn shorter than it is so the pins stay large), the room,
// the polished wood, the lights, the turned-wood pins and the ball. Everything here is vector drawing every frame, no pre-baked
// images, so the first frame is instant. World units are metres: x across the lane, y up, z down the lane from the foul line.
import { PIN_POS, PIN_Z0, PIN_H, BALL_R, LANE_HALF, BOARD_X, BACK_Z, KING } from './phys.js';

export const TAU = Math.PI * 2;
export const ROOM_X = 1.32, ROOM_H = 3.6, WALL_Z = 24.6;
// Depth is warped: the long lane is shown short and the pin deck at full depth, so the diamond reads as a diamond from a raised
// camera. U(z) is the "virtual distance" of a point z metres down the lane; the perspective is real in U.
const U0 = 3.6;
export function U(z) {
  if (z <= 0) return U0 + 0.07 * z;
  if (z <= 12) return U0 + 0.07 * z;
  const a = U0 + 0.84;
  if (z <= 19.5) { const t = z - 12; return a + 0.07 * t + (0.93 * t * t * t) / (3 * 56.25); }
  const b = a + 0.07 * 7.5 + (0.93 * 421.875) / 168.75;
  return b + (z - 19.5);
}
export function zFromU(u) { let lo = -8, hi = 40; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (U(m) < u) lo = m; else hi = m; } return (lo + hi) / 2; }
const U_PINS = U(PIN_Z0);
// THE camera. One fixed camera for the whole delivery, like a bowler standing at the foul line looking down the lane, raised enough to
// read the pin diamond. It never moves, zooms, tilts or shakes: the lane, walls and pin deck keep the same screen position in every
// frame (rule: the playing surface never moves). Only the ball, the pins, the dust and the UI move.
// Tuning: uc 0 = the foul line, H = eye height (m), spins = pixels per virtual metre at the pin deck, ypins = screen y of the deck.
const FIX = { H: 2.0, spins: 236, ypins: 440 };
export function fixedCam() {
  const uc = 0, f = FIX.spins * (U_PINS - uc);
  return { uc, H: FIX.H, f, yh: FIX.ypins - FIX.H * FIX.spins, x: 0 };
}
// The small static close-up of the pin deck shown as an inset after a roll (never a move of the main view).
export function pipCam() { const uc = U_PINS - 2.4, H = 1.0, spins = 420, f = spins * 2.4; return { uc, H, f, yh: 640 - H * spins, x: 0 }; }
export const makeCam = fixedCam;
export const scaleAt = (cam, z) => cam.f / Math.max(0.35, U(z) - cam.uc);
export function proj(cam, x, y, z) {
  const s = scaleAt(cam, z);
  return { x: 360 + (x - cam.x) * s, y: cam.yh + (cam.H - y) * s, s };
}
export const laneXAt = (cam, sx, z) => cam.x + (sx - 360) / scaleAt(cam, z);
const nearZ = (cam) => Math.max(-3, zFromU(cam.uc + 0.9));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); }
function quad(ctx, cam, a, b, c, d) { poly(ctx, [proj(cam, ...a), proj(cam, ...b), proj(cam, ...c), proj(cam, ...d)]); }
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;

// ---------------------------------------------------------------------------------------------------------------
// The room
const LAMPS = [4.4, 5.6, 7.0, 8.8, 10.8].map((u) => zFromU(u));
export function drawRoom(ctx, cam, t) {
  const z0 = nearZ(cam), z1 = WALL_Z, X = ROOM_X, Hh = ROOM_H;
  // ceiling and background
  let g = ctx.createLinearGradient(0, 0, 0, cam.yh + 260);
  g.addColorStop(0, '#120a06'); g.addColorStop(0.6, '#2a1a0f'); g.addColorStop(1, '#3a2514');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 720, 1280);
  // back wall
  quad(ctx, cam, [-X, 0, z1], [X, 0, z1], [X, Hh, z1], [-X, Hh, z1]);
  g = ctx.createLinearGradient(0, proj(cam, 0, Hh, z1).y, 0, proj(cam, 0, 0, z1).y);
  g.addColorStop(0, '#3d2a18'); g.addColorStop(1, '#1a0f08'); ctx.fillStyle = g; ctx.fill();
  // side walls: dark panelling below the rail, warm plaster above
  for (const sd of [-1, 1]) {
    const x = sd * X;
    const rail = 1.05;
    quad(ctx, cam, [x, rail, z0], [x, rail, z1], [x, Hh, z1], [x, Hh, z0]);
    const a = proj(cam, x, rail, z1), b = proj(cam, x, Hh, z1);
    g = ctx.createLinearGradient(0, b.y, 0, a.y); g.addColorStop(0, '#5a3b22'); g.addColorStop(1, '#8a6238'); ctx.fillStyle = g; ctx.fill();
    quad(ctx, cam, [x, 0, z0], [x, 0, z1], [x, rail, z1], [x, rail, z0]);
    ctx.fillStyle = '#2b1810'; ctx.fill();
    // panel lines every 1.1 m
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    for (let z = Math.ceil(z0 / 1.1) * 1.1; z < z1; z += 1.1) {
      const p0 = proj(cam, x, 0.05, z), p1 = proj(cam, x, rail - 0.05, z);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    // brass rail
    quad(ctx, cam, [x, rail, z0], [x, rail, z1], [x, rail + 0.045, z1], [x, rail + 0.045, z0]);
    ctx.fillStyle = '#c9a24e'; ctx.fill();
    // framed plaques
    for (let z = 3; z < z1 - 2; z += 4.2) {
      const zz = z + (sd > 0 ? 1.6 : 0);
      quad(ctx, cam, [x, 1.5, zz], [x, 1.5, zz + 1.1], [x, 2.25, zz + 1.1], [x, 2.25, zz]);
      ctx.fillStyle = '#20150d'; ctx.fill(); ctx.strokeStyle = '#b8903f'; ctx.lineWidth = 3; ctx.stroke();
      quad(ctx, cam, [x, 1.6, zz + 0.1], [x, 1.6, zz + 1.0], [x, 2.15, zz + 1.0], [x, 2.15, zz + 0.1]);
      ctx.fillStyle = mix([150, 120, 70], [190, 150, 80], (Math.sin(z * 1.7) + 1) / 2); ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  // floor beside the lane
  quad(ctx, cam, [-X, 0, z0], [X, 0, z0], [X, 0, z1], [-X, 0, z1]);
  g = ctx.createLinearGradient(0, proj(cam, 0, 0, z1).y, 0, proj(cam, 0, 0, z0).y); g.addColorStop(0, '#1a1009'); g.addColorStop(1, '#2d1b10');
  ctx.fillStyle = g; ctx.fill();
  // pendant lamps
  for (const lz of LAMPS) {
    if (U(lz) < cam.uc + 0.8) continue;
    const top = proj(cam, 0, Hh + 0.4, lz), sh = proj(cam, 0, 3.0, lz);
    ctx.strokeStyle = '#120b06'; ctx.lineWidth = Math.max(1, sh.s * 0.012);
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(sh.x, sh.y - sh.s * 0.2); ctx.stroke();
    const w = sh.s * 0.34, h = sh.s * 0.2;
    ctx.save();
    const glow = ctx.createRadialGradient(sh.x, sh.y + h * 0.4, 1, sh.x, sh.y + h * 0.4, sh.s * 0.9);
    glow.addColorStop(0, 'rgba(255,214,140,0.55)'); glow.addColorStop(1, 'rgba(255,190,100,0)');
    ctx.fillStyle = glow; ctx.fillRect(sh.x - sh.s, sh.y - sh.s * 0.5, sh.s * 2, sh.s * 1.7);
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(sh.x - w * 0.3, sh.y - h); ctx.lineTo(sh.x + w * 0.3, sh.y - h); ctx.lineTo(sh.x + w, sh.y); ctx.lineTo(sh.x - w, sh.y); ctx.closePath();
    ctx.fillStyle = '#1f6a45'; ctx.fill(); ctx.strokeStyle = '#0c2e1d'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(sh.x, sh.y, w, h * 0.22, 0, 0, TAU); ctx.fillStyle = '#ffe3a6'; ctx.fill();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The lane: planks, gutters, pin deck, the rail, light pools
const PLANKS = 13;
export function drawLane(ctx, cam, t) {
  const z0 = Math.max(0, nearZ(cam)), z1 = BACK_Z;
  const pw = (2 * LANE_HALF) / PLANKS;
  // gutters
  for (const sd of [-1, 1]) {
    quad(ctx, cam, [sd * LANE_HALF, 0, z0], [sd * (LANE_HALF + 0.14), 0, z0], [sd * (LANE_HALF + 0.14), 0, z1], [sd * LANE_HALF, 0, z1]);
    ctx.fillStyle = '#150d08'; ctx.fill();
  }
  // lane edge strips (dark wood trim)
  for (const sd of [-1, 1]) {
    quad(ctx, cam, [sd * (LANE_HALF + 0.14), 0, z0], [sd * (LANE_HALF + 0.2), 0, z0], [sd * (LANE_HALF + 0.2), 0, z1], [sd * (LANE_HALF + 0.14), 0, z1]);
    ctx.fillStyle = '#4a2c16'; ctx.fill();
  }
  const near = proj(cam, 0, 0, z0), far = proj(cam, 0, 0, z1);
  for (let i = 0; i < PLANKS; i++) {
    const xa = -LANE_HALF + i * pw, xb = xa + pw;
    quad(ctx, cam, [xa, 0, z0], [xb, 0, z0], [xb, 0, z1], [xa, 0, z1]);
    const tone = 0.5 + 0.5 * Math.sin(i * 2.7 + 0.6) * Math.cos(i * 1.3);
    const g = ctx.createLinearGradient(0, far.y, 0, near.y);
    g.addColorStop(0, mix([170, 112, 58], [192, 134, 70], tone)); g.addColorStop(1, mix([205, 150, 82], [226, 170, 98], tone));
    ctx.fillStyle = g; ctx.fill();
  }
  // plank seams
  ctx.strokeStyle = 'rgba(70,38,12,0.32)'; ctx.lineWidth = 1.5;
  for (let i = 0; i <= PLANKS; i++) {
    const x = -LANE_HALF + i * pw, a = proj(cam, x, 0, z0), b = proj(cam, x, 0, z1);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // pin deck: a paler panel with a dark spot under every pin
  quad(ctx, cam, [-LANE_HALF, 0, PIN_Z0 - 0.3], [LANE_HALF, 0, PIN_Z0 - 0.3], [LANE_HALF, 0, z1], [-LANE_HALF, 0, z1]);
  ctx.fillStyle = 'rgba(255,225,160,0.14)'; ctx.fill();
  ctx.strokeStyle = 'rgba(60,32,10,0.55)'; ctx.lineWidth = 2;
  { const a = proj(cam, -LANE_HALF, 0, PIN_Z0 - 0.3), b = proj(cam, LANE_HALF, 0, PIN_Z0 - 0.3); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  for (const p of PIN_POS) {
    const c = proj(cam, p.x, 0, p.z);
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 0.062 * c.s, 0.022 * c.s + 0.5, 0, 0, TAU); ctx.fillStyle = 'rgba(30,14,4,0.55)'; ctx.fill();
  }
  // foul line
  if (z0 < 0.2) {
    quad(ctx, cam, [-LANE_HALF, 0, -0.03], [LANE_HALF, 0, -0.03], [LANE_HALF, 0, 0.05], [-LANE_HALF, 0, 0.05]);
    ctx.fillStyle = '#2a1608'; ctx.fill();
  }
  // lengthways sheen
  const sheen = ctx.createLinearGradient(proj(cam, -LANE_HALF, 0, z0).x, 0, proj(cam, LANE_HALF, 0, z0).x, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.38, 'rgba(255,244,214,0.12)'); sheen.addColorStop(0.5, 'rgba(255,244,214,0.04)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  quad(ctx, cam, [-LANE_HALF, 0, z0], [LANE_HALF, 0, z0], [LANE_HALF, 0, z1], [-LANE_HALF, 0, z1]);
  ctx.fillStyle = sheen; ctx.fill();
  // light pools under the lamps
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const lz of LAMPS) {
    const c = proj(cam, 0, 0, lz + 0.8);
    if (U(lz) < cam.uc + 0.5) continue;
    const rx = 0.95 * c.s, ry = 0.55 * c.s * 0.34 + 4;
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rx);
    g.addColorStop(0, 'rgba(255,220,150,0.34)'); g.addColorStop(0.6, 'rgba(255,200,120,0.1)'); g.addColorStop(1, 'rgba(255,190,100,0)');
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, ry / rx); ctx.translate(-c.x, -c.y); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, rx, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  // the pit behind the pins: back board and net
  quad(ctx, cam, [-BOARD_X, 0, z1], [BOARD_X, 0, z1], [BOARD_X, 0.7, z1], [-BOARD_X, 0.7, z1]);
  ctx.fillStyle = '#2a170b'; ctx.fill();
  quad(ctx, cam, [-BOARD_X, 0.7, z1], [BOARD_X, 0.7, z1], [BOARD_X, 2.1, z1], [-BOARD_X, 2.1, z1]);
  ctx.fillStyle = 'rgba(8,5,3,0.82)'; ctx.fill();
  ctx.strokeStyle = 'rgba(120,100,70,0.35)'; ctx.lineWidth = 1;
  for (let i = -8; i <= 8; i++) { const a = proj(cam, i * 0.125, 0.7, z1), b = proj(cam, i * 0.125, 2.1, z1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  for (let y = 0.7; y <= 2.1; y += 0.14) { const a = proj(cam, -BOARD_X, y, z1), b = proj(cam, BOARD_X, y, z1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  // side boards of the pit
  for (const sd of [-1, 1]) {
    quad(ctx, cam, [sd * BOARD_X, 0, PIN_Z0 - 0.3], [sd * BOARD_X, 0, z1], [sd * BOARD_X, 0.5, z1], [sd * BOARD_X, 0.5, PIN_Z0 - 0.3]);
    ctx.fillStyle = '#3a2314'; ctx.fill();
  }
  // ball return rail on the right
  const rx0 = 1.12;
  quad(ctx, cam, [rx0 - 0.09, 0.13, z0], [rx0 + 0.09, 0.13, z0], [rx0 + 0.09, 0.13, PIN_Z0 - 0.4], [rx0 - 0.09, 0.13, PIN_Z0 - 0.4]);
  ctx.fillStyle = '#7a4d28'; ctx.fill();
  quad(ctx, cam, [rx0 - 0.09, 0.13, z0], [rx0 - 0.09, 0, z0], [rx0 - 0.09, 0, PIN_Z0 - 0.4], [rx0 - 0.09, 0.13, PIN_Z0 - 0.4]);
  ctx.fillStyle = '#4a2c16'; ctx.fill();
  const ra = proj(cam, rx0 - 0.02, 0.135, z0), rb = proj(cam, rx0 - 0.02, 0.135, PIN_Z0 - 0.4);
  ctx.strokeStyle = 'rgba(255,230,170,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ra.x, ra.y); ctx.lineTo(rb.x, rb.y); ctx.stroke();
}

// ---------------------------------------------------------------------------------------------------------------
// Pins: a surface of revolution (the classic bulging nine-pin shape) drawn as one silhouette plus bands, lit from the upper left.
const PROFILE = [[0, 0.034], [0.008, 0.05], [0.035, 0.06], [0.1, 0.062], [0.16, 0.054], [0.21, 0.04], [0.245, 0.027], [0.275, 0.025], [0.305, 0.032], [0.34, 0.039], [0.365, 0.034], [0.38, 0.02], [0.385, 0]];
const SAMPLES = PROFILE.map(([h]) => h);
export function drawPin(ctx, cam, p, opts = {}) {
  if (p.st < 0) return;
  const th = p.st === 0 ? (p.wob || 0) * Math.sin(p.ph || 0) : p.th, sinT = Math.sin(th), cosT = Math.cos(th);
  const dx = p.dx || 0, dz = p.dz || 1;
  const lift = opts.lift || 0, alpha = opts.alpha ?? 1;
  const offFoot = p.st === 0 ? 0 : 0.19 * Math.sin(p.th);
  const fx = p.x - dx * offFoot, fz = p.z - dz * offFoot;
  const king = p.id === KING;
  const pts = PROFILE.map(([h, r]) => {
    const wx = fx + dx * h * sinT, wz = fz + dz * h * sinT, wy = h * cosT + (p.st === 0 ? 0 : 0.062 * sinT) + lift;
    const c = proj(cam, wx, wy, wz);
    return { x: c.x, y: c.y, r: r * c.s, h };
  });
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const tl = Math.hypot(tx, ty);
    let nx, ny;
    const ref = pts[i].r;
    if (tl < ref * 0.6) { nx = 1; ny = 0; } else { nx = -ty / tl; ny = tx / tl; if (nx < 0) { nx = -nx; ny = -ny; } if (tl < ref * 1.4) { const k = (tl - ref * 0.6) / (ref * 0.8); nx = nx * k + (1 - k); ny = ny * k; const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl; } }
    L.push({ x: pts[i].x - nx * pts[i].r, y: pts[i].y - ny * pts[i].r }); R.push({ x: pts[i].x + nx * pts[i].r, y: pts[i].y + ny * pts[i].r });
    pts[i].nx = nx; pts[i].ny = ny;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  const outline = [...L, ...R.reverse()];
  const mid = pts[3], big = Math.max(mid.r, 1);
  const baseCol = '#f1e6c8';
  poly(ctx, outline); ctx.fillStyle = baseCol; ctx.fill();
  if (p.st !== 0 || th !== 0) { for (const i of [0, pts.length - 2]) { ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, Math.max(1, pts[i].r), 0, TAU); ctx.fillStyle = baseCol; ctx.fill(); } }
  // bands: red neck, and on the King a gold crown and collar
  // (R was reversed for the outline) rebuild the right side for the bands
  const Rp = []; for (let i = 0; i < pts.length; i++) Rp.push({ x: pts[i].x + pts[i].nx * pts[i].r, y: pts[i].y + pts[i].ny * pts[i].r });
  const band2 = (h0, h1, col) => {
    const idx = []; for (let i = 0; i < pts.length; i++) if (pts[i].h >= h0 - 1e-6 && pts[i].h <= h1 + 1e-6) idx.push(i);
    if (idx.length < 2) return;
    poly(ctx, [...idx.map((i) => L[i]), ...idx.map((i) => Rp[i]).reverse()]); ctx.fillStyle = col; ctx.fill();
  };
  band2(0.21, 0.275, king ? '#d9a93a' : '#c0392b');
  if (king) band2(0.34, 0.385, '#d9a93a');
  // cylinder shading across the pin, light from the upper left
  const nx = mid.nx, ny = mid.ny;
  const g = ctx.createLinearGradient(mid.x - nx * big, mid.y - ny * big, mid.x + nx * big, mid.y + ny * big);
  g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.3, 'rgba(255,255,255,0)'); g.addColorStop(0.65, 'rgba(60,30,6,0.16)'); g.addColorStop(1, 'rgba(30,12,0,0.5)');
  poly(ctx, outline); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1, big * 0.05); ctx.strokeStyle = 'rgba(70,40,15,0.65)'; ctx.stroke();
  ctx.restore();
}
function drawShadow(ctx, cam, x, z, rx, ry, a = 0.38, rot = 0) {
  const c = proj(cam, x, 0, z);
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(rot); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * c.s); g.addColorStop(0, `rgba(10,4,0,${a})`); g.addColorStop(1, 'rgba(10,4,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx * c.s, 0, TAU); ctx.fill(); ctx.restore();
}
export function pinShadow(ctx, cam, p, alpha = 1) {
  if (p.st < 0) return;
  if (p.st === 0) drawShadow(ctx, cam, p.x, p.z, 0.1, 0.045, 0.4 * alpha);
  else {
    const a = proj(cam, p.x, 0, p.z), b = proj(cam, p.x + (p.dx || 0), 0, p.z + (p.dz || 1)), ang = Math.atan2(b.y - a.y, b.x - a.x);
    drawShadow(ctx, cam, p.x, p.z, 0.1 + 0.15 * Math.sin(p.th), 0.06, 0.38 * alpha, Math.abs(ang) < 1.2 || Math.abs(ang) > 1.94 ? ang : 0);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The ball: a heavy dark ball, with three pale spots so you can see it rolling.
export function drawBall(ctx, cam, b, roll = 0, opts0) {
  const opts = opts0 || {};
  const c = proj(cam, b.x, BALL_R + (opts.lift || 0), b.z), r = BALL_R * c.s;
  drawShadow(ctx, cam, b.x, b.z, 0.11, 0.05, 0.45);
  ctx.save();
  if (opts.glow) { const g = ctx.createRadialGradient(c.x, c.y, r * 0.8, c.x, c.y, r * 2.2); g.addColorStop(0, `rgba(255,220,140,${opts.glow})`); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, r * 2.2, 0, TAU); ctx.fill(); }
  const g = ctx.createRadialGradient(c.x - r * 0.38, c.y - r * 0.42, r * 0.08, c.x, c.y, r);
  g.addColorStop(0, '#8a4a38'); g.addColorStop(0.35, '#4c1c18'); g.addColorStop(1, '#12060a');
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.clip();
  for (let k = 0; k < 3; k++) {
    const a0 = roll + k * 2.1, mx = 0.5 * Math.cos(k * 2.1 + 0.5), my0 = -0.86, mz0 = 0.86 * Math.sin(k * 2.1);
    // rotate (mx, my0, mz0) about the lateral axis by `roll`
    const my = my0 * Math.cos(a0) - mz0 * Math.sin(a0), mz = my0 * Math.sin(a0) + mz0 * Math.cos(a0);
    void my; if (mz > 0.05) continue;
    ctx.beginPath(); ctx.ellipse(c.x + mx * r, c.y + my * r * 0.9, r * 0.2, r * 0.13 * (0.5 + -mz), 0, 0, TAU); ctx.fillStyle = 'rgba(240,215,170,0.5)'; ctx.fill();
  }
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(c.x - r * 0.34, c.y - r * 0.4, r * 0.2, r * 0.12, -0.7, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  ctx.restore();
  return c;
}

// ---------------------------------------------------------------------------------------------------------------
// Everything that stands or lies on the deck plus the ball, far to near.
export function drawActors(ctx, cam, pins, ball, extra = {}) {
  const list = [];
  for (const p of pins) if (p.st >= 0) list.push({ z: p.z + (p.st === 0 ? 0 : 0.05), pin: p });
  if (ball && ball.on !== false && !extra.hideBall) list.push({ z: ball.z + 0.05, ball });
  list.sort((a, b) => b.z - a.z);
  for (const e of list) if (e.pin) pinShadow(ctx, cam, e.pin, extra.alphaOf ? extra.alphaOf(e.pin) : 1);
  for (const e of list) {
    if (e.pin) {
      const k = extra.dropOf ? extra.dropOf(e.pin) : 0;
      drawPin(ctx, cam, e.pin, { lift: k, alpha: extra.alphaOf ? extra.alphaOf(e.pin) : 1 });
    } else drawBall(ctx, cam, e.ball, ((e.ball.z / BALL_R) % TAU) || 0, extra.ballOpts);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Overlays painted on the lane: a dashed path, a target ring.
export function drawPath(ctx, cam, pts, col, t, width = 0.045, alpha = 1) {
  const sp = pts.map((p) => proj(cam, p.x, 0.004, p.z));
  ctx.save();
  ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i + 1 < sp.length; i++) {
    const a = sp[i], b = sp[i + 1];
    const w = Math.max(2, width * (a.s + b.s) / 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = w + 3; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(a.x, a.y + 1); ctx.lineTo(b.x, b.y + 1); ctx.stroke();
  }
  ctx.strokeStyle = col; ctx.setLineDash([Math.max(6, sp[0].s * 0.05), Math.max(6, sp[0].s * 0.05)]); ctx.lineDashOffset = -t * 40;
  for (let i = 0; i + 1 < sp.length; i++) {
    const a = sp[i], b = sp[i + 1];
    ctx.lineWidth = Math.max(2, width * (a.s + b.s) / 2); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.restore();
}
export function drawTarget(ctx, cam, x, z, col, t, label) {
  const c = proj(cam, x, 0.005, z), r = 0.1 * c.s;
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, r * 0.14);
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.4);
  ctx.beginPath(); ctx.arc(0, 0, r * (1 + 0.06 * Math.sin(t * 5)), 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, TAU); ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(c.x - r * 1.5, c.y); ctx.lineTo(c.x - r * 0.7, c.y); ctx.moveTo(c.x + r * 0.7, c.y); ctx.lineTo(c.x + r * 1.5, c.y); ctx.stroke();
  if (label) { ctx.font = '700 18px Georgia, serif'; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(label, c.x, c.y - r * 0.9 - 6); }
  ctx.restore();
}
export function drawParts(ctx, cam, parts) {
  for (const p of parts) {
    const c = proj(cam, p.x, p.y, p.z), k = 1 - p.t / p.max;
    ctx.globalAlpha = Math.max(0, p.k === 'dust' ? k * 0.55 : k);
    ctx.fillStyle = p.col;
    if (p.k === 'dust') { ctx.beginPath(); ctx.arc(c.x, c.y, p.size * c.s * (1.4 - k * 0.6), 0, TAU); ctx.fill(); }
    else { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(p.rot + p.t * p.spin); ctx.fillRect(-p.size * c.s * 0.5, -p.size * c.s * 0.2, p.size * c.s, p.size * c.s * 0.4); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
}


export { clamp };
