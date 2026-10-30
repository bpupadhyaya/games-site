// Futbolín 3D models: the table (cabinet, field, walls, goals, bead counters), rods with their painted men and handles, the ball,
// and the café room around it. All procedural (canvas textures + simple geometry), metres; 1 table unit = 1 cm.
// Presentation only: nothing here reads or writes the simulation.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { HW, HL, BALL_R, GOAL_HW, CHAMFER, KINDS } from '../src/consts.js';

export const U = 0.01;              // metres per table unit (the table is 68 x 120 cm, like a real one)
export const FY = 0.80;             // height of the playing field above the floor
export const MAN_K = 1.2;           // the men are drawn 1.2x real size so they read on a phone (the boot matches the sim's foot box)
export const ROD_H = 0.084;         // rod axis above the field
export const FOOT_L = 0.08;         // rod axis to the sole of a man's boot (for the swing angle)
export const WALL_H = 0.095;        // side wall height above the field
export const RIMW = 0.06;           // wall thickness
const TAU = Math.PI * 2;

const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const tex = (c, o = {}) => {
  const t = new THREE.CanvasTexture(c); t.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
};
const mesh = (geo, mat, cast = true, recv = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m; };
const M4 = () => new THREE.Matrix4();
const at = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// ---------------------------------------------------------------------------------------------- materials
export function makeMaterials() {
  const wood = B.material('wood', { color: '#6e3c1a', color2: '#b0692e', seed: 11, repeat: [1, 1], physical: true });
  wood.clearcoat = 0.7; wood.clearcoatRoughness = 0.22; wood.roughness = 0.42;
  const woodDark = B.material('darkWood', { color: '#3a1e0e', color2: '#5e3418', seed: 4 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe4e8ee, metalness: 1, roughness: 0.16, envMapIntensity: 1.35 });
  const brass = B.material('brass', {}); brass.roughness = 0.3;
  const rubber = new THREE.MeshPhysicalMaterial({ color: 0x17171a, roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xe0ac7e, roughness: 0.45, clearcoat: 0.55, clearcoatRoughness: 0.25 });
  const hair = new THREE.MeshPhysicalMaterial({ color: 0x2a1a10, roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const boot = new THREE.MeshPhysicalMaterial({ color: 0x141414, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const black = new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 1 });
  return { wood, woodDark, chrome, brass, rubber, skin, hair, boot, black };
}
// painted, lacquered plastic in a kit colour (the men's shirts, socks, handle caps)
export const paint = (col) => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(col), roughness: 0.34, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.12 });

// ---------------------------------------------------------------------------------------------- field texture
function fieldCanvas() {
  const PX = 12, w = 68 * PX, h = 120 * PX, c = cv(w, h), x = c.getContext('2d'), r = rng(5);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#16672e'); g.addColorStop(0.5, '#1d7a37'); g.addColorStop(1, '#16672e');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) if (i & 1) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(0, i * 15 * PX, w, 15 * PX); }
  for (let i = 0; i < 26000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,30,8,0.06)'; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  x.strokeStyle = 'rgba(250,252,245,0.9)'; x.lineWidth = 0.55 * PX;
  const T = (tx, ty) => [(tx + HW) * PX, (ty + HL) * PX];
  x.beginPath(); x.moveTo(...T(-HW, 0)); x.lineTo(...T(HW, 0)); x.stroke();
  x.beginPath(); x.arc(...T(0, 0), 9 * PX, 0, TAU); x.stroke();
  x.fillStyle = 'rgba(250,252,245,0.95)'; x.beginPath(); x.arc(...T(0, 0), 0.9 * PX, 0, TAU); x.fill();
  for (const sg of [-1, 1]) {
    const [bx, by] = T(-20, sg > 0 ? HL - 15 : -HL); x.strokeRect(bx, by, 40 * PX, 15 * PX);
    const [gx, gy] = T(-GOAL_HW - 2, sg > 0 ? HL - 6 : -HL); x.strokeRect(gx, gy, (2 * GOAL_HW + 4) * PX, 6 * PX);
    x.beginPath(); x.arc(...T(0, sg * (HL - 21)), 6 * PX, sg > 0 ? Math.PI * 1.15 : Math.PI * 0.15, sg > 0 ? Math.PI * 1.85 : Math.PI * 0.85); x.stroke();
    x.fillStyle = 'rgba(250,252,245,0.9)'; x.beginPath(); x.arc(...T(0, sg * (HL - 21)), 0.7 * PX, 0, TAU); x.fill();
  }
  // worn patches where the ball rolls most (centre line and in front of the goals): real tables polish there
  for (const [cx, cy, rad, a] of [[0, 0, 22, 0.07], [0, HL - 12, 12, 0.06], [0, -HL + 12, 12, 0.06]]) {
    const [px, py] = T(cx, cy), gr = x.createRadialGradient(px, py, 0, px, py, rad * PX); gr.addColorStop(0, `rgba(190,230,170,${a})`); gr.addColorStop(1, 'rgba(190,230,170,0)');
    x.fillStyle = gr; x.fillRect(px - rad * PX, py - rad * PX, rad * 2 * PX, rad * 2 * PX);
  }
  // shade at the rails
  const sh = x.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(0,0,0,0.25)'); sh.addColorStop(0.06, 'rgba(0,0,0,0)'); sh.addColorStop(0.94, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)');
  x.fillStyle = sh; x.fillRect(0, 0, w, h);
  return c;
}

