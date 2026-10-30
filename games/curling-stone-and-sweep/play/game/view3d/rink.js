// Stone and Sweep 3D rink (game-owned): a lit curling hall. Pure scene building, no game state.
// World mapping: sim (x, y, z) -> three (x, z, -y). The ice surface is y = 0; the button is the origin; +y runs towards the far house.
import * as THREE from '../vendor3d/three.js';
import { HALF_W, HOG_FAR, HOG_NEAR, BACK, HOUSE_R, EIGHT_R, FOUR_R, BUTTON_R, NEAR_TEE, R } from '../src/sim.js';

export const Y_NEAR = -38.5, Y_FAR = BACK + 0.55;           // ice runs from just behind the hack to the end board
const LEN = Y_FAR - Y_NEAR;
export const cvs = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); fn(g, w, h); return c; };
export const tex = (c, repeat) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const P = (x, y, z = 0) => [x, z, -y];

// ---- ice texture: white-blue ice with every painted line, hog lines, tee lines, and the two houses -------------------------------
function iceTexture() {
  const PPM = 120, w = Math.round(2 * HALF_W * PPM), h = Math.round(LEN * PPM);
  const px = (x) => (x + HALF_W) * PPM, py = (y) => (Y_FAR - y) * PPM;
  const c = cvs(w, h, (g) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#cfe3f1'); gr.addColorStop(0.5, '#f1f8fd'); gr.addColorStop(1, '#cfe3f1');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 520; i++) {      // hairline scratches and frost
      const x = r() * w, y = r() * h, l = 20 + r() * 90, a = Math.PI / 2 + (r() - 0.5) * 0.3;
      g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.35 + r() * 0.3})` : `rgba(120,160,200,${0.12 + r() * 0.12})`; g.lineWidth = 0.6 + r() * 1.3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l * 0.3, y + Math.sin(a) * l); g.stroke();
    }
    const band = (y, t, col) => { g.fillStyle = col; g.fillRect(0, py(y) - (t * PPM) / 2, w, t * PPM); };
    g.fillStyle = 'rgba(40,88,150,0.5)'; g.fillRect(px(0) - 0.012 * PPM, 0, 0.025 * PPM, h);                     // centre line
    for (const tee of [0, NEAR_TEE]) band(tee, 0.025, 'rgba(40,88,150,0.6)');
    band(BACK, 0.025, 'rgba(40,88,150,0.55)'); band(-NEAR_TEE * 0 + (NEAR_TEE - BACK), 0.025, 'rgba(40,88,150,0.55)');
    band(HOG_FAR, 0.1, 'rgba(204,52,48,0.9)'); band(HOG_NEAR, 0.1, 'rgba(204,52,48,0.9)');
    band(-HOG_NEAR * 0 - 37.8, 0.05, 'rgba(40,88,150,0.5)');                                                      // hack line
    const house = (cy) => {
      const ring = (rr, f, e) => { g.beginPath(); g.arc(px(0), py(cy), rr * PPM, 0, Math.PI * 2); g.fillStyle = f; g.fill(); g.lineWidth = 2; g.strokeStyle = e; g.stroke(); };
      ring(HOUSE_R, '#2a68b8', 'rgba(14,52,110,0.8)'); ring(EIGHT_R, '#f4f9ff', 'rgba(110,150,190,0.8)'); ring(FOUR_R, '#cf302e', 'rgba(110,20,20,0.7)'); ring(BUTTON_R, '#fbfdff', 'rgba(110,150,190,0.8)');
    };
    house(0); house(NEAR_TEE);
  });
  return tex(c);
}
function pebbleBump() {
  const c = cvs(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let i = 0; i < 2600; i++) { const x = r() * w, y = r() * h, q = 1 + r() * 2.4; const gr = g.createRadialGradient(x, y, 0, x, y, q); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - q, y - q, q * 2, q * 2); }
  });
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2 * HALF_W / 0.9, LEN / 0.9); t.anisotropy = 4; return t;
}
// ---- the hall around the ice, as a reflection source for the glossy ice and the granite --------------------------------------------
export function envScene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x0b1626);
  const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1d8).multiplyScalar(1.3) });
  for (let i = 0; i < 7; i++) for (const x of [-4.5, 0, 4.5]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 3.2), lamp); m.position.set(x * 3, 9, -i * 10 + 20); s.add(m); }
  const wall = new THREE.MeshBasicMaterial({ color: 0x2c4f7a });
  for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 14, 110), wall); m.position.set(sx * 22, 3, -30); s.add(m); }
  const sc = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff3dc })); sc.position.set(0, 4, -75); s.add(sc);
  return s;
}
const glow = (col) => cvs(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, col); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });

export function buildRink(tierName, nap) {
  const root = new THREE.Group();
  const lowQ = tierName === 'low';
  // ice
  const ice = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF_W, LEN), new THREE.MeshPhysicalMaterial({
    map: iceTexture(), bumpMap: pebbleBump(), bumpScale: 0.55, roughness: 0.22, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 0.7, color: 0xffffff, emissive: 0x6d8fb4, emissiveIntensity: 0.22,
  }));
  ice.rotation.x = -Math.PI / 2; ice.position.set(0, 0, -(Y_NEAR + Y_FAR) / 2); ice.receiveShadow = true; root.add(ice);
  // pools of hall light lying on the ice (additive, soft): the sheen a lit rink shows
  const poolTex = tex(glow('rgba(255,255,255,1)'));
  for (let i = 0; i < 9; i++) for (const x of [-1.1, 1.1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 7), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xcfe6ff }));
    m.rotation.x = -Math.PI / 2; m.position.set(...P(x, -34 + i * 4.3, 0.004)); m.renderOrder = 0; root.add(m);
  }
  // boards: dark steel-blue with a pale cap rail, brass studs; end board
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x1f3a5c, roughness: 0.45, metalness: 0.25 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xdfe9f3, roughness: 0.3, metalness: 0.4 });
  const add = (geo, mat, x, y, z, sh = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(...P(x, y, z)); m.castShadow = sh; m.receiveShadow = true; root.add(m); return m; };
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.32, 0.5, LEN), boardMat, sx * (HALF_W + 0.16), (Y_NEAR + Y_FAR) / 2, 0.25);
    add(new THREE.BoxGeometry(0.4, 0.06, LEN), capMat, sx * (HALF_W + 0.16), (Y_NEAR + Y_FAR) / 2, 0.53);
  }
  add(new THREE.BoxGeometry(2 * HALF_W + 0.8, 0.9, 0.3), boardMat, 0, Y_FAR + 0.15, 0.45);
  add(new THREE.BoxGeometry(2 * HALF_W + 0.9, 0.06, 0.4), capMat, 0, Y_FAR + 0.15, 0.93);
  // the hack: two foot rubbers set in the ice
  const rub = new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.9 });
  for (const hx of [-0.14, 0.14]) add(new THREE.BoxGeometry(0.11, 0.035, 0.4), rub, hx, -37.6, 0.015, false);
  // the surrounding floor and hall
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x24384f, roughness: 0.5, metalness: 0.2 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 150), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.02, -(Y_NEAR + Y_FAR) / 2 - 10); floor.receiveShadow = true; root.add(floor);
  // stands left and right: stepped tiers of seats
  const seatCols = [0x2c4a74, 0x3a5f8e, 0x7a3b3a, 0x2c4a74, 0x8a7440];
  for (const sx of [-1, 1]) for (let t = 0; t < 5; t++) {
    const m = add(new THREE.BoxGeometry(2.4, 0.9 + t * 0.9, 70), new THREE.MeshStandardMaterial({ color: seatCols[t], roughness: 0.85, emissive: seatCols[t], emissiveIntensity: 0.35 }), sx * (HALF_W + 3.6 + t * 2.2), -4, (0.9 + t * 0.9) / 2 - 0.02, false);
    m.receiveShadow = false;
  }
  // back wall with a scoreboard glow, and the roof lights
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x142235, roughness: 0.9 });
  add(new THREE.BoxGeometry(60, 14, 0.6), wallMat, 0, 14, 7, false);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: tex(cvs(512, 128, (g, w, h) => {
    g.fillStyle = '#071322'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#2a68b8'); gr.addColorStop(0.5, '#6fb8ff'); gr.addColorStop(1, '#cf302e');
    g.fillStyle = gr; g.fillRect(10, 10, w - 20, 6); g.fillRect(10, h - 16, w - 20, 6);
    g.fillStyle = '#e9f4ff'; g.font = '800 54px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STONE & SWEEP', w / 2, h / 2);
  })) }));
  board.position.set(...P(0, 6.6, 6)); board.rotation.y = Math.PI; root.add(board);
  const bm = new THREE.MeshBasicMaterial({ color: 0xfff0d6 });
  for (let i = 0; i < 4; i++) for (const x of [-6, 0, 6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 4), bm); l.position.set(...P(x, 4 - i * 10, 9.5)); root.add(l); }
  // pennants along the rafters
  const flagCols = [0x2a68b8, 0xcf302e, 0xf3c331, 0xeaf3fb];
  for (let i = 0; i < 24; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshBasicMaterial({ color: flagCols[i % 4], side: THREE.DoubleSide })); f.position.set(...P(-8 + (i % 2) * 16, 6 - i * 1.7, 8.5)); f.rotation.y = Math.PI / 2; root.add(f); }
  const glows = [];
  if (!lowQ) for (let i = 0; i < 4; i++) for (const x of [-6, 0, 6]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(glow('rgba(255,236,200,0.95)')), transparent: true, depthWrite: false, opacity: 0.55, blending: THREE.AdditiveBlending }));
    sp.position.set(...P(x, 4 - i * 10, 9.3)); sp.scale.set(3.2, 3.2, 1); root.add(sp); glows.push(sp);
  }
  void nap;
  return { root, ice, glows };
}

// ---- a granite stone: lathe body with a running band, polished top, translucent handle housing + coloured handle ----------------
const stoneCache = {};
export function stoneParts() {
  if (stoneCache.geo) return stoneCache;
  const prof = [[0, 0.0], [R * 0.62, 0.0], [R * 0.66, 0.012], [R * 0.7, 0.02], [R * 0.7, 0.034], [R * 0.86, 0.04], [R * 0.99, 0.06], [R, 0.085], [R * 0.98, 0.105], [R * 0.92, 0.118], [R * 0.64, 0.126], [0, 0.126]];
  stoneCache.geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48);
  stoneCache.top = new THREE.CylinderGeometry(R * 0.6, R * 0.64, 0.016, 32);
  stoneCache.stem = new THREE.CylinderGeometry(R * 0.2, R * 0.26, 0.05, 20);
  stoneCache.bar = new THREE.CapsuleGeometry(0.02, R * 1.15, 6, 16);
  stoneCache.bar.rotateZ(Math.PI / 2);
  const speck = cvs(256, 256, (g, w, h) => {
    g.fillStyle = '#8a8d92'; g.fillRect(0, 0, w, h);
    const r = rng(21); const cols = ['#3b3d42', '#c9c5bd', '#6a6d73', '#a79a8e', '#232428', '#d9d4cb'];
    for (let i = 0; i < 2600; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; const q = 0.6 + r() * 2.4; g.beginPath(); g.arc(r() * w, r() * h, q, 0, 7); g.fill(); }
  });
  stoneCache.granite = new THREE.MeshPhysicalMaterial({ map: tex(speck, [7, 2]), roughness: 0.34, metalness: 0.02, clearcoat: 0.55, clearcoatRoughness: 0.25, envMapIntensity: 0.9 });
  stoneCache.cap = new THREE.MeshPhysicalMaterial({ color: 0x1b1b1f, roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
  return stoneCache;
}
export function makeStone(team) {
  const P3 = stoneParts();
  const col = [0xd9362d, 0xf3c331][team];
  const g = new THREE.Group();
  const body = new THREE.Mesh(P3.geo, P3.granite); body.castShadow = true; body.receiveShadow = true;
  const top = new THREE.Mesh(P3.top, P3.cap); top.position.y = 0.126 + 0.008;
  const handleMat = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.15, emissive: col, emissiveIntensity: 0, envMapIntensity: 1 });
  const stem = new THREE.Mesh(P3.stem, handleMat); stem.position.y = 0.126 + 0.03;
  const bar = new THREE.Mesh(P3.bar, handleMat); bar.position.y = 0.126 + 0.065; bar.castShadow = true;
  g.add(body, top, stem, bar);
  g.userData.handleMat = handleMat;
  return g;
}
