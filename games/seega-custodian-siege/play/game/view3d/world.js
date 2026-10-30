// Seega 3D world (units: centimetres, +y up, the player sits at +z). A desert camp at dusk: a 5x5 board carved from one block of
// stone (sandstone / basalt / green oasis stone, following the game's board theme) on a woven wool kilim, limestone pebbles and
// glossy date stones in square pockets, a brass lantern beside it, rippled sand and dunes under a twilight sky with the first stars.
// Everything is procedural (canvas textures + analytic geometry): no image files. Shared by the presenter and the icon page.
import * as THREE from '../vendor3d/three.js';

export const N = 5;
export const P = 7.2;                    // pocket pitch (cm)
export const POCKET = 6.0, POCKET_D = 1.3, MARGIN = 4.2;
export const H = (N * P) / 2 + MARGIN;   // half the board's side (22.2 cm)
export const TOP = 4.3;                  // height of the board's face above the rug
export const FLOOR = TOP - POCKET_D;     // pocket floor
export const PEB_R = 2.2, PEB_H = 2.25;  // limestone pebble ~4.4 cm across, ~2.3 cm thick
export const DATE_L = 5.0, DATE_W = 2.6, DATE_H = 2.3;
export const RUG_W = 104, RUG_D = 72;
export const LANTERN_POS = new THREE.Vector3(-60, 0, -30);
export const FLAME_Y = 17.5;
export const SUN_DIR = new THREE.Vector3(0.32, 0.05, -1).normalize();   // the sun just set behind the far dunes
const TAU = Math.PI * 2;

export const THEME3D = {
  sand: { top: [216, 182, 134], dark: [176, 140, 92], floor: [150, 112, 72], band: [122, 88, 54], strata: [214, 178, 130], gloss: 0, rough: 0.92, date: 0x8a4a22, dateMid: '#6e3a1a', dateHi: '#a8683a', dateLo: '#3a1808' },
  basalt: { top: [78, 78, 86], dark: [46, 46, 52], floor: [30, 30, 35], band: [184, 112, 58], strata: [64, 64, 72], gloss: 0.25, rough: 0.6, date: 0xb85e28, dateMid: '#a8521e', dateHi: '#e0904c', dateLo: '#5a2208', metalBand: true },
  oasis: { top: [70, 122, 112], dark: [40, 84, 78], floor: [24, 58, 54], band: [196, 168, 98], strata: [56, 104, 96], gloss: 0.4, rough: 0.5, date: 0x9a3e26, dateMid: '#8a3420', dateHi: '#d07050', dateLo: '#45140a' },
};
export const themeOf = (id) => THEME3D[id] ?? THEME3D.sand;

const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
export const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi + seed * 131, yi), b = hash(xi + 1 + seed * 131, yi), c = hash(xi + seed * 131, yi + 1), d = hash(xi + 1 + seed * 131, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, y, seed, oct = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i); f *= 2.03; a *= 0.5; } return s; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } return t; };
const rgb = (c, k = 1) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;

export const pocketPos = (i) => { const x = i % N, y = (i - x) / N; return { x: (x - (N - 1) / 2) * P, z: (y - (N - 1) / 2) * P }; };
export const cellAtWorld = (x, z) => { const gx = Math.floor(x / P + N / 2), gz = Math.floor(z / P + N / 2); return gx < 0 || gz < 0 || gx >= N || gz >= N ? -1 : gz * N + gx; };
export const restY = (who) => FLOOR + (who === 1 ? PEB_H : DATE_H) * 0.5 - 0.05;

