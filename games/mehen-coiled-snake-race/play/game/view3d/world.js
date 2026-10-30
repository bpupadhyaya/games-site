// The 3D world for Mehen, all procedural (no bitmaps): a round limestone board with the coiled snake carved in relief (heights come from
// the same field the flat art bakes, src/bake.js, so every cell and resting stone is where the 2D layer expects it), gold leaf in the
// grooves, sculpted glazed lions and glass marbles, on a linen pad on an acacia scribe's bench in a tomb workshop at night: an oil
// lamp, alabaster jars, a scribe's palette with reed pens, a papyrus scroll, a mallet and a copper chisel, cold moonlight from a high
// window. Units are centimetres; y is up; the board centre is the origin; unit-square (ux, uy) maps to world x = (ux-.5)*D, z = (uy-.5)*D
// (so the tail, at the bottom of the 2D board, is nearest the camera).
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { field, STONES } from '../src/bake.js';
import { SPIRAL, CELL_PTS, CELL_LEN, pointAt, thetaOf } from '../src/geo.js';
import { PALETTE } from '../src/art.js';
import { TRACK } from '../src/rules.js';

export const D = 34;            // the unit square is 34 cm across; the disc is a little larger than the spiral's outer ring
export const HS = 2.7;          // cm of relief per unit of the height field
export const Y0 = 2.4;          // world height of the field's base level (0.4)
export const R_EDGE = 0.52;     // outer radius of the disc in unit-square units
const BENCH_TOP = 0;
const PAD = 0.45;               // linen pad thickness

const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const rnd = (s) => { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
export const wx = (ux) => (ux - 0.5) * D;
export const wz = (uy) => (uy - 0.5) * D;

export function radialTex(rgb = '255,255,255', a = 1) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}

