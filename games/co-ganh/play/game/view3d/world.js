// Co Ganh 3D world: a lacquered bamboo board with mother-of-pearl line inlay, two-sided turn-over pieces (lacquer / carved jade),
// and a lantern-lit Vietnamese courtyard. Pure builders (no game state): shared by the in-game presenter and the offline icon render.
// Units: one cell = 1. The 5x5 points sit at x = col - 2, z = row - 2 (row 0 is the far edge). Y is up.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

export const N = 5, FRAME = 0.55, OUTER = N + 2 * FRAME, HALF = OUTER / 2;
export const BASE_Y = 0.0;                     // underside of the board (it stands on a bamboo mat whose top is y = 0)
export const PANEL_TOP = BASE_Y + 0.30;        // the playing surface
export const R_PIECE = 0.36, HT = 0.116;       // piece radius and half thickness
export const REST_Y = PANEL_TOP + 0.011 + HT;  // centre height of a piece lying on the board
export const cellX = (i) => (i % N) - 2;
export const cellZ = (i) => ((i / N) | 0) - 2;
const TAU = Math.PI * 2;
const hasDom = typeof document !== 'undefined';
const rng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const cvs = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function canvasTex(c, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso; t.needsUpdate = true; return t;
}

// ---------------------------------------------------------------- the three board looks (keys match art.js BOARD_KEYS)
export const LOOKS = {
  paper: { name: 'Lacquer and pearl', panel: ['#5a3320', '#7d4a2b'], panelDeep: '#2b160b', seed: 7, frame: ['#c89a45', '#e3bd6a'], plinth: '#3b1a10', line: 'pearl', lineCol: '#e6dccb', glow: '#ffd9a0' },
  chalk: { name: 'Pavement chalk', panel: ['#5d636b', '#767d86'], panelDeep: '#2a2e33', seed: 19, frame: ['#8d8a82', '#aaa69b'], plinth: '#2e3034', line: 'chalk', lineCol: '#f7f5ec', glow: '#dfe9ff' },
  lotus: { name: 'Lotus pink', panel: ['#e7aab8', '#f4c9d1'], panelDeep: '#8d5568', seed: 31, frame: ['#a84c6a', '#cf7592'], plinth: '#4f1d33', line: 'ebony', lineCol: '#3a1426', glow: '#ffd2e0' },
};
export const LOOK_KEYS = Object.keys(LOOKS);

// the board figure in (row, col) points: square, cross, two long diagonals, diamond
const FIG = (() => {
  const s = [], m = N - 1, h = m / 2;
  for (let i = 0; i <= m; i++) { s.push([i, 0, i, m]); s.push([0, i, m, i]); }
  s.push([0, 0, m, m], [0, m, m, 0], [0, h, h, 0], [h, 0, m, h], [m, h, h, m], [h, m, 0, h]);
  return s;
})();

