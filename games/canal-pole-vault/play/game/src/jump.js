// The jump itself: run-up rhythm, plant timing, the pole as a swinging inverted pendulum with a climber on it, the let-go and the landing.
// Pure and deterministic: fixed 1/60 s steps, randomness only from the rng handed in. Coordinates: x across the canal from the near-bank
// board (x = 0) towards the sand bed, y up from the water surface. The pole is planted on the canal bed at (xb, -depth).
import { STANDS } from './venues.js';

export const DT = 1 / 60;
const G = 9.81;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

export const LEVELS = [
  { id: 1, name: 'Village meet', blurb: 'Wide timing, a guide flag, calm air', beat: 0.15, plant: 1.15, vmax: 8.4, gust: 0.4, guide: true, rival: -0.08, kt: 1.12 },
  { id: 2, name: 'Provincial cup', blurb: 'The standard challenge', beat: 0.12, plant: 0.9, vmax: 8.2, gust: 1.0, guide: true, rival: 0, kt: 1.0 },
  { id: 3, name: 'Championship', blurb: 'Tight timing, gusts, no guide flag', beat: 0.1, plant: 0.7, vmax: 8.0, gust: 1.7, guide: false, rival: 0.06, kt: 0.96 },
];
export const levelById = (id) => LEVELS.find((l) => l.id === id) || LEVELS[1];

// run-up
export const BEAT = 0.46;                       // seconds between footfalls the thumb has to follow
export const RUNUP = 24;                        // metres from the start mark to the board
export const X_IDEAL = -0.35;                   // best take-off position (m before the board)
export const ZONE_LEN = 3.4;                    // metres before the ideal take-off where the plant zone opens
export const GRIP_STAMINA = 1;

// lean choices at the let-go: index 0..4 (back and high ... forward and flat)
export const LEANS = [
  { id: 0, name: 'High', phi: 44, reach: 0.0 },
  { id: 1, name: 'Up', phi: 34, reach: 0.25 },
  { id: 2, name: 'Mid', phi: 24, reach: 0.5 },
  { id: 3, name: 'Long', phi: 14, reach: 0.75 },
  { id: 4, name: 'Flat', phi: 4, reach: 1.0 },
];
const PUSH = 3.0;                               // m/s of push-off from the pole
const KT = 0.26;                                // share of the run speed the heavy pole accepts as swing

export function makeWind(rng, venue, lvl) {
  const head = rng.range(-1.0, 1.4) * lvl.gust, cross = rng.range(-1.6, 1.6) * lvl.gust;
  return { head: Math.round(head * 10) / 10, cross: Math.round(cross * 10) / 10 };
}

// ballistic flight from (x, y) with velocity (vx, vy) to the canal / the sand. Returns { x, y, t, water, vy }.
function fly(venue, x, y, vx, vy, wind, reach) {
  let t = 0;
  const ax = -wind.head * 0.12;                 // a head wind slows the flight a little
  for (let i = 0; i < 1200; i++) {
    const h = 1 / 120;
    vy -= G * h; vx += ax * h; x += vx * h; y += vy * h; t += h;
    const xf = x + reach * 0;                    // feet position is handled below
    const gy = groundAt(venue, xf + reach * 0.0);
    if (y <= gy + 0.9 && vy < 0) {
      // the feet touch when the hips are 0.9 m above the ground (legs reaching forward by `reach`)
      const xFeet = x + reach;
      const g2 = groundAt(venue, xFeet);
      if (y <= g2 + 0.9) return { x: xFeet, y: g2, t, water: g2 <= 0.001, vy, vx };
    }
  }
  return { x, y: 0, t, water: true, vy, vx };
}

// how hard the touch-down is: a fast drop with the legs thrown far forward is a rough landing (half a metre is lost)
function landKind(hard, lean) { return hard > 9.2 && lean >= 3 ? 'rough' : hard > 10.6 ? 'rough' : 'clean'; }

export function groundAt(venue, x) {
  if (x < venue.W - 0.001) return 0;             // water
  return Math.min(venue.sandH, 0.15 + (x - venue.W) * 0.5);   // the sand bed rises gently out of the water
}

