// Hawalis 3D world (procedural, no image files): a dark teak Hawalis board with brass studs and corner plates (like the brass-nailed
// chests and doors of Oman), a Sadu diamond band down its middle, pearl seeds, lying on a red Sadu rug in a bright plastered majlis
// with a brass dallah, two finjan cups, a dish of dates and a camel-hair bolster. 1 world unit = 1 cm.
// The board is laid out from the flat art's own board units (art.js CELLS), so the 2D and 3D boards agree hole for hole.
import * as THREE from '../vendor3d/three.js';
import { woodCanvas } from '../vendor3d/board3d.js';
import { CELLS, BW, BH, HOLE_R } from '../src/art.js';

export const SX = 0.075, SZ = 0.064;                    // cm per flat-board unit across / down
export const BWC = BW * SX, BHC = BH * SZ;              // 52.2 x 38.4 cm
export const PLINTH = 2.2, SLAB = 4.0, TOP = PLINTH + SLAB;
export const HR = 2.75, HD = 1.75, LIP = 0.5, PR = 0.74;             // hole radius, hole depth, pearl radius (a 1.2 cm pearl)
export const toW = (lx, ly) => ({ x: (lx - BW / 2) * SX, z: (ly - BH / 2) * SZ });
export const toL = (x, z) => [x / SX + BW / 2, z / SZ + BH / 2];
export const holeW = (i) => toW(CELLS[i].cx, CELLS[i].cy);
void HOLE_R;

const TAU = Math.PI * 2;
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const texOf = (c, { srgb = true, repeat = null, aniso = 4 } = {}) => {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};

