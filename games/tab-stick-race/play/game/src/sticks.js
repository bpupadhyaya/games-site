// The four throwing sticks: a deterministic rigid-body style throw.
//
// The result (which sticks land flat side up) is decided first from the game's rng, so the odds are exactly 1 in 2 per stick. The
// motion is then a closed-form function of time, so it can be sampled at any moment (the display interpolates between two fixed
// steps): each stick is released from a hand at the near edge, flies up and over under gravity, bounces on the felt with a restitution
// of about 0.4 (each bounce also takes about half the sliding speed), rolls about its long axis with a steadily falling spin, turns a
// little about the vertical, and finally rocks to rest on its round back (flat side up) or lies on its flat side (round side up).
// Positions are in mat units: x and y from 0 to 1 across the mat, z is height above the felt (0 = on the felt).
const G = 9;
const TAU = Math.PI * 2;
const REST_TAIL = 0.14;           // seconds of sliding after the last bounce
const ROCK_T = 0.7;               // seconds of rocking after coming to rest

export function planThrow(flats, rng) {
  const sticks = flats.map((flat, i) => {
    const z0 = 0.72 + rng.next() * 0.18, vz0 = 1.9 + rng.next() * 0.5, e = 0.36 + rng.next() * 0.1;
    // flights: [{ t0, t1, z0, vz }]
    const flights = []; let t = 0, z = z0, vz = vz0;
    for (let k = 0; k < 6; k++) {
      const d = (vz + Math.sqrt(vz * vz + 2 * G * z)) / G;      // time until the felt is reached
      flights.push({ t0: t, t1: t + d, z0: z, vz, speed: 0.5 ** k });
      const vin = vz - G * d;
      t += d; z = 0; vz = -vin * e;
      if (vz < 0.3) break;
    }
    const tEnd = t;
    const lastSpeed = flights[flights.length - 1].speed * 0.5;
    // normalised sliding progress: integral of the sliding speed over time
    let W = 0; for (const f of flights) W += f.speed * (f.t1 - f.t0);
    W += lastSpeed * REST_TAIL;
    const lane = 0.5 + (i - 1.5) * 0.22 + (rng.next() - 0.5) * 0.03;
    const x1 = lane, y1 = 0.5 + (rng.next() - 0.5) * 0.1;
    const x0 = 0.5 + (i - 1.5) * 0.035, y0 = 1.02;
    const phiRest = flat ? Math.PI : 0;
    const phi0 = rng.next() * TAU;
    const base = (((phiRest - phi0) % TAU) + TAU) % TAU;
    const roll = base + TAU * (2 + (rng.next() < 0.5 ? 0 : 1));
    const yaw1 = (i % 2 === 0 ? -1 : 1) * (0.05 + rng.next() * 0.17);
    const yaw0 = (rng.next() - 0.5) * 1.6;
    return { flat, flights, tEnd, W, lastSpeed, x0, y0, x1, y1, phi0, roll, yaw0, yaw1, rockA: flat ? 0.3 + rng.next() * 0.08 : 0.07, rockW: 13 + rng.next() * 3 };
  });
  const dur = Math.max(...sticks.map((s) => s.tEnd)) + ROCK_T;
  return { sticks, dur, flats: flats.slice() };
}

// Sliding progress 0..1 at time t.
function progress(s, t) {
  let w = 0;
  for (const f of s.flights) {
    if (t <= f.t0) break;
    w += f.speed * (Math.min(t, f.t1) - f.t0);
  }
  if (t > s.tEnd) w += s.lastSpeed * REST_TAIL * (1 - Math.exp(-(t - s.tEnd) / (REST_TAIL * 0.5)));
  return Math.min(1, w / s.W);
}
// Horizontal speed (progress per second) for measuring.
function progressSpeed(s, t) {
  for (const f of s.flights) if (t >= f.t0 && t < f.t1) return f.speed / s.W;
  if (t >= s.tEnd) return (s.lastSpeed / s.W) * Math.exp(-(t - s.tEnd) / (REST_TAIL * 0.5));
  return 0;
}

export function stickPose(plan, i, t) {
  const s = plan.sticks[i];
  const tt = Math.max(0, t);
  const p = progress(s, tt);
  let z = 0;
  for (const f of s.flights) if (tt >= f.t0 && tt < f.t1) { const u = tt - f.t0; z = Math.max(0, f.z0 + f.vz * u - 0.5 * G * u * u); break; }
  const Tr = s.tEnd + 0.06;
  const r = Math.min(1, tt / Tr), er = 1 - (1 - r) * (1 - r);
  let roll = s.phi0 + s.roll * er;
  if (tt > s.tEnd) { const u = tt - s.tEnd; roll += s.rockA * Math.exp(-6.5 * u) * Math.sin(s.rockW * u); }
  const ry = Math.min(1, tt / s.tEnd), ey = 1 - (1 - ry) ** 2.4;
  return { x: s.x0 + (s.x1 - s.x0) * p, y: s.y0 + (s.y1 - s.y0) * p, z, yaw: s.yaw0 + (s.yaw1 - s.yaw0) * ey, roll, speed: progressSpeed(s, tt) };
}

// Times at which stick i touches the felt (for sound), and the settle time.
export const impactTimes = (plan, i) => plan.sticks[i].flights.map((f) => f.t1);
export const throwFlats = (plan) => plan.flats.slice();
export const restPose = (flats, i) => ({ x: 0.5 + (i - 1.5) * 0.22, y: 0.5, z: 0, yaw: (i % 2 === 0 ? -1 : 1) * 0.1, roll: flats[i] ? Math.PI : 0, speed: 0 });
