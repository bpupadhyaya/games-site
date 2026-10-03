// One controller per player: it turns what the simulation says (position, velocity, facing, job, events) into animation. Nothing here changes the sim.
// Rules of the house: hands and feet that must touch something are placed on it every frame with setReach (the ball, an opponent's chest, a ball carrier's waist),
// so the picture agrees with the sim to the centimetre; clips only say how the body gets there. Everything is driven by the animation clock handed in.
import { THREE, FINGER_POSES, bodyPoint, rotateBody } from '../vendor3d/index.js';
import { blendFingerPose } from '../vendor3d/rig.js';

const YD = 0.9144;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const frac = (n) => ((Math.imul(n | 0, 2654435761) >>> 0) / 4294967296);
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerpAng = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };

const STANCE = { QB: 'ft_stance_qb', RB: 'ft_stance_rec', WA: 'ft_stance_rec', WB: 'ft_stance_rec', TE: 'ft_stance_line', C: 'ft_stance_c', G: 'ft_stance_line', DL1: 'ft_stance_line', DL2: 'ft_stance_line', LB1: 'ft_stance_def', LB2: 'ft_stance_def', CB1: 'ft_stance_def', CB2: 'ft_stance_def', S: 'ft_stance_def' };

// sim -> world: x is mirrored (the camera looks along +z, so the screen's right is the sim's +x), yards -> metres
export const toWorld = (x, z) => ({ x: -x * YD, z: z * YD });
export const yawOf = (face) => -face;

