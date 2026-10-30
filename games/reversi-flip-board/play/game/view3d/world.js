// The 3D world for Reversi Flip Board, all procedural (no bitmaps): a pale limestone slab with a zellige tile border and a stone playing
// field on a striped rug, on the terracotta tiles of a sunlit riad courtyard (potted olive, brass tray with tea glasses, whitewashed
// wall behind). The discs are thick turned ceramic checkers: raised reeded rim, dished face, one glaze on each side, so a flipping disc
// really shows both. Units are centimetres; y is up; the board top is at y = TOP; grid row 0 is the far row (-z).
import * as THREE from '../vendor3d/three.js';

export const CELL = 4;              // one square (cm)
export const TRIM = 2.4;            // zellige band
export const FRAME = 2.2;           // plain limestone margin
export const THICK = 3.2;
export const BASE = 0.7;            // rug thickness: the slab stands on it
export const TOP = BASE + THICK;
export const DR = 1.64;             // disc radius
export const DH = 0.9;              // disc height
export const half = (n) => (n * CELL) / 2 + TRIM + FRAME;

const rnd = (s) => { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, aniso = 8) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const shade = (h, f) => { const [r, g, b] = hexRgb(h); return `rgb(${Math.min(255, Math.round(r * f))},${Math.min(255, Math.round(g * f))},${Math.min(255, Math.round(b * f))})`; };

// world position of grid cell (c, r); flip: the board turned half a turn (the human plays Dark from the far side)
export function gridPos(c, r, n = 8, flip = false) {
  const x = (c - (n - 1) / 2) * CELL, z = (r - (n - 1) / 2) * CELL;
  return flip ? { x: -x, z: -z } : { x, z };
}
export const cellPos = (i, n = 8, flip = false) => gridPos(i % n, Math.floor(i / n), n, flip);

export function radialTex(rgb = '255,255,255', a = 1) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}

// ------------------------------------------------------------------------------------------------ themes (the three boards of the game)
export const THEMES = {
  emerald: { field: ['#b4c6a4', '#93aa86'], line: '#324a38', glow: 'rgba(255,255,240,0.45)', tile: ['#1f7a63', '#f1ead6', '#c8923a'] },
  midnight: { field: ['#9fb2d2', '#7f95bb'], line: '#1f2e55', glow: 'rgba(240,248,255,0.45)', tile: ['#1f4a9a', '#f1ead6', '#c8923a'] },
  wine: { field: ['#d6a999', '#b98574'], line: '#5b2230', glow: 'rgba(255,240,235,0.45)', tile: ['#a3412c', '#f1ead6', '#2a5aa0'] },
};
export const DISCS = {
  gloss: { 1: { color: '#131a3a', sheen: '#3e4f9c', clear: 1, rough: 0.16 }, 2: { color: '#f4eddb', sheen: '#ffffff', clear: 0.9, rough: 0.26 } },
  coral: { 1: { color: '#d8472c', sheen: '#ff9a78', clear: 1, rough: 0.18 }, 2: { color: '#f4eddb', sheen: '#ffffff', clear: 0.9, rough: 0.26 } },
};

// ------------------------------------------------------------------------------------------------ the board
function zellige(x, X, Y, s, c0, c1, c2) {
  x.fillStyle = c0; x.fillRect(X, Y, s, s);
  // eight-point star in the tile (two squares, one turned), a small centre in the third colour, hairline grout
  const cx = X + s / 2, cy = Y + s / 2;
  x.fillStyle = c1;
  for (const rot of [0, Math.PI / 4]) { x.save(); x.translate(cx, cy); x.rotate(rot); x.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6); x.restore(); }
  x.fillStyle = c0; x.beginPath(); x.arc(cx, cy, s * 0.17, 0, 7); x.fill();
  x.fillStyle = c2; x.beginPath(); x.arc(cx, cy, s * 0.07, 0, 7); x.fill();
  x.strokeStyle = 'rgba(30,20,10,0.55)'; x.lineWidth = Math.max(1, s * 0.035); x.strokeRect(X + 0.5, Y + 0.5, s - 1, s - 1);
}

