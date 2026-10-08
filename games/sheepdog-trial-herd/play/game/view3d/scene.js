// The hill-pasture world: terrain with the course's own shape, fences or dry-stone walls, trees, rocks, gorse, the handler's post, the gates, the pen, spectators,
// distant sheep, sky, clouds and rain. Everything is generated from fixed seeds with small canvas textures (no image files).
// Sim (x, z) maps to the scene as (-x, height, z): the sim has +x to the handler's right, a viewer behind the handler looking up the field sees scene +x on the left.
import { groundH, courseCircles, penGeom } from '../src/courses.js';

const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const TAU = Math.PI * 2;
export const toScene = (x, z) => [-x, z];

function tex(doc, THREE, w, h, draw, srgb = true) {
  const c = doc.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}

// merge indexed/non-indexed geometries into one coloured BufferGeometry. parts: [{ geo, m: Matrix4|null, color: hex | (x,y,z)=>[r,g,b] }]
export function mergeParts(THREE, parts) {
  let n = 0; const list = [];
  for (const p of parts) { let g = p.geo.clone(); if (p.m) g.applyMatrix4(p.m); if (g.index) g = g.toNonIndexed(); list.push({ g, color: p.color }); n += g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0; const c = new THREE.Color();
  for (const { g, color } of list) {
    const P = g.attributes.position, N = g.attributes.normal, k = P.count;
    for (let i = 0; i < k; i++) {
      pos[(o + i) * 3] = P.getX(i); pos[(o + i) * 3 + 1] = P.getY(i); pos[(o + i) * 3 + 2] = P.getZ(i);
      nor[(o + i) * 3] = N.getX(i); nor[(o + i) * 3 + 1] = N.getY(i); nor[(o + i) * 3 + 2] = N.getZ(i);
      let r, gg, b;
      if (typeof color === 'function') [r, gg, b] = color(P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i));
      else { c.set(color); r = c.r; gg = c.g; b = c.b; }
      col[(o + i) * 3] = r; col[(o + i) * 3 + 1] = gg; col[(o + i) * 3 + 2] = b;
    }
    o += k; g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const TONES = {
  meadow: { field: '#5fa244', outer: '#6aa64a', alt: '#8ab552', rock: '#8c8a80', tree: 'oak', wall: 'fence', hedge: true },
  farm: { field: '#5c9c40', outer: '#6a9f46', alt: '#a8b25a', rock: '#8c8a80', tree: 'oak', wall: 'fence', hedge: true },
  hill: { field: '#6a9a45', outer: '#738e48', alt: '#8a8d4e', rock: '#8e8b80', tree: 'mixed', wall: 'stone', hedge: false },
  moor: { field: '#7a9048', outer: '#77704a', alt: '#7b5a86', rock: '#8a877e', tree: 'pine', wall: 'stone', hedge: false },
  crag: { field: '#78864f', outer: '#7d7a5a', alt: '#6c6c68', rock: '#8f8f8c', tree: 'pine', wall: 'stone', hedge: false },
};

export function buildWorld(V3, stage, course, quality = 'high') {
  const { THREE } = V3;
  const doc = globalThis.document;
  const R = rnd(7 + course.n * 131 + course.b.z1);
  const T = TONES[course.tone] || TONES.meadow;
  const root = new THREE.Group(); root.name = 'world';
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const std = (c, r = 0.9, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });
  const gh = (xs, zs) => groundH(course, xs, zs);                      // by SIM coordinates
  const hAt = (X, Z) => groundH(course, -X, Z);                         // by SCENE coordinates
  const b = course.b;
  const W = { root, hAt, gh, animated: [], gates: [], pen: null, rain: null, clouds: [], course };

  // ---- terrain: a graded grid, fine over the field and growing towards the far hills
  {
    const axis = (lo, hi, step, far0, far1, grow) => {
      const a = [];
      for (let v = lo; v <= hi + 1e-6; v += step) a.push(v);
      let s = step * grow, v = hi;
      while (v < far1) { v += s; a.push(v); s *= grow; }
      v = lo; s = step * grow; const left = [];
      while (v > far0) { v -= s; left.unshift(v); s *= grow; }
      return [...left, ...a];
    };
    const cell = quality === 'high' ? 1.5 : 2.1;
    const xs = axis(-(Math.max(Math.abs(b.x0), Math.abs(b.x1)) + 30), Math.max(Math.abs(b.x0), Math.abs(b.x1)) + 30, cell, -520, 520, 1.22);
    const zs = axis(b.z0 - 34, b.z1 + 44, cell, -420, 560, 1.22);
    const NX = xs.length, NZ = zs.length;
    const pos = new Float32Array(NX * NZ * 3), uv = new Float32Array(NX * NZ * 2), col = new Float32Array(NX * NZ * 3);
    const Hs = new Float32Array(NX * NZ);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i, h = hAt(xs[i], zs[j]);
      pos[k * 3] = xs[i]; pos[k * 3 + 1] = h; pos[k * 3 + 2] = zs[j]; Hs[k] = h; uv[k * 2] = xs[i] / 5; uv[k * 2 + 1] = zs[j] / 5;
    }
    const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6); let q = 0;
    for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, bb = a + 1, c = a + NX, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = bb; idx[q++] = bb; idx[q++] = c; idx[q++] = d; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const nor = geo.attributes.normal;
    const c = new THREE.Color(), c2 = new THREE.Color();
    const inField = (x, z) => x >= -b.x1 - 0 && x <= -b.x0 + 0 && z >= b.z0 && z <= b.z1;     // scene x is mirrored
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i, X = xs[i], Z = zs[j], h = Hs[k], slope = 1 - nor.getY(k);
      const patch = Math.sin(X * 0.071 + 1.3) * Math.cos(Z * 0.062 - 0.7) + 0.6 * Math.sin(X * 0.17 + Z * 0.13) + 0.3 * Math.sin(X * 0.41 - Z * 0.37);
      const inF = inField(X, Z);
      if (inF) { c.set(T.field); c.multiplyScalar(0.93 + 0.09 * patch + 0.03 * Math.sin(Z * 0.35)); if (patch < -0.7) { c2.set('#4a8a38'); c.lerp(c2, 0.4); } else if (patch > 1.1) { c2.set('#97b552'); c.lerp(c2, 0.35); } }
      else {
        c.set(T.outer);
        if (patch > 0.8) c2.set(T.alt), c.lerp(c2, Math.min(1, (patch - 0.8) * 0.9));
        // outer patchwork fields on the gentle land near the farm
        if (course.tone === 'farm' || course.tone === 'meadow') { const f = Math.floor((X + 900) / 46) + Math.floor((Z + 900) / 38) * 7; if ((f * 2654435761 >>> 0) % 5 < 2) { c2.set(f % 2 ? '#b9b560' : '#78a850'); c.lerp(c2, 0.55); } }
      }
      if (slope > 0.22 && !inF) { c2.set(T.rock); c.lerp(c2, Math.min(0.85, (slope - 0.22) * 2.6)); }
      if (course.tone === 'crag' && h > 14 && !inF) { c2.set('#8f8f8c'); c.lerp(c2, Math.min(0.75, (h - 14) / 40)); }
      // worn earth round the post and the pen mouth
      if (course.pen) { const dp = Math.hypot(-X - course.pen.cx, Z - course.pen.cz - 4); if (dp < 5) { c2.set('#8d7653'); c.lerp(c2, (1 - dp / 5) * 0.7); } }
      { const dh = Math.hypot(X, Z); if (dh < 3.2) { c2.set('#8d7653'); c.lerp(c2, (1 - dh / 3.2) * 0.75); } }
      const sh = 0.93 + 0.1 * Math.sin(X * 1.7) * Math.sin(Z * 1.3);
      col[k * 3] = c.r * sh; col[k * 3 + 1] = c.g * sh; col[k * 3 + 2] = c.b * sh;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const grass = tex(doc, THREE, 256, 256, (g, w, h) => {
      g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h);
      const r = rnd(5);
      for (let i = 0; i < 2600; i++) { const x = r() * w, y = r() * h, l = 4 + r() * 9, a = (r() - 0.5) * 0.9; const v = 150 + r() * 105; g.strokeStyle = `rgba(${v},${v + 10},${v - 30},${0.28 + r() * 0.3})`; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); g.stroke(); }
    });
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.anisotropy = 4;
    const mat = std(0xffffff, 0.96, 0, { vertexColors: true, map: grass });
    const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; root.add(mesh);
    W.terrain = mesh; W.groundMat = mat;
  }

  // ---- helpers for instancing
  const mtx = new THREE.Matrix4(), qa = new THREE.Quaternion(), ea = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  const put = (im, k, x, y, z, ry, sx, sy, sz, rx = 0, rz = 0) => { ea.set(rx, ry, rz); qa.setFromEuler(ea); mtx.compose(ps.set(x, y, z), qa, sc.set(sx, sy, sz)); im.setMatrixAt(k, mtx); };

  // ---- the boundary: dry-stone wall or post-and-rail fence round the field
  {
    const segs = [[b.x0, b.z0, b.x1, b.z0], [b.x1, b.z0, b.x1, b.z1], [b.x1, b.z1, b.x0, b.z1], [b.x0, b.z1, b.x0, b.z0]];
    if (T.wall === 'stone') {
      const step = 1.3; let n = 0; for (const s of segs) n += Math.ceil(Math.hypot(s[2] - s[0], s[3] - s[1]) / step);
      const stones = new THREE.InstancedMesh(new THREE.BoxGeometry(1.25, 0.34, 0.55), std(0xffffff, 0.97), n * 3);
      const cap = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.2, 0.55), std(0x9a968a, 0.97), n);
      let k = 0, kc = 0;
      for (const s of segs) {
        const L = Math.hypot(s[2] - s[0], s[3] - s[1]), cnt = Math.ceil(L / step), ang = Math.atan2(s[3] - s[1], s[2] - s[0]);
        for (let i = 0; i < cnt; i++) {
          const t = (i + 0.5) / cnt, x = s[0] + (s[2] - s[0]) * t, z = s[1] + (s[3] - s[1]) * t, X = -x, y0 = hAt(X, z);
          for (let r = 0; r < 3; r++) { const jit = (R() - 0.5) * 0.12; put(stones, k, X + jit, y0 + 0.17 + r * 0.31, z + jit, -ang + (R() - 0.5) * 0.12, L / cnt / 1.25 * (0.95 + R() * 0.12), 0.9 + R() * 0.2, 0.9 + R() * 0.2); col.setHSL(0.1 + R() * 0.04, 0.05 + R() * 0.05, 0.42 + R() * 0.2); stones.setColorAt(k, col); k++; }
          put(cap, kc, X, y0 + 0.97, z, -ang, 1 + R() * 0.3, 1, 1); col.setHSL(0.1, 0.05, 0.4 + R() * 0.2); cap.setColorAt(kc, col); kc++;
        }
      }
      stones.count = k; cap.count = kc; stones.castShadow = false; stones.receiveShadow = true; stones.frustumCulled = false; cap.frustumCulled = false; root.add(stones, cap);
    } else {
      // post and rail
      let n = 0; for (const s of segs) n += Math.ceil(Math.hypot(s[2] - s[0], s[3] - s[1]) / 3);
      const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 1.3, 0.13), std(0x7a5c3c, 0.9), n);
      const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(3.05, 0.09, 0.05), std(0x8a6a46, 0.9), n * 2);
      let k = 0, kr = 0;
      for (const s of segs) {
        const L = Math.hypot(s[2] - s[0], s[3] - s[1]), cnt = Math.ceil(L / 3), ang = Math.atan2(s[3] - s[1], s[2] - s[0]);
        for (let i = 0; i < cnt; i++) {
          const t = i / cnt, x = s[0] + (s[2] - s[0]) * t, z = s[1] + (s[3] - s[1]) * t, X = -x, y0 = hAt(X, z);
          put(posts, k++, X, y0 + 0.65, z, 0, 1, 1, 1);
          const xm = s[0] + (s[2] - s[0]) * (t + 0.5 / cnt), zm = s[1] + (s[3] - s[1]) * (t + 0.5 / cnt), ym = hAt(-xm, zm), sx = L / cnt / 3.05;
          put(rails, kr++, -xm, ym + 0.55, zm, -ang, sx, 1, 1); put(rails, kr++, -xm, ym + 1.0, zm, -ang, sx, 1, 1);
        }
      }
      posts.count = k; rails.count = kr; posts.castShadow = true; rails.castShadow = true; posts.frustumCulled = false; rails.frustumCulled = false; root.add(posts, rails);
    }
  }

  // ---- hedges beyond the fence (farm tones), trees, rocks, gorse
  {
    const hedge = T.hedge ? 150 : 0;
    if (hedge) {
      const g = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), std(0xffffff, 0.95), hedge);
      for (let i = 0; i < hedge; i++) {
        const side = i % 3, t = (i / hedge) * 3 % 1;
        let x, z; if (side === 0) { x = b.x0 - 7 - R() * 0.8; z = b.z0 + t * (b.z1 - b.z0); } else if (side === 1) { x = b.x1 + 7 + R() * 0.8; z = b.z0 + t * (b.z1 - b.z0); } else { x = b.x0 + t * (b.x1 - b.x0); z = b.z1 + 7 + R() * 0.8; }
        const s = 1.3 + R() * 0.7; put(g, i, -x, hAt(-x, z) + s * 0.55, z, R() * 6, s * 1.4, s * 0.9, s, 0, 0); col.setHSL(0.27 + R() * 0.05, 0.4, 0.22 + R() * 0.1); g.setColorAt(i, col);
      }
      g.frustumCulled = false; g.castShadow = false; root.add(g);
    }
    // trees
    const NT = quality === 'high' ? 170 : 90;
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.34, 3.4, 6), std(0x4d3a28, 0.95), NT);
    const crownGeo = T.tree === 'pine' ? new THREE.CylinderGeometry(0.05, 2.1, 6.2, 8) : new THREE.SphereGeometry(2.7, 8, 6);
    const crowns = new THREE.InstancedMesh(crownGeo, std(0xffffff, 0.95), NT * 2);
    let nt = 0, nc = 0, tries = 0;
    while (nt < NT && tries++ < NT * 40) {
      const x = (R() - 0.5) * 520, z = -60 + R() * 420;
      if (x > b.x0 - 12 && x < b.x1 + 12 && z > b.z0 - 12 && z < b.z1 + 12) continue;
      const h = hAt(-x, z); if (h > 70) continue;
      const s = 0.8 + R() * 0.9, pine = T.tree === 'pine' || (T.tree === 'mixed' && R() < 0.4);
      put(trunk, nt, -x, h + 1.7 * s, z, 0, s, s, s);
      if (pine) { put(crowns, nc, -x, h + 5.2 * s, z, R() * 6, s, s, s); col.setHSL(0.36 + R() * 0.03, 0.4, 0.14 + R() * 0.08); } else { put(crowns, nc, -x, h + 5.0 * s, z, R() * 6, s * 1.15, s * 0.95, s * 1.15); col.setHSL(0.24 + R() * 0.07, 0.42, 0.2 + R() * 0.1); }
      crowns.setColorAt(nc, col); nc++; nt++;
    }
    trunk.count = nt; crowns.count = nc; trunk.frustumCulled = false; crowns.frustumCulled = false; trunk.castShadow = false; crowns.castShadow = false; root.add(trunk, crowns);
    // boulders: the course's own are solid (match the sim), more lie about outside
    const rockGeo = new THREE.SphereGeometry(1, 8, 6);
    { const p = rockGeo.attributes.position; const rr = rnd(3); for (let i = 0; i < p.count; i++) { const f = 0.82 + rr() * 0.36; p.setXYZ(i, p.getX(i) * f, p.getY(i) * (0.8 + rr() * 0.3), p.getZ(i) * f); } rockGeo.computeVertexNormals(); }
    const solid = course.rocks, NR = solid.length + 60;
    const rocks = new THREE.InstancedMesh(rockGeo, std(T.rock, 0.97), NR);
    solid.forEach(([x, z, r], i) => { put(rocks, i, -x, hAt(-x, z) + r * 0.25, z, R() * 6, r * 1.1, r * 0.85, r * 1.0); col.set(T.rock).multiplyScalar(0.85 + R() * 0.3); rocks.setColorAt(i, col); });
    let kr = solid.length;
    for (let i = 0; i < 60; i++) { const x = (R() - 0.5) * 460, z = -40 + R() * 340; if (x > b.x0 - 4 && x < b.x1 + 4 && z > b.z0 - 4 && z < b.z1 + 4) continue; const s = 0.5 + R() * 2.2; put(rocks, kr, -x, hAt(-x, z) + s * 0.2, z, R() * 6, s * 1.3, s * 0.8, s); col.set(T.rock).multiplyScalar(0.8 + R() * 0.4); rocks.setColorAt(kr, col); kr++; }
    rocks.count = kr; rocks.castShadow = true; rocks.receiveShadow = true; rocks.frustumCulled = false; root.add(rocks);
    // gorse: yellow-flecked green mounds (the course's own, plus some outside)
    const gor = course.gorse.length ? course.gorse : [];
    const NG = gor.length + (course.tone === 'moor' || course.tone === 'crag' || course.tone === 'hill' ? 40 : 14);
    const gmat = std(0xffffff, 0.95, 0, { vertexColors: true });
    const ggeo = mergeParts(THREE, (() => { const parts = []; const r2 = rnd(11); for (let i = 0; i < 9; i++) { const m = new THREE.Matrix4().compose(V((r2() - 0.5) * 1.3, 0.35 + r2() * 0.35, (r2() - 0.5) * 1.3), new THREE.Quaternion(), V(0.55 + r2() * 0.3, 0.5 + r2() * 0.3, 0.55 + r2() * 0.3)); parts.push({ geo: new THREE.SphereGeometry(1, 6, 5), m, color: r2() < 0.45 ? '#d9c43a' : '#476b2a' }); } return parts; })());
    const gm = new THREE.InstancedMesh(ggeo, gmat, NG);
    for (let i = 0; i < NG; i++) {
      let x, z, s; if (i < gor.length) { x = gor[i][0]; z = gor[i][1]; s = gor[i][2] * 0.85; } else { x = (R() - 0.5) * 300; z = -20 + R() * 300; if (x > b.x0 - 3 && x < b.x1 + 3 && z > b.z0 - 3 && z < b.z1 + 3) { x = b.x1 + 12 + R() * 40; } s = 0.8 + R() * 1.4; }
      put(gm, i, -x, hAt(-x, z) - 0.05, z, R() * 6, s, s * 0.9, s);
    }
    gm.frustumCulled = false; gm.castShadow = false; root.add(gm);
  }

  // ---- grass tufts, clover and wild flowers across the field, so the ground has grain from near and from far
  {
    const NT2 = quality === 'high' ? 4200 : 2200;
    const tg = mergeParts(THREE, [0, 1, 2, 3].map((i) => { const g0 = new THREE.CylinderGeometry(0.0, 0.035, 0.26 - i * 0.03, 4); g0.translate(0, (0.26 - i * 0.03) / 2, 0); const a = (i / 4) * Math.PI * 2; return { geo: g0, m: new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45)), new THREE.Vector3(1, 1, 1)), color: '#ffffff' }; }));
    const tufts = new THREE.InstancedMesh(tg, std(0xffffff, 0.95, 0, { vertexColors: true }), NT2);
    for (let i = 0; i < NT2; i++) {
      const x = b.x0 + R() * (b.x1 - b.x0), z = b.z0 + R() * (b.z1 - b.z0), s = 0.9 + R() * 1.3;
      put(tufts, i, -x, hAt(-x, z) - 0.02, z, R() * 6, s, s * (0.7 + R() * 0.8), s);
      col.setHSL(0.22 + R() * 0.1, 0.45 + R() * 0.2, 0.2 + R() * 0.16); tufts.setColorAt(i, col);
    }
    tufts.frustumCulled = false; tufts.castShadow = false; root.add(tufts);
    const NF = quality === 'high' ? 1100 : 500, fg = new THREE.SphereGeometry(0.06, 5, 4), flowers = new THREE.InstancedMesh(fg, std(0xffffff, 0.8), NF);
    const fc = ['#f6f2e6', '#f2d24a', '#f6f2e6', '#e8a0c8', '#f2d24a'];
    for (let i = 0; i < NF; i++) { const x = b.x0 + R() * (b.x1 - b.x0), z = b.z0 + R() * (b.z1 - b.z0); put(flowers, i, -x, hAt(-x, z) + 0.14, z, 0, 1, 0.6, 1); flowers.setColorAt(i, col.set(fc[i % fc.length])); }
    flowers.frustumCulled = false; root.add(flowers);
  }

  // ---- far sheep on the slopes, grazing (white specks)
  {
    const N = 70, geo = new THREE.SphereGeometry(0.5, 6, 4), im = new THREE.InstancedMesh(geo, std(0xf0ece0, 0.95), N); let k = 0;
    for (let i = 0; i < N * 6 && k < N; i++) { const x = (R() - 0.5) * 380, z = -30 + R() * 340; if (x > b.x0 - 6 && x < b.x1 + 6 && z > b.z0 - 6 && z < b.z1 + 6) continue; const h = hAt(-x, z); if (h > 60) continue; put(im, k++, -x, h + 0.4, z, R() * 6, 1.1, 0.8, 0.8); }
    im.count = k; im.frustumCulled = false; root.add(im);
  }

  // ---- the handler's post and the trial furniture near it
  {
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.1, 8), std(0xe8e2d0, 0.7)); stake.position.set(-0.8, hAt(-0.8, -0.8) + 0.55, -0.8); stake.castShadow = true; root.add(stake);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.14, 8), std(0xd98a3a, 0.6)); cap.position.set(-0.8, hAt(-0.8, -0.8) + 1.12, -0.8); root.add(cap);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.5, 48), new THREE.MeshBasicMaterial({ color: 0xf4f1e6, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, hAt(0, 0) + 0.03, 0); root.add(ring);
    // a marquee, hay bales, a bench, a water trough, a few spectators
    const tentTex = tex(doc, THREE, 128, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f1ede0' : '#2e7d6b'; g.fillRect((i * w) / 8, 0, w / 8 + 1, h); } });
    tentTex.wrapS = THREE.RepeatWrapping;
    const tx = 17, tz = -13;
    const tent = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(9, 2.4, 5), std(0xf1ede0, 0.95)); walls.position.y = 1.2; walls.castShadow = true; tent.add(walls);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 3.5, 2.0, 4, 1), std(0xffffff, 0.9, 0, { map: tentTex })); roof.rotation.y = Math.PI / 4; roof.scale.set(1.85, 1, 1.05); roof.position.y = 3.4; roof.castShadow = true; tent.add(roof);
    tent.position.set(tx, hAt(tx, tz), tz); tent.rotation.y = 0.35; root.add(tent);
    const bales = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 12), std(0xcdb36a, 0.95), 7);
    [[-14, -9], [-15.2, -9.4], [-14.6, -8.8, 1], [6, -16], [7.1, -15.6], [-26, 4], [-27, 4.8]].forEach(([x, z, up], i) => { put(bales, i, x, hAt(x, z) + (up ? 1.0 : 0.46), z, R() * 6, 1, 1, 1, up ? 0 : Math.PI / 2, 0); });
    bales.castShadow = true; bales.frustumCulled = false; root.add(bales);
    // spectators: simple standing figures
    const bodyGeo = new THREE.CylinderGeometry(0.23, 0.2, 0.7, 8); bodyGeo.translate(0, 1.0, 0);
    const legGeo = new THREE.CylinderGeometry(0.17, 0.15, 0.66, 8); legGeo.translate(0, 0.33, 0);
    const headGeo = new THREE.SphereGeometry(0.14, 8, 6); headGeo.translate(0, 1.5, 0);
    const N = 16, bodies = new THREE.InstancedMesh(bodyGeo, std(0xffffff, 0.9), N), legs = new THREE.InstancedMesh(legGeo, std(0x3a3a46, 0.9), N), heads = new THREE.InstancedMesh(headGeo, std(0xffffff, 0.8), N);
    const cols = ['#5d6a8f', '#a85a4c', '#4f7d5e', '#c9a85c', '#7a4f7c', '#3d5a73', '#b8b4a4', '#8c4a32'], skins = ['#e8c3a2', '#d9a982', '#b98563', '#8f5f43', '#f1d3b8'];
    for (let i = 0; i < N; i++) {
      const a = -0.5 + i * 0.37, rad = 9 + (i % 3) * 1.4, x = -16 + Math.cos(a * 2.1) * rad * 0.9 + (i % 2) * 14, z = -9 - Math.abs(Math.sin(a * 3)) * 6 - (i % 3) * 1.2;
      const h = hAt(x, z); const ry = Math.atan2(-x * 0.2, 20);
      for (const im of [bodies, legs, heads]) put(im, i, x, h, z, ry + (R() - 0.5) * 0.6, 1, 0.95 + R() * 0.1, 1);
      bodies.setColorAt(i, col.set(cols[i % cols.length])); heads.setColorAt(i, col.set(skins[(i * 3) % skins.length]));
    }
    for (const im of [bodies, legs, heads]) { im.frustumCulled = false; im.castShadow = true; root.add(im); }
  }

  // ---- gates: two white posts, a flag on each, painted chevrons on the approach showing the way through, a numbered sign
  const GATE_COL = { fetch: 0x2fb5a0, d1: 0xe0a030, d2: 0xe0602f };
  const GATE_TXT = { fetch: 'F', d1: '1', d2: '2' };
  for (const key of ['fetch', 'd1', 'd2']) {
    const g = course[key]; if (!g) continue;
    const grp = new THREE.Group();
    const [X, Z] = toScene(g.cx, g.cz);
    const px = -g.dz, pz = g.dx;                                  // along the gate line (sim)
    const ang = Math.atan2(-g.dx, g.dz);                          // scene heading of the pass direction
    for (const sgn of [-1, 1]) {
      const sx = -(g.cx + px * sgn * g.w / 2), sz = g.cz + pz * sgn * g.w / 2, h0 = hAt(sx, sz);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1.7, 8), std(0xf2efe4, 0.65)); post.position.set(sx, h0 + 0.85, sz); post.castShadow = true; root.add(post);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.22, 8), std(GATE_COL[key], 0.6)); band.position.set(sx, h0 + 1.5, sz); root.add(band);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.0, 5), std(0xdedbd0, 0.6)); pole.position.set(sx, h0 + 2.2, sz); root.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.36, 5, 1), new THREE.MeshBasicMaterial({ color: GATE_COL[key], side: THREE.DoubleSide }));
      flag.position.set(sx, h0 + 2.5, sz); flag.userData = { base: flag.geometry.attributes.position.array.slice(), phase: R() * 6 }; flag.rotation.y = 0.3; root.add(flag); W.animated.push({ flag });
    }
    // chevrons on the ground before the gate
    const chev = tex(doc, THREE, 128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 16; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(20, 96); c.lineTo(64, 40); c.lineTo(108, 96); c.stroke(); });
    for (let i = 0; i < 3; i++) {
      const dist = 3.2 + i * 2.1, x = -(g.cx - g.dx * dist), z = g.cz - g.dz * dist;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), new THREE.MeshBasicMaterial({ map: chev, transparent: true, opacity: 0.5 - i * 0.12, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = ang; m.position.set(x, hAt(x, z) + 0.05, z); root.add(m);
    }
    // the sign
    const label = tex(doc, THREE, 128, 128, (c, w, h) => { c.fillStyle = '#' + GATE_COL[key].toString(16).padStart(6, '0'); c.beginPath(); c.arc(64, 64, 58, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.font = '900 84px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(GATE_TXT[key], 64, 70); });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: label, depthWrite: false, fog: false })); sp.position.set(X, hAt(X, Z) + 3.4, Z); sp.scale.set(1.5, 1.5, 1); root.add(sp);
    W.gates.push({ key, group: grp });
  }

  // ---- the pen: timber hurdles on three sides, straw, a hinged gate
  if (course.pen) {
    const pg = penGeom(course);
    const timber = std(0x8a6a46, 0.9), timberD = std(0x6f5434, 0.9);
    const wall = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const X = -cx, y = hAt(X, cz);
      for (const yy of [0.3, 0.62, 0.94]) { const r = new THREE.Mesh(new THREE.BoxGeometry(L, 0.09, 0.06), timber); r.position.set(X, y + yy, cz); r.rotation.y = -ang; r.castShadow = true; root.add(r); }
      const n = Math.max(2, Math.round(L / 1.6) + 1);
      for (let i = 0; i < n; i++) { const t = i / (n - 1), px = -(x0 + (x1 - x0) * t), pz = z0 + (z1 - z0) * t; const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), timberD); p.position.set(px, hAt(px, pz) + 0.55, pz); p.castShadow = true; root.add(p); }
    };
    for (const s of pg.walls) wall(s[0], s[1], s[2], s[3]);
    const straw = new THREE.Mesh(new THREE.PlaneGeometry(pg.x1 - pg.x0 - 0.2, pg.z1 - pg.z0 - 0.2), std(0xcdb26a, 1, 0, { map: tex(doc, THREE, 64, 64, (c, w, h) => { c.fillStyle = '#d8bf78'; c.fillRect(0, 0, w, h); const r = rnd(9); for (let i = 0; i < 160; i++) { c.strokeStyle = `rgba(${150 + r() * 80},${120 + r() * 70},60,0.7)`; c.lineWidth = 1.5; c.beginPath(); const x = r() * w, y = r() * h; c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 14); c.stroke(); } }) }));
    straw.rotation.x = -Math.PI / 2; straw.position.set(-course.pen.cx, hAt(-course.pen.cx, course.pen.cz) + 0.06, course.pen.cz); straw.receiveShadow = true; root.add(straw);
    // the gate leaf hinges at the west end of the mouth (sim) = scene hx
    const hx = -pg.hinge.x, hz = pg.hinge.z, leaf = new THREE.Group(); leaf.position.set(hx, hAt(hx, hz), hz);
    for (const yy of [0.3, 0.62, 0.94]) { const r = new THREE.Mesh(new THREE.BoxGeometry(pg.leaf, 0.09, 0.06), timber); r.position.set(-pg.leaf / 2, yy, 0); r.castShadow = true; leaf.add(r); }
    for (const t of [0, 0.5, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.0, 0.09), timberD); p.position.set(-pg.leaf * t, 0.5, 0); leaf.add(p); }
    const brace = new THREE.Mesh(new THREE.BoxGeometry(pg.leaf * 1.05, 0.07, 0.05), timber); brace.position.set(-pg.leaf / 2, 0.62, 0); brace.rotation.z = 0.5; leaf.add(brace);
    root.add(leaf);
    W.pen = { leaf, angle: 0, hinge: { x: hx, z: hz } };
    // the pen sign
    const sign = tex(doc, THREE, 256, 96, (c, w, h) => { c.fillStyle = '#f2efe4'; c.fillRect(0, 0, w, h); c.fillStyle = '#2e5d4a'; c.font = '900 64px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PEN', w / 2, h / 2 + 4); });
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: sign, side: THREE.DoubleSide })); sp.position.set(-pg.x0 - 0.2, hAt(-pg.x0, pg.z0) + 1.7, pg.z0 + 0.1); sp.rotation.y = Math.PI; root.add(sp);   // faces the handler (-z), so the lettering reads the right way round
  }

  // ---- sky, clouds, rain
  {
    const cloudTex = tex(doc, THREE, 128, 64, (g, w, h) => { for (let i = 0; i < 9; i++) { const x = w * (0.2 + 0.6 * R()), y = h * (0.35 + 0.3 * R()), r = h * (0.25 + 0.25 * R()); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 }));
      const a = R() * TAU, d = 280 + R() * 100; m.position.set(Math.cos(a) * d, 90 + R() * 70, Math.sin(a) * d); m.scale.set(120 + R() * 90, 44 + R() * 22, 1); m.userData = { a, d, y: m.position.y, v: 0.0008 + R() * 0.0012 }; root.add(m); W.clouds.push(m);
    }
    const RAIN = 1400, rp = new Float32Array(RAIN * 6), rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xcfe0ee, transparent: true, opacity: 0.45, depthWrite: false })); rain.frustumCulled = false; rain.visible = false; root.add(rain);
    W.rain = { mesh: rain, n: RAIN, seed: rnd(21), drops: Array.from({ length: RAIN }, (_, i) => ({ x: 0, y: 0, z: 0, s: 0.8 + (i % 7) * 0.08 })) };
    W.rainInit = false;
  }

  W.dispose = () => {
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); } } });
    stage.scene.remove(root);
  };
  stage.add(root);
  return W;
}

