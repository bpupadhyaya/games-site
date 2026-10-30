// Ddakji 3D world: a hanok floor room. World units are tiles (one tile is 1 x 1, 0.14 thick), x right, y away from the thrower, z up
// (exactly the sim's frame; the presenter turns the whole root into three.js' y-up frame). Pure scene building, no game state.
import * as THREE from '../vendor3d/three.js';
import { board3d as B } from '../vendor3d/index.js';
import { drawPatternFace, drawReverseFace } from '../src/art.js';
import { MAT, THICK } from '../src/sim.js';

const TAU = Math.PI * 2;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

export function radialTex(rgb, soft = 0.9) {
  const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(soft * 0.5, `rgba(${rgb},0.5)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return tex(c);
}

// ------------------------------------------------------------------------------------------------------------ tiles
const faceTex = new Map(), geoCache = {};
function patTexture(pat, reverse) {
  const k = reverse ? 'r' : `p${pat}`; let t = faceTex.get(k); if (t) return t;
  const c = cv(256), x = c.getContext('2d'); x.scale(2.56, 2.56);
  if (reverse) drawReverseFace(x); else drawPatternFace(x, pat);
  t = tex(c); faceTex.set(k, t); return t;
}
let sideTex = null;
function sideTexture() {
  if (sideTex) return sideTex;
  const c = cv(64, 128), x = c.getContext('2d'); x.fillStyle = '#efe2c0'; x.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 9; i++) { const y = 8 + i * 14; x.fillStyle = i % 2 ? '#d9c79b' : '#f6ecd0'; x.fillRect(0, y - 6, 64, 12); x.fillStyle = 'rgba(110,78,40,0.55)'; x.fillRect(0, y + 6, 64, 1.6); }
  sideTex = tex(c); return sideTex;
}
export function tileGeo() {
  if (!geoCache.box) geoCache.box = B.roundedBox(1, THICK, 1, 0.055, 6);
  return geoCache.box;
}
// One tile: a holder whose matrix the presenter sets from the sim's tileToWorld; the box sits with its underside at local z = 0.
export function makeTile() {
  const holder = new THREE.Group(); holder.matrixAutoUpdate = false;
  const mk = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0 });
  const side = mk(sideTexture()), top = mk(patTexture(0, false)), bot = mk(patTexture(0, true));
  const mesh = new THREE.Mesh(tileGeo(), [side, side, top, bot, side, side]);   // +x -x +y -y +z -z (box y-up)
  mesh.rotation.x = Math.PI / 2; mesh.position.z = THICK / 2; mesh.castShadow = true; mesh.receiveShadow = true;
  holder.add(mesh); holder.userData = { mesh, side, top, bot, pat: -1 };
  return holder;
}
export function setTilePat(h, pat) { const u = h.userData; if (u.pat === pat) return; u.pat = pat; u.top.map = patTexture(pat, false); u.top.needsUpdate = true; }
export function setTileAlpha(h, a) { const u = h.userData, tr = a < 0.999; for (const m of [u.side, u.top, u.bot]) { if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = a; } }

// ------------------------------------------------------------------------------------------------------------ room
function paperTexture() {
  // the oiled-paper sheet seen from above: x runs left to right, canvas top is the far edge
  const S = 1024, w = MAT.x1 - MAT.x0 + 0.9, d = MAT.y1 - MAT.y0 + 0.9, c = cv(S, Math.round(S * d / w)), x = c.getContext('2d'), r = lcg(11);
  const g = x.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, '#d9a24a'); g.addColorStop(0.5, '#c98f36'); g.addColorStop(1, '#b97a24'); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 60; i++) { const px = r() * c.width; x.strokeStyle = r() > 0.5 ? 'rgba(130,76,14,0.13)' : 'rgba(255,236,170,0.18)'; x.lineWidth = 1 + r() * 3; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (r() - 0.5) * 60, c.height); x.stroke(); }
  for (let i = 0; i < 700; i++) { const px = r() * c.width, py = r() * c.height; x.strokeStyle = 'rgba(120,66,10,0.2)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 8 + r() * 26, py + (r() - 0.5) * 6); x.stroke(); }
  for (const sy of [1.2, 3.8]) { const py = c.height * (1 - (sy - (MAT.y0 - 0.45)) / d); x.fillStyle = 'rgba(96,52,6,0.3)'; x.fillRect(0, py, c.width, 3); x.fillStyle = 'rgba(255,238,176,0.5)'; x.fillRect(0, py + 3, c.width, 2); }
  return tex(c);
}
function plankTexture() {
  // lacquered floor boards running along x; the grain is periodic in x so the texture repeats without a seam
  const S = 512, c = cv(S), x = c.getContext('2d'), r = lcg(5), N = 6, h = S / N;
  for (let i = 0; i < N; i++) {
    const t = r(), base = [Math.round(92 + t * 34), Math.round(54 + t * 22), Math.round(26 + t * 12)];
    x.fillStyle = `rgb(${base})`; x.fillRect(0, i * h, S, h);
    for (let g = 0; g < 34; g++) {
      const y0 = i * h + 3 + r() * (h - 6), k = 1 + (r() * 3 | 0), ph = r() * TAU, am = 1.2 + r() * 2.4;
      x.strokeStyle = r() > 0.5 ? 'rgba(40,20,6,0.16)' : 'rgba(255,214,150,0.07)'; x.lineWidth = 0.7 + r() * 1.4; x.beginPath();
      for (let px = 0; px <= S; px += 16) { const py = y0 + am * Math.sin((px / S) * TAU * k + ph); px ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    }
    x.fillStyle = 'rgba(14,6,0,0.55)'; x.fillRect(0, i * h, S, 2.5); x.fillStyle = 'rgba(255,214,150,0.12)'; x.fillRect(0, i * h + 2.5, S, 1.5);
  }
  const t = tex(c, [10, 7]); return t;
}
function shojiTexture() {
  const c = cv(256, 512), x = c.getContext('2d');
  x.fillStyle = '#3a2412'; x.fillRect(0, 0, 256, 512);
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#ffe2a6'); g.addColorStop(1, '#ffcb7e'); x.fillStyle = g; x.fillRect(14, 14, 228, 484);
  x.strokeStyle = '#4a2c16'; x.lineWidth = 5; for (let i = 1; i < 3; i++) { x.beginPath(); x.moveTo(14 + (228 / 3) * i, 14); x.lineTo(14 + (228 / 3) * i, 498); x.stroke(); }
  for (let j = 1; j < 6; j++) { x.beginPath(); x.moveTo(14, 14 + (484 / 6) * j); x.lineTo(242, 14 + (484 / 6) * j); x.stroke(); }
  x.lineWidth = 9; x.strokeStyle = '#2e1b0d'; x.strokeRect(10, 10, 236, 492);
  return tex(c, [12, 1]);
}
function lantern(x, y, scene) {
  const g = new THREE.Group(); g.position.set(x, y, 0);
  const wood = B.material('darkWood', { color: '#3a2412', color2: '#25150a', repeat: [1, 1], size: 256 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa94a, emissiveIntensity: 1.5, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 1.15), paper); body.position.z = 0.7; g.add(body);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.25), wood); post.position.set(sx * 0.32, sy * 0.32, 0.7); g.add(post); }
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), wood); cap.position.z = 1.36; g.add(cap);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), wood); base.position.z = 0.06; g.add(base);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,170,80'), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.scale.set(3.4, 3.4, 1); halo.position.z = 0.8; g.add(halo);
  const light = new THREE.PointLight(0xffa860, 14, 0, 2); light.position.set(0, 0, 0.8); g.add(light);
  g.userData = { halo, light }; scene.add(g); return g;
}
export function buildRoom(root) {
  const room = new THREE.Group(); root.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.42, metalness: 0 }));
  floor.position.set(0, 4, -0.06); floor.receiveShadow = true; room.add(floor);
  const w = MAT.x1 - MAT.x0 + 0.9, d = MAT.y1 - MAT.y0 + 0.9, cx = (MAT.x0 + MAT.x1) / 2, cy = (MAT.y0 + MAT.y1) / 2;
  const edge = new THREE.Mesh(B.slab(w + 0.16, d + 0.16, 0.05, 0.1, 0.018), new THREE.MeshStandardMaterial({ color: 0x8a5a1c, roughness: 0.5 }));
  edge.rotation.x = Math.PI / 2; edge.position.set(cx, cy, -0.054); edge.receiveShadow = true;   // slab is y-up: rotateX(+90deg) maps its height onto z
  room.add(edge);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: paperTexture(), roughness: 0.36, metalness: 0, bumpScale: 0.6 }));
  sheet.position.set(cx, cy, -0.003); sheet.receiveShadow = true; room.add(sheet);
  const st = shojiTexture(), wall = new THREE.Mesh(new THREE.PlaneGeometry(36, 7), new THREE.MeshStandardMaterial({ map: st, emissiveMap: st, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 1 }));
  wall.rotation.x = Math.PI / 2; wall.position.set(0, 13, 3.5); room.add(wall);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 0.35), B.material('darkWood', { repeat: [8, 1], size: 256 })); beam.position.set(0, 12.8, 0.17); room.add(beam);
  props(room);
  room.userData.lamps = [lantern(-2.9, 8.6, room), lantern(2.9, 8.6, room)];
  room.userData.sheet = sheet;
  return room;
}
// Props on the floor in front of the mat: a stack of spare folded tiles and a small celadon tea set on a tray.
function props(room) {
  const g = new THREE.Group(); room.add(g);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  [0, 4, 1, 8, 6].forEach((pat, i) => {
    const h = makeTile(); setTilePat(h, pat); e.set(0, 0, -0.35 + i * 0.17 + (i % 2) * 0.1); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(-1.9 + (i % 2) * 0.03, -1.55, i * THICK + 0.005), q, new THREE.Vector3(0.82, 0.82, 1)); h.matrix.copy(m4); h.matrixWorldNeedsUpdate = true; g.add(h);
  });
  const glaze = new THREE.MeshPhysicalMaterial({ color: 0x8fb5a2, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.12 });
  const tray = new THREE.Mesh(B.slab(1.55, 0.95, 0.07, 0.1, 0.025), B.material('darkWood', { color: '#4a2a16', color2: '#2d180a', size: 256 }));
  tray.rotation.x = Math.PI / 2; tray.position.set(1.75, -1.5, 0); tray.castShadow = true; tray.receiveShadow = true; g.add(tray);
  const lathe = (prof, x, y, z, sc = 1) => { const m = new THREE.Mesh(B.lathe(prof, 36), glaze); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); m.scale.setScalar(sc); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const pot = [[0, 0], [0.16, 0], [0.3, 0.05], [0.37, 0.2], [0.34, 0.34], [0.2, 0.42], [0.15, 0.43], [0.15, 0.47], [0.05, 0.5], [0.05, 0.54], [0, 0.54]];
  lathe(pot, 1.45, -1.42, 0.07);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 12, 28, Math.PI * 1.2), glaze); handle.position.set(1.45 - 0.36, -1.42, 0.3); handle.rotation.set(0, 0, Math.PI * 0.4); handle.castShadow = true; g.add(handle);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.075, 0.3, 14), glaze); spout.position.set(1.45 + 0.4, -1.42, 0.3); spout.rotation.set(0, 0, -Math.PI * 0.3); spout.castShadow = true; g.add(spout);
  const cup = [[0, 0], [0.07, 0], [0.12, 0.02], [0.16, 0.1], [0.17, 0.2], [0.165, 0.2], [0.15, 0.1], [0.1, 0.04], [0, 0.035]];
  lathe(cup, 2.12, -1.32, 0.07); lathe(cup, 2.05, -1.68, 0.07);
}
export function disposeWorld() {
  for (const t of faceTex.values()) t.dispose(); faceTex.clear(); if (sideTex) { sideTex.dispose(); sideTex = null; }
  for (const k of Object.keys(geoCache)) { geoCache[k].dispose(); delete geoCache[k]; }
  B.disposeMaterialCache();
}
void TAU;
