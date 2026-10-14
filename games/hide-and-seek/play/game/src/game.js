// Hide and Seek: state and flow. Rules live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (seek, hide, daily, watch), result, settings, howto/about/rules, demolimit.
import {
  PLACES, LEVELS, NSPOT, LPOS, makeWorld, stepWorld, lookAt, listen, canListen, canLook, pickSpot, sneak, adviseSeek, adviseHide, newAuto, autoStep,
  seeded, clamp, placeOwned, emptyMemory, stars,
} from './sim.js';
import { TEXT_SCALES, THINK_STEPS, meta, badge, syncSize, refLayout, inRect, sceneRect, spotAt } from './layout.js';
import { renderPlay, layoutOf } from './view.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, dailyPlace,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_RUNS = 3;
const END_DELAY = 1.9;           // seconds the finished round stays before the result

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), runRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, textIdx: 0, thinkIdx: 1 },
    record: { bestSeek: [0, 0, 0], bestHide: [0, 0, 0], bestDaily: 0, dailyDay: -1, found: 0, rounds: 0, hidWins: 0, placeSel: 0, level: 1, demoRuns: 0, mem: emptyMemory() },
    run: null, ws: null, simRng: null, hint: null, dec: null, pops: [], banner: null, toast: '', toastT: 0,
    vis: { from: -1, to: -1, a: 1, shake: Array(NSPOT).fill(0) }, sc: null, cur: -1,
    last: null, owned: false, restoreMsg: '', ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, hold: 0, endT: 0, attPlace: 0,
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
    for (const k of ['bestSeek', 'bestHide']) if (!Array.isArray(rec[k]) || rec[k].length < PLACES.length) rec[k] = [0, 0, 0];
    const m = rec.mem;
    if (!m || !Array.isArray(m.seekFirst) || m.seekFirst.length < PLACES.length || !Array.isArray(m.hideSpots) || m.hideSpots.length < PLACES.length) rec.mem = emptyMemory();
    rec.placeSel = clamp(rec.placeSel | 0, 0, PLACES.length - 1);
    rec.level = clamp(rec.level | 0, 0, LEVELS.length - 1);
    if (!placeOwned(rec, rec.placeSel)) rec.placeSel = 0;
    state.attPlace = rec.placeSel;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const NOTE = (n, base = 392) => base * Math.pow(2, n / 12);
  const sfx = {
    tick: () => tone({ freq: 900, dur: 0.035, type: 'triangle', vol: 0.045 }),
    count: () => tone({ freq: 330, dur: 0.06, type: 'triangle', vol: 0.05 }),
    go: () => { tone({ freq: NOTE(0), dur: 0.12, type: 'triangle', vol: 0.08 }); tone({ freq: NOTE(7), dur: 0.2, type: 'triangle', vol: 0.08 }); },
    step: () => tone({ freq: 140 + fxRng.next() * 40, to: 90, dur: 0.07, type: 'sine', vol: 0.05 }),
    found: (n) => [0, 4, 7].forEach((s, i) => tone({ freq: NOTE(s + Math.min(n, 4) * 2, 523), dur: 0.14 + i * 0.04, type: 'triangle', vol: 0.09 })),
    miss: () => tone({ freq: 220, to: 150, dur: 0.14, type: 'sine', vol: 0.06 }),
    giggle: () => [0, 4, 2, 7].forEach((s, i) => tone({ freq: NOTE(s, 880), dur: 0.07, type: 'sine', vol: 0.04 + i * 0.004 })),
    rustle: () => { tone({ freq: 1800 + fxRng.next() * 800, to: 700, dur: 0.1, type: 'sawtooth', vol: 0.03 }); tone({ freq: 2400, to: 900, dur: 0.14, type: 'triangle', vol: 0.025 }); },
    caught: () => { tone({ freq: 520, to: 180, dur: 0.4, type: 'triangle', vol: 0.09 }); tone({ freq: 260, to: 90, dur: 0.5, type: 'sawtooth', vol: 0.04 }); },
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: NOTE(n, 523), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };
  const pop = (text, spot, col = '#fff', size = 1) => { if (state.pops.length < 8) state.pops.push({ text, spot, col, size, t: 0, max: 1.1 }); };

  const stepFx = (dt) => {
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
    const v = state.vis;
    if (v.a < 1) v.a = Math.min(1, v.a + dt / 0.7);
    for (let i = 0; i < NSPOT; i++) if (v.shake[i] > 0) v.shake[i] = Math.max(0, v.shake[i] - dt / 0.5);
  };
  // where the seeker child should stand: -1 is home. Moves the visual only.
  const seekerTo = (spot) => {
    const v = state.vis;
    if (v.to === spot) return;
    v.from = v.to; v.to = spot; v.a = 0;
  };
  const resetVis = () => { state.vis = { from: -1, to: -1, a: 1, shake: Array(NSPOT).fill(0) }; };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  const startRun = (mode) => {
    const rec = state.record;
    if (state.demo && mode !== 'watch' && rec.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const daily = mode === 'daily', place = daily ? dailyPlace(state.day) : rec.placeSel, level = daily ? 1 : rec.level;
    const r = daily ? seeded(state.day * 977 + 5) : runRng;
    state.simRng = r;
    const role = mode === 'hide' ? 'hide' : 'seek';
    state.ws = makeWorld({ mode: role, place, level, rng: r, memory: daily ? null : rec.mem });
    state.run = { mode, role, place, level, hints: 0, before: PLACES.map((_, i) => placeOwned(rec, i)), pick: -1 };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.last = null;
    state.hint = null; state.dec = null; state.pops.length = 0; state.banner = null; state.endT = 0; state.hold = 0.4; state.cur = -1;
    resetVis();
    if (state.demo && mode !== 'watch') { rec.demoRuns++; save(); }
    if (mode === 'watch') state.dec = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], adv: null, why: '', ap: newAuto(), went: false };
    toast(mode === 'watch' ? 'Watch & Learn: the game thinks before every look' : role === 'hide' ? 'Tap a place to hide.' : 'The hiders are running. Look where you think they are.', 3.6);
    if (role === 'seek') sfx.count();
  };
  const topShare = (arr, minTotal = 3) => {
    let tot = 0, bi = 0; arr.forEach((v, i) => { tot += v; if (v > arr[bi]) bi = i; });
    return tot >= minTotal && arr[bi] / tot >= 0.4 ? bi : -1;
  };
  const decay = (arr) => { let tot = 0; arr.forEach((v) => { tot += v; }); if (tot > 40) for (let i = 0; i < arr.length; i++) arr[i] = Math.round(arr[i] / 2); };
  const finishRun = () => {
    const w = state.ws, run = state.run, rec = state.record, mode = run.mode;
    const r = {
      role: run.role, mode, place: run.place, level: run.level, total: w.score, win: w.win, hints: run.hints, newBest: false, unlocks: [],
      found: w.found, hiders: w.hiders.length, looks: w.looksUsed, kids: w.hiders.filter((h) => h.found).map((h) => h.kid),
      survived: w.win ? w.looksUsed : Math.max(0, w.looksUsed - 1), sneaks: w.me ? w.me.safe : 0, stars: stars(w), memo: '',
    };
    if (mode !== 'watch') {
      rec.rounds++;
      if (run.role === 'seek') rec.found += w.found; else if (w.win) rec.hidWins++;
      if (!run.hints) {
        if (mode === 'seek') { if (w.score > rec.bestSeek[run.place]) { rec.bestSeek[run.place] = w.score; r.newBest = w.score > 0; } }
        else if (mode === 'hide') { if (w.score > rec.bestHide[run.place]) { rec.bestHide[run.place] = w.score; r.newBest = w.score > 0; } }
        else if (mode === 'daily') {
          if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; }
          if (w.score > rec.bestDaily) { rec.bestDaily = w.score; r.newBest = w.score > 0; }
        }
      }
      if (mode !== 'daily') {
        const m = rec.mem;
        if (run.role === 'seek' && w.firstLook >= 0) { m.seekFirst[run.place][w.firstLook]++; decay(m.seekFirst[run.place]); }
        if (run.role === 'hide' && run.pick >= 0) { m.hideSpots[run.place][run.pick]++; decay(m.hideSpots[run.place]); }
        const arr = run.role === 'seek' ? m.seekFirst[run.place] : m.hideSpots[run.place], b = topShare(arr);
        if (b >= 0) r.memo = run.role === 'seek' ? `The hiders have noticed you look in the ${PLACES[run.place].spots[b].name} first.` : `The seeker has noticed you like the ${PLACES[run.place].spots[b].name}.`;
      }
      PLACES.forEach((p, i) => { if (!run.before[i] && placeOwned(rec, i)) r.unlocks.push(p.name); });
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.hint = null; state.dec = null; state.rev++;
    if (r.newBest || r.unlocks.length || r.win) sfx.win();
  };

  // react to what the sim reported this tick
  let foundN = 0;
  const handleEvents = () => {
    const w = state.ws, v = state.vis;
    for (const e of w.ev) {
      if (e.type === 'go') { sfx.go(); state.hint = null; foundN = 0; if (w.mode === 'seek') toast('Ready or not, here I come!', 2.2); }
      else if (e.type === 'look') {
        v.shake[e.spot] = 1; seekerTo(e.spot); state.hint = null;
        if (e.hit) { sfx.found(foundN++); pop('+100', e.spot, '#ffd97a', 1.15); }
        else { sfx.miss(); pop(LEVELS[w.level].counts ? (e.c === 0 ? 'cold' : e.c === 1 ? 'warm' : 'hot') : e.c > 0 ? 'warm' : 'cold', e.spot, e.c === 0 ? '#9fd4ff' : e.c === 1 ? '#ffd27a' : '#ff9a82', 0.8); }
      } else if (e.type === 'listen') { sfx.giggle(); toast('A giggle! Someone is in one of the marked places.', 2.6); state.hint = null; }
      else if (e.type === 'target') { sfx.step(); }
      else if (e.type === 'empty') { v.shake[e.spot] = 1; sfx.miss(); state.hint = null; }
      else if (e.type === 'caught') { v.shake[e.spot] = 1; sfx.caught(); state.banner = { text: 'Found you!', sub: 'The seeker was quick', col: '#ff9a7a', t: 0, max: END_DELAY }; }
      else if (e.type === 'arrive') { if (e.heard) { sfx.rustle(); pop('rustle!', e.spot, '#ffb09a', 0.8); } else pop('safe', e.spot, '#9be8b0', 0.8); }
      else if (e.type === 'end') {
        if (e.win) { sfx.win(); state.banner = { text: w.mode === 'hide' ? 'Not found!' : 'All found!', sub: `${w.score} points`, col: '#ffd97a', t: 0, max: END_DELAY }; }
        else if (w.mode === 'seek') state.banner = { text: 'Out of looks', sub: `${w.found} of ${w.hiders.length} found`, col: '#ff9a7a', t: 0, max: END_DELAY };
      }
    }
    w.ev.length = 0;
  };
  // keep the seeker child following the round
  const followSeeker = () => {
    const w = state.ws;
    if (w.mode === 'hide') {
      const k = w.sk;
      if (w.phase !== 'search' && w.phase !== 'over') seekerTo(-1);
      else if (k.phase === 'think') seekerTo(k.at);
      else seekerTo(k.target);
    } else if (w.phase === 'count') seekerTo(-1);
  };

  // ---- the Watch & Learn loop: THINK -> REVEAL -> ACT --------------------------------------------------------------------
  const updateWatch = (dt) => {
    const dec = state.dec, w = state.ws;
    if (!dec || w.over) return;
    if (w.phase !== 'search') return;
    dec.t += dt;
    const rethink = () => { dec.phase = 'think'; dec.t = 0; dec.dur = THINK_STEPS[state.settings.thinkIdx]; dec.went = false; };
    if (dec.phase === 'think') {
      if (dec.t >= dec.dur && !w.anim) {
        const adv = adviseSeek(w);
        if (!adv) return;
        dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; dec.adv = adv; dec.why = adv.why; state.hint = adv;
      }
    } else if (dec.phase === 'reveal') {
      if (dec.t >= dec.dur) { dec.phase = 'go'; dec.t = 0; dec.went = false; dec.ap.pref = dec.adv; dec.ap.cool = 0.1; state.hint = null; }
    } else if (dec.phase === 'go') {
      autoStep(w, dec.ap, state.simRng, dt);
      if (w.anim) dec.went = true;
      if (dec.went && !w.anim) rethink();
      else if (dec.t > 6 && !w.anim) rethink();
    }
  };

  // ---- hint -------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const run = state.run;
    if (!run || state.paused || run.mode === 'watch' || state.ws.over) return;
    if (state.hint) { state.hint = null; sfx.tick(); return; }
    const w = state.ws;
    if (w.mode === 'seek' && w.phase !== 'search') return;
    const adv = w.mode === 'hide' ? adviseHide(w) : adviseSeek(w);
    if (!adv) return;
    state.hint = adv; run.hints++;
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
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
    else if (id === 'quit') leaveRun();
  }
  // a tap on a spot: look (seek), hide (pick) or sneak (hide)
  const spotTap = (s) => {
    const w = state.ws, run = state.run;
    if (s < 0) return;
    if (w.mode === 'seek') {
      if (lookAt(w, s)) { seekerTo(s); state.hint = null; sfx.step(); }
      else if (w.phase === 'search' && w.looked[s] !== 0) toast('Already looked there.', 1.2);
    } else if (w.phase === 'pick') {
      if (pickSpot(w, s)) { run.pick = s; state.hint = null; sfx.tick(); toast('Shh. Stay quiet.', 1.6); }
    } else if (w.phase === 'search') {
      if (w.me.spot === s) return;
      if (sneak(w, s)) { state.hint = null; sfx.step(); } else if (w.sk.target === s) toast('The seeker is going there.', 1.2);
    }
  };
  const cursorMove = (dx, dy) => {
    const w = state.ws, cur = state.cur < 0 ? (w.mode === 'hide' && w.me.spot >= 0 ? w.me.spot : 4) : state.cur;
    let best = -1, bd = 1e9;
    for (let i = 0; i < NSPOT; i++) {
      if (i === cur) continue;
      const ux = (LPOS[i][0] - LPOS[cur][0]) * 1.6, uy = (LPOS[i][1] - LPOS[cur][1]) * 1.0;
      const along = ux * dx + uy * dy; if (along <= 0.01) continue;
      const d = along + 1.6 * Math.abs(ux * dy - uy * dx);
      if (d < bd) { bd = d; best = i; }
    }
    if (state.cur < 0) state.cur = cur; else if (best >= 0) state.cur = best;
  };
  const updatePlay = (dt, input) => {
    const run = state.run, w = state.ws, ptr = input.pointer, keys = input.keys, watch = run.mode === 'watch';
    const L = layoutOf(state);
    state.sc = sceneRect(L.stage);
    badge.z = Math.min(1.6, TEXT_SCALES[state.settings.textIdx] || 1); badge.watch = watch;
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
    } else if (!w.over && !state.paused) {
      if (ptr.pressed) {
        if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(L.think, ptr.x, ptr.y)) requestThink();
        else if (w.mode === 'seek' && inRect(L.listen, ptr.x, ptr.y)) { if (canListen(w) && state.hold <= 0) { listen(w, state.simRng); state.hint = null; sfx.tick(); } }
        else if (state.hold <= 0 && inRect(L.stage, ptr.x, ptr.y)) { state.cur = -1; spotTap(spotAt(state.sc, ptr.x, ptr.y)); }
      }
      if (keys.pressed.has('ArrowRight') || keys.pressed.has('KeyD')) cursorMove(1, 0);
      if (keys.pressed.has('ArrowLeft') || keys.pressed.has('KeyA')) cursorMove(-1, 0);
      if (keys.pressed.has('ArrowDown') || keys.pressed.has('KeyS')) cursorMove(0, 1);
      if (keys.pressed.has('ArrowUp') || keys.pressed.has('KeyW')) cursorMove(0, -1);
      if ((keys.pressed.has('Space') || keys.pressed.has('Enter')) && state.cur >= 0 && state.hold <= 0) spotTap(state.cur);
      for (let i = 0; i < NSPOT; i++) if (keys.pressed.has(`Digit${i + 1}`) && state.hold <= 0) { state.cur = i; spotTap(i); }
      if (keys.pressed.has('KeyL') && w.mode === 'seek' && canListen(w) && state.hold <= 0) { listen(w, state.simRng); state.hint = null; sfx.tick(); }
      if (keys.pressed.has('KeyH')) requestThink();
    }
    if (state.paused) return;
    // ---- time passes
    if (state.hold > 0) state.hold = Math.max(0, state.hold - dt);
    if (watch) updateWatch(dt);
    stepWorld(w, dt, state.simRng);
    if (w.mode === 'seek' && w.anim && w.anim.type === 'look') seekerTo(w.anim.spot);
    if (w.phase === 'count' && w.mode === 'seek' && Math.floor(w.phaseT * 6) !== Math.floor((w.phaseT - dt) * 6) && Math.floor(w.phaseT * 6) % 2 === 0) sfx.count();
    handleEvents();
    followSeeker();
    stepFx(dt);
    if (w.over) {
      if (state.endT === 0 && !state.banner) state.banner = { text: w.win ? 'Done!' : 'Round over', sub: `${w.score} points`, col: '#ffd97a', t: 0, max: END_DELAY };
      state.endT += dt;
      if (state.endT >= END_DELAY) finishRun();
    }
  };

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    const rec = state.record;
    if (id === 'seek' || id === 'hide' || id === 'daily' || id === 'watch') startRun(id);
    else if (id === 'place') { let n = rec.placeSel; for (let i = 0; i < PLACES.length; i++) { n = (n + 1) % PLACES.length; if (placeOwned(rec, n)) break; } rec.placeSel = n; state.attPlace = n; save(); state.rev++; }
    else if (id === 'level') { rec.level = (rec.level + 1) % LEVELS.length; save(); state.rev++; }
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
      if (state.restoreMsg === 'Checking with the store…') return;
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; state.rev++; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; state.rev++; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.rev++; save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.last;
    if (id === 'again') startRun(r ? r.mode : 'seek');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) {
      const txt = r.role === 'seek' ? `I found ${r.found} of ${r.hiders} hiders in ${r.looks} looks in Hide and Seek in Arcforge!` : `The seeker ${r.win ? 'never found me' : 'found me'} after ${r.survived} looks in Hide and Seek in Arcforge!`;
      Promise.resolve(env.share?.(txt)).catch(() => {});
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

  // Store screenshots (main.js calls this only for ?shot=1&scene=...): put the game in a named moment and run it forward.
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  const shotScene = (name) => {
    const rec = state.record;
    rec.bestSeek = [320, 180, 0]; rec.bestHide = [140, 90, 0]; rec.bestDaily = 260; rec.dailyDay = state.day; rec.found = 40; rec.rounds = 22; rec.hidWins = 6;
    state.loaded = true; state.rev++;
    advance(10);
    const start = (mode, place, level) => { rec.placeSel = place; rec.level = level; state.attPlace = place; startRun(mode); state.toastT = 0; state.hold = 0; };
    const seekPlay = (place, level, picks) => {
      start('seek', place, level); advance(60 * 3);
      const w = state.ws;
      for (const s of picks) { if (!canLook(w, s)) continue; lookAt(w, s); advance(60); }
    };
    if (name === 'title') { advance(200); return; }
    if (name === 'play' || name === 'think' || name === 'found') {
      seekPlay(0, 1, [3, 0, 6]);
      if (name === 'think') { requestThink(); }
      if (name === 'found') {
        const w = state.ws, h = w.hiders.find((q) => !q.found);
        if (h && canLook(w, h.spot)) { lookAt(w, h.spot); advance(48); }
      }
      return;
    }
    if (name === 'places') { seekPlay(1, 1, [3, 4]); return; }
    if (name === 'hide') {
      start('hide', 2, 1); advance(5);
      pickSpot(state.ws, 1); state.run.pick = 1; advance(60 * 3 + 40);
      return;
    }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      state.last = { role: 'seek', mode: 'seek', place: 0, level: 1, total: 365, win: true, hints: 0, newBest: true, unlocks: [], found: 3, hiders: 3, looks: 4, kids: [0, 1, 2], survived: 0, sneaks: 0, stars: 3, memo: 'The hiders have noticed you look in the Fountain first.' };
      state.scene = 'result'; state.rev++; advance(3); return;
    }
    if (name === 'watch') {
      rec.placeSel = 0; state.settings.thinkIdx = 0;
      start('watch', 0, 1);
      for (let i = 0; i < 60 * 30 && !(state.dec && state.dec.phase === 'reveal' && state.dec.t > 0.8); i++) advance(1);
      return;
    }
    if (name === 'pause') { start('seek', 0, 1); openPause(); advance(2); }
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
      { const o = !!monetization.owns?.('unlock_game'); if (o !== state.owned) { state.owned = o; state.rev++; } }
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
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
    render(ctx) {
      syncSize();
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.run) renderPlay(ctx, state, null);
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
