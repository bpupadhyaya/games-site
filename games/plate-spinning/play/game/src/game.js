// Plate Spinning: state and flow. Drawing is in view.js / playview.js / docview.js; the rules engine is engine.js.
//
// Time model: everything runs on the dt handed to update() (deterministic, pausable). A show advances by dt x timeScale, where the scale
// is 1, or the Think slow-motion. In Watch and Learn the show clock is frozen while the computer thinks, reveals and acts.
import { TUNE, SPEEDS, createShow, stepShow, whip, neediest, aiNext } from './engine.js';
import { layoutFor, poleAt, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const DEMO_RUNS = 3;
const AUTO_ACTS = 4;                                           // the Watch and Learn show ends when it reaches this act
const GRADE_TEXT = { perfect: 'PERFECT', good: 'GOOD', early: 'EARLY', save: 'SAVE', jolt: 'TOO SOON' };
const GRADE_COL = { perfect: '#fff0b0', good: '#ffc857', early: '#9fc4ff', save: '#ff9a7a', jolt: '#ff6b6b' };
const PLATE_COL = { porcelain: ['#f4f1ea', '#2c5aa8'], lacquer: ['#e03a3a', '#f4cf6a'], jade: ['#8fe0b8', '#e8fff0'], gold: ['#fff0a0', '#ffd45a'] };
const TONE = { porcelain: 880, lacquer: 700, jade: 780, gold: 1046 };
const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'];
const AI_REVEAL = 2;

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, backTo: 'title',
    prefs: { sound: true, gauges: true, calm: false, thinkSec: 5, textIdx: 0 },
    best: { score: 0, act: 0, combo: 0, shows: 0 }, demoRuns: 0, setup: { poles: 4, speedIdx: 1 },
    pl: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
    owned: false, restoreMsg: '', restoreBusy: false, credits: [],
  };
  if (typeof fetch === 'function') {           // the 3D layer's licence notices (Rocketbox MIT, CMU mocap, three.js MIT) are shown on About
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      state.credits = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    }).catch(() => {});
  }
  let lastScene = state.scene, drag = null;
  const later = [];                                            // tiny delayed callbacks counted in dt (a second note a moment after the first)

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = Math.min(Math.max(state.prefs.textIdx | 0, 0), TEXT_SCALES.length - 1); state.prefs.thinkSec = Math.min(10, Math.max(1, state.prefs.thinkSec | 0)); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) Object.assign(state.best, v); });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result' && !(state.pl && state.pl.paused && scene === 'rules')) state.pl = null; };
  const tone = (o) => { if (state.prefs.sound) env.audio.tone(o); };

  // ---- a play session -------------------------------------------------------------------------------------------------------------------
  function newPlay(mode) {
    const o = { mode };
    if (mode === 'practice') { o.poles = state.setup.poles; o.act = SPEEDS[state.setup.speedIdx].act; }
    return {
      mode, show: createShow(rng, o), paused: false, over: false, parts: [], pops: [], banner: null, shake: 0, tapFx: [],
      poleSnap: new Array(TUNE.maxPoles).fill(0), hint: null, thinkT: 0, ending: 0, evLog: [], evId: 0,
      ai: mode === 'auto' ? { phase: 'run', t: 0, plan: null, lessons: 0, lastAct: 0, second: null, steps: 0, seen: {}, ring: null, ringT: 0 } : null,
    };
  }
  function startPlay(mode) {
    if (config.demo && mode !== 'auto' && state.demoRuns >= DEMO_RUNS) { go('demo-limit'); return; }
    if (config.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.pl = newPlay(mode); state.result = null;
    state.scene = 'play'; state.sceneT = 0;
    state.pl.banner = { text: mode === 'practice' ? 'PRACTICE' : mode === 'auto' ? 'WATCH AND LEARN' : 'ACT 1', t: 0 };
    env.monetization.track?.('show_start', { mode });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.paused && !pl.over && state.scene === 'play') pl.paused = true; };
  const resumePlay = () => { if (state.pl) state.pl.paused = false; };

  // ---- helpers over the geometry ---------------------------------------------------------------------------------------------------------
  const slotOf = (i) => lay().play.slots[i];
  const plateXY = (i) => { const s = slotOf(i); return s ? { x: s.cx, y: s.top } : { x: meta.width / 2, y: meta.height / 2 }; };
  const pop = (pl, i, text, col, size) => {
    const p = plateXY(i), s = slotOf(i);
    pl.pops = pl.pops.filter((q) => q.pole !== i);
    pl.pops.push({ pole: i, x: Math.max(110, Math.min(lay().w - 110, p.x)), y: p.y - (s ? s.rx : 40) * 1.1, text, col, size, age: 0 });
    if (pl.pops.length > 10) pl.pops.shift();
  };

  // ---- reactions to what happened in the show ----------------------------------------------------------------------------------------------
  function reactions(pl) {
    const show = pl.show;
    for (const e of show.ev) {
      pl.evLog.push({ ...e, id: ++pl.evId }); if (pl.evLog.length > 48) pl.evLog.shift();       // read by the 3D presenter only
      const p = e.pole !== undefined ? plateXY(e.pole) : null, s = e.pole !== undefined ? slotOf(e.pole) : null;
      if (e.k === 'whip' || e.k === 'jolt') {
        pl.tapFx.push({ x: p.x, y: p.y, age: 0, r: s.rx, g: e.grade });
        if (e.k === 'jolt') {
          tone({ freq: 160, to: 90, dur: 0.18, type: 'square', vol: 0.12 });
          pop(pl, e.pole, GRADE_TEXT.jolt, GRADE_COL.jolt, 34);
          if (!state.prefs.calm) pl.shake = Math.max(pl.shake, 0.5);
        } else {
          const f = TONE[e.type] ?? 880;
          tone({ freq: f, to: f * (e.grade === 'perfect' ? 1.5 : 1.12), dur: e.grade === 'perfect' ? 0.28 : 0.16, type: 'triangle', vol: 0.2 });
          if (e.grade === 'perfect') tone({ freq: f * 2, dur: 0.35, type: 'sine', vol: 0.1 });
          if (e.grade === 'early') pop(pl, e.pole, GRADE_TEXT.early, GRADE_COL.early, 26);
          else pop(pl, e.pole, `${GRADE_TEXT[e.grade]}${e.pts ? ' +' + e.pts : ''}`, GRADE_COL[e.grade], e.grade === 'perfect' ? 38 : 32);
          if (e.pts && !state.prefs.calm) burst(pl.parts, rng, p.x, p.y, 'spark', e.grade === 'perfect' ? 12 : 5, e.grade === 'perfect' ? 1 : 0.7, e.grade === 'perfect' ? '#fff0b0' : '#ffc857', e.grade === 'perfect' ? 10 : 7);
        }
      } else if (e.k === 'half') {
        tone({ freq: 620, dur: 0.1, type: 'triangle', vol: 0.18 });
        pop(pl, e.pole, 'AGAIN', '#b8f0d4', 30); pl.tapFx.push({ x: p.x, y: p.y, age: 0, r: s.rx, g: 'good' });
      } else if (e.k === 'fumble') {
        pop(pl, e.pole, 'FUMBLED', GRADE_COL.save, 28);
      } else if (e.k === 'drop') {
        tone({ freq: 520, to: 70, dur: 0.7, type: 'sawtooth', vol: 0.12 });
        pl.poleSnap[e.pole] = 1;
        pop(pl, e.pole, 'DROPPED', '#ff6b6b', 36);
      } else if (e.k === 'shatter') {
        const cols = PLATE_COL[e.type] ?? PLATE_COL.porcelain;
        tone({ freq: 2100, to: 600, dur: 0.12, type: 'square', vol: 0.12 });
        later.push({ t: 0.09, fn: () => tone({ freq: 1500, to: 400, dur: 0.1, type: 'square', vol: 0.09 }) });
        burst(pl.parts, rng, s.cx, s.base - 6, 'shard', 16, 1.1, cols[0], 11); burst(pl.parts, rng, s.cx, s.base - 6, 'shard', 8, 0.9, cols[1], 9); burst(pl.parts, rng, s.cx, s.base - 6, 'puff', 3, 0.4, '#d9c9b0', 14);
        if (!state.prefs.calm) pl.shake = Math.max(pl.shake, 0.8);
      } else if (e.k === 'launch') {
        tone({ freq: 420, to: 560, dur: 0.1, type: 'sine', vol: 0.08 });
      } else if (e.k === 'act') {
        pl.banner = { text: `ACT ${e.act}`, sub: e.clean ? `Clean act +${e.bonus}` : null, t: 0 };
        [523, 659, 784].forEach((f, i) => later.push({ t: i * 0.1, fn: () => tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.12 }) }));
        env.monetization.track?.('act', { act: e.act });
      } else if (e.k === 'over') {
        pl.ending = 1;
      }
    }
    show.ev.length = 0;
  }

  // ---- whipping --------------------------------------------------------------------------------------------------------------------------------
  function userWhip(i) {
    const pl = state.pl; if (!pl || pl.paused || pl.over || pl.mode === 'auto') return false;
    const r = whip(pl.show, i);
    if (!r) return false;
    pl.hint = null;
    reactions(pl);
    return true;
  }
  function tryThink() {
    const pl = state.pl; if (!pl || pl.paused || pl.over || pl.mode === 'auto') return;
    const sh = pl.show;
    if (sh.thinkCool > 0 || pl.thinkT > 0) return;
    pl.thinkT = TUNE.thinkSeconds; sh.thinkCool = pl.mode === 'practice' ? 0 : TUNE.thinkCooldown;
    const n = neediest(sh); pl.hint = n ? { pole: n.pole, t: 0 } : null;
    tone({ freq: 330, to: 440, dur: 0.25, type: 'sine', vol: 0.1 });
  }

  // ---- stage animation ------------------------------------------------------------------------------------------------------------------------
  function stepAnim(pl, dt) {
    stepParticles(pl.parts, dt);
    for (const p of pl.pops) p.age += dt;
    pl.pops = pl.pops.filter((p) => p.age < 0.9);
    for (const f of pl.tapFx) f.age += dt;
    pl.tapFx = pl.tapFx.filter((f) => f.age < 0.45);
    pl.shake = Math.max(0, pl.shake - dt * 3.5);
    for (let i = 0; i < pl.poleSnap.length; i++) pl.poleSnap[i] = Math.max(0, pl.poleSnap[i] - dt * 1.4);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 2) pl.banner = null; }
    if (pl.hint) pl.hint.t += dt;
    for (let i = later.length - 1; i >= 0; i--) { later[i].t -= dt; if (later[i].t <= 0) { later[i].fn(); later.splice(i, 1); } }
  }

  // ---- the computer player (Watch and Learn) -------------------------------------------------------------------------------------------------
  // Returns true when the show clock may run this tick.
  function aiStep(pl, dt, tap) {
    const ai = pl.ai, sh = pl.show;
    if (ai.ringT > 0) ai.ringT -= dt;
    if (ai.second) { ai.second.t -= dt; if (ai.second.t <= 0) { whip(sh, ai.second.pole); reactions(pl); ai.second = null; } }
    if (ai.phase === 'think' || ai.phase === 'reveal') {
      ai.t += dt;
      const lim = ai.phase === 'think' ? state.prefs.thinkSec : AI_REVEAL;
      const skip = tap && inRect(lay().play.skip, tap.x, tap.y);
      if (ai.t >= lim || skip) {
        if (ai.phase === 'think') { ai.phase = 'reveal'; ai.t = skip ? AI_REVEAL * 0.35 : 0; }
        else { ai.phase = 'act'; ai.t = 0; }
      }
      return false;                                     // the show clock is frozen during a lesson step
    }
    if (ai.phase === 'act') {
      const p = ai.plan, pole = sh.poles[p.pole];
      if (pole && pole.plate && pole.plate.st === 'spin') {
        const r = whip(sh, p.pole);
        if (r && r.k === 'half') ai.second = { pole: p.pole, t: 0.28 };
        reactions(pl);
        ai.ring = p.pole; ai.ringT = 0.5;
      }
      ai.phase = 'run'; ai.t = 0; ai.plan = null; ai.steps += 1;
    }
    return true;
  }
  // After the show has stepped: decide whether the computer starts a lesson step or acts at once.
  function aiDecide(pl) {
    const ai = pl.ai, sh = pl.show;
    if (ai.phase !== 'run' || ai.second) return;
    const a = aiNext(sh, TUNE.perfHi - 0.03 + rng.range(-0.02, 0.025));
    if (!a) return;
    if (a.second) { whip(sh, a.pole); reactions(pl); ai.ring = a.pole; ai.ringT = 0.4; return; }
    const interesting = ai.lastAct !== sh.act || a.crowd >= 2 || (a.type !== 'porcelain' && !ai.seen[a.type]);
    if (interesting && ai.lessons < 14) {
      ai.lastAct = sh.act; ai.seen[a.type] = true; ai.lessons += 1;
      ai.phase = 'think'; ai.t = 0; ai.plan = a;
      return;
    }
    const r = whip(sh, a.pole);
    if (r && r.k === 'half') ai.second = { pole: a.pole, t: 0.28 };
    reactions(pl); ai.ring = a.pole; ai.ringT = 0.35;
  }

  // ---- per-tick play update -----------------------------------------------------------------------------------------------------------------
  function updatePlay(dt, tap, input) {
    const pl = state.pl, P = lay().play;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    if (input.keys.pressed.has('Escape') || input.keys.pressed.has('Space')) { pausePlay(); return; }
    if (tap && inRect(P.pause, tap.x, tap.y)) { pausePlay(); return; }
    const sh = pl.show;
    if (pl.mode !== 'auto') {
      if (tap && inRect(P.think, tap.x, tap.y)) tryThink();
      else if (tap) {
        const i = poleAt(P.slots, tap.x, tap.y, (k) => sh.poles[k].on && sh.poles[k].plate && sh.poles[k].plate.st === 'spin');
        if (i >= 0) userWhip(i);
      }
      if (input.keys.pressed.has('KeyH')) tryThink();
      KEYS.forEach((k, n) => { if (input.keys.pressed.has(k)) { const i = P.num.indexOf(n + 1); if (i >= 0) userWhip(i); } });
    }
    let run = true;
    if (pl.ai) run = aiStep(pl, dt, tap);
    if (run) {
      let scale = 1;
      if (pl.thinkT > 0) { pl.thinkT -= dt; scale = TUNE.thinkScale; if (pl.thinkT <= 0) { pl.thinkT = 0; pl.hint = null; } }
      stepShow(sh, dt * scale, rng);
      reactions(pl);
      if (pl.ai) aiDecide(pl);
    }
    stepAnim(pl, dt);
    if (pl.hint) { const n = neediest(sh); if (n) pl.hint.pole = n.pole; }
    if (pl.mode === 'auto' && sh.act >= AUTO_ACTS) finishRun(true);
    else if (sh.over || pl.ending) finishRun(false);
  }

  function finishRun(demoDone) {
    const pl = state.pl, sh = pl.show, old = state.best;
    const res = { mode: pl.mode, score: sh.score, act: sh.act, maxCombo: sh.maxCombo, counts: { ...sh.counts }, breaks: sh.breaks, cleanActs: sh.cleanActs, whips: sh.whips, seconds: Math.round(sh.t), newBest: false, demoDone: !!demoDone };
    if (pl.mode === 'perform') {
      res.newBest = sh.score > old.score;
      state.best = { score: Math.max(old.score, sh.score), act: Math.max(old.act, sh.act), combo: Math.max(old.combo, sh.maxCombo), shows: old.shows + 1 };
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
    else if (id === 'gauges') p.gauges = !p.gauges;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'thinkDec') p.thinkSec = Math.max(1, p.thinkSec - 1);
    else if (id === 'thinkInc') p.thinkSec = Math.min(10, p.thinkSec + 1);
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') { restorePurchase(); return; }
    savePrefs();
  }
  // Settings > Restore purchase: asks the store again; clear busy / found / not found / failed messages.
  function restorePurchase() {
    if (state.demo || state.restoreBusy || state.owned) return;
    const m = env.monetization;
    if (!m || !m.restore) { state.restoreMsg = 'Restore is not available here.'; return; }
    state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
    Promise.resolve(m.restore()).then(() => {
      state.owned = m.owns('unlock_game') === true;
      state.restoreMsg = state.owned ? 'Purchase restored. Thank you!' : 'No earlier purchase found for this account.';
    }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
  }
  function leaveDoc() {
    if (state.backTo === 'play') { if (state.pl) { state.scene = 'play'; state.sceneT = 0; } else go('title'); return; }   // back to the paused show
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
    const U = lay().setup, s = state.setup;
    if (inRect(U.back, tap.x, tap.y)) go('title');
    else if (inRect(U.polesDec, tap.x, tap.y)) s.poles = Math.max(1, s.poles - 1);
    else if (inRect(U.polesInc, tap.x, tap.y)) s.poles = Math.min(TUNE.maxPoles, s.poles + 1);
    else if (inRect(U.speedDec, tap.x, tap.y)) s.speedIdx = Math.max(0, s.speedIdx - 1);
    else if (inRect(U.speedInc, tap.x, tap.y)) s.speedIdx = Math.min(SPEEDS.length - 1, s.speedIdx + 1);
    else if (inRect(U.start, tap.x, tap.y)) startPlay('practice');
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
      state.owned = env.monetization?.owns?.('unlock_game') === true;
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
        if (sc === 'play') startPlay(o.mode ?? 'perform');
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('perform'); const sh = state.pl.show;
          Object.assign(sh, { score: 18450, act: 5, maxCombo: 23, breaks: 3, whips: 112, t: 96, cleanActs: 2 });
          sh.counts = { perfect: 58, good: 31, early: 9, jolt: 3, save: 5, fumble: 1 };
          finishRun(false);
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) {
            const pl = state.pl;
            // dev play-through: whip each plate as it enters the Perfect band so the picture shows a good run
            if (pl && state.scene === 'play' && o.play && !pl.paused && pl.mode !== 'auto') { const a = aiNext(pl.show, 0.27); if (a) userWhip(a.pole); }
            api.update(1 / 60, idle);
          }
        }
        if (o.think && state.pl) tryThink();
      },
    },
  };
  return api;
}
