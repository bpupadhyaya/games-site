// The four places of Circle Dodgeball in 3D: a school yard, a gym, an old square and a beach, each a painted floor (the same painting
// the 2D view uses, see paintGroundWorld in src/art.js) plus the buildings, trees and props around it. Display only: nothing here
// feeds back into the simulation. World: metres (see world.js), the circle is centred on the origin, the camera looks from +z.
import { paintGroundWorld } from '../src/art.js';
import { VENUES } from '../src/engine.js';
import { S } from './world.js';

const AUTHORED = 50;   // the places below were authored at 50 units to the metre; each is scaled to the real scale (world.js S)

const TAU = Math.PI * 2;
const hash = (i) => { let h = Math.imul(i | 0, 2654435761) ^ 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

function canvasTex(THREE, w, h, draw, { repeat = null, aniso = 8 } = {}) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// Many small coloured pieces become ONE geometry (one draw call).
function mergeColored(THREE, items) {
  let nv = 0, ni = 0;
  for (const it of items) { nv += it.geo.attributes.position.count; ni += it.geo.index ? it.geo.index.count : it.geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let vo = 0, io = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3(), c = new THREE.Color();
  for (const it of items) {
    const g = it.geo, p = g.attributes.position, n = g.attributes.normal; nm.getNormalMatrix(it.matrix); c.set(it.color);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(it.matrix); pos.set([v.x, v.y, v.z], (vo + i) * 3);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (vo + i) * 3);
      const sh = it.shade ? 1 + (hash(vo + i) - 0.5) * it.shade : 1;
      col.set([c.r * sh, c.g * sh, c.b * sh], (vo + i) * 3);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + vo; else for (let i = 0; i < p.count; i++) idx[io++] = vo + i;
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}


// lighting and sky per place
export const LOOK = {
  patio: { light: 'day', extra: { sky: 0x8dc3ee, fog: 0xcfe3ef, exposure: 1.0, hemi: 1.0, keyI: 2.7 }, shadow: [-4, 12, 7] },
  turnhalle: { light: 'indoor', extra: { sky: 0x30343f, fog: 0x30343f, exposure: 1.12, hemi: 1.25, keyI: 2.3 }, shadow: [-3, 12, 6] },
  piazza: { light: 'evening', extra: { sky: 0xf4b98a, fog: 0xf3cba5, exposure: 1.02, hemi: 0.95, keyI: 2.9 }, shadow: [-7, 10, 6] },
  praia: { light: 'day', extra: { sky: 0x73c6f0, fog: 0xd7eef4, exposure: 0.92, hemi: 0.95, keyI: 2.7 }, shadow: [-5, 13, 5] },
};
// people watching: [x, z, scale, f|m, top colour, skin, hair]
export const SPEC_SCALE = AUTHORED / S;   // SPEC positions are in authored metres
export const SPEC = {
  patio: [[-14.9, -6, 0.82, 'f', '#e8d56a', 'tan', 'black'], [-15.1, -2.5, 0.9, 'm', '#8a63c9', 'brown', 'black'], [-14.8, 2.2, 0.78, 'f', '#e0b84a', 'light', 'brown'], [15.0, -5, 0.86, 'm', '#e08a3a', 'tan', 'black'], [15.2, -1.2, 0.8, 'f', '#4aa8a0', 'brown', 'black'], [14.9, 3.4, 0.92, 'm', '#9c5a3a', 'deep', 'black']],
  turnhalle: [[-9.5, -12.4, 0.95, 'm', '#5a8ad8', 'light', 'brown'], [-7.6, -12.5, 0.9, 'f', '#d85a8a', 'tan', 'black'], [-5.8, -12.4, 0.97, 'm', '#e8c43a', 'brown', 'black'], [13.2, -2.5, 0.95, 'f', '#8a63c9', 'light', 'ginger'], [13.4, 1.6, 0.9, 'm', '#4aa86a', 'tan', 'black'], [13.1, 5.2, 0.93, 'f', '#e08a3a', 'deep', 'black']],
  piazza: [[-13.5, -4, 0.97, 'm', '#efe6d0', 'light', 'grey'], [-13.8, 0.6, 0.93, 'f', '#c8506a', 'tan', 'black'], [13.6, -5.5, 0.96, 'f', '#e8d56a', 'light', 'brown'], [13.8, -1.4, 0.98, 'm', '#3a6aa8', 'tan', 'black'], [13.5, 3.2, 0.9, 'm', '#d8b43c', 'brown', 'black'], [-12.4, -10.8, 0.95, 'f', '#4a8a5a', 'light', 'blond']],
  praia: [[-13.2, -7, 0.95, 'f', '#ff7a5a', 'tan', 'brown'], [-12.8, -3.2, 0.98, 'm', '#2fb0a8', 'brown', 'black'], [-13.4, 1.4, 0.92, 'f', '#ffd23f', 'light', 'blond'], [13.0, -6.4, 0.97, 'm', '#e8453a', 'tan', 'black'], [13.3, -2.2, 0.9, 'f', '#9c6ad8', 'deep', 'black'], [12.9, 2.6, 0.95, 'm', '#f2f2f2', 'light', 'brown']],
};

function kit(THREE) {
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), Pv = new THREE.Vector3(), Sv = new THREE.Vector3(1, 1, 1);
  const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
  return {
    mat: (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => M.clone().compose(Pv.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), Sv.set(sx, sy, sz)),
    box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    cyl: (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n, 1),
    sph: (r, a = 9, b = 7) => new THREE.SphereGeometry(r, a, b),
    cone: (r, h, n = 8, open = false, t0 = 0, tl = TAU) => new THREE.CylinderGeometry(0, r, h, n, 1, open, t0, tl),
    torus: (r, t, a = 10, b = 20) => new THREE.TorusGeometry(r, t, a, b),
    // a round bar between two ground points at height y
    bar: (list, x0, z0, x1, z1, y, rr, color, shade = 0.08) => {
      const L = Math.hypot(x1 - x0, z1 - z0), dir = new THREE.Vector3(x1 - x0, 0, z1 - z0).normalize();
      list.push({ geo: new THREE.CylinderGeometry(rr, rr, L, 6), matrix: new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, y, (z0 + z1) / 2), new THREE.Quaternion().setFromUnitVectors(UP, dir), ONE), color, shade });
    },
  };
}

