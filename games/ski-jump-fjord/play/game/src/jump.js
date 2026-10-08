// One ski jump, from the start gate to the judges: the in-run, the take-off, the flight and the landing. Deterministic, no clock, no randomness
// except the numbers handed in (wind gust phases). Used for the player's jump and, with a computer pilot, for every rival's jump.
//   input per tick: { down, pressed, released, sx, sy }   down/pressed/released = the one finger or Space; sx, sy in -1..1 (drag stick; sy up = more angle)
import { groundY, groundAngle, inrunAt, GATES, TABLE_ANGLE } from './hills.js';

export const DT = 1 / 60;
export const G = 9.81;
export const PHYS = { KL: 0.0165, KD: 0.0165 };
const RAD = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const ZONE = 0.42;                // the jump zone opens this many seconds before the lip
export const LAND_EARLY = 0.45;          // a lift or tap up to this long before touch-down counts as the landing
export const LAND_LATE = 0.2;
export const LEVELS = [
  { id: 1, name: 'Village hill', blurb: 'Wide band, light gusts, generous timing.', band: 6.5, gust: 0.55, zone: 1.35, lean: 0.6 },
  { id: 2, name: 'Regional cup', blurb: 'The standard challenge.', band: 4.5, gust: 0.85, zone: 1, lean: 0.85 },
  { id: 3, name: 'World class', blurb: 'Narrow band, strong gusts, tight timing.', band: 3.2, gust: 1.2, zone: 0.78, lean: 1.1 },
];
export const levelById = (id) => LEVELS.find((l) => l.id === id) || LEVELS[1];

// body angle against the airflow: lift and drag coefficients
export function cl(a) {
  const st = 0.82;
  if (a <= st) return 1.15 * Math.sin(1.9 * Math.max(0, a));
  return Math.max(0.15, 1.15 * Math.sin(1.9 * st) * (1 - 3.2 * (a - st)));
}
export const cd = (a) => 0.2 + 0.9 * Math.sin(a) * Math.sin(a);

export function makeWind(rng, hill, level) {
  const head = clamp(rng.range(-1, 1) * hill.windMax * 0.9, -hill.windMax, hill.windMax);
  const cross = rng.range(-1, 1) * hill.windMax * 0.8;
  const ph = () => rng.range(0, 6.28);
  return { head: Math.round(head * 10) / 10, cross: Math.round(cross * 10) / 10, up: Math.round(rng.range(-0.25, 0.25) * 100) / 100, gust: [[95, 1.3, ph()], [60, 2.4, ph()], [35, 4.1, ph()]], gustB: [[70, 1.7, ph()], [42, 3.1, ph()], [24, 5.3, ph()]], lvl: level.id };
}
const gustOf = (arr, t) => arr[0][0] * Math.sin(arr[0][1] * t + arr[0][2]) + arr[1][0] * Math.sin(arr[1][1] * t + arr[1][2]) + arr[2][0] * Math.sin(arr[2][1] * t + arr[2][2]);

// quality of a timing error (seconds, + = late) in 0..1
export function timingQuality(e, scale = 1) {
  const a = Math.abs(e) / scale;
  if (a <= 0.03) return 1;
  if (a <= 0.09) return lerp(1, 0.55, (a - 0.03) / 0.06);
  if (a <= 0.18) return lerp(0.55, 0.25, (a - 0.09) / 0.09);
  if (a <= 0.3) return lerp(0.25, 0, (a - 0.18) / 0.12);
  return 0;
}

