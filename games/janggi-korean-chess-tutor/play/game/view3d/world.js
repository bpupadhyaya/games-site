// Janggi 3D world (procedural, no image files). Units are centimetres. A janggi board (janggipan) on low bracket feet in a hanok
// room: oiled-paper ondol floor, lattice paper doors (changho) glowing with daylight, white-brass corner fittings, octagonal
// carved pieces in traditional sizes with lacquer-filled characters. Shared by the presenter (play / menu) and the icon page.
import * as THREE from '../vendor3d/three.js';
import { board3d as B } from '../vendor3d/index.js';

export const C = 4.6;                                  // point spacing (a real board: about 4.5-4.8 cm)
export const FEET = 2.6, BODY = 8.8, TOP = FEET + BODY; // board top height above the floor
export const BX = 4 * C + 4.8, BZ = 4.5 * C + 4.8;     // half sizes of the board top
export const SIZE_K = [0, 1.13, 0.84, 0.88, 0.93, 0.99, 0.95, 0.78];   // same ratios as the flat art (pieces.js)
export const apothem = (t) => C * 0.447 * SIZE_K[t];   // centre-to-edge of the octagon (general about 4.6 cm across)
export const thick = (t) => 0.95 + 0.42 * SIZE_K[t];   // tile thickness (general ~1.4 cm, soldier ~1.25 cm)
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ctex = (c, srgb = true, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
export const CJK = '"Janggi Serif", "Noto Serif KR", "Noto Serif TC", "Songti SC", "Batang", serif';
export const LATIN = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const CHO_G = ['', '楚', '士', '象', '馬', '車', '包', '卒'], HAN_G = ['', '漢', '士', '象', '馬', '車', '包', '兵'], EN_G = ['', 'K', 'G', 'E', 'H', 'R', 'C', 'S'];
const glyph = (p, lang) => (lang === 'en' ? EN_G[Math.abs(p)] : p > 0 ? CHO_G[p] : HAN_G[-p]);

// square index (0..89, rank 0 = Han's back rank, far side for Cho) -> world point on the board top
export const sqPos = (sq) => { const gx = sq % 9, gy = (sq / 9) | 0; return { x: (gx - 4) * C, z: (gy - 4.5) * C }; };

// ---------------------------------------------------------------- wood grain helper (long fibres + rays, light and bump)
function grain(x, w, h, c0, c1, seed, { lines = 160, alpha = 0.16, dark = '60,34,12', knots = 2 } = {}) {
  const r = lcg(seed), g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c0);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < lines; i++) {
    const y = r() * h, a = alpha * (0.3 + r() * 0.7), amp = 2 + r() * 10, ph = r() * TAU, f = 1 + r() * 3;
    x.strokeStyle = `rgba(${dark},${a})`; x.lineWidth = 0.6 + r() * 2.2; x.beginPath();
    for (let k = 0; k <= 40; k++) { const px = (k / 40) * w, py = y + Math.sin(ph + (k / 40) * TAU * f) * amp; if (k) x.lineTo(px, py); else x.moveTo(px, py); }
    x.stroke();
  }
  for (let i = 0; i < knots; i++) {
    const kx = r() * w, ky = r() * h;
    for (let j = 8; j > 0; j--) { x.strokeStyle = `rgba(${dark},${0.05 + 0.02 * (8 - j)})`; x.lineWidth = 1.2; x.beginPath(); x.ellipse(kx, ky, j * 7, j * 2.4, 0, 0, TAU); x.stroke(); }
  }
  for (let i = 0; i < 9; i++) { const gx = r() * w, gy = r() * h, rg = x.createRadialGradient(gx, gy, 4, gx, gy, w * 0.3); rg.addColorStop(0, `rgba(${dark},0.05)`); rg.addColorStop(1, `rgba(${dark},0)`); x.fillStyle = rg; x.fillRect(0, 0, w, h); }
}

