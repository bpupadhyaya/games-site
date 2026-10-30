// The 3D world for Go, all procedural (no bitmaps): a thick kaya-wood goban on four turned feet, glossy slate and lens-cut shell stones,
// two turned-wood go-ke bowls with their lids, on tatami in a quiet room with a shoji screen glowing in the late light. Units are
// centimetres; y is up; the board face is at y = TOP; grid row 0 is the far row (-z), column 0 is on the left.
import * as THREE from '../vendor3d/three.js';

export const FACE = 46;                    // the playing surface (margins included), a square
export const THICK = 8.6, LEG = 6.4;       // a real goban is a thick block on short feet
export const TOP = THICK + LEG;
export const HALF = FACE / 2;
export const STONE_H = 0.58;               // stone height as a fraction of its radius
export const BOWL_Z = HALF + 5.2, BOWL_X = 19, LID_X = 7.4, BOWL_S = 0.6;   // go-ke on the floor at the near corners, a lid beside each

// spacing, margin and stone radius for an n x n board (the same proportions as the flat 2D board)
export const spacing = (n) => FACE / (n - 1 + 1.3);
export const stoneRadius = (n) => spacing(n) * 0.485;
export function pointXZ(n, i) {
  const d = spacing(n), c = i % n, r = Math.floor(i / n);
  return { x: (c - (n - 1) / 2) * d, z: (r - (n - 1) / 2) * d };
}
export function gridXZ(n, c, r) { const d = spacing(n); return { x: (c - (n - 1) / 2) * d, z: (r - (n - 1) / 2) * d }; }
export const starPoints = (n) => {
  if (n === 19) return [3, 9, 15].flatMap((y) => [3, 9, 15].map((x) => y * 19 + x));
  if (n === 13) return [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]].map(([x, y]) => y * 13 + x);
  if (n === 9) return [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]].map(([x, y]) => y * 9 + x);
  if (n === 7) return [24];
  return n >= 5 ? [Math.floor(n / 2) * n + Math.floor(n / 2)] : [];
};

const rnd = (s) => { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

export function radialTex(rgb = '255,255,255', a = 1) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}

