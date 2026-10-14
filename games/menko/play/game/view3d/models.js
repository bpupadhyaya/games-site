// Menko 3D models: the thick printed card discs, the little wooden play tray with its woven rush mat, and an engawa veranda at
// dusk (cypress planks, lit shoji, paper lanterns, a garden beyond). Pure scene construction: no sim access.
// Units: 1 = 1/100 of the floor (floor 640 -> 6.4 world units). A disc is 6 cm across in life, so one unit is about 6.8 mm.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { drawFloor, drawDisc } from '../src/art.js';
import { FLOOR, R as DISC_R } from '../src/sim.js';

export const U = 0.01;                       // floor unit -> world
export const HALF = (FLOOR * U) / 2;
export const DR = DISC_R * U;                // disc radius 0.44
export const TH = 0.085;                     // disc thickness (a thick printed card)
const TAU = Math.PI * 2;
export const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
export const canvasTex = (c, { srgb = true, repeat, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};
export const blobCanvas = (rgb = '0,0,0', a = 0.6, size = 128) => {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.55, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
};
export const ringCanvas = (rgb = '255,255,255', size = 128, inner = 0.7) => {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, size * 0.5 * inner * 0.75, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(inner, `rgba(${rgb},0.95)`); g.addColorStop(Math.min(0.97, inner + 0.16), `rgba(${rgb},0.35)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
};
// a thin ring (radius 0.46 of the quad) with n dashes: the scatter circle / cover zone markers
export const dashCanvas = (rgb = '255,255,255', n = 28, size = 256, fill = 0.55, lw = 0.028) => {
  const c = cv(size), x = c.getContext('2d'); x.translate(size / 2, size / 2);
  x.strokeStyle = `rgb(${rgb})`; x.lineWidth = size * lw; x.lineCap = 'round';
  const r = size * 0.46;
  for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU, a1 = a0 + (TAU / n) * fill; x.beginPath(); x.arc(0, 0, r, a0, a1); x.stroke(); }
  return c;
};
export const solidRing = (rgb = '255,255,255', size = 256, lw = 0.03) => {
  const c = cv(size), x = c.getContext('2d'); x.translate(size / 2, size / 2);
  x.strokeStyle = `rgb(${rgb})`; x.lineWidth = size * lw; x.beginPath(); x.arc(0, 0, size * 0.46, 0, TAU); x.stroke();
  const g = x.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 0.46); g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},0.16)`);
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, size * 0.46, 0, TAU); x.fill();
  return c;
};

