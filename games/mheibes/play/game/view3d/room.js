// The majlis as a lit 3D set (shared by the in-game presenter and the offline icon render). Meters. Back wall at z = -5, floor y = 0,
// the viewer sits at +z. Everything is built from primitives: carpet (canvas texture + bump), plaster wall with a pointed-arch niche, tiled
// dado, floor cushions + bolsters, hanging pierced-brass lanterns that flicker, drapes that sway, a coffee set, drifting dust motes.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { CARPETS } from '../src/art.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, o = {}) => {
  const t = new THREE.CanvasTexture(c); t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); } return t;
};

// ---------------------------------------------------------------- canvases
function carpetCanvas(pal, S = 1024, bump = false) {
  const c = cv(S), x = c.getContext('2d'), r = lcg(5);
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, pal.a); g.addColorStop(1, pal.b);
  x.fillStyle = bump ? '#808080' : g; x.fillRect(0, 0, S, S);
  const line = bump ? '#ffffff' : pal.line, dot = bump ? '#ffffff' : pal.dot;
  const bw = S * 0.075;
  // lattice of diamonds with a dot, inside the border
  const n = 10, st = (S - bw * 2) / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const cx = bw + st * (i + 0.5), cy = bw + st * (j + 0.5), a = st * 0.43;
    x.beginPath(); x.moveTo(cx, cy - a); x.lineTo(cx + a, cy); x.lineTo(cx, cy + a); x.lineTo(cx - a, cy); x.closePath();
    x.fillStyle = bump ? '#303030' : 'rgba(0,0,0,0.22)'; x.fill(); x.lineWidth = S * 0.006; x.strokeStyle = line; x.globalAlpha = 0.8; x.stroke(); x.globalAlpha = 1;
    x.beginPath(); x.moveTo(cx, cy - a * 0.55); x.lineTo(cx + a * 0.55, cy); x.lineTo(cx, cy + a * 0.55); x.lineTo(cx - a * 0.55, cy); x.closePath(); x.lineWidth = S * 0.004; x.stroke();
    x.fillStyle = dot; x.beginPath(); x.arc(cx, cy, st * 0.045, 0, TAU); x.fill();
    if ((i + j) % 2 === 0) { x.fillStyle = line; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { x.beginPath(); x.arc(cx + dx * st * 0.5, cy + dy * st * 0.5, st * 0.03, 0, TAU); x.fill(); } }
  }
  // border: bands + running leaf
  x.lineWidth = S * 0.01; x.strokeStyle = line; x.strokeRect(bw * 0.18, bw * 0.18, S - bw * 0.36, S - bw * 0.36); x.strokeRect(bw * 0.85, bw * 0.85, S - bw * 1.7, S - bw * 1.7);
  x.fillStyle = bump ? '#bbbbbb' : 'rgba(255,255,255,0.10)';
  const m = 28; for (let k = 0; k < m; k++) {
    const t = (k + 0.5) / m * (S - bw * 2) + bw;
    for (const [px, py, rot] of [[t, bw * 0.5, 0], [t, S - bw * 0.5, Math.PI], [bw * 0.5, t, -Math.PI / 2], [S - bw * 0.5, t, Math.PI / 2]]) {
      x.save(); x.translate(px, py); x.rotate(rot); x.fillStyle = dot; x.globalAlpha = 0.75; x.beginPath(); x.ellipse(0, 0, bw * 0.12, bw * 0.28, 0, 0, TAU); x.fill(); x.restore();
    }
  }
  // wool: fine speckle
  for (let k = 0; k < S * 14; k++) { const px = r() * S, py = r() * S, a = r(); x.fillStyle = bump ? (a > 0.5 ? '#9a9a9a' : '#6a6a6a') : (a > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.10)'); x.fillRect(px, py, 2, 2); }
  return c;
}
function plasterCanvas(S = 512) {
  const c = cv(S), x = c.getContext('2d'), r = lcg(9);
  x.fillStyle = '#cfb48e'; x.fillRect(0, 0, S, S);
  for (let k = 0; k < 140; k++) { const px = r() * S, py = r() * S, rad = 20 + r() * 90, g = x.createRadialGradient(px, py, 0, px, py, rad); const d = r() > 0.5; g.addColorStop(0, d ? 'rgba(90,60,30,0.10)' : 'rgba(255,240,210,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
  for (let k = 0; k < 2500; k++) { x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; x.fillRect(r() * S, r() * S, 2, 2); }
  return c;
}
function tileCanvas(S = 512) {
  const c = cv(S), x = c.getContext('2d'), n = 4, t = S / n;
  x.fillStyle = '#f1e8d2'; x.fillRect(0, 0, S, S);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const cx = (i + 0.5) * t, cy = (j + 0.5) * t;
    x.fillStyle = (i + j) % 2 ? '#1e4a8a' : '#2a8a96'; x.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
    x.save(); x.translate(cx, cy); x.fillStyle = '#f1e8d2';
    x.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, rr = k % 2 ? t * 0.17 : t * 0.4; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.fill();
    x.fillStyle = (i + j) % 2 ? '#d9a63a' : '#1e4a8a'; x.beginPath(); x.arc(0, 0, t * 0.1, 0, TAU); x.fill(); x.restore();
    x.strokeStyle = '#c9a24b'; x.lineWidth = 4; x.strokeRect(i * t + 1, j * t + 1, t - 2, t - 2);
  }
  return c;
}
function starsCanvas(S = 512) {
  const c = cv(S), x = c.getContext('2d'), r = lcg(21);
  const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#0b1030'); g.addColorStop(0.7, '#27235a'); g.addColorStop(1, '#5a3a6a'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let k = 0; k < 90; k++) { const a = 0.35 + r() * 0.65; x.fillStyle = `rgba(255,240,200,${a})`; x.beginPath(); x.arc(r() * S, r() * S * 0.8, 0.8 + r() * 2, 0, TAU); x.fill(); }
  // a crescent
  x.fillStyle = '#ffe9a8'; x.beginPath(); x.arc(S * 0.7, S * 0.28, S * 0.06, 0, TAU); x.fill(); x.fillStyle = '#1c1a48'; x.beginPath(); x.arc(S * 0.725, S * 0.265, S * 0.055, 0, TAU); x.fill();
  return c;
}
function pierceCanvas(S = 256) {
  const c = cv(S, S), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, S, S); x.fillStyle = '#fff';
  const nx = 8, ny = 5, w = S / nx, h = S / ny;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const cx = (i + 0.5) * w, cy = (j + 0.5) * h; x.beginPath();
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU - Math.PI / 2, rr = k % 2 ? Math.min(w, h) * 0.12 : Math.min(w, h) * 0.34; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    x.closePath(); x.fill();
  }
  x.fillStyle = '#fff'; x.fillRect(0, 0, S, 10); x.fillRect(0, S - 10, S, 10);
  return c;
}
function clothCanvas(base, accent, S = 256) {
  const c = cv(S), x = c.getContext('2d'), r = lcg(33);
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  x.fillStyle = accent; x.globalAlpha = 0.9;
  for (let i = 0; i < 4; i++) { x.fillRect(0, i * S / 4 + S / 16, S, S / 40); }
  x.globalAlpha = 0.5;
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * S / 4 + S / 8, j * S / 4 + S / 32); x.lineTo(i * S / 4 + S / 8 + S / 20, j * S / 4 + S / 8); x.lineTo(i * S / 4 + S / 8, j * S / 4 + S / 4 - S / 32); x.lineTo(i * S / 4 + S / 8 - S / 20, j * S / 4 + S / 8); x.closePath(); x.fill(); }
  x.globalAlpha = 1;
  for (let k = 0; k < 3000; k++) { x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; x.fillRect(r() * S, r() * S, 1.5, 1.5); }
  return c;
}
export function blobCanvas(rgb, a = 1, S = 64) {
  const c = cv(S), x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.35, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, S, S); return c;
}

