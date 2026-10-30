// Perch 3D world: procedural, lit models of the field (no bitmaps). Shared by the presenter and the icon render.
// Trees, the bird and the dog are modelled in the flat art's own units (1 unit = 1 world px of the 720 x 1280 field, y up),
// so every perch the rules know sits exactly at the tip of a 3D branch; the presenter scales each model to its place.
import * as THREE from '../vendor3d/three.js';

const TAU = Math.PI * 2;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
export const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
// cheap smooth 3D value noise (deterministic)
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const h = (a, b, c) => hash(a * 73856093 ^ b * 19349663, c);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
}
export const fbm = (x, y, z) => vnoise(x, y, z) * 0.6 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.12;

const col = (hex) => new THREE.Color(hex);
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep = [1, 1]) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; return t; };

// Merge geometries keeping a per-vertex colour (board3d.mergeGeos drops colours).
export function merge(parts) {
  const pos = [], nor = [], colr = [], uv = [], idx = []; let off = 0;
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const { geo, m = new THREE.Matrix4(), color = null } of parts) {
    const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv, c = geo.attributes.color, ix = geo.index;
    nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      if (c) colr.push(c.getX(i), c.getY(i), c.getZ(i)); else { const k = color || col('#ffffff'); colr.push(k.r, k.g, k.b); }
    }
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// ---------------------------------------------------------------- textures
let _bark = null, _leaf = null, _grass = null;
export function barkTexture() {
  if (_bark) return _bark;
  const c = canvas(256, 512), x = c.getContext('2d');
  x.fillStyle = '#6a4a2e'; x.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 260; i++) {
    const px = hash(i, 1) * 256, w = 2 + hash(i, 2) * 7, l = 30 + hash(i, 3) * 160, py = hash(i, 4) * 512, d = hash(i, 5);
    x.strokeStyle = d < 0.5 ? `rgba(40,24,12,${0.35 + d * 0.5})` : `rgba(170,130,90,${(d - 0.5) * 0.5})`;
    x.lineWidth = w; x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + 6, py + l / 3, px - 6, py + l * 0.66, px + 2, py + l); x.stroke();
  }
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(110,140,70,${0.15 + hash(i, 9) * 0.2})`; x.beginPath(); x.ellipse(hash(i, 7) * 256, 380 + hash(i, 8) * 132, 10 + hash(i, 6) * 20, 4 + hash(i, 5) * 8, 0, 0, TAU); x.fill(); }   // moss low on the trunk
  return (_bark = tex(c, [2, 1]));
}
export function leafTexture() {
  if (_leaf) return _leaf;
  const c = canvas(512, 512), x = c.getContext('2d');
  x.fillStyle = '#3a3a3a'; x.fillRect(0, 0, 512, 512);
  // overlapping pointed-oval leaves with a midrib: dark gaps between them read as depth
  for (let i = 0; i < 2600; i++) {
    const px = hash(i, 11) * 512, py = hash(i, 12) * 512, r = 7 + hash(i, 13) * 8, l = hash(i, 14), a = hash(i, 15) * TAU;
    const v = Math.round(120 + l * 135);
    for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
      const cx = px + ox, cy = py + oy; if (cx < -20 || cx > 532 || cy < -20 || cy > 532) continue;
      x.save(); x.translate(cx, cy); x.rotate(a);
      x.fillStyle = `rgb(${v},${v},${v})`; x.beginPath(); x.moveTo(-r, 0); x.quadraticCurveTo(0, -r * 0.62, r, 0); x.quadraticCurveTo(0, r * 0.62, -r, 0); x.fill();
      x.strokeStyle = `rgba(0,0,0,0.25)`; x.lineWidth = 1; x.beginPath(); x.moveTo(-r * 0.8, 0); x.lineTo(r * 0.8, 0); x.stroke();
      x.restore();
    }
  }
  return (_leaf = tex(c, [4, 4]));
}
export function grassTexture() {
  if (_grass) return _grass;
  const c = canvas(512, 512), x = c.getContext('2d');
  x.fillStyle = '#5f9a4c'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const px = hash(i, 21) * 512, py = hash(i, 22) * 512, l = hash(i, 23);
    x.strokeStyle = l < 0.5 ? `rgba(40,90,40,${0.25 + l * 0.4})` : `rgba(170,210,110,${(l - 0.5) * 0.55})`;
    x.lineWidth = 1 + hash(i, 24) * 1.4; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (hash(i, 25) - 0.5) * 5, py - 4 - hash(i, 26) * 9); x.stroke();
  }
  for (let i = 0; i < 60; i++) { x.fillStyle = hash(i, 31) < 0.6 ? 'rgba(255,250,235,0.85)' : 'rgba(255,215,90,0.85)'; x.beginPath(); x.arc(hash(i, 32) * 512, hash(i, 33) * 512, 1.6 + hash(i, 34) * 1.4, 0, TAU); x.fill(); }   // daisies, buttercups
  return (_grass = tex(c, [1, 1]));
}
export function radialTex(rgb = '0,0,0', a = 1) {
  const c = canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.55, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function cloudTexture(seed = 1) {
  const c = canvas(512, 192), x = c.getContext('2d');
  for (let i = 0; i < 46; i++) {
    const u = hash(seed, i), px = 70 + u * 372, py = 120 - Math.sin(u * Math.PI) * 55 + (hash(seed, i + 99) - 0.5) * 24, r = 26 + hash(seed, i + 50) * 46 * Math.sin(u * Math.PI + 0.2);
    const g = x.createRadialGradient(px - r * 0.2, py - r * 0.35, r * 0.1, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(244,246,252,0.75)'); g.addColorStop(1, 'rgba(225,232,245,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- the tree (oak), flat-art units, base at the origin
const CANOPY = [[0, -424, 130], [-105, -364, 96], [105, -364, 96], [0, -474, 92], [-60, -424, 70]];
const crownXY = (x0, y0, r0, cr) => ({ x: x0 * cr, y: -((y0 + 330) * cr - 330 - (cr < 1 ? 30 : 0)), r: r0 * cr });
export const crownTop = (cr) => -((-474 + 330) * cr - 330 - (cr < 1 ? 30 : 0)) + 92 * cr;   // y (up) of the top of the crown

const leafMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, map: leafTexture(), bumpMap: leafTexture(), bumpScale: 2.5, roughness: 0.78, metalness: 0, envMapIntensity: 0.6 });
const barkMat = () => new THREE.MeshStandardMaterial({ map: barkTexture(), color: '#b89878', roughness: 0.95, metalness: 0 });
let _mats = null;
export const treeMats = () => (_mats ||= { leaf: leafMat(), bark: barkMat() });

function blob(r, seed, squash = 0.86) {
  const g = new THREE.SphereGeometry(1, 30, 22), p = g.attributes.position, v = new THREE.Vector3();
  const cs = [];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.7 + seed, v.y * 1.7 + seed * 2, v.z * 1.7);
    const k = r * (0.86 + n * 0.32);
    p.setXYZ(i, v.x * k, v.y * k * squash, v.z * k * 0.8);
    // light from the top-left: the leaves get brighter there, darker underneath (baked ambient occlusion)
    const lit = 0.55 + 0.45 * Math.max(0, v.y * 0.7 - v.x * 0.25 + v.z * 0.3), ao = 0.62 + 0.38 * (v.y * 0.5 + 0.5);
    const c = new THREE.Color().setHSL(0.27 + (n - 0.5) * 0.06, 0.48 + n * 0.1, 0.2 + lit * 0.16).multiplyScalar(ao);
    cs.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
  g.computeVertexNormals();
  return g;
}

// tr: { offs, crown, seed } -> THREE.Group, flat-art units. Perch i is at (o.dx, -o.dy) in the group.
export function buildTree(tr, seed = 1) {
  const g = new THREE.Group(), mats = treeMats(), cr = tr.crown ?? 1;
  // trunk: tapering, a root flare, a gentle lean, bark
  const tg = new THREE.CylinderGeometry(10, 36, 380, 22, 12, false), p = tg.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const y = v.y + 190, a = Math.atan2(v.z, v.x);
    const flare = 1 + Math.max(0, 1 - y / 46) ** 2 * 0.55 * (0.8 + 0.4 * Math.sin(a * 5 + seed));
    const bump = 1 + (fbm(Math.cos(a) * 2 + seed, y / 60, Math.sin(a) * 2) - 0.5) * 0.18;
    p.setXYZ(i, v.x * flare * bump + Math.sin(y / 120 + seed) * 5, y, v.z * flare * bump);
  }
  tg.computeVertexNormals();
  const trunk = new THREE.Mesh(tg, mats.bark); g.add(trunk);
  // branches out to each perch: curved, tapering tubes in the trunk's plane, a stub twig past the perch
  const parts = [], sprays = [];
  for (const o of tr.offs) {
    const s = Math.sign(o.dx), low = o.dy > -180, by = low ? 54 : 124, r = low ? 10 : 8.5;
    if (o.dx !== 0) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 8, by, 0), new THREE.Vector3(o.dx * 0.55, (by + (-o.dy - 6)) / 2 - 10, 4), new THREE.Vector3(o.dx, -o.dy - 6, 2)]);
      const tb = new THREE.TubeGeometry(curve, 16, 1, 7, false), q = tb.attributes.position;
      // taper: radius r at the trunk, 0.55 r at the perch
      for (let i = 0; i < q.count; i++) {
        const seg = Math.floor(i / 8) / 16, pt = curve.getPoint(Math.min(1, seg)), k = r * (1 - 0.45 * seg);
        v.fromBufferAttribute(q, i); p && q.setXYZ(i, pt.x + (v.x - pt.x) * k, pt.y + (v.y - pt.y) * k, pt.z + (v.z - pt.z) * k);
      }
      tb.computeVertexNormals();
      parts.push({ geo: tb });
    }
    // the perch itself: a short horizontal twig the bird grips, and a little leaf spray at its end
    // the perch: the branch runs on past the bird as a thinning twig, tipped with a spray of leaves
    const ss = s || 1, tw = new THREE.CylinderGeometry(2.2, 5.6, 46, 8); tw.translate(0, 23, 0);
    parts.push({ geo: tw, m: M(o.dx - ss * 14, -o.dy - 4, 2, 0, 0, -ss * (Math.PI / 2 - 0.22)) });
    const knob = new THREE.SphereGeometry(5.8, 10, 8); parts.push({ geo: knob, m: M(o.dx - ss * 14, -o.dy - 4, 2) });
  }
  if (parts.length) { const bm = new THREE.Mesh(merge(parts), mats.bark); g.add(bm); }
  // crown: overlapping lumpy leaf masses behind the perches
  const leaves = [], sprayParts = [];
  // leaves wrap the top of the trunk where it enters the crown
  { const top = crownXY(0, -424, 130, cr); for (let k = 0; k < 4; k++) sprayParts.push({ geo: blob(top.r * (0.3 + k * 0.04), seed * 5 + k, 0.8), m: M((k - 1.5) * top.r * 0.32, 372 + (k % 2) * 16 + (cr < 1 ? 0 : 20), 14 + (k % 2) * 6) }); }
  CANOPY.forEach(([x0, y0, r0], ci) => {
    const c = crownXY(x0, y0, r0, cr);
    leaves.push({ geo: blob(c.r * 0.92, seed * 7 + ci), m: M(c.x, c.y, -c.r * 1.05) });
    for (let k = 0; k < 10; k++) {
      const a = hash(seed * 13 + ci, k) * TAU, rr = c.r * (0.3 + hash(seed + ci, k + 20) * 0.3), d = c.r * (0.5 + hash(ci, k + 70) * 0.3);
      leaves.push({ geo: blob(rr, seed * 31 + ci * 7 + k), m: M(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.8, -c.r * 0.9 + hash(ci, k + 40) * c.r * 0.3) });
    }
  });
  const lg = merge(leaves);
  { // whole-crown light: the top and the sun side (left) bright, the underside and the core in shade
    const p = lg.attributes.position, cc = lg.attributes.color; let y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < p.count; i++) { y0 = Math.min(y0, p.getY(i)); y1 = Math.max(y1, p.getY(i)); }
    for (let i = 0; i < p.count; i++) {
      const yn = (p.getY(i) - y0) / Math.max(1, y1 - y0), side = -p.getX(i) / Math.max(1, (y1 - y0)), front = p.getZ(i) / Math.max(1, (y1 - y0));
      const k = clampN(0.5 + yn * 0.62 + side * 0.18 + front * 0.5, 0.42, 1.25);
      cc.setXYZ(i, cc.getX(i) * k, cc.getY(i) * k, cc.getZ(i) * k);
    }
  }
  if (sprayParts.length) g.add(new THREE.Mesh(merge(sprayParts), mats.leaf));
  const crown = new THREE.Mesh(lg, mats.leaf); crown.userData.crown = true; g.add(crown);
  g.userData.crown = crown;
  return g;
}

// A small pennant on the crown (wind levels): a cloth strip whose vertices the presenter waves.
export function buildPennant() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 50, 6), new THREE.MeshStandardMaterial({ color: '#4a2f18', roughness: 0.9 })); pole.position.y = 25; g.add(pole);
  const cloth = new THREE.PlaneGeometry(1, 18, 10, 1); cloth.translate(0.5, 0, 0);
  const flag = new THREE.Mesh(cloth, new THREE.MeshStandardMaterial({ color: '#ffcf4a', roughness: 0.7, side: THREE.DoubleSide })); flag.position.y = 41; g.add(flag);
  g.userData.flag = flag; g.userData.base = cloth.attributes.position.array.slice();
  return g;
}
export function wavePennant(p, w, t) {
  const f = p.userData.flag, a = f.geometry.attributes.position, b = p.userData.base, len = 18 + Math.abs(w) * 46, dir = Math.sign(w) || 1;
  for (let i = 0; i < a.count; i++) {
    const u = b[i * 3];
    a.setXYZ(i, dir * u * len, b[i * 3 + 1] * (1 - u * 0.5) + Math.sin(t * 9 - u * 6) * 3 * Math.abs(w) * u, Math.sin(t * 7 - u * 5) * 4 * u);
  }
  a.needsUpdate = true; f.geometry.computeVertexNormals();
}

// ---------------------------------------------------------------- the bird (a robin), flat-art units: centre of the body at the origin, facing +x
export function buildBird() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const parts = [];
  const shade = (geo, fn) => { const p = geo.attributes.position, n = geo.attributes.normal, cs = [], v = new THREE.Vector3(), nn = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); nn.fromBufferAttribute(n, i); const c = fn(v, nn); cs.push(c.r, c.g, c.b); } geo.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); return geo; };
  const brown = col('#7c5a3c'), olive = col('#8a6a46'), orange = col('#e2622a'), cream = col('#f2e6d2'), grey = col('#9aa0a4');
  // round body: brown back, orange breast and face, cream belly; a fine noise for feather texture
  const bg = new THREE.SphereGeometry(1, 40, 28);
  bg.scale(28, 24, 22);
  const sm = (e0, e1, x) => { const f = clampN((x - e0) / (e1 - e0), 0, 1); return f * f * (3 - 2 * f); };
  shade(bg, (v, n) => {
    const fn = (fbm(v.x * 0.35, v.y * 0.35, v.z * 0.35) - 0.5) * 0.16;
    const breast = n.x * 0.9 - n.y * 0.25 + 0.15, belly = -n.y * 0.8 - n.x * 0.1;
    const back = brown.clone().lerp(olive, n.y * 0.5 + 0.5);
    const c = back.lerp(grey, sm(0.12, 0.26, breast) * (1 - sm(0.3, 0.4, breast)) * 0.6).lerp(orange, sm(0.26, 0.4, breast)).lerp(cream, sm(0.4, 0.62, belly));
    return c.multiplyScalar(1 + fn);
  });
  parts.push({ geo: bg });
  // head: slightly forward and up, the orange face
  const hg = new THREE.SphereGeometry(1, 32, 22); hg.scale(16.5, 15.5, 15);
  shade(hg, (v, n) => { const face = n.x * 0.9 - n.y * 0.5 + 0.25, k = clampN((face - 0.25) / 0.2, 0, 1); return brown.clone().lerp(olive, 0.5).lerp(orange, k * k * (3 - 2 * k)).multiplyScalar(1 + (fbm(v.x * 0.5, v.y * 0.5, v.z * 0.5) - 0.5) * 0.16); });
  parts.push({ geo: hg, m: M(15, 11, 0) });
  // tail: a slim fan, raised a little
  const tg = new THREE.BoxGeometry(30, 3.2, 15, 4, 1, 3); { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) * (0.55 + (-x + 15) / 30 * 0.6)); } tg.computeVertexNormals(); }
  shade(tg, () => brown.clone().multiplyScalar(0.8));
  parts.push({ geo: tg, m: M(-34, 8, 0, 0, 0, -0.35) });
  const bm = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, envMapIntensity: 0.7, bumpMap: leafTexture(), bumpScale: 0.5 }));
  body.add(bm);
  // beak, eyes (glossy, with a catchlight)
  const beak = new THREE.Mesh(new THREE.CylinderGeometry(0, 3.4, 12, 10), new THREE.MeshStandardMaterial({ color: '#2b2420', roughness: 0.45 }));
  beak.rotation.z = -Math.PI / 2; beak.position.set(36, 10, 0); body.add(beak);
  const eyeM = new THREE.MeshPhysicalMaterial({ color: '#0d0907', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(3.6, 14, 10), eyeM); e.position.set(24, 15.5, s * 10.8); body.add(e); }
  // wings: shaped, folded along the side; pivot at the shoulder so they can beat
  // wings: rounded, feathered ellipsoids folded along the side (dark flight-feather tips); pivot at the shoulder so they can beat
  const wg = new THREE.SphereGeometry(1, 24, 14); wg.translate(-0.85, 0, 0); wg.scale(26, 10.5, 4.2);
  shade(wg, (v) => brown.clone().lerp(col('#3a2818'), clampN(-v.x / 46, 0, 1)).multiplyScalar(0.9 + (fbm(v.x * 0.4, v.y * 0.4, 0) - 0.5) * 0.3));
  const wm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, bumpMap: leafTexture(), bumpScale: 0.8 });
  const wings = [-1, 1].map((s) => { const piv = new THREE.Group(); piv.position.set(8, 9, s * 17); const w = new THREE.Mesh(wg, wm); w.rotation.z = 0.28; piv.add(w); body.add(piv); piv.userData.s = s; return piv; });
  // legs
  const legM = new THREE.MeshStandardMaterial({ color: '#6a4a3a', roughness: 0.6 });
  const legs = new THREE.Group(); body.add(legs);
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 16, 6), legM); l.position.set(4, -27, s * 7); legs.add(l); const t = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 12, 5), legM); t.rotation.z = Math.PI / 2; t.position.set(7, -35, s * 7); legs.add(t); }
  bm.castShadow = true;
  g.userData = { body, wings, legs };
  return g;
}
// wing pose: beat 0..1 (0 folded), phase in radians
export function poseBird(b, { flying = false, phase = 0, breathe = 0, tilt = 0, open = 0 }) {
  const { body, wings, legs } = b.userData;
  for (const w of wings) {
    const s = w.userData.s;
    const m = w.children[0];
    // flying: the wing swings out from the body and beats up and down about the body's long axis; perched: folded, breathing
    if (flying) { const a = Math.sin(phase); m.rotation.set(0, s * 1.2, 0.28 - 0.2); w.rotation.set(-s * a * 0.95, 0, 0); }
    else { m.rotation.set(0, s * (open || 0), 0.28); w.rotation.set(-s * ((open || 0) * 0.5 + breathe * 0.01), 0, 0); }
  }
  legs.visible = true; legs.scale.y = flying ? 0.45 : 1; legs.position.y = flying ? -12 : 0; legs.rotation.z = flying ? 0.7 : 0;
  body.rotation.z = tilt; body.scale.setScalar(1 + breathe * 0.015);
}

// ---------------------------------------------------------------- hunter props (metres: they sit in a real person's hands)
const woodM = () => new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.6, map: barkTexture() });
export function buildSlingshot() {
  const g = new THREE.Group(), m = woodM();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.11, 8), m); handle.position.y = 0.0; g.add(handle);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.1, 7), m); p.position.set(s * 0.028, 0.095, 0); p.rotation.z = -s * 0.5; g.add(p); }
  g.userData.tips = [new THREE.Vector3(-0.052, 0.14, 0), new THREE.Vector3(0.052, 0.14, 0)];
  return g;
}
export function buildBow() {
  const g = new THREE.Group();
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.014, 6, 30, Math.PI * 0.7), new THREE.MeshStandardMaterial({ color: '#6b4a24', roughness: 0.55 }));
  bow.rotation.z = Math.PI / 2 - Math.PI * 0.35; bow.position.x = -0.5; g.add(bow);
  const a = Math.PI * 0.35;
  g.userData.tips = [new THREE.Vector3(-0.5 + Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0), new THREE.Vector3(-0.5 + Math.cos(a) * 0.62, -Math.sin(a) * 0.62, 0)];
  return g;
}
export function buildHat(color) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.175, 0.012, 24), m); g.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.11, 20), m); crown.position.y = 0.06; g.add(crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.107, 0.107, 0.022, 20), new THREE.MeshStandardMaterial({ color: '#d8ae46', roughness: 0.5, metalness: 0.3 })); band.position.y = 0.018; g.add(band);
  return g;
}
// a thin cylinder from a to b (elastic bands, bow string, arrow shaft)
export function stick(radius, material) { const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 5, 1, true), material); m.userData.stick = true; return m; }
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
export function setStick(m, a, b) { _d.subVectors(b, a); const L = _d.length() || 1e-6; m.position.addVectors(a, b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(_up, _d.multiplyScalar(1 / L)); m.scale.set(1, L, 1); }

// ---------------------------------------------------------------- the stone, the arrow, the acorn, the golden seed (flat-art units)
export function buildStone(seed = 1) {
  const g = new THREE.SphereGeometry(1, 18, 12), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.85 + fbm(v.x * 1.4 + seed, v.y * 1.4, v.z * 1.4) * 0.3; p.setXYZ(i, v.x * k, v.y * k * 0.86, v.z * k); }
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#9a9c9e', roughness: 0.62, metalness: 0.02, bumpMap: barkTexture(), bumpScale: 0.6 }));
}
export function buildArrow() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 60, 6), new THREE.MeshStandardMaterial({ color: '#d9c9a0', roughness: 0.6 })); shaft.rotation.z = Math.PI / 2; g.add(shaft);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0, 3.4, 11, 4), new THREE.MeshStandardMaterial({ color: '#8a9096', roughness: 0.3, metalness: 0.8 })); head.rotation.z = -Math.PI / 2; head.position.x = 35; g.add(head);
  const fm = new THREE.MeshStandardMaterial({ color: '#d4573a', roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), fm); f.position.set(-26, 0, 0); f.rotation.x = i * TAU / 3; f.translateY(2.5); g.add(f); }
  return g;
}
export function buildAcorn() {
  const g = new THREE.Group();
  const nut = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: '#b07a3a', roughness: 0.35 })); nut.scale.set(9, 12, 9); nut.position.y = -2; g.add(nut);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6b4523', roughness: 0.95, map: barkTexture() })); cap.scale.set(10.5, 6, 10.5); cap.position.y = 5; g.add(cap);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 5, 5), cap.material); st.position.y = 12; g.add(st);
  return g;
}
export function buildSeed() {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.SphereGeometry(1, 4, 2), new THREE.MeshPhysicalMaterial({ color: '#ffcc33', emissive: '#a86a00', emissiveIntensity: 0.55, roughness: 0.18, metalness: 0.7, clearcoat: 1 }));
  gem.scale.set(10, 15, 10); g.add(gem);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,214,110', 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(70, 70, 1); g.add(glow);
  g.userData.gem = gem;
  return g;
}
// The net in flight / landing: a weighted round net (rings + spokes), flat-art units, radius 1.
export function buildNet() {
  const pts = [];
  for (const r of [1, 0.66, 0.33]) for (let i = 0; i < 40; i++) { const a0 = i / 40 * TAU, a1 = (i + 1) / 40 * TAU; pts.push(Math.cos(a0) * r, Math.sin(a0) * r, 0, Math.cos(a1) * r, Math.sin(a1) * r, 0); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; pts.push(0, 0, 0, Math.cos(a), Math.sin(a), 0); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const net = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#efe6cc', transparent: true, opacity: 0.95 }));
  const weights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.6, roughness: 0.4 }), 12);
  const m = new THREE.Matrix4(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; m.makeTranslation(Math.cos(a), Math.sin(a), 0); weights.setMatrixAt(i, m); }
  const g = new THREE.Group(); g.add(net, weights); return g;
}

// ---------------------------------------------------------------- the beater's dog (flat-art units, feet at y 0, facing +x)
export function buildDog() {
  const g = new THREE.Group(), coat = new THREE.MeshStandardMaterial({ color: '#8a6238', roughness: 0.8 }), dark = new THREE.MeshStandardMaterial({ color: '#4a2f18', roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(13, 34, 6, 12), coat); body.rotation.z = Math.PI / 2; body.position.y = 24; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 12), coat); head.position.set(32, 36, 0); g.add(head);
  const snout = new THREE.Mesh(new THREE.CapsuleGeometry(5.5, 9, 4, 8), coat); snout.rotation.z = Math.PI / 2; snout.position.set(44, 32, 0); g.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), dark); nose.position.set(52, 33, 0); g.add(nose);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 6), dark); e.scale.set(0.6, 1.6, 0.4); e.position.set(28, 44, s * 8); e.rotation.x = s * 0.4; g.add(e); }
  const legs = [];
  for (const [x, s] of [[-18, -1], [-18, 1], [16, -1], [16, 1]]) { const piv = new THREE.Group(); piv.position.set(x, 22, s * 8); const l = new THREE.Mesh(new THREE.CapsuleGeometry(3.6, 16, 4, 6), coat); l.position.y = -12; piv.add(l); g.add(piv); legs.push(piv); }
  const tail = new THREE.Group(); tail.position.set(-30, 30, 0); const tm = new THREE.Mesh(new THREE.CapsuleGeometry(2.6, 18, 4, 6), coat); tm.position.y = 10; tm.rotation.z = 0.5; tail.add(tm); g.add(tail);
  g.userData = { legs, tail };
  return g;
}
export function poseDog(d, t, run) {
  const { legs, tail } = d.userData;
  legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 22 + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.6 : 0)) * 0.7 * run; });
  tail.rotation.z = 0.3 + Math.sin(t * 16) * 0.4;
}

// ---------------------------------------------------------------- sky (screen-space), hills and ground
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { uHorizon: { value: 0.3 }, uTop: { value: col('#4f95d6') }, uMid: { value: col('#a8d3ec') }, uLow: { value: col('#f6e2b6') }, uSun: { value: new THREE.Vector2(0.2, 0.8) }, uSunCol: { value: col('#fff6dc') }, uAspect: { value: 0.5 }, uGround: { value: col('#5d8f50') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uHorizon; uniform vec3 uTop, uMid, uLow, uSunCol, uGround; uniform vec2 uSun; uniform float uAspect;
      void main(){
        float h = vUv.y - uHorizon;                                   // 0 at the horizon, up is positive
        float k = clamp(h / max(0.001, 1.0 - uHorizon), 0.0, 1.0);
        vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.32, k)); c = mix(c, uTop, smoothstep(0.25, 1.0, k));
        vec2 d = vUv - uSun; d.x *= uAspect; float r = length(d);
        c += uSunCol * (0.9 * exp(-r * 9.0) + 0.3 * exp(-r * 2.6));
        c = mix(c, vec3(1.0, 0.98, 0.9) * 1.25, smoothstep(0.05, 0.042, r));
        if (h < 0.0) c = uGround;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
