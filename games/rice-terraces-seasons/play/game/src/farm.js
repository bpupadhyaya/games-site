// The hillside simulation: water flowing through gates, soil, rice, weather, pests, walls, labour and neighbours. Pure and deterministic;
// the state is plain JSON (so the planner can clone it) and every random choice comes from the state's own seed `rs`.
//
// Water is measured in "hands" per plot (0 = dry mud, 4 = brim full). A season is a phase of the year; each phase wants a different band of water.
import { SEASONS, levelById, gateList } from './levels.js';

export const CAP = 4;
export const STEP = 0.1;                 // seconds per internal simulation step
export const JOB_COST = { plant: 1, tend: 1, pests: 1, harvest: 1, repair: 2 };
export const JOB_TIME = { plant: 4.6, tend: 4.0, pests: 4.2, harvest: 5.0, repair: 6.4 };
export const JOB_NAME = { plant: 'Plant', tend: 'Weed', pests: 'Clear snails', harvest: 'Harvest', repair: 'Repair wall' };
export const CROP = { FALLOW: 0, SEEDLING: 1, GROWING: 2, GOLD: 3, DONE: 4, LOST: 5 };

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function rnd(f) { f.rs = (Math.imul(f.rs, 1664525) + 1013904223) >>> 0; return f.rs / 4294967296; }

export function createFarm(levelId, opts = {}) {
  const lv = levelById(levelId);
  const n = lv.R * lv.C;
  const f = {
    lv: lv.id, rs: (lv.seed * 2654435761 + (opts.seed | 0)) >>> 0, t: 0, ph: 'intro', season: 0, st: 0, evId: 0, events: [],
    plots: [], feed: [], down: [], side: [], blockedSet: lv.blocked.slice(),
    lab: lv.lab0, labCap: 6, lr: lv.lr * (1 + 0.04 * (opts.village | 0)), farmers: lv.farmers + ((opts.village | 0) >= 6 ? 1 : 0),
    weather: { kind: 'clear', left: 0 }, wxDone: [], pestDone: [], spring: lv.spring, springNow: lv.spring,
    released: 0, wasted: 0, supplied: 0, flows: { d: {}, s: {}, f: {} }, jobs: [], day: 0, workDay: 0,
    score: null, hand: 0,
  };
  for (let i = 0; i < n; i++) {
    f.plots.push({ w: 0.15, soil: 0, crop: CROP.FALLOW, prog: 0, gold: 0, h: 1, weed: 0, pest: 0, wall: clamp(lv.wallBase - 0.25 * rnd(f), 0.35, 1), job: null, owner: lv.owners[i] || 0, npcT: 3 + rnd(f) * 10, dmg: 0, harvested: 0, wet: 0 });
  }
  for (const g of gateList(lv)) {
    const blocked = lv.blocked.includes(g.id);
    const arr = g.kind === 'f' ? f.feed : g.kind === 'd' ? f.down : f.side;
    arr.push(blocked ? -1 : 0);
  }
  // gates are stored in the arrays in gateList order per kind; the index of a gate inside its array:
  return f;
}

// ---- gate access ---------------------------------------------------------------------------------------------------------------------------
export const feedIdx = (c) => c;
export const downIdx = (lv, r, c) => r * lv.C + c;
export const sideIdx = (lv, r, c) => r * (lv.C - 1) + c;
export function gateState(f, g) {
  const lv = levelById(f.lv);
  return g.kind === 'f' ? f.feed[feedIdx(g.c)] : g.kind === 'd' ? f.down[downIdx(lv, g.r, g.c)] : f.side[sideIdx(lv, g.r, g.c)];
}
export function setGate(f, g, v) {
  const lv = levelById(f.lv);
  const arr = g.kind === 'f' ? f.feed : g.kind === 'd' ? f.down : f.side;
  const i = g.kind === 'f' ? feedIdx(g.c) : g.kind === 'd' ? downIdx(lv, g.r, g.c) : sideIdx(lv, g.r, g.c);
  if (arr[i] === -1) return false;
  arr[i] = v ? 1 : 0;
  return true;
}
export function toggleGate(f, g) {
  const cur = gateState(f, g);
  if (cur === -1) return false;
  setGate(f, g, !cur);
  emit(f, { type: 'gate', id: g.id, open: !cur });
  return true;
}