// ---------------------------------------------------------------------------------------------- table
export function buildTable(mats) {
  const g = new THREE.Group(); g.name = 'table';
  const fieldMat = new THREE.MeshPhysicalMaterial({ map: tex(fieldCanvas()), roughness: 0.62, clearcoat: 0.18, clearcoatRoughness: 0.5 });
  const field = mesh(new THREE.PlaneGeometry(68 * U, 120 * U), fieldMat, false, true);
  field.rotation.x = -Math.PI / 2; field.position.y = FY; g.add(field);
  const OX = HW * U + RIMW, OZ = HL * U + RIMW, top = FY + WALL_H, bot = FY - 0.17;
  // side walls (long sides) with a rounded top edge
  const sideGeo = B.roundedBox(RIMW, top - bot, 120 * U + 2 * RIMW, 0.012);
  for (const sx of [-1, 1]) { const m = mesh(sideGeo, mats.wood); m.position.set(sx * (HW * U + RIMW / 2), (top + bot) / 2, 0); g.add(m); }
  // end walls: two blocks either side of the goal slot and a lintel above it
  const GH = 0.075, sideLen = HW * U - GOAL_HW * U;
  const endBlock = B.roundedBox(sideLen, top - bot, RIMW, 0.01), lintel = B.roundedBox(2 * GOAL_HW * U + 0.004, top - FY - GH, RIMW, 0.008);
  const below = B.roundedBox(2 * GOAL_HW * U + 0.004, FY - bot - 0.06, RIMW, 0.008);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) { const m = mesh(endBlock, mats.wood); m.position.set(sx * (GOAL_HW * U + sideLen / 2), (top + bot) / 2, sz * (HL * U + RIMW / 2)); g.add(m); }
    const l = mesh(lintel, mats.wood); l.position.set(0, FY + GH + (top - FY - GH) / 2, sz * (HL * U + RIMW / 2)); g.add(l);
    const b = mesh(below, mats.wood); b.position.set(0, bot + (FY - bot - 0.06) / 2, sz * (HL * U + RIMW / 2)); g.add(b);
    // the dark goal pocket behind the slot, with a sloped floor the ball drops down
    const pocket = new THREE.Group();
    const back = mesh(new THREE.BoxGeometry(2 * GOAL_HW * U + 0.03, 0.16, 0.01), mats.black, false, true); back.position.set(0, FY - 0.03, sz * (OZ + 0.075)); pocket.add(back);
    const floor = mesh(new THREE.BoxGeometry(2 * GOAL_HW * U + 0.03, 0.01, 0.09), mats.black, false, true); floor.position.set(0, FY - 0.07, sz * (OZ + 0.03)); floor.rotation.x = sz * 0.5; pocket.add(floor);
    for (const sx of [-1, 1]) { const w = mesh(new THREE.BoxGeometry(0.012, 0.16, 0.09), mats.woodDark); w.position.set(sx * (GOAL_HW * U + 0.02), FY - 0.03, sz * (OZ + 0.035)); pocket.add(w); }
    const cap = mesh(B.roundedBox(2 * GOAL_HW * U + 0.06, 0.02, 0.1, 0.006), mats.wood); cap.position.set(0, top - 0.01, sz * (OZ + 0.04)); pocket.add(cap);
    g.add(pocket);
    // brass corner posts of the goal mouth
    for (const sx of [-1, 1]) { const p = mesh(new THREE.CylinderGeometry(0.006, 0.006, GH, 16), mats.brass); p.position.set(sx * GOAL_HW * U, FY + GH / 2, sz * HL * U); g.add(p); }
  }
  // corner ramps (the fillets that keep the ball from sticking)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = sx * HW * U, cz = sz * HL * U, C = CHAMFER * U, tri = new THREE.Shape();   // shape (X, Y) -> world (x, -z) after the turn below
    tri.moveTo(cx, -cz); tri.lineTo(cx - sx * C, -cz); tri.lineTo(cx, -cz + sz * C); tri.closePath();
    const m = mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.03, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 }), mats.wood);
    m.rotation.x = -Math.PI / 2; m.position.y = FY; g.add(m);
  }
  // cabinet below the field, legs and stretchers
  const apron = mesh(B.roundedBox(2 * OX + 0.01, 0.05, 2 * OZ + 0.01, 0.01), mats.woodDark); apron.position.set(0, bot - 0.02, 0); g.add(apron);
  const legGeo = B.roundedBox(0.075, bot - 0.06, 0.075, 0.012);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = mesh(legGeo, mats.woodDark); l.position.set(sx * (OX - 0.06), (bot - 0.06) / 2 + 0.02, sz * (OZ - 0.08)); g.add(l);
    const f = mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.02, 20), mats.rubber); f.position.set(sx * (OX - 0.06), 0.01, sz * (OZ - 0.08)); g.add(f);
  }
  for (const sz of [-1, 1]) { const s = mesh(B.roundedBox(2 * OX - 0.14, 0.05, 0.04, 0.01), mats.woodDark); s.position.set(0, 0.16, sz * (OZ - 0.08)); g.add(s); }
  const mid = mesh(B.roundedBox(0.05, 0.05, 2 * OZ - 0.2, 0.01), mats.woodDark); mid.position.set(0, 0.16, 0); g.add(mid);
  // brass studs on the corners of the rails
  const stud = new THREE.SphereGeometry(0.009, 16, 10, 0, TAU, 0, Math.PI / 2), studs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) studs.push({ geo: stud, m: at(sx * (HW * U + RIMW / 2), top, sz * (HL * U + RIMW / 2)) });
  g.add(mesh(B.mergeGeos(studs), mats.brass, false, false));
  return g;
}

