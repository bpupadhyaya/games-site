// Drawing the course and the play screen. Pure drawing: it only reads `state`. The hole is drawn in its own units through one
// transform (scale, optional quarter turn, translate) so the same code serves portrait and landscape. Light comes from the
// top left of the SCREEN, so shadow offsets are turned back into hole units whenever the hole is turned.
import { W, H, LAND, SAFE, inRect, TEXT_SCALES, playLayout } from './layout.js';
import { BR, CUP_R, inZone, zoneBox, moversAt, compileHole, WALL_RAD } from './sim.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow, FLOOR } from './ui.js';
import { COURSE_BY_ID, holeById } from './courses.js';

const TAU = Math.PI * 2;
export const BALL_COLORS = [
  { base: '#f8f8f2', mid: '#d9dcd4', dot: '#2e6fd0', name: 'White' },
  { base: '#ffb561', mid: '#e58a22', dot: '#7a3d00', name: 'Orange' },
  { base: '#7fd8ff', mid: '#35a8e0', dot: '#0b4c73', name: 'Sky' },
  { base: '#ff8fb5', mid: '#e04a80', dot: '#6e0f33', name: 'Rose' },
];
const RAIL_W = 0.78;           // outer rail width (drawn outside the playing surface)

// ---- seeded decoration ----------------------------------------------------------------------------------------------------------
function lcg(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const hashStr = (str) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const decorCache = new Map();
function decorFor(h) {
  let d = decorCache.get(h.id);
  if (d) return d;
  const r = lcg(hashStr(h.id)), b = h.box;
  d = { speck: [], sand: new Map() };
  for (let i = 0; i < 260; i++) d.speck.push([b.x0 + r() * (b.x1 - b.x0), b.y0 + r() * (b.y1 - b.y0), 0.05 + r() * 0.07, r()]);
  h.sand.forEach((z, k) => {
    const zb = zoneBox(z), pts = [], area = (zb[2] - zb[0]) * (zb[3] - zb[1]);
    for (let i = 0; i < Math.min(500, area * 7); i++) { const x = zb[0] + r() * (zb[2] - zb[0]), y = zb[1] + r() * (zb[3] - zb[1]); if (inZone(z, x, y)) pts.push([x, y, r()]); }
    d.sand.set(k, pts);
  });
  decorCache.set(h.id, d);
  return d;
}

// ---- camera -----------------------------------------------------------------------------------------------------------------------
// Fit the hole into `area`; a quarter turn is used when that makes the hole bigger (with a little hysteresis so it never flickers).
export function makeCam(h, area, prefRot = 0, cover = false) {
  const b = h.box, pad = cover ? 0.4 : 1.7;
  const bw = b.x1 - b.x0 + 2 * pad, bh = b.y1 - b.y0 + 2 * pad;
  const fit = (r) => (r ? Math.min(area.w / bh, area.h / bw) : Math.min(area.w / bw, area.h / bh));
  const cov = (r) => (r ? Math.max(area.w / bh, area.h / bw) : Math.max(area.w / bw, area.h / bh));
  const f0 = cover ? cov(0) : fit(0), f1 = cover ? cov(1) : fit(1);
  let rot = prefRot;
  if (!cover) { if (f1 > f0 * 1.12) rot = 1; else if (f0 > f1 * 1.12) rot = 0; } else rot = area.w >= area.h ? 1 : 0;
  const s = rot ? f1 : f0;
  const sx = area.x + area.w / 2, sy = area.y + area.h / 2, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const ox = rot ? sx + cy * s : sx - cx * s, oy = rot ? sy - cx * s : sy - cy * s;
  const cam = {
    s, rot, ox, oy,
    m2s: (x, y) => (rot ? [ox - y * s, oy + x * s] : [ox + x * s, oy + y * s]),
    s2m: (u, v) => (rot ? [(v - oy) / s, -(u - ox) / s] : [(u - ox) / s, (v - oy) / s]),
    // a direction in hole units that points at the light, length k
    toLight: (k) => (rot ? [-0.85 * k, 0.53 * k] : [-0.53 * k, -0.85 * k]),
    dirFromScreen: (du, dv) => (rot ? [dv, -du] : [du, dv]),
  };
  return cam;
}
export const place = (ctx, cam) => { ctx.translate(cam.ox, cam.oy); if (cam.rot) ctx.rotate(Math.PI / 2); ctx.scale(cam.s, cam.s); };
const polyPath = (ctx, pts, close = true) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); if (close) ctx.closePath(); };
function zonePath(ctx, z) {
  ctx.beginPath();
  if (z.shape === 'circle') ctx.arc(z.x, z.y, z.r, 0, TAU);
  else if (z.shape === 'poly') { z.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
  else ctx.rect(z.x, z.y, z.w, z.h);
}
const feltPath = (ctx, h) => { polyPath(ctx, h.def.outer); for (const isl of h.def.islands ?? []) { ctx.moveTo(isl.pts[0][0], isl.pts[0][1]); isl.pts.forEach((p) => ctx.lineTo(p[0], p[1])); ctx.closePath(); } };

// ---- themes -----------------------------------------------------------------------------------------------------------------------
const THEMES = {
  heather: { sky0: '#2c2547', sky1: '#16301f', felt0: '#2f9e55', felt1: '#237a41', stripe: 'rgba(255,255,255,0.055)', flag: '#e04a3a', blob: ['#6a4a92', '#8a68b0', '#3f6b3a'] },
  harbour: { sky0: '#10405c', sky1: '#0a2236', felt0: '#2b9a6a', felt1: '#1f7752', stripe: 'rgba(255,255,255,0.05)', flag: '#f2c230', blob: ['#2a6f95', '#4a9ab8', '#7a8c98'] },
  mill: { sky0: '#4a4018', sky1: '#27230b', felt0: '#38a34e', felt1: '#27803a', stripe: 'rgba(255,255,255,0.06)', flag: '#2e7fd0', blob: ['#b89a30', '#d6b854', '#6f8f2e'] },
};
export const themeOf = (courseId) => THEMES[COURSE_BY_ID[courseId]?.feel ?? 'heather'];

const bgCache = new Map();
export function drawBackdrop(ctx, feel, t) {
  const th = THEMES[feel] ?? THEMES.heather;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.sky0); g.addColorStop(1, th.sky1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const key = `${feel}|${Math.round(W)}x${Math.round(H)}`;
  let blobs = bgCache.get(key);
  if (!blobs) {
    const r = lcg(hashStr(key)); blobs = [];
    for (let i = 0; i < 90; i++) blobs.push([r() * W, r() * H, 8 + r() * 46, r(), r()]);
    bgCache.set(key, blobs); if (bgCache.size > 12) bgCache.delete(bgCache.keys().next().value);
  }
  ctx.save();
  for (const [x, y, rad, a, c] of blobs) {
    const col = th.blob[Math.floor(c * th.blob.length)];
    const rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, col + '55'); rg.addColorStop(1, col + '00');
    ctx.globalAlpha = 0.35 + a * 0.4; ctx.fillStyle = rg; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  if (feel === 'harbour') {
    ctx.globalAlpha = 0.12; ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const y = (i + 0.5) * H / 14; ctx.beginPath(); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 0.8 + i) * 6); ctx.stroke(); }
  }
  ctx.restore();
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---- the course -------------------------------------------------------------------------------------------------------------------
const MAT = {
  timber: { side: '#4f3319', top: '#bd8450', hi: '#e6bd8a', w: 0.5 },
  stone: { side: '#454c52', top: '#9ba2a7', hi: '#cbd1d4', w: 0.62 },
  hedge: { side: '#143a1c', top: '#2f7a3b', hi: '#5fb865', w: 0.62 },
  rubber: { side: '#7a1d17', top: '#d9453a', hi: '#ff9a8a', w: 0.5 },
};
function strokeRail(ctx, cam, pts, closed, mat, widthMul = 1) {
  const m = MAT[mat] ?? MAT.timber, w = m.w * widthMul;
  const [sx, sy] = cam.toLight(-0.14);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.strokeStyle = m.side; ctx.lineWidth = w; ctx.save(); ctx.translate(sx, sy); polyPath(ctx, pts, closed); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = m.top; ctx.lineWidth = w; polyPath(ctx, pts, closed); ctx.stroke();
  if (mat === 'hedge') {
    ctx.strokeStyle = '#4aa855'; ctx.lineWidth = w * 0.8; ctx.setLineDash([0.01, 0.3]); polyPath(ctx, pts, closed); ctx.stroke();
    ctx.strokeStyle = m.hi; ctx.lineWidth = w * 0.35; ctx.setLineDash([0.01, 0.46]); ctx.save(); ctx.translate(cam.toLight(0.08)[0], cam.toLight(0.08)[1]); polyPath(ctx, pts, closed); ctx.stroke(); ctx.restore();
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = m.hi; ctx.lineWidth = w * 0.16; ctx.save(); ctx.translate(cam.toLight(0.1)[0], cam.toLight(0.1)[1]); polyPath(ctx, pts, closed); ctx.stroke(); ctx.restore();
    if (mat === 'stone') { ctx.strokeStyle = 'rgba(30,36,40,0.35)'; ctx.lineWidth = 0.05; ctx.setLineDash([0.9, 0.35]); polyPath(ctx, pts, closed); ctx.stroke(); ctx.setLineDash([]); }
    else if (mat === 'timber') { ctx.strokeStyle = 'rgba(60,35,12,0.28)'; ctx.lineWidth = 0.03; ctx.save(); ctx.translate(cam.toLight(0.02)[0], cam.toLight(0.02)[1]); polyPath(ctx, pts, closed); ctx.stroke(); ctx.restore(); }
  }
}
function shadowStroke(ctx, cam, pts, closed, w, k, a = 0.3) {
  const [sx, sy] = cam.toLight(-k);
  ctx.save(); ctx.translate(sx, sy); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(0,18,8,${a})`; ctx.lineWidth = w; polyPath(ctx, pts, closed); ctx.stroke(); ctx.restore();
}

function drawChevrons(ctx, z, dx, dy, t, speed, col, alpha) {
  const zb = zoneBox(z), cx = (zb[0] + zb[2]) / 2, cy = (zb[1] + zb[3]) / 2, span = Math.hypot(zb[2] - zb[0], zb[3] - zb[1]);
  const step = 1.5, off = (t * speed) % step, nx = -dy, ny = dx;
  ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = alpha; ctx.lineWidth = 0.12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let d = -span / 2 - step; d < span / 2 + step; d += step) {
    const p = d + off, px = cx + dx * p, py = cy + dy * p;
    for (let k = -span / 2; k < span / 2; k += 1.5) {
      const qx = px + nx * k, qy = py + ny * k;
      ctx.beginPath(); ctx.moveTo(qx - dx * 0.35 + nx * 0.4, qy - dy * 0.35 + ny * 0.4); ctx.lineTo(qx + dx * 0.15, qy + dy * 0.15); ctx.lineTo(qx - dx * 0.35 - nx * 0.4, qy - dy * 0.35 - ny * 0.4); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawZones(ctx, cam, h, t, th) {
  const dec = decorFor(h);
  // sand
  h.sand.forEach((z, k) => {
    ctx.save(); zonePath(ctx, z); ctx.clip();
    ctx.fillStyle = '#e6d19b'; ctx.fillRect(-100, -100, 400, 400);
    for (const [x, y, q] of dec.sand.get(k) ?? []) { ctx.fillStyle = q < 0.5 ? 'rgba(165,128,62,0.45)' : 'rgba(255,248,220,0.55)'; ctx.fillRect(x, y, 0.06, 0.06); }
    ctx.strokeStyle = 'rgba(110,80,35,0.42)'; ctx.lineWidth = 0.5; ctx.save(); ctx.translate(cam.toLight(-0.1)[0], cam.toLight(-0.1)[1]); zonePath(ctx, z); ctx.stroke(); ctx.restore();
    ctx.restore();
    zonePath(ctx, z); ctx.strokeStyle = 'rgba(150,115,55,0.7)'; ctx.lineWidth = 0.08; ctx.stroke();
  });
  // slopes
  for (const z of h.slopes) {
    ctx.save(); zonePath(ctx, z); ctx.clip();
    const zb = zoneBox(z);
    if (z.mode === 'out' || z.mode === 'in') {
      const rg = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
      if (z.mode === 'out') { rg.addColorStop(0, 'rgba(255,255,230,0.28)'); rg.addColorStop(1, 'rgba(0,30,10,0.22)'); } else { rg.addColorStop(0, 'rgba(0,30,10,0.34)'); rg.addColorStop(1, 'rgba(255,255,230,0.1)'); }
      ctx.fillStyle = rg; ctx.fillRect(zb[0], zb[1], zb[2] - zb[0], zb[3] - zb[1]);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.05;
      for (let r = 0.9; r < z.r; r += 0.9) { ctx.beginPath(); ctx.arc(z.x, z.y, r, 0, TAU); ctx.stroke(); }
      const dirSign = z.mode === 'out' ? 1 : -1, off = ((t * 0.9) % 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.1; ctx.lineCap = 'round';
      for (let a = 0; a < 8; a++) {
        const an = (a / 8) * TAU, rr = (0.3 + ((off + 0.1 * a) % 1) * 0.8) * z.r, rr2 = rr + 0.45 * dirSign;
        ctx.globalAlpha = 0.65 * (1 - Math.abs(rr / z.r - 0.5));
        ctx.beginPath(); ctx.moveTo(z.x + Math.cos(an) * rr, z.y + Math.sin(an) * rr); ctx.lineTo(z.x + Math.cos(an) * rr2, z.y + Math.sin(an) * rr2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      const m = Math.hypot(z.ax, z.ay) || 1, dx = z.ax / m, dy = z.ay / m;
      const cx = (zb[0] + zb[2]) / 2, cy = (zb[1] + zb[3]) / 2, ext = Math.hypot(zb[2] - zb[0], zb[3] - zb[1]) / 2;
      const g = ctx.createLinearGradient(cx - dx * ext, cy - dy * ext, cx + dx * ext, cy + dy * ext);
      g.addColorStop(0, 'rgba(255,255,230,0.2)'); g.addColorStop(1, 'rgba(0,30,10,0.22)');
      ctx.fillStyle = g; ctx.fillRect(zb[0], zb[1], zb[2] - zb[0], zb[3] - zb[1]);
      drawChevrons(ctx, z, dx, dy, t, 0.6 + m * 0.5, '#ffffff', 0.5);
    }
    ctx.restore();
    zonePath(ctx, z); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.05; ctx.setLineDash([0.3, 0.3]); ctx.stroke(); ctx.setLineDash([]);
  }
  // water
  for (const z of h.water) {
    ctx.save(); zonePath(ctx, z); ctx.clip();
    const zb = zoneBox(z), g = ctx.createLinearGradient(0, zb[1], 0, zb[3]);
    g.addColorStop(0, '#3d9fe0'); g.addColorStop(1, '#1b629f');
    ctx.fillStyle = g; ctx.fillRect(zb[0] - 1, zb[1] - 1, zb[2] - zb[0] + 2, zb[3] - zb[1] + 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.24)'; ctx.lineWidth = 0.05;
    for (let y = zb[1] + 0.4; y < zb[3]; y += 0.85) { ctx.beginPath(); for (let x = zb[0]; x <= zb[2] + 0.3; x += 0.35) ctx.lineTo(x, y + Math.sin(x * 2.6 + t * 1.6 + y * 1.9) * 0.1); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 9; i++) { const sx = zb[0] + ((Math.sin(i * 12.9 + 1) * 0.5 + 0.5) * (zb[2] - zb[0])), sy = zb[1] + ((Math.sin(i * 7.7 + 3) * 0.5 + 0.5) * (zb[3] - zb[1])); const tw = Math.max(0, Math.sin(t * 2 + i * 1.7)); ctx.globalAlpha = tw * 0.8; ctx.fillRect(sx, sy, 0.07, 0.07); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,30,70,0.45)'; ctx.lineWidth = 0.7; ctx.save(); ctx.translate(cam.toLight(-0.12)[0], cam.toLight(-0.12)[1]); zonePath(ctx, z); ctx.stroke(); ctx.restore();
    ctx.restore();
    zonePath(ctx, z); ctx.strokeStyle = 'rgba(235,248,255,0.55)'; ctx.lineWidth = 0.1; ctx.stroke();
  }
  // bridges
  for (const z of h.bridges) {
    const zb = zoneBox(z), wide = (zb[2] - zb[0]) >= (zb[3] - zb[1]);
    const [sx, sy] = cam.toLight(-0.3);
    ctx.save(); ctx.translate(sx, sy); zonePath(ctx, z); ctx.fillStyle = 'rgba(0,25,60,0.4)'; ctx.fill(); ctx.restore();
    ctx.save(); zonePath(ctx, z); ctx.clip();
    const g = ctx.createLinearGradient(zb[0], zb[1], zb[2], zb[3]);
    g.addColorStop(0, '#b27b44'); g.addColorStop(1, '#8c5c2e');
    ctx.fillStyle = g; ctx.fillRect(zb[0], zb[1], zb[2] - zb[0], zb[3] - zb[1]);
    ctx.strokeStyle = 'rgba(50,28,8,0.75)'; ctx.lineWidth = 0.07;
    if (wide) { for (let x = zb[0] + 0.55; x < zb[2]; x += 0.55) { ctx.beginPath(); ctx.moveTo(x, zb[1]); ctx.lineTo(x, zb[3]); ctx.stroke(); } } else { for (let y = zb[1] + 0.55; y < zb[3]; y += 0.55) { ctx.beginPath(); ctx.moveTo(zb[0], y); ctx.lineTo(zb[2], y); ctx.stroke(); } }
    ctx.strokeStyle = 'rgba(255,225,170,0.22)'; ctx.lineWidth = 0.05;
    if (wide) { for (let x = zb[0] + 0.5; x < zb[2]; x += 0.55) { ctx.beginPath(); ctx.moveTo(x, zb[1]); ctx.lineTo(x, zb[3]); ctx.stroke(); } } else { for (let y = zb[1] + 0.5; y < zb[3]; y += 0.55) { ctx.beginPath(); ctx.moveTo(zb[0], y); ctx.lineTo(zb[2], y); ctx.stroke(); } }
    ctx.restore();
  }
  // boost pads
  for (const z of h.boosts) {
    ctx.save(); zonePath(ctx, z); ctx.clip();
    const zb = zoneBox(z), g = ctx.createLinearGradient(zb[0], zb[1], zb[2], zb[3]);
    g.addColorStop(0, '#ffcf3a'); g.addColorStop(1, '#f08a1c');
    ctx.fillStyle = g; ctx.fillRect(zb[0], zb[1], zb[2] - zb[0], zb[3] - zb[1]);
    drawChevrons(ctx, z, z.dx, z.dy, t, 3, '#6a3500', 0.8);
    ctx.restore();
    zonePath(ctx, z); ctx.strokeStyle = '#7a4300'; ctx.lineWidth = 0.1; ctx.stroke();
  }
  // tunnel mouths
  h.tunnels.forEach((tn, i) => {
    const cols = [['#2fd0b5', '#0e6e60'], ['#ffb347', '#a35a00']][i % 2];
    for (const e of [tn.a, tn.b]) {
      const r = tn.r ?? 0.8;
      const [sx, sy] = cam.toLight(-0.25);
      ctx.beginPath(); ctx.arc(e.x + sx, e.y + sy, r + 0.3, 0, TAU); ctx.fillStyle = 'rgba(0,18,8,0.35)'; ctx.fill();
      const rg = ctx.createRadialGradient(e.x + cam.toLight(0.25)[0], e.y + cam.toLight(0.25)[1], 0.1, e.x, e.y, r + 0.3);
      rg.addColorStop(0, '#e8eef0'); rg.addColorStop(1, '#6b7880');
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 0.3, 0, TAU); ctx.fillStyle = rg; ctx.fill();
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 0.3, 0, TAU); ctx.strokeStyle = cols[0]; ctx.lineWidth = 0.1; ctx.stroke();
      const ig = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      ig.addColorStop(0, '#02060a'); ig.addColorStop(0.75, '#0b1a22'); ig.addColorStop(1, cols[1]);
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fillStyle = ig; ctx.fill();
      // an arrow showing where the ball comes out
      const ca = Math.cos(e.dir), sa = Math.sin(e.dir), pulse = 0.5 + 0.5 * Math.sin(t * 4);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.dir); ctx.globalAlpha = 0.55 + 0.35 * pulse; ctx.fillStyle = cols[0];
      ctx.beginPath(); ctx.moveTo(r * 0.55, 0); ctx.lineTo(r * 0.05, -r * 0.35); ctx.lineTo(r * 0.05, r * 0.35); ctx.closePath(); ctx.fill(); ctx.restore();
      void ca; void sa;
    }
  });
}

function drawTeeAndCup(ctx, cam, h, th) {
  const tee = h.tee, [lx, ly] = cam.toLight(0.1);
  ctx.save(); ctx.translate(tee.x, tee.y);
  roundPath(ctx, -1.05, -1.05, 2.1, 2.1, 0.35);
  const g = ctx.createLinearGradient(-1, -1, 1, 1); g.addColorStop(0, 'rgba(20,90,50,0.8)'); g.addColorStop(1, 'rgba(8,60,30,0.8)');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.07; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [dx, dy] of [[-0.78, -0.78], [0.78, -0.78], [-0.78, 0.78], [0.78, 0.78]]) { ctx.beginPath(); ctx.arc(dx, dy, 0.07, 0, TAU); ctx.fill(); }
  ctx.restore();
  const c = h.cup;
  ctx.beginPath(); ctx.arc(c.x, c.y, CUP_R + 0.17, 0, TAU); ctx.fillStyle = 'rgba(0,25,10,0.35)'; ctx.fill();
  ctx.beginPath(); ctx.arc(c.x, c.y, CUP_R + 0.08, 0, TAU); ctx.fillStyle = '#c9d2c0'; ctx.fill();
  const rg = ctx.createRadialGradient(c.x - lx * 0.4, c.y - ly * 0.4, 0.05, c.x, c.y, CUP_R);
  rg.addColorStop(0, '#2a2f2a'); rg.addColorStop(0.55, '#06100a'); rg.addColorStop(1, '#000');
  ctx.beginPath(); ctx.arc(c.x, c.y, CUP_R, 0, TAU); ctx.fillStyle = rg; ctx.fill();
  ctx.beginPath(); ctx.arc(c.x, c.y, CUP_R, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.04; ctx.save(); ctx.translate(lx * 0.5, ly * 0.5); ctx.stroke(); ctx.restore();
}

function drawBumper(ctx, cam, b, pulse) {
  const [sx, sy] = cam.toLight(-0.35), [lx, ly] = cam.toLight(0.4), r = b.r * (1 + 0.12 * pulse);
  ctx.beginPath(); ctx.arc(b.x + sx, b.y + sy, r + 0.12, 0, TAU); ctx.fillStyle = 'rgba(0,20,8,0.38)'; ctx.fill();
  ctx.beginPath(); ctx.arc(b.x, b.y, r + 0.18, 0, TAU); ctx.fillStyle = '#f4efe2'; ctx.fill();
  const rg = ctx.createRadialGradient(b.x + lx * b.r * 0.9, b.y + ly * b.r * 0.9, 0.05, b.x, b.y, r);
  rg.addColorStop(0, '#ffb09a'); rg.addColorStop(0.45, '#e5483a'); rg.addColorStop(1, '#8f1d16');
  ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fillStyle = rg; ctx.fill();
  ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.55, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.07; ctx.stroke();
  ctx.beginPath(); ctx.arc(b.x + lx * b.r * 0.55, b.y + ly * b.r * 0.55, r * 0.2, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill();
}
function drawPost(ctx, cam, p) {
  const [sx, sy] = cam.toLight(-0.3), [lx, ly] = cam.toLight(0.3);
  ctx.beginPath(); ctx.arc(p.x + sx, p.y + sy, p.r + 0.1, 0, TAU); ctx.fillStyle = 'rgba(0,20,8,0.35)'; ctx.fill();
  const rg = ctx.createRadialGradient(p.x + lx * p.r, p.y + ly * p.r, 0.05, p.x, p.y, p.r);
  rg.addColorStop(0, '#d0d5d8'); rg.addColorStop(1, '#6d757b');
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fillStyle = rg; ctx.fill();
  ctx.strokeStyle = 'rgba(30,36,40,0.5)'; ctx.lineWidth = 0.05; ctx.stroke();
}
function drawMovers(ctx, cam, h, t, shadow) {
  const mv = moversAt(h, t);
  const [sx, sy] = cam.toLight(-0.55);
  if (shadow) {
    ctx.save(); ctx.translate(sx, sy); ctx.lineCap = 'round';
    for (const c of mv.caps) { ctx.strokeStyle = 'rgba(0,18,8,0.26)'; ctx.lineWidth = c.kind === 'blade' ? 0.9 : c.rad * 2; ctx.beginPath(); ctx.moveTo(c.ax, c.ay); ctx.lineTo(c.bx, c.by); ctx.stroke(); }
    for (const d of mv.discs) { ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 0.1, 0, TAU); ctx.fillStyle = 'rgba(0,18,8,0.28)'; ctx.fill(); }
    ctx.restore();
    return;
  }
  for (const c of mv.caps) {
    if (c.kind === 'blade') {
      const dx = c.bx - c.ax, dy = c.by - c.ay, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#6a4423'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(c.ax, c.ay); ctx.lineTo(c.bx, c.by); ctx.stroke();
      ctx.strokeStyle = '#d2a56a'; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.moveTo(c.ax, c.ay); ctx.lineTo(c.bx, c.by); ctx.stroke();
      // sail
      const a0 = 0.8, a1 = L - 0.1, wS = 0.85;
      ctx.beginPath();
      ctx.moveTo(c.ax + ux * a0, c.ay + uy * a0); ctx.lineTo(c.ax + ux * a1, c.ay + uy * a1);
      ctx.lineTo(c.ax + ux * a1 + nx * wS * 0.9, c.ay + uy * a1 + ny * wS * 0.9); ctx.lineTo(c.ax + ux * a0 + nx * wS, c.ay + uy * a0 + ny * wS); ctx.closePath();
      ctx.fillStyle = '#f3ead2'; ctx.fill(); ctx.strokeStyle = '#8b6a3a'; ctx.lineWidth = 0.05; ctx.stroke();
      ctx.strokeStyle = 'rgba(120,90,50,0.5)'; ctx.lineWidth = 0.03;
      for (let k = a0 + 0.4; k < a1; k += 0.4) { ctx.beginPath(); ctx.moveTo(c.ax + ux * k, c.ay + uy * k); ctx.lineTo(c.ax + ux * k + nx * wS * 0.95, c.ay + uy * k + ny * wS * 0.95); ctx.stroke(); }
    } else {
      const dx = c.bx - c.ax, dy = c.by - c.ay;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#5b3a1c'; ctx.lineWidth = c.rad * 2 + 0.16; ctx.beginPath(); ctx.moveTo(c.ax, c.ay); ctx.lineTo(c.bx, c.by); ctx.stroke();
      ctx.strokeStyle = '#f1ecdc'; ctx.lineWidth = c.rad * 2; ctx.beginPath(); ctx.moveTo(c.ax, c.ay); ctx.lineTo(c.bx, c.by); ctx.stroke();
      ctx.strokeStyle = '#d2392b'; ctx.lineWidth = c.rad * 2; ctx.setLineDash([0.45, 0.45]); ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(c.ax, c.ay); ctx.lineTo(c.bx, c.by); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.04; const [lx, ly] = cam.toLight(0.07); ctx.beginPath(); ctx.moveTo(c.ax + lx, c.ay + ly); ctx.lineTo(c.bx + lx, c.by + ly); ctx.stroke();
      void dx; void dy;
    }
  }
  for (const d of mv.discs) {
    const [lx, ly] = cam.toLight(0.3);
    const rg = ctx.createRadialGradient(d.x + lx, d.y + ly, 0.05, d.x, d.y, d.r);
    rg.addColorStop(0, '#f1e3c6'); rg.addColorStop(1, '#7c5a30');
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fillStyle = rg; ctx.fill(); ctx.strokeStyle = '#3f2a12'; ctx.lineWidth = 0.06; ctx.stroke();
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 0.35, 0, TAU); ctx.fillStyle = '#c9a15a'; ctx.fill();
  }
}

// The whole course, in hole units, under the camera transform. `fx`: { bump: {index:t}, ... } from the state.
export function drawCourse(ctx, h, cam, t, theme, fx = {}) {
  const def = h.def, th = theme;
  ctx.save(); place(ctx, cam);
  // 1. the outer rail: drawn wide, the felt covers its inner half
  const [osx, osy] = cam.toLight(-0.5);
  ctx.save(); ctx.translate(osx, osy); ctx.lineJoin = 'round'; polyPath(ctx, def.outer); ctx.strokeStyle = 'rgba(0,12,6,0.45)'; ctx.lineWidth = RAIL_W * 2 + 0.2; ctx.stroke(); ctx.restore();
  strokeRail(ctx, cam, def.outer, true, def.railMat ?? 'timber', RAIL_W * 2 / (MAT[def.railMat ?? 'timber'].w));
  // 2. felt
  ctx.save();
  feltPath(ctx, h); ctx.clip('evenodd');
  const b = h.box, g = ctx.createLinearGradient(b.x0, b.y0, b.x1, b.y1);
  g.addColorStop(0, th.felt0); g.addColorStop(1, th.felt1);
  ctx.fillStyle = g; ctx.fillRect(b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4);
  // mowing stripes along the hole
  ctx.fillStyle = th.stripe;
  for (let x = Math.floor(b.x0); x < b.x1; x += 2) ctx.fillRect(x, b.y0 - 1, 1, b.y1 - b.y0 + 2);
  const dec = decorFor(h);
  for (const [x, y, s, q] of dec.speck) { ctx.fillStyle = q < 0.5 ? 'rgba(0,40,12,0.10)' : 'rgba(210,255,200,0.08)'; ctx.fillRect(x, y, s * 1.6, s); }
  // 3. surfaces
  drawZones(ctx, cam, h, t, th);
  drawTeeAndCup(ctx, cam, h, th);
  // 4. shadows cast by everything standing up, and the soft edge shadow of the rail
  ctx.strokeStyle = 'rgba(0,18,8,0.34)'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; polyPath(ctx, def.outer); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,18,8,0.22)'; ctx.lineWidth = 3; polyPath(ctx, def.outer); ctx.stroke();
  for (const isl of def.islands ?? []) { shadowStroke(ctx, cam, isl.pts, true, 1.2, 0.45, 0.3); }
  for (const w of def.walls ?? []) shadowStroke(ctx, cam, w.pts, !!w.closed, 0.7, 0.42, 0.3);
  for (const p of [...(def.posts ?? [])]) { void p; }
  if (h.hasMovers) drawMovers(ctx, cam, h, t, true);
  ctx.restore();
  // 5. bodies
  for (const isl of def.islands ?? []) {
    const m = MAT[isl.mat ?? 'stone'];
    polyPath(ctx, isl.pts); const ig = ctx.createLinearGradient(0, 0, 0, 20); ig.addColorStop(0, m.top); ig.addColorStop(1, m.side);
    ctx.fillStyle = m.top; ctx.fill();
    ctx.save(); polyPath(ctx, isl.pts); ctx.clip();
    const rg = ctx.createRadialGradient(isl.pts[0][0], isl.pts[0][1], 0.1, isl.pts[0][0], isl.pts[0][1], 12);
    void ig; void rg;
    ctx.restore();
    strokeRail(ctx, cam, isl.pts, true, isl.mat ?? 'stone', 1.1);
    // a lit top face
    ctx.save(); polyPath(ctx, isl.pts); ctx.clip();
    let cx = 0, cy = 0; isl.pts.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= isl.pts.length; cy /= isl.pts.length;
    const [lx, ly] = cam.toLight(1.2);
    const g2 = ctx.createRadialGradient(cx + lx, cy + ly, 0.2, cx, cy, 6);
    g2.addColorStop(0, 'rgba(255,255,255,0.28)'); g2.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = g2; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.restore();
  }
  for (const w of def.walls ?? []) strokeRail(ctx, cam, w.pts, !!w.closed, w.mat ?? 'timber', 1);
  for (const p of def.posts ?? []) drawPost(ctx, cam, p);
  h.circles.filter((c) => c.kind === 'bumper').forEach((c, i) => drawBumper(ctx, cam, c, Math.max(0, 1 - ((fx.bump?.[i] ?? 9) * 4))));
  if (h.hasMovers) drawMovers(ctx, cam, h, t, false);
  // rail corner studs
  ctx.fillStyle = '#e9cf7c';
  const outer = def.outer;
  for (let i = 0; i < outer.length; i++) { const p = outer[i], q = outer[(i + 1) % outer.length], pr = outer[(i + outer.length - 1) % outer.length]; const a1 = Math.atan2(p[1] - pr[1], p[0] - pr[0]), a2 = Math.atan2(q[1] - p[1], q[0] - p[0]); if (Math.abs(Math.sin(a2 - a1)) > 0.3) { ctx.beginPath(); ctx.arc(p[0], p[1], 0.13, 0, TAU); ctx.fill(); } }
  ctx.restore();
}

// ---- balls and effects ----------------------------------------------------------------------------------------------------------
export function drawBall(ctx, cam, b, color, opts = {}) {
  const r = BR, sunk = b.mode === 'sunk' ? Math.min(1, b.sink / 0.5) : 0, s = 1 - 0.55 * sunk, alpha = 1 - 0.7 * sunk;
  const [sx, sy] = cam.toLight(-0.2), [lx, ly] = cam.toLight(0.45);
  ctx.save(); ctx.globalAlpha = (opts.alpha ?? 1) * alpha;
  if (!sunk) { ctx.beginPath(); ctx.ellipse(b.x + sx, b.y + sy, r * 0.98, r * 0.9, 0, 0, TAU); ctx.fillStyle = 'rgba(0,20,8,0.42)'; ctx.fill(); }
  const rr = r * s;
  const rg = ctx.createRadialGradient(b.x + lx * r, b.y + ly * r, rr * 0.05, b.x, b.y, rr);
  rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.25, color.base); rg.addColorStop(1, color.mid);
  ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, TAU); ctx.fillStyle = rg; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.03; ctx.stroke();
  // a mark that rolls with the ball so the motion reads
  const hd = b.hd ?? 0, ph = b.rot ?? 0, front = Math.cos(ph);
  if (front > -0.2) {
    const off = Math.sin(ph) * rr * 0.62;
    ctx.beginPath(); ctx.ellipse(b.x + Math.cos(hd) * off, b.y + Math.sin(hd) * off, rr * 0.2 * (0.5 + 0.5 * front), rr * 0.2, hd, 0, TAU);
    ctx.fillStyle = color.dot; ctx.globalAlpha *= 0.85; ctx.fill();
  }
  ctx.restore();
}
export function drawFlag(ctx, cam, h, th, t, near) {
  const [cx, cy] = cam.m2s(h.cup.x, h.cup.y), s = cam.s, len = Math.max(36, 3.1 * s), sway = Math.sin(t * 1.7) * 0.06;
  ctx.save(); ctx.globalAlpha = near ? 0.35 : 1;
  const [sx, sy] = cam.toLight(-1);
  const ds = cam.rot ? [0.85 * s * 0.0, 0] : [0, 0]; void ds;
  // pole shadow on the felt
  ctx.strokeStyle = 'rgba(0,20,8,0.35)'; ctx.lineWidth = Math.max(2, 0.1 * s); ctx.lineCap = 'round';
  const [px, py] = cam.m2s(h.cup.x + sx * 1.2, h.cup.y + sy * 1.2);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
  // pole
  const tx = cx + Math.sin(sway) * len, ty = cy - len;
  ctx.strokeStyle = '#f2f2ec'; ctx.lineWidth = Math.max(2.2, 0.11 * s); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty); ctx.stroke();
  // pennant
  const fw = Math.max(16, 1.45 * s), fh = Math.max(11, 0.95 * s), wave = Math.sin(t * 5) * 0.12 * fh;
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + fw * 0.5, ty + fh * 0.15 + wave, tx + fw, ty + fh * 0.5 + wave * 1.4); ctx.quadraticCurveTo(tx + fw * 0.5, ty + fh * 0.85 - wave, tx, ty + fh); ctx.closePath();
  ctx.fillStyle = th.flag; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

export function drawParts(ctx, cam, parts) {
  for (const q of parts) {
    const k = q.t / q.max, a = 1 - k;
    if (q.kind === 0) { ctx.globalAlpha = a; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * 0.05 * (1 - k * 0.5), 0, TAU); ctx.fill(); }
    else if (q.kind === 2) { ctx.globalAlpha = a * 0.8; ctx.strokeStyle = q.col; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.2 + k * 0.8), 0, TAU); ctx.stroke(); }
    else if (q.kind === 3) { ctx.globalAlpha = Math.min(1, a * 2); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.t * q.spin); ctx.fillStyle = q.col; ctx.fillRect(-0.12, -0.06, 0.24, 0.12); ctx.restore(); }
    else if (q.kind === 4) { ctx.globalAlpha = a * 0.5; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.2 + k * 0.5), 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

// ---- the aim ----------------------------------------------------------------------------------------------------------------------
export function drawGuide(ctx, cam, guide, t) {
  if (!guide || !guide.pts || guide.pts.length < 2) return;
  const pts = guide.pts;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  polyPath(ctx, pts, false); ctx.strokeStyle = 'rgba(0,25,10,0.5)'; ctx.lineWidth = 0.2; ctx.setLineDash([0.22, 0.4]); ctx.lineDashOffset = -t * 1.4; ctx.stroke();
  polyPath(ctx, pts, false); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 0.13; ctx.stroke();
  ctx.setLineDash([]);
  const e = guide.end;
  if (e) {
    ctx.beginPath(); ctx.arc(e.x, e.y, BR * 0.9, 0, TAU); ctx.strokeStyle = guide.hitWall ? 'rgba(255,214,120,0.95)' : 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.09; ctx.stroke();
    ctx.beginPath(); ctx.arc(e.x, e.y, BR * 0.9, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
  }
  ctx.restore();
}
export function drawPowerRing(ctx, cam, bx, by, pow, ang) {
  const [x, y] = cam.m2s(bx, by), R0 = Math.max(22, cam.s * 0.95);
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
  ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,20,10,0.5)'; ctx.beginPath(); ctx.arc(0, 0, R0, 0, TAU); ctx.stroke();
  const col = pow < 0.5 ? '#7be38a' : pow < 0.8 ? '#ffd24a' : '#ff6a4a';
  ctx.lineWidth = 5.5; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(0, 0, R0, -Math.PI / 2, -Math.PI / 2 + TAU * pow); ctx.stroke();
  ctx.restore();
  void ang;
}

// ---- HUD ----------------------------------------------------------------------------------------------------------------------------
const fit = (ctx, text, maxW, size, weight = 700) => {
  let px = size; ctx.font = `${weight} ${px}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && px > FLOOR) { px -= 1; ctx.font = `${weight} ${px}px ${FONT}`; }
  return px;
};
export const parLabel = (d) => (d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`);
export const scoreName = (strokes, par) => {
  if (strokes === 1 && par > 1) return 'Hole in one!';
  const d = strokes - par;
  return d <= -3 ? 'Albatross!' : d === -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : `+${d}`;
};

export function drawHud(ctx, state, lay) {
  const m = state.m, hd = lay.hud, fs = hd.fs;
  const def = m.holes[m.idx], course = COURSE_BY_ID[def.course];
  panel(ctx, hd.x + 8, hd.y, hd.w - 16, hd.h - 4, { r: 20, fill: 'rgba(6,28,18,0.82)', stroke: 'rgba(150,215,170,0.35)', shadow: false });
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const pad = 22, x0 = hd.x + 8 + pad, innerW = hd.w - 16 - 2 * pad;
  // line 1: hole name and par
  ctx.fillStyle = '#f6fbf1';
  const t1 = `${def.name}`, p1 = fit(ctx, t1, innerW * 0.62, Math.round(fs * 1.12));
  ctx.fillText(t1, x0, hd.y + 14 + p1 * 0.95);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffd97a';
  const t2 = `Par ${def.par}`; fit(ctx, t2, innerW * 0.34, Math.round(fs * 1.12)); ctx.fillText(t2, x0 + innerW, hd.y + 14 + p1 * 0.95);
  // line 2: course, hole number
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(200,230,205,0.9)';
  const t3 = `${course.name}  ·  Hole ${m.idx + 1} of ${m.holes.length}`, p3 = fit(ctx, t3, innerW, Math.round(fs * 0.8), 500);
  ctx.fillText(t3, x0, hd.y + 14 + p1 * 1.05 + p3 * 1.15);
  // player chips
  const n = m.players.length, perRow = Math.max(1, Math.floor((hd.w - 24) / (fs * 9.2))), chipW = (innerW - (perRow - 1) * 8) / Math.min(perRow, n);
  const cy0 = hd.y + 14 + p1 * 1.05 + p3 * 1.15 + 12, chipH = fs * 1.75;
  m.players.forEach((p, i) => {
    const row = Math.floor(i / perRow), col = i % perRow, x = x0 + col * (chipW + 8), y = cy0 + row * (chipH + 6);
    const cur = i === m.cur && !m.holeDone;
    roundPath(ctx, x, y, chipW, chipH, chipH / 2); ctx.fillStyle = cur ? 'rgba(240,194,74,0.22)' : 'rgba(255,255,255,0.07)'; ctx.fill();
    ctx.strokeStyle = cur ? '#f0c24a' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = cur ? 3 : 1.5; ctx.stroke();
    const bc = BALL_COLORS[i % 4], br = chipH * 0.3;
    const rg = ctx.createRadialGradient(x + chipH / 2 - br * 0.3, y + chipH / 2 - br * 0.3, br * 0.1, x + chipH / 2, y + chipH / 2, br);
    rg.addColorStop(0, '#fff'); rg.addColorStop(0.3, bc.base); rg.addColorStop(1, bc.mid);
    ctx.beginPath(); ctx.arc(x + chipH / 2, y + chipH / 2, br, 0, TAU); ctx.fillStyle = rg; ctx.fill();
    const strokes = state.balls[i] ? state.balls[i].strokes : 0;
    const tot = m.totals[i] ?? 0, played = m.parSoFar;
    ctx.textAlign = 'left'; ctx.fillStyle = '#f6fbf1';
    const nm = p.name, label = `${nm}`, avail = chipW - chipH - 10 - fs * 3.6;
    fit(ctx, label, Math.max(40, avail), Math.round(fs * 0.86));
    ctx.fillText(label, x + chipH + 2, y + chipH / 2 + fs * 0.3);
    ctx.textAlign = 'right'; ctx.font = `700 ${Math.round(fs * 0.86)}px ${FONT}`;
    const done = state.balls[i] && state.balls[i].done;
    ctx.fillStyle = done ? '#9fe9b0' : '#f6fbf1';
    ctx.fillText(`${strokes}${done ? '✓' : ''}`, x + chipW - fs * 1.6, y + chipH / 2 + fs * 0.3);
    ctx.fillStyle = '#ffd97a'; ctx.font = `600 ${Math.round(fs * 0.78)}px ${FONT}`;
    ctx.fillText(parLabel(tot - played), x + chipW - 12, y + chipH / 2 + fs * 0.3);
  });
}

export function cardRectFor(state, lay) {
  const fs = Math.round(Math.min(lay.fs, 38) * 0.9);
  if (lay.land && lay.zone.h > fs * 6) { const w = lay.zone.w - 24; return { x: lay.zone.x + 12, y: lay.zone.y + 8, w, h: Math.min(lay.zone.h - 16, fs * 6.8), fs, side: true }; }
  const w = Math.min(lay.sheet.w - 24, 620);
  const lift = state.m && state.m.cfg.mode === 'watch' ? Math.round(34 * lay.s) : 0;   // keep clear of the Watch & Learn caption under the sheet
  return { x: lay.sheet.x + (lay.sheet.w - w) / 2, y: lay.sheet.y + lay.sheet.h - 12 - lift - fs * 5.2, w, h: fs * 5.2, fs };
}
function drawCard(ctx, state, lay) {
  const k = state.card ?? tipCard(state, lay);
  if (!k) return;
  const r = cardRectFor(state, lay);
  if (r.side && !state.card) { ctx.font = `400 ${Math.round(r.fs * 0.8)}px ${FONT}`; const n = wrapLines(ctx, k.text, r.w - 32).length; r.h = Math.min(r.h, r.fs * 2.7 + n * r.fs * 0.95 + 8); }
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(250,247,232,0.96)', stroke: 'rgba(120,90,30,0.7)' });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `800 ${r.fs}px ${FONT}`; ctx.fillText(k.title, r.x + 16, r.y + r.fs * 1.3);
  ctx.fillStyle = C.ink; ctx.font = `400 ${Math.round(r.fs * 0.8)}px ${FONT}`;
  ctx.font = `400 ${Math.round(r.fs * 0.8)}px ${FONT}`;
  const all = wrapLines(ctx, k.text, r.w - 32), maxL = Math.max(2, Math.floor((r.h - r.fs * 2.7) / (r.fs * 0.95)));
  const lines = all.slice(0, maxL);
  lines.forEach((l, i) => ctx.fillText(l + (i === maxL - 1 && all.length > maxL ? '…' : ''), r.x + 16, r.y + r.fs * 2.35 + i * r.fs * 0.95));
  if (state.card) { ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(30,60,40,0.6)'; ctx.font = `600 ${Math.round(r.fs * 0.6)}px ${FONT}`; ctx.fillText('tap for more', r.x + r.w - 14, r.y + r.h - 8); }
}

// In landscape the empty part of the side panel shows the hole's tip while there is no Think or Watch & Learn card.
function tipCard(state, lay) {
  if (!lay.land || state.holeEnd || lay.zone.h < lay.fs * 7) return null;
  const def = state.m.holes[state.m.idx];
  return { title: 'Hole tip', text: def.tip };
}

// Labels of the control buttons.
export function controlLabel(id, state) {
  const m = state.m;
  switch (id) {
    case 'think': return state.hintBusy ? 'Thinking…' : 'Think';
    case 'putt': return 'Putt';
    case 'menu': return 'Menu';
    case 'pause': return state.paused ? 'Resume' : 'Pause';
    case 'fast': return state.ff ? 'Speed ×1' : 'Speed ×2';
    case 'next': return m.idx >= m.holes.length - 1 ? 'See results' : 'Next hole';
    case 'dec': return 'Think −';
    case 'inc': return 'Think +';
    case 'exit': return 'Exit';
    default: return id;
  }
}
export const CONTROL_SETS = {
  aim: ['think', 'putt', 'menu'],
  roll: ['pause', 'fast'],
  wait: ['menu', 'fast'],
  next: ['next', 'menu'],
  watch: ['pause', 'dec', 'inc', 'exit'],
  watchNext: ['pause', 'exit'],
};
export function controlKind(state) {
  const m = state.m;
  if (m.cfg.mode === 'watch') return state.holeEnd ? 'watchNext' : 'watch';
  if (state.holeEnd) return 'next';
  if (state.phase === 'roll') return 'roll';
  if (state.humanTurn && state.phase === 'aim') return 'aim';
  return 'wait';
}
export function layoutFor(state) {
  const kind = controlKind(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  return playLayout(sc, CONTROL_SETS[kind], state.m.players.length);
}
export const camFor = (state, lay) => {
  const h = compileHole(state.m.holes[state.m.idx]);
  const cam = makeCam(h, lay.sheet, state.camRot ?? 0);
  return cam;
};

// ---- the play screen --------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const m = state.m, def = m.holes[m.idx], h = compileHole(def), th = themeOf(def.course);
  const lay = layoutFor(state);
  state.lay = lay;
  const cam = camFor(state, lay);
  state.camRot = cam.rot;
  state.cam = cam;
  drawBackdrop(ctx, COURSE_BY_ID[def.course].feel, state.t);
  // the hole
  drawCourse(ctx, h, cam, state.clock, th, state.fx);
  ctx.save(); place(ctx, cam);
  const order = state.balls.map((b, i) => i).sort((a, b2) => (a === m.cur ? 1 : 0) - (b2 === m.cur ? 1 : 0));
  // the tunnel pulse and ball trails
  for (const i of order) { const b = state.balls[i]; if (b.done && b.sunkShown >= 1) continue; drawTrail(ctx, b, BALL_COLORS[i % 4]); }
  if (state.scene === 'play' && state.phase === 'aim' && !state.holeEnd) {
    const cb = state.balls[m.cur];
    if (cb && state.aim.placed && !cb.done) { drawGuide(ctx, cam, state.guide, state.t); }
  }
  for (const i of order) { const b = state.balls[i]; if (b.done && b.sunkShown >= 1) continue; drawBall(ctx, cam, b.ball, BALL_COLORS[i % 4], { alpha: i === m.cur || m.players.length === 1 ? 1 : 0.9 }); }
  drawParts(ctx, cam, state.parts);
  ctx.restore();
  const cb = state.balls[m.cur];
  const nearBall = cb && Math.hypot(cb.ball.x - h.cup.x, cb.ball.y - h.cup.y) < 2.4;
  drawFlag(ctx, cam, h, th, state.t, nearBall);
  // slingshot band and power ring (screen space)
  if (state.drag && state.drag.on && cb && !cb.done) {
    const [bx, by] = cam.m2s(cb.ball.x, cb.ball.y);
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.setLineDash([2, 9]);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(state.drag.px, state.drag.py); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(state.drag.px, state.drag.py, 13, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }
  if (cb && state.aim.placed && state.phase === 'aim' && !state.holeEnd && !cb.done) {
    drawPowerRing(ctx, cam, cb.ball.x, cb.ball.y, state.aim.pow, state.aim.ang);
    const [bx, by] = cam.m2s(cb.ball.x, cb.ball.y);
    ctx.save(); ctx.font = `800 ${Math.max(FLOOR, 22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    textShadow(ctx, `${Math.round(state.aim.pow * 100)}%`, bx, by - Math.max(22, cam.s * 0.95) - 12, '#ffffff', 5); ctx.restore();
  }
  drawHud(ctx, state, lay);
  // pops
  for (const p of state.pops) {
    const [px, py] = cam.m2s(p.x, p.y), k = p.t / p.max, sc = k < 0.15 ? 0.6 + k * 2.6 : 1;
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2.2); ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(p.size * sc)}px ${FONT}`;
    textShadow(ctx, p.text, px, py - k * 50, p.col, 6); ctx.restore();
  }
  drawCard(ctx, state, lay);
  // toast
  if (state.toastT > 0 && state.toast) {
    ctx.save(); const fs = Math.max(FLOOR, Math.round(Math.min(lay.fs, 36) * 0.85)); ctx.font = `700 ${fs}px ${FONT}`;
    const maxW = Math.min(lay.sheet.w - 24, 640), lines = wrapLines(ctx, state.toast, maxW - 40), tw = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40), th2 = lines.length * fs * 1.25 + 20;
    const x = lay.sheet.x + (lay.sheet.w - tw) / 2, y = lay.sheet.y + 10;
    ctx.globalAlpha = Math.min(1, state.toastT * 2);
    roundPath(ctx, x, y, tw, th2, 16); ctx.fillStyle = 'rgba(6,30,18,0.88)'; ctx.fill(); ctx.strokeStyle = 'rgba(150,215,170,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#f6fbf1'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, x + tw / 2, y + 10 + fs * (0.95 + i * 1.25)));
    ctx.restore();
  }
  drawHoleEnd(ctx, state, lay);
  // controls
  const kind = controlKind(state), ids = CONTROL_SETS[kind];
  const sc = lay.s;
  ids.forEach((id) => {
    const r = lay.ctrl[id]; if (!r) return;
    const disabled = (id === 'putt' && !state.aim.placed) || (id === 'think' && state.hintBusy);
    drawButton(ctx, r, controlLabel(id, state), { primary: id === 'putt' || id === 'next', active: (id === 'pause' && state.paused) || (id === 'fast' && state.ff), dark: id === 'menu' || id === 'exit', disabled, size: Math.round(26 * sc) });
  });
  if (kind === 'watch' || kind === 'watchNext') {
    ctx.save(); ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(24 * sc)}px ${FONT}`; ctx.fillStyle = '#ffd97a';
    const first = lay.ctrl.pause; const label = state.wlabel || 'Watch & Learn';
    const fs2 = fit(ctx, label, lay.box.w - 30, Math.round(24 * sc)); void fs2;
    textShadow(ctx, label, lay.box.x + lay.box.w / 2, first.y - 12, '#ffd97a', 5); ctx.restore();
  }
  // timing glow on the Putt button when Think found a waiting moment
}
function drawTrail(ctx, b, color) {
  if (!b.trail || b.trail.length < 2) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 1; i < b.trail.length; i++) {
    const a = i / b.trail.length;
    ctx.strokeStyle = color.base; ctx.globalAlpha = a * 0.28; ctx.lineWidth = BR * 1.1 * a;
    ctx.beginPath(); ctx.moveTo(b.trail[i - 1][0], b.trail[i - 1][1]); ctx.lineTo(b.trail[i][0], b.trail[i][1]); ctx.stroke();
  }
  ctx.restore();
}
function drawHoleEnd(ctx, state, lay) {
  if (!state.holeEnd) return;
  const m = state.m, he = state.holeEnd, def = m.holes[m.idx];
  const s = Math.min(1, he.t * 3.2), ease = 1 - Math.pow(1 - s, 3);
  const fs = Math.round(Math.min(lay.fs, 40) * 1.0);
  const w = Math.min(lay.sheet.w - 24, 620), rows = m.players.length;
  const h = fs * 2.8 + rows * fs * 1.45 + 24, x = lay.sheet.x + (lay.sheet.w - w) / 2, y = lay.sheet.y + (lay.sheet.h - h) / 2;
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(0.8 + 0.2 * ease, 0.8 + 0.2 * ease); ctx.globalAlpha = ease; ctx.translate(-(x + w / 2), -(y + h / 2));
  panel(ctx, x, y, w, h, { r: 26, fill: 'rgba(246,249,236,0.97)', stroke: 'rgba(40,110,60,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const best = he.lead;
  ctx.fillStyle = C.terraDark; ctx.font = `800 ${Math.round(fs * 1.5)}px ${FONT}`;
  fit(ctx, he.title, w - 40, Math.round(fs * 1.5), 800);
  ctx.fillText(he.title, x + w / 2, y + fs * 1.5);
  ctx.fillStyle = C.ink; ctx.font = `500 ${Math.round(fs * 0.72)}px ${FONT}`; ctx.fillText(`${def.name} · Par ${def.par}`, x + w / 2, y + fs * 2.3);
  m.players.forEach((p, i) => {
    const yy = y + fs * 2.9 + i * fs * 1.45, res = he.results[i];
    const bc = BALL_COLORS[i % 4];
    ctx.beginPath(); ctx.arc(x + 34, yy - fs * 0.3, fs * 0.42, 0, TAU); ctx.fillStyle = bc.mid; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `700 ${Math.round(fs * 0.85)}px ${FONT}`; ctx.fillText(p.name, x + 34 + fs * 0.7, yy);
    ctx.textAlign = 'right'; ctx.fillText(`${res.strokes}  ${res.name}`, x + w - 24, yy);
    if (i === best) { ctx.fillStyle = '#c47d12'; ctx.fillText('★', x + w - 24 - ctx.measureText(`${res.strokes}  ${res.name}`).width - 10, yy); }
  });
  ctx.restore();
}
