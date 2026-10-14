// The glima physics: pure, deterministic, no DOM, no clock. One round is a small object stepped at a fixed rate.
//
// Two athletes stand chest to chest holding each other's belt. Side 0 is the athlete at the bottom of the picture (the human in a
// one-player match), side 1 the athlete at the top. Both use the SAME left-right axis of the screen: -1 is the left foot, +1 the
// right foot of the picture.
//   Per side   w      weight, -1 all on the left foot .. +1 all on the right foot (it sways by itself with the stepping rhythm)
//              v      how fast the weight is moving
//              st     stance 0..1: a landed hook costs stance, empty stance is a fall
//              steer  -1..1 where the thumb steers (the athlete steps that way and drags the belt that way)
//              hook   null | { s: -1|1, t }  a hook in flight (the foot on side s swings at the rival's leg on side s)
//              rec    seconds still reaching after a missed hook; stun  seconds still wobbling after being hooked
// A command is { steer: -1..1, hook: 0 | -1 | 1 }; hook is a one-shot request.
export const STEP = 1 / 60;
export const ROUND_TIME = 60;
export const EXTRA_TIME = 15;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const TUNE = {
  spring: 46, damp: 11,       // the weight follows its target like a damped spring
  reach: 0.72,                // own weight target per unit of steer
  swayAmp: 0.3,               // the stepping sway
  beltDrag: 0.58,              // how far the rival's steer drags your weight target
  beltBrace: 0.6,             // an opposing steer cancels this share of the drag
  steerRate: 12,              // how quickly the thumb command is followed (1/s)
  windup: 0.28,               // a hook swings for this long before it lands or fails
  ownMin: 0.05,               // your own hooking foot must be at least this light
  legMin: 0.14,               // the rival's leg must be at least this light for a hook to land
  dmg: 0.09, dmgLight: 0.115,  // stance cost of a hook: dmg + dmgLight x lightness of the leg
  cleanLight: 9,           // lightness of the leg that makes a hook a clean fall at once
  stun: 0.6, hitKick: 2.2,    // after being hooked
  recMiss: 0.55, missCost: 0.09, missKick: 1.3,
  stepOverGift: 0.02,
  regen: 0.06, regenBand: 0.45,   // stance comes back while you stay centred
  cmdDead: 0.0,
};

const side = (sw) => ({ w: 0, v: 0, st: 1, steer: 0, cmd: 0, hook: null, rec: 0, stun: 0, sw, tgt: 0, foot: 0, dirHit: 1, stats: { hooks: 0, lands: 0, steps: 0 }, last: 0 });

// opts.sway: [{ f, ph }, { f, ph }] (stepping frequency in Hz and starting phase); opts.limit
export function newRound(opts = {}) {
  const sway = opts.sway || [{ f: 0.62, ph: 0 }, { f: 0.74, ph: 2.1 }];
  return { t: 0, side: [side(sway[0]), side(sway[1])], over: null, extra: false, limit: opts.limit || ROUND_TIME, ev: [], clock: 0, ang: 0 };
}

// How light the leg on side s is (1 = completely unloaded, 0 = half, negative = loaded).
export const light = (sd, s) => clamp(-sd.w * s, -1, 1);
// Who is ahead right now: -1..1 (positive = side 0).
export const advantage = (B) => clamp(B.side[0].st - B.side[1].st, -1, 1);

function resolve(B, a, d, s, ia) {
  const A = B.side[a], D = B.side[d], K = TUNE;
  const ownL = light(A, s), tl = light(D, s);
  A.hook = null;
  A.stats.hooks++;
  if (ownL >= K.ownMin && tl >= K.legMin) {
    const dmg = K.dmg + K.dmgLight * clamp(tl, 0, 1) + (ownL > 0.6 ? 0.04 : 0);
    D.st -= dmg; D.dirHit = -s; D.stun = K.stun; D.hook = null; D.v += -s * K.hitKick;
    A.rec = 0.45; A.v += s * 0.5;
    A.stats.lands++;
    const clean = tl >= K.cleanLight || D.st <= 0;
    B.ev.push({ k: 'land', side: a, s, light: tl, clean });
    if (clean) { D.st = Math.min(D.st, 0); return { win: a, how: 'fall' }; }
  } else if (tl < K.legMin) {
    A.rec = K.recMiss; A.st -= K.missCost; A.v += s * K.missKick; D.st = Math.min(1, D.st + K.stepOverGift);
    B.ev.push({ k: 'over', side: a, s });
  } else {
    A.rec = K.recMiss; A.st -= K.missCost; A.v += s * K.missKick;
    B.ev.push({ k: 'stumble', side: a, s });
  }
  A.st = clamp(A.st, 0, 1);
  if (A.st <= 0) return { win: d, how: 'stance' };
  void ia;
  return null;
}

