// Lau Kata Kati 3D models: a quilted kantha-cloth hourglass board stitched in running thread on a low teak platform, padded cloth patches with a
// mirror at the heart (or glass beads), and the village evening around it (woven reed mat, hurricane lantern, bottle gourds on their vine,
// brass lota, clay pot, fireflies). Built on platform/view3d board3d. Pure construction: nothing here reads the simulation.
// Units: one board unit = 1 (the distance between two cross lines). Board points: x -2.4..2.4, z -3..3 (rules.js POINTS, y -> z).
import { board3d as B, THREE } from '../vendor3d/index.js';

export const HEX = [[-3.05, -3.6], [3.05, -3.6], [0.55, 0], [3.05, 3.6], [-3.05, 3.6], [-0.55, 0]];
export const BASE_H = 0.2, CLOTH_H = 0.11, TOP = BASE_H + CLOTH_H;          // surface the pieces stand on
export const DX = 0.8;
export const PTS = [[0, 0]];
for (const sgn of [-1, 1]) for (let k = 1; k <= 3; k++) for (let c = 0; c < 3; c++) PTS.push([(c - 1) * k * DX, sgn * k]);
// edges (same construction as rules.js, kept here so the model has no dependency on src/)
export const EDGES = (() => {
  const e = [], idx = (top, k, c) => (top ? 1 : 10) + (k - 1) * 3 + c;
  for (const top of [true, false]) for (let k = 1; k <= 3; k++) {
    e.push([idx(top, k, 0), idx(top, k, 1)], [idx(top, k, 1), idx(top, k, 2)]);
    for (let c = 0; c < 3; c++) e.push([k === 1 ? 0 : idx(top, k - 1, c), idx(top, k, c)]);
  }
  return e;
})();

const TAU = Math.PI * 2;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const tex = (c, rep, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

// board palettes (same keys and colours as the 2D art)
export const PAL3 = {
  indigo: { top: ['#3a52ad', '#26398a', '#18235e'], edge: '#0f1744', thread: '#fff1d2', accent: '#ffb23c', groove: 'rgba(5,8,34,0.7)', weave: [200, 215, 255], mat: '#7a2a1e' },
  madder: { top: ['#cc433a', '#a32b27', '#771b1a'], edge: '#4d0f0d', thread: '#ffe9c4', accent: '#ffd45e', groove: 'rgba(50,6,6,0.7)', weave: [255, 215, 190], mat: '#2c3a6e' },
  cotton: { top: ['#f8f1de', '#ece1c6', '#d8c9a5'], edge: '#8a7a55', thread: '#22378a', accent: '#c4382a', groove: 'rgba(70,52,20,0.55)', weave: [120, 100, 60], mat: '#5a3a1c' },
};
export const PIECE3 = {
  classic: { 1: { c: '#dc9418', c2: '#a45a08', thread: '#fff4c8', ink: '#5a2c00' }, 2: { c: '#c92a3e', c2: '#861229', thread: '#ffe3d4', ink: '#3a0410' } },
  bead: { 1: { c: '#f6bf3a', c2: '#d08410', thread: '#fff4c8', ink: '#5a2c00' }, 2: { c: '#e03a52', c2: '#98122e', thread: '#ffe3d4', ink: '#3a0410' } },
};

// ---------------------------------------------------------------- shapes
function roundedPoly(pts, r, per = 6) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const a = [p1[0] - p0[0], p1[1] - p0[1]], b = [p2[0] - p1[0], p2[1] - p1[1]];
    const la = Math.hypot(...a), lb = Math.hypot(...b), rr = Math.min(r, la * 0.45, lb * 0.45);
    const s = [p1[0] - (a[0] / la) * rr, p1[1] - (a[1] / la) * rr], e = [p1[0] + (b[0] / lb) * rr, p1[1] + (b[1] / lb) * rr];
    for (let k = 0; k <= per; k++) { const t = k / per, u = 1 - t; out.push([u * u * s[0] + 2 * u * t * p1[0] + t * t * e[0], u * u * s[1] + 2 * u * t * p1[1] + t * t * e[1]]); }
  }
  return out;
}
const hexScaled = (sx, sy, dx = 0) => HEX.map(([x, y]) => [x * sx + (x === 0 ? 0 : Math.sign(x) * dx), y * sy]);
const polyShape = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));

