// Software 3D paper: camera, textures (washi patterns baked once into offscreen canvases), shading and shadows.
// Reads faces from paper.js and draws them; changes nothing in the game.
import { mApply } from './paper.js';

const UI_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export { UI_FONT };

// ---- camera -------------------------------------------------------------------------------------------------------------------------
// Flat table coordinates are in sheet units (the whole sheet is 1 x 1). The camera looks down on the table, tilted back a little.
export function makeCam(over = {}) {
  const c = { x: 0, y: 0, S: 400, cx: 0, cy: 0, tilt: 0.42, yaw: 0, k: 0.22, ...over };
  c.ct = Math.cos(c.tilt); c.st = Math.sin(c.tilt); c.cy_ = Math.cos(c.yaw); c.sy_ = Math.sin(c.yaw);
  return c;
}
export function project(cam, p) {
  let x = p[0] - cam.cx, y = p[1] - cam.cy, z = p[2];
  if (cam.yaw) { const x2 = x * cam.cy_ + z * cam.sy_; z = -x * cam.sy_ + z * cam.cy_; x = x2; }
  const y2 = y * cam.ct - z * cam.st, z2 = y * cam.st + z * cam.ct;
  const f = 1 / (1 - cam.k * z2);
  return [cam.x + cam.S * x * f, cam.y + cam.S * y2 * f, z2];
}
// screen point -> table point (z = 0); valid for yaw = 0 which is what play uses
export function unproject(cam, sx, sy) {
  const v = (sy - cam.y) / cam.S;
  const y2 = v / (cam.ct + cam.k * cam.st * v);
  const f = 1 / (1 - cam.k * y2 * cam.st);
  return [cam.cx + (sx - cam.x) / (cam.S * f), cam.cy + y2];
}
export function lerpCam(a, b, t) {
  const o = {};
  for (const k of ['x', 'y', 'S', 'cx', 'cy', 'tilt', 'yaw', 'k']) o[k] = a[k] + (b[k] - a[k]) * t;
  return makeCam(o);
}

