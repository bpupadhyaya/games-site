// The 3D world of Pearl Diving: sky, the animated sea, the dhow, the Muharraq waterfront and the sea floor. Built once with fixed seeds (no clock); presentation only.
const canvasOf = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const lcg = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
export const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;
const hash2 = (ix, iz) => { let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function vnoise(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return mix(mix(hash2(ix, iz), hash2(ix + 1, iz), ux), mix(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), ux), uz); }
export const fbm = (x, z, o = 4) => { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; };

// ---- merged static geometry --------------------------------------------------------------------------------------------------------------------------------------------------------
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
export const mat4 = (THREE, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz)); return m; };
export const hex = (THREE, c) => { const k = new THREE.Color(c); return [k.r, k.g, k.b]; };
const soft = (THREE, inner, outer, size = 64) => { const c = canvasOf(size, size), g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
export { soft };

// ---- moods: the light of the day ----------------------------------------------------------------------------------------------------------------------------------------------------
export const MOODS = {
  dawn: { top: '#3f84b4', mid: '#9ccfd2', hor: '#ffd3a0', fog: '#f1cfa8', sunAz: 1.1, sunEl: 0.16, sun: '#ffd9a8', hemiSky: '#cfe0ee', hemiGround: '#3f7a80', hemi: 0.95, key: '#ffd2a0', keyI: 2.6, exposure: 0.95, stars: 0, seaDeep: '#0c7d8a', seaShallow: '#2fc2b8' },
  day: { top: '#2780c4', mid: '#78c3e2', hor: '#e2f0e8', fog: '#cfe8ec', sunAz: 0.5, sunEl: 0.85, sun: '#fff6e0', hemiSky: '#d6ecff', hemiGround: '#3a7e86', hemi: 0.95, key: '#fff3d8', keyI: 3.0, exposure: 0.92, stars: 0, seaDeep: '#08788a', seaShallow: '#38cdbf' },
  dusk: { top: '#1b3260', mid: '#a05a7e', hor: '#ffab62', fog: '#d89a74', sunAz: -1.9, sunEl: 0.07, sun: '#ff9d5c', hemiSky: '#e0b4a0', hemiGround: '#2c4a5a', hemi: 0.7, key: '#ff9a58', keyI: 2.3, exposure: 0.95, stars: 0.35, seaDeep: '#0a4f63', seaShallow: '#2a8f98' },
  night: { top: '#050f26', mid: '#0e2548', hor: '#2c4a74', fog: '#17294a', sunAz: -1.9, sunEl: -0.2, sun: '#a8c4ff', hemiSky: '#5d73a8', hemiGround: '#14232f', hemi: 0.6, key: '#a9c2ff', keyI: 1.3, exposure: 1.0, stars: 1, seaDeep: '#06263a', seaShallow: '#12526a' },
  gold: { top: '#3a76b0', mid: '#ecc690', hor: '#ffd89c', fog: '#f0d2a4', sunAz: -1.5, sunEl: 0.22, sun: '#ffd08a', hemiSky: '#f2dcc0', hemiGround: '#46787a', hemi: 0.9, key: '#ffc880', keyI: 2.8, exposure: 0.95, stars: 0, seaDeep: '#0b7886', seaShallow: '#34bfb4' },
  under: { top: '#0b8a92', mid: '#0b7a84', hor: '#0a7580', fog: '#0a7a85', sunAz: 0.2, sunEl: 1.2, sun: '#d8fff0', hemiSky: '#8fe6e0', hemiGround: '#3aa0a0', hemi: 1.15, key: '#e8fff0', keyI: 2.2, exposure: 0.98, stars: 0, seaDeep: '#08788a', seaShallow: '#38cdbf' },
};

// ---- sky ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function buildSky(THREE, tier) {
  const g = new THREE.SphereGeometry(2600, 32, 20), P = g.attributes.position, colors = new Float32Array(P.count * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(g, mat); dome.renderOrder = -10; dome.frustumCulled = false;
  const root = new THREE.Group(); root.add(dome);
  const tmp = { top: new THREE.Color(), mid: new THREE.Color(), hor: new THREE.Color(), c: new THREE.Color() };
  const paint = (m) => {
    tmp.top.set(m.top); tmp.mid.set(m.mid); tmp.hor.set(m.hor);
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i) / 2600, h = Math.max(0, y);
      if (y < 0) tmp.c.copy(tmp.hor).multiplyScalar(0.9); else if (h < 0.22) tmp.c.copy(tmp.hor).lerp(tmp.mid, sm(0, 0.22, h)); else tmp.c.copy(tmp.mid).lerp(tmp.top, sm(0.22, 0.85, h));
      colors[i * 3] = tmp.c.r; colors[i * 3 + 1] = tmp.c.g; colors[i * 3 + 2] = tmp.c.b;
    }
    g.attributes.color.needsUpdate = true;
  };
  // the sun: a glow and a disc, always on the far side of the camera's view of the sky dome
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(THREE, 'rgba(255,240,205,1)', 'rgba(255,200,120,0)', 128), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.scale.set(900, 900, 1); glow.renderOrder = -9; root.add(glow);
  const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(THREE, 'rgba(255,255,245,1)', 'rgba(255,248,225,0)', 64), transparent: true, depthWrite: false, fog: false }));
  disc.scale.set(150, 150, 1); disc.renderOrder = -8; root.add(disc);
  // stars: small instanced quads on the dome, visible at dusk and night
  const NS = tier === 'low' ? 80 : 220, rand = lcg(77);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), starMat, NS);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < NS; i++) {
    const a = rand() * Math.PI * 2, e = 0.12 + rand() * 1.4, r = 2400;
    V.set(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    Q.setFromUnitVectors(up, V.clone().multiplyScalar(-1).normalize()); const s = 5 + rand() * 9; S.set(s, s, 1); M.compose(V, Q, S); stars.setMatrixAt(i, M);
  }
  stars.frustumCulled = false; stars.renderOrder = -9; root.add(stars);
  // clouds: soft white blobs drifting slowly
  const cloudTex = soft(THREE, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)', 128), clouds = [];
  const NC = tier === 'low' ? 3 : tier === 'medium' ? 5 : 8;
  for (let i = 0; i < NC; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.6, fog: false }));
    s.userData = { a: rand() * 6.28, r: 900 + rand() * 900, y: 260 + rand() * 260, sp: 0.00004 + rand() * 0.00005, w: 500 + rand() * 600 };
    s.scale.set(s.userData.w, s.userData.w * 0.28, 1); s.renderOrder = -7; root.add(s); clouds.push(s);
  }
  const sunDir = new THREE.Vector3();
  function update(m, t, camPos, k = 1) {
    // m: the blended mood; place the sun and the clouds around the camera
    sunDir.set(Math.cos(m.sunAz) * Math.cos(Math.max(-0.2, m.sunEl)), Math.sin(m.sunEl), Math.sin(m.sunAz) * Math.cos(Math.max(-0.2, m.sunEl))).normalize();
    glow.position.copy(sunDir).multiplyScalar(2400); disc.position.copy(sunDir).multiplyScalar(2380);
    glow.material.color.set(m.sun); disc.material.color.set(m.sun); glow.material.opacity = m.sunEl > -0.05 ? 0.9 : 0; disc.material.opacity = m.sunEl > -0.05 ? 1 : 0;
    starMat.opacity = m.stars;
    for (const c of clouds) { const u = c.userData; u.a += u.sp * 16; c.position.set(Math.cos(u.a) * u.r, u.y, Math.sin(u.a) * u.r); c.material.color.set(m.hor).lerp(new THREE.Color('#ffffff'), 0.55); c.material.opacity = 0.5 * (1 - 0.8 * m.stars); }
    root.position.copy(camPos); void t; void k;
  }
  return { root, paint, update, sunDir };
}

