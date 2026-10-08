// The competition around the jump: gate choice, the jump itself (jump.js), the judges, the rivals and the medal table. Pure and deterministic.
// Phases per jump: gate -> run (in-run, take-off, flight, landing) -> judge (marks and points) -> board (round standings) -> ... -> end.
import { createJump, judgeMarks, scoreJump, makeWind, levelById, DT, ZONE } from './jump.js';
import { createPilot } from './pilot.js';
import { hillById, GATES } from './hills.js';
export { DT };

export const RIVAL_NAMES = ['Anders', 'Elin', 'Mikkel', 'Sigrid', 'Jonas', 'Freya', 'Tobias'];
const RIVAL_SKILL = [0.95, 0.85, 0.75, 0.65, 0.55, 0.46, 0.38];
export const MEDALS = ['Gold', 'Silver', 'Bronze'];
export const KIND_TEXT = { telemark: 'Telemark landing', clean: 'Clean landing', rough: 'Rough landing', fall: 'Fall' };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r1 = (x) => Math.round(x * 10) / 10;

export function createSim(opts, rng) {
  const hill = hillById(opts.hill), level = opts.level || 2, lvl = levelById(level);
  const mode = opts.mode || 'comp';                    // comp | daily | practice | watch
  const rounds = mode === 'practice' ? 1 : opts.rounds || 3;
  const rivalCount = mode === 'practice' ? 0 : 7;
  const s = {
    t: 0, mode, hill: hill.id, level, rounds, round: 0, ph: 'gate', gate: 1, wind: null, jump: null, res: null, hold: null,
    events: [], evId: 0, over: false, replay: null,
    you: { jumps: [], total: 0, best: 0 },
    rivals: Array.from({ length: rivalCount }, (_, i) => ({ name: RIVAL_NAMES[i], skill: RIVAL_SKILL[i], jumps: [], total: 0 })),
    board: null, standings: [], pt: 0, hasHolds: !!opts.hold, watched: {},
  };
  let J = null, input = { down: false, pressed: false, released: false, sx: 0, sy: 0 };
  const evRng = rng.fork(), windRng = rng.fork(), rivRng = rng.fork(), judgeRng = rng.fork();
  const emit = (e) => { s.events.push({ id: ++s.evId, t: s.t, ...e }); if (s.events.length > 40) s.events.shift(); };

  function newWind() { return makeWind(windRng, hill, lvl); }
  s.wind = newWind();

  // computer jumper for the rivals: a full jump with a pilot
  function rivalJump(r) {
    const rr = rivRng.fork();
    const wind = s.wind;                                  // everyone jumps in the same round, so the same wind: a fair, steadier table
    const sk = clamp(r.skill + (level - 2) * 0.05 + rr.range(-0.04, 0.03), 0.2, 0.97);
    const gate = rr.chance(0.12) ? 2 : rr.chance(0.15) ? 0 : 1;
    // a steady rival: the median of three attempts, so the table follows skill and a single gust or slip rarely decides it
    const tries = [];
    for (let n = 0; n < 3; n++) {
      const jp = createJump({ hill, gate, wind, level, rng: rr.fork() });
      const pilot = createPilot(rr.fork(), sk);
      for (let k = 0; k < 2800 && jp.j.ph !== 'done'; k++) jp.step(pilot(jp.j));
      const res = jp.j.res;
      tries.push({ res, sc: scoreJump(hill, res, judgeMarks(res, judgeRng), wind, gate) });
    }
    tries.sort((a, b) => a.sc.total - b.sc.total);
    const { res, sc } = tries[1];
    return { dist: res.dist, pts: sc.total, kind: res.kind };
  }

  function standings() {
    const rows = [{ name: 'You', you: true, total: r1(s.you.total), jumps: s.you.jumps.map((j) => ({ dist: j.dist, pts: j.pts })) }];
    for (const r of s.rivals) rows.push({ name: r.name, you: false, total: r1(r.total), jumps: r.jumps });
    rows.sort((a, b) => b.total - a.total || (a.you ? -1 : 1));
    rows.forEach((x, i) => { x.rank = i + 1; });
    return rows;
  }

  function startJump() {
    const wind = s.wind;
    J = createJump({ hill, gate: s.gate, wind, level, rng: evRng.fork() });
    s.jump = J.j; s.ph = 'run'; s.res = null; s.watched = {}; s.hold = null; s.replay = null;
    emit({ type: 'start' });
  }
  function holdAt(id, summary, reason) {
    if (!s.hasHolds || s.watched[id]) return false;
    s.watched[id] = true; s.hold = { id, summary, reason };
    return true;
  }

  function afterJump() {
    const j = J.j, res = j.res;
    const marks = judgeMarks(res, judgeRng);
    const sc = scoreJump(hill, res, marks, j.wind, s.gate);
    s.res = { ...res, marks, ...sc, kindText: KIND_TEXT[res.kind], gate: s.gate, wind: { head: j.wind.head, cross: j.wind.cross }, round: s.round };
    s.you.jumps.push({ dist: res.dist, pts: sc.total, kind: res.kind, round: s.round });
    s.you.total = s.you.jumps.reduce((a, b) => a + b.pts, 0);
    s.you.best = Math.max(s.you.best, res.dist);
    // the rivals jump in this round too
    for (const r of s.rivals) { const rj = rivalJump(r); r.jumps.push(rj); r.total += rj.pts; }
    s.standings = standings();
    s.ph = 'judge'; s.pt = 0;
    emit({ type: 'judge', pts: sc.total, dist: res.dist, kind: res.kind, fall: res.fall });
  }

  function next() {
    if (s.ph === 'judge') {
      if (mode === 'practice') { s.over = true; s.ph = 'end'; emit({ type: 'end' }); return; }
      s.ph = 'board'; s.board = s.standings; s.replay = null; return;
    }
    if (s.ph === 'board') {
      s.round++;
      if (s.round >= rounds) { s.over = true; s.ph = 'end'; emit({ type: 'end' }); return; }
      s.wind = newWind(); s.gate = 1; s.ph = 'gate'; s.board = null; J = null; s.jump = null; s.res = null; s.hold = null; s.watched = {};
      if (s.hasHolds) holdGate();
    }
  }
  function holdGate() {
    const w = s.wind;
    holdAt('gate', `Choose a start gate`, `${hill.name}, K ${hill.k}. Wind: ${w.head >= 0 ? `${w.head.toFixed(1)} m/s head wind` : `${(-w.head).toFixed(1)} m/s tail wind`}, cross wind ${Math.abs(w.cross).toFixed(1)} m/s. A higher gate gives more speed and a longer jump but costs 4.2 points; a lower gate adds 4.2 points. The middle gate is the safe choice.`);
  }
  if (s.hasHolds) holdGate();

  function suggest() {
    const w = s.wind, j = s.jump;
    if (s.ph === 'gate') {
      return { summary: 'Choose a gate', reason: `Wind ${w.head >= 0 ? w.head.toFixed(1) + ' m/s head' : (-w.head).toFixed(1) + ' m/s tail'}. A tail wind makes the air thinner under you, so a higher gate helps. With a head wind the middle or low gate is enough. The high gate costs 4.2 points and the low gate adds 4.2.` };
    }
    if (s.ph === 'run' && j) {
      if (j.ph === 'ready' || (j.ph === 'slide' && !j.zone)) return { summary: 'Stay tucked', reason: 'Keep your finger down (or hold Space) so you stay small in the air and gain speed on the in-run. Watch the ring on the lip: it closes at the take-off.' };
      if (j.ph === 'slide') return { summary: 'Jump at the lip', reason: 'Lift your finger (or tap) just as the ring closes on the take-off marker. About 0.03 s early or late is a perfect jump; the further off, the less lift you get.' };
      if (j.ph === 'air') {
        const diff = (j.alpha - j.band) * 57.3;
        const a = Math.abs(diff) <= j.bandHalf * 57.3 ? 'You are inside the green band. Hold it.' : diff > 0 ? 'Your angle is above the band: drag DOWN a little.' : 'Your angle is below the band: drag UP a little.';
        const lean = Math.abs(j.beta) > 0.06 ? ` You are leaning ${j.beta > 0 ? 'right' : 'left'}: drag ${j.beta > 0 ? 'left' : 'right'} to level the skis.` : ' The skis are level.';
        return { summary: 'Fly in the band', reason: `${a}${lean} Near the end, lift your finger as the ring closes to land.` };
      }
      if (j.ph === 'land') return { summary: 'Landing', reason: 'Lift your finger (or tap) as the ring closes to land in a telemark.' };
    }
    if (s.ph === 'judge') return { summary: 'The judges', reason: 'Your points are the distance points, the style marks (five judges, the highest and lowest are dropped), plus or minus wind and gate compensation.' };
    return { summary: 'Next', reason: 'Tap Next to continue.' };
  }

  function updateRun() {
    const j = J.j;
    // watch & learn: stop at the interesting moments
    if (s.hasHolds && !s.hold) {
      if (j.ph === 'ready' && j.t < 0.05) { if (holdAt('tuck', 'Get into the tuck', 'Hold the screen to crouch on the in-run. A tight crouch is fast. The ring on the take-off lip will close just before the jump.')) return; }
      if (j.ph === 'slide' && j.tl <= 0.85 && j.tl > 0) { if (holdAt('takeoff', 'The take-off', 'The ring closes on the lip. Lifting at the moment it closes gives a perfect jump. Too early loses speed, too late loses height.')) return; }
      if (j.ph === 'air' && j.air > 0.1 && j.air < 0.6) { if (holdAt('flight', 'Hold the band', `Now the flight. The green band is where your skis make the most lift, and it moves as you fly: steep at first, flatter later. Drag up or down to keep the marker in it, and drag sideways to keep the skis level. Wind ${s.wind.cross >= 0 ? 'pushes to the right' : 'pushes to the left'}.`)) return; }
      if (j.ph === 'air' && j.tg > 0 && j.tg <= 0.85 && j.air > 1) { if (holdAt('landing', 'Land in a telemark', 'The snow is coming. Lift your finger as the ring closes on the ground to land softly, one ski ahead of the other.')) return; }
    }
    J.step(input);
    for (const e of j.events) emit(e);
    if (j.ph === 'done' && !s.res) afterJump();
  }

  const S = {
    s, hill, level: lvl,
    input(i) { input = { down: !!i.down, pressed: !!i.pressed, released: !!i.released, sx: i.sx || 0, sy: i.sy || 0 }; },
    gate(g) { if (s.ph === 'gate') s.gate = clamp(g, 0, 2); },
    go() { if (s.ph === 'gate') startJump(); },
    next, suggest,
    release() { s.hold = null; },
    startReplay() { if (s.jump && s.jump.frames.length > 4) { const f = s.jump.frames; s.replay = { t: 0, end: f[f.length - 1][0] }; } },
    stopReplay() { s.replay = null; },
    update(dt) {
      if (s.replay) { s.replay.t += dt * 0.5; if (s.replay.t >= s.replay.end + 0.6) s.replay = null; return; }
      if (s.hold) return;
      s.t += dt;
      if (s.ph === 'run') updateRun(); else s.pt += dt;
      input = { ...input, pressed: false, released: false };
    },
  };
  return S;
}
export { GATES, ZONE };
