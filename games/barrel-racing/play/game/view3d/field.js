// The arena as a real place: raked dirt with a damp-dark patch around each barrel mark, a post-and-rail fence, a banked stand of spectators on
// all four sides, light towers, trees and a hay-bale-and-trailer car park beyond. Everything is a handful of meshes (no per-frame cost).
// Three space: X = sim x (across), Y = up, Z = -sim y (so the ride goes "up" the arena toward -Z). The arena is x in [-20, 20], y in [-11, 53].
import { THREE } from '../vendor3d/index.js';
import { ARENA, BARREL_R } from '../src/consts.js';

export const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
let seed0 = 11;
const rnd = () => (seed0 = (seed0 * 1664525 + 1013904223) >>> 0) / 4294967296;
const reseed = (s) => { seed0 = s; };

export function canvasTex(w, h, draw, repeat, aniso = 4, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}

// merge [{ geo, matrix, color }] into one vertex-coloured geometry
export function merge(parts) {
  const pos = [], nor = [], col = [], idx = [];
  let base = 0;
  for (const { geo, matrix, color } of parts) {
    const p = geo.attributes.position, n = geo.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix), v = new THREE.Vector3(), nv = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix); pos.push(v.x, v.y, v.z);
      nv.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(nv.x, nv.y, nv.z);
      col.push(color[0], color[1], color[2]);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) idx.push(geo.index.getX(i) + base); else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  return out;
}
// a surface of revolution about +Y through the profile [[radius, y], ...] (THREE.LatheGeometry is not in the vendored bundle)
export function lathe(profile, segs = 24) {
  const n = profile.length, pos = [], nor = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = profile[Math.max(0, i - 1)], b = profile[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const nr = ty, ny = -tx;         // outward normal of the profile curve (profile runs bottom to top, outside at larger radius)
    for (let k = 0; k <= segs; k++) {
      const ph = k / segs * Math.PI * 2, c = Math.cos(ph), s = Math.sin(ph);
      pos.push(profile[i][0] * c, profile[i][1], profile[i][0] * s);
      nor.push(nr * c, ny, nr * s);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < segs; k++) {
    const a = i * (segs + 1) + k, b = a + 1, c = a + segs + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
const T = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return m;
};
export const solid = (parts) => new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }));

