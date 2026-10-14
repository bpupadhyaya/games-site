// Sholo Guti 3D models: the chalk-lattice clay slab, river-pebble and glazed-clay stones, and the Bengal village courtyard around it
// (beaten-earth floor with a rice-paste alpona, woven mat, mud hut with thatch, tulsi plinth, banana plant, oil lamps).
// Pure scene construction (no game state). World units: one board step = 1. The playing surface is the plane y = TOP; the board is
// centred on the origin with its long axis along z (the presenter turns the whole group when the layout lays the board on its side).
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { POINTS, EDGES } from '../src/rules.js';

export const TOP = 0.34;                          // y of the slab surface
export const PEB_H = 0.224, CLAY_H = 0.26;          // stone heights (top of a stone = TOP + this)
export const HALF_W = 2.55, HALF_L = 4.92;        // half sizes of the slab's hexagon
const TAU = Math.PI * 2;
const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const canvasTex = (c, o = {}) => { const t = new THREE.CanvasTexture(c); t.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); } return t; };
const phys = (params, extra = {}) => Object.assign(new THREE.MeshPhysicalMaterial(params), extra);
const cache = new Map();
const memo = (k, f) => { let v = cache.get(k); if (v === undefined) { v = f(); cache.set(k, v); } return v; };
export const clearModelCache = () => { cache.clear(); B.disposeMaterialCache(); };
const std = (color, rough = 0.8, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

// ---------------------------------------------------------------- the three board looks (keys match art.js WOODS)
export const LOOKS = {
  clay:  { kind: 'clay',  top: ['#e69363', '#c06c3c'], edge: '#9a4e28', grain: 'rgba(92,38,14,', rim: '#1f3392', rimHi: '#4a63d6', line: '#fff6e2', groove: 'rgba(60,22,6,0.6)', stud: '#f1c453' },
  slate: { kind: 'slate', top: ['#5a6d70', '#34454a'], edge: '#232f33', grain: 'rgba(10,18,20,', rim: '#b98a2e', rimHi: '#f1d173', line: '#f6f8ee', groove: 'rgba(0,0,0,0.55)', stud: '#e8eef0' },
  teak:  { kind: 'teak',  top: ['#cf9658', '#a26a30'], edge: '#6d4421', grain: 'rgba(64,34,10,', rim: '#2b140a', rimHi: '#6b3c1c', line: '#ffe49a', groove: 'rgba(40,16,2,0.6)', stud: '#f0c75a' },
};

// ---------------------------------------------------------------- hexagon helpers
const HEX = [[0, -4.92], [2.55, -2.11], [2.55, 2.11], [0, 4.92], [-2.55, 2.11], [-2.55, -2.11]];
function offsetPoly(pts, d) {                                              // convex polygon moved inward by d
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const line = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = dz / l, nz = -dx / l; return { px: a[0] - nx * d, pz: a[1] - nz * d, dx: dx / l, dz: dz / l }; };
    // inward normal for a clockwise/counter-clockwise polygon is picked so the offset shrinks
    const A = line(p0, p1), Bq = line(p1, p2), den = A.dx * Bq.dz - A.dz * Bq.dx;
    const t = ((Bq.px - A.px) * Bq.dz - (Bq.pz - A.pz) * Bq.dx) / (den || 1e-9);
    out.push([A.px + A.dx * t, A.pz + A.dz * t]);
  }
  // make sure it shrank: compare to the centroid distance
  const dist = (p) => Math.hypot(p[0], p[1]);
  if (dist(out[1]) > dist(pts[1])) return offsetPoly(pts, -d);
  return out;
}
function roundedShape(pts, r) {                                           // THREE.Shape (x, -z so that after rotateX(-90deg) z matches)
  const n = pts.length, s = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const m = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    const l0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l1 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const a = m(p1, p0, Math.min(0.45, r / l0)), b = m(p1, p2, Math.min(0.45, r / l1));
    if (i === 0) s.moveTo(a[0], -a[1]); else s.lineTo(a[0], -a[1]);
    s.quadraticCurveTo(p1[0], -p1[1], b[0], -b[1]);
  }
  s.closePath(); return s;
}
function extrudeHex(pts, r, depth, bevel = 0.04, hole = null) {
  const shape = roundedShape(pts, r);
  if (hole) { const h = roundedShape(hole.pts, hole.r); shape.holes.push(new THREE.Path(h.getPoints(24))); }
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.002, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); g.translate(0, bevel, 0); g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- slab top texture: clay + chalk groove shadows
function topCanvas(look, W = 1024, H = 2048) {
  const L = LOOKS[look] || LOOKS.clay, c = cv(W, H), x = c.getContext('2d'), r = rngOf(look.length * 977 + 5);
  const u = W / (HALF_W * 2), at = (px, pz) => [(px + HALF_W) * u, (pz + HALF_L) * (H / (HALF_L * 2))];
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, L.top[0]); g.addColorStop(0.55, L.top[1]); g.addColorStop(1, L.top[0]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (L.kind === 'teak') {
    const w = B.woodCanvas(1024, L.top[0], L.top[1], 31, { lines: 260, knots: 2 });
    x.save(); x.translate(W / 2, H / 2); x.rotate(Math.PI / 2); x.drawImage(w.map, -H / 2, -W / 2, H, W); x.restore();
  } else {
    for (let k = 0; k < 120; k++) {                                          // trowel sweeps and mottling
      const px = r() * W, py = r() * H, a = 0.03 + r() * 0.06;
      x.strokeStyle = r() < 0.55 ? `${L.grain}${a})` : `rgba(255,240,214,${a * 0.9})`; x.lineWidth = 10 + r() * 38;
      x.beginPath(); x.arc(px, py, 80 + r() * 260, r() * TAU, r() * TAU + 0.9); x.stroke();
    }
    for (let k = 0; k < 2600; k++) {                                         // grit
      const px = r() * W, py = r() * H, rr = 0.8 + r() * 2.8, dark = r() < 0.6, a = 0.06 + r() * 0.2;
      x.fillStyle = dark ? `${L.grain}${a})` : `rgba(255,240,214,${a * 0.8})`; x.beginPath(); x.arc(px, py, rr, 0, TAU); x.fill();
    }
  }
  // soft vignette at the edges so the rim reads as a lip
  const vg = x.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,10,0,0.28)');
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
  // groove shadows under every line and a dark socket round every point (the chalk itself is real geometry)
  x.lineCap = 'round';
  const P = POINTS.map(([px, py]) => at(px - 2, py - 2));
  x.strokeStyle = L.groove; x.lineWidth = 15 * u / 200 * 2.2;
  for (const [a, b] of EDGES) { x.beginPath(); x.moveTo(P[a][0] + 2, P[a][1] + 3); x.lineTo(P[b][0] + 2, P[b][1] + 3); x.stroke(); }
  for (const p of P) { x.fillStyle = L.groove; x.beginPath(); x.arc(p[0] + 2, p[1] + 3, 27, 0, TAU); x.fill(); }
  // chalk-dust smudges beside the lines
  for (let k = 0; k < 160; k++) { const e = EDGES[(r() * EDGES.length) | 0], f = r(), px = P[e[0]][0] + (P[e[1]][0] - P[e[0]][0]) * f, py = P[e[0]][1] + (P[e[1]][1] - P[e[0]][1]) * f; x.fillStyle = `rgba(255,248,230,${0.05 + r() * 0.12})`; x.beginPath(); x.arc(px + (r() - 0.5) * 16, py + (r() - 0.5) * 16, 1 + r() * 3, 0, TAU); x.fill(); }
  // an alpona flower round the centre point, in rice paste
  const [cx, cy] = at(0, 0);
  x.strokeStyle = L.line; x.lineWidth = 5; x.globalAlpha = 0.72;
  for (let k = 0; k < 8; k++) { x.save(); x.translate(cx, cy); x.rotate(k * TAU / 8); x.beginPath(); x.ellipse(0, -66, 17, 40, 0, 0, TAU); x.stroke(); x.beginPath(); x.ellipse(0, -112, 6, 12, 0, 0, TAU); x.stroke(); x.restore(); }
  x.beginPath(); x.arc(cx, cy, 36, 0, TAU); x.stroke(); x.globalAlpha = 1;
  // a dotted border inside the rim
  x.fillStyle = L.line; x.globalAlpha = 0.5;
  const ring = offsetPoly(HEX, 0.34), n = ring.length;
  for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(2, Math.round(l / 0.17)); for (let k = 0; k < m; k++) { const f = k / m, p = at(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); x.beginPath(); x.arc(p[0], p[1], 3.2, 0, TAU); x.fill(); } }
  x.globalAlpha = 1;
  // sheen: broad light from the upper left
  const sh = x.createLinearGradient(0, 0, W, H * 0.6); sh.addColorStop(0, 'rgba(255,240,210,0.16)'); sh.addColorStop(0.5, 'rgba(255,240,210,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.12)');
  x.fillStyle = sh; x.fillRect(0, 0, W, H);
  return c;
}

