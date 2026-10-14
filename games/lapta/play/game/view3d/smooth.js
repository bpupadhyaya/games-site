// Motion smoothing for the people (presentation only; the simulation never reads it).
//  * Inertializer: after the library has posed a figure (clip blend, IK, planted feet), any bone whose rotation jumps in one frame (a clip switch, an
//    IK target switching on or off, a hand taking or leaving a prop) has the jump absorbed into an offset that decays with a critically damped spring,
//    so the pose continues from where it was and arrives at the new pose without a pop and without lag once settled.
//  * Aim: smooths a world IK target (ball, catch point, bat sweet spot) the library reads each frame: it starts from where the hand already is, follows
//    the live target with no lag (the error decays, the target's own motion passes straight through) and swallows teleports.
export function createSmoothing(THREE) {
  const { Quaternion, Vector3 } = THREE;
  const qa = new Quaternion(), qb = new Quaternion(), qc = new Quaternion(), v3 = new Vector3(), tmp = new Vector3(), tmp2 = new Vector3();
  const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)));
  const toRot = (q, out) => { // quaternion -> rotation vector
    let w = q.w, x = q.x, y = q.y, z = q.z;
    if (w < 0) { w = -w; x = -x; y = -y; z = -z; }
    const s = Math.sqrt(x * x + y * y + z * z);
    if (s < 1e-6) return out.set(0, 0, 0);
    const a = 2 * Math.atan2(s, w);
    return out.set(x / s * a, y / s * a, z / s * a);
  };
  const fromRot = (r, out) => {
    const a = r.length();
    if (a < 1e-6) return out.set(0, 0, 0, 1);
    const s = Math.sin(a / 2) / a;
    return out.set(r.x * s, r.y * s, r.z * s, Math.cos(a / 2));
  };

  /** one per figure */
  function Inertializer(human, { omega = 15, jumpMin = 0.2, jumpRatio = 4, jumpConst = 0.08, jumpAbs = 0.45, sensMin = 0.06, sensRatio = 2, velocityContinuity = false } = {}) {
    const bones = human._bones22, n = bones.length;
    const prevRaw = bones.map(() => new Quaternion()), prevOut = bones.map(() => new Quaternion());
    const ring = bones.map(() => new Float32Array(6)); let ri = 0;
    const medOf = (a) => { const t = Array.from(a).sort((x, y) => x - y); return (t[2] + t[3]) / 2; };
    const r = bones.map(() => new Vector3()), v = bones.map(() => new Vector3()), o = bones.map(() => new Quaternion());
    const pelvisPos = { raw: new Vector3(), out: new Vector3(), off: new Vector3(), vel: new Vector3(), has: false };
    const pend = new Uint8Array(n), outVel = bones.map(() => new Vector3()), jumpVel = bones.map(() => new Vector3());
    let init = false, lastName = '', sens = 0;
    this.stats = { jumps: 0 };
    this.dbg = { raw: bones.map(() => new Quaternion()), jump: new Uint8Array(n) };
    this.reset = () => { init = false; };
    this.apply = (dt) => {
      if (dt <= 1e-6) {
        // no time passed: the figure was re-posed from the same clip time, re-apply the standing offsets
        if (init) { for (let i = 0; i < n; i++) { fromRot(r[i], o[i]); bones[i].quaternion.premultiply(o[i]); } }
        return;
      }
      const pel = human.pelvis;
      if (!init) {
        for (let i = 0; i < n; i++) { prevRaw[i].copy(bones[i].quaternion); prevOut[i].copy(bones[i].quaternion); r[i].set(0, 0, 0); v[i].set(0, 0, 0); ring[i].fill(0); pend[i] = 0; outVel[i].set(0, 0, 0); }
        pelvisPos.raw.copy(pel.position); pelvisPos.out.copy(pel.position); pelvisPos.off.set(0, 0, 0); pelvisPos.vel.set(0, 0, 0);
        init = true; return;
      }
      ri++;
      // right after a clip switch every bone is checked with a much finer net: a transition is exactly where a one-frame snap hides
      const cur = human.layers.base.current, nm = cur ? cur.clip.name : '';
      if (nm !== lastName) { lastName = nm; sens = 8; }
      const jm = sens > 0 ? sensMin : jumpMin, jr = sens > 0 ? sensRatio : jumpRatio, jc = sens > 0 ? 0.02 : jumpConst;
      if (sens > 0) sens--;
      const w2 = omega * omega;
      for (let i = 0; i < n; i++) {
        const b = bones[i], raw = qa.copy(b.quaternion);
        const step = angle(raw, prevRaw[i]);
        this.dbg.raw[i].copy(raw); this.dbg.jump[i] = 0;
        if (pend[i]) {
          // the frame after a jump: the new clip's own velocity is known now. Continue the OLD motion for this frame and let the offset carry the
          // velocity difference, so position and speed are both continuous (a hold followed by a lurch is a pop of its own)
          qb.copy(raw).multiply(qc.copy(prevRaw[i]).invert());                 // raw step (parent-local, left-multiplied)
          toRot(qb, tmp).multiplyScalar(1 / dt);                                // raw angular velocity
          fromRot(tmp2.copy(jumpVel[i]).multiplyScalar(dt), qb);               // old velocity over this frame
          qb.multiply(prevOut[i]);                                              // where the old motion would be
          qb.multiply(qc.copy(raw).invert());                                   // offset that puts us there
          toRot(qb, r[i]);
          v[i].copy(jumpVel[i]).sub(tmp); if (v[i].length() > 40) v[i].setLength(40);
          pend[i] = 0;
        } else {
          // advance the standing offset (critically damped on the rotation vector)
          v[i].addScaledVector(r[i], -w2 * dt).addScaledVector(v[i], -2 * omega * dt);
          r[i].addScaledVector(v[i], dt);
          const med = medOf(ring[i]);
          if ((step > jm && step > jr * med + jc) || step > jumpAbs) {
            // jump: hold the output where it was; the next frame restores its velocity
            qb.copy(prevOut[i]).multiply(qa.clone().invert());       // out = o * raw
            toRot(qb, r[i]); v[i].set(0, 0, 0);
            jumpVel[i].copy(outVel[i]); pend[i] = velocityContinuity ? 1 : 0;
            this.stats.jumps++; this.dbg.jump[i] = 1;
          }
        }
        fromRot(r[i], o[i]);
        ring[i][ri % 6] = step;
        prevRaw[i].copy(raw);
        b.quaternion.copy(o[i]).multiply(raw);
        // the output's own angular velocity (for the next jump)
        qb.copy(b.quaternion).multiply(qc.copy(prevOut[i]).invert()); toRot(qb, outVel[i]).multiplyScalar(1 / dt);
        prevOut[i].copy(b.quaternion);
      }
      // the pelvis position (the hips drop and rise with the clip) gets the same treatment
      {
        const raw = v3.copy(pel.position), pp = pelvisPos;
        pp.vel.addScaledVector(pp.off, -w2 * dt).addScaledVector(pp.vel, -2 * omega * dt);
        pp.off.addScaledVector(pp.vel, dt);
        const jump = raw.distanceTo(pp.raw);
        if (jump > 0.06 + 3 * (pp.step || 0)) { pp.off.copy(pp.out).sub(raw); pp.vel.multiplyScalar(0.3); }
        pp.step = jump; pp.raw.copy(raw);
        pel.position.copy(raw).add(pp.off); pp.out.copy(pel.position);
      }
    };
  }

  /** Smoothed world target for one figure and one named IK target. */
  function Aim({ omega = 24, teleport = 0.7 } = {}) {
    const e = new Vector3(), ev = new Vector3(), last = new Vector3(), out = new Vector3();
    let has = false;
    this.active = () => has;
    /** pt = live target or null; start = where the effector is now (used when the target first appears). Returns the point to hand to setTarget or null. */
    this.step = (pt, start, dt) => {
      if (!pt) { has = false; return null; }
      if (!has) { has = true; e.set(0, 0, 0); ev.set(0, 0, 0); if (start) e.copy(start).sub(pt); last.copy(pt); }
      else if (last.distanceTo(pt) > teleport) e.add(last).sub(pt);
      last.set(pt.x, pt.y, pt.z);
      const d = Math.min(0.05, dt);
      ev.addScaledVector(e, -omega * omega * d).addScaledVector(ev, -2 * omega * d);
      e.addScaledVector(ev, d);
      return out.set(pt.x, pt.y, pt.z).add(e);
    };
  }
  return { Inertializer, Aim };
}