// brass bushings where the rods pass through the side walls
export function buildBushings(mats, rodZs) {
  const ring = new THREE.TorusGeometry(0.0125, 0.0035, 10, 24), parts = [];
  for (const z of rodZs) for (const sx of [-1, 1]) for (const face of [0, 1]) {
    const x = sx * (HW * U + (face ? RIMW + 0.001 : -0.001));
    parts.push({ geo: ring, m: at(x, FY + ROD_H, z, 0, Math.PI / 2, 0) });
  }
  return mesh(B.mergeGeos(parts), mats.brass, false, false);
}

// ---------------------------------------------------------------------------------------------- bead score counters
export function buildCounter(mats, col, sz) {
  const g = new THREE.Group();
  const z = sz * (HL * U + RIMW + 0.035), y = FY + WALL_H + 0.03;
  const bar = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.42, 10), mats.brass); bar.rotation.z = Math.PI / 2; bar.position.set(0, y, z); g.add(bar);
  for (const sx of [-1, 1]) { const p = mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.035, 10), mats.brass); p.position.set(sx * 0.21, y - 0.016, z); g.add(p); }
  const beadGeo = B.lathe([[0, -0.008], [0.008, -0.008], [0.0125, -0.004], [0.0125, 0.004], [0.008, 0.008], [0, 0.008]], 20);
  const beadMat = paint(col);
  const beads = [];
  for (let i = 0; i < 7; i++) { const b = mesh(beadGeo, beadMat); b.rotation.z = Math.PI / 2; b.position.set(0, y, z); g.add(b); beads.push({ m: b, x: 0, v: 0 }); }
  return { group: g, beads, mat: beadMat, z, y };
}

