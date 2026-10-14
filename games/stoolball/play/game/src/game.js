// Stoolball: state and flow. The simulation lives in sim.js and play.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the session step.
//
// Scenes: title, play (match, knock, daily, watch), result, records, settings, howto/about/rules, demolimit.
import * as M from './sim.js';
import { newSession, beginSession, stepSession, cmd, think, startSecond, PAR } from './play.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect, clamp, unproj } from './layout.js';
const W_ = () => meta.width, H_ = () => meta.height;
import { renderPlay, layoutOf, camsFor, padToAim } from './view.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderRecords,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, attractRect,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_RUNS = 3;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork();
  const mkR = (day) => {
    if (day != null) { const b = day * 977 + 13; return { path: M.seeded(b), strike: rng.fork(), field: rng.fork(), ai: M.seeded(b + 7) }; }
    return { path: rng.fork(), strike: rng.fork(), field: rng.fork(), ai: rng.fork() };
  };
  let R = mkR(null), attR = mkR(null);
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, level: 0 },
    record: { wins: [0, 0, 0], played: [0, 0, 0], bestMargin: [0, 0, 0], bestKnock: [0, 0, 0], bestDaily: 0, bestDailyEver: 0, dailyDay: -1, highest: 0, fours: 0, sixes: 0, wicketsTaken: 0, demoRuns: 0 },
    run: null, att: null, last: null, ui: { scroll: 0, drag: null }, refScroll: 0, toast: '', toastT: 0, loaded: false, fast: false, par: 0, restoreMsg: '',
    pad: null, hold: 0, attN: 0,
  };
  syncSize();

  // ---- persistence ------------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const st = state.settings, rec = state.record;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1);
    st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    st.level = clamp(st.level | 0, 0, M.LEVELS.length - 1);
    for (const k of ['wins', 'played', 'bestMargin', 'bestKnock']) if (!Array.isArray(rec[k]) || rec[k].length < 3) rec[k] = [0, 0, 0];
    state.loaded = true; state.rev++;
    audio.setMuted?.(!st.sound);
  });

  // ---- sound --------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const PENTA = [0, 2, 4, 7, 9];
  const sfx = (name, data) => {
    switch (name) {
      case 'release': tone({ freq: 220, to: 420, dur: 0.16, type: 'sine', vol: 0.03 }); break;
      case 'swing': tone({ freq: 500, to: 160, dur: 0.12, type: 'sawtooth', vol: 0.028 }); break;
      case 'thwock': tone({ freq: 190, to: 70, dur: 0.12, type: 'triangle', vol: 0.16 }); tone({ freq: 1500, to: 600, dur: 0.04, type: 'square', vol: 0.04 }); break;
      case 'tap': tone({ freq: 240, to: 150, dur: 0.07, type: 'triangle', vol: 0.1 }); break;
      case 'board': for (let i = 0; i < 4; i++) tone({ freq: 700 + fxRng.next() * 900, to: 300, dur: 0.07 + i * 0.02, type: 'square', vol: 0.05 }); tone({ freq: 120, to: 60, dur: 0.25, type: 'triangle', vol: 0.12 }); break;
      case 'catch': tone({ freq: 330, to: 220, dur: 0.09, type: 'triangle', vol: 0.1 }); break;
      case 'throw': tone({ freq: 300, to: 800, dur: 0.14, type: 'sawtooth', vol: 0.02 }); break;
      case 'bounce': tone({ freq: 160, to: 110, dur: 0.05, type: 'sine', vol: 0.05 }); break;
      case 'run': tone({ freq: 620, dur: 0.04, type: 'triangle', vol: 0.05 }); break;
      case 'run-done': tone({ freq: 784, dur: 0.12, type: 'triangle', vol: 0.07 }); break;
      case 'rope': tone({ freq: 523, to: 1046, dur: 0.18, type: 'sine', vol: 0.06 }); break;
      case 'clap': for (let i = 0; i < 3; i++) tone({ freq: 2200 + fxRng.next() * 800, to: 900, dur: 0.03, type: 'square', vol: 0.025 }); break;
      case 'cheer': [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.18 + i * 0.04, type: 'triangle', vol: 0.07 })); break;
      case 'out': tone({ freq: 400, to: 120, dur: 0.4, type: 'sawtooth', vol: 0.07 }); break;
      case 'tick': tone({ freq: 900, dur: 0.035, type: 'triangle', vol: 0.045 }); break;
      case 'bell': tone({ freq: 1568, dur: 0.9, type: 'sine', vol: 0.05 }); tone({ freq: 2093, dur: 0.7, type: 'sine', vol: 0.03 }); tone({ freq: 3136, dur: 0.35, type: 'triangle', vol: 0.015 }); break;
      case 'win': [0, 4, 7, 12, 16].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })); break;
      default: break;
    }
    void data; void PENTA;
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- the title-screen show -------------------------------------------------------------------------------------------------
  const newAttract = () => {
    attR = mkR(null);
    state.att = newSession({ mode: 'attract', level: (state.attN++ % 3), auto: true, think: 0 });
    beginSession(state.att, attR);
  };
  const updateAttract = (dt) => {
    if (!state.att) newAttract();
    const S = state.att;
    { const r = state.scene === 'title' ? attractRect(state) : { w: W_(), h: H_() }; S.camAsp = { w: r.w, h: r.h, land: r.w > r.h }; }
    stepSession(S, dt, attR, () => {});
    if (S.phase === 'done') newAttract();
  };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  const startRun = (mode) => {
    const rec = state.record, st = state.settings;
    if (state.demo && mode !== 'watch' && rec.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const level = mode === 'daily' ? 1 : st.level;
    R = mkR(mode === 'daily' ? state.day : null);
    const S = newSession({ mode, level, auto: mode === 'watch', think: THINK_STEPS[st.thinkIdx] });
    state.run = S; state.par = PAR[level];
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.last = null; state.fast = false; state.hold = 0.35;
    if (state.demo && mode !== 'watch') { rec.demoRuns++; save(); }
    beginSession(S, R);
    toast(mode === 'watch' ? 'Watch & Learn: the game thinks before every ball' : 'Slide the paddle to the ball, then tap Block, Drive or Lift', 3.4);
  };
  const finishRun = () => {
    const S = state.run, rec = state.record, res = S.result, mode = S.mode;
    const r = { ...res, mode, level: S.level, hints: S.hintsUsed, newBest: false };
    const counts = S.balls;
    const mine = S.humanBatFirst ? 0 : 1;
    if (mode !== 'watch') {
      if (res.kind === 'match') {
        rec.played[S.level]++;
        if (res.win) rec.wins[S.level]++;
        if (res.win && !S.hintsUsed) rec.bestMargin[S.level] = Math.max(rec.bestMargin[S.level], res.margin);
      } else if (!S.hintsUsed) {
        if (mode === 'knock') { if (res.runs > rec.bestKnock[S.level]) { rec.bestKnock[S.level] = res.runs; r.newBest = res.runs > 0; } }
        else {
          if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; }
          if (res.runs > rec.bestDaily) { rec.bestDaily = res.runs; r.newBest = res.runs > 0; }
          rec.bestDailyEver = Math.max(rec.bestDailyEver, res.runs);
        }
      }
      for (const b of counts) {
        if (b.inn === mine) { if (b.k === 'four') rec.fours++; if (b.k === 'six') rec.sixes++; }
        else if (b.k === 'bowled' || b.k === 'caught' || b.k === 'runout') rec.wicketsTaken++;
      }
      rec.highest = Math.max(rec.highest, S.innings[mine].runs);
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.rev++;
    if ((res.kind === 'match' && res.win) || r.newBest || (res.kind === 'knock' && res.beat)) sfx('win');
  };

  // ---- pause --------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRun = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.run = null; state.rev++; };

  // ---- the play scene -----------------------------------------------------------------------------------------------------
  const scrollFlow = (ptr) => {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx('tick');
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
    else if (id === 'quit') leaveRun();
  }
  let padDrag = false, stageDrag = false;
  const doThink = () => {
    const S = state.run;
    if (S.phase !== 'ready' && S.phase !== 'flight') return;
    if (S.hint) { S.hint = null; sfx('tick'); return; }
    const h = think(S, R);
    if (!h) return;
    sfx('tick');
    const a = h.adv;
    toast(h.kind === 'bat' ? a.why : a.why, 4.2);
    if (S.mode !== 'watch') state.hintFlag = true;
    if (h.kind === 'bowl') S.bowlSel = { ...S.bowlSel, aimX: a.aimX, aimH: a.aimH, pace: a.pace, bounce: a.bounce, swing: a.swing };
  };
  const updatePlay = (dt, input) => {
    const S = state.run, ptr = input.pointer, keys = input.keys, watch = S.auto;
    const L = layoutOf(state), C2 = camsFor(L);
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
        const setThink = (v) => { st.thinkIdx = clamp(v, 0, THINK_STEPS.length - 1); sfx('tick'); save(); S.think = THINK_STEPS[st.thinkIdx]; toast(`Thinking time: ${THINK_STEPS[st.thinkIdx]} s`, 1.6); if (S.dec && S.dec.phase === 'think') S.dec.dur = THINK_STEPS[st.thinkIdx]; };
        if (inRect(D.pause, ptr.x, ptr.y) || inRect(L.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx('tick'); }
        else if (inRect(D.dec, ptr.x, ptr.y)) setThink(st.thinkIdx - 1);
        else if (inRect(D.inc, ptr.x, ptr.y)) setThink(st.thinkIdx + 1);
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveRun(); return; }
      }
    } else {
      if (ptr.pressed) {
        if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(L.think, ptr.x, ptr.y)) { doThink(); padDrag = false; stageDrag = false; }
        else if (S.phase === 'break') cmd(S, { c: 'next' });
        else if (S.humanBat) {
          if (S.phase === 'field' && (inRect(L.run, ptr.x, ptr.y) || inRect(L.stage, ptr.x, ptr.y))) cmd(S, { c: 'run' });
          else if (S.phase === 'flight' || S.phase === 'ready') {
            let hit = false;
            L.swing.forEach((r, i) => { if (inRect(r, ptr.x, ptr.y)) { hit = true; if (S.phase === 'flight') cmd(S, { c: 'swing', k: ['block', 'drive', 'lift'][i] }); } });
            if (!hit && inRect(L.stage, ptr.x, ptr.y)) stageDrag = true;
          } else if (S.phase === 'settle' && inRect(L.stage, ptr.x, ptr.y)) cmd(S, { c: 'next' });
        } else {
          // bowling controls
          const sel = S.bowlSel, ready = S.phase === 'ready' && !S.bowlGo;
          if (ready) {
            if (inRect(L.pad, ptr.x, ptr.y)) { padDrag = true; const a = padToAim(L, ptr.x, ptr.y); S.bowlSel = { ...sel, ...a }; }
            L.pace.forEach((r, i) => { if (inRect(r, ptr.x, ptr.y)) { S.bowlSel = { ...S.bowlSel, pace: i }; sfx('tick'); } });
            L.flight.forEach((r, i) => { if (inRect(r, ptr.x, ptr.y)) { S.bowlSel = { ...S.bowlSel, bounce: i === 1 }; sfx('tick'); } });
            L.swingChips.forEach((r, i) => { if (inRect(r, ptr.x, ptr.y)) { S.bowlSel = { ...S.bowlSel, swing: i }; sfx('tick'); } });
            L.fieldChips.forEach((r, i) => { if (inRect(r, ptr.x, ptr.y)) { cmd(S, { c: 'field', id: M.FIELD_SETS[i].id }); S.setId = M.FIELD_SETS[i].id; sfx('tick'); } });
            if (inRect(L.bowl, ptr.x, ptr.y)) { cmd(S, { c: 'bowl', sel: S.bowlSel }); sfx('tick'); }
          }
          if (S.phase === 'field' && inRect(L.skip, ptr.x, ptr.y)) { state.fast = !state.fast; sfx('tick'); }
          else if (S.phase === 'settle' && inRect(L.stage, ptr.x, ptr.y)) cmd(S, { c: 'next' });
        }
      }
      // dragging
      if (ptr.down && padDrag && !S.humanBat && S.phase === 'ready' && !S.bowlGo) { const a = padToAim(L, ptr.x, ptr.y); S.bowlSel = { ...S.bowlSel, ...a }; }
      if (ptr.down && stageDrag && S.humanBat && S.cam === 'pitch') { const g = unproj(C2.pitch, ptr.x, ptr.y); cmd(S, { c: 'paddle', x: g.x }); }
      if (!ptr.down) { padDrag = false; stageDrag = false; }
      // keys
      if (S.humanBat) {
        const step = keys.down.has('ArrowLeft') || keys.down.has('KeyA') ? -1 : keys.down.has('ArrowRight') || keys.down.has('KeyD') ? 1 : 0;
        if (step) cmd(S, { c: 'paddle', x: S.paddleTo + step * 0.06 });
        if (S.phase === 'flight') { if (keys.pressed.has('Digit1')) cmd(S, { c: 'swing', k: 'block' }); if (keys.pressed.has('Digit2')) cmd(S, { c: 'swing', k: 'drive' }); if (keys.pressed.has('Digit3')) cmd(S, { c: 'swing', k: 'lift' }); }
        if (S.phase === 'field' && (keys.pressed.has('Space') || keys.pressed.has('Enter'))) cmd(S, { c: 'run' });
      } else if (S.phase === 'ready' && !S.bowlGo) {
        if (keys.pressed.has('Space') || keys.pressed.has('Enter')) cmd(S, { c: 'bowl', sel: S.bowlSel });
        const sel = S.bowlSel;
        if (keys.pressed.has('ArrowLeft')) S.bowlSel = { ...sel, aimX: clamp(sel.aimX - 0.1, -0.95, 0.95) };
        if (keys.pressed.has('ArrowRight')) S.bowlSel = { ...sel, aimX: clamp(sel.aimX + 0.1, -0.95, 0.95) };
        if (keys.pressed.has('ArrowUp')) S.bowlSel = { ...S.bowlSel, aimH: clamp(S.bowlSel.aimH + 0.1, 0.2, 1.75) };
        if (keys.pressed.has('ArrowDown')) S.bowlSel = { ...S.bowlSel, aimH: clamp(S.bowlSel.aimH - 0.1, 0.2, 1.75) };
      }
      if (keys.pressed.has('KeyH')) doThink();
      if (S.phase === 'settle' && keys.pressed.has('Enter')) cmd(S, { c: 'next' });
      if (S.phase === 'break' && (keys.pressed.has('Enter') || keys.pressed.has('Space'))) cmd(S, { c: 'next' });
    }
    if (state.paused) return;
    // ---- time passes
    if (state.hold > 0) { state.hold = Math.max(0, state.hold - dt); }
    if (state.hintFlag) { S.hintsUsed = Math.max(S.hintsUsed, 1); state.hintFlag = false; }
    S.camAsp = { w: L.stage.w, h: L.stage.h, land: L.land };
    const n = state.fast && S.phase === 'field' ? 3 : 1;
    for (let i = 0; i < n; i++) stepSession(S, dt, R, sfx);
    if (S.phase === 'done') { finishRun(); return; }
    if (state.toastT > 0) state.toastT -= dt;
    if (S.phase !== 'field') state.fast = false;
  };

  // ---- menus -------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    state.audioOk = true;
    sfx('tick');
    const st = state.settings;
    if (id === 'match') startRun('match');
    else if (id === 'knock') startRun('knock');
    else if (id === 'daily') startRun('daily');
    else if (id === 'watch') startRun('watch');
    else if (id === 'level') { st.level = (st.level + 1) % M.LEVELS.length; save(); state.rev++; }
    else if (id === 'records') { state.scene = 'records'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); save(); state.rev++; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx('tick');
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (state.restoreBusy) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; state.rev++; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; state.rev++; }).finally(() => { state.restoreBusy = false; state.owned = !!monetization.owns?.('unlock_game'); state.rev++; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.rev++; save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx('tick');
    const r = state.last;
    if (id === 'again') startRun(r ? r.mode : 'match');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.run = null; state.rev++; }
    else if (id === 'share' && r) {
      const msg = r.kind === 'match' ? `I ${r.win ? 'won' : 'played'} a Stoolball match ${r.you} to ${r.opp} in Arcforge!` : `I scored ${r.runs} in a Stoolball knock in Arcforge!`;
      Promise.resolve(env.share?.(msg)).catch(() => {});
    }
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
    if (key !== 'title' && input.keys.pressed.has('Escape')) { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
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
  const runUntil = (pred, max = 60 * 60) => { for (let i = 0; i < max && !pred(); i++) advance(1); };
  const shotScene = (name) => {
    const rec = state.record;
    if (/300$/.test(name)) { name = name.replace(/300$/, ''); state.settings.textIdx = 4; }
    rec.wins = [4, 2, 1]; rec.played = [6, 4, 3]; rec.bestMargin = [18, 9, 3]; rec.bestKnock = [27, 21, 14]; rec.bestDaily = 24; rec.dailyDay = state.day; rec.bestDailyEver = 31;
    rec.highest = 52; rec.fours = 33; rec.sixes = 12; rec.wicketsTaken = 40;
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { advance(240); return; }
    if (name === 'pitch' || name === 'field' || name === 'banner' || name === 'bowl' || name === 'think') {
      startRun('match'); state.toastT = 0; state.hold = 0;
      const S = state.run;
      if (name === 'bowl') { startSecond(S, R, 31); S.bowlSel = { aimX: 0.12, aimH: 0.55, pace: 2, bounce: true, swing: 0 }; advance(20); return; }
      if (name === 'think') { runUntil(() => S.phase === 'ready' && S.pt > 0.2); doThink(); advance(3); return; }
      // a hit: swing at the right moment with a drive
      let swung = false;
      for (let i = 0; i < 60 * 60 && !(S.phase === 'field' && S.F && S.F.t > (name === 'field' ? 1.4 : 0.1)); i++) {
        if (S.phase === 'flight' && !swung && S.path && S.tf >= S.path.tArr - 0.12) {
          const a = M.ballAt(S.path, S.path.tArr); S.paddleTo = a.x - 0.1; S.paddleX = a.x - 0.1; cmd(S, { c: 'swing', k: 'drive' }); swung = true;
        }
        if (S.phase === 'settle' && S.banner && name !== 'banner') { advance(1); continue; }
        if (S.phase === 'ready') swung = false;
        if (name === 'pitch' && S.phase === 'flight' && S.tf >= (S.path ? S.path.tArr - 0.3 : 9)) { return; }
        advance(1);
      }
      if (name === 'banner') { S.F && runUntil(() => S.phase === 'settle', 60 * 40); advance(14); }
      return;
    }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'records') { state.scene = 'records'; state.rev++; advance(2); return; }
    if (name === 'result') {
      state.last = { kind: 'match', mode: 'match', level: 1, you: 38, opp: 31, win: true, tie: false, margin: 7, wktsYou: 3, wktsOpp: 4, hints: 0 };
      state.scene = 'result'; state.rev++; advance(3); return;
    }
    if (name === 'watch') {
      startRun('watch'); state.toastT = 0; state.hold = 0; state.settings.thinkIdx = 1;
      runUntil(() => state.run.dec && state.run.dec.phase === 'reveal' && state.run.dec.t > 0.8, 60 * 40);
      return;
    }
    if (name === 'break') { startRun('match'); state.toastT = 0; state.hold = 0; const S = state.run; S.innings[0] = { runs: 27, balls: 18, wkts: 3 }; S.phase = 'break'; S.pt = 0; advance(3); return; }
    if (name === 'pause') { startRun('match'); state.toastT = 0; state.hold = 0; openPause(); advance(2); }
  };

  const api = {
    // Watch & Learn, the menus and the reference pages are free; only real play counts against the free preview (a paused run does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.run && state.run.mode !== 'watch') || state.paused || state.hold > 0 || (state.run && state.run.phase === 'break'),
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'settings', 'result', 'demolimit', 'records'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      { const o = !!monetization.owns?.('unlock_game'); if (o !== !!state.owned) { state.owned = o; state.rev++; } }
      syncSize();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'records': updateFlowScene(dt, input, (id) => { if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }, 'records'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': if (state.run) updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      ctx.clearRect(0, 0, W_(), H_());   // transparent canvas: the 3D layer (web/view3d) shows through where the 2D side leaves it clear
      // The kit's free-preview pill: keep it off the score bar and the controls (top-right corner of the stage while playing).
      if (state.scene === 'play' && state.run) { const st = layoutOf(state).stage; meta.previewBadge = { x: st.x + st.w - 8, y: st.y + 8, align: 'right' }; }
      else meta.previewBadge = null;
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'records': renderRecords(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.run) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
    shotScene,
  };
  return api;
}
