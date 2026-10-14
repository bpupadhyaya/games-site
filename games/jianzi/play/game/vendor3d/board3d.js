// board3d: premium board / prop scene toolkit (distilled from the Sahkku pilot, generic).
//   import { board3d } from './vendor3d/index.js'   or   import * as B from './vendor3d/board3d.js'
// Everything is procedural (canvas textures, analytic geometry). No image files, no DOM at import time, so the pure parts
// (geometry, tweens, camera fit) also run under `node --test`. Without a DOM, materials fall back to flat colours.
import * as THREE from './three.js';

const TAU = Math.PI * 2;
const hasDom = () => typeof globalThis.document !== 'undefined' && typeof globalThis.document.createElement === 'function';
function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function cv(w, h = w) { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------------------------------------------------------------- geometry
function finish(pos, nor, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Surface of revolution around Y with analytic normals. profile = [[radius, y], ...] bottom to top; repeat a point for a hard edge. */
export function lathe(profile, seg = 40) {
  const n = profile.length, pos = [], nor = [], uv = [], idx = [], prof = profile.map((p) => [p[0], p[1]]), norm = [];
  const same = (a, b) => prof[a][0] === prof[b][0] && prof[a][1] === prof[b][1];
  for (let i = 0; i < n; i++) {
    let a = i - 1, b = i + 1;
    while (a >= 0 && same(a, i)) a--;
    while (b < n && same(b, i)) b++;
    if (a < 0) a = i; if (b >= n) b = i;
    let tr = prof[b][0] - prof[a][0], ty = prof[b][1] - prof[a][1];
    if (i > 0 && same(i - 1, i)) { tr = prof[b][0] - prof[i][0]; ty = prof[b][1] - prof[i][1]; }
    if (i < n - 1 && same(i + 1, i)) { tr = prof[i][0] - prof[a][0]; ty = prof[i][1] - prof[a][1]; }
    const l = Math.hypot(tr, ty) || 1;
    norm.push([ty / l, -tr / l]);
  }
  let total = 0; const cum = [0];
  for (let i = 1; i < n; i++) { total += Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]); cum.push(total); }
  for (let s = 0; s <= seg; s++) {
    const a = (s / seg) * TAU, c = Math.cos(a), si = Math.sin(a);
    for (let i = 0; i < n; i++) {
      pos.push(prof[i][0] * c, prof[i][1], prof[i][0] * si);
      nor.push(norm[i][0] * c, norm[i][1], norm[i][0] * si);
      uv.push(s / seg, total ? cum[i] / total : 0);
    }
  }
  for (let s = 0; s < seg; s++) for (let i = 0; i < n - 1; i++) {
    const a = s * n + i, b = (s + 1) * n + i, c = (s + 1) * n + i + 1, d = s * n + i + 1;
    idx.push(a, d, b, b, d, c);
  }
  return finish(pos, nor, uv, idx);
}

