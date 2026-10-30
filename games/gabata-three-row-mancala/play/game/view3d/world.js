// Gabata 3D world (units: centimetres). A carved three-row board (dark acacia, or fired highland clay) lying on a coiled grass mat in a
// stone-walled highland courtyard: dry-stone wall behind, flagstones under the mat, a clay coffee pot (jebena) with its steam and a tray of
// little cups, soft cool morning light. Everything is procedural (canvas textures + analytic geometry): no image files.
// Shared by the presenter and the icon page. The flat game works in "board units" (BW x BH); S converts them to centimetres.
import * as THREE from '../vendor3d/three.js';
import { BW, BH, PAD, ROW_H, CELLS, HOLE_R } from '../src/art.js';

export const S = 0.082;                          // cm per board unit
export const HX = BW * S / 2, HZ = BH * S / 2;   // half size of the board
export const TOP = 4.4;                          // height of the board's top face above the mat
export const RIM = TOP - 0.42;                   // the recessed playing field
export const PIT_R = 3.7, PIT_D = 2.3;           // pit radius / depth
export const SEED_R = 1.16;
export const BOARD_Y = 0.16;                     // the board lies on the mat
const TAU = Math.PI * 2;
export const toWorld = (bx, by) => ({ x: (bx - BW / 2) * S, z: (by - BH / 2) * S });
export const toBoard = (x, z) => ({ bx: x / S + BW / 2, by: z / S + BH / 2 });
export const PITS = CELLS.map((c, i) => ({ i, ...toWorld(c.cx, c.cy), owner: c.owner }));

const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi + seed * 131, yi), b = hash(xi + 1 + seed * 131, yi), c = hash(xi + seed * 131, yi + 1), d = hash(xi + 1 + seed * 131, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, seed, oct = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i); f *= 2.03; a *= 0.5; } return s; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const tex = (cv, srgb, aniso = 8) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };

// ---------------------------------------------------------------- the board
export const BOARDS = {
  acacia: { face: ['#55301c', '#663b23', '#482617'], edge: ['#3a1e11', '#4a2916', '#2f180d'], grain: [22, 9, 3], rough: 0.42, mottle: 0, own: ['#f2b94a', '#5fc2b2'], inlay: '#d9a441', dan: ['#f3e8cf', '#e6cf9c', '#d29a55', '#bd5b33', '#a5ad6c'] },
  clay: { face: ['#b0653e', '#c4774b', '#9c552f'], edge: ['#7c3b1e', '#8e4826', '#6c3118'], grain: [80, 30, 10], rough: 0.36, mottle: 1, own: ['#f4c85a', '#7fc8d9'], inlay: '#e9c77a', dan: ['#fbf3e0', '#f0dcae', '#e0b868', '#c9704a', '#8fb09a'] },
};
const sdBox = (x, z, hx, hz, r) => { const qx = Math.abs(x) - (hx - r), qz = Math.abs(z) - (hz - r); return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r; };
const FX = (BW / 2 - PAD + 10) * S, FZ = (BH / 2 - PAD + 10) * S;

function boardHeight(x, z) {
  const sd = sdBox(x, z, HX, HZ, 2.3);
  if (sd > 0) return TOP - 1.1;   // a thin shelf round the carved top; the body (below) is a smooth rounded slab
  let h = TOP;
  if (sd > -1.1) { const t = 1 - -sd / 1.1; h -= 1.1 * t * t; }
  h -= 0.42 * sstep(0.45, -0.15, sdBox(x, z, FX, FZ, 1.8));
  for (let i = 0; i < PITS.length; i++) {
    const P = PITS[i], dx = x - P.x, dz = z - P.z;
    if (Math.abs(dx) > 4.6 || Math.abs(dz) > 4.6) continue;
    const d = Math.hypot(dx, dz) / PIT_R;
    if (d < 1) { const u = 1 - d * d; h -= PIT_D * Math.pow(u, 0.8); } else if (d < 1.18) h += 0.07 * Math.sin((d - 1) / 0.18 * Math.PI);
  }
  return h;
}