// ------------------------------------------------------------------------------------------- pearls in a hole
// Bowl floor height (below TOP) at radius r: a shallow spherical dish.
export const bowlY = (r) => TOP - LIP - HD * Math.max(0, 1 - (r / HR) ** 2);
// The k-th pearl of a hole: a layered heap that follows the dish, stable per (hole, k).
const LAYER = [7, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
export function seedSlot(cell, k) {
  let L = 0, j = k;
  while (L < LAYER.length - 1 && j >= LAYER[L]) { j -= LAYER[L]; L++; }
  const n = LAYER[L], rot = hash(cell, 7) * TAU + L * 0.52;
  const ringR = L === 0 ? 1.45 : Math.max(0.6, 1.55 - 0.14 * L);
  let r, a;
  if (L === 0 && j === 0) { r = 0.12; a = rot; } else { const m = L === 0 ? 6 : n; r = ringR; a = rot + ((L === 0 ? j - 1 : j) / m) * TAU; }
  r += (hash(cell * 31 + k, 3) - 0.5) * 0.18; a += (hash(cell * 31 + k, 5) - 0.5) * 0.25;
  const c = holeW(cell), dx = Math.cos(a) * r, dz = Math.sin(a) * r;
  const y = bowlY(Math.min(r, HR - PR * 0.7)) + PR * 0.96 + L * PR * 1.32 + (hash(cell * 31 + k, 9) - 0.5) * 0.08;
  return { x: c.x + dx, y, z: c.z + dz };
}

// ------------------------------------------------------------------------------------------- textures
const BOARD_STYLES = {
  dhow: { wood: ['#2a160b', '#4a2a15'], side: ['#24120a', '#3f2312'], band: '#120a06', inlay: '#efe6d2', brass: 0xd9a948, bowl: ['#1b0e07', '#3a2010'] },
  sadu: { wood: ['#4a1d12', '#6e2e1c'], side: ['#3a160d', '#5a2414'], band: '#1a0907', inlay: '#f3e7cf', brass: 0xe0b85a, bowl: ['#26100a', '#4a2014'] },
};

// The board top, painted top-down: grain, a carved border with a brass line, the Sadu diamond band, worn rings round the holes.
function boardTopCanvas(style, px) {
  const W = BWC + 2, H = BHC + 2, s = px / W, ch = Math.round(H * s);
  const c = cv(px, ch), x = c.getContext('2d'), b = cv(px, ch), bx = b.getContext('2d');
  const wood = woodCanvas(1024, style.wood[0], style.wood[1], 11, { lines: 260 });
  // grain runs along the long side
  x.drawImage(wood.map, 0, 0, px, ch); bx.drawImage(wood.bump, 0, 0, px, ch);
  const X = (cx) => (cx + W / 2) * s, Z = (cz) => (cz + H / 2) * s;
  // oiled sheen falloff + a darker edge where hands do not rub
  const g = x.createRadialGradient(px / 2, ch / 2, ch * 0.2, px / 2, ch / 2, px * 0.62); g.addColorStop(0, 'rgba(255,200,140,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.30)');
  x.fillStyle = g; x.fillRect(0, 0, px, ch);
  // carved border groove + brass wire inlay
  const inset = 1.25, rr = (ctx, a, bb, w, h, r) => { ctx.beginPath(); ctx.roundRect(a, bb, w, h, r); };
  for (const [ctx, dark, lite] of [[x, 'rgba(8,3,1,0.85)', 'rgba(232,180,80,0.95)'], [bx, 'rgba(0,0,0,1)', 'rgba(255,255,255,0.9)']]) {
    ctx.lineWidth = 0.42 * s; ctx.strokeStyle = dark; rr(ctx, X(-BWC / 2 + inset), Z(-BHC / 2 + inset), (BWC - 2 * inset) * s, (BHC - 2 * inset) * s, 1.6 * s); ctx.stroke();
    ctx.lineWidth = 0.16 * s; ctx.strokeStyle = lite; rr(ctx, X(-BWC / 2 + inset + 0.42), Z(-BHC / 2 + inset + 0.42), (BWC - 2 * inset - 0.84) * s, (BHC - 2 * inset - 0.84) * s, 1.3 * s); ctx.stroke();
  }
  // the middle band: ebony strip, brass edges, a run of mother-of-pearl Sadu diamonds with red cores
  const bh = 1.7, bx0 = -BWC / 2 + 2.2, bx1 = BWC / 2 - 2.2;
  x.fillStyle = style.band; x.fillRect(X(bx0), Z(-bh), (bx1 - bx0) * s, 2 * bh * s);
  bx.fillStyle = 'rgba(40,40,40,1)'; bx.fillRect(X(bx0), Z(-bh), (bx1 - bx0) * s, 2 * bh * s);
  for (const zz of [-bh, bh]) { x.fillStyle = '#d6a447'; x.fillRect(X(bx0), Z(zz) - 0.14 * s, (bx1 - bx0) * s, 0.28 * s); bx.fillStyle = '#fff'; bx.fillRect(X(bx0), Z(zz) - 0.14 * s, (bx1 - bx0) * s, 0.28 * s); }
  const step = 2.1, nD = Math.floor((bx1 - bx0 - 0.6) / step);
  const x0 = (bx0 + bx1) / 2 - (nD - 1) * step / 2;
  for (let i = 0; i < nD; i++) {
    const cx = X(x0 + i * step), cz = Z(0), d = 0.95 * s;
    const dia = (ctx, k, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, cz - d * k); ctx.lineTo(cx + d * k * 0.95, cz); ctx.lineTo(cx, cz + d * k); ctx.lineTo(cx - d * k * 0.95, cz); ctx.closePath(); ctx.fill(); };
    dia(x, 1, style.inlay); dia(x, 0.52, i % 2 ? '#a3241b' : '#1c1410'); dia(x, 0.2, style.inlay);
    dia(bx, 1, '#d0d0d0');
    // small triangles between the diamonds (the Sadu 'teeth')
    if (i < nD - 1) for (const sg of [-1, 1]) { x.fillStyle = '#c9963c'; x.beginPath(); const tx = X(x0 + (i + 0.5) * step); x.moveTo(tx - 0.42 * s, Z(sg * bh * 0.86)); x.lineTo(tx + 0.42 * s, Z(sg * bh * 0.86)); x.lineTo(tx, Z(sg * bh * 0.4)); x.closePath(); x.fill(); }
  }
  // round each hole: a darker worn ring and a light carved lip
  for (let i = 0; i < CELLS.length; i++) {
    const h = holeW(i), cx = X(h.x), cz = Z(h.z);
    const gr = x.createRadialGradient(cx, cz, HR * s * 0.98, cx, cz, HR * s * 1.42); gr.addColorStop(0, 'rgba(10,4,1,0.55)'); gr.addColorStop(1, 'rgba(10,4,1,0)');
    x.fillStyle = gr; x.beginPath(); x.arc(cx, cz, HR * s * 1.45, 0, TAU); x.fill();
  }
  return { map: c, bump: b, W, H };
}