// ---------------------------------------------------------------- the board top: ink (pine) or mother-of-pearl in black lacquer (night)
export function boardFace(theme = 'hanji', lang = 'ko', res = 1024) {
  const W = res, H = Math.round(res * BZ / BX), m = cv(W, H), b = cv(W, H), x = m.getContext('2d'), y = b.getContext('2d');
  const night = theme === 'night';
  if (night) {
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1b1412'); g.addColorStop(0.5, '#110c0b'); g.addColorStop(1, '#1a1311'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const r = lcg(5); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,220,180,${0.006 + r() * 0.01})`; x.fillRect(0, r() * H, W, 1 + r() * 3); }
  } else grain(x, W, H, '#d9a55c', '#e8bb72', 17, { lines: 240, alpha: 0.16, dark: '110,62,18', knots: 1 });
  y.fillStyle = '#808080'; y.fillRect(0, 0, W, H);
  const k = W / (2 * BX), px = (gx) => (gx * C - 4 * C + BX) * k, pz = (gy) => (gy * C - 4.5 * C + BZ) * k;
  // the ink (or shell) strokes, with their engraving in the bump map
  const stroke = (paint) => {
    if (night) {
      const sh = x.createLinearGradient(0, 0, W, H);
      sh.addColorStop(0, '#f4e9ff'); sh.addColorStop(0.2, '#b9f0e6'); sh.addColorStop(0.42, '#fff4d8'); sh.addColorStop(0.63, '#ffd2e6'); sh.addColorStop(0.82, '#c8e6ff'); sh.addColorStop(1, '#f6f0d8');
      x.strokeStyle = sh; x.fillStyle = sh;
    } else { x.strokeStyle = 'rgba(28,16,8,0.9)'; x.fillStyle = 'rgba(28,16,8,0.9)'; }
    paint(x); y.strokeStyle = night ? '#a8a8a8' : '#5a5a5a'; y.fillStyle = y.strokeStyle; paint(y);
  };
  const lw = 0.34 * k;
  stroke((c) => {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = lw * 2.1; c.strokeRect(px(0) - 0.7 * k, pz(0) - 0.7 * k, px(8) - px(0) + 1.4 * k, pz(9) - pz(0) + 1.4 * k);
    c.lineWidth = lw; c.beginPath();
    for (let j = 0; j < 10; j++) { c.moveTo(px(0), pz(j)); c.lineTo(px(8), pz(j)); }
    for (let i = 0; i < 9; i++) { c.moveTo(px(i), pz(0)); c.lineTo(px(i), pz(9)); }
    for (const [a, bb, cc, d] of [[3, 0, 5, 2], [5, 0, 3, 2], [3, 7, 5, 9], [5, 7, 3, 9]]) { c.moveTo(px(a), pz(bb)); c.lineTo(px(cc), pz(d)); }
    c.stroke();
    // cannon and soldier marks
    c.lineWidth = lw * 0.85; const g = 0.42 * k, l = 1.0 * k;
    for (const [i, j] of [[1, 2], [7, 2], [1, 7], [7, 7], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3], [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]]) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      if ((i === 0 && sx < 0) || (i === 8 && sx > 0)) continue;
      const cx = px(i) + sx * g, cz = pz(j) + sy * g; c.beginPath(); c.moveTo(cx + sx * l, cz); c.lineTo(cx, cz); c.lineTo(cx, cz + sy * l); c.stroke();
    }
    // outer border band, inset from the edge
    c.lineWidth = lw * 0.7; c.strokeRect(1.6 * k, 1.6 * k, W - 3.2 * k, H - 3.2 * k);
  });
  // a quiet watermark between the two camps (Hanja 將棋 / JANGGI), brushed in the grain
  x.save(); x.globalAlpha = night ? 0.12 : 0.07; x.fillStyle = night ? '#f2e3c0' : '#3a2410'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const cz = (pz(4) + pz(5)) / 2;
  if (lang === 'en') { x.font = `700 ${Math.round(3.4 * k)}px ${LATIN}`; x.fillText('JANGGI', W / 2, cz); }
  else { x.font = `700 ${Math.round(4.2 * k)}px ${CJK}`; x.fillText('將', px(2), cz); x.fillText('棋', px(6), cz); }
  x.restore();
  // wear: a darker patina where hands slide pieces, near each player's side
  if (!night) for (const zz of [pz(1.5), pz(7.5)]) { const rg = x.createRadialGradient(W / 2, zz, 10, W / 2, zz, W * 0.45); rg.addColorStop(0, 'rgba(150,96,40,0.08)'); rg.addColorStop(1, 'rgba(150,96,40,0)'); x.fillStyle = rg; x.fillRect(0, 0, W, H); }
  return { map: ctex(m), bump: ctex(b, false) };
}