// ---- the dirt ---------------------------------------------------------------------------------------------------------------------
function dirtTexture(look) {
  reseed(7);
  const W = 1024, H = 1536;                                    // 40 m x 64 m: about 25 px per metre
  return canvasTex(W, H, (c, w, h) => {
    c.fillStyle = look.g0; c.fillRect(0, 0, w, h);
    // large soft mottling: drier and damper areas of the arena floor
    for (let i = 0; i < 160; i++) {
      const x = rnd() * w, y = rnd() * h, r = 40 + rnd() * 150, v = rnd();
      const g = c.createRadialGradient(x, y, 2, x, y, r);
      const col = v < 0.45 ? '96,66,36' : v < 0.8 ? '230,208,164' : '70,50,28';
      g.addColorStop(0, `rgba(${col},${0.10 + rnd() * 0.12})`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // the drag-harrow lines: long soft bands, every pass a little different
    for (let k = 0; k < 40; k++) {
      const x = (k + rnd() * 0.5) / 40 * w, bw = 8 + rnd() * 10;
      const g = c.createLinearGradient(x, 0, x + bw, 0);
      g.addColorStop(0, 'rgba(60,40,20,0)'); g.addColorStop(0.5, `rgba(255,244,214,${0.06 + rnd() * 0.08})`); g.addColorStop(1, 'rgba(60,40,20,0)');
      c.fillStyle = g; c.fillRect(x, 0, bw, h);
      c.fillStyle = `rgba(70,46,24,${0.05 + rnd() * 0.06})`; c.fillRect(x + bw * 0.5, 0, 1.5, h);
    }
    // grit: fine speckle and little clods
    for (let i = 0; i < 14000; i++) {
      const x = rnd() * w, y = rnd() * h, v = rnd();
      c.fillStyle = v < 0.5 ? `rgba(70,46,24,${0.12 + rnd() * 0.2})` : v < 0.85 ? `rgba(255,240,205,${0.12 + rnd() * 0.2})` : `rgba(40,26,12,${0.2 + rnd() * 0.2})`;
      const s = 0.8 + rnd() * 2.6; c.fillRect(x, y, s, s * (0.6 + rnd() * 0.8));
    }
    // a little shade along the fence
    const e = c.createLinearGradient(0, 0, w, 0);
    e.addColorStop(0, 'rgba(24,12,2,0.34)'); e.addColorStop(0.05, 'rgba(24,12,2,0)'); e.addColorStop(0.95, 'rgba(24,12,2,0)'); e.addColorStop(1, 'rgba(24,12,2,0.34)');
    c.fillStyle = e; c.fillRect(0, 0, w, h);
    const e2 = c.createLinearGradient(0, 0, 0, h);
    e2.addColorStop(0, 'rgba(24,12,2,0.34)'); e2.addColorStop(0.04, 'rgba(24,12,2,0)'); e2.addColorStop(0.96, 'rgba(24,12,2,0)'); e2.addColorStop(1, 'rgba(24,12,2,0.34)');
    c.fillStyle = e2; c.fillRect(0, 0, w, h);
  }, null, 8);
}

// the finish line: a chalked line across the arena and the electric-eye posts at each end
function timingLine(g) {
  const w = ARENA.x1 - ARENA.x0 - 1.4;
  const tex = canvasTex(512, 16, (c, cw, ch) => {
    c.fillStyle = 'rgba(250,246,232,0.92)'; c.fillRect(0, 0, cw, ch);
    c.fillStyle = 'rgba(30,24,16,0.65)';
    const n = 40, s = cw / n;
    for (let i = 0; i < n; i++) { c.fillRect(i * s, i % 2 ? 0 : ch / 2, s, ch / 2); }
  }, null, 4);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.7), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0.015, 0); g.add(m);
  const parts = [];
  for (const sx of [-1, 1]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.07, 0.09, 1.7, 8), matrix: T(sx * (w / 2 + 0.2), 0.85, 0), color: lin('#d8d2c4') });
    parts.push({ geo: new THREE.BoxGeometry(0.22, 0.2, 0.22), matrix: T(sx * (w / 2 + 0.2), 1.62, 0), color: lin('#2a2a2e') });
    parts.push({ geo: new THREE.SphereGeometry(0.06, 8, 6), matrix: T(sx * (w / 2 + 0.2), 1.76, 0), color: lin('#e8453a') });
  }
  g.add(solid(parts));
}

// ---- fence, stands, towers, surroundings ---------------------------------------------------------------------------------------------
function fence(g) {
  const parts = [], wood = lin('#8a6038'), rail = lin('#c9a674'), pipe = lin('#b9bcc0');
  const x0 = ARENA.x0 - 0.35, x1 = ARENA.x1 + 0.35, y0 = ARENA.y0 - 0.35, y1 = ARENA.y1 + 0.35;
  const post = (x, y) => { parts.push({ geo: new THREE.BoxGeometry(0.2, 1.6, 0.2), matrix: T(x, 0.8, -y), color: wood }); };
  const run = (ax, ay, bx, by) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 2.2));
    for (let i = 0; i <= n; i++) post(ax + (bx - ax) * i / n, ay + (by - ay) * i / n);
    const L = Math.hypot(bx - ax, by - ay), ang = Math.atan2(bx - ax, by - ay);
    for (const [h, col, th] of [[1.5, pipe, 0.07], [1.0, rail, 0.12], [0.5, rail, 0.12]]) {
      parts.push({ geo: new THREE.BoxGeometry(th, th, L), matrix: T((ax + bx) / 2, h, -(ay + by) / 2, 0, -ang + Math.PI, 0), color: col });
    }
  };
  run(x0, y0, x1, y0); run(x1, y0, x1, y1); run(x1, y1, x0, y1); run(x0, y1, x0, y0);
  g.add(solid(parts));
}

