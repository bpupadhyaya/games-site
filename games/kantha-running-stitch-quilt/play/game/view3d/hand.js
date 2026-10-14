// The sewer's hand: a real hand and forearm (view3d athlete_f through the game-owned hand3d.js) with white and red bangles at the wrist
// and a cotton blouse sleeve with a red-and-gold border, pinching the needle. Presenter-only: it follows the grip point it is given.
// Order each frame: stage/human update (inside update) first, THEN the needle is placed from `grip` (the pinch point): the hand never
// resets after the props were posed.
import * as V3D from '../vendor3d/index.js';
import { createHand } from './hand3d.js';
import { mk, hash, texOf, TAU } from './tex.js';

const T = V3D.THREE;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function sleeveCanvas() {
  const c = mk(256), g = c.getContext('2d');
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) { g.fillStyle = `rgba(90,60,30,${0.03 + hash(y, 4) * 0.04})`; g.fillRect(0, y, 256, 1); }
  for (let x = 0; x < 256; x += 3) { g.fillStyle = `rgba(90,60,30,${0.03 + hash(x, 5) * 0.04})`; g.fillRect(x, 0, 1, 256); }
  // border bands across the sleeve (u runs along the arm)
  const bands = [[0.08, 0.1, '#a8231f'], [0.2, 0.025, '#c9962f'], [0.24, 0.012, '#c9962f'], [0.78, 0.1, '#a8231f'], [0.9, 0.025, '#c9962f']];
  for (const [at, w, col] of bands) { g.fillStyle = col; g.fillRect(at * 256, 0, w * 256, 256); }
  // a small repeating motif between the bands
  g.fillStyle = 'rgba(168,35,31,0.55)';
  for (let y = 12; y < 256; y += 32) for (let x = 0.4 * 256; x < 0.7 * 256; x += 32) { g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 5, y); g.lineTo(x, y + 7); g.lineTo(x - 5, y); g.closePath(); g.fill(); }
  return c;
}