export function createJump({ venue, wind, level, rng, stand = 1 }) {
  const lvl = levelById(level);
  const st = STANDS[stand] || STANDS[1];
  const V = { ...venue, xb: venue.xb + st.dx, lean0: st.lean0 };
  const r0 = rng.fork();
  const j = {
    ph: 'ready', t: 0, tl: 0, venue: V.id, stand: st.id,
    x: -RUNUP, v: 0, vt: 0, nb: 0, tb: 0, taps: [], perfect: 0, stumbles: 0, topV: 0,
    boardIn: 99, zoneT: 0, inZone: false,                                 // seconds until the runner passes the board
    xL: 0, eps: 0, eta: 0, hg: 0,
    theta: 0, omega: 0, r: 0, rdot: 0, rmax: V.L - 0.5, stam: 1, climbing: false, bend: 0, tPole: 0,
    lean: 2, px: 0, py: 0, vx: 0, vy: 0, air: 0, y: 0.9,
    pred: null, wind, level, res: null, events: [], frames: [], contact: null, fall: false,
  };
  let evN = 0;
  const emit = (e) => { j.events.push({ n: ++evN, t: j.t, ...e }); if (j.events.length > 24) j.events.shift(); };
  const frames = j.frames;

  // position of the climber on the pole
  const poleXY = () => ({ x: V.xb + j.r * Math.sin(j.theta), y: -V.depth + j.r * Math.cos(j.theta) });

  // the release state for a given lean: where the climber leaves, with what velocity
  function releaseState(leanIdx) {
    const p = poleXY();
    const th = j.theta, om = j.omega;
    const vxp = j.rdot * Math.sin(th) + j.r * om * Math.cos(th);
    const vyp = j.rdot * Math.cos(th) - j.r * om * Math.sin(th);
    const ln = LEANS[clamp(leanIdx | 0, 0, 4)];
    const phi = ln.phi * Math.PI / 180;
    return { x: p.x, y: p.y, vx: vxp + PUSH * Math.cos(phi), vy: vyp + PUSH * Math.sin(phi), reach: ln.reach };
  }
  // a forecast of where a let-go right now with this lean would touch down (only a guide; the sim result is the real one)
  function predict(leanIdx) {
    const s = releaseState(leanIdx);
    const f = fly(V, s.x, s.y, s.vx, s.vy, j.wind, s.reach);
    const kind = f.water ? 'splash' : landKind(-f.vy, clamp(leanIdx | 0, 0, 4));
    return { x: f.x - (kind === 'rough' ? 0.5 : 0), water: f.water, t: f.t, kind };
  }

  // ---- one pole step -----------------------------------------------------------------------------------------------
  // The physics of the swing in one pure function so the game and the forecast use exactly the same step.
  // s = { theta, omega, r, stam }; climb = whether the thumb is holding; returns the climb speed used.
  function stepPole(s, climb, dt) {
    const want = climb && s.r < j.rmax - 0.001;
    const going = want && s.stam > 0.02;
    const vcl = 2.1 * (0.3 + 0.7 * sstep(s.stam / 0.35));
    const rdot = going ? vcl : 0;
    s.stam = going ? Math.max(0, s.stam - 0.19 * dt) : Math.min(1, s.stam + 0.3 * dt);
    s.r = Math.min(j.rmax, s.r + rdot * dt);
    // a mass on a rod whose length changes as the climber climbs: the Coriolis term keeps the angular momentum
    const d = 0.35;                                   // the body hangs this far in front of the pole axis
    const th = s.theta, rr = s.r, I = rr * rr + d * d;
    const windTorque = -j.wind.head * 0.045 * Math.cos(th) * (rr / 10);
    const acc = (G * (rr * Math.sin(th) + d * Math.cos(th)) - 2 * rr * rdot * s.omega) / I - 0.06 * s.omega + windTorque;
    s.omega += acc * dt;
    s.theta += s.omega * dt;
    s.rdot = rdot; s.going = going;
    return rdot;
  }
  function poleStep(dt, inp) {
    const s = { theta: j.theta, omega: j.omega, r: j.r, stam: j.stam };
    stepPole(s, !!inp.down, dt);
    j.theta = s.theta; j.omega = s.omega; j.r = s.r; j.stam = s.stam; j.rdot = s.rdot; j.climbing = s.going;
    j.bend = clamp(Math.abs(j.omega) * j.r * 0.01 + j.r * 0.004, 0, 0.5);
  }
  // Forecast: if the thumb climbs from now on, does the pole still go over the upright, and when? (a guide only)
  function forecastClimb() {
    const s = { theta: j.theta, omega: j.omega, r: j.r, stam: j.stam };
    for (let i = 0; i < 480; i++) {
      stepPole(s, true, 1 / 60);
      if (s.theta > 0.04) return { ok: true, t: i / 60 };
      if (s.omega <= 0.003 && s.theta < -0.02) return { ok: false, t: i / 60 };
    }
    return { ok: false, t: 8 };
  }

  // The best moment to let go if the climber keeps climbing from the upright on: a short numeric look-ahead of the same physics.
  // Returns { t, lean, x, kind } (t = seconds from now) or null when the pole is going to stall.
  function bestRelease() {
    const s = { theta: j.theta, omega: j.omega, r: j.r, stam: j.stam };
    let best = null;
    for (let i = 0; i < 420; i++) {
      stepPole(s, s.theta >= -0.12, 1 / 60);
      if (s.omega <= 0 && s.theta < -0.02) return best;
      if (s.theta >= V.thetaEnd) break;
      if (i % 4 !== 3 || s.theta < 0.25) continue;
      const px = V.xb + s.r * Math.sin(s.theta), py = -V.depth + s.r * Math.cos(s.theta);
      const vxp = s.rdot * Math.sin(s.theta) + s.r * s.omega * Math.cos(s.theta), vyp = s.rdot * Math.cos(s.theta) - s.r * s.omega * Math.sin(s.theta);
      for (let l = 0; l < 5; l++) {
        const ln = LEANS[l], phi = ln.phi * Math.PI / 180;
        const f = fly(V, px, py, vxp + PUSH * Math.cos(phi), vyp + PUSH * Math.sin(phi), j.wind, ln.reach);
        const kind = f.water ? 'splash' : landKind(-f.vy, l);
        const x = f.x - (kind === 'rough' ? 0.5 : 0) - (f.water ? 30 : 0);
        if (!best || x > best.x) best = { t: (i + 1) / 60, lean: l, x: f.water ? f.x : x, kind, theta: s.theta, score: x };
      }
    }
    return best;
  }

  function beginLeap(xL) {
    j.xL = xL; j.eps = xL - X_IDEAL;
    const e = Math.abs(j.eps);
    // transfer efficiency: 1 inside the plant window, falling to ~0.45 at the edge, 0.25 beyond
    const w = lvl.plant;
    j.eta = e <= w * 0.35 ? 1 : clamp(1 - 0.55 * ((e - w * 0.35) / (w * 0.65)), 0.25, 1);
    j.hg = clamp(3.1 + 1.5 * j.eps, 1.4, 5.0);
    j.ph = 'leap'; j.tl = 0; j.leapT = clamp((V.xb - V.lean0 * 3 - xL) / Math.max(4, j.v * 0.9), 0.32, 0.9);
    j.short = j.eps < -2.4;                      // a leap far too early drops into the water short of the pole
    emit({ type: 'plant', eps: j.eps, eta: j.eta, hg: j.hg });
  }

  function shortFall() {
    j.ph = 'land'; j.tl = 0; j.fall = true; j.px = j.x; j.py = 0;
    j.contact = { t: j.t, x: j.x, vy: -4, vx: j.v, water: true };
    j.res = { kind: 'short', dist: 0, rawDist: 0, fall: true, hard: 4, lean: j.lean, eta: j.eta, eps: j.eps, theta: 0, topV: j.topV, stam: 1 };
    emit({ type: 'touch', kind: 'short', dist: 0, water: true });
  }

  function beginPole() {
    // the pole stands in the water leaning back towards the bank; the climber catches it at height hg
    const lean0 = -V.lean0;
    const rg = (j.hg + V.depth) / Math.cos(lean0);
    j.theta = lean0; j.r = rg;
    // horizontal run speed becomes angular speed about the base
    j.omega = j.eta * (j.v * KT * lvl.kt) * Math.cos(lean0) / rg;
    j.rdot = 0; j.ph = 'pole'; j.tPole = 0; j.stam = 1;
    emit({ type: 'grab', v: j.v, omega: j.omega });
  }

  function doRelease(leanIdx, forced) {
    const s = releaseState(leanIdx);
    j.lean = clamp(leanIdx | 0, 0, 4);
    j.px = s.x; j.py = s.y; j.vx = s.vx; j.vy = s.vy; j.reach = s.reach;
    j.ph = 'air'; j.air = 0; j.forced = !!forced;
    emit({ type: 'letgo', lean: j.lean, theta: j.theta, forced: !!forced, speed: Math.hypot(s.vx, s.vy) });
  }

  function airStep(dt) {
    j.air += dt;
    const ax = -j.wind.head * 0.12;
    j.vy -= G * dt; j.vx += ax * dt; j.px += j.vx * dt; j.py += j.vy * dt;
    const xFeet = j.px + j.reach, gy = groundAt(V, xFeet);
    if (j.py <= gy + 0.9 && j.vy < 0) {
      const wet = gy <= 0.001;
      j.contact = { t: j.t, x: xFeet, vy: j.vy, vx: j.vx, water: wet };
      j.ph = 'land'; j.tl = 0;
      const dist = Math.round(xFeet * 100) / 100;
      const hard = -j.vy;
      const kind = wet ? 'splash' : landKind(hard, j.lean);
      j.res = { kind, dist: wet ? 0 : Math.round((dist - (kind === 'rough' ? 0.5 : 0)) * 100) / 100, rawDist: dist, fall: wet, hard, lean: j.lean, eta: j.eta, eps: j.eps, theta: j.theta, forced: !!j.forced, topV: j.topV, stam: j.stam };
      emit({ type: 'touch', kind, dist: j.res.dist, water: wet });
    }
  }

  function record() {
    if (j.ph === 'ready') return;
    if (j.ph === 'run' || j.ph === 'leap') { frames.push([j.t, 0, j.x, 0, j.v, 0, 0, 0, 0]); }
    else if (j.ph === 'pole') { frames.push([j.t, 1, j.theta, j.r, j.omega, j.climbing ? 1 : 0, j.stam, j.bend, 0]); }
    else if (j.ph === 'air' || j.ph === 'land') { frames.push([j.t, j.ph === 'air' ? 2 : 3, j.px, j.py, j.vx, j.vy, j.lean, 0, 0]); }
    if (frames.length > 2400) frames.splice(0, 600);
  }

  function step(inp) {
    const dt = DT;
    j.t += dt;
    if (j.ph === 'ready') {
      // the first tap starts the run; the rhythm begins half a beat later
      if (inp.pressed || inp.go) { j.ph = 'run'; j.tb = BEAT * 1.1; j.nb = 0; j.vt = 1.6; j.v = 0.8; emit({ type: 'go' }); }
      record(); return;
    }
    if (j.ph === 'run') {
      const inZone = j.x >= X_IDEAL - ZONE_LEN;
      j.inZone = inZone;
      if (inZone) j.zoneT += dt;
      if (!inZone) {
        // beats: a tap inside the window of a beat scores it; a beat with no tap is a stumble
        j.tb -= dt;
        const win = lvl.beat;
        if (inp.pressed) {
          const e = j.tb;                            // > 0: early, < 0: late (distance to the beat)
          if (Math.abs(e) <= win + 0.04) {
            const q = clamp(1 - (Math.abs(e) / win), 0, 1);
            j.vt = Math.min(lvl.vmax, j.vt + 0.2 + 0.62 * q);
            j.taps.push(+e.toFixed(3));
            if (q > 0.7) j.perfect++;
            emit({ type: 'step', q, e });
            j.nb++; j.tb += BEAT;                    // the beat clock never moves on a tap
          } else { j.vt = Math.max(1.2, j.vt - 0.25); emit({ type: 'offbeat', e }); }
        }
        if (j.tb < -win - 0.04) {                    // the window closed with no tap
          j.vt = Math.max(1.2, j.vt - 0.7); j.stumbles++; j.nb++; j.tb += BEAT; emit({ type: 'miss' });
        }
      }
      j.v += (j.vt - j.v) * Math.min(1, dt * 3.4);
      j.x += j.v * dt;
      j.topV = Math.max(j.topV, j.v);
      j.boardIn = j.v > 0.5 ? Math.max(0, (X_IDEAL - j.x) / j.v) : 99;
      if (inZone && inp.pressed && j.zoneT > 0.14) beginLeap(j.x);
      else if (j.x >= X_IDEAL + 1.6 || j.t > 60) { emit({ type: 'late' }); beginLeap(Math.max(j.x, X_IDEAL + 1.6)); }   // ran past the board
      record(); return;
    }
    if (j.ph === 'leap') {
      j.tl += dt;
      j.x += j.v * dt * 0.85;
      if (j.tl >= j.leapT) { if (j.short) shortFall(); else beginPole(); }
      record(); return;
    }
    if (j.ph === 'pole') {
      j.tPole += dt;
      const n = 4;
      for (let i = 0; i < n; i++) poleStep(dt / n, inp);
      j.pred = predict(inp.lean !== undefined ? inp.lean : j.lean);
      j.safe = j.theta > 0.04 ? { ok: true, t: 0 } : forecastClimb();
      // a fall backwards: the pole never gets past the upright and swings the climber back into the water
      if (j.theta < -0.6 && j.omega < 0) {
        j.ph = 'land'; j.tl = 0; j.fall = true; j.px = poleXY().x; j.py = 0;
        j.contact = { t: j.t, x: V.xb + j.r * Math.sin(j.theta), vy: -3, vx: 0, water: true };
        j.res = { kind: 'stall', dist: 0, rawDist: 0, fall: true, hard: 3, lean: j.lean, eta: j.eta, eps: j.eps, theta: j.theta, topV: j.topV, stam: j.stam };
        emit({ type: 'touch', kind: 'stall', dist: 0, water: true });
      } else if (inp.letgo !== undefined) {
        doRelease(inp.letgo, false);
      } else if (j.theta >= V.thetaEnd || poleXY().y < 1.2 && j.theta > 0.5) {
        doRelease(inp.lean !== undefined ? inp.lean : j.lean, true);   // the pole has swung as far as it goes
      }
      record(); return;
    }
    if (j.ph === 'air') { airStep(dt); record(); return; }
    if (j.ph === 'land') {
      j.tl += dt;
      if (j.tl > 1.6) { j.ph = 'done'; emit({ type: 'done' }); }
      record(); return;
    }
  }

  void r0; void lerp;
  return { j, step, predict, forecastClimb, bestRelease, venue: V };
}