function emit(f, e) { f.evId++; e.id = f.evId; e.t = f.t; f.events.push(e); if (f.events.length > 80) f.events.splice(0, f.events.length - 80); }

// ---- the water each phase wants -------------------------------------------------------------------------------------------------------------
// Returns the band [lo, hi] a plot wants right now, or null when the water does not matter for it.
export function bandFor(f, i) {
  const p = f.plots[i];
  if (p.crop === CROP.DONE || p.crop === CROP.LOST) return null;
  if (f.season === 0) return p.soil >= 1 ? [1.5, 3.6] : [2.5, 3.6];
  if (f.season === 1) return p.crop === CROP.FALLOW ? [2.0, 3.6] : [1.5, 3.0];
  if (f.season === 2) return p.crop === CROP.FALLOW ? null : [1.5, 3.0];
  if (p.crop === CROP.FALLOW) return null;
  return p.gold >= 1 ? null : [0, 1.0];
}
export const bandDev = (b, w) => (!b ? 0 : w < b[0] ? b[0] - w : w > b[1] ? w - b[1] : 0);

// ---- jobs ----------------------------------------------------------------------------------------------------------------------------------
export function jobsFor(f, i) {
  const p = f.plots[i], out = [];
  if (p.job) return out;
  if (f.ph !== 'run') return out;
  if (p.owner) { if (p.wall < 0.5) out.push('repair'); return out; }
  if (p.crop === CROP.FALLOW && f.season === 1 && p.soil >= 0.7) out.push('plant');
  if ((p.crop === CROP.SEEDLING || p.crop === CROP.GROWING) && p.weed >= 0.35) out.push('tend');
  if ((p.crop === CROP.SEEDLING || p.crop === CROP.GROWING) && p.pest >= 0.35) out.push('pests');
  if (p.crop === CROP.GOLD && p.gold >= 1) out.push('harvest');
  if (p.wall < 0.6) out.push('repair');
  return out;
}
export function jobCost(f, i, type) { return type === 'repair' && f.plots[i].wall <= 0 ? 3 : JOB_COST[type]; }
export function canJob(f, i, type) {
  const p = f.plots[i];
  if (!jobsFor(f, i).includes(type)) return { ok: false, why: p.job ? 'busy' : 'not now' };
  if (type === 'plant' && p.w < 1) return { ok: false, why: 'too dry to plant (needs water of 1 or more)' };
  if (f.jobs.length >= f.farmers) return { ok: false, why: 'all farmers busy' };
  if (f.lab < jobCost(f, i, type)) return { ok: false, why: 'not enough labour' };
  return { ok: true, why: '' };
}
export function startJob(f, i, type) {
  const c = canJob(f, i, type);
  if (!c.ok) return c;
  const p = f.plots[i];
  f.lab -= jobCost(f, i, type);
  p.job = { type, left: JOB_TIME[type], total: JOB_TIME[type], by: 0 };
  f.jobs.push(i);
  emit(f, { type: 'job', plot: i, job: type });
  return c;
}
function finishJob(f, i) {
  const p = f.plots[i], j = p.job;
  p.job = null; f.jobs = f.jobs.filter((x) => x !== i);
  if (!j) return;
  if (j.type === 'plant') { p.crop = CROP.SEEDLING; p.prog = 0; p.h = Math.max(p.h, 0.9); p.weed = 0; emit(f, { type: 'planted', plot: i }); }
  else if (j.type === 'tend') { p.weed = 0; p.h = Math.min(1, p.h + 0.06); emit(f, { type: 'tended', plot: i }); }
  else if (j.type === 'pests') { p.pest = 0; emit(f, { type: 'cleared', plot: i }); }
  else if (j.type === 'harvest') { p.crop = CROP.DONE; p.harvested = p.h; emit(f, { type: 'harvested', plot: i, yield: p.h }); }
  else if (j.type === 'repair') { p.wall = Math.min(1, p.wall + 0.6); emit(f, { type: 'repaired', plot: i }); }
}

