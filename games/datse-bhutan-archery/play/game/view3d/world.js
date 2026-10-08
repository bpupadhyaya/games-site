// The 3D valley: terrain with terraced fields and forest, a river, far ridges and sky, farmhouses, the lane, the two boards and the wind streamers.
// Static geometry is built once (a fixed seed, no clock). Presentation only: nothing here feeds back into the simulation.
const canvasOf = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const hash2 = (ix, iz) => { let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return mix(mix(hash2(ix, iz), hash2(ix + 1, iz), ux), mix(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), ux), uz); }
const fbm = (x, z, o = 4) => { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; };
const ridged = (x, z, o = 4) => { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * (1 - Math.abs(2 * vnoise(x * f, z * f) - 1)); n += a; a *= 0.5; f *= 2.1; } return s / n; };

export const RANGE_MID = 72.5;
export const riverX = (z) => -37 + 6 * Math.sin(z * 0.012) + 2.5 * Math.sin(z * 0.04 + 1.3);
// terrain height at (x, z)
export function groundH(x, z) {
  const ax = Math.abs(x), dz = Math.abs(z - RANGE_MID), flat = 46 + 10 * fbm(z * 0.02, 3.1, 2);
  const prof = (d, k) => (d <= 0 ? 0 : k * (0.9 * d + 0.0009 * d * d));
  let h = prof(ax - flat, x < 0 ? 0.30 : 0.34) * (0.7 + 0.6 * fbm(x * 0.005, z * 0.005, 3));
  h += prof(dz - 1050, 0.2) * (0.7 + 0.6 * fbm(x * 0.004 + 9, z * 0.004, 3));
  h += (ridged(x * 0.003, z * 0.003, 4) - 0.4) * 90 * sm(80, 800, ax + Math.max(0, dz - 700));
  h += (fbm(x * 0.04, z * 0.04, 3) - 0.5) * 4.0 * sm(30, 100, ax);
  const t = h / 3.4, fr = t - Math.floor(t), terr = (Math.floor(t) + sm(0.8, 1.0, fr)) * 3.4;
  h = mix(h, terr, 0.8 * sm(55, 80, ax) * (1 - sm(110, 210, h)) * (dz < 560 ? 1 : 0.4));
  const rx = riverX(z), dr = (x - rx) / 5.5; h -= 1.1 * Math.exp(-dr * dr) * (1 - sm(0, 3, h * 0.2));
  return Math.max(-1.1, h);
}
const axisCoords = (centre, start, grow, max) => { const out = [centre]; let d = start, p = centre; while (p - centre < max) { p += d; out.push(p); d *= grow; } const neg = out.slice(1).map((v) => 2 * centre - v).reverse(); return [...neg, ...out]; };

function terrainColor(x, z, h, slope, rnd) {
  const far = sm(120, 700, Math.hypot(x, z - RANGE_MID));
  const n = mix(fbm(x * 0.09, z * 0.09, 2), 0.5, far), n2 = fbm(x * 0.012 + 20, z * 0.012, 3);
  rnd = mix(rnd, 0.5, far);
  const ax = Math.abs(x);
  let c = [0.36, 0.5, 0.2];
  const meadow = [0.26, 0.45, 0.13], lush = [0.17, 0.36, 0.1], paddy = [0.36, 0.55, 0.15], gold = [0.62, 0.55, 0.2], forest = [0.08, 0.2, 0.09], rock = [0.4, 0.37, 0.33], snow = [0.9, 0.93, 0.97], dry = [0.42, 0.38, 0.2];
  const mx = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  c = mx(meadow, lush, n);
  if (ax > 55 && h < 140) { const band = Math.floor(h / 3.6 + hash2(Math.floor(z / 40), Math.floor(h / 3.6)) * 3); const k = hash2(band, Math.floor(z / 55)); c = mx(mx(paddy, gold, k), lush, 0.35 * n2); }
  const forestK = sm(30, 70, h) * (1 - sm(420, 620, h)) * sm(0.35, 0.6, n2 + 0.08 * (h > 100 ? 1 : 0));
  c = mx(c, forest, Math.min(1, forestK * (0.35 + 0.65 * sm(60, 110, h))));
  c = mx(c, dry, 0.3 * sm(300, 520, h) * n);
  c = mx(c, rock, Math.max(sm(0.85, 1.3, slope), sm(700, 950, h) * 0.7));
  c = mx(c, snow, sm(900, 1150, h + n * 120) * (1 - 0.5 * sm(0.9, 1.3, slope)));
  const g = 0.9 + 0.2 * rnd;
  return [c[0] * g, c[1] * g, c[2] * g];
}

