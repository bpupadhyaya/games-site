// The bowlers: real 3D people (view3d athlete rig) in club whites, delivering with an authored pose-to-pose clip that is driven by the
// simulation's wind-up clock (state.windup.t): the bowl leaves the hand exactly when the sim launches it, so what you see is the
// sim. Poses use view3d's semantic bone offsets (degrees, character space: +Z forward, +X the avatar's left). Nothing here writes
// back to the game.
//
// ORDER (the prop-in-hand rule): stage.update(dt) first, THEN our pose overrides, THEN the held bowl is placed from the posed hand.
// Locomotion rule: stride phase is driven by the distance actually walked (speed -> clip rate), facing follows the heading.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const REL = 0.62;                // the release instant: equals the game's WINDUP seconds
const DUR = 2.5;

// -- the delivery: stance -> settle low -> backswing + step -> lunge and release low -> follow through -> recover
const READY = {
  Pelvis: { twist: 0, flex: 0, pos: [0, 0, 0] }, Spine: { flex: 4 }, Spine1: { flex: 2 }, Neck: { flex: -4 }, Head: { flex: 0 },
  R_UpperArm: { flex: 22, abduct: 5 }, R_Forearm: { flex: 70 }, L_UpperArm: { flex: 26, abduct: 7 }, L_Forearm: { flex: 74 },
  L_Thigh: { flex: 0, abduct: 3 }, L_Calf: { flex: 3 }, R_Thigh: { flex: 0, abduct: 3 }, R_Calf: { flex: 3 },
};
const SETTLE = {   // weight sinks, bowl comes down in front of the knees, eyes on the target
  Pelvis: { twist: 0, pos: [0, -0.12, 0.02] }, Spine: { flex: 14 }, Spine1: { flex: 8 }, Neck: { flex: -12 },
  R_UpperArm: { flex: 38, abduct: 4 }, R_Forearm: { flex: 38 }, L_UpperArm: { flex: 40, abduct: 8 }, L_Forearm: { flex: 52 },
  L_Thigh: { flex: 20 }, L_Calf: { flex: 34 }, R_Thigh: { flex: 14 }, R_Calf: { flex: 30 },
};
const BACK = {     // the pendulum goes back; the left foot reaches forward, body begins to lower
  Pelvis: { twist: -4, pos: [0, -0.22, 0.04] }, Spine: { flex: 26, twist: -4 }, Spine1: { flex: 14 }, Neck: { flex: -22 },
  R_UpperArm: { flex: -52, abduct: 5 }, R_Forearm: { flex: 6 }, L_UpperArm: { flex: 30, abduct: 30 }, L_Forearm: { flex: 24 },
  L_Thigh: { flex: 50 }, L_Calf: { flex: 36 }, R_Thigh: { flex: -2 }, R_Calf: { flex: 20 },
};
const LUNGE = {    // the release: deep lunge, front knee deep, trailing leg stretched back, arm swung through low beside the front knee
  Pelvis: { twist: 2, pos: [0, -0.56, 0.34] }, Spine: { flex: 50 }, Spine1: { flex: 30 }, Neck: { flex: -60 },
  R_UpperArm: { flex: -34, abduct: 3 }, R_Forearm: { flex: 4 }, L_UpperArm: { flex: -30, abduct: 62 }, L_Forearm: { flex: 20 },
  L_Thigh: { flex: 86, abduct: 2 }, L_Calf: { flex: 96 }, R_Thigh: { flex: -54 }, R_Calf: { flex: 4 },
};
const FOLLOW = {   // the arm carries on forward and up; the body holds the lunge, eyes follow the bowl
  Pelvis: { twist: 4, pos: [0, -0.5, 0.32] }, Spine: { flex: 38, twist: 3 }, Spine1: { flex: 22 }, Neck: { flex: -46 },
  R_UpperArm: { flex: 34, abduct: 8 }, R_Forearm: { flex: 10 }, L_UpperArm: { flex: -14, abduct: 60 }, L_Forearm: { flex: 20 },
  L_Thigh: { flex: 84 }, L_Calf: { flex: 92 }, R_Thigh: { flex: -52 }, R_Calf: { flex: 4 },
};
const RISE = {     // straightening back up, arm drifting down by the side
  Pelvis: { twist: 0, pos: [0, -0.14, 0.1] }, Spine: { flex: 16 }, Spine1: { flex: 8 }, Neck: { flex: -10 },
  R_UpperArm: { flex: 40, abduct: 10 }, R_Forearm: { flex: 20 }, L_UpperArm: { flex: 8, abduct: 24 }, L_Forearm: { flex: 20 },
  L_Thigh: { flex: 30 }, L_Calf: { flex: 32 }, R_Thigh: { flex: -10 }, R_Calf: { flex: 14 },
};