export function createCtl(h, id, ball) {
  const st = { clip: '', tackle: null, atk: null, catching: null, throwing: null, spin: null, jk: null, celebrate: 0, lying: 0, lieAmt: 0, seed: id + 1, hold: 0, lastPose: '' };
  const live = { phase: frac(id * 7 + 3) * 2.8, rate: 0.75 + frac(id * 11 + 5) * 0.5 };
  const tmp = { a: V(), b: V(), c: V(), d: V(), e: V() };
  let startedLive = false;

  const base = (name, o = {}) => {
    if (!h.hasClip(name)) return;
    const cur = h.current;
    if (!cur || cur.clip.name !== name || cur.target === 0) {
      const clip = h.clips[name];
      h.play(name, { fade: o.fade ?? 0.25, loop: o.loop ?? clip.loop, startTime: o.loop === false || !clip.loop ? 0 : frac(st.seed * 13 + name.length) * clip.dur, speed: o.speed ?? (0.9 + frac(st.seed * 17) * 0.2) });
    }
    if (o.speed !== undefined && h.current) h.current.speed = o.speed;
    st.clip = name;
  };

  const worldBall = (F) => { tmp.a.set(-F.ball.x * YD, F.ball.y * YD, F.ball.z * YD); return tmp.a; };

  return {
    h, id, st,
    on(e, F) {
      const P = F.P;
      const t = e.t;
      if (e.type === 'windup' && e.qb === id) { st.throwing = { t0: t, tr: e.release }; h.playTimed('throw_overarm', 'release', Math.max(0.01, e.release - F.simT), { fade: 0.08, frameDt: F.dt }); }
      else if (e.type === 'throw') {
        if (e.target === id) st.catching = { tArr: t + e.T, t0: t, to: e.to, caught: false, done: 0 };
      } else if (e.type === 'catch' && e.who === id) { if (st.catching) st.catching.caught = true; }
      else if (e.type === 'intercept' && e.who === id) { if (st.catching) st.catching.caught = true; else st.catching = { tArr: t, t0: t - 0.3, to: e.x ? { x: e.x, y: e.y, z: e.z } : null, caught: true, done: 0 }; }
      else if ((e.type === 'drop' || e.type === 'incompletePass' || e.type === 'deflect') && st.catching) st.catching.done = F.simT;
      else if (e.type === 'tackleStart' && e.tackler === id) st.atk = { t0: t, tc: e.tc, dive: e.dive, result: '' };
      else if (e.type === 'missTackle' && e.tackler === id) { if (st.atk) st.atk.result = 'miss'; st.miss = { t0: t, dive: e.dive }; }
      else if (e.type === 'tackle' && (e.tackler === id || e.carrier === id)) { st.tackle = { ...e, role: e.tackler === id ? 'tackler' : 'carrier', tc: t }; st.atk = null; }
      else if (e.type === 'spin' && e.who === id) st.spin = { t0: t };
      else if (e.type === 'juke' && e.who === id) { st.jk = { t0: t, dir: e.dir }; }
      else if (e.type === 'whistle' && e.reason === 'td') { /* handled in update through P.scorer */ }
      void P;
    },

    update(F, a) {
      const { P, alpha, dt, simT } = F;
      const px = lerp(a.px, a.x, alpha), pz = lerp(a.pz, a.z, alpha), face = lerpAng(a.pface, a.face, alpha);
      const w = toWorld(px, pz);
      const speed = Math.hypot(a.vx, a.vz) * YD;
      let yaw = yawOf(face);
      // spin: the body turns a full circle
      if (st.spin) { const k = (simT - st.spin.t0) / 0.5; if (k >= 1) st.spin = null; else yaw += 2 * Math.PI * sm(k); }
      h.setPosition(w.x, 0, w.z); h.setFacing(yaw);
      const hitPhase = P.phase;
      const live = P.phase === 'live' || P.phase === 'done';
      const dead = P.dead;
      // -------- base pose
      let reachR = null, reachL = null, wR = 0, wL = 0, lookAtBall = true;
      const ballW = worldBall(F);

      if (st.tackle) { this.tackle(F, a, w, yaw); }
      else if (a.hold > 0 && st.lying) { /* handled below (getting up) */ }
      if (!st.tackle && st.lying) { this.getUp(F, a, w, yaw); return; }
      if (st.tackle) return;

      // lying down after a dive that missed, or stumbling
      if (st.miss && simT - st.miss.t0 < 0.9) { base('ft_stumble', { fade: 0.05, loop: false, speed: 1 }); }
      else if (hitPhase === 'lineup') {
        const sp = speed;
        if (sp < 0.25) base(STANCE[a.slot] || 'ft_stance_def', { fade: 0.3 }); else h.locomote(sp, { fade: 0.25 });
      } else if (hitPhase === 'set') {
        base(STANCE[a.slot] || 'ft_stance_def', { fade: 0.25 });
      } else if (a.pose === 'gather') {
        h.locomote(speed, { fade: 0.25 });
      } else {
        // --- live play
        const v = Math.hypot(a.vx, a.vz);
        const dotv = v > 0.2 ? (a.vx * Math.sin(a.face) + a.vz * Math.cos(a.face)) / v : 1;
        const qbRead = a.q && (a.q.mode === 'read' || a.q.mode === 'windup' || a.q.mode === 'got' || a.q.mode === 'drop' || a.q.mode === 'hand' || a.q.mode === 'after' || a.q.mode === 'draw') && P.ball.holder === a.id;
        if (st.throwing && simT - st.throwing.t0 < 0.95) { /* the throw clip plays */ }
        else if (a.eng) {
          const partner = P.actors[a.eng.a === a.id ? a.eng.b : a.eng.a];
          base(a.unit === 'off' ? 'ft_block' : 'ft_rush', { fade: 0.15, speed: 0.9 + frac(st.seed) * 0.2 });
          const ph = F.ctl[partner.id];
          if (ph) {
            const hh = ph.h;
            const c = bodyPoint(hh, 'chest', h);
            const left = tmp.c.set(Math.cos(yaw), 0, -Math.sin(yaw));
            h.setReach('L', tmp.d.copy(c).addScaledVector(left, 0.14 * (h.scale / 1.4)).setY(c.y - 0.04 * (h.scale / 1.4)), { weight: 0.9 });
            h.setReach('R', tmp.e.copy(c).addScaledVector(left, -0.14 * (h.scale / 1.4)).setY(c.y - 0.04 * (h.scale / 1.4)), { weight: 0.9 });
            wL = wR = -1;
          }
        } else if (dead && v < 0.4) {
          if (a.unit === 'off' && P.deadReason === 'td' && P.scorer === a.id) base('celebrate_2', { fade: 0.2 });
          else if (P.deadReason === 'td' && a.team === P.actors[P.scorer].team) base('cheer', { fade: 0.3 });
          else base('idle_relaxed', { fade: 0.4 });
        } else if (qbRead && a.q.mode !== 'drop' && v < 0.9) {
          base(a.q.mode === 'windup' ? 'ft_stance_qb' : 'ft_stance_qb', { fade: 0.2, speed: 1 });
        } else if (a.job && a.job.k === 'sit' && v < 0.7) {
          base('ft_stance_rec', { fade: 0.3 });
        } else if (v > 0.7 && dotv < -0.35) {
          base('ft_backpedal', { fade: 0.18, speed: Math.min(1.8, Math.max(0.55, speed / 2.4)) });
        } else if (v > 0.5) {
          h.locomote(speed, { fade: 0.22 });
        } else {
          const nm = a.eng ? 'ft_block' : STANCE[a.slot] || 'ft_stance_def';
          base(nm === 'ft_stance_c' ? 'ft_stance_line' : nm, { fade: 0.3 });
        }
        // the ball in the hands
        const holds = P.ball.holder === a.id && P.ball.st === 'held';
        if (holds) {
          const lw = tmp.c.set(Math.cos(yaw), 0, -Math.sin(yaw));
          if (qbRead) {
            reachR = tmp.d.copy(ballW).addScaledVector(lw, -0.07); reachL = tmp.e.copy(ballW).addScaledVector(lw, 0.09); wR = 1; wL = 1;
          } else {
            reachR = tmp.d.copy(ballW).addScaledVector(lw, -0.05); wR = 1; reachL = tmp.e.copy(ballW).addScaledVector(lw, 0.1); wL = 0.55;
          }
        } else if (P.ball.st === 'air' && P.ball.kind === 'handoff' && (P.ball.fly.to === a.id)) { const lw = tmp.c.set(Math.cos(yaw), 0, -Math.sin(yaw)); reachR = tmp.d.copy(ballW).addScaledVector(lw, -0.06); reachL = tmp.e.copy(ballW).addScaledVector(lw, 0.08); wR = 1; wL = 1; }
        else if (P.ball.st === 'air' && P.ball.kind === 'handoff' && P.ball.holder === -1 && st.lastHold) { reachR = tmp.d.copy(ballW); wR = 0.9; }
        // a throw in the air at this player: both hands go to the ball
        const c = st.catching;
        if (c && simT < c.tArr + 0.35 && !(c.done && simT > c.done + 0.25)) {
          const k = sm((simT - (c.tArr - 0.5)) / 0.4);
          const lw = tmp.c.set(Math.cos(yaw), 0, -Math.sin(yaw));
          if (!holds || c.caught) { reachR = tmp.d.copy(ballW).addScaledVector(lw, -0.08); reachL = tmp.e.copy(ballW).addScaledVector(lw, 0.08); wR = wL = Math.max(wR, k); if (c.caught && holds) { wR = 1; wL = 1; } }
        } else if (c && simT >= c.tArr + 0.35) st.catching = null;
        st.lastHold = holds;
        // throwing: the throwing hand follows the ball until it leaves
        if (st.throwing && P.ball.holder === a.id && simT - st.throwing.t0 < 0.4) {
          reachR = tmp.d.copy(ballW); wR = 1;
          const lw = tmp.c.set(Math.cos(yaw), 0, -Math.sin(yaw)); reachL = tmp.e.copy(ballW).addScaledVector(lw, 0.1); wL = simT < st.throwing.tr - 0.12 ? 1 : 0;
        }
      }
      // -------- fingers and hands
      if (wR >= 0 && reachR && wR > 0) h.setReach('R', reachR, { weight: wR }); else if (wR >= 0) h.setReach('R', null);
      if (wL >= 0 && reachL && wL > 0) h.setReach('L', reachL, { weight: wL }); else if (wL >= 0) h.setReach('L', null);
      if (st.catching && simT < st.catching.tArr + 0.1) { h.setFingers('both', 'open'); }
      else if (P.ball.holder === a.id) { h.setFingers('R', 'ballGrip'); h.setFingers('L', wL > 0 ? 'ballGrip' : 'auto'); }
      else if (a.eng) { h.setFingers('both', 'open'); }
      else { h.setFingers('both', 'auto'); }
      // -------- head
      if (lookAtBall && (P.ball.st === 'air' || P.ball.holder >= 0 || live)) h.lookAt(ballW, { weight: 0.55, maxYaw: 1.0, maxPitch: 0.5 }); else h.lookAt(null);
      // -------- life: the live layer breathes harder when standing, barely when running
      if (h.layers.live) h.layers.live.setWeight(speed > 1 ? 0.2 : 0.9, 0);
      // -------- dive for a tackle
      if (st.atk && !st.tackle) this.dive(F, a, w, yaw);
      else if (!st.atk && h._airborne) { rotateBody(h, null); }
      // -------- juke lean
      if (st.jk) { const k = (simT - st.jk.t0) / 0.42; if (k >= 1) st.jk = null; else if (h.layers.lean) { if (!st.jk.started) { st.jk.started = true; h.play(st.jk.dir > 0 ? 'ft_lean_r' : 'ft_lean_l', { layer: 'lean', fade: 0.06, loop: false }); } h.layers.lean.setWeight(Math.sin(Math.PI * Math.min(1, k)), 0); } }
    },

    // the diving tackler: the body pitches forward about the hips, arms stretched to the carrier's waist
    dive(F, a, w, yaw) {
      const { P, simT } = F, at = st.atk;
      const k = (simT - (at.tc - 0.3)) / 0.3;
      const carrier = F.ctl[P.actors.find((x) => x.id === a.attack?.tgt)?.id ?? -1];
      const pitch = at.dive ? 38 * sm(k) : 14 * sm(k);
      const pel = h.bonePosition('Pelvis', tmp.b);
      if (pitch > 0.5) rotateBody(h, { pelvis: V(pel.x, Math.max(0.55, pel.y - 0.28 * sm(k) * (at.dive ? 1 : 0.3)), pel.z), yaw: h.facing, pitch, roll: 0 });
      if (carrier) { const tp = bodyPoint(carrier.h, 'waist', h); h.setReach('R', tmp.d.copy(tp).add(V(0.06 * Math.cos(yaw), 0, -0.06 * Math.sin(yaw))), { weight: sm(k) }); h.setReach('L', tmp.e.copy(tp).add(V(-0.06 * Math.cos(yaw), 0, 0.06 * Math.sin(yaw))), { weight: sm(k) }); }
      if (simT > at.tc + 0.05 && !st.tackle) { st.atk = null; rotateBody(h, null); h.setReach('R', null); h.setReach('L', null); }
    },

    // the wrap-up tackle: both bodies lean into each other, then sink to the ground together
    tackle(F, a, w, yaw) {
      const { P, simT } = F, tk = st.tackle;
      const tw = simT - tk.tc;
      const other = F.ctl[tk.role === 'tackler' ? tk.carrier : tk.tackler];
      const D = 0.95;                                        // seconds from contact to being down (the sim's TACKLE_DOWN)
      const lean = sm(tw / 0.5), sink = sm((tw - 0.4) / (D - 0.4));
      const pelStand = h.pelvisHeight || 0.95;
      // forward drift so the body lands where the momentum carries it
      const fwd = tk.role === 'carrier' ? V(-tk.hx, 0, tk.hz) : V(-tk.hx, 0, tk.hz);
      const pitch = (tk.role === 'tackler' ? 26 : 12) * lean + (tk.role === 'tackler' ? 52 : 66) * sink;
      const py = lerp(pelStand - 0.1 * lean, 0.2, sink);
      const drift = (tk.role === 'tackler' ? 0.3 : 0.5) * sink;
      st.lying = Math.max(st.lying, sink >= 1 ? 1 : 0);
      base(sink > 0.15 ? 'ft_lie' : (tk.role === 'tackler' ? 'ft_block' : 'jog_slow'), { fade: 0.2, speed: tk.role === 'tackler' ? 1 : Math.max(0.5, Math.min(1.2, Math.hypot(a.vx, a.vz) * YD / 2.4)) });
      if (lean > 0.02) rotateBody(h, { pelvis: V(w.x + fwd.x * drift, py, w.z + fwd.z * drift), yaw: h.facing, pitch, roll: 0 });
      // hands: the tackler wraps the waist, the carrier throws his arms up
      if (other && tk.role === 'tackler') {
        // the hands go round the carrier's waist on the side nearest the tackler (a circle around his spine, never through his body)
        const sp = other.h.bonePosition('Spine', tmp.a); const me = h.root.position;
        const ang = Math.atan2(me.x - sp.x, me.z - sp.z), R = 0.27 * (h.scale / 1.4), hy = sp.y - 0.03;
        const pA = tmp.d.set(sp.x + R * Math.sin(ang + 0.55), hy, sp.z + R * Math.cos(ang + 0.55));
        const pB = tmp.e.set(sp.x + R * Math.sin(ang - 0.55), hy, sp.z + R * Math.cos(ang - 0.55));
        const left = tmp.c.set(Math.cos(yaw), 0, -Math.sin(yaw));
        // as the carrier goes down the hands slide to the side of his body (along the line from his hips to his shoulders) instead of round it
        const kd = sm((tw - 0.4) / 0.5);
        if (kd > 0) {
          const pel = other.h.bonePosition('Pelvis', tmp.b), nk = other.h.bonePosition('Neck', V());
          const ax = nk.sub(pel).normalize(), tx = Math.sin(ang), tz = Math.cos(ang);
          const bA = V(sp.x + tx * 0.38 * (h.scale / 1.4) + ax.x * 0.2, sp.y + ax.y * 0.2, sp.z + tz * 0.38 * (h.scale / 1.4) + ax.z * 0.2), bB = V(sp.x + tx * 0.38 * (h.scale / 1.4) - ax.x * 0.2, sp.y - ax.y * 0.2, sp.z + tz * 0.38 * (h.scale / 1.4) - ax.z * 0.2);
          pA.lerp(bA, kd); pB.lerp(bB, kd);
        }
        const dA = (pA.x - me.x) * left.x + (pA.z - me.z) * left.z, dB = (pB.x - me.x) * left.x + (pB.z - me.z) * left.z;
        const k = sm(tw / 0.15) * (1 - sm((tw - 0.55) / 0.3));
        h.setReach('L', dA >= dB ? pA : pB, { weight: k });
        h.setReach('R', dA >= dB ? pB : pA, { weight: k });
        h.setFingers('both', 'fist');
      } else if (tk.role === 'carrier') {
        const hold = P.ball.holder === a.id && P.ball.st === 'held';
        if (hold) { const bw = worldBall(F); h.setReach('R', tmp.d.copy(bw), { weight: 1 }); h.setReach('L', tmp.e.copy(bw), { weight: 0.7 }); }
      }
      h.lookAt(null);
      if (h.layers.live) h.layers.live.setWeight(0, 0);
    },

    getUp(F, a, w, yaw) {
      // after the whistle the sim holds the player still, then he rises: the fall in reverse, slower
      const g = 1 - Math.min(1, Math.max(0, a.hold / 0.9));
      const k = a.hold > 0.9 ? 0 : sm(g);
      if (a.hold <= 0 || (a.hold < 0.02 && k >= 1)) { st.lying = 0; st.tackle = null; rotateBody(h, null); base('idle_relaxed', { fade: 0.3 }); h.setReach('R', null); h.setReach('L', null); return; }
      const pelStand = h.pelvisHeight || 0.95;
      const tk = st.tackle;
      const fwd = tk ? V(-tk.hx, 0, tk.hz) : V(0, 0, 1);
      const sink = 1 - k;
      const py = lerp(pelStand, 0.2, sink), pitch = (tk && tk.role === 'tackler' ? 78 : 78) * sink;
      rotateBody(h, { pelvis: V(w.x + fwd.x * 0.4 * sink, py, w.z + fwd.z * 0.4 * sink), yaw: h.facing, pitch, roll: 0 });
      h.setReach('R', null); h.setReach('L', null);
      if (k >= 1) { st.lying = 0; st.tackle = null; rotateBody(h, null); }
    },

    reset() { st.tackle = null; st.atk = null; st.catching = null; st.throwing = null; st.spin = null; st.jk = null; st.lying = 0; st.miss = null; st.lastHold = false; if (h._airborne) rotateBody(h, null); h.setReach('R', null); h.setReach('L', null); },
  };
}
