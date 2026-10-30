// Sapo 3D models. Game coordinates, metres: x across the table, y up from the table top, z from the front edge away from the thrower.
// (The presenter mounts everything in a mirrored root so these coordinates read exactly like src/scene.js.) All procedural.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { HW, TD, A, DISC_H, FROG, HOLES, BOARD_H } from '../src/phys.js';

const TAU = Math.PI * 2;
export const FLOOR_Y = -0.75, WALL_Z = 1.45;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
export const tex = (c, { repeat, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};
const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
export const brass = (o = {}) => phys({ color: '#d9a93c', metalness: 1, roughness: 0.27, envMapIntensity: 1.9, clearcoat: 0.25, clearcoatRoughness: 0.2, ...o });
const shadowed = (o, cast = true, recv = true) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); return o; };

// ---- the playing surface: planks, painted rings, folk border and the scores (one texture, in table coordinates) -------------------
export const TX0 = -HW - 0.045, TX1 = HW + 0.045, TZ0 = -0.045, TZ1 = TD + 0.02;
const LX = TX1 - TX0, LZ = TZ1 - TZ0;
function topTexture() {
  const S = 2048, c = cv(S), x = c.getContext('2d'), r = rngOf(11);
  const px = (u) => ((u - TX0) / LX) * S, py = (z) => (1 - (z - TZ0) / LZ) * S, pr = (m) => (m / LX) * S;
  const wood = B.woodCanvas(512, '#a86a2c', '#c88a46', 5, { lines: 150, knots: 1 }).map;
  const tints = ['#ffd9a0', '#ffffff', '#f0c080', '#ffe6b8', '#e8b878', '#fff0d0'];
  const n = 7, pw = (HW * 2) / n;
  x.fillStyle = '#4a2812'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    const x0 = px(-HW + i * pw), x1 = px(-HW + (i + 1) * pw);
    x.save(); x.beginPath(); x.rect(x0, 0, x1 - x0, S); x.clip(); x.drawImage(wood, (i * 173) % 200, (i * 91) % 200, 300, 300, x0 - 20, 0, x1 - x0 + 40, S);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = tints[i % 6]; x.globalAlpha = 0.35; x.fillRect(x0, 0, x1 - x0, S); x.restore();
    x.fillStyle = 'rgba(30,12,2,0.55)'; x.fillRect(x1 - 2, 0, 3, S);
  }
  for (let i = 0; i < 40; i++) { const gx = r() * S, gy = r() * S, rr = 30 + r() * 120, g = x.createRadialGradient(gx, gy, 0, gx, gy, rr); g.addColorStop(0, r() < 0.6 ? 'rgba(40,18,4,0.10)' : 'rgba(255,225,170,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(gx - rr, gy - rr, rr * 2, rr * 2); }
  // folk border: a cream line and a row of diamonds (teal, red, gold)
  const ins = 0.022, x0 = px(-HW + ins), x1 = px(HW - ins), z0 = py(ins), z1 = py(TD - ins);
  x.strokeStyle = '#f2e2b4'; x.lineWidth = 7; x.strokeRect(x0, z1, x1 - x0, z0 - z1);
  const cols = ['#2f8a7a', '#c5322c', '#e8c565'];
  const dm = (cx, cy, s, col) => { x.beginPath(); x.moveTo(cx, cy - s); x.lineTo(cx + s * 0.7, cy); x.lineTo(cx, cy + s); x.lineTo(cx - s * 0.7, cy); x.closePath(); x.fillStyle = col; x.fill(); };
  for (let i = 0; i < 17; i++) { const cx = x0 + 34 + (i * (x1 - x0 - 68)) / 16; dm(cx, z0 - 26, 15, cols[i % 3]); dm(cx, z1 + 26, 15, cols[(i + 1) % 3]); }
  for (let i = 0; i < 16; i++) { const cy = z1 + 70 + (i * (z0 - z1 - 140)) / 15; dm(x0 + 26, cy, 14, cols[i % 3]); dm(x1 - 26, cy, 14, cols[(i + 2) % 3]); }
  const ringCol = { mouth: '#f0c040', mill: '#e0463c', bridgeL: '#2f9a8a', bridgeR: '#2f9a8a', sideL: '#e8d9a8', sideR: '#e8d9a8', cornerL: '#e8903c', cornerR: '#e8903c' };
  for (const h of HOLES) {
    const cx = px(h.x), cy = py(h.z); x.lineWidth = 10; x.strokeStyle = ringCol[h.id]; x.beginPath(); x.arc(cx, cy, pr(h.R + 0.034), 0, TAU); x.stroke();
    x.lineWidth = 3; x.strokeStyle = 'rgba(20,8,0,0.55)'; x.beginPath(); x.arc(cx, cy, pr(h.R + 0.04), 0, TAU); x.stroke(); x.beginPath(); x.arc(cx, cy, pr(h.R + 0.028), 0, TAU); x.stroke();
    const tz = h.z - h.R - 0.07;
    x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${Math.round(pr(h.id === 'mouth' ? 0.062 : 0.05))}px 'Avenir Next Condensed','Arial Narrow',Arial,sans-serif`;
    x.lineWidth = 7; x.strokeStyle = 'rgba(25,10,0,0.85)'; x.strokeText(String(h.v), px(h.x), py(tz)); x.fillStyle = h.id === 'mouth' ? '#ffd36a' : '#fff0c4'; x.fillText(String(h.v), px(h.x), py(tz)); x.restore();
  }
  x.strokeStyle = 'rgba(245,230,190,0.7)'; x.lineWidth = 5; x.setLineDash([22, 14]); x.beginPath(); x.moveTo(px(-HW + 0.04), py(0.06)); x.lineTo(px(HW - 0.04), py(0.06)); x.stroke();
  return tex(c, { aniso: 16 });
}

// ---- table -----------------------------------------------------------------------------------------------------------------
function mirrorU(t) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; return t; }
function panelTexture() {
  const c = cv(1024, 640), x = c.getContext('2d'), r = rngOf(4);
  const g = x.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#2d7a6c'); g.addColorStop(1, '#14423b'); x.fillStyle = g; x.fillRect(0, 0, 1024, 640);
  for (let i = 0; i < 5000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.07)'; x.fillRect(r() * 1024, r() * 640, 1 + r() * 3, 1 + r() * 2); }
  x.strokeStyle = '#e2b84e'; x.lineWidth = 10; x.strokeRect(46, 50, 932, 540); x.lineWidth = 3; x.strokeRect(66, 70, 892, 500);
  x.fillStyle = '#e2b84e'; for (let i = 0; i <= 14; i++) { const cx = 80 + (i * 864) / 14; for (const cy of [96, 544]) { x.beginPath(); x.arc(cx, cy, 8, 0, TAU); x.fill(); } }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = "800 190px 'Avenir Next Condensed','Arial Narrow',Arial,sans-serif";
  const t = 'S A P O'; x.lineWidth = 10; x.strokeStyle = 'rgba(0,0,0,0.5)'; x.strokeText(t, 512, 330);
  const gg = x.createLinearGradient(0, 220, 0, 440); gg.addColorStop(0, '#fff0b0'); gg.addColorStop(0.5, '#e6b84a'); gg.addColorStop(1, '#a8761c'); x.fillStyle = gg; x.fillText(t, 512, 330);
  return tex(c, { aniso: 8 });
}
function boardTexture() {
  const c = cv(1024, 360), x = c.getContext('2d'), r = rngOf(6);
  const g = x.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, '#2b6e63'); g.addColorStop(1, '#15443d'); x.fillStyle = g; x.fillRect(0, 0, 1024, 360);
  for (let i = 0; i < 3500; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)'; x.fillRect(r() * 1024, r() * 360, 1 + r() * 3, 1 + r() * 2); }
  const star = (cx, cy, rr, col) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? rr * 0.45 : rr; x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); x.fillStyle = col; x.fill(); };
  for (let i = 0; i < 9; i++) star(70 + i * 110.5, 160, 34, i % 2 ? '#e8c565' : '#f6e8b6');
  x.strokeStyle = '#e8c565'; x.lineWidth = 6; x.beginPath(); for (let i = 0; i <= 40; i++) { const px = 40 + i * 24.6, py = 245 + Math.sin(i * 0.8) * 12; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  x.strokeStyle = '#c5322c'; x.lineWidth = 5; x.beginPath(); for (let i = 0; i <= 40; i++) { const px = 40 + i * 24.6, py = 285 - Math.sin(i * 0.8) * 12; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  return tex(c);
}
export function buildTable() {
  const g = new THREE.Group();
  const topMat = phys({ map: topTexture(), roughness: 0.62, clearcoat: 0, envMapIntensity: 0.08 });
  const sideMat = std({ color: '#6a3c1a', roughness: 0.6 });
  // plate with real holes (shape in x / -z; extruded then laid flat so the top face is y = 0)
  const sh = new THREE.Shape(); sh.moveTo(TX0, -TZ0); sh.lineTo(TX1, -TZ0); sh.lineTo(TX1, -TZ1); sh.lineTo(TX0, -TZ1); sh.closePath();
  for (const h of HOLES) { const p = new THREE.Path(); p.absarc(h.x, -h.z, h.R, 0, TAU, true); sh.holes.push(p); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false, curveSegments: 28 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, -0.05, 0);
  { const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) { if (n.getY(i) > 0.5) uv.setXY(i, (p.getX(i) - TX0) / LX, (p.getZ(i) - TZ0) / LZ); } uv.needsUpdate = true; }
  g.add(new THREE.Mesh(geo, [topMat, sideMat]));
  // cabinet (the thrower's side, -z, carries the painted panel)
  const side = std({ color: '#1d5249', roughness: 0.6 }), black = std({ color: '#050302', roughness: 1 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 0.08, 0.7, TD + 0.02), [side, side, black, black, side, std({ map: mirrorU(panelTexture()), roughness: 0.5, metalness: 0.1 })]);
  cab.position.set(0, -0.05 - 0.35, TD / 2 - 0.01); g.add(cab);
  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(LX + 0.01, 0.026, 0.012), brass()); frontLip.position.set(0, -0.006, TZ0); g.add(frontLip);
  const lipMat = std({ color: '#52301a', roughness: 0.5 });
  for (const [w, d, x, z] of [[LX, 0.045, 0, TZ0 + 0.0225], [0.045, LZ, TX0 + 0.0225, TZ0 + LZ / 2], [0.045, LZ, TX1 - 0.0225, TZ0 + LZ / 2]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), lipMat); b.position.set(x, 0.01, z); g.add(b); }
  for (const h of HOLES) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(h.R + 0.005, h.id === 'mouth' ? 0.009 : 0.0065, 12, 40), brass()); rim.rotation.x = Math.PI / 2; rim.position.set(h.x, 0.003, h.z); g.add(rim);
  }
  // back board (painted face towards the thrower, -z)
  const bw = HW * 2 + 0.09, gold = std({ color: '#c99a3a', metalness: 0.7, roughness: 0.4 }), back = std({ color: '#1d4f47' });
  const board = new THREE.Mesh(new THREE.BoxGeometry(bw, BOARD_H, 0.034), [gold, gold, gold, black, back, std({ map: mirrorU(boardTexture()), roughness: 0.5 })]);
  board.position.set(0, BOARD_H / 2, TD + 0.016); g.add(board);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.016, 0.02, 0.05), brass()); rail.position.set(0, BOARD_H + 0.002, TD + 0.016); g.add(rail);
  return shadowed(g);
}

// ---- frog -----------------------------------------------------------------------------------------------------------------
export function buildFrog() {
  const g = new THREE.Group(), body = brass({ color: '#d6a233', roughness: 0.3 }), dark = std({ color: '#140a04', roughness: 0.7 }), cast = brass({ color: '#9a6f1d', roughness: 0.42 });
  const sph = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 24), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; };
  const zc = FROG.z, white = std({ color: '#fff6dc', roughness: 0.25 }), pupil = std({ color: '#0e0804', roughness: 0.15, metalness: 0.2 });
  sph(FROG.r * 1.05, body, 0, 0.1, zc, 1.08, 0.92, 1.0);
  sph(0.07, body, -0.098, 0.05, zc + 0.02, 1, 0.8, 1.2); sph(0.07, body, 0.098, 0.05, zc + 0.02, 1, 0.8, 1.2);
  for (const sd of [-1, 1]) {
    sph(0.04, body, sd * 0.1, 0.05, zc - 0.07, 0.9, 1.1, 1);
    sph(0.034, cast, sd * 0.095, 0.014, zc - 0.115, 1.2, 0.4, 1.5);
    sph(0.04, cast, sd * 0.062, 0.2, zc - 0.03, 1, 1, 1);
    sph(0.034, white, sd * 0.062, 0.212, zc - 0.036, 1, 1, 1);
    sph(0.016, pupil, sd * 0.066, 0.218, zc - 0.066, 1, 1, 0.6);
  }
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.009, 10, 32, Math.PI), brass({ color: '#a87820' })); lip.rotation.set(0, 0, Math.PI); lip.scale.set(1, 0.42, 1); lip.position.set(0, 0.08, zc - 0.104); g.add(lip);
  const cavity = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.056, 0.03, 24), dark); cavity.scale.set(1, 1, 0.5); cavity.rotation.x = Math.PI / 2; cavity.position.set(0, 0.065, zc - 0.108); g.add(cavity);
  const tm = std({ color: '#a8221e', roughness: 0.5 });
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.006, 0.09), tm); tongue.position.set(0, 0.012, zc - 0.155); g.add(tongue);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.006, 20), tm); tip.position.set(0, 0.012, zc - 0.2); g.add(tip);
  const wr = rngOf(9); for (let i = 0; i < 16; i++) { const a = wr() * TAU, e = 0.3 + wr() * 0.7; sph(0.008 + wr() * 0.006, cast, Math.cos(a) * 0.1 * e, 0.19, zc + 0.04 + Math.sin(a) * 0.07 * e, 1, 0.8, 1); }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.012, 40), brass({ color: '#6a4a14', roughness: 0.5, envMapIntensity: 0.5 })); plate.position.set(0, 0.006, zc); g.add(plate);
  return shadowed(g);
}
export function buildBridge(h) {
  const g = new THREE.Group(), m = brass(), hz = h.z - h.R - 0.03, hh = 0.075;
  const arch = new THREE.Mesh(new THREE.TorusGeometry(h.R, 0.0065, 10, 28, Math.PI), m); arch.position.set(h.x, hh, hz); g.add(arch);
  for (const sd of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, hh, 10), m); l.position.set(h.x + sd * h.R, hh / 2, hz); g.add(l); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 14), m); f.position.set(h.x + sd * h.R, 0.003, hz); g.add(f); }
  return shadowed(g);
}
export function buildMill() {
  const h = HOLES[1], g = new THREE.Group(), blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Shape(), a0 = (i * Math.PI) / 2, pts = [[h.R + 0.012, 0], [h.R + 0.075, 0.18], [h.R + 0.075, 0.62], [h.R + 0.012, 0.55]];
    pts.forEach(([r, da], k) => { const px = Math.cos(a0 + da) * r, py = Math.sin(a0 + da) * r; k ? s.lineTo(px, py) : s.moveTo(px, py); });
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false }), std({ color: i % 2 ? '#e0b24a' : '#c5322c', roughness: 0.35, metalness: i % 2 ? 0.6 : 0.1 }));
    m.rotation.x = Math.PI / 2; m.position.y = 0.007; blades.add(m);
  }
  blades.position.set(h.x, 0, h.z); g.add(blades); g.userData.blades = blades;
  return shadowed(g);
}

// ---- discs -----------------------------------------------------------------------------------------------------------------
const faceTex = [0, 1].map((o) => {
  const c = cv(256), x = c.getContext('2d');
  x.lineWidth = 16; x.strokeStyle = o ? '#c5322c' : '#2f8f55'; x.beginPath(); x.arc(128, 128, 84, 0, TAU); x.stroke();
  x.lineWidth = 3; x.strokeStyle = 'rgba(40,24,6,0.7)'; x.beginPath(); x.arc(128, 128, 98, 0, TAU); x.stroke(); x.beginPath(); x.arc(128, 128, 70, 0, TAU); x.stroke();
  x.strokeStyle = 'rgba(50,30,6,0.85)'; x.lineWidth = 7; x.lineCap = 'round';
  for (let k = 0; k < 3; k++) { const a = (k * TAU) / 3; x.beginPath(); x.moveTo(128 + Math.cos(a) * 20, 128 + Math.sin(a) * 20); x.lineTo(128 + Math.cos(a) * 52, 128 + Math.sin(a) * 52); x.stroke(); }
  return tex(c);
});
let discGeo = null;
export function makeDisc(owner) {
  if (!discGeo) discGeo = new THREE.LatheGeometry([[0.0005, 0], [A - 0.005, 0], [A - 0.0008, 0.0012], [A, 0.004], [A, DISC_H - 0.004], [A - 0.0008, DISC_H - 0.0012], [A - 0.005, DISC_H], [0.0005, DISC_H]].map(([r, y]) => new THREE.Vector2(r, y)), 48);
  const g = new THREE.Group();
  const mat = owner ? phys({ color: '#d8dee4', metalness: 1, roughness: 0.22, envMapIntensity: 2.2 }) : phys({ color: '#e7b948', metalness: 1, roughness: 0.2, envMapIntensity: 2.4, clearcoat: 0.3, clearcoatRoughness: 0.15 });
  g.add(new THREE.Mesh(discGeo, mat));
  const face = new THREE.Mesh(new THREE.CircleGeometry(A * 0.98, 40), std({ map: faceTex[owner], transparent: true, metalness: 0.5, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
  face.rotation.x = -Math.PI / 2; face.position.y = DISC_H + 0.0006; g.add(face); g.userData.face = face;
  return shadowed(g);
}

// ---- the room ------------------------------------------------------------------------------------------------------------------
function tileTexture() {
  const c = cv(512), x = c.getContext('2d'), r = rngOf(21), n = 4, s = 512 / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const cx = i * s, cy = j * s, alt = (i + j) % 2;
    x.fillStyle = alt ? '#f1e3c0' : '#f7ecd0'; x.fillRect(cx, cy, s, s);
    x.fillStyle = alt ? '#2d6f86' : '#c5503c';
    x.save(); x.translate(cx + s / 2, cy + s / 2);
    for (let k = 0; k < 4; k++) { x.rotate(Math.PI / 2); x.beginPath(); x.moveTo(0, -s * 0.42); x.quadraticCurveTo(s * 0.18, -s * 0.28, 0, -s * 0.1); x.quadraticCurveTo(-s * 0.18, -s * 0.28, 0, -s * 0.42); x.fill(); }
    x.beginPath(); x.arc(0, 0, s * 0.07, 0, TAU); x.fillStyle = '#e0a93a'; x.fill(); x.restore();
    x.strokeStyle = alt ? '#2d6f86' : '#c5503c'; x.lineWidth = 3; x.strokeRect(cx + 8, cy + 8, s - 16, s - 16);
    x.strokeStyle = 'rgba(70,45,20,0.45)'; x.lineWidth = 3; x.strokeRect(cx, cy, s, s);
  }
  for (let i = 0; i < 2500; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; x.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3); }
  return tex(c, { repeat: [12, 6] });
}
function stuccoTexture() {
  const c = cv(512), x = c.getContext('2d'), r = rngOf(31);
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#9a5a3a'); g.addColorStop(1, '#b4703f'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) { const gx = r() * 512, gy = r() * 512, rr = 20 + r() * 90, gr = x.createRadialGradient(gx, gy, 0, gx, gy, rr); gr.addColorStop(0, r() < 0.5 ? 'rgba(255,230,180,0.05)' : 'rgba(110,60,30,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(gx - rr, gy - rr, rr * 2, rr * 2); }
  for (let i = 0; i < 6000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'; x.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
  return tex(c, { repeat: [8, 4] });
}
function floorTexture() {
  const c = cv(512), x = c.getContext('2d'), r = rngOf(41), n = 4, s = 128;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = 0.82 + r() * 0.3; x.fillStyle = `rgb(${Math.round(176 * v)},${Math.round(92 * v)},${Math.round(58 * v)})`; x.fillRect(i * s, j * s, s, s); for (let k = 0; k < 300; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,220,180,0.06)' : 'rgba(60,20,5,0.08)'; x.fillRect(i * s + r() * s, j * s + r() * s, 1 + r() * 3, 1 + r() * 3); } }
  x.strokeStyle = 'rgba(40,18,8,0.8)'; x.lineWidth = 4; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, 512); x.moveTo(0, i * s); x.lineTo(512, i * s); x.stroke(); }
  return tex(c, { repeat: [14, 12] });
}
let glowT = null;
export const glowTex = () => { if (glowT) return glowT; const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,230,160,0.95)'); g.addColorStop(0.2, 'rgba(255,190,90,0.45)'); g.addColorStop(1, 'rgba(255,150,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); glowT = tex(c); return glowT; };
function bottle(color, h, r) {
  const prof = [[0.001, 0], [r, 0], [r, h * 0.55], [r * 0.9, h * 0.68], [r * 0.34, h * 0.8], [r * 0.3, h * 0.96], [r * 0.36, h]].map(([a, b]) => new THREE.Vector2(a, b));
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), phys({ color, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6 }));
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.014, 12), std({ color: '#d9c18a', roughness: 0.9 })); cork.position.y = h + 0.003;
  const g = new THREE.Group(); g.add(m, cork); return g;
}
export function buildRoom() {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.4), std({ map: stuccoTexture(), roughness: 0.95 })); wall.position.set(0, 0.04 + 1.7, WALL_Z); wall.rotation.y = Math.PI; g.add(wall);
  const wains = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.79), std({ map: tileTexture(), roughness: 0.3 })); wains.position.set(0, FLOOR_Y + 0.395, WALL_Z - 0.003); wains.rotation.y = Math.PI; g.add(wains);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(8, 0.03, 0.05), std({ color: '#2d6f86', roughness: 0.4 })); cap.position.set(0, 0.04, WALL_Z - 0.02); g.add(cap);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), std({ map: floorTexture(), roughness: 0.55 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR_Y, -3.5); g.add(floor);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.026, 0.16), std({ color: '#5a3418', roughness: 0.6 })); shelf.position.set(0, 0.09, WALL_Z - 0.09); g.add(shelf);
  const bc = ['#2f8f55', '#c5322c', '#e0b24a', '#2f86c9', '#8a3c7a'];
  for (let i = 0; i < 11; i++) { const b = bottle(bc[i % 5], 0.2 + ((i * 7) % 5) * 0.012, 0.03); b.position.set(-0.75 + i * 0.15, 0.103, WALL_Z - 0.09); g.add(b); }
  const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push(new THREE.Vector3(-0.95 + u * 1.9, 0.33 - Math.sin(u * Math.PI) * 0.07, WALL_Z - 0.06)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.002, 5), std({ color: '#1a1410', roughness: 0.6 })));
  const bulbs = [];
  for (let i = 0; i < 13; i++) {
    const p = curve.getPoint((i + 0.5) / 13), b = new THREE.Mesh(new THREE.SphereGeometry(0.017, 14, 10), new THREE.MeshBasicMaterial({ color: '#fff0c0' })); b.position.copy(p); b.position.y -= 0.018; g.add(b);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 })); s.scale.set(0.2, 0.2, 1); s.position.copy(b.position); g.add(s); bulbs.push(s);
  }
  g.userData.bulbs = bulbs;
  const pc = ['#c5322c', '#2f9a8a', '#e8c565', '#d86aa0', '#3b7fc4'];
  for (let i = 0; i < 16; i++) {
    const u = (i + 0.5) / 16, s = new THREE.Shape(); s.moveTo(-0.04, 0); s.lineTo(0.04, 0); s.lineTo(0, -0.085); s.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), std({ color: pc[i % 5], roughness: 0.8, side: THREE.DoubleSide })); m.position.set(-0.92 + u * 1.84, 0.47 - Math.sin(u * Math.PI) * 0.06, WALL_Z - 0.04); g.add(m);
  }
  const potProf = [[0.001, 0], [0.07, 0], [0.09, 0.06], [0.1, 0.2], [0.11, 0.22], [0.1, 0.225]].map(([a, b]) => new THREE.Vector2(a, b));
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potProf, 24), std({ color: '#b5562f', roughness: 0.85 })); pot.position.set(0.66, FLOOR_Y, 1.2); g.add(pot);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.03, 0.36, 6), std({ color: i % 2 ? '#3f8a5a' : '#2f7a4c', roughness: 0.6 })); leaf.position.set(0.66 + Math.cos(a) * 0.07, FLOOR_Y + 0.38, 1.2 + Math.sin(a) * 0.07); leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(leaf); }
  return shadowed(g, true, true);
}
