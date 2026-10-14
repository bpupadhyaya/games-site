// Real 3D people for Blind Man's Buff (presentation only: reads positions and headings from the sim state, never writes back).
//
// The shared view3d layer supplies the person (athlete_m / athlete_f), the stage and the IK; this file dresses them in garden-party clothes
// (frock coats, skirts, sleeves, hats, wigs, the white blindfold) with simple geometry parented to the skeleton, and drives them from the
// room's coordinates. The result is drawn into an off-screen WebGL canvas and composited by the 2D room picture (see drawPeople()).
//
// Camera: an oblique "top-down with a lean" projection. Floor points land exactly where the 2D floor draws them (the picture is stretched
// vertically by 1/sin(pitch)), so people stand on the 2D room while their height leans up the screen like a theatre set.
import { createStage, loadHuman, THREE } from '../vendor3d/index.js';
import { buildRoom } from './room.js';
import { VENUES } from '../src/engine.js';

const { Vector3 } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const UNITS_PER_M = 1000 / 6.4;     // the 1000-unit room is 6.4 m wide in the picture (a guest is about 80 units across the shoulders)
const PITCH = 54 * D2R;                       // camera elevation above the floor plane
const HEAD_ROOM_M = 2.1;                      // metres of height drawn above the room's top edge
const DIST = 60;                               // near-orthographic

const VENUE_LIGHT = { parquet: [0.3, 1.6, 0.9], gravel: [0.7, 2.2, 1.0], tiles: [0.4, 1.9, 0.9], marble: [0.38, 1.8, 0.9] };
const CAUGHT_ROOM = { id: 'caught', floor: 'parquet', obstacles: [] };
const CHEER_ROOM = { id: 'cheer', floor: 'parquet', obstacles: [{ k: 'c', x: 500, y: 500, r: 62, art: 'table' }] };
const MALE = new Set(['luc', 'anselm', 'pierre', 'baptiste', 'gaspard']);
const SKIN = ['#f1cfb2', '#e5b48c', '#c98c62', '#8f603f'];
const col = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const mat = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.62, metalness: 0, side: THREE.DoubleSide, ...o });

// ---- clothing from simple geometry ---------------------------------------------------------------------------------------------------
class Dresser {
  constructor(human) {
    this.h = human;
    human._applyRest(); human.root.updateMatrixWorld(true);
    this.rest = {};
    for (const n of ['Pelvis', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'L_UpperArm', 'L_Forearm', 'L_Hand', 'R_UpperArm', 'R_Forearm', 'R_Hand', 'L_Thigh', 'R_Thigh', 'L_Calf', 'R_Calf', 'L_Foot', 'R_Foot']) {
      this.rest[n] = human.bones[`Bip01_${n}`].getWorldPosition(new Vector3());
    }
    this.root = human.root.position.clone();
  }
  // Parent a mesh to a bone so that it sits at the given REST-pose world position (y up) with the given REST-pose world rotation.
  attach(boneName, mesh, worldPos, worldQuat) {
    const b = this.h.bones[`Bip01_${boneName}`];
    const inv = b.getWorldQuaternion(new THREE.Quaternion()).invert();
    mesh.quaternion.copy(inv).multiply(worldQuat || new THREE.Quaternion());
    mesh.position.copy(worldPos).sub(b.getWorldPosition(new Vector3())).applyQuaternion(inv);
    b.add(mesh);
    return mesh;
  }
  // A tapered tube between two bones' rest positions (sleeve segment).
  limb(boneName, a, b, r0, r1, material, cap = 0) {
    const d = b.clone().sub(a), len = d.length();
    const geo = new THREE.CylinderGeometry(r1, r0, len * (1 + cap), 20, 1, true);   // top at the far end
    const m = new THREE.Mesh(geo, material);
    const q = new THREE.Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.clone().normalize());
    return this.attach(boneName, m, a.clone().lerp(b, 0.5 + cap * 0.0), q);
  }
}

// Sleeves: the shipped athlete has bare arms, so the arm texels of THIS person's body texture are repainted as cloth (top tint) on a private
// canvas copy (the shared vendored textures stay untouched). Because it is the mesh's own texture, the sleeves follow every pose exactly.
function paintSleeves(human, male) {
  const N = 1024, cv = () => { const c = globalThis.document.createElement('canvas'); c.width = c.height = N; return c; };
  const read = (img) => { const c = cv(); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N); return { c, g, d: g.getImageData(0, 0, N, N) }; };
  const boxes = male ? [[0, 470, 330, 850], [694, 470, 1024, 850], [320, 280, 455, 640], [570, 280, 705, 640]] : [[0, 240, 430, 570], [594, 240, 1024, 570]];
  for (const m of human.mats) {
    if (m.userData.kind !== 'body' || !m.map || !m.userData.tint || m.userData.sleeved) continue;
    const u = m.userData.tint;
    const A = read(m.map.image), M = read(u.tMask.value.image), K = read(u.tSkin.value.image);
    const a = A.d.data, mk = M.d.data, sk = K.d.data;
    for (const [x0, y0, x1, y1] of boxes) {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * N + x) * 4;
        if (sk[i] < 40) continue;
        // cloth: grey albedo carrying a little of the skin's shading, tinted by the top colour in the shader
        const L = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
        const g = Math.max(120, Math.min(235, 150 + (L - 150) * 0.5));
        a[i] = a[i + 1] = a[i + 2] = g; a[i + 3] = 255;
        mk[i] = 255; mk[i + 1] = 0; mk[i + 2] = 0; sk[i] = 0;
        if (male && y >= 826 && y < 850 && (x < 330 || x > 694)) { mk[i] = 0; mk[i + 2] = 255; a[i] = a[i + 1] = a[i + 2] = 235; }   // lace cuff (the socks tint is white)
      }
    }
    A.g.putImageData(A.d, 0, 0); M.g.putImageData(M.d, 0, 0); K.g.putImageData(K.d, 0, 0);
    const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
    m.map = tex(A.c, true); u.tMask.value = tex(M.c, false); u.tSkin.value = tex(K.c, false);
    m.userData.sleeved = true; m.needsUpdate = true;
  }
}


