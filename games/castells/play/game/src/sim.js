// Castells: the whole simulation. Pure and deterministic (no clock, no DOM, randomness only from the rng handed in).
//
// A tower is built tier by tier from the bottom: `T` trunk tiers of N castellers (baixos, segons, terços ...), then the crown:
// the dosos (two children), the acotxador and the enxaneta. Every casteller has a weight and a strength, both in kilograms.
// A tier carries everything above it, shared equally by its castellers: each one must be able to hold at least
//     load = (weight of every casteller above the tier) / (castellers in the tier).
// After the build the children climb while the tower sways; the crowd steadies it; the enxaneta crowns it and makes the aleta.
//
// Units: kg, seconds, lean x in [-1, 1] (|x| = 1 is a fall).

export const TIER_NAMES = ['Baixos', 'Segons', 'Terços', 'Quarts', 'Quints', 'Sisens'];
export const TIER_GLOSS = ['the base', 'second', 'third', 'fourth', 'fifth', 'sixth'];
export const CROWN = [
  { kind: 'dosos', n: 2, name: 'Dosos', gloss: 'the pair of children' },
  { kind: 'acotxador', n: 1, name: 'Acotxador', gloss: 'the child above the pair' },
  { kind: 'enxaneta', n: 1, name: 'Enxaneta', gloss: 'the child who crowns the tower' },
];

// The campaign: real tower names, "N de M" = N castellers per tier, M tiers in all (the last three are the crown).
// tight = how little spare strength the colla has (lower is harder); pool = number of extra people in the tray beyond the tower.
export const RECIPES = [
  { id: '3d6', n: 3, m: 6, name: '3 de 6', tight: 1.00, blurb: 'A first tower: three castellers a tier.' },
  { id: '4d6', n: 4, m: 6, name: '4 de 6', tight: 0.92, blurb: 'Wider and heavier at the base.' },
  { id: '3d7', n: 3, m: 7, name: '3 de 7', tight: 0.86, blurb: 'One tier taller: the base carries more.' },
  { id: '4d7', n: 4, m: 7, name: '4 de 7', tight: 0.78, blurb: 'Four wide and seven high.' },
  { id: '5d7', n: 5, m: 7, name: '5 de 7', tight: 0.72, blurb: 'A broad trunk of five.' },
  { id: '3d8', n: 3, m: 8, name: '3 de 8', tight: 0.66, blurb: 'Slim and very tall.' },
  { id: '4d8', n: 4, m: 8, name: '4 de 8', tight: 0.58, blurb: 'A great tower: little strength to spare.' },
  { id: '5d8', n: 5, m: 8, name: '5 de 8', tight: 0.50, blurb: 'The grandest tower of the colla.' },
];

const ADULT_NAMES = ['Pau', 'Jordi', 'Marc', 'Joan', 'Pere', 'Arnau', 'Oriol', 'Biel', 'Ramon', 'Xavi', 'Quim', 'Roc', 'Nil', 'Albert', 'Sergi', 'Dani',
  'Marta', 'Núria', 'Laia', 'Mireia', 'Jana', 'Anna', 'Júlia', 'Clara', 'Carla', 'Berta', 'Neus', 'Queralt', 'Maria', 'Eva', 'Gemma', 'Sílvia',
  'Toni', 'Lluís', 'Ferran', 'Miquel', 'Guillem', 'Àlex', 'Èric', 'Isaac'];
const KID_NAMES = ['Mia', 'Pol', 'Aina', 'Lluc', 'Noa', 'Ona', 'Roger', 'Abril', 'Max', 'Gal'];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = Math.round;

export const tierCount = (tower) => tower.tiers.length;
export const isCrown = (tier) => tier.kind !== 'trunk';