// ---------------------------------------------------------------------------------------------- the men
// One painted man, facing +z, rod axis at the origin through the chest. Real moulded-figure proportions: about 11 cm tall.
function manParts() {
  const P = { kit: [], trim: [], skin: [], hair: [], boot: [] };
  const box = (w, h, d, r) => B.roundedBox(w, h, d, r, 3);
  P.boot.push({ geo: box(0.040, 0.012, 0.030, 0.005), m: at(0, -0.0605, 0.003) });
  const sock = new THREE.CapsuleGeometry(0.0064, 0.014, 4, 10), thigh = new THREE.CapsuleGeometry(0.0068, 0.010, 4, 10);
  for (const sx of [-1, 1]) {
    P.kit.push({ geo: sock, m: at(sx * 0.009, -0.045, 0.001) });
    P.skin.push({ geo: thigh, m: at(sx * 0.009, -0.031, 0) });
  }
  P.trim.push({ geo: box(0.038, 0.018, 0.025, 0.007), m: at(0, -0.019, 0) });
  const chest = B.lathe([[0.0, -0.013], [0.0175, -0.012], [0.0195, 0.0], [0.021, 0.012], [0.017, 0.021], [0.008, 0.026], [0, 0.026]], 24);
  P.kit.push({ geo: chest, m: at(0, 0, 0, 0, 0, 0, 1, 1, 0.64) });
  const band = B.lathe([[0.0198, 0.0015], [0.0207, 0.0015], [0.0212, 0.0075], [0.0204, 0.0075]], 24);
  P.trim.push({ geo: band, m: at(0, 0, 0, 0, 0, 0, 1, 1, 0.66) });
  const arm = new THREE.CapsuleGeometry(0.0056, 0.022, 4, 10), hand = new THREE.SphereGeometry(0.0059, 12, 8);
  for (const sx of [-1, 1]) {
    P.kit.push({ geo: arm, m: at(sx * 0.0235, 0.006, 0, 0, 0, sx * 0.13) });
    P.skin.push({ geo: hand, m: at(sx * 0.0255, -0.0125, 0.001) });
  }
  P.skin.push({ geo: new THREE.CylinderGeometry(0.0058, 0.0066, 0.009, 14), m: at(0, 0.029, 0) });
  P.skin.push({ geo: new THREE.SphereGeometry(0.0128, 22, 16), m: at(0, 0.0435, 0.0005, 0, 0, 0, 0.92, 1.06, 0.97) });
  P.hair.push({ geo: new THREE.SphereGeometry(0.0137, 28, 20, 0, TAU, 0, 1.85), m: at(0, 0.0445, -0.0008, -0.75, 0, 0, 0.94, 1.06, 0.99) });
  // painted eyes and brows (moulded figures have a simple painted face)
  const eye = new THREE.SphereGeometry(0.0017, 10, 8), brow = B.roundedBox(0.0052, 0.0011, 0.0016, 0.0005, 2);
  for (const sx of [-1, 1]) { P.hair.push({ geo: eye, m: at(sx * 0.0044, 0.0445, 0.0118, 0, 0, 0, 1, 1.2, 0.6) }); P.hair.push({ geo: brow, m: at(sx * 0.0046, 0.0492, 0.0112, -0.3, 0, -sx * 0.12) }); }
  return P;
}
let MAN = null;

/**
 * One rod: { slide (moves along x with the rod offset), spin (turns about the rod axis), mats, handleMats }.
 * The men are merged per material (they are rigid on their rod), so a rod is a handful of draw calls.
 */
