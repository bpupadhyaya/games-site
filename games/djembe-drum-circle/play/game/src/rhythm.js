// Rhythm engine: the rhythm library, pattern expansion, the three play sessions (Echo, Learn, Circle), and the judge.
// Everything here is pure and deterministic: time is the song clock in seconds, advanced by the caller from dt.
//
// Pattern strings (one character per step of the bar):
//   djembe   B bass (centre)  T tone (rim)  S slap (edge)      lower case = soft ghost note       . = rest
//   dundun   X hit  x soft hit                                  . = rest
//   bell     X hit  x soft hit      shaker  X accent  x light
// All patterns are simplified TEACHING versions in the style of each rhythm. Villages and drummers differ, and so do the real parts.

export const STROKES = ['B', 'T', 'S'];
export const STROKE_INFO = {
  B: { name: 'Bass', where: 'centre of the skin', color: '#f2a43a', dark: '#8a4f0b' },
  T: { name: 'Tone', where: 'the ring near the rim', color: '#3cc6b4', dark: '#0d6b60' },
  S: { name: 'Slap', where: 'the very edge', color: '#ff5d8f', dark: '#9b1f4c' },
};

// Zones by normalised distance from the centre of the skin (0 = middle, 1 = rim). The Rules page prints these numbers.
export const ZONE_BASS = 0.5, ZONE_TONE = 0.8, ZONE_EDGE = 1.18;
export function strokeAt(r) { return r > ZONE_EDGE ? null : r < ZONE_BASS ? 'B' : r < ZONE_TONE ? 'T' : 'S'; }

// The voices of the circle. `you` plays djA. Order in LAYERS is the order drummers join the circle.
export const VOICES = {
  djA: { name: 'You', short: 'You', color: '#f4c46a' },
  djB: { name: 'Second djembe', short: 'Djembe 2', color: '#e58a4b' },
  bell: { name: 'Bell', short: 'Bell', color: '#e8e2b0' },
  kenkeni: { name: 'Kenkeni', short: 'Kenkeni', color: '#6fd0c4' },
  dundunba: { name: 'Dundunba', short: 'Dundunba', color: '#9a86f0' },
  sangban: { name: 'Sangban', short: 'Sangban', color: '#e86f86' },
  shaker: { name: 'Shaker', short: 'Shaker', color: '#b7d96a' },
  lead: { name: 'Lead drummer', short: 'Lead', color: '#f4c46a' },
};
export const LAYERS = ['bell', 'kenkeni', 'dundunba', 'sangban', 'shaker', 'djB'];