// ---------------------------------------------------------------- the cloth texture (painted in board units: 128 px per unit over an 8 x 8 area)
const SPAN = 8, PX = 128;
function clothCanvas(pal, seed, withLines = true) {
  const S = SPAN * PX, c = cv(S), x = c.getContext('2d'), bc = cv(S / 2), bx = bc.getContext('2d'), r = lcg(seed);
  const U = (u) => (u + SPAN / 2) * PX;                      // board unit -> canvas px
  const g = x.createLinearGradient(U(-3), U(-3.6), U(3), U(3.6)); g.addColorStop(0, pal.top[0]); g.addColorStop(0.55, pal.top[1]); g.addColorStop(1, pal.top[2]);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, S / 2, S / 2);
  // woven threads in both directions
  const wv = pal.weave;
  for (let p = 0; p < S; p += 5) {
    x.fillStyle = `rgba(${wv[0]},${wv[1]},${wv[2]},${0.04 + r() * 0.06})`; x.fillRect(p, 0, 1.4, S);
    x.fillStyle = `rgba(${wv[0]},${wv[1]},${wv[2]},${0.035 + r() * 0.06})`; x.fillRect(0, p, S, 1.4);
    bx.fillStyle = `rgba(255,255,255,${0.12 + r() * 0.1})`; bx.fillRect(p / 2, 0, 1, S / 2);
    bx.fillStyle = `rgba(0,0,0,${0.12 + r() * 0.1})`; bx.fillRect(0, p / 2, S / 2, 1);
  }
  // the kantha ripple: long wavy rows of tiny running stitch that make the quilt pucker
  x.lineCap = 'round'; x.setLineDash([9, 12]); x.lineWidth = 3.4; x.strokeStyle = pal.thread; x.globalAlpha = 0.2;
  bx.lineCap = 'round'; bx.setLineDash([5, 6]); bx.lineWidth = 3;
  for (let row = 0; row < SPAN * 4.6; row++) {
    const y0 = row * (PX / 4.6) + 6;
    x.beginPath(); bx.beginPath();
    for (let s = -10; s <= S + 10; s += 16) { const o = Math.sin(s * 0.012 + row * 0.9) * 5; if (s === -10) { x.moveTo(s, y0 + o); bx.moveTo(s / 2, (y0 + o) / 2); } else { x.lineTo(s, y0 + o); bx.lineTo(s / 2, (y0 + o) / 2); } }
    x.stroke(); bx.strokeStyle = 'rgba(0,0,0,0.5)'; bx.stroke();
  }
  x.setLineDash([]); bx.setLineDash([]); x.globalAlpha = 1;
  // soft mottling of the dye
  for (let k = 0; k < 90; k++) { const px = r() * S, py = r() * S, rr = 30 + r() * 120, gr = x.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  if (withLines) {
    // grooves under every thread line and a little pad at every point
    x.lineCap = 'round'; x.strokeStyle = pal.groove; x.lineWidth = 17;
    for (const [a, b] of EDGES) { x.beginPath(); x.moveTo(U(PTS[a][0]) + 2, U(PTS[a][1]) + 5); x.lineTo(U(PTS[b][0]) + 2, U(PTS[b][1]) + 5); x.stroke(); }
    bx.strokeStyle = 'rgba(0,0,0,0.65)'; bx.lineWidth = 8;
    for (const [a, b] of EDGES) { bx.beginPath(); bx.moveTo(U(PTS[a][0]) / 2, U(PTS[a][1]) / 2); bx.lineTo(U(PTS[b][0]) / 2, U(PTS[b][1]) / 2); bx.stroke(); }
    for (let i = 0; i < PTS.length; i++) {
      const px = U(PTS[i][0]), py = U(PTS[i][1]), big = i === 0;
      x.fillStyle = pal.groove; x.beginPath(); x.arc(px + 2, py + 5, big ? 48 : 38, 0, TAU); x.fill();
      const pg = x.createRadialGradient(px - 6, py - 8, 4, px, py, big ? 44 : 34); pg.addColorStop(0, pal.top[0]); pg.addColorStop(1, pal.top[1]);
      x.fillStyle = pg; x.beginPath(); x.arc(px, py, big ? 44 : 34, 0, TAU); x.fill();
    }
  }
  return { map: c, bump: bc };
}

