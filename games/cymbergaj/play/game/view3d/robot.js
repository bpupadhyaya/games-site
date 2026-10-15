// The players' robotic arms: each paddle is held by a small industrial arm bolted to a floor pedestal beside the table (a base plate,
// a column, a shoulder, an upper link, an elbow, a forearm and a two-finger gripper that closes on the knob from either side).
// Posed analytically (two-link IK in the vertical plane through the shoulder and the grip), so there is no skeleton, no animation
// clip and nothing to vibrate or tear. Presenter-only: it just follows the knob position the presenter hands it.
import { THREE as T } from '../vendor3d/index.js';

const L1 = 0.37, L2 = 0.37;            // upper link, forearm (metres): arches over the table and reaches every spot of its half
const SHOULDER_UP = 0.11, GRIP_DROP = 0.09;

export function createRobotArm(scene, { x, z, floorY, tableEdge = 0, accent = 0xd8301f, castShadow = true }) {
  const root = new T.Group(); root.visible = false; scene.add(root);
  const steel = new T.MeshStandardMaterial({ color: 0xd5dbe4, roughness: 0.32, metalness: 0.6 });
  const dark = new T.MeshStandardMaterial({ color: 0x23272f, roughness: 0.5, metalness: 0.45 });
  const acc = new T.MeshStandardMaterial({ color: accent, roughness: 0.3, metalness: 0.25 });
  const rubber = new T.MeshStandardMaterial({ color: 0x131417, roughness: 0.85, metalness: 0 });
  const mesh = (geo, mat) => { const m = new T.Mesh(geo, mat); m.castShadow = castShadow; m.frustumCulled = false; root.add(m); return m; };
  const unitCyl = new T.CylinderGeometry(1, 1, 1, 24, 1), ball = new T.SphereGeometry(1, 24, 16), box = new T.BoxGeometry(1, 1, 1);
  const plate = mesh(new T.CylinderGeometry(0.075, 0.085, 0.03, 36), dark);
  const clampBlock = mesh(box, dark);   // bolts the base to the table's frame
  const column = mesh(unitCyl, steel), collar = mesh(new T.CylinderGeometry(0.075, 0.075, 0.05, 28), acc);
  const shoulder = mesh(ball, steel), elbow = mesh(ball, steel), wristJ = mesh(ball, dark);
  const ringS = mesh(new T.TorusGeometry(1, 0.2, 10, 28), acc), ringE = mesh(new T.TorusGeometry(1, 0.2, 10, 28), acc);
  const upper = mesh(unitCyl, steel), fore = mesh(unitCyl, steel);
  const palm = mesh(box, dark), fingerL = mesh(box, rubber), fingerR = mesh(box, rubber);

  const base = new T.Vector3(x, floorY, z), sh = new T.Vector3(), el = new T.Vector3(), wr = new T.Vector3(), tip = new T.Vector3();
  const u = new T.Vector3(), pole = new T.Vector3(), hv = new T.Vector3(), side = new T.Vector3(), tmp = new T.Vector3(), foot = new T.Vector3();
  const fwd = new T.Vector3(), right = new T.Vector3(), out = new T.Vector3();
  const Y = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1);

  function link(m, a, b, r) {
    tmp.copy(b).sub(a); const len = tmp.length() || 1e-4;
    m.position.copy(a).addScaledVector(tmp, 0.5);
    m.quaternion.setFromUnitVectors(Y, tmp.multiplyScalar(1 / len));
    m.scale.set(r, len, r);
  }
  const setBall = (m, p, r) => { m.position.copy(p); m.scale.setScalar(r); };

  return {
    root,
    // grip: the knob's centre; fingers close on it. squeeze 0..1 tightens the gripper a touch while striking.
    update(grip, squeeze = 0) {
      root.visible = true;
      tip.copy(grip);
      wr.copy(tip); wr.y += GRIP_DROP;
      sh.set(base.x, SHOULDER_UP, base.z);
      u.copy(wr).sub(sh); let D = u.length(); u.multiplyScalar(1 / (D || 1));
      D = Math.min(Math.max(D, 0.06), L1 + L2 - 0.004);
      const a = (D * D + L1 * L1 - L2 * L2) / (2 * D), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      // the elbow arches up and bows away from the table's centre line
      out.set(Math.sign(base.x) || 1, 0, 0);
      pole.set(0, 1, 0).addScaledVector(out, 0.35);
      hv.copy(pole).addScaledVector(u, -pole.dot(u)).normalize();
      el.copy(sh).addScaledVector(u, a).addScaledVector(hv, h);
      if (wr.distanceTo(el) > L2 + 0.01) { tmp.copy(wr).sub(el).setLength(L2); wr.copy(el).add(tmp); }

      plate.position.set(base.x, base.y + 0.015, base.z);
      { const dx = Math.abs(base.x) - tableEdge + 0.02; clampBlock.scale.set(dx, 0.07, 0.14); clampBlock.position.set(base.x - Math.sign(base.x) * dx * 0.5, base.y + 0.035 - 0.0, base.z); }
      foot.set(base.x, base.y + 0.03, base.z);
      link(column, foot, sh, 0.045);
      collar.position.set(base.x, base.y + 0.09, base.z);
      setBall(shoulder, sh, 0.058);
      setBall(elbow, el, 0.045);
      link(upper, sh, el, 0.034);
      link(fore, el, wr, 0.026);
      setBall(wristJ, wr, 0.036);
      side.crossVectors(u, hv).normalize();
      for (const [ring, p, r] of [[ringS, sh, 0.058], [ringE, el, 0.046]]) {
        ring.position.copy(p); ring.scale.setScalar(r * 1.05); ring.quaternion.setFromUnitVectors(Z, side);
      }
      // gripper: a palm block above the knob, two rubber fingers closing on it from either side of the arm's direction
      fwd.set(grip.x - base.x, 0, grip.z - base.z); if (fwd.lengthSq() < 1e-6) fwd.set(-Math.sign(base.x) || 1, 0, 0); fwd.normalize();
      right.crossVectors(Y, fwd).normalize();
      palm.position.set(wr.x, wr.y - 0.012, wr.z); palm.scale.set(0.085, 0.024, 0.045); palm.quaternion.setFromUnitVectors(Z, fwd);
      const gap = 0.0255 - Math.max(0, Math.min(1, squeeze)) * 0.0015;   // the knob's radius plus a hair
      const fy = (tip.y + wr.y) * 0.5 - 0.012, fh = Math.max(0.02, wr.y - 0.012 - tip.y);
      for (const [f, s] of [[fingerL, -1], [fingerR, 1]]) {
        f.position.set(tip.x + right.x * s * (gap + 0.005), fy, tip.z + right.z * s * (gap + 0.005));
        f.scale.set(0.010, fh, 0.03);
        f.quaternion.setFromUnitVectors(Z, fwd);
      }
    },
    hide() { root.visible = false; },
    dispose() { scene.remove(root); },
  };
}
