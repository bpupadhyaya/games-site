// A computer jumper that drives the same inputs a thumb would: the rivals, Watch & Learn and the store screenshots use it.
// skill 0..1: higher = steadier rhythm, a cleaner plant, a better read of the pole. All randomness comes from the rng handed in.
import { X_IDEAL, ZONE_LEN, DT } from './jump.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function createPilot(rng, skill = 0.85) {
  const e = rng.fork();
  const gauss = () => (e.next() + e.next() + e.next() - 1.5) * 1.4;
  const sdBeat = (1 - skill) * 0.16 + 0.012;               // seconds
  const sdPlant = (1 - skill) * 0.55 + 0.06;                // metres
  const missP = (1 - skill) * 0.1;
  const lagS = Math.abs(gauss()) * (1 - skill) * 0.22;       // late let-go
  const tcOffset = (1 - skill) * 0.3 + gauss() * (1 - skill) * 0.08;   // how long it waits after the upright before climbing
  let beatTarget = null, plantAt = null, lean = 2, lagLeft = null, wantLean = 2, plan = null, replan = 0, planAge = 0;
  return function pilot(jp) {
    const j = jp.j;
    const out = { down: false, pressed: false, released: false };
    if (j.ph === 'ready') { out.pressed = true; return out; }
    if (j.ph === 'run') {
      if (j.inZone) {
        if (plantAt === null) plantAt = X_IDEAL + gauss() * sdPlant;
        if (j.zoneT > 0.14 && j.x + j.v * DT >= plantAt) out.pressed = true;
        return out;
      }
      // tap on the beat with a little error; sometimes miss one
      if (beatTarget === null || beatTarget.n !== j.nb) beatTarget = { n: j.nb, err: gauss() * sdBeat, miss: e.chance(missP) };
      if (!beatTarget.miss && j.tb <= beatTarget.err && j.tb > -0.09) { out.pressed = true; beatTarget.miss = true; }
      return out;
    }
    if (j.ph === 'pole') {
      // climb while the look-ahead says the pole still goes over the upright (a careful jumper waits a little longer)
      const safe = j.safe && j.safe.ok;
      const early = j.theta >= -0.2 + tcOffset;
      out.down = !!(safe && early && j.r < j.rmax && j.stam > 0.06) || (j.theta > 0.0 && j.r < j.rmax && j.stam > 0.06);
      // every fifth of a second: where is the best let-go if I keep climbing? let go when that moment is now
      if (--replan <= 0) { plan = jp.bestRelease(); replan = 12; planAge = 0; }
      planAge += DT;
      wantLean = plan ? plan.lean : 2; out.lean = wantLean;
      if (plan && plan.t - planAge <= DT * 1.5 || j.theta > 1.18) {
        if (lagLeft === null) lagLeft = lagS;
        lagLeft -= DT;
        if (lagLeft <= 0) out.letgo = wantLean;
      }
      return out;
    }
    void clamp; void lean;
    return out;
  };
}
