// A computer jumper that drives the same inputs a finger would: used for every rival, for Watch & Learn and for the store screenshots.
// skill 0..1: higher = steadier hands and tighter timing. All randomness comes from the rng handed in.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const RAD = Math.PI / 180;

export function createPilot(rng, skill = 0.85) {
  const e = rng.fork();
  const gauss = () => (e.next() + e.next() + e.next() - 1.5) * 1.4;
  const sd = (1 - skill) * 0.09 + 0.008;                      // seconds of timing error
  let released = false, planTake = null, planLand = null, noiseA = 0, noiseB = 0, prevAlphaCmd = 30, wasDown = false;
  return function pilot(j) {
    const out = { down: false, pressed: false, released: false, sx: 0, sy: 0 };
    if (j.ph === 'ready' || j.ph === 'slide') {
      out.down = true;
      if (planTake === null) planTake = gauss() * sd;
      if (j.ph === 'slide' && j.zone && planTake <= 0 && j.tl <= -planTake) { out.down = false; out.released = true; return out; }
      return out;
    }
    if (j.ph === 'air') {
      out.down = !released && !j.pend;
      if (j.pend && j.t - j.tLip >= planTake) { out.down = false; out.released = true; }
      // reading the gauge is not perfect: the error drifts slowly
      noiseA = noiseA * 0.97 + gauss() * (1 - skill) * 16 * RAD * 0.17;
      noiseB = noiseB * 0.97 + gauss() * (1 - skill) * 0.12 * 0.17;
      const target = j.band + noiseA - 0.6 * RAD * (1 - skill);
      const sy = clamp(((target / RAD) - 30) / 24, -1, 1);
      out.sy = sy;
      // lean: push against the roll and its speed
      out.sx = clamp(-(0.55 * (j.beta + noiseB) / 0.12 + 0.2 * j.bV / 0.6), -1, 1);
      if (planLand === null) planLand = gauss() * sd * 1.2;
      if (!released && j.tg <= 0.05 + planLand + 0.02 && j.air > 0.8) { released = true; out.down = false; out.released = true; }
      return out;
    }
    return out;
  };
}
