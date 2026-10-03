// The Kubb lawn seen from one fixed camera, in TRUE perspective (a pinhole camera standing behind the near baseline and looking down the pitch).
// The camera never moves, zooms, tilts or shakes: the grass, the lines and the stakes are the same pixels in every frame (they are baked once into
// one image); only the blocks, the batons, the thrower's paddle, the dust and the overlays move. Everything is drawn from the world in metres:
// x across the pitch, y along it, z up. Pure drawing, no clock, no randomness (seeded LCGs only).
import { FIELD, KUBB, KING, BATON, matOf, nlerp } from './phys.js';

export const TAU = Math.PI * 2;
const PITCH = (50 * Math.PI) / 180, CH = 8, CB = 3.5, YN = 1050, YF = 296;
const sinP = Math.sin(PITCH), cosP = Math.cos(PITCH);
export const CAMPOS = [0, -CB, CH];
function rawProj(x, y, z) {
  const ry = y + CB, d = ry * cosP + (CH - z) * sinP, up = ry * sinP - (CH - z) * cosP;
  return { x, up, d };
}
const n0 = rawProj(0, 0, 0), f0 = rawProj(0, FIELD.L, 0);
export const FOCAL = (YN - YF) / (-n0.up / n0.d + f0.up / f0.d);
const YC = YN + FOCAL * (n0.up / n0.d);
// World point -> screen. s = pixels per metre at that depth. d = distance along the view axis (for sorting).
export function proj(x, y, z) {
  const r = rawProj(x, y, z), k = FOCAL / r.d;
  return { x: 360 + x * k, y: YC - r.up * k, s: k, d: r.d };
}
// Screen point -> the ground (z = 0): used by the touch controls.
export function unproj(sx, sy) {
  // invert: sy = YC - FOCAL*up/d ; with z=0: up = ry*sinP - CH*cosP, d = ry*cosP + CH*sinP
  const v = (YC - sy) / FOCAL;                     // up/d
  const ry = (CH * (sinP * 0 + cosP) + v * CH * sinP) / (sinP - v * cosP);
  const d = ry * cosP + CH * sinP, k = FOCAL / d;
  return { x: (sx - 360) / k, y: ry - CB };
}
export const groundScale = (y) => proj(0, y, 0).s;

// ---- palette -----------------------------------------------------------------------------------------------------------------
export const TEAM = [
  { name: 'Blue', main: '#2f7fd6', dark: '#1a4a8c', hi: '#9cccff', glow: 'rgba(110,180,255,0.9)' },
  { name: 'Orange', main: '#ef7a22', dark: '#a8480a', hi: '#ffc88f', glow: 'rgba(255,170,90,0.9)' },
];
const WOOD = [226, 188, 122], WOOD_DARK = [150, 104, 56], KINGWOOD = [204, 150, 92];
const mix = (c, k) => `rgb(${Math.min(255, Math.round(c[0] * k))},${Math.min(255, Math.round(c[1] * k))},${Math.min(255, Math.round(c[2] * k))})`;
const LIGHT = (() => { const l = [-0.45, -0.5, 0.74], n = Math.hypot(...l); return l.map((v) => v / n); })();   // towards the sun: left, near, high
export const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

// ---- off-screen surface (the host canvas is used when OffscreenCanvas is missing) -----------------------------------------------
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
export const canBake = () => typeof OffscreenCanvas !== 'undefined' || hostDoc !== null;
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
}

// ---- the backdrop: grass, mowing stripes, the pitch, chalk lines, stakes, fence, forest, cottage ----------------------------------
const BS = 1.5;                     // bake scale (1.5x: 8 MB of canvas instead of 15 MB, still about one pixel per screen pixel on a phone)
const GX = 9;                       // the lawn is drawn out to +-GX metres
function quadPath(c, a, b, d, e) { const p = [proj(...a), proj(...b), proj(...d), proj(...e)]; c.beginPath(); p.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); }

