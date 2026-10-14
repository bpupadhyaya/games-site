// Hoop Rolling Trundle: state and flow. Drawing is in view.js / playview.js / docview.js; the physics, courses and rivals are in sim.js / courses.js.
//
// Time model: the race clock is the sum of the dt values handed to update() (deterministic, pausable). Think/Reveal in Watch and Learn
// and the Practice hint stop the clock; Pause freezes everything.
import {
  PHYS, createWorld, stepWorld, resultOf, sectionsOf, featureAhead, planFor, placeOf, ghostLine, DEMO_RUNS,
} from './sim.js';
import { COURSES } from './courses.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { burst, stepParticles, makeCam, playerAnchor } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { gl } from './glhook.js';
import { rulesPages, THINK_CHOICES, REVEAL_SECONDS } from './content.js';
import { GRADE_TEXT, GRADE_COL, stickGeometry, stickOf } from './playview.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const FEATURE_TEXT = {
  plank: ['Plank bridge ahead', 'Narrow, with water on both sides. Hold your line and keep a steady speed.'],
  mud: ['Mud ahead', 'Mud drags hard. Keep pushing and carry speed in.'],
  cobble: ['Cobbles ahead', 'The hoop rattles. Ease off a little and keep the balance bar in the green.'],
  up: ['Uphill', 'The climb slows you. Keep pushing.'],
  down: ['Downhill', 'You gain speed fast. Brake before the next bend.'],
  left: ['Left bend', 'Slide your finger left of the hoop and ease off the push.'],
  right: ['Right bend', 'Slide your finger right of the hoop and ease off the push.'],
  hairpin: ['Hairpin ahead', 'A tight bend: brake early, then steer firmly through it.'],
  puddle: ['Puddle ahead', 'A puddle slows you and tips the hoop. Steer round it if you can.'],
};

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, thinkIdx: 1, ring: true, calm: false, textIdx: 0 },
    best: {}, demoRuns: 0, pl: null, result: null, menu: null, menuCourse: 0,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, restoreMsg: '', restoreBusy: false, owned: false, dev: config.dev === true, demo: config.demo === true,
  };
  let lastScene = state.scene, drag = null, hold = false;
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
  const mon = env.monetization;
  state.owned = !!mon?.owns?.('unlock_game');
  mon?.onChange?.(() => { state.owned = !!mon.owns('unlock_game'); });
  const lay = () => layoutFor(meta.width, meta.height);
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result') { state.pl = null; hold = false; } };
  const tone = (o) => { if (state.prefs.sound) env.audio.tone?.(o); };
  gl.sound = tone;                     // the 3D layer's small sounds (hoop clatter) go through the same mute switch

  // ---- the live menu backdrop (the performer riding a course behind the menus) -------------------------------------------------------
  function newMenu() {
    const ci = state.menuCourse % COURSES.length;
    state.menuCourse += 1;
    const W = createWorld(ci, { mode: 'auto' }, menuRng);
    state.menu = { W, parts: [], pops: [], shake: 0, gateRes: [], t: 0, ring: false };
    for (let i = 0; i < 60 * 5; i++) stepWorld(W, 1 / 60, null);     // start with the field already spread along the road
    W.events.length = 0;
  }
  function stepMenu(dt) {
    const m = state.menu;
    if (!m || m.W.racers[0].finished || m.W.racers[0].s > m.W.course.length - 8) { newMenu(); return; }
    stepWorld(m.W, dt, null);
    stepParticles(m.parts, dt);
    for (const e of m.W.events) if (e.type === 'gate' && e.who === 0) m.gateRes[e.gate] = e.q;
  }
  newMenu();

  // ---- a race --------------------------------------------------------------------------------------------------------------------
  function newPlay(ci, mode) {
    const W = createWorld(ci, { mode }, raceRng);
    const pl = {
      W, mode, ci, t: state.t, shake: 0, parts: [], pops: [], banner: null, paused: false, over: false, gateRes: [], ring: state.prefs.ring,
      auto: null, reveal: null, hintT: 0, hintCard: null, touch: null, sections: sectionsOf(COURSES[ci]), secIdx: 0, rollS: 0,
    };
    if (mode === 'auto') beginThink(pl, 0);
    return pl;
  }
  function sectionText(pl, s) {
    const f = featureAhead(COURSES[pl.ci], s, 46);
    if (s < 1) return ['Get ready', 'Hold below the hoop to push, slide sideways to steer, and roll through the gates.'];
    if (f) return FEATURE_TEXT[f.kind] ?? ['On the road', 'Keep steady and roll through the gates.'];
    return ['Open road', 'Roll through the middle of each gate for a Perfect.'];
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
    state.sel = ci; hold = false;
    state.pl = newPlay(ci, mode); state.result = null;
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('race_start', { course: COURSES[ci].id, mode });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.paused && !pl.over) { pl.paused = true; pl.touch = null; hold = false; } };
  const resumePlay = () => { const pl = state.pl; if (pl) pl.paused = false; };

  function addPop(pl, text, col, size, dx = 0) {
    pl.pops.push({ text, col, size, age: 0, dx });
    if (pl.pops.length > 4) pl.pops.shift();
  }
  function handleEvents(pl) {
    const W = pl.W, me = W.racers[0];
    for (const e of W.events) {
      if (e.type === 'count') tone({ freq: 330, dur: 0.18, type: 'triangle', vol: 0.14 });
      else if (e.type === 'go') { tone({ freq: 660, to: 990, dur: 0.3, type: 'triangle', vol: 0.18 }); tone({ freq: 220, dur: 0.3, type: 'sine', vol: 0.12 }); }
      else if (e.type === 'gate' && e.who === 0) {
        pl.gateRes[e.gate] = e.q;
        if (e.q === 'perfect') {
          const f = 660 * Math.pow(1.06, Math.min(8, e.chain));
          tone({ freq: f, to: f * 1.5, dur: 0.16, type: 'triangle', vol: 0.16 }); tone({ freq: f * 2, dur: 0.1, type: 'sine', vol: 0.06 });
          burst(pl.parts, fxRng, e.s, e.d, state.prefs.calm ? 5 : 12, '#ffd35a', 0.9, 1.2);
          addPop(pl, e.chain >= 3 ? `PERFECT x${e.chain}` : GRADE_TEXT.perfect, GRADE_COL.perfect, 40);
        } else if (e.q === 'good') {
          tone({ freq: 520, to: 640, dur: 0.13, type: 'triangle', vol: 0.13 });
          burst(pl.parts, fxRng, e.s, e.d, 6, '#8ff0d6', 0.7, 1);
          addPop(pl, GRADE_TEXT.good, GRADE_COL.good, 34);
        } else {
          tone({ freq: 200, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.1 });
          addPop(pl, GRADE_TEXT.miss, GRADE_COL.miss, 38);
        }
        if (e.chain > 0 && e.chain % 5 === 0) pl.banner = { text: `CHAIN x${e.chain}`, t: 0, col: '#8ff0d6' };
      } else if (e.type === 'post' && e.who === 0) {
        tone({ freq: 210, to: 120, dur: 0.14, type: 'square', vol: 0.12 }); pl.shake = 0.5;
        addPop(pl, GRADE_TEXT.post, GRADE_COL.post, 38);
        burst(pl.parts, fxRng, e.s, e.d, 8, '#e8d9b0', 0.8, 1);
      } else if (e.type === 'splash') {
        if (e.who === 0) { tone({ freq: 480, to: 160, dur: 0.22, type: 'sine', vol: 0.14 }); pl.shake = 0.3; addPop(pl, GRADE_TEXT.splash, GRADE_COL.splash, 38); }
        burst(pl.parts, fxRng, e.s, e.d, e.who === 0 ? 16 : 8, '#bfe8ff', 1, 1.5);
      } else if (e.type === 'wall' && e.who === 0) {
        tone({ freq: 160, to: 100, dur: 0.14, type: 'square', vol: 0.1 }); pl.shake = 0.4; addPop(pl, GRADE_TEXT.wall, GRADE_COL.wall, 36);
      } else if (e.type === 'fall' && e.who === 0) {
        tone({ freq: 190, to: 70, dur: 0.45, type: 'sawtooth', vol: 0.14 }); pl.shake = 0.9;
        pl.banner = { text: e.kind === 'water' ? 'SPLASH! INTO THE WATER' : 'THE HOOP FELL', t: 0, col: '#ff9a8a' };
        if (e.kind === 'water') burst(pl.parts, fxRng, e.s, e.d, 24, '#bfe8ff', 1.3, 1.6);
      } else if (e.type === 'finish' && e.who === 0) {
        tone({ freq: 523, dur: 0.25, type: 'triangle', vol: 0.14 }); tone({ freq: 659, dur: 0.3, type: 'triangle', vol: 0.12 }); tone({ freq: 784, dur: 0.4, type: 'triangle', vol: 0.12 });
        pl.banner = { text: placeOf(W, 0) === 0 ? 'YOU WIN!' : 'FINISHED!', t: 0, col: '#ffe07a' };
      }
    }
    // a soft rolling tick every metre or so, higher pitched when faster
    if (me.phase === 'roll' && W.go >= 0 && !me.finished) {
      if (me.s - pl.rollS > 1.1) { pl.rollS = me.s; tone({ freq: 120 + me.v * 14, to: 90, dur: 0.035, type: 'triangle', vol: 0.035 }); }
    }
    // dust behind a fast hoop
    if (!state.prefs.calm && me.phase === 'roll' && me.v > 4 && W.t % 0.12 < 1 / 60) burst(pl.parts, fxRng, me.s - 0.3, me.d, 1, me.surf === 'mud' ? '#6b4328' : me.surf === 'grass' ? '#6bb347' : '#e8d3a8', 0.35, 0.5);
  }

  function stepAnim(pl, dt) {
    pl.shake = state.prefs.calm ? 0 : Math.max(0, pl.shake - dt * 3);
    for (const p of pl.pops) p.age += dt;
    pl.pops = pl.pops.filter((p) => p.age < 0.9);
    stepParticles(pl.parts, dt);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 1.5) pl.banner = null; }
  }

  function revealNow(pl) {
    pl.reveal = { pts: ghostLine(pl.W, 5) };
  }
  function showHint(pl) {
    if (pl.mode !== 'practice' || pl.hintT > 0 || pl.W.go < 0 || pl.over) return;
    const me = pl.W.racers[0];
    if (me.phase !== 'roll') return;
    revealNow(pl);
    const pln = planFor(pl.W, { ...me, skill: 1 });
    pl.hintT = REVEAL_SECONDS + 0.5;
    const next = pl.W.course.gates[me.gi];
    pl.hintCard = {
      title: pln.p < -0.25 ? 'Brake now: lift your finger above the hoop, then steer.'
        : pln.u > 0.3 ? 'Slide your finger to the right of the hoop and keep pushing.'
          : pln.u < -0.3 ? 'Slide your finger to the left of the hoop and keep pushing.'
            : next ? 'Hold below the hoop and aim for the gold ring in the next gate.' : 'Hold below the hoop and roll to the finish.',
    };
  }

  function updatePlay(dt, tap, input) {
    const pl = state.pl, L = lay().play, W = pl.W, me = W.racers[0];
    pl.t = state.t;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    const k = input.keys.pressed, pt = input.pointer;
    if (tap) {
      if (inRect(L.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (pl.mode === 'practice' && inRect(L.hint, tap.x, tap.y)) { showHint(pl); hold = false; }
      else if (!inRect(L.hint, tap.x, tap.y)) hold = true;
    }
    if (!pt.down) hold = false;
    if (k.has('Escape') || k.has('KeyP')) { pausePlay(); return; }
    if (k.has('KeyH')) showHint(pl);
    stepAnim(pl, dt);
    // Practice hint: the clock stands still while the performer's line is lit
    if (pl.hintT > 0) { pl.hintT -= dt; if (pl.hintT <= 0) { pl.hintCard = null; pl.reveal = null; } return; }
    // Watch and Learn: Think then Reveal before each section, with the clock stopped
    if (pl.auto && pl.auto.phase !== 'act') {
      const a = pl.auto; a.timer -= dt;
      if (a.timer <= 0) {
        if (a.phase === 'think') { a.phase = 'reveal'; a.timer = REVEAL_SECONDS; revealNow(pl); }
        else { a.phase = 'act'; pl.reveal = null; }
      }
      return;
    }
    if (pl.auto && pl.auto.phase === 'act') {
      const nx = pl.sections[pl.secIdx + 1];
      if (nx !== undefined && me.s + me.v * dt >= nx && !me.finished) { pl.secIdx += 1; beginThink(pl, pl.secIdx); return; }
    }
    // the player's stick: the finger (or the keyboard) gives steer u and push p
    let cmd = null;
    if (!me.bot) {
      const stage = L.stage, A = playerAnchor(makeCam(stage, W, me, 0), me), geo = stickGeometry(stage, A);
      cmd = { u: 0, p: 0 };
      if (hold && pt.down) {
        pl.touch = { x: pt.x, y: pt.y };
        const s = stickOf(geo, pt.x, pt.y);
        // a short low-pass so a trembling finger does not buzz the steering; deterministic (fixed step)
        const a = 1 - Math.exp(-dt * 22);
        pl.sm = pl.sm ? { u: pl.sm.u + (s.u - pl.sm.u) * a, p: pl.sm.p + (s.p - pl.sm.p) * a } : { u: s.u, p: s.p };
        cmd.u = pl.sm.u; cmd.p = pl.sm.p;
      } else {
        pl.sm = null;
        pl.touch = null;
        const kd = input.keys.down;
        if (kd.has('ArrowLeft') || kd.has('KeyA')) cmd.u -= 1;
        if (kd.has('ArrowRight') || kd.has('KeyD')) cmd.u += 1;
        if (kd.has('Space') || kd.has('ArrowUp') || kd.has('KeyW')) cmd.p = 1;
        else if (kd.has('ArrowDown') || kd.has('KeyS')) cmd.p = -1;
      }
    }
    stepWorld(W, dt, cmd);
    handleEvents(pl);
    if (W.over) finishRun();
  }

  function finishRun() {
    const pl = state.pl, W = pl.W;
    const res = resultOf(W);
    const c = COURSES[pl.ci], old = state.best[c.id] ?? {};
    res.mode = pl.mode;
    if (pl.mode !== 'race') res.stars = 0;
    res.newBest = false;
    if (pl.mode === 'race' && res.finished) {
      res.newBest = !old.score || res.score > old.score;
      state.best[c.id] = {
        score: Math.max(old.score || 0, res.score), place: old.place === undefined ? res.place : Math.min(old.place, res.place),
        stars: Math.max(old.stars || 0, res.stars), time: old.time === undefined ? res.time : Math.min(old.time, res.time),
      };
      storage.set('best', state.best);
    }
    env.monetization.track?.('race_end', { course: c.id, mode: pl.mode, place: res.place });
    pl.over = true; pl.touch = null; hold = false; state.result = res; state.scene = 'result'; state.sceneT = 0;
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
    else if (id === 'restore') {
      if (state.restoreBusy || state.owned) { if (state.owned) state.restoreMsg = 'Full game unlocked'; return; }
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(mon?.restore?.()).then(() => {
        state.owned = !!mon?.owns?.('unlock_game');
        state.restoreMsg = state.owned ? 'Purchase restored. Full game unlocked' : 'No earlier purchase found';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
      return;
    }
    savePrefs();
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
