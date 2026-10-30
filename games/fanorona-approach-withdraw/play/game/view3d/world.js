// Fanorona 3D world (presentation only; no game logic). Units are centimetres, y up.
// A carved rosewood Fanorona board lying on a woven raffia mat on red Malagasy earth, baobabs against a low sunset. The stones are turned
// (lathe) and inlaid. Board frame in the world: x = the nine columns, z = the five rows (row 4 far, row 0 near), i.e. the "horizontal"
// layout; the vertical layout is the same board turned a quarter (the presenter rotates it), the camera never turns.
import * as THREE from '../vendor3d/three.js';
import { SEGMENTS, ROWS, COLS, isStrong, rowOf, colOf } from '../src/rules.js';
import { lcg } from '../src/art.js';

export const SP = 10;                                       // distance between neighbouring points
export const FIELD_W = (COLS - 1) * SP + 16, FIELD_L = (ROWS - 1) * SP + 16, FRAME = 4.6;
export const BOARD_W = FIELD_W + 2 * FRAME, BOARD_L = FIELD_L + 2 * FRAME;
export const MAT_Y = 0.9, SLAB_H = 4.0, TOP = MAT_Y + SLAB_H + 0.5;   // TOP = the playing field
export const STONE_RAD = 3.5, STONE_H = 2.0;
export const pointW = (p) => ({ x: (colOf(p) - 4) * SP, z: (2 - rowOf(p)) * SP });
const TAU = Math.PI * 2;
export const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const texOf = (c, srgb = true, rep = null) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

