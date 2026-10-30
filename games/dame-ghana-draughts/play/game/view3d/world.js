// The 3D world for Dame (West African draughts), all procedural (no bitmaps): a carved wooden board with a strip-woven cloth border
// on a woven cloth runner, on a planked table in the warm light of a hurricane lantern, with green soda bottles behind and loose
// bottle caps in front. The playing pieces are pressed-metal bottle caps (crimped skirt, printed face) or turned wood discs; a king
// is a second piece stacked under the first with a crown stamped on top. Units are centimetres; y is up; row 0 is the far row (-z).
import * as THREE from '../vendor3d/three.js';

export const CELL = 4;              // one square (cm)
export const MARGIN = 2.0;          // carved frame + woven band round the playing field
export const THICK = 3.0;
export const BASE = 0.8;            // cloth thickness: the slab stands on it
export const TOP = BASE + THICK;
export const R = 1.72;              // cap radius
export const H = 0.56;              // cap height
export const half = (n) => (n * CELL) / 2 + MARGIN;
export const cellWorld = (cx, cy, n) => ({ x: (cx - n / 2) * CELL, z: (cy - n / 2) * CELL });

const rnd = (s) => { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, aniso = 8) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };
const TAU = Math.PI * 2;

export function radialTex(rgb = '255,255,255', a = 1) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}

// ------------------------------------------------------------------------------------------------ strip-woven cloth (craft pattern only)
const WEAVE = ['#e8b23a', '#b8322a', '#2e7d4f', '#17100c', '#f1e2bd'];
function weave(c, x, y, w, h, tile, phase = 0) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  const cols = Math.ceil(w / tile), rows = Math.ceil(h / tile);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = (i + phase + j * 2) % 10, base = WEAVE[[3, 0, 3, 1, 3, 2, 3, 0, 3, 4][k]], mark = WEAVE[[0, 3, 1, 3, 2, 3, 4, 3, 0, 3][(k + j) % 10]];
    const tx = x + i * tile, ty = y + j * tile;
    c.fillStyle = base; c.fillRect(tx, ty, tile, tile);
    c.fillStyle = mark; c.beginPath(); c.moveTo(tx + tile / 2, ty + tile * 0.14); c.lineTo(tx + tile * 0.86, ty + tile / 2); c.lineTo(tx + tile / 2, ty + tile * 0.86); c.lineTo(tx + tile * 0.14, ty + tile / 2); c.closePath(); c.fill();
  }
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
  c.fillStyle = g; c.fillRect(x, y, w, h); c.restore();
}
function grain(c, x, y, w, h, seed, alpha, dark) {
  const r = rnd(seed); c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  for (let i = 0; i < 120; i++) {
    const yy = y + r() * h, amp = 2 + r() * 10, ph = r() * 6, len = 0.3 + r() * 0.7, x0 = x + r() * w * (1 - len);
    c.strokeStyle = r() < 0.5 ? `rgba(0,0,0,${alpha * (0.4 + r())})` : `rgba(${dark ? '255,220,170' : '255,236,200'},${alpha * 0.55 * (0.4 + r())})`;
    c.lineWidth = (0.6 + r() * 2.2) * w / 1600; c.beginPath();
    for (let t = 0; t <= 24; t++) { const px = x0 + (w * len * t) / 24, py = yy + Math.sin(ph + t * 0.5) * amp * w / 1600; if (t) c.lineTo(px, py); else c.moveTo(px, py); }
    c.stroke();
  }
  c.restore();
}

