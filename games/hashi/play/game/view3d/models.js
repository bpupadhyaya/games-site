// Hashi 3D models: the garden pond, mossy stone islands, plank bridges with rope rails, lanterns, pines, a torii, koi.
// Everything is procedural (lathe / rounded boxes / canvas textures); units are lattice cells, the water surface is y = 0.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (f) => f * f * (3 - 2 * f);
export const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
export const hash = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function canvasTex(c, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// ---------------------------------------------------------------- looks: the four themes the Settings "Look" picks between
export const LOOKS3D = {
  lagoon: {
    sky: ['#2b6f9e', '#86c4d4', '#ffd9b0', '#ffb98a'], sun: [0.5, 0.82, '#fff1c0'], fog: 0xb8c8c4, fogNear: 30, fogFar: 140, haze: '#e8d8c4', ridge: ['#4f7f8c', '#6f9fa6', '#92bdbd'],
    water: 0x1f98a6, bed: '#0b4a56', key: 0xffd29a, keyI: 2.9, keyPos: [-7, 7.5, -8], fill: 0xbfe0ff, fillI: 0.7, hemiSky: 0xdfe8f0, hemiGround: 0x5a6a48, hemi: 0.8, exposure: 0.95,
    glow: 0.55, ground: '#5c7048', gravel: '#a8a38a', moss: '#6aa856', mossDk: '#2f6a34', petal: '#ffd0dc', canopy: ['#ff9db5', '#ffb8c8', '#f78fb0'], firefly: 0, stars: 0, env: 0.7,
  },
  dusk: {
    sky: ['#25184f', '#6a3f8f', '#e0698a', '#ffb070'], sun: [0.32, 0.78, '#ffd7a0'], fog: 0x8a5f9c, fogNear: 26, fogFar: 130, haze: '#b97aa6', ridge: ['#3a2a64', '#52397a', '#74508c'],
    water: 0x5a47a0, bed: '#1d1344', key: 0xffb27a, keyI: 3.0, keyPos: [-8, 5.5, -7], fill: 0x9a8cff, fillI: 0.85, hemiSky: 0xffa8c8, hemiGround: 0x2a1c3c, hemi: 0.8, exposure: 1.0,
    glow: 1.0, ground: '#3e4a48', gravel: '#8a7c92', moss: '#6d9a58', mossDk: '#2c4a38', petal: '#ffb0c8', canopy: ['#ff7a8a', '#ff9a6a', '#e85a7a'], firefly: 0.6, stars: 0.35, env: 0.6,
  },
  chart: {
    sky: ['#8ec4e8', '#c9e6f2', '#f4f1dc', '#fff6dc'], sun: [0.7, 0.8, '#fffbe8'], fog: 0xdfeee8, fogNear: 38, fogFar: 160, haze: '#eef6ee', ridge: ['#9bb8b0', '#b6cdc4', '#d2e2da'],
    water: 0x5cb8b4, bed: '#2d7f86', key: 0xfff4dc, keyI: 3.4, keyPos: [-6, 9, -5], fill: 0xd8ecff, fillI: 1.1, hemiSky: 0xfdfdff, hemiGround: 0x889070, hemi: 1.05, exposure: 1.05,
    glow: 0.2, ground: '#7a9060', gravel: '#c4bea2', moss: '#7fb860', mossDk: '#3f7a40', petal: '#ffffff', canopy: ['#ff9cb0', '#ffc2cc', '#fff0f0'], firefly: 0, stars: 0, env: 0.9,
  },
  night: {
    sky: ['#04081c', '#0c1840', '#1d2f66', '#3c4a80'], sun: [0.72, 0.74, '#dfe8ff'], fog: 0x12204a, fogNear: 24, fogFar: 120, haze: '#2a3a74', ridge: ['#0b1432', '#121e46', '#1a2a5a'],
    water: 0x143a78, bed: '#050c26', key: 0xb8c8ff, keyI: 2.1, keyPos: [-6, 8, -9], fill: 0x6a86ff, fillI: 0.7, hemiSky: 0x7a92e8, hemiGround: 0x101830, hemi: 0.7, exposure: 1.0,
    glow: 1.5, ground: '#1c2a36', gravel: '#56627c', moss: '#4a8070', mossDk: '#1c3a3c', petal: '#bcd0ff', canopy: ['#8ea6e8', '#aab8f0', '#7a92d8'], firefly: 1, stars: 1, env: 0.5,
  },
};

// ---------------------------------------------------------------- textures
function valueNoise(seed) {
  const r = rng(seed), N = 64, g = new Float32Array(N * N); for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (x, y) => g[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v); };
}
// Tileable water normal map: sum of a few periodic ripple trains (cheap, no seams).
let waterNormalTex = null;
export function waterNormal() {
  if (waterNormalTex) return waterNormalTex;
  const S = 256, c = cv(S), x = c.getContext('2d'), img = x.createImageData(S, S), h = new Float32Array(S * S), r = rng(11);
  const waves = []; for (let i = 0; i < 9; i++) waves.push({ kx: Math.round((r() - 0.5) * 10) || 2, ky: Math.round((r() - 0.5) * 10) || 3, a: 0.5 + r(), p: r() * TAU });
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { let v = 0; for (const w of waves) v += Math.sin(((w.kx * i + w.ky * j) / S) * TAU + w.p) * w.a; h[j * S + i] = v; }
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = h[j * S + ((i + 1) % S)] - h[j * S + ((i - 1 + S) % S)], dy = h[((j + 1) % S) * S + i] - h[((j - 1 + S) % S) * S + i];
    const nx = -dx * 0.55, ny = -dy * 0.55, nz = 1, l = Math.hypot(nx, ny, nz), k = (j * S + i) * 4;
    img.data[k] = (nx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[k + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  waterNormalTex = canvasTex(c, { repeat: [4, 4], srgb: false });
  return waterNormalTex;
}
// Soft light network on the pond bed (caustics): bright thin cells on a transparent ground, additive.
let causticTex = null;
export function causticTexture() {
  if (causticTex) return causticTex;
  const S = 256, c = cv(S), x = c.getContext('2d'), r = rng(5), pts = []; for (let i = 0; i < 34; i++) pts.push([r() * S, r() * S]);
  const img = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    let d1 = 1e9, d2 = 1e9;
    for (const [px, py] of pts) for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const d = (i - px - ox) ** 2 + (j - py - oy) ** 2; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    const e = Math.sqrt(d2) - Math.sqrt(d1), v = Math.pow(clamp(1 - e / 7, 0, 1), 1.6), k = (j * S + i) * 4;
    img.data[k] = 200; img.data[k + 1] = 245; img.data[k + 2] = 255; img.data[k + 3] = v * 255;
  }
  x.putImageData(img, 0, 0);
  causticTex = canvasTex(c, { repeat: [5, 5] });
  return causticTex;
}
export function softCanvas(rgb, a = 1, ring = false, size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, ring ? size * 0.3 : 0, size / 2, size / 2, size / 2);
  if (ring) { g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.62, `rgba(${rgb},${a})`); g.addColorStop(0.74, `rgba(${rgb},${a * 0.5})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  else { g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return canvasTex(c);
}
function mossTexture(look, seed = 3) {
  const S = 256, c = cv(S), x = c.getContext('2d'), n = valueNoise(seed), n2 = valueNoise(seed + 9);
  const img = x.createImageData(S, S), c0 = new THREE.Color(look.mossDk), c1 = new THREE.Color(look.moss);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const v = n(i / 18, j / 18) * 0.55 + n2(i / 5, j / 5) * 0.35 + (n(i / 2, j / 2) - 0.5) * 0.2, k = (j * S + i) * 4;
    img.data[k] = lerp(c0.r, c1.r, v) * 255; img.data[k + 1] = lerp(c0.g, c1.g, v) * 255; img.data[k + 2] = lerp(c0.b, c1.b, v) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return canvasTex(c, { repeat: [1, 1] });
}
// The garden floor, painted once per pond size: raked gravel furrows in concentric rounded squares around the pond, mossy earth beyond,
// flat stepping-stone patches and fallen leaves. The canvas covers +-R world units around the pond; UVs are set from world x/z.
export const GROUND_R = 22;
function groundTexture(look, H) {
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = rng(21), n = valueNoise(4), n2 = valueNoise(13), R = Math.max(GROUND_R, H + 14), k = S / (2 * R);
  const img = x.createImageData(S, S), c0 = new THREE.Color(look.mossDk), c1 = new THREE.Color(look.ground), gv = new THREE.Color(look.gravel);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const wx = (i / k) - R, wz = (j / k) - R, dEdge = Math.max(Math.abs(wx), Math.abs(wz)) - (H + 0.5);
    const v = 0.55 * n(i / 26, j / 26) + 0.35 * n2(i / 7, j / 7) + 0.1 * n(i / 2.5, j / 2.5);
    const kk = (j * S + i) * 4;
    // gravel band close to the pond, moss further out, soft transition
    const band = clamp(1 - (dEdge - 3.2) / 2.2, 0, 1);
    const col = c0.clone().lerp(c1, v).multiplyScalar(0.95);
    const gr = gv.clone().multiplyScalar(0.82 + 0.3 * n2(i / 3, j / 3));
    col.lerp(gr, band);
    img.data[kk] = col.r * 255; img.data[kk + 1] = col.g * 255; img.data[kk + 2] = col.b * 255; img.data[kk + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // raked furrows: concentric rounded squares around the basin, light crest + dark trough
  const ctr = S / 2;
  const sq = (d, rad) => { const hs = (H + 0.5 + d) * k; x.beginPath(); x.roundRect(ctr - hs, ctr - hs, hs * 2, hs * 2, Math.min(hs, rad * k)); };
  for (let d = 0.35; d < 3.3; d += 0.2) {
    sq(d + 0.04, 0.6 + d); x.lineWidth = Math.max(1, 0.05 * k); x.strokeStyle = 'rgba(255,255,255,0.20)'; x.stroke();
    sq(d, 0.6 + d); x.lineWidth = Math.max(1.2, 0.07 * k); x.strokeStyle = 'rgba(0,0,0,0.26)'; x.stroke();
  }
  // fine speckle so the floor never looks like flat paint
  for (let q = 0; q < 14000; q++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.10)'; x.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5); }
  const t = canvasTex(c, { aniso: 8 }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return { t, R };
}

// ---------------------------------------------------------------- sky, mountains, torii
export function skyTexture(look) {
  const W = 512, H = 512, c = cv(W, H), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, H);
  const s = look.sky; g.addColorStop(0, s[0]); g.addColorStop(0.45, s[1]); g.addColorStop(0.62, s[2]); g.addColorStop(0.72, s[3]); g.addColorStop(1, s[3]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const [sx, sy, sc] = look.sun, gx = sx * W, gy = sy * H, gr = x.createRadialGradient(gx, gy, 0, gx, gy, H * 0.55);
  gr.addColorStop(0, sc); gr.addColorStop(0.08, sc + 'cc'); gr.addColorStop(0.35, 'rgba(255,220,170,0.22)'); gr.addColorStop(1, 'rgba(255,200,150,0)');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  if (look.stars) { const r = rng(7); for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.6})`; const px = r() * W, py = r() * H * 0.5; x.fillRect(px, py, r() < 0.15 ? 2 : 1, r() < 0.15 ? 2 : 1); } }
  const t = canvasTex(c); t.wrapS = THREE.RepeatWrapping; return t;
}
export function ridgeTexture(color, haze, seed, amp = 0.35) {
  const W = 1024, H = 256, c = cv(W, H), x = c.getContext('2d'), n = valueNoise(seed);
  const g = x.createLinearGradient(0, H * 0.2, 0, H); g.addColorStop(0, color); g.addColorStop(1, haze);
  x.fillStyle = g; x.beginPath(); x.moveTo(0, H);
  for (let i = 0; i <= W; i += 4) { const u = i / W * 14; const y = H * (0.75 - amp * (n(u, 3) * 0.6 + n(u * 2.3, 9) * 0.3 + Math.pow(Math.sin(i / W * Math.PI * 3 + seed) * 0.5 + 0.5, 2) * 0.35)); x.lineTo(i, y); }
  x.lineTo(W, H); x.closePath(); x.fill();
  const t = canvasTex(c, { srgb: true }); t.wrapS = THREE.RepeatWrapping; return t;
}
export function buildTorii(look) {
  const g = new THREE.Group();
  const red = B.material('lacquer', { color: '#c8321c' }), blk = B.material('darkWood', { color: '#2a1a14' });
  const col = (x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 6.2, 18), red); m.position.set(x, 3.1, 0); m.castShadow = true; return m; };
  g.add(col(-2.1), col(2.1));
  const kasagi = new THREE.Mesh(B.roundedBox(7.6, 0.4, 0.7, 0.08), blk); kasagi.position.y = 6.5; kasagi.castShadow = true;
  const kasagiTop = new THREE.Mesh(B.roundedBox(8.4, 0.22, 0.9, 0.06), blk); kasagiTop.position.y = 6.8; kasagiTop.rotation.z = 0;
  const nuki = new THREE.Mesh(B.roundedBox(5.0, 0.34, 0.34, 0.05), red); nuki.position.y = 5.1;
  const shimaki = new THREE.Mesh(B.roundedBox(6.4, 0.26, 0.5, 0.05), red); shimaki.position.y = 6.15;
  const plaque = new THREE.Mesh(B.roundedBox(0.7, 0.9, 0.2, 0.04), blk); plaque.position.set(0, 5.6, 0);
  g.add(kasagi, kasagiTop, nuki, shimaki, plaque);
  return g;
}

