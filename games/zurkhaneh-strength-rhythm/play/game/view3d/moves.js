// The athletes' repertoire as authored motion. Every move is one function of time returning where the hands, torso, hips and feet
// are (character space: +Y up, +Z the way the athlete faces, +X the athlete's LEFT, metres). The same function writes the clip
// (hand IK + spine/leg offsets, sampled at 30 Hz) and, at run time, tells the presenter where each club and the shield are.
//
//   idle   : clubs resting over the shoulders, hands on the handles, easy breathing
//   swing  : club swing towards azimuth theta (0 = ahead, +90 = to the athlete's left): short cock back, whip through, settle
//   tap    : stamp one foot and clash the clubs in front
//   hold   : fetch the shield from its stand, clean it up and press it overhead (the clip is scrubbed forward, then back to put it down)
//   whirl  : arms wide, clubs slung on the shoulders, the body turns (the turn itself is applied to the athlete's root yaw)
//
// The simulation decides WHEN (acts: kind, age, dur). The presenter scrubs these clips by act age, so the picture and the drum agree.
import { buildClip } from '../vendor3d/index.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// piecewise smoothstep through [[t, value], ...]
function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return lerp(v0, v1, sm((t - t0) / (t1 - t0))); }
  return keys[keys.length - 1][1];
}
function track3(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return mix3(v0, v1, sm((t - t0) / (t1 - t0))); }
  return keys[keys.length - 1][1];
}

export const SHOULDER = (s) => [0.21 * s, 1.415, -0.03];
export const D_REST = (s) => norm3([0.12 * s, 0.80, -0.58]);        // club direction while resting over a shoulder
export const H_REST = (s) => [0.22 * s, 1.28, 0.16];                // hand position on the handle
export const SHIELD_FLOOR = [0, 0.325, 0.62];                        // centre of the shield on its stand (character space)
export const DUR = { idle: 2.73, swing: 0.85, tap: 0.5, hold: 0.72, whirl: 0.9 };

const legsFor = (drop) => Math.acos(clamp((0.795 - drop) / 0.8, 0.3, 1)) / D2R;   // thigh flex (deg) for a hip drop, feet kept under the hips