export function buildBoard(look = 'clay') {
  const L = LOOKS[look] || LOOKS.clay, g = new THREE.Group(); g.name = 'board';
  const bodyGeo = extrudeHex(HEX, 0.5, TOP, 0.05);
  const top = phys({ map: canvasTex(topCanvas(look)), roughness: L.kind === 'slate' ? 0.55 : 0.78, metalness: 0, clearcoat: L.kind === 'teak' ? 0.5 : 0.12, clearcoatRoughness: 0.35 });
  const side = std(L.edge, 0.85);
  const tx = top.map; tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping; tx.repeat.set(1 / (HALF_W * 2), 1 / (HALF_L * 2)); tx.offset.set(0.5, 0.5);
  const body = new THREE.Mesh(bodyGeo, [top, side]); body.castShadow = true; body.receiveShadow = true; g.add(body);
  // a glazed rim round the playing field with a thin ivory line, and studs at the six corners
  const rimGeo = extrudeHex(offsetPoly(HEX, 0.1), 0.34, 0.075, 0.025, { pts: offsetPoly(HEX, 0.3), r: 0.2 });
  const rim = new THREE.Mesh(rimGeo, phys({ color: L.rim, roughness: 0.22, metalness: L.kind === 'slate' ? 0.8 : 0.05, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.4 }));
  rim.position.y = TOP - 0.01; rim.castShadow = true; rim.receiveShadow = true; g.add(rim);
  const rimLine = new THREE.Mesh(extrudeHex(offsetPoly(HEX, 0.2), 0.25, 0.02, 0.006, { pts: offsetPoly(HEX, 0.225), r: 0.2 }), std(L.line, 0.5));
  rimLine.position.y = TOP + 0.062; g.add(rimLine);
  const stud = B.material('brass', { color: L.stud, color2: '#fff0b0', roughness: 0.25, seed: 11 });
  const studGeo = B.lathe([[0, 0], [0.16, 0], [0.17, 0.03], [0.15, 0.07], [0.1, 0.11], [0.04, 0.125], [0, 0.13]], 28);
  for (const [px, pz] of HEX) { const m = new THREE.Mesh(studGeo, stud); const f = 0.93; m.position.set(px * f, TOP + 0.04, pz * f); m.castShadow = true; g.add(m); }
  // the chalk lattice: real raised lines and dots so light and shadow catch them
  const chalk = phys({ color: L.line, roughness: 0.62, metalness: L.kind === 'teak' ? 0.5 : 0, clearcoat: 0.1 });
  const lineGeo = B.roundedBox(1, 0.022, 0.058, 0.01, 2), parts = [];
  const W = (i) => [POINTS[i][0] - 2, POINTS[i][1] - 2];
  for (const [a, b] of EDGES) {
    const A = W(a), Bq = W(b), dx = Bq[0] - A[0], dz = Bq[1] - A[1], len = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx);
    const m = new THREE.Matrix4().compose(new THREE.Vector3((A[0] + Bq[0]) / 2, TOP + 0.006, (A[1] + Bq[1]) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(len, 1, 1));
    parts.push({ geo: lineGeo, m });
  }
  const dotGeo = B.lathe([[0, 0], [0.135, 0], [0.135, 0.016], [0.12, 0.03], [0, 0.034]], 24);
  for (let i = 0; i < POINTS.length; i++) { const p = W(i); parts.push({ geo: dotGeo, m: new THREE.Matrix4().makeTranslation(p[0], TOP - 0.004, p[1]) }); }
  const lat = new THREE.Mesh(B.mergeGeos(parts), chalk); lat.castShadow = true; lat.receiveShadow = true; g.add(lat);
  // a cushion of plinth stones under the slab so it sits on the mat, not floating
  const foot = new THREE.Mesh(extrudeHex(offsetPoly(HEX, 0.25), 0.6, 0.05, 0.02), std('#4a2a18', 0.9)); foot.position.y = -0.045; foot.receiveShadow = true; g.add(foot);
  return g;
}