const P = (o) => o;
export const RHYTHMS = [
  P({ id: 'strokes', name: 'Three Strokes', region: 'The basics', steps: 8, spb: 2, bpm: 76, bars: [0, 0],
    note: 'Start here. A djembe is played with bare hands. Bass is a deep, round note from the middle of the skin. Tone is a clear ring from just inside the rim. Slap is a sharp crack from the very edge. Learn where each one lives and the rest is rhythm.',
    parts: { djA: 'B.T.B.S.', bell: 'X.x.x.x.', kenkeni: 'X.......', dundunba: 'X.......', sangban: '....X...', shaker: 'x.x.x.x.', djB: '..T...S.' },
  }),
  P({ id: 'yankadi', name: 'Yankadi-style', region: 'Malinke, Guinea', steps: 8, spb: 2, bpm: 84,
    note: 'A slow, easygoing dance rhythm of the Malinke people of Guinea and neighbouring lands. Because the pulse is relaxed and easy to feel, teachers often use it as the first real rhythm.',
    parts: { djA: 'B.T.T.ST', bell: 'X.x.X.x.', kenkeni: 'X.X.X.X.', dundunba: 'X.......', sangban: '..X...X.', shaker: 'x.xxx.xx', djB: '..S...S.' } }),
  P({ id: 'kuku', name: 'Kuku-style', region: 'Guinea and Cote d\'Ivoire', steps: 16, spb: 4, bpm: 100,
    note: 'A lively dance song from the south of Guinea, popular across Guinea and Cote d\'Ivoire. Accounts link it to fishing communities and their celebrations. The djembe part sits on a steady pulse with bass on the first beat.',
    parts: { djA: 'B..TT.S.B.T.T.S.', bell: 'X.X.XX.X.X.XX.X.', kenkeni: 'X...X...X...X...', dundunba: 'X.......X.......', sangban: '..X...X...X...X.', shaker: 'XxxxXxxxXxxxXxxx', djB: 'T.T...S.T.T...S.' } }),
  P({ id: 'kassa', name: 'Kassa-style', region: 'Malinke, Guinea and Mali', steps: 16, spb: 4, bpm: 108,
    note: 'A harvest rhythm of the Malinke, played to keep spirits up while people work in the fields. It is bouncy and forward-leaning, with the bell and the bass drums locking together.',
    parts: { djA: 'B.TT.S.TB.TT.S.T', bell: 'X.X.X.XXX.X.X.XX', kenkeni: 'X.X.X.X.X.X.X.X.', dundunba: 'X.......X.X.....', sangban: '..X.X.....X.X...', shaker: 'x.xxx.xxx.xxx.xx', djB: 'T...S...T...S...' } }),
  P({ id: 'djole', name: 'Djole-style', region: 'Malinke, Guinea', steps: 12, spb: 3, bpm: 104,
    note: 'A dance rhythm in a rolling twelve-pulse feel, counted in four groups of three. The bell plays the classic twelve-pulse timeline: seven strokes spread unevenly across the twelve. Hold your part and let the groups of three swing.',
    parts: { djA: 'B.TT.SB.TT.S', bell: 'X.X.XX.X.X.X', kenkeni: 'X..X..X..X..', dundunba: 'X.....X.....', sangban: '..X..X..X.X.', shaker: 'X.xX.xX.xX.x', djB: 'T.S.T.S.T.S.' } }),
  P({ id: 'mandiani', name: 'Mandiani-style', region: 'Guinea and Mali', steps: 16, spb: 4, bpm: 118,
    note: 'A fast, bouncing dance rhythm known across Guinea and Mali, and a favourite for showing off a drummer\'s speed. This teaching version adds soft ghost notes between the main strokes: play them lightly.',
    parts: { djA: 'B.t.TStsB.t.TSts', bell: 'X.XXX.X.X.XXX.X.', kenkeni: 'X.X.X.X.X.X.X.X.', dundunba: 'X...X...X..X....', sangban: '..X...X...X...X.', shaker: 'xxXxxxXxxxXxxxXx', djB: 'T.S.T.S.T.S.T.S.'.slice(0, 16) } }),
];
export const rhythmById = (id) => RHYTHMS.find((r) => r.id === id) ?? RHYTHMS[0];
export const stepSecOf = (rh, bpmScale = 1) => 60 / (rh.bpm * bpmScale * rh.spb);

// ---- difficulty: judging windows (seconds either side of the target) -------------------------------------------------------
export const DIFFICULTY = [
  { name: 'Relaxed', perfect: 0.075, good: 0.15, ok: 0.23 },
  { name: 'Standard', perfect: 0.06, good: 0.115, ok: 0.18 },
  { name: 'Tight', perfect: 0.042, good: 0.085, ok: 0.135 },
];
export const GRADE_POINTS = { perfect: 1, good: 0.75, ok: 0.5, wrong: 0.25, miss: 0 };
export const STAR_AT = [0.6, 0.8, 0.92];                 // accuracy needed for 1, 2, 3 stars
export const CIRCLE_ADD_AT = 0.62;                       // a stage at or above this accuracy brings the next drummer in
export const CIRCLE_MAX_STAGES = 16;
export const ECHO_ROUNDS = 8;

export const stars = (acc) => (acc >= STAR_AT[2] ? 3 : acc >= STAR_AT[1] ? 2 : acc >= STAR_AT[0] ? 1 : 0);

// ---- pattern expansion -----------------------------------------------------------------------------------------------------
const isSoft = (c) => c === c.toLowerCase();
export function expandPart(pattern, t0, stepSec, voice) {
  const out = [];
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '.' || c === ' ') continue;
    if (voice === 'djA' || voice === 'djB' || voice === 'lead') out.push({ t: t0 + i * stepSec, voice, stroke: c.toUpperCase(), vel: isSoft(c) ? 0.5 : 0.95, step: i });
    else out.push({ t: t0 + i * stepSec, voice, stroke: 'X', vel: voice === 'shaker' ? (c === 'X' ? 0.85 : 0.5) : isSoft(c) ? 0.55 : 1, step: i });
  }
  return out;
}

