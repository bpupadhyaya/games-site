// Turns the motion samples into the pose objects Actor.apply() solves (pelvis anchored in the world, feet and hands by two-bone IK).
import { THREE } from '../vendor3d/index.js';
import { HX, STRAND_Z, smooth } from './motion.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;

// hip joint offsets from the pelvis at rest (character space), measured once from the actor
function hipsOf(actor) {
  if (actor.hipOff) return actor.hipOff;
  const p = actor.pelvisRest;
  const L = actor.b.L.thigh.getWorldPosition(V()).sub(p), R = actor.b.R.thigh.getWorldPosition(V()).sub(p);
  actor.hipOff = { L, R };
  return actor.hipOff;
}

function limbTargets(actor, yaw, pel, feet, lift) {
  // pelvis height so both legs can reach their feet (a deep split lowers the hips)
  const hips = hipsOf(actor), s = Math.sin(yaw), c = Math.cos(yaw);
  let maxY = 1e9;
  for (const side of ['L', 'R']) {
    const h = hips[side], hx = h.x * c + h.z * s, hz = -h.x * s + h.z * c;
    const f = feet[side];
    const d = Math.hypot(f.x - (pel.x + hx), f.z - (pel.z + hz));
    const L = actor.rest[side].legLen * 0.985;
    const dy = Math.sqrt(Math.max(0.0004, L * L - d * d));
    maxY = Math.min(maxY, f.y + dy - h.y);
  }
  return Math.min(pel.y, maxY);
}

// critically damped smoothing of a scalar target (state `st`, key `k`): no overshoot, continuous velocity. dt <= 0 snaps (screenshots).
export function crit(st, k, target, w, dt) {
  let s = st[k];
  if (!s || !(dt > 0) || dt > 0.12) { st[k] = { x: target, v: 0 }; return target; }
  const x = s.x - target, e = Math.exp(-w * dt), tmp = s.v + w * x;
  s.x = target + (x + tmp * dt) * e; s.v = (s.v - w * tmp * dt) * e;
  return s.x;
}

// ---- the jumper ------------------------------------------------------------------------------------------------------------------
export function jumperPose({ ctl, actor, idle, stumble, mode, tReal, celebrate, dt = 0 }) {
  const sm = actor.sm || (actor.sm = {});
  const S = ctl.sample();
  const yaw = Math.PI, sin = 0, cos = -1;
  const gA = actor.groundAnkle;
  const stand = actor.pelvisRest.y * 0.935;
  const breath = Math.sin(idle.t * 1.7 + idle.phase) * 0.5;
  const footY = (side) => gA + S.rise + S.tuck * (side === 'L' ? 0.17 : 0.2) + (S.ph === 'ground' ? 0 : 0);
  // feet (world): grounded feet sit on the ground, ON feet on the pressed band
  const feet = {
    L: { x: S.L.x, y: footY('L') + (S.ph === 'ground' && S.pose === 2 ? 0.012 : 0), z: S.L.z },
    R: { x: S.R.x, y: footY('R') + (S.ph === 'ground' && S.pose === 2 ? 0.012 : 0), z: S.R.z },
  };
  const cx = (feet.L.x + feet.R.x) / 2, cz = (feet.L.z + feet.R.z) / 2;
  const pel = V(cx, stand + S.rise + S.dip - 0.004 * breath, cz);
  if (celebrate) pel.y += 0.1 * Math.abs(Math.sin(tReal * 5.5)) * (celebrate > 0 ? 1 : 0);
  pel.y = limbTargets(actor, yaw, pel, feet);
  pel.y = crit(sm, 'py', pel.y, 28, dt);
  const crouch = clamp((stand - pel.y) / 0.25, 0, 1);
  const bend = crit(sm, 'bend', -3 + 18 * crouch + 5 * S.tuck + stumble * 16 + breath * 0.8, 16, dt);
  const side = crit(sm, 'side', Math.sin(tReal * 26) * 6 * stumble, 16, dt);
  const poleF = [0, 0.18, -1];
  const legs = {};
  for (const sd of ['L', 'R']) {
    const f = feet[sd];
    const flight = S.ph === 'air' ? 1 : 0;
    // toes point forward; in flight the soles tilt back a little
    const aim = { n: [0, -1, 0], face: 'sole', fwd: [sin, 0, cos], w: 1 };
    legs[sd] = { p: [f.x, f.y, f.z], f: 'w', w: 1, pole: poleF, pf: 'w', aim };
    void flight;
  }
  // arms (body frame: +x left, +y up, +z forward)
  const arms = {};
  const spread = S.spread, a = S.arm;
  for (const sd of ['L', 'R']) {
    const sx = sd === 'L' ? 1 : -1;
    let x = sx * (0.25 + 0.03 * Math.max(0, a) + 0.3 * spread), y = -0.06 + 0.36 * Math.max(0, a) - 0.06 * Math.max(0, -a) + 0.2 * spread, z = 0.07 + 0.26 * a - 0.04 * spread;
    if (stumble > 0) { const w = Math.sin(tReal * 30 + (sd === 'L' ? 0 : 2)); x += sx * 0.22 * stumble; y += 0.3 * stumble * (0.6 + 0.4 * w); z += 0.12 * stumble * w; }
    if (celebrate > 0) { x = sx * (0.34 + 0.05 * Math.sin(tReal * 9)); y = 0.62 + 0.1 * Math.sin(tReal * 5.5 + sx); z = 0.06; }
    if (celebrate < 0) { x = sx * 0.2; y = -0.14; z = 0.02; }
    x = crit(sm, sd + 'ax', x, 24, dt); y = crit(sm, sd + 'ay', y, 24, dt); z = crit(sm, sd + 'az', z, 24, dt);
    arms[sd] = { p: [x, y, z], f: 'b', w: 1, pole: [sx * 0.35, -1, -0.2], pf: 'b' };
  }
  const lookT = V(cx, 1.05, cz - 2.2);
  const headAdd = null;
  void headAdd;
  const tiltDown = celebrate < 0 ? 18 : 0;
  return {
    pelvis: pel, yaw, pitch: 0, roll: side * 0.3, groundY: 0,
    torso: { bend: bend + tiltDown, side, twist: Math.sin(idle.t * 0.7 + idle.phase) * 1.5 },
    pelvisTilt: { bend: 0, side: S.ph === 'air' ? 0 : Math.sin(idle.t * 0.6) * 1.0, twist: 0 },
    legs, arms, look: { target: lookT, w: celebrate < 0 ? 0.3 : 0.7 },
    out: { rise: S.rise, S },
  };
}