/** Rounded box w x h x d (centred), corner radius r. Smooth normals, UVs from BoxGeometry (6 groups kept). */
export function roundedBox(w = 1, h = 1, d = 1, r = 0.1, seg = 5) {
  r = Math.max(1e-4, Math.min(r, Math.min(w, h, d) / 2 - 1e-4));
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    v.sub(c); const l = v.length() || 1; v.multiplyScalar(r / l);
    nor.setXYZ(i, v.x / r, v.y / r, v.z / r);
    pos.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  pos.needsUpdate = true; nor.needsUpdate = true;
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

function rrOutline(w, d, r, per = 5) {
  r = Math.min(r, w / 2 - 1e-3, d / 2 - 1e-3);
  const pts = [], hx = w / 2 - r, hz = d / 2 - r;
  for (const [cx, cz, k] of [[hx, hz, 0], [-hx, hz, 1], [-hx, -hz, 2], [hx, -hz, 3]]) {
    for (let i = 0; i <= per; i++) {
      const a = (k * 0.5 + (i / per) * 0.5) * Math.PI, nx = Math.cos(a), nz = Math.sin(a);
      pts.push({ x: cx + nx * r, z: cz + nz * r, nx, nz });
    }
  }
  return pts;
}

/** Convex rounded-rect slab, y from 0 to h, top face up, bevel-rounded edges. opts: { seg, per, bottom, uvScale }. Great for tiles, plaques, pedestals. */
export function slab(w, d, h, rad = 0.1, bevel = 0.05, opts = {}) {
  const b = Math.min(bevel, h / 2 - 1e-4, w / 2 - 1e-3, d / 2 - 1e-3);
  const bs = opts.seg ?? 3, out = rrOutline(w, d, rad, opts.per ?? 5), rings = [];
  for (let i = 0; i <= bs; i++) { const t = -Math.PI / 2 + (i / bs) * (Math.PI / 2); rings.push({ inset: b * (1 - Math.cos(t)), y: b * (1 + Math.sin(t)), nr: Math.cos(t), ny: Math.sin(t) }); }
  for (let i = 0; i <= bs; i++) { const t = (i / bs) * (Math.PI / 2); rings.push({ inset: b * (1 - Math.cos(t)), y: h - b + b * Math.sin(t), nr: Math.cos(t), ny: Math.sin(t) }); }
  const pos = [], nor = [], uv = [], idx = [], P = out.length, U = opts.uvScale ?? 1;
  const push = (x, y, z, nx, ny, nz) => { pos.push(x, y, z); nor.push(nx, ny, nz); uv.push((x / w + 0.5) * U, (z / d + 0.5) * U); };
  for (const rg of rings) for (let i = 0; i <= P; i++) { const o = out[i % P]; push(o.x - o.nx * rg.inset, rg.y, o.z - o.nz * rg.inset, o.nx * rg.nr, rg.ny, o.nz * rg.nr); }
  const W = P + 1;
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < P; i++) {
    const a = r * W + i, bb = r * W + i + 1, c = (r + 1) * W + i + 1, dd = (r + 1) * W + i;
    idx.push(a, dd, bb, bb, dd, c);
  }
  const base = pos.length / 3;
  push(0, h, 0, 0, 1, 0);
  for (let i = 0; i <= P; i++) { const o = out[i % P]; push(o.x - o.nx * b, h, o.z - o.nz * b, 0, 1, 0); }
  for (let i = 0; i < P; i++) idx.push(base, base + 2 + i, base + 1 + i);
  if (opts.bottom !== false) {
    const b2 = pos.length / 3; push(0, 0, 0, 0, -1, 0);
    for (let i = 0; i <= P; i++) { const o = out[i % P]; push(o.x - o.nx * b, 0, o.z - o.nz * b, 0, -1, 0); }
    for (let i = 0; i < P; i++) idx.push(b2, b2 + 1 + i, b2 + 2 + i);
  }
  return finish(pos, nor, uv, idx);
}

/** Star / regular polygon outline [[x,z],...]. n points, outer ro, inner ri (ri == ro gives a regular n-gon). */
export function starPoints(n, ro, ri = ro, rot = 0) {
  const p = [], m = ri === ro ? n : n * 2;
  for (let k = 0; k < m; k++) { const a = rot + (k / m) * TAU, r = ri === ro ? ro : (k % 2 ? ri : ro); p.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return p;
}

/** Extruded inlay: points = [[x,z],...] (or a THREE.Shape), laid flat facing up, thickness `depth`, small bevel. Sits on y 0..depth. */
export function inlay(points, depth = 0.03, { bevel = 0.006, curveSegments = 10 } = {}) {
  const shape = points instanceof THREE.Shape ? points : new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  g.computeVertexNormals();
  return g;
}

/** Merge indexed geometries (position/normal/uv) with matrices: parts = [{geo, m}]. */
export function mergeGeos(parts) {
  const pos = [], nor = [], uv = [], idx = []; let off = 0;
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const { geo, m = new THREE.Matrix4() } of parts) {
    const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv, ix = geo.index;
    nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
    }
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  return finish(pos, nor, uv, idx);
}