// ---------------------------------------------------------------- island parts (instanced by the presenter)
function jitterLathe(profile, seg, seed, amp) {
  const g = B.lathe(profile, seg), p = g.attributes.position, n = valueNoise(seed);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i), r = Math.hypot(x, z); if (r < 1e-4) continue;
    const a = Math.atan2(z, x), k = 1 + (n(Math.cos(a) * 2.5 + 8, Math.sin(a) * 2.5 + 8 + y * 3) - 0.5) * 2 * amp;
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
}
export function makeParts(look) {
  const P = {};
  P.rock = jitterLathe([[0, -0.3], [0.30, -0.3], [0.38, -0.18], [0.43, -0.04], [0.44, 0.05], [0.42, 0.12], [0.405, 0.145], [0, 0.145]], 30, 3, 0.12);
  P.moss = jitterLathe([[0, 0.185], [0.18, 0.19], [0.30, 0.178], [0.385, 0.15], [0.425, 0.115], [0.43, 0.085]], 30, 3, 0.1);
  P.plaque = B.lathe([[0, 0.17], [0.3, 0.17], [0.3, 0.238], [0.285, 0.246], [0.262, 0.236], [0.245, 0.214], [0, 0.214]], 36);
  P.plaqueRim = B.lathe([[0.292, 0.234], [0.3, 0.238], [0.285, 0.248], [0.262, 0.238]], 36);
  P.trunk = B.lathe([[0, 0], [0.026, 0], [0.02, 0.2], [0.012, 0.42], [0, 0.42]], 8);
  P.pine = B.mergeGeos([0, 1, 2].map((i) => ({ geo: B.lathe([[0, 0], [0.19 - i * 0.045, 0], [0.12 - i * 0.03, 0.1], [0.07 - i * 0.02, 0.17], [0, 0.26]], 10), m: new THREE.Matrix4().makeTranslation(0, 0.22 + i * 0.13, 0) })));
  P.canopy = new THREE.SphereGeometry(0.17, 12, 9); P.canopy.scale(1, 0.72, 1);
  P.rockSmall = jitterLathe([[0, 0], [0.13, 0], [0.16, 0.05], [0.12, 0.11], [0.05, 0.14], [0, 0.14]], 9, 17, 0.25);
  P.lanternBase = B.lathe([[0, 0], [0.085, 0], [0.085, 0.04], [0.05, 0.05], [0.05, 0.2], [0.075, 0.2], [0.075, 0.215], [0, 0.215]], 8);
  P.lanternBox = B.roundedBox(0.11, 0.1, 0.11, 0.01);
  P.lanternRoof = B.lathe([[0, 0.28], [0.12, 0.28], [0.1, 0.31], [0.05, 0.345], [0.02, 0.37], [0, 0.375]], 8);
  P.dot = new THREE.CircleGeometry(0.05, 10); P.dot.rotateX(-Math.PI / 2);
  return P;
}

