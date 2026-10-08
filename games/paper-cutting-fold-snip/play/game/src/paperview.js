// Software 3D paper: camera, paper textures with the cuts baked in as real holes, shading and shadows.
// Reads faces from paper.js and draws them; changes nothing in the game.
import { mApply } from './paper.js';

export const UI_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// ---- camera -------------------------------------------------------------------------------------------------------------------------
// Flat table coordinates are in sheet units (the whole sheet is about 1 x 1). The camera looks down on the table, tilted back a little,
// and `roll` turns the table in its own plane (so a folded wedge can point upwards on screen).
export function makeCam(over = {}) {
  const c = { x: 0, y: 0, S: 400, cx: 0, cy: 0, tilt: 0.42, yaw: 0, roll: 0, k: 0.22, ...over };
  c.ct = Math.cos(c.tilt); c.st = Math.sin(c.tilt); c.cy_ = Math.cos(c.yaw); c.sy_ = Math.sin(c.yaw); c.cr = Math.cos(c.roll); c.sr = Math.sin(c.roll);
  return c;
}
export function project(cam, p) {
  let x = p[0] - cam.cx, y = p[1] - cam.cy, z = p[2];
  if (cam.roll) { const x1 = x * cam.cr - y * cam.sr; y = x * cam.sr + y * cam.cr; x = x1; }
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
  let x = (sx - cam.x) / (cam.S * f), y = y2;
  if (cam.roll) { const x1 = x * cam.cr + y * cam.sr; y = -x * cam.sr + y * cam.cr; x = x1; }
  return [cam.cx + x, cam.cy + y];
}
export function lerpCam(a, b, t) {
  const o = {};
  for (const k of ['x', 'y', 'S', 'cx', 'cy', 'tilt', 'yaw', 'roll', 'k']) o[k] = a[k] + (b[k] - a[k]) * t;
  return makeCam(o);
}

