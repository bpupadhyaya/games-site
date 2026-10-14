// The computer slider (rivals and Watch & Learn). skill 0..1: the racing line followed at 1, a wobbly, cautious line at 0.3.
import { at, nrefAt, HW } from './track.js';
import { clamp } from './util.js';

export function createPilot(rng, skill) {
  const off = rng.range(-1, 1) * (1 - skill) * 1.5;            // a personal bias away from the line
  const ph1 = rng.range(0, 6.28), ph2 = rng.range(0, 6.28);
  const wob = Math.pow(1 - skill, 1.5) * 1.4;
  const kp = 0.9 + 0.7 * skill, kd = 0.5;
  const margin = (1 - skill) * 0.9;                            // low skill keeps away from the inner edge
  return function steer(B, T) {
    const look = 4 + 0.45 * B.v * (0.8 + 0.4 * skill);
    let tgt = nrefAt(T, B.s + look);
    tgt = tgt * (1 - margin * 0.5) + off;
    const k = at(T.k, B.s), bank = at(T.bank, B.s);
    const auth = 8.5 + 0.12 * B.v;
    const ff = (B.v * B.v * k - 9.8 * Math.sin(bank)) / auth;
    let u = ff * (0.25 + 0.75 * skill) + kp * (tgt - B.n) - kd * B.vn;
    u += wob * (Math.sin(B.t * 2.1 + ph1) + 0.6 * Math.sin(B.t * 3.7 + ph2));
    return clamp(u, -1, 1);
  };
}
