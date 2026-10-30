// The sewer's hand: a real-proportioned right hand and forearm (view3d/handmesh.js, one smooth surface modelled and meshed in this game)
// pinching the needle between the thumb pad and the index pad, white and red bangles resting on the wrist, a cotton blouse sleeve with a
// red-and-gold border and the hanging sari end. Presenter-only: it follows the needle it is given.
// How the hand holds the needle: the needle may pivot between the two pads (as a real pinch allows) but never slides out of them, so the
// hand's pinch axis is kept square to the needle and the pinch point sits exactly on it. The hand turns about the pinch axis to keep
// the curled fingers just clear of the cloth. Orientation is smoothed (critically damped), so the hand never pops.
import * as THREE from '../vendor3d/three.js';
import { buildHandGeometry, skinMaterial, nailMaterial } from './handmesh.js';
import { mk, hash, texOf } from './tex.js';

const T = THREE;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function sleeveCanvas() {
  const c = mk(256), g = c.getContext('2d');
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) { g.fillStyle = `rgba(90,60,30,${0.03 + hash(y, 4) * 0.04})`; g.fillRect(0, y, 256, 1); }
  for (let x = 0; x < 256; x += 3) { g.fillStyle = `rgba(90,60,30,${0.03 + hash(x, 5) * 0.04})`; g.fillRect(x, 0, 1, 256); }
  const bands = [[0.08, 0.1, '#a8231f'], [0.2, 0.025, '#c9962f'], [0.24, 0.012, '#c9962f'], [0.78, 0.1, '#a8231f'], [0.9, 0.025, '#c9962f']];
  for (const [at, w, col] of bands) { g.fillStyle = col; g.fillRect(at * 256, 0, w * 256, 256); }
  g.fillStyle = 'rgba(168,35,31,0.55)';
  for (let y = 12; y < 256; y += 32) for (let x = 0.4 * 256; x < 0.7 * 256; x += 32) { g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 5, y); g.lineTo(x, y + 7); g.lineTo(x - 5, y); g.closePath(); g.fill(); }
  return c;
}