// ---------------------------------------------------------------- the stones
const pebbleGeo = memo('pebbleGeo', () => {
  const geo = new THREE.SphereGeometry(1, 56, 34), p = geo.attributes.position, r = rngOf(7);
  const ph = [r() * TAU, r() * TAU, r() * TAU];
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const lump = 1 + 0.045 * Math.sin(x * 3.1 + ph[0]) + 0.04 * Math.sin(z * 2.7 + ph[1]) + 0.025 * Math.sin((x + z) * 4.3 + ph[2]);
    x *= 0.315 * lump; z *= 0.29 * lump;
    y = y >= 0 ? y * 0.15 : y * 0.072;                                   // a river pebble: domed on top, gently rounded underneath
    p.setXYZ(i, x, y + 0.076, z);
  }
  geo.computeVertexNormals(); return geo;
});
const clayProfile = (R = 0.335) => [[0, 0], [0.9, 0], [0.97, 0.012], [1, 0.04], [0.99, 0.11], [0.95, 0.16], [0.86, 0.2], [0.76, 0.215], [0.62, 0.21], [0.55, 0.222], [0.46, 0.232], [0.3, 0.244], [0.15, 0.25], [0, 0.252]].map(([r, y]) => [r * R, y * (CLAY_H / 0.252)]);
const clayGeo = memo('clayGeo', () => B.lathe(clayProfile(), 64));
const flowerGeo = memo('flowerGeo', () => {
  const parts = [];
  for (let k = 0; k < 6; k++) {
    const a = k * TAU / 6, s = new THREE.Shape(); const pts = [];
    for (let j = 0; j < 20; j++) { const t = (j / 20) * TAU; pts.push(new THREE.Vector2(Math.cos(t) * 0.05, -Math.sin(t) * 0.1)); }
    const geo = B.inlay(pts.map((v) => [v.x, -v.y]), 0.012, { bevel: 0.003 });
    const m = new THREE.Matrix4().makeRotationY(a); m.setPosition(Math.sin(a) * 0.1, 0, Math.cos(a) * 0.1);
    // the petal long axis points outward: rotate the ellipse so its long axis (z) follows the spoke
    parts.push({ geo, m: new THREE.Matrix4().makeTranslation(Math.sin(a) * 0.105, 0, Math.cos(a) * 0.105).multiply(new THREE.Matrix4().makeRotationY(a)) });
  }
  parts.push({ geo: B.lathe([[0, 0], [0.035, 0], [0.035, 0.012], [0, 0.015]], 16) });
  return B.mergeGeos(parts);
});
const ringGeo = memo('ringGeo', () => new THREE.TorusGeometry(0.15, 0.009, 8, 48));

