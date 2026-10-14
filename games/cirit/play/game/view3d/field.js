// The field: a trodden Anatolian highland arena with three lanes and chalk lines, timber grandstands (the people in them are crowd3d
// humans, built by the presenter) with plain bunting, wooden rails, and the scenery3d 'steppe-arena' backdrop (sky, hills, ground).
// Everything the camera sees up close is a handful of merged meshes. Sim axes are mirrored into three space (x_three = -x_sim) by the caller.
import { THREE, buildScenery } from '../vendor3d/index.js';
import { LANES, Z_END, Z_START, FIELD_HW } from '../src/consts.js';

function canvasTex(w, h, draw, repeat, aniso = 4) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}
let seed0 = 5;
const rnd = () => (seed0 = (seed0 * 1664525 + 1013904223) >>> 0) / 4294967296;
const plane = (w, h, mat, x, y, z, rx = -Math.PI / 2) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.x = rx; m.position.set(x, y, z); return m; };
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
function merge(parts) {
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

// the grandstands: centre = where the FIRST row stands, yaw = the direction the spectators face (toward the field), rows climb away from it
const SX = FIELD_HW + 3.4;
export const STANDS = [
  { name: 'far', center: [SX, 0.35, -2], yaw: -Math.PI / 2, rows: 6, perRow: 66, width: 98, rise: 0.46, rowDepth: 0.92 },
  { name: 'near', center: [-SX, 0.35, -2], yaw: Math.PI / 2, rows: 5, perRow: 60, width: 98, rise: 0.46, rowDepth: 0.92 },
  { name: 'end', center: [0, 0.35, Z_END + 8], yaw: Math.PI, rows: 6, perRow: 34, width: 2 * SX - 2, rise: 0.46, rowDepth: 0.92 },
];

export function buildField(stage, { quality = 'high' } = {}) {
  const g = new THREE.Group(); g.name = 'field';
  const L = 190, W = 2 * (FIELD_HW + 1.5);
  // the scenery kit: sky, steppe backdrop, rolling hills, ground disc (the trodden arena is drawn over it)
  let scenery = null;
  try { scenery = buildScenery({ layers: [
      { t: 'sky', id: 'sky-overcast' }, { t: 'backdrop', id: 'bd-steppe' },
      { t: 'ground', id: 'gr-steppe', size: 260, repeat: 28 },
      { t: 'band', id: 'band-hills-green', r: 120, h: 18, grade: 'steppe' },
      { t: 'cutouts', id: 'tr-broad-tree', count: 6, r: [70, 95], scale: [7, 10], seed: 8, sway: 0.5 },
    ], timeOfDay: 'day', quality, clouds: true }); g.add(scenery.group); } catch (e) { console.warn('scenery failed', e); }
  // the trodden arena strip with soft edges that blend into the steppe
  const dirt = canvasTex(512, 1024, (c, w, h) => {
    c.fillStyle = '#bfa270'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = rnd(); c.fillStyle = v < 0.4 ? 'rgba(110,84,50,0.22)' : v < 0.75 ? 'rgba(232,208,158,0.25)' : 'rgba(96,104,60,0.16)'; c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 4, 1 + rnd() * 2.5); }
    for (let i = 0; i < 240; i++) { const x = rnd() * w, y = rnd() * h, r = 6 + rnd() * 18; const gr = c.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, 'rgba(90,66,40,0.18)'); gr.addColorStop(1, 'rgba(90,66,40,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
  }, [1, L / 14], 8);
  const arenaMat = new THREE.MeshStandardMaterial({ map: dirt, roughness: 1 });
  const arena = plane(W, L, arenaMat, 0, 0.012, 0); arena.name = 'arena'; g.add(arena);
  // soft verge strips on either side so the strip melts into the ground
  const edgeTex = canvasTex(64, 8, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(191,162,112,0.95)'); gr.addColorStop(1, 'rgba(191,162,112,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, null, 1);
  const edgeMat = new THREE.MeshBasicMaterial({ map: edgeTex, transparent: true, depthWrite: false });
  const e1 = plane(5, L, edgeMat, W / 2 + 2.5, 0.011, 0); e1.rotation.z = 0; g.add(e1);
  const e2 = plane(5, L, edgeMat, -W / 2 - 2.5, 0.011, 0); e2.rotation.z = Math.PI; g.add(e2);
  // trodden lanes and chalk
  const laneTex = canvasTex(64, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(110,84,50,0)'); gr.addColorStop(0.5, 'rgba(110,84,50,0.42)'); gr.addColorStop(1, 'rgba(110,84,50,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { c.fillStyle = `rgba(70,52,30,${0.1 + rnd() * 0.15})`; c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3); }
  }, [1, L / 8], 4);
  const laneMat = new THREE.MeshBasicMaterial({ map: laneTex, transparent: true, depthWrite: false });
  for (const lx of LANES) g.add(plane(2.4, L, laneMat, -lx, 0.02, 0));
  const chalk = new THREE.MeshBasicMaterial({ color: '#f6f0dc', transparent: true, opacity: 0.85, depthWrite: false });
  const line = (w, d, x, z) => { const p = plane(w, d, chalk, x, 0.03, z); g.add(p); return p; };
  line(W - 1.6, 0.22, 0, Z_END); line(W - 1.6, 0.22, 0, -Z_END); line(W - 1.6, 0.14, 0, -Z_START);
  const dashTex = canvasTex(8, 64, (c, w, h) => { c.fillStyle = 'rgba(255,250,235,0.75)'; c.fillRect(0, 0, w, h * 0.45); }, [1, L / 3.2], 1);
  const dashMat = new THREE.MeshBasicMaterial({ map: dashTex, transparent: true, depthWrite: false });
  for (const dx of [-1.3, 1.3]) g.add(plane(0.12, L, dashMat, dx, 0.025, 0));

  // ---- merged wooden furniture: rails, grandstands, bunting
  const parts = [];
  const mat4 = new THREE.Matrix4(), rot = new THREE.Matrix4();
  const box = (w, h, d, x, y, z, color, ry = 0) => { mat4.makeRotationY(ry); mat4.setPosition(x, y, z); parts.push({ geo: new THREE.BoxGeometry(w, h, d), matrix: mat4.clone(), color: lin(color) }); };
  const cyl = (r0, r1, h, x, y, z, color, seg = 8) => parts.push({ geo: new THREE.CylinderGeometry(r0, r1, h, seg), matrix: new THREE.Matrix4().makeTranslation(x, y, z), color: lin(color) });
  const woods = ['#8a5a30', '#9a6a3a', '#7a4d28', '#a77a46', '#6f4725'];
  const wood = (i) => woods[Math.abs(i) % woods.length];
  // rails along both long edges, every 5 m a post
  for (const sx of [FIELD_HW + 0.8, -(FIELD_HW + 0.8)]) {
    for (let z = -95; z <= 95; z += 5) { box(0.14, 1.15, 0.14, sx, 0.57, z, '#6f4725'); }
    box(0.1, 0.1, 190, sx, 1.08, 0, '#b58450'); box(0.1, 0.1, 190, sx, 0.62, 0, '#a77a46');
  }
  // a stand: local (u along the front, w away from the field, y up) -> world through the stand's yaw
  const placeStand = (S) => {
    const cs = Math.cos(S.yaw), sn = Math.sin(S.yaw);
    const wx = (u, w) => S.center[0] + u * cs - w * sn, wz = (u, w) => S.center[2] - u * sn - w * cs;
    const Lw = S.width + 4, depth = S.rowDepth, rise = S.rise, rows = S.rows;
    const B = (bw, bh, bd, u, w, y, color) => box(bw, bh, bd, wx(u, w), S.center[1] + y, wz(u, w), color, S.yaw);
    // front fascia in painted boards
    B(Lw, 0.9, 0.12, 0, -0.62, -0.1, '#5b3a1e');
    for (let k = -Math.floor(Lw / 4); k <= Math.floor(Lw / 4); k++) B(1.4, 0.55, 0.05, k * 4, -0.7, 0.05, (k & 1) ? '#c9402c' : '#e8d9b0');
    // steps and benches
    for (let r = 0; r < rows; r++) {
      const h = r * rise + 0.34, w = r * depth;
      B(Lw, h, depth, 0, w - 0.1 + depth / 2 - 0.46, h / 2 - 0.34, wood(r * 3 + 1));
      B(Lw, 0.06, 0.38, 0, w - 0.46 + 0.5, r * rise + 0.43, wood(r * 5 + 2));              // seat plank
    }
    // back wall and posts, a plank canopy on the upper rows
    const wb = rows * depth + 0.2, hb = (rows - 1) * rise;
    B(Lw, hb + 3.6, 0.14, 0, wb, (hb + 3.6) / 2 - 0.34, '#6f4725');
    const nPost = Math.floor(Lw / 6);
    for (let k = 0; k <= nPost; k++) {
      const u = -Lw / 2 + k * (Lw / nPost);
      B(0.2, hb + 3.8, 0.2, u, wb - 0.1, (hb + 3.8) / 2 - 0.34, '#5b3a1e');
      B(0.16, 0.16, 2.2, u, wb - 1.1, hb + 3.55, '#5b3a1e');
    }
    // canopy: a slanted cloth roof in alternating bands
    const roofY = hb + 3.55, roofW = 3.0;
    for (let k = 0; k < Math.floor(Lw / 2); k++) {
      const u = -Lw / 2 + 1 + k * 2;
      const cm = new THREE.Matrix4().makeRotationY(S.yaw); const tilt = new THREE.Matrix4().makeRotationX(0.18);
      const loc = new THREE.Matrix4().makeTranslation(0, 0, 0);
      cm.multiply(tilt);
      cm.setPosition(wx(u, wb - 1.4), S.center[1] + roofY, wz(u, wb - 1.4));
      parts.push({ geo: new THREE.BoxGeometry(1.95, 0.05, roofW), matrix: cm, color: lin(k % 2 ? '#e8d9b0' : '#b3262e') });
      void loc;
    }
    // bunting hung along the roof's front edge
    const pen = ['#d6453a', '#f2c230', '#2f7fc4', '#f5ecd2', '#4aa56a'];
    for (let k = 0; k < Math.floor(Lw / 0.9); k++) {
      const u = -Lw / 2 + 0.45 + k * 0.9, sag = Math.sin(((k % 8) + 0.5) / 8 * Math.PI) * 0.18;
      parts.push({ geo: new THREE.CylinderGeometry(0.19, 0.001, 0.46, 3), matrix: new THREE.Matrix4().makeTranslation(wx(u, wb - 2.5), S.center[1] + roofY - 0.5 - sag, wz(u, wb - 2.5)), color: lin(pen[k % pen.length]) });
    }
  };
  for (const S of STANDS) placeStand(S);
  const furniture = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }));
  furniture.name = 'furniture'; g.add(furniture);
  stage.add(g);
  return { group: g, scenery };
}