// ---- the carved board ---------------------------------------------------------------------------------------------
function roundRect(sh, x, y, w, h, r) {
  sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
}
// Top texture: canvas (i, j) maps to world x = (i / S - 0.5) * 2H, z = (j / S - 0.5) * 2H. Pocket floors are darker and worn
// smooth; the centre floor carries the carved diamond of the safe square; a zigzag band is carved round the border.
function boardTextures(th, size) {
  const W = 2 * H, px = size / W, r = lcg(4100), ctop = canvas(size), cx = ctop.getContext('2d'), bump = canvas(size), bx = bump.getContext('2d');
  const LS = 256, lc = canvas(LS), lx = lc.getContext('2d'), img = lx.createImageData(LS, LS);
  for (let j = 0; j < LS; j++) for (let i = 0; i < LS; i++) {
    const x = (i / LS - 0.5) * W, z = (j / LS - 0.5) * W;
    const m = fbm(x * 0.12, z * 0.12, 3, 4), s = Math.sin(z * 0.9 + fbm(x * 0.05, z * 0.2, 8, 3) * 9) * 0.5 + 0.5;   // soft strata lines
    const e = Math.max(Math.abs(x), Math.abs(z)) / H, rim = Math.max(0, (e - 0.82) / 0.18), blot = Math.max(0, fbm(x * 0.07 + 5, z * 0.07, 12, 3) - 0.55) * 1.6;
    const k = (0.8 + m * 0.34 + s * 0.12) * (1 - rim * 0.22) * (1 - blot * 0.25), q = (j * LS + i) * 4;
    img.data[q] = th.top[0] * k; img.data[q + 1] = th.top[1] * k; img.data[q + 2] = th.top[2] * k; img.data[q + 3] = 255;
  }
  lx.putImageData(img, 0, 0);
  cx.imageSmoothingQuality = 'high'; cx.drawImage(lc, 0, 0, size, size);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  // grain: sand grains in the colour, pits in the bump
  const d = cx.getImageData(0, 0, size, size), a = d.data;
  for (let p = 0, q = 0; p < a.length; p += 4, q++) { const g = 0.9 + 0.2 * hash(q, 77); a[p] *= g; a[p + 1] *= g; a[p + 2] *= g; }
  cx.putImageData(d, 0, 0);
  for (let v = 0; v < 5200 * (size / 1024) ** 2; v++) { const x = r() * size, y = r() * size, s = (0.4 + r() * 1.4) * (size / 1024); bx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.25 + r() * 0.3})`; bx.fillRect(x, y, s, s); }
  // worn hollows: darker edge just round each pocket mouth, lighter polished rim where fingers slide the stones
  for (let i = 0; i < N * N; i++) {
    const p = pocketPos(i), u = (p.x / W + 0.5) * size, v = (p.z / W + 0.5) * size, s = POCKET * px;
    cx.fillStyle = rgb(th.floor); cx.beginPath(); cx.roundRect(u - s / 2, v - s / 2, s, s, s * 0.15); cx.fill();
    const g = cx.createRadialGradient(u - s * 0.15, v - s * 0.2, s * 0.05, u, v, s * 0.7); g.addColorStop(0, 'rgba(255,240,215,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
    cx.fillStyle = g; cx.beginPath(); cx.roundRect(u - s / 2, v - s / 2, s, s, s * 0.15); cx.fill();
    cx.strokeStyle = 'rgba(255,244,222,0.18)'; cx.lineWidth = px * 0.5; cx.beginPath(); cx.roundRect(u - s / 2 - px * 0.4, v - s / 2 - px * 0.4, s + px * 0.8, s + px * 0.8, s * 0.18); cx.stroke();
    if (i === (N * N - 1) / 2) {          // the safe square: a carved diamond in a diamond on the centre floor
      for (const [k, w] of [[0.29, 0.55], [0.17, 0.45]]) {
        cx.save(); cx.translate(u, v); cx.rotate(Math.PI / 4); const q = s * k;
        cx.strokeStyle = th.metalBand ? 'rgb(214,134,70)' : rgb(th.band, 0.85); cx.lineWidth = px * w; cx.strokeRect(-q, -q, 2 * q, 2 * q);
        cx.restore();
        bx.save(); bx.translate(u, v); bx.rotate(Math.PI / 4); bx.strokeStyle = '#202020'; bx.lineWidth = px * w; bx.strokeRect(-q, -q, 2 * q, 2 * q); bx.restore();
      }
    }
  }
  // the carved zigzag border band (an inlaid copper/brass band on the darker stones)
  const band = (ctx, col, lw) => {
    const inset = MARGIN * 0.5 * px, U = 1.1 * px, edge = (x0, y0, dx, dy) => {
      const len = size - inset * 2, n = Math.floor(len / (U * 2)), st = (len - n * U * 2) / 2;
      ctx.beginPath();
      for (let i = 0; i <= n * 2; i++) { const s = st + i * U, t = (i % 2) * U * 1.1 - U * 0.55, x = x0 + dx * s - dy * t, y = y0 + dy * s + dx * t; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    };
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'miter';
    edge(inset, inset, 1, 0); edge(size - inset, inset, 0, 1); edge(size - inset, size - inset, -1, 0); edge(inset, size - inset, 0, -1);
  };
  band(cx, th.metalBand ? 'rgb(206,128,66)' : rgb(th.band), px * 0.38); band(bx, '#1c1c1c', px * 0.45);
  // a fine incised frame line inside the band
  for (const [ctx, col] of [[cx, rgb(th.band, 0.9)], [bx, '#303030']]) { ctx.strokeStyle = col; ctx.lineWidth = px * 0.18; const m = MARGIN * 0.92 * px; ctx.strokeRect(m, m, size - 2 * m, size - 2 * m); }
  return { map: tex(ctop, true), bump: tex(bump, false) };
}
// Side texture: horizontal strata (layered stone), mapped with world (u = along the edge, v = height).
function sideTextures(th, size = 512) {
  const c = canvas(size), x = c.getContext('2d'), b = canvas(size), bx = b.getContext('2d'), r = lcg(77);
  x.fillStyle = rgb(th.strata); x.fillRect(0, 0, size, size); bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 6 + r() * 22) {
    const k = 0.88 + r() * 0.22, h = 3 + r() * 14;
    x.fillStyle = rgb(th.strata, k); bx.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},128,0.2)`;
    x.beginPath(); bx.beginPath(); x.moveTo(0, y); bx.moveTo(0, y);
    for (let xx = 0; xx <= size; xx += 16) { const yy = y + Math.sin(xx * 0.02 + y) * 2; x.lineTo(xx, yy); bx.lineTo(xx, yy); }
    for (let xx = size; xx >= 0; xx -= 16) { const yy = y + h + Math.sin(xx * 0.02 + y) * 2; x.lineTo(xx, yy); bx.lineTo(xx, yy); }
    x.fill(); bx.fill();
  }
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(0,0,0,${r() * 0.12})`; x.fillRect(r() * size, r() * size, 1.5, 1.5); }
  return { map: tex(c, true, 1 / 30), bump: tex(b, false, 1 / 30) };
}
export function buildBoard(themeId = 'sand', texSize = 1024) {
  const th = themeOf(themeId), g = new THREE.Group();
  const outer = new THREE.Shape(); roundRect(outer, -H, -H, 2 * H, 2 * H, 2.6);
  const frameShape = new THREE.Shape(); roundRect(frameShape, -H, -H, 2 * H, 2 * H, 2.6);
  for (let i = 0; i < N * N; i++) { const p = pocketPos(i), hole = new THREE.Path(); roundRect(hole, p.x - POCKET / 2, -p.z - POCKET / 2, POCKET, POCKET, 0.9); frameShape.holes.push(hole); }
  const frame = new THREE.ExtrudeGeometry(frameShape, { depth: POCKET_D - 0.5, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.28, bevelSegments: 3, curveSegments: 6 });
  frame.rotateX(-Math.PI / 2);
  const base = new THREE.ExtrudeGeometry(outer, { depth: FLOOR - 0.7, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.28, bevelSegments: 3, curveSegments: 8 });
  base.rotateX(-Math.PI / 2);
  const t = boardTextures(th, texSize), s = sideTextures(th);
  // caps use world-cm UVs (shape x, shape y = -z): one texture spans the board
  for (const m of [t.map, t.bump]) { m.repeat.set(1 / (2 * H), 1 / (2 * H)); m.offset.set(0.5, 0.5); }
  const cap = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.2, roughness: th.rough, metalness: 0, envMapIntensity: 0.5 + th.gloss });
  const side = new THREE.MeshStandardMaterial({ map: s.map, bumpMap: s.bump, bumpScale: 1.5, roughness: Math.min(0.95, th.rough + 0.06), metalness: 0, envMapIntensity: 0.4 + th.gloss, color: 0xe8e0d8 });
  const fm = new THREE.Mesh(frame, [cap, side]); fm.position.y = TOP - (POCKET_D - 0.5) - 0.25;
  const bm = new THREE.Mesh(base, [cap, side]); bm.position.y = 0.35;
  for (const m of [fm, bm]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  g.userData.dispose = () => { frame.dispose(); base.dispose(); cap.dispose(); side.dispose(); t.map.dispose(); t.bump.dispose(); s.map.dispose(); s.bump.dispose(); };
  g.userData.theme = themeId;
  return g;
}

// ---- stones -------------------------------------------------------------------------------------------------------------
export function stoneGeos() {
  const out = { 1: [], 2: [] };
  for (let v = 0; v < 3; v++) {
    // pebble: a waterworn limestone lozenge, flatter underneath so it sits steady
    const g = new THREE.SphereGeometry(1, 40, 24), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nn = (fbm(x * 1.6 + v * 5, z * 1.6 + y, 30 + v, 3) - 0.5) * 2, k = 1 + nn * 0.05;
      p.setXYZ(i, x * PEB_R * (1 + v * 0.04) * k, y * PEB_H * 0.5 * (y < 0 ? 0.8 : 1), z * PEB_R * (0.95 - v * 0.03) * k);
    }
    g.computeVertexNormals(); out[1].push(g);
    // date stone: a long pointed oval with the deep groove down its top
    const d = new THREE.SphereGeometry(1, 48, 28), q = d.attributes.position;
    for (let i = 0; i < q.count; i++) {
      let x = q.getX(i), y = q.getY(i), z = q.getZ(i);
      const taper = 1 - 0.32 * x * x;                                   // pointed ends
      let yy = y * DATE_H * 0.5 * (y < 0 ? 0.78 : 1) * (0.75 + 0.25 * taper);
      const zz = z * DATE_W * 0.5 * taper * (1 + v * 0.03);
      if (y > 0) { const gw = Math.exp(-(z * z) / 0.02) * (1 - x * x); yy -= gw * 0.42; }   // the groove
      const nn = (fbm(x * 2 + v * 3, z * 2, 50 + v, 2) - 0.5) * 0.04;
      q.setXYZ(i, x * DATE_L * 0.5 * (1 + nn), yy, zz);
    }
    d.computeVertexNormals(); out[2].push(d);
  }
  return out;
}
const matCache = new Map();
export function stoneMaterials(themeId = 'sand') {
  if (matCache.has(themeId)) return matCache.get(themeId);
  const th = themeOf(themeId), r = lcg(91);
  const pc = canvas(256), px = pc.getContext('2d'); px.fillStyle = '#ece5d4'; px.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const s = 0.5 + r() * 2.2; px.fillStyle = r() < 0.7 ? `rgba(120,108,90,${0.15 + r() * 0.3})` : `rgba(255,255,255,${0.3 + r() * 0.3})`; px.beginPath(); px.arc(r() * 256, r() * 256, s, 0, TAU); px.fill(); }
  for (let i = 0; i < 14; i++) { px.strokeStyle = `rgba(170,150,120,${0.08 + r() * 0.1})`; px.lineWidth = 2 + r() * 5; px.beginPath(); px.moveTo(r() * 256, 0); px.bezierCurveTo(r() * 256, 90, r() * 256, 170, r() * 256, 256); px.stroke(); }
  const dc = canvas(256), dx = dc.getContext('2d'); dx.fillStyle = th.dateMid ?? '#7a4220'; dx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { dx.fillStyle = r() < 0.5 ? th.dateLo : th.dateHi; dx.globalAlpha = 0.08 + r() * 0.12; dx.beginPath(); dx.ellipse(r() * 256, r() * 256, 20 + r() * 50, 4 + r() * 10, 0, 0, TAU); dx.fill(); }
  dx.globalAlpha = 1;
  for (let i = 0; i < 260; i++) { const y = r() * 256; dx.strokeStyle = `rgba(${r() < 0.5 ? '30,10,0' : '255,210,170'},${0.05 + r() * 0.12})`; dx.lineWidth = 0.6 + r() * 1.6; dx.beginPath(); dx.moveTo(0, y); dx.bezierCurveTo(80, y + r() * 6 - 3, 170, y + r() * 6 - 3, 256, y); dx.stroke(); }
  const t1 = tex(pc, true), t2 = tex(dc, true);
  const peb = new THREE.MeshPhysicalMaterial({ map: t1, color: 0xfffaf0, roughness: 0.5, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5, envMapIntensity: 0.8 });
  const date = new THREE.MeshPhysicalMaterial({ map: t2, color: 0xffffff, roughness: 0.55, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.45, envMapIntensity: 0.6 });
  const out = { 1: peb, 2: date }; matCache.set(themeId, out); return out;
}

// ---- the bedrock slab under the board --------------------------------------------------------------------------------------
// (kept under the old export name `buildRug`): one flat weathered sandstone outcrop lying in the sand, cracked and pitted, with
// wind-blown sand filling its cracks and drifting over its edge, a few scratched tally marks and a pecked ring where the stone
// was ground flat. The seega board itself is a smaller slab set on it.
export function buildRug() {
  const Wp = 1024, Hp = 704, c = canvas(Wp, Hp), x = c.getContext('2d'), r = lcg(5);
  const ex = (a) => 1 + 0.07 * Math.sin(a * 3 + 1) + 0.045 * Math.sin(a * 7 + 2) + 0.03 * Math.sin(a * 13), rx = Wp * 0.46, ry = Hp * 0.46;
  x.clearRect(0, 0, Wp, Hp);
  // outline: a squarish rounded outcrop with a wobbly edge
  const outline = (k) => { x.beginPath(); for (let i = 0; i <= 120; i++) { const a = i / 120 * TAU, cs = Math.cos(a), sn = Math.sin(a), e = Math.pow(Math.abs(cs), 0.42) * Math.sign(cs) * rx * k * ex(a), f = Math.pow(Math.abs(sn), 0.42) * Math.sign(sn) * ry * k * ex(a + 1.3); if (i) x.lineTo(Wp / 2 + e, Hp / 2 + f); else x.moveTo(Wp / 2 + e, Hp / 2 + f); } x.closePath(); };
  outline(1); x.fillStyle = '#b89868'; x.fill();
  x.save(); outline(1); x.clip();
  const img = x.getImageData(0, 0, Wp, Hp), d = img.data;
  for (let j = 0; j < Hp; j++) for (let i = 0; i < Wp; i++) {
    const k = (j * Wp + i) * 4; if (d[k + 3] === 0) continue;
    const u = i / Wp, v = j / Hp, m = fbm(u * 9, v * 7, 4, 4), sb = Math.sin(v * 70 + fbm(u * 3, v * 9, 8, 3) * 12) * 0.5 + 0.5, pit = hash(i >> 1, j >> 1) > 0.965 ? 0.78 : 1;
    const sh = (0.72 + m * 0.5) * (0.94 + sb * 0.08) * pit;
    d[k] = 150 * sh; d[k + 1] = 128 * sh; d[k + 2] = 104 * sh;
  }
  x.putImageData(img, 0, 0);
  // cracks filled with blown sand
  for (let n = 0; n < 7; n++) {
    let px = r() * Wp, py = r() * Hp, a = r() * TAU; x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < 18; s++) { a += (r() - 0.5) * 0.9; px += Math.cos(a) * 34; py += Math.sin(a) * 34; x.lineTo(px, py); }
    x.strokeStyle = 'rgba(52,34,20,0.55)'; x.lineWidth = 2.6; x.stroke(); x.strokeStyle = 'rgba(206,168,118,0.7)'; x.lineWidth = 1.2; x.stroke();
  }
  // scratched marks: tally strokes and little hatch crosses, as if idle hands had scored the rock
  x.lineCap = 'round';
  for (const [bx, by] of [[0.14, 0.2], [0.86, 0.78], [0.82, 0.18], [0.13, 0.8]]) {
    for (let t = 0; t < 4; t++) { x.strokeStyle = 'rgba(70,46,28,0.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(Wp * bx + t * 13, Hp * by); x.lineTo(Wp * bx + t * 13 + 2, Hp * by + 24); x.stroke(); }
    x.beginPath(); x.moveTo(Wp * bx - 6, Hp * by + 8); x.lineTo(Wp * bx + 58, Hp * by + 14); x.stroke();
  }
  // sand drifted into the lee of the stone and along the edge
  for (let n = 0; n < 420; n++) { const a = r() * TAU, q = 0.9 + r() * 0.12, px = Wp / 2 + Math.cos(a) * rx * q * ex(a), py = Hp / 2 + Math.sin(a) * ry * q * ex(a + 1.3); const g = x.createRadialGradient(px, py, 0, px, py, 26 + r() * 30); g.addColorStop(0, 'rgba(190,146,102,0.8)'); g.addColorStop(1, 'rgba(190,146,102,0)'); x.fillStyle = g; x.fillRect(px - 60, py - 60, 120, 120); }
  x.restore();
  outline(1); x.strokeStyle = 'rgba(60,40,24,0.55)'; x.lineWidth = 3; x.stroke();
  const map = tex(c, true);
  const b = canvas(256, 176), bx = b.getContext('2d'), bi = bx.createImageData(256, 176);
  for (let j = 0; j < 176; j++) for (let i = 0; i < 256; i++) { const k = (j * 256 + i) * 4, v = 110 + fbm(i * 0.08, j * 0.08, 6, 3) * 70 + (hash(i, j) - 0.5) * 50; bi.data[k] = bi.data[k + 1] = bi.data[k + 2] = v; bi.data[k + 3] = 255; }
  bx.putImageData(bi, 0, 0);
  const bump = tex(b, false);
  const mat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.6, roughness: 0.95, metalness: 0, alphaTest: 0.4, envMapIntensity: 0.25 });
  const W = RUG_W * 1.05, D = RUG_D * 1.05;
  const geo = new THREE.PlaneGeometry(W, D, 40, 28); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const xx = p.getX(i), zz = p.getZ(i), e = Math.max(Math.abs(xx) / (W / 2), Math.abs(zz) / (D / 2)); p.setY(i, 0.55 - Math.max(0, e - 0.82) * 2.8 + 0.3 * fbm(xx * 0.06, zz * 0.06, 9, 2)); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.rotation.y = 0.04;
  return m;
}

// ---- sand, dunes, sky ------------------------------------------------------------------------------------------------------
export function sandTextures(size = 512) {
  const c = canvas(size), x = c.getContext('2d'), b = canvas(size), bx = b.getContext('2d'), r = lcg(19);
  const img = x.createImageData(size, size), bi = bx.createImageData(size, size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const u = i / size, v = j / size, w = fbm(u * 4, v * 4, 3, 3);
    // wind ripples: slightly wavy crests about 1/14 of a tile apart (tileable: integer frequencies)
    const ph = (v * 14 + Math.sin(u * TAU * 2 + w * 3) * 0.35 + w * 0.8) % 1, rip = ph < 0.7 ? ph / 0.7 : (1 - ph) / 0.3;
    const g = hash(i * 7 + j * 13, 5), k = (j * size + i) * 4, sh = 0.82 + rip * 0.14 + (g - 0.5) * 0.12 + (w - 0.5) * 0.1;
    img.data[k] = 176 * sh; img.data[k + 1] = 132 * sh; img.data[k + 2] = 98 * sh; img.data[k + 3] = 255;
    const bv = 128 + rip * 80 + (g - 0.5) * 40; bi.data[k] = bi.data[k + 1] = bi.data[k + 2] = bv; bi.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); bx.putImageData(bi, 0, 0);
  for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '90,60,40' : '255,236,200'},${0.2 + r() * 0.3})`; x.fillRect(r() * size, r() * size, 1.5, 1.5); }
  return { map: tex(c, true, 1), bump: tex(b, false, 1) };
}
export function duneHeight(x, z) {
  const r = Math.hypot(x, z), k = Math.min(1, Math.max(0, (r - 380) / 1500)), e = k * k * (3 - 2 * k);
  const ridge = 1 - Math.abs(fbm(x * 0.0011 + 3, z * 0.0011, 61, 3) * 2 - 1);   // sharp-crested ridges
  const swell = fbm(x * 0.0004, z * 0.0004, 71, 2);
  const near = (fbm(x * 0.01, z * 0.01, 81, 2) - 0.5) * 6 * Math.min(1, r / 200);
  return e * (ridge * ridge * 150 + swell * 90) + near - 0.2;
}
export function buildSand({ quality = 1 } = {}) {
  const t = sandTextures(quality ? 512 : 256);
  const seg = quality ? 200 : 120, S = 9000, geo = new THREE.PlaneGeometry(S, S, seg, seg); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, duneHeight(x, z)); uv.setXY(i, x / 70, z / 70); }
  geo.computeVertexNormals();
  t.map.repeat.set(1, 1); t.bump.repeat.set(1, 1);
  const mat = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.4, roughness: 0.97, metalness: 0, envMapIntensity: 0.2 });
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true;
  return m;
}
export function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN_DIR.clone() }, uTime: { value: 0 }, uGlow: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 uSun; uniform float uTime; uniform float uGlow; varying vec3 vDir;
      float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 zen = vec3(0.02,0.03,0.11), mid = vec3(0.13,0.11,0.32), hor = vec3(1.0,0.42,0.18), low = vec3(0.30,0.16,0.18);
        float s = max(dot(normalize(vec3(d.x,0.0,d.z)), normalize(vec3(uSun.x,0.0,uSun.z))), 0.0);
        vec3 c = mix(mid, zen, smoothstep(0.08, 0.6, h));
        vec3 band = mix(vec3(0.55,0.28,0.36), hor, pow(s, 2.0));
        c = mix(band, c, smoothstep(0.0, 0.22 + 0.12*s, h));
        c += uGlow * vec3(1.0,0.45,0.16) * (pow(s, 10.0) * 1.0 + pow(s, 3.0) * 0.3) * exp(-max(h,0.0)*8.0);
        if (h < 0.0) c = mix(c, low, smoothstep(0.0, -0.05, h));
        // stars, only where the sky is dark
        vec2 g = vec2(atan(d.z, d.x) * 180.0, h * 300.0); vec2 id = floor(g); float st = h21(id);
        float tw = 0.75 + 0.25*sin(uTime*1.7 + st*40.0);
        float star = step(0.9955, st) * smoothstep(0.55, 0.0, length(fract(g)-0.5)) * smoothstep(0.12, 0.5, h) * (1.0 - 0.8*pow(s,4.0)) * tw;
        c += vec3(1.0,0.96,0.9) * star * 1.4;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(4300, 48, 24), mat); m.renderOrder = -1; m.frustumCulled = false;
  return m;
}

