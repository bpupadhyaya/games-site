// The rival (and the coach in Watch & Learn): decides, for every rod of one team, where to slide and when to strike.
// It sees the ball with a reaction lag, predicts bounces as well as its level allows, and aims kicks at the open part of the goal.
import { HL, KINDS, LEVELS, ROD_LAYOUT, dirOf, GOAL_HW, MAN_HY, BALL_R } from './consts.js';
import { clamp, manX, manBase, reflectX } from './physics.js';

const LEAD = 0.08;   // seconds a strike takes to reach the ball

// Pick the man of `rod` best placed to stand at table x = want; returns { k, off }.
export function pickMan(rod, want) {
  const K = KINDS[rod.kind];
  let best = null;
  for (let k = 0; k < K.n; k++) {
    const off = want - manBase(rod.kind, k);
    const clamped = clamp(off, -K.maxOff, K.maxOff);
    const miss = Math.abs(off - clamped), move = Math.abs(clamped - rod.off);
    const score = miss * 100 + move;
    if (!best || score < best.score) best = { k, off: clamped, score, miss };
  }
  return best;
}

const seen = (S, lag) => {
  const h = S.hist;
  if (!h.length) return S.ball;
  return h[Math.max(0, h.length - 1 - Math.round(lag * 60))];
};

const REASON = {
  clear: 'The ball is sitting in front of this rod. Strike it up the table before the rival gets there.',
  pass: 'A midfield strike passes the ball forward. Line a man up just behind it and flick.',
  shoot: 'This attacker is in front of the ball. Aim for the side the rival goalkeeper is leaving open and flick.',
  block: 'The ball is coming at this rod. Slide a man to stand in its path and let it bounce off.',
  cover: 'Slide to follow the ball sideways so a man is always ready.',
};

/**
 * Commands for one team. Returns one entry per rod of that team: { rod, tgt, kick, why, relevant, ahead, k, aimX }
 * `noise` gives each rod a steady personal aim error so that weaker levels miss in a consistent, human way.
 */
export function aiCommands(S, team, P, rng) {
  const dir = dirOf(team);
  const bs = seen(S, P.lag);
  const oppGoalY = dir * HL;
  const oppGk = S.rods.find((r) => r.team !== team && r.kind === 'gk');
  const out = [];
  // the rod that will play the ball next: the nearest rod "behind" the ball
  let rel = -1, relD = 1e9;
  S.rods.forEach((r) => { if (r.team !== team) return; const a = (bs.y - r.y) * dir; if (a > 0 && a < relD) { relD = a; rel = r.i; } });
  for (const r of S.rods) {
    if (r.team !== team) continue;
    const ahead = (bs.y - r.y) * dir;
    let bx = bs.x;
    const toward = bs.vy * (r.y - bs.y) > 0 && Math.abs(bs.vy) > 8;
    if (toward) { const t = (r.y - bs.y) / bs.vy; bx = bs.x + (reflectX(bs.x + bs.vx * t) - bs.x) * P.antic; }
    if (ahead < 0) bx *= 0.5;
    bx *= P.cover > 0.99 ? 1 : P.cover + (1 - P.cover) * 0.3;
    let tgt = null, why = REASON.cover, kick = 0, aimX = 0;
    // aiming: where should the ball go?
    const gx = oppGk ? (manX(oppGk, 0) > 0 ? -1 : 1) * (r.kind === 'att' ? 4.5 : 3) : 0;
    const dy = Math.max(10, Math.abs(oppGoalY - bs.y));
    const spd = 70 + 230 * P.power;
    const lat = ((gx + r.noise * P.err) - bs.x) / dy * spd;
    const wantDx = clamp(lat / 11, -2.4, 2.4);                       // ball x minus man x at the strike
    const near = ahead > 0.5 && ahead < 18 && r.i === rel;
    const m = pickMan(r, near ? bs.x - wantDx : bx);
    tgt = m.off;
    // the ball is level with this rod (between its men): chasing it would only pump it around, so stay put
    if (Math.abs(bs.y - r.y) < MAN_HY + BALL_R + 0.3 && Math.hypot(bs.vx, bs.vy) < 400) tgt = r.off;
    // never drag a ball that is touching the front of a man sideways: hold still and strike, or wait until it rolls clear
    if (near && ahead < 4.4 && Math.abs(m.off - r.off) > 1.2 && Math.hypot(bs.vx, bs.vy) < 30) tgt = r.off;
    if (near) why = r.kind === 'att' ? REASON.shoot : r.kind === 'mid' ? REASON.pass : REASON.clear;
    else if (toward && ahead > 0) why = REASON.block;
    // strike?
    const px = bs.x + bs.vx * LEAD, py = bs.y + bs.vy * LEAD;
    const ap = (py - r.y) * dir;
    const slowEnough = r.kind !== 'gk' || Math.hypot(bs.vx, bs.vy) < 55 || ap < 4.2;
    if (r.swT < 0 && ap > MAN_HY + BALL_R - 0.4 && ap < 7.4 && Math.abs(px - manX(r, m.k)) < 3.0 && slowEnough) {
      if (P.eager >= 1 || rng.next() < P.eager) { kick = clamp(P.power, 0.3, 1); aimX = gx; }
    }
    out.push({ rod: r.i, tgt, kick, why, relevant: r.i === rel, ahead, k: m.k, aimX, wantDx });
  }
  return out;
}

export const levelOf = (n) => LEVELS[clamp((n | 0) - 1, 0, LEVELS.length - 1)];

// Hint text for the player: the best next move with a reason.
export function hint(S, team, P, rng) {
  const cmds = aiCommands(S, team, { ...P, lag: 0, eager: 1 }, rng);
  const c = cmds.find((x) => x.relevant) || cmds[0];
  const r = S.rods[c.rod];
  const K = KINDS[r.kind];
  const side = c.tgt > r.off + 1 ? 'slide it to the right' : c.tgt < r.off - 1 ? 'slide it to the left' : 'it is already well placed';
  const summary = `${K.label} rod: ${side}${c.kick ? ', then flick up now' : ', then flick up when the ball is just in front of a man'}.`;
  return { rod: c.rod, tgt: c.tgt, k: c.k, kick: c.kick > 0, aimX: c.aimX, reason: c.why, summary };
}

export { ROD_LAYOUT, GOAL_HW };
