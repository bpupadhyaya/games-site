// The scooping arm: a small robotic arm bolted to the stall counter (a pedestal, a shoulder, an upper link, an elbow, a forearm and a
// two-finger gripper) that holds the handle of the poi. It is posed analytically (two-link IK in the vertical plane through the base and
// the grip), so there is no skeleton, no animation clip and nothing to vibrate; the only inputs are the grip point and the direction
// toward the player. Presenter-only: it follows the grip point the presenter hands it.
import * as V3D from '../vendor3d/index.js';
import { TUB } from '../src/v3.js';

const T = V3D.THREE;
const L1 = 0.62, L2 = 0.60;            // upper link, forearm (metres): long enough to reach every corner of the 1.0 x 0.8 m tub
const SHOULDER_UP = 0.22, GRIP_DROP = 0.085;

export async function createPoiHand(scene) {
  const root = new T.Group();
  root.visible = false;
  scene.add(root);
  const steel = new T.MeshStandardMaterial({ color: 0xc9d1dc, roughness: 0.38, metalness: 0.55 });
  const dark = new T.MeshStandardMaterial({ color: 0x252a35, roughness: 0.5, metalness: 0.4 });
  const accent = new T.MeshStandardMaterial({ color: 0xd8301f, roughness: 0.35, metalness: 0.15 });
  const rubber = new T.MeshStandardMaterial({ color: 0x15161a, roughness: 0.85, metalness: 0 });
  const mesh = (geo, mat) => { const m = new T.Mesh(geo, mat); m.castShadow = true; m.frustumCulled = false; root.add(m); return m; };
  const unitCyl = new T.CylinderGeometry(1, 1, 1, 20, 1);
  const ball = new T.SphereGeometry(1, 20, 14);
  const box = new T.BoxGeometry(1, 1, 1);

  const plate = mesh(new T.CylinderGeometry(0.11, 0.125, 0.03, 32), dark);
  const column = mesh(unitCyl, steel);
  const shoulder = mesh(ball, steel), elbow = mesh(ball, steel), wristJ = mesh(ball, dark);
  const ringS = mesh(new T.TorusGeometry(1, 0.2, 10, 28), accent), ringE = mesh(new T.TorusGeometry(1, 0.2, 10, 28), accent);
  const upper = mesh(unitCyl, steel), fore = mesh(unitCyl, steel);
  const palm = mesh(box, dark), fingerL = mesh(box, rubber), fingerR = mesh(box, rubber);
  const clip = new T.Plane(new T.Vector3(0, 0, 1), 1e6);   // kept for the old API; nothing is clipped any more

  const base = new T.Vector3(), sh = new T.Vector3(), el = new T.Vector3(), wr = new T.Vector3(), tip = new T.Vector3();
  const u = new T.Vector3(), pole = new T.Vector3(), hv = new T.Vector3(), side = new T.Vector3(), tmp = new T.Vector3(), off = new T.Vector3();
  const fwd = new T.Vector3(), right = new T.Vector3(), foot = new T.Vector3();
  const Y = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1);
  let shown = 0;

  // a unit cylinder stretched between two points
  function link(m, a, b, r) {
    tmp.copy(b).sub(a); const len = tmp.length() || 1e-4;
    m.position.copy(a).addScaledVector(tmp, 0.5);
    m.quaternion.setFromUnitVectors(Y, tmp.multiplyScalar(1 / len));
    m.scale.set(r, len, r);
  }
  const setBall = (m, p, r) => { m.position.copy(p); m.scale.setScalar(r); };

  const api = {
    root, clip, hand: { human: null },
    // grip: where the gripper meets the handle; d: horizontal unit vector from the poi toward the player
    update(grip, d, want, dt, wiggle = 0) {
      shown = Math.max(0, Math.min(1, shown + (want ? 1 : -1) * dt * 3.2));
      root.visible = shown > 0.01;
      if (!root.visible) return;
      const e = shown * shown * (3 - 2 * shown);
      // the whole arm slides away from the poi while it withdraws
      // the pedestal is bolted to the counter at the near edge of the tub, a little to the right of centre so the arm comes in on
      // a diagonal and never hides the scoop: it never moves
      fwd.set(d.x, 0, d.z).normalize();
      right.crossVectors(Y, fwd).normalize();
      const ext = Math.abs(d.x) * TUB.hx + Math.abs(d.z) * TUB.hz + TUB.rim + 0.2;
      base.set(d.x * ext + right.x * 0.42, -0.012, d.z * ext + right.z * 0.42);
      // folded rest pose: the gripper draws back toward the pedestal and up
      tip.copy(grip);
      if (e < 1) tip.set(base.x - d.x * 0.2 + (grip.x - base.x + d.x * 0.2) * e, 0.2 * (1 - e) + grip.y * e, base.z - d.z * 0.2 + (grip.z - base.z + d.z * 0.2) * e);
      wr.copy(tip); wr.y += GRIP_DROP;                           // the wrist sits straight above the grip
      sh.copy(base); sh.y += SHOULDER_UP;
      // two-link IK in the vertical plane through the shoulder and the wrist; the elbow rises and bows a little toward the player
      u.copy(wr).sub(sh); let D = u.length(); u.multiplyScalar(1 / (D || 1));
      D = Math.min(D, L1 + L2 - 0.004);
      const a = (D * D + L1 * L1 - L2 * L2) / (2 * D), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      pole.set(0, 1, 0).addScaledVector(d, 0.25);
      hv.copy(pole).addScaledVector(u, -pole.dot(u)).normalize();
      el.copy(sh).addScaledVector(u, a).addScaledVector(hv, h);
      // if the wrist is out of reach, let it hang from the elbow instead of stretching the forearm
      if (wr.distanceTo(el) > L2 + 0.01) { tmp.copy(wr).sub(el).setLength(L2); wr.copy(el).add(tmp); }

      // pedestal and joints
      plate.position.set(base.x, base.y + 0.015, base.z);
      foot.set(base.x, base.y + 0.03, base.z);
      link(column, foot, sh, 0.058);
      setBall(shoulder, sh, 0.065);
      setBall(elbow, el, 0.052);
      link(upper, sh, el, 0.04);
      link(fore, el, wr, 0.031);
      setBall(wristJ, wr, 0.034);
      // accent rings around the shoulder and elbow, facing across the arm's plane
      side.crossVectors(u, hv).normalize();
      for (const [ring, p, r] of [[ringS, sh, 0.065], [ringE, el, 0.053]]) {
        ring.position.copy(p); ring.scale.setScalar(r * 1.05);
        ring.quaternion.setFromUnitVectors(Z, side);
      }
      // gripper: a palm block under the wrist and two rubber fingers closing on the handle from either side
      fwd.set(d.x, 0, d.z).normalize();
      right.crossVectors(Y, fwd).normalize();
      palm.position.set(wr.x, wr.y - 0.004, wr.z); palm.scale.set(0.05, 0.02, 0.032); palm.quaternion.setFromUnitVectors(Z, fwd);
      const gap = 0.0105 - Math.max(0, Math.min(1, wiggle)) * 0.0012;
      const fy = (tip.y + wr.y) * 0.5 - 0.004, fh = wr.y - tip.y;
      for (const [f, s] of [[fingerL, -1], [fingerR, 1]]) {
        f.position.set(tip.x + right.x * s * gap, fy, tip.z + right.z * s * gap);
        f.scale.set(0.008, Math.max(0.02, fh), 0.02);
        f.quaternion.setFromUnitVectors(Z, fwd);
      }
    },
    get shown() { return shown; },
    setShadow(on) { root.traverse((o) => { if (o.isMesh) o.castShadow = on; }); },
    dispose() { scene.remove(root); },
  };
  return api;
}
