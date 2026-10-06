// Art: everything that is baked once per pitch (backdrop, gravel ground, pebbles, rocks, planks, wall,
// markings) plus the boule/jack/dust sprites. All procedural, seeded, deterministic. Baking uses
// OffscreenCanvas when the host has it (every browser/webview) and quietly does nothing in the
// headless test harness.
import { W, H, CX, project, groundY, scaleAt, depthScale, getStage, setStage } from './cam.js';
import { LANE, JACK_ZONE, slopeAt } from './sim.js';

const TAU = Math.PI * 2;
// Off-screen drawing surfaces: OffscreenCanvas where the host has it; otherwise a plain canvas element made
// through the render canvas's own owner (older webviews). Neither exists in the headless test harness.
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
export const canBake = () => typeof OffscreenCanvas !== 'undefined' || hostDoc !== null;
export const newCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
};
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hash2(ix, iy, seed) {
  let h = (Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul((seed | 0) + 0x9e3779b9, 0x85ebca6b)) | 0;
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export const PAL = {
  village: { base: [203, 176, 134], verge: [132, 124, 80], skyA: '#79b4e6', skyB: '#fbe6b8', hill: [150, 142, 178], trees: 0.62, plank: '#8a6a44', sand: [231, 214, 176], clay: [158, 122, 90] },
  port: { base: [194, 168, 124], verge: [146, 138, 96], skyA: '#62b4ee', skyB: '#fdeec8', hill: [140, 160, 190], trees: 0.0, plank: '#9c7a52', sand: [244, 234, 208], clay: [150, 112, 82] },
  oliviers: { base: [182, 154, 114], verge: [112, 120, 74], skyA: '#86b9e2', skyB: '#f7e2b4', hill: [156, 150, 168], trees: 0.38, plank: '#7c5e3c', sand: [224, 206, 168], clay: [150, 114, 84] },
  colline: { base: [199, 148, 104], verge: [112, 86, 138], skyA: '#8cc0ec', skyB: '#fbe0b0', hill: [170, 140, 168], trees: 0.0, plank: '#7a5a3e', sand: [226, 202, 164], clay: [150, 104, 76] },
};
export const palOf = (t) => PAL[t.pal] ?? PAL.village;

// ---------------------------------------------------------------------------------------------
// backdrop: sky, hills, village / harbour / grove / lavender, canopy frame, stone wall
function paintBackdrop(c, T) {
  const P = palOf(T), rnd = lcg(T.seed ^ 0x77aa);
  const wallBaseY = project(0, 668, 0).y, wallTopY = project(0, 668, 40).y;
  const OX = (W - 720) / 2, WS = W / 720;   // placed scenery stays centred behind the lane when the stage is wider than a phone
  const g = c.createLinearGradient(0, 0, 0, wallBaseY);
  g.addColorStop(0, P.skyA); g.addColorStop(0.75, P.skyB); g.addColorStop(1, P.skyB);
  c.fillStyle = g; c.fillRect(0, 0, W, wallBaseY + 4);
  const sunY = Math.max(40, wallTopY - 60), sun = c.createRadialGradient(130 + OX, sunY, 6, 130 + OX, sunY, 360);
  sun.addColorStop(0, 'rgba(255,244,205,0.9)'); sun.addColorStop(0.35, 'rgba(255,230,170,0.35)'); sun.addColorStop(1, 'rgba(255,230,170,0)');
  c.fillStyle = sun; c.fillRect(0, 0, W, wallBaseY);
  // soft clouds
  for (let i = 0; i < 6; i++) {
    const x = rnd() * W, y = 14 + rnd() * Math.max(40, Math.min(90, wallTopY - 80)), w = 90 + rnd() * 150;
    const cg = c.createRadialGradient(x, y, 4, x, y, w * 0.5);
    cg.addColorStop(0, 'rgba(255,255,255,0.55)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = cg; c.save(); c.translate(x, y); c.scale(1, 0.28); c.translate(-x, -y); c.fillRect(x - w, y - w, w * 2, w * 2); c.restore();
  }
  // far limestone ridge, two hazy layers
  const ridge = (base, amp, col, alpha, seed) => {
    c.beginPath(); c.moveTo(0, wallBaseY);
    for (let x = 0; x <= W; x += 8) {
      const y = base - amp * (0.55 * vnoise(x / 140, seed, T.seed) + 0.3 * vnoise(x / 45, seed + 3, T.seed) + 0.5 * Math.exp(-Math.pow((x - 520 - OX) / 150, 2)));
      c.lineTo(x, y);
    }
    c.lineTo(W, wallBaseY); c.closePath();
    c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`; c.fill();
  };
  ridge(wallTopY - 26, 62, P.hill, 0.5, 2);
  ridge(wallTopY - 8, 40, [P.hill[0] - 22, P.hill[1] - 22, P.hill[2] - 14], 0.72, 9);
  const roof = ['#b9552f', '#c4613a', '#a84a2a', '#cf7447'], wall = ['#f1dfb8', '#e8cf9f', '#f6e8c8', '#dfc08e', '#efd2b0'];
  if (T.pal === 'port') {
    // harbour: pastel quayside houses, sea, masts
    const sy = wallTopY - 22;
    const sea = c.createLinearGradient(0, sy, 0, wallTopY + 6);
    sea.addColorStop(0, '#5fa4cf'); sea.addColorStop(1, '#2d6f9c');
    c.fillStyle = sea; c.fillRect(0, sy, W, wallTopY - sy + 8);
    const cols = ['#f0c46a', '#e98f7a', '#f4e1b0', '#9fc6d8', '#e9a65c'];
    for (let x = -10; x < W; x += 54 + rnd() * 20) {
      const w = 46 + rnd() * 18, h = 40 + rnd() * 34, y = sy - h + 4;
      c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.fillRect(x, y, w, h);
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x + w * 0.6, y, w * 0.4, h);
      c.fillStyle = '#b25a34'; c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x + w / 2, y - 12); c.lineTo(x + w + 3, y); c.fill();
      c.fillStyle = '#3a6f95';
      for (let wx = x + 7; wx < x + w - 8; wx += 14) for (let wy = y + 9; wy < y + h - 8; wy += 15) c.fillRect(wx, wy, 6, 9);
    }
    c.strokeStyle = 'rgba(70,55,40,0.85)'; c.lineWidth = 1.6;
    for (let i = 0; i < Math.round(9 * WS); i++) {
      const x = 30 + i * 78 + rnd() * 30, h = 38 + rnd() * 30;
      c.beginPath(); c.moveTo(x, wallTopY + 2); c.lineTo(x, wallTopY - h); c.stroke();
      c.fillStyle = 'rgba(250,246,236,0.9)'; c.beginPath(); c.moveTo(x + 1, wallTopY - h + 4); c.lineTo(x + 14, wallTopY - 6); c.lineTo(x + 1, wallTopY - 6); c.fill();
    }
  } else if (T.pal === 'colline') {
    // lavender rows converging to a stone farmhouse
    for (let i = 0; i < 9; i++) {
      const y = wallTopY - 4 - i * 4;
      c.fillStyle = i % 2 ? '#7d5aa0' : '#8e6bb4'; c.fillRect(0, y, W, 4);
    }
    c.fillStyle = 'rgba(120,90,160,0.4)'; c.fillRect(0, wallTopY - 40, W, 8);
    const x = 470 + OX, y = wallTopY - 62;
    c.fillStyle = '#ead6aa'; c.fillRect(x, y, 90, 40); c.fillStyle = '#c2663c'; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 45, y - 22); c.lineTo(x + 96, y); c.fill();
    c.fillStyle = '#6b8aa6'; c.fillRect(x + 12, y + 12, 12, 18); c.fillRect(x + 62, y + 12, 12, 18);
  } else {
    // village on the hill (village / oliviers)
    const bx0 = (T.pal === 'village' ? 300 : 420) + OX;
    for (let i = 0; i < Math.round((T.pal === 'village' ? 16 : 7) * WS); i++) {
      const x = bx0 + (rnd() - 0.2) * 360 * WS, w = 30 + rnd() * 30, h = 26 + rnd() * 34, y = wallTopY - 12 - h * 0.6 - rnd() * 14;
      c.fillStyle = wall[Math.floor(rnd() * wall.length)]; c.fillRect(x, y, w, h);
      c.fillStyle = 'rgba(80,50,30,0.18)'; c.fillRect(x + w * 0.62, y, w * 0.38, h);
      c.fillStyle = roof[Math.floor(rnd() * roof.length)];
      c.beginPath(); c.moveTo(x - 3, y + 1); c.lineTo(x + w * 0.3, y - 12); c.lineTo(x + w * 0.7, y - 12); c.lineTo(x + w + 3, y + 1); c.fill();
      c.fillStyle = '#5a7ea0'; c.fillRect(x + 6, y + 10, 5, 8); if (w > 40) c.fillRect(x + w - 14, y + 10, 5, 8);
    }
    if (T.pal === 'village') {
      c.fillStyle = '#e9d5a8'; c.fillRect(430 + OX, wallTopY - 108, 22, 80); c.fillStyle = '#b0522e'; c.beginPath(); c.moveTo(427 + OX, wallTopY - 108); c.lineTo(441 + OX, wallTopY - 128); c.lineTo(455 + OX, wallTopY - 108); c.fill();
      c.fillStyle = '#4a3a2a'; c.beginPath(); c.arc(441 + OX, wallTopY - 92, 5, Math.PI, 0); c.fill();
    }
  }
  // cypress
  for (let i = 0; i < Math.round(5 * WS); i++) {
    const x = 40 + rnd() * (W - 80), h = 44 + rnd() * 40;
    c.fillStyle = 'rgba(38,62,40,0.9)'; c.beginPath(); c.ellipse(x, wallTopY - h * 0.45, 6 + rnd() * 3, h * 0.55, 0, 0, TAU); c.fill();
  }
  // the low stone wall that closes the far end
  const wg = c.createLinearGradient(0, wallTopY, 0, wallBaseY);
  wg.addColorStop(0, '#e2cfa6'); wg.addColorStop(1, '#a8906a');
  c.fillStyle = wg; c.fillRect(0, wallTopY, W, wallBaseY - wallTopY);
  c.fillStyle = '#f2e4c0'; c.fillRect(0, wallTopY - 4, W, 6);
  const rr = lcg(T.seed ^ 0x1234);
  for (let row = 0; row < 4; row++) {
    const y = wallTopY + 2 + row * ((wallBaseY - wallTopY) / 4);
    for (let x = -((row * 17) % 40); x < W; x += 34 + rr() * 22) {
      const w = 30 + rr() * 18;
      c.fillStyle = `rgba(${90 + rr() * 40},${70 + rr() * 30},${40 + rr() * 20},0.16)`;
      c.fillRect(x + 1, y + 1, w - 2, (wallBaseY - wallTopY) / 4 - 2);
    }
  }
  c.fillStyle = 'rgba(60,40,20,0.35)'; c.fillRect(0, wallBaseY - 3, W, 3);
}

// ---------------------------------------------------------------------------------------------
// the ground: a top-down colour map of the pitch, projected row by row through the camera
// Relative cost of each yield point (units of work; whole bake is roughly 8000 units).
const WORK = { macroRow: 5, projRow: 1, pebbleGen: 6, pebblePaint: 8, backdrop: 40, markings: 40 };
export const BAKE_BG = 280, BAKE_NEED = 1100;   // units per frame: pitch not needed yet / needed now
// The ground map covers world x in [MX0, MX1]: +-190 on a phone, wider on wide stages (set per bake by useBake).
const MY0 = -380, MY1 = 700;
let MX0 = -190, MX1 = 190, MS = 1.4;
function bakeRange() {
  const need = Math.ceil((W / 2 / scaleAt(MY1)) / 10) * 10 + 10;
  const mx = Math.max(190, Math.min(600, need));
  return { MX0: -mx, MX1: mx, MS: mx > 190 ? 1.0 : 1.4 };
}
const useRange = (r) => { MX0 = r.MX0; MX1 = r.MX1; MS = r.MS; };
function* bakeMacro(T) {
  const P = palOf(T), w = Math.round((MX1 - MX0) * MS), h = Math.round((MY1 - MY0) * MS);
  const cv = newCanvas(w, h); if (!cv) return null;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const seed = T.seed | 0;
  // slope grid (coarse) for hill shading
  const tmp = { hx: 0, hy: 0 };
  const GS = 4, gw = Math.ceil(w / GS) + 2, gh = Math.ceil(h / GS) + 2;
  const gx = new Float32Array(gw * gh), gy = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    slopeAt(T, MX0 + (i * GS) / MS, MY0 + (j * GS) / MS, tmp);
    gx[j * gw + i] = tmp.hx; gy[j * gw + i] = tmp.hy;
  }
  const grid = (arr, px, py) => {
    const fx = px / GS, fy = py / GS, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const a = arr[j * gw + i], b = arr[j * gw + i + 1], c2 = arr[(j + 1) * gw + i], e = arr[(j + 1) * gw + i + 1];
    return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + e) * u * v;
  };
  const treeS = P.trees;
  for (let py = 0; py < h; py++) {
    if (spent(WORK.macroRow)) yield;
    const wy = MY0 + py / MS;
    for (let px = 0; px < w; px++) {
      const wx = MX0 + px / MS;
      const n1 = vnoise(wx / 24, wy / 24, seed), n2 = vnoise(wx / 8, wy / 8, seed + 5), n3 = vnoise(wx / 2.4, wy / 2.4, seed + 9);
      let tone = 1 + 0.22 * (n1 - 0.5) + 0.12 * (n2 - 0.5) + 0.07 * (n3 - 0.5);
      let r = P.base[0], g = P.base[1], b = P.base[2];
      // patches
      let sandW = 0, clayW = 0;
      for (const q of T.patches) {
        const dx = (wx - q.x) / q.rx, dy = (wy - q.y) / q.ry, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd >= 1.15) continue;
        const wn = smoothstep(1.15, 0.55, dd + 0.18 * (n2 - 0.5));
        if (q.k === 0) sandW = Math.max(sandW, wn); else clayW = Math.max(clayW, wn);
      }
      r += (P.sand[0] - r) * sandW * 0.85; g += (P.sand[1] - g) * sandW * 0.85; b += (P.sand[2] - b) * sandW * 0.85;
      r += (P.clay[0] - r) * clayW * 0.7; g += (P.clay[1] - g) * clayW * 0.7; b += (P.clay[2] - b) * clayW * 0.7;
      // verge outside the planks
      const ax = Math.abs(wx);
      const vw = smoothstep(LANE.halfW + 4, LANE.halfW + 16, ax);
      if (vw > 0) {
        const gr = vnoise(wx / 6, wy / 6, seed + 31);
        const vr = P.verge[0] * (0.8 + 0.5 * gr), vg = P.verge[1] * (0.82 + 0.5 * gr), vb = P.verge[2] * (0.8 + 0.4 * gr);
        r += (vr - r) * vw; g += (vg - g) * vw; b += (vb - b) * vw;
      }
      // hill shading: slopes facing the sun lighten, slopes facing away darken
      const hx = grid(gx, px, py), hy = grid(gy, px, py);
      let sh = 1 + 7.5 * (hx * 0.62 - hy * 0.52);
      sh = Math.min(1.5, Math.max(0.62, sh));
      tone *= sh;
      // dappled plane-tree shade
      if (treeS > 0) {
        const edge = 0.35 + 0.65 * smoothstep(20, 150, ax);
        const m = vnoise(wx / 34 + 3, wy / 30, seed + 17) * 0.55 + vnoise(wx / 13, wy / 12, seed + 23) * 0.3 + vnoise(wx / 5, wy / 5, seed + 29) * 0.15;
        const shade = smoothstep(0.5, 0.64, m) * treeS * (0.5 + 0.5 * edge);
        const lit = smoothstep(0.42, 0.3, m) * 0.5 * treeS;
        tone *= 1 - 0.26 * shade + 0.07 * lit;
        r *= 1 - 0.1 * shade; g *= 1 - 0.05 * shade; b *= 1 + 0.03 * shade;
      }
      const o = (py * w + px) * 4;
      d[o] = Math.min(255, r * tone); d[o + 1] = Math.min(255, g * tone); d[o + 2] = Math.min(255, b * tone * (1 + (sh - 1) * -0.1)); d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function* projectRows(c, tex, res) {
  const yTop = Math.floor(project(0, MY1 - 10, 0).y);
  const step = 1 / res;
  for (let sy = yTop; sy < H; sy += step) {
    if (spent(WORK.projRow)) yield;
    const wy = groundY(sy + step * 0.5);
    if (wy < MY0 || wy > MY1) continue;
    const s = scaleAt(wy), ds = depthScale(wy);
    const xl = -CX / s, xr = (W - CX) / s;
    const sx0 = (xl - MX0) * MS, sw = (xr - xl) * MS;
    const sy0 = (wy - MY0) * MS, sh = (step / ds) * MS;
    c.drawImage(tex, Math.max(0, sx0), sy0 - sh * 0.5, Math.min(tex.width, sw), Math.max(1, sh), sx0 < 0 ? -sx0 / sw * W : 0, sy, W, step + 0.03);
  }
}

function* paintPebbles(c, T) {
  const P = palOf(T), rnd = lcg(T.seed ^ 0x5151);
  const tints = [[255, 244, 222], [236, 214, 170], [198, 174, 138], [150, 132, 106], [110, 92, 72], [78, 64, 50], [170, 150, 140], [190, 120, 86], [212, 200, 180]];
  const N = 30000;
  const items = [];
  for (let i = 0; i < N; i++) {
    const x = (rnd() * 2 - 1) * 128, y = MY0 + 40 + rnd() * (MY1 - MY0 - 90);
    items.push([x, y, 0.32 + rnd() * rnd() * 0.9, Math.floor(rnd() * tints.length), rnd(), rnd()]);
    if ((i & 2047) === 2047 && spent(WORK.pebbleGen)) yield;
  }
  items.sort((a, b) => b[1] - a[1]);
  let pn = 0;
  for (const [x, y, r, ti, ang, q] of items) {
    if ((++pn & 255) === 0 && spent(WORK.pebblePaint)) yield;
    if (Math.abs(x) > LANE.halfW + 10 && q < 0.6) continue;
    // fewer pebbles on loose sand and hard clay patches
    let skip = 0;
    for (const p of T.patches) {
      const dx = (x - p.x) / p.rx, dy = (y - p.y) / p.ry, dd = dx * dx + dy * dy;
      if (dd < 1) skip = Math.max(skip, p.k === 0 ? 0.88 * (1 - dd) + 0.1 : 0.55 * (1 - dd));
    }
    if (skip > 0 && q < skip) continue;
    const p = project(x, y, 0);
    if (p.y < project(0, MY1 - 120, 0).y || p.y > H + 10) continue;
    const ds = depthScale(y), rx = r * p.s, ry = Math.max(0.35, r * ds);
    if (rx < 0.35) continue;
    const t = tints[ti];
    // a pebble = a soft shadow below-right, the stone itself, a small highlight up-left
    c.fillStyle = 'rgba(40,26,14,0.28)'; c.beginPath(); c.ellipse(p.x + rx * 0.3, p.y + ry * 0.38, rx * 1.02, ry * 0.95, ang, 0, TAU); c.fill();
    c.fillStyle = `rgba(${t[0]},${t[1]},${t[2]},0.62)`; c.beginPath(); c.ellipse(p.x, p.y, rx, ry, ang, 0, TAU); c.fill();
    if (rx > 1.1) { c.fillStyle = 'rgba(255,250,236,0.30)'; c.beginPath(); c.ellipse(p.x - rx * 0.28, p.y - ry * 0.3, rx * 0.5, ry * 0.45, ang, 0, TAU); c.fill(); }
  }
}

function paintRock(c, st) {
  const p = project(st.x, st.y, 0), rx = st.r * p.s, ry = rx * 0.72;
  c.fillStyle = 'rgba(30,18,8,0.4)'; c.beginPath(); c.ellipse(p.x + rx * 0.5, p.y + ry * 0.45, rx * 1.15, ry * 0.9, 0, 0, TAU); c.fill();
  const g = c.createRadialGradient(p.x - rx * 0.35, p.y - ry * 0.9, rx * 0.1, p.x, p.y - ry * 0.4, rx * 1.4);
  g.addColorStop(0, '#e6e0d4'); g.addColorStop(0.5, '#9d968a'); g.addColorStop(1, '#4e4a44');
  c.fillStyle = g; c.beginPath(); c.ellipse(p.x, p.y - ry * 0.5, rx, ry * 1.05, 0, 0, TAU); c.fill();
}

// the wooden border (bordure) of the pitch: a box along each side line
function paintPlanks(c, T) {
  const P = palOf(T), y0 = -380, y1 = 668, z = 7, wd = 8;
  const quad = (pts, fill) => { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.fillStyle = fill; c.fill(); };
  for (const side of [-1, 1]) {
    const xi = side * LANE.halfW, xo = side * (LANE.halfW + wd);
    // inner face (faces the lane), top face, outer face hidden
    const inner = [project(xi, y0, 0), project(xi, y1, 0), project(xi, y1, z), project(xi, y0, z)];
    const gi = c.createLinearGradient(0, project(0, y1, 0).y, 0, H);
    gi.addColorStop(0, '#5e4428'); gi.addColorStop(1, '#4a3320');
    quad(inner, gi);
    quad([project(xi, y0, z), project(xi, y1, z), project(xo, y1, z), project(xo, y0, z)], P.plank);
    // top highlight and seams
    c.strokeStyle = 'rgba(255,236,200,0.25)'; c.lineWidth = 1.5; c.beginPath();
    const a = project(xi, y0, z), b = project(xi, y1, z); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    c.strokeStyle = 'rgba(30,18,8,0.45)'; c.lineWidth = 1.2;
    for (let y = y0 + 40; y < y1; y += 150) {
      const s1 = project(xi, y, z), s2 = project(xo, y, z), s3 = project(xi, y, 0);
      c.beginPath(); c.moveTo(s1.x, s1.y); c.lineTo(s2.x, s2.y); c.moveTo(s1.x, s1.y); c.lineTo(s3.x, s3.y); c.stroke();
    }
  }
}

function paintTrunks(c, T) {
  const P = palOf(T);
  if (T.pal === 'port' || T.pal === 'colline') return;
  const spots = T.pal === 'village' ? [[-1, 170], [1, 330], [-1, 500], [1, 90]] : [[-1, 260], [1, 440]];
  for (const [side, y] of spots) {
    const x = side * 122, r = T.pal === 'village' ? 9 : 5.5;
    const b0 = project(x - r, y, 0), b1 = project(x + r, y, 0), t0 = project(x - r, y, 400), t1 = project(x + r, y, 400);
    const g = c.createLinearGradient(b0.x, 0, b1.x, 0);
    if (T.pal === 'village') { g.addColorStop(0, '#6f6249'); g.addColorStop(0.4, '#a89a7c'); g.addColorStop(1, '#3f362a'); } else { g.addColorStop(0, '#6a5a44'); g.addColorStop(0.4, '#9c8a68'); g.addColorStop(1, '#40362a'); }
    c.fillStyle = g; c.beginPath(); c.moveTo(b0.x, b0.y); c.lineTo(b1.x, b1.y); c.lineTo(t1.x, Math.max(0, t1.y)); c.lineTo(t0.x, Math.max(0, t0.y)); c.closePath(); c.fill();
    // camouflage patches on plane bark
    if (T.pal === 'village') {
      const rr = lcg(T.seed + Math.floor(y));
      for (let i = 0; i < 24; i++) {
        const zz = 8 + rr() * 140, xx = x + (rr() - 0.5) * r * 1.6, q = project(xx, y, zz);
        c.fillStyle = rr() < 0.55 ? 'rgba(96,108,66,0.5)' : 'rgba(232,224,196,0.38)';
        c.beginPath(); c.ellipse(q.x, q.y, q.s * 3.2 * (0.6 + rr()), q.s * 2.2 * (0.6 + rr()), 0, 0, TAU); c.fill();
      }
    }
    // contact shadow at the foot
    c.fillStyle = 'rgba(40,24,10,0.35)'; c.beginPath(); c.ellipse(b0.x + (b1.x - b0.x) * 0.9, b0.y, (b1.x - b0.x) * 0.9, (b1.x - b0.x) * 0.3, 0, 0, TAU); c.fill();
  }
  // foliage hanging at the top corners
  const rr = lcg(T.seed ^ 0x99);
  const base = T.pal === 'village' ? [[70, 120, 56], [96, 148, 70], [52, 96, 48]] : [[126, 140, 100], [150, 160, 118], [96, 112, 80]];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 26; i++) {
      const x = side ? W - rr() * 190 : rr() * 190, y = rr() * (T.pal === 'village' ? 120 : 70);
      const col = base[Math.floor(rr() * 3)], r = 20 + rr() * 38;
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
      g.addColorStop(0, `rgba(${col[0] + 40},${col[1] + 40},${col[2] + 20},0.95)`); g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0.9)`);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
  }
}

function ringPts(r, a0, a1, n, clampX = LANE.halfW) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const x = Math.sin(a) * r, y = Math.cos(a) * r;
    if (Math.abs(x) > clampX) continue;
    out.push(project(x, y, 0));
  }
  return out;
}
function paintMarkings(c) {
  // the throwing circle
  const circ = [];
  for (let i = 0; i <= 48; i++) { const a = (i / 48) * TAU; circ.push(project(Math.cos(a) * 22, Math.sin(a) * 22, 0)); }
  c.lineJoin = 'round';
  const stroke = (pts, w, col) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.lineWidth = w; c.strokeStyle = col; c.stroke(); };
  stroke(circ, 6, 'rgba(40,24,10,0.35)');
  stroke(circ, 4, 'rgba(246,238,216,0.92)');
  // the valid-zone lines (5 m and 8 m)
  c.setLineDash([10, 9]);
  for (const r of [JACK_ZONE.min, JACK_ZONE.max]) {
    const pts = ringPts(r, -0.5, 0.5, 60);
    stroke(pts, 3, 'rgba(40,24,10,0.25)');
    stroke(pts, 2.2, 'rgba(250,244,226,0.55)');
  }
  c.setLineDash([]);
  c.fillStyle = 'rgba(250,244,226,0.8)'; c.font = "700 15px Georgia, 'Times New Roman', serif"; c.textAlign = 'left'; c.textBaseline = 'middle';
  for (const [r, t] of [[JACK_ZONE.min, '5 m'], [JACK_ZONE.max, '8 m']]) {
    const p = project(-LANE.halfW + 12, Math.sqrt(r * r - Math.pow(LANE.halfW - 12, 2)), 0);
    c.fillText(t, p.x, p.y - 12);
  }
}

