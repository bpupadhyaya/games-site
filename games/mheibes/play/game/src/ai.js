// The computer's two brains, both honest (they see only what the role would see, never the hidden ring when seeking).
//
// SEEKER: a naive-Bayes belief over the ten fists. Prior = how the other side has hidden the ring before (smoothed). Evidence = every stare
// so far, weighted by what it has learned of each player's personality (labelled after every round, when the ring is shown). It then picks
// the number of safe opens m that maximises the expected counters (closed-form below), stares where a look is expected to teach most, and
// answers when opening more is not worth the risk. Level sets how much it learns and how noisy its choice is.
// HIDER: chooses the ring fist, preferring players who give little away and fists the seeker has been choosing less, and a performer.
import { HANDS, PLAYERS, PERS, KINDS, TELL_RING, TELL_EMPTY, GLANCE_TRUE, LEVELS, handPlayer, handSide, seekScore, pickWeighted, PERS_INFO, KIND_LABEL, handName } from './rules.js';

// `team` (optional) = what the player can see of manners before any stare: the idle cues point at the true personality, more or less
// sharply by level (Friendly sees none).
export function newMemory(team, level = 0) {
  const sharp = level === 0 ? 0 : level === 1 ? 0.5 : 0.75;
  return { pers: Array.from({ length: PLAYERS }, (_, p) => PERS.map((q) => (team && sharp ? (team[p].pers === q ? sharp : (1 - sharp) / (PERS.length - 1)) : 1 / PERS.length))), seen: 0 };
}

// P(observation | the ring is in fist k) for one stare, mixed over what we believe about that player's personality.
function obsLikelihood(o, k, w) {
  const holds = handPlayer(k) === o.p, ki = KINDS.indexOf(o.kind);
  let t = 0;
  for (let q = 0; q < PERS.length; q++) {
    const pq = PERS[q];
    let v = holds ? TELL_RING[pq][ki] : TELL_EMPTY[pq][ki];
    if (o.kind === 'glance') v *= holds ? (o.side === handSide(k) ? GLANCE_TRUE[pq] : 1 - GLANCE_TRUE[pq]) : 0.5;
    t += w[q] * v;
  }
  return Math.max(t, 1e-4);
}

export function posterior(prior, open, stares, mem) {
  const post = new Array(HANDS).fill(0); let sum = 0;
  for (let k = 0; k < HANDS; k++) {
    if (open[k]) continue;
    let v = prior[k];
    for (const o of stares) v *= obsLikelihood(o, k, mem.pers[o.p]);
    post[k] = v; sum += v;
  }
  if (sum <= 0) { const n = open.filter((x) => !x).length || 1; return post.map((_, k) => (open[k] ? 0 : 1 / n)); }
  return post.map((v) => v / sum);
}

// After a round (the ring is shown) every stare becomes a labelled example: sharpen the belief about each player's personality.
export function learn(mem, stares, ring, rate = 1) {
  for (const o of stares) {
    const w = mem.pers[o.p], holds = handPlayer(ring) === o.p, ki = KINDS.indexOf(o.kind);
    let s = 0;
    const nw = w.map((wq, q) => {
      const pq = PERS[q];
      let v = holds ? TELL_RING[pq][ki] : TELL_EMPTY[pq][ki];
      if (o.kind === 'glance') v *= holds ? (o.side === handSide(ring) ? GLANCE_TRUE[pq] : 1 - GLANCE_TRUE[pq]) : 0.5;
      const x = wq * Math.pow(Math.max(v, 1e-3), rate); s += x; return x;
    });
    mem.pers[o.p] = nw.map((x) => Math.max(0.02, x / s));
    const t = mem.pers[o.p].reduce((a, b) => a + b, 0); mem.pers[o.p] = mem.pers[o.p].map((x) => x / t);
  }
  mem.seen += stares.length;
}

// The prior over where the other side hides the ring: counts of past ring fists, smoothed.
export function priorFromHistory(hist, level) {
  const habit = LEVELS[level].habit, a = habit === 0 ? 1e9 : habit === 1 ? 3 : 1.2;
  const w = Array.from({ length: HANDS }, (_, k) => (hist[k] || 0) + a);
  const t = w.reduce((x, y) => x + y, 0); return w.map((x) => x / t);
}

// Expected counters for opening m safe fists (lowest belief first) and then answering the most likely one.
export function plan(post, open, opened) {
  const closed = []; for (let k = 0; k < HANDS; k++) if (!open[k]) closed.push(k);
  const best = closed.reduce((b, k) => (post[k] > post[b] ? k : b), closed[0]);
  const others = closed.filter((k) => k !== best).sort((a, b) => post[a] - post[b]);
  const pb = post[best], evs = [];
  let risk = 0;
  for (let m = 0; m <= others.length; m++) {
    if (m > 0) risk += post[others[m - 1]];
    evs.push(-1 * risk + pb * seekScore(opened + m) - ((1 - risk) - pb));
  }
  return { best, others, evs, pb };
}