export function createJump({ hill, gate, wind, level, rng }) {
  const lv = levelById(level);
  const s0 = hill.lin * (GATES[gate] ?? GATES[1]).skip;
  const j = {
    ph: 'ready', t: 0, readyT: 1.4,
    hill: hill.id, gate, wind, level: lv.id,
    s: s0, v: 0, tuck: 0, tl: 0, zone: false, req: null, jumpE: null,
    q: { take: 0, speed: 0 },
    x: 0, y: 0, vx: 0, vy: 0, z: 0, vz: 0, alpha: 0.66, aV: 0, aCmd: 0.66, beta: 0, bV: 0, band: 0.7, bandHalf: lv.band * RAD,
    air: 0, errA: 0, errB: 0, nErr: 0, inBand: 0,
    hgt: 0, tg: 0, lastEdge: -9, edges: [], events: [], contact: null, land: null, vLip: 0, tLip: 0, pend: false,
    frames: [], fAcc: 0,
    res: null,
  };
  const rngA = rng.range(-1, 1), rngB = rng.range(-1, 1);
  j.sgnA = rngA < 0 ? -1 : 1; j.sgnB = rngB < 0 ? -1 : 1;

  const record = () => {
    j.fAcc += DT;
    if (j.fAcc < 0.049 && j.ph !== 'done') return;
    j.fAcc = 0;
    const r = (x) => Math.round(x * 1000) / 1000;
    if (j.frames.length < 700) j.frames.push([r(j.t), j.ph === 'slide' || j.ph === 'ready' ? 0 : j.ph === 'air' ? 1 : 2, r(j.s), r(j.x), r(j.y), r(j.alpha), r(j.beta), r(j.z), r(j.tuck), r(j.band)]);
  };

  function bandAt(tf, tg) {
    let a = 41 - 15 * ss(0, 1.7, tf);
    a += gustOf(wind.gust, tf + 1.7) * 0.012 * lv.gust;
    if (tg < 1.0) a += 7 * (1 - Math.max(0, tg) / 1.0);
    return a * RAD;
  }
  function estimateTg() {
    // time until the snow, from the height above it and how fast that height is closing
    const g0 = groundY(hill, j.x), h = j.y - g0;
    const closing = -(j.vy + Math.tan(groundAngle(hill, j.x)) * j.vx);
    let t = h / Math.max(1.5, closing);
    for (let i = 0; i < 3; i++) {
      const x2 = j.x + j.vx * t, y2 = j.y + j.vy * t - 0.5 * G * 0.45 * t * t;
      const h2 = y2 - groundY(hill, x2);
      const cl2 = -(j.vy - G * 0.45 * t + Math.tan(groundAngle(hill, x2)) * j.vx);
      t = Math.max(0, t + h2 / Math.max(1.5, cl2) * 0.6 - (h2 > 0 ? 0 : 0));
    }
    return Math.max(0, Math.min(t, 8));
  }

  function applyImpulse(e) {
    const q = timingQuality(e, lv.zone);
    j.q.take = q; j.jumpE = e;
    const dv = 0.9 + 2.9 * q;
    const nx = Math.sin(TABLE_ANGLE), ny = Math.cos(TABLE_ANGLE);
    j.vx += dv * nx; j.vy += dv * ny;
    if (e < -0.09 * lv.zone) { const loss = 0.07 * clamp((-e - 0.09 * lv.zone) / 0.25, 0, 1); j.vx *= 1 - loss; j.vy *= 1 - loss * 0.4; }
    j.aV += j.sgnA * (1 - q) * 32 * RAD; j.bV += j.sgnB * (1 - q) * 14 * RAD;
    j.beta += j.sgnB * (1 - q) * 3 * RAD;
    j.events.push({ type: 'jump', t: j.t, q, e });
  }

  function step(inp) {
    const dt = DT;
    j.t += dt;
    const down = !!inp.down, edge = !!(inp.pressed || inp.released);
    if (edge) { j.lastEdge = j.t; j.edges.push(j.t); if (j.edges.length > 8) j.edges.shift(); }
    j.events = [];
    if (j.ph === 'ready') {
      j.tuck += ((down ? 1 : 0) - j.tuck) * Math.min(1, dt * 3);
      if (j.t >= j.readyT) { j.ph = 'slide'; j.events.push({ type: 'go', t: j.t }); }
      record(); return;
    }
    if (j.ph === 'slide') {
      const target = down ? 1 : 0;
      j.tuck += clamp(target - j.tuck, -3.5 * dt, 2.6 * dt);
      const a = inrunAt(hill, j.s).a;
      const kd = 0.0052 - 0.0026 * j.tuck;
      const acc = G * (Math.sin(a) - 0.028 * Math.cos(a)) - kd * j.v * j.v;
      j.v = Math.max(0, j.v + acc * dt);
      j.s += j.v * dt;
      const rem = hill.lin - j.s;
      j.tl = rem / Math.max(5, j.v);
      j.zone = j.tl <= ZONE * lv.zone;
      if (j.zone && edge && j.req === null) { j.req = j.t; j.events.push({ type: 'req', t: j.t }); }
      if (j.s >= hill.lin) {
        // over the lip
        const over = j.s - hill.lin, tCross = j.t - over / Math.max(5, j.v);
        j.tLip = tCross; j.vLip = j.v;
        j.ph = 'air'; j.air = 0;
        j.x = 0; j.y = 0;
        j.vx = j.v * Math.cos(TABLE_ANGLE); j.vy = -j.v * Math.sin(TABLE_ANGLE);
        j.alpha = 38 * RAD; j.aCmd = j.alpha; j.aV = 0; j.beta = 0; j.bV = 0;
        j.q.speed = j.v;
        j.events.push({ type: 'lip', t: j.t });
        if (j.req !== null) applyImpulse(j.req - tCross); else j.pend = true;
      }
      record(); return;
    }
    if (j.ph === 'air') {
      j.air += dt;
      if (j.pend) {
        if (edge) { j.pend = false; applyImpulse(j.t - j.tLip); }
        else if (j.t - j.tLip > 0.1) { j.pend = false; applyImpulse(0.3); }
      }
      // controls
      const sy = clamp(inp.sy || 0, -1, 1), sx = clamp(inp.sx || 0, -1, 1);
      const want = (30 + sy * 24) * RAD;
      j.aCmd += clamp(want - j.aCmd, -80 * RAD * dt, 80 * RAD * dt);
      const tg = estimateTg(); j.tg = tg;
      j.band = bandAt(j.air, tg);
      const gA = gustOf(wind.gust, j.air) * lv.gust * (0.5 + 0.35 * Math.min(2, Math.abs(wind.cross) + Math.abs(wind.head) * 0.4)) * RAD;
      const gB = gustOf(wind.gustB, j.air) * lv.gust * (0.4 + 0.5 * Math.abs(wind.cross)) * RAD * lv.lean + wind.cross * 4 * RAD * lv.lean;
      // pitch: a spring to the commanded angle, damped, pushed by gusts
      const aAcc = 24 * (j.aCmd - j.alpha) - 7.5 * j.aV + gA;
      j.aV += aAcc * dt; j.alpha += j.aV * dt;
      j.alpha = clamp(j.alpha, 0.05, 1.15);
      // lean: unstable (it falls over by itself), pushed by gusts, held by the drag
      const bAcc = 2.2 * j.beta + gB + 16 * sx - 2.6 * j.bV;
      j.bV += bAcc * dt; j.beta += j.bV * dt;
      j.beta = clamp(j.beta, -0.6, 0.6);
      j.vz += (Math.sin(j.beta) * 3.0 + wind.cross * 0.04) * dt; j.vz *= 1 - 0.4 * dt; j.z += j.vz * dt;
      // air
      const dev = clamp(Math.abs(j.alpha - j.band) / (8 * RAD), 0, 1), dev2 = dev * dev;
      const lean = clamp(Math.abs(j.beta) / 0.5, 0, 1);
      const eff = (1 - 0.34 * dev2) * (1 - 0.14 * lean);
      const dr = (1 + 0.7 * dev2) * (1 + 0.3 * lean);
      const rx = j.vx + wind.head, ry = j.vy - wind.up;
      const vr = Math.hypot(rx, ry) || 1;
      const fx = rx / vr, fy = ry / vr;
      const L = hill.kl * cl(j.alpha) * eff * vr * vr, D = PHYS.KD * cd(j.alpha) * dr * vr * vr;
      j.vx += (-D * fx - L * fy) * dt;
      j.vy += (-D * fy + L * fx - G) * dt;
      const px = j.x, py = j.y;
      j.x += j.vx * dt; j.y += j.vy * dt;
      // judge-style bookkeeping
      const eA = clamp((Math.abs(j.alpha - j.band) - j.bandHalf * 0.5) / (12 * RAD), 0, 1), eB = clamp((Math.abs(j.beta) - 0.03) / 0.22, 0, 1);
      j.errA += eA; j.errB += eB; j.nErr++;
      if (Math.abs(j.alpha - j.band) <= j.bandHalf) j.inBand++;
      // snow
      const gnd = groundY(hill, j.x);
      j.hgt = j.y - gnd;
      if (j.hgt <= 0 && j.air > 0.25) {
        const k = clamp((py - groundY(hill, px)) / Math.max(1e-6, (py - groundY(hill, px)) - j.hgt), 0, 1);
        const cx = lerp(px, j.x, k);
        const th = groundAngle(hill, cx);
        const vn = -(j.vx * Math.sin(th) + j.vy * Math.cos(th));
        j.contact = { t: j.t - dt * (1 - k), x: cx, y: groundY(hill, cx), vn, th, speed: Math.hypot(j.vx, j.vy) };
        j.x = cx; j.y = j.contact.y;
        j.ph = 'land';
        j.events.push({ type: 'touch', t: j.t });
      }
      record(); return;
    }
    if (j.ph === 'land') {
      const c = j.contact;
      if (j.land === null) {
        const late = j.t - c.t;
        if ((edge && late >= 0) || late >= LAND_LATE) {
          let best = null;
          for (const te of j.edges) { const e = te - c.t; if (e >= -LAND_EARLY && e <= LAND_LATE && (best === null || Math.abs(e) < Math.abs(best))) best = e; }
          j.land = { e: best === null ? 0.5 : best };
          j.events.push({ type: 'landed', t: j.t });
          finish();
        }
      }
      // slide out on the snow
      j.vx *= 1 - 0.55 * dt; j.x += j.vx * dt; j.y = groundY(hill, j.x); j.z += j.vz * dt;
      if (j.res !== null) j.ph = 'done';
      record(); return;
    }
    if (j.ph === 'done') {
      j.vx *= 1 - 1.4 * dt; j.x += j.vx * dt; j.y = groundY(hill, j.x);
      j.done = (j.done || 0) + dt;
    }
  }

  function finish() {
    const c = j.contact, e = j.land.e;
    const ql = timingQuality(e, 0.9 + 0.1 * lv.zone);
    const n = Math.max(1, j.nErr);
    const flightErr = 0.65 * (j.errA / n) + 0.35 * (j.errB / n);
    const qFlight = clamp(1 - flightErr * 1.15, 0, 1);
    const hard = c.vn;
    const dist = Math.round(c.x * 1.06 * 2) / 2;
    const over = dist > hill.k * 1.4;
    let kind = 'telemark';
    if (ql >= 0.82) kind = 'telemark';
    else if (ql >= 0.4) kind = 'clean';
    else kind = 'rough';
    let fall = false;
    if (hard > 6.4 && ql < 0.7) fall = true;
    if (hard > 9.5 && ql < 0.95) fall = true;
    if (c.x > hill.k * 1.28 && ql < 0.9) fall = true;
    if (ql < 0.08 && hard > 5) fall = true;
    if (fall) kind = 'fall';
    // each judge, 0..20 in halves
    j.res = { dist, kind, ql, qTake: j.q.take, qFlight, hard, fall, e, over, speed: c.speed, x: c.x, flightErr, inBand: j.inBand / n };
  }

  return { j, step, hill, lv };
}