// ---------------------------------------------------------------------------------------------
// Work-sliced bake: a generator that yields whenever the current step's WORK budget is spent, so the
// pitch can be painted a little per frame (behind the menus) instead of freezing one frame for a second.
// The budget counts units of work (macro rows, pebble batches, projected rows), never time, so the
// number of steps is the same on every device and every run.
let budget = Infinity;
const spent = (units) => { budget -= units; return budget <= 0; };
function* bakeSteps(T, res) {
  const cv = newCanvas(Math.round(W * res), Math.round(H * res));
  if (!cv) return null;
  const c = cv.getContext('2d');
  c.scale(res, res);
  paintBackdrop(c, T);
  if (spent(WORK.backdrop)) yield;
  const macro = yield* bakeMacro(T);
  if (macro) yield* projectRows(c, macro, res);
  yield* paintPebbles(c, T);
  for (const st of T.stones) paintRock(c, st);
  paintMarkings(c);
  paintPlanks(c, T);
  if (spent(WORK.markings)) yield;
  paintTrunks(c, T);
  return cv;
}
// Synchronous bake (shots, tools): runs to the end in one go.
export function bakePitch(T, res) {
  budget = Infinity;
  const keepR = { MX0, MX1, MS };
  useRange(bakeRange());
  const g = bakeSteps(T, res);
  let r = g.next();
  while (!r.done) r = g.next();
  useRange(keepR);
  return r.value;
}
// Start a sliced bake; call job.step(units) each frame until it returns the finished canvas (null while working).
export function startBake(T, res) {
  // the stage (camera) and ground range are snapshotted here; every step re-applies them, so a resize in the middle of a bake
  // (rotation) cannot corrupt it. The finished canvas carries the stage it was baked for.
  const stage = getStage(), range = bakeRange(), prev0 = { st: null };
  useRange(range);
  const g = bakeSteps(T, res);
  const job = {
    done: false, canvas: null, failed: false, stage,
    step(units) {
      if (job.done) return job.canvas;
      const keep = getStage(), keepR = { MX0, MX1, MS };
      setStage(stage); useRange(range);
      budget = units;
      try {
        const r = g.next();
        if (r.done) { job.done = true; job.canvas = r.value; if (!r.value) job.failed = true; }
      } catch (e) { job.done = true; job.failed = true; job.canvas = null; }
      budget = Infinity;
      setStage(keep); useRange(keepR);
      return job.canvas;
    },
  };
  return job;
}