// ---- the four places ------------------------------------------------------------------------------------------------------------------
function tree(K, add, x, z, h, seed, leaf = ['#2f7d33', '#3e9440']) {
  add(K.cyl(0.12 * h / 4, 0.2 * h / 4, h * 0.45, 7), K.mat(x, h * 0.22, z), '#6b4a2a', 0.2);
  for (let i = 0; i < 6; i++) {
    const a = hash(seed * 9 + i) * TAU, d = hash(seed * 9 + i + 40) * h * 0.22, rr = h * (0.2 + hash(seed * 9 + i + 70) * 0.12);
    add(K.sph(rr, 8, 6), K.mat(x + Math.cos(a) * d, h * (0.55 + hash(seed * 7 + i) * 0.28), z + Math.sin(a) * d), i % 2 ? leaf[0] : leaf[1], 0.25);
  }
}

// grid of windows on a wall facing +z (face = 1) or +x / -x (face = 'x', dir)
function windowGrid(K, add, o) {
  const { x, z, cols, rows, dx, dy, y0, w = 1.4, h = 1.7, color = '#4d7aa8', frame = '#f4ecd8', shutter = null, axis = 'z', dir = 1 } = o;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const u = (c - (cols - 1) / 2) * dx, y = y0 + r * dy;
    const px = axis === 'z' ? x + u : x, pz = axis === 'z' ? z : z + u, rot = axis === 'z' ? 0 : Math.PI / 2;
    const off = 0.06 * dir, fw = w + 0.24;
    add(K.box(fw, h + 0.24, 0.1), K.mat(px + (axis === 'z' ? 0 : off * 0.5), y, pz + (axis === 'z' ? off * 0.5 : 0), 1, 1, 1, rot), frame, 0.04);
    add(K.box(w, h, 0.12), K.mat(px + (axis === 'z' ? 0 : off), y, pz + (axis === 'z' ? off : 0), 1, 1, 1, rot), color, 0.12);
    if (shutter) for (const sg of [-1, 1]) add(K.box(w * 0.46, h, 0.08), K.mat(px + (axis === 'z' ? sg * (w * 0.75) : off * 1.4), y, pz + (axis === 'z' ? off * 1.4 : sg * (w * 0.75)), 1, 1, 1, rot), shutter, 0.1);
  }
}

