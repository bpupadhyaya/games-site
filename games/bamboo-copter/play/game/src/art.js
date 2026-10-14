// Drawing of the sky world: layered landscapes (sky, sun or moon, ridges, the landscape's own near scenery, the ground
// polyline), thermals, lanterns, targets, drifting leaves and the rotor itself (a pseudo-3D lit propeller with a spin blur).
// Pure drawing, no state. World coordinates are metres (x along the wind axis, y up); the camera is { x, y }.
import { ROTORS, SCENES, groundAt, windAt, clamp } from './sim.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
const hs = (n) => { let x = Math.imul(n | 0, 0x45d9f3b); x ^= x >>> 16; x = Math.imul(x, 0x45d9f3b); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

// sky = [top, mid, horizon], ridge = [far, mid, near], ground = [lit top, body, deep], sun = { x, y (0..1 of sky), r, c }
export const PALS = [
  { sky: ['#6f9ccd', '#f5c4aa', '#ffe9c4'], ridge: ['#a9bfd0', '#7ea590', '#5d8a6e'], ground: ['#8cc15a', '#4f8a3a', '#264a22'], sun: { x: 0.7, y: 0.78, r: 54, c: '255,238,190' }, night: false, haze: '255,226,190', ink: '#16321c' },
  { sky: ['#3b82d6', '#9ccdf2', '#e9f6ff'], ridge: ['#a4c0d6', '#7fa88c', '#5d9457'], ground: ['#b6d462', '#6a9a3a', '#2f5a24'], sun: { x: 0.25, y: 0.3, r: 38, c: '255,252,230' }, night: false, haze: '230,244,255', ink: '#173a52' },
  { sky: ['#312a66', '#d9577c', '#ffb86c'], ridge: ['#8a5f8c', '#5a4276', '#3a2d58'], ground: ['#6a5560', '#3c2e46', '#1c1428'], sun: { x: 0.35, y: 0.85, r: 64, c: '255,208,140' }, night: false, haze: '255,176,120', ink: '#241a3c' },
  { sky: ['#050a22', '#13224f', '#3a5288'], ridge: ['#26396a', '#172750', '#0e1a3a'], ground: ['#1c3158', '#0f1e3c', '#070f22'], sun: { x: 0.72, y: 0.3, r: 32, c: '236,244,255' }, night: true, haze: '110,140,200', ink: '#060c20' },
];

export const FIT_M = 90; // metres of width the stage shows

export function makeCam(rect, cam) {
  const ppm = rect.w / FIT_M, cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  return { rect, ppm, X: (x) => cx + (x - cam.x) * ppm, Y: (y) => cy - (y - cam.y) * ppm, x: cam.x, y: cam.y, visH: rect.h / ppm, visW: FIT_M };
}

// ---- sky (cached per scene and size) -------------------------------------------------------------------------------------
const skyCache = new Map();
export function resetArt() { skyCache.clear(); }
function skyBitmap(scene, w, h) {
  const key = `${scene}|${Math.round(w)}x${Math.round(h)}`;
  let c = skyCache.get(key);
  if (c) return c;
  const p = PALS[scene], cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.max(2, Math.round(w)), Math.max(2, Math.round(h))) : null;
  if (!cv) return null;
  const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, p.sky[0]); gr.addColorStop(0.55, p.sky[1]); gr.addColorStop(1, p.sky[2]);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (p.night) { g.fillStyle = '#fff'; for (let i = 0; i < 90; i++) { g.globalAlpha = 0.25 + 0.6 * hs(i * 3 + 1); g.fillRect(hs(i * 7) * w, hs(i * 11 + 5) * h * 0.75, 1.7, 1.7); } g.globalAlpha = 1; }
  const sx = p.sun.x * w, sy = p.sun.y * h * 0.8 + h * 0.06, r = p.sun.r * (w / 720);
  const gl = g.createRadialGradient(sx, sy, r * 0.3, sx, sy, r * 5.5); gl.addColorStop(0, `rgba(${p.sun.c},0.75)`); gl.addColorStop(0.3, `rgba(${p.sun.c},0.22)`); gl.addColorStop(1, `rgba(${p.sun.c},0)`);
  g.fillStyle = gl; g.fillRect(0, 0, w, h);
  g.fillStyle = `rgb(${p.sun.c})`; g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
  if (p.night) { g.fillStyle = 'rgba(8,16,44,0.55)'; g.beginPath(); g.arc(sx + r * 0.4, sy - r * 0.2, r * 0.92, 0, TAU); g.fill(); }
  skyCache.set(key, g.canvas); if (skyCache.size > 12) skyCache.delete(skyCache.keys().next().value);
  return cv;
}

