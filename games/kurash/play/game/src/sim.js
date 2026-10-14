// The Kurash bout: pure, deterministic, no DOM, no clock. One bout is a small object stepped at a fixed rate.
//
// Seen from above, two wrestlers hold each other's belt on a round mat. Each one has a BALANCE POINT b (a 2D position inside a unit disc:
// the centre is a calm stance, the edge is falling). A tug pulls the rival's balance point toward the way the thumb drags; the balance
// point swings like a pendulum (spring + damping), so tugs that arrive in rhythm with the swing build it up. RELEASING the thumb while the
// rival leans the way you were dragging is a THROW: after a short wind-up it scores by how far they lean that way.
//   side 0 is the wrestler the first player controls (the human in a one-player match), side 1 the rival.
// A command is { x, y, release }: the drag vector (length 0..1) and whether the thumb was just lifted (a throw attempt in that direction).
export const STEP = 1 / 60;
export const BOUT_TIME = 60;
export const GOLDEN_TIME = 20;
export const TARGET_POINTS = 4;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const TUNE = {
  K: 58,            // stance spring: how hard the balance point is pulled back to the centre (1/s^2)
  D: 2.9,           // damping: low, so the balance point keeps swinging
  rootK: 1.9,       // while rooting (thumb still) the spring is this much stiffer ...
  rootD: 1.8,       // ... and the damping this much heavier
  tug: 30,          // force of a full tug on the rival's balance point
  react: 0.3,       // a tug also rocks the one who pulls, a little the opposite way
  gripBurn: 0.2,    // grip per second of full tugging
  gripRegen: 0.28,  // grip per second while rooting
  tired: 0.45,      // strength of an empty grip, as a fraction of a full one
  edge: 1.0,        // the balance point never goes beyond this radius
  windup: 0.28,     // seconds from release to the throw landing
  recover: 0.8,     // seconds a missed throw leaves you off your feet
  whiff: 0.32,      // below this quality a throw misses
  chala: 0.45,      // from this quality a throw scores chala (1 point)
  yonbosh: 0.66,   // yonbosh (2 points)
  halal: 0.84,       // halal: a perfect throw wins the bout outright
  passive: 7,       // seconds without tugging or throwing before a passivity warning
  reset: 1.5,       // seconds the wrestlers take to square up again after a score
  momentum: 0.07,   // quality bonus per unit of speed toward the throw
  minThrow: 0.35,   // the drag must be at least this long when the thumb lifts to count as a throw
};

const side = () => ({
  b: { x: 0, y: 0 }, v: { x: 0, y: 0 }, grip: 1, f: 1, cmd: { x: 0, y: 0 }, mag: 0, root: false, tugOn: false,
  wind: null, rec: 0, idle: 0, warn: 0, pts: 0,
  stats: { throws: 0, whiffs: 0, tugs: 0 },
});

export function newBout(opts = {}) {
  return { t: 0, golden: false, limit: BOUT_TIME, side: [side(), side()], pause: 0, over: null, ev: [], last: null, clock: 0, ...opts };
}

export const strength = (s) => TUNE.tired + (1 - TUNE.tired) * Math.pow(clamp(s.grip, 0, 1), 0.8);
export const len = (p) => Math.hypot(p.x, p.y);
export const unit = (p) => { const l = len(p); return l > 1e-6 ? { x: p.x / l, y: p.y / l } : { x: 0, y: 0 }; };

// Quality (0..1.1) of a throw by side i in direction d if it landed with the rival's balance where it will be `lead` seconds from now.
export function throwQuality(B, i, d, lead = 0) {
  const me = B.side[i], op = B.side[1 - i];
  const bx = op.b.x + op.v.x * lead, by = op.b.y + op.v.y * lead;
  const lean = bx * d.x + by * d.y;
  const mom = TUNE.momentum * clamp(op.v.x * d.x + op.v.y * d.y, -3, 3);
  const shaky = 0.5 * Math.max(0, len(me.b) - 0.45);
  const caught = op.wind ? 0.08 : 0;      // a wrestler in the middle of a throw is easy to catch
  return clamp(lean + mom - shaky + caught, 0, 1.1);
}
export const gradeOf = (q) => (q >= TUNE.halal ? 'halal' : q >= TUNE.yonbosh ? 'yonbosh' : q >= TUNE.chala ? 'chala' : null);
export const POINTS = { chala: 1, yonbosh: 2, halal: 0 };

function award(B, i, kind, q, how, d) {
  const s = B.side[i];
  B.ev.push({ k: 'score', side: i, kind, q, how, dx: d ? d.x : 0, dy: d ? d.y : 0 });
  B.last = { side: i, kind, q, how, dx: d ? d.x : 0, dy: d ? d.y : 0, t: B.t };
  if (kind === 'halal') { B.over = { win: i, how: 'halal', t: B.t, kind }; return; }
  s.pts += POINTS[kind];
  B.pause = TUNE.reset;
  for (const x of B.side) { x.wind = null; x.rec = 0; }
  if (B.golden) B.over = { win: i, how: 'golden', t: B.t, kind };
  else if (s.pts >= TARGET_POINTS) B.over = { win: i, how: 'points', t: B.t, kind };
}

function decide(B) {
  const a = B.side[0], b = B.side[1];
  if (a.pts !== b.pts) return { win: a.pts > b.pts ? 0 : 1, how: 'points' };
  if (a.warn !== b.warn) return { win: a.warn < b.warn ? 0 : 1, how: 'decision' };
  if (a.stats.throws !== b.stats.throws) return { win: a.stats.throws > b.stats.throws ? 0 : 1, how: 'decision' };
  return { win: a.grip >= b.grip ? 0 : 1, how: 'decision' };
}

