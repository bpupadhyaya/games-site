// The football techniques, authored for a RIGHT-foot / right-side action (left is mirrored by evalPose). Times are seconds relative to the
// contact tick (t = 0) unless a tech is 'age based' (slide, dive: t = seconds since the act began). ctx.wind is the sim's real wind-up length
// (act start to contact) so the back-swing is exactly as long as the sim says; contact itself is exact.
// Frames: 'g' = yaw-only frame under the pelvis, 'b' = body frame at the pelvis, 'ball' = contact solution, 'wd' = contact + push direction.
import { TECH, track } from './skills.js';

const G_ = (t, x, z = 0, y = 0, e) => ({ t, f: 'g', p: [x, y, z], pole: [0, 0, 1], e });
const B = (t, x, y, z, pole = [0, 0, 1], e) => ({ t, f: 'b', p: [x, y, z], pole, e });
const AB = (t, x, y, z, e) => ({ t, f: 'b', p: [x, y, z], pole: [Math.sign(x) * 0.5, -1, -0.3], e });
const FWD_INSIDE = [-1, 0, 0], FWD_INSTEP = [0, -1, 0];

// relaxed balance arms: out and slightly up while the leg swings, then back down
const arms = (a, c, d, lift = 0, spread = 1) => ({
  armR: [AB(a, -0.34, -0.08, 0.10), AB(c - 0.04, -0.52 * spread, 0.12 + lift, -0.02, 'io'), AB(c + 0.18, -0.46 * spread, 0.05 + lift, 0.06), AB(d, -0.34, -0.08, 0.10, 'io')],
  armL: [AB(a, 0.34, -0.08, 0.10), AB(c - 0.04, 0.46 * spread, 0.18 + lift, 0.16, 'io'), AB(c + 0.18, 0.42 * spread, 0.08 + lift, 0.18), AB(d, 0.34, -0.08, 0.10, 'io')],
});
const supportLeg = (a, d) => [{ t: a, f: 'wlock' }, { t: d, f: 'wlock' }];

// ---- ground pass: inside of the foot, a short pendulum swing ----------------------------------------------------------------------------
TECH.pass = (ctx) => {
  const w = ctx.wind;
  return {
    dur: [-w - 0.02, 0.5], fadeIn: w * 0.9, fadeOut: 0.22,
    dy: track([[-w, 0], [-w * 0.45, -0.05], [0, -0.09 - ctx.lunge * 0.12], [0.2, -0.04], [0.5, 0]]),
    bend: track([[-w, 0], [0, 9], [0.22, 3], [0.5, 0]]),
    side: track([[-w, 0], [0, 4], [0.5, 0]]),
    legL: supportLeg(-w - 0.02, 0.5),
    legR: [
      { t: -w - 0.02, f: 'g', p: [-0.12, 0, 0], pole: [0, 0, 1], aim: { n: [0, 0, 1], face: 'inside', fwd: FWD_INSIDE } },
      { t: -w * 0.5, f: 'g', p: [-0.20, 0.13, -0.32], pole: [-0.3, 0, 1], aim: { n: [0, 0, 1], face: 'inside', fwd: FWD_INSIDE }, e: 'io' },
      { t: 0, f: 'ball', face: 'inside', fwd: FWD_INSIDE, pole: [-0.2, 0, 1], e: 'in' },
      { t: 0.16, f: 'wd', p: [0.2, 0.0], face: 'inside', pole: [-0.2, 0, 1], e: 'out' },
      { t: 0.5, f: 'g', p: [-0.12, 0, 0], pole: [0, 0, 1], e: 'io' },
    ],
    ...arms(-w, 0, 0.5, 0),
    look: 1,
  };
};
TECH.through = TECH.pass;

