// Tiny deterministic animation system for the Rocketbox "Bip01" rig (see docs/FORMATS.md).
// No wall clock, no rAF: everything advances only by the dt you pass to update().
import { CLIP_BONES } from './clipcodec.js';

export const NB = CLIP_BONES.length; // 22 animated bones

export const ease = {
  linear: (x) => x,
  in: (x) => x * x,
  out: (x) => 1 - (1 - x) * (1 - x),
  inOut: (x) => x * x * (3 - 2 * x),
  smoother: (x) => x * x * x * (x * (x * 6 - 15) + 10),
  backOut: (x) => { const c = 1.70158; const y = x - 1; return 1 + (c + 1) * y * y * y + c * y * y; },
  hold: (x) => (x < 1 ? 0 : 1),
};

/** A sampled clip. quats: Float32Array(frames*NB*4) local rotations, pelvis: Float32Array(frames*3) delta in pelvisHeight units. */
export class Clip {
  constructor(o) {
    this.name = o.name;
    this.frames = o.frames;
    this.dur = o.dur;
    this.fps = o.fps || 30;
    this.loop = !!o.loop;
    this.quats = o.quats;
    this.pelvis = o.pelvis;
    this.events = o.events || {};
    this.speed = o.speed || 0;
    this.travel = o.travel || [0, 0, 0];
    this.group = o.group || 'misc';
    this.fingers = o.fingers || 'relaxed';
    this.source = o.source || '';
    this.note = o.note || '';
    this.grounded = o.grounded !== undefined ? o.grounded : !/jump_air|dive|fall|roll|getup/.test(this.name);
    this.propTrack = o.propTrack || null; // [{t, grip|sweet, dir, roll, ease}] bat/prop pose in character space (see human._propTrack)
    this.fingerHands = o.fingerHands || null; // {L,R} per-hand finger pose hints
    this.yaw = o.yaw || null; // Float32Array(frames) root yaw (rad, + = left) for turn clips
    this.ik = o.ik || null; // authored IK tracks (see author.js)
    this.additiveRef = o.additiveRef || null; // {q:Float32Array(NB*4)} for additive clips
    this.userData = o.userData || {};
  }
}

