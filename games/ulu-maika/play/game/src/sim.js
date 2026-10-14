// Ulu Maika physics: pure and deterministic. Metres and seconds. The lane runs along +y from the roll line (y = 0); x is across,
// positive to the right. A roll is a flat disc on edge: it runs on at a speed set by the swipe, slows by a rolling drag (more in mud),
// is pushed sideways by cross slopes, curves with its lean, and bounces off stakes and boulders.
//
//   params = { ang (rad, 0 = straight up the lane, positive = right), power 0..1, lean -2..2 }
//   simulate(track, params, opts) -> { result, path }       (whole roll at once: preview and computer players)
//   startRoll / stepRoll                                    (the same integration, a frame at a time, for the animation)
import { createRng } from '../kit/rng.js';

export const H = 1 / 120;              // fixed integration step
export const DISC_R = 0.065;
export const STAKE_R = 0.03;
export const V_MIN = 1.2, V_MAX = 9.0; // roll speed at power 0 and 1 (m/s)
export const LEAN_K = 0.009;          // curvature (1/m) per lean step
export const ANG_MAX = 0.26;           // the sight turns up to about 15 degrees either way
export const RING_R = 1.35;
export const FAR_R = 0.17;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const speedOf = (power) => V_MIN + (V_MAX - V_MIN) * clamp(power, 0, 1);

// ---- courses -------------------------------------------------------------------------------------------------------------
// gates: stake pairs across the lane (x centre, y, w = clear gap between stakes). slopes: lateral push in m/s^2 over a stretch.
// mud: a rectangle with 4x drag. rocks: boulders. drag: base rolling deceleration in m/s^2.
const BASE = { half: 2.6, drag: 0.5, slopes: [], mud: [], rocks: [] };
export const TRACKS = {
  meadow: {
    ...BASE, id: 'meadow', name: 'Meadow Run', note: 'One wide gate and a long, kind lane.', len: 22, drag: 0.46,
    gates: [{ x: 0, y: 8, w: 1.7 }], far: { x: 0, y: 22 },
  },
  slope: {
    ...BASE, id: 'slope', name: 'Sloped Field', note: 'A cross slope pushes slow discs off line.', len: 24,
    gates: [{ x: 0.3, y: 9, w: 1.4 }], far: { x: 0.3, y: 24 }, slopes: [{ y0: 3, y1: 21, a: -0.1 }],
  },
  twin: {
    ...BASE, id: 'twin', name: 'Twin Stakes', note: 'Two offset gates: bow the roll through both.', len: 26,
    gates: [{ x: -0.4, y: 7, w: 1.3 }, { x: 0, y: 16, w: 1.1 }], far: { x: 1.0, y: 26 },
  },
  mud: {
    ...BASE, id: 'mud', name: 'Mud and Boulder', note: 'A mud patch drags, a boulder asks for a curve.', len: 26,
    gates: [{ x: 0.7, y: 10, w: 1.3 }], far: { x: 0.7, y: 26 },
    mud: [{ y0: 14, y1: 18, x0: -2.6, x1: 2.6 }], rocks: [{ x: 0.1, y: 5, r: 0.3 }],
  },
};
export const TRACK_IDS = ['meadow', 'slope', 'twin', 'mud', 'daily'];

