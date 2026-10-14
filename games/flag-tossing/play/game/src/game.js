// Flag Tossing: state and flow. Drawing is in view.js / playview.js / docview.js; the rules engine is engine.js.
//
// Time model: everything runs on the dt handed to update() (deterministic, pausable). The show clock advances by dt x timeScale, where the
// scale is 1, or the Think slow-motion. In Watch and Learn the show clock is frozen while the computer thinks and reveals.
import { TUNE, ENS, SPEEDS, PRACTICE_FIGS, createShow, stepShow, throwFlag, catchFlag, trackWave, nextCue, aiPlan, aiCursor, nAirOf, youOf, xOf, slotOf } from './engine.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { burst, stepParticles, DESIGNS, clamp } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';
import { geom, slotX } from './playview.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const DEMO_RUNS = 3;
const AUTO_FIGS = 6;                                           // the Watch and Learn show ends after this many figures
const AUTO_PLAN = [{ id: 'toss3', ens: 1 }, { id: 'twin', ens: 1 }, { id: 'wave', ens: 1 }, { id: 'cross', ens: 2 }, { id: 'relay', ens: 3 }, { id: 'fan', ens: 3 }];
const GRADE_TEXT = { perfect: 'PERFECT', good: 'GOOD', off: 'OFF' };
const GRADE_COL = { perfect: '#fff0b0', good: '#8fd3ff', off: '#ffb27a' };
const DROP_TEXT = { missed: 'DROPPED', wide: 'TOO WIDE', stray: 'MISSED BY PARTNER', blank: 'NO THROW', wave: 'WAVE LOST' };
const AI_REVEAL = 2;
const MOVE_MIN = 26;

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, backTo: 'title',
    prefs: { sound: true, guides: true, calm: false, thinkSec: 5, textIdx: 0 },
    best: { score: 0, act: 0, flow: 0, shows: 0 }, demoRuns: 0, setup: { fig: 'mixed', ens: 1, speedIdx: 1 },
    pl: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
    owned: false, restoreMsg: '', restoreBusy: false,
  };
  const refreshOwned = () => { state.owned = !!env.monetization?.owns?.('unlock_game'); };
  refreshOwned(); env.monetization?.onChange?.(refreshOwned);
  let lastScene = state.scene, drag = null;
  const later = [];                                            // tiny delayed callbacks counted in dt

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = Math.min(Math.max(state.prefs.textIdx | 0, 0), TEXT_SCALES.length - 1); state.prefs.thinkSec = Math.min(10, Math.max(1, state.prefs.thinkSec | 0)); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) Object.assign(state.best, v); });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result' && !(state.pl && state.pl.paused && scene === 'rules')) state.pl = null; };
  const tone = (o) => { if (state.prefs.sound) env.audio.tone(o); };
  // brass: two slightly detuned saw tones with a short attack stand in for a pair of chiarine; snare: a short noisy knock
  const brass = (f, dur, vol = 0.07) => { tone({ freq: f, dur, type: 'sawtooth', vol }); tone({ freq: f * 1.006, dur, type: 'sawtooth', vol: vol * 0.7 }); tone({ freq: f * 2, dur: dur * 0.8, type: 'square', vol: vol * 0.25 }); };
  const snare = (vol = 0.1) => { tone({ freq: 190, to: 140, dur: 0.06, type: 'square', vol }); tone({ freq: 2400, dur: 0.03, type: 'sawtooth', vol: vol * 0.5 }); };
  const cheer = (pl, kind, intensity = 1) => { pl.cheer = { id: (pl.cheer ? pl.cheer.id : 0) + 1, kind, intensity }; };

  // ---- a play session -------------------------------------------------------------------------------------------------------------------
  function newPlay(mode) {
    const o = { mode };
    if (mode === 'practice') { const s = state.setup; o.fig = s.fig; o.ens = s.ens; o.bpm = SPEEDS[s.speedIdx].bpm; }
    if (mode === 'auto') { o.plan = AUTO_PLAN; o.bpm = 78; }
    const show = createShow(rng, o);
    return {
      mode, show, paused: false, over: false, parts: [], pops: [], banner: null, shake: 0, beatFlash: 0, count: null,
      arm: [0, 0, 0], drag: null, hint: null, thinkT: 0, ending: 0, kc: 0,
      ai: mode === 'auto' ? { phase: 'think', t: 0, figRef: null, actions: [], lessons: 0 } : null, bot: null,
    };
  }
  function startPlay(mode) {
    if (config.demo && mode !== 'auto' && state.demoRuns >= DEMO_RUNS) { go('demo-limit'); return; }
    if (config.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.pl = newPlay(mode); state.result = null;
    state.scene = 'play'; state.sceneT = 0; drag = null;
    const sh = state.pl.show;
    state.pl.banner = { text: mode === 'practice' ? 'PRACTICE' : mode === 'auto' ? 'WATCH AND LEARN' : 'ACT 1', sub: mode === 'perform' ? `${ENS[sh.ens].name}  ·  ${sh.bpm} beats a minute` : null, t: 0 };
    env.monetization.track?.('show_start', { mode });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.paused && !pl.over && state.scene === 'play') { pl.paused = true; pl.drag = null; } };
  const resumePlay = () => { if (state.pl) state.pl.paused = false; };

  // ---- helpers over the geometry ---------------------------------------------------------------------------------------------------------
  const slotXY = (slot) => { const L = lay(), sh = state.pl.show, g = geom(L); return { x: slotX(L, sh, slot), y: g.P.grip - g.Lf * 0.1 }; };
  const youXY = () => slotXY(youOf(state.pl.show));
  const pop = (pl, p, text, col, size) => {
    const L = lay();
    pl.pops = pl.pops.filter((q) => Math.abs(q.x - p.x) > 90 || Math.abs(q.y - p.y) > 40);
    pl.pops.push({ x: Math.max(110, Math.min(L.w - 110, p.x)), y: p.y - 40, text, col, size, age: 0 });
    if (pl.pops.length > 8) pl.pops.shift();
  };
  const confettiFor = (design) => { const d = DESIGNS[design % 8]; return [d.a, d.b, '#ffffff', '#f2c14e']; };

  // ---- reactions to what happened in the show ----------------------------------------------------------------------------------------------
  function reactions(pl) {
    const show = pl.show, L = lay(), g = geom(L);
    for (const e of show.ev) {
      if (e.k === 'beat') {
        pl.beatFlash = 1;
        if (e.count > 0) { pl.count = { text: String(e.count), t: 0 }; tone({ freq: 440, dur: 0.07, type: 'triangle', vol: 0.18 }); }
        else if (e.n === TUNE.countIn) { pl.count = { text: 'GO', t: 0 }; tone({ freq: 660, dur: 0.12, type: 'triangle', vol: 0.2 }); }
        if (e.strong) tone({ freq: 110, to: 62, dur: 0.16, type: 'sine', vol: 0.32 });
        else { tone({ freq: 240, to: 180, dur: 0.07, type: 'sine', vol: 0.14 }); if (e.n % 2 === 1) snare(0.05); }
        tone({ freq: 1800, dur: 0.012, type: 'square', vol: 0.025 });
      } else if (e.k === 'throw') {
        const p = youXY();
        pl.arm[youOf(show)] = 0.4;
        tone({ freq: 300, to: 800, dur: 0.22, type: 'sine', vol: 0.14 });
        const text = e.grade !== 'off' ? GRADE_TEXT[e.grade] : e.relG === 'off' ? 'EARLY OR LATE' : e.airG === 'off' ? 'WRONG HEIGHT' : 'OFF TARGET';
        pop(pl, p, text, GRADE_COL[e.grade], e.grade === 'perfect' ? 40 : 32);
        if (!state.prefs.calm && e.grade === 'perfect') burst(pl.parts, rng, p.x, p.y - 20, 10, ['#fff0b0', '#f2c14e', '#ffffff'], 0.6, 'spark');
      } else if (e.k === 'catch') {
        const p = youXY();
        const f = [523, 659, 784], base = e.grade === 'perfect' ? 1 : 0.8;
        tone({ freq: f[0] * base, dur: 0.15, type: 'triangle', vol: 0.22 });
        if (e.grade === 'perfect') later.push({ t: 0.07, fn: () => tone({ freq: f[2], dur: 0.3, type: 'triangle', vol: 0.18 }) });
        pop(pl, p, `${GRADE_TEXT[e.grade]} +${e.pts}`, GRADE_COL[e.grade], e.grade === 'perfect' ? 40 : 32);
        cheer(pl, e.grade === 'perfect' ? 'ovation' : 'cheer', e.grade === 'perfect' ? 1 : 0.6);
        if (e.grade === 'perfect') { brass(659, 0.16); later.push({ t: 0.12, fn: () => brass(880, 0.28) }); }
        if (!state.prefs.calm) {
          const fl = show.flags.find((x) => x.id === e.id);
          burst(pl.parts, rng, p.x, p.y, e.grade === 'perfect' ? 26 : 12, confettiFor(fl ? fl.design : 0), e.grade === 'perfect' ? 1 : 0.6);
        }
      } else if (e.k === 'pcatch') {
        const p = slotXY(e.slot);
        pl.arm[e.slot] = 0.4;
        tone({ freq: 700, dur: 0.1, type: 'triangle', vol: 0.12 });
        cheer(pl, 'cheer', 0.35);
        pop(pl, p, `+${e.pts}`, '#8fd3ff', 30);
        if (!state.prefs.calm) burst(pl.parts, rng, p.x, p.y, 8, ['#8fd3ff', '#ffffff', '#f2c14e'], 0.5);
      } else if (e.k === 'swing') {
        const p = youXY();
        if (e.grade === 'miss') pop(pl, p, 'MISSED SWING', '#ffb27a', 28);
        else { pop(pl, p, `${GRADE_TEXT[e.grade]} +${e.pts}`, GRADE_COL[e.grade], 30); tone({ freq: e.side < 0 ? 600 : 760, dur: 0.1, type: 'triangle', vol: 0.15 }); }
      } else if (e.k === 'drop') {
        const p = e.slot !== undefined ? slotXY(e.slot) : youXY();
        tone({ freq: 220, to: 70, dur: 0.5, type: 'sawtooth', vol: 0.14 });
        cheer(pl, 'groan', 0.8);
        pop(pl, p, DROP_TEXT[e.reason] ?? 'DROPPED', '#ff6b6b', 34);
        if (!state.prefs.calm) pl.shake = Math.max(pl.shake, 0.7);
      } else if (e.k === 'stray') {
        pop(pl, youXY(), 'WAIT FOR THE BEAT', '#fbf1dc', 24);
      } else if (e.k === 'launch') {
        tone({ freq: 360, to: 520, dur: 0.12, type: 'sine', vol: 0.07 });
        if (e.slot >= 0) pl.arm[e.slot] = 0.35; else ENS[show.ens].xs.forEach((_, s) => { if (s !== youOf(show)) pl.arm[s] = 0.35; });
      } else if (e.k === 'clean') {
        pop(pl, { x: L.w / 2, y: g.P.skyTop + 120 }, `CLEAN FIGURE +${e.pts}`, '#fff0b0', 32);
        tone({ freq: 880, dur: 0.18, type: 'triangle', vol: 0.12 });
        cheer(pl, 'flag', 0.8);
      } else if (e.k === 'actClean') {
        pl.banner = { text: 'CLEAN ACT', sub: `+${e.pts}`, t: 0 };
        cheer(pl, 'ovation', 1);
        [523, 659, 784, 1047].forEach((f, i) => later.push({ t: i * 0.11, fn: () => brass(f, i === 3 ? 0.4 : 0.14, 0.08) }));
      } else if (e.k === 'act') {
        later.push({ t: 0.9, fn: () => { if (state.pl === pl) pl.banner = { text: `ACT ${e.act}`, sub: `${ENS[e.ens].name}  ·  ${e.bpm} beats a minute`, t: 0 }; } });
        [523, 659, 784].forEach((f, i) => later.push({ t: 0.9 + i * 0.1, fn: () => brass(f, 0.22, 0.08) }));
        for (let k = 0; k < 6; k++) later.push({ t: 0.35 + k * 0.08, fn: () => snare(0.07 + k * 0.012) });       // a drum roll into the next act
        cheer(pl, 'cheer', 0.9);
        env.monetization.track?.('act', { act: e.act });
      } else if (e.k === 'over') pl.ending = 1;
    }
    show.ev.length = 0;
  }

  // ---- input: throwing, catching, waving ------------------------------------------------------------------------------------------------------
  function userThrow(nAir, nAim) {
    const pl = state.pl; if (!pl || pl.paused || pl.over || pl.mode === 'auto') return;
    if (throwFlag(pl.show, nAir, nAim)) pl.hint = null;
    reactions(pl);
  }
  function userCatch(beat) {
    const pl = state.pl; if (!pl || pl.paused || pl.over || pl.mode === 'auto') return;
    catchFlag(pl.show, beat);
    reactions(pl);
  }
  function tryThink() {
    const pl = state.pl; if (!pl || pl.paused || pl.over || pl.mode === 'auto') return;
    const sh = pl.show;
    if (sh.thinkCool > 0 || pl.thinkT > 0) return;
    pl.thinkT = TUNE.thinkSeconds; sh.thinkCool = pl.mode === 'practice' ? 0 : TUNE.thinkCooldown; pl.hint = true;
    tone({ freq: 330, to: 440, dur: 0.25, type: 'sine', vol: 0.1 });
  }
  function gesture(pl, input, P, S) {
    const sh = pl.show, p = input.pointer, waving = sh.fig.waves.length > 0;
    if (p.pressed && !inRect(P.pause, p.x, p.y) && !inRect(P.think, p.x, p.y)) pl.drag = { x0: p.x, y0: p.y, x: p.x, y: p.y, dx: 0, up: 0, moved: false, b0: sh.b };
    if (pl.drag && (p.down || p.released)) {
      const d = pl.drag; d.x = p.x; d.y = p.y; d.dx = p.x - d.x0; d.up = d.y0 - p.y;
      if (Math.hypot(d.dx, d.up) >= MOVE_MIN) d.moved = true;
    }
    if (waving) {
      const kd = input.keys.down, kt = kd.has('ArrowLeft') ? -1 : kd.has('ArrowRight') ? 1 : 0;
      pl.kc += (kt - pl.kc) * 0.2;
      if (pl.drag && p.down) trackWave(sh, clamp((p.x - (S.x + S.w / 2)) / (S.w * 0.42), -1, 1), true);
      else if (Math.abs(pl.kc) > 0.05) trackWave(sh, pl.kc, true);
      else trackWave(sh, 0, false);
    }
    if (pl.drag && p.released) {
      const d = pl.drag; pl.drag = null;
      if (d.moved && !waving) { if (d.up >= MOVE_MIN * 0.9) userThrow(Math.min(1, d.up / P.reach), d.dx / S.w * TUNE.aimGain); }
      else if (!d.moved) userCatch(d.b0);
    }
    const k = input.keys.pressed, cue = nextCue(sh);
    const aim = cue && cue.kind === 'throw' ? xOf(sh, slotOf(sh, cue.to)) - xOf(sh, youOf(sh)) : 0;
    if (k.has('KeyA')) userThrow(nAirOf(2), aim);
    if (k.has('KeyS')) userThrow(nAirOf(3), aim);
    if (k.has('KeyD')) userThrow(nAirOf(4), aim);
    if (k.has('Enter') || k.has('KeyZ')) userCatch(sh.b);
    if (k.has('KeyH')) tryThink();
  }

  // ---- stage animation ------------------------------------------------------------------------------------------------------------------------
  function stepAnim(pl, dt) {
    stepParticles(pl.parts, dt);
    for (const p of pl.pops) p.age += dt;
    pl.pops = pl.pops.filter((p) => p.age < 0.9);
    pl.shake = Math.max(0, pl.shake - dt * 3.5);
    pl.beatFlash = Math.max(0, pl.beatFlash - dt * 4);
    for (let i = 0; i < pl.arm.length; i++) pl.arm[i] = Math.max(0, pl.arm[i] - dt);
    if (pl.count) { pl.count.t += dt; if (pl.count.t > 0.6) pl.count = null; }
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 2) pl.banner = null; }
    for (let i = later.length - 1; i >= 0; i--) { later[i].t -= dt; if (later[i].t <= 0) { later[i].fn(); later.splice(i, 1); } }
  }

  // ---- the computer player (Watch and Learn, and the screenshot bot) --------------------------------------------------------------------------
  // Plans a figure's actions once (with small human errors) and performs each one as the beat reaches it.
  function runActions(pl, ai) {
    const sh = pl.show;
    if (ai.figRef !== sh.fig) { ai.figRef = sh.fig; ai.actions = aiPlan(sh, rng, ai.skill ?? 1); }
    for (let i = 0; i < ai.actions.length; i++) {
      const a = ai.actions[i];
      if (a.done || sh.b < a.b) continue;
      a.done = true;
      if (a.k === 'throw') {
        const fl = throwFlag(sh, a.nAir, a.nAim);
        if (fl && fl.to === youOf(sh) && fl.reach) ai.actions.push({ k: 'catch', b: sh.b + fl.air + rng.range(-0.07, 0.07), done: false });
      } else catchFlag(sh, sh.b);
    }
    if (sh.fig.waves.length) trackWave(sh, aiCursor(sh), true);
    reactions(pl);
  }
  // Returns true when the show clock may run this tick.
  function aiStep(pl, dt, tap) {
    const ai = pl.ai, sh = pl.show;
    if ((ai.phase === 'run') && ai.figRef !== sh.fig) { ai.phase = 'think'; ai.t = 0; }
    if (ai.phase === 'think' || ai.phase === 'reveal') {
      if (ai.figRef !== sh.fig) { ai.figRef = sh.fig; ai.actions = aiPlan(sh, rng, 1); ai.lessons += 1; }
      ai.t += dt;
      const lim = ai.phase === 'think' ? state.prefs.thinkSec : AI_REVEAL;
      const skip = tap && inRect(lay().play.skip, tap.x, tap.y);
      if (ai.t >= lim || skip) {
        if (ai.phase === 'think') { ai.phase = 'reveal'; ai.t = skip ? AI_REVEAL * 0.35 : 0; }
        else { ai.phase = 'run'; ai.t = 0; }
      }
      return false;
    }
    return true;
  }

  // ---- per-tick play update -----------------------------------------------------------------------------------------------------------------
  function updatePlay(dt, tap, input) {
    const pl = state.pl, L = lay(), P = L.play;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    if (input.keys.pressed.has('Escape') || input.keys.pressed.has('Space')) { pausePlay(); return; }
    if (tap && inRect(P.pause, tap.x, tap.y)) { pausePlay(); return; }
    const sh = pl.show;
    if (pl.mode !== 'auto') {
      if (tap && inRect(P.think, tap.x, tap.y)) tryThink();
      else if (!pl.bot) gesture(pl, input, P, L.S);
    }
    let run = true;
    if (pl.ai) run = aiStep(pl, dt, tap);
    if (run) {
      let scale = 1;
      if (pl.thinkT > 0) { pl.thinkT -= dt; scale = TUNE.thinkScale; if (pl.thinkT <= 0) { pl.thinkT = 0; pl.hint = null; } }
      if (pl.ai) runActions(pl, pl.ai);
      else if (pl.bot) runActions(pl, pl.bot);
      stepShow(sh, dt * scale, rng);
      reactions(pl);
    }
    stepAnim(pl, dt);
    if (pl.mode === 'auto' && sh.figsDone >= AUTO_FIGS) finishRun(true);
    else if (sh.over || pl.ending) finishRun(false);
  }

  function finishRun(demoDone) {
    const pl = state.pl, sh = pl.show, old = state.best;
    const res = { mode: pl.mode, score: sh.score, act: sh.act, maxFlow: sh.maxFlow, figures: sh.figsDone, counts: { ...sh.counts }, drops: sh.drops, cleanActs: sh.cleanActs, throws: sh.throws, catches: sh.catches, seconds: Math.round(sh.t), newBest: false, demoDone: !!demoDone };
    if (pl.mode === 'perform') {
      res.newBest = sh.score > old.score;
      state.best = { score: Math.max(old.score, sh.score), act: Math.max(old.act, sh.act), flow: Math.max(old.flow, sh.maxFlow), shows: old.shows + 1 };
      storage.set('best', state.best);
    }
    env.monetization.track?.('show_end', { mode: pl.mode, score: sh.score, act: sh.act });
    pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  const pauseItems = () => ['resume', 'restart', 'rules', 'quit'];
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems();
    const M = menuRects(lay(), items.length);
    if (input.keys.pressed.has('Escape') && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart') startPlay(pl.mode);
      else if (it === 'rules') openDoc('rules', 'play');
      else go('title');
    });
  }

  // ---- menus and documents ------------------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'guides') p.guides = !p.guides;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'thinkDec') p.thinkSec = Math.max(1, p.thinkSec - 1);
    else if (id === 'thinkInc') p.thinkSec = Math.min(10, p.thinkSec + 1);
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') {
      if (state.restoreBusy || state.owned || state.demo) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(env.monetization.restore()).then(() => {
        refreshOwned();
        state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
      return;
    }
    savePrefs();
  }
  function leaveDoc() {
    if (state.backTo === 'play') { if (state.pl) { state.scene = 'play'; state.sceneT = 0; } else go('title'); return; }
    go(state.backTo);
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
    if (k.has('Escape')) { leaveDoc(); return; }
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
    if (id === 'back') { leaveDoc(); return; }
    if (id === 'textDec' || id === 'textInc') {
      const n = state.prefs.textIdx + (id === 'textInc' ? 1 : -1);
      if (n < 0 || n >= TEXT_SCALES.length) return;
      state.docFrac = docMetrics.max > 0 ? state.docScroll / docMetrics.max : 0; state.docRescale = true;
      state.prefs.textIdx = n; savePrefs(); return;
    }
    if (id === 'prev') { if (state.rulesPage > 0) { state.rulesPage -= 1; state.docScroll = 0; } return; }
    if (id === 'next') { if (state.rulesPage < RULES.length - 1) { state.rulesPage += 1; state.docScroll = 0; } else leaveDoc(); return; }
    if (id.startsWith('set:')) settingsAction(id.slice(4));
  }

  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.play)) startPlay('perform');
    else if (hit(T.prac)) go('setup');
    else if (hit(T.auto)) startPlay('auto');
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 90 && Math.abs(tap.x - T.credit.x) < 190) env.openArcforgeHome?.();
  }
  function updateSetup(tap) {
    if (!tap) return;
    const U = lay().setup, s = state.setup, fi = PRACTICE_FIGS.indexOf(s.fig);
    if (inRect(U.back, tap.x, tap.y)) go('title');
    else if (inRect(U.figDec, tap.x, tap.y)) s.fig = PRACTICE_FIGS[Math.max(0, fi - 1)];
    else if (inRect(U.figInc, tap.x, tap.y)) s.fig = PRACTICE_FIGS[Math.min(PRACTICE_FIGS.length - 1, fi + 1)];
    else if (inRect(U.ensDec, tap.x, tap.y)) s.ens = Math.max(1, s.ens - 1);
    else if (inRect(U.ensInc, tap.x, tap.y)) s.ens = Math.min(3, s.ens + 1);
    else if (inRect(U.speedDec, tap.x, tap.y)) s.speedIdx = Math.max(0, s.speedIdx - 1);
    else if (inRect(U.speedInc, tap.x, tap.y)) s.speedIdx = Math.min(SPEEDS.length - 1, s.speedIdx + 1);
    else if (inRect(U.start, tap.x, tap.y)) startPlay('practice');
    // a figure that needs partners raises the ensemble to match
    const need = ({ cross: 2, relay: 3, fan: 3 })[s.fig] ?? 1;
    if (s.ens < need) s.ens = need;
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay(state.result.mode);
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see ----------------------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'setup') updateSetup(tap);
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
    // Tester tools (?dev=1 and store shots): jump to a screen and fast-forward.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.setup) Object.assign(state.setup, o.setup);
        const sc = o.scene ?? 'title';
        if (sc === 'play') {
          startPlay(o.mode ?? 'perform');
          if (o.act && state.pl.mode === 'perform') { const sh = state.pl.show; sh.act = o.act; sh.ens = Math.min(3, o.act); sh.bpm = Math.min(TUNE.bpmMax, TUNE.bpm0 + TUNE.bpmStep * (o.act - 1)); }
          if (o.play && state.pl.mode !== 'auto') state.pl.bot = { phase: 'run', figRef: null, actions: [], skill: 1.5 };
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('perform'); const sh = state.pl.show;
          Object.assign(sh, { score: 21450, act: 4, maxFlow: 17, figsDone: 21, drops: 3, cleanActs: 2, throws: 44, catches: 38, t: 190 });
          sh.counts = { perfect: 61, good: 24, off: 7, miss: 3, pcatch: 12 };
          finishRun(false);
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.drag && state.pl) {
          const L = lay(), g = geom(L), sh = state.pl.show, x = slotX(L, sh, youOf(sh));
          state.pl.drag = { x0: x, y0: g.P.grip, x: x + (o.dx ?? 0) * L.S.w, y: g.P.grip - o.drag * g.P.reach, dx: (o.dx ?? 0) * L.S.w, up: o.drag * g.P.reach, moved: true, b0: sh.b };
        }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) api.update(1 / 60, idle);
        }
        if (o.think && state.pl) tryThink();
      },
    },
  };
  return api;
}