// Far silhouettes against the afterglow: a few date palms of an oasis and a low tent on the dunes (alpha-cut planes).
export function buildSilhouettes() {
  const g = new THREE.Group(), c = canvas(512, 256), x = c.getContext('2d'), r = lcg(23);
  x.fillStyle = '#1a1018';
  const palm = (bx, h, lean) => {
    x.lineWidth = 7; x.strokeStyle = '#1a1018'; x.beginPath(); x.moveTo(bx, 256); x.quadraticCurveTo(bx + lean * 0.4, 256 - h * 0.6, bx + lean, 256 - h); x.stroke();
    const tx = bx + lean, ty = 256 - h;
    for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * 0.42 + (r() - 0.5) * 0.2, L = 40 + r() * 26; x.lineWidth = 5; x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty + Math.sin(a) * L * 0.6 - 12, tx + Math.cos(a) * L, ty + Math.sin(a) * L + 18); x.stroke(); }
  };
  palm(120, 150, -18); palm(170, 200, 10); palm(215, 130, 22); palm(330, 170, -8);
  x.beginPath(); x.moveTo(250, 256); x.lineTo(300, 226); x.lineTo(380, 220); x.lineTo(440, 230); x.lineTo(470, 256); x.closePath(); x.fill();          // a low black-goat-hair tent
  x.fillRect(0, 248, 512, 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3, fog: true, depthWrite: true });
  for (const [px, pz, sc] of [[-900, -2600, 1], [1500, -3200, 0.7]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(512 * sc * 1.4, 256 * sc * 1.4), mat);
    m.position.set(px, duneHeight(px, pz) + 128 * sc * 1.4 - 12, pz); m.lookAt(0, m.position.y, 0); g.add(m);
  }
  return g;
}

