// Konane 3D world (units: centimetres). A papamū pecked into a flat-topped lava boulder on a golden-hour beach: basalt pebbles and
// bleached coral pebbles in hand-pecked cups, warm sand, a calm sea with the low sun on it, calabash bowls of spare stones.
// Everything is procedural (canvas textures + analytic geometry): no image files. Shared by the presenter and the icon page.
import * as THREE from '../vendor3d/three.js';

export const C = 5;                 // cup spacing (cm); real papamū cups are a few fingers apart
export const TOP = 11;              // height of the rock's playing face above the sand
export const CUP_R = 1.95, CUP_D = 0.75;
export const STONE_R = 1.85, STONE_H = 1.55;     // a pebble ~3.7 cm across, ~1.6 cm thick
export const SUN_DIR = new THREE.Vector3(0.42, 0.42, -0.8).normalize();
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
// smooth value noise
function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi + seed * 131, yi), b = hash(xi + 1 + seed * 131, yi), c = hash(xi + seed * 131, yi + 1), d = hash(xi + 1 + seed * 131, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, seed, oct = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i); f *= 2.03; a *= 0.5; } return s; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---- geometry helpers -------------------------------------------------------------------------------------------
export const cupPos = (n, i) => { const x = i % n, y = (i - x) / n; return { x: (x - (n - 1) / 2) * C, z: (y - (n - 1) / 2) * C }; };
export const rockHalf = (n) => n * C / 2 + 5.2;

// The boulder as one height field: a rounded flat top with pecked cups, a lumpy shoulder, sides that sink into the sand.
function rockShape(n) {
  const a = rockHalf(n), b = rockHalf(n) * 0.97, R = 3.6, seed = 17 + n;
  const ang = (x, z) => Math.atan2(z, x);
  const edge = (x, z) => {                               // signed distance (cm) inside the irregular superellipse outline
    const t = ang(x, z), k = 1 + 0.045 * Math.sin(t * 3 + 1.3) + 0.03 * Math.sin(t * 5 + 0.4) + 0.025 * (vnoise(Math.cos(t) * 3 + 9, Math.sin(t) * 3 + 9, seed) - 0.5) * 2;
    const p = 3.4, q = Math.pow(Math.pow(Math.abs(x) / (a * k), p) + Math.pow(Math.abs(z) / (b * k), p), 1 / p);
    return (1 - q) * Math.min(a, b) * k;
  };
  const height = (x, z) => {
    const e = edge(x, z);
    let h;
    if (e >= R) h = TOP;
    else if (e >= 0) { const u = (R - e) / R; h = TOP - R * (1 - Math.sqrt(Math.max(0, 1 - u * u))) * 1.25; }
    else h = TOP - R * 1.25 + e * (4.2 + 2.0 * vnoise(x * 0.2, z * 0.2, seed + 5)) - Math.pow(-e, 1.4) * 0.8;
    const lump = (fbm(x * 0.09, z * 0.09, seed, 4) - 0.5);
    h += e >= R ? lump * 0.28 + (fbm(x * 0.6, z * 0.6, seed + 3, 2) - 0.5) * 0.06 : lump * (2.4 * (1 - Math.max(0, e) / R) + 0.3);
    // pecked cups (the playing face only)
    const gx = x / C + (n - 1) / 2, gz = z / C + (n - 1) / 2, ix = Math.round(gx), iz = Math.round(gz);
    if (ix >= 0 && iz >= 0 && ix < n && iz < n) {
      const dx = (gx - ix) * C, dz = (gz - iz) * C, d = Math.hypot(dx, dz) / CUP_R;
      const wob = 1 + 0.06 * (hash(ix * 31 + iz, n) - 0.5);
      if (d < 1.12 * wob) { const u = Math.min(1, d / wob); h -= CUP_D * (u < 1 ? (1 - u * u) : 0) + (u >= 1 ? 0 : 0); if (u > 0.86 && u < 1.12) h += 0.05 * Math.sin((u - 0.86) / 0.26 * Math.PI); }
    }
    return Math.max(-2, h);
  };
  return { a, b, edge, height };
}