function buildPatio(K, add, items, q) {
  const zf = -15.5;
  add(K.box(46, 7.2, 7), K.mat(0, 3.6, zf - 3.5), '#eadab2', 0.05);
  add(K.box(47, 0.45, 8), K.mat(0, 7.4, zf - 3.5), '#a45a3c', 0.1);
  add(K.box(46.2, 1.1, 0.16), K.mat(0, 0.55, zf + 0.06), '#b9835a', 0.1);
  windowGrid(K, add, { x: 0, z: zf + 0.04, cols: 9, rows: 2, dx: 4.8, dy: 3.0, y0: 2.5, w: 1.7, h: 1.5 });
  add(K.box(2.6, 3.0, 0.18), K.mat(0, 1.5, zf + 0.1), '#6a3f22', 0.1); add(K.box(3.3, 0.22, 0.7), K.mat(0, 3.2, zf + 0.3), '#a45a3c', 0.1);
  for (const sx of [-1, 1]) {
    add(K.box(0.5, 1.35, 28), K.mat(sx * 14.1, 0.68, -1.5), '#eadab2', 0.06); add(K.box(0.75, 0.2, 28.2), K.mat(sx * 14.1, 1.45, -1.5), '#a45a3c', 0.1);
    for (const z of [-10, -4, 2, 8]) add(K.box(0.7, 1.7, 0.7), K.mat(sx * 14.1, 0.85, z), '#d9c498', 0.08);
  }
  // benches along the left wall, a hoop pole by the right wall
  for (const z of [-7, 3]) {
    add(K.box(0.55, 0.09, 2.3), K.mat(-12.9, 0.46, z), '#8a5a2a', 0.1); add(K.box(0.09, 0.5, 2.3), K.mat(-13.2, 0.75, z), '#8a5a2a', 0.1);
    for (const dz of [-0.9, 0.9]) add(K.box(0.08, 0.45, 0.4), K.mat(-12.9, 0.22, z + dz), '#4a4a52', 0.05);
  }
  add(K.cyl(0.07, 0.09, 3.2, 8), K.mat(12.3, 1.6, -11), '#5a606c', 0.1); add(K.box(1.5, 0.95, 0.06), K.mat(12.3, 3.35, -10.7), '#f1f1f1', 0.05);
  add(K.torus(0.23, 0.02), K.mat(12.3, 2.95, -10.3, 1, 1, 1, 0, Math.PI / 2), '#ff7a1a', 0.05);
  [[-18, -8, 7], [-18.5, 3, 6.2], [-17.5, 11, 6.6], [18, -9, 6.6], [18.5, 2, 7], [17.6, 10, 6.2], [-25, -12, 8], [25, -11, 8]].forEach(([x, z, h], i) => { if (q === 'low' && i > 5) return; tree(K, add, x, z, h, i + 3); });
}

function buildGym(K, add, items, q) {
  add(K.box(34, 9.5, 0.5), K.mat(0, 4.75, -14.25), '#efe6cc', 0.04);
  for (const sx of [-1, 1]) add(K.box(0.5, 9.5, 30.5), K.mat(sx * 16.75, 4.75, 0), '#e6dcbd', 0.04);
  add(K.box(34, 1.5, 0.12), K.mat(0, 0.75, -13.95), '#2f4f8a', 0.05);
  for (const sx of [-1, 1]) add(K.box(0.12, 1.5, 30.5), K.mat(sx * 16.45, 0.75, 0), '#2f4f8a', 0.05);
  // wall bars (Sprossenwand): two rails and a ladder of round bars per section
  for (const cxs of [-12, -7.5, -3, 1.5, 6]) {
    for (const dx of [-1.5, 1.5]) add(K.box(0.12, 3.6, 0.14), K.mat(cxs + dx, 1.8, -13.9), '#b88548', 0.12);
    for (let j = 0; j < 15; j++) add(K.cyl(0.028, 0.028, 3.0, 6), K.mat(cxs, 0.28 + j * 0.23, -13.82, 1, 1, 1, 0, 0, Math.PI / 2), '#d6a468', 0.1);
  }
  for (let i = -3; i <= 3; i++) add(K.box(3.2, 1.5, 0.1), K.mat(i * 4.4, 7.4, -13.97), '#bfe3f5', 0.05);
  // basket on the far wall, mats, a bench
  add(K.box(1.9, 1.1, 0.07), K.mat(11, 3.6, -13.88), '#f4f4f4', 0.04); add(K.torus(0.23, 0.02), K.mat(11, 3.2, -13.45, 1, 1, 1, 0, Math.PI / 2), '#ff7a1a', 0.04);
  for (let k = 0; k < 3; k++) add(K.box(2.2, 0.42, 1.1), K.mat(14, 0.21 + k * 0.42, -11.5, 1, 1, 1, k * 0.05), k % 2 ? '#3a63c4' : '#2d52a8', 0.08);
  add(K.box(3.2, 0.1, 0.45), K.mat(-14.6, 0.42, -4.4, 1, 1, 1, Math.PI / 2), '#f2efe6', 0.04); add(K.box(3.2, 0.1, 0.45), K.mat(-14.6, 0.42, 4.4, 1, 1, 1, Math.PI / 2), '#f2efe6', 0.04);
  for (const z of [-4.4, 4.4]) for (const dz of [-1.3, 1.3]) add(K.box(0.4, 0.4, 0.06), K.mat(-14.6, 0.2, z + dz), '#8a5a2a', 0.05);
  void items; void q;
}

