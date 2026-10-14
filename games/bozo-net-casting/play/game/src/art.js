// Drawing of the river world: a cached sky and far bank, perspective water with glints and a sun reflection, drifting foam,
// the shoals seen through the water, the cast net (in flight, sinking, hauled, released), the dugout canoe and the fisher.
// One pinhole camera looks forward over the canoe's stern (see makeCam). Pure drawing, no state.
import { SPECIES, NETS, FLIGHT, fishPosDuring, fishPos } from './sim.js';
import { W as VW, H as VH } from './layout.js';

const TAU = Math.PI * 2;
export const Z0 = 3.0;                 // camera sits this far behind the canoe's reference line
export const CAM_H = 4.4;              // eye height above the water, m
export const FISH_SCALE = 2.3;         // fish are drawn this much larger than life so a shoal reads on a phone
export const FISHER = { x: -0.55, z: 2.7 };
export const HAUL = 1.5, RELEASE = 1.6; // seconds the net is pulled in, and the fish take to slip away again

const hs = (n) => { let x = Math.imul(n | 0, 0x45d9f3b); x ^= x >>> 16; x = Math.imul(x, 0x45d9f3b); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const fr = (v) => v - Math.floor(v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

// Per-water look. sky = [top, mid, horizon]; water = [far, mid, near]; sun = { x, y (0..1 of sky), r, c }.
export const PALS = [
  { sky: ['#4d5f9c', '#e79aa6', '#ffd9b0'], water: ['#f0c8a8', '#6f948c', '#1f3f3c'], glint: '255,236,210', bank: ['#6a6a58', '#3d4a38'], sun: { x: 0.64, y: 0.9, r: 44, c: '255,236,190' }, night: false, haze: '255,214,180', foam: '240,232,214' },
  { sky: ['#3f86d6', '#92c8ef', '#e2f2ff'], water: ['#b9d9c8', '#5e9a84', '#1b5650'], glint: '255,255,255', bank: ['#6f9a62', '#3f6a40'], sun: { x: 0.3, y: 0.34, r: 34, c: '255,252,230' }, night: false, haze: '228,244,255', foam: '246,246,240' },
  { sky: ['#3a2d6e', '#e0704c', '#ffc15c'], water: ['#ffb878', '#a8664e', '#2c2c40'], glint: '255,214,150', bank: ['#4a3a55', '#2a2236'], sun: { x: 0.42, y: 0.9, r: 62, c: '255,214,140' }, night: false, haze: '255,176,110', foam: '255,232,200' },
  { sky: ['#070b24', '#2a2862', '#c4587c'], water: ['#7a5a82', '#2b2b52', '#090d22'], glint: '255,190,200', bank: ['#1c1a3a', '#0c0c22'], sun: { x: 0.7, y: 0.93, r: 36, c: '255,170,150' }, night: true, haze: '190,100,130', foam: '210,190,220' },
];

export function makeCam(rect) {
  const land = rect.w > rect.h;
  const f = Math.min(rect.w * 1.18, rect.h * 0.92);
  const hor = rect.y + rect.h * (land ? 0.29 : 0.27);
  const cx = rect.x + rect.w / 2;
  return {
    rect, f, hor, cx,
    X: (x, z) => cx + (f * x) / (z + Z0),
    Y: (h, z) => hor + (f * (CAM_H - h)) / (z + Z0),
    S: (m, z) => (f * m) / (z + Z0),
    // the water point under a screen point (h = height of the plane, 0 = the surface)
    toWorld(sx, sy, h = 0) { const k = Math.max(1, sy - hor), d = (f * (CAM_H - h)) / k; return { x: ((sx - cx) * d) / f, z: d - Z0 }; },
  };
}

// ---- backdrop (sky, sun, clouds, far bank with palms and huts), cached per water and size -------------------------------------
const bdCache = new Map();
export function resetArt() { bdCache.clear(); }
function ridge(ctx, w, base, amp, seed, col, f1, f2) {
  ctx.beginPath(); ctx.moveTo(0, base + 4);
  for (let x = 0; x <= w + 8; x += 6) ctx.lineTo(x, base - amp * (0.5 + 0.28 * Math.sin(x * f1 + seed) + 0.22 * Math.sin(x * f2 + seed * 2.3)));
  ctx.lineTo(w, base + 4); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}
function palmSprite(ctx, x, base, h, col, lean, seed) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, h * 0.07);
  const tx = x + lean * h, ty = base - h;
  ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + lean * h * 0.2, base - h * 0.6, tx, ty); ctx.stroke();
  ctx.lineWidth = Math.max(1, h * 0.05);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.05 + 0.9 * (i / 6)) + (hs(seed + i) - 0.5) * 0.15, L = h * (0.38 + 0.12 * hs(seed * 3 + i));
    ctx.beginPath(); ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty + Math.sin(a) * L * 0.6 - L * 0.22, tx + Math.cos(a) * L, ty + Math.sin(a) * L * 0.7 + L * 0.22);
    ctx.stroke();
  }
}
function hutSprite(ctx, x, base, w, wall, roof) {
  ctx.fillStyle = wall; ctx.fillRect(x - w * 0.42, base - w * 0.5, w * 0.84, w * 0.5);
  ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - w * 0.62, base - w * 0.46); ctx.lineTo(x, base - w * 1.08); ctx.lineTo(x + w * 0.62, base - w * 0.46); ctx.closePath(); ctx.fill();
}
function paintBackdrop(ctx, w, hh, pi) {
  const p = PALS[pi];
  const g = ctx.createLinearGradient(0, 0, 0, hh);
  g.addColorStop(0, p.sky[0]); g.addColorStop(0.55, p.sky[1]); g.addColorStop(1, p.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
  if (p.night) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 60; i++) { ctx.globalAlpha = 0.2 + 0.55 * hs(i * 3 + 1) * (1 - 0.8 * (i % 7) / 7); ctx.fillRect(hs(i * 7) * w, hs(i * 11 + 5) * hh * 0.6, 1.6, 1.6); }
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < 5; i++) {
    const cx = hs(i * 5 + 2) * w, cy = hh * (0.1 + 0.5 * hs(i * 9 + 4)), rw = w * (0.18 + 0.15 * hs(i * 13 + 1)), rh = rw * 0.15;
    const rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, rw);
    const cc = p.night ? '170,120,170' : pi === 2 ? '255,170,120' : '255,255,255';
    rg.addColorStop(0, `rgba(${cc},${p.night ? 0.2 : 0.5})`); rg.addColorStop(1, `rgba(${cc},0)`);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, rh / rw); ctx.translate(-cx, -cy); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, rw, 0, TAU); ctx.fill(); ctx.restore();
  }
  const sx = p.sun.x * w, sy = p.sun.y * hh;
  const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, p.sun.r * 4.4);
  glow.addColorStop(0, `rgba(${p.sun.c},0.9)`); glow.addColorStop(0.25, `rgba(${p.sun.c},0.3)`); glow.addColorStop(1, `rgba(${p.sun.c},0)`);
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, hh);
  const sg = ctx.createRadialGradient(sx - p.sun.r * 0.1, sy - p.sun.r * 0.1, 1, sx, sy, p.sun.r * 0.55);
  sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, `rgb(${p.sun.c})`);
  ctx.beginPath(); ctx.arc(sx, sy, p.sun.r * 0.5, 0, TAU); ctx.fillStyle = sg; ctx.fill();
  // the far bank: two ridges of trees, then palms and a few huts standing on the near edge
  ridge(ctx, w, hh, hh * 0.1, 1.7 + pi, p.bank[0], 0.012, 0.034);
  ridge(ctx, w, hh + 1, hh * 0.06, 4.2 + pi * 2, p.bank[1], 0.02, 0.05);
  for (let i = 0; i < 9; i++) palmSprite(ctx, hs(i * 17 + pi * 3) * w, hh + 1, hh * (0.12 + 0.1 * hs(i * 5 + 9)), p.bank[1], (hs(i * 3 + 1) - 0.5) * 0.4, i * 11 + pi);
  for (let i = 0; i < 5; i++) hutSprite(ctx, hs(i * 23 + pi * 5 + 7) * w, hh + 1, hh * (0.045 + 0.02 * hs(i * 4)), p.bank[1], p.bank[1]);
  const hz = ctx.createLinearGradient(0, hh - hh * 0.2, 0, hh);
  hz.addColorStop(0, `rgba(${p.haze},0)`); hz.addColorStop(1, `rgba(${p.haze},0.5)`);
  ctx.fillStyle = hz; ctx.fillRect(0, hh - hh * 0.2, w, hh * 0.2);
}
function blitBackdrop(ctx, rect, hor, pi) {
  const w = Math.max(2, Math.round(rect.w)), hh = Math.max(2, Math.round(hor - rect.y));
  const key = `${pi}|${w}x${hh}`;
  let c = bdCache.get(key);
  if (!c && typeof OffscreenCanvas !== 'undefined') {
    try { c = new OffscreenCanvas(w, hh); paintBackdrop(c.getContext('2d'), w, hh, pi); bdCache.set(key, c); if (bdCache.size > 12) bdCache.delete(bdCache.keys().next().value); } catch { c = null; }
  }
  if (c) ctx.drawImage(c, rect.x, rect.y);
  else { ctx.save(); ctx.translate(rect.x, rect.y); paintBackdrop(ctx, w, hh, pi); ctx.restore(); }
}