function rockTextures(n, size, shape) {
  const span = texSpan(shape), px = size / span, r = lcg(900 + n);
  const col = canvas(size), cx = col.getContext('2d'), bump = canvas(size), bx = bump.getContext('2d');
  // the colour / relief fields are smooth: compute them at 256 and scale up, then add full-resolution grain and the sharp details
  const LS = 256, lc = canvas(LS), lx = lc.getContext('2d'), lb = canvas(LS), lbx = lb.getContext('2d');
  const img = lx.createImageData(LS, LS), bimg = lbx.createImageData(LS, LS);
  for (let j = 0; j < LS; j++) for (let i = 0; i < LS; i++) {
    const x = (i / LS - 0.5) * span, z = (j / LS - 0.5) * span, e = shape.edge(x, z);
    const m = fbm(x * 0.25, z * 0.25, 5 + n, 4), f = fbm(x * 1.6, z * 1.6, 9, 3), top = e > 3 ? 1 : Math.max(0, e / 3);
    // basalt: warm charcoal with brown and iron mottling; the worn playing face slightly darker and smoother, the shoulder lighter and dustier
    let R0 = 40 + m * 26 + f * 12, G0 = 37 + m * 21 + f * 10, B0 = 37 + m * 17 + f * 9;
    if (m > 0.62) { R0 += 22 * (m - 0.62) * 4; G0 += 8 * (m - 0.62) * 4; }
    const wear = 1 - top; R0 += wear * 14; G0 += wear * 12; B0 += wear * 10;
    if (e < -0.5) { R0 *= 0.9; G0 *= 0.9; B0 *= 0.9; }
    if (e < -TOP - 1) { const s = Math.min(1, (-e - TOP - 1) / 4); R0 = R0 * (1 - s) + 196 * s; G0 = G0 * (1 - s) + 168 * s; B0 = B0 * (1 - s) + 128 * s; }   // sand stuck to the foot
    const k = (j * LS + i) * 4; img.data[k] = R0; img.data[k + 1] = G0; img.data[k + 2] = B0; img.data[k + 3] = 255;
    const bv = 128 + (f - 0.5) * 70 + (m - 0.5) * 40; bimg.data[k] = bimg.data[k + 1] = bimg.data[k + 2] = bv; bimg.data[k + 3] = 255;
  }
  lx.putImageData(img, 0, 0); lbx.putImageData(bimg, 0, 0);
  cx.imageSmoothingQuality = 'high'; cx.drawImage(lc, 0, 0, size, size); bx.imageSmoothingQuality = 'high'; bx.drawImage(lb, 0, 0, size, size);
  for (const [ctx, amp] of [[cx, 0.18]]) {
    const d = ctx.getImageData(0, 0, size, size), a = d.data;
    for (let p = 0, q = 0; p < a.length; p += 4, q++) { const gr = 1 - amp / 2 + amp * hash(q, 77); a[p] *= gr; a[p + 1] *= gr; a[p + 2] *= gr; }
    ctx.putImageData(d, 0, 0);
  }
  // vesicles (gas pits of lava rock): dark pits in colour, deep in the bump map
  const nv = Math.round(9000 * (size / 1024) ** 2);
  for (let v = 0; v < nv; v++) {
    const x = r() * size, y = r() * size, s = (0.25 + r() * r() * r() * 2.0) * px * 0.09;
    cx.fillStyle = `rgba(14,11,10,${0.35 + r() * 0.35})`; cx.beginPath(); cx.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, TAU); cx.fill();
    bx.fillStyle = 'rgba(0,0,0,0.85)'; bx.beginPath(); bx.ellipse(x, y, s, s * 0.8, 0, 0, TAU); bx.fill();
  }
  // cups: polished, darker, with a faint pale rim of pecking marks
  for (let i = 0; i < n * n; i++) {
    const p = cupPos(n, i), u = (p.x / span + 0.5) * size, v = (p.z / span + 0.5) * size, R = CUP_R * px;
    let g = cx.createRadialGradient(u, v, R * 0.1, u, v, R * 1.05); g.addColorStop(0, 'rgba(18,15,14,0.55)'); g.addColorStop(0.75, 'rgba(26,22,20,0.4)'); g.addColorStop(1, 'rgba(30,26,24,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(u, v, R * 1.05, 0, TAU); cx.fill();
    for (let k = 0; k < 26; k++) { const a = r() * TAU, d = R * (0.95 + r() * 0.25); cx.fillStyle = `rgba(190,170,150,${0.08 + r() * 0.12})`; cx.fillRect(u + Math.cos(a) * d, v + Math.sin(a) * d, 1 + r() * px * 0.12, 1 + r() * px * 0.1); }
    g = bx.createRadialGradient(u, v, 0, u, v, R); g.addColorStop(0, 'rgba(128,128,128,1)'); g.addColorStop(1, 'rgba(128,128,128,0)'); bx.fillStyle = g; bx.beginPath(); bx.arc(u, v, R, 0, TAU); bx.fill();
  }
  const mk = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  return { map: mk(col, true), bump: mk(bump, false) };
}