// ---------------------------------------------------------------- the board
const stitchGeo = (len, w = 0.045, h = 0.03) => B.roundedBox(len, h, w, h * 0.45, 2);
function stitchLine(parts, a, b, len, gap, y, skipEnds = 0.34) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ang = Math.atan2(dz, dx), geo = stitchGeo(len);
  const n = Math.max(1, Math.floor((L - 2 * skipEnds) / (len + gap)));
  const used = n * (len + gap) - gap, s0 = (L - used) / 2;
  for (let k = 0; k < n; k++) {
    const t = s0 + k * (len + gap) + len / 2, m = new THREE.Matrix4();
    m.makeRotationY(-ang); m.setPosition(a[0] + (dx / L) * t, y, a[1] + (dz / L) * t); parts.push({ geo, m });
  }
}
export function buildBoard(kind) {
  const pal = PAL3[kind] || PAL3.indigo, g = new THREE.Group();
  // low teak platform under the quilt
  const baseShape = polyShape(roundedPoly(hexScaled(1.075, 1.045, 0.1), 0.5));
  const baseGeo = new THREE.ExtrudeGeometry(baseShape, { depth: BASE_H - 0.07, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.04, bevelSegments: 3, curveSegments: 6 });
  baseGeo.rotateX(-Math.PI / 2); baseGeo.translate(0, 0.035, 0);
  const teak = new THREE.Mesh(baseGeo, B.material('darkWood', { color: '#5a3216', color2: '#8a5226', repeat: [0.16, 0.16], size: 512, seed: 12, roughness: 0.5 }));
  teak.castShadow = teak.receiveShadow = true; g.add(teak);
  // brass studs along the edge of the platform
  const brass = B.material('brass', { color: '#c79a3a', color2: '#f3d27a', seed: 4 });
  const studG = new THREE.SphereGeometry(0.052, 10, 8), studs = [];
  const ring = roundedPoly(hexScaled(1.062, 1.035, 0.085), 0.5, 4);
  for (let i = 0; i < ring.length; i += 2) { const m = new THREE.Matrix4(); m.setPosition(ring[i][0], BASE_H * 0.5, ring[i][1]); studs.push({ geo: studG, m }); }
  const studMesh = new THREE.Mesh(B.mergeGeos(studs), brass); studMesh.castShadow = true; g.add(studMesh);
  // the quilt: a puffed, bevelled cloth slab with the painted weave / ripple / grooves
  const cloth = clothCanvas(pal, 31 + kind.length * 17);
  const ct = tex(cloth.map), cb = tex(cloth.bump, null, false);
  for (const t of [ct, cb]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / SPAN, 1 / SPAN); t.offset.set(0.5, 0.5); }
  const clothShape = polyShape(roundedPoly(HEX, 0.42));
  const cg = new THREE.ExtrudeGeometry(clothShape, { depth: CLOTH_H - 0.07, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.045, bevelSegments: 4, curveSegments: 6 });
  cg.rotateX(-Math.PI / 2); cg.translate(0, BASE_H + 0.035 - 0.0, 0);
  const clothMat = new THREE.MeshStandardMaterial({ map: ct, bumpMap: cb, bumpScale: 2.2, roughness: 0.96, metalness: 0 });
  const quilt = new THREE.Mesh(cg, clothMat); quilt.castShadow = quilt.receiveShadow = true; g.add(quilt);
  // thread
  const thread = new THREE.MeshStandardMaterial({ color: pal.thread, roughness: 0.78, metalness: 0 });
  const accent = new THREE.MeshStandardMaterial({ color: pal.accent, roughness: 0.7, metalness: 0 });
  const y0 = TOP + 0.004;
  const lines = [];
  for (const [a, b] of EDGES) stitchLine(lines, PTS[a], PTS[b], 0.2, 0.1, y0);
  const lineMesh = new THREE.Mesh(B.mergeGeos(lines), thread); lineMesh.castShadow = false; lineMesh.receiveShadow = true; g.add(lineMesh);
  // border: a double running stitch just inside the rim (cream, then accent)
  const border = [], accB = [];
  const poly1 = hexScaled(0.93, 0.945), poly2 = hexScaled(0.865, 0.89);
  for (let i = 0; i < poly1.length; i++) { stitchLine(border, poly1[i], poly1[(i + 1) % poly1.length], 0.26, 0.12, y0, 0.2); stitchLine(accB, poly2[i], poly2[(i + 1) % poly2.length], 0.13, 0.12, y0, 0.2); }
  const bm = new THREE.Mesh(B.mergeGeos(border), thread); g.add(bm);
  const am = new THREE.Mesh(B.mergeGeos(accB), accent); g.add(am);
  // at each point: a ring of thread round a padded boss, and an accent French knot at the centre
  const tor = [], knots = [];
  for (let i = 0; i < PTS.length; i++) {
    const big = i === 0, m = new THREE.Matrix4();
    m.makeScale(1, 1, 1); m.setPosition(PTS[i][0], y0 + 0.01, PTS[i][1]);
    tor.push({ geo: new THREE.TorusGeometry(big ? 0.36 : 0.27, 0.02, 6, 28).rotateX(-Math.PI / 2), m: m.clone() });
    const k = new THREE.Matrix4(); k.setPosition(PTS[i][0], y0 + 0.012, PTS[i][1]);
    knots.push({ geo: new THREE.SphereGeometry(big ? 0.085 : 0.06, 10, 8), m: k });
  }
  g.add(new THREE.Mesh(B.mergeGeos(tor), thread), new THREE.Mesh(B.mergeGeos(knots), accent));
  // an eight-pointed star stitched round the waist
  const star = [];
  for (let k = 0; k < 8; k++) {
    const a = k * TAU / 8 + TAU / 16, m = new THREE.Matrix4(), r = new THREE.Matrix4();
    r.makeRotationY(-a); m.setPosition(Math.cos(a) * 0.58, y0 + 0.004, Math.sin(a) * 0.58);
    star.push({ geo: B.inlay([[-0.07, 0], [0, -0.1], [0.07, 0], [0, 0.1]], 0.02, { bevel: 0.004 }), m: m.multiply(r) });
  }
  g.add(new THREE.Mesh(B.mergeGeos(star), accent));
  g.userData.halfX = 3.05; g.userData.halfZ = 3.6;
  return g;
}