// ---- the brass lantern ------------------------------------------------------------------------------------------------------
export function radialTex(rgbs = '255,255,255', a = 1, size = 128) {
  const c = canvas(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgbs},${a})`); g.addColorStop(0.4, `rgba(${rgbs},${a * 0.45})`); g.addColorStop(1, `rgba(${rgbs},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildLantern() {      // (name kept) an iron fire-basket on a tripod with glowing coals, set in the sand beside the slab
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2622, metalness: 0.85, roughness: 0.55, envMapIntensity: 0.6 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, metalness: 0.9, roughness: 0.45 });
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [5.2, 0.6], [8.6, 3.2], [9.6, 5.2], [9.2, 5.4], [8.4, 3.6], [4.8, 1.2], [0, 0.8]].map(([r, y]) => new THREE.Vector2(r, y)), 36, 0, TAU), iron); bowl.position.y = 12.5; bowl.material.side = THREE.DoubleSide; g.add(bowl);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9.5, 0.45, 8, 40), rim); ring.rotation.x = Math.PI / 2; ring.position.y = 17.8; g.add(ring);
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.3, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 16, 8), iron); leg.position.set(Math.cos(a) * 5.2, 7.6, Math.sin(a) * 5.2); leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); g.add(leg); }
  const coals = new THREE.Mesh(new THREE.SphereGeometry(8.2, 24, 8, 0, TAU, 0, 0.5), new THREE.MeshStandardMaterial({ color: 0x401408, emissive: 0xff5a14, emissiveIntensity: 0.9, roughness: 0.9 })); coals.position.y = 12.3; coals.scale.y = 0.45; g.add(coals);
  const flame = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 2.6, 5.5, 14), new THREE.MeshBasicMaterial({ color: 0xffd488, fog: false, transparent: true, opacity: 0.92 })); flame.position.y = 17.6; g.add(flame);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,150,60', 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  halo.scale.set(38, 38, 1); halo.position.y = FLAME_Y - 1; halo.renderOrder = 5; g.add(halo);
  const glass = new THREE.Object3D(); g.add(glass);
  g.userData = { flame, halo, glass };
  return g;
}

