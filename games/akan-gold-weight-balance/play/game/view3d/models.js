// Akan Gold-Weight Balance: sculpted props for the 3D presenter. Pure construction (no sim state).
//  - the ten cast brass figures are EXTRUDED from the same vector art the flat layer uses (src/weights.js FIG), so the 3D weights are
//    exactly the figures the Rules pages describe; the art is replayed through a recording context and turned into bevelled brass
//    solids, dark inlays, incised grooves and thick tubes
//  - the leather dust bag, the brass balance (beam, pillar, pans, chains, pointer), the dust heap and the spouted ladle
// Unit conventions: weights/bag are built with the plate width = 1 and the plate bottom at y = 0; the balance is built with the beam
// half length = 1 (the presenter scales by G.hl).
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { FIG, figOf } from '../src/weights.js';

export const TAU = Math.PI * 2;
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
export const hash = (a, b = 0) => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; return (h >>> 0) / 4294967296; };

// ---------------------------------------------------------------- materials
const cache = new Map();
export const mat = (key, make) => { let m = cache.get(key); if (!m) { m = make(); cache.set(key, m); } return m; };
export const clearMaterials = () => { for (const m of cache.values()) m.dispose?.(); cache.clear(); };
const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, ...o });
export const M = {
  brass: () => mat('brass', () => B.material('brass', { color: '#b97c12', color2: '#dba52c', roughness: 0.34, envIntensity: 1.5 })),
  brassPol: () => mat('brassPol', () => B.material('brass', { color: '#c8921c', color2: '#e8b83a', roughness: 0.26, envIntensity: 1.7, seed: 11 })),
  brassOld: () => mat('brassOld', () => B.material('brass', { color: '#8c5a14', color2: '#b8822a', roughness: 0.42, envIntensity: 1.3, seed: 5 })),
  dark: () => mat('dark', () => std({ color: '#2a1707', roughness: 0.55, metalness: 0.45 })),
  gold: () => mat('gold', () => phys('#f2b21e', { metalness: 1, roughness: 0.24, envMapIntensity: 2.0, emissive: '#6a3c00', emissiveIntensity: 0.22 })),
  leather: () => mat('leather', () => std({ color: '#6e3f1c', roughness: 0.72, metalness: 0.02 })),
  leatherDark: () => mat('leatherDark', () => std({ color: '#3e2010', roughness: 0.8 })),
  cord: () => mat('cord', () => std({ color: '#d6b46a', roughness: 0.6 })),
  wood: () => mat('wood', () => { const m = B.material('darkWood', { color: '#4a2a14', color2: '#6a4022', repeat: [3, 2], seed: 21, roughness: 0.6 }); m.clearcoat = 0.12; return m; }),
  woodLight: () => mat('woodLight', () => B.material('wood', { color: '#a06a35', color2: '#c48e50', repeat: [2, 2], seed: 8, roughness: 0.55 })),
};