// ---------------------------------------------------------------- pieces
// profile of a padded round: soft rounded rim, domed top, 0.17 high
const PATCH = [[0, 0], [0.3, 0], [0.355, 0.02], [0.385, 0.075], [0.38, 0.13], [0.34, 0.172], [0.27, 0.2], [0.19, 0.208], [0.14, 0.194], [0.11, 0.176], [0, 0.172]];
const BEAD = [[0, 0.0], [0.2, 0.0], [0.3, 0.03], [0.34, 0.1], [0.33, 0.2], [0.27, 0.285], [0.16, 0.335], [0, 0.35]];
const diamond = (r) => [[0, -r], [r * 0.82, 0], [0, r], [-r * 0.82, 0]];
function ringShape(outer, inner) { const s = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z))); s.holes.push(new THREE.Path(inner.map(([x, z]) => new THREE.Vector2(x, -z)).reverse())); return s; }
const mirrorMat = () => new THREE.MeshStandardMaterial({ color: 0xe6ecf5, metalness: 1, roughness: 0.07, envMapIntensity: 2.4 });
export function makePiece(side, style) {
  const set = (PIECE3[style] || PIECE3.classic)[side], g = new THREE.Group();
  if (style === 'bead') {
    const m = new THREE.MeshPhysicalMaterial({ color: set.c, roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 2.1, emissive: set.c2, emissiveIntensity: 0.18 });
    const bead = B.piece(BEAD, m, 40); g.add(bead);
    const top = 0.35;
    const mir = new THREE.Mesh(B.lathe([[0, 0], [0.085, 0], [0.092, 0.006], [0.085, 0.014], [0, 0.02]], 24), mirrorMat()); mir.position.y = top - 0.004; g.add(mir);
    const ink = new THREE.MeshStandardMaterial({ color: set.ink, roughness: 0.4 });
    const mk = side === 1 ? new THREE.Mesh(B.inlay(diamond(0.058), 0.012, { bevel: 0.003 }), ink) : new THREE.Mesh(B.inlay(ringShape(Array.from({ length: 20 }, (_, i) => [Math.cos(i * TAU / 20) * 0.055, Math.sin(i * TAU / 20) * 0.055]), Array.from({ length: 20 }, (_, i) => [Math.cos(i * TAU / 20) * 0.03, Math.sin(i * TAU / 20) * 0.03])), 0.012, { bevel: 0.003 }), ink);
    mk.position.y = top + 0.014; g.add(mk);
    g.userData.height = top + 0.02;
    return g;
  }
  const base = B.material('cloth', { color: set.c, color2: set.c2, repeat: [8, 1], size: 256, seed: 3 + side });
  // satin-like cloth: the woven map under a sheen, so the patch catches the light along its dome
  const mat = new THREE.MeshPhysicalMaterial({ map: base.map, bumpMap: base.bumpMap, bumpScale: 0.5, color: 0xffffff, roughness: 0.52, metalness: 0, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(set.thread), clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 1.2 });
  const body = B.piece(PATCH, mat, 44); g.add(body);
  // a ring of running stitch on the top, and the mirror (shisha) at the heart with its brass collar
  const dash = B.roundedBox(0.075, 0.02, 0.026, 0.01, 2), parts = [], N = 22;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * TAU, m = new THREE.Matrix4(), rr = 0.235; m.makeRotationY(-a - Math.PI / 2);
    m.setPosition(Math.cos(a) * rr, 0.206, Math.sin(a) * rr); parts.push({ geo: dash, m });
  }
  g.add(new THREE.Mesh(B.mergeGeos(parts), new THREE.MeshStandardMaterial({ color: set.thread, roughness: 0.75 })));
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.107, 0.014, 8, 28).rotateX(-Math.PI / 2), B.material('brass', { color: '#c79a3a', color2: '#f3d27a' }));
  collar.position.y = 0.18; g.add(collar);
  const mir = new THREE.Mesh(B.lathe([[0, 0], [0.098, 0], [0.098, 0.004], [0.07, 0.012], [0, 0.017]], 28), mirrorMat()); mir.position.y = 0.17; g.add(mir);
  const ink = new THREE.MeshStandardMaterial({ color: set.ink, roughness: 0.35, metalness: 0.2 });
  const mk = side === 1
    ? new THREE.Mesh(B.inlay(diamond(0.058), 0.012, { bevel: 0.003 }), ink)
    : new THREE.Mesh(B.inlay(ringShape(Array.from({ length: 22 }, (_, i) => [Math.cos(i * TAU / 22) * 0.058, Math.sin(i * TAU / 22) * 0.058]), Array.from({ length: 22 }, (_, i) => [Math.cos(i * TAU / 22) * 0.032, Math.sin(i * TAU / 22) * 0.032])), 0.012, { bevel: 0.003 }), ink);
  mk.position.y = 0.186; g.add(mk);
  g.userData.height = 0.24;
  return g;
}