// A rolling ridge line at parallax `par`, `base` px above the horizon line; feature size by `f`.
function ridge(ctx, rect, camX, par, baseY, amp, seed, col, f1, f2, ppm) {
  ctx.beginPath(); ctx.moveTo(rect.x, rect.y + rect.h);
  const off = camX * par * ppm;
  for (let sx = rect.x; sx <= rect.x + rect.w + 10; sx += 10) {
    const wx = (sx - rect.x + off);
    const y = baseY - amp * (0.5 + 0.28 * Math.sin(wx * f1 + seed) + 0.22 * Math.sin(wx * f2 + seed * 2.3));
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(rect.x + rect.w, rect.y + rect.h); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}
function cloud(ctx, x, y, w, a, night) {
  const rg = ctx.createRadialGradient(x, y, 2, x, y, w);
  const c = night ? '120,140,200' : '255,255,255';
  rg.addColorStop(0, `rgba(${c},${night ? 0.16 : 0.55 * a})`); rg.addColorStop(1, `rgba(${c},0)`);
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.2); ctx.translate(-x, -y); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, w, 0, TAU); ctx.fill(); ctx.restore();
}

function bambooStalk(ctx, x, top, bottom, w, c0, c1, node) {
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(0.45, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(x - w / 2, top, w, bottom - top);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = bottom - node; y > top; y -= node) ctx.fillRect(x - w / 2 - 1, y, w + 2, Math.max(2, w * 0.16));
}

