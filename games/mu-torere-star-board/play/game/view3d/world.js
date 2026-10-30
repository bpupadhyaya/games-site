// Mū Tōrere 3D world (units: centimetres). A carved tōtara star board with pāua-shell inlay lying on a woven harakeke mat, on a grassy
// headland above the sea at dusk: harakeke (flax) bushes, fallen pōhutukawa blossoms, a flax kete. Pale shell stones with a nacre
// sheen and polished pounamu (greenstone). Everything is procedural (canvas textures + analytic geometry): no image files.
// Shared by the presenter and the icon page.
import * as THREE from '../vendor3d/three.js';
import { koru } from '../src/art.js';

export const TOP = 4.2;                 // the board's playing face above the ground
export const BASE = 0.55;               // the board's underside (resting on the mat)
export const TIP = 30, NOTCH = 21.2;    // carved star: tip and inner-corner radius (a board ~60 cm across)
export const PR = 22.4;                 // centre -> rim point (where stones sit)
export const HOLLOW_R = 4.4;            // the hollow each stone rests in
export const STONE_R = 3.5, STONE_H = 2.3;   // a stone ~7 cm across, ~2.3 cm thick
export const SUN_DIR = new THREE.Vector3(-0.5, 0.36, -0.79).normalize();
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi + seed * 131, yi), b = hash(xi + 1 + seed * 131, yi), c = hash(xi + seed * 131, yi + 1), d = hash(xi + 1 + seed * 131, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, seed, oct = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i); f *= 2.03; a *= 0.5; } return s; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ang = (i) => -Math.PI / 2 + (i * TAU) / 8;                    // same as layout.angleOf: point 0 at the far side (screen top)
export const pointW = (i) => (i === 8 ? { x: 0, z: 0 } : { x: Math.cos(ang(i)) * PR, z: Math.sin(ang(i)) * PR });
export const restY = () => TOP - 0.55 + STONE_H * 0.5;           // a stone resting in its hollow

// ---- the board ---------------------------------------------------------------------------------------------------
function starShape(k = 1) {
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = ang(i), n = a + Math.PI / 8;
    // shape y is world -z (the shape is laid flat with rotateX(-90°))
    const tx = Math.cos(a) * TIP * k, ty = -Math.sin(a) * TIP * k, nx = Math.cos(n) * NOTCH * k, ny = -Math.sin(n) * NOTCH * k;
    if (i === 0) s.moveTo(tx, ty); else s.lineTo(tx, ty);
    s.lineTo(nx, ny);
  }
  s.closePath(); return s;
}
const SPAN = 68;                                     // the top texture covers -34..34 cm
const toPx = (S, x, z) => [(x / SPAN + 0.5) * S, (z / SPAN + 0.5) * S];
function starPath2d(c, S, k) { c.beginPath(); for (let i = 0; i < 8; i++) { const a = ang(i), n = a + Math.PI / 8; c.lineTo(...toPx(S, Math.cos(a) * TIP * k, Math.sin(a) * TIP * k)); c.lineTo(...toPx(S, Math.cos(n) * NOTCH * k, Math.sin(n) * NOTCH * k)); } c.closePath(); }