// ---- tiny deterministic hash (patterns must be identical every time) -------------------------------------------------------
const hash = (n) => { let h = Math.imul(Math.floor(n) ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---- papers -------------------------------------------------------------------------------------------------------------------------
// Each paper is a chiyogami-style pattern on the front and a plain tinted back. `base`/`back` are the fallback flat colours.
export const PAPERS = {
  waves: { name: 'Waves', base: '#2d5f93', back: '#f3ead6', accent: '#2d5f93', draw: seigaiha },
  hemp: { name: 'Hemp leaf', base: '#c8452f', back: '#f6ecd8', accent: '#c8452f', draw: asanoha },
  blossom: { name: 'Blossom', base: '#f0b5c2', back: '#fbf3e6', accent: '#e07a92', draw: sakura },
  dots: { name: 'Dots', base: '#1f6f78', back: '#efe3c3', accent: '#1f6f78', draw: polka },
  stripes: { name: 'Stripes', base: '#3a7a58', back: '#f4ecd7', accent: '#3a7a58', draw: shima },
  kraft: { name: 'Kraft', base: '#b98a57', back: '#f4e9d2', accent: '#b98a57', draw: kraft },
  gold: { name: 'Gold leaf', base: '#d9a93b', back: '#f7ecd3', accent: '#b8821d', draw: kikko },
};
export const PAPER_IDS = Object.keys(PAPERS);

function fibres(g, N, seed, a) {
  for (let i = 0; i < N * 7; i++) {
    const x = hash(i * 3 + seed) * N, y = hash(i * 3 + 1 + seed) * N, l = 4 + hash(i * 3 + 2 + seed) * 16, an = hash(i * 7 + seed) * 6.283;
    g.strokeStyle = hash(i + 99 + seed) < 0.5 ? `rgba(255,250,235,${a})` : `rgba(70,50,30,${a * 0.8})`;
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke();
  }
}

function seigaiha(g, N) {
  const bg = g.createLinearGradient(0, 0, N, N);
  bg.addColorStop(0, '#23507f'); bg.addColorStop(1, '#3a73a8');
  g.fillStyle = bg; g.fillRect(0, 0, N, N);
  const R = N / 11;
  for (let row = -1; row < 28; row++) {
    for (let col = -1; col < 13; col++) {
      const cx = col * R + (row % 2 ? R / 2 : 0), cy = row * R * 0.5;
      for (let k = 0; k < 4; k++) {
        const r = R * (0.5 - k * 0.12);
        g.beginPath(); g.arc(cx, cy, r, 0, 6.2832);
        g.fillStyle = k % 2 === 0 ? '#e9f1f7' : '#2b5c8d'; g.fill();
        g.lineWidth = 1.4; g.strokeStyle = 'rgba(20,45,75,0.55)'; g.stroke();
      }
      g.beginPath(); g.arc(cx, cy, R * 0.07, 0, 6.2832); g.fillStyle = '#e9f1f7'; g.fill();
    }
  }
}

function asanoha(g, N) {
  g.fillStyle = '#c4402b'; g.fillRect(0, 0, N, N);
  const L = N / 8, H = L * Math.sqrt(3) / 2;
  g.lineCap = 'round';
  for (let r = -1; r < 10; r++) {
    for (let c = -1; c < 10; c++) {
      const x = c * L + (r % 2 ? L / 2 : 0), y = r * H;
      const tris = [[[x, y], [x + L, y], [x + L / 2, y + H]], [[x + L / 2, y + H], [x - L / 2, y + H], [x, y]]];
      for (const t of tris) {
        const gx = (t[0][0] + t[1][0] + t[2][0]) / 3, gy = (t[0][1] + t[1][1] + t[2][1]) / 3;
        g.strokeStyle = 'rgba(250,226,196,0.85)'; g.lineWidth = 1.6;
        g.beginPath();
        for (const p of t) { g.moveTo(p[0], p[1]); g.lineTo(gx, gy); }
        g.stroke();
        g.strokeStyle = 'rgba(250,226,196,0.35)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(t[0][0], t[0][1]); g.lineTo(t[1][0], t[1][1]); g.lineTo(t[2][0], t[2][1]); g.closePath(); g.stroke();
      }
    }
  }
}

function sakura(g, N) {
  const bg = g.createLinearGradient(0, 0, 0, N);
  bg.addColorStop(0, '#f5c6d0'); bg.addColorStop(1, '#eea7b8');
  g.fillStyle = bg; g.fillRect(0, 0, N, N);
  const G = 7;
  for (let i = 0; i < G * G * 2; i++) {
    const gx = i % G, gy = Math.floor(i / G) % G, j = hash(i * 5 + 1);
    const x = (gx + 0.25 + hash(i * 5 + 2) * 0.5 + (i >= G * G ? 0.5 : 0)) * N / G, y = (gy + 0.25 + hash(i * 5 + 3) * 0.5 + (i >= G * G ? 0.5 : 0)) * N / G;
    const r = N / G * (0.2 + 0.14 * j), rot = hash(i * 5 + 4) * 6.283;
    g.save(); g.translate(x, y); g.rotate(rot);
    for (let p = 0; p < 5; p++) {
      g.rotate(6.2832 / 5);
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(r * 0.55, -r * 0.2, r * 0.7, -r * 0.95, 0, -r); g.bezierCurveTo(-r * 0.7, -r * 0.95, -r * 0.55, -r * 0.2, 0, 0);
      g.fillStyle = '#fff6f4'; g.fill(); g.strokeStyle = 'rgba(214,110,134,0.55)'; g.lineWidth = 1.2; g.stroke();
    }
    g.beginPath(); g.arc(0, 0, r * 0.14, 0, 6.2832); g.fillStyle = '#e0a02f'; g.fill();
    g.restore();
  }
}

function polka(g, N) {
  g.fillStyle = '#1b6870'; g.fillRect(0, 0, N, N);
  const G = 14;
  for (let r = 0; r < G + 1; r++) for (let c = 0; c < G + 1; c++) {
    const x = (c + (r % 2 ? 0.5 : 0)) * N / G, y = r * N / G;
    g.beginPath(); g.arc(x, y, N / G * 0.2, 0, 6.2832); g.fillStyle = '#f3e8c8'; g.fill();
    g.beginPath(); g.arc(x + N / G * 0.25, y + N / G * 0.5, N / G * 0.07, 0, 6.2832); g.fillStyle = '#e9b86a'; g.fill();
  }
}

function shima(g, N) {
  g.fillStyle = '#f2ead3'; g.fillRect(0, 0, N, N);
  const W = N / 16;
  for (let i = 0; i < 17; i++) {
    g.fillStyle = i % 2 ? '#2d6b4d' : '#3d8460'; if (i % 4 === 0) g.fillStyle = '#f2ead3';
    g.fillRect(i * W, 0, W, N);
    g.fillStyle = 'rgba(214,170,70,0.9)'; g.fillRect(i * W + W * 0.46, 0, 2.5, N);
  }
  g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1;
  for (let y = 0; y < N; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(N, y); g.stroke(); }
}

function kraft(g, N) {
  const bg = g.createLinearGradient(0, 0, N, N);
  bg.addColorStop(0, '#c49563'); bg.addColorStop(1, '#ad7f4d');
  g.fillStyle = bg; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) {
    const x = hash(i * 2 + 5) * N, y = hash(i * 2 + 6) * N, r = 1 + hash(i + 40) * 3;
    g.fillStyle = hash(i + 7) < 0.5 ? 'rgba(110,70,35,0.10)' : 'rgba(255,235,200,0.10)';
    g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
}

function kikko(g, N) {
  const bg = g.createLinearGradient(0, 0, N, N);
  bg.addColorStop(0, '#e1b44c'); bg.addColorStop(0.5, '#f0cf78'); bg.addColorStop(1, '#d19a2c');
  g.fillStyle = bg; g.fillRect(0, 0, N, N);
  const R = N / 12;
  for (let r = -1; r < 18; r++) for (let c = -1; c < 14; c++) {
    const x = c * R * 1.5, y = r * R * 0.866 * 2 + (c % 2 ? R * 0.866 : 0);
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * R * 0.92, y + Math.sin(a) * R * 0.92); }
    g.closePath(); g.strokeStyle = 'rgba(130,86,20,0.55)'; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.arc(x, y, R * 0.28, 0, 6.2832); g.strokeStyle = 'rgba(130,86,20,0.35)'; g.lineWidth = 1.5; g.stroke();
  }
}

