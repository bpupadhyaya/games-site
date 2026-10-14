// The stick-pull physics: pure, deterministic, no DOM, no clock. One bout is a small object stepped at a fixed rate.
//
// Two athletes sit facing each other with their feet braced on a board and pull one stick. Side 0 is the athlete on the left of the
// screen (the human in a one-player match), side 1 the athlete on the right.
//   Shared      x   where the stick is drawn: +1 = right into the hands of side 0, -1 = right over to side 1
//               h   lift: +1 = side 0 has lifted side 1 off the floor, -1 = the other way round
//   Per side    st  stamina 0..1       gr  grip 0..1       vec { b, u }  the pull actually applied (hands are a little slow)
//               m   effort (0..1)      mSlow  its slow average, so (m - mSlow) is the SNAP of a sudden hard pull
// A command is { b: 0..1 (pull back toward yourself), u: -1..1 (lift up, or sink down when negative) }.
export const STEP = 1 / 60;
export const BOUT_TIME = 45;
export const EXTRA_TIME = 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const TUNE = {
  hand: 14,          // how quickly the hands follow a command (1/s)
  slowAvg: 0.35,     // seconds of the effort average that a snap is measured against
  snapGain: 1.1,     // extra force at a full snap
  staminaBurn: 0.2,  // stamina per second at full effort (scaled by effort squared)
  sinkBurn: 0.05,
  regen: 0.16,       // per second when resting (effort below 0.25)
  regenSink: 0.06,
  tiredFloor: 0.4,   // strength of an empty athlete
  drawGain: 3.2, drawDamp: 5,
  liftGain: 1.0, settle: 0.6,
  levAmp: 0.45,      // leverage: lift is stronger with the stick drawn to your side
  sinkDefence: 0.65,
  gripPull: 0.06, gripAttack: 0.22, gripSink: 0.12, gripRest: 0.03, gripEdge: 0.09,
};

export function newBout(opts = {}) {
  const side = () => ({ st: 1, gr: 1, vec: { b: 0, u: 0 }, m: 0, mSlow: 0, snap: 0, cmd: { b: 0, u: 0 }, f: 1, atk: 0, stats: { snaps: 0, burned: 0 } });
  return { t: 0, x: 0, h: 0, vx: 0, side: [side(), side()], over: null, extra: false, limit: BOUT_TIME, ev: [], clock: 0, ...opts };
}

// Strength of an athlete: a tired one still pulls, but weakly.
export const strength = (s) => TUNE.tiredFloor + (1 - TUNE.tiredFloor) * Math.pow(clamp(s.st, 0, 1), 0.8);
// Lift leverage of a side given where the stick is drawn.
export const leverage = (B, i) => 1 + TUNE.levAmp * (i === 0 ? B.x : -B.x);
// Who is ahead right now: -1..1 (positive = side 0).
export const advantage = (B) => clamp(0.6 * B.h + 0.4 * B.x + 0.05 * (B.side[0].st - B.side[1].st), -1, 1);

export function stepBout(B, dt, cmds) {
  if (B.over) return B;
  B.ev.length = 0;
  B.t += dt;
  const K = TUNE;
  const S = B.side;
  for (let i = 0; i < 2; i++) {
    const s = S[i], c = cmds[i] || { b: 0, u: 0 };
    s.cmd = { b: clamp(c.b, 0, 1), u: clamp(c.u, -1, 1) };
    const k = 1 - Math.exp(-dt * K.hand);
    s.vec.b += (s.cmd.b - s.vec.b) * k;
    s.vec.u += (s.cmd.u - s.vec.u) * k;
    const up = Math.max(0, s.vec.u), sink = Math.max(0, -s.vec.u);
    const e = clamp(Math.hypot(s.vec.b, up), 0, 1);
    s.m = e;
    s.mSlow += (e - s.mSlow) * (1 - Math.exp(-dt / K.slowAvg));
    const was = s.snap;
    s.snap = clamp(e - s.mSlow, 0, 1);
    if (s.snap > 0.55 && was <= 0.55) { s.stats.snaps++; B.ev.push({ k: 'snap', side: i, v: s.snap }); }
    // stamina
    const burn = K.staminaBurn * e * e + K.sinkBurn * sink * sink;
    s.stats.burned += burn * dt;
    s.st -= burn * dt;
    if (e < 0.25) s.st += dt * (K.regen * (1 - e / 0.25) + K.regenSink * sink);
    const was2 = s.st;
    s.st = clamp(s.st, 0, 1);
    if (was2 <= 0 && !s.spent) { s.spent = true; B.ev.push({ k: 'spent', side: i }); } else if (s.st > 0.3) s.spent = false;
    s.f = strength(s);
  }
  // forces
  const eff = S.map((s, i) => {
    const snapK = 1 + K.snapGain * s.snap;
    return {
      b: s.vec.b * s.f * snapK,
      l: Math.max(0, s.vec.u) * s.f * snapK * leverage(B, i),
      s: Math.max(0, -s.vec.u) * (0.6 + 0.4 * s.f),
    };
  });
  // the stick is drawn toward whoever pulls back harder
  const net = eff[0].b - eff[1].b;
  B.vx += (K.drawGain * net - K.drawDamp * B.vx) * dt;
  B.x = clamp(B.x + B.vx * dt, -1, 1);
  if (Math.abs(B.x) >= 1) B.vx = 0;
  // the lift gauge
  const A = eff[0].l * (1 - K.sinkDefence * eff[1].s);       // side 0 lifting side 1
  const Bk = eff[1].l * (1 - K.sinkDefence * eff[0].s);      // side 1 lifting side 0
  S[0].atk = A; S[1].atk = Bk;
  const calm = 1 - Math.min(1, (A + Bk) * 2);
  B.h = clamp(B.h + dt * (K.liftGain * (A - Bk) - K.settle * B.h * calm), -1, 1);
  // grip: effort and the rival's lift wear it, a sink and a rest restore it; a stick drawn right over slips away
  const attackOn = [Bk, A];
  for (let i = 0; i < 2; i++) {
    const s = S[i];
    let d = -K.gripPull * s.m * s.m - K.gripAttack * attackOn[i];
    d += K.gripSink * eff[i].s;
    if (s.m < 0.25) d += K.gripRest;
    const edge = i === 0 ? -B.x : B.x;           // positive when the stick has been drawn toward the other side
    if (edge > 0.85) d -= K.gripEdge * ((edge - 0.85) / 0.15);
    s.gr = clamp(s.gr + d * dt, 0, 1);
  }
  // decide
  let win = -1, how = '';
  if (B.h >= 0.999) { win = 0; how = 'lift'; } else if (B.h <= -0.999) { win = 1; how = 'lift'; }
  else if (S[1].gr <= 0 && S[0].gr > 0) { win = 0; how = 'grip'; } else if (S[0].gr <= 0 && S[1].gr > 0) { win = 1; how = 'grip'; }
  else if (S[0].gr <= 0 && S[1].gr <= 0) { win = S[0].st >= S[1].st ? 0 : 1; how = 'grip'; }
  if (win < 0 && B.t >= B.limit) {
    const adv = advantage(B);
    if (Math.abs(adv) < 0.04 && !B.extra) { B.extra = true; B.limit += EXTRA_TIME; B.ev.push({ k: 'extra' }); }
    else { win = adv > 0.0005 ? 0 : adv < -0.0005 ? 1 : S[0].gr >= S[1].gr ? 0 : 1; how = 'points'; }
  }
  if (win >= 0) {
    B.over = { win, how, t: B.t, x: B.x, h: B.h };
    B.ev.push({ k: 'end', win, how });
  }
  return B;
}
