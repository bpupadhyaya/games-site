// Quilt Patterns 3D world (presentation only; reads game data, never writes it). Units are centimetres, y is up, the table top is y = 0.
// The cutting mat sits on a lamp-lit worktable; the block (or mini quilt) lies on the mat as real pieced cloth: every patch is its own
// pillowed mesh (batting puffs it up, the seams sink in), wears a tiling fabric print in board coordinates (so a stripe runs straight
// through neighbouring patches, as in the 2D art), and is outlined by real 3D running stitches just inside the seam. Unpainted patches
// are the flat paper template with a pencil dash outline. Props: spools, a tomato pincushion with pins, a brass thimble, dressmaker's
// scissors, a stack of folded fat quarters and an acrylic quilting ruler.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { blockOf, rotPoint } from '../src/blocks.js';
import { fab } from '../src/fabrics.js';
import { quiltGeo } from '../src/rules.js';
import { drawPrint, toGray } from '../src/art.js';

export const MAT = 46, MAT_H = 0.32, BOARD = MAT * 0.9, CLOTH_Y = MAT_H + 0.06, PUFF = 0.95;
const TAU = Math.PI * 2;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const canvasTex = (c, { srgb = true, repeat = null } = {}) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } return t; };

// ---------------------------------------------------------------- looks (match the three 2D looks)
export const LOOK3D = {
  hearth: { bg: 0x120a06, wood: ['#4a2c18', '#6e4426'], mat: '#2f6b56', paper: '#d8d0bd', key: 0xffd6a8, keyI: 3.9, hemi: [0xf0dcc0, 0x2a1a0e, 0.42], rim: [0x9fb8ff, 0.7], exp: 1.08, fog: [420, 900] },
  linen: { bg: 0xcdbd9c, wood: ['#c9ab7c', '#e2c89c'], mat: '#4f8f78', paper: '#e6dfcd', key: 0xfff1de, keyI: 3.0, hemi: [0xfff8ec, 0x8a7452, 0.75], rim: [0xd8e6ff, 0.5], exp: 0.92, fog: [450, 1000] },
  night: { bg: 0x070a16, wood: ['#2a2f48', '#3a4060'], mat: '#2b5b66', paper: '#bdb8ac', key: 0xffcf96, keyI: 3.0, hemi: [0x9fb2ff, 0x0a0d1c, 0.32], rim: [0x8fa8ff, 1.1], exp: 1.0, fog: [400, 880] },
};

