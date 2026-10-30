// Tangram 3D world: a lamp-lit night table. Cloisonne enamel pieces (the seven game colours, fine gilt wire scrolls under a clear
// glaze, gilt edges), an indigo velvet puzzle board with a gilt frame and the silhouette inlaid in black lacquer, a walnut tray,
// a walnut desk, a candle in a brass holder, a porcelain tea bowl and a pattern card. Everything is procedural (canvas textures,
// extruded shapes), so nothing is downloaded. Coordinates: X = virtual x, Z = virtual y (screen down), Y = height, 1 unit = 1 virtual px.
import * as THREE from '../vendor3d/three.js';
import { KINDS } from '../src/geom.js';
import { PIECE_COLORS } from '../src/art.js';

export const TILT = 34 * Math.PI / 180;           // camera tilt from straight down: the front walls of pieces and boards show
export const TAN = Math.tan(TILT);
export const T_UNITS = 0.17;                      // piece thickness in puzzle units (about 5 mm on a 12 cm set)
const BEV = 0.028;                                 // piece bevel in puzzle units

const rnd = (() => { let s = 1234567; return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); })();
const canvasTex = (w, h, draw, srgb = true) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
};

// ------------------------------------------------------------------------------------------------ textures
function woodTex(base, dark, light, rings = 70) {
  return canvasTex(1024, 512, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < rings; i++) {
      const y0 = rnd() * h, amp = 4 + rnd() * 14, f = 0.004 + rnd() * 0.01, ph = rnd() * 6;
      x.strokeStyle = rnd() < 0.55 ? dark : light; x.globalAlpha = 0.08 + rnd() * 0.16; x.lineWidth = 1 + rnd() * 3.5;
      x.beginPath();
      for (let px = -10; px <= w + 10; px += 8) { const y = y0 + Math.sin(px * f + ph) * amp + Math.sin(px * f * 3.1 + ph * 2) * amp * 0.25; px < 0 ? x.moveTo(px, y) : x.lineTo(px, y); }
      x.stroke();
      // draw a wrapped copy so the texture tiles vertically
      x.save(); x.translate(0, y0 > h / 2 ? -h : h); x.stroke(); x.restore();
    }
    x.globalAlpha = 1;
    for (let i = 0; i < 9000; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,230,200,0.035)'; x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 5, 1); }
  });
}
function velvetTex() {
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#26225e'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) { const v = rnd(); x.fillStyle = v < 0.5 ? `rgba(10,8,40,${0.25 * rnd()})` : `rgba(120,110,210,${0.06 * rnd()})`; x.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    // a faint woven damask of small cloud medallions
    x.strokeStyle = 'rgba(150,140,235,0.10)'; x.lineWidth = 2;
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
      const cx = gx * 128 + (gy % 2 ? 64 : 0), cy = gy * 128 + 64;
      for (const r of [14, 24]) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); }
      for (let a = 0; a < 4; a++) { x.beginPath(); x.arc(cx + Math.cos(a * Math.PI / 2) * 36, cy + Math.sin(a * Math.PI / 2) * 36, 8, 0, Math.PI * 1.5); x.stroke(); }
    }
  });
}
// cloisonne: enamel in the piece colour with soft firing variations, fine gilt wire scrolls; the metal map marks the wire
function wirePattern(x, w, h) {
  x.lineCap = 'round'; x.lineJoin = 'round';
  const cell = w / 4;
  for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
    const cx = gx * cell + (gy % 2 ? cell / 2 : 0) + cell / 2, cy = gy * cell + cell / 2, d = (gx + gy) % 2 ? 1 : -1;
    for (const X of cx > w - cell / 2 ? [cx, cx - w] : [cx]) {
      x.beginPath();
      for (let a = 0; a <= Math.PI * 3.2; a += 0.12) { const r = 4 + a * 7; const px = X + Math.cos(a * d) * r, py = cy + Math.sin(a * d) * r * 0.8; a ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    }
  }
  void h;
}
const enamelTexCache = new Map();
function enamelTex(col) {
  if (enamelTexCache.has(col)) return enamelTexCache.get(col);
  const t = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = col; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const cx = rnd() * w, cy = rnd() * h, r = 20 + rnd() * 90, g = x.createRadialGradient(cx, cy, 0, cx, cy, r), lt = rnd() < 0.5;
      g.addColorStop(0, lt ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    }
    x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 5; wirePattern(x, w, h);
    x.strokeStyle = 'rgba(240,206,130,0.75)'; x.lineWidth = 2.5; wirePattern(x, w, h);
  });
  enamelTexCache.set(col, t); return t;
}
let wireMetal = null;
function wireMetalTex() {
  if (wireMetal) return wireMetal;
  wireMetal = canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 3.5; wirePattern(x, w, h); }, false);
  return wireMetal;
}
export function glowTex() {
  return canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.25, 'rgba(255,190,90,0.55)'); g.addColorStop(1, 'rgba(255,150,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
}

