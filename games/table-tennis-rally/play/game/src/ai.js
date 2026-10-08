// The computer player. It plays through exactly the same shot solver as the human: it picks a stroke kind that suits the
// incoming spin and its personality, picks a landing spot, and its stroke quality comes from its level and how stretched it is.
import { KINDS } from './shots.js';
import { levelStats } from './profiles.js';
import { readSpin, SPIN_UNIT } from './strokes.js';
import { TABLE } from './physics.js';

const STYLE_W = {
  looper: { loop: 5, drive: 2, push: 1, block: 1, flick: 1.2, touch: 0.5 },
  chopper: { chop: 5, push: 3, block: 1, loop: 0.8, touch: 0.5 },
  blocker: { block: 5, touch: 1.5, drive: 1, push: 1, loop: 0.8 },
  allround: { loop: 3, drive: 3, block: 2, push: 2, chop: 1, touch: 1, flick: 1 },
  hitter: { drive: 5, smash: 2, loop: 2, block: 1, flick: 1 },
  pusher: { push: 5, touch: 3, loop: 1, block: 1, drive: 0.8 },
  lobber: { lob: 4, chop: 2, block: 1, loop: 0.8, push: 0.5 },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Pick a stroke kind for the incoming ball. c = { y, d } contact height and depth.
export function chooseKind(prof, ball, c, rng, speedIn) {
  const sIn = readSpin(ball).top;
  const W = STYLE_W[prof.style] ?? STYLE_W.allround;
  let total = 0;
  const cand = [];
  for (const [k, w0] of Object.entries(W)) {
    let w = w0 * Math.exp(-1.15 * Math.abs(sIn - KINDS[k].ideal));
    if (k === 'smash') w *= c.y > 1.25 ? 2.2 : 0;
    if (k === 'loop' || k === 'drive' || k === 'flick') w *= 0.5 + prof.aggression * 1.1;
    if (k === 'block' || k === 'touch') w *= 1.4 - prof.aggression * 0.6;
    if (speedIn > 10.5 && (k === 'block' || k === 'chop' || k === 'lob')) w *= 2.2;
    if (speedIn > 10.5 && k === 'drive') w *= 0.4;
    if (c.y < 0.88 && (k === 'drive' || k === 'smash')) w *= 0.3;     // low ball: lift it, do not flat-drive it
    if (c.d > 2.3 && k !== 'chop' && k !== 'lob') w *= 0.5;           // far back: defend
    cand.push([k, w]); total += w;
  }
  let r = rng.next() * total;
  for (const [k, w] of cand) { r -= w; if (r <= 0) return k; }
  return cand[cand.length - 1][0];
}

// Where to put it. oppX = the human's paddle x.
export function chooseTarget(prof, kind, oppX, contactX, rng, level) {
  const st = levelStats(level);
  const edge = TABLE.hw - st.margin;
  let tx;
  const wrongFoot = rng.chance(0.35 + 0.045 * level);
  if (prof.place === 'corners') tx = (wrongFoot ? -Math.sign(oppX || 1) : Math.sign(oppX || rng.pick([-1, 1]))) * edge * rng.range(0.78, 1);
  else if (prof.place === 'body') tx = clamp(oppX * 0.5 + rng.range(-0.14, 0.14), -0.4, 0.4);
  else if (prof.place === 'cross') tx = -Math.sign(contactX || rng.pick([-1, 1])) * edge * rng.range(0.55, 1);
  else tx = rng.chance(0.25) ? clamp(oppX * 0.4, -0.4, 0.4) : (wrongFoot ? -Math.sign(oppX || 1) : Math.sign(oppX || 1)) * edge * rng.range(0.4, 1);
  if (kind === 'touch' || kind === 'push') tx *= 0.7;
  return clamp(tx, -edge, edge);
}

// Full intent for a ball met at c.
export function aiIntent(prof, level, ball, c, oppX, rng, speedIn) {
  const kind = chooseKind(prof, ball, c, rng, speedIn);
  const K = KINDS[kind];
  const tx = chooseTarget(prof, kind, oppX, c.x, rng, level);
  const power = clamp(0.25 + prof.aggression * 0.6 + rng.range(-0.18, 0.18) + (level - 5) * 0.02, 0, 1);
  const speed = K.v[0] + (K.v[1] - K.v[0]) * power;
  const depth = clamp(K.depth + rng.range(-0.1, 0.1) + (level - 5) * 0.012, 0.4, 1.3);
  const sideSpin = rng.chance(0.18 + prof.aggression * 0.15) ? rng.range(-1, 1) * 230 : 0;
  return { kind, tx, depth, speed, top: K.top * (0.8 + 0.4 * power) * (prof.style === 'looper' ? 1.12 : 1), side: sideSpin, risk: K.risk, maxPitch: K.maxPitch };
}

// Serve choice.
export function aiServe(prof, level, rng) {
  const [ws, wl, wsp] = prof.serve;
  const r = rng.next() * (ws + wl + wsp);
  const kind = r < ws ? 'serveShort' : r < ws + wl ? 'serveLong' : 'serveSpin';
  const K = KINDS[kind];
  const edge = TABLE.hw - levelStats(level).margin;
  const tx = rng.range(-1, 1) * edge * (kind === 'serveShort' ? 0.6 : 1);
  const power = rng.range(0.2, 0.9);
  return { kind, tx, depth: K.depth + rng.range(-0.06, 0.06), speed: K.v[0] + (K.v[1] - K.v[0]) * power, top: K.top, side: rng.chance(0.5) ? rng.range(-1, 1) * 260 : 0, risk: K.risk, maxPitch: K.maxPitch, serve: true };
}

export const aiTuning = { SPIN_UNIT };
