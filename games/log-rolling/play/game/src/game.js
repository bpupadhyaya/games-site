// Log Rolling: state and flow. Physics live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (match, bout, practice, watch), result, settings, howto/about/rules, demolimit.
import {
  VENUES, RIVALS, TUNE, BOUTS, DEMO_MATCHES, makeWorld, stepWorld, kick, advise, newAuto, autoStep, canKick, venueOwned, clamp,
} from './sim.js';
import { HIT_T, glState } from './art.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect } from './layout.js';
import { renderPlay, layoutOf } from './view.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone,
} from './menus.js';
import { ABOUT, HOWTO, RULES, creditsSection } from './content.js';
import { setPress } from './ui.js';

export { meta };
let aboutMemo = { src: null, list: ABOUT };
// About, plus the 3D layer's credits when the layer is present (characters, motion data and three.js licences).
const aboutList = () => {
  if (aboutMemo.src !== glState.lic) { const c = creditsSection(glState.lic); aboutMemo = { src: glState.lic, list: c ? [...ABOUT, c] : ABOUT }; }
  return aboutMemo.list;
};
const END_DELAY = 0.5;           // seconds after the last banner before the result
const TAP_MAX = 0.3;             // a press shorter than this that did not move is a tap (a kick)
const MOVE_PX = 16;              // a press that moves further than this is a lean
const ACT = 2.0;                 // seconds of play per Watch & Learn beat

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const runRng = rng.fork(), attRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, textIdx: 0, thinkIdx: 1 },
    record: { wins: 0, matches: 0, losses: 0, bouts: 0, tips: 0, kicks: 0, falls: 0, best: 0, streak: 0, bestStreak: 0, venueSel: 0, demoRuns: 0 },
    run: null, ws: null, att: null, simRng: null, hint: null, dec: null, pops: [], banner: null, toast: '', toastT: 0,
    fx: { flash: [], shake: 0 }, steer: 0, grab: null, padFlash: null, kbSteer: 0,
    last: null, restoreMsg: '', restoreBusy: false, owned: !!monetization.owns('unlock_game'), ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, hold: 0, endT: 0, attN: 0, splashIn: -1, assist: false,
  };
  syncSize();

  // ---- persistence ----------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const rec = state.record;
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    rec.venueSel = clamp(rec.venueSel | 0, 0, VENUES.length - 1);
    if (!venueOwned(rec, rec.venueSel)) rec.venueSel = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 900, dur: 0.035, type: 'triangle', vol: 0.045 }),
    kick: () => { tone({ freq: 180, to: 70, dur: 0.16, type: 'sine', vol: 0.18 }); tone({ freq: 620, to: 260, dur: 0.1, type: 'triangle', vol: 0.06 }); },
    nope: () => tone({ freq: 200, to: 150, dur: 0.1, type: 'square', vol: 0.04 }),
    bump: () => tone({ freq: 120, to: 90, dur: 0.12, type: 'sine', vol: 0.08 }),
    splash: () => { tone({ freq: 900, to: 200, dur: 0.35, type: 'sawtooth', vol: 0.05 }); tone({ freq: 140, to: 50, dur: 0.4, type: 'sine', vol: 0.16 }); },
    go: () => tone({ freq: 660, to: 880, dur: 0.18, type: 'triangle', vol: 0.09 }),
    set: () => tone({ freq: 440, dur: 0.12, type: 'triangle', vol: 0.06 }),
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })),
    lose: () => [0, -3, -7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.26 + i * 0.05, type: 'triangle', vol: 0.06 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- effects (drawing only) -------------------------------------------------------------------------------------
  const stepFx = (dt) => {
    const f = state.fx;
    for (const q of f.flash) q.t += dt;
    f.flash = f.flash.filter((q) => q.t < q.max);
    f.shake = Math.max(0, f.shake - dt * 2.6);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.padFlash) { state.padFlash.t += dt; if (state.padFlash.t > 0.35) state.padFlash = null; }
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
  };
  const pop = (text, x, y, col = '#fff', size = 1) => { if (state.pops.length < 6) state.pops.push({ text, x, y: y - state.pops.length * 34, col, size, t: 0, max: 1.1 }); };

  // ---- the title-screen demo: a bout that plays itself ------------------------------------------------------------------------------
  let attAuto = newAuto();
  const newAttract = () => { const v = state.attN++ % VENUES.length; state.att = makeWorld({ mode: 'bout', venue: v }); attAuto = newAuto(); };
  const updateAttract = (dt) => {
    if (!state.att) newAttract();
    const a = state.att;
    autoStep(a, attAuto, attRng, dt); stepWorld(a, dt, attRng); a.ev.length = 0;
    if (a.over) newAttract();
  };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  const ownedNow = () => VENUES.map((_, i) => venueOwned(state.record, i));
  const startRun = (mode) => {
    const rec = state.record;
    if (state.demo && (mode === 'match' || mode === 'bout') && rec.demoRuns >= DEMO_MATCHES) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const venue = rec.venueSel;
    state.simRng = runRng;
    state.ws = makeWorld({ mode, venue });
    state.run = { mode, venue, hints: 0, before: ownedNow() };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.last = null;
    state.hint = null; state.dec = null; state.pops.length = 0; state.banner = null; state.endT = 0; state.hold = 0.4;
    state.fx = { flash: [], shake: 0 }; state.steer = 0; state.grab = null; state.padFlash = null; state.kbSteer = 0; state.splashIn = -1; state.assist = false;
    if (state.demo && (mode === 'match' || mode === 'bout')) { rec.demoRuns++; save(); }
    if (mode === 'watch') state.dec = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], why: '', ap: newAuto(), act: 0 };
    state.banner = { text: 'Get set', sub: mode === 'match' ? `Bout 1 of ${BOUTS}` : '', col: '#ffffff', t: 0, max: TUNE.ready };
    toast(mode === 'watch' ? 'Watch & Learn: the game thinks, shows its plan, then plays' : 'Drag to lean against a slip. Tap a side of the pad to kick.', 3.8);
  };
  const finishRun = () => {
    const w = state.ws, run = state.run, rec = state.record, mode = run.mode;
    const res = w.result || { won: false, draw: false, score: [w.score[0], w.score[1]], bouts: [] };
    const r = {
      mode, score: res.score, won: !!res.won, draw: !!res.draw, bouts: res.bouts, rivalName: RIVALS[w.rival].name, venueName: VENUES[w.venue].name,
      kicks: w.stats.kicks[0], tips: w.stats.tips[0], falls: w.stats.falls[0], best: w.stats.best, hints: run.hints, unlocks: [], venue: run.venue,
    };
    if (mode !== 'watch') {
      rec.kicks += w.stats.kicks[0]; rec.tips += w.stats.tips[0]; rec.falls += w.stats.falls[0]; rec.bouts += w.hist.length;
      if (mode === 'practice') rec.best = Math.max(rec.best, w.stats.best);
      else if (mode === 'match') {
        rec.matches++;
        if (r.won) { if (!run.hints) rec.wins++; rec.streak++; rec.bestStreak = Math.max(rec.bestStreak, rec.streak); } else { rec.losses++; rec.streak = 0; }
      }
      const now = ownedNow();
      VENUES.forEach((v, i) => { if (!run.before[i] && now[i]) r.unlocks.push(v.name); });
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.hint = null; state.dec = null; state.rev++;
    if (mode !== 'practice' && r.won) sfx.win(); else if (mode !== 'practice' && mode !== 'watch') sfx.lose();
  };

  // react to what the sim reported this tick
  const handleEvents = () => {
    const w = state.ws, f = state.fx;
    for (const e of w.ev) {
      if (e.type === 'kick') {
        sfx.kick();
        const target = 1 - e.i, x = target === 0 ? 310 : 690;
        f.flash.push({ x, t: 0, max: 0.5 }); f.shake = Math.min(1, f.shake + 0.35);
        pop(e.i === 0 ? 'Tip!' : 'Look out', x, 190, e.i === 0 ? '#ffd24a' : '#5fe0d0', 1.1);
        if (e.i === 0) state.padFlash = { tip: e.tip, t: 0 };
      } else if (e.type === 'noop') {
        if (e.i === 0) { sfx.nope(); toast('The log is already at its top speed that way: tip the other way.', 1.8); }
      } else if (e.type === 'bump') { sfx.bump(); f.shake = Math.min(1, f.shake + 0.15); }
      else if (e.type === 'go') { sfx.go(); state.banner = { text: 'Go!', sub: '', col: '#ffd24a', t: 0, max: 0.7 }; }
      else if (e.type === 'bout') { sfx.set(); state.banner = { text: 'Get set', sub: `Bout ${w.bout} of ${w.bouts}  ·  ${w.score[0]} : ${w.score[1]}`, col: '#ffffff', t: 0, max: TUNE.ready }; state.hint = null; }
      else if (e.type === 'fall') {
        state.splashIn = HIT_T;
        const you = e.i === 0;
        state.banner = { text: you ? 'You fall!' : `${RIVALS[w.rival].name} falls!`, sub: e.how === 'time' ? 'Decided on balance' : e.tipped ? 'A kick did it' : '', col: you ? '#ff9a8a' : '#9be8b0', t: 0, max: TUNE.fallT };
        state.hint = null;
      }
    }
    w.ev.length = 0;
  };

  // ---- the Watch & Learn loop: THINK -> REVEAL -> ACT (the world is frozen while it thinks and reveals) -----------------------------------
  const updateWatch = (dt) => {
    const dec = state.dec, w = state.ws;
    if (!dec) return;
    if (w.phase !== 'go') {
      autoStep(w, dec.ap, state.simRng, dt); stepWorld(w, dt, state.simRng);
      dec.phase = 'think'; dec.t = 0; dec.dur = THINK_STEPS[state.settings.thinkIdx]; dec.act = 0; state.hint = null;
      return;
    }
    if (dec.phase === 'think') {
      dec.t += dt;
      if (dec.t >= dec.dur) { dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; const a = advise(w); state.hint = a; dec.why = a.why; }
      return;
    }
    if (dec.phase === 'reveal') {
      dec.t += dt;
      const a = advise(w); state.hint = a; dec.why = a.why;
      if (dec.t >= dec.dur) { dec.phase = 'act'; dec.t = 0; dec.act = 0; state.hint = null; }
      return;
    }
    autoStep(w, dec.ap, state.simRng, dt); stepWorld(w, dt, state.simRng);
    dec.act += dt;
    if (dec.act >= ACT) { dec.phase = 'think'; dec.t = 0; dec.dur = THINK_STEPS[state.settings.thinkIdx]; dec.act = 0; w.c[0] = 0; }
  };

  // ---- hint -------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const run = state.run, w = state.ws;
    if (!run || state.paused || run.mode === 'watch' || w.over) return;
    if (state.hint) { state.hint = null; sfx.tick(); return; }
    state.hint = advise(w);
    if (run.mode !== 'practice') run.hints++;
    sfx.tick();
  };

  // ---- pause ------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.grab = null; state.steer = 0; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRun = () => { save(); state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hint = null; state.dec = null; state.rev++; };

  // ---- the play scene --------------------------------------------------------------------------------------------------------
  const scrollFlow = (ptr) => {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
    else if (id === 'quit') leaveRun();
  }
  const tryKick = (tip) => {
    const w = state.ws;
    if (w.phase !== 'go') return;
    if (kick(w, 0, tip)) return;
    if (w.mom[0] < TUNE.cost) { sfx.nope(); toast('Not enough momentum yet: stand steady to fill the bar.', 1.6); }
  };
  const updatePlay = (dt, input) => {
    const run = state.run, w = state.ws, ptr = input.pointer, keys = input.keys, watch = run.mode === 'watch';
    const L = layoutOf(state);
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    // ---- input
    if (watch) {
      if (ptr.pressed) {
        const D = L.demo, st = state.settings;
        const setThink = (v) => { st.thinkIdx = clamp(v, 0, THINK_STEPS.length - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[st.thinkIdx]} s`, 1.6); if (state.dec && state.dec.phase === 'think') state.dec.dur = THINK_STEPS[st.thinkIdx]; };
        if (inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) setThink(st.thinkIdx - 1);
        else if (inRect(D.inc, ptr.x, ptr.y)) setThink(st.thinkIdx + 1);
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveRun(); return; }
      }
      state.steer = w.c[0];
    } else if (!w.over && !state.paused) {
      if (ptr.pressed) {
        if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(L.think, ptr.x, ptr.y)) requestThink();
        else if (inRect(L.pad, ptr.x, ptr.y)) state.grab = { x0: ptr.x, y0: ptr.y, t: 0, lean: false };
      }
      const g = state.grab;
      if (g) {
        g.t += dt;
        if (ptr.down) {
          const dx = ptr.x - g.x0;
          if (!g.lean && (Math.abs(dx) > MOVE_PX || g.t > TAP_MAX)) g.lean = true;
          state.steer = g.lean ? clamp(dx / (L.pad.w * 0.3), -1, 1) : 0;
        }
        if (!ptr.down || ptr.released) {
          if (!g.lean && g.t <= TAP_MAX && state.hold <= 0) { const mid = L.pad.x + L.pad.w / 2; tryKick(g.x0 < mid ? -1 : 1); }
          state.grab = null; state.steer = 0;
        }
      } else {
        // keyboard: arrows lean, Z / X tip the rival left / right
        const kx = (keys.down.has('ArrowRight') || keys.down.has('KeyD') ? 1 : 0) - (keys.down.has('ArrowLeft') || keys.down.has('KeyA') ? 1 : 0);
        state.kbSteer += (kx - state.kbSteer) * Math.min(1, dt * 14);
        state.steer = Math.abs(state.kbSteer) < 0.02 ? 0 : state.kbSteer;
        if (state.hold <= 0) {
          if (keys.pressed.has('KeyZ') || keys.pressed.has('Comma')) tryKick(-1);
          if (keys.pressed.has('KeyX') || keys.pressed.has('Period')) tryKick(1);
        }
      }
      if (keys.pressed.has('KeyH')) requestThink();
      if (state.hint) state.hint = w.phase === 'go' ? advise(w) : null;
    }
    if (state.paused) return;
    // ---- time passes
    if (state.hold > 0) state.hold = Math.max(0, state.hold - dt);
    if (watch) updateWatch(dt);
    else { if (!state.assist) w.c[0] = state.hold > 0 ? 0 : state.steer; stepWorld(w, dt, state.simRng); }
    if (state.splashIn >= 0) { state.splashIn -= dt; if (state.splashIn < 0) { sfx.splash(); state.fx.shake = Math.min(1, state.fx.shake + 0.5); } }
    handleEvents();
    stepFx(dt);
    if (w.over) {
      state.endT += dt;
      if (state.endT >= END_DELAY + (state.banner ? 0.4 : 0.1)) finishRun();
    }
  };

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    const rec = state.record;
    if (id === 'match' || id === 'bout' || id === 'practice' || id === 'watch') startRun(id);
    else if (id === 'venue') { let n = rec.venueSel; for (let i = 0; i < VENUES.length; i++) { n = (n + 1) % VENUES.length; if (venueOwned(rec, n)) break; } rec.venueSel = n; save(); state.rev++; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (state.restoreBusy || state.owned) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; })
        .catch(() => { state.restoreMsg = 'The store is not available right now. Try again later.'; })
        .finally(() => { state.restoreBusy = false; state.owned = !!monetization.owns('unlock_game'); state.rev++; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.rev++; save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.last;
    if (id === 'again') startRun(r ? r.mode : 'match');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) { Promise.resolve(env.share?.(`I ${r.won ? 'won' : 'played'} a Log Rolling match ${r.score[0]} to ${r.score[1]} against ${r.rivalName} in Arcforge!`)).catch(() => {}); }
  };
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    ensureLayout(state, key);
    { const m0 = flowMeta(); state.ui.scroll = clamp(state.ui.scroll, 0, m0.lay ? Math.max(0, m0.lay.contentH - (m0.bottom - m0.top)) : 0); }
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta(), scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.rev++; save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.rev++; save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  let refDrag = null, wheelHooked = false;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, RL = refLayout(), set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y) || inRect(RL.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(RL.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.refScroll = 0; state.rev++; save(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.refScroll = 0; state.rev++; save(); }
      else if (inRect(RL.panel, ptr.x, ptr.y)) refDrag = { y0: ptr.y, s0: state.refScroll };
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

  resetMenus();
  newAttract();
  for (let i = 0; i < 60 * 4; i++) updateAttract(1 / 60);

  // Store screenshots (main.js calls this only for ?shot=1&scene=...): put the game in a named moment and run it forward.
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  let shotAuto = newAuto();
  const autoPlay = (n) => { state.assist = true; for (let i = 0; i < n; i++) { autoStep(state.ws, shotAuto, state.simRng, 1 / 60); api.update(1 / 60, IDLE); } state.assist = false; };
  const shotScene = (name) => {
    const rec = state.record;
    rec.wins = 6; rec.matches = 9; rec.losses = 3; rec.kicks = 61; rec.tips = 14; rec.bouts = 18; rec.venueSel = 0;
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { advance(500); return; }
    const play = (venue, mode, until) => {
      rec.venueSel = venue; startRun(mode); state.toastT = 0; state.hold = 0; state.banner = null; shotAuto = newAuto();
      for (let i = 0; i < 60 * 150 && !until(state.ws); i++) autoPlay(1);
    };
    if (name === 'play') { play(0, 'match', (w) => w.t > 5); return; }
    if (name === 'river') { play(1, 'match', (w) => w.t > 5); return; }
    if (name === 'lake') { play(2, 'match', (w) => w.t > 5); return; }
    if (name === 'rapids') { play(3, 'match', (w) => w.t > 5); return; }
    if (name === 'kick') {
      play(1, 'match', (w) => w.t > 5 && w.mom[0] >= TUNE.cost && w.cd[0] <= 0 && Math.abs(w.l[1]) > 0.1);
      const w = state.ws; kick(w, 0, Math.sign(w.l[1]) || 1); handleEvents();
      for (let i = 0; i < 20; i++) autoPlay(1);
      return;
    }
    if (name === 'fall') { const fa = Number(globalThis.__shotFallAt ?? HIT_T + 0.35); play(0, 'match', (w) => w.phase === 'fall' && w.fallT > fa); return; }
    if (name === 'think') { play(2, 'match', (w) => w.t > 4); requestThink(); advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      state.last = { mode: 'match', score: [2, 1], won: true, draw: false, bouts: [{ winner: 0, secs: 14, tipped: true, how: 'fall' }, { winner: 1, secs: 22, tipped: false, how: 'fall' }, { winner: 0, secs: 9, tipped: true, how: 'fall' }], rivalName: 'Jonas', venueName: 'Cedar River', kicks: 9, tips: 2, falls: 1, best: 22, hints: 0, unlocks: ['Cedar River'], venue: 1 };
      state.scene = 'result'; state.rev++; advance(3); return;
    }
    if (name === 'watch') {
      rec.venueSel = 1; state.settings.thinkIdx = 0;
      startRun('watch'); state.toastT = 0; state.hold = 0; state.banner = null;
      for (let i = 0; i < 60 * 60 && !(state.dec && state.dec.phase === 'reveal' && state.dec.t > 0.8 && state.ws.t > 4); i++) advance(1);
      return;
    }
    if (name === 'pause') { startRun('match'); state.toastT = 0; state.hold = 0; openPause(); advance(2); }
  };

  const api = {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused run does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.run && state.run.mode !== 'watch') || state.paused || state.hold > 0,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'settings', 'result', 'demolimit'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      syncSize();
      { const o = !!monetization.owns('unlock_game'); if (o !== state.owned) { state.owned = o; state.rev++; } }
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx, view) {
      syncSize();
      meta.previewBadge = null;
      // the 3D layer (web/view3d) draws the pond behind this transparent canvas: clear it first, then only HUD and menus are painted
      glState.gl = view && view.gl && view.gl.on ? view.gl : null;
      if (view && view.gl && view.gl.licenses) glState.lic = view.gl.licenses;
      if (view && view.gl) ctx.clearRect(0, 0, meta.width, meta.height);
      glState.band = null; glState.world = null;
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, aboutList(), 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.run) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
      state.glBand = glState.band; state.glWorld = glState.world;
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
    shotScene,
  };
  return api;
}