// ---- helpers ---------------------------------------------------------------------------------------------------------------------
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };
// A circle on a horizontal plane at height h, as projected screen points.
export function ringPts(cam, x, z, h, r, n, rot = 0) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = rot + (i / n) * TAU, zz = Math.max(0.2, z + Math.sin(a) * r); out.push([cam.X(x + Math.cos(a) * r, zz), cam.Y(h, zz)]); }
  return out;
}

// ---- the net -----------------------------------------------------------------------------------------------------------------------
// Draws an open net seen from above and behind: mesh fill, spokes and rings, a rope rim and lead weights.
export function drawNetRing(ctx, cam, x, z, h, r, netIdx, o = {}) {
  const net = NETS[netIdx], col = net.col, alpha = o.alpha === undefined ? 1 : o.alpha, rot = o.rot || 0;
  if (r < 0.05 || alpha <= 0.01) return;
  const n = 30, rim = ringPts(cam, x, z, h, r, n, rot);
  ctx.save(); ctx.globalAlpha = alpha;
  poly(ctx, rim); ctx.fillStyle = hexA(col[1], o.sunk ? 0.2 : 0.3); ctx.fill();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // mesh: a few concentric rings and spokes
  ctx.strokeStyle = hexA(col[0], o.sunk ? 0.4 : 0.6); ctx.lineWidth = Math.max(0.8, cam.S(0.025, z));
  for (const k of [0.34, 0.68]) { poly(ctx, ringPts(cam, x, z, h, r * k, 20, rot)); ctx.stroke(); }
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const p = rim[Math.floor((i / 10) * n)], cxy = [cam.X(x, z), cam.Y(h, z)]; ctx.moveTo(cxy[0], cxy[1]); ctx.lineTo(p[0], p[1]); }
  ctx.stroke();
  // rope rim, a dark under-line first so it reads against bright water
  poly(ctx, rim); ctx.strokeStyle = 'rgba(30,18,8,0.55)'; ctx.lineWidth = Math.max(2, cam.S(0.1, z)); ctx.stroke();
  ctx.strokeStyle = col[0]; ctx.lineWidth = Math.max(1.4, cam.S(0.062, z)); ctx.stroke();
  // lead weights
  ctx.fillStyle = col[2];
  const lw = Math.max(1.8, cam.S(0.085, z));
  for (let i = 0; i < 15; i++) { const p = rim[Math.floor((i / 15) * n)]; ctx.beginPath(); ctx.arc(p[0], p[1], lw, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function hexA(hex, a) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}
// A small top-down net for the tray and the rules pictures.
export function drawNetIcon(ctx, cx, cy, r, netIdx, o = {}) {
  const net = NETS[netIdx], col = net.col, fy = o.flat === undefined ? 0.56 : o.flat, n = 26;
  ctx.save();
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(cx + r * 0.05, cy + r * 0.1, r * 1.02, r * fy * 1.02, 0, 0, TAU); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * fy, 0, 0, TAU);
  const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  g.addColorStop(0, hexA(col[1], 0.95)); g.addColorStop(1, hexA(col[1], 0.6));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = hexA(col[2], 0.55); ctx.lineWidth = Math.max(0.8, r * 0.025);
  for (const k of [0.34, 0.68]) { ctx.beginPath(); ctx.ellipse(cx, cy, r * k, r * fy * k, 0, 0, TAU); ctx.stroke(); }
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * fy); }
  ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * fy, 0, 0, TAU); ctx.strokeStyle = col[0]; ctx.lineWidth = Math.max(1.6, r * 0.075); ctx.stroke();
  ctx.fillStyle = col[2];
  for (let i = 0; i < n / 2; i++) { const a = (i / (n / 2)) * TAU; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * fy, Math.max(1.4, r * 0.06), 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---- fish --------------------------------------------------------------------------------------------------------------------------
// A fish seen from above, nose along +x, `L` px long.
export function drawFishShape(ctx, L, spIdx, wag, o = {}) {
  const sp = SPECIES[spIdx], h = L * (spIdx === 7 ? 0.2 : spIdx === 1 ? 0.14 : spIdx === 4 ? 0.15 : 0.19), c = o.sil ? [o.sil, o.sil, o.sil] : sp.col;
  const tw = wag * h * 0.9;
  // tail
  ctx.fillStyle = c[2];
  ctx.beginPath(); ctx.moveTo(-L * 0.3, 0); ctx.lineTo(-L * 0.58, -h * 0.9 + tw); ctx.lineTo(-L * 0.5, tw * 0.5); ctx.lineTo(-L * 0.58, h * 0.9 + tw); ctx.closePath(); ctx.fill();
  // body
  if (L < 15) ctx.fillStyle = c[0];     // small fish: a flat fill (no gradient object per fish per frame)
  else {
    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, c[0]); g.addColorStop(0.55, c[0]); g.addColorStop(1, c[1]);
    ctx.fillStyle = g;
  }
  ctx.beginPath(); ctx.moveTo(L * 0.5, 0);
  ctx.quadraticCurveTo(L * 0.2, -h * 1.25, -L * 0.1, -h * 0.9);
  ctx.quadraticCurveTo(-L * 0.28, -h * 0.5 + tw * 0.4, -L * 0.34, tw * 0.45);
  ctx.quadraticCurveTo(-L * 0.28, h * 0.5 + tw * 0.4, -L * 0.1, h * 0.9);
  ctx.quadraticCurveTo(L * 0.2, h * 1.25, L * 0.5, 0); ctx.closePath(); ctx.fill();
  if (L < 9 || o.sil) return;
  // pectoral fins and an eye
  ctx.fillStyle = c[2]; ctx.globalAlpha *= 0.8;
  ctx.beginPath(); ctx.ellipse(L * 0.08, -h * 1.0, L * 0.09, h * 0.28, -0.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(L * 0.08, h * 1.0, L * 0.09, h * 0.28, 0.5, 0, TAU); ctx.fill();
  ctx.globalAlpha /= 0.8;
  ctx.fillStyle = 'rgba(8,8,8,0.85)'; ctx.beginPath(); ctx.arc(L * 0.33, -h * 0.35, Math.max(0.8, L * 0.022), 0, TAU); ctx.fill();
  if (L < 16) return;
  if (spIdx === 6) { ctx.strokeStyle = 'rgba(30,30,34,0.55)'; ctx.lineWidth = Math.max(1, L * 0.012); for (let i = 0; i < 5; i++) { const x = L * (0.2 - i * 0.1); ctx.beginPath(); ctx.moveTo(x, -h * 0.7); ctx.lineTo(x - L * 0.02, h * 0.7); ctx.stroke(); } }
  if (spIdx === 3) { ctx.strokeStyle = c[1]; ctx.lineWidth = Math.max(1, L * 0.014); ctx.beginPath(); ctx.moveTo(L * 0.46, -h * 0.2); ctx.lineTo(L * 0.62, -h * 0.9); ctx.moveTo(L * 0.46, h * 0.2); ctx.lineTo(L * 0.62, h * 0.9); ctx.stroke(); }
  if (spIdx === 5) { ctx.strokeStyle = c[0]; ctx.lineWidth = Math.max(1.2, L * 0.05); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(L * 0.46, 0); ctx.quadraticCurveTo(L * 0.62, h * 0.2, L * 0.6, h * 0.75); ctx.stroke(); }
  if (spIdx === 0 || spIdx === 2) { ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = Math.max(1, L * 0.02); ctx.beginPath(); ctx.moveTo(L * 0.3, h * 0.25); ctx.quadraticCurveTo(0, h * 0.5, -L * 0.2, h * 0.2); ctx.stroke(); }
}
// A fish for menus and pages: drawn big, with a soft shadow.
export function drawFishIcon(ctx, cx, cy, L, spIdx, o = {}) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot || 0);
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(L * 0.02, L * 0.2, L * 0.46, L * 0.09, 0, 0, TAU); ctx.fill(); }
  drawFishShape(ctx, L, spIdx, o.wag || 0, o);
  ctx.restore();
}