const cache = new Map();
const queue = [];
// A paper that is not baked yet is asked for here and baked one per frame (bakeStep), so a screen full of thumbnails never stalls.
export function peekPaper(id, back) {
  const key0 = PAPERS[id] ? id : 'waves', key = back ? `${key0}|${back}` : key0;
  if (cache.has(key)) return cache.get(key);
  if (!queue.some((q) => q[2] === key)) queue.push([id, back, key]);
  const def = PAPERS[key0];
  return { id: key0, base: def.base, backColor: back || def.back, accent: def.accent, front: null, back: null, pending: true };
}
export function bakeStep() { const q = queue.shift(); if (q) getPaper(q[0], q[1]); }
const mk = (n) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(n, n) : null);
// Bake the textures of one paper (about 20-40 ms). Returns { front, back, base, backColor } with canvases null when unavailable (tests).
export function getPaper(id, backOverride) {
  const key0 = PAPERS[id] ? id : 'waves', key = backOverride ? `${key0}|${backOverride}` : key0;
  if (cache.has(key)) return cache.get(key);
  const def0 = PAPERS[key0], def = { ...def0, back: backOverride || def0.back }, out = { id: key0, base: def.base, backColor: def.back, accent: def.accent, front: null, back: null };
  const F = mk(1024), B = mk(512);
  if (F && B) {
    const g = F.getContext('2d');
    def.draw(g, 1024);
    fibres(g, 1024, 11, 0.05);
    const vg = g.createRadialGradient(512, 512, 300, 512, 512, 760);
    vg.addColorStop(0, 'rgba(255,255,255,0.06)'); vg.addColorStop(1, 'rgba(60,40,20,0.1)');
    g.fillStyle = vg; g.fillRect(0, 0, 1024, 1024);
    const b = B.getContext('2d');
    b.fillStyle = def.back; b.fillRect(0, 0, 512, 512);
    fibres(b, 512, 5, 0.07);
    const bv = b.createRadialGradient(256, 256, 150, 256, 256, 380);
    bv.addColorStop(0, 'rgba(255,255,255,0.1)'); bv.addColorStop(1, 'rgba(120,90,50,0.1)');
    b.fillStyle = bv; b.fillRect(0, 0, 512, 512);
    out.front = F; out.back = B;
  }
  if (cache.size > 9) cache.delete(cache.keys().next().value);
  cache.set(key, out);
  return out;
}

