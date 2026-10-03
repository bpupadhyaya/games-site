// The body animator: twelve mannequins, their hurleys and the per-player animation logic. No stage, no rendering: it only needs the view3d library,
// so the same code runs in the browser presenter and in Node (the contact test measures the real rig). It READS the sim state; it never writes to it.
import { buildHurlClips } from './clips.js';
import { BALL_VIS_R, HURLEY_SWEET } from './pitch.js';

export const DT = 1 / 60;
const SKINS = ['peach', 'clay', 'ivory', 'tan', 'brown', 'deep', 'wood', 'peach', 'tan', 'ivory', 'clay', 'brown'];
const HAIRS = ['black', 'brown', 'blond', 'ginger', 'black', 'black', 'brown', 'black', 'grey', 'brown', 'blond', 'black'];
const KITS = [
  { top: '#2f78e0', bottoms: '#f4f4f4', socks: '#2f78e0', trim: '#ffffff' },
  { top: '#e8a82a', bottoms: '#1d1d22', socks: '#e8a82a', trim: '#6b1f1f' },
];
const GK_KITS = [{ top: '#27b36a', bottoms: '#1d3a2a', socks: '#27b36a', trim: '#ffffff' }, { top: '#8a4fd0', bottoms: '#2a1d3a', socks: '#8a4fd0', trim: '#ffffff' }];
export const HELMET_COL = [0x2f78e0, 0xe8a82a];
export const GK_HELMET_COL = [0x27b36a, 0x8a4fd0];
const ACT_CLIP = { 'strike:hand': 'h_strike_hand', 'strike:ground': 'h_strike_ground', pass: 'h_pass', rise: 'h_rise', hook: 'h_hook' };
const CELEBRATE = ['celebrate_2', 'cheer', 'celebrate'];
const LOCO = { idle: 'h_idle', walk: 'h_walk', jog: 'h_jog', sprint: 'h_sprint' };
const LOCO_BAL = { idle: 'h_solo_idle', walk: 'h_solo_walk', jog: 'h_solo_jog', sprint: 'h_solo_sprint' };
const lerpAng = (a, b, t) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; };

