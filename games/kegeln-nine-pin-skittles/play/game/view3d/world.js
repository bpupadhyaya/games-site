// The Kegelbahn: a German inn's skittle alley, built from lit geometry. Honey-maple lane with a brass foul strip, turned ivory pins with red necks,
// a dark rosewood ball, whitewashed plaster with timber posts, oak panelling, iron wall lanterns, a green felt scoreboard on the back wall and a net
// over the pit. Lane coordinates are the simulation's: x across the lane (right positive), z down the lane from the foul line, in metres. THREE space
// uses X = x and Z = -z (so a camera behind the foul line looking toward -Z sees +x on its right) and Y up.
import * as THREE from '../vendor3d/three.js';
import { lathe } from '../vendor3d/board3d.js';
import { LANE_HALF, BOARD_X, BACK_Z, PIN_Z0, PIN_POS, BALL_R, KING } from '../src/phys.js';

export const ROOM_X = 2.05, WALL_Z = 24.6, APP_Z = -5, ROOM_H = 3.9, PIN_K = 1.35, TAU = Math.PI * 2;
const LANE_W = LANE_HALF * 2, GUT = 0.14;

const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const mixc = (a, b, t) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
function tex(canvas, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
let CACHE = new Map();
export const clearCaches = () => { CACHE = new Map(); };
const once = (k, f) => { if (!CACHE.has(k)) CACHE.set(k, f()); return CACHE.get(k); };

// ------------------------------------------------------------------------------------------------ materials
function laneMaps() {
  return once('lane', () => {
    const W = 512, H = 1024, c = cv(W, H), g = c.getContext('2d'), b = cv(W, H), bg = b.getContext('2d'), r = rng(11), n = 13, pw = W / n;
    bg.fillStyle = '#808080'; bg.fillRect(0, 0, W, H);
    for (let i = 0; i < n; i++) {
      const tone = 0.5 + 0.5 * Math.sin(i * 2.7 + 0.6) * Math.cos(i * 1.3), x0 = i * pw;
      g.fillStyle = mixc([196, 136, 66], [230, 174, 98], tone); g.fillRect(x0, 0, pw + 1, H);
      for (let k = 0; k < 34; k++) {
        const x = x0 + r() * pw, a = 0.05 + r() * 0.12, dark = r() < 0.65, ph = r() * 6, amp = 0.6 + r() * 1.6;
        g.strokeStyle = dark ? `rgba(92,50,16,${a})` : `rgba(255,236,190,${a})`; g.lineWidth = 0.6 + r() * 1.3; g.beginPath();
        for (let y = 0; y <= H; y += 16) { const xx = x + Math.sin(y * 0.011 + ph) * amp; y ? g.lineTo(xx, y) : g.moveTo(xx, y); }
        g.stroke();
        bg.strokeStyle = dark ? `rgba(0,0,0,${a * 1.4})` : `rgba(255,255,255,${a})`; bg.lineWidth = 1; bg.beginPath(); bg.moveTo(x, 0); bg.lineTo(x, H); bg.stroke();
      }
      const yj = r() * H;   // a butt joint between two boards
      g.fillStyle = 'rgba(70,36,12,0.4)'; g.fillRect(x0, yj, pw, 1.4); bg.fillStyle = 'rgba(0,0,0,0.55)'; bg.fillRect(x0, yj, pw, 2);
    }
    for (let i = 0; i <= n; i++) { g.fillStyle = 'rgba(66,34,10,0.42)'; g.fillRect(i * pw - 0.8, 0, 1.6, H); bg.fillStyle = 'rgba(0,0,0,0.7)'; bg.fillRect(i * pw - 1, 0, 2, H); }
    return { map: tex(c, { repeat: [1, 6.4] }), bump: tex(b, { repeat: [1, 6.4], srgb: false }) };
  });
}
export const laneMat = () => once('laneMat', () => {
  const m = laneMaps();
  return new THREE.MeshPhysicalMaterial({ map: m.map, bumpMap: m.bump, bumpScale: 0.5, roughness: 0.46, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.22, envMapIntensity: 0.55 });
});
function floorMat() {
  return once('floorMat', () => {
    const W = 512, H = 512, c = cv(W, H), g = c.getContext('2d'), r = rng(23), n = 8, pw = W / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = mixc([62, 38, 22], [84, 54, 32], r()); g.fillRect(i * pw, 0, pw + 1, H);
      for (let k = 0; k < 20; k++) { g.strokeStyle = `rgba(20,8,2,${0.08 + r() * 0.16})`; g.lineWidth = 0.7 + r(); const x = i * pw + r() * pw; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 6, H); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(i * pw, 0, 1.5, H);
    }
    return new THREE.MeshStandardMaterial({ map: tex(c, { repeat: [ROOM_X * 2 / 1.6, (WALL_Z - APP_Z) / 1.6] }), roughness: 0.6, metalness: 0 });
  });
}
function plasterMat() {
  return once('plasterMat', () => {
    const W = 512, H = 512, c = cv(W, H), g = c.getContext('2d'), r = rng(5);
    g.fillStyle = '#a98d62'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 5200; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,244,216,0.07)' : 'rgba(90,60,28,0.07)'; const s = 1 + r() * 4; g.fillRect(r() * W, r() * H, s, s); }
    for (let i = 0; i < 9; i++) { const gr = g.createRadialGradient(r() * W, r() * H, 0, r() * W, r() * H, 140); gr.addColorStop(0, 'rgba(120,80,40,0.1)'); gr.addColorStop(1, 'rgba(120,80,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    // dark timber frame: posts at the tile edges, a sill and a diagonal brace
    const wood = (x, y, w, h) => { g.fillStyle = '#34200f'; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + w - 3, y, 3, h); g.fillStyle = 'rgba(255,220,160,0.1)'; g.fillRect(x, y, 2, h); for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(10,4,0,${0.1 + r() * 0.2})`; g.lineWidth = 1; const xx = x + r() * w; g.beginPath(); g.moveTo(xx, y); g.lineTo(xx + (r() - 0.5) * 5, y + h); g.stroke(); } };
    wood(0, 0, 34, H); wood(W - 34, 0, 34, H); wood(0, 0, W, 30); wood(0, H - 40, W, 40);
    const sh = g.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(20,10,0,0.5)'); sh.addColorStop(0.5, 'rgba(20,10,0,0.05)'); sh.addColorStop(1, 'rgba(20,10,0,0.25)'); g.fillStyle = sh; g.fillRect(0, 0, W, H);
    return new THREE.MeshStandardMaterial({ map: tex(c, { repeat: [(WALL_Z - APP_Z) / 3.3, 1] }), roughness: 0.9, metalness: 0 });
  });
}
function panelMat() {
  return once('panelMat', () => {
    const W = 512, H = 256, c = cv(W, H), g = c.getContext('2d'), r = rng(9);
    g.fillStyle = '#3a2214'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 90; k++) { g.strokeStyle = `rgba(${r() < 0.5 ? '16,6,0' : '120,76,40'},${0.06 + r() * 0.14})`; g.lineWidth = 0.6 + r() * 1.4; const y = r() * H; g.beginPath(); for (let x = 0; x <= W; x += 16) { const yy = y + Math.sin(x * 0.02 + k) * 3; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); }
    for (const px of [18, 270]) { g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.strokeRect(px, 22, 224, H - 44); g.strokeStyle = 'rgba(255,200,130,0.16)'; g.lineWidth = 1.5; g.strokeRect(px + 3, 25, 218, H - 50); }
    return new THREE.MeshStandardMaterial({ map: tex(c, { repeat: [(WALL_Z - APP_Z) / 3.3, 1] }), roughness: 0.5, metalness: 0, envMapIntensity: 0.6 });
  });
}
function ballTex() {
  return once('ballTex', () => {
    const c = cv(512, 256), g = c.getContext('2d'), r = rng(31);
    g.fillStyle = '#3a160e'; g.fillRect(0, 0, 512, 256);
    for (let k = 0; k < 90; k++) { g.strokeStyle = `rgba(${r() < 0.5 ? '20,6,2' : '150,70,40'},${0.08 + r() * 0.16})`; g.lineWidth = 1 + r() * 2; const y = r() * 256; g.beginPath(); for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + k) * 6); g.stroke(); }
    g.fillStyle = 'rgba(244,222,176,0.9)'; g.fillRect(0, 118, 512, 20);          // pale equator ring, so the roll can be seen
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(80 + k * 170, 60, 20, 0, TAU); g.fillStyle = 'rgba(244,222,176,0.85)'; g.fill(); }
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(165 + k * 170, 196, 20, 0, TAU); g.fillStyle = 'rgba(244,222,176,0.85)'; g.fill(); }
    return tex(c, {});
  });
}
const brass = () => once('brass', () => new THREE.MeshStandardMaterial({ color: 0xd8a642, roughness: 0.3, metalness: 1, envMapIntensity: 1.6 }));
const iron = () => once('iron', () => new THREE.MeshStandardMaterial({ color: 0x1c1a19, roughness: 0.55, metalness: 0.8, envMapIntensity: 0.8 }));
const darkOak = () => once('darkOak', () => new THREE.MeshPhysicalMaterial({ color: 0x4b2c17, roughness: 0.4, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2 }));

export function softDot(rgb = '255,200,120') {
  return once('dot' + rgb, () => { const c = cv(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.35, `rgba(${rgb},0.4)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return tex(c, {}); });
}

// ------------------------------------------------------------------------------------------------ the alley
const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, -z); m.castShadow = false; m.receiveShadow = true; return m; };

