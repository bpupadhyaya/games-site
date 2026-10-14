// Game of the Goose: every 3D model, built from shared board3d primitives (lathe, slab, roundedBox, materials). Pure construction,
// no sim access. Units: the board plate is 10 wide; a space is about 0.75.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

const TAU = Math.PI * 2;
export const PLAYER_HEX = ['#b3262b', '#2c58a8', '#2f8a5b', '#d6a021', '#7a3a8c', '#e9e0c8'];

const cache = new Map();
const memo = (k, f) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };
export const MAT = {
  ivory: () => memo('ivory', () => B.material('ivory', { color: '#fffaf0', color2: '#eadfc4', roughness: 0.38 })),
  feather: () => memo('feather', () => new THREE.MeshStandardMaterial({ color: '#f1ece0', roughness: 0.72, metalness: 0 })),
  beak: () => memo('beak', () => new THREE.MeshStandardMaterial({ color: '#f08a1a', roughness: 0.4 })),
  eye: () => memo('eye', () => new THREE.MeshStandardMaterial({ color: '#0d0804', roughness: 0.2 })),
  brass: () => memo('brass', () => new THREE.MeshStandardMaterial({ color: '#d9a43a', metalness: 0.9, roughness: 0.28 })),
  stone: () => memo('stone', () => B.material('stone', { color: '#b9ae98', color2: '#8f8571', repeat: [1, 1], seed: 12 })),
  wood: () => memo('wood', () => B.material('wood', { color: '#a8703a', color2: '#d49a5a', repeat: [1, 1], seed: 5 })),
  dark: () => memo('dark', () => B.material('darkWood', { color: '#3a2112', color2: '#5a3a20', repeat: [3, 3], seed: 7 })),
  red: () => memo('red', () => new THREE.MeshStandardMaterial({ color: '#a8342a', roughness: 0.7 })),
  green: () => memo('green', () => new THREE.MeshStandardMaterial({ color: '#4c8a3e', roughness: 0.9 })),
  water: () => memo('water', () => new THREE.MeshPhysicalMaterial({ color: '#4f8fb4', roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 })),
  bone: () => memo('bone', () => new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.55 })),
  iron: () => memo('iron', () => new THREE.MeshStandardMaterial({ color: '#3b3836', metalness: 0.8, roughness: 0.45 })),
  paper: () => memo('paper', () => new THREE.MeshStandardMaterial({ color: '#efe0b6', roughness: 0.9, side: THREE.DoubleSide })),
  wax: () => memo('wax', () => new THREE.MeshPhysicalMaterial({ color: '#8f1f1a', roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.2 })),
  candle: () => memo('candle', () => new THREE.MeshStandardMaterial({ color: '#f6ead0', roughness: 0.6, emissive: '#6a4a1c', emissiveIntensity: 0.35 })),
  glass: () => memo('glass', () => new THREE.MeshPhysicalMaterial({ color: '#0f0b08', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, metalness: 0.2 })),
};
const shadowOn = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };

// ---- the goose ------------------------------------------------------------------------------------------------------------------------
// Faces +x. userData: { neck (group, bob), headG (group), wings: [left, right] (groups, flap about x), body }.
export function makeGoose() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const S = (r, sx, sy, sz, m, x, y, z) => { const o = mesh(new THREE.SphereGeometry(r, 20, 14), m, x, y, z); o.scale.set(sx, sy, sz); return o; };
  const white = MAT.ivory(), feath = MAT.feather();
  body.add(S(0.26, 1.15, 0.78, 0.8, feath, 0, 0.27, 0));                       // body
  body.add(S(0.17, 1.0, 0.8, 0.8, feath, 0.17, 0.3, 0));                       // breast
  const tail = mesh(new THREE.CylinderGeometry(0, 0.1, 0.24, 8), feath, -0.33, 0.33, 0); tail.rotation.z = Math.PI / 2 + 0.35; tail.scale.set(1, 1, 0.5); body.add(tail);
  // neck: a curved tube, its own group so it can sway
  const neck = new THREE.Group(); neck.position.set(0.2, 0.34, 0); body.add(neck);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.07, 0.12, 0), new THREE.Vector3(0.06, 0.26, 0), new THREE.Vector3(0.1, 0.38, 0)]);
  neck.add(mesh(new THREE.TubeGeometry(curve, 14, 0.052, 10), white));
  const head = new THREE.Group(); head.position.set(0.12, 0.42, 0); neck.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.068, 14, 10), white));
  const beak = mesh(new THREE.CylinderGeometry(0.022, 0.05, 0.13, 10), MAT.beak(), 0.095, -0.012, 0); beak.rotation.z = -Math.PI / 2 + 0.12; beak.scale.set(1, 1, 0.75); head.add(beak);
  for (const z of [-0.052, 0.052]) head.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), MAT.eye(), 0.035, 0.02, z));
  // wings: folded flat ellipsoids pivoting at the shoulder
  const wings = [];
  for (const z of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(-0.02, 0.36, z * 0.19); body.add(w);
    const wing = S(0.2, 1.0, 0.42, 0.2, feath, -0.1, -0.03, z * 0.04); wing.rotation.z = 0.15; w.add(wing);
    // primaries: a fan of long flat feathers off the wing tip
    for (let k = 0; k < 5; k++) {
      const f = S(0.2, 1.05, 0.12, 0.3, feath, -0.3 - k * 0.025, -0.06 - k * 0.012, z * (0.03 + k * 0.012));
      f.rotation.y = z * (0.02 + k * 0.018); f.rotation.z = 0.12 + k * 0.03; w.add(f);
    }
    wings.push(w);
  }
  for (const z of [-0.09, 0.09]) { const f = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 8), MAT.beak(), 0.03, 0.01, z); f.scale.set(1.4, 1, 1); g.add(f); }
  g.userData = { neck, head, wings, body };
  shadowOn(g);
  return g;
}
// pose: bob (0..1 phase), flap (0..1 amount), look (rad)
export function poseGoose(g, t, flap = 0, look = 0) {
  const u = g.userData;
  u.neck.rotation.z = Math.sin(t * 1.7) * 0.07 - flap * 0.15;
  u.head.rotation.y = look + Math.sin(t * 0.9) * 0.25;
  const f = flap > 0 ? Math.sin(t * 34) * 0.9 * flap : 0;
  u.wings[0].rotation.x = -f - flap * 0.4; u.wings[1].rotation.x = f + flap * 0.4;
  u.body.position.y = flap > 0 ? Math.abs(Math.sin(t * 17)) * 0.1 * flap : 0;
}