// ---------------------------------------------------------------- fabric materials (tiling print textures, cached per fabric + squint)
const PERIOD = { dot: [0.55, 1.1], stripe: [0.5, 0.5], gingham: [0.7, 0.7], ditsy: [1, 2], plaid: [1.6, 1.6], lattice: [0.7, 0.7] };
const U_BOARD = 0.075;   // print unit as a share of the block size (same as art.js: u = s * 0.075)
let weaveTex = null;
function weave() {
  if (weaveTex) return weaveTex;
  const n = 128, c = cv(n), x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, n, n);
  const st = 8;   // plain weave: warp and weft threads go over / under in turn
  for (let j = 0; j < n / st; j++) for (let i = 0; i < n / st; i++) {
    const over = (i + j) & 1, g = x.createLinearGradient(i * st, j * st, over ? i * st + st : i * st, over ? j * st : j * st + st);
    g.addColorStop(0, '#5a5a5a'); g.addColorStop(0.5, '#c8c8c8'); g.addColorStop(1, '#5a5a5a');
    x.fillStyle = g; x.fillRect(i * st + 0.5, j * st + 0.5, st - 1, st - 1);
  }
  weaveTex = canvasTex(c, { srgb: false, repeat: [1, 1] });
  return weaveTex;
}
const fabCache = new Map();
// boardCm: world size of the board the prints are scaled to (the block, or one quilt block for quilts)
export function fabricMaterial(fid, squint, boardCm, paperHex) {
  const key = `${fid}|${squint ? 1 : 0}|${boardCm.toFixed(1)}|${fid ? '' : paperHex}`;
  let m = fabCache.get(key); if (m) return m;
  const f = fab(fid), uCm = boardCm * U_BOARD * (boardCm > 25 ? 0.55 : 0.8);   // real cloth: prints a little finer than the flat art on a big block
  let map = null, rep = [1, 1];
  if (f && f.print !== 'solid') {
    const [px, py] = PERIOD[f.print], nx = Math.max(1, Math.round(3 / px)), ny = Math.max(1, Math.round(3 / py));
    const tu = px * nx, tv = py * ny, upx = 256 / Math.max(tu, tv), W = Math.round(tu * upx), H = Math.round(tv * upx);
    const c = cv(W, H), x = c.getContext('2d');
    x.fillStyle = squint ? toGray(f.base) : f.base; x.fillRect(0, 0, W, H);
    drawPrint(x, f, -upx * 2, -upx * 2, W + upx * 2, H + upx * 2, upx, 0, 0, squint);
    map = canvasTex(c, { repeat: [1, 1] });
    rep = [1 / (tu * uCm), 1 / (tv * uCm)];          // uv is in cm (see patchGeometry), so repeat = tiles per cm
    map.repeat.set(rep[0], rep[1]);
  } else if (!f) {
    // paper template: cream sheet with fine diagonal hatching
    const c = cv(128), x = c.getContext('2d'); x.fillStyle = paperHex; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(0,0,0,0.09)'; x.lineWidth = 1.4; x.beginPath(); for (let k = -128; k < 256; k += 16) { x.moveTo(k, 128); x.lineTo(k + 128, 0); } x.stroke();
    map = canvasTex(c, { repeat: [1, 1] }); map.repeat.set(1 / 9, 1 / 9);
  }
  const col = f ? (map ? 0xffffff : new THREE.Color(squint ? toGray(f.base) : f.base)) : 0xffffff;
  if (f && !map) { const c = new THREE.Color(); c.setStyle(squint ? toGray(f.base) : f.base); c.convertSRGBToLinear?.(); }
  const wv = weave();
  m = f
    ? new THREE.MeshPhysicalMaterial({ color: map ? 0xffffff : new THREE.Color().setStyle(squint ? toGray(f.base) : f.base), map, roughness: 0.88, metalness: 0, vertexColors: true, sheen: 0.55, sheenRoughness: 0.55, sheenColor: new THREE.Color(f.lum < 0.4 ? 0x8a8a8a : 0x6a6a6a), bumpMap: wv, bumpScale: 0.7 })
    : new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 0.82, metalness: 0, vertexColors: true });
  if (f) { const t = wv.clone(); t.needsUpdate = true; t.repeat.set(0.75, 0.75); m.bumpMap = t; }
  void col;
  m.userData.fid = fid;
  fabCache.set(key, m);
  if (fabCache.size > 80) { const k0 = fabCache.keys().next().value; fabCache.get(k0).map?.dispose(); fabCache.get(k0).dispose(); fabCache.delete(k0); }
  return m;
}
export function clearFabricCache() { for (const m of fabCache.values()) { m.map?.dispose(); m.dispose(); } fabCache.clear(); weaveTex = null; }

// ---------------------------------------------------------------- pieces: polygons in board units (0..1, v down) with a fabric id
// Block: its patches. Quilt: every patch of every placed block, sashing strips, cornerstones, border strips, paper for empty spaces.
export function blockPieces(blockId, paint, rot = 0, x = 0, y = 0, s = 1, tag = '') {
  return blockOf(blockId).patches.map((p, i) => ({ key: `${tag}p${i}`, pts: p.pts.map((q) => { const r = rot ? rotPoint(q, rot) : q; return [x + r[0] * s, y + r[1] * s]; }), fid: paint[i] || '', cell: tag }));
}
const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
export function quiltPieces(ch, d) {
  const g = quiltGeo(d, ch.cols, 1), out = [], n = ch.cols, k = g.k, sw = g.sw * k, bw = g.bw * k;
  d.cells.forEach((c, i) => {
    const cell = g.cells[i];
    if (c.t < 0) { out.push({ key: `c${i}e`, pts: rectPts(cell.x, cell.y, cell.s, cell.s), fid: '', cell: `c${i}`, empty: true }); return; }
    const t = ch.tiles[c.t]; out.push(...blockPieces(t.type, t.paint, c.r, cell.x, cell.y, cell.s, `c${i}:${t.type}:${c.r}:`));
  });
  if (sw > 0) {
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n; j++) {
      const gx = bw + (i + 1) * k + i * sw, cy = bw + j * (k + sw), gy = bw + (i + 1) * k + i * sw, cx = bw + j * (k + sw);
      out.push({ key: `sv${i}.${j}`, pts: rectPts(gx, cy, sw, k), fid: d.sashF || '', cell: 'sash' });
      out.push({ key: `sh${i}.${j}`, pts: rectPts(cx, gy, k, sw), fid: d.sashF || '', cell: 'sash' });
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
      const gx = bw + (i + 1) * k + i * sw, gy = bw + (j + 1) * k + j * sw;
      out.push({ key: `sc${i}.${j}`, pts: rectPts(gx, gy, sw, sw), fid: d.bordF || d.sashF || '', cell: 'sash' });
    }
  }
  if (bw > 0) g.bord.forEach((r, i) => out.push({ key: `b${i}`, pts: rectPts(r.x, r.y, r.w, r.h), fid: d.bordF || '', cell: 'border' }));
  return out;
}