// ---- weather ---------------------------------------------------------------------------------------------------------------------------------
function weatherAt(f, lv) {
  // events are scheduled by seconds from the start of the year
  const yt = yearTime(f);
  const w = f.weather;
  if (w.left > 0) { w.left -= STEP; if (w.left <= 0) { w.kind = 'clear'; w.left = 0; emit(f, { type: 'weather', kind: 'clear' }); } }
  lv.weather.forEach((e, k) => {
    if (!f.wxDone.includes(k) && yt >= e.t) {
      f.wxDone.push(k); w.kind = e.kind; w.left = e.dur;
      emit(f, { type: 'weather', kind: e.kind, dur: e.dur });
      if (e.kind === 'storm') stormHits(f, lv);
    }
  });
  lv.pests.forEach((e, k) => {
    if (!f.pestDone.includes(k) && yt >= e.t) {
      f.pestDone.push(k);
      const p = f.plots[e.plot];
      if (p) { p.pest = Math.min(1, p.pest + 0.65); emit(f, { type: 'pestwave', plot: e.plot }); }
    }
  });
}
export const yearTime = (f) => { let t = f.st; for (let s = 0; s < f.season; s++) t += SEASONS[s].len; return t; };
export const yearLength = () => SEASONS.reduce((a, s) => a + s.len, 0);
function stormHits(f, lv) {
  for (let i = 0; i < f.plots.length; i++) {
    if (rnd(f) < 0.55) {
      const p = f.plots[i], dmg = 0.14 + 0.32 * rnd(f);
      const before = p.wall;
      p.wall = Math.max(0, p.wall - dmg);
      if (before > 0 && p.wall <= 0.0001) { p.wall = 0; emit(f, { type: 'collapse', plot: i }); } else emit(f, { type: 'crack', plot: i });
    }
  }
}