// ------------------------------------------------------------------------------------------------ the board: heights
const lip = (r) => 0.86 - 0.5 * sm(0.495, 0.52, r);
// Height field + gold mask sampled N x N over the unit square (sliced: `tick` lets the page breathe). Cached per size by the caller.
export async function buildHeights(N, tick) {
  const Hs = new Float32Array(N * N), Gs = new Uint8Array(N * N), tmp = [0, 0];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N, v = (y + 0.5) / N, r = Math.hypot(u - 0.5, v - 0.5);
      field(u, v, tmp, false);
      let h = tmp[0], g = tmp[1];
      const k = sm(0.468, 0.482, r);
      if (k > 0) {
        h += (lip(r) - h) * k;
        if (Math.abs(r - 0.49) < 0.0035) g = Math.max(g, 0.9);
        if (Math.abs(r - 0.474) < 0.002) g = Math.max(g, 0.6);
      }
      Hs[y * N + x] = h; Gs[y * N + x] = Math.round(g * 255);
    }
    if (y % 24 === 23 && tick) await tick();
  }
  const sample = (u, v) => {
    const fx = Math.min(N - 1.001, Math.max(0, u * N - 0.5)), fy = Math.min(N - 1.001, Math.max(0, v * N - 0.5)), x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
    const a = Hs[y0 * N + x0], b = Hs[y0 * N + x0 + 1], c = Hs[(y0 + 1) * N + x0], d = Hs[(y0 + 1) * N + x0 + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  return { N, Hs, Gs, sample, floorAt: (ux, uy) => Y0 + (sample(ux, uy) - 0.4) * HS };
}

// Albedo, bump and roughness/metal maps for one stone (limestone, basalt, lapis).
export async function buildMaps(H, stoneId, tick) {
  const { N, Hs, Gs } = H, st = STONES[stoneId] ?? STONES.sandstone;
  const alb = canvas(N), bmp = canvas(N), orm = canvas(N);
  const ca = alb.getContext('2d'), cb = bmp.getContext('2d'), co = orm.getContext('2d');
  const ia = ca.createImageData(N, N), ib = cb.createImageData(N, N), io = co.createImageData(N, N);
  // a wide soft copy of the heights: where the stone is lower than around it (cell floors, grooves) it is darker (baked cavity shading)
  const Bl = new Float32Array(N * N), tmpA = new Float32Array(N * N), R = Math.max(3, Math.round(N * 0.012)), inv = 1 / (2 * R + 1);
  for (let y = 0; y < N; y++) {
    let acc = 0; for (let x = -R; x <= R; x++) acc += Hs[y * N + Math.min(N - 1, Math.max(0, x))];
    for (let x = 0; x < N; x++) { tmpA[y * N + x] = acc * inv; acc += Hs[y * N + Math.min(N - 1, x + R + 1)] - Hs[y * N + Math.max(0, x - R)]; }
  }
  for (let x = 0; x < N; x++) {
    let acc = 0; for (let y = -R; y <= R; y++) acc += tmpA[Math.min(N - 1, Math.max(0, y)) * N + x];
    for (let y = 0; y < N; y++) { Bl[y * N + x] = acc * inv; acc += tmpA[Math.min(N - 1, y + R + 1) * N + x] - tmpA[Math.max(0, y - R) * N + x]; }
  }
  if (tick) await tick();
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x, h = Hs[i], g = Gs[i] / 255, u = (x + 0.5) / N, v = (y + 0.5) / N;
      const t = Math.min(1, Math.max(0, (h - 0.28) / 0.62));
      const grain = 0.88 + 0.12 * hash(x, y) + 0.1 * (hash((x >> 3) + 7, (y >> 3) + 3) - 0.5);
      const cav = Math.min(1, Math.max(0, (Bl[i] - h) * 5.5));
      const ao = (0.7 + 0.5 * Math.min(1, Math.max(0, h))) * (1 - 0.5 * cav);
      let r = lerp(st.low[0], st.high[0], t) * grain * ao * st.tone, gg = lerp(st.low[1], st.high[1], t) * grain * ao * st.tone, b = lerp(st.low[2], st.high[2], t) * grain * ao * st.tone;
      // a few darker mineral veins in the limestone
      const vein = Math.abs(Math.sin((u * 7 + v * 3 + 0.4 * Math.sin(v * 11)) * 3.1)) < 0.04 ? 0.88 : 1; r *= vein; gg *= vein; b *= vein;
      if (g > 0.02) { r = lerp(r, st.gold[0] * (0.7 + 0.4 * ao), g); gg = lerp(gg, st.gold[1] * (0.7 + 0.4 * ao), g); b = lerp(b, st.gold[2] * (0.7 + 0.4 * ao), g); }
      const o = i * 4;
      ia.data[o] = r > 255 ? 255 : r; ia.data[o + 1] = gg > 255 ? 255 : gg; ia.data[o + 2] = b > 255 ? 255 : b; ia.data[o + 3] = 255;
      const bv = Math.min(255, Math.max(0, Math.round(h * 255 + (hash(x, y) - 0.5) * 5)));
      ib.data[o] = ib.data[o + 1] = ib.data[o + 2] = bv; ib.data[o + 3] = 255;
      io.data[o] = 255; io.data[o + 1] = Math.round(lerp(0.72, 0.28, g) * 255 * (0.9 + 0.1 * hash(y, x))); io.data[o + 2] = Math.round(g * 255); io.data[o + 3] = 255;
    }
    if (y % 64 === 63 && tick) await tick();
  }
  ca.putImageData(ia, 0, 0); cb.putImageData(ib, 0, 0); co.putImageData(io, 0, 0);
  return { map: tex(alb), bump: tex(bmp, false), orm: tex(orm, false) };
}