// ---------------------------------------------------------------- pieces
const brass = () => new THREE.MeshPhysicalMaterial({ color: 0xd8a640, metalness: 1, roughness: 0.28, clearcoat: 0.3, envMapIntensity: 1.5 });
const pointedArch = (w, h, k = 0.5) => {      // Shape of a pointed arch, springing at y = h - rise
  const s = new THREE.Shape(), hw = w / 2, rise = w * k;
  s.moveTo(-hw, 0); s.lineTo(-hw, h - rise); s.quadraticCurveTo(-hw * 0.9, h - rise * 0.25, 0, h); s.quadraticCurveTo(hw * 0.9, h - rise * 0.25, hw, h - rise); s.lineTo(hw, 0); s.closePath();
  return s;
};

export function makeLantern(scale = 1) {
  const g = new THREE.Group(), bm = brass();
  const pm = new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: 0.9, roughness: 0.35, alphaMap: tex(pierceCanvas(), { linear: true, repeat: [1, 1] }), alphaTest: 0.5, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.13, 0.5, 8, 1, true), pm); body.position.y = -0.3; g.add(body);
  const cap = new THREE.Mesh(B.lathe([[0.0, 0.12], [0.1, 0.1], [0.22, 0.02], [0.24, -0.02], [0.0, -0.02]], 24), bm); cap.position.y = -0.02; g.add(cap);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), bm); finial.position.y = 0.14; g.add(finial);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.03, 0.06, 8), bm); foot.position.y = -0.58; g.add(foot);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd890 })); core.position.y = -0.3; g.add(core);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(blobCanvas('255,196,110', 1, 64)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.scale.set(1.5, 1.5, 1); glow.position.y = -0.3; g.add(glow);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.4, 6), bm); chain.position.y = 0.84; g.add(chain);
  g.scale.setScalar(scale); g.userData = { core, glow };
  return g;
}

