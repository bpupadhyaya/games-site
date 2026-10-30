// Fox and Geese 3D world (presentation only; no game logic). Units are centimetres, y up.
// A cross-shaped lattice board (pale birch frame, recessed slate / felt field with engraved lines and dimples for the 33 points) on a
// granite plinth in a frozen pine clearing at night, a small brass lantern beside it. The fox and the geese are tabletop carvings
// sculpted at load time from smooth signed-distance shapes (surface nets), so the animals are organic, not glued primitives.
// Board axes: x = the columns (0..6), z = the rows (row 0, the geese's far side, at -z). Point index = x + 7 * y, as in rules.js.
import * as THREE from '../vendor3d/three.js';

export const SP = 10;                                    // distance between neighbouring points
export const R_ARM = 15 + 7, R_END = 3 * SP + 7;         // the field: arm half width 22, arm length 37
export const FRAME = 3.4, SLAB_Y = 38, BOARD_H = 3.4, TOP = SLAB_Y + BOARD_H - 0.4;   // TOP = the playing field
export const BASE_R = { F: 3.4, G: 2.7 };
export const onB = (x, y) => (x >= 2 && x <= 4) || (y >= 2 && y <= 4);
export const PTS = []; for (let i = 0; i < 49; i++) if (onB(i % 7, Math.floor(i / 7))) PTS.push(i);
export const pointW = (i) => ({ x: ((i % 7) - 3) * SP, z: (Math.floor(i / 7) - 3) * SP });
const TAU = Math.PI * 2;
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const lcg = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const texOf = (c, srgb = true, rep = null) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

export function radialTex(rgb, a = 1, size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.5})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return texOf(c);
}
export function ringTex(size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(255,255,255,0.1)'); g.addColorStop(0.76, 'rgba(255,255,255,1)'); g.addColorStop(0.86, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size); return texOf(c);
}
function grain(x, w, h, c0, c1, seed, lines = 160, vertical = true) {
  const r = lcg(seed); x.fillStyle = c0; x.fillRect(0, 0, w, h);
  for (let i = 0; i < lines; i++) {
    const p = r() * (vertical ? w : h), amp = 2 + r() * 10, f = 0.002 + r() * 0.01, ph = r() * TAU;
    x.strokeStyle = r() < 0.5 ? c1 : 'rgba(0,0,0,0.18)'; x.globalAlpha = 0.08 + r() * 0.22; x.lineWidth = 0.6 + r() * 2.4; x.beginPath();
    for (let t = 0; t <= (vertical ? h : w); t += 8) { const o = p + Math.sin(t * f + ph) * amp + Math.sin(t * f * 3.1 + ph) * amp * 0.3; if (vertical) x.lineTo(o, t); else x.lineTo(t, o); }
    x.stroke();
  }
  x.globalAlpha = 1;
}
// the playing field: oak with pyrographed (burnt) lines, carved grooves, the burrow and the paw, small pines in the corners
const std = (o) => new THREE.MeshStandardMaterial(o);
const brass = () => std({ color: 0xc89a48, metalness: 1, roughness: 0.32, envMapIntensity: 1.4 });
const copper = () => std({ color: 0xc87850, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 });
function woodMat(c0, c1, seed, rough = 0.55, rep = [1, 1]) { const c = cv(256, 512); grain(c.getContext('2d'), 256, 512, c0, c1, seed, 90); return std({ map: texOf(c, true, rep), roughness: rough, metalness: 0 }); }

// ------------------------------------------------------------------------------------------ the board

// ------------------------------------------------------------------------------------------ themes (the board looks of the game: frost / slate / moss)
export const THEMES = {
  frost: { fog: 0x1a2b44, fogNear: 110, fogFar: 600, bg: 0x13203a, hemiSky: 0x8fb0e8, hemiGround: 0x1c2a3c, hemi: 0.8, key: 0xcfe0ff, keyI: 2.1, rim: 0x8fb8ff, rimI: 2.2, exposure: 1.0,
    field: ['#223646', '#162633'], line: '#eaf6ff', frame: ['#d8c9ae', 'rgba(150,120,80,0.6)'], ground: ['#dfe9f4', '#c2d2e6', '#f6faff'], fall: 'snow', snow: true, moon: '170,200,255' },
  slate: { fog: 0x141418, fogNear: 110, fogFar: 560, bg: 0x101015, hemiSky: 0x9aa0c0, hemiGround: 0x1a1612, hemi: 0.7, key: 0xffe2c0, keyI: 1.9, rim: 0x90a8ff, rimI: 1.8, exposure: 0.95,
    field: ['#34363c', '#26282d'], line: '#e8d8b0', frame: ['#4a2f1c', 'rgba(150,90,40,0.7)'], ground: ['#b8bfcc', '#9aa3b4', '#d4dbe6'], fall: 'snow', snow: true, moon: '200,190,255' },
  moss: { fog: 0x0f1c18, fogNear: 100, fogFar: 540, bg: 0x0c1814, hemiSky: 0x9ac8a8, hemiGround: 0x12180e, hemi: 0.75, key: 0xf4f0d0, keyI: 1.9, rim: 0x9affc8, rimI: 1.6, exposure: 0.98,
    field: ['#2f5a3c', '#244a30'], line: '#efe6c4', frame: ['#8a6a3e', 'rgba(70,44,20,0.7)'], ground: ['#33472c', '#2a3b24', '#4a6240'], fall: 'firefly', snow: false, moon: '170,255,200' },
};