export async function createNeedleHand(scene, { skin = '#8c5b40', voxel = 0.17 } = {}) {
  const H = await buildHandGeometry({ skin, voxel });
  const root = new T.Group();
  const clipGround = new T.Plane(new T.Vector3(0, 1, 0), 0.03);
  const skinMat = skinMaterial(); skinMat.clippingPlanes = [clipGround];
  const mesh = new T.Mesh(H.geometry, skinMat);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  const nailMat = nailMaterial(); nailMat.clippingPlanes = [clipGround];
  const nails = new T.Mesh(H.nailGeometry, nailMat); nails.castShadow = false; nails.receiveShadow = true; nails.frustumCulled = false;
  root.add(mesh, nails); root.visible = false; scene.add(root);

  // ---- blouse sleeve: a tube from partway up the forearm
  const tex = texOf(sleeveCanvas(), { repeat: [1, 1], aniso: 4 });
  const sleeveMat = new T.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, side: T.DoubleSide, vertexColors: true, transparent: true, depthWrite: true, clippingPlanes: [clipGround] });
  const tubeGeo = new T.CylinderGeometry(0.058, 0.045, 0.34, 28, 3, true);
  { const p = tubeGeo.attributes.position, c = new Float32Array(p.count * 4); c.fill(1); tubeGeo.setAttribute('color', new T.BufferAttribute(c, 4)); }
  const tube = new T.Mesh(tubeGeo, sleeveMat);
  tube.frustumCulled = false; tube.castShadow = true; scene.add(tube); tube.visible = false;
  // the hanging sari end that sways with the hand (lags behind the hand's motion)
  const NX = 12, NY = 7;
  const dg = new T.BufferGeometry();
  const dpos = new Float32Array(NX * NY * 3), duv = new Float32Array(NX * NY * 2), didx = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const n = j * NX + i; duv[n * 2] = i / (NX - 1); duv[n * 2 + 1] = j / (NY - 1); }
  for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, b = a + NX; didx.push(a, b, a + 1, a + 1, b, b + 1); }
  const dattr = new T.BufferAttribute(dpos, 3); dattr.setUsage(35048);
  dg.setAttribute('position', dattr); dg.setAttribute('uv', new T.BufferAttribute(duv, 2)); dg.setIndex(didx);
  const dcol = new Float32Array(NX * NY * 4);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const n = j * NX + i; dcol[n * 4] = dcol[n * 4 + 1] = dcol[n * 4 + 2] = 1; dcol[n * 4 + 3] = 1 - sstep(0.1, 0.7, i / (NX - 1)); }
  dg.setAttribute('color', new T.BufferAttribute(dcol, 4));
  const drape = new T.Mesh(dg, sleeveMat); drape.frustumCulled = false; drape.castShadow = true; scene.add(drape); drape.visible = false;

  // ---- bangles: white conch (shankha) and red (pola) pairs and a thin gold one, loose on the wrist: each hangs from the top of the arm
  // under gravity, sits where the arm is still narrower than its opening, and slides a little with the wrist's motion.
  const BANG = [
    { col: 0xf4efe4, R: 0.0322, r: 0.0036, rough: 0.34, metal: 0.02 },
    { col: 0xb3241f, R: 0.0318, r: 0.0031, rough: 0.3, metal: 0.04 },
    { col: 0xf4efe4, R: 0.0322, r: 0.0036, rough: 0.34, metal: 0.02 },
    { col: 0xb3241f, R: 0.0318, r: 0.0031, rough: 0.3, metal: 0.04 },
    { col: 0xd4a640, R: 0.031, r: 0.0016, rough: 0.28, metal: 0.95 },
  ];
  const bangles = BANG.map((b) => {
    const m = new T.Mesh(new T.TorusGeometry(b.R, b.r, 12, 40), new T.MeshStandardMaterial({ color: b.col, roughness: b.rough, metalness: b.metal, envMapIntensity: 0.9 }));
    m.castShadow = true; m.receiveShadow = true; m.visible = false; m.frustumCulled = false; scene.add(m); return m;
  });
  // rest positions up the arm (m from the wrist centre) in a loose stack; a small fixed tilt per ring so they do not look machined
  let at = 0.02;
  const bPos = BANG.map((b, i) => { const s = at + b.r; at += b.r * 2 + 0.0005; return { s0: s, s, v: 0, tilt: (hash(i, 7) - 0.5) * 0.12 }; });

  // ---- placement state
  const P = H.pinch, FA = H.forearm;
  const qHand = new T.Quaternion(), qWant = new T.Quaternion(), qTmp = new T.Quaternion(), qTry = new T.Quaternion(), mBasis = new T.Matrix4();
  const up = new T.Vector3(0, 1, 0), down = new T.Vector3(0, -1, 0), zAxis = new T.Vector3(0, 0, 1);
  const F = new T.Vector3(), N = new T.Vector3(), Yd = new T.Vector3(), Zd = new T.Vector3(), side = new T.Vector3();
  const aW = new T.Vector3(), aP = new T.Vector3(), nW = new T.Vector3(), wrist = new T.Vector3(), tmp = new T.Vector3(), tmp2 = new T.Vector3(), g = new T.Vector3();
  const armAxis = new T.Vector3(), armY = new T.Vector3(), armZ = new T.Vector3(), lastWrist = new T.Vector3(), vel = new T.Vector3(), sway = new T.Vector3(), sideV = new T.Vector3();
  let shown = 0, swayAmt = 0, firstFrame = true, roll = 0;
  const state = { wrist: new T.Vector3(), elbow: new T.Vector3(), index: new T.Vector3(), thumb: new T.Vector3(), roll: 0 };
  const tune = { palmDown: 0.62, pitch: -0.08, lift: 0.0095 };

  // the hand orientation that holds a needle along nW at the pinch, with the forearm coming from direction d (toward the player)
  function orient(d, needleDir, out) {
    F.copy(d).multiplyScalar(-1); F.y = 0; F.normalize(); F.y = tune.pitch; F.normalize();
    side.crossVectors(up, F).normalize();                       // to the left of the fingers (the thumb side of a right hand)
    N.copy(down).multiplyScalar(tune.palmDown).addScaledVector(side, 1 - tune.palmDown).normalize();   // palm faces down and a little inward
    Yd.copy(N).multiplyScalar(-1).addScaledVector(F, N.dot(F)).normalize();                           // back of the hand
    Zd.crossVectors(F, Yd).normalize();
    mBasis.makeBasis(F, Yd, Zd); out.setFromRotationMatrix(mBasis);
    // the needle pivots between the pads: turn the hand the least amount that puts its pinch axis square to the needle
    nW.copy(needleDir).normalize();
    aW.copy(P.axis).applyQuaternion(out);
    aP.copy(aW).addScaledVector(nW, -aW.dot(nW)).normalize();
    qTmp.setFromUnitVectors(aW, aP); out.premultiply(qTmp);
    return out;
  }
  // height of the lowest finger tip / knuckle above the cloth with the hand turned by r about the pinch axis
  function clearance(r, grip, floorY) {
    qTry.setFromAxisAngle(aW, r).multiply(qWant);
    let lo = Infinity;
    for (const p of H.probes) { tmp.copy(p).sub(P.point).applyQuaternion(qTry); lo = Math.min(lo, tmp.y + grip.y - floorY); }
    return lo;
  }

  const api = {
    root, mesh, state, tune, stats: H.stats,
    // grip: the pinch point on the needle; d: horizontal unit vector from the grip toward the player's body; needleDir: tip -> eye
    update(grip, d, want, dt, wiggle = 0, needleDir = null, floorY = 0) {
      shown = Math.max(0, Math.min(1, shown + (want ? 1 : -1) * dt * 3.2));
      const vis = shown > 0.01;
      root.visible = tube.visible = drape.visible = vis;
      for (const b of bangles) b.visible = vis;
      if (!vis) { firstFrame = true; return; }
      const e = shown * shown * (3 - 2 * shown);
      const nd = needleDir || tmp2.set(d.x, 0.6, d.z).normalize();
      orient(d, nd, qWant);
      // keep the curled fingers off the cloth by turning about the pinch axis (the needle stays in the pinch); a local search from
      // last frame's turn, then eased, so it is continuous
      aW.copy(P.axis).applyQuaternion(qWant);
      const cost = (r) => Math.max(0, tune.lift - clearance(r, grip, floorY)) * 60 + Math.abs(r) * 0.01;
      let best = firstFrame ? 0 : roll, bc = cost(best);
      for (let s = 0.32; s > 0.003; s *= 0.5) for (const c of [best + s, best - s]) { const v = cost(c); if (v < bc) { bc = v; best = c; } }
      roll = firstFrame ? best : roll + (best - roll) * (1 - Math.exp(-dt * 10));
      state.roll = roll;
      qTmp.setFromAxisAngle(aW, roll + wiggle * 0.03); qWant.premultiply(qTmp);
      // critically damped turn toward the wanted orientation
      if (firstFrame) qHand.copy(qWant); else qHand.slerp(qWant, 1 - Math.exp(-dt * 9));
      // the pinch point sits on the needle at the grip; the hand arrives from the player's side
      wrist.copy(P.point).applyQuaternion(qHand).multiplyScalar(-1).add(grip);
      wrist.addScaledVector(d, (1 - e) * 0.2); wrist.y += (1 - e) * 0.05;
      root.position.copy(wrist); root.quaternion.copy(qHand); root.updateMatrixWorld(true);
      state.wrist.copy(wrist);
      state.index.copy(P.index).applyMatrix4(root.matrixWorld); state.thumb.copy(P.thumb).applyMatrix4(root.matrixWorld);
      armAxis.copy(FA.axis).applyQuaternion(qHand); armY.copy(FA.y).applyQuaternion(qHand); armZ.copy(FA.z).applyQuaternion(qHand);
      state.elbow.copy(wrist).addScaledVector(armAxis, 0.26);
      // bangles: hang from the top of the arm, slide along it with a damped lag behind the wrist's motion
      vel.copy(wrist).sub(lastWrist).multiplyScalar(1 / Math.max(dt, 1e-3)); if (firstFrame) vel.set(0, 0, 0); lastWrist.copy(wrist); firstFrame = false;
      sway.lerp(vel, 1 - Math.exp(-dt * 7));
      swayAmt += (Math.min(1, sway.length() * 2.2) - swayAmt) * Math.min(1, dt * 6);
      const along = sway.dot(armAxis);
      g.copy(down).addScaledVector(armAxis, -down.dot(armAxis));
      const gl = g.length(); if (gl > 1e-4) g.multiplyScalar(1 / gl); else g.copy(armY).multiplyScalar(-1);
      const gy = g.dot(armY), gz = g.dot(armZ);
      bangles.forEach((b, i) => {
        const p = bPos[i], tgt = p.s0 + Math.max(-0.004, Math.min(0.006, -along * 0.012)) * (1 + i * 0.15);
        p.v += ((tgt - p.s) * 260 - p.v * 22) * dt; p.s += p.v * dt;
        const ar = H.armRadii(p.s), inner = BANG[i].R - BANG[i].r;
        // the arm's extent against gravity (support of its oval cross-section): the ring rests on it and hangs below
        const hgt = Math.hypot(ar.ry * gy, ar.rz * gz) - ar.yo * gy;
        const drop = Math.max(0, inner - hgt);
        b.position.copy(wrist).addScaledVector(armAxis, p.s).addScaledVector(g, drop);
        b.quaternion.setFromUnitVectors(zAxis, armAxis);
        qTmp.setFromAxisAngle(sideV.crossVectors(armAxis, g).normalize(), p.tilt); b.quaternion.premultiply(qTmp);
      });
      // blouse sleeve: starts about 12 cm up the forearm
      tube.position.copy(wrist).addScaledVector(armAxis, 0.12 + 0.17); tube.quaternion.setFromUnitVectors(up, armAxis);
      // drape: the hanging sari end, lagging behind
      const t0 = 0.12, t1 = 0.4, hang = 0.12;
      sideV.crossVectors(armAxis, down).normalize();
      const time = performance.now() * 0.001;
      for (let j = 0; j < NY; j++) {
        const v = j / (NY - 1);
        for (let i = 0; i < NX; i++) {
          const u = i / (NX - 1), a = t0 + (t1 - t0) * u + swayAmt * v * 0.05;
          const h = hang * v * (1 - 0.35 * Math.pow(u, 3)) * (0.7 + 0.3 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05)));
          const wob = Math.sin(time * 2.1 + u * 4 + v * 2) * 0.004 * v, o = (j * NX + i) * 3, off = 0.055 + 0.02 * v + wob;
          dpos[o] = wrist.x + armAxis.x * a + down.x * h + sideV.x * off - sway.x * 0.03 * v;
          dpos[o + 1] = wrist.y + armAxis.y * a + down.y * h + sideV.y * off - sway.y * 0.02 * v;
          dpos[o + 2] = wrist.z + armAxis.z * a + down.z * h + sideV.z * off - sway.z * 0.03 * v;
        }
      }
      dattr.needsUpdate = true; dg.computeVertexNormals();
    },
    get shown() { return shown; },
    setShadow(on) { mesh.castShadow = on; tube.castShadow = on; drape.castShadow = on; for (const b of bangles) b.castShadow = on; },
    dispose() { scene.remove(root, tube, drape, ...bangles); H.geometry.dispose(); H.nailGeometry.dispose(); },
  };
  return api;
}
