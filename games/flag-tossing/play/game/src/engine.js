// Flag Tossing: the rules engine. Pure and deterministic: no DOM, no clock; time is the dt handed to stepShow.
//
// Time is counted in BEATS of the drum. A figure is a short routine: throws you must make (a release beat, a height in beats of air and a
// target bearer), flags that partners throw to you, or a wave. Input arrives from game.js already normalised:
//   throwFlag(show, nAir, nAim)  nAir 0..1 = how long the drag was (height), nAim = sideways landing offset as a fraction of stage width.
//   catchFlag(show, beat)        a tap, with the beat at which the finger went down.
//   trackWave(show, nx, down)    the pointer's side-to-side position, -1..1 (stage centre = 0), for wave figures.
// Events for the view and the sound go to show.ev (the game empties it every tick).

export const TUNE = {
  bpm0: 72, bpmStep: 6, bpmMax: 120,
  figsPerAct: 6, maxDrops: 3, countIn: 2, tail: 1.5,
  airMin: 1, airMax: 5,
  relPerfect: 0.14, relGood: 0.3, relWindow: 0.75,          // beats, release time against the scheduled beat
  airPerfect: 0.25, airGood: 0.5,                           // beats, flight time against the figure's height
  aimPerfect: 0.07, aimGood: 0.14, aimReach: 0.2,           // fraction of the stage width; beyond aimReach nobody can reach the flag
  aimGain: 1.4,                                             // sideways finger travel x gain = landing offset
  catchPerfect: 0.16, catchGood: 0.32,                      // beats, tap against the landing
  waveAmp: 0.5, waveGood: 0.3, wavePerfect: 0.14,
  pts: { perfect: 100, good: 60, off: 20 },
  catchPts: { perfect: 120, good: 70 },
  wavePts: { perfect: 90, good: 55 },
  partnerCatch: 40, cleanFig: 150, cleanAct: 400,
  flowStep: 4, maxMult: 5,
  thinkSeconds: 4, thinkScale: 0.55, thinkCooldown: 12,
};

export const ENS = {
  1: { xs: [0.5], you: 0, roles: { self: 0, partner: 0, left: 0, right: 0 }, name: 'Solo' },
  2: { xs: [0.3, 0.7], you: 0, roles: { self: 0, partner: 1, left: 1, right: 1 }, name: 'Pair' },
  3: { xs: [0.2, 0.5, 0.8], you: 1, roles: { self: 1, partner: 2, left: 0, right: 2 }, name: 'Team' },
};

// Figure library. throws: you throw (off = beats after the figure's first beat, air = beats in the air, to = who catches).
// incoming: a partner throws to you (from = who).  wave: n swings, one per beat, alternating sides.
export const FIGS = {
  toss2: { name: 'Low Toss', ens: 1, throws: [{ off: 0, air: 2, to: 'self' }], tip: 'One flag, two beats in the air. A short, quick drag.' },
  toss3: { name: 'Single Toss', ens: 1, throws: [{ off: 0, air: 3, to: 'self' }], tip: 'One flag, three beats in the air. A drag of middle length.' },
  toss4: { name: 'High Toss', ens: 1, throws: [{ off: 0, air: 4, to: 'self' }], tip: 'One flag, four beats up. A long drag, then wait for it.' },
  twin: { name: 'Twin Toss', ens: 1, throws: [{ off: 0, air: 3, to: 'self' }, { off: 1, air: 3, to: 'self' }], tip: 'Two flags, a beat apart. Catch them in the order they fall.' },
  stagger: { name: 'Staggered Twin', ens: 1, throws: [{ off: 0, air: 4, to: 'self' }, { off: 1, air: 2, to: 'self' }], tip: 'A high flag, then a low one that lands first. Two catches in a row.' },
  cascade: { name: 'Cascade', ens: 1, throws: [{ off: 0, air: 4, to: 'self' }, { off: 2, air: 3, to: 'self' }, { off: 4, air: 2, to: 'self' }], tip: 'Three flags, each lower than the last. They land one beat apart.' },
  wave: { name: 'Flag Wave', ens: 1, wave: 4, tip: 'Hold the flag and sweep it to the marked side on each beat.' },
  cross: { name: 'Crossing Exchange', ens: 2, throws: [{ off: 0, air: 3, to: 'partner' }], incoming: [{ off: 0, air: 3, from: 'partner' }], tip: 'Throw to your partner while theirs comes to you. Aim, then catch.' },
  relay: { name: 'Relay', ens: 3, throws: [{ off: 0, air: 3, to: 'right' }], incoming: [{ off: 1, air: 3, from: 'left' }], tip: 'Pass to the bearer on the right; the one on the left passes to you.' },
  fan: { name: 'Fan Pass', ens: 3, throws: [{ off: 0, air: 3, to: 'left' }, { off: 1, air: 3, to: 'right' }], tip: 'Pass left, then right. Steer each flag with a sideways drag.' },
};
export const FIG_ORDER = ['toss2', 'toss3', 'toss4', 'twin', 'stagger', 'cascade', 'wave', 'cross', 'relay', 'fan'];