// ---- drawing ------------------------------------------------------------------------------------------------------------------------
const LIGHT = (() => { const l = [-0.35, -0.5, 0.8], n = Math.hypot(...l); return l.map((v) => v / n); })();
const FLAT_LIT = LIGHT[2];

function polyPath(ctx, P) {
  ctx.beginPath();
  ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
  ctx.closePath();
}
const signedArea = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// screen affine (sheet u,v -> px) for a face, linearised at the face centre
function faceAffine(F, cam) {
  const e = 0.03;
  const c = project(cam, F.c3);
  const pu = project(cam, [F.c3[0] + F.Eu[0] * e, F.c3[1] + F.Eu[1] * e, F.c3[2] + F.Eu[2] * e]);
  const pv = project(cam, [F.c3[0] + F.Ev[0] * e, F.c3[1] + F.Ev[1] * e, F.c3[2] + F.Ev[2] * e]);
  const ux = (pu[0] - c[0]) / e, uy = (pu[1] - c[1]) / e, vx = (pv[0] - c[0]) / e, vy = (pv[1] - c[1]) / e;
  return [ux, uy, vx, vy, c[0] - F.uv[0] * ux - F.uv[1] * vx, c[1] - F.uv[0] * uy - F.uv[1] * vy];
}

// Draw one face. opts: { paper, creases, shadow (bool: soft contact shadow), flatShade }
export function drawFace(ctx, F, cam, paper, creases, opts = {}) {
  const P = F.pts3.map((p) => project(cam, p));
  const ar = signedArea(P);
  if (Math.abs(ar) < 0.5) return;
  const front = ar > 0;
  const A = faceAffine(F, cam);
  const scale = Math.sqrt(Math.abs(A[0] * A[3] - A[1] * A[2])) || 1;
  // brightness from the face normal
  const nrm = cross3(F.Eu, F.Ev), nl = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1;
  const lit = Math.abs((nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2]) / nl);
  const delta = (lit - FLAT_LIT) / FLAT_LIT;
  const baseColor = front ? paper.base : paper.backColor;
  ctx.save();
  polyPath(ctx, P);
  if (opts.shadow) { ctx.shadowColor = 'rgba(55,35,15,0.38)'; ctx.shadowBlur = opts.shadowBlur ?? 6; ctx.shadowOffsetX = 0.6; ctx.shadowOffsetY = opts.shadowDy ?? 1.8; }
  ctx.fillStyle = baseColor; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.clip();
  const tex = front ? paper.front : paper.back;
  ctx.save();
  ctx.transform(A[0], A[1], A[2], A[3], A[4], A[5]);
  if (tex) ctx.drawImage(tex, -0.5, -0.5, 1, 1);
  // creases: a soft shadow line with a light line beside it, drawn in sheet space so they follow the paper
  if (creases && creases.length) {
    const w1 = 1.5 / scale, w2 = 1 / scale;
    for (const c of creases) {
      const dx = c.q[0] - c.p[0], dy = c.q[1] - c.p[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * 0.9 / scale, ny = dx / l * 0.9 / scale;
      ctx.beginPath(); ctx.moveTo(c.p[0], c.p[1]); ctx.lineTo(c.q[0], c.q[1]);
      ctx.strokeStyle = 'rgba(60,40,25,0.1)'; ctx.lineWidth = w1 * 4; ctx.stroke();
      ctx.strokeStyle = 'rgba(60,40,25,0.42)'; ctx.lineWidth = w1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.p[0] + nx, c.p[1] + ny); ctx.lineTo(c.q[0] + nx, c.q[1] + ny);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = w2; ctx.stroke();
    }
  }
  ctx.restore();
  // lighting overlay
  if (delta < -0.01) { ctx.fillStyle = `rgba(30,18,10,${Math.min(0.5, -delta * 0.62)})`; ctx.fillRect(-1e4, -1e4, 2e4, 2e4); }
  else if (delta > 0.01) { ctx.fillStyle = `rgba(255,252,240,${Math.min(0.3, delta * 0.55)})`; ctx.fillRect(-1e4, -1e4, 2e4, 2e4); }
  if (opts.sheen) { // moving flap: a soft highlight band along the face centre
    const g = ctx.createLinearGradient(P[0][0], P[0][1], P[Math.floor(P.length / 2)][0], P[Math.floor(P.length / 2)][1]);
    g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-1e4, -1e4, 2e4, 2e4);
  }
  ctx.restore();
  // paper edge: thin light rim on top of a thin dark outline
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < P.length; i++) {
    if (F.skip && F.skip[i]) continue;
    const q = P[(i + 1) % P.length];
    ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(q[0], q[1]);
  }
  ctx.strokeStyle = 'rgba(70,45,25,0.38)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.restore();
  return true;
}