export function addDeliveryClip(V3, h) {
  const c = V3.buildClip(h, {
    name: 'lb_deliver', duration: DUR, base: 'idle_relaxed', fingers: 'relaxed', events: { release: REL },
    keys: [
      { t: 0, pose: READY },
      { t: 0.20, pose: SETTLE, ease: 'inOut' },
      { t: 0.42, pose: BACK, ease: 'inOut' },
      { t: REL, pose: LUNGE, ease: 'inOut' },
      { t: 1.0, pose: FOLLOW, ease: 'out' },
      { t: 1.65, pose: RISE, ease: 'inOut' },
      { t: DUR, pose: READY, ease: 'inOut' },
    ],
    // feet are placed with IK so the stance reads: the left foot steps onto the front of the mat, the right trails behind with the toe low
    ik: {
      L_Foot: { keys: [
        { t: 0, pos: [0.1, 0.09, 0.2] }, { t: 0.2, pos: [0.1, 0.09, 0.2] }, { t: 0.42, pos: [0.1, 0.17, 0.3], ease: 'inOut' },
        { t: REL, pos: [0.1, 0.09, 0.42], ease: 'out' }, { t: 1.65, pos: [0.1, 0.09, 0.4], ease: 'inOut' }, { t: DUR, pos: [0.1, 0.09, 0.2], ease: 'inOut' } ] },
      R_Foot: { keys: [
        { t: 0, pos: [-0.1, 0.09, -0.04] }, { t: 0.2, pos: [-0.1, 0.09, -0.06] }, { t: 0.42, pos: [-0.11, 0.09, -0.16], ease: 'inOut' },
        { t: REL, pos: [-0.12, 0.1, -0.5], ease: 'inOut' }, { t: 1.65, pos: [-0.12, 0.1, -0.44], ease: 'inOut' }, { t: DUR, pos: [-0.1, 0.09, -0.04], ease: 'inOut' } ] },
      R_Hand: { keys: [
        { t: 0, pos: [-0.14, 0.9, 0.3] }, { t: 0.42, pos: [-0.18, 0.7, -0.35], ease: 'inOut' }, { t: REL, pos: [-0.14, 0.1, 0.62], ease: 'inOut' }, { t: 1.0, pos: [-0.14, 0.5, 0.95], ease: 'out' }, { t: 1.6, pos: [-0.2, 0.7, 0.3], ease: 'inOut' } ],
        weight: [{ t: 0, v: 0 }, { t: 0.36, v: 0 }, { t: 0.5, v: 1 }, { t: 1.0, v: 1 }, { t: 1.5, v: 0 }] },
    },
  });
  h.addClip(c);
  return c;
}

// short white sleeves + shoulder caps riding on the bones (the athlete wears a tank top)
function addSleeves(V3, h, color) {
  const { THREE } = V3;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
  for (const sd of ['L', 'R']) {
    const up = h.bones[`Bip01_${sd}_UpperArm`], fo = h.bones[`Bip01_${sd}_Forearm`];
    if (!up || !fo) continue;
    const dir = fo.position.clone(), len = dir.length(); dir.normalize();
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.068, len * 0.5, 18, 1, true), mat);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.position.copy(dir).multiplyScalar(len * 0.25); g.castShadow = true;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.073, 14, 10), mat); cap.castShadow = true;
    const grp = new THREE.Group(); grp.add(g, cap); up.add(grp);
  }
}