// ---- grandstands: stepped terraces (a real crowd stands and sits on them: crowd3d, see presenter.js) -----------------------------------------
const ST = { gap: 1.5, rows: 6, rise: 0.46, depth: 0.95, base: 0.7 };
// crowd3d stand layouts around the arena (three space: far end is -Z, the stand faces the arena)
export function standLayouts(perRowScale = 1) {
  const xa = ARENA.x0 - ST.gap, xb = ARENA.x1 + ST.gap, ya = ARENA.y0 - ST.gap, yb = ARENA.y1 + ST.gap;
  const W = xb - xa, L = yb - ya, mk = (cx, cz, yaw, width) => ({ center: [cx, ST.base, cz], yaw, rows: ST.rows, perRow: Math.round(width / 0.8 * perRowScale), width, rise: ST.rise, rowDepth: ST.depth, fill: 0.84, standing: 0.12 });
  return [
    mk(0, -yb, 0, W + 8),                       // far end faces +Z
    mk(0, -ya, Math.PI, W + 8),                 // near end faces -Z
    mk(xa, -(ya + yb) / 2, Math.PI / 2, L),     // left faces +X
    mk(xb, -(ya + yb) / 2, -Math.PI / 2, L),    // right faces -X
  ];
}
function stands(g) {
  const parts = [], conc = lin('#8d8478'), edge = lin('#5a4a3a'), rail = lin('#c8ccd0');
  for (const s of standLayouts()) {
    const c = s.center, w = s.width + 1.2;
    const cs = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    const at = (lx, lz) => [c[0] + lx * cs + lz * sn, c[2] - lx * sn + lz * cs];
    for (let r = 0; r < s.rows; r++) {
      const top = c[1] + r * s.rise, d = s.rowDepth;
      const [px, pz] = at(0, -r * d - d * 0.35);
      // a terrace: a block from the ground to the tread height, a lighter plank on its front edge
      parts.push({ geo: new THREE.BoxGeometry(w, top, d + 0.1), matrix: T(px, top / 2, pz, 0, s.yaw, 0), color: conc });
      const [fx, fz] = at(0, -r * d + d * 0.15);
      parts.push({ geo: new THREE.BoxGeometry(w, 0.1, 0.14), matrix: T(fx, top + 0.05, fz, 0, s.yaw, 0), color: edge });
    }
    // back wall + a hand rail along the front
    const [bx, bz] = at(0, -s.rows * s.rowDepth - 0.1);
    parts.push({ geo: new THREE.BoxGeometry(w, c[1] + s.rows * s.rise + 1.6, 0.3), matrix: T(bx, (c[1] + s.rows * s.rise + 1.6) / 2, bz, 0, s.yaw, 0), color: lin('#3a3028') });
    const [rx, rz] = at(0, 0.55);
    parts.push({ geo: new THREE.BoxGeometry(w, 0.06, 0.06), matrix: T(rx, c[1] + 1.0, rz, 0, s.yaw, 0), color: rail });
  }
  g.add(solid(parts));
}

function towers(g) {
  const parts = [];
  for (const [x, y] of [[-26.5, -6], [26.5, -6], [-26.5, 48], [26.5, 48], [-26.5, 21], [26.5, 21]]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.16, 0.24, 13, 8), matrix: T(x, 6.5, -y), color: lin('#8c8f94') });
    parts.push({ geo: new THREE.BoxGeometry(2.4, 0.9, 0.5), matrix: T(x, 13.2, -y, 0.35, x > 0 ? 0.5 : -0.5, 0), color: lin('#2a2c30') });
    for (let i = 0; i < 4; i++) parts.push({ geo: new THREE.BoxGeometry(0.42, 0.3, 0.1), matrix: T(x + (i - 1.5) * 0.52, 13.15, -y + 0.3, 0.35, x > 0 ? 0.5 : -0.5, 0), color: lin('#fff6d8') });
  }
  g.add(solid(parts));
}