export function stepBout(B, dt, cmds) {
  if (B.over) return B;
  B.ev.length = 0;
  B.t += dt;
  const K = TUNE, S = B.side;

  // the clock: regulation, then a golden-throw period when the points are level
  if (!B.golden && B.t >= B.limit) {
    if (S[0].pts === S[1].pts) { B.golden = true; B.ev.push({ k: 'golden' }); B.limit = B.t + GOLDEN_TIME; }
    else { B.over = { ...decide(B), t: B.t }; return B; }
  } else if (B.golden && B.t >= B.limit) { B.over = { ...decide(B), t: B.t }; return B; }

  if (B.pause > 0) {
    // squaring up again: everything settles
    B.pause -= dt;
    for (const s of S) { s.b.x *= 0.9; s.b.y *= 0.9; s.v.x = 0; s.v.y = 0; s.mag = 0; s.cmd = { x: 0, y: 0 }; s.root = true; s.grip = Math.min(1, s.grip + 0.25 * dt); }
    return B;
  }

  const force = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  for (let i = 0; i < 2; i++) {
    const s = S[i], c = cmds[i] || { x: 0, y: 0, release: false };
    let cx = c.x || 0, cy = c.y || 0;
    const cl0 = Math.hypot(cx, cy);
    if (cl0 > 1) { cx /= cl0; cy /= cl0; }
    const cl = Math.min(1, cl0);
    const busy = !!s.wind || s.rec > 0;
    if (s.rec > 0) s.rec = Math.max(0, s.rec - dt);
    // a throw attempt
    if (c.release && !busy && cl >= K.minThrow) {
      const d = { x: cx / cl, y: cy / cl };
      s.wind = { t: K.windup, dx: d.x, dy: d.y };
      s.stats.throws++; s.idle = 0;
      B.ev.push({ k: 'throw', side: i, dx: d.x, dy: d.y });
    }
    const act = !s.wind && s.rec <= 0;
    const m = act && !c.release ? cl : 0;
    s.cmd = { x: act && !c.release ? cx : 0, y: act && !c.release ? cy : 0 };
    s.mag = m;
    s.root = act && m < 0.15;
    s.f = strength(s);
    // tugging pulls on the rival and wears the grip; rooting restores it
    if (m >= 0.15) {
      const k = K.tug * s.f * (1 - 0.35 * len(s.b));
      force[1 - i].x += cx * k; force[1 - i].y += cy * k;
      force[i].x -= cx * k * K.react; force[i].y -= cy * k * K.react;
      s.grip = clamp(s.grip - K.gripBurn * m * dt, 0, 1);
      s.idle = 0;
      if (m > 0.5 && !s.tugOn) s.stats.tugs++;
      s.tugOn = m > 0.5;
    } else {
      s.tugOn = false;
      if (s.root) s.grip = clamp(s.grip + K.gripRegen * dt, 0, 1);
      if (act) s.idle += dt;
    }
  }
  // the pendulum of each balance point
  for (let i = 0; i < 2; i++) {
    const s = S[i];
    const kk = K.K * (s.root ? K.rootK : 1), dd = K.D * (s.root ? K.rootD : 1);
    s.v.x += (force[i].x - kk * s.b.x - dd * s.v.x) * dt;
    s.v.y += (force[i].y - kk * s.b.y - dd * s.v.y) * dt;
    s.b.x += s.v.x * dt; s.b.y += s.v.y * dt;
    const r = len(s.b);
    if (r > K.edge) {
      s.b.x *= K.edge / r; s.b.y *= K.edge / r;
      const vr = (s.v.x * s.b.x + s.v.y * s.b.y) / K.edge;
      if (vr > 0) { s.v.x -= (s.b.x / K.edge) * vr * 1.4; s.v.y -= (s.b.y / K.edge) * vr * 1.4; }
    }
  }
  // throws landing
  const res = [null, null];
  for (let i = 0; i < 2; i++) {
    const s = S[i];
    if (!s.wind) continue;
    s.wind.t -= dt;
    if (s.wind.t > 0) continue;
    const d = { x: s.wind.dx, y: s.wind.dy };
    res[i] = { q: throwQuality(B, i, d, 0), d };
    s.wind = null;
  }
  const good = (r) => r && r.q >= K.chala;
  for (let i = 0; i < 2; i++) {
    const r = res[i];
    if (!r) continue;
    const other = res[1 - i];
    const beaten = !!(other && good(other) && other.q > r.q);
    const s = S[i];
    if (good(r) && !beaten) {
      award(B, i, gradeOf(r.q), r.q, 'throw', r.d);
      if (B.over || B.pause > 0) break;
    } else if (r.q < K.whiff || beaten) {
      s.rec = K.recover; s.stats.whiffs++;
      s.v.x += r.d.x * 2.4; s.v.y += r.d.y * 2.4;
      B.ev.push({ k: 'whiff', side: i, dx: r.d.x, dy: r.d.y, q: r.q, countered: beaten });
    } else {
      // a half-throw: a stumble, no points
      s.rec = K.recover * 0.5; s.v.x += r.d.x * 1.2; s.v.y += r.d.y * 1.2;
      B.ev.push({ k: 'stumble', side: i, dx: r.d.x, dy: r.d.y, q: r.q });
    }
  }
  // passivity: a wrestler who neither tugs nor throws is warned, then penalised
  if (!B.over && B.pause <= 0) {
    for (let i = 0; i < 2; i++) {
      const s = S[i];
      if (s.idle >= K.passive) {
        s.idle = 0; s.warn++;
        B.ev.push({ k: 'warn', side: i, n: s.warn });
        if (s.warn >= 2) { award(B, 1 - i, 'chala', 0.5, 'passive', null); break; }
      }
    }
  }
  return B;
}