function buildPiazza(K, add, items, q) {
  const front = -15.2;
  const B = [[-21, 8.4, 11.5, '#d9a45b', '#a8553a'], [-12.6, 8.2, 14, '#c4704a', '#8f4a30'], [-4.2, 8.4, 12.2, '#ecd6a4', '#b0563a'], [4.4, 8.6, 15.2, '#d98e86', '#8f4a30'], [12.8, 8.2, 11.8, '#e2c17a', '#a8553a'], [21, 8.4, 13, '#b9c9a0', '#9a4e34']];
  B.forEach(([cx0, w, h, col, roof], i) => {
    add(K.box(w, h, 7), K.mat(cx0, h / 2, front - 3.5), col, 0.07);
    add(K.box(w + 0.5, 0.5, 7.8), K.mat(cx0, h + 0.25, front - 3.5), roof, 0.1);
    add(K.box(w + 0.3, 0.25, 0.4), K.mat(cx0, h - 0.4, front + 0.15), '#f2e6c8', 0.05);
    const cols = Math.max(2, Math.round((w - 1.4) / 2.6));
    windowGrid(K, add, { x: cx0, z: front + 0.04, cols, rows: Math.max(2, Math.floor((h - 4.4) / 2.8) + 1), dx: 2.6, dy: 2.8, y0: 4.7, w: 1.1, h: 1.7, color: '#2c3d52', frame: '#f6ecd0', shutter: i % 2 ? '#3f7a52' : '#7a4a2a' });
    // arched doors at the foot
    for (let k = 0; k < Math.max(1, cols - 1); k++) { const x = cx0 + (k - (cols - 2) / 2) * 2.6; add(K.box(1.3, 2.2, 0.16), K.mat(x, 1.1, front + 0.08), '#4a2f1c', 0.1); add(K.cyl(0.65, 0.65, 0.16, 12), K.mat(x, 2.2, front + 0.08, 1, 1, 1, 0, Math.PI / 2), '#4a2f1c', 0.1); }
  });
  // the bell tower on the left, with a clock
  add(K.box(3.6, 7, 3.6), K.mat(-17.2, 18, front - 1.8), '#e7c791', 0.06); add(K.cone(2.7, 3.4, 4), K.mat(-17.2, 23.1, front - 1.8, 1, 1, 1, Math.PI / 4), '#8f4a30', 0.1);
  add(K.cyl(0.95, 0.95, 0.18, 16), K.mat(-17.2, 18.5, front + 0.1, 1, 1, 1, 0, Math.PI / 2), '#faf4e2', 0.03);
  // side houses, windows toward the square
  for (const sx of [-1, 1]) {
    [[-11, 7.6, '#e8c9a0'], [-2.5, 9.4, '#d9a08a'], [6, 8.2, '#e2c88a']].forEach(([z, h, col], i) => {
      const x = sx * 18.5;
      add(K.box(6, h, 7.4), K.mat(x, h / 2, z), col, 0.07); add(K.box(6.6, 0.5, 8), K.mat(x, h + 0.25, z), '#a8553a', 0.1);
      windowGrid(K, add, { x: sx * 15.46, z, cols: 3, rows: Math.max(2, Math.floor((h - 3.4) / 2.7) + 1), dx: 2.3, dy: 2.7, y0: 3.4, w: 1.0, h: 1.6, color: '#2c3d52', frame: '#f6ecd0', shutter: (i + (sx > 0 ? 1 : 0)) % 2 ? '#3f7a52' : '#7a4a2a', axis: 'x', dir: -sx });
    });
  }
  // cafe umbrellas and tables at the side, a fountain basin
  [[-12.6, 6.5, '#c8353a'], [-12.8, 10.5, '#f2f2f2'], [12.7, 7.5, '#2f6fc8']].forEach(([x, z, c]) => {
    add(K.cyl(0.03, 0.03, 2.4, 6), K.mat(x, 1.2, z), '#f2f2f2', 0.04); add(K.cone(1.4, 0.55, 12), K.mat(x, 2.55, z), c, 0.06);
    add(K.cyl(0.55, 0.55, 0.05, 14), K.mat(x, 0.74, z), '#f6f2e8', 0.04); add(K.cyl(0.04, 0.04, 0.74, 6), K.mat(x, 0.37, z), '#4a4a52', 0.04);
  });
  // bunting between the facades
  const flags = ['#e8453a', '#ffd23f', '#2f8fe0', '#3fb36a', '#ffffff'];
  for (let i = 0; i < 20; i++) {
    const u = i / 19, x = -15 + u * 30, y = 9.8 - Math.sin(u * Math.PI) * 1.2;
    add(K.cone(0.28, 0.5, 3), K.mat(x, y - 0.25, front + 0.5, 1, 1, 1, 0, Math.PI), flags[i % flags.length], 0.04);
  }
  for (const sx of [-1, 1]) tree(K, add, sx * 12.5, 12.5, 5, 40 + sx, ['#4f8f3a', '#5da446']);
  void items; void q;
}