// ---------------------------------------------------------------- the figures, extruded from the 2D art
function recorder() {
  const st = { m: [1, 0, 0, 1, 0, 0], stack: [], clip: false, subs: [], shapes: [], strokes: [], fillStyle: null, strokeStyle: null, lineWidth: 1, cur: null };
  const tx = (x, y) => { const m = st.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; };
  const mul = (a) => { const m = st.m; st.m = [m[0] * a[0] + m[2] * a[1], m[1] * a[0] + m[3] * a[1], m[0] * a[2] + m[2] * a[3], m[1] * a[2] + m[3] * a[3], m[0] * a[4] + m[2] * a[5] + m[4], m[1] * a[4] + m[3] * a[5] + m[5]]; };
  const add = (x, y) => { if (!st.cur) { st.cur = { pts: [], closed: false }; st.subs.push(st.cur); } st.cur.pts.push(tx(x, y)); };
  const last = () => (st.cur && st.cur.pts.length ? st.cur.pts[st.cur.pts.length - 1] : null);
  // points are stored already transformed; curve control points need the untransformed current point, so keep the raw one
  let raw = [0, 0];
  const api = {
    save() { st.stack.push({ m: st.m.slice(), clip: st.clip }); },
    restore() { const s = st.stack.pop(); if (s) { st.m = s.m; st.clip = s.clip; } },
    translate(x, y) { mul([1, 0, 0, 1, x, y]); }, scale(x, y) { mul([x, 0, 0, y, 0, 0]); },
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); mul([c, s, -s, c, 0, 0]); },
    beginPath() { st.subs = []; st.cur = null; },
    closePath() { if (st.cur) st.cur.closed = true; },
    moveTo(x, y) { st.cur = { pts: [], closed: false }; st.subs.push(st.cur); add(x, y); raw = [x, y]; },
    lineTo(x, y) { add(x, y); raw = [x, y]; },
    bezierCurveTo(x1, y1, x2, y2, x, y) {
      const [x0, y0] = raw;
      for (let i = 1; i <= 14; i++) { const t = i / 14, u = 1 - t; add(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y); }
      raw = [x, y];
    },
    quadraticCurveTo(x1, y1, x, y) {
      const [x0, y0] = raw;
      for (let i = 1; i <= 10; i++) { const t = i / 10, u = 1 - t; add(u * u * x0 + 2 * u * t * x1 + t * t * x, u * u * y0 + 2 * u * t * y1 + t * t * y); }
      raw = [x, y];
    },
    arc(cx, cy, r, a0, a1, ccw = false) { api.ellipse(cx, cy, r, r, 0, a0, a1, ccw); },
    ellipse(cx, cy, rx, ry, rot, a0, a1, ccw = false) {
      let d = a1 - a0;
      if (!ccw) { while (d < 0) d += TAU; if (d > TAU) d = TAU; } else { while (d > 0) d -= TAU; if (d < -TAU) d = -TAU; }
      const n = Math.max(8, Math.ceil(Math.abs(d) / TAU * 32)), cr = Math.cos(rot), sr = Math.sin(rot);
      for (let i = 0; i <= n; i++) {
        const a = a0 + (d * i) / n, px = Math.cos(a) * rx, py = Math.sin(a) * ry, x = cx + px * cr - py * sr, y = cy + px * sr + py * cr;
        if (i === 0 && !last()) { st.cur = { pts: [], closed: false }; st.subs.push(st.cur); }
        add(x, y); raw = [x, y];
      }
    },
    roundRect(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      st.cur = { pts: [], closed: true }; st.subs.push(st.cur);
      const c = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
      for (const [cx, cy, a0] of c) for (let i = 0; i <= 5; i++) { const a = a0 + (i / 5) * (Math.PI / 2); add(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    },
    createLinearGradient() { return { grad: true, addColorStop() {} }; },
    createRadialGradient() { return { grad: true, addColorStop() {} }; },
    fill() {
      if (st.clip) return;
      const fs = st.fillStyle;
      let kind = null;
      if (fs && fs.grad) kind = 'brass';
      else if (fs === '#3a2006' || fs === 'rgba(58,32,6,0.7)') kind = 'dark';
      if (!kind) return;
      for (const s of st.subs) if (s.pts.length >= 3) st.shapes.push({ pts: s.pts.map((p) => p.slice()), kind });
    },
    stroke() {
      if (st.clip) return;
      const ss = st.strokeStyle, lw = st.lineWidth * Math.hypot(st.m[0], st.m[1]);
      let kind = null;
      if (typeof ss === 'string' && ss.startsWith('rgba(58,32,6')) kind = 'groove';
      else if (ss && ss.grad && lw >= 0.06) kind = 'tube';
      else if (typeof ss === 'string' && ss.startsWith('#') && lw < 0.08 && lw >= 0.03) kind = 'limb';
      if (!kind) return;
      for (const s of st.subs) if (s.pts.length >= 2) st.strokes.push({ pts: s.pts.map((p) => p.slice()), w: lw, kind, closed: s.closed });
    },
    clip() { st.clip = true; },
    fillRect() {}, setLineDash() {}, measureText() { return { width: 0 }; }, fillText() {}, strokeText() {},
  };
  for (const k of ['fillStyle', 'strokeStyle', 'lineWidth']) Object.defineProperty(api, k, { get: () => st[k], set: (v) => { st[k] = v; } });
  for (const k of ['lineCap', 'lineJoin', 'globalAlpha', 'font', 'textAlign', 'textBaseline']) api[k] = '';
  return { ctx: api, st };
}

