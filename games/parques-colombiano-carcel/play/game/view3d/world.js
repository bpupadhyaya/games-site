// Parqués 3D world (units: 10 = one board square, about 3.4 cm). A lacquered cream parqués board with four coloured cárceles, a raised
// brass-rimmed corona and woven mochila borders, lying on an indigo-and-ochre mochila cloth on a terracotta-painted plank table, with a
// felt dice tray, turned wooden pawns, ivory dice, coffee beans and late afternoon sun. Everything is procedural (canvas textures and
// analytic geometry): no image files. Shared by the presenter and the icon page. Board space = the flat layout's grid (x right, z down).
import * as THREE from '../vendor3d/three.js';
import { A, R, T, SAFE_J } from '../src/rules.js';
import { trackOffset, homeOffset, jailOffset, jailSlot, rot } from '../src/layout.js';

export const SQ = 10;                         // world units per board square
export const HB = 108;                        // half size of the board slab
export const BT = 5;                          // board thickness: its playing face is at y = BT
export const R0 = BT + 0.25;                  // pieces stand here
export const SEAT = ['#f4c20d', '#2e6fd8', '#e0393e', '#22a45d'];
export const LIGHT = ['#ffe678', '#79aaf7', '#ff8a86', '#72d9a0'];
export const DARK = ['#9a7200', '#16397f', '#861820', '#0f5c32'];
export const SUN_DIR = new THREE.Vector3(-0.62, 0.74, 0.5).normalize();
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi + seed * 131, yi), b = hash(xi + 1 + seed * 131, yi), c = hash(xi + seed * 131, yi + 1), d = hash(xi + 1 + seed * 131, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, seed, oct = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i); f *= 2.03; a *= 0.5; } return s; };
const cvs = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const mixHex = (hex, to, f) => { const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16); const c = (s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f); return `rgb(${c(16)},${c(8)},${c(0)})`; };
const rr = (x, a, b, w, h, r) => { x.beginPath(); x.roundRect(a, b, w, h, r); };

// ---------------------------------------------------------------- mochila weaving (diamonds and stepped bands)
const MOCH = ['#c8302a', '#f2b705', '#1b6fb0', '#f4ead2', '#1f8a52', '#e2701c'];
function diamondRow(x, X, Y, len, h, seed, cols = MOCH) {          // a horizontal band of diamonds, centred on Y
  const n = Math.round(len / h), step = len / n, r = lcg(seed);
  for (let i = 0; i < n; i++) {
    const cx = X + (i + 0.5) * step, c = cols[(i + seed) % cols.length];
    x.fillStyle = c; x.beginPath(); x.moveTo(cx, Y - h / 2); x.lineTo(cx + step / 2, Y); x.lineTo(cx, Y + h / 2); x.lineTo(cx - step / 2, Y); x.closePath(); x.fill();
    x.fillStyle = cols[(i + seed + 3) % cols.length]; x.beginPath(); x.moveTo(cx, Y - h * 0.22); x.lineTo(cx + step * 0.22, Y); x.lineTo(cx, Y + h * 0.22); x.lineTo(cx - step * 0.22, Y); x.closePath(); x.fill();
  }
  void r;
}
function zigzagBand(x, X, Y, len, h, c1, c2) {
  x.fillStyle = c2; x.fillRect(X, Y - h / 2, len, h); x.fillStyle = c1; x.beginPath();
  const n = Math.round(len / h * 1.2), s = len / n;
  for (let i = 0; i < n; i++) { const a = X + i * s; x.moveTo(a, Y + h / 2); x.lineTo(a + s / 2, Y - h / 2); x.lineTo(a + s, Y + h / 2); }
  x.fill();
}
function grain(x, w, h, r, n, a = 0.06) { for (let i = 0; i < n; i++) { x.fillStyle = r() < 0.5 ? `rgba(255,250,230,${a})` : `rgba(90,60,30,${a})`; x.fillRect(r() * w, r() * h, 1.4, 1.4 + r() * 3); } }