export function createFigures(V3, stage, o) {
  const { kit, qs, R_BOWL } = o;
  const { THREE } = V3;
  const F = { ready: false, list: {}, update() {}, failed: false };
  const MAT = { x: -0.17, z: 0.62 };              // where the active bowler stands (front foot on the mat), three coordinates
  const WAIT = { x: -2.1, z: 1.4 };          // where the other one waits

  async function build() {
    const mk = (spec) => V3.loadHuman({ ...spec, lod: 'auto', quality: o.quality });
    const [m, f] = await Promise.all([
      mk({ character: 'athlete_m', kit: { top: '#f7f5ee', bottoms: '#f1efe7', socks: '#f6f6f2', shoes: '#ecebe4' }, skin: 'light', hair: 'grey' }),
      mk({ character: 'athlete_f', kit: { top: '#f7f5ee', bottoms: '#efede5', socks: '#f6f6f2', shoes: '#ecebe4' }, skin: 'light', hair: 'brown' }),
    ]);
    for (const [id, h, hat] of [['m', m, 0xf4f2ea], ['f', f, 0xf0e7d0]]) {
      h.groundClamp = 'auto'; h.footPlanting = !qs.has('nofp');
      stage.add(h); stage.track(h);
      if (h.setLOD) h.setLOD(0);
      try { V3.addCap(h, { color: hat }); } catch { /* ignore */ }
      addSleeves(V3, h, 0xf7f5ee);
      const clip = addDeliveryClip(V3, h);
      const bowl = kit.make(id === 'm' ? 0 : 1, R_BOWL);
      bowl.visible = false;
      stage.scene.add(bowl);
      const fig = { id, h, clip, bowl, holding: false, mode: 'idle', since: 99, pos: { x: id === 'm' ? MAT.x : WAIT.x, z: id === 'm' ? MAT.z : WAIT.z }, yaw: Math.PI };
      h.setPosition(fig.pos.x, 0, fig.pos.z); h.setFacing(Math.PI);
      h.play('idle_relaxed', { fade: 0 });
      F.list[id] = fig;
    }
    F.ready = true; stage.invalidate();
  }
  F.loading = build().then(() => true).catch((e) => { console.warn('bowlers unavailable', e); F.failed = true; return false; });

  const hp = new THREE.Vector3();
  const holdBowl = (fig, on) => { fig.holding = on; fig.bowl.visible = on; };
  // the held bowl sits in the posed right hand (cradled: under the palm)
  function placeHeld(fig) {
    if (!fig.holding) return;
    fig.h.root.updateMatrixWorld(true);
    fig.h.handPosition('R', hp);
    fig.bowl.position.set(hp.x, hp.y - R_BOWL * 0.6, hp.z);
    fig.bowl.rotation.set(0, fig.yaw, 0);
  }

  function walkTo(fig, tgt, dt) {
    const dx = tgt.x - fig.pos.x, dz = tgt.z - fig.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.04) return 0;
    const sp = Math.min(1.5, 0.6 + d * 0.8);
    const step = Math.min(d, sp * dt);
    fig.pos.x += (dx / d) * step; fig.pos.z += (dz / d) * step;
    const want = Math.atan2(dx, dz);
    let da = want - fig.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
    fig.yaw += da * Math.min(1, dt * 8);
    return sp;
  }

  F.update = ({ state, inPlay, dt, wall }) => {
    if (!F.ready) return;
    const att = !inPlay ? state.att : null;
    const FIGT = qs.get('fig');             // QA: ?fig=<seconds into the delivery> freezes the delivery at that instant
    const wu = FIGT !== null ? { t: Number(FIGT), dur: REL, side: 0 } : inPlay ? state.windup : att && att.windup;
    const side = inPlay ? (wu ? wu.side : state.m ? state.m.turn : 0) : (att ? att.side : 0);
    const active = F.list[side === 1 ? 'f' : 'm'], other = F.list[side === 1 ? 'm' : 'f'];
    const hidden = !inPlay && !att && FIGT === null;
    for (const f of Object.values(F.list)) f.h.root.visible = !hidden;
    if (hidden) return;
    const mdt = state.paused ? 0 : (dt > 0 ? dt : wall);
    // ---- where each one stands: the active bowler on the mat, the other waits at the side
    for (const [fig, tgt] of [[active, MAT], [other, WAIT]]) {
      const delivering = fig === active && (wu || fig.since < DUR);
      let speed = 0;
      if (!delivering) {
        speed = walkTo(fig, tgt, mdt);
        if (!speed) {
          let da = Math.PI - fig.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
          fig.yaw += da * Math.min(1, mdt * 5);
        }
      }
      fig.h.setPosition(fig.pos.x, 0, fig.pos.z);
      fig.h.setFacing(fig.yaw);
      fig.speed = speed;
    }
    // ---- clips
    for (const fig of [active, other]) {
      const h = fig.h;
      let clipT = -1;
      if (fig === active && wu) { clipT = wu.t; fig.since = 0; }
      else if (fig === active && fig.since < DUR) { fig.since += mdt; clipT = REL + fig.since; if (clipT >= DUR) fig.since = 99; }
      if (clipT >= 0 && clipT < DUR) {
        if (fig.mode !== 'deliver') { h.play('lb_deliver', { fade: 0.25, loop: false }); fig.mode = 'deliver'; }
        const tr = h.layers.base.current;
        if (tr && tr.clip && tr.clip.name === 'lb_deliver') { tr.speed = 0; tr.time = clamp(clipT, 0, DUR - 1e-3); }
      } else if (fig.speed > 0) {
        if (fig.mode !== 'walk') { h.play('walk', { fade: 0.25, loop: true }); fig.mode = 'walk'; }
        const tr = h.layers.base.current; if (tr && tr.clip && tr.clip.name === 'walk') tr.speed = clamp(fig.speed / 1.4, 0.4, 1.3);
      } else if (fig.mode !== 'idle') { h.play('idle_relaxed', { fade: 0.35, loop: true }); fig.mode = 'idle'; }
    }
    // the bowl is in the hand until the instant of release (the sim's launch)
    const ph = inPlay && state.m ? state.m.phase : '';
    const aiming = inPlay && (ph === 'aim' || ph === 'jack') && !wu;
    holdBowl(active, !!(wu && wu.t < REL) || aiming || (!inPlay && !!att && !wu && active.since > 40));
    holdBowl(other, false);
    // ---- advance the rig with the game's clock, THEN place props from the posed bones
    stage.update(mdt, { renderNow: false });
    placeHeld(active);
  };
  F.MAT = MAT; F.WAIT = WAIT;
  return F;
}