// ------------------------------------------------------------------------------------------ textures
export function radialTex(rgb, a = 1, size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.5})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return texOf(c);
}
export function ringTex(size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.62, 'rgba(255,255,255,0.08)'); g.addColorStop(0.78, 'rgba(255,255,255,1)'); g.addColorStop(0.88, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size); return texOf(c);
}
function grain(x, w, h, c0, c1, seed, lines, horizontal = true) {
  const r = lcg(seed); x.fillStyle = c0; x.fillRect(0, 0, w, h);
  for (let i = 0; i < lines; i++) {
    const p = r() * (horizontal ? h : w), amp = 2 + r() * 9, f = 0.002 + r() * 0.008, ph = r() * TAU;
    x.strokeStyle = r() < 0.55 ? c1 : 'rgba(0,0,0,0.2)'; x.globalAlpha = 0.07 + r() * 0.2; x.lineWidth = 0.6 + r() * 2.6; x.beginPath();
    for (let t = 0; t <= (horizontal ? w : h); t += 10) { const o = p + Math.sin(t * f + ph) * amp + Math.sin(t * f * 3.3 + ph) * amp * 0.3; if (horizontal) x.lineTo(t, o); else x.lineTo(o, t); }
    x.stroke();
  }
  x.globalAlpha = 1;
}
// the playing field: wood with carved lines (dark bed, a light lip), the 45 dished points and a double border with small diamonds
function fieldCanvas(T, px) {
  const k = px / FIELD_W, w = px, h = Math.round(FIELD_L * k), c = cv(w, h), x = c.getContext('2d'), b = cv(w, h), bx = b.getContext('2d');
  grain(x, w, h, T.plate[1], T.sheen, 17, 300);
  const sh = x.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w * 0.62); sh.addColorStop(0, 'rgba(255,225,170,0.16)'); sh.addColorStop(1, 'rgba(20,6,0,0.34)'); x.fillStyle = sh; x.fillRect(0, 0, w, h);
  bx.fillStyle = '#c0c0c0'; bx.fillRect(0, 0, w, h);
  const P = (p) => { const q = pointW(p); return [(q.x + FIELD_W / 2) * k, (q.z + FIELD_L / 2) * k]; };
  [2.3, 3.4].forEach((m, i) => { x.strokeStyle = T.line; x.globalAlpha = i ? 0.55 : 0.85; x.lineWidth = (i ? 0.16 : 0.26) * k; x.strokeRect(m * k, m * k, w - 2 * m * k, h - 2 * m * k); bx.strokeStyle = '#2a2a2a'; bx.lineWidth = 0.3 * k; bx.strokeRect(m * k, m * k, w - 2 * m * k, h - 2 * m * k); });
  x.globalAlpha = 1;
  const dia = (cx, cy, s) => { x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4); x.fillStyle = T.inlay[0]; x.globalAlpha = 0.8; x.fillRect(-s, -s, 2 * s, 2 * s); x.restore(); bx.save(); bx.translate(cx, cy); bx.rotate(Math.PI / 4); bx.fillStyle = '#202020'; bx.fillRect(-s, -s, 2 * s, 2 * s); bx.restore(); };
  for (const [cx, cy] of [[2.85, 2.85], [FIELD_W - 2.85, 2.85], [2.85, FIELD_L - 2.85], [FIELD_W - 2.85, FIELD_L - 2.85], [FIELD_W / 2, 2.85], [FIELD_W / 2, FIELD_L - 2.85]]) dia(cx * k, cy * k, 0.52 * k);
  x.lineCap = bx.lineCap = 'round';
  for (const [a, bb] of SEGMENTS) {
    const [x0, y0] = P(a), [x1, y1] = P(bb);
    x.strokeStyle = T.lineHi; x.lineWidth = 0.62 * k; x.beginPath(); x.moveTo(x0, y0 - 0.1 * k); x.lineTo(x1, y1 - 0.1 * k); x.stroke();
    x.strokeStyle = T.line; x.lineWidth = 0.4 * k; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
    bx.strokeStyle = '#303030'; bx.lineWidth = 0.55 * k; bx.beginPath(); bx.moveTo(x0, y0); bx.lineTo(x1, y1); bx.stroke();
  }
  for (let p = 0; p < ROWS * COLS; p++) {
    const [px0, py0] = P(p), r = (isStrong(p) ? 1.35 : 1.05) * k;
    const g = x.createRadialGradient(px0, py0 - r * 0.2, r * 0.1, px0, py0, r); g.addColorStop(0, 'rgba(30,10,2,0.62)'); g.addColorStop(0.78, 'rgba(60,24,6,0.35)'); g.addColorStop(0.94, T.dotRing); g.addColorStop(1, 'rgba(20,6,0,0.5)');
    x.fillStyle = g; x.beginPath(); x.arc(px0, py0, r, 0, TAU); x.fill();
    if (isStrong(p)) { x.fillStyle = T.dot; x.globalAlpha = 0.85; x.beginPath(); x.arc(px0, py0, 0.34 * k, 0, TAU); x.fill(); x.globalAlpha = 1; }
    const gb = bx.createRadialGradient(px0, py0, 0, px0, py0, r); gb.addColorStop(0, '#585858'); gb.addColorStop(0.85, '#8c8c8c'); gb.addColorStop(1, '#c0c0c0'); bx.fillStyle = gb; bx.beginPath(); bx.arc(px0, py0, r, 0, TAU); bx.fill();
  }
  return { map: texOf(c), bump: texOf(b, false) };
}
function frameCanvas(T) {
  const c = cv(512), x = c.getContext('2d'); grain(x, 512, 512, T.frame[1], T.sheen, 9, 160); return texOf(c, true, [1 / 55, 1 / 55]);
}
function matCanvas(W, H) {
  // a woven raffia mat: fine ochre weave (plain weave: strands over / under) with a dark red geometric border
  const k = 8, w = Math.round(W * k), h = Math.round(H * k), c = cv(w, h), x = c.getContext('2d'), r = lcg(21);
  x.fillStyle = '#9a6a38'; x.fillRect(0, 0, w, h);
  const cell = 9;                                                      // ~1.1 cm strands
  for (let j = 0; j < h; j += cell) for (let i = 0; i < w; i += cell) {
    const over = (((i / cell) + (j / cell)) & 1) === 0, hue = 32 + r() * 5, l = 40 + r() * 11;
    const g = over ? x.createLinearGradient(i, j, i + cell, j) : x.createLinearGradient(i, j, i, j + cell);
    g.addColorStop(0, `hsl(${hue},46%,${l - 9}%)`); g.addColorStop(0.5, `hsl(${hue},48%,${l + 7}%)`); g.addColorStop(1, `hsl(${hue},44%,${l - 12}%)`);
    x.fillStyle = g; x.fillRect(i + 0.6, j + 0.6, cell - 1.2, cell - 1.2);
  }
  const band = (m, wd, col) => { x.strokeStyle = col; x.lineWidth = wd; x.strokeRect(m, m, w - 2 * m, h - 2 * m); };
  band(h * 0.05, h * 0.045, '#5a1a14'); band(h * 0.118, h * 0.016, '#e8c27a');
  x.fillStyle = '#5a1a14'; const m = h * 0.0865, d = (px, py) => { x.save(); x.translate(px, py); x.rotate(Math.PI / 4); x.fillRect(-9, -9, 18, 18); x.restore(); };
  for (let i = m * 2; i < w - m * 2; i += 52) { d(i, m); d(i, h - m); }
  for (let j = m * 2; j < h - m * 2; j += 52) { d(m, j); d(w - m, j); }
  const t = texOf(c); t.anisotropy = 16; return t;
}
function earthCanvas() {
  // seamless red earth: every blob is drawn at the nine wrapped offsets so the tile edges never show
  const s = 512, c = cv(s), x = c.getContext('2d'), r = lcg(77); x.fillStyle = '#8c3b1f'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 140; i++) {
    const bx = r() * s, by = r() * s, rad = 10 + r() * 50; x.fillStyle = r() < 0.5 ? 'rgba(60,16,6,0.07)' : 'rgba(255,170,100,0.045)';
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { x.beginPath(); x.arc(bx + ox, by + oy, rad, 0, TAU); x.fill(); }
  }
  for (let i = 0; i < 1800; i++) { x.fillStyle = r() < 0.5 ? 'rgba(40,10,2,0.3)' : 'rgba(255,200,140,0.2)'; x.fillRect(r() * s, r() * s, 1 + r() * 2.5, 1 + r() * 2); }
  return texOf(c, true, [60, 60]);
}
function skyCanvas() {
  const c = cv(4, 1024), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, '#1d0a2c'); g.addColorStop(0.3, '#5a1c3c'); g.addColorStop(0.43, '#b0432f'); g.addColorStop(0.485, '#f08a3a'); g.addColorStop(0.5, '#ffc062'); g.addColorStop(0.505, '#7a3020'); g.addColorStop(1, '#3a1410');
  x.fillStyle = g; x.fillRect(0, 0, 4, 1024); return texOf(c);
}
// a high-resolution strip of baobab silhouettes standing on the horizon (a flat backdrop far behind the board)
function horizonCanvas() {
  const w = 2048, h = 512, c = cv(w, h), x = c.getContext('2d'), hz = h - 4;
  const tree = (cx, ht, col, lean) => {                                       // swollen bottle trunk, flat crown of thick branches
    const tw = ht * 0.2; x.fillStyle = col; x.beginPath(); x.moveTo(cx - tw * 1.3, hz + 2); x.bezierCurveTo(cx - tw * 1.0, hz - ht * 0.3, cx - tw * 0.8, hz - ht * 0.6, cx - tw * 0.35, hz - ht * 0.86);
    x.lineTo(cx + tw * 0.35, hz - ht * 0.86); x.bezierCurveTo(cx + tw * 0.8, hz - ht * 0.6, cx + tw * 1.0, hz - ht * 0.3, cx + tw * 1.3, hz + 2); x.fill();
    for (let i = -4; i <= 4; i++) { const a = i * 0.34 + lean, len = ht * (0.42 + 0.06 * (i % 2)), x0 = cx + tw * 0.06 * i, y0 = hz - ht * 0.84; x.strokeStyle = col; x.lineWidth = tw * 0.36; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo(x0 + Math.sin(a) * len * 0.5, y0 - Math.cos(a) * len * 0.7, x0 + Math.sin(a) * len, y0 - Math.cos(a) * len * 0.55); x.stroke(); x.beginPath(); x.ellipse(x0 + Math.sin(a) * len, y0 - Math.cos(a) * len * 0.58, tw * 0.9, tw * 0.28, a * 0.4, 0, TAU); x.fill(); }
  };
  const r = lcg(3);
  for (let i = 0; i < 12; i++) tree(80 + r() * (w - 160), 70 + r() * 70, '#8a3430', (r() - 0.5) * 0.2);
  for (const [px, ht] of [[250, 230], [640, 140], [980, 190], [1300, 250], [1620, 150], [1850, 210], [60, 160]]) tree(px, ht, '#2a0c18', (px - 1000) * 0.0002);
  x.fillStyle = '#2a0c18'; x.fillRect(0, hz, w, 6);
  return texOf(c);
}
// ------------------------------------------------------------------------------------------ the board
export function buildBoard(T, px = 1536) {
  const g = new THREE.Group(); g.name = 'board';
  const fr = frameCanvas(T), ft = fieldCanvas(T, px);
  const sh = new THREE.Shape(), W = BOARD_W / 2, L = BOARD_L / 2, rd = 4.2;
  sh.moveTo(-W + rd, -L); sh.lineTo(W - rd, -L); sh.quadraticCurveTo(W, -L, W, -L + rd); sh.lineTo(W, L - rd); sh.quadraticCurveTo(W, L, W - rd, L); sh.lineTo(-W + rd, L); sh.quadraticCurveTo(-W, L, -W, L - rd); sh.lineTo(-W, -L + rd); sh.quadraticCurveTo(-W, -L, -W + rd, -L);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: SLAB_H - 0.9, bevelEnabled: true, bevelThickness: 0.45, bevelSize: 0.45, bevelSegments: 3, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, MAT_Y + 0.9, 0);
  const slab = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: fr, color: new THREE.Color(T.frame[0]).lerp(new THREE.Color(0xffffff), 0.35), roughness: 0.42 }));
  slab.castShadow = slab.receiveShadow = true; g.add(slab);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, FIELD_L), new THREE.MeshStandardMaterial({ map: ft.map, bumpMap: ft.bump, bumpScale: 1.6, roughness: 0.5 }));
  field.rotation.x = -Math.PI / 2; field.position.y = TOP; field.receiveShadow = true; g.add(field);
  const lipM = new THREE.MeshStandardMaterial({ color: T.inlay[1], metalness: 0.75, roughness: 0.32 });
  for (const [sx, sz, w, l] of [[0, -FIELD_L / 2 - 0.25, FIELD_W + 1, 0.5], [0, FIELD_L / 2 + 0.25, FIELD_W + 1, 0.5], [-FIELD_W / 2 - 0.25, 0, 0.5, FIELD_L], [FIELD_W / 2 + 0.25, 0, 0.5, FIELD_L]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, l), lipM); m.position.set(sx, TOP + 0.05, sz); m.castShadow = m.receiveShadow = true; g.add(m); }
  const stud = new THREE.CylinderGeometry(1.0, 1.15, 0.5, 20), studM = new THREE.MeshStandardMaterial({ color: T.inlay[0], metalness: 0.9, roughness: 0.28 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) { const m = new THREE.Mesh(stud, studM); m.position.set(sx * (W - FRAME / 2 + 0.15), TOP - 0.45, sz * (L - FRAME / 2 + 0.15)); m.scale.setScalar(sx && sz ? 1.15 : 0.85); m.castShadow = true; g.add(m); }
  const foot = new THREE.CylinderGeometry(1.8, 2.2, 0.8, 16), footM = new THREE.MeshStandardMaterial({ color: T.frame[2], roughness: 0.6 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const m = new THREE.Mesh(foot, footM); m.position.set(sx * (W - 6), MAT_Y + 0.4, sz * (L - 6)); g.add(m); }
  return g;
}

// ------------------------------------------------------------------------------------------ stones
const lathe = (pts, seg = 56) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
export function stoneGeo(side) {
  const R = STONE_RAD, H = STONE_H;
  // Light: a polished disc with a raised, recessed crown. Dark: a taller turned drum with a domed crown.
  const pts = side === 1
    ? [[0, 0], [R * 0.9, 0], [R * 0.99, 0.12], [R * 1.02, 0.4], [R * 1.0, 0.8], [R * 0.95, 1.15], [R * 0.9, 1.3], [R * 0.84, 1.52], [R * 0.74, 1.68], [R * 0.58, 1.78], [R * 0.42, 1.8], [R * 0.3, 1.74], [R * 0.2, 1.66], [0, 1.64]]
    : [[0, 0], [R * 0.88, 0], [R * 0.98, 0.14], [R * 1.0, 0.5], [R * 0.97, 1.0], [R * 0.93, 1.45], [R * 0.86, 1.8], [R * 0.72, H * 1.05], [R * 0.5, H * 1.14], [R * 0.28, H * 1.18], [0, H * 1.2]];
  return lathe(pts);
}
function rosetteTex(side, T) {
  const s = 256, c = cv(s), x = c.getContext('2d'), m = s / 2, col = side === 1 ? T.lightRim : T.darkRim;
  x.translate(m, m); x.strokeStyle = col; x.fillStyle = col; x.lineCap = 'round';
  x.globalAlpha = side === 1 ? 0.7 : 0.85; x.lineWidth = 7; x.beginPath(); x.arc(0, 0, m * 0.9, 0, TAU); x.stroke();
  x.lineWidth = 3; x.beginPath(); x.arc(0, 0, m * 0.74, 0, TAU); x.stroke();
  for (let i = 0; i < 8; i++) { x.save(); x.rotate((i / 8) * TAU); x.beginPath(); x.ellipse(0, -m * 0.46, m * 0.09, m * 0.2, 0, 0, TAU); x.globalAlpha = side === 1 ? 0.62 : 0.8; x.fill(); x.restore(); }
  x.beginPath(); x.arc(0, 0, m * 0.1, 0, TAU); x.fill();
  return texOf(c);
}
export function stoneMats(T) {
  const L = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(T.light[1]).lerp(new THREE.Color(0xfff6e0), 0.25), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.18, sheen: 0.4, sheenColor: new THREE.Color(0xffe2b0) });
  const D = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(T.dark[1]), roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.12, metalness: 0.05 });
  const decal = (side) => new THREE.MeshBasicMaterial({ map: rosetteTex(side, T), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false });
  const dg = new THREE.CircleGeometry(STONE_RAD * 0.62, 40); dg.rotateX(-Math.PI / 2);
  return { 1: L, 2: D, d1: decal(1), d2: decal(2), geo1: stoneGeo(1), geo2: stoneGeo(2), decalGeo: dg };
}
export function makeStone(side, M) {
  const o = new THREE.Group(); o.userData.side = side;
  const body = new THREE.Mesh(side === 1 ? M.geo1 : M.geo2, M[side]); body.castShadow = body.receiveShadow = true; o.add(body);
  const d = new THREE.Mesh(M.decalGeo, side === 1 ? M.d1 : M.d2); d.position.y = (side === 1 ? 1.8 : STONE_H * 1.2) + 0.02; d.renderOrder = 2; o.add(d);
  o.userData.body = body; return o;
}