// ---- the puzzle --------------------------------------------------------------------------------------------------------
// Makes a tower: the people (with weights, strengths and looks) and the empty tiers. A hidden valid arrangement is built first and
// the strengths are cut from it, so every puzzle can be solved; the people are then shuffled into a tray.
export function makeTower(recipe, rng, opt = {}) {
  const tight = opt.tight ?? recipe.tight, hard = opt.hard ?? Math.round((1 - tight) * 8);   // hard 0..4
  let best = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const tw = drawTower(recipe, rng, tight, hard);
    if (!tw) continue;
    const sol = solve(tw, 0, 60000);
    if (!sol) continue;
    best = tw;
    // harder towers must defeat the two obvious plans: strongest first, heaviest first
    if (hard >= 1 && greedyPlan(tw, 's')) continue;
    if (hard >= 3 && greedyPlan(tw, 'w')) continue;
    return tw;
  }
  if (best) return best;
  const tw = drawTower(recipe, rng, 1, 0, true);
  return tw;
}

// The "obvious plan" a quick player would try: fill each tier with the strongest (key 's') or the heaviest (key 'w') people left.
export function greedyPlan(tw, key) {
  let pool = tw.order.slice();
  const kidsW = kidWeight(tw);
  for (let k = 0; k < tw.T; k++) {
    const pick = pool.slice().sort((a, b) => tw.people[b][key] - tw.people[a][key] || tw.people[b].s - tw.people[a].s).slice(0, tw.n);
    let remW = 0; for (const id of pool) remW += tw.people[id].w;
    let sumW = 0; for (const id of pick) sumW += tw.people[id].w;
    const load = (remW - sumW + kidsW) / tw.n;
    if (!pick.every((id) => tw.people[id].s >= load)) return false;
    pool = pool.filter((id) => !pick.includes(id));
  }
  return true;
}

function drawTower(recipe, rng, tight, hard, safe = false) {
  const N = recipe.n, M = recipe.m, T = M - 3, A = N * T;
  const people = [];
  const mk = (kid, name, w) => {
    const p = { id: people.length, kid, name, w, s: 0, skin: rng.int(5), hair: rng.int(5), hairCol: rng.int(6), h: kid ? 0.7 + rng.next() * 0.06 : 0.94 + rng.next() * 0.12, cheer: rng.next() };
    people.push(p); return p;
  };
  const names = rng.shuffle(ADULT_NAMES), knames = rng.shuffle(KID_NAMES);
  // hidden arrangement: heavier at the base, with noise so weight alone does not give the order
  const sol = [];
  let ni = 0;
  for (let k = 0; k < T; k++) {
    const mean = 80 - (T > 1 ? (k / (T - 1)) * 20 : 0), row = [];
    for (let j = 0; j < N; j++) row.push(mk(false, names[ni++ % names.length], clamp(round(mean + (rng.next() - 0.5) * 18), 50, 95)));
    sol.push(row);
  }
  // heavy decoys high in the tower: very heavy, but only as strong as their tier needs
  const heavies = safe ? 0 : Math.min(A - N, hard >= 3 ? 1 + (hard >> 2) : hard >= 1 ? 1 : 0);
  for (let i = 0; i < heavies && T >= 3; i++) { const row = sol[1 + rng.int(T - 1)]; row[rng.int(N)].w = 90 + rng.int(7); }
  const kw = [clamp(round(27 + (rng.next() - 0.5) * 6), 20, 33), clamp(round(27 + (rng.next() - 0.5) * 6), 20, 33), clamp(round(25 + (rng.next() - 0.5) * 5), 20, 31), clamp(round(22 + (rng.next() - 0.5) * 4), 18, 28)];
  const kids = kw.map((w, i) => mk(true, knames[i % knames.length], w));
  sol.push([kids[0], kids[1]], [kids[2]], [kids[3]]);
  let above = 0;
  const margin = safe ? 40 : 2 + 22 * tight * tight;
  for (let k = sol.length - 1; k >= 0; k--) {
    const row = sol[k], load = above / row.length;
    for (const p of row) {
      p.s = Math.ceil(load + 1 + rng.next() * margin);
      if (p.kid) p.s = Math.max(p.s, p.w + 2 + rng.int(10));
    }
    for (const p of row) above += p.w;
  }
  // strong-light decoys: lighter people with more strength than the base needs, tempting for a "strongest first" plan
  if (!safe && hard >= 1 && T >= 2) {
    const baseMax = Math.max(...sol[0].map((p) => p.s));
    const decoys = Math.min(N, 1 + (hard >> 1));
    for (let i = 0; i < decoys; i++) {
      const row = sol[1 + rng.int(T - 1)], p = row[rng.int(N)];
      if (p.w < 78) p.s = Math.max(p.s, baseMax + 3 + rng.int(9));
    }
  }
  const tiers = [];
  for (let k = 0; k < T; k++) tiers.push({ kind: 'trunk', n: N, name: TIER_NAMES[k], gloss: TIER_GLOSS[k], slots: Array(N).fill(-1), done: false });
  for (const c of CROWN) tiers.push({ kind: c.kind, n: c.n, name: c.name, gloss: c.gloss, slots: Array(c.n).fill(-1), done: false });
  const order = rng.shuffle(people.filter((p) => !p.kid).map((p) => p.id));
  return { n: N, m: M, T, recipe: recipe.id, people, tiers, order, kids: kids.map((k) => k.id), adults: A, hidden: sol.map((r) => r.map((p) => p.id)) };
}

