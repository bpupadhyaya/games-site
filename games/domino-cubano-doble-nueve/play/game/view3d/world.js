// Domino park at dusk, built from code (no image files): a painted terracotta concrete table with a turquoise band, bone dominoes
// with engraved pips, brass lanterns, a dusk ground with warm bokeh. World unit = 1 cm. The presenter
// (presenter.js) puts the 2D layout plane on the table; everything here is plain geometry, canvas textures and lights.
import * as THREE from '../vendor3d/three.js';
import { slab, material, lathe } from '../vendor3d/board3d.js';

const TAU = Math.PI * 2;
export const TABLE_TOP = 0;          // y of the table surface
export const TILE_ASPECT = 82 / 55;  // rack tile height / width in the 2D layout

const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, rep) => {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
};
export function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function radialTex(rgb = '255,255,255', a = 1) {
  const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}

// ------------------------------------------------------------------------------------------------ dominoes
const PIPS = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8], [0, 2, 3, 4, 5, 6, 8], [0, 1, 2, 3, 5, 6, 7, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8]];
const TW = 192, TH = 288;   // face texture px (a 55:82 tile is ~2:3)

function pipsIn(x, cx, cy, w, h, n) {
  const cell = Math.min(w, h) / 3.35, r = cell * 0.36;
  for (const k of PIPS[n]) {
    const px = cx + ((k % 3) - 1) * cell, py = cy + (Math.floor(k / 3) - 1) * cell;
    // engraved pip: dark hole with a lit lower rim
    const rim = x.createRadialGradient(px, py, r * 0.4, px, py, r * 1.28);
    rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(0.78, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(255,255,255,0.55)');
    x.fillStyle = rim; x.beginPath(); x.arc(px + r * 0.12, py + r * 0.16, r * 1.28, 0, TAU); x.fill();
    const g = x.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
    g.addColorStop(0, '#3a3d41'); g.addColorStop(0.55, '#0f1113'); g.addColorStop(1, '#050607');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
  }
}
function ivoryFill(x, seed) {
  const g = x.createLinearGradient(0, 0, TW, TH);
  g.addColorStop(0, '#fbf6e8'); g.addColorStop(0.6, '#f0e8d2'); g.addColorStop(1, '#e2d8bc');
  x.fillStyle = g; x.fillRect(0, 0, TW, TH);
  const r = rngOf(seed);
  for (let i = 0; i < 700; i++) { x.fillStyle = r() < 0.5 ? 'rgba(120,96,50,0.045)' : 'rgba(255,255,255,0.06)'; x.fillRect(r() * TW, r() * TH, 1 + r() * 3, 1 + r() * 2); }
}
// canvas top = the far (screen-up) side of the tile, so face "a" sits on top; flipY is off
export function faceCanvas(a, b) {
  const c = cv(TW, TH), x = c.getContext('2d');
  ivoryFill(x, a * 31 + b * 7 + 3);
  // routed groove across the middle, lit on one edge
  x.fillStyle = 'rgba(70,52,28,0.5)'; x.fillRect(TW * 0.09, TH / 2 - 2, TW * 0.82, 4);
  x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(TW * 0.09, TH / 2 + 2, TW * 0.82, 2);
  // brass pin in the middle
  const bp = x.createRadialGradient(TW / 2 - 2, TH / 2 - 2, 1, TW / 2, TH / 2, 9);
  bp.addColorStop(0, '#fff0b0'); bp.addColorStop(0.6, '#c99a3a'); bp.addColorStop(1, '#6b4a14');
  x.fillStyle = bp; x.beginPath(); x.arc(TW / 2, TH / 2, 8, 0, TAU); x.fill();
  pipsIn(x, TW / 2, TH * 0.25, TW, TH / 2, a);
  pipsIn(x, TW / 2, TH * 0.75, TW, TH / 2, b);
  return c;
}
export function backCanvas() {
  const c = cv(TW, TH), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, TW, TH); g.addColorStop(0, '#12504a'); g.addColorStop(1, '#0a2f2c');
  x.fillStyle = g; x.fillRect(0, 0, TW, TH);
  const r = rngOf(11); for (let i = 0; i < 500; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.09)'; x.fillRect(r() * TW, r() * TH, 2, 1 + r() * 3); }
  x.strokeStyle = '#c99a3a'; x.lineWidth = 5; x.strokeRect(16, 16, TW - 32, TH - 32);
  x.strokeStyle = 'rgba(201,154,58,0.6)'; x.lineWidth = 2; x.strokeRect(28, 28, TW - 56, TH - 56);
  x.fillStyle = '#c99a3a'; x.save(); x.translate(TW / 2, TH / 2); x.rotate(Math.PI / 4); x.fillRect(-18, -18, 36, 36); x.restore();
  x.fillStyle = '#0a2f2c'; x.save(); x.translate(TW / 2, TH / 2); x.rotate(Math.PI / 4); x.fillRect(-10, -10, 20, 20); x.restore();
  return c;
}