// ---------------------------------------------------------------- one pillowed patch
// Batting profile across a patch: 0 at the seam, rising quickly, round on top.
export const profile = (t) => Math.sin(Math.min(1, t * 1.1) * Math.PI / 2) ** 0.6;
// Rings from the seam (t = 0, height 0) to the centroid (t = 1); the boundary is resampled by length so long edges get more points.
// Positions are in world cm relative to the board centre; uv is in cm (fabric textures repeat per cm, so prints line up across patches).
const geoCache = new Map();
export function patchGeometry(pts, boardCm, flat, K = 7, M = 44) {
  const key = `${pts.map((p) => p[0].toFixed(4) + ',' + p[1].toFixed(4)).join(';')}|${boardCm}|${flat ? 1 : 0}|${K}|${M}`;
  let g = geoCache.get(key); if (g) return g;
  const P = pts.map((p) => [(p[0] - 0.5) * boardCm, (p[1] - 0.5) * boardCm]);
  let per = 0; const L = P.map((p, i) => { const q = P[(i + 1) % P.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); per += l; return l; });
  const ring = [];
  P.forEach((p, i) => { const q = P[(i + 1) % P.length], n = Math.max(2, Math.round((L[i] / per) * M)); for (let s = 0; s < n; s++) ring.push([p[0] + (q[0] - p[0]) * (s / n), p[1] + (q[1] - p[1]) * (s / n)]); });
  const c = P.reduce((a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length], [0, 0]);
  let minD = 1e9; P.forEach((p, i) => { const q = P[(i + 1) % P.length], ex = q[0] - p[0], ez = q[1] - p[1], l = Math.hypot(ex, ez) || 1, d = Math.abs((c[0] - p[0]) * ez - (c[1] - p[1]) * ex) / l; minD = Math.min(minD, d); });
  const H = flat ? 0.02 : PUFF * Math.min(1, Math.max(0.3, minD / 3.6)), R = ring.length, pos = [], uv = [], idx = [], col = [];
  for (let k = 0; k <= K; k++) {
    const t = k / K, s = 1 - t * 0.999, prof = flat ? 0 : profile(t), u = Math.min(1, t / 0.45), ao = flat ? 0.94 + 0.06 * u : 0.42 + 0.58 * u * u * (3 - 2 * u);
    for (let r = 0; r < R; r++) { const x = c[0] + (ring[r][0] - c[0]) * s, z = c[1] + (ring[r][1] - c[1]) * s; pos.push(x, H * prof, z); uv.push(x, -z); col.push(ao, ao, ao); }
  }
  // winding: the polygon may run either way round; faces must point up (+y)
  let area = 0; for (let i = 0; i < R; i++) { const p0 = ring[i], p1 = ring[(i + 1) % R]; area += p0[0] * p1[1] - p1[0] * p0[1]; }
  const flip = area < 0;
  for (let k = 0; k < K; k++) for (let r = 0; r < R; r++) { const a = k * R + r, b = k * R + ((r + 1) % R), c2 = a + R, d2 = b + R; if (flip) idx.push(a, b, c2, b, d2, c2); else idx.push(a, c2, b, b, c2, d2); }
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  g.userData = { c, H, ring, K };
  geoCache.set(key, g); if (geoCache.size > 900) { const k0 = geoCache.keys().next().value; geoCache.get(k0).dispose(); geoCache.delete(k0); }
  return g;
}
export function mergeGeometries(list) {
  let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3); uv.set(g.attributes.uv.array, ov * 2); col.set(g.attributes.color.array, ov * 3);
    const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx[oi + i] = ix[i] + ov;
    ov += g.attributes.position.count; oi += ix.length;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setAttribute('color', new THREE.BufferAttribute(col, 3)); m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}