// ---- tiny deterministic hash (patterns must be identical every time) -------------------------------------------------------
const hash = (n) => { let h = Math.imul(Math.floor(n) ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---- papers ------------------------------------------------------------------------------------------------------------------------
// c0/c1: the front gradient, back: the plain reverse, mat: the cutting mat it lies on (holes show it), edge: dark rim colour for cut edges.
export const PAPERS = {
  red: { name: 'Vermilion', c0: '#d32f20', c1: '#ad1c15', back: '#df4c3a', mat: '#f4ecd9', edge: 'rgba(60,6,4,0.6)', grain: 0.07 },
  crimson: { name: 'Crimson', c0: '#ac1a2e', c1: '#86102a', back: '#bd3448', mat: '#f2e7d6', edge: 'rgba(50,4,12,0.6)', grain: 0.07 },
  gold: { name: 'Gold', c0: '#e8b238', c1: '#c68e1b', back: '#efc260', mat: '#2e1a17', edge: 'rgba(80,44,4,0.55)', grain: 0.06 },
  white: { name: 'White', c0: '#f8f4ec', c1: '#e7e0d1', back: '#efe9dc', mat: '#1f2c4d', edge: 'rgba(60,50,40,0.45)', grain: 0.05 },
  snow: { name: 'Snow', c0: '#f6f3ee', c1: '#e2dccf', back: '#ece6d9', mat: '#27324f', edge: 'rgba(60,50,40,0.45)', grain: 0.05 },
  black: { name: 'Black', c0: '#2b2830', c1: '#16141a', back: '#34313a', mat: '#f5f0e5', edge: 'rgba(0,0,0,0.6)', grain: 0.1 },
  poppy: { name: 'Poppy', c0: '#e03d22', c1: '#bd2a17', back: '#e95b42', mat: '#f5eddb', edge: 'rgba(70,10,4,0.6)', grain: 0.07 },
  forest: { name: 'Forest', c0: '#26805a', c1: '#175c3d', back: '#3e9672', mat: '#f5eddb', edge: 'rgba(4,40,24,0.6)', grain: 0.07 },
  cobalt: { name: 'Cobalt', c0: '#3060b8', c1: '#203f8c', back: '#527bc8', mat: '#f4efe2', edge: 'rgba(6,16,60,0.6)', grain: 0.07 },
  pink: { name: 'Rose', c0: '#ea5ea0', c1: '#cf3d89', back: '#f07db1', mat: '#f4efe3', edge: 'rgba(80,6,40,0.55)', grain: 0.06 },
  turquoise: { name: 'Turquoise', c0: '#1bb0aa', c1: '#0e8c88', back: '#3fbeb8', mat: '#f4ecd9', edge: 'rgba(0,50,48,0.55)', grain: 0.06 },
  orange: { name: 'Marigold', c0: '#f58a22', c1: '#d96a0e', back: '#f89c46', mat: '#f4ecd9', edge: 'rgba(80,30,0,0.55)', grain: 0.06 },
  yellow: { name: 'Sunflower', c0: '#f5cb1f', c1: '#dba90c', back: '#f7d54e', mat: '#272c55', edge: 'rgba(80,60,0,0.5)', grain: 0.06 },
};
export const PAPER_IDS = Object.keys(PAPERS);

const mk = (n) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(n, n) : null);

function fibres(g, N, seed, a) {
  for (let i = 0; i < N * 3; i++) {
    const x = hash(i * 3 + seed) * N, y = hash(i * 3 + 1 + seed) * N, l = 5 + hash(i * 3 + 2 + seed) * 22, an = hash(i * 7 + seed) * 6.283;
    g.strokeStyle = hash(i + 99 + seed) < 0.5 ? `rgba(255,248,232,${a})` : `rgba(70,20,10,${a * 0.8})`;
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke();
  }
}
function mottle(g, N, seed, a) {
  for (let i = 0; i < 70; i++) {
    const x = hash(i * 5 + seed) * N, y = hash(i * 5 + 1 + seed) * N, r = N * (0.04 + hash(i * 5 + 2 + seed) * 0.12);
    const lg = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = hash(i * 5 + 3 + seed) < 0.5;
    lg.addColorStop(0, dark ? `rgba(40,0,0,${a})` : `rgba(255,255,255,${a})`); lg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

const baseCache = new Map();
// the plain paper (front and back, no cuts): { front, back } canvases, or nulls where OffscreenCanvas does not exist (tests)
export function getPaper(id) {
  const key = PAPERS[id] ? id : 'red';
  let out = baseCache.get(key);
  if (out) return out;
  const def = PAPERS[key];
  out = { id: key, def, base: def.c0, backColor: def.back, front: null, back: null };
  const F = mk(1024), B = mk(1024);
  if (F && B) {
    const N = 1024, g = F.getContext('2d');
    const bg = g.createLinearGradient(0, 0, N, N); bg.addColorStop(0, def.c0); bg.addColorStop(1, def.c1);
    g.fillStyle = bg; g.fillRect(0, 0, N, N);
    mottle(g, N, 11, 0.07); fibres(g, N, 11, def.grain);
    const vg = g.createRadialGradient(N / 2, N / 2, 300, N / 2, N / 2, 760); vg.addColorStop(0, 'rgba(255,255,255,0.05)'); vg.addColorStop(1, 'rgba(20,0,0,0.12)');
    g.fillStyle = vg; g.fillRect(0, 0, N, N);
    const b = B.getContext('2d');
    b.fillStyle = def.back; b.fillRect(0, 0, N, N);
    mottle(b, N, 5, 0.06); fibres(b, N, 5, def.grain * 0.9);
    out.front = F; out.back = B;
  }
  if (baseCache.size > 6) baseCache.delete(baseCache.keys().next().value);
  baseCache.set(key, out);
  return out;
}

// ---- cuts baked into the paper -------------------------------------------------------------------------------------------------------
// layers: [{ sheet: polygon of this layer in sheet space, inv: matrix flat -> sheet }]; cutPolys: polygons in flat wedge coordinates.
// Every cut is drawn through every layer's matrix, so the symmetric pattern is exactly what the folds produce. creases: [{p,q}] in sheet space.
const cutCache = new Map();
let maskCv = null;
export function bakeCut(paperId, key, layers, cutPolys, sheetPts, creases) {
  const ck = `${paperId}|${key}`;
  if (cutCache.has(ck)) return cutCache.get(ck);
  const base = getPaper(paperId), N = 1024;
  const out = { id: base.id, def: base.def, base: base.base, backColor: base.backColor, front: null, back: null, baked: true, holes: cutPolys.length > 0 };
  if (base.front) {
    if (!maskCv) maskCv = mk(N);
    const m = maskCv.getContext('2d');
    m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, N, N); m.fillStyle = '#000';
    for (const L of layers) {
      m.save();
      // the clip is a hair larger than the layer so two halves of one hole never leave an anti-aliased seam along a fold
      const cx = L.sheet.reduce((s, p) => s + p[0], 0) / L.sheet.length, cy = L.sheet.reduce((s, p) => s + p[1], 0) / L.sheet.length;
      m.beginPath(); L.sheet.forEach((p, i) => m[i ? 'lineTo' : 'moveTo']((cx + (p[0] - cx) * 1.004 + 0.5) * N, (cy + (p[1] - cy) * 1.004 + 0.5) * N)); m.closePath(); m.clip();
      const a = L.inv; m.setTransform(N * a[0], N * a[1], N * a[2], N * a[3], N * (a[4] + 0.5), N * (a[5] + 0.5));
      for (const poly of cutPolys) { m.beginPath(); poly.forEach((p, i) => m[i ? 'lineTo' : 'moveTo'](p[0], p[1])); m.closePath(); m.fill(); }
      m.restore();
    }
    const finish = (src, back) => {
      const T = mk(N), g = T.getContext('2d');
      g.drawImage(src, 0, 0);
      // shape the sheet: the paper outside the polygon is transparent (the textures are plain squares)
      g.globalCompositeOperation = 'destination-in';
      g.beginPath(); sheetPts.forEach((p, i) => g[i ? 'lineTo' : 'moveTo']((p[0] + 0.5) * N, (p[1] + 0.5) * N)); g.closePath(); g.fillStyle = '#000'; g.fill();
      g.globalCompositeOperation = 'destination-out'; g.drawImage(maskCv, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      // creases first (they live on the paper), then the cut edges, then the outer edge
      for (const c of creases ?? []) {
        const p = [(c.p[0] + 0.5) * N, (c.p[1] + 0.5) * N], q = [(c.q[0] + 0.5) * N, (c.q[1] + 0.5) * N], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * 1.6, ny = (dx / l) * 1.6;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.strokeStyle = 'rgba(40,10,6,0.10)'; g.lineWidth = 9; g.stroke();
        g.strokeStyle = 'rgba(40,10,6,0.34)'; g.lineWidth = 2.4; g.stroke();
        g.beginPath(); g.moveTo(p[0] + nx, p[1] + ny); g.lineTo(q[0] + nx, q[1] + ny); g.strokeStyle = 'rgba(255,255,255,0.32)'; g.lineWidth = 1.6; g.stroke();
      }
      if (cutPolys.length) {
        g.save(); g.shadowColor = base.def.edge; g.shadowBlur = 10; g.shadowOffsetX = N * 3 + 4; g.shadowOffsetY = 5; g.drawImage(maskCv, -N * 3, 0); g.restore();
        g.save(); g.shadowColor = back ? 'rgba(255,240,230,0.25)' : 'rgba(255,244,230,0.42)'; g.shadowBlur = 3; g.shadowOffsetX = N * 3 - 2; g.shadowOffsetY = -2; g.drawImage(maskCv, -N * 3, 0); g.restore();
      }
      g.beginPath(); sheetPts.forEach((p, i) => g[i ? 'lineTo' : 'moveTo']((p[0] + 0.5) * N, (p[1] + 0.5) * N)); g.closePath();
      g.strokeStyle = base.def.edge; g.lineWidth = 3; g.lineJoin = 'round'; g.stroke();
      g.globalCompositeOperation = 'source-over';
      return T;
    };
    out.front = finish(base.front, false);
    out.back = finish(base.back, true);
  }
  if (cutCache.size > 4) cutCache.delete(cutCache.keys().next().value);
  cutCache.set(ck, out);
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

// Draw one face. opts: { shadow, flatShade }. A baked paper has its holes, creases and rim in the texture, so nothing is filled or outlined here.
export function drawFace(ctx, F, cam, paper, creases, opts = {}) {
  const P = F.pts3.map((p) => project(cam, p));
  const ar = signedArea(P);
  if (Math.abs(ar) < 0.5) return;
  const front = ar > 0;
  const A = faceAffine(F, cam);
  const scale = Math.sqrt(Math.abs(A[0] * A[3] - A[1] * A[2])) || 1;
  const nrm = cross3(F.Eu, F.Ev), nl = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1;
  const lit = Math.abs((nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2]) / nl);
  const delta = (lit - FLAT_LIT) / FLAT_LIT;
  const baseColor = front ? paper.base : paper.backColor;
  const baked = Boolean(paper.baked);
  ctx.save();
  polyPath(ctx, P);
  if (!baked) {
    if (opts.shadow) { ctx.shadowColor = 'rgba(30,8,4,0.4)'; ctx.shadowBlur = opts.shadowBlur ?? 6; ctx.shadowOffsetX = 0.6; ctx.shadowOffsetY = opts.shadowDy ?? 1.8; }
    ctx.fillStyle = baseColor; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  }
  ctx.clip();
  const tex = front ? paper.front : paper.back;
  ctx.save();
  ctx.transform(A[0], A[1], A[2], A[3], A[4], A[5]);
  if (tex) ctx.drawImage(tex, -0.5, -0.5, 1, 1);
  if (!baked && creases && creases.length) {
    const w1 = 1.5 / scale, w2 = 1 / scale;
    for (const c of creases) {
      const dx = c.q[0] - c.p[0], dy = c.q[1] - c.p[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * 0.9 / scale, ny = dx / l * 0.9 / scale;
      ctx.beginPath(); ctx.moveTo(c.p[0], c.p[1]); ctx.lineTo(c.q[0], c.q[1]);
      ctx.strokeStyle = 'rgba(50,10,6,0.12)'; ctx.lineWidth = w1 * 4; ctx.stroke();
      ctx.strokeStyle = 'rgba(50,10,6,0.45)'; ctx.lineWidth = w1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.p[0] + nx, c.p[1] + ny); ctx.lineTo(c.q[0] + nx, c.q[1] + ny);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = w2; ctx.stroke();
    }
  }
  ctx.restore();
  const shade = !baked || !opts.direct;
  if (baked && shade) ctx.globalCompositeOperation = 'source-atop';
  if (!shade) { /* direct draw onto the screen: no shading overlay, it would tint what is behind the holes */ }
  else if (delta < -0.01) { ctx.fillStyle = `rgba(30,10,6,${Math.min(0.5, -delta * 0.62)})`; ctx.fillRect(-1e4, -1e4, 2e4, 2e4); }
  else if (delta > 0.01) { ctx.fillStyle = `rgba(255,252,240,${Math.min(0.3, delta * 0.55)})`; ctx.fillRect(-1e4, -1e4, 2e4, 2e4); }
  if (opts.sheen && shade) {
    const g = ctx.createLinearGradient(P[0][0], P[0][1], P[Math.floor(P.length / 2)][0], P[Math.floor(P.length / 2)][1]);
    g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-1e4, -1e4, 2e4, 2e4);
  }
  ctx.restore();
  if (!baked) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < P.length; i++) {
      if (F.skip && F.skip[i]) continue;
      const q = P[(i + 1) % P.length];
      ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(q[0], q[1]);
    }
    ctx.strokeStyle = 'rgba(60,15,8,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.restore();
  }
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
  ctx.shadowColor = `rgba(40,12,6,${Math.min(0.5, 0.14 + maxLift * 0.9)})`;
  ctx.shadowBlur = 10 + maxLift * cam.S * 0.25; ctx.shadowOffsetX = -9999;
  ctx.fillStyle = '#000'; ctx.fill();
  ctx.restore();
}

