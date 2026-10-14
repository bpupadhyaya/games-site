// Bamboo Copter: the physics of one flight. Pure and deterministic (no DOM, no clock). The flight is stepped at a fixed
// 1/60 s by stepFlight(); the game and the planner use the same function, so a hint is always a real simulation.
// Units are SI-like: metres, seconds. Spin is normalised: 1 = the rotor's best spin, a little more is possible from a
// perfect release.
export const G = 9.0;
export const DT = 1 / 60;
export const SESSION_FLIGHTS = 5;
export const LEAN_V = 3.2;        // sideways launch speed at full lean, m/s
export const PUSH_V = 2.6;        // upward push of the hands at full spin, m/s
export const START_H = 1.2;       // release height above the ground, m
export const PERFECT_BONUS = 1.1; // spin multiplier for a release inside the sweet band
export const OVERHEAT = 1.0;      // charge above this is too hot: the grip slips
export const HOLD_HOT = 0.8;      // seconds above OVERHEAT before the grip slips by itself
export const CHARGE_MAX = 1.2;
export const RUB_GAIN = 0.66;     // charge per second at the ideal scrub speed
export const RUB_V_FULL = 900;    // scrub speed (virtual units per second) that gives the full gain
export const RUB_V_SLIP = 3200;   // scrubbing faster than this slips and gives nothing
export const COOL = 0.07;         // charge lost per second while the hands rest
export const LANTERN_R = 3.4;     // collection radius, m
export const LANTERN_PTS = 10;
export const HEIGHT_PTS = 2;      // points per metre of peak height
export const PERFECT_PTS = 15;
export const LAND_PTS = [0, 40, 80, 120];
export const STEER_COST = 0.16;   // spin lost per second of full steering
export const MAX_T = 60;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { let x = Math.imul(n | 0, 0x45d9f3b); x ^= x >>> 16; x = Math.imul(x, 0x45d9f3b); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const smooth = (t) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };

// lift = peak upward acceleration at spin 1 (m/s2), decay = spin lost per second, vt = terminal speed of the bare
// frame, auto = spin regained from descending air, steer = sideways acceleration, grip = how strongly the wind
// carries it (1/s), sweet = the perfect band of the Spin meter, bonus = spin of a perfect release.
export const ROTORS = [
  { id: 0, name: 'Bamboo Dragonfly', lift: 36, decay: 0.216, vt: 4.6, auto: 0.039, steer: 7.0, grip: 0.83, sweet: [0.78, 0.90], blades: 2, wide: 0.20, need: 0,
    col: ['#f2d98a', '#c8953f', '#6e4a18'], how: 'The classic: balanced lift, steady descent, honest steering.' },
  { id: 1, name: 'Paper Whirl', lift: 30, decay: 0.168, vt: 3.2, auto: 0.055, steer: 6.0, grip: 1.50, sweet: [0.72, 0.86], blades: 4, wide: 0.16, need: 0,
    col: ['#ffd7d2', '#e8574c', '#8a1f1a'], how: 'Light and floaty: it hangs in the air, but the wind carries it away.' },
  { id: 2, name: 'Jade Blade', lift: 46.5, decay: 0.272, vt: 5.4, auto: 0.028, steer: 8.0, grip: 0.48, sweet: [0.82, 0.93], blades: 2, wide: 0.15, need: 0,
    col: ['#c8f2d6', '#3fae7c', '#16583c'], how: 'Heavy and strong: a big climb, a quick fall, hardly moved by the wind.' },
  { id: 3, name: 'Feather Tip', lift: 31.5, decay: 0.144, vt: 3.0, auto: 0.066, steer: 9.0, grip: 1.17, sweet: [0.74, 0.88], blades: 3, wide: 0.24, need: 100,
    col: ['#ffffff', '#9ec9f0', '#41729e'], how: 'Wide feathered blades: the slowest fall and the best steering.' },
  { id: 4, name: 'Twin Wing', lift: 39, decay: 0.200, vt: 4.2, auto: 0.041, steer: 6.5, grip: 0.75, sweet: [0.80, 0.91], blades: 4, wide: 0.17, need: 150,
    col: ['#e5d6ff', '#8f6fd6', '#3f2a85'], how: 'Two crossed pairs of blades: steady and forgiving of a late release.' },
  { id: 5, name: 'Crimson Maple', lift: 42, decay: 0.176, vt: 3.8, auto: 0.050, steer: 8.0, grip: 0.93, sweet: [0.86, 0.93], blades: 1, wide: 0.30, need: 200,
    col: ['#ffd5a0', '#e0502e', '#7a1c10'], bonus: 1.15, how: 'A single broad wing like a maple seed: a narrow sweet band, a great reward.' },
];

