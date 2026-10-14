// Stone Skipping: state and flow. Physics live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (session, daily, free, watch), result, collection, settings, howto/about/rules, demolimit.
// Play phases: aim (choose stone, tilt, spin, then flick) -> fly (the throw plays back) -> settle (banner) -> next throw.
import {
  STONES, PONDS, WINDUP, SESSION_THROWS, TRAY_SIZE, simulateThrow, stoneAt, tiltOf, advise, adviceWhy, drawTray, makeConditions, seeded, clamp,
} from './sim.js';
import { stepFx, splash, CAM_BACK, resetArt } from './art.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect, cradleOf, trackOf } from './layout.js';
import { renderPlay, layoutOf, pullMax } from './view.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderCollection,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit, stoneOwned, pondOwned, bestOf,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { GL } from './glbridge.js';

export { meta };
const DEMO_RUNS = 3;
const FAST = 2.6;       // playback speed while the player holds a finger down to hurry a throw
const ATT_PONDS = [0, 2, 1, 3];

// About, plus the third-party credits of the 3D layer when it is in use (web/vendor3d/LICENSES.md, shown whole, as its terms ask).
let aboutKey = '', aboutCache = ABOUT;
const aboutList = () => {
  const txt = GL.licenses || '';
  if (!GL.on || !txt) return ABOUT;
  if (aboutKey === txt) return aboutCache;
  aboutKey = txt;
  const from = txt.indexOf('## '), body = from >= 0 ? txt.slice(from) : txt;
  const paras = body.split(/\n\s*\n/).map((t) => t.replace(/^#+\s*/, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  aboutCache = [...ABOUT, { title: 'Credits: the 3D people and scenery', p: paras }];
  return aboutCache;
};

const W_ = () => meta.width, H_ = () => meta.height;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), runRng = rng.fork(), throwRng = rng.fork(), attRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, textIdx: 0, thinkIdx: 1 },
    record: { bestThrow: 0, bestDist: 0, bestSession: [0, 0, 0, 0], bestDaily: 0, dailyDay: -1, throws: 0, sessions: 0, skips: 0, pondSel: 0, demoRuns: 0 },
    run: null, aim: { tray: [0, 3, 0], sel: 0, tilt01: 0.36, spin01: 0.85, pull: 0, drag: null }, ws: null, att: null,
    hint: null, dec: null, pops: [], banner: null, shake: 0, toast: '', toastT: 0, scoreShown: 0,
    last: null, collSel: null, collBack: 'title', restoreMsg: '', ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, hold: 0, settleT: 0, attT: 0, attN: 0,
  };
  syncSize();
  const newWorld = (pond, cond) => ({ pond, cond: cond || null, t: 0, fly: null, camZ: -CAM_BACK, ripples: [], parts: [], trail: [] });
  state.ws = newWorld(0, null);
  GL.state = state;

  // ---- persistence ----------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const rec = state.record;
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(rec.bestSession) || rec.bestSession.length < 4) rec.bestSession = [0, 0, 0, 0];
    rec.pondSel = clamp(rec.pondSel | 0, 0, PONDS.length - 1);
    if (!pondOwned(rec, rec.pondSel)) rec.pondSel = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });
  const ownedList = () => STONES.map((_, i) => stoneOwned(state.record, i));

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const PENTA = [0, 2, 4, 7, 9];
  const sfx = {
    whoosh: () => tone({ freq: 240, to: 700, dur: 0.22, type: 'sawtooth', vol: 0.025 }),
    skip: (n) => {
      const k = Math.max(0, n - 1), semis = PENTA[k % 5] + 12 * Math.min(2, Math.floor(k / 5));
      tone({ freq: 392 * Math.pow(2, semis / 12), dur: 0.16, type: 'sine', vol: 0.11 });
      tone({ freq: 2200 + fxRng.next() * 600, to: 900, dur: 0.045, type: 'triangle', vol: 0.03 });
    },
    sink: () => { tone({ freq: 300, to: 70, dur: 0.32, type: 'sine', vol: 0.13 }); tone({ freq: 140, to: 50, dur: 0.25, type: 'triangle', vol: 0.08 }); },
    tick: () => tone({ freq: 900, dur: 0.035, type: 'triangle', vol: 0.045 }),
    slide: (v) => tone({ freq: 400 + v * 500, dur: 0.03, type: 'sine', vol: 0.025 }),
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };
  const pop = (text, z, y, col = '#fff', size = 1) => { if (state.pops.length < 8) state.pops.push({ text, z, y, col, size, t: 0, max: 0.9 }); };

  // ---- world playback (used by the pond, the title demo and the shots) -----------------------------------------------------------
  // Advances ws.fly by dt, firing onSkip(skip) and onSink() once each as the stone reaches them.
  const advanceFly = (ws, dt, onSkip, onSink) => {
    const fl = ws.fly;
    ws.t += dt;
    if (!fl) { stepFx(ws.parts, dt); return; }
    const prev = fl.t;
    fl.t += dt;
    const res = fl.res;
    while (fl.next < res.skips.length && res.skips[fl.next].t <= fl.t + 1e-9) {
      const sk = res.skips[fl.next++];
      ws.ripples.push({ z: sk.z, t0: ws.t - (fl.t - sk.t), s: 0.5 + Math.min(1.1, sk.vn * 0.28) });
      if (ws.ripples.length > 70) ws.ripples.shift();
      splash(ws.parts, fxRng, sk.z, 7, 0.5 + sk.vn * 0.12);
      if (onSkip) onSkip(sk);
    }
    if (!fl.sunk && fl.t >= res.dur) {
      fl.sunk = true;
      const s = res.sink;
      if (s && s.why !== 'tired') { ws.ripples.push({ z: s.z, t0: ws.t - (fl.t - res.dur), s: 1.35 }); splash(ws.parts, fxRng, s.z, 16, 1.2); }
      if (onSink) onSink();
    }
    // the camera trails the stone, and a short trail of recent positions is kept
    const pos = stoneAt(res, Math.min(fl.t, res.dur));
    const target = pos.z - CAM_BACK;
    ws.camZ += (Math.max(ws.camZ, target) - ws.camZ) * Math.min(1, dt * 7);
    if (Math.floor(prev * 20) !== Math.floor(fl.t * 20) && fl.t <= res.dur) { ws.trail.push({ z: pos.z, y: pos.y }); if (ws.trail.length > 5) ws.trail.shift(); }
    stepFx(ws.parts, dt);
  };

  // ---- the title-screen demo -------------------------------------------------------------------------------------------------------
  const newAttract = () => {
    const pond = ATT_PONDS[state.attN++ % ATT_PONDS.length], cond = makeConditions(pond, attRng);
    const stone = STONES[[0, 4, 1][state.attN % 3]];
    const res = simulateThrow({ stone, tilt: 13 + attRng.next() * 3, spin: 0.9, power: 0.78 }, cond, attRng);
    state.att = newWorld(pond, cond);
    state.att.fly = { res, t: -(WINDUP + 0.8), t0: -(WINDUP + 0.8), next: 0, idx: stone.id, sunk: false };
  };
  const updateAttract = (dt) => {
    if (!state.att) newAttract();
    advanceFly(state.att, dt, null, null);
    const f = state.att.fly;
    if (f.t > f.res.dur + 2.4) newAttract();
  };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  const throwCond = (run) => makeConditions(run.pond, run.mode === 'daily' ? seeded(state.day * 977 + run.idx * 31 + 5) : runRng);
  const trayFor = (run) => {
    const src = run.mode === 'daily' ? STONES.map(() => true) : ownedList();
    const r = run.mode === 'daily' ? seeded(state.day * 613 + run.idx * 17 + 3) : runRng;
    const tray = drawTray(src, r, TRAY_SIZE, run.mode === 'free' ? [] : run.used);
    while (tray.length < TRAY_SIZE) tray.push(tray[0] ?? 0);
    return tray;
  };
  const beginThrow = () => {
    const run = state.run;
    const cond = throwCond(run);
    state.ws = newWorld(run.pond, cond);
    const A = state.aim;
    A.tray = trayFor(run); A.sel = 0; A.pull = 0; A.drag = null;
    run.phase = 'aim'; run.cond = cond; run.fast = false;
    state.hint = null; state.dec = null; state.banner = null; state.pops.length = 0; state.hold = 0.35;
    state.scoreShown = run.mode === 'free' ? 0 : run.total;
    if (run.mode === 'watch') {
      const adv = advise(A.tray.map((i) => STONES[i]), cond);
      state.dec = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], adv };
    }
  };
  const startRun = (mode) => {
    const rec = state.record;
    if (state.demo && mode !== 'watch' && rec.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const pond = mode === 'daily' ? state.day % PONDS.length : rec.pondSel;
    state.run = { mode, pond, idx: 0, throws: [], used: [], total: 0, hints: 0, phase: 'aim', cond: null, unlocks: [] };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.last = null;
    state.aim.tilt01 = 0.36; state.aim.spin01 = 0.85;
    if (state.demo && mode !== 'watch') { rec.demoRuns++; save(); }
    beginThrow();
    toast(mode === 'watch' ? 'Watch & Learn: the game thinks before every throw' : 'Pick a stone, set tilt and spin, then flick up from the stone', 3.4);
  };
  const doThrow = (power01) => {
    const run = state.run, A = state.aim;
    if (!run || run.phase !== 'aim') return;
    const stone = STONES[A.tray[A.sel]];
    const res = simulateThrow({ stone, tilt: tiltOf(A.tilt01), spin: A.spin01, power: clamp(power01, 0, 1) }, run.cond, throwRng);
    run.res = res; run.stoneIdx = stone.id; run.power = power01;
    state.ws.fly = { res, t: -WINDUP, t0: -WINDUP, next: 0, idx: stone.id, sunk: false };
    run.phase = 'fly'; A.pull = 0; A.drag = null; state.hint = null; state.hold = 0;
    sfx.whoosh();
  };
  const ownedSnapshot = () => ({ stones: STONES.map((_, i) => stoneOwned(state.record, i)), ponds: PONDS.map((_, i) => pondOwned(state.record, i)) });
  const newUnlocks = (before) => {
    const out = [];
    STONES.forEach((s, i) => { if (!before.stones[i] && stoneOwned(state.record, i)) out.push(s.name); });
    PONDS.forEach((p, i) => { if (!before.ponds[i] && pondOwned(state.record, i)) out.push(p.name); });
    return out;
  };
  const onSkip = (sk) => {
    const run = state.run;
    sfx.skip(sk.n);
    pop(String(sk.n), sk.z, 0.35, sk.eta > 0.85 ? '#ffe36a' : '#ffffff');
    state.shake = Math.max(state.shake, 0.06);
    state.scoreShown = (run.mode === 'free' ? 0 : run.total) + sk.n;
  };
  const onSink = () => {
    const run = state.run, res = run.res, rec = state.record;
    sfx.sink();
    run.phase = 'settle'; state.settleT = 0; state.shake = 0.3;
    run.throws.push({ count: res.count, dist: res.dist, stone: run.stoneIdx });
    run.used.push(run.stoneIdx);
    run.total += res.count;
    state.scoreShown = run.mode === 'free' ? res.count : run.total;
    const wasBest = res.count > rec.bestThrow, before = ownedSnapshot();
    if (run.mode !== 'watch') {
      rec.throws++; rec.skips += res.count;
      if (!run.hints) {
        if (res.count > rec.bestThrow) rec.bestThrow = res.count;
        if (res.dist > rec.bestDist) rec.bestDist = res.dist;
      }
      const unl = newUnlocks(before);
      if (unl.length) { run.unlocks = run.unlocks.concat(unl); sfx.win(); toast(`Unlocked: ${unl.join(', ')}`, 3.2); }
      save();
    }
    const why = res.sink && res.sink.why;
    const note = res.count === 0 ? 'Plop. Try a flatter tilt' : wasBest && !run.hints && run.mode !== 'watch' ? 'New best throw!' : why === 'tired' ? 'What a throw' : `${res.dist.toFixed(1)} m`;
    state.banner = { text: String(res.count), sub: `${res.count === 1 ? 'skip' : 'skips'} · ${note}`, col: wasBest && run.mode !== 'watch' && !run.hints ? '#ffd36a' : '#ffffff', t: 0, max: 2.6 };
  };
  const finishRun = () => {
    const run = state.run, rec = state.record, mode = run.mode;
    const counts = run.throws.map((t) => t.count);
    const r = { mode, total: run.total, throws: run.throws.slice(), bestThrow: Math.max(0, ...counts), longest: Math.max(0, ...run.throws.map((t) => t.dist)), hints: run.hints, newBest: false, unlocks: run.unlocks, pond: run.pond };
    if (mode !== 'watch' && mode !== 'free') {
      rec.sessions++;
      if (!run.hints) {
        if (mode === 'session' && run.total > rec.bestSession[run.pond]) { rec.bestSession[run.pond] = run.total; r.newBest = run.total > 0; }
        if (mode === 'daily') { if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; } if (run.total > rec.bestDaily) { rec.bestDaily = run.total; r.newBest = run.total > 0; } }
      }
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.rev++;
    if (r.newBest) sfx.win();
  };
  const nextThrow = () => {
    const run = state.run;
    if (run.mode !== 'free' && run.throws.length >= SESSION_THROWS) { finishRun(); return; }
    run.idx++;
    beginThrow();
  };

  // ---- the Watch & Learn decision loop: THINK -> REVEAL -> ACT ---------------------------------------------------------------
  const updateWatch = (dt) => {
    const dec = state.dec, A = state.aim;
    if (!dec) return;
    dec.t += dt;
    if (dec.phase === 'think') {
      A.sel = Math.floor(dec.t / 0.7) % TRAY_SIZE;
      if (dec.t >= dec.dur) { dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; A.sel = Math.max(0, A.tray.findIndex((i) => i === dec.adv.stone.id)); }
    } else if (dec.phase === 'reveal') {
      A.tilt01 += (dec.adv.tilt / 40 - A.tilt01) * Math.min(1, dt * 6);
      A.spin01 += (dec.adv.spin - A.spin01) * Math.min(1, dt * 6);
      if (dec.t >= dec.dur) { dec.phase = 'go'; dec.t = 0; dec.dur = 0.8; A.tilt01 = dec.adv.tilt / 40; A.spin01 = dec.adv.spin; }
    } else if (dec.phase === 'go') {
      A.pull = Math.min(dec.adv.power, (dec.t / dec.dur) * dec.adv.power);
      if (dec.t >= dec.dur) { const p = dec.adv.power; state.dec = null; doThrow(p); }
    }
  };

  // ---- hint -------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const run = state.run;
    if (!run || run.phase !== 'aim' || state.paused || run.mode === 'watch') return;
    if (state.hint) { state.hint = null; sfx.tick(); return; }
    const adv = advise(state.aim.tray.map((i) => STONES[i]), run.cond);
    state.hint = { adv, why: adviceWhy(adv, run.cond) };
    state.aim.sel = Math.max(0, state.aim.tray.findIndex((i) => i === adv.stone.id));
    if (run.mode !== 'free') run.hints++;
    sfx.tick();
  };

  // ---- pause ------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRun = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hint = null; state.dec = null; state.rev++; };

  // ---- the play scene --------------------------------------------------------------------------------------------------------
  const scrollFlow = (ptr) => {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  };
  const setSlider = (kind, x) => {
    const L = layoutOf(state), row = kind === 'tilt' ? L.tilt : L.spin, t = trackOf(row);
    const v = clamp((x - t.x) / t.w, 0, 1), A = state.aim, key = kind === 'tilt' ? 'tilt01' : 'spin01';
    const q = Math.round(v * 40) / 40;
    if (A[key] !== q) { A[key] = q; sfx.slide(q); }
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
  const updatePlay = (dt, input) => {
    const run = state.run, ptr = input.pointer, keys = input.keys, watch = run.mode === 'watch', A = state.aim;
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
    } else {
      if (ptr.pressed) {
        if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(L.think, ptr.x, ptr.y)) { requestThink(); A.drag = null; }
        else if (run.phase === 'aim' && state.hold <= 0) {
          let tray = -1;
          L.tray.forEach((r, k) => { if (inRect(r, ptr.x, ptr.y)) tray = k; });
          if (tray >= 0 && tray < A.tray.length) { if (A.sel !== tray) { A.sel = tray; sfx.tick(); } }
          else if (inRect(L.tilt, ptr.x, ptr.y)) { A.drag = { kind: 'tilt' }; setSlider('tilt', ptr.x); }
          else if (inRect(L.spin, ptr.x, ptr.y)) { A.drag = { kind: 'spin' }; setSlider('spin', ptr.x); }
          else if (inRect(L.stage, ptr.x, ptr.y)) { const cr = cradleOf(L.stage); if (ptr.y > L.stage.y + L.stage.h * 0.3 || inRect(cr, ptr.x, ptr.y)) A.drag = { kind: 'pull', y0: ptr.y }; }
        } else if (run.phase === 'fly') { run.fast = true; }
        else if (run.phase === 'settle' && state.settleT > 0.6) { nextThrow(); return; }
      }
      if (A.drag && ptr.down && run.phase === 'aim') {
        if (A.drag.kind === 'tilt') setSlider('tilt', ptr.x);
        else if (A.drag.kind === 'spin') setSlider('spin', ptr.x);
        else if (A.drag.kind === 'pull') A.pull = clamp((A.drag.y0 - ptr.y) / pullMax(L.stage), 0, 1);
      }
      if (ptr.released && A.drag) {
        const d = A.drag; A.drag = null;
        if (d.kind === 'pull' && run.phase === 'aim') {
          if (A.pull >= 0.1) doThrow(A.pull);
          else { A.pull = 0; toast('Flick further: drag up from the stone, then let go', 2.2); }
        }
      }
      if (!ptr.down) run.fast = false;
      if (run.phase === 'aim' && state.hold <= 0) {
        if (keys.pressed.has('ArrowLeft') || keys.pressed.has('KeyA')) { A.tilt01 = clamp(A.tilt01 - 0.025, 0, 1); sfx.slide(A.tilt01); }
        if (keys.pressed.has('ArrowRight') || keys.pressed.has('KeyD')) { A.tilt01 = clamp(A.tilt01 + 0.025, 0, 1); sfx.slide(A.tilt01); }
        if (keys.pressed.has('ArrowUp') || keys.pressed.has('KeyW')) { A.spin01 = clamp(A.spin01 + 0.1, 0, 1); sfx.slide(A.spin01); }
        if (keys.pressed.has('ArrowDown') || keys.pressed.has('KeyS')) { A.spin01 = clamp(A.spin01 - 0.1, 0, 1); sfx.slide(A.spin01); }
        for (let k = 0; k < TRAY_SIZE; k++) if (keys.pressed.has(`Digit${k + 1}`)) { A.sel = k; sfx.tick(); }
        if (keys.down.has('Space')) A.pull = clamp(A.pull + dt * 0.9, 0, 1);
        else if (A.pull > 0 && !A.drag) { const p = A.pull; if (p >= 0.1) doThrow(p); else A.pull = 0; }
      }
      if (keys.pressed.has('KeyH')) requestThink();
      if (run.phase === 'settle' && keys.pressed.has('Enter') && state.settleT > 0.4) { nextThrow(); return; }
    }
    if (state.paused) return;
    // ---- time passes
    if (state.hold > 0) state.hold = Math.max(0, state.hold - dt);
    if (watch && run.phase === 'aim' && state.hold <= 0) updateWatch(dt);
    if (run.phase === 'fly') advanceFly(state.ws, dt * (run.fast ? FAST : 1), onSkip, onSink);
    else advanceFly(state.ws, dt, null, null);
    if (run.phase === 'settle') {
      state.settleT += dt;
      if (watch && state.settleT > 2.2) nextThrow();
      else if (!watch && state.settleT > 8) nextThrow();
    }
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.6);
  };

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'session' || id === 'daily' || id === 'free' || id === 'watch') startRun(id);
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
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (monetization.owns('unlock_game')) state.restoreMsg = 'Full game unlocked';
      else if (state.restoreBusy) { /* one check at a time */ }
      else {
        state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
        Promise.resolve(monetization.restore?.()).then(() => {
          state.restoreMsg = monetization.owns('unlock_game') ? 'Full game unlocked. Thank you!' : 'No previous purchase found.';
        }).catch(() => { state.restoreMsg = 'The store is not available right now. Try again later.'; })
          .finally(() => { state.restoreBusy = false; state.rev++; });
      }
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.rev++; save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.last;
    if (id === 'again') startRun(r ? r.mode : 'session');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'collection') { state.collBack = 'result'; state.collSel = null; state.scene = 'collection'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) { Promise.resolve(env.share?.(`I skipped stones ${r.total} times in one Stone Skipping session in Arcforge!`)).catch(() => {}); }
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
          if (h.kind === 'p' && same && pondOwned(rec, h.i) && rec.pondSel !== h.i) { rec.pondSel = h.i; save(); resetArt(); sfx.win(); } else sfx.tick();
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
  for (let i = 0; i < 60 * 2; i++) updateAttract(1 / 60);

  // Store screenshots (main.js calls this only for ?shot=1&scene=...): put the game in a named moment and run it forward.
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  const shotScene = (name) => {
    const rec = state.record;
    rec.bestThrow = 31; rec.bestDaily = 22; rec.bestSession = [48, 36, 20, 0]; rec.dailyDay = state.day; rec.bestDist = 71.4; rec.throws = 140; rec.sessions = 24;
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { advance(220); return; }
    if (name === 'aim') {
      rec.pondSel = 2; startRun('session'); state.toastT = 0; state.hold = 0; state.aim.tilt01 = 0.35;
      advance(5); requestThink(); advance(5); return;
    }
    if (name === 'fly' || name === 'banner') {
      rec.pondSel = 1; startRun('session'); state.toastT = 0; state.hold = 0;
      const A = state.aim; A.tilt01 = 0.34; A.spin01 = 0.9; A.sel = 0;
      doThrow(0.82);
      const res = state.run.res, target = name === 'fly' ? Math.min(res.dur * 0.62, res.dur - 0.3) : res.dur + 0.1;
      for (let i = 0; i < 60 * 20 && state.ws.fly.t < target; i++) advance(1);
      if (name === 'banner') advance(30);
      return;
    }
    if (name === 'collection') { state.scene = 'collection'; state.collBack = 'title'; state.collSel = { kind: 's', i: 4 }; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      state.last = { mode: 'session', total: 52, throws: [{ count: 14, dist: 40.1, stone: 0 }, { count: 9, dist: 28.4, stone: 3 }, { count: 11, dist: 33.0, stone: 4 }, { count: 6, dist: 19.9, stone: 1 }, { count: 12, dist: 36.2, stone: 2 }], bestThrow: 14, longest: 40.1, hints: 0, newBest: false, unlocks: [], pond: 0 };
      state.scene = 'result'; state.rev++; advance(3); return;
    }
    if (name === 'watch') {
      rec.pondSel = 0; state.settings.thinkIdx = 1;
      startRun('watch'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 12 && !(state.dec && state.dec.phase === 'reveal' && state.dec.t > 0.8); i++) advance(1);
      return;
    }
    if (name === 'pause') { startRun('session'); state.toastT = 0; state.hold = 0; openPause(); advance(2); }
  };

  const api = {
    // Watch & Learn, the Collection and every menu are free; only real play counts against the free preview (a paused run does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.run && state.run.mode !== 'watch') || state.paused || state.hold > 0,
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
      if (GL.on) ctx.clearRect(0, 0, W_(), H_());
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'collection': renderCollection(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, aboutList(), 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.run) {
            // The kit's "Preview m:ss" pill sits on the pond just under the HUD, never over the score or wind rows.
            const Lb = layoutOf(state);
            meta.previewBadge = { x: Lb.stage.x + Lb.stage.w / 2, y: Lb.stage.y + 8, align: 'center' };
            renderPlay(ctx, state);
          }
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    // QA (dev toggle only): start a throw with chosen controls, for the store-shot and smoothness scripts.
    qaThrow(o = {}) {
      if (!config.dev) return;
      if (state.scene !== 'play') { state.record.pondSel = o.pond ?? 0; startRun('session'); state.toastT = 0; state.hold = 0; }
      const A = state.aim; A.tilt01 = o.tilt01 ?? 0.36; A.spin01 = o.spin01 ?? 0.9; A.sel = o.sel ?? 0;
      doThrow(o.power ?? 0.78);
    },
    lockupZone: () => lockupZone(),
    shotScene,
  };
  void bestOf;
  return api;
}
