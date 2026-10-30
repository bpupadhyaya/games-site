// Russian Loto 3D world: procedural textures and turned geometry (no image files). Units are centimetres; the table top is y = 0.
// Kegs are small turned birch casks standing on end with the number burned into the end grain (as on real sets); chips are lacquered
// discs; the bag is a gathered linen sack with a drawstring; the cards are printed card stock; the room is a parlour table under a lamp.
import * as THREE from '../vendor3d/three.js';

const TAU = Math.PI * 2;
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep = 1, srgb = true) => {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
};

// ---- textures ------------------------------------------------------------------------------------------------------------------
// Theme cloth on the table: felt (green baize), midnight (blue velvet), samovar (red tablecloth with a woven border).
export const CLOTH = {
  felt: { base: '#1d5a3f', dark: '#0f3324', hi: '#2c7a56', border: '#c9a45a', wood: '#5a3418', wall: '#2a3a2c', wallHi: '#5d6e4c' },
  midnight: { base: '#1d3a78', dark: '#0d1c40', hi: '#2f56a8', border: '#d8c27a', wood: '#3a2414', wall: '#1c2440', wallHi: '#46557e' },
  samovar: { base: '#7a1f1c', dark: '#3e0d0c', hi: '#9c3226', border: '#e8c66a', wood: '#5e3216', wall: '#3b1714', wallHi: '#7a4a2a' },
};
export function clothTexture(look) {
  const L = CLOTH[look] || CLOTH.felt, c = canvas(512, 512), x = c.getContext('2d'); seed = 7;
  x.fillStyle = L.base; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26000; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.07)'; x.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2.2, 1); }
  for (let i = 0; i < 1800; i++) { x.strokeStyle = 'rgba(0,0,0,0.05)'; const a = rnd() * 512, b = rnd() * 512; x.beginPath(); x.moveTo(a, b); x.lineTo(a + rnd() * 9 - 4, b + rnd() * 9 - 4); x.stroke(); }
  return tex(c, 1);
}
export function bumpNoise(size = 256, k = 0.5) {
  const c = canvas(size, size), x = c.getContext('2d'); seed = 3;
  x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.6; i++) { const v = Math.floor(128 + (rnd() - 0.5) * 255 * k); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(rnd() * size, rnd() * size, 1.5, 1.5); }
  return tex(c, 1, false);
}
// birch / beech for the kegs: pale, fine straight grain running along the cask
export function kegWoodTexture() {
  const c = canvas(256, 512), x = c.getContext('2d'); seed = 11;
  const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, '#e9cf9c'); g.addColorStop(0.5, '#f3ddb0'); g.addColorStop(1, '#e2c28a');
  x.fillStyle = g; x.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 70; i++) { const px = rnd() * 256, w = 0.6 + rnd() * 1.8; x.strokeStyle = `rgba(${140 + rnd() * 40},${90 + rnd() * 30},40,${0.08 + rnd() * 0.14})`; x.lineWidth = w; x.beginPath(); x.moveTo(px, 0); for (let y = 0; y <= 512; y += 32) x.lineTo(px + Math.sin(y * 0.02 + i) * 2.5, y); x.stroke(); }
  // two turned bands burned in near the ends (v = 0.17 and 0.83 of the height)
  for (const v of [0.16, 0.84]) { x.fillStyle = 'rgba(110,40,22,0.75)'; x.fillRect(0, 512 * v - 7, 256, 14); x.fillStyle = 'rgba(255,230,190,0.35)'; x.fillRect(0, 512 * v - 7, 256, 2.5); }
  const t = tex(c, 1); t.repeat.set(2, 1); return t;
}
// The number atlas: the end grain of every keg (1..90), 10 x 9 cells, the number burned in dark red-brown, 6 and 9 underlined.
export function numberAtlas(numFont) {
  const S = 128, c = canvas(S * 10, S * 9), x = c.getContext('2d'); seed = 19;
  for (let n = 1; n <= 90; n++) {
    const cx = ((n - 1) % 10) * S + S / 2, cy = Math.floor((n - 1) / 10) * S + S / 2;
    const g = x.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, S * 0.55); g.addColorStop(0, '#f7e2b8'); g.addColorStop(0.75, '#e6c58c'); g.addColorStop(1, '#b98a4e');
    x.fillStyle = g; x.fillRect(cx - S / 2, cy - S / 2, S, S);
    x.strokeStyle = 'rgba(150,100,50,0.22)'; x.lineWidth = 1.2;
    const ox = (rnd() - 0.5) * 18, oy = (rnd() - 0.5) * 18;
    for (let r = 6; r < S * 0.7; r += 6 + rnd() * 5) { x.beginPath(); x.ellipse(cx + ox, cy + oy, r, r * (0.92 + rnd() * 0.1), rnd(), 0, TAU); x.stroke(); }
    const s = String(n), fs = s.length > 1 ? 66 : 80;
    x.font = `800 ${fs}px ${numFont}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,240,210,0.6)'; x.fillText(s, cx + 1.5, cy + 3.5);
    x.fillStyle = '#3a1208'; x.fillText(s, cx, cy + 2);
    if (n === 6 || n === 9 || n === 66 || n === 69) x.fillRect(cx - fs * 0.3, cy + fs * 0.45, fs * 0.6, 6);
    x.strokeStyle = 'rgba(90,40,18,0.5)'; x.lineWidth = 5; x.beginPath(); x.arc(cx, cy, S * 0.47, 0, TAU); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// Woven linen for the bag.
export function linenTexture() {
  const c = canvas(256, 256), x = c.getContext('2d'); seed = 23;
  x.fillStyle = '#d9c393'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 3) { x.fillStyle = `rgba(120,90,40,${0.08 + rnd() * 0.1})`; x.fillRect(0, i, 256, 1.2); x.fillStyle = `rgba(255,245,215,${0.08 + rnd() * 0.08})`; x.fillRect(i, 0, 1.2, 256); }
  for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(110,80,30,0.12)'; x.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 10, 1.4); }
  return tex(c, 1);
}
// Polished table wood (walnut planks) for the rim and the floor parquet.
export function plankTexture(color, w = 512, planks = 4) {
  const c = canvas(w, w), x = c.getContext('2d'); seed = 31;
  x.fillStyle = color; x.fillRect(0, 0, w, w);
  const pw = w / planks;
  for (let p = 0; p < planks; p++) {
    x.fillStyle = `rgba(${rnd() < 0.5 ? '255,220,170' : '0,0,0'},${0.04 + rnd() * 0.08})`; x.fillRect(p * pw, 0, pw, w);
    for (let i = 0; i < 26; i++) { const px = p * pw + rnd() * pw; x.strokeStyle = `rgba(30,12,4,${0.08 + rnd() * 0.14})`; x.lineWidth = 0.6 + rnd() * 1.6; x.beginPath(); x.moveTo(px, 0); for (let y = 0; y <= w; y += 24) x.lineTo(px + Math.sin(y * 0.013 + i * 2) * 4, y); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(p * pw, 0, 1.5, w);
    const cut = rnd() * w; x.fillRect(p * pw, cut, pw, 1.2);
  }
  return tex(c, 1);
}
// Parlour wallpaper: a quiet damask lozenge over a deep ground.
export function wallTexture(look) {
  const L = CLOTH[look] || CLOTH.felt, c = canvas(256, 256), x = c.getContext('2d');
  x.fillStyle = L.wall; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = L.wallHi; x.globalAlpha = 0.35; x.lineWidth = 2;
  for (const [ox, oy] of [[0, 0], [128, 128], [256, 0], [0, 256], [256, 256]]) { x.beginPath(); x.ellipse(ox, oy, 40, 62, 0, 0, TAU); x.stroke(); x.beginPath(); x.ellipse(ox, oy, 14, 26, 0, 0, TAU); x.stroke(); }
  x.globalAlpha = 1; return tex(c, 1);
}
// Paper grain + a soft darker edge, laid over each printed card.
let paperNoise = null;
export function paperGrain() {
  if (paperNoise) return paperNoise;
  const c = canvas(128, 128), x = c.getContext('2d'); seed = 41;
  for (let i = 0; i < 2600; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(90,60,20,0.07)'; x.fillRect(rnd() * 128, rnd() * 128, 1 + rnd(), 1 + rnd()); }
  paperNoise = c; return c;
}
export function radialTex(rgb, a = 0.8, inner = 0) {
  const c = canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, inner * 64, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${inner ? 0 : a})`); if (inner) g.addColorStop(0.5, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

// ---- geometry ---------------------------------------------------------------------------------------------------------------------
export const KEG_TALL = 1.25;   // real kegs are a little taller than wide (about 2.2 x 1.7 cm)
// Keg: unit height 1 (x KEG_TALL) standing on y = 0, belly radius 0.47, ends 0.4, a small chamfer, end-grain caps separate (they carry the number).
export function kegGeometry() {
  const pts = [], N = 22;
  pts.push(new THREE.Vector2(0.001, 0.0), new THREE.Vector2(0.36, 0.0), new THREE.Vector2(0.4, 0.025));
  for (let i = 0; i <= N; i++) { const v = 0.04 + 0.92 * i / N, b = 1 - Math.pow((v - 0.5) / 0.46, 2); pts.push(new THREE.Vector2(0.4 + 0.075 * b, v)); }
  pts.push(new THREE.Vector2(0.4, 0.975), new THREE.Vector2(0.36, 1.0), new THREE.Vector2(0.001, 1.0));
  const g = new THREE.LatheGeometry(pts, 40); g.scale(1, KEG_TALL, 1); g.computeVertexNormals(); return g;
}
export function capGeometry(n) {
  const g = new THREE.CircleGeometry(0.37, 36); g.rotateX(-Math.PI / 2); g.translate(0, KEG_TALL + 0.002, 0);
  const uv = g.attributes.uv, col = (n - 1) % 10, row = Math.floor((n - 1) / 10);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + 0.04 + uv.getX(i) * 0.92) / 10, 1 - (row + 0.04 + (1 - uv.getY(i)) * 0.92) / 9);
  return g;
}
// Chip: a lacquered disc 1 across, 0.16 thick with a rounded edge and a shallow ring on top.
export function chipGeometry() {
  const p = [[0.001, 0], [0.44, 0], [0.49, 0.03], [0.5, 0.08], [0.49, 0.13], [0.44, 0.16], [0.36, 0.16], [0.33, 0.145], [0.3, 0.16], [0.001, 0.16]].map(([a, b]) => new THREE.Vector2(a, b));
  const g = new THREE.LatheGeometry(p, 32); g.computeVertexNormals(); return g;
}
// Linen bag: unit height, gathered neck at 0.8, a frilled mouth, folds and lumps of kegs pressing through.
export function bagGeometry() {
  const pts = [];
  const prof = [[0.001, 0], [0.3, 0.005], [0.42, 0.05], [0.47, 0.18], [0.46, 0.38], [0.4, 0.56], [0.28, 0.7], [0.14, 0.8], [0.115, 0.85], [0.14, 0.9], [0.17, 0.95], [0.15, 0.985], [0.1, 0.975]];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 48), pos = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); const a = Math.atan2(v.z, v.x), r = Math.hypot(v.x, v.z), y = v.y;
    let k = 1 + 0.035 * Math.sin(a * 7 + y * 6) * Math.min(1, y * 3) + 0.05 * Math.max(0, Math.sin(a * 3 + 1.3) * Math.sin(y * 9)) * (y < 0.6 ? 1 : 0);
    if (y > 0.76 && y < 0.88) k *= 1 + 0.12 * Math.sin(a * 14);          // gathered folds at the neck
    if (y > 0.88) k *= 1 + 0.08 * Math.sin(a * 11 + 0.5);               // frilled mouth
    pos.setXYZ(i, Math.cos(a) * r * k, y, Math.sin(a) * r * k);
  }
  g.computeVertexNormals(); return g;
}
// Card slab: unit square (x, z in -0.5..0.5), thickness t (cm) along y, rounded corners; group 0 = faces, 1 = edges.
export function cardGeometry(t = 0.16, rad = 0.02) {
  const s = new THREE.Shape(), h = 0.5;
  s.moveTo(-h + rad, -h); s.lineTo(h - rad, -h); s.quadraticCurveTo(h, -h, h, -h + rad); s.lineTo(h, h - rad); s.quadraticCurveTo(h, h, h - rad, h);
  s.lineTo(-h + rad, h); s.quadraticCurveTo(-h, h, -h, h - rad); s.lineTo(-h, -h + rad); s.quadraticCurveTo(-h, -h, -h + rad, -h);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.5, uv.getY(i) + 0.5);
  return g;
}
// Tray: a shallow turned-wood dish (unit footprint 1 x 1 scaled per tray) with a felt bed.
export function trayGeometry() {
  const outer = new THREE.Shape(), inner = new THREE.Path(), h = 0.5, r = 0.14, k = 0.42, ri = 0.1;
  const rr = (p, a, b, rad) => { p.moveTo(-a + rad, -b); p.lineTo(a - rad, -b); p.quadraticCurveTo(a, -b, a, -b + rad); p.lineTo(a, b - rad); p.quadraticCurveTo(a, b, a - rad, b); p.lineTo(-a + rad, b); p.quadraticCurveTo(-a, b, -a, b - rad); p.lineTo(-a, -b + rad); p.quadraticCurveTo(-a, -b, -a + rad, -b); };
  rr(outer, h, h, r); rr(inner, k, k, ri); outer.holes.push(inner);
  const g = new THREE.ExtrudeGeometry(outer, { depth: 1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2); return g;
}
// Tea glass in a filigree holder (podstakannik) and a small brass samovar for the parlour still life.
export function teaGlass(mats) {
  const grp = new THREE.Group();
  const holder = new THREE.LatheGeometry([[0.001, 0], [3.3, 0], [3.5, 0.4], [3.2, 1.0], [3.5, 5.5], [3.8, 6.2], [3.7, 6.5]].map(([a, b]) => new THREE.Vector2(a, b)), 40);
  const glass = new THREE.LatheGeometry([[0.001, 0.6], [3.1, 0.6], [3.3, 6], [3.45, 10.5], [3.3, 10.6]].map(([a, b]) => new THREE.Vector2(a, b)), 40);
  const tea = new THREE.CylinderGeometry(3.25, 3.05, 7.6, 32); tea.translate(0, 4.6, 0);
  const handle = new THREE.TorusGeometry(2.2, 0.35, 10, 24, Math.PI * 1.1); handle.rotateZ(-Math.PI * 0.55); handle.translate(4.6, 3.6, 0);
  const spoon = new THREE.CylinderGeometry(0.18, 0.14, 13, 8); spoon.rotateZ(0.22); spoon.translate(1.2, 9, 0.6);
  for (const [geo, m] of [[holder, mats.silver], [glass, mats.glass], [tea, mats.tea], [handle, mats.silver], [spoon, mats.silver]]) { const o = new THREE.Mesh(geo, m); o.castShadow = m !== mats.glass; o.receiveShadow = true; grp.add(o); }
  return grp;
}
export function samovar(mats) {
  const grp = new THREE.Group();
  const body = new THREE.LatheGeometry([[0.001, 0], [7, 0], [7.4, 1.2], [5, 3], [4.2, 7], [9.5, 12], [11, 20], [10.5, 27], [7, 31], [6.5, 33], [3.4, 34], [3.2, 38], [4.6, 39], [3.6, 40.5], [0.001, 41]].map(([a, b]) => new THREE.Vector2(a, b)), 48);
  const m = new THREE.Mesh(body, mats.brass); m.castShadow = true; m.receiveShadow = true; grp.add(m);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.55, 10, 20, Math.PI), mats.brass); h.rotation.y = s > 0 ? 0 : Math.PI; h.position.set(s * 10.6, 26, 0); h.rotation.z = s * Math.PI / 2; grp.add(h); }
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.5, 6, 10), mats.brass); tap.rotation.x = Math.PI / 2.4; tap.position.set(0, 10, 11); grp.add(tap);
  const pot = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [4, 0], [5.5, 3], [5, 7], [2.2, 8.5], [0.001, 9]].map(([a, b]) => new THREE.Vector2(a, b)), 32), mats.china);
  pot.position.y = 41; pot.castShadow = true; grp.add(pot);
  return grp;
}