// ---- a holder -------------------------------------------------------------------------------------------------------------------
// side: -1 (the holder at -HX, faces +X) or +1 (at +HX, faces -X). h: strand height. pull: 0..1 how hard the band is pulled right now.
export function holderPose({ actor, side, h, pull, beatPhase, idle, jumperHead, droop }) {
  const yaw = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  const gA = actor.groundAnkle, stand = actor.pelvisRest.y * 0.975;
  const toward = -side;                                    // world X direction towards the middle
  const bob = Math.pow(Math.max(0, 1 - beatPhase * 2.4), 2);   // a small knee dip on the beat
  const breath = Math.sin(idle.t * 1.5 + idle.phase) * 0.5;
  const py = stand - 0.012 * bob - 0.03 * pull - 0.004 * breath;
  const px = side * HX + toward * (0.035 * pull + 0.004 * breath);
  const s = Math.sin(yaw), c = Math.cos(yaw);
  const W = (lx, lz) => [px + lx * c + lz * s, -lx * s + lz * c];
  const legs = {};
  for (const sd of ['L', 'R']) {
    const sx = sd === 'L' ? 1 : -1;
    const wz = W(sx * 0.15, 0.0)[1];
    legs[sd] = { p: [side * HX, gA, wz], f: 'w', w: 1, pole: [toward * 1, 0.15, 0], pf: 'w', aim: { n: [0, -1, 0], face: 'sole', fwd: [Math.sin(yaw), 0, Math.cos(yaw)], w: 1 } };
  }
  // hands: down by the sides, or holding the band at the sides when it is at hip height or above
  const arms = {};
  const hold = smooth((h - 0.8) / 0.12);
  for (const sd of ['L', 'R']) {
    const sx = sd === 'L' ? 1 : -1;
    // world z of this holder's left hand: the avatar's left is world -Z for the holder facing +X (yaw +90) and +Z for the other
    const zSide = sd === 'L' ? (side < 0 ? -1 : 1) : (side < 0 ? 1 : -1);
    const rest = [sx * 0.27, -0.05 + 0.012 * bob, 0.06 + 0.02 * Math.sin(idle.t * 1.2 + sx)];
    const worldTarget = [side * HX + toward * 0.08, h - droop * h * 0.85, zSide * (STRAND_Z + 0.015)];
    arms[sd] = hold > 0.01
      ? { p: worldTarget, f: 'w', w: hold, pole: [0, -1, 0], pf: 'w' }
      : { p: rest, f: 'b', w: 1, pole: [sx * 0.3, -1, -0.15], pf: 'b' };
  }
  const lean = pull * 7;
  return {
    pelvis: V(px, py, 0), yaw, pitch: 0, roll: 0, groundY: 0,
    torso: { bend: 2 + lean + breath, side: Math.sin(idle.t * 0.5 + idle.phase) * 1.2, twist: 0 },
    pelvisTilt: { bend: 0, side: 0, twist: 0 },
    legs, arms, look: { target: jumperHead.clone(), w: 0.85 },
    out: {},
  };
}