export function buildRod(mats, kind, team, kit) {
  MAN = MAN || manParts();
  const K = KINDS[kind], hs = team === 0 ? 1 : -1, face = team === 0 ? Math.PI : 0;
  const slide = new THREE.Group(), spin = new THREE.Group(); slide.add(spin);
  const kitMat = paint(kit.col), trimMat = paint(kit.trim);
  const sets = { kit: [], trim: [], skin: [], hair: [], boot: [] };
  for (let k = 0; k < K.n; k++) {
    const x = (k - (K.n - 1) / 2) * K.spacing * U, base = at(x, 0, 0, 0, face, 0, MAN_K, MAN_K, MAN_K);
    for (const key of Object.keys(sets)) for (const p of MAN[key]) sets[key].push({ geo: p.geo, m: base.clone().multiply(p.m) });
  }
  const matOf = { kit: kitMat, trim: trimMat, skin: mats.skin, hair: mats.hair, boot: mats.boot };
  for (const key of Object.keys(sets)) spin.add(mesh(B.mergeGeos(sets[key]), matOf[key]));
  // the chrome rod: through both walls, with travel room on the far side and the handle on its own side
  const wallOut = HW * U + RIMW, travel = K.maxOff * U;
  const x0 = -hs * (wallOut + travel + 0.03), x1 = hs * (wallOut + travel + 0.02);
  const len = Math.abs(x1 - x0), rod = mesh(new THREE.CylinderGeometry(0.0079, 0.0079, len, 18), mats.chrome, true, false);
  rod.rotation.z = Math.PI / 2; rod.position.x = (x0 + x1) / 2; spin.add(rod);
  // handle: a turned grip with finger rings, a kit-coloured cap and a chrome ferrule
  const grip = B.lathe([[0, 0], [0.012, 0], [0.0125, 0.006], [0.0108, 0.012], [0.0118, 0.03], [0.0168, 0.06], [0.0172, 0.085], [0.0162, 0.1], [0.0172, 0.104], [0.0172, 0.11], [0, 0.11]], 28);
  const gm = mesh(grip, mats.rubber); gm.rotation.z = -hs * Math.PI / 2; gm.position.x = x1; spin.add(gm);
  const capMat = paint(kit.col);
  const cap = mesh(B.lathe([[0, 0], [0.0178, 0], [0.0178, 0.008], [0.012, 0.014], [0, 0.015]], 24), capMat); cap.rotation.z = -hs * Math.PI / 2; cap.position.x = x1 + hs * 0.108; spin.add(cap);
  const ferrule = mesh(new THREE.CylinderGeometry(0.0118, 0.0118, 0.008, 20), mats.chrome); ferrule.rotation.z = Math.PI / 2; ferrule.position.x = x1 + hs * 0.002; spin.add(ferrule);
  slide.position.y = FY + ROD_H;
  return { slide, spin, kitMat, trimMat, capMat, grip: gm, handleX: x1, hs };
}