/** Ready-made lathe piece profiles: 'pawn', 'disc', 'cone', 'tower', 'bell'. Radius/height in board units (base radius r, height h). */
export function pieceProfile(kind = 'pawn', r = 0.3, h = 0.7) {
  const P = (pts) => pts.map(([a, b]) => [a * r, b * h]);
  switch (kind) {
    case 'disc': return P([[0, 0], [0.96, 0], [1, 0.06], [1, 0.7], [0.94, 0.9], [0.8, 0.96], [0, 0.96]]);
    case 'cone': return P([[0, 0], [1, 0], [1, 0.05], [0.82, 0.12], [0.5, 0.5], [0.22, 0.88], [0.26, 0.93], [0, 1]]);
    case 'tower': return P([[0, 0], [1, 0], [1, 0.08], [0.75, 0.14], [0.62, 0.2], [0.62, 0.72], [0.8, 0.78], [0.8, 0.92], [0.64, 0.92], [0.64, 0.86], [0, 0.86]]);
    case 'bell': return P([[0, 0], [1, 0], [1, 0.06], [0.7, 0.14], [0.45, 0.4], [0.32, 0.7], [0.36, 0.78], [0.22, 0.82], [0, 1]]);
    default: return P([[0, 0], [1, 0], [1, 0.06], [0.82, 0.12], [0.5, 0.2], [0.34, 0.45], [0.34, 0.6], [0.5, 0.64], [0.5, 0.7], [0.4, 0.74], [0.5, 0.82], [0.4, 0.96], [0.2, 1], [0, 1]]);
  }
}
/** Lathe piece from a profile array. Shortcut: piece(pieceProfile('pawn', .3, .7), material). */
export function piece(profile, material, seg = 40) { const m = new THREE.Mesh(lathe(profile, seg), material); m.castShadow = true; m.receiveShadow = true; return m; }

// ---------------------------------------------------------------- procedural textures + material presets
const texCache = new Map();
function tex(canvas, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function noiseFill(x, size, r, n, a1 = 0.05, a2 = 0.08) { for (let i = 0; i < n; i++) { x.fillStyle = r() < 0.5 ? `rgba(255,255,255,${a1})` : `rgba(0,0,0,${a2})`; x.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2); } }

/** Wood grain canvases { map, bump }. c0/c1 are colour ramp ends. */
export function woodCanvas(size = 512, c0 = '#c8924f', c1 = '#e3b676', seed = 3, o = {}) {
  const c = cv(size), x = c.getContext('2d'), r = rngOf(seed), b = cv(size), bx = b.getContext('2d');
  const g = x.createLinearGradient(0, 0, size, size * 0.3); g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c0);
  x.fillStyle = g; x.fillRect(0, 0, size, size); bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  const lines = o.lines ?? 120;
  for (let i = 0; i < lines; i++) {
    const y = r() * size, amp = 2 + r() * 10, ph = r() * TAU, fr = 0.004 + r() * 0.012, w = 0.5 + r() * 2.2, a = 0.05 + r() * 0.18, dark = r() < 0.7;
    for (const [ctx, col] of [[x, dark ? `rgba(60,30,8,${a})` : `rgba(255,240,200,${a * 0.8})`], [bx, dark ? `rgba(0,0,0,${a * 1.6})` : `rgba(255,255,255,${a})`]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      for (let s = 0; s <= size; s += 8) { const yy = y + Math.sin(s * fr + ph) * amp + Math.sin(s * fr * 2.7 + ph * 2) * amp * 0.3; s ? ctx.lineTo(s, yy) : ctx.moveTo(s, yy); }
      ctx.stroke();
    }
  }
  for (let k = 0; k < (o.knots ?? 2); k++) {
    const kx = r() * size, ky = r() * size, kr = 8 + r() * 18;
    for (let q = 4; q > 0; q--) { x.strokeStyle = `rgba(70,36,12,${0.12 + 0.05 * q})`; x.lineWidth = 1.2; x.beginPath(); x.ellipse(kx, ky, kr * q * 0.5, kr * q * 0.22, 0, 0, TAU); x.stroke(); }
  }
  return { map: c, bump: b };
}
function stoneCanvas(size, c0, c1, seed) {
  const c = cv(size), x = c.getContext('2d'), r = rngOf(seed), b = cv(size), bx = b.getContext('2d');
  const g = x.createRadialGradient(size * 0.4, size * 0.4, 0, size / 2, size / 2, size * 0.8); g.addColorStop(0, c1); g.addColorStop(1, c0);
  x.fillStyle = g; x.fillRect(0, 0, size, size); bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) { const px = r() * size, py = r() * size, rr = 10 + r() * 70; const gr = x.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  noiseFill(x, size, r, 9000, 0.06, 0.09); noiseFill(bx, size, r, 12000, 0.2, 0.2);
  for (let v = 0; v < 5; v++) { x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 0.8 + r(); x.beginPath(); let px = r() * size, py = r() * size; x.moveTo(px, py); for (let s = 0; s < 8; s++) { px += (r() - 0.3) * 60; py += (r() - 0.5) * 60; x.lineTo(px, py); } x.stroke(); }
  return { map: c, bump: b };
}
function clothCanvas(size, c0, c1) {
  const c = cv(size), x = c.getContext('2d'), b = cv(size), bx = b.getContext('2d');
  x.fillStyle = c0; x.fillRect(0, 0, size, size); bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  const step = Math.max(3, size / 128);
  for (let i = 0; i < size; i += step) {
    x.fillStyle = c1; x.globalAlpha = 0.35; x.fillRect(i, 0, step * 0.5, size); x.fillRect(0, i, size, step * 0.5); x.globalAlpha = 1;
    bx.fillStyle = 'rgba(255,255,255,0.35)'; bx.fillRect(i, 0, step * 0.5, size); bx.fillStyle = 'rgba(0,0,0,0.35)'; bx.fillRect(0, i, size, step * 0.5);
  }
  return { map: c, bump: b };
}
function speckleCanvas(size, c0, c1, seed, n = 12000) {
  const c = cv(size), x = c.getContext('2d'), r = rngOf(seed), b = cv(size), bx = b.getContext('2d');
  const g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, c0); g.addColorStop(1, c1);
  x.fillStyle = g; x.fillRect(0, 0, size, size); bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  noiseFill(x, size, r, n, 0.05, 0.1); noiseFill(bx, size, r, n, 0.25, 0.25);
  return { map: c, bump: b };
}

