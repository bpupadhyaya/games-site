// Stone Skipping: the physics of one throw. Pure and deterministic (no DOM, no clock). A throw is computed in one go from
// the player's choices (stone, tilt, spin, power) and the pond's conditions, and returned as a list of flights and skips the
// view then plays back. Units are SI: metres, seconds, degrees where noted.
export const G = 9.81;
export const REL_H = 0.26;       // release height of the side-arm throw, m
export const REL_DOWN = 3;       // release flight angle below horizontal, degrees
export const AOA_BEST = 20;      // best angle between the stone's plate and its flight path, degrees
export const MAX_SKIPS = 70;
export const WINDUP = 0.26;     // seconds from the start of the arm sweep to the release (the playback clock starts at -WINDUP)
export const SPIN_COST = 0.34;   // share of the speed that full spin costs
export const SPIN_CAP = [1.1, 0.4]; // reachable spin = slider * 14 * grip * (1.1 - 0.4 * power)
export const SPIN_MAX = 14;      // revolutions per second at the full spin slider for a grip of 1
export const TILT_MIN = 0, TILT_MAX = 40;
export const PWR_MIN = 8, PWR_MAX = 34; // m/s

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RAD = Math.PI / 180;

// mass kg, radius m, flat = flatness 0..1 (wider window for a good angle), grip = how much spin the fingers give.
export const STONES = [
  { id: 0, name: 'River Slate', m: 0.080, r: 0.040, flat: 0.85, grip: 1.00, need: 0, how: 'A balanced, honest skimmer.', col: ['#a9b2bc', '#626b77', '#2f353d'] },
  { id: 1, name: 'Thin Shale', m: 0.045, r: 0.044, flat: 1.00, grip: 1.12, need: 0, how: 'Light and very flat, but the wind pushes it about.', col: ['#c4b9a4', '#807562', '#41392d'] },
  { id: 2, name: 'Heavy Flint', m: 0.140, r: 0.036, flat: 0.72, grip: 0.82, need: 8, how: 'Carries its speed far, hard to set spinning.', col: ['#8d95a0', '#454c58', '#171b22'] },
  { id: 3, name: 'Round Cobble', m: 0.100, r: 0.043, flat: 0.45, grip: 0.90, need: 0, how: 'A poor skimmer with a narrow window: a challenge.', col: ['#c9b59a', '#917a5a', '#4b3c28'] },
  { id: 4, name: 'Marble Disc', m: 0.065, r: 0.039, flat: 0.96, grip: 1.05, need: 25, how: 'Smooth, flat and well balanced: the best of all.', col: ['#f6f4ec', '#c4bfb0', '#7c786c'] },
  { id: 5, name: 'Tiny Pebble', m: 0.030, r: 0.026, flat: 0.66, grip: 1.25, need: 15, how: 'Spins up easily but slows quickly.', col: ['#d3b7aa', '#95766a', '#523d33'] },
];

// chop = random surface slope per skip (deg), swell = rolling wave slope (deg), lambda = wave length (m), c = wave speed (m/s)
export const PONDS = [
  { id: 0, name: 'Mirror Pond', time: 'Dawn', chop: 0.6, swell: 0, lambda: 8, c: 0, wind: [0.2, 1.2], gust: 0, need: 0, blurb: 'Still water at dawn. The best place to learn.' },
  { id: 1, name: 'Breezy Lake', time: 'Noon', chop: 3.2, swell: 1.2, lambda: 6, c: 1.5, wind: [2, 4.5], gust: 0, need: 10, blurb: 'A steady wind ruffles the surface.' },
  { id: 2, name: 'Rolling Bay', time: 'Sunset', chop: 1.6, swell: 5.5, lambda: 9, c: 2.6, wind: [1.5, 3.5], gust: 0.6, need: 20, blurb: 'Long swells roll in from the sea.' },
  { id: 3, name: 'Moonlit Tarn', time: 'Night', chop: 3.8, swell: 3, lambda: 7, c: 2, wind: [1, 4], gust: 1.4, need: 30, blurb: 'Gusty and dark: read the water by moonlight.' },
];

