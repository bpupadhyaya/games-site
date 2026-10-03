// An authored fielding dive. Pure pose function: (time relative to the take, ball point) -> one rig.solve spec. Nothing here keeps a clock.
// tau < 0: the launch (0.30 s before the hands meet the ball); 0 <= tau: slide, then rise (0.64 s after the take the next action begins).
// The trunk goes near horizontal, the legs trail (one straight, one bent), the near arm reaches to the ball exactly, the far arm counterbalances.
import { V3, clamp, lerp } from './rig.js';
import { ramp } from './util3.js';

export const DIVE = { launch: 0.30, land: 0.20, total: 0.64 };

// standY: pelvis height when standing (measured by the caller); loco: the figure arrives running (the launch blends from the run pose)
export function diveSpec({ x, z, yaw, tgt, tau, standY, ankleH, loco, launch = DIVE.launch }) {
  const fwd = new V3(Math.sin(yaw), 0, Math.cos(yaw)), lat = new V3(Math.cos(yaw), 0, -Math.sin(yaw));   // lat = avatar left
  const root = new V3(x, 0, z);
  const D = Math.hypot(tgt.x - x, tgt.z - z);
  const p = ramp(tau, -launch, 0);                         // 0 at take-off, 1 at the take
  const settle = ramp(tau, 0, DIVE.land);                       // landing on the ground after the take
  const rise = ramp(tau, DIVE.land, DIVE.total);                // getting up
  const pitchC = lerp(0.8, 1.38, clamp((D - 0.4) / 0.8, 0, 1));   // trunk lean at the take (rad); ~1.4 = nearly flat
  const hOff = 0.5 * Math.sin(pitchC) + 0.52;                    // pelvis -> hand, horizontal
  const py = Math.max(0.36, tgt.y + 0.22);
  // pelvis path: stand -> take (arc) -> slide forward a little and settle -> rise to standing at the landing place
  const Pc = new V3(tgt.x - fwd.x * hOff, py, tgt.z - fwd.z * hOff);
  const Pl = new V3(Pc.x + fwd.x * 0.28, Math.max(0.27, py - 0.1), Pc.z + fwd.z * 0.28);
  const Pe = new V3(Pl.x + fwd.x * 0.1, standY * 0.98, Pl.z + fwd.z * 0.1);
  const P = Pc.clone().lerp(Pl, settle).lerp(Pe, rise);
  // the body hangs a little higher in the middle of the launch (a flight arc)
  const arc = Math.sin(Math.PI * clamp((tau + launch) / launch, 0, 1)) * (tau < 0 ? 0.1 : 0);
  P.y += arc;
  const pitch = lerp(lerp(pitchC, pitchC * 0.96, settle), 0.42, rise) * p;
  // feet: trail behind (one straight, one bent up), then come under the body as it rises
  const trailL = P.clone().addScaledVector(fwd, -0.80).addScaledVector(lat, 0.13); trailL.y = Math.max(ankleH + 0.02, P.y - 0.22);
  const trailR = P.clone().addScaledVector(fwd, -0.52).addScaledVector(lat, -0.14); trailR.y = P.y + 0.04;
  const stdL = Pe.clone().addScaledVector(lat, 0.16).addScaledVector(fwd, -0.05); stdL.y = ankleH;
  const stdR = Pe.clone().addScaledVector(lat, -0.16).addScaledVector(fwd, 0.14); stdR.y = ankleH;
  const fl = trailL.lerp(stdL, rise), fr = trailR.lerp(stdR, rise);
  const wf = loco ? p : Math.max(p, 0.0);
  const feetPitch = lerp(-0.9, 0, rise);
  const spec = {
    x, z, yaw,
    pelvis: { pos: P, w: p, pitch: pitch * 0.4 },
    spine: { pitch: pitch * 0.6, yaw: 0, roll: 0 },
    feet: {
      L: { p: fl, yaw, pitch: feetPitch * p, pole: fl.clone().add(new V3(0, 0.6, 0)), w: wf },
      R: { p: fr, yaw, pitch: feetPitch * p, pole: fr.clone().addScaledVector(fwd, 0.4).add(new V3(0, 0.5, 0)), w: wf },
    },
  };
  // hands: the reaching hand is on the ball until the body rises, then the ball comes to the chest; the other arm swings out for balance
  const chest = Pe.clone().addScaledVector(fwd, 0.32); chest.y = standY + 0.18;
  const hold = tgt.clone().lerp(chest, ramp(rise, 0.35, 1));
  const far = P.clone().addScaledVector(fwd, 0.55 * Math.sin(pitchC)).addScaledVector(lat, 0.42); far.y = P.y + 0.12 + 0.3 * rise;
  const farHome = P.clone().addScaledVector(fwd, 0.25).addScaledVector(lat, 0.25); farHome.y = standY + 0.1;
  spec.hands = {
    R: { p: hold, pole: hold.clone().addScaledVector(lat, -0.5).add(new V3(0, 0.3, 0)), clav: 1, w: p },
    L: { p: far.lerp(farHome, rise), pole: P.clone().addScaledVector(lat, 0.6).add(new V3(0, 0.4, 0)), clav: 1, w: p * 0.9 },
  };
  return { spec, p, pitch, P };
}