// wind = base strength range (m/s), gust = gust amplitude, th = thermal count range, rise = ground character
export const SCENES = [
  { id: 0, name: 'Bamboo Grove', time: 'Dawn', wind: [1.5, 3.8], gust: 0.4, th: [1, 2], kind: 'grove', need: 0, blurb: 'Soft morning air between tall bamboo. A good place to learn.' },
  { id: 1, name: 'Terraced Hills', time: 'Noon', wind: [2.2, 5.0], gust: 0.9, th: [2, 3], kind: 'terrace', need: 90, blurb: 'Sun-warmed slopes make strong thermals; the ground steps up and down.' },
  { id: 2, name: 'Village Roofs', time: 'Dusk', wind: [2.5, 5.8], gust: 1.3, th: [1, 3], kind: 'roofs', need: 140, blurb: 'Low roofs and a gusty evening breeze. Landing on a roof needs care.' },
  { id: 3, name: 'Misty Lake', time: 'Night', wind: [1.0, 4.2], gust: 1.7, th: [0, 2], kind: 'lake', need: 190, blurb: 'Still water under the moon with swirling, unpredictable air.' },
];

export const RANKS = [[0, 'Curious Palms'], [200, 'Steady Hands'], [380, 'Grove Whirler'], [560, 'Wind Reader'], [740, 'Sky Weaver'], [900, 'Master of the Breeze']];
export const rankFor = (total) => { let r = RANKS[0][1]; for (const [n, name] of RANKS) if (total >= n) r = name; return r; };

export const seeded = (a) => {
  let st = a >>> 0;
  const next = () => { st = (st + 0x6d2b79f5) | 0; let t = Math.imul(st ^ (st >>> 15), 1 | st); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next, range: (lo, hi) => lo + next() * (hi - lo), chance: (p) => next() < p, int: (n) => Math.floor(next() * n),
    shuffle(arr) { const o = arr.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; },
  };
};

// ---- the ground -------------------------------------------------------------------------------------------------------------
// Height of the ground (m) at world x for a set of conditions. Smooth enough to draw as one polyline.
export function groundAt(cond, x) {
  const ph = cond.gph, k = SCENES[cond.scene].kind;
  if (k === 'grove') return 1.1 + 0.8 * Math.sin(x * 0.045 + ph) + 0.5 * Math.sin(x * 0.12 + ph * 2.1);
  if (k === 'lake') return 0;
  if (k === 'terrace') {
    const h = 9 + 6.5 * Math.sin(x * 0.019 + ph) + 3.2 * Math.sin(x * 0.047 + ph * 1.7), u = h / 3.4, fl = Math.floor(u);
    return Math.max(0, (fl + smooth((u - fl - 0.72) / 0.28)) * 3.4 - 4);
  }
  // roofs: houses on 20 m cells, 12 m wide with a gabled top, low street between
  const c = Math.floor((x + 1000) / 20), xl = x + 1000 - c * 20, h1 = hash(c * 7 + cond.hseed);
  if (h1 < 0.3 || xl < 3 || xl > 17) return 0.4 + 0.2 * Math.sin(x * 0.3);
  const hh = 3.2 + 4.5 * hash(c * 13 + cond.hseed + 5), t = (xl - 3) / 14;
  return hh + 1.9 * (1 - Math.abs(2 * t - 1));
}

// Wind (m/s, positive = toward +x) at height y and time t: grows with height, with a slow gust.
export function windAt(cond, y, t) {
  const sc = SCENES[cond.scene];
  const hgt = 0.62 + 0.38 * clamp(y / 36, 0, 1.7);
  return cond.wind * hgt + sc.gust * (Math.sin(t * 0.8 + cond.gust) + 0.5 * Math.sin(t * 2.1 + cond.gust * 1.7));
}

export function thermalAt(cond, x, y) {
  let a = 0;
  for (const th of cond.thermals) {
    const dx = (x - th.x) / th.w;
    if (dx > 3 || dx < -3) continue;
    const g = Math.exp(-dx * dx), fade = clamp(1 - y / th.top, 0, 1);
    a += th.k * g * Math.sqrt(fade);
  }
  return a;
}