// ------------------------------------------------------------------------------------------ the board
// the field outline (a cross), grown by m on every side; also used for the frame
function crossShape(m, inset = 0) {
  const a = R_ARM + m - inset, b = R_END + m - inset, s = new THREE.Shape();
  const P = [[-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a]];
  s.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) s.lineTo(P[i][0], P[i][1]); s.closePath(); return s;
}
const NEIGH = (i) => { const x = i % 7, y = Math.floor(i / 7); return [[1, 0], [0, 1]].filter(([dx, dy]) => onB(x + dx, y + dy)).map(([dx, dy]) => x + dx + 7 * (y + dy)); };
function fieldCanvas(size, T) {
  const c = cv(size), x = c.getContext('2d'), b = cv(size), bx = b.getContext('2d'), r = lcg(11), k = size / (2 * R_END);
  const X = (u) => (u + R_END) * k;
  const g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, T.field[0]); g.addColorStop(1, T.field[1]); x.fillStyle = g; x.fillRect(0, 0, size, size);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) { const px = r() * size, py = r() * size, s = 0.6 + r() * 1.6; x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.10)'; x.beginPath(); x.arc(px, py, s, 0, TAU); x.fill(); bx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'; bx.beginPath(); bx.arc(px, py, s, 0, TAU); bx.fill(); }
  for (let i = 0; i < 18; i++) { x.strokeStyle = 'rgba(255,255,255,0.035)'; x.lineWidth = 6 + r() * 20; x.beginPath(); x.moveTo(r() * size, r() * size); x.bezierCurveTo(r() * size, r() * size, r() * size, r() * size, r() * size, r() * size); x.stroke(); }
  const pt = (i) => { const w = pointW(i); return [X(w.x), X(w.z)]; };
  // engraved lines: a dark groove, a light inner edge
  const lines = (ctx, col, w, off = 0) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); for (const i of PTS) for (const j of NEIGH(i)) { const [x0, y0] = pt(i), [x1, y1] = pt(j); ctx.moveTo(x0 + off, y0 + off); ctx.lineTo(x1 + off, y1 + off); } ctx.stroke(); };
  lines(x, 'rgba(0,0,0,0.6)', 9, 1.5); lines(x, T.line, 5.4); lines(bx, '#202020', 9);
  // the bounding rule round the field, and dimples at the points
  for (const i of PTS) {
    const [px, py] = pt(i), centre = i === 24;
    x.fillStyle = 'rgba(0,0,0,0.45)'; x.beginPath(); x.arc(px, py, k * 2.7, 0, TAU); x.fill();
    const gr = x.createRadialGradient(px, py, k * 0.3, px, py, k * 2.7); gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.0)'); gr.addColorStop(1, 'rgba(255,255,255,0.35)'); x.fillStyle = gr; x.beginPath(); x.arc(px, py, k * 2.7, 0, TAU); x.fill();
    x.strokeStyle = T.line; x.lineWidth = centre ? 5 : 3; x.beginPath(); x.arc(px, py, k * (centre ? 3.4 : 2.9), 0, TAU); x.stroke();
    const bg = bx.createRadialGradient(px, py, 0, px, py, k * 3); bg.addColorStop(0, '#303030'); bg.addColorStop(0.75, '#505050'); bg.addColorStop(1, '#808080'); bx.fillStyle = bg; bx.beginPath(); bx.arc(px, py, k * 3, 0, TAU); bx.fill();
  }
  return { map: texOf(c), bump: texOf(b, false) };
}
export function buildBoard(T, texSize = 1024) {
  const g = new THREE.Group();
  const frameMat = woodMat(T.frame[0], T.frame[1], 3, 0.45, [1, 1]);
  // frame: a cross-shaped ring, bevelled, with the field recessed inside
  const ring = crossShape(FRAME); ring.holes.push(new THREE.Path(crossShape(0).getPoints().reverse()));
  const fg = new THREE.ExtrudeGeometry(ring, { depth: BOARD_H - 0.6, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.7, bevelSegments: 4 });
  fg.rotateX(-Math.PI / 2); fg.translate(0, SLAB_Y, 0);
  const frame = new THREE.Mesh(fg, frameMat); frame.castShadow = true; frame.receiveShadow = true; g.add(frame);
  const tx = fieldCanvas(texSize, T);
  const fgeo = new THREE.ExtrudeGeometry(crossShape(0.05), { depth: BOARD_H - 0.4 - 0.05, bevelEnabled: false });
  fgeo.rotateX(-Math.PI / 2); fgeo.translate(0, SLAB_Y, 0);
  const uv = fgeo.attributes.uv, pos = fgeo.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + R_END) / (2 * R_END), 1 - (pos.getZ(i) + R_END) / (2 * R_END));
  const field = new THREE.Mesh(fgeo, std({ map: tx.map, bumpMap: tx.bump, bumpScale: 1.4, roughness: 0.6 })); field.receiveShadow = true; g.add(field);
  // brass pins in the four outer corners of the frame and a brass rule round the field
  const b = brass(), pin = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 20);
  for (const [px, pz] of [[-R_ARM - FRAME / 2, -R_END - FRAME / 2], [R_ARM + FRAME / 2, -R_END - FRAME / 2], [-R_ARM - FRAME / 2, R_END + FRAME / 2], [R_ARM + FRAME / 2, R_END + FRAME / 2], [-R_END - FRAME / 2, -R_ARM - FRAME / 2], [R_END + FRAME / 2, -R_ARM - FRAME / 2], [-R_END - FRAME / 2, R_ARM + FRAME / 2], [R_END + FRAME / 2, R_ARM + FRAME / 2]]) {
    const m = new THREE.Mesh(pin, b); m.position.set(px, SLAB_Y + BOARD_H + 0.05, pz); m.castShadow = true; g.add(m);
  }
  const inlay = new THREE.Mesh(new THREE.ExtrudeGeometry((() => { const s = crossShape(0.55); s.holes.push(new THREE.Path(crossShape(0.1).getPoints().reverse())); return s; })(), { depth: 0.25, bevelEnabled: false }), b);
  inlay.geometry.rotateX(-Math.PI / 2); inlay.position.y = SLAB_Y + BOARD_H - 0.45; g.add(inlay);
  g.userData.field = field;
  return g;
}

