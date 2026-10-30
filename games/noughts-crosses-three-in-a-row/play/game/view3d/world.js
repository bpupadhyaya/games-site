// The 3D world for Noughts & Crosses, all procedural (no bitmaps): a carved slab (marble, boxwood or night glass, the same three
// looks as the flat game) with its Greek-key band, grooves and Terni Lapilli nodes baked from the game's own art into colour and
// height maps; extruded crosses and lathe-turned noughts; a table, river pebbles ("terni lapilli" = three pebbles) and a lamp.
// Units are centimetres; y is up; the table top is y = 0, the board top is y = TOP; the far edge of the board is -z.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { boardGeo, drawSlab, drawBoardLines, drawBoardBump } from '../src/art.js';

export const SIDE = 36;                  // board edge (cm)
export const THICK = 2.6;
export const TOP = THICK;
const RAD = SIDE * 0.06;

const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rngOf = (s) => { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
export function radialTex(rgb, a = 1) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}
// a horizontal capsule of light (the winning bar): bright core, soft halo
export function barTex() {
  const c = canvas(256, 64), x = c.getContext('2d');
  x.filter = 'blur(5px)'; x.fillStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.roundRect(14, 12, 228, 40, 20); x.fill();
  x.filter = 'blur(1.5px)'; x.fillStyle = 'rgba(255,255,255,1)'; x.beginPath(); x.roundRect(22, 22, 212, 20, 10); x.fill();
  return tex(c);
}

// ---------------------------------------------------------------- per-theme environment
export const ENV = {
  marble: { bg: 0x0a0806, fog: 0x120d09, sun: 0xffd6a0, sunI: 2.6, hemiS: 0xffe6c8, hemiG: 0x20140c, hemiI: 0.55, rim: 0xffa05a, rimI: 0.9, exp: 1.0, ibl: 0.32 },
  wood: { bg: 0x07110d, fog: 0x0a1913, sun: 0xffe2b0, sunI: 2.5, hemiS: 0xe8f2e0, hemiG: 0x0c1a12, hemiI: 0.5, rim: 0xffc27a, rimI: 0.8, exp: 1.0, ibl: 0.3 },
  glass: { bg: 0x050512, fog: 0x0a0a22, sun: 0xcdd6ff, sunI: 2.1, hemiS: 0xb8c4ff, hemiG: 0x0a0a24, hemiI: 0.5, rim: 0x6f7dff, rimI: 1.6, exp: 1.05, ibl: 0.4 },
};
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x111111, 0.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(-34, 62, 40); sun.target.position.set(0, TOP, 0);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30; sun.shadow.camera.near = 20; sun.shadow.camera.far = 170;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8); rim.position.set(40, 26, -60); scene.add(rim);
  return { hemi, sun, rim };
}
export function setEnv(scene, lights, th) {
  const e = ENV[th.kind] ?? ENV.marble;
  scene.background = new THREE.Color(e.bg); scene.fog = new THREE.Fog(e.fog, 140, 620);
  lights.sun.color.setHex(e.sun); lights.sun.intensity = e.sunI;
  lights.hemi.color.setHex(e.hemiS); lights.hemi.groundColor.setHex(e.hemiG); lights.hemi.intensity = e.hemiI;
  lights.rim.color.setHex(e.rim); lights.rim.intensity = e.rimI;
  scene.environmentIntensity = e.ibl;
  return e;
}

// ---------------------------------------------------------------- the board
export const boardKind = (mode) => (mode === 'terni' ? 'terni' : mode === 'quad' ? 'quad' : 'classic');
export function buildBoard(th, kind, px) {
  const c = canvas(px), x = c.getContext('2d');
  x.fillStyle = th.side; x.fillRect(0, 0, px, px);
  const geo = boardGeo(kind, 0, 0, px);
  drawSlab(x, th, 0, 0, px, { flat: true, thick: 0 });
  drawBoardLines(x, th, geo);
  const bc = canvas(px); drawBoardBump(bc.getContext('2d'), geo, th);
  const map = tex(c), bump = tex(bc, false);
  const glass = th.kind === 'glass';
  const mat = new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: glass ? 1.4 : 2.2, roughness: glass ? 0.22 : th.kind === 'wood' ? 0.5 : 0.42, metalness: 0, clearcoat: glass ? 1 : th.kind === 'marble' ? 0.35 : 0.2, clearcoatRoughness: 0.2 });
  const m = new THREE.Mesh(B.slab(SIDE, SIDE, THICK, RAD, 0.5, { seg: 3, per: 6 }), mat);
  m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m);
  g.userData.dispose = () => { map.dispose(); bump.dispose(); mat.dispose(); m.geometry.dispose(); };
  return g;
}