// Conditions of one flight. Targets and lanterns are placed around where the wind will carry the rotor.
export function makeConditions(sceneIdx, rng) {
  const sc = SCENES[sceneIdx], mag = rng.range(sc.wind[0], sc.wind[1]), dir = rng.chance(0.5) ? 1 : -1;
  const cond = { scene: sceneIdx, wind: Math.round(mag * dir * 10) / 10, dir, gust: rng.next() * 6.28, gph: rng.next() * 6.28, hseed: rng.int(9000), thermals: [], targets: [], lanterns: [] };
  const nth = sc.th[0] + rng.int(sc.th[1] - sc.th[0] + 1);
  for (let i = 0; i < nth; i++) cond.thermals.push({ x: Math.round(dir * rng.range(-5, 85)), w: rng.range(7, 12), k: rng.range(5, 8.5), top: rng.range(48, 80) });
  const place = (d, hw) => {
    let x = Math.round(d);
    if (sc.kind === 'roofs') { x = Math.floor((x + 1000) / 20) * 20 - 1000 + 10; hw = 5.5; }
    return { x, hw: Math.round(hw * 10) / 10 };
  };
  cond.targets.push(place(dir * rng.range(24, 58), 10));
  cond.targets.push(place(dir * rng.range(64, 112), 8));
  cond.targets.push(place(-dir * rng.range(18, 44), 7));
  for (let i = 0; i < cond.targets.length; i++) cond.targets[i].g = groundAt(cond, cond.targets[i].x);
  for (let i = 0; i < 5; i++) {
    const x = Math.round(dir * rng.range(i < 2 ? -8 : 10, i < 2 ? 22 : 110)), y = Math.round(rng.range(9, 38));
    cond.lanterns.push({ x, y: Math.max(y, Math.round(groundAt(cond, x)) + 7), got: false });
  }
  return cond;
}

// ---- the flight --------------------------------------------------------------------------------------------------------------
// plan = { rotor, charge (0..1.2), lean (-1..1) }.  Returns the starting flight state.
export function launch(plan, cond, rng) {
  const ro = ROTORS[plan.rotor], c = clamp(plan.charge, 0, CHARGE_MAX);
  const perfect = c >= ro.sweet[0] && c <= ro.sweet[1];
  const hot = c > OVERHEAT;
  let s = Math.min(c, 1);
  if (perfect) s = Math.min(1.2, (ro.bonus || PERFECT_BONUS) * Math.max(c, 0.9));
  if (hot) s = 0.9;
  const g0 = groundAt(cond, 0);
  const wob = hot ? (rng.next() * 2 - 1) * 2.4 : 0;
  return {
    x: 0, y: g0 + START_H, vx: clamp(plan.lean, -1, 1) * LEAN_V + wob, vy: PUSH_V * Math.min(1, s), s, s0: s, rev: 0, t: 0, peak: START_H, g0, maxX: 0, minX: 0,
    perfect, hot, rotor: plan.rotor, steer: 0, thermalT: 0, got: 0, landed: false, landing: null, tilt: 0, spent: 0,
    got_idx: [],
  };
}

// Advances f by one fixed step with steering input in -1..1.  Mutates f and cond.lanterns[].got via f.got_idx.
export function stepFlight(f, cond, steer, dt = DT) {
  if (f.landed) return f;
  const ro = ROTORS[f.rotor], st = clamp(steer, -1, 1);
  f.steer += (st - f.steer) * Math.min(1, dt * 7);
  const s = f.s, ast = Math.abs(f.steer);
  const cosT = Math.sqrt(1 - (0.5 * f.steer) * (0.5 * f.steer));
  const thr = ro.lift * s * s * cosT;
  const th = thermalAt(cond, f.x, f.y);
  if (th > 0.5) f.thermalT += dt;
  const cd = G / (ro.vt * ro.vt);
  const drag = cd * f.vy * Math.abs(f.vy) * (f.vy < 0 ? 1 : 0.5);
  const ay = -G + thr + th - drag;
  const w = windAt(cond, f.y, f.t);
  const ax = (w - f.vx) * ro.grip + f.steer * ro.steer * (0.25 + 0.75 * Math.min(1, s * 1.2));
  f.vy += ay * dt; f.vx += ax * dt;
  f.x += f.vx * dt; f.y += f.vy * dt;
  // spin: friction in the air, autorotation from descending air, the cost of leaning
  let ds = -ro.decay * s - STEER_COST * ast * s;
  if (f.vy < 0) ds += ro.auto * (-f.vy) * Math.max(0, 1.05 - s);
  f.s = clamp(s + ds * dt, 0, 1.25);
  f.rev += (1.5 + 14 * f.s) * dt * Math.PI * 2 * 0.35;
  f.tilt = f.steer * 0.35;
  f.t += dt;
  if (f.y > f.peak) f.peak = f.y;
  if (f.x > f.maxX) f.maxX = f.x; if (f.x < f.minX) f.minX = f.x;
  for (let i = 0; i < cond.lanterns.length; i++) {
    const l = cond.lanterns[i];
    if (f.got_idx.indexOf(i) >= 0) continue;
    if (Math.abs(l.x - f.x) < LANTERN_R && Math.abs(l.y - f.y) < LANTERN_R) { f.got_idx.push(i); f.got++; f.event = { type: 'lantern', i }; }
  }
  const g = groundAt(cond, f.x);
  if (f.y <= g + 0.25 && f.t > 0.15 && (f.vy < 0.5)) {
    f.y = g + 0.25; f.landed = true; f.vx = 0; f.vy = 0;
    f.landing = landingOf(f, cond);
  } else if (f.t >= MAX_T || Math.abs(f.x) > 600) {
    f.landed = true; f.y = Math.max(g, f.y); f.landing = landingOf(f, cond);
  }
  return f;
}

