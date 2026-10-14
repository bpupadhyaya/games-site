// Intha Leg Rowing: state and flow. Drawing is in view.js / playview.js / docview.js; the physics, courses and rivals are in sim.js / courses.js.
//
// Time model: the race clock is the sum of the dt values handed to update() (deterministic, pausable). Think/Reveal in Watch and Learn
// and the Practice hint stop the clock; Pause freezes everything.
import { createWorld, stepWorld, resultOf, planFor, placeOf, DEMO_RUNS } from './sim.js';
import { COURSES, sectionsOf, featureAhead } from './courses.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { rulesPages, THINK_CHOICES, REVEAL_SECONDS } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const FEATURE_TEXT = {
  stake: ['Fishing stake ahead', 'Steer round it: a hit costs speed and poise.'],
  gate: ['Buoy gate ahead', 'Aim for the middle and pass between the buoys.'],
  hyac: ['Weed ahead', 'Go round the weed: it drags the boat and blocks the net.'],
  swell: ['Swell band ahead', 'Row gently through the swell, or go still.'],
  fence: ['Narrow fence gap', 'Keep your sweeps even and the boat straight.'],
  shoal: ['Fish shoal ahead', 'Put the shoal on the right, slow down and go still to net it.'],
};

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, thinkIdx: 1, calm: false, textIdx: 0 },
    best: {}, demoRuns: 0, pl: null, result: null, menu: null, menuCourse: 0,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, restoreBusy: false, owned: () => false, dev: config.dev === true, demo: config.demo === true,
  };
  let lastScene = state.scene, drag = null, touching = false;
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
  state.owned = () => env.monetization.owns?.('unlock_game') === true;
  const lay = () => layoutFor(meta.width, meta.height);
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const tone = (o) => { if (state.prefs.sound) env.audio.tone?.(o); };

  // ---- the live menu backdrop (the performer rowing a course behind the menus) -------------------------------------------------------
  function view0(W) { const b = W.boats[0]; return { W, camS: b.s, camN: b.n, parts: [], pops: [], shake: 0, mode: 'auto', menuMode: true, reveal: null, t: 0 }; }
  function newMenu() {
    const ci = state.menuCourse % COURSES.length;
    state.menuCourse += 1;
    const W = createWorld(ci, { mode: 'auto' }, menuRng);
    for (let i = 0; i < 60 * 14; i++) stepWorld(W, 1 / 60, null);      // start with the field already spread along the channel
    W.events.length = 0;
    state.menu = view0(W);
  }
  function stepMenu(dt) {
    const m = state.menu;
    if (!m || m.W.over || m.W.boats[0].s > m.W.course.length - 20) { newMenu(); return; }
    stepWorld(m.W, dt, null);
    stepParticles(m.parts, dt);
    const me = m.W.boats[0];
    m.camS += (me.s - m.camS) * Math.min(1, 5 * dt); m.camN += (me.n - m.camN) * Math.min(1, 3 * dt);
  }
  newMenu();

  // ---- a race --------------------------------------------------------------------------------------------------------------------
  function newPlay(ci, mode) {
    const W = createWorld(ci, { mode }, raceRng);
    const pl = {
      W, mode, ci, camS: null, camN: null, shake: 0, parts: [], pops: [], banner: null, paused: false, over: false,
      auto: null, reveal: null, hintCard: null, hintT: 0, sections: sectionsOf(COURSES[ci]), secIdx: 0, menuMode: false, t: 0, lastTick: -1,
    };
    if (mode === 'auto') beginThink(pl, 0);
    return pl;
  }
  function sectionText(pl, s) {
    const f = featureAhead(COURSES[pl.ci], s, 40);
    if (s < 1) return ['Get ready', 'Row steadily and look for the first shoal.'];
    if (f) return FEATURE_TEXT[f.kind] ?? ['On the lake', 'Keep your stroke even.'];
    return ['Open water', 'Row a steady stroke and keep your line.'];
  }
  function beginThink(pl, idx) {
    const [title, tip] = sectionText(pl, idx === 0 ? 0 : pl.sections[idx]);
    pl.auto = { phase: 'think', timer: THINK_CHOICES[state.prefs.thinkIdx], title, tip, sec: idx };
    pl.reveal = null;
  }
  function revealTarget(pl) {
    const W = pl.W, me = W.boats[0], p = planFor(W, me);
    if (me.shoal >= 0 && W.shoals[me.shoal] && !W.shoals[me.shoal].caught) { const sh = W.shoals[me.shoal]; return { s: sh.s, n: sh.n }; }
    const g = W.course.gates.find((q) => q.s > me.s);
    if (g && g.s - me.s < 40) return { s: g.s, n: g.n };
    return { s: me.s + 10, n: p.tn };
  }
  function startPlay(mode, ci = state.sel) {
    const limited = config.demo && mode !== 'auto';
    if (limited && (ci > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (limited) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.sel = ci;
    state.pl = newPlay(ci, mode); state.result = null;
    state.scene = 'play'; state.sceneT = 0; touching = false;
    env.monetization.track?.('race_start', { course: COURSES[ci].id, mode });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.paused && !pl.over) pl.paused = true; };
  const resumePlay = () => { const pl = state.pl; if (pl) pl.paused = false; };

  const pop = (pl, text, col, size, s, n) => { pl.pops.push({ text, col, size, age: 0, s, n }); if (pl.pops.length > 4) pl.pops.shift(); };
  function handleEvents(pl) {
    const W = pl.W, calm = state.prefs.calm;
    for (const e of W.events) {
      const mine = e.who === 0;
      if (e.type === 'count') tone({ freq: 330, dur: 0.18, type: 'triangle', vol: 0.14 });
      else if (e.type === 'go') { tone({ freq: 660, to: 990, dur: 0.3, type: 'triangle', vol: 0.18 }); tone({ freq: 220, dur: 0.3, type: 'sine', vol: 0.12 }); }
      else if (e.type === 'catch' && mine) {
        tone({ freq: 700, to: 1100, dur: 0.16, type: 'triangle', vol: 0.16 }); tone({ freq: 1100, to: 1500, dur: 0.2, type: 'sine', vol: 0.1 });
        burst(pl.parts, fxRng, e.s, e.n, calm ? 6 : 16, '#e8f6ff', 1.1);
        pop(pl, `+${e.size} fish`, '#ffe08a', 40, e.s, e.n);
      } else if (e.type === 'gate' && mine) {
        if (e.ok) { tone({ freq: 880, dur: 0.1, type: 'triangle', vol: 0.12 }); pop(pl, 'GATE', '#8ef0dc', 38, e.s, e.n); }
        else { tone({ freq: 220, dur: 0.12, type: 'sine', vol: 0.08 }); pop(pl, 'MISSED', '#ffb08a', 32, e.s, e.n); }
      } else if (e.type === 'hit' && mine) {
        tone({ freq: 180, to: 110, dur: 0.14, type: 'square', vol: 0.1 }); pl.shake = calm ? 0 : 0.5;
        burst(pl.parts, fxRng, e.s, e.n, calm ? 4 : 10, '#c9a15a', 0.9);
        pop(pl, e.kind === 'pole' ? 'BUOY!' : 'STAKE!', '#ffb43c', 40, e.s, e.n);
      } else if (e.type === 'bank' && mine) { tone({ freq: 150, to: 100, dur: 0.12, type: 'sawtooth', vol: 0.07 }); pl.shake = calm ? 0 : 0.25; }
      else if (e.type === 'bump' && mine) tone({ freq: 230, to: 150, dur: 0.1, type: 'square', vol: 0.07 });
      else if (e.type === 'swell' && mine) pop(pl, 'GENTLE IN SWELL', '#9fd8ff', 30, e.s, e.n);
      else if (e.type === 'fall') {
        const b = W.boats[e.who];
        burst(pl.parts, fxRng, b.s, b.n, calm ? 8 : 22, '#bfe8ff', 1.3);
        if (mine) {
          tone({ freq: 160, to: 70, dur: 0.45, type: 'sawtooth', vol: 0.14 }); pl.shake = calm ? 0 : 0.8;
          pl.banner = { text: 'SPLASH!', t: 0, col: '#ff9a8a' };
        }
      } else if (e.type === 'finish' && mine) {
        tone({ freq: 523, dur: 0.25, type: 'triangle', vol: 0.14 }); tone({ freq: 659, dur: 0.3, type: 'triangle', vol: 0.12 }); tone({ freq: 784, dur: 0.4, type: 'triangle', vol: 0.12 });
        pl.banner = { text: placeOf(W, 0) === 0 ? 'YOU WIN!' : 'FINISHED!', t: 0, col: '#ffe08a' };
      }
    }
    // the oar's splash and a soft stroke sound
    const me = W.boats[0];
    if (me.inWater && me.oarSpeed > 1.5) {
      const k = Math.floor(W.t * 5);
      if (k !== pl.lastTick) {
        pl.lastTick = k;
        tone({ freq: 240 + 40 * Math.min(1, me.oarSpeed / 6), to: 150, dur: 0.07, type: 'sine', vol: 0.045 });
        if (!calm) burst(pl.parts, fxRng, me.s - 2.1, me.n + 2.6, 2, '#ffffff', 0.5);
      }
    }
  }

  function stepAnim(pl, dt) {
    pl.shake = state.prefs.calm ? 0 : Math.max(0, pl.shake - dt * 3);
    for (const p of pl.pops) p.age += dt;
    pl.pops = pl.pops.filter((p) => p.age < 1.0);
    stepParticles(pl.parts, dt);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 1.5) pl.banner = null; }
  }
  function camFollow(pl, dt) {
    const me = pl.W.boats[0];
    if (pl.camS === null) { pl.camS = me.s; pl.camN = me.n; return; }
    pl.camS += (me.s - pl.camS) * Math.min(1, 8 * dt); pl.camN += (me.n - pl.camN) * Math.min(1, 3.5 * dt);
  }

  function showHint(pl) {
    if (pl.mode !== 'practice' || pl.hintT > 0 || pl.W.go < 0 || pl.over) return;
    pl.hintT = REVEAL_SECONDS + 0.5; pl.reveal = { target: revealTarget(pl) };
    const f = featureAhead(COURSES[pl.ci], pl.W.boats[0].s, 30);
    pl.hintCard = { title: f ? (FEATURE_TEXT[f.kind]?.[1] ?? 'Keep a steady stroke.') : 'Row a steady stroke along the gold line.' };
  }

  // The thumb on the lower part of the screen is the leg on the oar; the keyboard alternates arrows.
  function playerCommand(input) {
    const L = lay().play, p = input.pointer, half = L.pad.w / 2 - 34, k = input.keys.down;
    if (p.pressed && inRect(L.touch, p.x, p.y) && !inRect(L.pause, p.x, p.y) && !inRect(L.hint, p.x, p.y)) touching = true;
    if (!p.down) touching = false;
    let hold = false, pad = 0;
    if (touching && p.down) { hold = true; pad = clamp((p.x - (L.pad.x + L.pad.w / 2)) / half, -1.1, 1.1); }
    const left = k.has('ArrowLeft') || k.has('KeyA'), right = k.has('ArrowRight') || k.has('KeyD');
    if (!hold && (left || right)) { hold = true; pad = left && right ? 0 : left ? -1 : 1; }
    if (k.has('Space')) hold = false;
    return { hold, pad };
  }

  function updatePlay(dt, tap, input) {
    const pl = state.pl, L = lay().play, W = pl.W, me = W.boats[0];
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
    // Practice hint: the clock stands still while the line is lit
    if (pl.hintT > 0) { pl.hintT -= dt; if (pl.hintT <= 0) { pl.hintCard = null; pl.reveal = null; } return; }
    // Watch and Learn: Think then Reveal before each section, with the clock stopped
    if (pl.auto && pl.auto.phase !== 'act') {
      const a = pl.auto; a.timer -= dt;
      if (a.timer <= 0) {
        if (a.phase === 'think') { a.phase = 'reveal'; a.timer = REVEAL_SECONDS; pl.reveal = { target: revealTarget(pl) }; }
        else { a.phase = 'act'; pl.reveal = null; }
      }
      return;
    }
    if (pl.auto && pl.auto.phase === 'act') {
      const nx = pl.sections[pl.secIdx + 1];
      if (nx !== undefined && me.s + me.v * dt >= nx && !me.finished) { pl.secIdx += 1; beginThink(pl, pl.secIdx); return; }
    }
    const cmd = me.bot ? null : playerCommand(input);
    stepWorld(W, dt, cmd);
    handleEvents(pl);
    if (W.over) finishRun();
  }

  function finishRun() {
    const pl = state.pl, W = pl.W;
    const res = resultOf(W), c = COURSES[pl.ci], old = state.best[c.id] ?? {};
    res.mode = pl.mode;
    if (pl.mode !== 'race') res.stars = 0;
    res.newBest = false;
    if (pl.mode === 'race' && res.finished) {
      res.newBest = !old.score || res.score > old.score;
      state.best[c.id] = {
        score: Math.max(old.score || 0, res.score), place: old.place === undefined ? res.place : Math.min(old.place, res.place),
        stars: Math.max(old.stars || 0, res.stars), time: old.time === undefined ? res.time : Math.min(old.time, res.time),
        fish: Math.max(old.fish || 0, res.fish),
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
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') { restorePurchase(); return; }
    savePrefs();
  }
  // Settings > Restore purchase: asks the store again; clear busy / found / not found / failed messages.
  const owned = () => env.monetization.owns?.('unlock_game') === true;
  function say(text, hold = 3) { state.toast = { text, t: 0, hold }; }
  function restorePurchase() {
    if (state.demo || owned() || state.restoreBusy) return;
    state.restoreBusy = true; say('Checking with the store...', 8);
    Promise.resolve(env.monetization.restore()).then(() => {
      say(owned() ? 'Purchase restored. Full game unlocked.' : 'No earlier purchase found.');
    }).catch(() => say('Could not reach the store. Try again later.')).finally(() => { state.restoreBusy = false; });
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
    render(ctx, view) { ctx.clearRect(0, 0, view?.width ?? meta.width, view?.height ?? meta.height); render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
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
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.course !== undefined) state.sel = o.course;
        const sc = o.scene ?? 'title';
        if (sc === 'play') {
          startPlay(o.mode ?? 'race', state.sel);
          if (o.play && state.pl) state.pl.W.boats[0].bot = true;
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('race', state.sel); state.pl.W.boats[0].bot = true;
          for (let i = 0; i < 60 * 600 && state.scene === 'play'; i++) api.update(1 / 60, idle());
          if (state.result) state.result.newBest = true;
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.advance) for (let i = 0; i < o.advance * 60; i++) api.update(1 / 60, idle());
        if (o.pause && state.pl) pausePlay();
      },
    },
  };
  return api;
}
