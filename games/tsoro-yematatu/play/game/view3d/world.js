// Tsoro Yematatu 3D models, shared by the game presenter and the offline icon render. Pure construction: nothing here reads the sim.
// World units: one board cell = 1. The board is a carved stone slab 6 x 6; point i sits at ((x - .5) * 5, (y - .5) * 5).
// Setting: a granary courtyard at dusk (woven mat, chevron-walled enclosure, thatched granaries, acacia, long shadows).
import { board3d as B, THREE } from '../vendor3d/index.js';
import { variantOf } from '../src/rules.js';

export const TOP = 0.5;                       // y of the carved surface
const TAU = Math.PI * 2;
const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const cvs = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

export const ptXZ = (V, i) => ({ x: (V.pts[i].x - 0.5) * 5, z: (V.pts[i].y - 0.5) * 5 });

// ------------------------------------------------------------------ stones: striped domed river pebbles with real weight
export const STONE_R = 0.42;
const STONE_PAL = {
  pebble: { 1: { a: '#ffcf6a', b: '#d9822a', c: '#8a3d10', ink: '#5a230a' }, 2: { a: '#7fa3d2', b: '#3f5f93', c: '#1c2f58', ink: '#f6ecd0' } },
  ring:   { 1: { a: '#f6d58a', b: '#d9953a', c: '#9a5516', ink: '#46200a' }, 2: { a: '#d9e7ee', b: '#9fb6c6', c: '#5f7c93', ink: '#17304a' } },
};
function stoneCanvas(side, style) {
  const p = (STONE_PAL[style] || STONE_PAL.pebble)[side === 2 ? 2 : 1], S = 512, c = cvs(S), x = c.getContext('2d'), r = rngOf(side * 77 + style.length);
  const g = x.createRadialGradient(S * 0.4, S * 0.38, 10, S / 2, S / 2, S * 0.72); g.addColorStop(0, p.a); g.addColorStop(0.55, p.b); g.addColorStop(1, p.c);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.09)'; x.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3); }
  x.strokeStyle = p.ink; x.lineJoin = 'round'; x.lineCap = 'round'; x.globalAlpha = 0.92;
  if (style === 'ring') {
    x.lineWidth = S * 0.032; for (const k of [0.78, 0.55, 0.32]) { x.beginPath(); x.arc(S / 2, S / 2, S * 0.5 * k * 0.96, 0, TAU); x.stroke(); }
    x.fillStyle = p.ink; x.beginPath(); x.arc(S / 2, S / 2, S * 0.05, 0, TAU); x.fill();
  } else {
    x.lineWidth = S * 0.05;                       // chevron stripes across the dome
    for (const off of [-0.2, 0.06, 0.32]) { x.beginPath(); for (let k = -5; k <= 5; k++) x.lineTo(S / 2 + k * S * 0.082, S / 2 + off * S + (k % 2 ? -1 : 1) * S * 0.045); x.stroke(); }
  }
  x.globalAlpha = 1;
  return c;
}
const stoneTexCache = new Map();
function stoneMat(side, style) {
  const k = `${side}|${style}`; let m = stoneTexCache.get(k);
  if (!m) {
    const cv = stoneCanvas(side, style);
    m = new THREE.MeshPhysicalMaterial({ map: tex(cv), roughness: 0.34, metalness: 0, clearcoat: 0.75, clearcoatRoughness: 0.22 });
    m.envMapIntensity = 1.1; stoneTexCache.set(k, m);
  }
  return m;
}
let stoneGeo = null;
function getStoneGeo() {
  if (stoneGeo) return stoneGeo;
  const R = STONE_R, H = R * 0.95;
  const prof = [[0, 0], [R * 0.9, 0], [R * 0.99, H * 0.06], [R * 1.0, H * 0.22], [R * 0.95, H * 0.5], [R * 0.8, H * 0.74], [R * 0.55, H * 0.92], [R * 0.25, H * 0.995], [0, H]];
  const g = B.lathe(prof, 56), pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) / R + 1) / 2, (pos.getZ(i) / R + 1) / 2);   // planar projection: stripes read from above
  uv.needsUpdate = true; stoneGeo = g; return g;
}
/** A resting stone: group (origin on the surface) with .userData { model, shadow }. */
export function makeStone(side, style = 'pebble') {
  const wrap = new THREE.Group();
  const model = new THREE.Mesh(getStoneGeo(), stoneMat(side, style)); model.castShadow = true; model.receiveShadow = true;
  const holder = new THREE.Group(); holder.add(model);
  const shadow = B.contactShadow(STONE_R * 1.55, 0.6); shadow.position.y = 0.006;
  wrap.add(shadow, holder); wrap.userData = { model: holder, mesh: model, shadow };
  return wrap;
}
export const stoneHeight = () => STONE_R * 0.95;