function paintBoard(theme, W) {
  const B = BOARDS[theme] || BOARDS.acacia, H = Math.round(W * BH / BW), u = W / BW, r = lcg(31);
  const col = canvas(W, H), c = col.getContext('2d'), bump = canvas(W, H), b = bump.getContext('2d');
  c.scale(u, u); b.scale(u, u);
  const grad = (ctx, cols, x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]); return g; };
  c.fillStyle = grad(c, B.edge, 0, 0, BW, BH); c.fillRect(-4, -4, BW + 8, BH + 8);
  b.fillStyle = 'rgb(128,128,128)'; b.fillRect(-4, -4, BW + 8, BH + 8);
  // the field (lighter wood inside the carved frame)
  c.save(); c.beginPath(); c.roundRect(PAD - 10, PAD - 10, BW - 2 * PAD + 20, BH - 2 * PAD + 20, 22); c.fillStyle = grad(c, B.face, 0, PAD, BW, BH - PAD); c.fill(); c.restore();
  // grain along the length, over the whole board
  const [gr, gg, gb] = B.grain;
  for (let k = 0; k < 440; k++) {
    const y0 = r() * BH, amp = 1 + r() * 6, ph = r() * 6, len = (0.3 + r() * 0.7) * BW, x0 = r() * (BW - len), a = 0.05 + r() * 0.2;
    c.strokeStyle = r() < 0.72 ? `rgba(${gr},${gg},${gb},${a})` : `rgba(255,214,170,${0.03 + r() * 0.07})`; c.lineWidth = 0.5 + r() * 1.8;
    b.strokeStyle = r() < 0.5 ? 'rgba(96,96,96,0.30)' : 'rgba(166,166,166,0.22)'; b.lineWidth = c.lineWidth * 0.8;
    c.beginPath(); b.beginPath();
    for (let x = 0; x <= len; x += 20) { const y = y0 + Math.sin(x / 90 + ph) * amp + Math.sin(x / 31 + ph * 2) * 0.8; if (x) { c.lineTo(x0 + x, y); b.lineTo(x0 + x, y); } else { c.moveTo(x0 + x, y); b.moveTo(x0 + x, y); } }
    c.stroke(); b.stroke();
  }
  if (B.mottle) {   // fired clay: burnished mottling and tiny pits
    for (let k = 0; k < 900; k++) { const x = r() * BW, y = r() * BH, s = 2 + r() * 14; c.fillStyle = r() < 0.5 ? `rgba(70,28,10,${0.03 + r() * 0.07})` : `rgba(255,205,160,${0.03 + r() * 0.06})`; c.beginPath(); c.ellipse(x, y, s, s * (0.5 + r() * 0.5), r() * 3, 0, TAU); c.fill(); }
    for (let k = 0; k < 500; k++) { const x = r() * BW, y = r() * BH; b.fillStyle = 'rgba(70,70,70,0.5)'; b.beginPath(); b.arc(x, y, 0.5 + r() * 1.1, 0, TAU); b.fill(); }
  }
  // carved zig-zag band around the field: a row of teeth between two incised lines
  const band = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.round(len / 13), a = Math.atan2(y1 - y0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const ctx of [c, b]) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-len / n / 2, 3.4); ctx.lineTo(0, -3.4); ctx.lineTo(len / n / 2, 3.4); ctx.closePath();
        if (ctx === c) { ctx.fillStyle = i % 2 ? 'rgba(14,5,0,0.62)' : B.inlay; ctx.globalAlpha = i % 2 ? 1 : 0.9; ctx.fill(); } else { ctx.fillStyle = i % 2 ? 'rgb(52,52,52)' : 'rgb(190,190,190)'; ctx.fill(); }
        ctx.restore();
      }
    }
  };
  const i0 = 11.5;
  band(i0 + 6, i0, BW - i0 - 6, i0); band(i0 + 6, BH - i0, BW - i0 - 6, BH - i0); band(i0, i0 + 6, i0, BH - i0 - 6); band(BW - i0, i0 + 6, BW - i0, BH - i0 - 6);
  for (const ctx of [c, b]) { ctx.strokeStyle = ctx === c ? 'rgba(10,3,0,0.7)' : 'rgb(40,40,40)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.roundRect(6, 6, BW - 12, BH - 12, 20); ctx.stroke(); ctx.beginPath(); ctx.roundRect(17.5, 17.5, BW - 35, BH - 35, 16); ctx.stroke(); }
  // the two territories, inlaid in the players' colours
  const m = BW / 2, L = PAD - 6, R = BW - PAD + 6, T = PAD - 6, Bt = BH - PAD + 6, y1 = PAD + ROW_H, y2 = PAD + 2 * ROW_H;
  const poly = (owner) => { const p = new Path2D(); if (owner === 2) { p.moveTo(L, T); p.lineTo(R, T); p.lineTo(R, y1); p.lineTo(m, y1); p.lineTo(m, y2); p.lineTo(L, y2); } else { p.moveTo(R, Bt); p.lineTo(L, Bt); p.lineTo(L, y2); p.lineTo(m, y2); p.lineTo(m, y1); p.lineTo(R, y1); } p.closePath(); return p; };
  for (const [owner, colr] of [[2, B.own[1]], [1, B.own[0]]]) {
    const p = poly(owner); c.save(); c.lineJoin = 'round'; c.globalAlpha = 0.09; c.fillStyle = colr; c.fill(p); c.globalAlpha = 0.9; c.strokeStyle = colr; c.lineWidth = 2.6; c.stroke(p); c.restore();
    b.save(); b.lineJoin = 'round'; b.strokeStyle = 'rgb(50,50,50)'; b.lineWidth = 3; b.stroke(p); b.restore();
  }
  // direction chevrons between neighbouring holes of each circuit
  for (const [p, list] of [[1, [12, 13, 14, 15, 16, 17, 11, 10, 9]], [2, [5, 4, 3, 2, 1, 0, 6, 7, 8]]]) for (let k = 0; k < 8; k++) {
    const a = CELLS[list[k]], bb = CELLS[list[k + 1]];
    if (Math.hypot(bb.cx - a.cx, bb.cy - a.cy) > 130) continue;
    const ang = Math.atan2(bb.cy - a.cy, bb.cx - a.cx), mx = (a.cx + bb.cx) / 2, my = (a.cy + bb.cy) / 2;
    c.save(); c.translate(mx, my); c.rotate(ang); c.fillStyle = B.own[p - 1]; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(8, 0); c.lineTo(-5, -8); c.lineTo(-5, 8); c.closePath(); c.fill(); c.restore();
  }
  // pits: burnished, darker, with a faint worn ring
  for (let i = 0; i < 18; i++) {
    const P = CELLS[i], R0 = HOLE_R * 0.95;
    const g = c.createRadialGradient(P.cx, P.cy, R0 * 0.2, P.cx, P.cy, R0 * 1.3); g.addColorStop(0, 'rgba(14,5,0,0.34)'); g.addColorStop(0.78, 'rgba(20,8,2,0.26)'); g.addColorStop(0.93, 'rgba(255,225,170,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(P.cx, P.cy, R0 * 1.3, 0, TAU); c.fill();
    c.strokeStyle = B.own[P.owner - 1]; c.globalAlpha = 0.5; c.lineWidth = 1.6; c.beginPath(); c.arc(P.cx, P.cy, R0 * 1.12, 0, TAU); c.stroke(); c.globalAlpha = 1;
  }
  // morning sheen
  const sh = c.createRadialGradient(BW * 0.3, BH * 0.2, 10, BW * 0.5, BH * 0.5, BW * 0.62); sh.addColorStop(0, 'rgba(255,240,215,0.07)'); sh.addColorStop(1, 'rgba(255,240,215,0)'); c.fillStyle = sh; c.fillRect(0, 0, BW, BH);
  return { map: tex(col, true), bump: tex(bump, false) };
}

export function buildBoard(theme = 'acacia', texW = 2048) {
  const g = new THREE.Group(), B = BOARDS[theme] || BOARDS.acacia;
  const step = 0.3, segX = Math.round((2 * HX + 1.2) / step), segZ = Math.round((2 * HZ + 1.2) / step);
  const geo = new THREE.PlaneGeometry(2 * HX + 1.2, 2 * HZ + 1.2, segX, segZ); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, boardHeight(x, z)); uv.setXY(i, (x + HX) / (2 * HX), 0.5 - z / (2 * HZ)); }
  geo.computeVertexNormals();
  const t = paintBoard(theme, texW);
  const mat = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.5, roughness: B.rough, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.5, envMapIntensity: 0.4 });
  const top = new THREE.Mesh(geo, mat); top.castShadow = true; top.receiveShadow = true; g.add(top);
  // the body: a rounded slab under the shelf, wood on its sides
  const rs = (hx, hz, r) => { const sh = new THREE.Shape(); sh.moveTo(-hx + r, -hz); sh.lineTo(hx - r, -hz); sh.quadraticCurveTo(hx, -hz, hx, -hz + r); sh.lineTo(hx, hz - r); sh.quadraticCurveTo(hx, hz, hx - r, hz); sh.lineTo(-hx + r, hz); sh.quadraticCurveTo(-hx, hz, -hx, hz - r); sh.lineTo(-hx, -hz + r); sh.quadraticCurveTo(-hx, -hz, -hx + r, -hz); return sh; };
  const ring = rs(HX + 0.58, HZ + 0.58, 2.9); ring.holes.push(new THREE.Path(rs(HX - 1.6, HZ - 1.6, 1.5).getPoints(14).reverse()));
  const bg = new THREE.ExtrudeGeometry(ring, { depth: TOP - 1.34, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2, curveSegments: 14 }); bg.rotateX(-Math.PI / 2);
  const sideC = canvas(256), sx = sideC.getContext('2d'), rr_ = lcg(8); const eg = sx.createLinearGradient(0, 0, 0, 256); eg.addColorStop(0, B.edge[1]); eg.addColorStop(1, B.edge[2]); sx.fillStyle = eg; sx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { sx.strokeStyle = rr_() < 0.7 ? 'rgba(10,4,0,0.35)' : 'rgba(255,200,140,0.10)'; sx.lineWidth = 0.6 + rr_() * 1.8; const yy = rr_() * 256; sx.beginPath(); sx.moveTo(0, yy); for (let xx = 0; xx <= 256; xx += 16) sx.lineTo(xx, yy + Math.sin(xx * 0.05 + i) * 2); sx.stroke(); }
  const st = new THREE.CanvasTexture(sideC); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(0.05, 0.1); st.colorSpace = THREE.SRGBColorSpace;
  const body = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ map: st, roughness: 0.5, envMapIntensity: 0.4 })); body.position.y = -0.02; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const brass = new THREE.MeshStandardMaterial({ color: 0xdcae48, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.4 });
  const stud = new THREE.SphereGeometry(1, 14, 10), sm = new THREE.InstancedMesh(stud, brass, 4), m4 = new THREE.Matrix4();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => { const x = sx * (HX - 1.1), z = sz * (HZ - 1.1); sm.setMatrixAt(i, m4.compose(new THREE.Vector3(x, boardHeight(x, z) + 0.05, z), new THREE.Quaternion(), new THREE.Vector3(0.5, 0.3, 0.5))); });
  sm.castShadow = true; g.add(sm);
  g.position.y = BOARD_Y;
  g.userData.dispose = () => { geo.dispose(); mat.dispose(); t.map.dispose(); t.bump.dispose(); };
  return g;
}