// decals lying on the board / on a stone: ring, disc, square outline, filled square, cross
export function markTextures() {
  const make = (draw) => { const c = canvas(128), x = c.getContext('2d'); x.lineCap = 'round'; draw(x); return tex(c); };
  return {
    ring: make((x) => { x.strokeStyle = '#fff'; x.lineWidth = 13; x.beginPath(); x.arc(64, 64, 52, 0, 7); x.stroke(); }),
    softring: make((x) => { const g = x.createRadialGradient(64, 64, 26, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.18)'); g.addColorStop(0.74, 'rgba(255,255,255,1)'); g.addColorStop(0.88, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }),
    disc: make((x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 60); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.8, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }),
    sq: make((x) => { x.strokeStyle = '#fff'; x.lineWidth = 14; x.strokeRect(20, 20, 88, 88); }),
    sqf: make((x) => { x.fillStyle = '#fff'; x.beginPath(); x.roundRect(14, 14, 100, 100, 10); x.fill(); }),
    x: make((x) => { x.strokeStyle = '#fff'; x.lineWidth = 16; x.beginPath(); x.moveTo(24, 24); x.lineTo(104, 104); x.moveTo(104, 24); x.lineTo(24, 104); x.stroke(); }),
  };
}

// ------------------------------------------------------------------------------------------------ the board
const KAYA = {
  kaya: { face: ['#ecc880', '#e0b266', '#d4a255'], grain: [128, 82, 30], line: '#24160a', side: 0xb98b4e, leg: 0x9a6c36 },
  dark: { face: ['#c99958', '#b7823f', '#a06e32'], grain: [80, 44, 14], line: '#1a0f05', side: 0x8a5a28, leg: 0x6e451c },
  ash: { face: ['#f1deb0', '#e7cf98', '#dcc082'], grain: [150, 112, 60], line: '#2c1c0c', side: 0xc6a368, leg: 0xa98349 },
};
export const kayaOf = (id) => KAYA[id] || KAYA.kaya;

export function faceMap(n, th, size) {
  const K = kayaOf(th), W = size, k = W / FACE, c = canvas(W), x = c.getContext('2d'), r = rnd(7 + n);
  const g = x.createLinearGradient(0, 0, W, W);
  g.addColorStop(0, K.face[0]); g.addColorStop(0.55, K.face[1]); g.addColorStop(1, K.face[2]);
  x.fillStyle = g; x.fillRect(0, 0, W, W);
  const G = K.grain;
  for (let i = 0; i < 230; i++) {
    const yy = r() * W, amp = 3 + r() * 11, ph = r() * 6, dark = r() < 0.5;
    x.strokeStyle = dark ? `rgba(${G[0]},${G[1]},${G[2]},${0.07 + r() * 0.15})` : `rgba(255,235,190,${0.04 + r() * 0.07})`;
    x.lineWidth = (0.6 + r() * (dark ? 2.6 : 1.6)) * W / 1024;
    x.beginPath();
    for (let xx = -10; xx <= W + 10; xx += W / 48) { const v = yy + Math.sin(xx / W * 5 + ph) * amp * W / 1024 + Math.sin(xx / W * 19 + ph * 2) * amp * 0.25 * W / 1024; xx < 0 ? x.moveTo(xx, v) : x.lineTo(xx, v); }
    x.stroke();
  }
  for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(${G[0]},${G[1]},${G[2]},${0.05 + r() * 0.09})`; x.fillRect(r() * W, r() * W, (4 + r() * 18) * W / 1024, (0.8 + r()) * W / 1024); }
  const d = spacing(n), m = d * 0.65, p = (c0) => (m + c0 * d) * k;
  x.strokeStyle = K.line; x.lineCap = 'butt';
  for (let q = 0; q < n; q++) {
    x.lineWidth = (q === 0 || q === n - 1 ? 0.2 : 0.125) * k * (n > 13 ? 0.9 : 1); x.globalAlpha = 0.92;
    x.beginPath(); x.moveTo(p(q), p(0)); x.lineTo(p(q), p(n - 1)); x.moveTo(p(0), p(q)); x.lineTo(p(n - 1), p(q)); x.stroke();
  }
  x.globalAlpha = 1; x.fillStyle = K.line;
  for (const i of starPoints(n)) { x.beginPath(); x.arc(p(i % n), p(Math.floor(i / n)), Math.max(0.2, d * 0.085) * k, 0, 7); x.fill(); }
  if (n >= 9) {
    x.fillStyle = 'rgba(58,34,10,0.62)'; x.font = `600 ${Math.max(10, d * 0.3 * k)}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let q = 0; q < n; q++) { x.fillText('ABCDEFGHJKLMNOPQRST'[q], p(q), m * 0.42 * k); x.fillText(String(n - q), m * 0.42 * k, p(q)); }
  }
  const bump = canvas(W >> 1), y = bump.getContext('2d'); y.drawImage(c, 0, 0, W >> 1, W >> 1);
  const T = tex(c), B = tex(bump, false);
  return { map: T, bump: B };
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function buildBoard(n, th, texSize = 1536) {
  const grp = new THREE.Group(), K = kayaOf(th), { map, bump } = faceMap(n, th, texSize);
  const shape = roundedRect(FACE - 1, FACE - 1, 1.2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: THICK - 0.6, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.5, bevelSegments: 3, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, LEG, 0);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + HALF) / FACE, 1 - (pos.getZ(i) + HALF) / FACE);
  const top = new THREE.MeshPhysicalMaterial({ map, color: 0xf6d9a6, bumpMap: bump, bumpScale: 0.35, roughness: 0.5, clearcoat: 0.22, clearcoatRoughness: 0.5 });
  const side = new THREE.MeshStandardMaterial({ map, color: K.side, roughness: 0.62 });
  const slab = new THREE.Mesh(geo, [top, side]); slab.castShadow = true; slab.receiveShadow = true; grp.add(slab);
  // four turned feet
  const prof = [[0, 0], [2.7, 0], [3.0, 0.25], [2.75, 1.2], [2.3, 2.4], [2.15, 3.4], [2.6, 4.7], [3.2, 5.7], [3.5, LEG + 0.1], [0, LEG + 0.1]].map(([a, b]) => new THREE.Vector2(a, b));
  const lg = new THREE.LatheGeometry(prof, 24), lm = new THREE.MeshStandardMaterial({ color: K.leg, roughness: 0.55, map });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const m = new THREE.Mesh(lg, lm); m.position.set(sx * (HALF - 7.5), 0, sz * (HALF - 7.5)); m.castShadow = true; m.receiveShadow = true; grp.add(m); }
  // a dark brace between the feet suggests the hollow under the block
  grp.userData.dispose = () => { geo.dispose(); lg.dispose(); map.dispose(); bump.dispose(); top.dispose(); side.dispose(); lm.dispose(); };
  return grp;
}