// per frame: flag ripple, gate leaf swing, clouds, rain. `cam` is the camera position (scene coordinates).
export function updateWorld(W, THREE, dt, t, o) {
  for (const a of W.animated) {
    const f = a.flag, p = f.geometry.attributes.position, b = f.userData.base, amp = 0.05 + 0.08 * o.wind;
    for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(t * (3 + o.wind * 3) + x * 5 + f.userData.phase) * amp * (x + 0.31)); }
    p.needsUpdate = true;
  }
  if (W.pen) {
    const target = o.penOpen ? -Math.PI : 0, cur = W.pen.angle;
    W.pen.angle = cur + Math.max(-dt * 2.4, Math.min(dt * 2.4, target - cur)); W.pen.leaf.rotation.y = W.pen.angle;
  }
  for (const c of W.clouds) { const u = c.userData; u.a += u.v * dt * (1 + o.wind * 4); c.position.set(Math.cos(u.a) * u.d, u.y, Math.sin(u.a) * u.d); c.material.opacity = o.cloud; }
  const r = W.rain;
  if (r) {
    r.mesh.visible = o.rain > 0.01;
    if (r.mesh.visible) {
      const pos = r.mesh.geometry.attributes.position.array, cx = o.cam.x, cy = o.cam.y, cz = o.cam.z, box = 36;
      for (let i = 0; i < r.n; i++) {
        const d = r.drops[i];
        if (!W.rainInit) { d.x = (r.seed() - 0.5) * box * 2; d.y = r.seed() * 30; d.z = (r.seed() - 0.5) * box * 2; }
        d.y -= (16 + d.s * 8) * dt; d.x -= 1.5 * dt * o.wind;
        if (d.y < -4) { d.y = 26 + r.seed() * 8; d.x = (r.seed() - 0.5) * box * 2; d.z = (r.seed() - 0.5) * box * 2; }
        const x = cx + d.x, y = cy - 6 + d.y, z = cz + d.z;
        pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z; pos[i * 6 + 3] = x - 0.04 - 0.05 * o.wind; pos[i * 6 + 4] = y + 0.55 * d.s; pos[i * 6 + 5] = z;
      }
      W.rainInit = true; r.mesh.geometry.attributes.position.needsUpdate = true; r.mesh.material.opacity = 0.18 + 0.3 * o.rain;
    }
  }
}