// ---- the cast: where the net and the fish are at a moment -----------------------------------------------------------------------------
// cast = { x, z, net, depth, open, tRel, t0, res, caughtIdx: object keyed shoal*100+fish } ; tt = seconds since release.
// Returns { phase, x, z, h, r, contract, rel } (rel: 0..1 through the release of the fish).
export function netState(cast, tt) {
  const res = cast.res, R = res.R;
  if (tt < FLIGHT) {
    const u = clamp(tt / FLIGHT, 0, 1);
    return { phase: 'flight', x: lerp(FISHER.x + 0.35, cast.x, u), z: lerp(FISHER.z + 0.6, cast.z, u), h: lerp(1.5, 0, u) + 2.3 * Math.sin(Math.PI * u), r: R * (0.25 + 0.75 * u * u), contract: 1, rel: 0, u };
  }
  const s = tt - FLIGHT;
  if (s < res.sinkDur) {
    const pull = s < 0.18 ? 0.5 + 0.5 * (s / 0.18) : 1;
    return { phase: 'sink', x: cast.x + res.drift.x * s, z: cast.z + res.drift.z * s, h: -Math.min(res.sink * s, 4.2), r: R * pull, contract: 1, rel: 0, u: s / res.sinkDur };
  }
  const hx = cast.x + res.drift.x * res.sinkDur, hz = cast.z + res.drift.z * res.sinkDur, hd = -Math.min(res.sink * res.sinkDur, 4.2);
  const s2 = s - res.sinkDur;
  if (s2 < HAUL) {
    const u = s2 / HAUL, e = u * u * (3 - 2 * u);
    return { phase: 'haul', x: lerp(hx, FISHER.x + 0.7, e), z: lerp(hz, FISHER.z + 1.1, e), h: lerp(hd, 0.25, e), r: R * lerp(1, 0.28, e), contract: lerp(1, 0.2, e), rel: 0, u };
  }
  const u2 = clamp((s2 - HAUL) / RELEASE, 0, 1);
  return { phase: 'release', x: FISHER.x + 0.7, z: FISHER.z + 1.1, h: 0.25, r: R * 0.28, contract: 0.2, rel: u2, u: 1 };
}
export const castDuration = (cast) => FLIGHT + cast.res.sinkDur + HAUL + RELEASE;