export function scoreboard() {
  const g = new THREE.Group(), W = 1024, H = 640, c = cv(W, H), x = c.getContext('2d'), r = rng(77);
  x.fillStyle = '#1d5a3d'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 16000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'; x.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
  const gl = x.createRadialGradient(W / 2, H * 0.4, 40, W / 2, H / 2, W * 0.7); gl.addColorStop(0, 'rgba(255,230,150,0.12)'); gl.addColorStop(1, 'rgba(0,0,0,0.35)'); x.fillStyle = gl; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(244,236,214,0.85)'; x.fillStyle = 'rgba(244,236,214,0.92)'; x.lineCap = 'round';
  x.font = 'italic 800 118px Georgia, "Times New Roman", serif'; x.textAlign = 'center'; x.fillText('Alle Neune!', W / 2, 150);
  x.lineWidth = 3; x.beginPath(); x.moveTo(150, 178); x.lineTo(W - 150, 178); x.stroke();
  x.lineWidth = 2.5; for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) { const bx = 120 + col * 290, by = 240 + row * 110; x.beginPath(); x.moveTo(bx, by + 50); x.lineTo(bx + 230, by + 50); x.stroke(); for (let k = 0; k < 5 + ((col + row * 2) % 4); k++) { x.beginPath(); x.moveTo(bx + 10 + k * 20, by + 4); x.lineTo(bx + 10 + k * 20, by + 42); x.stroke(); if (k === 4) { x.beginPath(); x.moveTo(bx, by + 38); x.lineTo(bx + 110, by + 8); x.stroke(); } } }
  const t = tex(c, {}), face = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.56), new THREE.MeshStandardMaterial({ map: t, roughness: 1, emissiveMap: t, emissive: 0x335544, emissiveIntensity: 0.55 }));
  const fm = darkOak(), fw = 0.12;
  g.add(face, box(2.5 + fw * 2, fw, 0.1, fm, 0, 0.78 + fw / 2, 0), box(2.5 + fw * 2, fw, 0.1, fm, 0, -0.78 - fw / 2, 0));
  g.add(box(fw, 1.56, 0.1, fm, 1.25 + fw / 2, 0, 0), box(fw, 1.56, 0.1, fm, -1.25 - fw / 2, 0, 0));
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 8), brass()); n.position.set(sx * 1.31, sy * 0.84, 0.06); g.add(n); }
  // a chalk ledge with a piece of chalk
  const ledge = box(2.7, 0.06, 0.16, fm, 0, -0.92, 0); ledge.position.z = 0.05; g.add(ledge);
  return g;
}

