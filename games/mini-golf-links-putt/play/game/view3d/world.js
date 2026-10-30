// Mini Golf 3D world: textures, the hole builder (felt, plinth rail, walls, islands, bumpers, bridges, water, tunnels, mills, gates,
// cup, flag) and the scenery around it. Pure construction, no game state. Hole units are 1 world unit; the hole group sits with its
// centre on the world origin; y is up. A hole's (x, y) becomes world (x - cx, 0, y - cy) (turned a quarter for landscape by the presenter).
import * as THREE from '../vendor3d/three.js';
import { inPoly, BR, CUP_R, WALL_RAD } from '../src/sim.js';

export const RAIL_W = 0.78, RAIL_H = 1.05, TAU = Math.PI * 2;
export const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const strHash = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// ---------------------------------------------------------------- textures (canvas, cached per renderer lifetime)
const texCache = new Map();
function canvasTex(key, size, draw, repeat = 1) {
  let t = texCache.get(key); if (t) return t;
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4;
  texCache.set(key, t); return t;
}
export const disposeTextures = () => { for (const t of texCache.values()) t.dispose(); texCache.clear(); };
const woodTex = () => canvasTex('wood', 256, (g, n) => {
  g.fillStyle = '#b4793a'; g.fillRect(0, 0, n, n); const r = rng(7);
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${r() < 0.5 ? '70,38,10' : '230,170,100'},${0.1 + r() * 0.16})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const y = r() * n; g.moveTo(0, y); g.bezierCurveTo(n * 0.3, y + (r() - 0.5) * 14, n * 0.7, y + (r() - 0.5) * 14, n, y + (r() - 0.5) * 8); g.stroke(); }
  for (let i = 0; i < 4; i++) { g.strokeStyle = 'rgba(50,25,5,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(i * 64 + 1, 0); g.lineTo(i * 64 + 1, n); g.stroke(); }
}, 0.22);
const stoneTex = () => canvasTex('stone', 256, (g, n) => {
  g.fillStyle = '#a3a9ad'; g.fillRect(0, 0, n, n); const r = rng(11);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(30,40,50,0.09)'; g.fillRect(r() * n, r() * n, 2 + r() * 6, 2 + r() * 5); }
  g.strokeStyle = 'rgba(40,48,56,0.55)'; g.lineWidth = 2;
  for (let y = 0; y < n; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(n, y); g.stroke(); for (let x = ((y / 64) % 2) * 64; x < n; x += 128) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); } }
}, 0.2);
const hedgeTex = () => canvasTex('hedge', 256, (g, n) => {
  g.fillStyle = '#2b6e35'; g.fillRect(0, 0, n, n); const r = rng(5);
  for (let i = 0; i < 1400; i++) { const l = r(); g.fillStyle = l < 0.4 ? 'rgba(10,50,20,0.55)' : l < 0.8 ? 'rgba(90,190,100,0.55)' : 'rgba(180,235,150,0.45)'; g.beginPath(); g.arc(r() * n, r() * n, 2 + r() * 4, 0, TAU); g.fill(); }
}, 0.3);
const stripeTex = () => canvasTex('gate', 128, (g, n) => {
  g.fillStyle = '#f3efe0'; g.fillRect(0, 0, n, n); g.fillStyle = '#d2392b';
  for (let x = 0; x < n; x += 32) g.fillRect(x, 0, 16, n);
}, 1);
const rippleTex = () => canvasTex('ripple', 256, (g, n) => {
  g.clearRect(0, 0, n, n); g.lineCap = 'round'; const r = rng(3);
  for (let i = 0; i < 26; i++) { const x = r() * n, y = r() * n, w = 20 + r() * 40; g.strokeStyle = `rgba(255,255,255,${0.18 + r() * 0.3})`; g.lineWidth = 1.5 + r() * 1.5; g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x, y - 5, x + w, y); g.stroke(); }
}, 1);
const sparkleTex = () => canvasTex('sparkle', 128, (g, n) => { const r = rng(9); for (let i = 0; i < 24; i++) { g.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`; g.beginPath(); g.arc(r() * n, r() * n, 1 + r() * 1.6, 0, TAU); g.fill(); } }, 1);
const ballTex = (dot) => canvasTex('ball' + dot, 128, (g, n) => { g.fillStyle = '#fff'; g.fillRect(0, 0, n, n); g.fillStyle = dot; g.beginPath(); g.arc(n * 0.5, n * 0.5, n * 0.1, 0, TAU); g.fill(); g.fillRect(0, n * 0.46, n, n * 0.08); }, 1);
function groundTex(kind) {
  return canvasTex('ground' + kind, 512, (g, n) => {
    const base = { heather: '#35703a', harbour: '#1c6f9f', mill: '#b8a23c' }[kind]; g.fillStyle = base; g.fillRect(0, 0, n, n); const r = rng(21);
    const cols = { heather: ['#2c5e33', '#437f47', '#6b5a90'], harbour: ['#175f8c', '#2a86b8', '#4aa6cf'], mill: ['#a08b2e', '#cdb650', '#8d9a3a'] }[kind];
    for (let i = 0; i < 2200; i++) { g.fillStyle = cols[(r() * cols.length) | 0] + '55'; g.beginPath(); g.arc(r() * n, r() * n, 2 + r() * 9, 0, TAU); g.fill(); }
    if (kind === 'mill') { g.strokeStyle = 'rgba(120,95,20,0.35)'; g.lineWidth = 2; for (let x = 0; x < n; x += 11) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 3, n); g.stroke(); } }
  }, 46);
}

// ---------------------------------------------------------------- materials
export function makeMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    timber: std({ map: woodTex(), roughness: 0.62, metalness: 0 }),
    quay: std({ map: stoneTex(), color: 0xc9a77a, roughness: 0.9 }),
    stone: std({ map: stoneTex(), roughness: 0.82, metalness: 0 }),
    hedge: std({ map: hedgeTex(), roughness: 1, metalness: 0 }),
    rubber: std({ color: 0xd9453a, roughness: 0.4, metalness: 0 }),
    white: std({ color: 0xf3efe0, roughness: 0.5 }),
    brass: std({ color: 0xe9cf7c, roughness: 0.3, metalness: 0.8 }),
    dark: std({ color: 0x050a08, roughness: 1 }),
    gate: std({ map: stripeTex(), roughness: 0.55 }),
    sail: std({ color: 0xf3ead2, roughness: 0.95, side: THREE.DoubleSide }),
    plank: std({ color: 0xa5703a, roughness: 0.75 }),
    pole: std({ color: 0xf2f2ec, roughness: 0.4, transparent: true }),
    ripple: new THREE.MeshBasicMaterial({ map: rippleTex(), transparent: true, opacity: 0.55, depthWrite: false }),
    sparkle: new THREE.MeshBasicMaterial({ map: sparkleTex(), transparent: true, opacity: 0.9, depthWrite: false }),
  };
}

// ---------------------------------------------------------------- geometry helpers
// polygon (array of [x, y]) offset outward by d with mitre joins; outward is decided by the signed area
export function offsetPoly(pts, d) {
  const n = pts.length; let A = 0;
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; A += p[0] * q[1] - q[0] * p[1]; }
  const sgn = A > 0 ? 1 : -1, out = [];
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [sgn * dy / l, -sgn * dx / l]; };
  for (let i = 0; i < n; i++) {
    const a = nrm(pts[(i + n - 1) % n], pts[i]), b = nrm(pts[i], pts[(i + 1) % n]);
    let mx = a[0] + b[0], my = a[1] + b[1]; const l = Math.hypot(mx, my) || 1; mx /= l; my /= l;
    const m = 1 / Math.max(0.35, mx * a[0] + my * a[1]);
    out.push([pts[i][0] + mx * d * m, pts[i][1] + my * d * m]);
  }
  return out;
}
const shapeOf = (pts) => { const s = new THREE.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], -p[1]) : s.moveTo(p[0], -p[1]))); s.closePath(); return s; };
const pathOf = (pts) => { const s = new THREE.Path(); pts.forEach((p, i) => (i ? s.lineTo(p[0], -p[1]) : s.moveTo(p[0], -p[1]))); s.closePath(); return s; };
// extrude a shape from y0 up to y1 (hole y -> world z)
function extrudeY(shape, y0, y1, bevel = 0.07) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, y1 - y0 - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, y0 + bevel); g.rotateX(-Math.PI / 2); return g;
}
// a flat mesh geometry in the ground plane (y = 0) from a 2D shape, with UVs mapped over a rectangle
function flatGeo(shape, rect, tile = 0) {
  const g = new THREE.ShapeGeometry(shape, 12), p = g.attributes.position, uv = g.attributes.uv, nm = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = -p.getY(i);
    p.setXYZ(i, x, 0, y); nm.setXYZ(i, 0, 1, 0);
    if (tile) uv.setXY(i, x / tile, y / tile); else uv.setXY(i, (x - rect.x0) / rect.w, 1 - (y - rect.y0) / rect.h);
  }
  return g;
}
function zoneShape(z) {
  const s = new THREE.Shape();
  if (z.shape === 'circle') s.absarc(z.x, -z.y, z.r, 0, TAU, false);
  else if (z.shape === 'poly') z.pts.forEach((p, i) => (i ? s.lineTo(p[0], -p[1]) : s.moveTo(p[0], -p[1])));
  else { s.moveTo(z.x, -z.y); s.lineTo(z.x + z.w, -z.y); s.lineTo(z.x + z.w, -(z.y + z.h)); s.lineTo(z.x, -(z.y + z.h)); }
  s.closePath(); return s;
}

// ---------------------------------------------------------------- the hole
// ctxPaint(ctx) draws the flat ground art in hole units. Returns { group, update(want, dt), dispose }.
export function buildHole({ def, h, theme, feel, mats, paint, texSize, quality }) {
  const group = new THREE.Group(), dispose = [];
  const own = (o) => { dispose.push(o); return o; };
  const b = h.box, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const root = new THREE.Group(); root.position.set(-cx, 0, -cy); group.add(root);
  const add = (m, parent = root) => { parent.add(m); return m; };
  const mesh = (geo, mat, o = {}) => { const m = new THREE.Mesh(own(geo), mat); m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false; return m; };

  // ---- ground painting (felt, sand, water, slopes, boosts, bridges, tee, cup)
  const rect = { x0: b.x0 - 1, y0: b.y0 - 1, w: b.x1 - b.x0 + 2, h: b.y1 - b.y0 + 2 };
  const ppu = Math.min(80, texSize / Math.max(rect.w, rect.h));
  const cv = document.createElement('canvas'); cv.width = Math.ceil(rect.w * ppu); cv.height = Math.ceil(rect.h * ppu);
  const g2 = cv.getContext('2d'); g2.setTransform(cv.width / rect.w, 0, 0, cv.height / rect.h, -rect.x0 * cv.width / rect.w, -rect.y0 * cv.height / rect.h);
  paint(g2);
  const gtex = own(new THREE.CanvasTexture(cv)); gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = 8;
  const felt = shapeOf(def.outer); for (const isl of def.islands ?? []) felt.holes.push(pathOf(isl.pts));
  const fm = new THREE.Mesh(own(flatGeo(felt, rect)), new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
  fm.receiveShadow = true; add(fm);

  // ---- outer rail: a plinth ring that rises from below the table to the rail top, mitred outward by RAIL_W
  const railMat = mats[def.railMat ?? 'timber'] ?? mats.timber;
  const outerOff = offsetPoly(def.outer, RAIL_W);
  const ring = shapeOf(outerOff); ring.holes.push(pathOf(def.outer));
  add(mesh(extrudeY(ring, -0.45, RAIL_H, 0.08), railMat));
  // brass studs on the sharp corners
  const studG = own(new THREE.SphereGeometry(0.15, 10, 8));
  for (let i = 0; i < def.outer.length; i++) {
    const p = def.outer[i], q = def.outer[(i + 1) % def.outer.length], pr = def.outer[(i + def.outer.length - 1) % def.outer.length];
    const a1 = Math.atan2(p[1] - pr[1], p[0] - pr[0]), a2 = Math.atan2(q[1] - p[1], q[0] - p[0]);
    if (Math.abs(Math.sin(a2 - a1)) > 0.3) { const o = outerOff[i]; const s = new THREE.Mesh(studG, mats.brass); s.position.set(o[0], RAIL_H + 0.02, o[1]); s.castShadow = true; add(s); }
  }

  // ---- islands (solid blocks) and free walls
  for (const isl of def.islands ?? []) {
    const m = mats[isl.mat ?? 'stone'] ?? mats.stone;
    add(mesh(extrudeY(shapeOf(isl.pts), -0.2, RAIL_H, 0.07), m));
    if (def.id === 'harbour-3') {   // the lighthouse rock
      const c = isl.pts.reduce((a, p) => [a[0] + p[0] / isl.pts.length, a[1] + p[1] / isl.pts.length], [0, 0]);
      const tw = mesh(new THREE.CylinderGeometry(0.85, 1.35, 2.6, 16), mats.white); tw.position.set(c[0], RAIL_H + 1.3, c[1]); add(tw);
      const band = mesh(new THREE.CylinderGeometry(1.02, 1.12, 0.55, 16), mats.rubber); band.position.set(c[0], RAIL_H + 1.1, c[1]); add(band);
      const lamp = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.55, 12), new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffd45a, emissiveIntensity: 1.1 })); lamp.position.set(c[0], RAIL_H + 2.9, c[1]); add(lamp);
      const cap = mesh(new THREE.CylinderGeometry(0, 0.85, 0.7, 12), mats.rubber); cap.position.set(c[0], RAIL_H + 3.5, c[1]); add(cap);
    }
  }
  const wallH = 0.85, capG = own(new THREE.CylinderGeometry(WALL_RAD, WALL_RAD, wallH, 12));
  for (const w of def.walls ?? []) {
    const m = mats[w.mat ?? 'timber'] ?? mats.timber, n = w.closed ? w.pts.length : w.pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = w.pts[i], c = w.pts[(i + 1) % w.pts.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const bx = mesh(new THREE.BoxGeometry(L, wallH, WALL_RAD * 2), m); bx.position.set((a[0] + c[0]) / 2, wallH / 2, (a[1] + c[1]) / 2); bx.rotation.y = -Math.atan2(c[1] - a[1], c[0] - a[0]); add(bx);
    }
    for (const p of w.pts) { const cp = new THREE.Mesh(capG, m); cp.position.set(p[0], wallH / 2, p[1]); cp.castShadow = true; cp.receiveShadow = true; add(cp); }
  }
  for (const p of def.posts ?? []) { const m = mesh(new THREE.CylinderGeometry(p.r, p.r * 1.1, 0.8, 16), mats[p.mat ?? 'stone'] ?? mats.stone); m.position.set(p.x, 0.4, p.y); add(m); }

  // ---- bumpers (animated), bridges, water shimmer, tunnels, cup, flag
  const bumpers = [];
  let bi = 0;
  for (const c of h.circles) {
    if (c.kind !== 'bumper') continue;
    const grp = new THREE.Group(); grp.position.set(c.x, 0, c.y);
    const base = mesh(new THREE.CylinderGeometry(c.r + 0.22, c.r + 0.3, 0.14, 24), mats.white); base.position.y = 0.07; grp.add(base);
    const body = mesh(new THREE.CylinderGeometry(c.r * 0.92, c.r, 0.62, 24), mats.rubber); body.position.y = 0.45; grp.add(body);
    const rim = mesh(new THREE.TorusGeometry(c.r * 0.7, 0.07, 8, 28), mats.white); rim.rotation.x = Math.PI / 2; rim.position.y = 0.77; grp.add(rim);
    add(grp); bumpers.push({ grp, i: bi++ });
  }
  for (const z of h.bridges) {
    const zb = [z.x, z.y, z.x + z.w, z.y + z.h];
    const bx = mesh(new THREE.BoxGeometry(zb[2] - zb[0], 0.2, zb[3] - zb[1]), mats.plank); bx.position.set((zb[0] + zb[2]) / 2, 0.02, (zb[1] + zb[3]) / 2); add(bx);
    const wide = (zb[2] - zb[0]) >= (zb[3] - zb[1]);
    for (const sgn of [-1, 1]) {
      const rl = mesh(new THREE.BoxGeometry(wide ? zb[2] - zb[0] : 0.16, 0.34, wide ? 0.16 : zb[3] - zb[1]), mats.timber);
      rl.position.set(wide ? (zb[0] + zb[2]) / 2 : (sgn < 0 ? zb[0] : zb[2]), 0.2, wide ? (sgn < 0 ? zb[1] : zb[3]) : (zb[1] + zb[3]) / 2); add(rl);
    }
  }
  const ripples = [];
  for (const z of h.water) {
    const wz = z.shape === 'rect' || !z.shape ? { x0: z.x, y0: z.y } : null; void wz;
    for (const mat of [mats.ripple, mats.sparkle]) { const r = new THREE.Mesh(own(flatGeo(zoneShape(z), rect, mat === mats.ripple ? 7 : 9)), mat); r.position.y = 0.03; r.renderOrder = 2; add(r); ripples.push(r); }
  }
  h.tunnels.forEach((tn, i) => {
    const col = [0x2fd0b5, 0xffb347][i % 2];
    for (const e of [tn.a, tn.b]) {
      const r = tn.r ?? 0.8, grp = new THREE.Group(); grp.position.set(e.x, 0, e.y);
      const mound = mesh(new THREE.CylinderGeometry(r + 0.3, r + 0.5, 0.42, 28), mats.stone); mound.position.y = 0.21; grp.add(mound);
      const ring = mesh(new THREE.TorusGeometry(r + 0.18, 0.09, 8, 28), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.43; grp.add(ring);
      const hole = new THREE.Mesh(own(new THREE.CircleGeometry(r, 28)), mats.dark); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.44; grp.add(hole);
      const arrow = mesh(new THREE.CylinderGeometry(0, r * 0.4, r * 0.7, 3), new THREE.MeshBasicMaterial({ color: col })); arrow.rotation.x = Math.PI / 2; arrow.rotation.y = 0; arrow.position.y = 0.46;
      const ag = new THREE.Group(); ag.rotation.y = -e.dir; arrow.position.set(r * 0.4, 0.46, 0); arrow.rotation.set(0, 0, -Math.PI / 2); arrow.rotation.order = 'YXZ'; ag.add(arrow); grp.add(ag);
      add(grp);
    }
  });
  const cup = def.cup;
  const rim = mesh(new THREE.TorusGeometry(CUP_R + 0.04, 0.06, 8, 32), new THREE.MeshStandardMaterial({ color: 0xdfe5d8, roughness: 0.3, metalness: 0.7 }), { cast: false }); rim.rotation.x = Math.PI / 2; rim.position.set(cup.x, 0.02, cup.y); add(rim);
  const flag = new THREE.Group(); flag.position.set(cup.x, 0, cup.y);
  const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.1, 8), mats.pole); pole.position.y = 1.55; flag.add(pole);
  const fMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.flag), roughness: 0.6, side: THREE.DoubleSide, transparent: true });
  const fg = own(new THREE.PlaneGeometry(1.5, 0.95, 8, 2)); const fm2 = new THREE.Mesh(fg, fMat); fm2.castShadow = true; fm2.position.set(0.75, 2.62, 0); flag.add(fm2);
  const fbase = fg.attributes.position.array.slice();
  const cap = mesh(new THREE.SphereGeometry(0.1, 8, 6), mats.brass); cap.position.y = 3.1; flag.add(cap);
  add(flag);

  // ---- mills and gates (moved every frame from the same function the simulation uses)
  const movers = { blades: [], gates: [], pivot: [] };
  for (const m of h.mills) {
    const hub = mesh(new THREE.CylinderGeometry((m.hub ?? 0.45) * 0.9, (m.hub ?? 0.45) * 1.25, 1.0, 16), mats.stone); hub.position.set(m.x, 0.5, m.y); add(hub);
    const roof = mesh(new THREE.CylinderGeometry(0, (m.hub ?? 0.45) * 1.35, 0.75, 16), mats.rubber); roof.position.set(m.x, 1.35, m.y); add(roof);
    for (let i = 0; i < (m.n ?? 4); i++) {
      const arm = new THREE.Group(); arm.userData.len = m.len;
      const beam = mesh(new THREE.BoxGeometry(1, 0.2, 0.26), mats.timber); beam.position.x = 0.5; arm.add(beam);
      const sail = mesh(new THREE.BoxGeometry(1, 0.05, 0.85), mats.sail); sail.position.set(0.5, 0.0, 0.5); sail.userData.sail = true; arm.add(sail);
      arm.userData.beam = beam; arm.userData.sail = sail; add(arm); movers.blades.push(arm);
    }
  }
  for (const gt of h.gates) { const bx = mesh(new THREE.BoxGeometry(1, 0.5, (gt.thick ?? 0.2) * 2), mats.gate); add(bx); movers.gates.push(bx); }

  // ---- scenery around the course
  const scen = scenery({ def, h, feel, mats, quality, cx, cy, add, own });
  const flagBase = fbase;
  const _caps = { caps: [], discs: [] };
  return {
    group, flagFade: [pole.material, fMat],
    update(want, moversAt, t) {
      const clock = want.clock;
      // bumpers pulse after a hit
      for (const bp of bumpers) { const k = Math.max(0, 1 - ((want.bump?.[bp.i] ?? 9) * 4)); bp.grp.scale.set(1 + 0.12 * k, 1 + 0.2 * k, 1 + 0.12 * k); }
      if (movers.blades.length || movers.gates.length) {
        moversAt(h, clock, _caps);
        let bi2 = 0, gi = 0;
        for (const c of _caps.caps) {
          const dx = c.bx - c.ax, dy = c.by - c.ay, L = Math.hypot(dx, dy) || 1e-6;
          if (c.kind === 'blade') {
            const arm = movers.blades[bi2++]; if (!arm) continue;
            arm.position.set(c.ax, 0.8, c.ay); arm.rotation.y = -Math.atan2(dy, dx);
            arm.userData.beam.scale.x = L; arm.userData.beam.position.x = L / 2;
            arm.userData.sail.scale.x = Math.max(0.1, L - 0.95); arm.userData.sail.position.x = 0.8 + (L - 0.95) / 2; arm.userData.sail.position.z = 0.5;
          } else {
            const bx = movers.gates[gi++]; if (!bx) continue;
            bx.position.set((c.ax + c.bx) / 2, 0.3, (c.ay + c.by) / 2); bx.rotation.y = -Math.atan2(dy, dx); bx.scale.x = L + 0.2; bx.material.map.repeat.x = Math.max(1, Math.round(L * 1.2) / 2);
          }
        }
      }
      // flag and water motion
      const pos = fg.attributes.position;
      for (let i = 0; i < pos.count; i++) { const x0 = flagBase[i * 3], y0 = flagBase[i * 3 + 1], f = (x0 + 0.75) / 1.5; pos.setZ(i, Math.sin(t * 5 - f * 4) * 0.12 * f + Math.sin(t * 2.1) * 0.03 * f); pos.setY(i, y0 - f * 0.1 * Math.sin(t * 5 - f * 3)); }
      pos.needsUpdate = true;
      for (const r of ripples) { const mp = r.material.map; mp.offset.set((t * (r.material === mats.ripple ? 0.035 : -0.02)) % 1, (t * 0.02) % 1); }
      scen.update(t);
    },
    dispose() { dispose.forEach((o) => o.dispose?.()); scen.dispose(); },
    span: Math.max(b.x1 - b.x0, b.y1 - b.y0),
    gtex,
  };
}

// ---------------------------------------------------------------- scenery
function scenery({ def, h, feel, mats, quality, cx, cy, add, own }) {
  const b = h.box, r = rng(strHash(def.id));
  const keep = offsetPoly(def.outer, RAIL_W + (feel === 'harbour' ? 2.6 : 1.4));
  const x0 = b.x0 - 34, x1 = b.x1 + 34, y0 = b.y0 - 40, y1 = b.y1 + 40;
  const keepBig = offsetPoly(def.outer, RAIL_W + 4.2), quayIn = offsetPoly(def.outer, RAIL_W + 0.35), quayOut = offsetPoly(def.outer, RAIL_W + 2.1);
  const free = (x, y, pad = 0) => !inPoly(keep, x, y) && (pad === 0 || !inPoly(keepBig, x, y));
  const scale = quality === 'low' ? 0.55 : 1;
  const items = [];
  const dispose = [];
  const inst = (geo, mat, count, place, quayMode = false) => {
    count = Math.round(count * scale);
    const m = new THREE.InstancedMesh(geo, mat, count); dispose.push(geo, m); const q = new THREE.Object3D(), col = new THREE.Color();
    let n = 0;
    for (let tries = 0; n < count && tries < count * 25; tries++) {
      const x = quayMode ? b.x0 - 3.2 + r() * (b.x1 - b.x0 + 6.4) : x0 + r() * (x1 - x0), y = quayMode ? b.y0 - 3.2 + r() * (b.y1 - b.y0 + 6.4) : y0 + r() * (y1 - y0);
      if (quayMode ? !(inPoly(quayOut, x, y) && !inPoly(quayIn, x, y)) : !free(x, y)) continue;
      q.position.set(x, 0, y); q.rotation.set(0, r() * TAU, 0); q.scale.set(1, 1, 1);
      const c = place(q, r, x, y); if (c === false) continue;
      q.updateMatrix(); m.setMatrixAt(n, q.matrix); if (c) { col.set(c); m.setColorAt(n, col); } n++;
    }
    m.count = n; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; add(m); items.push(m);
    return m;
  };
  const sph = (s, a = 8, b2 = 6) => new THREE.SphereGeometry(s, a, b2);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o });
  if (feel === 'heather') {
    inst(sph(1, 10, 7), std({ color: 0xffffff }), 150, (q, rr) => { const s = 0.7 + rr() * 1.3; q.scale.set(s, s * 0.6, s); q.position.y = s * 0.2; return ['#6a4a92', '#8a68b0', '#3f6b3a', '#4f8a47'][(rr() * 4) | 0]; });
    inst(sph(1, 7, 5), std({ color: 0xffffff }), 36, (q, rr) => { const s = 0.5 + rr() * 1.2; q.scale.set(s, s * 0.7, s); q.position.y = s * 0.2; return '#9aa0a2'; });
    inst(new THREE.CylinderGeometry(0.0, 1.5, 4.2, 8), std({ color: 0xffffff }), 30, (q, rr, x, y) => { if (!free(x, y, 3)) return false; q.position.y = 2.1; const s = 0.8 + rr() * 0.8; q.scale.set(s, s, s); return '#245d32'; });
    inst(sph(0.12, 5, 4), std({ color: 0xffffff }), 320, (q, rr) => { q.position.y = 0.15; return ['#f4a8d0', '#fff1a0', '#ffffff', '#c8a8ff'][(rr() * 4) | 0]; });
  } else if (feel === 'harbour') {
    // paved quay around the course, bollards, crates, barrels, buoys on the water
    const quay = shapeOf(offsetPoly(def.outer, RAIL_W + 2.4)); quay.holes.push(pathOf(offsetPoly(def.outer, RAIL_W - 0.01)));
    const qm = new THREE.Mesh(own(extrudeY(quay, -0.4, 0.14, 0.05)), mats.quay); qm.receiveShadow = true; qm.castShadow = true; add(qm);
    inst(new THREE.CylinderGeometry(0.22, 0.28, 0.55, 10), std({ color: 0x2f3b45 }), 26, (q) => { q.position.y = 0.4; }, true);
    inst(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 12), std({ color: 0xffffff }), 16, (q, rr) => { q.position.y = 0.4; return ['#8c5a2e', '#6e4a2a', '#2a4a68'][(rr() * 3) | 0]; }, true);
    inst(new THREE.BoxGeometry(0.5, 0.5, 0.5), std({ color: 0xffffff }), 14, (q, rr) => { q.position.y = 0.38; return ['#c09050', '#a87a40', '#d5ad70'][(rr() * 3) | 0]; }, true);
    inst(sph(0.5, 10, 8), std({ color: 0xffffff }), 30, (q, rr) => { q.position.y = -0.2; return rr() < 0.5 ? '#e5483a' : '#f5f0e0'; });
  } else {
    // wheat field, hay bales, fence posts, trees
    inst(new THREE.CylinderGeometry(0.02, 0.1, 1.5, 4), std({ color: 0xffffff }), 700, (q, rr) => { const s = 0.7 + rr() * 0.7; q.scale.set(1, s, 1); q.position.y = 0.7 * s; q.rotation.z = (rr() - 0.5) * 0.3; return ['#d8b93e', '#c9a52e', '#e5c95a', '#bda02c'][(rr() * 4) | 0]; });
    inst(new THREE.CylinderGeometry(0.8, 0.8, 1.1, 14), std({ color: 0xffffff }), 14, (q, rr, x, y) => { if (!free(x, y, 2.5)) return false; q.rotation.set(Math.PI / 2, 0, r() * TAU); q.position.y = 0.8; return '#d4b050'; });
    inst(new THREE.BoxGeometry(0.22, 1.3, 0.22), std({ color: 0x7a5530 }), 60, (q) => { q.position.y = 0.65; });
    inst(sph(1, 9, 7), std({ color: 0xffffff }), 22, (q, rr, x, y) => { if (!free(x, y, 3)) return false; const s = 1.6 + rr() * 1.2; q.scale.set(s, s * 1.15, s); q.position.y = 2.2 + s * 0.8; return ['#3f7a30', '#52902f'][(rr() * 2) | 0]; });
  }
  return { update() {}, dispose() { items.forEach((m) => m.dispose?.()); dispose.forEach((o) => o.dispose?.()); } };
}

export function groundPlane(feel) {
  const t = groundTex(feel);
  const g = new THREE.PlaneGeometry(800, 800); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, metalness: 0 })); m.position.y = -0.5; m.receiveShadow = true;
  return m;
}
export function seaRipples() {
  const g = new THREE.PlaneGeometry(800, 800); g.rotateX(-Math.PI / 2);
  const tx = rippleTex().clone(); tx.needsUpdate = true; tx.repeat.set(70, 70);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0.5, depthWrite: false })); m.position.y = -0.46;
  return m;
}
export { BR };