function makeDallah() {         // Arabic coffee pot: bulbous base, long neck, beak spout, lid finial
  const g = new THREE.Group(), m = brass();
  g.add(new THREE.Mesh(B.lathe([[0.0, 0.0], [0.085, 0.0], [0.1, 0.03], [0.105, 0.09], [0.08, 0.17], [0.045, 0.23], [0.035, 0.3], [0.05, 0.36], [0.06, 0.39], [0.0, 0.4]], 32), m));
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.2, 10), m); spout.position.set(0.15, 0.13, 0); spout.rotation.z = -0.9; g.add(spout);
  const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.01, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.6 })); hnd.position.set(-0.1, 0.2, 0); hnd.rotation.z = Math.PI / 2 + 0.2; g.add(hnd);
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), m); fin.position.y = 0.41; g.add(fin);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeCup() {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(B.lathe([[0.0, 0.0], [0.018, 0.0], [0.03, 0.02], [0.034, 0.06], [0.032, 0.06], [0.028, 0.02], [0.0, 0.006]], 20), new THREE.MeshPhysicalMaterial({ color: 0xf2e6c8, roughness: 0.15, clearcoat: 1, side: THREE.DoubleSide }));
  g.add(cup); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g;
}

// ---------------------------------------------------------------- the room
export function buildRoom(scene, { carpet = 'garnet', shadows = true } = {}) {
  const pal = CARPETS[carpet] || CARPETS.garnet, room = new THREE.Group(); room.name = 'majlis'; scene.add(room);
  const U = { room, lanterns: [], drapes: [], carpetMat: null };
  // floor: dark polished stone, then the rug
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), B.material('darkWood', { color: '#2a1a12', color2: '#4a3020', repeat: [10, 8], seed: 4 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.01, 0); floor.receiveShadow = true; room.add(floor);
  const cm = new THREE.MeshStandardMaterial({ map: tex(carpetCanvas(pal, 1024)), bumpMap: tex(carpetCanvas(pal, 512, true), { linear: true }), bumpScale: 1.4, roughness: 0.96, metalness: 0 });
  U.carpetMat = cm;
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(17, 30), cm); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.004, 10.0); rug.receiveShadow = true; room.add(rug);
  // fringe edge at the near end
  // back wall with a pointed-arch niche cut out
  const WALL_Z = -5, WH = 7.5, WW = 22;
  const ws = new THREE.Shape(); ws.moveTo(-WW / 2, 0); ws.lineTo(WW / 2, 0); ws.lineTo(WW / 2, WH); ws.lineTo(-WW / 2, WH); ws.closePath();
  const nw = 3.0, nh = 5.0, hole = pointedArch(nw, nh, 0.62); ws.holes.push(new THREE.Path(hole.getPoints(24)));
  const wg = new THREE.ShapeGeometry(ws, 12);
  const pl = tex(plasterCanvas(), { repeat: [0.18, 0.18] });
  const wall = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ map: pl, color: '#ead9bd', roughness: 0.95 })); wall.position.z = WALL_Z; wall.receiveShadow = true; room.add(wall);
  // night window deep inside the niche
  const win = new THREE.Mesh(new THREE.ShapeGeometry(pointedArch(nw, nh, 0.62)), new THREE.MeshBasicMaterial({ map: tex(starsCanvas()) }));
  const wuv = win.geometry.attributes.uv, wp = win.geometry.attributes.position; for (let i = 0; i < wuv.count; i++) wuv.setXY(i, wp.getX(i) / nw + 0.5, wp.getY(i) / nh);
  win.position.z = WALL_Z - 0.43; room.add(win);
  // reveal: the inside walls of the niche (an extruded arch seen from within)
  const revG = new THREE.ExtrudeGeometry(pointedArch(nw, nh, 0.62), { depth: 0.45, bevelEnabled: false, curveSegments: 20 });
  const rev = new THREE.Mesh(revG, new THREE.MeshStandardMaterial({ color: '#b89a72', roughness: 0.95, side: THREE.BackSide })); rev.position.z = WALL_Z - 0.45; rev.receiveShadow = true; room.add(rev);
  const pts = pointedArch(nw, nh, 0.62).getPoints(30);
  // brass frame along the arch + carved plaster band
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, WALL_Z + 0.02)));
  const frame = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.045, 8, false), brass()); frame.castShadow = false; room.add(frame);
  const band = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pointedArch(nw + 0.7, nh + 0.4, 0.62).getPoints(30).map((p) => new THREE.Vector3(p.x, p.y, WALL_Z + 0.03))), 80, 0.07, 6, false), new THREE.MeshStandardMaterial({ color: '#e3cfa4', roughness: 0.8 }));
  room.add(band);
  // tiled dado + cap rail
  const dado = new THREE.Mesh(new THREE.PlaneGeometry(WW, 1.35), new THREE.MeshStandardMaterial({ map: tex(tileCanvas(), { repeat: [WW / 1.35, 1] }), roughness: 0.28, metalness: 0.0 }));
  dado.position.set(0, 0.675, WALL_Z + 0.012); dado.receiveShadow = true; room.add(dado);
  const rail = new THREE.Mesh(B.slab(WW, 0.12, 0.1, 0.03, 0.02), B.material('wood', { color: '#6a3f1c', color2: '#9a6a30', repeat: [8, 1], seed: 12 })); rail.position.set(0, 1.4, WALL_Z + 0.06); room.add(rail);
  const base = new THREE.Mesh(B.slab(WW, 0.1, 0.18, 0.03, 0.02), brass()); base.position.set(0, 0.09, WALL_Z + 0.05); room.add(base);
  // majlis seating: long floor cushions with bolsters against the wall
  const cushTex = [clothCanvas('#27407f', '#e8c27a'), clothCanvas('#8c1f2b', '#f0d38a'), clothCanvas('#1f6b5c', '#f0d38a')];
  const cushMat = cushTex.map((c) => new THREE.MeshStandardMaterial({ map: tex(c, { repeat: [2, 1] }), roughness: 0.92 }));
  const seats = [[-5.5, 0], [-2.7, 1], [0, 2], [2.7, 1], [5.5, 0]];
  seats.forEach(([x, k], i) => {
    const s = new THREE.Mesh(B.roundedBox(2.7, 0.34, 1.05, 0.14, 5), cushMat[k]); s.position.set(x, 0.17, WALL_Z + 0.75); s.castShadow = s.receiveShadow = true; room.add(s);
    const bol = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.5, 20), cushMat[(k + 1) % 3]); bol.rotation.z = Math.PI / 2; bol.position.set(x, 0.58, WALL_Z + 0.28); bol.castShadow = true; room.add(bol);
    const bm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), brass()); bm.scale.set(0.5, 1, 1); bm.position.set(x - 1.26, 0.58, WALL_Z + 0.28); room.add(bm);
    const bm2 = bm.clone(); bm2.position.x = x + 1.26; room.add(bm2);
    if (i === 2) { const sq = new THREE.Mesh(B.roundedBox(0.7, 0.2, 0.7, 0.1, 4), cushMat[(k + 2) % 3]); sq.position.set(x, 0.44, WALL_Z + 0.9); sq.rotation.y = 0.5; sq.castShadow = true; room.add(sq); }
  });
  // hanging lanterns: one big in the middle, two small each side
  const lamp = makeLantern(1.6); lamp.position.set(0, 4.7, -3.2); room.add(lamp); U.lanterns.push({ g: lamp, ph: 0, big: true });
  for (const [x, y, z, s, ph] of [[-4.6, 4.6, -4.5, 1.0, 1.7], [4.6, 4.6, -4.5, 1.0, 3.4], [-8.2, 4.2, -3.5, 1.25, 5.1], [8.2, 4.2, -3.5, 1.25, 0.6]]) {
    const l = makeLantern(s); l.position.set(x, y, z); room.add(l); U.lanterns.push({ g: l, ph, big: false });
  }
  // drapes at both ends, pleated and swaying
  const drMat = new THREE.MeshStandardMaterial({ map: tex(clothCanvas('#4b1a3a', '#d8a640'), { repeat: [1.5, 3] }), roughness: 0.85, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const gm = new THREE.PlaneGeometry(2.4, 7, 30, 8), d = new THREE.Mesh(gm, drMat); d.position.set(sx * 9.4, 3.6, -3.8); d.castShadow = false; room.add(d);
    U.drapes.push({ m: d, sx, base: Float32Array.from(gm.attributes.position.array) });
  }
  // coffee set on a brass tray, front left of the rug
  const set = new THREE.Group(); set.position.set(-3.6, 0.02, -1.0); room.add(set);
  const tray = new THREE.Mesh(B.lathe([[0, 0], [0.34, 0], [0.38, 0.02], [0.4, 0.05], [0.36, 0.045], [0.0, 0.015]], 40), brass()); tray.castShadow = tray.receiveShadow = true; set.add(tray);
  const pot = makeDallah(); pot.position.set(-0.1, 0.02, 0.05); pot.rotation.y = 0.5; set.add(pot);
  for (let i = 0; i < 4; i++) { const c = makeCup(); const a = 0.4 + i * 0.5; c.position.set(0.12 + Math.cos(a) * 0.16, 0.025, -0.05 + Math.sin(a) * 0.16); set.add(c); }
  const dates = new THREE.Mesh(B.lathe([[0, 0], [0.12, 0], [0.15, 0.04], [0.0, 0.03]], 24), new THREE.MeshStandardMaterial({ color: 0xe6d3a8, roughness: 0.5 })); dates.position.set(0.2, 0.0, 0.1); dates.scale.setScalar(0.6); set.add(dates);
  U.set = set;
  // dust motes in the lamp light
  const n = 70, pos = new Float32Array(n * 3), r = lcg(77);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 12; pos[i * 3 + 1] = r() * 6; pos[i * 3 + 2] = -5 + r() * 9; }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ map: tex(blobCanvas('255,226,170', 0.9, 32)), size: 0.14, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  motes.frustumCulled = false; room.add(motes); U.motes = motes;
  // lights
  U.hemi = new THREE.HemisphereLight(0xffe6c8, 0x3a1f2a, 0.55); scene.add(U.hemi);
  U.key = new THREE.DirectionalLight(0xffd9a0, 1.4); U.key.position.set(-3, 9, 6); U.key.target.position.set(0, 0, -2); scene.add(U.key, U.key.target);
  if (shadows) { U.key.castShadow = true; U.key.shadow.mapSize.set(1024, 1024); Object.assign(U.key.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7, near: 1, far: 30 }); U.key.shadow.bias = -0.0004; U.key.shadow.normalBias = 0.03; }
  U.lampLight = new THREE.PointLight(0xffb060, 26, 18, 1.6); U.lampLight.position.set(0, 4.0, -2.4); scene.add(U.lampLight);
  U.sideL = new THREE.PointLight(0xffa050, 8, 10, 1.7); U.sideL.position.set(-5, 3.5, -3); scene.add(U.sideL);
  U.sideR = new THREE.PointLight(0xffa050, 8, 10, 1.7); U.sideR.position.set(5, 3.5, -3); scene.add(U.sideR);
  return U;
}