const W = (tower, id) => tower.people[id].w;
const S = (tower, id) => tower.people[id].s;
export const kidWeight = (tower) => tower.kids.reduce((a, id) => a + W(tower, id), 0);

// Who is still in the tray for tier `cur`: every casteller not placed in a finished tier (trunk) or, for the crown, the four children.
export function trayFor(tower, cur) {
  const tier = tower.tiers[cur];
  const used = new Set();
  tower.tiers.forEach((t, i) => { if (i < cur) for (const id of t.slots) used.add(id); });
  const ids = isCrown(tier) ? tower.kids : tower.order;
  return ids.filter((id) => !used.has(id));
}

// The load per casteller of tier `cur` when it is full with exactly the people in `ids`.
export function loadFor(tower, cur, ids) {
  const tier = tower.tiers[cur], tray = trayFor(tower, cur);
  let remW = 0; for (const id of tray) remW += W(tower, id);
  let sel = 0; for (const id of ids) sel += W(tower, id);
  const above = isCrown(tier) ? remW - sel : remW - sel + kidWeight(tower);
  return above / tier.n;
}

// The lowest load this tier could possibly have (it would be filled with the heaviest people left) and, with the current partial
// choice, an estimate. Used to grey out people who can never hold this tier.
export function minLoad(tower, cur, ids) {
  const tier = tower.tiers[cur], tray = trayFor(tower, cur).filter((id) => !ids.includes(id));
  const need = tier.n - ids.length;
  const heavy = tray.map((id) => W(tower, id)).sort((a, b) => b - a).slice(0, Math.max(0, need));
  let sel = 0; for (const id of ids) sel += W(tower, id);
  let remW = 0; for (const id of trayFor(tower, cur)) remW += W(tower, id);
  const above = remW - sel - heavy.reduce((a, b) => a + b, 0) + (isCrown(tier) ? 0 : kidWeight(tower));
  return Math.max(0, above) / tier.n;
}

// ---- solver (the AI and the hint) --------------------------------------------------------------------------------------
// The children still unplaced are dealt to the crown tiers from index `from` (0 dosos, 1 acotxador, 2 enxaneta) so every one can hold the
// weight above. Returns one id-array per remaining crown tier, or null.
export function crownPlan(tower, from = 0) {
  const T = tower.T;
  const used = new Set();
  for (let i = T; i < T + from; i++) for (const id of tower.tiers[i].slots) used.add(id);
  const kids = tower.kids.filter((id) => !used.has(id));
  const sizes = [2, 1, 1].slice(from);
  const perm = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((v, i) => perm([...arr.slice(0, i), ...arr.slice(i + 1)]).map((r) => [v, ...r])));
  for (const order of perm(kids)) {
    let idx = 0, ok = true;
    const groups = sizes.map((n) => { const g = order.slice(idx, idx + n); idx += n; return g; });
    for (let j = 0; j < groups.length && ok; j++) {
      let above = 0;
      for (let q = j + 1; q < groups.length; q++) for (const id of groups[q]) above += tower.people[id].w;
      const load = above / groups[j].length;
      if (!groups[j].every((id) => tower.people[id].s >= load)) ok = false;
    }
    if (ok) return groups;
  }
  return null;
}