export function stepRound(B, dt, cmds) {
  if (B.over) return B;
  B.ev.length = 0;
  B.t += dt;
  B.ang += dt * 0.42;
  const K = TUNE, S = B.side;
  // commands
  for (let i = 0; i < 2; i++) {
    const s = S[i], c = cmds[i] || { steer: 0, hook: 0 };
    let want = clamp(c.steer || 0, -1, 1);
    if (s.stun > 0) want *= 0.15;
    if (s.rec > 0) want *= 0.5;
    s.cmd = want;
    s.steer += (want - s.steer) * (1 - Math.exp(-dt * K.steerRate));
    if (c.hook && !s.hook && s.rec <= 0 && s.stun <= 0) { s.hook = { s: c.hook > 0 ? 1 : -1, t: 0 }; B.ev.push({ k: 'hook', side: i, s: s.hook.s }); }
    if (s.rec > 0) s.rec = Math.max(0, s.rec - dt);
    if (s.stun > 0) s.stun = Math.max(0, s.stun - dt);
  }
  // weight
  for (let i = 0; i < 2; i++) {
    const s = S[i], o = S[1 - i];
    const ph = s.sw.ph + B.t * s.sw.f * Math.PI * 2;
    const sway = K.swayAmp * Math.sin(ph);
    let drag = K.beltDrag * o.steer;
    if (s.steer * o.steer < 0) drag *= 1 - K.beltBrace * Math.min(1, Math.abs(s.steer));
    s.tgt = clamp(K.reach * s.steer + sway + drag, -1.1, 1.1);
    s.v += (K.spring * (s.tgt - s.w) - K.damp * s.v) * dt;
    s.w = clamp(s.w + s.v * dt, -1, 1);
    if (Math.abs(s.w) >= 1) s.v = 0;
    const f = Math.cos(ph) >= 0 ? 1 : -1;
    if (f !== s.foot) { if (s.foot !== 0) B.ev.push({ k: 'foot', side: i }); s.foot = f; }
  }
  // hooks in flight: the one that started earlier resolves first
  const order = [0, 1].filter((i) => S[i].hook).sort((a, b) => S[b].hook.t - S[a].hook.t || a - b);
  for (const i of order) { if (S[i].hook) S[i].hook.t += dt; }
  let result = null;
  const due = order.filter((i) => S[i].hook && S[i].hook.t >= K.windup);
  if (due.length === 2 && Math.abs(S[0].hook.t - S[1].hook.t) < 1e-6) {
    for (const i of [0, 1]) { S[i].hook = null; S[i].rec = 0.4; S[i].stun = 0.2; S[i].st -= 0.04; }
    B.ev.push({ k: 'clash' });
  } else {
    for (const i of due) { if (!S[i].hook || result) continue; result = resolve(B, i, 1 - i, S[i].hook.s, i); }
  }
  // stance regenerates while centred
  for (let i = 0; i < 2; i++) {
    const s = S[i];
    if (s.stun <= 0 && !s.hook && Math.abs(s.w) < K.regenBand && s.st > 0) s.st = Math.min(1, s.st + K.regen * dt);
  }
  // decide
  let win = result ? result.win : -1, how = result ? result.how : '';
  if (win < 0) {
    for (let i = 0; i < 2; i++) if (S[i].st <= 0) { win = 1 - i; how = 'stance'; }
  }
  if (win < 0 && B.t >= B.limit) {
    const adv = advantage(B);
    if (Math.abs(adv) < 0.03 && !B.extra) { B.extra = true; B.limit += EXTRA_TIME; B.ev.push({ k: 'extra' }); }
    else { win = adv > 0.0005 ? 0 : adv < -0.0005 ? 1 : (Math.abs(S[0].w) <= Math.abs(S[1].w) ? 0 : 1); how = 'points'; }
  }
  if (win >= 0) {
    B.over = { win, how, t: B.t, loser: 1 - win };
    B.ev.push({ k: 'end', win, how });
  }
  return B;
}