// ---------------------------------------------------------------- bridge parts
export function makePlankGeo() { return B.roundedBox(1, 0.045, 1, 0.012, 2); }   // scaled per instance: x = along, z = width
export function makePostGeo() { return B.lathe([[0, 0], [0.034, 0], [0.034, 0.24], [0.04, 0.245], [0.04, 0.265], [0.03, 0.272], [0, 0.272]], 8); }
export function makeRopeGeo() { const g = new THREE.CylinderGeometry(0.011, 0.011, 1, 5, 1, true); g.rotateZ(Math.PI / 2); return g; }   // unit length along x

// ---------------------------------------------------------------- koi, lotus, lanterns, pines, bamboo, shore rocks
export function buildKoi(color, spot) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 }));
  body.scale.set(2.4, 0.55, 0.8); body.position.x = 0.05;
  const patch = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: spot, roughness: 0.5 }));
  patch.scale.set(1.2, 0.58, 0.82); patch.position.set(0.0, 0.012, 0);
  const tailShape = new THREE.Shape(); tailShape.moveTo(0, 0); tailShape.lineTo(-0.2, 0.09); tailShape.quadraticCurveTo(-0.15, 0, -0.2, -0.09); tailShape.lineTo(0, 0);
  const tail = new THREE.Mesh(new THREE.ShapeGeometry(tailShape), new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.88 }));
  tail.rotation.x = -Math.PI / 2; const tg = new THREE.Group(); tg.position.x = -0.2; tg.add(tail);
  const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), tail.material); fin.position.set(0.05, 0, 0.07); fin.rotation.set(-Math.PI / 2, 0, 0.5);
  const fin2 = fin.clone(); fin2.position.z = -0.07; fin2.rotation.z = -0.5;
  g.add(body, patch, tg, fin, fin2); g.userData.tail = tg;
  return g;
}
export function buildPine(scale = 1, seed = 1) {
  const g = new THREE.Group(), r = rng(seed);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 1.2, 7), B.material('darkWood', { color: '#4a3020' })); trunk.position.y = 0.6; trunk.rotation.z = (r() - 0.5) * 0.12; trunk.castShadow = true; g.add(trunk);
  const fm = new THREE.MeshStandardMaterial({ color: 0x2f6a3a, roughness: 0.85 });
  for (let i = 0; i < 4; i++) {
    const w = 0.95 - i * 0.18, tier = new THREE.Mesh(B.lathe([[0, 0], [w, 0.02], [w * 0.8, 0.14], [w * 0.4, 0.24], [0, 0.3]], 14), fm);
    tier.position.set((r() - 0.5) * 0.12, 0.62 + i * 0.36, (r() - 0.5) * 0.12); tier.rotation.y = r() * 3; tier.castShadow = true; g.add(tier);
  }
  g.scale.setScalar(scale);
  return g;
}
export function buildBlossom(scale = 1, colors = ['#ff9db5'], seed = 2) {
  const g = new THREE.Group(), r = rng(seed);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 1.1, 7), B.material('darkWood', { color: '#3a281c' })); trunk.position.y = 0.55; trunk.castShadow = true; g.add(trunk);
  const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.7, 6), trunk.material); br.position.set(0.25, 1.0, 0); br.rotation.z = -0.9; g.add(br);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.45 + r() * 0.2, 12, 9), new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.9, emissive: colors[i % colors.length], emissiveIntensity: 0.08 }));
    m.scale.y = 0.72; m.position.set((r() - 0.5) * 1.1 + 0.15, 1.2 + r() * 0.55, (r() - 0.5) * 0.9); m.castShadow = true; g.add(m);
  }
  g.scale.setScalar(scale);
  return g;
}
export function buildBamboo(seed = 3, n = 7) {
  const g = new THREE.Group(), r = rng(seed), m = new THREE.MeshStandardMaterial({ color: 0x7fae4a, roughness: 0.5 }), lm = new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < n; i++) {
    const h = 2.4 + r() * 1.8, s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, h, 6), m);
    const bx = (r() - 0.5) * 0.7, bz = (r() - 0.5) * 0.7; s.position.set(bx, h / 2, bz); s.rotation.set((r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.08); s.castShadow = true; g.add(s);
    for (let k = 0; k < 3; k++) { const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), lm); leaf.position.set(bx + (r() - 0.5) * 0.3, h - 0.1 - k * 0.3, bz + (r() - 0.5) * 0.3); leaf.rotation.set((r() - 0.5) * 1.2, r() * 3, (r() - 0.5) * 0.8); g.add(leaf); }
  }
  return g;
}
export function buildToro(glowColor = 0xffc070, scale = 1) {
  const g = new THREE.Group(), st = B.material('stone', { color: '#8a8a82', color2: '#b6b2a6', seed: 4 });
  const add = (geo, y, mat = st) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(B.lathe([[0, 0], [0.34, 0], [0.34, 0.1], [0.24, 0.14], [0, 0.14]], 12), 0);
  add(B.lathe([[0, 0], [0.12, 0], [0.12, 0.8], [0.1, 0.82], [0, 0.82]], 10), 0.14);
  add(B.lathe([[0, 0], [0.3, 0], [0.34, 0.06], [0.26, 0.12], [0, 0.12]], 12), 0.94);
  const box = add(B.roundedBox(0.34, 0.34, 0.34, 0.03), 1.2); box.name = 'box';
  const glow = new THREE.Mesh(B.roundedBox(0.22, 0.22, 0.22, 0.02), new THREE.MeshBasicMaterial({ color: glowColor })); glow.position.y = 1.2; glow.name = 'glow'; g.add(glow);
  add(B.lathe([[0, 0], [0.5, 0], [0.42, 0.06], [0.22, 0.2], [0.08, 0.3], [0, 0.34]], 4), 1.38).rotation.y = Math.PI / 4;
  g.scale.setScalar(scale); g.userData.glow = glow;
  return g;
}
export function buildLilyPad(r = 0.3) {
  const g = new THREE.CircleGeometry(r, 18, 0.35, TAU - 0.5); g.rotateX(-Math.PI / 2); return g;
}