// ------------------------------------------------------------------------------------------ the sunset world
function grassTuft(r) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x8a7a2a, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.35, 7 + r() * 6, 3), m); const a = r() * TAU; b.position.set(Math.cos(a) * 1.4, 3.5, Math.sin(a) * 1.4); b.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); g.add(b); }
  return g;
}
export function buildScenery() {
  const g = new THREE.Group(); g.name = 'scenery';
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 32, 24), new THREE.MeshBasicMaterial({ map: skyCanvas(), side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -10; g.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(70, 48), new THREE.MeshBasicMaterial({ color: 0xffd488, fog: false, depthWrite: false })); sun.position.set(430, 28, -1700); sun.lookAt(0, 40, 0); g.add(sun);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshBasicMaterial({ map: radialTex('255,150,60', 0.6, 256), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.position.set(430, 28, -1690); halo.lookAt(0, 40, 0); g.add(halo);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(3000, 750), new THREE.MeshBasicMaterial({ map: horizonCanvas(), transparent: true, depthWrite: false, fog: false })); strip.position.set(0, 750 / 2 - 8, -1900); strip.renderOrder = -5; g.add(strip);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2000, 48), new THREE.MeshStandardMaterial({ map: earthCanvas(), roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  const MW = 146, ML = 104, mat = new THREE.Mesh(new THREE.BoxGeometry(MW, MAT_Y, ML), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.95 })); mat.position.y = MAT_Y / 2; mat.receiveShadow = true; g.add(mat);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(MW, ML), new THREE.MeshStandardMaterial({ map: matCanvas(MW, ML), roughness: 0.92 })); top.rotation.x = -Math.PI / 2; top.position.y = MAT_Y + 0.02; top.receiveShadow = true; g.add(top);
  const r = lcg(31), clay = new THREE.MeshStandardMaterial({ color: 0x9a4a28, roughness: 0.75 });
  const pot = new THREE.Mesh(lathe([[0, 0], [5.5, 0], [8.4, 3.5], [9.3, 8], [7.8, 12], [4.8, 14], [5.4, 15.5], [5.8, 16.4], [4.6, 16.5], [4.1, 15.2]]), clay); pot.position.set(-82, 0, -52); pot.castShadow = pot.receiveShadow = true; g.add(pot);
  const bowl = new THREE.Mesh(lathe([[0, 0.3], [5, 0.3], [9, 4.2], [9.6, 4.8], [8.9, 4.9], [4.4, 1.2], [0, 1.1]]), new THREE.MeshStandardMaterial({ color: 0x5a2c16, roughness: 0.5, side: THREE.DoubleSide })); bowl.position.set(88, MAT_Y, 38); bowl.castShadow = true; g.add(bowl);
  for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(1.2 + r() * 1.5, 10, 7), new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.9 })); p.scale.y = 0.6; p.position.set(-108 + r() * 20, 0.6, -20 + r() * 70); p.castShadow = true; g.add(p); }
  for (let i = 0; i < 70; i++) { const t = grassTuft(r); const a = r() * TAU, d = i < 16 ? 105 + r() * 70 : 170 + r() * 520; t.position.set(Math.cos(a) * d * 1.3, 0, Math.sin(a) * d * 0.9); t.scale.setScalar((0.9 + r() * 0.9) * (d > 250 ? 1.8 : 1)); g.add(t); }
  for (let i = 0; i < 40; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(2 + r() * 5, 9, 6), new THREE.MeshStandardMaterial({ color: 0x7a4632, roughness: 0.95 })); p.scale.y = 0.55; const a = r() * TAU, d = 150 + r() * 600; p.position.set(Math.cos(a) * d * 1.2, 0.5, Math.sin(a) * d * 0.9); p.castShadow = true; g.add(p); }
  return g;
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffc89a, 0x3a1810, 0.9); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffb272, 3.0); key.position.set(-120, 85, -150); key.target.position.set(0, 0, 0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); const sc = key.shadow.camera; sc.left = -95; sc.right = 95; sc.top = 75; sc.bottom = -75; sc.near = 20; sc.far = 520; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.35;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xffe0c0, 1.0); fill.position.set(60, 140, 160); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xff9a50, 1.6); rim.position.set(140, 40, -100); scene.add(rim);
  return { hemi, key, fill, rim };
}
export const FOG = 0xe6904a;
