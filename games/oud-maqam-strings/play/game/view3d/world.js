// Oud Maqam Strings 3D world: a lit oud (ribbed rosewood bowl, spruce soundboard with three carved rosettes, walnut pickguard,
// ebony fingerboard, bone nut, bent-back pegbox with pegs, twelve strings in six courses) lying on a woven rug in a lamp-lit majlis
// (floor cushion, brass lantern, tea tray). Everything is procedural (canvas textures, analytic geometry): no image files.
// The oud is built in its own frame like the 2D art: x = u (along the neck from the nut), z = v (across), y up, the soundboard at y = 0.
import * as THREE from '../vendor3d/three.js';
import { lathe, roundedBox, material } from '../vendor3d/board3d.js';
import { PROFILE } from '../src/art.js';

// The body outline as a smooth curve: a centripetal-free Catmull-Rom spline through the same profile knots the 2D art uses (no flat
// spots, so the lit binding and the soundboard edge read as one clean pear curve). t 0..1 along the body -> half width 0..1.
const KN = PROFILE;
export function bodyHalf(t) {
  t = clamp(t, 0, 1); if (t >= 1) return 0;
  let i = 1; while (i < KN.length - 1 && t > KN[i][0]) i++;
  const a = KN[i - 1], b = KN[i], h = b[0] - a[0], u = (t - a[0]) / h;
  const tan = (j) => { const p = KN[Math.max(0, j - 1)], q = KN[Math.min(KN.length - 1, j + 1)]; return (q[1] - p[1]) / Math.max(1e-6, q[0] - p[0]); };
  let m0 = tan(i - 1) * h, m1 = tan(i) * h;
  if (i === KN.length - 1) m1 = -3 * h;                      // the tail closes round, not pointed
  const u2 = u * u, u3 = u2 * u;
  return Math.max(0, (2 * u3 - 3 * u2 + 1) * a[1] + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * b[1] + (u3 - u2) * m1);
}

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function canvasTex(c, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// ---------------------------------------------------------------- textures
// Bowl ribs: alternating rosewood and lighter walnut staves with thin maple lines between them (u = around the bowl, v = along it).
function ribCanvas(n = 19) {
  const W = 1024, H = 256, c = cv(W, H), x = c.getContext('2d'), r = rng(7);
  const sw = W / n;
  for (let i = 0; i < n; i++) {
    const x0 = i * sw, dark = i % 2 === 0;
    const g = x.createLinearGradient(x0, 0, x0 + sw, 0);
    if (dark) { g.addColorStop(0, '#2a120a'); g.addColorStop(0.5, '#4a2414'); g.addColorStop(1, '#2a120a'); }
    else { g.addColorStop(0, '#6a3a1c'); g.addColorStop(0.5, '#93582c'); g.addColorStop(1, '#6a3a1c'); }
    x.fillStyle = g; x.fillRect(x0, 0, sw, H);
    for (let k = 0; k < 14; k++) {                                      // grain along the stave
      const gx = x0 + r() * sw; x.strokeStyle = `rgba(${dark ? '10,4,2' : '40,18,6'},${0.15 + r() * 0.25})`; x.lineWidth = 0.6 + r() * 1.2;
      x.beginPath(); x.moveTo(gx, 0); for (let y = 0; y <= H; y += 16) x.lineTo(gx + Math.sin(y * 0.03 + k) * 1.5, y); x.stroke();
    }
    x.fillStyle = '#e8c890'; x.fillRect(x0 - 1.2, 0, 2.4, H);           // maple line
    x.fillStyle = 'rgba(20,8,4,0.6)'; x.fillRect(x0 + 1.2, 0, 1, H);
  }
  return c;
}
// Spruce soundboard: pale gold with fine straight grain along the instrument (canvas x = along).
function spruceCanvas() {
  const W = 1024, H = 512, c = cv(W, H), x = c.getContext('2d'), r = rng(3);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#d9b277'); g.addColorStop(0.5, '#ecca8e'); g.addColorStop(1, '#d6ad70');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 2 + r() * 4) { x.fillStyle = `rgba(150,92,36,${0.08 + r() * 0.16})`; x.fillRect(0, y, W, 0.6 + r() * 1.3); }
  for (let i = 0; i < 2500; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,240,200,0.05)' : 'rgba(90,50,20,0.05)'; x.fillRect(r() * W, r() * H, 3 + r() * 30, 1); }
  // varnish ageing: warmer towards the edges
  const v = x.createRadialGradient(W * 0.45, H / 2, H * 0.15, W * 0.5, H / 2, W * 0.6); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(120,60,15,0.28)');
  x.fillStyle = v; x.fillRect(0, 0, W, H);
  return c;
}
// A carved rosette (qamariyya): an interlaced twelve-point star lattice; transparent where the wood is cut away.
function rosetteCanvas(points = 12, seed = 1) {
  const S = 512, c = cv(S), x = c.getContext('2d'), R = S / 2;
  x.translate(R, R);
  x.strokeStyle = '#e9cf9c'; x.lineCap = 'round'; x.lineJoin = 'round';
  const star = (rO, rI, rot, lw) => { x.lineWidth = lw; x.beginPath(); for (let i = 0; i <= points * 2; i++) { const a = rot + i * Math.PI / points, rr = i % 2 ? rI : rO; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.stroke(); };
  for (const [ro, ri, lw] of [[0.97, 0.62, 13], [0.8, 0.45, 11], [0.6, 0.3, 10], [0.36, 0.16, 9]]) { star(R * ro, R * ri, 0, lw); star(R * ro, R * ri, Math.PI / points, lw); }
  for (const rr of [0.2, 0.5, 0.74]) { x.lineWidth = 7; x.beginPath(); x.arc(0, 0, R * rr, 0, TAU); x.stroke(); }
  x.lineWidth = 18; x.beginPath(); x.arc(0, 0, R * 0.985, 0, TAU); x.stroke();
  x.fillStyle = '#e9cf9c'; x.beginPath(); x.arc(0, 0, R * 0.07, 0, TAU); x.fill();
  void seed;
  return c;
}
// Mosaic ring around a rosette: alternating dark and light wood chips with pearl lines.
function ringCanvas() {
  const S = 512, c = cv(S), x = c.getContext('2d'), R = S / 2; x.translate(R, R);
  const n = 64;
  for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? '#3a1a0c' : '#c9965a'; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, i * TAU / n, (i + 1) * TAU / n); x.closePath(); x.fill(); }
  for (const [rr, col, lw] of [[0.99, '#f4ecdf', 8], [0.86, '#1b0d06', 6], [0.8, '#f4ecdf', 5]]) { x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); x.arc(0, 0, R * rr - lw / 2, 0, TAU); x.stroke(); }
  return c;
}
// The pickguard: walnut with a pearl line inlaid around it and a small inlaid star (u along, v across).
function guardCanvas() {
  const W = 512, H = 256, c = cv(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#4a2412'); g.addColorStop(0.5, '#6e3a1c'); g.addColorStop(1, '#4a2412');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const r = rng(9); for (let i = 0; i < 60; i++) { x.strokeStyle = `rgba(30,12,4,${0.2 + r() * 0.3})`; x.lineWidth = 1; const y = r() * H; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(W * 0.3, y + 6, W * 0.6, y - 6, W, y); x.stroke(); }
  x.strokeStyle = '#f2e8d2'; x.lineWidth = 7;
  x.beginPath(); x.moveTo(18, H / 2); x.quadraticCurveTo(W / 2, -H * 0.12, W - 18, H / 2); x.quadraticCurveTo(W / 2, H * 1.12, 18, H / 2); x.stroke();
  x.fillStyle = '#f2e8d2'; x.translate(W * 0.42, H / 2); x.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? 9 : 24; x.lineTo(Math.cos(a) * rr * 1.6, Math.sin(a) * rr); } x.closePath(); x.fill();
  return c;
}
// A woven majlis rug: madder red field, indigo borders, cream and gold geometry (generic ornament, no symbols).
function rugCanvas() {
  const W = 1024, H = 1536, c = cv(W, H), x = c.getContext('2d'), r = rng(11);
  x.fillStyle = '#142636'; x.fillRect(0, 0, W, H);
  const band = (inset, w, col) => { x.fillStyle = col; x.fillRect(inset, inset, W - inset * 2, w); x.fillRect(inset, H - inset - w, W - inset * 2, w); x.fillRect(inset, inset, w, H - inset * 2); x.fillRect(W - inset - w, inset, w, H - inset * 2); };
  band(0, 70, '#4a1219'); band(10, 5, '#c9a35e'); band(57, 5, '#c9a35e');
  // running diamonds in the border
  x.fillStyle = '#c99a4a';
  for (let p = 80; p < W - 80; p += 46) for (const y of [35, H - 35]) { x.beginPath(); x.moveTo(p, y - 14); x.lineTo(p + 12, y); x.lineTo(p, y + 14); x.lineTo(p - 12, y); x.closePath(); x.fill(); }
  for (let p = 80; p < H - 80; p += 46) for (const xx of [35, W - 35]) { x.beginPath(); x.moveTo(xx, p - 14); x.lineTo(xx + 12, p); x.lineTo(xx, p + 14); x.lineTo(xx - 12, p); x.closePath(); x.fill(); }
  band(90, 30, '#5c1a22'); band(120, 3, '#d8c294');
  // field: an all-over lattice of small lozenges
  x.save(); x.beginPath(); x.rect(130, 130, W - 260, H - 260); x.clip();
  for (let yy = 130; yy < H - 130; yy += 36) for (let xx = 130 + ((yy / 36) % 2) * 18; xx < W - 130; xx += 36) {
    x.strokeStyle = 'rgba(201,163,94,0.14)'; x.lineWidth = 2; x.beginPath(); x.moveTo(xx, yy - 12); x.lineTo(xx + 12, yy); x.lineTo(xx, yy + 12); x.lineTo(xx - 12, yy); x.closePath(); x.stroke();
    x.fillStyle = 'rgba(120,30,38,0.32)'; x.fillRect(xx - 2.5, yy - 2.5, 5, 5);
  }
  // central medallion
  x.translate(W / 2, H / 2);
  for (const [rx, ry, col] of [[210, 300, '#4a1219'], [196, 282, '#c9a35e'], [190, 274, '#5c1a22'], [130, 190, '#d8c294'], [124, 182, '#142636'], [50, 74, '#c9a35e']]) {
    x.fillStyle = col; x.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16, k = i % 2 ? 0.8 : 1; x.lineTo(Math.sin(a) * rx * k, -Math.cos(a) * ry * k); }
    x.closePath(); x.fill();
  }
  x.restore();
  // wool: soft noise and a little wear
  for (let i = 0; i < 26000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,230,200,0.05)' : 'rgba(0,0,0,0.07)'; x.fillRect(r() * W, r() * H, 2, 2); }
  return c;
}
// Dark floor planks.
function floorCanvas() {
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = rng(5);
  const n = 8, h = S / n;
  for (let i = 0; i < n; i++) {
    const g = x.createLinearGradient(0, i * h, 0, (i + 1) * h), b = 34 + r() * 14;
    g.addColorStop(0, `rgb(${b + 20},${b},${b - 14})`); g.addColorStop(1, `rgb(${b + 10},${b - 8},${b - 20})`);
    x.fillStyle = g; x.fillRect(0, i * h, S, h);
    for (let k = 0; k < 24; k++) { x.strokeStyle = `rgba(0,0,0,${0.15 + r() * 0.2})`; x.lineWidth = 1; const y = i * h + r() * h; x.beginPath(); x.moveTo(0, y); for (let s = 0; s <= S; s += 32) x.lineTo(s, y + Math.sin(s * 0.01 + k) * 2); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(0, i * h, S, 3);
    const off = r() * S; x.fillRect(off, i * h, 3, h);
  }
  return c;
}
export function radialTex(rgb = '255,200,120', a = 1) {
  const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.35, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

// ---------------------------------------------------------------- materials (shared)
export function materials() {
  const M = {};
  M.ribs = new THREE.MeshPhysicalMaterial({ map: canvasTex(ribCanvas()), roughness: 0.38, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.18, side: THREE.DoubleSide, envMapIntensity: 0.6 });
  M.ribs.map.wrapS = THREE.RepeatWrapping;
  M.spruce = new THREE.MeshPhysicalMaterial({ map: canvasTex(spruceCanvas()), roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.3 });
  M.walnut = material('darkWood', { color: '#3b1f10', color2: '#5a3018', seed: 8 });
  M.ebony = new THREE.MeshPhysicalMaterial({ color: 0x17110d, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  M.bone = material('ivory', { color: '#efe4c8', color2: '#e2d2ab' });
  M.guard = new THREE.MeshPhysicalMaterial({ map: canvasTex(guardCanvas()), roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  M.horn = new THREE.MeshPhysicalMaterial({ color: 0x2a1408, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1, sheen: 0.3, sheenColor: new THREE.Color(0x9a5a2a) });
  M.binding = new THREE.MeshStandardMaterial({ color: 0xeee2c6, roughness: 0.35 });
  M.rose = new THREE.MeshStandardMaterial({ map: canvasTex(rosetteCanvas()), color: 0xffffff, roughness: 0.55, alphaTest: 0.45, side: THREE.DoubleSide });
  M.roseRing = new THREE.MeshPhysicalMaterial({ map: canvasTex(ringCanvas()), roughness: 0.35, clearcoat: 0.6 });
  M.hole = new THREE.MeshBasicMaterial({ color: 0x0a0503 });
  M.peg = material('darkWood', { color: '#24130a', color2: '#3d2212', seed: 4 });
  M.gut = new THREE.MeshStandardMaterial({ color: 0xf0e6cf, roughness: 0.3, metalness: 0.0 });
  M.wound = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.28, metalness: 0.85 });
  M.brass = material('brass', { color: '#b8862e', color2: '#e8c46a' });
  M.velvet = material('cloth', { color: '#5e1424', color2: '#7d2234' });
  M.velvet2 = material('cloth', { color: '#14304a', color2: '#1f4766' });
  M.gold = new THREE.MeshStandardMaterial({ color: 0xc9a050, roughness: 0.4, metalness: 0.8 });
  M.glass = new THREE.MeshPhysicalMaterial({ color: 0xfff4e0, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.35, clearcoat: 1, depthWrite: false });
  M.tea = new THREE.MeshStandardMaterial({ color: 0x8a2a0c, roughness: 0.15, transparent: true, opacity: 0.85 });
  M.rug = new THREE.MeshStandardMaterial({ map: canvasTex(rugCanvas()), roughness: 0.95 });
  M.floor = new THREE.MeshStandardMaterial({ map: canvasTex(floorCanvas(), { repeat: [3, 3] }), roughness: 0.7 });
  return M;
}

// ---------------------------------------------------------------- the oud
// o = { Lneck, Lbody, bodyW, nutW, peg } in world units (the 2D layout units on the play screens); k = units per centimetre.
export function stringV(o, i, u) {
  const kk = clamp(u / (o.Lneck + o.Lbody * 0.78), 0, 1), w = o.nutW * 0.74 + (o.bodyW * 0.36 - o.nutW * 0.74) * kk;
  return (i - 2.5) / 2.5 * w / 2;
}
function grid(nT, nP, fn) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nT; i++) for (let j = 0; j <= nP; j++) { const p = fn(i / nT, j / nP); pos.push(p[0], p[1], p[2]); uv.push(j / nP, i / nT); }
  for (let i = 0; i < nT; i++) for (let j = 0; j < nP; j++) { const a = i * (nP + 1) + j, b = a + nP + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Shape in the oud plane (x = u, y = v) laid flat at height y.
function flat(shape, y, uvFn) {
  const g = new THREE.ShapeGeometry(shape, 24); g.rotateX(Math.PI / 2); g.translate(0, y, 0);      // (x, y) -> (x, y0, y): v stays +z
  if (uvFn) { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) { const q = uvFn(p.getX(i), p.getZ(i)); uv.setXY(i, q[0], q[1]); } }
  // ShapeGeometry faces +z before the rotation; after rotateX(+90deg) they face -y: flip so the top is lit
  const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}
function circlePath(cx, cy, r, n = 40) { const p = new THREE.Path(); for (let i = 0; i <= n; i++) { const a = -i * TAU / n; i ? p.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : p.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } return p; }

const STRING_VS = `
uniform float uAmp; uniform float uPh; uniform float uT;
`;
export function buildOud(o, M, k) {
  const { Lneck, Lbody, bodyW, nutW } = o;
  const group = new THREE.Group();
  const uB = Lneck - Lbody * 0.02, dep = bodyW * 0.5, half = (t) => bodyW / 2 * bodyHalf(t);
  const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  // bowl: staves around a half-ellipse cross-section, closing at the tail
  const bowl = grid(56, 40, (t, p) => { const w = half(t) * 0.995, d = dep * Math.pow(Math.max(0, bodyHalf(t)), 0.75) * (t < 0.04 ? 0.6 + t * 10 : 1), a = p * Math.PI; return [uB + Lbody * t, -Math.sin(a) * d - 0.05 * k, Math.cos(a) * w]; });
  group.add(shadowy(new THREE.Mesh(bowl, M.ribs)));
  // neck heel where the bowl meets the neck
  const heel = grid(12, 20, (t, p) => { const a = p * Math.PI, x = uB * 0.55 + (uB + Lbody * 0.05 - uB * 0.55) * t, w = nutW * (0.52 + 0.12 * t), d = (2.6 + 3.5 * t * t) * k; return [x, -Math.sin(a) * d, Math.cos(a) * w]; });
  const neck = grid(16, 20, (t, p) => { const a = p * Math.PI, x = uB * 0.55 * t, w = nutW * (0.47 + 0.05 * t), d = 2.4 * k; return [x, -Math.sin(a) * d, Math.cos(a) * w]; });
  group.add(shadowy(new THREE.Mesh(heel, M.walnut)), shadowy(new THREE.Mesh(neck, M.walnut)));

  // soundboard with three rose openings
  const R = Math.min(bodyW * 0.24, Lbody * 0.2) * 0.86, rU = uB + Lbody * 0.36;
  const sR = R * 0.36, sU = uB + Lbody * 0.6, sV = bodyW * 0.27;
  const outline = new THREE.Shape(); const N = 64, inset = 0.25 * k;
  for (let i = 0; i <= N; i++) { const t = i / N, x = uB + Lbody * t, v = Math.max(0, half(t) - inset); i ? outline.lineTo(x, -v) : outline.moveTo(x, -v); }
  for (let i = N; i >= 0; i--) { const t = i / N; outline.lineTo(uB + Lbody * t, Math.max(0, half(t) - inset)); }
  outline.holes.push(circlePath(rU, 0, R), circlePath(sU, -sV, sR, 24), circlePath(sU, sV, sR, 24));
  const board = new THREE.Mesh(flat(outline, 0, (x, z) => [(x - uB) / Lbody, (z + bodyW / 2) / bodyW]), M.spruce);
  board.receiveShadow = true; group.add(board);
  // soundboard edge thickness (so the board reads as a plate at grazing angles)
  // binding: a bone line around the board
  const pts = []; for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector3(uB + Lbody * t, 0.05 * k, -half(t))); }
  for (let i = N - 1; i >= 1; i--) { const t = i / N; pts.push(new THREE.Vector3(uB + Lbody * t, 0.05 * k, half(t))); }
  const bind = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.32 * k, 6, true), M.binding); bind.castShadow = true; group.add(bind);
  // roses: lattice + mosaic ring + the dark inside
  const rose = (u, v, r) => {
    const lat = new THREE.Mesh(new THREE.CircleGeometry(r, 48), M.rose); lat.rotation.x = -Math.PI / 2; lat.position.set(u, -0.1 * k, v); lat.castShadow = true; group.add(lat);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r * 1.22, 64, 1), M.roseRing); ring.rotation.x = -Math.PI / 2; ring.position.set(u, 0.04 * k, v);
    const rp = ring.geometry.attributes.position, ruv = ring.geometry.attributes.uv; for (let i = 0; i < rp.count; i++) ruv.setXY(i, rp.getX(i) / (r * 2.44) + 0.5, rp.getY(i) / (r * 2.44) + 0.5);
    ring.receiveShadow = true; group.add(ring);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(r * 1.02, 32), M.hole); hole.rotation.x = -Math.PI / 2; hole.position.set(u, -dep * 0.35, v); group.add(hole);
    return lat;
  };
  rose(rU, 0, R); rose(sU, -sV, sR); rose(sU, sV, sR);
  // pickguard (a pointed walnut shield under the strings, between the small roses)
  const ub = Lneck + Lbody * 0.76;
  const pgU0 = rU + R * 1.35, pgU1 = ub - 2.2 * k, pgW = Math.min(sV - sR * 1.4, bodyW * 0.17);
  const pg = new THREE.Shape(); pg.moveTo(pgU0, 0); pg.quadraticCurveTo((pgU0 + pgU1) / 2, -pgW * 1.25, pgU1, 0); pg.quadraticCurveTo((pgU0 + pgU1) / 2, pgW * 1.25, pgU0, 0);
  const pgM = new THREE.Mesh(flat(pg, 0.06 * k, (x, z) => [(x - pgU0) / (pgU1 - pgU0), (z + pgW) / (pgW * 2)]), M.guard); pgM.receiveShadow = true; group.add(pgM);
  // bridge with a bone saddle
  const bridge = new THREE.Mesh(roundedBox(1.8 * k, 1.0 * k, bodyW * 0.42, 0.4 * k, 3), M.walnut); bridge.position.set(ub, 0.5 * k, 0); group.add(shadowy(bridge));
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.35 * k, 0.3 * k, bodyW * 0.38), M.bone); saddle.position.set(ub - 0.4 * k, 1.05 * k, 0); group.add(shadowy(saddle));

  // fingerboard: ebony, from the nut over the soundboard, tapering
  const uf = Lneck + Lbody * 0.12, w0 = nutW, w1 = nutW * 1.12, fbT = 0.5 * k;
  const fbS = new THREE.Shape(); fbS.moveTo(0, -w0 / 2); fbS.lineTo(uf, -w1 / 2); fbS.quadraticCurveTo(uf + w1 * 0.08, 0, uf, w1 / 2); fbS.lineTo(0, w0 / 2); fbS.closePath();
  const fbG = new THREE.ExtrudeGeometry(fbS, { depth: fbT, bevelEnabled: true, bevelThickness: 0.12 * k, bevelSize: 0.12 * k, bevelSegments: 2, curveSegments: 12 });
  fbG.rotateX(Math.PI / 2); fbG.translate(0, fbT, 0);
  group.add(shadowy(new THREE.Mesh(fbG, M.ebony)));
  // nut
  const nut = new THREE.Mesh(roundedBox(0.7 * k, 1.0 * k, w0 * 1.02, 0.2 * k, 2), M.bone); nut.position.set(-0.2 * k, fbT + 0.35 * k, 0); group.add(shadowy(nut));
  // pegbox: bent back about 60 degrees from the nut, cheeks with six pegs a side
  const pb = new THREE.Group(); pb.position.set(-0.5 * k, fbT * 0.5, 0); pb.rotation.z = -1.05; group.add(pb);       // rotate about z: -x end goes down
  const pbL = Math.max((o.peg - 8 * Math.min(1, k)) / 0.55, 8 * k), pbW = nutW * 0.86;      // its tip lands inside the layout's pegbox room
  const cheekG = roundedBox(pbL, 3.2 * k, 0.9 * k, 0.35 * k, 2);
  for (const s of [-1, 1]) { const ch = new THREE.Mesh(cheekG, M.walnut); ch.position.set(-pbL / 2, -1.2 * k, s * (pbW / 2 - 0.45 * k)); pb.add(shadowy(ch)); }
  const back = new THREE.Mesh(roundedBox(pbL, 0.8 * k, pbW, 0.3 * k, 2), M.walnut); back.position.set(-pbL / 2, -2.6 * k, 0); pb.add(shadowy(back));
  const tip = new THREE.Mesh(roundedBox(2.4 * k, 3.4 * k, pbW * 1.04, 0.8 * k, 3), M.walnut); tip.position.set(-pbL - 0.6 * k, -1.3 * k, 0); pb.add(shadowy(tip));
  const pegG = lathe([[0.001, 0], [0.38, 0], [0.42, 0.4], [0.32, 2.2], [0.5, 2.6], [1.15, 3.1], [1.25, 3.8], [0.95, 4.5], [0.001, 4.6]].map(([r, y]) => [r * k, y * k]), 16);
  for (let i = 0; i < 12; i++) {
    const s = i < 6 ? -1 : 1, j = i % 6, peg = new THREE.Mesh(pegG, M.peg);
    peg.position.set(-pbL * (0.12 + j * 0.15), -1.0 * k, s * (pbW / 2 - 1.2 * k)); peg.rotation.x = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    pb.add(shadowy(peg));
  }

  // strings: six courses, each a pair (the lowest pair wound), nut -> bridge
  const strings = [];
  const yNut = fbT + 0.85 * k, yBr = 1.2 * k;
  const sGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 16, true); sGeo.rotateZ(-Math.PI / 2); sGeo.translate(0.5, 0, 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < 6; i++) for (const sub of [-1, 1]) {
    const mat = (i < 2 ? M.wound : M.gut).clone();
    const uni = { uAmp: { value: 0 }, uPh: { value: i * 1.7 + sub }, uT: { value: 0 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = STRING_VS + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.z += uAmp * sin(3.14159 * position.x) * sin(uT * 70.0 + uPh) / max(0.001, modelMatrix[2][2]);');
    };
    mat.customProgramCacheKey = () => 'oudString';
    a.set(0, yNut, stringV(o, i, 0) + sub * 1.4); b.set(ub, yBr, stringV(o, i, ub) + sub * 3.0);
    dir.subVectors(b, a); const len = dir.length(); dir.normalize();
    const m = new THREE.Mesh(sGeo, mat); m.position.copy(a); m.quaternion.setFromUnitVectors(X, dir);
    const r = (i < 2 ? 0.11 : 0.08) * k; m.scale.set(len, r, r); m.castShadow = true;
    group.add(m); strings.push({ mesh: m, uni });
  }
  return { group, strings, dep, uB, ub, R, rU, k, yS: (yNut + yBr) / 2 };
}