function tubeOf(points, radius, closed) {
  const pts = points.map(([x, y]) => new THREE.Vector3(x, -y, 0));
  const curve = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.2);
  const g = new THREE.TubeGeometry(curve, Math.max(8, pts.length * 3), radius, 8, closed);
  g.scale(1, 1, 1.35);
  return g;
}
function ribbon(points, w, z) {
  const pos = [], idx = []; let k = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[i + 1], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
    if (l < 1e-5) continue;
    const nx = (-dy / l) * (w / 2), ny = (dx / l) * (w / 2);
    pos.push(x0 + nx, -(y0 + ny), z, x0 - nx, -(y0 - ny), z, x1 - nx, -(y1 - ny), z, x1 + nx, -(y1 + ny), z);
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3); k += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0, 1);
  return g;
}
const figCache = new Map();
/** Geometry parts of one figure in unit figure space (x in about [-0.5,0.5], y up from the plate top). */
function figureParts(name) {
  if (figCache.has(name)) return figCache.get(name);
  const { ctx, st } = recorder();
  FIG[name](ctx);
  const parts = { brass: [], dark: [], grooves: [], limbs: [], tubes: [] };
  const D = 0.12;
  st.shapes.forEach((sh, i) => {
    const pts = sh.pts.filter((p, j, a) => j === 0 || Math.hypot(p[0] - a[j - 1][0], p[1] - a[j - 1][1]) > 1e-4);
    if (pts.length < 3) return;
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], -p[1])));
    let g;
    try { g = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.018, bevelSegments: 3, curveSegments: 4 }); } catch (e) { return; }
    g.translate(0, 0, -D / 2 + i * 0.004 + (sh.kind === 'dark' ? 0.02 : 0));
    (sh.kind === 'dark' ? parts.dark : parts.brass).push(g);
  });
  const zTop = D / 2 + st.shapes.length * 0.004 + 0.045;
  for (const s of st.strokes) {
    if (s.kind === 'groove') parts.grooves.push(ribbon(s.pts, Math.max(0.012, s.w), zTop));
    else if (s.kind === 'tube') { try { parts.tubes.push(tubeOf(s.pts, s.w / 2, s.closed || Math.hypot(s.pts[0][0] - s.pts[s.pts.length - 1][0], s.pts[0][1] - s.pts[s.pts.length - 1][1]) < 0.02)); } catch (e) { /* skip */ } }
    else if (s.kind === 'limb') { try { parts.limbs.push(tubeOf(s.pts, s.w / 2, false)); } catch (e) { /* skip */ } }
  }
  figCache.set(name, parts);
  return parts;
}