// ---- one internal step -----------------------------------------------------------------------------------------------------------------------
function step(f, lv) {
  const dt = STEP, R = lv.R, C = lv.C, P = f.plots;
  weatherAt(f, lv);
  const wk = f.weather.kind;
  // spring
  const sp = lv.spring * (wk === 'dry' ? 0.5 : wk === 'rain' ? 1.35 : wk === 'storm' ? 1.5 : 1);
  f.springNow = sp;
  const open = []; for (let c = 0; c < C; c++) if (f.feed[c] === 1) open.push(c);
  const add = new Array(P.length).fill(0);
  const flows = { d: {}, s: {}, f: {} };
  if (open.length) { const q = sp * dt / open.length; for (const c of open) { add[c] += q; flows.f[`f${c}`] = q / dt; } f.supplied += sp * dt; }
  else f.wasted += sp * dt;
  // rain
  const rain = wk === 'rain' ? 0.12 : wk === 'storm' ? 0.28 : 0;
  // gravity: water falls through open spill gates
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const i = r * C + c, p = P[i];
    if (f.down[i] === 1) {
      let q = 0.55 * Math.max(0, p.w - 0.12) * dt;
      if (r < R - 1) { const low = P[i + C]; q = Math.min(q, Math.max(0, CAP + 0.5 - low.w)); add[i + C] += q; }
      else f.released += q;
      add[i] -= q; flows.d[`d${r}_${c}`] = q / dt;
    }
    // a collapsed wall lets the plot empty down the slope
    if (p.wall <= 0 && p.w > 0) {
      const q = Math.min(p.w, 1.3 * dt);
      add[i] -= q;
      if (r < R - 1) add[i + C] += q; else f.wasted += q;
    }
    // seepage through a weak wall
    const seep = (1 - p.wall) * 0.07 * p.w * dt;
    if (seep > 0 && p.wall > 0) { add[i] -= seep; if (r < R - 1) add[i + C] += seep * 0.8; else f.wasted += seep; }
  }
  // side channels level two plots of a tier
  for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) {
    if (f.side[r * (C - 1) + c] === 1) {
      const a = r * C + c, b = a + 1;
      const q = clamp(0.5 * (P[a].w - P[b].w) * dt, -0.9 * dt * 2, 0.9 * dt * 2);
      add[a] -= q; add[b] += q; flows.s[`s${r}_${c}`] = q / dt;
    }
  }
  const evap = (wk === 'dry' ? 0.05 : wk === 'rain' || wk === 'storm' ? 0.004 : 0.016) * dt;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    p.w = Math.max(0, p.w + add[i] + rain * dt - Math.min(p.w, evap));
    if (p.w > CAP) {
      const ex = p.w - CAP; p.w = CAP;
      const r = Math.floor(i / C);
      if (f.down[i] !== 1) {
        // brimming over a closed gate: the water goes over the wall and wears it
        p.wall = Math.max(0, p.wall - 0.012 * ex * 4);
        if (r < R - 1) P[i + C].w = Math.min(CAP + 0.5, P[i + C].w + ex * 0.6); else f.wasted += ex;
        p.wet = 1;
        if (p.wall <= 0.0001 && p.wall !== 0) p.wall = 0;
      } else if (r < R - 1) P[i + C].w = Math.min(CAP + 0.5, P[i + C].w + ex); else f.released += ex;
    }
    if (p.wet > 0) p.wet = Math.max(0, p.wet - dt);
    if (wk === 'storm') p.wall = Math.max(0, p.wall - 0.0008 * dt * 10 * (1 - 0.4 * p.wall));
  }
  f.flows = flows;
  // soil, crop, pests
  for (let i = 0; i < P.length; i++) {
    const p = P[i], b = bandFor(f, i), dev = bandDev(b, p.w);
    if (f.season === 0 && p.soil < 1 && p.w >= 2.4 && p.w <= 3.7) p.soil = Math.min(1, p.soil + dt / 20);
    if (f.season === 0 && p.soil < 1 && p.w < 1) p.soil = Math.max(0, p.soil - dt / 90);
    if (p.crop === CROP.SEEDLING || p.crop === CROP.GROWING) {
      p.h += dt * (dev === 0 ? 0.01 : -0.04 * dev);
      if (p.w < 0.25) p.h -= 0.06 * dt;
      p.h -= dt * (0.014 * p.pest + 0.009 * p.weed);
      p.weed = Math.min(1, p.weed + dt * 0.011);
      const warm = p.w > 0.4 && p.w < 2.4 ? 1 : 0.3;
      p.pest = p.pest > 0 || f.season >= 2 ? Math.min(1, p.pest + dt * 0.006 * warm * (wk === 'dry' ? 1.6 : 1)) : p.pest;
      if (p.w > 3.2) p.pest = Math.max(0, p.pest - dt * 0.05);
      p.prog = Math.min(1, p.prog + dt / 55 * clamp(p.h + 0.2, 0.3, 1));
      if (p.prog >= 0.3 && p.crop === CROP.SEEDLING) p.crop = CROP.GROWING;
      if (p.h <= 0) { p.crop = CROP.LOST; p.h = 0; emit(f, { type: 'lost', plot: i }); }
      if (f.season === 3 && p.prog >= 1 && p.crop !== CROP.LOST) p.crop = CROP.GOLD;
    }
    if (p.crop === CROP.GOLD) {
      if (p.w <= 1.2) p.gold = Math.min(1, p.gold + dt / 16); else p.h = Math.max(0, p.h - 0.003 * dt * (p.w - 1.2));
      if (wk === 'rain' || wk === 'storm') p.h = Math.max(0, p.h - 0.004 * dt);
    }
    p.h = clamp(p.h, 0, 1);
    // neighbours do their own planting, weeding and harvest
    if (p.owner && f.ph === 'run') npc(f, i, p);
    if (p.job) { p.job.left -= dt; if (p.job.left <= 0) finishJob(f, i); }
  }
  // labour and the community
  f.lab = Math.min(f.labCap, f.lab + f.lr * dt);
}