// The disc: a polar grid displaced by the height field, a rim, a rough stone side.
export function buildDisc(H, maps) {
  const g = new THREE.Group();
  const RN = 150, SN = 320, n = (RN + 1) * (SN + 1), pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  for (let i = 0; i <= RN; i++) {
    const r = (i / RN) * R_EDGE;
    for (let j = 0; j <= SN; j++) {
      const a = (j / SN) * Math.PI * 2, ux = 0.5 + r * Math.cos(a), uy = 0.5 + r * Math.sin(a), k = i * (SN + 1) + j;
      pos[k * 3] = wx(ux); pos[k * 3 + 1] = Y0 + (H.sample(ux, uy) - 0.4) * HS; pos[k * 3 + 2] = wz(uy);
      uv[k * 2] = ux; uv[k * 2 + 1] = 1 - uy;
    }
  }
  for (let i = 0; i < RN; i++) for (let j = 0; j < SN; j++) { const a = i * (SN + 1) + j, b = a + 1, c = a + SN + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  for (let i = 0; i <= RN; i++) { const a = i * (SN + 1), b = a + SN; const x = (nor.getX(a) + nor.getX(b)) / 2, y = (nor.getY(a) + nor.getY(b)) / 2, z = (nor.getZ(a) + nor.getZ(b)) / 2; nor.setXYZ(a, x, y, z); nor.setXYZ(b, x, y, z); }
  const mat = new THREE.MeshStandardMaterial({ map: maps.map, bumpMap: maps.bump, bumpScale: 2.4, roughnessMap: maps.orm, metalnessMap: maps.orm, roughness: 1, metalness: 1, envMapIntensity: 0.9 });
  const top = new THREE.Mesh(geo, mat); top.castShadow = true; top.receiveShadow = true; g.add(top);
  const yEdge = Y0 + (lip(R_EDGE) - 0.4) * HS, rad = R_EDGE * D;
  const sc = canvas(256, 64), sx = sc.getContext('2d'); sx.fillStyle = '#b9ad94'; sx.fillRect(0, 0, 256, 64);
  const rr = rnd(5); for (let i = 0; i < 900; i++) { sx.fillStyle = `rgba(${rr() < 0.5 ? '60,48,30' : '240,230,205'},${0.04 + rr() * 0.08})`; sx.fillRect(rr() * 256, rr() * 64, 1 + rr() * 6, 1 + rr() * 2); }
  const side = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.015, yEdge - (BENCH_TOP + PAD), 160, 1, true), new THREE.MeshStandardMaterial({ map: tex(sc, true, [4, 1]), roughness: 0.85, color: new THREE.Color(maps.tint ?? 0xffffff) }));
  side.position.y = (yEdge + BENCH_TOP + PAD) / 2; side.castShadow = true; side.receiveShadow = true; g.add(side);
  // gold eyes set in the head
  const eyeM = new THREE.MeshStandardMaterial({ color: 0xe8b53e, metalness: 1, roughness: 0.25 }), pupM = new THREE.MeshStandardMaterial({ color: 0x120a02, roughness: 0.4 });
  for (const sg of [-1, 1]) {
    const ux = 0.5 + sg * SPIRAL.headR * 0.66, uy = 0.5 - SPIRAL.headR * 0.42, y = Y0 + (H.sample(ux, uy) - 0.4) * HS;
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 12), eyeM); e.scale.set(1, 0.38, 0.72); e.position.set(wx(ux), y + 0.04, wz(uy)); e.rotation.y = sg * 0.5; g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), pupM); p.scale.set(0.55, 0.5, 1.4); p.position.set(wx(ux), y + 0.2, wz(uy)); p.rotation.y = sg * 0.5; g.add(p);
  }
  g.userData.dispose = () => { geo.dispose(); mat.dispose(); maps.map.dispose(); maps.bump.dispose(); maps.orm.dispose(); };
  return g;
}