// ---- a session -------------------------------------------------------------------------------------------------------------
// session = { mode, rh, t, endT, cursor, events[], fi, lane[], targets[], bars[], stats, ... }
// `events` are sounds the program plays by itself (the circle, the teacher). `lane` holds every note drawn on the timeline.
// `targets` are the notes the player must play; each one is judged once.
export function newSession(mode, rh, opts = {}) {
  return {
    mode, rhId: rh.id, t: 0, endT: Infinity, cursor: 0, events: [], fi: 0, lane: [], targets: [], bars: [], layers: [],
    diff: opts.diff ?? 1, latency: opts.latency ?? 0, tempoScale: 1, done: false,
    stats: blankStats(), stage: { grades: [], idx: 0 }, rounds: [], flashes: [], phaseName: '', msg: '',
  };
}
export function blankStats() { return { perfect: 0, good: 0, ok: 0, wrong: 0, miss: 0, extra: 0, combo: 0, best: 0, errSum: 0, errN: 0 }; }
export const accuracyOf = (st) => { const n = st.perfect + st.good + st.ok + st.wrong + st.miss; return n ? (st.perfect + 0.75 * st.good + 0.5 * st.ok + 0.25 * st.wrong) / n : 0; };

function addBar(S, { steps, stepSec, label, kind, ai = {}, teacher = null, player = null, guide = false, phase = '', round = 0, click = null }) {
  const t0 = S.cursor, len = steps * stepSec;
  S.bars.push({ t0, t1: t0 + len, label, kind, steps, stepSec, phase, round, beatSec: click ? click * stepSec : 0 });
  for (const v of Object.keys(ai)) for (const e of expandPart(ai[v], t0, stepSec, v)) S.events.push(e);
  if (click) for (let i = 0; i < steps; i += click) S.events.push({ t: t0 + i * stepSec, voice: 'click', stroke: 'X', vel: i === 0 ? 1 : 0.6, step: i });
  if (teacher) for (const e of expandPart(teacher, t0, stepSec, 'lead')) { S.events.push(e); S.lane.push({ t: e.t, stroke: e.stroke, kind: 'ghost', vel: e.vel, round }); }
  if (player) {
    for (const e of expandPart(player, t0, stepSec, 'djA')) {
      const n = { t: e.t, stroke: e.stroke, kind: 'target', vel: e.vel, grade: null, err: 0, guide, round, phase, stage: S.stage.idx };
      S.lane.push(n); S.targets.push(n);
    }
  }
  S.cursor = t0 + len;
  return t0;
}
function finishBuild(S) { S.events.sort((a, b) => a.t - b.t); }

// Learn: count-in, listen, slow practice (guided), then the full circle. Only the last phase is scored.
export function buildLearn(rh, opts = {}) {
  const S = newSession('learn', rh, opts);
  const full = stepSecOf(rh), slow = stepSecOf(rh, 0.72), n = rh.steps, pa = rh.parts;
  S.cursor = 0;
  const count = { steps: n, stepSec: slow, kind: 'count', label: 'Count in', click: rh.spb };
  addBar(S, { ...count, ai: {} });
  for (let b = 0; b < 2; b++) addBar(S, { steps: n, stepSec: slow, kind: 'listen', label: 'Listen', phase: 'Listen', teacher: pa.djA, ai: { bell: pa.bell } });
  for (let b = 0; b < 4; b++) addBar(S, { steps: n, stepSec: slow, kind: 'practice', label: 'Practice (slow)', phase: 'Practice', player: pa.djA, guide: true, ai: { bell: pa.bell, kenkeni: pa.kenkeni } });
  S.scoredFrom = S.cursor;
  addBar(S, { steps: n, stepSec: full, kind: 'count', label: 'Count in', click: rh.spb });
  S.scoredFrom = S.cursor;
  for (let b = 0; b < 8; b++) addBar(S, { steps: n, stepSec: full, kind: 'play', label: 'Full circle', phase: 'Play', player: pa.djA, ai: { bell: pa.bell, kenkeni: pa.kenkeni, dundunba: pa.dundunba, sangban: pa.sangban, shaker: pa.shaker, djB: pa.djB } });
  S.endT = S.cursor + 1.2; S.layers = ['bell', 'kenkeni', 'dundunba', 'sangban', 'shaker', 'djB'];
  finishBuild(S);
  return S;
}