// ---- the whole world ------------------------------------------------------------------------------------------------------------------------
// o = { water, t, world, cast, ripples, parts, pose }
const fishCol = new Map();
const glintCache = new Map();
// alpha quantised to 1/32 steps so the style strings are built once, not 100 times a frame
function glintStyle(c, a) {
  const q = Math.round(clamp(a, 0, 1) * 32), key = c + '|' + q;
  let v = glintCache.get(key);
  if (!v) { v = `rgba(${c},${(q / 32).toFixed(3)})`; glintCache.set(key, v); }
  return v;
}
// The optional 3D river (web/view3d/scene.js), installed by main.js. While it is active it draws the whole world behind this transparent canvas.
let scene3d = null;
export const setScene3d = (s) => { scene3d = s; };
export const scene3dActive = () => !!(scene3d && scene3d.active());
export function drawWorld(ctx, rect, o) {
  if (scene3d && scene3d.active()) {
    o.rdt = scene3d.dt || 0;
    const cam3 = makeCam(rect), pose3 = o.pose || { mode: 'idle' }, fp = fisherPose(pose3, o), u3 = clamp(pose3.u || 0, 0, 1);
    const fx = { mode: fp.mode, hands: fp.hands, twist: fp.twist, ring: fp.ring,
      grip: [true, fp.mode === 'swing' || fp.mode === 'idle' || fp.mode === 'haul' || (fp.mode === 'throw' && u3 < 0.5)] };
    if (scene3d.frame({ rect, cam: cam3, W: VW, H: VH }, o, fx)) { ctx.clearRect(rect.x, rect.y, rect.w, rect.h); return cam3; }
  }
  const cam = makeCam(rect), p = PALS[WATER_PAL[o.water] ?? 0], { f, hor, cx } = cam;
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  blitBackdrop(ctx, rect, hor, WATER_PAL[o.water] ?? 0);
  const bot = rect.y + rect.h;
  // water body
  const g = ctx.createLinearGradient(0, hor, 0, bot);
  g.addColorStop(0, p.water[0]); g.addColorStop(0.3, p.water[1]); g.addColorStop(1, p.water[2]);
  ctx.fillStyle = g; ctx.fillRect(rect.x, hor - 1, rect.w, bot - hor + 2);
  // the banks run in towards the horizon on both sides
  drawBanks(ctx, cam, p, o.water);
  // the sun's reflection column
  const sunX = rect.x + p.sun.x * rect.w;
  const rc = ctx.createLinearGradient(0, hor, 0, bot);
  rc.addColorStop(0, `rgba(${p.sun.c},0.6)`); rc.addColorStop(0.45, `rgba(${p.sun.c},0.18)`); rc.addColorStop(1, `rgba(${p.sun.c},0.04)`);
  ctx.fillStyle = rc;
  ctx.beginPath(); ctx.moveTo(sunX - p.sun.r * 0.45, hor); ctx.lineTo(sunX + p.sun.r * 0.45, hor); ctx.lineTo(sunX + rect.w * 0.22, bot); ctx.lineTo(sunX - rect.w * 0.22, bot); ctx.closePath(); ctx.fill();
  // glints: rows of short bright dashes, denser and brighter near the sun
  const t = o.t;
  for (let k = 0, z = 1.2; z < 90; k++, z *= 1.2) {
    const d = z + Z0, sy = hor + (f * CAM_H) / d, fade = 1 - z / 100;
    for (let j = 0; j < 4; j++) {
      const h = hs(k * 31 + j * 7 + 11), half = (rect.w * d) / f / 2 * 1.15;
      const xw = (hs(k * 13 + j * 19 + 3) - 0.5) * 2 * half + Math.sin(t * 0.6 + h * 6.28) * 0.14;
      const sx = cx + (f * xw) / d, wpx = (f * (0.3 + 0.9 * h)) / d, th = Math.max(1, (f * 0.014) / d + 0.4);
      const nearSun = Math.abs(sx - sunX) < rect.w * 0.17 * (0.4 + (hor + 1) / (sy + 1));
      const a = (nearSun ? 0.6 : 0.2) * fade * (0.5 + 0.7 * hs(k * 5 + j));
      ctx.fillStyle = glintStyle(nearSun ? p.sun.c : p.glint, a);
      ctx.fillRect(sx - wpx / 2, sy, Math.max(1.5, wpx), th);
    }
  }
  // foam and leaves drifting with the current show which way the river runs
  const cur = o.world ? o.world.cur : { x: 0.4, z: 0 };
  ctx.fillStyle = `rgba(${p.foam},0.5)`;
  for (let i = 0; i < 16; i++) {
    const z = 6 + 18 * hs(i * 9 + 4), span = 0.34 * (z + Z0) * 2.2;
    const x = ((hs(i * 5 + 1) * span + cur.x * t * 0.7) % span + span) % span - span / 2;
    const zz = z + Math.sin(t * 0.4 + i) * 0.15 + cur.z * t * 0.3 % 1;
    const sx = cam.X(x, zz), sy = cam.Y(0, zz), w = Math.max(2, cam.S(0.16 + 0.12 * hs(i), zz));
    ctx.beginPath(); ctx.ellipse(sx, sy, w, w * 0.34, 0, 0, TAU); ctx.fill();
  }
  // darker near edge and a haze at the horizon
  const vg = ctx.createLinearGradient(0, bot - rect.h * 0.24, 0, bot);
  vg.addColorStop(0, 'rgba(0,8,10,0)'); vg.addColorStop(1, 'rgba(0,8,10,0.32)');
  ctx.fillStyle = vg; ctx.fillRect(rect.x, bot - rect.h * 0.24, rect.w, rect.h * 0.24);
  const mg = ctx.createLinearGradient(0, hor, 0, hor + rect.h * 0.11);
  mg.addColorStop(0, `rgba(${p.haze},0.6)`); mg.addColorStop(1, `rgba(${p.haze},0)`);
  ctx.fillStyle = mg; ctx.fillRect(rect.x, hor, rect.w, rect.h * 0.11);

  // birds in the sky
  for (let i = 0; i < 3; i++) {
    const bx = rect.x + ((t * (16 + i * 5) + i * 260) % (rect.w + 160)) - 80, by = rect.y + (hor - rect.y) * (0.22 + 0.16 * i) + Math.sin(t * 0.8 + i) * 6;
    const fl = Math.sin(t * 7 + i * 2) * 5, sz = 7 + i * 1.5;
    ctx.strokeStyle = p.night ? 'rgba(40,20,40,0.7)' : 'rgba(250,250,250,0.9)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx - sz, by - fl * 0.5); ctx.quadraticCurveTo(bx - sz * 0.4, by - fl - 3, bx, by); ctx.quadraticCurveTo(bx + sz * 0.4, by - fl - 3, bx + sz, by - fl * 0.5); ctx.stroke();
  }

  // ripples on the water (rings from the net, the fish and the splashes)
  for (const rp of o.ripples) {
    const age = t - rp.t0;
    if (age < 0 || age > 3.2) continue;
    const life = 1 - age / 3.2, R0 = rp.s * 1.7 * (0.16 + age * 0.55);
    const sx = cam.X(rp.x, rp.z), sy = cam.Y(0, rp.z);
    for (let k = 0; k < 3; k++) {
      const R = R0 * (1 - k * 0.27);
      if (R <= 0.02) continue;
      const rx = cam.S(R, rp.z), ry = Math.max(rx * 0.1, (cam.Y(0, rp.z - R) - cam.Y(0, rp.z + R)) / 2);
      const a = life * life * (0.8 - k * 0.2);
      ctx.lineWidth = Math.max(1, rx * 0.035);
      ctx.strokeStyle = `rgba(0,10,12,${(a * 0.35).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(sx, sy + 1.6, rx, ry, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${(a * 0.75).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, TAU); ctx.stroke();
    }
  }

  // fish (and the net below the surface)
  if (o.world) drawShoals(ctx, cam, o, p);

  // the net above the water and the rope back to the fisher
  if (o.cast) drawCastTop(ctx, cam, o);

  // spray
  for (const q of o.parts) {
    const a = 1 - q.t / q.max;
    if (a <= 0) continue;
    const sx = cam.X(q.x, q.z), sy = cam.Y(Math.max(0, q.y), q.z), r = Math.max(1.2, cam.S(q.size, q.z));
    ctx.fillStyle = `rgba(${q.col || '240,250,255'},${(0.85 * a).toFixed(3)})`; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
  }

  drawCanoe(ctx, cam, p, o);
  drawFisher(ctx, cam, p, o.pose || { mode: 'idle' }, o);
  ctx.restore();
  return cam;
}
export const WATER_PAL = [0, 1, 2, 3];

function drawBanks(ctx, cam, p, water) {
  const { rect } = cam, bot = rect.y + rect.h;
  for (const side of [-1, 1]) {
    const pts = [];
    for (const z of [90, 72, 58, 46, 37, 30, 24, 19, 15, 12, 9, 6, 3, 0, -1.5]) { const edge = side * (12.5 + 1.6 * Math.sin(z * 0.19 + water * 1.7 + (side > 0 ? 2 : 0))); pts.push([cam.X(edge, z), cam.Y(0.0, z), z]); }
    // outside edge, down to the bottom corner
    const last = pts[pts.length - 1], first = pts[0];
    ctx.beginPath(); ctx.moveTo(side < 0 ? rect.x - 4 : rect.x + rect.w + 4, first[1]);
    pts.forEach((q) => ctx.lineTo(q[0], q[1] - cam.S(0.5, Math.max(0.5, q[2]))));
    ctx.lineTo(last[0], last[1]); ctx.lineTo(side < 0 ? rect.x - 4 : rect.x + rect.w + 4, bot + 4); ctx.closePath();
    const g = ctx.createLinearGradient(0, cam.hor, 0, bot); g.addColorStop(0, p.bank[0]); g.addColorStop(1, p.bank[1]);
    ctx.fillStyle = g; ctx.fill();
    // reeds along the edge
    ctx.strokeStyle = p.bank[1]; ctx.lineCap = 'round';
    for (let i = 0; i < 42; i++) {
      const z = 14 + 70 * hs(i * 7 + side * 3 + 5), edge = side * (12.5 + 1.6 * Math.sin(z * 0.19 + water * 1.7 + (side > 0 ? 2 : 0))) - side * hs(i) * 0.6;
      const sx = cam.X(edge, z), sy = cam.Y(0, z), hgt = cam.S(0.9 + 0.8 * hs(i * 3), z);
      ctx.lineWidth = Math.max(1, cam.S(0.05, z));
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (hs(i * 11) - 0.5) * hgt * 0.4, sy - hgt); ctx.moveTo(sx + 2, sy); ctx.lineTo(sx + 2 + (hs(i * 13) - 0.5) * hgt * 0.5, sy - hgt * 0.8); ctx.stroke();
    }
    // a palm or two on the near bank
    for (let i = 0; i < 4; i++) {
      const z = 22 + i * 14 + hs(i * 5 + side) * 6, edge = side * (13.8 + 1.6 * Math.sin(z * 0.19 + water * 1.7 + (side > 0 ? 2 : 0)));
      palmSprite(ctx, cam.X(edge, z), cam.Y(0, z), cam.S(4.5 + hs(i + 3), z), p.bank[1], side * -0.15, i * 7 + water);
    }
  }
}

// ---- shoals ----------------------------------------------------------------------------------------------------------------------------------
const FP = { x: 0, z: 0 }, FQ = { x: 0, z: 0 };
const pool = [], list = [], byDepth = (a, b) => b[2] - a[2];
function drawShoals(ctx, cam, o, p) {
  const { world, t, cast } = o;
  const vis = world.vis;
  const tt = cast ? t - cast.t0 : -1, ns = cast ? netState(cast, Math.max(0, tt)) : null;
  // a reused, depth-sorted draw list (entries are pooled: no per-frame allocation storm with five shoals)
  let n = 0;
  for (let si = 0; si < world.shoals.length; si++) {
    const sh = world.shoals[si];
    for (let fi = 0; fi < sh.fish.length; fi++) { const e = pool[n] || (pool[n] = [0, 0, 0]); e[0] = si; e[1] = fi; e[2] = sh.fish[fi].depth; list[n++] = e; }
  }
  list.length = n;
  list.sort(byDepth);
  // ambient rises: a ring over a fish near the top of each shallow shoal, so murky water still shows where they are
  for (let si = 0; si < world.shoals.length; si++) {
    const sh = world.shoals[si];
    if (sh.depth > 2.0 && vis < 0.8) continue;
    const per = 1.5, k = Math.floor(t / per + sh.p1 * 3), age = (t / per + sh.p1 * 3 - k) * per;
    if (age > 1.1) continue;
    const fi = (k * 7 + si) % sh.fish.length;
    fishPos(sh, sh.fish[fi], t, FP);
    const R = 0.12 + age * 0.45, a = (1 - age / 1.1) * 0.7 * (sh.depth > 2 ? 0.5 : 1);
    const sx = cam.X(FP.x, FP.z), sy = cam.Y(0, FP.z), rx = cam.S(R, FP.z);
    ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.lineWidth = Math.max(1, rx * 0.06);
    ctx.beginPath(); ctx.ellipse(sx, sy, rx, Math.max(1, rx * 0.3), 0, 0, TAU); ctx.stroke();
  }
  // the net below the surface goes under the fish that are above it, over those that are below: draw it in the middle
  let netDrawn = false;
  const drawNetNow = () => {
    netDrawn = true;
    if (!cast || !ns || ns.phase === 'flight' || ns.phase === 'release') return;
    if (ns.h >= 0) return;
    const sunk = clamp(-ns.h / 3, 0, 1);
    drawNetRing(ctx, cam, ns.x, ns.z, ns.h, ns.r, cast.net, { alpha: 0.95 - 0.35 * sunk, sunk: true, rot: tt * 0.9 });
  };
  for (const [si, fi, depth] of list) {
    if (!netDrawn && cast && ns && ns.phase !== 'flight' && ns.phase !== 'release' && ns.h >= -depth) drawNetNow();
    const sh = world.shoals[si], f = sh.fish[fi], sp = SPECIES[sh.sp];
    const key = si * 100 + fi;
    let rec = cast && cast.caughtIdx ? cast.caughtIdx[key] : null;
    let x, z, dep = f.depth, a = 1, ang;
    const inNet = rec && cast && tt >= FLIGHT + rec.tc;
    if (inNet && ns) {
      // part of the bundle now: the net's centre plus the fish's place inside it
      const cc = { x: cast.x + cast.res.drift.x * rec.tc, z: cast.z + cast.res.drift.z * rec.tc };
      const ox = rec.x - cc.x, oz = rec.z - cc.z;
      if (ns.phase === 'release') {
        // slips out and swims off, sinking and fading
        const u = ns.rel, k = (hs(key * 3 + 1) - 0.5) * 2.4, away = 0.4 + 2.2 * u * (0.7 + 0.6 * hs(key));
        x = ns.x + ox * 0.2 + k * away; z = ns.z + oz * 0.2 + (0.8 + hs(key + 9)) * away; dep = f.depth * u * 0.8 + 0.1; a = 1 - u * u;
        ang = Math.atan2(cam.Y(-dep, z + 0.2) - cam.Y(-dep, z), cam.X(x + 0.2 * k, z + 0.2) - cam.X(x, z)) + Math.PI;
        if (a <= 0.02) continue;
      } else {
        x = ns.x + ox * ns.contract; z = ns.z + oz * ns.contract;
        dep = ns.phase === 'sink' ? Math.max(f.depth, -ns.h) : Math.max(0, -ns.h + (hs(key) * 0.2));
        ang = f.ph + t * 6 * (ns.phase === 'haul' ? 2 : 0.5);
      }
    } else {
      fishPosDuring(world, cast ? cast.res : null, cast || null, si, fi, t, FP);
      x = FP.x; z = FP.z;
      fishPosDuring(world, cast ? cast.res : null, cast || null, si, fi, t + 0.12, FQ);
      ang = Math.atan2(cam.Y(-dep, FQ.z) - cam.Y(-dep, z), cam.X(FQ.x, FQ.z) - cam.X(x, z));
    }
    if (z < 0.3) continue;
    const L = clamp(cam.S(sp.len * FISH_SCALE * (sp.len > 0.5 ? 0.7 : 1) * f.sz, z), 3, 78);
    const sx = cam.X(x, z), sy = cam.Y(-dep, z);
    if (sx < cam.rect.x - L || sx > cam.rect.x + cam.rect.w + L) continue;
    const deepFade = 1 - 0.16 * dep, base = inNet && ns && ns.phase !== 'sink' ? 0.95 : 0.12 + 0.78 * vis * deepFade;
    const alpha = clamp(base * a, 0.05, 1);
    const fleeing = cast && tt > FLIGHT && !inNet;
    const wag = Math.sin(t * (fleeing ? 16 : 6.5) + f.ph * 3) * (fleeing ? 1.0 : 0.6);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang); ctx.globalAlpha = alpha;
    // a darker watery shadow under the fish on the bed makes depth readable
    drawFishShape(ctx, L, sh.sp, wag);
    ctx.restore();
  }
  if (!netDrawn) drawNetNow();
  void p;
}

// The net while it is in the air or just above the water (flight, and the bundle at the canoe).
function drawCastTop(ctx, cam, o) {
  const { cast, t } = o, tt = t - cast.t0, ns = netState(cast, Math.max(0, tt));
  const fx = cam.X(FISHER.x + 0.3, FISHER.z), fy = cam.Y(1.3, FISHER.z);
  if (ns.phase === 'flight') {
    // the cord back to the fisher's hand, then the net
    const sx = cam.X(ns.x, ns.z), sy = cam.Y(ns.h, ns.z);
    ctx.strokeStyle = 'rgba(40,24,10,0.8)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo((fx + sx) / 2, Math.min(fy, sy) + 8, sx, sy); ctx.stroke();
    // shadow on the water
    const sy0 = cam.Y(0, ns.z);
    ctx.fillStyle = 'rgba(0,10,12,0.22)'; ctx.beginPath(); ctx.ellipse(cam.X(ns.x, ns.z), sy0, cam.S(ns.r, ns.z) * 0.9, Math.max(2, (cam.Y(0, ns.z - ns.r) - cam.Y(0, ns.z + ns.r)) / 2 * 0.9), 0, 0, TAU); ctx.fill();
    drawNetRing(ctx, cam, ns.x, ns.z, ns.h, ns.r, cast.net, { alpha: 1, rot: tt * 16 });
  } else if (ns.phase === 'sink' || ns.phase === 'haul') {
    const sx = cam.X(ns.x, ns.z), sy = cam.Y(Math.min(0, ns.h), ns.z);
    ctx.strokeStyle = 'rgba(40,24,10,0.65)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo((fx + sx) / 2, (fy + sy) / 2 + 6, sx, sy); ctx.stroke();
    if (ns.h >= 0) drawNetRing(ctx, cam, ns.x, ns.z, ns.h, ns.r, cast.net, { alpha: 1, rot: tt * 0.9 });
  } else if (ns.phase === 'release') {
    const sx = cam.X(ns.x, ns.z), sy = cam.Y(ns.h, ns.z);
    drawNetRing(ctx, cam, ns.x, ns.z, ns.h, ns.r * (1 - 0.3 * ns.rel), cast.net, { alpha: 1 - ns.rel * 0.9, rot: 0 });
    void sx; void sy;
  }
}

// ---- the dugout canoe --------------------------------------------------------------------------------------------------------------------
function drawCanoe(ctx, cam, p, o) {
  const cxm = -0.55, z0 = -2.0, z1 = 5.0;
  const half = (z, h) => {
    const u = (z - z0) / (z1 - z0), body = Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.78));
    return (0.5 + 0.3 * h) * (0.12 + 0.88 * Math.pow(Math.max(0, body), 0.8)) + 0.02;
  };
  const rise = (z) => 0.32 + 0.34 * Math.pow(clamp((z - 2.2) / (z1 - 2.2), 0, 1), 2.2);   // the bow lifts
  const rock = Math.sin(o.t * 1.2) * 0.012;
  const gun = [], hull = [];
  const N = 22;
  for (let i = 0; i <= N; i++) { const z = z0 + (z1 - z0) * (i / N); gun.push([z, half(z, 0), rise(z)]); }
  const pr = (x, z, h) => [cam.X(x, z), cam.Y(h + rock, z)];
  const L = [], R = [], WL = [], WR = [];
  gun.forEach(([z, hw, h]) => { L.push(pr(cxm - hw, z, h)); R.push(pr(cxm + hw, z, h)); WL.push(pr(cxm - hw * 0.82, z, 0)); WR.push(pr(cxm + hw * 0.82, z, 0)); });
  // hull outside: waterline to gunwale on both sides
  ctx.save();
  for (const [A, B, light] of [[L, WL, 0], [R, WR, 1]]) {
    ctx.beginPath(); A.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); for (let i = B.length - 1; i >= 0; i--) ctx.lineTo(B[i][0], B[i][1]); ctx.closePath();
    const g = ctx.createLinearGradient(0, A[Math.floor(N * 0.6)][1] - 20, 0, B[Math.floor(N * 0.6)][1] + 10);
    g.addColorStop(0, light ? '#7a5230' : '#5c3b20'); g.addColorStop(1, '#2a1a0e'); ctx.fillStyle = g; ctx.fill();
  }
  // the inside of the boat
  ctx.beginPath(); L.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath();
  const gi = ctx.createLinearGradient(0, cam.Y(0.3, z1), 0, cam.Y(0.3, z0));
  gi.addColorStop(0, '#4a3018'); gi.addColorStop(1, '#1a0f06'); ctx.fillStyle = gi; ctx.fill();
  // wood grain on the floor
  ctx.strokeStyle = 'rgba(255,220,160,0.12)'; ctx.lineWidth = 1;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); for (let i = 1; i < N - 1; i++) { const z = gun[i][0], hw = gun[i][1]; const q = pr(cxm + k * hw * 0.32, z, 0.12); if (i === 1) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); } ctx.stroke(); }
  // gunwale rims, catching the light
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const A of [L, R]) {
    ctx.beginPath(); A.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.strokeStyle = '#1c1008'; ctx.lineWidth = Math.max(4, cam.S(0.16, 1.5)); ctx.stroke();
    ctx.strokeStyle = '#b98a54'; ctx.lineWidth = Math.max(2, cam.S(0.075, 1.5)); ctx.stroke();
  }
  // the prow
  const tip = pr(cxm, z1 + 0.15, rise(z1) + 0.1);
  ctx.beginPath(); ctx.moveTo(L[N][0], L[N][1]); ctx.quadraticCurveTo((L[N][0] + tip[0]) / 2, tip[1] + 2, tip[0], tip[1]); ctx.quadraticCurveTo((R[N][0] + tip[0]) / 2, tip[1] + 2, R[N][0], R[N][1]);
  ctx.strokeStyle = '#b98a54'; ctx.lineWidth = Math.max(2, cam.S(0.075, 1.5)); ctx.stroke();
  // a paddle lying along the right side
  const a = pr(cxm + 0.26, 0.2, 0.42), b = pr(cxm + 0.3, 4.3, 0.55);
  ctx.strokeStyle = '#a07a46'; ctx.lineWidth = Math.max(2.5, cam.S(0.07, 2)); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  const bl = pr(cxm + 0.3, 4.55, 0.55);
  ctx.fillStyle = '#c29a5c'; ctx.beginPath(); ctx.ellipse(bl[0], bl[1], Math.max(3, cam.S(0.12, 4.5)), Math.max(3, cam.S(0.2, 4.5)) * 0.7, 0, 0, TAU); ctx.fill();
  ctx.restore();
  // a ring of ripples where the hull meets the water
  const wl = pr(cxm, 2.5, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(wl[0], wl[1] + 2, cam.S(0.9, 2.5) , Math.max(3, cam.S(0.9, 2.5) * 0.22), 0, 0, TAU); ctx.stroke();
  void p;
}

// ---- the fisher, seen from behind and above in a low sun --------------------------------------------------------------------------------------
// pose: { mode: 'idle' | 'swing' | 'throw' | 'haul' | 'release', p (swing turns), s (opening 0..1), u (0..1 through the mode), aim (-1..1) , R (net px unused) }
function ik(sx, sy, hx, hy, up, fo, bend) {
  let dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy);
  const max = up + fo - 0.001;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; hx = sx + dx; hy = sy + dy; }
  const a = (up * up - fo * fo + d * d) / (2 * Math.max(d, 1e-6)), h = Math.sqrt(Math.max(0, up * up - a * a));
  const ux = dx / Math.max(d, 1e-6), uy = dy / Math.max(d, 1e-6);
  return { ex: sx + ux * a + -uy * h * bend, ey: sy + uy * a + ux * h * bend, hx, hy };
}
function limb(ctx, k, pts, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0] * k, q[1] * k) : ctx.moveTo(q[0] * k, q[1] * k))); ctx.stroke();
}
const fisherEase = new Map();
// An optional renderer for the fisher (a real 3D person from behind), installed by main.js. render(k, o) returns null when it cannot draw
// (no WebGL, context lost); then the drawn figure below is used.
let fisherRenderer = null;
export const setFisherRenderer = (fn) => { fisherRenderer = fn; };
function hands3d(hands, mode, pose, ring) {
  // 2D hand numbers (metres, screen-right, up) -> reachable 3D targets: the net ring is drawn wider than the arms can reach, so the hands follow
  // a smaller circle round the body and the ring (drawn separately) flares out from them.
  const u = clamp(pose.u || 0, 0, 1);
  return hands.map((h, i) => {
    if (mode === 'swing') {
      let x = clamp(h[0] * 0.62, -0.62, 0.62), sinv = clamp((h[1] - 1.08) / 0.38, -1.2, 1.2), z = clamp(sinv * 0.38 + 0.05, -0.4, 0.5), y = 1.06 + sinv * 0.1;
      if (z < 0.12 && Math.abs(x) < 0.42) x = (x < 0 ? -1 : 1) * (0.42 + (0.12 - z) * 0.1);   // behind the back: keep the hands out of the torso
      return [x, y, z];
    }
    const z = mode === 'throw' ? lerp(i ? 0.12 : 0.3, 0.5, Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5)) : mode === 'release' ? 0.35 : 0.28;
    return [h[0], h[1], z];
  });
}
export function fisherPose(pose, o) {
  const mode = pose.mode || 'idle';
  // pose numbers (metres, y up, origin at the feet)
  const SHY = 1.43, SHX = 0.2, HIP = 0.9;
  let twist = 0, lean = 0, hands, ring = null;
  const wob = Math.sin((o.t || 0) * 1.7);
  if (mode === 'swing') {
    const th = (pose.p || 0) * TAU, s = pose.s || 0, rr = 0.5 + 0.7 * s;
    twist = Math.sin(th) * 0.25; lean = Math.cos(th) * 0.03;
    ring = { r: rr, th };
    hands = [
      [rr * Math.cos(th) * 0.9, 1.0 + rr * Math.sin(th) * 0.38 + 0.08],
      [rr * Math.cos(th + 0.95) * 0.9, 1.0 + rr * Math.sin(th + 0.95) * 0.38 + 0.04],
    ];
  } else if (mode === 'throw') {
    const u = clamp(pose.u || 0, 0, 1), e = Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5);
    twist = lerp(0.3, -0.12, e); lean = lerp(-0.02, 0.1, e);
    const ax = clamp(pose.aim || 0, -1, 1) * 0.5;
    hands = [[lerp(-0.3, -0.2, e), lerp(1.0, 1.25, e)], [lerp(0.3, ax, e), lerp(1.12, 1.95, e)]];
  } else if (mode === 'haul') {
    const u = pose.u || 0, ph = u * TAU * 2.5;
    hands = [[-0.2 + Math.sin(ph + Math.PI) * 0.05, 1.18 - Math.max(0, Math.sin(ph + Math.PI)) * 0.22], [0.22 + Math.sin(ph) * 0.05, 1.18 - Math.max(0, Math.sin(ph)) * 0.22]];
    lean = 0.05 + Math.sin(ph) * 0.015; twist = 0.1;
  } else if (mode === 'release') {
    hands = [[-0.2, 0.95], [0.5, 1.05]]; lean = 0.03; twist = 0.15 * Math.sin(pose.u * 4);
  } else {
    hands = [[-0.3, 1.02 + wob * 0.012], [0.26, 1.08]]; twist = 0.05;
  }
  // Ease the whole body toward the pose each frame so a change of mode (idle -> swing -> throw -> haul -> release) glides
  // instead of jumping. The easing runs on game time (o.t), so Pause freezes it, and it snaps on a new scene or a rewind.
  {
    const key = o.fisherKey || 'main', now = o.t || 0;
    let S = fisherEase.get(key);
    const dt = S ? now - S.t : 99;
    if (!S || dt < 0 || dt > 0.5) { S = { t: now, hands: hands.map((h) => h.slice()), twist, lean, mode, since: 9, vh: [[0, 0], [0, 0]], vt: 0 }; fisherEase.set(key, S); }
    else if (true) {
      // critically damped follow, stepped in display time (not sim ticks) so motion stays smooth at any refresh rate: velocity is carried across a change of mode, so a new pose is reached with no jump in speed
      if (S.mode !== mode) { S.mode = mode; S.since = 0; }
      const rdt = clamp(o.rdt !== undefined ? o.rdt : dt, 0, 0.05);   // display-frame time when a 3D scene supplies it, else game time
      S.since += rdt;
      const w = (mode === 'swing' ? 26 : 12) * (0.55 + 0.45 * Math.min(1, S.since / 0.3));
      const h = rdt, ex = Math.exp(-w * h);
      for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) {
        const x = S.hands[i][k] - hands[i][k], v = S.vh[i][k], c1 = v + w * x;
        S.hands[i][k] = hands[i][k] + (x + c1 * h) * ex; S.vh[i][k] = (v - w * c1 * h) * ex;
      }
      { const x = S.twist - twist, v = S.vt, c1 = v + w * x; S.twist = twist + (x + c1 * h) * ex; S.vt = (v - w * c1 * h) * ex; }
      S.lean += (lean - S.lean) * (1 - Math.exp(-rdt * 12)); S.t = now;
      hands = S.hands.map((q) => q.slice()); twist = S.twist; lean = S.lean;
      return { mode, hands, twist, lean, ring };
    }
    if (false) {
      const a = 1 - Math.exp(-dt * (mode === 'swing' ? 40 : 13));
      for (let i = 0; i < 2; i++) { S.hands[i][0] += (hands[i][0] - S.hands[i][0]) * a; S.hands[i][1] += (hands[i][1] - S.hands[i][1]) * a; }
      S.twist += (twist - S.twist) * a; S.lean += (lean - S.lean) * a; S.t = now;
    }
    hands = S.hands.map((h) => h.slice()); twist = S.twist; lean = S.lean;
  }
  return { mode, hands, twist, lean, ring };
}

export function drawFisher(ctx, cam, p, pose, o) {
  const ppm = cam.S(1, FISHER.z);                   // pixels per metre at the fisher
  const ox = cam.X(FISHER.x, FISHER.z), oy = cam.Y(0, FISHER.z);
  const sway = Math.sin((o.t || 0) * 1.1) * 0.012;
  const FP = fisherPose(pose, o);
  const mode = FP.mode, SHY = 1.43, SHX = 0.2, HIP = 0.9;
  let { hands, twist, lean, ring } = FP;
  const k = ppm;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(1, 1);
  let r3 = null;
  if (fisherRenderer) {
    const t3 = hands3d(hands, mode, pose, ring), u3 = clamp(pose.u || 0, 0, 1);
    r3 = fisherRenderer(k, { hands: t3.map((t) => [t[0], t[1]]), z: t3.map((t) => t[2]), twist, mode, u: u3, night: !!p.night, warm: !p.night && p.sun.y > 0.8, t: o.t || 0,
      grip: [true, mode === 'swing' || mode === 'idle' || mode === 'haul' || (mode === 'throw' && u3 < 0.5)] });
  }
  const P = (x, y) => [x + lean * (y / 1.8) , -y];                 // metres -> local (px later via k)
  const lit = p.sun.x < 0.5 ? -1 : 1;                              // the side the light comes from
  const skin = '#6a432c', skinHi = '#a8714a';
  const cloth = p.night ? '#1d2a4a' : '#2f4a7a', clothHi = p.night ? '#3a4f80' : '#6286c0';
  const trou = p.night ? '#24222c' : '#5a4a36';
  // legs (the gunwale hides them below the shin)
  const legBase = [[-0.12, 0.0], [0.12, 0.0]];
  if (!r3) {
    limb(ctx, k, [[-0.12 + sway, -0.04], [-0.13, -HIP]], 0.2, trou);
    limb(ctx, k, [[0.12 + sway, -0.04], [0.13, -HIP]], 0.2, trou);
  }
  void legBase; void P;
  // far-side ring half, far arm, then the torso, then the near arm and the near ring half
  const sh = [[-SHX * (1 - twist * 0.3) + sway, -SHY], [SHX * (1 + twist * 0.3) + sway, -SHY]];
  const arm = (i) => {
    const s = sh[i], hand = hands[i], r = ik(s[0], s[1], hand[0] * (i ? 1 : 1) + (lean * 0.5), -hand[1], 0.3, 0.28, i === 0 ? 1 : -1);
    return { s, e: [r.ex, r.ey], h: [r.hx, r.hy] };
  };
  const arms = [arm(0), arm(1)];
  const farFirst = (i) => {
    const hnd = hands[i];
    if (mode !== 'swing') return false;
    const th = ring.th + (i ? 0.95 : 0);
    return Math.sin(th) > 0 && hnd;
  };
  const drawArm = (a) => {
    limb(ctx, k, [a.s, a.e], 0.115, cloth);
    limb(ctx, k, [a.e, a.h], 0.095, skin);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(a.h[0] * k, a.h[1] * k, 0.05 * k, 0, TAU); ctx.fill();
    // rim light on the arm
    ctx.strokeStyle = 'rgba(255,214,160,0.45)'; ctx.lineWidth = Math.max(1, 0.018 * k); ctx.beginPath(); ctx.moveTo(a.e[0] * k + lit * 0.04 * k, a.e[1] * k); ctx.lineTo(a.h[0] * k + lit * 0.035 * k, a.h[1] * k); ctx.stroke();
  };
  // the net ring in the hands while swinging: back half
  const drawRing = (front) => {
    if (!ring) return;
    const net = NETS[o.pose.net ?? 0], col = net.col, rr = ring.r, cyc = -1.0;
    ctx.save(); ctx.scale(1, 1);
    const n = 28;
    ctx.beginPath(); let started = false;
    for (let i = 0; i <= n; i++) {
      const a = ring.th + (i / n) * TAU, y = Math.sin(a), isFront = y < 0;
      if (isFront !== front) { started = false; continue; }
      const x = Math.cos(a) * rr, yy = cyc + y * rr * 0.38;
      if (!started) { ctx.moveTo(x * k, yy * k); started = true; } else ctx.lineTo(x * k, yy * k);
    }
    ctx.strokeStyle = 'rgba(30,18,8,0.5)'; ctx.lineWidth = Math.max(2.5, 0.07 * k); ctx.stroke();
    ctx.strokeStyle = col[0]; ctx.lineWidth = Math.max(1.6, 0.045 * k); ctx.stroke();
    ctx.fillStyle = col[2];
    for (let i = 0; i < 12; i++) {
      const a = ring.th + (i / 12) * TAU, y = Math.sin(a);
      if ((y < 0) !== front) continue;
      ctx.beginPath(); ctx.arc(Math.cos(a) * rr * k, (cyc + y * rr * 0.38) * k, Math.max(1.6, 0.04 * k), 0, TAU); ctx.fill();
    }
    // mesh hint: translucent fill of the front half only (kept light)
    if (!front) { ctx.globalAlpha = 0.2; ctx.fillStyle = col[1]; ctx.beginPath(); ctx.ellipse(0, cyc * k, rr * k, rr * 0.38 * k, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  };
  drawRing(false);
  if (r3) {
    // the real person between the two halves of the ring, the folded net hanging from the real right hand when idle
    r3.blit(ctx);
    drawRing(true);
    if (mode === 'idle') {
      const nc = NETS[pose.net ?? 0].col, hx0 = r3.handR.x, hy0 = -r3.handR.y;
      ctx.beginPath(); ctx.moveTo((hx0 - 0.07) * k, hy0 * k);
      ctx.bezierCurveTo((hx0 - 0.2) * k, (hy0 + 0.2) * k, (hx0 - 0.1) * k, (hy0 + 0.42) * k, (hx0 + 0.06) * k, (hy0 + 0.46) * k);
      ctx.bezierCurveTo((hx0 + 0.2) * k, (hy0 + 0.4) * k, (hx0 + 0.16) * k, (hy0 + 0.15) * k, (hx0 + 0.07) * k, hy0 * k); ctx.closePath();
      ctx.fillStyle = nc[1]; ctx.fill(); ctx.strokeStyle = nc[0]; ctx.lineWidth = Math.max(1, 0.02 * k); ctx.stroke();
      ctx.fillStyle = nc[2];
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc((hx0 - 0.07 + i * 0.035) * k, (hy0 + 0.4 + Math.sin(i * 1.7) * 0.03) * k, Math.max(1.4, 0.025 * k), 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    return;
  }
  arms.forEach((a, i) => { if (farFirst(i)) drawArm(a); });
  // torso: a tunic, wider at the shoulders, with a gentle V in the back
  const tw = 1 + twist * 0.25;
  ctx.beginPath();
  ctx.moveTo(-0.17 * k, -HIP * k);
  ctx.bezierCurveTo(-0.17 * k, -1.1 * k, -0.24 * tw * k, -1.28 * k, -0.25 * tw * k, -1.43 * k);
  ctx.quadraticCurveTo(-0.14 * k, -1.5 * k, -0.06 * k, -1.52 * k);
  ctx.lineTo(0.06 * k, -1.52 * k);
  ctx.quadraticCurveTo(0.14 * k, -1.5 * k, 0.25 * tw * k, -1.43 * k);
  ctx.bezierCurveTo(0.24 * tw * k, -1.28 * k, 0.17 * k, -1.1 * k, 0.17 * k, -HIP * k);
  ctx.closePath();
  const tg = ctx.createLinearGradient(-0.25 * k, 0, 0.25 * k, 0);
  tg.addColorStop(0, lit < 0 ? clothHi : cloth); tg.addColorStop(0.5, cloth); tg.addColorStop(1, lit < 0 ? cloth : clothHi);
  ctx.fillStyle = tg; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(1, 0.012 * k); ctx.stroke();
  // a fold down the back and a belt of cord
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = Math.max(1, 0.015 * k); ctx.beginPath(); ctx.moveTo(0, -1.46 * k); ctx.quadraticCurveTo(0.02 * k, -1.2 * k, 0, -HIP * k - 0.02 * k); ctx.stroke();
  ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = Math.max(1.5, 0.035 * k); ctx.beginPath(); ctx.moveTo(-0.17 * k, -1.0 * k); ctx.lineTo(0.17 * k, -1.0 * k); ctx.stroke();
  // neck and head
  ctx.fillStyle = skin; ctx.fillRect(-0.045 * k, -1.57 * k, 0.09 * k, 0.1 * k);
  const hx = twist * 0.03;
  ctx.beginPath(); ctx.ellipse(hx * k, -1.64 * k, 0.094 * k, 0.112 * k, 0, 0, TAU);
  const hg = ctx.createRadialGradient((hx - lit * 0.04) * k, -1.66 * k, 0.01 * k, hx * k, -1.64 * k, 0.12 * k);
  hg.addColorStop(0, skinHi); hg.addColorStop(1, skin); ctx.fillStyle = hg; ctx.fill();
  // a wide woven hat: brim and low crown with a band
  ctx.fillStyle = '#7a5a2a'; ctx.beginPath(); ctx.ellipse(hx * k, -1.72 * k, 0.27 * k, 0.062 * k, 0, 0, TAU); ctx.fill();
  const hat = ctx.createLinearGradient(0, -1.9 * k, 0, -1.7 * k); hat.addColorStop(0, '#e6c880'); hat.addColorStop(1, '#a8884a');
  ctx.fillStyle = hat; ctx.beginPath(); ctx.ellipse(hx * k, -1.735 * k, 0.26 * k, 0.05 * k, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo((hx - 0.12) * k, -1.74 * k); ctx.quadraticCurveTo((hx - 0.1) * k, -1.93 * k, hx * k, -1.93 * k); ctx.quadraticCurveTo((hx + 0.1) * k, -1.93 * k, (hx + 0.12) * k, -1.74 * k); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,20,0.5)'; ctx.lineWidth = Math.max(1, 0.012 * k);
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo((hx + i * 0.036) * k, -1.74 * k); ctx.lineTo((hx + i * 0.02) * k, -1.92 * k); ctx.stroke(); }
  // rim light on the shoulder on the sun side
  ctx.strokeStyle = 'rgba(255,224,170,0.55)'; ctx.lineWidth = Math.max(1.2, 0.022 * k); ctx.beginPath(); ctx.moveTo(lit * 0.25 * tw * k, -1.43 * k); ctx.bezierCurveTo(lit * 0.24 * k, -1.28 * k, lit * 0.17 * k, -1.1 * k, lit * 0.17 * k, -HIP * k); ctx.stroke();
  arms.forEach((a, i) => { if (!farFirst(i)) drawArm(a); });
  drawRing(true);
  if (mode === 'idle') {
    // the folded net hangs from the right hand, lead weights along its lower edge
    const nc = NETS[pose.net ?? 0].col, hx0 = arms[0].h[0], hy0 = arms[0].h[1];
    ctx.beginPath(); ctx.moveTo((hx0 - 0.07) * k, hy0 * k);
    ctx.bezierCurveTo((hx0 - 0.2) * k, (hy0 + 0.2) * k, (hx0 - 0.1) * k, (hy0 + 0.42) * k, (hx0 + 0.06) * k, (hy0 + 0.46) * k);
    ctx.bezierCurveTo((hx0 + 0.2) * k, (hy0 + 0.4) * k, (hx0 + 0.16) * k, (hy0 + 0.15) * k, (hx0 + 0.07) * k, hy0 * k); ctx.closePath();
    ctx.fillStyle = nc[1]; ctx.fill(); ctx.strokeStyle = nc[0]; ctx.lineWidth = Math.max(1, 0.02 * k); ctx.stroke();
    ctx.fillStyle = nc[2];
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc((hx0 - 0.07 + i * 0.035) * k, (hy0 + 0.4 + Math.sin(i * 1.7) * 0.03) * k, Math.max(1.4, 0.025 * k), 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}