// ---------------------------------------------------------------- seeds (one glossy bean shape, five tones), where a seed rests in a pit
export function seedKit(theme) {
  const geo = new THREE.SphereGeometry(1, 20, 14), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + (fbm(p.getX(i) * 2 + 3, p.getZ(i) * 2 + p.getY(i), 4, 2) - 0.5) * 0.1; p.setXYZ(i, p.getX(i) * SEED_R * 1.14 * k, p.getY(i) * SEED_R * 0.84 * k, p.getZ(i) * SEED_R * 0.96 * k); }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 0.9 });
  const tints = (BOARDS[theme] || BOARDS.acacia).dan.map((h) => new THREE.Color(h).multiplyScalar(0.8));
  return { geo, mat, tint: (v) => tints[v % tints.length] };
}
const LAYERS = [[0, 0, 0], ...Array.from({ length: 6 }, (_, i) => [2.15, i * TAU / 6, 0]), ...Array.from({ length: 5 }, (_, i) => [1.35, i * TAU / 5 + 0.5, 1.6]), ...Array.from({ length: 3 }, (_, i) => [0.85, i * TAU / 3 + 0.2, 2.85]), [0, 0, 3.8]];
// resting place of seed k in pit `key` (stable: adding a seed never moves the others). x, z offsets from the pit centre; y is the seed's centre height.
export function seedSlot(key, k) {
  let rad, a, lift;
  if (k < LAYERS.length) { [rad, a, lift] = LAYERS[k]; a += key * 1.3; }
  else { const j = k - LAYERS.length; rad = 0.85 + ((j * 7) % 5) * 0.38; a = j * 2.3999 + key; lift = 3.2 + Math.floor(j / 7) * 0.85; }
  const jx = (hash(key, k * 3 + 1) - 0.5) * 0.26, jz = (hash(key, k * 3 + 2) - 0.5) * 0.26;
  const x = Math.cos(a) * rad + jx, z = Math.sin(a) * rad + jz, u = Math.min(1, Math.hypot(x, z) / PIT_R);
  return { x, z, y: RIM - PIT_D * (1 - u * u) * 0.88 + SEED_R * 0.8 + lift, rot: hash(key, k) * TAU, tx: (hash(key, k + 40) - 0.5) * 1.1, tz: (hash(key, k + 80) - 0.5) * 1.1, v: Math.floor(hash(key + 3, k) * 5) };
}

