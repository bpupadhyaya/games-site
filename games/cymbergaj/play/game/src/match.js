// Match rules in one small place: how a match starts, who serves, when it ends. game.js drives it; the AI ladder check in
// design/tools uses simMatch() to play whole matches headless.
import { createWorld, placeServe, resetPads, stepWorld } from './sim.js';
import { createBrain, brainStep } from './ai.js';

export const LENGTHS = [5, 7];
export const HOVER_LIMIT = 7;       // seconds a puck may rest on one half before it is given to the other side

export function newMatch(cfg) {
  return { cfg: { mode: 'ai', opp: 0, goalsTo: LENGTHS[0], first: 0, ...cfg }, scores: [0, 0], server: cfg.first ?? 0, phase: 'ready', over: null, rallies: 0, hits: [0, 0], longest: 0, fastest: 0, goals: [] };
}

// Score a goal for `side`; the side that conceded serves next. Returns true when the match is over.
export function goalFor(m, side, speed = 0) {
  m.scores[side]++;
  m.server = 1 - side;
  m.rallies++;
  m.fastest = Math.max(m.fastest, speed);
  m.goals.push(side);
  if (m.scores[side] >= m.cfg.goalsTo) { m.over = { win: side }; return true; }
  return false;
}

// Headless match between two profiles (used for the difficulty ladder; not by the game).
export function simMatch(profA, profB, goalsTo, rng, maxSeconds = 600) {
  const w = createWorld();
  const brains = [createBrain(0, profA, rng.fork()), createBrain(1, profB, rng.fork())];
  const m = newMatch({ goalsTo, first: rng.int(2) });
  let t = 0, ready = 1.0, goalT = 0, rest = [0, 0];
  placeServe(w, m.server); resetPads(w, true);
  while (!m.over && t < maxSeconds) {
    const dt = 1 / 60; t += dt;
    if (goalT > 0) {
      goalT -= dt; stepWorld(w, dt);
      if (goalT <= 0) { placeServe(w, m.server); resetPads(w, true); ready = 0.8; brains.forEach((b) => { b.phase = 'idle'; b.plan = null; b.cool = 0; }); }
      continue;
    }
    if (ready > 0) { ready -= dt; continue; }
    brains.forEach((b) => brainStep(b, w, dt, {}));
    stepWorld(w, dt);
    if (w.goal) { goalFor(m, w.goal.side, w.goal.speed); goalT = 0.5; continue; }
    // hover rule
    const half = w.puck.y > 0 ? 0 : 1, sp = Math.hypot(w.puck.vx, w.puck.vy);
    if (sp < 50) { rest[half] += dt; rest[1 - half] = 0; } else rest = [0, 0];
    if (rest[half] > HOVER_LIMIT) { rest = [0, 0]; placeServe(w, 1 - half); }
  }
  return { scores: m.scores, over: m.over, seconds: t };
}