// ---- the figure -------------------------------------------------------------------------------------------------------------------
// Returns { h: {L, R}, pole: {L, R}, dir: {L, R}, rest, carry, spine: {flex, twist, side}, drop, lift: {L, R}, arms: 0..1 up }
export function figure(kind, t, o = {}) {
  const f = { h: { L: H_REST(1), R: H_REST(-1) }, dir: { L: D_REST(1), R: D_REST(-1) }, pole: { L: null, R: null }, rest: 0, carry: 0, spine: { flex: 0, twist: 0, side: 0 }, drop: 0.02, lift: { L: 0, R: 0 }, head: 0 };
  if (kind === 'idle') {
    const b = Math.sin((t / DUR.idle) * Math.PI * 2), c = Math.sin((t / DUR.idle) * Math.PI * 4);
    f.h.L = [0.22, 1.28 + 0.008 * b, 0.16 + 0.006 * c]; f.h.R = [-0.22, 1.28 + 0.008 * b, 0.16 - 0.006 * c];
    f.spine.flex = 1.2 * b + 1.5; f.drop = 0.02 + 0.006 * (1 - b);
  } else if (kind === 'swing') {
    const th = (o.theta ?? 0) * D2R, e = [Math.sin(th), 0, Math.cos(th)];
    const A = [[0, -20], [0.05, -58], [0.17, 108], [0.30, 84], [0.52, 30], [0.85, -20]];
    const W = [[0, 0], [0.05, 1], [0.32, 1], [0.58, 0.45], [0.85, 0]];
    let leanSum = 0;
    for (const [side, s, lag] of [['L', 1, 0], ['R', -1, 0.028]]) {
      const tt = Math.max(0, t - lag), a = track(A, tt) * D2R, w = track(W, tt);
      const sa = Math.sin(a), ca = Math.cos(a);
      const sh = SHOULDER(s);
      const P = [sh[0] + 0.04 * s + 0.46 * 0.78 * sa * e[0], sh[1] + 0.46 * 0.72 * ca - 0.04, sh[2] + 0.46 * 0.78 * sa * e[2] + 0.06];
      f.h[side] = mix3(H_REST(s), P, w);
      f.dir[side] = norm3(mix3(D_REST(s), [ca * 0 + sa * e[0], ca, sa * e[2]], w));
      leanSum += sa * w;
      f.pole[side] = mix3([sh[0] + 0.2 * s, 1.15, 0.0], [(sh[0] + P[0]) / 2 + 0.2 * s, (sh[1] + P[1]) / 2 - 0.12, (sh[2] + P[2]) / 2 - 0.08], w);
    }
    const lean = leanSum / 2;
    f.spine = { flex: 17 * lean * Math.cos(th) + 1.5, twist: 24 * lean * Math.sin(th), side: 12 * lean * Math.sin(th) };
    f.drop = 0.02 + 0.04 * Math.abs(lean);
    f.head = -f.spine.flex * 0.4;
  } else if (kind === 'tap') {
    const foot = o.foot === 'R' ? 'R' : 'L';
    const up = track([[0, 0], [0.05, 1], [0.10, 0], [0.5, 0]], t);               // foot lift: up by 0.05 s, down on the stamp at 0.10
    f.lift[foot] = up;
    const clash = track([[0, 0], [0.05, 0.35], [0.10, 1], [0.2, 0.85], [0.38, 0]], t);
    for (const [side, s] of [['L', 1], ['R', -1]]) {
      f.h[side] = mix3(H_REST(s), [0.12 * s, 1.0, 0.36], clash);
      f.dir[side] = norm3(mix3(D_REST(s), [-0.38 * s, 0.9, 0.12], clash));
      f.h[side][1] += 0.07 * (1 - clash) * track([[0, 0], [0.05, 1], [0.1, 0]], t);
      f.pole[side] = [0.34 * s, 1.05, -0.02];
    }
    f.spine.flex = 3 + 12 * clash; f.drop = 0.02 + 0.07 * track([[0, 0], [0.10, 1], [0.26, 0.3], [0.5, 0]], t);
    f.head = -f.spine.flex * 0.4;
  } else if (kind === 'hold') {
    const K = [[0, 0], [0.12, 1], [0.28, 2], [0.46, 3], [0.72, 4]];
    const p = track(K.map(([x, v]) => [x, v]), t);                                // stage 0..4 through the lift
    const stage = (arr) => { const i = Math.min(3, Math.floor(p)); return mix3(arr[i], arr[i + 1], p - i); };
    const num = (arr) => { const i = Math.min(3, Math.floor(p)); return lerp(arr[i], arr[i + 1], p - i); };
    for (const [side, s] of [['L', 1], ['R', -1]]) {
      f.h[side] = stage([H_REST(s), [0.25 * s, 0.82, 0.52], [0.28 * s, SHIELD_FLOOR[1] + 0.04, 0.62], [0.27 * s, 1.12, 0.44], [0.27 * s, 1.97, 0.08]].slice(0, 5));
      f.pole[side] = stage([[0.3 * s, 1.0, 0.0], [0.42 * s, 0.9, 0.1], [0.46 * s, 0.7, 0.2], [0.5 * s, 1.1, 0.25], [0.55 * s, 1.75, 0.02]]);
    }
    f.drop = num([0.02, 0.14, 0.42, 0.16, 0.0]);
    f.spine.flex = num([1.5, 24, 44, 20, -4]);
    f.head = num([0, -10, -22, -8, 10]);
    f.rest = sm(t / 0.1);
    f.carry = sm((t - 0.26) / 0.06);
  } else if (kind === 'whirl') {
    const k = sm(t / 0.28), wob = Math.sin(t * 9) * 0.015 * k;
    for (const [side, s] of [['L', 1], ['R', -1]]) {
      f.h[side] = mix3(H_REST(s), [0.74 * s, 1.36 + wob, 0.0], k);
      f.pole[side] = mix3([0.3 * s, 1.0, 0.0], [0.45 * s, 1.3, -0.25], k);
    }
    f.rest = sm(t / 0.1); f.spine.flex = lerp(1.5, -3, k); f.drop = 0.05 * k + 0.02; f.lift.R = 0.85 * k;   // the free foot lifts: a pirouette on the left foot
  }
  return f;
}