// ---------------------------------------------------------------- marks (authored at diameter 1; scaled per board)
const PH = 0.17;                         // height as a fraction of the diameter
export function pieceGeos() {
  // cross: one 12-corner polygon (a plus rotated 45 degrees), extruded with a rounded bevel
  const L = 0.5, w = 0.135, a = Math.SQRT1_2, pts = [[w, L], [w, w], [L, w], [L, -w], [w, -w], [w, -L], [-w, -L], [-w, -w], [-L, -w], [-L, w], [-w, w], [-w, L]]
    .map(([px, py]) => new THREE.Vector2((px - py) * a, (px + py) * a));
  const sh = new THREE.Shape(pts);
  const bev = 0.028;
  const xg = new THREE.ExtrudeGeometry(sh, { depth: PH - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 1 });
  xg.rotateX(-Math.PI / 2); xg.translate(0, bev, 0); xg.computeVertexNormals();
  // nought: a turned ring with rounded edges
  const R = 0.5, r = 0.25, h = PH, e = 0.04, prof = [];
  prof.push([r + e, 0], [R - e, 0]);
  for (let i = 1; i <= 4; i++) { const t = (i / 4) * Math.PI / 2; prof.push([R - e + Math.sin(t) * e, e - Math.cos(t) * e]); }
  prof.push([R, h - e]);
  for (let i = 1; i <= 4; i++) { const t = (i / 4) * Math.PI / 2; prof.push([R - e + Math.cos(t) * e, h - e + Math.sin(t) * e]); }
  prof.push([r + e, h]);
  for (let i = 1; i <= 4; i++) { const t = (i / 4) * Math.PI / 2; prof.push([r + e - Math.sin(t) * e, h - e + Math.cos(t) * e]); }
  prof.push([r, e]);
  for (let i = 1; i <= 4; i++) { const t = (i / 4) * Math.PI / 2; prof.push([r + e - Math.cos(t) * e, e - Math.sin(t) * e]); }
  const og = B.lathe(prof, 56);
  return { 1: xg, 2: og };
}
export function pieceMaterials(th) {
  const mk = (c, o) => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(c.base), ...o });
  const m = { 1: mk(th.x, {}), 2: mk(th.o, {}), g1: null, g2: null };
  setPieceTheme(m, th);
  m.g1 = mk(th.x, { transparent: true, opacity: 0.4, depthWrite: false }); m.g2 = mk(th.o, { transparent: true, opacity: 0.4, depthWrite: false });
  return m;
}
export function setPieceTheme(m, th) {
  const k = th.kind;
  const set = (mat, c, o) => { mat.color.set(o.col ?? c.base); mat.emissive.set(o.em ? c.base : 0x000000); mat.emissiveIntensity = o.em ?? 0; mat.metalness = o.metal; mat.roughness = o.rough; mat.clearcoat = o.cc; mat.clearcoatRoughness = o.ccr ?? 0.1; mat.envMapIntensity = o.env ?? 1; mat.needsUpdate = true; };
  if (k === 'marble') { set(m[1], th.x, { metal: 0.55, rough: 0.24, cc: 1, ccr: 0.08, env: 2.6, col: '#f2bc50' }); set(m[2], th.o, { metal: 0, rough: 0.24, cc: 1, ccr: 0.06 }); }
  else if (k === 'wood') { set(m[1], th.x, { metal: 0, rough: 0.3, cc: 1, ccr: 0.05 }); set(m[2], th.o, { metal: 0, rough: 0.25, cc: 1, ccr: 0.05, env: 1.2 }); }
  else { set(m[1], th.x, { metal: 0.1, rough: 0.12, cc: 1, ccr: 0.03, em: 0.32 }); set(m[2], th.o, { metal: 0.1, rough: 0.12, cc: 1, ccr: 0.03, em: 0.32 }); }
  for (const g of ['g1', 'g2']) if (m[g]) { m[g].color.copy(m[g === 'g1' ? 1 : 2].color); }
}

