// Peralikatuma 3D models: the carved octagon board with brass inlay, faceted ruby and sapphire gems on brass mounts, and a Sri Lankan
// verandah at dusk (teak planks, coir mat, brass oil lamps, potted banana plants, frangipani, palms, paddy terraces beyond).
// Pure scene construction (no game state). World units: one lattice step = 1. The playing surface is the plane y = TOP; the board is
// centred on the origin; +x to the right, +z toward the player (screen bottom). Lattice point (row, col) sits at x = col - 4, z = row - 4.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

export const TOP = 0.42;                 // y of the playing surface
export const HALF = 4.78;                // half extent of the board body (octagon pushed out by the margin)
export const MARGIN = 0.78;
export const MAN_H = 0.4, STAR_H = 0.46;
const TAU = Math.PI * 2;
const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const canvasTex = (c, o = {}) => { const t = new THREE.CanvasTexture(c); t.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); } return t; };
const cache = new Map();
const memo = (k, f) => { let v = cache.get(k); if (v === undefined) { v = f(); cache.set(k, v); } return v; };
export const clearModelCache = () => { cache.clear(); B.disposeMaterialCache(); };

// ---------------------------------------------------------------- the three board woods (keys match art.js WOODS)
export const LOOKS = {
  satin:      { c: ['#e7bd70', '#f6dca0'], lines: 120, frame: ['#5a2f16', '#7a4426'], band: '#2b150a', inlay: '#e6bb55', groove: 'rgba(60,28,6,0.7)', star: 'rgba(120,70,20,0.45)', seed: 5 },
  calamander: { c: ['#a8744a', '#d9a778'], lines: 160, frame: ['#26211f', '#3a312c'], band: '#120d0a', inlay: '#ecd28a', groove: 'rgba(20,8,2,0.8)', star: 'rgba(30,12,4,0.5)', seed: 9 },
  jade:       { c: ['#1f7a64', '#3f9a82'], lines: 50, frame: ['#1b3a31', '#27493f'], band: '#0a1b16', inlay: '#f0d98c', groove: 'rgba(0,20,14,0.75)', star: 'rgba(240,217,140,0.28)', seed: 14 },
};
export const LOOK_KEYS = Object.keys(LOOKS);

