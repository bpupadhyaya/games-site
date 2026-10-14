// Chinlone: state and flow. The dance itself (ring, cues, timing, scoring) lives in sim.js; drawing in hud.js and menus.js; the
// 3D dancers are drawn by view3d/presenter.js, which only reads getState().stage3d.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (dance, daily, watch), result, journal, settings, howto/about/rules, demolimit.
import {
  newRun, stepRun, tapPad, advise, TEMPOS, WIN, harmony, stars, clamp,
} from './sim.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect, W, H, host } from './layout.js';
import { renderPlay, layoutOf, stageRig } from './hud.js';
import { rigFor } from './camera.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderJournal,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, YARD_NAMES, YARD_NEED,
} from './menus.js';
import { aboutPages, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_RUNS = 4;
const SLOW = 0.35;      // time scale while a Think hint is showing
const THINK_SECS = 2.5; // how long a Think hint lasts

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), runRng = rng.fork(), attRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0, licRev: 0,
    settings: { sound: true, names: true, textIdx: 0, thinkIdx: 1, tempo: 1 },
    record: { best: [0, 0, 0], bestStars: [0, 0, 0], bestDaily: 0, dailyDay: -1, dances: 0, touches: [0, 0, 0, 0, 0], combosFound: [], yard: 0, perfects: 0, demoRuns: 0 },
    run: null, att: null, pops: [], fx: [], banner: null, toast: '', toastT: 0, padFlash: null, earlyT: 0,
    think: null, dec: null, overT: 0, last: null, restoreMsg: '', has3d: false, attRect: null, licenses: '',
    ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, stage3d: null,
  };
  syncSize();

  // ---- persistence ----------------------------------------------------------------------------------------------
  const yardOwned = (i) => Math.max(...state.record.bestStars) >= (YARD_NEED[i] ?? 99);
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const rec = state.record, st = state.settings;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1);
    st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    st.tempo = clamp(st.tempo | 0, 0, TEMPOS.length - 1);
    const fix = (a, n) => (Array.isArray(a) && a.length >= n ? a : new Array(n).fill(0));
    rec.best = fix(rec.best, 3); rec.bestStars = fix(rec.bestStars, 3); rec.touches = fix(rec.touches, 5);
    if (!Array.isArray(rec.combosFound)) rec.combosFound = [];
    if (!yardOwned(rec.yard)) rec.yard = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!st.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------------------
  // A soft pentatonic bell for every touch (the touches make the melody), a woody tok for the cane and a low drum on the beat.
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
  const note = (deg) => 293.66 * Math.pow(2, SCALE[((deg % 8) + 8) % 8] / 12);
  const sfx = {
    beat: () => tone({ freq: 96, to: 62, dur: 0.16, type: 'sine', vol: 0.06 }),
    tok: (kind = 0) => {
      tone({ freq: 190 - kind * 14 + fxRng.next() * 14, to: 90, dur: 0.1, type: 'triangle', vol: 0.12 });
      tone({ freq: 1500 + fxRng.next() * 300, to: 900, dur: 0.04, type: 'square', vol: 0.012 });
    },
    bell: (deg, q) => {
      const f = note(deg), v = q === 'perfect' ? 0.1 : q === 'good' ? 0.075 : 0.045;
      tone({ freq: f, dur: 0.42, type: 'sine', vol: v });
      tone({ freq: f * 2.0, dur: 0.22, type: 'sine', vol: v * 0.45 });
      if (q === 'perfect') tone({ freq: f * 3.0, dur: 0.16, type: 'triangle', vol: v * 0.3 });
    },
    off: () => tone({ freq: 210, to: 150, dur: 0.14, type: 'triangle', vol: 0.05 }),
    drop: () => { tone({ freq: 160, to: 70, dur: 0.3, type: 'sine', vol: 0.09 }); },
    combo: () => [0, 2, 4, 7, 9].forEach((n, i) => tone({ freq: note(n + 8), dur: 0.26 + i * 0.03, type: 'sine', vol: 0.07 })),
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.045 }),
    win: () => [0, 2, 4, 7, 9].forEach((n, i) => tone({ freq: note(n), dur: 0.3 + i * 0.05, type: 'sine', vol: 0.08 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };
  const pop = (text, x, y, z, col = '#fff3b0', size = 30, max = 1.0) => { if (state.pops.length < 8) state.pops.push({ text, x, y, z, col, size, t: 0, max }); };
  const ringFx = (x, y, z, col) => { if (state.fx.length < 12) state.fx.push({ x, y, z, col, t: 0, max: 0.55 }); };
  const banner = (text, sub, col) => { state.banner = { text, sub, col, t: 0, max: 1.9 }; };
  const QCOL = { perfect: '#ffe36a', good: '#bff0d0', ok: '#e8e0c8', off: '#ffb8a0' };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  let evDone = -1;
  const startRun = (mode) => {
    if (state.demo && mode !== 'watch' && state.record.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const tempo = mode === 'daily' ? 1 : state.settings.tempo;
    const run = newRun({ mode, tempo, day: state.day }, runRng);
    state.run = run; state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.think = null; state.dec = null;
    state.pops.length = 0; state.fx.length = 0; state.banner = null; state.overT = 0; state.last = null; state.ui.scroll = 0; state.padFlash = null;
    if (state.demo && mode !== 'watch') { state.record.demoRuns++; save(); }
    evDone = -1;
    toast(mode === 'watch' ? 'Watch & Learn: the game stops to think before each touch' : 'Tap the matching pad as the ring closes on the dancer', 3.4);
  };

  const touchWord = (q, dt) => (q === 'perfect' ? 'Perfect' : q === 'good' ? 'Good' : q === 'ok' ? (dt < 0 ? 'Early' : 'Late') : 'Off-step');
  const pressPad = (k) => {
    const run = state.run;
    if (!run || run.over || state.paused) return;
    state.padFlash = { k, t: 0.18 };
    const r = tapPad(run, k);
    if (r.ok) {
      const c = run.fl.cue;
      if (state.think && !state.think.keep) state.think = null;
      pop(r.right ? touchWord(r.q, r.dt) : 'Off-step', c.C.x, c.C.y + 0.55, c.C.z, r.right ? QCOL[r.q] : QCOL.off, r.q === 'perfect' && r.right ? 34 : 28, 0.85);
    } else if (r.why === 'early' && state.earlyT <= 0) {
      state.earlyT = 0.9; sfx.tick();
      const c = run.fl ? run.fl.cue : null;
      if (c) pop('Wait for the ring', c.C.x, c.C.y + 0.55, c.C.z, '#ffd9b0', 24, 0.8);
    }
  };

  // events from the simulation: touches, drops and combos turn into sound, rings and words
  const handleEvents = (run) => {
    for (const e of run.events) {
      if (e.seq <= evDone) continue;
      evDone = e.seq;
      if (e.type === 'launch') sfx.beat();
      else if (e.type === 'touch') {
        sfx.tok(e.touch);
        if (e.q === 'off') sfx.off(); else sfx.bell(e.touch * 2 + run.done, e.q);
        if (e.q !== 'off') { ringFx(e.x, e.y, e.z, e.q === 'perfect' ? '#ffe36a' : '#bff0d0'); pop(`+${e.gain}`, e.x, e.y + 0.95, e.z, e.q === 'perfect' ? '#ffe36a' : '#fff6e0', 26, 0.9); }
        if (run.streak > 0 && run.streak % 10 === 0) banner(`${run.streak} in flow`, 'beautiful', '#7fe0c8');
      } else if (e.type === 'drop') { sfx.drop(); toast('The ball falls. A dancer scoops it back up.', 2.2); }
      else if (e.type === 'combo') { banner(e.name, `+${e.gain}`, '#ffd97a'); sfx.combo(); }
      else if (e.type === 'round') { banner(`Round ${e.round}`, 'a little quicker', '#9be8c8'); sfx.win(); }
      else if (e.type === 'end') sfx.win();
    }
  };

  const finishRun = () => {
    const run = state.run, rec = state.record, mode = run.mode, tp = run.tempo;
    const h = harmony(run), st = stars(h);
    const names = [...new Set(run.combos)];
    const r = { mode, tempo: tp, score: run.score, harmony: h, stars: st, perfects: run.perfects, goods: run.goods, drops: run.drops, combos: names, hints: run.hints, newBest: false, unlocks: [] };
    if (mode !== 'watch') {
      const before = YARD_NAMES.map((_, i) => yardOwned(i));
      rec.dances++; rec.perfects += run.perfects;
      run.touchCount.forEach((n, i) => { rec.touches[i] += n; });
      for (const n of names) if (!rec.combosFound.includes(n)) rec.combosFound.push(n);
      if (!run.hints) {
        if (mode === 'dance') { if (run.score > rec.best[tp]) { rec.best[tp] = run.score; r.newBest = true; } if (st > rec.bestStars[tp]) rec.bestStars[tp] = st; }
        if (mode === 'daily') { if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; } if (run.score > rec.bestDaily) { rec.bestDaily = run.score; r.newBest = true; } if (st > rec.bestStars[1]) rec.bestStars[1] = st; }
      }
      YARD_NAMES.forEach((n, i) => { if (!before[i] && yardOwned(i)) r.unlocks.push(`${n} courtyard`); });
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.rev++;
    if (r.newBest || r.unlocks.length) sfx.win();
  };

  // ---- the Watch & Learn decision loop: THINK -> REVEAL -> ACT --------------------------------------------------------
  const watchThink = () => THINK_STEPS[state.settings.thinkIdx];
  const updateWatch = (dt) => {
    const run = state.run;
    if (state.paused || run.over) return true;      // frozen
    let dec = state.dec;
    if (!dec && run.phase === 'flight' && run.fl && !run.tap) {
      const adv = advise(run);
      dec = state.dec = { active: true, phase: 'think', t: 0, dur: watchThink(), adv, jitter: (fxRng.next() - 0.5) * 0.05 };
      state.think = { adv, keep: true };
    }
    if (dec && dec.phase === 'think') { dec.t += dt; if (dec.t >= dec.dur) { dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; } return true; }
    if (dec && dec.phase === 'reveal') { dec.t += dt; if (dec.t >= dec.dur) { dec.phase = 'go'; dec.t = 0; } return true; }
    if (dec && dec.phase === 'go') {
      if (run.phase === 'flight' && !run.tap && run.t >= dec.adv.tH + dec.jitter) { tapPad(run, dec.adv.touch); state.padFlash = { k: dec.adv.touch, t: 0.18 }; state.dec = null; state.think = null; }
      else if (run.phase !== 'flight') { state.dec = null; state.think = null; }
    }
    return false;
  };

  // ---- the title-screen demo: the dancers keep the ball up on their own -----------------------------------------------------
  const newAttract = () => { state.att = newRun({ mode: 'watch', tempo: 0, day: 0 }, attRng); state.att.total = 9; };
  const updateAttract = (dt) => {
    if (!state.att || (state.att.over && (state.att.endT || 0) > 1.6)) newAttract();
    const run = state.att;
    if (run.phase === 'flight' && run.fl && !run.tap && run.t >= run.fl.t1 - WIN.lead - 0.005) tapPad(run, run.fl.cue.touch);
    stepRun(run, dt);
    run.events.length = 0;
  };

  // ---- hint -------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const run = state.run;
    if (!run || run.over || state.paused || run.mode === 'watch') return;
    const adv = advise(run);
    if (!adv) return;
    run.hints++;
    state.think = { t: 0, adv };
    sfx.tick();
  };

  // ---- pause ------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRun = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; state.dec = null; state.rev++; };

  // ---- the play scene --------------------------------------------------------------------------------------------------------
  const scrollFlow = (ptr) => {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  };
  const updatePlay = (dt, input) => {
    const run = state.run, ptr = input.pointer, keys = input.keys, watch = run.mode === 'watch';
    const L = layoutOf(state);
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else { state.paused = !state.paused; } }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    if (ptr.pressed && !run.over) {
      if (watch) {
        const D = L.demo;
        if (inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
        else if (inRect(D.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveRun(); return; }
      } else if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
      else if (inRect(L.think, ptr.x, ptr.y)) requestThink();
      else L.pads.forEach((r, k) => { if (inRect(r, ptr.x, ptr.y)) pressPad(k); });
    }
    if (!watch && !run.over) {
      ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].forEach((c, k) => { if (keys.pressed.has(c) || keys.pressed.has(`Numpad${k + 1}`)) pressPad(k); });
      if (keys.pressed.has('KeyH')) requestThink();
    }
    if (state.paused) return;
    // time passes
    let frozen = false;
    if (watch) frozen = updateWatch(dt);
    if (state.think && !watch) { state.think.t += dt; if (state.think.t > THINK_SECS) state.think = null; }
    const ts = state.think && !watch ? SLOW : 1;
    if (!frozen && (!run.over || run.phase === 'end')) stepRun(run, dt * ts);
    handleEvents(run);
    if (run.over) {
      state.overT += dt;
      if (state.overT > 2.6 || (ptr.pressed && state.overT > 1.0)) finishRun();
    }
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    for (const f of state.fx) f.t += dt;
    state.fx = state.fx.filter((f) => f.t < f.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.earlyT > 0) state.earlyT -= dt;
    if (state.padFlash) { state.padFlash.t -= dt; if (state.padFlash.t <= 0) state.padFlash = null; }
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
    else if (id === 'p-names') { state.settings.names = !state.settings.names; save(); state.rev++; }
    else if (id === 'quit') leaveRun();
  }

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'dance') startRun('dance');
    else if (id === 'daily') startRun('daily');
    else if (id === 'watch') startRun('watch');
    else if (id.startsWith('tempo-')) { state.settings.tempo = +id.slice(6); save(); state.rev++; }
    else if (id === 'journal') { state.scene = 'journal'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
  };
  const handleJournal = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id.startsWith('yard-')) { const i = +id.slice(5); if (yardOwned(i)) { state.record.yard = i; save(); state.rev++; sfx.win(); } }
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
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; state.rev++; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; state.rev++; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.rev++; save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.last;
    if (id === 'again') startRun(r ? r.mode : 'dance');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) { Promise.resolve(env.share?.(`I danced Chinlone with a harmony of ${Math.round(r.harmony * 100)}% and ${r.score.toLocaleString('en-US')} points in Chinlone from Arcforge!`)).catch(() => {}); }
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
  for (let i = 0; i < 60 * 3; i++) updateAttract(1 / 60);

  // Store screenshots (main.js calls this only for ?shot=1&scene=...): put the game in a named moment and run it forward.
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  const botTap = () => {
    const run = state.run;
    if (run && run.phase === 'flight' && run.fl && !run.tap && run.t >= run.fl.t1 - WIN.lead - 0.004) tapPad(run, run.fl.cue.touch);
  };
  const dance = (until) => { for (let i = 0; i < 60 * 240 && !until() && !state.run.over; i++) { botTap(); advance(1); } };
  const shotScene = (name) => {
    const rec = state.record;
    rec.best = [8200, 12400, 9100]; rec.bestStars = [4, 5, 4]; rec.dances = 14; rec.touches = [120, 96, 64, 52, 48]; rec.combosFound = ['Rising Crane', 'Willow Sway', 'Peacock Fan']; rec.bestDaily = 10300; rec.dailyDay = state.day;
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { advance(150); return; }
    if (name === 'dance' || name === 'combo' || name === 'round') {
      startRun('dance'); state.toastT = 0;
      dance(() => state.run.done >= (name === 'round' ? 12 : 7));
      if (name === 'combo') banner('Rising Crane', '+420', '#ffd97a');
      // stop with the ring about to close on a dancer
      for (let i = 0; i < 60 * 4 && !(state.run.phase === 'flight' && state.run.t > state.run.fl.t1 - 0.34); i++) { botTap(); advance(1); }
      state.toastT = 0; if (state.banner) state.banner.t = 0.3;
      return;
    }
    if (name === 'watch') {
      state.settings.thinkIdx = 1;
      startRun('watch'); state.toastT = 0;
      for (let i = 0; i < 60 * 70 && !(state.dec && state.dec.phase === 'think' && state.dec.t > 1.2); i++) advance(1);
      return;
    }
    if (name === 'journal') { state.scene = 'journal'; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      startRun('dance'); state.toastT = 0;
      dance(() => false);
      for (let i = 0; i < 60 * 12 && state.scene === 'play'; i++) advance(1);
      advance(3); return;
    }
    if (name === 'pause') {
      startRun('dance'); state.toastT = 0;
      dance(() => state.run.done >= 5);
      openPause(); advance(2);
    }
  };

  const api = {
    // Watch & Learn, the journal and every menu are free; only real play counts against the free preview (a paused run does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.run && state.run.mode !== 'watch' && !state.run.over && state.run.phase !== 'ready') || state.paused,
    update(dt, input) {
      if (api.devFreeze) return;
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'settings', 'result', 'demolimit', 'journal'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      syncSize();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'journal': updateFlowScene(dt, input, handleJournal, 'journal'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'journal': renderJournal(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, aboutPages(state.licenses), 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.run) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
      // what the 3D presenter reads: the run to show, the camera for it and the courtyard
      const showRun = state.run && (state.scene === 'play' || (state.back === 'play' && ['howto', 'rules', 'about'].includes(state.scene)));
      // The kit's free-preview pill must not sit on the score card: park it in the empty corner of the stage.
      if (state.scene === 'play') {
        const L = layoutOf(state);
        globalThis.__previewBadge = L.land ? { x: L.px0 - 14, y: Math.max(host.t + 10, 12), align: 'right' } : { x: W - L.M, y: L.cues.y + L.cues.h + 6, align: 'right' };
      } else globalThis.__previewBadge = undefined;
      if (showRun) state.stage3d = { run: state.run, rig: stageRig(state, layoutOf(state)), yard: state.record.yard };
      else state.stage3d = { run: state.att, rig: rigFor(W, H, state.attRect || { x: 0, y: 0, w: W, h: H }), yard: state.record.yard };
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
    shotScene,
    devStep(n, bot = true) { const f = api.devFreeze; api.devFreeze = false; for (let i = 0; i < n; i++) { if (bot) botTap(); advance(1); } api.devFreeze = f; },   // dev tools only (icon + measurement scripts)
    set3d(v) { state.has3d = !!v; state.rev++; },
    setLicenses(text) { state.licenses = String(text || ''); state.licRev++; },
  };
  return api;
}