// name -> { build(opts) -> { map?, bump? }, params, physical }
const PRESETS = {
  wood: { c: ['#c8924f', '#e3b676'], tex: (o, s) => woodCanvas(s, o.c0, o.c1, o.seed ?? 3), rough: 0.55, metal: 0, bump: 0.5 },
  darkWood: { c: ['#4a2a16', '#6b4126'], tex: (o, s) => woodCanvas(s, o.c0, o.c1, o.seed ?? 5, { lines: 150 }), rough: 0.45, metal: 0, bump: 0.5, clearcoat: 0.35 },
  stone: { c: ['#7d7a76', '#b3afa8'], tex: (o, s) => stoneCanvas(s, o.c0, o.c1, o.seed ?? 9), rough: 0.78, metal: 0, bump: 0.6 },
  brass: { c: ['#c99a3a', '#f3d27a'], tex: (o, s) => speckleCanvas(s, o.c0, o.c1, o.seed ?? 2, 3000), rough: 0.26, metal: 1, bump: 0.12, env: 3.2 },
  felt: { c: ['#1f5e46', '#0f3b2b'], tex: (o, s) => speckleCanvas(s, o.c0, o.c1, o.seed ?? 7, 16000), rough: 1, metal: 0, bump: 0.8 },
  lacquer: { c: ['#a3141c', '#d02a2a'], tex: null, rough: 0.18, metal: 0, clearcoat: 1, clearcoatRoughness: 0.06 },
  clay: { c: ['#a8573a', '#c97c55'], tex: (o, s) => speckleCanvas(s, o.c0, o.c1, o.seed ?? 4, 9000), rough: 0.9, metal: 0, bump: 0.7 },
  cloth: { c: ['#7a3a2a', '#a86a4c'], tex: (o, s) => clothCanvas(s, o.c0, o.c1), rough: 0.95, metal: 0, bump: 0.9 },
  glass: { c: ['#cfe8f5', '#cfe8f5'], tex: null, rough: 0.05, metal: 0, glass: true, clearcoat: 1, clearcoatRoughness: 0.02 },
  ivory: { c: ['#f3ead2', '#e0d2ad'], tex: (o, s) => speckleCanvas(s, o.c0, o.c1, o.seed ?? 6, 5000), rough: 0.4, metal: 0, bump: 0.25, clearcoat: 0.5, clearcoatRoughness: 0.2 },
};
export const MATERIAL_NAMES = Object.keys(PRESETS);

/**
 * Material preset by name: wood darkWood stone brass felt lacquer clay cloth glass ivory.
 * opts: { color (hex/css, overrides the base), color2, repeat:[u,v], seed, size (texture px, 512), roughness, metalness, envIntensity, physical (force MeshPhysicalMaterial) }
 * Procedural textures are cached per (name,colours,seed). Safe without a DOM (flat colours, used by tests).
 */
