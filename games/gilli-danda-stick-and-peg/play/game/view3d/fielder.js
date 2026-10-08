// The fielders: a locomotion / ready-stance clip as the base pose, and when a catch is on, both hands reach for the gilli with arm IK.
// A pose is a pure function of the context so pause and screenshots are exact.
import { V3, D2R, clamp, smooth, ramp } from './util3.js';

export function fielderPose(c, rig, out = {}) {
  const spec = { x: c.x, z: c.z, yaw: c.yaw };
  const idle = c.idleT ?? 0;
  let clip = 'ready_stance', time = (idle * 0.9 + c.id * 0.7) % 2.7;
  if (c.celebrate >= 0) { clip = 'celebrate'; time = Math.min(3.5, c.celebrate); }
  else if (c.moving > 0.3) {
    if (c.moving >= 4.7) { clip = 'sprint'; time = c.runPhase / 5.84; }
    else if (c.moving >= 3.4) { clip = 'jog'; time = c.runPhase / 3.07; }
    else { clip = 'jog_slow'; time = c.runPhase / 2.41; }
  } else if (c.crouch) { clip = 'crouch_idle'; time = idle % 4; }
  rig.setBase([{ clip, time, w: 1 }]);
  rig.noLower = true;
  spec.pelvis = null;
  if (c.look) spec.head = { target: c.look, weight: 0.9, maxYaw: 1.2, maxPitch: 0.7 };
  // reaching for the catch: both hands to the gilli, a little apart, elbows out
  if (c.reach && c.reach.w > 0.01) {
    const p = c.reach.pos, w = clamp(c.reach.w, 0, 1), yaw = c.yaw;
    const side = new V3(Math.cos(yaw), 0, -Math.sin(yaw));        // avatar-left
    const gap = 0.07 + (1 - w) * 0.22;
    spec.hands = {
      L: { p: p.clone().addScaledVector(side, gap), pole: p.clone().addScaledVector(side, 0.55).setY(p.y - 0.3), w, clav: 1 },
      R: { p: p.clone().addScaledVector(side, -gap), pole: p.clone().addScaledVector(side, -0.55).setY(p.y - 0.3), w, clav: 1 },
    };
    spec.fingers = { L: c.reach.held ? 'ballGrip' : 'open', R: c.reach.held ? 'ballGrip' : 'open' };
  }
  out.spec = spec; out.clip = clip;
  return out;
}
export { D2R, smooth, ramp };
