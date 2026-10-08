// Dragon Boat Race: flow and state. Drawing is in screens.js / hud.js, the race rules in sim.js, the crews and rivers in crews.js.
// Scenes: title, modes, regatta, quick, drumsel, play (race / drummer / lesson / watch & learn), result, settings, calib, about, how, rules, demo-limit.
import { layoutFor, host } from './layout.js';
import { createUI, inRect } from './ui.js';
import { createRace } from './sim.js';
import { REGATTAS, ROUNDS, THEMES, QUICK_LENGTHS, QUICK_LEVELS, DRUM_CHARTS, CREWS } from './crews.js';
import { clamp, TEXT_SCALES, THINK_STEPS, placeName, HALF_LEN, TIER_LABEL } from './common.js';
import { chaseCam, introCam, finishCam, titleCam } from './cam.js';
import { draw } from './screens.js';
import { RULES, TUT } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
export const touch = { ev: [], now: () => 0 };   // main.js supplies now() (a real clock) so a tap can be dated to when the finger landed       // raw pointer events from main.js (several fingers): { type, id, x, y } in virtual units
export { host };

const DEMO_RACES = 2;
const HINTS_PER_RACE = 3;
const DEFAULT_PREFS = { sound: true, click: false, haptics: true, window: 'normal', offsetMs: 0, zoomIdx: 0, thinkIdx: 1 };
const DEFAULT_PROGRESS = () => ({
  regattas: Object.fromEntries(REGATTAS.map((r) => [r.id, { stage: 0, medal: null, bestTime: 0 }])),
  stats: { races: 0, wins: 0, perfect: 0, bestStreak: 0, medals: 0 },
  drum: { best: 0, charts: {} }, tutorial: false,
});
const MEDALS = ['gold', 'silver', 'bronze'];
const REG_RIVALS = [[0, 1, 2], [1, 3, 4], [2, 4, 5]];
const TUT_COURSE = () => ({ streams: [{ z0: 70, z1: 150, x: 2.5, w: 4.6, k: 1.15 }], flotsam: [{ x: -2.5, z: 205, r: 0.9, kind: 'log', hit: false, spin: 0 }] });
const ATTRACT_THEMES = ['town', 'harbour', 'canal'];

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const ui = createUI();
  const state = {
    scene: 'title', sceneT: 0, t: 0, dev: config.dev === true, gl: false,
    prefs: { ...DEFAULT_PREFS }, progress: DEFAULT_PROGRESS(), demoRaces: 0,
    quick: { theme: 'town', length: 'heat', level: 'medium' }, match: null, intro: null, pops: [], tapLog: [], lastTap: null, think: null, hint: null, hintsLeft: HINTS_PER_RACE,
    paused: false, confirm: null, result: null, tut: null, licenses: '', msg: null, rulesPage: 0, howPage: 0, steer: 0, touchSteer: null, raceId: 0, endT: 0,
    calib: { started: false, beats: [], t: 0, taps: [], need: 8, done: false, result: null, flashAt: -9, next: 0 },
  };
  Object.defineProperty(state, 'v3', { value: { on: false, events: [] }, writable: true, enumerable: false });
  Object.defineProperty(state, 'cam', { value: null, writable: true, enumerable: false });
  let sim = null, attract = null, attractN = 0, lastScene = 'title', press = null, seenEv = 0;
  const zoom = () => TEXT_SCALES[clamp(state.prefs.zoomIdx, 0, TEXT_SCALES.length - 1)];

  // ---- persistence ----------------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => { if (v) { state.prefs = { ...state.prefs, ...v }; audio.setMuted?.(!state.prefs.sound); } });
  storage.get('progress', null).then((v) => {
    if (!v) return;
    const d = DEFAULT_PROGRESS();
    state.progress = { ...d, ...v, regattas: { ...d.regattas, ...(v.regattas || {}) }, stats: { ...d.stats, ...(v.stats || {}) }, drum: { ...d.drum, ...(v.drum || {}), charts: { ...(v.drum?.charts || {}) } } };
  });
  storage.get('demoRaces', 0).then((v) => { state.demoRaces = Math.max(state.demoRaces, v); });
  storage.get('quick', null).then((v) => { if (v) state.quick = { ...state.quick, ...v }; });
  const savePrefs = () => storage.set('prefs', state.prefs);
  const saveProgress = () => { storage.set('progress', state.progress); storage.set('record', { wins: state.progress.stats.wins, medals: state.progress.stats.medals }); };

  const tone = (o) => { if (state.prefs.sound) audio.tone(o); };
  const click = () => tone({ freq: 640, to: 440, dur: 0.05, type: 'triangle', vol: 0.05 });
  const go = (scene) => { state.scene = scene; state.sceneT = 0; ui.resetScroll(); state.msg = null; state.confirm = null; };
  const regattaUnlocked = (i) => state.dev || i === 0 || !!state.progress.regattas[REGATTAS[i - 1].id].medal;

  // ---- building a race ----------------------------------------------------------------------------------------------------
  const pickRivals = (r, n = 3) => r.shuffle(CREWS.map((c) => c.id)).slice(0, n);
  function configFor(desc) {
    const base = { window: state.prefs.window, offset: state.prefs.offsetMs / 1000, name: 'You' };
    if (desc.kind === 'regatta') {
      const rg = REGATTAS.find((x) => x.id === desc.reg), rd = ROUNDS[desc.stage];
      return { ...base, theme: rg.theme, len: rd.len, P0: rd.P0, level: rg.base + rd.level * 1.3, rivals: REG_RIVALS[desc.stage].map((i) => rg.crews[i]), title: rg.name, sub: `${rd.name.toUpperCase()}  ·  ${rd.len} m` };
    }
    if (desc.kind === 'quick') {
      const q = desc.q, ln = QUICK_LENGTHS.find((x) => x.id === q.length), lv = QUICK_LEVELS.find((x) => x.id === q.level), th = THEMES[q.theme];
      return { ...base, theme: q.theme, len: ln.len, P0: ln.P0, level: lv.level, rivals: pickRivals(rng.fork()), title: th.name, sub: `QUICK RACE  ·  ${ln.len} m` };
    }
    if (desc.kind === 'drum') {
      const ch = DRUM_CHARTS.find((x) => x.id === desc.chart);
      return { ...base, mode: 'drum', chart: ch, theme: desc.theme ?? 'harbour', len: 420, P0: 0.78, level: ch.level, rivals: pickRivals(rng.fork()), title: ch.name, sub: 'DRUMMER CHALLENGE', hazard: 0.4 };
    }
    if (desc.kind === 'lesson') return { ...base, theme: 'town', len: 300, P0: 0.82, level: 0.5, rivals: ['jade-heron'], nRivals: 1, lane: 1, course: TUT_COURSE(), tut: true, title: 'Learn the Beat', sub: 'GUIDED RACE  ·  300 m' };
    return { ...base, name: 'Coach', auto: true, theme: desc.theme ?? 'town', len: 400, P0: 0.76, level: 5, rivals: pickRivals(rng.fork()), title: 'Watch & Learn', sub: 'THE COACH CREW' };
  }
  function startRace(desc) {
    const counted = desc.kind === 'regatta' || desc.kind === 'quick' || desc.kind === 'drum';
    if (config.demo && counted && state.demoRaces >= DEMO_RACES) { go('demo-limit'); return; }
    if (config.demo && counted) { state.demoRaces += 1; storage.set('demoRaces', state.demoRaces); }
    const cfg = configFor(desc);
    if (desc.autoplay) { cfg.auto = true; state.noCoach = true; } else state.noCoach = false;
    sim = createRace(cfg, rng.fork());
    state.match = { ...desc, title: cfg.title, sub: cfg.sub, cfg };
    state.raceId += 1;
    state.intro = desc.kind === 'auto' || desc.kind === 'lesson' ? { t: 0, dur: 1.2 } : { t: 0, dur: 3.2 };
    state.paused = false; state.confirm = null; state.hint = null; state.think = null; state.pops = []; state.tapLog = []; state.lastTap = null; state.hintsLeft = HINTS_PER_RACE;
    state.result = null; seenEv = 0; state.steer = 0; state.touchSteer = null; state.endT = 0;
    state.tut = desc.kind === 'lesson' ? { step: 0, done: false, doneT: 0 } : null;
    go('play');
    monetization.track('race_start', { kind: desc.kind });
  }
  const isAuto = () => !!sim && sim.w.auto && !state.noCoach;
  const racing = () => !!sim && !!state.match && ['regatta', 'quick', 'drum'].includes(state.match.kind);

  // ---- finishing -------------------------------------------------------------------------------------------------------------
  function finishRace() {
    const w = sim.w, m = state.match, r = w.result, P = state.progress, s = P.stats;
    const place = r.place;
    const R = { kind: m.kind, place, time: r.time, order: r.order, stats: r.stats, accuracy: r.accuracy, lifts: r.lifts, headline: '', sub: '', medal: null, newBest: '', buttons: [], title: m.title };
    const share = { id: 'share', label: 'SHARE', icon: 'info', kind: 'chip' }, menu = { id: 'menu', label: 'MENU', kind: 'secondary' };
    if (m.kind !== 'auto' && m.kind !== 'lesson') {
      s.races += 1; if (place === 0) s.wins += 1; s.perfect += r.stats.perfect; s.bestStreak = Math.max(s.bestStreak, r.stats.maxStreak);
    }
    if (m.kind === 'regatta') {
      const pr = P.regattas[m.reg], rd = ROUNDS[m.stage], last = m.stage === 2;
      if (!last) {
        if (place <= 1) { pr.stage = Math.max(pr.stage, m.stage + 1); R.headline = place === 0 ? `${rd.name} winners!` : `Through to the ${ROUNDS[m.stage + 1].name.toLowerCase()}`; R.sub = 'The top two crews go through.'; R.buttons = [{ id: 'next', label: `NEXT: ${ROUNDS[m.stage + 1].name.toUpperCase()}`, kind: 'primary', icon: 'play' }, menu, share]; }
        else { R.headline = 'Not through'; R.sub = `Only the top two crews go through. You were ${placeName(place)}. Race it again.`; R.buttons = [{ id: 'again', label: 'RACE AGAIN', kind: 'primary', icon: 'refresh' }, menu]; }
      } else if (place <= 2) {
        const medal = MEDALS[place]; R.medal = medal; R.headline = `${medal} medal`; R.sub = place === 0 ? 'Regatta champions!' : 'On the podium.';
        const order = (x) => (x ? MEDALS.indexOf(x) : 9);
        if (order(medal) < order(pr.medal)) pr.medal = medal;
        pr.stage = 3; if (place === 0 && (!pr.bestTime || r.time < pr.bestTime)) pr.bestTime = r.time;
        s.medals += 1;
        const idx = REGATTAS.findIndex((x) => x.id === m.reg), hasNext = idx + 1 < REGATTAS.length;
        if (hasNext) R.sub += ` ${REGATTAS[idx + 1].name} is open.`;
        R.buttons = [{ id: hasNext ? 'nextriver' : 'again', label: hasNext ? 'NEXT RIVER' : 'RACE AGAIN', kind: 'primary', icon: 'play' }, menu, share];
      } else { R.headline = 'Fourth in the final'; R.sub = 'Only the top three take a medal. Race the final again.'; R.buttons = [{ id: 'again', label: 'RACE AGAIN', kind: 'primary', icon: 'refresh' }, menu]; }
    } else if (m.kind === 'quick') {
      R.headline = place === 0 ? 'You won the race' : place < 3 ? 'Strong finish' : 'Keep paddling'; R.sub = `${w.len} metres in ${r.time.toFixed(1)} seconds.`; R.buttons = [{ id: 'again', label: 'RACE AGAIN', kind: 'primary', icon: 'refresh' }, menu, share];
    } else if (m.kind === 'drum') {
      const l = r.lifts, score = Math.round(r.accuracy * 8 + (3 - place) * 120 + (l ? l.hit * 60 : 0) + r.stats.maxStreak * 4);
      const cb = P.drum.charts[m.chart];
      R.headline = `Score ${score}`; R.sub = `Lifts ${l ? l.hit : 0} of ${l ? l.total : 0}. Longest run in tempo: ${r.stats.maxStreak}.`;
      if (!cb || score > cb.score) { P.drum.charts[m.chart] = { score, place }; R.newBest = cb ? 'New best for this chart!' : ''; }
      P.drum.best = Math.max(P.drum.best, score);
      R.buttons = [{ id: 'again', label: 'PLAY AGAIN', kind: 'primary', icon: 'refresh' }, menu, share];
    } else R.buttons = [menu];
    if (m.kind !== 'auto' && m.kind !== 'lesson') saveProgress();
    state.result = R;
    monetization.track('race_end', { kind: m.kind, place });
    go('result');
  }

  // ---- events ------------------------------------------------------------------------------------------------------------------
  function pop(text, color, size = 1, dx = 0) { state.pops.push({ text, color, t: 0, life: 0.85, size, dx }); if (state.pops.length > 4) state.pops.shift(); }
  function handleEvents() {
    const w = sim.w;
    for (const e of w.events) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      if (e.type === 'tap') {
        state.lastTap = { tier: e.tier, at: state.t, err: e.err }; state.tapLog.push({ tier: e.tier, err: e.err }); if (state.tapLog.length > 12) state.tapLog.shift();
        const col = { perfect: '#ffe27a', great: '#7dffb0', good: '#7fd0ff', ragged: '#ffa070' }[e.tier];
        if (w.mode === 'drum') pop(`${TIER_LABEL[e.tier]}  ${e.spm || ''}`.trim(), col, e.tier === 'perfect' ? 1.1 : 0.9);
        else pop(TIER_LABEL[e.tier] + (e.tier === 'ragged' ? (e.err < 0 ? ' · EARLY' : ' · LATE') : ''), col, e.tier === 'perfect' ? 1.1 : 0.9);
      } else if (e.type === 'miss') { state.tapLog.push({ tier: 'miss', err: 0 }); pop('MISS', '#ff6a6a', 1); }
      else if (e.type === 'stray') pop('TOO MANY TAPS', '#a0a8b8', 0.7);
      else if (e.type === 'bump') pop('BUMP!', '#ff9a6a', 1.2);
      else if (e.type === 'clash') pop('CLASH!', '#ffb08a', 1.1);
      else if (e.type === 'surge') pop('SURGE!', '#ffd25a', 1.4);
      else if (e.type === 'lift') pop(e.ok ? 'LIFT!' : 'LIFT MISSED', e.ok ? '#ffe27a' : '#ff9a6a', 1.2);
      else if (e.type === 'segment') pop(e.label, '#ffc65a', 1.2);
    }
  }

  // ---- coach: Watch & Learn ------------------------------------------------------------------------------------------------------
  function checkCoach() {
    const w = sim.w;
    if (state.noCoach || !w.moment || w.moment.handled) return;
    w.moment.handled = true;
    state.think = { phase: 'think', t: 0, dur: THINK_STEPS[clamp(state.prefs.thinkIdx, 0, THINK_STEPS.length - 1)], id: w.moment.id };
    if (w.moment.id === 'flotsam' || w.moment.id === 'stream' || w.moment.id === 'draft') w.boats[0].tx = sim.bestLine(w.boats[0], true);
  }
  function useHint() {
    const w = sim.w, me = w.boats[0];
    if (state.hint || state.hintsLeft <= 0 || w.phase !== 'race' || isAuto()) return;
    const best = sim.bestLine(me, true), c = w.call;
    let text, x;
    const ahead = w.flotsam.find((f) => !f.hit && f.z - (me.z + HALF_LEN) > 0 && f.z - (me.z + HALF_LEN) < 55 && Math.abs(f.x - me.x) < 2.6);
    if (w.mode === 'drum') text = c && c.lift ? 'Tap twice, quickly, for the LIFT.' : `Keep the gaps between taps even and stay between ${c.lo} and ${c.hi} strokes a minute.`;
    else if (ahead) { text = `Debris ahead on your line. Ease ${best < me.x ? 'right' : 'left'} to the clear water.`; x = best; }
    else if (c && c.kind) text = `${c.kind === 'up' ? 'Tempo call: UP' : c.kind === 'settle' ? 'SETTLE' : 'SPRINT'} in ${c.inBeats} beats. Stay relaxed and tap each ring as it closes.`;
    else if (w.surge.meter >= 1 && w.surge.on <= 0) text = 'Your Surge is ready. Tap the gold button on a stream or in the last stretch.';
    else if (me.E < 0.35) text = 'Energy is low. Clean, on-time taps cost less energy than sloppy ones.';
    else if (me.S < 0.55) text = 'The crew is ragged. Aim for the middle of the ring and tap once per beat.';
    else if (Math.abs(best - me.x) > 1.6) { text = best < me.x ? 'A faster line is open to the right.' : 'A faster line is open to the left.'; x = best; }
    else text = 'Good line and good rhythm. Keep tapping on the ring.';
    state.hint = { t: 0, dur: 4.5, text, x }; state.hintsLeft -= 1;
  }

  // ---- input for racing ----------------------------------------------------------------------------------------------------------------
  function gather(dt, input, L) {
    const w = sim.w, H = L.hud, drumMode = w.mode === 'drum';
    let taps = 0, surge = false; const ages = [], nowMs = touch.now();
    const evs = touch.ev.splice(0);
    const usePtr = state.paused || state.intro || state.confirm || isAuto() || state.think;
    if (!usePtr) {
      for (const e of evs) {
        if (e.type === 'down') {
          const h = ui.at(e.x, e.y);
          if (h && h.id === 'surge') surge = true;
          else if (h && (h.id === 'pause' || h.id === 'hint')) act(h.id);
          else if (!drumMode && !state.touchSteer && inRect(H.steerZone, e.x, e.y)) state.touchSteer = { id: e.id, ox: e.x, oy: e.y, x: e.x };
          else if (inRect(H.tapZone, e.x, e.y) || drumMode) { taps += 1; ages.push(e.ts ? clamp((nowMs - e.ts) / 1000, 0, 0.08) : 0); }
        } else if (e.type === 'move') { if (state.touchSteer && state.touchSteer.id === e.id) state.touchSteer.x = e.x; }
        else if (e.type === 'up' && state.touchSteer && state.touchSteer.id === e.id) state.touchSteer = null;
      }
    } else for (const e of evs) if (e.type === 'up' && state.touchSteer && state.touchSteer.id === e.id) state.touchSteer = null;
    const kp = input.keys.pressed, kd = input.keys.down;
    if (!usePtr) {
      if (kp.has('Space') || kp.has('KeyJ') || kp.has('KeyK') || kp.has('Enter') || kp.has('ArrowDown')) { taps += 1; ages.push(0); }
      if (kp.has('KeyS') || kp.has('ShiftLeft')) surge = true;
    }
    // +X is the boat's left; a drag to the screen's right steers the boat to its right (-X)
    let target = 0;
    if (state.touchSteer) { const d = state.touchSteer.x - state.touchSteer.ox; target = Math.abs(d) < 6 ? 0 : -clamp(d / 90, -1, 1); }
    if (kd.has('ArrowLeft') || kd.has('KeyA')) target = 1;
    if (kd.has('ArrowRight') || kd.has('KeyD')) target = -1;
    state.steer += (target - state.steer) * Math.min(1, 12 * dt);
    return { taps, tapAges: ages, surge, steer: state.steer };
  }

  // ---- scene updates ----------------------------------------------------------------------------------------------------------------------
  function tutProgress(dt) {
    const t = state.tut, w = sim.w;
    if (t.done) { t.doneT += dt; return; }
    if (t.step === 4 && !t.armed) { t.armed = true; if (w.surge.on <= 0) w.surge.meter = 1; }
    if (TUT[t.step].done(w)) {
      tone({ freq: 660, to: 990, dur: 0.18, type: 'triangle', vol: 0.07 });
      t.step += 1; t.armed = false;
      if (t.step >= TUT.length) { t.done = true; t.doneT = 0; state.progress.tutorial = true; saveProgress(); }
    }
  }
  function updatePlay(dt, input, L) {
    for (const q of state.pops) q.t += dt;
    state.pops = state.pops.filter((q) => q.t < q.life);
    if (state.hint) { state.hint.t += dt; if (state.hint.t > state.hint.dur) state.hint = null; }
    if (state.intro) {
      touch.ev.length = 0;
      if (!state.paused) state.intro.t += dt;
      if (state.intro.t >= state.intro.dur) state.intro = null;
      return;
    }
    const w = sim.w;
    if (state.paused) { touch.ev.length = 0; return; }
    if (state.think) {
      touch.ev.length = 0;
      const th = state.think; th.t += dt;
      if (th.t >= th.dur) { if (th.phase === 'think') { th.phase = 'reveal'; th.t = 0; th.dur = 2; } else state.think = null; }
      return;
    }
    const c = gather(dt, input, L);
    sim.update(dt, c);
    handleEvents();
    if (isAuto()) checkCoach();
    if (state.tut) tutProgress(dt);
    if (w.phase === 'done') {
      state.endT += dt;
      if (state.endT > 1.8) { if (state.tut) { sim = null; state.tut = null; state.match = null; go('title'); } else finishRace(); }
    } else state.endT = 0;
  }
  function updateAttract(dt) {
    if (!attract || attract.w.phase === 'done' || attract.w.t > 80) {
      attractN += 1;
      attract = createRace({ auto: true, theme: ATTRACT_THEMES[attractN % 3], len: 600, P0: 0.72, level: 6, rivals: pickRivals(rng.fork()), window: 'normal', name: 'Coach' }, rng.fork());
      for (let i = 0; i < 60 * 16; i++) attract.update(1 / 60, null);
    }
    attract.update(dt, null);
  }
  function updateCalib(dt) {
    const k = state.calib;
    if (!k.started || k.done) return;
    k.t += dt;
    while (k.next < k.beats.length && k.t >= k.beats[k.next]) { tone({ freq: 220, to: 110, dur: 0.18, type: 'sine', vol: 0.2 }); tone({ freq: 880, dur: 0.03, type: 'square', vol: 0.03 }); k.next += 1; }
    if (k.t > k.beats[k.beats.length - 1] + 0.6) finishCalib();
  }
  function calibTap(age = 0) {
    const k = state.calib; if (!k.started || k.done) return;
    k.flashAt = state.t;
    let be = 9;
    for (const b of k.beats) { const e = k.t - age - b; if (Math.abs(e) < Math.abs(be)) be = e; }
    if (Math.abs(be) < 0.4) { k.taps.push(be); tone({ freq: 520, to: 400, dur: 0.05, type: 'triangle', vol: 0.05 }); }
    if (k.taps.length >= k.need) finishCalib();
  }
  function finishCalib() {
    const k = state.calib; k.done = true;
    if (k.taps.length < 4) { k.result = null; return; }
    const s = [...k.taps].sort((a, b) => a - b); k.result = Math.round(s[Math.floor(s.length / 2)] * 1000);
  }
  function startCalib() {
    const k = state.calib; k.started = true; k.done = false; k.result = null; k.taps = []; k.t = -0.4; k.next = 0; k.beats = [];
    for (let i = 0; i < 12; i++) k.beats.push(1.0 + i * 0.8);
  }

  // ---- actions -----------------------------------------------------------------------------------------------------------------------------
  function leaveRace(to = 'title') {
    sim = null; state.tut = null; state.match = null; state.intro = null; state.think = null; state.hint = null; state.paused = false; state.confirm = null; state.touchSteer = null;
    go(to);
  }
  function nextRegatta(m) { startRace({ kind: 'regatta', reg: m.reg, stage: Math.min(state.progress.regattas[m.reg].stage, 2) }); }
  const watchTheme = () => ATTRACT_THEMES[(state.progress.stats.races + attractN) % 3];
  function act(id) {
    const sc = state.scene, pr = state.prefs;
    click();
    if (id === 'zoom-') { pr.zoomIdx = Math.max(0, pr.zoomIdx - 1); ui.resetScroll(); savePrefs(); return; }
    if (id === 'zoom+') { pr.zoomIdx = Math.min(TEXT_SCALES.length - 1, pr.zoomIdx + 1); ui.resetScroll(); savePrefs(); return; }
    if (id === 'back') { if (sc === 'calib') go('settings'); else if (sc === 'regatta' || sc === 'quick' || sc === 'drumsel') go('modes'); else go('title'); return; }
    if (id === 'logo') { env.openArcforgeHome?.(); return; }
    if (sc === 'title') {
      if (id === 'play') go('modes');
      else if (id === 'regatta') go('regatta');
      else if (id === 'drummer') go('drumsel');
      else if (id === 'watch') startRace({ kind: 'auto', theme: watchTheme() });
      else if (id === 'how') { state.howPage = 0; go('how'); }
      else if (id === 'rules') { state.rulesPage = 0; go('rules'); }
      else if (id === 'about') go('about');
      else if (id === 'settings') go('settings');
      return;
    }
    if (sc === 'modes') {
      if (id === 'm:regatta') go('regatta'); else if (id === 'm:quick') go('quick'); else if (id === 'm:drummer') go('drumsel');
      else if (id === 'm:lesson') startRace({ kind: 'lesson' });
      else if (id === 'm:watch') startRace({ kind: 'auto', theme: watchTheme() });
      return;
    }
    if (sc === 'regatta') {
      if (id.startsWith('reg:')) {
        const rid = id.slice(4), i = REGATTAS.findIndex((r) => r.id === rid);
        if (!regattaUnlocked(i)) { state.msg = { text: 'Win a medal on the previous river to open this one.', t: 0 }; return; }
        const p = state.progress.regattas[rid];
        startRace({ kind: 'regatta', reg: rid, stage: Math.min(p.stage, 2) });
      }
      return;
    }
    if (sc === 'quick') {
      const q = state.quick;
      if (id.startsWith('qt:')) q.theme = id.slice(3); else if (id.startsWith('ql:')) q.length = id.slice(3); else if (id.startsWith('qv:')) q.level = id.slice(3);
      else if (id === 'start') { storage.set('quick', q); startRace({ kind: 'quick', q: { ...q } }); }
      return;
    }
    if (sc === 'drumsel') { if (id.startsWith('drum:')) { const cid = id.slice(5); startRace({ kind: 'drum', chart: cid, theme: ['harbour', 'town', 'canal'][DRUM_CHARTS.findIndex((c) => c.id === cid)] }); } return; }
    if (sc === 'play') {
      if (id === 'pause') state.paused = true;
      else if (id === 'resume') { state.paused = false; state.confirm = null; }
      else if (id === 'hint') useHint();
      else if (id === 'leave') state.confirm = 'leave';
      else if (id === 'leave:no') state.confirm = null;
      else if (id === 'leave:yes') leaveRace(state.match && state.match.kind === 'regatta' ? 'regatta' : 'title');
      else if (id === 'a:exit') leaveRace('title');
      else if (id === 'a:pause') state.paused = !state.paused;
      else if (id === 'a:dec') { pr.thinkIdx = Math.max(0, pr.thinkIdx - 1); savePrefs(); }
      else if (id === 'a:inc') { pr.thinkIdx = Math.min(THINK_STEPS.length - 1, pr.thinkIdx + 1); savePrefs(); }
      else if (id === 'p:sound') { pr.sound = !pr.sound; audio.setMuted?.(!pr.sound); savePrefs(); }
      else if (id === 'p:click') { pr.click = !pr.click; savePrefs(); }
      else if (id === 'skipintro') { if (state.intro) state.intro.t = state.intro.dur; }
      return;
    }
    if (sc === 'result') {
      const m = state.match;
      if (id === 'again') { if (m.kind === 'regatta') nextRegatta(m); else startRace({ ...m }); }
      else if (id === 'next') nextRegatta(m);
      else if (id === 'nextriver') { const i = REGATTAS.findIndex((r) => r.id === m.reg); leaveRace('regatta'); void i; }
      else if (id === 'menu') leaveRace(m && m.kind === 'regatta' ? 'regatta' : m && m.kind === 'drum' ? 'drumsel' : 'title');
      else if (id === 'share') env.share?.(shareText());
      return;
    }
    if (sc === 'settings') {
      if (id === 's:sound') { pr.sound = !pr.sound; audio.setMuted?.(!pr.sound); }
      else if (id === 's:click') pr.click = !pr.click;
      else if (id === 's:haptics') pr.haptics = !pr.haptics;
      else if (id.startsWith('s:win:')) pr.window = id.slice(6);
      else if (id.startsWith('s:think:')) pr.thinkIdx = Number(id.slice(8));
      else if (id === 's:off-') pr.offsetMs = clamp(pr.offsetMs - 10, -200, 200);
      else if (id === 's:off+') pr.offsetMs = clamp(pr.offsetMs + 10, -200, 200);
      else if (id === 's:calib') { state.calib.started = false; state.calib.done = false; go('calib'); return; }
      else if (id === 's:restore') monetization.restore?.();
      else if (id === 's:reset') { state.confirm = 'reset'; return; }
      else if (id === 's:reset:yes') { state.progress = DEFAULT_PROGRESS(); saveProgress(); state.confirm = null; return; }
      else if (id === 's:reset:no') { state.confirm = null; return; }
      else if (id === 's:unlock') state.dev = true;
      savePrefs();
      return;
    }
    if (sc === 'calib') {
      if (id === 'calib:start' || id === 'calib:again') startCalib(); else if (id === 'calib:tap') calibTap();
      else if (id === 'calib:apply') { pr.offsetMs = clamp(state.calib.result, -200, 200); savePrefs(); go('settings'); }
      return;
    }
    if (sc === 'how') {
      if (id.startsWith('how:') && id !== 'how:try') { state.howPage = Number(id.slice(4)); ui.resetScroll(); }
      else if (id === 'how:try') startRace({ kind: 'lesson' });
      return;
    }
    if (sc === 'rules') { if (id.startsWith('rules:')) { state.rulesPage = Number(id.slice(6)); ui.resetScroll(); } return; }
    if (sc === 'demo-limit') { if (id === 'demo:menu') go('title'); }
  }
  const shareText = () => {
    const r = state.result; if (!r) return 'Dragon Boat Race';
    if (r.kind === 'drum') return `I scored ${r.headline.replace('Score ', '')} on the drum in Dragon Boat Race!`;
    return `I finished ${placeName(r.place)}${r.medal ? ` and won ${r.medal}` : ''} at ${r.title} in Dragon Boat Race.`;
  };

  // ---- main update --------------------------------------------------------------------------------------------------------------------------
  function update(dt, input) {
    state.t += dt;
    if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
    const p = input.pointer, sc = state.scene;
    const L = layoutFor(meta.width, meta.height, zoom());
    if (wheelInput.dy) { ui.scrollWheel(input.pointer, wheelInput.dy); wheelInput.dy = 0; }
    if (state.msg) { state.msg.t += dt; if (state.msg.t > 3.5) state.msg = null; }
    const dragging = ui.scrollInput(p);
    const playTouch = sc === 'play' && sim && !state.paused && !state.intro && !state.confirm && !isAuto() && !state.think;
    const kp = input.keys.pressed;
    if (!playTouch) {
      if (p.pressed) { const h = ui.at(p.x, p.y); press = h ? { id: h.id, data: h.data } : null; ui.pressedId = press ? press.id : null; }
      let acted = null;
      if (press && !p.down) {
        if (!dragging) { const h = ui.at(p.x, p.y); if (h && h.id === press.id) acted = h; }
        press = null; ui.pressedId = null;
      }
      if (kp.has('Escape')) { if (sc === 'play') acted = { id: state.confirm ? 'leave:no' : state.paused ? 'resume' : 'pause' }; else if (sc !== 'title') acted = { id: 'back' }; }
      if (kp.has('KeyP') && sc === 'play') acted = { id: state.paused ? 'resume' : 'pause' };
      if (kp.has('Enter') && ui.primary && sc !== 'play' && sc !== 'calib') acted = { id: ui.primary };
      if (sc === 'calib' && (kp.has('Space') || kp.has('Enter'))) acted = { id: 'calib:tap' };
      if (acted && acted.id === 'calib:tap' && !kp.has('Space') && !kp.has('Enter')) acted = null;   // pointer taps are judged on touch-down below
      if (acted) act(acted.id);
    } else {
      if (kp.has('Escape') || kp.has('KeyP')) act('pause');
      press = null; ui.pressedId = null;
    }
    if (state.scene === 'play' && sim) updatePlay(dt, input, L);
    else {
      if (state.scene === 'calib' && state.calib.started && !state.calib.done) {
        const nowMs = touch.now();
        for (const e of touch.ev) if (e.type === 'down') { const h = ui.at(e.x, e.y); if (h && h.id === 'calib:tap') calibTap(e.ts ? clamp((nowMs - e.ts) / 1000, 0, 0.08) : 0); }
      }
      touch.ev.length = 0;
      if (state.scene === 'result' && sim) sim.update(dt, null);
      if (['title', 'modes', 'regatta', 'quick', 'drumsel'].includes(state.scene)) updateAttract(dt);
      if (state.scene === 'calib') updateCalib(dt);
    }
  }

  // ---- publishing the 3D scene state ---------------------------------------------------------------------------------------------------------
  const courseFor = (w, id) => {
    const th = THEMES[w.theme];
    return { key: `r${id}`, theme: th.id, time: th.time, water: th.water, bank: th.bank, len: w.len, streams: w.streams, flotsam: w.flotsam };
  };
  const courseCache = new Map();
  function publish(L) {
    const sc = state.scene;
    const useSim = (sc === 'play' || sc === 'result') && sim;
    const useAttract = ['title', 'modes', 'regatta', 'quick', 'drumsel'].includes(sc) && attract;
    if (!useSim && !useAttract) { state.v3 = { on: false, events: [], t: 0 }; state.cam = null; return; }
    const live = useSim ? sim : attract, w = live.w, me = w.boats[0];
    const rid = useSim ? state.raceId : 1000 + attractN;
    let cam;
    if (sc === 'play') {
      if (w.phase === 'count' || state.intro) cam = introCam(w, L);
      else if (me.finished && w.t - me.finishT > 1.2) cam = finishCam(w, L, w.t - me.finishT - 1.2);
      else cam = chaseCam(w, L, { back: me.draft > 0.03 ? 1.2 : 0 });
    } else if (sc === 'result') cam = finishCam(w, L, Math.max(0, w.t - (me.finishT ?? w.t)));
    else cam = titleCam(w, L, state.t);
    if (state.camOverride) cam = state.camOverride;
    state.cam = cam;
    let c = courseCache.get(rid);
    if (!c) { c = courseFor(w, rid); courseCache.clear(); courseCache.set(rid, c); }
    let nextBeatT = me.sT1;
    for (const b of w.beats) if (b.t > w.t - 0.02 && b.i >= 0) { nextBeatT = b.t; break; }
    state.v3 = {
      on: true, t: w.t, dtReal: 1 / 60, raceId: rid, course: c, cam, meIndex: 0,
      boats: w.boats.map((b) => ({ id: b.id, name: b.name, hue: b.hue, x: b.x, z: b.z, yaw: b.yaw, v: b.v, vx: b.vx, sT0: b.sT0, sT1: b.sT1, spread: b.mine ? me.spread : clamp(1 - b.S, 0, 1), steer: b.mine ? clamp(state.steer, -1, 1) : clamp(b.vx / 3.2, -1, 1), bump: b.bump, surge: b.mine && w.surge.on > 0, mine: b.mine })),
      nextBeatT, surgeOn: w.surge.on > 0, paused: state.paused || !!state.think, events: w.events, muted: !state.prefs.sound, click: state.prefs.click, silent: sc !== 'play',
      haptics: state.prefs.haptics && sc === 'play' && !isAuto(), ambience: sc === 'play' || sc === 'result',
    };
  }

  return {
    update,
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, zoom());
      ui.begin(view?.cssPerUnit ?? meta.cssPerUnit ?? 0.55, state.t);
      ui.primary = null;
      publish(L);
      if (state.scene === 'play') { const H = L.hud; meta.previewBadge = { x: L.U.x + L.U.w - 14, y: H.place.y + H.place.h + 8, align: 'right' }; }
      draw(ctx, { state, L, ui, sim, attract, zoom: zoom(), RULES, config, THINK_STEPS, TEXT_SCALES, regattaUnlocked });
    },
    getState: () => state,
    setLicenses(text) { state.licenses = text; },
    setGl(v) { state.gl = !!v; },
    isPreviewExempt() { return !(state.scene === 'play' && !state.paused && !state.intro && !state.think && racing() && sim.w.phase === 'race'); },
    __debug: {
      go, act, startRace, sim: () => sim, attract: () => attract, state,
      ff(n) { for (let i = 0; i < n; i++) update(1 / 60, { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } }); },
    },
  };
}