// ---- instep drive: shots, clearances, lobs and crosses (a bigger swing; the follow-through climbs with the ball) ----------------------------------
const drive = (ctx) => {
  const w = ctx.wind, up = Math.max(0, Math.min(1, (ctx.d.y || 0) / 0.7));
  const swing = 0.4 + 0.25 * ctx.pow;
  return {
    dur: [-w - 0.02, 0.6], fadeIn: w * 0.9, fadeOut: 0.25,
    dy: track([[-w, 0], [-w * 0.4, -0.07], [0, -0.04], [0.2, -0.05], [0.6, 0]]),
    bend: track([[-w, 0], [-w * 0.35, -9 - 5 * ctx.pow], [0, 6], [0.2, 18], [0.6, 0]]),
    side: track([[-w, 0], [0, 4 + ctx.lean], [0.25, 3], [0.6, 0]]),
    pSide: track([[-w, 0], [0, 3], [0.6, 0]]),
    twist: track([[-w, 0], [-w * 0.4, -10], [0.05, 6], [0.3, 0]]),
    legL: supportLeg(-w - 0.02, 0.6),
    legR: [
      { t: -w - 0.02, f: 'g', p: [-0.12, 0, 0], pole: [0, 0, 1], aim: { n: [0, 0, 1], face: 'instep', fwd: FWD_INSTEP } },
      { t: -w * 0.55, f: 'g', p: [-0.14, 0.34 + 0.12 * ctx.pow, -0.42 - 0.12 * ctx.pow], pole: [-0.1, 0, 1], aim: { n: [0, 0.2, 1], face: 'instep', fwd: FWD_INSTEP }, e: 'io' },
      { t: 0, f: 'ball', face: 'instep', fwd: FWD_INSTEP, pole: [-0.1, 0, 1], e: 'in' },
      { t: 0.16, f: 'wd', p: [swing * (1 - 0.3 * up), 0.18 + 0.4 * up + 0.1 * ctx.pow], face: 'instep', pole: [-0.1, 0, 1], e: 'out' },
      { t: 0.6, f: 'g', p: [-0.12, 0, 0], pole: [0, 0, 1], e: 'io' },
    ],
    ...arms(-w, 0, 0.6, 0.06, 1.2),
    look: 1,
  };
};
TECH.drive = drive; TECH.shot = drive; TECH.lob = drive; TECH.cross = drive; TECH.clear = drive;

// ---- volley: the ball is struck at knee to chest height with the leg raised from the side, the body leaning away -----------------------------------------
TECH.volley = (ctx) => {
  const w = ctx.wind;
  return {
    dur: [-w - 0.02, 0.6], fadeIn: w * 0.9, fadeOut: 0.25,
    dy: track([[-w, 0], [-w * 0.4, -0.05], [0, -0.02], [0.2, -0.03], [0.6, 0]]),
    bend: track([[-w, 0], [0, -4], [0.2, 8], [0.6, 0]]),
    side: track([[-w, 0], [-w * 0.3, 8 + ctx.lean * 0.6], [0.05, 12 + ctx.lean], [0.3, 6], [0.6, 0]]),
    pSide: track([[-w, 0], [0, 6], [0.6, 0]]),
    legL: supportLeg(-w - 0.02, 0.6),
    legR: [
      { t: -w - 0.02, f: 'g', p: [-0.12, 0, 0], pole: [0, 0, 1], aim: { n: [0, 0, 1], face: 'instep', fwd: FWD_INSTEP } },
      { t: -w * 0.5, f: 'g', p: [-0.30, 0.38 + ctx.rise * 0.5, -0.3], pole: [-0.5, 0.2, 1], aim: { n: [0, 0.1, 1], face: 'instep', fwd: FWD_INSTEP }, e: 'io' },
      { t: 0, f: 'ball', face: 'instep', fwd: FWD_INSTEP, pole: [-0.4, 0.2, 1], e: 'in' },
      { t: 0.15, f: 'wd', p: [0.35, 0.22], face: 'instep', pole: [-0.4, 0.2, 1], e: 'out' },
      { t: 0.6, f: 'g', p: [-0.12, 0, 0], pole: [0, 0, 1], e: 'io' },
    ],
    ...arms(-w, 0, 0.6, 0.12, 1.4),
    look: 1,
  };
};

// ---- a dribble touch: a quick tap with the inside or outside of the foot while running; only the touching leg is overridden ------------------------------
TECH.touch = (ctx) => ({
  dur: [-0.085, 0.2], fadeIn: 0.05, fadeOut: 0.12,
  dy: track([[-0.085, 0], [0, -0.02], [0.2, 0]]),
  legR: [
    { t: -0.085, f: 'g', p: [-0.1, 0.1, -0.1], pole: [0, 0, 1], aim: { n: [0, 0, 1], face: 'inside', fwd: FWD_INSIDE } },
    { t: 0, f: 'ball', face: 'inside', fwd: FWD_INSIDE, pole: [-0.1, 0, 1], e: 'in' },
    { t: 0.1, f: 'wd', p: [0.1, 0.02], face: 'inside', pole: [-0.1, 0, 1], e: 'out' },
    { t: 0.2, f: 'g', p: [-0.12, 0.12, -0.05], pole: [0, 0, 1], e: 'io' },
  ],
  look: 0.6,
});