// Which ring (if any) the rotor came down in: { rank 0..3, target index, dx }.
export function landingOf(f, cond) {
  let best = { rank: 0, idx: -1, dx: 0 };
  cond.targets.forEach((t, i) => {
    const dx = Math.abs(f.x - t.x);
    const rank = dx <= t.hw * 0.2 ? 3 : dx <= t.hw * 0.5 ? 2 : dx <= t.hw ? 1 : 0;
    if (rank > best.rank || (rank === best.rank && rank > 0 && dx < best.dx)) best = { rank, idx: i, dx };
  });
  return best;
}

// Score of a flight (finished or, for a preview, as it stands).
export function scoreOf(f) {
  const height = Math.max(0, Math.round((f.peak - f.g0 - START_H) * HEIGHT_PTS));
  const lanterns = f.got * LANTERN_PTS;
  const landing = f.landed && f.landing ? LAND_PTS[f.landing.rank] : 0;
  const perfect = f.perfect ? PERFECT_PTS : 0;
  return { height, lanterns, landing, perfect, total: height + lanterns + landing + perfect };
}

// ---- the helper hand: steering policy, and the adviser that plans a whole flight ----------------------------------------------
// Steering toward a target x: look ahead by the drift the rotor will have, and lean against it. aim = null = no steering.
export function policy(f, cond, aim) {
  if (aim === null || aim === undefined || f.landed) return 0;
  const lead = f.vx * 1.6;
  const e = aim - (f.x + lead);
  const ro = ROTORS[f.rotor];
  if (f.s < 0.06 && f.y > 8) return 0;
  void ro;
  return clamp(e / 22, -1, 1);
}

export function simulate(plan, cond, aim, rng, keepPath = false) {
  const f = launch(plan, cond, rng);
  const saved = cond.lanterns.map((l) => l.got);
  const path = [];
  let n = 0;
  // the simulation reads no lantern flags of its own: collection is tracked in f.got_idx per flight
  while (!f.landed && n < MAX_T * 60) {
    stepFlight(f, cond, policy(f, cond, aim));
    if (keepPath && n % 6 === 0) path.push({ x: f.x, y: f.y });
    n++;
  }
  cond.lanterns.forEach((l, i) => { l.got = saved[i]; });
  return { f, score: scoreOf(f), path, steps: n };
}

// Tries a grid of rotor, lean, charge and aim for every rotor in the list. Returns the best plan with its mean score.
export function advise(rotors, cond) {
  let best = null;
  const aims = [null, ...cond.targets.map((t) => t.x)];
  const rng = seeded(4242);
  for (const ro of rotors) {
    const leans = [-1, -0.5, 0, 0.5, 1];
    const sw = ro.sweet, mid = (sw[0] + sw[1]) / 2;
    for (const charge of [mid, 0.95]) for (const lean of leans) for (const aim of aims) {
      const plan = { rotor: ro.id, charge, lean };
      const r = simulate(plan, cond, aim, rng);
      if (!best || r.score.total > best.score) best = { rotor: ro, charge, lean, aim, score: r.score.total, parts: r.score, landing: r.f.landing };
    }
  }
  return best;
}

export function adviceWhy(adv, cond) {
  const bits = [];
  const t = adv.aim === null ? null : cond.targets.findIndex((q) => q.x === adv.aim);
  bits.push(`${adv.rotor.name}`);
  bits.push(adv.charge >= adv.rotor.sweet[0] && adv.charge <= adv.rotor.sweet[1] ? 'rub until the gold band' : 'rub to the top of the meter');
  if (Math.abs(adv.lean) > 0.2) bits.push(`lean ${adv.lean > 0 ? 'right' : 'left'}`);
  if (t !== null && t >= 0) bits.push(`steer toward the ${t === 0 ? 'near' : t === 1 ? 'far' : 'upwind'} ring`);
  else bits.push('steer for height and lanterns');
  return bits.join(', ');
}

// Picks `n` distinct rotors for the tray from the owned list, preferring ones not used yet in the session.
export function drawTray(owned, rng, n, used = []) {
  const ids = owned.map((o, i) => (o ? i : -1)).filter((i) => i >= 0);
  const fresh = ids.filter((i) => used.indexOf(i) < 0), rest = ids.filter((i) => used.indexOf(i) >= 0);
  const out = [];
  for (const pool of [rng.shuffle(fresh), rng.shuffle(rest)]) for (const i of pool) if (out.length < n) out.push(i);
  return out;
}