// ---------------------------------------------------------------- environment
function matCanvas(base, S = 1024) {
  // a woven reed mat (madur): natural straw strips, a twill weave, patterned borders in vermilion and indigo, a lattice of diamonds
  const c = cv(S), x = c.getContext('2d'), r = lcg(91);
  x.fillStyle = '#d9bd7c'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 16) { const v = 168 + r() * 40; x.fillStyle = `rgb(${v + 45},${v + 14},${v - 62})`; x.fillRect(i, 0, 14, S); x.fillStyle = 'rgba(70,40,10,0.3)'; x.fillRect(i + 14, 0, 2, S); }
  const band = (p0, p1, col) => { x.fillStyle = col; x.fillRect(p0, p0, S - 2 * p0, S - 2 * p0); void p1; };
  // border bands, outermost first (each paints the whole inner rectangle)
  band(0, 0, base); band(64, 0, '#ecd9a4'); band(76, 0, '#1d2a68'); band(112, 0, '#ecd9a4'); band(122, 0, '#d9bd7c');
  for (let i = 122; i < S - 122; i += 16) { const v = 168 + r() * 40; x.fillStyle = `rgb(${v + 45},${v + 14},${v - 62})`; x.fillRect(i, 122, 14, S - 244); x.fillStyle = 'rgba(70,40,10,0.3)'; x.fillRect(i + 14, 122, 2, S - 244); }
  // a quiet lattice of small diamonds in the field (muted, so the board stays the subject)
  const F0 = 140, F1 = S - 140, n = 12, pitch = (F1 - F0) / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cx = F0 + (i + 0.5) * pitch, cy = F0 + (j + 0.5) * pitch, rr = pitch * 0.3, odd = (i + j) % 2;
    x.fillStyle = odd ? 'rgba(122,52,36,0.7)' : 'rgba(44,56,108,0.7)'; x.beginPath(); x.moveTo(cx, cy - rr); x.lineTo(cx + rr, cy); x.lineTo(cx, cy + rr); x.lineTo(cx - rr, cy); x.fill();
  }
  // twill weave over everything
  for (let i = 0; i < S; i += 6) for (let j = 0; j < S; j += 6) { const o = ((i / 6 + j / 6) % 3) === 0; x.fillStyle = o ? 'rgba(255,240,200,0.07)' : 'rgba(0,0,0,0.09)'; x.fillRect(i, j, 5, 5); }
  // evening falls off towards the edges of the mat
  const vg = x.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.72); vg.addColorStop(0, 'rgba(24,10,30,0)'); vg.addColorStop(0.55, 'rgba(24,10,30,0.28)'); vg.addColorStop(1, 'rgba(24,10,30,0.72)');
  x.fillStyle = vg; x.fillRect(0, 0, S, S);
  for (let k = 0; k < 4000; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,235,190,0.09)' : 'rgba(60,30,5,0.1)'; x.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 8); }
  return c;
}
function glowCanvas(rgb, size = 128, a = 1) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.35, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
}
export const glowTexture = (rgb, a) => tex(glowCanvas(rgb, 128, a));