// ------------------------------------------------------------------------------------------------ lit cells (rings and fills on the board)
// A rounded outline following the carved cell (curving with the spiral): (s, b) = along / across the centre line.
function cellOutline(i, grow = 1) {
  if (i >= TRACK) { const pts = []; for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; pts.push([0.5 + Math.cos(a) * SPIRAL.headR * 0.64 * grow, 0.5 + Math.sin(a) * SPIRAL.headR * 0.64 * grow]); } return { pts, c: [0.5, 0.5] }; }
  if (i <= 0) { const p0 = CELL_PTS[0], pts = []; for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; pts.push([p0.x + Math.cos(a) * SPIRAL.half * 0.8 * grow, p0.y + Math.sin(a) * SPIRAL.half * 0.8 * grow]); } return { pts, c: [p0.x, p0.y] }; }
  const sc = (i - 0.5) * CELL_LEN, hl = CELL_LEN * 0.4 * grow, hw = SPIRAL.half * 0.76 * grow, rad = Math.min(hl, hw) * 0.5;
  const P = (s, b) => { const q = pointAt(thetaOf(sc + s)), nx = -Math.sin(q.ang), ny = Math.cos(q.ang); return [q.x + nx * b, q.y + ny * b]; };
  const pts = [], M = 8, C = 5;
  for (let k = 0; k <= M; k++) pts.push(P(-hl + rad + ((hl * 2 - rad * 2) * k) / M, hw));
  for (let k = 1; k < C; k++) { const a = (k / C) * Math.PI / 2; pts.push(P(hl - rad + Math.sin(a) * rad, hw - rad + Math.cos(a) * rad)); }
  for (let k = 0; k <= M; k++) pts.push(P(hl - rad - ((hl * 2 - rad * 2) * k) / M, -hw));
  for (let k = 1; k < C; k++) { const a = (k / C) * Math.PI / 2; pts.push(P(-hl + rad - Math.sin(a) * rad, -hw + rad - Math.cos(a) * rad)); }
  const q = CELL_PTS[i];
  return { pts, c: [q.x, q.y] };
}
// Marker meshes for cells 0..TRACK: a soft fill and a bright outline, hidden until the 2D layer asks for them.
export function buildCellMarks(H) {
  const out = [], grp = new THREE.Group();
  for (let i = 0; i <= TRACK; i++) {
    const o = cellOutline(i, 1), inn = cellOutline(i, 0.8), n = o.pts.length;
    const yAt = (p) => H.floorAt(p[0], p[1]) + 0.06;
    const fp = [], fi = [];
    for (let k = 0; k < n; k++) { const p = inn.pts[k]; fp.push(wx(p[0]), yAt(p), wz(p[1])); }
    const cy = H.floorAt(o.c[0], o.c[1]) + 0.06; fp.push(wx(o.c[0]), cy, wz(o.c[1]));
    for (let k = 0; k < n; k++) fi.push(n, (k + 1) % n, k);
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setIndex(fi);
    const lp = [], li = [];
    for (let k = 0; k < n; k++) { const a = o.pts[k], b = inn.pts[k]; lp.push(wx(a[0]), yAt(a) + 0.02, wz(a[1]), wx(b[0]), yAt(b) + 0.02, wz(b[1])); }
    for (let k = 0; k < n; k++) { const a = k * 2, b = ((k + 1) % n) * 2; li.push(a, b, a + 1, a + 1, b, b + 1); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setIndex(li);
    const mk = (geo, additive) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); m.visible = false; m.renderOrder = 3; grp.add(m); return m; };
    out.push({ fill: mk(fg, false), line: mk(lg, true) });
  }
  grp.userData.cells = out;
  return grp;
}

// ------------------------------------------------------------------------------------------------ lions and marbles
function lionGeos() {
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  const mk = (geo, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => ({ geo, m: M4.clone().compose(new THREE.Vector3(x, y, z), Q.clone().setFromEuler(E.clone().set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)) });
  const sp = (r, ...a) => mk(new THREE.SphereGeometry(r, 26, 18), ...a);
  const body = [
    sp(1, -0.2, 0.95, 0, 1.55, 0.85, 0.85), sp(1, -1.05, 0.82, 0, 0.95, 0.9, 0.95), sp(0.62, -1.05, 0.7, 0.5, 1, 1, 0.9), sp(0.62, -1.05, 0.7, -0.5, 1, 1, 0.9),
    sp(0.75, 0.6, 1.12, 0, 1, 1.1, 1), sp(0.5, 1.0, 1.6, 0, 1, 1.4, 1), sp(0.58, 1.22, 1.98, 0, 1, 0.95, 0.95), sp(0.3, 1.72, 1.82, 0, 1.3, 0.8, 0.9),
    sp(0.17, 1.05, 2.5, 0.42, 1.2, 1, 1.2), sp(0.17, 1.05, 2.5, -0.42, 1.2, 1, 1.2),
    mk(new THREE.CapsuleGeometry(0.27, 1.0, 6, 12), 1.15, 0.3, 0.44, 1, 1, 1, 0, 0, Math.PI / 2), mk(new THREE.CapsuleGeometry(0.27, 1.0, 6, 12), 1.15, 0.3, -0.44, 1, 1, 1, 0, 0, Math.PI / 2),
    sp(0.3, 1.75, 0.3, 0.44, 1.1, 0.8, 1), sp(0.3, 1.75, 0.3, -0.44, 1.1, 0.8, 1),
    mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1.8, 0.7, 0), new THREE.Vector3(-2.35, 0.9, 0.15), new THREE.Vector3(-2.5, 1.5, 0.1), new THREE.Vector3(-2.2, 1.9, 0)]), 20, 0.13, 8), 0, 0, 0),
  ];
  const mane = [sp(0.95, 0.78, 1.95, 0, 0.8, 1.08, 1.1), sp(0.28, -2.2, 1.95, 0), ...Array.from({ length: 16 }, (_, k) => { const a = (k / 16) * Math.PI * 2; return sp(0.36, 0.72, 1.95 + Math.cos(a) * 0.86, Math.sin(a) * 0.86, 0.6, 1.25, 1.25); })];
  const gold = [mk(new THREE.TorusGeometry(0.62, 0.08, 10, 32), 0.98, 1.62, 0, 1, 1, 1, 0, Math.PI / 2, 0)];
  const dark = [sp(0.075, 1.62, 2.1, 0.27), sp(0.075, 1.62, 2.1, -0.27), sp(0.11, 2.0, 1.88, 0, 1, 0.8, 1.2)];
  const g = (list) => B.mergeGeos(list);
  return { body: g(body), mane: g(mane), gold: g(gold), dark: g(dark) };
}
let LG = null;
export const LION_SCALE = 1.0;
export function makeLion(q) {
  LG ??= lionGeos();
  const pal = PALETTE[q % 6], grp = new THREE.Group(), tint = (h) => new THREE.Color(h);
  const bodyM = new THREE.MeshPhysicalMaterial({ color: tint(pal.base), roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 1.1 });
  const maneM = new THREE.MeshPhysicalMaterial({ color: tint(pal.mane), roughness: 0.42, clearcoat: 0.3, envMapIntensity: 1 });
  const goldM = new THREE.MeshStandardMaterial({ color: 0xe8b53e, metalness: 1, roughness: 0.28 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x120a02, roughness: 0.4 });
  const parts = [[LG.body, bodyM], [LG.mane, maneM], [LG.gold, goldM], [LG.dark, darkM]].map(([geo, m]) => { const me = new THREE.Mesh(geo, m); me.castShadow = true; me.receiveShadow = true; grp.add(me); return me; });
  grp.userData = { q, bodyM, maneM, goldM, darkM, parts, base: tint(pal.base), mane: tint(pal.mane), glow: tint(`rgb(${pal.glow})`) };
  grp.scale.setScalar(LION_SCALE);
  return grp;
}
export function makeMarble() {
  const c = canvas(128, 64), x = c.getContext('2d'); x.fillStyle = '#f2f6fb'; x.fillRect(0, 0, 128, 64);
  x.strokeStyle = 'rgba(120,160,215,0.75)'; x.lineWidth = 5; x.lineCap = 'round';
  for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(0, 16 + k * 16); x.bezierCurveTo(30, 4 + k * 16, 70, 36 + k * 8, 128, 14 + k * 16); x.stroke(); }
  x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 30); x.bezierCurveTo(40, 52, 80, 6, 128, 34); x.stroke();
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.64, 32, 20), new THREE.MeshPhysicalMaterial({ map: tex(c), roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 }));
  m.castShadow = true; m.receiveShadow = true; return m;
}