// Auto Play: hands play the part four bars over the full circle (nothing is judged).
export function buildAuto(rh) {
  const S = newSession('auto', rh), n = rh.steps, ss = stepSecOf(rh, 0.9), pa = rh.parts;
  for (let b = 0; b < 4; b++) addBar(S, { steps: n, stepSec: ss, kind: 'demo', label: 'Watch', phase: 'Watch', teacher: pa.djA, ai: { bell: pa.bell, kenkeni: pa.kenkeni, dundunba: pa.dundunba, sangban: pa.sangban, shaker: pa.shaker, djB: pa.djB } });
  S.endT = S.cursor + 0.9; finishBuild(S);
  return S;
}

// Echo: a lead phrase, then you echo it. The phrase grows over eight rounds. Notes are chosen with the game's seeded random.
export function makePhrase(rng, round) {
  const n = 8, odd = round >= 4, count = Math.min(odd ? 7 : 4, 2 + Math.ceil(round * 0.7)), pool = round < 3 ? ['B', 'T'] : ['B', 'T', 'S'];
  const steps = new Set([0]);
  while (steps.size < count) { const s = rng.int(n); if (odd || s % 2 === 0) steps.add(s); }
  const chars = Array(n).fill('.');
  let last = '';
  [...steps].sort((a, b) => a - b).forEach((s, i) => {
    let c = i === 0 ? 'B' : rng.pick(pool);
    if (c === last && rng.chance(0.55)) c = rng.pick(pool);
    chars[s] = c; last = c;
  });
  return chars.join('');
}
export function buildEcho(rh, rng, opts = {}) {
  const S = newSession('echo', rh, opts);
  S.phrases = [];
  addBar(S, { steps: 8, stepSec: 60 / 84 / 2, kind: 'count', label: 'Count in', click: 2 });
  for (let r = 1; r <= ECHO_ROUNDS; r++) {
    const bpm = 80 + r * 3, ss = 60 / bpm / 2, ph = makePhrase(rng, r);
    S.phrases.push(ph);
    S.stage.idx = r;
    addBar(S, { steps: 8, stepSec: ss, kind: 'listen', label: 'Listen', phase: 'Listen', round: r, teacher: ph, ai: { kenkeni: 'x.x.x.x.' } });
    addBar(S, { steps: 8, stepSec: ss, kind: 'play', label: 'Your echo', phase: 'Echo', round: r, player: ph, ai: { kenkeni: 'x.x.x.x.' } });
  }
  S.scoredFrom = 0; S.endT = S.cursor + 1.0;
  finishBuild(S);
  return S;
}

// Circle: you hold the djembe part; each two-bar stage you play well brings another drummer into the circle.
export function buildCircle(rh, opts = {}) {
  const S = newSession('circle', rh, opts);
  const n = rh.steps, ss = stepSecOf(rh), pa = rh.parts;
  S.circle = { stageBars: 2, stageStart: 0, added: 1, layers: ['bell'], full: false, fullStages: 0, stageNo: 0, built: 0 };
  addBar(S, { steps: n, stepSec: ss, kind: 'count', label: 'Count in', click: rh.spb, ai: { bell: pa.bell } });
  S.scoredFrom = S.cursor;
  // The player's whole part is laid out up front (it never changes); the other drummers are appended stage by stage.
  const total = CIRCLE_MAX_STAGES * 2;
  for (let b = 0; b < total; b++) {
    const t0 = S.cursor, len = n * ss;
    S.bars.push({ t0, t1: t0 + len, label: 'Circle', kind: 'play', steps: n, stepSec: ss, phase: 'Play', round: 0 });
    for (const e of expandPart(pa.djA, t0, ss, 'djA')) { const nn = { t: e.t, stroke: e.stroke, kind: 'target', vel: e.vel, grade: null, err: 0, guide: false, round: 0, phase: 'Play', stage: Math.floor(b / 2) }; S.lane.push(nn); S.targets.push(nn); }
    S.cursor = t0 + len;
  }
  S.circle.barSec = n * ss; S.circle.t0 = S.bars[1].t0;
  S.circle.playT0 = S.circle.t0;
  S.endT = Infinity;
  S.layers = ['bell'];
  growCircle(S, rh);                                  // stage 0 with the bell
  return S;
}
// Append the AI drummers for one more stage (two bars).
function growCircle(S, rh) {
  const C = S.circle, pa = rh.parts, n = rh.steps, ss = stepSecOf(rh);
  const t0 = C.t0 + C.built * 2 * C.barSec;
  for (let b = 0; b < 2; b++) for (const v of S.layers) for (const e of expandPart(pa[v], t0 + b * C.barSec, ss, v)) S.events.push(e);
  S.events.sort((a, b) => a.t - b.t);
  // keep the index of the next event valid: events appended are always later than anything already fired
  C.built += 1;
  void n;
}
// Called every tick: when the song nears the end of the built stages, decide who joins next.
export function stepCircle(S, rh) {
  const C = S.circle; if (!C || S.done) return;
  const builtEnd = C.t0 + C.built * 2 * C.barSec;
  if (S.t < builtEnd - C.barSec * 0.45) return;
  const curStage = C.built - 1;
  const done = S.targets.filter((n) => n.stage === curStage && n.grade);
  const sum = done.reduce((s, n) => s + GRADE_POINTS[n.grade], 0), acc = done.length ? sum / done.length : 0;
  C.lastAcc = acc;
  if (C.built >= CIRCLE_MAX_STAGES) { S.endT = builtEnd + 1.0; return; }
  if (!C.full) {
    if (acc >= CIRCLE_ADD_AT && S.layers.length < LAYERS.length) {
      const nxt = LAYERS[S.layers.length]; S.layers.push(nxt); C.joined = { voice: nxt, at: builtEnd };
      if (S.layers.length === LAYERS.length) C.full = true;
    } else C.joined = null;
  } else {
    C.fullStages += 1;
    if (C.fullStages >= 3) { S.endT = builtEnd + 0.6; return; }
  }
  growCircle(S, rh);
}