// ---------------------------------------------------------------- the board texture (colour + bump), square domain [-HB, HB]^2
export function paintBoard(N = 2048) {
  const c = cvs(N), x = c.getContext('2d'), b = cvs(N), bx = b.getContext('2d'), k = N / (2 * HB), P = (w) => (w + HB) * k, r = lcg(11);
  // lacquered cream surface
  let g = x.createLinearGradient(0, 0, N, N); g.addColorStop(0, '#fff3d4'); g.addColorStop(1, '#ecdcb0'); x.fillStyle = g; x.fillRect(0, 0, N, N);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, N, N);
  for (let i = 0; i < 5200; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,240,0.14)' : 'rgba(130,90,40,0.07)'; x.fillRect(r() * N, r() * N, 1.5 * k / 4, (1 + r() * 5) * k / 4); }
  // wooden moulding (outer 4 units) and the woven mochila band
  x.fillStyle = '#5a2f17'; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 360; i++) { const yy = r() * N; x.fillStyle = r() < 0.5 ? 'rgba(255,190,120,0.10)' : 'rgba(20,6,0,0.22)'; x.fillRect(0, yy, N, 1 + r() * 2.2); }
  x.fillStyle = '#15204a'; x.fillRect(P(-104), P(-104), 208 * k, 208 * k);
  for (let s = 0; s < 4; s++) {
    x.save(); x.translate(N / 2, N / 2); x.rotate(s * Math.PI / 2); x.translate(-N / 2, -N / 2);
    x.beginPath(); x.rect(P(-104), P(-104), 208 * k, 8 * k); x.clip();
    zigzagBand(x, P(-104), P(-100), 208 * k, 7.4 * k, '#e2701c', '#15204a'); diamondRow(x, P(-104), P(-100), 208 * k, 3.4 * k, 1 + s, ['#f2b705', '#f4ead2', '#c8302a', '#1f8a52']);
    x.restore();
  }
  // the playing field
  x.fillStyle = '#fbf0cf'; rr(x, P(-96), P(-96), 192 * k, 192 * k, 8 * k); x.fill();
  g = x.createLinearGradient(0, 0, N, N); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,70,20,0.16)'); x.fillStyle = g; rr(x, P(-96), P(-96), 192 * k, 192 * k, 8 * k); x.fill();
  x.strokeStyle = '#a9752f'; x.lineWidth = 1.6 * k; rr(x, P(-96), P(-96), 192 * k, 192 * k, 8 * k); x.stroke();
  bx.strokeStyle = '#303030'; bx.lineWidth = 2.6 * k; rr(bx, P(-96), P(-96), 192 * k, 192 * k, 8 * k); bx.stroke();
  for (let i = 0; i < 4200; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,240,0.14)' : 'rgba(110,70,20,0.06)'; x.fillRect(P(-96) + r() * 192 * k, P(-96) + r() * 192 * k, 1.6, 1.6); }
  // cárceles: coloured pads with a sunken pen and four slots
  for (let a = 0; a < 4; a++) {
    const [ux, uy] = jailOffset(a), cx = P(ux * SQ), cy = P(uy * SQ), sz = 58 * k;
    g = x.createLinearGradient(cx - sz / 2, cy - sz / 2, cx + sz / 2, cy + sz / 2); g.addColorStop(0, LIGHT[a]); g.addColorStop(1, SEAT[a]);
    x.save(); x.shadowColor = 'rgba(60,30,0,0.35)'; x.shadowBlur = 8 * k; x.shadowOffsetY = 2 * k; rr(x, cx - sz / 2, cy - sz / 2, sz, sz, 10 * k); x.fillStyle = g; x.fill(); x.restore();
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 1.6 * k; rr(x, cx - sz / 2 + 3 * k, cy - sz / 2 + 3 * k, sz - 6 * k, sz - 6 * k, 8 * k); x.stroke();
    x.strokeStyle = DARK[a]; x.lineWidth = 1.4 * k; rr(x, cx - sz / 2, cy - sz / 2, sz, sz, 10 * k); x.stroke();
    const pen = 48 * k; g = x.createRadialGradient(cx, cy, 4 * k, cx, cy, pen * 0.7); g.addColorStop(0, mixHex(DARK[a], '#000000', 0.2)); g.addColorStop(1, DARK[a]);
    rr(x, cx - pen / 2, cy - pen / 2, pen, pen, 7 * k); x.fillStyle = g; x.fill();
    bx.fillStyle = '#585858'; rr(bx, cx - pen / 2, cy - pen / 2, pen, pen, 7 * k); bx.fill();
    for (let q = 0; q < 4; q++) {
      const [sx, sy] = jailSlot(a, q), px = P(sx * SQ), py = P(sy * SQ);
      x.beginPath(); x.ellipse(px, py, 5.2 * k, 5.2 * k, 0, 0, TAU); x.fillStyle = 'rgba(0,0,0,0.42)'; x.fill(); x.strokeStyle = 'rgba(255,255,255,0.3)'; x.lineWidth = 0.9 * k; x.stroke();
      bx.beginPath(); bx.arc(px, py, 5.2 * k, 0, TAU); bx.fillStyle = '#3c3c3c'; bx.fill();
    }
  }
  // the track: every square a small tile with a bevelled edge
  const cells = [];
  for (let t = 0; t < T; t++) { const [cx, cy] = trackOffset(t), a = Math.floor(t / A), j = t % A; cells.push({ x: cx, y: cy, a, kind: j === 9 ? 'salida' : SAFE_J.includes(j) ? 'seguro' : 'plain' }); }
  for (let a = 0; a < 4; a++) for (let row = 1; row <= R - 1; row++) { const [cx, cy] = homeOffset(a, row); cells.push({ x: cx, y: cy, a, kind: 'lane' }); }
  for (const cl of cells) {
    const cx = P(cl.x * SQ), cy = P(cl.y * SQ), s = SQ * k, a = cl.a;
    const fill = cl.kind === 'lane' ? mixHex(SEAT[a], '#ffffff', 0.22) : cl.kind === 'salida' ? SEAT[a] : cl.kind === 'seguro' ? '#ffeab0' : mixHex(SEAT[a], '#ffffff', 0.84);
    const stroke = cl.kind === 'lane' || cl.kind === 'salida' ? DARK[a] : cl.kind === 'seguro' ? '#b58a22' : 'rgba(110,70,30,0.6)';
    x.save(); x.shadowColor = 'rgba(70,40,10,0.35)'; x.shadowBlur = 2.2 * k; x.shadowOffsetY = 0.7 * k; rr(x, cx - s / 2 + 0.55 * k, cy - s / 2 + 0.55 * k, s - 1.1 * k, s - 1.1 * k, 1.8 * k); x.fillStyle = fill; x.fill(); x.restore();
    x.lineWidth = 0.55 * k; x.strokeStyle = stroke; x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(cx - s / 2 + 1.2 * k, cy - s / 2 + 0.9 * k, s - 2.4 * k, 0.8 * k);
    bx.fillStyle = '#9a9a9a'; rr(bx, cx - s / 2 + 0.7 * k, cy - s / 2 + 0.7 * k, s - 1.4 * k, s - 1.4 * k, 1.8 * k); bx.fill();
    bx.strokeStyle = '#484848'; bx.lineWidth = 0.9 * k; bx.stroke();
    if (cl.kind === 'salida') { star(x, cx, cy, s * 0.34, '#fffbe8', DARK[a], k); }
    else if (cl.kind === 'seguro') { x.beginPath(); x.arc(cx, cy, s * 0.33, 0, TAU); x.fillStyle = '#d6a033'; x.fill(); star(x, cx, cy, s * 0.22, '#fff6d0', '#8a5a10', k); }
    else if (cl.kind === 'lane') { x.save(); x.translate(cx, cy); x.rotate(-a * Math.PI / 2 + Math.PI); x.beginPath(); x.moveTo(-s * 0.22, s * 0.1); x.lineTo(0, -s * 0.16); x.lineTo(s * 0.22, s * 0.1); x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 0.9 * k; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke(); x.restore(); }
  }
  // the centre: a four-colour pinwheel under the raised corona
  const c0 = P(0), ce = 16 * k;
  for (let a = 0; a < 4; a++) {
    const [x1, y1] = rot(-1.5, 1.5, a), [x2, y2] = rot(1.5, 1.5, a);
    g = x.createLinearGradient(c0, c0, P((x1 + x2) / 2 * SQ), P((y1 + y2) / 2 * SQ)); g.addColorStop(0, LIGHT[a]); g.addColorStop(1, SEAT[a]);
    x.beginPath(); x.moveTo(c0, c0); x.lineTo(P(x1 * SQ), P(y1 * SQ)); x.lineTo(P(x2 * SQ), P(y2 * SQ)); x.closePath(); x.fillStyle = g; x.fill();
  }
  x.strokeStyle = '#8a5a10'; x.lineWidth = 1.2 * k; x.strokeRect(c0 - ce, c0 - ce, ce * 2, ce * 2);
  // faint scuffs and fibres
  for (let i = 0; i < 40; i++) { x.strokeStyle = 'rgba(120,80,30,0.05)'; x.lineWidth = 0.4 * k; x.beginPath(); const sx = r() * N, sy = r() * N; x.moveTo(sx, sy); x.lineTo(sx + (r() - 0.5) * 120, sy + (r() - 0.5) * 120); x.stroke(); }
  const map = tex(c), bump = tex(b, false); map.anisotropy = 8;
  return { map, bump };
}
function star(x, cx, cy, rad, fill, stroke, k) {
  x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? rad * 0.42 : rad; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath();
  x.fillStyle = fill; x.fill(); x.strokeStyle = stroke; x.lineWidth = 0.6 * k; x.stroke();
}

