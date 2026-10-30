// Ludus Latrunculorum 3D world (units: centimetres). A marble tabula on a polished black-and-gold marble table in a Roman
// room at night: Pompeian red walls with black dado, fluted columns, a bronze candelabrum and a bronze oil lamp (lucerna) whose
// flames light the board. Soldiers are plano-convex counters (turned bone vs smoked glass, like real Roman gaming pieces); the dux
// is a taller domed counter with a gilt band and stud. Everything is procedural (canvas textures + analytic geometry): no images.
// Shared by the presenter and the icon page.
import * as THREE from '../vendor3d/three.js';

export const N = 8;
export const C = 4.6;                          // square size (cm)
export const FIELD = N * C;                    // 36.8 cm playing field
export const BAND = 4.6;                       // border band (letters + meander)
export const HALF = FIELD / 2 + BAND + 0.8;    // slab half width (~23.8 cm)
export const SLAB_H = 3.0;                     // slab thickness
export const BEVEL = 0.5;
export const TOP = SLAB_H + BEVEL;             // the playing face above the table top (table top is y = 0)
export const SOL_R = 1.62, SOL_H = 1.15;       // soldier counter: 3.2 cm across, ~1.2 cm high
export const DUX_R = 1.9, DUX_H = 2.3;         // dux: 3.8 cm across, ~2.3 cm high
export const LAMP = new THREE.Vector3(31, 2.6, -17);          // the lucerna's flame on the table
export const CANDLE = new THREE.Vector3(-30, 2.6, -36);          // a second lucerna's flame, back left
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
export const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi + seed * 131, yi), b = hash(xi + 1 + seed * 131, yi), c = hash(xi + seed * 131, yi + 1), d = hash(xi + 1 + seed * 131, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, seed, oct = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i); f *= 2.03; a *= 0.5; } return s; };
const mkCanvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } return t; };

// Square i -> world (x, z). Row 0 is the far side; when the player takes Jet the board is turned half a circle.
export const cellPos = (i, flip = false) => { const k = flip ? N * N - 1 - i : i, c = k % N, r = (k - c) / N; return { x: (c - (N - 1) / 2) * C, z: (r - (N - 1) / 2) * C }; };
export const cellAtWorld = (x, z, flip = false) => {
  const c = Math.floor(x / C + N / 2), r = Math.floor(z / C + N / 2);
  if (c < 0 || r < 0 || c >= N || r >= N) return -1;
  const k = r * N + c; return flip ? N * N - 1 - k : k;
};