// ------------------------------------------------------------------------------------------------ stones
// One lens-shaped stone of radius 1: flat underneath, domed on top, with a small rounded rim (scaled to the board's stone radius per instance).
export function stoneGeo() {
  // profile from the bottom centre outwards and up over the dome (the order LatheGeometry wants for outward faces)
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(0.94, 0), new THREE.Vector2(0.995, 0.045)];
  const N = 24;
  for (let i = N; i >= 0; i--) {
    const t = i / N, r = Math.pow(t, 0.92), h = 0.07 + (STONE_H - 0.07) * Math.pow(Math.max(0, 1 - Math.pow(r, 2.5)), 0.62);
    pts.push(new THREE.Vector2(r * 0.985, h));
  }
  return new THREE.LatheGeometry(pts, 72);
}
export function stoneMaterials() {
  const black = new THREE.MeshPhysicalMaterial({ color: 0x15161b, roughness: 0.32, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.3 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf1ece0, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.6, sheenColor: new THREE.Color('#fff3da'), envMapIntensity: 0.9 });
  const ghost = (m, o) => { const c = m.clone(); c.transparent = true; c.opacity = o; c.depthWrite = false; return c; };
  return { 1: black, 2: white, g1: ghost(black, 0.72), g2: ghost(white, 0.72) };
}

// ------------------------------------------------------------------------------------------------ bowls and lids
export function buildBowl(kind) {
  const grp = new THREE.Group();
  const wood = new THREE.MeshPhysicalMaterial({ color: kind === 1 ? 0x6a3d1e : 0x8a5a2e, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const inner = new THREE.MeshStandardMaterial({ color: 0x2a160a, roughness: 0.75 });
  const R = 6.6, Hh = 7.4;
  const prof = [[0, 0], [R * 0.52, 0], [R * 0.6, 0.3], [R * 0.62, 0.9], [R * 0.95, Hh * 0.55], [R, Hh * 0.9], [R + 0.28, Hh + 0.2], [R - 0.05, Hh + 0.5], [R - 0.55, Hh * 0.92], [R * 0.88, Hh * 0.6], [R * 0.45, 1.6], [0, 1.5]].map(([a, b]) => new THREE.Vector2(a, b));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), wood); body.castShadow = true; body.receiveShadow = true; grp.add(body);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R * 0.5, 24), inner); floor.rotation.x = -Math.PI / 2; floor.position.y = 1.52; grp.add(floor);
  // the lid, turned upside down: a shallow dish for prisoners
  const lp = [[0, 0.05], [3.6, 0.05], [4.2, 0.2], [5.4, 0.9], [5.9, 1.6], [5.55, 1.7], [5.0, 1.1], [4.1, 0.55], [0, 0.45]].map(([a, b]) => new THREE.Vector2(a, b));
  const lid = new THREE.Mesh(new THREE.LatheGeometry(lp, 40), wood); lid.castShadow = true; lid.receiveShadow = true; lid.position.set(kind === 1 ? LID_X : -LID_X, 0, 0.8); grp.add(lid);
  grp.scale.setScalar(BOWL_S);
  grp.userData.dispose = () => { body.geometry.dispose(); lid.geometry.dispose(); floor.geometry.dispose(); wood.dispose(); inner.dispose(); };
  return grp;
}
export const LID_RADIUS = 4.4;
// landscape screens with room put the bowls beside the board (SIDE.on) instead of in front of it
export const SIDE = { on: false };
export const bowlCentre = (kind) => (SIDE.on ? { x: kind === 1 ? -(HALF + 9.4) : HALF + 9.4, z: HALF * 0.45 } : { x: kind === 1 ? -BOWL_X : BOWL_X, z: BOWL_Z });
export const lidCentre = (kind) => { const c = bowlCentre(kind); return { x: c.x + (kind === 1 ? LID_X : -LID_X) * BOWL_S, z: c.z + 0.8 * BOWL_S }; };