// the octagon of points: corners in (x, z)
const HULL = [[-1, -4], [1, -4], [4, -1], [4, 1], [1, 4], [-1, 4], [-4, 1], [-4, -1]];
/** The hull pushed out by `m` with round corners, as [x, z] pairs (clockwise seen from above with z toward the viewer). */
export function outline(m, seg = 8) {
  const out = [], n = HULL.length;
  const normal = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return [dz / l, -dx / l]; };
  for (let k = 0; k < n; k++) {
    const p = HULL[(k + n - 1) % n], a = HULL[k], q = HULL[(k + 1) % n];
    const n0 = normal(p, a), n1 = normal(a, q);
    let a0 = Math.atan2(n0[1], n0[0]), a1 = Math.atan2(n1[1], n1[0]);
    // sweep the short way
    let d = a1 - a0; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    for (let s = 0; s <= seg; s++) { const ang = a0 + d * (s / seg); out.push([a[0] + Math.cos(ang) * m, a[1] + Math.sin(ang) * m]); }
  }
  return out;
}
const pathOf = (x, pts, u, E) => { x.beginPath(); pts.forEach(([px, pz], i) => { const X = (px + E) * u, Y = (pz + E) * u; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.closePath(); };

// ---------------------------------------------------------------- board textures: wood, carved band, inlaid lines
function boardCanvases(look) {
  const L = LOOKS[look] || LOOKS.satin, S = 2048, E = 5.0, u = S / (2 * E);
  const wd = B.woodCanvas(1024, L.c[0], L.c[1], L.seed, { lines: L.lines, knots: 1 });
  const map = cv(S), x = map.getContext('2d'), bump = cv(S), bx = bump.getContext('2d');
  x.drawImage(wd.map, 0, 0, S, S); bx.drawImage(wd.bump, 0, 0, S, S);
  const P = (r, c) => [(c - 4 + E) * u, (r - 4 + E) * u];
  const poly = (m) => outline(m, 10);
  // dark carved band (the frame), with a pale wood field inside
  const fr = L.frame, g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, fr[0]); g.addColorStop(1, fr[1]);
  x.fillStyle = g; pathOf(x, poly(MARGIN + 0.02), u, E); x.fill();
  const wf = B.woodCanvas(512, fr[0], fr[1], L.seed + 7, { lines: 90, knots: 0 });
  x.save(); pathOf(x, poly(MARGIN + 0.02), u, E); x.clip(); x.globalAlpha = 0.55; x.drawImage(wf.map, 0, 0, S, S); x.restore();
  bx.fillStyle = '#6a6a6a'; pathOf(bx, poly(MARGIN + 0.02), u, E); bx.fill();                 // the band sits a little lower than the field
  bx.fillStyle = '#808080'; pathOf(bx, poly(0.5), u, E); bx.fill();
  // field fill (restores the pale wood over the band's inner part)
  x.save(); pathOf(x, poly(0.5), u, E); x.clip(); x.drawImage(wd.map, 0, 0, S, S);
  const vg = x.createRadialGradient(S / 2, S / 2, S * 0.12, S / 2, S / 2, S * 0.5); vg.addColorStop(0, 'rgba(255,240,200,0.14)'); vg.addColorStop(1, 'rgba(40,16,0,0.22)'); x.fillStyle = vg; x.fillRect(0, 0, S, S);
  x.restore();
  // brass keylines between band and field
  const line = (m, col, w) => { x.strokeStyle = col; x.lineWidth = w * u; x.lineJoin = 'round'; pathOf(x, poly(m), u, E); x.stroke(); };
  line(0.5, 'rgba(0,0,0,0.55)', 0.075); line(0.5, L.inlay, 0.04);
  line(MARGIN - 0.05, 'rgba(0,0,0,0.5)', 0.07); line(MARGIN - 0.05, L.inlay, 0.034);
  // lotus petals (the band): a ring of pointed petals along the middle of the band, pale wood on a dark ground with a brass dot between
  { const pts = poly(0.64), len = []; let tot = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); len.push(d); tot += d; }
    const N = Math.round(tot / 0.34), step = tot / N; let acc = 0, idx = 0, off = 0;
    for (let k = 0; k < N; k++) {
      const want = k * step; while (acc + len[idx] < want) { acc += len[idx]; idx = (idx + 1) % pts.length; }
      const a = pts[idx], b = pts[(idx + 1) % pts.length], f = (want - acc) / len[idx], X = (a[0] + (b[0] - a[0]) * f + E) * u, Y = (a[1] + (b[1] - a[1]) * f + E) * u;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      x.save(); x.translate(X, Y); x.rotate(ang);
      x.fillStyle = L.band; x.beginPath(); x.ellipse(0, 0, 0.17 * u, 0.1 * u, 0, 0, TAU); x.fill();
      x.fillStyle = L.inlay; x.beginPath(); x.moveTo(-0.15 * u, 0); x.quadraticCurveTo(0, -0.1 * u, 0.15 * u, 0); x.quadraticCurveTo(0, 0.1 * u, -0.15 * u, 0); x.closePath(); x.fill();
      x.fillStyle = L.band; x.beginPath(); x.arc(0, 0, 0.03 * u, 0, TAU); x.fill();
      x.restore(); off++;
    }
  }
  // the centre: a carved eight-pointed star and ring
  const cx = S / 2, cy = S / 2;
  x.strokeStyle = L.star; x.lineWidth = 0.05 * u; x.lineJoin = 'round';
  for (const rot of [0, Math.PI / 8]) { x.beginPath(); for (let k = 0; k < 16; k++) { const a = rot + k * TAU / 16 - Math.PI / 2, r = (k % 2 ? 0.62 : 1.5) * u; k ? x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.stroke(); }
  x.beginPath(); x.arc(cx, cy, 1.0 * u, 0, TAU); x.stroke();
  // the lines: orthogonal everywhere, diagonals from points where row + column is even; engraved groove under a brass inlay
  const isPt = (r, c) => r >= 0 && r < 9 && c >= 0 && c < 9 && Math.abs(c - 4) + Math.abs(r - 4) <= 5;
  const segs = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (!isPt(r, c)) continue;
    if (isPt(r, c + 1)) segs.push([r, c, r, c + 1]);
    if (isPt(r + 1, c)) segs.push([r, c, r + 1, c]);
    if ((r + c) % 2 === 0) { if (isPt(r + 1, c + 1)) segs.push([r, c, r + 1, c + 1]); if (isPt(r + 1, c - 1)) segs.push([r, c, r + 1, c - 1]); }
  }
  const stroke = (ctx, col, w, dy = 0) => { ctx.strokeStyle = col; ctx.lineWidth = w * u; ctx.lineCap = 'round'; ctx.beginPath(); for (const [r0, c0, r1, c1] of segs) { const a = P(r0, c0), b = P(r1, c1); ctx.moveTo(a[0], a[1] + dy); ctx.lineTo(b[0], b[1] + dy); } ctx.stroke(); };
  stroke(x, L.groove, 0.1); stroke(x, L.inlay, 0.046, -0.4); stroke(x, 'rgba(255,255,255,0.35)', 0.012, -0.012 * u * 8);
  stroke(bx, '#101010', 0.1); stroke(bx, '#7a7a7a', 0.05);
  // the points: a brass ring and a dark centre
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (!isPt(r, c)) continue; const [px, py] = P(r, c);
    x.fillStyle = L.groove; x.beginPath(); x.arc(px, py, 0.17 * u, 0, TAU); x.fill();
    x.strokeStyle = L.inlay; x.lineWidth = 0.05 * u; x.beginPath(); x.arc(px, py, 0.14 * u, 0, TAU); x.stroke();
    x.fillStyle = L.band; x.beginPath(); x.arc(px, py, 0.075 * u, 0, TAU); x.fill();
    bx.fillStyle = '#202020'; bx.beginPath(); bx.arc(px, py, 0.15 * u, 0, TAU); bx.fill();
  }
  // a faint polish across the top
  const hl = x.createLinearGradient(0, 0, S, S); hl.addColorStop(0, 'rgba(255,240,205,0.12)'); hl.addColorStop(0.5, 'rgba(255,240,205,0)'); hl.addColorStop(1, 'rgba(0,0,0,0.14)'); x.fillStyle = hl; x.fillRect(0, 0, S, S);
  return { map, bump, E };
}