// Finds a valid arrangement for the tiers from `cur` upward, given the committed tiers below. Returns an array of id-arrays
// (one per remaining tier, in order) or null. Depth-first with a node budget and a memo of dead ends.
export function solve(tower, cur = 0, budget = 120000) {
  const tiers = tower.tiers;
  const T = tower.T, N = tower.n;
  const used = new Set();
  for (let i = 0; i < cur && i < T; i++) for (const id of tiers[i].slots) used.add(id);
  const pool = tower.order.filter((id) => !used.has(id));
  const kidsW = kidWeight(tower);
  const out = [];
  let nodes = 0;
  const dead = new Set();
  const maskOf = (list) => list.map((p) => p.id).sort((a, b) => a - b).join(',');
  const crownSolve = (from = 0) => crownPlan(tower, from);
  const rec = (k, rem) => {
    if (k >= T) { const c = crownSolve(); if (!c) return false; out.push(...c); return true; }
    if (++nodes > budget) return false;
    const key = maskOf(rem);
    if (dead.has(key)) return false;
    let remW = 0; for (const p of rem) remW += p.w;
    const list = rem.slice().sort((a, b) => b.s - a.s || b.w - a.w);
    const wDesc = rem.map((p) => p.w).sort((a, b) => b - a);
    const pick = [];
    const go = (start, got, sumW) => {
      if (got === N) {
        const load = (remW - sumW + kidsW) / N;
        if (pick.every((p) => p.s >= load)) {
          const next = rem.filter((p) => !pick.includes(p));
          out.push(pick.map((p) => p.id));
          if (rec(k + 1, next)) return true;
          out.pop();
        }
        return false;
      }
      for (let i = start; i <= list.length - (N - got); i++) {
        const p = list[i];
        // upper bound on the weight of the tier if p is the weakest member: the heaviest still reachable
        let ub = sumW + p.w, c = 0;
        for (let j = 0; j < wDesc.length && c < N - got - 1; j++) { ub += wDesc[j]; c++; }
        const lb = (remW - ub + kidsW) / N;
        if (p.s < lb) break;          // everyone after p is weaker still
        pick.push(p);
        if (go(i + 1, got + 1, sumW + p.w)) return true;
        pick.pop();
        if (nodes > budget) return false;
      }
      return false;
    };
    const ok = go(0, 0, 0);
    if (!ok && nodes <= budget) dead.add(key);
    return ok;
  };
  const start = pool.map((id) => tower.people[id]);
  if (cur >= T) return crownPlan(tower, cur - T);
  const ok = rec(cur, start);
  return ok ? out : null;
}

// Is tier `cur` valid as it stands? (full, and everyone strong enough)
export function tierCheck(tower, cur, ids) {
  const tier = tower.tiers[cur];
  const full = ids.length === tier.n && ids.every((id) => id >= 0);
  const load = full ? loadFor(tower, cur, ids) : minLoad(tower, cur, ids.filter((id) => id >= 0));
  const weak = full ? ids.filter((id) => S(tower, id) < load) : [];
  // crown: the load of the dosos depends on the two children above; the acotxador carries the enxaneta alone (the tray holds both)
  return { full, load, weak, ok: full && weak.length === 0 };
}

// After the build: how comfortable is the tower? 0 = every tier at its limit, 1 = loads of spare strength. Tight towers are shakier.
export function steadiness(tower) {
  let minRel = 9, sum = 0, cnt = 0, above = 0;
  for (let k = tower.tiers.length - 1; k >= 0; k--) {
    const t = tower.tiers[k], load = above / t.n;
    for (const id of t.slots) {
      const rel = (S(tower, id) - load) / Math.max(20, load);
      minRel = Math.min(minRel, rel); sum += Math.min(rel, 0.6); cnt++; above += W(tower, id);
    }
  }
  const mean = cnt ? sum / cnt : 0;
  return clamp(0.65 * (minRel / 0.06) + 0.35 * ((mean - 0.15) / 0.2), 0, 1);
}

