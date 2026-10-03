// The Ampe match engine: a beat clock, rounds, tap timing, the reveal and the score. Pure and deterministic (fixed step, no clock,
// no randomness outside the rng handed in). The 3D presenter only READS this state: every time it needs (take-off, apex, landing)
// is a plain number in `s.round` / `s.prev`, so what you see is exactly what the engine decided.
import { AIR, RING_DUR, TIMING, TEMPOS, LEAD_IN_BEATS, STEP } from './consts.js';
import { createBrain, habitHint, predictHint, LEFT, RIGHT } from './ai.js';
import { resolveRound } from './rules.js';

const JITTER = [0.05, 0.035, 0.025, 0.018, 0.01];       // how far an AI player's own commit time wanders from the beat (looks human)
const MAX_EVENTS = 40;

export function createSim(cfg0, rng) {
  const cfg = {
    mode: 'match', humans: [true, false], levels: [3, 3], tempo: 'steady', target: 11, timing: 'standard', penalty: true,
    leader: 0, hold: false, offset: 0, maxRounds: 0, script: null, ...cfg0,
  };
  const timing = TIMING[cfg.timing === 'relaxed' ? 'relaxed' : 'standard'];
  const tempo = TEMPOS.find((t) => t.id === cfg.tempo) || TEMPOS[1];
  const brains = [0, 1].map((i) => (cfg.humans[i] ? null : createBrain(cfg.levels[i] || 3, rng.fork())));
  const s = {
    t: 0, mode: cfg.mode, phase: 'count', bpm: tempo.bpm, score: [0, 0], leader: cfg.leader | 0, n: 0, over: false, winner: -1,
    round: null, prev: null, events: [], evId: 0, sched: [], hold: null,
    hist: { feet: [[], []], lead: [] },
    stats: [0, 1].map(() => ({ perfect: 0, good: 0, ok: 0, miss: 0, early: 0, streak: 0, best: 0, points: 0, rounds: 0 })),
    cfg: { mode: cfg.mode, humans: cfg.humans, levels: cfg.levels, tempo: cfg.tempo, target: cfg.target, timing: cfg.timing, penalty: cfg.penalty, hold: cfg.hold, maxRounds: cfg.maxRounds },
  };

  const emit = (e) => { e.id = s.evId++; s.events.push(e); if (s.events.length > MAX_EVENTS) s.events.shift(); return e; };
  const bpmFor = (n) => (tempo.to ? Math.min(tempo.to, tempo.bpm + tempo.step * Math.floor(n / tempo.every)) : tempo.bpm);

  // ---- resume: replay the finished rounds so the computer's memory is exactly what it was ------------------------------------
  if (cfg0.resume) {
    const r = cfg0.resume;
    s.score = [...r.score]; s.leader = r.leader; s.n = r.n;
    s.hist = { feet: [[...r.hist.feet[0]], [...r.hist.feet[1]]], lead: [...r.hist.lead] };
    if (r.stats) s.stats = r.stats.map((o) => ({ ...o }));
    for (let k = 0; k < s.hist.lead.length; k++) {
      for (const i of [0, 1]) {
        if (!brains[i]) continue;
        const lead = s.hist.lead[k] === i;
        brains[i].choose(lead);
        brains[i].observe(s.hist.feet[i][k], s.hist.feet[1 - i][k], lead);
      }
    }
  }

  // ---- rounds --------------------------------------------------------------------------------------------------------------
  function prepare() {
    const n = s.n;
    s.bpm = bpmFor(n);
    const planned = [null, null];
    for (let i = 0; i < 2; i++) {
      if (brains[i]) planned[i] = brains[i].choose(s.leader === i);
    }
    if (cfg.script && !cfg.humans[1]) planned[1] = cfg.script[n % cfg.script.length];
    const jit = [0, 0];
    for (let i = 0; i < 2; i++) if (brains[i]) { const lv = (cfg.levels[i] || 3) - 1; jit[i] = (rng.next() * 2 - 1) * JITTER[lv]; }
    s.round = {
      n, lead: s.leader, bpm: s.bpm, T: 60 / s.bpm, R: 120 / s.bpm, A: AIR,
      r0: 0, tr: 0, tc: 0, tb: 0, tl: 0, lockT: 0,
      foot: [null, null], tapAt: [null, null], grade: [null, null], miss: [false, false], planned, jit,
      resolved: false, result: null,
    };
  }
  function schedule(r0, countIn) {
    const r = s.round;
    r.r0 = r0; r.tb = r0 + r.T; r.tc = r.tb - AIR / 2; r.tl = r.tb + AIR / 2; r.tr = r.tc - RING_DUR; r.lockT = r.tc + timing.okLate;
    const q = [];
    if (countIn) for (let k = LEAD_IN_BEATS; k >= 1; k--) q.push({ t: r0 - k * r.T, type: 'count', k });
    q.push({ t: r0, type: 'beat1' });
    q.push({ t: r.tr, type: 'ring' });
    q.push({ t: r.tc, type: 'jump' });
    for (let i = 0; i < 2; i++) if (brains[i] || cfg.script) { if (!cfg.humans[i]) q.push({ t: r.tc + r.jit[i], type: 'commit', p: i }); }
    q.push({ t: r.lockT, type: 'lock' });
    q.push({ t: r.tb, type: 'reveal' });
    q.push({ t: r.tl, type: 'land' });
    q.sort((a, b) => a.t - b.t || (a.type === 'commit' ? 1 : 0) - (b.type === 'commit' ? 1 : 0));
    s.sched = q;
  }
  function startFirst() {
    prepare();
    const T = s.round.T;
    schedule(s.t + LEAD_IN_BEATS * T + 0.05, true);
    s.phase = 'run';
  }

  function gradeOf(d) {
    const a = Math.abs(d);
    if (a <= timing.perfect) return 'perfect';
    if (a <= timing.good) return 'good';
    return 'ok';
  }
  function press(p, side) {
    const r = s.round;
    if (!r || s.over || s.phase === 'hold' || r.resolved || r.foot[p] !== null) return false;
    const tt = s.t + STEP * 0.5 - cfg.offset / 1000;
    const d = tt - r.tc;
    if (d < -timing.okEarly) {
      if (d >= -timing.early) emit({ type: 'tap', t: s.t, p, grade: 'early', locked: false, d: Math.round(d * 1000) });
      return false;
    }
    if (d > timing.okLate) { emit({ type: 'tap', t: s.t, p, grade: 'late', locked: false, d: Math.round(d * 1000) }); return false; }
    r.foot[p] = side; r.tapAt[p] = tt;
    const g = gradeOf(d);
    r.grade[p] = g;
    emit({ type: 'tap', t: s.t, p, side, grade: g, locked: true, d: Math.round(d * 1000) });
    return true;
  }

  function reveal(r) {
    r.resolved = true;
    const feet = [r.foot[0], r.foot[1]];
    const miss = [feet[0] === null, feet[1] === null];
    const scoring = cfg.mode === 'match' || cfg.mode === 'watch' || cfg.mode === 'demo';
    let scorer = -1, match = false, newLead = s.leader;
    const lead = s.leader;
    if (!miss[0] && !miss[1]) {
      const res = resolveRound(lead, feet[0], feet[1]);
      match = res.match;
      if (scoring) { scorer = res.scorer; newLead = res.leader; }
    } else if (scoring && cfg.penalty && !(miss[0] && miss[1])) {
      scorer = miss[0] ? 1 : 0; newLead = scorer;
    }
    if (scorer >= 0) {
      s.score[scorer]++; s.stats[scorer].points++;
      s.leader = newLead;
    }
    for (let i = 0; i < 2; i++) {
      const st = s.stats[i];
      st.rounds++;
      if (miss[i]) { if (cfg.humans[i]) { st.miss++; st.streak = 0; } } else if (cfg.humans[i]) {
        const g = r.grade[i];
        st[g]++;
        st.streak = g === 'ok' ? 0 : st.streak + 1; st.best = Math.max(st.best, st.streak);
      }
    }
    if (!miss[0] && !miss[1]) {
      s.hist.feet[0].push(feet[0]); s.hist.feet[1].push(feet[1]); s.hist.lead.push(lead);
      for (let i = 0; i < 2; i++) if (brains[i]) brains[i].observe(feet[i], feet[1 - i], lead === i);
    }
    r.result = { feet, match, scorer, lead, newLead, miss, score: [...s.score] };
    emit({ type: 'reveal', t: r.tb, n: r.n, feet, match, scorer, lead, newLead, miss, score: [...s.score] });
    const done = scoring && (s.score[0] >= cfg.target || s.score[1] >= cfg.target);
    if (done) {
      s.winner = s.score[0] >= cfg.target ? 0 : 1;
      s.over = true;
      s.sched.push({ t: r.tb + 1.1, type: 'end' });
    } else if (cfg.maxRounds && r.n + 1 >= cfg.maxRounds) {
      s.over = true;
      s.sched.push({ t: r.tb + 0.9, type: 'end' });
    }
  }

  function fire(e) {
    const r = s.round;
    switch (e.type) {
      case 'count': emit({ type: 'beat', t: e.t, kind: 'count', k: e.k }); emit({ type: 'clap', t: e.t, kind: 'count' }); break;
      case 'beat1': emit({ type: 'beat', t: e.t, kind: 'one', n: r.n }); emit({ type: 'clap', t: e.t, kind: 'hop' }); break;
      case 'ring': emit({ type: 'ring', t: e.t, tc: r.tc, n: r.n }); break;
      case 'jump': emit({ type: 'jump', t: e.t, n: r.n }); break;
      case 'commit': r.foot[e.p] = r.planned[e.p]; r.tapAt[e.p] = e.t; r.grade[e.p] = gradeOf(e.t - r.tc); break;
      case 'lock':
        for (let i = 0; i < 2; i++) if (cfg.humans[i] && r.foot[i] === null) { r.miss[i] = true; s.stats[i].streak = 0; emit({ type: 'tap', t: s.t, p: i, grade: 'miss', locked: true }); }
        break;
      case 'reveal': emit({ type: 'beat', t: e.t, kind: 'two', n: r.n }); emit({ type: 'clap', t: e.t, kind: 'jump' }); reveal(r); break;
      case 'land': emit({ type: 'land', t: e.t, n: r.n }); break;
      case 'end': s.phase = 'over'; emit({ type: 'matchEnd', t: e.t, winner: s.winner, score: [...s.score] }); break;
      default: break;
    }
  }

  function nextRound() {
    const old = s.round;
    s.prev = { n: old.n, tb: old.tb, tl: old.tl, A: old.A, T: old.T, foot: [...old.foot], miss: [...old.miss], r0: old.r0 };
    s.n++;
    prepare();
    if (cfg.hold) {
      s.phase = 'hold';
      s.hold = { id: s.n, leader: s.leader, planned: [...s.round.planned], bpm: s.bpm };
      emit({ type: 'hold', t: s.t, id: s.n });
    } else schedule(old.r0 + old.R, false);
  }

  const api = {
    s,
    tap: press,
    // Watch & Learn: leave the THINK / REVEAL pause and run the round live (a two-beat count-in first)
    release() {
      if (s.phase !== 'hold') return;
      s.hold = null; s.phase = 'run';
      schedule(s.t + 2 * s.round.T + 0.05, true);
      s.sched = s.sched.filter((e) => e.type !== 'count' || e.k <= 2);
    },
    update(dt) {
      if (s.phase === 'over') { s.t += dt; return; }
      if (s.phase === 'hold') { s.t += dt; return; }
      if (s.phase === 'count' && !s.round) startFirst();
      s.t += dt;
      while (s.sched.length && s.sched[0].t <= s.t) fire(s.sched.shift());
      // the finished round hands over to the next one as soon as it has landed
      if (s.round && s.round.resolved && !s.over && !s.sched.length && s.phase === 'run') nextRound();
    },
    // the Think hint: my habit (what a reader would exploit) and the computer's habit (what to do about it) from the real history
    hint(p = 0) {
      const mine = s.hist.feet[p], theirs = s.hist.feet[1 - p];
      const lead = s.hist.lead.map((l) => l === p);
      const iLead = s.leader === p;
      const you = habitHint(mine, theirs, lead);
      const them = predictHint(theirs, iLead);
      return { you, them, iLead, rounds: mine.length };
    },
    snapshot() {
      return { score: [...s.score], leader: s.leader, n: s.n, hist: { feet: [[...s.hist.feet[0]], [...s.hist.feet[1]]], lead: [...s.hist.lead] }, stats: s.stats.map((o) => ({ ...o })) };
    },
  };
  return api;
}

export { LEFT, RIGHT };