export function buildBoard(look = 'satin') {
  const g = new THREE.Group(); g.name = 'board';
  const L = LOOKS[look] || LOOKS.satin;
  const { map, bump, E } = boardCanvases(look);
  const shape = new THREE.Shape(outline(MARGIN, 8).map(([x, z]) => new THREE.Vector2(x, -z)));
  const depth = 0.3, bt = 0.07;
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: 0.06, bevelSegments: 3, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, TOP - (depth + bt), 0);
  const topTex = canvasTex(map), bumpTex = canvasTex(bump, { srgb: false });
  for (const t of [topTex, bumpTex]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / (2 * E), 1 / (2 * E)); t.offset.set(0.5, 0.5); }
  const topMat = new THREE.MeshPhysicalMaterial({ map: topTex, bumpMap: bumpTex, bumpScale: 1.4, roughness: 0.4, metalness: 0, clearcoat: look === 'jade' ? 1 : 0.55, clearcoatRoughness: 0.16, envMapIntensity: 0.9 });
  const sideMat = B.material('darkWood', { color: L.frame[0], color2: L.frame[1], seed: 5, repeat: [4, 1] });
  const body = new THREE.Mesh(geo, [topMat, sideMat]); body.castShadow = true; body.receiveShadow = true; g.add(body);
  // a stepped carved plinth under the board
  const foot = new THREE.Mesh((() => { const sh = new THREE.Shape(outline(MARGIN - 0.12, 6).map(([x, z]) => new THREE.Vector2(x, -z))); const q = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 3 }); q.rotateX(-Math.PI / 2); q.translate(0, 0.02, 0); return q; })(), sideMat);
  foot.castShadow = true; foot.receiveShadow = true; g.add(foot);
  // brass edge lip: short capsules along the outline
  const brass = memo('brassEdge', () => B.material('brass', { color: '#d9a93a', color2: '#f6dc8a', roughness: 0.26, seed: 3 }));
  const ring = outline(MARGIN + 0.02, 9), parts = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-4) continue;
    const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, TOP - 0.035, (a[1] + b[1]) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(b[1] - a[1], b[0] - a[0])), new THREE.Vector3(1, 1, 1));
    parts.push({ geo: B.roundedBox(len + 0.02, 0.07, 0.06, 0.025, 2), m });
  }
  const lip = new THREE.Mesh(B.mergeGeos(parts), brass); lip.castShadow = true; lip.receiveShadow = true; g.add(lip);
  // eight brass studs at the corners of the octagon
  const stud = new THREE.SphereGeometry(0.1, 14, 10); stud.scale(1, 0.6, 1);
  for (const [x, z] of HULL) {
    const d = Math.hypot(x, z) || 1, px = x + (x / d) * (MARGIN * 0.55), pz = z + (z / d) * (MARGIN * 0.55);
    const s = new THREE.Mesh(stud, brass); s.position.set(px, TOP + 0.005, pz); s.castShadow = true; g.add(s);
  }
  return g;
}