// ---- the climb ---------------------------------------------------------------------------------------------------------
// One shared lean `x` with velocity `v`. The tower is an inverted pendulum: left alone the lean grows; the crowd pushes it back
// (push = -1 for the left side, +1 for the right side). Climbing, kicks at every tier boundary and a slow drift disturb it.
export const FALL = 1;
// lean zones (absolute lean): full speed below `go`, slowed below `slow`, stalled above; tension rises above `watch` and fast above `danger`
export const ZONE = { go: 0.38, slow: 0.62, watch: 0.5, danger: 0.72, calm: 0.25 };
export const ALETA_PERFECT = 0.14, ALETA_GOOD = 0.34;
export const AID = 3.2;           // acceleration the crowd can give (lean units / s^2)
const SPEED = 1 / 0.82;           // tiers per second at full speed
const UNLOAD = 1.7;
export const ALETA_SECS = 4.2;

export function newClimb(tower, rng, steady) {
  const T = tower.T;
  return {
    t: 0, phase: 'climb', g: 0, total: 3 * T + 3, T, steady, x: 0, v: 0, tension: 0, peak: 0, calm: 0, wobble: 0, kick: 0, lastH: 0,
    ph: [rng.next() * 6.28, rng.next() * 6.28, rng.next() * 6.28], seedA: rng.next(), aletaT: 0, aleta: '', fall: '', done: false, push: 0,
    events: [], evN: 0, climber: 0, height: 0,
  };
}

// climber index (0 dosos pair, 1 acotxador, 2 enxaneta) and its height in tiers for the progress `g`
export function climberAt(T, g) {
  const L0 = T, L1 = T + 1, L2 = T + 2;
  if (g < L0) return { c: 0, h: g };
  if (g < L0 + L1) return { c: 1, h: g - L0 };
  return { c: 2, h: Math.min(L2, g - L0 - L1) };
}

const ev = (c, e) => { e.seq = c.evN++; c.events.push(e); if (c.events.length > 24) c.events.shift(); };

// One step. `push` in {-1, 0, 1}; `rng` supplies the kicks.
export function stepClimb(c, tower, dt, push, rng) {
  if (c.done) return;
  c.t += dt;
  const T = c.T, steady = c.steady, unloading = c.phase === 'unload';
  const cl = climberAt(T, Math.min(c.g, c.total - 1e-6));
  c.climber = cl.c;
  if (c.phase === 'climb') c.height = cl.h;
  // instability grows with height and shrinks with a steadier build
  const hNow = c.phase === 'climb' ? cl.h + cl.c * 0.5 : T + 2;
  const lambda = (0.7 + 0.22 * hNow) * (1.25 - 0.65 * steady) * (unloading ? 0.8 : 1);
  const drift = 2.2 * (0.2 + 0.03 * T) * (1.2 - 0.6 * steady) * (Math.sin(c.t * 1.31 + c.ph[0]) * 0.6 + Math.sin(c.t * 2.77 + c.ph[1]) * 0.4);
  const force = lambda * c.x + drift * 0.55 - 0.9 * c.v + push * AID;
  c.v += force * dt;
  c.x += c.v * dt;
  c.push = push;
  const ax = Math.abs(c.x);
  c.peak = Math.max(c.peak, ax);
  // tension builds when the lean is large and drains when the tower is calm
  if (ax > ZONE.danger) c.tension += 0.62 * dt; else if (ax > ZONE.watch) c.tension += 0.14 * dt; else c.tension = Math.max(0, c.tension - (ax < 0.3 ? 0.3 : 0.12) * dt);
  c.wobble = ax > ZONE.watch ? 1 : 0;
  if (ax < ZONE.calm) c.calm += dt;
  if (ax >= FALL || c.tension >= 1) {
    c.done = true; c.phase = 'fell'; c.fall = ax >= FALL ? 'The tower leaned too far.' : 'The crowd could not hold it any longer.';
    ev(c, { type: 'fall', x: c.x });
    return;
  }
  const rate = ax < ZONE.go ? 1 : ax < ZONE.slow ? 0.4 : 0.0;
  if (c.phase === 'climb') {
    const g0 = c.g;
    c.g = Math.min(c.total, c.g + SPEED * dt * rate);
    const before = climberAt(T, g0), after = climberAt(T, Math.min(c.g, c.total - 1e-6));
    if (before.c === after.c) {
      if (Math.floor(after.h) > Math.floor(before.h)) kick(c, tower, after.c, after.h, rng, 1);
    } else ev(c, { type: 'next', c: after.c });
    if (c.g >= c.total) {
      c.phase = 'aleta'; c.aletaT = 0; c.g = c.total; c.height = T + 2;
      ev(c, { type: 'crowned' });
    }
  } else if (c.phase === 'aleta') {
    c.aletaT += dt;
    if (c.aletaT >= ALETA_SECS && !c.aleta) doAleta(c, true);
  } else if (unloading) {
    const g0 = c.g;
    c.g = Math.max(0, c.g - SPEED * UNLOAD * dt * Math.max(0.35, rate));
    if (Math.floor(g0) > Math.floor(c.g)) kick(c, tower, 1, g0 / c.total * (T + 2), rng, 0.55);
    c.height = Math.min(T + 2, c.g * (T + 2) / c.total);
    if (c.g <= 0) { c.done = true; c.phase = 'done'; ev(c, { type: 'unloaded' }); }
  }
}