function pebbleCanvas(c0, c1, seed) {
  const c = cv(256), x = c.getContext('2d'), r = rngOf(seed);
  const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 40; k++) { const px = r() * 256, py = r() * 256, rr = 20 + r() * 60, gr = x.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, r() < 0.5 ? 'rgba(120,100,70,0.16)' : 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  x.lineCap = 'round';
  for (let v = 0; v < 7; v++) { x.strokeStyle = `rgba(110,90,60,${0.12 + r() * 0.16})`; x.lineWidth = 0.8 + r() * 1.6; x.beginPath(); let px = r() * 256, py = r() * 256; x.moveTo(px, py); for (let s = 0; s < 6; s++) { px += 20 + r() * 30; py += (r() - 0.5) * 50; x.lineTo(px, py); } x.stroke(); }
  for (let k = 0; k < 400; k++) { x.fillStyle = r() < 0.5 ? 'rgba(90,70,40,0.25)' : 'rgba(255,255,255,0.3)'; x.fillRect(r() * 256, r() * 256, 1, 1); }
  return c;
}
const STONE_STYLES = {
  classic:  { 1: { color: '#efe4cb', color2: '#cdbd94', ink: '#7a4a14' }, 2: { color: '#22349c', hi: '#5973e6', ink: '#ffd878' } },
  marigold: { 1: { color: '#f5b92c', color2: '#c27a0a', ink: '#6b3500', amber: true }, 2: { color: '#1f9d79', hi: '#6be0b6', ink: '#f2fff8' } },
};
function glazeCanvas(base, hi, seed) {
  const c = cv(256), x = c.getContext('2d'), r = rngOf(seed);
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 46; k++) { const gr = x.createRadialGradient(r() * 256, r() * 256, 0, r() * 256, r() * 256, 40 + r() * 70); gr.addColorStop(0, r() < 0.5 ? hi + '55' : '#00000040'); gr.addColorStop(1, '#00000000'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256); }
  for (let k = 0; k < 500; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)'; x.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
  return c;
}
export function makePiece(side, king, style = 'classic') {
  const S = STONE_STYLES[style] || STONE_STYLES.classic, d = S[side], grp = new THREE.Group();
  const ink = memo(`ink|${d.ink}`, () => B.material('brass', { color: d.ink, color2: d.ink, roughness: 0.3, seed: 3, envIntensity: 2.2 }));
  if (side === 1) {                                                         // polished river pebble with an incised ring
    const body = memo(`peb|${style}`, () => d.amber
      ? phys({ color: d.color, roughness: 0.18, transmission: 0.0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5 })
      : phys({ map: canvasTex(pebbleCanvas(d.color, d.color2, 23)), roughness: 0.26, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 1.1 }));
    const m = new THREE.Mesh(pebbleGeo, body); m.castShadow = true; m.receiveShadow = true; grp.add(m);
    grp.userData.h = PEB_H;
  } else {                                                                  // glazed clay piece with a raised six-petal flower
    const body = memo(`clay|${style}`, () => phys({ map: canvasTex(glazeCanvas(d.color, d.hi, 17)), roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.9 }));
    const m = new THREE.Mesh(clayGeo, body); m.castShadow = true; m.receiveShadow = true; grp.add(m);
    const fl = new THREE.Mesh(flowerGeo, ink); fl.position.y = CLAY_H - 0.004; grp.add(fl);
    const rimRing = new THREE.Mesh(memo('clayRing', () => new THREE.TorusGeometry(0.285, 0.012, 8, 48)), ink); rimRing.rotation.x = Math.PI / 2; rimRing.position.y = CLAY_H * 0.82; rimRing.scale.set(1, 1, 0.6); grp.add(rimRing);
    grp.userData.h = CLAY_H;
  }
  return grp;
}