// ---------------------------------------------------------------- the majlis around it (built once, in centimetres; scaled per view)
export function buildRoom(M) {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), M.floor); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(200, 300), M.rug); rug.rotation.x = -Math.PI / 2; rug.rotation.z = Math.PI / 2; rug.position.y = 0.3; rug.receiveShadow = true; g.add(rug);
  // fringe at the short ends of the rug
  const fr = new THREE.Mesh(new THREE.PlaneGeometry(6, 200), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 1 }));
  for (const s of [-1, 1]) { const f = fr.clone(); f.rotation.x = -Math.PI / 2; f.position.set(s * 153, 0.25, 0); f.receiveShadow = true; g.add(f); }
  // floor cushions along the far side
  const cushG = roundedBox(110, 16, 60, 7, 4);
  const cush = [[-80, -130, 0.06, M.velvet], [45, -138, -0.04, M.velvet2], [165, -120, -0.25, M.velvet]];
  for (const [x, z, ry, m] of cush) { const c = new THREE.Mesh(cushG, m); c.position.set(x, 8, z); c.rotation.y = ry; c.castShadow = c.receiveShadow = true; g.add(c); }
  const bolsterG = new THREE.CylinderGeometry(13, 13, 90, 28); bolsterG.rotateZ(Math.PI / 2);
  for (const [x, z, ry, m] of [[-60, -168, 0.05, M.velvet2], [80, -172, -0.05, M.velvet]]) { const b = new THREE.Mesh(bolsterG, m); b.position.set(x, 29, z); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; g.add(b); }
  // brass lantern on the floor: pierced body, glowing glass, a warm point light
  const lantern = new THREE.Group(); lantern.position.set(-92, 0, -46); g.add(lantern);
  const lb = lathe([[0.01, 0], [9, 0], [10, 2], [7, 4], [8, 6], [8, 26], [10, 28], [3, 36], [2, 40], [3.2, 43], [0.01, 46]], 16);
  const body = new THREE.Mesh(lb, M.brass); body.castShadow = true; lantern.add(body);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 18, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb35a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false }));
  glow.position.y = 16; lantern.add(glow);
  for (let i = 0; i < 8; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 20, 1.4), M.brass); const a = i * TAU / 8; bar.position.set(Math.cos(a) * 8, 16, Math.sin(a) * 8); lantern.add(bar); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,180,90', 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.8 }));
  halo.scale.set(90, 90, 1); halo.position.y = 16; lantern.add(halo);
  const lampLight = new THREE.PointLight(0xffa04a, 1, 0, 2); lampLight.position.y = 18; lantern.add(lampLight);
  // tea tray: brass tray, two tea glasses, a small brass pot
  const tray = new THREE.Group(); tray.position.set(62, 0, 52); g.add(tray);
  const tr = new THREE.Mesh(lathe([[0.01, 0], [22, 0], [23, 1.4], [22.4, 1.8], [21, 0.8], [0.01, 0.8]], 40), M.brass); tr.receiveShadow = tr.castShadow = true; tray.add(tr);
  const glassG = lathe([[0.01, 0], [2.6, 0], [2.4, 3], [3.1, 8], [3.4, 9.5], [3.1, 9.5], [2.8, 8], [2.1, 3], [0.01, 0.6]], 20);
  const teaG = lathe([[0.01, 0.7], [2.2, 0.7], [2.3, 3], [2.9, 7], [0.01, 7]], 20);
  for (const [x, z] of [[-8, 5], [6, 9]]) { const gl = new THREE.Mesh(glassG, M.glass); gl.position.set(x, 1, z); tray.add(gl); const te = new THREE.Mesh(teaG, M.tea); te.position.set(x, 1, z); tray.add(te); }
  const pot = new THREE.Mesh(lathe([[0.01, 0], [6, 0], [8, 4], [7, 9], [3.5, 13], [3, 17], [4.5, 19], [0.01, 20]], 24), M.brass); pot.position.set(4, 1, -9); pot.castShadow = true; tray.add(pot);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, 12, 8), M.brass); spout.position.set(-4, 10, -9); spout.rotation.z = 0.9; tray.add(spout);
  return { group: g, lantern, lampLight, glow, halo };
}

