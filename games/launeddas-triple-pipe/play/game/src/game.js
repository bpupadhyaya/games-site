// Launeddas Triple Pipe: state and flow. The simulation lives in sim.js, the computer piper and the coach in ai.js, drawing in view.js,
// hud.js and menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
import { newTune, stepTune, STEP, PACES, accuracy, rating, WIN } from './sim.js';
import { TUNES, LEAD, hz, laneMidi, LANE_NAMES } from './tunes.js';
import { PROFILES, createDriver, advice } from './ai.js';
import { inRect, setSize, W, H, TEXT_DEC, TEXT_INC, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { drawBackdrop, drawPipes, drawField } from './view.js';
import { layoutFor, drawHud, drawButtons, drawCard, drawCountIn, drawToast, cardRectFor } from './hud.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderReason, renderPages, renderDemoLimit,
  hitScreen, flowMeta, READER, refCloseRect, ensureLayout, resetMenus, lockupZone, stepAttract, newAttract,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { v3 } from './v3.js';

export const wheelInput = { dy: 0 };
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_PLAY_CAP = 3;       // tune plays in the free web demo
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BLANK = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } });
const KEY_LANES = { KeyA: 0, KeyS: 1, KeyJ: 2, KeyK: 3, KeyL: 4, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 };
const GRADE_TXT = ['Perfect', 'Good', 'Late'];

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();

  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, reasonOpen: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, cues: true },
    record: { plays: 0, best: [0, 0, 0, 0], master: [0, 0, 0, 0], demoPlays: 0 },
    setup: { tune: 0, pace: 1 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, page: 0,
    mode: 'play', S: newTune(0, 1), driver: null, endT: 0, newBest: false,
    parts: [], pops: [], toast: '', toastT: 0, card: null, hint: null, hintT: 0, think: null, w: null, ff: false,
    fingers: {}, pressed: [false, false, false, false, false, false], droneT: 0,
    shotMode: null, att: null, loaded: false, restoreMsg: '', wlabel: '', last: null,
  };
  Object.defineProperty(state, 'lay', { value: null, writable: true, enumerable: false });

  // ---- persistence ---------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(state.record.best) || state.record.best.length < 4) state.record.best = [0, 0, 0, 0];
    if (!Array.isArray(state.record.master) || state.record.master.length < 4) state.record.master = [0, 0, 0, 0];
    if (SHOT_MODE) { try { const mm = /[?&]zoom=([0-9]+)/.exec(globalThis.location.search); if (mm) state.settings.textIdx = clamp(Number(mm[1]) | 0, 0, TEXT_SCALES.length - 1); } catch { /* ignore */ } }
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound -------------------------------------------------------------------------------------------------------
  // Master level: offline render of a whole tune measured peak -9 dB / RMS -39 dB with the raw values, so everything is scaled up (peak stays under -4 dB).
  const MASTER = 1.6;
  const tone = (o) => { if (state.settings.sound) audio.tone({ ...o, vol: (o.vol ?? 0.2) * MASTER }); };
  const noteSound = (lane, g) => {
    const tn = TUNES[state.S.tune], f = hz(laneMidi(tn, lane));
    if (lane < 2) {
      tone({ freq: f, dur: 0.34, type: 'sawtooth', vol: 0.05 });
      tone({ freq: f * 2.003, dur: 0.26, type: 'triangle', vol: 0.03 });
    } else {
      tone({ freq: f, dur: 0.3, type: 'square', vol: 0.032 });
      tone({ freq: f * 1.007, dur: 0.3, type: 'triangle', vol: 0.045 });
    }
    void g;
  };
  const sfx = {
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    count: (go) => tone({ freq: go ? 660 : 440, to: go ? 880 : 440, dur: go ? 0.28 : 0.1, type: 'triangle', vol: 0.12 }),
    breath: () => { tone({ freq: 180, to: 320, dur: 0.22, type: 'sawtooth', vol: 0.025 }); },
    thin: () => tone({ freq: 140, to: 100, dur: 0.07, type: 'sine', vol: 0.05 }),
    miss: () => tone({ freq: 190, to: 120, dur: 0.14, type: 'triangle', vol: 0.05 }),
    dry: () => { tone({ freq: 220, to: 60, dur: 0.9, type: 'sawtooth', vol: 0.08 }); },
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.28 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  // Sustained drone: the kit's tone() always decays from its start level, so re-triggering it every 0.11 s made the drone pulse at about 9 Hz.
  // Here one pair of oscillators (reed-like low-passed saw + octave square) runs on its own context and only its level is steered; if the
  // game stops calling droneSound (pause, result, menu) the level falls to silence by itself within about 0.35 s.
  const dr = { ac: null, g: null, o: null, o2: null, g2: null };
  const droneSound = (dt) => {
    const S = state.S;
    void dt;
    if (S.over || S.t < LEAD - 1.4 || !state.settings.sound) return;
    const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctx) return;
    if (!dr.ac) {
      try {
        const ac = dr.ac = new Ctx();
        dr.g = ac.createGain(); dr.g.gain.value = 0;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7;
        dr.o = ac.createOscillator(); dr.o.type = 'sawtooth';
        dr.o2 = ac.createOscillator(); dr.o2.type = 'square'; dr.g2 = ac.createGain(); dr.g2.gain.value = 0.3;
        dr.o.connect(lp); dr.o2.connect(dr.g2).connect(lp); lp.connect(dr.g).connect(ac.destination);
        dr.o.start(); dr.o2.start();
      } catch { dr.ac = null; return; }
    }
    const ac = dr.ac; if (ac.state === 'suspended') ac.resume();
    const now = ac.currentTime, weak = S.air < 0.2;
    const f = hz(TUNES[S.tune].tonic - 12);
    const lvl = (weak ? 0.02 : 0.034) * MASTER * 1.4;
    dr.o.frequency.setTargetAtTime(f * (weak ? 1 - 0.02 * fx.next() : 1), now, 0.03);
    dr.o2.frequency.setTargetAtTime(f * 2.004, now, 0.03);
    dr.g.gain.cancelScheduledValues(now);
    dr.g.gain.setTargetAtTime(lvl, now, 0.06);
    dr.g.gain.setTargetAtTime(0, now + 0.3, 0.08);
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- particles ---------------------------------------------------------------------------------------------------
  const MAX_PARTS = 140;
  const add = (q) => { if (state.parts.length < MAX_PARTS) state.parts.push(q); };
  const sparks = (x, y, n, col) => { for (let i = 0; i < n; i++) { const a = -Math.PI * (0.15 + fx.next() * 0.7), s = 60 + fx.next() * 200; add({ kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.35 + fx.next() * 0.35, size: 3 + fx.next() * 4, col }); } };
  const ring = (x, y, size, col) => add({ kind: 2, x, y, vx: 0, vy: 0, t: 0, max: 0.45, size, col });
  const stepParts = (dt) => {
    for (const q of state.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.97; q.vy = q.vy * 0.97 + 260 * dt; }
    for (let i = state.parts.length - 1; i >= 0; i--) if (state.parts[i].t >= state.parts[i].max) state.parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size = 30) => { state.pops.push({ x, y, text, col, size, t: 0, max: 0.9 }); if (state.pops.length > 6) state.pops.shift(); };
  const COLS = ['#6fe0d0', '#ffd36a'];

  // ---- the tune ----------------------------------------------------------------------------------------------------
  function startTune(cfg) {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoPlays >= DEMO_PLAY_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.mode = cfg.mode;
    state.S = newTune(cfg.tune, cfg.pace);
    state.cfg = { ...cfg };
    state.driver = cfg.mode === 'watch' ? createDriver(PROFILES[cfg.prof ?? 1], aiRng.fork()) : null;
    state.w = cfg.mode === 'watch' ? { phase: 'run', timer: 0, key: '', at: -9, adv: null } : null;
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.ui.scroll = 0;
    state.endT = 0; state.newBest = false; state.parts = []; state.pops = []; state.card = null; state.hint = null; state.think = null; state.wlabel = '';
    state.fingers = {}; state.droneT = 0; state.last = null; state.lastCount = 4;
    if (cfg.mode !== 'watch') { state.record.demoPlays = (state.record.demoPlays | 0) + 1; save(); }
    if (cfg.mode === 'watch') toast(`${PROFILES[cfg.prof ?? 1].name} plays ${TUNES[cfg.tune].name}`, 2.4);
  }
  function startWatch() {
    startTune({ mode: 'watch', tune: aiRng.int(TUNES.length), pace: 1, prof: 1 + aiRng.int(2) });
  }
  function finishTune() {
    const S = state.S;
    state.scene = 'result'; state.ui.scroll = 0;
    if (state.mode === 'watch') return;
    state.record.plays++;
    if (S.score > (state.record.best[S.tune] | 0)) { state.record.best[S.tune] = S.score; state.newBest = S.score > 0; }
    if (rating(S) === 'Master') state.record.master[S.tune]++;
    save();
  }

  // ---- the fingers -------------------------------------------------------------------------------------------------
  // Each finger remembers which pad it is on; moving onto another pad plays that pad. The breath pad is held while any finger is on it.
  const padAt = (lay, x, y) => {
    for (let i = 0; i < 6; i++) {
      const p = lay.pads[i];
      if (x >= p.x - 4 && x <= p.x + p.w + 4 && y >= lay.hitY - 56 && y <= p.y + p.h + 20) return i;
    }
    return -1;
  };
  function readFingers(input) {
    const lay = state.lay;
    const list = env.multi ? env.multi.list() : (input.pointer.down ? [{ id: 0, x: input.pointer.x, y: input.pointer.y }] : []);
    const seen = new Set(), press = [], down = [false, false, false, false, false, false];
    for (const tch of list) {
      const id = tch.id === undefined ? 0 : tch.id;
      seen.add(id);
      const pad = padAt(lay, tch.x, tch.y);
      if (pad < 0) { delete state.fingers[id]; continue; }
      down[pad] = true;
      if (state.fingers[id] !== pad) { state.fingers[id] = pad; if (pad > 0) press.push(pad - 1); }
    }
    for (const id of Object.keys(state.fingers)) if (!seen.has(Number(id)) && !seen.has(id)) delete state.fingers[id];
    return { press, breath: down[0], down };
  }
  function humanCmd(input) {
    const f = readFingers(input), keys = input.keys;
    const press = [...f.press];
    for (const [code, lane] of Object.entries(KEY_LANES)) { if (keys.pressed.has(code) && !press.includes(lane)) press.push(lane); }
    const breath = f.breath || keys.down.has('Space') || keys.down.has('KeyB');
    const down = f.down.slice();
    if (keys.down.has('Space') || keys.down.has('KeyB')) down[0] = true;
    state.pressed = down.map((d, i) => d || (i > 0 && state.S.t - state.S.lastPress[i - 1] < 0.12));
    return { press, breath };
  }

  // ---- events ---------------------------------------------------------------------------------------------------------
  function events(S, silent) {
    const lay = state.lay;
    for (const e of S.ev) {
      const lane = e.lane;
      const x = lay ? lay.cols[(lane ?? 0) + 1].x + lay.cols[(lane ?? 0) + 1].w / 2 : 0, y = lay ? lay.hitY : 0;
      if (e.k === 'hit') {
        if (!silent) noteSound(lane, e.g);
        sparks(x, y, e.g === 0 ? 12 : 6, COLS[lane < 2 ? 0 : 1]);
        ring(x, y, e.g === 0 ? 70 : 52, COLS[lane < 2 ? 0 : 1]);
        pop(x, y - 54, GRADE_TXT[e.g], e.g === 0 ? '#fff3b0' : e.g === 1 ? '#bff0e6' : '#ffc9a0', e.g === 0 ? 30 : 24);
      } else if (e.k === 'miss') {
        if (!silent) sfx.miss();
        if (lay && S.combo === 0) pop(x, y - 40, 'Missed', '#ff9d8a', 22);
      } else if (e.k === 'ignored') { if (!silent) sfx.thin(); pop(x, y - 40, 'Breathing', '#ffd0a0', 22); }
      else if (e.k === 'stray') { if (!silent) sfx.thin(); }
      else if (e.k === 'squeeze') { if (!silent) sfx.breath(); if (lay) ring(lay.cols[0].x + lay.cols[0].w / 2, y, 70, '#ffb08a'); }
      else if (e.k === 'dry') { if (!silent) sfx.dry(); toast('The drone fell silent', 3); }
      else if (e.k === 'done') { if (!silent) sfx.win(); }
    }
  }
  function stepPlayTick(dt, cmd, silent) {
    const S = state.S;
    stepTune(S, dt, cmd);
    events(S, silent);
    if (!silent) droneSound(dt);
    if (S.over && !state.endT) state.endT = 0.0001;
  }

  // ---- Think (the coach) and Watch & Learn --------------------------------------------------------------------------
  function openThink() {
    if (state.mode !== 'play' || state.S.over || state.paused || state.S.t < LEAD - 0.5) return;
    const a = advice(state.S, PROFILES[2]);
    state.card = { title: `Think: ${a.title}`, text: a.text, sticky: true };
    state.hint = { lanes: a.lanes, breath: a.breath };
    state.paused = true; state.think = { coach: true };
    sfx.tick();
  }
  function closeThink() { state.card = null; state.paused = false; state.think = null; state.hintT = 1.8; sfx.tick(); }
  // Returns true while the tune is held for the piper to think.
  function updateWatch(dt) {
    const w = state.w, S = state.S, prof = state.driver.prof;
    if (w.phase === 'think' || w.phase === 'reveal') {
      w.timer -= dt * (state.ff ? 3 : 1);
      if (w.phase === 'think' && w.timer <= 0) {
        w.phase = 'reveal'; w.timer = 2;
        state.card = { title: `${prof.name}: ${w.adv.title}`, text: w.adv.text, sticky: true };
        state.hint = { lanes: w.adv.lanes, breath: w.adv.breath };
        state.wlabel = `${prof.name} will: ${w.adv.title}`;
      } else if (w.phase === 'reveal' && w.timer <= 0) {
        w.phase = 'run'; w.at = S.t; w.key = w.adv.key;
        state.card = null; state.hint = null; state.wlabel = '';
      }
      return true;
    }
    if (S.t > LEAD - 0.2 && S.t - w.at > 3.6 && !S.over) {
      const a = advice(S, prof);
      if ((a.key === 'squeeze' || a.key === 'urgent') && a.key !== w.key) {
        w.phase = 'think'; w.timer = THINK_STEPS[state.settings.thinkIdx]; w.adv = a; w.at = S.t;
        state.wlabel = `${prof.name} is thinking…`;
        return true;
      }
      if (a.key !== 'squeeze' && a.key !== 'urgent') w.key = a.key;
    }
    return false;
  }

  // ---- the play scene ------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.reasonOpen = false; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveTune = () => {
    state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.ui.scroll = 0;
    state.think = null; state.card = null; state.hint = null; state.fingers = {};
  };
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  }
  function modalInput(ptr, key, handler) {
    ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10 && flowMeta().key === key) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
    }
  }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    const st = state.settings;
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); save(); }
    else if (id === 'p-cues') { st.cues = !st.cues; save(); }
    else if (id === 'p-txtdec') { st.textIdx = Math.max(0, st.textIdx - 1); save(); }
    else if (id === 'p-txtinc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); save(); }
    else if (id === 'quit') leaveTune();
  }

  function updatePlay(dt, input) {
    const ptr = input.pointer, keys = input.keys;
    const watch = state.mode === 'watch';
    const lay = layoutFor(state);
    state.lay = lay;
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) {
      if (state.pauseMenu) closePause();
      else if (state.reasonOpen) state.reasonOpen = false;
      else if (state.think && state.think.coach) closeThink();
      else if (watch) state.paused = !state.paused;
      else openPause();
    }
    if (state.pauseMenu) { modalInput(ptr, 'pause', handlePauseTap); return; }
    if (state.reasonOpen) { modalInput(ptr, 'reason', (id) => { if (id === 'reason-close') state.reasonOpen = false; }); return; }

    const b = lay.btn;
    if (ptr.pressed) {
      const hit = (id) => b[id] && inRect(b[id], ptr.x, ptr.y);
      if (state.card && inRect(cardRectFor(lay), ptr.x, ptr.y)) {
        if (state.think && state.think.coach) closeThink(); else { state.reasonOpen = true; state.ui.scroll = 0; }
        return;
      }
      if (hit('menu')) { if (!state.S.over) openPause(); sfx.tick(); return; }
      else if (hit('think')) { if (state.think && state.think.coach) closeThink(); else openThink(); return; }
      else if (hit('pause')) { state.paused = !state.paused; sfx.tick(); return; }
      else if (hit('fast')) { state.ff = !state.ff; sfx.tick(); return; }
      else if (hit('dec')) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); return; }
      else if (hit('inc')) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); return; }
      else if (hit('exit')) { leaveTune(); return; }
    }
    if (keys.pressed.has('KeyT') && !watch) { if (state.think && state.think.coach) closeThink(); else openThink(); }
    if (state.S.over && state.endT > 0.8 && (keys.pressed.has('Enter') || keys.pressed.has('Space'))) { finishTune(); return; }

    let cmd = null;
    if (!watch && !state.paused) cmd = humanCmd(input);
    else if (!watch) state.pressed = [false, false, false, false, false, false];
    if (state.paused) return;
    stepParts(dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.hintT > 0) { state.hintT -= dt; if (state.hintT <= 0) state.hint = null; }
    const S = state.S;
    const ticks = watch && state.ff ? 3 : 1;
    for (let k = 0; k < ticks; k++) {
      if (S.over) { state.endT += dt; break; }
      if (watch) {
        if (updateWatch(dt)) break;
        const c = state.driver.cmd(S);
        state.pressed = [c.breath, ...[0, 1, 2, 3, 4].map((l) => c.press.includes(l) || S.t - S.lastPress[l] < 0.12)];
        stepPlayTick(dt, c, false);
      } else {
        stepPlayTick(dt, cmd, false);
        cmd = { press: [], breath: cmd.breath };
      }
      const n = Math.ceil((LEAD - S.t) / (LEAD / 3));
      if (S.t < LEAD && n < state.lastCount && n > 0 && n <= 3) { state.lastCount = n; sfx.count(false); }
      if (S.t >= LEAD && state.lastCount > 0) { state.lastCount = 0; sfx.count(true); }
    }
    if (S.over && state.endT > (watch ? 3 : 1.6)) finishTune();
  }

  // ---- rendering ---------------------------------------------------------------------------------------------------------
  function renderPlay(ctx) {
    const lay = layoutFor(state);
    state.lay = lay;
    const S = state.S;
    if (!v3.on) { ctx.fillStyle = '#150d09'; ctx.fillRect(0, 0, W, H); }
    // the sky fills the header and the pipe picture (the whole left panel in landscape); the lanes sit on dark umber
    drawBackdrop(ctx, lay.land ? { x: 0, y: 0, w: lay.pic.x + lay.pic.w + 6, h: H } : { x: 0, y: 0, w: W, h: lay.pic.y + lay.pic.h + 4 }, state.t);
    const lit = [0, 1, 2, 3, 4].map((l) => S.t - S.lastPress[l] < 0.14);
    const droneOn = S.over ? (S.over.how === 'dry' ? 0 : 0.5) : S.air > 0 ? 1 : 0.35 + 0.3 * Math.sin(state.t * 30);
    drawPipes(ctx, lay.pic, { t: state.t, air: S.air, squeeze: S.squeeze, drone: droneOn, lit, hint: state.settings.cues ? state.hint?.lanes : null, breathHint: state.settings.cues && state.hint?.breath });
    drawField(ctx, lay, { S, t: state.t, pressed: state.pressed, hint: state.settings.cues ? state.hint : null, parts: state.parts, pops: state.pops });
    drawHud(ctx, state, lay);
    drawButtons(ctx, state, lay);
    drawCountIn(ctx, state, lay);
    drawCard(ctx, state, lay);
    drawToast(ctx, state, lay);
    if (state.mode === 'watch' && state.wlabel && !state.card) {
      const f = lay.field; ctx.save(); ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(14, Math.round(lay.fs * 0.8))}px system-ui, sans-serif`;
      const w = Math.min(f.w - 20, ctx.measureText(state.wlabel).width + 30);
      ctx.fillStyle = 'rgba(16,8,12,0.85)'; ctx.fillRect(f.x + f.w / 2 - w / 2, f.y + 34, w, 36);
      ctx.fillStyle = '#ffd24a'; ctx.fillText(state.wlabel, f.x + f.w / 2, f.y + 59); ctx.restore();
    }
    if (state.paused && !state.pauseMenu && !state.think && !state.card) {
      const f = lay.field; ctx.save(); ctx.fillStyle = 'rgba(10,4,4,0.45)'; ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff2d6'; ctx.font = `800 ${Math.round(lay.fs * 1.7)}px system-ui, sans-serif`; ctx.fillText('Paused', f.x + f.w / 2, f.y + f.h / 2); ctx.restore();
    }
  }

  // ---- menus ---------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'play') { state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('tune')) { const i = Number(id.slice(4)); if (state.demo && i > 1) { state.setupMsg = 'That tune is in the full game.'; return; } s.tune = i; state.setupMsg = ''; }
    else if (id.startsWith('pace')) { s.pace = Number(id.slice(4)); }
    else if (id === 'start') startTune({ mode: 'play', tune: s.tune, pace: s.pace });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-cues') st.cues = !st.cues;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.cfg;
    if (id === 'again') { if (state.mode === 'watch') startWatch(); else startTune({ ...cfg }); }
    else if (id === 'new') { state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta(), scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (wheelInput.dy) { state.ui.scroll = clamp(state.ui.scroll + wheelInput.dy, 0, max); wheelInput.dy = 0; }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
    void dt;
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; state.ui.scroll = 0; state.ui.drag = null; };
    const setScroll = (v) => { state.ui.scroll = clamp(v, 0, READER.max); };
    if (ptr.pressed) {
      if (inRect(refCloseRect(), ptr.x, ptr.y)) { close(); return; }
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
      else if (ptr.y >= READER.y0 && ptr.y <= READER.y1) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll };
    }
    if (state.ui.drag && ptr.down) setScroll(state.ui.drag.s0 - (ptr.y - state.ui.drag.y0));
    if (ptr.released) state.ui.drag = null;
    if (wheelInput.dy) { setScroll(state.ui.scroll + wheelInput.dy); wheelInput.dy = 0; }
    const step = 70, pgs = Math.max(100, READER.view - 80);
    if (keys.pressed.has('ArrowDown')) setScroll(state.ui.scroll + step);
    if (keys.pressed.has('ArrowUp')) setScroll(state.ui.scroll - step);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) setScroll(state.ui.scroll + pgs);
    if (keys.pressed.has('PageUp')) setScroll(state.ui.scroll - pgs);
    if (keys.pressed.has('Home')) setScroll(0);
    if (keys.pressed.has('End')) setScroll(READER.max);
    if (keys.pressed.has('Escape') || keys.pressed.has('Enter')) close();
  };

  // ---- showcase (store screenshots: ?shot=1 renders a scripted, real position instead of the random player) ---------------
  const SHOWCASE = [
    { tune: 0, pace: 1, t: 16, air: 0.7 },
    { tune: 1, pace: 1, t: 22, think: true },
    { tune: 2, pace: 1, t: 30, air: 0.18 },
    { tune: 3, pace: 1, t: 27, squeeze: true },
    { tune: 1, pace: 0, t: 38, air: 0.9 },
    { tune: 3, pace: 1, t: 44, air: 0.55 },
  ];
  function setupShowcase(kind) {
    const sc = SHOWCASE[kind % SHOWCASE.length];
    startTune({ mode: 'play', tune: sc.tune, pace: sc.pace });
    state.record.demoPlays = 0;
    const S = state.S, d = createDriver(PROFILES[2], aiRng.fork());
    state.lay = layoutFor(state);
    while (S.t < sc.t && !S.over) { stepTune(S, STEP, d.cmd(S)); }
    if (sc.air !== undefined) S.air = sc.air;
    if (sc.squeeze) { S.squeeze = true; S.air = 0.45; }
    state.pressed = [!!sc.squeeze, ...[0, 1, 2, 3, 4].map((l) => S.t - S.lastPress[l] < 0.2)];
    S.combo = 6 + kind * 5; S.score = Math.max(S.score, 2400 + kind * 380);
    const lay = layoutFor(state);
    sparks(lay.cols[3].x + lay.cols[3].w / 2, lay.hitY, 10, '#ffd36a'); pop(lay.cols[3].x + lay.cols[3].w / 2, lay.hitY - 50, 'Perfect', '#fff3b0', 30);
    state.pops[0].t = 0.2; for (const p of state.parts) p.t += 0.12;
    if (sc.think) { const a = advice(S, PROFILES[2]); state.card = { title: `Think: ${a.title}`, text: a.text, sticky: true }; state.hint = { lanes: a.lanes, breath: a.breath }; }
    state.shotMode = { kind };
  }
  function finishDemoResult() {
    startTune({ mode: 'play', tune: 1, pace: 1 });
    const S = state.S, d = createDriver(PROFILES[1], aiRng.fork());
    while (!S.over && S.t < 200) stepTune(S, STEP, d.cmd(S));
    state.record.demoPlays = 0; state.scene = 'result';
  }
  state.att = newAttract(rng.fork());
  resetMenus();
  if (SHOT_MODE) {
    setupShowcase((Number(config.seed) | 0) % SHOWCASE.length);
    const q = (k) => { try { const mm = new RegExp(`[?&]${k}=([a-z0-9]+)`).exec(globalThis.location.search); return mm ? mm[1] : null; } catch { return null; } };
    if (q('zoom')) state.settings.textIdx = clamp(Number(q('zoom')) | 0, 0, 4);
    const v = q('view');
    if (v) {
      state.shotMode = v === 'pause' ? state.shotMode : null;
      if (v === 'pause') openPause();
      else if (v === 'result') finishDemoResult();
      else if (v === 'rules' || v === 'about' || v === 'howto') { state.scene = v; state.back = 'title'; state.page = 0; state.ui.scroll = (Number(q('page')) | 0) * 900; }
      else if (v === 'watch') { startWatch(); state.shotMode = null; }
      else state.scene = v;
    }
    const adv = Number(q('ticks')) | 0;
    if (adv > 0 && state.scene === 'play') for (let i = 0; i < adv; i++) { state.t += 1 / 60; updatePlay(1 / 60, BLANK()); }
  }

  return {
    // Watch & Learn and every menu are free; only real tunes count against the free preview (a paused or thinking tune does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.mode === 'play' && !state.S.over && state.S.t >= LEAD - 0.5) || state.paused,
    update(dt, input) {
      if (SHOT_MODE) input = BLANK();
      setSize(meta.width, meta.height);
      config.textScale = TEXT_SCALES[state.settings.textIdx];
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') stepAttract(state.att, dt);
      if (state.shotMode) return;
      switch (state.scene) {
        case 'title': if (input.keys.pressed.has('Enter')) { handleTitle('play'); break; } updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
      wheelInput.dy = 0;
    },
    render(ctx, view) {
      setSize(view?.width ?? meta.width, view?.height ?? meta.height);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          renderPlay(ctx);
          v3.modal = true;
          try {
            if (state.pauseMenu) renderPause(ctx, state);
            else if (state.reasonOpen) renderReason(ctx, state);
          } finally { v3.modal = false; }
          break;
        default: break;
      }
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
  };
}
void WIN; void LANE_NAMES; void accuracy;
