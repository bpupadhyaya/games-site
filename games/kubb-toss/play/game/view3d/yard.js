// The lit Kubb lawn (game-owned 3D art): mown grass with blades and stripes, the chalked pitch, corner and halfway stakes, a plank fence, a red
// timber cottage, pines and birches, shrubs and wild flowers, plus the wooden pieces (kubbs, the king with its gold crown, batons, thrower stands).
// Everything is procedural (canvas textures and analytic geometry): no asset bytes.
//
// Axes: sim (x across, y along the pitch, z up)  ->  three (X, Y, Z) = (x, z, -y). The pieces use the sim's own units (metres, SZ = 1.5 scale).
import * as THREE from '../vendor3d/three.js';
import { FIELD, KUBB, KING, BATON } from '../src/phys.js';

export const TAU = Math.PI * 2;
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function cvs(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c; }
export function tex(c, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
// the sun is behind and left of the thrower, high: shadows fall away to the right and up the pitch (the 2D scene's light)
export const SUN_DIR = new THREE.Vector3(-0.45, 0.74, 0.5).normalize();
export const TEAM_RGB = [[47, 127, 214], [239, 122, 34]];
const css = (c, k = 1, a = 1) => `rgba(${Math.min(255, Math.round(c[0] * k))},${Math.min(255, Math.round(c[1] * k))},${Math.min(255, Math.round(c[2] * k))},${a})`;

export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){
      float h = clamp(normalize(vP).y, 0.0, 1.0);
      vec3 hor = vec3(0.93,0.86,0.68), mid = vec3(0.78,0.82,0.74), top = vec3(0.36,0.56,0.82);
      vec3 c = mix(hor, mid, smoothstep(0.0, 0.12, h)); c = mix(c, top, smoothstep(0.1, 0.65, h));
      gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0); }`,
  });
}
export function envScene() {
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), skyMaterial()));
  const g = new THREE.Mesh(new THREE.CircleGeometry(60, 24), new THREE.MeshBasicMaterial({ color: 0x4f7a3a })); g.rotation.x = -Math.PI / 2; g.position.y = -1; sc.add(g);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0cc })); sun.position.copy(SUN_DIR).multiplyScalar(40); sc.add(sun);
  return sc;
}

// ---- textures ------------------------------------------------------------------------------------------------------------------
function lawnMap() {
  // one 1.6 m x 1.6 m tile: a light and a dark mown band along the pitch (v), fine blades and clover
  const c = cvs(512, 512, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = '#5a9a45'; g.fillRect(0, 0, w, h / 2); g.fillStyle = '#4b8a3a'; g.fillRect(0, h / 2, w, h / 2);
    for (let i = 0; i < 11000; i++) { const x = r() * w, y = r() * h, l = 3 + r() * 7, a = r() * 0.5 + 0.1, an = (r() - 0.5) * 0.8; g.strokeStyle = r() > 0.5 ? `rgba(160,210,100,${a * 0.5})` : `rgba(18,62,18,${a * 0.55})`; g.lineWidth = 1 + r() * 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(an) * l, y - Math.cos(an) * l); g.stroke(); }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + r() * 60},${150 + r() * 50},${60},0.16)`; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 7, 0, TAU); g.fill(); }
  });
  return tex(c, { repeat: [28, 38], aniso: 8 });
}
// the chalked pitch: finer mowing, boundary lines, the dashed halfway line, a faint ring under the king. 1 m = 200 px.
const PM = { x0: -2.5, x1: 2.5, y0: -0.7, y1: FIELD.L + 0.7, ppm: 200 };
function pitchMap() {
  const w = Math.round((PM.x1 - PM.x0) * PM.ppm), h = Math.round((PM.y1 - PM.y0) * PM.ppm);
  const c = cvs(w, h, (g) => {
    const X = (x) => (x - PM.x0) * PM.ppm, Y = (y) => (PM.y1 - y) * PM.ppm, r = rng(5);
    g.fillStyle = 'rgba(200,240,130,0.15)'; g.fillRect(0, 0, w, h);
    const n = 9, ya = -0.55, yb = FIELD.L + 0.55;
    for (let k = 0; k < n; k++) { if (k % 2) continue; const a = ya + (k * (yb - ya)) / n, b = ya + ((k + 1) * (yb - ya)) / n; g.fillStyle = 'rgba(25,85,25,0.14)'; g.fillRect(0, Y(b), w, (b - a) * PM.ppm); }
    for (let i = 0; i < 2600; i++) { g.fillStyle = r() > 0.5 ? 'rgba(210,240,140,0.10)' : 'rgba(20,70,20,0.10)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 5); }
    const hw = FIELD.W / 2, L = FIELD.L, lw = 0.05 * PM.ppm;
    g.strokeStyle = 'rgba(255,255,246,0.94)'; g.lineWidth = lw; g.lineCap = 'butt';
    g.strokeRect(X(-hw), Y(L), 2 * hw * PM.ppm, L * PM.ppm);
    g.setLineDash([0.16 * PM.ppm, 0.12 * PM.ppm]); g.strokeStyle = 'rgba(255,255,246,0.5)'; g.lineWidth = lw * 0.7; g.beginPath(); g.moveTo(X(-hw), Y(FIELD.MID)); g.lineTo(X(hw), Y(FIELD.MID)); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,250,0.3)'; g.lineWidth = 0.02 * PM.ppm; g.beginPath(); g.arc(X(0), Y(FIELD.MID), 0.54 * PM.ppm, 0, TAU); g.stroke();
    // chalk is dusty: a few soft gaps on the long lines
    for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(70,120,50,0.5)'; g.fillRect(X(r() < 0.5 ? -hw : hw) - lw / 2, r() * h, lw, 1 + r() * 3); }
  });
  return tex(c, { aniso: 8 });
}
function woodMap(seed, band, tone = 1) {
  // side of a block, 256 wide (around) x 512 tall (bottom to top). band: [r,g,b] painted ring near the top, or 'gold'
  const c = cvs(256, 512, (g, w, h) => {
    const r = rng(seed), k = tone;
    g.fillStyle = css([226, 188, 122], k); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 38; i++) { const x = r() * w; g.strokeStyle = `rgba(${r() > 0.5 ? '255,236,190' : '120,78,36'},${0.05 + r() * 0.13})`; g.lineWidth = 1 + r() * 2.4; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 20, h * 0.3, x + (r() - 0.5) * 20, h * 0.7, x + (r() - 0.5) * 12, h); g.stroke(); }
    for (let i = 0; i < 3; i++) { const kx = 30 + r() * (w - 60), ky = 60 + r() * (h - 160); g.fillStyle = 'rgba(100,60,24,0.5)'; g.beginPath(); g.ellipse(kx, ky, 5 + r() * 4, 9 + r() * 6, 0, 0, TAU); g.fill(); }
    const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, 'rgba(60,34,12,0.34)'); sh.addColorStop(0.3, 'rgba(60,34,12,0)'); sh.addColorStop(1, 'rgba(255,240,200,0.08)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
    if (band) { const col = band === 'gold' ? [232, 184, 62] : band; for (const [a, b] of band === 'gold' ? [[0.26, 0.34]] : [[0.04, 0.2]]) { g.fillStyle = css(col, 0.96); g.fillRect(0, a * h, w, (b - a) * h); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, a * h, w, 3); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, b * h - 3, w, 3); } }
  });
  return tex(c, { aniso: 8 });
}
function topMap(col, king) {
  const c = cvs(256, 256, (g, w, h) => {
    if (col) { g.fillStyle = css(col, 0.96); g.fillRect(0, 0, w, h); const rg = g.createRadialGradient(w * 0.4, h * 0.4, 8, w / 2, h / 2, w * 0.72); rg.addColorStop(0, 'rgba(255,255,255,0.28)'); rg.addColorStop(1, 'rgba(0,0,0,0.26)'); g.fillStyle = rg; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 6; g.strokeRect(24, 24, w - 48, h - 48); }
    else { g.fillStyle = '#d6a864'; g.fillRect(0, 0, w, h); const r = rng(9); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(110,70,30,${0.08 + r() * 0.18})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.arc(w / 2 + (r() - 0.5) * 30, h / 2 + (r() - 0.5) * 30, 10 + i * 3, 0, TAU); g.stroke(); } }
    if (king) { g.fillStyle = '#e9b83e'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.36, 0, TAU); g.fill(); g.strokeStyle = 'rgba(110,70,10,0.8)'; g.lineWidth = 4; g.stroke(); }
  });
  return tex(c);
}
function endGrainMap() { return topMap(null, false); }

