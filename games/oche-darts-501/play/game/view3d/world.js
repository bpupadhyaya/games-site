// Oche Darts 3D world (units: millimetres, +z toward the player, the board face at z = 0). A regulation sisal board hung on a green
// baize backboard in an oak frame, a pub wall of dark green wallpaper over an oak dado rail, a brass picture light above, and brass
// and steel darts. Everything is procedural (canvas textures + analytic geometry): no image files. The board face is the same artwork
// the flat 2D layer uses, so the colours and numbers always agree with the HUD.
import * as THREE from '../vendor3d/three.js';
import { drawBoard, DART_STYLE } from '../src/art.js';

export const TAU = Math.PI * 2;
export const BOARD_MM = 170;                       // scoring edge (outer double wire) radius
export const SURROUND = 207.4;                     // number ring outer edge (the 2D art's 1.22 R)
const SEG = Math.PI / 10;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

// ---- board -----------------------------------------------------------------------------------------------------
// face art (2048 px for 2 x 1.25 x 170 mm) and a sisal bump map; both drawn once.
export function boardTextures(size = 2048) {
  const face = canvas(size), g = face.getContext('2d'), R = size / 2 / 1.25 / 1.0;     // R px = 170 mm
  drawBoard(g, size / 2, size / 2, R * 0.98, { grain: true, shadow: false });
  const bump = canvas(1024), b = bump.getContext('2d'), rnd = lcg(5);
  b.fillStyle = '#808080'; b.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 26000; i++) {
    const x = rnd() * 1024, y = rnd() * 1024, a = rnd() * TAU, l = 3 + rnd() * 9;
    b.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.34)' : 'rgba(255,255,255,0.3)'; b.lineWidth = 0.8 + rnd() * 1.2;
    b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); b.stroke();
  }
  return { face: tex(face), bump: tex(bump, false) };
}

// A brass / steel wire frame lying on the face: 6 rings and 20 radial wires, proud of the sisal by about a millimetre.
export function buildWires(mat) {
  const g = new THREE.Group();
  for (const r of [6.35, 15.9, 99, 107, 162, 170]) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.55, 6, 120), mat); m.position.z = 0.35; m.castShadow = true; g.add(m); }
  for (let i = 0; i < 20; i++) {
    const a = i * SEG + SEG / 2, len = 170 - 15.9, m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 1.3), mat), rm = (170 + 15.9) / 2;
    m.position.set(Math.sin(a) * rm, Math.cos(a) * rm, 0.5); m.rotation.z = Math.PI / 2 - a; g.add(m);
  }
  return g;
}

export function buildBoard(tier) {
  const g = new THREE.Group(), t = boardTextures(tier ? 2048 : 1024);
  const faceMat = new THREE.MeshStandardMaterial({ map: t.face, bumpMap: t.bump, bumpScale: 1.6, roughness: 0.92, metalness: 0 });
  const face = new THREE.Mesh(new THREE.CircleGeometry(SURROUND * 1.0, 96), faceMat); face.receiveShadow = true; face.position.z = 0; g.add(face);
  // the face art covers 1.25 * 170 mm either side: map the circle's UVs to it
  const uv = face.geometry.attributes.uv, pos = face.geometry.attributes.position, half = 1.25 * 170 / 0.98 / 1.0;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * half), 0.5 + pos.getY(i) / (2 * half));
  const body = new THREE.Mesh(new THREE.CylinderGeometry(SURROUND + 2, SURROUND + 2, 40, 96, 1), new THREE.MeshStandardMaterial({ color: 0x241b12, roughness: 0.8 }));
  body.rotation.x = Math.PI / 2; body.position.z = -21; body.castShadow = true; g.add(body);
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xd9dce2, roughness: 0.28, metalness: 0.95 });
  g.add(buildWires(wireMat));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(SURROUND, 2.2, 10, 128), new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.9 })); rim.position.z = 1.2; rim.castShadow = true; g.add(rim);
  // the black rubber number surround rises slightly toward the rim
  const sur = new THREE.Mesh(new THREE.TorusGeometry((170 + SURROUND) / 2 + 1, (SURROUND - 170) / 2 * 0.9, 8, 128), new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.85, transparent: true, opacity: 0.0, depthWrite: false }));
  sur.visible = false; g.add(sur);
  g.userData.dispose = () => { t.face.dispose(); t.bump.dispose(); };
  return g;
}