export function buildBoard(theme = 'hanji', lang = 'ko', res = 1024) {
  const night = theme === 'night', grp = new THREE.Group();
  const face = boardFace(theme, lang, res);
  const topMat = night
    ? new THREE.MeshPhysicalMaterial({ map: face.map, bumpMap: face.bump, bumpScale: 0.8, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0.0 })
    : new THREE.MeshPhysicalMaterial({ map: face.map, bumpMap: face.bump, bumpScale: 1.4, roughness: 0.52, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(2 * BX - 0.9, 2 * BZ - 0.9), topMat);
  top.rotation.x = -Math.PI / 2; top.position.y = TOP + 0.012; top.receiveShadow = true; grp.add(top);
  const bodyC = night ? ['#1a100d', '#2a1914'] : ['#a8723a', '#c58a48'];
  const bodyMat = night ? B.material('lacquer', { color: '#1c110e', color2: '#2b1912', seed: 3 }) : B.material('wood', { color: bodyC[0], color2: bodyC[1], seed: 7, repeat: [1, 1] });
  const body = new THREE.Mesh(B.slab(2 * BX, 2 * BZ, BODY, 0.9, 0.45), bodyMat); body.position.y = FEET; body.castShadow = true; body.receiveShadow = true; grp.add(body);
  // a carved groove line around the apron
  const groove = new THREE.Mesh(B.slab(2 * BX + 0.08, 2 * BZ + 0.08, 0.22, 0.95, 0.05), new THREE.MeshStandardMaterial({ color: night ? 0x070403 : 0x5a3616, roughness: 0.8 }));
  groove.position.y = FEET + BODY * 0.42; grp.add(groove);
  // white-brass (baektong) corner fittings: L plates on the four vertical corners, with three domed nails each
  const brass = new THREE.MeshPhysicalMaterial({ color: night ? 0xd9cfae : 0xe6d7a6, metalness: 1, roughness: 0.32, clearcoat: 0.3 });
  const nail = new THREE.SphereGeometry(0.22, 10, 6, 0, TAU, 0, Math.PI / 2);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const L = 3.4, hgt = BODY * 0.7, th = 0.12, y0 = FEET + BODY * 0.15;
    for (const along of ['x', 'z']) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(along === 'x' ? L : th, hgt, along === 'x' ? th : L), brass);
      pl.position.set(sx * (BX - (along === 'x' ? L / 2 - 0.3 : -0.04)), y0 + hgt / 2, sz * (BZ - (along === 'z' ? L / 2 - 0.3 : -0.04)));
      pl.castShadow = true; grp.add(pl);
      for (const fy of [0.25, 0.75]) { const n = new THREE.Mesh(nail, brass); n.position.set(sx * (BX + (along === 'x' ? 0 : 0.1)) - (along === 'x' ? sx * (L * 0.55) : 0), y0 + hgt * fy, sz * (BZ + (along === 'z' ? 0 : 0.1)) - (along === 'z' ? sz * (L * 0.55) : 0)); n.rotation.set(along === 'x' ? sz * Math.PI / 2 : 0, 0, along === 'z' ? -sx * Math.PI / 2 : 0); grp.add(n); }
    }
  }
  // bracket feet (cloud-shaped in the real thing; rounded blocks here)
  const footMat = night ? bodyMat : B.material('wood', { color: '#8d5b2c', color2: '#a86f38', seed: 11 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const f = new THREE.Mesh(B.slab(5.2, 5.2, FEET + 0.2, 1.2, 0.5), footMat); f.position.set(sx * (BX - 3.2), 0, sz * (BZ - 3.2)); f.castShadow = true; f.receiveShadow = true; grp.add(f); }
  grp.userData.dispose = () => { face.map.dispose(); face.bump.dispose(); topMat.dispose(); };
  return grp;
}

