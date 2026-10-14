// The motion of Elastic Jump, as pure functions of the engine's beat times and tap records. Presentation only: it READS the run
// (`run.t`, the beat, the routine, the taps) and never writes back.
//
// World: the band runs along X. The two holders stand at x = -HX and x = +HX, facing each other, the band round their legs at the level's
// height as two parallel strands at z = -STRAND_Z (far strand) and z = +STRAND_Z (near strand, the jumper's own side). The jumper stands
// between them facing -Z (across the band) and lands OUT (own side, z > 0), IN (z = 0), ON (one foot on each strand) or SPLIT (one foot
// in front of both strands, one behind both). The camera sits on the far side, so the jumper's face and both feet are visible.
export const HX = 1.25;
export const STRAND_Z = 0.24;
// strand heights (m above the ground) for the eight levels: ankles, calves, knees, thighs, hips, waist, armpits, neck
export const LEVEL_H = [0.09, 0.26, 0.47, 0.65, 0.9, 1.06, 1.26, 1.44];
export const G = 9.81;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// Where the two feet stand for each landing, in world metres. "Left" is the avatar's left (it faces -Z, so left is world -X).
export function placement(pose, parity = 0) {
  const f = parity & 1;
  switch (pose) {
    case 0: return { L: { x: -0.3, z: 0.6 }, R: { x: -0.12, z: 0.58 } };                                   // OUT: both in front of the band, own side
    case 1: return { L: { x: -0.085, z: 0.012 }, R: { x: 0.085, z: -0.012 } };                              // IN: both between the strands
    case 2: return f ? { L: { x: -0.1, z: STRAND_Z }, R: { x: 0.1, z: -STRAND_Z } } : { L: { x: -0.1, z: -STRAND_Z }, R: { x: 0.1, z: STRAND_Z } };   // ON
    default: return f ? { L: { x: -0.115, z: 0.42 }, R: { x: 0.115, z: -0.42 } } : { L: { x: -0.115, z: -0.42 }, R: { x: 0.115, z: 0.42 } };       // SPLIT
  }
}