// ---- marble -------------------------------------------------------------------------------------------------------
// kind: carrara (white, grey veins), nero (black, gold veins), porphyry (imperial purple-red, pale specks)
const MARBLE = {
  carrara: { base: [240, 237, 229], dark: [214, 209, 199], vein: [120, 126, 136], vein2: [168, 160, 146], inlay: '#a8864a', groove: 'rgba(60,54,44,0.85)', lip: 'rgba(255,255,255,0.75)', specks: 0, vk: 0.55 },
  nero: { base: [40, 39, 44], dark: [24, 24, 28], vein: [214, 172, 96], vein2: [170, 170, 180], inlay: '#d2aa5c', groove: 'rgba(0,0,0,0.9)', lip: 'rgba(255,224,160,0.35)', specks: 0, vk: 0.38 },
  porphyry: { base: [122, 50, 66], dark: [86, 32, 48], vein: [80, 26, 40], vein2: [140, 64, 80], inlay: '#e0b47a', groove: 'rgba(30,6,14,0.9)', lip: 'rgba(255,200,190,0.35)', specks: 1, vk: 0.25 },
  table: { base: [30, 34, 31], dark: [16, 18, 17], vein: [150, 156, 146], vein2: [90, 104, 96], specks: 0, vk: 0.28 },
};
function marbleField(size, kind, seed) {
  const M = MARBLE[kind], LS = Math.min(256, size), lc = mkCanvas(LS), lx = lc.getContext('2d'), img = lx.createImageData(LS, LS);
  for (let j = 0; j < LS; j++) for (let i = 0; i < LS; i++) {
    const x = i / LS * 6, y = j / LS * 6, w = fbm(x * 0.32, y * 0.32, seed, 4) + 0.25 * fbm(x * 1.3, y * 1.3, seed + 2, 2);
    const cloud = fbm(x * 0.6 + 3, y * 0.6, seed + 5, 4);
    // veins: long soft ridges of a gently warped sine field (marble is streaked, not crackled)
    const v1 = Math.abs(Math.sin((x * 0.55 + y * 0.3 + w * 2.6) * 1.7)), v2 = Math.abs(Math.sin((x * 0.2 - y * 0.75 + w * 3.4) * 2.2));
    const vk = M.vk ?? 0.5, vein = Math.pow(1 - v1, 7) * (0.35 + 0.65 * fbm(x * 0.9, y * 0.9, seed + 9, 3)) * vk, vein2 = Math.pow(1 - v2, 16) * 0.6 * vk;
    const k = (j * LS + i) * 4;
    for (let ch = 0; ch < 3; ch++) {
      let c = M.base[ch] + (M.dark[ch] - M.base[ch]) * Math.max(0, Math.min(1, (cloud - 0.35) * 1.6));
      c += (M.vein[ch] - c) * Math.min(1, vein * 1.4); c += (M.vein2[ch] - c) * Math.min(1, vein2);
      img.data[k + ch] = c;
    }
    img.data[k + 3] = 255;
  }
  lx.putImageData(img, 0, 0);
  const c = mkCanvas(size), cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(lc, 0, 0, size, size);
  const d = cx.getImageData(0, 0, size, size), a = d.data, r = lcg(seed + 3);
  for (let p = 0, q = 0; p < a.length; p += 4, q++) { const g = 0.96 + 0.08 * hash(q, seed); a[p] *= g; a[p + 1] *= g; a[p + 2] *= g; }
  cx.putImageData(d, 0, 0);
  if (M.specks) for (let i = 0; i < size * size / 90; i++) { const s = 0.4 + r() * 1.6 * size / 1024; cx.fillStyle = r() < 0.75 ? `rgba(240,214,214,${0.3 + r() * 0.5})` : `rgba(20,6,10,${0.4 + r() * 0.4})`; cx.fillRect(r() * size, r() * size, s, s); }
  return c;
}