// The texture is laid out on the rock UNROLLED: shoulder and sides are pushed outward by how far they drop below the playing face,
// so the sides get their own strip of texture instead of a stretched smear.
const texSpan = (shape) => 2 * (shape.a + TOP + 9);
export function buildRock(n, texSize = 1024) {
  const shape = rockShape(n), span = shape.a * 2.5, seg = Math.round(Math.min(260, 120 + n * 13));
  const geo = new THREE.PlaneGeometry(span, span, seg, seg); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv, ts = texSpan(shape);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = shape.height(x, z); pos.setY(i, h);
    const off = shape.edge(x, z) >= 3.6 ? 0 : Math.max(0, TOP - h), d = Math.hypot(x, z) || 1;
    uv.setXY(i, (x + x / d * off) / ts + 0.5, 0.5 - (z + z / d * off) / ts);
  }
  geo.computeVertexNormals();
  const t = rockTextures(n, texSize, shape);
  const mat = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.6, roughness: 0.86, metalness: 0, envMapIntensity: 0.3 });
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.userData.n = n;
  m.userData.dispose = () => { geo.dispose(); mat.dispose(); t.map.dispose(); t.bump.dispose(); };
  return m;
}
// Height of the cup floor under a stone at square i (stones rest in their cup).
export const restY = () => TOP - CUP_D + STONE_H * 0.5 - 0.05;