function buildTerrain(THREE, grow = 1.075) {
  const xs = axisCoords(0, 2.2, grow, 1900), zs = axisCoords(RANGE_MID, 2.2, grow, 1900);
  const nx = xs.length, nz = zs.length, pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), hs = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) hs[j * nx + i] = groundH(xs[i], zs[j]);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, h = hs[k];
    const hx = (hs[j * nx + Math.min(nx - 1, i + 1)] - hs[j * nx + Math.max(0, i - 1)]) / (xs[Math.min(nx - 1, i + 1)] - xs[Math.max(0, i - 1)]);
    const hz = (hs[Math.min(nz - 1, j + 1) * nx + i] - hs[Math.max(0, j - 1) * nx + i]) / (zs[Math.min(nz - 1, j + 1)] - zs[Math.max(0, j - 1)]);
    const slope = Math.hypot(hx, hz);
    const c = terrainColor(xs[i], zs[j], h, slope, hash2(i * 7, j * 13));
    pos.set([xs[i], h, zs[j]], k * 3); col.set(c, k * 3);
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  m.receiveShadow = false; m.frustumCulled = false;
  // height of the drawn mesh (bilinear over the same grid), so trees and houses sit on what is actually rendered
  const fi = (arr, v) => { let lo = 0, hi = arr.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arr[mid] <= v) lo = mid; else hi = mid; } return [lo, Math.max(0, Math.min(1, (v - arr[lo]) / (arr[hi] - arr[lo])))]; };
  m.userData.sample = (x, z) => { const [i, fx] = fi(xs, x), [j, fz] = fi(zs, z), i1 = Math.min(nx - 1, i + 1), j1 = Math.min(nz - 1, j + 1); return (hs[j * nx + i] * (1 - fx) + hs[j * nx + i1] * fx) * (1 - fz) + (hs[j1 * nx + i] * (1 - fx) + hs[j1 * nx + i1] * fx) * fz; };
  return m;
}

// ---- merged static geometry helpers ------------------------------------------------------------------------------------------------------------------------
export function mergeInto(THREE, parts) {
  const pos = [], nor = [], col = [], uv = [], idx = []; let base = 0;
  for (const p of parts) {
    const g = p.geo, m = p.matrix, q = new THREE.Matrix3().getNormalMatrix(m), P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      n.fromBufferAttribute(N, i).applyMatrix3(q).normalize(); nor.push(n.x, n.y, n.z);
      const c = p.color; const shade = p.grad ? 1 - p.grad * (1 - Math.max(0, Math.min(1, P.getY(i) / (p.h || 1)))) : 1;
      col.push(c[0] * shade, c[1] * shade, c[2] * shade);
      if (UV) uv.push(UV.getX(i), UV.getY(i)); else uv.push(0, 0);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base); else for (let i = 0; i < P.count; i++) idx.push(i + base);
    base += P.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); out.setIndex(idx);
  return out;
}
const mat4 = (THREE, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz)); return m; };

