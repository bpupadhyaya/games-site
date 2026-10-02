// The rivals. Each one looks ahead with the real physics: it proposes heading points and string modes,
// flies a copy of the sky forward about a second for each, and scores the outcome (string worn from the
// rival, string worn from itself, wind to come). Differences between rivals are habits, not cheats:
// how many options they weigh, how far ahead they look, how often they slip, how hard they gamble.
// Live rivals add human-like timing: a reaction delay that varies, a hand that moves at a finite speed,
// a little tremor, and a choice among the best few plans instead of always the single best.
import { ANCHOR, BOUNDS, cloneWorld, stepWorld, clamp, K } from './sim.js';

export const PROFILES = [
  { id: 'meera', name: 'Meera', tag: 'Gentle and patient', stars: 1, style: 'patang', steer: 0.85, react: [1.5, 2.4], cands: 7, hor: 0.5, noise: 6, slip: 0.35, aggr: 0.7, caution: 0.8, temp: 14, hand: 380, think: [2.5, 4] },
  { id: 'kenji', name: 'Kenji', tag: 'Guards his string', stars: 2, style: 'rokkaku', steer: 0.92, react: [1.0, 1.7], cands: 12, hor: 0.7, noise: 3, slip: 0.2, aggr: 0.9, caution: 1.35, temp: 9, hand: 480, think: [2, 3.2] },
  { id: 'rahim', name: 'Rahim', tag: 'Hunts the gusts', stars: 3, style: 'tailed', steer: 1.0, react: [0.75, 1.3], cands: 18, hor: 0.85, noise: 2, slip: 0.12, aggr: 1.35, caution: 0.85, temp: 7, hand: 560, think: [1.6, 2.6] },
  { id: 'dilnoza', name: 'Dilnoza', tag: 'Strikes from above', stars: 4, style: 'patang', steer: 1.03, react: [0.55, 1.0], cands: 24, hor: 0.95, noise: 1.5, slip: 0.07, aggr: 1.15, caution: 1.1, temp: 5, alt: 0.007, hand: 650, think: [1.2, 2] },
  { id: 'master', name: 'Master of the Line', tag: 'Reads everything', stars: 5, style: 'rokkaku', steer: 1.06, react: [0.4, 0.75], cands: 30, hor: 1.05, noise: 0.8, slip: 0.03, aggr: 1.2, caution: 1.25, temp: 3, hand: 760, think: [1, 1.6] },
];
export const PERFECT = { id: 'perfect', name: 'Coach', cands: 40, hor: 1.1, noise: 0, slip: 0, aggr: 1.1, caution: 1.15, temp: 0, hand: 900, react: [0.4, 0.5], steer: 1 };

const SUB = 0.05;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return dist(px, py, ax + dx * t, ay + dy * t);
}

// the heading points worth considering: staging points near the rival's string, points past it (which make the
// strings cross), safe points up high, and wherever the kite is already heading
export function candidatePoints(w, side, rng, count) {
  const me = w.k[side], en = w.k[1 - side], ea = ANCHOR[1 - side], ma = ANCHOR[side];
  const pts = [{ tx: me.tx, ty: me.ty, tag: 'hold' }];
  const dx = en.x - ea.x, dy = en.y - ea.y, d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d;
  const sideOfMe = Math.sign((ma.x - ea.x) * nx + (ma.y - ea.y) * ny) || 1;
  for (const f of [0.35, 0.6, 0.85, 1.0]) {
    const bx = ea.x + dx * f, by = ea.y + dy * f;
    for (const off of [-1, 1]) for (const mag of [120, 250]) {
      const across = off !== sideOfMe;
      pts.push({ tx: bx + nx * off * mag, ty: by + ny * off * mag, tag: across ? 'cross' : 'stage' });
    }
  }
  pts.push({ tx: me.x, ty: me.y - 200, tag: 'climb' }, { tx: me.x, ty: me.y + 150, tag: 'dive' }, { tx: (me.x + en.x) / 2, ty: Math.min(me.y, en.y) - 120, tag: 'high' });
  for (const p of pts) { p.tx = clamp(p.tx, BOUNDS.x0 + 10, BOUNDS.x1 - 10); p.ty = clamp(p.ty, BOUNDS.y0 + 10, BOUNDS.y1 - 10); }
  const head = pts[0], rest = pts.slice(1);
  const pick = count >= rest.length + 1 ? rest : rng.shuffle(rest).slice(0, Math.max(1, count - 1));
  return [head, ...pick];
}

function evaluate(w0, side, c, prof) {
  const w = cloneWorld(w0);
  const me = w.k[side], en = w.k[1 - side], ea = ANCHOR[1 - side];
  me.tx = c.tx; me.ty = c.ty; me.mode = c.mode;
  const myI = me.integ, enI = en.integ, myS = w.dmg[side] ;
  let contact = 0, near = 1e9, strainLoss = 0, won = 0;
  const steps = Math.max(2, Math.round(prof.hor / SUB));
  for (let i = 0; i < steps; i++) {
    stepWorld(w, SUB); w.ev.length = 0;
    if (w.contact) contact += SUB;
    near = Math.min(near, distToSegment(me.x, me.y, ea.x, ea.y, en.x, en.y));
    if (w.over) { won = w.over.winner === side ? 1 : -1; break; }
  }
  const dealt = Math.max(0, enI - en.integ), taken = Math.max(0, myI - me.integ);
  void myS; void strainLoss;
  let s = dealt * prof.aggr - taken * prof.caution + won * 120;
  if (!contact) s += (1 - clamp(near / 650, 0, 1)) * 4 * prof.aggr;
  if (me.y > 980) s -= (me.y - 980) * 0.05;
  s += (1000 - Math.max(me.y, 520)) * (prof.alt ?? 0.003);
  if (me.grip < 0.2 && c.mode === 1) s -= 3;
  const edge = Math.min(me.x - BOUNDS.x0, BOUNDS.x1 - me.x, me.y - BOUNDS.y0);
  if (edge < 40) s -= (40 - edge) * 0.06;
  return { score: s, contact, dealt, taken, near, won };
}