function buildPraia(K, add, items, q) {
  // palms
  const palm = (x, z, h, lean, seed) => {
    let px = x, py = 0, pz = z;
    for (let i = 0; i < 5; i++) {
      const seg = h / 5, nx = px + lean * 0.25 * (i + 1) * 0.3, ny = py + seg;
      add(K.cyl(0.17 - i * 0.015, 0.2 - i * 0.015, seg * 1.05, 7), K.mat((px + nx) / 2, (py + ny) / 2, pz, 1, 1, 1, 0, 0, -Math.atan2(nx - px, seg)), i % 2 ? '#8a6a3a' : '#7a5a2e', 0.15);
      px = nx; py = ny;
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + hash(seed + k) * 0.4;
      add(K.box(2.4, 0.05, 0.42), K.mat(px + Math.cos(a) * 1.0, py + 0.05 - 0.15 * (k % 2), pz + Math.sin(a) * 1.0, 1, 1, 1, -a, 0, (k % 2 ? 0.45 : 0.25)), k % 2 ? '#2f8a3a' : '#3fa04a', 0.2);
    }
    add(K.sph(0.2, 6, 5), K.mat(px, py - 0.15, pz), '#6a4a1e', 0.1);
  };
  palm(-14.5, -7, 9.5, 1.0, 11); palm(15, -10, 11, -1.1, 21); palm(-16.5, 5, 8.5, 0.8, 31); palm(17, 7, 9, -0.9, 41);
  // beach umbrellas
  [[-13.2, -1.5, '#e8453a'], [13.6, -3.4, '#2f9fe0'], [-12.4, 9, '#ffd23f']].forEach(([x, z, c]) => {
    add(K.cyl(0.035, 0.04, 2.7, 6), K.mat(x, 1.35, z, 1, 1, 1, 0, 0, 0.09), '#f4f2ea', 0.04);
    for (let k = 0; k < 8; k++) add(K.cone(1.45, 0.62, 1, true, (k / 8) * TAU, TAU / 8), K.mat(x + 0.12, 2.75, z, 1, 1, 1, 0, 0, 0.09), k % 2 ? c : '#fbfbf5', 0.05);
    add(K.box(1.7, 0.06, 0.7), K.mat(x + 1.1, 0.2, z + 1.1, 1, 1, 1, 0.5), '#f5e6c0', 0.05);
  });
  // lifeguard tower on stilts
  add(K.box(2.4, 0.12, 2.4), K.mat(17.5, 2.0, -3), '#f4f2ea', 0.05); add(K.box(2.0, 1.6, 2.0), K.mat(17.5, 2.9, -3), '#e8453a', 0.06); add(K.box(2.7, 0.18, 2.7), K.mat(17.5, 3.8, -3), '#f4f2ea', 0.05);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add(K.cyl(0.08, 0.08, 2.0, 6), K.mat(17.5 + dx, 1.0, -3 + dz), '#d9c498', 0.08);
  // the wet sand and the sea beyond the far edge
  add(K.box(260, 0.05, 6), K.mat(0, 0.0, -13.5), '#c4a468', 0.06);
  void items; void q;
}

const BUILD = { patio: buildPatio, turnhalle: buildGym, piazza: buildPiazza, praia: buildPraia };

