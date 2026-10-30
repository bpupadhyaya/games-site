// Procedural lit camels (Bactrian: two humps and a shaggy winter coat; dromedary: one hump, short coat), their loads and the nose rope.
// Gait: camels PACE (both legs on one side swing together), so the body rolls toward the stance side; the stride phase is driven by the
// distance walked (no foot slide: swing amplitude = stride / (2 pi leg length)). Everything is deterministic and driven by the dt handed in.
import { THREE } from '../vendor3d/index.js';
import { furTexture, clothTexture } from './tex.js';

const TAU = Math.PI * 2;
const COATS = { bactrian: ['#9a6a3c', '#5c3b1e', '#c49562'], dromedary: ['#c39a68', '#7d5a36', '#e2c08e'], dark: ['#7a5232', '#43291a', '#a37a52'], pale: ['#c8a878', '#8a6a44', '#e8d2a8'] };
export const GOOD_COL = { silk: ['#b8284e', '#f0c040'], paper: ['#e9dcb8', '#9a7a4a'], spice: ['#b6582a', '#e2a640'], glass: ['#2f8a9a', '#d8f0f0'], horse: ['#6a4a30', '#c8a060'], jade: ['#3f8a5e', '#cfe8c0'], supplies: ['#8a6a3a', '#5a4024'] };

const mats = new Map();
function mat(key, make) { let m = mats.get(key); if (!m) { m = make(); mats.set(key, m); } return m; }
const furMat = (col, kind) => mat('fur' + col + kind, () => new THREE.MeshStandardMaterial({ color: col, map: furTexture(kind === 'bactrian' ? 1 : 0), roughness: 0.97, metalness: 0 }));
const plain = (col, rough = 0.85, metal = 0) => mat('p' + col + rough + metal, () => new THREE.MeshStandardMaterial({ color: col, roughness: rough, metalness: metal }));
const cloth = (a, b, kind) => mat('c' + a + b + kind, () => new THREE.MeshStandardMaterial({ color: '#ffffff', map: clothTexture(a, b, kind), roughness: 0.78 }));

const SPH = new THREE.SphereGeometry(1, 28, 20), SPH_LO = new THREE.SphereGeometry(1, 14, 10);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14, 1), CAPS = new THREE.CapsuleGeometry(1, 1, 6, 12);
function blob(m, x, y, z, sx, sy, sz, lo) { const o = new THREE.Mesh(lo ? SPH_LO : SPH, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; o.receiveShadow = true; return o; }
// a tapered limb segment from the joint downwards (length L, radius r0 at the top, r1 at the bottom)
function segment(m, L, r0, r1) { const g = new THREE.CylinderGeometry(r1, r0, L, 12, 1); g.translate(0, -L / 2, 0); const o = new THREE.Mesh(g, m); o.castShadow = true; return o; }


// Loft: elliptical rings (ry vertical, rz sideways) along a smooth curve through key points [x, y, ry, rz]; closed ends.
function loft(m, keys, segs = 40, ring = 18) {
  const curve = new THREE.CatmullRomCurve3(keys.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const pos = [], idx = [], T = new THREE.Vector3(), P = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs; curve.getPoint(u, P); curve.getTangent(u, T);
    const f = u * (keys.length - 1), k = Math.min(keys.length - 2, Math.floor(f)), w = f - k, ss = w * w * (3 - 2 * w);
    const ry = keys[k][2] + (keys[k + 1][2] - keys[k][2]) * ss, rz = keys[k][3] + (keys[k + 1][3] - keys[k][3]) * ss;
    const nx = -T.y, ny = T.x;
    for (let j = 0; j < ring; j++) { const a = (j / ring) * Math.PI * 2; pos.push(P.x + nx * Math.cos(a) * ry, P.y + ny * Math.cos(a) * ry, Math.sin(a) * rz); }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < ring; j++) { const a = i * ring + j, b = i * ring + (j + 1) % ring, c = a + ring, d = b + ring; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = []; for (let i = 0; i <= segs; i++) for (let j = 0; j < ring; j++) uv.push(i / segs * 3, j / ring); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o;
}
function lathe(m, prof) { const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)).reverse(), 20); const o = new THREE.Mesh(g, m); o.castShadow = true; return o; }