function surroundings(g) {
  reseed(77);
  const tex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#5e7d46'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(40,70,28,0.5)' : 'rgba(150,170,92,0.45)'; c.fillRect(rnd() * w, rnd() * h, 1.5, 3 + rnd() * 3); }
  }, [70, 70], 8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.04, -21); g.add(ground);
  const parts = [];
  // trees ring
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, rr = 52 + rnd() * 28;
    const x = Math.cos(a) * rr * 0.85, y = 21 + Math.sin(a) * rr * 1.15;
    const h = 6 + rnd() * 6, col = ['#3f6f34', '#4b7d3a', '#35602d', '#567f3c'][Math.floor(rnd() * 4)];
    parts.push({ geo: new THREE.CylinderGeometry(0.25, 0.4, 2.4, 6), matrix: T(x, 1.2, -y), color: lin('#5b3d22') });
    parts.push({ geo: new THREE.SphereGeometry(h * 0.42, 9, 7), matrix: T(x, 2.4 + h * 0.4, -y, 0, 0, 0, 1, 1.2, 1), color: lin(col) });
  }
  // stock trailers, pickups and hay bales in the car park behind the far stand
  const veh = (x, y, rot, col) => {
    parts.push({ geo: new THREE.BoxGeometry(2.6, 2.3, 7.0), matrix: T(x, 1.55, -y, 0, rot, 0), color: lin(col) });
    parts.push({ geo: new THREE.BoxGeometry(2.62, 0.5, 7.1), matrix: T(x, 0.5, -y, 0, rot, 0), color: lin('#2a2a2e') });
    parts.push({ geo: new THREE.BoxGeometry(2.4, 1.5, 2.4), matrix: T(x + Math.sin(rot) * 5.3, 1.1, -y + Math.cos(rot) * 5.3, 0, rot, 0), color: lin('#2f4a6a') });
  };
  veh(-18, 66, 0.1, '#e8e4da'); veh(-8, 68, -0.05, '#d9d2c0'); veh(6, 67, 0.08, '#e0dcd0'); veh(18, 69, -0.1, '#cfc8b4');
  veh(-33, 10, Math.PI / 2 + 0.05, '#e8e4da'); veh(-34, 30, Math.PI / 2 - 0.08, '#d9d2c0'); veh(34, 4, -Math.PI / 2, '#dcd6c4'); veh(35, 28, -Math.PI / 2 + 0.1, '#e8e4da');
  for (let i = 0; i < 18; i++) {
    const x = -30 + rnd() * 60, y = 74 + rnd() * 6;
    parts.push({ geo: new THREE.BoxGeometry(1.4, 0.7, 0.8), matrix: T(x, 0.35, -y, 0, rnd() * 3, 0), color: lin('#c9ad5c') });
  }
  g.add(solid(parts));
}

// the sponsors' banners along the front of the stands: plain colour blocks, no lettering
function banners(g) {
  const parts = [], cols = ['#1f4aa8', '#c8372d', '#e0a526', '#2f7a55', '#f3ead2', '#7a3a8a'];
  const place = (x, y, rot, n, span) => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5, ox = Math.cos(rot) * t * span, oy = Math.sin(rot) * t * span;
      parts.push({ geo: new THREE.BoxGeometry(span / n * 0.9, 0.7, 0.06), matrix: T(x + ox, 0.65, -(y + oy), 0, -rot, 0), color: lin(cols[i % cols.length]) });
    }
  };
  place(0, ARENA.y0 - 0.85, 0, 10, ARENA.x1 - ARENA.x0);
  place(0, ARENA.y1 + 0.85, 0, 10, ARENA.x1 - ARENA.x0);
  g.add(solid(parts));
}