export function buildScene(stage, THREE, { quality = 'high' } = {}) {
  const scene = stage.scene;
  const root = new THREE.Group(); scene.add(root);
  const K = kit(THREE);
  const venues = [];                                  // lazily built: { group, floor }
  const k = quality === 'low' ? 0.7 : quality === 'medium' ? 0.9 : 1.15;   // floor texture pixels per court unit (it covers 1840 x 1840 units)
  let current = -1;

  function ensure(i) {
    if (venues[i]) return venues[i];
    const v = VENUES[i], group = new THREE.Group(); group.visible = false; group.scale.setScalar(AUTHORED / S); root.add(group);
    // the painted floor: the 2D painting, continued far past the circle (world x and y -420..1420)
    const W = Math.round(1840 * k);
    const tex = canvasTex(THREE, W, W, (g) => { g.setTransform(k, 0, 0, k, 420 * k, 420 * k); paintGroundWorld(g, v, true); }, { aniso: quality === 'low' ? 2 : 8 });
    // beyond the painted square the ground continues in the average colour of the painting (no seam, no flat band)
    { const c = tex.image, one = globalThis.document.createElement('canvas'); one.width = one.height = 24; const g1 = one.getContext('2d'); g1.drawImage(c, 0, 0, 24, 24);
      const d = g1.getImageData(0, 0, 24, 24).data, px = [0, 0, 0];
      for (let n = 0; n < d.length; n += 4) { px[0] += d[n]; px[1] += d[n + 1]; px[2] += d[n + 2]; }
      for (let n = 0; n < 3; n++) px[n] = Math.round(px[n] / (d.length / 4));
      const outer = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshStandardMaterial({ color: new THREE.Color(`rgb(${px[0]},${px[1]},${px[2]})`), roughness: 1, metalness: 0 }));
      outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true; group.add(outer); }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1840 / AUTHORED, 1840 / AUTHORED), new THREE.MeshStandardMaterial({ map: tex, roughness: v.floor === 'parquet' ? 0.55 : 0.95, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.004, 0); floor.receiveShadow = true; group.add(floor);
    const items = [], add = (geo, matrix, color, shade = 0.1) => items.push({ geo, matrix, color, shade });
    BUILD[v.id](K, add, items, quality);
    const mesh = new THREE.Mesh(mergeColored(THREE, items), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }));
    mesh.receiveShadow = true; mesh.castShadow = quality === 'high'; group.add(mesh);
    if (v.id === 'praia') {
      const sea = canvasTex(THREE, 8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1b8fb0'); gr.addColorStop(0.55, '#29b0c6'); gr.addColorStop(0.92, '#7fdce2'); gr.addColorStop(1, '#f4fbf6'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(260, 110), new THREE.MeshBasicMaterial({ map: sea, fog: true }));
      s.rotation.x = -Math.PI / 2; s.position.set(0, -0.02, -16.5 - 55 + 0.0); s.rotation.z = 0; group.add(s);
      // the texture runs far to near along the plane: make "near the beach" the bright end
      sea.wrapS = THREE.ClampToEdgeWrapping;
    }
    venues[i] = { group };
    return venues[i];
  }
  function show(i) {
    if (i === current) return;
    ensure(i);
    venues.forEach((x, j) => { if (x) x.group.visible = j === i; });
    current = i;
    const L = LOOK[VENUES[i].id];
    stage.setLighting(L.light, L.extra);
    stage._shadowOffset = new THREE.Vector3(...L.shadow);
    scene.background = new THREE.Color(L.extra.sky);
    stage.invalidate();
  }
  // the ball: a rubber dodgeball with panel seams
  const ballTex = canvasTex(THREE, 256, 128, (g, w, h) => {
    g.fillStyle = '#e4392d'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillRect(0, h * 0.42, w, h * 0.16);
    g.strokeStyle = 'rgba(70,6,4,0.55)'; g.lineWidth = 3;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(w * i / 4, 0); g.lineTo(w * i / 4, h); g.stroke(); }
    g.beginPath(); g.moveTo(0, h * 0.42); g.lineTo(w, h * 0.42); g.moveTo(0, h * 0.58); g.lineTo(w, h * 0.58); g.stroke();
  }, { aniso: 4 });
  const balls = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 18), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.45, metalness: 0 }));
    m.castShadow = quality !== 'low'; m.visible = false; root.add(m);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.21, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    sh.rotation.x = -Math.PI / 2; sh.visible = false; root.add(sh);
    balls.push({ mesh: m, shadow: sh });
  }
  return { root, show, ensure, balls, get current() { return current; } };
}