// ---- the sea ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const WAVES = [
  { dx: 0.91, dz: 0.41, L: 19, a: 1.0 }, { dx: -0.4, dz: 0.92, L: 9.5, a: 0.5 }, { dx: 0.7, dz: -0.71, L: 4.6, a: 0.24 }, { dx: 0.2, dz: 0.98, L: 2.3, a: 0.11 },
].map((w) => { const k = (Math.PI * 2) / w.L; return { ...w, k, om: Math.sqrt(9.8 * k) }; });
const axisCoords = (start, grow, max) => { const out = [0]; let d = start, p = 0; while (p < max) { p += d; out.push(p); d *= grow; } const neg = out.slice(1).map((v) => -v).reverse(); return [...neg, ...out]; };
export function waveH(x, z, t, amp) {
  let h = 0;
  for (const w of WAVES) h += w.a * amp * Math.sin(w.k * (w.dx * x + w.dz * z) - w.om * t);
  return h;
}
export function buildSea(THREE, tier) {
  // The surface is displaced, lit and coloured on the GPU (the CPU only uploads a handful of uniforms per frame), so the grid is built once and never touched again.
  const grow = tier === 'low' ? 1.2 : tier === 'medium' ? 1.12 : 1.09, start = tier === 'low' ? 2 : tier === 'medium' ? 1.1 : 0.9;
  const xs = axisCoords(start, grow, 2600), zs = xs, nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = (j * nx + i) * 3; pos[k] = xs[i]; pos[k + 2] = zs[j]; }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.22, metalness: 0.0, transparent: true, opacity: 0.93 });
  const U = { uT: { value: 0 }, uAmp: { value: 0 }, uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uFoam: { value: new THREE.Color('#e9fbf5') }, uHull: { value: new THREE.Vector4(0, 0, 1, 1) }, uHullYaw: { value: new THREE.Vector4(1, 0, 0, 0) }, uHullOn: { value: 0 } };
  const wv = WAVES.map((w, q) => `  { float ph = ${w.k.toFixed(5)} * (${w.dx.toFixed(4)} * p.x + ${w.dz.toFixed(4)} * p.z) - ${w.om.toFixed(5)} * uT; float s = sin(ph), co = cos(ph); h += ${w.a.toFixed(3)} * A * s; hx += ${(w.a * w.k * w.dx).toFixed(5)} * A * co; hz += ${(w.a * w.k * w.dz).toFixed(5)} * A * co; }`).join('\n');
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    const uni = `uniform float uT, uAmp, uHullOn; uniform vec3 uDeep, uShallow, uHor, uFoam; uniform vec4 uHull; uniform vec4 uHullYaw;`;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
${uni} varying vec4 vW;`)
      .replace('#include <beginnormal_vertex>', `vec3 p = position; float d0 = length(p.xz), A = uAmp / (1.0 + d0 / 220.0); float h = 0.0, hx = 0.0, hz = 0.0;
