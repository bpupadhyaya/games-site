// Ski Jump Fjord, the game shell. Scenes, input, persistence, preview wiring, Watch & Learn. The competition lives in sim.js, the jump in jump.js.
import { createSim, DT } from './sim.js';
import { createPilot } from './pilot.js';
import { createRng } from '../kit/rng.js';
import { SW, H, OX, PANEL, TEXT_SCALES, THINK_STEPS, REF_CLOSE, TEXT_DEC, TEXT_INC, SETUP_PINS, inRect, setScreen, column } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import * as MN from './menus.js';
import { READER, pageViewH } from './menus.js';
import { renderHud, renderFallback, hit as hudHit, CARD } from './hud.js';
import { createControls } from './controls.js';
import { clamp } from './util.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_JUMPS = 3;

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const ctl = createControls();
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, jumper: 'm' },
    setup: { hill: 'fjord', level: 2, single: false, watch: false, lastMode: 'comp' },
    ui: { scroll: 0, drag: null, cardScroll: 0 }, page: 0, back: 'title', setupMsg: '', restoreMsg: '',
    record: { demoJumps: 0, bestDist: {}, bestComp: {}, bestPts: 0, daily: 0 },
    sim: null, paused: false, pauseMenu: false, think: null, feedback: null,
    watch: { phase: 'think', timer: 0, paused: false, holdId: '', wait: 0 }, thinkTotal: 5,
    t: 0, lay: null, aspect: 720 / 1280, ctl,
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  let S = null, pilot = null, evSeen = 0, windT = 0;
  const simRng = rng.fork();

  // ---- persistence -------------------------------------------------------------------------------
  const saveAll = () => { storage.set('settings', G.settings); storage.set('record', G.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(G.settings, s);
    if (r) Object.assign(G.record, r);
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (G.settings.jumper !== 'f') G.settings.jumper = 'm';
    G.loaded = true;
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    go: () => { tone({ freq: 440, dur: 0.12, type: 'square', vol: 0.05 }); tone({ freq: 660, dur: 0.2, type: 'square', vol: 0.05 }); },
    jump: (q) => { tone({ freq: 200 + q * 200, to: 90, dur: 0.28, type: 'sawtooth', vol: 0.06 }); tone({ freq: 80, to: 60, dur: 0.2, type: 'sine', vol: 0.18 }); },
    whoosh: (v) => tone({ freq: 120 + v * 8, to: 90 + v * 5, dur: 0.5, type: 'sawtooth', vol: 0.012 }),
    thud: () => { tone({ freq: 120, to: 50, dur: 0.35, type: 'sine', vol: 0.35 }); tone({ freq: 800, to: 250, dur: 0.07, type: 'square', vol: 0.04 }); },
    good: (n) => [0, 4, 7, 12].slice(0, n).forEach((s, i) => tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.2 + i * 0.04, type: 'triangle', vol: 0.09 })),
    bad: () => [0, -3].forEach((n) => tone({ freq: 330 * Math.pow(2, n / 12), dur: 0.26, type: 'triangle', vol: 0.07 })),
    cheer: () => { tone({ freq: 300, to: 520, dur: 0.6, type: 'sawtooth', vol: 0.012 }); tone({ freq: 380, to: 640, dur: 0.6, type: 'sawtooth', vol: 0.012 }); },
  };

  // ---- lifecycle -----------------------------------------------------------------------------------
  const recGate = (s) => (s.wind.head < -0.6 ? 2 : s.wind.head > 1.2 ? 0 : 1);
  function startRun(kind) {
    const st = G.setup;
    let opts;
    let r = simRng.fork();
    if (kind === 'daily') { r = createRng(7919 * (config.day || 0) + 13); opts = { hill: 'fjord', level: 2, mode: 'daily' }; }
    else if (kind === 'practice') opts = { hill: st.hill, level: st.level, mode: 'practice' };
    else if (kind === 'watch') opts = { hill: st.hill, level: st.level, mode: 'comp', hold: true };
    else opts = { hill: st.hill, level: st.level, mode: 'comp' };
    S = createSim(opts, r); G.sim = S.s; evSeen = 0; windT = 0;
    pilot = kind === 'watch' ? createPilot(simRng.fork(), 0.93) : null;
    G.mode = kind; G.setup.lastMode = kind;
    G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.think = null; G.feedback = null; G.ui.scroll = 0;
    G.watch = { phase: 'think', timer: 0, paused: false, holdId: '', wait: 0 };
    ctl.reset();
  }
  const leaveRun = () => { G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; S = null; pilot = null; G.sim = null; };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; MN.ensureLayout(G, '-'); };

  // ---- sim events: sound, feedback, saving -----------------------------------------------------------
  function processEvents() {
    const s = S.s;
    for (const e of s.events) {
      if (e.id <= evSeen) continue;
      evSeen = e.id;
      const mine = G.mode !== 'watch' && G.mode !== 'shot';
      if (e.type === 'go') sfx.go();
      else if (e.type === 'jump') {
        sfx.jump(e.q);
        const text = e.q >= 0.95 ? 'PERFECT JUMP' : e.q >= 0.55 ? 'GOOD JUMP' : e.e < -0.1 ? 'TOO EARLY' : e.e > 0.1 ? 'TOO LATE' : 'OK JUMP';
        G.feedback = { t: s.t, text, col: e.q >= 0.95 ? '#f2c14e' : e.q >= 0.55 ? '#8fd3e6' : '#ff8f7a' };
      } else if (e.type === 'touch') sfx.thud();
      else if (e.type === 'landed') {
        const j = s.jump, k = j && j.res ? j.res.kind : 'clean';
        G.feedback = { t: s.t, text: k === 'telemark' ? 'TELEMARK!' : k === 'clean' ? 'CLEAN LANDING' : k === 'rough' ? 'ROUGH LANDING' : 'FALL', col: k === 'telemark' ? '#f2c14e' : k === 'clean' ? '#8fd3e6' : '#ff8f7a' };
      } else if (e.type === 'judge') {
        if (e.fall) sfx.bad(); else { sfx.good(e.kind === 'telemark' ? 4 : 2); sfx.cheer(); }
        if (mine) noteBest(S.s);
        if (demo && mine) { G.record.demoJumps++; saveAll(); }
      } else if (e.type === 'end') { if (mine) noteBest(S.s, true); G.scene = 'result'; G.ui.scroll = 0; G.paused = false; G.pauseMenu = false; }
    }
    const j = s.jump;
    if (j && j.ph === 'air') { windT += DT; if (windT > 0.45) { windT = 0; sfx.whoosh(Math.hypot(j.vx, j.vy)); } }
  }
  function noteBest(s, fin) {
    const r = G.record, id = s.hill;
    r.bestDist[id] = Math.max(r.bestDist[id] || 0, s.you.best);
    for (const j of s.you.jumps) r.bestPts = Math.max(r.bestPts || 0, Math.round(j.pts));
    if (fin && s.mode !== 'practice') { const me = s.standings.find((x) => x.you); if (me) r.bestComp[id] = Math.max(r.bestComp[id] || 0, me.total); }
    saveAll();
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
  function demoCapped() { return demo && G.record.demoJumps >= DEMO_JUMPS; }
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'play') { G.setup.single = false; G.setup.watch = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'single') { G.setup.single = true; G.setup.watch = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { G.setup.watch = true; G.setup.single = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'daily') { if (demoCapped()) go('demolimit'); else startRun('daily'); }
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); }
  }
  function tryStart() {
    if (demoCapped() && !G.setup.watch) { go('demolimit'); return; }
    startRun(G.setup.watch ? 'watch' : G.setup.single ? 'practice' : 'comp');
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('hill-')) st.hill = id.slice(5);
    else if (id.startsWith('lv')) st.level = +id.slice(2);
    else if (id === 'start') tryStart();
    else if (id === 'back') go('title');
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-jumper') { st.jumper = st.jumper === 'f' ? 'm' : 'f'; }
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
    if (id === 'again') { const lm = G.setup.lastMode; if (demoCapped() && lm !== 'watch') go('demolimit'); else startRun(lm); }
    else if (id === 'new') { G.sim = null; go('setup'); }
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
    else if (id === 'quit') { leaveRun(); }
  }
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const max = READER.max || 0, view = pageViewH();
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.page = 0; G.ui.scroll = 0; G.ui.drag = null; if (G.scene === 'play') ctl.reset(); };
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

  // ---- the play update -----------------------------------------------------------------------------------
  function colInput(kind, input) {
    column(kind);
    const p = input.pointer;
    const inp = OX ? { keys: input.keys, pointer: { x: p.x - OX, y: p.y, down: p.down, pressed: p.pressed, released: p.released } } : input;
    setPress(inp.pointer);
    return inp;
  }
  const COLUMN = { title: 'title', setup: 'menu', settings: 'menu', result: 'menu', demolimit: 'menu', howto: 'reader', about: 'reader', rules: 'reader' };
  function afterNext() {
    if (demo && G.mode !== 'watch' && G.record.demoJumps >= DEMO_JUMPS && G.scene === 'play') { leaveRun(); go('demolimit'); }
  }
  function overlayClick(id) {
    if (!id) return false;
    if (id === 'pause') { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; ctl.reset(); sfx.tick(); return true; }
    if (id === 'think') { G.think = S.suggest(); G.ui.cardScroll = 0; ctl.reset(); sfx.tick(); return true; }
    if (id === 'think-close') { G.think = null; sfx.tick(); ctl.reset(); return true; }
    if (id.startsWith('gate:')) { sfx.tick(); S.gate(+id.slice(5)); return true; }
    if (id === 'go') { sfx.tick(); S.go(); ctl.reset(); return true; }
    if (id === 'next') { sfx.tick(); S.next(); ctl.reset(); afterNext(); return true; }
    if (id === 'replay') { sfx.tick(); S.startReplay(); return true; }
    if (id === 'skipreplay') { S.stopReplay(); return true; }
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
      else if (id === 'w-quit') { leaveRun(); return; }
    }
    if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) w.paused = !w.paused;
    if (w.paused) return;                                    // freezes everything: timers, sim, motion
    if (s.hold) {
      const hid = `${s.hold.id}:${s.round}`;
      if (w.holdId !== hid) { w.holdId = hid; w.phase = 'think'; G.thinkTotal = THINK_STEPS[G.settings.thinkIdx]; w.timer = G.thinkTotal; G.ui.cardScroll = 0; }
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
      else if (w.phase === 'reveal' && w.timer <= 0) {
        w.phase = 'act';
        const id = s.hold.id;
        S.release();
        if (id === 'gate') { S.gate(recGate(s)); S.go(); pilot = createPilot(simRng.fork(), 0.93); }
      }
      return;
    }
    if (s.ph === 'run') { S.input(pilot(s.jump)); S.update(dt); processEvents(); }
    else if (s.ph === 'judge' || s.ph === 'board') {
      w.wait += dt; S.update(dt);
      if (w.wait > 3.6) { w.wait = 0; S.next(); }
    } else if (s.ph === 'gate') { S.gate(recGate(s)); S.go(); pilot = createPilot(simRng.fork(), 0.93); }
    else S.update(dt);
    processEvents();
  }
  function updatePlay(dt, input) {
    const s = S.s;
    if (G.pauseMenu) { const inp = colInput('menu', input); MN.ensureLayout(G, 'pause'); updateFlowScene(dt, inp, handlePause, null); column('screen'); return; }
    if (G.mode === 'watch') { updateWatch(dt, input); return; }
    const ptr = input.pointer;
    if (G.think) {
      cardInput(input);
      if ((ptr.pressed && hudHit(ptr.x, ptr.y) === 'think-close') || input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyT')) { G.think = null; sfx.tick(); ctl.reset(); }
      return;
    }
    if (ptr.pressed && overlayClick(hudHit(ptr.x, ptr.y))) return;
    if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) { overlayClick('pause'); return; }
    if (input.keys.pressed.has('KeyT')) { overlayClick('think'); return; }
    const kp = input.keys.pressed;
    if (s.ph === 'gate') {
      if (kp.has('Digit1')) S.gate(0);
      if (kp.has('Digit2')) S.gate(1);
      if (kp.has('Digit3')) S.gate(2);
      if (kp.has('ArrowUp')) S.gate(s.gate + 1);
      if (kp.has('ArrowDown')) S.gate(s.gate - 1);
      if (kp.has('Enter') || kp.has('Space')) overlayClick('go');
      return;
    }
    if (s.ph === 'judge' || s.ph === 'board') {
      if (s.replay) { if (kp.has('Enter') || kp.has('Space')) S.stopReplay(); S.update(dt); return; }
      if (s.ph === 'judge' && kp.has('KeyR')) { S.startReplay(); return; }
      if (kp.has('Enter') || kp.has('Space')) { overlayClick('next'); return; }
      S.update(dt); return;
    }
    if (s.ph === 'run') {
      const j = s.jump;
      const phase = j && (j.ph === 'ready' || j.ph === 'slide') ? 'ground' : 'air';
      S.input(ctl.update(input, phase));
    }
    S.update(dt);
    processEvents();
  }

  // ?shot=1 (store screenshots): a real run played by the computer, advanced to a chosen moment and frozen
  function startShot() {
    const q = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
    G.setup.hill = q.get('hill') || 'fjord'; G.setup.level = 2;
    startRun('practice'); G.mode = 'shot'; G.setup.lastMode = 'practice';
    const until = q.get('until') || 'air', plus = Number(q.get('plus') || 0);
    if (until === 'gate') { evSeen = S.s.evId; return; }
    S.go();
    const pl = createPilot(simRng.fork(), 0.95);
    const reached = () => (until === 'judge' ? S.s.ph === 'judge' : S.s.jump && S.s.jump.ph === until);
    for (let i = 0; i < 6000 && !reached(); i++) { S.input(pl(S.s.jump)); S.update(DT); }
    for (let i = 0; i < plus; i++) { S.input(pl(S.s.jump)); S.update(DT); }
    evSeen = S.s.evId;
  }
  if (config.shot) {
    const sc = new URLSearchParams(globalThis.location ? globalThis.location.search : '').get('scene');
    if (sc && sc !== 'play') { G.scene = sc; G.back = 'title'; G.frozen = true; } else { startShot(); G.frozen = true; }
  }

  return {
    // Menus, Rules, About, Watch & Learn, pause, cards and result screens are free; only live play counts against the preview.
    isPreviewExempt: () => !!config.dev || !(G.scene === 'play' && (G.mode === 'comp' || G.mode === 'practice' || G.mode === 'daily')) || G.paused || G.pauseMenu || !!G.think || !S || ['gate', 'judge', 'board', 'end'].includes(S.s.ph) || !!S.s.replay || S.s.over,
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