function panelCanvases(look, size = 1024) {
  const wc = B.woodCanvas(size, look.panel[0], look.panel[1], look.seed, { lines: look.line === 'chalk' ? 30 : 110, knots: 1 });
  const x = wc.map.getContext('2d'), u = size / (N + 0.1), cx = size / 2;
  if (look.line === 'chalk') {                       // slab: speckle and scratches
    const r = rng(look.seed * 13);
    for (let k = 0; k < 2400; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'; x.fillRect(r() * size, r() * size, 1 + r() * 3, 1 + r() * 3); }
  } else {                                           // lacquer depth: a soft darker pool at the edges
    const g = x.createRadialGradient(cx, cx, size * 0.2, cx, cx, size * 0.75); g.addColorStop(0, 'rgba(255,220,170,0.10)'); g.addColorStop(1, look.line === 'ebony' ? 'rgba(120,40,70,0.22)' : 'rgba(10,2,0,0.45)');
    x.fillStyle = g; x.fillRect(0, 0, size, size);
  }
  // carved grooves under the inlay (a dark shadowed channel), so the line sits IN the wood
  const P = (r, c) => [cx + (c - 2) * u, cx - (r - 2) * u];
  x.lineCap = 'round';
  for (const [r0, c0, r1, c1] of FIG) {
    const a = P(r0, c0), b = P(r1, c1);
    x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = u * 0.1; x.beginPath(); x.moveTo(a[0], a[1] + 1.5); x.lineTo(b[0], b[1] + 1.5); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = u * 0.075; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
  }
  wc.bump.getContext('2d').lineCap = 'round';
  const bx = wc.bump.getContext('2d'); bx.strokeStyle = 'rgba(0,0,0,0.8)'; bx.lineWidth = u * 0.09;
  for (const [r0, c0, r1, c1] of FIG) { const a = P(r0, c0), b = P(r1, c1); bx.beginPath(); bx.moveTo(a[0], a[1]); bx.lineTo(b[0], b[1]); bx.stroke(); }
  return wc;
}

function bambooCanvas(c0, c1, seed, size = 512) {   // strips of bamboo running along the long side, with nodes
  const c = cvs(size, size / 2), x = c.getContext('2d'), r = rng(seed), W = size, H = size / 2, strips = 8, sh = H / strips;
  for (let i = 0; i < strips; i++) {
    const g = x.createLinearGradient(0, i * sh, 0, (i + 1) * sh); g.addColorStop(0, c1); g.addColorStop(0.5, c0); g.addColorStop(1, c1);
    x.fillStyle = g; x.fillRect(0, i * sh, W, sh);
    x.fillStyle = 'rgba(40,20,0,0.5)'; x.fillRect(0, (i + 1) * sh - 2, W, 2);
    for (let k = 0; k < 7; k++) { const y = i * sh + 2 + r() * (sh - 5); x.strokeStyle = `rgba(70,40,10,${0.08 + r() * 0.12})`; x.lineWidth = 0.6 + r(); x.beginPath(); x.moveTo(r() * W * 0.3, y); x.lineTo(W * (0.5 + r() * 0.5), y + (r() - 0.5) * 2); x.stroke(); }
  }
  for (let n = 1; n < 3; n++) { x.fillStyle = 'rgba(60,30,5,0.55)'; x.fillRect((W / 3) * n - 3, 0, 6, H); x.fillStyle = 'rgba(255,230,160,0.25)'; x.fillRect((W / 3) * n + 3, 0, 2, H); }
  return c;
}

/** The board group. Origin = centre of the board's underside plane at y 0; surface at PANEL_TOP. */
export function buildBoard(kind) {
  const look = LOOKS[kind] || LOOKS.paper, g = new THREE.Group(), shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  // lacquered tray under everything
  const plinth = shadow(new THREE.Mesh(B.slab(OUTER + 0.16, OUTER + 0.16, 0.26, 0.22, 0.09), B.material('lacquer', { color: look.plinth, roughness: 0.28 })));
  plinth.position.y = BASE_Y; g.add(plinth);
  // the playing panel
  const wc = panelCanvases(look);
  const panelMat = new THREE.MeshPhysicalMaterial({ map: canvasTex(wc.map), bumpMap: canvasTex(wc.bump, { srgb: false }), bumpScale: 0.5, roughness: look.line === 'chalk' ? 0.8 : 0.3, metalness: 0, clearcoat: look.line === 'chalk' ? 0 : 1, clearcoatRoughness: 0.1 });
  panelMat.envMapIntensity = 0.9;
  const panel = shadow(new THREE.Mesh(B.slab(N + 0.1, N + 0.1, 0.30 - 0.16, 0.05, 0.02), panelMat));
  panel.position.y = BASE_Y + 0.16; g.add(panel);
  // bamboo frame: four bars with bamboo strips + node bands, brass corner caps with a red cord lashing
  const fb = new THREE.MeshStandardMaterial({ map: canvasTex(bambooCanvas(look.frame[0], look.frame[1], look.seed + 3), { repeat: [1, 1] }), color: 0xe2d2b4, roughness: 0.42, metalness: 0.05 });
  fb.envMapIntensity = 0.8;
  const band = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.frame[0]).multiplyScalar(0.45), roughness: 0.5 });
  const FH = 0.26, FY = BASE_Y + 0.14;
  const bar = (w, d, x, z, along) => {
    const m = shadow(new THREE.Mesh(B.slab(w, d, FH, 0.12, 0.085), fb)); m.position.set(x, FY, z); g.add(m);
    const L = along === 'x' ? w : d;
    for (let k = -1; k <= 1; k += 1) {                               // node bands
      const bw = 0.05, geo = along === 'x' ? new THREE.BoxGeometry(bw, 0.05, d * 0.94) : new THREE.BoxGeometry(w * 0.94, 0.05, bw);
      const b2 = new THREE.Mesh(geo, band); const o = k * L * 0.28;
      b2.position.set(x + (along === 'x' ? o : 0), FY + FH - 0.025, z + (along === 'x' ? 0 : o)); b2.receiveShadow = true; g.add(b2);
    }
  };
  const fo = N / 2 + 0.05 + FRAME / 2 - 0.05;
  bar(OUTER, FRAME, 0, -fo, 'x'); bar(OUTER, FRAME, 0, fo, 'x'); bar(FRAME, N + 0.1, -fo, 0, 'z'); bar(FRAME, N + 0.1, fo, 0, 'z');
  // brass inner lip
  const brass = B.material('brass');
  const lipH = 0.03, lipY = PANEL_TOP - 0.012, lo = N / 2 + 0.05;
  for (const [w, d, x, z] of [[N + 0.1, 0.035, 0, -lo], [N + 0.1, 0.035, 0, lo], [0.035, N + 0.1, -lo, 0], [0.035, N + 0.1, lo, 0]]) {
    const m = shadow(new THREE.Mesh(B.roundedBox(w, lipH, d, 0.012), brass)); m.position.set(x, lipY + lipH / 2 + 0.02, z); g.add(m);
  }
  // corner studs and cord knots
  const cord = B.material('lacquer', { color: '#c8211a' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = sx * (OUTER / 2 - 0.27), pz = sz * (OUTER / 2 - 0.27), y = FY + FH;
    const stud = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), brass)); stud.scale.y = 0.55; stud.position.set(px, y + 0.005, pz); g.add(stud);
    const knot = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.034, 10, 28), cord)); knot.rotation.x = Math.PI / 2; knot.position.set(px, y - 0.02, pz); g.add(knot);
  }
  // the line figure: mother-of-pearl (or chalk / ebony) strips lying in the grooves, and a bead on every point
  const lineMat = look.line === 'chalk'
    ? new THREE.MeshStandardMaterial({ color: look.lineCol, roughness: 0.95, metalness: 0 })
    : look.line === 'ebony' ? new THREE.MeshPhysicalMaterial({ color: look.lineCol, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 })
      : new THREE.MeshPhysicalMaterial({ color: look.lineCol, roughness: 0.2, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05, emissive: '#6a5a78', emissiveIntensity: 0.22, iridescence: 1, iridescenceIOR: 1.6, sheen: 0.6, sheenColor: new THREE.Color('#bfeaff') });
  const lw = look.line === 'chalk' ? 0.07 : 0.052, parts = [], ly = PANEL_TOP + 0.003;
  for (const [r0, c0, r1, c1] of FIG) {
    const x0 = c0 - 2, z0 = r0 - 2, x1 = c1 - 2, z1 = r1 - 2, len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    const m = new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, ly, (z0 + z1) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang), new THREE.Vector3(1, 1, 1));
    parts.push({ geo: B.roundedBox(len + lw, 0.016, lw, 0.007), m });
  }
  const lines = shadow(new THREE.Mesh(B.mergeGeos(parts), lineMat)); lines.castShadow = false; g.add(lines);
  const beads = [];
  for (let i = 0; i < N * N; i++) {
    const big = (((i / N) | 0) + (i % N)) % 2 === 0, rr = big ? 0.085 : 0.065;
    const geo = new THREE.SphereGeometry(rr, 16, 10); geo.scale(1, 0.4, 1);
    beads.push({ geo, m: new THREE.Matrix4().makeTranslation(cellX(i), ly + 0.004, cellZ(i)) });
  }
  const bd = shadow(new THREE.Mesh(B.mergeGeos(beads), lineMat)); bd.castShadow = false; g.add(bd);
  const heart = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 8, 48), lineMat); heart.rotation.x = Math.PI / 2; heart.position.set(0, ly + 0.01, 0); g.add(heart);
  g.userData = { look, panelMat };
  return g;
}