// Conditions of one throw: wind (m/s, positive = from behind the thrower, i.e. a tailwind) and the wave phase.
export function makeConditions(pondIdx, rng) {
  const p = PONDS[pondIdx];
  const mag = rng.range(p.wind[0], p.wind[1]);
  const wind = rng.chance(0.5) ? mag : -mag;
  return { pond: pondIdx, wind: Math.round(wind * 10) / 10, phase: rng.next() * p.lambda, gustPh: rng.next() * 6.28 };
}

// A harder throw leaves less of the arm for spin: the spin the slider can reach shrinks as power grows.
export const spinOf = (stone, spin01, power01 = 0.5) => clamp(spin01, 0, 1) * SPIN_MAX * stone.grip * (SPIN_CAP[0] - SPIN_CAP[1] * clamp(power01, 0, 1));
export const speedOf = (power01) => PWR_MIN + (PWR_MAX - PWR_MIN) * clamp(power01, 0, 1);
export const tiltOf = (tilt01) => TILT_MIN + (TILT_MAX - TILT_MIN) * clamp(tilt01, 0, 1);

// Computes one throw. p = { stone, tilt: degrees, spin: 0..1, power: 0..1 }; rng is consumed for wobble and chop.
// Returns { flights: [{ t0, z0, y0, vx, vy, dur }], skips: [{ n, t, z, vn, vx, alpha, eta, spinNow, tilt }], sink: { t, z, why },
//           count, dist, dur }.  A flight is a parabola in height and a straight line (with a little air drag) in distance.
export function simulateThrow(p, cond, rng) {
  const st = p.stone, pond = PONDS[cond.pond];
  const speed = speedOf(p.power) * (1 - SPIN_COST * clamp(p.spin, 0, 1)); // putting spin on the stone costs some speed
  let w = spinOf(st, p.spin, p.power), tilt = p.tilt + (rng.next() * 2 - 1) * 6 * p.spin * p.spin; // a hard wrist snap is less exact
  const tilt0 = tilt;
  let z = 0, y = REL_H, vx = speed * Math.cos(REL_DOWN * RAD), vy = -speed * Math.sin(REL_DOWN * RAD), t = 0;
  const flights = [], skips = [];
  let sink = null;
  const drag = 5.5e-4 / st.m;
  for (let n = 0; n <= MAX_SKIPS + 1; n++) {
    const disc = vy * vy + 2 * G * y;
    const dur = Math.max(0.01, (vy + Math.sqrt(disc)) / G);
    const gust = pond.gust ? pond.gust * Math.sin(cond.gustPh + t * 1.7) : 0;
    const rel = vx - (cond.wind + gust);
    const dec = drag * rel * Math.abs(rel);
    const vxEnd = Math.max(0.2, vx - dec * dur);
    flights.push({ t0: t, z0: z, y0: y, vx: (vx + vxEnd) / 2, vy, dur });
    z += ((vx + vxEnd) / 2) * dur; t += dur; vx = vxEnd;
    const vn = -(vy - G * dur);
    const v = Math.hypot(vx, vn);
    if (n >= MAX_SKIPS) { sink = { t, z, why: 'tired' }; break; }
    // the impact: the plate meets the water at tilt + the flight path angle (+ the local surface slope)
    const phi = Math.atan2(vn, vx) / RAD;
    const wcrit = 2 + 0.52 * v;
    const instab = clamp(1 - w / wcrit, 0, 1);
    tilt += instab * 11 * (rng.next() * 2 - 1);
    const slope = pond.chop * (rng.next() * 2 - 1) + (pond.swell ? pond.swell * Math.cos((2 * Math.PI * (z - pond.c * t + cond.phase)) / pond.lambda) : 0);
    const alpha = tilt + phi + slope;
    const width = (5 + 13 * st.flat) / (1 + 0.05 * Math.max(0, v - 10));
    const eta = Math.max(0, 1 - ((alpha - AOA_BEST) / width) ** 2);
    if (alpha > 38) { sink = { t, z, why: 'plunge' }; break; }
    if (eta <= 0.02) { sink = { t, z, why: alpha < AOA_BEST ? 'slide' : 'dig' }; break; }
    const plane = clamp(0.35 + 0.65 * (v / (15 * Math.pow(st.m / 0.08, 0.3))), 0.3, 1.0); // a slow stone cannot plane
    const e = (0.34 + 0.68 * eta * (1 - 0.35 * instab)) * plane;
    const vyn = vn * e;
    const vxn = vx * (1 - (0.010 + 0.075 * (1 - eta)) * Math.sqrt(0.08 / st.m));
    if (vyn < 0.16 || vxn < 3.6) { sink = { t, z, why: 'spent' }; break; }
    skips.push({ n: n + 1, t, z, vn, vx, alpha, eta, spinNow: w, tilt });
    w *= 0.955; vx = vxn; vy = vyn; y = 0;
  }
  return { flights, skips, sink, count: skips.length, dist: z, dur: t, tilt0, spin0: spinOf(st, p.spin, p.power), speed };
}