// A Sadu rug: a deep red field with a quiet tone-on-tone diamond lattice, framed by woven borders of teeth and diamonds in black,
// cream and ochre. The board lies on the calm field; the busy borders stay at the edges of the view.
export function saduCanvas(w, h, seed = 3, border = 0.13) {
  const c = cv(w, h), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#741810'; x.fillRect(0, 0, w, h);
  // lattice: low-contrast diamonds in a darker red with a thin lighter outline
  const dw = w / 9, dh = dw * 1.25;
  for (let yy = -dh; yy < h + dh; yy += dh / 2) for (let xx = ((yy / (dh / 2)) % 2 ? dw / 2 : 0) - dw; xx < w + dw; xx += dw) {
    x.fillStyle = 'rgba(70,10,6,0.35)'; x.beginPath(); x.moveTo(xx, yy - dh * 0.32); x.lineTo(xx + dw * 0.3, yy); x.lineTo(xx, yy + dh * 0.32); x.lineTo(xx - dw * 0.3, yy); x.closePath(); x.fill();
    x.fillStyle = 'rgba(200,120,70,0.10)'; x.beginPath(); x.moveTo(xx, yy - dh * 0.1); x.lineTo(xx + dw * 0.09, yy); x.lineTo(xx, yy + dh * 0.1); x.lineTo(xx - dw * 0.09, yy); x.closePath(); x.fill();
  }
  // borders on all four sides
  const B = Math.min(w, h) * border;
  const frame = (o, t, col) => { x.fillStyle = col; x.fillRect(o, o, w - 2 * o, t); x.fillRect(o, h - o - t, w - 2 * o, t); x.fillRect(o, o, t, h - 2 * o); x.fillRect(w - o - t, o, t, h - 2 * o); };
  frame(0, B, '#151010');
  frame(B * 0.12, B * 0.08, '#d79a3a');
  // a run of diamonds round the border band
  const run = (len, place) => { const n = Math.max(3, Math.round(len / (B * 0.9))); for (let i = 0; i < n; i++) place((i + 0.5) * len / n); };
  const dia = (cx, cy, d) => { for (const [k, col] of [[1, '#e3d3b4'], [0.68, '#a3241b'], [0.36, '#151010'], [0.15, '#e3d3b4']]) { x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy - d * k); x.lineTo(cx + d * k * 0.8, cy); x.lineTo(cx, cy + d * k); x.lineTo(cx - d * k * 0.8, cy); x.closePath(); x.fill(); } };
  const mid = B * 0.58, d = B * 0.3;
  run(w, (p) => { dia(p, mid, d); dia(p, h - mid, d); });
  run(h - 2 * B, (p) => { dia(mid, B + p, d); dia(w - mid, B + p, d); });
  frame(B * 0.92, B * 0.05, '#e3d3b4');
  // teeth along the inner edge of the border
  x.fillStyle = '#e3d3b4'; const tz = B * 0.16;
  for (let p = B; p < w - B; p += tz) { x.beginPath(); x.moveTo(p, B); x.lineTo(p + tz, B); x.lineTo(p + tz / 2, B + tz * 0.8); x.fill(); x.beginPath(); x.moveTo(p, h - B); x.lineTo(p + tz, h - B); x.lineTo(p + tz / 2, h - B - tz * 0.8); x.fill(); }
  for (let p = B; p < h - B; p += tz) { x.beginPath(); x.moveTo(B, p); x.lineTo(B, p + tz); x.lineTo(B + tz * 0.8, p + tz / 2); x.fill(); x.beginPath(); x.moveTo(w - B, p); x.lineTo(w - B, p + tz); x.lineTo(w - B - tz * 0.8, p + tz / 2); x.fill(); }
  // wool: fine weft lines and slubs
  for (let y = 0; y < h; y += 2) { x.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`; x.fillRect(0, y, w, 1); }
  for (let i = 0; i < 3000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,230,200,0.05)' : 'rgba(0,0,0,0.09)'; x.fillRect(r() * w, r() * h, 2 + r() * 8, 1 + r() * 1.5); }
  return c;
}
function plasterCanvas(size, seed = 5) {
  const c = cv(size), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#e9dcc4'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) { const px = r() * size, py = r() * size, rr = 20 + r() * 90, g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, r() < 0.5 ? 'rgba(255,250,240,0.18)' : 'rgba(160,130,95,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, 2 * rr, 2 * rr); }
  for (let i = 0; i < 9000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(90,70,50,0.10)'; x.fillRect(r() * size, r() * size, 1.5, 1.5); }
  return c;
}
function floorCanvas(size, seed = 8) {
  // pale limestone tiles, 40 cm
  const c = cv(size), x = c.getContext('2d'), r = rng(seed), n = 4, t = size / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 0.9 + r() * 0.1; x.fillStyle = `rgb(${Math.round(214 * v)},${Math.round(196 * v)},${Math.round(166 * v)})`; x.fillRect(i * t, j * t, t, t);
    for (let k = 0; k < 160; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(100,80,60,0.08)'; x.fillRect(i * t + r() * t, j * t + r() * t, 2 + r() * 4, 2 + r() * 4); }
  }
  x.strokeStyle = 'rgba(90,70,50,0.45)'; x.lineWidth = 2; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * t, 0); x.lineTo(i * t, size); x.stroke(); x.beginPath(); x.moveTo(0, i * t); x.lineTo(size, i * t); x.stroke(); }
  return c;
}
export function radialTex(rgb, a = 1, size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.55})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return texOf(c);
}
export function ringTex(size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.62, 'rgba(255,255,255,0.12)'); g.addColorStop(0.78, 'rgba(255,255,255,1)'); g.addColorStop(0.88, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size); return texOf(c);
}

// ------------------------------------------------------------------------------------------- board
const brassMat = (col, rough = 0.3) => new THREE.MeshStandardMaterial({ color: col, metalness: 1, roughness: rough, envMapIntensity: 1.6 });
function roundRectShape(w, h, r) {
  const s = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); s.lineTo(x0 + w, y0 + h - r);
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h); s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
export function buildBoard(themeId = 'dhow', texPx = 1024) {
  const st = BOARD_STYLES[themeId] ?? BOARD_STYLES.dhow;
  const g = new THREE.Group(); g.name = `board:${themeId}`;
  const disposables = [];
  // slab with 28 holes (shape y = -world z)
  const bev = 0.55, shape = roundRectShape(BWC - 2 * bev, BHC - 2 * bev, 2.2);
  for (let i = 0; i < CELLS.length; i++) { const h = holeW(i), p = new THREE.Path(); p.absarc(h.x, -h.z, HR + bev, 0, TAU, true); shape.holes.push(p); }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: SLAB - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 28 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, PLINTH + bev, 0);
  const top = boardTopCanvas(st, texPx);
  const topMap = texOf(top.map), topBump = texOf(top.bump, { srgb: false });
  for (const t of [topMap, topBump]) { t.repeat.set(1 / top.W, 1 / top.H); t.offset.set(0.5, 0.5); }
  const topMat = new THREE.MeshPhysicalMaterial({ map: topMap, bumpMap: topBump, bumpScale: 0.6, roughness: 0.58, clearcoat: 0.12, clearcoatRoughness: 0.5, envMapIntensity: 0.3, specularIntensity: 0.5 });
  const sideMat = new THREE.MeshPhysicalMaterial({ color: st.side[1], roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.45, envMapIntensity: 0.5 });
  const slab = new THREE.Mesh(geo, [topMat, sideMat]); slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
  disposables.push(geo, topMat, sideMat, topMap, topBump);
  // bowls: a rounded dish closing each hole
  const prof = []; for (let k = 0; k <= 16; k++) { const r = HR * (1 - k / 16); prof.push(new THREE.Vector2(Math.max(0.001, r), bowlY(r))); }
  prof.reverse();
  // the rounded lip of the hole as a smooth turned surface over the extruded (faceted) bevel
  for (let k = 0; k <= 8; k++) { const th = (k / 8) * Math.PI / 2, rb = bev + 0.03; prof.push(new THREE.Vector2(HR + bev - rb * Math.cos(th), TOP - bev + rb * Math.sin(th))); }
  const bowlGeo = new THREE.LatheGeometry(prof, 64);
  const bowlMat = new THREE.MeshStandardMaterial({ color: st.bowl[1], roughness: 0.55, side: THREE.DoubleSide, envMapIntensity: 0.5 });   // turned and polished smooth
  const bowls = new THREE.InstancedMesh(bowlGeo, bowlMat, CELLS.length);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < CELLS.length; i++) { const h = holeW(i); m4.makeRotationY(hash(i, 2) * TAU); m4.setPosition(h.x, 0, h.z); bowls.setMatrixAt(i, m4); }
  bowls.receiveShadow = true; g.add(bowls); disposables.push(bowlGeo, bowlMat);
  // plinth: a darker recessed base so the board stands proud of the rug
  const pGeo = new THREE.ExtrudeGeometry(roundRectShape(BWC - 3, BHC - 3, 1.8), { depth: PLINTH - 0.3, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 1 });
  pGeo.rotateX(-Math.PI / 2); pGeo.translate(0, 0.15, 0);
  const pMat = new THREE.MeshStandardMaterial({ color: 0x1a0d06, roughness: 0.7 });
  const plinth = new THREE.Mesh(pGeo, pMat); plinth.castShadow = true; plinth.receiveShadow = true; g.add(plinth); disposables.push(pGeo, pMat);
  // brass: studs round the rim, L-shaped corner plates, a strap at each end of the middle band
  const brass = brassMat(st.brass, 0.28); disposables.push(brass);
  const studGeo = new THREE.SphereGeometry(0.42, 16, 8, 0, TAU, 0, Math.PI / 2); studGeo.scale(1, 0.7, 1); disposables.push(studGeo);
  const studs = []; const e = 1.0;
  const xs = BWC / 2 - e, zs = BHC / 2 - e;
  for (let i = 0; i <= 14; i++) { const x = -xs + (2 * xs * i) / 14; studs.push([x, -zs], [x, zs]); }
  for (let i = 1; i < 10; i++) { const z = -zs + (2 * zs * i) / 10; if (Math.abs(z) < 2) continue; studs.push([-xs, z], [xs, z]); }
  const plateShape = new THREE.Shape(); { const a = 5.6, w = 1.55; plateShape.moveTo(0, 0); plateShape.lineTo(a, 0); plateShape.quadraticCurveTo(a + 0.6, w / 2, a, w); plateShape.lineTo(w, w); plateShape.lineTo(w, a); plateShape.quadraticCurveTo(w / 2, a + 0.6, 0, a); plateShape.closePath(); }
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.08, bevelSegments: 2 }); plateGeo.rotateX(-Math.PI / 2); disposables.push(plateGeo);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const p = new THREE.Mesh(plateGeo, brass); p.position.set(sx * (BWC / 2 - 0.65), TOP + 0.02, sz * (BHC / 2 - 0.65));
    p.rotation.y = sx < 0 && sz < 0 ? Math.PI / 2 : sx > 0 && sz < 0 ? Math.PI : sx > 0 && sz > 0 ? -Math.PI / 2 : 0;
    p.castShadow = true; p.receiveShadow = true; g.add(p);
    for (const [ox, oz] of [[0.8, 0.8], [4.0, 0.8], [0.8, 4.0]]) studs.push([sx * (BWC / 2 - 0.65 - ox), sz * (BHC / 2 - 0.65 - oz), 0.2]);
  }
  const studMesh = new THREE.InstancedMesh(studGeo, brass, studs.length);
  studs.forEach(([x, z, up = 0], i) => { m4.makeTranslation(x, TOP + 0.01 + up, z); studMesh.setMatrixAt(i, m4); });
  studMesh.castShadow = true; g.add(studMesh);
  // brass straps wrapped over the two ends of the middle band
  const strapGeo = new THREE.BoxGeometry(1.2, 0.18, 4.2); disposables.push(strapGeo);
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(strapGeo, brass); s.position.set(sx * (BWC / 2 - 1.1), TOP + 0.07, 0); s.castShadow = true; g.add(s); const k = new THREE.Mesh(studGeo, brass); k.position.set(sx * (BWC / 2 - 1.1), TOP + 0.16, 0); k.scale.setScalar(1.2); g.add(k); }
  // brass end handles (rings) on the short sides
  const ringGeo = new THREE.TorusGeometry(1.5, 0.22, 10, 28); disposables.push(ringGeo);
  for (const sx of [-1, 1]) { const r = new THREE.Mesh(ringGeo, brass); r.position.set(sx * (BWC / 2 + 0.25), PLINTH + SLAB * 0.45, 0); r.rotation.set(0, Math.PI / 2, 0.35 * sx); r.castShadow = true; g.add(r); }
  g.userData.dispose = () => { for (const d of disposables) d.dispose(); };
  return g;
}

// ------------------------------------------------------------------------------------------- pearls
const PEARL_TONES = ['#e4d8c6', '#ddd0bd', '#e2cdc4', '#d8d2c6', '#d2d5d2', '#e6d4b6', '#eadfd0', '#d6c5ba'];
export const pearlTone = (seed) => new THREE.Color(PEARL_TONES[Math.floor(hash(seed, 13) * PEARL_TONES.length) % PEARL_TONES.length]);
export function pearlMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.2, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.8, sheenRoughness: 0.35, sheenColor: new THREE.Color('#ffc8dc'),
    iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 650], envMapIntensity: 1.6,
  });
}
export function pearlGeos() {
  // three slightly different shapes: round, a touch oval, a touch button
  const a = new THREE.SphereGeometry(PR, 22, 16);
  const b = new THREE.SphereGeometry(PR, 22, 16); b.scale(1.06, 0.95, 1);
  const c = new THREE.SphereGeometry(PR, 22, 16); c.scale(1.02, 0.9, 1.02);
  return [a, b, c];
}

// ------------------------------------------------------------------------------------------- the room
export function buildRoom(scene, { quality = 1 } = {}) {
  const g = new THREE.Group(); g.name = 'room'; scene.add(g);
  // floor (limestone tiles), the rug on it, the plastered wall behind, a low cushion bench along the wall
  const fl = texOf(floorCanvas(512), { repeat: [16, 16] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(640, 640), new THREE.MeshStandardMaterial({ map: fl, roughness: 0.82 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.4; floor.receiveShadow = true; g.add(floor);
  const rugC = saduCanvas(quality ? 1024 : 512, quality ? 1536 : 768, 3, 0.11);
  const rugT = texOf(rugC); rugT.anisotropy = 8;
  const rugGeo = new THREE.BoxGeometry(150, 0.4, 220); rugGeo.translate(0, -0.2, 0);
  const rugSide = new THREE.MeshStandardMaterial({ color: 0x5e130d, roughness: 1 });
  const rugTop = new THREE.MeshStandardMaterial({ map: rugT, roughness: 0.96 });
  const rug = new THREE.Mesh(rugGeo, [rugSide, rugSide, rugTop, rugSide, rugSide, rugSide]); rug.rotation.y = Math.PI / 2; rug.receiveShadow = true; g.add(rug);
  // fringe at the short ends of the rug
  const fr = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.12, 5), new THREE.MeshStandardMaterial({ color: 0xe9dcc2, roughness: 1 }), 2 * 70);
  const m4 = new THREE.Matrix4(); let n = 0;
  for (const sx of [-1, 1]) for (let i = 0; i < 70; i++) { const z = -73 + (146 * i) / 69; m4.makeRotationY(Math.PI / 2 + (hash(i, sx + 5) - 0.5) * 0.25); m4.setPosition(sx * 112.4, 0.02, z); fr.setMatrixAt(n++, m4); }
  fr.receiveShadow = true; g.add(fr);
  // wall + bench far behind the board
  const wallT = texOf(plasterCanvas(512), { repeat: [4, 1.5] });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(640, 240), new THREE.MeshStandardMaterial({ map: wallT, roughness: 0.95 }));
  wall.position.set(0, 120, -150); wall.receiveShadow = true; g.add(wall);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(640, 12, 2), new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.7 })); skirt.position.set(0, 6, -149); g.add(skirt);
  // cushions along the wall: Sadu-woven bolsters on a mattress
  const cushT = texOf(saduCanvas(512, 128, 9, 0.3), { repeat: [3, 1] });
  const mat = new THREE.Mesh(new THREE.BoxGeometry(400, 9, 46), new THREE.MeshStandardMaterial({ color: 0x7a1d16, roughness: 0.95 })); mat.position.set(0, 4.5, -126); mat.castShadow = true; mat.receiveShadow = true; g.add(mat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(400, 36, 16), new THREE.MeshStandardMaterial({ map: cushT, roughness: 0.95 })); back.position.set(0, 24, -142); back.castShadow = true; back.receiveShadow = true; g.add(back);
  const bolsterGeo = new THREE.CapsuleGeometry(9, 34, 6, 16); bolsterGeo.rotateZ(Math.PI / 2);
  const bolMat = new THREE.MeshStandardMaterial({ map: texOf(saduCanvas(512, 256, 4, 0.25), { repeat: [1, 1] }), roughness: 0.95 });
  for (const x of [-120, -40, 40, 120]) { const b = new THREE.Mesh(bolsterGeo, bolMat); b.position.set(x, 18, -118); b.rotation.y = (hash(x + 99, 1) - 0.5) * 0.2; b.castShadow = true; b.receiveShadow = true; g.add(b); }
  // a window's light patch on the wall (warm)
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(90, 120), new THREE.MeshBasicMaterial({ map: radialTex('255,236,200', 0.35), transparent: true, depthWrite: false }));
  patch.position.set(70, 120, -149.5); g.add(patch);
  return g;
}

// A brass dallah (coffee pot): lathe body with a waist, crescent-beaked spout, a high lid with a finial, a handle. About 27 cm tall.
export function buildDallah(brassCol = 0xd9a948) {
  const g = new THREE.Group(); g.name = 'dallah';
  const m = brassMat(brassCol, 0.24);
  const body = [[0.01, 0], [6.2, 0], [7.0, 0.6], [7.6, 2.6], [7.4, 5.6], [6.0, 8.6], [3.4, 11.0], [2.5, 12.6], [2.6, 14.0], [3.6, 15.0], [3.9, 15.6], [3.6, 16.2], [2.9, 16.4]].map(([r, y]) => new THREE.Vector2(r, y));
  const lid = [[2.9, 16.4], [3.4, 17.2], [3.5, 18.6], [3.0, 20.0], [2.2, 21.2], [1.4, 22.6], [1.0, 23.4], [1.25, 24.2], [0.9, 25.2], [0.4, 26.4], [0.01, 27.0]].map(([r, y]) => new THREE.Vector2(r, y));
  const bm = new THREE.Mesh(new THREE.LatheGeometry(body, 40), m), lm = new THREE.Mesh(new THREE.LatheGeometry(lid, 40), m);
  for (const x of [bm, lm]) { x.castShadow = true; x.receiveShadow = true; g.add(x); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.25, 8, 36), m); ring.rotation.x = Math.PI / 2; ring.position.y = 15.3; g.add(ring);
  // spout: from the belly up and out, ending in a beak
  const spoutC = new THREE.CatmullRomCurve3([new THREE.Vector3(6.4, 4.5, 0), new THREE.Vector3(9.5, 8.5, 0), new THREE.Vector3(11.5, 14.5, 0), new THREE.Vector3(13.8, 18.4, 0), new THREE.Vector3(16.6, 19.6, 0)]);
  const spout = new THREE.Mesh(new THREE.TubeGeometry(spoutC, 24, 1.0, 12), m); spout.castShadow = true; g.add(spout);
  const beak = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.95, 2.6, 12), m); beak.position.set(17.6, 19.8, 0); beak.rotation.z = -Math.PI / 2 - 0.25; g.add(beak);
  // handle: a loop from the shoulder to the neck on the other side
  const hC = new THREE.CatmullRomCurve3([new THREE.Vector3(-6.0, 7.5, 0), new THREE.Vector3(-10.5, 10, 0), new THREE.Vector3(-10.5, 16, 0), new THREE.Vector3(-6.5, 19.5, 0), new THREE.Vector3(-3.4, 18.6, 0)]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(hC, 24, 0.55, 10), m); handle.castShadow = true; g.add(handle);
  return g;
}
// A finjan (handleless coffee cup, ~5 cm tall) with coffee inside.
export function buildFinjan() {
  const g = new THREE.Group();
  const prof = [[0.01, 0], [1.6, 0], [1.7, 0.3], [2.1, 1.6], [2.8, 4.6], [3.0, 5.1], [2.85, 5.15], [2.6, 4.6], [1.9, 1.7], [0.01, 1.4]].map(([r, y]) => new THREE.Vector2(r, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(prof, 36), new THREE.MeshPhysicalMaterial({ color: 0xf6f1e8, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }));
  cup.castShadow = true; cup.receiveShadow = true; g.add(cup);
  const band = new THREE.Mesh(new THREE.TorusGeometry(2.92, 0.09, 6, 36), brassMat(0xd4a53e, 0.3)); band.rotation.x = Math.PI / 2; band.position.y = 4.9; g.add(band);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(2.35, 28), new THREE.MeshPhysicalMaterial({ color: 0x8a6a2c, roughness: 0.15, clearcoat: 1 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 3.6; g.add(coffee);
  return g;
}
// A shallow brass dish with dates.
export function buildDates(brassCol = 0xd9a948) {
  const g = new THREE.Group();
  const prof = [[0.01, 0], [7, 0], [9.5, 1.0], [11, 2.3], [11.2, 2.5], [10.8, 2.5], [9.3, 1.4], [0.01, 0.5]].map(([r, y]) => new THREE.Vector2(r, y));
  const dish = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), brassMat(brassCol, 0.3)); dish.castShadow = true; dish.receiveShadow = true; g.add(dish);
  const dg = new THREE.SphereGeometry(1, 14, 10); dg.scale(1.9, 1.05, 1.05);
  const dm = new THREE.MeshPhysicalMaterial({ color: 0x5a2a12, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.3 });
  const r = rng(77); const pts = [];
  for (let i = 0; i < 13; i++) { const a = r() * TAU, rad = 1 + r() * 6.5; pts.push([Math.cos(a) * rad, Math.sin(a) * rad, i]); }
  const im = new THREE.InstancedMesh(dg, dm, pts.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  pts.forEach(([x, z, i]) => { e.set((r() - 0.5) * 0.4, r() * TAU, (r() - 0.5) * 0.4); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, 1.6 + (i > 8 ? 1.6 : 0), z), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); });
  im.castShadow = true; im.receiveShadow = true; g.add(im);
  return g;
}

// ------------------------------------------------------------------------------------------- lights
// Bright late-morning majlis: a warm sun through the window (shadows), sky light from the room, a cool rim from the doorway.
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x6a3a26, 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.6); sun.position.set(55, 95, 40); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  const sc = sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 20; sc.far = 260;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0xbfd6ff, 0.7); rim.position.set(-70, 40, -90); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffd0a0, 0.35); fill.position.set(-40, 30, 80); scene.add(fill);
  return { hemi, sun, rim, fill };
}