function boardTextures(size) {
  const S = size, px = S / SPAN, r = lcg(31);
  const col = canvas(S), cx = col.getContext('2d'), bump = canvas(S), bx = bump.getContext('2d');
  // tōtara: warm red-brown, grain running across the board (smooth fields at 256, then scaled with full-res grain on top)
  const LS = 256, lc = canvas(LS), lx = lc.getContext('2d'), img = lx.createImageData(LS, LS), lb = canvas(LS), lbx = lb.getContext('2d'), bimg = lbx.createImageData(LS, LS);
  for (let j = 0; j < LS; j++) for (let i = 0; i < LS; i++) {
    const x = (i / LS - 0.5) * SPAN, z = (j / LS - 0.5) * SPAN;
    const w = z * 0.9 + fbm(x * 0.05, z * 0.05, 4, 3) * 9, ring = 0.5 + 0.5 * Math.sin(w * 2.1 + Math.sin(x * 0.08) * 1.5), m = fbm(x * 0.12, z * 0.3, 7, 3);
    const v = 0.78 + ring * 0.16 + (m - 0.5) * 0.22;
    const k = (j * LS + i) * 4; img.data[k] = 150 * v; img.data[k + 1] = 82 * v; img.data[k + 2] = 46 * v; img.data[k + 3] = 255;
    bimg.data[k] = bimg.data[k + 1] = bimg.data[k + 2] = 128 + (ring - 0.5) * 22; bimg.data[k + 3] = 255;
  }
  lx.putImageData(img, 0, 0); lbx.putImageData(bimg, 0, 0);
  cx.imageSmoothingQuality = 'high'; cx.drawImage(lc, 0, 0, S, S); bx.imageSmoothingQuality = 'high'; bx.drawImage(lb, 0, 0, S, S);
  // fine grain streaks
  for (let k = 0; k < 900; k++) {
    const y = r() * S, x0 = r() * S, L = (20 + r() * 120) * S / 1024;
    cx.strokeStyle = r() < 0.6 ? `rgba(60,24,10,${0.08 + r() * 0.14})` : `rgba(230,160,110,${0.05 + r() * 0.08})`; cx.lineWidth = (0.6 + r() * 1.6) * S / 1024;
    cx.beginPath(); cx.moveTo(x0, y); cx.quadraticCurveTo(x0 + L / 2, y + (r() - 0.5) * 4, x0 + L, y + (r() - 0.5) * 3); cx.stroke();
  }
  // a darker oiled patina toward the edges, lighter worn centre (hands reach across it)
  let g = cx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.48); g.addColorStop(0, 'rgba(255,200,150,0.10)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,10,4,0.35)');
  cx.fillStyle = g; cx.fillRect(0, 0, S, S);
  // carved outline groove a little inside the edge
  for (const [ctx, st, lw] of [[cx, 'rgba(40,14,4,0.75)', 0.55], [bx, 'rgb(40,40,40)', 0.55]]) { starPath2d(ctx, S, 0.9); ctx.strokeStyle = st; ctx.lineWidth = lw * px; ctx.lineJoin = 'round'; ctx.stroke(); }
  starPath2d(cx, S, 0.9); cx.save(); cx.translate(-0.12 * px, -0.12 * px); cx.strokeStyle = 'rgba(255,200,150,0.28)'; cx.lineWidth = 0.16 * px; cx.stroke(); cx.restore();
  // koru carved in each notch, between the arms (decoration; dark cut + lit edge, and cut into the bump map)
  for (let i = 0; i < 8; i++) {
    const a = ang(i) + Math.PI / 8, [ux, uy] = toPx(S, Math.cos(a) * 11.6, Math.sin(a) * 11.6);
    const sz = 2.5 * px, flip = i % 2 ? 1 : -1;
    koru(cx, ux + 0.1 * px, uy + 0.14 * px, sz, a + Math.PI / 2, 'rgba(255,205,160,0.3)', 0.55 * px, flip);
    koru(cx, ux, uy, sz, a + Math.PI / 2, 'rgba(48,18,6,0.9)', 0.55 * px, flip);
    koru(bx, ux, uy, sz, a + Math.PI / 2, 'rgb(46,46,46)', 0.6 * px, flip);
  }
  // inlay channels (the pāua ribbons sit in them): dark cut so the ribbon edge reads carved
  const seg = (ctx, a, b, w, st) => { ctx.strokeStyle = st; ctx.lineWidth = w * px; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(...toPx(S, a.x, a.z)); ctx.lineTo(...toPx(S, b.x, b.z)); ctx.stroke(); };
  for (let i = 0; i < 8; i++) for (const [ctx, st] of [[cx, 'rgba(26,8,2,0.9)'], [bx, 'rgb(30,30,30)']]) { seg(ctx, pointW(i), pointW((i + 1) % 8), 1.45, st); seg(ctx, pointW(8), pointW(i), 1.45, st); }
  // the hollows: a pecked-smooth dish, darker and polished, with a lit far lip and a shaded near lip
  for (let i = 0; i < 9; i++) {
    const p = pointW(i), [u, v] = toPx(S, p.x, p.z), R = (i === 8 ? HOLLOW_R * 1.22 : HOLLOW_R) * px;
    g = cx.createRadialGradient(u, v + R * 0.15, R * 0.05, u, v, R * 1.04); g.addColorStop(0, 'rgba(120,58,26,0.55)'); g.addColorStop(0.55, 'rgba(84,34,12,0.7)'); g.addColorStop(0.86, 'rgba(34,10,2,0.9)'); g.addColorStop(1, 'rgba(60,22,8,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(u, v, R * 1.05, 0, TAU); cx.fill();
    cx.strokeStyle = 'rgba(255,210,170,0.35)'; cx.lineWidth = 0.18 * px; cx.beginPath(); cx.arc(u, v, R * 1.02, Math.PI * 0.05, Math.PI * 0.95); cx.stroke();
    cx.strokeStyle = 'rgba(20,6,2,0.6)'; cx.lineWidth = 0.18 * px; cx.beginPath(); cx.arc(u, v, R * 1.02, Math.PI * 1.08, Math.PI * 1.92); cx.stroke();
    g = bx.createRadialGradient(u, v, 0, u, v, R * 1.05); g.addColorStop(0, 'rgb(20,20,20)'); g.addColorStop(0.75, 'rgb(70,70,70)'); g.addColorStop(1, 'rgba(128,128,128,0)');
    bx.fillStyle = g; bx.beginPath(); bx.arc(u, v, R * 1.05, 0, TAU); bx.fill();
  }
  // pale ring of fine tool marks around the putahi
  { const [u, v] = toPx(S, 0, 0); for (let k = 0; k < 72; k++) { const a = k / 72 * TAU; cx.strokeStyle = 'rgba(255,214,170,0.18)'; cx.lineWidth = 0.12 * px; cx.beginPath(); cx.moveTo(u + Math.cos(a) * 6.1 * px, v + Math.sin(a) * 6.1 * px); cx.lineTo(u + Math.cos(a) * 6.9 * px, v + Math.sin(a) * 6.9 * px); cx.stroke(); } }
  const mk = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.repeat.set(1 / SPAN, 1 / SPAN); t.offset.set(0.5, 0.5); return t; };
  return { map: mk(col, true), bump: mk(bump, false) };
}
function sideTexture() {
  const c = canvas(512, 128), x = c.getContext('2d'), r = lcg(9); x.fillStyle = '#6b3519'; x.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 160; i++) { const y = r() * 128; x.strokeStyle = r() < 0.6 ? `rgba(40,14,4,${0.15 + r() * 0.25})` : `rgba(200,120,70,${0.08 + r() * 0.1})`; x.lineWidth = 0.6 + r() * 2; x.beginPath(); x.moveTo(0, y); for (let k = 0; k <= 512; k += 32) x.lineTo(k, y + Math.sin(k * 0.03 + i) * 2); x.stroke(); }
  // niho taniwha (notched) band carved along the side
  x.fillStyle = 'rgba(30,10,2,0.55)'; for (let k = 0; k < 512; k += 16) { x.beginPath(); x.moveTo(k, 52); x.lineTo(k + 8, 76); x.lineTo(k + 16, 52); x.closePath(); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 14, 1 / 3.6); return t;
}
function pauaTexture() {
  const S = 256, c = canvas(S), x = c.getContext('2d'), img = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const n = fbm(i / 22, j / 22, 3, 4), w = Math.sin((n * 9 + i * 0.03) * 2.2) * 0.5 + 0.5, k = (j * S + i) * 4;
    // blue, green and violet bands of pāua nacre
    const t = (n * 3 + w * 0.6) % 1, cols = [[30, 120, 150], [40, 170, 120], [70, 80, 170], [20, 150, 170], [110, 60, 140]];
    const a = cols[Math.floor(t * 5) % 5], b = cols[(Math.floor(t * 5) + 1) % 5], f = (t * 5) % 1;
    img.data[k] = a[0] + (b[0] - a[0]) * f; img.data[k + 1] = a[1] + (b[1] - a[1]) * f; img.data[k + 2] = a[2] + (b[2] - a[2]) * f; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.08, 0.6); return t;
}
// The inlay: flat ribbons along the rim and the eight lines to the putahi, stopping at each hollow.
function inlayGeo() {
  const pos = [], uv = [], idx = [], W = 0.34;
  const strip = (a, b, ra, rb) => {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz * W, nz = ux * W;
    const p0 = { x: a.x + ux * ra, z: a.z + uz * ra }, p1 = { x: b.x - ux * rb, z: b.z - uz * rb }, o = pos.length / 3, l = L - ra - rb;
    pos.push(p0.x + nx, 0, p0.z + nz, p0.x - nx, 0, p0.z - nz, p1.x + nx, 0, p1.z + nz, p1.x - nx, 0, p1.z - nz);
    uv.push(0, 0, 0, 1, l, 0, l, 1); idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
  };
  const rc = HOLLOW_R * 1.22 + 0.2, rp = HOLLOW_R + 0.25;
  for (let i = 0; i < 8; i++) { strip(pointW(i), pointW((i + 1) % 8), rp, rp); strip(pointW(8), pointW(i), rc, rp); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export function buildBoard(texSize = 1024) {
  const g = new THREE.Group(), bev = 0.7, depth = TOP - BASE - bev * 2;
  const geo = new THREE.ExtrudeGeometry(starShape(1 - bev / TIP * 0.4), { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, BASE + bev, 0);
  const t = boardTextures(texSize), side = sideTexture();
  const top = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 2.4, roughness: 0.58, clearcoat: 0.18, clearcoatRoughness: 0.5, envMapIntensity: 0.5 });
  const sides = new THREE.MeshStandardMaterial({ map: side, roughness: 0.62, envMapIntensity: 0.4, color: 0xd8b8a0 });
  const m = new THREE.Mesh(geo, [top, sides]); m.castShadow = true; m.receiveShadow = true; g.add(m);
  const inlay = new THREE.Mesh(inlayGeo(), new THREE.MeshPhysicalMaterial({ map: pauaTexture(), color: 0xffffff, roughness: 0.2, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [180, 620], envMapIntensity: 1.6, emissive: 0xffffff, emissiveIntensity: 0.12 }));
  inlay.material.emissiveMap = inlay.material.map;
  inlay.position.y = TOP + 0.03; inlay.receiveShadow = true; g.add(inlay);
  g.userData.dispose = () => { geo.dispose(); top.dispose(); sides.dispose(); t.map.dispose(); t.bump.dispose(); side.dispose(); };
  return g;
}

// ---- stones: pale shell discs with a nacre sheen, polished pounamu ------------------------------------------------
export function stoneGeos() {
  const out = { 1: [], 2: [] };
  for (const kind of [1, 2]) for (let v = 0; v < 3; v++) {
    const g = new THREE.SphereGeometry(1, 44, 26), p = g.attributes.position, sx = 1 + v * 0.05, sz = 0.94 - v * 0.04;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const nn = (fbm(x * 1.5 + v * 7, z * 1.5 + y, kind * 10 + v, 3) - 0.5) * 2, lump = kind === 1 ? 0.03 : 0.05;
      const fl = y < 0 ? 0.7 : 1, k = 1 + nn * lump;
      p.setXYZ(i, x * STONE_R * sx * k, y * STONE_H * 0.5 * fl, z * STONE_R * sz * k);
    }
    g.computeVertexNormals(); out[kind].push(g);
  }
  return out;
}
export function stoneMaterials() {
  const r = lcg(77);
  // shell: cream with soft growth bands
  const sc = canvas(256), sx = sc.getContext('2d'); sx.fillStyle = '#efe6d2'; sx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) { sx.strokeStyle = r() < 0.5 ? `rgba(210,180,140,${0.12 + r() * 0.12})` : `rgba(255,250,240,${0.2 + r() * 0.2})`; sx.lineWidth = 2 + r() * 6; const y = r() * 256; sx.beginPath(); sx.moveTo(0, y); for (let x = 0; x <= 256; x += 16) sx.lineTo(x, y + Math.sin(x * 0.05 + i) * 4); sx.stroke(); }
  // pounamu: deep green with cloudy flecks and darker inclusions
  const gc = canvas(256), gx = gc.getContext('2d'), img = gx.createImageData(256, 256);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
    const n = fbm(i / 40, j / 40, 21, 4), f = fbm(i / 9, j / 14, 5, 2), k = (j * 256 + i) * 4, v = 0.55 + n * 0.7 + (f > 0.7 ? 0.25 : 0);
    img.data[k] = 18 * v; img.data[k + 1] = 112 * v; img.data[k + 2] = 72 * v; img.data[k + 3] = 255;
  }
  gx.putImageData(img, 0, 0);
  for (let i = 0; i < 90; i++) { gx.fillStyle = `rgba(4,30,16,${0.2 + r() * 0.4})`; gx.beginPath(); gx.arc(r() * 256, r() * 256, 1 + r() * 3, 0, TAU); gx.fill(); }
  const tx = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; };
  const shell = new THREE.MeshPhysicalMaterial({ map: tx(sc), color: 0xf6ead6, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2, iridescence: 0.8, iridescenceIOR: 1.5, iridescenceThicknessRange: [250, 520], sheen: 0.4, sheenColor: 0xffe8f0, envMapIntensity: 1.0 });
  const green = new THREE.MeshPhysicalMaterial({ map: tx(gc), color: 0xd8ffe8, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, emissive: 0x06301c, emissiveIntensity: 0.55, envMapIntensity: 1.3, specularIntensity: 0.9 });
  return { 1: shell, 2: green };
}