// ---------------------------------------------------------------- numerals cut into the plate
const numTex = new Map();
export function numeralTexture(value) {
  const key = String(value);
  let t = numTex.get(key);
  if (!t) {
    const W = 256, H = 96, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(30,14,2,0.42)'; x.beginPath(); x.roundRect(4, 4, W - 8, H - 8, 18); x.fill();
    x.strokeStyle = 'rgba(255,230,160,0.35)'; x.lineWidth = 3; x.beginPath(); x.roundRect(4, 4, W - 8, H - 8, 18); x.stroke();
    x.font = `400 ${H * 0.66}px "Dela Gothic One", "Arial Black", Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,240,190,0.55)'; x.fillText(key, W / 2 + 2, H / 2 + 4);
    x.fillStyle = '#2a1404'; x.fillText(key, W / 2, H / 2 + 2);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    numTex.set(key, t);
  }
  return t;
}
export const clearNumerals = () => { for (const t of numTex.values()) t.dispose(); numTex.clear(); };

// ---------------------------------------------------------------- one cast weight (unit plate width)
export function makeWeight(value, { numerals = true } = {}) {
  const g = new THREE.Group();
  const h = hash(value, 3);
  const plate = new THREE.Mesh(B.roundedBox(0.96, 0.3, 0.36, 0.06, 4), h < 0.33 ? M.brassOld() : M.brass());
  plate.position.y = 0.15; plate.castShadow = plate.receiveShadow = true; g.add(plate);
  // a lip around the plate top
  const lip = new THREE.Mesh(B.roundedBox(0.9, 0.035, 0.3, 0.02, 3), M.brassPol());
  lip.position.y = 0.3; lip.castShadow = true; g.add(lip);
  const parts = figureParts(figOf(value)), fig = new THREE.Group();
  const add = (geos, m) => { for (const geo of geos) { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; fig.add(mesh); } };
  add(parts.brass, M.brassPol()); add(parts.dark, M.dark()); add(parts.limbs, M.brassOld()); add(parts.tubes, M.brassPol());
  for (const geo of parts.grooves) { const m = new THREE.Mesh(geo, M.dark()); fig.add(m); }
  fig.position.set(0, 0.315, 0.0); fig.scale.setScalar(0.92);
  g.add(fig);
  if (numerals) {
    const np = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.2), new THREE.MeshBasicMaterial({ map: numeralTexture(value), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    np.position.set(0, 0.145, 0.181); np.renderOrder = 2; np.userData.numeral = true; g.add(np);
  }
  g.userData.kind = 'w';
  return g;
}

// ---------------------------------------------------------------- the leather dust bag (unit width)
const bagTex = new Map();
function bagLabel(amount) {
  const key = String(amount);
  let t = bagTex.get(key);
  if (!t) {
    if (bagTex.size > 120) { for (const v of bagTex.values()) v.dispose(); bagTex.clear(); }
    const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.clearRect(0, 0, W, H);
    x.fillStyle = '#c99a5c'; x.beginPath(); x.roundRect(6, 6, W - 12, H - 12, 22); x.fill();
    x.strokeStyle = '#4a2610'; x.lineWidth = 4; x.stroke();
    x.setLineDash([9, 8]); x.strokeStyle = 'rgba(255,238,200,0.85)'; x.lineWidth = 3; x.beginPath(); x.roundRect(16, 16, W - 32, H - 32, 14); x.stroke(); x.setLineDash([]);
    const fs = key.length > 3 ? 54 : 72;
    x.font = `400 ${fs}px "Dela Gothic One", "Arial Black", Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,245,215,0.7)'; x.fillText(key, W / 2 + 2, H / 2 + 5);
    x.fillStyle = '#2e1606'; x.fillText(key, W / 2, H / 2 + 3);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    bagTex.set(key, t);
  }
  return t;
}
export function makeBag() {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.22, 0.0], [0.36, 0.03], [0.46, 0.12], [0.5, 0.26], [0.49, 0.4], [0.42, 0.54], [0.3, 0.66], [0.17, 0.74], [0.15, 0.78], [0.2, 0.84], [0.25, 0.93]];
  const body = new THREE.Mesh(B.lathe(prof, 28), M.leather());
  body.scale.set(1, 1, 0.72); body.castShadow = body.receiveShadow = true; g.add(body);
  // darker flared mouth
  const mouth = new THREE.Mesh(B.lathe([[0.26, 0.93], [0.27, 0.95], [0.22, 0.96], [0.15, 0.9]], 24), M.leatherDark());
  mouth.scale.set(1, 1, 0.72); g.add(mouth);
  // gold heaped at the mouth (scaled by fill)
  const gold = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 10), M.gold());
  gold.scale.set(1, 0.4, 0.75); gold.position.y = 0.92; gold.userData.gold = true; g.add(gold);
  // drawstring ring and tassels
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 8, 24), M.brassPol());
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.76; ring.scale.set(1, 0.72, 1); g.add(ring);
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 0.16, 0.76, 0.1), new THREE.Vector3(sx * 0.26, 0.64, 0.14), new THREE.Vector3(sx * 0.27, 0.54, 0.12)]), 10, 0.016, 6), M.cord());
    g.add(t);
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), M.brassPol()); k.position.set(sx * 0.27, 0.52, 0.12); g.add(k);
  }
  // stitched seam
  const seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.47, 0.12, 0.0), new THREE.Vector3(0.52, 0.28, 0.0), new THREE.Vector3(0.44, 0.52, 0.0), new THREE.Vector3(0.28, 0.7, 0.0)]), 16, 0.012, 5), M.leatherDark());
  seam.scale.set(1, 1, 0.72); g.add(seam);
  // label patch carrying the amount
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.505, 0.505, 0.26, 20, 1, true, Math.PI / 2 - 0.62, 1.24), new THREE.MeshStandardMaterial({ map: bagLabel(0), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  lab.scale.set(1, 1, 0.72); lab.position.y = 0.3; lab.userData.label = true;
  // CylinderGeometry thetaStart measures from +z towards +x; the front of the bag is +z
  lab.geometry.dispose(); lab.geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.26, 20, 1, true, -0.62, 1.24);
  g.add(lab);
  g.userData.kind = 'bag'; g.userData.label = lab; g.userData.gold = gold;
  return g;
}
export function setBagState(bag, amount, fill) {
  const lab = bag.userData.label;
  if (lab.userData.amount !== amount) { lab.material.map = bagLabel(amount); lab.material.needsUpdate = true; lab.userData.amount = amount; }
  const k = Math.max(0, Math.min(1, fill));
  const gold = bag.userData.gold;
  gold.visible = amount > 0;
  gold.scale.set(0.9 + 0.35 * k, 0.28 + 0.4 * k, 0.65 + 0.2 * k);
  gold.position.y = 0.91 + 0.04 * k;
}