// Build one camel. Local frame: +X forward, +Y up, origin on the ground under the body.
export function makeCamel({ kind = 'bactrian', coat, loads = [], seed = 0, rider = false } = {}) {
  const C = COATS[coat ?? kind] ?? COATS.bactrian, two = kind === 'bactrian';
  const body = furMat(C[0], kind), dark = furMat(C[1], kind), pale = furMat(C[2], kind);
  const root = new THREE.Group(), torso = new THREE.Group(); root.add(torso);
  const shoulderY = two ? 1.62 : 1.72;
  const cy = shoulderY - 0.1;
  // one smooth lofted barrel from the rump to the chest (elliptical sections along a spine curve)
  torso.add(loft(body, [[-1.12, cy - 0.02, 0.04, 0.04], [-1.06, cy, 0.3, 0.26], [-0.82, cy + 0.04, 0.46, 0.36], [-0.3, cy + 0.04, 0.5, 0.4], [0.3, cy + 0.02, 0.52, 0.41], [0.72, cy - 0.02, 0.48, 0.38], [0.98, cy - 0.12, 0.34, 0.28], [1.08, cy - 0.2, 0.2, 0.18]]));
  // humps: soft domes rising out of the back, Bactrian with darker winter fur on top
  const hump = (x, h, w) => { const g = new THREE.LatheGeometry([[0, 0], [w, 0], [w * 0.95, h * 0.3], [w * 0.78, h * 0.62], [w * 0.55, h * 0.84], [w * 0.3, h * 0.96], [0, h]].map(([r, y]) => new THREE.Vector2(r, y)), 32); g.scale(1, 1, 0.78); const m = new THREE.Mesh(g, body); m.position.set(x, cy + 0.2, 0); m.castShadow = true; torso.add(m); return m; };
  if (two) { hump(0.45, 0.6, 0.34); hump(-0.42, 0.54, 0.34); }
  else hump(0.02, 0.72, 0.5);
  // neck + head: a second loft that dips forward from the chest and rises in the camel's U-curve to the head and muzzle
  const neck = new THREE.Group(); neck.position.set(0.9, cy - 0.05, 0); torso.add(neck);
  neck.add(loft(two ? dark : body, [[-0.05, 0.08, 0.3, 0.24], [0.2, -0.08, 0.26, 0.2], [0.45, -0.2, 0.2, 0.15], [0.68, -0.12, 0.16, 0.12], [0.84, 0.15, 0.14, 0.11], [0.92, 0.48, 0.13, 0.1], [0.98, 0.64, 0.14, 0.12], [1.12, 0.66, 0.13, 0.115], [1.3, 0.6, 0.1, 0.095], [1.42, 0.56, 0.085, 0.08], [1.47, 0.55, 0.02, 0.02]], 28, 16));
  if (two) neck.add(blob(dark, 0.42, -0.38, 0, 0.28, 0.14, 0.12, true));            // throat beard
  const head = new THREE.Group(); head.position.set(0.97, 0.62, 0); neck.add(head);
  head.add(blob(pale, 0.42, -0.08, 0, 0.09, 0.05, 0.075, true));                    // soft lips
  for (const s of [-1, 1]) {
    head.add(blob(plain('#140c08', 0.3), 0.16, 0.08, s * 0.105, 0.028, 0.024, 0.016, true));                    // eyes
    head.add(blob(dark, 0.16, 0.115, s * 0.1, 0.05, 0.016, 0.03, true));                                         // heavy brows
    head.add(blob(dark, -0.02, 0.14, s * 0.09, 0.03, 0.055, 0.02, true));                                        // ears
    head.add(blob(plain('#2a1a10', 0.6), 0.44, 0.0, s * 0.045, 0.02, 0.008, 0.012, true));                       // slit nostrils
  }
  if (two) head.add(blob(dark, 0.0, 0.14, 0, 0.12, 0.06, 0.1, true));               // forelock tuft
  // bell under the throat
  const bell = new THREE.Group(); bell.position.set(0.45, -0.36, 0); neck.add(bell);
  const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, 0.14, 12, 1, true), plain('#b88a3a', 0.35, 0.9)); bm.position.y = -0.1; bm.castShadow = true; bell.add(bm);
  // tail
  const tail = new THREE.Group(); tail.position.set(-1.05, cy + 0.12, 0); torso.add(tail);
  tail.add(segment(body, 0.5, 0.05, 0.03)); tail.add(blob(dark, 0, -0.56, 0, 0.045, 0.12, 0.045, true)); tail.rotation.z = -0.2;
  // legs: muscled upper leg (lathe) blending into the body, knobbly knee, slim cannon, broad two-toed soft pad
  const legs = [], L0 = shoulderY - 0.2, U = 0.74, LO = L0 - U - 0.05;
  for (const [fx, side] of [[0.66, 1], [0.66, -1], [-0.66, 1], [-0.66, -1]]) {
    const front = fx > 0, hip = new THREE.Group(); hip.position.set(fx, L0, side * 0.16); root.add(hip);
    const rTop = front ? 0.17 : 0.24, up = lathe(body, [[0, 0.18], [rTop * 0.55, 0.14], [rTop * 0.95, -0.05], [rTop * 0.8, -0.27], [0.1, -0.52], [0.075, -0.68], [0.08, -U], [0, -U - 0.02]]); hip.add(up);
    const knee = new THREE.Group(); knee.position.y = -U; hip.add(knee);
    knee.add(blob(body, 0, 0, 0, 0.085, 0.08, 0.08, true));
    knee.add(lathe(body, [[0, 0], [0.065, -0.02], [0.05, -LO * 0.5], [0.055, -LO * 0.9], [0.07, -LO], [0, -LO - 0.01]]));
    const foot = blob(dark, 0.05, -LO + 0.01, 0, 0.14, 0.045, 0.11, true); knee.add(foot);
    legs.push({ hip, knee, front, side, L: L0 });
  }
  // loads: a saddle frame between/over the humps, two side bales and a top roll; water skins on the supply camel
  const pack = new THREE.Group(); pack.position.set(0, shoulderY + (two ? 0.4 : 0.72), 0); torso.add(pack);
  const goods = loads.length ? loads : [];
  if (goods.length) {
    pack.add(blob(cloth('#7a2a1e', '#e0b050', 'rug'), 0, -0.12, 0, rider ? 0.35 : 0.62, 0.06, 0.48, true));               // saddle rug
    goods.slice(0, 2).forEach((g, i) => {
      const [a, b] = GOOD_COL[g] ?? GOOD_COL.supplies, s = i === 0 ? 1 : -1;
      const kindT = g === 'silk' ? 'silk' : g === 'spice' ? 'sack' : g === 'glass' || g === 'jade' ? 'crate' : g === 'paper' ? 'bundle' : 'sack';
      const bale = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.3, 2, 2, 2), cloth(a, b, kindT)); bale.position.set(0, -0.22, s * 0.52); bale.castShadow = true; pack.add(bale);
      const rope = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.52, 0.32), plain('#3a2814')); rope.position.copy(bale.position); pack.add(rope.clone()); rope.position.x += 0.18; pack.add(rope);
    });
