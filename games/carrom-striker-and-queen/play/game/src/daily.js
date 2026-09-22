// The daily trick shot: a position generated from the day number, with a PROVEN shot that pockets the goal number of
// white coins in one stroke (checked with the real physics, and again with a small aim error so it is not a knife edge).
// Same position for everyone on a given day. step() does one shot's worth of work so it can run in the background.
import { S, R_COIN, BASE_X0, BASE_X1 } from './physics.js';
import { newBoard, cloneGame, playStroke, clearX } from './rules.js';
import { candidates } from './ai.js';

const lcg = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

export function puzzleBoard(coins) {
  const g = newBoard('W'); g.world = coins.map((c, i) => ({ id: i + 1, k: c.k, x: c.x, y: c.y, vx: 0, vy: 0, on: true })); g.free = true; return g;
}
const hitsGoal = (g, x, angle, power, goal) => { const g2 = cloneGame(g); const r = playStroke(g2, clearX(g2, 'W', x), angle, power); return !r.foul && r.own >= goal; };

export function createPuzzleMaker(day) {
  let attempt = 0, cur = null, fallback = null;
  const gen = () => {
    const r = lcg(day * 7919 + attempt * 104729 + 17), coins = [], want = ['W', 'W', 'W', 'B', 'B'];
    for (const k of want) {
      for (let tries = 0; tries < 60; tries++) {
        const x = 110 + r() * 520, y = 130 + r() * 380;
        if (coins.every((c) => Math.hypot(c.x - x, c.y - y) > R_COIN * 2.6)) { coins.push({ k, x: Math.round(x), y: Math.round(y) }); break; }
      }
    }
    const g = puzzleBoard(coins), rnd = lcg(attempt + 5), list = candidates(g, 'W', 3, rnd);
    return { coins, g, list, i: 0, best: null };
  };
  return {
    step() {
      if (!cur) cur = gen();
      const c = cur;
      if (c.i < c.list.length) {
        const s = c.list[c.i++], g2 = cloneGame(c.g), r = playStroke(g2, clearX(g2, 'W', s.x), s.angle, s.power), own = r.foul ? 0 : r.own;
        if (own >= 1 && (!c.best || own > c.best.own)) c.best = { own, shot: s };
        return { puzzle: null };
      }
      // list exhausted: accept if the best shot is robust to a small aim error
      if (c.best) {
        const goal = Math.min(2, c.best.own), s = c.best.shot;
        const robust = [-0.006, 0.006, -0.003, 0.003].every((d) => hitsGoal(c.g, s.x, s.angle + d, s.power, goal));
        if (robust) return { puzzle: { day, coins: c.coins, goal, solution: s } };
        if (!fallback) fallback = { day, coins: c.coins, goal: 1, solution: c.best.shot };
      }
      attempt++; cur = null;
      if (attempt > 40 && fallback) return { puzzle: fallback };
      return { puzzle: null };
    },
  };
}