// ---------------------------------------------------------------- the balance (beam half length = 1)
function cyl(r0, r1, h, seg, m) { const g = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, seg), m); g.castShadow = g.receiveShadow = true; return g; }
export function makeBalance() {
  const root = new THREE.Group();
  const brass = M.brass(), pol = M.brassPol(), old = M.brassOld();
  // base: stepped plinth with a turned foot
  const base = new THREE.Mesh(B.lathe([[0, 0], [0.5, 0], [0.52, 0.02], [0.5, 0.05], [0.4, 0.07], [0.36, 0.1], [0.3, 0.12], [0.2, 0.14], [0.1, 0.16], [0.08, 0.18]], 40), brass);
  base.castShadow = base.receiveShadow = true; base.userData.base = true;
  base.scale.set(1, 1, 0.62);
  // pillar (unit height 1, scaled in y by the presenter): a tapered column with collars
  const pillar = new THREE.Group();
  const col = new THREE.Mesh(B.lathe([[0.07, 0], [0.065, 0.1], [0.045, 0.3], [0.04, 0.7], [0.055, 0.92], [0.075, 1]], 24), brass);
  col.castShadow = true; pillar.add(col);
  for (const y of [0.12, 0.5, 0.88]) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.014, 8, 22), pol); c.rotation.x = Math.PI / 2; c.position.y = y; pillar.add(c); }
  // fork at the top: two cheeks
  const crown = new THREE.Group();
  for (const sz of [-1, 1]) { const ch = new THREE.Mesh(B.roundedBox(0.11, 0.2, 0.025, 0.012, 3), pol); ch.position.set(0, 0, sz * 0.055); ch.castShadow = true; crown.add(ch); }
  const pin = cyl(0.026, 0.026, 0.2, 14, old); pin.rotation.x = Math.PI / 2; crown.add(pin);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), pol); finial.position.y = 0.12; crown.add(finial);
  // beam: a flat boat-shaped bar with a raised spine, finial bosses and hooks
  const beam = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(-1, 0); sh.quadraticCurveTo(-0.5, 0.075, 0, 0.1); sh.quadraticCurveTo(0.5, 0.075, 1, 0); sh.quadraticCurveTo(0.5, -0.075, 0, -0.1); sh.quadraticCurveTo(-0.5, -0.075, -1, 0);
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 14 });
  bg.translate(0, 0, -0.025);
  const bm = new THREE.Mesh(bg, brass); bm.castShadow = bm.receiveShadow = true; beam.add(bm);
  for (const sx of [-1, 1]) {
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), pol); boss.position.set(sx, 0, 0); boss.castShadow = true; beam.add(boss);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 14), old); hook.position.set(sx, -0.065, 0); beam.add(hook);
  }
  // punched dots (adinkra-style rows) along the beam
  const dotG = new THREE.CylinderGeometry(0.012, 0.012, 0.012, 10); dotG.rotateX(Math.PI / 2);
  for (let i = -3; i <= 3; i++) if (i) for (const sz of [-1, 1]) { const d = new THREE.Mesh(dotG, M.dark()); d.position.set(i * 0.24, 0.0, sz * 0.043); beam.add(d); }
  const hub = cyl(0.09, 0.09, 0.07, 24, pol); hub.rotation.x = Math.PI / 2; beam.add(hub);
  const hubIn = cyl(0.034, 0.034, 0.09, 12, M.dark()); hubIn.rotation.x = Math.PI / 2; beam.add(hubIn);
  // pointer needle (swings with the beam) and a scale arc on the pillar
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.001, 0.4, 8), M.dark()); needle.geometry.translate(0, -0.2, 0); needle.position.z = 0.065;
  const scale = new THREE.Group();
  {
    const sec = new THREE.Shape(); sec.moveTo(0, 0);
    const a0 = -Math.PI / 2 - 0.5, a1 = -Math.PI / 2 + 0.5;
    for (let i = 0; i <= 16; i++) { const a = a0 + (a1 - a0) * (i / 16); sec.lineTo(Math.cos(a) * 0.44, Math.sin(a) * 0.44); }
    sec.lineTo(0, 0);
    const pg = new THREE.ExtrudeGeometry(sec, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
    const plate = new THREE.Mesh(pg, M.brassOld()); plate.position.z = 0.02; plate.castShadow = true; scale.add(plate);
    for (let i = -5; i <= 5; i++) {
      const a = -Math.PI / 2 + i * 0.09, len = i % 5 === 0 ? 0.06 : 0.035;
      const tk = new THREE.Mesh(new THREE.BoxGeometry(0.008, len, 0.008), M.dark());
      tk.position.set(Math.cos(a) * (0.44 - len / 2 - 0.02), Math.sin(a) * (0.44 - len / 2 - 0.02), 0.04); tk.rotation.z = a + Math.PI / 2; scale.add(tk);
    }
  }
  root.add(base, pillar, crown, beam, needle, scale);
  root.userData = { base, pillar, crown, beam, needle, scale };
  return root;
}

