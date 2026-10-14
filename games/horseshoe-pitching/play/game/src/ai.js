// The rivals and their planner. A rival picks the throw with the best average result over a handful of simulated shoes (using the
// same engine as the real throw and its own scatter), and then throws it with its own timing and scatter. Weaker rivals have more
// scatter, shakier timing and sometimes settle for a lesser idea.
import { resolveThrow, scoreInning, FLIPS, edgeDist, isRinger, SIX, clamp } from './sim.js';

// The ladder was tuned with rival-vs-rival matches (each step beats the one below it about 3 times in 4, with no big gaps).
// k: multiplier on the pit scatter; timing: spread of the release in degrees of arm swing
export const PROFILES = [
  { id: 'gus', name: 'Gus', tag: 'Backyard beginner, loves a lucky ringer', stars: 1, k: 1.55, timing: 9, blunder: 0.18, think: [1.0, 1.9] },
  { id: 'marge', name: 'Marge', tag: 'Picnic regular, steady and cheerful', stars: 2, k: 1.27, timing: 6.2, blunder: 0.14, think: [1.1, 2.0] },
  { id: 'dale', name: 'Dale', tag: 'League night, goes for the knock-off', stars: 3, k: 1.04, timing: 4.2, blunder: 0.09, think: [1.1, 2.1] },
  { id: 'ruth', name: 'Ruth', tag: 'County champion, rarely misses a flip', stars: 4, k: 0.85, timing: 2.9, blunder: 0.04, think: [1.2, 2.2] },
  { id: 'judge', name: 'The Judge', tag: 'Tournament calm, reads every shoe', stars: 5, k: 0.7, timing: 2.0, blunder: 0, think: [1.4, 2.5] },
];
// the partner in doubles
export const PARTNER = { id: 'sunny', name: 'Sunny', tag: 'Your doubles partner', stars: 3, k: 1.15, timing: 5.2, blunder: 0.11, think: [1.0, 1.8] };

const gaussR = (rnd) => (rnd() + rnd() + rnd() - 1.5) * 2;

function candidates(shoes) {
  const c = [];
  const add = (x, v, kind) => c.push({ tx: clamp(x, -0.36, 0.36), tv: clamp(v, -0.56, 0.6), kind });
  add(0, -0.03, 'ringer'); add(0, 0.0, 'ringer'); add(0.02, -0.05, 'ringer'); add(-0.02, -0.05, 'ringer');
  add(0, -0.1, 'close'); add(0.1, -0.06, 'close'); add(-0.1, -0.06, 'close'); add(0.09, 0.07, 'close'); add(-0.09, 0.07, 'close'); add(0, 0.12, 'close');
  add(0.05, -0.16, 'close'); add(-0.05, -0.16, 'close'); add(0, -0.24, 'safe');
  for (const s of shoes) {
    if (s.dead) continue;
    if (Math.hypot(s.x, s.v) < 0.35) { add(s.x, s.v - 0.05, 'knock'); add(s.x + 0.03, s.v - 0.1, 'knock'); }
  }
  return c;
}

// the value of a position to `side`: net points of the inning as it would stand, plus a little for shoes in play
const valueOf = (shoes, side) => {
  const sc = scoreInning(shoes);
  const mine = sc.net * (side === 0 ? 1 : -1);
  let tie = 0;
  for (const s of shoes) { if (s.dead || s.side !== side) continue; if (isRinger(s)) tie += 0.15; else if (edgeDist(s) <= SIX) tie += 0.05; }
  return mine + tie;
};

export function createPlanner(pitId, shoes, side, prof, rnd, opts = {}) {
  const k = opts.perfect ? 0.6 : prof.k;
  const jobs = [];
  for (const cand of candidates(shoes)) for (let f = 0; f < FLIPS.length; f++) jobs.push({ ...cand, flip: f });
  const results = [];
  let idx = 0, sims = 0;
  const N = opts.perfect ? 14 : 7;
  const self = {
    done: false, result: null,
    get sims() { return sims; },
    step(n = 8) {
      for (let q = 0; q < n && idx < jobs.length; q++, idx++) {
        const j = jobs[idx];
        const edeg = (opts.perfect ? 2.5 : prof.timing) / FLIPS[j.flip].window;
        let sum = 0;
        for (let i = 0; i < N; i++) {
          const r = resolveThrow(pitId, shoes, { tx: j.tx, tv: j.tv, flip: j.flip, e: gaussR(rnd) * edeg, side, id: 999, kLat: k, kDep: k, kAng: k }, rnd);
          sum += valueOf(r.shoes, side); sims++;
        }
        results.push({ ...j, score: sum / N });
      }
      if (idx >= jobs.length && !self.done) {
        results.sort((a, b) => b.score - a.score);
        let pick = results[0];
        if (!opts.perfect && rnd() < prof.blunder) pick = results[Math.min(results.length - 1, 1 + Math.floor(rnd() * 4))];
        self.result = {
          params: { tx: pick.tx, tv: pick.tv, flip: pick.flip }, kind: pick.kind, score: pick.score,
          alts: results.slice(0, 3).map((r) => ({ params: { tx: r.tx, tv: r.tv, flip: r.flip }, kind: r.kind, score: r.score })),
        };
        self.done = true;
      }
    },
  };
  return self;
}

// the actual throw of a rival: the plan plus its own timing and scatter
export function executePlan(plan, prof, rnd) {
  const fl = FLIPS[plan.params.flip];
  const e = gaussR(rnd) * (prof.timing / fl.window);
  return { tx: plan.params.tx, tv: plan.params.tv, flip: plan.params.flip, e, kLat: prof.k, kDep: prof.k, kAng: prof.k };
}
