// The player's hand in a yukata sleeve, holding the handle of the poi. Built on the shared view3d athlete (real knuckles, nails,
// finger rig) through the game-owned hand3d.js. Presenter-only: it follows the grip point the presenter hands it.
// The body of the athlete is hidden by a clipping plane and by the sleeve; only hand, wrist and the wide cotton sleeve show.
import * as V3D from '../vendor3d/index.js';
import { createHand } from './hand3d.js';
import { texOf, indigoCanvas, mk } from './tex.js';

const T = V3D.THREE;


// Only the right arm may ever render. The clip plane alone is not enough: the idle clip and the root tracking swing the legs and the
// other arm across it. So the skinned geometry itself is cut down to the triangles that belong to the right upper arm, forearm and
// hand/fingers (decided by each vertex's strongest bone), and every other mesh of the athlete (shoes, hair, eyes, clothes) is hidden.
const KEEP = /^Bip01_R_(UpperArm|Forearm|Hand|Finger\d*)$/;
function keepOnlyRightArm(object) {
  object.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.isSkinnedMesh || !o.skeleton || !o.geometry.attributes.skinIndex) { o.visible = false; return; }
    const g = o.geometry.clone(), si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = o.skeleton.bones;
    const ok = new Uint8Array(si.count);
    for (let v = 0; v < si.count; v++) {
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; best = si.getComponent(v, k); } }
      ok[v] = KEEP.test(bones[best]?.name || '') ? 1 : 0;
    }
    const idx = g.index ? g.index.array : null, out = [], groups = [];
    const src = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.length : si.count, materialIndex: 0 }];
    for (const gr of src) {
      const start = out.length;
      for (let i = gr.start; i < gr.start + gr.count; i += 3) {
        const a = idx ? idx[i] : i, b = idx ? idx[i + 1] : i + 1, c = idx ? idx[i + 2] : i + 2;
        if (ok[a] && ok[b] && ok[c]) out.push(a, b, c);
      }
      if (out.length > start) groups.push({ start, count: out.length - start, materialIndex: gr.materialIndex });
    }
    if (!out.length) { o.visible = false; return; }
    g.setIndex(out);
    g.clearGroups();
    for (const gr of groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
    o.geometry = g;
  });
}

