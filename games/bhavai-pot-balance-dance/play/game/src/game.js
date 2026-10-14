// Bhavai Pot Balance Dance: state and flow. Drawing is in view.js / playview.js / docview.js; the physics, acts and performer are in
// sim.js / courses.js.
//
// Time model: the dance clock is the sum of the dt values handed to update() (deterministic, pausable). Think/Reveal in Watch and
// Learn and the Practice hint stop the clock; Pause freezes everything.
import {
  PHYS, createWorld, stepWorld, resultOf, botCommand, sectionTimes, actStats, DEMO_RUNS, REVEAL_SECONDS, clamp,
} from './sim.js';
import { ACTS, POT_MAX, PHRASE } from './courses.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, gl } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { rulesPages, THINK_CHOICES } from './content.js';
import { newView, targetPpm } from './playview.js';
import { makeCam } from './art.js';
import { beatTime, catchX, windNow, fallLimit } from './sim.js';
import { SLOTS } from './courses.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };

const MELODY = [0, 2, 4, 7, 9, 12, 9, 7, 4, 2];                  // major-pentatonic steps above the root
const ROOTS = [196, 220, 233, 262, 247, 220, 262, 294];          // one per act (Hz)
const semis = (n) => Math.pow(2, n / 12);

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, thinkIdx: 1, guide: false, calm: false, textIdx: 0 },
    best: {}, demoRuns: 0, pl: null, result: null, menu: null, menuAct: 0,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
    owned: false, restoreMsg: '', restoreBusy: false,
  };
  const mon = env.monetization;
  state.owned = !!mon?.owns?.('unlock_game');
  mon?.onChange?.(() => { state.owned = !!mon.owns('unlock_game'); });
  let lastScene = state.scene, drag = null;
  const fxRng = rng.fork();

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

  // ---- shared effects: what the world's events do to the picture and the sound --------------------------------------------------------
  function popup(V, text, col, size, x, rise = 0) {
    V.pops.push({ text, col, size, age: 0, x, rise });
    if (V.pops.length > 4) V.pops.shift();
  }
  function applyEvents(V, W, audible) {
    for (const e of W.events) {
      V.evLog.push({ ...e, n: ++V.evSeq });
      if (e.type === 'beat') {
        V.beatCount += 1; V.pulse = 1;
        if (audible) {
          const k = e.i % 4, root = ROOTS[W.ai];
          tone({ freq: k % 2 === 0 ? 96 : 140, to: k % 2 === 0 ? 55 : 90, dur: 0.16, type: 'sine', vol: k === 0 ? 0.2 : 0.13 });
          if (k % 2 === 1) tone({ freq: 620, to: 380, dur: 0.05, type: 'triangle', vol: 0.05 });
          if (e.beatType !== 'rest') tone({ freq: root * semis(MELODY[(e.i + W.ai) % MELODY.length]), dur: 0.22, type: 'triangle', vol: 0.045 });
        }
      } else if (e.type === 'count') {
        if (audible) tone({ freq: 330 + e.n * 40, dur: 0.14, type: 'triangle', vol: 0.12 });
      } else if (e.type === 'step') {
        if (e.q === 'miss') { if (audible) tone({ freq: 150, to: 100, dur: 0.14, type: 'sine', vol: 0.1 }); popup(V, 'MISS', '#ff8a7a', 38, e.x); }
        else {
          burst(V.parts, fxRng, e.x, 0.06, state.prefs.calm ? 3 : e.q === 'perfect' ? 9 : 5, ['#ffb52e', '#ff6f9c', '#ffe08a'], 0.7, { kind: 'petal', size: 1.3 });
          if (audible) { tone({ freq: e.q === 'perfect' ? 880 : 660, to: e.q === 'perfect' ? 1175 : 740, dur: 0.12, type: 'triangle', vol: 0.12 }); tone({ freq: 3100, to: 2500, dur: 0.07, type: 'square', vol: 0.025 }); tone({ freq: 3700, to: 3000, dur: 0.05, type: 'square', vol: 0.02 }); }   // ghungroo jingle
          if (e.q === 'perfect' && (e.combo === 1 || e.combo % 4 === 0)) popup(V, e.combo > 1 ? `PERFECT x${e.combo}` : 'PERFECT', '#ffe07a', 40, e.x);
          else if (e.q === 'good' && e.combo % 3 === 1) popup(V, 'GOOD', '#8ff0e6', 34, e.x);
        }
      } else if (e.type === 'pot') {
        if (e.ok) {
          V.potPop = 1; V.banner = { text: 'POT ADDED!', kind: 'gold', t: 0 };
          burst(V.parts, fxRng, e.x, 1.7 + 0.265 * e.n, 14, ['#ffd45a', '#ffffff', '#27c4c0'], 0.9, { kind: 'ring' });
          if (audible) { tone({ freq: 523, dur: 0.12, type: 'triangle', vol: 0.14 }); tone({ freq: 784, dur: 0.2, type: 'triangle', vol: 0.12 }); }
        } else {
          V.flyBack = { age: 0, x: e.x, to: (W.ai % 2 ? -1 : 1) * 2.2, n: e.n, i: e.n };
          V.banner = { text: 'TOO SHAKY FOR A POT', kind: 'bad', t: 0 };
          if (audible) tone({ freq: 240, to: 160, dur: 0.22, type: 'sawtooth', vol: 0.08 });
        }
      } else if (e.type === 'turn') {
        V.spin = 1; V.spinDir = e.dir;
        if (audible) tone({ freq: 300, to: 760, dur: 0.3, type: 'sine', vol: 0.1 });
      } else if (e.type === 'turnHeld') {
        popup(V, 'SPIN HELD', '#8ff0e6', 34, e.x, 0.3);
      } else if (e.type === 'fall') {
        V.shake = 0.9; V.flash = 1;
        V.falling.push({ x: e.x + Math.sin(e.th) * (1.8 + 0.265 * e.n), y: 1.76 + 0.265 * e.n, vx: e.dir * 1.3, vy: 1.2, rot: e.th, vr: e.dir * 4, i: e.n - 1 });
        V.banner = { text: 'CRACK! A POT FELL', kind: 'bad', t: 0 };
        if (audible) { tone({ freq: 900, to: 220, dur: 0.1, type: 'square', vol: 0.1 }); tone({ freq: 160, to: 70, dur: 0.35, type: 'sawtooth', vol: 0.12 }); }
      } else if (e.type === 'end') {
        if (audible) { tone({ freq: 523, dur: 0.25, type: 'triangle', vol: 0.14 }); tone({ freq: 659, dur: 0.3, type: 'triangle', vol: 0.12 }); tone({ freq: 784, dur: 0.4, type: 'triangle', vol: 0.12 }); }
      }
    }
  }
  function stepView(V, dt) {
    V.t += dt;
    if (V.evLog.length > 40) V.evLog.splice(0, V.evLog.length - 40);
    V.pulse = Math.max(0, V.pulse - dt * 4); V.shake = state.prefs.calm ? 0 : Math.max(0, V.shake - dt * 3); V.flash = Math.max(0, V.flash - dt * 2.5);
    V.spin = Math.max(0, V.spin - dt * 1.1); V.potPop = Math.max(0, V.potPop - dt * 2);
    for (const p of V.pops) p.age += dt;
    V.pops = V.pops.filter((p) => p.age < 0.85);
    if (V.banner) { V.banner.t += dt; if (V.banner.t > 1.6) V.banner = null; }
    if (V.flyBack) { V.flyBack.age += dt; if (V.flyBack.age > 0.6) V.flyBack = null; }
    for (const f of V.falling) {
      f.vy -= 9 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
      if (f.y < 0.14) { f.dead = true; burst(V.parts, fxRng, f.x, 0.1, 12, ['#d9683a', '#a8431f', '#fff1d4', '#c9502e'], 1.1, { kind: 'shard', flat: true, size: 1.3 }); }
    }
    V.falling = V.falling.filter((f) => !f.dead);
    stepParticles(V.parts, dt);
  }

  // ---- the live menu backdrop (the performer dancing an act behind the menus) ---------------------------------------------------------
  function newMenu() {
    const ai = state.menuAct % ACTS.length;
    state.menuAct += 1;
    const W = createWorld(ai, { mode: 'dance' });
    state.menu = { W, V: newView(), ai };
    for (let i = 0; i < 60 * 9; i++) stepWorld(W, 1 / 60, botCommand(W, 0.95));    // start already in the dance
    W.events.length = 0;
  }
  function stepMenu(dt) {
    const m = state.menu;
    if (!m || m.W.over) { newMenu(); return; }
    stepWorld(m.W, dt, botCommand(m.W, 0.95, dt));
    applyEvents(m.V, m.W, false);
    stepView(m.V, dt);
    if (m.W.n < ACTS[m.ai].pots0 - 1) newMenu();
  }
  newMenu();

  // ---- a dance ------------------------------------------------------------------------------------------------------------------------
  function newPlay(ai, mode) {
    const W = createWorld(ai, { mode });
    const st = actStats(ACTS[ai]);
    const pl = {
      W, mode, ai, V: newView(), paused: false, over: false, auto: null, reveal: null, hintT: 0, hintCard: null,
      sections: sectionTimes(W), secIdx: 0, target: Math.min(POT_MAX, st.pots), xt: 0,
    };
    if (mode === 'auto') beginThink(pl, 0);
    return pl;
  }
  function phraseText(pl, idx) {
    const W = pl.W, from = idx * PHRASE, bs = W.beats.slice(from, from + PHRASE);
    const steps = bs.filter((b) => b.type === 'step').length, spin = bs.findIndex((b) => b.type === 'turn'), pot = bs.findIndex((b) => b.type === 'pot');
    const extra = [spin >= 0 ? `a spin on beat ${spin + 1}` : '', pot >= 0 ? `a pot on beat ${pot + 1}` : ''].filter(Boolean).join(', ');
    return [`Phrase ${idx + 1} of ${Math.ceil(W.beats.length / PHRASE)}`, `${steps} footprints${extra ? ', ' + extra : ''}`];
  }
  function beginThink(pl, idx) {
    const [title, tip] = phraseText(pl, idx);
    pl.auto = { phase: 'think', timer: THINK_CHOICES[state.prefs.thinkIdx], title, tip, sec: idx };
    pl.reveal = null;
  }
  function startPlay(mode, ai = state.sel) {
    const limited = config.demo && mode !== 'auto';
    if (limited && (ai > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (limited) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.sel = ai;
    state.pl = newPlay(ai, mode); state.result = null;
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('dance_start', { act: ACTS[ai].id, mode });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.paused && !pl.over) pl.paused = true; };
  const resumePlay = () => { const pl = state.pl; if (pl) pl.paused = false; };

  function showHint(pl) {
    if (pl.mode !== 'practice' || pl.hintT > 0 || pl.W.t < 0 || pl.over) return;
    pl.hintT = REVEAL_SECONDS + 0.5; pl.reveal = { hint: true };
    pl.hintCard = { title: 'Follow the numbered footprints.', tip: 'The gold marker on the floor is where to steer to settle the tower.' };
  }

  function chartMapX(C, px, lane) { return clamp(((px - (C.x + C.w / 2)) / (C.w / 2 - 26)) * lane, -PHYS.X_MAX, PHYS.X_MAX); }

  function updatePlay(dt, tap, input) {
    const pl = state.pl, P = lay().play, W = pl.W, V = pl.V;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    const k = input.keys.pressed, p = input.pointer;
    if (tap) {
      if (inRect(P.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (pl.mode === 'practice' && inRect(P.hint, tap.x, tap.y)) showHint(pl);
    }
    if (k.has('Escape') || k.has('KeyP')) { pausePlay(); return; }
    if (k.has('KeyH')) showHint(pl);
    // camera zoom follows the pot count
    const want = targetPpm(P.stage, W.n, P.stage.w > P.stage.h);
    V.ppm = V.ppm ? V.ppm + (want - V.ppm) * Math.min(1, 2.2 * dt) : want;
    stepView(V, dt);
    // the practice hint: the clock stands still while the next footprints are lit
    if (pl.hintT > 0) { pl.hintT -= dt; if (pl.hintT <= 0) { pl.hintCard = null; pl.reveal = null; } return; }
    // Watch and Learn: Think then Reveal before each phrase, with the clock stopped
    if (pl.mode === 'auto' && pl.auto && pl.auto.phase !== 'act') {
      const a = pl.auto; a.timer -= dt;
      if (a.timer <= 0) {
        if (a.phase === 'think') { a.phase = 'reveal'; a.timer = REVEAL_SECONDS; pl.reveal = { phrase: a.sec }; }
        else { a.phase = 'act'; pl.reveal = null; }
      }
      return;
    }
    if (pl.mode === 'auto' && pl.auto && pl.auto.phase === 'act') {
      const nx = pl.sections[pl.secIdx + 1];
      if (nx !== undefined && W.t + dt >= nx && !W.over) { pl.secIdx += 1; beginThink(pl, pl.secIdx); return; }
    }
    // the steering command
    let cmd;
    if (pl.mode === 'auto') cmd = botCommand(W, 0.95, dt);
    else {
      const keys = input.keys.down;
      const kdir = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      if (kdir) pl.xt = clamp(pl.xt + kdir * 2.6 * dt, -PHYS.X_MAX, PHYS.X_MAX);
      else if (p.down && !inRect(P.pause, p.x, p.y) && !inRect(P.hint, p.x, p.y)) pl.xt = chartMapX(P.chart, p.x, P.lane);
      cmd = { xt: pl.xt };
    }
    stepWorld(W, dt, cmd);
    applyEvents(V, W, true);
    if (W.over) finishRun();
  }

  function finishRun() {
    const pl = state.pl, W = pl.W;
    const res = resultOf(W);
    const a = ACTS[pl.ai], old = state.best[a.id] ?? {};
    res.mode = pl.mode;
    if (pl.mode !== 'dance') res.stars = 0;
    res.newBest = false;
    if (pl.mode === 'dance') {
      res.newBest = !old.score || res.score > old.score;
      state.best[a.id] = { score: Math.max(old.score || 0, res.score), stars: Math.max(old.stars || 0, res.stars), pots: Math.max(old.pots || 0, res.pots) };
      storage.set('best', state.best);
    }
    env.monetization.track?.('dance_end', { act: a.id, mode: pl.mode, stars: res.stars, completed: res.completed });
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
      else if (it === 'restart') startPlay(pl.mode, pl.ai);
      else go('courses');
    });
  }

  // ---- menus and documents ---------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'think') p.thinkIdx = cyc(p.thinkIdx, THINK_CHOICES.length);
    else if (id === 'guide') p.guide = !p.guide;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') { restorePurchase(); return; }
    savePrefs();
  }
  // Restore purchase (Settings): clear busy / restored / not-found / failed messages; hidden in the web demo.
  function restorePurchase() {
    if (state.demo || state.owned || state.restoreBusy || !mon?.restore) return;
    state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
    Promise.resolve(mon.restore()).then(() => {
      state.owned = !!mon.owns('unlock_game');
      state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
    }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; })
      .finally(() => { state.restoreBusy = false; });
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
  function updateActs(tap) {
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
    else if (inRect(D.race, tap.x, tap.y)) startPlay('dance');
    else if (inRect(D.watch, tap.x, tap.y)) startPlay('auto');
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay(state.result.mode, state.result.ai);
    else if (inRect(Rr.courses, tap.x, tap.y)) go('courses');
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- what the 3D presenter reads (plain data, rebuilt every frame; the presenter never writes back) --------------------------------
  function v3Of(L, view) {
    const sc = state.scene, playing = sc === 'play' && state.pl;
    const src = playing ? state.pl : state.menu;
    if (!src) return null;
    const W = src.W, V = src.V, w = view?.width ?? meta.width, h = view?.height ?? meta.height;
    // the rectangle the dancer is framed in: the stage while playing, the hero area on the title, the poster window in act detail
    let rect = playing ? L.play.stage : sc === 'title' ? L.title.hero : (sc === 'detail' && state.v3rect ? state.v3rect : L.S);
    const wide = rect.w > rect.h;
    // act detail window: frame the tower tightly (the generic stage margin leaves the dancer small in a thin window)
    const want = sc === 'detail' ? clamp(Math.min((rect.h * 0.94) / (1.76 + 0.265 * Math.max(W.n, 4) + 0.4), rect.w / 3.6), 40, 240) : targetPpm(rect, W.n, wide);
    if (playing) V.ppm = V.ppm || want;
    else V.ppm = V.ppm ? V.ppm + (want - V.ppm) * Math.min(1, 6 * Math.max(0, state.t - (V.lastRenderT ?? state.t))) : want;
    V.lastRenderT = state.t;
    const cam = makeCam(rect, V.ppm);
    const act = sc === 'detail' ? ACTS[state.sel] : ACTS[W.ai];
    const bl = W.bl, ph = ((W.t - W.t0) / bl) % 1, bp = ph < 0 ? ph + 1 : ph;
    const targets = [];
    if (playing) {
      let shown = 0;
      for (let i = W.bi; i < W.beats.length && shown < 2; i++) {
        const b = W.beats[i];
        if (b.type !== 'step') continue;
        const tb = beatTime(W, i), k = clamp(1 - (tb - W.t) / (bl * 3), 0, 1);
        targets.push({ x: SLOTS[b.slot], k, first: shown === 0, i });
        shown += 1;
      }
    }
    let incoming = null;
    for (let i = W.bi; i < Math.min(W.beats.length, W.bi + 2); i++) {
      if (W.beats[i].type !== 'pot') continue;
      const dtb = beatTime(W, i) - W.t, span = Math.min(0.55, bl * 0.9);
      if (dtb > span || dtb < 0) break;
      incoming = { u: 1 - dtb / span, from: (W.ai % 2 ? -1 : 1) * 2.2, n: W.n };
      break;
    }
    const pl = state.pl;
    return {
      on: true, w, h, scene: sc, playing: !!playing, rect, ox: cam.ox, oy: cam.oy, ppm: V.ppm,
      frozen: !!(playing && (pl.paused || pl.over)) || (playing && (pl.hintT > 0 || (pl.auto && pl.auto.phase !== 'act' && pl.mode === 'auto'))),
      ai: W.ai, act, look: W.ai % 2, calm: state.prefs.calm,
      x: W.x, v: W.v, th: W.th, om: W.om, acc: W.acc ?? 0, n: W.n, t: W.t, bl, bp, beatCount: V.beatCount, grace: W.grace,
      lim: fallLimit(W.n, W.practice), spin: V.spin, spinDir: V.spinDir, shake: V.shake, pulse: V.pulse, wind: windNow(W),
      targets, incoming, flyBack: V.flyBack ? { ...V.flyBack } : null, ev: V.evLog, guide: playing && (pl.mode === 'practice' || state.prefs.guide || !!pl.reveal) ? catchX(W) : null,
      over: W.over, practice: W.practice, combo: W.combo,
    };
  }

  // ---- the object the kit and main.js see ------------------------------------------------------------------------------------------
  const idle = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } });
  const asPerformer = (pl) => { pl.mode = 'auto'; pl.auto = { phase: 'act', timer: 0, title: '', tip: '', sec: 0 }; };
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc !== 'play') stepMenu(dt);
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'courses') updateActs(tap);
      else if (sc === 'detail') updateDetail(tap);
      else if (sc === 'play') updatePlay(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height);
      if (gl.on) ctx.clearRect(0, 0, view?.width ?? meta.width, view?.height ?? meta.height);
      render(ctx, state, L, view, meta, pauseItems);
      state.v3 = v3Of(L, view);
    },
    // The presenter reports whether the WebGL stage is drawing; when it is not, the painted 2D courtyard is used.
    setGl(on) { state.gl = !!on; gl.on = !!on; },
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
          startPlay(o.mode ?? 'dance', state.sel);
          if (o.play && state.pl) { asPerformer(state.pl); }
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('dance', state.sel); asPerformer(state.pl);
          for (let i = 0; i < 60 * 400 && state.scene === 'play'; i++) api.update(1 / 60, idle());
          if (state.result) { state.result.mode = 'dance'; state.result.newBest = true; state.result.stars = Math.max(state.result.stars, 2); }
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) for (let i = 0; i < o.advance * 60; i++) api.update(1 / 60, idle());
      },
    },
  };
  return api;
}
