// Chungi: state and flow. Physics, kicks, hoops and scoring live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (street, hoop, daily, watch), result, bands, settings, howto/about/rules, demolimit.
import {
  newRun, stepRun, kick, canKick, advise, predictFall, KINDS, TRICKS, SESSION, REACH_X, REACH_Y, G, clamp,
} from './sim.js';
import { stepFx, BANDS } from './art.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect, host } from './layout.js';
import { renderPlay, layoutOf, camFor } from './view.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderBands,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { gl } from './glhook.js';

export { meta };
const DEMO_RUNS = 5;
const SLOW = 0.35;      // time scale while a Think hint is showing
const THINK_SECS = 2.5; // how long a Think hint lasts

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), kickRng = rng.fork(), attRng = rng.fork(), attKick = rng.fork(), runRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, guide: true, textIdx: 0, thinkIdx: 1 },
    record: { best: 0, bestHoops: 0, bestDaily: 0, dailyDay: -1, kicks: 0, perfects: 0, tricksLanded: 0, tricks: [], runs: 0, owned: [true, false, false, false, false, false], bandSel: 0, demoRuns: 0 },
    run: null, att: null, attFx: [], fx: [], pops: [], banner: null, shake: 0, toast: '', toastT: 0, landing: null, hoopGlow: 0,
    think: null, dec: null, overT: 0, overWhy: '', last: null, collSel: null, restoreMsg: '', restoreBusy: false, fullOwned: false,
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
    if (!Array.isArray(rec.owned) || rec.owned.length < BANDS.length) rec.owned = [true, false, false, false, false, false];
    if (!Array.isArray(rec.tricks)) rec.tricks = [];
    rec.owned[0] = true;
    if (!rec.owned[rec.bandSel]) rec.bandSel = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    kick: (kind = 'inside', q = 0.7) => {
      const low = kind === 'knee' ? 110 : kind === 'toe' ? 190 : 140;
      tone({ freq: low + fxRng.next() * 20, to: 60, dur: 0.12, type: 'sine', vol: 0.14 });
      tone({ freq: 700 + fxRng.next() * 200 + q * 200, to: 300, dur: 0.07, type: 'triangle', vol: 0.06 });
    },
    twang: (v = 1) => { tone({ freq: 330 * v, to: 220, dur: 0.18, type: 'triangle', vol: 0.07 }); tone({ freq: 1200, to: 700, dur: 0.05, type: 'square', vol: 0.012 }); },
    perfect: () => { tone({ freq: 880, dur: 0.12, type: 'sine', vol: 0.08 }); tone({ freq: 1320, dur: 0.2, type: 'sine', vol: 0.06 }); },
    hoop: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 587 * Math.pow(2, n / 12), dur: 0.16 + i * 0.03, type: 'triangle', vol: 0.09 })),
    combo: () => [0, 7, 12, 16].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.2 + i * 0.04, type: 'triangle', vol: 0.09 })),
    drop: () => { tone({ freq: 260, to: 70, dur: 0.35, type: 'sawtooth', vol: 0.06 }); tone({ freq: 90, to: 40, dur: 0.2, type: 'sine', vol: 0.12 }); },
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 230, to: 140, dur: 0.14, type: 'sawtooth', vol: 0.04 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.4) => { state.toast = text; state.toastT = secs; };

  // ---- effects --------------------------------------------------------------------------------------------------
  const MAX_FX = 70;
  const add = (list, q) => { if (list.length < MAX_FX) list.push(q); };
  const bandCols = () => BANDS[state.record.bandSel].cols;
  const dust = (list, x, n = 6) => {
    for (let i = 0; i < n; i++) { const a = fxRng.next() * Math.PI, v = 0.3 + fxRng.next() * 0.9; add(list, { kind: 0, x: x + (fxRng.next() - 0.5) * 0.4, y: -0.2, vx: Math.cos(a) * v * 1.4, vy: Math.sin(a) * v * 0.8, t: 0, max: 0.4 + fxRng.next() * 0.3, size: 0.06 + fxRng.next() * 0.06 }); }
  };
  const sparks = (list, x, y, n = 8, cols = ['#fff3b0', '#ffd24a', '#ffffff']) => {
    for (let i = 0; i < n; i++) { const a = fxRng.next() * TAU(), v = 0.8 + fxRng.next() * 2.2; add(list, { kind: 1, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 0.6, t: 0, max: 0.35 + fxRng.next() * 0.4, size: 0.035 + fxRng.next() * 0.03, col: cols[i % cols.length] }); }
  };
  const TAU = () => Math.PI * 2;
  const ringFx = (list, x, y, col = '#fff3b0', size = 0.9) => add(list, { kind: 2, x, y, vx: 0, vy: 0, t: 0, max: 0.5, size, col });
  const bandBits = (list, x, y, n) => {
    const cols = bandCols();
    for (let i = 0; i < n; i++) { const a = fxRng.next() * TAU(), v = 0.6 + fxRng.next() * 1.8; add(list, { kind: 3, x, y, vx: Math.cos(a) * v, vy: 0.5 + fxRng.next() * 1.5, t: 0, max: 0.9 + fxRng.next() * 0.6, size: 0.14, col: cols[i % cols.length], rot: fxRng.next() * 6, spin: (fxRng.next() - 0.5) * 8 }); }
  };
  const confetti = (list, x, y, n) => {
    const cols = ['#ff3d7f', '#ffc83d', '#25d0c0', '#7a5cff', '#fff1e2'];
    for (let i = 0; i < n; i++) { const a = fxRng.next() * TAU(), v = 1 + fxRng.next() * 2; add(list, { kind: 4, x, y, vx: Math.cos(a) * v, vy: 1.5 + fxRng.next() * 2.5, t: 0, max: 0.9 + fxRng.next() * 0.7, size: 0.05 + fxRng.next() * 0.04, col: cols[i % cols.length], rot: fxRng.next() * 6, spin: (fxRng.next() - 0.5) * 14 }); }
  };
  const pop = (text, x, y, col = '#fff3b0', size = 30, max = 0.9) => { if (state.pops.length < 8) state.pops.push({ text, x, y, col, size, t: 0, max }); };
  const banner = (text, sub, col) => { state.banner = { text, sub, col, t: 0, max: 1.6 }; };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  const startRun = (mode) => {
    if (state.demo && mode !== 'watch' && state.record.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const run = newRun({ mode: mode === 'watch' ? 'watch' : mode, day: state.day }, runRng);
    state.run = run; state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.think = null; state.dec = null; state.landing = null;
    state.fx.length = 0; state.pops.length = 0; state.banner = null; state.overT = 0; state.overWhy = ''; state.last = null; state.ui.scroll = 0; state.hold = 0.6; state.hoopGlow = 0;
    if (state.demo && mode !== 'watch') { state.record.demoRuns++; save(); }
    toast(mode === 'watch' ? 'Watch & Learn: the game stops to think before each kick' : mode === 'street' ? 'Tap toward the side you want the ball to go when it is low' : 'Drop the ball down through the hoop', 3.2);
  };
  const tapKick = (tapX) => {
    const run = state.run;
    if (!run || run.over || state.paused || state.hold > 0) return false;
    const b = run.ball;
    if (!canKick(run)) {
      if (run.lock > 0) return false;
      if (b.y > REACH_Y && b.vy < 0.5 && b.y < 5) { run.lock = 0.18; pop('Too early', b.x, b.y + 0.7, '#ffd9b0', 24, 0.7); sfx.no(); }
      else if (b.y <= REACH_Y && b.vy <= 2.5 && Math.abs(b.x - run.kid.x) > REACH_X) { run.lock = 0.25; pop('Out of reach', b.x, b.y + 0.7, '#ffd9b0', 24, 0.7); sfx.no(); }
      return false;
    }
    const rec = kick(run, tapX, kickRng);
    if (state.think) state.think = null;
    return !!rec;
  };

  // events from the simulation: kicks, ricochets, hoops and drops turn into sound, particles and words
  const handleEvents = (run, list, live) => {
    for (const e of run.events) {
      if (e.seq < run.evDone) continue;
      run.evDone = e.seq + 1;
      if (e.type === 'kick') {
        dust(list, run.kid.x, 5);
        sparks(list, e.x, e.y, e.perfect ? 10 : 5);
        if (e.perfect) ringFx(list, e.x, e.y);
        if (live) {
          sfx.kick(e.kind, e.perfect ? 1 : 0.5);
          if (e.perfect) sfx.perfect();
          pop(e.perfect ? `Perfect! +${e.gained}` : `${KINDS[e.kind].name} +${e.gained}`, e.x, Math.max(1.2, e.y + 0.9), e.perfect ? '#ffe36a' : '#fff1e2', e.perfect ? 34 : 26);
          state.shake = Math.max(state.shake, e.perfect ? 0.2 : 0.08);
          if (e.trick) { banner(e.trick, 'Trick!', '#ff7a9a'); sfx.combo(); confetti(list, e.x, e.y + 0.3, 18); }
          if (run.streak > 0 && run.streak % 10 === 0 && run.mode !== 'watch') { banner(`${run.streak} kicks!`, 'in a row', '#7fe8d0'); confetti(list, e.x, e.y + 0.3, 12); }
        }
      } else if (e.type === 'wall') {
        add(list, { kind: 5, x: e.x + e.side * 0.2, y: e.y, vx: 0, vy: 0, t: 0, max: 0.35, col: '#fff3b0', dir: e.side });
        sparks(list, e.x, e.y, 4, ['#ffd7a0', '#ffffff']);
        if (live) { sfx.twang(1 + Math.min(3, run.flight.rico) * 0.12); pop(`+${e.bonus}`, e.x, e.y + 0.5, '#9be8d8', 24, 0.7); state.shake = Math.max(state.shake, 0.1); }
      } else if (e.type === 'hoop') {
        ringFx(list, e.x, e.y, '#ffe074', 1.4); confetti(list, e.x, e.y, 16);
        if (live) {
          sfx.hoop(); state.hoopGlow = 1; state.shake = Math.max(state.shake, 0.15);
          pop(`Hoop! +${e.pts}`, e.x, e.y + 0.8, '#ffe074', 32, 1.1);
          if (e.trick) { banner(e.trick, 'Trick!', '#ff7a9a'); sfx.combo(); } else if (e.n % 5 === 0) banner(`${e.n} hoops!`, 'keep going', '#ffd35a');
        }
      } else if (e.type === 'drop') {
        dust(list, e.x, 10); bandBits(list, e.x, 0.3, 10);
        if (live) { sfx.drop(); state.shake = 0.5; }
      }
    }
  };
  const dropReason = (run) => {
    const o = run.over; if (!o) return '';
    if (o.done) return `${SESSION} kicks played`;
    return o.wide > REACH_X ? 'The ball came down out of reach' : 'The ball was not kicked in time';
  };

  const finishRun = () => {
    const run = state.run, rec = state.record, mode = run.mode;
    const names = [...new Set(run.trickNames)].map((n) => { const c = run.trickNames.filter((x) => x === n).length; return c > 1 ? `${n} x${c}` : n; }).slice(0, 5);
    const r = { mode, streak: run.streak, points: run.points, hoops: run.hoopsDone, perfects: run.perfects, tricks: names, hints: run.hints, newBest: false, unlocks: [] };
    if (mode !== 'watch') {
      rec.runs++; rec.kicks += run.streak; rec.perfects += run.perfects; rec.tricksLanded += run.tricks.length;
      for (const id of run.tricks) if (!rec.tricks.includes(id)) rec.tricks.push(id);
      if (!run.hints) {
        if (mode === 'street' && run.streak > rec.best) { rec.best = run.streak; r.newBest = run.streak > 0; }
        if (mode === 'hoop' && run.hoopsDone > rec.bestHoops) { rec.bestHoops = run.hoopsDone; r.newBest = run.hoopsDone > 0; }
        if (mode === 'daily') { if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; } if (run.hoopsDone > rec.bestDaily) { rec.bestDaily = run.hoopsDone; r.newBest = run.hoopsDone > 0; } }
      }
      const gain = (i) => { if (!rec.owned[i]) { rec.owned[i] = true; r.unlocks.push(BANDS[i].name); sfx.win(); } };
      if (rec.best >= 10) gain(1);
      if (run.hoopsDone >= 5 || rec.bestHoops >= 5) gain(2);
      if (rec.tricks.length >= 5) gain(3);
      if (rec.dailyDay >= 0 && rec.bestDaily >= 5) gain(4);
      if (rec.perfects >= 100) gain(5);
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.rev++;
    if (r.newBest) sfx.win();
  };

  // ---- the Watch & Learn decision loop: THINK -> REVEAL -> ACT --------------------------------------------------------
  const watchThink = () => THINK_STEPS[state.settings.thinkIdx];
  const updateWatch = (dt) => {
    const run = state.run;
    if (state.paused || run.over) return true;      // frozen
    let dec = state.dec;
    const b = run.ball;
    if (!dec && b.vy < 0 && b.y < 3.0 && b.y > REACH_Y + 0.15 && run.streak < SESSION) {
      const adv = advise(run);
      dec = state.dec = { active: true, phase: 'think', t: 0, dur: watchThink(), adv };
      state.think = { adv, t: 0 };
    }
    if (dec && dec.phase === 'think') { dec.t += dt; if (dec.t >= dec.dur) { dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; } return true; }
    if (dec && dec.phase === 'reveal') { dec.t += dt; if (dec.t >= dec.dur) { dec.phase = 'go'; dec.t = 0; state.think = null; } return true; }
    if (dec && dec.phase === 'go') {
      if (b.y <= dec.adv.y + 0.02) {
        if (canKick(run)) kick(run, b.x + dec.adv.aim * 1.6, kickRng);
        state.dec = null; state.think = null;
      }
    }
    return false;
  };

  // ---- the title-screen demo: the kid keeps the ball up on his own --------------------------------------------------------
  const newAttract = () => { state.att = newRun({ mode: 'hoop', day: 0 }, attRng); state.att.attAdv = null; };
  const updateAttract = (dt) => {
    if (!state.att || state.att.over) { if (state.att && state.att.over) { state.att.endT = (state.att.endT || 0) + dt; if (state.att.endT < 1.1) { stepFx(state.attFx, dt); return; } } newAttract(); }
    const run = state.att, b = run.ball;
    if (!run.attAdv && b.vy < 0 && b.y < 3.0) run.attAdv = advise(run);
    if (run.attAdv && canKick(run) && b.y <= run.attAdv.y + 0.02) { kick(run, b.x + run.attAdv.aim * 1.6, attKick); run.attAdv = null; }
    stepRun(run, dt, attRng, attKick);
    handleEvents(run, state.attFx, false);
    stepFx(state.attFx, dt);
    if (run.streak >= 40 && !run.over) run.over = { streak: run.streak, points: run.points, done: true, x: 0 };
  };

  // ---- hint ---------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const run = state.run;
    if (!run || run.over || state.paused || run.mode === 'watch') return;
    run.hints++;
    state.toastT = 0;
    state.think = { t: 0, adv: advise(run) };
    sfx.tick();
  };

  // ---- pause ------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRun = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; state.dec = null; state.rev++; };

  // ---- the play scene ----------------------------------------------------------------------------------------------------
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
    const cam = camFor(state, run);
    if (ptr.pressed && !run.over) {
      if (watch) {
        const D = L.demo;
        if (inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
        else if (inRect(D.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${watchThink()} s`, 1.6); }
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveRun(); return; }
      } else if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
      else if (inRect(L.think, ptr.x, ptr.y)) requestThink();
      else if (inRect(L.stage, ptr.x, ptr.y)) tapKick((ptr.x - cam.cx) / cam.s);
    }
    if (!watch && !run.over) {
      const b = run.ball;
      if (keys.pressed.has('ArrowLeft') || keys.pressed.has('KeyA')) tapKick(b.x - 1.6);
      if (keys.pressed.has('ArrowUp') || keys.pressed.has('KeyW') || keys.pressed.has('Space')) tapKick(b.x);
      if (keys.pressed.has('ArrowRight') || keys.pressed.has('KeyD')) tapKick(b.x + 1.6);
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
      stepRun(run, dt * ts, null, kickRng);
      state.landing = !run.over && run.ball.vy < 0.5 ? predictFall(run.ball, run.wx * 0.9, run.half, 0.7, G * run.g).x : null;
      if (watch && run.streak >= SESSION && !run.over) run.over = { streak: run.streak, points: run.points, done: true, x: run.ball.x };
    }
    handleEvents(run, state.fx, true);
    if (run.over) {
      if (state.overT === 0) { state.overWhy = dropReason(run); state.think = null; state.dec = null; }
      state.overT += dt;
      if (state.overT > (run.over.done ? 1.4 : 1.9) || (ptr.pressed && state.overT > 0.9)) finishRun();
    }
    stepFx(state.fx, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.6);
    if (state.hoopGlow > 0) state.hoopGlow = Math.max(0, state.hoopGlow - dt * 2);
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
    else if (id === 'p-guide') { state.settings.guide = !state.settings.guide; save(); state.rev++; }
    else if (id === 'quit') leaveRun();
  }

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const begin = (mode) => startRun(mode);
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'street' || id === 'hoop' || id === 'daily' || id === 'watch') begin(id);
    else if (id === 'bands') { state.collSel = null; state.scene = 'bands'; state.ui.scroll = 0; state.collBack = 'title'; state.rev++; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-guide') st.guide = !st.guide;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (!state.restoreBusy && !monetization.owns('unlock_game')) {
        state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
        Promise.resolve().then(() => monetization.restore()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase was found for this store account.'; })
          .catch(() => { state.restoreMsg = 'The store could not be reached. Please try again later.'; })
          .finally(() => { state.restoreBusy = false; state.rev++; });
      }
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.rev++; save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.last;
    if (id === 'again') begin(r ? r.mode : 'street');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'bands') { state.collBack = 'result'; state.collSel = null; state.scene = 'bands'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) { const n = r.mode === 'hoop' || r.mode === 'daily' ? `${r.hoops} hoops` : `${r.streak} kicks`; Promise.resolve(env.share?.(`I kept the chungi up for ${n} in Chungi from Arcforge!`)).catch(() => {}); }
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
  const updateBands = (dt, input) => {
    const ptr = input.pointer, rec = state.record;
    ensureLayout(state, 'bands');
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10) {
        const h = collectionHit(ptr.x, ptr.y);
        if (h) {
          if (state.collSel === h.i && rec.owned[h.i]) { rec.bandSel = h.i; save(); sfx.win(); } else sfx.tick();
          state.collSel = h.i; state.rev++;
        } else if (hitScreen(ptr.x, ptr.y, state.ui.scroll) === 'back') { state.scene = state.collBack || 'title'; state.ui.scroll = 0; state.rev++; sfx.tick(); }
      }
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    state.ui.scroll = clamp(state.ui.scroll, 0, max);
    if (input.keys.pressed.has('Escape')) { state.scene = state.collBack || 'title'; state.ui.scroll = 0; state.rev++; }
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
    const run = state.run; if (!run || run.over) return;
    if (!run.botAdv && run.ball.vy < 0 && run.ball.y < 3.0) run.botAdv = advise(run);
    if (run.botAdv && canKick(run) && run.ball.y <= run.botAdv.y + 0.02) { kick(run, run.ball.x + run.botAdv.aim * 1.6, kickRng); run.botAdv = null; }
  };
  const shotScene = (name) => {
    const rec = state.record;
    rec.owned = [true, true, true, true, false, true]; rec.best = 42; rec.bestHoops = 17; rec.bestDaily = 6; rec.dailyDay = state.day; rec.kicks = 880; rec.perfects = 120; rec.tricksLanded = 9; rec.bandSel = 3;
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { advance(150); return; }
    if (name === 'street' || name === 'hoop' || name === 'trick') {
      state.settings.thinkIdx = 0;
      begin(name === 'street' ? 'street' : 'hoop');
      state.toastT = 0; state.hold = 0;
      const want = name === 'street' ? 22 : 12;
      for (let i = 0; i < 60 * 90 && state.run.streak < want && !state.run.over; i++) { botKick(); advance(1); }
      for (let i = 0; i < 60 * 4 && !(state.run.ball.vy < 0 && state.run.ball.y < 2.4); i++) { botKick(); advance(1); }
      state.banner = null;
      if (name === 'trick') { banner('Corner Pocket', 'Trick!', '#ff7a9a'); state.banner.t = 0.25; }
      state.toastT = 0; state.paused = true;   // hold the moment still for the screenshot
      return;
    }
    if (name === 'watch') {
      state.settings.thinkIdx = 1;
      begin('watch'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 70 && !(state.dec && state.dec.phase === 'think' && state.dec.t > 1.2); i++) advance(1);
      state.paused = true;
      return;
    }
    if (name === 'bands') { state.scene = 'bands'; state.collBack = 'title'; state.collSel = 3; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      begin('street'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 90 && state.run.streak < 23 && !state.run.over; i++) { botKick(); advance(1); }
      state.run.over = state.run.over || { streak: state.run.streak, points: state.run.points, done: false, x: 0, wide: 3 };
      for (let i = 0; i < 60 * 12 && state.scene === 'play'; i++) advance(1);
      advance(3); return;
    }
    if (name === 'pause') {
      begin('street'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 40 && state.run.streak < 8 && !state.run.over; i++) { botKick(); advance(1); }
      openPause(); advance(2); return;
    }
  };

  const api = {
    // Watch & Learn, the band colours and every menu are free; only real play counts against the free preview (a paused run does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.run && state.run.mode !== 'watch' && !state.run.over) || state.paused || state.hold > 0,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'settings', 'result', 'demolimit', 'bands'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      syncSize();
      { const o = !!monetization.owns?.('unlock_game'); if (o !== state.fullOwned) { state.fullOwned = o; state.rev++; } }
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'bands': updateBands(dt, input); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      // The kit's preview pill sits at the top of the alley, clear of the score strip and the buttons.
      if (state.scene === 'play' && state.run) {
        const L = layoutOf(state);
        meta.previewBadge = { x: L.stage.x + L.stage.w / 2, y: L.stage.y + 8, align: 'center' };
      } else meta.previewBadge = null;
      // the 3D kid sits above the whole 2D canvas, so it is only used where nothing is drawn over the alley
      gl.frame = null; gl.allow = (state.scene === 'title' || (state.scene === 'play' && !state.pauseMenu));
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'bands': renderBands(ctx, state); break;
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
  void host; void TRICKS;
  return api;
}