// ------------------------------------------------------------------------------------------ the scenery
function snowCanvas(size, T) {
  const c = cv(size), x = c.getContext('2d'), r = lcg(5); x.fillStyle = T.ground[0]; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 400; i++) { x.fillStyle = r() < 0.5 ? T.ground[1] : T.ground[2]; x.globalAlpha = 0.18; x.beginPath(); x.arc(r() * size, r() * size, 20 + r() * 80, 0, TAU); x.fill(); }
  x.globalAlpha = 1;
  for (let i = 0; i < 5000; i++) { x.fillStyle = r() < 0.5 ? T.ground[2] : T.ground[1]; x.globalAlpha = 0.5; x.beginPath(); x.arc(r() * size, r() * size, 1 + r() * 2.8, 0, TAU); x.fill(); }
  if (!T.snow) for (let i = 0; i < 9000; i++) { x.strokeStyle = r() < 0.5 ? '#3d5a30' : '#223018'; x.globalAlpha = 0.5; x.lineWidth = 1; const px = r() * size, py = r() * size; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 6, py - 6 - r() * 8); x.stroke(); }
  x.globalAlpha = 1; return c;
}
function graniteCanvas(size) {
  const c = cv(size), x = c.getContext('2d'), r = lcg(9); x.fillStyle = '#4a4e56'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) { const v = Math.floor(60 + r() * 120); x.fillStyle = `rgba(${v},${v},${v + 8},${0.25 + r() * 0.4})`; x.fillRect(r() * size, r() * size, 1 + r() * 3, 1 + r() * 3); }
  for (let i = 0; i < 1200; i++) { x.fillStyle = r() < 0.5 ? 'rgba(250,240,230,0.5)' : 'rgba(20,20,24,0.6)'; x.fillRect(r() * size, r() * size, 1, 1.5); }
  return c;
}
function pine(h, r) {
  const g = new THREE.Group(), mat = std({ color: 0x1c3a2a, roughness: 0.9 }), snow = std({ color: 0xe8f0fa, roughness: 0.95 });
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.08, r * 0.12, h * 0.25, 8), std({ color: 0x3a2a1c, roughness: 0.9 })); tr.position.y = h * 0.125; g.add(tr);
  for (let i = 0; i < 4; i++) { const f = i / 4, rr = r * (1 - f * 0.72), hh = h * 0.42, y = h * (0.18 + f * 0.62); const c = new THREE.Mesh(new THREE.CylinderGeometry(0, rr, hh, 10), mat); c.position.y = y + hh / 2 - h * 0.05; c.castShadow = false; g.add(c); const s = new THREE.Mesh(new THREE.CylinderGeometry(0, rr * 0.82, hh * 0.55, 10), snow); s.position.y = y + hh * 0.5 + hh * 0.2 - h * 0.05; s.scale.set(0.98, 1, 0.98); g.add(s); }
  return g;
}
export function buildClearing(scene, themeKey, quality = 1) {
  const T = THEMES[themeKey] ?? THEMES.frost, g = new THREE.Group();
  const gt = texOf(snowCanvas(1024, T), true, [14, 14]);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 48), std({ map: gt, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  // the granite plinth the board stands on, a drift of snow round its foot
  const gm = std({ map: texOf(graniteCanvas(512), true, [2, 1]), roughness: 0.55, metalness: 0.05 });
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(70, 76, SLAB_Y, 56), gm); slab.position.y = SLAB_Y / 2; slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(73, 70.5, 2.2, 56), gm); cap.position.y = SLAB_Y - 1.1; cap.castShadow = true; cap.receiveShadow = true; g.add(cap);
  const drift = new THREE.Mesh(new THREE.TorusGeometry(76, 6, 14, 64), std({ color: T.snow ? 0xeaf2fb : 0x3a4a30, roughness: 0.95 })); drift.rotation.x = Math.PI / 2; drift.scale.z = 0.5; drift.position.y = 1.5; drift.receiveShadow = true; g.add(drift);
  // snow on the plinth's rim
  if (T.snow) { const rim = new THREE.Mesh(new THREE.TorusGeometry(70.5, 1.6, 10, 64), std({ color: 0xf2f7fd, roughness: 0.9 })); rim.rotation.x = Math.PI / 2; rim.position.y = SLAB_Y - 0.1; g.add(rim); }
  // pines fading into the haze
  const rr = lcg(77), n = quality ? 46 : 26;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rr() * 0.12, d = 230 + rr() * 200, h = 60 + rr() * 70, t = pine(h, h * 0.33); t.position.set(Math.cos(a) * d, 0, Math.sin(a) * d - 30); t.rotation.y = rr() * TAU; g.add(t); }
  // the moon: a soft disc far behind the far arm
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), new THREE.MeshBasicMaterial({ map: radialTex(T.moon, 1, 128), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.85 }));
  moon.position.set(-80, 150, -380); moon.lookAt(0, 80, 60); g.add(moon);
  // a small brass lantern beside the board: warm light against the cold
  const lan = new THREE.Group(), b = brass();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, 0.9, 20), b), glass = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 4.4, 20), new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa84a, emissiveIntensity: 1.6, roughness: 0.3, transparent: true, opacity: 0.92 }));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0, 2.8, 2.2, 20), b), ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.18, 8, 16), b);
  base.position.y = 0.45; glass.position.y = 3.3; top.position.y = 6.6; ring.position.y = 8.2; lan.add(base, glass, top, ring);
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 4.5, 4, 1, true), b); bars.position.y = 3.3; bars.rotation.y = Math.PI / 4; bars.material = new THREE.MeshStandardMaterial({ color: 0xc89a48, metalness: 1, roughness: 0.4, wireframe: true }); lan.add(bars);
  lan.position.set(-R_END - 8, SLAB_Y + 0.3, R_ARM + 12); lan.rotation.y = 0.4; lan.traverse((o) => { if (o.isMesh) o.castShadow = false; }); g.add(lan);
  const light = new THREE.PointLight(0xffa24a, 900, 0, 2); light.position.set(-R_END - 8, SLAB_Y + 4.6, R_ARM + 12); g.add(light); g.userData.lantern = light;
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: radialTex('255,170,80', 0.85), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.55 }));
  halo.position.copy(light.position); halo.userData.billboard = true; g.add(halo); g.userData.halo = halo;
  return g;
}
export function buildLights(scene, themeKey) {
  const T = THEMES[themeKey] ?? THEMES.frost;
  const hemi = new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemi); scene.add(hemi);
  const key = new THREE.DirectionalLight(T.key, T.keyI); key.position.set(-70, 150, 80); key.target.position.set(0, SLAB_Y, 0);
  key.castShadow = true; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
  const sc = key.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 40; sc.far = 340;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(T.rim, T.rimI); rim.position.set(80, 70, -140); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffd0a0, 0.75); fill.position.set(60, 40, 120); scene.add(fill);
  return { hemi, key, rim, fill };
}
export function applyTheme(scene, lights, themeKey) {
  const T = THEMES[themeKey] ?? THEMES.frost;
  scene.background = new THREE.Color(T.bg); scene.fog = new THREE.Fog(T.fog, T.fogNear, T.fogFar);
  lights.hemi.color.setHex(T.hemiSky); lights.hemi.groundColor.setHex(T.hemiGround); lights.hemi.intensity = T.hemi;
  lights.key.color.setHex(T.key); lights.key.intensity = T.keyI; lights.rim.color.setHex(T.rim); lights.rim.intensity = T.rimI;
  return T;
}

