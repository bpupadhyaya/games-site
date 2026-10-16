// One peteca player in 3D: a view3d athlete driven by the simulation's state (position, speed, ready, strike) and nothing else.
// The sim says where the player stands and when and where the palm meets the peteca; this file only decides how a real person gets there:
//  - legs are driven by the distance actually travelled (locomote(speed) of the DISPLAYED motion); a still player breathes and shifts weight,
//  - facing follows the real heading: turn to run back for a deep peteca, face the net when set,
//  - anticipation: a split-step hop as the rival strikes, a load (knees, trunk) as the peteca falls, the palm tracking the peteca from behind,
//  - the palm goes through the sim's contact point at the displayed contact: it accelerates into it (quadratic) and decelerates through the
//    follow-through (cubic ease-out), so the speed is continuous; trunk twist, hip drive, a jump whose apex is the contact, the free arm
//    counter-balancing, a soft landing.
// All procedural offsets are written onto the bones before the IK passes (see patchPost), so the hand still lands exactly on the contact point.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (t) => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };
const damp = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / Math.max(1e-4, tau)));
const D2R = Math.PI / 180;

export const BALL_DELAY = 0.075;       // the displayed peteca lags the sim by this much so the palm arrives (and swings through) before the ball leaves it
const AI_LEAD = 0.17;                  // an AI player starts its swing this long before contact