// ---------------------------------------------------------------- courtyard: ground, mat, alpona
function earthCanvas(S = 1024, seed = 4) {
  const c = cv(S), x = c.getContext('2d'), r = rngOf(seed);
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#7e5236'); g.addColorStop(0.5, '#6d442b'); g.addColorStop(1, '#7a4e33'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let k = 0; k < 260; k++) { const px = r() * S, py = r() * S, rr = 30 + r() * 150, gr = x.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, r() < 0.5 ? 'rgba(255,214,170,0.07)' : 'rgba(30,12,4,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  for (let k = 0; k < 5200; k++) { const px = r() * S, py = r() * S; x.fillStyle = r() < 0.5 ? `rgba(255,226,190,${0.05 + r() * 0.12})` : `rgba(26,10,2,${0.08 + r() * 0.18})`; x.fillRect(px, py, 1 + r() * 2.4, 1 + r() * 2.4); }
  x.strokeStyle = 'rgba(20,8,0,0.35)'; x.lineWidth = 1.2;                      // sun-baked cracks
  for (let k = 0; k < 14; k++) { x.beginPath(); let px = r() * S, py = r() * S; x.moveTo(px, py); for (let s = 0; s < 9; s++) { px += (r() - 0.5) * 70; py += (r() - 0.5) * 70; x.lineTo(px, py); } x.stroke(); }
  return c;
}
function alponaCanvas(S = 2048) {
  const c = cv(S), x = c.getContext('2d'), m = S / 2;
  x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = 'rgba(255,248,232,0.9)'; x.fillStyle = 'rgba(255,248,232,0.9)';
  const R0 = S * 0.47;
  x.lineWidth = 7; x.beginPath(); x.arc(m, m, R0, 0, TAU); x.stroke(); x.lineWidth = 4; x.beginPath(); x.arc(m, m, R0 * 0.965, 0, TAU); x.stroke();
  for (let k = 0; k < 24; k++) { const a = k * TAU / 24; x.save(); x.translate(m, m); x.rotate(a); x.lineWidth = 5; x.beginPath(); x.moveTo(R0 * 0.94, 0); x.bezierCurveTo(R0 * 0.88, 26, R0 * 0.80, 26, R0 * 0.78, 0); x.bezierCurveTo(R0 * 0.80, -26, R0 * 0.88, -26, R0 * 0.94, 0); x.stroke(); x.beginPath(); x.arc(R0 * 0.985, 0, 4.5, 0, TAU); x.fill(); x.restore(); }
  x.lineWidth = 5;                                                           // a rolling vine between two rings
  x.beginPath(); for (let t = 0; t <= 720; t++) { const a = t / 720 * TAU, rr = R0 * 0.70 + Math.sin(a * 16) * 14; const px = m + Math.cos(a) * rr, py = m + Math.sin(a) * rr; t ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  x.lineWidth = 4; x.beginPath(); x.arc(m, m, R0 * 0.60, 0, TAU); x.stroke();
  for (let k = 0; k < 16; k++) { const a = k * TAU / 16 + 0.1; x.save(); x.translate(m, m); x.rotate(a); x.beginPath(); x.ellipse(R0 * 0.52, 0, 38, 14, 0, 0, TAU); x.stroke(); x.restore(); }
  return c;
}
function matCanvas(W = 512, H = 768) {
  const c = cv(W, H), x = c.getContext('2d'), r = rngOf(31);
  x.fillStyle = '#d6b36a'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < W; i += 6) { x.fillStyle = i % 12 ? 'rgba(120,80,20,0.22)' : 'rgba(255,238,170,0.22)'; x.fillRect(i, 0, 3, H); }
  for (let i = 0; i < H; i += 5) { x.fillStyle = `rgba(90,52,10,${0.04 + r() * 0.1})`; x.fillRect(0, i, W, 1.5); }
  x.strokeStyle = '#8a1f1a'; x.lineWidth = 22; x.strokeRect(24, 24, W - 48, H - 48); x.strokeStyle = '#1f2f6f'; x.lineWidth = 7; x.strokeRect(54, 54, W - 108, H - 108);
  x.fillStyle = '#8a1f1a'; for (let k = 0; k < 26; k++) { const t = (k + 0.5) / 26; for (const [px, py] of [[t * (W - 130) + 65, 40], [t * (W - 130) + 65, H - 40]]) { x.beginPath(); x.moveTo(px, py - 9); x.lineTo(px + 9, py); x.lineTo(px, py + 9); x.lineTo(px - 9, py); x.fill(); } }
  return c;
}
export function buildGround() {
  const g = new THREE.Group(); g.name = 'ground';
  const earth = canvasTex(earthCanvas(1024), { repeat: [10, 10] });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), std('#ffffff', 0.95, 0, { map: earth }));
  plane.rotation.x = -Math.PI / 2; plane.receiveShadow = true; g.add(plane);
  const alp = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: canvasTex(alponaCanvas(2048)), transparent: true, opacity: 0.42, depthWrite: false }));
  alp.rotation.x = -Math.PI / 2; alp.position.y = 0.004; alp.renderOrder = 1; g.add(alp);
  return g;
}
export function buildMat() {
  const g = new THREE.Group(); g.name = 'mat';
  const matTex = canvasTex(matCanvas());
  const mat = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.035, 11.4), [std('#b38a42', 0.95), std('#b38a42', 0.95), std('#ffffff', 0.92, 0, { map: matTex }), std('#6b4a1c', 0.95), std('#b38a42', 0.95), std('#b38a42', 0.95)]);
  mat.position.y = 0.0175; mat.receiveShadow = true; mat.castShadow = false; g.add(mat);
  return g;
}