// The risha: a long, thin plectrum of dark horn (about 13 cm by 0.9 cm), tapering to a rounded tip. Built along +x, tip at the origin.
export function buildRisha(M, k) {
  const L = 13 * k, W = 0.9 * k, T = 0.16 * k;
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.2 * k, -W * 0.45, 1.6 * k, -W * 0.42); sh.lineTo(L, -W * 0.5); sh.quadraticCurveTo(L + 0.5 * k, 0, L, W * 0.5); sh.lineTo(1.6 * k, W * 0.42); sh.quadraticCurveTo(0.2 * k, W * 0.45, 0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: true, bevelThickness: T * 0.3, bevelSize: T * 0.3, bevelSegments: 1, curveSegments: 8 });
  g.rotateX(Math.PI / 2); g.translate(0, T / 2, 0);
  const m = new THREE.Mesh(g, M.horn); m.castShadow = true;
  const pivot = new THREE.Group(); pivot.add(m);
  return { pivot, mesh: m, L };
}

// Dust in the lamp light: a few slow motes (Points).
export function buildMotes(n = 90) {
  const pos = new Float32Array(n * 3), r = rng(17);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 220; pos[i * 3 + 1] = 8 + r() * 120; pos[i * 3 + 2] = (r() - 0.5) * 160; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: radialTex('255,220,170', 1), size: 2.2, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false });
  const p = new THREE.Points(g, m); p.userData.base = pos.slice();
  return p;
}