// sky gradient + lights for the time of day and weather
const SKY = {
  dawn: { top: '#6f8fc9', mid: '#e8a6a0', hor: '#ffd9a8', fog: 0xf0c9ae, sun: 0xffc08a, keyI: 2.4, hemi: 0.75, hemiSky: 0xffd9c0, hemiG: 0x55603f, exposure: 0.96, off: [38, 14, 26] },
  day: { top: '#4f8fe0', mid: '#98c4ee', hor: '#e3eef0', fog: 0xc9dcec, sun: 0xfff0d8, keyI: 3.0, hemi: 0.95, hemiSky: 0xcfe6ff, hemiG: 0x4d6a3a, exposure: 0.95, off: [-16, 30, 14] },
  dusk: { top: '#3e4f94', mid: '#d28c86', hor: '#ffbf7a', fog: 0xe4b48f, sun: 0xffa860, keyI: 2.5, hemi: 0.7, hemiSky: 0xffcfa6, hemiG: 0x4d5238, exposure: 0.98, off: [-40, 12, 6] },
};
export function applyAtmosphere(stage, THREE, W, tod, weather) {
  const S = SKY[tod] || SKY.day, doc = globalThis.document;
  const mist = weather === 'mist', rain = weather === 'rain';
  const grey = mist ? 0.75 : rain ? 0.6 : 0;
  const mixc = (hex, g) => { const c = new THREE.Color(hex), gcol = new THREE.Color(0xb9c0c2); return c.lerp(gcol, g); };
  const t = tex(doc, THREE, 4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    const top = '#' + mixc(S.top, grey).getHexString(), mid = '#' + mixc(S.mid, grey).getHexString(), hor = '#' + mixc(S.hor, grey * 0.9).getHexString();
    gr.addColorStop(0, top); gr.addColorStop(0.45, mid); gr.addColorStop(0.82, hor); gr.addColorStop(1, hor); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  stage.scene.background = t;
  const fogc = mixc(S.fog, mist ? 0.8 : rain ? 0.5 : 0);
  stage.scene.fog = new THREE.Fog(fogc, mist ? 14 : rain ? 50 : 110, mist ? 120 : rain ? 260 : 520);
  stage.setLighting('day', { sky: fogc.getHex(), fog: fogc.getHex(), hemiSky: S.hemiSky, hemiGround: S.hemiG, hemi: S.hemi * (rain ? 0.85 : 1) * (mist ? 1.05 : 1), key: S.sun, keyI: S.keyI * (rain ? 0.45 : mist ? 0.6 : 1), rim: 0xbfd8ff, rimI: 0.7, exposure: S.exposure + (mist ? 0.12 : 0) });
  stage.scene.fog = new THREE.Fog(fogc, mist ? 14 : rain ? 50 : 110, mist ? 120 : rain ? 260 : 520);
  stage.scene.background = t;
  stage._shadowOffset.set(S.off[0], S.off[1], S.off[2]);
  if (W) {
    W.groundMat.color.setScalar(rain ? 0.78 : 1);
    W.cloudBase = rain ? 1 : mist ? 0.55 : weather === 'breeze' ? 0.9 : 0.62;
  }
  return { cloud: rain ? 0.95 : mist ? 0.5 : weather === 'breeze' ? 0.85 : 0.65, wind: weather === 'breeze' ? 1 : rain ? 0.5 : 0.15, rain: rain ? 1 : 0 };
}