// ---- the headland ------------------------------------------------------------------------------------------------
function grassTexture() {
  const s = 256, c = canvas(s), x = c.getContext('2d'), img = x.createImageData(s, s);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const k = (j * s + i) * 4, m = fbm(i / 40, j / 40, 3, 3), gr = hash(i, j * 7 + 3), v = 0.7 + m * 0.5 + (gr - 0.5) * 0.35;
    img.data[k] = 70 * v; img.data[k + 1] = 92 * v; img.data[k + 2] = 42 * v; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); const r = lcg(5);
  for (let i = 0; i < 1600; i++) { const px = r() * s, py = r() * s, L = 2 + r() * 6; x.strokeStyle = r() < 0.5 ? `rgba(150,170,80,${0.25 + r() * 0.3})` : `rgba(20,36,12,${0.3 + r() * 0.3})`; x.lineWidth = 0.8; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 2, py - L); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 40); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function matTexture() {
  // whāriki: flax strips plaited on the diagonal (over two, under two), golden-tan; a border band of dyed-black niho (stepped triangles)
  const S = 1024, c = canvas(S), x = c.getContext('2d'), r = lcg(8), w = 13;
  x.fillStyle = '#b48a52'; x.fillRect(0, 0, S, S);
  x.save(); x.translate(S / 2, S / 2); x.rotate(Math.PI / 4);
  const R = S * 0.75, n = Math.ceil(R * 2 / w);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const over = Math.floor((i + j) / 2) % 2, x0 = -R + i * w, y0 = -R + j * w, v = 0.9 + r() * 0.16, sh = over ? 1 : 0.86;
    const base = [196 * v * sh, 156 * v * sh, 96 * v * sh];
    const g = over ? x.createLinearGradient(x0, y0, x0, y0 + w) : x.createLinearGradient(x0, y0, x0 + w, y0);
    g.addColorStop(0, `rgb(${base[0] * 0.8 | 0},${base[1] * 0.8 | 0},${base[2] * 0.8 | 0})`); g.addColorStop(0.45, `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`); g.addColorStop(1, `rgb(${base[0] * 0.78 | 0},${base[1] * 0.78 | 0},${base[2] * 0.78 | 0})`);
    x.fillStyle = g; x.fillRect(x0, y0, w, w);
    x.strokeStyle = `rgba(255,236,190,${0.08 + r() * 0.08})`; x.lineWidth = 0.7; x.beginPath();
    if (over) { x.moveTo(x0 + 1, y0 + w * 0.4); x.lineTo(x0 + w - 1, y0 + w * 0.4); } else { x.moveTo(x0 + w * 0.4, y0 + 1); x.lineTo(x0 + w * 0.4, y0 + w - 1); } x.stroke();
  }
  x.restore();
  // dyed border band: stepped niho (teeth) triangles along each side
  const band = (y, flip) => { for (let k = 0; k < S; k += 48) { x.fillStyle = 'rgba(34,22,16,0.82)'; x.beginPath(); x.moveTo(k, y); x.lineTo(k + 24, y + flip * 26); x.lineTo(k + 48, y); x.closePath(); x.fill(); } x.fillRect(0, flip > 0 ? y - 8 : y, S, 8); };
  x.save(); for (let s4 = 0; s4 < 4; s4++) { band(60, 1); x.translate(S / 2, S / 2); x.rotate(Math.PI / 2); x.translate(-S / 2, -S / 2); } x.restore();
  x.fillStyle = 'rgba(120,84,40,0.5)'; x.fillRect(0, 0, S, 14); x.fillRect(0, S - 14, S, 14); x.fillRect(0, 0, 14, S); x.fillRect(S - 14, 0, 14, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const SKY_VS = 'varying vec3 vD; void main(){ vD = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }';
const SKY_FS = `varying vec3 vD; uniform vec3 uSun; uniform float uGlow;
void main(){ vec3 d = normalize(vD); float h = d.y;
  vec3 zen = vec3(0.03,0.11,0.16), mid = vec3(0.13,0.36,0.42), rose = vec3(0.92,0.52,0.40), hor = vec3(1.0,0.70,0.38);
  vec3 c = h > 0.0 ? (h < 0.07 ? mix(hor, rose, smoothstep(0.0,0.07,h)) : mix(mix(rose, mid, smoothstep(0.07,0.24,h)), zen, smoothstep(0.24,0.85,h))) : mix(hor * 0.8, vec3(0.08,0.2,0.24), smoothstep(0.0,-0.12,h));
  float s = max(dot(d, uSun), 0.0); c += vec3(1.0,0.62,0.30) * pow(s, 10.0) * 0.5 * uGlow + vec3(1.0,0.85,0.55) * pow(s, 120.0) * 0.9 + vec3(1.0,0.97,0.9) * smoothstep(0.9993,0.9997,s) * 3.0;
  float cl = sin(d.x * 9.0 + d.z * 3.0) * 0.5 + 0.5; c = mix(c, c * vec3(1.15,0.9,0.85) + vec3(0.08,0.03,0.02), exp(-abs(h - 0.12) * 30.0) * cl * 0.35);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
// A harakeke (flax) bush: long sword leaves fanning out of a base, dark green with reddish margins (vertex colours).
function flaxGeo(seed) {
  const r = lcg(seed), pos = [], col = [], idx = [];
  const nL = 22;
  for (let l = 0; l < nL; l++) {
    const yaw = (l / nL) * TAU + r() * 0.3, lean = 0.12 + r() * 0.55, L = 70 + r() * 80, W = 3 + r() * 2.2, droop = 0.4 + r() * 0.8, seg = 10;
    const base = pos.length / 3;
    for (let s = 0; s <= seg; s++) {
      const u = s / seg, a = lean + droop * u * u, rad = Math.sin(a) * L * u, y = Math.cos(a) * L * u * (1 - 0.15 * u), w = W * (1 - u * 0.92);
      const cxp = Math.cos(yaw) * rad, czp = Math.sin(yaw) * rad, px = -Math.sin(yaw) * w, pz = Math.cos(yaw) * w;
      pos.push(cxp + px, y, czp + pz, cxp, y + w * 0.25, czp, cxp - px, y, czp - pz);       // a folded (V) leaf
      const g = 0.22 + 0.12 * u + r() * 0.03;
      col.push(0.32 + u * 0.15, 0.2 + g * 0.3, 0.1, 0.12 + u * 0.12, 0.26 + g * 0.5, 0.12, 0.3 + u * 0.15, 0.2 + g * 0.3, 0.1);
      if (s < seg) { const o = base + s * 3; idx.push(o, o + 3, o + 1, o + 1, o + 3, o + 4, o + 1, o + 4, o + 2, o + 2, o + 4, o + 5); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// A pōhutukawa blossom: a pompom of crimson stamens with pale tips.
function blossomGeo() {
  const parts = []; const r = lcg(3);
  const st = new THREE.CylinderGeometry(0.05, 0.07, 1.6, 4, 1); st.translate(0, 0.8, 0);
  const pos = [], col = [], idx = [];
  for (let k = 0; k < 40; k++) {
    const g = st.clone(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 1.4 - 0.2, r() * TAU, r() * 1.4 - 0.7)); g.applyQuaternion(q);
    const p = g.attributes.position, o = pos.length / 3;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i) + 0.3, p.getZ(i)); const tip = i >= p.count / 2 ? 1 : 0; col.push(0.85, 0.06 + tip * 0.05, 0.08 + tip * 0.04); }
    for (const i of g.index.array) idx.push(i + o);
    parts.push(g);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// A kete (flax basket) at the mat's corner.
function buildKete() {
  const g = new THREE.Group(), prof = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(9 + Math.sin(t * Math.PI) * 3.5 - t * 1.5, t * 14)); }
  const c = canvas(256), x = c.getContext('2d'); x.fillStyle = '#b98c4e'; x.fillRect(0, 0, 256, 256);
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { x.fillStyle = (i + j) % 2 ? 'rgba(80,50,20,0.35)' : 'rgba(255,230,170,0.18)'; x.fillRect(i * 16, j * 16, 16, 16); }
  x.fillStyle = 'rgba(30,20,12,0.85)'; for (let i = 0; i < 16; i++) x.fillRect(i * 16 + (i % 2) * 8, 104, 8, 24);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1);
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide }));
  body.castShadow = true; body.receiveShadow = true; body.scale.set(1, 1, 0.6); g.add(body);
  const hm = new THREE.MeshStandardMaterial({ color: 0x9c7340, roughness: 0.9 });
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(5, 0.45, 6, 18, Math.PI), hm); h.position.set(0, 13.6, s * 3.2); h.castShadow = true; g.add(h); }
  return g;
}

export function buildHeadland(scene, { quality = 1 } = {}) {
  const g = new THREE.Group(); scene.add(g);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: { uSun: { value: SUN_DIR.clone() }, uGlow: { value: 1 } }, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -10; g.add(sky);
  // grass on the headland; it ends at a cliff edge with the sea far below
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1500, 1, 1), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95, color: 0xffffff }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, 0, 590); grass.receiveShadow = true; g.add(grass);
  const lip = new THREE.Mesh(new THREE.PlaneGeometry(2400, 300), new THREE.MeshStandardMaterial({ color: 0x3e3a30, roughness: 1 }));
  lip.position.set(0, -150.5, -160); g.add(lip);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(12000, 6000), new THREE.MeshStandardMaterial({ color: 0x174650, emissive: 0x0c2a30, roughness: 0.22, metalness: 0.1, envMapIntensity: 0.12 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -420, -3300); g.add(sea);
  // far hills and a headland, hazed
  const hill = (pts, z, col) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], -420); pts.forEach(([x, y]) => s.lineTo(x, y)); s.lineTo(pts[pts.length - 1][0], -420); const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: col, fog: true })); m.position.z = z; g.add(m); };
  hill([[-9000, -420], [-7400, 0], [-6200, 260], [-5600, 420], [-4800, 360], [-4000, 200], [-3000, -100], [-2200, -420]], -6600, 0x4a6670);
  hill([[2400, -420], [3400, -200], [4400, 60], [5400, 180], [6800, 120], [8400, -100], [9400, -420]], -7200, 0x5a7078);
  // harakeke bushes around the edge of the scene (behind and to the sides, never between the camera and the board)
  const flaxM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, envMapIntensity: 0.6 });
  const bushes = [];
  for (const [x, z, s, seed] of [[-120, -120, 0.9, 1], [130, -135, 1.0, 2], [-230, -20, 0.9, 3], [240, -40, 0.95, 4], [-70, -190, 0.95, 5], [-300, -150, 1.2, 7], [320, -170, 1.15, 8], [-250, 110, 0.9, 6], [260, 120, 0.9, 9]]) {
    const b = new THREE.Mesh(flaxGeo(seed * 13), flaxM); b.position.set(x, 0, z); b.scale.setScalar(s); b.rotation.y = seed; b.receiveShadow = true; g.add(b); bushes.push(b);
  }
  // fallen pōhutukawa blossoms on the mat and the grass
  const bl = new THREE.InstancedMesh(blossomGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 26), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), rb = lcg(19);
  let nb = 0;
  for (const [x, z] of [[-40, 36], [-36, 41], [37, 39], [44, -30], [-46, -28], [30, 46], [-14, 47], [47, 24], [-48, 6], [52, 52], [-60, 50], [-70, -20], [70, -10], [20, -52], [-22, -55], [80, 40], [-85, 60], [5, 60]]) {
    e.set((rb() - 0.5) * 0.6, rb() * TAU, (rb() - 0.5) * 0.6); q.setFromEuler(e); const s = 1 + rb() * 0.6;
    bl.setMatrixAt(nb++, m4.compose(new THREE.Vector3(x + rb() * 4, Math.abs(x) < 46 && Math.abs(z) < 46 ? 0.5 : 0.1, z + rb() * 4), q, new THREE.Vector3(s, s, s)));
  }
  bl.count = nb; bl.castShadow = true; g.add(bl);
  // the whāriki under the board
  const mat = new THREE.Mesh(new THREE.BoxGeometry(92, 0.45, 92), [0, 1, 2, 3, 4, 5].map((i) => (i === 2 ? new THREE.MeshStandardMaterial({ map: matTexture(), roughness: 0.85 }) : new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 }))));
  mat.position.y = 0.23; mat.rotation.y = 0.05; mat.receiveShadow = true; g.add(mat);
  const kete = buildKete(); kete.position.set(-62, 0, 28); kete.rotation.y = 0.6; g.add(kete);
  return { group: g, sky, bushes };
}

// Dusk lights: low warm sun from behind-left (long shadows, rim light), cool sky fill, warm front fill so the faces read.
export function buildLights(scene) {
  const sun = new THREE.DirectionalLight(0xffc48a, 3.0); sun.position.copy(SUN_DIR).multiplyScalar(220); sun.target.position.set(0, 0, 0);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 40, far: 500 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  const hemi = new THREE.HemisphereLight(0x9cc4cc, 0x4a4a28, 0.75);
  const fill = new THREE.DirectionalLight(0xffd8b0, 0.85); fill.position.set(60, 120, 160);
  const rim = new THREE.DirectionalLight(0x9fe0ff, 0.5); rim.position.set(120, 40, -140);
  scene.add(sun, sun.target, hemi, fill, rim);
  return { sun, hemi, fill, rim };
}
export function radialTex(rgb = '0,0,0', a = 1) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