// A soft contact shadow for the oud on the rug: a blurred dark silhouette of the body and neck (u along, v across), laid flat.
export function oudShadow(o, dep) {
  const W = 512, H = 256, c = cv(W, H), x = c.getContext('2d');
  const total = o.Lneck + o.Lbody, sx = W / (total * 1.2), sy = H / (o.bodyW * 1.5), ox = total * 0.1, oy = o.bodyW * 0.75;
  x.filter = 'blur(10px)'; x.fillStyle = 'rgba(0,0,0,0.85)';
  x.beginPath(); const uB = o.Lneck - o.Lbody * 0.02;
  for (let i = 0; i <= 40; i++) { const t = i / 40; x.lineTo((uB + o.Lbody * t + ox) * sx, (oy - o.bodyW / 2 * bodyHalf(t) * 0.92) * sy); }
  for (let i = 40; i >= 0; i--) { const t = i / 40; x.lineTo((uB + o.Lbody * t + ox) * sx, (oy + o.bodyW / 2 * bodyHalf(t) * 0.92) * sy); }
  x.closePath(); x.fill();
  x.fillRect((ox - o.peg * 0.4) * sx, (oy - o.nutW * 0.4) * sy, (uB + o.peg * 0.4) * sx, o.nutW * 0.8 * sy);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(total * 1.2, o.bodyW * 1.5), new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true, depthWrite: false, opacity: 0.75 }));
  m.rotation.x = -Math.PI / 2; m.position.set(total * 0.5 + o.bodyW * 0.03, -dep + 0.2, -o.bodyW * 0.07); m.scale.set(1.05, 1.1, 1); m.renderOrder = 1;      // cast away from the key light
  return m;
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0x2c5a62, 0x1a0c06, 0.3); scene.add(hemi);
  const key = new THREE.SpotLight(0xffd29a, 1, 0, 0.55, 0.65, 0);
  key.castShadow = true; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6; key.shadow.mapSize.set(2048, 2048);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x6fd0c8, 0.5); scene.add(rim, rim.target);
  const fill = new THREE.DirectionalLight(0xffb070, 0.35); scene.add(fill, fill.target);
  return { hemi, key, rim, fill };
}