function npc(f, i, p) {
  p.npcT -= STEP;
  if (p.npcT > 0 || p.job) return;
  if (p.crop === CROP.FALLOW && f.season === 1 && p.soil >= 0.7 && p.w >= 1) { p.job = { type: 'plant', left: JOB_TIME.plant, total: JOB_TIME.plant, by: 1 }; p.npcT = 4 + rnd(f) * 12; }
  else if ((p.crop === CROP.SEEDLING || p.crop === CROP.GROWING) && p.weed >= 0.5) { p.job = { type: 'tend', left: JOB_TIME.tend, total: JOB_TIME.tend, by: 1 }; p.npcT = 10 + rnd(f) * 8; }
  else if ((p.crop === CROP.SEEDLING || p.crop === CROP.GROWING) && p.pest >= 0.5) { p.job = { type: 'pests', left: JOB_TIME.pests, total: JOB_TIME.pests, by: 1 }; p.npcT = 10 + rnd(f) * 8; }
  else if (p.crop === CROP.GOLD && p.gold >= 1) { p.job = { type: 'harvest', left: JOB_TIME.harvest, total: JOB_TIME.harvest, by: 1 }; p.npcT = 6 + rnd(f) * 6; }
  else p.npcT = 1.5;
  if (p.job) emit(f, { type: 'job', plot: i, job: p.job.type, by: 1 });
}

// ---- the clock -------------------------------------------------------------------------------------------------------------------------------
export function startYear(f) {
  if (f.ph !== 'intro') return;
  f.ph = 'run'; beginSeason(f);
}
function beginSeason(f) {
  const lv = levelById(f.lv);
  f.st = 0;
  emit(f, { type: 'season', season: f.season });
  if (lv.workDay) {
    f.lab = Math.min(f.labCap + 2, f.lab + 3);
    for (const p of f.plots) if (p.wall > 0) p.wall = Math.min(1, p.wall + 0.12);
    f.workDay++; emit(f, { type: 'workday' });
  }
}
export function continueFromCard(f) {
  if (f.ph !== 'card') return;
  f.ph = 'run'; beginSeason(f);
}
export function update(f, dt) {
  if (f.ph !== 'run') return;
  const lv = levelById(f.lv);
  f.acc = (f.acc || 0) + dt;
  let guard = 0;
  while (f.acc >= STEP - 1e-9 && f.ph === 'run' && guard++ < 400) {
    f.acc -= STEP;
    step(f, lv);
    f.t += STEP; f.st += STEP;
    if (f.st >= SEASONS[f.season].len) {
      if (f.season < 3) { f.season++; f.ph = 'card'; emit(f, { type: 'card', season: f.season }); f.acc = 0; }
      else { endYear(f, lv); }
    }
  }
}
function endYear(f, lv) {
  f.ph = 'end';
  for (const p of f.plots) { if (p.job) p.job = null; if (p.crop === CROP.GOLD || p.crop === CROP.GROWING || p.crop === CROP.SEEDLING) p.crop = CROP.LOST; }
  f.jobs = [];
  f.score = scoreOf(f, lv);
  emit(f, { type: 'end' });
}
export function scoreOf(f, lv = levelById(f.lv)) {
  const mine = f.plots.filter((p) => !p.owner), theirs = f.plots.filter((p) => p.owner);
  const yieldMine = mine.length ? mine.reduce((a, p) => a + p.harvested, 0) / mine.length : 1;
  const shared = theirs.length ? theirs.reduce((a, p) => a + p.harvested, 0) / theirs.length : null;
  const valley = lv.valleyNeed > 0 ? clamp(f.released / lv.valleyNeed, 0, 1) : null;
  const walls = f.plots.reduce((a, p) => a + p.wall, 0) / f.plots.length;
  const parts = [[yieldMine, 0.5]];
  if (shared !== null) parts.push([shared, 0.2]);
  if (valley !== null) parts.push([valley, 0.12]);
  parts.push([walls, 0.18]);
  const wsum = parts.reduce((a, x) => a + x[1], 0);
  const total = parts.reduce((a, x) => a + x[0] * x[1], 0) / wsum;
  const stars = total >= 0.85 ? 3 : total >= 0.68 ? 2 : total >= 0.45 ? 1 : 0;
  return { yield: yieldMine, shared, valley, walls, total, stars, harvest: Math.round(f.plots.reduce((a, p) => a + p.harvested, 0) * 100) };
}
// live preview of the same score while the year runs (the HUD shows it)
export function liveScore(f) {
  const lv = levelById(f.lv);
  const s = scoreOf(f, lv);
  return s;
}
export function snapshot(f) { const c = JSON.parse(JSON.stringify(f)); c.events = []; return c; }
