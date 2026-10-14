// Jianzi: state and flow. Physics, kicks, scoring and the circle live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (solo, circle, daily, watch), result, collection, settings, howto/about/rules, demolimit.
import {
  newRun, stepRun, humanKick, advise, inBand, inReach, predictLanding, planYs, PARTNERS, CIRCLE_SESSION, REACH, BAND_TOP, KINDS, clamp, seeded,
} from './sim.js';
import { stepFx } from './art.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect, host } from './layout.js';
import { renderPlay, layoutOf, camFor } from './view.js';
import { gl } from './glhook.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderCollection,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { YARDS, SHUTTLES, resetArt } from './art.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_RUNS = 5;
const SLOW = 0.35;      // time scale while a Think hint is showing
const THINK_SECS = 2.5; // how long a Think hint lasts

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), aiRng = rng.fork(), kickRng = rng.fork(), attRng = rng.fork(), attKick = rng.fork(), runRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, gauge: true, textIdx: 0, thinkIdx: 1 },
    record: { best: 0, bestCircle: 0, bestDaily: 0, dailyDay: -1, kicks: 0, perfects: 0, tricksLanded: 0, tricks: [], runs: 0, owned: [true, false, false, false, false, false], yardSel: 0, shuttleSel: 0, demoRuns: 0 },
    run: null, att: null, attFx: [], fx: [], pops: [], banner: null, shake: 0, toast: '', toastT: 0,
    think: null, dec: null, ring: null, overT: 0, overWhy: '', last: null, collSel: null, collBack: 'title', restoreMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, hold: 0,
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
    if (!Array.isArray(rec.owned) || rec.owned.length < 6) rec.owned = [true, false, false, false, false, false];
    if (!Array.isArray(rec.tricks)) rec.tricks = [];
    rec.owned[0] = true;
    if (!rec.owned[rec.shuttleSel]) rec.shuttleSel = 0;
    if (!yardOwned(rec.yardSel)) rec.yardSel = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });
  const yardOwned = (i) => Math.max(state.record.best, state.record.bestDaily) >= (YARDS[i] ? YARDS[i].need : 99);

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    kick: (kind = 'inside', q = 0.7) => {
      const low = kind === 'knee' ? 95 : kind === 'scoop' ? 170 : 130;
      tone({ freq: low + fxRng.next() * 20, to: 50, dur: 0.13, type: 'sine', vol: 0.13 });
      tone({ freq: 1500 + fxRng.next() * 400 + q * 300, to: 800, dur: 0.05, type: 'triangle', vol: 0.05 });
      tone({ freq: 2600, to: 1800, dur: 0.035, type: 'square', vol: 0.012 });
    },
    flick: () => tone({ freq: 380, to: 170, dur: 0.16, type: 'sawtooth', vol: 0.02 }),
    perfect: () => { tone({ freq: 880, dur: 0.12, type: 'sine', vol: 0.09 }); tone({ freq: 1320, dur: 0.2, type: 'sine', vol: 0.07 }); },
    combo: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.2 + i * 0.04, type: 'triangle', vol: 0.09 })),
    drop: () => { tone({ freq: 240, to: 70, dur: 0.35, type: 'sawtooth', vol: 0.07 }); tone({ freq: 90, to: 40, dur: 0.2, type: 'sine', vol: 0.12 }); },
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 230, to: 140, dur: 0.14, type: 'sawtooth', vol: 0.04 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.4) => { state.toast = text; state.toastT = secs; };

  // ---- effects --------------------------------------------------------------------------------------------------
  const MAX_FX = 70;
  const add = (list, q) => { if (list.length < MAX_FX) list.push(q); };
  const dust = (list, x, z, n = 6, s = 1) => {
    for (let i = 0; i < n; i++) { const a = fxRng.next() * Math.PI * 2, v = 0.3 + fxRng.next() * 0.9 * s; add(list, { kind: 0, x, y: 0.03, z, vx: Math.cos(a) * v, vy: 0.2 + fxRng.next() * 0.5, vz: Math.sin(a) * v * 0.4, t: 0, max: 0.45 + fxRng.next() * 0.3, size: 0.07 + fxRng.next() * 0.06 }); }
  };
  const sparks = (list, x, y, z, n = 8, cols = ['#fff3b0', '#ffd24a', '#ffffff']) => {
    for (let i = 0; i < n; i++) { const a = fxRng.next() * Math.PI * 2, v = 0.8 + fxRng.next() * 1.9; add(list, { kind: 1, x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 0.8, vz: 0, t: 0, max: 0.4 + fxRng.next() * 0.4, size: 0.035 + fxRng.next() * 0.03, col: cols[i % cols.length] }); }
  };
  const ringFx = (list, x, y, z, col = '#fff3b0') => add(list, { kind: 2, x, y, z, vx: 0, vy: 0, vz: 0, t: 0, max: 0.5, size: 0.9, col });
  const featherBurst = (list, x, y, z, n, cols) => {
    for (let i = 0; i < n; i++) { const a = fxRng.next() * Math.PI * 2, v = 0.4 + fxRng.next() * 1.2; add(list, { kind: 3, x, y, z, vx: Math.cos(a) * v, vy: 0.6 + fxRng.next(), vz: 0, t: 0, max: 1.1 + fxRng.next() * 0.7, size: 0.1, col: cols[i % cols.length], rot: fxRng.next() * 6, spin: (fxRng.next() - 0.5) * 8 }); }
  };
  const confetti = (list, x, y, z, n) => {
    const cols = ['#e5503a', '#f6cf55', '#24b3a4', '#2f56d8', '#fbfaf1'];
    for (let i = 0; i < n; i++) { const a = fxRng.next() * Math.PI * 2, v = 1 + fxRng.next() * 2; add(list, { kind: 4, x, y, z, vx: Math.cos(a) * v, vy: 1.5 + fxRng.next() * 2.5, vz: 0, t: 0, max: 0.9 + fxRng.next() * 0.7, size: 0.045 + fxRng.next() * 0.04, col: cols[i % cols.length], rot: fxRng.next() * 6, spin: (fxRng.next() - 0.5) * 14 }); }
  };
  const pop = (text, x, y, z, col = '#fff3b0', size = 30, max = 0.9) => { if (state.pops.length < 8) state.pops.push({ text, x, y, z, col, size, t: 0, max }); };
  const banner = (text, sub, col) => { state.banner = { text, sub, col, t: 0, max: 1.6 }; };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  const shuttleCols = () => { const d = SHUTTLES[state.record.shuttleSel]; return d.mix ? d.mix : [d.f[0], d.f[1], d.tip]; };
  const startRun = (mode) => {
    if (state.demo && mode !== 'watch' && state.record.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const run = newRun({ mode, day: state.day }, runRng);
    planYs(run, aiRng);
    state.run = run; state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.think = null; state.dec = null; state.ring = null;
    state.fx.length = 0; state.pops.length = 0; state.banner = null; state.overT = 0; state.overWhy = ''; state.last = null; state.ui.scroll = 0; state.hold = 0.5;
    if (state.demo && mode !== 'watch') { state.record.demoRuns++; save(); }
    toast(mode === 'circle' ? 'Pass to a friend: tap a name when the shuttle falls to your leg' : mode === 'watch' ? 'Watch & Learn: the game stops to think before each of your kicks' : 'Tap a pad when the shuttle falls into the bright band', 3.2);
  };
  const padSeat = (k, run) => (run.circle ? [1, 2, 3][k] : [-1, 0, 1][k]);
  const hitPad = (pad) => {
    const run = state.run;
    if (!run || run.over || state.paused || run.lock > 0 || state.hold > 0) return false;
    if (!inBand(run)) {
      run.lock = 0.25;
      if (run.expect === 0) { pop(run.sh.vy > 0 || run.sh.y > BAND_TOP ? 'Wait for it' : 'Too late', run.px[0], 1.7, 0, '#ffd9b0', 24, 0.7); sfx.no(); }
      run.anim[0] = { t: 0, kind: 'inside', side: run.circle ? 0 : pad, cx: run.px[0] + 0.15, cy: 0.25, cz: 0, perfect: false };
      return false;
    }
    if (!inReach(run)) { run.lock = 0.3; pop('Out of reach', run.px[0], 1.5, 0, '#ffd9b0', 26, 0.8); sfx.no(); return false; }
    const rec = humanKick(run, pad, kickRng, run.wx);
    if (state.think) state.think = null;
    return !!rec;
  };

  // events from the simulation: kicks and drops turn into sound, particles and words
  const handleEvents = (run, list, live) => {
    for (const e of run.events) {
      if (e.seq < run.evDone) continue;
      run.evDone = e.seq + 1;
      if (e.type === 'kick') {
        const human = e.who === 0;
        dust(list, e.x, e.z, human ? 6 : 3, 0.8);
        if (e.perfect) { sparks(list, e.x, e.y, e.z, human ? 10 : 5); if (human) ringFx(list, e.x, e.y, e.z); }
        if (live) {
          sfx.kick(e.kind, e.q);
          if (e.perfect) sfx.perfect();
          if (human) {
            const nm = e.kind === 'outside' ? 'Outside' : e.kind === 'inside' ? 'Inside' : e.kind === 'knee' ? 'Knee' : 'Toe scoop';
            pop(e.perfect ? `Perfect! +${e.gained}` : `${nm} +${e.gained}`, e.x, Math.max(0.8, e.y + 0.5), e.z, e.perfect ? '#ffe36a' : '#fff6e0', e.perfect ? 34 : 28);
            if (e.fair) pop('Fair pass +10', e.x, 1.5, e.z, '#9be8b0', 24, 1.1);
            state.shake = Math.max(state.shake, e.perfect ? 0.22 : 0.1);
          }
          if (e.trick) { banner(e.trick, 'Combo!', '#f2a63a'); sfx.combo(); confetti(list, run.sh.x, run.sh.y + 0.3, run.sh.z, 18); }
          else if (!human && e.who > 0) sfx.flick();
          if (run.streak > 0 && run.streak % 10 === 0 && human) { banner(`${run.streak}!`, 'kicks without a drop', '#7fe0c8'); confetti(list, run.sh.x, run.sh.y + 0.3, run.sh.z, 12); }
        }
      } else if (e.type === 'drop') {
        dust(list, e.x, e.z, 10, 1.2);
        featherBurst(list, e.x, 0.15, e.z, 9, shuttleCols());
        if (live) { sfx.drop(); state.shake = 0.5; }
      }
    }
  };

  const dropReason = (run) => {
    const o = run.over; if (!o) return '';
    if (o.done) return `${CIRCLE_SESSION} kicks played`;
    if (run.circle && o.who !== 0) return `${PARTNERS[o.who].name} could not reach the pass`;
    return o.wide > REACH + 0.1 ? 'The shuttle came down out of reach' : 'The shuttle was not struck in time';
  };

  const finishRun = () => {
    const run = state.run, rec = state.record, mode = run.mode;
    const r = { mode, streak: run.streak, points: run.points, perfects: run.hPerfects, tricks: [...new Set(run.trickNames)].map((n) => { const c = run.trickNames.filter((x) => x === n).length; return c > 1 ? `${n} x${c}` : n; }).slice(0, 5), hints: run.hints, newBest: false, unlocks: [] };
    if (mode !== 'watch') {
      rec.runs++; rec.kicks += run.kicksBy[0]; rec.perfects += run.hPerfects; rec.tricksLanded += run.tricks.length;
      for (const id of run.tricks) if (!rec.tricks.includes(id)) rec.tricks.push(id);
      if (!run.hints) {
        if (mode === 'solo' && run.streak > rec.best) { rec.best = run.streak; r.newBest = run.streak > 0; }
        if (mode === 'circle' && run.streak > rec.bestCircle) { rec.bestCircle = run.streak; r.newBest = run.streak > 0; }
        if (mode === 'daily') { if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; } if (run.streak > rec.bestDaily) { rec.bestDaily = run.streak; r.newBest = run.streak > 0; } }
      }
      const gain = (i, why) => { if (!rec.owned[i]) { rec.owned[i] = true; r.unlocks.push(SHUTTLES[i].name); sfx.win(); void why; } };
      if (Math.max(rec.best, rec.bestDaily) >= 10) gain(1);
      if (rec.bestCircle >= 20) gain(2);
      if (rec.tricksLanded >= 5) gain(3);
      if (rec.dailyDay >= 0 && rec.bestDaily >= 10) gain(4);
      if (rec.perfects >= 100) gain(5);
      YARDS.forEach((y, i) => { if (y.need > 0 && yardBefore[i] === false && yardOwned(i)) r.unlocks.push(y.name); });
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.rev++;
    if (r.newBest) sfx.win();
  };
  let yardBefore = [true, false, false, false];
  const snapshotYards = () => { yardBefore = YARDS.map((_, i) => yardOwned(i)); };

  // ---- the Watch & Learn decision loop: THINK -> REVEAL -> ACT --------------------------------------------------------
  const watchThink = () => THINK_STEPS[state.settings.thinkIdx];
  const updateWatch = (dt) => {
    const run = state.run;
    if (state.paused || run.over) return true;      // frozen
    let dec = state.dec;
    const sh = run.sh;
    if (!dec && run.expect === 0 && sh.vy < 0 && sh.y < 1.25 && sh.y > BAND_TOP && run.streak < CIRCLE_SESSION) {
      const adv = advise(run);
      dec = state.dec = { active: true, phase: 'think', t: 0, dur: watchThink(), adv, yHit: adv.y + (aiRng.next() - 0.5) * 0.05 };
      state.think = { adv };           // lights the advised pad
    }
    if (dec && dec.phase === 'think') { dec.t += dt; if (dec.t >= dec.dur) { dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; } return true; }
    if (dec && dec.phase === 'reveal') { dec.t += dt; if (dec.t >= dec.dur) { dec.phase = 'go'; dec.t = 0; } return true; }
    if (dec && dec.phase === 'go') {
      if (sh.y <= dec.yHit || sh.y <= 0.06) {
        if (inBand(run) && inReach(run)) humanKick(run, dec.adv.pad, kickRng, run.wx);
        state.dec = null; state.think = null;
      }
    }
    return false;
  };

  // ---- the title-screen demo: four friends passing the shuttle on their own -----------------------------------------------
  const newAttract = () => { const r = newRun({ mode: 'watch', day: 0 }, attRng); planYs(r, attRng); state.att = r; };
  const updateAttract = (dt) => {
    if (!state.att || state.att.over) { if (state.att && state.att.over) { state.att.endT = (state.att.endT || 0) + dt; if (state.att.endT < 1.1) { stepFx(state.attFx, dt); return; } } newAttract(); }
    const run = state.att;
    if (inBand(run) && inReach(run) && run.lock <= 0 && run.sh.y <= 0.31) {
      const adv = advise(run);
      humanKick(run, adv.pad, attKick, run.wx);
    }
    stepRun(run, dt, attRng, attKick);
    handleEvents(run, state.attFx, false);
    stepFx(state.attFx, dt);
    if (run.streak >= 40) run.over = { streak: run.streak, points: run.points, who: 0, wide: 0, done: true };
  };

  // ---- hint -------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const run = state.run;
    if (!run || run.over || state.paused || run.mode === 'watch') return;
    run.hints++;
    state.think = { t: 0, adv: advise(run) };
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
      else {
        let hit = -1;
        L.pads.forEach((r, k) => { if (inRect(r, ptr.x, ptr.y)) hit = k; });
        if (hit >= 0) hitPad(padSeat(hit, run));
        else if (!run.circle && inRect(L.stage, ptr.x, ptr.y)) { const k = ptr.x < L.stage.x + L.stage.w / 3 ? 0 : ptr.x > L.stage.x + (L.stage.w * 2) / 3 ? 2 : 1; hitPad(padSeat(k, run)); }
      }
    }
    if (!watch && !run.over) {
      if (keys.pressed.has('ArrowLeft') || keys.pressed.has('KeyA')) hitPad(padSeat(0, run));
      if (keys.pressed.has('ArrowUp') || keys.pressed.has('KeyW') || keys.pressed.has('Space')) hitPad(padSeat(1, run));
      if (keys.pressed.has('ArrowRight') || keys.pressed.has('KeyD')) hitPad(padSeat(2, run));
      if (keys.pressed.has('KeyH')) requestThink();
    }
    if (state.paused) return;
    // time passes
    if (state.hold > 0) state.hold = Math.max(0, state.hold - dt);
    let frozen = false;
    if (watch) frozen = updateWatch(dt);
    if (state.think && !watch) { state.think.t += dt; if (state.think.t > THINK_SECS) state.think = null; }
    const ts = state.think && !watch ? SLOW : 1;
    if (!frozen && state.hold <= 0 && !run.over) {
      stepRun(run, dt * ts, aiRng, kickRng);
      if (!run.over) {
        const w = predictLanding(run.sh, run.wx, 0.3);
        state.ring = run.sh.vy < 0.3 ? { x: w.x, z: w.z } : null;
      } else state.ring = null;
      if (watch && run.streak >= CIRCLE_SESSION && !run.over) { run.over = { streak: run.streak, points: run.points, who: 0, wide: 0, done: true }; }
    }
    handleEvents(run, state.fx, true);
    if (run.over) {
      if (state.overT === 0) { state.overWhy = dropReason(run); state.think = null; state.dec = null; snapshotYardsOnce(); }
      state.overT += dt;
      if (state.overT > (run.over.done ? 1.4 : 1.9) || (ptr.pressed && state.overT > 0.9)) finishRun();
    }
    stepFx(state.fx, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.6);
  };
  const snapshotYardsOnce = () => { /* yardBefore is refreshed when a run starts */ };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
    else if (id === 'p-gauge') { state.settings.gauge = !state.settings.gauge; save(); state.rev++; }
    else if (id === 'quit') leaveRun();
  }

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const begin = (mode) => { snapshotYards(); startRun(mode); };
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'solo' || id === 'circle' || id === 'daily' || id === 'watch') begin(id);
    else if (id === 'collection') { state.collBack = 'title'; state.collSel = null; state.scene = 'collection'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-gauge') st.gauge = !st.gauge;
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
    if (id === 'again') begin(r ? r.mode : 'solo');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'collection') { state.collBack = 'result'; state.collSel = null; state.scene = 'collection'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) { const n = r.streak; Promise.resolve(env.share?.(`I kept the jianzi shuttle up for ${n} kicks in Jianzi from Arcforge!`)).catch(() => {}); }
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
  const updateCollection = (dt, input) => {
    const ptr = input.pointer, rec = state.record;
    ensureLayout(state, 'collection');
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10) {
        const h = collectionHit(ptr.x, ptr.y);
        if (h) {
          const same = state.collSel && state.collSel.kind === h.kind && state.collSel.i === h.i;
          if (h.kind === 's') { if (same && rec.owned[h.i]) { rec.shuttleSel = h.i; save(); sfx.win(); } else { sfx.tick(); } }
          else if (same && yardOwned(h.i)) { rec.yardSel = h.i; save(); resetArt(); sfx.win(); } else sfx.tick();
          state.collSel = { kind: h.kind, i: h.i }; state.rev++;
        } else if (hitScreen(ptr.x, ptr.y, state.ui.scroll) === 'back') { state.scene = state.collBack; state.ui.scroll = 0; state.rev++; sfx.tick(); }
      }
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    state.ui.scroll = clamp(state.ui.scroll, 0, max);
    if (input.keys.pressed.has('Escape')) { state.scene = state.collBack; state.ui.scroll = 0; state.rev++; }
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
  const botKick = () => {
    const run = state.run;
    if (run && inBand(run) && inReach(run) && run.lock <= 0 && run.sh.y <= 0.31) { const adv = advise(run); hitPad(run.circle ? adv.pad : adv.pad); }
  };
  const shotScene = (name) => {
    const rec = state.record;
    rec.owned = [true, true, true, true, false, true]; rec.best = 42; rec.bestCircle = 31; rec.bestDaily = 17; rec.dailyDay = state.day; rec.kicks = 880; rec.perfects = 120; rec.tricksLanded = 9; rec.shuttleSel = 3;
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { advance(150); return; }
    if (name === 'solo' || name === 'circle' || name === 'combo') {
      state.settings.thinkIdx = 0;
      begin(name === 'circle' ? 'circle' : 'solo');
      state.toastT = 0; state.hold = 0;
      const want = name === 'circle' ? 14 : 18;
      for (let i = 0; i < 60 * 90 && state.run.streak < want && !state.run.over; i++) { botKick(); advance(1); }
      if (name === 'combo') { banner('Rise and Fall', 'combo', '#f2a63a'); state.banner.t = 0.2; }
      // stop with the shuttle on its way down so the strike band is lit
      for (let i = 0; i < 60 * 4 && !(inBand(state.run) && state.run.sh.y < 0.7); i++) advance(1);
      state.toastT = 0;
      return;
    }
    if (name === 'kick' || name === 'knee') {
      begin('solo'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 40; i++) {
        const run = state.run;
        if (run.anim[0] && run.anim[0].t > 0 && (name === 'kick' || run.anim[0].kind === 'knee')) { advance(4); return; }
        if (inBand(run) && run.lock <= 0 && run.sh.y <= (name === 'knee' ? 0.66 : 0.3)) hitPad(0);
        advance(1);
      }
      return;
    }
    if (name === 'watch') {
      state.settings.thinkIdx = 1;
      begin('watch'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 70 && !(state.dec && state.dec.phase === 'think' && state.dec.t > 1.2); i++) advance(1);
      return;
    }
    if (name === 'collection') { state.scene = 'collection'; state.collBack = 'title'; state.collSel = { kind: 's', i: 3 }; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      begin('solo'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 90 && state.run.streak < 23 && !state.run.over; i++) { botKick(); advance(1); }
      for (let i = 0; i < 60 * 12 && state.scene === 'play'; i++) advance(1);
      advance(3); return;
    }
    if (name === 'pause') {
      begin('solo'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 40 && state.run.streak < 8 && !state.run.over; i++) { botKick(); advance(1); }
      openPause(); advance(2); return;
    }
  };

  // The kit's preview pill sits clear of the HUD while playing: under the wind bar (portrait) or the top-left corner of the courtyard (landscape).
  const placeBadge = () => {
    if (state.scene !== 'play' || !state.run) { meta.previewBadge = null; return; }
    const L = layoutOf(state);
    meta.previewBadge = L.land ? { x: Math.max(14, L.backClear || 0), y: Math.max(host.t + 10, 10), align: 'left' } : { x: meta.width / 2, y: L.stage.y + 8, align: 'center' };
  };

  const api = {
    // Watch & Learn, the Collection and every menu are free; only real play counts against the free preview (a paused run does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.run && state.run.mode !== 'watch' && !state.run.over) || state.paused || state.hold > 0,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'settings', 'result', 'demolimit', 'collection'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      syncSize();
      placeBadge();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'collection': updateCollection(dt, input); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      gl.frame = null;
      if (gl.active) ctx.clearRect(0, 0, meta.width, meta.height);   // the kit canvas is transparent while the 3D layer is on
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'collection': renderCollection(ctx, state); break;
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
    // dev lab hooks (headless pose checks and smoothness probes); nothing in the game calls these
    dev: { advance, hitPad: (p) => hitPad(p), begin, botKick },
    lockupZone: () => lockupZone(),
    shotScene,
  };
  void host; void camFor; void KINDS; void seeded; void renderPlay;
  return api;
}
