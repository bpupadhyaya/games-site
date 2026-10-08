// The hopper's body: every pose is a pure function of the engine state (via src/motion.js), solved with two-bone IK through actor.js.
// Hops land exactly on the planned beat; the free leg folds up behind; arms balance; the torso leans into each hop; a pick-up bends
// from the hips with the free leg lifted behind; a foul ends in a stumble; the toss is an underarm swing that releases on the throw.
import { THREE } from '../vendor3d/index.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

/**
 * c = { H (hopperAt), A (Actor), k (body scale), ti (idle clock), ph (idle phase), tejo: Vector3|null, look: Vector3, onGround, hold: bool, stage: 'toss'|'run'|'idle' }
 * Returns the P object for Actor.apply.
 */
export function hopperPose(c) {
  const { H, A, k, ti, ph, look } = c;
  const yaw = H.yaw, sin = Math.sin(yaw), cos = Math.cos(yaw);
  const g = A.groundAnkle;
  const W = (lx, lz) => [H.x + lx * cos + lz * sin, H.z - lx * sin + lz * cos];
  const dirW = (lx, ly, lz) => [lx * cos + lz * sin, ly, -lx * sin + lz * cos];
  const standY = A.pelvisRest.y - 0.032 * k;
  const breath = Math.sin(ti * 1.7 + ph);
  const sway = Math.sin(ti * 0.8 + ph * 1.7);
  const air = H.air > 0 && H.air < 1;

  // ---- crouch: absorb the landing, load for the take-off -----------------------------------------------------------------------------------
  let cr = 0;
  if (H.sinceLand !== undefined && H.sinceLand >= 0) cr = Math.max(cr, 0.065 * k * (1 - smooth(H.sinceLand / 0.2)));
  if (H.next && H.next.k !== 'pick' && !air) {
    const toTake = H.next.t - 0.34 - c.tD;
    if (toTake < 0.16 && toTake > -0.01) cr = Math.max(cr, 0.06 * k * smooth(1 - toTake / 0.16));
  }
  if (air) cr = 0.02 * k * Math.sin(Math.PI * H.air) * 0 + 0;
  const bend = H.bend || 0, stumble = H.stumble || 0;
  const celeb = H.celebrate || 0;
  const bounce = celeb > 0 ? 0.045 * k * Math.abs(Math.sin(ti * 7)) * celeb : 0;
  let pelY = standY - cr + H.y + bounce - 0.085 * k * smooth(bend) - 0.05 * k * stumble;
  // pelvis position (a little back during a bend, forward lean when hopping)
  let pl = -0.17 * k * smooth(bend);
  const [ppx, ppz] = W(0.012 * k * sway, pl);
  const pel = V(ppx, pelY, ppz);

  // ---- feet ---------------------------------------------------------------------------------------------------------------------------------
  const legs = {};
  const lateral = H.pairStance ? 0.16 * k : 0.095 * k;
  const supp = H.supp;                        // 'B' | 'L' | 'R'
  const footY = g + H.y;
  const aim = (extra = 1) => ({ n: [0, -1, 0], face: 'sole', fwd: [sin, 0, cos], w: extra });
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    let lx = sx * lateral, lz = side === 'L' ? 0.015 * k : -0.015 * k, ly = footY, pole = [0, 0.1, 1], aimv = aim(1);
    if (supp !== 'B') {
      if (supp === side) { lx = sx * 0.02 * k; lz = 0.0; ly = footY; }
      else {                                   // the free leg folds up behind
        const lift = air ? 0.31 : 0.27, back = air ? -0.24 : -0.21;
        const swing = air ? Math.sin(Math.PI * H.air) * 0.03 : 0;
        lx = sx * 0.075 * k; lz = (back - swing) * k; ly = footY + lift * k; pole = [0, -0.1, 1];
        aimv = { n: [0, -0.2, -1].map((v, i) => v), face: 'sole', fwd: [sin * 0, 1, 0], w: 0.0 };
      }
      if (bend > 0 && supp !== side) { const b = smooth(bend); lz = lerp(lz, -0.42 * k, b); ly = lerp(ly, g + 0.36 * k, b); lx = sx * 0.07 * k; }
    } else if (air) {
      ly = footY + 0.09 * k * Math.sin(Math.PI * H.air);       // two-foot jump: knees up a little
    }
    if (H.landSplit && (H.supp === 'B')) { /* reserved */ }
    if (stumble > 0) {
      const w = Math.sin((H.stumbleT || 0) * 11) * (1 - smooth((H.stumbleT || 0) / 1.2));
      if (supp === 'B' || supp === side) { lz += 0.05 * k * stumble; lx += sx * 0.04 * k * stumble + 0.03 * k * w; }
      else { ly = footY + 0.12 * k * stumble; lz = -0.12 * k * stumble; }
    }
    const [wx, wz] = W(lx, lz);
    const pw = dirW(...pole);
    legs[side] = { p: [wx, ly, wz], f: 'w', w: 1, pole: pw, pf: 'w', aim: aimv.w > 0 ? aimv : undefined };
  }
  // pair landings: feet to the world points of the two halves (the engine tells where) are applied by the presenter through H.feet if present
  if (H.feet) for (const side of ['L', 'R']) if (H.feet[side]) { legs[side].p = [H.feet[side].x, footY + (air ? 0.09 * k * Math.sin(Math.PI * H.air) : 0), H.feet[side].z]; }

  // ---- arms ---------------------------------------------------------------------------------------------------------------------------------
  const arms = {};
  const th = H.toss;
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    let p = [sx * 0.24 * k, 0.02 * k, 0.1 * k], pole = [sx * 0.3, -1, -0.2];
    if (c.stage === 'toss' || th >= 0) {
      if (side === 'R') {
        // underarm toss: hold at the chest, swing back, release forward and up
        const holdP = [-0.12 * k, 0.12 * k, 0.34 * k], windP = [-0.22 * k, 0.0, -0.3 * k], relP = [-0.14 * k, 0.16 * k, 0.62 * k], followP = [-0.1 * k, 0.5 * k, 0.5 * k];
        const mix = (a, b, u) => a.map((v, i) => lerp(v, b[i], u));
        if (th < 0) p = holdP;
        else if (th < 0.55) p = mix(holdP, windP, smooth(th / 0.55));
        else if (th < 1) p = mix(windP, relP, smooth((th - 0.55) / 0.45));
        else p = mix(relP, followP, smooth((th - 1) / 0.4));
        pole = [-0.3, -1, -0.1];
      } else { p = [0.22 * k, 0.08 * k, 0.22 * k]; pole = [0.3, -1, -0.1]; }
    } else if (celeb > 0) {
      const w = Math.sin(ti * 9 + (sx > 0 ? 0 : 1.6)) * 0.04 * k;
      p = [sx * (0.2 * k + w), lerp(0.02 * k, 0.78 * k, celeb), lerp(0.1 * k, 0.12 * k, celeb)]; pole = [sx * 0.9, -0.1, -0.2];
    } else if (bend > 0 && c.tejo && side === 'R' && H.next && H.next.k === 'pick' || (bend > 0 && c.tejo && side === 'R' && H.pickReach)) {
      p = null;
    } else if (H.supp !== 'B' || air || H.next) {
      // balance: arms out to the sides, a little forward, counter-swinging with the hop
      // two feet down: relaxed, hands at the hips, slightly forward (ready to spring); on one foot or in the air: elbows bent, hands out and a little up
      const sw = air ? Math.sin(Math.PI * H.air) : 0, one = H.supp !== 'B' ? 1 : 0, rdy = Math.sin(ti * 2.1 + ph) * 0.012;
      p = [sx * (0.30 + 0.10 * one + 0.08 * sw) * k, (0.0 + 0.16 * one + 0.12 * sw + rdy) * k, (0.15 + 0.03 * sw) * k]; pole = [sx * 0.8, -0.7, -0.5];
    }
    if (stumble > 0 && !celeb) {
      const w = Math.sin((H.stumbleT || 0) * 12) * (1 - smooth((H.stumbleT || 0) / 1.1));
      const hold = 1 - smooth(((H.stumbleT || 0) - 0.7) / 0.9);       // the flail settles into arms hanging, a disappointed shrug
      const sp = [sx * (0.46 + 0.12 * w) * k, (0.26 + 0.2 * stumble * Math.abs(w)) * k, (-0.02 + 0.1 * w * sx) * k], rl = [sx * 0.27 * k, -0.02 * k, 0.1 * k];
      p = sp.map((v, i) => lerp(rl[i], v, hold)); pole = [sx * 0.9, -0.5, -0.3];
    }
    if (p) arms[side] = { p, f: 'b', w: 1, pole, pf: 'b' };
  }
  if (bend > 0 && c.tejo) {
    const b = smooth(bend);
    arms.R = { p: [c.tejo.x, 0.07 * k + 0.1 * (1 - b), c.tejo.z], f: 'w', w: b, pole: [-0.5, -1, 0], pf: 'b' };
    arms.L = { p: [0.42 * k, 0.05 * k, -0.34 * k], f: 'b', w: 1, pole: [0.6, -0.5, -0.5], pf: 'b' };
  }

  // ---- torso and head -----------------------------------------------------------------------------------------------------------------------
  let tb = 3 + breath * 0.8, ts = sway * 1.2, tt = 0;
  if (H.next && H.next.k !== 'pick' && !air) tb += 4 * (cr / (0.06 * k + 1e-6));
  if (air) tb = 9 + 5 * Math.sin(Math.PI * H.air);
  if (th >= 0) { tb = lerp(10, 16, smooth(th / 1)); tt = th < 0.55 ? lerp(0, 22, smooth(th / 0.55)) : lerp(22, -26, smooth((th - 0.55) / 0.45)); if (th > 1) tt = lerp(-26, -10, smooth((th - 1) / 0.4)); }
  tb = lerp(tb, 74, smooth(bend));
  if (celeb > 0) { tb = lerp(tb, -4, celeb); ts = lerp(ts, 3 * Math.sin(ti * 9), celeb); }
  if (stumble > 0) { tb = lerp(tb, 26 + 6 * Math.sin((H.stumbleT || 0) * 10) * (1 - smooth((H.stumbleT || 0) / 1.2)), stumble); ts = lerp(ts, 12 * Math.sin((H.stumbleT || 0) * 9) * (1 - smooth((H.stumbleT || 0) / 1.2)), stumble); if (H.stumbleT > 0.5) tb = lerp(tb, 32, smooth((H.stumbleT - 0.5) / 0.6)); }
  const lookW = bend > 0.3 ? 0.4 : 0.85;
  return {
    pelvis: pel, yaw, pitch: 0, roll: 0, groundY: 0,
    torso: { bend: tb, side: ts, twist: tt },
    pelvisTilt: { bend: bend > 0 ? 6 * smooth(bend) : 0, side: sway * 1.0, twist: 0 },
    legs, arms,
    look: look ? { target: look, w: lookW } : null,
    out: { air, cr },
  };
}