// ---- geometry --------------------------------------------------------------------------------------------------------------------
// A box with softly rounded edges (a real turned/sanded block), keeping the box's six UV groups so each face can carry its own material.
export function roundedBox(w, h, d, r, seg = 4) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 3, seg * 2), p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), q = new THREE.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    q.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    const dir = v.clone().sub(q); if (dir.lengthSq() > 1e-12) { dir.normalize(); v.copy(q).addScaledVector(dir, r); n.setXYZ(i, dir.x, dir.y, dir.z); }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}
const M = (o) => new THREE.MeshStandardMaterial(o);

// ---- the wooden pieces ----------------------------------------------------------------------------------------------------------
export function makePieceKit() {
  const kit = { kubb: [], king: null, baton: [], geo: {} };
  const kg = roundedBox(KUBB.w, KUBB.h, KUBB.w, 0.022 * 1.5), ng = roundedBox(KING.w, KING.h, KING.w, 0.026 * 1.5);
  const bottom = tex(cvs(64, 64, (g, w, h) => { g.fillStyle = '#a87c46'; g.fillRect(0, 0, w, h); }));
  for (let t = 0; t < 2; t++) {
    const col = TEAM_RGB[t], side = woodMap(3 + t, col), top = topMap(col, false);
    const sm = M({ map: side, roughness: 0.62, metalness: 0 }), tm = M({ map: top, roughness: 0.5, metalness: 0 }), bm = M({ map: bottom, roughness: 0.8 });
    kit.kubb.push({ geo: kg, mats: [sm, sm, tm, bm, sm, sm] });
  }
  const ks = M({ map: woodMap(21, 'gold', 0.92), roughness: 0.58 }), kt = M({ map: topMap([205, 150, 90], true), roughness: 0.4 }), kb = M({ color: 0x8a6030, roughness: 0.8 });
  kit.king = { geo: ng, mats: [ks, ks, kt, kb, ks, ks] };
  kit.crown = M({ color: 0xe9b83e, roughness: 0.28, metalness: 0.85 });
  kit.wood = M({ color: 0xdcae68, roughness: 0.55 });
  kit.band = [0, 1].map((t) => M({ color: new THREE.Color(...TEAM_RGB[t].map((v) => v / 255)).convertSRGBToLinear(), roughness: 0.5 }));
  kit.white = M({ color: 0xfff6e2, roughness: 0.5 });
  kit.batonGeo = new THREE.CapsuleGeometry(BATON.r, BATON.len - 2 * BATON.r, 6, 14);
  kit.bandGeo = new THREE.CylinderGeometry(BATON.r * 1.05, BATON.r * 1.05, BATON.len * 0.09, 14);
  kit.bandMid = new THREE.CylinderGeometry(BATON.r * 1.05, BATON.r * 1.05, BATON.len * 0.06, 14);
  return kit;
}
export function makeKingCrown(kit) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.078, 0.035, 24), kit.crown); ring.position.y = 0.018; g.add(ring);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU, sp = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.02, 0.07, 10), kit.crown); sp.position.set(Math.cos(a) * 0.062, 0.07, Math.sin(a) * 0.062); sp.castShadow = true; g.add(sp); const bl = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), kit.crown); bl.position.set(Math.cos(a) * 0.062, 0.11, Math.sin(a) * 0.062); g.add(bl); }
  g.position.y = KING.h / 2; g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function makeBaton(kit, team) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(kit.batonGeo, kit.wood); body.rotation.z = Math.PI / 2; g.add(body);   // axis along local X (the sim's baton axis)
  for (const px of [-0.36, 0.36]) { const b = new THREE.Mesh(kit.bandGeo, kit.band[team]); b.rotation.z = Math.PI / 2; b.position.x = px * BATON.len; g.add(b); }
  const mid = new THREE.Mesh(kit.bandMid, kit.white); mid.rotation.z = Math.PI / 2; g.add(mid);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