// ---- pawn: turned wooden base in the seat colour, brass collar, a little goose on top --------------------------------------------------
export function makePawn(seat) {
  const g = new THREE.Group();
  const col = PLAYER_HEX[seat % 6];
  const m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, metalness: 0.0 });
  const prof = [[0, 0], [0.3, 0], [0.31, 0.04], [0.28, 0.1], [0.18, 0.2], [0.13, 0.34], [0.15, 0.42], [0.2, 0.46], [0.2, 0.5], [0.0, 0.51]];
  g.add(B.piece(prof, m, 36));
  const collar = mesh(new THREE.TorusGeometry(0.155, 0.032, 10, 28), MAT.brass(), 0, 0.37, 0); collar.rotation.x = Math.PI / 2; g.add(collar);
  const base = mesh(new THREE.TorusGeometry(0.295, 0.02, 8, 30), MAT.brass(), 0, 0.075, 0); base.rotation.x = Math.PI / 2; g.add(base);
  const goose = makeGoose(); goose.scale.setScalar(0.62); goose.position.y = 0.5; goose.rotation.y = 0.5; g.add(goose);
  g.userData = { goose, seat };
  shadowOn(g);
  return g;
}

// ---- space props ------------------------------------------------------------------------------------------------------------------------
export function makeProp(kind) {
  const g = new THREE.Group(), M = MAT;
  if (kind === 'bridge') {
    const arch = mesh(new THREE.TorusGeometry(0.2, 0.065, 10, 20, Math.PI), M.stone(), 0, 0.02, 0); arch.scale.set(1.15, 1, 1.5); g.add(arch);
    for (const x of [-0.23, 0.23]) g.add(mesh(new THREE.BoxGeometry(0.14, 0.08, 0.3), M.stone(), x, 0.04, 0));
    for (const z of [-0.12, 0.12]) { const r = mesh(new THREE.BoxGeometry(0.5, 0.03, 0.03), M.wood(), 0, 0.27, z); g.add(r); }
    const w = mesh(new THREE.BoxGeometry(0.6, 0.012, 0.4), M.water(), 0, 0.005, 0); g.add(w);
  } else if (kind === 'inn') {
    g.add(mesh(new THREE.BoxGeometry(0.42, 0.26, 0.32), M.ivory(), 0, 0.13, 0));
    const roof = mesh(new THREE.CylinderGeometry(0.0, 0.34, 0.22, 4), M.red(), 0, 0.37, 0); roof.rotation.y = Math.PI / 4; roof.scale.set(1.08, 1, 0.84); g.add(roof);
    g.add(mesh(new THREE.BoxGeometry(0.09, 0.14, 0.02), M.dark(), 0, 0.07, 0.165));
    g.add(mesh(new THREE.BoxGeometry(0.07, 0.14, 0.07), M.stone(), 0.12, 0.42, -0.05));
    const sign = mesh(new THREE.BoxGeometry(0.1, 0.1, 0.012), M.brass(), -0.26, 0.2, 0.1); g.add(sign);
  } else if (kind === 'well') {
    g.add(B.piece([[0.2, 0], [0.22, 0.02], [0.22, 0.2], [0.17, 0.2], [0.17, 0.02]], M.stone(), 24));
    g.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 20), M.water(), 0, 0.12, 0));
    for (const x of [-0.2, 0.2]) g.add(mesh(new THREE.BoxGeometry(0.03, 0.34, 0.03), M.wood(), x, 0.26, 0));
    g.add(mesh(new THREE.BoxGeometry(0.46, 0.025, 0.025), M.wood(), 0, 0.42, 0));
    const roof = mesh(new THREE.BoxGeometry(0.5, 0.025, 0.3), M.red(), 0, 0.47, 0); roof.rotation.z = 0; g.add(roof);
  } else if (kind === 'maze') {
    const walls = [[0, -0.22, 0.56, 0.05], [0, 0.22, 0.56, 0.05], [-0.25, 0, 0.05, 0.44], [0.25, 0.05, 0.05, 0.34], [0.0, -0.08, 0.3, 0.05], [0.07, 0.1, 0.34, 0.05], [-0.1, 0.01, 0.05, 0.16]];
    for (const [x, z, w, d] of walls) g.add(mesh(B.roundedBox(w, 0.17, d, 0.02, 2), M.green(), x, 0.085, z));
  } else if (kind === 'prison') {
    g.add(mesh(new THREE.BoxGeometry(0.44, 0.12, 0.34), M.stone(), 0, 0.06, 0));
    for (let i = -3; i <= 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 6), M.iron(), i * 0.065, 0.22, 0.16));
    for (let i = -3; i <= 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 6), M.iron(), i * 0.065, 0.22, -0.16));
    g.add(mesh(new THREE.BoxGeometry(0.46, 0.04, 0.36), M.iron(), 0, 0.34, 0));
  } else if (kind === 'skeleton') {
    const skull = mesh(new THREE.SphereGeometry(0.13, 16, 12), M.bone(), 0, 0.2, 0); skull.scale.set(1, 0.92, 1); g.add(skull);
    g.add(mesh(B.roundedBox(0.12, 0.07, 0.1, 0.02, 2), M.bone(), 0, 0.09, 0.03));
    for (const x of [-0.05, 0.05]) g.add(mesh(new THREE.SphereGeometry(0.032, 8, 6), M.eye(), x, 0.21, 0.11));
    for (const a of [0.7, -0.7]) { const b = mesh(new THREE.CapsuleGeometry(0.025, 0.36, 4, 8), M.bone(), 0, 0.03, 0.05); b.rotation.z = Math.PI / 2; b.rotation.y = a; g.add(b); }
  } else if (kind === 'road') {
    g.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.46, 8), M.wood(), 0, 0.23, 0));
    const a = mesh(B.roundedBox(0.3, 0.09, 0.025, 0.012, 2), M.wood(), 0.1, 0.4, 0); a.rotation.y = 0.25; g.add(a);
    const b = mesh(B.roundedBox(0.26, 0.08, 0.025, 0.012, 2), M.wood(), -0.08, 0.28, 0); b.rotation.y = -0.4; g.add(b);
  }
  shadowOn(g);
  return g;
}