// The Daily Course: a different mix of gates, slopes, mud and boulders for every day number, the same for every player.
export function makeTrack(id, day = 0) {
  if (id !== 'daily') return TRACKS[id] || TRACKS.meadow;
  const r = createRng(((day | 0) * 2654435761 + 977) >>> 0);
  const len = 24 + Math.floor(r.next() * 5);
  const gates = [];
  const n = 1 + Math.floor(r.next() * 2);
  let gx = (r.next() - 0.5) * 1.2;
  for (let i = 0; i < n; i++) {
    const y = Math.round((6 + (len - 10) * ((i + 0.6) / n) + r.next() * 2) * 2) / 2;
    gx = clamp(gx + (r.next() - 0.5) * 1.6, -1.2, 1.2);
    gates.push({ x: Math.round(gx * 10) / 10, y, w: Math.round((1.15 + r.next() * 0.35) * 20) / 20 });
  }
  const slopes = r.next() < 0.6 ? [{ y0: 3, y1: len - 3, a: (r.next() < 0.5 ? -1 : 1) * (0.05 + r.next() * 0.07) }] : [];
  const mud = r.next() < 0.5 ? [{ y0: len - 11, y1: len - 7, x0: -2.6, x1: 2.6 }] : [];
  const rocks = r.next() < 0.5 ? [{ x: Math.round((r.next() - 0.5) * 20) / 10, y: 4 + Math.floor(r.next() * 3), r: 0.3 }] : [];
  const far = { x: gates[gates.length - 1].x, y: len };
  return { ...BASE, id: 'daily', name: 'Daily Course', note: 'A new mix every day, the same for everyone.', len, drag: 0.46 + r.next() * 0.1, gates, far, slopes, mud, rocks };
}
export const maxPoints = (track) => 2 * track.gates.length + 3;

// ---- one roll --------------------------------------------------------------------------------------------------------------
// state: x, y, vx, vy, lean, t, gates[] (0 open, 1 passed, 2 clipped, 3 missed), hit, out, rest(bool), touched
export function startRoll(track, p) {
  const v = speedOf(p.power), a = p.ang;
  return {
    x: p.x0 ?? 0, y: 0, vx: v * Math.sin(a), vy: v * Math.cos(a), lean: p.lean | 0, t: 0, v0: v,
    gates: track.gates.map(() => 0), hit: false, hitV: 0, out: false, outWhy: '', rest: false, touched: 0, bumps: 0, steps: 0, stuck: 0,
  };
}

const circle = (s, cx, cy, cr, e, ev, tag) => {
  const dx = s.x - cx, dy = s.y - cy, rr = DISC_R + cr, d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return false;
  const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d, vn = s.vx * nx + s.vy * ny;
  s.x = cx + nx * rr; s.y = cy + ny * rr;
  if (vn < 0) {
    s.vx -= (1 + e) * vn * nx; s.vy -= (1 + e) * vn * ny;
    ev.push({ t: tag, x: s.x, y: s.y, v: -vn });
  }
  return true;
};

