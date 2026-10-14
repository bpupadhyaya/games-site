// Egrang: state and flow. Drawing is in view.js / playview.js / docview.js; the physics, courses and rivals are in sim.js / courses.js.
//
// Time model: the race clock is the sum of the dt values handed to update() (deterministic, pausable). Think/Reveal in Watch and Learn
// and the Practice hint stop the clock; Pause freezes everything.
import {
  PHYS, createWorld, stepWorld, resultOf, sectionsOf, featureAhead, planFor, wPredict, uPred, placeOf, DEMO_RUNS, TOK_U,
} from './sim.js';
import { COURSES } from './courses.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, stageScale } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { rulesPages, THINK_CHOICES, REVEAL_SECONDS } from './content.js';
import { GRADE_TEXT, GRADE_COL } from './playview.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const FEATURE_TEXT = {
  stream: ['Stepping stones ahead', 'Only the stones are safe. Choose each landing before you tap.'],
  plank: ['Plank bridge ahead', 'Narrow and wobbly. Catch every sway under the bright bead.'],
  bund: ['Narrow earth bund', 'The wobble grows faster here. Tap under the bead every time.'],
  mud: ['Mud ahead', 'Carry speed in and keep pushing with later taps.'],
  up: ['Uphill', 'A later tap keeps your speed on the climb.'],
  down: ['Downhill', 'Speed comes easily. Keep the bead out of the red.'],
  puddle: ['Puddle ahead', 'Land short of it or long past it.'],
  hole: ['Pothole ahead', 'Land short of it or long past it.'],
  rock: ['Rock ahead', 'Place the stilt beside it.'],
};

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, thinkIdx: 1, ring: true, calm: false, textIdx: 0 },
    best: {}, demoRuns: 0, pl: null, result: null, menu: null, menuCourse: 0,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true, canRestore: config.demo !== true,
  };
  let lastScene = state.scene, drag = null;
  const menuRng = rng.fork(), raceRng = rng.fork(), fxRng = rng.fork();

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    Object.assign(state.prefs, v);
    state.prefs.textIdx = clamp(state.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.prefs.thinkIdx = clamp(state.prefs.thinkIdx | 0, 0, THINK_CHOICES.length - 1);
    applyPrefs();
  });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const tone = (o) => { if (state.prefs.sound) env.audio.tone?.(o); };

  // ---- the live menu backdrop (the performer racing a course behind the menus) -----------------------------------------------------
  function newMenu() {
    const ci = state.menuCourse % COURSES.length;
    state.menuCourse += 1;
    const W = createWorld(ci, { mode: 'auto' }, menuRng);
    state.menu = { W, camX: -2, parts: [], pops: [], shake: 0, cheer: 0.7, pulse: 0, reveal: null, t: 0, mode: 'auto' };
    for (let i = 0; i < 60 * 9; i++) stepWorld(W, 1 / 60, null);     // start with the field already spread along the road
    W.events.length = 0;
    state.menu.camX = W.racers[0].x - 2.2;
  }
  function stepMenu(dt) {
    const m = state.menu;
    if (!m || m.W.over || m.W.racers.every((r) => r.finished)) { newMenu(); return; }
    stepWorld(m.W, dt, null);
    for (const e of m.W.events) if (e.type === 'step' && !state.prefs.calm) burst(m.parts, fxRng, e.x, 0, m.W.racers[e.who].lane, 4, e.kind === 'mud' ? '#6b4328' : '#e8c89a', 0.45, 0.5);
    stepParticles(m.parts, dt);
    const me = m.W.racers[0];
    m.camX += ((me.x - 2.2) - m.camX) * Math.min(1, 5 * dt);
  }
  newMenu();

  // ---- a race --------------------------------------------------------------------------------------------------------------------
  function newPlay(ci, mode) {
    const W = createWorld(ci, { mode }, raceRng);
    const pl = {
      W, mode, ci, t: state.t, camX: null, shake: 0, cheer: 0.3, pulse: 0, parts: [], pops: [], banner: null, paused: false, over: false,
      auto: null, reveal: null, hintTarget: undefined, hintCard: null, hintT: 0, tapMark: null, tokPrev: -1, sections: sectionsOf(COURSES[ci]), secIdx: 0, autoTarget: undefined,
    };
    if (mode === 'auto') beginThink(pl, 0);
    return pl;
  }
  function sectionText(pl, x) {
    const f = featureAhead(COURSES[pl.ci], x, 18);
    if (x < 1) return ['Get ready', 'The first steps: tap as the bead reaches the green.'];
    if (f) return FEATURE_TEXT[f.kind] ?? ['On the road', 'Keep your rhythm.'];
    return ['Open road', 'Keep a steady rhythm: tap with the bead in the green.'];
  }
  function beginThink(pl, idx) {
    const [title, tip] = sectionText(pl, idx === 0 ? 0 : pl.sections[idx]);
    pl.auto = { phase: 'think', timer: THINK_CHOICES[state.prefs.thinkIdx], title, tip, sec: idx };
    pl.reveal = null;
  }
  function startPlay(mode, ci = state.sel) {
    const limited = config.demo && mode !== 'auto';
    if (limited && (ci > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (limited) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.sel = ci;
    state.pl = newPlay(ci, mode); state.result = null;
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('race_start', { course: COURSES[ci].id, mode });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.paused && !pl.over) pl.paused = true; };
  const resumePlay = () => { const pl = state.pl; if (pl) pl.paused = false; };

  function addPop(pl, text, col, size, x, lane) {
    pl.pops.push({ text, col, size, age: 0, dx: 0, x, lane });
    if (pl.pops.length > 4) pl.pops.shift();
  }
  function handleEvents(pl) {
    const W = pl.W;
    for (const e of W.events) {
      if (e.type === 'count') tone({ freq: 330, dur: 0.18, type: 'triangle', vol: 0.14 });
      else if (e.type === 'go') { tone({ freq: 660, to: 990, dur: 0.3, type: 'triangle', vol: 0.18 }); tone({ freq: 220, dur: 0.3, type: 'sine', vol: 0.12 }); }
      else if (e.type === 'step' && e.who === 0) {
        const me = W.racers[0];
        const f = e.q === 'perfect' ? 1 : e.q === 'good' ? 0.8 : 0.6;
        tone({ freq: 900 * f, to: 520 * f, dur: 0.09, type: 'triangle', vol: 0.16 });
        tone({ freq: 180, to: 120, dur: 0.07, type: 'sine', vol: 0.1 });
        burst(pl.parts, fxRng, e.x, 0, me.lane, state.prefs.calm ? 4 : e.q === 'perfect' ? 9 : 6, e.kind === 'mud' ? '#6b4328' : e.kind === 'stone' ? '#e8f4ff' : '#e8c89a', 0.6, 0.6);
        if (e.q === 'perfect') {
          if (e.chain > 0 && e.chain % 6 === 0) pl.banner = { text: `CHAIN x${e.chain}`, t: 0, col: '#8ef0dc' };
          if (e.chain % 3 === 1) addPop(pl, 'PERFECT', GRADE_COL.perfect, 40, e.x, me.lane);
        } else if (e.q === 'trip' || e.q === 'slip') { addPop(pl, GRADE_TEXT[e.q], GRADE_COL[e.q], 44, e.x, me.lane); pl.shake = 0.5; }
      } else if (e.type === 'step' && e.who !== 0) {
        if (!state.prefs.calm && Math.abs(e.x - W.racers[0].x) < 14) burst(pl.parts, fxRng, e.x, 0, W.racers[e.who].lane, 4, e.kind === 'mud' ? '#6b4328' : '#e8c89a', 0.45, 0.5);
      } else if (e.type === 'trip' && e.who === 0) tone({ freq: 190, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.1 });
      else if (e.type === 'slip' && e.who === 0) tone({ freq: 700, to: 300, dur: 0.2, type: 'sine', vol: 0.1 });
      else if (e.type === 'fall' && e.who === 0) {
        tone({ freq: 160, to: 70, dur: 0.4, type: 'sawtooth', vol: 0.14 }); pl.shake = 0.8; pl.cheer = 0.1;
        pl.banner = { text: e.kind === 'splash' ? 'SPLASH!' : e.kind === 'forward' ? 'TOO FAR FORWARD' : e.kind === 'back' ? 'STALLED' : 'LOST BALANCE', t: 0, col: '#ff9a8a' };
        if (e.kind === 'splash') burst(pl.parts, fxRng, W.racers[0].x, 0.2, W.racers[0].lane, 22, '#bfe8ff', 1.2, 1.4);
      } else if (e.type === 'fall' && e.kind === 'splash') {
        const r = W.racers[e.who]; burst(pl.parts, fxRng, r.x, 0.2, r.lane, 12, '#bfe8ff', 1, 1.2);
      } else if (e.type === 'bump' && (e.who === 0 || e.to === 0)) {
        tone({ freq: 230, to: 150, dur: 0.12, type: 'square', vol: 0.1 }); pl.shake = 0.4;
        addPop(pl, 'BUMP!', '#ffb43c', 40, e.x, W.racers[e.to].lane);
      } else if (e.type === 'finish' && e.who === 0) {
        tone({ freq: 523, dur: 0.25, type: 'triangle', vol: 0.14 }); tone({ freq: 659, dur: 0.3, type: 'triangle', vol: 0.12 }); tone({ freq: 784, dur: 0.4, type: 'triangle', vol: 0.12 });
        pl.cheer = 1;
        pl.banner = { text: placeOf(W, 0) === 0 ? 'YOU WIN!' : 'FINISHED!', t: 0, col: '#ffe07a' };
      }
    }
  }

  function stepAnim(pl, dt) {
    pl.pulse = Math.max(0, pl.pulse - dt * 4); pl.shake = state.prefs.calm ? 0 : Math.max(0, pl.shake - dt * 3);
    pl.cheer = Math.max(0.15, pl.cheer - dt * 0.15);
    for (const p of pl.pops) p.age += dt;
    pl.pops = pl.pops.filter((p) => p.age < 0.9);
    stepParticles(pl.parts, dt);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 1.5) pl.banner = null; }
    if (pl.tapMark) { pl.tapMark.age += dt; if (pl.tapMark.age > 0.6) pl.tapMark = null; }
  }

  // The performer's chosen next landing and tap moment (the same planner the rivals use).
  function planForPlayer(pl) {
    const me = pl.W.racers[0];
    const plan = planFor(pl.W, me);
    return { x: plan.x, target: me.ai.target };
  }
  function showHint(pl) {
    if (pl.mode !== 'practice' || pl.hintT > 0 || pl.W.go < 0 || pl.over) return;
    const me = pl.W.racers[0];
    if (me.phase !== 'stance') return;
    const p = planForPlayer(pl);
    pl.hintT = REVEAL_SECONDS + 0.5; pl.reveal = { x: p.x }; pl.hintTarget = p.target;
    pl.hintCard = { title: 'Tap when the bead reaches the gold mark. Tap under the bright bead.' };
  }

  function camFollow(pl, dt) {
    const stage = lay().play.stage, ppm = stageScale(stage), me = pl.W.racers[0];
    const target = me.x - (stage.w * (stage.w > stage.h * 1.1 ? 0.3 : 0.28)) / ppm;
    if (pl.camX === null) pl.camX = target; else pl.camX += (target - pl.camX) * Math.min(1, 6 * dt);
  }

  function updatePlay(dt, tap, input) {
    const pl = state.pl, L = lay().play, W = pl.W, me = W.racers[0];
    pl.t = state.t;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    const k = input.keys.pressed;
    if (tap) {
      if (inRect(L.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (pl.mode === 'practice' && inRect(L.hint, tap.x, tap.y)) showHint(pl);
    }
    if (k.has('Escape') || k.has('KeyP')) { pausePlay(); return; }
    if (k.has('KeyH')) showHint(pl);
    camFollow(pl, dt);
    stepAnim(pl, dt);
    // Practice hint: the clock stands still while the next landing is lit
    if (pl.hintT > 0) { pl.hintT -= dt; if (pl.hintT <= 0) { pl.hintCard = null; pl.reveal = null; pl.hintTarget = undefined; } return; }
    // Watch and Learn: Think then Reveal before each section, with the clock stopped
    if (pl.auto && pl.auto.phase !== 'act') {
      const a = pl.auto; a.timer -= dt;
      if (a.timer <= 0) {
        if (a.phase === 'think') {
          a.phase = 'reveal'; a.timer = REVEAL_SECONDS;
          const p = planForPlayer(pl); pl.reveal = { x: W.go < 0 ? 0.3 + PHYS.R + 0.45 : p.x }; pl.autoTarget = p.target;
        } else { a.phase = 'act'; pl.reveal = null; pl.autoTarget = undefined; }
      }
      return;
    }
    if (pl.auto && pl.auto.phase === 'act') {
      const nx = pl.sections[pl.secIdx + 1];
      if (nx !== undefined && me.x + me.v * dt >= nx && !me.finished) { pl.secIdx += 1; beginThink(pl, pl.secIdx); return; }
    }
    // the player's command
    let cmd = null;
    if (!me.bot) {
      cmd = { tap: false, p: 0, bump: false };
      const rail = L.rail, half = rail.w / 2 - 34;
      const keyTap = k.has('Space') || k.has('Enter');
      const onBump = pl.mode === 'race' && tap && inRect(L.bump, tap.x, tap.y);
      if (tap && !inRect(L.pause, tap.x, tap.y) && !inRect(L.hint, tap.x, tap.y) && !onBump) {
        cmd.tap = true; cmd.p = clamp((tap.x - (rail.x + rail.w / 2)) / half, -1.15, 1.15);
        pl.tapMark = { p: cmd.p, age: 0 };
      } else if (keyTap) {
        const left = input.keys.down.has('ArrowLeft') || input.keys.down.has('KeyA'), right = input.keys.down.has('ArrowRight') || input.keys.down.has('KeyD');
        const mag = Math.max(0.25, Math.abs(wPredict(me)));
        cmd.tap = true; cmd.p = left ? -mag : right ? mag : 0;
        pl.tapMark = { p: cmd.p, age: 0 };
      }
      if (onBump || (pl.mode === 'race' && k.has('KeyB'))) cmd.bump = true;
    }
    stepWorld(W, dt, cmd);
    handleEvents(pl);
    // the bamboo cue as the lean passes the middle of the green
    if (me.phase === 'stance' && W.go >= 0) {
      const u = uPred(W, me);
      if (pl.tokPrev >= 0 && pl.tokPrev < TOK_U && u >= TOK_U) { tone({ freq: 1300, to: 900, dur: 0.035, type: 'triangle', vol: 0.045 }); pl.pulse = 0.7; }
      pl.tokPrev = u;
    } else pl.tokPrev = -1;
    if (W.over) finishRun();
  }

  function finishRun() {
    const pl = state.pl, W = pl.W;
    const res = resultOf(W);
    const c = COURSES[pl.ci], old = state.best[c.id] ?? {};
    res.mode = pl.mode;
    if (pl.mode !== 'race') res.stars = 0;
    res.newBest = false;
    if (pl.mode === 'race') {
      res.newBest = !old.score || res.score > old.score;
      state.best[c.id] = {
        score: Math.max(old.score || 0, res.score), place: old.place === undefined ? res.place : Math.min(old.place, res.place),
        stars: Math.max(old.stars || 0, res.stars), time: old.time === undefined ? res.time : Math.min(old.time, res.time),
      };
      storage.set('best', state.best);
    }
    env.monetization.track?.('race_end', { course: c.id, mode: pl.mode, place: res.place });
    pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  const pauseItems = () => ['resume', 'restart', 'quit'];
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems(), M = menuRects(lay(), items.length, 96);
    if ((input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart') startPlay(pl.mode, pl.ci);
      else go('courses');
    });
  }

  // ---- menus and documents -----------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'think') p.thinkIdx = cyc(p.thinkIdx, THINK_CHOICES.length);
    else if (id === 'ring') p.ring = !p.ring;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') { restorePurchase(); return; }
    savePrefs();
  }
  // Settings > Restore purchase: asks the store for earlier purchases; the kit unlocks the game when it is owned.
  function restorePurchase() {
    const mon = env.monetization;
    const say = (text) => { state.toast = { text, t: 0, hold: 2.6 }; };
    if (!mon?.restore || state.demo) { say('Purchases are not available here'); return; }
    say('Checking your purchases...');
    mon.restore().then((r) => {
      const has = mon.products.some((pr) => mon.owns(pr.id)) || (r?.owned?.length ?? 0) > 0;
      say(has ? 'Purchase restored. The full game is unlocked' : 'No earlier purchase was found');
    }).catch(() => say('Could not reach the store. Try again later'));
  }
  function updateDoc(input) {
    const p = input.pointer, max = docMetrics.max, view = ui.view;
    const setScroll = (v) => { state.docScroll = Math.max(0, Math.min(v, max)); };
    const wy = input.wheel?.dy || 0;
    if (wy) setScroll(state.docScroll + wy);
    const k = input.keys.pressed;
    if (k.has('ArrowDown')) setScroll(state.docScroll + 70);
    if (k.has('ArrowUp')) setScroll(state.docScroll - 70);
    if (k.has('PageDown')) setScroll(state.docScroll + docMetrics.view * 0.9);
    if (k.has('PageUp')) setScroll(state.docScroll - docMetrics.view * 0.9);
    if (k.has('Escape')) { go(state.backTo); return; }
    if (p.pressed) drag = { x0: p.x, y0: p.y, s0: state.docScroll, moved: false, inView: inRect(view, p.x, p.y) };
    if (drag && p.down) {
      if (Math.abs(p.y - drag.y0) > 14) drag.moved = true;
      if (drag.moved && drag.inView) setScroll(drag.s0 - (p.y - drag.y0));
    }
    if (drag && p.released) {
      const d = drag; drag = null;
      if (d.moved) return;
      for (const h of ui.hits) {
        if (!inRect(h.r, d.x0, d.y0)) continue;
        if (h.clip && !inRect(h.clip, d.x0, d.y0)) continue;
        docAction(h.id); return;
      }
    }
  }
  function docAction(id) {
    if (id === 'back') { go(state.backTo); return; }
    if (id === 'textDec' || id === 'textInc') {
      const n = state.prefs.textIdx + (id === 'textInc' ? 1 : -1);
      if (n < 0 || n >= TEXT_SCALES.length) return;
      state.docFrac = docMetrics.max > 0 ? state.docScroll / docMetrics.max : 0; state.docRescale = true;
      state.prefs.textIdx = n; savePrefs(); return;
    }
    const pages = rulesPages().length;
    if (id === 'prev') { if (state.rulesPage > 0) { state.rulesPage -= 1; state.docScroll = 0; } return; }
    if (id === 'next') { if (state.rulesPage < pages - 1) { state.rulesPage += 1; state.docScroll = 0; } else go(state.backTo); return; }
    if (id.startsWith('set:')) settingsAction(id.slice(4));
  }

  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.play)) go('courses');
    else if (hit(T.auto)) { state.sel = 0; startPlay('auto', 0); }
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 60 && Math.abs(tap.x - T.credit.x) < 200) env.openArcforgeHome?.();
  }
  function updateCourses(tap) {
    if (!tap) return;
    const G = lay().courses;
    if (inRect(G.back, tap.x, tap.y)) { go('title'); return; }
    G.cards.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { state.sel = i; go('detail'); } });
  }
  function updateDetail(tap) {
    if (!tap) return;
    const D = lay().detail;
    if (inRect(D.back, tap.x, tap.y)) go('courses');
    else if (inRect(D.learn, tap.x, tap.y)) startPlay('practice');
    else if (inRect(D.race, tap.x, tap.y)) startPlay('race');
    else if (inRect(D.watch, tap.x, tap.y)) startPlay('auto');
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay(state.result.mode, state.result.ci);
    else if (inRect(Rr.courses, tap.x, tap.y)) go('courses');
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see ----------------------------------------------------------------------------------------
  const idle = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } });
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc !== 'play') stepMenu(dt);
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'courses') updateCourses(tap);
      else if (sc === 'detail') updateDetail(tap);
      else if (sc === 'play') updatePlay(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
    // Called by main.js when the app goes to the background.
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except real play is free: menus, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !(state.scene === 'play' && pl && pl.mode !== 'auto' && !pl.paused && !pl.over);
    },
    // Tester tools (?dev=1 and ?shot=1): jump to a screen and fast-forward.
    dev: {
      step(sec = 0.1) { for (let i = 0; i < Math.round(sec * 60); i++) api.update(1 / 60, idle()); },
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.course !== undefined) state.sel = o.course;
        const sc = o.scene ?? 'title';
        if (sc === 'play') {
          startPlay(o.mode ?? 'race', state.sel);
          if (o.play && state.pl) state.pl.W.racers[0].bot = true;
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('race', state.sel); state.pl.W.racers[0].bot = true;
          for (let i = 0; i < 60 * 400 && state.scene === 'play'; i++) api.update(1 / 60, idle());
          if (state.result) state.result.newBest = true;
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) for (let i = 0; i < o.advance * 60; i++) api.update(1 / 60, idle());
      },
    },
  };
  return api;
}