// ------------------------------------------------------------------------------------------------ materials
let M = null;
export function materials() {
  if (M) return M;
  const desk = woodTex('#2a160d', '#120804', '#5a3420', 90);
  const tray = woodTex('#6a3f26', '#2e170b', '#a06a40', 70);
  M = {
    desk: new THREE.MeshPhysicalMaterial({ map: desk, roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.25, color: 0xffffff }),
    tray: new THREE.MeshPhysicalMaterial({ map: tray, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.18 }),
    trayIn: new THREE.MeshStandardMaterial({ map: tray, roughness: 0.75, color: 0xb59a88 }),
    velvet: new THREE.MeshPhysicalMaterial({ map: velvetTex(), roughness: 0.92, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0x8f86ff), color: 0xffffff }),
    gilt: new THREE.MeshStandardMaterial({ color: 0xe0b863, metalness: 1, roughness: 0.27 }),
    giltDim: new THREE.MeshStandardMaterial({ color: 0xc9a050, metalness: 1, roughness: 0.4 }),
    ink: new THREE.MeshLambertMaterial({ color: 0x0a0b1e }),
    guide: new THREE.MeshBasicMaterial({ color: 0xe8c46a, transparent: true, opacity: 0.45, depthWrite: false }),
    snap: new THREE.MeshBasicMaterial({ color: 0xffe7a0, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }),
    porcelain: new THREE.MeshPhysicalMaterial({ color: 0xf4f1ea, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }),
    cobalt: new THREE.MeshPhysicalMaterial({ color: 0x1f3c96, roughness: 0.2, clearcoat: 1 }),
    tea: new THREE.MeshPhysicalMaterial({ color: 0x6b4012, roughness: 0.05, clearcoat: 1, transmission: 0, metalness: 0 }),
    wax: new THREE.MeshPhysicalMaterial({ color: 0xf2e6cf, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffd9a0), emissive: 0x3a2008, emissiveIntensity: 0.6 }),
    wick: new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 1 }),
  };
  M.pieces = PIECE_COLORS.map((c) => new THREE.MeshPhysicalMaterial({
    map: enamelTex(c), metalnessMap: wireMetalTex(), metalness: 1, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.12, emissive: 0x000000, envMapIntensity: 0.55,
  }));
  return M;
}
export function disposeAll() {
  if (!M) return;
  for (const m of [...Object.values(M).filter((v) => v && v.isMaterial), ...M.pieces]) { for (const k of ['map', 'metalnessMap']) m[k]?.dispose(); m.dispose(); }
  M = null; enamelTexCache.clear(); wireMetal = null;
}