function paintGround(c) {
  // beyond the screen edges and far up: one big lawn
  quadPath(c, [-GX, -6, 0], [GX, -6, 0], [GX, 22, 0], [-GX, 22, 0]);
  let g = c.createLinearGradient(0, 0, 0, 1280);
  g.addColorStop(0, '#3f7e45'); g.addColorStop(0.5, '#4a9a4e'); g.addColorStop(1, '#43904a');
  c.fillStyle = g; c.fill();
  // mowing stripes across the lawn (every 0.8 m), softly alternating
  for (let k = -8; k < 28; k++) {
    const y0 = -6 + k * 0.8;
    if (k % 2) continue;
    quadPath(c, [-GX, y0, 0], [GX, y0, 0], [GX, y0 + 0.8, 0], [-GX, y0 + 0.8, 0]);
    c.fillStyle = 'rgba(255,255,210,0.055)'; c.fill();
  }
  // the pitch itself is cut finer: lighter, with its own stripes
  const hw = FIELD.W / 2 + 0.55, y0 = -0.55, y1 = FIELD.L + 0.55;
  quadPath(c, [-hw, y0, 0], [hw, y0, 0], [hw, y1, 0], [-hw, y1, 0]);
  c.fillStyle = 'rgba(190,235,120,0.17)'; c.fill();
  for (let k = 0; k < 9; k++) {
    const a = y0 + (k * (y1 - y0)) / 9, b = y0 + ((k + 1) * (y1 - y0)) / 9;
    if (k % 2) continue;
    quadPath(c, [-hw, a, 0], [hw, a, 0], [hw, b, 0], [-hw, b, 0]);
    c.fillStyle = 'rgba(30,90,30,0.13)'; c.fill();
  }
}
function paintBlades(c, seed, n) {
  const r = lcg(seed);
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 2 * GX, y = -5.5 + r() * 26.5, p = proj(x, y, 0);
    if (p.y < -20 || p.y > 1300 || p.x < -10 || p.x > 730) continue;
    const len = (0.05 + r() * 0.08) * p.s * 0.8, a = (r() - 0.5) * 0.7, t = r();
    c.strokeStyle = t < 0.45 ? `rgba(20,70,25,${0.1 + r() * 0.16})` : t < 0.8 ? `rgba(150,215,95,${0.08 + r() * 0.15})` : `rgba(235,235,150,${0.05 + r() * 0.08})`;
    c.lineWidth = Math.max(0.5, p.s * 0.006 + r() * 0.5);
    c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.sin(a) * len, p.y - Math.cos(a) * len * 0.8); c.stroke();
  }
}
function paintFlowers(c) {
  const r = lcg(4242);
  for (let i = 0; i < 90; i++) {
    const side = r() < 0.5 ? -1 : 1, x = side * (FIELD.W / 2 + 0.7 + r() * 5), y = -3 + r() * 16, p = proj(x, y, 0);
    const col = ['#fff7c2', '#ffffff', '#ffd23f', '#f6a6c1'][Math.floor(r() * 4)], rad = Math.max(1.2, p.s * (0.018 + r() * 0.014));
    c.fillStyle = col; c.globalAlpha = 0.85; c.beginPath(); c.arc(p.x, p.y, rad, 0, TAU); c.fill();
    c.fillStyle = '#e8a010'; c.globalAlpha = 0.9; c.beginPath(); c.arc(p.x, p.y, rad * 0.35, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
}
function chalk(c, ax, ay, bx, by, wm, col = 'rgba(255,255,248,0.92)', dash = null) {
  const a = proj(ax, ay, 0), b = proj(bx, by, 0);
  const wa = wm * a.s, wb = wm * b.s;
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  c.fillStyle = col;
  if (dash) {
    const n = Math.round(l / dash);
    for (let i = 0; i < n; i += 2) {
      const t0 = i / n, t1 = Math.min(1, (i + 1) / n);
      const w0 = wa + (wb - wa) * t0, w1 = wa + (wb - wa) * t1;
      c.beginPath(); c.moveTo(a.x + dx * t0 + nx * w0 / 2, a.y + dy * t0 + ny * w0 / 2); c.lineTo(a.x + dx * t1 + nx * w1 / 2, a.y + dy * t1 + ny * w1 / 2);
      c.lineTo(a.x + dx * t1 - nx * w1 / 2, a.y + dy * t1 - ny * w1 / 2); c.lineTo(a.x + dx * t0 - nx * w0 / 2, a.y + dy * t0 - ny * w0 / 2); c.closePath(); c.fill();
    }
    return;
  }
  c.beginPath(); c.moveTo(a.x + nx * wa / 2, a.y + ny * wa / 2); c.lineTo(b.x + nx * wb / 2, b.y + ny * wb / 2); c.lineTo(b.x - nx * wb / 2, b.y - ny * wb / 2); c.lineTo(a.x - nx * wa / 2, a.y - ny * wa / 2); c.closePath(); c.fill();
}
function stake(c, x, y, red) {
  const p = proj(x, y, 0), q = proj(x, y, 0.5);
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(p.x + 5, p.y + 1, p.s * 0.06, p.s * 0.025, 0, 0, TAU); c.fill();
  const w = Math.max(3, p.s * 0.045);
  c.fillStyle = '#f4ede0'; c.fillRect(p.x - w / 2, q.y, w, p.y - q.y);
  c.fillStyle = red ? '#d83a30' : '#2f7fd6'; c.fillRect(p.x - w / 2, q.y, w, (p.y - q.y) * 0.33); c.fillRect(p.x - w / 2, q.y + (p.y - q.y) * 0.66, w, (p.y - q.y) * 0.34);
  c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(p.x + w * 0.1, q.y, w * 0.4, p.y - q.y);
}
function paintMarkings(c) {
  const hw = FIELD.W / 2, L = FIELD.L, lw = 0.045;
  chalk(c, -hw, 0, hw, 0, lw); chalk(c, -hw, L, hw, L, lw);
  chalk(c, -hw, 0, -hw, L, lw); chalk(c, hw, 0, hw, L, lw);
  chalk(c, -hw, FIELD.MID, hw, FIELD.MID, 0.03, 'rgba(255,255,248,0.4)', 14);
  for (const [x, y] of [[-hw, 0], [hw, 0], [-hw, L], [hw, L]]) stake(c, x, y, true);
  stake(c, -hw, FIELD.MID, false); stake(c, hw, FIELD.MID, false);
  // a faint ring on the grass under the king and the spots where the baseline kubbs stand
  const k = proj(0, FIELD.MID, 0);
  c.strokeStyle = 'rgba(255,255,250,0.28)'; c.lineWidth = 1.5; c.beginPath();
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU, q = proj(Math.cos(a) * 0.54, FIELD.MID + Math.sin(a) * 0.54, 0); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); }
  c.stroke(); void k;
}
function tree(c, x, y, h, kind, r) {
  const p = proj(x, y, 0), sc = p.s * 0.64;        // an upright thing seen from above: its height is foreshortened
  c.fillStyle = 'rgba(10,30,10,0.28)'; c.beginPath(); c.ellipse(p.x + h * sc * 0.25, p.y, h * sc * 0.28, h * sc * 0.07, 0, 0, TAU); c.fill();
  if (kind === 'pine') {
    const w = h * sc * 0.22;
    c.fillStyle = '#4a3220'; c.fillRect(p.x - w * 0.12, p.y - h * sc * 0.18, w * 0.24, h * sc * 0.18);
    for (let i = 0; i < 4; i++) {
      const t = i / 4, yb = p.y - h * sc * (0.12 + t * 0.58), yt = yb - h * sc * 0.4, wd = w * (1.12 - t * 0.55);
      const g = c.createLinearGradient(p.x - wd, 0, p.x + wd, 0);
      g.addColorStop(0, '#1f5a35'); g.addColorStop(0.5, `rgb(${40 + Math.round(r() * 14)},${108 + Math.round(r() * 20)},${64})`); g.addColorStop(1, '#16452a');
      c.fillStyle = g; c.beginPath(); c.moveTo(p.x, yt); c.lineTo(p.x + wd, yb); c.lineTo(p.x - wd, yb); c.closePath(); c.fill();
    }
  } else {
    const w = h * sc * 0.07;
    c.fillStyle = '#efe9dc'; c.fillRect(p.x - w / 2, p.y - h * sc * 0.55, w, h * sc * 0.55);
    c.fillStyle = '#3a3a34';
    for (let i = 0; i < 5; i++) c.fillRect(p.x - w / 2, p.y - h * sc * (0.1 + i * 0.1), w, Math.max(1, w * 0.15));
    for (let i = 0; i < 6; i++) {
      const a = r() * TAU, d = r() * h * sc * 0.22, rad = h * sc * (0.12 + r() * 0.07);
      c.fillStyle = `rgba(${108 + Math.round(r() * 40)},${170 + Math.round(r() * 30)},${72},0.95)`;
      c.beginPath(); c.arc(p.x + Math.cos(a) * d, p.y - h * sc * 0.72 + Math.sin(a) * d * 0.7, rad, 0, TAU); c.fill();
    }
  }
}
function cottage(c, x, y) {
  const p = proj(x, y, 0), s = p.s * 0.7, w = 3.0 * s, h = 1.5 * s;
  c.fillStyle = 'rgba(10,30,10,0.3)'; c.beginPath(); c.ellipse(p.x + w * 0.2, p.y + 2, w * 0.58, h * 0.14, 0, 0, TAU); c.fill();
  c.fillStyle = '#b8352c'; c.fillRect(p.x - w / 2, p.y - h, w, h);                           // red timber wall
  c.fillStyle = '#9a2a22'; for (let i = 1; i < 12; i++) c.fillRect(p.x - w / 2 + (w * i) / 12, p.y - h, 1.2, h);
  c.fillStyle = '#f4ede0'; c.fillRect(p.x - w / 2, p.y - h, w * 0.04, h); c.fillRect(p.x + w / 2 - w * 0.04, p.y - h, w * 0.04, h);   // white corner boards
  c.fillStyle = '#3d3a40'; c.beginPath(); c.moveTo(p.x - w * 0.56, p.y - h); c.lineTo(p.x, p.y - h * 1.75); c.lineTo(p.x + w * 0.56, p.y - h); c.closePath(); c.fill();   // roof
  c.fillStyle = '#524e56'; c.beginPath(); c.moveTo(p.x, p.y - h * 1.75); c.lineTo(p.x + w * 0.56, p.y - h); c.lineTo(p.x + w * 0.2, p.y - h); c.closePath(); c.fill();
  c.fillStyle = '#f4ede0'; c.fillRect(p.x - w * 0.34, p.y - h * 0.78, w * 0.2, h * 0.34); c.fillRect(p.x + w * 0.14, p.y - h * 0.78, w * 0.2, h * 0.34);
  c.fillStyle = '#7fb4d8'; c.fillRect(p.x - w * 0.31, p.y - h * 0.74, w * 0.14, h * 0.26); c.fillRect(p.x + w * 0.17, p.y - h * 0.74, w * 0.14, h * 0.26);
  c.fillStyle = '#6a2018'; c.fillRect(p.x - w * 0.06, p.y - h * 0.6, w * 0.12, h * 0.6);
}
function fence(c, y) {
  c.lineCap = 'butt';
  for (let x = -GX; x <= GX; x += 0.9) {
    const a = proj(x, y, 0), b = proj(x, y, 0.8);
    c.strokeStyle = '#8b6a44'; c.lineWidth = Math.max(2, a.s * 0.05); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  }
  for (const z of [0.3, 0.62]) {
    const a = proj(-GX, y, z), b = proj(GX, y, z);
    c.strokeStyle = '#a07c52'; c.lineWidth = Math.max(2, a.s * 0.04); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  }
}
function paintScenery(c) {
  const r = lcg(31337);
  fence(c, 9.2);
  const items = [];
  for (let i = 0; i < 46; i++) items.push({ x: (r() - 0.5) * 2 * 9, y: 10 + r() * 7, h: 2.2 + r() * 3.2, kind: r() < 0.72 ? 'pine' : 'birch' });
  items.sort((a, b) => b.y - a.y);
  cottage(c, -4.6, 10.4);
  for (const t of items) if (Math.abs(t.x + 4.6) > 2.2 || t.y > 11.4) tree(c, t.x, t.y, t.h, t.kind, r);
  // low shrubs along the near fence
  for (let i = 0; i < 18; i++) {
    const x = (r() - 0.5) * 18, p = proj(x, 9.0 + r() * 0.5, 0), rad = p.s * (0.18 + r() * 0.2);
    c.fillStyle = `rgba(${40 + Math.round(r() * 30)},${105 + Math.round(r() * 40)},${50},0.95)`; c.beginPath(); c.ellipse(p.x, p.y - rad * 0.4, rad * 1.2, rad * 0.8, 0, 0, TAU); c.fill();
  }
}
function paintFinish(c) {
  // atmosphere: the far end fades into a warm haze; a soft vignette pulls the eye to the pitch
  let g = c.createLinearGradient(0, 0, 0, 420);
  g.addColorStop(0, 'rgba(228,214,170,0.36)'); g.addColorStop(1, 'rgba(228,214,170,0)');
  c.fillStyle = g; c.fillRect(0, 0, 720, 420);
  g = c.createRadialGradient(360, 640, 380, 360, 640, 900);
  g.addColorStop(0, 'rgba(0,20,0,0)'); g.addColorStop(1, 'rgba(0,18,8,0.42)');
  c.fillStyle = g; c.fillRect(0, 0, 720, 1280);
}
const STAGES = [
  (c) => paintGround(c), (c) => paintBlades(c, 11, 3500), (c) => paintBlades(c, 12, 3500), (c) => paintBlades(c, 13, 3500), (c) => paintBlades(c, 14, 3500), (c) => paintBlades(c, 15, 3500), (c) => paintBlades(c, 16, 3500), (c) => paintFlowers(c),
  (c) => paintMarkings(c), (c) => paintScenery(c), (c) => paintFinish(c),
];
const LAST = STAGES.length - 1, MARK = STAGES.length - 3;
// The backdrop is baked in slices (one stage per call) so tapping Play never waits for it; the fallback draws the same layout with flat colours.
export function startBake() {
  let cv = null, c = null;
  try { cv = makeCanvas(720 * BS, 1280 * BS); c = cv && cv.getContext('2d'); } catch { cv = null; c = null; }
  if (!cv || !c) return { failed: true, step: () => null, done: false };
  c.scale(BS, BS);
  let i = 0;
  const job = {
    failed: false, canvas: cv, get done() { return i >= STAGES.length; }, get progress() { return i / STAGES.length; },
    step(all) {
      try { do { c.save(); STAGES[i](c); c.restore(); i++; } while (all && i < STAGES.length); } catch { job.failed = true; return null; }   // never let the art stop the game: the flat lawn is the fallback
      return i >= STAGES.length ? cv : null;
    },
  };
  return job;
}
export function drawBackdrop(ctx, baked) {
  if (baked) { ctx.drawImage(baked, 0, 0, 720, 1280); return; }
  // flat fallback: same layout, no texture
  ctx.fillStyle = '#47914b'; ctx.fillRect(0, 0, 720, 1280);
  STAGES[0](ctx); STAGES[MARK](ctx); STAGES[LAST](ctx);
}

