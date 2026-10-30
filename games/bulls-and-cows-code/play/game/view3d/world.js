// The 3D parts of Bulls and Cows, all procedural (no bitmaps). World units = the game's virtual layout units (1 unit = 1 layout pixel), x to the
// right, z down the screen, y up out of the board. Pegs are chunky lacquered buttons with an engraved numeral; sockets have a brass collar;
// the secret row hides under brass lids; bulls are gold balls, cows are teal rings; trays are walnut cabinets with a brass border and felt.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { PEG } from '../src/art.js';

const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const mkTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const mesh = (g, m) => { const o = new THREE.Mesh(g, m); return o; };

export const PEG_H = 0.78, LID_H = 0.95;
let geo = null;
export function geos() {
  if (geo) return geo;
  geo = {
    peg: B.lathe([[0, 0], [0.5, 0], [0.5, 0.1], [0.9, 0.13], [0.985, 0.24], [1, 0.4], [0.97, 0.56], [0.86, 0.71], [0.66, 0.78], [0.66, 0.78], [0, 0.78]], 48),
    lid: B.lathe([[0, 0], [1, 0], [1, 0.5], [0.96, 0.74], [0.84, 0.92], [0.84, 0.92], [0.72, 0.95], [0, 0.95]], 48),
    disc: new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
    ball: new THREE.SphereGeometry(1, 28, 18),
    collar: new THREE.TorusGeometry(1.0, 0.045, 10, 56).rotateX(-Math.PI / 2),
    cow: new THREE.TorusGeometry(0.74, 0.26, 12, 40).rotateX(-Math.PI / 2),
    ringHi: new THREE.TorusGeometry(1, 0.06, 8, 48).rotateX(-Math.PI / 2),
  };
  return geo;
}
export function disposeWorld() { if (geo) { for (const g of Object.values(geo)) g.dispose(); geo = null; } texs.clear(); mats.clear(); socketT = null; }