// ------------------------------------------------------------------------------------------------ geometry helpers
// A shape given in (x, z) becomes an extruded solid from y = 0 to y = depth (plus bevel).
const shapeXZ = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); return s; };
const pathXZ = (pts) => { const s = new THREE.Path(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); return s; };
function rrPts(x, z, w, h, r, seg = 6) {
  r = Math.min(r, w / 2, h / 2);
  const out = [], C = [[x + w - r, z + r, -Math.PI / 2], [x + w - r, z + h - r, 0], [x + r, z + h - r, Math.PI / 2], [x + r, z + r, Math.PI]];
  for (const [cx, cz, a0] of C) for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  return out;
}
function extrude(shape, depth, bevel = 0, curve = 6) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: curve });
  g.rotateX(-Math.PI / 2);
  return g;
}
// flat strips (quads) along segments, at y = 0, normal up
function stripsGeo(segs, width) {
  const pos = [], nor = [], hw = width / 2;
  for (const [[ax, az], [bx, bz]] of segs) {
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, nx = -dz / L * hw, nz = dx / L * hw, ex = dx / L * hw, ez = dz / L * hw;
    const p = [[ax - nx - ex, az - nz - ez], [bx - nx + ex, bz - nz + ez], [bx + nx + ex, bz + nz + ez], [ax + nx - ex, az + nz - ez]];
    for (const i of [0, 2, 1, 0, 3, 2]) { pos.push(p[i][0], 0, p[i][1]); nor.push(0, 1, 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
function insetConvex(pts, d) {
  // signed area > 0 means counter-clockwise in (x, y)
  let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  const sgn = a > 0 ? 1 : -1, n = pts.length, lines = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
    const nx = -dy / L * sgn, ny = dx / L * sgn;            // inward normal
    lines.push([p[0] + nx * d, p[1] + ny * d, dx, dy]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const [x1, y1, dx1, dy1] = lines[(i - 1 + n) % n], [x2, y2, dx2, dy2] = lines[i];
    const den = dx1 * dy2 - dy1 * dx2, t = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / den;
    out.push([x1 + dx1 * t, y1 + dy1 * t]);
  }
  return out;
}
const disposeTree = (o) => o.traverse((c) => { if (c.geometry) c.geometry.dispose(); });

// ------------------------------------------------------------------------------------------------ pieces
// One geometry per kind and side, in puzzle units, centred on the piece centroid, centred vertically (y from -T/2 to T/2).
const pieceGeoCache = new Map();
export function pieceGeo(kind, f) {
  const key = kind * 2 + f;
  if (pieceGeoCache.has(key)) return pieceGeoCache.get(key);
  const k = KINDS[kind];
  let pts = k.verts.map(([x, y]) => [x - k.centroid[0], y - k.centroid[1]]);
  if (f) pts = pts.map(([x, y]) => [-x, y]).reverse();
  const g = extrude(shapeXZ(insetConvex(pts, BEV)), T_UNITS - 2 * BEV, BEV, 1);
  g.translate(0, -(T_UNITS / 2 - BEV), 0);
  g.computeVertexNormals();
  // caps tile the cloisonne texture about every 2.2 units
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.62 + kind * 0.13, uv.getY(i) * 0.62 + kind * 0.29);
  pieceGeoCache.set(key, g); return g;
}
export function makePiece(kind) {
  const m = materials();
  const pivot = new THREE.Group();
  const meshes = [0, 1].map((f) => { const me = new THREE.Mesh(pieceGeo(kind, f), [m.pieces[kind], m.gilt]); me.castShadow = true; me.receiveShadow = true; pivot.add(me); return me; });
  pivot.rotation.order = 'ZYX';
  return { pivot, meshes, kind, mat: m.pieces[kind] };
}

// ------------------------------------------------------------------------------------------------ table pieces
export const BOARD_T = 12, TRAY_T = 12, RIM_H = 7;
export function desk(x0, z0, w, h) {
  const m = materials();
  const g = new THREE.PlaneGeometry(w, h); g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, m.desk); mesh.position.set(x0 + w / 2, -BOARD_T, z0 + h / 2); mesh.receiveShadow = true;
  m.desk.map.repeat.set(w / 900, h / 450);
  return mesh;
}
// The puzzle board: a gilt frame with an indigo velvet field; its top is y = 0 and it covers rect r on screen.
export function board(r) {
  const m = materials(), grp = new THREE.Group(), fr = 7, rad = 26;
  const frame = new THREE.Mesh(extrude(shapeXZ(rrPts(r.x, r.y, r.w, r.h, rad)), BOARD_T - 2.5, 2.5, 6), m.gilt);
  frame.position.y = -BOARD_T - 0.8;   // top 0.8 below the velvet frame.castShadow = frame.receiveShadow = true;
  const field = new THREE.Mesh(extrude(shapeXZ(rrPts(r.x + fr, r.y + fr, r.w - 2 * fr, r.h - 2 * fr, rad - fr)), 1.5, 0), m.velvet);
  field.position.y = -1.5; field.receiveShadow = true;
  const uv = field.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 420, uv.getY(i) / 420);
  grp.add(frame, field);
  grp.position.z = 0;
  return grp;
}
// The tray: a walnut slab with a raised rim inside rect r; pieces rest on its floor at y = 0.
export function tray(r) {
  const m = materials(), grp = new THREE.Group(), rim = 11, rad = 26;
  const slab = new THREE.Mesh(extrude(shapeXZ(rrPts(r.x, r.y, r.w, r.h, rad)), TRAY_T - 2, 2, 6), m.trayIn);
  slab.position.y = -TRAY_T; slab.receiveShadow = true; slab.castShadow = true;
  const outer = shapeXZ(rrPts(r.x, r.y, r.w, r.h, rad)); outer.holes.push(pathXZ(rrPts(r.x + rim, r.y + rim, r.w - 2 * rim, r.h - 2 * rim, rad - rim).reverse()));
  const lip = new THREE.Mesh(extrude(outer, RIM_H - 1.5, 1.5, 6), m.tray); lip.castShadow = lip.receiveShadow = true;
  const fix = (geo, sc) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / sc, uv.getY(i) / sc * 2); };
  fix(slab.geometry, 900); fix(lip.geometry, 900);
  grp.add(slab, lip);
  return grp;
}
// The silhouette inlaid in black lacquer with a gilt line, plus the dissection guides for the first chapter. loopsPx in (x, z).
export function inlay(loopsPx, guidesPx) {
  const m = materials(), grp = new THREE.Group();
  for (const loop of loopsPx) {
    const sh = new THREE.Mesh(new THREE.ShapeGeometry(shapeXZ(loop)).rotateX(-Math.PI / 2), m.ink); sh.position.y = 0.5; sh.receiveShadow = true; grp.add(sh);
    const segs = loop.map((p, i) => [p, loop[(i + 1) % loop.length]]);
    const rim = new THREE.Mesh(stripsGeo(segs, 3.2), m.gilt); rim.position.y = 0.9; rim.receiveShadow = true; grp.add(rim);
  }
  if (guidesPx && guidesPx.length) {
    const segs = [];
    for (const poly of guidesPx) for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 14));
      for (let j = 0; j < n; j += 1) { const t0 = j / n, t1 = (j + 0.5) / n; segs.push([[a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]]); }
    }
    const gd = new THREE.Mesh(stripsGeo(segs, 2), m.guide); gd.position.y = 0.95; gd.renderOrder = 2; grp.add(gd);
  }
  return grp;
}
// A round velvet mat with a gilt ring for the title's attract figure (centre cx, cz, radius r).
export function mat(cx, cz, r) {
  const m = materials(), grp = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r + 8, r + 10, BOARD_T - 1, 72), m.gilt); ring.position.set(cx, -BOARD_T / 2 - 0.5, cz); ring.castShadow = ring.receiveShadow = true;
  const field = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.5, 72), m.velvet); field.position.set(cx, -0.75, cz); field.receiveShadow = true;
  const uv = field.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r / 210, uv.getY(i) * r / 210);
  grp.add(ring, field);
  return grp;
}
export function snapGeo(polyPx) { return new THREE.ShapeGeometry(shapeXZ(polyPx)).rotateX(-Math.PI / 2); }