// shadow of lifted faces on the table (one soft blob for the whole flap so strips do not double up)
export function drawLiftShadow(ctx, faces, cam) {
  const lifted = faces.filter((F) => F.moving);
  if (!lifted.length) return;
  ctx.save();
  ctx.beginPath();
  for (const F of lifted) {
    const P = F.pts3.map((p) => project(cam, [p[0] + 0.32 * Math.max(0, Math.abs(p[2])), p[1] + 0.24 * Math.max(0, Math.abs(p[2])), 0]));
    ctx.moveTo(P[0][0] + 9999, P[0][1]);
    for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0] + 9999, P[i][1]);
    ctx.closePath();
  }
  const maxLift = Math.max(...lifted.map((F) => F.lift ?? 0));
  ctx.shadowColor = `rgba(50,32,14,${Math.min(0.5, 0.14 + maxLift * 0.9)})`;
  ctx.shadowBlur = 10 + maxLift * cam.S * 0.25; ctx.shadowOffsetX = -9999;
  ctx.fillStyle = '#000'; ctx.fill();
  ctx.restore();
}

// Draw a list of faces. mode 'fold': static faces first, moving ones over (valley) or under (mountain); otherwise painter's depth sort.
export function drawFaces(ctx, faces, cam, paper, creases, mode = {}) {
  let order;
  if (mode.fold) {
    const fixed = faces.filter((F) => !F.moving).sort((a, b) => a.z - b.z);
    const mv = faces.filter((F) => F.moving);
    const folded = mode.theta > Math.PI / 2;
    mv.sort((a, b) => (folded ? b.z - a.z : a.z - b.z));
    order = mode.kind === 'mountain' ? [...mv, ...fixed] : [...fixed, ...mv];
    drawLiftShadow(ctx, faces, cam);
  } else {
    order = faces.map((F) => ({ F, k: project(cam, F.c3)[2] * 4 + F.z * 1e-3 }));
    order.sort((a, b) => a.k - b.k);
    order = order.map((o) => o.F);
    if (mode.posed) {
      // soft ground shadow under a standing model
      ctx.save(); ctx.beginPath();
      for (const F of faces) { const P = F.pts3.map((p) => project(cam, [p[0] + 0.12 * p[2], p[1] + 0.1 * p[2], 0])); ctx.moveTo(P[0][0] + 9999, P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0] + 9999, P[i][1]); ctx.closePath(); }
      ctx.shadowColor = 'rgba(50,32,14,0.35)'; ctx.shadowBlur = 22; ctx.shadowOffsetX = -9999; ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    }
  }
  const single = order.length < 2;
  for (const F of order) {
    const flatLayer = !F.moving && !F.posed;
    drawFace(ctx, F, cam, paper, creases, { shadow: flatLayer && !single && !mode.noShadow, shadowBlur: 5, shadowDy: 1.6, sheen: F.moving });
  }
}