function kick(c, tower, who, h, rng, scale) {
  const w = who === 0 ? tower.people[tower.kids[0]].w : who === 1 ? tower.people[tower.kids[2]].w : tower.people[tower.kids[3]].w;
  const mag = 2.2 * (0.07 + 0.02 * h) * (w / 26) * (1.3 - 0.6 * c.steady) * scale;
  const sgn = rng.chance(0.5) ? 1 : -1;
  c.v += sgn * mag * 2.2;
  c.kick = sgn * mag;
  ev(c, { type: 'kick', who, h, dir: sgn });
}

// The enxaneta makes the aleta: perfect when the tower is nearly still, good when steady, shaky otherwise.
export function doAleta(c, late = false) {
  if (c.phase !== 'aleta' || c.aleta) return false;
  const a = Math.abs(c.x) + Math.abs(c.v) * 0.25;
  c.aleta = late ? 'late' : a < ALETA_PERFECT ? 'perfect' : a < ALETA_GOOD ? 'good' : 'shaky';
  ev(c, { type: 'aleta', q: c.aleta });
  c.phase = 'unload'; c.height = c.T + 2;
  return true;
}


// The result of a finished climb: stars 0 (fell before the aleta), 1 (loaded), 2 (unloaded), 3 (unloaded, perfect aleta, never in the red)
export function resultOf(c, hints = 0) {
  const crowned = c.phase === 'unload' || c.phase === 'done' || (c.phase === 'fell' && !!c.aleta);
  const unloaded = c.phase === 'done';
  let stars = 0;
  if (unloaded) stars = 2; else if (crowned) stars = 1;
  if (unloaded && c.aleta === 'perfect' && c.peak < 0.72 && !hints) stars = 3;
  const word = unloaded ? 'Castell descarregat' : crowned ? 'Castell carregat' : 'Intent desmuntat';
  const gloss = unloaded ? 'Crowned and taken down safely.' : crowned ? 'Crowned, but it came down during the descent.' : 'The attempt fell before the crown.';
  return { stars, word, gloss, crowned, unloaded, peak: c.peak, aleta: c.aleta, calm: c.calm, time: c.t };
}

// What a good crowd does right now: the push to give (-1, 0, +1). A predictive controller on lean and velocity.
export function advice(c) {
  const p = c.x + 0.5 * c.v;
  if (Math.abs(p) < 0.05) return 0;
  return p > 0 ? -1 : 1;
}