// ------------------------------------------------------------------------------------------------ the discs
const faceCache = new Map(), faceTexCache = new Map();
function paperGrain(x, S, seed) {
  const rnd = lcg(seed);
  x.save(); x.beginPath(); x.arc(S / 2, S / 2, S * 0.5, 0, TAU); x.clip();
  for (let k = 0; k < 260; k++) {
    const a = rnd() * TAU, l = 6 + rnd() * 22, px = rnd() * S, py = rnd() * S;
    x.strokeStyle = rnd() < 0.5 ? `rgba(255,252,240,${0.05 + rnd() * 0.08})` : `rgba(90,70,40,${0.03 + rnd() * 0.05})`; x.lineWidth = 0.6 + rnd();
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  // printed halftone dots in the shadow corner, like offset-printed card
  x.fillStyle = 'rgba(40,24,10,0.045)';
  for (let yy = 0; yy < S; yy += 6) for (let xx = (yy / 6 % 2) * 3; xx < S; xx += 6) if ((xx + yy) % 5 < 2) { x.beginPath(); x.arc(xx, yy, 0.9, 0, TAU); x.fill(); }
  x.restore();
}
export function faceCanvas(design, side, back = false, S = 256) {
  const key = `${design}|${side}|${back ? 1 : 0}|${S}`;
  let c = faceCache.get(key);
  if (c) return c;
  c = cv(S); const x = c.getContext('2d');
  drawDisc(x, S / 2, S / 2, design, side, { r: S * 0.5, face: true, ...(back ? { flip: 1 } : {}) });
  paperGrain(x, S, design * 7 + side * 3 + (back ? 5 : 0));
  faceCache.set(key, c); return c;
}
const edgeCanvas = () => {
  const c = cv(256, 32), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 32); g.addColorStop(0, '#fff6e0'); g.addColorStop(1, '#bfae82'); x.fillStyle = g; x.fillRect(0, 0, 256, 32);
  for (let i = 0; i < 9; i++) { x.fillStyle = i % 2 ? 'rgba(120,98,52,0.28)' : 'rgba(255,255,255,0.22)'; x.fillRect(0, 2 + i * 3.4, 256, 1.3); }
  return c;
};
let discGeos = null, edgeMat = null;
const backMats = new Map();
export function discGeoms() {
  if (discGeos) return discGeos;
  const b = 0.022, r = DR;
  // rim: a rounded edge, lathe profile from the bottom face to the top face
  const prof = [[r - b * 1.1, 0], [r - 0.3 * b, 0.004], [r, b * 0.9], [r, TH - b * 0.9], [r - 0.3 * b, TH - 0.004], [r - b * 1.1, TH]];
  const rim = B.lathe(prof, 56);
  const top = new THREE.CircleGeometry(r - b * 1.1, 56); top.rotateX(-Math.PI / 2); top.translate(0, TH + 0.0008, 0);
  const bot = new THREE.CircleGeometry(r - b * 1.1, 56); bot.rotateX(Math.PI / 2); bot.translate(0, -0.0008, 0);
  discGeos = { rim, top, bot };
  const et = canvasTex(edgeCanvas()); et.wrapS = THREE.RepeatWrapping; et.repeat.set(1, 1);
  edgeMat = new THREE.MeshStandardMaterial({ map: et, roughness: 0.78, metalness: 0 });
  return discGeos;
}
export function faceMaterial(design, side, back = false) {
  const key = `${design}|${side}|${back ? 1 : 0}`;
  let m = faceTexCache.get(key);
  if (m) return m;
  const t = canvasTex(faceCanvas(design, side, back, 256));
  m = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.62, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.35, envMapIntensity: 0.35 });
  faceTexCache.set(key, m); return m;
}
// A disc: group origin on the floor under the centre, top face at TH. userData.top is the face mesh (its material is swapped for a
// flipped disc), userData.flipped tells which face is up.
export function makeDisc(design, side) {
  const { rim, top, bot } = discGeoms();
  const g = new THREE.Group();
  const rimM = new THREE.Mesh(rim, edgeMat);
  const topM = new THREE.Mesh(top, faceMaterial(design, side, false));
  const botM = new THREE.Mesh(bot, faceMaterial(design, side, true));
  for (const m of [rimM, topM, botM]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  g.userData = { rim: rimM, top: topM, bot: botM, design, side };
  return g;
}
export function setDiscFace(g, design, side) {
  const u = g.userData;
  if (u.design === design && u.side === side) return;
  u.top.material = faceMaterial(design, side, false); u.bot.material = faceMaterial(design, side, true);
  u.design = design; u.side = side;
}

// ------------------------------------------------------------------------------------------------ tray (the play floor)
function plankCanvas(S = 1024, seed = 5, tint = 1) {
  const c = cv(S), x = c.getContext('2d'), rnd = lcg(seed), n = 6, h = S / n;
  for (let i = 0; i < n; i++) {
    const tone = (0.86 + rnd() * 0.28) * tint;
    const w = B.woodCanvas(512, `rgb(${Math.round(142 * tone)},${Math.round(92 * tone)},${Math.round(46 * tone)})`, `rgb(${Math.round(188 * tone)},${Math.round(128 * tone)},${Math.round(70 * tone)})`, 3 + i * 7, { lines: 70, knots: 1 }).map;
    x.drawImage(w, 0, i * h, S, h);
    x.fillStyle = 'rgba(28,12,4,0.7)'; x.fillRect(0, i * h, S, 3);
    x.fillStyle = 'rgba(255,214,150,0.12)'; x.fillRect(0, i * h + 3, S, 2);
    const cut = rnd() * S; x.fillStyle = 'rgba(28,12,4,0.6)'; x.fillRect(cut, i * h, 3, h);
  }
  return c;
}
export function buildTray(quality = 1) {
  const g = new THREE.Group();
  const P = quality > 0.6 ? 2048 : 1024;
  const fc = cv(P), fx = fc.getContext('2d');
  drawFloor(fx, 0, 0, P);
  const map = canvasTex(fc, { aniso: 16 });
  const mat = new THREE.MeshPhysicalMaterial({ map, roughness: 0.7, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.5, envMapIntensity: 0.25 });
  const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2); geo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(geo, mat); floor.receiveShadow = true; g.add(floor);
  // the frame: dark lacquered cedar with a brass keyline and corner caps
  const FW = 0.62, FH = 0.2, OUT = HALF * 2 + FW * 2;
  const frameMat = B.material('darkWood', { color: '#2a1608', color2: '#4a2a12', repeat: [4, 1], seed: 17 });
  const brass = B.material('brass', { envIntensity: 1.2 });
  const bar = (w, d, x, z) => { const m = new THREE.Mesh(B.slab(w, d, FH, 0.06, 0.05), frameMat); m.position.set(x, -0.02, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  bar(OUT, FW, 0, -HALF - FW / 2); bar(OUT, FW, 0, HALF + FW / 2); bar(FW, HALF * 2, -HALF - FW / 2, 0); bar(FW, HALF * 2, HALF + FW / 2, 0);
  const key = (w, d, x, z) => { const m = new THREE.Mesh(B.slab(w, d, 0.02, 0.01, 0.008), brass); m.position.set(x, FH - 0.03, z); g.add(m); };
  key(HALF * 2 + 0.06, 0.035, 0, -HALF - 0.02); key(HALF * 2 + 0.06, 0.035, 0, HALF + 0.02); key(0.035, HALF * 2 + 0.06, -HALF - 0.02, 0); key(0.035, HALF * 2 + 0.06, HALF + 0.02, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const m = new THREE.Mesh(B.slab(0.5, 0.5, 0.05, 0.12, 0.02), brass); m.position.set(sx * (HALF + FW * 0.52), FH - 0.04, sz * (HALF + FW * 0.52)); g.add(m); }
  g.userData = { OUT, FH, FW, mat, floor, dispose() { map.dispose(); mat.dispose(); geo.dispose(); } };
  return g;
}

// ------------------------------------------------------------------------------------------------ the veranda
function shojiCanvas(w = 512, h = 640, warm = 1) {
  const c = cv(w, h), x = c.getContext('2d'), rnd = lcg(31);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffe7b4'); g.addColorStop(0.55, '#ffd58a'); g.addColorStop(1, '#f2a85a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 420; k++) { x.strokeStyle = `rgba(140,90,30,${0.03 + rnd() * 0.06})`; x.lineWidth = 1; x.beginPath(); const fx = rnd() * w, fy = rnd() * h, a = rnd() * TAU; x.moveTo(fx, fy); x.lineTo(fx + Math.cos(a) * 16, fy + Math.sin(a) * 16); x.stroke(); }
  const gl = x.createRadialGradient(w * 0.5, h * 0.62, 10, w * 0.5, h * 0.62, w * 0.8); gl.addColorStop(0, `rgba(255,248,214,${0.55 * warm})`); gl.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = gl; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#2c180a'; x.lineWidth = 9;
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo((i * w) / 4, 0); x.lineTo((i * w) / 4, h); x.stroke(); }
  for (let j = 0; j <= 6; j++) { x.beginPath(); x.moveTo(0, (j * h) / 6); x.lineTo(w, (j * h) / 6); x.stroke(); }
  x.lineWidth = 16; x.strokeRect(4, 4, w - 8, h - 8);
  return c;
}
function gardenCanvas(w = 1024, h = 512) {
  const c = cv(w, h), x = c.getContext('2d'), rnd = lcg(91);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b2350'); g.addColorStop(0.45, '#3d3f7a'); g.addColorStop(0.75, '#a0638a'); g.addColorStop(1, '#f0a070'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  // distant hills, maple canopies (red/orange blobs), a stone lantern glow, ground
  x.fillStyle = '#2a2a52'; x.beginPath(); x.moveTo(0, h * 0.72); for (let i = 0; i <= 16; i++) x.lineTo((i / 16) * w, h * (0.6 + Math.sin(i * 1.3) * 0.05 + rnd() * 0.04)); x.lineTo(w, h); x.lineTo(0, h); x.fill();
  for (let k = 0; k < 90; k++) {
    const px = rnd() * w, py = h * (0.45 + rnd() * 0.32), r = 26 + rnd() * 54, hue = 8 + rnd() * 32;
    const rg = x.createRadialGradient(px, py, 2, px, py, r); rg.addColorStop(0, `hsla(${hue},78%,${42 + rnd() * 12}%,0.92)`); rg.addColorStop(1, `hsla(${hue},70%,28%,0)`); x.fillStyle = rg; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
  }
  x.fillStyle = '#16122a'; x.fillRect(0, h * 0.86, w, h * 0.14);
  for (const lx of [0.18, 0.78]) {
    const px = lx * w, py = h * 0.8; x.fillStyle = '#26202e'; x.fillRect(px - 5, py - 6, 10, 56); x.fillRect(px - 26, py - 34, 52, 32);
    const gl = x.createRadialGradient(px, py - 18, 2, px, py - 18, 70); gl.addColorStop(0, 'rgba(255,214,130,0.95)'); gl.addColorStop(1, 'rgba(255,170,80,0)'); x.fillStyle = gl; x.beginPath(); x.arc(px, py - 18, 70, 0, TAU); x.fill();
    x.fillStyle = '#ffe3a0'; x.fillRect(px - 12, py - 28, 24, 18);
  }
  return c;
}
function chochinCanvas() {
  const c = cv(128, 256), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, '#b3281a'); g.addColorStop(0.5, '#f0603a'); g.addColorStop(1, '#a8241a'); x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  x.strokeStyle = 'rgba(40,6,2,0.55)'; x.lineWidth = 2; for (let i = 1; i < 14; i++) { x.beginPath(); x.moveTo(0, i * 18.2); x.lineTo(128, i * 18.2); x.stroke(); }
  x.fillStyle = 'rgba(255,240,210,0.9)'; x.font = '700 64px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('祭', 64, 128);
  return c;
}