// ---- judging ---------------------------------------------------------------------------------------------------------------
export function windows(S) { return DIFFICULTY[S.diff] ?? DIFFICULTY[1]; }
function gradeOf(S, a) { const w = windows(S); return a <= w.perfect ? 'perfect' : a <= w.good ? 'good' : a <= w.ok ? 'ok' : null; }
function record(S, grade, n, err) {
  const st = S.stats;
  const scored = n.t >= (S.scoredFrom ?? 0);
  n.grade = grade; n.err = err;
  if (!scored) { n.practice = true; return; }
  st[grade] += 1;
  if (grade === 'perfect' || grade === 'good' || grade === 'ok') { st.combo += 1; st.best = Math.max(st.best, st.combo); st.errSum += err; st.errN += 1; } else st.combo = 0;
}

// A strike of `stroke` at song time `th` (latency already removed). Returns { grade, err, note } or null when it matched nothing.
export function judgeHit(S, stroke, th) {
  const w = windows(S);
  let best = null, bestSame = null;
  for (const n of S.targets) {
    if (n.grade) continue;
    const a = Math.abs(n.t - th);
    if (a > w.ok) continue;
    if (!best || a < Math.abs(best.t - th)) best = n;
    if (n.stroke === stroke && (!bestSame || a < Math.abs(bestSame.t - th))) bestSame = n;
  }
  const n = bestSame ?? best;
  if (!n) { S.stats.extra += 1; return null; }
  const err = th - n.t;
  if (n.stroke !== stroke) { record(S, 'wrong', n, err); return { grade: 'wrong', err, note: n }; }
  const g = gradeOf(S, Math.abs(err));
  record(S, g, n, err);
  return { grade: g, err, note: n };
}
// Mark every note that is now too late to hit.
export function sweepMisses(S) {
  const w = windows(S);
  for (const n of S.targets) {
    if (n.grade) continue;
    if (n.t < S.t - w.ok) record(S, 'miss', n, 0);
    else if (n.t >= S.t) break;
  }
}
export function roundAccuracy(S, r) {
  const ns = S.targets.filter((n) => n.round === r && n.grade);
  return ns.length ? ns.reduce((s, n) => s + GRADE_POINTS[n.grade], 0) / ns.length : 0;
}
export const meanError = (st) => (st.errN ? st.errSum / st.errN : 0);

// Pattern as small display text for notation strips: B . T T ...
export function notation(pattern) { return [...pattern].map((c) => (c === '.' ? '·' : c)); }

// Free drum: a short loop recorder. Layers are lists of { t, stroke, vel } inside one loop of `len` seconds.
export function quantise(t, len, stepSec) { const q = Math.round(t / stepSec) * stepSec; return q >= len - 1e-6 ? 0 : q; }