// ------------------------------------------------------------------ the carved board
const SLAB = {
  granite: { base: ['#4a5651', '#7c8880'], top: ['#66726a', '#9aa69c'], seed: 9, terrace: '#566159', groove: '#1d2523', inlay: '#f0c15a' },
  soap:    { base: ['#3d4a34', '#6c7c58'], top: ['#566748', '#92a47c'], seed: 14, terrace: '#4a5a3c', groove: '#1a2116', inlay: '#f2cf6a' },
  basalt:  { base: ['#1c2427', '#34403f'], top: ['#27343a', '#4b5d62'], seed: 31, terrace: '#34464b', groove: '#0c1214', inlay: '#f6d070' },
  copper:  { base: ['#54291a', '#98603f'], top: ['#7e4630', '#c58e68'], seed: 21, terrace: '#8a5236', groove: '#2c1509', inlay: '#ffe08a' },
};
export const hullOf = (V) => {
  let top = V.pts[0]; for (const p of V.pts) if (p.y < top.y) top = p;
  const by = Math.max(...V.pts.map((p) => p.y)); let l = null, r = null;
  for (const p of V.pts) if (Math.abs(p.y - by) < 0.01) { if (!l || p.x < l.x) l = p; if (!r || p.x > r.x) r = p; }
  return [top, r, l];
};
/** Board group. Returns { group, inlays: Map(lineIdx -> mesh), sockets: [Mesh] }. */
export function buildBoard(kind = 'granite', variant = 'classic') {
  const P = SLAB[kind] || SLAB.granite, V = variantOf(variant), group = new THREE.Group();
  const baseM = B.material('stone', { color: P.base[0], color2: P.base[1], seed: P.seed, repeat: [1, 1], size: 1024 });
  const topM = B.material('stone', { color: P.top[0], color2: P.top[1], seed: P.seed + 3, repeat: [1, 1], size: 1024, roughness: 0.5 });
  const terrM = B.material('stone', { color: P.terrace, color2: P.top[1], seed: P.seed + 5, repeat: [2, 2], roughness: 0.55 });
  const brass = B.material('brass', { color: '#b88a2e', color2: P.inlay });
  const grooveM = new THREE.MeshStandardMaterial({ color: P.groove, roughness: 0.9 });
  const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; group.add(o); return o; };
  add(B.slab(6.1, 6.1, 0.4, 0.2, 0.1), baseM, 0, 0.0, 0);                          // the carved slab (y 0..0.4)
  add(B.slab(5.35, 5.35, 0.1, 0.1, 0.035), topM, 0, 0.4, 0);                       // the playing field, a touch proud (to 0.5)
  // terrace the triangle sits on
  const hull = hullOf(V).map((p) => ({ x: (p.x - 0.5) * 5, z: (p.y - 0.5) * 5 })), c = { x: (hull[0].x + hull[1].x + hull[2].x) / 3, z: (hull[0].z + hull[1].z + hull[2].z) / 3 };
  const grow = (q, k) => [c.x + (q.x - c.x) * k, c.z + (q.z - c.z) * k];
  add(B.inlay(hull.map((q) => grow(q, 1.2)), 0.025, { bevel: 0.008 }), terrM, 0, TOP, 0);
  const T0 = TOP + 0.025;
  // grooves: dark channel, pale lip, gold wire inlay
  const inlays = [];
  V.lines.forEach((l, li) => {
    const a = ptXZ(V, l[0]), b = ptXZ(V, l[l.length - 1]), len = Math.hypot(b.x - a.x, b.z - a.z), ang = Math.atan2(-(b.z - a.z), b.x - a.x), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    add(new THREE.BoxGeometry(len + 0.1, 0.012, 0.2), new THREE.MeshStandardMaterial({ color: '#e8efe6', roughness: 0.8, transparent: true, opacity: 0.35 }), mx, T0 + 0.001, mz, ang).castShadow = false;
    add(new THREE.BoxGeometry(len + 0.06, 0.016, 0.15), grooveM, mx, T0 + 0.004, mz, ang).castShadow = false;
    const wire = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.045), brass.clone()); wire.material.emissive = new THREE.Color(P.inlay); wire.material.emissiveIntensity = 0; wire.position.set(mx, T0 + 0.016, mz); wire.rotation.y = ang; wire.castShadow = false; group.add(wire);
    inlays.push(wire);
  });
  // sockets at every point: dark dish + brass ring
  const sockets = [], ringGeo = B.lathe([[0.3, 0], [0.3, 0.035], [0.335, 0.045], [0.37, 0.03], [0.37, 0]], 40), dishGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.02, 36);
  const dishM = new THREE.MeshStandardMaterial({ color: P.groove, roughness: 0.85 });
  for (let i = 0; i < V.n; i++) {
    const p = ptXZ(V, i);
    add(dishGeo, dishM, p.x, T0 + 0.008, p.z).castShadow = false;
    add(ringGeo, brass, p.x, T0 + 0.002, p.z).castShadow = false;
    sockets.push(p);
  }
  // the chevron band round the frame (two zig-zag strokes of brass wire)
  const parts = [], seg = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(-(z1 - z0), x1 - x0), m = new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, TOP + 0.008, (z0 + z1) / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, 0)), new THREE.Vector3(1, 1, 1));
    parts.push({ geo: new THREE.BoxGeometry(len + 0.02, 0.016, 0.034), m });
  };
  // the frame margin is 0.325 .. 0.5 outside the field edge (2.675): zig-zag on y = side * 2.86
  const step = 0.22, zig = 0.055;
  for (const off of [-0.06, 0.06]) for (let side = 0; side < 4; side++) {
    const n = Math.floor(5.6 / step);
    for (let k = 0; k < n; k++) {
      const u0 = -2.8 + k * step, u1 = u0 + step, o0 = (k % 2 ? zig : -zig), o1 = (k % 2 ? -zig : zig), d = 2.88 + off;
      const tr = (u, o) => (side === 0 ? [u, -d + o] : side === 1 ? [u, d + o] : side === 2 ? [-d + o, u] : [d + o, u]);
      const [ax, az] = tr(u0, o0), [bx, bz] = tr(u1, o1); seg(ax, az, bx, bz);
    }
  }
  const bandGeo = B.mergeGeos(parts); const band = new THREE.Mesh(bandGeo, brass); band.castShadow = false; band.receiveShadow = true; group.add(band);
  return { group, inlays, sockets, V };
}