function buildTrees(THREE, rand, opts = {}, H = groundH) {
  const parts = [];
  const cyl = (rt, rb, h, seg) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, rt === 0); g.translate(0, h / 2, 0); return g; };
  const T = (rt, rb, h, y, color, grad) => parts.push({ geo: cyl(rt, rb, h, rt === 0 ? 6 : 5), matrix: mat4(THREE, 0, y, 0), color, grad, h: y + h });
  T(0.18, 0.26, 1.6, 0, [0.28, 0.2, 0.13]);
  T(0.0, 1.55, 3.0, 1.1, [0.13, 0.3, 0.17], 0.3);
  T(0.0, 1.25, 2.6, 2.7, [0.15, 0.34, 0.19], 0.25);
  T(0.0, 0.9, 2.3, 4.1, [0.17, 0.38, 0.21], 0.2);
  const geo = mergeInto(THREE, parts), trees = [];
  const N = opts.trees ?? 800;
  for (let n = 0, tries = 0; n < N && tries < 30000; tries++) {
    const x = (rand() * 2 - 1) * 900, z = RANGE_MID + (rand() * 2 - 1) * 900, ax = Math.abs(x);
    if (ax < 48 + 6 * rand() && Math.abs(z - RANGE_MID) < 260) continue;
    const h = H(x, z); if (h < 6 || h > 520) continue;
    const dens = fbm(x * 0.012 + 20, z * 0.012, 3) + 0.1 * sm(40, 120, h);
    if (rand() > sm(0.38, 0.62, dens)) continue;
    const slope = Math.hypot(H(x + 6, z) - H(x - 6, z), H(x, z + 6) - H(x, z - 6)) / 12; if (slope > 0.9) continue;
    const s = 0.8 + rand() * 1.1;
    trees.push({ x, y: h - 0.2, z, s, ry: rand() * 6.28 });
    n++;
  }
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }), trees.length);
  const M = new THREE.Matrix4();
  trees.forEach((t, i) => { mesh.setMatrixAt(i, mat4(THREE, t.x, t.y, t.z, t.s, t.s * (0.9 + 0.3 * hash2(i, 5)), t.s, t.ry)); });
  mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; void M;
  return mesh;
}