// The informativeness of a stare at player p: expected best-belief after seeing the tell.
function stareGain(post, open, stares, mem, p) {
  let exp = 0;
  const outcomes = [];
  for (const kind of KINDS) for (const side of kind === 'glance' ? [0, 1] : [0]) outcomes.push({ p, kind, side });
  for (const o of outcomes) {
    let py = 0; const np = new Array(HANDS).fill(0);
    for (let k = 0; k < HANDS; k++) { if (open[k] || post[k] === 0) continue; const v = post[k] * obsLikelihood(o, k, mem.pers[p]); np[k] = v; py += v; }
    if (py <= 0) continue;
    exp += Math.max(...np); // = py * max(posterior after) summed over outcomes
  }
  return exp;
}

const softPick = (rng, values, temp) => {
  if (temp <= 0.05) { let b = 0; for (let i = 1; i < values.length; i++) if (values[i] > values[b]) b = i; return b; }
  const mx = Math.max(...values), w = values.map((v) => Math.exp((v - mx) / temp));
  return pickWeighted(rng, w);
};

// ctx: { round (seeker's view: open, opened, stares, staresLeft), mem, hist, level, rng, team (names only, for the explanation) }
// Returns { type: 'stare'|'bat'|'bas', p|h, why, post }
export function seekerChoose(ctx) {
  const { round, mem, hist, level, rng, team } = ctx, L = LEVELS[level];
  const m = L.learn ? mem : { pers: Array.from({ length: PLAYERS }, () => PERS.map(() => 1 / PERS.length)) };
  const prior = priorFromHistory(hist || [], level);
  const post = posterior(prior, round.open, round.stares, m);
  const pct = (x) => `${Math.round(x * 100)}%`;
  if (round.staresLeft > 0) {
    const cands = []; for (let p = 0; p < PLAYERS; p++) if (!round.open[p * 2] || !round.open[p * 2 + 1]) cands.push(p);
    const gains = cands.map((p) => stareGain(post, round.open, round.stares, m, p));
    const base = Math.max(...post);
    const i = L.temp > 0.5 ? rng.int(cands.length) : softPick(rng, gains.map((g) => g * 6), L.temp * 6);
    const p = cands[i];
    const calm = gains[i] - base < 0.015;
    // when no look is worth much and the answer is clear, go on to open fists / answer instead
    if (!(calm && base > 0.5 && round.stares.length >= 1)) {
      const nm = team[p].name;
      return { type: 'stare', p, post, why: `Stare at ${nm}. A look at ${nm} is the one expected to change the odds most (${pct(Math.max(...post))} on the best fist now).` };
    }
  }
  const pl = plan(post, round.open, round.opened);
  const vals = pl.evs;
  const mStar = softPick(rng, vals, Math.max(0.04, L.temp * 1.5));
  if (mStar === 0 || pl.others.length === 0) {
    return { type: 'bas', h: pl.best, post, why: `Answer ${handName(team, pl.best)}: it is the likeliest fist at ${pct(pl.pb)}, and opening more fists is not worth the risk now.` };
  }
  const h = pl.others[0];
  return { type: 'bat', h, post, why: `Open ${handName(team, h)} (only ${pct(post[h])} likely to hold the ring). Each empty fist opened makes the answer safer and worth more.` };
}

// ---------------------------------------------------------------- the hiding side
export function hiderChoose(rng, team, level, hist) {
  const skill = LEVELS[level].hideSkill;
  const fac = skill === 0 ? { open: 1, steady: 1, jittery: 1, showman: 1 } : skill === 1 ? { open: 0.5, steady: 2, jittery: 1.2, showman: 1 } : { open: 0.35, steady: 2.6, jittery: 1.4, showman: 1.1 };
  const w = [];
  for (let h = 0; h < HANDS; h++) {
    let v = fac[team[handPlayer(h)].pers];
    if (skill > 0) v /= 1 + (hist[h] || 0) * (skill === 1 ? 0.5 : 0.9);
    w.push(v);
  }
  const ring = pickWeighted(rng, w);
  let performer = -1;
  if (skill > 0) { const o = []; for (let p = 0; p < PLAYERS; p++) if (p !== handPlayer(ring)) o.push(p); performer = o[rng.int(o.length)]; }
  return { ring, performer };
}

// A short reading of what the evidence says (used by the Hint and the round summary).
export const describeBelief = (post, team, n = 2) => {
  const idx = post.map((v, k) => [v, k]).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, n);
  return idx.map(([v, k]) => `${handName(team, k)} ${Math.round(v * 100)}%`).join(', ');
};
export { PERS_INFO, KIND_LABEL };