// ---- stones: waterworn basalt pebbles and porous coral pebbles, three shapes each ---------------------------------
export function stoneGeos() {
  const out = { 1: [], 2: [] };
  for (const kind of [1, 2]) for (let v = 0; v < 3; v++) {
    const g = new THREE.SphereGeometry(1, 40, 24), p = g.attributes.position, sx = 1 + v * 0.06, sz = 0.92 - v * 0.04;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const lump = kind === 1 ? 0.035 : 0.11, nn = (fbm(x * 1.7 + v * 7, z * 1.7 + y * 1.3, kind * 10 + v, 3) - 0.5) * 2;
      const fl = y < 0 ? 0.82 : 1;                                            // flatter underside: it sits steady in the cup
      const k = 1 + nn * lump;
      p.setXYZ(i, x * STONE_R * sx * k, y * STONE_H * 0.5 * fl * (1 + nn * lump * 0.5), z * STONE_R * sz * k);
    }
    g.computeVertexNormals(); out[kind].push(g);
  }
  return out;
}
export function stoneMaterials() {
  // basalt: dark, slightly blue-grey, waterworn sheen; coral: bleached cream, matte, full of pores
  const pores = canvas(256), px = pores.getContext('2d'), r = lcg(77); px.fillStyle = '#808080'; px.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) { const s = 0.6 + r() * 3.2; px.fillStyle = `rgba(0,0,0,${0.45 + r() * 0.55})`; px.beginPath(); px.arc(r() * 256, r() * 256, s, 0, TAU); px.fill(); }
  const ct = canvas(256), cc = ct.getContext('2d'); cc.fillStyle = '#ebe5d8'; cc.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) { const s = 0.5 + r() * 2.8; const gv = 95 + r() * 50; cc.fillStyle = `rgba(${gv},${gv - 4},${gv - 10},${0.3 + r() * 0.4})`; cc.beginPath(); cc.arc(r() * 256, r() * 256, s, 0, TAU); cc.fill(); }
  for (let i = 0; i < 40; i++) { cc.strokeStyle = `rgba(200,150,120,${0.06 + r() * 0.08})`; cc.lineWidth = 3 + r() * 6; cc.beginPath(); cc.arc(r() * 256, r() * 256, 20 + r() * 60, 0, 1 + r() * 2); cc.stroke(); }
  const bt = canvas(128), bc = bt.getContext('2d'); bc.fillStyle = '#2a2c31'; bc.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 300; i++) { bc.fillStyle = r() < 0.5 ? `rgba(70,74,82,${0.2 + r() * 0.3})` : `rgba(10,10,12,${0.3 + r() * 0.4})`; bc.fillRect(r() * 128, r() * 128, 1 + r() * 3, 1 + r() * 2); }
  const tx = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const black = new THREE.MeshPhysicalMaterial({ map: tx(bt, true), color: 0xd8dce4, roughness: 0.32, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.28, envMapIntensity: 1.1 });
  const white = new THREE.MeshStandardMaterial({ map: tx(ct, true), bumpMap: tx(pores, false), bumpScale: 2.2, color: 0xf2ece0, roughness: 0.92, metalness: 0, envMapIntensity: 0.6 });
  return { 1: black, 2: white };
}

// ---- the beach --------------------------------------------------------------------------------------------------
function sandTexture() {
  const s = 256, c = canvas(s), x = c.getContext('2d'), img = x.createImageData(s, s), b = canvas(s), bx = b.getContext('2d'), bimg = bx.createImageData(s, s);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const k = (j * s + i) * 4, gr = hash(i, j * 7 + 3), m = fbm(i / 32, j / 32, 3, 3), rip = Math.sin((i * 0.12 + j * 0.044) + fbm(i / 45, j / 45, 8, 2) * 5) * 0.5 + 0.5;
    const v = 0.86 + gr * 0.2 - (m - 0.5) * 0.16, dark = gr > 0.985 ? 0.55 : 1;
    img.data[k] = 188 * v * dark; img.data[k + 1] = 152 * v * dark; img.data[k + 2] = 112 * v * dark; img.data[k + 3] = 255;
    bimg.data[k] = bimg.data[k + 1] = bimg.data[k + 2] = 100 + rip * 70 + gr * 50; bimg.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); bx.putImageData(bimg, 0, 0);
  const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(44, 44); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: mk(c, true), bump: mk(b, false) };
}