// A Bhutanese farmhouse: whitewashed ground floor, a timber upper floor with painted window frames, a broad low-pitched roof with deep eaves.
function houseTexture(THREE) {
  const c = canvasOf(512, 256), g = c.getContext('2d');
  g.fillStyle = '#efe7d4'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#d8cdb4'; for (let i = 0; i < 60; i++) g.fillRect(Math.random() * 0, 0, 0, 0);
  g.fillStyle = '#5a3a22'; g.fillRect(0, 128, 512, 128);
  g.fillStyle = '#4a2f1b'; for (let x = 0; x < 512; x += 16) g.fillRect(x, 128, 3, 128);
  const win = (x, y, w, h) => { g.fillStyle = '#2b1a10'; g.fillRect(x, y, w, h); g.fillStyle = '#c9402c'; g.fillRect(x - 5, y - 6, w + 10, 7); g.fillStyle = '#f0c24a'; g.fillRect(x - 5, y + h, w + 10, 5); g.fillStyle = '#2f6f9a'; g.fillRect(x - 5, y, 5, h); g.fillRect(x + w, y, 5, h); g.fillStyle = '#e9d9a8'; g.fillRect(x + w / 2 - 2, y, 4, h); };
  for (let i = 0; i < 3; i++) win(60 + i * 150, 150, 54, 66);
  g.fillStyle = '#3b2616'; g.fillRect(230, 52, 56, 76); g.fillStyle = '#c9402c'; g.fillRect(224, 46, 68, 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildHouses(THREE, rand, H = groundH) {
  const wallGeos = [], roofParts = [];
  const spots = [];
  for (let tries = 0; spots.length < 15 && tries < 4000; tries++) {
    const side = rand() < 0.5 ? -1 : 1, x = side * (62 + rand() * 120), z = RANGE_MID + (rand() * 2 - 1) * 330;
    const h = H(x, z); if (h < 3 || h > 60) continue;
    const s = Math.hypot(H(x + 9, z) - H(x - 9, z), H(x, z + 9) - H(x, z - 9)) / 18; if (s > 0.34) continue;
    if (spots.some((p) => Math.hypot(p.x - x, p.z - z) < 38)) continue;
    spots.push({ x, z, h, ry: Math.atan2(-x, 0) + (rand() - 0.5) * 0.4 + (side < 0 ? Math.PI / 2 : -Math.PI / 2) });
  }
  const wallMat = new THREE.MeshStandardMaterial({ map: houseTexture(THREE), vertexColors: true, roughness: 0.9 });
  const parts = [];
  for (const sp of spots) {
    const w = 11 + rand() * 4, d = 8 + rand() * 2;
    const box = (hh, y0, vlo, vhi, color) => { const g = new THREE.BoxGeometry(w, hh, d), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, vlo + (vhi - vlo) * uv.getY(i)); g.translate(0, y0 + hh / 2, 0); return { geo: g, matrix: mat4(THREE, sp.x, sp.h, sp.z, 1, 1, 1, sp.ry), color }; };
    wallGeos.push(box(5.5, -5.2, 0.55, 0.95, [0.62, 0.58, 0.52]));          // stone foundation, sunk into the slope
    { const pad = new THREE.BoxGeometry(w + 9, 9, d + 9), uv = pad.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 0.6 + 0.3 * uv.getY(i)); pad.translate(0, -4.5 + 0.28, 0); wallGeos.push({ geo: pad, matrix: mat4(THREE, sp.x, sp.h, sp.z, 1, 1, 1, sp.ry), color: [0.36, 0.5, 0.24] }); }   // the levelled yard the house stands on
    wallGeos.push(box(3.3, 0.3, 0.5, 1.0, [1, 1, 1]));                       // whitewashed ground floor (door)
    wallGeos.push(box(3.0, 3.6, 0.0, 0.5, [1, 1, 1]));                       // timber upper floor with painted window frames
    const roof = new THREE.CylinderGeometry(0, 1, 1, 4, 1); roof.rotateY(Math.PI / 4); roof.translate(0, 0.5, 0);
    const rw = (w + 3.4) / Math.SQRT2, rd = (d + 3.4) / Math.SQRT2;
    roofParts.push({ geo: roof, matrix: mat4(THREE, sp.x, sp.h + 6.6, sp.z, rw, 2.9, rd, sp.ry), color: [0.46, 0.4, 0.34] });
  }
  void parts;
  const wallsGeo = mergeInto(THREE, wallGeos), roofGeo = mergeInto(THREE, roofParts);
  // house faces: use a repeating facade texture on every side; the box uv already spans 0..1 per face (top half white, bottom half timber looks like two floors)
  const walls = new THREE.Mesh(wallsGeo, wallMat); walls.frustumCulled = false;
  const roofs = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); roofs.frustumCulled = false;
  return { group: [walls, roofs], spots };
}