// ---- pub wall -----------------------------------------------------------------------------------------------------
function wallpaper() {
  const c = canvas(256), g = c.getContext('2d');
  g.fillStyle = '#17291f'; g.fillRect(0, 0, 256, 256);
  const rnd = lcg(9);
  for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '120,170,140'},${0.02 + rnd() * 0.035})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 3); }
  g.strokeStyle = 'rgba(150,200,160,0.20)'; g.lineWidth = 3;
  for (const [x, y] of [[64, 64], [192, 64], [64, 192], [192, 192], [128, 128], [0, 128], [256, 128], [128, 0], [128, 256]]) {
    g.beginPath(); g.moveTo(x, y - 46); g.lineTo(x + 40, y); g.lineTo(x, y + 46); g.lineTo(x - 40, y); g.closePath(); g.stroke();
    g.beginPath(); g.arc(x, y, 9, 0, TAU); g.stroke();
  }
  return c;
}
function wood(seed, w = 512, h = 256, base = [74, 46, 27]) {
  const c = canvas(w, h), g = c.getContext('2d'), rnd = lcg(seed);
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    const y = rnd() * h, k = (rnd() - 0.5) * 36; g.strokeStyle = `rgba(${base.map((v) => Math.max(0, Math.min(255, v + k)))},${0.35 + rnd() * 0.4})`; g.lineWidth = 0.6 + rnd() * 2.6;
    g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3 + (rnd() - 0.5) * 1.5); g.stroke();
  }
  return c;
}
function baize() {
  const c = canvas(256), g = c.getContext('2d'), rnd = lcg(3);
  g.fillStyle = '#0f3a25'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '90,160,110'},${0.04 + rnd() * 0.07})`; g.fillRect(rnd() * 256, rnd() * 256, 1, 1 + rnd() * 2); }
  return c;
}

export function buildRoom(scene) {
  const g = new THREE.Group(); scene.add(g);
  const wp = tex(wallpaper(), true, [14, 12]);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1700, 1500), new THREE.MeshStandardMaterial({ map: wp, bumpMap: wp, bumpScale: 0.6, roughness: 0.95, color: 0xffffff }));
  wall.position.set(0, 0, -62); wall.receiveShadow = true; g.add(wall);
  // dado: oak panelling with a rail, below the board
  const oak = tex(wood(11, 512, 256), true, [4, 1]);
  const oakMat = new THREE.MeshStandardMaterial({ map: oak, bumpMap: oak, bumpScale: 0.5, roughness: 0.55, metalness: 0, color: 0xb8a090 });
  const pan = new THREE.Mesh(new THREE.BoxGeometry(1700, 360, 16), oakMat); pan.position.set(0, -480, -52); pan.receiveShadow = true; pan.castShadow = true; g.add(pan);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1700, 22, 30), oakMat); rail.position.set(0, -296, -44); rail.castShadow = true; rail.receiveShadow = true; g.add(rail);
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.32, metalness: 0.92 });
  for (let i = -4; i <= 4; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(6, 330, 8), new THREE.MeshStandardMaterial({ color: 0x2c1b0f, roughness: 0.7 })); st.position.set(i * 190, -480, -42); g.add(st); }
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 1700, 12), brass); lip.rotation.z = Math.PI / 2; lip.position.set(0, -283, -26); g.add(lip);
  // baize backboard in an oak frame (the board's catch)
  const frame = new THREE.Group(); g.add(frame);
  const bz = tex(baize(), true, [3, 3]);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(470, 520), new THREE.MeshStandardMaterial({ map: bz, bumpMap: bz, bumpScale: 0.8, roughness: 1, color: 0xbfd8c6 })); back.position.set(0, 0, -44); back.receiveShadow = true; frame.add(back);
  const fm = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 26), oakMat); m.position.set(x, y, -34); m.castShadow = true; m.receiveShadow = true; frame.add(m); };
  fm(26, 572, -248, 0); fm(26, 572, 248, 0); fm(522, 26, 0, 273); fm(522, 26, 0, -273);
  for (const [x, y] of [[-222, 247], [222, 247], [-222, -247], [222, -247]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(4.5, 12, 8), brass); s.position.set(x, y, -22); s.scale.z = 0.5; frame.add(s); }
  // brass picture light above the frame
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 120, 10), brass); arm.rotation.x = Math.PI / 2; arm.position.set(0, 340, 0); g.add(arm);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(14, 22, 300, 24, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xb08a3c, roughness: 0.3, metalness: 0.9, side: THREE.DoubleSide }));
  shade.rotation.z = Math.PI / 2; shade.rotation.x = 0.1; shade.position.set(0, 332, 62); g.add(shade);
  const bulb = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 270, 10), new THREE.MeshBasicMaterial({ color: 0xffe6b0 })); bulb.rotation.z = Math.PI / 2; bulb.position.set(0, 336, 62); g.add(bulb);
  g.userData.frame = frame;
  g.userData.dispose = () => { wp.dispose(); oak.dispose(); bz.dispose(); };
  return g;
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xfff0d8, 0x2a3a30, 0.55); scene.add(hemi);
  const key = new THREE.SpotLight(0xffe2b0, 1000000, 0, 0.6, 0.8, 2);
  key.position.set(40, 190, 700); key.target.position.set(0, 0, 0); scene.add(key, key.target);
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6; key.shadow.camera.near = 200; key.shadow.camera.far = 1400;
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.5); fill.position.set(-120, 160, 600); scene.add(fill);
  return { key, hemi, fill };
}

// ---- darts ------------------------------------------------------------------------------------------------------------
// One dart as a group whose +z axis is the tail and whose tip is the origin: steel point, knurled brass or tungsten barrel, shaft, four flights.
let dartGeos = null;
function geos() {
  if (dartGeos) return dartGeos;
  const prof = [[0, 0], [0.5, 0.2], [1.0, 6], [1.15, 12], [2.4, 13], [3.1, 16], [3.5, 22], [3.5, 28], [3.2, 32], [3.5, 34], [3.5, 40], [3.2, 44], [3.5, 46], [3.5, 52], [2.9, 56], [2.0, 58], [1.5, 60], [1.5, 64]];
  const lathe = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 20);
  lathe.rotateX(Math.PI / 2);                              // lathe axis y -> z (tail positive)
  const shaft = new THREE.CylinderGeometry(1.7, 1.9, 30, 10); shaft.rotateX(Math.PI / 2); shaft.translate(0, 0, 76);
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(0, 5); fin.lineTo(22, 13); fin.lineTo(28, 12); fin.lineTo(32, 0); fin.lineTo(0, 0);
  const finG = new THREE.ShapeGeometry(fin); finG.rotateY(-Math.PI / 2);      // shape x -> +z (tail), y stays radial
  finG.translate(0, 0, 66);
  dartGeos = { lathe, shaft, finG };
  return dartGeos;
}
export function buildDart(style) {
  const S = DART_STYLE[style], gg = geos(), g = new THREE.Group();
  const barrelMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(S.barrel[0]), roughness: 0.38, metalness: 0.65, envMapIntensity: 2.5, side: THREE.DoubleSide });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.2, metalness: 1 });
  const barrel = new THREE.Mesh(gg.lathe, barrelMat); barrel.castShadow = true; g.add(barrel);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 1.15, 14, 10), tipMat); tip.rotation.x = -Math.PI / 2; tip.position.z = 6; g.add(tip);
  const shaft = new THREE.Mesh(gg.shaft, new THREE.MeshStandardMaterial({ color: new THREE.Color(S.shaft), roughness: 0.5, metalness: 0.4 })); shaft.castShadow = true; g.add(shaft);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(gg.finG, new THREE.MeshStandardMaterial({ color: new THREE.Color(i % 2 ? S.flightB : S.flightA), roughness: 0.6, side: THREE.DoubleSide }));
    m.rotation.z = i * Math.PI / 2; m.castShadow = true; g.add(m);
  }
  g.visible = false;
  return g;
}
