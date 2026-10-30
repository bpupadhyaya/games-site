// Kite Duel 3D presenter. READS what the 2D layer asked for this frame (src/v3.js: sky, world, kites, visible world rectangle); never writes
// game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a lit hill village under a real 3D sky (soft lit cloud
// banks, layered mountains, a sun with haze), a stone terrace with two kite flyers built from lathed and rounded solids, and the
// kites themselves: billowed paper panels on bamboo spars, flexing tails, flat string ribbons.
// The camera looks straight down the depth axis from far away and its field of view is set so the z = 0 plane (kites, strings,
// flyers, the aim target) maps to the screen exactly as the flat art did: world (x, y) -> screen, so steering, the target ring, the
// crossing flare and every tap line up with the 3D scene unchanged. Depth layers sit behind that plane (clouds, mountains), each
// scaled so it matches the flat composition; a slow camera sway gives them real parallax.
// No WebGL, ?flat=1 or a lost context: v3.on = false and the flat 2D art stays; a restored context rebuilds the scene.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { SKY_PAL } from '../src/art.js';
import { ANCHOR, W, stringPoints, clamp } from '../src/sim.js';

const TIERS = [{ name: 'high', dpr: 2, clouds: 14, seg: 14 }, { name: 'medium', dpr: 1.5, clouds: 11, seg: 10 }, { name: 'low', dpr: 1, clouds: 8, seg: 8 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const D = 2200;                 // camera distance from the z = 0 plane
const FEET = 1190;              // world y of the terrace top (the flyers' feet)
const TAU = Math.PI * 2;
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

function canvasTex(w, h, paint, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

// ---- dynamic ribbons (strings, tails, wind streaks): a quad strip that always faces the camera ---------------------------------------
function makeRibbon(n, material) {
  const pos = new Float32Array((n + 1) * 2 * 3), idx = [];
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, material); m.frustumCulled = false; return m;
}
// pts: array of [x, y, z] (3D, y up); wfn(i / n) -> width
function setRibbon(m, pts, wfn) {
  const a = m.geometry.attributes.position.array, n = pts.length - 1;
  for (let i = 0; i <= n; i++) {
    const p = pts[i], q = pts[Math.min(n, i + 1)], r = pts[Math.max(0, i - 1)];
    let tx = q[0] - r[0], ty = q[1] - r[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const w = wfn(i / n) / 2, k = i * 6;
    a[k] = p[0] - ty * w; a[k + 1] = p[1] + tx * w; a[k + 2] = p[2]; a[k + 3] = p[0] + ty * w; a[k + 4] = p[1] - tx * w; a[k + 5] = p[2];
  }
  m.geometry.attributes.position.needsUpdate = true;
}

// ---- the kites ----------------------------------------------------------------------------------------------------------------------
const PATANG = { top: [0, 62], right: [46, 6], bottom: [0, -66], left: [-46, 6], mid: [0, 6] };
const HEX = [[-30, 66], [30, 66], [50, 0], [30, -66], [-30, -66], [-50, 0]];   // y up (flipped from the flat art)
const billow = (x, y, rx, ry, B) => B * Math.max(0, 1 - (x / rx) ** 2 - (y / ry) ** 2) ** 0.8;
// one triangular sector of paper (apex, p, q) subdivided n times, vertex-coloured, bulging toward the camera
function sectorMesh(apex, p, q, n, colorAt, zAt, pos, cols) {
  const idx = (a, b) => a * (n + 1) + b, base = pos.length / 3, c = new THREE.Color();
  for (let a = 0; a <= n; a++) for (let b = 0; b <= n; b++) {
    const aa = Math.min(a, n - b);
    const x = apex[0] + (p[0] - apex[0]) * aa / n + (q[0] - apex[0]) * b / n, y = apex[1] + (p[1] - apex[1]) * aa / n + (q[1] - apex[1]) * b / n;
    pos.push(x, y, zAt(x, y)); c.set(colorAt(x, y)); cols.push(c.r, c.g, c.b);
  }
  const ind = [];
  for (let a = 0; a < n; a++) for (let b = 0; b < n - a; b++) {
    ind.push(base + idx(a, b), base + idx(a + 1, b), base + idx(a, b + 1));
    if (a + b < n - 1) ind.push(base + idx(a + 1, b), base + idx(a + 1, b + 1), base + idx(a, b + 1));
  }
  return ind;
}
function paperGeometry(style, pal, nsub) {
  const pos = [], cols = [], ind = [];
  if (style === 'rokkaku') {
    const colorAt = (x, y) => { const y2 = -y; return Math.hypot(x, y) < 9 ? pal.c : (y2 >= -70 && y2 <= -34) || (y2 >= 2 && y2 <= 34) ? pal.a : pal.b; };
    const zAt = (x, y) => billow(x, y, 54, 72, 15);
    for (let i = 0; i < 6; i++) ind.push(...sectorMesh([0, 0], HEX[i], HEX[(i + 1) % 6], nsub + 6, colorAt, zAt, pos, cols));
  } else {
    const { top, right, bottom, left, mid } = PATANG, zAt = (x, y) => billow(x, y - 6, 50, 70, 14);
    const sect = (p, q, c) => ind.push(...sectorMesh(mid, p, q, nsub, () => c, zAt, pos, cols));
    sect(top, right, pal.a); sect(top, left, pal.b); sect(bottom, right, pal.b); sect(bottom, left, pal.a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(ind); g.computeVertexNormals();
  return g;
}
function buildKite(style, pal, nsub) {
  const grp = new THREE.Group(), tilt = new THREE.Group(); grp.add(tilt);
  const mats = [];
  const paperM = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.62, metalness: 0, emissive: 0x2a2420, emissiveIntensity: 0.55, transparent: true });
  mats.push(paperM);
  tilt.add(new THREE.Mesh(paperGeometry(style, pal, nsub), paperM));
  const sparM = new THREE.MeshStandardMaterial({ color: pal.spar, roughness: 0.55, transparent: true }); mats.push(sparM);
  const tube = (pts, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 24, r, 6, false), sparM);
  if (style === 'rokkaku') {
    const z = (x, y) => billow(x, y, 54, 72, 15) + 1.6;
    const line = (a, b) => { const pts = []; for (let i = 0; i <= 8; i++) { const x = a[0] + (b[0] - a[0]) * i / 8, y = a[1] + (b[1] - a[1]) * i / 8; pts.push([x, y, z(x, y)]); } return pts; };
    tilt.add(tube(line([0, 66], [0, -66]), 1.5), tube(line([-48, 33], [48, 33]), 1.3), tube(line([-48, -33], [48, -33]), 1.3));
    for (let i = 0; i < 6; i++) { const a = HEX[i], b = HEX[(i + 1) % 6]; tilt.add(tube(line(a, b).map(([x, y]) => [x, y, 1.0]), 1.2)); }
  } else {
    const { top, bottom, left, right } = PATANG, z = (x, y) => billow(x, y - 6, 50, 70, 14) + 1.6;
    tilt.add(tube([[top[0], top[1], z(0, 62)], [0, 20, z(0, 20)], [0, -20, z(0, -20)], [bottom[0], bottom[1], z(0, -66)]], 1.5));
    const bow = []; for (let i = 0; i <= 10; i++) { const x = left[0] + (right[0] - left[0]) * i / 10; bow.push([x, 6 + 16 * (1 - (x / 46) ** 2), z(x, 6) + 6 * (1 - (x / 46) ** 2)]); }
    tilt.add(tube(bow, 1.4));
    for (const [a, b] of [[top, right], [right, bottom], [bottom, left], [left, top]]) tilt.add(tube([[a[0], a[1], 1.0], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1.0], [b[0], b[1], 1.0]], 1.1));
  }
  const kn = new THREE.MeshStandardMaterial({ color: pal.c, roughness: 0.4, transparent: true }); mats.push(kn);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(4.2, 10, 8), kn); knot.position.set(0, style === 'rokkaku' ? 0 : 6, 18); tilt.add(knot);
  const tailM = new THREE.MeshStandardMaterial({ color: pal.tail, roughness: 0.7, side: THREE.DoubleSide, transparent: true }); mats.push(tailM);
  let tail = null; const bows = [];
  if (style !== 'rokkaku') {
    const long = style === 'tailed';
    tail = makeRibbon(long ? 14 : 6, tailM); tilt.add(tail);
    if (long) for (let i = 2; i <= 14; i += 3) { const bm = new THREE.MeshStandardMaterial({ color: i % 2 ? pal.a : pal.b, roughness: 0.6, transparent: true }); mats.push(bm); const b = new THREE.Mesh(new THREE.SphereGeometry(7, 4, 2), bm); b.scale.set(1, 1.5, 0.45); b.userData.i = i; tilt.add(b); bows.push(b); }
  }
  grp.userData = { tilt, mats, tail, bows, style };
  return grp;
}
function updateKite(g, k, t, alpha) {
  const U = g.userData, sc = (0.8 + 0.3 * clamp((k.y - 150) / 900, 0, 1)) * 1.25;
  const wob = Math.sin(t * 5.2 + k.ph) * 0.05 + Math.sin(t * 8.9 + k.ph * 2) * 0.025;
  g.position.set(k.x, -k.y, 0); g.rotation.z = -(k.ang + wob); g.scale.setScalar(sc);
  U.tilt.rotation.y = Math.sin(t * 2.3 + k.ph) * 0.22 + (k.vx || 0) * 0.0004; U.tilt.rotation.x = Math.sin(t * 1.7 + k.ph * 1.3) * 0.12;
  for (const m of U.mats) m.opacity = alpha;
  if (U.tail) {
    const long = U.style === 'tailed', n = long ? 14 : 6, pts = [[0, -64, -1]];
    for (let i = 1; i <= n; i++) {
      const x = long ? Math.sin(t * 6 + i * 0.7 + k.ph) * (4 + i * 1.5) : Math.sin(t * 7 + i * 0.9 + k.ph) * (2 + i * 1.2), y = long ? 66 + i * 11 : 66 + i * 7;
      pts.push([x, -y, -1 - i * 0.4]);
    }
    setRibbon(U.tail, pts, (u) => (long ? 6.5 : 3.2) * (1 - 0.45 * u));
    for (const b of U.bows) { const p = pts[b.userData.i]; b.position.set(p[0], p[1], p[2] + 1); b.rotation.z = Math.sin(t * 6 + b.userData.i) * 0.5; }
  }
}