// ---------------------------------------------------------------- running stitches (instanced), placed just inside each seam
const stitchGeo = (() => { const g = new THREE.CapsuleGeometry(0.5, 1, 2, 5); g.rotateZ(Math.PI / 2); return g; })();
export function makeStitches(max = 6000) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 });
  const m = new THREE.InstancedMesh(stitchGeo, mat, max); m.count = 0; m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false;
  m.setColorAt(0, new THREE.Color(0xffffff));
  return m;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _ax = new THREE.Vector3(1, 0, 0), _dir = new THREE.Vector3();
// Write stitches for pieces: inset 9% toward the centroid; length about 0.55 cm with 0.4 cm gaps (scaled to the board).
export function writeStitches(inst, pieces, boardCm, baseY, start = 0) {
  let n = start; const max = inst.instanceMatrix.count, len = Math.max(0.28, boardCm * 0.0135), gap = len * 0.75, th = Math.max(0.07, boardCm * 0.0024);
  for (const pc of pieces) {
    const g = pc.geo, { c, H, ring, K } = g.userData, f = fab(pc.fid), paper = !f, t = 0.13, s = 1 - t, y = baseY + H * profile(t) + th * 0.2;
    if (paper && pc.empty) continue;
    const col = paper ? 0x6b5a44 : f.lum < 0.45 ? 0xf3e6c8 : 0x6e5338;
    const P = ring.map((q) => [c[0] + (q[0] - c[0]) * s, c[1] + (q[1] - c[1]) * s]);
    let acc = 0;
    for (let i = 0; i < P.length && n < max; i++) {
      const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
      let d = (len + gap) - acc;
      while (d < L && n < max) {
        const x = a[0] + (b[0] - a[0]) * (d / L), z = a[1] + (b[1] - a[1]) * (d / L);
        _dir.set(b[0] - a[0], 0, b[1] - a[1]).normalize(); _q.setFromUnitVectors(_ax, _dir);
        _p.set(x, y, z); _s.set(paper ? len * 0.9 : len, paper ? th * 0.5 : th, paper ? th * 0.3 : th * 0.85);
        inst.setMatrixAt(n, _m4.compose(_p, _q, _s)); inst.setColorAt(n, _c.set(col)); n++;
        d += len + gap;
      }
      acc = L - (d - (len + gap)); acc = Math.max(0, Math.min(len + gap, acc));
    }
  }
  inst.count = n; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  return n;
}
// Hand-quilting across a finished top: diagonal rows of small white stitches (only drawn on the result / pressed quilt).
export function writeQuilting(inst, boardCm, baseY, start, density = 6) {
  let n = start; const max = inst.instanceMatrix.count, len = boardCm * 0.012, gap = len * 0.8, half = boardCm / 2, st = boardCm / density;
  for (const sgn of [1, -1]) for (let k = -boardCm; k <= boardCm; k += st) {
    _dir.set(1, 0, sgn).normalize(); _q.setFromUnitVectors(_ax, _dir);
    for (let u = -boardCm; u <= boardCm && n < max; u += (len + gap) / Math.SQRT2) {
      const x = u, z = sgn * u + k; if (Math.abs(x) > half - 0.6 || Math.abs(z) > half - 0.6) continue;
      _p.set(x, baseY + PUFF * 0.55, z); _s.set(len, 0.09, 0.08); inst.setMatrixAt(n, _m4.compose(_p, _q, _s)); inst.setColorAt(n, _c.set(0xfff6e6)); n++;
    }
  }
  inst.count = n; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  return n;
}