// ---- header: a small coil, the neck and torso snap into the ball at the top of the jump (the jump height comes from the sim) -------------------------------
TECH.head = (ctx) => {
  const w = ctx.wind;
  return {
    dur: [-w - 0.02, 0.5], fadeIn: Math.min(w, 0.2) * 0.9, fadeOut: 0.22,
    dy: track([[-w, 0], [-w * 0.5, -0.05], [0, 0], [0.5, 0]]),
    bend: track([[-w, 0], [-w * 0.45, 8], [-0.07, -16, 'io'], [0.0, -4], [0.06, 18, 'in'], [0.3, 6], [0.5, 0]]),
    legL: [{ t: -w - 0.02, f: 'g', p: [0.12, 0, 0] }, { t: -w * 0.35, f: 'g', p: [0.14, 0.05, -0.1] }, { t: 0, f: 'g', p: [0.14, 0.28, -0.24], e: 'out' }, { t: 0.25, f: 'g', p: [0.12, 0.04, 0.0], e: 'io' }, { t: 0.5, f: 'g', p: [0.12, 0, 0] }],
    legR: [{ t: -w - 0.02, f: 'g', p: [-0.12, 0, 0] }, { t: -w * 0.35, f: 'g', p: [-0.14, 0.05, -0.1] }, { t: 0, f: 'g', p: [-0.14, 0.32, -0.28], e: 'out' }, { t: 0.25, f: 'g', p: [-0.12, 0.04, 0.0], e: 'io' }, { t: 0.5, f: 'g', p: [-0.12, 0, 0] }],
    armR: [AB(-w, -0.34, -0.08, 0.10), AB(-0.06, -0.40, -0.02, -0.12, 'io'), AB(0.06, -0.58, 0.28, 0.08, 'out'), AB(0.5, -0.34, -0.08, 0.10)],
    armL: [AB(-w, 0.34, -0.08, 0.10), AB(-0.06, 0.40, -0.02, -0.12, 'io'), AB(0.06, 0.58, 0.28, 0.08, 'out'), AB(0.5, 0.34, -0.08, 0.10)],
    fix: { bone: 'head', off: 0.1, span: 0.18 },
    look: 1,
  };
};

// ---- standing tackle: a lunge with the leading leg, low and balanced ------------------------------------------------------------------------------------
TECH.tackle = (ctx) => {
  const w = ctx.wind;
  return {
    dur: [-w - 0.02, 0.55], fadeIn: w * 0.9, fadeOut: 0.25,
    dy: track([[-w, 0], [0, -0.20], [0.2, -0.17], [0.55, 0]]),
    oz: track([[-w, 0], [0, 0.1], [0.55, 0]]),
    bend: track([[-w, 0], [0, 20], [0.3, 12], [0.55, 0]]),
    legL: [G_(-w - 0.02, 0.12), G_(0, 0.16, -0.36, 0, 'io'), G_(0.3, 0.16, -0.28), G_(0.55, 0.12)],
    legR: [
      { t: -w - 0.02, f: 'g', p: [-0.12, 0, 0], pole: [0, 0, 1], aim: { n: [0, 0, 1], face: 'inside', fwd: FWD_INSIDE } },
      { t: 0, f: 'ball', face: 'inside', fwd: FWD_INSIDE, pole: [-0.2, 0.1, 1], e: 'in' },
      { t: 0.22, f: 'wd', p: [0.1, 0.0], face: 'inside', pole: [-0.2, 0.1, 1], e: 'out' },
      { t: 0.55, f: 'g', p: [-0.12, 0, 0], pole: [0, 0, 1], e: 'io' },
    ],
    ...arms(-w, 0, 0.55, 0.0, 1.5),
    look: 1,
  };
};