// ---- table props ------------------------------------------------------------------------------------------------------------------------
export function makeCandle() {
  const g = new THREE.Group();
  g.add(B.piece([[0, 0], [0.34, 0], [0.34, 0.04], [0.14, 0.1], [0.1, 0.24], [0.18, 0.28], [0.0, 0.28]], MAT.brass(), 28));
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 20), MAT.candle(), 0, 0.82, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 6), MAT.iron(), 0, 1.42, 0));
  shadowOn(g);
  return g;
}
export function makeInkwell() {
  const g = new THREE.Group();
  g.add(B.piece([[0, 0], [0.4, 0], [0.42, 0.06], [0.36, 0.34], [0.2, 0.42], [0.2, 0.5], [0.0, 0.5]], MAT.glass(), 28));
  g.add(B.piece([[0.2, 0.46], [0.24, 0.5], [0.24, 0.58], [0.2, 0.6], [0.16, 0.58], [0.16, 0.5]], MAT.brass(), 20));
  const shaft = mesh(new THREE.CylinderGeometry(0.014, 0.01, 1.7, 6), MAT.bone(), 0.0, 0.0, 0);
  const quill = new THREE.Group(); quill.add(shaft);
  const vane = mesh(new THREE.SphereGeometry(0.5, 14, 8), MAT.feather(), 0, 0.5, 0); vane.scale.set(0.14, 1.6, 0.03); quill.add(vane);
  quill.position.set(0.1, 1.15, 0); quill.rotation.z = -0.42; quill.rotation.x = 0.12; g.add(quill);
  shadowOn(g);
  return g;
}
export function makeSeal() {
  const g = new THREE.Group();
  const rib = mesh(new THREE.BoxGeometry(0.24, 0.012, 1.1), MAT.red(), 0, 0.006, 0.55); g.add(rib);
  g.add(B.piece([[0, 0], [0.44, 0], [0.5, 0.03], [0.48, 0.08], [0.0, 0.09]], MAT.wax(), 28));
  const star = mesh(B.inlay(B.starPoints(6, 0.26, 0.12), 0.03), MAT.wax(), 0, 0.085, 0); g.add(star);
  const ring = mesh(new THREE.TorusGeometry(0.36, 0.018, 6, 26), MAT.wax(), 0, 0.09, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
  shadowOn(g);
  return g;
}