// ---------------------------------------------------------------- table, mat
export function woodTable(look) {
  const L = LOOK3D[look] ?? LOOK3D.hearth, w = B.woodCanvas(1024, L.wood[0], L.wood[1], 11, { lines: 160, knots: 3 });
  // planks: dark joints every 1/4 of the texture
  const x = w.map.getContext('2d'), bx = w.bump.getContext('2d');
  for (let i = 1; i < 4; i++) { x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(0, i * 256 - 2, 1024, 4); bx.fillStyle = '#202020'; bx.fillRect(0, i * 256 - 2, 1024, 4); }
  const map = canvasTex(w.map, { repeat: [3, 3] }), bump = canvasTex(w.bump, { srgb: false, repeat: [3, 3] });
  const m = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.6, roughness: 0.62, metalness: 0 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), m); mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true;
  return mesh;
}
export function cuttingMat(look) {
  const L = LOOK3D[look] ?? LOOK3D.hearth, g = new THREE.Group();
  const base = new THREE.Mesh(B.slab(MAT, MAT, MAT_H, 1.1, 0.12), new THREE.MeshStandardMaterial({ color: new THREE.Color().setStyle(L.mat).multiplyScalar(0.8), roughness: 0.8 }));
  base.castShadow = true; base.receiveShadow = true; g.add(base);
  const n = 1024, c = cv(n), x = c.getContext('2d'); x.fillStyle = L.mat; x.fillRect(0, 0, n, n);
  for (let i = 0; i < 9000; i++) { x.fillStyle = hash(i, 1) < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'; x.fillRect(hash(i, 2) * n, hash(i, 3) * n, 2, 2); }
  const st = n / 23, o = (n - 21 * st) / 2;
  for (let i = 0; i <= 21; i++) {
    const major = i % 4 === 0; x.strokeStyle = major ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.2)'; x.lineWidth = major ? 2.2 : 1.1;
    x.beginPath(); x.moveTo(o + i * st, o); x.lineTo(o + i * st, n - o); x.moveTo(o, o + i * st); x.lineTo(n - o, o + i * st); x.stroke();
  }
  x.strokeStyle = 'rgba(255,240,150,0.35)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(o, o); x.lineTo(n - o, n - o); x.moveTo(n - o, o); x.lineTo(o, n - o); x.stroke();
  x.fillStyle = 'rgba(255,255,255,0.5)'; x.font = `600 ${st * 0.42}px system-ui, sans-serif`; x.textAlign = 'center';
  for (let i = 0; i <= 20; i += 4) { x.fillText(String(i), o + i * st, o - st * 0.25); x.save(); x.translate(o - st * 0.32, o + i * st + st * 0.14); x.fillText(String(i), 0, 0); x.restore(); }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(MAT - 0.5, MAT - 0.5), new THREE.MeshStandardMaterial({ map: canvasTex(c), roughness: 0.74 }));
  top.rotation.x = -Math.PI / 2; top.position.y = MAT_H + 0.004; top.receiveShadow = true; g.add(top);
  return g;
}