// ---------------------------------------------------------------- gems
const GEM = {
  1: { color: '#c41533', emissive: '#6a0618', glow: '#ff6b7e', rough: 0.1 },
  2: { color: '#1f56d6', emissive: '#082566', glow: '#7aaeff', rough: 0.1 },
};
const gemMat = (side, style) => memo(`gm|${side}|${style}`, () => {
  const G = GEM[side], m = new THREE.MeshPhysicalMaterial({ color: G.color, emissive: G.emissive, emissiveIntensity: 0.55, roughness: style === 'cabochon' ? 0.08 : 0.14, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 2.4, flatShading: style !== 'cabochon' });
  return m;
});
const goldMat = () => memo('gold', () => B.material('brass', { color: '#e6b83e', color2: '#fbe38e', roughness: 0.2, seed: 9, envIntensity: 3.4 }));
const mountMat = () => memo('mount', () => B.material('brass', { color: '#b8892c', color2: '#e9c460', roughness: 0.3, seed: 4, envIntensity: 2.6 }));
const RAD = 0.43;
const profBase = [[0, 0], [0.97, 0], [1.0, 0.02], [1.0, 0.08], [0.94, 0.12], [0.88, 0.13], [0.0, 0.13]].map(([r, y]) => [r * RAD, y * 0.62 * 0.5]);
// gem crown: faceted = a stepped step-cut (girdle, pavilion, table), cabochon = a smooth dome
const crownFaceted = [[0.86, 0.0], [0.9, 0.012], [0.9, 0.06], [0.84, 0.1], [0.7, 0.16], [0.52, 0.205], [0.36, 0.225], [0.0, 0.225]].map(([r, y]) => [r * RAD, y]);
const crownCab = (() => { const p = []; for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI / 2, r = Math.cos(a), y = Math.sin(a); p.push([0.9 * r * RAD, 0.012 + y * 0.2]); } return p; })();
const geo = (key, f) => memo('g|' + key, f);

export function makePiece(code, style = 'faceted') {
  const side = ((code - 1) & 1) + 1, star = code > 2, cab = style === 'cabochon';
  const seg = side === 2 ? 8 : cab ? 48 : 24;
  const grp = new THREE.Group();
  const add = (g, mat, y = 0, ry = 0) => { const m = new THREE.Mesh(g, mat); m.position.y = y; m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
  const rot = side === 2 ? Math.PI / 8 : 0;
  // the brass mount: a thick base disc with a bead (round for Ruby, eight-sided for Sapphire)
  const baseTall = 0.1;
  const mount = geo(`mount|${seg}`, () => B.lathe([[0, 0], [0.43, 0], [0.45, 0.012], [0.45, 0.05], [0.43, 0.075], [0.4, 0.085], [0.4, 0.1], [0.37, 0.108], [0, 0.108]], seg));
  add(mount, mountMat(), 0, rot);
  const crown = geo(`crown|${style}|${seg}`, () => B.lathe((cab ? crownCab : crownFaceted).map(([r, y]) => [r, y]), seg));
  const gem = add(crown, gemMat(side, style), baseTall + 0.012, rot);
  const top = baseTall + 0.012 + (cab ? 0.2 : 0.225);
  // a bright table: a thin lighter disc that reads as the gem's top facet catching the lamp
  if (!cab) {
    const tab = geo(`tab|${seg}`, () => B.lathe([[0, 0], [0.36 * RAD, 0], [0.36 * RAD, 0.004], [0, 0.004]], seg));
    add(tab, memo(`tabm|${side}`, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(GEM[side].glow), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })), top + 0.001, rot).castShadow = false;
  }
  if (star) {
    const bez = geo('bezel', () => new THREE.TorusGeometry(0.8 * RAD, 0.035, 8, seg === 8 ? 8 : 40)); const bm = add(bez, goldMat(), baseTall + 0.05, rot); bm.rotation.x = Math.PI / 2; bm.rotation.z = 0;
    const st = geo('star8', () => B.inlay(B.starPoints(8, 0.3, 0.12, -Math.PI / 2), 0.05));
    add(st, goldMat(), top - 0.008);
    add(geo('starboss', () => B.lathe([[0, 0], [0.05, 0], [0.04, 0.03], [0, 0.04]], 14)), goldMat(), top + 0.04);
  } else {
    // a small gold bead on the table of a man
    add(geo('bead', () => B.lathe([[0, 0], [0.06, 0], [0.055, 0.012], [0.03, 0.026], [0, 0.03]], 14)), goldMat(), top - 0.006);
  }
  grp.userData = { height: star ? STAR_H : MAN_H };
  return grp;
}