export function makeLantern() {
  // a hurricane lantern (hari-kan): enamel tank, glass chimney, wire cage, flame
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2a28, metalness: 0.7, roughness: 0.4 });
  const tank = B.piece([[0, 0], [0.22, 0], [0.26, 0.03], [0.26, 0.12], [0.2, 0.19], [0.1, 0.21], [0.1, 0.24], [0, 0.24]], B.material('brass', { color: '#a87a2a', color2: '#e8c470', seed: 9 }), 24); g.add(tank);
  const glass = new THREE.Mesh(B.lathe([[0.1, 0.24], [0.15, 0.3], [0.17, 0.42], [0.125, 0.55], [0.1, 0.68], [0.09, 0.8], [0.0, 0.8]], 24), new THREE.MeshBasicMaterial({ color: '#ffb257', transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false, depthWrite: false }));
  g.add(glass);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: '#fff2c6', fog: false })); flame.scale.set(0.8, 1.7, 0.8); flame.position.y = 0.42; g.add(flame);
  for (let k = 0; k < 2; k++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.62, 5), iron); const a = k * Math.PI; w.position.set(Math.cos(a) * 0.22, 0.5, Math.sin(a) * 0.22); g.add(w); }
  const cap = B.piece([[0, 0.78], [0.12, 0.78], [0.14, 0.84], [0.06, 0.9], [0.05, 0.96], [0, 0.98]], iron, 20); g.add(cap);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 20).rotateY(Math.PI / 2), iron); ring.position.y = 1.02; g.add(ring);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('255,170,70', 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.position.y = 0.45; halo.scale.set(2.4, 2.4, 1); halo.material.depthTest = false; halo.renderOrder = 4; g.add(halo);
  g.userData = { halo, flame, glass };
  return g;
}
function makeGourd(s = 1) {
  // lau: a pale green bottle gourd, narrow neck and a round belly, with a dusty bloom
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#a8c068', roughness: 0.55, metalness: 0 });
  const body = B.piece([[0, 0], [0.12, 0], [0.26, 0.04], [0.38, 0.16], [0.4, 0.3], [0.33, 0.44], [0.2, 0.54], [0.15, 0.66], [0.16, 0.8], [0.13, 0.94], [0.08, 1.02], [0.03, 1.06], [0, 1.07]], mat, 24);
  g.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.2, 6), new THREE.MeshStandardMaterial({ color: '#6a5a24', roughness: 0.9 })); stem.position.y = 1.15; stem.rotation.z = 0.3; g.add(stem);
  g.scale.setScalar(s); g.rotation.z = Math.PI / 2 - 0.1;      // lying on its side on the ground
  return g;
}
export function makeLeaf(sz = 0.5) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.35, 0.1, 0.5, 0.5, 0, 1); s.bezierCurveTo(-0.5, 0.5, -0.35, 0.1, 0, 0);
  const geo = new THREE.ShapeGeometry(s, 8); geo.scale(sz, sz, sz);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#5f8f2c', roughness: 0.75, side: THREE.DoubleSide }));
  m.castShadow = true; return m;
}

