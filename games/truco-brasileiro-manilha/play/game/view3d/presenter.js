// Truco 3D presenter: a Brazilian botequim card table. READS the game state (game.getState()), never writes it.
// One WebGL canvas sits behind the kit's transparent 2D canvas: a varnished plank table with a steel edge band in a tiled bar
// (checkerboard floor, azulejo wall, bar counter with bottles, bare bulbs, festa-junina bunting), a tulip glass of chopp, a bowl of
// peanuts, a paper napkin with the running tally in pencil strokes, and the cards themselves: the deck with the vira turned up
// beside it, hands dealt one card at a time, opponents' hands fanned face down in front of their seats, played cards flying in
// (an opponent's card turns over in the air), manilhas ringed in gold. The 2D canvas keeps your own hand, every panel, button and
// text. Card sizes and places come from the same 2D layout (layout.js, state.pos): a 2D point is cast onto the table through the
// live camera, so cards are exactly as big and as placed as the flat art would have them and every tap target stays where it was.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat painted table; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3, covers } from '../src/v3.js';
import { meta } from '../src/game.js';
import { titleFor, CW, CH, layoutFor } from '../src/layout.js';
import * as RL from '../src/rules.js';
import { backSprite, cardSprite } from '../src/art.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => clamp(v, 0, 1);
const ease = (f) => f * f * (3 - 2 * f);
const tick = () => new Promise((r) => setTimeout(r, 0));
// World units are centimetres. The table top is y = 0.
const CW3 = 7.4, CH3 = CW3 * CH / CW;   // a card is 7.4 x 10.4 cm in the title scene (play sizes follow the 2D layout)
const RAIL = 3.2, FLOOR = -74;
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];