// ---- slide tackle (age based): the body drops onto one hip, the lead leg reaches along the ground, then the player springs up -------------------------------
TECH.slide = (ctx) => { const LY = -((ctx.H0 || 0.9) - 0.2); return ({
  dur: [0, 1.6], fadeIn: 0.1, fadeOut: 0.4, ageBased: true,
  dy: track([[0, 0], [0.1, LY * 0.3, 'io'], [0.22, LY, 'out'], [0.8, LY], [1.1, LY * 0.5, 'io'], [1.35, LY * 0.15, 'io'], [1.6, 0, 'io']]),
  pitch: track([[0, 0], [0.1, -14], [0.22, -64, 'out'], [0.8, -66], [1.1, -34, 'io'], [1.35, -12, 'io'], [1.6, 0, 'io']]),
  roll: track([[0, 0], [0.22, 14], [0.8, 14], [1.6, 0]]),
  bend: track([[0, 0], [0.22, -8], [0.8, -10], [1.6, 0]]),
  legR: [G_(0, -0.12), { t: 0.12, f: 'g', p: [-0.1, 0.26, 0.55], pole: [-0.2, 0.2, 1], e: 'io' }, { t: 0.26, f: 'g', p: [-0.1, 0.1, 0.85], pole: [-0.2, 0.2, 1], e: 'out' }, { t: 0.8, f: 'g', p: [-0.1, 0.1, 0.85], pole: [-0.2, 0.2, 1] }, G_(1.5, -0.12, 0.0, 0, 'io')],
  legL: [G_(0, 0.12), { t: 0.14, f: 'g', p: [0.2, 0.18, 0.1], pole: [0.8, 0.2, 0.4], e: 'io' }, { t: 0.26, f: 'g', p: [0.26, 0.05, 0.05], pole: [0.8, 0.3, 0.4] }, { t: 0.8, f: 'g', p: [0.26, 0.05, 0.05], pole: [0.8, 0.3, 0.4] }, G_(1.5, 0.12, 0, 0, 'io')],
  armR: [AB(0, -0.34, -0.08, 0.10), AB(0.22, -0.55, 0.0, -0.45, 'out'), AB(0.8, -0.55, 0.0, -0.45), AB(1.4, -0.34, -0.08, 0.10)],
  armL: [AB(0, 0.34, -0.08, 0.10), AB(0.22, 0.5, 0.1, 0.1, 'out'), AB(0.8, 0.5, 0.1, 0.1), AB(1.4, 0.34, -0.08, 0.10)],
  look: 0.5,
}); };

// ---- overhead throw-in (two hands on the ball; the ball is held over the head by the sim from the start of the act) -----------------------------------------
TECH.throw = (ctx) => {
  const w = ctx.wind;
  const hand = (side) => [
    { t: -w - 0.02, f: 'b', p: [side * 0.30, 0.1, 0.35], pole: [side * 0.5, -1, -0.2] },
    { t: -w * 0.55, f: 'hb', back: 0.1, up: -0.02, e: 'io' },
    { t: 0, f: 'hb', back: 0.0, up: 0, e: 'in' },
    { t: 0.12, f: 'b', p: [side * 0.2, 0.7, 0.75], pole: [side * 0.3, 0.2, 1], e: 'out' },
    { t: 0.5, f: 'b', p: [side * 0.34, -0.08, 0.10], pole: [side * 0.5, -1, -0.2], e: 'io' },
  ];
  return {
    dur: [-w - 0.02, 0.5], fadeIn: 0.12, fadeOut: 0.25,
    dy: track([[-w, 0], [-w * 0.4, -0.04], [0, 0], [0.5, 0]]),
    bend: track([[-w, 0], [-w * 0.5, -14], [0, -6, 'io'], [0.1, 18, 'in'], [0.35, 8], [0.5, 0]]),
    legR: [G_(-w - 0.02, -0.12), G_(-w * 0.4, -0.12, -0.2), G_(0.15, -0.12, 0.1), G_(0.5, -0.12)],
    legL: [G_(-w - 0.02, 0.12), G_(-w * 0.4, 0.12, 0.18), G_(0.15, 0.12, 0.2), G_(0.5, 0.12)],
    armR: hand(-1), armL: hand(1),
    look: 0.5,
  };
};