// ---------------------------------------------------------------- table and props
export function buildTable(th) {
  const k = th.kind;
  let mat;
  if (k === 'marble') {
    // dark slate flagstones: mottled, fine-grained, no veins
    const c = canvas(512), x = c.getContext('2d'), r = rngOf(21), bc = canvas(512), bx = bc.getContext('2d');
    x.fillStyle = '#2b2723'; x.fillRect(0, 0, 512, 512); bx.fillStyle = '#808080'; bx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 60; i++) { const px = r() * 512, py = r() * 512, rr = 30 + r() * 90, g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, `rgba(${r() < 0.5 ? '90,78,66' : '10,8,6'},0.16)`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
    for (let i = 0; i < 14000; i++) { const v = r() < 0.5; x.fillStyle = v ? 'rgba(255,240,220,0.05)' : 'rgba(0,0,0,0.09)'; x.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); bx.fillStyle = v ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.2)'; bx.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
    x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 3; x.strokeRect(0, 0, 512, 512); bx.strokeStyle = '#000'; bx.lineWidth = 4; bx.strokeRect(0, 0, 512, 512);
    const mp = tex(c), bp = tex(bc, false); mp.wrapS = mp.wrapT = bp.wrapS = bp.wrapT = THREE.RepeatWrapping; mp.repeat.set(6, 6); bp.repeat.set(6, 6);
    mat = new THREE.MeshStandardMaterial({ map: mp, bumpMap: bp, bumpScale: 1.2, roughness: 0.78, metalness: 0 });
  }
  else if (k === 'wood') mat = B.material('felt', { repeat: [22, 22], size: 512, color: '#14442f', color2: '#0b2b1e' });
  else mat = new THREE.MeshPhysicalMaterial({ color: 0x0b0d26, roughness: 0.14, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat); m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m);
  // river pebbles: terni lapilli means "three pebbles"
  const rnd = rngOf(7), pm = B.material('stone', { color: '#6c675f', color2: '#c9c0b0', size: 256, seed: 3, roughness: 0.5 });
  const peb = (x, z, s, ry) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), pm); p.scale.set(s * (1 + rnd() * 0.25), s * 0.5, s * (0.8 + rnd() * 0.2)); p.position.set(x, s * 0.42, z); p.rotation.y = ry; p.castShadow = true; p.receiveShadow = true; g.add(p);
  };
  const h = SIDE / 2;
  peb(-h - 5.5, h + 3.4, 2.1, 0.4); peb(-h - 2.2, h + 7.2, 1.5, 1.9); peb(-h - 9.8, h + 8.6, 1.2, 0.2);
  peb(h + 6.4, -h - 4.4, 1.7, 1.2); peb(h + 9.8, -h - 0.4, 1.2, 2.4);
  g.userData.dispose = () => { m.geometry.dispose(); };
  return g;
}

// a small bronze oil lamp (the warm light of the marble scene)
export function buildLamp() {
  const g = new THREE.Group();
  const bronze = B.material('brass', { color: '#a8782a', color2: '#e0b45a', size: 256, roughness: 0.34 });
  const prof = [[0, 0], [2.6, 0], [3.4, 0.5], [3.7, 1.2], [3.2, 2.1], [2.0, 2.5], [1.2, 2.7], [0, 2.8]];
  const body = new THREE.Mesh(B.lathe(prof, 36), bronze); body.castShadow = true; g.add(body);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 2.4, 14), bronze); spout.rotation.z = -1.15; spout.position.set(3.9, 2.0, 0); spout.castShadow = true; g.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.28, 10, 24, Math.PI * 1.3), bronze); handle.position.set(-3.3, 1.6, 0); handle.rotation.z = Math.PI * 0.35; g.add(handle);
  const flame = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), new THREE.MeshBasicMaterial({ map: radialTex('255,200,120', 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  flame.position.set(5.2, 3.3, 0.02); g.add(flame);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: radialTex('255,170,90', 0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.position.set(5.2, 3.3, 0.01); g.add(halo);
  const light = new THREE.PointLight(0xffa860, 900, 90, 1.8); light.position.set(5.2, 4.2, 0.5); g.add(light);
  g.userData = { flame, halo, light };
  return g;
}
