// Horseshoe Pitching: the pit, the shoe and the throw. Pure and deterministic: every random draw comes from a `rnd()` handed in
// by the caller (the game's own forked stream, or an AI planner's), never from the clock.
//
// Units are metres. Pit coordinates: the stake is the origin, x runs to the pitcher's right, v runs AWAY from the pitcher
// (so v < 0 is the front of the pit and v > 0 the back). A shoe has a centre (x, v) and a heading `ang`: the direction its
// open end points, 0 = straight away from the pitcher, positive = turned to the pitcher's right.

export const PIT = { halfW: 0.40, front: -0.91, back: 0.91 };
export const LANE = 12.19;            // 40 ft between the two stakes
export const R_STAKE = 0.0127;        // a 1 inch stake
export const SIX = 0.1524;            // 6 inches: the closeness limit for a point
export const TARGET_LIMITS = { x: 0.36, v0: -0.56, v1: 0.6 };
// shoe geometry: a U of steel 4.5 cm thick. CL = radius of its centre line (and half the inside gap + half the thickness)
export const CL = 0.0665, HALF_T = 0.0225, TIP = 0.095;
export const SHOE_OUT = 0.09;

export const FLIPS = [
  { id: 'three', name: 'Three-quarter', short: '¾ turn', turns: 0.75, sd: 0.3, window: 26, slide: 0.07, bounce: 0.17,
    note: 'Wide release window; lands flatter, digs in, bounces more.' },
  { id: 'quarter', name: 'One and a quarter', short: '1¼ turns', turns: 1.25, sd: 0.15, window: 16, slide: 0.17, bounce: 0.05,
    note: 'Narrow release window; lands level and slides onto the stake.' },
];

