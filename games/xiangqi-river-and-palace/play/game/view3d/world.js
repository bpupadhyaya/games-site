// Xiangqi 3D world: a slate table at night, a red cloth runner, the carved board (real slab) with its inked top, turned pieces with
// real thickness, two standing paper lamps. World units are canonical board pixels (1 unit = 1 canonical px); x/z come from the
// canonical board point (cx - 360, cy - 714), y is up. Pure scene building: no game state in here.
import * as THREE from '../vendor3d/three.js';
import { board3d as B } from '../vendor3d/index.js';
import { drawBoard } from '../src/art.js';
import { BOARD } from '../src/layout.js';
import { glyph, CJK, LATIN } from '../src/pieces.js';

export const CX = 360, CY = 714;                 // canonical point that sits at the world origin
export const BW = BOARD.w, BD = BOARD.h;         // 712 x 764
export const TOP = 26;                           // board top face height
export const PR = 32, PT = 19;                   // piece radius and thickness
export const toWorld = (x, y) => ({ x: x - CX, z: y - CY });
export const fromWorld = (x, z) => ({ x: x + CX, y: z + CY });
const TAU = Math.PI * 2;

export function radialTex(rgb, soft = 0.9) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(soft * 0.5, `rgba(${rgb},0.55)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function ringTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 18, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.55, 'rgba(255,255,255,0.3)'); g.addColorStop(0.72, 'rgba(255,255,255,1)'); g.addColorStop(0.84, 'rgba(255,255,255,0.85)'); g.addColorStop(0.94, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------------------------------------------------------- board
const boardTex = new Map();
export function boardTexture(theme, lang) {
  const key = `${theme}|${lang}`; let t = boardTex.get(key);
  if (t) return t;
  const c = document.createElement('canvas'), S = 2; c.width = BW * S; c.height = BD * S; const x = c.getContext('2d');
  x.scale(S, S); x.translate(-BOARD.x, -BOARD.y);
  x.save(); x.beginPath(); x.roundRect(BOARD.x, BOARD.y, BW, BD, 24); x.clip(); drawBoard(x, theme, lang); x.restore();
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; boardTex.set(key, t); return t;
}
export function buildBoard(theme, lang) {
  const g = new THREE.Group();
  const night = theme === 'night';
  const side = B.material('darkWood', { color: night ? '#241712' : '#6b3a1c', color2: night ? '#120a07' : '#43220d', seed: 5, repeat: [3, 1], size: 512 });
  const slab = new THREE.Mesh(B.slab(BW, BD, TOP, 24, 5), side); slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BW, BD), new THREE.MeshStandardMaterial({ map: boardTexture(theme, lang), roughness: 0.85, metalness: 0, transparent: true }));
  face.rotation.x = -Math.PI / 2; face.position.y = TOP + 0.35; face.receiveShadow = true; g.add(face);
  g.userData.dispose = () => { slab.geometry.dispose(); face.geometry.dispose(); face.material.dispose(); };
  return g;
}

// ---------------------------------------------------------------------------------------------------------------- pieces
const PAL = {
  boxwood: { face: ['#f0d493', '#dcae66', '#b98240'], red: ['#d92a1a', '#8f0d08'], blk: ['#2a1c16', '#050303'], ringRed: '#b3170f', ringBlk: '#22150f', side: '#b8814a', side2: '#7c4e26' },
  ebony: { face: ['#5a463b', '#33241d', '#1a100c'], red: ['#ff7a5c', '#e0301c'], blk: ['#f8dc8e', '#c8983a'], ringRed: '#e8452e', ringBlk: '#d9aa48', side: '#33231c', side2: '#150b08' },
};
const faceTex = new Map();
function faceTexture(p, theme, lang) {
  const key = `${p}|${theme}|${lang}`; let t = faceTex.get(key); if (t) return t;
  const T = PAL[theme] || PAL.boxwood, S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), h = S / 2, red = p > 0;
  const g = x.createRadialGradient(h * 0.8, h * 0.75, 6, h, h, h); g.addColorStop(0, T.face[0]); g.addColorStop(0.6, T.face[1]); g.addColorStop(1, T.face[2]);
  x.fillStyle = g; x.beginPath(); x.arc(h, h, h, 0, TAU); x.fill();
  // grain
  x.save(); x.beginPath(); x.arc(h, h, h, 0, TAU); x.clip(); x.strokeStyle = theme === 'ebony' ? 'rgba(255,230,190,0.05)' : 'rgba(110,64,22,0.10)'; x.lineWidth = 1.4;
  for (let i = 0; i < 26; i++) { const yy = (i / 26) * S + ((i * 37) % 7); x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(S * 0.3, yy + 5, S * 0.6, yy - 5, S, yy + 2); x.stroke(); } x.restore();
  x.lineWidth = S * 0.028; x.strokeStyle = red ? T.ringRed : T.ringBlk; x.beginPath(); x.arc(h, h, h * 0.83, 0, TAU); x.stroke();
  x.lineWidth = S * 0.01; x.beginPath(); x.arc(h, h, h * 0.9, 0, TAU); x.stroke();
  const gl = glyph(p, lang), en = lang === 'en', ink = red ? T.red : T.blk, fs = S * (en ? 0.58 : 0.56);
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${fs}px ${en ? LATIN : CJK}`;
  x.fillStyle = theme === 'ebony' ? 'rgba(0,0,0,0.55)' : 'rgba(255,244,214,0.75)'; x.fillText(gl, h + 2, h + 4);        // carved edge highlight
  const ig = x.createLinearGradient(0, h - fs / 2, 0, h + fs / 2); ig.addColorStop(0, ink[0]); ig.addColorStop(1, ink[1]); x.fillStyle = ig; x.strokeStyle = ink[1]; x.lineWidth = S * 0.012; x.lineJoin = 'round'; x.strokeText(gl, h, h + 1); x.fillText(gl, h, h + 1);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; faceTex.set(key, t); return t;
}
const sideMats = new Map(), geos = {};
function sideMat(theme) {
  let m = sideMats.get(theme); if (m) return m; const T = PAL[theme] || PAL.boxwood;
  m = theme === 'ebony' ? B.material('darkWood', { color: T.side, color2: T.side2, seed: 9, repeat: [2, 1], size: 256 }) : B.material('wood', { color: T.side, color2: T.side2, seed: 4, repeat: [2, 1], size: 256 });
  sideMats.set(theme, m); return m;
}
function pieceGeos() {
  if (geos.side) return geos;
  const R = PR, T = PT;
  geos.side = B.lathe([[0, 0], [R - 5, 0], [R - 2, 0.8], [R - 0.3, 3.2], [R, 6], [R, T - 6], [R - 0.8, T - 3], [R - 3.5, T - 0.7], [R - 6, T], [R - 7, T], [R - 8.2, T - 1.3], [0, T - 1.3]], 56);
  geos.face = new THREE.CircleGeometry(R - 7.4, 48); geos.face.rotateX(-Math.PI / 2);
  return geos;
}
export function makePiece(p, theme, lang) {
  const gs = pieceGeos(), g = new THREE.Group();
  const side = new THREE.Mesh(gs.side, sideMat(theme)); side.castShadow = true; g.add(side);
  const fm = new THREE.MeshPhysicalMaterial({ map: faceTexture(p, theme, lang), roughness: 0.6, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.5 });
  const face = new THREE.Mesh(gs.face, fm); face.position.y = PT - 0.5; g.add(face);
  g.userData.face = face; return g;
}
export function clearPieceCaches() {
  for (const t of faceTex.values()) t.dispose(); faceTex.clear(); for (const t of boardTex.values()) t.dispose(); boardTex.clear(); sideMats.clear(); B.disposeMaterialCache();
  for (const k of Object.keys(geos)) { geos[k].dispose(); delete geos[k]; }
}