// ---------------------------------------------------------------- textures
const texs = new Map();
function drawDigit(c, digit, ch) {
  const s = c.width, x = c.getContext('2d'), P = PEG[digit] ?? PEG[0], ink = ch === '?' ? '#3b2a08' : P.ink;
  x.clearRect(0, 0, s, s); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${s * 0.78}px Fredoka, system-ui, sans-serif`;
  x.fillStyle = ink === '#ffffff' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.55)'; x.fillText(ch, s / 2 + s * 0.012, s * 0.54 + s * 0.02);
  x.fillStyle = ink; x.fillText(ch, s / 2, s * 0.54);
}
export function digitTex(digit, ch = String(digit)) {
  const k = ch + digit; let e = texs.get(k); if (e) return e.t;
  const c = cvs(192, 192); drawDigit(c, digit, ch); const t = mkTex(c); texs.set(k, { t, c, digit, ch }); return t;
}
export function refreshDigits() { for (const e of texs.values()) { drawDigit(e.c, e.digit, e.ch); e.t.needsUpdate = true; } }
let socketT = null;
function socketTex(T) {
  if (socketT && socketT.key === T.name) return socketT.t;
  const c = cvs(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 56, 6, 64, 64, 64);
  const mx = (a, b, t) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
  g.addColorStop(0, T.hole); g.addColorStop(0.6, mx(T.hole, T.holeRim, 0.45)); g.addColorStop(0.9, mx(T.hole, T.holeRim, 0.9)); g.addColorStop(1, mx(T.holeRim, '#ffffff', 0.18)); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = mkTex(c); if (socketT) socketT.t.dispose(); socketT = { key: T.name, t }; return t;
}
let blob = null;
function blobTex() { if (blob) return blob; const c = cvs(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); blob = mkTex(c); return blob; }

// ---------------------------------------------------------------- materials (cached; opacity is quantised to tenths)
const mats = new Map();
const cached = (k, f) => { let m = mats.get(k); if (!m) { m = f(); mats.set(k, m); } return m; };
const q10 = (o) => Math.max(1, Math.min(10, Math.round(o * 10)));
export const pegMat = (digit, op) => cached(`p${digit}|${q10(op)}`, () => new THREE.MeshPhysicalMaterial({ color: (PEG[digit] ?? PEG[0]).c, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.55, transparent: q10(op) < 10, opacity: q10(op) / 10 }));
export const decalMat = (digit, ch, op) => cached(`d${ch}${digit}|${q10(op)}`, () => new THREE.MeshStandardMaterial({ map: digitTex(digit, ch), transparent: true, opacity: q10(op) / 10, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
export const goldMat = () => cached('gold', () => new THREE.MeshPhysicalMaterial({ color: '#ffc83d', metalness: 0.85, roughness: 0.22, clearcoat: 0.6, envMapIntensity: 1.6 }));
export const tealMat = () => cached('teal', () => new THREE.MeshPhysicalMaterial({ color: '#27cfc7', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.2 }));
export const brassMat = () => cached('brass', () => B.material('brass', { roughness: 0.34, envIntensity: 1.3 }));
export const lidMat = (op) => cached(`lid${q10(op)}`, () => { const m = new THREE.MeshPhysicalMaterial({ color: '#d4a443', metalness: 1, roughness: 0.3, envMapIntensity: 2.4, clearcoat: 0.4, transparent: q10(op) < 10, opacity: q10(op) / 10 }); return m; });
export const emptyMat = () => cached('empty', () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, depthWrite: false }));
export const ringMat = (c) => cached(`r${c}`, () => new THREE.MeshBasicMaterial({ color: c }));
export const hotMat = () => cached('hot', () => new THREE.MeshBasicMaterial({ color: '#f2c14e' }));
export const holeMat = (T) => cached(`h${T.name}`, () => new THREE.MeshBasicMaterial({ map: socketTex(T), polygonOffset: true, polygonOffsetFactor: -1 }));
export const shadowMat = () => cached('blob', () => new THREE.MeshBasicMaterial({ map: blobTex(), color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
export function dropMats() { for (const m of mats.values()) m.dispose(); mats.clear(); }

// ---------------------------------------------------------------- pooled pieces
export function makePeg() {
  const g = new THREE.Group(), G = geos();
  const body = mesh(G.peg, pegMat(1, 1)); body.castShadow = true; body.receiveShadow = true;
  const decal = mesh(new THREE.CircleGeometry(0.6, 32).rotateX(-Math.PI / 2), decalMat(1, '1', 1)); decal.position.y = PEG_H + 0.004; decal.renderOrder = 2;
  const ring = mesh(G.ringHi, hotMat()); ring.scale.setScalar(1.16); ring.position.y = 0.06; ring.visible = false;
  g.add(body, decal, ring); g.userData = { body, decal, ring }; return g;
}
export function makeHole() { const g = new THREE.Group(), G = geos(); const d = mesh(G.disc, holeMat({ name: 'baize', hole: '#03140f', holeRim: '#13453a' })); d.position.y = 0.2; const c = mesh(G.collar, brassMat()); c.position.y = 0.3; g.add(d, c); g.userData = { d, c }; return g; }
export function makeLid() {
  const g = new THREE.Group(), G = geos(), body = mesh(G.lid, lidMat(1)); body.castShadow = true; body.receiveShadow = true;
  const decal = mesh(new THREE.CircleGeometry(0.64, 32).rotateX(-Math.PI / 2), decalMat(0, '?', 1)); decal.position.y = LID_H + 0.004; decal.renderOrder = 2;
  g.add(body, decal); g.userData = { body, decal }; return g;
}
export function makePip(kind) {
  const g = new THREE.Group(), G = geos();
  if (kind === 'bull') { const b = mesh(G.ball, goldMat()); b.position.y = 1.15; b.scale.setScalar(1.15); b.castShadow = true; g.add(b); const s = mesh(new THREE.CircleGeometry(1.25, 24).rotateX(-Math.PI / 2), shadowMat()); s.position.set(0.18, 0.05, 0.22); g.add(s); }
  else if (kind === 'cow') { const t = mesh(G.cow, tealMat()); t.position.y = 0.3; t.castShadow = true; g.add(t); }
  else { const e = mesh(G.disc, emptyMat()); e.scale.setScalar(0.32); e.position.y = 0.25; g.add(e); }
  return g;
}

// ---------------------------------------------------------------- trays: walnut cabinet, brass border, felt
function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2 - 0.5, h / 2 - 0.5);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false); s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false); return s;
}
function ring(wo, ho, ro, wi, hi, ri, depth) {
  const s = rrShape(wo, ho, ro); s.holes.push(rrShape(wi, hi, ri));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 1.4, bevelThickness: 1.4, bevelSegments: 3, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); return g;
}
export function buildSlab(w, h, r, T) {
  const g = new THREE.Group(), wood = B.material(T.dark ? 'darkWood' : 'wood', { repeat: [Math.max(1, Math.round(w / 260)), Math.max(1, Math.round(h / 260))], size: 512 });
  const cab = mesh(B.slab(w + 26, h + 26, 18, r + 12, 6), wood); cab.position.y = -19.5; cab.castShadow = true; cab.receiveShadow = true;
  const felt = B.material('felt', { color: T.bg0, color2: T.bg0, repeat: [Math.max(2, Math.round(w / 60)), Math.max(2, Math.round(h / 60))], size: 512 });
  const inner = mesh(B.slab(w + 2, h + 2, 4, r, 1.5), felt); inner.position.y = -4; inner.receiveShadow = true;
  const rim = mesh(ring(w + 11, h + 11, r + 5, w - 1, h - 1, r, 3), brassMat()); rim.position.y = -1.5; rim.castShadow = true; rim.receiveShadow = true;
  g.add(cab, inner, rim);
  g.userData.dispose = () => { cab.geometry.dispose(); inner.geometry.dispose(); rim.geometry.dispose(); };
  return g;
}
export function buildTable(T) {
  const wood = B.material(T.dark ? 'darkWood' : 'wood', { repeat: [10, 10], size: 512, roughness: 0.92, envIntensity: 0.3, color: T.dark ? '#24140a' : undefined, color2: T.dark ? '#3a2112' : undefined });
  const m = mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), wood); m.position.y = -24; m.receiveShadow = true; return m;
}