// ------------------------------------------------------------------------------------------ sculpting: signed distances + surface nets
const ellipsoid = (c, r, rot) => { const m = rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)).invert().elements : null; return { t: 'e', c, r, m }; };
const cone = (a, b, r1, r2) => ({ t: 'c', a, b, r1, r2 });
function dist(p, s) {
  if (s.t === 'e') {
    let x = p[0] - s.c[0], y = p[1] - s.c[1], z = p[2] - s.c[2];
    if (s.m) { const e = s.m, X = e[0] * x + e[4] * y + e[8] * z, Y = e[1] * x + e[5] * y + e[9] * z, Z = e[2] * x + e[6] * y + e[10] * z; x = X; y = Y; z = Z; }
    const [a, b, c] = s.r, k0 = Math.hypot(x / a, y / b, z / c), k1 = Math.hypot(x / (a * a), y / (b * b), z / (c * c));
    return k1 < 1e-9 ? -Math.min(a, b, c) : (k0 * (k0 - 1)) / k1;
  }
  // round cone (Inigo Quilez)
  const { a, b, r1, r2 } = s, bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], l2 = bx * bx + by * by + bz * bz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const px = p[0] - a[0], py = p[1] - a[1], pz = p[2] - a[2], y = px * bx + py * by + pz * bz, z = y - l2;
  const xx = px * l2 - bx * y, xy = py * l2 - by * y, xz = pz * l2 - bz * y, x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2, k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