if (!rider) {     const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.9, 16), cloth(...(GOOD_COL[goods[0]] ?? GOOD_COL.silk), 'silk')); roll.rotation.x = Math.PI / 2; roll.position.set(two ? 0 : -0.1, 0.12, 0); roll.castShadow = true; pack.add(roll); }
    const skin = plain('#4a2c18', 0.55); for (const s of [-1, 1]) { const w = blob(skin, -0.4, -0.35, s * 0.42, 0.14, 0.2, 0.1, true); pack.add(w); }   // water skins
  }
  if (rider) { const R = makeRobedRider(); R.position.set(two ? 0.05 : -0.42, shoulderY + (two ? 0.42 : 0.5), 0); torso.add(R); }
  const camel = { root, torso, neck, head, tail, bell, legs, two, shoulderY, dist: seed * 0.37, phase: seed * 1.1, couch: 0, idleT: seed * 1.7 };
  return camel;
}

// Advance a camel: v = ground speed (m/s), dt from the game clock. couch 0..1 folds it down to rest (kneeling camel).
export function poseCamel(c, dt, v, couch = 0) {
  const stride = 2.3;                                   // metres per full pace cycle
  c.dist += v * dt; c.idleT += dt;
  c.couch += (couch - c.couch) * Math.min(1, dt * 2.5);
  const p = (c.dist / stride) * TAU, walk = Math.min(1, v / 0.6);
  const k = c.couch;
  for (const L of c.legs) {
    const ph = p + (L.side > 0 ? 0 : Math.PI);          // pace: same side together
    const A = (stride / 2) / (TAU * L.L) * 2.2 * walk;  // swing amplitude matched to stride (no foot slide in stance)
    const s = Math.sin(ph), lift = Math.max(0, Math.cos(ph)) * walk;
    let hip = -A * s, knee = -0.6 * lift;
    // couched: fore legs fold under (knee down), hind legs fold forward
    hip = hip * (1 - k) + 1.5 * k; knee = knee * (1 - k) - 2.95 * k;
    L.hip.rotation.z = hip; L.knee.rotation.z = knee;
  }
  const roll = 0.05 * Math.sin(p) * walk, bob = 0.035 * Math.abs(Math.cos(p)) * walk;
  c.torso.rotation.x = roll; c.torso.position.y = bob - k * (c.shoulderY - 0.6);
  for (const L of c.legs) L.hip.position.y = c.shoulderY - 0.2 + bob - k * (c.shoulderY - 0.6);
  // neck and head: forward nod twice per cycle when walking; slow browse/chew and look around when standing
  const idle = 1 - walk, it = c.idleT;
  c.neck.rotation.z = 0.06 * Math.sin(2 * p) * walk + idle * (0.08 * Math.sin(it * 0.45) - 0.04) - k * 0.12;
  c.neck.rotation.y = idle * 0.18 * Math.sin(it * 0.23 + c.phase);
  c.head.rotation.z = -0.05 * Math.sin(2 * p + 0.6) * walk + idle * 0.05 * Math.sin(it * 2.1);
  c.tail.rotation.x = 0.15 * Math.sin(p) * walk + idle * 0.25 * Math.max(0, Math.sin(it * 0.9 + c.phase)) ** 6;
  c.bell.rotation.x = 0.35 * Math.sin(p + 0.8) * walk + idle * 0.04 * Math.sin(it * 1.3); c.bell.rotation.z = 0.2 * Math.sin(2 * p) * walk;
}