/** A pan (dish radius 1, rim at y = 0). */
export function makePan() {
  const g = new THREE.Group();
  const prof = [[0, -0.2], [0.35, -0.19], [0.65, -0.14], [0.86, -0.07], [0.96, -0.02], [1.0, 0.0], [1.03, 0.02], [1.0, 0.045], [0.96, 0.02], [0.9, -0.03], [0.82, -0.075], [0.62, -0.115], [0.34, -0.14], [0, -0.15]];
  const dish = new THREE.Mesh(B.lathe(prof, 48), M.brass());
  dish.castShadow = dish.receiveShadow = true; dish.material.side = THREE.DoubleSide;
  dish.scale.set(1, 1, 1);
  g.add(dish);
  // three lugs where the chains hook on
  const lugs = [];
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * (0.5 + (i - 1) * 0.5) * 0 + (i - 1) * 1.05 + Math.PI / 2;   // front-left, back, front-right
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M.brassPol());
    l.position.set(Math.cos(a) * 1.0, 0.02, Math.sin(a) * 1.0); l.castShadow = true; g.add(l); lugs.push(l);
  }
  const foot = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 8, 28), M.brassOld());
  foot.rotation.x = Math.PI / 2; foot.position.y = -0.17; g.add(foot);
  g.userData.lugs = lugs;
  return g;
}

