// The arena seen from above: ground, rake marks, fence, timing line, barrels, the rider, the rival's ghost, dust and the line you rode.
// Pure drawing from a state object; nothing here changes the simulation. The arena is turned a quarter turn in landscape so it fills the
// screen either way (the rider always rides "up" in portrait and "right" in landscape).
import { ARENA, BARREL_R, WIND_DONE, WIND_RING } from './consts.js';
import { dirOf } from './sim.js';
import { rig3 } from './camera3d.js';

const TAU = Math.PI * 2;
const FRAME = { x0: -21.8, x1: 21.8, y0: -12.2, y1: 54.2 };   // what the camera must show (the fence plus a margin)
const CY = (FRAME.y0 + FRAME.y1) / 2;
const hash = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

export const LOOKS = [
  { name: 'Dawn', g0: '#cfa878', g1: '#b48a58', rake: 'rgba(255,240,210,0.12)', tint: 'rgba(255,170,120,0.12)', out0: '#2b2038', out1: '#4a3050', fence: '#8a5b34', night: 0 },
  { name: 'Day', g0: '#dbb985', g1: '#bd9a62', rake: 'rgba(255,248,224,0.14)', tint: null, out0: '#3a5a46', out1: '#55785a', fence: '#8f6038', night: 0 },
  { name: 'Afternoon', g0: '#d9b074', g1: '#b98d54', rake: 'rgba(255,236,190,0.14)', tint: 'rgba(255,200,110,0.10)', out0: '#4a5a40', out1: '#6a7a48', fence: '#935e30', night: 0 },
  { name: 'Dusk', g0: '#bf926a', g1: '#946c4a', rake: 'rgba(255,210,200,0.10)', tint: 'rgba(110,60,130,0.20)', out0: '#1f1830', out1: '#3a2440', fence: '#6e4530', night: 0.3 },
  { name: 'Floodlit', g0: '#ab8660', g1: '#80613f', rake: 'rgba(200,220,255,0.10)', tint: 'rgba(8,16,48,0.40)', out0: '#0a0e1e', out1: '#16203a', fence: '#4a3622', night: 0.7 },
];

// precomputed speckle of the ground (fixed, so the picture never shimmers)
const SPECK = Array.from({ length: 420 }, (_, i) => ({ x: ARENA.x0 + hash(i) * (ARENA.x1 - ARENA.x0), y: ARENA.y0 + hash(i + 900) * (ARENA.y1 - ARENA.y0), r: 0.05 + hash(i + 1700) * 0.14, a: 0.05 + hash(i + 2500) * 0.12, dark: hash(i + 3100) > 0.45 }));
const CROWD_COL = ['#d9c7a0', '#8fb3c9', '#c96a5a', '#e0b24a', '#7fa56e', '#b693c4'];

// Camera: world metres -> virtual screen units. area = the rectangle of the screen the arena may use. gl = the 3D presenter is drawing the arena:
// then the ground is seen in perspective (src/camera3d.js, the very camera the presenter renders with) and c.x / c.y project through it; without
// WebGL the flat top-down picture below is used.
export function makeCam(W, H, area, land, gl = false, focus = null) {
  const a = area || { x: 0, y: 0, w: W, h: H };
  const fw = FRAME.x1 - FRAME.x0, fl = FRAME.y1 - FRAME.y0;
  const sP = Math.min(a.w / fw, a.h / fl), sL = Math.min(a.w / fl, a.h / fw);
  land = sL > sP * 1.02;   // turn the arena a quarter turn whenever that makes it larger
  if (gl) {
    const R = rig3(W, H, a, land, focus);
    const c = { s: R.s, land, cx: a.x + a.w / 2, cy: a.y + a.h / 2, W, H, area: a, gl: true, rig: R };
    c.x = (wx, wy, wz = 0) => R.proj(wx, wy, wz)[0];
    c.y = (wx, wy, wz = 0) => R.proj(wx, wy, wz)[1];
    c.rot = (th) => th;
    return c;
  }
  const s = land ? sL : sP;
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  const c = { s, land, cx, cy, W, H, area: a, gl: false };
  c.x = land ? (wx, wy) => cx + (wy - CY) * s : (wx) => cx + wx * s;
  c.y = land ? (wx) => cy + wx * s : (wx, wy) => cy - (wy - CY) * s;
  c.rot = (th) => th + (land ? Math.PI / 2 : 0);
  return c;
}
// does the layout turn the arena a quarter turn? (the GL presenter needs the same answer before it has a camera)
export const landFor = (W, H, area) => {
  const a = area || { x: 0, y: 0, w: W, h: H };
  return Math.min(a.w / (FRAME.y1 - FRAME.y0), a.h / (FRAME.x1 - FRAME.x0)) > Math.min(a.w / (FRAME.x1 - FRAME.x0), a.h / (FRAME.y1 - FRAME.y0)) * 1.02;
};
// screen point -> world (used by the dev tools)
export const toWorld = (c, px, py) => (c.land ? { x: (py - c.cy) / c.s, y: (px - c.cx) / c.s + CY } : { x: (px - c.cx) / c.s, y: CY - (py - c.cy) / c.s });