// ---------------------------------------------------------------- the courtyard
function paintMat(S_, parts) {
  const c = canvas(S_), x = c.getContext('2d'), r = lcg(17), R = S_ / 2;
  x.fillStyle = '#b39a5e'; x.fillRect(0, 0, S_, S_);
  const bands = parts || [[0.2, 0.27, '#a5402a'], [0.45, 0.5, '#2b4a2a'], [0.5, 0.53, '#17110c'], [0.72, 0.79, '#a5402a'], [0.79, 0.82, '#e6d9ae'], [0.93, 0.985, '#2b4a2a']];
  const coil = 11;
  for (let rad = coil / 2; rad < R; rad += coil) {
    const f = rad / R; let colr = null; for (const [a, b, cc] of bands) if (f >= a && f < b) colr = cc;
    const v = 0.9 + r() * 0.18;
    x.lineWidth = coil - 1.2;
    if (colr) x.strokeStyle = colr; else x.strokeStyle = `rgb(${Math.round(190 * v)},${Math.round(160 * v)},${Math.round(102 * v)})`;
    x.beginPath(); x.arc(R, R, rad, 0, TAU); x.stroke();
    x.lineWidth = 1.4; x.strokeStyle = 'rgba(60,40,15,0.55)'; x.beginPath(); x.arc(R, R, rad + coil / 2 - 0.5, 0, TAU); x.stroke();
    x.strokeStyle = 'rgba(255,240,200,0.28)'; x.beginPath(); x.arc(R, R, rad - coil / 2 + 2, 0, TAU); x.stroke();
  }
  for (let i = 0; i < 9000; i++) { const a = r() * TAU, d = r() * R; x.strokeStyle = r() < 0.5 ? 'rgba(80,55,20,0.22)' : 'rgba(255,238,190,0.2)'; x.lineWidth = 0.7; x.beginPath(); const px = R + Math.cos(a) * d, py = R + Math.sin(a) * d; x.moveTo(px, py); x.lineTo(px + Math.cos(a + 1.57) * 2.4, py + Math.sin(a + 1.57) * 2.4); x.stroke(); }
  // stitching: spokes of thread across the coils
  for (let k = 0; k < 28; k++) { const a = k * TAU / 28 + 0.1; x.strokeStyle = 'rgba(58,40,16,0.18)'; x.lineWidth = 2; x.beginPath(); x.moveTo(R + Math.cos(a) * R * 0.08, R + Math.sin(a) * R * 0.08); x.lineTo(R + Math.cos(a + 0.12) * R, R + Math.sin(a + 0.12) * R); x.stroke(); }
  return tex(c, true, 8);
}
function paintStones(W, H, o) {
  const c = canvas(W, H), x = c.getContext('2d'), r = lcg(o.seed), bump = canvas(W, H), b = bump.getContext('2d');
  x.fillStyle = '#272521'; x.fillRect(0, 0, W, H); b.fillStyle = 'rgb(40,40,40)'; b.fillRect(0, 0, W, H);
  let y = 0;
  while (y < H) {
    const ch = o.ch * (0.75 + r() * 0.5); let xx = -r() * 140;
    while (xx < W) {
      const cw = o.cw * (0.65 + r() * 0.9), v = 0.82 + r() * 0.3, warm = r() < o.warm;
      const R_ = warm ? [150, 118, 88] : [122, 118, 108], q = [Math.round(R_[0] * v), Math.round(R_[1] * v), Math.round(R_[2] * v)];
      const g = x.createLinearGradient(xx, y, xx + cw * 0.3, y + ch); g.addColorStop(0, `rgb(${Math.min(255, q[0] + 16)},${Math.min(255, q[1] + 16)},${Math.min(255, q[2] + 14)})`); g.addColorStop(1, `rgb(${q[0] - 12},${q[1] - 12},${q[2] - 12})`);
      x.fillStyle = g; x.beginPath(); x.roundRect(xx + 3, y + 3, cw - 6, ch - 6, 10 + r() * 14); x.fill();
      b.fillStyle = `rgb(${150 + Math.round(r() * 60)},${150 + Math.round(r() * 60)},${150 + Math.round(r() * 60)})`; b.beginPath(); b.roundRect(xx + 3, y + 3, cw - 6, ch - 6, 12); b.fill();
      for (let i = 0; i < 40; i++) { x.fillStyle = r() < 0.5 ? `rgba(40,36,30,${0.1 + r() * 0.2})` : `rgba(240,236,224,${0.05 + r() * 0.12})`; x.beginPath(); x.arc(xx + 6 + r() * (cw - 12), y + 6 + r() * (ch - 12), 0.6 + r() * 2.8, 0, TAU); x.fill(); }
      if (r() < 0.25) { x.strokeStyle = 'rgba(30,26,22,0.35)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(xx + cw * r(), y + 6); x.lineTo(xx + cw * r(), y + ch - 6); x.stroke(); }
      if (r() < 0.18) { x.fillStyle = 'rgba(96,120,70,0.22)'; x.beginPath(); x.ellipse(xx + cw * r(), y + ch - 8, 18 + r() * 24, 5 + r() * 5, 0, 0, TAU); x.fill(); }   // moss in the joints
      xx += cw;
    }
    y += ch;
  }
  const t = tex(c, true, 8), bt = tex(bump, false, 4); return { map: t, bump: bt };
}
const mkCloud = (rgb = '255,255,255') => { const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgb},0.55)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

