// Billycart Derby: state and flow. Physics lives in sim.js, drawing in scene.js / hud.js / menus.js.
// This is the only file that mutates `state`.
//
// Scenes: title, setup, garage, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// Playing: touch anywhere and slide to steer; tap BRAKE (toggle) or hold it; tap just after GO for a launch.
import {
  newRace, stepRace, newDriver, planAhead, medalFor, clamp, COURSE_IDS, ALL_COURSE_IDS, DEFAULT_BUILD, sanitizeBuild, PARTS, DEMO_COURSES,
} from './sim.js';
import { inRect, TEXT_SCALES, THINK_STEPS, ASSIST, layoutFor } from './layout.js';
import { renderPlay } from './hud.js';
import {
  renderTitle, renderSetup, renderGarage, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, REF, ensureLayout,
  flowRects, lockupZone, starsOf, DEMO_WHEELS, DEMO_FRAMES, DEMO_STEERS,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

// `meta.width/height` are updated live by the kit on every resize (fluid mode: the short side is always 720 units).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_RACE_CAP = 3;
const CUP_POINTS = [10, 6, 3, 1];
const FINISH_HOLD = 2.2;
const GHOST_DT = 0.2;
const STEER_RANGE = 130;            // virtual units of thumb travel for full lock
const COURSE_NAMES = { mainst: 'Main Street Hill', ridge: 'Gravel Ridge', cobble: 'Cobble Lane', creek: 'Creek Run', grand: 'Grand Derby', daily: 'Daily Hill' };

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  const fx = rng.fork();
  const raceRng = rng.fork();
  const day = config.day | 0;
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day, mode: 'race', cfg: null,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, names: true, assistIdx: 2 },
    record: { hills: {}, races: 0, wins: 0, cups: 0, demoRaces: 0, started: 0, launches: 0 },
    build: { ...DEFAULT_BUILD },
    setup: { mode: 'race', course: 'mainst', diff: 0 }, setupMsg: '', garageMsg: '', garageBack: 'title',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    race: null, parts: [], toast: '', toastT: 0, hint: null, finishT: 0, ghostS: null, brakeOn: false, steerDrag: null, brakeDrag: null, uTarget: 0, rumbleT: 0,
    ghosts: {}, samples: [], sampleT: 0, res: null, cup: null, watch: null, att: null, restoreMsg: '', loaded: false, shot: false, driver: null,
  };

  // ---- persistence -------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); storage.set('build', state.build); };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('build', null), ...ALL_COURSE_IDS.map((id) => storage.get(`ghost-${id}`, null))]).then(([s, r, b, ...gs]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    if (b) state.build = sanitizeBuild(b);
    ALL_COURSE_IDS.forEach((id, i) => { if (Array.isArray(gs[i]) && gs[i].length > 4) state.ghosts[id] = gs[i]; });
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.settings.assistIdx = clamp(state.settings.assistIdx | 0, 0, ASSIST.length - 1);
    if (!state.record.hills) state.record.hills = {};
    validateBuild();
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });
  function enforceDemoBuild() {
    const b = state.build;
    if (!DEMO_WHEELS.includes(b.wheels)) b.wheels = 'spoke';
    if (!DEMO_FRAMES.includes(b.frame)) b.frame = 'box';
    if (!DEMO_STEERS.includes(b.steer)) b.steer = 'pivot';
  }
  // parts that need stars: fall back to the free ones if the record cannot back the choice
  function validateBuild() {
    const stars = starsOf(state.record);
    for (const key of ['wheels', 'frame', 'steer', 'brake']) {
      if (PARTS[key][state.build[key]].unlock > stars) state.build[key] = DEFAULT_BUILD[key];
    }
    if (state.demo) enforceDemoBuild();
  }

  // ---- sound -------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const buzz = (kind) => { try { globalThis.__haptic?.(kind); } catch { /* no haptics on this host */ } };
  const sfx = {
    launch: (q) => { buzz('good'); tone({ freq: 440 + q * 300, to: 880 + q * 400, dur: 0.18, type: 'triangle', vol: 0.1 }); },
    falseStart: () => tone({ freq: 140, to: 90, dur: 0.3, type: 'sawtooth', vol: 0.07 }),
    bump: (soft) => { buzz('tap'); tone({ freq: 110 - soft * 30, to: 55, dur: 0.14, type: 'sine', vol: 0.14 }); tone({ freq: 700, to: 250, dur: 0.05, type: 'square', vol: 0.02 }); },
    crash: () => { buzz('bad'); tone({ freq: 95, to: 40, dur: 0.3, type: 'sine', vol: 0.2 }); tone({ freq: 500, to: 120, dur: 0.15, type: 'sawtooth', vol: 0.05 }); },
    splash: () => { tone({ freq: 1400, to: 500, dur: 0.18, type: 'sine', vol: 0.05 }); tone({ freq: 900, to: 300, dur: 0.22, type: 'triangle', vol: 0.04 }); },
    skid: () => { buzz('bad'); tone({ freq: 900, to: 520, dur: 0.28, type: 'sawtooth', vol: 0.045 }); },
    beep: (go) => tone({ freq: go ? 880 : 520, dur: go ? 0.5 : 0.16, type: 'triangle', vol: 0.12 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    brake: (on) => { buzz('tap'); tone({ freq: on ? 260 : 340, to: on ? 190 : 420, dur: 0.08, type: 'sine', vol: 0.05 }); },
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.11 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
    rumble: (v, surf) => { const f = surf === 'pave' ? 70 : surf === 'gravel' ? 95 : surf === 'verge' ? 60 : 48; tone({ freq: f + v * 3, to: f * 0.9, dur: 0.12, type: 'triangle', vol: Math.min(0.03, 0.004 + v * 0.0016) }); },
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- dust and splashes ---------------------------------------------------------------------------------------
  const MAX_PARTS = 70;
  const puff = (list, s, x, n, size, col, spread = 1) => {
    for (let i = 0; i < n && list.length < MAX_PARTS; i++) list.push({ s: s + (fx.next() - 0.5) * 0.8, x: x + (fx.next() - 0.5) * 1.1, h: 0.1 + fx.next() * 0.2, size, col, t: 0, max: 0.5 + fx.next() * 0.5, vs: -1 - fx.next() * 3 * spread, vx: (fx.next() - 0.5) * 2 * spread, vh: 0.7 + fx.next() * 1.6 });
  };
  const stepParts = (list, dt) => {
    for (const q of list) { q.t += dt; q.s += q.vs * dt; q.x += q.vx * dt; q.h += q.vh * dt; q.vh -= 5 * dt; if (q.h < 0) { q.h = 0; q.vh *= -0.2; } }
    for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= list[i].max) list.splice(i, 1);
  };
  const dustCol = (surf) => (surf === 'gravel' ? '#d9c9a0' : surf === 'verge' ? '#9bc968' : surf === 'pave' ? '#cfc6b8' : '#e6e6e6');
  const raceFx = (race, parts, dt, loud) => {
    const me = race.racers[0].r;
    for (const e of race.events) {
      if (e.who !== 0) continue;
      if (e.t === 'bump') { puff(parts, me.s, me.x, 5, 0.18, dustCol(me.surf)); if (loud) sfx.bump(e.soft); }
      else if (e.t === 'crash') { puff(parts, me.s, me.x, 10, 0.26, '#e8c35a', 1.6); if (loud) { sfx.crash(); toast(e.kind === 'wall' ? 'Hay bales! Brake earlier' : 'Bales! Find the gap', 1.8); } }
      else if (e.t === 'splash') { puff(parts, me.s, me.x, 7, 0.2, '#bfe3ff', 1.3); if (loud) sfx.splash(); }
      else if (e.t === 'skid') { puff(parts, me.s, me.x, 8, 0.24, '#e6e6e6', 1.4); if (loud) { sfx.skid(); toast('Too fast for the bend', 1.8); } }
      else if (e.t === 'launch') { if (loud) { sfx.launch(e.q); toast(e.q > 0.7 ? 'Great launch!' : 'Launch', 1.4); } }
      else if (e.t === 'false') { if (loud) { sfx.falseStart(); toast('False start', 1.4); } }
    }
    race.events.length = 0;
    if (race.go && me.v > 4 && fx.next() < 0.18 + dt * 4 && (me.surf === 'gravel' || me.surf === 'verge' || me.skid > 0.3)) puff(parts, me.s - 0.3, me.x, 1, 0.14, me.skid > 0.3 && me.surf !== 'gravel' ? '#e6e6e6' : dustCol(me.surf), 0.8);
  };

  // ---- the attract race behind the menus ---------------------------------------------------------------------
  const startAttract = (i = 0) => {
    const id = COURSE_IDS[i % COURSE_IDS.length];
    const race = newRace(id, day, 1, raceRng, { build: { ...DEFAULT_BUILD }, assist: 0 });
    race.count = 0.01;
    race.racers.forEach((c, k) => { c.r.s = 70 + (3 - k) * 2.5; c.r.v = 7 + k * 0.2; c.r.x = (k - 1.5) * 1.2; });
    state.att = { race, i, parts: [], driver: newDriver('master', 5) };
  };
  const updateAttract = (dt) => {
    const a = state.att, race = a.race, me = race.racers[0].r;
    stepRace(race, dt, null, a.driver);
    raceFx(race, a.parts, dt, false);
    stepParts(a.parts, dt);
    if (me.done && (me.v < 0.3 || me.s > race.course.len + 40)) startAttract(a.i + 1);
  };

  // ---- starting and ending a race ----------------------------------------------------------------------------
  const clearPlay = () => { state.hint = null; state.parts = []; state.finishT = 0; state.ghostS = null; state.samples = []; state.sampleT = 0; state.watch = null; state.paused = false; state.pauseMenu = false; state.brakeOn = false; state.steerDrag = null; state.brakeDrag = null; state.uTarget = 0; };
  const startRace = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoRaces >= DEMO_RACE_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    clearPlay();
    validateBuild();
    state.cfg = { ...cfg };
    state.mode = cfg.mode;
    const watch = cfg.mode === 'watch';
    state.race = newRace(cfg.course, day, cfg.diff, raceRng, { build: state.build, assist: ASSIST[state.settings.assistIdx], rivals: cfg.mode !== 'trial' });
    state.scene = 'play'; state.ui.scroll = 0;
    const me = state.race.racers[0];
    if (cfg.mode === 'trial' && state.ghosts[cfg.course]) state.ghostS = 0;
    if (watch) {
      state.driver = newDriver('master', 1);
      state.watch = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], plan: planAhead(state.race.course, me), name: 'Pilot', stop: 0 };
    } else {
      state.driver = null;
      if (!state.record.started) toast('Slide your thumb to steer. Tap just after GO!', 4);
      state.record.started = (state.record.started | 0) + 1;
    }
  };
  const startWatch = () => startRace({ mode: 'watch', course: COURSE_IDS[raceRng.int(COURSE_IDS.length)], diff: 1 });

  const finalize = () => {
    const race = state.race, course = race.course, cfg = state.cfg, me = race.racers[0].r;
    const starsBefore = starsOf(state.record);
    const order = race.racers.slice().sort((a, b) => ((a.r.done ? a.r.ft : 1e6 - a.r.s) - (b.r.done ? b.r.ft : 1e6 - b.r.s)));
    const place = order.indexOf(race.racers[0]);
    const time = me.ft ?? race.t;
    const rec = state.record, cid = cfg.course;
    const hr = rec.hills[cid] ?? (rec.hills[cid] = { best: 0, medal: 0, runs: 0, wins: 0 });
    const medal = medalFor(cid, day, time);
    const watch = cfg.mode === 'watch';
    const res = {
      mode: cfg.mode, courseId: cid, courseName: course.name, time, place, medal, crashes: me.crashes + (me.spins | 0), launch: me.launch || 0, starsGained: 0, unlocked: '',
      standings: order.map((c, i) => ({ name: c.name, color: c.color, time: c.r.done ? c.r.ft : null, human: c.human, place: i })), newBest: false,
    };
    if (!watch) {
      hr.runs++; rec.races++;
      if (place === 0 && cfg.mode !== 'trial') { hr.wins++; rec.wins++; }
      if (!hr.best || time < hr.best) {
        res.newBest = !!hr.best;
        hr.best = time;
        const fin = state.samples.slice(); fin.push(Math.round(course.len * 10) / 10);
        state.ghosts[cid] = fin; storage.set(`ghost-${cid}`, fin);
      }
      if (cid !== 'daily') hr.medal = Math.max(hr.medal | 0, medal);
      if (me.launch > 0.7) rec.launches = (rec.launches | 0) + 1;
      if (state.demo) rec.demoRaces++;
      const starsAfter = starsOf(rec);
      res.starsGained = starsAfter - starsBefore;
      if (res.starsGained > 0) {
        const names = [];
        for (const g of Object.values(PARTS)) for (const p of Object.values(g)) if (p.unlock > starsBefore && p.unlock <= starsAfter) names.push(p.name);
        res.unlocked = names.join(', ');
      }
    }
    if (cfg.mode === 'cup' && state.cup) {
      const cup = state.cup;
      order.forEach((c, i) => { const p = CUP_POINTS[i] ?? 0; cup.pts[c.name] = (cup.pts[c.name] ?? 0) + p; cup.time[c.name] = (cup.time[c.name] ?? 0) + (c.r.done ? c.r.ft : 300); res.standings[i].pts = p; });
      const names = Object.keys(cup.pts).sort((a, b) => cup.pts[b] - cup.pts[a] || cup.time[a] - cup.time[b]);
      const done = cup.i >= COURSE_IDS.length - 1;
      res.cup = { race: cup.i, total: cup.pts.You, done, place: names.indexOf('You'), nextName: done ? '' : COURSE_NAMES[COURSE_IDS[cup.i + 1]] };
      if (done && names[0] === 'You') rec.cups = (rec.cups | 0) + 1;
    }
    state.res = res;
    state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false;
    if (!watch && place === 0) { buzz('win'); sfx.win(); } else if (!watch) sfx.chime(1);
    save();
  };

  // ---- the play scene ----------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leave = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; clearPlay(); state.race = null; };

  const requestHint = () => {
    if (!state.race || !state.race.go || state.race.racers[0].r.done) return;
    state.hint = { plan: planAhead(state.race.course, state.race.racers[0]), t: 0, dur: 5 };
    sfx.tick();
  };

  const sampleGhost = (dt) => {
    const race = state.race, me = race.racers[0].r;
    if (!race.go || me.done) return;
    state.sampleT += dt;
    while (state.sampleT >= GHOST_DT) { state.sampleT -= GHOST_DT; state.samples.push(Math.round(me.s * 10) / 10); }
  };
  const ghostAt = (t) => {
    const g = state.ghosts[state.cfg.course];
    if (!g) return null;
    const f = t / GHOST_DT, i = Math.floor(f);
    if (i >= g.length - 1) return g[g.length - 1];
    return g[i] + (g[i + 1] - g[i]) * (f - i);
  };

  const updatePlay = (dt, input) => {
    const ptr = input.pointer, keys = input.keys;
    const watch = state.mode === 'watch', L = lay(), P = L.play, race = state.race, meC = race.racers[0], me = meC.r;
    if (config.dev && keys.pressed.has('KeyK') && race.go) { me.s = Math.max(me.s, race.course.len - 6); }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) {
        const d = state.ui.drag; state.ui.drag = null;
        if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      }
      return;
    }
    let tap = false;
    if (watch) {
      if (ptr.pressed) {
        if (inRect(P.demo.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(P.demo.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); }
        else if (inRect(P.demo.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); }
        else if (inRect(P.demo.rules, ptr.x, ptr.y)) { state.paused = true; state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; sfx.tick(); return; }
        else if (P.demo.howto && inRect(P.demo.howto, ptr.x, ptr.y)) { state.paused = true; state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; sfx.tick(); return; }
        else if (inRect(P.demo.exit, ptr.x, ptr.y)) { leave(); return; }
      }
    } else {
      // steering: touch anywhere that is not a button and slide; brake: toggle (tap) or momentary (hold)
      if (ptr.pressed) {
        if (inRect(P.menu, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(P.hint, ptr.x, ptr.y)) requestHint();
        else if (inRect(P.brake, ptr.x, ptr.y)) { state.brakeDrag = { t0: state.t, was: state.brakeOn }; state.brakeOn = !state.brakeOn; sfx.brake(state.brakeOn); }
        else if (!inRect(P.strip, ptr.x, ptr.y)) { state.steerDrag = { x0: ptr.x }; tap = true; }
      }
      if (state.steerDrag && ptr.down) state.uTarget = clamp((ptr.x - state.steerDrag.x0) / STEER_RANGE, -1, 1);
      if (ptr.released) {
        state.steerDrag = null;
        if (state.brakeDrag) { if (state.t - state.brakeDrag.t0 > 0.3 && !state.brakeDrag.was) { state.brakeOn = false; sfx.brake(false); } state.brakeDrag = null; }
      }
      if (!state.steerDrag) {
        const kl = keys.down.has('ArrowLeft') || keys.down.has('KeyA'), kr = keys.down.has('ArrowRight') || keys.down.has('KeyD');
        if (kl !== kr) state.uTarget = kl ? -1 : 1;
        else state.uTarget += (0 - state.uTarget) * Math.min(1, dt * 7);
      }
      if (keys.pressed.has('Space') || keys.pressed.has('ArrowUp') || keys.pressed.has('Enter')) tap = true;
      if (keys.pressed.has('KeyH')) requestHint();
      if (keys.pressed.has('KeyB')) { state.brakeOn = !state.brakeOn; sfx.brake(state.brakeOn); }
    }
    if (state.paused) return;

    // Watch & Learn: the pilot thinks, reveals its plan, then drives to the next stretch
    let auto = null, frozen = false;
    if (watch && state.watch) {
      const w = state.watch;
      if (w.phase === 'think') { w.t += dt; frozen = true; if (w.t >= w.dur) { w.phase = 'reveal'; w.t = 0; w.dur = 2; } }
      else if (w.phase === 'reveal') { w.t += dt; frozen = true; if (w.t >= w.dur) { w.phase = 'act'; w.t = 0; const nx = race.course.stops.find((s) => s > me.s + 35); w.stop = nx ?? Infinity; } }
      else if (me.s >= w.stop && !me.done) { w.phase = 'think'; w.t = 0; w.dur = THINK_STEPS[state.settings.thinkIdx]; w.plan = planAhead(race.course, meC); frozen = true; }
      auto = state.driver;
    }
    if (!frozen) {
      const wasGo = race.go, before = Math.ceil(race.count - 0.2);
      const braking = state.brakeOn || (!watch && keys.down.has('Space'));
      stepRace(race, dt, watch ? null : { u: state.uTarget, brake: braking, tap }, auto);
      if (!race.go && Math.ceil(race.count - 0.2) !== before && race.count > 0) sfx.beep(false);
      if (!wasGo && race.go) sfx.beep(true);
      raceFx(race, state.parts, dt, true);
      if (race.go && me.v > 2) { state.rumbleT -= dt; if (state.rumbleT <= 0) { state.rumbleT = 0.16; sfx.rumble(me.v, me.surf); } }
      sampleGhost(dt);
      if (state.ghostS != null && race.go) state.ghostS = ghostAt(race.t);
      stepParts(state.parts, dt);
    }
    if (watch && auto) state.brakeOn = me.brake;
    if (state.toastT > 0) state.toastT -= dt;
    if (state.hint) { state.hint.t += dt; if (state.hint.t >= state.hint.dur) state.hint = null; }
    if (me.done && !frozen) { state.finishT += dt; if (state.finishT > FINISH_HOLD) finalize(); }
  };

  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-restart') { const cfg = state.cfg; closePause(); startRace(cfg); }
    else if (id === 'quit') leave();
  }

  // ---- menus -------------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.cols.length) state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, mt.max);
  }
  const openSetup = (md) => {
    state.setup.mode = md; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = '';
    if (state.demo && !DEMO_COURSES.includes(state.setup.course)) state.setup.course = DEMO_COURSES[0];
  };
  const openGarage = (back) => { state.garageBack = back; state.scene = 'garage'; state.ui.scroll = 0; state.garageMsg = ''; validateBuild(); };
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'race' || id === 'trial') openSetup(id);
    else if (id === 'cup') { if (state.demo) { state.scene = 'demolimit'; state.ui.scroll = 0; return; } openSetup('cup'); }
    else if (id === 'garage') openGarage('title');
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('crs')) { const c = id.slice(3); if (state.demo && !DEMO_COURSES.includes(c)) { state.setupMsg = 'That hill is in the full game.'; return; } s.course = c; state.setupMsg = ''; }
    else if (id.startsWith('dif')) { const i = Number(id.slice(3)); if (state.demo && i > 0) { state.setupMsg = 'Those rivals are in the full game.'; return; } s.diff = i; state.setupMsg = ''; }
    else if (id === 'garage') openGarage('setup');
    else if (id === 'start') {
      if (s.mode === 'cup') { state.cup = { i: 0, pts: {}, time: {}, diff: s.diff }; startRace({ mode: 'cup', course: COURSE_IDS[0], diff: s.diff }); }
      else startRace({ mode: s.mode, course: s.course, diff: s.diff });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleGarage = (id) => {
    if (!id) return;
    const b = state.build;
    sfx.tick();
    if (id === 'back') { state.scene = state.garageBack === 'setup' ? 'setup' : 'title'; state.ui.scroll = 0; save(); return; }
    if (id === 'bal-dec') { b.bal = Math.max(-2, b.bal - 1); save(); return; }
    if (id === 'bal-inc') { b.bal = Math.min(2, b.bal + 1); save(); return; }
    const m = /^(wheels|frame|steer|brake)-(\w+)$/.exec(id);
    if (!m) return;
    const [, key, pid] = m, group = PARTS[key], stars = starsOf(state.record);
    const demoList = key === 'wheels' ? DEMO_WHEELS : key === 'frame' ? DEMO_FRAMES : key === 'steer' ? DEMO_STEERS : null;
    if (state.demo && demoList && !demoList.includes(pid)) { state.garageMsg = 'That part is in the full game.'; return; }
    if (group[pid].unlock > stars) { state.garageMsg = `Earn ${group[pid].unlock} stars to unlock it. You have ${stars}.`; return; }
    b[key] = pid; state.garageMsg = ''; save();
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-names') st.names = !st.names;
    else if (id === 'as-dec') st.assistIdx = Math.max(0, st.assistIdx - 1);
    else if (id === 'as-inc') st.assistIdx = Math.min(ASSIST.length - 1, st.assistIdx + 1);
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (monetization.owns('unlock_game')) state.restoreMsg = 'Full game unlocked';
      else {
        state.restoreMsg = 'Checking with the store…';
        Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
      }
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.cfg;
    if (id === 'again') { if (cfg.mode === 'watch') startWatch(); else startRace(cfg); }
    else if (id === 'next') {
      const cup = state.cup;
      cup.i++;
      startRace({ mode: 'cup', course: COURSE_IDS[cup.i], diff: cup.diff });
    }
    else if (id === 'garage') { state.setup.mode = cfg.mode === 'watch' || cfg.mode === 'cup' ? 'race' : cfg.mode; state.setup.course = cfg.course; state.race = null; openGarage('setup'); }
    else if (id === 'new') {
      state.setup.mode = cfg.mode === 'watch' ? 'race' : cfg.mode;
      state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; state.race = null;
    }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.race = null; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key, lay());
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const scrollable = flowMeta().max > 0;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const max = flowMeta().max;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };

  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    const pins = lay().pins;
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) {
      handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  const updateGarage = (dt, input) => {
    const ptr = input.pointer, k = input.keys, L = lay(), pins = L.pins;
    if (k.pressed.has('Escape') || k.pressed.has('Enter')) { handleGarage('back'); return; }
    const done = L.wide ? pins.start : { x: pins.start.x, y: pins.start.y, w: pins.back.x + pins.back.w - pins.start.x, h: pins.start.h };
    if (ptr.pressed && inRect(done, ptr.x, ptr.y)) { handleGarage('back'); return; }
    updateFlowScene(dt, input, handleGarage, 'garage');
  };

  let refDrag = null;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    const ref = lay().ref, set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    if (ptr.pressed) {
      if (inRect(ref.next, ptr.x, ptr.y) || inRect(ref.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(ref.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.refScroll = 0; save(); }
      else if (inRect(ref.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.refScroll = 0; save(); }
      else if (inRect(ref.panel, ptr.x, ptr.y)) refDrag = { y0: ptr.y, s0: state.refScroll };
    }
    if (refDrag) { if (ptr.down) set(refDrag.s0 - (ptr.y - refDrag.y0)); else refDrag = null; }
    if (keys.pressed.has('ArrowDown')) set(state.refScroll + 70);
    if (keys.pressed.has('ArrowUp')) set(state.refScroll - 70);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) set(state.refScroll + REF.view * 0.9);
    if (keys.pressed.has('PageUp')) set(state.refScroll - REF.view * 0.9);
    if (keys.pressed.has('Home')) set(0);
    if (keys.pressed.has('End')) set(1e9);
    if (keys.pressed.has('Escape')) close();
  };

  startAttract(0);

  // `?shot=1` (store screenshots): a staged, real position reached by letting the pilot drive, not a random player's.
  const setupShot = (kind = (config.seed | 0) % 3, live = false) => {
    if (kind === 2) return;                           // the title screen with the attract race
    state.record.started = 5;
    startRace({ mode: 'race', course: kind === 0 ? 'mainst' : 'ridge', diff: 1 });
    const race = state.race, pilot = newDriver('master', 3);
    race.count = 0.01;
    for (let i = 0; i < (kind === 0 ? 24 : 30) * 60; i++) stepRace(race, 1 / 60, null, pilot);
    race.events.length = 0;
    state.toastT = 0; state.shot = !live;
    if (kind === 1) state.hint = { plan: planAhead(race.course, race.racers[0]), t: 0, dur: 5 };
  };
  if (config.shot) setupShot();

  return {
    // Watch & Learn and every menu are free; only real driving counts against the free preview (a paused race does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.race && state.mode !== 'watch') || state.paused,
    update(dt, input) {
      if (state.shot) { state.t += dt; return; }
      setPress(input.pointer);
      state.owned = !!monetization.owns?.('unlock_game');
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'garage': updateGarage(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height);
      // keep the preview pill off the time / speed / place readout: top-left of the scene, or the bottom edge while a hint card is up
      if (state.scene === 'play' && state.race) {
        const P = L.play, v = state.mode === 'watch' ? P.viewWatch : P.view, card = state.hint && state.hint.t < state.hint.dur;
        globalThis.__previewBadge = { x: v.x + 12, y: card || state.mode === 'watch' ? v.y + v.h - 46 : v.y + 10, align: 'left' };
      } else globalThis.__previewBadge = null;
      switch (state.scene) {
        case 'title': renderTitle(ctx, state, L); break;
        case 'setup': renderSetup(ctx, state, L); break;
        case 'garage': renderGarage(ctx, state, L); break;
        case 'settings': renderSettings(ctx, state, L); break;
        case 'result': renderResult(ctx, state, L); break;
        case 'demolimit': renderDemoLimit(ctx, state, L); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play', L); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About', L); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules', L); break;
        case 'play':
          if (state.race) renderPlay(ctx, state, L);
          if (state.pauseMenu) renderPause(ctx, state, L);
          break;
        default: break;
      }
    },
    wheel(dy) { if (['about', 'howto', 'rules'].includes(state.scene)) { state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max); return; } if (['title', 'setup', 'garage', 'settings', 'result', 'demolimit'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, flowMeta().max); },
    start: (cfg) => startRace(cfg),            // dev / QA
    stage: (kind) => setupShot(kind, true),   // dev / QA: the same staged positions, but playable
    getState: () => state,
    debug: () => ({ lockup: lockupZone(), layout: lay(), flow: flowRects(state.ui.scroll), flowMax: flowMeta().max }),
  };
}