// Where is the stone at time t? { z, y, f } (y in metres above the water, f = flight index).
export function stoneAt(res, t) {
  const fl = res.flights;
  if (t <= 0) return { z: 0, y: REL_H, f: 0, u: 0 };
  for (let i = 0; i < fl.length; i++) {
    const f = fl[i];
    if (t <= f.t0 + f.dur + 1e-9 || i === fl.length - 1) {
      const u = clamp(t - f.t0, 0, f.dur);
      return { z: f.z0 + f.vx * u, y: Math.max(0, f.y0 + f.vy * u - 0.5 * G * u * u), f: i, u };
    }
  }
  return { z: res.dist, y: 0, f: fl.length - 1, u: 0 };
}

// ---- the adviser (Think hint and Watch & Learn) --------------------------------------------------------------------------
export const seeded = (a) => {
  let st = a >>> 0;
  const next = () => { st = (st + 0x6d2b79f5) | 0; let t = Math.imul(st ^ (st >>> 15), 1 | st); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next, range: (lo, hi) => lo + next() * (hi - lo), chance: (p) => next() < p, int: (n) => Math.floor(next() * n),
    shuffle(arr) { const o = arr.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; },
  };
};
export function expectedSkips(stone, tilt, spin, power, cond) {
  let sum = 0;
  for (let k = 0; k < 4; k++) sum += simulateThrow({ stone, tilt, spin, power }, cond, seeded(777 + k * 131)).count;
  return sum / 4;
}
// Tries a grid of tilt / spin / power for every stone in the list and returns the best by mean skips.
export function advise(stones, cond) {
  let best = null;
  for (const stone of stones) {
    for (let tilt = 4; tilt <= 28; tilt += 2) for (let si = 6; si <= 10; si += 2) for (let pi = 3; pi <= 10; pi += 1) {
      const spin = si / 10, power = pi / 10;
      const score = expectedSkips(stone, tilt, spin, power, cond);
      if (!best || score > best.score + 1e-9) best = { stone, tilt, spin, power, score };
    }
  }
  return best;
}
// A short human reason for a piece of advice.
export function adviceWhy(adv, cond) {
  const pond = PONDS[cond.pond], parts = [];
  parts.push(adv.stone.flat < 0.6 ? `${adv.stone.name} is round, so keep the angle exact` : `${adv.stone.name} skims best of the tray`);
  if (Math.abs(cond.wind) >= 2) parts.push(cond.wind < 0 ? 'a headwind bleeds speed, so throw firm' : 'the tailwind helps carry it');
  if (pond.swell >= 3) parts.push('a swell rolls through, so a steady spin keeps the plate true');
  parts.push(`tilt about ${Math.round(adv.tilt)} degrees`);
  return parts.slice(0, 3).join('; ');
}

// ---- sessions -----------------------------------------------------------------------------------------------------------
export const SESSION_THROWS = 5;
export const TRAY_SIZE = 3;
// A tray of stones for one throw (ids), drawn from the owned stones, never repeating the stones already used.
export function drawTray(owned, rng, n = TRAY_SIZE, exclude = []) {
  const all = owned.map((o, i) => (o ? i : -1)).filter((i) => i >= 0);
  const fresh = all.filter((i) => !exclude.includes(i));
  const src = fresh.length >= n ? fresh : all;
  return rng.shuffle(src).slice(0, Math.min(n, src.length));
}
export const rankFor = (total) => (total >= 80 ? 'Master Skimmer' : total >= 60 ? 'Pond Legend' : total >= 40 ? 'Skimmer' : total >= 22 ? 'Steady Thrower' : total >= 10 ? 'Pebble Tosser' : 'First Steps');