// ---------------------------------------------------------------- the verandah floor, coir mat
function plankCanvas() {
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = rngOf(81), n = 8, pw = S / n;
  for (let i = 0; i < n; i++) {
    const g = x.createLinearGradient(i * pw, 0, (i + 1) * pw, 0), t = 0.5 + r() * 0.5; const b = Math.round(70 + t * 36);
    g.addColorStop(0, `rgb(${b + 18},${Math.round(b * 0.55)},${Math.round(b * 0.28)})`); g.addColorStop(1, `rgb(${b},${Math.round(b * 0.5)},${Math.round(b * 0.25)})`);
    x.fillStyle = g; x.fillRect(i * pw, 0, pw, S);
    for (let k = 0; k < 26; k++) { const px = i * pw + r() * pw; x.strokeStyle = r() < 0.7 ? `rgba(20,8,2,${0.06 + r() * 0.12})` : `rgba(255,200,140,${0.04 + r() * 0.07})`; x.lineWidth = 0.6 + r() * 2; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + (r() - 0.5) * 8, S * 0.3, px + (r() - 0.5) * 8, S * 0.7, px + (r() - 0.5) * 6, S); x.stroke(); }
    const j = r() * S; x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(i * pw, j, pw, 3);             // end joint
    x.fillStyle = 'rgba(0,0,0,0.7)'; x.fillRect(i * pw - 1, 0, 3, S);                              // seam
    x.fillStyle = 'rgba(255,220,170,0.1)'; x.fillRect(i * pw + 2, 0, 2, S);
  }
  return c;
}
function matCanvas() {
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = rngOf(47);
  x.fillStyle = '#c9b076'; x.fillRect(0, 0, S, S);
  // woven strips: horizontal and vertical alternating
  const w = 14; for (let i = 0; i < S / w; i++) for (let j = 0; j < S / w; j++) { const hor = (i + j) % 2 === 0; x.fillStyle = hor ? `rgba(255,236,170,${0.04 + r() * 0.05})` : `rgba(60,36,10,${0.03 + r() * 0.05})`; x.fillRect(i * w, j * w, w - 1, w - 1); }
  const band = (a, b, col) => { x.fillStyle = col; x.beginPath(); x.rect(a, a, S - 2 * a, S - 2 * a); x.rect(b, b, S - 2 * b, S - 2 * b); x.fill('evenodd'); };
  band(0, 60, '#7a2a14'); band(60, 74, '#e8d19a'); band(74, 118, '#2c4a3a'); band(118, 132, '#e8d19a');
  // zig-zag in the dark band
  x.strokeStyle = '#e8c25a'; x.lineWidth = 5; x.beginPath(); for (let i = 0; i <= 44; i++) { const px = 90 + (i / 44) * (S - 180), py = 96 + (i % 2 ? 9 : -9); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  for (let i = 0; i < 22000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)'; x.fillRect(r() * S, r() * S, 2 + r() * 3, 1); }
  return c;
}
export function buildFloor() {
  const g = new THREE.Group(); g.name = 'floor';
  const tex = canvasTex(plankCanvas(), { repeat: [8, 4.5] });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(64, 36), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0, envMapIntensity: 0.6 }));
  top.rotation.x = -Math.PI / 2; top.position.set(0, -0.002, 3); top.receiveShadow = true; g.add(top);
  // the front edge and a sill at the back (the verandah is a raised platform)
  const sill = new THREE.Mesh(new THREE.BoxGeometry(40, 1.2, 0.5), B.material('darkWood', { color: '#3a1f10', color2: '#5a3820', seed: 12, repeat: [10, 1] }));
  sill.position.set(0, -0.6, -13.9); g.add(sill);
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 12.6), new THREE.MeshStandardMaterial({ map: canvasTex(matCanvas()), roughness: 0.98, metalness: 0, envMapIntensity: 0.3 }));
  mat.rotation.set(-Math.PI / 2, 0, 0.1); mat.position.y = 0.012; mat.receiveShadow = true; g.add(mat);
  return g;
}