export async function createNeedleHand(scene, { skin = '#8c5b40', character = 'athlete_f' } = {}) {
  const hand = await createHand(V3D, { side: 'R', skin, character, preset: 'pinch' });
  hand.human.setKit?.({ top: '#a8231f', trim: '#efe6d2' });
  const root = new T.Group();
  root.add(hand.object);
  scene.add(root);
  root.visible = false;
  const clip = new T.Plane(new T.Vector3(0, 0, 1), 0);
  const clipGround = new T.Plane(new T.Vector3(0, 1, 0), 0.03);   // nothing below the table
  const prep = () => hand.object.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) { if (!m.clippingPlanes || m.clippingPlanes[0] !== clip) { m.clippingPlanes = [clip, clipGround]; m.clipShadows = true; m.needsUpdate = true; } }
  });
  prep();
  // keep only the right forearm and hand: drop the head and every triangle that is not weighted to the forearm, hand or fingers
  hand.object.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (o.name === 'body_2') { o.visible = false; return; }
    const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, ix = g.index;
    if (!si || !sw || !ix) return;
    const names = o.skeleton.bones.map((b) => b.name), ok = names.map((n) => /_R_(Forearm|Hand|Finger)/.test(n));
    const keep = new Uint8Array(si.count);
    for (let v = 0; v < si.count; v++) {
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; best = si.getComponent(v, k); } }
      keep[v] = ok[best] ? 1 : 0;
    }
    const out = [];
    for (let t = 0; t < ix.count; t += 3) { const a = ix.getX(t), b = ix.getX(t + 1), c = ix.getX(t + 2); if (keep[a] && keep[b] && keep[c]) out.push(a, b, c); }
    if (out.length) g.setIndex(out);
  });

  // ---- blouse sleeve: a tube from partway up the forearm, fading in at the wrist side
  const tex = texOf(sleeveCanvas(), { repeat: [1, 1], aniso: 4 });
  const sleeveMat = new T.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, side: T.DoubleSide, vertexColors: true, transparent: true, depthWrite: true, clippingPlanes: [clipGround] });
  const tubeGeo = new T.CylinderGeometry(0.06, 0.047, 0.34, 24, 3, true);
  { const p = tubeGeo.attributes.position, c = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) { const d = p.getY(i) + 0.15; c[i * 4] = c[i * 4 + 1] = c[i * 4 + 2] = 1; c[i * 4 + 3] = 1; }
    tubeGeo.setAttribute('color', new T.BufferAttribute(c, 4)); }
  const tube = new T.Mesh(tubeGeo, sleeveMat);
  tube.frustumCulled = false; tube.castShadow = true; scene.add(tube); tube.visible = false;
  // a hanging drape of the sari end that sways with the hand (kept from the kimono sleeve: lags behind the hand's motion)
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

  // ---- bangles: two white, two red, a thin gold one, sliding a little with the wrist
  const bangleMats = [0xf3eee2, 0xb3241f, 0xf3eee2, 0xb3241f, 0xd4a640].map((col, i) => new T.MeshStandardMaterial({ color: col, roughness: i === 4 ? 0.3 : 0.38, metalness: i === 4 ? 0.9 : 0.05, envMapIntensity: 0.9 }));
  const bangles = bangleMats.map((m, i) => {
    const b = new T.Mesh(new T.TorusGeometry(0.0305 + (i === 4 ? 0 : 0.0006), i === 4 ? 0.0016 : 0.0034, 10, 32), m);
    b.castShadow = true; b.visible = false; b.frustumCulled = false; scene.add(b); return b;
  });
  const bPos = bangles.map((_, i) => ({ s: 0.034 + i * 0.0105, v: 0 }));

  const wrist = new T.Vector3(), elbow = new T.Vector3(), axis = new T.Vector3(), tmp = new T.Vector3(), sh = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  const right = new T.Vector3(), down = new T.Vector3(0, -1, 0), lastWrist = new T.Vector3(), vel = new T.Vector3(), sway = new T.Vector3(), zAxis = new T.Vector3(0, 0, 1);
  const fingers = new T.Vector3(), q = new T.Quaternion(), w3 = new T.Vector3(), sideV = new T.Vector3(), tmp2 = new T.Vector3();
  let off = null;
  const P3 = (n, o) => hand.human.bonePosition(n, o);
  // the pinch contact point (thumb tip pad vs the side of the index middle phalanx), as an offset from the wrist in the hand's own frame
  function calibrate(palm, fingers) {
    const o = new T.Vector3(0, 0.6, 0);
    hand.setPose({ thumb: api.tune.thumb, index: api.tune.index, middle: api.tune.middle, ring: api.tune.ring, pinky: api.tune.pinky, spread: api.tune.spread, thumbOut: api.tune.thumbOut });
    root.position.set(0, 0, 0); root.updateMatrixWorld(true);
    hand.place({ wrist: o, palmDir: palm, fingers, elbowHint: null });
    for (let i = 0; i < 3; i++) hand.update(0.05);
    const a = P3('R_Finger02', new T.Vector3()), b = P3('R_Finger01', new T.Vector3()), t = a.clone().addScaledVector(a.clone().sub(b).normalize(), 0.012);
    const i1 = P3('R_Finger11', new T.Vector3()), i2 = P3('R_Finger12', new T.Vector3());
    const ab = i2.clone().sub(i1), k = Math.max(0, Math.min(1, t.clone().sub(i1).dot(ab) / ab.lengthSq())), nearest = i1.clone().addScaledVector(ab, k);
    const c = t.clone().add(nearest).multiplyScalar(0.5);
    const w = P3('R_Hand', new T.Vector3());
    const qh = V3D.handQuat(hand.human, 'R', palm, fingers);
    return c.sub(w).applyQuaternion(qh.clone().invert());
  }
  let shown = 0, swayAmt = 0, firstFrame = true;
  const tune = { thumb: 0.4, index: 0.62, middle: 0.45, ring: 0.3, pinky: 0.35, spread: 0, thumbOut: 1, palmSide: 1, palmUp: 0.0, grip: 0.0 };
  const state = { wrist: new T.Vector3(), elbow: new T.Vector3(), index: new T.Vector3(), thumb: new T.Vector3() };

  const api = {
    root, hand, clip, state, tune,
    // grip: the pinch point (where the thumb and index meet on the needle); d: horizontal unit vector from the grip toward the player's body
    update(grip, d, want, dt, wiggle = 0) {
      shown = Math.max(0, Math.min(1, shown + (want ? 1 : -1) * dt * 3.2));
      const vis = shown > 0.01;
      root.visible = tube.visible = drape.visible = vis;
      for (const b of bangles) b.visible = vis;
      if (!vis) { firstFrame = true; return; }
      const e = shown * shown * (3 - 2 * shown);
      const P = api.tune;
      // fingers point away from the player and down toward the cloth; the palm faces sideways (thumb on top, as when holding a needle)
      fingers.copy(d).multiplyScalar(-1); fingers.y = -0.62; fingers.normalize();
      const palm = tmp.crossVectors(up, fingers).normalize().multiplyScalar(P.palmSide).addScaledVector(up, P.palmUp).normalize();
      const qh = V3D.handQuat(hand.human, 'R', palm, fingers);
      if (!off) off = calibrate(palm, fingers);
      // the contact point between the thumb pad and the side of the index finger sits on the needle at the grip
      wrist.copy(grip).sub(tmp2.copy(off).applyQuaternion(qh));
      wrist.addScaledVector(d, (1 - e) * 0.2); wrist.y += (1 - e) * 0.05;
      root.rotation.y = Math.atan2(-d.x, -d.z);
      root.position.set(0, 0, 0); root.updateMatrixWorld(true);
      hand.human.bonePosition('R_UpperArm', sh);
      const want3 = w3.copy(wrist).addScaledVector(d, 0.4); want3.y += 0.07;
      root.position.copy(want3).sub(sh); root.updateMatrixWorld(true);
      right.crossVectors(up, d).normalize();
      hand.setPose({ thumb: P.thumb, index: P.index + wiggle * 0.08, middle: P.middle, ring: P.ring, pinky: P.pinky, spread: P.spread, thumbOut: P.thumbOut });
      hand.place({ wrist, palmDir: palm, fingers, elbowHint: wrist.clone().addScaledVector(d, 0.25).addScaledVector(right, -0.15).add(new T.Vector3(0, -0.04, 0)) });
      clip.normal.copy(d).multiplyScalar(-1); clip.constant = d.dot(tmp.copy(wrist).addScaledVector(d, 0.25));
      hand.update(Math.min(dt, 0.05));
      root.updateMatrixWorld(true);
      prep();

      // sleeve along the actual forearm
      hand.human.bonePosition('R_Hand', wrist);
      hand.human.bonePosition('R_Forearm', elbow);
      state.wrist.copy(wrist); state.elbow.copy(elbow);
      axis.copy(elbow).sub(wrist); const al = axis.length() || 1; axis.multiplyScalar(1 / al);
      // bangles: slide along the arm with a damped lag behind the wrist's motion
      vel.copy(wrist).sub(lastWrist).multiplyScalar(1 / Math.max(dt, 1e-3)); if (firstFrame) vel.set(0, 0, 0); lastWrist.copy(wrist); firstFrame = false;
      sway.lerp(vel, 1 - Math.exp(-dt * 7));
      swayAmt += (Math.min(1, sway.length() * 2.2) - swayAmt) * Math.min(1, dt * 6);
      const along = sway.dot(axis);
      q.setFromUnitVectors(zAxis, axis);
      bangles.forEach((b, i) => {
        const p = bPos[i], tgt = 0.034 + i * 0.0105 + Math.max(-0.006, Math.min(0.006, -along * 0.012)) * (1 + i * 0.2);
        p.v += ((tgt - p.s) * 260 - p.v * 22) * dt; p.s += p.v * dt;
        b.position.copy(wrist).addScaledVector(axis, p.s); b.quaternion.copy(q);
      });
      // blouse sleeve: starts about 17 cm up the forearm, covers to the clip plane
      tube.position.copy(wrist).addScaledVector(axis, 0.12 + 0.17); tube.quaternion.setFromUnitVectors(up, axis);
      // drape: the hanging sari end, lagging behind
      const t0 = 0.12, t1 = 0.4, hang = 0.12;
      sideV.crossVectors(axis, down).normalize();
      const time = performance.now() * 0.001;
      for (let j = 0; j < NY; j++) {
        const v = j / (NY - 1);
        for (let i = 0; i < NX; i++) {
          const u = i / (NX - 1), a = t0 + (t1 - t0) * u + swayAmt * v * 0.05;
          const h = hang * v * (1 - 0.35 * Math.pow(u, 3)) * (0.7 + 0.3 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05)));
          const wob = Math.sin(time * 2.1 + u * 4 + v * 2) * 0.004 * v, o = (j * NX + i) * 3, off = 0.055 + 0.02 * v + wob;
          dpos[o] = wrist.x + axis.x * a + down.x * h + sideV.x * off - sway.x * 0.03 * v;
          dpos[o + 1] = wrist.y + axis.y * a + down.y * h + sideV.y * off - sway.y * 0.02 * v;
          dpos[o + 2] = wrist.z + axis.z * a + down.z * h + sideV.z * off - sway.z * 0.03 * v;
        }
      }
      dattr.needsUpdate = true; dg.computeVertexNormals();
    },
    get shown() { return shown; },
    setShadow(on) { hand.object.traverse((o) => { if (o.isMesh) o.castShadow = on; }); },
    dispose() { scene.remove(root, tube, drape, ...bangles); hand.dispose(); },
  };
  void TAU;
  return api;
}
