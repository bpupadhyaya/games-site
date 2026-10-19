// Key-pose library. A pose is a plain object of joint angles in radians, measured from "hanging straight down";
// positive swings toward the way the figure faces. Fields (all optional): hipF kneeF hipB kneeB (front/back leg),
// shF elF shB elB (front/back arm), lean (torso), head, bob, lift, rot + air (whole-body rotation in flight), sway (cloth),
// expr, prop controls (propA angle of a held shaft, propBack = hold it in the back hand, aim/pull/arrow for bows),
// tailA tailCurl tailWave tailLen. Every pose takes the animation clock t first so secondary motion stays alive.
import { SPECS } from './specs.js';
const S = Math.sin, C = Math.cos, PI = Math.PI;

// ---- locomotion -------------------------------------------------------------------------------------------------
// A gait is built from the FEET up: each ankle follows a ground-true path (heel strike -> foot flat -> heel off -> toe off
// -> swing), the pelvis rides a small vertical wave, and the hip / knee angles come from two-bone IK - so the planted foot
// cannot slide, the knee only ever bends the right way, and the body's rise and fall comes from the legs themselves.
// All lengths are in figure units for a leg of 2 x 50; they scale with the character's leg. Fields:
//   C cycle length (ground covered by one full L+R cycle), beta stance fraction (< 0.5 gives a flight phase = run),
//   hm / ha pelvis height and wave (ha > 0: highest at mid-stance = walk; ha < 0: lowest at mid-stance = run),
//   lift swing-foot clearance, hs / to foot angle at heel strike / toe off, arm swing, elbow bend, lean, tail sway
export const GAITS = {
  walk:   { C: 124, beta: 0.62, hm: 96.6, ha: 2.6, lift: 7, hs: 0.32, to: -0.85, arm: 0.36, el: 0.25, lean: 0.05, tail: 0.1 },
  long:   { C: 100, beta: 0.64, hm: 97.8, ha: 1.6, lift: 4.5, hs: 0.24, to: -0.7, arm: 0.22, el: 0.22, lean: 0.03, tail: 0.1 },   // long dhoti / sari: short graceful steps
  vanara: { C: 140, beta: 0.6, hm: 90, ha: 3.2, lift: 13, hs: 0.3, to: -0.95, arm: 0.55, el: 0.35, lean: 0.14, tail: 0.22 },        // springy, powerful, knees always a little bent
  run:    { C: 250, beta: 0.38, hm: 85.5, ha: -5.5, lift: 30, hs: 0.12, to: -1.1, arm: 0.95, el: 1.35, lean: 0.3, tail: 0.2 },
  vrun:   { C: 270, beta: 0.36, hm: 85, ha: -6, lift: 34, hs: 0.1, to: -1.15, arm: 1.1, el: 1.2, lean: 0.38, tail: 0.3 },
};
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
// ankle offset (dx forward, dh up) from its flat-foot position when the foot is tipped: a > 0 rocks on the heel, a < 0 rolls onto the ball
const tip = (a, fk) => (a >= 0 ? [fk * (-5 + 5 * C(a) - 6 * S(a)), fk * (5 * S(a) + 6 * C(a) - 6)] : [fk * (13 * (1 - C(a)) - 6 * S(a)), fk * (-13 * S(a) + 6 * C(a) - 6)]);
function legAt(ph, g, k, fk, H) {
  const f = ph - Math.floor(ph), b = g.beta, Ck = g.C * k, p1 = b * 0.14, p2 = b * 0.56;
  const [dx0] = tip(g.hs, fk), [dxT, dhT] = tip(g.to, fk), xhs = (b * Ck - (dxT - dx0)) / 2;
  let x, h, a;
  if (f < b) { a = f < p1 ? g.hs * (1 - ease(f / p1)) : f < p2 ? 0 : g.to * ease((f - p2) / (b - p2)); const [dx, dh] = tip(a, fk); x = xhs + (dx - dx0) - f * Ck; h = dh; }
  else { const u = (f - b) / (1 - b), xt = xhs + (dxT - dx0) - b * Ck, [, dhH] = tip(g.hs, fk); x = xt + (xhs - xt) * (u * 0.35 + ease(u) * 0.65); h = dhT * (1 - u) * (1 - u) + g.lift * k * S(PI * Math.pow(u, 0.8)) + dhH * u * u; a = g.to * (1 - ease(u * 1.9)) + g.hs * ease((u - 0.5) / 0.5); }
  const dy = H - h, L = 50 * k, d = Math.min(2 * L - 0.05, Math.hypot(x, dy)), al = Math.acos(d / (2 * L));
  return [Math.atan2(x, dy) + al, -2 * al, a];
}
// phase: cycles travelled (1 = one full left + right cycle). o = { leg (segment length, default 50), fk (foot scale), vanara }
export function gaitPose(phase, g, t = 0, o = {}) {
  const k = (o.leg ?? 50) / 50, fk = o.fk ?? 1.15, w = 2 * PI * phase, H = (g.hm + g.ha * C(4 * PI * (phase - g.beta / 2))) * k;
  const [hipF, kneeF, footF] = legAt(phase, g, k, fk, H), [hipB, kneeB, footB] = legAt(phase + 0.5, g, k, fk, H);
  const run = g.beta < 0.5, sw = C(w - 0.3);   // sw = +1 when the FRONT leg is forward -> the front arm is back
  return { t, gait: true, hipH: H, hipF, kneeF, footF, hipB, kneeB, footB, bob: 0,
    shF: -g.arm * sw + (run ? 0.15 : 0.04), elF: g.el + (run ? 0.25 : 0.3) * (0.5 - 0.5 * C(w - 0.3 - 0.75)), shB: g.arm * sw + (run ? 0.15 : 0.04), elB: g.el + (run ? 0.25 : 0.3) * (0.5 + 0.5 * C(w - 0.3 - 0.75)),
    // wrist "flick": a swinging arm's hand trails the forearm and whips through fastest at the bottom of the
    // swing (where the arm's own angular speed peaks) - a sine a quarter-turn out of phase with the swing itself.
    wristF: (run ? 0.22 : 0.14) * S(w - 0.3), wristB: -(run ? 0.22 : 0.14) * S(w - 0.3),
    lean: g.lean + 0.014 * C(2 * w), head: -0.02 - 0.014 * C(2 * w) - (run ? 0.16 : 0), sway: S(w - 0.9) * (run ? 1.2 : 0.8),
    tailA: (run ? -1.45 : -1.0) + g.tail * S(w + PI * 0.9), tailCurl: run ? -0.1 : -0.16 + 0.03 * S(w), tailWave: g.tail * 0.9 };
}
const footK = (s) => (s.legW ?? 20) / 20 * (s.fur ? 0.78 : 0.92);
const gaitFor = (s, run) => (s.fur ? (run ? GAITS.vrun : GAITS.vanara) : run ? GAITS.run : s.long ? GAITS.long : GAITS.walk);
// Ground covered (canvas px) by one full cycle of `kind` drawn at scale sc - chapters can use it to pick a walking speed.
export function cycleLength(kind, sc = 1, run = false) { const s = SPECS[kind] ?? SPECS.citizen; return gaitFor(s, run).C * (s.leg / 50) * sc; }
// THE helper for chapters: the pose of `kind` after it has travelled `dist` canvas px at draw scale `sc`. Because the phase comes
// from distance, not time, the planted foot stays put whatever the speed. o = { run, t (clock for cloth / tail), offset (cycles) }
export function stridePose(kind, dist, sc = 1, o = {}) {
  const s = SPECS[kind] ?? SPECS.citizen, g = gaitFor(s, o.run);
  return gaitPose(dist / (g.C * (s.leg / 50) * sc) + (o.offset ?? 0), g, o.t ?? 0, { leg: s.leg, fk: footK(s) });
}

