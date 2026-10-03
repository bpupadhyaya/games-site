// The field: a mown grass pitch with lines, low boards, two goals, a crowd behind the far end and along the sides, a ball, blob
// shadows and dust puffs. Everything is cheap (a handful of meshes). Sim axes are mirrored into three space (x_three = -x_sim) by the caller.
import { THREE } from '../vendor3d/index.js';
import { HW, HL, GOAL_HW, BALL_R, CHAMFER } from '../src/consts.js';

function canvasTex(w, h, draw, repeat, aniso = 4) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}
const plane = (w, h, mat, x, y, z, rx = -Math.PI / 2) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.x = rx; m.position.set(x, y, z); return m; };

// merge simple meshes (same material) into one geometry: positions, normals, colours
function merge(parts) {
  const pos = [], nor = [], col = [], idx = [];
  let base = 0;
  for (const { geo, matrix, color } of parts) {
    const g = geo.index ? geo : geo;
    const p = g.attributes.position, n = g.attributes.normal;
    const m = matrix, nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3(), nv = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      nv.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(nv.x, nv.y, nv.z);
      col.push(color[0], color[1], color[2]);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base); else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  return out;
}
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
export { merge, lin };

export function buildField(stage, opts = {}) {
  const g = new THREE.Group(); g.name = 'field';
  const MARGIN = 3.2;                                 // mown run-off outside the boards
  const FW = 2 * (HW + MARGIN), FL = 2 * (HL + MARGIN + 2.4);
  const tex = canvasTex(1024, Math.round(1024 * FL / FW), (c, w, h) => {
    const X = (x) => (x + FW / 2) / FW * w, Z = (z) => (1 - (z + FL / 2) / FL) * h, S = w / FW;
    // mown stripes across the field
    const stripes = 14;
    for (let i = 0; i < stripes; i++) { c.fillStyle = i % 2 ? '#3f8a3d' : '#46944a'; c.fillRect(0, (i * h) / stripes, w, h / stripes + 1); }
    const id = c.getImageData(0, 0, w, h); let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < id.data.length; i += 4) { const n = (rnd() - 0.5) * 9; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    c.putImageData(id, 0, 0);
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 0.1 * S; c.lineCap = 'butt';
    c.strokeRect(X(-HW), Z(HL), 2 * HW * S, 2 * HL * S);
    c.beginPath(); c.moveTo(X(-HW), Z(0)); c.lineTo(X(HW), Z(0)); c.stroke();
    c.beginPath(); c.arc(X(0), Z(0), 2.6 * S, 0, 6.2832); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(X(0), Z(0), 0.18 * S, 0, 6.2832); c.fill();
    // goal mouths and penalty-style marks (free-hit spots)
    for (const sg of [-1, 1]) {
      c.strokeRect(X(-GOAL_HW), Z(sg * HL) - (sg > 0 ? 0 : 0), 2 * GOAL_HW * S, 0);
      c.beginPath(); c.moveTo(X(-GOAL_HW - 1.2), Z(sg * (HL - 4.2))); c.lineTo(X(GOAL_HW + 1.2), Z(sg * (HL - 4.2))); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(X(0), Z(sg * (HL - 6.5)), 0.14 * S, 0, 6.2832); c.fill();
      // goal pocket: darker turf
      c.fillStyle = 'rgba(20,50,25,0.55)'; c.fillRect(X(-GOAL_HW), sg > 0 ? Z(HL + 2.4) : Z(-HL), 2 * GOAL_HW * S, 2.4 * S);
    }
  });
  const field = plane(FW, FL, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96, metalness: 0 }), 0, 0, 0);
  field.name = 'pitch'; g.add(field);

  // boards and goal posts as one coloured mesh
  const parts = [];
  { const og = new THREE.PlaneGeometry(700, 700); parts.push({ geo: og, matrix: new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, -0.02, 0), color: lin('#2b5a33') }); }
  const box = (w, h, d, x, y, z, color) => { const geo = new THREE.BoxGeometry(w, h, d); parts.push({ geo, matrix: new THREE.Matrix4().makeTranslation(x, y, z), color: lin(color) }); };
  const bh = 0.7, bt = 0.22, wood = '#8c5a34', woodTop = '#d9b27a', paint = '#f0e9d8';
  box(bt, bh, 2 * HL + 2 * bt + 4.8, HW + bt / 2 + 0.2, bh / 2, 1.2, wood); box(bt, bh, 2 * HL + 2 * bt + 4.8, -HW - bt / 2 - 0.2, bh / 2, 1.2, wood);
  box(0.06, 0.06, 2 * HL + 4.8, HW + 0.2 + 0.0, bh + 0.03, 1.2, woodTop); box(0.06, 0.06, 2 * HL + 4.8, -HW - 0.2, bh + 0.03, 1.2, woodTop);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const len = CHAMFER * Math.SQRT2, geo = new THREE.BoxGeometry(len, bh, bt);
    const m = new THREE.Matrix4().makeRotationY(sx * sz > 0 ? Math.PI / 4 : -Math.PI / 4); m.setPosition(sx * (HW - CHAMFER / 2 + 0.05), bh / 2, sz * (HL - CHAMFER / 2 + 0.05));
    parts.push({ geo, matrix: m, color: lin(wood) });
  }
  for (const sg of [-1, 1]) {
    const zc = sg * (HL + 0.2 + bt / 2);
    const seg = HW - GOAL_HW;
    box(seg, bh, bt, (GOAL_HW + seg / 2), bh / 2, zc, wood); box(seg, bh, bt, -(GOAL_HW + seg / 2), bh / 2, zc, wood);
    // back boards of the goal pocket and its sides
    box(2 * GOAL_HW + 0.3, bh * 1.6, bt, 0, bh * 0.8, sg * (HL + 2.6), '#243247');
    box(bt, bh * 1.6, 2.6, GOAL_HW + 0.1, bh * 0.8, sg * (HL + 1.3), '#243247'); box(bt, bh * 1.6, 2.6, -GOAL_HW - 0.1, bh * 0.8, sg * (HL + 1.3), '#243247');
    // posts: tall poles with a white ring on top
    for (const sx of [-GOAL_HW, GOAL_HW]) {
      const geo = new THREE.CylinderGeometry(0.09, 0.11, 3.4, 10); parts.push({ geo, matrix: new THREE.Matrix4().makeTranslation(sx, 1.7, sg * HL), color: lin('#f4efe4') });
      const cap = new THREE.SphereGeometry(0.14, 8, 6); parts.push({ geo: cap, matrix: new THREE.Matrix4().makeTranslation(sx, 3.45, sg * HL), color: lin(sg > 0 ? '#d0342c' : '#1f6fc4') });
    }
  }
  const furniture = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }));
  furniture.name = 'boards'; g.add(furniture);

  // crowd: a banked strip behind the far end and along both sides
  const crowdTex = canvasTex(512, 96, (c, w, h) => {
    c.fillStyle = '#16212e'; c.fillRect(0, 0, w, h);
    let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const cols = ['#c45a4a', '#e0b84c', '#3f86c9', '#e8e8ea', '#52a37a', '#8f5ec2', '#d98b3a', '#7fb3c9'];
    for (let row = 0; row < 7; row++) for (let i = 0; i < 100; i++) { c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.globalAlpha = 0.6; c.beginPath(); c.arc(i * 5.2 + rnd() * 3, 10 + row * 12 + rnd() * 3, 2.8 + rnd() * 1.2, 0, 6.3); c.fill(); }
    c.globalAlpha = 1;
  }, [1, 1]);
  const crowdMat = new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 1 });
  {
    // three banked strips (behind the far goal and along both sides) as ONE mesh
    const pos = [], nor = [], uv = [], idx = [];
    const quad = (cx, cy, cz, w, h, ry, tilt, u) => {
      const base = pos.length / 3, c = Math.cos(ry), sn = Math.sin(ry);
      for (const [px, py, tu, tv] of [[-w / 2, -h / 2, 0, 0], [w / 2, -h / 2, u, 0], [w / 2, h / 2, u, 1], [-w / 2, h / 2, 0, 1]]) {
        const yy = py * Math.cos(tilt), zz = py * Math.sin(tilt);
        pos.push(cx + px * c + zz * sn, cy + yy, cz - px * sn + zz * c); nor.push(-sn * 0.2 - sn * 0, 0.2, 0); uv.push(tu, tv);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const rise = 0.2;
    quad(0, 3.4, HL + 8, 36, 7, Math.PI, -rise, 3);
    quad(HW + 7.5, 3.0, 2, 44, 6, -Math.PI / 2, -rise, 3.6); quad(-HW - 7.5, 3.0, 2, 44, 6, Math.PI / 2, -rise, 3.6);
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setAttribute('normal', new THREE.Float32BufferAttribute(nor.map((v, i) => (i % 3 === 1 ? 1 : 0)), 3)); cg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); cg.setIndex(idx);
    crowdTex.repeat.set(1, 1); crowdMat.side = THREE.DoubleSide;
    const crowd = new THREE.Mesh(cg, crowdMat); crowd.name = 'crowd'; g.add(crowd);
  }
  stage.add(g);
  return g;
}