export function material(name = 'wood', opts = {}) {
  const p = PRESETS[name];
  if (!p) throw new Error(`board3d.material: unknown preset "${name}". Known: ${MATERIAL_NAMES.join(', ')}`);
  const c0 = opts.color ?? p.c[0], c1 = opts.color2 ?? (opts.color ?? p.c[1]);
  const useCl = p.clearcoat || p.glass || opts.physical;
  const params = { color: new THREE.Color(opts.color ?? p.c[1]), roughness: opts.roughness ?? p.rough, metalness: opts.metalness ?? p.metal };
  if (p.tex && hasDom()) {
    const size = opts.size ?? 512, key = `${name}|${c0}|${c1}|${opts.seed ?? ''}|${size}|${(opts.repeat || []).join(',')}`;
    let e = texCache.get(key);
    if (!e) {
      const cvs = p.tex({ c0, c1, seed: opts.seed }, size);
      e = { map: tex(cvs.map, { repeat: opts.repeat }), bump: tex(cvs.bump, { repeat: opts.repeat, srgb: false }) };
      texCache.set(key, e);
    }
    params.map = e.map; params.bumpMap = e.bump; params.bumpScale = p.bump ?? 0.4; params.color = new THREE.Color(0xffffff);
    if (opts.color && name !== 'brass') params.color = new THREE.Color(0xffffff); // the colour is baked into the texture
  }
  let m;
  if (useCl) {
    m = new THREE.MeshPhysicalMaterial(params);
    m.clearcoat = p.clearcoat ?? 0; m.clearcoatRoughness = p.clearcoatRoughness ?? 0.15;
    if (p.glass) { m.transparent = true; m.opacity = 0.55; m.ior = 1.5; m.depthWrite = false; m.specularIntensity = 1; }
  } else m = new THREE.MeshStandardMaterial(params);
  m.envMapIntensity = opts.envIntensity ?? p.env ?? 1;
  m.name = `b3d:${name}`;
  return m;
}
export function disposeMaterialCache() { for (const e of texCache.values()) { e.map.dispose(); e.bump.dispose(); } texCache.clear(); }