// ---- lights -------------------------------------------------------------------------------------------------------------------
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0x4a5090, 0x4a2c1c, 0.16); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xa8b8ff, 0.24); moon.position.set(60, 140, 80); scene.add(moon);
  const rim = new THREE.DirectionalLight(0xff8a4a, 1.5); rim.position.copy(SUN_DIR).multiplyScalar(200).add(new THREE.Vector3(0, 30, 0)); scene.add(rim);
  const lamp = new THREE.SpotLight(0xffa850, 15000, 0, 0.95, 1, 2);
  lamp.position.set(LANTERN_POS.x, FLAME_Y, LANTERN_POS.z); lamp.target.position.set(2, 0, 2); scene.add(lamp, lamp.target);
  lamp.castShadow = true; lamp.shadow.bias = -0.0004; lamp.shadow.normalBias = 0.02; lamp.shadow.camera.near = 4; lamp.shadow.camera.far = 220; lamp.shadow.radius = 3;
  const glow = new THREE.PointLight(0xff9a40, 1800, 0, 2); glow.position.set(LANTERN_POS.x, FLAME_Y, LANTERN_POS.z); scene.add(glow);
  lamp.userData.base = lamp.intensity; glow.userData.base = glow.intensity;
  return { hemi, moon, rim, lamp, glow };
}
