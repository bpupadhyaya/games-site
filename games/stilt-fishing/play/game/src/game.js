// Stilt Fishing: state and flow. The simulation lives in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (day, daily, free, watch), result, logbook, settings, howto/about/rules, demolimit.
// A run is one rig (sim.js) stepped once per frame; game.js feeds it the pad / keyboard input (or the auto-player in
// Watch & Learn), turns its events into sound, particles and records, and finishes the day.
import {
  SPECIES, SPOTS, DAY_SECS, BONUS_STEADY, makeRig, step, cast, seeded, clamp, pointsOf, autoLean, autoReel, castWindow, chooseTarget,
  advise, fishById, rankFor,
} from './sim.js';
import { stepFx, splash, bubbles, sceneGeom } from './art.js';
import { TEXT_SCALES, THINK_STEPS, meta, host, syncSize, refLayout, inRect } from './layout.js';
import { renderPlay, layoutOf, geomOf, padTrack } from './view.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderLogbook,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit, spotOwned,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_RUNS = 3;
const ATT_SPOTS = [0, 2, 1, 0];

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), runRng = rng.fork(), attRng = rng.fork();
  const emptySp = () => SPECIES.map(() => ({ n: 0, best: 0 }));
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, textIdx: 0, thinkIdx: 1 },
    record: { bestDay: [0, 0, 0, 0], bestDaily: 0, dailyDay: -1, kg: 0, fish: 0, species: emptySp(), spotSel: 0, demoRuns: 0, falls: 0 },
    run: null, ws: null, att: null, ctl: { lean: 0, reel: false }, padDown: false, hintOn: false, hintAdv: null, dec: null,
    banner: null, land: null, shake: 0, toast: '', toastT: 0, cueT: 0, scoreShown: 0, shotAI: false,
    last: null, collSel: null, collBack: 'title', restoreMsg: '', ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, hold: 0, attN: 0,
  };
  syncSize();
  const newWS = (rig) => ({ rig, t: 0, parts: [], ripples: [], castAnim: 0, hintFish: 0, frame: 0, fxRng, rel: null });

  // ---- persistence ----------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const rec = state.record;
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(rec.bestDay) || rec.bestDay.length < 4) rec.bestDay = [0, 0, 0, 0];
    if (!Array.isArray(rec.species) || rec.species.length < SPECIES.length) rec.species = emptySp();
    rec.spotSel = clamp(rec.spotSel | 0, 0, SPOTS.length - 1);
    if (!spotOwned(rec, rec.spotSel)) rec.spotSel = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const PENTA = [0, 2, 4, 7, 9, 12];
  const sfx = {
    cast: () => tone({ freq: 260, to: 780, dur: 0.2, type: 'sawtooth', vol: 0.02 }),
    plop: () => { tone({ freq: 520, to: 180, dur: 0.14, type: 'sine', vol: 0.09 }); },
    nibble: () => tone({ freq: 1200 + fxRng.next() * 300, to: 900, dur: 0.05, type: 'triangle', vol: 0.05 }),
    bite: () => { tone({ freq: 330, to: 660, dur: 0.12, type: 'square', vol: 0.05 }); tone({ freq: 660, dur: 0.18, type: 'sine', vol: 0.08 }); },
    hook: () => tone({ freq: 180, to: 360, dur: 0.16, type: 'triangle', vol: 0.1 }),
    run: () => tone({ freq: 110, to: 70, dur: 0.4, type: 'sawtooth', vol: 0.045 }),
    snap: () => { tone({ freq: 1500, to: 200, dur: 0.18, type: 'sawtooth', vol: 0.08 }); },
    swell: (h) => tone({ freq: 90, to: 48, dur: 0.9, type: 'triangle', vol: 0.03 + 0.04 * h }),
    fall: () => { tone({ freq: 300, to: 60, dur: 0.4, type: 'sine', vol: 0.14 }); tone({ freq: 120, to: 40, dur: 0.3, type: 'triangle', vol: 0.1 }); },
    tick: () => tone({ freq: 900, dur: 0.035, type: 'triangle', vol: 0.045 }),
    reel: (k) => tone({ freq: 700 + k * 500, dur: 0.025, type: 'square', vol: 0.014 }),
    land: (kg) => { const n = clamp(Math.round(2 + kg * 0.5), 2, 6); for (let i = 0; i < n; i++) tone({ freq: 440 * Math.pow(2, PENTA[i % 6] / 12), dur: 0.18 + i * 0.03, type: 'triangle', vol: 0.08 }); },
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };
  const banner = (text, sub, col = '#ffffff', max = 2.0) => { state.banner = { text, sub, col, t: 0, max }; };

  // ---- the world around a rig: visual time, particles, ripples -------------------------------------------------------------
  const advanceWS = (ws, dt) => {
    ws.t += dt; ws.frame++;
    if (ws.castAnim > 0) ws.castAnim = Math.max(0, ws.castAnim - dt);
    stepFx(ws.parts, dt);
    for (const r of ws.ripples) r.t += dt;
    for (let i = ws.ripples.length - 1; i >= 0; i--) if (ws.ripples[i].t >= ws.ripples[i].max) ws.ripples.splice(i, 1);
    if (ws.rel) { ws.rel.t += dt; if (ws.rel.t >= 1.2) { ws.ripples.push({ x: ws.rel.x, y: ws.rel.y, t: 0, max: 1.1, s: 1.3 }); ws.rel = null; } }
  };
  // Visual and audio consequences of rig events. g = scene geometry for the rect the rig is drawn in.
  const eventsFor = (ws, rig, g, loud) => {
    for (const e of rig.ev) {
      if (e.k === 'cast') { ws.castAnim = 0.35; if (loud) sfx.cast(); }
      else if (e.k === 'plop') {
        const x = g.fx(e.x), y = g.sy + 2;
        splash(ws.parts, fxRng, x, y, 8, 0.6); ws.ripples.push({ x, y, t: 0, max: 1.3, s: 1 });
        if (loud) sfx.plop();
      } else if (e.k === 'nibble') { if (loud) sfx.nibble(); }
      else if (e.k === 'bite') { if (loud) sfx.bite(); }
      else if (e.k === 'hook') { if (loud) sfx.hook(); }
      else if (e.k === 'run') { if (loud) sfx.run(); }
      else if (e.k === 'snap') { if (loud) sfx.snap(); }
      else if (e.k === 'swell') { if (loud) { sfx.swell(e.h); if (e.h > 0.8) state.shake = Math.max(state.shake, 0.12); } splash(ws.parts, fxRng, g.poleX + 8, g.sy, Math.round(5 + e.h * 8), 0.7); }
      else if (e.k === 'fall') {
        splash(ws.parts, fxRng, g.poleX + e.side * 30 * g.k, g.sy, 22, 1.4); ws.ripples.push({ x: g.poleX + e.side * 30 * g.k, y: g.sy + 3, t: 0, max: 1.6, s: 1.6 });
        bubbles(ws.parts, fxRng, g.poleX + e.side * 30 * g.k, g.sy + 30, 8);
        if (loud) { sfx.fall(); state.shake = 0.3; }
      } else if (e.k === 'land') {
        ws.rel = { sp: e.catch.sp, cm: e.catch.cm, t: 0, x: g.poleX + 92 * g.k, y: g.sy + 4 };
        splash(ws.parts, fxRng, g.poleX + 26 * g.k, g.sy, 10, 0.8);
      }
    }
  };

  // ---- the title-screen demo: the game playing itself ------------------------------------------------------------------------------
  const makeRngs = (a) => ({ wave: a.fork(), fish: a.fork(), bite: a.fork(), fight: a.fork() });
  const newAttract = () => {
    const spot = ATT_SPOTS[state.attN++ % ATT_SPOTS.length];
    const rig = makeRig(spot, makeRngs(attRng), { free: true });
    state.att = newWS(rig);
  };
  const attractGeom = () => sceneGeom({ x: 0, y: 0, w: meta.width, h: meta.height });
  const updateAttract = (dt) => {
    if (!state.att) newAttract();
    const ws = state.att, rig = ws.rig;
    if (rig.bait && rig.bait.state === 'waiting' && rig.bait.t > 6) rig.bait = null;
    if (!rig.bait && !rig.fight && !rig.fell) {
      const w = castWindow(rig), tg = chooseTarget(rig);
      if (w.ok && tg) cast(rig, tg.x, tg.d);
    }
    step(rig, dt, { lean: autoLean(rig), reel: autoReel(rig) });
    eventsFor(ws, rig, attractGeom(), false);
    rig.ev.length = 0;
    advanceWS(ws, dt);
    if (rig.t > 260) newAttract();
  };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  const startRun = (mode) => {
    const rec = state.record;
    if (state.demo && mode !== 'watch' && rec.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const spot = mode === 'daily' ? state.day % SPOTS.length : rec.spotSel;
    const rngs = mode === 'daily' ? makeRngs(seeded(state.day * 7919 + 17)) : makeRngs(runRng);
    const rig = makeRig(spot, rngs, { free: mode === 'free', fishCount: 9 });
    state.run = { mode, rig, hints: 0, unlocks: [], spot, done: false };
    state.ws = newWS(rig);
    state.ctl = { lean: 0, reel: false }; state.padDown = false; state.hintOn = false; state.hintAdv = null; state.dec = null;
    state.banner = null; state.land = null; state.scoreShown = 0; state.hold = 0.35; state.cueT = 12;
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.last = null;
    if (state.demo && mode !== 'watch') { rec.demoRuns++; save(); }
    toast(mode === 'watch' ? 'Watch & Learn: the game thinks before every cast' : 'Slide the pad to keep your seat, tap the water to cast', 3.4);
  };
  const ownedSnapshot = () => SPOTS.map((_, i) => spotOwned(state.record, i));
  const onLand = (e) => {
    const run = state.run, rig = run.rig, rec = state.record, c = e.catch;
    const practice = run.hints > 0 || run.mode === 'watch';
    let first = false;
    if (!practice) {
      const before = ownedSnapshot();
      const sp = rec.species[c.sp];
      first = sp.n === 0;
      sp.n++; if (c.kg > sp.best) sp.best = Math.round(c.kg * 100) / 100;
      rec.kg = Math.round((rec.kg + c.kg) * 100) / 100; rec.fish++;
      const unl = SPOTS.filter((s, i) => !before[i] && spotOwned(rec, i)).map((s) => s.name);
      if (unl.length) { run.unlocks = run.unlocks.concat(unl); toast(`Opened: ${unl.join(', ')}`, 3.4); }
      save();
    }
    state.land = { catch: c, first, t: 0, max: 2.8 };
    state.scoreShown = pointsOf(rig);
    sfx.land(c.kg);
    if (first) sfx.win();
  };
  const handleEvents = (rig, ws, g) => {
    for (const e of rig.ev) {
      if (e.k === 'land') onLand(e);
      else if (e.k === 'snap') banner('Snap!', 'the line parted · the fish swims free', '#ff9a7a');
      else if (e.k === 'fall') { banner('Splash!', 'climbing back on the bar', '#9fd8ff'); state.hold = 0; }
      else if (e.k === 'missed') toast('It spat the bait. Press the pad as soon as the float dives.', 2.8);
      else if (e.k === 'lost' && e.why === 'fall') toast('The fish got away.', 2);
      else if (e.k === 'nibble' && !state.hintOn) toast('A nibble. Wait for the float to dive.', 1.6);
      else if (e.k === 'end') finishRun();
    }
    eventsFor(ws, rig, g, true);
    rig.ev.length = 0;
  };
  const finishRun = () => {
    const run = state.run, rig = run.rig, rec = state.record, mode = run.mode;
    if (run.done) return;
    run.done = true;
    const points = pointsOf(rig), steady = rig.falls === 0 && rig.count > 0;
    const r = { mode, points, kg: rig.kg, count: rig.count, falls: rig.falls, steady, bonus: steady ? BONUS_STEADY : 0, catches: rig.catches.slice(), best: rig.best, hints: run.hints, newBest: false, unlocks: run.unlocks, spot: run.spot };
    if (mode === 'day' || mode === 'daily') {
      if (!run.hints) {
        if (mode === 'day' && points > rec.bestDay[run.spot]) { rec.bestDay[run.spot] = points; r.newBest = points > 0; }
        if (mode === 'daily') { if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; } if (points > rec.bestDaily) { rec.bestDaily = points; r.newBest = points > 0; } }
        rec.falls += rig.falls;
        save();
      }
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.rev++;
    state.dec = null; state.hintOn = false; state.padDown = false;
    if (r.newBest) sfx.win();
  };

  // ---- Watch & Learn: THINK -> REVEAL -> ACT --------------------------------------------------------------------------------
  const watchDecide = (dt) => {
    const run = state.run, rig = run.rig;
    if (rig.ended) return;
    if (rig.bait && !rig.fight && rig.bait.state === 'waiting' && rig.bait.t > 8) rig.bait = null;
    if (rig.bait || rig.fight || rig.fell) { state.dec = null; rig.clockOn = true; return; }
    if (!state.dec) state.dec = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], fishId: 0 };
    const d = state.dec;
    d.t += dt;
    if (d.phase === 'think') {
      rig.clockOn = false;
      if (d.t >= d.dur) {
        const tg = chooseTarget(rig);
        if (tg) { d.phase = 'reveal'; d.t = 0; d.dur = 2; d.fishId = tg.id; } else d.t = d.dur - 0.5;
      }
    } else if (d.phase === 'reveal') {
      rig.clockOn = false;
      if (!fishById(rig, d.fishId)) { d.phase = 'think'; d.t = 0; d.dur = 1; return; }
      if (d.t >= d.dur) { d.phase = 'act'; d.t = 0; rig.clockOn = true; }
    } else {
      rig.clockOn = true;
      const f = fishById(rig, d.fishId), w = castWindow(rig);
      if (!f || f.wary > 0.5) { const tg = chooseTarget(rig); if (tg) d.fishId = tg.id; return; }
      if (w.ok && f.x > 0.14) { cast(rig, f.x, f.d); state.dec = null; }
    }
  };

  // ---- pause ------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.padDown = false; state.ctl.reel = false; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRun = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hintOn = false; state.dec = null; state.padDown = false; state.rev++; };
  const requestThink = () => {
    const run = state.run;
    if (!run || state.paused || run.mode === 'watch') return;
    state.hintOn = !state.hintOn;
    if (state.hintOn && run.mode !== 'free' && run.hints === 0) run.hints = 1;
    sfx.tick();
  };

  // ---- the play scene --------------------------------------------------------------------------------------------------------
  const scrollFlow = (ptr) => {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  };
  const leanFromX = (L, x) => {
    const t = padTrack(L.pad);
    let v = (clamp((x - t.x) / t.w, 0, 1) - 0.5) * 2;
    if (Math.abs(v) < 0.04) v = 0;
    return v;
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
    const run = state.run, ptr = input.pointer, keys = input.keys, watch = run.mode === 'watch', rig = run.rig;
    const L = layoutOf(state), ctl = state.ctl;
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    const g = sceneGeom(L.stage);
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
    } else if (!state.shotAI) {
      if (ptr.pressed) {
        if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(L.think, ptr.x, ptr.y)) requestThink();
        else if (inRect(L.pad, ptr.x, ptr.y)) { state.padDown = true; ctl.lean = leanFromX(L, ptr.x); ctl.reel = true; state.cueT = 0; }
        else if (inRect(L.stage, ptr.x, ptr.y) && state.hold <= 0) {
          if (ptr.y > g.sy - 8 && !rig.fight && !rig.fell && !(rig.bait && rig.bait.state === 'bite')) {
            if (cast(rig, g.wx(ptr.x), g.wd(ptr.y))) { state.cueT = 0; state.hintAdv = null; }
          }
        }
      }
      if (state.padDown) {
        if (ptr.down) { ctl.lean = leanFromX(L, ptr.x); ctl.reel = true; }
        if (ptr.released || !ptr.down) { state.padDown = false; ctl.reel = false; }
      }
      // keyboard for the web demo
      let kd = 0;
      if (keys.down.has('ArrowLeft') || keys.down.has('KeyA')) kd -= 1;
      if (keys.down.has('ArrowRight') || keys.down.has('KeyD')) kd += 1;
      if (kd) ctl.lean = clamp(ctl.lean + kd * 2.6 * dt, -1, 1);
      if (keys.down.has('Space')) ctl.reel = true; else if (!state.padDown) ctl.reel = false;
      if (keys.pressed.has('KeyH')) requestThink();
    }
    if (state.paused) return;
    // ---- time passes
    if (state.hold > 0) state.hold = Math.max(0, state.hold - dt);
    const drive = watch || state.shotAI;
    if (watch) watchDecide(dt);
    if (drive) {
      ctl.lean = autoLean(rig); ctl.reel = autoReel(rig);
      if (state.shotAI && !rig.bait && !rig.fight && !rig.fell) { const w = castWindow(rig), tg = chooseTarget(rig); if (w.ok && tg) cast(rig, tg.x, tg.d); }
    }
    if (state.hold <= 0) step(rig, dt, { lean: ctl.lean, reel: ctl.reel });
    handleEvents(rig, state.ws, g);
    if (state.scene !== 'play') return;
    if (state.hintOn) state.hintAdv = advise(rig);
    advanceWS(state.ws, dt);
    if (rig.fight && (state.ws.frame % 6) === 0) sfx.reel(rig.fight.T);
    if (state.land === null) state.scoreShown = pointsOf(rig);
    if (state.land) { state.land.t += dt; if (state.land.t >= state.land.max) state.land = null; }
    if (state.toastT > 0) state.toastT -= dt;
    if (state.cueT > 0) state.cueT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.6);
  };

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'day' || id === 'daily' || id === 'free' || id === 'watch') startRun(id);
    else if (id === 'logbook') { state.collBack = 'title'; state.collSel = null; state.scene = 'logbook'; state.ui.scroll = 0; state.rev++; }
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
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; state.rev++; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; state.rev++; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.rev++; save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.last;
    if (id === 'again') startRun(r ? r.mode : 'day');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'logbook') { state.collBack = 'result'; state.collSel = null; state.scene = 'logbook'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) { Promise.resolve(env.share?.(`I landed ${r.kg.toFixed(1)} kg of fish from the stilt in one Stilt Fishing day in Arcforge!`)).catch(() => {}); }
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
  const updateLogbook = (dt, input) => {
    const ptr = input.pointer, rec = state.record;
    ensureLayout(state, 'logbook');
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10) {
        const h = collectionHit(ptr.x, ptr.y);
        if (h) {
          const same = state.collSel && state.collSel.kind === h.kind && state.collSel.i === h.i;
          if (h.kind === 'p' && same && spotOwned(rec, h.i) && rec.spotSel !== h.i) { rec.spotSel = h.i; save(); sfx.win(); } else sfx.tick();
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
  for (let i = 0; i < 60 * 8; i++) updateAttract(1 / 60);

  // Store screenshots (main.js calls this only for ?shot=1&scene=...): put the game in a named moment and run it forward.
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  const until = (cond, max = 60 * 90) => { for (let i = 0; i < max && !cond(); i++) advance(1); };
  // a shot holds still: the moment is kept (the run is paused, the picture is drawn every frame)
  const freeze = () => { state.shotAI = false; state.paused = true; };
  const shotScene = (name) => {
    const rec = state.record;
    rec.kg = 62; rec.fish = 61; rec.bestDay = [88, 112, 64, 0]; rec.bestDaily = 94; rec.dailyDay = state.day;
    rec.species.forEach((s, i) => { if (i < 7) { s.n = 3 + i; s.best = Math.round(SPECIES[i].kg[1] * 0.8 * 10) / 10; } });
    state.loaded = true; state.rev++;
    { const z = /[?&]zoom=(\d)/.exec(globalThis.location ? globalThis.location.search : ''); if (z) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, +z[1]); state.rev++; } }
    advance(10);
    if (name === 'title') { advance(240); return; }
    const begin = (spot, mode = 'day') => { rec.spotSel = spot; startRun(mode); state.toastT = 0; state.hold = 0; state.cueT = 0; state.shotAI = true; };
    if (name === 'cast') { begin(1); until(() => state.run.rig.bait && state.run.rig.bait.state === 'waiting'); state.hintOn = true; state.hintAdv = null; advance(2); freeze(); return; }
    if (name === 'bite') { begin(0); until(() => state.run.rig.bait && state.run.rig.bait.state === 'bite'); freeze(); return; }
    if (name === 'fight') { begin(2); until(() => state.run.rig.fight && state.run.rig.fight.r < 0.72 && state.run.rig.fight.phase === 'run'); freeze(); return; }
    if (name === 'land') { begin(1); until(() => state.land && state.land.t > 0.5); freeze(); return; }
    if (name === 'storm') { rec.kg = 100; begin(3); until(() => state.run.rig.fight && state.run.rig.fight.r < 0.8); freeze(); return; }
    if (name === 'logbook') { state.scene = 'logbook'; state.collBack = 'title'; state.collSel = { kind: 's', i: 4 }; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      const cs = [[1, 0.7, 30], [2, 1.4, 38], [4, 3.2, 58], [0, 0.1, 15], [3, 1.9, 44], [5, 4.8, 66], [2, 1.1, 36]].map(([sp, kg, cm]) => ({ sp, kg, cm, t: 0 }));
      state.last = { mode: 'day', points: 130, kg: 13.2, count: 7, falls: 0, steady: true, bonus: 25, catches: cs, best: cs[5], hints: 0, newBest: true, unlocks: [], spot: 1 };
      state.scene = 'result'; state.rev++; advance(3); return;
    }
    if (name === 'watch') {
      rec.spotSel = 0; state.settings.thinkIdx = 1;
      startRun('watch'); state.toastT = 0; state.hold = 0;
      until(() => state.dec && state.dec.phase === 'reveal' && state.dec.t > 0.8, 60 * 40);
      freeze(); return;
    }
    if (name === 'fall' || name === 'climb' || name === 'slip' || name === 'letgo') { begin(2); advance(40); state.run.rig.fell = { t: { fall: 0.42, climb: 3.2, slip: 0.2, letgo: 0.62 }[name], dur: 6, side: 1 }; freeze(); return; }
    if (name === 'pause') { begin(0); advance(30); state.shotAI = false; openPause(); advance(2); }
  };

  // The kit's "Preview m:ss" pill defaults to the top centre, which is the score block while playing. In a run it sits in the
  // bottom corner of the sea (above the pad, or at the bottom-left of the sea in landscape); on menus it sits top-left.
  const placePreviewBadge = () => {
    const k = Math.max(1, Math.min(globalThis.innerWidth || 720, globalThis.innerHeight || 720)) / 720;
    if (state.scene === 'play' && state.run) {
      const L = layoutOf(state), ph = Math.max(16, 11.5 / k) * 1.7;
      meta.previewBadge = L.land ? { x: 14, y: L.stage.y + L.stage.h - ph - 10, align: 'left' } : { x: W_() - 14, y: L.pad.y - ph - 12, align: 'right' };
    } else meta.previewBadge = { x: 14, y: (host.t || 0) + 6 / k, align: 'left' };
  };
  const W_ = () => meta.width;

  const api = {
    // Watch & Learn, the Logbook and every menu are free; only real play counts against the free preview (a paused run does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.run && state.run.mode !== 'watch') || state.paused || state.hold > 0,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'settings', 'result', 'demolimit', 'logbook'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      syncSize();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'logbook': updateLogbook(dt, input); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      placePreviewBadge();
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'logbook': renderLogbook(ctx, state); break;
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
  void rankFor; void DAY_SECS; void geomOf;
  return api;
}