// ---------------------------------------------------------------- verandah: turned balusters, rail, carved pillars
export function buildRail(z = -11.6) {
  const g = new THREE.Group(); g.name = 'rail';
  const wood = memo('railWood', () => B.material('darkWood', { color: '#4a2a14', color2: '#6a4122', seed: 21, repeat: [6, 1], roughness: 0.5 }));
  const bal = B.lathe([[0, 0], [0.09, 0], [0.09, 0.08], [0.06, 0.12], [0.06, 0.3], [0.11, 0.38], [0.075, 0.46], [0.07, 0.9], [0.11, 0.98], [0.06, 1.06], [0.06, 1.18], [0.09, 1.2], [0.09, 1.28], [0, 1.28]], 14);
  const parts = []; for (let i = -22; i <= 22; i++) parts.push({ geo: bal, m: new THREE.Matrix4().makeTranslation(i * 0.9, 0.25, 0) });
  const bm = new THREE.Mesh(B.mergeGeos(parts), wood); bm.castShadow = true; bm.receiveShadow = true; g.add(bm);
  const top = new THREE.Mesh(B.roundedBox(42, 0.24, 0.42, 0.08, 3), wood); top.position.y = 1.68; top.castShadow = true; g.add(top);
  const bot = new THREE.Mesh(B.roundedBox(42, 0.2, 0.36, 0.06, 3), wood); bot.position.y = 0.15; bot.castShadow = true; g.add(bot);
  g.position.z = z; return g;
}
export function buildPillar() {
  const g = new THREE.Group(); g.name = 'pillar';
  const wood = memo('pillarWood', () => B.material('darkWood', { color: '#5a3118', color2: '#7c4b27', seed: 33, repeat: [1, 4], roughness: 0.45 }));
  const gold = memo('pillarGold', () => B.material('brass', { color: '#c9962e', color2: '#f0d078', roughness: 0.35, seed: 6 }));
  const stone = memo('pillarStone', () => B.material('stone', { color: '#6a5a4c', color2: '#9a8a78', seed: 5, repeat: [1, 1] }));
  const base = new THREE.Mesh(B.lathe([[0, 0], [0.62, 0], [0.62, 0.18], [0.5, 0.28], [0.46, 0.5], [0.4, 0.58], [0, 0.58]], 24), stone); g.add(base);
  const shaft = new THREE.Mesh(B.lathe([[0, 0.5], [0.34, 0.5], [0.36, 0.7], [0.3, 0.86], [0.3, 4.6], [0.36, 4.78], [0.4, 4.9], [0.34, 5.02], [0.36, 5.2], [0, 5.2]], 24), wood); shaft.castShadow = true; shaft.receiveShadow = true; g.add(shaft);
  for (const y of [1.4, 2.6, 3.8, 4.5]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.035, 8, 28), gold); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  const cap = new THREE.Mesh(B.lathe([[0, 5.2], [0.5, 5.2], [0.62, 5.36], [0.7, 5.6], [0.58, 5.72], [0, 5.72]], 24), wood); cap.castShadow = true; g.add(cap);
  return g;
}

// ---------------------------------------------------------------- the Sri Lankan brass oil lamp (pahana): stepped base, turned stem, a wide tray of wick cups, a finial
export function buildLamp() {
  const g = new THREE.Group(); g.name = 'lamp';
  const brass = memo('lampBrass', () => B.material('brass', { color: '#c8932a', color2: '#f3d478', roughness: 0.24, seed: 2, envIntensity: 3.0 }));
  const body = [[0, 0], [0.42, 0], [0.46, 0.04], [0.46, 0.1], [0.36, 0.16], [0.3, 0.26], [0.14, 0.34], [0.1, 0.5], [0.16, 0.6], [0.08, 0.68], [0.07, 1.0], [0.14, 1.1], [0.07, 1.2], [0.06, 1.5],
    [0.13, 1.56], [0.2, 1.6], [0.5, 1.64], [0.62, 1.7], [0.64, 1.78], [0.58, 1.82], [0.5, 1.8], [0.2, 1.74], [0.0, 1.74]];
  const m = new THREE.Mesh(B.lathe(body, 36), brass); m.castShadow = true; m.receiveShadow = true; g.add(m);
  // the cups round the rim, each with a flame anchor
  g.userData.flames = [];
  const cup = B.lathe([[0, 0], [0.07, 0], [0.1, 0.03], [0.1, 0.07], [0.08, 0.075], [0.07, 0.04], [0, 0.04]], 12);
  const n = 8;
  for (let k = 0; k < n; k++) { const a = (k / n) * TAU, px = Math.cos(a) * 0.55, pz = Math.sin(a) * 0.55; const c = new THREE.Mesh(cup, brass); c.position.set(px, 1.8, pz); g.add(c); g.userData.flames.push([px, 1.9, pz]); }
  // finial: a kalasa and a small bird on top of a stem
  const fin = new THREE.Mesh(B.lathe([[0, 1.74], [0.07, 1.74], [0.06, 1.9], [0.14, 2.0], [0.16, 2.12], [0.1, 2.24], [0.05, 2.3], [0.07, 2.42], [0.0, 2.5]], 20), brass); fin.castShadow = true; g.add(fin);
  g.userData.flames.push([0, 2.62, 0]);
  return g;
}

