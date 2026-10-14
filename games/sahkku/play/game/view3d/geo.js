// Geometry helpers for the premium 3D look. The shared three.js bundle has no Lathe/Extrude/RoundedBox, so these build
// BufferGeometry directly, with ANALYTIC normals (smooth where it should be, crisp where a bevel ends).
import * as THREE from '../vendor3d/three.js';

const TAU = Math.PI * 2;

function finish(pos, nor, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Surface of revolution around Y. profile = [[radius, y], ...] bottom to top. Repeat a point to make a hard edge.
export function lathe(profile, seg = 36) {
  const n = profile.length, pos = [], nor = [], uv = [], idx = [];
  const prof = profile.map((p) => [p[0], p[1]]);
  const norm = [];
  for (let i = 0; i < n; i++) {
    let a = i - 1, b = i + 1;
    while (a >= 0 && prof[a][0] === prof[i][0] && prof[a][1] === prof[i][1]) a--;
    while (b < n && prof[b][0] === prof[i][0] && prof[b][1] === prof[i][1]) b++;
    if (a < 0) a = i; if (b >= n) b = i;
    let tr = prof[b][0] - prof[a][0], ty = prof[b][1] - prof[a][1];
    // a duplicated point is a hard edge: use the one-sided tangent on each side
    const dupPrev = i > 0 && prof[i - 1][0] === prof[i][0] && prof[i - 1][1] === prof[i][1];
    const dupNext = i < n - 1 && prof[i + 1][0] === prof[i][0] && prof[i + 1][1] === prof[i][1];
    if (dupPrev) { tr = prof[b][0] - prof[i][0]; ty = prof[b][1] - prof[i][1]; }
    if (dupNext) { tr = prof[i][0] - prof[a][0]; ty = prof[i][1] - prof[a][1]; }
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

// outline of a rounded rectangle (w x d, corner radius r), with outward normals. Returns [{x,z,nx,nz}]
export function rrOutline(w, d, r, per = 5) {
  r = Math.min(r, w / 2 - 1e-3, d / 2 - 1e-3);
  const pts = [], hx = w / 2 - r, hz = d / 2 - r;
  const corners = [[hx, hz, 0], [-hx, hz, 1], [-hx, -hz, 2], [hx, -hz, 3]];
  for (const [cx, cz, k] of corners) {
    for (let i = 0; i <= per; i++) {
      const a = (k * 0.5 + (i / per) * 0.5) * Math.PI;      // 0..90deg in this quadrant
      const nx = Math.cos(a), nz = Math.sin(a);
      pts.push({ x: cx + nx * r, z: cz + nz * r, nx, nz });
    }
  }
  return pts;
}

// A convex rounded-rect slab (top face up, y from 0 to h) with rounded top and bottom edges of radius b.
// opts: { bevel, seg (bevel steps), bottom (false = omit bottom face), uvScale }
export function slab(w, d, h, rad, bevel = 0.05, opts = {}) {
  const b = Math.min(bevel, h / 2 - 1e-4, w / 2 - 1e-3, d / 2 - 1e-3);
  const bs = opts.seg ?? 3, out = rrOutline(w, d, rad, opts.per ?? 5);
  const rings = [];                                   // [{inset, y, ny, nr}]
  for (let i = 0; i <= bs; i++) { const t = -Math.PI / 2 + (i / bs) * (Math.PI / 2); rings.push({ inset: b * (1 - Math.cos(t)), y: b * (1 + Math.sin(t)), nr: Math.cos(t), ny: Math.sin(t) }); }
  for (let i = 0; i <= bs; i++) { const t = (i / bs) * (Math.PI / 2); rings.push({ inset: b * (1 - Math.cos(t)), y: h - b + b * Math.sin(t), nr: Math.cos(t), ny: Math.sin(t) }); }
  const pos = [], nor = [], uv = [], idx = [], P = out.length, U = opts.uvScale ?? 1;
  const push = (x, y, z, nx, ny, nz) => { pos.push(x, y, z); nor.push(nx, ny, nz); uv.push((x / w + 0.5) * U, (z / d + 0.5) * U); };
  // side rings (closed loop: duplicate first point)
  for (const rg of rings) for (let i = 0; i <= P; i++) {
    const o = out[i % P], ins = rg.inset;
    // inset along the outward normal
    push(o.x - o.nx * ins, rg.y, o.z - o.nz * ins, o.nx * rg.nr, rg.ny, o.nz * rg.nr);
  }
  const R = rings.length, W = P + 1;
  for (let r = 0; r < R - 1; r++) for (let i = 0; i < P; i++) {
    if (r === bs) continue;                              // the straight wall between the two bevels is one quad strip anyway
    const a = r * W + i, bb = r * W + i + 1, c = (r + 1) * W + i + 1, dd = (r + 1) * W + i;
    idx.push(a, dd, bb, bb, dd, c);
  }
  // wall between the lower and upper bevel
  { const r = bs; for (let i = 0; i < P; i++) { const a = r * W + i, bb = r * W + i + 1, c = (r + 1) * W + i + 1, dd = (r + 1) * W + i; idx.push(a, dd, bb, bb, dd, c); } }
  // top cap
  const topY = h, ins = b, base = pos.length / 3;
  push(0, topY, 0, 0, 1, 0);
  for (let i = 0; i <= P; i++) { const o = out[i % P]; push(o.x - o.nx * ins, topY, o.z - o.nz * ins, 0, 1, 0); }
  for (let i = 0; i < P; i++) idx.push(base, base + 2 + i, base + 1 + i);
  if (opts.bottom !== false) {
    const b2 = pos.length / 3; push(0, 0, 0, 0, -1, 0);
    for (let i = 0; i <= P; i++) { const o = out[i % P]; push(o.x - o.nx * ins, 0, o.z - o.nz * ins, 0, -1, 0); }
    for (let i = 0; i < P; i++) idx.push(b2, b2 + 1 + i, b2 + 2 + i);
  }
  return finish(pos, nor, uv, idx);
}

// A rounded cube (for dice): BoxGeometry subdivided, every vertex pulled onto a rounded surface. Keeps the six material groups.
export function roundedBox(size = 1, radius = 0.14, seg = 6) {
  const g = new THREE.BoxGeometry(size, size, size, seg, seg, seg);
  const pos = g.attributes.position, nor = g.attributes.normal, h = size / 2 - radius, v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(Math.max(-h, Math.min(h, v.x)), Math.max(-h, Math.min(h, v.y)), Math.max(-h, Math.min(h, v.z)));
    v.sub(c); const l = v.length() || 1; v.multiplyScalar(radius / l);
    nor.setXYZ(i, v.x / radius, v.y / radius, v.z / radius);
    pos.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  return g;
}

// Flat star / polygon in the XZ plane, fan-triangulated from its centre (star-shaped polygons only), facing up.
export function flatPoly(points, y = 0) {
  const pos = [0, y, 0], nor = [0, 1, 0], uv = [0.5, 0.5], idx = [];
  points.forEach(([x, z]) => { pos.push(x, y, z); nor.push(0, 1, 0); uv.push(0.5 + x, 0.5 + z); });
  const n = points.length;
  for (let i = 0; i < n; i++) idx.push(0, 1 + ((i + 1) % n), 1 + i);
  return finish(pos, nor, uv, idx);
}
export const starPoints = (n, ro, ri, rot = 0) => { const p = []; for (let k = 0; k < n * 2; k++) { const a = rot + (k / (n * 2)) * TAU, r = k % 2 ? ri : ro; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; };

// Merge geometries (all must have position/normal/uv, indexed) into one, applying matrices.
export function merge(parts) {
  const pos = [], nor = [], uv = [], idx = []; let off = 0;
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const { geo, m } of parts) {
    const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv, ix = geo.index;
    nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
    }
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
    else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  return finish(pos, nor, uv, idx);
}

export const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return m;
};
