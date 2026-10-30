// Rider mounting: puts a view3d Human on the horse. The pelvis sits on the saddle (seat point follows the spine bone), the feet go to the stirrup treads,
// the hands to the rein targets (IK, solved in world space every frame), and a seat clip per gait/style tilts the torso. The rider is advanced by the horse:
// add the human to the stage with stage.add(human) but do NOT stage.track() it (horse.update(dt) drives human.update).
import * as THREE from './three.js';
import { buildClip } from './author.js';
import { makeWesternHat } from './horsetack.js';

const V3 = THREE.Vector3;
const SEAT = {
  // pelvis drop below the seat plane, stirrup ankle drop from the seat, leg flex, hands in the saddle frame (x left, y up, z forward)
  western:      { seat: 0.80, ankle: 0.66, thigh: 58, calf: 80, abduct: 26, lean: [0, 6, 14], L: [0.05, 0.30, 0.34], R: [-0.23, 0.10, 0.08], pole: 0.30 },
  english:      { seat: 0.80, ankle: 0.62, thigh: 66, calf: 86, abduct: 22, lean: [0, 8, 18], L: [0.10, 0.28, 0.40], R: [-0.10, 0.28, 0.40], pole: 0.26 },
  centralasian: { seat: 0.80, ankle: 0.58, thigh: 74, calf: 90, abduct: 26, lean: [0, 8, 18], L: [0.06, 0.30, 0.40], R: [-0.28, 0.30, 0.26], pole: 0.30 },
  ottoman:      { seat: 0.80, ankle: 0.56, thigh: 76, calf: 94, abduct: 26, lean: [0, 6, 14], L: [0.07, 0.30, 0.36], R: [-0.07, 0.30, 0.36], pole: 0.26 },
  jockey:       { seat: 0.66, ankle: 0.48, thigh: 92, calf: 102, abduct: 18, lean: [24, 34, 44], L: [0.09, 0.22, 0.52], R: [-0.09, 0.22, 0.52], pole: 0.24, hover: 0.14 },
};

function seatClip(human, name, style, lean) {
  const S = style;
  const legs = { L_Thigh: { flex: S.thigh, abduct: S.abduct }, R_Thigh: { flex: S.thigh, abduct: S.abduct }, L_Calf: { flex: S.calf }, R_Calf: { flex: S.calf } };
  const c = buildClip(human, {
    name, duration: 2, loop: true, base: 'rest', grounded: false, fingers: 'relaxed',
    keys: [
      { t: 0, pose: { ...legs, Pelvis: { flex: 4 + lean * 0.4 }, Spine: { flex: 2 + lean * 0.3 }, Spine1: { flex: 2 + lean * 0.3 }, Spine2: { flex: 2 + lean * 0.3 }, Neck: { flex: -4 - lean * 0.2 }, Head: { flex: -3 } } },
      { t: 1, pose: { Spine1: { flex: 3.5 + lean * 0.3 } }, ease: 'inOut' },
      { t: 2, pose: { Spine1: { flex: 2 + lean * 0.3 } }, ease: 'inOut' },
    ],
  });
  human.addClip(c);
  return c;
}

export function attachRiderTo(horse, human, o = {}) {
  const styleName = o.style || (horse.tackStyle && SEAT[horse.tackStyle] ? horse.tackStyle : 'western');
  const S = SEAT[styleName] || SEAT.western;
  if (!horse.tack) horse.setTack(o.tack || (styleName === 'jockey' ? 'jockey' : styleName));
  human.groundClamp = 'off'; human.footPlanting = false;
  const clips = ['ride', 'ride_fast', 'ride_deep'].map((n, i) => { const nm = `${n}_${styleName}`; if (!human.clips[nm]) seatClip(human, nm, S, S.lean[i]); return nm; });
  human.play(clips[0], { fade: 0 });
  let hat = null;
  if ((o.hat ?? (styleName === 'western')) && human.bones.Bip01_Head) { hat = makeWesternHat(o.hatColor || '#d8c294'); human.bones.Bip01_Head.add(hat); }
  const st = { cur: clips[0], q: new THREE.Quaternion(), init: false, tmpV: new V3() };
  const api = {
    human, style: styleName, S,
    retune() {},
    update(dt) {
      const tack = horse.tack;
      const root = horse.root;
      root.updateMatrixWorld(true);
      const spine = horse.b.Spine2;
      // body orientation (world) of the horse's back, low-passed so the rider absorbs the bounce
      const qb = spine.getWorldQuaternion(new THREE.Quaternion());
      if (!st.init) { st.q.copy(qb); st.init = true; }
      st.q.slerp(qb, Math.min(1, dt * 14));
      const up = new V3(0, 1, 0).applyQuaternion(st.q);
      const seatW = tack ? tack.saddle.getWorldPosition(new V3()) : spine.getWorldPosition(new V3()).add(new V3(0, 0.2, 0).applyQuaternion(qb));
      seatW.addScaledVector(up, 0.06 + (S.hover || 0));
      human.root.position.copy(seatW).addScaledVector(up, -S.seat);
      human.root.quaternion.copy(st.q);
      human.root.updateMatrixWorld(true);
      // seat clip by speed
      const v = horse.v;
      let want = clips[0];
      if (styleName === 'jockey') want = v > 3 ? clips[2] : clips[1];
      else if (v > 9) want = clips[2]; else if (v > 5) want = clips[1];
      if (want !== st.cur) { human.play(want, { fade: 0.35 }); st.cur = want; }
      // stirrups -> ankles; hands -> reins
      if (tack) {
        for (const side of ['L', 'R']) {
          const w = tack.stirrup[side].tread.getWorldPosition(new V3());
          human.setReachFoot(side, w.addScaledVector(up, 0.08), 1);
        }
        const saddle = tack.saddle;
        const tgt = {};
        for (const side of ['L', 'R']) {
          const p = S[side];
          const w = new V3(p[0], p[1], p[2]).applyMatrix4(saddle.matrixWorld);
          const sg = side === 'L' ? 1 : -1;
          const pole = new V3(sg * S.pole * 1.4, -0.12, -0.35).applyQuaternion(st.q).add(w);
          human.setReach(side, w, { weight: 1, pole });
          tgt[side] = w.clone().applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert());
        }
        // reins end at the hand that holds them; the free hand (western) holds none
        tack.handTargets.L = tgt.L; tack.handTargets.R = styleName === 'western' ? null : tgt.R;
      }
      human.update(dt);
    },
    dispose() { if (hat) hat.removeFromParent(); human.setReachFoot('L', null); human.setReachFoot('R', null); human.setReach('L', null); human.setReach('R', null); if (horse.tack) { horse.tack.handTargets.L = null; horse.tack.handTargets.R = null; } human.groundClamp = 'auto'; human.footPlanting = true; },
  };
  return api;
}