// ---- the flyers: lathed and rounded solids, seen from behind ----------------------------------------------------------------------
function buildFlyer(pal) {
  const g = new THREE.Group();
  const mk = (color, rough = 0.7) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const cloth = mk(0x2c2a5e), trouser = mk(0x1d1a3a), skin = mk(0xb7825b, 0.55), hair = mk(0x15100e, 0.8), accent = mk(pal.a, 0.6), accent2 = mk(pal.b, 0.5), wood = mk(0xc79a5a, 0.5), band = mk(0xe8d9b8, 0.6);
  accent.side = THREE.DoubleSide;
  const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  for (const sx of [-9, 9]) { add(new THREE.CylinderGeometry(6.2, 5.2, 46, 14), trouser, sx, 25, 0); add(new THREE.SphereGeometry(5.6, 12, 8), trouser, sx, 3, 3).scale.set(1, 0.55, 1.5); }
  const pts = [[0, 0], [14, 2], [17.5, 20], [16.5, 40], [19.5, 56], [20.5, 66], [15, 76], [7, 80], [0, 80]].map(([r, y]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(pts, 24), cloth, 0, 44, 0).scale.set(1, 1, 0.72);
  add(new THREE.CylinderGeometry(3.8, 4.6, 9, 12), skin, 0, 128, 0);
  add(new THREE.SphereGeometry(12, 18, 14), hair, 0, 141, 0).scale.set(1, 1.06, 1.02);
  add(new THREE.SphereGeometry(11.6, 18, 10, 0, TAU, 0, Math.PI * 0.52), accent, 0, 144, 0).scale.set(1.02, 1, 1.04);
  add(new THREE.TorusGeometry(10.5, 2.4, 8, 24), accent, 0, 134, 0).rotation.x = Math.PI / 2;
  const scarf = makeRibbon(8, accent); g.add(scarf);
  const limb = (r, m) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.88, 1, 12), m); g.add(c); const j = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m); g.add(j); return { c, j }; };
  const arm = [limb(6.4, cloth), limb(5.2, cloth)], arm2 = [limb(6.4, cloth), limb(5.2, cloth)];
  const hand = add(new THREE.SphereGeometry(5.6, 12, 10), skin, 0, 0, 0), hand2 = add(new THREE.SphereGeometry(5.6, 12, 10), skin, 0, 0, 0);
  const reel = new THREE.Group(); g.add(reel);
  add(new THREE.CylinderGeometry(11, 11, 3, 24), accent2, 0, 0, 5, reel).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(11, 11, 3, 24), accent2, 0, 0, -5, reel).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(7.5, 7.5, 7, 20), band, 0, 0, 0, reel).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(1.4, 1.4, 12, 8), wood, 12, 0, 0, reel);
  g.userData = { arm, arm2, hand, hand2, reel, scarf };
  return g;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
