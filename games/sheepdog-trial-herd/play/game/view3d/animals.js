// The animals: a woolly flock (instanced, with a gait, grazing, alert, stamping and running poses) and a black-and-white border collie
// (articulated: walk, trot, gallop with a flexing spine, the crouching stalk with a hard stare, lying down, panting). Procedural, no assets.
// The simulation owns every position; these only read it. Sim (x, z, heading h) maps to the scene as (-x, height, z), yaw -h.
import { mergeParts } from './scene.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

export function createAnimals(V3, root, n) {
  const { THREE } = V3;
  const M4 = THREE.Matrix4, Q = THREE.Quaternion, E = THREE.Euler, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const std = (c, r = 0.9, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, ...o });
  const ell = (rx, ry, rz, x, y, z, color, o = {}) => ({ geo: new THREE.SphereGeometry(1, o.w || 14, o.h || 10), m: new M4().compose(V(x, y, z), new Q().setFromEuler(new E(o.rx || 0, o.ry || 0, o.rz || 0)), V(rx, ry, rz)), color });
  const R = rnd(31);
  const mtx = new M4(), tmp = new M4(), qa = new Q(), ea = new E(), p3 = V(), s3 = V(1, 1, 1);

  // ======================================================== the sheep ========================================================
  const woolNoise = (x, y, z) => Math.sin(x * 23 + y * 7) * Math.sin(z * 19 - y * 11) * 0.5 + Math.sin(x * 41 + z * 37) * 0.25;
  const woolColor = (x, y, z, nx, ny) => {
    const nz = woolNoise(x, y, z), under = clamp(0.5 + ny * 0.7, 0.55, 1), v = (0.92 + 0.05 * nz) * under;
    return [0.95 * v, 0.915 * v, 0.84 * v];
  };
  const woolBlob = (rx, ry, rz, x, y, z, o = {}) => {
    const g = new THREE.SphereGeometry(1, 20, 14), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), f = 1 + 0.07 * woolNoise(px * 2, py * 2, pz * 2) + 0.035 * Math.sin(px * 17 + pz * 13); p.setXYZ(i, px * f, py * f, pz * f); }
    g.computeVertexNormals();
    return { geo: g, m: new M4().compose(V(x, y - 0.1, z), new Q().setFromEuler(new E(o.rx || 0, 0, 0)), V(rx, ry, rz)), color: (px, py, pz, nx, ny, nz2) => { const c = woolColor(px, py, pz, nx, ny, nz2); const k = 1 + (o.tint || 0); return [c[0] * k, c[1] * k, c[2] * k]; } };
  };
  const bodyParts = [
    woolBlob(0.3, 0.31, 0.5, 0, 0.64, 0), woolBlob(0.29, 0.29, 0.3, 0, 0.64, -0.3), woolBlob(0.28, 0.28, 0.27, 0, 0.66, 0.3),
    woolBlob(0.2, 0.17, 0.22, 0.12, 0.88, -0.1, { tint: 0.04 }), woolBlob(0.2, 0.17, 0.2, -0.12, 0.88, 0.1, { tint: 0.02 }), woolBlob(0.2, 0.15, 0.22, 0, 0.9, -0.28),
    woolBlob(0.15, 0.13, 0.15, 0.2, 0.74, 0.22, { tint: -0.03 }), woolBlob(0.15, 0.13, 0.15, -0.2, 0.74, -0.2, { tint: -0.02 }),
    { geo: new THREE.SphereGeometry(1, 8, 6), m: new M4().compose(V(0, 0.56, -0.58), new Q(), V(0.07, 0.09, 0.07)), color: '#e9e2cf' },   // the short tail
  ];
  const bodyGeo = mergeParts(THREE, bodyParts);
  const faceCols = { black: ['#1c1a1c', '#2a2527', '#d9d2c2'], white: ['#ece7da', '#d8b8a0', '#e9e4d8'] };
  const headFor = (face) => {
    const [fc, nose, leg] = faceCols[face]; void leg;
    const parts = [
      woolBlob(0.15, 0.17, 0.2, 0, 0.0, 0.03, { rx: 0.5 }),                                                    // the neck, in wool
      ell(0.09, 0.105, 0.155, 0, 0.1, 0.25, fc, { rx: -0.25 }), ell(0.052, 0.058, 0.1, 0, 0.055, 0.38, nose, { rx: -0.2 }),     // skull, muzzle
      ell(0.034, 0.022, 0.03, 0, 0.045, 0.47, '#2a2023'),                                                       // nose
      ell(0.09, 0.022, 0.05, 0.135, 0.15, 0.2, fc, { rz: -0.5, ry: 0.35 }), ell(0.09, 0.022, 0.05, -0.135, 0.15, 0.2, fc, { rz: 0.5, ry: -0.35 }),   // ears
      ell(0.018, 0.018, 0.012, 0.075, 0.13, 0.33, '#d6c46a'), ell(0.018, 0.018, 0.012, -0.075, 0.13, 0.33, '#d6c46a'),                       // eyes
    ];
    if (face === 'white') parts.push(ell(0.07, 0.05, 0.06, 0, 0.21, 0.19, '#f1ece0'));                          // a woolly topknot
    return mergeParts(THREE, parts);
  };
  const legGeo = (legc) => mergeParts(THREE, [
    { geo: new THREE.CylinderGeometry(0.05, 0.034, 0.36, 8), m: new M4().makeTranslation(0, -0.18, 0), color: legc },
    { geo: new THREE.CylinderGeometry(0.038, 0.042, 0.05, 8), m: new M4().makeTranslation(0, -0.385, 0), color: '#2b2522' },
  ]);
  const mark = new THREE.SphereGeometry(1, 8, 5);
  const bodyMat = std(0xffffff, 0.98, { vertexColors: true }), faceMat = std(0xffffff, 0.8, { vertexColors: true });

  const breedOf = (i) => (i % 5 === 3 || i % 7 === 5 ? 'white' : 'black');
  const idxBy = { black: [], white: [] };
  for (let i = 0; i < n; i++) idxBy[breedOf(i)].push(i);
  const mkIM = (geo, mat, count) => { const im = new THREE.InstancedMesh(geo, mat, Math.max(1, count)); im.count = count; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; root.add(im); return im; };
  const bodies = mkIM(bodyGeo, bodyMat, n);
  const heads = { black: mkIM(headFor('black'), faceMat, idxBy.black.length), white: mkIM(headFor('white'), faceMat, idxBy.white.length) };
  const legs = { black: mkIM(legGeo('#26211f'), faceMat, idxBy.black.length * 4), white: mkIM(legGeo('#cfc8b8'), faceMat, idxBy.white.length * 4) };
  const marks = mkIM(mark, std(0xffffff, 0.9), n);
  const rad = ['#d9433a', '#3a76c9', '#e1b53a', '#3aa56a', '#9a5ac9', '#e0743a', '#3ac9c0', '#c93a8a'];
  const tint = new THREE.Color();
  for (let i = 0; i < n; i++) { tint.setHSL(0.11, 0.08 + R() * 0.1, 0.92 + R() * 0.08); bodies.setColorAt(i, tint); marks.setColorAt(i, tint.set(rad[i % rad.length])); }
  const st = Array.from({ length: n }, (_, i) => ({ ph: R() * TAU, yaw: 0, head: 0.9, headYaw: 0, hy: 0, init: false, lx: 0, lz: 0, breed: breedOf(i), k: idxBy[breedOf(i)].indexOf(i), stampT: R() * 3, chew: R() * 6, size: 1 }));
  // the lead ewe's collar and bell
  const bell = new THREE.Group();
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 14), std(0x5a3a22, 0.8)); collar.rotation.x = Math.PI / 2 + 0.5; bell.add(collar);
  const bellM = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), std(0xd9a93a, 0.35, { metalness: 0.8 })); bellM.position.set(0, -0.12, 0.08); bell.add(bellM);
  bell.castShadow = true; root.add(bell);
  const flockDispose = () => { for (const im of [bodies, heads.black, heads.white, legs.black, legs.white, marks]) { root.remove(im); im.dispose(); } root.remove(bell); };

  const HIP = [[0.14, 0.4, 0.3], [-0.14, 0.4, 0.3], [0.14, 0.4, -0.3], [-0.14, 0.4, -0.3]];    // FL FR BL BR (scene x+ = the ewe's left)
  function updateFlock(sheep, dog, dt, t, hAt) {
    for (let i = 0; i < sheep.length; i++) {
      const a = sheep[i], s = st[i], sz = a.size || 1;
      const X = -a.x, Z = a.z, v = a.sp || 0;
      const tyaw = -a.h;
      if (!s.init) { s.yaw = tyaw; s.init = true; }
      s.yaw += wrap(tyaw - s.yaw) * Math.min(1, 7 * dt);
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
      const y0 = hAt(X, Z), yF = hAt(X + fx * 0.45, Z + fz * 0.45), yB = hAt(X - fx * 0.45, Z - fz * 0.45);
      const pitch = Math.atan2(yB - yF, 0.9);
      const gal = smooth(3.4, 4.6, v), moving = smooth(0.08, 0.35, v);
      s.ph += TAU * dt * Math.max(0, v) / (0.62 + 0.25 * gal);
      const ph = s.ph;
      const grazing = a.mode === 'graze' && a.alarm < 0.12, stamp = a.mode === 'stamp';
      // pose targets
      let hp = grazing ? 0.95 : a.alarm > 0.2 ? -0.12 : 0.18;       // head pitch (positive = down)
      if (v > 3.8) hp = 0.05; else if (moving > 0.5 && !grazing) hp = 0.25;
      if (grazing && v > 0.05) hp = 0.7;
      if (stamp) hp = 0.32;
      s.head += (hp - s.head) * Math.min(1, 5 * dt);
      s.chew += dt * (grazing ? 6 : 0);
      // look at the dog when worried
      let hy = 0;
      if (a.alarm > 0.1 || stamp) hy = clamp(wrap(Math.atan2(-dog.x - X, dog.z - Z) - s.yaw), -1.0, 1.0);
      s.hy += (hy - s.hy) * Math.min(1, 4 * dt);
      const bob = (gal > 0.5 ? Math.abs(Math.sin(ph)) * 0.09 : Math.abs(Math.sin(ph * 2)) * 0.014 * moving) + (grazing ? Math.sin(t * 1.3 + s.k) * 0.003 : 0);
      const lean = gal * Math.sin(ph) * 0.08;
      const yaw = s.yaw, pit = pitch + lean + (stamp ? -0.04 : 0);
      ea.set(pit, yaw, Math.sin(ph * 2) * 0.04 * moving, 'YXZ'); qa.setFromEuler(ea);
      p3.set(X, y0 + bob, Z); s3.set(sz, sz * (1 + 0.015 * Math.sin(ph * 2) * moving), sz);
      const base = new M4().compose(p3, qa, s3);
      bodies.setMatrixAt(i, base);
      // the head
      const hm = new M4().compose(V(0, 0.58, 0.4), new Q().setFromEuler(new E(s.head + (grazing ? Math.sin(s.chew) * 0.04 : 0), s.hy, 0, 'YXZ')), V(1, 1, 1));
      tmp.multiplyMatrices(base, hm); heads[s.breed].setMatrixAt(s.k, tmp);
      // the legs: FL FR BL BR; diagonal pairs when trotting, bounding when running
      for (let k = 0; k < 4; k++) {
        const front = k < 2, left = k % 2 === 0;
        const off = gal > 0.5 ? (front ? 0 : 0.7) : (front === left ? 0 : Math.PI);
        let sw = Math.sin(ph + off) * (0.22 + 0.5 * clamp(v / 2.5, 0, 1) + 0.25 * gal) * moving;
        if (stamp && k === 0) sw = (Math.max(0, Math.sin(t * 9 + s.k)) * 0.8 - 0.1);
        const lift = Math.max(0, Math.cos(ph + off)) * 0.04 * moving;
        const h = HIP[k];
        ea.set(-sw, 0, 0); qa.setFromEuler(ea);
        const lm = new M4().compose(V(h[0], h[1] + lift, h[2]), qa, V(1, 1, 1));
        tmp.multiplyMatrices(base, lm); legs[s.breed].setMatrixAt(s.k * 4 + k, tmp);
      }
      // the raddle mark on the rump
      const mm = new M4().compose(V(0, 0.84, -0.3), new Q(), V(0.09, 0.025, 0.1)); tmp.multiplyMatrices(base, mm); marks.setMatrixAt(i, tmp);
      if (a.lead) {
        const bm = new M4().compose(V(0, 0.55, 0.45), new Q().setFromEuler(new E(s.head * 0.7, s.hy * 0.6, 0, 'YXZ')), V(1, 1, 1));
        tmp.multiplyMatrices(base, bm); tmp.decompose(bell.position, bell.quaternion, bell.scale);
      }
    }
    for (const im of [bodies, heads.black, heads.white, legs.black, legs.white, marks]) im.instanceMatrix.needsUpdate = true;
  }

  // ======================================================== the dog ========================================================
  const BLK = '#17171b', WHT = '#f3efe6', SOCK = '#ece7dc';
  const furN = (x, y, z) => 1 + 0.04 * Math.sin(x * 60 + y * 40) * Math.sin(z * 50);
  const dogMat = std(0xffffff, 0.78, { vertexColors: true });
  const colBlack = (x, y, z) => { const v = 0.012 * furN(x, y, z); return [v, v, v * 1.2]; };
  const colWhite = () => [0.82, 0.8, 0.74];
  // chest and bib: white on the front and lower chest, black over the back
  const torso = mergeParts(THREE, [
    ell(0.125, 0.145, 0.24, 0, 0.5, 0.15, (x, y, z) => ((z > 0.18 && y < 0.5 + (z - 0.18) * 0.2) || (y < 0.43 && z > 0.05) ? colWhite() : colBlack(x, y, z))),
    ell(0.115, 0.125, 0.2, 0, 0.47, -0.04, (x, y, z) => (y < 0.4 && z > -0.02 ? colWhite() : colBlack(x, y, z))),
    ell(0.115, 0.13, 0.2, 0, 0.46, -0.22, colBlack),
    ell(0.05, 0.1, 0.1, 0.1, 0.4, -0.27, colBlack), ell(0.05, 0.1, 0.1, -0.1, 0.4, -0.27, colBlack),     // haunches
    ell(0.1, 0.045, 0.14, 0, 0.6, 0.12, (x, y, z) => colBlack(x, y, z)),                                  // shoulders / ruff
    ell(0.06, 0.09, 0.07, 0, 0.42, 0.33, colWhite),                                                         // the white bib
  ]);
  const headMesh = mergeParts(THREE, [
    ell(0.07, 0.068, 0.1, 0, 0, 0.09, (x, y, z) => (z > 0.12 && Math.abs(x) < 0.022 ? colWhite() : colBlack(x, y, z)), { w: 18, h: 14 }),         // skull with a white blaze
    ell(0.036, 0.034, 0.095, 0, -0.022, 0.19, (x, y, z) => (Math.abs(x) < 0.016 && y > -0.03 ? colWhite() : colBlack(x, y, z)), { w: 14, h: 10 }),   // muzzle
    ell(0.024, 0.018, 0.022, 0, -0.008, 0.28, '#0b0b0d'),                                                                                         // nose
    ell(0.013, 0.013, 0.009, 0.046, 0.018, 0.15, '#c07a1c'), ell(0.013, 0.013, 0.009, -0.046, 0.018, 0.15, '#c07a1c'),                            // amber eyes
    ell(0.007, 0.007, 0.005, 0.048, 0.018, 0.157, '#050505'), ell(0.007, 0.007, 0.005, -0.048, 0.018, 0.157, '#050505'),
    ell(0.045, 0.02, 0.05, 0, 0.055, 0.02, colBlack), ell(0.02, 0.03, 0.04, 0.06, -0.03, 0.2, colBlack), ell(0.02, 0.03, 0.04, -0.06, -0.03, 0.2, colBlack),
  ]);
  const earGeo = mergeParts(THREE, [ell(0.028, 0.05, 0.012, 0, 0.04, 0, colBlack, { w: 10, h: 8 }), ell(0.02, 0.03, 0.01, 0, 0.065, 0.012, colBlack, { w: 8, h: 6 })]);
  const neckMesh = mergeParts(THREE, [ell(0.068, 0.1, 0.075, 0, 0.0, 0.0, (x, y, z) => (y < -0.02 ? colWhite() : colBlack(x, y, z)), { rx: -0.9, w: 14, h: 10 }), ell(0.085, 0.07, 0.07, 0, -0.04, -0.02, colWhite, { rx: -0.6 })]);
  const upperGeo = (white) => mergeParts(THREE, [{ geo: new THREE.CylinderGeometry(0.056, 0.034, 0.24, 10), m: new M4().makeTranslation(0, -0.12, 0), color: white ? colWhite : colBlack }, ell(0.05, 0.1, 0.06, 0, -0.07, -0.01, colBlack)]);
  const lowerGeo = mergeParts(THREE, [
    { geo: new THREE.CylinderGeometry(0.028, 0.022, 0.22, 8), m: new M4().makeTranslation(0, -0.11, 0), color: (x, y, z) => (y < -0.11 ? colWhite() : colBlack(x, y, z)) },
    ell(0.03, 0.022, 0.05, 0, -0.232, 0.022, colWhite, { w: 10, h: 8 }),
  ]);
  const tailSeg = mergeParts(THREE, [ell(0.045, 0.045, 0.11, 0, 0, -0.07, (x, y, z) => colBlack(x, y, z)), ell(0.03, 0.05, 0.1, 0, -0.025, -0.07, colBlack)]);
  const tailTip = mergeParts(THREE, [ell(0.05, 0.05, 0.12, 0, 0, -0.07, colWhite), ell(0.03, 0.05, 0.1, 0, -0.02, -0.07, colWhite)]);
  const tongueGeo = mergeParts(THREE, [ell(0.016, 0.006, 0.05, 0, 0, 0.03, '#e0707a', { w: 8, h: 6 })]);

  const D = new THREE.Group(); D.name = 'dog'; root.add(D);
  const mesh = (geo, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, dogMat); m.castShadow = true; m.receiveShadow = true; m.position.set(x, y, z); parent.add(m); return m; };
  const body = new THREE.Group(); D.add(body);
  const torsoM = mesh(torso, body);
  const neck = new THREE.Group(); neck.position.set(0, 0.58, 0.3); body.add(neck);
  mesh(neckMesh, neck, 0, 0.02, 0.06);
  const head = new THREE.Group(); head.position.set(0, 0.07, 0.12); neck.add(head);
  mesh(headMesh, head);
  const earL = mesh(earGeo, head, 0.05, 0.05, 0.08), earR = mesh(earGeo, head, -0.05, 0.05, 0.08);
  const tongue = mesh(tongueGeo, head, 0, -0.045, 0.22); tongue.visible = false;
  const mkLeg = (x, y, z, front) => {
    const hip = new THREE.Group(); hip.position.set(x, y, z); body.add(hip);
    mesh(upperGeo(front && false), hip);
    const knee = new THREE.Group(); knee.position.set(0, -0.24, 0); hip.add(knee);
    mesh(lowerGeo, knee);
    return { hip, knee };
  };
  const LEG = { FL: mkLeg(0.078, 0.46, 0.2, true), FR: mkLeg(-0.078, 0.46, 0.2, true), BL: mkLeg(0.082, 0.43, -0.24, false), BR: mkLeg(-0.082, 0.43, -0.24, false) };
  const tail = [];
  { let par = body; let pos = V(0, 0.5, -0.38); for (let i = 0; i < 4; i++) { const g = new THREE.Group(); g.position.copy(pos); par.add(g); mesh(i === 3 ? tailTip : tailSeg, g); tail.push(g); par = g; pos = V(0, 0, -0.13); } }
  D.scale.setScalar(1.12);

  const ds = { ph: 0, yaw: 0, init: false, crouch: 0, lie: 0, head: 0, hyaw: 0, tailY: 0, tailX: 0, pant: 0, blink: 0, legs: { FL: [0, 0], FR: [0, 0], BL: [0, 0], BR: [0, 0] }, spine: 0, ear: 0, roll: 0, vs: 0, y: 0 };
  function updateDog(d, flock, dt, t, hAt) {
    const X = -d.x, Z = d.z, v = d.v;
    ds.vs += (v - ds.vs) * Math.min(1, 12 * dt);
    const tyaw = -d.h;
    if (!ds.init) { ds.yaw = tyaw; ds.init = true; }
    ds.yaw += wrap(tyaw - ds.yaw) * Math.min(1, 14 * dt);
    const fx = Math.sin(ds.yaw), fz = Math.cos(ds.yaw);
    const y0 = hAt(X, Z), yF = hAt(X + fx * 0.5, Z + fz * 0.5), yB = hAt(X - fx * 0.5, Z - fz * 0.5);
    const pitch = Math.atan2(yB - yF, 1.0);
    const lieT = d.cmd === 'lie' && d.crouch > 0.8 ? 1 : 0;
    ds.lie += (lieT - ds.lie) * Math.min(1, 6 * dt);
    ds.crouch += (d.crouch - ds.crouch) * Math.min(1, 5 * dt);
    const gal = smooth(5.4, 7.2, ds.vs), trot = smooth(2.2, 3.4, ds.vs) * (1 - gal), walk = smooth(0.12, 0.5, ds.vs) * (1 - trot - gal);
    const mv = smooth(0.1, 0.4, ds.vs);
    const stride = 0.8 + 0.3 * ds.vs;
    ds.ph += TAU * dt * ds.vs / stride;
    const ph = ds.ph, L = ds.lie, C = ds.crouch * (1 - L);
    // phase offsets per leg and gait (walk: 4 beat; trot: diagonals; gallop: pairs)
    const off = {
      FL: [0, 0, 0], FR: [Math.PI * 0.5 * 2 / 2 * 1, Math.PI, 0.18 * TAU],
      BL: [Math.PI * 1.5, Math.PI, 0.55 * TAU], BR: [Math.PI * 0.5, 0, 0.5 * TAU],
    };
    off.FL = [0, 0, 0]; off.FR = [Math.PI, Math.PI, 0.1 * TAU]; off.BL = [Math.PI * 0.5, Math.PI, 0.55 * TAU]; off.BR = [Math.PI * 1.5, 0, 0.5 * TAU];
    const amp = { walk: 0.42, trot: 0.55, gal: 0.95 };
    const setLeg = (name, front) => {
      const o = off[name];
      const sWalk = Math.sin(ph + o[0]), sTrot = Math.sin(ph + o[1]), sGal = Math.sin(ph + o[2]);
      let sw = walk * sWalk * amp.walk + trot * sTrot * amp.trot + gal * sGal * amp.gal;
      const lifted = walk * Math.max(0, Math.cos(ph + o[0])) + trot * Math.max(0, Math.cos(ph + o[1])) + gal * Math.max(0, Math.cos(ph + o[2]));
      let up = -sw * (front ? 1 : 1);            // upper-leg rotation: negative = forward
      let kn = lifted * (front ? 0.95 : -0.8) * mv + (front ? 0 : 0);
      // the stalk: legs bent, belly low
      up += C * (front ? -0.5 : 0.55); kn += C * (front ? 0.9 : -1.0);
      // standing: hind legs have a natural crook
      up += (front ? 0 : 0.28) * (1 - L); kn += (front ? 0 : -0.5) * (1 - L);
      // lying: front legs forward, hind legs tucked
      up = lerp(up, front ? -1.45 : 1.15, L); kn = lerp(kn, front ? 1.7 : -2.1, L);
      const cur = ds.legs[name]; cur[0] += (up - cur[0]) * Math.min(1, 22 * dt); cur[1] += (kn - cur[1]) * Math.min(1, 22 * dt);
      LEG[name].hip.rotation.x = cur[0]; LEG[name].knee.rotation.x = cur[1];
      LEG[name].hip.position.x = (name.endsWith('L') ? 1 : -1) * (front ? 0.078 : 0.082) * (1 + L * 0.5);
    };
    setLeg('FL', true); setLeg('FR', true); setLeg('BL', false); setLeg('BR', false);
    // the body: bounce, spine flex, crouch, lie, turn lean, breathing
    const pantRate = 3 + (1 - d.stamina) * 6 + gal * 5;
    const breath = Math.sin(t * pantRate) * (0.012 + (1 - d.stamina) * 0.02 + L * 0.01);
    const bounce = gal * Math.abs(Math.sin(ph + 0.1)) * 0.07 + trot * Math.abs(Math.sin(ph * 2)) * 0.012 + walk * 0.006 * Math.sin(ph * 2);
    const lower = C * 0.14 + L * 0.3;
    const spine = gal * Math.sin(ph + 0.25) * 0.2;
    ds.spine += (spine - ds.spine) * Math.min(1, 16 * dt);
    ds.roll += (clamp(-d.turn * ds.vs * 0.035, -0.22, 0.22) - ds.roll) * Math.min(1, 8 * dt);
    D.position.set(X, y0 + bounce - lower - Math.max(0, -pitch) * 0.1, Z);
    ea.set(pitch + ds.spine * 0.4, ds.yaw, ds.roll, 'YXZ'); D.quaternion.setFromEuler(ea);
    body.rotation.x = -ds.spine * 0.5 - C * 0.05; body.scale.set(1 + breath * 0.5, 1 + breath, 1);
    // the head: stare at the flock; low in the stalk, up when lying and when standing guard
    const toF = Math.atan2(-flock.x - X, flock.z - Z);
    const dyaw = clamp(wrap(toF - ds.yaw), -1.0, 1.0) * (1 - gal * 0.85);
    ds.hyaw += (dyaw - ds.hyaw) * Math.min(1, 7 * dt);
    const hp = lerp(lerp(-0.1, 0.25, gal), 0.55, C) - L * 0.12 + 0.12 * walk;
    ds.head += (hp - ds.head) * Math.min(1, 6 * dt);
    neck.rotation.set(ds.head * 0.6 + 0.3 * C, ds.hyaw * 0.5, 0); head.rotation.set(ds.head * 0.5 - 0.1 * C, ds.hyaw * 0.6, 0);
    const ear = gal > 0.4 ? -0.7 : C > 0.3 ? -0.3 : 0.15 + 0.1 * Math.sin(t * 0.8);
    ds.ear += (ear - ds.ear) * Math.min(1, 8 * dt);
    earL.rotation.set(ds.ear, 0, -0.55 - gal * 0.4); earR.rotation.set(ds.ear, 0, 0.55 + gal * 0.4);
    // panting
    const hot = (1 - d.stamina) > 0.25 || gal > 0.2 || L > 0.5 || trot > 0.5;
    tongue.visible = hot; tongue.rotation.x = 0.35 + 0.15 * Math.sin(t * pantRate * 1.6); tongue.scale.set(1, 1, 0.8 + 0.4 * Math.abs(Math.sin(t * pantRate)));
    // the tail: low and swaying when standing, out behind when running, tucked low in the stalk
    const tup = gal * 0.15 - C * 0.35 - L * 0.5 + 0.1 * Math.sin(t * 2.2) * (1 - gal);
    ds.tailY += (tup - ds.tailY) * Math.min(1, 6 * dt);
    const sway = Math.sin(t * (2 + gal * 8) + ph * gal) * (0.12 + 0.2 * (d.cmd === 'stand' ? 1 : 0.4)) * (1 - L * 0.7);
    tail.forEach((g, i) => { g.rotation.set(0.45 - ds.tailY * (i === 0 ? 1.4 : 0.5) + (i === 0 ? 0.3 : 0.25 * (1 - gal)), sway * (0.5 + i * 0.3), 0); });
    // the shadow centre of the dog is the caller's
  }
  const dogDispose = () => { root.remove(D); D.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); };
  // a ring on the ground under the dog so it can be found from far away
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5, fog: false }));
  ring.rotation.x = -Math.PI / 2; root.add(ring);
  const setRing = (x, y, z, scale, op) => { ring.position.set(x, y + 0.08, z); ring.scale.setScalar(scale); ring.material.opacity = op; };

  return { updateFlock, updateDog, dog: D, setRing, dispose() { flockDispose(); dogDispose(); root.remove(ring); }, sheepStates: st };
}
