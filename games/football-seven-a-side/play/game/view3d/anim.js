// The per-player driver: base locomotion (clips), a live idle layer, head tracking, and the procedural contact poses (techs.js) layered on top.
// Everything here is a function of the sim state and of the render time T, so a paused match freezes exactly and a headless run is reproducible.
//
// Contact timing. The sim launches a kick inside tick `tck` BEFORE it moves the ball, so the ball is still at the contact position in the state of
// tick tck-1; that state is the contact frame (tcont = (tck - 1) * STEP). A dribble touch is decided after the ball moved, so its contact frame is
// the state of tick tck itself. Tackles, headers and saves follow their own events the same way.
import { buildClip, solvePalmBall, palmPoint, penetration } from '../vendor3d/index.js';
import { STEP, BR } from '../src/consts.js';
import { Actor } from './actor.js';
import { TECH, evalPose } from './skills.js';
import './techs.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TECH_OF_KICK = { pass: 'pass', through: 'through', lob: 'lob', cross: 'cross', shot: 'shot', clear: 'clear', volley: 'volley', gk: 'clear', throw: 'throw' };

const _vp = { v: null };
// the nearest vertex of the visible body mesh among those mostly bound to bones matching `re`; returns { d, p } (p is a world Vector3, shared scratch)
function nearestPart(THREE, h, re, pt, cacheKey) {
  let mesh = h._vmesh;
  if (!mesh || !mesh.visible) { mesh = null; h.root.traverse((o) => { if (o.isSkinnedMesh && o.visible) mesh = o; }); h._vmesh = mesh; h._pidx = {}; }
  const pos = mesh.geometry.attributes.position, si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight, bones = mesh.skeleton.bones;
  let idx = h._pidx[cacheKey];
  if (!idx) {
    idx = [];
    for (let i = 0; i < pos.count; i++) { let bi = 0, bw = -1; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); bi = si.getComponent(i, k); } if (re.test(bones[bi].name)) idx.push(i); }
    h._pidx[cacheKey] = idx;
  }
  h.root.updateMatrixWorld(true); mesh.skeleton.update();
  const v = _vp.v || (_vp.v = new THREE.Vector3()), best = _vp.b || (_vp.b = new THREE.Vector3());
  let bd = 1e9;
  for (let k = 0; k < idx.length; k++) { mesh.getVertexPosition(idx[k], v); v.applyMatrix4(mesh.matrixWorld); const d = v.distanceTo(pt); if (d < bd) { bd = d; best.copy(v); } }
  return { d: bd, p: best };
}