// ------------------------------------------------------------------------------------------------ the board
export const WOODS = { teak: { frame: ['#a56a32', '#7b4a20', '#4e2c12'], dark: ['#5b3517', '#7a4a22'], light: ['#f1dba8', '#d8b878'], side: '#5a3414', ebony: false }, ebony: { frame: ['#4a3529', '#2a1c14', '#17100b'], dark: ['#3a271a', '#52382a'], light: ['#e9d3a2', '#cfae72'], side: '#1e130c', ebony: true } };
function topMaps(woodId, n, S) {
  const W = WOODS[woodId] || WOODS.teak, HW = half(n), k = S / (2 * HW), p = (cm) => cm * k;
  const c = canvas(S), x = c.getContext('2d'), b = canvas(S), y = b.getContext('2d');
  // frame wood
  const fg = x.createLinearGradient(0, 0, S, S); fg.addColorStop(0, W.frame[0]); fg.addColorStop(0.5, W.frame[1]); fg.addColorStop(1, W.frame[2]);
  x.fillStyle = fg; x.fillRect(0, 0, S, S); grain(x, 0, 0, S, S, W.ebony ? 31 : 17, W.ebony ? 0.16 : 0.22, W.ebony);
  y.fillStyle = '#808080'; y.fillRect(0, 0, S, S);
  // woven band (four strips) between 0.25 and 1.55 cm from the edge
  const b0 = p(0.22), bw = p(1.2), tile = p(0.6);
  x.save(); x.beginPath(); x.rect(b0, b0, S - 2 * b0, S - 2 * b0); x.rect(b0 + bw, b0 + bw, S - 2 * (b0 + bw), S - 2 * (b0 + bw)); x.clip('evenodd');
  weave(x, b0, b0, S - 2 * b0, bw, tile, 0); weave(x, b0, S - b0 - bw, S - 2 * b0, bw, tile, 3); weave(x, b0, b0 + bw, bw, S - 2 * (b0 + bw), tile, 1); weave(x, S - b0 - bw, b0 + bw, bw, S - 2 * (b0 + bw), tile, 5);
  x.restore();
  for (const [o, col, w2] of [[b0, 'rgba(0,0,0,0.55)', 3], [b0 + bw, 'rgba(0,0,0,0.6)', 3], [b0 - 3, 'rgba(255,230,180,0.35)', 2]]) { x.strokeStyle = col; x.lineWidth = w2 * S / 2048 * 2; x.strokeRect(o, o, S - 2 * o, S - 2 * o); }
  y.fillStyle = '#a0a0a0'; y.fillRect(b0, b0, S - 2 * b0, bw); y.fillRect(b0, S - b0 - bw, S - 2 * b0, bw); y.fillRect(b0, b0, bw, S - 2 * b0); y.fillRect(S - b0 - bw, b0, bw, S - 2 * b0);
  // the playing field
  const f0 = p(MARGIN), FW = p(n * CELL);
  x.save(); x.shadowColor = 'rgba(0,0,0,0.7)'; x.shadowBlur = p(0.6); x.shadowOffsetX = p(0.12); x.shadowOffsetY = p(0.16); x.fillStyle = '#000'; x.fillRect(f0 - 2, f0 - 2, FW + 4, FW + 4); x.restore();
  const lg = x.createLinearGradient(f0, f0, f0 + FW, f0 + FW); lg.addColorStop(0, W.light[0]); lg.addColorStop(1, W.light[1]);
  x.fillStyle = lg; x.fillRect(f0, f0, FW, FW); grain(x, f0, f0, FW, FW, 9, 0.1, false);
  y.fillStyle = '#909090'; y.fillRect(f0, f0, FW, FW);
  const cell = CELL * k;
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) {
    if ((r + q) % 2 !== 1) continue;
    const X = f0 + q * cell, Y = f0 + r * cell, dg = x.createLinearGradient(X, Y, X + cell, Y + cell);
    dg.addColorStop(0, W.dark[0]); dg.addColorStop(1, W.dark[1]); x.fillStyle = dg; x.fillRect(X, Y, cell, cell);
    const w2 = cell * 0.075;
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(X, Y, cell, w2); x.fillRect(X, Y, w2, cell);
    x.fillStyle = 'rgba(255,225,170,0.22)'; x.fillRect(X, Y + cell - w2 * 0.6, cell, w2 * 0.6); x.fillRect(X + cell - w2 * 0.6, Y, w2 * 0.6, cell);
    x.strokeStyle = 'rgba(255,225,170,0.08)'; x.lineWidth = Math.max(1, cell * 0.02); x.beginPath(); x.moveTo(X + cell / 2, Y + cell * 0.2); x.lineTo(X + cell * 0.8, Y + cell / 2); x.lineTo(X + cell / 2, Y + cell * 0.8); x.lineTo(X + cell * 0.2, Y + cell / 2); x.closePath(); x.stroke();
    // carved in: the dark squares sit lower
    y.fillStyle = '#5a5a5a'; y.fillRect(X, Y, cell, cell); y.fillStyle = '#3c3c3c'; y.fillRect(X, Y, cell, w2 * 1.4); y.fillRect(X, Y, w2 * 1.4, cell);
    y.fillStyle = '#b0b0b0'; y.fillRect(X, Y + cell - w2, cell, w2); y.fillRect(X + cell - w2, Y, w2, cell);
  }
  grain(x, f0, f0, FW, FW, 23, 0.07, true);
  x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 3 * S / 2048 * 2; x.strokeRect(f0, f0, FW, FW);
  // a light glaze from the upper left
  const gl = x.createLinearGradient(0, 0, S, S); gl.addColorStop(0, 'rgba(255,240,210,0.14)'); gl.addColorStop(0.45, 'rgba(255,240,210,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.16)');
  x.fillStyle = gl; x.fillRect(0, 0, S, S);
  return { map: tex(c), bump: tex(b, false) };
}
function sideTex(woodId) {
  const W = WOODS[woodId] || WOODS.teak, c = canvas(256), x = c.getContext('2d');
  x.fillStyle = W.side; x.fillRect(0, 0, 256, 256); grain(x, 0, 0, 256, 256, 5, 0.3, W.ebony);
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export function buildBoard(woodId, n, size = 1536) {
  const HW = half(n), g = new THREE.Group(), { map, bump } = topMaps(woodId, n, size), side = sideTex(woodId);
  const sideM = new THREE.MeshStandardMaterial({ map: side, roughness: 0.6, metalness: 0, envMapIntensity: 0.6 });
  const topM = new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 1.8, roughness: 0.42, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.9 });
  const low = new THREE.Mesh(new THREE.BoxGeometry(2 * HW + 1.0, THICK * 0.55, 2 * HW + 1.0), sideM); low.position.y = BASE + THICK * 0.275; low.castShadow = true; low.receiveShadow = true; g.add(low);
  const hh = THICK * 0.45, up = new THREE.Mesh(new THREE.BoxGeometry(2 * HW, hh, 2 * HW), [sideM, sideM, topM, sideM, sideM, sideM]); up.position.y = BASE + THICK * 0.55 + hh / 2; up.castShadow = true; up.receiveShadow = true; g.add(up);
  const brass = new THREE.MeshStandardMaterial({ color: 0xd5a64d, roughness: 0.32, metalness: 1, envMapIntensity: 1.3 });
  const lip = new THREE.Mesh(new THREE.BoxGeometry(2 * HW + 1.1, 0.14, 2 * HW + 1.1), brass); lip.position.y = BASE + THICK * 0.55; g.add(lip);
  g.userData.dispose = () => { map.dispose(); bump.dispose(); side.dispose(); sideM.dispose(); topM.dispose(); brass.dispose(); g.traverse((o) => o.geometry && o.geometry.dispose()); };
  return g;
}