const SKY_VS = 'varying vec3 vD; void main(){ vD = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }';
const SKY_FS = `varying vec3 vD; uniform vec3 uSun; uniform float uGlow;
void main(){ vec3 d = normalize(vD); float h = d.y;
  vec3 zen = vec3(0.08,0.10,0.28), mid = vec3(0.60,0.30,0.40), hor = vec3(1.0,0.50,0.26), low = vec3(0.95,0.62,0.42);
  vec3 c = h > 0.0 ? mix(mix(hor, mid, smoothstep(0.0,0.18,h)), zen, smoothstep(0.16,0.75,h)) : mix(low, vec3(0.20,0.25,0.36), smoothstep(0.0,-0.2,h));
  float s = max(dot(d, uSun), 0.0); c += vec3(1.0,0.55,0.25) * pow(s, 14.0) * 0.45 * uGlow + vec3(1.0,0.8,0.5) * pow(s, 160.0) * 1.0 + vec3(1.0,0.97,0.9) * smoothstep(0.9993,0.9997,s) * 4.0;
  float band = exp(-abs(h - 0.035) * 60.0) * (0.35 + 0.65 * pow(s, 2.0)); c += vec3(1.0,0.5,0.35) * band * 0.15;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// The set: sky dome, sand, sea with the low sun on it, a far headland, coral bits, a fallen frond, calabash bowls.
export function buildBeach(scene, { quality = 1 } = {}) {
  const g = new THREE.Group(); scene.add(g);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: { uSun: { value: SUN_DIR.clone() }, uGlow: { value: 1 } }, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -10; g.add(sky);
  const st = sandTexture();
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1200, 1, 1), new THREE.MeshStandardMaterial({ map: st.map, bumpMap: st.bump, bumpScale: 0.6, roughness: 0.96, color: 0xffffff }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0, 500); sand.receiveShadow = true; g.add(sand);
  // wet sand band and foam line at the water's edge
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(1600, 60), new THREE.MeshStandardMaterial({ color: 0x6f5a44, roughness: 0.25, metalness: 0.0, transparent: true, opacity: 0.85 }));
  wet.rotation.x = -Math.PI / 2; wet.position.set(0, 0.02, -128); g.add(wet);
  const foamC = canvas(512, 32), fx = foamC.getContext('2d'), r = lcg(4);
  for (let i = 0; i < 260; i++) { fx.fillStyle = `rgba(255,250,240,${0.2 + r() * 0.6})`; fx.beginPath(); fx.ellipse(r() * 512, 10 + r() * 14, 4 + r() * 18, 1 + r() * 3, 0, 0, TAU); fx.fill(); }
  const foamT = new THREE.CanvasTexture(foamC); foamT.wrapS = THREE.RepeatWrapping; foamT.repeat.set(6, 1); foamT.colorSpace = THREE.SRGBColorSpace;
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(1600, 14), new THREE.MeshBasicMaterial({ map: foamT, transparent: true, depthWrite: false, opacity: 0.85 }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.1, -150); g.add(foam);
  // the sea: a dark glossy plane; the environment + sun give it the sun's path
  const seaC = canvas(256), sx = seaC.getContext('2d'), rr = lcg(12); sx.fillStyle = '#808080'; sx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { sx.strokeStyle = `rgba(${rr() < 0.5 ? 255 : 0},${rr() < 0.5 ? 255 : 0},${rr() < 0.5 ? 255 : 0},0.25)`; sx.lineWidth = 1 + rr() * 2; const y = rr() * 256, x0 = rr() * 256; sx.beginPath(); sx.moveTo(x0, y); sx.lineTo(x0 + 10 + rr() * 30, y + rr() * 2); sx.stroke(); }
  const seaB = new THREE.CanvasTexture(seaC); seaB.wrapS = seaB.wrapT = THREE.RepeatWrapping; seaB.repeat.set(30, 120);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 4600), new THREE.MeshStandardMaterial({ color: 0x2f4f63, emissive: 0x3a1e18, roughness: 0.1, metalness: 0.2, bumpMap: seaB, bumpScale: 2.2, envMapIntensity: 1.3 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.3, -2450); g.add(sea);
  // a far headland on the left, hazed by distance
  const hs = new THREE.Shape(); hs.moveTo(-4200, 0); [[-3600, 260], [-3000, 420], [-2500, 380], [-2100, 250], [-1600, 120], [-1100, 40], [-800, 0]].forEach(([x, y]) => hs.lineTo(x, y)); hs.lineTo(-4200, 0);
  const head = new THREE.Mesh(new THREE.ShapeGeometry(hs), new THREE.MeshBasicMaterial({ color: 0x5a3e63, fog: true }));
  head.position.set(0, -2, -4300); g.add(head);
  const isl = new THREE.Shape(); isl.moveTo(1400, 0); [[1700, 90], [2050, 140], [2400, 100], [2800, 40], [3000, 0]].forEach(([x, y]) => isl.lineTo(x, y));
  const island = new THREE.Mesh(new THREE.ShapeGeometry(isl), new THREE.MeshBasicMaterial({ color: 0x8a5a78, fog: true })); island.position.set(0, -2, -4400); g.add(island);
  // coral fragments and small basalt bits scattered on the sand (instanced lumps)
  const lumpG = new THREE.SphereGeometry(1, 10, 7), lp = lumpG.attributes.position;
  for (let i = 0; i < lp.count; i++) { const k = 1 + (hash(i, 5) - 0.5) * 0.45; lp.setXYZ(i, lp.getX(i) * k, lp.getY(i) * k * 0.6, lp.getZ(i) * k); }
  lumpG.computeVertexNormals();
  const coral = new THREE.InstancedMesh(lumpG, new THREE.MeshStandardMaterial({ color: 0xeee2c8, roughness: 0.95 }), 70);
  const bits = new THREE.InstancedMesh(lumpG, new THREE.MeshStandardMaterial({ color: 0x3a3634, roughness: 0.6 }), 50);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), rc = lcg(55);
  let nc = 0, nb = 0;
  for (let i = 0; i < 120; i++) {
    const a = rc() * TAU, d = 48 + Math.pow(rc(), 0.7) * 260, x = Math.cos(a) * d, z = Math.sin(a) * d * 0.9 + 20, s = 0.5 + rc() * rc() * 3.2;
    if (z < -80) continue;
    e.set(rc() * 0.4, rc() * TAU, rc() * 0.4); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, s * 0.25, z), q, new THREE.Vector3(s * (1 + rc()), s, s));
    if (rc() < 0.6 && nc < 70) coral.setMatrixAt(nc++, m4); else if (nb < 50) bits.setMatrixAt(nb++, m4);
  }
  coral.count = nc; bits.count = nb; for (const im of [coral, bits]) { im.castShadow = quality > 0; im.receiveShadow = true; g.add(im); }
  // a fallen coconut-palm frond lying on the sand (flat leaflets along a curved rib)
  // plumeria blossoms fallen on the sand
  const pg = plumeriaGeo(), pm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  const rp = lcg(31), m5 = new THREE.Matrix4(), q5 = new THREE.Quaternion(), e5 = new THREE.Euler();
  const fl = new THREE.InstancedMesh(pg, pm, 9); let nf = 0;
  for (const [x, z] of [[-36, 30], [-31, 34], [30, 33], [41, -16], [-44, -12], [22, 40], [-12, 38], [46, 22], [-40, 8]]) {
    e5.set((rp() - 0.5) * 0.3, rp() * TAU, (rp() - 0.5) * 0.3); q5.setFromEuler(e5); const s = 0.9 + rp() * 0.3;
    fl.setMatrixAt(nf++, m5.compose(new THREE.Vector3(x + rp() * 6, 0.35, z + rp() * 6), q5, new THREE.Vector3(s, s, s)));
  }
  fl.castShadow = true; fl.receiveShadow = true; g.add(fl);
  return { group: g, sky, sea, seaBump: seaB, foam, foamT };
}

// A plumeria blossom: five overlapping waxy petals, white with a yellow throat (vertex colours).
function plumeriaGeo() {
  const parts = [], col = [];
  for (let k = 0; k < 5; k++) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(2.2, -0.6, 3.9, 0.6, 3.5, 2.2); sh.bezierCurveTo(3.0, 3.6, 0.6, 3.0, 0, 0);
    const g = new THREE.ShapeGeometry(sh, 6); g.rotateX(-Math.PI / 2); g.rotateZ(-0.12); g.rotateY(k * TAU / 5);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const d = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, 0.12 * d * d * 0.18 + k * 0.02); const t = Math.min(1, d / 1.6); col.push(1, 0.82 + 0.17 * t, 0.35 + 0.6 * t); }
    parts.push(g);
  }
  let n = 0; parts.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), idx = []; let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); for (const i of g.index.array) idx.push(i + o); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.setIndex(idx); out.computeVertexNormals();
  return out;
}

// A calabash bowl ('umeke) turned from wood, with a heap of pebbles of one colour.
export function buildBowl(kind, geos, mats, count, seed) {
  const g = new THREE.Group(), prof = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16, a = t * Math.PI * 0.62; prof.push(new THREE.Vector2(Math.sin(a) * 11 + 0.01, (1 - Math.cos(a)) * 10)); }
  for (let i = 16; i >= 0; i--) { const t = i / 16, a = t * Math.PI * 0.62; prof.push(new THREE.Vector2(Math.max(0.01, Math.sin(a) * 10.2), (1 - Math.cos(a)) * 10 + 0.9)); }
  const wc = canvas(512, 256), wx = wc.getContext('2d'), r = lcg(seed);
  wx.fillStyle = '#7a3f1e'; wx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 220; i++) { const y = r() * 256; wx.strokeStyle = r() < 0.5 ? `rgba(40,16,6,${0.15 + r() * 0.3})` : `rgba(210,140,80,${0.08 + r() * 0.16})`; wx.lineWidth = 0.6 + r() * 2.2; wx.beginPath(); wx.moveTo(0, y); for (let x = 0; x <= 512; x += 32) wx.lineTo(x, y + Math.sin(x * 0.02 + i) * (3 + r() * 6)); wx.stroke(); }
  const wt = new THREE.CanvasTexture(wc); wt.colorSpace = THREE.SRGBColorSpace;
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), new THREE.MeshPhysicalMaterial({ map: wt, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3, side: THREE.DoubleSide }));
  bowl.castShadow = true; bowl.receiveShadow = true; g.add(bowl);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let v = 0; v < 3; v++) {
    const im = new THREE.InstancedMesh(geos[kind][v], mats[kind], count); let k = 0;
    for (let i = v; i < count * 3; i += 3) {
      const a = i * 2.39996, d = Math.sqrt(i / (count * 3)) * 8.2, y = 7.6 + Math.cos(d / 8.6 * 1.5) * 3.4 + (hash(i, seed) * 0.6);
      e.set((hash(i, 2) - 0.5) * 0.7, hash(i, 3) * TAU, (hash(i, 4) - 0.5) * 0.7); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(Math.cos(a) * d, y, Math.sin(a) * d), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(k++, m4);
    }
    im.count = k; im.castShadow = true; im.receiveShadow = true; g.add(im);
  }
  return g;
}

// Lights for golden hour: the low sun (shadows), sky fill, warm bounce from the sand, a cool rim from the sea side.
export function buildLights(scene) {
  const sun = new THREE.DirectionalLight(0xffb979, 3.4); sun.position.copy(SUN_DIR).multiplyScalar(160); sun.target.position.set(0, 0, 0);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 20, far: 400 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  const hemi = new THREE.HemisphereLight(0x8f9cc8, 0x8a5c3c, 0.5);
  const fill = new THREE.DirectionalLight(0xffc8a0, 0.35); fill.position.set(-80, 70, 120);
  const rim = new THREE.DirectionalLight(0xffa070, 0.9); rim.position.set(-60, 30, -140);
  scene.add(sun, sun.target, hemi, fill, rim);
  return { sun, hemi, fill, rim };
}

// Soft radial texture for contact blobs, dust and glow marks.
export function radialTex(rgb = '0,0,0', a = 1, inner = 0) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 64 * inner, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${inner ? 0 : a})`); if (inner) g.addColorStop(Math.min(0.95, inner + 0.12), `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
