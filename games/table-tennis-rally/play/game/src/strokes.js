// Turning a player's flick into a stroke intent, and the helpers both players share (contact quality, spin reading).
// A "flick" is { dir: 'up'|'down', f: 0..1 strength, aim: -1..1 (left..right), curve: -1..1 (sidespin), x: paddle x when it started }.
import { KINDS } from './shots.js';
import { spinParts, TABLE } from './physics.js';

export const SPIN_UNIT = 450;                        // rad/s that counts as "1" when we talk about heavy spin
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Incoming topspin in units of SPIN_UNIT (+ topspin, - backspin) and sidespin.
export function readSpin(ball) {
  const { top, side } = spinParts(ball.w, ball.v[0], ball.v[2]);
  return { top: top / SPIN_UNIT, side: side / SPIN_UNIT };
}

export function spinLabel(sp) {
  const a = Math.abs(sp.top), b = Math.abs(sp.side);
  if (a < 0.22 && b < 0.22) return { id: 'flat', text: 'No spin' };
  if (a >= b) return sp.top > 0 ? { id: 'top', text: a > 0.8 ? 'Heavy topspin' : 'Topspin' } : { id: 'back', text: a > 0.8 ? 'Heavy backspin' : 'Backspin' };
  return { id: 'side', text: sp.side > 0 ? 'Sidespin (curls left)' : 'Sidespin (curls right)' };
}

// How well a stroke kind fits the incoming spin: 0 = ideal, +-1 = one unit of mismatch (pitch error of a few degrees).
export function mismatchFor(kind, sIn) {
  const K = KINDS[kind];
  return clamp(sIn.top - (K ? K.ideal : 0), -2.2, 2.2);
}

// Contact quality 0..1 from where the ball met the paddle. side distance dx (m), contact height y, depth d (distance behind the end line + 1.37).
export function contactQuality(dx, reach, y, d, speedIn) {
  const qx = 1 - 0.62 * Math.pow(clamp(Math.abs(dx) / reach, 0, 1), 1.5);
  const dd = Math.hypot((y - 1.02) * 1.5, (d - 1.82) * 0.85);
  const qh = 1 - 0.55 * Math.pow(clamp(dd / 0.6, 0, 1), 1.3);
  const qs = 1 - clamp((speedIn - 9) / 14, 0, 0.3);
  return clamp(qx * qh * qs, 0.12, 1);
}

// Player flick -> stroke intent for a ball met at contact point `c` ({x, y, d}).
export function intentFromFlick(f, c, serve = false) {
  let kind;
  if (serve) kind = f.dir === 'down' ? 'serveShort' : f.f >= 0.62 ? 'serveLong' : 'serveSpin';
  else if (f.dir === 'down') kind = f.f < 0.5 ? 'push' : 'chop';
  else if (c.y > 1.3 && f.f > 0.68) kind = 'smash';
  else if (f.f < 0.24) kind = 'touch';
  else if (f.f < 0.6) kind = 'loop';
  else kind = 'drive';
  const K = KINDS[kind];
  const t = kind === 'loop' ? (f.f - 0.24) / 0.36 : kind === 'drive' ? (f.f - 0.6) / 0.4 : kind === 'touch' ? f.f / 0.24 : kind === 'push' ? f.f / 0.5 : kind === 'chop' ? (f.f - 0.5) / 0.5 : kind === 'smash' ? (f.f - 0.68) / 0.32 : kind === 'serveLong' ? (f.f - 0.62) / 0.38 : kind === 'serveSpin' ? f.f / 0.62 : 0.5;
  const tt = clamp(t, 0, 1);
  const hw = TABLE.hw;
  const tx = clamp(c.x + f.aim * 1.15, -(hw - 0.07), hw - 0.07);
  const top = K.top * lerp(0.78, 1.18, tt);
  return {
    kind, tx, depth: clamp(K.depth + (tt - 0.5) * 0.18, 0.4, 1.3), speed: lerp(K.v[0], K.v[1], tt),
    top, side: f.curve * 260 + (serve ? f.aim * -90 : 0), risk: K.risk, maxPitch: K.maxPitch, serve,
  };
}
