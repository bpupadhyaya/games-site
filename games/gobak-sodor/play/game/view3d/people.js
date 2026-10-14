// One player: a real athlete skeleton (view3d Human). The 2D view says which cell the person belongs on and what they are doing; this
// file walks them there and picks the clip. Nothing here feeds back into the simulation, which stays turn based and deterministic.
//
// LOCOMOTION RULE (owner 2026-10-13): everything the legs do is derived from how far THIS figure's displayed root really moved.
//   position   a critically damped, speed-limited follower of the sim cell (no teleports, no snap-backs except a new round)
//   legs       idle when still; walk / jog / sprint or a defender's side-shuffle by speed with hysteresis and crossfades; the playback
//              rate is speed / stride so the cadence is distance driven (feet do not skate)
//   facing     guards face the runners and slide sideways with the arms wide; everybody else turns to the velocity heading at a
//              limited turn rate; standing figures settle to the pose of their role
//   arms       forward kinematics only (no hand IK), so crossfades never pop
import { THREE, buildClip, CLIP_BONES } from '../vendor3d/index.js';

export const SCALE = 1.0;
export const KITS = {
  runner: { top: '#ffd24a', bottoms: '#27408f', socks: '#f6f1e4', shoes: '#f4efe4', trim: '#fff8dc' },
  walker: { top: '#5a66f0', bottoms: '#f1efe6', socks: '#f6f1e4', shoes: '#f4efe4', trim: '#e8ecff' },
  shadow: { top: '#e2402f', bottoms: '#f1efe6', socks: '#f6f1e4', shoes: '#f4efe4', trim: '#fff1d6' },
  sprinter: { top: '#9a5cf0', bottoms: '#f1efe6', socks: '#f6f1e4', shoes: '#f4efe4', trim: '#ffe27a' },
  sodor: { top: '#2b2b36', bottoms: '#f1efe6', socks: '#f6f1e4', shoes: '#f4efe4', trim: '#ffffff' },
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Authored moves (forward kinematics only, so crossfades never pop) -------------------------------------------------------------------------
// guard_ready: the defender's stance: knees bent, weight low, both arms wide as if to block the whole width of the cell, a slow sway.
// guard_shuffle_L / _R: the same stance sliding sideways (lead leg steps out, trail leg closes): one step per 0.6 s at SHUFFLE_V m/s of
//   ground travel; the presenter scales the playback rate by speed / SHUFFLE_V so the cadence follows the real distance.
// run_ready: the runner's start-line crouch, leaning towards the far end, hands loose in front of the hips.
export const SHUFFLE_V = 1.5, BACK_V = 1.57;
function addMoves(h) {
  const S = h.info && h.info.height ? h.info.height / 1.74 : 1;
  const armsWide = (a = 72, b = 76) => ({ L_UpperArm: { abduct: a, flex: 8 }, R_UpperArm: { abduct: b, flex: 8 }, L_Forearm: { flex: 14 }, R_Forearm: { flex: 14 } });
  const crouch = { Pelvis: { pos: [0, -0.17 * S, 0.02 * S], flex: 8 }, Spine1: { flex: 8 }, Head: { flex: -8 }, L_Thigh: { flex: 36, abduct: 12 }, R_Thigh: { flex: 36, abduct: 12 }, L_Calf: { flex: 56 }, R_Calf: { flex: 56 } };
  h.addClip(buildClip(h, {
    name: 'guard_ready', duration: 2.0, loop: true, base: 'idle', grounded: true, fingerHands: { R: 'open', L: 'open' },
    keys: [
      { t: 0, pose: { ...crouch, ...armsWide(70, 74), Pelvis: { ...crouch.Pelvis, side: 3 }, Spine1: { flex: 8, side: -2 } } },
      { t: 1.0, pose: { ...crouch, ...armsWide(76, 70), Pelvis: { ...crouch.Pelvis, side: -3, pos: [0, -0.19 * S, 0.02 * S] }, Spine1: { flex: 10, side: 2 } }, ease: 'inOut' },
      { t: 2.0, pose: { ...crouch, ...armsWide(70, 74), Pelvis: { ...crouch.Pelvis, side: 3 }, Spine1: { flex: 8, side: -2 } }, ease: 'inOut' },
    ],
  }));
  // side shuffle: phase A (0..0.3): lead leg swings out while the trail leg is the stance leg (its angle opens as the body slides over it);
  // phase B (0.3..0.6): lead is the stance leg (angle closes), trail leg swings in. dir = +1 slides to the avatar's left.
  const shuffle = (name, dir) => {
    const lead = dir > 0 ? 'L' : 'R', trail = dir > 0 ? 'R' : 'L';
    const leg = (side, ab, fl, kn) => ({ [side + '_Thigh']: { abduct: ab, flex: fl }, [side + '_Calf']: { flex: kn } });
    const key = (t, lAb, lFl, lKn, tAb, tFl, tKn, sway, a1, a2) => ({
      t, pose: { Pelvis: { pos: [0, -0.2 * S, 0.02 * S], flex: 8, side: sway * dir }, Spine1: { flex: 9, side: -sway * dir * 0.8 }, Head: { flex: -8 },
        ...leg(lead, lAb, lFl, lKn), ...leg(trail, tAb, tFl, tKn), ...armsWide(a1, a2) }, ease: 'inOut',
    });
    return buildClip(h, {
      name, duration: 0.6, loop: true, base: 'idle', grounded: true, group: 'locomotion', fingerHands: { R: 'open', L: 'open' },
      keys: [
        key(0.0, 5, 34, 54, 20, 34, 54, 3, 70, 70),
        key(0.15, 20, 52, 82, 26, 36, 56, 1, 76, 74),   // lead foot lifted and swinging out
        key(0.3, 30, 36, 58, 34, 38, 58, -3, 74, 74),
        key(0.45, 18, 34, 54, 42, 54, 84, -1, 70, 72),  // trail foot lifted and swinging in
        key(0.6, 5, 34, 54, 20, 34, 54, 3, 70, 70),
      ],
    });
  };
  h.addClip(shuffle('guard_shuffle_L', 1)); h.addClip(shuffle('guard_shuffle_R', -1));
  // back-pedal: root travels backwards at BACK_V while each stance foot slides forward under the hips; the swing leg lifts and reaches back
  {
    const bk = (t, l, lk, r, rk, sway) => ({ t, pose: { Pelvis: { pos: [0, -0.2 * S, 0.0], flex: 6, side: sway }, Spine1: { flex: 8, side: -sway * 0.8 }, Head: { flex: -6 },
      L_Thigh: { flex: l, abduct: 10 }, L_Calf: { flex: lk }, R_Thigh: { flex: r, abduct: 10 }, R_Calf: { flex: rk }, ...armsWide(72, 72) }, ease: 'inOut' });
    h.addClip(buildClip(h, { name: 'guard_back', duration: 0.7, loop: true, base: 'idle', grounded: true, group: 'locomotion', fingerHands: { R: 'open', L: 'open' },
      keys: [bk(0, -10, 50, 30, 52, 2), bk(0.175, 8, 52, 12, 88, 0), bk(0.35, 30, 52, -10, 50, -2), bk(0.525, 12, 88, 8, 52, 0), bk(0.7, -10, 50, 30, 52, 2)] }));
  }
  const lean = { Pelvis: { pos: [0, -0.07 * S, 0.03 * S], flex: 10 }, Spine1: { flex: 14 }, Spine2: { flex: 6 }, Head: { flex: -12 }, L_Thigh: { flex: 18 }, R_Thigh: { flex: 18 }, L_Calf: { flex: 26 }, R_Calf: { flex: 26 },
    L_UpperArm: { flex: 22, abduct: 12 }, R_UpperArm: { flex: 22, abduct: 12 }, L_Forearm: { flex: 36 }, R_Forearm: { flex: 36 } };
  h.addClip(buildClip(h, {
    name: 'run_ready', duration: 1.8, loop: true, base: 'idle', grounded: true, fingerHands: { R: 'relaxed', L: 'relaxed' },
    keys: [{ t: 0, pose: lean }, { t: 0.9, pose: { ...lean, Spine1: { flex: 16 }, Pelvis: { ...lean.Pelvis, pos: [0, -0.08 * S, 0.03 * S] }, L_UpperArm: { flex: 26, abduct: 14 }, R_UpperArm: { flex: 18, abduct: 10 } }, ease: 'inOut' }, { t: 1.8, pose: lean, ease: 'inOut' }],
  }));
}

// gaits of the library clips: nominal ground speed v (m/s at playback 1) and the speed at which the gait is chosen on the way up
const GAITS = [
  { name: 'walk', lo: 0, v: 1.4 }, { name: 'jog_slow', lo: 1.9, v: 2.41 }, { name: 'jog', lo: 2.8, v: 3.07 }, { name: 'sprint', lo: 4.2, v: 5.84 },
];

export class Person {
  /** human: the view3d Human. */
  constructor(human) {
    this.h = human;
    addMoves(human);
    human.turnRate = 0;                  // yaw is smoothed here and written onto the root every frame
    human.groundClamp = 'auto'; human.footPlanting = true;
    this.disp = null;                    // displayed root {x, z}
    this.vx = 0; this.vz = 0; this.sx = 0; this.sz = 0;    // smoothed velocity of the drawn root; the spring's own velocity
    this.yaw = 0; this.heading = 0; this.speed = 0;
    this.t = 0; this.state = ''; this.kit = ''; this.gait = null; this.shuffle = 0; this.moving = false; this.lat = false;
    this.holdUntil = -1; this.dust = 0; this.clip = ''; this.want = '';
    this.sc = SCALE * (human.info && human.info.height ? human.info.height / 1.74 : 1);
    human.play('idle', { fade: 0 });
  }
  get pos() { return this.disp || { x: 0, z: 0 }; }
  dress(kind) { if (this.kit !== kind) { this.kit = kind; this.h.setKit(KITS[kind]); } }

  _still(name, fade = 0.28) {
    this.gait = null; this.shuffle = 0;
    const cur = this.h.layers.base.current;
    if (this.clip !== name || !cur || cur.clip.name !== name || cur.target === 0) { this.h.play(name, { fade, loop: true }); this.clip = name; }
  }
  _gait(v) {
    let want = GAITS[0];
    for (const g of GAITS) if (v >= g.lo) want = g;
    if (this.gait && this.gait !== want) {            // hysteresis: stay in the gait until the speed is clearly outside its band
      const i = GAITS.indexOf(this.gait), lo = this.gait.lo * 0.88, hi = GAITS[i + 1] ? GAITS[i + 1].lo * 1.12 : 1e9;
      if (v >= lo && v < hi) want = this.gait;
    }
    this._play(want.name, v / (want.v * this.sc), 0.22);
    this.gait = want; this.shuffle = 0;
  }
  _shuffle(sign, v) {
    this._play(sign > 0 ? 'guard_shuffle_L' : 'guard_shuffle_R', v / (SHUFFLE_V * this.sc), 0.18);
    this.gait = null; this.shuffle = sign;
  }
  _back(v) {
    this._play('guard_back', v / (BACK_V * this.sc), 0.18);
    this.gait = null; this.shuffle = 0;
  }
  _play(name, rate, fade) {
    const h = this.h, cur = h.layers.base.current;
    if (!cur || cur.clip.name !== name || cur.target === 0) {
      const opts = { fade, loop: true };
      if (cur && cur.clip.loop && cur.clip.events.footL !== undefined && h.clips[name].events.footL !== undefined) {   // phase-aligned crossfade
        const a = cur.clip, b = h.clips[name];
        const ph = (((cur.time - a.events.footL) / a.dur) % 1 + 1) % 1;
        opts.startTime = (b.events.footL + ph * b.dur) % b.dur;
      }
      h.play(name, opts);
    }
    const tr = h.layers.base.current; tr.speed = clamp(rate, 0.35, 2.4);
    this.clip = name;
  }

  /**
   * e: { role: 'runner'|'guard'|'sodor', kind, state, dash } from the 2D view; [tx, tz] metres; dt sim seconds.
   * ctx: { look: {x, z}|null, puff(kind, x, z, k) }
   */
  drive(e, [tx, tz], dt, snap, ctx = {}) {
    const h = this.h;
    h.root.visible = true;
    this.dress(e.role === 'runner' ? 'runner' : e.kind);
    const guardish = e.role !== 'runner';
    if (!this.disp || snap) {
      this.disp = { x: tx, z: tz }; this.vx = this.vz = this.sx = this.sz = 0; this.speed = 0; this.moving = false; this.gait = null; this.shuffle = 0;
      this.yaw = guardish ? 0 : (e.state === 'down' || e.state === 'home' ? 0 : Math.PI); this.state = e.state; this.holdUntil = -1;
      this._px = tx; this._pz = tz;
      h.setFacing(this.yaw, { snap: true }); h.setPosition(tx, 0, tz); this.clip = ''; this._pq = null; return;
    }
    // state changes: a tagged runner flinches where he stands before walking off to the bench; a runner home throws confetti
    if (this.state !== e.state) {
      if (e.role === 'runner' && e.state === 'out') { this.holdUntil = this.t + 0.5; h.play('hit', { fade: 0.06, loop: false }); this.clip = 'hit'; }
      if (e.role === 'runner' && e.state === 'home' && ctx.puff) ctx.puff('confetti', tx, tz, 1);
      this.state = e.state;
    }
    // ------------------------------------------------ the displayed root follows the sim cell (acceleration limited, no overshoot)
    // desired velocity: towards the cell, never faster than the role's top speed nor than can be braked to a stop on the cell
    const hold = this.t < this.holdUntil;
    const dx = tx - this.disp.x, dz = tz - this.disp.z, d = Math.hypot(dx, dz);
    if (d > 4.2) { this.disp.x = tx; this.disp.z = tz; this.sx = this.sz = 0; this._px = tx; this._pz = tz; }
    else if (dt > 0) {
      const maxSp = e.role === 'runner' ? (e.state === 'out' ? 2.0 : 3.6) : e.dash ? 6.0 : 3.4, A = e.dash ? 20 : 15;
      let wx = 0, wz = 0;
      if (!hold && d > 1e-3) {
        let sp = Math.min(maxSp, Math.sqrt(2 * A * 0.8 * d), d / dt);
        // a runner who has to turn more than ~50 degrees pivots first (a short step), then sets off: legs never run sideways to the heading
        if (e.role === 'runner' && d > 0.12 && Math.hypot(this.sx, this.sz) < 1.5 && Math.abs(wrap(Math.atan2(dx, dz) - this.yaw)) > 0.9) sp = Math.min(sp, 0.1);
        wx = dx / d * sp; wz = dz / d * sp;
      }
      this.wx = wx; this.wz = wz;
      const ex = wx - this.sx, ez = wz - this.sz, el = Math.hypot(ex, ez), m = A * dt;
      if (el > m) { this.sx += ex / el * m; this.sz += ez / el * m; } else { this.sx = wx; this.sz = wz; }
      this.disp.x += this.sx * dt; this.disp.z += this.sz * dt;
    }
    // measured velocity of what is actually drawn: this, and only this, drives the legs and the heading
    const px = this.disp.x - (this._px ?? this.disp.x), pz = this.disp.z - (this._pz ?? this.disp.z);
    this._px = this.disp.x; this._pz = this.disp.z;
    if (dt > 0) { const a = 1 - Math.exp(-dt / 0.05); this.vx += (px / dt - this.vx) * a; this.vz += (pz / dt - this.vz) * a; }
    const sp = Math.hypot(this.vx, this.vz);
    this.speed = sp;
    const cmdOn = Math.hypot(this.wx || 0, this.wz || 0) > 0.6 && !hold;
    this.moving = this.moving ? (sp > 0.28 || cmdOn) : (sp > 0.55 || (cmdOn && sp > 0.12));   // hysteresis: idle when still; the step starts with the push
    if (this.moving) this.heading = Math.atan2(this.vx, this.vz);
    // the commanded heading (where the acceleration points) leads the measured one by a few frames, so the turn starts with the step
    const cmd = sp < 1.4 && Math.hypot(this.wx || 0, this.wz || 0) > 0.25 && !(this.t < this.holdUntil) ? Math.atan2(this.wx, this.wz) : this.heading;
    // ------------------------------------------------ facing
    let want, rate;
    if (guardish) {
      // defenders face the runners (yaw 0, towards the home end) and slide sideways; a fast dash or a retreat turns them to the heading
      const ux = cmdOn && sp < 1.2 ? this.wx : this.vx, uz = cmdOn && sp < 1.2 ? this.wz : this.vz;
      this.lat = this.moving && Math.abs(ux) > Math.abs(uz) * 1.4 && Math.max(sp, Math.hypot(this.wx || 0, this.wz || 0)) < 3.9;
      this.back = this.moving && !this.lat && uz < -0.2 && Math.max(sp, Math.hypot(this.wx || 0, this.wz || 0)) < 3.9;      // a retreat is a back-pedal: still facing the runners
      want = !this.moving || this.lat || this.back ? 0 : cmd;
      rate = this.moving ? 16 : 6;
    } else {
      this.lat = false; this.back = false;
      const idleWant = e.state === 'up' || e.state === 'out' ? Math.PI : 0;
      want = this.moving ? cmd : idleWant;
      rate = this.moving ? 16 : 5;
    }
    if (dt > 0) { const dd = wrap(want - this.yaw), m = rate * dt; this.yaw = wrap(this.yaw + (Math.abs(dd) <= m ? dd : Math.sign(dd) * m)); }
    h.setFacing(this.yaw, { snap: true });
    // the head follows the nearest runner (guards)
    if (h.lookAt && dt > 0) {
      const lk = ctx.look;
      if (lk) { if (this.lx === undefined) { this.lx = lk.x; this.lz = lk.z; } const a = 1 - Math.exp(-dt / 0.18); this.lx += (lk.x - this.lx) * a; this.lz += (lk.z - this.lz) * a; }
      this.lw = (this.lw || 0) + ((lk ? 0.7 : 0) - (this.lw || 0)) * (1 - Math.exp(-dt / 0.25));
      if (this.lw > 0.02 && this.lx !== undefined) h.lookAt({ x: this.lx, y: 1.4 * this.sc, z: this.lz }, { weight: this.lw }); else h.lookAt(null);
    }
    // ------------------------------------------------ the legs
    if (this.t < this.holdUntil) return;                       // the flinch is playing
    if (this.moving) {
      if (this.lat) this._shuffle((cmdOn && sp < 1.2 ? this.wx : this.vx) > 0 ? 1 : -1, sp); else if (this.back) this._back(sp); else this._gait(sp);
      this.dust += sp * dt;                                    // dust kicked up by the feet, every ~0.9 m at a jog or faster
      if (this.dust > 0.9 && sp > 2.2) { this.dust = 0; if (ctx.puff) ctx.puff('dust', this.disp.x, this.disp.z, clamp(sp / 4, 0.6, 1.6)); }
      return;
    }
    this.dust = 0;
    const name = e.role === 'runner' ? (e.state === 'home' ? 'cheer' : e.state === 'out' ? 'crouch_idle' : 'run_ready') : 'guard_ready';
    this._still(name, 0.28);
  }
  update(dt) {
    this.t += dt;
    if (this.disp) this.h.setPosition(this.disp.x, 0, this.disp.z);
  }
  /**
   * After the pose of the frame exists: a short low-pass on every bone rotation (30-60 ms). It removes the single-frame flicks of the
   * base clips (wrists) and of the foot planter (knees) so no joint pops, and it is far below what the eye can read as lag.
   */
  post(dt) {
    const bs = this.h._bones22;
    if (!bs || !(dt > 0)) return;
    if (!this._pq) {
      this._pq = bs.map((b) => b.quaternion.clone());
      this._tau = CLIP_BONES.map((n) => (/Hand|Forearm/.test(n) ? 0.06 : /Head|Neck/.test(n) ? 0.05 : 0.03));
      return;
    }
    for (let i = 0; i < bs.length; i++) {
      const a = 1 - Math.exp(-dt / this._tau[i]);
      this._pq[i].slerp(bs[i].quaternion, a);
      bs[i].quaternion.copy(this._pq[i]);
    }
    if (this.h.limbSanity) this.h.limbSanity();   // view3d 1.11: re-clamp joints after the low-pass
  }
}

export { clamp };