// ---------------------------------------------------------------------------------------------------------------- room
function lamp(x, z, scene) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(34, 40, 14, 28), B.material('brass', {})); base.position.y = 7; base.castShadow = true; g.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 190, 12), B.material('darkWood', { color: '#2a160c', color2: '#150a05' })); post.position.y = 105; g.add(post);
  const bodyM = new THREE.MeshStandardMaterial({ color: 0xc8261a, emissive: 0xff5a22, emissiveIntensity: 1.7, roughness: 0.65 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(52, 32, 20), bodyM); body.scale.set(1, 1.18, 1); body.position.y = 255; g.add(body);
  const capM = B.material('brass', {}); for (const yy of [196, 316]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 9, 24), capM); cap.position.y = yy; g.add(cap); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,120,50'), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.scale.set(380, 380, 1); halo.position.y = 255; g.add(halo);
  const light = new THREE.PointLight(0xff8a4a, 2.2e5, 0, 2); light.position.set(0, 255, 0); g.add(light);
  g.userData = { halo, light, body: bodyM }; scene.add(g); return g;
}
export function buildRoom(scene) {
  const room = new THREE.Group(); scene.add(room);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), B.material('felt', { color: '#244244', color2: '#12282a', repeat: [30, 30], size: 256, seed: 2 }));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; table.position.y = -0.2; room.add(table);
  const runner = new THREE.Mesh(B.slab(BW + 190, BD + 190, 3, 10, 1.2), B.material('cloth', { color: '#7e1f16', color2: '#4d0f0a', repeat: [4, 4], size: 512, seed: 6 }));
  runner.receiveShadow = true; room.add(runner);
  const trim = new THREE.Mesh(B.slab(BW + 206, BD + 206, 2, 12, 0.8), B.material('brass', {})); trim.position.y = -0.4; room.add(trim);
  const lamps = [lamp(-330, -540, scene), lamp(330, -540, scene)];
  room.userData.lamps = lamps;
  return room;
}