export function buildEnvironment({ matBase = '#7a2a1e' } = {}) {
  const g = new THREE.Group();
  // the mat under the board
  const matTex = tex(matCanvas(matBase, 1024));
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(15, 14), new THREE.MeshStandardMaterial({ map: matTex, color: '#7d6a50', roughness: 1 }));
  mat.rotation.x = -Math.PI / 2; mat.position.y = 0.006; mat.receiveShadow = true; g.add(mat);
  // thickness of the mat edge + fringe
  const edge = new THREE.Mesh(new THREE.BoxGeometry(15, 0.03, 14), new THREE.MeshStandardMaterial({ color: '#8c6a30', roughness: 1 })); edge.position.y = -0.012; g.add(edge);
  // lantern, close behind the far left corner of the mat, plus a point light that flickers
  const lantern = makeLantern(); lantern.position.set(-4.7, 0.0, -3.2); lantern.scale.setScalar(1.9); g.add(lantern);
  const pl = new THREE.PointLight(0xffa24a, 9, 16, 1.5); pl.position.set(-4.7, 1.0, -3.2); g.add(pl);
  // gourds lying on the ground at the right with their vine
  const gourds = [[4.6, 0.38, -2.4, 0.9, 0.5], [5.4, 0.3, -1.4, 0.7, -0.35], [4.4, 0.3, -1.1, 0.6, 0.15]];
  for (const [x, y, z, s, yaw] of gourds) { const q = makeGourd(s); q.position.set(x, y, z); q.rotation.y = yaw; q.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(q); }
  const leaves = [];
  for (let i = 0; i < 9; i++) { const l = makeLeaf(0.5 + (i % 3) * 0.1); const a = i * 0.7; l.position.set(4.2 + Math.cos(a) * 1.5 + (i % 2) * 0.4, 0.08 + (i % 4) * 0.02, -1.8 + Math.sin(a * 1.3) * 1.4); l.rotation.set(-Math.PI / 2 + 0.2 * Math.sin(i), a * 2, 0); g.add(l); leaves.push({ m: l, ph: i * 1.3 }); }
  // brass lota (water pot) and a clay pot on the left
  const lota = B.piece([[0, 0], [0.18, 0], [0.2, 0.03], [0.26, 0.14], [0.3, 0.3], [0.28, 0.42], [0.2, 0.5], [0.14, 0.56], [0.13, 0.64], [0.17, 0.72], [0.19, 0.78], [0.13, 0.76], [0.1, 0.68]], B.material('brass', { color: '#b8862e', color2: '#f0cf7a', seed: 11 }), 28);
  lota.position.set(-5.3, 0.02, 1.3); lota.scale.setScalar(1.15); g.add(lota);
  const pot = B.piece([[0, 0], [0.2, 0], [0.34, 0.1], [0.44, 0.28], [0.42, 0.46], [0.3, 0.58], [0.22, 0.64], [0.26, 0.7], [0.2, 0.7], [0.14, 0.66]], B.material('clay', { color: '#b3562e', color2: '#d98a58', seed: 17 }), 28);
  pot.position.set(-4.6, 0.02, 2.4); pot.scale.setScalar(1.05); g.add(pot);
  // fireflies drifting in the dusk, blinking
  const N = 46, pos = new Float32Array(N * 3), seeds = [], r = lcg(7);
  for (let i = 0; i < N; i++) seeds.push({ x: (r() - 0.5) * 16, z: (r() - 0.5) * 13 - 1.5, y: 0.5 + r() * 3.2, s: 0.1 + r() * 0.25, ph: r() * 6 });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const fm = new THREE.PointsMaterial({ map: glowTexture('210,255,120', 1), color: 0xd8ff80, size: 0.2, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
  const pts = new THREE.Points(geo, fm); pts.frustumCulled = false; g.add(pts);
  const update = (t, calm) => {
    const f = calm ? 1 : 0.9 + 0.1 * Math.sin(t * 8.1) * Math.sin(t * 3.3) + 0.04 * Math.sin(t * 17);
    pl.intensity = 9 * f; lantern.userData.halo.material.opacity = 0.5 + 0.35 * f; lantern.userData.flame.scale.set(0.8 * (0.95 + 0.1 * f), 1.7 * (0.9 + 0.2 * f), 0.8);
    pl.position.x = -4.7 + (calm ? 0 : Math.sin(t * 5.1) * 0.03);
    for (const l of leaves) { if (!calm) { l.m.rotation.z = Math.sin(t * 1.4 + l.ph) * 0.08; l.m.rotation.x = -Math.PI / 2 + 0.2 * Math.sin(l.ph) + Math.sin(t * 1.1 + l.ph) * 0.05; } }
    const a = geo.attributes.position;
    for (let i = 0; i < N; i++) { const s = seeds[i]; a.setXYZ(i, s.x + Math.sin(t * s.s + s.ph) * 1.2, s.y + Math.sin(t * 0.7 + s.ph * 2) * 0.35, s.z + Math.cos(t * s.s * 0.9 + s.ph) * 1.0); }
    a.needsUpdate = true;
    fm.opacity = calm ? 0.8 : 0.55 + 0.4 * Math.abs(Math.sin(t * 1.6));
  };
  return { group: g, update, lantern, light: pl };
}