// ------------------------------------------------------------------------------------------------ props (title and documents)
// size: px per cm. Each prop is built at the origin; the presenter places it.
export function teaBowl(cm) {
  const m = materials(), grp = new THREE.Group();
  const prof = [[0, 0], [2.0, 0], [2.2, 0.35], [3.2, 1.2], [4.0, 3.0], [4.15, 4.2], [3.95, 4.25], [3.75, 3.1], [2.9, 1.6], [0, 1.25]].map(([r, y]) => new THREE.Vector2(r * cm, y * cm));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), m.porcelain); bowl.castShadow = bowl.receiveShadow = true;
  const band = new THREE.Mesh(new THREE.TorusGeometry(4.08 * cm, 0.12 * cm, 6, 64), m.cobalt); band.rotation.x = Math.PI / 2; band.position.y = 3.7 * cm;
  const tea = new THREE.Mesh(new THREE.CircleGeometry(3.55 * cm, 48), m.tea); tea.rotation.x = -Math.PI / 2; tea.position.y = 3.0 * cm;
  const saucer = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [5.4, 0], [6.0, 0.5], [5.8, 0.6], [4.5, 0.35], [0, 0.3]].map(([r, y]) => new THREE.Vector2(r * cm, y * cm)), 56), m.porcelain);
  saucer.castShadow = saucer.receiveShadow = true;
  bowl.position.y = 0.3 * cm;
  grp.add(saucer, bowl, band, tea);
  return grp;
}
export function candle(cm, glow) {
  const m = materials(), grp = new THREE.Group();
  const holder = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [3.6, 0], [3.8, 0.3], [3.3, 0.6], [1.6, 0.8], [1.5, 1.6], [1.75, 1.8], [0, 1.8]].map(([r, y]) => new THREE.Vector2(r * cm, y * cm)), 48), m.gilt);
  holder.castShadow = holder.receiveShadow = true;
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(1.3 * cm, 1.35 * cm, 5.5 * cm, 36), m.wax); wax.position.y = (1.8 + 2.75) * cm; wax.castShadow = true;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * cm, 0.07 * cm, 0.5 * cm, 6), m.wick); wick.position.y = (1.8 + 5.5 + 0.2) * cm;
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd48a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flame.scale.set(2.2 * cm, 3.4 * cm, 1); flame.position.y = (1.8 + 5.5 + 1.3) * cm;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff9a40, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(14 * cm, 14 * cm, 1); halo.position.y = (1.8 + 5.5 + 1.0) * cm;
  grp.add(holder, wax, wick, halo, flame);
  grp.userData = { flame, halo, top: (1.8 + 5.5 + 1.3) * cm };
  return grp;
}
// a pattern card: three figures from the game printed in ink on warm paper
export function patternCard(w, h, loopsList) {
  const tex = canvasTex(512, Math.round(512 * h / w), (x, W, H) => {
    x.fillStyle = '#efe2c4'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(120,90,50,${0.05 * rnd()})`; x.fillRect(rnd() * W, rnd() * H, 2, 2); }
    x.strokeStyle = 'rgba(160,40,30,0.75)'; x.lineWidth = 6; x.strokeRect(14, 14, W - 28, H - 28);
    x.strokeStyle = 'rgba(160,40,30,0.4)'; x.lineWidth = 2; x.strokeRect(26, 26, W - 52, H - 52);
    loopsList.slice(0, 3).forEach((loops, i) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const l of loops) for (const [px, py] of l) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
      const cw = (W - 80) / 3, sc = Math.min((cw - 24) / (x1 - x0), (H - 110) / (y1 - y0)), ox = 40 + i * cw + (cw - (x1 - x0) * sc) / 2, oy = 50 + (H - 100 - (y1 - y0) * sc) / 2;
      x.beginPath();
      for (const l of loops) l.forEach(([px, py], j) => (j ? x.lineTo(ox + (px - x0) * sc, oy + (py - y0) * sc) : x.moveTo(ox + (px - x0) * sc, oy + (py - y0) * sc)));
      x.closePath(); x.fillStyle = 'rgba(22,18,26,0.9)'; x.fill();
    });
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const g = new THREE.BoxGeometry(w, 1.2, h);
  const paper = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), edge = new THREE.MeshStandardMaterial({ color: 0xe6d6b2, roughness: 0.9 });
  const me = new THREE.Mesh(g, [edge, edge, paper, edge, edge, edge]); me.castShadow = me.receiveShadow = true;
  me.userData.dispose = () => { tex.dispose(); paper.dispose(); edge.dispose(); };
  return me;
}
export { disposeTree, rrPts };