// ---- cloth: skirts and coat tails with a small spring simulation ----------------------------------------------------------------------
// A grid of vertices parented to the pelvis bone. Every row has an anchor (where it would hang) and a damped spring that lags behind it,
// so the hem trails the body, swings out when the child turns and flares with speed: that is the "skirt swish" of a real party frock.
// Presenter-only: reads the bone, never feeds back into the sim.
const _v = new Vector3(), _q = new THREE.Quaternion(), _s = new Vector3(), _m = new THREE.Matrix4();
class Drape {
  /**  rest[j][i] = Vector3 in pelvis-bone local space; rowK = spring stiffness per row; flare(row) = radial speed flare factor */
  constructor(bone, rest, material, o = {}) {
    this.bone = bone; this.rest = rest; this.rows = rest.length; this.cols = rest[0].length;
    this.t0 = o.t0 ?? 0; this.t1 = o.t1 ?? 1; this.k = o.k ?? 70; this.damp = o.damp ?? 0.42; this.flare = o.flare ?? 0.2; this.swing = o.swing ?? 0.05; this.closed = !!o.closed;
    const n = this.rows * this.cols;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const idx = [], c = this.cols, last = this.closed ? c : c - 1;
    for (let j = 0; j < this.rows - 1; j++) for (let i = 0; i < last; i++) {
      const a = j * c + i, b = j * c + ((i + 1) % c), d = (j + 1) * c + i, e = (j + 1) * c + ((i + 1) % c);
      idx.push(a, d, b, b, d, e);
    }
    this.geo.setIndex(idx);
    this.geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.receiveShadow = false;
    bone.add(this.mesh);
    this.P = []; this.V = []; this.A0 = []; this.ready = false;
    for (let j = 0; j < this.rows; j++) { this.P.push(new Vector3()); this.V.push(new Vector3()); this.A0.push(new Vector3()); }
    // the centre of every ring in bone space
    this.ctr = rest.map((row) => { const c0 = new Vector3(); for (const p of row) c0.add(p); return c0.multiplyScalar(1 / row.length); });
    this.step(0, 0);
  }
  step(dt, speed) {
    const b = this.bone;
    b.updateWorldMatrix(true, false);
    b.matrixWorld.decompose(_v, _q, _s);
    const sc = Math.max(1e-3, _s.x), inv = _q.clone().invert();
    const clampD = 0.14 / sc;
    const n = this.rows;
    for (let j = 0; j < n; j++) {
      const t = this.t0 + (this.t1 - this.t0) * (j / (n - 1));
      this.A0[j].copy(this.ctr[j]).applyMatrix4(b.matrixWorld);          // where this ring hangs in the world right now
      if (!this.ready) { this.P[j].copy(this.A0[j]); this.V[j].set(0, 0, 0); continue; }
      if (t <= 0.001) { this.P[j].copy(this.A0[j]); continue; }               // waist is pinned
      const k = this.k * (1 - 0.55 * t), c = 2 * Math.sqrt(k) * this.damp;
      const steps = Math.max(1, Math.ceil(dt / 0.008)), h = dt / steps;
      for (let s = 0; s < steps; s++) {
        const a = _s.copy(this.A0[j]).sub(this.P[j]).multiplyScalar(k).addScaledVector(this.V[j], -c);
        this.V[j].addScaledVector(a, h); this.P[j].addScaledVector(this.V[j], h);
      }
      const d = _s.copy(this.P[j]).sub(this.A0[j]);
      if (d.length() > clampD * sc) { d.setLength(clampD * sc); this.P[j].copy(this.A0[j]).add(d); }
    }
    this.ready = true;
    const sp = Math.min(1, speed / 2.6);
    for (let j = 0; j < n; j++) {
      const t = this.t0 + (this.t1 - this.t0) * (j / (n - 1));
      // displacement in bone space (undo rotation and scale)
      _s.copy(this.P[j]).sub(this.A0[j]).applyQuaternion(inv).multiplyScalar(1 / sc);
      const dx = _s.x, dy = _s.y * 0.5, dz = _s.z;
      for (let i = 0; i < this.cols; i++) {
        const r = this.rest[j][i], c0 = this.ctr[j];
        const fl = 1 + this.flare * sp * t * t;
        const o = (j * this.cols + i) * 3;
        this.pos[o] = c0.x + (r.x - c0.x) * fl + dx;
        this.pos[o + 1] = r.y + dy;
        this.pos[o + 2] = c0.z + (r.z - c0.z) * fl + dz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
  dispose() { this.geo.dispose(); this.bone.remove(this.mesh); }
}
const smooth = (x) => x * x * (3 - 2 * x);
// A bell skirt: rows from waist to hem, closed ring. All coordinates are bone-local (the pelvis rest frame).
function skirtRest(inv, centre, waistY, hemY, rWaist, rHem, rows = 9, cols = 30, pleats = 0.02) {
  const out = [];
  for (let j = 0; j < rows; j++) {
    const t = j / (rows - 1), y = waistY + (hemY - waistY) * t;
    const rad = rWaist + (rHem - rWaist) * (0.55 * t + 0.45 * smooth(t));
    const row = [];
    for (let i = 0; i < cols; i++) {
      const a = (i / cols) * TAU_;
      const rr = rad * (1 + pleats * Math.sin(a * 11 + 0.4) * t);
      row.push(new Vector3(centre.x + Math.sin(a) * rr, y, centre.z + Math.cos(a) * rr * (1 + 0.04 * Math.cos(a) * 0)).applyMatrix4(inv));
    }
    out.push(row);
  }
  return out;
}
// A coat tail: one flap hanging behind the hip. a0..a1 = angles round the body (0 = front, PI = back).
function tailRest(inv, centre, waistY, lenSide, lenBack, rWaist, rHem, a0, a1, rows = 7, cols = 6) {
  const out = [];
  for (let j = 0; j < rows; j++) {
    const t = j / (rows - 1), row = [];
    for (let i = 0; i < cols; i++) {
      const u = i / (cols - 1), a = a0 + (a1 - a0) * u;
      const dside = Math.min(Math.abs(a - Math.PI * 0.5), Math.abs(a - Math.PI * 1.5)), L = lenSide + (lenBack - lenSide) * smooth(Math.min(1, dside / (Math.PI * 0.42)));
      const y = waistY - L * t, rad = (rWaist + (rHem - rWaist) * (0.5 * t + 0.5 * t * t)) * (1 + 0.1 * Math.sin(u * Math.PI * 2.0 + 0.6) * t);
      row.push(new Vector3(centre.x + Math.sin(a) * rad, y, centre.z + Math.cos(a) * rad).applyMatrix4(inv));
    }
    out.push(row);
  }
  return out;
}
const TAU_ = Math.PI * 2;

function dress(human, r, isMale, role) {
  const D = new Dresser(human);
  const R = D.rest;
  const out = [];
  const coat = role === 'seeker' ? '#8f2f4a' : r.outfit, trim = role === 'seeker' ? '#e8c26a' : r.trim;
  const coatM = mat(coat), trimM = mat(trim, { roughness: 0.5 }), laceM = mat('#fbf6ea', { roughness: 0.9 });
  const skinHex = SKIN[r.skin] ?? SKIN[0];
  // skirt or coat tails from the waist: sprung cloth (see Drape)
  const wy = R.Pelvis.y + 0.02;
  const pel = human.bones.Bip01_Pelvis;
  const inv = pel.matrixWorld.clone().invert();
  const ctr = new Vector3(R.Pelvis.x, 0, R.Pelvis.z - 0.012);
  const drapes = [];
  const lining = mat(col(coat, 0.55));
  if (!isMale) {
    const hem = 0.13;
    const dr = new Drape(pel, skirtRest(inv, ctr, wy, hem, 0.15, 0.42, 9, 32, 0.035), coatM, { k: 62, damp: 0.38, flare: 0.28, closed: true });
    drapes.push(dr);
    // petticoat lace and gilt hem band: a second ring that follows the skirt's last row
    const band = new Drape(pel, skirtRest(inv, ctr, hem + 0.07, hem - 0.015, 0.438, 0.452, 3, 32, 0.0), laceM, { k: 62, damp: 0.38, flare: 0.28, t0: 0.9, t1: 1, closed: true });
    band.follow = dr; drapes.push(band);
    const trimBand = new Drape(pel, skirtRest(inv, ctr, wy - 0.01, wy - 0.07, 0.15, 0.16, 2, 24, 0), trimM, { k: 200, damp: 0.5, flare: 0, t0: 0, t1: 0.05, closed: true });
    drapes.push(trimBand);
    // apron-like front panel with trim in the skirt colour family
  } else {
    for (const sgn of [1, -1]) {
      const a0 = sgn > 0 ? Math.PI * 0.58 : Math.PI * 1.07, a1 = sgn > 0 ? Math.PI * 0.93 : Math.PI * 1.42;
      const dr = new Drape(pel, tailRest(inv, ctr, wy + 0.01, 0.2, 0.62, 0.185, 0.3, a0, a1, 8, 8), coatM, { k: 70, damp: 0.4, flare: 0.22 });
      drapes.push(dr);
    }
    // waist seam cover: a short peplum ring so the join with the torso does not show
    const pep = new Drape(pel, skirtRest(inv, ctr, wy + 0.025, wy - 0.035, 0.172, 0.19, 2, 28, 0), trimM, { k: 200, damp: 0.5, flare: 0, t0: 0, t1: 0.1, closed: true });
    drapes.push(pep);
  }
  void lining;
  out.push(...drapes.map((d) => d.mesh));
  if (isMale) {
    const breech = mat(col(coat, 0.7)), stock = mat('#f7f2e6', { roughness: 0.85 });
    for (const sd of ['L', 'R']) {
      const th = R[`${sd}_Thigh`], ca = R[`${sd}_Calf`], fo = R[`${sd}_Foot`];
      const kneeEnd = ca.clone().lerp(fo, 0.14);
      out.push(D.limb(`${sd}_Thigh`, th.clone().add(new Vector3(0, 0.03, 0)), ca.clone().add(new Vector3(0, 0.02, 0)), 0.105, 0.078, breech, 0.0));
      out.push(D.limb(`${sd}_Calf`, ca.clone().add(new Vector3(0, 0.04, 0)), kneeEnd, 0.079, 0.077, breech, 0.0));
      const gart = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.028, 20, 1, true), mat('#e8c26a', { roughness: 0.4 }));
      out.push(D.attach(`${sd}_Calf`, gart, kneeEnd.clone()));
      out.push(D.limb(`${sd}_Calf`, ca.clone().lerp(fo, 0.08), fo.clone().add(new Vector3(0, 0.03, 0)), 0.071, 0.05, stock));
    }
  }
  // buckled shoes: the trainers' triangles are dropped (degenerate, so draw groups stay intact) and leather shoes are built in the foot frame
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh || o.geometry.userData.barefoot) return;
    const geo = o.geometry, ix = geo.index, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    if (!ix || !si) return;
    const foot = new Set(o.skeleton.bones.map((bn, i) => (/_(Foot|Toe0)$/.test(bn.name) ? i : -1)).filter((i) => i >= 0));
    const w = new Float32Array(geo.attributes.position.count);
    for (let i = 0; i < w.length; i++) for (let k = 0; k < 4; k++) if (foot.has(si.getComponent(i, k))) w[i] += sw.getComponent(i, k);
    const arr = ix.array;
    for (let t = 0; t < arr.length; t += 3) if (w[arr[t]] > 0.55 && w[arr[t + 1]] > 0.55 && w[arr[t + 2]] > 0.55) { arr[t + 1] = arr[t]; arr[t + 2] = arr[t]; }
    ix.needsUpdate = true; geo.userData.barefoot = true;
  });
  for (const side of ['L', 'R']) {
    const fb = human.bones[`Bip01_${side}_Foot`], fr = human._sole && human._sole[side];
    if (!fr) { console.warn('no sole frame'); continue; }
    const upV = fr.up.clone().normalize(), fwdV = fr.fwd.clone().normalize();
    fwdV.addScaledVector(upV, -fwdV.dot(upV)).normalize();
    const leftV = upV.clone().cross(fwdV).normalize();
    const g = new THREE.Group(); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(leftV, upV, fwdV));
    const leather = mat('#2a1c18', { roughness: 0.38 }), skinM = mat(skinHex, { roughness: 0.7 });
    const sph = new THREE.SphereGeometry(1, 18, 12);
    const add = (geo, m, p, sc) => { const o = new THREE.Mesh(geo, m); o.position.set(p[0], p[1], p[2]); o.scale.set(sc[0], sc[1], sc[2]); g.add(o); };
    add(sph, skinM, [0, -0.01, -0.005], [0.04, 0.06, 0.042]);          // ankle
    add(sph, leather, [0, -0.07, 0.07], [0.047, 0.036, 0.125]);      // vamp and toe box
    add(sph, leather, [0, -0.062, -0.02], [0.046, 0.05, 0.055]);     // heel counter
    add(new THREE.BoxGeometry(0.062, 0.028, 0.06), leather, [0, -0.094, -0.025], [1, 1, 1]);   // heel
    add(new THREE.BoxGeometry(0.052, 0.034, 0.012), mat('#e8c26a', { roughness: 0.3 }), [0, -0.043, 0.075], [1, 1, 1]);   // buckle
    fb.add(g); out.push(g);
  }
  // jabot ruffle at the throat and a gold-braided front with buttons (men and the blindfolded seeker)
  if (isMale) {
    const fz = R.Spine2.z + 0.15;
    const fall = [[0.0, 0.0, 0.052, 0.026, 0.022], [0.0, -0.04, 0.026, 0.036, 0.018]];
    for (const [dx, dy, rx, ry, rz] of fall) {
      const j = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), laceM);
      j.scale.set(rx, ry, rz);
      D.attach('Spine2', j, new Vector3(R.Spine2.x + dx, R.Neck.y - 0.045 + dy, fz - 0.005), new THREE.Quaternion());
      out.push(j);
    }
    for (let k = 0; k < 5; k++) {
      const bt = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), mat('#e8c26a', { roughness: 0.25 }));
      D.attach('Spine1', bt, new Vector3(R.Spine1.x, R.Spine2.y - 0.07 - k * 0.075, R.Spine1.z + 0.165), new THREE.Quaternion());
      out.push(bt);
    }
    for (const sx of [-1, 1]) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.3, 0.005), trimM);
      D.attach('Spine1', br, new Vector3(R.Spine1.x + sx * 0.07, R.Spine1.y - 0.01, R.Spine1.z + 0.164), new THREE.Quaternion());
      out.push(br);
    }
  }
  // collar / neckerchief
  const neckY = R.Neck.y - 0.01;
  const kerch = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.08, 0.055, 18, 1, true), r.trinket === 'scarf' ? mat('#f6ead0') : laceM);
  D.attach('Neck', kerch, new Vector3(R.Neck.x, neckY, R.Neck.z), new THREE.Quaternion());
  out.push(kerch);
  // head gear
  const hp = R.Head.clone(); hp.y += 0.07; hp.z += 0.012;      // centre of the skull (the bone sits at the base of it)
  const top = new Vector3(hp.x, hp.y + 0.07, hp.z);
  const add = (geo, m, p, rot) => { const mesh = new THREE.Mesh(geo, m); D.attach('Head', mesh, p, rot ? new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])) : undefined); out.push(mesh); return mesh; };
  if (role === 'seeker') {
    // the white blindfold across the eyes, with a knot at the back
    const bf = add(new THREE.CylinderGeometry(0.081, 0.083, 0.046, 32, 1, true), mat('#fbf6ea', { roughness: 0.85 }), new Vector3(hp.x, hp.y + 0.006, hp.z + 0.012));
    bf.scale.set(1, 1, 1.28);
    add(new THREE.SphereGeometry(0.026, 12, 8), mat('#efe6cf'), new Vector3(hp.x, hp.y + 0.004, hp.z - 0.108));
    for (const sx of [-1, 1]) { const tl = add(new THREE.CylinderGeometry(0.008, 0.014, 0.1, 8), mat('#efe6cf'), new Vector3(hp.x + sx * 0.03, hp.y - 0.04, hp.z - 0.115), [0.15, 0, sx * 0.25]); void tl; }
  }
  const h = r.head;
  if (role !== 'seeker') {
    if (h === 'tricorn') {
      const brim = new THREE.CylinderGeometry(0.17, 0.17, 0.02, 3, 1, false);
      add(brim, mat('#232029', { roughness: 0.8 }), new Vector3(hp.x, top.y - 0.002, hp.z), [0, Math.PI / 2, 0]);
      add(new THREE.CylinderGeometry(0.1, 0.105, 0.075, 20), mat('#232029', { roughness: 0.8 }), new Vector3(hp.x, top.y + 0.04, hp.z));
      add(new THREE.CylinderGeometry(0.192, 0.192, 0.016, 3, 1, false), mat('#e8c26a', { roughness: 0.35 }), new Vector3(hp.x, top.y - 0.008, hp.z), [0, Math.PI / 2, 0]);
    } else if (h === 'plume') {
      add(new THREE.CylinderGeometry(0.19, 0.19, 0.012, 32), mat('#c9a36a', { roughness: 0.8 }), new Vector3(hp.x, top.y + 0.022, hp.z + 0.01), [0.1, 0, 0]);
      add(new THREE.CylinderGeometry(0.1, 0.112, 0.07, 24), mat(col(r.outfit, 0.92)), new Vector3(hp.x, top.y + 0.055, hp.z + 0.005));
      const curve = new THREE.CatmullRomCurve3([new Vector3(0.07, 0, 0), new Vector3(0.15, 0.09, -0.02), new Vector3(0.2, 0.06, -0.11), new Vector3(0.17, -0.04, -0.16)]);
      const f = add(new THREE.TubeGeometry(curve, 16, 0.018, 8, false), mat('#fffaf0', { roughness: 0.9 }), new Vector3(hp.x - 0.05, top.y + 0.04, hp.z + 0.05));
      f.scale.set(1, 1, 1);
    } else if (h === 'bonnet') {
      add(new THREE.SphereGeometry(0.128, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), mat('#fbf3e6', { roughness: 0.9 }), new Vector3(hp.x, hp.y + 0.02, hp.z - 0.025), [-0.3, 0, 0]);
      const rib = mat(r.outfit);
      add(new THREE.TorusGeometry(0.108, 0.01, 8, 28, Math.PI), rib, new Vector3(hp.x, hp.y + 0.05, hp.z + 0.01), [Math.PI / 2 - 0.45, 0, 0]);
      add(new THREE.SphereGeometry(0.022, 10, 8), rib, new Vector3(hp.x + 0.03, hp.y - 0.115, hp.z + 0.07));
      add(new THREE.SphereGeometry(0.022, 10, 8), rib, new Vector3(hp.x - 0.03, hp.y - 0.115, hp.z + 0.07));
    } else if (h === 'wig') {
      const w = mat('#f4eee2', { roughness: 0.95 });
      add(new THREE.SphereGeometry(0.118, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), w, new Vector3(hp.x, hp.y + 0.055, hp.z - 0.03), [-0.45, 0, 0]);
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.035 - k * 0.004, 10, 8), w, new Vector3(hp.x + s * (0.1 + k * 0.004), hp.y - 0.0 - k * 0.055, hp.z - 0.01 - k * 0.006));
      add(new THREE.SphereGeometry(0.04, 10, 8), w, new Vector3(hp.x, hp.y - 0.05, hp.z - 0.12));
      if (isMale) add(new THREE.SphereGeometry(0.028, 10, 8), mat('#171417'), new Vector3(hp.x, hp.y - 0.1, hp.z - 0.12));
    } else {   // ribbon bow on the hair
      const rib = mat('#e24a6a', { roughness: 0.5 });
      for (const s of [-1, 1]) { const m = add(new THREE.SphereGeometry(0.045, 12, 8), rib, new Vector3(hp.x + s * 0.045, top.y + 0.008, hp.z + 0.025)); m.scale.set(1, 0.6, 0.8); }
      add(new THREE.SphereGeometry(0.02, 10, 8), mat('#b8304d'), new Vector3(hp.x, top.y + 0.008, hp.z + 0.025));
    }
  }
  // trinkets
  if (role !== 'seeker') {
    const ch = R.Spine2.clone();
    if (r.trinket === 'pearls') {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.01, 8, 28), mat('#fffdf6', { roughness: 0.25 }));
      D.attach('Neck', t, new Vector3(R.Neck.x, R.Neck.y - 0.045, R.Neck.z + 0.012), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + 0.25, 0, 0)));
      out.push(t);
    } else if (r.trinket === 'rose') {
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), mat('#d83a52', { roughness: 0.5 }));
      D.attach('Spine2', g, new Vector3(ch.x + 0.1, ch.y + 0.02, ch.z + 0.12), new THREE.Quaternion()); out.push(g);
    } else if (r.trinket === 'fan') {
      const hd = R.R_Hand;
      const g = new THREE.Mesh(new THREE.CircleGeometry(0.15, 18, 0, Math.PI * 0.62), mat('#fff1c4', { roughness: 0.7 }));
      D.attach('R_Hand', g, new Vector3(hd.x, hd.y, hd.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.2))); out.push(g);
    } else if (r.trinket === 'spectacles') {
      const m = mat('#2a2230', { roughness: 0.4 });
      for (const s of [-1, 1]) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0025, 6, 18), m);
        D.attach('Head', t, new Vector3(hp.x + s * 0.03, hp.y - 0.005, hp.z + 0.1), new THREE.Quaternion()); out.push(t);
      }
    }
  }
  return { D, out, skinHex, drapes };
}

