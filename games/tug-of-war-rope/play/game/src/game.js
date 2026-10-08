// Tug of War, the game shell. Scenes, input, persistence, preview wiring, Watch & Learn. The contest lives in sim.js, the matches in match.js.
import { createPull, createCoachBot, DT, levelById } from './sim.js';
import { newMatch, curRound, pullOpts, recordPull, nextRound } from './match.js';
import { TEAMS, SETTINGS, KITS, YOU, teamById, kitById } from './teams.js';
import { createRng } from '../kit/rng.js';
import { SW, H, OX, PANEL, TEXT_SCALES, THINK_STEPS, REF_CLOSE, TEXT_DEC, TEXT_INC, SETUP_PINS, inRect, setScreen, column, hudLayout } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import * as MN from './menus.js';
import { READER, pageViewH } from './menus.js';
import { renderHud, renderFallback, hit as hudHit, CARD, toLocal } from './hud.js';
import { clamp } from './util.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_PULLS = 3;
const SOLO = ['bracket', 'quick', 'daily'];

// what Watch & Learn explains, once each, at the moment it first matters
const WATCH_TEXT = {
  tempo: { title: 'Find the beat', text: 'The chant sets a beat and the rings close on the target. Your team heaves when you tap, and the closer to the beat, the harder it pulls. The computer will tap right on the target.', doText: 'tap on every beat', action: 'tap' },
  surge: { title: 'Rival surge', text: 'A red ring means the rivals are about to heave with double force. The answer is to tap on your beat and then HOLD your finger down: you dig in and block most of it, and your stamina comes back.', doText: 'hold through the surge', action: 'hold' },
  tired: { title: 'Arms are tiring', text: 'Every heave costs stamina and a tired team pulls much weaker. When the bar runs low, stop heaving for a few beats and dig in to breathe.', doText: 'dig in and rest', action: 'hold' },
  anchor: { title: 'Anchor down', text: 'The flag is close to the rivals\' line. The ANCHOR call wraps the rope round the last person: for five seconds the rivals pull half as hard and the rope slows.', doText: 'call the anchor', action: 'anchor' },
  coach: { title: 'The coach call', text: 'Perfect and good heaves fill the coach meter. When it is full the COACH call widens the timing windows and locks the team in sync for four seconds.', doText: 'call the coach', action: 'coach' },
  rivalTired: { title: 'Rivals are gasping', text: 'THEM shows the rivals\' stamina. When they run out they stop heaving and rest. Keep pulling on the beat: that is the moment to take the line.', doText: 'keep pulling', action: 'tap' },
};

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', stage: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, chant: true, face: true, buzz: true },
    setup: { kind: 'bracket', level: 2, qlevel: 2, setting: 'harvest', kit: 'crimson' },
    ui: { scroll: 0, drag: null, cardScroll: 0 }, page: 0, back: 'title', restoreMsg: '',
    record: { demoPulls: 0, bestMargin: 0, bestStreak: 0, wins: 0, titles: 0, matches: 0, daily: {}, perfect: 0, heaves: 0 },
    match: null, pull: null, paused: false, pauseMenu: false, think: null, look: null, split: false, dailyScore: 0,
    watch: { phase: 'think', timer: 0, paused: false, holdId: '', done: {} }, thinkTotal: 5,
    t: 0, lay: null, aspect: 720 / 1280, nextAct: null,
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  const gameRng = rng.fork(), titleRng = rng.fork();
  let bot = null, evSeen = 0, lastBeat = -99, prevTouch = new Map();
  const homeSetting = SETTINGS[titleRng.int(SETTINGS.length)].id;
  G.setup.setting = homeSetting;

  // ---- persistence -------------------------------------------------------------------------------
  const saveAll = () => { storage.set('settings', G.settings); storage.set('record', G.record); storage.set('setup', G.setup); };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('setup', null)]).then(([s, r, su]) => {
    if (s) Object.assign(G.settings, s);
    if (r) Object.assign(G.record, r);
    if (su) Object.assign(G.setup, su);
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!SETTINGS.some((x) => x.id === G.setup.setting)) G.setup.setting = homeSetting;
    if (!KITS.some((x) => x.id === G.setup.kit)) G.setup.kit = 'crimson';
    G.loaded = true; updateLook();
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- the look of the 3D scene (the presenter reads this) -----------------------------------------------------------------------
  function updateLook() {
    const M = G.match, active = M && (G.scene === 'play' || G.scene === 'result');
    const rd = active ? curRound(M) : null;
    const kitA = kitById(G.setup.kit);
    let rv = rd ? teamById(rd.rival) : null;
    let b;
    if (G.mode === 'versus' || (!rv && G.scene === 'setup' && G.setup.kind === 'versus')) { const kb = KITS[(KITS.indexOf(kitA) + 3) % KITS.length]; b = { top: kb.top, accent: kb.accent, skins: ['light', 'brown', 'tan', 'deep'] }; }
    else { if (!rv) rv = teamById(G.setup.kind === 'quick' || G.scene === 'title' ? TEAMS.find((t) => t.home === G.setup.setting)?.id || 'oxen' : 'oxen'); b = { top: rv.top, accent: rv.accent, skins: rv.skins }; if (hueClose(b.top, kitA.top)) b = { ...b, top: '#e9e9ee', accent: '#8a95a8' }; }
    G.look = { setting: rd ? rd.setting : G.setup.setting, a: { top: kitA.top, accent: kitA.accent, skins: YOU.skins }, b };
  }
  const hueClose = (a, b) => { const f = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = f(a), y = f(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 70; };
  updateLook();

  // ---- sound ---------------------------------------------------------------------------------------------------------------------------
  // haptics: a short vibration where the device allows it (Android); silently nothing elsewhere
  const buzz = (p) => { if (!G.settings.buzz || config.shot) return; try { globalThis.navigator && globalThis.navigator.vibrate && globalThis.navigator.vibrate(p); } catch { /* no haptics */ } };
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 700, dur: 0.04, type: 'triangle', vol: 0.05 }),
    beat: () => tone({ freq: 118, to: 74, dur: 0.11, type: 'sine', vol: 0.12 }),
    beatR: () => tone({ freq: 165, to: 110, dur: 0.07, type: 'sine', vol: 0.045 }),
    go: () => { tone({ freq: 392, dur: 0.14, type: 'square', vol: 0.05 }); tone({ freq: 587, dur: 0.3, type: 'square', vol: 0.05 }); },
    heave: (g) => { const q = g === 'perfect' ? 1 : g === 'good' ? 0.7 : 0.4; tone({ freq: 150 + q * 70, to: 90, dur: 0.22, type: 'sawtooth', vol: 0.05 + q * 0.03 }); if (g === 'perfect') tone({ freq: 880, to: 1320, dur: 0.12, type: 'triangle', vol: 0.05 }); if (g === 'jerk') tone({ freq: 220, to: 130, dur: 0.16, type: 'square', vol: 0.04 }); },
    rival: (surge) => tone({ freq: surge ? 95 : 130, to: 70, dur: surge ? 0.4 : 0.18, type: 'sawtooth', vol: surge ? 0.08 : 0.025 }),
    warn: () => { tone({ freq: 300, to: 520, dur: 0.5, type: 'sawtooth', vol: 0.05 }); },
    block: () => { tone({ freq: 90, to: 60, dur: 0.3, type: 'sine', vol: 0.3 }); tone({ freq: 660, to: 880, dur: 0.12, type: 'triangle', vol: 0.06 }); },
    hit: () => { tone({ freq: 180, to: 60, dur: 0.32, type: 'sawtooth', vol: 0.08 }); },
    call: () => { tone({ freq: 523, dur: 0.1, type: 'triangle', vol: 0.07 }); tone({ freq: 784, dur: 0.18, type: 'triangle', vol: 0.07 }); },
    win: () => [0, 4, 7, 12].forEach((s, i) => tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })),
    lose: () => [0, -3].forEach((n) => tone({ freq: 330 * Math.pow(2, n / 12), dur: 0.3, type: 'triangle', vol: 0.07 })),
    cheer: () => { tone({ freq: 300, to: 520, dur: 0.7, type: 'sawtooth', vol: 0.012 }); tone({ freq: 380, to: 640, dur: 0.7, type: 'sawtooth', vol: 0.012 }); },
  };

  // ---- lifecycle -----------------------------------------------------------------------------------------------------------------------
  function newPull() {
    const o = pullOpts(G.match);
    const r = G.match.kind === 'daily' ? createRng(7919 * (config.day || 0) + 13 + G.match.pull) : gameRng.fork();
    G.pull = createPull(o, r);
    bot = G.mode === 'watch' ? createCoachBot(gameRng.fork(), 0.96) : null;
    evSeen = 0; lastBeat = -99; G.nextAct = null; G.think = null; G.zoneDown = false; G.ui.cardScroll = 0; prevTouch = new Map();
    G.watch = { phase: 'think', timer: 0, paused: false, holdId: '', done: G.watch.done || {} };
    G.split = G.mode === 'versus';
  }
  function startMatch(kind) {
    const st = G.setup;
    const cfg = { kind, level: st.level, setting: st.setting };
    if (kind === 'quick') { cfg.level = st.qlevel; cfg.rival = (TEAMS.find((t) => t.home === st.setting) || TEAMS[0]).id; }
    if (kind === 'versus') cfg.setting = st.setting;
    if (kind === 'watch') { cfg.level = 2; cfg.rival = (TEAMS.find((t) => t.home === st.setting) || TEAMS[0]).id; }
    let r = gameRng.fork();
    if (kind === 'daily') r = createRng(104729 * (config.day || 0) + 7);
    G.match = newMatch(cfg, r);
    G.match.rounds.forEach((rd) => { if (kind === 'watch') rd.level = 2; });
    G.mode = kind; G.scene = 'play'; G.stage = 'intro'; G.paused = false; G.pauseMenu = false; G.ui.scroll = 0;
    G.watch = { phase: 'think', timer: 0, paused: false, holdId: '', done: {} };
    updateLook(); newPull();
  }
  const leaveRun = () => { G.scene = 'title'; G.mode = 'none'; G.stage = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; G.pull = null; G.match = null; G.split = false; bot = null; updateLook(); };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; MN.ensureLayout(G, '-'); };

  // ---- sim events: sound, records -----------------------------------------------------------------------------------------------------
  function processEvents() {
    const s = G.pull.s, mine = G.mode !== 'watch' && G.mode !== 'shot';
    for (const e of s.events) {
      if (e.id <= evSeen) continue;
      evSeen = e.id;
      if (e.type === 'go') { sfx.go(); buzz(18); }
      else if (e.type === 'heave') { if (e.side === 'a' || G.mode === 'versus') { sfx.heave(e.g); if (mine && e.side === 'a') buzz(e.g === 'perfect' ? 22 : e.g === 'good' ? 12 : 6); } else { sfx.rival(e.surge); if (e.surge && mine) buzz([14, 30, 14]); } }
      else if (e.type === 'surgeWarn') { sfx.warn(); if (mine) buzz(10); }
      else if (e.type === 'block') { sfx.block(); if (mine) buzz(35); }
      else if (e.type === 'hit') { sfx.hit(); if (mine) buzz(45); }
      else if (e.type === 'anchor' || e.type === 'coach') sfx.call();
      else if (e.type === 'rush') sfx.hit();
      else if (e.type === 'end') {
        if (e.winner === 'a') sfx.win(); else sfx.lose(); sfx.cheer(); if (mine) buzz(e.winner === 'a' ? [30, 40, 60] : 70);
        onPullEnd(s, mine);
      }
    }
    // the chant: a soft drum on your beat and a lighter one on theirs
    if (G.settings.chant && (s.ph === 'ready' || s.ph === 'pull')) {
      const kA = Math.floor((s.t - s.phase.a) / s.T);
      if (kA !== lastBeat) { lastBeat = kA; sfx.beat(); }
    }
  }
  function onPullEnd(s, mine) {
    const M = G.match, r = G.record;
    const st = recordPull(M, s);
    G.nextAct = st;
    if (mine && G.mode !== 'versus') {
      r.bestMargin = Math.max(r.bestMargin || 0, s.winner === 'a' ? s.maxLead : 0); r.bestStreak = Math.max(r.bestStreak || 0, s.a.bestStreak);
      r.perfect += s.a.perfect; r.heaves += s.a.heaves;
      if (s.winner === 'a') r.wins++;
    }
    if (st === 'match') {
      if (mine) { r.matches++; if (M.kind === 'bracket' && M.champion) r.titles++; }
      if (M.kind === 'daily') {
        const sc = Math.round((s.winner === 'a' ? 1000 + s.timeLeft * 20 : 0) + s.a.perfect * 15 + s.a.blocked * 40);
        G.dailyScore = sc; const dk = String(config.day || 0); r.daily[dk] = Math.max(r.daily[dk] || 0, sc);
        const keys = Object.keys(r.daily); if (keys.length > 14) for (const k of keys.sort().slice(0, keys.length - 14)) delete r.daily[k];
      }
    }
    if (demo && mine) r.demoPulls++;
    saveAll();
  }

  // ---- scrolling ---------------------------------------------------------------------------------------------------------------------------
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
    if (G.wheelAcc && R) { G.ui.cardScroll = clamp((G.ui.cardScroll || 0) + G.wheelAcc, 0, CARD.max); }
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

  // ---- menu handlers -----------------------------------------------------------------------------------------------------------------
  function demoCapped() { return demo && G.record.demoPulls >= DEMO_PULLS; }
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'bracket' || id === 'quick' || id === 'versus' || id === 'watch') { G.setup.kind = id; go('setup'); updateLook(); }
    else if (id === 'daily') { if (demoCapped()) go('demolimit'); else { G.setup.kind = 'daily'; startMatch('daily'); } }
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); }
  }
  function tryStart() {
    if (demoCapped() && G.setup.kind !== 'watch') { go('demolimit'); return; }
    startMatch(G.setup.kind);
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('set-')) st.setting = id.slice(4);
    else if (id.startsWith('lvq')) st.qlevel = +id.slice(3);
    else if (id.startsWith('lv')) st.level = +id.slice(2);
    else if (id.startsWith('kit-')) st.kit = id.slice(4);
    else if (id === 'start') { saveAll(); tryStart(); return; }
    else if (id === 'back') { go('title'); updateLook(); return; }
    MN.ensureLayout(G, '-'); updateLook(); saveAll();
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-chant') st.chant = !st.chant;
    else if (id === 'set-buzz') { st.buzz = !st.buzz; if (st.buzz) buzz(20); }
    else if (id === 'set-face') st.face = !st.face;
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); G.ui.scroll = 0; }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); G.ui.scroll = 0; }
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; }).catch(() => { G.restoreMsg = 'Could not reach the store.'; }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveAll();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'again') { const k = G.match ? G.match.kind : G.setup.kind; if (demoCapped() && k !== 'watch') go('demolimit'); else startMatch(k); }
    else if (id === 'new') { const k = G.match ? G.match.kind : 'bracket'; G.setup.kind = k === 'daily' ? 'quick' : k; G.pull = null; G.match = null; G.split = false; go('setup'); updateLook(); }
    else if (id === 'menu') { leaveRun(); go('title'); }
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
    else if (id === 'quit') leaveRun();
  }
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const max = READER.max || 0, view = pageViewH();
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.page = 0; G.ui.scroll = 0; G.ui.drag = null; };
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

  // ---- the play update -----------------------------------------------------------------------------------------------------------------------
  function colInput(kind, input) {
    column(kind);
    const p = input.pointer;
    const inp = OX ? { keys: input.keys, pointer: { x: p.x - OX, y: p.y, down: p.down, pressed: p.pressed, released: p.released } } : input;
    setPress(inp.pointer);
    return inp;
  }
  const COLUMN = { title: 'title', setup: 'menu', settings: 'menu', result: 'menu', demolimit: 'menu', howto: 'reader', about: 'reader', rules: 'reader' };
  function nextPullAction() {
    const st = G.nextAct; if (!st) return;
    sfx.tick();
    if (st === 'pull') { newPull(); G.stage = 'pull'; }
    else if (st === 'round') { nextRound(G.match); updateLook(); newPull(); G.stage = 'intro'; }
    else {
      G.scene = 'result'; G.ui.scroll = 0; G.paused = false; G.split = false; G.stage = 'none';
      if (demo && G.mode !== 'watch' && G.record.demoPulls >= DEMO_PULLS) { /* the next start is capped */ }
    }
  }
  function overlayClick(id) {
    if (!id) return false;
    const P = G.pull;
    if (id === 'pause') { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.zoneDown = false; sfx.tick(); return true; }
    if (id === 'think') { if (P.s.ph === 'end') return true; const h = P.suggest('a'); G.think = { ...h, doText: h.action }; G.ui.cardScroll = 0; G.zoneDown = false; sfx.tick(); return true; }
    if (id === 'think-close') { G.think = null; sfx.tick(); return true; }
    if (id === 'roundgo') { G.stage = 'pull'; sfx.tick(); return true; }
    if (id === 'pullnext') { nextPullAction(); return true; }
    if (id === 'anchor:a') { if (P.call('a', 'anchor')) return true; return true; }
    if (id === 'coach:a') { P.call('a', 'coach'); return true; }
    if (id === 'anchor:b') { P.call('b', 'anchor'); return true; }
    if (id === 'coach:b') { P.call('b', 'coach'); return true; }
    return false;
  }
  function watchHoldFor(s) {
    const d = G.watch.done, a = s.a;
    if (s.ph === 'ready' && s.t > -2.4 && !d.tempo) return 'tempo';
    if (s.ph !== 'pull') return null;
    if (s.surge && !d.surge && s.t < s.surge.hit - 0.2) return 'surge';
    if (a.stam < 0.3 && !d.tired) return 'tired';
    if (s.x < -0.8 && a.anchorLeft > 0 && !d.anchor) return 'anchor';
    if (a.coachMeter >= 1 && a.coachT <= 0 && !d.coach) return 'coach';
    if (s.b.stam < 0.25 && !d.rivalTired) return 'rivalTired';
    return null;
  }
  function updateWatch(dt, input) {
    const P = G.pull, s = P.s, w = G.watch;
    cardInput(input);
    if (input.pointer.pressed) {
      const id = hudHit(input.pointer.x, input.pointer.y);
      if (id === 'w-pause') { w.paused = !w.paused; sfx.tick(); }
      else if (id === 'w-quit') { leaveRun(); return; }
    }
    if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) w.paused = !w.paused;
    if (w.paused) return;                                      // freezes everything: timers, sim, motion
    if (s.hold) {
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
      else if (w.phase === 'reveal' && w.timer <= 0) { w.phase = 'act'; G.watch.done[w.holdId] = true; s.hold = null; w.holdId = ''; }
      return;
    }
    if (s.ph === 'end') { w.wait = (w.wait || 0) + dt; P.update(dt); processEvents(); if (s.over && w.wait > 4.2) nextPullAction(); return; }
    const id = watchHoldFor(s);
    if (id) { const tx = WATCH_TEXT[id]; s.hold = { id, ...tx }; w.holdId = id; w.phase = 'think'; G.thinkTotal = THINK_STEPS[G.settings.thinkIdx]; w.timer = G.thinkTotal; G.ui.cardScroll = 0; return; }
    bot(P, 'a');
    P.update(dt); processEvents();
  }

  // the fingers: one pointer (plus keys) for a single player, a list of touches for two
  function soloInput(input) {
    const P = G.pull, ptr = input.pointer, k = input.keys;
    if (ptr.pressed) { const id = hudHit(ptr.x, ptr.y); if (id && overlayClick(id)) { G.zoneDown = false; } else G.zoneDown = true; }
    if (!ptr.down) G.zoneDown = false;
    const keyDown = k.down.has('Space');
    P.input('a', (G.zoneDown && ptr.down) || keyDown);
    if (k.pressed.has('KeyA')) P.call('a', 'anchor');
    if (k.pressed.has('KeyC')) P.call('a', 'coach');
  }
  function versusInput(input) {
    const P = G.pull, L = G.lay || hudLayout(G.settings.textIdx, true), k = input.keys;
    const land = SW > H, rot = !land && G.settings.face;
    const touches = env.multi ? env.multi.list() : (input.pointer.down ? [{ id: 0, x: input.pointer.x, y: input.pointer.y }] : []);
    const down = { a: false, b: false }, now = new Map();
    for (const t of touches) {
      const id = t.id === undefined ? `${t.x | 0},${t.y | 0}` : t.id;
      now.set(id, t);
      const side = land ? (t.x < SW / 2 ? 'a' : 'b') : (t.y > H / 2 ? 'a' : 'b');
      const fresh = !prevTouch.has(id);
      if (fresh) {
        const hid = hudHit(t.x, t.y);
        if (hid && overlayClick(hid)) continue;
      }
      // a finger that landed on a button never counts as a pull
      const hid2 = hudHit(t.x, t.y);
      if (hid2 && /^(anchor|coach|pause|think)/.test(hid2) && (fresh || (prevTouch.get(id) || {}).onBtn)) { t.onBtn = true; continue; }
      if (prevTouch.get(id) && prevTouch.get(id).onBtn) { t.onBtn = true; continue; }
      down[side] = true;
    }
    prevTouch = now;
    P.input('a', down.a || k.down.has('Space')); P.input('b', down.b || k.down.has('Enter'));
    if (k.pressed.has('KeyA')) P.call('a', 'anchor'); if (k.pressed.has('KeyC')) P.call('a', 'coach');
    if (k.pressed.has('ArrowLeft')) P.call('b', 'anchor'); if (k.pressed.has('ArrowRight')) P.call('b', 'coach');
    void L; void rot;
  }
  function updatePlay(dt, input) {
    const P = G.pull, s = P.s;
    if (G.pauseMenu) { const inp = colInput('menu', input); MN.ensureLayout(G, 'pause'); updateFlowScene(dt, inp, handlePause, null); column('screen'); return; }
    if (G.stage === 'intro') { const ptr = input.pointer; if (ptr.pressed && overlayClick(hudHit(ptr.x, ptr.y))) return; if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) overlayClick('roundgo'); if (input.keys.pressed.has('Escape')) { leaveRun(); } return; }
    if (G.mode === 'watch') { updateWatch(dt, input); return; }
    const ptr = input.pointer, kp = input.keys.pressed;
    if (G.think) {
      cardInput(input);
      if ((ptr.pressed && hudHit(ptr.x, ptr.y) === 'think-close') || kp.has('Escape') || kp.has('KeyT') || kp.has('Enter')) { G.think = null; sfx.tick(); }
      return;
    }
    if (kp.has('Escape') || kp.has('KeyP')) { overlayClick('pause'); return; }
    if (s.ph === 'end') {
      if (ptr.pressed && overlayClick(hudHit(ptr.x, ptr.y))) return;
      if (s.over && (kp.has('Enter') || kp.has('Space'))) { nextPullAction(); return; }
      P.update(dt); processEvents(); return;
    }
    if (G.mode === 'versus') { if (ptr.pressed || true) versusInput(input); }
    else { if (kp.has('KeyT')) { overlayClick('think'); return; } soloInput(input); }
    if (G.pull) { P.update(dt); processEvents(); }
  }

  // ?shot=1 (store screenshots): a real match played by the computer, advanced to a chosen moment and frozen
  function startShot() {
    const q = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
    G.setup.setting = q.get('setting') || 'harvest'; G.setup.qlevel = Number(q.get('level') || 3); G.setup.kit = q.get('kit') || 'crimson';
    const kind = q.get('kind') || 'quick';
    startMatch(kind); G.stage = 'pull'; if (kind !== 'watch') G.mode = kind;
    const until = q.get('until') || 'pull', plus = Number(q.get('plus') || 0);
    const P = G.pull, b = createCoachBot(gameRng.fork(), 0.93), b2 = createCoachBot(gameRng.fork(), 0.75);
    const reached = () => (until === 'ready' ? P.s.t > -1.2 : until === 'surge' ? !!P.s.surge : until === 'end' ? P.s.ph === 'end' : until === 'tired' ? P.s.a.stam < 0.4 : P.s.pt > 6);
    if (until === 'start') return;
    for (let i = 0; i < 6000 && !reached(); i++) { b(P, 'a'); if (kind === 'versus') b2(P, 'b'); P.update(DT); }
    for (let i = 0; i < plus; i++) { b(P, 'a'); if (kind === 'versus') b2(P, 'b'); P.update(DT); }
    evSeen = P.s.evId; G.mode = kind;
  }
  if (config.shot) {
    const sc = new URLSearchParams(globalThis.location ? globalThis.location.search : '').get('scene');
    if (sc === 'result' || sc === 'pause') {
      const q = new URLSearchParams(globalThis.location.search);
      G.setup.setting = q.get('setting') || 'harvest'; startMatch(q.get('kind') || 'quick'); G.stage = 'pull';
      const b = createCoachBot(gameRng.fork(), q.get('lose') ? 0.1 : 0.95);
      for (let i = 0; i < 80000 && G.scene === 'play'; i++) { const P = G.pull; if (P.s.ph === 'end') { P.update(DT); processEvents(); if (P.s.over) nextPullAction(); continue; } b(P, 'a'); P.update(DT); processEvents(); }
      if (sc === 'pause') { G.scene = 'play'; G.stage = 'pull'; G.pauseMenu = true; G.paused = true; G.mode = 'quick'; newPull(); }
      G.frozen = true; updateLook();
    } else if (sc && sc !== 'play') { G.scene = sc; G.back = 'title'; G.frozen = true; if (sc === 'setup') { G.setup.kind = new URLSearchParams(globalThis.location.search).get('kind') || 'bracket'; } updateLook(); }
    else { startShot(); G.frozen = true; updateLook(); }
  }

  return {
    // Menus, Rules, About, Watch & Learn, pause, cards and result screens are free; only live pulling counts against the preview.
    isPreviewExempt: () => !!config.dev || !(G.scene === 'play' && G.stage === 'pull' && SOLO.concat('versus').includes(G.mode)) || G.paused || G.pauseMenu || !!G.think || !G.pull || G.pull.s.ph !== 'pull',
    wheel(dy) { G.wheelAcc = (G.wheelAcc || 0) + dy; },
    update(dt, raw) {
      setScreen(meta.width, meta.height);
      if (G.frozen) return;                                   // ?shot=1: a store screenshot frame stays exactly as built
      const kind = G.scene === 'play' ? 'screen' : (COLUMN[G.scene] || 'menu');
      const input = kind === 'screen' ? (column('screen'), setPress(raw.pointer), raw) : colInput(kind, raw);
      G.t += dt;
      switch (G.scene) {
        case 'title': {
          const lt = MN.getLockTap(), pp = input.pointer;
          MN.setLockDown(G.lockDown > G.t);
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { G.lockDown = G.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(dt, input, handleTitle, 'title'); break;
        }
        case 'setup': updatePinned(dt, input, 'setup', handleSetup); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { leaveRun(); go('title'); } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': if (G.mode !== 'shot') updatePlay(dt, input); break;
        default: break;
      }
      G.wheelAcc = 0;
    },
    render(ctx, view) {
      setScreen(meta.width, meta.height);
      G.viewW = (view && view.cssW) || SW; G.viewH = (view && view.cssH) || H;
      G.aspect = G.viewW / G.viewH;
      column('screen');
      ctx.clearRect(0, 0, SW, H);
      const v = { cssW: G.viewW, cssH: G.viewH };
      if (view && view.noGL) renderFallback(ctx, G, v);
      const kind = G.scene === 'play' ? 'screen' : (COLUMN[G.scene] || 'menu');
      const ox = column(kind);
      ctx.save(); ctx.translate(ox, 0);
      switch (G.scene) {
        case 'title': MN.renderTitle(ctx, G); break;
        case 'setup': MN.renderSetup(ctx, G); break;
        case 'settings': MN.renderSettings(ctx, G); break;
        case 'result': MN.renderResult(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'howto': MN.renderPages(ctx, G, HOWTO, 'How to Play'); break;
        case 'about': MN.renderPages(ctx, G, aboutList, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        case 'play':
          renderHud(ctx, G, v);
          if (G.pauseMenu) { const ox2 = column('menu'); ctx.translate(ox2, 0); MN.renderPause(ctx, G); }
          break;
        default: break;
      }
      ctx.restore();
      column('screen');
    },
    getState: () => G,
  };
}