// Draw a list of faces. mode 'fold': static faces first, moving ones over (valley); otherwise painter's depth sort.
export function drawFaces(ctx, faces, cam, paper, creases, mode = {}) {
  let order;
  if (mode.fold) {
    const fixed = faces.filter((F) => !F.moving).sort((a, b) => a.z - b.z);
    const mv = faces.filter((F) => F.moving);
    const folded = mode.theta > Math.PI / 2;
    mv.sort((a, b) => (folded ? b.z - a.z : a.z - b.z));
    order = mode.kind === 'mountain' ? [...mv, ...fixed] : [...fixed, ...mv];
    if (!paper.baked) drawLiftShadow(ctx, faces, cam);
  } else {
    order = faces.map((F) => ({ F, k: project(cam, F.c3)[2] * 4 + F.z * 1e-3 }));
    order.sort((a, b) => a.k - b.k);
    order = order.map((o) => o.F);
  }
  const single = order.length < 2;
  for (const F of order) {
    const flatLayer = !F.moving && !F.posed;
    drawFace(ctx, F, cam, paper, creases, { shadow: flatLayer && !single && !mode.noShadow, shadowBlur: 5, shadowDy: 1.6, sheen: F.moving, direct: mode.direct });
  }
}

export const maxLiftOf = (faces) => faces.reduce((m, F) => Math.max(m, F.lift ?? 0), 0);

// ---- the scene layer: paper drawn on a transparent canvas, then composited with ONE soft shadow so holes let the mat show through ------------------
let layerCv = null, layerKey = '';
export function getLayer(w, h, scale) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const cw = Math.max(2, Math.round(w * scale)), ch = Math.max(2, Math.round(h * scale)), key = `${cw}x${ch}`;
  if (!layerCv || layerKey !== key) { layerCv = new OffscreenCanvas(cw, ch); layerKey = key; }
  return { canvas: layerCv, ctx: layerCv.getContext('2d'), cw, ch };
}

export { mApply };