// ---- the jumper's state machine ------------------------------------------------------------------------------------------------------
// Landings are on the beat. The jumper bounces on every beat; on a beat that carries a step it makes a bigger hop. In the air the legs are
// tucked and the feet reach for the tapped landing; if the tap has not come when the beat arrives the jumper hangs a moment inside the
// timing window and lands the instant the tap comes (contact = max(beat, tap time)). A tap that comes after the landing is a quick re-hop.
export class JumperCtl {
  constructor() { this.reset(); }
  reset() {
    this.t = 0; this.ph = 'ground'; this.pose = 0; this.parity = 0; this.rest = placement(0, 0);
    this.A = this.rest; this.B = this.rest; this.Bpose = 0; this.tLand = -9; this.tTo = 0; this.landT = 0; this.Tair = 0; this.H = 0; this.big = false;
    this.seen = -1; this.tapSince = false; this.tapT = -1; this.hang = false; this.hangT = 0; this.landHadTap = false; this.pending = null;
    this.corr = null; this.lastT = 0.2; this.presses = [[], []]; this.landed = 0; this.lastKind = 'bounce'; this.landCount = 0; this.nextLand = null; this.move = null; this.queued = undefined; this.D = 0.045;
  }
  // the next landing beat: strictly after the last landing and far enough away for a flight
  planNext(time, beat, moves) {
    for (let k = Math.max(0, Math.floor(time / beat)); k < Math.floor(time / beat) + 8; k++) {
      const lt = k * beat;
      if (lt <= this.tLand + 0.06 || lt - time < 0.1) continue;
      const m = moves.find((mm) => Math.abs(mm.t - lt) < 1e-4);
      const big = !!m;
      return { landT: lt, big, Tair: Math.min(big ? 0.34 : 0.22, beat * (big ? 0.78 : 0.56)), move: m || null };
    }
    return null;
  }
  tap(tp, time) {
    this.seen = tp.n;
    if (this.ph === 'air') {
      // a different landing than the one the jumper was reaching for: blend the feet over to it instead of snapping
      if (tp.pose !== this.Bpose) { const cur = this.sample(); this.corr = { L: cur.L, R: cur.R, t0: time }; }
      this.Bpose = tp.pose; this.tapSince = true; this.tapT = tp.t; return;
    }
    // on the ground: a re-hop when it follows a landing that had no tap, otherwise the next flight carries it
    if (!this.landHadTap && time - this.tLand < 0.3) {
      this.startAir(this.rest, tp.pose, tp.t, tp.t + 0.17, 0.17, false, 0.022);
      this.tapSince = true; this.tapT = tp.t; this.move = null;
    } else { this.queued = tp.pose; }
  }
  startAir(A, pose, tTo, landT, Tair, big, D = big ? 0.085 : 0.045) {
    this.ph = 'air'; this.D = D; this.A = A; this.Bpose = pose; this.tTo = tTo; this.landT = landT; this.Tair = Tair; this.big = big;
    this.H = (G * Tair * Tair) / 8; this.tapSince = false; this.hang = false; this.nextLand = null;
    // takeoff releases anything the feet were pressing
    for (const arr of this.presses) for (const p of arr) if (p.t1 === Infinity) p.t1 = tTo;
  }
  // advance to time `T` (run clock). run = { beat, moves, winOk, taps }
  advance(T, run, dtStep = 1 / 120) {
    if (T < this.t - 1e-6) { this.reset(); }
    if (T - this.t > 1.2) {
      // a jump in time (a screenshot, a restored scene): start one second before, standing where the last earlier tap put the feet
      const t0 = T - 1.2;
      let pose = this.pose, seen = this.seen;
      for (const tp of run.taps) if (tp.t <= t0) { pose = tp.pose; seen = Math.max(seen, tp.n); }
      const was = this.landCount;
      this.reset(); this.landCount = was; this.pose = pose; this.Bpose = pose; this.rest = placement(pose, this.landCount); this.A = this.rest; this.B = this.rest;
      this.seen = seen; this.t = t0; this.tLand = t0 - 0.4; this.landHadTap = true;
    }
    const beat = run.beat;
    let guard = 0;
    while (this.t < T - 1e-9 && guard++ < 4000) {
      const time = Math.min(T, this.t + dtStep);
      this.t = time;
      for (const tp of run.taps) if (tp.n > this.seen && tp.t <= time + 1e-9) this.tap(tp, time);
      if (this.ph === 'ground') {
        if (!this.nextLand) this.nextLand = this.planNext(time, beat, run.moves);
        const nl = this.nextLand;
        if (nl && time >= nl.landT - nl.Tair - 1e-9) {
          const B = nl.move && nl.move.pose !== undefined ? nl.move.pose : (this.queued !== undefined ? this.queued : this.pose);
          this.queued = undefined;
          const Ta = Math.min(nl.Tair, Math.max(0.1, nl.landT - time));
          this.startAir(this.rest, B, nl.landT - Ta, nl.landT, Ta, nl.big);
          this.tapSince = B !== this.pose; if (this.tapSince) this.tapT = time;
          this.move = nl.move;
        }
      }
      if (this.ph === 'air' && time >= this.landT - 1e-9) {
        // inside the window with no tap yet: hang
        const m = this.move;
        const waiting = m && !m.j && !this.tapSince && time < m.t + run.winOk;
        if (waiting) { this.hang = true; this.hangT = time - this.landT; }
        else this.land(this.tapSince ? Math.max(this.landT, this.tapT) : Math.max(this.landT, this.hang ? time : this.landT), run);
      }
    }
  }
  land(tc, run) {
    this.ph = 'ground'; this.hang = false;
    this.pose = this.Bpose; this.landCount += 1; this.parity = this.landCount;
    const pl = placement(this.pose, this.parity);
    this.rest = pl; this.A = pl; this.B = pl;
    this.tLand = tc; this.landHadTap = this.tapSince; this.lastKind = this.big ? 'step' : 'bounce'; this.lastT = this.Tair; this.landed = tc;
    this.nextLand = null; this.move = null;
    if (this.pose === 2) {
      // ON: the front foot presses the far strand, the back foot the near strand; the feet's x says where
      const front = pl.L.z < 0 ? pl.L : pl.R, back = pl.L.z < 0 ? pl.R : pl.L;
      this.presses[0].push({ x: front.x, t0: tc, t1: Infinity }); this.presses[1].push({ x: back.x, t0: tc, t1: Infinity });
      for (const arr of this.presses) while (arr.length > 4) arr.shift();
    }
  }
  // the pose parameters at the current time
  sample() {
    const T = this.t;
    const o = { ph: this.ph, rise: 0, tuck: 0, dip: 0, arm: 0, spread: 0, u: 0, L: this.rest.L, R: this.rest.R, ts: T - this.tLand, big: this.lastKind === 'step', pose: this.pose, from: this.pose };
    if (this.ph === 'air') {
      const span = Math.max(1e-4, this.landT - this.tTo);
      const u = clamp((T - this.tTo) / span, 0, 1);
      const D = this.D;
      o.u = u;
      o.rise = 4 * this.H * u * (1 - u);
      o.dip = -D * Math.pow(1 - u, 3);
      o.tuck = smooth(u / 0.3) * smooth((1 - u) / 0.3) * (this.big ? 1 : 0.7);   // flat-topped, zero slope at both ends (no velocity spike at toe-off / contact)
      if (this.hang) { const k = smooth((T - this.landT) / 0.06); o.rise = 0.012 * k; o.tuck = 0.35 * k; o.u = 1; }   // eases in: no pop when the beat arrives before the tap
      const e = smooth((u - 0.04) / 0.8);
      const Bp = placement(this.Bpose, this.landCount + 1);
      o.L = { x: lerp(this.A.L.x, Bp.L.x, e), z: lerp(this.A.L.z, Bp.L.z, e) };
      o.R = { x: lerp(this.A.R.x, Bp.R.x, e), z: lerp(this.A.R.z, Bp.R.z, e) };
      if (this.corr) {
        const k = smooth((T - this.corr.t0) / 0.09);
        if (k >= 1) this.corr = null;
        else { const c = this.corr; o.L = { x: lerp(c.L.x, o.L.x, k), z: lerp(c.L.z, o.L.z, k) }; o.R = { x: lerp(c.R.x, o.R.x, k), z: lerp(c.R.z, o.R.z, k) }; }
      }
      o.from = this.pose; o.pose = this.Bpose;
      // arms: back at the dip, up and forward at the apex, coming down for the landing
      o.arm = u < 0.35 ? lerp(-0.7, 1, smooth(u / 0.35)) : 1 - 0.7 * smooth((u - 0.5) / 0.5);
      o.spread = (this.Bpose === 2 || this.Bpose === 3 ? 1 : 0) * smooth((u - 0.2) / 0.6);
    } else {
      const ts = T - this.tLand;
      // landing absorption: the body keeps moving down at the speed it arrived with (ballistic g*T/2) and the knees take it up over tau,
      // so the pelvis velocity is continuous at contact (peak dip D, peak speed at contact = D*e/tau)
      const D = this.lastKind === 'step' ? 0.085 : 0.045, tau = clamp(D * Math.E / Math.max(0.5, G * this.lastT / 2), 0.07, 0.2);
      const env = ts < 0 ? 0 : (ts / tau) * Math.exp(1 - ts / tau);
      o.dip = -D * env;
      o.arm = 0.3 * Math.exp(-Math.max(0, ts) / 0.14);
      o.spread = (this.pose === 2 || this.pose === 3 ? 1 : 0);
      if (this.corr) {
        const k = smooth((T - this.corr.t0) / 0.09);
        if (k >= 1) this.corr = null;
        else { const c = this.corr; o.L = { x: lerp(c.L.x, o.L.x, k), z: lerp(c.L.z, o.L.z, k) }; o.R = { x: lerp(c.R.x, o.R.x, k), z: lerp(c.R.z, o.R.z, k) }; }
      }
      // anticipation before the next take-off
      const nl = this.nextLand;
      if (nl) { const tt = nl.landT - nl.Tair - T; if (tt < 0.1 && tt > -0.01) { const k = smooth(1 - tt / 0.1); o.dip += -(nl.big ? 0.085 : 0.045) * k; o.arm = Math.min(o.arm, 0) + -0.7 * k; } }
    }
    return o;
  }
  // press depth profile for strand i at the current time: a list of { x, depth01, ripple }
  strandPresses(i, T) {
    const out = [];
    for (const p of this.presses[i]) {
      if (T < p.t0) continue;
      if (p.t1 === Infinity) out.push({ x: p.x, a: smooth((T - p.t0) / 0.045) });
      else {
        const dt = T - p.t1;
        const a0 = smooth((p.t1 - p.t0) / 0.045);
        out.push({ x: p.x, a: a0 * Math.exp(-5.5 * dt) * Math.cos(2 * Math.PI * 4.2 * dt) });
      }
    }
    return out.filter((p) => Math.abs(p.a) > 0.002);
  }
}