export function buildRoom({ quality = 1 } = {}) {
  const g = new THREE.Group();
  // engawa deck (planks run left-right); the tray stands on it
  const plank = canvasTex(plankCanvas(1024, 5, 0.78), { repeat: [7, 6] });
  const deckMat = new THREE.MeshPhysicalMaterial({ map: plank, roughness: 0.62, clearcoat: 0.3, clearcoatRoughness: 0.45, color: '#caa888', envMapIntensity: 0.5 });
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(64, 44), deckMat);
  deck.rotation.x = -Math.PI / 2; deck.position.set(0, -0.22, -2); deck.receiveShadow = true; g.add(deck);
  // a soft pool of lantern light on the deck around the tray, and a contact shadow of the tray
  const poolTex = canvasTex(blobCanvas('255,196,120', 0.9, 128));
  for (const [px, pz, sz, op] of [[-2.2, -2, 14, 0.2], [3.2, -3.5, 12, 0.16], [0, 4.6, 12, 0.1]]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pl.rotation.x = -Math.PI / 2; pl.position.set(px, -0.2, pz); g.add(pl);
  }
  const bs = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: canvasTex(blobCanvas('0,0,0', 0.85, 128)), transparent: true, opacity: 0.7, depthWrite: false }));
  bs.rotation.x = -Math.PI / 2; bs.position.set(0.1, -0.205, 0.15); bs.scale.set(10.4, 10.4, 1); g.add(bs);
  // the verandah rail and the open sliding screen onto the garden (z -14)
  const timber = B.material('darkWood', { color: '#3a2415', color2: '#58361e', repeat: [4, 1], seed: 12 });
  const wall = new THREE.Group(); wall.position.set(0, 0, -15);
  const gtex = canvasTex(gardenCanvas());
  const garden = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.MeshBasicMaterial({ map: gtex, toneMapped: false, fog: false }));
  garden.position.set(0, 7.2, -4); wall.add(garden);
  const shojiTex = canvasTex(shojiCanvas());
  const paper = new THREE.MeshBasicMaterial({ map: shojiTex, color: '#f2c68a', toneMapped: false, fog: false });
  const shoji = [];
  // sliding shoji at both sides, the middle open to the garden; a lintel above and a sill below
  for (const [x0, w0] of [[-17, 12], [-9, 4.0], [9, 4.0], [17, 12]]) {
    for (let k = 0; k < Math.round(w0 / 4); k++) {
      const x = x0 - w0 / 2 + 2 + k * 4, p = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 9.6), paper); p.position.set(x, 4.8, 0.1); wall.add(p); shoji.push(p);
    }
  }
  for (const x of [-10.9, -7.1, 7.1, 10.9]) { const post = new THREE.Mesh(B.roundedBox(0.5, 11, 0.5, 0.06), timber); post.position.set(x, 5, 0.2); post.castShadow = true; wall.add(post); }
  const lintel = new THREE.Mesh(B.roundedBox(42, 0.9, 0.7, 0.1), timber); lintel.position.set(0, 10.1, 0.25); wall.add(lintel);
  const sill = new THREE.Mesh(B.roundedBox(42, 0.35, 1.2, 0.08), timber); sill.position.set(0, -0.05, 0.4); sill.receiveShadow = true; wall.add(sill);
  g.add(wall);

  // paper lanterns (chochin): ribbed barrels, black caps, soft glow; they sway
  const ct = canvasTex(chochinCanvas());
  const lanterns = [];
  const lampAt = (px, py, pz, s, k) => {
    const gr = new THREE.Group(); gr.position.set(px, py, pz);
    const prof = []; for (let i = 0; i <= 18; i++) { const t = i / 18, y = (t - 0.5) * 2; prof.push([0.34 + 0.66 * Math.pow(Math.cos(y * 1.2), 0.9) * (1 - 0.15 * Math.abs(Math.sin(i * 1.9))), t]); }
    const body = new THREE.Mesh(B.lathe(prof.map(([r, t]) => [r * 0.9, t * 2.2]), 28), new THREE.MeshStandardMaterial({ map: ct, emissive: '#ff8a4a', emissiveMap: ct, emissiveIntensity: 1.3, roughness: 0.7 }));
    body.position.y = -1.1; gr.add(body);
    const capM = new THREE.MeshStandardMaterial({ color: '#16110e', roughness: 0.5 });
    for (const y of [1.1, -1.1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 24), capM); cap.position.y = y; gr.add(cap); }
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.5, 6), new THREE.MeshBasicMaterial({ color: '#2a1a10' })); cord.position.y = 2.9; gr.add(cord);
    const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.1, 0.9, 10), new THREE.MeshStandardMaterial({ color: '#d6402a', roughness: 0.7 })); tas.position.y = -1.7; gr.add(tas);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(blobCanvas('255,170,100', 0.95, 128)), color: '#ffb070', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.scale.setScalar(6); gr.add(glow);
    gr.scale.setScalar(s); g.add(gr); lanterns.push({ gr, glow, ph: k * 1.9 });
    return gr;
  };
  lampAt(-6.8, 5.6, -5.6, 1.1, 0); lampAt(6.4, 5.9, -6.2, 1.0, 1); lampAt(-13, 6.3, -9, 1.4, 2); lampAt(13.4, 6.0, -9, 1.3, 3); lampAt(0.5, 7.4, -11, 1.5, 4);

  // dust motes drifting in the light
  const N = quality > 0.6 ? 90 : 40, pos = new Float32Array(N * 3), seed = lcg(77);
  for (let i = 0; i < N; i++) { pos[i * 3] = (seed() - 0.5) * 20; pos[i * 3 + 1] = 0.3 + seed() * 6; pos[i * 3 + 2] = (seed() - 0.5) * 16 - 2; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ map: canvasTex(blobCanvas('255,226,170', 1, 64)), size: 0.12, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false }));
  dust.frustumCulled = false; g.add(dust);

  return {
    group: g, lanterns, shoji, dust, garden,
    update(t, calm, dt) {
      const sway = calm ? 0 : 1;
      for (const L of lanterns) { L.gr.rotation.z = Math.sin(t * 0.7 + L.ph) * 0.045 * sway; L.gr.rotation.x = Math.cos(t * 0.55 + L.ph * 1.3) * 0.03 * sway; L.glow.material.opacity = 0.62 + (calm ? 0 : 0.12 * Math.sin(t * 6.1 + L.ph * 3) * Math.sin(t * 2.3 + L.ph)); }
      if (!calm) {
        const a = pg.attributes.position;
        for (let i = 0; i < N; i++) { a.array[i * 3 + 1] += dt * (0.06 + (i % 5) * 0.02); a.array[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.1; if (a.array[i * 3 + 1] > 7) a.array[i * 3 + 1] = 0.3; }
        a.needsUpdate = true;
      }
      return 0.03 * Math.sin(t * 8.3) * Math.sin(t * 2.9 + 1) * sway;
    },
  };
}