// Nose rope: a sagging chain from each camel's muzzle back to the pack of the camel ahead. Instanced short cylinders (no per-frame allocations).
export function makeRopes(maxCamels) {
  const SEG = 10, g = new THREE.CylinderGeometry(0.012, 0.012, 1, 5); g.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#3a2a18', roughness: 0.9 }), maxCamels * SEG); mesh.count = 0; mesh.frustumCulled = false;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), d = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), m = new THREE.Matrix4(), sc = new THREE.Vector3();
  const muzzle = new THREE.Vector3(0.45, -0.08, 0), back = new THREE.Vector3(-0.95, 0.1, 0);
  return {
    mesh,
    update(camels) {
      let n = 0;
      for (let i = 1; i < camels.length; i++) {
        camels[i].head.updateWorldMatrix(true, false); camels[i - 1].torso.updateWorldMatrix(true, false);
        a.copy(muzzle).applyMatrix4(camels[i].head.matrixWorld); b.set(back.x, camels[i - 1].shoulderY + back.y, 0).applyMatrix4(camels[i - 1].torso.matrixWorld);
        const sag = 0.35 + 0.1 * Math.sin(camels[i].dist * 2.7);
        for (let s = 0; s < SEG; s++) {
          const t0 = s / SEG, t1 = (s + 1) / SEG;
          p0.lerpVectors(a, b, t0); p0.y -= sag * 4 * t0 * (1 - t0); p1.lerpVectors(a, b, t1); p1.y -= sag * 4 * t1 * (1 - t1);
          d.subVectors(p1, p0); const len = d.length(); q.setFromUnitVectors(up, d.normalize()); m.compose(p0, q, sc.set(1, len, 1)); mesh.setMatrixAt(n++, m);
        }
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// A robed rider seen at caravan distance: cloak over the legs, sash, sleeves resting forward, head wrap. No exposed limbs.
export function makeRobedRider(robeA = '#3d4f7a', robeB = '#c9a24a') {
  const R = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.LatheGeometry([[0.0, 0.0], [0.3, 0.0], [0.34, 0.12], [0.26, 0.5], [0.2, 0.68], [0.12, 0.74], [0, 0.75]].map(([r, y]) => new THREE.Vector2(r, y)), 16), cloth(robeA, robeB, 'robe'));
  robe.scale.set(0.9, 1, 1.15); robe.castShadow = true; R.add(robe);
  R.add(blob(plain('#8a4a2a'), 0, 0.42, 0, 0.21, 0.04, 0.27, true));
  R.add(blob(plain('#b98a66', 0.6), 0.02, 0.86, 0, 0.1, 0.12, 0.1, true));
  R.add(blob(cloth('#efe6d2', '#c9b48a', 'wrap'), -0.01, 0.94, 0, 0.13, 0.1, 0.13, true));
  for (const s of [-1, 1]) R.add(blob(cloth(robeA, robeB, 'robe'), 0.12, 0.5, s * 0.2, 0.08, 0.17, 0.08, true));
  return R;
}