// ---- clips ------------------------------------------------------------------------------------------------------------------------
function clipFrom(human, name, dur, sampler, { loop = false, base = { clip: 'idle', time: 0 }, inherit = false, fingers = 'fist' } = {}) {
  const N = Math.round(dur * 30), keys = [], ik = { L_Hand: [], R_Hand: [] }, pole = { L_Hand: [], R_Hand: [] };
  for (let i = 0; i <= N; i++) {
    const t = Math.min(dur, (i / N) * dur), f = sampler(t);
    const a = legsFor(f.drop), k = (side) => 40 * f.lift[side];
    const pose = {
      Pelvis: { pos: [0, -f.drop, f.drop * 0.25] },
      Spine1: { flex: f.spine.flex, twist: f.spine.twist, side: f.spine.side },
      Neck: { flex: f.head * 0.5 }, Head: { flex: f.head * 0.5 },
      L_Thigh: { flex: a + k('L'), abduct: 5 }, R_Thigh: { flex: a + k('R'), abduct: 5 },
      L_Calf: { flex: 2 * a + 1.3 * k('L') }, R_Calf: { flex: 2 * a + 1.3 * k('R') },
    };
    keys.push({ t, pose, ease: 'linear' });
    for (const [bone, side] of [['L_Hand', 'L'], ['R_Hand', 'R']]) {
      ik[bone].push({ t, pos: f.h[side], ease: 'linear' });
      const s = side === 'L' ? 1 : -1, sh = SHOULDER(s), h = f.h[side];
      const pl = f.pole[side] || [(sh[0] + h[0]) / 2 + 0.22 * s, (sh[1] + h[1]) / 2 - 0.2 + 0.2 * clamp((h[1] - 1.3) / 0.6, 0, 1), (sh[2] + h[2]) / 2 - 0.12];
      pole[bone].push({ t, pos: pl });
    }
  }
  return buildClip(human, {
    name, duration: dur, base, keys, loop, inherit, grounded: true, fingers,
    ik: { L_Hand: { keys: ik.L_Hand, pole: pole.L_Hand }, R_Hand: { keys: ik.R_Hand, pole: pole.R_Hand } },
  });
}

export function buildMoveClips(human) {
  const out = {};
  out.idle = clipFrom(human, 'z_idle', DUR.idle, (t) => figure('idle', t), { loop: true, base: 'idle', inherit: true });
  for (let k = 0; k < 8; k++) out['swing' + k] = clipFrom(human, 'z_swing' + k, DUR.swing, (t) => figure('swing', t, { theta: k * 45 > 180 ? k * 45 - 360 : k * 45 }));
  out.tapL = clipFrom(human, 'z_tapL', DUR.tap, (t) => figure('tap', t, { foot: 'L' }));
  out.tapR = clipFrom(human, 'z_tapR', DUR.tap, (t) => figure('tap', t, { foot: 'R' }));
  out.hold = clipFrom(human, 'z_hold', DUR.hold, (t) => figure('hold', t));
  out.whirl = clipFrom(human, 'z_whirl', DUR.whirl, (t) => figure('whirl', t), { fingers: 'relaxed' });
  return out;
}

// ---- scrubbing --------------------------------------------------------------------------------------------------------------------
// Which clip, and at what clip time, for an act of `kind` at `age` seconds (dur = how long the sim keeps the move going).
// Holds and whirls run forward while they last and then rewind (a lift put down; arms coming back in).
export function playhead(kind, age, dur) {
  if (kind === 'hold') {
    const up = DUR.hold, t = age <= dur ? Math.min(age, up) : Math.max(0, Math.min(dur, up) - (age - dur) * 1.4);
    return { clip: 'hold', t };
  }
  if (kind === 'whirl') {
    const up = 0.3, t = age <= dur ? Math.min(age, up) + (age > up ? 0.0 : 0) : Math.max(0, up - (age - dur) * 3.2);
    return { clip: 'whirl', t };
  }
  return { clip: kind, t: Math.min(age, kind === 'tap' ? DUR.tap : DUR.swing) };
}