// ---------------------------------------------------------------- pond surround (rebuilt when the board size or the look changes)
export function buildSurround(H, look) {
  const root = new THREE.Group(), tex = [];
  const stoneMat = B.material('stone', { color: '#6f6c66', color2: '#a39e92', seed: 5 });
  const mossTex = mossTexture(look, 8); tex.push(mossTex);
  const mossMat = new THREE.MeshStandardMaterial({ map: mossTex, roughness: 0.95, color: 0xb8d8a0 });
  // basin walls + bed
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(2 * H + 0.6, 2 * H + 0.6), new THREE.MeshStandardMaterial({ color: look.bed, roughness: 1 }));
  bed.rotation.x = -Math.PI / 2; bed.position.y = -0.62; bed.receiveShadow = true; root.add(bed);
  const caust = new THREE.Mesh(new THREE.PlaneGeometry(2 * H + 0.5, 2 * H + 0.5), new THREE.MeshBasicMaterial({ map: causticTexture(), transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  caust.rotation.x = -Math.PI / 2; caust.position.y = -0.6; caust.name = 'caustic'; root.add(caust);
  const wallM = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.bed).multiplyScalar(1.3), roughness: 1 });
  for (const [x, z, ry] of [[0, -H - 0.3, 0], [0, H + 0.3, Math.PI], [-H - 0.3, 0, Math.PI / 2], [H + 0.3, 0, -Math.PI / 2]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2 * H + 0.6, 0.9), wallM); w.position.set(x, -0.2, z); w.rotation.y = ry; root.add(w);
  }
  // one big ground with a square hole for the basin; UVs map world x/z onto the painted ground texture
  const gt = groundTexture(look, H); tex.push(gt.t);
  const gm = new THREE.MeshStandardMaterial({ map: gt.t, roughness: 1 });
  const ext = 170, gy = 0.15, hole = H + 0.5;
  const shp = new THREE.Shape(); shp.moveTo(-ext, -ext); shp.lineTo(ext, -ext); shp.lineTo(ext, ext); shp.lineTo(-ext, ext); shp.closePath();
  const hp = new THREE.Path(); hp.moveTo(-hole, -hole); hp.lineTo(-hole, hole); hp.lineTo(hole, hole); hp.lineTo(hole, -hole); hp.closePath(); shp.holes.push(hp);
  const gGeo = new THREE.ShapeGeometry(shp); gGeo.rotateX(-Math.PI / 2);
  { const p = gGeo.attributes.position, uv = gGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * gt.R) + 0.5, p.getZ(i) / (2 * gt.R) + 0.5); uv.needsUpdate = true; }
  const ground = new THREE.Mesh(gGeo, gm); ground.position.y = gy; ground.receiveShadow = true; root.add(ground);
  // coping stones: a ring of rounded stones
  const copeN = Math.ceil((2 * H + 1.2) / 0.85) * 4, cope = new THREE.InstancedMesh(B.roundedBox(0.85, 0.34, 0.5, 0.08, 3), stoneMat, copeN), r = rng(31), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  let k = 0; const per = Math.ceil((2 * H + 1.2) / 0.85), L = 2 * H + 1.2;
  for (let side = 0; side < 4; side++) for (let i = 0; i < per; i++) {
    const u = -L / 2 + (i + 0.5) * (L / per), off = H + 0.25 + (r() - 0.5) * 0.06, y = 0.07 + r() * 0.04;
    const x = side === 0 ? u : side === 1 ? u : side === 2 ? -off : off, z = side === 0 ? -off : side === 1 ? off : u;
    const yaw = side < 2 ? 0 : Math.PI / 2;
    e.set((r() - 0.5) * 0.04, yaw + (r() - 0.5) * 0.06, (r() - 0.5) * 0.04); q.setFromEuler(e); v.set(x, y, z); s.set(L / per / 0.85 * 1.04, 0.85 + r() * 0.35, 1 + r() * 0.2);
    M.compose(v, q, s); cope.setMatrixAt(k++, M);
  }
  cope.count = k; cope.castShadow = true; cope.receiveShadow = true; root.add(cope);
  // moss tufts on the coping + ground
  const mossGeo = new THREE.SphereGeometry(0.16, 8, 6); mossGeo.scale(1.3, 0.28, 1);
  const tuft = new THREE.InstancedMesh(mossGeo, mossMat, 70);
  for (let i = 0; i < 70; i++) {
    const side = Math.floor(r() * 4), u = (r() - 0.5) * L, off = H + 0.25 + (r() - 0.5) * 0.5;
    const x = side < 2 ? u : (side === 2 ? -off : off), z = side === 0 ? -off : side === 1 ? off : u;
    v.set(x, 0.235, z); q.identity(); const sc = 0.5 + r() * 0.9; s.set(sc, sc, sc); M.compose(v, q, s); tuft.setMatrixAt(i, M);
  }
  tuft.castShadow = false; root.add(tuft);
  // scatter: shore rocks, bamboo, pines, blossom tree, toro lanterns, the torii
  const rockMat = stoneMat, rockGeo = jitterLathe([[0, 0], [0.4, 0], [0.5, 0.15], [0.4, 0.4], [0.2, 0.55], [0, 0.58]], 10, 5, 0.2);
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 46);
  for (let i = 0; i < 46; i++) {
    const a = r() * TAU, d = H + 2.2 + r() * 16, sc = 0.35 + r() * 0.8;
    v.set(Math.cos(a) * d * 1.05, 0.12, Math.sin(a) * d); e.set(0, r() * 6, 0); q.setFromEuler(e); s.set(sc * (1 + r() * 0.5), sc * (0.6 + r() * 0.7), sc); M.compose(v, q, s); rocks.setMatrixAt(i, M);
  }
  rocks.castShadow = true; rocks.receiveShadow = true; root.add(rocks);
  const decor = new THREE.Group(); decor.name = 'decor'; root.add(decor);
  const place = (obj, x, z, y = 0.15) => { obj.position.set(x, y, z); decor.add(obj); return obj; };
  const toros = [];
  const far = H + 1.4;
  for (const [sx, sz, sc] of [[-1, -1, 1.15], [1, -1, 1.15], [-1, 1, 1.0], [1, 1, 1.0]]) { const t = buildToro(0xffc070, sc); place(t, sx * (H + 1.1), sz * (H + 1.1), 0.15); t.rotation.y = r() * 3; toros.push(t); }
  for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.34 + (r() - 0.5) * 0.15, d = far + 1.2 + r() * 7; place(buildPine(0.9 + r() * 1.1, 40 + i), Math.cos(a) * d * 1.25, Math.sin(a) * d); }
  for (let i = 0; i < 4; i++) place(buildPine(0.8 + r() * 0.8, 80 + i), (i < 2 ? -1 : 1) * (H + 3 + r() * 6), (r() - 0.2) * (H + 2));
  place(buildBlossom(1.6, look.canopy, 6), H + 3.2, -H * 0.2); place(buildBlossom(1.35, look.canopy, 9), -H - 3.6, -H * 0.55 - 1);
  place(buildBamboo(5, 9), -H - 2.4, -H - 2.2); place(buildBamboo(7, 8), H + 2.8, -H - 3.0);
  const torii = buildTorii(look); torii.scale.setScalar(1.0); place(torii, 0, -(H + 26), 0.15); torii.rotation.y = 0;
  // stepping stones on the near side
  const stepM = stoneMat;
  for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.46 - i * 0.01, 0.52 - i * 0.01, 0.12, 12), stepM); m.position.set(Math.sin(i * 0.9) * 0.6 + 2.2, 0.16, H + 1.2 + i * 0.95); m.receiveShadow = true; m.castShadow = true; decor.add(m); }
  decor.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow ?? true; } });
  return { root, toros, tex, dispose() { root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } };
}