// helper used by decals: a flat table point lifted to the top of the stack
export function flatToScreen(cam, x, y, z = 0) { return project(cam, [x, y, z]); }
export { mApply };

// ---- decals: the little marks drawn on a finished model (flat table coordinates). k = 0..1 how far they have popped in. ----------------------
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const backOut = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
export function drawDecals(ctx, decals, cam, k = 1, z = 0.004) {
  if (!decals || !decals.length) return;
  const n = decals.length;
  decals.forEach((d, i) => {
    const p = clamp01(k * (n + 1.5) - i) ;
    if (p <= 0) return;
    const sc = backOut(p);
    const pr = (x, y) => project(cam, [x, y, z]);
    const S = cam.S;
    ctx.save();
    ctx.globalAlpha = Math.min(1, p * 2);
    if (d.t === 'dot') {
      const [x, y] = pr(d.x, d.y), r = d.r * S * sc;
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, 6.2832);
      if (d.ring) { ctx.strokeStyle = d.c; ctx.lineWidth = Math.max(1, S * 0.008); ctx.stroke(); } else {
        ctx.shadowColor = d.c2 || 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1.5;
        ctx.fillStyle = d.c; ctx.fill();
      }
    } else if (d.t === 'rect') {
      const a = pr(d.x, d.y), b = pr(d.x + d.w, d.y), c = pr(d.x + d.w, d.y + d.h), e = pr(d.x, d.y + d.h);
      const cx = (a[0] + c[0]) / 2, cy = (a[1] + c[1]) / 2;
      ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(e[0], e[1]); ctx.closePath();
      ctx.fillStyle = d.c; ctx.fill();
      if (d.frame) { ctx.strokeStyle = d.frame; ctx.lineWidth = Math.max(1, S * 0.012); ctx.stroke(); }
    } else if (d.t === 'line') {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const q = d.pts.map(([x, y]) => pr(x, y));
      ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]);
      const f = clamp01(p * 1.2);
      for (let i2 = 1; i2 < q.length; i2++) ctx.lineTo(q[0][0] + (q[i2][0] - q[0][0]) * f, q[0][1] + (q[i2][1] - q[0][1]) * f);
      ctx.strokeStyle = d.c; ctx.lineWidth = Math.max(1, d.w * S); ctx.stroke();
    } else if (d.t === 'arc') {
      const [x, y] = pr(d.x, d.y);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y, d.r * S, d.a0, d.a0 + (d.a1 - d.a0) * clamp01(p * 1.2));
      ctx.strokeStyle = d.c; ctx.lineWidth = Math.max(1, d.w * S); ctx.stroke();
    } else if (d.t === 'tail') {
      const pts = [];
      for (let i2 = 0; i2 <= 24; i2++) { const u = i2 / 24; pts.push(pr(d.x + Math.sin(u * 7.5) * 0.045, d.y + u * 0.62 * clamp01(p * 1.3))); }
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]);
      ctx.strokeStyle = 'rgba(70,50,40,0.75)'; ctx.lineWidth = Math.max(1, S * 0.006); ctx.stroke();
      for (let b = 0; b < d.n; b++) {
        const idx = Math.floor(((b + 0.8) / (d.n + 0.4)) * 24);
        if (idx / 24 > clamp01(p * 1.3)) break;
        const q = pts[idx], w = S * 0.05, h = S * 0.032, col = b % 2 ? d.c2 : d.c;
        ctx.fillStyle = col; ctx.strokeStyle = 'rgba(60,30,20,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] - w, q[1] - h); ctx.lineTo(q[0] - w, q[1] + h); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + w, q[1] - h); ctx.lineTo(q[0] + w, q[1] + h); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  });
}