export function createDriver({ THREE, humans, specs, ball, BALL_R, hash }) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const D = {};
  const crew = humans.map((h, i) => {
    // additive life: breathing, weight shift, torso sway, a head that drifts, arms that are never mirror images; a different phase and speed per player
    const live = (u) => ({
      Pelvis: { pos: [0.04 * Math.sin(u * 6.283), 0.014 * Math.abs(Math.sin(u * 12.566)) - 0.005, 0.006 * Math.sin(u * 6.283 + 1)], side: 2.4 * Math.sin(u * 6.283) },
      Spine1: { twist: 4 * Math.sin(u * 6.283 + 0.7), side: -2 * Math.sin(u * 6.283), flex: 1.4 * Math.sin(u * 12.566) },
      Spine2: { flex: 1.2 * Math.sin(u * 12.566 + 0.5), twist: 2 * Math.sin(u * 6.283 + 1.4) },
      Head: { side: 2.4 * Math.sin(u * 6.283 + 2), twist: 2.4 * Math.sin(u * 6.283 + 0.3) },
      R_UpperArm: { flex: 3 * Math.sin(u * 12.566 + 0.4), abduct: 2 * Math.sin(u * 6.283 + 1) }, L_UpperArm: { flex: 3 * Math.sin(u * 12.566 + 2.6), abduct: 2 * Math.sin(u * 6.283 + 3) },
      R_Forearm: { flex: 4 * Math.sin(u * 6.283 + 2) }, L_Forearm: { flex: 4 * Math.sin(u * 6.283 + 4.2) },
    });
    const LN = 16, keys = []; for (let k = 0; k <= LN; k++) keys.push({ t: (k / LN) * 2.8, pose: live(k / LN), ease: 'linear' });
    h.addClip(buildClip(h, { name: 'p_live', duration: 2.8, loop: true, base: 'rest', keys, grounded: false }));
    h.addLayer('live', { mask: 'all', additive: true, weight: 1 });
    h.play('p_live', { layer: 'live', fade: 0, loop: true, startTime: hash(i * 3 + 9) * 2.8, speed: 0.75 + hash(i * 11 + 5) * 0.55 });
    h.setFingers('L', 'relaxed'); h.setFingers('R', 'relaxed');
    h._applyRest(); h.root.updateMatrixWorld(true);
    const a = new Actor(h); a.R = BALL_R;
    h.update(0);
    return { h, i, a, spec: specs[i], idleKind: Math.floor(hash(i * 17 + 4) * 3), state: '', liveW: 1, rec: null, evSeen: 0, catchEv: null, shown: false, pose: null };
  });
  D.crew = crew;
  D.reset = () => { for (const c of crew) { c.state = ''; c.rec = null; c.evSeen = 0; c.catchEv = null; c.shown = false; c.h.root.visible = false; c.h.setReach('L', null); c.h.setReach('R', null); } };
  D.info = {};
  const vis = (x, y, z) => V(x, y - BR + BALL_R, z);       // sim ball position -> visual ball centre (sits on the grass when the sim ball does)
  D.vis = vis;

  // ---- recording an action ----------------------------------------------------------------------------------------------------------------------------
  const yawVec = (yaw) => V(Math.sin(yaw), 0, Math.cos(yaw));
  const leftVec = (yaw) => V(Math.cos(yaw), 0, -Math.sin(yaw));
  function newRec(kind, o) { return { kind, ...o, ev: null, lockW: null, frozenC: null, corr: V(), refine: kind === 'kick' || kind === 'touch' || kind === 'head' || kind === 'tackle' }; }

  function startRec(c, s, p, q, ballI) {
    const a = p.act, i = c.i;
    if (a) {
      if (a.k === 'kick') {
        const tech = TECH_OF_KICK[a.kind] || 'pass';
        const tcont = (a.tck - 1) * STEP;
        c.rec = newRec('kick', { tech, t0: a.t0, tcont, wind: Math.max(0.08, tcont - a.t0), m: a.foot === 'L' ? -1 : 1, key: `k${a.t0}`, act: a, evKind: 'kick' });
      } else if (a.k === 'head') {
        const tcont = (a.tck - 1) * STEP;
        c.rec = newRec('head', { tech: 'head', t0: a.t0, tcont, wind: Math.max(0.1, tcont - a.t0), m: 1, key: `h${a.t0}`, act: a, evKind: 'head' });
      } else if (a.k === 'tackle') {
        c.rec = newRec('tackle', { tech: 'tackle', t0: a.t0, tcont: a.tc, wind: Math.max(0.08, a.tc - a.t0), m: 1, key: `t${a.t0}`, act: a, evKind: 'tackle' });
      } else if (a.k === 'slide') {
        c.rec = newRec('slide', { tech: 'slide', t0: a.t0, tcont: a.t0, wind: 0.2, m: 1, key: `s${a.t0}`, act: a, evKind: 'tackle', ageBased: true });
      } else if (a.k === 'dive') {
        const lat = a.dx * Math.cos(q.face) - a.dz * Math.sin(q.face);       // + = to the body's left
        c.rec = newRec('dive', { tech: a.jump ? 'jump' : 'dive', t0: a.t0, tcont: a.t0, wind: 0.2, m: lat > 0 ? -1 : 1, key: `d${a.t0}`, act: a, evKind: 'save', ageBased: true });
      }
    } else if (p.tq) {
      // dribble touch: pick the foot that is nearer to the ball (the sim's pick is cosmetic)
      const h = c.h, C = vis(ballI.x, ballI.y, ballI.z);
      const fl = h.bonePosition('L_Foot'), fr = h.bonePosition('R_Foot');
      const dl = Math.hypot(fl.x - C.x, fl.z - C.z), dr = Math.hypot(fr.x - C.x, fr.z - C.z);
      let m = p.tq.foot === 'L' ? -1 : 1;
      if (Math.abs(dl - dr) > 0.12) m = dl < dr ? -1 : 1;
      c.rec = newRec('touch', { tech: 'touch', t0: s.t, tcont: p.tq.tck * STEP, wind: 0.085, m, key: `q${p.tq.tck}`, evKind: 'touch' });
    }
    if (!c.rec) return;
    const r = c.rec;
    // the support foot is planted beside the ball where the pelvis is at the start of the action
    const sup = r.m > 0 ? 'L' : 'R', sgn = sup === 'L' ? 1 : -1, ly = leftVec(q.face), fw = yawVec(q.face);
    r.lockW = {};
    // beside the ball (a ball radius plus a boot width away), pulled towards the pelvis if that is too far to stand on
    const bc = vis(ballI.x, ballI.y, ballI.z);
    let lx = bc.x + ly.x * sgn * (BALL_R + 0.27) - fw.x * 0.12, lz = bc.z + ly.z * sgn * (BALL_R + 0.27) - fw.z * 0.12;
    const dl = Math.hypot(lx - q.x, lz - q.z);
    if (dl > 0.6) { lx = q.x + (lx - q.x) * 0.6 / dl; lz = q.z + (lz - q.z) * 0.6 / dl; }
    if (r.kind !== 'kick' && r.kind !== 'head') { lx = q.x + ly.x * 0.13 * sgn; lz = q.z + ly.z * 0.13 * sgn; }
    if (r.kind === 'kick' && r.act && r.act.sx !== undefined && r.tech !== 'throw') { lx = r.act.sx + ly.x * sgn * 0.19; lz = r.act.sz + ly.z * sgn * 0.19; }   // the sim steps the player to its stand spot: the support foot goes beside it
    r.lockW[sup] = { x: lx, z: lz };
    r.evSeen = c.evSeen;
    r.tail = (TECH[r.tech] ? 0.7 : 0.4);
  }

  // ---- one frame ------------------------------------------------------------------------------------------------------------------------------------------
  D.step = ({ s, T, dt, ballI, pl }) => {
    const B = s.ball;
    const heldBy = B.held >= 0 ? B.held : -1;
    // keeper save events are read first so the ball can follow the hands in the very frame of the catch
    for (const c of crew) {
      const i = c.i, p = s.players[i];
      if (p.role !== 'GK') continue;
      for (const e of s.events) if (e.type === 'save' && e.pid === i && e.id >= (c.catchSeen ?? 0)) { c.catchEv = e; c.catchSeen = e.id + 1; }
      const ce = c.catchEv;
      if (ce && !p.act && ce.y < 0.7 && ce.kind === 'catch' && T > ce.t - 0.3 && T < ce.t + 0.7 && !ce.picked) { ce.picked = true; c.rec = newRec('pickup', { tech: 'pickup', t0: ce.t - 0.3, tcont: ce.t, wind: 0.3, m: 1, key: `p${ce.id}`, evKind: 'none' }); c.rec.refine = false; c.rec.pickC = vis(ce.x, ce.y, ce.z); }
    }

    const bvis = vis(ballI.x, ballI.y, ballI.z);
    // the held ball of a throw-in rises from the chest to over the head instead of popping
    if (heldBy >= 0) {
      const hp = s.players[heldBy], a = hp.act;
      if (a && a.k === 'kick' && a.kind === 'gk') { const tc = (a.tck - 1) * STEP, u = clamp((T - a.t0) / Math.max(0.05, tc - a.t0), 0, 1), e = u * u * (3 - 2 * u); bvis.y = ballI.y * (1 - e) + 0.42 * e - BR + BALL_R; }
      if (a && a.k === 'kick' && a.kind === 'throw') { const u = clamp((T - a.t0) / 0.28, 0, 1), e = u * u * (3 - 2 * u); bvis.y = (1.3 - BR + BALL_R) + (ballI.y - 1.3) * e + 0.14 * e; }
    }
    // a keeper who has dived and caught the ball holds it in the hands where he lies, not at the standing chest spot
    if (heldBy >= 0) { const hp2 = s.players[heldBy]; if (hp2.act && hp2.act.k === 'dive' && hp2.act.hit) { const hh = crew[heldBy].h, l = hh.bonePosition('L_Hand'), r = hh.bonePosition('R_Hand'); bvis.set((l.x + r.x) / 2, (l.y + r.y) / 2 + BALL_R * 0.35, (l.z + r.z) / 2); } }
    if (heldBy >= 0) { const rc = crew[heldBy].rec; if (rc && rc.tech === 'pickup' && rc.pickC && T >= rc.tcont) { const hq = pl[heldBy], hh = crew[heldBy].h, l = hh.bonePosition('L_Hand'), r = hh.bonePosition('R_Hand'); const hm = V((l.x + r.x) / 2, (l.y + r.y) / 2 + BALL_R * 0.3, (l.z + r.z) / 2); const w = clamp((T - rc.tcont - 0.3) / 0.3, 0, 1); bvis.copy(hm).lerp(V(bvis.x, bvis.y, bvis.z), w); void hq; } }
    ball.position.copy(bvis);
    ball.rotation.set(ballI.rx / (BALL_R / BR), 0, ballI.rz / (BALL_R / BR));
    const ballLook = bvis.clone();
    D.ballVis = bvis;
    // ---- the players
    for (const c of crew) {
      const { h, i, a: actor } = c, p = s.players[i], q = pl[i];
      h.root.visible = true; c.shown = true;
      // reset any tilt the pose layer left on the root last frame
      h.root.quaternion.identity(); h.root.rotation.set(0, q.face, 0); h.facing = q.face; h._yawTarget = q.face;
      h.root.position.set(q.x, 0, q.z);
      const speed = Math.hypot(q.vx, q.vz);
      // ---- start / end a recorded action
      const key = p.act ? `${p.act.k}${p.act.t0}` : null;
      if (p.act || p.tq) {
        const wantKey = p.act ? (p.act.k === 'kick' ? `k${p.act.t0}` : p.act.k === 'head' ? `h${p.act.t0}` : p.act.k === 'tackle' ? `t${p.act.t0}` : p.act.k === 'slide' ? `s${p.act.t0}` : `d${p.act.t0}`) : `q${p.tq.tck}`;
        if (!c.rec || (c.rec.key !== wantKey && (p.act || !c.rec.act))) { c.rec = null; startRec(c, s, p, q, ballI); }
      }
      void key;
      const rec = c.rec;
      let tech = null, t = 0;
      if (rec) {
        t = rec.ageBased ? T - rec.t0 : T - rec.tcont;
        const def0 = TECH[rec.tech];
        const end = rec.ageBased ? 1.65 : 0.62;
        if (!def0 || t > end || t < -rec.wind - 0.25) { if (t > end) c.rec = null; } else tech = def0;
      }
      // ---- base locomotion
      const phase = s.phase;
      let want;
      if (p.cel > 0 && phase === 'goal') want = 'celebrate';
      else if (speed >= 0.25) want = 'loco';
      else if (p.role === 'GK' && phase === 'play') want = 'ready';
      else want = c.idleKind === 0 ? 'idle' : c.idleKind === 1 ? 'idle_relaxed' : 'ready_stance';
      if (rec && (rec.kind === 'slide' || rec.kind === 'dive') && tech) want = 'ready';
      else if (p.stun > 0.25 && !tech && speed < 2.5) want = 'hit';
      if (want === 'loco') { h.locomote(speed); c.state = 'loco'; }
      else if (c.state !== want) { h.crossfade(want === 'celebrate' ? 'celebrate_2' : want === 'ready' ? 'ready_stance' : want, want === 'hit' ? 0.08 : 0.3); c.state = want; }
      const lw = want === 'loco' ? 0.35 : 1;
      c.liveW += (lw - c.liveW) * Math.min(1, dt * 6);
      if (h.layers.live) h.layers.live.weight = c.liveW;
      h.lookAt(speed > 3.5 ? null : ballLook, { weight: 0.65, maxYaw: 1.1, maxPitch: 0.6 });
      // keeper hands on a held ball / a catch or parry
      let reachL = null, reachR = null, reachW = 0;
      if (heldBy === i && !p.act) { reachW = 1; }
      // saves: hands go to the ball around the sim's save event
      if (p.role === 'GK') { const ce = c.catchEv; if (ce && !p.act) { const tt = T - ce.t; if (tt > -0.14 && tt < 0.5) reachW = Math.max(reachW, clamp(1 - Math.max(0, Math.abs(tt - 0.05) - 0.14) / 0.3, 0, 1)); } }
      if (reachW > 0) {
        const side = (ox) => V(bvis.x + leftVec(q.face).x * ox, bvis.y, bvis.z + leftVec(q.face).z * ox);
        // palms meet the ball surface: the library solves the wrist and hand orientation so the palm (not the wrist) touches
        const dual = heldBy === i || (p.role === 'GK' && c.catchEv && c.catchEv.kind === 'catch');
        let near = 'L', nd = 1e9;
        for (const sd of ['L', 'R']) { const d0 = palmPoint(h, sd).distanceTo(bvis); if (d0 < nd) { nd = d0; near = sd; } }
        for (const sd of ['L', 'R']) {
          if (!dual && sd !== near) { h.setReach(sd, null); continue; }
          const nrm = sd === 'L' ? V(-leftVec(q.face).x, 0, -leftVec(q.face).z) : V(leftVec(q.face).x, 0, leftVec(q.face).z);
          if (!dual) nrm.copy(bvis).sub(palmPoint(h, sd)).normalize();
          const k = solvePalmBall(h, sd, bvis, nrm, V(0, 1, 0), BALL_R);
          h.setReach(sd, k.wrist, { weight: reachW, quat: k.quat });
        }
        h.setFingers('L', 'ballGrip'); h.setFingers('R', 'ballGrip');
        void reachL; void reachR;
      } else { h.setReach('L', null); h.setReach('R', null); h.setFingers('L', 'auto'); h.setFingers('R', 'auto'); }
      h.update(dt);
      // a keeper's hands meet the ball: the sim's catch radius is generous (up to ~0.7 m from the hands' rest point), so close the gap with a short lean/step of the whole body
      if (reachW > 0 && p.role === 'GK' && !p.act && c.catchEv && Math.abs(T - c.catchEv.t) < 0.16) {
        for (let it = 0; it < 12; it++) {
          const n = nearestPart(THREE, h, /Hand|Finger/, bvis, 'hands');
          const gap = n.d - BALL_R;
          if (Math.abs(gap) < 0.002) break;
          const u = bvis.clone().sub(n.p).normalize();
          c.leanOff = (c.leanOff || V()).addScaledVector(u, gap * 1.0); c.leanOff.y = 0;
          if (c.leanOff.length() > 0.7) c.leanOff.setLength(0.7);
          h.root.position.set(q.x + c.leanOff.x, 0, q.z + c.leanOff.z);
          h.update(0);
        }
      } else if (c.leanOff) c.leanOff.multiplyScalar(0.8);
      // ---- the contact pose
      c.pose = null;
      if (tech && rec) {
        // events that carry the true contact (they arrive in the tick after the contact frame)
        for (const e of s.events) {
          if (e.id < (rec.evFrom ?? 0)) continue;
          if (e.type === rec.evKind && e.pid === i && e.t >= rec.t0 - 1e-6 && !rec.ev) rec.ev = e;
        }
        const ctx = buildCtx(c, rec, s, p, q, T, t, bvis, ballI);
        if (ctx) {
          const def = tech(ctx);
          const pose = evalPose(def, ctx, t, actor);
          if (pose) {
            actor.apply(pose, dt);
            // closed-loop contact: around the contact frame measure the real mesh against the ball and nudge the target until the surface touches
            const near = rec.refine && (rec.kind === 'tackle' ? (t > -0.06 && t < 0.4) : Math.abs(t) < 0.075);
            if (near) {
              const re = rec.kind === 'head' ? /Head|Neck/ : rec.tech === 'throw' ? /Hand|Finger/ : new RegExp(`${rec.m > 0 ? 'R' : 'L'}_(Foot|Toe)`);
              if (rec.kind === 'tackle' && Math.hypot(bvis.x - q.x, bvis.z - q.z) > 1.7) rec.corr.multiplyScalar(0.9);
              for (let it = 0; it < 6; it++) {
                const n = nearestPart(THREE, h, re, bvis, rec.kind + rec.m + rec.tech);
                const gap = n.d - BALL_R;
                if (Math.abs(gap) < 0.0025) break;
                const u = bvis.clone().sub(n.p).normalize();
                rec.corr.addScaledVector(u, gap * 0.75);
                if (rec.corr.length() > 0.4) rec.corr.setLength(0.4);
                h.update(0);
                const ctx2 = buildCtx(c, rec, s, p, q, T, t, bvis, ballI);
                const pose2 = evalPose(def, ctx2, t, actor);
                if (pose2) actor.apply(pose2, 0);
              }
            }
            if ((rec.kind === 'dive' && t > 0.08 && t < 0.95 && bvis.distanceTo(ctx.pts.hand) < 0.6 && !(c.catchEv && T > c.catchEv.t + 0.02)) || (rec.kind === 'pickup' && t > -0.05 && t < 0.45)) {
              const useHC = rec.kind === 'dive';
              if (useHC) rec.hc = V(); else rec.shift ||= V();   // a dive moves the hand target (solved afresh each frame), the body never slides off its dive
              for (let it = 0; it < 14; it++) {
                const n = nearestPart(THREE, h, /Hand|Finger/, bvis, 'hands');
                const gap = n.d - BALL_R;
                if (Math.abs(gap) < 0.002) break;
                const u = bvis.clone().sub(n.p).normalize();
                const tgt = useHC ? rec.hc : rec.shift;
                tgt.addScaledVector(u, gap * (useHC ? 1.0 : 0.8));
                if (tgt.length() > (useHC ? 0.5 : 1.1)) tgt.setLength(useHC ? 0.5 : 1.1);
                h.update(0);
                const ctx2 = buildCtx(c, rec, s, p, q, T, t, bvis, ballI);
                const pose2 = evalPose(def, ctx2, t, actor);
                if (pose2) actor.apply(pose2, 0);
              }
            }
            c.pose = { name: rec.tech, t, ctx, pose };
          }
        }
      }
    }
    // bodies never pass through each other: where two bodies overlap, the one NOT in the middle of a ball contact is moved away along the ground
    const busy = (c) => !!(c.rec && c.pose && Math.abs(c.pose.t) < 0.2 && !c.rec.ageBased);
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < 14; i++) for (let j = i + 1; j < 14; j++) {
      const a = crew[i], b = crew[j], pa = pl[i], pb = pl[j];
      if (Math.hypot(pa.x - pb.x, pa.z - pb.z) > 1.3) continue;
      const w = penetration(a.h, b.h);
      if (w.depth <= 0.012) continue;
      const mv = busy(a) && !busy(b) ? b : busy(b) && !busy(a) ? a : busy(a) ? null : (s.players[i].act ? b : a);
      if (!mv) continue;
      const ot = mv === a ? b : a, mp = mv.h.root.position, op = ot.h.root.position;
      let dx = mp.x - op.x, dz = mp.z - op.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const k = Math.min(0.3, w.depth * 1.1);
      mp.x += dx * k; mp.z += dz * k; mv.h.root.updateMatrixWorld(true);
    }
  };

  // ---- the context a technique is evaluated in ------------------------------------------------------------------------------------------------------------
  function buildCtx(c, rec, s, p, q, T, t, bvis, ballI) {
    const { h, a: actor } = c;
    const act = p.act || rec.act;
    const yaw = q.face;
    const pelvisBase = actor.b.pelvis.getWorldPosition(V());
    const ctx = { tilt: (rec.kind === 'kick' && rec.tech !== 'throw') || rec.kind === 'touch' || rec.kind === 'tackle' ? (globalThis.__tilt ?? 0.45) : 0, m: rec.m, wind: rec.wind, R: BALL_R, yaw, yawT: yaw, jy: q.jy || 0, pelvisBase, H0: actor.pelvisRest.y, ground: 0, x: q.x, z: q.z, pow: 0.5, lean: 0, rise: 0, lunge: 0, h: 1, lat: leftVec(yaw), dir: yawVec(yaw), pts: {}, lockW: rec.lockW, look: bvis.clone(), d: yawVec(yaw), C: bvis.clone() };
    const evt = rec.ev;
    if (rec.kind === 'kick' || rec.kind === 'head') {
      const a0 = rec.act;
      ctx.pow = a0.power ?? 0.5;
      if (evt) { ctx.C = vis(evt.bx, evt.by, evt.bz); const l = Math.hypot(evt.vx, evt.vy, evt.vz) || 1; ctx.d = V(evt.vx / l, evt.vy / l, evt.vz / l); rec.frozenC = ctx.C.clone(); rec.frozenD = ctx.d.clone(); }
      else if (T > rec.tcont + 1e-6 && rec.frozenC) { ctx.C = rec.frozenC; ctx.d = rec.frozenD; }
      else {
        // before the launch: the live ball, and the aim from the act
        ctx.C = bvis.clone();
        const bx = ballI.x, bz = ballI.z;
        let dx = (a0.tx || 0) - bx, dz = (a0.tz || 0) - bz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const el = { pass: 0.0, through: 0.0, lob: 0.55, cross: 0.5, clear: 0.62, shot: 0.12 + 0.12 * (a0.power || 0), volley: 0.3, gk: 0.6, throw: 0.35, head: 0.1 }[rec.tech] ?? 0;
        const hl = Math.sqrt(1 - Math.min(0.9, el * el));
        ctx.d = V(dx * hl, el, dz * hl).normalize();
        if (rec.kind === 'head') ctx.d = V(dx, -0.25, dz).normalize();
      }
      ctx.rise = clamp(ctx.C.y - BALL_R, 0, 1.2);
      ctx.lean = clamp((ctx.rise - 0.3) * 30, 0, 22);
      const dist = Math.hypot(ctx.C.x - q.x, ctx.C.z - q.z);
      ctx.lunge = clamp((dist - 0.75) * 2, 0, 1);
      // a volley is any kick with the ball above knee height
      if (rec.tech !== 'throw' && rec.kind === 'kick' && ctx.rise > 0.42 && rec.tech !== 'clear') { /* handled below by the technique choice */ }
      if (rec.kind === 'head') {
        // the head surface point meets the ball surface: aim the fix point at the ball centre pulled back towards the head
        const hp = actor.b.head.getWorldPosition(V());
        const u = hp.clone().sub(ctx.C).normalize();
        const tgt = ctx.C.clone().addScaledVector(u, BALL_R);
        ctx.fixTarget = tgt;
      }
    } else if (rec.kind === 'touch') {
      const e = rec.ev;
      ctx.C = e ? vis(e.x, BR, e.z) : bvis.clone();
      if (e) rec.frozenC = ctx.C.clone(); else if (T > rec.tcont && rec.frozenC) ctx.C = rec.frozenC;
      let dx = e ? e.vx : p.vx, dz = e ? e.vz : p.vz; const l = Math.hypot(dx, dz) || 1; ctx.d = V(dx / l, 0, dz / l);
    } else if (rec.kind === 'tackle' || rec.kind === 'slide') {
      ctx.C = bvis.clone();
      ctx.d = V(act.dx, 0, act.dz);
      ctx.lat = leftVec(Math.atan2(act.dx, act.dz));
      // slide: the lead leg is the one on the ball's side
      const lat = (ctx.C.x - q.x) * ctx.lat.x + (ctx.C.z - q.z) * ctx.lat.z;
      if (rec.kind === 'slide' && rec.mLock === undefined) rec.mLock = lat > 0 ? -1 : 1;
      if (rec.kind === 'slide') ctx.m = rec.mLock;
    } else if (rec.kind === 'pickup') {
      if (rec.shift) { ctx.x = q.x + rec.shift.x; ctx.z = q.z + rec.shift.z; }
      ctx.C = T < rec.tcont ? bvis.clone() : (rec.pickC || bvis.clone());
      if (T >= rec.tcont) ctx.C = rec.pickC.clone().lerp(V(q.x + Math.sin(q.face) * 0.35, 0.9, q.z + Math.cos(q.face) * 0.35), clamp((T - rec.tcont) / 0.3, 0, 1));
    } else if (rec.kind === 'dive') {
      const a0 = act;
      const dir = V(a0.dx, 0, a0.dz);
      ctx.dir = dir.lengthSq() > 0 ? dir.normalize() : yawVec(yaw);
      ctx.lat = leftVec(Math.atan2(ctx.dir.x, ctx.dir.z));
      ctx.h = a0.h; ctx.pts.hand = V(a0.hx, a0.hy, a0.hz);
      const hy = a0.hy || [0.35, 0.95, 1.65][a0.h];
      ctx.pts.hand.y = hy;
      { const dB = ctx.pts.hand.distanceTo(bvis), w = clamp(1 - (dB - 0.4) / 0.6, 0, 1); const away = V(q.x - bvis.x, 0.9 - bvis.y, q.z - bvis.z).normalize().multiplyScalar(BALL_R + 0.05); ctx.pts.hand.lerp(bvis.clone().add(away), w); if (rec.hc) ctx.pts.hand.add(rec.hc); }   // the wrists stop at the ball surface on the keeper's side
      ctx.peak = clamp(hy - 0.15, 0.3, 1.5) - 0.89;
      // pelvis shift towards the hand point so the arms (0.8 m from the pelvis) reach where the sim says the hands are
      const dx = a0.hx - q.x, dz = a0.hz - q.z, d = Math.hypot(dx, dz);
      const reach = Math.max(0, d - 0.74);
      const sh = clamp(t / 0.3, 0, 1);
      ctx.x = q.x + (d > 1e-6 ? dx / d : 0) * reach * sh + (rec.shift ? rec.shift.x : 0); ctx.z = q.z + (d > 1e-6 ? dz / d : 0) * reach * sh + (rec.shift ? rec.shift.z : 0);
      if (rec.shift) ctx.peak += rec.shift.y;
      ctx.yawT = Math.atan2(ctx.dir.x, ctx.dir.z) * 0 + yaw;
    }
    if (rec.corr && rec.refine) {
      const w = rec.kind === 'tackle' ? (t > -0.08 && t < 0.42 ? 1 : 0) : clamp(1 - Math.abs(t) / 0.09, 0, 1);
      if (w > 0) { ctx.C.addScaledVector(rec.corr, w); if (ctx.fixTarget) ctx.fixTarget.addScaledVector(rec.corr, w); }
    }
    return ctx;
  }
  return D;
}