/** A thin chain/rope segment between two points (updated per frame). */
export function makeLink(material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6), material);
  m.castShadow = true;
  return m;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
export function placeLink(m, p0, p1, radius) {
  _a.set(p0[0], p0[1], p0[2]); _b.set(p1[0], p1[1], p1[2]);
  const d = _b.clone().sub(_a), len = d.length() || 1e-3;
  m.position.copy(_a).addScaledVector(d, 0.5);
  _q.setFromUnitVectors(_up, d.normalize()); m.quaternion.copy(_q);
  m.scale.set(radius, len, radius);
}

/** The spouted ladle used for the pour (unit = ladle bowl width 1). Handle points to +x (up and away). */
export function makeLadle() {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(B.lathe([[0, -0.2], [0.18, -0.19], [0.32, -0.12], [0.42, 0.0], [0.45, 0.02], [0.4, 0.02], [0.3, -0.07], [0.15, -0.14], [0, -0.15]], 28), M.brass());
  bowl.material.side = THREE.DoubleSide; bowl.castShadow = true; g.add(bowl);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.38, 0, 0), new THREE.Vector3(0.9, 0.18, 0), new THREE.Vector3(1.5, 0.52, 0), new THREE.Vector3(2.0, 0.62, 0)]), 20, 0.04, 8), M.wood());
  handle.castShadow = true; g.add(handle);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.brassPol()); cap.position.set(2.0, 0.62, 0); g.add(cap);
  const gold = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 8), M.gold()); gold.scale.set(1, 0.22, 1); gold.position.y = -0.02; gold.userData.gold = true; g.add(gold);
  g.userData.gold = gold;
  return g;
}