// ---------------------------------------------------------------- props
const std = (o) => new THREE.MeshStandardMaterial(o);
const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
function threadTex(color) {
  const c = cv(64, 256), x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 3) { x.fillStyle = `rgba(255,255,255,${0.08 + 0.08 * hash(y, 4)})`; x.fillRect(0, y, 64, 1); x.fillStyle = 'rgba(0,0,0,0.16)'; x.fillRect(0, y + 1.5, 64, 1); }
  return canvasTex(c);
}
export function spool(color, h = 5.6) {
  const g = new THREE.Group(), wood = B.material('wood', { color: '#c79a62', color2: '#e0bb85', seed: 4 });
  const prof = [[0, 0], [1.95, 0], [2.05, 0.12], [2.05, 0.55], [1.95, 0.66], [1.15, 0.7], [1.15, h - 0.7], [1.95, h - 0.66], [2.05, h - 0.55], [2.05, h - 0.12], [1.95, h], [0.45, h], [0.45, h - 0.3], [0, h - 0.3]];
  g.add(shadowed(new THREE.Mesh(B.lathe(prof, 40), wood)));
  const thr = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, h - 1.42, 40, 1, true), new THREE.MeshPhysicalMaterial({ map: threadTex(color), roughness: 0.55, sheen: 0.8, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xffffff) })));
  thr.position.y = h / 2; g.add(thr);
  return g;
}
export function pincushion() {
  const g = new THREE.Group(), geo = new THREE.SphereGeometry(4.4, 64, 32), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), r = Math.hypot(v.x, v.z), lobe = 1 - 0.07 * Math.abs(Math.cos(a * 4)) ** 0.5; v.x *= lobe; v.z *= lobe; v.y = v.y * 0.66 * (1 - 0.18 * (1 - r / 4.4) * (v.y > 0 ? 1 : 0)); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  const body = shadowed(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xb8262e, roughness: 0.82, sheen: 0.9, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xff9a8a), bumpMap: weave(), bumpScale: 0.5 })));
  body.position.y = 2.9; g.add(body);
  const leaf = shadowed(new THREE.Mesh(B.inlay(B.starPoints(6, 1.9, 0.55), 0.18), std({ color: 0x3f7a3a, roughness: 0.9 }))); leaf.position.y = 5.75; g.add(leaf);
  const steel = std({ color: 0xd9dde3, metalness: 1, roughness: 0.22 }), pinGeo = new THREE.CylinderGeometry(0.045, 0.045, 3.4, 6), headGeo = new THREE.SphereGeometry(0.3, 16, 12);
  const heads = [0xf2c230, 0x2f6fb0, 0xffffff, 0xd8402f, 0x3a9a5a, 0xf08ab0, 0x2a2a2a];
  heads.forEach((hc, i) => {
    const a = (i / heads.length) * TAU + 0.4, el = 0.55 + 0.35 * hash(i, 7), pin = new THREE.Group();
    const shaft = new THREE.Mesh(pinGeo, steel); shaft.position.y = 1.7; pin.add(shaft);
    const head = shadowed(new THREE.Mesh(headGeo, new THREE.MeshPhysicalMaterial({ color: hc, roughness: 0.2, clearcoat: 1 }))); head.position.y = 3.4; pin.add(head);
    const r = 3.3 * Math.cos(el * 0.9), y = 2.9 + 2.6 * Math.sin(el * 0.9);
    pin.position.set(Math.cos(a) * r * 0.75, y - 0.9, Math.sin(a) * r * 0.75);
    pin.rotation.set(Math.sin(a) * (0.9 - el * 0.6), 0, -Math.cos(a) * (0.9 - el * 0.6)); g.add(pin);
  });
  return g;
}
export function thimble() {
  const c = cv(256), x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const gr = x.createRadialGradient(i * 16 + (j & 1) * 8, j * 16 + 8, 0, i * 16 + (j & 1) * 8, j * 16 + 8, 6); gr.addColorStop(0, '#202020'); gr.addColorStop(1, '#808080'); x.fillStyle = gr; x.fillRect(i * 16 - 8 + (j & 1) * 8, j * 16, 16, 16); }
  const m = B.material('brass'); const mm = m.clone(); mm.bumpMap = canvasTex(c, { srgb: false, repeat: [3, 2] }); mm.bumpScale = 1.2;
  const prof = [[0, 2.3], [0.55, 2.27], [0.85, 2.05], [0.95, 1.6], [1.02, 0.3], [1.12, 0.12], [1.12, 0], [0.98, 0], [0.92, 0.2], [0.85, 1.6], [0, 2.1]];
  return shadowed(new THREE.Mesh(B.lathe(prof, 40), mm));
}
export function scissors() {
  const g = new THREE.Group(), steel = std({ color: 0xcfd4da, metalness: 1, roughness: 0.18 }), handleM = new THREE.MeshPhysicalMaterial({ color: 0xe0661f, roughness: 0.38, clearcoat: 0.5 });
  const blade = (s) => { const sh = new THREE.Shape(); sh.moveTo(0, -0.45 * s); sh.lineTo(12.5, -0.05 * s); sh.quadraticCurveTo(13, 0.1 * s, 12.4, 0.35 * s); sh.lineTo(0, 0.75 * s); sh.lineTo(-1.6, 0.5 * s); sh.lineTo(-1.6, -0.3 * s); sh.closePath(); const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 10 }); geo.rotateX(-Math.PI / 2); return shadowed(new THREE.Mesh(geo, steel)); };
  const ring = (big) => { const t = new THREE.TorusGeometry(big ? 2.2 : 1.55, 0.42, 14, 40); t.rotateX(Math.PI / 2); t.scale(big ? 1.35 : 1.15, 1, 1); return shadowed(new THREE.Mesh(t, handleM)); };
  const a = new THREE.Group(), b = new THREE.Group();
  a.add(blade(1)); const ra = ring(true); ra.position.set(-4.4, 0.2, 1.3); a.add(ra);
  const arm = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.55, 1.0), handleM)); arm.position.set(-2.4, 0.2, 0.7); a.add(arm);
  b.add(blade(-1)); const rb = ring(false); rb.position.set(-4.0, 0.2, -1.5); b.add(rb);
  const arm2 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 1.0), handleM)); arm2.position.set(-2.3, 0.2, -0.8); b.add(arm2);
  a.rotation.y = 0.12; b.rotation.y = -0.12; b.position.y = 0.2;
  const screw = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 20), std({ color: 0x9aa0a8, metalness: 1, roughness: 0.3 }))); screw.position.y = 0.3;
  g.add(a, b, screw); g.position.y = 0.45;
  return g;
}
export function fatQuarters(ids, squint = false) {
  const g = new THREE.Group();
  ids.forEach((id, i) => {
    const m = fabricMaterial(id, squint, 30, '#d8d0bd').clone(); m.vertexColors = false; m.map = m.map?.clone(); if (m.map) { m.map.needsUpdate = true; m.map.repeat.multiplyScalar(14); }
    const box = shadowed(new THREE.Mesh(B.roundedBox(14, 1.05, 10, 0.5, 4), m));
    box.position.set(hash(i, 3) * 0.8 - 0.4, 0.52 + i * 1.02, hash(i, 5) * 0.8 - 0.4); box.rotation.y = (hash(i, 9) - 0.5) * 0.12; g.add(box);
  });
  return g;
}
export function ruler() {
  const W = 15, Lr = 46, c = cv(256, 784), x = c.getContext('2d'); x.clearRect(0, 0, 256, 784);
  const pc = 784 / Lr;
  for (let i = 0; i <= Lr * 2; i++) { const y = i * pc / 2, major = i % 2 === 0; x.fillStyle = 'rgba(250,230,90,0.9)'; x.fillRect(0, y - 0.8, major ? 52 : 28, major ? 2.2 : 1.4); x.fillRect(256 - (major ? 52 : 28), y - 0.8, major ? 52 : 28, major ? 2.2 : 1.4); }
  x.strokeStyle = 'rgba(20,20,20,0.55)'; x.lineWidth = 1.4; for (let i = 0; i <= Lr; i += 5) { x.beginPath(); x.moveTo(0, i * pc); x.lineTo(256, i * pc); x.stroke(); }
  x.strokeStyle = 'rgba(250,230,90,0.7)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, 0); x.lineTo(256, 256); x.moveTo(256, 0); x.lineTo(0, 256); x.stroke();
  const g = new THREE.Group();
  const body = new THREE.Mesh(B.roundedBox(W, 0.32, Lr, 0.3, 3), new THREE.MeshPhysicalMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.2, roughness: 0.06, clearcoat: 1, depthWrite: false }));
  body.position.y = 0.16; body.receiveShadow = true; g.add(body);
  const lines = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, Lr - 0.3), new THREE.MeshStandardMaterial({ map: canvasTex(c), transparent: true, depthWrite: false, roughness: 0.4 }));
  lines.rotation.x = -Math.PI / 2; lines.position.y = 0.33; g.add(lines);
  return g;
}
// The props around the mat (positions in cm; mat centre at the origin). Returns the group and the points that frame it for the hero.
export function propsGroup(look) {
  const g = new THREE.Group();
  const s1 = spool('#c9453a'); s1.position.set(MAT / 2 + 5, 0, -MAT / 2 + 6); g.add(s1);
  const s2 = spool('#2f6fb0', 5.0); s2.position.set(MAT / 2 + 9.2, 0, -MAT / 2 + 11.5); g.add(s2);
  const s3 = spool('#e8d9b0', 4.6); s3.rotation.z = Math.PI / 2; s3.rotation.y = 0.5; s3.position.set(MAT / 2 + 6.5, 2.05, -MAT / 2 + 18); g.add(s3);
  const pc = pincushion(); pc.position.set(-MAT / 2 - 7.5, 0, -MAT / 2 + 7); g.add(pc);
  const th = thimble(); th.position.set(MAT / 2 + 5, 0, 4); g.add(th);
  const sc = scissors(); sc.rotation.y = -1.25; sc.position.set(-MAT / 2 - 6.5, 0, 6); g.add(sc);
  const fq = fatQuarters(['indigo', 'ivory', 'mustard', 'sage', 'rose']); fq.rotation.y = -0.18; fq.position.set(MAT / 2 + 10, 0, MAT / 2 - 6); g.add(fq);
  const ru = ruler(); ru.rotation.y = Math.PI / 2 + 0.06; ru.position.set(2, 0, -MAT / 2 - 9.5); g.add(ru);
  void look;
  return { group: g, frame: [[-MAT / 2 - 10, 0, -MAT / 2 - 1], [MAT / 2 + 10, 0, -MAT / 2 - 1], [-MAT / 2 - 10, 0, MAT / 2 + 6], [MAT / 2 + 10, 0, MAT / 2 + 6]] };
}