// ---- the stage and the cast ----------------------------------------------------------------------------------------------------------
export async function createPeople({ quality = 'medium' } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: true, shadowSize: 4.2, lighting: 'evening', fov: 10 });
  if (!stage.supported) return null;
  const LIGHT = { exposure: 0.85, hemi: 0.3, keyI: 1.6, rimI: 0.9, key: 0xffd9a8, rim: 0x9db6ff, hemiSky: 0xffe2c0, hemiGround: 0x3a2a30 };
  stage.setLighting('evening', LIGHT);
  stage.setSky(null, null);
  stage.setShadowTarget(0, 0, 0);
  const cam = stage.camera;
  cam.near = 5; cam.far = 140;
  const api = { stage, ok: true, lost: false, fitted: 0, quality, cast: new Map(), loading: new Map(), rooms: new Map() };
  const roomOf = (vi) => {
    if (!api.rooms.has(vi)) { const r = buildRoom(vi === 'cheer' ? CHEER_ROOM : vi === 'caught' ? CAUGHT_ROOM : (VENUES[vi] ?? VENUES[0]), { quality: api.quality }); r.group.visible = false; stage.scene.add(r.group); api.rooms.set(vi, r); }
    return api.rooms.get(vi);
  };
  const showRoom = (vi) => { for (const [k, r] of api.rooms) r.group.visible = k === vi; if (vi !== null && vi !== undefined) { const r = roomOf(vi); r.group.visible = true; return r; } return null; };
  api.showRoom = showRoom;
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; api.fitted = 0; stills.clear(); stage.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); });

  const R = 500 / UNITS_PER_M;                          // half the room, metres
  const sinP = Math.sin(PITCH), cosP = Math.cos(PITCH);
  const Hm = 2 * R * sinP + HEAD_ROOM_M * cosP;         // vertical extent of the render in "screen metres"
  const Wm = 2 * R;
  const frame = (devW) => {
    const devH = Math.round(devW * Hm / Wm);
    const rd = stage.renderer;
    rd.setPixelRatio(1); rd.setSize(devW, devH, false);
    cam.near = 5; cam.far = 140;
    cam.aspect = devW / devH;
    cam.fov = 2 * Math.atan(Hm / 2 / DIST) / D2R;
    // the region's centre sits HEAD_ROOM_M * cos / 2 above the floor-centre on the screen
    const up = new Vector3(0, cosP, -sinP);
    const tgt = up.clone().multiplyScalar(HEAD_ROOM_M * cosP * 0.5);
    cam.position.copy(tgt).add(new Vector3(0, sinP, cosP).multiplyScalar(DIST));
    cam.lookAt(tgt);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  };

  // dress one person: key = roster id + role
  async function make(r, role) {
    const male = role === 'seeker' ? true : MALE.has(r.id);
    const human = await loadHuman({
      character: male ? 'athlete_m' : 'athlete_f',
      kit: { top: role === 'seeker' ? '#8f2f4a' : r.outfit, bottoms: male ? `#${col(role === 'seeker' ? '#8f2f4a' : r.outfit, 0.8).getHexString()}` : r.outfit, socks: '#f6f1e6' },
      skin: SKIN[r.skin] ?? SKIN[0], hair: r.hair, castShadow: true,
    });
    paintSleeves(human, male);
    const dr = dress(human, r, male, role);
    // short guests are children (about 1.25 m, big head), medium are youths (1.5 m), tall are grown-ups; the seeker is a young adult (1.65 m)
    const scale = role === 'seeker' ? 0.94 : r.height === 'tall' ? 1.02 : r.height === 'short' ? 0.72 : 0.87;
    const headK = role === 'seeker' ? 1.0 : r.height === 'short' ? 1.3 : r.height === 'medium' ? 1.1 : 1.0;
    human.root.scale.setScalar(scale);
    human.root.visible = false;
    stage.add(human);
    human.groundClamp = 'auto'; human.footPlanting = true; human.turnRate = 9;
    human.play('idle');
    return { human, male, r, role, scale, headK, drapes: dr.drapes, last: null, speed: 0, yaw: 0, pose: 'idle', parts: dr.out, seen: -1, vx: 0, vz: 0, hand: { L: null, R: null }, turning: false, headBone: human.bones.Bip01_Head };
  }
  api.ensure = (r, role) => {
    const key = `${r.id}|${role}`;
    if (api.cast.has(key)) return api.cast.get(key);
    if (!api.loading.has(key)) api.loading.set(key, make(r, role).then((p) => { api.cast.set(key, p); return p; }).catch((e) => { console.warn('person failed', key, String((e && e.stack) || e)); api.cast.set(key, null); return null; }));
    return null;
  };
  // One still of one person into a fresh 2D canvas: o = { size, pos:[x,y,z], look:[x,y,z], fov, yaw, clip, t, arms, reach, hide }
  api.snap = (r, role, o = {}) => {
    const p = api.ensure(r, role);
    if (!p) return null;
    const N = o.size ?? 288, h = p.human, rd = stage.renderer;
    for (const q of api.cast.values()) if (q) q.human.root.visible = false;
    showRoom(null);
    h.root.visible = true; h.setPosition(...(o.at ?? [0, 0, 0])); h.setFacing(o.yaw ?? 0, { snap: true });
    if (o.clip) h.play(o.clip, { fade: 0, startTime: o.t ?? 0 }); else h.play('idle', { fade: 0 });
    if (role === 'seeker' && o.arms !== undefined) {
      const yw = o.yaw ?? 0, f = [Math.sin(yw), Math.cos(yw)], l = [Math.cos(yw), -Math.sin(yw)];
      const at = o.at ?? [0, 0, 0];
      for (const sgn of [1, -1]) h.setReach(sgn > 0 ? 'L' : 'R', new Vector3(at[0] + f[0] * o.arms[0] + l[0] * sgn * o.arms[1], o.arms[2], at[2] + f[1] * o.arms[0] + l[1] * sgn * o.arms[1]), { weight: 1 });
      h.setFingers('L', 'open'); h.setFingers('R', 'open');
    }
    h.update(0); h.update(0.001);
    if (p.headK !== 1) p.headBone.scale.setScalar(p.headK);
    for (const d of p.drapes) { d.ready = false; d.step(0.016, 0); }
    rd.setPixelRatio(1); rd.setSize(o.w ?? N, o.h ?? N, false);
    cam.near = 0.3; cam.far = 40; cam.aspect = (o.w ?? N) / (o.h ?? N); cam.fov = o.fov ?? 20;
    cam.updateProjectionMatrix();
    cam.position.set(...o.pos); cam.lookAt(...o.look); cam.updateMatrixWorld(true);
    const L = stage.lights;
    if (o.lights) {
      const l = o.lights;
      L.key.color.set(l.key); L.key.intensity = l.keyI; L.key.position.set(...l.keyPos); L.rim.color.set(l.rim); L.rim.intensity = l.rimI; L.rim.position.set(...l.rimPos);
      L.hemi.intensity = l.hemi; L.hemi.color.set(l.hemiSky || '#ffffff'); L.hemi.groundColor.set(l.hemiGround || '#444444');
    }
    stage.render();
    if (o.lights) { stage.setLighting('evening', LIGHT); stage.setSky(null, null); stage.setShadowTarget(0, 0, 0); }
    const c = globalThis.document.createElement('canvas'); c.width = o.w ?? N; c.height = o.h ?? N;
    c.getContext('2d').drawImage(rd.domElement, 0, 0);
    h.root.visible = false; api.fitted = 0;
    return c;
  };
  // Head-and-shoulders portraits: each person is rendered once into a small 2D canvas (cached). null until the person has loaded.
  const busts = new Map();
  api.bust = (r) => {
    if (busts.has(r.id)) return busts.get(r.id);
    if (api.lost || stage.contextLost) return null;
    const p = api.ensure(r, 'guest');
    if (!p) return null;
    const hy = 1.52 * p.scale, D = 3.0;
    const c = api.snap(r, 'guest', { size: 288, pos: [0.0, hy + 0.04, D], look: [0, hy, 0], fov: 2 * Math.atan(0.27 / D) / D2R });
    if (c) busts.set(r.id, c);
    return c;
  };
  // The blindfolded seeker with arms out, as a small still for the Rules and About figures (cached).
  let seekerImg = null;
  api.seekerPic = (r) => {
    if (seekerImg) return seekerImg;
    if (api.lost || stage.contextLost) return null;
    seekerImg = api.snap(r, 'seeker', { size: 320, pos: [0.25, 1.5, 3.1], look: [0, 1.25, 0.5], fov: 28, arms: [1.0, 0.27, 1.28] });
    return seekerImg;
  };
  // An overhead still of one room (no people), cached: the room cards on the Choose-a-room screen. null until WebGL is ready.
  const stills = new Map();
  api.roomStill = (vi, size = 320) => {
    const key = `${vi}|${size}`;
    if (stills.has(key)) return stills.get(key);
    if (api.lost || stage.contextLost) return null;
    const nowMs = globalThis.performance.now();
    if (nowMs - (api._stillT || 0) < 30) return null;   // one new room still per frame, so the card screen never hitches
    api._stillT = nowMs;
    for (const q of api.cast.values()) if (q) q.human.root.visible = false;
    const room = showRoom(vi); room.update(1.3);
    frame(size);
    stage.render();
    const rd = stage.renderer, H = rd.domElement.height, hu = (Hm / sinP) * UNITS_PER_M, top = -(HEAD_ROOM_M * cosP / sinP) * UNITS_PER_M;
    const y0 = Math.round((-top / hu) * H), y1 = Math.round(((1000 - top) / hu) * H);
    const c = globalThis.document.createElement('canvas'); c.width = size; c.height = size;
    c.getContext('2d').drawImage(rd.domElement, 0, y0, rd.domElement.width, y1 - y0, 0, 0, size, size);
    showRoom(null); api.fitted = 0;
    stills.set(key, c);
    return c;
  };
  // The cheering circle on the result card: the party stands round the candle table, the caught guests laugh and clap, the seeker celebrates.
  api.cheer = (ctx, w, h, t, roster, pxPerUnit = 1, o = {}) => {
    if (api.lost || stage.contextLost) return false;
    const list = [];
    let ready = true;
    for (const r of roster) { const p = api.ensure(r, r.id === 'seeker' ? 'seeker' : 'guest'); if (!p) ready = false; else list.push(p); }
    if (!ready || !list.length) return 'pending';
    for (const q of api.cast.values()) if (q) q.human.root.visible = false;
    const room = showRoom('cheer'); room.update(t);
    if (room.walls) room.walls.visible = false;
    const n = list.length, rad = 1.25;
    list.forEach((p, i) => {
      const a = (i / n) * Math.PI * 2 + Math.PI * 0.9 + (n > 2 ? 0 : 0.5), X = Math.sin(a) * rad, Z = Math.cos(a) * rad * 0.8;
      const h2 = p.human; h2.root.visible = true; h2.setPosition(X, 0, Z); h2.setFacing(Math.atan2(-X, -Z), { snap: true });
      const clip = p.role === 'seeker' ? 'celebrate_2' : (i % 3 === 0 ? 'cheer' : i % 3 === 1 ? 'clap' : 'celebrate_2');
      const cur = h2.layers.base.current;
      if (!cur || cur.clip.name !== clip || p.cheering !== true) { h2.play(clip, { fade: 0.2, loop: true, startTime: (i * 0.37) % 1.5 }); }
      p.cheering = true; p.last = null; p.seen = -1; p.hand = { L: null, R: null };
      h2.setReach('L', null); h2.setReach('R', null);
    });
    const nowW = globalThis.performance.now() / 1000, dt = clamp(nowW - (api._cheerT ?? nowW), 0, 0.05); api._cheerT = nowW;
    for (const p of list) { p.human.update(dt); if (p.headK !== 1) p.headBone.scale.setScalar(p.headK); for (const d of p.drapes) d.step(dt, 0.3); }
    const devW = clamp(Math.round(w * pxPerUnit), 200, 900), devH = Math.round(devW * h / w), rd = stage.renderer;
    rd.setPixelRatio(1); rd.setSize(devW, devH, false);
    cam.near = 0.5; cam.far = 40; cam.aspect = devW / devH; cam.fov = o.fov ?? 30;
    const sway = Math.sin(t * 0.3) * 0.12;
    cam.position.set(Math.sin(sway) * 5.6, 1.9, Math.cos(sway) * 5.6); cam.lookAt(0, 0.75, 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const L = stage.lights, save = [L.hemi.intensity, L.key.intensity];
    L.hemi.intensity = 0.28; L.key.intensity = 1.2;
    stage.render();
    L.hemi.intensity = save[0]; L.key.intensity = save[1];
    ctx.drawImage(rd.domElement, 0, 0, w, h);
    showRoom(null); api.fitted = 0;
    for (const p of list) { p.cheering = false; p.human.root.visible = false; }
    return true;
  };
  // The caught moment: the blindfolded seeker has both hands on the shoulders of a figure in the dark; who it is, is the question.
  const SILH = new THREE.MeshBasicMaterial({ color: 0x0c0818 });
  api.caught = (ctx, w, h, t, pxPerUnit = 1) => {
    if (api.lost || stage.contextLost) return false;
    const seeker = api.ensure({ id: 'seeker', skin: 1, hair: '#5a3418', outfit: '#8f2f4a', trim: '#e8c26a', head: 'none', trinket: 'none' }, 'seeker');
    const gr = { id: 'baptiste', skin: 3, hair: '#1c1410', outfit: '#3f7f7a', trim: '#e8d8a0', head: 'ribbon', trinket: 'none', height: 'medium' };
    const other = api.ensure(gr, 'guest');
    if (!seeker || !other) return 'pending';
    for (const q of api.cast.values()) if (q) q.human.root.visible = false;
    const room = showRoom('caught'); room.update(t);
    const A = seeker.human, G = other.human;
    A.root.visible = G.root.visible = true;
    A.setPosition(0, 0, -0.5); A.setFacing(0, { snap: true });
    G.setPosition(0, 0, 0.12); G.setFacing(Math.PI, { snap: true });
    const sway = Math.sin(t * 5) * 0.012;
    if (A.layers.base.current?.clip.name !== 'idle') A.play('idle', { fade: 0.2, loop: true });
    if (G.layers.base.current?.clip.name !== 'clap') G.play('clap', { fade: 0.2, loop: true });
    const sy = 1.2 * other.scale / 0.87;
    A.setReach('L', new Vector3(0.2, sy + sway, 0.08), { weight: 1 }); A.setReach('R', new Vector3(-0.2, sy - sway, 0.08), { weight: 1 });
    A.setFingers('L', 'open'); A.setFingers('R', 'open');
    const nowW = globalThis.performance.now() / 1000, dt = clamp(nowW - (api._caughtT ?? nowW), 0, 0.05); api._caughtT = nowW;
    A.update(dt); G.update(dt);
    if (other.headK !== 1) other.headBone.scale.setScalar(other.headK);
    for (const d of seeker.drapes) d.step(dt, 0);
    // the guest is only a dark shape with a warm rim
    const saved = [];
    G.root.traverse((o) => { if (o.isMesh && o.material) { saved.push([o, o.material]); o.material = SILH; } });
    const devW = clamp(Math.round(w * pxPerUnit), 160, 720), devH = Math.round(devW * h / w), rd = stage.renderer;
    rd.setPixelRatio(1); rd.setSize(devW, devH, false);
    cam.near = 0.3; cam.far = 30; cam.aspect = devW / devH; cam.fov = 30;
    cam.position.set(0.5, 1.7, 2.7); cam.lookAt(0, 1.2, 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const L = stage.lights, save = [L.hemi.intensity, L.key.intensity];
    L.hemi.intensity = 0.3; L.key.intensity = 1.1;
    stage.render();
    L.hemi.intensity = save[0]; L.key.intensity = save[1];
    for (const [o, m] of saved) o.material = m;
    ctx.drawImage(rd.domElement, 0, 0, w, h);
    showRoom(null); api.fitted = 0;
    A.root.visible = G.root.visible = false;
    seeker.last = null; seeker.seen = -1; seeker.hand = { L: null, R: null };
    return true;
  };
  // The app icon, rendered from this same scene (offline: tools via ?icon in a puppeteer run; see STATUS.md). Returns a canvas.
  api.icon = (size = 1024, o = {}) => {
    const SEEK = { id: 'seeker', skin: 1, hair: '#5a3418', outfit: '#8f2f4a', trim: '#e8c26a', head: 'none', trinket: 'none' };
    const p = api.ensure(SEEK, 'seeker');
    if (!p) return null;
    for (const q of api.cast.values()) if (q) q.human.root.visible = false;
    const h = p.human, rd = stage.renderer;
    rd.setPixelRatio(1); rd.setSize(size, size, false);
    cam.near = 0.3; cam.far = 60; cam.aspect = 1; cam.fov = o.fov ?? 30;
    const L = stage.lights, saveL = [L.hemi.intensity, L.key.intensity, L.rim.intensity];
    const dst = globalThis.document.createElement('canvas'); dst.width = dst.height = size;
    const g = dst.getContext('2d');
    // pass A: the salon behind, blurred
    const room = showRoom(0); room.update(o.t ?? 3.2); if (room.walls) room.walls.visible = true;
    const camPos = o.camPos ?? [1.5, 1.45, 5.2], look = o.look ?? [0, 1.12, 0];
    cam.position.set(...camPos); cam.lookAt(...look); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    L.hemi.intensity = 0.2; L.key.intensity = 0.6; L.rim.intensity = 0.4;
    stage.render();
    const bg = globalThis.document.createElement('canvas'); bg.width = bg.height = size; bg.getContext('2d').drawImage(rd.domElement, 0, 0);
    if (room.walls) room.walls.visible = false;
    g.fillStyle = '#0a0716'; g.fillRect(0, 0, size, size);
    g.filter = `blur(${Math.round(size * 0.018)}px)`; g.drawImage(bg, -size * 0.03, -size * 0.03, size * 1.06, size * 1.06); g.filter = 'none';
    // warm candle glow behind the subject
    const rg = g.createRadialGradient(size * 0.5, size * 0.52, size * 0.04, size * 0.5, size * 0.52, size * 0.62);
    rg.addColorStop(0, 'rgba(255,196,110,0.78)'); rg.addColorStop(0.45, 'rgba(255,150,70,0.28)'); rg.addColorStop(1, 'rgba(40,12,40,0)');
    g.globalCompositeOperation = 'screen'; g.fillStyle = rg; g.fillRect(0, 0, size, size); g.globalCompositeOperation = 'source-over';
    // candle bokeh
    { let sd = 7; const rn = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) { const x = rn() * size, y = rn() * size * 0.75, r = size * (0.018 + rn() * 0.04); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,205,130,${0.22 + rn() * 0.2})`); gr.addColorStop(0.8, 'rgba(255,160,70,0.1)'); gr.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
      g.globalCompositeOperation = 'source-over'; }
    // gold sound ripples round the subject
    g.lineWidth = size * 0.007;
    for (let i = 0; i < 4; i++) { const r = size * (0.2 + i * 0.1), a = 0.55 - i * 0.12; g.strokeStyle = `rgba(255,214,120,${a})`; g.beginPath(); g.ellipse(size * 0.5, size * (o.ringY ?? 0.88), r * 1.1, r * 0.3, 0, 0, Math.PI * 2); g.stroke(); }
    // pass B: the seeker alone on a transparent frame
    room.group.visible = false;
    h.root.visible = true; h.setPosition(0, 0, 0); h.setFacing(o.yaw ?? -0.55, { snap: true });
    h.play(o.clip ?? 'walk', { fade: 0, startTime: o.clipT ?? 0.28, loop: true });
    h.update(0); h.update(0.001);
    const yaw = h.facing, f = new Vector3(Math.sin(yaw), 0, Math.cos(yaw)), lx = Math.cos(yaw), lz = -Math.sin(yaw), s = p.scale / 0.94;
    const arms = o.arms ?? [[0.78, 0.26, 1.2], [0.7, -0.34, 1.0]];
    ['L', 'R'].forEach((side, i) => { const [fw, sd, up] = arms[i]; h.setReach(side, new Vector3(f.x * fw * s + lx * sd * s, up * s, f.z * fw * s + lz * sd * s), { weight: 1 }); });
    h.setFingers('L', 'open'); h.setFingers('R', 'open');
    h.update(0.001);
    for (const d of p.drapes) { d.ready = false; d.step(0.016, 0); for (let k = 0; k < 12; k++) d.step(0.016, o.speed ?? 1.3); }
    L.hemi.intensity = 0.55; L.key.intensity = 2.1; L.rim.intensity = 2.2;
    const rim1 = new THREE.PointLight(0xffa850, 9, 8, 2); rim1.position.set(-1.6, 1.9, -1.4); stage.scene.add(rim1);
    const fill = new THREE.PointLight(0x8aa8ff, 2.2, 8, 2); fill.position.set(2.2, 1.2, 2.4); stage.scene.add(fill);
    stage.render();
    g.drawImage(rd.domElement, 0, 0);
    stage.scene.remove(rim1, fill);
    L.hemi.intensity = saveL[0]; L.key.intensity = saveL[1]; L.rim.intensity = saveL[2];
    h.root.visible = false; h.setReach('L', null); h.setReach('R', null); room.group.visible = false; api.fitted = 0;
    // vignette + a little grain-free grade
    const vg = g.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.78);
    vg.addColorStop(0, 'rgba(10,6,24,0)'); vg.addColorStop(1, 'rgba(10,6,24,0.55)'); g.fillStyle = vg; g.fillRect(0, 0, size, size);
    return dst;
  };
  let lastT = null;
  const tmp = new Vector3();
  /**
   * people: [{ r, role, x, y, a, reach, arms, clap, tag }]  (room units; a = heading in the room, 0 = +x, y down)
   * Draws into ctx (already scaled so that 1 unit = 1 room unit). Returns false when the 3D picture is unavailable.
   */
  // The title hero: a lower, drifting perspective camera in the salon, lit by candles and one warm pool that follows the seeker.
  let heroSpot = null;
  function renderHero(ctx, t0, pxPerUnit, t, people, room, o) {
    const { w, h } = o.hero;
    const devW = clamp(Math.round(w * pxPerUnit), 200, 1100), devH = Math.round(devW * h / w);
    const rd = stage.renderer;
    rd.setPixelRatio(1); rd.setSize(devW, devH, false);
    if (room.walls) room.walls.visible = true;
    const yaw = Math.sin(t * 0.13) * 0.2, pitch = (27 + Math.sin(t * 0.09) * 3) * D2R, dist = 7.4 - Math.sin(t * 0.11) * 0.35;
    cam.near = 0.5; cam.far = 60; cam.aspect = devW / devH; cam.fov = 38;
    cam.position.set(Math.sin(yaw) * dist * Math.cos(pitch), Math.sin(pitch) * dist + 0.2, Math.cos(yaw) * dist * Math.cos(pitch) + 0.6);
    cam.lookAt(0, 0.85, -0.2); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const L = stage.lights, save = [L.hemi.intensity, L.key.intensity, L.rim.intensity];
    L.hemi.intensity = 0.16; L.key.intensity = 0.55; L.rim.intensity = 0.5;
    if (!heroSpot) { heroSpot = new THREE.SpotLight(0xffd3a0, 0, 12, 0.55, 0.9, 1.6); stage.scene.add(heroSpot, heroSpot.target); }
    const seeker = people.find((q) => q.role === 'seeker');
    if (seeker) { const X = (seeker.x - 500) / UNITS_PER_M, Z = (seeker.y - 500) / UNITS_PER_M; heroSpot.position.set(X + 0.8, 3.6, Z + 1.6); heroSpot.target.position.set(X, 0.8, Z); heroSpot.intensity = 80; }
    stage.render();
    L.hemi.intensity = save[0]; L.key.intensity = save[1]; L.rim.intensity = save[2]; heroSpot.intensity = 0;
    ctx.drawImage(rd.domElement, 0, 0, w, h);
    if (room.walls) room.walls.visible = false;
    api.fitted = 0;
    const ms = globalThis.performance.now() - t0; void ms; void o;
    return true;
  }
  api.draw = function (ctx, S, t, people, o = {}) {
    if (api.lost || stage.contextLost) return false;
    const t0 = globalThis.performance.now();
    const room = showRoom(o.venue ?? null);
    if (room) room.update(t);
    // animation runs on the display clock: the kit steps the sim at a fixed 60 Hz (0, 1 or 2 steps per frame), so sim time is never used for motion
    const nowS = globalThis.performance.now() / 1000;
    const dt = lastT === null ? 0 : clamp(nowS - lastT, 0, 0.05); lastT = nowS;
    for (const p of api.cast.values()) if (p) p.human.root.visible = false;
    let ready = true, drawn = 0;
    const tmpDirs = [];
    for (const e of people) {
      const p = api.ensure(e.r, e.role);
      if (p === null) { if (!api.cast.has(`${e.r.id}|${e.role}`)) ready = false; if (api.cast.get(`${e.r.id}|${e.role}`) === null) return false; continue; }
      const h = p.human; h.root.visible = true; drawn++;
      p.key = e;
      // the sim position arrives in 60 Hz steps: glide the displayed position from the previous step to the new one over one step interval
      const rawX = (e.x - 500) / UNITS_PER_M, rawZ = (e.y - 500) / UNITS_PER_M;
      let tk = p.trk;
      if (!tk) tk = p.trk = { px: rawX, pz: rawZ, cx: rawX, cz: rawZ, tc: nowS, tp: nowS - 0.0167, dx: rawX, dz: rawZ };
      if (rawX !== tk.cx || rawZ !== tk.cz) {
        if (Math.hypot(rawX - tk.cx, rawZ - tk.cz) > 0.9) { tk.px = rawX; tk.pz = rawZ; tk.dx = rawX; tk.dz = rawZ; p.dispX = rawX; p.dispZ = rawZ; }
        else { tk.px = tk.dx; tk.pz = tk.dz; }
        tk.cx = rawX; tk.cz = rawZ; tk.tp = tk.tc; tk.tc = nowS;
      }
      const iv = clamp(tk.tc - tk.tp, 0.008, 0.06), kf = clamp((nowS - tk.tc) / iv, 0, 1);
      let X = tk.px + (tk.cx - tk.px) * kf, Z = tk.pz + (tk.cz - tk.pz) * kf;
      // a sim jump (a retreat, a reset) is walked off at a speed no person exceeds, never flashed across the room
      if (p.dispX !== undefined && dt > 0) {
        const ddx = X - p.dispX, ddz = Z - p.dispZ, dd = Math.hypot(ddx, ddz), mx = 3.4 * dt;
        if (dd > mx && dd < 0.9) { X = p.dispX + (ddx / dd) * mx; Z = p.dispZ + (ddz / dd) * mx; }
      }
      p.dispX = X; p.dispZ = Z; tk.dx = X; tk.dz = Z;
      // ---- locomotion follows the DISTANCE actually travelled by the displayed position (never a sim flag, never wall time)
      let vx = 0, vz = 0;
      if (p.last && dt > 0) { vx = (X - p.last.x) / dt; vz = (Z - p.last.z) / dt; }
      const jump = p.last ? Math.hypot(X - p.last.x, Z - p.last.z) : 0;
      if (jump > 0.9) { p.vx = 0; p.vz = 0; p.speed = 0; p.teleport = true; }                // a scene change: no fake sprint
      else { const k = clamp(dt * 10, 0, 1); p.vx += (vx - p.vx) * k; p.vz += (vz - p.vz) * k; }
      const spd = Math.hypot(p.vx, p.vz);
      p.speed = p.last ? spd : 0;
      p.last = { x: X, z: Z };
      h.setPosition(X, 0, Z);
      // heading: the velocity direction while moving, the sim's facing while standing
      const simYaw = Math.atan2(Math.cos(e.a), Math.sin(e.a));
      const wantYaw = spd > 0.3 ? Math.atan2(p.vx, p.vz) : simYaw;
      if (p.seen < 0 || p.teleport) { h.setFacing(wantYaw, { snap: true }); p.seen = 0; p.teleport = false; p.heading = wantYaw; p.turning = false; }
      p.heading = wantYaw;
      const dyaw = Math.atan2(Math.sin(wantYaw - h.facing), Math.cos(wantYaw - h.facing));
      if (p.turnWas && !h._turn) { p.turnWas = false; p.turnEnd = nowS; }
      if (h._turn) { /* a turn-in-place clip owns the yaw */ }
      else if (spd < 0.2 && Math.abs(dyaw) > 1.2 && !e.clap && h.hasClip('turn_left') && nowS - (p.turnEnd || 0) > 0.6) { h.turn(dyaw, { fade: 0.25, then: 'idle' }); p.pose = 'turn'; p.turnWas = true; }
      else h.setFacing(wantYaw, { snap: false });
      if (h._turn) { /* keep the clip */ }
      else if (e.clap && spd < 0.3) { if (p.pose !== 'clap') { h.play('clap', { fade: 0.2, loop: true }); p.pose = 'clap'; } }
      else {
        p.pose = 'move';
        const vN = spd / p.scale;
        h.locomote(vN, { fade: 0.25 });
        // slow steps (tiptoe, creeping): keep the walk clip but at the rate that matches the ground speed, never an idle clip sliding over the floor
        const tr = h.layers.base.current;
        if (spd > 0.12 && tr && tr.clip.name === 'idle') h.play('walk', { fade: 0.2, loop: true });
        const cur = h.layers.base.current;
        if (cur && spd > 0.12 && cur.clip.name === 'walk') { const wv = (cur.clip.speed || 1.4); cur.speed = clamp(vN / wv, 0.25, 1.8); }
      }
      // ---- the seeker's arms: groping out in front, sweeping side to side, in on a reach
      if (e.role === 'seeker') {
        const yaw = h._turn ? h.root.rotation.y : h.facing;
        const f = tmp.set(Math.sin(yaw), 0, Math.cos(yaw)), lx = Math.cos(yaw), lz = -Math.sin(yaw);
        const k = clamp(e.reach ?? 0, 0, 1), ext = e.arms ?? 0.5;
        const grope = Math.sin((p.gropePh = (p.gropePh || 0) + dt * (1.6 + spd * 1.4)) * 1.0);
        for (const sgn of [1, -1]) {
          const side = sgn > 0 ? 'L' : 'R';
          // reach sweeps from wide-out to hands together in front
          const wide = (0.25 + (1 - k) * 0.1 * ext + 0.2 * (1 - Math.abs(k * 2 - 1)) * (e.reach > 0 ? 1 : 0)) * p.scale / 0.94;
          const fwd = (0.34 + ext * 0.36 + (k > 0 ? 0.15 * Math.sin(k * Math.PI) : 0)) * p.scale / 0.94 + 0.05 * grope * sgn;
          const up = (1.08 - (e.recover ? 0.2 : 0) + (k > 0 ? 0.04 * Math.sin(k * Math.PI) : 0) + 0.035 * grope * -sgn) * p.scale / 0.94;
          const w = new Vector3(X + f.x * fwd + lx * sgn * (wide + 0.04 * grope), up, Z + f.z * fwd + lz * sgn * (wide + 0.04 * grope));
          // critically damped follow so a reach never pops
          const hs = p.hand[side] || (p.hand[side] = { pos: w.clone(), vel: new Vector3() });
          if (p.teleport || jump > 0.9) hs.pos.copy(w);
          const om = 9, kk = om * om;
          const ax = (w.x - hs.pos.x) * kk - 2 * om * hs.vel.x, ay = (w.y - hs.pos.y) * kk - 2 * om * hs.vel.y, az = (w.z - hs.pos.z) * kk - 2 * om * hs.vel.z;
          hs.vel.x += ax * dt; hs.vel.y += ay * dt; hs.vel.z += az * dt;
          const hv = Math.hypot(hs.vel.x, hs.vel.y, hs.vel.z);       // a hand never moves faster than a person's arm does when feeling for someone
          if (hv > 2.0) { const kc = 2.0 / hv; hs.vel.x *= kc; hs.vel.y *= kc; hs.vel.z *= kc; }
          hs.pos.x += hs.vel.x * dt; hs.pos.y += hs.vel.y * dt; hs.pos.z += hs.vel.z * dt;
          h.setReach(side, hs.pos, { weight: 1 });
        }
        h.setFingers('L', 'open'); h.setFingers('R', 'open');
      }
      h.footPlanting = spd > 0.2 || h._turn != null;          // standing still: no re-planting, so the idle loop never twitches a leg
      if (e.tilt) h.lookAt(null);
      void tmpDirs;
    }
    if (!ready && drawn === 0 && !room) return true;
    for (const p of api.cast.values()) {
      if (!p || !p.human.root.visible) continue;
      p.human.update(dt);                                  // advance the rig first; props, cloth and head scale come after
      if (p.headK !== 1) p.headBone.scale.setScalar(p.headK);
      for (const d of p.drapes) d.step(dt, p.speed);
    }
    const side = ctx.getTransform();
    const pxPerUnit = Math.hypot(side.a, side.b);
    if (o.hero) return renderHero(ctx, t0, pxPerUnit, t, people, room, o);
    if (room && room.walls) room.walls.visible = false;
    const devW = clamp(Math.round(1000 * pxPerUnit * (o.dpr ?? 1)), 240, 1280);
    if (api.fitted !== devW || stage.renderer.domElement.width !== devW) { frame(devW); api.fitted = devW; }
    stage.render();
    // composite: floor points are exact; heights lean up the screen (stretch by 1/sin(pitch))
    const hu = (Hm / sinP) * UNITS_PER_M, top = -(HEAD_ROOM_M * cosP / sinP) * UNITS_PER_M;
    ctx.drawImage(stage.renderer.domElement, 0, top, 1000, hu);
    const ms = globalThis.performance.now() - t0;
    api.ema = api.n ? api.ema * 0.95 + ms * 0.05 : ms; api.n = (api.n || 0) + 1;
    if (!api.cheap && api.n > 90 && api.ema > 11 && api.quality !== 'low') { api.cheap = true; api.quality = 'low'; stage.setQuality('low'); for (const r of api.rooms.values()) for (const l of r.kit.lights) l.visible = false; }
    void S;
    return true;
  };
  return api;
}
