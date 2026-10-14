// A sled dog (Alaskan husky). The body, head and tail are single organic surfaces sculpted once from smooth-unioned distance fields
// (view3d/sdf.js): deep chest, tucked waist, muscled hips and shoulders, wedge muzzle, upright ears, bushy sickle tail, neck ruff.
// Four legs are lofted tubes re-bent every frame by a 2-bone IK (shoulder/elbow/wrist, hip/stifle/hock), so there are no joint gaps.
// The gait phase is driven by the DISTANCE the team really travelled (the presenter integrates it): a stance foot moves back at the
// ground speed (no sliding) and a standing team does not paw the air.
// Dog frame: +x forward, +y up, +z toward the camera (the near side). About 1.2x a real husky for readability.
import { THREE } from '../vendor3d/index.js';
import { surfaceNets, sdEllipsoid as E, sdCone as C, smin } from './sdf.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (p) => ((p % 1) + 1) % 1;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const FUR = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color('#e8eefc'), side: THREE.DoubleSide });
const TONGUE = new THREE.MeshStandardMaterial({ color: '#e0707c', roughness: 0.5 });

// ---- shapes sculpted once and shared by all dogs (positions + normals; colours are per dog) --------------------------------------------
const HEAD_PIVOT = [0.42, 0.66, 0], TAIL_PIVOT = [-0.5, 0.65, 0];
let SHAPES = null;
function shapes() {
  if (SHAPES) return SHAPES;
  const body = (x, y, z) => {
    const az = Math.abs(z);
    let d = E(x, y, az, 0.22, 0.56, 0, 0.27, 0.245, 0.165);                       // chest
    d = smin(d, E(x, y, az, -0.04, 0.575, 0, 0.31, 0.19, 0.14), 0.14);            // waist
    d = smin(d, E(x, y, az, -0.31, 0.585, 0, 0.22, 0.21, 0.165), 0.14);           // hips
    d = smin(d, E(x, y, az, 0.28, 0.5, 0.1, 0.14, 0.19, 0.075), 0.09);            // shoulder muscle
    d = smin(d, E(x, y, az, -0.33, 0.47, 0.105, 0.17, 0.22, 0.085), 0.09);        // thigh muscle
    d = smin(d, C(x, y, az, 0.36, 0.62, 0, 0.6, 0.85, 0, 0.13, 0.1), 0.1);        // neck
    d = smin(d, E(x, y, az, 0.47, 0.66, 0, 0.15, 0.2, 0.15), 0.1);                // chest ruff
    return d;
  };
  const head = (x, y, z) => {
    x += HEAD_PIVOT[0]; y += HEAD_PIVOT[1];
    const az = Math.abs(z);
    let d = E(x, y, az, 0.75, 0.9, 0, 0.15, 0.125, 0.115);                        // skull
    d = smin(d, C(x, y, az, 0.84, 0.885, 0, 1.0, 0.845, 0, 0.078, 0.043), 0.06);  // muzzle
    d = smin(d, E(x, y, az, 0.8, 0.855, 0.085, 0.11, 0.085, 0.055), 0.06);        // cheeks
    d = smin(d, C(x, y, az, 0.82, 0.82, 0, 0.96, 0.8, 0, 0.045, 0.034), 0.05);    // jaw
    d = smin(d, E(x, y, az, 0.7, 1.05, 0.078, 0.05, 0.105, 0.022), 0.05);         // ear
    d = smin(d, E(x, y, az, 0.64, 0.8, 0, 0.12, 0.12, 0.12), 0.1);                // neck fur below the skull
    return d;
  };
  const tail = (x, y, z) => {
    x += TAIL_PIVOT[0]; y += TAIL_PIVOT[1];
    const pts = [[-0.5, 0.66, 0.05], [-0.6, 0.72, 0.07], [-0.66, 0.85, 0.085], [-0.58, 0.98, 0.092], [-0.42, 1.03, 0.078], [-0.28, 0.98, 0.046]];
    let d = 1e9;
    for (let i = 0; i < pts.length - 1; i++) d = smin(d, C(x, y, z, pts[i][0], pts[i][1], 0, pts[i + 1][0], pts[i + 1][1], 0, pts[i][2], pts[i + 1][2]), 0.04);
    return d;
  };
  SHAPES = {
    body: surfaceNets(body, [-0.64, 0.12, -0.3], [0.74, 1.02, 0.3], 0.02),
    head: surfaceNets(head, [0.1, 0.0, -0.2], [0.75, 0.62, 0.2], 0.0125),
    tail: surfaceNets(tail, [-0.3, -0.04, -0.14], [0.26, 0.52, 0.14], 0.015),
  };
  return SHAPES;
}
function meshOf(s, colorFn) {
  const g = new THREE.BufferGeometry();
  const n = s.positions.length / 3, col = new Float32Array(n * 3), c = new THREE.Color(), p = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.set(s.positions[i * 3], s.positions[i * 3 + 1], s.positions[i * 3 + 2]); nn.set(s.normals[i * 3], s.normals[i * 3 + 1], s.normals[i * 3 + 2]);
    colorFn(c, p, nn); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('position', new THREE.BufferAttribute(s.positions, 3)); g.setAttribute('normal', new THREE.BufferAttribute(s.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(s.indices);
  g.computeBoundingSphere();
  return g;
}

// gait tables: [walk, trot, lope, gallop], leg order near fore, far fore, near hind, far hind
const PH = [[0, 0.5, 0.25, 0.75], [0, 0.5, 0.5, 0], [0, 0.1, 0.5, 0.6], [0, 0.14, 0.5, 0.62]];
const L1F = 0.21, L2F = 0.21, PASF = 0.12, L1H = 0.22, L2H = 0.21, PASH = 0.14;
const SH = [0.3, 0.5], HP = [-0.34, 0.5];

function ik2(rx, ry, tx, ty, l1, l2, s) {
  const dx = tx - rx, dy = ty - ry, d = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(l1 + l2 - 1e-3, Math.hypot(dx, dy)));
  const a = Math.atan2(dy, dx), A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  return [rx + Math.cos(a + s * A) * l1, ry + Math.sin(a + s * A) * l1, rx + Math.cos(a) * d, ry + Math.sin(a) * d];
}

export function gaitParams(v) {
  // stride length (m per cycle) and stance fraction from speed; the stance foot travels strideLen * ds, so the swing of the leg is half of it
  const strideLen = clamp(0.62 + 0.27 * v, 0.85, 3.2);
  let ds = v < 2 ? 0.62 : v < 4 ? lerp(0.62, 0.5, (v - 2) / 2) : v < 7 ? lerp(0.5, 0.34, (v - 4) / 3) : lerp(0.34, 0.22, clamp((v - 7) / 3, 0, 1));
  ds = Math.min(ds, 0.8 / strideLen);
  const g = v < 2.2 ? 0 : v < 4.5 ? lerp(0, 1, (v - 2.2) / 2.3) : v < 7 ? 1 + (v - 4.5) / 2.5 : 2 + clamp((v - 7) / 3, 0, 1);
  return { strideLen, ds, SL: strideLen * ds / 2, g };
}

// ---- lofted leg: Catmull-Rom through root / elbow / wrist / foot, elliptical sections with a muscular profile
const LS = 14, LR = 8;
function makeLegMesh(fore, color) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array((LS + 1) * (LR + 1) * 3), col = new Float32Array((LS + 1) * (LR + 1) * 3);
  const idx = [];
  for (let i = 0; i < LS; i++) for (let j = 0; j < LR; j++) { const a = i * (LR + 1) + j, b = a + 1, c = a + LR + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  for (let i = 0; i <= LS; i++) for (let j = 0; j <= LR; j++) { const k = (i * (LR + 1) + j) * 3; col[k] = color.r; col[k + 1] = color.g; col[k + 2] = color.b; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length), 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, FUR); m.castShadow = true; m.frustumCulled = false;
  const R = fore ? [[0, 0.085], [0.3, 0.064], [0.52, 0.046], [0.78, 0.04], [1, 0.046]] : [[0, 0.125], [0.3, 0.088], [0.55, 0.05], [0.8, 0.04], [1, 0.045]];
  const prof = (u) => { for (let i = 1; i < R.length; i++) if (u <= R[i][0]) { const a = R[i - 1], b = R[i], t = (u - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], t * t * (3 - 2 * t)); } return R[R.length - 1][1]; };
  m.userData.set = (P, z) => {
    const p = pos;
    for (let i = 0; i <= LS; i++) {
      const u = i / LS, s = u * 3, k = Math.min(2, Math.floor(s)), t = s - k;
      const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(3, k + 2)];
      const t2 = t * t, t3 = t2 * t;
      const cx = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const cy = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      const tx = 0.5 * ((-p0[0] + p2[0]) + 2 * (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t + 3 * (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t2);
      const ty = 0.5 * ((-p0[1] + p2[1]) + 2 * (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t + 3 * (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t2);
      const tl = Math.hypot(tx, ty) || 1, bx = -ty / tl, by = tx / tl, r = prof(u);
      for (let j = 0; j <= LR; j++) {
        const a = j / LR * TAU, c = Math.cos(a), sn = Math.sin(a), q = (i * (LR + 1) + j) * 3;
        p[q] = cx + bx * c * r; p[q + 1] = cy + by * c * r; p[q + 2] = z + sn * r * 0.86;
      }
    }
    g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.attributes.normal.needsUpdate = true;
  };
  return m;
}

export function makeDog(def, { harness = '#e0683a' } = {}) {
  const [base, mark, light] = def.coat;
  const cBase = new THREE.Color(base), cMark = new THREE.Color(mark), cLight = new THREE.Color(light);
  const lumB = 0.3 * cBase.r + 0.59 * cBase.g + 0.11 * cBase.b;
  const eyeCol = lumB > 0.5 ? '#79b4e6' : '#5a3a1e';
  const root = new THREE.Group(); root.name = 'dog';
  const bodyG = new THREE.Group(); root.add(bodyG);
  const SP = shapes();

  const bodyColor = (c, p, n) => {
    const up = clamp(n.y * 0.95 + (p.y - 0.56) * 1.5, -1, 1);
    c.copy(cBase);
    c.lerp(cMark, sstep(0.1, 0.7, up) * 0.92);
    c.lerp(cLight, sstep(-0.05, -0.55, up) * 0.95);
    if (p.x > 0.4) c.lerp(cLight, sstep(0.42, 0.62, p.x) * 0.6);                     // white chest and bib
    if (p.x < -0.45) c.lerp(cMark, 0.2);
    const v = (Math.sin(p.x * 8.1 + p.z * 4.3) + Math.sin(p.y * 11.7 - p.x * 3.9)) * 0.018; c.r = clamp(c.r + v, 0, 1); c.g = clamp(c.g + v, 0, 1); c.b = clamp(c.b + v, 0, 1);
  };
  const headColor = (c, p, n) => {
    const x = p.x + HEAD_PIVOT[0], y = p.y + HEAD_PIVOT[1];
    c.copy(cLight);
    const cap = sstep(0.0, 0.5, n.y * 0.6 + (y - 0.86) * 5) * sstep(0.96, 0.8, x);
    c.lerp(cMark, cap * 0.92);
    if (y > 1.0) c.lerp(cMark, 0.9);
    const ez = Math.abs(p.z); if (x > 0.78 && x < 0.9 && ez > 0.04 && y > 0.86) c.lerp(cMark, 0.5);
    if (x < 0.62) c.lerp(cBase, 0.5);
  };
  const tailColor = (c, p) => {
    const x = p.x + TAIL_PIVOT[0], y = p.y + TAIL_PIVOT[1];
    c.copy(cBase).lerp(cMark, 0.3).lerp(cLight, sstep(0.9, 1.04, y) * 0.6 + sstep(-0.42, -0.28, x) * 0.7);
  };
  const torsoM = new THREE.Mesh(meshOf(SP.body, bodyColor), FUR); torsoM.castShadow = true; torsoM.receiveShadow = true; bodyG.add(torsoM);
  // harness: padded collar, back line, belly strap
  const STRAP = new THREE.MeshStandardMaterial({ color: harness, roughness: 0.6 });
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.026, 8, 30), STRAP); collar.rotation.y = Math.PI / 2; collar.position.set(0.3, 0.56, 0); collar.scale.set(1, 1.2, 0.88); collar.castShadow = true; bodyG.add(collar);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.014, 0.05), STRAP); spine.position.set(-0.12, 0.79, 0); spine.rotation.z = 0.02; bodyG.add(spine);
  const belly = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 24), STRAP); belly.rotation.y = Math.PI / 2; belly.position.set(0.0, 0.575, 0); belly.scale.set(1, 1.1, 0.8); bodyG.add(belly);

  // head + neck fur group (pivot at the base of the neck)
  const headG = new THREE.Group(); headG.position.set(...HEAD_PIVOT); bodyG.add(headG);
  const headM = new THREE.Mesh(meshOf(SP.head, headColor), FUR); headM.castShadow = true; headG.add(headM);
  const eyeMat = new THREE.MeshStandardMaterial({ color: eyeCol, roughness: 0.2 }), pupilMat = new THREE.MeshStandardMaterial({ color: '#06060a', roughness: 0.2 }), noseMat = new THREE.MeshStandardMaterial({ color: '#0b0b10', roughness: 0.3 });
  for (const z of [0.088, -0.088]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), eyeMat); eye.position.set(0.85 - HEAD_PIVOT[0], 0.925 - HEAD_PIVOT[1], z * 1.02); eye.scale.set(1.0, 0.85, 0.7); headG.add(eye);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), pupilMat); pup.position.set(0.866 - HEAD_PIVOT[0], 0.925 - HEAD_PIVOT[1], z * 1.07); headG.add(pup);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), noseMat); nose.scale.set(1.0, 0.85, 1.1); nose.position.set(1.005 - HEAD_PIVOT[0], 0.85 - HEAD_PIVOT[1], 0); headG.add(nose);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), TONGUE); tongue.scale.set(2.0, 0.3, 0.85); tongue.position.set(0.93 - HEAD_PIVOT[0], 0.78 - HEAD_PIVOT[1], 0); headG.add(tongue); tongue.visible = false;

  // tail
  const tailG = new THREE.Group(); tailG.position.set(...TAIL_PIVOT); bodyG.add(tailG);
  const tailM = new THREE.Mesh(meshOf(SP.tail, tailColor), FUR); tailM.castShadow = true; tailG.add(tailM);

  // legs
  const cLeg = new THREE.Color().copy(cBase).lerp(cLight, 0.25);
  const pawMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().copy(cBase).lerp(cLight, 0.35), roughness: 0.95 });
  const legs = [];
  for (let k = 0; k < 4; k++) {
    const fore = k < 2, z = k % 2 === 0 ? 0.105 : -0.105;
    const mesh = makeLegMesh(fore, cLeg); root.add(mesh);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.066, 14, 10), pawMat); paw.scale.set(1.45, 0.62, 1.0); paw.castShadow = true; root.add(paw);
    legs.push({ fore, z, mesh, paw, planted: false, wasPlanted: false });
  }

  const S = { lie: 0, sit: 0, head: 0, pant: 0, bob: 0 };

  // update(st): st = { v (m/s), phase (cycles), pose: 'run'|'stand'|'lie'|'sit', e (energy 0..1), t (clock), dt, ph0, look, onStep }
  function update(st) {
    const dt = st.dt || 0.016, k = 1 - Math.exp(-dt * 6);
    S.lie += ((st.pose === 'lie' ? 1 : 0) - S.lie) * k;
    S.sit += ((st.pose === 'sit' ? 1 : 0) - S.sit) * k;
    const moving = st.pose === 'run' && st.v > 0.3;
    const gp = gaitParams(Math.max(0, st.v));
    const ph = st.phase;
    const g = gp.g, gi = Math.min(2, Math.floor(g)), gf = g - gi;
    const off = (j) => lerp(PH[gi][j], PH[Math.min(3, gi + 1)][j], gf);
    S.bob += ((moving ? 1 : 0) - S.bob) * k;
    const gal = sstep(2.2, 3, g);
    const bounce = moving ? (Math.abs(Math.sin(ph * TAU * (g > 1.5 ? 1 : 2))) * (0.012 + 0.015 * g)) : Math.sin(st.t * 1.2 + (st.ph0 || 0) * 7) * 0.004;
    const pitch = moving ? Math.sin((ph + 0.2) * TAU) * (0.015 + 0.045 * gal) : 0;
    const byo = bounce * S.bob + (-0.3 * S.lie) - 0.05 * S.sit;
    bodyG.position.set(0, byo, 0);
    bodyG.rotation.z = pitch * S.bob - 0.55 * S.sit;
    const tir = clamp(1 - (st.e ?? 1), 0, 1);
    const headTarget = moving ? -0.1 - 0.15 * gal - 0.3 * tir : st.pose === 'lie' ? 0.16 : 0.1 - 0.4 * tir * tir;
    S.head += (headTarget - S.head) * (1 - Math.exp(-dt * 4));
    headG.rotation.z = S.head + (st.look || 0) + (moving ? Math.sin(ph * TAU * 2 + 1) * 0.04 : Math.sin(st.t * 0.9 + (st.ph0 || 0) * 5) * 0.03);
    headG.rotation.y = st.pose === 'lie' || st.pose === 'sit' ? Math.sin(st.t * 0.4 + (st.ph0 || 0) * 9) * 0.35 : Math.sin(st.t * 0.7 + (st.ph0 || 0) * 3) * 0.08;
    const wantPant = (moving && g > 1.2) || tir > 0.45 || (st.pose !== 'run' && st.panting);
    S.pant += ((wantPant ? 1 : 0) - S.pant) * (1 - Math.exp(-dt * 5));
    tongue.visible = S.pant > 0.3;
    tongue.position.y = 0.78 - HEAD_PIVOT[1] - 0.025 * S.pant + Math.sin(st.t * 14 + (st.ph0 || 0)) * 0.006 * S.pant;
    tongue.scale.set(2.0, 0.28 + 0.18 * S.pant, 0.85);
    const wag = Math.sin(st.t * (st.pose === 'run' ? 5 : 7) + (st.ph0 || 0) * 11) * (st.pose === 'run' ? 0.16 : 0.34 * (st.happy ? 1 : 0.5));
    tailG.rotation.y = wag; tailG.rotation.z = moving ? -0.1 * gal : 0;
    tailG.position.y = TAIL_PIVOT[1] - 0.04 * S.lie;

    const cs = Math.cos(bodyG.rotation.z), sn = Math.sin(bodyG.rotation.z);
    const T = (x, y) => [x * cs - y * sn, x * sn + y * cs + byo];
    for (let j = 0; j < 4; j++) {
      const L = legs[j], fore = L.fore;
      const rootP = T(fore ? SH[0] : HP[0], fore ? SH[1] : HP[1]);
      const xc = fore ? 0.27 : -0.36, p = wrap(ph + off(j));
      const SL = gp.SL;
      let fx, fy;
      if (moving) {
        if (p < gp.ds) { const t = p / gp.ds; fx = xc + SL * (1 - 2 * t); fy = 0; L.planted = true; }
        else { const t = (p - gp.ds) / (1 - gp.ds), e = t * t * (3 - 2 * t); fx = xc - SL + 2 * SL * e; fy = (0.07 + 0.08 * g) * Math.pow(Math.sin(Math.PI * t), 0.8); L.planted = false; }
      } else { fx = xc + (fore ? (j === 1 ? -0.05 : 0.04) : (j === 3 ? 0.03 : -0.02)); fy = 0; L.planted = true; }
      const lieFoot = fore ? [0.5 - (j === 1 ? 0.04 : 0), 0.0] : [-0.2 + (j === 3 ? 0.06 : 0), 0.0];
      const sitFoot = fore ? [0.28 + (j === 1 ? -0.04 : 0.02), 0] : [-0.16 + (j === 3 ? 0.04 : 0), 0];
      fx = lerp(fx, lieFoot[0], S.lie); fy = lerp(fy, lieFoot[1], S.lie);
      fx = lerp(fx, sitFoot[0], S.sit); fy = lerp(fy, sitFoot[1], S.sit);
      let wx, wy;
      if (fore) { wx = fx - 0.02; wy = fy + PASF; }
      else {
        const ang = moving ? 0.25 + (fy > 0.01 ? 0.5 : 0) : 0.35 + 0.5 * S.sit - 0.2 * S.lie;
        wx = fx - Math.sin(ang) * PASH; wy = fy + Math.cos(ang) * PASH;
      }
      const [jx, jy, tx, ty] = ik2(rootP[0], rootP[1], wx, wy, fore ? L1F : L1H, fore ? L2F : L2H, fore ? -1 : 1);
      L.mesh.userData.set([[rootP[0], rootP[1]], [jx, jy], [tx, ty], [fx, fy + 0.05]], L.z);
      L.paw.position.set(fx + 0.035, fy + 0.03, L.z);
      L.paw.rotation.z = moving && !L.planted ? -0.35 : 0;
      if (moving && st.onStep && L.planted && !L.wasPlanted && gp.g > 0.8) st.onStep(fx, L.z);
      L.wasPlanted = L.planted;
    }
  }
  return { root, update, legs, bodyG, headG, tailG, S };
}