const ACT_PLAN = {
  1: ['toss3', 'toss2', 'twin', 'wave', 'toss4', 'stagger'],
  2: ['toss3', 'cross', 'twin', 'wave', 'cross', 'stagger'],
  3: ['toss3', 'relay', 'fan', 'wave', 'cross', 'cascade'],
};
export const ensFor = (act) => Math.min(3, act);
export const bpmFor = (act) => Math.min(TUNE.bpmMax, TUNE.bpm0 + TUNE.bpmStep * (act - 1));
export const SPEEDS = [{ name: 'Gentle', bpm: 66 }, { name: 'Steady', bpm: 78 }, { name: 'Lively', bpm: 90 }, { name: 'Fast', bpm: 104 }, { name: 'Fiery', bpm: 120 }];
export const PRACTICE_FIGS = ['mixed', ...FIG_ORDER];
export const figName = (id) => (id === 'mixed' ? 'Mixed' : FIGS[id].name);
export const figLen = (spec) => {
  const ev = [...(spec.throws ?? []).map((t) => t.off + t.air), ...(spec.incoming ?? []).map((t) => t.off + t.air), spec.wave ? spec.wave - 0.5 : 0];
  return Math.ceil(TUNE.countIn + Math.max(...ev) + TUNE.tail);
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const grade3 = (e, p, g) => (Math.abs(e) <= p ? 'perfect' : Math.abs(e) <= g ? 'good' : 'off');
const RANK = { perfect: 2, good: 1, off: 0 };
const worst = (...gs) => gs.reduce((a, g) => (RANK[g] < RANK[a] ? g : a));
export const multFor = (flow) => Math.min(TUNE.maxMult, 1 + Math.floor(flow / TUNE.flowStep));
export const airOf = (nAir) => TUNE.airMin + (TUNE.airMax - TUNE.airMin) * clamp(nAir, 0, 1);
export const nAirOf = (air) => (air - TUNE.airMin) / (TUNE.airMax - TUNE.airMin);
export const slotOf = (show, role) => ENS[show.ens].roles[role];
export const xOf = (show, slot) => ENS[show.ens].xs[slot];
export const youOf = (show) => ENS[show.ens].you;

export function createShow(rng, o = {}) {
  const mode = o.mode ?? 'perform', act = o.act ?? 1;
  const show = {
    mode, t: 0, b: 0, lastBeat: -1, act, actFig: 0, figsDone: 0, ens: o.ens ?? ensFor(act), bpm: o.bpm ?? bpmFor(act),
    practiceFig: o.fig ?? null, plan: o.plan ?? null, fig: null, flags: [], nextId: 1,
    score: 0, flow: 0, maxFlow: 0, drops: 0, over: false, cleanActs: 0, actClean: true, throws: 0, catches: 0,
    counts: { perfect: 0, good: 0, off: 0, miss: 0, pcatch: 0 }, thinkCool: 0,
    cursor: 0, cursorDown: false, ev: [],
  };
  startFigure(show, pickFigure(show, rng), 0);
  return show;
}

function pickFigure(show, rng) {
  if (show.mode === 'practice') {
    const valid = FIG_ORDER.filter((id) => FIGS[id].ens <= show.ens);
    if (show.practiceFig && show.practiceFig !== 'mixed') return show.practiceFig;
    let id; let n = 0;
    do { id = rng.pick(valid); n += 1; } while (show.fig && id === show.fig.id && n < 6);
    return id;
  }
  if (show.plan) { const p = show.plan[show.figsDone % show.plan.length]; show.ens = p.ens; return p.id; }
  const plan = ACT_PLAN[show.act];
  if (plan) return plan[show.actFig];
  const valid = FIG_ORDER.filter((id) => FIGS[id].ens <= 3);
  let id; let n = 0;
  do { id = rng.pick(valid); n += 1; } while (show.fig && id === show.fig.id && n < 6);
  return id;
}

function startFigure(show, id, startBeat) {
  const spec = FIGS[id], s0 = startBeat + TUNE.countIn;
  const f = {
    id, spec, start: startBeat, ev0: s0, end: startBeat + figLen(spec), clean: true, misses: 0, mirrors: [],
    throws: (spec.throws ?? []).map((t) => ({ ...t, relB: s0 + t.off, state: 'wait', grade: null })),
    incoming: (spec.incoming ?? []).map((t) => ({ ...t, relB: s0 + t.off, state: 'wait' })),
    waves: spec.wave ? Array.from({ length: spec.wave }, (_, k) => ({ b: s0 + k, side: k % 2 ? 1 : -1, state: 'wait', peak: -1, cross: null, grade: null })) : [],
  };
  if (show.ens > 1) for (const t of f.throws) if (t.to === 'self') f.mirrors.push({ relB: t.relB, air: t.air, state: 'wait' });
  show.fig = f;
  show.ev.push({ k: 'figure', id, name: spec.name, tip: spec.tip, act: show.act, fig: show.actFig });
}

const bump = (show, grade) => {
  if (grade === 'perfect') { show.flow += 1; show.maxFlow = Math.max(show.maxFlow, show.flow); }
  else if (grade === 'off') show.flow = 0;
};
function award(show, base, grade) {
  const m = multFor(show.flow);
  const pts = Math.round(base * m);
  show.score += pts; bump(show, grade); show.counts[grade] = (show.counts[grade] ?? 0) + 1;
  if (grade === 'off' && show.fig) show.fig.clean = false;
  return pts;
}
function drop(show, reason, slot) {
  show.drops += 1; show.flow = 0; show.counts.miss += 1; show.actClean = false;
  if (show.fig) { show.fig.clean = false; show.fig.misses += 1; }
  show.ev.push({ k: 'drop', reason, slot, drops: show.drops });
  if (show.mode === 'perform' && show.drops >= TUNE.maxDrops && !show.over) { show.over = true; show.ev.push({ k: 'over' }); }
}

export function throwFlag(show, nAir, nAim) {
  const f = show.fig; if (!f || show.over) return null;
  const b = show.b;
  let best = null;
  for (const t of f.throws) if (t.state === 'wait' && Math.abs(b - t.relB) <= TUNE.relWindow && (!best || Math.abs(b - t.relB) < Math.abs(b - best.relB))) best = t;
  if (!best) { show.ev.push({ k: 'stray' }); return null; }
  const air = airOf(nAir), you = youOf(show), x0 = xOf(show, you), x1 = x0 + nAim;
  const toSlot = slotOf(show, best.to), xt = xOf(show, toSlot);
  const relE = b - best.relB, airE = air - best.air, aimE = x1 - xt;
  const relG = grade3(relE, TUNE.relPerfect, TUNE.relGood), airG = grade3(airE, TUNE.airPerfect, TUNE.airGood), aimG = grade3(aimE, TUNE.aimPerfect, TUNE.aimGood);
  const grade = worst(relG, airG, aimG);
  const reach = Math.abs(aimE) <= TUNE.aimReach;
  best.state = 'air'; best.grade = grade;
  const id = show.nextId++;
  const fl = { id, kind: 'mine', owner: you, to: toSlot, x0, x1: reach && toSlot !== you ? xt : x1, b0: b, air, state: 'air', grade, reach, caught: false, tEnd: 0, dir: nAim < -0.01 ? -1 : nAim > 0.01 ? 1 : (id % 2 ? 1 : -1), design: (show.act + id) % 8 };
  show.flags.push(fl);
  show.throws += 1;
  const pts = award(show, TUNE.pts[grade], grade);
  show.ev.push({ k: 'throw', grade, relE, airE, aimE, relG, airG, aimG, air, pts, id, to: toSlot, reach });
  return fl;
}

export function catchFlag(show, beat) {
  if (show.over) return null;
  const tb = beat ?? show.b, you = youOf(show);
  let best = null, bd = Infinity;
  for (const fl of show.flags) {
    if (fl.state !== 'air' || fl.to !== you || fl.kind === 'mirror' || !fl.reach && fl.kind === 'mine') continue;
    const e = tb - (fl.b0 + fl.air), d = Math.abs(e);
    if (d <= TUNE.catchGood && d < bd) { best = fl; bd = d; }
  }
  if (!best) { show.ev.push({ k: 'nocatch' }); return null; }
  const e = tb - (best.b0 + best.air), grade = grade3(e, TUNE.catchPerfect, TUNE.catchGood);
  best.state = 'caught'; best.tEnd = show.b; best.caught = true;
  show.catches += 1;
  const pts = award(show, TUNE.catchPts[grade], grade);
  show.ev.push({ k: 'catch', grade, e, pts, id: best.id, kind: best.kind });
  return best;
}

export function trackWave(show, nx, down) {
  show.cursor = nx; show.cursorDown = !!down;
  const f = show.fig; if (!f || !f.waves.length) return;
  for (const w of f.waves) {
    // the beat belongs to the moment the sweep turns: the time of the furthest point reached on the marked side
    const v = nx * w.side;
    if (down && w.state === 'wait' && Math.abs(show.b - w.b) <= TUNE.waveGood && v >= TUNE.waveAmp && v > w.peak + 0.03) { w.peak = v; w.cross = show.b; }
  }
}

export function stepShow(show, dt, rng) {
  if (show.over) return;
  show.t += dt; show.b += dt * show.bpm / 60;
  if (show.thinkCool > 0) show.thinkCool = Math.max(0, show.thinkCool - dt);
  const b = show.b, f = show.fig;
  const bi = Math.floor(b);
  if (bi !== show.lastBeat) {
    show.lastBeat = bi;
    const n = bi - f.start;
    show.ev.push({ k: 'beat', n, count: n < TUNE.countIn ? n + 1 : 0, strong: n % 4 === 0 });
  }
  // partner flags and mirror throws appear on their beat
  for (const inc of f.incoming) {
    if (inc.state === 'wait' && b >= inc.relB) {
      inc.state = 'air';
      const you = youOf(show), from = slotOf(show, inc.from);
      show.flags.push({ id: show.nextId++, kind: 'in', owner: from, to: you, x0: xOf(show, from), x1: xOf(show, you), b0: inc.relB, air: inc.air, state: 'air', grade: null, reach: true, caught: false, tEnd: 0, dir: from < you ? 1 : -1, design: (show.act + from * 3 + 1) % 8 });
      show.ev.push({ k: 'launch', slot: from });
    }
  }
  for (const m of f.mirrors) {
    if (m.state === 'wait' && b >= m.relB) {
      m.state = 'air';
      const you = youOf(show);
      ENS[show.ens].xs.forEach((x, s) => {
        if (s === you) return;
        show.flags.push({ id: show.nextId++, kind: 'mirror', owner: s, to: s, x0: x, x1: x, b0: m.relB, air: m.air, state: 'air', grade: null, reach: true, caught: false, tEnd: 0, dir: s < you ? -1 : 1, design: (show.act + s * 3 + 2) % 8 });
      });
      show.ev.push({ k: 'launch', slot: -1 });
    }
  }
  // throws that never happened
  for (const t of f.throws) {
    if (t.state === 'wait' && b > t.relB + TUNE.relWindow) { t.state = 'blank'; drop(show, 'blank', youOf(show)); }
  }
  // flags coming down
  for (const fl of show.flags) {
    if (fl.state !== 'air') continue;
    const land = fl.b0 + fl.air;
    if (fl.kind === 'mirror') { if (b >= land) { fl.state = 'pcaught'; fl.tEnd = b; } continue; }
    if (fl.to === youOf(show)) {
      if (fl.kind === 'mine' && !fl.reach) { if (b >= land) { fl.state = 'dropped'; fl.tEnd = b; drop(show, 'wide', fl.to); } }
      else if (b > land + TUNE.catchGood) { fl.state = 'dropped'; fl.tEnd = b; drop(show, 'missed', fl.to); }
    } else if (b >= land) {
      fl.tEnd = b;
      if (fl.reach) {
        fl.state = 'pcaught';
        const m = multFor(show.flow); show.score += Math.round(TUNE.partnerCatch * m);
        show.ev.push({ k: 'pcatch', slot: fl.to, pts: Math.round(TUNE.partnerCatch * m), id: fl.id });
        show.counts.pcatch += 1;
      } else { fl.state = 'dropped'; drop(show, 'stray', fl.to); }
    }
  }
  show.flags = show.flags.filter((fl) => fl.state === 'air' || b - fl.tEnd < 1.5);
  // waves
  for (const w of f.waves) {
    if (w.state === 'wait' && b > w.b + TUNE.waveGood) {
      if (w.cross !== null) {
        const e = w.cross - w.b, g = grade3(e, TUNE.wavePerfect, TUNE.waveGood);
        w.state = 'done'; w.grade = g;
        const pts = award(show, TUNE.wavePts[g], g);
        show.ev.push({ k: 'swing', grade: g, e, pts, side: w.side });
      } else {
        w.state = 'missed'; f.misses += 1; f.clean = false; show.flow = 0; show.counts.miss += 1;
        show.ev.push({ k: 'swing', grade: 'miss', side: w.side });
      }
    }
  }
  if (f.waves.length && f.waves.every((w) => w.state !== 'wait') && !f.waveJudged) {
    f.waveJudged = true;
    if (f.waves.filter((w) => w.state === 'missed').length >= 2) drop(show, 'wave', youOf(show));
  }
  // the figure ends
  if (b >= f.end && !show.over) {
    if (f.clean && show.mode !== 'practice') {
      const bonus = Math.round(TUNE.cleanFig * multFor(show.flow)); show.score += bonus;
      show.ev.push({ k: 'clean', pts: bonus });
    }
    show.figsDone += 1;
    if (show.mode !== 'practice' && !show.plan) {
      show.actFig += 1;
      if (show.actFig >= TUNE.figsPerAct) {
        if (show.actClean) { const bonus = TUNE.cleanAct * show.act; show.score += bonus; show.cleanActs += 1; show.ev.push({ k: 'actClean', pts: bonus }); }
        show.act += 1; show.actFig = 0; show.actClean = true;
        show.ens = ensFor(show.act); show.bpm = bpmFor(show.act);
        show.ev.push({ k: 'act', act: show.act, ens: show.ens, bpm: show.bpm });
      }
    }
    startFigure(show, pickFigure(show, rng), Math.ceil(b));
  }
}

// ---- helpers for the view, the hint and the computer player ----------------------------------------------------------------------------
export function holding(show) {
  const f = show.fig, you = youOf(show), base = f ? Math.max(1, f.throws.length) : 1;
  const out = ENS[show.ens].xs.map((_, s) => (s === you ? base : 1));
  for (const fl of show.flags) if (fl.state === 'air' && fl.owner !== undefined && fl.kind !== 'in') out[fl.owner] = Math.max(0, out[fl.owner] - 1);
  return out;
}
// The next thing the player has to do: { kind: 'throw'|'catch'|'wave', b, ... } or null.
export function nextCue(show) {
  const f = show.fig, cues = [];
  for (const t of f.throws) if (t.state === 'wait') cues.push({ kind: 'throw', b: t.relB, air: t.air, to: t.to, t });
  for (const fl of show.flags) if (fl.state === 'air' && fl.to === youOf(show) && fl.kind !== 'mirror' && (fl.reach || fl.kind === 'in')) cues.push({ kind: 'catch', b: fl.b0 + fl.air, fl });
  for (const w of f.waves) if (w.state === 'wait') cues.push({ kind: 'wave', b: w.b, side: w.side });
  for (const inc of f.incoming) if (inc.state === 'wait') cues.push({ kind: 'catch', b: inc.relB + inc.air, future: true });
  cues.sort((p, q) => p.b - q.b);
  return cues[0] ?? null;
}

// The computer player: at the start of a figure it plans every action with small human errors. `rng` is the shared stream.
export function aiPlan(show, rng, skill = 1) {
  const f = show.fig, acts = [], you = youOf(show);
  const j = (s) => rng.range(-s, s) * (1.2 - 0.4 * skill);
  for (const t of f.throws) {
    const xt = xOf(show, slotOf(show, t.to)), air = t.air + j(0.1);
    acts.push({ k: 'throw', b: t.relB + j(0.09), nAir: nAirOf(air), nAim: xt - xOf(show, you) + j(0.025), air });
  }
  for (const inc of f.incoming) acts.push({ k: 'catch', b: inc.relB + inc.air + j(0.1) });
  acts.sort((p, q) => p.b - q.b);
  return acts;
}
// Cursor for the computer's wave: eased, one extreme per beat, with a small phase wobble.
export function aiCursor(show) {
  const f = show.fig; if (!f.waves.length) return null;
  const w0 = f.waves[0].b, u = show.b - w0 + 0.03;
  if (u < -0.5 || u > f.waves.length - 0.5) return 0;
  return -Math.cos(Math.PI * u);
}
