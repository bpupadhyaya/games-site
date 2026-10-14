// One sled body on one chute. The player, the Watch & Learn pilot and every computer rival use exactly this step.
import { SEG, HW, at, nrefAt } from './track.js';
import { clamp } from './util.js';

export const DT = 1 / 60;
export const EDGE = HW - 0.5;          // the lateral limit of the sled's centre: beyond it the runners scrape the wall
export const MAX_LEAN_RATE = 5.5;      // per second: how fast the lean follows the finger
const G = 9.8, DRAG = 0.00046, ROLL = 0.08, SCRAPE = 0.16;

export const newBody = (v0 = 4) => ({ s: 8, n: 0, vn: 0, v: v0, u: 0, t: 0, top: 0, scrape: 0, touches: 0, hit: 0 });

// u is the lean TARGET in [-1, 1]; the body follows it at a limited rate. Returns the strongest wall hit this step (0 = none).
export function stepBody(B, T, u, dt, ruts) {
  const k = at(T.k, B.s), bank = at(T.bank, B.s), g = at(T.g, B.s);
  B.u += clamp(u - B.u, -MAX_LEAN_RATE * dt, MAX_LEAN_RATE * dt);
  const an = -B.v * B.v * k + G * Math.sin(bank);               // + = to the right
  const auth = 8.5 + 0.12 * B.v;
  B.vn += (an + B.u * auth - 1.7 * B.vn) * dt;
  if (ruts) for (const r of ruts) if (!r.done && B.s >= r.s) { r.done = true; B.vn += r.imp; }
  B.n += B.vn * dt;
  let hit = 0;
  const over = Math.abs(B.n) - EDGE;
  if (over > 0) {
    const sg = Math.sign(B.n);
    if (B.vn * sg > 0.7) { hit = Math.min(4, B.vn * sg); B.v *= 1 - 0.014 * hit; B.touches++; }
    B.n = sg * EDGE;
    B.vn = -sg * Math.min(1.1, Math.abs(B.vn) * 0.3);
    B.v -= SCRAPE * B.v * dt; B.scrape += dt;
    B.hitFlag = true;
  } else B.hitFlag = false;
  const slip = 0.004 * Math.abs(B.u) + 0.003 * Math.abs(B.vn);
  const a = G * g - DRAG * B.v * B.v - ROLL - slip * B.v;
  B.v = Math.max(1, B.v + a * dt);
  const kn = clamp(4.2 * k * B.n, -0.5, 0.5);                      // inside of a bend is the shorter way round
  B.s += B.v * dt / (1 - kn);
  B.t += dt;
  if (B.v > B.top) B.top = B.v;
  return hit;
}