let tileGeo = null;
/** Unit tile: footprint 1 x 1 (scaled by the presenter to the layout rectangle), thickness 1 (scaled to the tile's real thickness). */
export function tileGeometry() { if (!tileGeo) tileGeo = slab(1, 1, 1, 0.16, 0.09, { seg: 3, per: 5 }); return tileGeo; }

const faceCache = new Map();
export function tileMaterial(a, b) {
  const key = a < 0 ? 'back' : `${a}-${b}`;
  let m = faceCache.get(key); if (m) return m;
  const t = tex(a < 0 ? backCanvas() : faceCanvas(a, b)); t.flipY = false;
  m = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.34, metalness: 0, clearcoat: a < 0 ? 0.8 : 0.5, clearcoatRoughness: 0.18, envMapIntensity: 0.9 });
  faceCache.set(key, m); return m;
}
export function disposeTileMaterials() { for (const m of faceCache.values()) { m.map.dispose(); m.dispose(); } faceCache.clear(); }

// ------------------------------------------------------------------------------------------------ the table
function tableCanvas(size, w, d) {
  const c = cv(size), x = c.getContext('2d'), r = rngOf(7);
  // painted terracotta concrete
  const g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, '#b4592f'); g.addColorStop(0.5, '#a24d29'); g.addColorStop(1, '#8c4023');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 22000; i++) { const v = r(); x.fillStyle = v < 0.4 ? 'rgba(60,20,8,0.07)' : v < 0.8 ? 'rgba(255,200,150,0.05)' : 'rgba(255,255,255,0.05)'; x.fillRect(r() * size, r() * size, 1 + r() * 4, 1 + r() * 3); }
  // large soft stains and worn patches where hands rest
  for (let i = 0; i < 26; i++) { const px = r() * size, py = r() * size, rr = size * (0.04 + r() * 0.12), gg = x.createRadialGradient(px, py, 0, px, py, rr); gg.addColorStop(0, r() < 0.5 ? 'rgba(255,190,140,0.10)' : 'rgba(50,16,6,0.10)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  // hairline cracks
  x.strokeStyle = 'rgba(40,14,6,0.28)'; x.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) { let px = r() * size, py = r() * size; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 9; k++) { px += (r() - 0.5) * 70; py += (r() - 0.3) * 60; x.lineTo(px, py); } x.stroke(); }
  // painted park-table motif: a big ring with a diamond ring inside it, in cream and turquoise, faded where the paint has worn
  const cx = size / 2, cy = size / 2;
  x.save(); x.globalAlpha = 0.85;
  x.strokeStyle = 'rgba(245,236,216,0.55)'; x.lineWidth = size * 0.006; x.beginPath(); x.arc(cx, cy, size * 0.36, 0, TAU); x.stroke();
  x.strokeStyle = 'rgba(43,181,160,0.6)'; x.lineWidth = size * 0.012; x.beginPath(); x.arc(cx, cy, size * 0.345, 0, TAU); x.stroke();
  x.strokeStyle = 'rgba(245,236,216,0.4)'; x.lineWidth = size * 0.004;
  for (let i = 0; i < 24; i++) { const a = i * TAU / 24, r0 = size * 0.37, r1 = size * 0.405; x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); x.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); x.stroke(); }
  x.restore();
  // turquoise painted border band and a thin cream line inside it (the pixel scale is size / table size)
  const bw = size * 0.035, inset = size * 0.012;
  x.strokeStyle = '#2bb5a0'; x.lineWidth = bw; x.strokeRect(inset + bw / 2, inset + bw / 2, size - 2 * inset - bw, size - 2 * inset - bw);
  x.strokeStyle = 'rgba(245,236,216,0.8)'; x.lineWidth = size * 0.005; x.strokeRect(inset + bw * 1.5, inset + bw * 1.5, size - 2 * (inset + bw * 1.5), size - 2 * (inset + bw * 1.5));
  return c;
}
/** A table slab w x d (cm), top at y = 0. The turquoise band is painted on the top texture; the sides are plain painted concrete. */
export function buildTable(w, d, texSize = 1024) {
  const grp = new THREE.Group();
  const t = tex(tableCanvas(texSize, w, d));
  const top = new THREE.MeshStandardMaterial({ map: t, roughness: 0.78, metalness: 0, envMapIntensity: 0.55 });
  const geo = slab(w, d, 9, 2.2, 1.0, { seg: 3, per: 6 });
  const m = new THREE.Mesh(geo, top); m.position.y = -9; m.receiveShadow = true; m.castShadow = true; grp.add(m);
  // a pedestal in the dark below, so the slab does not float
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 70, 20), new THREE.MeshStandardMaterial({ color: 0x20252b, roughness: 0.6, metalness: 0.6 }));
  ped.position.y = -9 - 35; grp.add(ped);
  grp.userData.dispose = () => t.dispose();
  return grp;
}