// The five judges: marks from the quality of the take-off, the flight and the landing, each judge seeing it slightly differently.
export function judgeMarks(res, rng) {
  let base = 19.2 - (1 - res.qTake) * 1.4 - (1 - res.qFlight) * 5.2;
  if (res.kind === 'telemark') base -= (1 - res.ql) * 0.6; else if (res.kind === 'clean') base -= 1.2 + (0.82 - res.ql) * 2.2; else if (res.kind === 'rough') base -= 3.0; else base -= 7.5 + (res.hard > 9 ? 1.5 : 0);
  base = clamp(base, 4, 20);
  const marks = [];
  for (let i = 0; i < 5; i++) marks.push(clamp(Math.round((base + rng.range(-0.55, 0.55)) * 2) / 2, 3, 20));
  const sorted = marks.map((m, i) => ({ m, i })).sort((a, b) => a.m - b.m || a.i - b.i);
  const drop = { lo: sorted[0].i, hi: sorted[4].i };
  const sum = sorted.slice(1, 4).reduce((a, b) => a + b.m, 0);
  return { marks, drop, sum };
}

export function scoreJump(hill, res, marks, wind, gate) {
  const distPts = Math.round((60 + (res.dist - hill.k) * hill.ptsPerM) * 10) / 10;
  const windPts = Math.round(-wind.head * (hill.k >= 150 ? 6 : hill.k / 24) * 10) / 10 * 1;
  const gatePts = Math.round((1 - gate) * 0 * 10) / 10 + [0, 0, 0][gate];
  const total = Math.max(0, Math.round((distPts + marks.sum + windPts + (gate === 2 ? -4.2 : gate === 0 ? 4.2 : 0)) * 10) / 10);
  return { distPts, windPts, gatePts: gate === 2 ? -4.2 : gate === 0 ? 4.2 : 0, style: marks.sum, total };
}
