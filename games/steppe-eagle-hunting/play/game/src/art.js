// All the drawing for Steppe Eagle Hunting: dawn sky and mountains, the snow steppe in perspective, the den, the fox silhouette, the golden
// eagle (perched, flying, stooping), the rider's glove, snow particles and the diagrams on the Rules pages. Pure canvas 2D, no DOM.
//
// World to screen: the camera sits at (cam.x, cam.z) and looks along +z. `geom(w, h)` gives the horizon and the pixels per metre.
// A ground point at depth zr = z - cam.z has perspective factor k = Z0 / (zr + Z0); sprites use sqrt(k) so far things stay readable.
import { roundPath, FONT, NUM } from './ui.js';
import { PALETTES, drawFox, drawEagle, drawPerched, drawArm } from './figures.js';
import { use3d, viewOf, vfovFor } from './cam3d.js';
export { PALETTES, drawFox, drawEagle, drawPerched, drawArm };

export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const grad = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const rgrad = (ctx, x, y, r0, r1, stops, x1 = x, y1 = y) => { const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const UNLOCKS = [0, 250, 700, 1400];   // career points needed for each plumage

// ---- geometry and projection -----------------------------------------------------------------------------------------------------
export const Z0 = 70;
export function geom(w, h) {
  const land = w > h, horizon = Math.round(h * (land ? 0.4 : 0.37)), base = h * 1.02;
  return { w, h, land, horizon, base, mpx: 6.5 * Math.min(w, h) / 720, unit: Math.min(w, h) / 720 };
}
let viewKey = '', viewCache = null;
const view3 = (g, cam) => {
  const key = `${g.w}|${g.h}|${cam.x}|${cam.z}|${cam.y}|${cam.yaw}|${cam.pitch}`;
  if (key !== viewKey) { viewKey = key; viewCache = viewOf(g.w, g.h, cam, vfovFor(g.w, g.h, 'play')); }
  return viewCache;
};
export const horizonY = (g, cam) => { const v = view3(g, cam); return v.cy - v.f * Math.tan(cam.pitch); };
export function proj(g, cam, x, z, alt = 0) {
  if (use3d() && cam.y !== undefined) return view3(g, cam).proj(g, x, z, alt);
  const zr = z - cam.z, k = Z0 / Math.max(6, zr + Z0), s = Math.pow(k, 0.42);
  const sy = g.horizon + (g.base - g.horizon) * k;
  return { x: g.w / 2 + (x - cam.x) * g.mpx * k, y: sy - alt * 5.2 * g.unit * s, gy: sy, k, s };
}
// Screen point -> ground point (inverse of proj for alt = 0).
export function unproj(g, cam, sx, sy) {
  if (use3d() && cam.y !== undefined) return view3(g, cam).unproj(sx, sy);
  const k = clamp((sy - g.horizon) / (g.base - g.horizon), 0.045, 1.4);
  return { x: cam.x + (sx - g.w / 2) / (g.mpx * k), z: cam.z + Z0 / k - Z0 };
}

// ---- sky, mountains, ground -------------------------------------------------------------------------------------------------------
const RIDGES = [
  { amp: 0.7, f: [0.8, 1.9, 4.6], ph: [0.4, 2.1, 4.2], lit: '#f7faff', shade: '#aebfe0', top: '#f3f7ff', bot: '#9db4da', par: 0.02, hz: 0.34 },
  { amp: 0.55, f: [1.1, 2.7, 6.1], ph: [1.7, 0.6, 3.3], lit: '#e9f0fc', shade: '#8ea6cf', top: '#dfe9fa', bot: '#7f9ac6', par: 0.05, hz: 0.14 },
  { amp: 0.34, f: [1.7, 3.9, 8.3], ph: [3.0, 5.0, 1.2], lit: '#d4e1f4', shade: '#6f8bb9', top: '#c3d3ee', bot: '#6a88b8', par: 0.1, hz: 0.0 },
];
// A ridged profile: sharp peaks (0 = valley floor, 1 = summit).
export function ridgeY(layer, u) {
  const r = RIDGES[layer], ri = (f, ph) => 1 - Math.abs(Math.sin(u * f * 6.2832 + ph));
  return clamp(0.55 * ri(r.f[0], r.ph[0]) + 0.3 * ri(r.f[1], r.ph[1]) + 0.15 * ri(r.f[2], r.ph[2]), 0, 1);
}

export function drawSky(ctx, g, cam, t) {
  const { w, h, horizon } = g;
  ctx.fillStyle = grad(ctx, 0, 0, 0, horizon, [[0, '#27466f'], [0.45, '#6d95c4'], [0.8, '#cfdcf0'], [1, '#fbe3c4']]);
  ctx.fillRect(0, 0, w, horizon + 2);
  // low sun with a halo
  const sx = w * 0.74, sy = horizon - Math.min(w, h) * 0.2;
  ctx.fillStyle = rgrad(ctx, sx, sy, 0, w * 0.6, [[0, 'rgba(255,244,214,0.95)'], [0.12, 'rgba(255,226,170,0.55)'], [0.45, 'rgba(255,200,150,0.18)'], [1, 'rgba(255,190,140,0)']]);
  ctx.fillRect(0, 0, w, horizon + 2);
  ctx.fillStyle = '#fffbea'; ctx.beginPath(); ctx.arc(sx, sy, Math.min(w, h) * 0.035, 0, 7); ctx.fill();
  // thin clouds drifting with the wind
  for (let i = 0; i < 6; i++) {
    const cw = (0.22 + 0.2 * hash(i + 3)) * w, cx = ((hash(i * 4.4) * 1.4 - 0.2) * w + t * (5 + i * 2)) % (w * 1.4) - w * 0.2;
    const cy = horizon * (0.1 + 0.55 * hash(i * 9.1));
    ctx.fillStyle = rgrad(ctx, cx, cy, 0, cw * 0.6, [[0, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.14); ctx.beginPath(); ctx.arc(0, 0, cw * 0.6, 0, 7); ctx.fill(); ctx.restore();
  }
  // three mountain ranges: faceted, sun on the right-hand slopes
  const mh = Math.max(110, horizon * 0.66);
  RIDGES.forEach((r, li) => {
    const off = cam.x * r.par * 0.004;
    const base = horizon - r.hz * mh * 0.3;
    const step = Math.max(10, w / 70), pts = [];
    for (let x = 0; x <= w + step; x += step) pts.push([x, base - r.amp * mh * ridgeY(li, x / w * 0.8 + off + li * 0.37) - mh * 0.04]);
    // body of the range
    ctx.beginPath(); ctx.moveTo(0, horizon + 3);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(w + step, horizon + 3); ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, base - mh * r.amp, 0, horizon, [[0, r.lit], [0.5, r.lit], [1, r.bot]]); ctx.fill();
    // each peak: its sun-away (left) face in shade, with a slanted spine down to the foot
    ctx.fillStyle = r.shade; ctx.globalAlpha = 0.62;
    for (let i = 1; i < pts.length - 1; i++) {
      if (!(pts[i][1] < pts[i - 1][1] && pts[i][1] <= pts[i + 1][1])) continue;
      let j = i; while (j > 0 && pts[j - 1][1] > pts[j][1]) j--;
      if (j === i) continue;
      const px = pts[i][0], py = pts[i][1], vx = pts[j][0];
      ctx.beginPath(); ctx.moveTo(px, py);
      for (let k = i - 1; k >= j; k--) ctx.lineTo(pts[k][0], pts[k][1]);
      ctx.lineTo(vx, horizon + 3); ctx.lineTo(px - (px - vx) * 0.18, horizon + 3);
      ctx.quadraticCurveTo(px - (px - vx) * 0.05, (py + horizon) / 2, px, py); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // haze toward the foot of each range
    ctx.fillStyle = grad(ctx, 0, base - mh * r.amp, 0, horizon, [[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(235,243,255,0.25)'], [1, 'rgba(235,243,255,0.8)']]);
    ctx.fillRect(0, base - mh * r.amp - 4, w, horizon - (base - mh * r.amp) + 6);
  });
  // a far felt tent and its smoke, on the horizon
  const yx = w * 0.2 - cam.x * 0.02, yy = horizon + 2, ys = Math.min(w, h) * 0.024;
  ctx.fillStyle = '#e9e2d4'; ctx.beginPath(); ctx.moveTo(yx - ys * 1.6, yy); ctx.lineTo(yx - ys * 1.6, yy - ys * 0.9); ctx.quadraticCurveTo(yx, yy - ys * 2.6, yx + ys * 1.6, yy - ys * 0.9); ctx.lineTo(yx + ys * 1.6, yy); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6b4c3a'; ctx.fillRect(yx - ys * 0.3, yy - ys * 0.7, ys * 0.6, ys * 0.7);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = ys * 0.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(yx + ys * 0.2, yy - ys * 2.4); ctx.quadraticCurveTo(yx + ys * 1.5 + Math.sin(t) * ys * 0.3, yy - ys * 3.6, yx + ys * 3.4, yy - ys * 4.6); ctx.stroke();
}

export function drawGround(ctx, g, cam, t, wind) {
  const { w, h, horizon, base } = g;
  ctx.fillStyle = grad(ctx, 0, horizon, 0, h, [[0, '#dfe9f7'], [0.12, '#eef4fc'], [0.5, '#f9fbff'], [1, '#ffffff']]);
  ctx.fillRect(0, horizon, w, h - horizon + 2);
  ctx.save(); ctx.beginPath(); ctx.rect(0, horizon, w, h - horizon); ctx.clip();
  // broad drifts: a bright crest over a blue shadow, scattered in depth
  const d0 = Math.floor((cam.z - 20) / 24) * 24;
  for (let zz = d0 + 24 * 16; zz >= d0; zz -= 24) {
    const row = Math.round(zz / 24);
    for (let i = 0; i < 2; i++) {
      const hx = hash(row * 3.9 + i * 17.1), hw = hash(row * 6.3 + i * 2.7);
      const p = proj(g, cam, (hx - 0.5) * 330, zz + hw * 10);
      if (p.k < 0.05 || p.k > 1.2) continue;
      const wd = (60 + 90 * hw) * g.mpx * p.k, hh = (3 + 5 * hash(row + i * 9)) * g.mpx * p.k * 0.55;
      ctx.fillStyle = 'rgba(140,168,214,0.26)'; ctx.beginPath(); ctx.ellipse(p.x, p.gy + hh * 0.2, wd / 2, hh, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.ellipse(p.x - wd * 0.04, p.gy - hh * 0.25, wd * 0.46, hh * 0.62, 0, 0, 7); ctx.fill();
    }
  }
  // faint blue shadow bands for relief (long, low)
  const z0 = Math.floor((cam.z - 8) / 7) * 7;
  for (let zz = z0 + 7 * 56; zz >= z0; zz -= 7) {
    const row = Math.round(zz / 7), p = proj(g, cam, 0, zz);
    if (p.k < 0.04 || p.k > 1.3) continue;
    for (let i = 0; i < 7; i++) {
      const hx = hash(row * 7.1 + i * 3.3), hw = hash(row * 1.9 + i * 8.1);
      const x = cam.x + (hx - 0.5) * 340, len = (5 + hw * 22) * g.mpx * p.k, y = p.gy;
      const sx = g.w / 2 + (x - cam.x) * g.mpx * p.k;
      if (sx < -len || sx > w + len) continue;
      const th = Math.max(1, (1.4 + hw * 3) * p.k * 3.2 * g.unit);
      ctx.fillStyle = `rgba(120,150,200,${0.1 + 0.16 * Math.min(1, p.k * 1.6)})`;
      ctx.beginPath(); ctx.ellipse(sx, y, len, th, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(sx - len * 0.12, y - th * 0.9, len * 0.8, th * 0.55, 0, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
  // horizon haze
  ctx.fillStyle = grad(ctx, 0, horizon - 2, 0, horizon + 38 * g.unit, [[0, 'rgba(238,244,252,0.9)'], [1, 'rgba(238,244,252,0)']]);
  ctx.fillRect(0, horizon - 2, w, 40 * g.unit);
}

// Tufts of dry grass and stones scattered over the snow (deterministic, scroll with the camera). Returns nothing: drawn far to near.
export function drawProps(ctx, g, cam) {
  const z0 = Math.floor((cam.z - 10) / 18) * 18;
  for (let zz = z0 + 18 * 22; zz >= z0; zz -= 18) {
    const row = Math.round(zz / 18);
    for (let i = 0; i < 3; i++) {
      const hx = hash(row * 5.3 + i * 11.7), hk = hash(row * 2.2 + i * 6.1);
      if (hk < 0.35) continue;
      const x = (hx - 0.5) * 300, p = proj(g, cam, x, zz + hash(row + i) * 14);
      if (p.k < 0.05 || p.k > 1.4) continue;
      const sx = p.x, sy = p.gy, sz = (4 + 7 * hk) * g.unit * p.s * 1.6;
      if (sx < -40 || sx > g.w + 40) continue;
      if (hk > 0.8) {   // a stone with snow on top
        ctx.fillStyle = 'rgba(70,86,118,0.9)'; ctx.beginPath(); ctx.ellipse(sx, sy, sz * 1.1, sz * 0.62, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(sx - sz * 0.1, sy - sz * 0.28, sz * 0.9, sz * 0.36, 0, 0, 7); ctx.fill();
      } else {          // grass tuft
        ctx.strokeStyle = 'rgba(120,98,60,0.85)'; ctx.lineWidth = Math.max(1, sz * 0.14); ctx.lineCap = 'round';
        for (let b = -2; b <= 2; b++) { ctx.beginPath(); ctx.moveTo(sx + b * sz * 0.14, sy); ctx.quadraticCurveTo(sx + b * sz * 0.32, sy - sz * 0.7, sx + b * sz * 0.55 + (hx - 0.5) * sz * 0.3, sy - sz * (1.0 - Math.abs(b) * 0.15)); ctx.stroke(); }
      }
    }
  }
}

export function drawDenRing(ctx, g, cam, den, circleR) {
  ctx.save(); ctx.setLineDash([10, 10]); ctx.lineWidth = Math.max(2, 3 * g.unit); ctx.strokeStyle = 'rgba(255,226,150,0.9)';
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 6.2832, q = proj(g, cam, den.x + Math.sin(a) * circleR, den.z + Math.cos(a) * circleR);
    if (q.k <= 0.002 || q.gy < -5000) { started = false; continue; }
    if (!started) { ctx.moveTo(q.x, q.gy); started = true; } else ctx.lineTo(q.x, q.gy);
  }
  ctx.stroke(); ctx.restore();
}
// The den: a low mound with a dark hole and a ring of paw tracks. `circle` draws the open-snow limit (radius r metres) as a dashed ring.
export function drawDen(ctx, g, cam, den, circleR = 0, t = 0) {
  const p = proj(g, cam, den.x, den.z);
  if (p.k < 0.04) return;
  const s = 40 * g.unit * p.s;
  if (circleR > 0) {
    ctx.save(); ctx.setLineDash([10, 10]); ctx.lineWidth = Math.max(2, 3 * g.unit); ctx.strokeStyle = 'rgba(255,214,120,0.85)';
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * 6.2832, q = proj(g, cam, den.x + Math.sin(a) * circleR, den.z + Math.cos(a) * circleR);
      if (i === 0) ctx.moveTo(q.x, q.gy); else ctx.lineTo(q.x, q.gy);
    }
    ctx.stroke(); ctx.restore();
  }
  ctx.fillStyle = 'rgba(100,125,170,0.4)'; ctx.beginPath(); ctx.ellipse(p.x + s * 0.2, p.gy + s * 0.08, s * 1.15, s * 0.36, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#e9f0fb'; ctx.beginPath(); ctx.ellipse(p.x, p.gy - s * 0.1, s, s * 0.34, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2b3550'; ctx.beginPath(); ctx.ellipse(p.x + s * 0.12, p.gy - s * 0.08, s * 0.38, s * 0.16, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#141b2e'; ctx.beginPath(); ctx.ellipse(p.x + s * 0.12, p.gy - s * 0.06, s * 0.26, s * 0.1, 0, 0, 7); ctx.fill();
}

// ---- particles ----------------------------------------------------------------------------------------------------------------------------
// fx: { kind, x, y, vx, vy, life, t, size, col }. Screen-space, stepped by the game with a fixed dt.
export function emit(list, kind, x, y, n, rnd, o = {}) {
  const { speed = 160, size = 10, life = 0.8, cols = ['#ffffff', '#dfeaff'], up = 0, grav = 0 } = o;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, sp = speed * (0.25 + rnd() * 0.85);
    list.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - up * rnd(), life: life * (0.6 + rnd() * 0.6), t: 0, size: size * (0.6 + rnd() * 0.9), col: cols[Math.floor(rnd() * cols.length) % cols.length], grav });
  }
  if (list.length > 220) list.splice(0, list.length - 220);
}
export function stepFx(list, dt) {
  for (const p of list) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - Math.min(1, 1.8 * dt); p.vy = p.vy * (1 - Math.min(1, 1.8 * dt)) + p.grav * dt; }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= list[i].life) list.splice(i, 1);
}
export function drawFx(ctx, list) {
  for (const p of list) {
    const k = p.t / p.life, a = (1 - k) * (1 - k);
    ctx.globalAlpha = Math.max(0, a * 0.9);
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + 0.9 * (p.kind === 'puff' ? k : 0.2)), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Wind-blown snow in screen space: streaks that run in the wind direction. `wx` is the sideways wind in m/s (+ blows to the right).
export function drawWindSnow(ctx, g, t, wx, wz, amount = 1) {
  const sp = clamp(wx * 36, -300, 300) + 20;
  const n = Math.round(46 * amount);
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const fy = hash(i * 3.7), fx = hash(i * 9.1), v = 0.5 + hash(i * 1.3);
    const x = ((fx * g.w * 1.3 + t * sp * v) % (g.w * 1.3) + g.w * 1.3) % (g.w * 1.3) - g.w * 0.15;
    const y = g.horizon + (g.h - g.horizon) * Math.pow(fy, 0.8) + Math.sin(t * 0.9 + i) * 4;
    const len = (6 + 22 * v) * g.unit * (0.5 + fy) * (1 + Math.abs(sp) / 200);
    ctx.strokeStyle = `rgba(255,255,255,${0.18 + 0.32 * fy})`; ctx.lineWidth = Math.max(1, (1 + 2 * fy) * g.unit);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.sign(sp || 1) * len, y + 1); ctx.stroke();
  }
  ctx.restore();
}

// ---- wordmark and the title hero ----------------------------------------------------------------------------------------------------------
export function wordmark(ctx, text, x, y, size, sub) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = size;
  ctx.font = `900 italic ${px}px ${FONT}`;
  const maxW = Math.max(200, ctx.canvas ? 1e9 : 1e9);
  ctx.lineJoin = 'round';
  ctx.lineWidth = px * 0.2; ctx.strokeStyle = '#0e2038'; ctx.strokeText(text, x, y + px * 0.04);
  ctx.fillStyle = grad(ctx, 0, y - px * 0.5, 0, y + px * 0.5, [[0, '#fff6d0'], [0.5, '#ffd36a'], [1, '#d28a1e']]);
  ctx.fillText(text, x, y);
  ctx.restore();
  return maxW;
}

export function drawHero(ctx, w, h, t, pal = PALETTES[0]) {
  ctx.save(); roundPath(ctx, 0, 0, w, h, 26); ctx.clip();
  const g = { w, h, land: w > h, horizon: h * 0.62, base: h * 1.05, mpx: 3.4 * Math.min(w, h) / 600, unit: Math.min(w, h) / 600 };
  const cam = { x: 0, z: -4 };
  drawSky(ctx, g, cam, t * 0.5);
  drawGround(ctx, g, cam, t, 0);
  // the eagle soaring above the ridge
  const ex = w * 0.5 + Math.sin(t * 0.5) * w * 0.08, ey = h * 0.66 + Math.sin(t * 0.9) * h * 0.02;
  drawEagle(ctx, ex, ey, Math.min(w * 0.4, h * 0.62), { flap: Math.sin(t * 2.6) * 0.5, bank: Math.sin(t * 0.5) * 0.3, pal });
  ctx.restore();
}

// ---- diagrams for the How to Play and Rules pages --------------------------------------------------------------------------------------------
export function drawDiagram(kind, ctx, w, h) {
  const u = Math.min(w / 640, h / 260);
  ctx.save();
  roundPath(ctx, 0, 0, w, h, 18); ctx.clip();
  const g = { w, h, land: true, horizon: h * 0.34, base: h * 1.1, mpx: 2.6 * u, unit: u * 0.6 };
  const cam = { x: 0, z: -8 };
  if (kind === 'wind' || kind === 'track' || kind === 'den') {
    drawSky(ctx, g, cam, 0); drawGround(ctx, g, cam, 0, 0);
  } else {
    ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#2a4a76'], [0.6, '#8fb0d8'], [1, '#e9f1fb']]); ctx.fillRect(0, 0, w, h);
  }
  const lbl = (txt, x, y, col = '#10243f', size = 20) => { ctx.save(); ctx.font = `800 ${Math.round(size * Math.max(0.8, u))}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.fillText(txt, x, y); ctx.restore(); };
  if (kind === 'track') {
    const fx = w * 0.62, fy = h * 0.58;
    drawFox(ctx, fx, fy, 70 * u, { mode: 'forage', t: 0.4 });
    ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(fx, fy - 26 * u, 44 * u, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx - 58 * u, fy - 26 * u); ctx.lineTo(fx + 58 * u, fy - 26 * u); ctx.moveTo(fx, fy - 84 * u); ctx.lineTo(fx, fy + 6 * u); ctx.stroke();
    lbl('Keep the sight on the fox', w * 0.34, h * 0.18);
    ctx.fillStyle = '#10243f'; ctx.font = `700 ${Math.round(18 * Math.max(0.8, u))}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('Lock fills while you track', w * 0.06, h * 0.88);
  } else if (kind === 'den') {
    drawDen(ctx, g, cam, { x: 0, z: 150 }, 0, 0);
    ctx.save(); ctx.setLineDash([10, 9]); ctx.strokeStyle = '#d39a1e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(w / 2, h * 0.5, w * 0.34, h * 0.22, 0, 0, 7); ctx.stroke(); ctx.restore();
    drawFox(ctx, w * 0.2, h * 0.7, 52 * u, { mode: 'forage', t: 0.2 });
    drawFox(ctx, w * 0.5, h * 0.52, 30 * u, { mode: 'listen' });
    lbl('Release while the fox is outside the ring', w / 2, h * 0.14);
  } else if (kind === 'wind') {
    ctx.strokeStyle = '#0e2a4e'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.5); ctx.lineTo(w * 0.62, h * 0.5); ctx.stroke();
    ctx.fillStyle = '#0e2a4e'; ctx.beginPath(); ctx.moveTo(w * 0.62, h * 0.5 - 20); ctx.lineTo(w * 0.72, h * 0.5); ctx.lineTo(w * 0.62, h * 0.5 + 20); ctx.fill();
    drawEagle(ctx, w * 0.86, h * 0.5, 120 * u, { flap: 0.2, bank: 0.4 });
    lbl('Wind pushes the eagle off its line', w * 0.4, h * 0.22);
  } else if (kind === 'stoop') {
    ctx.strokeStyle = 'rgba(14,42,78,0.7)'; ctx.lineWidth = 4; ctx.setLineDash([9, 8]);
    ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.28); ctx.lineTo(w * 0.36, h * 0.28); ctx.quadraticCurveTo(w * 0.62, h * 0.3, w * 0.74, h * 0.76); ctx.stroke(); ctx.setLineDash([]);
    drawEagle(ctx, w * 0.2, h * 0.28, 110 * u, { flap: 0.3 });
    drawEagle(ctx, w * 0.5, h * 0.42, 70 * u, { fold: 1, bank: 0 });
    ctx.fillStyle = '#f2f7ff'; ctx.fillRect(0, h * 0.82, w, h * 0.2);
    drawFox(ctx, w * 0.78, h * 0.86, 54 * u, { mode: 'bolt', t: 0.5, dir: -1 });
    lbl('Stoop when the fox is about 30 m ahead', w / 2, h * 0.12);
  } else if (kind === 'recall') {
    drawArm(ctx, { w, h, land: true, unit: u * 0.5 }, {});
    for (let i = 0; i < 3; i++) {
      const r = (60 - i * 16) * u;
      ctx.strokeStyle = `rgba(255,211,106,${0.9 - i * 0.2})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(w * 0.66, h * 0.5, r, 0, 7); ctx.stroke();
    }
    ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.arc(w * 0.66, h * 0.5, 14 * u, 0, 7); ctx.fill();
    lbl('Tap as the ring reaches the centre', w * 0.62, h * 0.14);
  } else if (kind === 'score') {
    const rows = [['Track', 15], ['Release', 10], ['Flight', 15], ['Stoop', 35], ['Return', 25]];
    rows.forEach(([n, v], i) => {
      const y = h * (0.14 + i * 0.17), bw = (w * 0.62) * (v / 35);
      ctx.fillStyle = '#10243f'; ctx.font = `700 ${Math.round(20 * Math.max(0.8, u))}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(n, w * 0.06, y + 8);
      roundPath(ctx, w * 0.26, y - 10, bw, 22 * Math.max(0.8, u), 8); ctx.fillStyle = i === 3 ? '#e6a41a' : '#4f86c6'; ctx.fill();
      ctx.fillStyle = '#10243f'; ctx.fillText(String(v), w * 0.26 + bw + 10, y + 8);
    });
  } else {
    drawEagle(ctx, w / 2, h * 0.5, Math.min(h * 1.1, w * 0.4), { flap: 0.25 });
  }
  ctx.restore();
}