// ------------------------------------------------------------------------------------------------ the workshop
function benchTexture() {
  const c = canvas(1024, 512), x = c.getContext('2d'), r = rnd(21);
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#6b4528'); g.addColorStop(1, '#4a2e18'); x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 380; i++) { const y = r() * 512, amp = 1 + r() * 4, ph = r() * 6; x.strokeStyle = r() < 0.5 ? `rgba(25,12,4,${0.1 + r() * 0.2})` : `rgba(210,160,100,${0.04 + r() * 0.06})`; x.lineWidth = 0.6 + r() * 2; x.beginPath(); for (let xx = 0; xx <= 1024; xx += 16) { const v = y + Math.sin(xx / 1024 * 7 + ph) * amp; xx ? x.lineTo(xx, v) : x.moveTo(xx, v); } x.stroke(); }
  x.strokeStyle = 'rgba(10,4,0,0.7)'; x.lineWidth = 3; for (let k = 1; k < 6; k++) { x.beginPath(); x.moveTo(0, k * 85.3); x.lineTo(1024, k * 85.3); x.stroke(); }
  return tex(c);
}
function wallTexture() {
  const c = canvas(1024, 512), x = c.getContext('2d'), r = rnd(9);
  x.fillStyle = '#2a3140'; x.fillRect(0, 0, 1024, 512);
  for (let row = 0; row < 12; row++) for (let col = -1; col < 9; col++) {
    const w = 128, h = 42, ox = (row % 2 ? 64 : 0) + col * w, oy = row * h + 6;
    const t = 0.82 + r() * 0.3; x.fillStyle = `rgb(${Math.round(54 * t)},${Math.round(60 * t)},${Math.round(76 * t)})`; x.fillRect(ox + 2, oy + 2, w - 4, h - 4);
  }
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '170,190,230'},${0.03 + r() * 0.05})`; x.fillRect(r() * 1024, r() * 512, 1 + r() * 5, 1 + r() * 3); }
  // a painted band of lapis and ochre near the top, plain geometric (no figures)
  x.fillStyle = '#1c3d7a'; x.fillRect(0, 36, 1024, 26); x.fillStyle = '#c99a3a'; x.fillRect(0, 30, 1024, 5); x.fillRect(0, 63, 1024, 5);
  x.fillStyle = '#e8d9a8'; for (let k = 0; k < 40; k++) { x.beginPath(); x.moveTo(k * 26 + 13, 40); x.lineTo(k * 26 + 20, 49); x.lineTo(k * 26 + 13, 58); x.lineTo(k * 26 + 6, 49); x.closePath(); x.fill(); }
  return tex(c, true, [2, 1]);
}
function linenTexture(col = '#b9a98a') {
  const c = canvas(256), x = c.getContext('2d'), r = rnd(4); x.fillStyle = col; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) { x.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`; x.fillRect(i, 0, 1, 256); x.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`; x.fillRect(0, i, 256, 1); }
  return tex(c, true, [6, 6]);
}
function papyrusTexture() {
  const c = canvas(256, 128), x = c.getContext('2d'), r = rnd(31); x.fillStyle = '#d8c28a'; x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 256; i += 3) { x.fillStyle = `rgba(120,90,40,${0.05 + r() * 0.1})`; x.fillRect(i, 0, 1, 128); }
  for (let row = 0; row < 5; row++) { let xx = 14; while (xx < 238) { const w = 6 + r() * 22; x.fillStyle = 'rgba(30,20,10,0.8)'; x.fillRect(xx, 18 + row * 20, w, 3 + r() * 3); xx += w + 5 + r() * 6; } }
  x.fillStyle = 'rgba(170,40,30,0.85)'; x.fillRect(14, 12, 26, 3);
  return tex(c);
}
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

export function buildWorkshop(scene) {
  const grp = new THREE.Group(), add = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; grp.add(m); return m; };
  // bench: a thick acacia top, wide and deep
  const benchT = benchTexture(); benchT.repeat.set(1, 1);
  add(new THREE.Mesh(new THREE.BoxGeometry(190, 6, 150), new THREE.MeshStandardMaterial({ map: benchT, roughness: 0.62, bumpMap: benchT, bumpScale: 0.3 })), false, true).position.set(0, BENCH_TOP - 3, 20);
  // linen pad under the board
  const pad = add(new THREE.Mesh(new THREE.CylinderGeometry(R_EDGE * D + 1.8, R_EDGE * D + 1.8, PAD, 96), new THREE.MeshStandardMaterial({ map: linenTexture(), roughness: 0.95 })), false, true); pad.position.y = BENCH_TOP + PAD / 2;
  // back wall, a window-lit blue night
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(260, 120), new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.95 })); wall.position.set(0, 50, -54); wall.receiveShadow = true; grp.add(wall);
  // scribe's palette: a wooden board with two ink wells and reed pens
  const pal = new THREE.Mesh(new THREE.BoxGeometry(30, 1.3, 5.2), new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.5 })); pal.position.set(-4, 0.65, -35); add(pal);
  for (const [dx, col] of [[8, 0xa01c14], [13, 0x0a0a0c]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.22, 24), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 })); w.position.set(-4 + dx, 1.36, -35); grp.add(w); }
  for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 19, 8), new THREE.MeshStandardMaterial({ color: 0xb8924a, roughness: 0.6 })); p.rotation.z = Math.PI / 2; p.position.set(-9, 1.55 + k * 0.02, -36.4 + k * 1.5); add(p); }
  // alabaster jars
  const alab = new THREE.MeshPhysicalMaterial({ color: 0xe6dcc6, roughness: 0.34, clearcoat: 0.35, sheen: 0.4, sheenColor: new THREE.Color(0xffe2b0), envMapIntensity: 0.9 });
  for (const [x, z, s] of [[44, -30, 1.15], [52, -22, 0.8], [-46, -26, 1.0]]) {
    const j = new THREE.Mesh(lathe([[0, 0], [2.6, 0], [4.2, 2.2], [4.7, 6], [4, 10], [2.6, 12.2], [2.9, 12.8], [3.4, 13.2], [3.1, 13.6], [2.2, 13.6], [2.2, 12.6]], 36), alab);
    j.scale.setScalar(s); j.position.set(x, 0, z); add(j);
  }
  // oil lamp (clay, spout, wick) with a flame, a halo and a point light
  const lamp = new THREE.Group(); lamp.position.set(-27, 0, 7);
  const clay = new THREE.MeshStandardMaterial({ color: 0xa5683a, roughness: 0.72 });
  const lb = new THREE.Mesh(lathe([[0, 0], [2.6, 0], [4.2, 1.2], [4.4, 2.2], [3.4, 3.1], [0, 3.2]], 32), clay); lb.castShadow = true; lb.receiveShadow = true; lamp.add(lb);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.5, 3.4, 12), clay); sp.rotation.z = -Math.PI / 2 + 0.2; sp.position.set(4.6, 2.5, 0); sp.castShadow = true; lamp.add(sp);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false })); flame.scale.set(0.8, 1.9, 0.8); flame.position.set(6.1, 4.2, 0); lamp.add(flame);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: radialTex('255,170,80', 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.position.set(6.1, 4.3, 0.2); lamp.add(halo);
  const light = new THREE.PointLight(0xffa24a, 1500, 0, 2); light.position.set(6.1, 6.5, 1); light.castShadow = false; lamp.add(light);
  lamp.userData = { light, flame, halo }; grp.add(lamp);
  // papyrus scroll, half unrolled
  const scrollT = papyrusTexture();
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshStandardMaterial({ map: scrollT, roughness: 0.9, side: THREE.DoubleSide })); sh.rotation.x = -Math.PI / 2; sh.rotation.z = 0.12; sh.position.set(31, 0.55, 21); sh.receiveShadow = true; grp.add(sh);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 9, 24), new THREE.MeshStandardMaterial({ color: 0xcdb67c, roughness: 0.85 })); roll.rotation.x = Math.PI / 2; roll.rotation.z = 0.12; roll.position.set(22.6, 1.6, 20.6); add(roll);
  // mallet and a copper chisel
  const mal = new THREE.Group(); const mh = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 5.6, 20), new THREE.MeshStandardMaterial({ color: 0x7b4c26, roughness: 0.6 })); mh.rotation.x = Math.PI / 2; mh.position.y = 1.7; mal.add(mh);
  const mhd = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 13, 12), new THREE.MeshStandardMaterial({ color: 0x8e6035, roughness: 0.6 })); mhd.rotation.z = Math.PI / 2; mhd.position.set(6.5, 1.7, 0); mal.add(mhd);
  mal.traverse((o) => { o.castShadow = true; o.receiveShadow = true; }); mal.position.set(-34, 0, 24); mal.rotation.y = 0.5; grp.add(mal);
  const chis = new THREE.Mesh(new THREE.BoxGeometry(11, 0.7, 1.1), B.material('brass', {})); chis.position.set(-24, 0.35, 29); chis.rotation.y = -0.35; add(chis);
  // a few spare glass marbles from the bank
  const marbles = [];
  for (const [x, z] of [[-20, 24], [-17.5, 26.5], [-22, 27]]) { const m = makeMarble(); m.position.set(x, 0.64 + PAD * 0, z); m.rotation.set(x, z, 1); grp.add(m); marbles.push(m); }
  // dust motes in the lamp light
  const N = 90, dp = new Float32Array(N * 3), r = rnd(77);
  for (let i = 0; i < N; i++) { dp[i * 3] = -50 + r() * 100; dp[i * 3 + 1] = 2 + r() * 40; dp[i * 3 + 2] = -40 + r() * 70; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ map: radialTex('255,225,180', 0.9), size: 0.5, transparent: true, depthWrite: false, opacity: 0.5, blending: THREE.AdditiveBlending, fog: false }));
  grp.add(dust);
  grp.userData = { lamp, dust, marbles, dustBase: dp.slice() };
  scene.add(grp);
  return grp;
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0x7f9fe6, 0x2a1d12, 0.8); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xa9c6ff, 3.0); moon.position.set(-50, 34, -26); moon.target.position.set(0, 0, 0);
  moon.shadow.camera.left = -30; moon.shadow.camera.right = 30; moon.shadow.camera.top = 30; moon.shadow.camera.bottom = -30; moon.shadow.camera.near = 20; moon.shadow.camera.far = 140;
  moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.04;
  scene.add(moon, moon.target);
  const rim = new THREE.DirectionalLight(0xffb070, 0.5); rim.position.set(40, 16, 30); scene.add(rim);
  return { hemi, moon, rim };
}