// -------- sampling
export function sampleClip(clip, t, outQ, outP) {
  const f = clip.fps;
  const last = clip.frames - 1;
  let x;
  if (clip.loop) { const d = clip.dur; x = ((t % d) + d) % d * f; } else x = Math.min(Math.max(t, 0), clip.dur) * f;
  if (x > last) x = last;
  const i0 = Math.floor(x);
  const i1 = Math.min(i0 + 1, clip.loop && i0 + 1 > last ? 0 : last);
  const a = x - i0;
  const q = clip.quats;
  const o0 = i0 * NB * 4;
  const o1 = i1 * NB * 4;
  for (let b = 0; b < NB; b++) {
    const k = b * 4;
    let ax = q[o0 + k], ay = q[o0 + k + 1], az = q[o0 + k + 2], aw = q[o0 + k + 3];
    let bx = q[o1 + k], by = q[o1 + k + 1], bz = q[o1 + k + 2], bw = q[o1 + k + 3];
    if (ax * bx + ay * by + az * bz + aw * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
    let rx = ax + (bx - ax) * a, ry = ay + (by - ay) * a, rz = az + (bz - az) * a, rw = aw + (bw - aw) * a;
    const n = 1 / Math.hypot(rx, ry, rz, rw);
    outQ[k] = rx * n; outQ[k + 1] = ry * n; outQ[k + 2] = rz * n; outQ[k + 3] = rw * n;
  }
  const p = clip.pelvis;
  const p0 = i0 * 3, p1 = i1 * 3;
  outP[0] = p[p0] + (p[p1] - p[p0]) * a;
  outP[1] = p[p0 + 1] + (p[p1 + 1] - p[p0 + 1]) * a;
  outP[2] = p[p0 + 2] + (p[p1 + 2] - p[p0 + 2]) * a;
}

export function makePose() { return { q: new Float32Array(NB * 4), p: new Float32Array(3) }; }

export function copyPose(dst, src) { dst.q.set(src.q); dst.p.set(src.p); return dst; }

/** dst = nlerp(dst, src, w) per bone (w in 0..1); optional per-bone mask Float32Array(NB) multiplies w. */
export function blendPose(dst, src, w, mask) {
  if (w <= 0) return dst;
  const a = dst.q, b = src.q;
  for (let i = 0; i < NB; i++) {
    const ww = mask ? w * mask[i] : w;
    if (ww <= 0) continue;
    const k = i * 4;
    let bx = b[k], by = b[k + 1], bz = b[k + 2], bw = b[k + 3];
    if (a[k] * bx + a[k + 1] * by + a[k + 2] * bz + a[k + 3] * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
    const rx = a[k] + (bx - a[k]) * ww, ry = a[k + 1] + (by - a[k + 1]) * ww, rz = a[k + 2] + (bz - a[k + 2]) * ww, rw = a[k + 3] + (bw - a[k + 3]) * ww;
    const n = 1 / Math.hypot(rx, ry, rz, rw);
    a[k] = rx * n; a[k + 1] = ry * n; a[k + 2] = rz * n; a[k + 3] = rw * n;
  }
  if (!mask || mask[0] > 0) {
    const ww = mask ? w * mask[0] : w;
    for (let j = 0; j < 3; j++) dst.p[j] += (src.p[j] - dst.p[j]) * ww;
  }
  return dst;
}

// quaternion helpers on flat arrays
function qmul(o, a, ai, b, bi) {
  const ax = a[ai], ay = a[ai + 1], az = a[ai + 2], aw = a[ai + 3];
  const bx = b[bi], by = b[bi + 1], bz = b[bi + 2], bw = b[bi + 3];
  o[0] = aw * bx + ax * bw + ay * bz - az * by;
  o[1] = aw * by - ax * bz + ay * bw + az * bx;
  o[2] = aw * bz + ax * by - ay * bx + az * bw;
  o[3] = aw * bw - ax * bx - ay * by - az * bz;
}

const _t = [0, 0, 0, 0];
const _u = [0, 0, 0, 0];

/** Additive: dst = dst * inv(ref) * src  (local space delta), weighted by w via nlerp from identity. */
export function addPose(dst, src, ref, w, mask) {
  const a = dst.q;
  for (let i = 0; i < NB; i++) {
    const ww = mask ? w * mask[i] : w;
    if (ww <= 0) continue;
    const k = i * 4;
    // delta = inv(ref) * src
    const rx = -ref.q[k], ry = -ref.q[k + 1], rz = -ref.q[k + 2], rw = ref.q[k + 3];
    _t[0] = rx; _t[1] = ry; _t[2] = rz; _t[3] = rw;
    qmul(_u, _t, 0, src.q, k);
    if (_u[3] < 0) { _u[0] = -_u[0]; _u[1] = -_u[1]; _u[2] = -_u[2]; _u[3] = -_u[3]; }
    // scale delta by ww (nlerp from identity)
    let dx = _u[0] * ww, dy = _u[1] * ww, dz = _u[2] * ww, dw = 1 + (_u[3] - 1) * ww;
    const n = 1 / Math.hypot(dx, dy, dz, dw);
    _u[0] = dx * n; _u[1] = dy * n; _u[2] = dz * n; _u[3] = dw * n;
    qmul(_t, a, k, _u, 0);
    a[k] = _t[0]; a[k + 1] = _t[1]; a[k + 2] = _t[2]; a[k + 3] = _t[3];
  }
  if (!mask || mask[0] > 0) { const ww = mask ? w * mask[0] : w; for (let j = 0; j < 3; j++) dst.p[j] += (src.p[j] - ref.p[j]) * ww; }
}

// -------- bone masks
const idx = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);
export const MASKS = (() => {
  const mk = (names) => { const m = new Float32Array(NB); for (const n of names) { const i = idx(n); if (i >= 0) m[i] = 1; } return m; };
  const armsL = ['L_Clavicle', 'L_UpperArm', 'L_Forearm', 'L_Hand'];
  const armsR = ['R_Clavicle', 'R_UpperArm', 'R_Forearm', 'R_Hand'];
  const legsL = ['L_Thigh', 'L_Calf', 'L_Foot', 'L_Toe0'];
  const legsR = ['R_Thigh', 'R_Calf', 'R_Foot', 'R_Toe0'];
  return {
    all: mk(CLIP_BONES.map((n) => n.replace('Bip01_', ''))),
    upper: mk(['Spine1', 'Spine2', 'Neck', 'Head', ...armsL, ...armsR]),
    spine: mk(['Spine', 'Spine1', 'Spine2', 'Neck', 'Head']),
    arms: mk([...armsL, ...armsR]),
    armL: mk(armsL),
    armR: mk(armsR),
    legs: mk([...legsL, ...legsR]),
    head: mk(['Neck', 'Head']),
    root: mk(['Pelvis']),
    fromBones(list) { return mk(list.map((n) => n.replace('Bip01_', ''))); },
  };
})();

/**
 * A layer plays clips with crossfading. Layer 0 ("base") covers all bones. Overlay layers can be masked
 * and/or additive. Time only advances in update(dt).
 */
export class Layer {
  constructor(name, { mask = 'all', additive = false, weight = 1 } = {}) {
    this.name = name;
    this.maskName = typeof mask === 'string' ? mask : 'custom';
    this.mask = typeof mask === 'string' ? MASKS[mask] : mask;
    this.additive = additive;
    this.weight = weight; // layer weight (0..1), settable
    this.tracks = [];
    this._pose = makePose();
    this._pose2 = makePose();
    this.fadeInOut = 0; // layer-level fade (see setWeight)
    this._wTarget = weight; this._wRate = 0;
  }

  /** Smoothly move layer weight to w over `fade` seconds. */
  setWeight(w, fade = 0) { this._wTarget = w; if (fade <= 0) { this.weight = w; this._wRate = 0; } else this._wRate = Math.abs(w - this.weight) / fade; }

  get current() { return this.tracks.length ? this.tracks[this.tracks.length - 1] : null; }

  play(clip, { fade = 0.2, speed = 1, loop, startTime = 0, startPhase, weightIn, onDone } = {}) {
    const tr = {
      clip, time: startPhase !== undefined ? startPhase * clip.dur : startTime, speed, loop: loop !== undefined ? loop : clip.loop,
      weight: fade > 0 && this.tracks.length ? 0 : 1, target: 1, fadeRate: fade > 0 ? 1 / fade : Infinity,
      rate: 1, rateTarget: 1, warp: null, done: false, onDone, lastT: -1, finished: false,
    };
    if (weightIn !== undefined) tr.weight = weightIn;
    for (const o of this.tracks) { o.target = 0; o.fadeRate = fade > 0 ? 1 / fade : Infinity; }
    this.tracks.push(tr);
    if (!(fade > 0)) this.tracks = [tr];
    return tr;
  }

  /** Fade the layer out (all tracks) and drop it when done. */
  stop(fade = 0.2) { for (const o of this.tracks) { o.target = 0; o.fadeRate = fade > 0 ? 1 / fade : Infinity; } if (!(fade > 0)) this.tracks = []; }

  update(dt, human) {
    if (this._wRate > 0) {
      const d = this._wTarget - this.weight; const s = this._wRate * dt;
      this.weight = Math.abs(d) <= s ? this._wTarget : this.weight + Math.sign(d) * s;
      if (this.weight === this._wTarget) this._wRate = 0;
    }
    for (const tr of this.tracks) {
      // fade
      if (tr.weight !== tr.target) {
        const s = tr.fadeRate * dt;
        tr.weight = Math.abs(tr.target - tr.weight) <= s ? tr.target : tr.weight + Math.sign(tr.target - tr.weight) * s;
      }
      // time warp (retiming towards an event)
      let rate = tr.speed;
      if (tr.warp) {
        const w = tr.warp;
        const remainClip = w.clipTime - tr.time;
        if (remainClip <= 1e-6 || w.eta <= 1e-6) { tr.warp = null; if (human && w.cb) w.cb(); } else {
          let r = remainClip / w.eta;
          r = Math.min(Math.max(r, w.min), w.max);
          rate = r;
          w.eta -= dt;
          // do not overshoot the event
          if (rate * dt >= remainClip) { rate = remainClip / dt; }
        }
      }
      const prev = tr.time;
      tr.time += dt * rate;
      const clip = tr.clip;
      if (tr.loop) { if (tr.time >= clip.dur) tr.time %= clip.dur; } else if (tr.time >= clip.dur) { tr.time = clip.dur; if (!tr.finished) { tr.finished = true; if (tr.onDone) tr.onDone(tr); } }
      // events
      if (human && tr.weight > 0.3 && clip.events) {
        for (const k in clip.events) {
          const et = clip.events[k];
          const crossed = tr.loop && tr.time < prev ? (et > prev + 1e-9 || et <= tr.time + 1e-9) : (et > prev + 1e-9 && et <= tr.time + 1e-9);
          if (crossed) human._fire(k, clip, tr);
        }
      }
      tr.lastT = tr.time;
    }
    // drop finished fades
    if (this.tracks.length > 1) {
      const keep = this.tracks.filter((t, i) => i === this.tracks.length - 1 || t.weight > 0 || t.target > 0);
      this.tracks = keep;
      // when the newest is fully in, drop everything older
      const nt = this.tracks[this.tracks.length - 1];
      if (nt.weight >= 1) this.tracks = [nt];
    } else if (this.tracks.length === 1 && this.tracks[0].target === 0 && this.tracks[0].weight === 0) this.tracks = [];
  }

  /** Writes this layer's evaluation into out (a Pose). Returns false when the layer has no output. */
  evaluate(out) {
    if (!this.tracks.length) return false;
    const P = this._pose, P2 = this._pose2;
    let acc = 0, first = true, refPose = null;
    for (const tr of this.tracks) {
      if (tr.weight <= 0) continue;
      sampleClip(tr.clip, tr.time, P2.q, P2.p);
      if (first) { copyPose(P, P2); acc = tr.weight; first = false; } else { acc += tr.weight; blendPose(P, P2, tr.weight / acc); }
      if (this.additive && !refPose) refPose = tr.clip.additiveRef;
    }
    if (first) return false;
    const w = this.weight * Math.min(1, acc);
    if (this.additive) {
      const cur = this.tracks[this.tracks.length - 1].clip;
      if (!cur._refPose) { const r = makePose(); sampleClip(cur, 0, r.q, r.p); cur._refPose = r; }
      addPose(out, P, cur._refPose, w, this.mask);
    } else blendPose(out, P, w, this.mask);
    return true;
  }
}
