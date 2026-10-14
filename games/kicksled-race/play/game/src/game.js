// Kicksled Race: state and flow. Physics lives in sim.js, drawing in scene.js / hud.js / menus.js.
// This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// Playing: tap KICK (or anywhere on the scene) when the ring is full; tap GLIDE to crouch and tap again (or kick) to stand.
import {
  newRace, stepRace, finishRace, getCourse, newDriver, drive, planAhead, medalFor, clamp, DIFFS, COURSE_IDS, ALL_COURSE_IDS,
} from './sim.js';
import { inRect, TEXT_SCALES, THINK_STEPS, layoutFor } from './layout.js';
import { renderPlay } from './hud.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, REF, ensureLayout, flowRects, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

// `meta.width/height` are updated live by the kit on every resize (fluid mode: the short side is always 720 units).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_RACE_CAP = 3;
const CUP_POINTS = [10, 6, 3, 1];
const FINISH_HOLD = 2.0;
const GHOST_DT = 0.2;
const COURSE_NAMES = { town: 'Town Square Dash', lake: 'Frozen Lake', forest: 'Forest Trail', harbour: 'Harbour Climb', daily: 'Daily Course' };

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  const fx = rng.fork();
  const raceRng = rng.fork();
  const day = config.day | 0;
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day, mode: 'race', cfg: null,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, names: true },
    record: { courses: {}, races: 0, wins: 0, cups: 0, perfects: 0, kicks: 0, demoRaces: 0, started: 0 },
    setup: { mode: 'race', course: 'town', diff: 1 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    race: null, cam: { x: 0, e: 0 }, parts: [], toast: '', toastT: 0, hint: null, tucked: false, finishT: 0, ghostX: null,
    ghosts: {}, samples: [], sampleT: 0, res: null, cup: null, watch: null, att: null, restoreMsg: '', loaded: false, shot: false,
  };

  // ---- persistence -------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null), ...ALL_COURSE_IDS.map((id) => storage.get(`ghost-${id}`, null))]).then(([s, r, ...gs]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    ALL_COURSE_IDS.forEach((id, i) => { if (Array.isArray(gs[i]) && gs[i].length > 4) state.ghosts[id] = gs[i]; });
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound -------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    kick: (q) => { tone({ freq: 190 + q * 60, to: 90, dur: 0.1, type: 'triangle', vol: 0.08 }); tone({ freq: 2400, to: 1200, dur: 0.05, type: 'square', vol: 0.012 }); },
    perfect: (n) => { tone({ freq: 660 * Math.pow(1.06, Math.min(n, 8)), dur: 0.14, type: 'sine', vol: 0.07 }); },
    early: () => tone({ freq: 150, to: 110, dur: 0.12, type: 'sawtooth', vol: 0.04 }),
    thud: () => { tone({ freq: 120, to: 55, dur: 0.18, type: 'sine', vol: 0.16 }); tone({ freq: 900, to: 300, dur: 0.06, type: 'square', vol: 0.03 }); },
    hop: () => tone({ freq: 340, to: 520, dur: 0.12, type: 'sine', vol: 0.05 }),
    beep: (go) => tone({ freq: go ? 880 : 520, dur: go ? 0.4 : 0.16, type: 'triangle', vol: 0.11 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    tuck: (on) => tone({ freq: on ? 300 : 420, to: on ? 200 : 520, dur: 0.1, type: 'sine', vol: 0.05 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.11 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- snow spray ---------------------------------------------------------------------------------------------
  const MAX_PARTS = 90;
  const puff = (list, x, n, size, up = 1, col) => {
    for (let i = 0; i < n && list.length < MAX_PARTS; i++) list.push({ x: x + (fx.next() - 0.5) * 0.3, h: 0.15 + fx.next() * 0.2, vx: -1.2 - fx.next() * 2.6, vh: 0.8 + fx.next() * up, t: 0, max: 0.45 + fx.next() * 0.4, size, col });
  };
  const stepParts = (list, dt) => {
    for (const q of list) { q.t += dt; q.x += q.vx * dt; q.h += q.vh * dt; q.vh -= 6 * dt; if (q.h < 0) { q.h = 0; q.vh *= -0.2; } }
    for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= list[i].max) list.splice(i, 1);
  };
  const raceEvents = (race, parts, loud) => {
    const me = race.racers[0].r;
    for (const e of race.events) {
      if (e.t === 'kick') {
        puff(parts, me.x - 0.7, e.kind === 'perfect' ? 5 : 3, 4, 1.4);
        if (loud) { sfx.kick(e.q); if (e.kind === 'perfect') sfx.perfect(me.streak); else if (e.kind === 'early') sfx.early(); }
      } else if (e.t === 'bump') {
        puff(parts, me.x, e.clean ? 3 : 8, 5, 2.2);
        if (loud) { if (e.clean) sfx.hop(); else { sfx.thud(); toast('Stand tall for bumps', 1.6); } }
      }
    }
  };
  const smoothTuck = (race, dt) => { for (const c of race.racers) c.r.tuckT = (c.r.tuckT ?? 0) + ((c.r.tuck ? 1 : 0) - (c.r.tuckT ?? 0)) * Math.min(1, dt * 10); };

  // ---- the attract race behind the menus ---------------------------------------------------------------------
  const startAttract = (i = 0) => {
    const id = COURSE_IDS[i % COURSE_IDS.length];
    const race = newRace(id, day, 'steady', raceRng, {});
    race.count = 0.8;
    state.att = { race, i, camX: 3, camE: 0, parts: [], driver: newDriver('fierce', 0), rng: raceRng.fork() };
  };
  const updateAttract = (dt) => {
    const a = state.att, race = a.race, me = race.racers[0].r;
    const inp = race.go ? drive(a.driver, me, race.course, dt, a.rng) : { kick: false, tuck: false };
    stepRace(race, dt, inp);
    race.events.length = 0;
    smoothTuck(race, dt);
    a.camX += (me.x + me.v * 0.35 - a.camX) * Math.min(1, dt * 5);
    a.camE += (race.course.elevAt(me.x) - a.camE) * Math.min(1, dt * 4);
    if (me.skid > 0.3 && a.parts.length < 40) puff(a.parts, me.x - 0.6, 1, 4);
    stepParts(a.parts, dt);
    if (me.done && (me.v < 0.3 || me.x > race.course.len + 25)) startAttract(a.i + 1);
  };

  // ---- starting and ending a race ----------------------------------------------------------------------------
  const clearPlay = () => { state.hint = null; state.tucked = false; state.parts = []; state.finishT = 0; state.ghostX = null; state.samples = []; state.sampleT = 0; state.watch = null; state.paused = false; state.pauseMenu = false; };
  const startRace = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoRaces >= DEMO_RACE_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    clearPlay();
    const diff = DIFFS[clamp(cfg.diff | 0, 0, 2)];
    state.cfg = { ...cfg };
    state.mode = cfg.mode;
    state.race = newRace(cfg.course, day, cfg.mode === 'watch' ? 'steady' : diff, raceRng, { rivals: cfg.mode !== 'trial' });
    state.scene = 'play'; state.ui.scroll = 0;
    const me = state.race.racers[0].r;
    state.cam = { x: me.x + 2, e: 0 };
    if (cfg.mode === 'trial' && state.ghosts[cfg.course]) state.ghostX = 0;
    if (cfg.mode === 'watch') {
      const plan = planAhead(state.race.course, me);
      state.watch = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], plan, name: 'Pilot', driver: newDriver('master', 0), stop: 0 };
    } else {
      if (!state.record.started) toast('Tap KICK when the ring is full', 4);
      state.record.started = (state.record.started | 0) + 1;
    }
  };
  const startWatch = () => startRace({ mode: 'watch', course: COURSE_IDS[raceRng.int(COURSE_IDS.length)], diff: 1 });

  const finalize = () => {
    const race = state.race, course = race.course, cfg = state.cfg, me = race.racers[0].r;
    const order = finishRace(race, { kick: false, tuck: false });
    const place = order.indexOf(race.racers[0]);
    const time = me.ft;
    const rec = state.record, cid = cfg.course;
    const cr = rec.courses[cid] ?? (rec.courses[cid] = { best: 0, medal: 0, runs: 0, wins: 0 });
    const medal = medalFor(course, time);
    const watch = cfg.mode === 'watch';
    const res = { mode: cfg.mode, courseId: cid, courseName: course.name, time, place, medal, perfects: me.perfects, kicks: me.kicks, standings: order.map((c, i) => ({ name: c.name, color: c.color, time: c.r.ft, human: c.human, place: i })), newBest: false };
    if (!watch) {
      cr.runs++; rec.races++; rec.perfects += me.perfects; rec.kicks += me.kicks;
      if (place === 0 && cfg.mode !== 'trial') { cr.wins++; rec.wins++; }
      if (!cr.best || time < cr.best) {
        res.newBest = !!cr.best;
        cr.best = time;
        const fin = state.samples.slice(); fin.push(Math.round(course.len * 10) / 10);
        state.ghosts[cid] = fin; storage.set(`ghost-${cid}`, fin);
      }
      cr.medal = Math.max(cr.medal | 0, medal);
      if (state.demo) rec.demoRaces++;
    }
    if (cfg.mode === 'cup' && state.cup) {
      const cup = state.cup;
      order.forEach((c, i) => { const p = CUP_POINTS[i] ?? 0; cup.pts[c.name] = (cup.pts[c.name] ?? 0) + p; cup.time[c.name] = (cup.time[c.name] ?? 0) + c.r.ft; res.standings[i].pts = p; });
      const names = Object.keys(cup.pts).sort((a, b) => cup.pts[b] - cup.pts[a] || cup.time[a] - cup.time[b]);
      const done = cup.i >= COURSE_IDS.length - 1;
      res.cup = { race: cup.i, total: cup.pts.You, done, place: names.indexOf('You'), nextName: done ? '' : COURSE_NAMES[COURSE_IDS[cup.i + 1]] };
      if (done && names[0] === 'You') rec.cups = (rec.cups | 0) + 1;
    }
    state.res = res;
    state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false;
    if (!watch && place === 0) sfx.win(); else if (!watch) sfx.chime(1);
    save();
  };

  // ---- the play scene ----------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leave = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; clearPlay(); state.race = null; };

  const requestHint = () => {
    if (!state.race || !state.race.go || state.race.racers[0].r.done) return;
    state.hint = { plan: planAhead(state.race.course, state.race.racers[0].r), t: 0, dur: 5 };
    sfx.tick();
  };

  const updateCamera = (dt) => {
    const race = state.race, me = race.racers[0].r, c = state.cam;
    c.x += (me.x + Math.min(me.v, 10) * 0.18 - c.x) * Math.min(1, dt * 5);
    c.e += (race.course.elevAt(me.x) - c.e) * Math.min(1, dt * 4);
  };

  const sampleGhost = (dt) => {
    const race = state.race, me = race.racers[0].r;
    if (!race.go || me.done) return;
    state.sampleT += dt;
    while (state.sampleT >= GHOST_DT) { state.sampleT -= GHOST_DT; state.samples.push(Math.round(me.x * 10) / 10); }
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
    const watch = state.mode === 'watch', L = lay(), P = L.play, race = state.race, me = race.racers[0].r;
    if (config.dev && keys.pressed.has('KeyK') && race.go) { me.x = Math.max(me.x, race.course.len - 3); }
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
    let kick = false, toggle = false;
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
      if (ptr.pressed) {
        if (inRect(P.menu, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(P.hint, ptr.x, ptr.y)) requestHint();
        else if (inRect(P.glide, ptr.x, ptr.y)) toggle = true;
        else if (!inRect(P.strip, ptr.x, ptr.y)) kick = true;
      }
      if (keys.pressed.has('Space') || keys.pressed.has('KeyZ') || keys.pressed.has('ArrowRight') || keys.pressed.has('Enter')) kick = true;
      if (keys.pressed.has('ArrowDown') || keys.pressed.has('KeyX') || keys.pressed.has('ShiftLeft') || keys.pressed.has('ShiftRight')) toggle = true;
      if (keys.pressed.has('KeyH')) requestHint();
    }
    if (state.paused) { updateCamera(dt); return; }

    // Watch & Learn: the pilot thinks, reveals its plan, then drives to the next stretch
    let autopilot = null, frozen = false;
    if (watch && state.watch) {
      const w = state.watch;
      if (w.phase === 'think') { w.t += dt; frozen = true; if (w.t >= w.dur) { w.phase = 'reveal'; w.t = 0; w.dur = 2; } }
      else if (w.phase === 'reveal') { w.t += dt; frozen = true; if (w.t >= w.dur) { w.phase = 'act'; w.t = 0; const nx = race.course.segs.find((s) => s.x0 > me.x + 6); w.stop = nx ? nx.x0 : Infinity; } }
      else if (me.x >= w.stop && !me.done) { w.phase = 'think'; w.t = 0; w.dur = THINK_STEPS[state.settings.thinkIdx]; w.plan = planAhead(race.course, me); frozen = true; }
      autopilot = w.driver;
    }
    // tuck latch: a tap on GLIDE crouches, another tap (or a kick) stands up
    if (!watch && !me.done) {
      if (toggle) { state.tucked = !state.tucked; if (race.go) sfx.tuck(state.tucked); }
      else if (kick && state.tucked && race.go) state.tucked = false;
    }
    if (!frozen) {
      const before = Math.ceil(race.count - 0.2);
      stepRace(race, dt, { kick: kick && race.go, tuck: state.tucked }, autopilot);
      if (!race.go && Math.ceil(race.count - 0.2) !== before && race.count > 0) sfx.beep(false);
      if (race.go && race.goT > 0 && race.goT < dt * 1.5) sfx.beep(true);
      raceEvents(race, state.parts, true);
      if (me.skid > 0.4 && state.parts.length < 50 && fx.next() < 0.5) puff(state.parts, me.x - 0.5, 1, 3);
      smoothTuck(race, dt);
      sampleGhost(dt);
      if (state.ghostX != null && race.go) state.ghostX = ghostAt(race.t);
      stepParts(state.parts, dt);
    }
    if (watch && autopilot) state.tucked = me.tuck;
    updateCamera(dt);
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
    if (state.demo && state.setup.course !== 'town' && state.setup.course !== 'lake') state.setup.course = 'town';
  };
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'race' || id === 'trial') openSetup(id);
    else if (id === 'cup') { if (state.demo) { state.scene = 'demolimit'; state.ui.scroll = 0; return; } openSetup('cup'); }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('crs')) { const c = id.slice(3); if (state.demo && c !== 'town' && c !== 'lake') { state.setupMsg = 'That course is in the full game.'; return; } s.course = c; state.setupMsg = ''; }
    else if (id.startsWith('dif')) { const i = Number(id.slice(3)); if (state.demo && i > 0) { state.setupMsg = 'Those rivals are in the full game.'; return; } s.diff = i; state.setupMsg = ''; }
    else if (id === 'start') {
      if (s.mode === 'cup') { state.cup = { i: 0, pts: {}, time: {}, diff: s.diff }; startRace({ mode: 'cup', course: COURSE_IDS[0], diff: s.diff }); }
      else startRace({ mode: s.mode, course: s.course, diff: s.diff });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-names') st.names = !st.names;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
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

  // `?shot=1` (store screenshots): a staged, real position reached by driving the sled, not a random player's.
  const SHOT_KIND = { 3: 0, 4: 1, 5: 2, 6: 3, 7: 4 };   // seed -> staged scene (0 forest, 1 lake + hint, 2 title, 3 harbour, 4 town pack)
  const SHOT_COURSE = ['forest', 'lake', 'town', 'harbour', 'town'], SHOT_SECS = [38, 52, 0, 44, 8];
  const setupShot = (kind = SHOT_KIND[config.seed | 0] ?? (config.seed | 0) % 3, live = false) => {
    if (kind === 2) return;                           // the title screen with the attract race
    state.record.started = 5;
    startRace({ mode: 'race', course: SHOT_COURSE[kind], diff: 1 });
    const race = state.race, pilot = newDriver('fierce', 0), r2 = raceRng.fork();
    race.count = 0;
    for (let i = 0; i < SHOT_SECS[kind] * 60; i++) {
      stepRace(race, 1 / 60, drive(pilot, race.racers[0].r, race.course, 1 / 60, r2));
      for (const c of race.racers) c.r.tuckT = c.r.tuck ? 1 : 0;
    }
    race.events.length = 0;
    const me = race.racers[0].r;
    state.cam = { x: me.x + Math.min(me.v, 10) * 0.18, e: race.course.elevAt(me.x) };
    state.tucked = me.tuck;
    state.toastT = 0; state.shot = !live;
    if (kind === 1) requestHint();
  };
  if (config.shot) setupShot();

  return {
    // Watch & Learn and every menu are free; only real racing counts against the free preview (a paused race does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.race && state.mode !== 'watch') || state.paused,
    update(dt, input) {
      if (state.shot) { state.t += dt; return; }
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
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
      switch (state.scene) {
        case 'title': renderTitle(ctx, state, L); break;
        case 'setup': renderSetup(ctx, state, L); break;
        case 'settings': renderSettings(ctx, state, L); break;
        case 'result': renderResult(ctx, state, L); break;
        case 'demolimit': renderDemoLimit(ctx, state, L); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play', L); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About', L); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules', L); break;
        case 'play':
          { const v = L.play.view; meta.previewBadge = { x: Math.max(14, L.play.strip.x), y: v.y + 6, align: 'left' }; }   // under the HUD strip, never over time / speed / place
          if (state.race) renderPlay(ctx, state, L);
          if (state.pauseMenu) renderPause(ctx, state, L);
          break;
        default: break;
      }
    },
    wheel(dy) { if (['about', 'howto', 'rules'].includes(state.scene)) { state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max); return; } if (['title', 'setup', 'settings', 'result', 'demolimit'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, flowMeta().max); },
    // The app went to the background (main.js wires visibilitychange): a race in progress waits behind Pause.
    suspend() { if (state.scene !== 'play' || !state.race || state.paused) return; if (state.mode === 'watch') state.paused = true; else openPause(); },
    start: (cfg) => startRace(cfg),            // dev / QA
    stage: (kind) => setupShot(kind, true),   // dev / QA: the same staged positions, but playable
    getState: () => state,
    debug: () => ({ lockup: lockupZone(), layout: lay(), flow: flowRects(state.ui.scroll), flowMax: flowMeta().max }),
  };
}