// ---------------------------------------------------------------------------------------------
// sprites
const sprites = new Map();
export function invalidateArt() { sprites.clear(); }
function cached(key, w, h, paint) {
  let s = sprites.get(key);
  if (s) return s;
  const cv = newCanvas(w, h);
  if (!cv) return null;
  paint(cv.getContext('2d'), w, h);
  sprites.set(key, cv);
  return cv;
}
export const TEAM = [
  { tint: [120, 170, 235], mulA: [214, 228, 252], mulB: [128, 150, 200], skyA: '#f6fbff', skyB: '#a9c8ec', skyC: '#5f7fae', groove: '#17408a', glow: 'rgba(120,175,255,0.9)', name: 'silver-blue' },
  { tint: [226, 140, 80], mulA: [255, 222, 176], mulB: [186, 108, 54], skyA: '#fff6e6', skyB: '#e8b684', skyC: '#a8643a', groove: '#7a1f10', glow: 'rgba(255,170,100,0.9)', name: 'copper' },
];
// a chrome sphere: sky above, warm gravel below, soft horizon between, bright specular
export function bouleSprite(team) {
  return cached(`boule${team}`, 192, 192, (c, w) => {
    const r = w / 2 - 4, cx = w / 2, cy = w / 2, t = TEAM[team].tint;
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
    const TM = TEAM[team];
    const sky = c.createLinearGradient(0, cy - r, 0, cy + r * 0.1);
    sky.addColorStop(0, TM.skyA); sky.addColorStop(0.5, TM.skyB); sky.addColorStop(1, TM.skyC);
    c.fillStyle = sky; c.fillRect(0, 0, w, w);
    const gr = c.createLinearGradient(0, cy - r * 0.05, 0, cy + r);
    gr.addColorStop(0, '#d7bf92'); gr.addColorStop(0.5, '#8d7048'); gr.addColorStop(1, '#3d2e1c');
    c.save(); c.translate(cx, cy + r * 0.08); c.rotate(-0.28); c.fillStyle = gr; c.fillRect(-r * 1.5, 0, r * 3, r * 2); c.restore();
    // blur the horizon seam
    const seam = c.createLinearGradient(0, cy - r * 0.18, 0, cy + r * 0.3);
    seam.addColorStop(0, 'rgba(255,240,215,0)'); seam.addColorStop(0.5, 'rgba(255,240,215,0.5)'); seam.addColorStop(1, 'rgba(255,240,215,0)');
    c.save(); c.translate(cx, cy); c.rotate(-0.28); c.translate(-cx, -cy); c.fillStyle = seam; c.fillRect(0, cy - r * 0.2, w, r * 0.6); c.restore();
    // team tint over steel
    c.globalCompositeOperation = 'multiply';
    const ti = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    ti.addColorStop(0, `rgb(${TM.mulA.join(',')})`); ti.addColorStop(1, `rgb(${TM.mulB.join(',')})`);
    c.fillStyle = ti; c.fillRect(0, 0, w, w);
    c.globalCompositeOperation = 'source-over';
    // limb darkening
    const lim = c.createRadialGradient(cx - r * 0.18, cy - r * 0.22, r * 0.2, cx, cy, r);
    lim.addColorStop(0, 'rgba(0,0,0,0)'); lim.addColorStop(0.7, 'rgba(10,14,24,0.12)'); lim.addColorStop(1, 'rgba(6,10,20,0.62)');
    c.fillStyle = lim; c.fillRect(0, 0, w, w);
    // rim light (bounce from the sunlit gravel)
    const rim = c.createRadialGradient(cx + r * 0.55, cy + r * 0.62, r * 0.05, cx + r * 0.55, cy + r * 0.62, r * 0.55);
    rim.addColorStop(0, 'rgba(255,214,150,0.55)'); rim.addColorStop(1, 'rgba(255,214,150,0)');
    c.fillStyle = rim; c.fillRect(0, 0, w, w);
    c.restore();
    c.strokeStyle = 'rgba(8,10,16,0.55)'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, r - 1, 0, TAU); c.stroke();
  });
}
export function specularSprite() {
  return cached('spec', 96, 96, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
  });
}
export function jackSprite() {
  return cached('jack', 128, 128, (c, w) => {
    const r = w / 2 - 3, cx = w / 2, cy = w / 2;
    const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
    g.addColorStop(0, '#fff2d6'); g.addColorStop(0.18, '#ff9a5a'); g.addColorStop(0.55, '#d8321c'); g.addColorStop(1, '#6a0e08');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    const rim = c.createRadialGradient(cx + r * 0.5, cy + r * 0.6, 1, cx + r * 0.5, cy + r * 0.6, r * 0.6);
    rim.addColorStop(0, 'rgba(255,200,140,0.55)'); rim.addColorStop(1, 'rgba(255,200,140,0)');
    c.fillStyle = rim; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.ellipse(cx - r * 0.38, cy - r * 0.42, r * 0.2, r * 0.13, -0.6, 0, TAU); c.fill();
  });
}
export function dustSprite() {
  return cached('dust', 64, 64, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(236,214,172,0.85)'); g.addColorStop(0.5, 'rgba(226,200,156,0.4)'); g.addColorStop(1, 'rgba(220,192,146,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
  });
}