export function lantern() {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: 0xff9a30, emissive: 0xff7a12, emissiveIntensity: 1.1, roughness: 0.4, transparent: true, opacity: 0.95 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.3, 14), glass); body.position.y = 0;
  const cap = new THREE.Mesh(lathe([[0.001, 0.32], [0.05, 0.3], [0.13, 0.2], [0.14, 0.155], [0.001, 0.155]], 16), iron()); cap.position.y = 0;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.05, 14), iron()); base.position.y = -0.175;
  g.add(body, cap, base);
  for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + Math.PI / 4, bar = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.3, 0.014), iron()); bar.position.set(Math.cos(a) * 0.092, 0, Math.sin(a) * 0.092); g.add(bar); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 8, 16), iron()); ring.position.y = 0.34; ring.rotation.x = Math.PI / 2; g.add(ring);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot('255,176,84'), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(1.25); g.add(halo); g.userData.halo = halo;
  return g;
}

function wallLantern(side) {
  const g = new THREE.Group(), L = lantern();
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.035), iron()); arm.position.set(-side * 0.17, 0.42, 0);
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.025), iron()); brace.position.set(-side * 0.15, 0.2, 0); brace.rotation.z = side * 0.75;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.14), iron()); plate.position.set(-side * 0.34, 0.22, 0);
  g.add(arm, brace, plate); L.position.set(0, 0.04, 0); g.add(L);
  return g;
}