const breathe = (t) => S(t * 1.6) * 1.1;
export const poses = {
  // contrapposto: weight on the back leg, front knee relaxed, shoulders counter-tilted, slow breathing
  stand: (t = 0) => ({ t, hipF: 0.16, kneeF: -0.2, hipB: -0.06, kneeB: 0, lean: -0.03, head: 0.03 + S(t * 0.7) * 0.02, shF: 0.1 + S(t * 1.3) * 0.03, elF: 0.32, shB: -0.16, elB: 0.24, bob: breathe(t), sway: S(t * 1.1) * 0.4, tailA: -0.9, tailCurl: -0.2, tailWave: 0.08 }),
  // walk / run by the clock (legacy callers). Prefer stridePose(kind, distance, scale) so the planted foot never slides.
  walk: (t, rate = 5) => gaitPose(t * rate / (2 * PI), GAITS.walk, t),
  run: (t, rate = 11) => gaitPose(t * rate / (2 * PI), GAITS.run, t),
  leap: (t, up = 1) => ({ t, air: true, hipF: 1.0, kneeF: -1.4, hipB: -0.6 * up, kneeB: -0.7, shF: 2.5, elF: 0.25, shB: -1.0, elB: 0.5, lean: 0.4, head: -0.3, tailA: -1.2, tailCurl: -0.06, tailWave: 0.2, expr: 'determined' }),
  // flight: body level and arched, leading arm reaching ahead, mace arm swept back, legs trailing with one knee tucked
  fly: (t, bank = 0) => ({ t, air: true, rot: PI / 2 - 0.16 + bank + S(t * 1.7) * 0.03, lean: -0.12, hipF: 0.5 + S(t * 2) * 0.06, kneeF: -1.15, hipB: -0.22, kneeB: -0.1 + S(t * 3) * 0.06, shF: PI - 0.12, elF: 0.12, shB: 0.5, elB: 0.5, propBack: true, propA: 0.55, head: -0.92, tailA: -0.3, tailCurl: 0.03, tailWave: 0.24, tailLen: 17, sway: S(t * 6) * 1.2, expr: 'determined' }),
  // archer: wide stance, bow arm straight along the aim, string hand anchored by the cheek at full pull (two-bone IK)
  drawBow: (t, pull = 0, aim = 0) => { const A1 = 38, A2 = 36, d = Math.max(16, Math.min(72, 80 - 60 * pull)), th = Math.acos(Math.max(-1, Math.min(1, (A1 * A1 + d * d - A2 * A2) / (2 * A1 * d)))), inner = Math.acos(Math.max(-1, Math.min(1, (A1 * A1 + A2 * A2 - d * d) / (2 * A1 * A2))));
    // the bow hand's wrist cants a little more open as the pull builds; the string hand's wrist bends back
    // toward the cheek under the string's tension rather than staying rigidly in line with the forearm.
    return { t, hipF: 0.42, kneeF: -0.16, hipB: -0.4, kneeB: -0.05, lean: -0.07 - pull * 0.05, head: -aim * 0.5, shF: PI / 2 - aim, elF: 0.02, shB: PI / 2 + th - aim, elB: -(PI - inner), aim, pull, arrow: pull > 0.02, expr: 'determined', sway: S(t * 2) * 0.3, wristF: 0.14 + pull * 0.08, wristB: -0.12 - pull * 0.24 }; },
  // the instant after loosing: string hand flung back, bow arm steady - the wrist snaps back and settles
  // (a damped oscillation in u, not a straight-line interpolation) instead of jumping straight to its rest angle
  release: (t, u = 0, aim = 0) => ({ t, hipF: 0.42, kneeF: -0.16, hipB: -0.4, kneeB: -0.05, lean: -0.1 + u * 0.06, head: -aim * 0.5, shF: PI / 2 - aim, elF: 0.02, shB: -0.9 - u * 0.5, elB: 0.5 - u * 0.3, aim, pull: 0, bend: -0.15 * (1 - u), expr: 'determined', wristF: 0.14, wristB: -0.1 + 0.45 * Math.exp(-4 * u) * C(9 * u) }),
  holdBow: (t) => ({ ...poses.stand(t), shF: 0.62, elF: 0.75, aim: -0.12 }),
  cheer: (t, ph = 0) => ({ t, hipF: 0.12, kneeF: -0.1, hipB: -0.1, shF: 2.7 + S(t * 6 + ph) * 0.25, elF: 0.2, shB: -2.7 + S(t * 6 + ph + 1) * 0.25, elB: -0.2, head: -0.12, bob: Math.abs(S(t * 6 + ph)) * 8, expr: 'joyful', tailA: -0.6, tailCurl: -0.25, tailWave: 0.3 }),
  carry: (t, rate = 5) => ({ ...poses.walk(t, rate), shF: 2.7, elF: 0.3, shB: -2.7, elB: -0.3 }),
  // mace swing: ph 0 = wound up over the shoulder, 1 = low follow-through; the weight shifts forward through the arc.
  // The gripping wrist whips ahead of the forearm right before impact (~ph 0.75) then settles through follow-through,
  // instead of staying locked to the forearm's own angle for the whole swing.
  strike: (t, ph) => ({ t, hipF: 0.3 + ph * 0.35, kneeF: -0.15 - ph * 0.3, hipB: -0.3 - ph * 0.2, kneeB: -0.05, shF: 2.9 - ph * 2.5, elF: 0.7 - ph * 0.55, shB: -0.7 + ph * 0.5, elB: 0.7, lean: -0.12 + ph * 0.42, head: -0.05 - ph * 0.1, propA: 3.9 - ph * 2.6, expr: 'determined', tailA: -0.8 - ph * 0.5, tailCurl: -0.15, tailWave: 0.2, wristF: -0.25 + 0.55 * Math.exp(-30 * (ph - 0.75) * (ph - 0.75)) }),
  sit: (t = 0) => ({ t, hipF: 1.45, kneeF: -1.5, hipB: 1.3, kneeB: -1.45, shF: 0.5, elF: 0.9, shB: 0.3, elB: 0.8, bob: S(t * 1.4) }),
  // one knee down, one hand on the chest, the mace resting head-down on the ground: a respectful report (not a prayer)
  kneel: (t = 0) => ({ t, hipF: 1.4, kneeF: -1.55, hipB: -0.12, kneeB: -1.5, shF: 0.4, elF: 2.25, shB: 0.55, elB: 0.35, propBack: true, propA: 0.05, lean: 0.22, head: 0.22, bob: breathe(t) * 0.5, tailA: -1.5, tailCurl: -0.18 }),
  offer: (t = 0) => ({ ...poses.kneel(t), shF: 1.5, elF: 0.2, propBack: false, handF: 'open', wristF: -0.1 }),
  // grief: head bowed, shoulders dropped, arms slack (never a collapse)
  grief: (t = 0) => ({ t, hipF: 0.1, kneeF: -0.12, hipB: -0.06, lean: 0.14, head: 0.42, shF: 0.05, elF: 0.12, shB: -0.05, elB: 0.1, bob: breathe(t) * 0.6, expr: 'sorrowful' }),
  // embrace: both arms forward and folded (for a two-figure story beat; place the figures ~40 units apart, facing)
  embrace: (t = 0) => ({ t, hipF: 0.14, kneeF: -0.1, hipB: -0.08, lean: 0.12, head: 0.2, shF: 1.25, elF: 1.2, shB: 1.0, elB: 1.35, bob: breathe(t) * 0.6, expr: 'joyful' }),
  sneak: (t, moving) => ({ t, hipF: 0.7 + (moving ? S(t * 9) * 0.4 : 0), kneeF: -1.1, hipB: -0.3 - (moving ? S(t * 9) * 0.4 : 0), kneeB: -0.9, shF: 0.9, elF: 0.9, shB: 0.3, elB: 1.0, lean: 0.5, head: -0.3, tailA: -1.6, tailCurl: -0.12 }),
};