// ---- projected shapes --------------------------------------------------------------------------------------------------------------
export function groundRing(ctx, x, y, r, n = 36) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, p = proj(x + Math.cos(a) * r, y + Math.sin(a) * r, 0); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
}
export function groundEllipse(ctx, x, y, rx, ry, n = 36) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, p = proj(x + Math.cos(a) * rx, y + Math.sin(a) * ry, 0); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
}
export function drawLine(ctx, y, col, dashed = true, label = '', k = 1) {
  const a = proj(-FIELD.W / 2 - 0.1, y, 0), b = proj(FIELD.W / 2 + 0.1, y, 0);
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash(dashed ? [10, 8] : []); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
  if (label) {
    ctx.save(); ctx.font = `800 ${Math.round(18 * k)}px 'Avenir Next', 'Trebuchet MS', Arial, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width + 20 * k;
    roundPath(ctx, a.x + 8, a.y - 32 * k, tw, 26 * k, 13 * k); ctx.fillStyle = 'rgba(10,24,12,0.82)'; ctx.fill();
    ctx.fillStyle = '#ffe48a'; ctx.fillText(label, a.x + 8 + 10 * k, a.y - 19 * k); ctx.restore();
  }
}

// ---- blocks --------------------------------------------------------------------------------------------------------------------------
// One interpolated pose for drawing: position and quaternion between the previous and the current physics tick.
export function poseOf(b, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  return { p: [b.pp[0] + (b.p[0] - b.pp[0]) * a, b.pp[1] + (b.p[1] - b.pp[1]) * a, b.pp[2] + (b.p[2] - b.pp[2]) * a], q: nlerp(b.pq, b.q, a) };
}
const FACES = [
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], cap: true },
  { n: [0, 0, -1], v: [[-1, 1, -1], [1, 1, -1], [1, -1, -1], [-1, -1, -1]], cap: true },
  { n: [1, 0, 0], v: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { n: [-1, 0, 0], v: [[-1, 1, -1], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1]] },
  { n: [0, 1, 0], v: [[1, 1, -1], [-1, 1, -1], [-1, 1, 1], [1, 1, 1]] },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
];
const lerp2 = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
// A box with its centre at p, orientation q, size (w, w, h). o: { team, king, glow }
export function drawBox(ctx, p, q, w, h, o = {}) {
  const R = matOf(q), hw = w / 2, hh = h / 2;
  const P = (sx, sy, sz) => {
    const lx = sx * hw, ly = sy * hw, lz = sz * hh;
    return proj(p[0] + R[0] * lx + R[1] * ly + R[2] * lz, p[1] + R[3] * lx + R[4] * ly + R[5] * lz, p[2] + R[6] * lx + R[7] * ly + R[8] * lz);
  };
  const T = o.team >= 0 && o.team != null ? TEAM[o.team] : null, base = o.king ? KINGWOOD : WOOD;
  const faces = [];
  for (const f of FACES) {
    const nx = R[0] * f.n[0] + R[1] * f.n[1] + R[2] * f.n[2], ny = R[3] * f.n[0] + R[4] * f.n[1] + R[5] * f.n[2], nz = R[6] * f.n[0] + R[7] * f.n[1] + R[8] * f.n[2];
    const cxw = p[0] + nx * (f.n[0] ? hw : f.n[1] ? hw : hh), cyw = p[1] + ny * (f.n[0] ? hw : f.n[1] ? hw : hh), czw = p[2] + nz * (f.n[0] ? hw : f.n[1] ? hw : hh);
    if (nx * (CAMPOS[0] - cxw) + ny * (CAMPOS[1] - cyw) + nz * (CAMPOS[2] - czw) <= 0) continue;
    const pts = f.v.map((v) => P(v[0], v[1], v[2]));
    const lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
    faces.push({ f, pts, lit, d: (pts[0].d + pts[1].d + pts[2].d + pts[3].d) / 4 });
  }
  ctx.save();
  ctx.lineJoin = 'round';
  for (const fc of faces) {
    const k = 0.62 + 0.42 * Math.max(0, fc.lit) + (fc.lit < 0 ? 0.04 : 0);
    const pts = fc.pts;
    ctx.beginPath(); pts.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.closePath();
    if (fc.f.cap && T) ctx.fillStyle = mix([parseInt(T.main.slice(1, 3), 16), parseInt(T.main.slice(3, 5), 16), parseInt(T.main.slice(5, 7), 16)], k * 0.92);
    else if (!fc.f.cap) {   // wood darkens towards the ground: a soft vertical gradient on the sides
      const tm = lerp2(pts[3], pts[2], 0.5), bm = lerp2(pts[0], pts[1], 0.5), g = ctx.createLinearGradient(tm.x, tm.y, bm.x, bm.y);
      g.addColorStop(0, mix(base, k * 1.07)); g.addColorStop(1, mix(base, k * 0.8));
      ctx.fillStyle = g;
    } else ctx.fillStyle = mix(base, k);
    ctx.fill();
    // pale end grain / wood grain
    if (!fc.f.cap) {
      ctx.strokeStyle = `rgba(${WOOD_DARK[0]},${WOOD_DARK[1]},${WOOD_DARK[2]},0.28)`; ctx.lineWidth = 0.8;
      for (const t of [0.14, 0.31, 0.52, 0.73, 0.88]) { const a = lerp2(pts[0], pts[1], t), b = lerp2(pts[3], pts[2], t); ctx.globalAlpha = t === 0.52 ? 0.6 : 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (T) {   // a painted band near the top end
        const a0 = lerp2(pts[3], pts[0], 0.2), a1 = lerp2(pts[2], pts[1], 0.2);
        ctx.beginPath(); ctx.moveTo(pts[3].x, pts[3].y); ctx.lineTo(pts[2].x, pts[2].y); ctx.lineTo(a1.x, a1.y); ctx.lineTo(a0.x, a0.y); ctx.closePath();
        ctx.fillStyle = mix([parseInt(T.main.slice(1, 3), 16), parseInt(T.main.slice(3, 5), 16), parseInt(T.main.slice(5, 7), 16)], k * 0.95); ctx.fill();
      } else if (o.king) {   // a gold ring on the king
        const a0 = lerp2(pts[3], pts[0], 0.22), a1 = lerp2(pts[2], pts[1], 0.22), b0 = lerp2(pts[3], pts[0], 0.34), b1 = lerp2(pts[2], pts[1], 0.34);
        ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(b0.x, b0.y); ctx.closePath(); ctx.fillStyle = mix([226, 178, 60], k); ctx.fill();
      }
    } else if (o.king) {
      // the crown on the king's end: a gold plate with five points, drawn on the face with an affine map of its corners
      const [a, b, c, d] = pts, ux = (b.x - a.x) / 2, uy = (b.y - a.y) / 2, vx = (d.x - a.x) / 2, vy = (d.y - a.y) / 2, ox = a.x + ux + vx, oy = a.y + uy + vy;
      ctx.fillStyle = mix([232, 184, 62], k); ctx.beginPath();
      const crown = [[-0.7, 0.55], [-0.7, -0.5], [-0.35, -0.05], [0, -0.7], [0.35, -0.05], [0.7, -0.5], [0.7, 0.55]];
      crown.forEach(([cx, cy], i) => { const X = ox + ux * cx + vx * cy, Y = oy + uy * cx + vy * cy; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(110,70,10,0.7)'; ctx.lineWidth = 1; ctx.stroke();
      void c;
    }
    ctx.beginPath(); pts.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.closePath();
    ctx.strokeStyle = 'rgba(60,34,12,0.55)'; ctx.lineWidth = 1.1; ctx.stroke();
  }
  if (o.glow) {   // ring on the grass
    ctx.restore(); return;
  }
  ctx.restore();
}
// The shadow of a box on the grass: the hull of its corners pushed along the sun's direction.
const SHX = 0.42, SHY = 0.62;
function hull(pts) {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y), cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
export function drawBoxShadow(ctx, p, q, w, h) {
  const R = matOf(q), hw = w / 2, hh = h / 2, pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = sx * hw, ly = sy * hw, lz = sz * hh;
    const x = p[0] + R[0] * lx + R[1] * ly + R[2] * lz, y = p[1] + R[3] * lx + R[4] * ly + R[5] * lz, z = Math.max(0, p[2] + R[6] * lx + R[7] * ly + R[8] * lz);
    pts.push(proj(x + SHX * z, y + SHY * z, 0));
  }
  const hl = hull(pts), lift = Math.max(0, p[2] - hh);
  ctx.save();
  ctx.globalAlpha = Math.max(0.12, 0.38 - lift * 0.18);
  ctx.fillStyle = '#0c2a10'; ctx.strokeStyle = '#0c2a10'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
  ctx.beginPath(); hl.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.closePath(); ctx.fill(); ctx.globalAlpha *= 0.5; ctx.stroke();
  ctx.restore();
}

// ---- batons --------------------------------------------------------------------------------------------------------------------------
export function drawBaton(ctx, p, q, o = {}) {
  const R = matOf(q), ax = R[0], ay = R[3], az = R[6], half = BATON.len / 2;
  const a = proj(p[0] - ax * half, p[1] - ay * half, p[2] - az * half), b = proj(p[0] + ax * half, p[1] + ay * half, p[2] + az * half);
  const wpx = Math.max(5, BATON.r * 2 * ((a.s + b.s) / 2));
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  const T = o.team >= 0 && o.team != null ? TEAM[o.team] : TEAM[0];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#4a2c12'; ctx.lineWidth = wpx + 2.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = '#d9a85c'; ctx.lineWidth = wpx; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  // lit side
  const off = wpx * 0.2 * (nx * LIGHT[0] * -1 + ny * 0.2 > 0 ? 1 : -1);
  ctx.strokeStyle = '#f3d594'; ctx.lineWidth = wpx * 0.38; ctx.beginPath(); ctx.moveTo(a.x + nx * off, a.y + ny * off); ctx.lineTo(b.x + nx * off, b.y + ny * off); ctx.stroke();
  // team-coloured bands: they show the spin
  ctx.lineCap = 'butt'; ctx.strokeStyle = T.main; ctx.lineWidth = wpx * 0.98;
  for (const [t0, t1] of [[0.1, 0.19], [0.81, 0.9]]) { ctx.beginPath(); ctx.moveTo(a.x + dx * t0, a.y + dy * t0); ctx.lineTo(a.x + dx * t1, a.y + dy * t1); ctx.stroke(); }
  ctx.strokeStyle = '#fff7e4'; ctx.lineWidth = wpx * 0.98; ctx.beginPath(); ctx.moveTo(a.x + dx * 0.47, a.y + dy * 0.47); ctx.lineTo(a.x + dx * 0.53, a.y + dy * 0.53); ctx.stroke();
  ctx.restore();
}
export function drawBatonShadow(ctx, p, q) {
  const R = matOf(q), half = BATON.len / 2, pts = [];
  for (const s of [-1, 1]) { const x = p[0] + R[0] * half * s, y = p[1] + R[3] * half * s, z = Math.max(0, p[2] + R[6] * half * s); pts.push(proj(x + SHX * z, y + SHY * z, 0)); }
  const lift = Math.max(0, p[2] - 0.04);
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#0c2a10'; ctx.globalAlpha = Math.max(0.1, 0.34 - lift * 0.14);
  ctx.lineWidth = Math.max(4, BATON.r * 2 * pts[0].s * 1.1); ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke(); ctx.restore();
}

function roundPath(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// ---- the thrower's marker: a team-coloured stand disc with a baton standing in a small wooden holder, no person -------------------------------------
// lean: -1..1 (pulled back .. swung forward), team, held (a baton waits in the holder). dir: +1 faces up the screen.
export function drawPaddle(ctx, x, y, dir, team, lean, held = true, scale = 1) {
  const T = TEAM[team], base = proj(x, y, 0), s = base.s * scale;
  ctx.save();
  ctx.fillStyle = 'rgba(8,30,10,0.3)'; ctx.beginPath(); ctx.ellipse(base.x + s * 0.07, base.y + s * 0.03, s * 0.24, s * 0.085, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(base.x, base.y, s * 0.21, s * 0.078, 0, 0, TAU); ctx.fillStyle = T.main; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.hi; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(base.x, base.y, s * 0.13, s * 0.048, 0, 0, TAU); ctx.fillStyle = T.dark; ctx.fill();
  if (held) {   // the baton stands in its holder, leaning a little along the throw
    const len = BATON.len * s * 0.82, w = Math.max(9, BATON.r * 2 * s * 1.1);
    ctx.translate(base.x, base.y - 2); ctx.rotate(lean * 0.4 + 0.08);
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, '#b4793a'); g.addColorStop(0.4, '#f6d894'); g.addColorStop(1, '#a56f30');
    roundPath(ctx, -w / 2, -len, w, len, w * 0.45); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#5a3516'; ctx.stroke();
    ctx.fillStyle = T.main; ctx.fillRect(-w / 2 + 1, -len * 0.82, w - 2, len * 0.11);
    ctx.rotate(-(lean * 0.4 + 0.08));
    // the holder: a short wooden ring around the foot of the baton
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.95, w * 0.36, 0, 0, TAU); ctx.lineWidth = Math.max(3, w * 0.32); ctx.strokeStyle = '#7a4c22'; ctx.stroke();
    ctx.lineWidth = Math.max(1.5, w * 0.1); ctx.strokeStyle = '#d9a85c'; ctx.stroke();
  } else {
    const w = Math.max(9, BATON.r * 2 * s * 1.1);
    ctx.translate(base.x, base.y - 2);
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.95, w * 0.36, 0, 0, TAU); ctx.lineWidth = Math.max(3, w * 0.32); ctx.strokeStyle = '#7a4c22'; ctx.stroke();
    ctx.lineWidth = Math.max(1.5, w * 0.1); ctx.strokeStyle = '#d9a85c'; ctx.stroke();
  }
  void dir;
  ctx.restore();
}

// Two butterflies drifting over the grass beside the pitch: life in the picture, never over the playing area.
export function drawButterflies(ctx, t) {
  for (let i = 0; i < 2; i++) {
    const ph = t * (0.22 + 0.05 * i) + i * 3.1, side = i ? 1 : -1;
    const x = side * (2.6 + 0.7 * Math.sin(ph * 1.3)), y = 1.8 + i * 2.6 + 1.2 * Math.sin(ph), z = 0.9 + 0.35 * Math.sin(ph * 2.3 + i);
    const p = proj(x, y, z), flap = Math.abs(Math.sin(t * 11 + i * 2)), w = p.s * 0.07, h = p.s * 0.05 * (0.25 + 0.75 * flap);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(ph * 3) * 0.4);
    ctx.fillStyle = i ? '#ffe27a' : '#fffaf0'; ctx.strokeStyle = 'rgba(60,50,20,0.55)'; ctx.lineWidth = 1;
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sg * w * 0.55, -h * 0.2, w * 0.6, h, sg * 0.5, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#4a3a22'; ctx.fillRect(-1, -h * 0.7, 2, h * 1.6);
    ctx.restore();
  }
}
// ---- particles (world metres): dust puffs and wood chips -------------------------------------------------------------------------
export function drawParts(ctx, list) {
  for (const p of list) {
    const k = p.t / p.max, s = proj(p.x, p.y, p.z);
    ctx.save();
    if (p.k === 'dust') {
      const r = Math.max(2, s.s * p.size * (1 + k * 1.8));
      ctx.globalAlpha = (1 - k) * 0.5; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
    } else {
      ctx.globalAlpha = 1 - k * k; ctx.translate(s.x, s.y); ctx.rotate(p.rot + p.spin * p.t); ctx.fillStyle = p.col;
      const r = Math.max(1.5, s.s * p.size); ctx.fillRect(-r, -r * 0.5, r * 2, r);
    }
    ctx.restore();
  }
}
export { KUBB, KING, BATON };