// ---- keeper dive (age based): crouch, launch, roll out flat, hands reach the sim's hand point; hold on the ground, then spring up ----------------------------
TECH.dive = (ctx) => {
  const lowY = [-0.42, -0.16, 0.12][ctx.h], apex = [0.1, 0.3, 0.34][ctx.h];
  const sg = ctx.m;      // +1 when the dive is to the body's right (authored side)
  return {
    dur: [0, 1.25], fadeIn: 0.07, fadeOut: 0.3, ageBased: true,
    dy: track([[0, 0], [0.1, -0.12, 'io'], [apex, lowY, 'out'], [0.42, -0.5, 'in'], [0.85, -0.52], [1.08, -0.28, 'io'], [1.25, 0, 'io']]),
    roll: track([[0, 0], [0.1, 4], [apex, 70], [0.42, 80], [0.85, 80], [1.08, 40, 'io'], [1.25, 0, 'io']]),
    pitch: track([[0, 0], [0.5, 4], [1.25, 0]]),
    bend: track([[0, 0], [0.1, 14], [apex, 4], [0.85, 4], [1.25, 0]]),
    legL: [B(0, 0.12, -0.82, 0), B(apex, 0.14, -0.76, -0.2, [0, 0, 1], 'io'), B(0.85, 0.14, -0.78, -0.18), B(1.25, 0.12, -0.82, 0)],
    legR: [B(0, -0.12, -0.82, 0), B(apex, -0.12, -0.7, -0.38, [0, 0, 1], 'io'), B(0.85, -0.12, -0.74, -0.34), B(1.25, -0.12, -0.82, 0)],
    armR: [AB(0, -0.34, -0.08, 0.10), { t: 0.12, f: 'wp', pt: 'hand', p: [-0.1, 0.0, -0.1], e: 'io' }, { t: 0.85, f: 'wp', pt: 'hand', p: [-0.1, 0.0, 0.0] }, AB(1.2, -0.34, -0.08, 0.10)],
    armL: [AB(0, 0.34, -0.08, 0.10), { t: 0.12, f: 'wp', pt: 'hand', p: [0.1, 0.0, -0.1], e: 'io' }, { t: 0.85, f: 'wp', pt: 'hand', p: [0.1, 0.0, 0.0] }, AB(1.2, 0.34, -0.08, 0.10)],
    look: 0.8,
    sg,
  };
};

// ---- keeper jump (standing, for a high ball): up on the toes, both hands to the sim's hand point, then down -------------------------------------------------
TECH.jump = (ctx) => ({
  dur: [0, 0.95], fadeIn: 0.08, fadeOut: 0.25, ageBased: true,
  dy: track([[0, 0], [0.12, -0.14, 'io'], [0.3, Math.max(0.1, ctx.peak) * 0.0 + 0.22, 'out'], [0.5, 0.05, 'in'], [0.7, -0.1, 'io'], [0.95, 0, 'io']]),
  bend: track([[0, 0], [0.12, 10], [0.3, -4], [0.7, 6], [0.95, 0]]),
  legL: [G_(0, 0.12), G_(0.12, 0.12, -0.05, 0.02), G_(0.3, 0.12, -0.2, 0.36, 'out'), G_(0.5, 0.12, 0, 0.06, 'in'), G_(0.95, 0.12)],
  legR: [G_(0, -0.12), G_(0.12, -0.12, -0.05, 0.02), G_(0.3, -0.12, -0.24, 0.4, 'out'), G_(0.5, -0.12, 0, 0.06, 'in'), G_(0.95, -0.12)],
  armR: [AB(0, -0.34, -0.08, 0.10), { t: 0.14, f: 'wp', pt: 'hand', p: [-0.12, 0, 0], e: 'io' }, { t: 0.5, f: 'wp', pt: 'hand', p: [-0.12, 0, 0] }, AB(0.9, -0.34, -0.08, 0.10)],
  armL: [AB(0, 0.34, -0.08, 0.10), { t: 0.14, f: 'wp', pt: 'hand', p: [0.12, 0, 0], e: 'io' }, { t: 0.5, f: 'wp', pt: 'hand', p: [0.12, 0, 0] }, AB(0.9, 0.34, -0.08, 0.10)],
  look: 0.8,
});

// ---- keeper picking a low ball up: down on the knees, hands on both sides of the ball, then up with it ------------------------------------------------------
TECH.pickup = (ctx) => ({
  dur: [-0.3, 0.7], fadeIn: 0.2, fadeOut: 0.3,
  dy: track([[-0.3, 0], [0, -0.42, 'io'], [0.3, -0.4], [0.7, 0, 'io']]),
  bend: track([[-0.3, 0], [0, 42, 'io'], [0.3, 34], [0.7, 0, 'io']]),
  legL: [G_(-0.3, 0.12), G_(0, 0.14, -0.1), G_(0.3, 0.14, -0.1), G_(0.7, 0.12)],
  legR: [G_(-0.3, -0.12), G_(0, -0.14, -0.1), G_(0.3, -0.14, -0.1), G_(0.7, -0.12)],
  armR: [AB(-0.3, -0.34, -0.08, 0.10), { t: -0.04, f: 'hb', s: 1.0, back: 0.02, e: 'io' }, { t: 0.3, f: 'hb', s: 1.0, back: 0.02 }, AB(0.7, -0.34, -0.08, 0.10)],
  armL: [AB(-0.3, 0.34, -0.08, 0.10), { t: -0.04, f: 'hb', s: 1.0, back: 0.02, e: 'io' }, { t: 0.3, f: 'hb', s: 1.0, back: 0.02 }, AB(0.7, 0.34, -0.08, 0.10)],
  look: 0.8,
});