function netMesh() {
  const c = cv(128, 128), g = c.getContext('2d'); g.strokeStyle = 'rgba(214,196,160,0.85)'; g.lineWidth = 3;
  for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  const t = tex(c, { repeat: [2 * BOARD_X / 0.16, 1.5 / 0.16] });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_X * 2, 1.5), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(0, 0.7 + 0.75, -BACK_Z - 0.02); return m;
}

export function buildAlley() {
  const root = new THREE.Group(), lm = laneMat();
  const zLen = BACK_Z - APP_Z, zMid = (BACK_Z + APP_Z) / 2;
  // floor and the lane block
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_X * 2, WALL_Z - APP_Z), floorMat()); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.14, -(WALL_Z + APP_Z) / 2); floor.receiveShadow = true; root.add(floor);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W, zLen), lm); lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0, -zMid); lane.receiveShadow = true; root.add(lane);
  const block = box(LANE_W + 2 * (GUT + 0.07), 0.14, zLen, darkOak(), 0, -0.075, zMid); root.add(block);
  for (const sd of [-1, 1]) {
    // gutter: a recessed dark channel, then a dark wooden trim
    const gx = sd * (LANE_HALF + GUT / 2);
    const gut = box(GUT, 0.012, zLen, new THREE.MeshStandardMaterial({ color: 0x0f0905, roughness: 0.5 }), gx, -0.05, zMid); root.add(gut);
    const wall = box(0.012, 0.05, zLen, new THREE.MeshStandardMaterial({ color: 0x241408, roughness: 0.4 }), sd * LANE_HALF, -0.025, zMid); root.add(wall);
    const trim = box(0.07, 0.06, zLen, darkOak(), sd * (LANE_HALF + GUT + 0.035), 0.0, zMid); root.add(trim);
  }
  // foul strip: brass plate set in the maple
  const foul = box(LANE_W, 0.008, 0.07, brass(), 0, 0.003, 0); root.add(foul);
  const approach = box(LANE_W, 0.0025, 0.012, new THREE.MeshBasicMaterial({ color: 0x24120a }), 0, 0.0035, 0.07); root.add(approach);
  // approach arrows (three small brass diamonds) so the lane reads as a lane
  for (const ax of [-0.3, 0, 0.3]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.005, 4), brass()); d.rotation.y = Math.PI / 4; d.position.set(ax, 0.004, -(ax === 0 ? 4.0 : 3.6)); root.add(d); }
  // pin deck: paler panel across the pit with a dark spot under every pin
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_X * 2, BACK_Z - (PIN_Z0 - 0.3)), new THREE.MeshPhysicalMaterial({ color: 0xf0cf94, map: laneMaps().map, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.2 }));
  deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0.004, -((BACK_Z + PIN_Z0 - 0.3) / 2)); deck.receiveShadow = true; root.add(deck);
  const seam = box(BOARD_X * 2, 0.006, 0.03, new THREE.MeshBasicMaterial({ color: 0x4a2a10 }), 0, 0.008, PIN_Z0 - 0.3); root.add(seam);
  for (const p of PIN_POS) {
    const sp = new THREE.Mesh(new THREE.CircleGeometry(0.052, 20), new THREE.MeshBasicMaterial({ color: 0x20100a, transparent: true, opacity: 0.8, depthWrite: false }));
    sp.rotation.x = -Math.PI / 2; sp.position.set(p.x, 0.0095, -p.z); sp.renderOrder = 1; root.add(sp);
  }
  // pit boards and the back board, then the net
  for (const sd of [-1, 1]) root.add(box(0.06, 0.5, BACK_Z - (PIN_Z0 - 0.3), darkOak(), sd * (BOARD_X + 0.03), 0.25, (BACK_Z + PIN_Z0 - 0.3) / 2));
  root.add(box(BOARD_X * 2 + 0.12, 0.7, 0.08, darkOak(), 0, 0.35, BACK_Z + 0.04));
  root.add(netMesh());
  // the ball return rail on the right, with a spare ball waiting at its end
  const rail = box(0.2, 0.05, PIN_Z0 - 0.4 - APP_Z, new THREE.MeshPhysicalMaterial({ color: 0x8a5428, roughness: 0.35, clearcoat: 0.7 }), 1.12, 0.12, (PIN_Z0 - 0.4 + APP_Z) / 2); root.add(rail);
  root.add(box(0.2, 0.1, PIN_Z0 - 0.4 - APP_Z, darkOak(), 1.12, 0.045, (PIN_Z0 - 0.4 + APP_Z) / 2));
  root.add(box(0.012, 0.012, PIN_Z0 - 0.4 - APP_Z, brass(), 1.12, 0.15, (PIN_Z0 - 0.4 + APP_Z) / 2));
  const spare = makeBall(); spare.mesh.position.set(1.12, 0.15 + BALL_R, -(-1.6)); spare.mesh.position.z = 1.6; spare.mesh.rotation.y = 1.2; root.add(spare.mesh);
  // walls: oak panelling below the rail, plaster and timber above
  const wallH = ROOM_H;
  for (const sd of [-1, 1]) {
    const wy0 = 1.05, lower = new THREE.Mesh(new THREE.PlaneGeometry(WALL_Z - APP_Z, wy0), panelMat()); lower.position.set(sd * ROOM_X, wy0 / 2 - 0.14 + 0.14, -(WALL_Z + APP_Z) / 2); lower.rotation.y = -sd * Math.PI / 2; lower.receiveShadow = true; root.add(lower);
    const upper = new THREE.Mesh(new THREE.PlaneGeometry(WALL_Z - APP_Z, wallH - wy0), plasterMat()); upper.position.set(sd * ROOM_X, wy0 + (wallH - wy0) / 2, -(WALL_Z + APP_Z) / 2); upper.rotation.y = -sd * Math.PI / 2; root.add(upper);
    const rail2 = box(0.1, 0.07, WALL_Z - APP_Z, darkOak(), sd * (ROOM_X - 0.05), wy0, (WALL_Z + APP_Z) / 2); root.add(rail2);
    const skirt = box(0.06, 0.14, WALL_Z - APP_Z, darkOak(), sd * (ROOM_X - 0.03), 0.0, (WALL_Z + APP_Z) / 2); root.add(skirt);
    // wall lanterns on brackets, staggered
    for (let i = 0; i < 6; i++) {
      const wl = wallLantern(sd), z = 1.2 + i * 4 + (sd > 0 ? 2 : 0);
      wl.position.set(sd * (ROOM_X - 0.02), 2.05, -z); root.add(wl);
    }
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_X * 2, wallH), plasterMat()); back.position.set(0, wallH / 2, -WALL_Z); root.add(back);
  const backLow = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_X * 2, 1.05), panelMat()); backLow.position.set(0, 0.525, -WALL_Z + 0.01); root.add(backLow);
  const sb = scoreboard(); sb.position.set(0, 2.55, -WALL_Z + 0.06); root.add(sb);
  // two small shelves with stoneware steins either side of the board
  for (const sx of [-1, 1]) {
    root.add(box(0.9, 0.04, 0.22, darkOak(), sx * 1.52, 1.7, WALL_Z - 0.11));
    for (let k = 0; k < 3; k++) { const s = stein(); s.position.set(sx * (1.2 + k * 0.28), 1.72, -(WALL_Z - 0.12)); root.add(s); }
  }
  // roof beams only along the top of the walls and across the far end (nothing between the camera and the lane)
  for (const sd of [-1, 1]) root.add(box(0.2, 0.22, WALL_Z - APP_Z, darkOak(), sd * (ROOM_X - 0.1), wallH - 0.1, (WALL_Z + APP_Z) / 2));
  root.add(box(ROOM_X * 2, 0.22, 0.2, darkOak(), 0, wallH - 0.1, WALL_Z - 0.1));
  return root;
}

