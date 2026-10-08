// Table Tennis Rally: flow and state. Drawing is in screens.js, the rules/physics in sim.js, the opponents in ai.js/profiles.js.
// Scenes: title, modes, quick, tour, cup, play (match / practice / lesson / watch & learn), result, settings, about, how, rules, demo-limit.
import { layoutFor, TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { createUI, inRect } from './ui.js';
import { createControl } from './control.js';
import { fitCamera } from './cam.js';
import { createSim } from './sim.js';
import { OPPONENTS, CUPS, opponentById, FILLER } from './profiles.js';
import { draw, titleRegion } from './screens.js';
import { readSpin, spinLabel } from './strokes.js';
import { KINDS } from './shots.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
export { host };

const DEMO_MATCHES = 2;
const COACH_PROFILE = { id: 'coach', name: 'Coach', style: 'allround', aggression: 0.55, place: 'mixed', serve: [3, 3, 3], weak: null, level: 8 };
const HINTS_PER_MATCH = 3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const DEFAULT_PREFS = { sound: true, assist: 'normal', guide: true, spin: true, trail: true, haptics: true, short: false, zoomIdx: 0, thinkIdx: 1 };
const DEFAULT_PROGRESS = () => ({ cups: Object.fromEntries(CUPS.map((c) => [c.id, { stage: 0, done: false, trophies: 0 }])), stats: { matches: 0, wins: 0, points: 0, bestStreak: 0, longest: 0, fastest: 0, perfect: 0 }, tutorial: false });

const TUT = [
  { say: 'Hold a finger on the table and slide left and right. The paddle follows you.', hint: 'Slide', done: (t) => t.span >= 1.1 },
  { say: 'A ball is coming. Slide under it, then FLICK UP to hit. Return 3 balls.', hint: 'Flick up', done: (t) => t.hits >= 3 },
  { say: 'Now AIM. Flick up and tilt the flick left or right, so the ball goes across the table.', hint: 'Tilt', done: (t) => t.aimed >= 2 },
  { say: 'Backspin balls dip. Read the tag, then LIFT them with a medium flick up (a Loop). Return 3.', hint: 'Loop', done: (t) => t.loops >= 3 },
  { say: 'Topspin kicks forward. Flick DOWN hard (a Chop) or just slide and block. Return 3.', hint: 'Chop', done: (t) => t.chops >= 3 },
];
const tutFeed = (st) => (w, rng) => {
  const step = st.tut ? st.tut.step : 0;
  const spin = step === 3 ? -330 : step === 4 ? 420 : 0;
  return { kind: 'serveSpin', tx: rng.range(-0.5, 0.5), depth: 0.95, speed: step <= 2 ? 5.2 : 6.4, top: spin, side: 0, risk: 0.6, maxPitch: 0.1, serve: true };
};

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const ui = createUI();
  const ctl = createControl();
  const state = {
    scene: 'title', sceneT: 0, t: 0, dev: config.dev === true,
    prefs: { ...DEFAULT_PREFS }, progress: DEFAULT_PROGRESS(), demoMatches: 0,
    quick: { opp: 'tanaka', bestOf: 3 }, cupSel: 'club', match: null, w: null, intro: null, banner: null, pops: [], hint: null, think: null,
    paused: false, confirm: null, result: null, hintsLeft: HINTS_PER_MATCH, padTouch: false, tut: null, licenses: '', msg: null,
    rulesPage: 0, howPage: 0, matchPerfects: 0, endT: 0, serveHint: false,
  };
  Object.defineProperty(state, 'v3', { value: null, writable: true, enumerable: false });
  Object.defineProperty(state, 'cam', { value: null, writable: true, enumerable: false });
  let sim = null, attract = null, seenEv = 0, lastScene = 'title', press = null;
  const zoom = () => TEXT_SCALES[clamp(state.prefs.zoomIdx, 0, TEXT_SCALES.length - 1)];

  // ---- persistence ---------------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => { if (v) { state.prefs = { ...state.prefs, ...v }; audio.setMuted?.(!state.prefs.sound); } });
  storage.get('progress', null).then((v) => { if (v) { const d = DEFAULT_PROGRESS(); state.progress = { ...d, ...v, cups: { ...d.cups, ...(v.cups || {}) }, stats: { ...d.stats, ...(v.stats || {}) } }; } });
  storage.get('demoMatches', 0).then((v) => { state.demoMatches = Math.max(state.demoMatches, v); });
  storage.get('quick', null).then((v) => { if (v) state.quick = { ...state.quick, ...v }; });
  const savePrefs = () => storage.set('prefs', state.prefs);
  const saveProgress = () => { storage.set('progress', state.progress); storage.set('record', { wins: state.progress.stats.wins, bestStreak: state.progress.stats.bestStreak }); };

  const tone = (o) => { if (state.prefs.sound) audio.tone(o); };
  const click = () => tone({ freq: 640, to: 440, dur: 0.05, type: 'triangle', vol: 0.05 });
  const go = (scene) => { state.scene = scene; state.sceneT = 0; ui.resetScroll(); state.msg = null; };

  // ---- matches -------------------------------------------------------------------------------------------------------------
  const cupUnlocked = (i) => state.dev || i === 0 || state.progress.cups[CUPS[i - 1].id].done;

  function startMatch(desc) {
    const counted = desc.kind !== 'auto' && desc.kind !== 'lesson';
    if (config.demo && counted && state.demoMatches >= DEMO_MATCHES) { go('demo-limit'); return; }
    if (config.demo && counted) { state.demoMatches += 1; storage.set('demoMatches', state.demoMatches); }
    const opp = desc.opp ? opponentById(desc.opp) : null;
    const target = state.prefs.short ? 7 : 11;
    const cfg = {
      opp, level: desc.level ?? opp?.level ?? 3, bestOf: desc.bestOf ?? 1, target, assist: state.prefs.assist,
      machine: desc.kind === 'practice' || desc.kind === 'lesson', autoPlay: desc.kind === 'auto', coach: desc.kind === 'auto' ? COACH_PROFILE : null, coachLevel: 8,
      firstServer: desc.firstServer ?? (rng.chance(0.5) ? 'p' : 'o'),
    };
    if (desc.kind === 'lesson') { state.tut = { step: 0, span: 0, hits: 0, aimed: 0, loops: 0, chops: 0, minX: 0, maxX: 0, done: false, doneT: 0 }; cfg.feed = tutFeed(state); cfg.assist = 'easy'; }
    sim = createSim(cfg, rng.fork());
    if (desc.kind === 'lesson') sim.w.lives = 999;
    state.w = sim.w; state.match = { ...desc, opp: opp ?? null, bestOf: cfg.bestOf, target };
    state.intro = desc.kind === 'auto' || desc.kind === 'lesson' || desc.kind === 'practice' ? { t: 0, dur: 1.2 } : { t: 0, dur: 3.2 };
    state.paused = false; state.confirm = null; state.hint = null; state.think = null; state.banner = null; state.pops = []; state.hintsLeft = HINTS_PER_MATCH;
    state.result = null; seenEv = 0; ctl.reset(); state.padTouch = false; state.matchPerfects = 0; state.endT = 0;
    go('play');
    monetization.track('match_start', { kind: desc.kind, opp: desc.opp ?? '', level: cfg.level });
  }
  const isAuto = () => !!state.match && state.match.kind === 'auto';

  function finishMatch() {
    const w = sim.w, m = state.match;
    const win = !!w.over && w.over.winner === 'p';
    const R = { kind: m.kind, win, games: { ...w.games }, score: { ...w.score }, opp: m.opp, stats: { ...w.stats }, cupId: m.cupId, round: m.round, bestOf: m.bestOf, streak: w.stats.bestStreak, newBest: false, cupDone: false, eliminated: false, unlocked: null, perfects: state.matchPerfects };
    if (m.kind === 'practice') {
      if (w.stats.bestStreak > state.progress.stats.bestStreak) { R.newBest = true; state.progress.stats.bestStreak = w.stats.bestStreak; }
    } else if (m.kind === 'quick' || m.kind === 'cup') {
      const s = state.progress.stats; s.matches += 1; if (win) s.wins += 1; s.points += w.stats.won; s.longest = Math.max(s.longest, w.stats.longest); s.fastest = Math.max(s.fastest, Math.round(w.stats.fastest * 3.6)); s.perfect += state.matchPerfects;
      if (m.kind === 'cup') {
        const c = state.progress.cups[m.cupId], def = CUPS.find((x) => x.id === m.cupId);
        if (win) {
          c.stage = m.round + 1;
          if (c.stage >= 3) { c.done = true; c.stage = 3; c.trophies += 1; R.cupDone = true; const idx = CUPS.indexOf(def); if (idx + 1 < CUPS.length) R.unlocked = CUPS[idx + 1].name; }
        } else { c.stage = 0; R.eliminated = true; }
      }
    }
    if (m.kind !== 'auto' && m.kind !== 'lesson') saveProgress();
    state.result = R; state.matchPerfects = 0;
    monetization.track('match_end', { kind: m.kind, win, score: `${w.games.p}-${w.games.o}` });
    go('result');
  }

  // ---- events from the simulation ---------------------------------------------------------------------------------------------
  function say(text, sub, color, hold = 1.6, big = false) { state.banner = { text, sub: sub ?? '', color: color ?? '#fff', t: 0, hold, big }; }
  function pop(text, color, x, y, z, size = 1) { if (state.pops.some((q) => q.text === text && q.t < 0.5)) return; state.pops.push({ text, color, x, y, z, t: 0, life: 1.05, size }); if (state.pops.length > 6) state.pops.shift(); }
  const whyLine = (e) => {
    const mine = e.winner === 'p', y = e.why;
    return y === 'winner' ? (mine ? 'Opponent could not return it' : 'You could not return it') : y === 'out' ? (mine ? 'Opponent hit it out' : 'Your ball went out') : y === 'net' ? (mine ? 'Opponent hit the net' : 'Your ball hit the net') : y === 'own side' ? (mine ? 'Opponent’s ball bounced on their side' : 'Your ball bounced on your side') : y === 'serve fault' ? (mine ? 'Opponent’s serve was a fault' : 'Your serve was a fault') : y === 'missed' ? (mine ? 'Opponent missed' : 'You missed the ball') : '';
  };
  function tutHit(e) {
    const t = state.tut; if (!t || t.done) return;
    t.hits += 1;
    if (Math.abs(e.tx - e.x) > 0.3) t.aimed += 1;
    if (e.kind === 'loop' || e.kind === 'drive') t.loops += 1;
    if (e.kind === 'chop' || e.kind === 'push' || e.kind === 'block') t.chops += 1;
  }
  function handleEvents() {
    const w = sim.w, m = state.match;
    for (const e of w.events) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      if (e.type === 'point') {
        const mine = e.winner === 'p';
        if (m.kind === 'practice' || m.kind === 'lesson') {
          if (mine) say(`${w.streak} IN A ROW`, '', '#ffd25a', 0.9);
          else say('MISS', w.lives > 0 ? `${w.lives} ${w.lives === 1 ? 'life' : 'lives'} left` : 'Out of lives', '#ff8a8a', 1.3);
        } else {
          const line = e.why === 'winner' ? (mine ? (e.hits <= 2 ? 'ACE' : 'WINNER') : 'TOO GOOD') : mine ? 'POINT' : 'LOST POINT';
          say(line, whyLine(e), mine ? '#ffd25a' : '#9fb2d6', 1.6, true);
        }
      } else if (e.type === 'let') say('LET', 'The serve touched the net. Serve again.', '#cfe6ff', 1.2);
      else if (e.type === 'game') say(e.winner === 'p' ? 'GAME!' : 'GAME LOST', `${e.score.p} - ${e.score.o}`, e.winner === 'p' ? '#ffd25a' : '#9fb2d6', 2.6, true);
      else if (e.type === 'hit' && e.side === 'p') {
        if (m.kind === 'lesson') tutHit(e);
        if (e.perfect && !e.serve) { pop('PERFECT', '#ffe27a', e.x, e.y + 0.1, e.z, 1.1); state.matchPerfects += 1; }
        else if (e.q < 0.42 && !e.serve) pop('SLOPPY', '#ff9a9a', e.x, e.y + 0.1, e.z);
        else if (!e.serve && e.kind === 'smash') pop('SMASH!', '#ff8a2a', e.x, e.y + 0.1, e.z, 1.2);
      } else if (e.type === 'whiff' && e.side === 'p') pop('MISSED', '#ff9a9a', w.pad.p.x, 1.0, 1.7);
      else if (e.type === 'swing' && e.side === 'p' && !e.hit) pop('NOT YET', '#ffd0a0', w.pad.p.x, 1.05, 1.7, 0.8);
    }
  }

  // ---- coach (Watch & Learn and hints) ---------------------------------------------------------------------------------------------
  const REASON = {
    loop: 'A Loop lifts the ball with topspin. It beats backspin and keeps the ball on the table.',
    drive: 'A Drive is fast and flat. It works when the ball has little spin.',
    push: 'A Push sends heavy backspin back low and short. Safe against backspin.',
    chop: 'A Chop is a defensive stroke with heavy backspin. It handles topspin well.',
    block: 'A Block just returns the pace with a firm paddle. Good against topspin.',
    touch: 'A Touch is soft and short, to stop the opponent from attacking.',
    smash: 'The ball is high, so it hits a Smash, the fastest stroke.',
    lob: 'A Lob defends with a very high ball while it recovers.',
    flick: 'A Flick attacks a short ball quickly.',
    serveShort: 'A short serve with backspin makes the first attack hard.', serveLong: 'A long fast serve rushes the opponent.', serveSpin: 'A spin serve makes the return awkward.',
  };
  function describePlan(sw, ball) {
    const it = sw.intent, K = KINDS[it.kind];
    const where = it.tx < -0.25 ? 'left' : it.tx > 0.25 ? 'right' : 'middle';
    const sp = spinLabel(readSpin(ball));
    const kmh = Math.round(Math.hypot(ball.v[0], ball.v[1], ball.v[2]) * 3.6);
    const incoming = sw.serve ? 'The coach serves' : `Incoming: ${sp.text}, ${kmh} km/h`;
    return { incoming, plan: `${K.label} to the ${where}${Math.abs(it.tx) > 0.5 ? ' corner' : ''}`, why: REASON[it.kind] ?? '', tx: it.tx, depth: it.depth, kind: it.kind };
  }
  function checkCoach() {
    const w = sim.w, sw = w.pad.p.swing;
    if (w.auto.p && sw && !sw.seen && !sw.done && (sw.auto || sw.serve) && sw.intent) {
      sw.seen = true;
      state.think = { phase: 'think', t: 0, dur: THINK_STEPS[clamp(state.prefs.thinkIdx, 0, THINK_STEPS.length - 1)], info: describePlan(sw, w.ball) };
    }
  }
  const flickFor = (kind) => (kind === 'push' || kind === 'chop' ? 'down' : kind === 'block' ? 'slide' : 'up');
  function useHint() {
    const w = sim.w;
    if (state.hint || state.hintsLeft <= 0 || state.match.kind === 'practice' || state.match.kind === 'lesson') return;
    if (w.phase === 'serve' && w.server === 'p') {
      const o = state.match.opp;
      const tips = o && o.weak ? { backspin: 'Serve short with backspin: it struggles with heavy backspin.', topspin: 'Send fast topspin: it struggles against heavy topspin.', wide: 'Aim for the wide corners: it stretches badly.', short: 'Serve short: it is slow to short balls.', speed: 'Serve long and fast: it cannot cope with speed.' }[o.weak] : 'Mix short backspin serves and fast long serves.';
      state.hint = { t: 0, dur: 3.5, text: tips, plan: null, serve: true }; state.hintsLeft -= 1; return;
    }
    if (w.phase !== 'rally' || w.rally.hitter !== 'o' || w.rally.bounce.p > 1) return;
    const plan = sim.coachPlan();
    if (!plan) return;
    const it = plan.intent, K = KINDS[it.kind];
    const where = it.tx < -0.25 ? 'left' : it.tx > 0.25 ? 'right' : 'middle';
    const sp = spinLabel(plan.spin);
    state.hint = { t: 0, dur: 3.4, text: `${sp.text}. Try a ${K.label} to the ${where}. ${REASON[it.kind] ?? ''}`, plan: { tx: it.tx, depth: it.depth, kind: it.kind, flick: flickFor(it.kind) }, serve: false };
    state.hintsLeft -= 1;
  }

  // ---- scene updates ------------------------------------------------------------------------------------------------------------
  function tutProgress(dt) {
    const t = state.tut;
    if (t.done) { t.doneT += dt; if (t.doneT > 2.4) { state.progress.tutorial = true; saveProgress(); leaveMatch('title'); } return; }
    if (TUT[t.step].done(t)) {
      tone({ freq: 660, to: 990, dur: 0.18, type: 'triangle', vol: 0.07 });
      if (t.step + 1 >= TUT.length) { t.done = true; t.doneT = 0; } else { t.step += 1; t.hits = 0; t.aimed = 0; t.loops = 0; t.chops = 0; }
    }
  }
  function updatePlay(dt, input) {
    const L = layoutFor(meta.width, meta.height, zoom());
    const m = state.match, p = input.pointer;
    if (state.banner) { state.banner.t += dt; if (state.banner.t > state.banner.hold) state.banner = null; }
    for (const q of state.pops) q.t += dt;
    state.pops = state.pops.filter((q) => q.t < q.life);
    if (state.intro) {
      if (!state.paused) state.intro.t += dt;
      if (state.intro.t >= state.intro.dur) { state.intro = null; sim.startMatch(); }
      return;
    }
    if (state.paused) return;
    if (state.think) {
      const th = state.think; th.t += dt;
      if (th.t >= th.dur) { if (th.phase === 'think') { th.phase = 'reveal'; th.t = 0; th.dur = 2; } else state.think = null; }
      return;
    }
    if (state.hint) { state.hint.t += dt; if (state.hint.t >= state.hint.dur) { state.hint = null; sim.w.slow = 1; } else sim.w.slow = 0.2; }
    const autoPlay = isAuto();
    let ctrl = { x: null, flick: null };
    if (!autoPlay) {
      if (p.pressed) state.padTouch = !ui.at(p.x, p.y) && inRect(L.play, p.x, p.y);
      if (!p.down) state.padTouch = false;
      const c = ctl.update(dt, p, input.keys, state.cam, L.play, state.padTouch);
      ctrl = { x: c.x, flick: c.flick };
      if (c.x !== null && state.tut) { state.tut.minX = Math.min(state.tut.minX, c.x); state.tut.maxX = Math.max(state.tut.maxX, c.x); state.tut.span = state.tut.maxX - state.tut.minX; }
    }
    sim.update(dt, ctrl);
    handleEvents();
    if (autoPlay) checkCoach();
    if (m.kind === 'lesson' && state.tut) tutProgress(dt);
    const w = sim.w;
    if (w.phase === 'over') { state.endT += dt; if (state.endT > (m.kind === 'practice' ? 1.2 : 2.4)) { state.endT = 0; finishMatch(); } } else state.endT = 0;
    state.serveHint = w.phase === 'serve' && w.server === 'p' && !autoPlay && !state.banner && w.phaseT > 0.3 && m.kind !== 'practice' && m.kind !== 'lesson';
  }
  function updateAttract(dt) {
    if (!attract) {
      attract = createSim({ opp: opponentById('chen'), level: 6, autoPlay: true, coach: opponentById('eriksen'), coachLevel: 6, target: 99, bestOf: 99, assist: 'normal', firstServer: 'o' }, rng.fork());
      attract.startMatch();
    }
    attract.update(dt, null);
  }

  // ---- actions (taps) ------------------------------------------------------------------------------------------------------------
  function leaveMatch(toScene = 'title') {
    state.tut = null; sim = null; state.w = null; state.match = null; state.intro = null; state.think = null; state.hint = null; state.banner = null; state.paused = false; state.confirm = null;
    go(toScene);
  }
  function act(id, data) {
    const sc = state.scene, pr = state.prefs;
    click();
    if (id === 'zoom-') { pr.zoomIdx = Math.max(0, pr.zoomIdx - 1); ui.resetScroll(); savePrefs(); return; }
    if (id === 'zoom+') { pr.zoomIdx = Math.min(TEXT_SCALES.length - 1, pr.zoomIdx + 1); ui.resetScroll(); savePrefs(); return; }
    if (id === 'back') { if (sc === 'cup') go('tour'); else if (sc === 'quick' || sc === 'tour') go('modes'); else go('title'); return; }
    if (id === 'logo') { env.openArcforgeHome?.(); return; }
    if (sc === 'title') {
      if (id === 'play') go('modes');
      else if (id === 'tournament') go('tour');
      else if (id === 'practice') startMatch({ kind: 'practice' });
      else if (id === 'watch') startMatch({ kind: 'auto', opp: 'eriksen', bestOf: 1, firstServer: 'o' });
      else if (id === 'how') { state.howPage = 0; go('how'); }
      else if (id === 'rules') { state.rulesPage = 0; go('rules'); }
      else if (id === 'about') go('about');
      else if (id === 'settings') go('settings');
      return;
    }
    if (sc === 'modes') {
      if (id === 'm:quick') go('quick');
      else if (id === 'm:tour') go('tour');
      else if (id === 'm:practice') startMatch({ kind: 'practice' });
      else if (id === 'm:lesson') startMatch({ kind: 'lesson' });
      else if (id === 'm:watch') startMatch({ kind: 'auto', opp: 'eriksen', bestOf: 1, firstServer: 'o' });
      return;
    }
    if (sc === 'quick') {
      if (id.startsWith('opp:')) state.quick.opp = id.slice(4);
      else if (id.startsWith('bo:')) state.quick.bestOf = Number(id.slice(3));
      else if (id === 'start') { storage.set('quick', state.quick); startMatch({ kind: 'quick', opp: state.quick.opp, bestOf: state.quick.bestOf }); }
      return;
    }
    if (sc === 'tour') {
      if (id.startsWith('cup:')) { const i = CUPS.findIndex((c) => c.id === id.slice(4)); if (cupUnlocked(i)) { state.cupSel = CUPS[i].id; go('cup'); } else state.msg = { text: 'Win the previous cup to open this one.', t: 0 }; }
      return;
    }
    if (sc === 'cup') {
      if (id === 'cup:play') {
        const def = CUPS.find((c) => c.id === state.cupSel), c = state.progress.cups[def.id];
        if (c.done) c.stage = 0;
        startMatch({ kind: 'cup', cupId: def.id, round: c.stage, opp: def.rounds[c.stage], bestOf: def.bestOf[c.stage] });
      }
      return;
    }
    if (sc === 'play') {
      if (id === 'pause') state.paused = true;
      else if (id === 'resume') { state.paused = false; state.confirm = null; }
      else if (id === 'hint') useHint();
      else if (id === 'leave') state.confirm = 'leave';
      else if (id === 'leave:no') state.confirm = null;
      else if (id === 'leave:yes') leaveMatch(state.match.kind === 'cup' ? 'cup' : 'title');
      else if (id === 'a:exit') leaveMatch('title');
      else if (id === 'a:pause') state.paused = !state.paused;
      else if (id === 'a:dec') { pr.thinkIdx = Math.max(0, pr.thinkIdx - 1); savePrefs(); }
      else if (id === 'a:inc') { pr.thinkIdx = Math.min(THINK_STEPS.length - 1, pr.thinkIdx + 1); savePrefs(); }
      else if (id === 'p:sound') { pr.sound = !pr.sound; audio.setMuted?.(!pr.sound); savePrefs(); }
      else if (id === 'p:guide') { pr.guide = !pr.guide; savePrefs(); }
      else if (id === 'skipintro') { if (state.intro) state.intro.t = state.intro.dur; }
      else if (id === 'skip' && state.tut) state.tut.step = Math.min(TUT.length - 1, state.tut.step + 1);
      return;
    }
    if (sc === 'result') {
      const r = state.result, m = state.match;
      if (id === 'again') {
        if (m.kind === 'cup') { const def = CUPS.find((c) => c.id === m.cupId), c = state.progress.cups[def.id]; if (c.done) c.stage = 0; startMatch({ kind: 'cup', cupId: def.id, round: c.stage, opp: def.rounds[c.stage], bestOf: def.bestOf[c.stage] }); }
        else startMatch({ ...m, opp: m.opp ? m.opp.id : undefined, firstServer: undefined });
      } else if (id === 'menu') leaveMatch('title');
      else if (id === 'cupmenu') leaveMatch('cup');
      else if (id === 'share') env.share?.(shareText(r));
      return;
    }
    if (sc === 'settings') {
      if (id === 's:sound') { pr.sound = !pr.sound; audio.setMuted?.(!pr.sound); }
      else if (id === 's:guide') pr.guide = !pr.guide;
      else if (id === 's:spin') pr.spin = !pr.spin;
      else if (id === 's:trail') pr.trail = !pr.trail;
      else if (id === 's:haptics') pr.haptics = !pr.haptics;
      else if (id === 's:short') pr.short = !pr.short;
      else if (id.startsWith('s:assist:')) pr.assist = id.slice(9);
      else if (id === 's:restore') monetization.restore?.();
      else if (id === 's:reset') { state.confirm = 'reset'; return; }
      else if (id === 's:reset:yes') { state.progress = DEFAULT_PROGRESS(); saveProgress(); state.confirm = null; return; }
      else if (id === 's:reset:no') { state.confirm = null; return; }
      else if (id === 's:unlock') state.dev = true;
      savePrefs();
      return;
    }
    if (sc === 'how') {
      if (id.startsWith('how:') && id !== 'how:try') { state.howPage = Number(id.slice(4)); ui.resetScroll(); }
      else if (id === 'how:try') startMatch({ kind: 'lesson' });
      return;
    }
    if (sc === 'rules') { if (id.startsWith('rules:')) { state.rulesPage = Number(id.slice(6)); ui.resetScroll(); } return; }
    if (sc === 'demo-limit') { if (id === 'demo:menu') go('title'); }
  }
  const shareText = (r) => (r.kind === 'practice' ? `I returned ${r.streak} balls in a row in the Table Tennis Rally ball machine challenge!` : `${r.win ? 'I won' : 'I played'} a table tennis match ${r.games.p}-${r.games.o}${r.opp ? ' against ' + r.opp.name : ''} in Table Tennis Rally.`);

  // ---- main update ------------------------------------------------------------------------------------------------------------------
  function update(dt, input) {
    state.t += dt;
    if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
    const p = input.pointer;
    if (wheelInput.dy) { ui.scrollWheel(input.pointer, wheelInput.dy); wheelInput.dy = 0; }
    if (state.msg) { state.msg.t += dt; if (state.msg.t > 3.5) state.msg = null; }
    const sc = state.scene;
    const dragging = ui.scrollInput(p);
    if (p.pressed) { const h = ui.at(p.x, p.y); press = h ? { id: h.id, data: h.data } : null; ui.pressedId = press ? press.id : null; }
    let acted = null;
    if (press && !p.down) {
      if (!dragging) { const h = ui.at(p.x, p.y); if (h && h.id === press.id) acted = h; }
      press = null; ui.pressedId = null;
    }
    const kp = input.keys.pressed;
    if (kp.has('Escape')) { if (sc === 'play') acted = { id: state.paused ? 'resume' : 'pause' }; else if (sc !== 'title') acted = { id: 'back' }; }
    if (kp.has('Enter') && ui.primary && sc !== 'play') acted = { id: ui.primary };
    if (acted) act(acted.id, acted.data);
    if (state.scene === 'play') updatePlay(dt, input);
    else if (state.scene === 'title' || state.scene === 'modes') updateAttract(dt);
  }

  // ---- publishing the 3D scene state ------------------------------------------------------------------------------------------------
  function publish(L) {
    const sc = state.scene;
    const live = sc === 'play' && sim ? sim : (sc === 'title' || sc === 'modes') && attract ? attract : null;
    if (!live) { state.v3 = { on: false, events: [], t: 0 }; state.cam = null; return; }
    const w = live.w;
    let region, mode, drift = 0;
    if (sc === 'play') { region = L.region; mode = L.camMode; }
    else { region = titleRegion(L); mode = 'title'; drift = Math.sin(state.t * 0.25) * 0.28; }
    state.cam = fitCamera(region, L.w, L.h, mode, null, drift);
    const sp = readSpin(w.ball);
    const speed = Math.hypot(w.ball.v[0], w.ball.v[1], w.ball.v[2]);
    state.v3 = {
      on: true, t: w.t + w.acc, dtReal: 1 / 60, cam: { eye: state.cam.eye, at: state.cam.at, f: state.cam.f, cx: state.cam.cx, cy: state.cam.cy },
      ball: live.ballRender(), spinW: w.ball.w, ballVisible: w.phase !== 'intro', trailOn: state.prefs.trail && speed > 3.2 && w.phase === 'rally', speed,
      trailColor: Math.abs(sp.top) < 0.2 && Math.abs(sp.side) < 0.2 ? 0xffffff : Math.abs(sp.side) > Math.abs(sp.top) ? 0x7dffb0 : sp.top > 0 ? 0xffa24a : 0x6fd8ff,
      pads: { p: { x: w.pad.p.x, swing: w.pad.p.swing }, o: { x: w.pad.o.x, swing: w.pad.o.swing } },
      spinColor: Math.abs(sp.top) < 0.2 && Math.abs(sp.side) < 0.2 ? 0xffe27a : Math.abs(sp.side) > Math.abs(sp.top) ? 0x7dffb0 : sp.top > 0 ? 0xffa24a : 0x6fd8ff,
      events: w.events, muted: !state.prefs.sound, silent: sc !== 'play', machine: !!w.machine,
      theme: { hue: state.match && state.match.cupId ? (CUPS.find((c) => c.id === state.match.cupId)?.hue ?? 205) : 205 },
      haptics: state.prefs.haptics && sc === 'play' && !isAuto(), ambience: sc === 'play',
      flickGlow: state.prefs.guide && sc === 'play' && w.guide && w.phase === 'rally' && w.rally.hitter === 'o' && !w.pad.p.swing ? clamp(1 - Math.abs(w.t + w.acc - w.guide.tFlick) / 0.12, 0, 1) : 0, auto: isAuto(),
      phase: w.phase, server: w.server, oppHue: state.match && state.match.opp ? state.match.opp.hue : 5,
    };
  }

  return {
    update,
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, zoom());
      ui.begin(view?.cssPerUnit ?? meta.cssPerUnit ?? 0.55, state.t);
      ui.primary = null;
      publish(L);
      if (state.scene === 'play') meta.previewBadge = L.mode === 'wide' ? { x: L.region.x + L.region.w / 2, y: L.U.y + 6, align: 'center' } : { x: L.U.x + L.U.w - 14, y: L.top.y + L.top.h + 2, align: 'right' };
      draw(ctx, { state, L, ui, sim, attract, zoom: zoom(), TUT, cupUnlocked, OPPONENTS, CUPS, FILLER, RULES, config, THINK_STEPS, TEXT_SCALES });
    },
    getState: () => state,
    setLicenses(text) { state.licenses = text; },
    isPreviewExempt() { return !(state.scene === 'play' && !state.paused && !state.intro && state.match && state.match.kind !== 'auto' && state.match.kind !== 'lesson' && !(state.w && state.w.phase === 'over')); },
    __debug: { go, startMatch, act, sim: () => sim },
  };
}