export { merge, lin };

// ---- blob shadows: one dynamic mesh of n soft ellipses ------------------------------------------------------------------------
export function buildBlobs(n) {
  const tex = canvasTex(64, 64, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
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
    set(i, x, z, heading, hl, hw, y = 0.03) {
      const s = Math.sin(heading), c = Math.cos(heading);
      const P = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
      for (let k = 0; k < 4; k++) { const lx = P[k][0], lz = P[k][1]; pos[(i * 4 + k) * 3] = x + lx * c + lz * s; pos[(i * 4 + k) * 3 + 1] = y; pos[(i * 4 + k) * 3 + 2] = z - lx * s + lz * c; }
      geo.attributes.position.needsUpdate = true;
    },
    hide(i) { for (let k = 0; k < 4; k++) pos.fill(0, (i * 4 + k) * 3, (i * 4 + k) * 3 + 3); geo.attributes.position.needsUpdate = true; },
  };
}

// ---- dust puffs: an instanced pool of soft round quads facing the camera ----------------------------------------------------------
export function buildPuffs(n, camQuat) {
  const tex = canvasTex(64, 64, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(236,222,192,0.9)'); gr.addColorStop(0.55, 'rgba(222,206,172,0.45)'); gr.addColorStop(1, 'rgba(216,200,168,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, null, 1);
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 }), n);
  mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.name = 'puffs';
  const items = []; for (let i = 0; i < n; i++) items.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 0.3, s1: 1 });
  const m4 = new THREE.Matrix4(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  let next = 0;
  return {
    mesh, cam: camQuat,
    spawn(x, y, z, vx, vy, vz, life, s0, s1) { const it = items[next]; next = (next + 1) % n; Object.assign(it, { life, max: life, x, y, z, vx, vy, vz, s0, s1 }); },
    update(dt, camQ = camQuat) {
      for (let i = 0; i < n; i++) {
        const it = items[i];
        if (it.life > 0) { it.life -= dt; it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt; it.vx *= 0.95; it.vz *= 0.95; it.vy *= 0.97; }
        const k = it.life > 0 ? 1 - it.life / it.max : 1, s = it.life > 0 ? it.s0 + (it.s1 - it.s0) * k : 0.0001;
        sc.set(s, s, s); p.set(it.x, it.y, it.z);
        m4.compose(p, camQ, sc); mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