function jebena(g, shadows) {
  const grp = new THREE.Group();
  const clay = new THREE.MeshStandardMaterial({ color: 0x2b1b13, roughness: 0.58, metalness: 0, envMapIntensity: 0.5 });
  const ochre = new THREE.MeshStandardMaterial({ color: 0xb7742f, roughness: 0.6, envMapIntensity: 0.4 });
  const prof = [[0.01, 0], [4.8, 0], [7.4, 0.8], [10.4, 3.5], [12.4, 8], [12.6, 11.5], [11.4, 16], [8.6, 20.5], [5.2, 23.6], [3.7, 26.5], [3.4, 31], [3.9, 33.4], [4.9, 35], [4.3, 35.6], [3.1, 34.4]].map(([a, b]) => new THREE.Vector2(a, b));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), clay); body.castShadow = shadows; body.receiveShadow = true; grp.add(body);
  for (const [y, rr, w] of [[13.2, 12.6, 0.55], [17, 10.9, 0.45], [27.4, 3.5, 0.4]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(rr, w, 8, 56), ochre); t.rotation.x = Math.PI / 2; t.position.y = y; grp.add(t); }
  // spout: a slanted cone from the belly up and out
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 2.5, 19, 20), clay); sp.position.set(9.6, 21.5, 0); sp.rotation.z = -0.62; sp.castShadow = shadows; grp.add(sp);
  // handle: a flat loop from shoulder to neck on the far side
  const hd = new THREE.Mesh(new THREE.TorusGeometry(8.2, 1.05, 10, 32, Math.PI * 1.02), clay); hd.position.set(-5.6, 24.5, 0); hd.rotation.set(0, 0, Math.PI * 0.54); hd.castShadow = shadows; grp.add(hd);
  // straw plug
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.7, 3.6, 16), new THREE.MeshStandardMaterial({ color: 0xc8ad66, roughness: 0.95 })); plug.position.y = 36.8; grp.add(plug);
  // the grass ring it stands on
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7.8, 2.1, 10, 40), new THREE.MeshStandardMaterial({ map: paintMat(256, [[0, 1, '#c1a560']]), roughness: 0.95 })); ring.rotation.x = Math.PI / 2; ring.position.y = 1.3; ring.scale.set(1, 1, 0.72); ring.receiveShadow = true; grp.add(ring);
  body.position.y = 2.4; for (const ch of grp.children) if (ch !== body && ch !== ring) ch.position.y += 2.4; ring.position.y = 1.3;
  grp.scale.setScalar(0.74); g.add(grp);
  return grp;
}
function cups(g, shadows) {
  const grp = new THREE.Group();
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.5, 1.0, 40), new THREE.MeshStandardMaterial({ map: paintMat(512, [[0.3, 0.38, '#a5402a'], [0.62, 0.7, '#2b4a2a'], [0.9, 0.98, '#a5402a']]), roughness: 0.92 })); tray.position.y = 0.5; tray.receiveShadow = true; tray.castShadow = shadows; grp.add(tray);
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf4efe4, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1 });
  const prof = [[0.01, 0], [1.7, 0], [2.2, 0.45], [2.65, 3.7], [2.6, 4.1], [2.4, 4.1], [2.4, 3.7], [1.9, 1.0], [0.01, 0.9]].map(([a, b]) => new THREE.Vector2(a, b));
  const geo = new THREE.LatheGeometry(prof, 28);
  [[-4.6, 2.4], [3.6, 4.0], [-0.4, -5.6], [4.2, -3.4]].forEach(([x, z], i) => { if (i === 3) return; const m = new THREE.Mesh(geo, white); m.position.set(x, 1, z); m.castShadow = shadows; m.receiveShadow = true; grp.add(m); });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd6a944, metalness: 0.9, roughness: 0.3 });
  grp.children.slice(1).forEach((m) => { const t = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.09, 6, 28), gold); t.rotation.x = Math.PI / 2; t.position.set(m.position.x, 1 + 4.1, m.position.z); grp.add(t); });
  g.add(grp); return grp;
}