// the thrower's stand: a team-coloured disc, a wooden holder ring and (when held) a baton standing in it. Local origin = on the grass.
export function makeStand(kit, team) {
  const g = new THREE.Group(), tc = new THREE.Color(...TEAM_RGB[team].map((v) => v / 255)).convertSRGBToLinear();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.04, 36), M({ color: tc, roughness: 0.45 })); disc.position.y = 0.02;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.014, 8, 36), M({ color: tc.clone().multiplyScalar(1.5), roughness: 0.4 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.04;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.006, 28), M({ color: tc.clone().multiplyScalar(0.35), roughness: 0.6 })); inner.position.y = 0.043;
  const holder = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.026, 10, 22), M({ color: 0x7a4c22, roughness: 0.6 })); holder.rotation.x = Math.PI / 2; holder.position.y = 0.07;
  const tilt = new THREE.Group(); tilt.position.y = 0.05;
  const baton = makeBaton(kit, team); baton.rotation.z = Math.PI / 2; baton.position.y = BATON.len / 2 * 0.82; baton.scale.set(0.82, 1, 1);
  tilt.add(baton);
  g.add(disc, rim, inner, holder, tilt);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { tilt, baton };
  return g;
}

// ---- the yard ------------------------------------------------------------------------------------------------------------------
export async function buildYard(tierName, nap) {
  const root = new THREE.Group(), sway = [], low = tierName === 'low';
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(80, 90), M({ map: lawnMap(), roughness: 0.95 }));
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0, -8); lawn.receiveShadow = true; root.add(lawn);
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(PM.x1 - PM.x0, PM.y1 - PM.y0), new THREE.MeshStandardMaterial({ map: pitchMap(), transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  pm.rotation.x = -Math.PI / 2; pm.position.set((PM.x0 + PM.x1) / 2, 0.003, -(PM.y0 + PM.y1) / 2); pm.receiveShadow = true; pm.renderOrder = 1; root.add(pm);
  await nap();

  // stakes: white with painted thirds (red at the corners, blue at halfway)
  const hw = FIELD.W / 2;
  const stakeMat = [0, 1].map((i) => M({ color: i ? 0x2f7fd6 : 0xd83a30, roughness: 0.5 })), stakeWhite = M({ color: 0xf4ede0, roughness: 0.55 });
  const stakeGeo = new THREE.CylinderGeometry(0.024, 0.03, 0.5, 12), capGeo = new THREE.CylinderGeometry(0.0245, 0.0245, 0.5 / 3, 12), tip = new THREE.CylinderGeometry(0, 0.024, 0.04, 12);
  const addStake = (x, y, blue) => {
    const s = new THREE.Group(), body = new THREE.Mesh(stakeGeo, stakeWhite); body.position.y = 0.25;
    const a = new THREE.Mesh(capGeo, stakeMat[blue ? 1 : 0]); a.position.y = 0.5 - 0.5 / 6; const b = new THREE.Mesh(capGeo, stakeMat[blue ? 1 : 0]); b.position.y = 0.5 / 6;
    const t = new THREE.Mesh(tip, stakeMat[blue ? 1 : 0]); t.position.y = 0.52; s.add(body, a, b, t); s.position.set(x, 0, -y);
    s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); root.add(s);
  };
  for (const [x, y] of [[-hw, 0], [hw, 0], [-hw, FIELD.L], [hw, FIELD.L]]) addStake(x, y, false);
  addStake(-hw, FIELD.MID, true); addStake(hw, FIELD.MID, true);

  // plank fence with posts and two rails
  const FY = 9.2, fenceMat = M({ color: 0x9a7348, roughness: 0.85 }), railMat = M({ color: 0xa88056, roughness: 0.85 });
  const nPost = 36; const post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), fenceMat, nPost);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < nPost; i++) { m4.makeTranslation(-16 + i * 0.9, 0.5, -FY); post.setMatrixAt(i, m4); }
  post.castShadow = true; root.add(post);
  for (const z of [0.3, 0.64]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(32.4, 0.07, 0.04), railMat); rail.position.set(0, z, -FY + 0.05); rail.castShadow = true; root.add(rail); }
  await nap();

  // trees (instanced), shrubs, flowers, cottage
  const r = rng(31337), pines = [], birches = [];
  for (let i = 0; i < 70; i++) { const t = { x: (r() - 0.5) * 2 * 14, z: 11 + r() * 10, h: 2.8 + r() * 3.6, k: r() }; if (Math.abs(t.x + 6.4) < 2.6 && t.z < 16.5) continue; (t.k < 0.72 ? pines : birches).push(t); }
  const cone = new THREE.CylinderGeometry(0, 1, 1, 16, 1), trunk = new THREE.CylinderGeometry(0.5, 0.7, 1, 7), blob = new THREE.SphereGeometry(1, 14, 10);
  const pineMat = M({ color: 0xffffff, roughness: 0.9 }), barkMat = M({ color: 0x5a3e28, roughness: 0.95 }), birchMat = M({ color: 0xece6d6, roughness: 0.8 }), leafMat = M({ color: 0xffffff, roughness: 0.9 });
  const pineI = new THREE.InstancedMesh(cone, pineMat, pines.length * 4), pineT = new THREE.InstancedMesh(trunk, barkMat, pines.length), birchT = new THREE.InstancedMesh(trunk, birchMat, birches.length), leafI = new THREE.InstancedMesh(blob, leafMat, birches.length * 5);
  const col = new THREE.Color(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  pines.forEach((t, i) => {
    m4.compose(ps.set(t.x, t.h * 0.09, -t.z), q.identity(), sc.set(t.h * 0.05, t.h * 0.18, t.h * 0.05)); pineT.setMatrixAt(i, m4);
    for (let l = 0; l < 4; l++) { const f = l / 4, w = t.h * 0.3 * (1.12 - f * 0.55), hh = t.h * 0.4; m4.compose(ps.set(t.x, t.h * (0.12 + f * 0.58) + hh / 2, -t.z), q.identity(), sc.set(w, hh, w)); pineI.setMatrixAt(i * 4 + l, m4); pineI.setColorAt(i * 4 + l, col.setRGB(0.12 + r() * 0.06, 0.3 + r() * 0.1, 0.18 + r() * 0.05).convertSRGBToLinear()); }
  });
  birches.forEach((t, i) => {
    m4.compose(ps.set(t.x, t.h * 0.275, -t.z), q.identity(), sc.set(t.h * 0.03, t.h * 0.55, t.h * 0.03)); birchT.setMatrixAt(i, m4);
    for (let l = 0; l < 5; l++) { const a = r() * TAU, d = r() * t.h * 0.2, rad = t.h * (0.14 + r() * 0.07); m4.compose(ps.set(t.x + Math.cos(a) * d, t.h * 0.72 + r() * 0.3, -t.z + Math.sin(a) * d), q.identity(), sc.set(rad, rad * 0.85, rad)); leafI.setMatrixAt(i * 5 + l, m4); leafI.setColorAt(i * 5 + l, col.setRGB(0.42 + r() * 0.16, 0.66 + r() * 0.12, 0.28).convertSRGBToLinear()); }
  });
  root.add(pineI, pineT, birchT, leafI);
  await nap();
  // shrubs along the fence
  const shrubs = new THREE.InstancedMesh(blob, M({ color: 0xffffff, roughness: 0.9 }), 26);
  for (let i = 0; i < 26; i++) { const rad = 0.12 + r() * 0.16; m4.compose(ps.set((r() - 0.5) * 30, rad * 0.55, -(8.9 + r() * 0.5)), q.identity(), sc.set(rad * 1.3, rad * 0.8, rad)); shrubs.setMatrixAt(i, m4); shrubs.setColorAt(i, col.setRGB(0.16 + r() * 0.1, 0.4 + r() * 0.15, 0.2).convertSRGBToLinear()); }
  root.add(shrubs);
  const nFl = low ? 60 : 220, fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 7, 5), M({ color: 0xffffff, roughness: 0.6 }), nFl), palette = [[1, 0.97, 0.76], [1, 1, 1], [1, 0.82, 0.25], [0.96, 0.65, 0.76]];
  for (let i = 0; i < nFl; i++) { const side = r() < 0.5 ? -1 : 1, x = side * (FIELD.W / 2 + 0.9 + r() * 6), y = -3.5 + r() * 12; m4.compose(ps.set(x, 0.02, -y), q.identity(), sc.set(1, 0.6, 1)); fl.setMatrixAt(i, m4); const p = palette[Math.floor(r() * 4)]; fl.setColorAt(i, col.setRGB(p[0], p[1], p[2]).convertSRGBToLinear()); }
  root.add(fl);
  // the cottage: red timber walls, white corners, dark roof, two lit windows, a door
  const cot = new THREE.Group(), cw = 3.4, ch = 1.9, cd = 2.2;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), M({ color: 0xb8352c, roughness: 0.85 })); wall.position.y = ch / 2;
  const roofShape = new THREE.Shape(); roofShape.moveTo(-cd / 2 - 0.25, 0); roofShape.lineTo(0, 1.2); roofShape.lineTo(cd / 2 + 0.25, 0); roofShape.closePath();
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: cw + 0.5, bevelEnabled: false }), M({ color: 0x3d3a40, roughness: 0.8 })); roof.rotation.y = Math.PI / 2; roof.position.set(-(cw + 0.5) / 2, ch, 0);
  const trim = M({ color: 0xf4ede0, roughness: 0.7 });
  const win = (x) => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.62, 0.06), trim), g = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.07), M({ color: 0x7fb4d8, emissive: 0xffd88a, emissiveIntensity: 0.35, roughness: 0.3 })); f.position.set(x, 1.15, cd / 2 + 0.02); g.position.set(x, 1.15, cd / 2 + 0.03); return [f, g]; };
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.1, 0.06), M({ color: 0x6a2018, roughness: 0.8 })); door.position.set(0.2, 0.55, cd / 2 + 0.03);
  const corner = (x) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, ch, 0.12), trim); c.position.set(x, ch / 2, cd / 2); return c; };
  cot.add(wall, roof, ...win(-1.0), ...win(1.05), door, corner(-cw / 2), corner(cw / 2));
  cot.position.set(-6.4, 0, -14.6); cot.rotation.y = 0.0; cot.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  root.add(cot);
  await nap();
  return { root, sway };
}