function poly(ctx, c, pts, close = false) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (i === 0) ctx.moveTo(c.x(p.x, p.y), c.y(p.x, p.y)); else ctx.lineTo(c.x(p.x, p.y), c.y(p.x, p.y)); }
  if (close) ctx.closePath();
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// rectangle of the arena in screen space (axis aligned)
const rectOf = (c, x0, y0, x1, y1) => {
  const ax = c.x(x0, y0), ay = c.y(x0, y0), bx = c.x(x1, y1), by = c.y(x1, y1);
  return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
};

function drawOutside(ctx, c, look) {
  const W = c.W, H = c.H;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, look.out0); g.addColorStop(1, look.out1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // the stands: a dark band round the fence with rows of spectators
  const f = rectOf(c, ARENA.x0, ARENA.y0, ARENA.x1, ARENA.y1), m = 6.2 * c.s;
  ctx.save();
  ctx.fillStyle = `rgba(14,8,4,${0.35 + look.night * 0.2})`; rrect(ctx, f.x - m, f.y - m, f.w + 2 * m, f.h + 2 * m, m * 0.6); ctx.fill();
  ctx.globalAlpha = 0.9 - look.night * 0.45;
  const r = Math.max(2.2, c.s * 0.4);
  let n = 0;
  for (let row = 0; row < 3; row++) {
    const d = (1.8 + row * 1.35) * c.s, step = c.s * 1.15;
    const xo = f.x - d, xi = f.x + f.w + d, yo = f.y - d, yi = f.y + f.h + d;
    // each spectator: shoulders in a shirt colour with a lit edge, a head with a hat (or hair) and a small shadow
    const HAT = ['#6e4a2a', '#d9c08c', '#f0e6cc', '#3a2a1c', '#8a6a3c', '#2b2b2b'], SKIN = ['#e8b890', '#c68b5e', '#8a5a3a', '#f1cba4'];
    const put = (x, y) => {
      n++; const j = hash(n * 3 + row), px = x + (j - 0.5) * c.s * 0.3, py = y + (hash(n + 9) - 0.5) * c.s * 0.3, k = r * 1.05;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(px + k * 0.15, py + k * 0.2, k * 1.0, k * 0.72, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = CROWD_COL[Math.floor(hash(n) * 6)]; ctx.beginPath(); ctx.ellipse(px, py, k * 1.0, k * 0.7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(px - k * 0.2, py - k * 0.15, k * 0.5, k * 0.22, 0, 0, TAU); ctx.fill();
      const v = hash(n + 55);
      ctx.fillStyle = v < 0.5 ? HAT[Math.floor(hash(n + 5) * 6)] : '#2a1a10';
      ctx.beginPath(); ctx.arc(px, py - k * 0.28, k * (v < 0.5 ? 0.62 : 0.48), 0, TAU); ctx.fill();
      if (v >= 0.5) { ctx.fillStyle = SKIN[Math.floor(hash(n + 7) * 4)]; ctx.beginPath(); ctx.arc(px, py - k * 0.16, k * 0.3, 0, TAU); ctx.fill(); }
    };
    for (let x = xo; x <= xi; x += step) { put(x, yo); put(x, yi); }
    for (let y = yo + step; y < yi; y += step) { put(xo, y); put(xi, y); }
  }
  ctx.restore();
}

function drawGround(ctx, c, look) {
  const r = rectOf(c, ARENA.x0, ARENA.y0, ARENA.x1, ARENA.y1);
  // fence shadow + ground
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, r.x - c.s * 0.5, r.y - c.s * 0.2, r.w + c.s * 1.0, r.h + c.s * 1.0, c.s * 2.2); ctx.fill();
  const g = ctx.createRadialGradient(c.x(0, 21), c.y(0, 21), c.s * 4, c.x(0, 21), c.y(0, 21), c.s * 34);
  g.addColorStop(0, look.g0); g.addColorStop(1, look.g1);
  rrect(ctx, r.x, r.y, r.w, r.h, c.s * 1.8); ctx.fillStyle = g; ctx.fill();
  ctx.clip();
  // rake marks: long soft bands along the arena
  ctx.fillStyle = look.rake;
  for (let k = 0; k < 11; k++) {
    const x0 = ARENA.x0 + k * 3.7 + 0.4;
    const b = rectOf(c, x0, ARENA.y0, x0 + 1.2, ARENA.y1);
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  // speckle
  for (const p of SPECK) {
    ctx.globalAlpha = p.a; ctx.fillStyle = p.dark ? '#3a2410' : '#fff4d6';
    ctx.beginPath(); ctx.arc(c.x(p.x, p.y), c.y(p.x, p.y), Math.max(0.7, p.r * c.s), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // an edge of shade along the fence
  const e = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
  e.addColorStop(0, 'rgba(30,16,4,0.30)'); e.addColorStop(0.07, 'rgba(30,16,4,0)'); e.addColorStop(0.93, 'rgba(30,16,4,0)'); e.addColorStop(1, 'rgba(30,16,4,0.30)');
  ctx.fillStyle = e; ctx.fillRect(r.x, r.y, r.w, r.h);
  const e2 = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  e2.addColorStop(0, 'rgba(30,16,4,0.28)'); e2.addColorStop(0.05, 'rgba(30,16,4,0)'); e2.addColorStop(0.95, 'rgba(30,16,4,0)'); e2.addColorStop(1, 'rgba(30,16,4,0.28)');
  ctx.fillStyle = e2; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

function drawFence(ctx, c, look) {
  const r = rectOf(c, ARENA.x0, ARENA.y0, ARENA.x1, ARENA.y1);
  ctx.save();
  rrect(ctx, r.x, r.y, r.w, r.h, c.s * 1.8);
  ctx.lineWidth = Math.max(3, c.s * 0.55); ctx.strokeStyle = look.fence; ctx.stroke();
  ctx.lineWidth = Math.max(1.2, c.s * 0.14); ctx.strokeStyle = 'rgba(255,230,190,0.35)'; ctx.stroke();
  // posts
  ctx.fillStyle = 'rgba(40,22,8,0.9)';
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    for (const [x, y] of [[r.x + t * r.w, r.y], [r.x + t * r.w, r.y + r.h]]) { ctx.beginPath(); ctx.arc(x, y, Math.max(2, c.s * 0.33), 0, TAU); ctx.fill(); }
  }
  for (let i = 1; i < 20; i++) {
    const t = i / 20;
    for (const [x, y] of [[r.x, r.y + t * r.h], [r.x + r.w, r.y + t * r.h]]) { ctx.beginPath(); ctx.arc(x, y, Math.max(2, c.s * 0.33), 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

function drawLine(ctx, c, time) {
  // the timing line, a chequered strip across the arena with a post and pennant board at each end
  const a = rectOf(c, ARENA.x0 + 0.6, -0.3, ARENA.x1 - 0.6, 0.3);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(a.x, a.y, a.w, a.h);
  ctx.fillStyle = 'rgba(30,20,10,0.55)';
  const cells = 26;
  for (let i = 0; i < cells; i += 2) {
    if (c.land) { const ch = a.h / cells; ctx.fillRect(a.x, a.y + i * ch, a.w * 0.5, ch); ctx.fillRect(a.x + a.w * 0.5, a.y + (i + 1) * ch, a.w * 0.5, ch); }
    else { const cw = a.w / cells; ctx.fillRect(a.x + i * cw, a.y, cw, a.h * 0.5); ctx.fillRect(a.x + (i + 1) * cw, a.y + a.h * 0.5, cw, a.h * 0.5); }
  }
  ctx.restore();
}

// one barrel seen from above, with its shadow
function drawBarrel(ctx, c, b, style) {
  const px = c.x(b.x, b.y), py = c.y(b.x, b.y), r = BARREL_R * c.s * 1.25;
  ctx.save();
  ctx.translate(px, py);
  const lying = b.down;
  // shadow
  ctx.save(); ctx.translate(r * 0.45, r * 0.5); ctx.fillStyle = 'rgba(20,10,0,0.32)';
  ctx.beginPath(); ctx.ellipse(0, 0, r * (lying ? 1.25 : 1.05), r * 1.05, 0, 0, TAU); ctx.fill(); ctx.restore();
  if (lying) {
    ctx.rotate(b.rot);
    const g = ctx.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, '#ff9a3c'); g.addColorStop(0.5, '#e8741a'); g.addColorStop(1, '#a8480c');
    rrect(ctx, -r * 1.25, -r * 0.82, r * 2.5, r * 1.64, r * 0.5); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#4a2208'; ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,20,8,0.7)'; ctx.lineWidth = Math.max(1.2, r * 0.12);
    for (const k of [-0.5, 0.5]) { ctx.beginPath(); ctx.moveTo(r * k * 1.25, -r * 0.82); ctx.lineTo(r * k * 1.25, r * 0.82); ctx.stroke(); }
  } else {
    // body ring
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, '#ffb25a'); g.addColorStop(0.55, '#e8741a'); g.addColorStop(1, '#9a400a');
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.strokeStyle = '#3d1c06'; ctx.stroke();
    // lid
    ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, TAU); ctx.fillStyle = style === 'done' ? '#7fd69a' : '#ffd9a0'; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.09); ctx.strokeStyle = 'rgba(60,28,6,0.65)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.22, r * 0.22, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    // the rolling hoops of a steel drum, seen as two dark rings
    ctx.strokeStyle = 'rgba(50,22,6,0.55)'; ctx.lineWidth = Math.max(1, r * 0.07);
    for (const q of [0.8, 0.92]) { ctx.beginPath(); ctx.arc(0, 0, r * q, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
}

// turn guide around a barrel: a ring on the ground with an arrow showing the way round, and the part already turned (projected, so it lies
// flat in the 3D view too)
function ringPts(c, bx, by, R, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([c.x(bx + Math.sin(a) * R, by + Math.cos(a) * R), c.y(bx + Math.sin(a) * R, by + Math.cos(a) * R)]); }
  return out;
}
function strokePts(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
function drawTurnGuide(ctx, c, b, dir, wind, wa0, t, strong) {
  const R = 3.0, pulse = 0.5 + 0.5 * Math.sin(t * 5);
  const ls = Math.max(1, c.s);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(255,255,255,${(strong ? 0.34 : 0.22) + 0.1 * pulse})`; ctx.lineWidth = Math.max(2, ls * 0.12);
  strokePts(ctx, ringPts(c, b.x, b.y, R, 0, TAU, 48));
  const frac = Math.max(0, Math.min(1, wind / WIND_DONE));
  if (frac > 0.01) {
    ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.lineWidth = Math.max(3, ls * 0.34);
    strokePts(ctx, ringPts(c, b.x, b.y, R, wa0, wa0 + dir * frac * WIND_DONE, 32));
  }
  // arrow head at the point of the ring that is highest on the screen, pointing along the way round
  let best = 0, by = 1e9;
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, y = c.y(b.x + Math.sin(a) * R, b.y + Math.cos(a) * R); if (y < by) { by = y; best = a; } }
  const p = [c.x(b.x + Math.sin(best) * R, b.y + Math.cos(best) * R), by];
  const q0 = [c.x(b.x + Math.sin(best - 0.12) * R, b.y + Math.cos(best - 0.12) * R), c.y(b.x + Math.sin(best - 0.12) * R, b.y + Math.cos(best - 0.12) * R)];
  const q1 = [c.x(b.x + Math.sin(best + 0.12) * R, b.y + Math.cos(best + 0.12) * R), c.y(b.x + Math.sin(best + 0.12) * R, b.y + Math.cos(best + 0.12) * R)];
  let tx = (q1[0] - q0[0]) * dir, ty = (q1[1] - q0[1]) * dir; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  const L = ls * 1.0;
  ctx.fillStyle = `rgba(255,255,255,${0.78 + 0.2 * pulse})`;
  ctx.beginPath(); ctx.moveTo(p[0] + tx * L, p[1] + ty * L); ctx.lineTo(p[0] - tx * L * 0.45 - ty * L * 0.6, p[1] - ty * L * 0.45 + tx * L * 0.6); ctx.lineTo(p[0] - tx * L * 0.45 + ty * L * 0.6, p[1] - ty * L * 0.45 - tx * L * 0.6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawTrail(ctx, c, trail, upto) {
  if (!trail || trail.length < 4) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(70,40,16,0.22)'; ctx.lineWidth = Math.max(3, c.s * 1.0);
  ctx.beginPath();
  for (let i = 0; i < trail.length; i += 2) { const x = c.x(trail[i], trail[i + 1]), y = c.y(trail[i], trail[i + 1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,180,0.16)'; ctx.lineWidth = Math.max(1.5, c.s * 0.3); ctx.stroke();
  ctx.restore();
}

function drawDashed(ctx, c, pts, color, width, dash) {
  if (!pts || pts.length < 2) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(dash);
  poly(ctx, c, pts); ctx.stroke(); ctx.restore();
}

// ---- the horse and rider (seen from above; local units are metres, +y of the sprite is the tail) -----------------------------------
export function drawHorse(ctx, c, h) {
  const { x, y, th, stride = 0, yaw = 0, ghost = false, burst = false, scale = 1.7, sIn = 0, cheer = 0 } = h;
  const px = c.x(x, y), py = c.y(x, y), k = c.s * scale;
  const col = ghost ? { b0: '#8fb4d8', b1: '#4c7aa8', mane: '#2c4a6c', shirt: '#cfe6ff', hat: '#3a5878', pad: '#9ccfe8' }
    : { b0: '#c8743a', b1: '#7c3a14', mane: '#2a1208', shirt: '#f0c13a', hat: '#4a2a14', pad: '#1f8f86' };
  ctx.save();
  if (ghost) ctx.globalAlpha = 0.5;
  // shadow, light from the top left of the screen
  ctx.save(); ctx.translate(px + k * 0.35, py + k * 0.45); ctx.rotate(c.rot(th));
  ctx.fillStyle = 'rgba(20,10,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, k * 0.62, k * 1.4, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.translate(px, py); ctx.rotate(c.rot(th));
  const lean = Math.max(-1, Math.min(1, sIn)) * 0.12;
  const sw = Math.sin(stride * Math.PI);          // 0..1 gait cycle
  // legs: hooves swing fore and aft at the flanks
  ctx.fillStyle = '#2a160a';
  const leg = (sx, sy, ph) => { const oy = Math.sin(stride * Math.PI * 2 + ph) * 0.34; ctx.beginPath(); ctx.ellipse(sx * k, (sy + oy) * k, k * 0.1, k * 0.24, 0, 0, TAU); ctx.fill(); };
  leg(-0.44, -0.65, 0); leg(0.44, -0.65, Math.PI); leg(-0.44, 0.7, Math.PI); leg(0.44, 0.7, 0);
  // tail
  ctx.strokeStyle = col.mane; ctx.lineCap = 'round'; ctx.lineWidth = k * 0.2;
  const tailSw = -yaw * 0.22 + Math.sin(stride * Math.PI * 2) * 0.08;
  ctx.beginPath(); ctx.moveTo(0, k * 0.95); ctx.quadraticCurveTo(tailSw * k * 0.6, k * 1.45, tailSw * k * 1.4, k * 1.9); ctx.stroke();
  ctx.lineWidth = k * 0.1; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.stroke();
  // neck and head (the head turns a little into the bend)
  const hx = Math.max(-1, Math.min(1, yaw)) * 0.16;
  ctx.fillStyle = col.b1;
  ctx.beginPath(); ctx.moveTo(-0.34 * k, -0.75 * k); ctx.quadraticCurveTo(-0.26 * k + hx * k * 0.5, -1.35 * k, -0.17 * k + hx * k, -1.72 * k);
  ctx.lineTo(0.17 * k + hx * k, -1.72 * k); ctx.quadraticCurveTo(0.26 * k + hx * k * 0.5, -1.35 * k, 0.34 * k, -0.75 * k); ctx.closePath(); ctx.fill();
  const head = ctx.createLinearGradient(-0.2 * k, 0, 0.2 * k, 0); head.addColorStop(0, col.b0); head.addColorStop(1, col.b1);
  ctx.fillStyle = head; ctx.beginPath(); ctx.ellipse(hx * k * 1.05, -1.98 * k, 0.22 * k, 0.45 * k, hx * 0.8, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1208'; ctx.beginPath(); ctx.ellipse(hx * k * 1.2, -2.36 * k, 0.13 * k, 0.1 * k, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col.b1;   // ears
  for (const e of [-1, 1]) { ctx.beginPath(); ctx.moveTo((e * 0.1 + hx) * k, -1.7 * k); ctx.lineTo((e * 0.19 + hx) * k, -1.55 * k); ctx.lineTo((e * 0.04 + hx) * k, -1.58 * k); ctx.closePath(); ctx.fill(); }
  // mane along the neck
  ctx.strokeStyle = col.mane; ctx.lineWidth = k * 0.1; ctx.beginPath(); ctx.moveTo(0, -0.8 * k); ctx.quadraticCurveTo(hx * k * 0.5, -1.3 * k, hx * k, -1.72 * k); ctx.stroke();
  // body
  const body = ctx.createLinearGradient(-0.5 * k, 0, 0.5 * k, 0); body.addColorStop(0, col.b0); body.addColorStop(0.55, col.b0); body.addColorStop(1, col.b1);
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 0.64 * k, 1.1 * k, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.ellipse(-0.18 * k, -0.15 * k, 0.12 * k, 0.6 * k, 0, 0, TAU); ctx.fill();
  // saddle pad + saddle
  ctx.fillStyle = col.pad; rrect(ctx, -0.52 * k, -0.46 * k, 1.04 * k, 0.9 * k, 0.2 * k); ctx.fill();
  ctx.fillStyle = '#5a3418'; ctx.beginPath(); ctx.ellipse(0, -0.02 * k, 0.36 * k, 0.44 * k, 0, 0, TAU); ctx.fill();
  // rider
  const rx = (lean + hx * 0.3) * k;
  ctx.fillStyle = col.shirt; ctx.beginPath(); ctx.ellipse(rx, -0.12 * k, 0.4 * k, 0.24 * k, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = col.shirt; ctx.lineWidth = k * 0.13; ctx.lineCap = 'round';
  const arm = (s) => { ctx.beginPath(); ctx.moveTo(rx + s * 0.28 * k, -0.15 * k); ctx.lineTo(s * 0.17 * k + hx * k * 0.4, -0.62 * k); ctx.stroke(); };
  arm(-1); arm(1);
  ctx.strokeStyle = 'rgba(30,14,4,0.8)'; ctx.lineWidth = Math.max(1, k * 0.035);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.17 * k + hx * k * 0.4, -0.62 * k); ctx.lineTo(hx * k * 1.0, -1.9 * k); ctx.stroke(); }
  // head with a hat
  const hxr = rx * 1.2;
  ctx.fillStyle = '#e8b890'; ctx.beginPath(); ctx.arc(hxr, -0.24 * k, 0.15 * k, 0, TAU); ctx.fill();
  ctx.fillStyle = col.hat; ctx.beginPath(); ctx.ellipse(hxr, -0.25 * k, 0.33 * k, 0.28 * k, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(hxr - 0.04 * k, -0.28 * k, 0.12 * k, 0.1 * k, 0, 0, TAU); ctx.fill();
  if (burst && !ghost) {
    ctx.strokeStyle = 'rgba(255,240,170,0.8)'; ctx.lineWidth = k * 0.07;
    for (const s of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(s * k, 1.2 * k); ctx.lineTo(s * k, 2.1 * k + Math.abs(s) * 0.0); ctx.stroke(); }
  }
  ctx.restore();
}

// ---- the whole scene -------------------------------------------------------------------------------------------------------------------
// info: { run (state s or null), time, look, guide (0 guided, 1 marks, 2 off), ideal ([x,y,th,...] samples), mirror, ghost ({x,y,th}|null), plan (points|null),
//         previewSide, fade }
export function drawScene(ctx, c, info) {
  const look = LOOKS[Math.max(0, Math.min(LOOKS.length - 1, info.look | 0))];
  const s = info.run;
  const gl = !!c.gl;   // the 3D presenter draws the arena, the barrels, the horses and the dust; this canvas only adds the guides
  if (!gl) drawOutside(ctx, c, look);
  ctx.save();
  if (!gl && s && s.shake > 0) { const a = s.shake * 3; ctx.translate(Math.sin(info.time * 70) * a, Math.cos(info.time * 83) * a); }
  if (!gl) { drawGround(ctx, c, look); drawLine(ctx, c, info.time); }
  // the ideal line
  if (info.guide === 0 && info.ideal && info.ideal.length > 6) {
    const pts = [];
    for (let i = 0; i < info.ideal.length; i += 3) pts.push({ x: info.mirror ? -info.ideal[i] : info.ideal[i], y: info.ideal[i + 1] });
    drawDashed(ctx, c, pts, 'rgba(255,255,255,0.42)', Math.max(2, c.s * 0.2), [c.s * 0.9, c.s * 0.8]);
  }
  if (s) drawTrail(ctx, c, s.trail);
  if (info.plan) drawDashed(ctx, c, info.plan, 'rgba(255,214,90,0.95)', Math.max(3, c.s * 0.3), [c.s * 0.7, c.s * 0.5]);
  // barrels (below the rider)
  const bars = s ? s.barrels : info.barrels;
  const stage = s ? s.stage : 0;
  if (bars) {
    bars.forEach((b, i) => {
      const act = s ? (stage === 0 ? i < 2 : stage === 1 ? i === (s.first === 0 ? 1 : 0) : stage === 2 ? i === 2 : false) : false;
      if (s && info.guide < 2 && act && !b.down) drawTurnGuide(ctx, c, b, dirOf(i, s.first < 0 ? 0 : s.first), s.wind[i], s.wa0[i], info.time, true);
      if (s && s.done[i] && !b.down) { ctx.save(); ctx.strokeStyle = 'rgba(127,214,154,0.8)'; ctx.lineWidth = Math.max(2, c.s * 0.25); strokePts(ctx, ringPts(c, b.x, b.y, 2.2, 0, TAU, 40)); ctx.restore(); }
      if (!gl) drawBarrel(ctx, c, b, s && s.done[i] ? 'done' : 'plain');
    });
  }
  // dust
  if (s && !gl) {
    for (const p of s.particles) {
      const a = Math.max(0, p.life / p.max), r = (p.size + (1 - a) * 0.9) * c.s;
      ctx.fillStyle = `rgba(230,205,160,${0.45 * a})`; ctx.beginPath(); ctx.arc(c.x(p.x, p.y), c.y(p.x, p.y), r, 0, TAU); ctx.fill();
    }
  }
  if (!gl && info.ghost) drawHorse(ctx, c, { ...info.ghost, ghost: true });
  if (!gl && s) drawHorse(ctx, c, { x: s.x, y: s.y, th: s.th, stride: s.stride, yaw: s.yaw / 2.5, sIn: s.sAct, burst: s.burstT > 0 });
  ctx.restore();
  if (gl) {
    // the guides are drawn on a canvas in front of the 3D picture: cut a soft hole around the rider so the horse and rider are never struck through
    if (s && s.phase !== undefined && !s.finished) {
      const px = c.x(s.x, s.y, 0.6), py = c.y(s.x, s.y, 0.6), r = Math.max(40, 3.4 * c.s);
      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      const g = ctx.createRadialGradient(px, py, r * 0.35, px, py, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(px - r, py - r, 2 * r, 2 * r); ctx.restore();
    }
    return { cam: c };
  }
  drawFence(ctx, c, look);
  // lighting: a tint for the time of day, floodlight pools at night
  if (look.tint) { ctx.fillStyle = look.tint; ctx.fillRect(0, 0, c.W, c.H); }
  if (look.night > 0.5) {
    for (const [fx, fy] of [[-16, 2], [16, 2], [-16, 38], [16, 38]]) {
      const g = ctx.createRadialGradient(c.x(fx, fy), c.y(fx, fy), 0, c.x(fx, fy), c.y(fx, fy), c.s * 22);
      g.addColorStop(0, 'rgba(255,248,215,0.26)'); g.addColorStop(1, 'rgba(255,248,215,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, c.W, c.H);
    }
  }
  return { cam: c };
}