export function stepRoll(track, s, ev = []) {
  if (s.rest || s.out) return;
  const v = Math.hypot(s.vx, s.vy);
  // drag: rolling resistance, four times as strong in mud
  let drag = track.drag + 0.012 * v * v;
  for (const m of track.mud) if (s.y >= m.y0 && s.y <= m.y1 && s.x >= m.x0 && s.x <= m.x1) drag *= 4;
  const nv = v - drag * H;
  if (nv <= 0.06) { s.vx = 0; s.vy = 0; s.rest = true; s.t += H; return; }
  const k = nv / v;
  s.vx *= k; s.vy *= k;
  // lean bows the roll: a turn rate proportional to speed (constant curvature)
  if (s.lean) {
    const w = -s.lean * LEAN_K * nv * H, c = Math.cos(w), sn = Math.sin(w);
    const vx = s.vx * c - s.vy * sn, vy = s.vx * sn + s.vy * c;
    s.vx = vx; s.vy = vy;
  }
  for (const sl of track.slopes) if (s.y >= sl.y0 && s.y <= sl.y1) s.vx += sl.a * H;
  const px = s.x, py = s.y;
  s.x += s.vx * H; s.y += s.vy * H; s.t += H; s.steps++;

  // gates: a pass is the centre line crossing y = gate.y between the stakes with neither stake touched
  track.gates.forEach((g, i) => {
    const sx = [g.x - g.w / 2 - STAKE_R, g.x + g.w / 2 + STAKE_R];
    for (const x of sx) {
      if (Math.abs(s.y - g.y) < 0.6 && circle(s, x, g.y, STAKE_R, 0.5, ev, 'stake')) { if (s.gates[i] === 0) s.gates[i] = 2; s.touched++; }
    }
    if (py < g.y && s.y >= g.y && s.gates[i] === 0) {
      const f = (g.y - py) / Math.max(1e-6, s.y - py), cx = px + (s.x - px) * f;
      if (Math.abs(cx - g.x) <= g.w / 2) { s.gates[i] = 1; ev.push({ t: 'gate', i, x: cx, y: g.y }); } else s.gates[i] = 3;
    }
  });
  for (const r of track.rocks) if (circle(s, r.x, r.y, r.r, 0.3, ev, 'rock')) s.bumps++;
  // the far stake
  const f = track.far;
  const before = s.hit;
  if (circle(s, f.x, f.y, FAR_R, 0.4, ev, 'far')) { if (!before) { s.hit = true; s.hitV = Math.hypot(s.vx, s.vy); } }

  if (Math.abs(s.x) > track.half + 0.35) { s.out = true; s.outWhy = 'side'; ev.push({ t: 'out', x: s.x, y: s.y, why: 'side' }); }
  else if (s.y > track.len + 2.6) { s.out = true; s.outWhy = 'end'; ev.push({ t: 'out', x: s.x, y: s.y, why: 'end' }); }
  else if (s.y < -0.6) { s.out = true; s.outWhy = 'back'; ev.push({ t: 'out', x: s.x, y: s.y, why: 'back' }); }
}

// Points and a breakdown for a finished (or in-progress) roll.
export function judge(track, s) {
  const passed = s.gates.filter((g) => g === 1).length, all = passed === track.gates.length;
  const f = track.far, dist = Math.hypot(s.x - f.x, s.y - f.y);
  const inRing = !s.out && s.rest && all && dist <= RING_R;
  const stake = s.hit ? (all ? 2 : 1) : 0;
  const gp = passed * 2, ring = inRing ? 1 : 0;
  return {
    points: gp + stake + ring, passed, gates: track.gates.length, allGates: all, hit: s.hit, stake, ring, inRing, out: s.out, outWhy: s.outWhy,
    gs: s.gates.slice(), dist, x: s.x, y: s.y, clipped: s.gates.filter((g) => g === 2).length, missed: s.gates.filter((g) => g === 3).length, bumps: s.bumps,
  };
}

// Run a whole roll. opts.path = keep every n-th point; opts.cap = max steps.
export function simulate(track, p, opts = {}) {
  const s = startRoll(track, p), every = opts.every ?? 0, path = [];
  const cap = opts.cap ?? 120 * 40;
  const ev = [];
  if (every) path.push({ x: s.x, y: s.y });
  let n = 0;
  while (!s.rest && !s.out && n < cap) {
    stepRoll(track, s, ev); n++;
    ev.length = 0;
    if (every && n % every === 0) path.push({ x: s.x, y: s.y });
  }
  if (every) path.push({ x: s.x, y: s.y });
  return { s, result: judge(track, s), path };
}

// The power at which a straight, unobstructed roll stops at distance d (used for the gauge ticks). Bisection over the drag model.
export function powerToStopAt(track, d) {
  const clean = { ...track, gates: [], rocks: [], slopes: [], far: { x: 99, y: 99 }, half: 99 };
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2, r = simulate(clean, { ang: 0, power: mid, lean: 0 }, { cap: 120 * 60 });
    if (r.s.y < d) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Release noise: a slow, small swipe is steady; a hard one wobbles more. `calm` halves it.
export function releaseNoise(power, calm, n1, n2) {
  const k = calm ? 0.5 : 1;
  return { dAng: n1 * (0.0022 + 0.0085 * power * power) * k, dPow: n2 * (0.01 + 0.03 * power) * k };
}