function place(l, a, b) { _a.set(...a); _b.set(...b); const len = _a.distanceTo(_b); l.c.position.copy(_a).add(_b).multiplyScalar(0.5); l.c.scale.set(1, Math.max(0.01, len), 1); _q.setFromUnitVectors(_y, _b.sub(_a).normalize()); l.c.quaternion.copy(_q); l.j.position.set(...b); }
function updateFlyer(g, side, k, t) {
  const U = g.userData, a = ANCHOR[side], dx = k.x - a.x, dy = k.y - a.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  g.position.set(a.x + (side === 0 ? -6 : 6), -FEET, 6);
  const sg = side === 0 ? 1 : -1, ox = g.position.x, oy = g.position.y;
  // joints are in world space (the group only carries the body): shoulders, elbows, the hand on the line and the reel hand at the anchor
  const sh = [ox + sg * 17, oy + 117, 8], rh = [a.x, -a.y + 4, 16], lh = [a.x + ux * 52, -(a.y + uy * 52) + 2, 14];
  const el = [(sh[0] + lh[0]) / 2 + sg * 7, (sh[1] + lh[1]) / 2 - 8, 11];
  const sh2 = [ox - sg * 17, oy + 117, 8], el2 = [sh2[0] - sg * 4, oy + 80, 11];
  for (const [l, a1, b1] of [[U.arm[0], sh, el], [U.arm[1], el, lh], [U.arm2[0], sh2, el2], [U.arm2[1], el2, rh]]) place(l, a1, b1);
  U.hand.position.set(...lh); U.hand2.position.set(...rh);
  U.reel.position.set(rh[0] - sg * 8, rh[1] - 4, rh[2] + 2); U.reel.rotation.z = t * 0.5 * -sg;
  const pts = [];
  for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([ox + sg * (10 + u * 26), oy + 130 - u * 8 + Math.sin(t * 7 + i * 0.8 + side) * (1 + u * 6), 0]); }
  setRibbon(U.scarf, pts, (u) => 8 * (1 - 0.5 * u));
}