// ------------------------------------------------------------------ the setting
const gradTex = (stops, h = 512) => { const c = cvs(4, h), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, h); for (const [o, col] of stops) g.addColorStop(1 - o, col); x.fillStyle = g; x.fillRect(0, 0, 4, h); return tex(c); };
function silhouetteCanvas(W, Hh, layer, seed) {
  const c = cvs(W, Hh), x = c.getContext('2d'), r = rngOf(seed);
  const col = ['#3a2a4c', '#2a1d3a', '#190f26'][layer]; x.fillStyle = col; x.strokeStyle = col;
  if (layer === 0) {                                  // far hills
    x.beginPath(); x.moveTo(0, Hh); for (let i = 0; i <= 64; i++) x.lineTo((i / 64) * W, Hh * (0.55 - 0.18 * Math.sin(i * 0.33 + 1) - 0.12 * Math.sin(i * 0.9) * r())); x.lineTo(W, Hh); x.fill();
  } else {
    x.fillRect(0, Hh * 0.97, W, Hh * 0.03);
    const acacia = (px, s) => { x.lineWidth = s * 5; x.beginPath(); x.moveTo(px, Hh * 0.92); x.quadraticCurveTo(px + s * 4, Hh * 0.6, px - s * 2, Hh * 0.42); x.stroke(); x.beginPath(); x.ellipse(px, Hh * 0.38, s * 34, s * 9, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(px + s * 16, Hh * 0.44, s * 20, s * 6, 0, 0, TAU); x.fill(); };
    const baobab = (px, s) => { x.beginPath(); x.moveTo(px - s * 11, Hh * 0.93); x.quadraticCurveTo(px - s * 16, Hh * 0.7, px - s * 8, Hh * 0.46); x.lineTo(px + s * 8, Hh * 0.46); x.quadraticCurveTo(px + s * 16, Hh * 0.7, px + s * 11, Hh * 0.93); x.fill(); x.lineWidth = s * 3; for (let k = -2; k <= 2; k++) { x.beginPath(); x.moveTo(px + k * s * 3, Hh * 0.47); x.lineTo(px + k * s * 12, Hh * 0.3 - Math.abs(k) * s * 2); x.stroke(); x.beginPath(); x.arc(px + k * s * 12, Hh * 0.3 - Math.abs(k) * s * 2, s * 5, 0, TAU); x.fill(); } };
    const granary = (px, s) => { x.fillRect(px - s * 12, Hh * 0.7, s * 24, Hh * 0.24); x.beginPath(); x.moveTo(px - s * 17, Hh * 0.71); x.lineTo(px, Hh * 0.46); x.lineTo(px + s * 17, Hh * 0.71); x.closePath(); x.fill(); x.fillStyle = '#ffb35a'; x.globalAlpha = 0.75; x.fillRect(px - s * 3, Hh * 0.8, s * 6, s * 8); x.globalAlpha = 1; x.fillStyle = col; };
    const wall = (px, w) => { x.fillRect(px, Hh * 0.62, w, Hh * 0.32); for (let k = 0; k < w / 14; k++) { x.beginPath(); x.moveTo(px + k * 14, Hh * 0.62); x.lineTo(px + k * 14 + 7, Hh * 0.54); x.lineTo(px + k * 14 + 14, Hh * 0.62); x.fill(); } };
    let px = 20; let n = 0;
    while (px < W - 30) {
      const t = r();
      if (layer === 1) { if (t < 0.34) acacia(px, 0.9 + r() * 0.5); else if (t < 0.5) baobab(px, 1 + r() * 0.5); else if (t < 0.75) granary(px, 0.9 + r() * 0.4); else wall(px, 120 + r() * 100); }
      else { if (t < 0.45) acacia(px, 1.2 + r() * 0.7); else if (t < 0.7) granary(px, 1.2); else baobab(px, 1.3); }
      px += 90 + r() * 150; n++;
    }
  }
  return c;
}
/** The distant world: sky dome, sun, silhouettes, ground, all unlit and fogless (the courtyard around the board is built apart). */
export function buildSky() {
  const g = new THREE.Group();
  const skyTex = gradTex([[0, '#5a3c34'], [0.3, '#80563f'], [0.45, '#b87d52'], [0.497, '#e8a35e'], [0.503, '#ffd47a'], [0.52, '#ffb35c'], [0.57, '#ea7a58'], [0.66, '#a8486a'], [0.8, '#5a2f66'], [1, '#1a1438']], 1024);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.rotation.y = 0; g.add(dome);
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ map: (() => { const c = cvs(256), x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.12, 'rgba(255,236,170,0.98)'); gr.addColorStop(0.3, 'rgba(255,190,100,0.45)'); gr.addColorStop(1, 'rgba(255,140,70,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256); return tex(c); })(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sun.scale.setScalar(0.5); sun.position.set(-4, 11.5, -110); g.add(sun);
  [[0, 66, 10], [1, 52, 16], [2, 42, 16]].forEach(([layer, dist, hgt], k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(140, hgt), new THREE.MeshBasicMaterial({ map: tex(silhouetteCanvas(2048, 256, layer, 7 + layer * 13)), transparent: true, fog: false, depthWrite: false }));
    m.position.set(k * 6 - 6, hgt / 2 - 0.6, -dist); g.add(m);
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(76, 64), new THREE.MeshStandardMaterial({ color: '#6b4a38', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; g.add(ground);
  return { group: g, ground, sun };
}

function matCanvas() {
  const S = 512, c = cvs(S), x = c.getContext('2d'), r = rngOf(31);
  x.fillStyle = '#c8a368'; x.fillRect(0, 0, S, S);
  const bands = [['#8c2f1f', 0.05], ['#1b1410', 0.045], ['#e8d5a0', 0.03]];
  let y = 0; let k = 0;
  while (y < S) { const bnd = bands[k % 3 === 0 ? 0 : k % 3 === 1 ? 2 : 1]; if (k % 4 === 0) { x.fillStyle = bnd[0]; x.fillRect(0, y, S, S * bnd[1]); } y += S * 0.045; k++; }
  for (let i = 0; i < S; i += 4) { x.fillStyle = `rgba(60,36,10,${0.1 + r() * 0.12})`; x.fillRect(i, 0, 1.2, S); }
  for (let i = 0; i < S; i += 6) { x.fillStyle = `rgba(255,236,190,${0.05 + r() * 0.08})`; x.fillRect(0, i, S, 1.2); }
  return c;
}
function earthCanvas() {
  const S = 512, c = cvs(S), x = c.getContext('2d'), r = rngOf(5);
  x.fillStyle = '#7a5c48'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 4000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,230,190,0.07)' : 'rgba(40,20,8,0.10)'; x.fillRect(r() * S, r() * S, 1 + r() * 5, 1 + r() * 3); }
  for (let i = 0; i < 26; i++) { x.strokeStyle = 'rgba(50,28,12,0.15)'; x.lineWidth = 1 + r() * 2; x.beginPath(); x.arc(r() * S, r() * S, 20 + r() * 90, r() * 6, r() * 6 + 1.5); x.stroke(); }
  return c;
}
/** The courtyard around the board: swept earth, a woven mat, a chevron-walled enclosure, thatched granaries, an acacia, grass, a lamp. */
export function buildCourtyard() {
  const g = new THREE.Group(), r = rngOf(99);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(42, 64), new THREE.MeshStandardMaterial({ map: tex(earthCanvas(), [16, 16]), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; floor.receiveShadow = true; g.add(floor);
  const mat = new THREE.Mesh(B.slab(7.3, 7.3, 0.05, 0.12, 0.02), new THREE.MeshStandardMaterial({ map: tex(matCanvas(), [1, 1]), roughness: 0.95, bumpMap: tex(matCanvas(), [1, 1], false), bumpScale: 0.6 }));
  mat.position.y = -0.03; mat.receiveShadow = true; g.add(mat);
  // the enclosure wall: two courses of dressed granite, a chevron frieze of diamonds on top (the walls of the great enclosures), a gate gap
  const wallM = B.material('stone', { color: '#5d5048', color2: '#a08a76', seed: 17, repeat: [6, 1], roughness: 0.85 }), capM = B.material('brass', { color: '#9a7a32', color2: '#e0bc66', roughness: 0.5 });
  const courseGeo = B.slab(1.25, 0.8, 0.42, 0.06, 0.03), courseGeo2 = B.slab(1.2, 0.66, 0.34, 0.05, 0.025);
  const RW = 9.8, N = 56, diaGeo = new THREE.BoxGeometry(0.3, 0.3, 0.5);
  const dia = new THREE.InstancedMesh(diaGeo, capM, N * 2); let di = 0; const dm = new THREE.Matrix4(), dq = new THREE.Quaternion();
  for (let k = 0; k < N; k++) {
    const a = (k / N) * TAU; if (a < 1.75 || a > 4.55) continue;      // the far side only
    const x = Math.sin(a) * RW, z = Math.cos(a) * RW;
    const b1 = new THREE.Mesh(courseGeo, wallM); b1.position.set(x, 0, z); b1.rotation.y = a; b1.castShadow = b1.receiveShadow = true; g.add(b1);
    const b2 = new THREE.Mesh(courseGeo2, wallM); b2.position.set(x, 0.42, z); b2.rotation.y = a + (r() - 0.5) * 0.03; b2.castShadow = b2.receiveShadow = true; g.add(b2);
    for (const off of [-0.31, 0.31]) {
      const aa = a + off / RW; dq.setFromEuler(new THREE.Euler(0.0, aa, Math.PI / 4, 'YXZ'));
      dm.compose(new THREE.Vector3(Math.sin(aa) * RW, 0.76 + 0.12, Math.cos(aa) * RW), dq, new THREE.Vector3(1, 1, 1)); dia.setMatrixAt(di++, dm);
    }
  }
  dia.count = di; dia.castShadow = true; g.add(dia);
  // granaries: clay drum on stilts of stone, conical thatch
  const claM = B.material('clay', { color: '#a8643e', color2: '#c98a5a', repeat: [3, 2], seed: 12 }), thatch = B.material('wood', { color: '#8a6a30', color2: '#c9a458', repeat: [3, 2], seed: 3, roughness: 0.95 });
  const granary = (x, z, s) => {
    const gp = new THREE.Group();
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.35, 8), new THREE.MeshStandardMaterial({ color: '#5a4a3c', roughness: 0.9 })); f.position.set(Math.cos(k * 1.57 + 0.7) * 0.7, 0.17, Math.sin(k * 1.57 + 0.7) * 0.7); f.castShadow = true; gp.add(f); }
    const body = new THREE.Mesh(B.lathe([[0.001, 0.35], [0.95, 0.35], [1.08, 0.7], [1.1, 1.3], [0.98, 1.85], [0.001, 1.85]], 28), claM); body.castShadow = body.receiveShadow = true; gp.add(body);
    const roof = new THREE.Mesh(B.lathe([[0.001, 2.75], [0.2, 2.5], [1.0, 1.95], [1.5, 1.72], [1.46, 1.8], [0.001, 2.8]], 28), thatch); roof.castShadow = true; gp.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.1), new THREE.MeshStandardMaterial({ color: '#241408' })); door.position.set(0, 0.95, 1.02); gp.add(door);
    gp.position.set(x, 0, z); gp.scale.setScalar(s); gp.rotation.y = Math.atan2(-x, -z) + 0.3; g.add(gp); return gp;
  };
  granary(-8.6, -4.2, 1.0); granary(8.0, -6.6, 0.86); granary(-4.2, -9.4, 0.92);
  // an acacia
  const acacia = new THREE.Group();
  const trunk = new THREE.Mesh(B.lathe([[0.22, 0], [0.16, 1.4], [0.1, 3.0], [0.001, 3.2]], 12), new THREE.MeshStandardMaterial({ color: '#2d2018', roughness: 1 })); trunk.castShadow = true; acacia.add(trunk);
  const can = new THREE.MeshStandardMaterial({ color: '#4a5a22', roughness: 1 });
  for (const [ox, oy, oz, sx] of [[0, 3.3, 0, 2.7], [1.4, 3.0, 0.4, 1.8], [-1.5, 3.1, -0.3, 1.9]]) { const c = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), can); c.scale.set(sx, 0.4, sx * 0.85); c.position.set(ox, oy, oz); c.castShadow = true; acacia.add(c); }
  acacia.position.set(7.6, 0, -1.5); g.add(acacia);
  // a clay lamp on a stone near the mat, with a small flame
  const lamp = new THREE.Group();
  lamp.add(new THREE.Mesh(B.lathe([[0.001, 0], [0.22, 0], [0.26, 0.1], [0.2, 0.2], [0.16, 0.24], [0.001, 0.24]], 18), claM));
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd27a', blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
  flame.scale.set(0.8, 1.7, 0.8); flame.position.y = 0.34; lamp.add(flame);
  const lampLight = new THREE.PointLight(0xffa84a, 1.4, 6, 1.6); lampLight.position.y = 0.55; lamp.add(lampLight);
  lamp.position.set(3.7, 0, 3.55); g.add(lamp);
  // spare river pebbles and a gourd scoop beside the mat
  const gourd = new THREE.Mesh(B.lathe([[0.001, 0], [0.2, 0.02], [0.3, 0.14], [0.28, 0.3], [0.16, 0.45], [0.1, 0.62], [0.12, 0.75], [0.001, 0.78]], 22), B.material('clay', { color: '#a97a2a', color2: '#d9b25a', seed: 2 }));
  gourd.position.set(-4.0, 0, 3.7); gourd.rotation.z = 1.2; gourd.position.y = 0.3; gourd.castShadow = true; g.add(gourd);
  for (const [x, z, s] of [[-3.9, -3.7, 0.5], [-3.5, -4.0, 0.36], [4.0, -3.8, 0.42]]) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshStandardMaterial({ color: '#6c6560', roughness: 0.7 })); p.scale.set(1.2 * s * 2, 0.6 * s * 2, s * 2); p.position.set(x, 0.1, z); p.castShadow = true; g.add(p); }
  // grass tufts: clumps of thin blades (swayed by the presenter)
  const blades = []; const bm = new THREE.Matrix4();
  for (let k = 0; k < 6; k++) {
    const bl = new THREE.CylinderGeometry(0, 0.022, 0.5 + (k % 3) * 0.13, 3); bl.translate(0, (0.5 + (k % 3) * 0.13) / 2, 0);
    bm.compose(new THREE.Vector3(Math.cos(k * 1.9) * 0.07, 0, Math.sin(k * 1.9) * 0.07), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(k * 2.3) * 0.35, 0, Math.cos(k * 1.7) * 0.35)), new THREE.Vector3(1, 1, 1));
    blades.push({ geo: bl, m: bm.clone() });
  }
  const tuftG = B.mergeGeos(blades.map((b) => ({ geo: (() => { const gg = b.geo.clone(); return gg; })(), m: b.m })));
  const tufts = new THREE.InstancedMesh(tuftG, new THREE.MeshStandardMaterial({ color: '#8f7a3a', roughness: 1, side: THREE.DoubleSide }), 260);
  const tdata = []; const m4 = new THREE.Matrix4();
  for (let i = 0; i < 260; i++) {
    const a = r() * TAU, rad = 4.1 + Math.pow(r(), 0.8) * 6.6, x = Math.sin(a) * rad, z = Math.cos(a) * rad, s = 0.7 + r() * 0.9;
    tdata.push({ x, z, s, ph: r() * 6 }); m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); tufts.setMatrixAt(i, m4);
  }
  tufts.receiveShadow = false; g.add(tufts);
  const q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  return {
    group: g, lampLight, flame,
    update(t, calm) {
      const fl = calm ? 1 : 0.86 + Math.sin(t * 13) * 0.07 + Math.sin(t * 29.7) * 0.05 + Math.sin(t * 5.3) * 0.04;
      lampLight.intensity = 1.4 * fl; flame.scale.set(0.8 * fl, 1.7 * (0.9 + 0.2 * fl), 0.8 * fl);
      if (calm) return;
      for (let i = 0; i < tdata.length; i++) {
        const d = tdata[i], sw = Math.sin(t * 1.3 + d.ph + d.x * 0.3) * 0.16 + Math.sin(t * 3.1 + d.ph) * 0.05;
        e.set(sw * 0.8, 0, sw); q.setFromEuler(e); pv.set(d.x, 0, d.z); sc.set(d.s, d.s, d.s); m4.compose(pv, q, sc); tufts.setMatrixAt(i, m4);
      }
      tufts.instanceMatrix.needsUpdate = true;
    },
  };
}