// parts: [{ s: shape, k: blend radius, col: [r,g,b] }]; paint(p, col) may recolour by position (markings)
// Async: yields to the browser every ~6 ms so building the pieces never blocks a frame (the title stays smooth while the 3D loads).
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
async function sculpt(parts, step, paint) {
  let t0 = now(); const breathe = async () => { if (now() - t0 > 6) { await new Promise((r) => setTimeout(r, 0)); t0 = now(); } };
  const f = (p) => { let d = 1e9; for (const q of parts) d = smin(d, dist(p, q.s), q.k ?? 0.3); return d; };
  // bounds from the shapes
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const { s } of parts) {
    const pts = s.t === 'e' ? [[s.c, Math.max(...s.r)]] : [[s.a, s.r1], [s.b, s.r2]];
    for (const [c, r] of pts) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], c[i] - r - 0.4); hi[i] = Math.max(hi[i], c[i] + r + 0.4); }
  }
  const n = lo.map((v, i) => Math.ceil((hi[i] - v) / step) + 1), [nx, ny, nz] = n, V = new Float32Array(nx * ny * nz), I = (i, j, k) => i + nx * (j + ny * k), p = [0, 0, 0];
  for (let k = 0; k < nz; k++) { for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { p[0] = lo[0] + i * step; p[1] = lo[1] + j * step; p[2] = lo[2] + k * step; V[I(i, j, k)] = f(p); } await breathe(); }
  const cid = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1), C = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k), P = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cs = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const v = V[I(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]; cs[c] = v; if (v < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of E) {
      if ((cs[a] < 0) === (cs[b] < 0)) continue;
      const t = cs[a] / (cs[a] - cs[b]);
      sx += (a & 1) + (((b & 1) - (a & 1)) * t); sy += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1)) * t); sz += ((a >> 2) & 1) + ((((b >> 2) & 1) - ((a >> 2) & 1)) * t); cnt++;
    }
    cid[C(i, j, k)] = P.length / 3;
    P.push(lo[0] + (i + sx / cnt) * step, lo[1] + (j + sy / cnt) * step, lo[2] + (k + sz / cnt) * step);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = V[I(i, j, k)] < 0, b = V[I(i + 1, j, k)] < 0; if (a !== b) quad(cid[C(i, j - 1, k - 1)], cid[C(i, j, k - 1)], cid[C(i, j, k)], cid[C(i, j - 1, k)], b); }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const a = V[I(i, j, k)] < 0, b = V[I(i, j + 1, k)] < 0; if (a !== b) quad(cid[C(i - 1, j, k - 1)], cid[C(i - 1, j, k)], cid[C(i, j, k)], cid[C(i, j, k - 1)], b); }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const a = V[I(i, j, k)] < 0, b = V[I(i, j, k + 1)] < 0; if (a !== b) quad(cid[C(i - 1, j - 1, k)], cid[C(i, j - 1, k)], cid[C(i, j, k)], cid[C(i - 1, j, k)], b); }
  // pull each vertex onto the surface, normals from the field's gradient, colours from the nearest part
  const nv = P.length / 3, N = new Float32Array(nv * 3), COL = new Float32Array(nv * 3), h = step * 0.35, q = [0, 0, 0], g = [0, 0, 0];
  const grad = (x, y, z) => { q[0] = x + h; q[1] = y; q[2] = z; const a = f(q); q[0] = x - h; const b = f(q); q[0] = x; q[1] = y + h; const c = f(q); q[1] = y - h; const d = f(q); q[1] = y; q[2] = z + h; const e = f(q); q[2] = z - h; const ff = f(q); g[0] = a - b; g[1] = c - d; g[2] = e - ff; return g; };
  for (let v = 0; v < nv; v++) {
    if ((v & 63) === 0) await breathe();
    let x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    for (let it = 0; it < 2; it++) { q[0] = x; q[1] = y; q[2] = z; const d = f(q); grad(x, y, z); const l2 = (g[0] ** 2 + g[1] ** 2 + g[2] ** 2) / (4 * h * h); if (l2 < 1e-8) break; const s = d / l2 / (2 * h); x -= g[0] * s; y -= g[1] * s; z -= g[2] * s; }
    P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
    grad(x, y, z); const l = Math.hypot(g[0], g[1], g[2]) || 1; N[v * 3] = g[0] / l; N[v * 3 + 1] = g[1] / l; N[v * 3 + 2] = g[2] / l;
    // colour: soft blend of the nearest parts
    q[0] = x; q[1] = y; q[2] = z; let wsum = 0; const c = [0, 0, 0];
    const ds = parts.map((pt) => dist(q, pt.s)), dm = Math.min(...ds);
    parts.forEach((pt, i) => { const w = Math.exp(-(ds[i] - dm) / 0.12); wsum += w; c[0] += pt.col[0] * w; c[1] += pt.col[1] * w; c[2] += pt.col[2] * w; });
    c[0] /= wsum; c[1] /= wsum; c[2] /= wsum;
    if (paint) paint(q, c, N.subarray(v * 3, v * 3 + 3));
    COL[v * 3] = c[0]; COL[v * 3 + 1] = c[1]; COL[v * 3 + 2] = c[2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.BufferAttribute(COL, 3));
  geo.setIndex(idx);
  // fix winding against the field normals (cheap and robust)
  const ix = geo.index.array;
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t], ix[t + 1], ix[t + 2]];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * (N[a * 3] + N[b * 3] + N[c * 3]) + fy * (N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1]) + fz * (N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2]) < 0) { ix[t + 1] = c; ix[t + 2] = b; }
  }
  geo.computeBoundingSphere();
  return geo;
}
const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const mix = (c, t, w) => { c[0] += (t[0] - c[0]) * w; c[1] += (t[1] - c[1]) * w; c[2] += (t[2] - c[2]) * w; };
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The hare, sitting up alert on its plinth, facing +z. ~8 cm to the ear tips. Ears are separate meshes so they can twitch.