// per-frame life: flicker, swing, drape sway, motes. t in seconds, calm = reduced motion
export function animateRoom(U, t, dt, calm) {
  const fl = calm ? 1 : 0.88 + 0.08 * Math.sin(t * 9.1) + 0.05 * Math.sin(t * 17.3 + 1.2) + 0.03 * Math.sin(t * 3.1);
  U.lampLight.intensity = 26 * fl; U.sideL.intensity = 8 * (calm ? 1 : 0.9 + 0.1 * Math.sin(t * 7.7 + 2)); U.sideR.intensity = 8 * (calm ? 1 : 0.9 + 0.1 * Math.sin(t * 8.3));
  for (const l of U.lanterns) {
    const sw = calm ? 0 : Math.sin(t * 0.8 + l.ph) * 0.03; l.g.rotation.z = sw; l.g.rotation.x = calm ? 0 : Math.sin(t * 0.63 + l.ph * 1.3) * 0.02;
    l.g.userData.glow.scale.setScalar((l.big ? 1.9 : 1.2) * (calm ? 1 : 0.94 + 0.06 * Math.sin(t * 11 + l.ph)));
  }
  if (!calm) for (const d of U.drapes) {
    const p = d.m.geometry.attributes.position, b = d.base;
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3], y = b[i * 3 + 1], fold = Math.sin((x + d.sx * 0.0) * 5.2) * 0.1, swayAmp = (1 - (y / 7 + 0.5)) * 0.07;
      p.setZ(i, fold + Math.sin(t * 0.7 + x * 1.3 + y * 0.4) * swayAmp);
    }
    p.needsUpdate = true;
  }
  if (!calm) { const p = U.motes.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * 0.1; if (y > 6) y = 0.2; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.05); } p.needsUpdate = true; }
}