export const MODE_WORD = { '-1': 'slack', '0': 'steady', '1': 'pull' };

function reasonOf(c, r) {
  const m = c.mode === 1 ? 'Pull' : c.mode === -1 ? 'Let out string' : 'Hold the string';
  let where;
  if (r.won > 0) where = 'finish their string at this crossing';
  else if (r.contact > 0 && r.dealt > r.taken) where = 'cross their string while it wears more than yours';
  else if (r.contact > 0) where = 'cross their string but protect your own';
  else if (c.tag === 'cross') where = 'swing past their string to cross it';
  else if (c.tag === 'stage') where = 'move into position beside their string';
  else if (c.tag === 'climb' || c.tag === 'high') where = 'climb and wait for the wind';
  else if (c.tag === 'dive') where = 'dive toward their string';
  else where = 'keep this heading';
  return `${m} and ${where}.`;
}

// A planner scores candidates a few at a time (so a frame never stalls). `done` flips when all are scored.
export function createPlanner(w, side, prof, rng, opts = {}) {
  const snap = cloneWorld(w);
  const pts = candidatePoints(snap, side, rng, prof.cands);
  const list = [];
  const cur = snap.k[side];
  const modes = [0, 1, -1];
  for (const p of pts) for (const m of modes) list.push({ ...p, mode: m });
  const pl = { list, i: 0, done: false, result: null, scored: [], total: list.length };
  pl.step = (n = 6) => {
    for (let q = 0; q < n && pl.i < list.length; q++, pl.i++) {
      const c = list[pl.i];
      const r = evaluate(snap, side, c, prof);
      const jitter = prof.noise ? (rng.next() - 0.5) * 2 * prof.noise : 0;
      // a little loyalty to the current heading keeps a rival from dithering
      const loyal = c.tag === 'hold' && c.mode === cur.mode ? 0.8 : 0;
      pl.scored.push({ ...c, ...r, score: r.score + jitter + loyal });
    }
    if (pl.i >= list.length && !pl.done) {
      pl.done = true;
      const sorted = [...pl.scored].sort((a, b) => b.score - a.score);
      let pick = sorted[0];
      if (prof.temp > 0 && !opts.perfect) {
        const top = sorted.slice(0, 4), best = top[0].score;
        const wts = top.map((c) => Math.exp((c.score - best) / prof.temp));
        let sum = 0; for (const x of wts) sum += x;
        let r = rng.next() * sum; pick = top[top.length - 1];
        for (let k = 0; k < top.length; k++) { r -= wts[k]; if (r <= 0) { pick = top[k]; break; } }
      }
      pl.result = { params: { tx: pick.tx, ty: pick.ty, mode: pick.mode }, pick, alts: sorted.slice(0, 6), best: sorted[0], reason: reasonOf(pick, pick), all: sorted };
    }
  };
  pl.runAll = () => { while (!pl.done) pl.step(64); return pl.result; };
  return pl;
}

// A live opponent: replans on a human-like schedule and moves its "hand" with finite speed.
export function createBrain(prof, rng, side) {
  const b = {
    prof, side, timer: 0.6 + rng.next() * 0.8, planner: null, goal: null, cx: null, cy: null, modeAt: 0, pendingMode: null, plan: null, tremor: rng.next() * 6,
  };
  b.update = (w, dt) => {
    const k = w.k[side];
    if (b.cx === null) { b.cx = k.tx; b.cy = k.ty; }
    if (w.over || k.free) return;
    b.timer -= dt;
    if (!b.planner && b.timer <= 0) b.planner = createPlanner(w, side, prof, rng, {});
    if (b.planner) {
      b.planner.step(5);
      if (b.planner.done) {
        const res = b.planner.result; b.planner = null; b.plan = res;
        let { tx, ty, mode } = res.params;
        if (rng.chance(prof.slip)) { tx += (rng.next() - 0.5) * 220; ty += (rng.next() - 0.5) * 180; if (rng.chance(0.3)) mode = rng.pick([-1, 0, 1]); }
        b.goal = { tx: clamp(tx, BOUNDS.x0, BOUNDS.x1), ty: clamp(ty, BOUNDS.y0, BOUNDS.y1) };
        if (mode !== k.mode) { b.pendingMode = mode; b.modeAt = 0.1 + rng.next() * 0.45; }
        b.timer = prof.react[0] + rng.next() * (prof.react[1] - prof.react[0]);
      }
    }
    if (b.pendingMode !== null) { b.modeAt -= dt; if (b.modeAt <= 0) { k.mode = b.pendingMode; b.pendingMode = null; } }
    if (b.goal) {
      const dx = b.goal.tx - b.cx, dy = b.goal.ty - b.cy, d = Math.hypot(dx, dy);
      const step = Math.min(d, prof.hand * dt * (0.4 + 0.6 * Math.min(1, d / 120)));
      if (d > 0.5) { b.cx += dx / d * step; b.cy += dy / d * step; }
    }
    b.tremor += dt;
    k.tx = b.cx + Math.sin(b.tremor * 5.1) * 5; k.ty = b.cy + Math.sin(b.tremor * 4.3 + 1) * 5;
  };
  return b;
}

// keep K referenced for tools that import it from here
export const AI_K = K;