// ---------------------------------------------------------------------------------------------- ball
function ballCanvas() {
  const w = 512, h = 256, c = cv(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), d = img.data;
  const p = (1 + Math.sqrt(5)) / 2, V = [];
  for (const [a, b] of [[1, p], [-1, p], [1, -p], [-1, -p]]) { V.push([0, a, b], [a, b, 0], [b, 0, a]); }
  const N = V.map((v) => { const l = Math.hypot(...v); return v.map((q) => q / l); });
  const r = rng(9);
  for (let j = 0; j < h; j++) {
    const th = (j + 0.5) / h * Math.PI;
    for (let i = 0; i < w; i++) {
      const ph = (i + 0.5) / w * TAU, vx = Math.sin(th) * Math.cos(ph), vy = Math.cos(th), vz = Math.sin(th) * Math.sin(ph);
      let best = -1; for (const n of N) best = Math.max(best, n[0] * vx + n[1] * vy + n[2] * vz);
      const k = (j * w + i) * 4, spot = best > 0.955, edge = best > 0.945 && !spot;
      const base = 238 + (r() - 0.5) * 10;
      const v = spot ? 34 : edge ? 150 : base;
      d[k] = v; d[k + 1] = spot ? 32 : edge ? 146 : base - 4; d[k + 2] = spot ? 30 : edge ? 140 : base - 12; d[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}
export function buildBall() {
  const mat = new THREE.MeshPhysicalMaterial({ map: tex(ballCanvas()), roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const ball = mesh(new THREE.SphereGeometry(BALL_R * U, 32, 22), mat, true, false);
  const shadow = B.contactShadow(BALL_R * U * 1.5, 0.55);
  return { ball, shadow };
}

// ---------------------------------------------------------------------------------------------- the café room
function tileCanvas() {
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = rng(21), n = 4, t = S / n;
  x.fillStyle = '#4a2a1c'; x.fillRect(0, 0, S, S);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = r(), base = [`#9a4a2c`, `#a8573a`, `#8e4428`, `#b0603e`][Math.floor(v * 4)];
    const g = x.createLinearGradient(i * t, j * t, (i + 1) * t, (j + 1) * t); g.addColorStop(0, base); g.addColorStop(1, '#7c3a22');
    x.fillStyle = g; x.fillRect(i * t + 5, j * t + 5, t - 10, t - 10);
    for (let k = 0; k < 900; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,220,180,0.06)' : 'rgba(40,10,0,0.08)'; x.fillRect(i * t + 5 + r() * (t - 10), j * t + 5 + r() * (t - 10), 2 + r() * 3, 2 + r() * 3); }
    // small glazed corner inset (a café floor detail)
    x.fillStyle = r() < 0.5 ? '#2f5a7a' : '#d9b25a'; x.save(); x.translate((i + 1) * t, (j + 1) * t); x.rotate(Math.PI / 4); x.fillRect(-14, -14, 28, 28); x.restore();
  }
  return c;
}
function rugCanvas() {
  const w = 512, h = 640, c = cv(w, h), x = c.getContext('2d'), r = rng(3);
  x.fillStyle = '#5a1416'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#d6a95a'; x.lineWidth = 10; x.strokeRect(22, 22, w - 44, h - 44);
  x.fillStyle = '#1f2f52'; x.fillRect(40, 40, w - 80, 26); x.fillRect(40, h - 66, w - 80, 26); x.fillRect(40, 40, 26, h - 80); x.fillRect(w - 66, 40, 26, h - 80);
  for (let i = 0; i < 18; i++) { x.fillStyle = '#d6a95a'; x.beginPath(); x.arc(54 + i * ((w - 108) / 17), 53, 5, 0, TAU); x.arc(54 + i * ((w - 108) / 17), h - 53, 5, 0, TAU); x.fill(); }
  x.save(); x.translate(w / 2, h / 2); x.fillStyle = '#8a2a22'; x.beginPath(); x.ellipse(0, 0, 150, 200, 0, 0, TAU); x.fill();
  x.strokeStyle = '#d6a95a'; x.lineWidth = 6; x.stroke(); x.fillStyle = '#1f2f52'; x.beginPath(); x.moveTo(0, -110); x.lineTo(70, 0); x.lineTo(0, 110); x.lineTo(-70, 0); x.closePath(); x.fill(); x.restore();
  for (let k = 0; k < 30000; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,230,200,0.05)' : 'rgba(0,0,0,0.09)'; x.fillRect(r() * w, r() * h, 2, 2); }
  return c;
}
function wallCanvas() {
  const w = 512, h = 1024, c = cv(w, h), x = c.getContext('2d'), r = rng(8);
  // plaster above, azulejo band, wood wainscot below (the canvas covers 1.6 m x 3.2 m)
  x.fillStyle = '#c69d70'; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 20000; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,240,220,0.05)' : 'rgba(80,40,10,0.05)'; x.fillRect(r() * w, r() * h * 0.62, 3, 3); }
  const by = h * 0.585, bh = h * 0.07, n = 6, t = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
    const tx = i * t, ty = by + j * bh / 2, s = bh / 2;
    x.fillStyle = '#f1ead8'; x.fillRect(tx + 1, ty + 1, t - 2, s - 2);
    x.fillStyle = '#2a4f8a'; x.beginPath(); x.arc(tx + t / 2, ty + s / 2, s * 0.32, 0, TAU); x.fill();
    x.strokeStyle = '#2a4f8a'; x.lineWidth = 3; x.beginPath(); x.moveTo(tx + 4, ty + s / 2); x.lineTo(tx + t - 4, ty + s / 2); x.stroke();
    x.fillStyle = '#d8a43a'; x.beginPath(); x.arc(tx + t / 2, ty + s / 2, s * 0.12, 0, TAU); x.fill();
  }
  const wy = by + bh, g = x.createLinearGradient(0, wy, 0, h); g.addColorStop(0, '#5a3218'); g.addColorStop(1, '#3a1e0e');
  x.fillStyle = g; x.fillRect(0, wy, w, h - wy);
  x.strokeStyle = 'rgba(255,210,150,0.18)'; x.lineWidth = 4;
  for (let i = 0; i < 2; i++) x.strokeRect(i * w / 2 + 22, wy + 30, w / 2 - 44, h - wy - 70);
  x.fillStyle = '#2a1408'; x.fillRect(0, wy, w, 12);
  return c;
}
function bottle(prof) { return B.lathe(prof, 16); }
export function buildRoom(mats) {
  const g = new THREE.Group(); g.name = 'room';
  const floor = mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ map: tex(tileCanvas(), { repeat: [9, 9] }), roughness: 0.62, metalness: 0 }), false, true);
  floor.rotation.x = -Math.PI / 2; g.add(floor);
  const rug = mesh(new THREE.PlaneGeometry(1.7, 2.3), new THREE.MeshStandardMaterial({ map: tex(rugCanvas()), roughness: 1 }), false, true);
  rug.rotation.x = -Math.PI / 2; rug.position.y = 0.004; g.add(rug);
  const wallMat = new THREE.MeshStandardMaterial({ map: tex(wallCanvas(), { repeat: [4, 1] }), roughness: 0.85 });
  const back = mesh(new THREE.PlaneGeometry(6.4, 3.2), wallMat, false, true); back.position.set(0, 1.6, -2.7); g.add(back);
  const wallMat2 = wallMat.clone(); wallMat2.map = wallMat.map.clone(); wallMat2.map.repeat.set(4.5, 1); wallMat2.map.needsUpdate = true;
  for (const sx of [-1, 1]) { const w = mesh(new THREE.PlaneGeometry(7.2, 3.2), wallMat2, false, true); w.position.set(sx * 2.6, 1.6, 0.4); w.rotation.y = -sx * Math.PI / 2; g.add(w); }
  // the bar along the back wall: panelled counter, stone top, brass foot rail, shelves of bottles
  const bar = mesh(B.roundedBox(3.2, 1.02, 0.55, 0.02), mats.woodDark); bar.position.set(0, 0.51, -2.25); g.add(bar);
  const topM = B.material('stone', { color: '#5d5550', color2: '#8b817a', seed: 5 });
  const counter = mesh(B.roundedBox(3.3, 0.05, 0.66, 0.015), topM); counter.position.set(0, 1.045, -2.25); g.add(counter);
  const rail = mesh(new THREE.CylinderGeometry(0.022, 0.022, 3.1, 14), mats.brass); rail.rotation.z = Math.PI / 2; rail.position.set(0, 0.2, -1.92); g.add(rail);
  const shelfGeo = B.roundedBox(2.6, 0.03, 0.22, 0.008);
  for (const y of [1.55, 1.95]) { const s = mesh(shelfGeo, mats.woodDark); s.position.set(0, y, -2.58); g.add(s); }
  const cols = ['#2f6b3a', '#7a3a12', '#d9c27a', '#3a2a5a', '#9a1e1e', '#cfe3e8'], parts = cols.map(() => []), r = rng(17);
  const shapes = [bottle([[0, 0], [0.04, 0], [0.04, 0.2], [0.014, 0.25], [0.012, 0.31], [0, 0.31]]), bottle([[0, 0], [0.035, 0], [0.035, 0.16], [0.012, 0.22], [0.011, 0.27], [0, 0.27]]), bottle([[0, 0], [0.05, 0], [0.05, 0.12], [0.02, 0.17], [0, 0.17]])];
  for (const y of [1.565, 1.965]) for (let i = 0; i < 14; i++) { const k = Math.floor(r() * cols.length); parts[k].push({ geo: shapes[Math.floor(r() * 3)], m: at(-1.2 + i * 0.185 + r() * 0.04, y, -2.58 + (r() - 0.5) * 0.06) }); }
  cols.forEach((c, k) => { if (parts[k].length) { const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.88 }); g.add(mesh(B.mergeGeos(parts[k]), m, false, false)); } });
  // two bar stools
  const seat = B.lathe([[0, 0], [0.19, 0], [0.2, 0.02], [0.19, 0.05], [0, 0.055]], 28), stoolParts = [], seatParts = [];
  for (const [sx, sz] of [[-0.9, -1.75], [0.75, -1.75]]) {
    seatParts.push({ geo: seat, m: at(sx, 0.74, sz) });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.6; stoolParts.push({ geo: new THREE.CylinderGeometry(0.014, 0.017, 0.76, 8), m: at(sx + Math.cos(a) * 0.12, 0.37, sz + Math.sin(a) * 0.12, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12) }); }
    stoolParts.push({ geo: new THREE.TorusGeometry(0.15, 0.01, 8, 28), m: at(sx, 0.28, sz, Math.PI / 2, 0, 0) });
  }
  g.add(mesh(B.mergeGeos(stoolParts), mats.brass));
  g.add(mesh(B.mergeGeos(seatParts), new THREE.MeshPhysicalMaterial({ color: 0x6a1a14, roughness: 0.45, clearcoat: 0.6 })));
  return g;
}