export function buildCourtyard(scene, { quality = 1 } = {}) {
  const g = new THREE.Group(); scene.add(g);
  // flagstones
  const fl = paintStones(1024, 1024, { seed: 5, ch: 150, cw: 220, warm: 0.12 }); fl.map.wrapS = fl.map.wrapT = fl.bump.wrapS = fl.bump.wrapT = THREE.RepeatWrapping; fl.map.repeat.set(5, 5); fl.bump.repeat.set(5, 5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: fl.map, bumpMap: fl.bump, bumpScale: 3, roughness: 0.95, color: 0x9a9ca6 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.3; floor.receiveShadow = true; g.add(floor);
  // a pool of light: the courtyard falls away into soft shade toward the edges of the view
  { const pc = canvas(256), px = pc.getContext('2d'), gr = px.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(10,12,18,0)'); gr.addColorStop(0.22, 'rgba(10,12,18,0)'); gr.addColorStop(0.55, 'rgba(10,12,18,0.5)'); gr.addColorStop(1, 'rgba(10,12,18,0.88)'); px.fillStyle = gr; px.fillRect(0, 0, 256, 256);
    const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace; const pool = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ map: pt, transparent: true, depthWrite: false, fog: false })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.6; pool.renderOrder = 1; g.add(pool); }
  // the coiled grass mat under the board, slightly rumpled at the edge
  const mr = 50, mt = paintMat(1024), mg = new THREE.CircleGeometry(mr, 96, 0, TAU); mg.rotateX(-Math.PI / 2);
  const mp = mg.attributes.position; for (let i = 0; i < mp.count; i++) { const px = mp.getX(i), pz = mp.getZ(i), e = Math.max(0, 1 - Math.hypot(px, pz) / mr); mp.setY(i, 0.12 + fbm(px * 0.09, pz * 0.09, 3, 3) * 0.26 * Math.min(1, e * 8)); }
  mg.computeVertexNormals();
  const mat = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ map: mt, roughness: 0.95, envMapIntensity: 0.25 })); mat.receiveShadow = true; g.add(mat);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(mr - 0.4, 0.6, 8, 120), new THREE.MeshStandardMaterial({ color: 0x2b4a2a, roughness: 0.95 })); edge.rotation.x = Math.PI / 2; edge.position.y = 0.2; g.add(edge);
  // dry-stone wall behind, with a timber lintel and a deep window niche
  const wallZ = -86, ws = paintStones(2048, 1024, { seed: 9, ch: 92, cw: 210, warm: 0.2 }); ws.map.anisotropy = 4;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(420, 210), new THREE.MeshStandardMaterial({ map: ws.map, bumpMap: ws.bump, bumpScale: 4, roughness: 0.96, color: 0xb4b8c6 })); wall.position.set(0, 100, wallZ); wall.receiveShadow = true; g.add(wall);
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.7 });
  const box = (w, h, d, x, y, z, m = wood) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = quality > 0; o.receiveShadow = true; g.add(o); return o; };
  box(70, 7, 12, 70, 126, wallZ + 6); box(6, 70, 12, 37, 91, wallZ + 6); box(6, 70, 12, 103, 91, wallZ + 6); box(70, 5, 16, 70, 55, wallZ + 8);
  box(60, 64, 2, 70, 90, wallZ + 1.2, new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 1 }));   // the dark window niche
  const jb = jebena(g, quality > 0); jb.position.set(-40, 0.3, -32); jb.rotation.y = 0.5;
  const cp = cups(g, quality > 0); cp.position.set(40, 0.3, -36); cp.rotation.y = -0.4;
  // steam from the jebena spout
  const N = 26, pg = new THREE.BufferGeometry(), pa = new Float32Array(N * 3), seeds = new Float32Array(N), r = lcg(77);
  for (let i = 0; i < N; i++) { seeds[i] = r(); }
  pg.setAttribute('position', new THREE.BufferAttribute(pa, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const steam = new THREE.Points(pg, new THREE.PointsMaterial({ size: 9, map: mkCloud('255,255,255'), transparent: true, depthWrite: false, opacity: 0.2, fog: false, sizeAttenuation: true }));
  steam.frustumCulled = false; g.add(steam);
  const spout = new THREE.Vector3(-40 + Math.cos(0.5) * 11.5 * 0.74 + Math.sin(0.5) * 0, 22, -32 - Math.sin(0.5) * 11.5 * 0.74);
  return { group: g, steam, spout, jebena: jb, cups: cp };
}

// Cool highland morning: pale key light from the front-left, sky fill, a warm bounce off the stone, a low warm rim from behind.
export function buildLights(scene) {
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.1); sun.position.set(-70, 120, 80); sun.target.position.set(0, 0, 0);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 40, far: 320 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  const hemi = new THREE.HemisphereLight(0xb2c6e6, 0x6e6252, 0.42);
  const fill = new THREE.DirectionalLight(0xc9dcff, 0.3); fill.position.set(80, 60, 110);
  const rim = new THREE.DirectionalLight(0xffd7a0, 0.9); rim.position.set(30, 50, -140);
  scene.add(sun, sun.target, hemi, fill, rim);
  return { sun, hemi, fill, rim };
}

// Soft radial texture for contact blobs and glows.
export function radialTex(rgb = '0,0,0', a = 1, inner = 0) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 64 * inner, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${inner ? 0 : a})`); if (inner) g.addColorStop(Math.min(0.95, inner + 0.12), `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
