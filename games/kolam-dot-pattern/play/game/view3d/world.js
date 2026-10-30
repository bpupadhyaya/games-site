// The Kolam threshold, built procedurally (canvas textures + analytic geometry, no image files): a granite doorstep slab dampened
// with sprinkled water, set into a polished red-oxide verandah floor (or a swept earthen court), a teak door sill behind it, a brass bowl
// of rice flour and a brass water pot. The rice-flour line itself is painted into a canvas texture (grainy body, stray grains along
// its edges, a soft shadow on the side away from the sun) and laid on the stone with a bump map so the low sun picks out its relief.
// Units: centimetres. One dot spacing (pulli to pulli) = PITCH cm.
import * as THREE from '../vendor3d/three.js';
import * as B3 from '../vendor3d/board3d.js';
import { linePath } from '../src/boardview.js';

export const PITCH = 10;          // cm between neighbouring dots (real kolam pulli are usually 5-12 cm apart)
export const SLAB_H = 3.2;        // the doorstep slab stands this high above the verandah floor
export const MARGIN = 0.95;       // flour texture margin round the outer dots (dot units)
export const SLAB_M = 1.45;       // slab margin round the outer dots (dot units)

// Looks per theme: floor, slab, sun, sky, exposure
export const LOOKS = {
  stone: { floor: 'earth', slab: ['#2c2b2b', '#3a3836'], sun: 0xffd2a0, sunI: 3.1, sky: 0xbfd2ff, ground: 0x3a2014, hemiI: 0.55, rim: [0xa8c0ff, 0.35], exp: 1.0, bg: '#1a0f0b', powder: '#fbf6ec', fog: [380, 900] },
  clay: { floor: 'earth', slab: ['#5b3d2c', '#6a4a36'], sun: 0xffc890, sunI: 3.0, sky: 0xd0d8f0, ground: 0x4a2c1c, hemiI: 0.6, rim: [0xb0c4ff, 0.3], exp: 1.02, bg: '#20140d', powder: '#fdf5e6', fog: [380, 900] },
  moon: { floor: 'earth', floorTint: 0x5a6890, slab: ['#262a30', '#33373e'], sun: 0x9fb8ff, sunI: 1.9, sky: 0x6f88c0, ground: 0x10141e, hemiI: 0.5, rim: [0xffc890, 0.28], exp: 1.08, bg: '#0a0e16', powder: '#f2f6ff', fog: [340, 820] },
};
export const lookOf = (id) => LOOKS[id] ?? LOOKS.stone;

// ------------------------------------------------------------------------------------------------ deterministic noise
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// soft blobs drawn with wrap-around so the tile repeats seamlessly
function blobs(x, size, n, r0, r1, col, a0, a1, R) {
  for (let i = 0; i < n; i++) {
    const cx = R() * size, cy = R() * size, r = r0 + R() * (r1 - r0), a = a0 + R() * (a1 - a0);
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      const px = cx + dx, py = cy + dy;
      if (px + r < 0 || px - r > size || py + r < 0 || py - r > size) continue;
      const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
  }
}
function specks(x, size, n, s0, s1, cols, R) {
  for (let i = 0; i < n; i++) {
    const c = cols[Math.floor(R() * cols.length)], s = s0 + R() * (s1 - s0);
    x.fillStyle = `rgba(${c[0]},${c[1]})`;
    const px = R() * size, py = R() * size;
    x.beginPath(); x.ellipse(px, py, s, s * (0.5 + R() * 0.5), R() * 3, 0, 7); x.fill();
  }
}
const texOf = (c, srgb, rep = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 4; return t; };