// ------------------------------------------------------------------------------------------------ the pieces
function merge(parts) {
  const pos = [], nor = [], uv = [], idx = [], groups = []; let base = 0;
  for (const [geo, mi] of parts) {
    const p = geo.attributes.position, nn = geo.attributes.normal, u = geo.attributes.uv, ix = geo.index;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(nn.getX(i), nn.getY(i), nn.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
    const start = idx.length; for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    groups.push([start, idx.length - start, mi]); base += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); for (const [s, c, m] of groups) g.addGroup(s, c, m);
  return g;
}
// one cap: crimped skirt (material 0) and a flat printed face (material 1) at height y0 above the base of this cap
function capParts(y0, set) {
  const prof = [[0.0, 0], [0.93 * R, 0], [R, 0.1], [R, 0.33 * H / 0.56], [0.95 * R, 0.43 * H / 0.56], [0.87 * R, H]].map(([r, y]) => new THREE.Vector2(r, y + y0));
  const lathe = new THREE.LatheGeometry(prof, 96), pos = lathe.attributes.position;
  if (set === 'caps') for (let i = 0; i < pos.count; i++) {
    const yy = pos.getY(i) - y0; if (yy < 0.05 || yy > H * 0.8) continue;
    const xx = pos.getX(i), zz = pos.getZ(i), a = Math.atan2(zz, xx), d = 0.045 * (yy > H * 0.55 ? 0.6 : 1), k = 1 - d + d * (0.5 + 0.5 * Math.cos(a * 21));
    pos.setX(i, xx * k); pos.setZ(i, zz * k);
  }
  lathe.computeVertexNormals();
  const face = new THREE.CircleGeometry(0.87 * R, 64); face.rotateX(-Math.PI / 2); face.translate(0, H + y0 + 0.003, 0);
  return [[lathe, 0], [face, 1]];
}
export function capGeo(king, set = 'caps') {
  const parts = capParts(0, set);
  if (king) parts.push(...capParts(H * 0.88, set));
  // a king: the lower cap's face is hidden under the upper cap, so only the upper face (group 1 of the second part) shows; both use material 1
  return merge(parts);
}

const PAL = {
  caps: {
    1: { rim0: '#fbe08a', rim1: '#a9741a', face0: '#ffe9a0', face1: '#e3a830', face2: '#b97c14', motif: 'rgba(122,72,8,0.55)', ink: '#7a4808', edge: '#6d4508' },
    '-1': { rim0: '#ff9a84', rim1: '#7d1810', face0: '#ff8a70', face1: '#d63a28', face2: '#9c1d12', motif: 'rgba(255,226,214,0.6)', ink: '#ffe3d6', edge: '#4d0d08' },
  },
  wood: {
    1: { rim0: '#f8ebc8', rim1: '#a98650', face0: '#f6e6bd', face1: '#dcbc82', face2: '#bb975c', motif: 'rgba(120,88,44,0.5)', ink: '#6b4c22', edge: '#6b4c22' },
    '-1': { rim0: '#a58565', rim1: '#2a1a10', face0: '#74543f', face1: '#3b261a', face2: '#1d1109', motif: 'rgba(0,0,0,0.5)', ink: '#e0b27a', edge: '#caa070' },
  },
};
function crown(c, r, color) {
  c.save(); c.fillStyle = color; const w = r * 0.62, h = r * 0.46, y0 = r * 0.2;
  c.beginPath(); c.moveTo(-w, y0); c.lineTo(-w, y0 - h * 0.55); c.lineTo(-w * 0.5, y0 - h * 0.25); c.lineTo(0, y0 - h); c.lineTo(w * 0.5, y0 - h * 0.25); c.lineTo(w, y0 - h * 0.55); c.lineTo(w, y0); c.closePath(); c.fill();
  c.fillRect(-w, y0 + r * 0.05, w * 2, r * 0.1);
  for (const [px, py] of [[-w, y0 - h * 0.55], [0, y0 - h], [w, y0 - h * 0.55]]) { c.beginPath(); c.arc(px, py, r * 0.06, 0, TAU); c.fill(); }
  c.restore();
}
function faceTex(set, side, king) {
  const S = 256, c = canvas(S), x = c.getContext('2d'), p = PAL[set][side], r = S / 2;
  x.translate(r, r);
  x.beginPath(); x.arc(0, 0, r, 0, TAU); x.fillStyle = p.face1; x.fill();
  const f = x.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r); f.addColorStop(0, p.face0); f.addColorStop(0.55, p.face1); f.addColorStop(1, p.face2);
  x.fillStyle = f; x.fill();
  x.lineWidth = r * 0.04; x.strokeStyle = p.edge; x.globalAlpha = 0.6; x.stroke(); x.globalAlpha = 1;
  if (set === 'caps') {
    x.strokeStyle = p.motif; x.lineWidth = r * 0.05; x.beginPath(); x.arc(0, 0, r * 0.76, 0, TAU); x.stroke();
    x.fillStyle = p.motif;
    for (let i = 0; i < 8; i++) { x.save(); x.rotate((i / 8) * TAU + Math.PI / 8); x.beginPath(); x.moveTo(r * 0.34, 0); x.lineTo(r * 0.64, r * 0.085); x.lineTo(r * 0.64, -r * 0.085); x.closePath(); x.fill(); x.restore(); }
    x.beginPath(); x.arc(0, 0, r * 0.13, 0, TAU); x.fill();
    const b = x.createLinearGradient(-r, -r, r, r); b.addColorStop(0, 'rgba(255,255,255,0)'); b.addColorStop(0.32, 'rgba(255,255,255,0)'); b.addColorStop(0.42, 'rgba(255,255,255,0.3)'); b.addColorStop(0.52, 'rgba(255,255,255,0)'); b.addColorStop(0.8, 'rgba(0,0,0,0.16)'); b.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = b; x.beginPath(); x.arc(0, 0, r, 0, TAU); x.fill();
  } else {
    x.strokeStyle = p.motif; x.lineWidth = r * 0.04; for (const k of [0.78, 0.58, 0.38]) { x.beginPath(); x.arc(0, 0, r * k, 0, TAU); x.stroke(); }
    x.save(); x.beginPath(); x.arc(0, 0, r * 0.95, 0, TAU); x.clip(); x.globalAlpha = 0.2; x.lineWidth = r * 0.03;
    for (let i = -5; i <= 5; i++) { x.beginPath(); x.moveTo(-r, i * r * 0.2 + r * 0.03); x.quadraticCurveTo(0, i * r * 0.2 - r * 0.06, r, i * r * 0.2 + r * 0.05); x.stroke(); }
    x.restore();
  }
  if (king) crown(x, r * 0.95, p.ink);
  const t = tex(c); return t;
}
// materials for the four mesh kinds: [skirt, face] per (side, king)
export function pieceMaterials(set) {
  const out = {};
  for (const side of [1, -1]) for (const king of [0, 1]) out[`${side}|${king}`] = [new THREE.MeshStandardMaterial(), new THREE.MeshPhysicalMaterial()];
  setPieceSet(out, set); return out;
}
export function setPieceSet(mats, set) {
  const s = set === 'wood' ? 'wood' : 'caps';
  for (const side of [1, -1]) for (const king of [0, 1]) {
    const [sk, fc] = mats[`${side}|${king}`], p = PAL[s][side];
    sk.color.set(p.rim1 === '#a9741a' ? '#d6a43a' : p.rim1); sk.map = null;
    if (s === 'caps') { sk.color.set(side === 1 ? '#e2b04a' : '#c93a2a'); sk.metalness = 0.85; sk.roughness = 0.3; sk.envMapIntensity = 1.5; }
    else { sk.color.set(side === 1 ? '#d8bf8a' : '#3a2416'); sk.metalness = 0; sk.roughness = 0.5; sk.envMapIntensity = 0.7; }
    if (fc.map) fc.map.dispose(); fc.map = faceTex(s, side, king);
    fc.metalness = s === 'caps' ? 0.55 : 0; fc.roughness = s === 'caps' ? 0.34 : 0.45; fc.clearcoat = s === 'caps' ? 0.2 : 0.5; fc.clearcoatRoughness = 0.25; fc.envMapIntensity = 1.2;
    sk.needsUpdate = true; fc.needsUpdate = true;
  }
}