// ---- scenery --------------------------------------------------------------------------------------------------------------------------
function ridgeMesh(xmin, xmax, topFn, bottom, relief, cTop, cBot, rows = 6) {
  const dx = 36, cols = Math.ceil((xmax - xmin) / dx), pos = [], cl = [], idx = [];
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
    const x = xmin + c * dx, v = r / rows, y = topFn(x) + v * (bottom - topFn(x));
    const z = relief * (Math.sin(x * 0.021 + r * 1.3) * 0.5 + Math.sin(x * 0.047 + r * 2.1) * 0.3 + 0.2) * (r === 0 ? 0.2 : 1) * (1 - v * 0.4);
    pos.push(x, -y, z); const k = new THREE.Color(cTop).lerp(new THREE.Color(cBot), Math.pow(v, 0.7)); cl.push(k.r, k.g, k.b);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = r * (cols + 1) + c, b = a + cols + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
}
const stoneTex = () => canvasTex(512, 256, (x, w, h) => {
  x.fillStyle = '#8a7f78'; x.fillRect(0, 0, w, h); const r = rnd(5);
  for (let row = 0; row < 8; row++) for (let c = -1; c < 8; c++) { const bx = c * 64 + (row % 2 ? 32 : 0), by = row * 32; const s = 118 + r() * 40; x.fillStyle = `rgb(${s + 20},${s + 8},${s - 6})`; x.fillRect(bx + 2, by + 2, 60, 28); x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(bx + 2, by + 22, 60, 8); }
});

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 100, 12000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x554433, 0.85), sun = new THREE.DirectionalLight(0xffffff, 2.2), fill = new THREE.DirectionalLight(0x9db4ff, 0.35);
  scene.add(hemi, sun, sun.target, fill); fill.position.set(400, 200, 800);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.3; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // depth layers: a point at world (x, y) on layer zd projects to the same screen place as on the z = 0 plane
  const vis = { cx: 360, cy: 640 };
  const lp = (x, y, zd, out) => { const f = (D + zd) / D; return out.set(vis.cx + (x - vis.cx) * f, -(vis.cy + (y - vis.cy) * f), -zd); };
  let layers = [];
  const layer = (zd, parent = scene) => { const g = new THREE.Group(); g.userData.zd = zd; parent.add(g); layers.push(g); return g; };
  const placeLayers = () => { for (const g of layers) { const f = (D + g.userData.zd) / D; g.scale.set(f, f, 1); g.position.set(vis.cx * (1 - f), -vis.cy * (1 - f), -g.userData.zd); } };

  // ---- sky: gradient background, sun + haze, cloud banks -----------------------------------------------------------------------------
  const sunG = layer(3000);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
  const glowT = canvasTex(256, 256, (x) => { const g = x.createRadialGradient(128, 128, 4, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff }));
  sunG.add(glow, sunDisc);
  const NCL = TIERS[0].clouds, PUFFS = 7, cloudSeed = rnd(12345), CL = [];
  for (let i = 0; i < NCL; i++) CL.push({ x: cloudSeed() * W, y: 90 + cloudSeed() * 900, sc: 0.5 + cloudSeed() * 1.1, sp: 4 + cloudSeed() * 12, zd: 350 + cloudSeed() * 900, off: Array.from({ length: PUFFS }, () => [cloudSeed() * 2 - 1, cloudSeed() * 0.8 - 0.3, 0.5 + cloudSeed() * 0.7]) });
  const cloudM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, emissive: 0x333333, emissiveIntensity: 0.6 });
  const clouds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), cloudM, NCL * PUFFS); clouds.frustumCulled = false; scene.add(clouds);
  for (let i = 0; i < NCL * PUFFS; i++) clouds.setColorAt(i, new THREE.Color(1, 1, 1));
  const streakM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const streakSeed = rnd(777), STR = []; for (let i = 0; i < 26; i++) STR.push({ x: streakSeed() * W, y: 160 + streakSeed() * 880, len: 60 + streakSeed() * 150, sp: 14 + streakSeed() * 26, th: 1.2 + streakSeed() * 1.6, r: makeRibbon(8, streakM) });
  const streakG = layer(40); for (const s of STR) streakG.add(s.r);

  // ---- land: far mountains, hills, the village, trees, the stone terrace --------------------------------------------------------------
  let land = null;
  const buildLand = (P) => {
    if (land) { scene.remove(land); layers = layers.filter((g) => g.parent !== land); land.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose?.(); }); }
    land = new THREE.Group(); scene.add(land);
    const haze = new THREE.Color(P.low), X0 = -4600, X1 = 5300;
    const far = layer(1700, land), mid = layer(800, land), nearL = layer(120, land), front = layer(0, land);
    far.add(ridgeMesh(X0, X1, (x) => 880 + Math.sin(x * 0.0041 + 2) * 120 + Math.sin(x * 0.011) * 50, 1500, 26, mix(P.hill[0], haze, 0.62).getHex(), mix(P.hill[0], haze, 0.4).getHex()));
    mid.add(ridgeMesh(X0, X1, (x) => 1000 + Math.sin(x * 0.0073 + 1) * 58 + Math.sin(x * 0.019) * 24, 1500, 24, mix(P.hill[0], haze, 0.3).getHex(), P.hill[0]));
    nearL.add(ridgeMesh(X0, X1, (x) => 1060 + Math.sin(x * 0.011 + 1) * 26 + Math.sin(x * 0.027) * 12, 1500, 14, P.hill[0], P.hill[1]));
    const bodyM = new THREE.MeshStandardMaterial({ color: mix(P.hill[1], 0xd9c3a0, 0.18).getHex(), roughness: 0.9 }), roofM = new THREE.MeshStandardMaterial({ color: P.roof, roughness: 0.85 }), winM = new THREE.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffb050, emissiveIntensity: P.dark ? 1.6 : 0.5, roughness: 0.6 });
    const roofs = [[-10, 1096, 120, 60], [96, 1108, 90, 48], [190, 1088, 70, 70], [452, 1100, 80, 56], [540, 1090, 100, 66], [650, 1104, 90, 52]];
    const T0 = -6, T1 = 7, boxes = [], tops = [], wins = [];
    for (let t = T0; t <= T1; t++) for (const [x, y, w, h] of roofs) {
      boxes.push([t * W + x + w / 2, y + h / 2 + 10, w, h + 20, 90]); tops.push([t * W + x + w / 2, y - 2, w + 6, 8, 96]);
      for (let p = 0; p < w; p += 22) tops.push([t * W + x + p + 6, y - 10, 12, 10, 92]);
      for (let p = 14; p < w - 8; p += 26) wins.push([t * W + x + p + 5, y + 22, 9, 15, 92]);
    }
    const inst = (geo, mat, list, parent) => { const m = new THREE.InstancedMesh(geo, mat, list.length), M = new THREE.Matrix4(); list.forEach(([x, y, w, h, d], i) => { M.compose(new THREE.Vector3(x, -y, 0), new THREE.Quaternion(), new THREE.Vector3(w, h, d)); m.setMatrixAt(i, M); }); m.frustumCulled = false; parent.add(m); return m; };
    const box = new THREE.BoxGeometry(1, 1, 1);
    inst(box, bodyM, boxes, nearL); inst(box, roofM, tops, nearL); inst(box, winM, wins, nearL);
    const frust = new THREE.CylinderGeometry(0.5 * Math.SQRT2 * 0.52, 0.5 * Math.SQRT2, 1, 4, 1); frust.rotateY(Math.PI / 4);
    const tem = [], temB = [];
    for (let t = T0; t <= T1; t++) { tem.push([t * W + 366, 1098, 132, 28, 70]); temB.push([t * W + 366, 1132, 108, 40, 66]); }
    inst(frust, roofM, tem, nearL); inst(box, bodyM, temB, nearL);
    const trees = []; for (let t = T0; t <= T1; t++) for (const [x, y, s] of [[40, 1140, 1], [330, 1146, 0.8], [660, 1138, 1.1], [700, 1150, 0.7]]) trees.push({ x: x + t * W, y, s });
    const trunkM = new THREE.MeshStandardMaterial({ color: mix(P.roof, 0x3a2a1a, 0.5).getHex(), roughness: 1 }), crownM = new THREE.MeshStandardMaterial({ color: mix(P.roof, 0x2f5a3a, 0.35).getHex(), roughness: 0.95 });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 1, 1, 6), trunkM, trees.length), crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 9), crownM, trees.length * 3);
    trunks.frustumCulled = crowns.frustumCulled = false; nearL.add(trunks, crowns);
    land.userData = { trees, trunks, crowns };
    const tex = stoneTex(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(30, 3);
    const stoneM = new THREE.MeshStandardMaterial({ map: tex, color: mix(0xffffff, P.hill[1], 0.35).getHex(), roughness: 0.92 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(11000, 900, 240), stoneM); wall.position.set(360, -(FEET + 450), -110); front.add(wall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(11000, 12, 250), new THREE.MeshStandardMaterial({ color: mix(0xe6d8c0, P.hill[1], 0.3).getHex(), roughness: 0.7 })); cap.position.set(360, -(FEET + 4), -108); front.add(cap);
  };
  const flyers = [null, null], kites = [null, null]; let kiteKey = '';
  const strings = [0, 1].map(() => ({ core: makeRibbon(12, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })), glow: makeRibbon(12, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false })) }));
  const sever = makeRibbon(12, new THREE.MeshBasicMaterial({ color: 0xfff6e4, transparent: true, opacity: 0.85 })); scene.add(sever);
  for (const s of strings) scene.add(s.glow, s.core);

  const setSky = (skyId) => {
    const P = SKY_PAL[skyId] ?? SKY_PAL.dawn;
    scene.background = canvasTex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, P.top); g.addColorStop(0.52, P.mid); g.addColorStop(1, P.low); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    sunDisc.material.color.set(P.sunCol); sunDisc.scale.setScalar(skyId === 'noon' ? 34 : 52); sunDisc.material.opacity = skyId === 'storm' ? 0.35 : 1;
    glow.material.color.set(P.sunCol); glow.material.opacity = skyId === 'storm' ? 0.4 : 0.9; glow.scale.set(1100, 1100, 1);
    sun.color.set(P.sunCol); sun.intensity = skyId === 'noon' ? 2.6 : skyId === 'storm' ? 1.0 : 2.3;
    sun.position.set((P.sun[0] - 0.5) * 3600, (0.55 - P.sun[1]) * 3200 + 500, 1400); sun.target.position.set(360, -900, 0);
    hemi.color.set(mix(P.top, 0xffffff, 0.55)); hemi.groundColor.set(mix(P.roof, 0x806040, 0.3)); hemi.intensity = skyId === 'storm' ? 0.95 : 0.8;
    cloudM.color.setRGB(P.cloud[0] / 255, P.cloud[1] / 255, P.cloud[2] / 255).lerp(new THREE.Color(P.mid), 0.22); cloudM.emissive.copy(cloudM.color).multiplyScalar(0.6);
    const Q = { ...P, dark: skyId === 'dusk' || skyId === 'storm' }; buildLand(Q);
    return Q;
  };

  function applyTier() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr)); }
  applyTier();

  let lost = false, clock = 0, lastNow = 0, frameAvg = 16, slowFrames = 0, shown = false, curSky = '', palCur = null;
  const _v = new THREE.Vector3(), _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _S = new THREE.Vector3(), _Z = new THREE.Vector3(0, 0, 1), _C = new THREE.Color();
  function ensureActors(F) {
    const key = `${F.pals[0].a}|${F.pals[1].a}|${F.w.k[0].style}|${F.w.k[1].style}|${tier}`;
    if (key === kiteKey) return; kiteKey = key;
    const kill = (o) => { scene.remove(o); o.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); };
    for (let i = 0; i < 2; i++) {
      if (kites[i]) kill(kites[i]);
      kites[i] = buildKite(F.w.k[i].style, F.pals[i], TIERS[tier].seg); scene.add(kites[i]);
      if (flyers[i]) kill(flyers[i]);
      flyers[i] = buildFlyer(F.pals[i]); scene.add(flyers[i]);
    }
  }
  const SP = [];
  function drawFrame(F) {
    const { vw, w, t } = F, wx = vw.x1 - vw.x0, wh = vw.y1 - vw.y0;
    vis.cx = (vw.x0 + vw.x1) / 2; vis.cy = (vw.y0 + vw.y1) / 2;
    if (F.sky !== curSky) { curSky = F.sky; palCur = setSky(F.sky); }
    const P = palCur;
    camera.fov = 2 * Math.atan(wh / 2 / D) * 180 / Math.PI; camera.aspect = wx / wh; camera.updateProjectionMatrix();
    camera.position.set(vis.cx + Math.sin(clock * 0.21) * 26, -vis.cy, D); camera.lookAt(vis.cx, -vis.cy, 0); camera.updateMatrixWorld(true);
    placeLayers();
    const sx = vw.x0 + P.sun[0] * wx, sy = vw.y0 + P.sun[1] * wh; sunG.children.forEach((c) => c.position.set(sx, -sy, 0));
    // clouds drift with the integrated wind phase and wrap across the visible width (as the flat art did)
    const span = wx + 520, n = TIERS[tier].clouds, yTop = vw.y0 + 50, yBot = Math.min(vw.y1 - 150, 1000); let ci = 0;
    for (let i = 0; i < NCL; i++) {
      const c = CL[i], on = i < n; let x = (c.x / W * wx + F.dir * F.wp * c.sp * 6) % span; if (x < 0) x += span; x += vw.x0 - 260;
      const y = yTop + (c.y - 90) / 900 * Math.max(200, yBot - yTop), depth = 0.55 + 0.45 * (clamp(y, 0, 1000) / 1000);
      for (let j = 0; j < PUFFS; j++) {
        const o = c.off[j], R = 54 * c.sc * depth * o[2];
        lp(x + o[0] * 150 * c.sc * depth, y + o[1] * 30 * c.sc * depth, c.zd, _v); _S.set(R * 1.15, on ? R * 0.62 : 0.001, R * 0.8); _M.compose(_v, _Q.identity(), _S);
        clouds.setMatrixAt(ci, _M); const shade = 0.78 + 0.22 * clamp(1 - o[1] * 1.4, 0, 1); clouds.setColorAt(ci, _C.setRGB(shade, shade, shade * 1.02)); ci++;
      }
    }
    clouds.instanceMatrix.needsUpdate = true; clouds.instanceColor.needsUpdate = true;
    const cnt = Math.round(clamp((w.wnow - 0.15) / 0.9, 0, 1) * STR.length), yT = vw.y0 + 100, yB = Math.min(vw.y1 - 200, 1040);
    STR.forEach((s, i) => {
      s.r.visible = i < cnt; if (i >= cnt) return;
      let x = (s.x / W * wx + F.dir * F.wp * s.sp * 8) % (wx + 300); if (x < 0) x += wx + 300; x += vw.x0 - 150;
      const y = yT + (s.y - 160) / 880 * Math.max(200, yB - yT) + Math.sin(F.wp * 0.4 + i) * 10, p = [];
      for (let q = 0; q <= 8; q++) { const u = q / 8; p.push([x + F.dir * s.len * u, -(y - Math.sin(u * Math.PI) * 6), 0]); }
      setRibbon(s.r, p, () => s.th);
    });
    const U = land.userData, lean = F.dir * clamp(w.wnow, 0, 1.2) * 14;
    U.trees.forEach((tr, i) => {
      const sw = Math.sin(F.wp * 0.8 + tr.x) * 2.5, s = tr.s, l = (lean + sw) * s;
      _Q.setFromAxisAngle(_Z, -l / 90); _S.set(6 * s, 84 * s, 6 * s); _v.set(tr.x + l * 0.3, -(tr.y - 40 * s), 4); _M.compose(_v, _Q, _S); U.trunks.setMatrixAt(i, _M);
      [[l, -92 * s, 30 * s], [l - 20 * s, -76 * s, 21 * s], [l + 20 * s, -78 * s, 21 * s]].forEach(([dx, dy, r], j) => { _v.set(tr.x + dx, -(tr.y + dy), 5); _S.set(r, r * 0.9, r); _M.compose(_v, _Q.identity(), _S); U.crowns.setMatrixAt(i * 3 + j, _M); });
    });
    U.trunks.instanceMatrix.needsUpdate = U.crowns.instanceMatrix.needsUpdate = true;
    ensureActors(F);
    for (let i = 0; i < 2; i++) {
      const k = w.k[i]; flyers[i].visible = !F.noFlyers; if (!F.noFlyers) updateFlyer(flyers[i], i, k, t);
      updateKite(kites[i], k, t, 1 - (k.free ? clamp((k.y - (w.over ? w.over.y : 0)) / 600, 0, 1) * 0.7 : 0));
      const s = strings[i]; s.core.visible = s.glow.visible = !k.free;
      if (!k.free) {
        k.dirHint = F.dir; stringPoints(k, SP);
        const p = []; for (let q = 0; q < SP.length; q += 2) p.push([SP[q], -SP[q + 1], -3 - i]);
        const T = clamp(k.T, 0, 1.3), wd = 2.4 + 2 * T, wear = clamp(1 - k.integ / 100, 0, 1), c = s.core.material.color;
        if (T > 1.05) c.setRGB(1, (120 - 40 * wear) / 255, (90 - 40 * wear) / 255); else if (T > 0.75) c.setRGB(1, (210 - 40 * wear) / 255, (120 - 30 * wear) / 255); else if (T > 0.35) c.setRGB(1, (246 - 30 * wear) / 255, (225 - 70 * wear) / 255); else c.setRGB((225 - 20 * wear) / 255, (240 - 40 * wear) / 255, 1);
        s.core.material.opacity = k.integ < 35 ? 0.65 : 1; s.glow.material.color.copy(c);
        setRibbon(s.core, p, () => wd); setRibbon(s.glow, p, () => wd + 6);
      }
    }
    sever.visible = !!w.sever;
    if (w.sever) {
      const s = w.sever, a = ANCHOR[s.side], sag = 30 + s.t * 40, p = [], cx = (a.x + s.px) / 2 + w.wind.dir * 14, cy = (a.y + s.py) / 2 + sag;
      for (let q = 0; q <= 12; q++) { const u = q / 12, m = 1 - u; p.push([m * m * a.x + 2 * m * u * cx + u * u * s.px, -(m * m * a.y + 2 * m * u * cy + u * u * s.py), -3]); }
      setRibbon(sever, p, () => 3);
    }
  }

  function pre() { if (lost) return; v3.want = false; v3.frame = null; }
  function post() {
    if (lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    if (!v3.want || !v3.frame) { if (shown) { canvas.style.visibility = 'hidden'; shown = false; } return; }
    clock += dt;
    if (!shown) { canvas.style.visibility = 'visible'; shown = true; }
    drawFrame(v3.frame);
    renderer.setSize(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); kiteKey = ''; } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.want = false; canvas.style.visibility = 'hidden'; shown = false; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); curSky = ''; kiteKey = ''; applyTier(); v3.on = true; });
  let loseExt = null;
  await tick();
  return {
    ok: true, renderer, scene, camera,
    attach() { v3.on = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
