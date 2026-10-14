// The competition around the jump: the pole mark, the jump itself (jump.js), the rivals and the medal table. Pure and deterministic.
// Phases per attempt: setup -> run (run-up, plant, climb, let-go, landing) -> judge (the measured mark) -> board (standings) -> ... -> end.
import { createJump, makeWind, levelById, DT, LEANS } from './jump.js';
import { createPilot } from './pilot.js';
import { venueById, STANDS } from './venues.js';
export { DT };

export const RIVAL_NAMES = ['Sjoerd', 'Anke', 'Tjeerd', 'Hanna', 'Jelle', 'Femke', 'Douwe'];
const RIVAL_SKILL = [0.95, 0.86, 0.77, 0.68, 0.58, 0.48, 0.38];
export const MEDALS = ['Gold', 'Silver', 'Bronze'];
export const KIND_TEXT = { clean: 'Clean landing', rough: 'Rough landing (half a metre off)', splash: 'In the water', stall: 'The pole stalled and swung back', short: 'Leapt too early, short of the pole' };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r1 = (x) => Math.round(x * 10) / 10;

export function createSim(opts, rng) {
  const venue = venueById(opts.venue), level = opts.level || 2, lvl = levelById(level);
  const mode = opts.mode || 'comp';                    // comp | daily | practice | watch
  const rounds = mode === 'practice' ? 1 : opts.rounds || 3;
  const rivalCount = mode === 'practice' ? 0 : 7;
  const s = {
    t: 0, mode, venue: venue.id, level, rounds, round: 0, ph: 'setup', stand: 1, wind: null, jump: null, res: null, hold: null,
    events: [], evId: 0, over: false, replay: null,
    you: { jumps: [], best: 0 },
    rivals: Array.from({ length: rivalCount }, (_, i) => ({ name: RIVAL_NAMES[i], skill: RIVAL_SKILL[i], jumps: [], best: 0 })),
    board: null, standings: [], pt: 0, hasHolds: !!opts.hold, watched: {},
  };
  let J = null, input = { down: false, pressed: false, released: false };
  const evRng = rng.fork(), windRng = rng.fork(), rivRng = rng.fork();
  const emit = (e) => { s.events.push({ id: ++s.evId, t: s.t, ...e }); if (s.events.length > 40) s.events.shift(); };

  const newWind = () => makeWind(windRng, venue, lvl);
  s.wind = newWind();

  // a computer jumper for the rivals: a full jump with the pilot, same wind as the round
  function rivalJump(r) {
    const rr = rivRng.fork();
    const sk = clamp(r.skill + lvl.rival + rr.range(-0.04, 0.03), 0.2, 0.97);
    const stand = sk > 0.8 || venue.W > 17 ? 1 : 0;
    const jp = createJump({ venue, wind: s.wind, level, rng: rr.fork(), stand });
    const pilot = createPilot(rr.fork(), sk);
    for (let k = 0; k < 3600 && jp.j.ph !== 'done'; k++) jp.step(pilot(jp));
    const res = jp.j.res;
    return { dist: res.dist, kind: res.kind };
  }

  function standings() {
    const rows = [{ name: 'You', you: true, best: you().best, jumps: s.you.jumps.map((j) => ({ dist: j.dist, kind: j.kind })) }];
    for (const r of s.rivals) rows.push({ name: r.name, you: false, best: r.best, jumps: r.jumps });
    rows.sort((a, b) => b.best - a.best || secondBest(b) - secondBest(a) || (a.you ? -1 : 1));
    rows.forEach((x, i) => { x.rank = i + 1; x.best = r1(x.best); });
    return rows;
  }
  const you = () => s.you;
  const secondBest = (row) => { const d = row.jumps.map((j) => j.dist).sort((a, b) => b - a); return d[1] || 0; };

  function startJump() {
    J = createJump({ venue, wind: s.wind, level, rng: evRng.fork(), stand: s.stand });
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
    s.res = { ...res, kindText: KIND_TEXT[res.kind], stand: s.stand, wind: { head: j.wind.head, cross: j.wind.cross }, round: s.round, pb: false };
    s.you.jumps.push({ dist: res.dist, kind: res.kind, round: s.round });
    s.you.best = Math.max(s.you.best, res.dist);
    for (const r of s.rivals) { const rj = rivalJump(r); r.jumps.push(rj); r.best = Math.max(r.best, rj.dist); }
    s.standings = standings();
    s.ph = 'judge'; s.pt = 0;
    emit({ type: 'judge', dist: res.dist, kind: res.kind, fall: res.fall });
  }

  function next() {
    if (s.ph === 'judge') {
      if (mode === 'practice') { s.over = true; s.ph = 'end'; emit({ type: 'end' }); return; }
      s.ph = 'board'; s.board = s.standings; s.replay = null; return;
    }
    if (s.ph === 'board') {
      s.round++;
      if (s.round >= rounds) { s.over = true; s.ph = 'end'; emit({ type: 'end' }); return; }
      s.wind = newWind(); s.stand = 1; s.ph = 'setup'; s.board = null; J = null; s.jump = null; s.res = null; s.hold = null; s.watched = {};
      if (s.hasHolds) holdSetup();
    }
  }
  const windWords = (w) => `${w.head >= 0 ? `${w.head.toFixed(1)} m/s head wind` : `${(-w.head).toFixed(1)} m/s tail wind`}, cross wind ${Math.abs(w.cross).toFixed(1)} m/s`;
  function holdSetup() {
    holdAt('setup', 'Choose where the pole stands', `${venue.name}: ${venue.W} m of water. Wind: ${windWords(s.wind)}. The middle mark is the usual choice. The far mark reaches 0.7 m further but needs a faster, cleaner run to get the pole over the upright. The near mark is safe but short.`);
  }
  if (s.hasHolds) holdSetup();

  // what to do right now, in words (Think / hints)
  function suggest() {
    const j = s.jump;
    if (s.ph === 'setup') return { summary: 'Choose the mark', reason: `Wind ${windWords(s.wind)}. The middle mark is the safe, usual choice. The far mark gains 0.7 m but the pole needs more speed to go over the upright; it is for a clean runner. The near mark is the safest and loses 0.7 m, enough only on the narrow canals.` };
    if (s.ph === 'run' && j) {
      if (j.ph === 'ready') return { summary: 'Start the run', reason: 'Tap anywhere to set off. Then tap each time the beat marker meets the line: the closer to the beat, the more speed you gain. Eleven or twelve good beats give the full speed.' };
      if (j.ph === 'run' && !j.inZone) return { summary: 'Tap on the beat', reason: 'Follow the footfall marker and tap as it meets the line. Early or late taps gain little, a missed beat costs speed. The pole only passes the upright with enough speed.' };
      if (j.ph === 'run' && j.inZone) return { summary: 'Plant now', reason: `The plant zone is open. Tap when the runner reaches the board, the gold mark on the bank. Too early and you grab the pole low and lose speed, too late and you grab it high and clumsy.` };
      if (j.ph === 'pole') {
        const best = J.bestRelease();
        const safe = j.safe && j.safe.ok;
        const climb = j.theta < -0.04 ? (safe ? 'The pole is still leaning back. Climbing now is safe; the sooner you climb the more height you gain, but if the green light goes out, stop climbing and let the swing carry you over the upright.' : 'The pole is leaning back and the swing is slow: do not climb yet, or it will swing you back into the water. Wait for the pole to pass the upright.') : (j.r < j.rmax - 0.3 ? 'The pole is over the upright. Hold the thumb down to climb to the top; let go of the screen to rest and get your grip back.' : 'You are at the top. Let the pole fall towards the sand.');
        const lg = best ? ` The best moment to let go is in about ${best.t.toFixed(1)} s with the ${LEANS[best.lean].name} lean: about ${best.x.toFixed(1)} m.` : '';
        return { summary: 'Climb and let go', reason: climb + lg };
      }
      if (j.ph === 'air') return { summary: 'In the air', reason: 'You have let go. Nothing more to do: the landing is decided by the speed and angle you left the pole with.' };
    }
    if (s.ph === 'judge') return { summary: 'Your mark', reason: 'The mark is measured from the board to where your feet first touched the sand. Landing in the water counts nothing. A rough landing takes half a metre off.' };
    return { summary: 'Next', reason: 'Tap Next to continue.' };
  }

  function updateRun() {
    const j = J.j;
    if (s.hasHolds && !s.hold) {
      if (j.ph === 'ready' && j.t < 0.05) { if (holdAt('run', 'The run-up', 'Tap to set off, then tap each time the marker meets the beat line. Each good tap adds speed: the pole needs speed to get over the upright.')) return; }
      if (j.ph === 'run' && j.inZone && j.zoneT < 0.05) { if (holdAt('plant', 'The plant', 'The plant zone has opened. Tap when the runner reaches the gold board: that is the moment the leap catches the pole at the best height.')) return; }
      if (j.ph === 'pole' && j.tPole > 0.05) { if (holdAt('climb', 'Climb the pole', 'Hold the thumb down to climb. Before the pole is over the upright, climbing too early can stall it: the green light says when it is safe. Resting restores your grip.')) return; }
      if (j.ph === 'pole' && J.bestRelease() && J.bestRelease().t < 0.7 && j.theta > 0.2) { if (holdAt('letgo', 'Let go', 'The pole is high and falling towards the sand. Let go at the best moment with the lean the forecast flag suggests: a flatter lean is longer, a higher lean hangs more.')) return; }
    }
    J.step(input);
    for (const e of j.events) emit(e);
    j.events.length = 0;
    if (j.ph === 'done' && !s.res) afterJump();
  }

  const S = {
    s, venue, level: lvl, get J() { return J; },
    input(i) { input = { down: !!i.down, pressed: !!i.pressed, released: !!i.released, letgo: i.letgo, lean: i.lean }; },
    stand(g) { if (s.ph === 'setup') s.stand = clamp(g, 0, STANDS.length - 1); },
    go() { if (s.ph === 'setup') startJump(); },
    next, suggest,
    release() { s.hold = null; },
    startReplay() { if (s.jump && s.jump.frames.length > 4) { const f = s.jump.frames; s.replay = { t: f[0][0], end: f[f.length - 1][0] }; } },
    stopReplay() { s.replay = null; },
    update(dt) {
      if (s.replay) { s.replay.t += dt * 0.5; if (s.replay.t >= s.replay.end + 0.6) s.replay = null; return; }
      if (s.hold) return;
      s.t += dt;
      if (s.ph === 'run') updateRun(); else s.pt += dt;
      input = { ...input, pressed: false, released: false, letgo: undefined };
    },
  };
  return S;
}