// the board: slab with the painted top, a raised wooden rim, brass seguro studs, the corona, four cárcel fences
export function buildBoard(texSize = 2048) {
  const g = new THREE.Group(), tx = paintBoard(texSize);
  const top = new THREE.MeshPhysicalMaterial({ map: tx.map, bumpMap: tx.bump, bumpScale: 1.6, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.35, envMapIntensity: 0.55 });
  const side = new THREE.MeshStandardMaterial({ color: 0x5a2f17, roughness: 0.6 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2 * HB, BT, 2 * HB), [side, side, top, side, side, side]); slab.position.y = BT / 2; slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b3a1c, roughness: 0.5, envMapIntensity: 0.5 });
  const rim = (w, d, px, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.5, d), wood); m.position.set(px, BT + 0.75, pz); m.castShadow = true; m.receiveShadow = true; g.add(m); };
  rim(2 * HB, 4, 0, -HB + 2); rim(2 * HB, 4, 0, HB - 2); rim(4, 2 * HB - 8, -HB + 2, 0); rim(4, 2 * HB - 8, HB - 2, 0);
  // brass studs on the seguros
  const brass = new THREE.MeshStandardMaterial({ color: 0xe0b04a, metalness: 0.85, roughness: 0.28, envMapIntensity: 1.2 });
  const stud = new THREE.CylinderGeometry(2.7, 3.1, 0.9, 28), dome = new THREE.SphereGeometry(1.5, 16, 8, 0, TAU, 0, Math.PI / 2);
  for (let t = 0; t < T; t++) if (SAFE_J.includes(t % A) && t % A !== 9) {
    const [cx, cy] = trackOffset(t); const s = new THREE.Mesh(stud, brass); s.position.set(cx * SQ, BT + 0.45, cy * SQ); s.castShadow = true; g.add(s);
    const d = new THREE.Mesh(dome, brass); d.position.set(cx * SQ, BT + 0.9, cy * SQ); g.add(d);
  }
  // the corona: a low four-faced pyramid in the seat colours with a gold ring and crown
  const pos = [], col = [], c = new THREE.Color(), H = 3.2, h2 = 15;
  for (let a = 0; a < 4; a++) {
    const [x1, y1] = rot(-1.5, 1.5, a), [x2, y2] = rot(1.5, 1.5, a);
    pos.push(0, BT + H, 0, x1 * SQ, BT + 0.05, y1 * SQ, x2 * SQ, BT + 0.05, y2 * SQ); for (let i = 0; i < 3; i++) { c.set(i ? SEAT[a] : LIGHT[a]); col.push(c.r, c.g, c.b); }
  }
  void h2;
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); pg.computeVertexNormals();
  const py = new THREE.Mesh(pg, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, side: THREE.DoubleSide })); py.castShadow = true; py.receiveShadow = true; g.add(py);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.7, 10, 40), brass); ring.rotation.x = Math.PI / 2; ring.position.y = BT + H + 0.1; ring.castShadow = true; g.add(ring);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5, 0.9, 40), new THREE.MeshStandardMaterial({ map: crownTex(), roughness: 0.4, metalness: 0.2 })); crown.position.y = BT + H + 0.2; crown.castShadow = true; g.add(crown);
  // cárcel fences: a low brass rail round each pen, posts every few units
  const post = new THREE.CylinderGeometry(0.62, 0.7, 7.4, 10), railG = new THREE.CylinderGeometry(0.42, 0.42, 1, 8);
  const steel = new THREE.MeshStandardMaterial({ color: 0xe9eef6, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.3 });
  const fences = [];
  for (let a = 0; a < 4; a++) {
    const [ux, uy] = jailOffset(a), cx = ux * SQ, cz = uy * SQ, hw = 24, grp = new THREE.Group();
    const n = 7, sp = (2 * hw) / (n - 1);
    for (let i = 0; i < n; i++) for (const [ax, az] of [[-hw + i * sp, -hw], [-hw + i * sp, hw], [-hw, -hw + i * sp], [hw, -hw + i * sp]]) {
      if (i > 0 && i < n - 1 || true) { const p = new THREE.Mesh(post, steel); p.position.set(cx + ax, BT + 3.7, cz + az); p.castShadow = true; grp.add(p); }
    }
    for (const [px, pz, len, ry] of [[0, -hw, 2 * hw, Math.PI / 2], [0, hw, 2 * hw, Math.PI / 2], [-hw, 0, 2 * hw, 0], [hw, 0, 2 * hw, 0]]) {
      for (const yy of [7.1, 3.4]) { const rl = new THREE.Mesh(railG, steel); rl.scale.set(1, len, 1); if (ry) rl.rotation.z = Math.PI / 2; else rl.rotation.x = Math.PI / 2; rl.position.set(cx + px, BT + yy, cz + pz); rl.castShadow = yy > 5; grp.add(rl); }
    }
    g.add(grp); fences.push(grp);
  }
  // a dim cover for the cárceles of seats that are not playing
  const dim = []; for (let a = 0; a < 4; a++) { const [ux, uy] = jailOffset(a); const m = new THREE.Mesh(new THREE.PlaneGeometry(57, 57), new THREE.MeshBasicMaterial({ color: 0x1a0f08, transparent: true, opacity: 0.62, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(ux * SQ, BT + 0.05, uy * SQ); m.visible = false; g.add(m); dim.push(m); }
  return { group: g, fences, dim };
}
function crownTex() {
  const c = cvs(256), x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 10, 128, 128, 128); g.addColorStop(0, '#fff7de'); g.addColorStop(1, '#f0d890'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.translate(128, 128); x.fillStyle = '#e3b43c'; x.strokeStyle = '#8a5a10'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(-70, 40); x.lineTo(-76, -34); x.lineTo(-38, 0); x.lineTo(0, -54); x.lineTo(38, 0); x.lineTo(76, -34); x.lineTo(70, 40); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#c8302a'; x.beginPath(); x.arc(0, 8, 11, 0, TAU); x.fill(); x.stroke();
  const t = tex(c); t.center.set(0.5, 0.5); return t;
}

// ---------------------------------------------------------------- pawns
const EMBLEM = [
  () => new THREE.CylinderGeometry(1.5, 1.5, 0.55, 24),
  () => { const g = new THREE.BoxGeometry(2.5, 0.55, 2.5); g.rotateY(Math.PI / 4); return g; },
  () => new THREE.CylinderGeometry(1.8, 1.8, 0.55, 3),
  () => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? 0.95 : 2.2; i ? s.lineTo(Math.cos(a) * q, Math.sin(a) * q) : s.moveTo(Math.cos(a) * q, Math.sin(a) * q); } const g = new THREE.ExtrudeGeometry(s, { depth: 0.55, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; },
];
const PIECE_H = 14.6;
export function pawnKit() {
  const pts = [[0, 0], [4.1, 0], [4.25, 0.55], [3.95, 1.4], [3.1, 2.3], [2.3, 4.2], [1.85, 6.6], [2.6, 7.4], [2.55, 8.2], [1.7, 8.8], [0, 8.9]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.LatheGeometry(pts, 36), head = new THREE.SphereGeometry(3.1, 28, 18), ring = new THREE.TorusGeometry(2.6, 0.5, 8, 28);
  const mats = [], gold = new THREE.MeshStandardMaterial({ color: 0xe0b04a, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.1 }), cream = new THREE.MeshStandardMaterial({ color: 0xfff3d0, roughness: 0.4 });
  const groups = [], ghosts = [];
  for (let a = 0; a < 4; a++) {
    const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(SEAT[a]).multiplyScalar(0.92), roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.15, envMapIntensity: 0.9 }); mats.push(m);
    const make = (ghost) => {
      const grp = new THREE.Group(), mm = ghost ? m.clone() : m, gg = ghost ? gold.clone() : gold, cc = ghost ? cream.clone() : cream;
      if (ghost) for (const q of [mm, gg, cc]) { q.transparent = true; q.opacity = 0.5; q.depthWrite = false; }
      const b = new THREE.Mesh(body, mm), h = new THREE.Mesh(head, mm), r = new THREE.Mesh(ring, gg), e = new THREE.Mesh(EMBLEM[a](), cc);
      h.position.y = 11.5; r.rotation.x = Math.PI / 2; r.position.y = 7.4; e.position.y = 11.5 + 3.0;
      for (const o of [b, h, r, e]) { o.castShadow = !ghost; o.receiveShadow = true; grp.add(o); }
      grp.userData.mats = [mm, gg, cc]; return grp;
    };
    groups.push(make(false)); ghosts.push(make(true));
  }
  return { make: (a, ghost) => (ghost ? ghosts[a] : groups[a]).clone(true), mats, H: PIECE_H, tints: null };
}

// ---------------------------------------------------------------- dice: rounded ivory cubes with pips
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function dieFace(n) {
  const c = cvs(128), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, '#fffdf4'); g.addColorStop(1, '#eadfc2'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 200; i++) { x.fillStyle = `rgba(120,90,40,${0.02 + Math.random() * 0.03})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  for (const [px, py] of PIPS[n]) {
    const cx = 64 + px * 30, cy = 64 + py * 30, rad = n === 1 ? 17 : 11;
    const gg = x.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, rad); gg.addColorStop(0, n === 1 ? '#e04a4c' : '#3a4a70'); gg.addColorStop(1, n === 1 ? '#a01c20' : '#10192e');
    x.beginPath(); x.arc(cx, cy, rad, 0, TAU); x.fillStyle = gg; x.fill();
  }
  return tex(c);
}
export function dieKit() {
  const geo = new THREE.BoxGeometry(1, 1, 1, 7, 7, 7), pa = geo.attributes.position, rad = 0.13, inner = 0.5 - rad, v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    v.fromBufferAttribute(pa, i); const q = new THREE.Vector3(Math.max(-inner, Math.min(inner, v.x)), Math.max(-inner, Math.min(inner, v.y)), Math.max(-inner, Math.min(inner, v.z)));
    n.copy(v).sub(q); if (n.lengthSq() > 1e-9) { n.normalize(); v.copy(q).addScaledVector(n, rad); pa.setXYZ(i, v.x, v.y, v.z); }
  }
  geo.computeVertexNormals();
  // +x 3, -x 4, +y 1, -y 6, +z 2, -z 5 (opposite faces sum to 7)
  const order = [3, 4, 1, 6, 2, 5];
  const mats = order.map((f) => new THREE.MeshPhysicalMaterial({ map: dieFace(f), roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.7 }));
  return { geo, mats };
}
const QF = (() => { const e = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)); return { 1: e(0, 0, 0), 6: e(Math.PI, 0, 0), 3: e(0, 0, Math.PI / 2), 4: e(0, 0, -Math.PI / 2), 2: e(-Math.PI / 2, 0, 0), 5: e(Math.PI / 2, 0, 0) }; })();
export const faceQuat = (f) => QF[f] || QF[1];

// ---------------------------------------------------------------- tray (wood + felt), table, cloth
function paintFelt(w = 768, h = 512) {
  const c = cvs(w, h), x = c.getContext('2d'), r = lcg(5), g = x.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, w * 0.6); g.addColorStop(0, '#2c8a58'); g.addColorStop(1, '#0f4a30'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 7000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,30,10,0.14)'; x.fillRect(r() * w, r() * h, 1.6, 1.6); }
  x.strokeStyle = 'rgba(255,225,150,0.4)'; x.lineWidth = 3; rr(x, 22, 22, w - 44, h - 44, 18); x.stroke();
  x.save(); x.beginPath(); x.rect(0, 0, w, 16); x.rect(0, h - 16, w, 16); x.clip(); zigzagBand(x, 0, 8, w, 14, '#e2701c', '#15204a'); zigzagBand(x, 0, h - 8, w, 14, '#e2701c', '#15204a'); x.restore();
  return tex(c);
}
export function buildTray() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4624, roughness: 0.5, envMapIntensity: 0.5 }), felt = new THREE.MeshStandardMaterial({ map: paintFelt(), roughness: 0.96, envMapIntensity: 0.15 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), wood); base.receiveShadow = true; base.castShadow = true; g.add(base);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), felt); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; g.add(fl);
  const rims = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wood); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; });
  const RW = 3.2, RH = 3.4;
  g.userData.fit = (cx, cz, w, d) => {     // inner felt size w x d (world), centred at cx, cz; sits on the table (y = 0)
    base.scale.set(w + 2 * RW, 1, d + 2 * RW); base.position.set(cx, 1, cz);
    fl.scale.set(w, d, 1); fl.position.set(cx, 2.05, cz);
    rims[0].scale.set(w + 2 * RW, RH, RW); rims[0].position.set(cx, RH / 2 + 1, cz - d / 2 - RW / 2);
    rims[1].scale.set(w + 2 * RW, RH, RW); rims[1].position.set(cx, RH / 2 + 1, cz + d / 2 + RW / 2);
    rims[2].scale.set(RW, RH, d); rims[2].position.set(cx - w / 2 - RW / 2, RH / 2 + 1, cz);
    rims[3].scale.set(RW, RH, d); rims[3].position.set(cx + w / 2 + RW / 2, RH / 2 + 1, cz);
  };
  g.userData.top = 2.05;
  return g;
}
function paintTable(N = 1024) {
  const c = cvs(N), x = c.getContext('2d'), r = lcg(21), planks = 10, ph = N / planks;
  for (let i = 0; i < planks; i++) {
    const tone = 0.85 + r() * 0.3; x.fillStyle = `rgb(${Math.round(150 * tone)},${Math.round(72 * tone)},${Math.round(40 * tone)})`; x.fillRect(0, i * ph, N, ph);
    for (let j = 0; j < 70; j++) { const yy = i * ph + r() * ph, l = 60 + r() * 500, xx = r() * N; x.fillStyle = r() < 0.5 ? 'rgba(255,200,140,0.07)' : 'rgba(40,14,4,0.12)'; x.fillRect(xx, yy, l, 1 + r() * 1.6); }
    // worn paint showing the wood beneath
    for (let j = 0; j < 16; j++) { const xx = r() * N, yy = i * ph + r() * ph; x.fillStyle = 'rgba(176,128,76,0.22)'; x.beginPath(); x.ellipse(xx, yy, 14 + r() * 50, 2 + r() * 5, 0, 0, TAU); x.fill(); }
    x.fillStyle = 'rgba(25,8,2,0.7)'; x.fillRect(0, i * ph, N, 2.5);
    for (let nx = 0; nx < 2; nx++) { const xx = 60 + r() * (N - 120); x.fillStyle = 'rgba(40,20,10,0.55)'; x.beginPath(); x.arc(xx, i * ph + ph * 0.5, 3, 0, TAU); x.fill(); }
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4.5, 4.5); return t;
}
function paintCloth(W = 1536, H = 1536) {
  const c = cvs(W, H), x = c.getContext('2d'), r = lcg(33); x.fillStyle = '#16183a'; x.fillRect(0, 0, W, H);
  const F = 70;                                                   // fringe at left and right ends
  x.fillStyle = '#16183a'; x.fillRect(F, 0, W - 2 * F, H);
  // concentric woven bands
  const inset = (i) => F + i * 52;
  const bands = [[0, '#c8302a'], [1, '#f2b705'], [2, '#f4ead2']];
  void bands;
  for (let s = 0; s < 4; s++) {
    x.save(); x.translate(W / 2, H / 2); x.rotate(s * Math.PI / 2); x.translate(-W / 2, -H / 2);
    const L = s % 2 ? H : W, off = s % 2 ? (W - H) / 2 : 0; void off;
    x.beginPath(); x.rect(0, 0, W, 190); x.clip();
    zigzagBand(x, 0, 40, W, 40, '#c8302a', '#16183a'); diamondRow(x, 0, 104, W, 56, 3 + s); zigzagBand(x, 0, 168, W, 34, '#f2b705', '#16183a'); void L;
    x.restore();
  }
  x.fillStyle = '#16183a'; x.fillRect(200, 200, W - 400, H - 400);
  // central field: tiled rhombus motifs
  const cell = 128;
  for (let gy = 0; gy < Math.ceil((H - 400) / cell); gy++) for (let gx = 0; gx < Math.ceil((W - 400) / cell); gx++) {
    const cx = 200 + gx * cell + cell / 2, cy = 200 + gy * cell + cell / 2, ci = (gx + gy) % 2 ? MOCH[(gx * 3 + gy) % 6] : MOCH[(gx + gy * 2 + 2) % 6];
    x.fillStyle = ci; x.beginPath(); x.moveTo(cx, cy - 46); x.lineTo(cx + 46, cy); x.lineTo(cx, cy + 46); x.lineTo(cx - 46, cy); x.closePath(); x.fill();
    x.fillStyle = '#16183a'; x.beginPath(); x.moveTo(cx, cy - 22); x.lineTo(cx + 22, cy); x.lineTo(cx, cy + 22); x.lineTo(cx - 22, cy); x.closePath(); x.fill();
    x.fillStyle = MOCH[(gx + gy + 4) % 6]; x.fillRect(cx - 7, cy - 7, 14, 14);
  }
  // weave texture: fine horizontal and vertical threads
  for (let i = 0; i < H; i += 3) { x.fillStyle = `rgba(0,0,0,${0.05 + (i % 6 ? 0 : 0.05)})`; x.fillRect(0, i, W, 1); }
  for (let i = 0; i < W; i += 3) { x.fillStyle = 'rgba(255,255,255,0.025)'; x.fillRect(i, 0, 1, H); }
  for (let i = 0; i < 9000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * W, r() * H, 2, 2); }
  // fringe tassels, left and right
  for (let i = 0; i < H; i += 5) for (const [x0, dir] of [[F, -1], [W - F, 1]]) { x.strokeStyle = ['#c8302a', '#f2b705', '#f4ead2', '#16183a'][(i / 5) % 4 | 0]; x.lineWidth = 3; x.beginPath(); x.moveTo(x0, i + 2); x.lineTo(x0 + dir * (F - 6 + r() * 6), i + 2 + (r() - 0.5) * 3); x.stroke(); }
  return tex(c);
}
export function buildTable(scene, { quality = 1 } = {}) {
  const g = new THREE.Group(); scene.add(g);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), new THREE.MeshStandardMaterial({ map: paintTable(1024), roughness: 0.72, envMapIntensity: 0.3 }));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; g.add(table);
  // a pool of light: the table falls into warm shade toward the edges
  { const pc = cvs(256), px = pc.getContext('2d'), gr = px.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(12,5,2,0)'); gr.addColorStop(0.4, 'rgba(12,5,2,0)'); gr.addColorStop(0.7, 'rgba(12,5,2,0.4)'); gr.addColorStop(1, 'rgba(12,5,2,0.78)'); px.fillStyle = gr; px.fillRect(0, 0, 256, 256);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: tex(pc), transparent: true, depthWrite: false, fog: false })); pool.rotation.x = -Math.PI / 2; pool.position.y = 9; pool.renderOrder = 2; g.add(pool); }
  // mochila cloth under the board, a little rumpled
  const kw = 284, kd = 284, cg = new THREE.PlaneGeometry(kw, kd, 110, 110); cg.rotateX(-Math.PI / 2);
  const cp = cg.attributes.position; for (let i = 0; i < cp.count; i++) { const px = cp.getX(i), pz = cp.getZ(i), e = Math.min(kw / 2 - Math.abs(px), kd / 2 - Math.abs(pz)); cp.setY(i, 0.25 + fbm(px * 0.05, pz * 0.05, 3, 3) * 0.7 * Math.min(1, e / 12)); }
  cg.computeVertexNormals();
  const cloth = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: paintCloth(), roughness: 0.95, envMapIntensity: 0.2 })); cloth.receiveShadow = true; g.add(cloth);
  // coffee beans on the table
  const bean = new THREE.SphereGeometry(1, 12, 8); bean.scale(0.95, 0.62, 1.4);
  const N = 46, beans = new THREE.InstancedMesh(bean, new THREE.MeshStandardMaterial({ color: 0x4b2a16, roughness: 0.45, envMapIntensity: 0.5 }), N), r = lcg(8), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < N; i++) {
    const a = r() * TAU, d = 168 + r() * 70, x0 = Math.cos(a) * d + (r() - 0.5) * 20, z0 = Math.sin(a) * d + (r() - 0.5) * 20, s = 2.6 + r() * 0.8;
    e.set((r() - 0.5) * 0.3, r() * TAU, (r() - 0.5) * 0.3); q.setFromEuler(e); beans.setMatrixAt(i, m.compose(new THREE.Vector3(x0, s * 0.55, z0), q, new THREE.Vector3(s, s, s)));
  }
  beans.castShadow = quality > 0; beans.receiveShadow = true; g.add(beans);
  // dust motes drifting in the sun
  const ND = 90, pg = new THREE.BufferGeometry(), pa = new Float32Array(ND * 3), rr2 = lcg(77);
  for (let i = 0; i < ND; i++) { pa[i * 3] = (rr2() - 0.5) * 300; pa[i * 3 + 1] = 6 + rr2() * 110; pa[i * 3 + 2] = (rr2() - 0.5) * 260; }
  pg.setAttribute('position', new THREE.BufferAttribute(pa, 3));
  const sp = cvs(64), sx = sp.getContext('2d'), sg = sx.createRadialGradient(32, 32, 0, 32, 32, 32); sg.addColorStop(0, 'rgba(255,230,180,0.9)'); sg.addColorStop(1, 'rgba(255,200,120,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 64, 64);
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ size: 1.4, map: new THREE.CanvasTexture(sp), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, fog: false }));
  dust.frustumCulled = false; g.add(dust);
  return { group: g, dust, cloth };
}

// Late afternoon sun, sky fill, warm bounce from the terracotta table, a cool rim from behind.
export function buildLights(scene) {
  const sun = new THREE.DirectionalLight(0xffc690, 3.0); sun.position.copy(SUN_DIR).multiplyScalar(260); sun.target.position.set(0, 0, 0);
  Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 60, far: 620 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.35; sun.shadow.radius = 2.2;
  const hemi = new THREE.HemisphereLight(0xa9b6d8, 0x9a5a38, 0.6);
  const fill = new THREE.DirectionalLight(0xffd8b0, 0.45); fill.position.set(80, 140, 220);
  const rim = new THREE.DirectionalLight(0x9ab4ff, 0.5); rim.position.set(60, 90, -240);
  scene.add(sun, sun.target, hemi, fill, rim);
  return { sun, hemi, fill, rim };
}
export function radialTex(rgb = '0,0,0', a = 1, inner = 0) {
  const c = cvs(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 64 * inner, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${inner ? 0 : a})`); if (inner) g.addColorStop(Math.min(0.95, inner + 0.12), `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}