// ---------------------------------------------------------------- pieces
function octShape(a, round = 0.18) {
  const R = a / Math.cos(Math.PI / 8), pts = [];
  for (let i = 0; i < 8; i++) { const ang = (i * 45 + 22.5) * Math.PI / 180; pts.push([Math.cos(ang) * R, Math.sin(ang) * R]); }
  const s = new THREE.Shape(), rad = a * round;
  for (let i = 0; i < 8; i++) {
    const p0 = pts[(i + 7) % 8], p1 = pts[i], p2 = pts[(i + 1) % 8];
    const q0 = [p1[0] + (p0[0] - p1[0]) * 0.24, p1[1] + (p0[1] - p1[1]) * 0.24], q1 = [p1[0] + (p2[0] - p1[0]) * 0.24, p1[1] + (p2[1] - p1[1]) * 0.24];
    if (i === 0) s.moveTo(q0[0], q0[1]); else s.lineTo(q0[0], q0[1]);
    s.quadraticCurveTo(p1[0], p1[1], q1[0], q1[1]);
  }
  s.closePath(); void rad; return s;
}
const geoCache = new Map();
export function pieceGeo(t) {
  if (geoCache.has(t)) return geoCache.get(t);
  const a = apothem(t), h = thick(t), bev = Math.min(0.32, h * 0.24);
  const g = new THREE.ExtrudeGeometry(octShape(a - bev * 0.6), { depth: h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 5, curveSegments: 7 });
  // caps get a face texture mapped over the octagon; sides keep the same projection (reads as end grain)
  const pos = g.attributes.position, uv = g.attributes.uv, R = a * 1.09;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * R) + 0.5, pos.getY(i) / (2 * R) + 0.5);
  g.translate(0, 0, bev); g.rotateX(-Math.PI / 2);               // extruded along +y, bottom at y = 0, top face at y = h
  g.computeVertexNormals();
  geoCache.set(t, g); return g;
}
const SETS = {
  boxwood: { face: ['#fff6df', '#f3e2b8'], edge: ['#a86c34', '#c08048'], cho: '#06663a', han: '#b3120a', ring: 0.9, dark: '120,70,20' },
  ebony: { face: ['#3b2a22', '#2a1c16'], edge: ['#2a1c16', '#3d2b21'], cho: '#3fe08e', han: '#ff5a3c', ring: 0.9, dark: '0,0,0' },
};
const faceCache = new Map();
// the top face: wood + carved octagon ring + the character, carved and filled with coloured lacquer (bump map = carving)
export function pieceFaceMat(p, set = 'boxwood', lang = 'ko', res = 256) {
  const key = `${p}|${set}|${lang}|${res}`; if (faceCache.has(key)) return faceCache.get(key);
  const S = SETS[set] ?? SETS.boxwood, t = Math.abs(p), cho = p > 0, m = cv(res), b = cv(res), x = m.getContext('2d'), y = b.getContext('2d');
  grain(x, res, res, S.face[1], S.face[0], 31 + t * 7 + (cho ? 0 : 101), { lines: 60, alpha: set === 'ebony' ? 0.25 : 0.2, dark: S.dark, knots: 0 });
  y.fillStyle = '#9a9a9a'; y.fillRect(0, 0, res, res);
  const c = res / 2, a = res / 2 / 1.09, col = cho ? S.cho : S.han;
  const oct = (ctx, r) => { const R = r / Math.cos(Math.PI / 8); ctx.beginPath(); for (let i = 0; i < 8; i++) { const ang = (i * 45 + 22.5) * Math.PI / 180; const px = c + Math.cos(ang) * R, py = c + Math.sin(ang) * R; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath(); };
  // carved ring
  for (const [ctx, sty] of [[x, col], [y, '#3a3a3a']]) { ctx.strokeStyle = sty; ctx.lineWidth = a * 0.065; oct(ctx, a * 0.8); ctx.stroke(); if (t === 1) { ctx.lineWidth = a * 0.035; oct(ctx, a * 0.7); ctx.stroke(); } }
  // character
  const en = lang === "en", gs = en ? a * 1.05 : t === 1 ? a * 1.06 : a * 1.12;
  for (const [ctx, sty] of [[x, col], [y, '#262626']]) { ctx.font = `700 ${gs.toFixed(1)}px ${en ? LATIN : CJK}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = sty; ctx.fillText(glyph(p, lang), c, c + a * 0.05); }
  // lacquer darker at the bottom of the cut
  x.save(); x.globalCompositeOperation = 'source-atop'; x.restore();
  const mat = new THREE.MeshPhysicalMaterial({ map: ctex(m), bumpMap: ctex(b, false), bumpScale: 3.0, roughness: set === 'ebony' ? 0.36 : 0.46, clearcoat: 0.55, clearcoatRoughness: 0.3 });
  const out = [mat, sideMat(set)];
  faceCache.set(key, out); return out;
}
export function flushPieceMats() { for (const [, v] of faceCache) { v[0].map?.dispose(); v[0].bumpMap?.dispose(); v[0].dispose(); } faceCache.clear(); }
const sideCache = {};
function sideMat(set) {
  if (sideCache[set]) return sideCache[set];
  const S = SETS[set] ?? SETS.boxwood, c = cv(128), x = c.getContext('2d');
  grain(x, 128, 128, S.edge[0], S.edge[1], 9, { lines: 30, alpha: 0.2, dark: S.dark, knots: 0 });
  return (sideCache[set] = new THREE.MeshPhysicalMaterial({ map: ctex(c), roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.35 }));
}

// ---------------------------------------------------------------- the room
function ondolCanvas(res = 1024) {
  // jangpan-ji: thick mulberry paper pasted in overlapping sheets and soaked in bean oil: glossy ochre, every seam slightly darker
  const c = cv(res), x = c.getContext('2d'), r = lcg(77);
  x.fillStyle = '#a8733a'; x.fillRect(0, 0, res, res);
  for (let i = 0; i < 26; i++) { const gx = r() * res, gy = r() * res, rg = x.createRadialGradient(gx, gy, 5, gx, gy, 80 + r() * 200); rg.addColorStop(0, `rgba(${r() < 0.5 ? '214,160,84' : '160,104,40'},0.35)`); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = rg; x.fillRect(0, 0, res, res); }
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,230,180' : '90,50,15'},${0.03 + r() * 0.05})`; x.fillRect(r() * res, r() * res, 1 + r() * 7, 0.6 + r()); }
  const n = 4, s = res / n;
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    const ox = (row % 2) * s * 0.5, X = col * s + ox, Y = row * s;
    x.strokeStyle = 'rgba(110,62,20,0.38)'; x.lineWidth = 3; x.strokeRect(X + 1.5, Y + 1.5, s - 3, s - 3);
    x.strokeStyle = 'rgba(255,228,170,0.16)'; x.lineWidth = 1.4; x.strokeRect(X + 4, Y + 4, s - 8, s - 8);
    if (ox) { x.strokeStyle = 'rgba(110,62,20,0.38)'; x.lineWidth = 3; x.strokeRect(X - res + 1.5, Y + 1.5, s - 3, s - 3); }
  }
  return c;
}
function doorCanvas(res = 512) {
  // a changho paper door: hanji glowing with daylight behind a dense lattice (ttisal) and a plain lower panel
  const W = res, H = res * 2, c = cv(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fff3dc'); g.addColorStop(0.55, '#ffe6bd'); g.addColorStop(1, '#f2c98f'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const r = lcg(3); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(200,150,90,${0.02 + r() * 0.04})`; x.fillRect(r() * W, r() * H, 2 + r() * 10, 0.7); }
  const wood = '#3d2412', fr = W * 0.07;
  x.fillStyle = wood; x.fillRect(0, 0, W, fr); x.fillRect(0, H - fr * 1.2, W, fr * 1.2); x.fillRect(0, 0, fr, H); x.fillRect(W - fr, 0, fr, H);
  x.fillRect(0, H * 0.86, W, fr * 0.8); x.fillStyle = '#5a3720'; x.fillRect(fr, H * 0.86 + fr * 0.8, W - 2 * fr, H * 0.14 - fr * 2);   // lower wooden panel
  x.fillStyle = wood; const bars = 7, rows = 15, w = (W - 2 * fr) / bars, hh = (H * 0.86 - fr) / rows, t = W * 0.016;
  for (let i = 1; i < bars; i++) x.fillRect(fr + i * w - t / 2, fr, t, H * 0.86 - fr);
  for (let j = 1; j < rows; j++) x.fillRect(fr, fr + j * hh - t / 2, W - 2 * fr, t);
  // a small window-in-the-door (nunkkopjip) in the middle
  x.fillStyle = 'rgba(255,250,236,0.9)'; x.fillRect(W * 0.36, H * 0.38, W * 0.28, H * 0.12); x.strokeStyle = wood; x.lineWidth = t * 1.2; x.strokeRect(W * 0.36, H * 0.38, W * 0.28, H * 0.12);
  return c;
}
function latticeLightCanvas(res = 512) {
  const c = cv(res), x = c.getContext('2d'); x.filter = 'blur(6px)';
  const bars = 7, rows = 9, w = res / bars, h = res / rows;
  for (let i = 0; i < bars; i++) for (let j = 0; j < rows; j++) { const fall = 1 - Math.abs(i - 3) / 5; x.fillStyle = `rgba(255,214,150,${0.5 * fall})`; x.fillRect(i * w + 4, j * h + 4, w - 9, h - 9); }
  x.filter = 'none';
  const g = x.createRadialGradient(res / 2, res / 2, res * 0.2, res / 2, res / 2, res * 0.55); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = g; x.fillRect(0, 0, res, res);
  return c;
}
function bojagiCanvas(res = 256) {
  // jogakbo: patchwork wrapping cloth of ramie scraps in muted obangsaek colours with visible seams
  const c = cv(res), x = c.getContext('2d'), r = lcg(41), cols = ['#c94b3c', '#2f6e9e', '#e2b64a', '#efe6d0', '#5c8a5a', '#9b3f6b', '#d98d3a'];
  const rects = [[0, 0, res, res]];
  for (let k = 0; k < 22; k++) { const i = (r() * rects.length) | 0, [X, Y, W, H] = rects.splice(i, 1)[0]; if (W > H) { const s = W * (0.3 + r() * 0.4); rects.push([X, Y, s, H], [X + s, Y, W - s, H]); } else { const s = H * (0.3 + r() * 0.4); rects.push([X, Y, W, s], [X, Y + s, W, H - s]); } }
  for (const [X, Y, W, H] of rects) { x.fillStyle = cols[(r() * cols.length) | 0]; x.fillRect(X, Y, W, H); x.strokeStyle = 'rgba(255,250,235,0.55)'; x.lineWidth = 1.6; x.strokeRect(X + 1, Y + 1, W - 2, H - 2); }
  for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.05})`; x.fillRect(r() * res, r() * res, 1, 3); }
  return c;
}

export function buildRoom(scene, { quality = 1 } = {}) {
  const grp = new THREE.Group(); scene.add(grp);
  const floorT = ctex(ondolCanvas(quality ? 1024 : 512), true, [3.2, 3.2]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), new THREE.MeshPhysicalMaterial({ map: floorT, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.28 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; grp.add(floor);
  // lattice daylight thrown across the floor from the doors behind the board (soft, additive)
  const ll = new THREE.Mesh(new THREE.PlaneGeometry(150, 120), new THREE.MeshBasicMaterial({ map: ctex(latticeLightCanvas()), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
  ll.rotation.x = -Math.PI / 2; ll.rotation.z = 0.32; ll.position.set(-20, 0.05, -24); ll.renderOrder = 1; grp.add(ll);
  // the paper doors: a wall of four changho panels behind (and, for the far player's view, in front)
  const doorT = ctex(doorCanvas(quality ? 512 : 256));
  const doorMat = new THREE.MeshBasicMaterial({ map: doorT, color: 0xfff0d8, fog: true });
  const postMat = B.material('darkWood', { color: '#2f1a0d', color2: '#4a2c16', seed: 5 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd9c3a0, roughness: 0.95 });
  for (const side of [-1, 1]) {
    const z = side * (side < 0 ? 150 : 300), wall = new THREE.Group(); wall.position.z = z; wall.rotation.y = side < 0 ? 0 : Math.PI; grp.add(wall);
    for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(76, 152), doorMat); d.position.set(-114 + i * 76, 80, 0); wall.add(d); }
    for (const px of [-160, 160]) { const p = new THREE.Mesh(new THREE.BoxGeometry(14, 240, 14), postMat); p.position.set(px, 120, 2); p.castShadow = true; wall.add(p); }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(340, 6, 10), postMat); sill.position.set(0, 3, 2); wall.add(sill);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(340, 12, 12), postMat); lintel.position.set(0, 162, 2); wall.add(lintel);
    for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(200, 260), wallMat); w.position.set(sx * 267, 130, -1); wall.add(w); }
    const upper = new THREE.Mesh(new THREE.PlaneGeometry(330, 100), wallMat); upper.position.set(0, 218, -1); wall.add(upper);
  }
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(460, 280), wallMat); w.position.set(sx * 230, 140, 75); w.rotation.y = -sx * Math.PI / 2; grp.add(w); }
  return { group: grp, floorT, doorT, lattice: ll };
}

// props beside the board: a celadon tea bowl on its saucer, a folded jogakbo cloth, the paulownia piece box
export function buildProps() {
  const grp = new THREE.Group();
  const celadon = new THREE.MeshPhysicalMaterial({ color: 0x9cc4ad, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.2 });
  const tea = new THREE.MeshStandardMaterial({ color: 0x6b4a14, roughness: 0.05, metalness: 0.1 });
  const cup = new THREE.Mesh(B.lathe([[0, 0], [2.0, 0], [2.2, 0.4], [3.2, 2.2], [4.0, 5.2], [4.15, 6.3], [3.9, 6.3], [3.75, 5.1], [3.0, 2.4], [0, 1.6]], 40), celadon);
  const saucer = new THREE.Mesh(B.lathe([[0, 0], [3.4, 0], [3.6, 0.3], [6.2, 0.9], [6.5, 1.25], [6.2, 1.3], [3.5, 0.75], [0, 0.7]], 40), celadon);
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(3.55, 32), tea); liquid.rotation.x = -Math.PI / 2; liquid.position.y = 5.0;
  const cupG = new THREE.Group(); cup.position.y = 0.75; liquid.position.y += 0.75; cupG.add(saucer, cup, liquid);
  [cup, saucer].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
  cupG.userData.kind = 'cup'; grp.add(cupG);
  const cloth = new THREE.Mesh(B.slab(26, 20, 1.4, 2.4, 0.6), new THREE.MeshStandardMaterial({ map: ctex(bojagiCanvas()), roughness: 0.92 }));
  cloth.castShadow = true; cloth.receiveShadow = true; cloth.userData.kind = 'cloth'; grp.add(cloth);
  const boxMat = B.material('wood', { color: '#b98c5a', color2: '#d0a777', seed: 23 });
  const box = new THREE.Group(), base = new THREE.Mesh(B.slab(18, 12, 5.2, 0.6, 0.25), boxMat), lid = new THREE.Mesh(B.slab(18.6, 12.6, 1.5, 0.7, 0.35), boxMat);
  lid.position.set(9.5, 0, 2.2); lid.rotation.y = 0.38; base.castShadow = lid.castShadow = true; base.receiveShadow = lid.receiveShadow = true; box.add(base, lid); box.userData.kind = 'box'; grp.add(box);
  return { group: grp, cup: cupG, cloth, box };
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffeedd, 0x5a3418, 0.55); scene.add(hemi);
  // key: daylight through the paper doors behind-left, high and soft
  const sun = new THREE.DirectionalLight(0xfff0d6, 3.0); sun.position.set(-90, 105, -80); sun.target.position.set(0, 0, 0);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70; sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70; sun.shadow.camera.near = 20; sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5; scene.add(sun, sun.target);
  // fill from the room side, rim from the far door (a warm edge on the pieces)
  const fill = new THREE.DirectionalLight(0xffe2bc, 0.55); fill.position.set(80, 60, 120); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffd8a0, 0.9); rim.position.set(40, 40, -160); scene.add(rim);
  return { hemi, sun, fill, rim };
}

export function radialTex(rgb, a = 1, size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return ctex(c);
}
// marker textures (white, tinted per use): soft glow, solid dot, ring, dashed ring, rounded square cursor
export function markTextures() {
  const mk = (paint) => { const c = cv(128), x = c.getContext('2d'); paint(x); return ctex(c); };
  return {
    glow: mk((x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.45, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }),
    dot: mk((x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,1)'); g.addColorStop(0.42, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }),
    ring: mk((x) => { x.strokeStyle = '#fff'; x.lineWidth = 9; x.filter = 'blur(1.5px)'; x.beginPath(); x.arc(64, 64, 52, 0, TAU); x.stroke(); }),
    dash: mk((x) => { x.strokeStyle = '#fff'; x.lineWidth = 8; x.setLineDash([16, 12]); x.beginPath(); x.arc(64, 64, 52, 0, TAU); x.stroke(); }),
    square: mk((x) => { x.strokeStyle = '#fff'; x.lineWidth = 7; x.beginPath(); x.roundRect(10, 10, 108, 108, 16); x.stroke(); }),
    cross: mk((x) => { x.strokeStyle = '#fff'; x.lineWidth = 12; x.lineCap = 'round'; x.beginPath(); x.moveTo(30, 30); x.lineTo(98, 98); x.moveTo(98, 30); x.lineTo(30, 98); x.stroke(); }),
  };
}