// ---------------------------------------------------------------- shadow blob + glow ring
function radialCanvas(rgb, a, size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
}
function ringCanvas(rgb, size = 128, inner = 0.66) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, size * 0.5 * inner * 0.8, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(inner + 0.04, `rgba(${rgb},0.95)`); g.addColorStop(Math.min(0.98, inner + 0.2), `rgba(${rgb},0.4)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
}
let blobTex = null;
/** Soft contact-shadow blob (a flat plane lying on y). Add as a child of the piece or place beside it. radius in world units. */
export function contactShadow(radius = 0.4, opacity = 0.5) {
  if (!blobTex && hasDom()) blobTex = tex(radialCanvas('0,0,0', 1), { srgb: true });
  const mat = new THREE.MeshBasicMaterial({ map: blobTex || null, color: 0x000000, transparent: true, opacity, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  m.rotation.x = -Math.PI / 2; m.position.y = 0.004; m.renderOrder = 1; m.name = 'contactShadow';
  return m;
}

/** 'Glow ring' legal-move marker: additive soft ring lying on the board. Returns a Mesh with .pulse(t) to animate and .setColor(css). */
export function glowRing(radius = 0.4, color = '#7dffd6') {
  const rgb = (() => { const c = new THREE.Color(color); return `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`; })();
  const t = hasDom() ? tex(ringCanvas(rgb), {}) : null;
  const mat = new THREE.MeshBasicMaterial({ map: t, color: t ? 0xffffff : new THREE.Color(color), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const geo = t ? new THREE.PlaneGeometry(radius * 2, radius * 2) : new THREE.RingGeometry(radius * 0.7, radius, 40);
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 3; m.name = 'glowRing';
  m.pulse = (time, speed = 3) => { const s = 1 + Math.sin(time * speed) * 0.06; m.scale.setScalar(s); mat.opacity = 0.65 + 0.3 * (0.5 + 0.5 * Math.sin(time * speed)); return m; };
  m.setColor = (c) => { if (t) mat.color.set(0xffffff); else mat.color.set(c); return m; };
  return m;
}

// ---------------------------------------------------------------- lighting rigs, fog, vignette, environment
export const RIGS = {
  warmIndoor: { bg: 0x241a14, fog: 0x241a14, hemiSky: 0xffe6c8, hemiGround: 0x3a2a20, hemi: 0.55, key: 0xffd9a8, keyI: 2.6, keyPos: [-4, 8, 5], fill: 0xb8c8ff, fillI: 0.5, fillPos: [6, 3, 5], rim: 0xffb27a, rimI: 1.8, rimPos: [5, 4, -6], exposure: 1.05, env: 0.4 },
  duskOutdoor: { bg: 0x6c6f9c, fog: 0x8d7fa0, hemiSky: 0xffc9a0, hemiGround: 0x3a3a4c, hemi: 0.7, key: 0xffb070, keyI: 2.8, keyPos: [-7, 5, 4], fill: 0x7a96e0, fillI: 0.7, fillPos: [6, 4, 6], rim: 0x9fb4ff, rimI: 2.0, rimPos: [4, 5, -7], exposure: 1.05, env: 0.45 },
  nightAurora: { bg: 0x050a1c, fog: 0x08122c, hemiSky: 0x6f8cff, hemiGround: 0x1a2236, hemi: 0.45, key: 0xdfe8ff, keyI: 1.9, keyPos: [-5, 8, 6], fill: 0x9db8ff, fillI: 0.6, fillPos: [7, 3, 6], rim: 0x72ffd6, rimI: 2.3, rimPos: [6, 4, -7], rim2: 0xb48cff, rim2I: 1.5, exposure: 0.95, env: 0.35 },
};
/**
 * Adds a 3-point rig (+rim) to the scene. name: 'warmIndoor' | 'duskOutdoor' | 'nightAurora'.
 * opts: { renderer (sets toneMappingExposure), shadow: map size, 0 = off (2048), extent (shadow half-size, 6), fog: false|{near,far}, background: true, target:[x,y,z], overrides }
 * Returns { key, fill, rim, rim2?, hemi, group, config, dispose() }.
 */
export function lightingRig(scene, name = 'warmIndoor', opts = {}) {
  const c = { ...(RIGS[name] || RIGS.warmIndoor), ...(opts.overrides || {}) };
  const group = new THREE.Group(); group.name = `rig:${name}`;
  const hemi = new THREE.HemisphereLight(c.hemiSky, c.hemiGround, c.hemi);
  const key = new THREE.DirectionalLight(c.key, c.keyI); key.position.set(...c.keyPos);
  const shadow = opts.shadow ?? 2048, ext = opts.extent ?? 6;
  if (shadow) {
    key.castShadow = true; key.shadow.mapSize.set(shadow, shadow);
    Object.assign(key.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 40 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
  }
  if (opts.target) key.target.position.set(...opts.target);
  const fill = new THREE.DirectionalLight(c.fill, c.fillI); fill.position.set(...c.fillPos);
  const rim = new THREE.DirectionalLight(c.rim, c.rimI); rim.position.set(...c.rimPos);
  group.add(hemi, key, key.target, fill, rim);
  let rim2 = null;
  if (c.rim2) { rim2 = new THREE.DirectionalLight(c.rim2, c.rim2I); rim2.position.set(-c.rimPos[0], c.rimPos[1] - 1, c.rimPos[2] + 1); group.add(rim2); }
  scene.add(group);
  if (opts.background !== false) scene.background = new THREE.Color(c.bg);
  if (opts.fog !== false) atmosphere(scene, { color: c.fog, ...(opts.fog || {}) });
  if (opts.renderer) opts.renderer.toneMappingExposure = c.exposure;
  scene.environmentIntensity = c.env;
  return { key, fill, rim, rim2, hemi, group, config: c, dispose() { scene.remove(group); } };
}

/** Linear fog tuned for a board scene (near/far in world units). */
export function atmosphere(scene, { color = 0x101020, near = 14, far = 40 } = {}) { scene.fog = new THREE.Fog(color, near, far); return scene.fog; }

/** Vignette overlay: a pointer-events:none DIV with a radial gradient, appended to `container` (default body). Returns the element. */
export function vignette(container, { strength = 0.5, color = '2,4,14', inner = 0.45 } = {}) {
  if (!hasDom()) return null;
  const el = globalThis.document.createElement('div');
  el.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:1;background:radial-gradient(ellipse at 50% 48%, rgba(${color},0) ${Math.round(inner * 100)}%, rgba(${color},${strength}) 100%)`;
  (container || globalThis.document.body).appendChild(el);
  return el;
}

