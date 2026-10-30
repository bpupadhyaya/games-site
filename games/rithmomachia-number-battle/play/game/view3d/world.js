// Rithmomachia 3D world, built procedurally (no bitmaps): a scholar's walnut desk lit by two candles and a window, a leather
// blotter, the illuminated vellum board (the same painting as the flat art, now with real gold leaf and a walnut slab), turned
// ivory and ebony pieces with a gold inlay ring and the number cut in, a tray for each side's captures, a stack of books,
// an inkwell with a quill and an open arithmetic codex. Units are centimetres; the table top is y = 0.
import * as THREE from '../vendor3d/three.js';
import { material, roundedBox, lathe } from '../vendor3d/board3d.js';
import { paintBoard } from '../src/art.js';
import { FRAME } from '../src/layout.js';
import { ROUND, TRI, SQR } from '../src/rules.js';

export const S = 4;                                   // one square = 4 cm
export const F = FRAME * S, BW = 8 * S + 2 * F, BD = 16 * S + 2 * F, SLAB_H = 2.4, TOP = SLAB_H;
export const PH = 1.05;                               // piece height
export const HX = BW / 2, HZ = BD / 2;
export const sqPos = (i) => ({ x: ((i & 7) - 3.5) * S, z: ((i >> 3) - 7.5) * S });
const TAU = Math.PI * 2;
const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const texOf = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

export function radialTex(rgb, a = 1, size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.5})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return texOf(c);
}

// ------------------------------------------------------------------ the board
export function buildBoard(texSize = 2048) {
  const g = new THREE.Group();
  // walnut slab with a rounded edge
  const slab = new THREE.Mesh(roundedBox(BW + 0.6, SLAB_H, BD + 0.6, 0.7, 4), material('darkWood', { color: '#3a1f12', color2: '#5a3220', seed: 11 }));
  slab.position.y = SLAB_H / 2; slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
  // the painted vellum top: colour from the flat art's painter; gold leaf found by colour becomes metal (roughness G, metalness B)
  const cols = 8, rows = 16, W0 = (cols + 2 * FRAME) * 100, H0 = (rows + 2 * FRAME) * 100, sc = texSize / H0;
  const c = cv(Math.round(W0 * sc), Math.round(H0 * sc)), x = c.getContext('2d');
  x.scale(sc, sc); paintBoard(x, true, false, { surface: true });
  const rm = cv(c.width, c.height), rx = rm.getContext('2d'), src = x.getImageData(0, 0, c.width, c.height).data, out = rx.createImageData(c.width, c.height), o = out.data;
  const bump = cv(c.width, c.height), bx = bump.getContext('2d'), bo = bx.createImageData(c.width, c.height), b = bo.data;
  for (let i = 0; i < src.length; i += 4) {
    const r = src[i], gg = src[i + 1], bl = src[i + 2], gold = r > 140 && gg > 95 && r - bl > 85 && gg - bl > 40 && r - gg < 95;
    o[i] = 0; o[i + 1] = gold ? 80 : 205; o[i + 2] = gold ? 235 : 0; o[i + 3] = 255;
    const lum = (r + gg + bl) / 3; b[i] = b[i + 1] = b[i + 2] = gold ? 200 : 120 + lum * 0.15; b[i + 3] = 255;
  }
  rx.putImageData(out, 0, 0); bx.putImageData(bo, 0, 0);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(BW, BD).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
    map: texOf(c), roughnessMap: texOf(rm, false), metalnessMap: texOf(rm, false), bumpMap: texOf(bump, false), bumpScale: 0.6, roughness: 1, metalness: 1, envMapIntensity: 1.6,
  }));
  top.position.y = TOP + 0.01; top.receiveShadow = true; g.add(top);
  // gilt moulding around the rim
  const rim = new THREE.Mesh(frameGeo(BW + 0.3, BD + 0.3, 0.55, 0.45), material('brass', { color: '#b98a28', color2: '#f3d27a' }));
  rim.position.y = TOP - 0.05; rim.castShadow = true; g.add(rim);
  g.userData.dispose = () => g.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); [].concat(m.material).forEach((mm) => { for (const k of ['map', 'roughnessMap', 'bumpMap']) mm[k]?.dispose?.(); }); } });
  return g;
}
// a rectangular ring (picture-frame moulding) w x d outer, band width bw, height h, top at y = h
function frameGeo(w, d, bw, h) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.closePath();
  const hole = new THREE.Path(); const iw = w / 2 - bw, id = d / 2 - bw; hole.moveTo(-iw, -id); hole.lineTo(-iw, id); hole.lineTo(iw, id); hole.lineTo(iw, -id); hole.closePath(); s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: h - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.12, bevelSegments: 2 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, 0.08, 0); return geo;
}