// ---- the tabula (board slab) --------------------------------------------------------------------------------------
// Top-face texture over span = 2*HALF. Incised grid, a bronze-inlaid meander band, file letters and rank numbers in the band.
function boardTextures(themeId, flip, size) {
  const M = MARBLE[themeId] ?? MARBLE.carrara, span = 2 * HALF, px = size / span;
  const col = marbleField(size, themeId, themeId === 'nero' ? 31 : themeId === 'porphyry' ? 57 : 11), cx = col.getContext('2d');
  const bump = mkCanvas(size), bx = bump.getContext('2d'); bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  const mr = mkCanvas(size), mx = mr.getContext('2d'); mx.fillStyle = 'rgb(0,58,0)'; mx.fillRect(0, 0, size, size);   // G = roughness, B = metalness
  const P = (cm) => (cm + HALF) * px;
  const f0 = P(-FIELD / 2), f1 = P(FIELD / 2);
  // squares: alternate squares a hair duller (polish wear), like the flat board
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if ((r + c) % 2) { cx.fillStyle = themeId === 'carrara' ? 'rgba(90,86,76,0.08)' : 'rgba(255,255,255,0.035)'; cx.fillRect(f0 + c * C * px, f0 + r * C * px, C * px, C * px); mx.fillStyle = 'rgb(0,74,0)'; mx.fillRect(f0 + c * C * px, f0 + r * C * px, C * px, C * px); }
  // incised grid and frame (groove dark, a light lip on the lower edge, deep in the bump map)
  const line = (ctx, x0, y0, x1, y1, w, s) => { ctx.strokeStyle = s; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  const lw = Math.max(1.5, 0.16 * px);
  for (let k = 0; k <= N; k++) {
    const p = f0 + k * C * px, w = k === 0 || k === N ? lw * 1.6 : lw;
    line(cx, p, f0 - w / 2, p, f1 + w / 2, w, M.groove); line(cx, f0 - w / 2, p, f1 + w / 2, p, w, M.groove);
    line(cx, p + w * 0.7, f0, p + w * 0.7, f1, w * 0.45, M.lip); line(cx, f0, p + w * 0.7, f1, p + w * 0.7, w * 0.45, M.lip);
    line(bx, p, f0, p, f1, w * 1.2, '#202020'); line(bx, f0, p, f1, p, w * 1.2, '#202020');
  }
  // band: an outer meander inlaid in bronze between two incised lines
  const b0 = FIELD / 2 + 0.55, b1 = HALF - 0.75, mid = (b0 + 1.6 + b1) / 2, mh = (b1 - b0 - 1.6) * 0.82;
  for (const off of [b0, b0 + 1.6, b1]) { const a = P(-off), b = P(off), w = lw * 0.9; cx.strokeStyle = M.groove; cx.lineWidth = w; cx.strokeRect(a, a, b - a, b - a); bx.strokeStyle = '#303030'; bx.lineWidth = w * 1.2; bx.strokeRect(a, a, b - a, b - a); }
  const meander = (ctx, style, w) => {
    ctx.strokeStyle = style; ctx.lineWidth = w; ctx.lineJoin = 'miter'; ctx.lineCap = 'square';
    const u = mh / 4, L = mid * 2, n = Math.floor(L / (u * 5)), step = L / n;
    for (let side = 0; side < 4; side++) {
      ctx.save(); ctx.translate(P(0), P(0)); ctx.rotate(side * Math.PI / 2); ctx.translate(-P(0), -P(0));
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const x0 = -mid + k * step + step * 0.08, y = mid + mh / 2;   // bottom band (towards +z), drawn left -> right
        const q = (dx, dy) => [P(x0 + dx * step / 5), P(y - dy * mh / 4)];
        const pts = [[0, 0], [0, 4], [4, 4], [4, 1], [2, 1], [2, 2.6]];
        pts.forEach(([dx, dy], i) => { const [a, b] = q(dx, dy); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); });
      }
      ctx.stroke(); ctx.restore();
    }
  };
  meander(cx, M.inlay, Math.max(2, 0.34 * px)); meander(bx, '#b8b8b8', Math.max(2, 0.34 * px)); meander(mx, 'rgb(0,90,255)', Math.max(2, 0.34 * px));
  // file letters (front) and rank numbers (left), as the Think advice names squares
  const fsz = Math.round(1.05 * px);
  for (const [ctx, style] of [[cx, M.inlay], [mx, 'rgb(0,90,255)'], [bx, '#b0b0b0']]) {
    ctx.fillStyle = style; ctx.font = `700 ${fsz}px "Palatino Linotype", Palatino, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < N; k++) {
      const file = flip ? 'hgfedcba'[k] : 'abcdefgh'[k], rank = flip ? k + 1 : N - k;
      ctx.fillText(file.toUpperCase(), P(-FIELD / 2 + (k + 0.5) * C), P(FIELD / 2 + 0.8 + 0.42));
      ctx.fillText(String(rank), P(-FIELD / 2 - 0.8 - 0.42), P(-FIELD / 2 + (k + 0.5) * C));
    }
  }
  // corner rosettes in the band
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = P(sx * mid), y = P(sy * mid), R = mh * 0.42 * px;
    for (const [ctx, style] of [[cx, M.inlay], [mx, 'rgb(0,90,255)']]) {
      ctx.fillStyle = style; for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5, R * 0.42, R * 0.16, a, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.arc(x, y, R * 0.2, 0, TAU); ctx.fill();
    }
  }
  // fine wear: tiny scratches on the field
  const r = lcg(5);
  for (let i = 0; i < 260; i++) { const x = f0 + r() * (f1 - f0), y = f0 + r() * (f1 - f0), a = r() * TAU, l = (0.3 + r() * 1.5) * px; cx.strokeStyle = themeId === 'carrara' ? 'rgba(120,110,95,0.12)' : 'rgba(255,240,220,0.06)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); cx.stroke(); }
  const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.repeat.set(1 / span, 1 / span); t.offset.set(0.5, 0.5); return t; };
  return { map: mk(col, true), bump: mk(bump, false), mr: mk(mr, false) };
}

function roundedRect(h, r) { const s = new THREE.Shape(); s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h); s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h); return s; }

export function buildBoard(themeId, flip, texSize = 1024) {
  const g = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(roundedRect(HALF - BEVEL, 1.2), { depth: SLAB_H, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 3, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2);
  const t = boardTextures(themeId, flip, texSize);
  const top = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 0.9, roughnessMap: t.mr, metalnessMap: t.mr, roughness: 1, metalness: 1, clearcoat: 0.55, clearcoatRoughness: 0.18, envMapIntensity: 0.55 });
  const sideTex = new THREE.CanvasTexture(marbleField(256, themeId in MARBLE ? themeId : 'carrara', 77)); sideTex.colorSpace = THREE.SRGBColorSpace; sideTex.wrapS = sideTex.wrapT = THREE.RepeatWrapping; sideTex.repeat.set(0.03, 0.08);
  const side = new THREE.MeshPhysicalMaterial({ map: sideTex, color: 0xd8d4cc, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.25, envMapIntensity: 0.5 });
  const m = new THREE.Mesh(geo, [top, side]); m.castShadow = true; m.receiveShadow = true; g.add(m);
  // four low bronze feet under the slab corners
  const foot = new THREE.CylinderGeometry(1.4, 1.8, 0.6, 20), fm = bronzeMat();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const f = new THREE.Mesh(foot, fm); f.position.set(sx * (HALF - 3), -0.3, sz * (HALF - 3)); f.castShadow = true; g.add(f); }
  g.position.y = 0.6;      // sits on its feet
  g.userData.dispose = () => { geo.dispose(); top.dispose(); side.dispose(); sideTex.dispose(); t.map.dispose(); t.bump.dispose(); t.mr.dispose(); foot.dispose(); };
  return g;
}
export const FACE_Y = TOP + 0.6;     // board face height above the table (feet included)

// ---- pieces -------------------------------------------------------------------------------------------------------
// Plano-convex counters (lathe): a flat base with a small chamfer, a full dome. The dux is taller with a raised crown.
function counterProfile(R, H, crown = 0) {
  const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(R * 0.9, 0), new THREE.Vector2(R, R * 0.08), new THREE.Vector2(R, H * 0.16)];
  const n = 18;
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI / 2, r = R * Math.cos(a), y = H * 0.16 + (H * (crown ? 0.7 : 0.84)) * Math.pow(Math.sin(a), 0.85);
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  if (crown) { const y0 = pts[pts.length - 1].y; pts.pop(); pts.push(new THREE.Vector2(R * 0.3, y0 - 0.05), new THREE.Vector2(R * 0.24, y0 + 0.12), new THREE.Vector2(R * 0.26, y0 + crown * 0.6), new THREE.Vector2(R * 0.14, y0 + crown), new THREE.Vector2(0.001, y0 + crown * 1.05)); }
  return pts;
}
export function pieceGeos() {
  return {
    sol: new THREE.LatheGeometry(counterProfile(SOL_R, SOL_H), 40),
    dux: new THREE.LatheGeometry(counterProfile(DUX_R, DUX_H * 0.82, DUX_H * 0.32), 44),
    band: new THREE.TorusGeometry(DUX_R * 0.985, 0.13, 8, 48).rotateX(Math.PI / 2).translate(0, DUX_H * 0.82 * 0.16 + 0.05, 0),
    stud: new THREE.SphereGeometry(0.34, 16, 10).translate(0, DUX_H * 0.82 * 0.86 + DUX_H * 0.32 * 1.05 + 0.02, 0),
  };
}
export function bronzeMat(color = 0xb07a3c) { return new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: 0.34, clearcoat: 0.2, envMapIntensity: 1.1 }); }
export function goldMat() { return new THREE.MeshPhysicalMaterial({ color: 0xe0b45a, metalness: 1, roughness: 0.22, envMapIntensity: 1.3 }); }
export function pieceMaterials() {
  // turned bone: cream with fine lathe rings and a few darker growth lines
  const bc = mkCanvas(64, 256), bx = bc.getContext('2d'), r = lcg(9); bx.fillStyle = '#efe4c9'; bx.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 70; i++) { const y = r() * 256; bx.fillStyle = r() < 0.6 ? `rgba(150,120,80,${0.05 + r() * 0.1})` : `rgba(255,250,236,${0.1 + r() * 0.15})`; bx.fillRect(0, y, 64, 0.6 + r() * 2); }
  for (let i = 0; i < 40; i++) { bx.fillStyle = `rgba(120,96,60,${0.06 + r() * 0.08})`; bx.fillRect(r() * 64, r() * 256, 0.8, 4 + r() * 20); }
  const bone = new THREE.MeshPhysicalMaterial({ map: tex(bc, true), color: 0xf3dfb8, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.32, sheen: 0.3, sheenColor: new THREE.Color(0xfff0d0), envMapIntensity: 0.7 });
  // smoked glass: near-black with a deep teal body, glassy coat, a teal sheen on the rim
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1a20, emissive: 0x03090c, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, ior: 1.52, specularIntensity: 1, sheen: 0.8, sheenRoughness: 0.35, sheenColor: new THREE.Color(0x3f9fb4), envMapIntensity: 1.6 });
  return { 1: bone, 2: glass, gold: goldMat() };
}

// ---- the room -----------------------------------------------------------------------------------------------------
function wallTexture() {
  const W = 1024, H = 512, c = mkCanvas(W, H), x = c.getContext('2d'), r = lcg(21);
  // Pompeian red panels between black pilasters, a black dado below, an ochre cornice line above
  x.fillStyle = '#7d1c16'; x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.2)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) {
    const px = i * 256; x.fillStyle = '#141010'; x.fillRect(px, 0, 34, H);       // black pilaster
    x.strokeStyle = 'rgba(214,170,90,0.75)'; x.lineWidth = 3; x.strokeRect(px + 62, 70, 166, 270);   // ochre panel frame
    x.strokeStyle = 'rgba(214,170,90,0.35)'; x.lineWidth = 1.5; x.strokeRect(px + 72, 80, 146, 250);
    // a small painted vignette: a garland swag in the panel
    x.strokeStyle = 'rgba(90,120,70,0.6)'; x.lineWidth = 5; x.beginPath(); x.moveTo(px + 90, 110); x.quadraticCurveTo(px + 145, 160, px + 200, 110); x.stroke();
    x.fillStyle = 'rgba(214,170,90,0.6)'; x.beginPath(); x.arc(px + 145, 210, 6, 0, TAU); x.fill();
  }
  x.fillStyle = '#100c0b'; x.fillRect(0, 380, W, H - 380);                       // dado
  x.fillStyle = 'rgba(214,170,90,0.6)'; x.fillRect(0, 376, W, 4);
  x.fillStyle = 'rgba(214,170,90,0.5)'; x.fillRect(0, 34, W, 5); x.fillStyle = '#16100e'; x.fillRect(0, 0, W, 34);
  for (let i = 0; i < 9000; i++) { x.fillStyle = r() < 0.5 ? `rgba(0,0,0,${r() * 0.12})` : `rgba(255,220,200,${r() * 0.05})`; x.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3); }   // fresco grain
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); return t;
}
function flutedColumn(h, r) {
  const g = new THREE.CylinderGeometry(r, r * 1.06, h, 72, 1, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 - 0.035 * Math.pow(Math.abs(Math.cos(a * 12)), 0.6); p.setX(i, x * k); p.setZ(i, z * k); }
  g.computeVertexNormals(); g.translate(0, h / 2, 0); return g;
}
// A bronze lucerna: a round body with a volute nozzle and a ring handle; the flame sits at the nozzle.
function lucerna(bz) {
  const g = new THREE.Group();
  const prof = [[0.001, 0], [3.2, 0], [4.4, 0.6], [4.9, 1.6], [4.6, 2.6], [3.6, 3.1], [2.4, 3.0], [1.0, 2.5], [0.8, 2.7], [0.001, 2.7]].map(([a, b]) => new THREE.Vector2(a, b));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 36), bz); g.add(body);
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.5, 5.4, 18), bz); noz.rotation.z = Math.PI / 2; noz.position.set(5.6, 1.6, 0); noz.scale.set(1, 1, 0.75); g.add(noz);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 12), bz); tip.position.set(8.3, 1.75, 0); tip.scale.set(1.1, 0.75, 1); g.add(tip);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.38, 10, 24), bz); ring.position.set(-5.2, 2.6, 0); ring.rotation.y = Math.PI / 2; g.add(ring);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
// A bronze candelabrum: tripod lion-feet, a thin fluted shaft, a dish with a lamp on top.
function candelabrum(bz) {
  const g = new THREE.Group(), H = 58;
  const shaft = new THREE.Mesh(flutedColumn(H, 0.9), bz); g.add(shaft);
  for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 12, 10), bz), a = k * TAU / 3; leg.position.set(Math.cos(a) * 4.5, 3.2, Math.sin(a) * 4.5); leg.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(leg); const paw = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 8), bz); paw.position.set(Math.cos(a) * 8.6, 0.8, Math.sin(a) * 8.6); paw.scale.set(1.3, 0.7, 1); g.add(paw); }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 10), bz); knob.position.y = 8; g.add(knob);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 1.5, 1.6, 32), bz); dish.position.y = H + 0.8; g.add(dish);
  const lamp = lucerna(bz); lamp.scale.setScalar(0.8); lamp.position.set(-2.5, H + 1.6, 0); g.add(lamp);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
// Two bone dice (tesserae) with pips.
function dice(scene, pos) {
  const c = mkCanvas(64), x = c.getContext('2d'); x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#2a1d12';
  [[32, 32], [16, 16], [48, 48], [16, 48], [48, 16]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 5.5, 0, TAU); x.fill(); });
  const m = new THREE.MeshPhysicalMaterial({ map: tex(c, true), roughness: 0.5, clearcoat: 0.4 });
  const geo = new THREE.BoxGeometry(1.7, 1.7, 1.7, 2, 2, 2), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)), k = 0.85 + 0.15 * (1.47 / Math.max(1.2, v.length())); p.setXYZ(i, v.x * k, v.y * k, v.z * k); }
  geo.computeVertexNormals();
  for (const [dx, dz, ry] of [[0, 0, 0.4], [2.6, 1.4, 1.2]]) { const d = new THREE.Mesh(geo, m); d.position.set(pos.x + dx, 0.75, pos.z + dz); d.rotation.y = ry; d.castShadow = true; d.receiveShadow = true; scene.add(d); }
}

const FLAME_VS = 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const FLAME_FS = `varying vec2 vU; uniform float uT; void main(){ vec2 p = vU - vec2(0.5, 0.18); float w = 0.16 * (1.0 - smoothstep(0.0, 0.75, p.y)) * (0.85 + 0.15*sin(uT*17.0+p.y*9.0));
  p.x += sin(uT*6.0 + p.y*7.0) * 0.03 * p.y; float d = abs(p.x) / max(0.001, w + 0.04*(1.0-p.y)); float body = smoothstep(1.0, 0.2, d) * smoothstep(-0.12, 0.02, p.y) * smoothstep(0.85, 0.3, p.y);
  vec3 c = mix(vec3(1.0,0.55,0.12), vec3(1.0,0.95,0.75), smoothstep(0.6, 0.0, d) * smoothstep(0.5, 0.0, p.y)); float core = smoothstep(0.4,0.0,length(p*vec2(3.0,1.6))) * 0.5;
  gl_FragColor = vec4(c * (body + core) * 1.6, (body + core)); }`;
export function makeFlame(scale = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2 * scale, 4.4 * scale), new THREE.ShaderMaterial({ vertexShader: FLAME_VS, fragmentShader: FLAME_FS, uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  m.geometry.translate(0, 1.4 * scale, 0); m.renderOrder = 5; return m;
}
export function radialTex(rgb = '0,0,0', a = 1, inner = 0) {
  const c = mkCanvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 64 * inner, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${inner ? 0 : a})`); if (inner) g.addColorStop(Math.min(0.95, inner + 0.12), `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// The room: table, wall, columns, floor, candelabrum, lucerna, dice, coins. Returns the animated parts.
export function buildRoom(scene, { quality = 1 } = {}) {
  const g = new THREE.Group(); scene.add(g);
  const bz = bronzeMat();
  // table: a polished slab of black marble with pale veins, a bronze edge moulding
  const tt = new THREE.CanvasTexture(marbleField(quality ? 1024 : 512, 'table', 63)); tt.colorSpace = THREE.SRGBColorSpace; tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.repeat.set(1.4, 1.4); tt.anisotropy = 8;
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(260, 6, 142), [0, 0, 0, 0, 0, 0].map((_, i) => (i === 2 ? new THREE.MeshPhysicalMaterial({ map: tt, color: 0xb8c4bc, roughness: 0.32, clearcoat: 0.55, clearcoatRoughness: 0.14, envMapIntensity: 0.12 }) : bz)));
  tableTop.position.set(0, -3, -6); tableTop.receiveShadow = true; g.add(tableTop);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(262, 1.2, 1.6), bz); lip.position.set(0, -0.5, 65.4); g.add(lip);
  // floor far below (a dark mosaic) and the wall behind
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 800), new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -78; g.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(700, 350), new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.92 })); wall.position.set(0, 110, -77); wall.receiveShadow = true; g.add(wall);
  // two fluted white marble columns with simple capitals and bases
  const colMat = new THREE.MeshPhysicalMaterial({ color: 0xe9e2d4, roughness: 0.45, clearcoat: 0.2 });
  void colMat; void candelabrum;
  const lamp2 = lucerna(bz); lamp2.position.set(CANDLE.x - 8.3, 0, CANDLE.z); lamp2.rotation.y = 0.35; g.add(lamp2);
  lamp2.position.x = CANDLE.x - Math.cos(0.35) * 8.3; lamp2.position.z = CANDLE.z + Math.sin(0.35) * 8.3;
  const lamp = lucerna(bz); lamp.position.set(LAMP.x - 8.3, 0, LAMP.z); g.add(lamp);
  const flameT = makeFlame(1), flameC = makeFlame(1);
  flameT.position.copy(LAMP); flameC.position.copy(CANDLE); g.add(flameT, flameC);
  const haloT = radialTex('255,170,80', 0.32), halo = (p, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: haloT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.position.copy(p); m.renderOrder = 4; g.add(m); return m; };
  const haloA = halo(LAMP.clone().add(new THREE.Vector3(0, 1.2, 0)), 10), haloB = halo(CANDLE.clone().add(new THREE.Vector3(0, 1.2, 0)), 10);
  dice(g, { x: -36, z: 10 });
  // a short stack of bronze coins
  const coin = new THREE.CylinderGeometry(1.4, 1.4, 0.28, 28), cm = bronzeMat(0x9a6a34);
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(coin, cm); m.position.set(36 + (hash(i, 3) - 0.5) * 0.5, 0.14 + i * 0.29, 14 + (hash(i, 4) - 0.5) * 0.5); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  const lone = new THREE.Mesh(coin, cm); lone.position.set(39.5, 0.14, 17.5); lone.rotation.set(0.0, 0, 0); g.add(lone);
  return { group: g, flames: [flameT, flameC], halos: [haloA, haloB] };
}

// Lights: the lucerna (warm point + a shadow-casting key from its side), the candelabrum, a cool moonlit rim from the atrium.
export function buildLights(scene) {
  const key = new THREE.DirectionalLight(0xffc489, 2.6); key.position.set(LAMP.x * 2.2, 70, LAMP.z * 1.2 + 30); key.target.position.set(0, 0, 0);
  Object.assign(key.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 220 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  const lamp = new THREE.PointLight(0xff9a48, 2600, 140, 1.6); lamp.position.copy(LAMP).add(new THREE.Vector3(0, 2.5, 0));
  const cand = new THREE.PointLight(0xffa458, 2200, 160, 1.6); cand.position.copy(CANDLE).add(new THREE.Vector3(0, 2.5, 0));
  const hemi = new THREE.HemisphereLight(0x6e7fa8, 0x2a1810, 0.42);
  const rim = new THREE.DirectionalLight(0x9db4ff, 0.75); rim.position.set(-40, 60, -120);
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.55); fill.position.set(-20, 90, 110);
  lamp.userData.base = lamp.intensity; cand.userData.base = cand.intensity;
  scene.add(key, key.target, lamp, cand, hemi, rim, fill);
  return { key, lamp, cand, hemi, rim, fill };
}