// ---------------------------------------------------------------- props: hut, tulsi, banana, diya, pot
function thatchCanvas() {
  const c = cv(256), x = c.getContext('2d'), r = rngOf(9);
  x.fillStyle = '#9b7a3c'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const px = r() * 256, py = r() * 256, a = 0.1 + r() * 0.3; x.strokeStyle = r() < 0.5 ? `rgba(60,36,10,${a})` : `rgba(230,200,120,${a})`; x.lineWidth = 0.8 + r() * 1.6; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 6, py + 18 + r() * 26); x.stroke(); }
  return c;
}
export function buildHut() {
  const g = new THREE.Group(); g.name = 'hut';
  const wallMat = std('#b9825a', 0.95), wall = new THREE.Mesh(B.roundedBox(7, 2.6, 4.2, 0.18, 4), wallMat); wall.position.y = 1.3; wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
  const base = new THREE.Mesh(B.roundedBox(7.3, 0.5, 4.5, 0.15, 3), std('#f1e3c8', 0.9)); base.position.y = 0.25; base.receiveShadow = true; g.add(base);   // whitewashed plinth
  const th = canvasTex(thatchCanvas(), { repeat: [3, 2] }), roofMat = std('#ffffff', 1, 0, { map: th });
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 1, 1, 4, 1), roofMat); roof.rotation.y = Math.PI / 4; roof.scale.set(5.6, 2.3, 3.5); roof.position.y = 3.75; roof.castShadow = true; g.add(roof);
  const ridge = new THREE.Mesh(B.roundedBox(2.2, 0.2, 0.3, 0.1), std('#6b4a1c', 0.9)); ridge.position.y = 4.88; g.add(ridge);
  // doorway with a warm interior light
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.8), new THREE.MeshBasicMaterial({ color: 0xffb454 })); door.position.set(0.4, 1.2, 2.12); g.add(door);
  const frame = new THREE.Mesh(B.roundedBox(1.35, 2.0, 0.12, 0.04), std('#4a2a14', 0.8)); frame.position.set(0.4, 1.2, 2.08); g.add(frame);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.55), new THREE.MeshBasicMaterial({ color: 0xffa23c })); win.position.set(-2.1, 1.55, 2.12); g.add(win);
  // veranda posts (bamboo) and a hanging lantern
  const bam = std('#9a8a3a', 0.6);
  for (const px of [-3.3, 3.3, -1.4, 2.2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.5, 10), bam); p.position.set(px, 1.25, 2.9); p.castShadow = true; g.add(p); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6.8, 10), bam); beam.rotation.z = Math.PI / 2; beam.position.set(0, 2.5, 2.9); g.add(beam);
  const lant = new THREE.Mesh(B.lathe([[0, 0], [0.12, 0], [0.16, 0.05], [0.14, 0.28], [0.1, 0.34], [0, 0.36]], 14), new THREE.MeshBasicMaterial({ color: 0xffc66a })); lant.position.set(2.2, 1.95, 2.9); g.add(lant);
  g.userData.lantern = lant;
  return g;
}
export function buildTulsi() {
  const g = new THREE.Group(); g.name = 'tulsi';
  const plaster = std('#f2e4c6', 0.9), terra = std('#b8552e', 0.9), red = std('#a63a22', 0.9);
  const tiers = [[1.2, 0.22], [1.0, 0.2], [0.82, 0.62]];
  let y = 0;
  tiers.forEach(([w, h]) => { const m = new THREE.Mesh(B.roundedBox(w, h, w, 0.05, 3), plaster); m.position.y = y + h / 2; m.castShadow = true; m.receiveShadow = true; g.add(m); y += h; });
  const band = new THREE.Mesh(B.roundedBox(0.9, 0.07, 0.9, 0.03), red); band.position.y = 0.42 + 0.03; g.add(band);
  // arched niche with a small glowing lamp
  const nich = new THREE.Shape(); nich.moveTo(-0.14, 0); nich.lineTo(0.14, 0); nich.lineTo(0.14, 0.2); nich.absarc(0, 0.2, 0.14, 0, Math.PI, false); nich.lineTo(-0.14, 0);
  const nm = new THREE.Mesh(new THREE.ShapeGeometry(nich), new THREE.MeshBasicMaterial({ color: 0x3a1a0a })); nm.position.set(0, 0.7, 0.412); g.add(nm);
  const gl = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), new THREE.MeshBasicMaterial({ color: 0xffc060 })); gl.position.set(0, 0.76, 0.415); g.add(gl);
  const rim = new THREE.Mesh(B.lathe([[0.36, 0], [0.5, 0.04], [0.54, 0.22], [0.5, 0.27], [0.42, 0.25], [0.38, 0.2], [0, 0.18]], 28), terra); rim.position.y = y; rim.castShadow = true; g.add(rim);
  const leafMats = [std('#3f9a3f', 0.7, 0, { side: THREE.DoubleSide }), std('#2c7a2c', 0.75, 0, { side: THREE.DoubleSide }), std('#58b04a', 0.7, 0, { side: THREE.DoubleSide })];
  const lg = new THREE.CircleGeometry(0.11, 8); lg.scale(1, 1.5, 1);
  const r = rngOf(13), plant = new THREE.Group(); plant.position.y = y + 0.22;
  for (let i = 0; i < 150; i++) {
    const m = new THREE.Mesh(lg, leafMats[i % 3]), h = r() * 1.05, rad = (0.06 + Math.sin(Math.min(1, h / 1.05) * Math.PI) * 0.4) * (0.45 + r() * 0.65), a2 = r() * TAU;
    m.position.set(Math.cos(a2) * rad, h, Math.sin(a2) * rad); m.rotation.set(-0.9 + (r() - 0.5) * 1.2, a2 + Math.PI / 2 + (r() - 0.5), (r() - 0.5) * 0.8); m.castShadow = i % 5 === 0; plant.add(m);
  }
  const sp = new THREE.CylinderGeometry(0.008, 0.012, 0.22, 5), spm = std('#8a3a9a', 0.6);
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(sp, spm), a2 = r() * TAU, rad = 0.08 + r() * 0.3; m.position.set(Math.cos(a2) * rad, 0.95 + r() * 0.25, Math.sin(a2) * rad); m.rotation.set((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4); plant.add(m); }
  g.add(plant); g.userData.plant = plant;
  return g;
}
export function buildBanana() {
  const g = new THREE.Group(); g.name = 'banana';
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 3.0, 14), std('#7fa04a', 0.8)); stem.position.y = 1.5; stem.castShadow = true; g.add(stem);
  const ringM = std('#5c7a34', 0.9);
  for (let k = 0; k < 6; k++) { const rg = new THREE.Mesh(new THREE.TorusGeometry(0.27 - k * 0.012, 0.025, 6, 20), ringM); rg.rotation.x = Math.PI / 2; rg.position.y = 0.4 + k * 0.45; g.add(rg); }
  const leaves = [];
  // a leaf: a long strip with a midrib, bent over like a real banana leaf
  const mkLeaf = (len, wid) => {
    const seg = 14, geo = new THREE.PlaneGeometry(wid, len, 2, seg), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = Math.max(0, p.getY(i) + len / 2), t = Math.min(1, y / len);   // clamp: a -1e-16 from float rounding made pow(t, 2.1) NaN
      const droop = -Math.pow(t, 2.1) * len * 0.45;
      const cup = -Math.abs(x) * 0.16;
      p.setXYZ(i, x * (1 - Math.pow(t, 3) * 0.7), y * (1 - t * 0.2), droop + cup);
    }
    geo.computeVertexNormals(); return geo;
  };
  const leafM = std('#4d9a3a', 0.65, 0, { side: THREE.DoubleSide }), leafM2 = std('#3b8030', 0.7, 0, { side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const pivot = new THREE.Group(), m = new THREE.Mesh(mkLeaf(3.4 + (i % 3) * 0.5, 0.95), i % 2 ? leafM : leafM2);
    m.rotation.x = -Math.PI / 2 + 0.3; m.castShadow = true; pivot.add(m); pivot.position.y = 2.9; pivot.rotation.y = i * TAU / 6 + 0.4; pivot.rotation.z = 0; g.add(pivot);
    const tilt = new THREE.Group(); tilt.rotation.x = 0; leaves.push({ pivot, m, base: pivot.rotation.y, ph: i * 1.3 });
  }
  g.userData.leaves = leaves;
  return g;
}
export function buildDiya() {
  const g = new THREE.Group(); g.name = 'diya';
  const clay = std('#b4532a', 0.8);
  const bowl = new THREE.Mesh(B.lathe([[0, 0], [0.14, 0], [0.2, 0.04], [0.26, 0.11], [0.27, 0.15], [0.24, 0.14], [0.2, 0.1], [0.1, 0.075], [0, 0.07]], 28), clay); bowl.castShadow = true; g.add(bowl);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.07, 0.17, 10), clay); spout.rotation.z = -Math.PI / 2; spout.position.set(0.3, 0.13, 0); g.add(spout);
  const oil = new THREE.Mesh(new THREE.CircleGeometry(0.19, 20), new THREE.MeshBasicMaterial({ color: 0xffb84a })); oil.rotation.x = -Math.PI / 2; oil.position.y = 0.12; g.add(oil);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), std('#201008', 1)); wick.position.set(0.22, 0.17, 0); wick.rotation.z = -0.35; g.add(wick);
  return g;
}
export function buildPot() {
  const g = new THREE.Group(); g.name = 'pot';
  const brass = B.material('brass', { color: '#d9a93a', color2: '#f6dc8a', roughness: 0.3, seed: 5 });
  const m = new THREE.Mesh(B.lathe([[0, 0], [0.34, 0], [0.5, 0.1], [0.6, 0.32], [0.55, 0.55], [0.36, 0.72], [0.3, 0.86], [0.38, 0.98], [0.36, 1.0], [0.24, 0.9], [0.22, 0.74]], 36), brass);
  m.castShadow = true; g.add(m); return g;
}