// ---- the whole world -----------------------------------------------------------------------------------------------------
// ws = { scene, cond, t, cam: {x,y}, f (flight | null), parts: leaves, carry: { x, y } | null }
export function drawWorld(ctx, rect, ws) {
  const sc = ws.scene, p = PALS[sc], cond = ws.cond, cam = makeCam(rect, ws.cam), { ppm } = cam;
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const sky = skyBitmap(sc, rect.w, rect.h);
  if (sky) ctx.drawImage(sky, rect.x, rect.y, rect.w, rect.h);
  else { const gr = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h); gr.addColorStop(0, p.sky[0]); gr.addColorStop(1, p.sky[2]); ctx.fillStyle = gr; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); }
  const g0 = cond ? groundAt(cond, 0) : 0;
  // horizon sits where the ground at the camera's foot would be; ridges follow the camera height slowly
  const hz = cam.Y(g0 + 0.5);
  for (let i = 0; i < 3; i++) {
    const par = [0.05, 0.12, 0.26][i];
    ridge(ctx, rect, cam.x, par, hz - [60, 28, 8][i] * (rect.w / 720), [90, 70, 50][i] * (rect.w / 720), sc * 3 + i * 1.7, p.ridge[i], [0.0042, 0.0063, 0.009][i], [0.011, 0.015, 0.02][i], ppm);
  }
  // clouds drift with the wind
  const wdir = cond ? Math.sign(cond.wind) || 1 : 1;
  for (let i = 0; i < 5; i++) {
    const wx = ((hs(i * 5 + 2) * 900 + ws.t * wdir * (2 + i)) % 900) - 150;
    cloud(ctx, rect.x + ((wx - cam.x * 0.08 * 1) * rect.w) / 760, rect.y + rect.h * (0.1 + 0.3 * hs(i * 9 + 4)), rect.w * (0.14 + 0.12 * hs(i * 13 + 1)), 0.85, p.night);
  }
  // near scenery, parallax 0.5, then the ground
  const x0 = cam.x - FIT_M * 0.7, x1 = cam.x + FIT_M * 0.7;
  if (sc === 0) {
    // distant bamboo stand
    const step = 7;
    for (let wx = Math.floor((cam.x * 0.55 - 60) / step) * step; wx < cam.x * 0.55 + 60; wx += step) {
      const k = Math.floor(wx / step), h = hs(k * 3 + sc), sx = cam.X(wx + (cam.x - cam.x * 0.55));
      const top = rect.y + rect.h * (0.18 + 0.2 * h), base = hz - 4;
      bambooStalk(ctx, sx, Math.min(top, base - 30), base, 4 + 3 * h, 'rgba(120,160,120,0.8)', 'rgba(70,110,80,0.8)', 26);
    }
  }
  // thermals: soft rising shimmer
  if (cond) for (const th of cond.thermals) {
    const x = cam.X(th.x), w = th.w * ppm, bot = cam.Y(groundAt(cond, th.x)), top = cam.Y(th.top);
    const gr = ctx.createLinearGradient(0, bot, 0, top); gr.addColorStop(0, 'rgba(255,255,230,0.20)'); gr.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - w, top, w * 2, bot - top);
    ctx.strokeStyle = 'rgba(255,255,240,0.28)'; ctx.lineWidth = Math.max(1.5, ppm * 0.18);
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      for (let j = 0; j <= 14; j++) { const yy = bot - (bot - top) * (((j / 14) * 0.9 + ws.t * 0.12 + k * 0.17) % 1); const xx = x + k * w * 0.4 + Math.sin(yy * 0.03 + ws.t * 1.4 + k) * w * 0.12; if (j === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
      ctx.stroke();
    }
  }
  drawGround(ctx, rect, cam, ws, p);
  if (cond) {
    for (const t of cond.targets) drawTarget(ctx, cam, t, ws, p);
    cond.lanterns.forEach((l, i) => { if (!(ws.f && ws.f.got_idx.indexOf(i) >= 0)) drawLantern(ctx, cam, l, ws.t + i * 1.3, p); });
  }
  // leaves and petals in the wind
  for (const q of ws.parts) {
    const x = cam.X(q.x), y = cam.Y(q.y);
    if (x < rect.x - 20 || x > rect.x + rect.w + 20) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(q.a); ctx.globalAlpha = clamp(q.life, 0, 1) * (q.spark ? 1 : 0.85);
    ctx.fillStyle = q.col;
    if (q.spark) { ctx.beginPath(); ctx.arc(0, 0, q.r * ppm * 0.18 + 2, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(0, 0, q.r * ppm * 0.35 + 3, q.r * ppm * 0.14 + 1.4, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
  return cam;
}

function drawGround(ctx, rect, cam, ws, p) {
  const cond = ws.cond, sc = ws.scene;
  if (!cond) return;
  const step = 4, xa = cam.x - FIT_M * 0.55 - 6, xb = cam.x + FIT_M * 0.55 + 6;
  const bottom = rect.y + rect.h + 4;
  // far field (a lower strip behind the ground line) gives depth
  ctx.beginPath(); ctx.moveTo(cam.X(xa), bottom);
  const pts = [];
  for (let sx = rect.x - 8; sx <= rect.x + rect.w + 8; sx += step) { const wx = cam.x + (sx - (rect.x + rect.w / 2)) / cam.ppm; const gy = cam.Y(groundAt(cond, wx)); pts.push([sx, gy, wx]); ctx.lineTo(sx, gy); }
  ctx.lineTo(rect.x + rect.w + 8, bottom); ctx.closePath();
  const top = Math.min(...pts.map((q) => q[1])), gr = ctx.createLinearGradient(0, top, 0, bottom);
  gr.addColorStop(0, p.ground[0]); gr.addColorStop(0.35, p.ground[1]); gr.addColorStop(1, p.ground[2]);
  if (sc === 3) { gr.addColorStop(0, '#2c4a7e'); }
  ctx.fillStyle = gr; ctx.fill();
  if (sc === 2) {
    // houses: roofs where the ground rises above street level
    ctx.lineWidth = Math.max(3, cam.ppm * 0.5); ctx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const [sx, gy, wx] = pts[i];
      if (groundAt(cond, wx) > 1.5) {
        ctx.strokeStyle = '#a2472c'; ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(sx, gy); ctx.stroke();
      }
    }
    for (let i = 0; i < pts.length; i += 3) {
      const [sx, gy, wx] = pts[i];
      if (groundAt(cond, wx) > 3.2 && hs(Math.floor(wx / 3) * 9 + cond.hseed) > 0.4) { ctx.fillStyle = 'rgba(255,210,120,0.9)'; ctx.fillRect(sx - 3, gy + cam.ppm * 1.6, 6, 7); }
    }
  }
  if (sc === 1) {
    // flooded paddies reflect the sky on each flat step
    for (let i = 1; i < pts.length; i++) {
      const y0 = pts[i - 1][1], y1 = pts[i][1];
      if (Math.abs(y1 - y0) < 0.4) { ctx.fillStyle = 'rgba(190,225,250,0.42)'; ctx.fillRect(pts[i - 1][0], y0 + 2, pts[i][0] - pts[i - 1][0] + 0.5, 5); }
    }
  }
  if (sc === 3) {
    // lake: moon glints on the water
    ctx.fillStyle = 'rgba(210,225,255,0.4)';
    for (let k = 0; k < 18; k++) { const wx = cam.x + (hs(k * 5 + Math.floor(ws.t * 0.5) * 3) - 0.5) * FIT_M, yy = cam.Y(0) + 8 + hs(k * 11 + 4) * (bottom - cam.Y(0) - 10); ctx.fillRect(cam.X(wx), yy, 10 + 22 * hs(k), 2); }
  }
  // grass edge
  ctx.strokeStyle = sc === 3 ? 'rgba(160,190,240,0.5)' : sc === 2 ? 'rgba(255,190,140,0.5)' : 'rgba(240,255,190,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); pts.forEach((q, i) => { if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); }); ctx.stroke();
  // foreground bamboo (grove) and reeds (lake), parallax 1.35, drawn translucent
  if (sc === 0) {
    for (let k = -3; k <= 3; k++) {
      const wxk = Math.floor(cam.x / 40) + k, h = hs(wxk * 17 + 3), sx = cam.X(cam.x + (wxk * 40 + h * 22 - cam.x) * 1.35);
      bambooStalk(ctx, sx, rect.y - 4, bottom, 5 + 4 * h, 'rgba(60,130,70,0.32)', 'rgba(20,70,40,0.38)', 70);
    }
  }
}

function drawTarget(ctx, cam, t, ws, p) {
  const x = cam.X(t.x), y = cam.Y(t.g), rx = t.hw * cam.ppm, ry = Math.max(4, rx * 0.2);
  if (x < cam.rect.x - rx || x > cam.rect.x + cam.rect.w + rx) return;
  const lake = ws.scene === 3;
  ctx.save();
  const rings = [[1, lake ? '#bfe6c0' : '#fff6e0'], [0.5, '#e04b3a'], [0.2, '#ffd23c']];
  rings.forEach(([k, col], i) => {
    ctx.beginPath(); ctx.ellipse(x, y, rx * k, ry * k, 0, 0, TAU);
    ctx.fillStyle = col; ctx.globalAlpha = 0.9; ctx.fill();
    ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(30,20,10,0.5)'; ctx.stroke();
    void i;
  });
  // a small pennant on a pole
  ctx.strokeStyle = '#5b4630'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + rx, y); ctx.lineTo(x + rx, y - 34); ctx.stroke();
  ctx.fillStyle = '#e8503c'; ctx.beginPath(); ctx.moveTo(x + rx, y - 34); ctx.lineTo(x + rx + 20 + 4 * Math.sin(ws.t * 3), y - 28); ctx.lineTo(x + rx, y - 21); ctx.closePath(); ctx.fill();
  ctx.restore();
  void p;
}
function drawLantern(ctx, cam, l, t, p) {
  const x = cam.X(l.x), y = cam.Y(l.y) + Math.sin(t * 1.7) * 3;
  if (x < cam.rect.x - 30 || x > cam.rect.x + cam.rect.w + 30) return;
  const r = Math.max(9, cam.ppm * 1.6);
  const gl = ctx.createRadialGradient(x, y, 1, x, y, r * 2.6); gl.addColorStop(0, 'rgba(255,214,120,0.55)'); gl.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d4402a'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,150,0.65)'; ctx.beginPath(); ctx.ellipse(x - r * 0.2, y - r * 0.2, r * 0.35, r * 0.55, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e8b84a'; ctx.fillRect(x - r * 0.5, y - r * 1.05, r, 3); ctx.fillRect(x - r * 0.5, y + r * 0.95, r, 3);
  ctx.strokeStyle = '#e8b84a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + r); ctx.lineTo(x + Math.sin(t * 2) * 2, y + r * 1.7); ctx.stroke();
  void p;
}

// ---- the rotor ------------------------------------------------------------------------------------------------------------
// Draws the whole toy centred on its hub: stick below, blades above. size = blade span in px, rev = angle, s = spin (0..1.2).
export function drawCopter(ctx, cx, cy, size, rotorIdx, rev, s, tilt = 0, o = {}) {
  const th = v3.thumbs;
  if (th && !o.live && th.img[rotorIdx]) {
    // a lit 3D render of the rotor (made once by the presenter) instead of the flat drawing: trays, collection, illustrations
    const k = size / th.span, w = th.size * k;
    ctx.save(); ctx.translate(cx, cy); if (tilt) ctx.rotate(tilt * 0.5);
    ctx.drawImage(th.img[rotorIdx], -th.hubX * k, -th.hubY * k, w, w); ctx.restore();
    return;
  }
  const ro = ROTORS[rotorIdx], R = size / 2, flat = 0.24 + Math.abs(tilt) * 0.2 + (o.view ?? 0);
  const [c0, c1, c2] = ro.col, n = ro.blades;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt * 0.5);
  const stickL = size * 0.95, sw = Math.max(4, size * 0.058);
  const drawStick = () => {
    const g = ctx.createLinearGradient(-sw, 0, sw, 0); g.addColorStop(0, '#9a7a3a'); g.addColorStop(0.45, '#f3dc94'); g.addColorStop(1, '#8a6a2a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-sw / 2, 0, sw, stickL, sw / 2); ctx.fill();
    // bamboo nodes: a slightly wider ring with a dark seam and a bright lip
    for (const t of [0.4, 0.75]) {
      const y = stickL * t;
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-sw * 0.62, y - 2.5, sw * 1.24, 5, 2); ctx.fill();
      ctx.fillStyle = 'rgba(70,45,10,0.55)'; ctx.fillRect(-sw * 0.62, y + 1.5, sw * 1.24, 1.6);
      ctx.fillStyle = 'rgba(255,250,215,0.5)'; ctx.fillRect(-sw * 0.62, y - 2.5, sw * 1.24, 1.2);
    }
  };
  const angles = [];
  const nb = n === 1 ? 1 : n;
  for (let i = 0; i < nb; i++) angles.push(rev + (n === 4 ? (i % 2) * Math.PI / 2 + Math.floor(i / 2) * Math.PI : (i * TAU) / nb));
  const blade = (phi, alpha, len, shade) => {
    const pts = [];
    const N = 9, hw = Math.max(0.05, ro.wide) * R * (n === 1 ? 1.15 : 1);
    const proj = (u, v) => [u * Math.cos(phi) - v * Math.sin(phi), flat * (u * Math.sin(phi) + v * Math.cos(phi))];
    for (let i = 0; i <= N; i++) { const u = 0.1 * R + (len * i) / N, k = Math.sin((Math.PI * (i + 0.6)) / (N + 1.4)); pts.push(proj(u, hw * Math.pow(k, 0.8))); }
    for (let i = N; i >= 0; i--) { const u = 0.1 * R + (len * i) / N, k = Math.sin((Math.PI * (i + 0.6)) / (N + 1.4)); pts.push(proj(u, -hw * Math.pow(k, 0.8))); }
    const tip = proj(len, 0), g = ctx.createLinearGradient(0, 0, tip[0], tip[1]);
    const lit = 0.5 + 0.5 * Math.cos(phi - 0.9) * shade;
    g.addColorStop(0, c1); g.addColorStop(1, lit > 0.55 ? c0 : c1);
    ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = c2; ctx.stroke(); ctx.globalAlpha = 1;
  };
  const fast = clamp((s - 0.12) / 0.5, 0, 1);
  // back blades (far side), stick, front blades
  const far = (a) => Math.sin(a) < 0;
  drawStick();
  if (fast > 0) {
    ctx.globalAlpha = 0.16 * fast + 0.06; ctx.fillStyle = c0; ctx.beginPath(); ctx.ellipse(0, 0, R * 1.02, R * flat * 1.02, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.5 * fast; ctx.lineWidth = 2; ctx.strokeStyle = c1; ctx.beginPath(); ctx.ellipse(0, 0, R * 1.02, R * flat * 1.02, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    for (let k = 3; k >= 1; k--) for (const a of angles) blade(a - k * 0.34 * fast, 0.13 * fast, R * 0.97, 1);
  }
  angles.filter(far).forEach((a) => blade(a, 1 - 0.45 * fast, R, 0.6));
  angles.filter((a) => !far(a)).forEach((a) => blade(a, 1 - 0.3 * fast, R, 1));
  // hub cap
  const hg = ctx.createRadialGradient(-sw * 0.3, -sw * 0.3, 1, 0, 0, sw * 1.4); hg.addColorStop(0, '#fff6d0'); hg.addColorStop(1, '#8a6420');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, sw * 1.2, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- small effects (leaves in the wind, sparkles) ------------------------------------------------------------------------
export function stepFx(parts, dt, cond, t, cam) {
  for (const q of parts) {
    q.t += dt;
    if (q.spark) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 2 * dt; q.life -= dt * 1.4; q.a += dt * 3; continue; }
    const w = cond ? windAt(cond, q.y, t) : 0;
    q.vx += (w * 1.1 - q.vx) * Math.min(1, dt * 0.9);
    q.x += q.vx * dt; q.y += (q.vy + Math.sin(q.t * 2 + q.ph) * 0.9) * dt; q.a += dt * (1 + Math.sin(q.t + q.ph));
    q.life = 1;
  }
  // recycle leaves that left the view; sparks die
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    if (q.spark ? q.life <= 0 : (cam && (Math.abs(q.x - cam.x) > 70 || q.y < -4)) ) parts.splice(i, 1);
  }
}
export function burst(parts, rng, x, y, n, col = '#ffd870') {
  for (let i = 0; i < n; i++) {
    const a = rng.next() * TAU, v = 2 + rng.next() * 5;
    parts.push({ spark: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 1, a: 0, r: 1, col, life: 1, t: 0, ph: 0 });
  }
}
export const LEAF = [['#7fc15a', '#a8d56a', '#e9c46a'], ['#8fcf6a', '#c9e08a', '#f2d27a'], ['#ff9eb5', '#ffd0dc', '#ffb36a'], ['#9fb8ff', '#d0dcff', '#bfe6ff']];
export function seedLeaves(parts, rng, cam, scene, n) {
  const cols = LEAF[scene];
  while (parts.length < n) {
    parts.push({ x: cam.x + (rng.next() - 0.5) * 120, y: cam.y + (rng.next() - 0.45) * 70, vx: 0, vy: -0.2 - rng.next() * 0.5, a: rng.next() * TAU, r: 1 + rng.next() * 1.2, col: cols[rng.int(cols.length)], t: 0, ph: rng.next() * 6, life: 1, spark: false });
  }
}