${wv}
float inv = 1.0 / sqrt(hx * hx + 1.0 + hz * hz); vec3 objectNormal = vec3(-hx * inv, inv, -hz * inv); vW = vec4(p.x, h, p.z, 0.0); vW.w = sqrt(hx * hx + hz * hz);
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(p.x, h, p.z);');
    // colour, foam and glints are computed per pixel (from the interpolated height and slope), so the surface stays smooth on the coarse far grid
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${uni} varying vec4 vW;`)
      .replace('#include <color_fragment>', `{ vec3 W = vec3(vW.x, vW.y, vW.z); float hx = vW.w, h = W.y;
  float rip = sin(W.x * 1.9 + uT * 2.3) * sin(W.z * 2.3 - uT * 1.7) * 0.5 + sin(W.x * 4.1 - W.z * 3.3 + uT * 3.1) * 0.25;
  vec3 vv = cameraPosition - W; float vl = 1.0 / length(vv);
  float fres = pow(1.0 - clamp(vv.y * vl, 0.0, 1.0), 3.2);
  float lift = clamp(0.5 + h / (uAmp * 2.4 + 0.2), 0.0, 1.0);
  vec3 c = mix(uDeep, uShallow, 0.3 + 0.5 * lift + 0.05 * rip); c = mix(c, uHor, min(0.6, fres * 0.7));
  float foam = max(0.0, (abs(hx) * 1.0 - 0.28 * (0.5 + uAmp)) * 1.6) * min(1.0, uAmp * 2.5);
  if (uHullOn > 0.5) { vec2 r = W.xz - uHull.xy; float lx = r.x * uHullYaw.x - r.y * uHullYaw.y, lz = r.x * uHullYaw.y + r.y * uHullYaw.x; float e = length(vec2(lx / (uHull.z + 0.9), lz / (uHull.w + 0.6))); if (e < 1.25) foam = max(foam, (1.25 - e) * 1.8 * (0.5 + 0.5 * sin(uT * 2.0 + W.x * 3.0 + W.z * 2.0))); }
  c = mix(c, uFoam, min(0.85, foam) * step(0.02, foam)); diffuseColor.rgb *= c; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { float nd = 1.0 / (1.0 + length(vW.xz - cameraPosition.xz) * 0.02); normal = normalize(normal + nd * uAmp * 0.12 * vec3(cos(vW.x * 1.9 + uT * 2.3) * 0.9 + cos(vW.x * 4.1 - vW.z * 3.3 + uT * 3.1) * 0.5, 0.0, cos(vW.z * 2.3 - uT * 1.7) * 0.9 - cos(vW.x * 4.1 - vW.z * 3.3 + uT * 3.1) * 0.4)); }`);
  };
  mat.customProgramCacheKey = () => 'pearl-sea';
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 1;
  const hull = { x: 0, z: 0, hw: 0, hl: 0, on: false, yaw: 0 };
  function update(t, amp, mood) {
    U.uT.value = t; U.uAmp.value = amp; U.uDeep.value.set(mood.seaDeep); U.uShallow.value.set(mood.seaShallow); U.uHor.value.set(mood.hor);
    U.uHull.value.set(hull.x, hull.z, hull.hw, hull.hl); U.uHullYaw.value.set(Math.cos(hull.yaw), Math.sin(hull.yaw), 0, 0); U.uHullOn.value = hull.on ? 1 : 0;
  }
  // the sea seen from below: a bright, rippling lid
  const lidTex = (() => { const cn = canvasOf(256, 256), cx2 = cn.getContext('2d'); cx2.fillStyle = '#7ff0dc'; cx2.fillRect(0, 0, 256, 256); const r = lcg(5); for (let i = 0; i < 90; i++) { const x = r() * 256, y = r() * 256, rr = 8 + r() * 28; const gg = cx2.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, 'rgba(255,255,255,0.55)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); cx2.fillStyle = gg; cx2.fillRect(x - rr, y - rr, rr * 2, rr * 2); } const tx = new THREE.CanvasTexture(cn); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(30, 30); tx.colorSpace = THREE.SRGBColorSpace; return tx; })();
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshBasicMaterial({ map: lidTex, color: 0xcff7ee, transparent: true, opacity: 0.85, fog: true, side: THREE.FrontSide }));
  lid.rotation.x = Math.PI / 2; lid.position.y = 0.02; lid.visible = false;
  return { mesh, lid, update, hull, xs, nx };
}

// ---- the dhow ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const L_BOAT = 15, HALF = L_BOAT / 2;
const halfBeam = (u) => { const m = 0.4; if (u < m) return 1.55 + (2.1 - 1.55) * Math.sin((u / m) * Math.PI / 2); const v = (u - m) / (1 - m); return 0.06 + (2.1 - 0.06) * (1 - Math.pow(v, 1.9)); };
const sheerY = (u) => 1.28 + 1.55 * Math.pow(sm(0.68, 1, u), 1.5) + 0.75 * Math.pow(1 - sm(0, 0.2, u), 1.6);
const keelY = (u) => -1.35 * (1 - 0.9 * sm(0.45, 1, u)) + 0.55 * (1 - sm(0, 0.16, u));
export const DECK_Y = 0.95;
export const boatZ = (u) => -HALF + L_BOAT * u;
function hullGeometry(THREE) {
  const NU = 40, NT = 14, pos = [], nor = [], col = [], uv = [], idx = [];
  const planks = new THREE.Color('#a9743f'), tar = new THREE.Color('#7a3a24'), paint = new THREE.Color('#e3c88a'), tmp = new THREE.Color();
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, z = boatZ(u), b = halfBeam(u), sh = sheerY(u), kl = keelY(u);
    for (let j = 0; j <= 2 * NT; j++) {
      const th = ((j - NT) / NT) * (Math.PI / 2), s = Math.sin(th), co = Math.cos(th);
      const x = b * s * (1 + 0.07 * Math.abs(s)), y = kl + (sh - kl) * (1 - co);
      pos.push(x, y, z);
      const wl = y; tmp.copy(planks); if (wl < 0.05) tmp.copy(tar).lerp(planks, sm(-0.45, 0.05, wl)); if (y > sh - 0.34) tmp.lerp(paint, sm(sh - 0.34, sh - 0.22, y));
      const n = 0.92 + 0.12 * hash2(i, j); col.push(tmp.r * n, tmp.g * n, tmp.b * n);
      uv.push(z / 1.5, (y - kl) / 1.3);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < 2 * NT; j++) { const a = i * (2 * NT + 1) + j, b2 = a + 1, c = a + 2 * NT + 1, d = c + 1; idx.push(a, b2, c, b2, d, c); }
  // the transom plate
  const base = pos.length / 3, i0 = 0; let cxs = 0, cys = 0; for (let j = 0; j <= 2 * NT; j++) { cxs += pos[(i0 + j) * 3]; cys += pos[(i0 + j) * 3 + 1]; }
  pos.push(cxs / (2 * NT + 1), cys / (2 * NT + 1), boatZ(0)); col.push(0.55, 0.36, 0.2); uv.push(0, 0);
  for (let j = 0; j <= 2 * NT; j++) { pos.push(pos[(i0 + j) * 3], pos[(i0 + j) * 3 + 1], pos[(i0 + j) * 3 + 2]); col.push(0.62, 0.42, 0.24); uv.push(0, 0); }
  for (let j = 0; j < 2 * NT; j++) idx.push(base, base + 1 + j + 1, base + 1 + j);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  void nor; return g;
}
function plankTexture(THREE, base, gap, n = 12, repeat = [1, 1]) {
  const c = canvasOf(256, 256), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  const r = lcg(31);
  for (let i = 0; i < n; i++) { const y = (i * 256) / n; g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.1})`; g.fillRect(0, y, 256, 256 / n); g.fillStyle = gap; g.fillRect(0, y, 256, 3); for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(60,30,10,${r() * 0.18})`; g.fillRect(r() * 256, y + r() * (256 / n), 20 + r() * 80, 1); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function clothTexture(THREE) {
  const c = canvasOf(256, 256), g = c.getContext('2d'); g.fillStyle = '#f2e8cd'; g.fillRect(0, 0, 256, 256);
  const r = lcg(9);
  for (let i = 0; i < 256; i += 3) { g.fillStyle = `rgba(120,90,50,${0.03 + r() * 0.05})`; g.fillRect(0, i, 256, 1); }
  g.strokeStyle = 'rgba(120,90,50,0.35)'; g.lineWidth = 2; for (let x = 64; x < 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 6, 256); g.stroke(); }
  g.fillStyle = 'rgba(150,100,60,0.18)'; g.fillRect(150, 90, 70, 60); g.fillStyle = 'rgba(180,140,90,0.2)'; g.fillRect(30, 170, 60, 50);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const cyl = (THREE, rt, rb, h, seg = 8, open = false) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); g.translate(0, h / 2, 0); return g; };
function tubeBetween(THREE, a, b, r) { const d = new THREE.Vector3().subVectors(b, a), len = d.length(), g = cyl(THREE, r, r, len, 5), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), m = new THREE.Matrix4().compose(a, q, new THREE.Vector3(1, 1, 1)); return { geo: g, matrix: m }; }
export function buildDhow(THREE, tier) {
  const root = new THREE.Group(), rand = lcg(2468);
  const hull = new THREE.Mesh(hullGeometry(THREE), new THREE.MeshStandardMaterial({ vertexColors: true, map: plankTexture(THREE, '#ffffff', '#4a2a14', 10, [1, 1]), roughness: 0.78, metalness: 0, side: THREE.DoubleSide }));
  hull.castShadow = true; hull.receiveShadow = true; root.add(hull);
  // the deck: a flat ribbon of planks
  { const pos = [], uv = [], idx = [], N = 30; for (let i = 0; i <= N; i++) { const u = 0.06 + 0.84 * (i / N), b = halfBeam(u) * 1.0; pos.push(-b, DECK_Y, boatZ(u), b, DECK_Y, boatZ(u)); uv.push(0, boatZ(u) / 3, 1, boatZ(u) / 3); }
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const tex = plankTexture(THREE, '#c79a60', '#3a2210', 10, [1.5, 1]); const deck = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide })); deck.receiveShadow = true; root.add(deck); }
  // everything solid and small, merged: rails, the poop deck, stem and stern posts, the hearth, jars, chests, coils, stones, baskets, the rudder and the tiller
  const parts = [], WOOD = hex(THREE, '#5a381c'), DARK = hex(THREE, '#3a2412'), OCHRE = hex(THREE, '#d3a45a'), CLAY = hex(THREE, '#b4623a'), ROPE = hex(THREE, '#d9c590'), STONE = hex(THREE, '#8a8d8a');
  for (const side of [-1, 1]) { const pts = []; for (let i = 0; i <= 28; i++) { const u = 0.02 + 0.96 * (i / 28); pts.push(new THREE.Vector3(side * halfBeam(u) * 1.0, sheerY(u) + 0.04, boatZ(u))); }
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.055, 6, false); parts.push({ geo: tg, matrix: new THREE.Matrix4(), color: WOOD }); }
  parts.push({ geo: new THREE.BoxGeometry(3.4, 0.14, 3.0), matrix: mat4(THREE, 0, 1.78, boatZ(0.12)), color: hex(THREE, '#b88850') });
  for (const sx of [-1.55, 1.55]) for (const zz of [boatZ(0.02) + 0.2, boatZ(0.22)]) parts.push({ geo: cyl(THREE, 0.07, 0.07, 0.85, 6), matrix: mat4(THREE, sx, 0.95, zz), color: WOOD });
  parts.push({ geo: new THREE.BoxGeometry(3.4, 0.5, 0.1), matrix: mat4(THREE, 0, 2.02, boatZ(0.015)), color: hex(THREE, '#c9974e') });
  parts.push({ geo: cyl(THREE, 0.1, 0.16, 3.4, 7), matrix: mat4(THREE, 0, sheerY(1) - 1.2, boatZ(1) - 0.15, 1, 1, 1, 0, Math.PI * 0.38), color: DARK });
  parts.push({ geo: new THREE.BoxGeometry(0.14, 1.9, 0.9), matrix: mat4(THREE, 0, -0.9, boatZ(0) - 0.55), color: WOOD });
  parts.push({ geo: cyl(THREE, 0.05, 0.07, 2.6, 6), matrix: mat4(THREE, 0, 1.0, boatZ(0.1), 1, 1, 1, 0, -Math.PI * 0.42), color: DARK });
  // hearth with a clay pot, near the stern on the deck
  parts.push({ geo: new THREE.BoxGeometry(0.9, 0.38, 0.9), matrix: mat4(THREE, -1.1, DECK_Y + 0.19, boatZ(0.24)), color: hex(THREE, '#3c3a38') }, { geo: new THREE.SphereGeometry(0.3, 10, 8), matrix: mat4(THREE, -1.1, DECK_Y + 0.62, boatZ(0.24), 1, 0.85, 1), color: CLAY });
  // water jars and chests
  [[1.45, boatZ(0.3)], [1.5, boatZ(0.34)], [-1.55, boatZ(0.58)]].forEach(([x, z], i) => parts.push({ geo: new THREE.SphereGeometry(0.28, 10, 8), matrix: mat4(THREE, x, DECK_Y + 0.28, z, 1, 1.15, 1), color: i % 2 ? CLAY : hex(THREE, '#9c5a34') }));
  [[-1.3, boatZ(0.5), 0.9], [-0.5, boatZ(0.62), 0.7], [1.2, boatZ(0.74), 0.8]].forEach(([x, z, s]) => parts.push({ geo: new THREE.BoxGeometry(0.8 * s, 0.5, 0.5 * s), matrix: mat4(THREE, x, DECK_Y + 0.25, z, 1, 1, 1, 0.3), color: hex(THREE, '#7a4a28') }));
  // coils of rope and the diving stones
  [[1.3, boatZ(0.47)], [-1.2, boatZ(0.86)]].forEach(([x, z]) => parts.push({ geo: new THREE.TorusGeometry(0.3, 0.07, 6, 14), matrix: mat4(THREE, x, DECK_Y + 0.08, z, 1, 1, 1, 0, Math.PI / 2), color: ROPE }));
  [[1.65, boatZ(0.42)], [1.7, boatZ(0.44)], [-1.6, boatZ(0.66)]].forEach(([x, z]) => parts.push({ geo: new THREE.SphereGeometry(0.17, 8, 6), matrix: mat4(THREE, x, DECK_Y + 0.17, z, 1, 0.8, 1), color: STONE }));
  [[1.1, boatZ(0.18)], [-0.4, boatZ(0.9)]].forEach(([x, z]) => parts.push({ geo: cyl(THREE, 0.24, 0.3, 0.42, 10), matrix: mat4(THREE, x, DECK_Y, z), color: hex(THREE, '#a98750') }));
  // two oars lashed along the starboard side
  parts.push(tubeBetween(THREE, new THREE.Vector3(-1.82, 1.4, boatZ(0.2)), new THREE.Vector3(-1.8, 1.6, boatZ(0.8)), 0.04), tubeBetween(THREE, new THREE.Vector3(-1.9, 1.35, boatZ(0.22)), new THREE.Vector3(-1.86, 1.55, boatZ(0.82)), 0.04));
  parts.forEach((p) => { if (!p.color) p.color = WOOD; });
  void OCHRE; void rand;
  const props = new THREE.Mesh(mergeInto(THREE, parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide })); props.castShadow = true; props.receiveShadow = true; root.add(props);
  // the mast, the yard and the lateen sail
  const mastBase = new THREE.Vector3(0, DECK_Y, 0.9);
  const T = new THREE.Vector3(0, 1.9, 5.6), P = new THREE.Vector3(0, 11.2, -5.9), C = new THREE.Vector3(0, 2.7, -4.3);
  const mastTopS = (mastBase.z - T.z) / (P.z - T.z), mastTop = new THREE.Vector3().lerpVectors(T, P, mastTopS);
  const spars = [tubeBetween(THREE, mastBase, mastTop.clone().add(new THREE.Vector3(0, 0.25, 0)), 0.13), tubeBetween(THREE, T.clone().add(new THREE.Vector3(0, -0.1, 0)), P, 0.075)];
  const ropes = [tubeBetween(THREE, mastTop, new THREE.Vector3(0, sheerY(0.95), boatZ(0.95)), 0.022), tubeBetween(THREE, mastTop, new THREE.Vector3(0, sheerY(0.03), boatZ(0.03)), 0.022), tubeBetween(THREE, C, new THREE.Vector3(0.9, DECK_Y + 0.3, boatZ(0.1)), 0.02), tubeBetween(THREE, C, new THREE.Vector3(-0.9, DECK_Y + 0.3, boatZ(0.1)), 0.02),
    tubeBetween(THREE, mastTop, new THREE.Vector3(2.0, 1.2, boatZ(0.5)), 0.02), tubeBetween(THREE, mastTop, new THREE.Vector3(-2.0, 1.2, boatZ(0.5)), 0.02), tubeBetween(THREE, mastTop, new THREE.Vector3(1.8, 1.2, boatZ(0.62)), 0.02), tubeBetween(THREE, mastTop, new THREE.Vector3(-1.8, 1.2, boatZ(0.62)), 0.02)];
  const sparMesh = new THREE.Mesh(mergeInto(THREE, [...spars.map((s) => ({ ...s, color: hex(THREE, '#6b4423') })), ...ropes.map((s) => ({ ...s, color: hex(THREE, '#cdb98a') }))]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); sparMesh.castShadow = true; root.add(sparMesh);
  const N = 14, sailPos = [], sailUv = [], sailIdx = [], lat = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N - i; j++) { const a = i / N, b = j / N, c = 1 - a - b; lat.push({ a, b, c, i, j }); sailPos.push(a * T.x + b * P.x + c * C.x, a * T.y + b * P.y + c * C.y, a * T.z + b * P.z + c * C.z); sailUv.push(b * 1.2, 1 - a * 1.2); }
  const id = (i, j) => { let o = 0; for (let k = 0; k < i; k++) o += N - k + 1; return o + j; };
  for (let i = 0; i < N; i++) for (let j = 0; j < N - i; j++) { sailIdx.push(id(i, j), id(i + 1, j), id(i, j + 1)); if (j < N - i - 1) sailIdx.push(id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sailPos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(sailUv, 2)); sg.setIndex(sailIdx); sg.computeVertexNormals();
  const sail = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: clothTexture(THREE), roughness: 0.95, side: THREE.DoubleSide })); sail.castShadow = tier !== 'low'; root.add(sail);
  const base = Float32Array.from(sailPos);
  const sailUpdate = (t, windK, side = 1) => {
    const p = sg.attributes.position.array;
    for (let k = 0; k < lat.length; k++) { const q = lat[k], edge = Math.min(q.a, q.b, q.c), belly = Math.sin(Math.min(1, edge * 3.4) * Math.PI / 2) * (0.5 + 1.1 * windK);
      p[k * 3] = base[k * 3] + side * belly * (1 + 0.1 * Math.sin(t * 1.3 + q.i * 0.5)) + 0.05 * Math.sin(t * 3 + q.j * 0.9) * windK; p[k * 3 + 1] = base[k * 3 + 1]; p[k * 3 + 2] = base[k * 3 + 2]; }
    sg.attributes.position.needsUpdate = true; sg.computeVertexNormals();
  };
  sailUpdate(0, 0.3);
  return { root, hull, sail, sailUpdate, mastBase, T, P, C };
}

// the lamp that lights the deck at dusk: a warm glow sprite (a real point light is not part of the shared three.js bundle)
export function buildLamp(THREE) {
  const g = new THREE.Group(), glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(THREE, 'rgba(255,214,140,1)', 'rgba(255,170,60,0)', 128), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.scale.set(2.6, 2.6, 1); g.add(glow);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.26, 8), new THREE.MeshStandardMaterial({ color: 0x3c2a1c, emissive: 0xffc070, emissiveIntensity: 0.9, roughness: 0.6 })); g.add(body);
  return { group: g, glow };
}

// ---- the Muharraq waterfront: a jetty, coral-stone houses with wind towers, palms, and other boats at their moorings -----------------------------------------------------------------
export function buildHarbour(THREE, tier, dhowRoot) {
  const root = new THREE.Group(), rand = lcg(5150), parts = [];
  const box = (w, h, d, x, y, z, color, ry = 0) => parts.push({ geo: new THREE.BoxGeometry(w, h, d), matrix: mat4(THREE, x, y + h / 2, z, 1, 1, 1, ry), color: hex(THREE, color) });
  const cylp = (rt, rb, h, x, y, z, color, seg = 7, rx = 0, rz = 0) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(0, h / 2, 0); parts.push({ geo: g, matrix: mat4(THREE, x, y, z, 1, 1, 1, 0, rx, rz), color: hex(THREE, color) }); };
  // the jetty, parallel to the boat: planks on piles, with a few bollards, coils and a stack of sacks
  const JY = 0.85;
  box(32, 0.22, 3.0, 0, JY - 0.22, 1.4, '#8a6238');
  for (let x = -15; x <= 15; x += 3) for (const z of [0.1, 2.7]) cylp(0.16, 0.18, 2.6, x, -1.6, z, '#4a3220');
  for (let x = -14; x <= 14; x += 4) box(0.06, 0.02, 3.0, x, JY, 1.4, '#6e4a28');
  for (const x of [-9, -2, 5, 12]) cylp(0.14, 0.18, 0.5, x, JY, 0.2, '#3a2a1c');
  for (const [x, z] of [[8, 1.6], [-11, 2.0]]) { for (let i = 0; i < 5; i++) box(0.7, 0.34, 0.5, x + (i % 3) * 0.72 - 0.5 + (i > 2 ? 0.36 : 0), JY + (i > 2 ? 0.34 : 0), z, '#c9b98a', 0.2 * i); }
  // the town: rows of flat-roofed coral-stone houses with wind towers, doors and small shuttered windows
  const STONE = ['#dcc9a0', '#d3bb90', '#e5d6b2', '#c9b088', '#e0cfa6'];
  for (let row = 0; row < 3; row++) {
    let x = -44 - rand() * 6;
    while (x < 52) {
      const w = 5 + rand() * 4, h = 3.6 + rand() * 2.8 + row * 0.5, d = 5 + rand() * 3, z = -5 - row * 11 - rand() * 2.5, c = STONE[Math.floor(rand() * STONE.length)];
      box(w, h, d, x + w / 2, JY - 0.3, z, c);
      box(w + 0.2, 0.28, d + 0.2, x + w / 2, JY - 0.3 + h, z, '#b7a074');            // the parapet cap
      if (rand() > 0.35) { const tx = x + w * (0.2 + rand() * 0.6); box(1.3, 2.6 + rand() * 0.8, 1.3, tx, JY - 0.3 + h, z + 0.3, c); box(1.5, 0.22, 1.5, tx, JY - 0.3 + h + 3.2, z + 0.3, '#a89066'); for (const dx of [-0.34, 0.34]) box(0.14, 1.1, 0.04, tx + dx, JY - 0.3 + h + 1.4, z + 0.3 + 0.67, '#3a2a1c'); }
      if (row === 0) { box(1.0, 1.9, 0.12, x + w * 0.5, JY - 0.3, z + d / 2 + 0.03, '#5a3a20'); for (let k = 0; k < 2; k++) box(0.7, 0.9, 0.1, x + w * (0.2 + 0.55 * k), JY - 0.3 + h * 0.62, z + d / 2 + 0.03, '#4a3624'); }
      x += w + 0.7 + rand() * 1.4;
    }
  }
  // palms
  for (let i = 0; i < (tier === 'low' ? 8 : 18); i++) {
    const x = -40 + rand() * 82, z = -3.8 - rand() * 9, h = 5 + rand() * 3.5, lean = (rand() - 0.5) * 0.3;
    cylp(0.17, 0.26, h, x, JY - 0.3, z, '#7a5a3a', 6, lean, 0);
    const tx = x, ty = JY - 0.3 + h, tz = z - Math.sin(lean) * h * 0.5;
    for (let f = 0; f < 8; f++) { const a = (f / 8) * TAUW + rand() * 0.3; const g = new THREE.BoxGeometry(0.2, 0.04, 3.0); g.translate(0, 0, 1.5); parts.push({ geo: g, matrix: mat4(THREE, tx, ty, tz, 1, 1, 1, a, 0.45 + rand() * 0.25, 0), color: hex(THREE, rand() > 0.5 ? '#3d7a3a' : '#4c8a3a') }); }
  }
  const town = new THREE.Mesh(mergeInto(THREE, parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })); town.castShadow = true; town.receiveShadow = true; root.add(town);
  // low dunes behind the town and a distant line of land
  const dune = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 8, 0, TAUW, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xcdb98c, roughness: 1 })); dune.scale.set(260, 16, 60); dune.position.set(0, -2, -120); root.add(dune);
  // other boats: copies of the dhow at their moorings
  if (dhowRoot) { [[-30, 0, 20, 1.5, 0.9], [22, 0, 24, 1.7, 0.85], [-48, 0, 6, 1.45, 0.8]].forEach(([x, y, z, ry, s]) => { const c = dhowRoot.clone(); c.position.set(x, y, z); c.rotation.y = ry; c.scale.setScalar(s); root.add(c); }); }
  const merchantAt = { x: -3.2, y: JY + 0.02, z: 1.0, yaw: 0.35 };
  const update = () => {};
  return { root, update, merchantAt };
}
const TAUW = Math.PI * 2;