// ---- ball -------------------------------------------------------------------------------------------------------------------------
export function buildBall() {
  const tex = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#fbf7ee'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(160,150,130,0.7)'; c.lineWidth = 2;
    for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo((i / 8) * w, 0); c.lineTo((i / 8) * w, h); c.stroke(); }
    c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    c.fillStyle = '#d8422f'; c.fillRect(0, h * 0.44, w, h * 0.12);
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0, emissive: '#403a30', emissiveIntensity: 0.35 }));
  m.name = 'ball'; m.castShadow = false;
  return m;
}

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
    // i: slot; centre (x,z) in three space, heading (three), half length and half width (m), alpha scale 0..1 is baked in the texture
    set(i, x, z, heading, hl, hw, y = 0.02) {
      const s = Math.sin(heading), c = Math.cos(heading);
      const P = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
      for (let k = 0; k < 4; k++) { const lx = P[k][0], lz = P[k][1]; pos[(i * 4 + k) * 3] = x + lx * c + lz * s; pos[(i * 4 + k) * 3 + 1] = y; pos[(i * 4 + k) * 3 + 2] = z - lx * s + lz * c; }
      geo.attributes.position.needsUpdate = true;
    },
    hide(i) { for (let k = 0; k < 4; k++) pos.fill(0, (i * 4 + k) * 3, (i * 4 + k) * 3 + 3); geo.attributes.position.needsUpdate = true; },
  };
}

