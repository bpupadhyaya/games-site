// Luge and Toboggan Run, the game shell. Scenes, input, persistence, preview wiring, Watch & Learn. The run lives in sim.js, the physics in physics.js.
import { createSim, DT, PUSH_T, LEVELS } from './sim.js';
import { createPilot } from './pilot.js';
import { buildTrack, TRACK_LIST, nrefAt } from './track.js';
import { newBody, stepBody } from './physics.js';
import { createRng } from '../kit/rng.js';
import { SW, H, OX, PANEL, hudLayout, TEXT_SCALES, THINK_STEPS, REF_CLOSE, TEXT_DEC, TEXT_INC, SETUP_PINS, inRect, setScreen, column } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import * as MN from './menus.js';
import { READER, pageViewH } from './menus.js';
import { renderHud, renderBackdrop, hit as hudHit, CARD, fmtTime } from './hud.js';
import { clamp } from './util.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_RUNS = 3;

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, line: false },
    setup: { mode: 'cup', track: 'village', level: 2, lastMode: 'cup' },
    ui: { scroll: 0, drag: null, cardScroll: 0 }, page: 0, back: 'title', setupMsg: '', restoreMsg: '', restoreBusy: false, owned: !!env.monetization?.owns?.('unlock_game'),
    record: { demoRuns: 0, best: {}, ghost: {}, bestCup: {}, runs: 0, daily: {} },
    sim: null, paused: false, pauseMenu: false, think: null, feedback: null, fx: [], flash: 0,
    watch: { phase: 'think', timer: 0, paused: false, holdId: '', wait: 0 }, thinkTotal: 5,
    t: 0, lean: { x0: null, u: 0 }, attr: null,
  };
  G.suggest = () => (S ? S.suggest() : null);
  Object.defineProperty(G, 'cam', { value: { nc: 0, roll: 0 }, writable: true, enumerable: false });
  Object.defineProperty(G, 'out', { value: null, writable: true, enumerable: false });   // where the sled is on screen: picture-only, never part of the state
  const signCache = new Map(), lineCache = new Map();
  G.signsFor = (T) => { let v = signCache.get(T.id); if (!v) { v = T.curves.map((c) => ({ s: c.s0 - 12, n: c.n, dir: c.dir })); signCache.set(T.id, v); } return v; };
  G.linesFor = (T) => { let v = lineCache.get(T.id); if (!v) { v = [{ s: T.S0, label: 'START' }, { s: T.L, arch: true, label: 'FINISH' }]; lineCache.set(T.id, v); } return v; };

  let S = null, pilot = null, evSeen = 0, windT = 0, spray = 0;
  const simRng = rng.fork(), attrRng = rng.fork();

  // ---- attract: the chute rolls behind the menus ---------------------------------------------------------
  let attrBody = null, attrT = null, attrPilot = null;
  function stepAttract(dt) {
    const a = G.attr; if (!a) return;
    stepBody(attrBody, attrT, attrPilot(attrBody, attrT), dt, null);
    a.s = attrBody.s; a.n = attrBody.n; a.vn = attrBody.vn; a.v = attrBody.v; a.u = attrBody.u;
    if (attrBody.s > attrT.L - 30) newAttractFor(a.next);
  }
  function newAttractFor(id) {
    attrT = buildTrack(id); attrBody = newBody(21); attrBody.s = 14;
    attrPilot = createPilot(attrRng.fork(), 0.96);
    G.attr = { track: id, s: attrBody.s, n: 0, vn: 0, v: attrBody.v, u: 0, next: TRACK_LIST[(TRACK_LIST.findIndex((t) => t.id === id) + 1) % TRACK_LIST.length].id };
  }
  newAttractFor('alpine');

  // ---- persistence -------------------------------------------------------------------------------
  const saveAll = () => { storage.set('settings', G.settings); storage.set('record', G.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(G.settings, s);
    if (r) Object.assign(G.record, r);
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.loaded = true;
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    pull: (q) => tone({ freq: 300 + q * 260, to: 200 + q * 160, dur: 0.12, type: 'square', vol: q ? 0.05 : 0.02 }),
    go: () => { tone({ freq: 440, dur: 0.12, type: 'square', vol: 0.05 }); tone({ freq: 660, dur: 0.2, type: 'square', vol: 0.05 }); },
    wind: (v) => tone({ freq: 70 + v * 3.2, to: 60 + v * 2.4, dur: 0.3, type: 'sawtooth', vol: 0.010 + v * 0.00035 }),
    scrape: (sev) => { tone({ freq: 900 + sev * 140, to: 300, dur: 0.22, type: 'sawtooth', vol: 0.05 }); tone({ freq: 110, to: 60, dur: 0.18, type: 'sine', vol: 0.16 }); },
    good: (n) => [0, 4, 7, 12].slice(0, n).forEach((s, i) => tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.16 + i * 0.03, type: 'triangle', vol: 0.08 })),
    horn: () => { tone({ freq: 330, dur: 0.5, type: 'sawtooth', vol: 0.04 }); tone({ freq: 440, dur: 0.5, type: 'sawtooth', vol: 0.04 }); },
    cheer: () => { tone({ freq: 300, to: 520, dur: 0.6, type: 'sawtooth', vol: 0.012 }); tone({ freq: 380, to: 640, dur: 0.6, type: 'sawtooth', vol: 0.012 }); },
  };

  // haptics through the native bridge (a no-op in browsers); only for the player's own runs
  const buzz = (kind) => { if (G.mode === 'watch' || G.mode === 'shot') return; try { globalThis.__haptic?.(kind); } catch { /* no haptics here */ } };

  // ---- lifecycle -----------------------------------------------------------------------------------
  function startRun(kind) {
    const st = G.setup;
    const ghostRec = G.record.ghost[st.track];
    const opts = { track: st.track, level: st.level, mode: kind, day: config.day || 0, hold: kind === 'watch' };
    if (kind === 'daily') opts.track = 'alpine';
    if (kind !== 'watch' && G.record.ghost[opts.track]) { const g = G.record.ghost[opts.track]; opts.ghost = { s: g.s, n: g.n }; opts.bestSplits = g.sp; }
    let r = simRng.fork();
    if (kind === 'daily') r = createRng(7919 * (config.day || 0) + 13);
    S = createSim(opts, r); G.sim = S.s;
    evSeen = 0; windT = 0; spray = 0;
    pilot = kind === 'watch' ? createPilot(simRng.fork(), 0.93) : null;
    G.mode = kind; G.setup.lastMode = kind;
    G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.think = null; G.feedback = null; G.ui.scroll = 0; G.ui.cardScroll = 0; G.fx = [];
    G.watch = { phase: 'think', timer: 0, paused: false, holdId: '', wait: 0 };
    G.lean = { x0: null, u: 0 };
  }
  const leaveRun = () => { G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; S = null; pilot = null; G.sim = null; G.fx = []; };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; MN.ensureLayout(G, '-'); };
  
  // ---- sim events: sound, feedback, saving ------------------------------------------------------------
  function processEvents() {
    const s = S.s;
    for (const e of s.events) {
      if (e.id <= evSeen) continue;
      evSeen = e.id;
      const mine = G.mode !== 'watch' && G.mode !== 'shot';
      if (e.type === 'go') { sfx.go(); buzz('tap'); }
      else if (e.type === 'pull') sfx.pull(e.q);
      else if (e.type === 'launch') { G.flash = 0.6; G.feedback = { t: 0, text: e.q > 3.6 ? 'PERFECT START' : e.q > 2.2 ? 'GOOD START' : 'LAUNCH', col: '#ffd25a' }; sfx.go(); buzz('good'); }
      else if (e.type === 'wall') {
        sfx.scrape(e.sev); buzz('bad'); G.feedback = { t: s.t, text: 'WALL', col: '#ff9a86' };
        const o = G.out;
        if (o) for (let i = 0; i < 16; i++) G.fx.push({ x: o.x, y: o.y - o.k * 0.2, vx: (e.n * -1 + (i % 5 - 2) * 0.35) * (60 + i * 6), vy: -50 - (i % 4) * 36, life: 0.5 + (i % 3) * 0.12, max: 0.8, r: 3 + (i % 3), col: i % 2 ? '#ffffff' : '#cfe9f6' });
      } else if (e.type === 'curve') {
        if (e.perfect) { G.feedback = { t: s.t, text: 'PERFECT LINE', col: '#ffd25a' }; sfx.good(3); buzz('good'); }
        else if (e.clean) { G.feedback = { t: s.t, text: 'CLEAN', col: '#7fe3a0' }; sfx.good(2); }
      } else if (e.type === 'split') {
        if (e.delta != null) G.feedback = { t: s.t, text: e.delta <= 0 ? `${fmtTime(Math.abs(e.delta))} UP` : `${fmtTime(e.delta)} BEHIND`, col: e.delta <= 0 ? '#7fe3a0' : '#ff9a86' };
      } else if (e.type === 'finish') {
        sfx.horn(); sfx.cheer(); buzz('win');
        if (mine) noteFinish(s);
      } else if (e.type === 'end') { if (mine) noteEnd(s); }
    }
    if (s.ph === 'run') {
      windT += DT;
      if (windT > 0.28) { windT = 0; sfx.wind(s.v); }
    }
  }
  function noteFinish(s) {
    const r = G.record, id = s.track, t = s.res.time;
    r.runs = (r.runs || 0) + 1;
    if (!r.best[id] || t < r.best[id]) {
      r.best[id] = t;
      r.ghost[id] = { s: s.res.rec.s.slice(), n: s.res.rec.n.slice(), sp: [s.res.splits[0], s.res.splits[1]] };
    }
    if (demo) r.demoRuns++;
    saveAll();
  }
  function noteEnd(s) {
    if (s.mode !== 'cup') return;
    const total = s.you.times.reduce((a, b) => a + b, 0), r = G.record, key = `${s.track}:${s.level}`;
    const me = s.standings.find((x) => x.you);
    r.bestCup = r.bestCup || {};
    if (!r.bestCup[key] || total < r.bestCup[key].time) r.bestCup[key] = { time: total, rank: me ? me.rank : 8 };
    saveAll();
    if (me && me.rank <= 3) sfx.good(4);
  }

  // ---- scrolling ---------------------------------------------------------------------------------------
  function scrollInput(input, max, view, key = 'scroll') {
    const k = input.keys;
    let sc = G.ui[key] || 0;
    if (G.wheelAcc) { sc += G.wheelAcc * 1.1; G.wheelAcc = 0; }
    if (k.down.has('ArrowDown')) sc += 16;
    if (k.down.has('ArrowUp')) sc -= 16;
    const page = Math.max(80, view - 70);
    if (k.pressed.has('PageDown') || (k.pressed.has('Space') && !k.down.has('ShiftLeft') && !k.down.has('ShiftRight'))) sc += page;
    if (k.pressed.has('PageUp') || (k.pressed.has('Space') && (k.down.has('ShiftLeft') || k.down.has('ShiftRight')))) sc -= page;
    if (k.pressed.has('Home')) sc = 0;
    if (k.pressed.has('End')) sc = max;
    G.ui[key] = clamp(sc, 0, max);
  }
  function cardInput(input) {
    const ptr = input.pointer, R = CARD.rect;
    if (ptr.pressed && R && ptr.x >= R.x && ptr.x <= R.x + R.w + 24 && ptr.y >= R.y && ptr.y <= R.y + R.h) G.ui.cardDrag = { y0: ptr.y, s0: G.ui.cardScroll || 0 };
    if (G.ui.cardDrag && ptr.down) G.ui.cardScroll = clamp(G.ui.cardDrag.s0 - (ptr.y - G.ui.cardDrag.y0), 0, CARD.max);
    if (ptr.released) G.ui.cardDrag = null;
  }
  function scrollFlow(ptr) {
    const d = G.ui.drag, mt = MN.flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); G.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  }
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) MN.ensureLayout(G, key);
    if (ptr.pressed) G.ui.drag = { y0: ptr.y, x0: ptr.x, s0: G.ui.scroll, moved: 0 };
    if (G.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && G.ui.drag) {
      const d = G.ui.drag; G.ui.drag = null;
      const lay = MN.flowMeta();
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(MN.hitScreen(ptr.x, ptr.y, G.ui.scroll));
      else if (!scrollable) handler(MN.hitScreen(d.x0, d.y0, G.ui.scroll));
    }
    const mt = MN.flowMeta();
    const max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); saveAll(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); saveAll(); }
    scrollInput(input, max, mt.bottom - mt.top);
  };

  // ---- menu handlers -----------------------------------------------------------------------------------
  const demoCapped = () => demo && G.record.demoRuns >= DEMO_RUNS;
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'cup') { G.setup.mode = 'cup'; go('setup'); G.setupMsg = ''; }
    else if (id === 'trial') { G.setup.mode = 'trial'; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { G.setup.mode = 'watch'; go('setup'); G.setupMsg = ''; }
    else if (id === 'daily') { if (demoCapped()) go('demolimit'); else startRun('daily'); }
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); }
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('trk-')) st.track = id.slice(4);
    else if (id.startsWith('lv')) st.level = +id.slice(2);
    else if (id === 'start') { if (demoCapped() && st.mode !== 'watch') go('demolimit'); else startRun(st.mode); }
    else if (id === 'back') go('title');
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-line') st.line = !st.line;
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); G.ui.scroll = 0; }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); G.ui.scroll = 0; }
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore' && !G.restoreBusy && !G.owned) {
      G.restoreBusy = true; G.restoreMsg = 'Checking with the store...';
      Promise.resolve(env.monetization.restore()).then(() => {
        G.owned = !!env.monetization.owns('unlock_game');
        G.restoreMsg = G.owned ? 'Purchase restored' : 'No earlier purchase found';
      }).catch(() => { G.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { G.restoreBusy = false; });
    }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveAll();
  }
  function handlePause(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') { G.paused = false; G.pauseMenu = false; }
    else if (id === 'p-rules') { G.back = 'play'; go('rules'); }
    else if (id === 'p-howto') { G.back = 'play'; go('howto'); }
    else if (id === 'p-sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); }
    else if (id === 'p-txt-dec') { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); G.ui.scroll = 0; saveAll(); }
    else if (id === 'p-txt-inc') { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); G.ui.scroll = 0; saveAll(); }
    else if (id === 'quit') { leaveRun(); }
  }
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const max = READER.max || 0, view = pageViewH();
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.page = 0; G.ui.scroll = 0; G.ui.drag = null; G.lean.x0 = null; };
    const zoom = (d) => { const n = clamp(G.settings.textIdx + d, 0, TEXT_SCALES.length - 1); if (n !== G.settings.textIdx) { G.settings.textIdx = n; G.ui.scroll = 0; saveAll(); } };
    if (ptr.pressed) {
      if (inRect(REF_CLOSE, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) zoom(-1);
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) zoom(1);
      else if (ptr.x > PANEL.x + PANEL.w - 40 && ptr.y > PANEL.y + 84 && ptr.y < PANEL.y + PANEL.h - 14 && ptr.x < PANEL.x + PANEL.w + 8) G.ui.drag = { bar: true };
      else if (ptr.y > PANEL.y + 60 && ptr.y < PANEL.y + PANEL.h) G.ui.drag = { y0: ptr.y, s0: G.ui.scroll };
    }
    if (G.ui.drag && ptr.down) {
      const d = G.ui.drag;
      if (d.bar) G.ui.scroll = clamp(((ptr.y - (PANEL.y + 84)) / view) * (max + view) - view / 2, 0, max);
      else G.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
    if (ptr.released) G.ui.drag = null;
    if (keys.pressed.has('Equal') || keys.pressed.has('NumpadAdd')) zoom(1);
    if (keys.pressed.has('Minus') || keys.pressed.has('NumpadSubtract')) zoom(-1);
    scrollInput(input, max, view);
    if (keys.pressed.has('Escape') || keys.pressed.has('Enter')) close();
  };
  const updatePinned = (dt, input, key, handler) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handler('start'); return; }
    if (k.pressed.has('Escape')) { handler('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handler(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handler, key);
  };

  // ---- steering: a relative drag --------------------------------------------------------------------------
  function leanFrom(input) {
    const ptr = input.pointer, k = input.keys.down;
    const full = Math.min(SW, H) * 0.2;
    if (ptr.pressed) G.lean.x0 = ptr.x;
    if (!ptr.down) G.lean.x0 = null;
    let u = 0;
    if (G.lean.x0 != null && ptr.down) { const d = clamp((ptr.x - G.lean.x0) / full, -1, 1); u = Math.sign(d) * Math.pow(Math.abs(d), 1.15); }
    if (k.has('ArrowLeft') || k.has('KeyA')) u = -1;
    if (k.has('ArrowRight') || k.has('KeyD')) u = 1;
    if ((k.has('ArrowLeft') || k.has('KeyA')) && (k.has('ArrowRight') || k.has('KeyD'))) u = 0;
    G.lean.u = u;
    return u;
  }

  // ---- the play update -----------------------------------------------------------------------------------
  function colInput(kind, input) {
    column(kind);
    const p = input.pointer;
    const inp = OX ? { keys: input.keys, pointer: { x: p.x - OX, y: p.y, down: p.down, pressed: p.pressed, released: p.released } } : input;
    setPress(inp.pointer);
    return inp;
  }
  const COLUMN = { title: 'title', setup: 'menu', settings: 'menu', demolimit: 'menu', howto: 'reader', about: 'reader', rules: 'reader' };
  function afterNext() {
    if (demo && G.mode !== 'watch' && G.record.demoRuns >= DEMO_RUNS && G.scene === 'play') { leaveRun(); go('demolimit'); }
  }
  function overlayClick(id) {
    if (!id) return false;
    if (id === 'pause') { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.lean.x0 = null; sfx.tick(); return true; }
    if (id === 'think') { G.think = S.suggest(); G.ui.cardScroll = 0; G.lean.x0 = null; sfx.tick(); return true; }
    if (id === 'think-close') { G.think = null; sfx.tick(); G.lean.x0 = null; return true; }
    if (id === 'go') { sfx.tick(); S.go(); G.lean.x0 = null; return true; }
    if (id === 'next') { sfx.tick(); S.next(); G.lean.x0 = null; G.ui.cardScroll = 0; afterNext(); return true; }
    if (id === 'again') { sfx.tick(); if (demoCapped() && G.mode !== 'watch') { leaveRun(); go('demolimit'); } else startRun(G.setup.lastMode); return true; }
    if (id === 'menu') { sfx.tick(); leaveRun(); return true; }
    return false;
  }
  function updateWatch(dt, input) {
    const s = S.s, w = G.watch;
    cardInput(input);
    if (input.pointer.pressed) {
      const id = hudHit(input.pointer.x, input.pointer.y);
      if (id === 'w-pause') { w.paused = !w.paused; sfx.tick(); }
      else if (id === 'w-faster') { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveAll(); }
      else if (id === 'w-slower') { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveAll(); }
      else if (id === 'w-quit' || id === 'menu') { leaveRun(); return; }
    }
    if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) w.paused = !w.paused;
    if (w.paused) return;                                    // freezes everything: timers, sim, motion
    if (s.hold) {
      const hid = `${s.hold.id}:${s.run}`;
      if (w.holdId !== hid) { w.holdId = hid; w.phase = 'think'; G.thinkTotal = THINK_STEPS[G.settings.thinkIdx]; w.timer = G.thinkTotal; G.ui.cardScroll = 0; }
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
      else if (w.phase === 'reveal' && w.timer <= 0) { w.phase = 'act'; S.release(); }
      return;
    }
    if (s.ph === 'ready') { w.wait += dt; if (w.wait > 1.2) { w.wait = 0; S.go(); } S.update(dt); }
    else if (s.ph === 'push') { for (const t of PUSH_T) if (Math.abs(s.pt - t) < dt * 0.5) S.pull(); S.update(dt); processEvents(); }
    else if (s.ph === 'run') { S.input(pilot({ s: s.s, n: s.n, vn: s.vn, v: s.v, t: s.t }, S.T)); S.update(dt); processEvents(); }
    else if (s.ph === 'board') { w.wait += dt; S.update(dt); if (w.wait > 4) { w.wait = 0; pilot = createPilot(simRng.fork(), 0.93); S.next(); } }
    else { S.update(dt); processEvents(); }
  }
  function updatePlay(dt, input) {
    const s = S.s;
    G.flash = Math.max(0, G.flash - dt * 2.5);
    if (G.pauseMenu) { const inp = colInput('menu', input); MN.ensureLayout(G, 'pause'); updateFlowScene(dt, inp, handlePause, null); column('screen'); return; }
    if (G.mode === 'watch') { updateWatch(dt, input); updateFx(dt); return; }
    const ptr = input.pointer, kp = input.keys.pressed;
    if (G.think) {
      cardInput(input);
      if ((ptr.pressed && hudHit(ptr.x, ptr.y) === 'think-close') || kp.has('Escape') || kp.has('KeyT')) { G.think = null; sfx.tick(); G.lean.x0 = null; }
      return;
    }
    let ui = null;
    if (ptr.pressed) { ui = hudHit(ptr.x, ptr.y); if (overlayClick(ui)) return; }
    if (kp.has('KeyP') || kp.has('Escape')) { overlayClick('pause'); return; }
    if (kp.has('KeyT') && (s.ph === 'run' || s.ph === 'ready' || s.ph === 'push')) { overlayClick('think'); return; }
    if (s.ph === 'ready') { if (kp.has('Enter') || kp.has('Space')) overlayClick('go'); return; }
    if (s.ph === 'push') {
      if (ptr.pressed || kp.has('Space') || kp.has('ArrowLeft') || kp.has('ArrowRight') || kp.has('KeyA') || kp.has('KeyD')) S.pull();
      S.update(dt); processEvents(); updateFx(dt); return;
    }
    if (s.ph === 'board' || s.ph === 'end') {
      if (kp.has('Enter') || kp.has('Space')) overlayClick(s.over || s.runs === 1 ? 'again' : 'next');
      cardInput(input);
      S.update(dt); updateFx(dt); return;
    }
    if (s.ph === 'run') S.input(ui ? 0 : leanFrom(input));
    S.update(dt);
    processEvents();
    updateFx(dt);
  }
  function updateFx(dt) {
    const s = S && S.s;
    if (s && s.ph === 'run' && G.out && s.v > 6) {
      spray += dt;
      while (spray > 0.04) {
        spray -= 0.04;
        const o = G.out;
        G.fx.push({ x: o.x + (Math.sin(G.t * 30 + spray * 90)) * o.k * 0.2, y: o.y - o.k * 0.05, vx: (Math.sin(G.t * 47) * 40) - s.vn * 20, vy: 40 + s.v * 1.2, life: 0.45, max: 0.45, r: 2 + (G.t * 100 % 3), col: 'rgba(255,255,255,0.9)' });
      }
    }
    for (const p of G.fx) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.life -= dt; }
    G.fx = G.fx.filter((p) => p.life > 0);
    if (G.fx.length > 140) G.fx.splice(0, G.fx.length - 140);
  }

  // ?shot=1 (store screenshots): a real run played by the computer, advanced to a chosen moment and frozen
  // ?shot=1 query. `tools/arc shots` passes only seed + ticks, so seeds 100+ pick a named scene and seeds 1-3 pick a chute:
  //   100 title, 101 about, 102 setup, 103 start gate, 104 result card, 105 Watch & Learn, 106 Think card, 107 rules, 108 settings; 1/2/3 village/alpine/glacier, `ticks` = run ticks
  const SHOT_SEEDS = { 100: 'scene=title', 101: 'scene=about', 102: 'scene=setup', 103: 'until=push&plus=70', 104: 'until=board&plus=30&track=village', 105: 'watch=1&track=alpine&bend=2', 106: 'until=run&plus=520&track=alpine&think=1', 107: 'scene=rules', 108: 'scene=settings' };
  const shotQ = () => {
    const raw = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
    if (raw.has('scene') || raw.has('until') || raw.has('watch')) return raw;
    const seed = +(raw.get('seed') || 1), tr = ['village', 'alpine', 'glacier'];
    const q = new URLSearchParams(SHOT_SEEDS[seed] || `until=run&track=${tr[(seed - 1 + 3) % 3]}&plus=${raw.get('ticks') || 600}`);
    for (const [k, v] of raw) if (!q.has(k) && k !== 'seed' && k !== 'ticks' && k !== 'shot') q.set(k, v);
    return q;
  };
  function startShot() {
    const q = shotQ();
    G.setup.track = q.get('track') || 'village'; G.setup.level = 2;
    if (q.get('text')) G.settings.textIdx = clamp(+q.get('text') | 0, 0, TEXT_SCALES.length - 1);
    if (q.get('watch')) {
      startRun('watch');
      const pl = createPilot(simRng.fork(), 0.93);
      S.go();
      for (let i = 0; i < 20000 && !(S.s.hold && S.s.hold.curve >= +(q.get('bend') || 1)); i++) {
        for (const t of PUSH_T) if (Math.abs(S.s.pt - t) < DT * 0.5) S.pull();
        if (S.s.hold) S.release();
        S.input(pl({ s: S.s.s, n: S.s.n, vn: S.s.vn, v: S.s.v, t: S.s.t }, S.T)); S.update(DT);
      }
      G.watch = { phase: q.get('phase') || 'reveal', timer: 1.4, paused: false, holdId: `${S.s.hold ? S.s.hold.id : ''}:1`, wait: 0 };
      evSeen = S.s.evId;
      return;
    }
    startRun('trial'); G.mode = 'shot'; G.setup.lastMode = 'trial';
    const until = q.get('until') || 'run', plus = Number(q.get('plus') || 0);
    const pl = createPilot(simRng.fork(), 0.93);
    if (until === 'ready') { evSeen = S.s.evId; return; }
    S.go();
    const want = (ph) => S.s.ph === ph;
    for (let i = 0; i < 6000 && !want(until === 'push' ? 'push' : 'run'); i++) { for (const t of PUSH_T) if (Math.abs(S.s.pt - t) < DT * 0.5) S.pull(); S.update(DT); }
    if (until === 'push') { for (let i = 0; i < plus; i++) { S.update(DT); } evSeen = S.s.evId; return; }
    const tick = (n) => { for (let i = 0; i < n; i++) { S.input(pl({ s: S.s.s, n: S.s.n, vn: S.s.vn, v: S.s.v, t: S.s.t }, S.T)); S.update(DT); } };
    if (until === 'finish' || until === 'board') {
      for (let i = 0; i < 20000 && !(S.s.ph === (until === 'finish' ? 'finish' : 'board')); i++) tick(1);
      tick(plus);
    } else tick(plus);
    evSeen = S.s.evId;
    if (q.get('line')) G.settings.line = true;
    if (q.get('think')) G.think = S.suggest();
    if (q.get('pause')) { G.paused = true; G.pauseMenu = true; }
  }
  if (config.shot) {
    const qs = shotQ(), sc = qs.get('scene');
    if (qs.get('text')) G.settings.textIdx = clamp(+qs.get('text') | 0, 0, TEXT_SCALES.length - 1);
    if (sc && sc !== 'play') { G.scene = sc; G.back = 'title'; G.frozen = true; if (qs.get('track')) G.setup.track = qs.get('track'); if (qs.get('mode')) G.setup.mode = qs.get('mode'); } else { startShot(); G.frozen = true; }
  }

  return {
    // Menus, Rules, About, Watch & Learn, pause, cards and result screens are free; only live sliding counts against the preview.
    isPreviewExempt: () => !!config.dev || !(G.scene === 'play' && (G.mode === 'cup' || G.mode === 'trial' || G.mode === 'daily')) || G.paused || G.pauseMenu || !!G.think || !S || ['ready', 'finish', 'board', 'end'].includes(S.s.ph) || S.s.over,
    wheel(dy) { G.wheelAcc = (G.wheelAcc || 0) + dy; },
    update(dt, raw) {
      setScreen(meta.width, meta.height);
      G.t += dt;
      G.owned = !!env.monetization?.owns?.('unlock_game');
      if (G.scene !== 'play') stepAttract(dt);
      else if (G.mode === 'shot') { /* frozen picture */ }
      if (G.frozen) return;                                   // ?shot=1: a store screenshot frame stays exactly as built
      const kind = G.scene === 'play' ? 'screen' : (COLUMN[G.scene] || 'menu');
      const input = kind === 'screen' ? (column('screen'), setPress(raw.pointer), raw) : colInput(kind, raw);
      switch (G.scene) {
        case 'title': {
          const lt = MN.getLockTap(), pp = input.pointer;
          MN.setLockDown(G.lockDown > G.t);
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { G.lockDown = G.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(dt, input, handleTitle, 'title'); break;
        }
        case 'setup': updatePinned(dt, input, 'setup', handleSetup); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { leaveRun(); go('title'); } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': if (G.mode !== 'shot') updatePlay(dt, input); break;
        default: break;
      }
      G.wheelAcc = 0;
    },
    render(ctx, view) {
      setScreen(meta.width, meta.height);
      column('screen');
      ctx.clearRect(0, 0, SW, H);
      const kind = G.scene === 'play' ? 'screen' : (COLUMN[G.scene] || 'menu');
      if (G.scene !== 'play') renderBackdrop(ctx, G);
      const ox = column(kind);
      ctx.save(); ctx.translate(ox, 0);
      switch (G.scene) {
        case 'title': MN.renderTitle(ctx, G); break;
        case 'setup': MN.renderSetup(ctx, G); break;
        case 'settings': MN.renderSettings(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'howto': MN.renderPages(ctx, G, HOWTO, 'How to Play'); break;
        case 'about': MN.renderPages(ctx, G, ABOUT, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        case 'play': {
          // keep the kit's "Preview m:ss" pill off the HUD: under the map in portrait, right of the time strip in landscape
          const HL = hudLayout(G.settings.textIdx);
          meta.previewBadge = HL.land ? { x: HL.top.x + Math.min(HL.top.w, 640) + 12, y: HL.top.y + 6, align: 'left' } : { x: HL.map.x + HL.map.w, y: HL.map.y + HL.map.h + 8, align: 'right' };
          ctx.restore(); ctx.save();
          renderHud(ctx, G);
          if (G.pauseMenu) { const ox2 = column('menu'); ctx.translate(ox2, 0); MN.renderPause(ctx, G); }
          break;
        }
        default: break;
      }
      ctx.restore();
      column('screen');
    },
    getState: () => G,
  };
}
