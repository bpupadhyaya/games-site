// The tune simulation: pure and deterministic. One call to stepTune advances a tune by dt seconds given the player's command
// { press: [lane, ...] (lanes tapped this tick), breath: boolean (the breath pad is held) }.
//
// Air (the cheek reservoir, 0..1) drains all the time and a little more with every note. Holding the breath pad refills it, but the
// reeds cannot speak while the cheeks squeeze: lane taps are ignored. At 0 air the drone sputters for GRACE seconds; a squeeze in
// that time revives it, otherwise the tune ends.
import { TUNES, buildChart, LEAD } from './tunes.js';

export const STEP = 1 / 60;
export const WIN = { perfect: 0.07, good: 0.14, edge: 0.2 };
export const FALL = 1.75;                        // seconds a note is visible before it reaches the line
export const GRACE = 1.6;
export const PACES = [
  { id: 'relaxed', name: 'Relaxed', blurb: 'The air lasts longer and a squeeze fills faster.', drain: 0.05, noteCost: 0.014, refill: 1.7 },
  { id: 'standard', name: 'Standard', blurb: 'The air a piper really has to manage.', drain: 0.085, noteCost: 0.022, refill: 1.4 },
];
export const POINTS = [100, 60, 30];             // perfect, good, edge

export function newTune(tuneIdx, paceIdx = 1) {
  const tune = TUNES[tuneIdx], ch = buildChart(tune);
  return {
    tune: tuneIdx, pace: paceIdx, t: 0, notes: ch.notes, end: ch.end, stepDur: ch.stepDur, cur: 0,
    air: 1, grace: GRACE, squeeze: false, squeezeT: 0, lastPress: [-9, -9, -9, -9, -9],
    score: 0, combo: 0, maxCombo: 0, grades: [0, 0, 0], missed: 0, stray: 0, ignored: 0, breaths: 0, dryTime: 0, minAir: 1,
    ev: [], over: null, total: ch.notes.length,
  };
}

export const mult = (combo) => Math.min(4, 1 + Math.floor(combo / 8));

export function stepTune(S, dt, cmd) {
  S.ev = [];
  if (S.over) return S;
  const P = PACES[S.pace];
  S.t += dt;
  const want = !!cmd.breath;
  if (want && !S.squeeze) { S.breaths++; S.ev.push({ k: 'squeeze' }); }
  if (!want && S.squeeze) S.ev.push({ k: 'release' });
  S.squeeze = want;
  if (S.squeeze) {
    S.squeezeT += dt;
    S.air = Math.min(1, S.air + P.refill * dt);
  } else if (S.t > LEAD - 1.2) {
    S.air = Math.max(0, S.air - P.drain * dt);
  }
  // taps
  for (const lane of cmd.press || []) {
    if (S.squeeze || S.air <= 0) { S.ignored++; S.ev.push({ k: 'ignored', lane }); continue; }
    let best = -1, bd = 9;
    for (let i = S.cur; i < S.notes.length; i++) {
      const n = S.notes[i];
      if (n.at - S.t > WIN.edge) break;
      if (n.st !== 0 || n.lane !== lane) continue;
      const d = Math.abs(n.at - S.t);
      if (d <= WIN.edge && d < bd) { bd = d; best = i; }
    }
    S.lastPress[lane] = S.t;
    if (best < 0) {
      S.stray++; S.combo = 0; S.air = Math.max(0, S.air - P.noteCost * 0.6);
      S.ev.push({ k: 'stray', lane });
      continue;
    }
    const n = S.notes[best], g = bd <= WIN.perfect ? 0 : bd <= WIN.good ? 1 : 2;
    n.st = 1; n.g = g;
    S.grades[g]++; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
    const pts = POINTS[g] * mult(S.combo);
    S.score += pts;
    S.air = Math.max(0, S.air - P.noteCost);
    S.ev.push({ k: 'hit', lane, g, pts, early: n.at > S.t });
  }
  // notes that slipped by
  while (S.cur < S.notes.length && (S.notes[S.cur].st !== 0 || S.notes[S.cur].at + WIN.edge < S.t)) {
    const n = S.notes[S.cur];
    if (n.st === 0) { n.st = 2; S.missed++; S.combo = 0; S.ev.push({ k: 'miss', lane: n.lane }); }
    S.cur++;
  }
  S.minAir = Math.min(S.minAir, S.air);
  if (S.air <= 0) {
    S.dryTime += S.squeeze ? 0 : dt;
    if (!S.squeeze) S.grace -= dt;
    if (S.grace <= 0) { S.over = { how: 'dry', t: S.t }; S.ev.push({ k: 'dry' }); }
  } else S.grace = GRACE;
  if (!S.over && S.t >= S.end) { S.over = { how: 'done', t: S.t }; S.ev.push({ k: 'done' }); }
  return S;
}

export const accuracy = (S) => (S.total ? (S.grades[0] + S.grades[1] * 0.7 + S.grades[2] * 0.4) / S.total : 0);
export const progress = (S) => Math.max(0, Math.min(1, (S.t - LEAD) / Math.max(1, S.end - LEAD)));
export function rating(S) {
  const a = accuracy(S);
  if (S.over && S.over.how === 'dry') return 'Out of breath';
  return a >= 0.9 ? 'Master' : a >= 0.7 ? 'Player' : 'Learner';
}