// ---- sky -----------------------------------------------------------------------------------------------------------------------------------------------------------
function buildSky(THREE, palette) {
  const g = new THREE.SphereGeometry(4300, 24, 14), p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 4300, t = Math.max(0, y);
    const c = [mix(palette.hz[0], palette.top[0], Math.pow(t, 0.55)), mix(palette.hz[1], palette.top[1], Math.pow(t, 0.55)), mix(palette.hz[2], palette.top[2], Math.pow(t, 0.55))];
    if (y < 0) { c[0] = palette.hz[0]; c[1] = palette.hz[1]; c[2] = palette.hz[2]; }
    col.push(c[0], c[1], c[2]);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10; m.frustumCulled = false;
  return m;
}
function cloudTexture(THREE) {
  const c = canvasOf(256, 128), g = c.getContext('2d'); g.clearRect(0, 0, 256, 128);
  const r = lcg(5);
  for (let i = 0; i < 26; i++) { const x = 40 + r() * 176, y = 50 + (r() - 0.5) * 34, rad = 20 + r() * 34, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildBackdrop(THREE) {
  // three rings of far ridges (jagged, snow-capped) so the horizon has depth: aerial perspective comes from the scene fog
  const group = new THREE.Group();
  const layers = [{ R: 2700, hMin: 380, hMax: 980, seed: 1, snow: 650 }, { R: 3400, hMin: 520, hMax: 1500, seed: 2, snow: 760 }, { R: 4050, hMin: 600, hMax: 2100, seed: 3, snow: 800 }];
  for (const L of layers) {
    const N = 220, pos = [], col = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, nn = ridged(Math.cos(a) * 2.2 + L.seed * 9, Math.sin(a) * 2.2 + L.seed * 3, 4);
      const hh = mix(L.hMin, L.hMax, Math.pow(nn, 1.35)), x = Math.cos(a) * L.R, z = RANGE_MID + Math.sin(a) * L.R;
      pos.push(x, -80, z, x, hh, z);
      const k = 0;
      void k;
      const top = hh > L.snow ? 0.55 + 0.45 * sm(L.snow, L.snow + 300, hh) : 0;
      col.push(0.32, 0.38, 0.42, mix(0.36, 0.95, top), mix(0.44, 0.97, top), mix(0.4, 1, top));
      if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); m.frustumCulled = false; group.add(m);
  }
  return group;
}

// ---- the lane and the boards -------------------------------------------------------------------------------------------------------------------------------
function laneTexture(THREE) {
  const c = canvasOf(256, 1536), g = c.getContext('2d'), r = lcg(21);
  const Lz = 190;                                                                          // metres covered, z = -22 .. 168
  for (let i = 0; i < 38; i++) { g.fillStyle = i % 2 ? '#7fae4a' : '#76a443'; g.fillRect(0, (i / 38) * 1536, 256, 1536 / 38 + 1); }
  for (let i = 0; i < 9000; i++) { const a = r(); g.fillStyle = a < 0.5 ? 'rgba(20,50,10,0.10)' : 'rgba(210,240,150,0.12)'; g.fillRect(r() * 256, r() * 1536, 1 + r() * 2, 2 + r() * 6); }
  for (let i = 0; i < 260; i++) { g.fillStyle = ['#f7f3d9', '#f2d35b', '#e8e6f4'][Math.floor(r() * 3)]; g.globalAlpha = 0.7; g.fillRect(r() * 256, r() * 1536, 2, 2); }
  g.globalAlpha = 1;
  const zY = (z) => ((z + 22) / Lz) * 1536;
  g.strokeStyle = 'rgba(245,242,230,0.55)'; g.lineWidth = 3;
  for (const z of [0, 145]) { g.beginPath(); g.moveTo(40, zY(z)); g.lineTo(216, zY(z)); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function boardTexture(THREE) {
  const c = canvasOf(256, 512), g = c.getContext('2d');           // 28 x 91 cm board: 256 px = 0.28 m
  g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = '#8a1e14'; g.lineWidth = 16; g.strokeRect(8, 8, 240, 496);
  g.strokeStyle = '#1f3d6e'; g.lineWidth = 6; g.strokeRect(24, 24, 208, 464);
  // top ornament band
  g.fillStyle = '#f0b830'; g.fillRect(34, 34, 188, 34); g.fillStyle = '#8a1e14'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(40 + i * 31, 66); g.lineTo(55 + i * 31, 38); g.lineTo(70 + i * 31, 66); g.fill(); }
  // karay: the painted bullseye, 62 cm above the ground (y from the top: 0.91 - 0.62 = 0.29 m -> 325 px)
  const cy = 512 * (1 - 0.62 / 0.91), px = 256 / 0.28;
  const ring = (rad, col) => { g.fillStyle = col; g.beginPath(); g.arc(128, cy, rad * px, 0, 7); g.fill(); };
  ring(0.115, '#1f3d6e'); ring(0.095, '#f4efe0'); ring(0.07, '#c42a1d'); ring(0.035, '#f0b830');
  g.fillStyle = '#1f3d6e'; for (let i = 0; i < 4; i++) g.fillRect(40 + i * 46, 440, 28, 28);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export function buildBoard(THREE) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.91, 0.04), [0, 1, 2, 3, 4, 5].map((i) => (i === 4 ? new THREE.MeshStandardMaterial({ map: boardTexture(THREE), roughness: 0.8 }) : new THREE.MeshStandardMaterial({ color: 0x7c5a36, roughness: 0.9 }))));
  face.position.set(0, 0.455, 0); face.castShadow = true;
  g.add(face);
  // the two stays and the heap of earth that holds the board up: one merged mesh
  const mk = (geo, x, y, z, rx, sx, sy, sz, c) => { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(sx, sy, sz)); const k = new THREE.Color(c); return { geo, matrix: m, color: [k.r, k.g, k.b] }; };
  const parts = [mk(new THREE.CylinderGeometry(0.018, 0.022, 0.55, 5), -0.08, 0.2, -0.17, 0.55, 1, 1, 1, 0x5b4126), mk(new THREE.CylinderGeometry(0.018, 0.022, 0.55, 5), 0.08, 0.2, -0.17, 0.55, 1, 1, 1, 0x5b4126), mk(new THREE.SphereGeometry(0.28, 8, 5), 0, 0.02, -0.12, 0, 1.3, 0.28, 1.1, 0x6a5233)];
  g.add(new THREE.Mesh(mergeInto(THREE, parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
  return g;
}
export function buildLane(THREE) {
  const t = laneTexture(THREE);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(28, 190), new THREE.MeshStandardMaterial({ map: t, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0.015, 73); m.receiveShadow = true;
  return m;
}

// wind streamers on poles: a ribbon that lifts and flutters with the wind
export function buildStreamer(THREE, color) {
  const SEG = 9, LEN = 3.0, WID = 0.42;
  const g = new THREE.BufferGeometry(), pos = new Float32Array((SEG + 1) * 2 * 3), idx = [];
  for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
  const col = []; for (let i = 0; i <= SEG; i++) for (let k = 0; k < 2; k++) { const st = i % 2 === 0 ? 1 : 0.82; col.push(color[0] * st, color[1] * st, color[2] * st); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); mesh.frustumCulled = false;
  mesh.userData.update = (wx, wz, speed, time, phase) => {
    const p = g.attributes.position.array, d = Math.hypot(wx, wz) || 1, dx = wx / d, dz = wz / d, px = -dz, pz = dx;
    const lift = Math.min(1.45, 0.05 + speed * 0.3);                    // radians above hanging straight down
    for (let i = 0; i <= SEG; i++) {
      const s = (i / SEG) * LEN, ang = Math.PI / 2 - lift * (1 - 0.08 * i / SEG);
      const flut = Math.sin(time * (4 + speed * 1.4) - i * 0.9 + phase) * (0.02 + 0.05 * Math.min(1, speed / 4)) * s;
      const hx = dx * Math.sin(ang) * s + px * flut, hy = -Math.cos(ang) * s * 1 + Math.sin(time * 5 + i + phase) * 0.01 * speed, hz = dz * Math.sin(ang) * s + pz * flut;
      p[(i * 2) * 3] = hx; p[(i * 2) * 3 + 1] = hy + WID / 2; p[(i * 2) * 3 + 2] = hz;
      p[(i * 2 + 1) * 3] = hx; p[(i * 2 + 1) * 3 + 1] = hy - WID / 2 * (1 - 0.5 * i / SEG); p[(i * 2 + 1) * 3 + 2] = hz;
    }
    g.attributes.position.needsUpdate = true;
  };
  return mesh;
}

function buildTufts(THREE, rand, N = 600) {
  const blade = (h, lean, wd) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-wd, 0, 0, wd, 0, 0, lean, h, 0], 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); return g; };
  const parts = [];
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI, hh = 0.11 + 0.07 * ((i * 37) % 5) / 5; parts.push({ geo: blade(hh, 0.05 * Math.sin(i * 2.1), 0.012), matrix: mat4(THREE, 0.03 * Math.cos(i * 2.3), 0, 0.03 * Math.sin(i * 1.7), 1, 1, 1, a), color: [0.2 + 0.05 * (i % 3), 0.42 + 0.04 * (i % 2), 0.13], grad: 0.5, h: hh }); }
  const geo = mergeInto(THREE, parts);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), N);
  let n = 0;
  for (const z0 of [0, 145]) for (let i = 0; i < N / 2; i++) { let x = (rand() * 2 - 1) * 15; if (Math.abs(x) < 4.5) x += x < 0 ? -5 : 5; const z = z0 + (rand() * 2 - 1) * 14; mesh.setMatrixAt(n++, mat4(THREE, x, 0.01, z, 0.9 + rand() * 0.8, 0.8 + rand() * 0.8, 0.9 + rand() * 0.8, rand() * 6.28)); }
  mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false;
  // wild flowers: tiny coloured blobs
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 4, 3), new THREE.MeshStandardMaterial({ roughness: 0.8 }), Math.round(N * 0.4));
  const cols = ['#f7f3d9', '#f2d35b', '#e8e6f4', '#e0922b', '#c75fa0'], c = new THREE.Color();
  for (let i = 0; i < fl.count; i++) { const z0 = i % 2 ? 145 : 0, x0 = (rand() * 2 - 1) * 16, x = Math.abs(x0) < 4.5 ? x0 + (x0 < 0 ? -5 : 5) : x0, z = z0 + (rand() * 2 - 1) * 16; fl.setMatrixAt(i, mat4(THREE, x, 0.3 + rand() * 0.12, z)); fl.setColorAt(i, c.set(cols[i % cols.length])); }
  fl.instanceMatrix.needsUpdate = true; fl.frustumCulled = false;
  return [mesh, fl];
}
export function buildWorld(THREE, opts = {}) {
  const rand = lcg(77), root = new THREE.Group(); root.name = 'world';
  const palette = { top: [0.22, 0.42, 0.78], hz: [0.74, 0.84, 0.92] };
  root.add(buildSky(THREE, palette));
  root.add(buildBackdrop(THREE));
  const terrain = buildTerrain(THREE, opts.grow ?? 1.075); root.add(terrain); const H = terrain.userData.sample;
  const heavy = [];
  if (!opts.lite) { const tr = buildTrees(THREE, rand, { trees: opts.trees }, H); root.add(tr); heavy.push(tr); }
  const houses = buildHouses(THREE, rand, H); for (const m of houses.group) root.add(m);
  root.add(buildLane(THREE));
  if (!opts.lite && (opts.tufts ?? 600) > 0) for (const m of buildTufts(THREE, rand, opts.tufts ?? 600)) { root.add(m); heavy.push(m); }
  // river: a flat ribbon following the channel
  { const SEGZ = 120, pos = [], idx = []; for (let i = 0; i <= SEGZ; i++) { const z = -600 + (i / SEGZ) * 1500, rx = riverX(z), w = 3.2 + 1.2 * Math.sin(z * 0.02); pos.push(rx - w, -0.12, z, rx + w, -0.12, z); if (i < SEGZ) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const w = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x5f8fa6, roughness: 0.25, metalness: 0.15 })); w.frustumCulled = false; root.add(w); }
  const boards = [buildBoard(THREE), buildBoard(THREE)];
  boards[0].position.set(0, 0, 145); boards[1].position.set(0, 0, 0);      // [0] is the board at z = 145 (its painted face looks to -z), [1] the one at z = 0 (looks to +z)
  boards[0].rotation.y = Math.PI; boards[1].rotation.y = 0;
  for (const b of boards) root.add(b);
  const clouds = [];
  const ct = cloudTexture(THREE);
  for (let i = 0; i < (opts.clouds ?? 7); i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(900 + rand() * 600, 380), new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: 0.8 })); m.position.set((rand() * 2 - 1) * 2400, 700 + rand() * 500, RANGE_MID + (rand() * 2 - 1) * 2400); m.rotation.x = Math.PI / 2 * 0.0 - 1.5; m.rotation.x = -Math.PI / 2 + 0.25; m.userData.speed = 2 + rand() * 3; clouds.push(m); root.add(m); }
  return { root, boards, clouds, houses, terrain, heavy };
}