// ------------------------------------------------------------------------------------------------ props
/** Brass hurricane lantern with a warm flame; userData.light drives the flicker. */
export function buildLantern() {
  const g = new THREE.Group();
  const brass = material('brass', { roughness: 0.3 });
  const base = new THREE.Mesh(lathe([[0, 0], [2.6, 0], [2.7, 0.5], [2.2, 1.1], [0, 1.1]], 28), brass);
  const cap = new THREE.Mesh(lathe([[0, 9.2], [2.5, 9.2], [2.2, 10.2], [0.7, 11.6], [0.5, 12.4], [0.8, 12.9], [0, 13]], 28), brass);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 8.1, 28, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffd9a0, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = 5.15;
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 12), flameMat); flame.scale.set(0.8, 1.9, 0.8); flame.position.y = 3.3;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,176,92', 0.75), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(14, 14, 1); halo.position.y = 4.5;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x222222 })); wick.position.y = 1.8;
  const light = new THREE.PointLight(0xffa04a, 0, 150, 1.4); light.position.y = 5;
  for (const p of [base, cap]) { p.castShadow = false; p.receiveShadow = true; }
  g.add(base, cap, glass, flame, halo, wick, light);
  // four brass posts
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 8.2, 8), brass); const a = i * TAU / 4 + 0.78; p.position.set(Math.cos(a) * 2.35, 5.2, Math.sin(a) * 2.35); g.add(p); }
  g.userData = { light, flame, halo };
  return g;
}
// ------------------------------------------------------------------------------------------------ ground, sky, lights
export function skyTexture() {
  const c = cv(8, 512), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#1a1138'); g.addColorStop(0.12, '#3d2552'); g.addColorStop(0.22, '#8a3f4a'); g.addColorStop(0.3, '#d9784a'); g.addColorStop(0.36, '#f0b062'); g.addColorStop(0.4, '#2a1810'); g.addColorStop(1, '#120a0c');
  x.fillStyle = g; x.fillRect(0, 0, 8, 512);
  const t = tex(c); return t;
}
export function buildGround() {
  const c = cv(512), x = c.getContext('2d'), r = rngOf(5);
  x.fillStyle = '#2a2224'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,230,200,0.05)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3); }
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 512); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(512, i * 64); x.stroke(); }
  const t = tex(c, true, [14, 14]);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, envMapIntensity: 0.3 }));
  m.rotation.x = -Math.PI / 2; m.position.y = -79; m.receiveShadow = true;
  return m;
}
/** Warm out-of-focus string lights (sprites). Each is anchored to a spot of the screen (userData.nx, ny in NDC); the presenter re-aims them
 * every frame so they hang in the dusk above the far edge of the table whatever the camera does. */
export function buildBokeh(count = 30) {
  const g = new THREE.Group(), r = rngOf(21), map = radialTex('255,205,130', 0.9);
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.25 + r() * 0.35, fog: false }));
    const k = i / (count - 1);
    s.userData = { nx: -1.05 + k * 2.1 + (r() - 0.5) * 0.06, ny: 0.86 + Math.sin(k * Math.PI) * -0.1 + (r() - 0.5) * 0.12, size: 0.045 + r() * 0.07, base: s.material.opacity };
    g.add(s);
  }
  return g;
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0x8ea6d8, 0x4a2a1c, 0.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd2a0, 2.3); sun.position.set(-40, 90, 50);
  const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 60; sc.bottom = -60; sc.near = 20; sc.far = 300;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  const rim = new THREE.DirectionalLight(0x6fa8ff, 0.7); rim.position.set(60, 50, -90); scene.add(rim);
  return { hemi, sun, rim };
}