function stein() {
  const g = new THREE.Group(), mat = new THREE.MeshPhysicalMaterial({ color: 0xcdb98f, roughness: 0.35, clearcoat: 0.8 });
  g.add(new THREE.Mesh(lathe([[0.001, 0], [0.058, 0], [0.062, 0.02], [0.056, 0.17], [0.06, 0.19], [0.001, 0.19]], 16), mat));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.02, 14), new THREE.MeshStandardMaterial({ color: 0x9fa4a8, metalness: 1, roughness: 0.3 })); lid.position.y = 0.2; g.add(lid);
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 8, 14, Math.PI), mat); h.position.set(0.06, 0.1, 0); h.rotation.z = -Math.PI / 2; g.add(h);
  g.scale.setScalar(1.15); return g;
}

// ------------------------------------------------------------------------------------------------ pins and the ball
// The classic nine-pin: a turned profile of (height, radius) from the foot up, lit ivory with a red neck (gold on the King).
const PROFILE = [[0, 0.034], [0.008, 0.05], [0.035, 0.06], [0.1, 0.062], [0.16, 0.054], [0.21, 0.04], [0.245, 0.027], [0.275, 0.025], [0.305, 0.032], [0.34, 0.039], [0.365, 0.034], [0.38, 0.02], [0.385, 0]];
const seg = (h0, h1, grow = 0) => {
  const pts = [];
  const rAt = (h) => { for (let i = 0; i + 1 < PROFILE.length; i++) { const [a, ra] = PROFILE[i], [b, rb] = PROFILE[i + 1]; if (h >= a && h <= b) return ra + (rb - ra) * ((h - a) / (b - a || 1)); } return 0.03; };
  pts.push([rAt(h0) + grow, h0]);
  for (const [h, r] of PROFILE) if (h > h0 && h < h1) pts.push([r + grow, h]);
  pts.push([rAt(h1) + grow, h1]);
  return pts;
};
// Smooth the turned profile (Catmull-Rom through the measured points) so the head and neck are round, not faceted.
const smooth = (pts, n = 6) => {
  const out = [], P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i + 1 < pts.length; i++) for (let k = 0; k < n; k++) {
    const t = k / n, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    out.push([Math.max(0.0005, f(P(i - 1)[0], P(i)[0], P(i + 1)[0], P(i + 2)[0])), f(P(i - 1)[1], P(i)[1], P(i + 1)[1], P(i + 2)[1])]);
  }
  out.push(pts[pts.length - 1]); return out;
};
export function pinGeos() {
  return once('pinGeos', () => ({
    body: lathe(smooth(PROFILE.map(([h, r]) => [Math.max(0.0005, r), h])), 40),
    neck: lathe(smooth(seg(0.21, 0.275, 0.0009), 3), 40),
    crown: lathe(smooth(seg(0.34, 0.385, 0.0009), 3), 40),
    groove: [0.205, 0.28, 0.1].map((h) => lathe(seg(h - 0.004, h + 0.004, 0.0011), 24)),
  }));
}
export function makePin(isKing) {
  const G = pinGeos(), g = new THREE.Group();
  const ivory = once('ivoryMat', () => new THREE.MeshPhysicalMaterial({ color: 0xf2e6c6, roughness: 0.34, clearcoat: 0.85, clearcoatRoughness: 0.12, envMapIntensity: 0.9 }));
  const red = once('redMat', () => new THREE.MeshPhysicalMaterial({ color: 0xb02a1e, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const gold = once('goldMat', () => new THREE.MeshStandardMaterial({ color: 0xe0a93a, roughness: 0.26, metalness: 0.9, envMapIntensity: 1.5 }));
  const groove = once('grooveMat', () => new THREE.MeshStandardMaterial({ color: 0x4a2a12, roughness: 0.6 }));
  const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };
  g.add(mk(G.body, ivory), mk(G.neck, isKing ? gold : red));
  if (isKing) g.add(mk(G.crown, gold));
  for (const gg of G.groove) g.add(mk(gg, groove));
  const pin = new THREE.Group(); pin.add(g); pin.scale.setScalar(PIN_K);
  const root = new THREE.Group(); root.add(pin); root.userData.pin = pin;
  return root;
}
export function makeBall() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 36, 24), new THREE.MeshPhysicalMaterial({ map: ballTex(), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 }));
  m.castShadow = true; m.receiveShadow = false;
  return { mesh: m };
}

// A soft contact shadow (a dark gradient disc lying on the lane).
export function blob(w = 0.3, d = 0.3, op = 0.6) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: softDot('0,0,0'), color: 0x000000, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 2; return m;
}

export const KING_ID = KING;