export function setCarpet(U, carpet) {
  const pal = CARPETS[carpet] || CARPETS.garnet;
  U.carpetMat.map.dispose(); U.carpetMat.map = tex(carpetCanvas(pal, 1024)); U.carpetMat.needsUpdate = true;
}

// A real gold ring with a faceted blue gem (used by the icon; the game bakes it to web/hands/ring.webp).
export function makeRing3d() {
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xf2bd48, metalness: 1, roughness: 0.2, clearcoat: 0.4, envMapIntensity: 1.6 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.11, 24, 72), gold));
  const gem = new THREE.MeshPhysicalMaterial({ color: 0x159be0, metalness: 0.3, roughness: 0.03, clearcoat: 1, emissive: 0x0a3a50, emissiveIntensity: 0.5, envMapIntensity: 1.2, flatShading: true });
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.11, 8, 1), gem); crown.position.y = 0.62;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 0.06, 8, 1), gem); top.position.y = 0.705;
  const pav = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.0, 0.1, 8), gem); pav.rotation.x = Math.PI; pav.position.y = 0.54;
  const bez = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.1, 24), gold); bez.position.y = 0.55;
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), gold); const a = i / 6 * TAU; c.position.set(Math.cos(a) * 0.22, 0.62, Math.sin(a) * 0.22); g.add(c); }
  g.add(bez, pav, crown, top); g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