/**
 * Environment (PMREM from RoomEnvironment) that survives context loss.
 *   const env = createEnvironment(renderer, scene, { intensity: 0.4 });  // builds now, and rebuilds on webglcontextrestored
 * (createStage already does this for its own scene.) Call env.dispose() on teardown.
 */
export function createEnvironment(renderer, scene, { intensity = 0.4, blur = 0.04 } = {}) {
  const env = {
    rebuild() {
      const pm = new THREE.PMREMGenerator(renderer);
      if (scene.environment && scene.environment.dispose) { try { scene.environment.dispose(); } catch { /* lost context */ } }
      scene.environment = pm.fromScene(new THREE.RoomEnvironment(), blur).texture;
      scene.environmentIntensity = intensity;
      pm.dispose();
      return env;
    },
    dispose() { renderer.domElement.removeEventListener('webglcontextrestored', onRestore); },
  };
  const onRestore = () => { try { env.rebuild(); } catch { /* keep going without IBL */ } };
  renderer.domElement.addEventListener('webglcontextrestored', onRestore);
  env.rebuild();
  return env;
}

// ---------------------------------------------------------------- piece move tween
const easeOut = (u) => 1 - (1 - u) ** 3;
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
/**
 * Pure sample of a piece move: lift off, arc over, land, then a damped settle bounce.
 * from/to = {x,y,z}; t seconds since start. opts: { duration 0.45, lift 0.55 (arc height), bounce 0.1 (settle height), settle 0.28 (settle seconds) }.
 * Returns { x, y, z, done, squash } (squash = 1 normally, <1 at the instant of landing, for a tiny y-scale).
 */
export function pieceMoveAt(from, to, t, { duration = 0.45, lift = 0.55, bounce = 0.1, settle = 0.28 } = {}) {
  if (t >= duration + settle) return { x: to.x, y: to.y, z: to.z, done: true, squash: 1 };
  if (t < duration) {
    const u = Math.max(0, t / duration), e = easeInOut(u);
    return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e + Math.sin(Math.PI * e) * lift, z: from.z + (to.z - from.z) * e, done: false, squash: 1 };
  }
  const s = (t - duration) / settle;                       // 0..1
  const hop = Math.abs(Math.sin(s * Math.PI * 2)) * bounce * (1 - s) * (1 - s);
  return { x: to.x, y: to.y + hop, z: to.z, done: false, squash: 1 - 0.12 * Math.max(0, 1 - s * 4) };
}
/** Tween manager: tw.move(obj, to, opts) -> Promise; call tw.update(dtSeconds) every frame (or tw.invalidate hook). obj.position is moved; obj.scale.y squashed if opts.squash. */
export function createTweens({ onChange } = {}) {
  const list = [];
  return {
    get active() { return list.length; },
    move(obj, to, opts = {}) {
      return new Promise((resolve) => {
        const prev = list.findIndex((a) => a.obj === obj);
        if (prev >= 0) { const a = list.splice(prev, 1)[0]; a.resolve(); }
        list.push({ obj, from: { x: obj.position.x, y: obj.position.y, z: obj.position.z }, to: { x: to.x ?? obj.position.x, y: to.y ?? obj.position.y, z: to.z ?? obj.position.z }, t: 0, opts, resolve, sy: obj.scale ? obj.scale.y : 1 });
      });
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const a = list[i]; a.t += dt;
        const r = pieceMoveAt(a.from, a.to, a.t, a.opts);
        a.obj.position.set(r.x, r.y, r.z);
        if (a.opts.squash && a.obj.scale) a.obj.scale.y = a.sy * r.squash;
        if (r.done) { if (a.obj.scale) a.obj.scale.y = a.sy; list.splice(i, 1); a.resolve(); }
      }
      if (list.length && onChange) onChange();
      return list.length > 0;
    },
    clear() { while (list.length) list.pop().resolve(); },
  };
}