// the pendant lamp over the table: enamel shade, warm bulb, cord to the ceiling
export function buildLamp() {
  const g = new THREE.Group();
  const shade = B.lathe([[0.012, 0.16], [0.03, 0.15], [0.07, 0.1], [0.17, 0.02], [0.21, 0], [0.205, -0.004], [0.165, 0.014], [0.065, 0.092], [0.027, 0.142], [0.01, 0.15]], 40);
  const outer = new THREE.MeshPhysicalMaterial({ color: 0x1d4a34, roughness: 0.3, clearcoat: 0.9, side: THREE.DoubleSide });
  g.add(mesh(shade, outer, false, false));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe2a8 })); bulb.position.y = 0.05; g.add(bulb);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x111111 })); cord.position.y = 0.95; g.add(cord);
  return g;
}

// dust motes floating in the lamp light
export function buildMotes(n = 140) {
  const pos = new Float32Array(n * 3), seed = new Float32Array(n), r = rng(31);
  for (let i = 0; i < n; i++) { const a = r() * TAU, rad = Math.sqrt(r()) * 0.55; pos[i * 3] = Math.cos(a) * rad; pos[i * 3 + 1] = FY + 0.15 + r() * 0.75; pos[i * 3 + 2] = Math.sin(a) * rad * 1.3; seed[i] = r() * 100; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = cv(64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,236,200,1)'); gr.addColorStop(1, 'rgba(255,236,200,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const mat = new THREE.PointsMaterial({ size: 0.006, map: tex(c), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  const base = pos.slice();
  pts.userData.step = (t) => { for (let i = 0; i < n; i++) { const s = seed[i]; pos[i * 3] = base[i * 3] + Math.sin(t * 0.13 + s) * 0.05; pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.09 + s * 1.7) * 0.04; pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.11 + s) * 0.05; } geo.attributes.position.needsUpdate = true; };
  return pts;
}

// a soft gold glow strip on the field under the rod you are holding
export function buildRodGlow() {
  const c = cv(256, 64), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,215,122,0)'); g.addColorStop(0.5, 'rgba(255,215,122,0.9)'); g.addColorStop(1, 'rgba(255,215,122,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(68 * U, 0.075), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2; m.position.y = FY + 0.002; m.renderOrder = 2;
  return m;
}
export { M4 };