// ------------------------------------------------------------------------------------------------ the room
function tatamiTex() {
  const W = 1024, c = canvas(W), x = c.getContext('2d'), r = rnd(5), mw = W / 2;
  for (let m = 0; m < 2; m++) {
    const x0 = m * mw, g = x.createLinearGradient(x0, 0, x0 + mw, 0), base = m ? [84, 78, 42] : [89, 83, 45];
    g.addColorStop(0, `rgb(${base[0] - 6},${base[1] - 6},${base[2] - 4})`); g.addColorStop(0.5, `rgb(${base[0] + 8},${base[1] + 8},${base[2] + 4})`); g.addColorStop(1, `rgb(${base[0] - 6},${base[1] - 6},${base[2] - 4})`);
    x.fillStyle = g; x.fillRect(x0, 0, mw, W);
    for (let i = 0; i < 520; i++) { const xx = x0 + 28 + r() * (mw - 56), l = r() < 0.5; x.strokeStyle = l ? `rgba(176,166,96,${0.03 + r() * 0.06})` : `rgba(48,44,16,${0.03 + r() * 0.05})`; x.lineWidth = 0.7 + r() * 1.3; x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx + (r() - 0.5) * 3, W); x.stroke(); }
    // the cloth border (heri): dark green-black bands down both long edges
    for (const bx of [x0 + 2, x0 + mw - 14]) { x.fillStyle = '#34391f'; x.fillRect(bx, 0, 12, W); }
    x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(x0, 0, 2, W);
  }
  const T = tex(c); T.wrapS = T.wrapT = THREE.RepeatWrapping; return T;
}
function shojiTex() {
  const W = 1024, H = 512, c = canvas(W, H), x = c.getContext('2d'), r = rnd(11);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f2cf8c'); g.addColorStop(0.55, '#f7dfa6'); g.addColorStop(1, '#e2b66a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const gl = x.createRadialGradient(W * 0.3, H * 0.25, 20, W * 0.3, H * 0.3, W * 0.75); gl.addColorStop(0, 'rgba(255,246,214,0.8)'); gl.addColorStop(1, 'rgba(255,200,120,0)');
  x.fillStyle = gl; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i++) { x.strokeStyle = `rgba(150,110,50,${0.04 + r() * 0.07})`; x.lineWidth = 0.7; const fx = r() * W, fy = r() * H; x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + 8 + r() * 20, fy + (r() - 0.5) * 8); x.stroke(); }
  // kumiko lattice: thin dark-wood rails, a pane every 128 x 128 with three cross rails
  x.fillStyle = '#4a2f18';
  for (let i = 0; i <= 8; i++) x.fillRect(i * (W / 8) - 3, 0, 6, H);
  for (let j = 0; j <= 4; j++) x.fillRect(0, j * (H / 4) - 3, W, 6);
  x.fillStyle = 'rgba(70,44,20,0.8)';
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) { const px = i * (W / 8), py = j * (H / 4); for (let k = 1; k < 3; k++) x.fillRect(px + k * (W / 24) - 1.5, py, 3, H / 4); x.fillRect(px, py + H / 8 - 1.5, W / 8, 3); }
  return tex(c);
}
function paperTex() { // a subtle wash for the floor-level wooden skirting
  const c = canvas(256, 64), x = c.getContext('2d'), r = rnd(2); x.fillStyle = '#3a2412'; x.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(0,0,0,${0.1 + r() * 0.2})`; x.lineWidth = 1 + r() * 2; const yy = r() * 64; x.beginPath(); x.moveTo(0, yy); x.lineTo(256, yy + (r() - 0.5) * 4); x.stroke(); }
  return tex(c);
}

export function buildRoom(scene) {
  const grp = new THREE.Group(); scene.add(grp);
  const tt = tatamiTex(); tt.repeat.set(5, 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 540), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.rotation.z = Math.PI / 2; floor.receiveShadow = true; grp.add(floor);
  // the shoji screen: a wall of paper panes glowing with the last of the sun
  const sh = shojiTex(); sh.wrapS = THREE.RepeatWrapping; sh.repeat.set(2.5, 1);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1100, 220), new THREE.MeshBasicMaterial({ map: sh, fog: false, color: 0xffffff }));
  wall.position.set(0, 112, -170); grp.add(wall);
  const wood = new THREE.MeshStandardMaterial({ map: paperTex(), roughness: 0.55 });
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1100, 8, 10), wood); sill.position.set(0, 4, -168); grp.add(sill);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1100, 12, 10), wood); beam.position.set(0, 222, -168); grp.add(beam);
  for (const x of [-300, 300]) { const p = new THREE.Mesh(new THREE.BoxGeometry(12, 230, 12), wood); p.position.set(x, 115, -166); grp.add(p); }
  // a low lamp stand (andon) off to the left, a soft pool of paper light
  const lamp = new THREE.Group(); lamp.position.set(-150, 0, -50);
  const lw = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(22, 3, 22), lw); base.position.y = 1.5; lamp.add(base);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const post = new THREE.Mesh(new THREE.BoxGeometry(1.4, 44, 1.4), lw); post.position.set(sx * 9.5, 25, sz * 9.5); lamp.add(post); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(22, 2.4, 22), lw); top.position.y = 47.2; lamp.add(top);
  const paper = new THREE.Mesh(new THREE.BoxGeometry(18.4, 40, 18.4), new THREE.MeshBasicMaterial({ color: 0xffe2a8, fog: false })); paper.position.y = 25; lamp.add(paper);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,196,110', 0.75), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.scale.set(120, 120, 1); halo.position.y = 26; lamp.add(halo);
  grp.add(lamp);
  // a warm pool of window light on the floor round the goban
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(190, 190), new THREE.MeshBasicMaterial({ map: radialTex('255,214,150', 0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(-6, 0.15, 8); pool.renderOrder = 1; grp.add(pool);
  grp.userData.lamp = { halo, paper };
  grp.userData.dispose = () => { floor.geometry.dispose(); tt.dispose(); sh.dispose(); };
  return grp;
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffe9c8, 0x4a4426, 0.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffdcae, 2.1); sun.position.set(-46, 92, 58);
  sun.shadow.camera.left = -44; sun.shadow.camera.right = 44; sun.shadow.camera.top = 44; sun.shadow.camera.bottom = -50; sun.shadow.camera.near = 20; sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; sun.shadow.radius = 4;
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xbcd2ff, 0.5); fill.position.set(60, 50, 40); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffc880, 0.9); rim.position.set(40, 60, -120); scene.add(rim);
  return { hemi, sun, fill, rim };
}