// ------------------------------------------------------------------------------------------------ granite slab
const cache = new Map();
function graniteMaps(look) {
  const key = `g|${look.slab.join()}`; if (cache.has(key)) return cache.get(key);
  const N = 1024, R = rng(11), c = cv(N), x = c.getContext('2d'), b = cv(N), y = b.getContext('2d');
  x.fillStyle = look.slab[0]; x.fillRect(0, 0, N, N);
  blobs(x, N, 70, 60, 220, '90,86,82', 0.05, 0.14, R);
  blobs(x, N, 50, 40, 160, '10,10,12', 0.08, 0.2, R);
  specks(x, N, 16000, 0.4, 1.5, [['8,8,10', 0.8], ['18,16,16', 0.7], ['96,92,88', 0.4], ['130,124,118', 0.22], ['92,70,62', 0.4]], R);
  specks(x, N, 700, 1.2, 3.2, [['14,14,16', 0.7], ['70,68,66', 0.3]], R);
  // fine chisel-dressing streaks
  x.lineWidth = 1; for (let i = 0; i < 260; i++) { x.strokeStyle = `rgba(200,195,190,${0.02 + R() * 0.04})`; const px = R() * N, py = R() * N; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - 0.5) * 60, py + (R() - 0.5) * 8); x.stroke(); }
  y.fillStyle = '#808080'; y.fillRect(0, 0, N, N);
  const R2 = rng(11); blobs(y, N, 70, 60, 220, '160,160,160', 0.05, 0.14, R2); blobs(y, N, 50, 40, 160, '40,40,40', 0.08, 0.2, R2);
  specks(y, N, 9000, 0.6, 2.4, [['40,40,40', 0.8], ['60,60,60', 0.7], ['200,200,200', 0.7], ['230,230,230', 0.6], ['90,90,90', 0.5]], R2);
  const m = { map: texOf(c, true), bump: texOf(b, false) };
  cache.set(key, m); return m;
}
export function slabMesh(w, d, look) {
  const g = graniteMaps(look);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: g.map, bumpMap: g.bump, bumpScale: 0.35, roughness: 0.62, metalness: 0, envMapIntensity: 0.5 });
  const geo = B3.slab(w, d, SLAB_H, 1.2, 0.7, { uvScale: 1, seg: 3 });
  // uv: one 48 cm granite tile, repeated
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 48, uv.getY(i) * d / 48);
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------------------------------------ floor around it
function floorMaps(kind) {
  const key = `f|${kind}`; if (cache.has(key)) return cache.get(key);
  const N = 1024, R = rng(kind === 'earth' ? 5 : 3), c = cv(N), x = c.getContext('2d'), b = cv(N), y = b.getContext('2d');
  if (kind === 'earth') {
    x.fillStyle = '#6a4a33'; x.fillRect(0, 0, N, N);
    blobs(x, N, 90, 50, 200, '120,80,50', 0.04, 0.1, R); blobs(x, N, 60, 30, 160, '40,24,14', 0.04, 0.1, R);
    // broom strokes of the morning sweep: long faint arcs
    for (let i = 0; i < 420; i++) { x.strokeStyle = `rgba(${R() < 0.5 ? '30,18,10' : '150,110,80'},${0.04 + R() * 0.05})`; x.lineWidth = 1 + R() * 2; const px = R() * N, py = R() * N, l = 40 + R() * 120; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l * 0.5, py - 10, px + l, py + (R() - 0.5) * 16); x.stroke(); }
    specks(x, N, 14000, 0.4, 1.8, [['30,18,12', 0.55], ['170,130,95', 0.35], ['90,60,40', 0.5]], R); specks(x, N, 500, 1.5, 3.5, [['60,40,28', 0.6], ['140,110,85', 0.5]], R);
  } else {
    x.fillStyle = '#4a1a14'; x.fillRect(0, 0, N, N);
    blobs(x, N, 110, 60, 260, '120,46,32', 0.05, 0.14, R); blobs(x, N, 70, 40, 200, '30,8,6', 0.06, 0.16, R);
    for (let i = 0; i < 160; i++) { x.strokeStyle = `rgba(150,70,50,${0.02 + R() * 0.04})`; x.lineWidth = 6 + R() * 18; const px = R() * N, py = R() * N; x.beginPath(); x.arc(px, py, 40 + R() * 90, R() * 6, R() * 6 + 1.2); x.stroke(); }
    specks(x, N, 2500, 0.4, 1.4, [['20,6,4', 0.4], ['170,90,70', 0.25]], R);
  }
  y.drawImage(c, 0, 0); const id = y.getImageData(0, 0, N, N), d = id.data; for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; d[i] = d[i + 1] = d[i + 2] = l; } y.putImageData(id, 0, 0);
  const m = { map: texOf(c, true), bump: texOf(b, false) };
  cache.set(key, m); return m;
}
export function floorMesh(kind) {
  const g = floorMaps(kind), size = 900;
  g.map.repeat.set(size / 120, size / 120); g.bump.repeat.set(size / 120, size / 120);
  const mat = new THREE.MeshStandardMaterial({ map: g.map, bumpMap: g.bump, bumpScale: kind === 'earth' ? 0.6 : 0.15, roughness: kind === 'earth' ? 0.95 : 0.38, metalness: 0, envMapIntensity: kind === 'earth' ? 0.2 : 0.7 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat); m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------------------------------------ the damp patch (water sprinkled before drawing)
let wetTex = null;
export function wetMesh(w, d) {
  if (!wetTex) wetTex = wetTexture();
  const mat = new THREE.MeshStandardMaterial({ color: 0x050403, alphaMap: wetTex, transparent: true, opacity: 0.4, roughness: 0.16, metalness: 0, depthWrite: false, envMapIntensity: 1.2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; m.renderOrder = 1;
  return m;
}
function wetTexture() {
  const N = 512, c = cv(N), x = c.getContext('2d'), R = rng(23);
  x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
  // an irregular damp area covering the drawing, with a few splash drops round its edge
  for (let i = 0; i < 46; i++) { const a = R() * 6.283, rr = R() * 0.3, px = N / 2 + Math.cos(a) * rr * N, py = N / 2 + Math.sin(a) * rr * N, r = N * (0.1 + R() * 0.16); const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, 2 * r, 2 * r); }
  for (let i = 0; i < 40; i++) { const a = R() * 6.283, rr = 0.36 + R() * 0.1, px = N / 2 + Math.cos(a) * rr * N, py = N / 2 + Math.sin(a) * rr * N, r = 1.5 + R() * 4; x.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.25})`; x.beginPath(); x.ellipse(px, py, r, r * 0.8, R() * 3, 0, 7); x.fill(); }
  return texOf(c, false, false);
}

// ------------------------------------------------------------------------------------------------ rice flour: grain patterns + the painter
let grains = null;
function grainPatterns() {
  if (grains) return grains;
  const N = 192, R = rng(41);
  const holes = cv(N), h = holes.getContext('2d');
  for (let i = 0; i < 2600; i++) { h.fillStyle = `rgba(0,0,0,${0.25 + R() * 0.7})`; const s = 0.5 + R() * 1.3; h.fillRect(R() * N, R() * N, s, s); }
  const scatter = cv(N), sc = scatter.getContext('2d');
  for (let i = 0; i < 520; i++) { sc.fillStyle = `rgba(255,252,244,${0.3 + R() * 0.6})`; const s = 0.6 + R() * 1.6; sc.beginPath(); sc.arc(R() * N, R() * N, s, 0, 7); sc.fill(); }
  const ridge = cv(N), rg = ridge.getContext('2d');
  for (let i = 0; i < 1400; i++) { rg.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.6})`; const s = 0.5 + R() * 1.4; rg.fillRect(R() * N, R() * N, s, s); }
  grains = { holes, scatter, ridge };
  return grains;
}
// One flour layer for the given parts (list of [seq, a, b]) of a board B on the canvas, `s` texture px per dot unit.
export function paintFlour(c, Bd, parts, s, opt = {}) {
  const x = c.getContext('2d'), G = grainPatterns();
  const ox = -(Bd.bounds.minX - MARGIN) * s, oy = -(Bd.bounds.minY - MARGIN) * s, g = { S: s, ox, oy };
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
  const pat = (img, k) => { const p = x.createPattern(img, 'repeat'); const m = new DOMMatrix(); m.scaleSelf(k, k); p.setTransform(m); return p; };
  const k = Math.max(0.6, s / 200);
  const w = s * 0.085 * (opt.wk ?? 1), sun = opt.sun ?? [0.6, 0.75];
  const stroke = (fn) => { for (const [seq, a, b] of parts) { if (!seq || !seq.length || b <= a) continue; linePath(x, g, seq, a, b); fn(); } };
  const dots = (fn) => { for (const d of Bd.dots) { x.beginPath(); x.arc(ox + d.x * s, oy + d.y * s, s * 0.062 * (opt.dk ?? 1), 0, 7); fn(); } };
  x.lineCap = 'round'; x.lineJoin = 'round';
  // 1. stray grains that fell either side of the line
  x.globalAlpha = opt.scatter ?? 1; x.strokeStyle = pat(G.scatter, k); x.lineWidth = w * 2.3; stroke(() => x.stroke()); x.globalAlpha = 1;
  x.fillStyle = pat(G.scatter, k); for (const d of Bd.dots) { x.beginPath(); x.arc(ox + d.x * s, oy + d.y * s, s * 0.11, 0, 7); x.fill(); }
  // 2. the body, casting a soft shadow away from the sun
  x.save();
  x.shadowColor = 'rgba(0,0,0,0.75)'; x.shadowBlur = w * 0.6; x.shadowOffsetX = w * 0.42 * sun[0]; x.shadowOffsetY = w * 0.42 * sun[1];
  x.strokeStyle = 'rgba(248,246,240,0.98)'; x.lineWidth = w; stroke(() => x.stroke());
  x.fillStyle = 'rgba(248,246,240,0.98)'; dots(() => x.fill());
  x.restore();
  // 3. grain: tiny gaps where the flour fell thin
  x.globalCompositeOperation = 'destination-out';
  x.globalAlpha = opt.grain ?? 1; x.strokeStyle = pat(G.holes, k); x.lineWidth = w * 1.05; stroke(() => x.stroke()); x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  // 4. the ridge: the flour lies thickest along the middle of the stroke
  x.strokeStyle = pat(G.ridge, k); x.lineWidth = w * 0.5; stroke(() => x.stroke());
  x.fillStyle = 'rgba(255,255,255,0.9)'; for (const d of Bd.dots) { x.beginPath(); x.arc(ox + d.x * s - s * 0.012, oy + d.y * s - s * 0.012, s * 0.03, 0, 7); x.fill(); }
  return g;
}

// ------------------------------------------------------------------------------------------------ props
const brass = () => new THREE.MeshPhysicalMaterial({ color: 0xc9953e, metalness: 1, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 1.1 });
let flourMat = null;
const flourMaterial = () => {
  if (flourMat) return flourMat;
  const N = 256, c = cv(N), x = c.getContext('2d'), R = rng(9); x.fillStyle = '#f2ede2'; x.fillRect(0, 0, N, N);
  specks(x, N, 3000, 0.4, 1.4, [['255,255,255', 0.8], ['200,192,178', 0.6], ['226,218,204', 0.7]], R);
  const t = texOf(c, true); t.repeat.set(3, 3);
  flourMat = new THREE.MeshStandardMaterial({ color: 0xcdc6b8, map: t, bumpMap: t, bumpScale: 0.4, roughness: 1, metalness: 0, envMapIntensity: 0.3, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.02 });
  return flourMat;
};
// A brass bowl (13 cm across) heaped with rice flour, a finger hollow in the heap, a pinch spilled on the floor next to it.
export function flourBowl() {
  const gr = new THREE.Group();
  const prof = [[0, 0.2], [3.6, 0.15], [4.6, 0.6], [5.9, 2.2], [6.5, 4.3], [6.7, 5.4], [6.85, 5.6], [6.95, 5.45], [6.55, 5.25], [6.1, 4.1], [5.4, 2.4], [4.2, 1.1], [0, 0.9]];
  const bowl = new THREE.Mesh(B3.lathe(prof, 56), brass()); bowl.castShadow = true; bowl.receiveShadow = true; gr.add(bowl);
  const heap = [[0, 4.0], [6.3, 4.0], [6.25, 5.1], [5.4, 5.5], [4.2, 6.2], [3.0, 7.1], [1.8, 8.0], [0.8, 8.5], [0, 8.6]];
  const h = new THREE.Mesh(B3.lathe(heap, 48), flourMaterial()); h.castShadow = true; h.receiveShadow = true; gr.add(h);
  const dent = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 12), flourMaterial()); dent.scale.set(1.25, 0.5, 0.9); dent.position.set(1.6, 7.3, -0.6); gr.add(dent);
  const sh = B3.contactShadow(8.5, 0.55); sh.position.y = 0.05; gr.add(sh);
  return gr;
}
// A brass water pot (sombu, ~11 cm tall) used to sprinkle the ground before drawing.
export function waterPot() {
  const gr = new THREE.Group();
  const prof = [[0, 0], [3.2, 0], [3.4, 0.3], [3.1, 0.6], [4.4, 1.8], [5.0, 3.6], [4.7, 5.6], [3.6, 7.0], [2.6, 7.8], [2.4, 8.6], [2.9, 9.5], [3.3, 10.2], [3.4, 10.5], [3.15, 10.55], [2.8, 10.0], [2.2, 9.0], [0, 9.0]];
  const pot = new THREE.Mesh(B3.lathe(prof, 56), brass()); pot.castShadow = true; pot.receiveShadow = true; gr.add(pot);
  const sh = B3.contactShadow(7.5, 0.5); sh.position.y = 0.05; gr.add(sh);
  return gr;
}
// The teak door sill behind the step (seen on the title; off screen above the board in play).
let teakMat = null;
export function doorSill(width) {
  if (!teakMat) {
    const c = B3.woodCanvas(512, '#4a2a16', '#6d4024', 17);
    const t = texOf(c.map, true), tb = texOf(c.bump, false); teakMat = new THREE.MeshStandardMaterial({ map: t, bumpMap: tb, bumpScale: 0.2, roughness: 0.55, metalness: 0, envMapIntensity: 0.5 });
  }
  const gr = new THREE.Group();
  const sill = new THREE.Mesh(B3.roundedBox(width, 9, 14, 1.2, 3), teakMat); sill.position.set(0, 4.5, 0); sill.castShadow = sill.receiveShadow = true; gr.add(sill);
  return gr;
}
// soft round sprite for dust motes and flour grains in the air
export function softDot(rgb = '255,248,236') {
  const c = cv(32), x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.5, `rgba(${rgb},0.6)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function clearCaches() { for (const m of cache.values()) { m.map.dispose(); m.bump.dispose(); } cache.clear(); flourMat = null; teakMat = null; if (wetTex) wetTex.dispose(); wetTex = null; }