export async function createPoiHand(scene, { skin = 'light', character = 'athlete_f' } = {}) {
  const hand = await createHand(V3D, { side: 'R', skin, character, preset: 'pinch' });
  hand.human.setKit?.({ top: '#1d2c5e', trim: '#e9eef4' });
  const root = new T.Group();
  root.add(hand.object);
  scene.add(root);
  root.visible = false;
  const clip = new T.Plane(new T.Vector3(0, 0, 1), 0);
  keepOnlyRightArm(hand.object);
  hand.object.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; o.castShadow = true; o.receiveShadow = false;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) { m.clippingPlanes = [clip]; m.clipShadows = true; m.needsUpdate = true; }
  });

  // ---- the sleeve: a cuff, a tube around the forearm and a hanging drape that sways with the hand
  const indigo = texOf(indigoCanvas({ scale: 40, seed: 11, size: 512 }), { repeat: [1.2, 1.2] });
  const sleeveMat = new T.MeshStandardMaterial({ map: indigo, roughness: 0.9, metalness: 0, side: T.DoubleSide, vertexColors: true, transparent: true, depthWrite: false, clippingPlanes: [clip] });
  const cuffMat = new T.MeshStandardMaterial({ color: 0xeae6dc, roughness: 0.85, side: T.DoubleSide, clippingPlanes: [clip] });
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // the sleeve is a long wide yukata sleeve: opaque from the cuff and running on past the edge of the frame, so the arm never ends
  // in a visible cut (the skin forearm is clipped inside it, where only the sleeve shows)
  const SLEEVE_LEN = 1.7;
  const tubeGeo = new T.CylinderGeometry(0.075, 0.046, SLEEVE_LEN, 24, 8, true);
  { const p = tubeGeo.attributes.position, c = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) { c[i * 4] = c[i * 4 + 1] = c[i * 4 + 2] = 1; c[i * 4 + 3] = 1; }
    tubeGeo.setAttribute('color', new T.BufferAttribute(c, 4)); }
  const tubeMat = new T.MeshStandardMaterial({ map: indigo, roughness: 0.9, metalness: 0, side: T.DoubleSide });
  const tube = new T.Mesh(tubeGeo, tubeMat);
  const cuff = new T.Mesh(new T.CylinderGeometry(0.034, 0.036, 0.04, 16, 1, true), cuffMat);
  const NX = 12, NY = 7;
  const dg = new T.BufferGeometry();
  const dpos = new Float32Array(NX * NY * 3), duv = new Float32Array(NX * NY * 2), didx = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const n = j * NX + i; duv[n * 2] = i / (NX - 1); duv[n * 2 + 1] = j / (NY - 1); }
  for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, b = a + NX; didx.push(a, b, a + 1, a + 1, b, b + 1); }
  const dattr = new T.BufferAttribute(dpos, 3); dattr.setUsage(35048);
  const dcol = new Float32Array(NX * NY * 4);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const n = j * NX + i; dcol[n * 4] = dcol[n * 4 + 1] = dcol[n * 4 + 2] = 1; dcol[n * 4 + 3] = 1 - sstep(0.1, 0.7, i / (NX - 1)); }
  dg.setAttribute('position', dattr); dg.setAttribute('uv', new T.BufferAttribute(duv, 2)); dg.setAttribute('color', new T.BufferAttribute(dcol, 4)); dg.setIndex(didx);
  const drape = new T.Mesh(dg, sleeveMat);
  for (const m of [tube, cuff, drape]) { m.frustumCulled = false; m.castShadow = true; scene.add(m); m.visible = false; }
  // the drape's seam: a white edge band along the hem
  const hem = new T.Mesh(new T.PlaneGeometry(1, 1), cuffMat); hem.visible = false;

  const wrist = new T.Vector3(), elbow = new T.Vector3(), axis = new T.Vector3(), tmp = new T.Vector3(), sh = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  const tq = new T.Quaternion(), right = new T.Vector3(), down = new T.Vector3(), lastWrist = new T.Vector3(), vel = new T.Vector3(), sway = new T.Vector3();
  let shown = 0, have = false, swayAmt = 0;

  const api = {
    root, hand, clip,
    // grip: where the thumb and fingertips meet on the handle; d: horizontal unit vector from the poi toward the player
    update(grip, d, want, dt, wiggle = 0) {
      shown = Math.max(0, Math.min(1, shown + (want ? 1 : -1) * dt * 3.2));
      const vis = shown > 0.01;
      root.visible = tube.visible = cuff.visible = vis; drape.visible = false;   // the long sleeve replaces the drape (it z-fought with the tube)
      if (!vis) { have = false; return; }
      const e = shown * shown * (3 - 2 * shown);
      // the wrist sits just above and behind the grip (toward the player); it arrives from below the screen edge
      wrist.copy(grip).addScaledVector(d, 0.05 + (1 - e) * 0.22); wrist.y += 0.036 + (1 - e) * 0.05;
      const fingers = tmp.copy(d).multiplyScalar(-1); fingers.y = -0.55; fingers.normalize();
      // stand the athlete behind the hand (toward the player), facing the poi
      root.rotation.y = Math.atan2(-d.x, -d.z);
      root.position.set(0, 0, 0); root.updateMatrixWorld(true);
      hand.human.bonePosition('R_UpperArm', sh);
      const want3 = new T.Vector3().copy(wrist).addScaledVector(d, 0.42); want3.y += 0.13;
      root.position.copy(want3).sub(sh); root.updateMatrixWorld(true);
      right.crossVectors(up, d).normalize();   // toward the player's right... (d x up) handled by sign below
      hand.setPose({ thumb: 0.5, index: 0.52 + wiggle * 0.1, middle: 0.5, ring: 0.62, pinky: 0.68, spread: 0.1, thumbOut: 0.25 });
      hand.place({ wrist, palmDown: true, fingers, elbowHint: wrist.clone().addScaledVector(d, 0.25).addScaledVector(right, -0.16).add(new T.Vector3(0, -0.04, 0)) });
      clip.normal.copy(d).multiplyScalar(-1); clip.constant = d.dot(tmp.copy(wrist).addScaledVector(d, 0.09));
      hand.human.setReach('R', wrist, { weight: 1, pole: null });
      hand.update(Math.min(dt, 0.05));
      root.updateMatrixWorld(true);
      hand.object.traverse((o) => {
        if (!o.isMesh) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) if (!m.clippingPlanes || m.clippingPlanes[0] !== clip) { m.clippingPlanes = [clip]; m.clipShadows = true; m.needsUpdate = true; }
      });

      // sleeve along the actual forearm
      hand.human.bonePosition('R_Hand', wrist);
      hand.human.bonePosition('R_Forearm', elbow);
      axis.copy(elbow).sub(wrist); const al = axis.length() || 1; axis.multiplyScalar(1 / al);
      // cuff just behind the wrist bone, tube from there towards the elbow (clipped by the same plane)
      const c0 = tmp.copy(wrist).addScaledVector(axis, 0.035);
      cuff.position.copy(c0).addScaledVector(axis, 0.0); cuff.quaternion.setFromUnitVectors(up, axis);
      tube.position.copy(wrist).addScaledVector(axis, 0.035 + SLEEVE_LEN / 2); tube.quaternion.copy(cuff.quaternion);
      // drape (the hanging half of the sleeve): lags behind the hand's motion
      vel.copy(wrist).sub(lastWrist).multiplyScalar(1 / Math.max(dt, 1e-3)); lastWrist.copy(wrist);
      sway.lerp(vel, 1 - Math.exp(-dt * 7));
      swayAmt += (Math.min(1, sway.length() * 2.2) - swayAmt) * Math.min(1, dt * 6);
      down.set(0, -1, 0);
      const side = new T.Vector3().crossVectors(axis, down).normalize();   // across the arm
      const t0 = 0.05, t1 = 0.4, hang = 0.17;
      const time = performance.now() * 0.001;
      for (let j = 0; j < NY; j++) {
        const v = j / (NY - 1);
        for (let i = 0; i < NX; i++) {
          const u = i / (NX - 1), along = t0 + (t1 - t0) * u;
          // the hem lifts slightly toward the elbow and the bottom edge rounds off at the corner
          const h = hang * v * (1 - 0.35 * Math.pow(u, 3)) * (0.7 + 0.3 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05)));
          const lagAlong = swayAmt * v * 0.07, wob = Math.sin(time * 2.1 + u * 4 + v * 2) * 0.004 * v;
          const n = (j * NX + i) * 3;
          const w = wrist, a = along + lagAlong;
          dpos[n] = w.x + axis.x * a + down.x * h + side.x * (0.045 + 0.02 * v + wob) - sway.x * 0.03 * v;
          dpos[n + 1] = w.y + axis.y * a + down.y * h + side.y * (0.045 + 0.02 * v + wob) - sway.y * 0.02 * v;
          dpos[n + 2] = w.z + axis.z * a + down.z * h + side.z * (0.045 + 0.02 * v + wob) - sway.z * 0.03 * v;
        }
      }
      dattr.needsUpdate = true; dg.computeVertexNormals();
    },
    get shown() { return shown; },
    setShadow(on) { hand.object.traverse((o) => { if (o.isMesh) o.castShadow = on; }); },
    dispose() { scene.remove(root, tube, cuff, drape); hand.dispose(); },
  };
  void hem; void mk;
  return api;
}
