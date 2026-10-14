// The cook's hands: two real hands + forearms (view3d athlete mesh with the finger rig) reaching in from the cook's side of the stall.
// Right hand holds the two picks (it follows the pick pose the presenter computed this frame: pose first, THEN grip, THEN render, so a
// prop can never float off the hand). Left hand takes the ladle while it pours and rests on the pan handle otherwise.
// Scale: 1 scene unit = 5.5 cm. The forearm has a rolled white sleeve and a tenugui wristband; the rest of the body is clipped away.
import * as V3D from '../vendor3d/index.js';
import { createHand } from './hand3d.js';

const UNIT = 0.055;
export async function createCook({ scene, THREE, renderer }) {
  const T = THREE;
  const hs = new T.Scene();
  const key = new T.DirectionalLight(0xffd9a6, 2.8); key.position.set(-7, 15, 9);
  const fill = new T.DirectionalLight(0xaec4ff, 0.5); fill.position.set(9, 5, 8);
  const rimL = new T.DirectionalLight(0xffb27a, 1.4); rimL.position.set(6, 6, -9);
  hs.add(new T.HemisphereLight(0xffe6c8, 0x3a2a20, 0.7), key, fill, rimL);

  const mkHand = async (side) => {
    const hand = await createHand(V3D, { side, skin: '#c8956a', character: 'athlete_m', preset: 'gripRod' });
    hand.human.setKit({ top: '#e8e2d0', trim: '#e8e2d0' });
    const root = new T.Group(); root.scale.setScalar(1 / UNIT); root.add(hand.object); hs.add(root);
    hand.object.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; } });
    // rolled cotton sleeve + tenugui wristband follow the arm bones in world space (world units)
    const cloth = new T.MeshStandardMaterial({ color: '#efe9d8', roughness: 0.92 });
    const band = new T.MeshStandardMaterial({ color: '#233a78', roughness: 0.85 });
    const upper = new T.Mesh(new T.CylinderGeometry(1.0, 1.0, 1, 18, 1, true), cloth);
    const lower = new T.Mesh(new T.CylinderGeometry(0.92, 0.98, 1, 18, 1, true), cloth);
    upper.material = lower.material = new T.MeshStandardMaterial({ color: '#efe9d8', roughness: 0.92, side: T.DoubleSide });
    const elbow = new T.Mesh(new T.SphereGeometry(1.02, 14, 10), cloth);
    const cuff = new T.Mesh(new T.TorusGeometry(0.98, 0.26, 10, 24), cloth);
    const wrap = new T.Mesh(new T.TorusGeometry(0.66, 0.2, 8, 20), band);
    hs.add(upper, lower, elbow, cuff, wrap);
    const wrapPos = [new T.Vector3(), new T.Vector3()];
    return { hand, root, side, parts: { upper, lower, elbow, cuff, wrap }, wrapPos, plane: new T.Plane(new T.Vector3(0, 0, 1), 0), shown: 0, cur: new T.Vector3(), have: false };
  };
  const Rh = await mkHand('R');
  const Lh = await mkHand('L');
  Rh.root.visible = false; Lh.root.visible = false;
  const tmp = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), sh = new T.Vector3();
  const up = new T.Vector3(0, 1, 0), yAxis = new T.Vector3(0, 1, 0);
  const placeTube = (mesh, p0, p1) => {
    const dd = tmp.copy(p1).sub(p0), len = dd.length() || 1e-3;
    mesh.position.copy(p0).addScaledVector(dd, 0.5); mesh.quaternion.setFromUnitVectors(yAxis, dd.multiplyScalar(1 / len));
    mesh.scale.set(1, len, 1);
  };

  // pose one hand: wrist target, palm normal, finger direction, elbow hint, finger preset, how far behind the wrist the body is cut
  function drive(H, o, dt) {
    const { hand, root } = H;
    H.shown += (o.want ? 1 : -1) * dt * 4; H.shown = Math.max(0, Math.min(1, H.shown));
    root.visible = H.shown > 0.01;
    for (const k of Object.keys(H.parts)) H.parts[k].visible = root.visible;
    if (!root.visible) { H.have = false; return false; }
    const e = H.shown * H.shown * (3 - 2 * H.shown), enter = (1 - e);
    // slide in from the cook's side while appearing
    const w = H.cur;
    tmp.copy(o.wrist).addScaledVector(o.back, enter * 5).addScaledVector(up, -enter * 1.5);
    if (!H.have) { w.copy(tmp); H.vel = new T.Vector3(); H.have = true; }
    else { const w0 = 24, sub = 4, h = Math.min(dt, 0.05) / sub; for (let q = 0; q < sub; q++) { H.vel.addScaledVector(a.copy(tmp).sub(w), w0 * w0 * h).multiplyScalar(1 - 2 * w0 * h); w.addScaledVector(H.vel, h); } }
    // body behind the hand: shoulder a forearm + upper arm back along `back`, a little lower and outward
    root.position.set(0, 0, 0); root.updateMatrixWorld(true);
    hand.human.bonePosition(`${H.side}_UpperArm`, sh);
    const want = tmp.copy(w).addScaledVector(o.back, 0.5 / UNIT).addScaledVector(up, 0.12 / UNIT).addScaledVector(o.side, (H.side === 'R' ? 1 : -1) * 0.1 / UNIT);
    root.position.copy(want).sub(sh); root.updateMatrixWorld(true);
    hand.setPose(o.pose);
    hand.place({ wrist: w, palmDown: false, palmDir: o.palm, fingers: o.fingers, elbowHint: o.elbow });
    hand.human.setReach(H.side, w, { weight: 1, pole: o.elbow });
    hand.update(dt);
    // cut the rest of the body: keep `keep` metres of arm behind the wrist
    H.plane.normal.copy(o.back).multiplyScalar(-1);
    tmp.copy(w).addScaledVector(o.back, o.keep / UNIT);
    H.plane.constant = -H.plane.normal.dot(tmp);
    // sleeve geometry from the bones
    const S = H.side;
    hand.human.bonePosition(`${S}_UpperArm`, a); hand.human.bonePosition(`${S}_Forearm`, b); hand.human.bonePosition(`${S}_Hand`, c);
    const P = H.parts, fa = tmp.copy(c).sub(b), cuffAt = b.clone().addScaledVector(fa, 0.42), wrapAt = b.clone().addScaledVector(fa, 0.9);
    placeTube(P.upper, a.clone().lerp(b, 0.15), b); P.upper.scale.set(0.86, P.upper.scale.y, 0.86);
    placeTube(P.lower, b, cuffAt); P.lower.scale.set(0.74, P.lower.scale.y, 0.74);
    P.elbow.position.copy(b); P.elbow.scale.setScalar(0.76);
    P.cuff.position.copy(cuffAt); P.cuff.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), fa.clone().normalize()); P.cuff.scale.setScalar(0.76);
    P.wrap.position.copy(wrapAt); P.wrap.quaternion.copy(P.cuff.quaternion); P.wrap.scale.setScalar(0.7);
    return true;
  }

  const back = new T.Vector3(), sideV = new T.Vector3(1, 0, 0), g = new T.Vector3(), d = new T.Vector3(), tmp2 = new T.Vector3();
  let visible = true, flick = 0;
  const api = {
    setVisible(v) { visible = v; },
    flipAt() { flick = 0.35; },
    update(dt, o) {
      if (!visible) { Rh.shown = 0; Lh.shown = 0; Rh.root.visible = false; Lh.root.visible = false; for (const H of [Rh, Lh]) for (const k of Object.keys(H.parts)) H.parts[k].visible = false; return; }
      flick = Math.max(0, flick - dt);
      const { picks, ladle, pouring, r, clock } = o;
      back.set(0.35, 0.55, 1).normalize();                      // toward the cook (camera side) and up
      ladle.updateMatrixWorld(true); picks.updateMatrixWorld(true);
      if (pouring) {
        // the right hand takes the ladle while it pours (the handle points to the cook's right)
        const lh = ladle.localToWorld(new T.Vector3(2.6, 0.5, 0)), ld = ladle.localToWorld(new T.Vector3(0.4, 0.1, 0)).sub(lh).normalize();
        Rh._want = true; back.set(0.85, 0.5, 0.45).normalize();
        driveR(lh.addScaledVector(ld, -1.4), ld, dt);
      } else {
        // right hand with the picks: both lie along picks' -z axis; the grip is 1.5 units from the cap end
        Rh._want = !!o.active; back.set(0.7, 0.55, 0.9).normalize();
        d.set(0, 0, -1).applyQuaternion(picks.quaternion);
        g.copy(picks.position).addScaledVector(d, 1.5);
        tmp2.copy(g).addScaledVector(d, -1.7).addScaledVector(up, 0.25 + Math.sin(clock * 1.7) * 0.05);
        driveR(tmp2, d, dt);
      }
      Lh._want = false; drive(Lh, { want: false }, dt);
    },
    render(rend, camera) {
      hs.environment = scene.environment; hs.environmentIntensity = scene.environmentIntensity ?? 0.38;
      if (!Rh.root.visible && !Lh.root.visible) return;
      // one pass per hand so each has its own cut plane
      for (const H of [Rh, Lh]) {
        if (!H.root.visible) continue;
        for (const O of [Rh, Lh]) { const on = O === H; O.root.visible = on && O.root.visible; for (const k of Object.keys(O.parts)) O.parts[k].visible = on; }
        rend.clippingPlanes = [H.plane];
        rend.render(hs, camera);
      }
      rend.clippingPlanes = [];
      for (const H of [Rh, Lh]) { H.root.visible = H.shown > 0.01; for (const k of Object.keys(H.parts)) H.parts[k].visible = H.root.visible; }
    },
  };
  const OPEN = { thumb: 0.45, index: 0.62, middle: 0.66, ring: 0.7, pinky: 0.72, spread: 0.05, thumbOut: 0.2 };
  function driveR(wrist, dir, dt) {
    const palm = tmp.set(-0.75, -0.55, 0.0).clone();
    drive(Rh, { want: !!Rh._want, wrist, back, side: sideV, palm, fingers: dir.clone(), elbow: wrist.clone().addScaledVector(back, 6).add(new T.Vector3(2.5, -2.5, 0)), pose: { ...OPEN, index: 0.7 - (flick > 0 ? 0.15 : 0) }, keep: 0.5 }, dt);
  }
  function driveL(wrist, dir, dt) {
    const palm = new T.Vector3(0.2, -1, 0.1).normalize();
    drive(Lh, { want: !!Lh._want, wrist, back: new T.Vector3(-0.45, 0.5, 1).normalize(), side: sideV, palm, fingers: dir.clone(), elbow: wrist.clone().addScaledVector(new T.Vector3(-1, 0, 1), 5).add(new T.Vector3(-3, -2, 0)), pose: { thumb: 0.5, index: 0.75, middle: 0.8, ring: 0.8, pinky: 0.8, spread: 0, thumbOut: 0.1 }, keep: 0.5 }, dt);
  }
  api.hands = { R: Rh, L: Lh };
  return api;
}