// ---------------------------------------------------------------- pieces
export const STYLE3D = {
  lacquer: {
    1: { body: { color: '#a6150b', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 }, motif: 'blossom', inlay: '#f1c660', rim: '#ffd67a', core: '#2a0d08' },
    2: { body: { color: '#9fcfb2', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05 }, motif: 'seed', inlay: '#17604f', rim: '#e8d28a', core: '#0f2a22' },
  },
  ink: {
    1: { body: { color: '#15171e', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }, motif: 'blossom', inlay: '#e8c26a', rim: '#e8c26a', core: '#07080b' },
    2: { body: { color: '#e9e2d2', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }, motif: 'seed', inlay: '#2b3f66', rim: '#cdb27a', core: '#3a3326' },
  },
};
const HALF_PROFILE = (() => {
  const R = R_PIECE;
  return [[0, 0.066], [R * 0.985, 0.066], [R * 0.975, 0.086], [R * 0.94, 0.106], [R * 0.9, HT], [R * 0.8, HT], [R * 0.76, 0.104], [R * 0.72, 0.1], [R * 0.3, 0.1], [R * 0.15, 0.108], [0, 0.11]];
})();
let _halfGeo = null, _coreGeo = null; const _motif = {};
function halfGeo() { return _halfGeo || (_halfGeo = B.lathe(HALF_PROFILE, 44)); }
function makeHalf(pal) {
  const g = new THREE.Group(), bodyMat = new THREE.MeshPhysicalMaterial(pal.body);
  bodyMat.envMapIntensity = 1.1;
  const body = new THREE.Mesh(halfGeo(), bodyMat); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const inlayMat = new THREE.MeshStandardMaterial({ color: pal.inlay, roughness: 0.28, metalness: pal.motif === 'blossom' ? 0.85 : 0.2 });
  const y = 0.1;
  if (pal.motif === 'blossom') {
    _motif.petal = _motif.petal || new THREE.SphereGeometry(1, 16, 10);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4, m = new THREE.Mesh(_motif.petal, inlayMat);
      m.scale.set(0.088, 0.02, 0.052); m.position.set(Math.cos(a) * 0.1, y + 0.004, Math.sin(a) * 0.1); m.rotation.y = -a; g.add(m);
    }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 8), inlayMat); c.scale.y = 0.55; c.position.y = y + 0.006; g.add(c);
  } else {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.02, 8, 44), inlayMat); t.rotation.x = Math.PI / 2; t.position.y = y + 0.003; g.add(t);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 8), inlayMat); c.scale.y = 0.55; c.position.y = y + 0.006; g.add(c);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R_PIECE * 0.84, 0.0085, 6, 56), new THREE.MeshStandardMaterial({ color: pal.rim, metalness: 0.9, roughness: 0.3 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = HT - 0.006; g.add(ring);
  return g;
}
/** A two-sided piece: Red up at rotation.x = 0, Jade up at rotation.x = PI. Origin = its centre. */
export function makePiece(style = 'lacquer') {
  const st = STYLE3D[style] || STYLE3D.lacquer, g = new THREE.Group();
  const top = makeHalf(st[1]), bot = makeHalf(st[2]); bot.scale.y = -1;
  // a dark lacquered core band between the two faces, with a gold seam: the edge of a real two-sided disc
  const R = R_PIECE;
  _coreGeo = _coreGeo || B.lathe([[0, -0.066], [R * 0.985, -0.066], [R, -0.058], [R, 0.058], [R * 0.985, 0.066], [0, 0.066]], 44);
  const core = new THREE.Mesh(_coreGeo, new THREE.MeshPhysicalMaterial({ color: st[1].core, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1 }));
  core.castShadow = true; core.receiveShadow = true;
  const eq = new THREE.Mesh(new THREE.TorusGeometry(R * 1.0, 0.011, 8, 56), new THREE.MeshStandardMaterial({ color: '#d9b04a', metalness: 0.9, roughness: 0.28 }));
  eq.rotation.x = Math.PI / 2; eq.castShadow = true;
  g.add(core, top, bot, eq);
  return g;
}

// ---------------------------------------------------------------- courtyard environment
function tilesCanvas() {
  const c = cvs(512), x = c.getContext('2d'), r = rng(5); x.fillStyle = '#17100c'; x.fillRect(0, 0, 512, 512);
  const bw = 128, bh = 64;
  for (let row = 0; row < 8; row++) for (let col = -1; col < 5; col++) {
    const ox = (row % 2) * bw / 2, px = col * bw + ox + 2, py = row * bh + 2, v = 0.7 + r() * 0.5;
    x.fillStyle = `rgb(${Math.round(92 * v)},${Math.round(52 * v)},${Math.round(34 * v)})`; x.fillRect(px, py, bw - 4, bh - 4);
    x.fillStyle = 'rgba(255,190,130,0.07)'; x.fillRect(px, py, bw - 4, 4);
    for (let k = 0; k < 14; k++) { x.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.08})`; x.fillRect(px + r() * bw, py + r() * bh, 3 + r() * 8, 2 + r() * 4); }
  }
  return c;
}
function matCanvas() {                                  // woven bamboo mat
  const c = cvs(512), x = c.getContext('2d'), r = rng(9), s = 32;
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const horiz = (i + j) % 2 === 0, v = 0.82 + r() * 0.3;
    x.fillStyle = `rgb(${Math.round(170 * v)},${Math.round(134 * v)},${Math.round(74 * v)})`; x.fillRect(j * s, i * s, s, s);
    x.strokeStyle = 'rgba(40,24,6,0.55)'; x.lineWidth = 1.6;
    for (let k = 1; k < 4; k++) { x.beginPath(); if (horiz) { x.moveTo(j * s, i * s + k * s / 4); x.lineTo(j * s + s, i * s + k * s / 4); } else { x.moveTo(j * s + k * s / 4, i * s); x.lineTo(j * s + k * s / 4, i * s + s); } x.stroke(); }
    x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 2.4; x.strokeRect(j * s + 1, i * s + 1, s - 2, s - 2);
  }
  return c;
}
function plasterCanvas() {
  const c = cvs(512, 512), x = c.getContext('2d'), r = rng(21);
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#d9c397'); g.addColorStop(1, '#8f7a52'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 160; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '70,50,20' : '255,240,200'},${0.03 + r() * 0.06})`; x.beginPath(); x.ellipse(r() * 512, r() * 512, 10 + r() * 60, 6 + r() * 30, r() * 3, 0, TAU); x.fill(); }
  const damp = x.createLinearGradient(0, 380, 0, 512); damp.addColorStop(0, 'rgba(30,50,40,0)'); damp.addColorStop(1, 'rgba(30,50,40,0.5)'); x.fillStyle = damp; x.fillRect(0, 380, 512, 132);
  return c;
}
function glowCanvas(rgb, a = 1) {
  const c = cvs(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.35, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c;
}
const FLOOR_Y = -0.34;
export function buildEnvironment() {
  const g = new THREE.Group(), lanterns = [], sway = [];
  // courtyard floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: canvasTex(tilesCanvas(), { repeat: [24, 24] }), color: 0x8a7a70, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true; g.add(floor);
  // low carved wooden platform and the bamboo mat the board stands on
  const plat = new THREE.Mesh(B.slab(10.4, 10.4, 0.3, 0.28, 0.1), B.material('darkWood', { color: '#3a2112', color2: '#5a3820' }));
  plat.position.y = FLOOR_Y; plat.castShadow = plat.receiveShadow = true; g.add(plat);
  const mat = new THREE.Mesh(B.slab(9.0, 9.0, 0.04, 0.12, 0.02), new THREE.MeshStandardMaterial({ map: canvasTex(matCanvas(), { repeat: [2.6, 2.6] }), color: 0x6f5f4a, roughness: 0.9 }));
  mat.position.y = FLOOR_Y + 0.3 - 0.002; mat.receiveShadow = true; g.add(mat);
  g.userData.matTop = FLOOR_Y + 0.3 + 0.04;
  // house: plaster wall, glowing doorway, wooden columns and an eave beam
  const wallZ = -6.2;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(46, 16), new THREE.MeshStandardMaterial({ map: canvasTex(plasterCanvas(), { repeat: [4, 1] }), roughness: 0.95 }));
  wall.position.set(0, FLOOR_Y + 8, wallZ); wall.receiveShadow = true; g.add(wall);
  const doorC = cvs(256, 340), dx = doorC.getContext('2d'), dg = dx.createLinearGradient(0, 0, 0, 340);
  dg.addColorStop(0, '#5a2a0c'); dg.addColorStop(0.45, '#e8892e'); dg.addColorStop(1, '#ffc46a'); dx.fillStyle = dg; dx.fillRect(0, 0, 256, 340);
  const dr = dx.createRadialGradient(128, 260, 10, 128, 260, 220); dr.addColorStop(0, 'rgba(255,240,200,0.55)'); dr.addColorStop(1, 'rgba(255,240,200,0)'); dx.fillStyle = dr; dx.fillRect(0, 0, 256, 340);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.2), new THREE.MeshBasicMaterial({ map: canvasTex(doorC), fog: false }));
  door.position.set(0, FLOOR_Y + 2.1, wallZ + 0.03); g.add(door);
  const wood = B.material('darkWood', { color: '#4a2514', color2: '#6a3a20' });
  const col = (x, h = 9) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, h, 18), wood); m.position.set(x, FLOOR_Y + h / 2, wallZ + 0.5); m.castShadow = true; m.receiveShadow = true; g.add(m); };
  for (const x of [-7.5, -3.2, 3.2, 7.5]) col(x);
  for (const [w, h, x, y] of [[3.6, 0.2, 0, 4.35], [3.6, 0.16, 0, 0.02]]) { const m = new THREE.Mesh(B.roundedBox(w, h, 0.34, 0.05), wood); m.position.set(x, FLOOR_Y + y, wallZ + 0.1); g.add(m); }
  for (const x of [-1.75, 1.75]) { const m = new THREE.Mesh(B.roundedBox(0.22, 4.5, 0.34, 0.05), wood); m.position.set(x, FLOOR_Y + 2.2, wallZ + 0.1); g.add(m); }
  const beam = new THREE.Mesh(B.roundedBox(30, 0.4, 0.7, 0.08), wood); beam.position.set(0, FLOOR_Y + 5.4, wallZ + 0.62); beam.castShadow = true; g.add(beam);
  // red paper lanterns hanging from the eave (lit from inside, with a glow)
  const lanternGeo = B.lathe([[0.0, -0.52], [0.12, -0.52], [0.26, -0.46], [0.4, -0.28], [0.46, 0], [0.4, 0.28], [0.26, 0.46], [0.12, 0.52], [0, 0.52]], 28);
  const capMat = new THREE.MeshStandardMaterial({ color: '#d4a038', metalness: 0.85, roughness: 0.35 });
  const glowTex = canvasTex(glowCanvas('255,120,50', 0.9));
  const mkLantern = (x, y, z, s, phase) => {
    const grp = new THREE.Group(); grp.position.set(x, y, z);
    const body = new THREE.Mesh(lanternGeo, new THREE.MeshStandardMaterial({ color: '#d92a16', emissive: '#ff4a14', emissiveIntensity: 1.5, roughness: 0.55 })); body.scale.setScalar(s); body.position.y = -0.55 * s;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.17 * s, 0.1 * s, 14), capMat); top.position.y = -0.0;
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.08 * s, 14), capMat); bot.position.y = -1.1 * s;
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.2, 5), capMat); str.position.y = 0.6;
    const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.07 * s, 0.4 * s, 8), new THREE.MeshStandardMaterial({ color: '#e8b830', roughness: 0.6 })); tas.position.y = -1.34 * s;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.2 * s, 3.2 * s), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glow.position.set(0, -0.55 * s, 0.1); glow.renderOrder = 5;
    grp.add(body, top, bot, str, tas, glow);
    const pl = new THREE.PointLight(0xff8a45, 9, 16, 1.8); pl.position.set(0, -0.55 * s, 0.6); grp.add(pl);
    g.add(grp); lanterns.push({ grp, pl, phase, base: 9 }); return grp;
  };
  mkLantern(-4.2, FLOOR_Y + 4.3, wallZ + 1.1, 1.0, 0.3); mkLantern(4.4, FLOOR_Y + 4.2, wallZ + 1.1, 0.95, 2.1); mkLantern(0, FLOOR_Y + 4.7, wallZ + 1.2, 0.72, 4.2);
  mkLantern(-8.6, FLOOR_Y + 4.5, wallZ + 1.0, 0.8, 1.1); mkLantern(8.8, FLOOR_Y + 4.4, wallZ + 1.0, 0.8, 5.3);
  // bamboo clumps at both sides (stems with nodes, swaying leaf fans)
  const stemMat = new THREE.MeshStandardMaterial({ color: '#7fa043', roughness: 0.5 }), nodeMat = new THREE.MeshStandardMaterial({ color: '#4e6a22', roughness: 0.6 });
  const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(0.09, 0.35, 0, 1.0); leafShape.quadraticCurveTo(-0.09, 0.35, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 4);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#4f8a2c', roughness: 0.7, side: THREE.DoubleSide });
  const clump = (cx, cz, seed, dir) => {
    const r = rng(seed), cg = new THREE.Group(); cg.position.set(cx, FLOOR_Y, cz);
    for (let k = 0; k < 6; k++) {
      const h = 5.4 + r() * 3, ox = (r() - 0.5) * 1.4, oz = (r() - 0.5) * 0.9, lean = (r() - 0.5) * 0.12 + dir * 0.05;
      const st = new THREE.Group(); st.position.set(ox, 0, oz); st.rotation.z = lean;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.085, h, 8), stemMat); stem.position.y = h / 2; stem.castShadow = true; st.add(stem);
      for (let n = 1; n < 7; n++) { const nd = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.045, 8), nodeMat); nd.position.y = (h / 7) * n; st.add(nd); }
      const top = new THREE.Group(); top.position.y = h * (0.45 + r() * 0.4);
      for (let f = 0; f < 7; f++) { const lf = new THREE.Mesh(leafGeo, leafMat); lf.scale.set(1 + r() * 0.5, 1.1 + r() * 0.9, 1); lf.rotation.set(-0.4 - r() * 0.7, f * (TAU / 7) + r(), 0.2); lf.position.y = r() * 0.3; top.add(lf); }
      st.add(top); cg.add(st); sway.push({ obj: st, phase: r() * TAU, amp: 0.012 + r() * 0.01, base: lean });
    }
    g.add(cg);
  };
  clump(-6.2, -4.2, 11, -1); clump(6.4, -4.4, 29, 1); clump(-5.2, 3.8, 41, -1); clump(5.8, 4.4, 53, 1);
  // fireflies
  const FN = 34, fpos = new Float32Array(FN * 3), fph = [];
  const rr = rng(77);
  for (let i = 0; i < FN; i++) { fpos[i * 3] = (rr() - 0.5) * 16; fpos[i * 3 + 1] = 0.6 + rr() * 3.4; fpos[i * 3 + 2] = -5 + rr() * 9; fph.push([rr() * TAU, rr() * TAU, 0.2 + rr() * 0.4]); }
  const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const flies = new THREE.Points(fgeo, new THREE.PointsMaterial({ map: canvasTex(glowCanvas('210,255,140', 1)), color: 0xffffff, size: 0.34, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  flies.frustumCulled = false; g.add(flies);
  const base = fpos.slice();
  return {
    group: g, floorY: FLOOR_Y, matTop: g.userData.matTop, lanterns,
    update(t, calm) {
      const k = calm ? 0.35 : 1;
      for (const l of lanterns) {
        l.grp.rotation.z = Math.sin(t * 0.7 + l.phase) * 0.045 * k; l.grp.rotation.x = Math.sin(t * 0.5 + l.phase * 1.7) * 0.025 * k;
        l.pl.intensity = l.base * (0.9 + 0.1 * Math.sin(t * 6.3 + l.phase * 3) * Math.sin(t * 2.1 + l.phase) + 0.05 * Math.sin(t * 13 + l.phase));
      }
      for (const s of sway) s.obj.rotation.z = s.base + Math.sin(t * 0.8 + s.phase) * s.amp * k;
      const p = fgeo.attributes.position.array;
      for (let i = 0; i < FN; i++) {
        const [a, b, sp] = fph[i];
        p[i * 3] = base[i * 3] + Math.sin(t * sp + a) * 0.7 * k; p[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * sp * 1.3 + b) * 0.35 * k; p[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * sp * 0.8 + a) * 0.5 * k;
      }
      fgeo.attributes.position.needsUpdate = true;
      flies.material.opacity = 0.7 + 0.3 * Math.sin(t * 1.7);
    },
  };
}