// ------------------------------------------------------------------------------------------------ the table, cloth, lantern, bottles
function plankTexture() {
  const W = 1024, c = canvas(W), x = c.getContext('2d'), r = rnd(9), N = 6, pw = W / N;
  for (let i = 0; i < N; i++) {
    const l = 20 + r() * 8; x.fillStyle = `hsl(${22 + r() * 6},48%,${l}%)`; x.fillRect(i * pw, 0, pw, W);
    grain(x, i * pw, 0, pw, W, 40 + i, 0.5, true);
    x.fillStyle = 'rgba(10,4,0,0.8)'; x.fillRect(i * pw, 0, 3, W);
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t;
}
function clothTexture() {
  const W = 1024, c = canvas(W), x = c.getContext('2d'), tile = W / 52;
  x.fillStyle = '#17100c'; x.fillRect(0, 0, W, W);
  // a strip-woven cloth: broad bands of the weave pattern separated by plain coloured bands, with a fringe edge
  const bands = [[0, 0.06, 'w'], [0.06, 0.09, '#b8322a'], [0.09, 0.2, 'w'], [0.2, 0.23, '#e8b23a'], [0.23, 0.36, 'w'], [0.36, 0.64, '#2c1a0f'], [0.64, 0.77, 'w'], [0.77, 0.8, '#e8b23a'], [0.8, 0.91, 'w'], [0.91, 0.94, '#b8322a'], [0.94, 1, 'w']];
  bands.forEach(([a, b, k], i) => { if (k === 'w') weave(x, a * W, 0, (b - a) * W, W, tile, i * 3); else { x.fillStyle = k; x.fillRect(a * W, 0, (b - a) * W, W); } });
  const r = rnd(3); for (let i = 0; i < 2600; i++) { x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; x.lineWidth = 1 + r() * 1.5; const yy = r() * W; x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy + (r() - 0.5) * 3); x.stroke(); }
  return tex(c);
}
export function buildTable(scene, caps) {
  const g = new THREE.Group();
  const table = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.62, metalness: 0, envMapIntensity: 0.5 }));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; g.add(table);
  // woven cloth runner under the board
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(56, BASE, 56), new THREE.MeshStandardMaterial({ map: clothTexture(), roughness: 0.95, envMapIntensity: 0.25 }));
  cloth.position.y = BASE / 2; cloth.receiveShadow = true; cloth.castShadow = true; g.add(cloth);
  // hurricane lantern, back left: brass base, glass chimney, a small flame, warm point light
  const lan = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xc89a3c, roughness: 0.35, metalness: 1, envMapIntensity: 1.4 });
  const base = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [5.2, 0], [5.6, 1.2], [4.4, 3.2], [4.2, 5.5], [0, 5.5]].map(([r, y]) => new THREE.Vector2(r, y)), 32), brass); base.castShadow = true; lan.add(base);
  const glass = new THREE.Mesh(new THREE.LatheGeometry([[3.6, 5.5], [3.9, 9], [3.2, 15], [2.4, 18], [2.2, 20]].map(([r, y]) => new THREE.Vector2(r, y)), 32), new THREE.MeshStandardMaterial({ color: 0xffe2a8, roughness: 0.1, transparent: true, opacity: 0.32, emissive: 0xff9c3a, emissiveIntensity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  lan.add(glass);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd488 })); flame.scale.set(0.8, 1.7, 0.8); flame.position.y = 8.2; lan.add(flame);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 1.4, 24), brass); cap.position.y = 20.4; lan.add(cap);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.22, 8, 28, Math.PI), brass); handle.position.y = 21; lan.add(handle);
  const light = new THREE.PointLight(0xffa850, 2600, 0, 2); light.position.y = 9; lan.add(light);
  lan.position.set(-38, 0, -46); g.add(lan);
  // two green soda bottles, back right
  const bottleM = new THREE.MeshPhysicalMaterial({ color: 0x1c7a45, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.86, envMapIntensity: 1.8, clearcoat: 1 });
  for (const [bx, bz, sc, tilt] of [[34, -44, 1, 0], [44, -36, 0.92, 0.06]]) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [3.1, 0], [3.3, 0.6], [3.3, 14], [3.0, 17], [1.6, 21], [1.3, 25], [1.45, 26.4], [0, 26.4]].map(([r, y]) => new THREE.Vector2(r, y)), 32), bottleM); body.castShadow = true; b.add(body);
    const crownCap = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.55, 0.7, 21), new THREE.MeshStandardMaterial({ color: 0xe2b04a, metalness: 0.9, roughness: 0.3 })); crownCap.position.y = 26.6; b.add(crownCap);
    b.position.set(bx, 0, bz); b.scale.setScalar(sc); b.rotation.z = tilt; g.add(b);
  }
  g.userData = { flame, light, lan };
  scene.add(g); return g;
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffe6c4, 0x4a2a14, 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffdcae, 2.4); sun.position.set(-60, 110, 70);
  sun.shadow.camera.left = -42; sun.shadow.camera.right = 42; sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42; sun.shadow.camera.near = 20; sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  return { hemi, sun };
}