function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function texOf(c, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function toCanvas(src, w, h) { const c = cv(w, h); c.getContext('2d').drawImage(src, 0, 0, w, h); return c; }

// ---------------------------------------------------------------------------------------------------- procedural textures
// the table top: honey-to-chestnut planks with seams, grain, ring marks of glasses and nicks
function plankTexture() {
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = rng(21), n = 6, pw = S / n;
  for (let i = 0; i < n; i++) {
    const t = 0.35 + r() * 0.3, base = [Math.round(96 + t * 60), Math.round(52 + t * 34), Math.round(24 + t * 16)];
    const g = x.createLinearGradient(0, 0, pw, 0); g.addColorStop(0, `rgb(${base[0] - 12},${base[1] - 8},${base[2] - 4})`); g.addColorStop(0.5, `rgb(${base[0]},${base[1]},${base[2]})`); g.addColorStop(1, `rgb(${base[0] - 16},${base[1] - 10},${base[2] - 5})`);
    x.fillStyle = g; x.fillRect(i * pw, 0, pw + 1, S);
    for (let k = 0; k < 40; k++) {
      const gx = i * pw + r() * pw, a = 0.04 + r() * 0.12, dark = r() < 0.65;
      x.strokeStyle = dark ? `rgba(30,12,4,${a})` : `rgba(200,140,80,${a * 0.7})`; x.lineWidth = 0.6 + r() * 1.8; x.beginPath();
      const ph = r() * TAU, fr = 0.004 + r() * 0.008, amp = 1.5 + r() * 4;
      for (let y = 0; y <= S; y += 16) { const xx = gx + Math.sin(y * fr + ph) * amp; y ? x.lineTo(xx, y) : x.moveTo(xx, y); }
      x.stroke();
    }
    x.fillStyle = 'rgba(20,8,2,0.7)'; x.fillRect(i * pw, 0, 2, S);
  }
  for (let i = 0; i < 5; i++) { x.strokeStyle = `rgba(30,12,4,${0.1 + r() * 0.1})`; x.lineWidth = 2; x.beginPath(); x.arc(60 + r() * 900, 60 + r() * 900, 28 + r() * 6, 0, TAU); x.stroke(); }
  for (let i = 0; i < 1600; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,230,190,0.05)' : 'rgba(0,0,0,0.07)'; x.fillRect(r() * S, r() * S, 1 + r() * 3, 1); }
  return c;
}
// black-and-cream checkerboard floor, one 2 x 2 tile
function floorTexture() {
  const S = 256, c = cv(S), x = c.getContext('2d'), r = rng(3);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#d9cfb8' : '#1d1a18'; x.fillRect(i * S / 2, j * S / 2, S / 2, S / 2); }
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3; x.strokeRect(0, 0, S, S); x.beginPath(); x.moveTo(S / 2, 0); x.lineTo(S / 2, S); x.moveTo(0, S / 2); x.lineTo(S, S / 2); x.stroke();
  for (let i = 0; i < 3000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; x.fillRect(r() * S, r() * S, 2, 2); }
  return c;
}
// azulejo wall: blue-and-white tiles, each a small quatrefoil
function wallTexture() {
  const S = 512, c = cv(S, S), x = c.getContext('2d'), r = rng(8), cell = S / 4;
  x.fillStyle = '#f3ecd8'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
    x.fillStyle = '#fbf6e6'; x.fillRect(i * cell + 3, j * cell + 3, cell - 6, cell - 6);
    x.fillStyle = '#1f4e9c';
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; x.beginPath(); x.ellipse(cx + Math.cos(a) * cell * 0.2, cy + Math.sin(a) * cell * 0.2, cell * 0.2, cell * 0.12, a, 0, TAU); x.fill(); }
    x.fillStyle = '#f3ecd8'; x.beginPath(); x.arc(cx, cy, cell * 0.1, 0, TAU); x.fill(); x.fillStyle = '#2a63bd'; x.beginPath(); x.arc(cx, cy, cell * 0.05, 0, TAU); x.fill();
    x.strokeStyle = '#2a63bd'; x.lineWidth = 3; x.strokeRect(i * cell + 8, j * cell + 8, cell - 16, cell - 16);
    x.fillStyle = 'rgba(0,0,0,0.05)'; if (r() < 0.3) x.fillRect(i * cell, j * cell, cell, cell);
  }
  x.strokeStyle = 'rgba(120,110,90,0.9)'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * cell, 0); x.lineTo(i * cell, S); x.moveTo(0, i * cell); x.lineTo(S, i * cell); x.stroke(); }
  return c;
}
function radialTex(rgb, a = 1) {
  const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.35})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return texOf(c);
}
function cardShadowTex() {
  const c = cv(128, 160), x = c.getContext('2d');
  for (let i = 0; i < 12; i++) { const k = i * 1.6; x.fillStyle = 'rgba(0,0,0,0.085)'; x.beginPath(); x.roundRect(22 + k, 24 + k, 84 - 2 * k, 112 - 2 * k, 10 + k); x.fill(); }
  return texOf(c);
}
function lathe(pts, seg = 40) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); }
function cardGeometry(w, h, r) {
  const s = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); s.lineTo(x0 + w, y0 + h - r);
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h); s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  const g = new THREE.ShapeGeometry(s, 6), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x0) / w, (p.getY(i) - y0) / h);
  g.rotateX(-Math.PI / 2);          // lies on the table face up (+y); the card's top edge points away from you (-z)
  return g;
}

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const noop = { ok: false };
  const iconMode = qs.has('icon');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: iconMode }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return noop; }
  if (!renderer.getContext()) return noop;
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = iconMode ? 0.8 : 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const L = () => layoutFor(meta.width, meta.height);

  await tick();
  // ---------------------------------------------------------------- scene, lights, environment
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0705); scene.fog = new THREE.Fog(0x0b0705, 160, 520);
  const camera = new THREE.PerspectiveCamera(28, 1, 5, 1200);
  const lamp = new THREE.SpotLight(0xffd7a0, 3300, 0, 0.7, 0.9, 1.3);          // the bare bulb over the table
  lamp.position.set(-8, 120, 24); lamp.target.position.set(0, 0, 0);
  lamp.shadow.bias = -0.0004; lamp.shadow.normalBias = 0.02; lamp.shadow.radius = 4; Object.assign(lamp.shadow.camera, { near: 60, far: 240 });
  if (iconMode) { lamp.angle = 0.2; lamp.penumbra = 1; lamp.intensity = 5200; lamp.target.position.set(0.5, 0, 3); }
  const hemi = new THREE.HemisphereLight(0xffe3c2, 0x201208, iconMode ? 0.05 : 0.22);
  const rim = new THREE.DirectionalLight(0xa8c0ff, 0.5); rim.position.set(60, 50, -100);
  const neon = new THREE.PointLight(0xff5a3a, 900, 380, 1.6); neon.position.set(70, 70, -150);    // the bar's red sign, far right
  scene.add(lamp, lamp.target, hemi, rim, neon);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.3; } catch { /* no IBL */ } };
  buildEnv();

  await tick();
  // ---------------------------------------------------------------- the table (rebuilt to the screen's aspect by setTable)
  const woodTex = texOf(plankTexture(), { repeat: [1, 1] });
  const topMat = new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.38, clearcoat: 0.85, clearcoatRoughness: 0.16, color: 0x9c7e66 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), topMat); top.rotation.x = -Math.PI / 2; top.receiveShadow = true; scene.add(top);
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x8e979e, roughness: 0.3, metalness: 1 });
  const darkWood = new THREE.MeshPhysicalMaterial({ map: texOf(plankTexture(), { repeat: [0.5, 0.5] }), color: 0x6a4a36, roughness: 0.55, clearcoat: 0.4 });
  const rails = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), steelMat); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), darkWood); apron.castShadow = true; scene.add(apron);
  const legGeo = lathe([[0.01, FLOOR], [11, FLOOR], [11, FLOOR + 1.2], [3, FLOOR + 4], [2.8, -12], [6, -8], [0.01, -8]], 28);
  const pedestal = new THREE.Mesh(legGeo, steelMat); pedestal.castShadow = true; scene.add(pedestal);
  let tbl = { fx: 0, fz: 0 }, chairs = null;
  function setTable(fx, fz) {
    if (Math.abs(tbl.fx - fx) < 0.01 && Math.abs(tbl.fz - fz) < 0.01) return; tbl = { fx, fz };
    top.scale.set(2 * fx, 2 * fz, 1); woodTex.repeat.set(fx / 22, fz / 22);
    const T = 2.2, o = RAIL, ex = fx + o, ez = fz + o;     // steel edge band, a little proud of the top
    rails[0].scale.set(2 * ex, T, o); rails[0].position.set(0, T / 2 - 0.4, -fz - o / 2);
    rails[1].scale.set(2 * ex, T, o); rails[1].position.set(0, T / 2 - 0.4, fz + o / 2);
    rails[2].scale.set(o, T, 2 * fz); rails[2].position.set(-fx - o / 2, T / 2 - 0.4, 0);
    rails[3].scale.set(o, T, 2 * fz); rails[3].position.set(fx + o / 2, T / 2 - 0.4, 0);
    apron.scale.set(2 * ex - 4, 7, 2 * ez - 4); apron.position.y = -4.3;
    if (chairs) placeChairs(fx, fz);
  }
  function placeChairs(fx, fz) {
    chairs[0].position.set(0, 0, -fz - 34); chairs[0].rotation.y = 0; chairs[1].position.set(-fx - 34, 0, -fz * 0.3); chairs[1].rotation.y = Math.PI / 2; chairs[2].position.set(fx + 34, 0, -fz * 0.3); chairs[2].rotation.y = -Math.PI / 2;
  }
  setTable(40, 44);

  await tick();
  // ---------------------------------------------------------------- the room: checker floor, azulejo wall, bar counter, bottles, bulbs, bunting
  const floorTex = texOf(floorTexture(), { repeat: [60, 60] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, color: 0x3a3430 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.receiveShadow = true; scene.add(floor);
  const wallTex = texOf(wallTexture(), { repeat: [60, 8] });
  const WALL_Z = -210;
  const tileWall = new THREE.Mesh(new THREE.PlaneGeometry(1500, 150), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.4, color: 0xb8b0a0 }));
  tileWall.position.set(0, FLOOR + 75, WALL_Z); scene.add(tileWall);
  const upperWall = new THREE.Mesh(new THREE.PlaneGeometry(1500, 300), new THREE.MeshStandardMaterial({ color: 0x8c6a1c, roughness: 0.9 }));
  upperWall.position.set(0, FLOOR + 300, WALL_Z); scene.add(upperWall);
  const counterMat = new THREE.MeshPhysicalMaterial({ color: 0x5a2c16, roughness: 0.4, clearcoat: 0.6 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(420, 70, 40), counterMat); counter.position.set(20, FLOOR + 35, WALL_Z + 30); counter.receiveShadow = true; scene.add(counter);
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(430, 3, 48), new THREE.MeshStandardMaterial({ color: 0xcdd3d8, roughness: 0.25, metalness: 0.9 })); counterTop.position.set(20, FLOOR + 71.5, WALL_Z + 30); scene.add(counterTop);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(380, 3, 16), darkWood); shelf.position.set(20, FLOOR + 118, WALL_Z + 10); scene.add(shelf);
  const bottleGeo = lathe([[0.01, 0], [4, 0], [4.2, 1], [4.1, 17], [3.2, 22], [1.5, 26], [1.4, 33], [1.7, 34], [0.01, 34]], 14);
  const bottleCols = [0x2a6b2f, 0x7a4a18, 0xd8c690, 0x1d3f7a, 0x8a1d1d, 0x2a6b2f, 0xb8782a];
  for (let i = 0; i < 17; i++) {
    const m = new THREE.Mesh(bottleGeo, new THREE.MeshPhysicalMaterial({ color: bottleCols[i % 7], roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.88 }));
    m.position.set(-150 + i * 22, FLOOR + 119.5, WALL_Z + 10); m.scale.setScalar(0.9 + (i % 3) * 0.08); scene.add(m);
  }
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff3d0, emissive: 0xffc870, emissiveIntensity: 3 });
  const glowTex = radialTex('255,205,130', 0.85), bulbs = [];
  for (const [x, y, z] of [[-8, 105, 16], [-170, 80, -150], [160, 85, -170], [60, 90, -90]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 10), bulbMat); b.position.set(x, y, z); scene.add(b);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 200, 4), new THREE.MeshBasicMaterial({ color: 0x111111 })); cord.position.set(x, y + 100, z); scene.add(cord);
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); g.scale.set(46, 46, 1); g.position.set(x, y, z); scene.add(g); bulbs.push(g);
  }
  // festa-junina bunting strung across the room: green / yellow / blue / white flags
  { const cols = [0x1f9d55, 0xf2c200, 0x1f56b5, 0xf3efe4], sag = (u) => -Math.sin(u * Math.PI) * 14;
    const geo = new THREE.BufferGeometry(), pos = [], col = [], cc = new THREE.Color();
    for (let i = 0; i < 40; i++) { const u0 = i / 40, x0 = -260 + u0 * 520, y0 = FLOOR + 190 + sag(u0), w = 7, c = cols[i % 4]; cc.setHex(c);
      pos.push(x0 - w, y0, WALL_Z + 60, x0 + w, y0, WALL_Z + 60, x0, y0 - 14, WALL_Z + 60); for (let k = 0; k < 3; k++) col.push(cc.r, cc.g, cc.b); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }))); }
  // bentwood-style bar chairs at the three other seats (nobody in them: the players are the 2D name plates)
  const chairWood = new THREE.MeshPhysicalMaterial({ color: 0x7c4a2a, roughness: 0.45, clearcoat: 0.5 });
  chairs = [0, 1, 2].map(() => {
    const g = new THREE.Group(), box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), chairWood); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    box(40, 4, 40, 0, -29, 0);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(3.2, 45, 3.2, a * 17, -52, b * 17);
    box(40, 4, 3, 0, -4, -18); box(3, 26, 3, -17, -17, -18); box(3, 26, 3, 17, -17, -18); box(34, 3, 3, 0, -14, -18);
    scene.add(g); return g;
  });
  placeChairs(tbl.fx, tbl.fz);
  // two more bar tables at the sides, dark beyond the lamp
  for (const [x, z] of [[-130, -120], [150, -140]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 3, 36), darkWood); t.position.set(x, -1.5, z); scene.add(t);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, -FLOOR - 2, 10), steelMat); leg.position.set(x, FLOOR / 2 - 1, z); scene.add(leg);
  }

  await tick();
  // ---------------------------------------------------------------- props: chopp glass with foam, peanut bowl, napkin with the tally
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xf2f6f8, roughness: 0.04, transparent: true, opacity: 0.3, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
  const beerMat = new THREE.MeshPhysicalMaterial({ color: 0xe9a21c, roughness: 0.1, transparent: true, opacity: 0.93, emissive: 0x7a4a00, emissiveIntensity: 0.5 });
  const foamMat = new THREE.MeshStandardMaterial({ color: 0xfff6e2, roughness: 0.9 });
  const beer = new THREE.Group();
  const gPts = [[0.01, 0.2], [3.0, 0.2], [3.2, 0.8], [3.0, 3], [2.8, 12], [3.4, 15], [3.4, 15.2], [3.3, 15.2], [2.7, 12], [2.9, 3], [3.0, 1.2], [0.01, 1.2]];
  const glass = new THREE.Mesh(lathe(gPts, 32), glassMat); glass.renderOrder = 5;
  const liquid = new THREE.Mesh(lathe([[0.01, 1.2], [2.9, 1.25], [2.7, 12], [3.2, 13], [0.01, 13]], 32), beerMat); liquid.renderOrder = 4; liquid.castShadow = true;
  const foam = new THREE.Mesh(lathe([[0.01, 12.8], [3.2, 12.9], [3.3, 14.2], [2.4, 15.6], [0.01, 16]], 28), foamMat); foam.castShadow = true;
  const coaster = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.3, 28), new THREE.MeshStandardMaterial({ color: 0xcf2a22, roughness: 0.8 })); coaster.position.y = 0.15; coaster.receiveShadow = true;
  beer.add(coaster, glass, liquid, foam); scene.add(beer);
  const bubbleTex = radialTex('255,255,255', 0.5), bubbles = [];
  for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex, transparent: true, depthWrite: false, opacity: 0 })); s.renderOrder = 6; s.scale.set(0.9, 0.9, 1); beer.add(s); bubbles.push(s); }
  const bowl = new THREE.Group();
  const bowlMesh = new THREE.Mesh(lathe([[0.01, 0], [3.2, 0], [5.6, 2.4], [6.2, 4], [5.9, 4], [5.2, 2.6], [3, 0.5], [0.01, 0.5]], 28), new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.2, side: THREE.DoubleSide })); bowlMesh.castShadow = true; bowl.add(bowlMesh);
  const nutMat = new THREE.MeshStandardMaterial({ color: 0xb4793a, roughness: 0.8 }), nutR = rng(2);
  for (let i = 0; i < 26; i++) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), nutMat); const a = nutR() * TAU, d = nutR() * 3.8; n.scale.set(1, 0.75, 0.75); n.position.set(Math.cos(a) * d, 1.3 + nutR() * 1.5 + (4 - d) * 0.15, Math.sin(a) * d); n.rotation.y = a; bowl.add(n); }
  scene.add(bowl);
  const napCanvas = cv(256, 256), napTex = texOf(napCanvas), nap = new THREE.Group();
  const napPlain = new THREE.MeshStandardMaterial({ color: 0xf6f0df, roughness: 0.95 });
  const napBody = new THREE.Mesh(new THREE.BoxGeometry(12, 0.25, 12), [napPlain, napPlain, new THREE.MeshStandardMaterial({ map: napTex, roughness: 0.95 }), napPlain, napPlain, napPlain]);
  napBody.position.y = 0.13; napBody.receiveShadow = true; napBody.castShadow = true;
  const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 11, 6), new THREE.MeshStandardMaterial({ color: 0xe6b422, roughness: 0.5 })); pencil.rotation.set(0, 0.6, Math.PI / 2); pencil.position.set(5.5, 0.55, 3.5); pencil.castShadow = true;
  nap.add(napBody, pencil); scene.add(nap);
  let napKey = '';
  function drawNap(sc0, sc1) {
    const key = `${sc0}:${sc1}`; if (key === napKey) return; napKey = key;
    const x = napCanvas.getContext('2d'), W = 256;
    x.fillStyle = '#f6f0df'; x.fillRect(0, 0, W, W);
    x.strokeStyle = 'rgba(30,60,120,0.5)'; x.lineWidth = 2; x.strokeRect(10, 10, W - 20, W - 20);
    x.fillStyle = '#1d2a4a'; x.textAlign = 'center'; x.font = '800 30px system-ui, sans-serif'; x.fillText('NÓS', W / 4, 52); x.fillText('ELES', W * 3 / 4, 52);
    x.strokeStyle = 'rgba(30,30,40,0.8)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(W / 2, 66); x.lineTo(W / 2, W - 20); x.moveTo(20, 64); x.lineTo(W - 20, 64); x.stroke();
    [sc0, sc1].forEach((s, side) => {     // tally: strokes of four, struck through by a fifth
      x.strokeStyle = side ? '#9a1f1f' : '#17306e'; x.lineWidth = 5; x.lineCap = 'round';
      for (let g = 0; g * 5 < s; g++) {
        const n = Math.min(5, s - g * 5), bx = 34 + side * 128 + (g % 2) * 60, by = 86 + Math.floor(g / 2) * 62;
        for (let k = 0; k < Math.min(4, n); k++) { x.beginPath(); x.moveTo(bx + k * 11, by); x.lineTo(bx + k * 11 + 1, by + 44); x.stroke(); }
        if (n === 5) { x.beginPath(); x.moveTo(bx - 7, by + 36); x.lineTo(bx + 46, by + 6); x.stroke(); }
      }
    });
    napTex.needsUpdate = true;
  }
  drawNap(0, 0);

  await tick();
  // ---------------------------------------------------------------- cards
  const cardGeo = cardGeometry(CW3, CH3, 0.5);
  const backGeoDown = cardGeo.clone(); backGeoDown.rotateZ(Math.PI);      // underside of a face-up card
  const mkBack = () => { const c = cv(CW * 3, CH * 3), x = c.getContext('2d'), s = backSprite(); if (s) x.drawImage(s, 0, 0, c.width, c.height); else { x.fillStyle = '#1c4fa0'; x.fillRect(0, 0, c.width, c.height); } return c; };
  const backTex = texOf(mkBack());
  const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.5 });
  const MAXB = 96;
  const backs = new THREE.InstancedMesh(cardGeo, backMat, MAXB); backs.count = 0; backs.frustumCulled = false; backs.receiveShadow = true; backs.castShadow = true; scene.add(backs);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xece2cc, roughness: 0.8 });
  const edges = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), edgeMat, 8); edges.count = 0; edges.frustumCulled = false; edges.castShadow = true; edges.receiveShadow = true; scene.add(edges);
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const shadows = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: cardShadowTex(), transparent: true, depthWrite: false, opacity: 0.8 }), 64);
  shadows.count = 0; shadows.frustumCulled = false; shadows.renderOrder = 1; scene.add(shadows);
  const glows = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('255,255,255', 0.95), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 12);
  glows.count = 0; glows.frustumCulled = false; glows.renderOrder = 3; glows.setColorAt(0, new THREE.Color()); scene.add(glows);
  const faceTex = new Map(), texScale = iconMode ? 5 : 3;
  const faceTexOf = (c, big, four) => {
    const k = c * 4 + (big ? 1 : 0) + (four ? 2 : 0); let t = faceTex.get(k);
    if (!t) { const s = cardSprite(c, big, four); t = texOf(s ? toCanvas(s, CW * texScale, CH * texScale) : cv(8)); faceTex.set(k, t); }
    return t;
  };
  const facePool = [];
  function face(i) {
    if (!facePool[i]) {
      const g = new THREE.Group(), m = new THREE.Mesh(cardGeo, new THREE.MeshStandardMaterial({ roughness: 0.45 })), b = new THREE.Mesh(backGeoDown, backMat);
      m.castShadow = true; b.castShadow = true; m.receiveShadow = true; m.position.y = 0.012; g.add(m, b); g.userData = { m, key: '' }; scene.add(g); facePool[i] = g;
    }
    return facePool[i];
  }
  let nFace = 0, nBack = 0, nEdge = 0, nShadow = 0, nGlow = 0;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  function putFace(card, big, four, x, y, z, yaw, sx, sz, flip = 0, roll = 0) {
    const g = face(nFace++), u = g.userData, k = `${card}|${big}|${four}`;
    if (u.key !== k) { u.key = k; u.m.material.map = faceTexOf(card, big, four); u.m.material.needsUpdate = true; }
    g.visible = true; g.position.set(x, y, z); g.rotation.set(0, 0, 0); g.rotateY(yaw); g.rotateZ(flip); g.rotateX(roll); g.scale.set(sx, 1, sz);
  }
  function putBack(x, y, z, yaw, sx, sz, tiltX = 0) { if (nBack >= MAXB) return; _e.set(tiltX, yaw, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, 1, sz); _m.compose(_p, _q, _s); backs.setMatrixAt(nBack++, _m); }
  function putEdge(x, y, z, yaw, h, sx, sz) { if (nEdge >= 8) return; _e.set(0, yaw, 0, 'XYZ'); _q.setFromEuler(_e); _p.set(x, y + h / 2, z); _s.set(CW3 * sx - 0.25, h, CH3 * sz - 0.25); _m.compose(_p, _q, _s); edges.setMatrixAt(nEdge++, _m); }
  function putShadow(x, z, yaw, sx, sz, k = 1) { if (nShadow >= 64) return; _e.set(0, yaw, 0, 'XYZ'); _q.setFromEuler(_e); _p.set(x + 0.3 * sx, 0.02, z + 0.45 * sz); _s.set(CW3 * 1.5 * k * sx, 1, CH3 * 1.45 * k * sz); _m.compose(_p, _q, _s); shadows.setMatrixAt(nShadow++, _m); }
  function putGlow(x, z, w, h, r, g, b) { if (nGlow >= 12) return; _q.identity(); _p.set(x, 0.05, z); _s.set(w, 1, h); _m.compose(_p, _q, _s); glows.setMatrixAt(nGlow, _m); glows.setColorAt(nGlow++, _c.setRGB(r, g, b)); }

  let sizeKey = '';
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(iconMode ? 1 : Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lamp.castShadow = t.shadow > 0;
    if (t.shadow) { lamp.shadow.mapSize.set(t.shadow, t.shadow); if (lamp.shadow.map) { lamp.shadow.map.dispose(); lamp.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    sizeKey = '';
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen; distance + off-axis shift fitted to a screen rectangle
  const cur = { yaw: 0, tilt: 48, fov: 28, dist: 140, ox: 0, oy: 0, tx: 0, ty: 0, tz: 0 };
  let snapNext = true;
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fitBox(rc, pts, b) {
    const p = { ...b, ox: 0, oy: 0, dist: 150 }, q = { x: 0, y: 0 };
    let bb = null;
    for (let it = 0; it < 7; it++) {
      place(fitCam, p);
      bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break;
      p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    p.bb = bb;
    return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2();
  function onTable(vx, vy, h = 0, out = new THREE.Vector3()) {      // a 2D layout point (virtual units) cast onto the horizontal plane y = h
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera); plane.constant = -h;
    if (!ray.ray.intersectPlane(plane, out)) out.set(0, h, 0);
    return out;
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  // world extents (x, z) of a 2D box w2 x h2 (virtual units) centred on a 2D point, on the table plane
  function extent(vx, vy, w2, h2) {
    const x0 = onTable(vx - w2 / 2, vy, 0, _a).x, x1 = onTable(vx + w2 / 2, vy, 0, _b).x;
    const z0 = onTable(vx, vy - h2 / 2, 0, _a).z, z1 = onTable(vx, vy + h2 / 2, 0, _b).z;
    return [Math.max(0.5, Math.abs(x1 - x0)), Math.max(0.5, Math.abs(z1 - z0))];
  }

  // ---------------------------------------------------------------- framing per screen
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, viewKey = '', camMode = '';
  if (iconMode) kitCanvas.style.visibility = 'hidden';
  const heroPts = [[-10, 0, -4], [10, 0, -4], [-10, 0, 8], [10, 0, 8], [8, 9, -4]];
  // the table is solved to the screen's aspect: its world depth is stretched until its projection fills the 2D table box
  function framing(state) {
    if (iconMode) return { yaw: -6, tilt: 52, fov: 26, dist: 38, ox: 0, oy: 0, tx: 0.2, ty: 0, tz: 2.4 };
    const drift = calm || state.set.calm ? 0 : 1, t = state.t;
    if (state.scene !== 'play' && state.scene !== 'auto' || !state.H) {
      const hd = titleFor(L(), !!state.saved).hd;
      const r = { x: hd.cx - hd.aw * 0.42, y: hd.fanY - 130 * Math.max(0.5, hd.fanS), w: hd.aw * 0.84, h: 260 * Math.max(0.5, hd.fanS) };
      setTable(46, 46);
      return fitBox(rectCss(r), heroPts, { yaw: -9 + 6 * Math.sin(t * TAU / 26) * drift, tilt: 44 + 2.5 * Math.sin(t * TAU / 19) * drift, fov: 28, tx: 0, ty: 0, tz: 0 });
    }
    const T = L().t, rc = rectCss({ x: T.felt.x - 22, y: T.felt.y - 22, w: T.felt.w + 44, h: T.felt.h + 44 });
    const tilt = L().land ? 44 : 36, fov = 26, fx = 40;
    let fz = fx * rc.h / rc.w * 1.2, p = null;
    for (let it = 0; it < 4; it++) {
      p = fitBox({ x: rc.x - rc.w * 0.04, y: rc.y, w: rc.w * 1.08, h: rc.h }, [[-fx, 0, -fz], [fx, 0, -fz], [-fx * 1.12, 0, fz], [fx * 1.12, 0, fz]], { yaw: 0, tilt, fov, tx: 0, ty: 0, tz: 0 });
      const k = (rc.h / (p.bb.y1 - p.bb.y0)) / (rc.w * 1.08 / (p.bb.x1 - p.bb.x0));
      fz *= clamp(k, 0.6, 1.8);
    }
    setTable(fx, fz);
    return p;
  }

  const born = new Map();      // card id -> time first seen on the table (for an opponent's card to leave its seat)
  const rot = (c) => (((c * 7) % 9) - 4) * 0.025;

  function pre() {
    if (!game || lost) return;
    const state = game.getState();
    if (!covers(state.scene) && !iconMode) return;
    const mode = state.scene !== 'play' && state.scene !== 'auto' ? 'title' : `play${state.H ? state.H.n : ''}`;
    const vk = `${cssW()}x${cssH()}|${L().key}`;
    if (vk !== viewKey || mode !== camMode) { viewKey = vk; camMode = mode; snapNext = true; }
    const goal = framing(state);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const a = snapNext ? 1 : 1 - Math.exp(-dt * 6);
    for (const k of ['yaw', 'tilt', 'fov', 'dist', 'ox', 'oy', 'tx', 'ty', 'tz']) cur[k] += (goal[k] - cur[k]) * a;
    snapNext = false;
    place(camera, cur);
  }

  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const state = game.getState();
    if (!covers(state.scene) && !iconMode) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    const t = state.t, title = (state.scene !== 'play' && state.scene !== 'auto') || iconMode || !state.H, H = title ? null : state.H;
    const four = !!state.set.four, big = !!state.set.big, still = calm || state.set.calm;
    nFace = 0; nBack = 0; nEdge = 0; nShadow = 0; nGlow = 0;

    if (title) {
      // the hero: the four manilhas fanned on the plank table, the deck beside them, a chopp and peanuts behind
      const hero = state.variant === 'mineiro' ? [RL.card(0, 3), RL.card(1, 7), RL.card(2, 3), RL.card(3, 0)] : [RL.card(0, 3), RL.card(1, 3), RL.card(2, 3), RL.card(3, 3)];
      if (state.scene !== 'over') hero.forEach((c, i) => {
        const a = (i - 1.5) * 0.3 + (still ? 0 : Math.sin(t * 0.7 + i) * 0.006), L0 = CH3 * 0.55;
        const x = 0.5 + Math.sin(a) * L0, z = 6 - Math.cos(a) * L0, y = 0.03 + i * 0.035;
        const gl = (iconMode ? 0.05 : 0.16) + 0.05 * Math.sin(t * 2 + i); putGlow(x, z, CW3 * 2.2, CH3 * 2.2, 0.9 * gl, 0.7 * gl, 0.25 * gl);
        putFace(c, big, four, x, y, z, -a, 1.12, 1.12); putShadow(x, z, -a, 1.12, 1.12);
      });
      for (let i = 0; i < 12; i++) putBack(-17 + (i % 3) * 0.04, 0.12 + i * 0.03, 6 - (i % 2) * 0.05, 0.32 + ((i * 37) % 7) * 0.004, 1, 1);
      putEdge(-17, 0, 6, 0.32, 0.1, 1, 1); putShadow(-17, 6, 0.32, 1, 1, 1.05);
      beer.visible = !iconMode; bowl.visible = !iconMode; nap.visible = !iconMode;
      beer.position.set(20, 0, -2); bowl.position.set(-21, 0, -5); nap.position.set(-1, 0, -9); nap.rotation.y = 0.3;
      drawNap(...(state.scene === 'over' ? state.match.scores : [0, 0]));
    } else {
      const T = L().t, n = H.n, sc = state.scene, auto = sc === 'auto';
      const sTop = state.autoMatch && auto ? state.autoMatch.scores : state.match.scores;
      drawNap(sTop[0], sTop[1]);
      beer.visible = true; bowl.visible = true; nap.visible = true;
      const farZ = -tbl.fz + 8, nearEdge = tbl.fx - 9;
      beer.position.set(nearEdge, 0, farZ); bowl.position.set(-nearEdge, 0, farZ); nap.position.set(nearEdge - 2, 0, tbl.fz - 12); nap.rotation.y = -0.25;
      // the deck with the vira turned up beside it (only in the Paulista style, where a vira names the manilhas)
      const deckW = onTable(T.deck.x, T.deck.y, 0, new THREE.Vector3()), [dX, dZ] = extent(T.deck.x, T.deck.y, CW * T.tsc * 0.8, CH * T.tsc * 0.8);
      const dsx = dX / CW3, dsz = dZ / CH3, ds = Math.min(dsx, dsz);
      for (let i = 0; i < 8; i++) putBack(deckW.x + (i % 2) * 0.05, 0.12 + i * 0.03, deckW.z, 0.2 + ((i * 29) % 5) * 0.01, dsx, dsz);
      putEdge(deckW.x, 0, deckW.z, 0.2, 0.1, dsx, dsz); putShadow(deckW.x, deckW.z, 0.2, dsx, dsz, 1.05);
      if (H.vira >= 0) {
        const vx = deckW.x + CW3 * ds * 0.82, vz = deckW.z + CH3 * ds * 0.18, f = clamp01((state.dealT - 0.5) / 0.4);
        putFace(H.vira, big, four, vx, 0.04 + Math.sin(f * Math.PI) * 4, vz, Math.PI / 2 - 0.12, dsx, dsz, Math.PI * (1 - ease(f)));
        putShadow(vx, vz, Math.PI / 2 - 0.12, dsx, dsz);
        const gl = 0.35 + 0.15 * Math.sin(t * 2); putGlow(vx, vz, CH3 * ds * 1.9, CW3 * ds * 1.9, 0.9 * gl, 0.72 * gl, 0.25 * gl);
      }
      // the other hands, face down and fanned in front of their seats (open hands in Auto Play stay 2D); dealt one card at a time
      const faceUpSeat = (s) => auto || (n === 4 && s === 2 && (H.consulted[0] || (H.phase === 'special' && H.specialTeam === 0)));
      const SD = T.side, nsc = T.nsc, ssc = SD.sCW / CW;
      for (let p = 1; p <= 3; p++) {
        const s = n === 4 ? p : (p === 2 ? 1 : -1); if (s < 0) continue;
        if (faceUpSeat(s)) continue;
        const want = H.hands[s].length, shown = Math.min(state.shown[s], want), cnt = Math.floor(shown + 0.001);
        const spot = (k) => {            // 2D centre + extents of card k of seat p
          if (p === 2) { const nCW = CW * nsc; return { x: T.cx - (nCW + T.nStep * 2) / 2 + k * T.nStep + nCW / 2, y: T.nTop + CH * nsc / 2, w: nCW, h: CH * nsc, yaw: 0 }; }
          return { x: p === 3 ? SD.cxW : SD.cxE, y: SD.yc0 + k * SD.step, w: CH * ssc, h: CW * ssc, yaw: p === 3 ? -Math.PI / 2 : Math.PI / 2 };
        };
        const put = (k, f) => {
          const q = spot(k), c = onTable(q.x, q.y, 0, new THREE.Vector3()), [ex, ez] = extent(q.x, q.y, q.w, q.h);
          const rotated = q.yaw !== 0, sx = (rotated ? ez : ex) / CW3, sz = (rotated ? ex : ez) / CH3;
          if (f >= 1) { putBack(c.x, 0.03 + k * 0.02, c.z, q.yaw, sx, sz); putShadow(c.x, c.z, q.yaw, sx, sz); return; }
          const e = ease(f), x = deckW.x + (c.x - deckW.x) * e, z = deckW.z + (c.z - deckW.z) * e, y = 0.6 + Math.sin(Math.PI * e) * 2.4;
          putBack(x, y, z, 0.2 + (q.yaw - 0.2) * e + Math.sin(e * Math.PI) * 0.5, sx, sz, Math.sin(e * Math.PI) * 0.1); putShadow(x, z, q.yaw * e, sx, sz, 0.9 + y * 0.02);
        };
        for (let k = 0; k < cnt; k++) put(k, 1);
        if (shown < want && shown > cnt) put(cnt, shown - cnt);
      }
      // the trick: cards at the 2D positions (state.pos); an opponent's card leaves its seat face down and turns over on the way
      const tt = state.show ? state.show.plays : H.plays;
      for (const pl of tt) {
        const p = state.pos[pl.card]; if (!p || (p.born && p.born > t)) continue;
        const cw = CW * p.sc, ch = CH * p.sc, cx = p.x + cw / 2, cy = p.y + ch / 2, mine = pl.seat === 0;
        if (!born.has(pl.card)) born.set(pl.card, t);
        const f = state.show ? 1 : clamp01((t - born.get(pl.card)) / 0.42);
        let vx = cx, vy = cy, flip = 0, yawMix = 1;
        if (!mine && f < 1) {
          const sp = T.seat[RL.posOf(n, pl.seat)], e = ease(f);
          vx = sp.x + (cx - sp.x) * e; vy = sp.y + (cy - sp.y) * e; flip = Math.PI * (1 - ease(clamp01(f * 1.25))); yawMix = e;
        }
        const c = onTable(vx, vy, 0, new THREE.Vector3()), [ex, ez] = extent(vx, vy, cw, ch), k = p.sc / T.tsc;
        const y = 0.04 + clamp((k - 1) * 4, 0, 6) + (mine ? 0 : Math.sin(Math.PI * clamp01(f)) * 2.5);
        const win = state.show && state.show.t > 0.15 && state.show.winner === pl.seat && state.show.t < 1.3;
        const yaw = rot(pl.card) * yawMix, sx = ex / CW3, sz = ez / CH3;
        if (H.pow[pl.card] >= 100 || win) { const g = (win ? 0.95 : 0.5) + 0.2 * Math.sin(t * 5); putGlow(c.x, c.z, ex * 1.45, ez * 1.4, 0.95 * g, 0.72 * g, 0.2 * g); }
        putFace(pl.card, big, four, c.x, y, c.z, yaw, sx, sz, flip, mine ? clamp(k - 1, 0, 1) * 0.35 : 0);
        putShadow(c.x, c.z, yaw, sx, sz, 1 + y * 0.03);
      }
      for (const key of [...born.keys()]) if (!tt.some((pl) => pl.card === key)) born.delete(key);
    }
    for (let i = nFace; i < facePool.length; i++) facePool[i].visible = false;
    backs.count = nBack; backs.instanceMatrix.needsUpdate = true;
    edges.count = nEdge; edges.instanceMatrix.needsUpdate = true;
    shadows.count = nShadow; shadows.instanceMatrix.needsUpdate = true;
    glows.count = nGlow; glows.instanceMatrix.needsUpdate = true; if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
    // bubbles rising in the chopp, a bulb that breathes, the red sign that flickers
    bubbles.forEach((s, i) => { const ph = ((t * 0.5 + i / bubbles.length) % 1); s.position.set(Math.sin(i * 2.4) * 1.5, 2 + ph * 10, Math.cos(i * 1.7) * 1.2); s.material.opacity = still ? 0 : 0.5 * Math.sin(ph * Math.PI); });
    bulbs.forEach((g, i) => { g.material.opacity = still ? 0.9 : 0.85 + Math.sin(t * 3 + i * 1.7) * 0.07; });
    neon.intensity = 900 * (still ? 1 : 0.9 + Math.sin(t * 9.1) * 0.05);

    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    const sk = `${cssW()}x${cssH()}|${tier}`;
    if (sk !== sizeKey) { sizeKey = sk; renderer.setSize(cssW(), cssH(), false); }
    scene.fog.near = cur.dist * 1.6; scene.fog.far = cur.dist * 5;
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); napKey = ''; applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; snapNext = true; });

  let loseExt = null;
  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true,
    renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; snapNext = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    iconPng(size = 2048) {          // offline store icon (scratch tool): one square render of the hero fan
      pre(); post();
      renderer.setPixelRatio(1); renderer.setSize(size, size, false);
      Object.assign(cur, framing(game.getState())); camera.aspect = 1; place(camera, cur); camera.aspect = 1; camera.clearViewOffset(); camera.updateProjectionMatrix();
      renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png');
    },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return loseExt; },
    restoreContext() { loseExt?.restoreContext(); return loseExt; },
  };
}