export function buildField(stage, look) {
  const g = new THREE.Group(); g.name = 'field';
  const W = ARENA.x1 - ARENA.x0, L = ARENA.y1 - ARENA.y0;
  const dirt = dirtTexture(look);
  const mat = new THREE.MeshStandardMaterial({ map: dirt, roughness: 1 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mat);
  plane.rotation.x = -Math.PI / 2; plane.position.set(0, 0, -(ARENA.y0 + ARENA.y1) / 2); plane.name = 'arena'; g.add(plane);
  timingLine(g); fence(g); stands(g); towers(g); surroundings(g); banners(g);
  stage.add(g);
  return { group: g, dirt: mat };
}

// ---- barrels ---------------------------------------------------------------------------------------------------------------------
// A 55-gallon steel drum, upright: body with two rolling hoops and a rim, painted. Origin on the ground, axis +Y. H is its height in metres.
export function makeBarrel(paint = '#e0561a', band = '#f4efe2') {
  const R = BARREL_R, H = 1.45;
  const prof = [[0.0, 0], [R * 0.92, 0], [R * 0.99, 0.05], [R, 0.12], [R * 1.0, 0.30], [R * 1.04, 0.34], [R * 1.0, 0.38], [R, 0.52 * H / 1.45 + 0.12], [R * 1.03, 0.72], [R * 1.04, 0.76], [R * 1.03, 0.80], [R, 0.95], [R, 1.18], [R * 1.04, 1.22], [R * 1.0, 1.26], [R, 1.34], [R * 0.97, 1.40], [R * 0.9, 1.44], [R * 0.82, 1.45], [R * 0.78, 1.42], [R * 0.0, 1.42]];
  const lg = lathe(prof, 28);
  // vertex colours: paint with a pale band, dark hoops and a steel lid
  const pos = lg.attributes.position, col = new Float32Array(pos.count * 3);
  const P = lin(paint), B = lin(band), D = lin('#4a2208'), S = lin('#9aa0a6');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), r = Math.hypot(pos.getX(i), pos.getZ(i));
    let c = P;
    if (y > 0.50 && y < 0.62) c = B;
    if ((y > 0.30 && y < 0.38) || (y > 0.72 && y < 0.80) || (y > 1.18 && y < 1.27)) c = D;
    if (y > 1.405 && r < 0.8 * R) c = S;
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  lg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.25, envMapIntensity: 0.6 }));
  m.name = 'barrel'; m.scale.set(1.25, 1.25, 1.25);
  return m;
}

// soft ground shadows: one dynamic mesh of n quads (position per quad each frame)
export function buildBlobs(n) {
  const tex = canvasTex(64, 64, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, null, 1);
  const pos = new Float32Array(n * 4 * 3), uv = new Float32Array(n * 4 * 2), idx = [];
  for (let i = 0; i < n; i++) { uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(35048));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.name = 'blobs';
  return {
    mesh,
    // x, z in three space; heading: yaw about Y; hl / hw: half length / half width
    set(i, x, z, heading, hl, hw, y = 0.03) {
      const s = Math.sin(heading), c = Math.cos(heading);
      const P = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
      for (let k = 0; k < 4; k++) { const lx = P[k][0], lz = P[k][1]; pos[(i * 4 + k) * 3] = x + lx * c + lz * s; pos[(i * 4 + k) * 3 + 1] = y; pos[(i * 4 + k) * 3 + 2] = z - lx * s + lz * c; }
      geo.attributes.position.needsUpdate = true;
    },
    hide(i) { for (let k = 0; k < 4; k++) pos.fill(0, (i * 4 + k) * 3, (i * 4 + k) * 3 + 3); geo.attributes.position.needsUpdate = true; },
  };
}

// dust: an instanced pool of soft round quads that face the camera
export function buildPuffs(n) {
  const tex = canvasTex(64, 64, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(226,204,168,0.9)'); gr.addColorStop(0.55, 'rgba(214,190,152,0.45)'); gr.addColorStop(1, 'rgba(206,182,144,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, null, 1);
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.8 }), n);
  mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.name = 'puffs';
  const items = []; for (let i = 0; i < n; i++) items.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 0.3, s1: 1, a: 1 });
  const m4 = new THREE.Matrix4(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  let next = 0;
  return {
    mesh,
    spawn(x, y, z, vx, vy, vz, life, s0, s1) { const it = items[next]; next = (next + 1) % n; Object.assign(it, { life, max: life, x, y, z, vx, vy, vz, s0, s1 }); },
    // draw an explicit list of { x, y, z, s } this frame instead of the pooled puffs (the sim owns its own dust particles)
    setList(list, camQ) {
      for (let i = 0; i < n; i++) {
        const q = list[i], s = q ? q.s : 0.0001;
        sc.set(s, s, s); p.set(q ? q.x : 0, q ? q.y : 0, q ? q.z : 0);
        m4.compose(p, camQ, sc); mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    update(dt, camQ) {
      for (let i = 0; i < n; i++) {
        const it = items[i];
        if (it.life > 0) { it.life -= dt; it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt; it.vx *= 0.95; it.vz *= 0.95; it.vy *= 0.96; }
        const k = it.life > 0 ? 1 - it.life / it.max : 1, s = it.life > 0 ? (it.s0 + (it.s1 - it.s0) * k) * (1 - 0.35 * k) : 0.0001;
        sc.set(s, s, s); p.set(it.x, it.y, it.z);
        m4.compose(p, camQ, sc); mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