// pits: how far a shoe slides, how much it hops, how much the surface scatters it
export const PITS = {
  clay: { id: 'clay', name: 'Packed Clay', slideK: 1, bounceK: 1, noiseK: 1, note: 'Even clay: shoes slide a little and stay put.' },
  sand: { id: 'sand', name: 'Soft Sand', slideK: 0.35, bounceK: 0.4, noiseK: 0.9, note: 'Shoes plug in where they land: little slide, little hop.' },
  hard: { id: 'hard', name: 'Hard Pan', slideK: 1.6, bounceK: 1.5, noiseK: 1.1, note: 'Dry and fast: long slides and lively hops.' },
};
export const PIT_IDS = ['clay', 'sand', 'hard'];
// the Daily Pit: a surface mixed from the day number, the same for everyone that day
export function dailyPit(day) {
  const h = (n) => { const x = Math.sin((day | 0) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  return { id: 'daily', name: 'Daily Pit', slideK: 0.4 + h(1) * 1.3, bounceK: 0.4 + h(2) * 1.2, noiseK: 0.9 + h(3) * 0.25, note: 'A new surface every day.' };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = (rnd) => (rnd() + rnd() + rnd() - 1.5) * 2;   // about N(0,1), bounded to +-3

// ---- shoe geometry ----------------------------------------------------------------------------------------------------------
// centre line in local (lateral, along) coordinates, tip of the left arm -> closed end -> tip of the right arm
const CENTRE = (() => {
  const p = [];
  for (let i = 0; i <= 4; i++) p.push([-CL, TIP - (TIP * i) / 4]);
  for (let i = 1; i < 12; i++) { const a = Math.PI + (Math.PI * i) / 12; p.push([CL * Math.cos(a), CL * Math.sin(a)]); }
  for (let i = 0; i <= 4; i++) p.push([CL, (TIP * i) / 4]);
  return p;
})();

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Where the stake sits relative to a shoe: along / lateral coordinates, distance from the stake centre to the steel, and whether the
// stake is inside the horseshoe's opening ("inner") and far enough in to be a ringer.
export function stakeLocal(sh) {
  const s = Math.sin(sh.ang), c = Math.cos(sh.ang);
  const dx = -sh.x, dv = -sh.v;
  const a = dx * s + dv * c, b = dx * c - dv * s;
  let dmin = 1e9;
  for (let i = 1; i < CENTRE.length; i++) {
    const d = segDist(b, a, CENTRE[i - 1][0], CENTRE[i - 1][1], CENTRE[i][0], CENTRE[i][1]);
    if (d < dmin) dmin = d;
  }
  const inner = a >= 0 ? Math.abs(b) < CL : Math.hypot(a, b) < CL;
  return { a, b, d: Math.max(0, dmin - HALF_T), inner, ringer: inner && a <= TIP };
}
export const isRinger = (sh) => !sh.dead && stakeLocal(sh).ringer;
// distance from the stake's edge to the nearest steel (0 when touching or a ringer)
export const edgeDist = (sh) => { const q = stakeLocal(sh); return q.ringer ? 0 : Math.max(0, q.d - R_STAKE); };
export const inPit = (x, v) => Math.abs(x) <= PIT.halfW && v >= PIT.front && v <= PIT.back;

// Outline of a shoe as points (x, v) in the pit plane, for drawing. Outer edge then inner edge.
export function shoeOutline(sh, scale = 1) {
  const s = Math.sin(sh.ang), c = Math.cos(sh.ang);
  const loc = [];
  const ro = CL + HALF_T, ri = CL - HALF_T;
  loc.push([-ro, TIP]);
  for (let i = 0; i <= 14; i++) { const a = Math.PI + (Math.PI * i) / 14; loc.push([ro * Math.cos(a), ro * Math.sin(a)]); }
  loc.push([ro, TIP], [ri, TIP]);
  for (let i = 14; i >= 0; i--) { const a = Math.PI + (Math.PI * i) / 14; loc.push([ri * Math.cos(a), ri * Math.sin(a)]); }
  loc.push([-ri, TIP]);
  return loc.map(([lat, along]) => [sh.x + (lat * c + along * s) * scale, sh.v + (-lat * s + along * c) * scale]);
}

// ---- the throw --------------------------------------------------------------------------------------------------------------
// p: { tx, tv, flip, e, side, id, kLat, kDep, kAng }
//   (tx, tv)  where the player wants the shoe to come to rest
//   flip      index into FLIPS
//   e         release error in window units: -1..1 is inside the green, negative early / short, positive late / long
//   kLat/kDep/kAng  scatter multipliers (1 for a person; a rival's skill)
// shoes: array of { id, side, x, v, ang, dead }. Returns a plan: the landing, the slide, every shoe that gets pushed, and the final list.
export function resolveThrow(pitId, shoes, p, rnd) {
  const pit = typeof pitId === 'object' && pitId ? pitId : PITS[pitId] || PITS.clay, fl = FLIPS[p.flip] || FLIPS[0];
  const kLat = (p.kLat ?? 1) * pit.noiseK, kDep = (p.kDep ?? 1) * pit.noiseK, kAng = p.kAng ?? 1;
  const e = clamp(p.e ?? 0, -3.5, 3.5);
  const slideMean = fl.slide * pit.slideK;
  const events = [];
  const out = shoes.map((s) => ({ ...s }));
  const me = { id: p.id, side: p.side, x: 0, v: 0, ang: 0, dead: false, ringer: false };
  const hits = [];                          // pushes: { at: slide step index, id, from, to }

  const lx = p.tx + gauss(rnd) * 0.07 * kLat * (1 + 0.6 * Math.abs(e));
  const lv = p.tv - slideMean + e * 0.2 + gauss(rnd) * 0.075 * kDep * (1 + 0.4 * Math.abs(e));
  const ang0 = e * 0.4 + gauss(rnd) * fl.sd * kAng;
  me.x = lx; me.v = lv; me.ang = ang0;
  const land = { x: lx, v: lv, ang: ang0 };
  const slide = [];

  const push = (at, other, fromC) => {
    const dx = other.x - fromC.x, dv = other.v - fromC.v, d = Math.hypot(dx, dv) || 0.001;
    const mag = 0.13 + rnd() * 0.12;
    const from = { x: other.x, v: other.v, ang: other.ang };
    other.x += (dx / d) * mag; other.v += (dv / d) * mag + 0.02; other.ang += (rnd() - 0.5) * 1.3;
    hits.push({ at, id: other.id, from, to: { x: other.x, v: other.v, ang: other.ang } });
    events.push({ t: 'knock', at, x: other.x, v: other.v });
    if (!inPit(other.x, other.v)) { other.dead = true; events.push({ t: 'out', at, id: other.id }); }
  };
  // A shoe that lands on or slides into another knocks it away. A ringer already around the stake is harder to dislodge: a shoe
  // landing across it often stacks on top and carries on (two ringers on one stake are common).
  const bump = (at, c) => {
    for (const o of out) {
      if (o.dead || o.id === me.id) continue;
      const d = Math.hypot(o.x - c.x, o.v - c.v);
      if (d >= 0.165) continue;
      if (stakeLocal(o).ringer && rnd() >= (d < 0.09 ? 0.7 : 0.3)) continue;
      push(at, o, c); return true;
    }
    return false;
  };

  let stopped = false;
  if (Math.abs(me.x) > PIT.halfW + 0.03 || me.v < PIT.front - 0.05 || me.v > PIT.back + 0.05) {
    me.dead = true; events.push({ t: 'out', at: 0, id: me.id, why: 'wide' }); stopped = true;
  }
  if (!stopped) {
    events.push({ t: 'land', at: 0, x: me.x, v: me.v });
    if (bump(0, me)) { events.push({ t: 'clack', at: 0 }); stopped = true; }
  }
  // a hop: a shoe that lands badly springs forward and turns
  if (!stopped && rnd() < fl.bounce * pit.bounceK * (0.7 + 0.3 * Math.abs(e))) {
    const h = 0.14 + rnd() * 0.24, turn = gauss(rnd) * 0.45;
    me.x += Math.sin(turn) * h * 0.6; me.v += h; me.ang += gauss(rnd) * 0.9;
    events.push({ t: 'hop', at: 0, x: me.x, v: me.v });
    if (!inPit(me.x, me.v)) { me.dead = true; events.push({ t: 'out', at: 0, id: me.id, why: 'hop' }); stopped = true; }
    else if (bump(0, me)) { events.push({ t: 'clack', at: 0 }); stopped = true; }
  }
  // the slide, 1 cm at a time, with the stake funnelling the shoe in (or knocking it away)
  if (!stopped) {
    const sl = Math.max(0.012, slideMean * (0.6 + rnd() * 0.8));
    const steps = Math.round(sl / 0.01);
    for (let i = 1; i <= steps; i++) {
      me.v += 0.01;
      const q = stakeLocal(me);
      if (q.d < R_STAKE) {
        const side = q.b >= 0 ? 1 : -1, cs = Math.cos(me.ang), sn = Math.sin(me.ang), k = R_STAKE - q.d + 0.003;
        if (q.inner) {
          me.x += cs * side * k; me.v -= sn * side * k; me.ang += -side * 0.04;
          if (q.a < -CL * 0.55) { events.push({ t: 'ring', at: i }); break; }   // the closed end met the stake
          if (!events.some((e2) => e2.t === 'tink')) events.push({ t: 'tink', at: i });
        } else {
          me.x -= cs * side * (k + 0.012); me.v += sn * side * (k + 0.012); me.ang -= side * 0.28;
          events.push({ t: 'clank', at: i });
          slide.push({ x: me.x, v: me.v, ang: me.ang });
          break;
        }
      }
      if (bump(i, me)) { events.push({ t: 'clack', at: i }); slide.push({ x: me.x, v: me.v, ang: me.ang }); break; }
      slide.push({ x: me.x, v: me.v, ang: me.ang });
      if (!inPit(me.x, me.v)) { me.dead = true; events.push({ t: 'out', at: i, id: me.id, why: 'slid' }); break; }
    }
  }
  me.ringer = !me.dead && stakeLocal(me).ringer;
  if (me.ringer) events.push({ t: 'ringer', at: slide.length });
  out.push(me);
  for (const o of out) o.ringer = !o.dead && stakeLocal(o).ringer;
  return { land, slide, hits, events, shoes: out, me, ringer: me.ringer, dead: me.dead };
}

// ---- scoring ----------------------------------------------------------------------------------------------------------------
// Cancellation scoring. Each side totals 3 per ringer plus 1 per other shoe within 6 in. that is closer than the rival's best shoe
// (neither counts a shoe the rival's ringer already beats); the lower total is taken from the higher, so only one side scores.
export function scoreInning(shoes) {
  const alive = shoes.filter((s) => !s.dead);
  const r = [0, 0], best = [Infinity, Infinity], list = [[], []];
  for (const s of alive) {
    if (s.ringer ?? isRinger(s)) { r[s.side]++; continue; }
    const d = edgeDist(s);
    if (d <= SIX) { list[s.side].push(d); if (d < best[s.side]) best[s.side] = d; }
  }
  const gross = [r[0] * 3, r[1] * 3];
  const close = [0, 0];
  for (let t = 0; t < 2; t++) {
    const o = 1 - t;
    for (const d of list[t]) if (d < best[o]) close[t]++;
  }
  gross[0] += close[0]; gross[1] += close[1];
  const net = gross[0] - gross[1];
  return { ringers: r, close, gross, net, side: net > 0 ? 0 : net < 0 ? 1 : -1, pts: Math.abs(net) };
}

// ---- timing: the arm swing --------------------------------------------------------------------------------------------------
// One swing cycle while PITCH is held: wind-up back, a pendulum swing forward through the release mark, follow-through, return.
export const SWING = { back: 0.45, fwd: 0.95, hold: 0.22, ret: 0.36, A: 70, mark: 56 };
export const SWING_TOTAL = SWING.back + SWING.fwd + SWING.hold + SWING.ret;
export function armAngle(t, speed = 1) {
  const S = SWING, T = ((t * speed) % SWING_TOTAL + SWING_TOTAL) % SWING_TOTAL;
  if (T < S.back) { const k = T / S.back; return { deg: -S.A * Math.sin((k * Math.PI) / 2), phase: 'back', k }; }
  let u = T - S.back;
  if (u < S.fwd) { const k = u / S.fwd; return { deg: -S.A * Math.cos(k * Math.PI), phase: 'fwd', k }; }
  u -= S.fwd;
  if (u < S.hold) return { deg: S.A, phase: 'hold', k: u / S.hold };
  u -= S.hold;
  return { deg: S.A * (1 - u / S.ret), phase: 'ret', k: u / S.ret };
}
export function releaseError(arm, flip, calm) {
  const win = FLIPS[flip].window * (calm ? 1.4 : 1);
  if (arm.phase === 'back') return -3.5;
  if (arm.phase !== 'fwd') return 3.5;
  return clamp((arm.deg - SWING.mark) / win, -3.5, 3.5);
}
export const windowDeg = (flip, calm) => FLIPS[flip].window * (calm ? 1.4 : 1);

// ---- flight (for the camera and the picture only) ---------------------------------------------------------------------------
export const FLIGHT_T = 0.95;
export const HAND = { x: 0.32, y: 0.9, z: 0.4 };
// position of the shoe in the world (x lateral, y up, z along the lane) at progress k in 0..1, landing at (x, v)
export function flightPos(land, k) {
  const zEnd = LANE + land.v, xEnd = land.x;
  const z = HAND.z + (zEnd - HAND.z) * k;
  const x = HAND.x + (xEnd - HAND.x) * k;
  const y = HAND.y * (1 - k) + 3.1 * 4 * k * (1 - k) * (1 - 0.15 * k);
  return { x, y: Math.max(0.02, y), z };
}