// ---------------------------------------------------------------- the whole courtyard (shared by the game presenter and the icon render)
function softTex(rgb, a = 1, size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return canvasTex(c);
}
function flameTex() {
  const c = cv(64, 128), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 84, 2, 32, 76, 40); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.35, 'rgba(255,200,80,0.95)'); g.addColorStop(0.75, 'rgba(255,110,20,0.5)'); g.addColorStop(1, 'rgba(255,60,0,0)');
  x.fillStyle = g; x.beginPath(); x.moveTo(32, 4); x.bezierCurveTo(54, 52, 58, 78, 32, 122); x.bezierCurveTo(6, 78, 10, 52, 32, 4); x.fill();
  return canvasTex(c);
}
export function buildWorld({ fx = true } = {}) {
  const group = new THREE.Group(); group.name = 'world';
  group.add(buildGround());
  // mud boundary wall with a thatched cap, then the hut behind it
  const wallL = new THREE.Mesh(B.roundedBox(34, 1.15, 0.8, 0.22, 4), std('#a8744c', 0.95)); wallL.position.set(0, 0.575, -9.4); wallL.castShadow = true; wallL.receiveShadow = true; group.add(wallL);
  const cap = new THREE.Mesh(B.roundedBox(34.4, 0.2, 1.15, 0.1, 3), std('#ffffff', 1, 0, { map: canvasTex(thatchCanvas(), { repeat: [14, 1] }) })); cap.position.set(0, 1.25, -9.4); cap.castShadow = true; group.add(cap);
  const hut = buildHut(); hut.position.set(6.5, 0, -15.5); hut.rotation.y = -0.18; hut.scale.setScalar(0.9); group.add(hut);
  const hut2 = buildHut(); hut2.position.set(-14, 0, -13); hut2.rotation.y = 0.5; hut2.scale.setScalar(0.8); group.add(hut2);
  const tulsi = buildTulsi(); tulsi.position.set(5.2, 0, -5.4); tulsi.scale.setScalar(1.25); group.add(tulsi);
  const banana = buildBanana(); banana.position.set(-5.2, 0, -7.2); banana.scale.setScalar(1.15); group.add(banana);
  const banana2 = buildBanana(); banana2.position.set(11.0, 0, -7.0); banana2.scale.setScalar(0.95); banana2.rotation.y = 1.3; group.add(banana2);
  const pot = buildPot(); pot.position.set(5.9, 0, 4.2); pot.scale.setScalar(1.0); group.add(pot);
  // oil lamps: clay diya, flame, halo and a thread of smoke; two of them also light the board
  const flameT = flameTex(), haloT = softTex('255,190,100', 0.95, 128), smokeT = softTex('210,200,190', 0.5, 64);
  const diyaAt = [[-2.4, 6.1], [2.6, 6.3], [-6.0, 1.6], [6.0, -1.0]];
  const flames = [], smokes = [];
  diyaAt.forEach(([x, z], i) => {
    const d = buildDiya(); d.position.set(x, 0.0, z); d.rotation.y = i * 1.7; group.add(d);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); fl.scale.set(0.22, 0.42, 1); fl.center.set(0.5, 0.1); fl.position.set(x + Math.cos(d.rotation.y) * 0.22, 0.2, z - Math.sin(d.rotation.y) * 0.22); group.add(fl);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55, fog: false })); halo.scale.setScalar(2.2); halo.position.copy(fl.position); halo.position.y += 0.2; group.add(halo);
    flames.push({ fl, halo, x: fl.position.x, z: fl.position.z, ph: i * 2.1 });
    for (let k = 0; k < 3; k++) { const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeT, transparent: true, depthWrite: false, opacity: 0 })); group.add(sm); smokes.push({ sm, i, k, x: fl.position.x, z: fl.position.z }); }
  });
  const warm = [new THREE.PointLight(0xffa24a, 5, 14, 1.7), new THREE.PointLight(0xffa24a, 4, 14, 1.7)];
  warm[0].position.set(-2.4, 0.9, 5.4); warm[1].position.set(2.6, 0.9, 5.6); warm.forEach((l) => group.add(l));
  // fireflies (jonaki) drifting low over the courtyard
  const N = 46, ff = new Float32Array(N * 3), r = rngOf(77);
  for (let i = 0; i < N; i++) { ff[i * 3] = (r() - 0.5) * 24; ff[i * 3 + 1] = 0.5 + r() * 2.8; ff[i * 3 + 2] = -14 + r() * 24; }
  const flies = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: softTex('200,255,120', 1, 64), color: 0xd8ff7a, size: 0.3, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false }));
  flies.geometry.setAttribute('position', new THREE.BufferAttribute(ff.slice(), 3)); flies.userData.base = ff; group.add(flies);
  const parts = { group, hut, hut2, tulsi, banana, banana2, flames, smokes, warm, flies, lantern: hut.userData.lantern };
  parts.update = (t, calm = false, showFx = true) => {
    const k = calm ? 0.25 : 1;
    // flames: flicker and lean with a slow evening breeze; light follows the flicker
    flames.forEach((f, i) => {
      const fk = 1 + k * (0.16 * Math.sin(t * 9.1 + f.ph) + 0.1 * Math.sin(t * 17.3 + f.ph * 2) + 0.06 * Math.sin(t * 31 + f.ph));
      const lean = k * (0.05 + 0.04 * Math.sin(t * 0.6 + f.ph));
      f.fl.scale.set(0.22 * (2 - fk) * 0.9, 0.42 * fk, 1); f.fl.position.x = f.x + lean; f.halo.position.x = f.x + lean * 0.6; f.halo.material.opacity = 0.42 * fk;
    });
    warm[0].intensity = 5 * (1 + k * (0.12 * Math.sin(t * 9.1) + 0.07 * Math.sin(t * 17.3)));
    warm[1].intensity = 4 * (1 + k * (0.12 * Math.sin(t * 8.3 + 2) + 0.07 * Math.sin(t * 15.1)));
    smokes.forEach((s, j) => {
      s.sm.visible = showFx; if (!showFx) return;
      const u = ((t * 0.16 + s.k / 3 + j * 0.11) % 1), f = flames[s.i];
      s.sm.position.set(f.x + Math.sin(u * 6 + j) * 0.08 + u * 0.25 * k, 0.55 + u * 1.5, f.z + Math.cos(u * 5 + j) * 0.05);
      s.sm.scale.setScalar(0.12 + u * 0.55); s.sm.material.opacity = Math.sin(u * Math.PI) * 0.22;
    });
    // banana leaves sway and flutter; tulsi trembles; the hanging lantern swings
    for (const b of [banana, banana2]) b.userData.leaves.forEach((lf, i) => {
      const sway = k * (0.07 * Math.sin(t * 0.9 + lf.ph) + 0.03 * Math.sin(t * 2.3 + lf.ph * 1.7));
      lf.m.rotation.x = -Math.PI / 2 + 0.3 + sway * 0.9; lf.pivot.rotation.z = sway * 0.6;
    });
    tulsi.userData.plant.rotation.z = k * 0.02 * Math.sin(t * 1.7); tulsi.userData.plant.rotation.x = k * 0.015 * Math.sin(t * 1.3 + 1);
    if (parts.lantern) parts.lantern.rotation.z = k * 0.12 * Math.sin(t * 1.1);
    flies.visible = showFx;
    if (showFx) {
      const a = flies.geometry.attributes.position, bse = flies.userData.base;
      for (let i = 0; i < a.count; i++) { a.array[i * 3] = bse[i * 3] + Math.sin(t * 0.21 + i * 1.7) * 0.9 * k; a.array[i * 3 + 1] = bse[i * 3 + 1] + Math.sin(t * 0.33 + i) * 0.5 * k; a.array[i * 3 + 2] = bse[i * 3 + 2] + Math.cos(t * 0.17 + i * 2.3) * 0.7 * k; }
      a.needsUpdate = true; flies.material.opacity = 0.55 + 0.4 * Math.sin(t * 1.6);
    }
  };
  return parts;
}
export { softTex };
export const HEX_PTS = HEX;