export function createAthleteKit(V3) {
  const { THREE, semanticRot, solvePalmBall } = V3;
  const Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'XYZ');
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const SPINE = ['Spine', 'Spine1', 'Spine2'];
  const PALM_N = (a, dir) => (a === 'smash' ? [0.55 * dir, -0.8] : a === 'drive' ? [0.85 * dir, 0.5] : a === 'drop' ? [0.5 * dir, 0.85] : [0.15 * dir, 1]);

  class Athlete {
    constructor(human, look) {
      const h = this.h = human;
      this.look = look;
      this.x = null; this.vel = 0; this.speed = 0;
      this.depth = 0;
      this.c = { crouch: 0, air: 0, lean: 0, twist: 0, side: 0, hip: 0 };
      this.proc = { thigh: 0, calf: 0, spineFlex: 0, spineTwist: 0, spineSide: 0, headFlex: 0, headTwist: 0, pelvisDrop: 0, pelvisTwist: 0, hip: 0 };
      this.hand = null; this.handW = 0;
      this.off = null; this.offW = 0;
      this.t = 0;
      this.splitT = 9;
      this.lunge = 0;
      this.away = false; this.awayT = 0;
      this.seed = (look * 7.13) % 6.28;
      this.jumpY = 0; this.jy = 0; this.jv = 0; this.inAir = false; this.jumpCool = 0;
      this.tcdS = null;
      this.ready = 0;
      this.sw = null;
      this.hitSide = 'R';
      h.groundClamp = 'auto'; h.footPlanting = true; h.turnRate = 9; h.maxFootDrag = 0.14;
      this.patchPost();
    }

    // Offsets applied to the bones right after the clip pose is written and BEFORE ground clamp / look-at / IK, so reach targets still win.
    patchPost() {
      const h = this.h, orig = h._post.bind(h), self = this;
      const rot = (name, p) => {
        const b = h.bones[`Bip01_${name}`]; if (!b) return;
        const r = semanticRot(name, p);
        E.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, 'XYZ'); Q.setFromEuler(E);
        b.quaternion.multiply(Q);
      };
      h._post = (dt) => {
        const P = self.proc;
        if (P.pelvisDrop) h.pelvis.position.y -= P.pelvisDrop;
        if (P.pelvisTwist) rot('Pelvis', { twist: P.pelvisTwist });
        if (P.thigh || P.calf) {
          const hs = self.hitSide;
          for (const s of ['L', 'R']) {
            rot(`${s}_Thigh`, { flex: P.thigh + (s === hs ? P.hip : -P.hip * 0.7) });
            rot(`${s}_Calf`, { flex: P.calf });
          }
        }
        if (P.spineFlex || P.spineTwist || P.spineSide) for (const n of SPINE) rot(n, { flex: P.spineFlex / 3, twist: P.spineTwist / 3, side: P.spineSide / 3 });
        if (P.headFlex || P.headTwist) rot('Head', { flex: P.headFlex, twist: P.headTwist });
        orig(dt);
      };
    }

    // S: { x (sim metres), depth, dir, ready, anim, mine, tcd (AI: s to the contact), plan, ball {x,y,z world}|null, mood, jumpSim, held }
    update(dt, S) {
      const h = this.h;
      dt = clamp(dt, 0, 0.1);
      const dir = S.dir >= 0 ? 1 : -1;
      const side = dir > 0 ? 'R' : 'L', far = side === 'R' ? 'L' : 'R';
      this.hitSide = side;
      this.t += dt;
      const sg = side === 'R' ? 1 : -1;
      const dd = dt || 1;

      // ---- displayed motion -> speed (distance driven)
      if (this.x === null) { this.x = S.x; this.depth = S.depth; this.vel = 0; this.speed = 0; this.tcdS = null; this.sw = null; this.lunge = 0; this.stand = 0; this.rootPrev = undefined; this.jumpY = 0; this.jy = 0; this.yaw = undefined; this.inAir = false; this.cwS = null; }
      // speed of the DISPLAYED body (sim position + stand-back + lunge of the previous frame): legs follow what is on screen
      const rootNow = S.x + ((this.lunge || 0) - (this.stand || 0)) * dir;
      const vx = dt > 0 && this.rootPrev !== undefined ? (rootNow - this.rootPrev) / dt : 0;
      this.rootPrev = rootNow;
      this.x = S.x;
      this.vel = damp(this.vel, vx, dd, 0.05);
      this.depth = damp(this.depth, S.depth, dd, 0.25);
      const fwdV = this.vel * dir;
      this.speed = damp(this.speed, Math.abs(this.vel), dd, 0.04);
      this.ready = damp(this.ready, S.ready || 0, dd, 0.08);

      // ---- stroke clock: tau = seconds since the DISPLAYED contact (negative: still arriving)
      const an = S.anim;
      let tau = null, lead = BALL_DELAY;
      if (an && an.cx !== undefined) { tau = an.t - BALL_DELAY; this.tcdS = null; }
      else if (S.tcd !== null && S.tcd !== undefined && S.mine) {
        const want = S.tcd + BALL_DELAY;                              // the prediction is re-solved each frame: blend it so nothing flickers
        this.tcdS = (this.tcdS === null || Math.abs(this.tcdS - dt - want) > 0.35) ? want : lerp(this.tcdS - dt, want, 0.25);
        tau = -this.tcdS; lead = AI_LEAD;
      } else if (this.tcdS !== null && S.mine && this.tcdS > -0.1) { this.tcdS -= dt; tau = -this.tcdS; lead = AI_LEAD; }
      else this.tcdS = null;
      const shot = an ? an.shot : (S.plan ? S.plan.shot : null);
      const inStroke = tau !== null && tau >= -lead - 1e-4 && tau < 0.55;

      // ---- heading: face the net when set, turn to run back for a deep peteca
      const netYaw = dir * Math.PI / 2;
      const arriving = inStroke || (tau !== null && tau > -0.55) || (S.mine && S.plan && Math.abs((S.plan.xw + 6) - S.x) < 0.7);
      if (!arriving && fwdV < -0.7) { this.awayT += dt; if (this.awayT > 0.1) this.away = true; }
      else if (fwdV > -0.25 || arriving) { this.awayT = 0; this.away = false; }
      // critically damped heading (the angular speed is continuous even when the target flips)
      if (this.yaw === undefined) { this.yaw = netYaw; this.yawV = 0; }
      {
        const tgt = this.away ? -netYaw : netYaw;
        let d = tgt - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        const K = this.away ? 170 : 330, Cd = 2 * Math.sqrt(K);
        this.yawV += (K * d - Cd * this.yawV) * dt;
        this.yawV = clamp(this.yawV, -14, 14);
        this.yaw += this.yawV * dt;
        h.turnRate = 0; h.setFacing(this.yaw, { snap: true });
      }

      // ---- lunge and jump
      // a player stands a little behind the peteca (the palm meets it in front of the shoulder, never beside it): the displayed body sits 0.3 m back
      const standT = (S.mine || inStroke) ? 0.3 : 0;
      this.stand = damp(this.stand || 0, standT, dd, 0.12);
      const contactAhead = (an ? ((an.cx - S.x) * dir) : (S.plan ? (((S.plan.xw + 6) - S.x) * dir) : 0)) + this.stand;
      let lungeT = 0;
      if (inStroke) lungeT = clamp(contactAhead - 0.5, 0, 0.55) * (tau < 0 ? sstep(1 + tau / lead) : 1 - sstep(tau / 0.5));
      this.lunge = damp(this.lunge, lungeT, dd, 0.06);

      // jump: a real ballistic hop whose apex lands on the contact (take-off speed = g x time to contact); once airborne it simply flies and lands
      const needsAir = shot === 'smash' || (an ? an.cz > 1.95 : S.plan && S.plan.zHit > 1.95);
      if (needsAir && tau !== null && !this.inAir && tau > -0.3 && tau < 0.05 && this.jumpCool <= 0) {
        this.inAir = true; this.jy = 0.001; this.jv = clamp(9.81 * Math.max(0.12, -tau), 1.6, 2.9);
      }
      if (this.inAir) {
        this.jv -= 9.81 * dt; this.jy += this.jv * dt;
        if (this.jy <= 0) { this.jy = 0; this.inAir = false; this.jumpCool = 0.5; }
      } else this.jumpCool -= dt;
      if (!this.inAir) this.jy = 0;
      this.jumpY = damp(this.jumpY, this.jy, dd, 0.03);

      // split-step: a small hop as the rival's palm meets the peteca
      this.splitT += dt;
      let hopY = 0;
      if (this.splitT < 0.26 && !inStroke && this.speed < 1.5 && this.jumpY < 0.01) hopY = 0.045 * Math.sin((this.splitT / 0.26) * Math.PI);

      // ---- posture targets
      const C = this.c;
      const load = clamp(this.ready * (tau !== null ? sstep(1 - (-tau - 0.05) / 0.5) : 0.6), 0, 1);
      const run = clamp(this.speed / 5, 0, 1);
      const airFrac = clamp(this.jumpY / 0.37, 0, 1);
      const landing = tau !== null && tau > 0.15 && tau < 0.5 && shot === 'smash' ? Math.sin(((tau - 0.15) / 0.35) * Math.PI) : 0;
      const wantCrouch = 0.16 + 0.5 * load + 0.25 * run + 0.55 * landing;
      C.crouch = damp(C.crouch, clamp(wantCrouch, 0, 1) * (1 - airFrac), dd, 0.07);
      C.air = damp(C.air, airFrac, dd, 0.05);

      let twistT = 0, sideT = 0, hipT = 0, flexT = 0;
      if (inStroke) {
        const wind = sstep((tau + lead) / lead);                    // 0 at the start of the swing, 1 at contact
        const thru = sstep(tau / 0.28);
        if (tau < 0) { twistT = sg * lerp(10, 18, wind); hipT = wind * 5; }
        else { twistT = sg * lerp(18, -20, thru); hipT = lerp(5, 2, thru); }
        if (shot === 'smash') { flexT = tau < 0 ? lerp(-8, -3, wind) : lerp(-3, 20, thru); sideT = sg * (tau < 0 ? -10 * wind : lerp(-10, 12, thru)); }
        else if (shot === 'lob') { flexT = tau < 0 ? 5 : lerp(5, -10, thru); }
        else if (shot === 'drop') { flexT = lerp(8, 16, thru); twistT *= 0.45; }
        else { flexT = lerp(6, 14, thru); }
      } else if (this.ready > 0.2) {
        twistT = sg * 8 * this.ready; hipT = 2 * this.ready;
      }
      C.twist = damp(C.twist, twistT, dd, 0.05);
      C.side = damp(C.side, sideT, dd, 0.06);
      C.hip = damp(C.hip, hipT, dd, 0.07);
      const leanT = 4 + 14 * run + 7 * load + (this.away ? 6 : 0) + flexT;
      C.lean = damp(C.lean, leanT, dd, 0.08);

      const idleMix = 1 - clamp(this.speed * 0.6, 0, 1);
      const br = Math.sin(this.t * 2.2 + this.seed), sway = Math.sin(this.t * 0.7 + this.seed * 1.7);
      const P = this.proc, air = C.air;
      const tuck = air * (shot === 'smash' ? 34 : 20);
      const f = C.crouch * 15 + tuck * 0.5;                          // thigh flex; calf flexes more: the feet stay under the hips
      P.thigh = f;
      P.calf = f * 1.6 + tuck * 0.9;
      P.hip = C.hip;
      P.pelvisDrop = 2 * 0.44 * (1 - Math.cos((C.crouch * 15) * D2R)) * (1 - air);
      P.spineFlex = C.lean * 0.4 + C.crouch * 5 - air * 6 + br * 0.6 * idleMix;
      P.spineTwist = C.twist;
      P.spineSide = C.side + sway * 1.2 * idleMix;
      P.pelvisTwist = -C.twist * 0.3;
      P.headFlex = -C.lean * 0.2 + (S.mood === 'lose' ? 12 : 0);
      P.headTwist = 0;

      // ---- clip
      const lifted = this.jumpY > 0.04 || air > 0.3 || hopY > 0.006;
      const airborne = this.jumpY > 0.04 || air > 0.3;
      h.groundClamp = lifted ? 'off' : 'auto';
      this.plant = this.speed > 1.3 ? true : this.speed < 0.9 ? false : !!this.plant;
      h.footPlanting = !lifted && this.plant;
      // base clip with a dwell time: the animation layer blends tracks by weight, and a third track started before the second is fully in
      // dips the pose towards the rest pose; one switch per 0.24 s with a 0.14 s fade keeps the weights summing to one (no pops)
      this.clipT = this.clipT ?? -9;
      let want = 'idle';
      if (airborne) want = 'ready_stance';
      else if (S.mood === 'win') want = 'celebrate_2';
      else if (this.speed > 0.35) want = 'loco';
      else if (this.ready > 0.15 || inStroke || S.held) want = 'ready_stance';
      else if (S.mood === 'lose') want = 'idle_relaxed';
      const cur = h.layers.base.current;
      const curName = cur && cur.target > 0 ? cur.clip.name : null;
      const isGait = curName === 'walk' || curName === 'jog' || curName === 'sprint';
      const sp = this.speed;
      const GV = { walk: 1.4, jog: 3.07, sprint: 5.84 };
      const gaitFor = (v) => { const g = this.gait || 'walk'; const up = (th) => v >= th * 1.06, dn = (th) => v < th * 0.94; let r = g; if (g === 'walk') { if (up(4.4)) r = 'sprint'; else if (up(2.1)) r = 'jog'; } else if (g === 'jog') { if (up(4.4)) r = 'sprint'; else if (dn(2.1)) r = 'walk'; } else { if (dn(4.4)) r = 'jog'; if (r === 'jog' && dn(2.1)) r = 'walk'; } return r; };
      const settle = h.layers.base.tracks.length <= 1 || (cur && cur.weight > 0.9);
      if (want === 'loco') {
        const gait = isGait ? curName : (this.gait || 'walk');
        const g2 = gaitFor(sp);
        if (!isGait) {
          if (settle || !cur) { this.gait = g2; this.clipT = this.t; h.locomote(GV[g2], { fade: 0.14 }); const t = h.layers.base.current; t.speed = clamp(sp / GV[g2], 0.5, 1.8); }
        } else if (g2 !== curName && settle) { this.gait = g2; this.clipT = this.t; h.locomote(GV[g2], { fade: 0.14 }); const t = h.layers.base.current; t.speed = clamp(sp / GV[g2], 0.5, 1.8); }
        else { const t = h.layers.base.current; const v = t.clip.speed || 1; t.speed = clamp(sp / v, 0.5, 1.8); this.gait = gait; }
      } else if (curName !== want) {
        if (settle || !cur || airborne) { this.clipT = this.t; h.play(want, { fade: 0.14 }); }
        else if (isGait) { const t = h.layers.base.current; t.speed = clamp(sp / (t.clip.speed || 1), 0.5, 1.8); }
      }
      // loop seams of the shipped clips are up to ~20 degrees off: cross-fade the end of the loop into its start instead of wrapping
      {
        const L = h.layers.base, c = L.current;
        if (c && c.clip.loop && L.tracks.length === 1 && c.target > 0 && c.weight >= 1 && c.time > c.clip.dur - 0.13 && c.time < c.clip.dur - 0.02) {
          const spd = c.speed;
          const n = h.play(c.clip, { fade: 0.12, loop: true, startTime: 0 });
          n.speed = spd;
        }
      }
      h.root.position.set(this.x - 6 + (this.lunge - this.stand) * dir, this.jumpY + hopY, this.depth);

      // ---- eyes
      const bw = S.ball;
      if (bw) {
        // the gaze target is kept inside +-65 degrees of the body's heading: past that the look-at solver flips sides for a frame
        const hx = this.x - 6, hy = 1.55 + this.jumpY, hz = this.depth;
        let dx = bw.x - hx, dy = bw.y - hy, dz = bw.z - hz;
        const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
        const along = dx * fx + dz * fz, across = dx * fz - dz * fx;
        let ang = Math.atan2(across, along);
        const dist = Math.max(1.5, Math.hypot(dx, dz));
        ang = clamp(ang, -1.13, 1.13);
        const tx = hx + (Math.sin(this.yaw) * Math.cos(ang) + Math.cos(this.yaw) * Math.sin(ang)) * dist;
        const tz = hz + (Math.cos(this.yaw) * Math.cos(ang) - Math.sin(this.yaw) * Math.sin(ang)) * dist;
        const ty = hy + clamp(dy, -dist * 0.6, dist * 0.9);
        if (!this.gaze) this.gaze = V(tx, ty, tz); else this.gaze.lerp(V(tx, ty, tz), 1 - Math.exp(-dt / 0.05));
        h.lookAt(this.gaze, { weight: 0.85, maxYaw: 1.2, maxPitch: 0.7 });
      } else h.lookAt(null);

      // ---- the striking palm
      h.root.updateMatrixWorld(true);
      const sh = h.bonePosition(`${side}_UpperArm`, V());
      const cock = (sh2, a) => V(sh2.x - 0.22 * dir, sh2.y + (a === 'smash' ? 0.34 : a === 'lob' ? -0.4 : a === 'drop' ? -0.05 : 0.04), sh2.z);
      const follow = (a) => (a === 'smash' ? V(sh.x + 0.5 * dir, sh.y - 0.55, sh.z + 0.1)
        : a === 'lob' ? V(sh.x + 0.44 * dir, sh.y + 0.32, sh.z)
          : a === 'drop' ? V(sh.x + 0.34 * dir, sh.y - 0.14, sh.z)
            : V(sh.x + 0.6 * dir, sh.y - 0.12, sh.z));
      let target = null, w = 0, nrm = null, instant = false;
      if (inStroke && (an || S.plan)) {
        const cw0 = an ? V(an.cx - 6, an.cz, this.depth) : V(S.plan.xw, S.plan.zHit, this.depth);
        // the plan (AI) and the real contact differ by a few centimetres: one smoothed contact point so the palm never jumps
        if (!this.cwS) this.cwS = cw0.clone(); else this.cwS.lerp(cw0, 1 - Math.exp(-dt / 0.035));
        const cw = this.cwS;
        if (!this.sw) this.sw = { from: (this.hand ? this.hand.clone() : cock(sh, shot)) };
        if (tau < 0) { const u = clamp((tau + lead) / lead, 0, 1); target = V().lerpVectors(this.sw.from, cw, u * u); }
        else { const u = clamp(tau / 0.32, 0, 1), e = 1 - Math.pow(1 - u, 3); target = V().lerpVectors(cw, follow(shot), e); }
        w = tau < 0.32 ? 1 : 1 - sstep((tau - 0.32) / 0.25);
        nrm = PALM_N(shot, dir); instant = true;
      } else {
        if (tau === null || tau > 0.6) { this.sw = null; this.cwS = null; }
        if (S.mine && this.ready > 0.04) {
          // the receiver's palm waits behind and just above the falling peteca, cocked and tracking it
          const bk = 0.26, a = shot || 'lob';
          const tr = S.ball ? V(S.ball.x - bk * dir, S.ball.y + (a === 'lob' ? -0.12 : a === 'smash' ? 0.14 : 0.04), this.depth) : cock(sh, a);
          // while waiting, the palm tracks the peteca but the elbow stays bent: the arm only extends for the stroke itself
          { const dW = tr.clone().sub(sh), LW = dW.length(); target = LW > 0.4 ? V().copy(sh).addScaledVector(dW, 0.4 / LW) : tr; }
          w = sstep(this.ready * 1.3); nrm = PALM_N(a, dir);
        } else if (S.held && S.ball) {
          target = V(sh.x + 0.12 * dir, sh.y - 0.2, sh.z); w = 0.7; nrm = [0.1 * dir, 1];
        } else if (this.ready > 0.04) {
          target = V(sh.x - 0.06 * dir, sh.y - 0.4, sh.z); w = sstep(this.ready) * 0.55; nrm = [0.1 * dir, 1];
        }
      }
      if (target) {
        const d = target.clone().sub(sh), L = d.length(), RM = 0.6;
        if (L > RM) target.copy(sh).addScaledVector(d, RM / L);
        if (!this.hand) this.hand = target.clone();
        if (instant) this.hand.copy(target); else this.hand.lerp(target, 1 - Math.exp(-dt / 0.06));
        this.handW = instant ? w : damp(this.handW, w, dd, 0.08);
      } else this.handW = damp(this.handW, 0, dd, 0.1);
      if (this.handW > 0.02 && this.hand && nrm) {
        const n = V(nrm[0], nrm[1], 0).normalize(), fx = V(dir, 0, 0);
        const r = solvePalmBall(h, side, this.hand, n, fx, 0.04);
        const high = shot === 'smash' && tau !== null && tau < 0.05;
        const poleT = V(sh.x - 0.15 * dir, sh.y + (high ? 0.25 : -0.05), sh.z + 0.8);
        if (!this.pole) this.pole = poleT.clone(); else this.pole.lerp(poleT, 1 - Math.exp(-dt / 0.06));
        h.setReach(side, r.wrist, { weight: this.handW, quat: r.quat, pole: this.pole });
        h.setFingers(side, 'open');
      } else { h.setReach(side, null); h.setFingers(side, 'relaxed'); }

      // ---- the free arm: holds the peteca for the serve, points at it as it comes, pulls in on the strike, balances in the air
      let offT = null, offW = 0, up = false;
      const shF = h.bonePosition(`${far}_UpperArm`, V());
      if (S.held && S.ball) { offT = V(S.ball.x + 0.02 * dir, S.ball.y - 0.1, this.depth); offW = 1; up = true; }
      else if (inStroke && tau > -0.05 && tau < 0.45) {
        offT = shot === 'smash' ? V(shF.x + 0.24 * dir, shF.y - 0.12, shF.z) : V(shF.x - 0.05 * dir, shF.y - 0.34, shF.z + 0.05);
        offW = 0.85 * (1 - sstep((tau - 0.2) / 0.25));
      } else if (S.mine && this.ready > 0.1) { offT = V(shF.x + 0.13 * dir, shF.y - 0.36, shF.z + 0.1); offW = sstep(this.ready) * 0.8; }   // a bent, relaxed free arm in front of the body (not a straight arm held out)
      else if (this.jumpY > 0.03) { offT = V(shF.x + 0.12 * dir, shF.y - 0.12, shF.z + 0.06); offW = 0.7; }
      if (offT) {
        if (!this.off) this.off = offT.clone();
        this.off.lerp(offT, 1 - Math.exp(-dt / (up ? 0.02 : 0.06)));
        this.offW = damp(this.offW, offW, dd, 0.08);
      } else this.offW = damp(this.offW, 0, dd, 0.1);
      if (this.offW > 0.03 && this.off) h.setReach(far, this.off, { weight: this.offW, pole: V(shF.x - 0.12 * dir, shF.y - 0.45, shF.z - 0.7) });
      else h.setReach(far, null);

      h.update(dt);
    }
  }
  return { Athlete };
}