// ---------------------------------------------------------------- camera preset
/**
 * Board camera: tilted perspective camera fitted so a width x depth board (plus `height` of props) fills the viewport
 * with `margin`, in portrait OR landscape. Mutates and returns the camera.
 * opts: { width, depth (=width), height (0), aspect (camera.aspect), tilt (deg from the horizon, 52), fov (camera.fov), yaw (deg, 0),
 *         margin (0.06 of viewport), center [x,y,z], lift (0..0.4: fraction of viewport height reserved at the top for a HUD) }
 * Returns { distance, position, target }.
 */
export function fitBoardCamera(camera, o = {}) {
  const W = o.width ?? 8, D = o.depth ?? W, H = o.height ?? 0, aspect = o.aspect ?? camera.aspect ?? 1;
  const tilt = ((o.tilt ?? 52) * Math.PI) / 180, yaw = ((o.yaw ?? 0) * Math.PI) / 180, margin = o.margin ?? 0.06;
  const [cx, cy, cz] = o.center ?? [0, 0, 0];
  if (o.fov) camera.fov = o.fov;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  const corners = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, H]) corners.push(new THREE.Vector3(cx + sx * W / 2, cy + y, cz + sz * D / 2));
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt));
  const target = new THREE.Vector3(cx, cy + H * 0.25, cz);
  const lim = 1 - margin * 2, up = o.lift ?? 0;
  const fits = (dist) => {
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target); camera.updateMatrixWorld(true);
    if (camera.matrixWorldInverse) camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    for (const c of corners) {
      const p = c.clone().applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
      if (Math.abs(p.x) > lim || Math.abs(p.y) > lim - up) return false;
    }
    return true;
  };
  let lo = 0.5, hi = 400;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  fits(hi);
  if (up) {   // reserve `lift` of the viewport height at the top (HUD): slide the framing so the board sits in the lower part
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion), d = up * hi * Math.tan((camera.fov * Math.PI) / 360);
    camera.position.addScaledVector(camUp, d); target.addScaledVector(camUp, d); camera.lookAt(target);
  }
  return { distance: hi, position: camera.position.clone(), target };
}

// ---------------------------------------------------------------- icon render
/**
 * Offline icon render (browser). Renders `scene` from `camera` at size x size (2048), composites bloom + vignette + optional
 * backdrop colour, and returns { canvas (size), png1024 (dataURL, opaque), jpeg1024 (dataURL) }. Also sets window.__icon for
 * tools/render-icon.mjs. opts: { size, background ('#05080f'), bloom 0.3, vignette 0.5, renderer (reuse) , exposure }.
 */
export function renderIcon({ scene, camera, size = 2048, background = '#05080f', bloom = 0.3, vignette: vig = 0.5, renderer = null, exposure = 0.9 } = {}) {
  const gl = cv(size);
  const r = renderer || new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(size, size, false);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = exposure;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
  if (camera.isPerspectiveCamera) { camera.aspect = 1; camera.updateProjectionMatrix(); }
  const prevBg = scene.background; scene.background = null;
  r.setClearColor(0x000000, 0); r.clear(); r.render(scene, camera);
  scene.background = prevBg;
  const src = r.domElement;
  const out = cv(size), x = out.getContext('2d');
  x.fillStyle = background; x.fillRect(0, 0, size, size);
  x.drawImage(src, 0, 0);
  if (bloom > 0) { x.save(); x.globalCompositeOperation = 'lighter'; x.filter = `blur(${size * 0.014}px)`; x.globalAlpha = bloom; x.drawImage(src, 0, 0); x.restore(); }
  if (vig > 0) { const g = x.createRadialGradient(size / 2, size / 2, size * 0.38, size / 2, size / 2, size * 0.78); g.addColorStop(0, 'rgba(2,4,14,0)'); g.addColorStop(1, `rgba(2,4,14,${vig})`); x.fillStyle = g; x.fillRect(0, 0, size, size); }
  const small = cv(1024), sx = small.getContext('2d');
  sx.imageSmoothingQuality = 'high'; sx.fillStyle = background; sx.fillRect(0, 0, 1024, 1024); sx.drawImage(out, 0, 0, 1024, 1024);
  const res = { canvas: out, png1024: small.toDataURL('image/png'), jpeg1024: small.toDataURL('image/jpeg', 0.93) };
  globalThis.__icon = () => res.png1024; globalThis.__iconJpeg = () => res.jpeg1024;
  if (hasDom()) globalThis.document.title = 'ready';
  return res;
}