// ---- dust puffs: an instanced pool of soft round quads facing the camera --------------------------------------------------------
export function buildPuffs(n, camQuat) {
  const tex = canvasTex(64, 64, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(236,228,205,0.9)'); gr.addColorStop(0.55, 'rgba(226,214,186,0.45)'); gr.addColorStop(1, 'rgba(220,208,180,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, null, 1);
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 }), n);
  mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.name = 'puffs';
  const items = []; for (let i = 0; i < n; i++) items.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 0.3, s1: 1 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  let next = 0;
  return {
    mesh,
    spawn(x, y, z, vx, vy, vz, life, s0, s1) { const it = items[next]; next = (next + 1) % n; Object.assign(it, { life, max: life, x, y, z, vx, vy, vz, s0, s1 }); },
    update(dt) {
      for (let i = 0; i < n; i++) {
        const it = items[i];
        if (it.life > 0) { it.life -= dt; it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt; it.vx *= 0.95; it.vz *= 0.95; it.vy *= 0.97; }
        const k = it.life > 0 ? 1 - it.life / it.max : 1, s = it.life > 0 ? it.s0 + (it.s1 - it.s0) * k : 0.0001;
        sc.set(s, s, s); p.set(it.x, it.y, it.z);
        m4.compose(p, camQuat, sc); mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