// ---------------------------------------------------------------- environment textures (kente-inspired woven cloth, generic)
export function kenteCanvas(w = 1024, h = 1024, seed = 4, mood = 'dusk') {
  const src = document.createElement('canvas'); src.width = w; src.height = h;
  const x = src.getContext('2d'), r = rng(seed);
  const pal = mood === 'ember' ? ['#5a1608', '#a8420f', '#d99a1c', '#2a0e06', '#8c2a10'] : mood === 'sand' ? ['#7a4a1c', '#c98a2e', '#e8c15a', '#3a2410', '#8a5a2a'] : ['#2b1a52', '#6a1c34', '#c8921e', '#10303a', '#4a2a70'];
  x.fillStyle = pal[3]; x.fillRect(0, 0, w, h);
  // vertical woven strips of different widths, each with a small repeating motif
  let px = 0;
  while (px < w) {
    const sw = 80 + Math.floor(r() * 120), base = pal[Math.floor(r() * pal.length)];
    x.fillStyle = base; x.fillRect(px, 0, sw, h);
    const motif = Math.floor(r() * 3), step = 56;
    for (let y = 0; y < h; y += step) {
      x.fillStyle = pal[(Math.floor(y / step) + Math.floor(px / 7)) % pal.length];
      if (motif === 0) { x.fillRect(px + 8, y + 10, sw - 16, step * 0.36); }
      else if (motif === 1) { x.beginPath(); x.moveTo(px + sw / 2, y + 8); x.lineTo(px + sw - 12, y + step / 2); x.lineTo(px + sw / 2, y + step - 8); x.lineTo(px + 12, y + step / 2); x.closePath(); x.fill(); }
      else { for (let q = 0; q < 3; q++) x.fillRect(px + 8 + q * (sw - 16) / 3, y + 8, (sw - 16) / 3 - 4, step - 16); }
    }
    x.fillStyle = 'rgba(255,214,120,0.7)'; x.fillRect(px, 0, 3, h); x.fillRect(px + sw - 3, 0, 3, h);
    px += sw;
  }
  for (let i = 0; i < 4000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; x.fillRect(r() * w, r() * h, 1 + r() * 18, 1); }
  // out of focus and dim: the cloth is a backdrop, the brass balance is the subject
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const y = c.getContext('2d');
  y.filter = 'blur(7px)'; y.drawImage(src, -10, -10, w + 20, h + 20); y.filter = 'none';
  y.fillStyle = 'rgba(8,4,16,0.5)'; y.fillRect(0, 0, w, h);
  const vg = y.createRadialGradient(w / 2, h * 0.42, h * 0.1, w / 2, h * 0.5, h * 0.75);
  vg.addColorStop(0, 'rgba(255,170,80,0.16)'); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(4,2,10,0.7)');
  y.fillStyle = vg; y.fillRect(0, 0, w, h);
  const tg = y.createLinearGradient(0, 0, 0, h); tg.addColorStop(0, 'rgba(4,2,10,0.55)'); tg.addColorStop(0.18, 'rgba(4,2,10,0)'); tg.addColorStop(0.82, 'rgba(4,2,10,0)'); tg.addColorStop(1, 'rgba(4,2,10,0.55)');
  y.fillStyle = tg; y.fillRect(0, 0, w, h);
  return c;
}
export function runnerCanvas(seed = 9) {
  // a horizontal woven table runner: dark ground, gold, deep green and maroon threads
  const w = 1024, h = 256, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), r = rng(seed);
  const pal = ['#c8921e', '#1c5a38', '#8a2018', '#16110e', '#e8c868'];
  x.fillStyle = '#16110e'; x.fillRect(0, 0, w, h);
  let py = 0;
  while (py < h) {
    const bh = 14 + Math.floor(r() * 26), col = pal[Math.floor(r() * pal.length)];
    x.fillStyle = col; x.fillRect(0, py, w, bh);
    for (let px = 0; px < w; px += 36) { x.fillStyle = pal[(px / 36 + Math.floor(py / 9)) % pal.length]; x.fillRect(px + 6, py + 3, 20, bh - 6); }
    py += bh;
  }
  for (let i = 0; i < 3000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * w, r() * h, 1, 1 + r() * 12); }
  x.fillStyle = 'rgba(10,6,4,0.22)'; x.fillRect(0, 0, w, h);
  return c;
}
export function glowCanvas(rgb = '255,200,110', size = 128, a = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.35, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
}
export function sparkCanvas(size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), m = size / 2;
  const g = x.createRadialGradient(m, m, 0, m, m, m); g.addColorStop(0, 'rgba(255,252,225,1)'); g.addColorStop(0.2, 'rgba(255,230,140,0.7)'); g.addColorStop(1, 'rgba(255,200,80,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  x.strokeStyle = 'rgba(255,250,220,0.9)'; x.lineWidth = 2; x.beginPath(); x.moveTo(m, 2); x.lineTo(m, size - 2); x.moveTo(2, m); x.lineTo(size - 2, m); x.stroke();
  return c;
}