export function createAnimator(V3, { base, lod = 0, onHuman = null } = {}) {
  const { loadHuman, THREE } = V3;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const A = { humans: [], hurleys: [], helmetM: [], st: [], events: [], ready: false };

  function helmetMount(h) {
    const f = h.boneFrame('Head');
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.left.normalize(), f.up.normalize(), f.fwd.normalize()));
    const box = h.headBox;
    const c = box ? box.getCenter(V()) : V(0.07, 0, 0);
    const upExt = box ? Math.max(box.max.dot(f.up), box.min.dot(f.up)) : 0.2;
    const top = c.clone().addScaledVector(f.up, upExt - c.dot(f.up));
    return new THREE.Matrix4().compose(top.addScaledVector(f.up, -0.115), q, V(0.92, 0.92, 0.92));
  }

  A.build = async function build() {
    A.ready = false;
    A.humans = []; A.hurleys = []; A.helmetM = []; A.st = [];
    for (let i = 0; i < 12; i++) {
      const team = i < 6 ? 0 : 1, gk = i % 6 === 0;
      const h = await loadHuman({ character: 'mannequin_m', base, kit: gk ? GK_KITS[team] : KITS[team], skin: SKINS[i], hair: HAIRS[i], legs: 'shorts', lod });
      h.groundClamp = 'auto'; h.footPlanting = true;
      buildHurlClips(h, undefined, i);
      const hurley = new THREE.Group(); hurley.userData.sweet = HURLEY_SWEET;   // an empty frame the library grips; the visible stick is instanced by the presenter
      h.attach(hurley, 'R', 'bat', { slide: 0.19 });
      A.helmetM.push(helmetMount(h));
      h.play('h_idle', { fade: 0, startPhase: (i * 0.37) % 1 });
      h.on('contact', (e) => { A.events.push({ i, clip: e.clip, time: e.time, act: A.st[i] ? A.st[i].act : -1 }); });
      A.humans.push(h); A.hurleys.push(hurley);
      A.st.push({ act: -1, state: 'idle', twoHand: false, yaw: team === 0 ? 0 : Math.PI, tp: 0 });
      if (onHuman) onHuman(h, i);
    }
    A.ready = true;
  };

  // one animation step at display time Tp. snapAt(arr, i, fallback) gives interpolated x / z / f; ballW is the interpolated ball in world coordinates.
  // only: optional Set of player ids to animate (the others are left alone).
  A.step = function step(s, Tp, dt, at, ballW, only = null) {
    const holderId = s.ball.holder;
    for (let i = 0; i < 12; i++) {
      if (only && !only.has(i)) continue;
      const p = s.players[i], h = A.humans[i], st = A.st[i];
      const px = at('x', i, p.x), pz = at('z', i, p.z);
      h.root.position.set(-px, 0, pz);
      const act = p.act && Tp <= p.act.t1 + 0.05 ? p.act : null;
      const faceSim = act ? act.bodyFace : at('f', i, p.face);
      const wantYaw = -faceSim;
      st.yaw = lerpAng(st.yaw, wantYaw, Math.min(1, dt * (act ? 18 : 14)));
      h.setFacing(st.yaw);
      const speed = Math.hypot(p.vx, p.vz);
      const carrying = holderId === i && s.ball.hs === 'bal';
      const inHand = holderId === i && s.ball.hs === 'hand';
      if (act && act.id !== st.act) {
        st.act = act.id;
        const key = act.kind === 'strike' ? `strike:${act.variant}` : act.kind;
        const clip = ACT_CLIP[key];
        if (act.kind === 'hook' && act.variant === 'dive') {
          // the keeper leaves the ground sideways: post() leans the whole body over (see below). side: +1 = towards the avatar's left
          const mx = -(act.stance.x - p.x), left = Math.cos(st.yaw), side = mx * left >= 0 ? 1 : -1;
          st.dive = { side, t0: act.t0, tc: act.tc, t1: act.t1 };
        }
        if (clip) {
          h.holdTwoHanded(A.hurleys[i], 'L', { gap: 0.1 }); st.twoHand = true;
          h.setFingers('R', 'batGrip');
          h.playTimed(clip, 'contact', Math.max(0.02, act.tc - Tp), { fade: 0.1, frameDt: dt });
          st.state = 'act';
        }
      }
      if (st.state === 'act') {
        if (act) h.setTarget('contact', act.c && Tp >= act.tc - 1e-6 ? V(-act.c.x, Math.max(act.c.y, BALL_VIS_R), act.c.z) : ballW);
        else { if (st.twoHand) { h.releaseSecondHand(); st.twoHand = false; } st.state = 'move'; }
      }
      const cele = s.phase === 'dead' && s.last && (s.last.kind === 'goal' || s.last.kind === 'point') && s.t - s.last.t > 0.25 && !act;
      if (cele) {
        if (st.state !== 'cele') { st.state = 'cele'; if (st.twoHand) { h.releaseSecondHand(); st.twoHand = false; } h.crossfade(p.team === s.last.team ? CELEBRATE[i % 3] : 'idle_relaxed', 0.3, { loop: true, startPhase: (i * 0.23) % 1 }); h.setReach('L', null); }
        h.lookAt(null); st.tp = Tp; h.layers.live && h.layers.live.setWeight(0.3, 0.2); continue;
      }
      if (st.state === 'cele') { st.state = 'move'; }
      if (p.stun > 0.3 && !act && st.state !== 'hit') { st.state = 'hit'; st.hitT = Tp + 0.6; h.crossfade('hit', 0.08, { loop: false }); }
      if (st.state === 'hit') { if (Tp < st.hitT) { st.tp = Tp; continue; } st.state = 'move'; }
      if (h.layers.live) h.layers.live.setWeight(st.state === 'act' ? 0 : speed < 0.5 ? 1 : 0.25, 0.25);
      if (st.state !== 'act') {
        if (st.twoHand) { h.releaseSecondHand(); st.twoHand = false; }
        h.locomote(speed, { set: carrying ? LOCO_BAL : LOCO });
        if (carrying) h.setTarget('contact', V(ballW.x, Math.min(ballW.y - BALL_VIS_R - 0.02, 0.74), ballW.z));
        h.setFingers('R', 'batGrip');
        st.state = 'move';
      }
      if (inHand && st.state !== 'act') h.setReach('L', ballW, { weight: 1 }); else h.setReach('L', null);
      h.lookAt(holderId === i ? null : ballW, { weight: 0.6, maxYaw: 1.1, maxPitch: 0.6 });
      st.tp = Tp;
    }
  };

  // A goalkeeper's dive: after the library has posed the body, tip the WHOLE body over about the pelvis (library rotateBody), launch off the ground, land on the
  // side, then scramble back up. The stick hands stay on the hook clip, so the contact fix below still puts the bas on the ball. Returns true while diving.
  A.DIVE_TC = 36;
  const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  A.post = function post(s, Tp, only = null) {
    for (let i = 0; i < 12; i++) {
      if (only && !only.has(i)) continue;
      const st = A.st[i], d = st.dive, h = A.humans[i];
      if (!d) continue;
      const tEnd = d.t1 + 0.42;
      if (Tp > tEnd || Tp < d.t0 - 0.02) { if (st.divePose) { V3.rotateBody(h, null); st.divePose = false; } if (Tp > tEnd) st.dive = null; continue; }
      let th;
      if (Tp <= d.tc) th = A.DIVE_TC * ease((Tp - d.t0 - 0.05) / (d.tc - d.t0 - 0.05));
      else if (Tp <= d.t1) th = A.DIVE_TC + (88 - A.DIVE_TC) * ease((Tp - d.tc) / 0.14);
      else th = 88 * (1 - ease((Tp - d.t1) / 0.4));
      const lie = Math.min(1, th / 88);
      const pv = h.bonePosition('Pelvis', V());
      const arc = Tp < d.tc ? 0.18 * Math.sin(Math.PI * Math.max(0, Math.min(1, (Tp - d.t0) / (d.tc - d.t0)))) : 0;
      const y = pv.y * (1 - lie) + 0.2 * lie + arc;
      V3.rotateBody(h, { pelvis: V(pv.x, y, pv.z), yaw: h.facing, pitch: 0, roll: -d.side * th });
      st.divePose = true;
    }
  };

  // After the library has posed the humans for this frame: make the contact exact. Where the arms cannot reach the sim's contact point, the body is
  // eased a little towards it (a few centimetres, for the frames right around the contact) and the pose is re-solved, so the bas (or palm) is on the ball at the contact tick.
  const sw = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  A.fix = function fix(s, Tp, ballW, only = null) {
    for (let i = 0; i < 12; i++) {
      if (only && !only.has(i)) continue;
      const p = s.players[i], a = p.act;
      if (!a || !(a.kind === 'strike' || a.kind === 'rise' || a.kind === 'hook' || a.kind === 'pass')) continue;
      const h = A.humans[i];
      const w = Math.abs(Tp - a.tc) < DT * 0.5 + 1e-6 ? 1 : 0;          // only the contact frame itself: a few centimetres, never a slide
      if (w > 0.001) {
      const hurley = A.hurleys[i];
      const probe = a.kind === 'pass' ? () => h.bonePosition('L_Hand', V()) : () => { hurley.updateWorldMatrix(true, false); return V(0, HURLEY_SWEET, 0).applyMatrix4(hurley.matrixWorld); };
      for (let it = 0; it < 6; it++) {
        const cur = probe();
        const tgt = a.c && Tp >= a.tc - 1e-6 ? V(-a.c.x, Math.max(a.c.y, BALL_VIS_R), a.c.z) : ballW;
        const d = tgt.clone().sub(cur);
        if (a.kind === 'pass') d.addScaledVector(d.clone().normalize(), -BALL_VIS_R * 0.9);
        const err = d.length(); if (globalThis.__dbg && (a.variant === "dive")) console.log("fix", i, it, a.kind, a.tc.toFixed(2), (Tp - a.tc).toFixed(3), w.toFixed(2), err.toFixed(3));
        if (err < 0.004) break;
        const k = Math.min(1, w * 1.0);
        h.root.position.x += d.x * k * 0.85; h.root.position.z += d.z * k * 0.85; const diving = a.variant === 'dive' && A.st[i].divePose;
        h.root.position.y = diving ? h.root.position.y + d.y * k * 0.85 : Math.max(-0.02, Math.min(0.06, h.root.position.y + d.y * k * 0.7));
        h.root.updateMatrixWorld(true);
        h._writePose(h._pose, false); h._post(0);
      }
      }
      A.clear(i);
    }
  };

  // Keep the hurley out of the player's own body: where the stick shaft would pass through the torso or pelvis, the pelvis (and with it the body) is eased a
  // few centimetres away from the shaft and the arms are re-solved onto the same hand targets. Limbs holding the stick are excluded.
  const segA = V(), segB = V(), segC = V(), segD = V();
  function closest(p1, q1, p2, q2, outA, outB) {
    const d1 = segC.copy(q1).sub(p1), d2 = segD.copy(q2).sub(p2), r = V().copy(p1).sub(p2);
    const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
    let s = 0, t = 0;
    if (a > 1e-9 && e > 1e-9) {
      const c = d1.dot(r), b = d1.dot(d2), den = a * e - b * b;
      s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
    outA.copy(p1).addScaledVector(d1, s); outB.copy(p2).addScaledVector(d2, t);
    return outA.distanceTo(outB);
  }
  const _pa = V(), _pb = V(), _bt = V(), _tp = V(), _hb2 = V(), _up3 = V(0, 0.03, 0);
  A.clear = function clear(i) {
    const h = A.humans[i], hurley = A.hurleys[i];
    for (let it = 0; it < (A.st[i].divePose ? 12 : 4); it++) {
      hurley.updateWorldMatrix(true, false);
      _bt.set(0, 0, 0).applyMatrix4(hurley.matrixWorld); _tp.set(0, 0.97, -0.17).applyMatrix4(hurley.matrixWorld);
      let worst = 0, wn = null, head = false;
      const hb = h.bonePosition('Head', V()); hb.y += 0.07;
      { const d = closest(_bt, _tp, hb, _hb2.copy(hb).add(_up3), _pa, _pb); const pen = 0.15 - d; if (pen > worst) { worst = pen; wn = _pb.clone().sub(_pa); head = true; } }
      for (const c of V3.capsulesOf(h)) {
        if (/hand|forearm|upper arm|head|neck|shoulder/.test(c.name)) continue;
        const d = closest(_bt, _tp, c.a, c.b, _pa, _pb);
        const pen = c.r + 0.02 - d;
        if (pen > worst) { worst = pen; wn = _pb.clone().sub(_pa); head = false; }
      }
      if (worst <= 0.006 || !wn) return;
      if (!head) wn.y = 0;
      if (wn.lengthSq() < 1e-8) return; wn.normalize();
      // the body moves away from the stick: along wn (from the stick towards the body axis)
      const move = Math.min(0.12, worst + 0.004);
      const pl = h.pelvis, wp = pl.getWorldPosition(V()).addScaledVector(wn, move);
      pl.parent.updateWorldMatrix(true, false);
      pl.position.copy(pl.parent.worldToLocal(wp));
      h._post(0);
    }
  };
  return A;
}