// The fox, sitting up alert on its plinth, facing +z. ~7 cm to the ears. The brush (tail) is separate so it can sway.
export async function foxGeos(set = 'classic', step = 0.12) {
  const dusk = set === 'dusk';
  const fur = rgb(dusk ? 0xa8643c : 0xe06a14), dark = rgb(dusk ? 0x7a4228 : 0xb04a0a), cream = rgb(dusk ? 0xd8d0cc : 0xf6ead6), sock = rgb(0x1a1210), nose = rgb(0x0e0a08);
  const body = [
    { s: cone([0, 1.7, -1.3], [0, 3.5, 0.35], 1.5, 1.2), k: 0, col: fur },
    { s: ellipsoid([1.05, 1.35, -0.9], [0.85, 1.35, 1.6], [-0.15, 0, 0]), k: 0.55, col: fur },
    { s: ellipsoid([-1.05, 1.35, -0.9], [0.85, 1.35, 1.6], [-0.15, 0, 0]), k: 0.55, col: fur },
    { s: ellipsoid([0, 3.0, 1.0], [0.8, 1.0, 0.55], [0.15, 0, 0]), k: 0.5, col: cream },
    { s: cone([0.56, 3.3, 0.85], [0.58, 0.45, 1.45], 0.42, 0.3), k: 0.3, col: fur },
    { s: cone([-0.56, 3.3, 0.85], [-0.58, 0.45, 1.45], 0.42, 0.3), k: 0.3, col: fur },
    { s: ellipsoid([0.58, 0.28, 1.78], [0.32, 0.26, 0.5]), k: 0.2, col: sock },
    { s: ellipsoid([-0.58, 0.28, 1.78], [-0.32, 0.26, 0.5]), k: 0.2, col: sock },
    { s: cone([0, 3.5, 0.5], [0, 4.55, 1.0], 0.95, 0.78), k: 0.55, col: fur },
    { s: ellipsoid([0, 4.95, 1.2], [0.92, 0.78, 0.98], [0.2, 0, 0]), k: 0.45, col: fur },
    { s: ellipsoid([0.58, 4.6, 1.55], [0.4, 0.38, 0.55], [0.2, 0, 0]), k: 0.35, col: cream },
    { s: ellipsoid([-0.58, 4.6, 1.55], [0.4, 0.38, 0.55], [0.2, 0, 0]), k: 0.35, col: cream },
    { s: cone([0, 4.9, 1.7], [0, 4.62, 2.65], 0.55, 0.3), k: 0.4, col: cream },
    { s: ellipsoid([0, 4.62, 2.92], [0.22, 0.17, 0.18]), k: 0.12, col: nose },
    { s: cone([0.55, 5.4, 0.85], [0.8, 6.95, 0.7], 0.46, 0.06), k: 0.12, col: fur },
    { s: cone([-0.55, 5.4, 0.85], [-0.8, 6.95, 0.7], 0.46, 0.06), k: 0.12, col: fur },
  ];
  const paint = (p, c) => {
    // dark ear backs and tips, black socks on the forelegs, a pale cheek ruff
    if (p[1] > 6.0) mix(c, sock, sstep(6.0, 6.6, p[1]));
    if (p[1] < 1.2 && p[2] > 1.0) mix(c, sock, sstep(1.2, 0.8, p[1]));
    if (p[1] < 0.6) mix(c, sock, 0.85);
    // darker haunch, lighter flank
    mix(c, dark, 0.35 * sstep(0.2, 1.6, Math.abs(p[0])) * sstep(2.6, 0.8, p[1]) * sstep(0.6, -0.8, p[2]));
    // white blaze between the eyes
    if (p[1] > 5.0 && p[2] > 1.7 && Math.abs(p[0]) < 0.18) mix(c, cream, 0.7);
  };
  const tail = await sculpt([
    { s: ellipsoid([0, 0.2, -1.5], [0.7, 0.7, 1.7], [0.25, 0, 0]), k: 0, col: fur },
    { s: ellipsoid([0, 0.55, -3.0], [0.62, 0.62, 1.1], [0.55, 0, 0]), k: 0.5, col: fur },
    { s: ellipsoid([0, 1.15, -3.9], [0.48, 0.5, 0.75], [0.8, 0, 0]), k: 0.4, col: cream },
  ], step * 0.8, (p, c) => { if (p[2] < -3.35) mix(c, cream, sstep(-3.35, -3.9, p[2])); else if (p[1] < 0.2) mix(c, dark, 0.3); });
  return { body: await sculpt(body, step, paint), tail, tailPos: [0, 1.15, -2.0], eye: new THREE.SphereGeometry(0.17, 12, 8), eyePos: [[0.46, 5.1, 1.97], [-0.46, 5.1, 1.97]] };
}
// A goose standing on its plinth, facing +z. ~6 cm to the crown. The head and neck sway a little on a pivot (separate mesh).
export async function gooseGeos(set = 'classic', step = 0.1) {
  const dusk = set === 'dusk';
  const white = rgb(dusk ? 0xdfe3ee : 0xfbf8f2), grey = rgb(dusk ? 0xaab0c4 : 0xd2cdc4), orange = rgb(0xe8821c), eyeC = rgb(0x120a06);
  const body = [
    { s: ellipsoid([0, 2.0, -0.1], [1.35, 1.25, 2.1], [-0.28, 0, 0]), k: 0, col: white },
    { s: ellipsoid([0, 2.45, 1.25], [0.95, 1.05, 0.95]), k: 0.7, col: white },
    { s: ellipsoid([1.15, 2.35, -0.35], [0.38, 0.95, 1.6], [-0.2, 0, -0.18]), k: 0.12, col: grey },
    { s: ellipsoid([-1.15, 2.35, -0.35], [0.38, 0.95, 1.6], [-0.2, 0, 0.18]), k: 0.12, col: grey },
    { s: cone([0, 2.55, -1.7], [0, 3.1, -2.9], 0.55, 0.12), k: 0.35, col: white },
    { s: cone([0.55, 1.1, 0.1], [0.55, 0.12, 0.35], 0.24, 0.2), k: 0.1, col: orange },
    { s: cone([-0.55, 1.1, 0.1], [-0.55, 0.12, 0.35], 0.24, 0.2), k: 0.1, col: orange },
    { s: ellipsoid([0.55, 0.11, 0.85], [0.42, 0.1, 0.72]), k: 0.12, col: orange },
    { s: ellipsoid([-0.55, 0.11, 0.85], [-0.42, 0.1, 0.72]), k: 0.12, col: orange },
  ];
  const paint = (p, c) => { if (p[1] < 1.3 && p[1] > 0.0) mix(c, orange, sstep(1.35, 1.0, p[1]) * 0.9); };
  // neck + head in their own frame: pivot at the base of the neck
  const neck = await sculpt([
    { s: cone([0, 0, 0], [0, 1.6, -0.1], 0.62, 0.46), k: 0, col: white },
    { s: cone([0, 1.6, -0.1], [0, 2.7, 0.5], 0.46, 0.4), k: 0.3, col: white },
    { s: ellipsoid([0, 3.0, 0.8], [0.44, 0.42, 0.6], [0.3, 0, 0]), k: 0.3, col: white },
    { s: cone([0, 2.95, 1.15], [0, 2.8, 2.0], 0.3, 0.2), k: 0.1, col: orange },
  ], step * 0.8, (p, c) => { if (p[2] > 1.55 && p[1] < 3.2) mix(c, orange, 0.95); if (p[2] > 1.2 && p[1] > 2.8 && p[1] < 3.0 && Math.abs(p[0]) < 0.3) mix(c, eyeC, 0); });
  return { body: await sculpt(body, step, paint), neck, neckPos: [0, 3.2, 1.35], eye: new THREE.SphereGeometry(0.1, 10, 8), eyePos: [[0.32, 3.12, 1.2], [-0.32, 3.12, 1.2]] };
}
export function plinthGeo(R) {
  return new THREE.LatheGeometry([[0, 0], [R - 0.25, 0], [R, 0.22], [R, 0.55], [R - 0.18, 0.72], [R - 0.28, 0.82], [R - 0.4, 0.9], [0, 0.9]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
}
export const PLINTH_H = 0.9;
export function animalMaterial() { return new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.5, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffe6c8) }); }
export function eyeMaterial() { return new THREE.MeshPhysicalMaterial({ color: 0x120a06, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 }); }
// One piece: plinth + body (+ brush / neck on pivots). Returns a group with userData { tail, neck, body }.
export function makePiece(kind, G, mats) {
  const root = new THREE.Group(), lift = new THREE.Group(); root.add(lift);
  const R = BASE_R[kind];
  const pl = new THREE.Mesh(mats.plinth[kind], kind === 'F' ? mats.walnut : mats.ash); pl.castShadow = true; pl.receiveShadow = true; lift.add(pl);
  const band = new THREE.Mesh(mats.band[kind], mats.brass); band.position.y = 0.38; lift.add(band);
  const body = new THREE.Group(); body.position.y = PLINTH_H - 0.12; lift.add(body);
  body.scale.setScalar(kind === 'F' ? 1.5 : 1.55);
  const bm = new THREE.Mesh(G.body, mats.animal); bm.castShadow = true; bm.receiveShadow = true; body.add(bm);
  if (kind === 'F') for (const e of G.eyePos) { const m = new THREE.Mesh(G.eye, mats.eye); m.position.set(...e); body.add(m); }
  const ud = { body, lift, tail: null, neck: null, R };
  if (kind === 'F') { const piv = new THREE.Group(); piv.position.set(...G.tailPos); const m = new THREE.Mesh(G.tail, mats.animal); m.castShadow = true; piv.add(m); body.add(piv); ud.tail = piv; }
  else { const piv = new THREE.Group(); piv.position.set(...G.neckPos); const m = new THREE.Mesh(G.neck, mats.animal); m.castShadow = true; m.position.set(0, 0, 0); piv.add(m); body.add(piv); ud.neck = piv; for (const e of G.eyePos) { const m2 = new THREE.Mesh(G.eye, mats.eye); m2.position.set(e[0], e[1] - G.neckPos[1], e[2] - G.neckPos[2]); piv.add(m2); } }
  root.userData = ud;
  return root;
}
export function pieceMats() {
  const walnut = woodMat('#3a2010', 'rgba(120,70,30,0.8)', 31, 0.38), ash = woodMat('#d8c49a', 'rgba(140,100,60,0.7)', 32, 0.42);
  const mkBand = (R) => new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.18, 40, 1, true);
  return { walnut, ash, brass: brass(), animal: animalMaterial(), eye: eyeMaterial(), plinth: { F: plinthGeo(BASE_R.F), G: plinthGeo(BASE_R.G) }, band: { F: mkBand(BASE_R.F), G: mkBand(BASE_R.G) } };
}