// ------------------------------------------------------------------ pieces
function outline(shape, k = 1) {
  const s = new THREE.Shape();
  if (shape === ROUND) s.absarc(0, 0, 1.62 * k, 0, TAU, false);
  else if (shape === SQR) { const h = 1.45 * k, r = 0.34 * k; s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h); s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h); }
  else { // equilateral, apex toward shape +y (world -z), corners softened
    const R = 2.1 * k, cr = 0.32 * k, P = [0, 1, 2].map((j) => { const a = Math.PI / 2 + j * TAU / 3; return [Math.cos(a) * R, Math.sin(a) * R]; });
    for (let j = 0; j < 3; j++) {
      const p = P[j], prev = P[(j + 2) % 3], next = P[(j + 1) % 3];
      const toPrev = [prev[0] - p[0], prev[1] - p[1]], toNext = [next[0] - p[0], next[1] - p[1]], lp = Math.hypot(...toPrev), ln = Math.hypot(...toNext);
      const a = [p[0] + toPrev[0] / lp * cr * 1.7, p[1] + toPrev[1] / lp * cr * 1.7], bq = [p[0] + toNext[0] / ln * cr * 1.7, p[1] + toNext[1] / ln * cr * 1.7];
      if (j === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
      s.quadraticCurveTo(p[0], p[1], bq[0], bq[1]);
    }
    s.closePath();
  }
  return s;
}
export function pieceGeos() {
  const out = {};
  for (const sh of [ROUND, TRI, SQR]) {
    const bev = 0.2;
    const body = new THREE.ExtrudeGeometry(outline(sh, 1), { depth: PH - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.85, bevelSegments: 4, curveSegments: 36 });
    body.rotateX(-Math.PI / 2); body.translate(0, bev, 0);
    const ring = outline(sh, 0.86), hole = outline(sh, 0.77); ring.holes.push(new THREE.Path(hole.getPoints(48).reverse()));
    const inlay = new THREE.ExtrudeGeometry(ring, { depth: 0.05, bevelEnabled: false, curveSegments: 36 }); inlay.rotateX(-Math.PI / 2); inlay.translate(0, PH - 0.02, 0);
    const ds = sh === TRI ? 2.3 : sh === SQR ? 2.55 : 2.7;
    const decal = new THREE.PlaneGeometry(ds, ds).rotateX(-Math.PI / 2); decal.translate(0, PH + 0.035, 0);
    out[sh] = { body, inlay, decal };
  }
  return out;
}
export function pieceMaterials() {
  const ivory = material('ivory', { color: '#f4ead0', color2: '#e3d3ab', seed: 6 });
  ivory.roughness = 0.34; ivory.clearcoat = 0.55; ivory.clearcoatRoughness = 0.22;
  const ebony = material('darkWood', { color: '#141016', color2: '#2a2026', seed: 21 });
  ebony.roughness = 0.3; ebony.clearcoat = 0.9; ebony.clearcoatRoughness = 0.12;
  const gold = material('brass', { color: '#c99a3a', color2: '#f6dc8a', seed: 4 });
  return { 1: ivory, 2: ebony, gold };
}
// number decals: cut into ivory and filled with lapis, or gold leaf on ebony
const numCache = new Map();
export function numberMaterial(side, val) {
  const key = side * 10000 + val; let m = numCache.get(key); if (m) return m;
  const c = cv(160), x = c.getContext('2d'), s = String(val), fs = s.length >= 3 ? 70 : s.length === 2 ? 92 : 112;
  x.font = `700 ${fs}px ${SERIF}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  const y = 80 + fs * 0.33;
  if (side === 1) { x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillText(s, 81.5, y + 2.5); x.fillStyle = '#16245c'; x.fillText(s, 80, y); }
  else { x.fillStyle = 'rgba(0,0,0,0.85)'; x.fillText(s, 81.5, y + 2.5); const g = x.createLinearGradient(0, y - fs * 0.8, 0, y); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, '#e9c35a'); g.addColorStop(1, '#b0801f'); x.fillStyle = g; x.fillText(s, 80, y); }
  m = new THREE.MeshStandardMaterial({ map: texOf(c), transparent: true, depthWrite: false, roughness: side === 1 ? 0.6 : 0.3, metalness: side === 1 ? 0 : 0.75, polygonOffset: true, polygonOffsetFactor: -2, envMapIntensity: 1.4 });
  numCache.set(key, m); return m;
}
export function clearNumberCache() { for (const m of numCache.values()) { m.map.dispose(); m.dispose(); } numCache.clear(); }

// ------------------------------------------------------------------ desk and props
export function buildDesk(scene, { quality = 1 } = {}) {
  const g = new THREE.Group(); scene.add(g);
  const add = (geo, mat, x = 0, y = 0, z = 0, ry = 0, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; };
  // walnut desk and a tooled leather blotter under the board
  add(roundedBox(230, 6, 170, 1.4, 3), material('wood', { color: '#4a2a17', color2: '#6e4326', seed: 8, repeat: [3, 2] }), 0, -3, 0, 0, false);
  const leather = material('cloth', { color: '#5a1d20', color2: '#6f2a27', size: 512, repeat: [3, 5] }); leather.roughness = 0.75;
  add(roundedBox(BW + 22, 0.5, BD + 26, 0.25, 2), leather, 0, 0.25, 0, 0, false);
  add(frameGeo(BW + 21, BD + 25, 0.5, 0.56), material('brass', { color: '#a77d2a', color2: '#d8b25a' }), 0, -0.02, 0, 0, false);
  // stone floor and a dark plastered wall, far away (only seen on the menu)
  const floor = add(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), material('stone', { color: '#2a2420', color2: '#3a322b', repeat: [8, 8] }), 0, -78, 0, 0, false); floor.castShadow = false;
  const wall = add(new THREE.PlaneGeometry(900, 300), material('stone', { color: '#3a2c22', color2: '#4a3a2c', seed: 3, repeat: [6, 2] }), 0, 70, -190, 0, false); wall.castShadow = false;

  // two candles in brass dishes
  const candles = [];
  const wax = new THREE.MeshPhysicalMaterial({ color: 0xf2e4c4, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffd9a0), emissive: 0x3a1c06, emissiveIntensity: 0.25 });
  const brass = material('brass');
  const flameTex = (() => { const c = cv(64, 128), x = c.getContext('2d'); const gr = x.createRadialGradient(32, 84, 2, 32, 76, 46); gr.addColorStop(0, 'rgba(255,255,235,1)'); gr.addColorStop(0.3, 'rgba(255,214,120,0.95)'); gr.addColorStop(0.65, 'rgba(255,130,40,0.5)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = gr; x.beginPath(); x.moveTo(32, 4); x.bezierCurveTo(52, 50, 58, 92, 32, 122); x.bezierCurveTo(6, 92, 12, 50, 32, 4); x.fill(); return texOf(c); })();
  const halo = radialTex('255,170,80', 0.55);
  for (const [cx, cz, hgt] of [[-HX - 17, -HZ + 16, 15], [HX + 18, -6, 11]]) {
    const cg = new THREE.Group(); cg.position.set(cx, 0, cz); g.add(cg);
    const dish = new THREE.Mesh(lathe([[0, 0], [4.6, 0], [5.2, 0.5], [5.0, 0.9], [4.2, 0.7], [1.9, 0.9], [1.7, 2.4], [2.2, 2.6], [2.0, 3.0], [0, 3.0]], 40), brass); dish.castShadow = true; dish.receiveShadow = true; cg.add(dish);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.32, 10, 24, Math.PI * 1.3), brass); handle.position.set(5.6, 0.9, 0); handle.rotation.set(0, 0, -0.6); cg.add(handle);
    const body = new THREE.Mesh(lathe([[0, 0], [1.55, 0], [1.6, hgt * 0.5], [1.5, hgt - 0.3], [1.2, hgt], [0.2, hgt - 0.25], [0, hgt - 0.2]], 32), wax); body.position.y = 2.8; body.castShadow = true; cg.add(body);
    // a wax drip down one side
    const drip = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, hgt * 0.35, 4, 8), wax); drip.position.set(1.5, 2.8 + hgt * 0.68, 0.3); cg.add(drip);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0x1a120c })); wick.position.y = 2.8 + hgt + 0.15; cg.add(wick);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); flame.scale.set(1.3, 2.9, 1); flame.position.y = 2.8 + hgt + 1.5; cg.add(flame);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.55 })); glow.scale.set(13, 13, 1); glow.position.y = flame.position.y; cg.add(glow);
    const light = new THREE.PointLight(0xffa24a, 900, 160, 2); light.position.y = flame.position.y + 0.5; cg.add(light);
    candles.push({ flame, glow, light, i0: light.intensity, seed: cx });
  }

  // a stack of three leather books
  const covers = [['#4a1416', '#5e2020'], ['#16301f', '#22442c'], ['#3a2412', '#523418']];
  const pages = new THREE.MeshStandardMaterial({ color: 0xe8d9b4, roughness: 0.9 });
  const books = new THREE.Group(); books.position.set(HX + 22, 0, -HZ + 6); books.rotation.y = 0.35; g.add(books);
  let by = 0;
  covers.forEach(([c0, c1], k) => {
    const w = 22 - k * 2.2, d = 30 - k * 3, h = 4.2 - k * 0.6, cov = material('cloth', { color: c0, color2: c1, size: 256 }); cov.roughness = 0.7;
    const bk = new THREE.Group(); bk.position.y = by; bk.rotation.y = (k - 1) * 0.16; books.add(bk);
    const c = new THREE.Mesh(roundedBox(w, h, d, 0.5, 3), cov); c.position.y = h / 2; c.castShadow = true; c.receiveShadow = true; bk.add(c);
    const p = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, h - 0.9, d - 1.4), pages); p.position.set(0.5, h / 2, 0); bk.add(p);
    for (const zz of [-d * 0.32, d * 0.32]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.5, h + 0.06, 1.1), brass); band.position.set(-w / 2 + 0.1, h / 2, zz); bk.add(band); }
    by += h;
  });
  // inkwell and quill
  const ink = new THREE.Group(); ink.position.set(-HX - 15, 0, HZ - 22); g.add(ink);
  const pot = new THREE.Mesh(lathe([[0, 0], [3.4, 0], [3.8, 0.6], [3.9, 2.6], [3.0, 4.2], [1.5, 4.6], [1.4, 5.4], [1.8, 5.6], [1.7, 5.9], [1.1, 5.8], [1.0, 5.0], [0, 5.0]], 40),
    new THREE.MeshPhysicalMaterial({ color: 0x14202a, roughness: 0.15, clearcoat: 1, metalness: 0.1 }));
  pot.castShadow = true; pot.receiveShadow = true; ink.add(pot);
  const qc = cv(64, 512), qx = qc.getContext('2d');
  { const gr = qx.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(240,232,215,0)'); gr.addColorStop(0.18, 'rgba(240,232,215,0.95)'); gr.addColorStop(0.5, 'rgba(255,252,240,1)'); gr.addColorStop(0.82, 'rgba(225,215,195,0.95)'); gr.addColorStop(1, 'rgba(225,215,195,0)');
    qx.fillStyle = gr; qx.beginPath(); qx.moveTo(32, 0); qx.bezierCurveTo(70, 120, 66, 380, 34, 512); qx.lineTo(30, 512); qx.bezierCurveTo(-2, 380, -6, 120, 32, 0); qx.fill();
    qx.strokeStyle = 'rgba(150,130,100,0.35)'; qx.lineWidth = 1; for (let yy = 20; yy < 500; yy += 7) { qx.beginPath(); qx.moveTo(32, yy); qx.lineTo(4 + yy * 0.02, yy - 22); qx.moveTo(32, yy); qx.lineTo(60 - yy * 0.02, yy - 22); qx.stroke(); }
    qx.fillStyle = '#c9b48c'; qx.fillRect(31, 0, 2, 512); }
  const quill = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 30), new THREE.MeshStandardMaterial({ map: texOf(qc), transparent: true, side: THREE.DoubleSide, roughness: 0.8, alphaTest: 0.05 }));
  quill.position.set(1.8, 15, -1.4); quill.rotation.set(0.25, 0.6, -0.42); quill.castShadow = true; ink.add(quill);
  // the open codex beyond the Ink camp: a table of numbers and a ratio diagram
  const codex = new THREE.Group(); codex.position.set(-4, 0, -HZ - 27); codex.rotation.y = 0.12; g.add(codex);
  const cc = cv(1024, 640), cx2 = cc.getContext('2d'), r = lcg(9);
  { cx2.fillStyle = '#ecdcae'; cx2.fillRect(0, 0, 1024, 640);
    for (let k = 0; k < 40; k++) { const x0 = r() * 1024, y0 = r() * 640, rr = 40 + r() * 140, gr = cx2.createRadialGradient(x0, y0, 0, x0, y0, rr); gr.addColorStop(0, 'rgba(150,100,40,0.10)'); gr.addColorStop(1, 'rgba(150,100,40,0)'); cx2.fillStyle = gr; cx2.fillRect(x0 - rr, y0 - rr, rr * 2, rr * 2); }
    const gutter = cx2.createLinearGradient(472, 0, 552, 0); gutter.addColorStop(0, 'rgba(80,50,20,0)'); gutter.addColorStop(0.5, 'rgba(80,50,20,0.45)'); gutter.addColorStop(1, 'rgba(80,50,20,0)'); cx2.fillStyle = gutter; cx2.fillRect(472, 0, 80, 640);
    cx2.fillStyle = '#b02a18'; cx2.font = `700 64px ${SERIF}`; cx2.fillText('R', 70, 130); cx2.fillStyle = '#2a1b10'; cx2.font = `700 30px ${SERIF}`; cx2.fillText('ithmomachia', 112, 128);
    cx2.font = `700 22px ${SERIF}`; for (let k = 0; k < 11; k++) { cx2.fillStyle = 'rgba(42,27,16,0.75)'; let s = ''; for (let w = 0; w < 7; w++) s += 'lmnoaeiru'.slice(0, 2 + Math.floor(r() * 7)) + ' '; cx2.fillText(s, 70, 175 + k * 36); }
    // the ratio table on the right page
    const nums = [[2, 4, 6, 8], [3, 6, 9, 12], [4, 8, 12, 16], [5, 10, 15, 20]];
    cx2.strokeStyle = 'rgba(42,27,16,0.7)'; cx2.lineWidth = 2;
    nums.forEach((row, i) => row.forEach((v, j) => { const x0 = 600 + j * 86, y0 = 110 + i * 86; cx2.strokeRect(x0, y0, 86, 86); cx2.fillStyle = (i + j) % 2 ? '#233f86' : '#b02a18'; cx2.font = `700 40px ${SERIF}`; cx2.textAlign = 'center'; cx2.fillText(String(v), x0 + 43, y0 + 57); }));
    cx2.textAlign = 'left'; cx2.strokeStyle = '#b98a28'; cx2.lineWidth = 3; cx2.beginPath(); cx2.arc(772, 540, 52, 0, TAU); cx2.stroke(); cx2.beginPath(); cx2.moveTo(720, 540); cx2.lineTo(824, 540); cx2.stroke(); }
  const pg = new THREE.PlaneGeometry(44, 28, 24, 1); const pp = pg.attributes.position;
  for (let i = 0; i < pp.count; i++) { const xx = pp.getX(i), u = Math.abs(xx) / 22; pp.setZ(i, Math.sin(Math.min(1, u * 1.2) * Math.PI) * 1.6 * (1 - u * 0.3) - (u < 0.05 ? 0.6 : 0)); }
  pg.computeVertexNormals(); pg.rotateX(-Math.PI / 2);
  const leaf = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: texOf(cc), roughness: 0.92 })); leaf.position.y = 1.1; leaf.receiveShadow = true; leaf.castShadow = true; codex.add(leaf);
  const cover = new THREE.Mesh(roundedBox(46.5, 0.9, 30, 0.35, 2), material('cloth', { color: '#3a1410', color2: '#4e1d16', size: 256 })); cover.position.y = 0.45; cover.castShadow = true; codex.add(cover);

  // capture trays (walnut, lined with blue felt): Ivory's at its right, Ink's at its right
  const trays = {};
  const felt = material('felt', { color: '#1c3677', color2: '#14285a', size: 256 });
  const trayWood = material('wood', { color: '#5a3520', color2: '#7a4a2a', seed: 13 });
  for (const side of [1, 2]) {
    const t = new THREE.Group(); const sx = side === 1 ? 1 : -1; t.position.set(sx * (HX + 13), 0, sx * (HZ - 15)); t.rotation.y = side === 1 ? 0 : Math.PI; g.add(t);
    const w = 11, d = 24, h = 2;
    const base = new THREE.Mesh(roundedBox(w, 0.8, d, 0.3, 2), trayWood); base.position.y = 0.4; base.receiveShadow = true; base.castShadow = true; t.add(base);
    const lining = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.4, d - 1.4).rotateX(-Math.PI / 2), felt); lining.position.y = 0.82; lining.receiveShadow = true; t.add(lining);
    for (const [ww, dd, x0, z0] of [[w, 0.7, 0, d / 2 - 0.35], [w, 0.7, 0, -d / 2 + 0.35], [0.7, d, w / 2 - 0.35, 0], [0.7, d, -w / 2 + 0.35, 0]]) { const m = new THREE.Mesh(roundedBox(ww, h, dd, 0.25, 2), trayWood); m.position.set(x0, h / 2, z0); m.castShadow = true; m.receiveShadow = true; t.add(m); }
    t.updateMatrixWorld(true);
    trays[side] = { group: t, slot: (k) => { const v = new THREE.Vector3((k % 2 - 0.5) * 4.6, 0.85, -d / 2 + 2.6 + Math.floor(k / 2) * 4.7); return t.localToWorld(v); } };
  }
  return { group: g, candles, trays };
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffe2c0, 0x2a160c, 0.45); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe0b0, 2.3); sun.position.set(-70, 130, 60); sun.target.position.set(0, 0, 0);
  sun.shadow.camera.left = -95; sun.shadow.camera.right = 95; sun.shadow.camera.top = 95; sun.shadow.camera.bottom = -95; sun.shadow.camera.near = 20; sun.shadow.camera.far = 340;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; sun.shadow.radius = 4; scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x9fb4ff, 0.7); rim.position.set(60, 70, -120); scene.add(rim);
  return { hemi, sun, rim };
}