function topMaps(th, n, size) {
  const HW = half(n) - 0, W = size, k = W / (2 * HW), px = (cm) => (cm + HW) * k;
  const c = canvas(W), x = c.getContext('2d'), b = canvas(W), y = b.getContext('2d'), r = rnd(11 + n);
  // limestone margin
  x.fillStyle = '#e4d9c1'; x.fillRect(0, 0, W, W);
  y.fillStyle = '#808080'; y.fillRect(0, 0, W, W);
  for (let i = 0; i < W * 14; i++) { const a = r() * 0.07; x.fillStyle = r() < 0.5 ? `rgba(255,252,238,${a})` : `rgba(120,96,60,${a * 1.2})`; x.fillRect(r() * W, r() * W, 1 + r() * 2.4, 1 + r() * 2.4); }
  for (let i = 0; i < 18; i++) { x.strokeStyle = `rgba(150,120,80,${0.05 + r() * 0.07})`; x.lineWidth = (0.6 + r() * 1.6) * W / 1024; x.beginPath(); let px0 = r() * W, py0 = r() * W; x.moveTo(px0, py0); for (let j = 0; j < 5; j++) { px0 += (r() - 0.5) * W * 0.25; py0 += (r() - 0.5) * W * 0.25; x.lineTo(px0, py0); } x.stroke(); }
  // zellige band: a ring of square tiles
  const F = (n * CELL) / 2, inner = F, outer = F + TRIM, ts = TRIM * k;
  const cnt = Math.round((2 * outer) / TRIM);          // tiles along one side of the outer ring
  const ringT = (i, j) => { const ci = (i + 0.5) * TRIM - outer, cj = (j + 0.5) * TRIM - outer; return Math.max(Math.abs(ci), Math.abs(cj)) > inner + 0.1; };
  const tw = (2 * outer) / cnt, tsz = tw * k;
  for (let j = 0; j < cnt; j++) for (let i = 0; i < cnt; i++) {
    const ci = (i + 0.5) * tw - outer, cj = (j + 0.5) * tw - outer;
    if (Math.max(Math.abs(ci), Math.abs(cj)) <= inner + 0.05) continue;
    const alt = (i + j) % 2;
    zellige(x, px(-outer + i * tw), px(-outer + j * tw), tsz, alt ? th.tile[0] : th.tile[1], alt ? th.tile[1] : th.tile[0], th.tile[2]);
    y.fillStyle = '#909090'; y.fillRect(px(-outer + i * tw) + 1, px(-outer + j * tw) + 1, tsz - 2, tsz - 2);
  }
  void ringT; void ts;
  // brass keyline between band and field
  x.strokeStyle = '#d5a64d'; x.lineWidth = 0.18 * k; x.strokeRect(px(-inner - 0.09), px(-inner - 0.09), 2 * inner * k + 0.18 * k, 2 * inner * k + 0.18 * k);
  // the stone field
  const f0 = px(-F), FW = 2 * F * k;
  const g = x.createLinearGradient(f0, f0, f0 + FW, f0 + FW); g.addColorStop(0, th.field[0]); g.addColorStop(1, th.field[1]);
  x.fillStyle = g; x.fillRect(f0, f0, FW, FW);
  y.fillStyle = '#7c7c7c'; y.fillRect(f0, f0, FW, FW);
  x.save(); x.beginPath(); x.rect(f0, f0, FW, FW); x.clip(); y.save(); y.beginPath(); y.rect(f0, f0, FW, FW); y.clip();
  for (let i = 0; i < W * 16; i++) { const a = r() * 0.08; x.fillStyle = r() < 0.5 ? `rgba(255,255,245,${a})` : `rgba(30,40,20,${a * 1.1})`; x.fillRect(f0 + r() * FW, f0 + r() * FW, 1 + r() * 2.6, 1 + r() * 2.2); }
  for (let i = 0; i < W * 10; i++) { y.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; y.fillRect(f0 + r() * FW, f0 + r() * FW, 1 + r() * 2, 1 + r() * 2); }
  // a faint marbling
  for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(255,255,255,${0.04 + r() * 0.06})`; x.lineWidth = (1 + r() * 4) * W / 1024; x.beginPath(); let a0 = f0 + r() * FW, b0 = f0 + r() * FW; x.moveTo(a0, b0); for (let j = 0; j < 4; j++) { a0 += (r() - 0.3) * FW * 0.3; b0 += (r() - 0.5) * FW * 0.3; x.lineTo(a0, b0); } x.stroke(); }
  // a slightly worn tone per square
  for (let rr = 0; rr < n; rr++) for (let cc = 0; cc < n; cc++) { x.fillStyle = (rr + cc) % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; x.fillRect(f0 + cc * CELL * k, f0 + rr * CELL * k, CELL * k, CELL * k); }
  // inner edge shadow so the field reads as set into the band
  const ed = 0.7 * k;
  for (const [x0, y0, x1, y1, w2, h2] of [[f0, f0, f0, f0 + ed, FW, ed], [f0, f0, f0 + ed, f0, ed, FW]]) { const gg = x.createLinearGradient(x0, y0, x1, y1); gg.addColorStop(0, 'rgba(0,0,0,0.3)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(x0, y0, w2, h2); }
  x.restore(); y.restore();
  // engraved grid: dark line with a light line a hair below
  x.lineCap = 'round'; y.lineCap = 'round';
  for (const [off, col, lw, bump] of [[0.07, th.glow, 0.11, null], [0, th.line, 0.17, '#303030']]) {
    x.strokeStyle = col; x.lineWidth = lw * k;
    if (bump) { y.strokeStyle = bump; y.lineWidth = lw * k * 1.4; }
    for (let i = 0; i <= n; i++) {
      const p = f0 + i * CELL * k + off * k;
      for (const cx of [x, bump ? y : null]) { if (!cx) continue; cx.beginPath(); cx.moveTo(f0, p); cx.lineTo(f0 + FW, p); cx.moveTo(p, f0); cx.lineTo(p, f0 + FW); cx.stroke(); }
    }
  }
  // brass studs at the four inner crossings
  const q = n === 8 ? [2, 6] : [2, 4];
  for (const i of q) for (const j of q) {
    const sx = f0 + i * CELL * k, sy = f0 + j * CELL * k, gd = x.createRadialGradient(sx - 0.1 * k, sy - 0.1 * k, 0, sx, sy, 0.38 * k);
    gd.addColorStop(0, '#fff2c0'); gd.addColorStop(0.55, '#d9ab4c'); gd.addColorStop(1, '#7a5a1c');
    x.fillStyle = gd; x.beginPath(); x.arc(sx, sy, 0.36 * k, 0, 7); x.fill();
    y.fillStyle = '#c0c0c0'; y.beginPath(); y.arc(sx, sy, 0.34 * k, 0, 7); y.fill();
  }
  const t = tex(c), bm = tex(b, false); return { map: t, bump: bm };
}

function limestoneSide() {
  const W = 256, c = canvas(W), x = c.getContext('2d'), r = rnd(5);
  x.fillStyle = '#d9cdb2'; x.fillRect(0, 0, W, W);
  for (let i = 0; i < W * 60; i++) { const a = r() * 0.1; x.fillStyle = r() < 0.5 ? `rgba(255,250,232,${a})` : `rgba(110,86,50,${a})`; x.fillRect(r() * W, r() * W, 1 + r() * 2, 1 + r() * 2); }
  for (let i = 0; i < 8; i++) { x.strokeStyle = `rgba(140,110,70,${0.08 + r() * 0.08})`; x.lineWidth = 1 + r() * 2; x.beginPath(); x.moveTo(0, r() * W); x.bezierCurveTo(W * 0.3, r() * W, W * 0.6, r() * W, W, r() * W); x.stroke(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function buildBoard(themeId, n, size = 1536) {
  const th = THEMES[themeId] || THEMES.emerald, HW = half(n), g = new THREE.Group(), disposables = [];
  const { map, bump } = topMaps(th, n, size);
  disposables.push(map, bump);
  const side = limestoneSide(); disposables.push(side);
  const sideM = new THREE.MeshStandardMaterial({ map: side, roughness: 0.78, metalness: 0, envMapIntensity: 0.5 });
  const topM = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.6, roughness: 0.5, metalness: 0, envMapIntensity: 0.9 });
  const lowH = THICK - 0.6;
  const low = new THREE.Mesh(new THREE.BoxGeometry(2 * HW + 0.8, lowH, 2 * HW + 0.8), sideM); low.position.y = BASE + lowH / 2; low.castShadow = true; low.receiveShadow = true; g.add(low);
  const up = new THREE.Mesh(new THREE.BoxGeometry(2 * HW, 0.6, 2 * HW), [sideM, sideM, topM, sideM, sideM, sideM]); up.position.y = BASE + lowH + 0.3; up.castShadow = true; up.receiveShadow = true; g.add(up);
  // a thin brass edge line round the lower slab
  const brass = new THREE.MeshStandardMaterial({ color: 0xd5a64d, roughness: 0.3, metalness: 1, envMapIntensity: 1.4 });
  const lip = new THREE.Mesh(new THREE.BoxGeometry(2 * HW + 0.9, 0.16, 2 * HW + 0.9), brass); lip.position.y = BASE + lowH + 0.02; g.add(lip);
  g.userData.dispose = () => { disposables.forEach((t) => t.dispose()); sideM.dispose(); topM.dispose(); brass.dispose(); g.traverse((o) => o.geometry && o.geometry.dispose()); };
  return g;
}

// ------------------------------------------------------------------------------------------------ the discs
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
// profile of the upper half from the equator up over the rim, the dished face to the centre (r, y); the lower half is its mirror
const HALF_PROFILE = [[1.62, 0.0], [1.645, 0.1], [1.62, 0.26], [1.5, 0.37], [1.32, 0.42], [1.16, 0.42], [1.04, 0.37], [0.9, 0.31], [0.55, 0.28], [0.0, 0.27]].map(([r, y]) => [r * (DR / 1.645), y * (DH / 0.9)]);
export function discGeo() {
  const up = new THREE.LatheGeometry(HALF_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 56);
  const dn = new THREE.LatheGeometry(HALF_PROFILE.slice().reverse().map(([r, y]) => new THREE.Vector2(r, -y)), 56);
  return merge([[up, 0], [dn, 1]]);
}
// a ring of fine reeding round the edge, as a bump texture on the side of the disc (vertical stripes)
function reedTex() {
  const c = canvas(256, 8), x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 8);
  for (let i = 0; i < 48; i++) { const g = x.createLinearGradient(i * 256 / 48, 0, (i + 1) * 256 / 48, 0); g.addColorStop(0, '#606060'); g.addColorStop(0.5, '#c0c0c0'); g.addColorStop(1, '#606060'); x.fillStyle = g; x.fillRect(i * 256 / 48, 0, 256 / 48, 8); }
  const t = tex(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export function discMaterials(styleId) {
  const S = DISCS[styleId] || DISCS.gloss, reed = reedTex();
  const mk = (d) => new THREE.MeshPhysicalMaterial({ color: d.color, roughness: d.rough, metalness: 0, clearcoat: d.clear, clearcoatRoughness: 0.12, sheen: 0.5, sheenColor: new THREE.Color(d.sheen), sheenRoughness: 0.4, envMapIntensity: 1.5, bumpMap: reed, bumpScale: 0.3 });
  return [mk(S[1]), mk(S[2])];
}
export function setDiscStyle(mats, styleId) {
  const S = DISCS[styleId] || DISCS.gloss;
  [1, 2].forEach((w, i) => { const m = mats[i], d = S[w]; m.color.set(d.color); m.roughness = d.rough; m.clearcoat = d.clear; m.sheenColor.set(d.sheen); });
}

// ------------------------------------------------------------------------------------------------ the courtyard
function floorTexture() {
  const W = 1024, c = canvas(W), x = c.getContext('2d'), r = rnd(9), T = W / 4;     // 4 x 4 terracotta tiles
  x.fillStyle = '#6b3a22'; x.fillRect(0, 0, W, W);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const hue = 16 + r() * 8, l = 46 + r() * 10, X = i * T, Y = j * T;
    x.fillStyle = `hsl(${hue},58%,${l}%)`; x.fillRect(X + 3, Y + 3, T - 6, T - 6);
    for (let k = 0; k < 1400; k++) { const a = r() * 0.12; x.fillStyle = r() < 0.5 ? `rgba(255,214,170,${a})` : `rgba(70,28,10,${a})`; x.fillRect(X + 3 + r() * (T - 6), Y + 3 + r() * (T - 6), 1 + r() * 3, 1 + r() * 3); }
    const lg = x.createLinearGradient(X, Y, X + T, Y + T); lg.addColorStop(0, 'rgba(255,225,180,0.10)'); lg.addColorStop(1, 'rgba(60,20,5,0.14)'); x.fillStyle = lg; x.fillRect(X + 3, Y + 3, T - 6, T - 6);
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9); return t;
}
function rugTexture() {
  const W = 1024, c = canvas(W), x = c.getContext('2d'), r = rnd(21);
  x.fillStyle = '#efe5cd'; x.fillRect(0, 0, W, W);
  const bands = [['#1f4a8a', 0.045], ['#efe5cd', 0.012], ['#c8602a', 0.05], ['#efe5cd', 0.012], ['#1f4a8a', 0.025]];
  x.fillStyle = '#efe5cd'; x.fillRect(0, 0, W, W);
  let m = 0; for (const [col, wd] of bands) { x.fillStyle = col; x.fillRect(m * W, m * W, W - 2 * m * W, W - 2 * m * W); m += wd; }
  x.fillStyle = '#d9c9a2'; x.fillRect(m * W, m * W, W - 2 * m * W, W - 2 * m * W);
  // woven weft
  for (let i = 0; i < 1600; i++) { x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(60,30,10,0.07)'; x.lineWidth = 1 + r() * 2; const yy = r() * W; x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy + (r() - 0.5) * 4); x.stroke(); }
  // diamonds across the field
  x.fillStyle = 'rgba(31,74,138,0.55)';
  const s = W * 0.1; for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) { const cx = W * (0.2 + i * 0.1), cy = W * (0.2 + j * 0.1); x.beginPath(); x.moveTo(cx, cy - s * 0.3); x.lineTo(cx + s * 0.3, cy); x.lineTo(cx, cy + s * 0.3); x.lineTo(cx - s * 0.3, cy); x.closePath(); if ((i + j) % 2) x.fill(); }
  return tex(c);
}
function wallTexture() {
  const W = 1024, H = 512, c = canvas(W, H), x = c.getContext('2d'), r = rnd(31);
  x.fillStyle = '#efe3cc'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { const a = r() * 0.06; x.fillStyle = r() < 0.5 ? `rgba(255,250,235,${a})` : `rgba(150,110,70,${a})`; x.fillRect(r() * W, r() * H, 2 + r() * 8, 2 + r() * 3); }
  for (let i = 0; i < 4; i++) {            // arched doorways with a shaded interior
    const cx = W * (0.14 + i * 0.24), w = 120, h = 260, y0 = H - 40;
    x.fillStyle = '#3a2a22'; x.beginPath(); x.moveTo(cx - w / 2, y0); x.lineTo(cx - w / 2, y0 - h + w / 2); x.arc(cx, y0 - h + w / 2, w / 2, Math.PI, 0); x.lineTo(cx + w / 2, y0); x.closePath(); x.fill();
    x.strokeStyle = '#1f4a8a'; x.lineWidth = 12; x.stroke();
  }
  x.fillStyle = '#1f4a8a'; x.fillRect(0, H - 40, W, 40);
  return tex(c);
}
function leafFan(count, spread, len, col) {
  const g = new THREE.Group(), geo = new THREE.PlaneGeometry(0.9, len, 1, 4); geo.translate(0, len / 2, 0);
  const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / len; pos.setX(i, pos.getX(i) * (1 - Math.abs(y - 0.4) * 1.1)); pos.setZ(i, y * y * 0.8); } geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, side: THREE.DoubleSide }); const r = rnd(7);
  for (let i = 0; i < count; i++) { const l = new THREE.Mesh(geo, m); const a = (i / count) * 6.283 + r(), tl = spread * (0.5 + r() * 0.6); l.rotation.set(0, a, tl, 'YZX'); l.scale.setScalar(0.7 + r() * 0.5); l.castShadow = true; g.add(l); }
  return g;
}
export function buildCourtyard(scene) {
  const g = new THREE.Group();
  const ft = floorTexture();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.72, metalness: 0, envMapIntensity: 0.4 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  // the rug under the board
  const rug = new THREE.Mesh(new THREE.BoxGeometry(78, BASE, 78), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95, envMapIntensity: 0.2 }));
  rug.position.y = BASE / 2; rug.receiveShadow = true; rug.castShadow = true; g.add(rug);
  // whitewashed wall with arched doors, far behind
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(900, 260), new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.9, envMapIntensity: 0.3 }));
  wall.material.map.wrapS = THREE.RepeatWrapping; wall.material.map.repeat.set(3, 1); wall.position.set(0, 130, -330); g.add(wall);
  // a terracotta pot with an olive, back left
  const pot = new THREE.Group();
  const potM = new THREE.MeshStandardMaterial({ color: 0xb5562e, roughness: 0.7, envMapIntensity: 0.5 });
  const body = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [5.2, 0], [6.6, 3], [8, 16], [8.4, 19], [7.4, 19.6], [7.6, 17], [0, 17]].map(([r, y]) => new THREE.Vector2(r, y)), 36), potM); body.castShadow = true; body.receiveShadow = true; pot.add(body);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(7.4, 24), new THREE.MeshStandardMaterial({ color: 0x3a2616, roughness: 1 })); soil.rotation.x = -Math.PI / 2; soil.position.y = 16.5; pot.add(soil);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 22, 8), new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.9 })); trunk.position.y = 27; trunk.rotation.z = 0.12; trunk.castShadow = true; pot.add(trunk);
  const crown = leafFan(34, 1.1, 10, 0x6f8a4a); crown.position.y = 36; crown.scale.setScalar(1.25); pot.add(crown);
  pot.position.set(-34, 0, -52); g.add(pot);
  // brass tray with two tea glasses, front right
  const tray = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xd5a64d, roughness: 0.32, metalness: 1, envMapIntensity: 1.5 });
  const plate = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [13, 0.05], [14.2, 1.2], [14.6, 1.5]].map(([r, y]) => new THREE.Vector2(r, y)), 40), brass); plate.castShadow = true; plate.receiveShadow = true; tray.add(plate);
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0xf2c58a, roughness: 0.05, transmission: 0.5, thickness: 0.6, ior: 1.4, transparent: true, opacity: 0.85, envMapIntensity: 1.6 });
  for (const [gx, gz] of [[-4.5, 1], [4.5, -1.5]]) { const gl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.1], [1.7, 0.1], [2.4, 6.4], [2.5, 6.8]].map(([r, y]) => new THREE.Vector2(r, y)), 20), glassM); gl.position.set(gx, 1.3, gz); gl.castShadow = true; tray.add(gl); const tea = new THREE.Mesh(new THREE.CircleGeometry(2.1, 16), new THREE.MeshStandardMaterial({ color: 0x8a3c10, roughness: 0.3, emissive: 0x401000, emissiveIntensity: 0.4 })); tea.rotation.x = -Math.PI / 2; tea.position.set(gx, 6.5, gz); tray.add(tea); }
  tray.position.set(30, 0, 58); g.add(tray);
  g.userData.props = { pot, tray };
  scene.add(g); return g;
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x8a5430, 0.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b4, 2.7); sun.position.set(-70, 120, 60);
  sun.shadow.camera.left = -46; sun.shadow.camera.right = 46; sun.shadow.camera.top = 46; sun.shadow.camera.bottom = -46; sun.shadow.camera.near = 20; sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  return { hemi, sun };
}