// ---------------------------------------------------------------- plants: banana-leaf blades and palm fronds (double-sided, bent, alpha-cut)
function leafCanvas(kind) {
  const W = 128, H = 512, c = cv(W, H), x = c.getContext('2d'), r = rngOf(kind === 'palm' ? 9 : 3);
  if (kind === 'palm') {
    x.clearRect(0, 0, W, H); x.strokeStyle = '#2f5a22'; x.lineWidth = 4; x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.stroke();
    for (let i = 0; i < 46; i++) { const y = 14 + (i / 46) * (H - 24), len = (W / 2 - 4) * (0.5 + 0.5 * Math.sin((i / 46) * Math.PI * 0.95 + 0.3)); for (const s of [-1, 1]) { x.strokeStyle = r() < 0.5 ? '#3d7a2a' : '#4c8f33'; x.lineWidth = 3.2; x.beginPath(); x.moveTo(W / 2, y); x.quadraticCurveTo(W / 2 + s * len * 0.6, y + 8, W / 2 + s * len, y + 26); x.stroke(); } }
  } else {
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#2c6a2a'); g.addColorStop(0.5, '#5aa83c'); g.addColorStop(1, '#2c6a2a'); x.fillStyle = g;
    x.beginPath(); x.moveTo(W / 2, 0); x.bezierCurveTo(W * 1.05, H * 0.1, W * 1.05, H * 0.8, W / 2, H); x.bezierCurveTo(-W * 0.05, H * 0.8, -W * 0.05, H * 0.1, W / 2, 0); x.fill();
    x.strokeStyle = 'rgba(20,50,12,0.5)'; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.stroke();
    for (let i = 0; i < 40; i++) { const y = 10 + (i / 40) * (H - 20); x.strokeStyle = 'rgba(14,44,8,0.28)'; x.lineWidth = 1.2; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(W / 2, y); x.lineTo(W / 2 + s * W * 0.46, y + 22); x.stroke(); } }
    for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(255,255,200,${r() * 0.05})`; x.fillRect(r() * W, r() * H, 3, 1); }
  }
  return c;
}
function leafGeo(len, wid, bend, droop, seg = 10) {
  const geo = new THREE.PlaneGeometry(wid, len, 3, seg), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) / len) + 0.5, xw = p.getX(i);           // t 0 base .. 1 tip
    const arch = Math.sin(t * Math.PI * 0.5) * bend - t * t * droop;
    p.setZ(i, arch + Math.abs(xw) * 0.28 * (1 - t * 0.5));
    p.setY(i, t * len * (1 - 0.18 * t));
    p.setX(i, xw * (1 - 0.3 * t * t));
  }
  geo.computeVertexNormals(); return geo;
}
export function buildPlant(kind = 'banana', n = 7, seed = 1) {
  const g = new THREE.Group(); g.name = 'plant'; g.userData.fronds = [];
  const r = rngOf(seed);
  const tex = memo('leaf|' + kind, () => canvasTex(leafCanvas(kind)));
  const mat = memo('leafMat|' + kind, () => new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.7, alphaTest: kind === 'palm' ? 0.35 : 0.1, transparent: false, envMapIntensity: 0.5 }));
  const lg = memo(`leafGeo|${kind}`, () => (kind === 'palm' ? leafGeo(4.8, 1.9, 1.3, 1.6, 10) : leafGeo(3.4, 1.15, 0.7, 0.9, 10)));
  for (let i = 0; i < n; i++) {
    const hold = new THREE.Group(), m = new THREE.Mesh(lg, mat); m.castShadow = true; hold.add(m);
    const a = (i / n) * TAU + r() * 0.5; hold.rotation.set(0, a, 0); m.rotation.x = Math.PI / 2 - (0.45 + r() * 0.5) - (kind === 'palm' ? 0.1 : 0);
    m.rotation.order = 'XYZ'; m.scale.setScalar(0.8 + r() * 0.45); hold.userData = { a, ph: r() * TAU, amp: 0.03 + r() * 0.03 };
    g.add(hold); g.userData.fronds.push(hold);
  }
  return g;
}
export function buildPot() {
  const g = new THREE.Group(); const clay = memo('clay', () => B.material('clay', { color: '#a8512c', color2: '#c9703c', seed: 4, roughness: 0.82 }));
  const m = new THREE.Mesh(B.lathe([[0, 0], [0.36, 0], [0.44, 0.1], [0.62, 0.7], [0.68, 0.9], [0.62, 0.95], [0.5, 0.92], [0.0, 0.86]], 28), clay); m.castShadow = true; m.receiveShadow = true; g.add(m);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.52, 20), new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 1 })); soil.rotation.x = -Math.PI / 2; soil.position.y = 0.9; g.add(soil);
  return g;
}
export function buildPalm() {
  const g = new THREE.Group(); g.name = 'palm';
  const trunk = new THREE.Mesh(B.lathe((() => { const p = [[0, 0]]; for (let k = 0; k <= 16; k++) { const y = k * 0.62; p.push([0.26 - k * 0.006 + (k % 2 ? 0.02 : 0), y]); } p.push([0, 9.9]); return p; })(), 14), new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 0.95 }));
  trunk.castShadow = true; g.add(trunk);
  const crown = buildPlant('palm', 9, 5); crown.position.y = 9.9; crown.scale.setScalar(1.5); g.add(crown); g.userData.fronds = crown.userData.fronds;
  return g;
}
// frangipani (plumeria): five cream petals with a yellow throat, lying on the floor
export function buildFlower() {
  const g = new THREE.Group();
  const petal = new THREE.Shape(); petal.moveTo(0, 0); petal.bezierCurveTo(0.14, 0.02, 0.2, 0.18, 0.12, 0.32); petal.bezierCurveTo(0.06, 0.4, -0.06, 0.4, -0.12, 0.32); petal.bezierCurveTo(-0.2, 0.18, -0.14, 0.02, 0, 0);
  const pg = new THREE.ShapeGeometry(petal, 6); pg.rotateX(-Math.PI / 2);
  const pm = memo('petalMat', () => new THREE.MeshStandardMaterial({ color: '#fff3dc', roughness: 0.6, side: THREE.DoubleSide, emissive: '#3a2a10', emissiveIntensity: 0.25 }));
  for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(pg, pm); m.rotation.y = (k / 5) * TAU; m.rotation.z = 0; m.position.y = 0.01 + k * 0.0006; m.receiveShadow = true; g.add(m); }
  const c = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), new THREE.MeshBasicMaterial({ color: '#f6c640' })); c.rotation.x = -Math.PI / 2; c.position.y = 0.014; g.add(c);
  return g;
}
export function buildCoconutBowl() {
  const g = new THREE.Group();
  const shell = memo('shell', () => new THREE.MeshStandardMaterial({ color: '#4a2c16', roughness: 0.7, bumpScale: 0.4 }));
  const m = new THREE.Mesh(B.lathe([[0, 0.02], [0.18, 0.02], [0.3, 0.1], [0.36, 0.24], [0.34, 0.3], [0.31, 0.29], [0.28, 0.24], [0.18, 0.1], [0, 0.07]], 24), shell); m.castShadow = true; m.receiveShadow = true; g.add(m);
  const seed = new THREE.SphereGeometry(0.045, 8, 6), sm = new THREE.MeshStandardMaterial({ color: '#6a2f12', roughness: 0.4, metalness: 0.1 });
  const r = rngOf(7); for (let i = 0; i < 9; i++) { const a = r() * TAU, rr = r() * 0.18; const s = new THREE.Mesh(seed, sm); s.scale.set(1.2, 0.7, 0.9); s.position.set(Math.cos(a) * rr, 0.1 + r() * 0.05, Math.sin(a) * rr); s.rotation.y = r() * 3; g.add(s); }
  return g;
}
export const flameTexture = () => memo('flameTex', () => {
  const c = cv(64, 128), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 90, 2, 32, 86, 44); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.28, 'rgba(255,196,80,0.95)'); g.addColorStop(0.7, 'rgba(255,110,20,0.35)'); g.addColorStop(1, 'rgba(255,60,0,0)');
  x.fillStyle = g; x.beginPath(); x.moveTo(32, 4); x.bezierCurveTo(52, 50, 58, 80, 32, 120); x.bezierCurveTo(6, 80, 12, 50, 32, 4); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
});