// ---------------------------------------------------------------------------------------------
// drawing a ball (boule or jack) at screen position p with radius rpx (all dynamic)
const VIEW = { cx: 0, cy: -Math.cos(0.9), cz: Math.sin(0.9), ux: 0, uy: Math.sin(0.9), uz: Math.cos(0.9) };
function groove(c, n, rpx, col, hi) {
  // great circle with normal n, projected on the ball; only the half facing the camera is drawn
  let hx = 1, hy = 0, hz = 0;
  if (Math.abs(n[0]) > 0.9) { hx = 0; hy = 1; }
  let e1x = n[1] * hz - n[2] * hy, e1y = n[2] * hx - n[0] * hz, e1z = n[0] * hy - n[1] * hx;
  const l = Math.hypot(e1x, e1y, e1z) || 1; e1x /= l; e1y /= l; e1z /= l;
  const e2x = n[1] * e1z - n[2] * e1y, e2y = n[2] * e1x - n[0] * e1z, e2z = n[0] * e1y - n[1] * e1x;
  for (const pass of [0, 1]) {
    c.beginPath();
    let pen = false;
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const px = e1x * ca + e2x * sa, py = e1y * ca + e2y * sa, pz = e1z * ca + e2z * sa;
      const vis = px * VIEW.cx + py * VIEW.cy + pz * VIEW.cz;
      if (vis <= 0.02) { pen = false; continue; }
      const sx = px, sy = -(px * VIEW.ux + py * VIEW.uy + pz * VIEW.uz);
      const X = sx * rpx * 0.97, Y = sy * rpx * 0.97 + (pass ? -rpx * 0.035 : 0);
      if (!pen) { c.moveTo(X, Y); pen = true; } else c.lineTo(X, Y);
    }
    c.lineWidth = Math.max(1, rpx * (pass ? 0.05 : 0.11));
    c.strokeStyle = pass ? hi : col;
    c.stroke();
  }
}
export function drawBoule(c, team, x, y, rpx, n, alpha = 1) {
  const sp = bouleSprite(team);
  if (!sp) return;
  c.save();
  c.globalAlpha = alpha;
  c.drawImage(sp, x - rpx, y - rpx, rpx * 2, rpx * 2);
  c.translate(x, y);
  c.beginPath(); c.arc(0, 0, rpx * 0.97, 0, TAU); c.clip();
  groove(c, n, rpx, TEAM[team].groove, 'rgba(255,255,255,0.45)');
  const n2 = [n[1] * 0.0 + n[2], n[0] * 0.6 - n[2] * 0.2, -n[0] * 0.8 + 0.2];
  const l = Math.hypot(n2[0], n2[1], n2[2]) || 1;
  groove(c, [n2[0] / l, n2[1] / l, n2[2] / l], rpx, TEAM[team].groove, 'rgba(255,255,255,0.35)');
  const sg = specularSprite();
  if (sg) { c.globalAlpha = alpha * 0.95; c.drawImage(sg, -rpx * 0.74, -rpx * 0.78, rpx * 0.62, rpx * 0.5); }
  c.restore();
}
export function drawJack(c, x, y, rpx, alpha = 1) {
  const sp = jackSprite();
  if (!sp) return;
  c.save(); c.globalAlpha = alpha; c.drawImage(sp, x - rpx, y - rpx, rpx * 2, rpx * 2); c.restore();
}
