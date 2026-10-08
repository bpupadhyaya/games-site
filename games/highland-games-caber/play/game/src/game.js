// Highland Games: Caber Toss, the game shell. Scenes, input, persistence, preview wiring, Watch & Learn. The festival itself lives in sim.js.
import { createSim, DT } from './sim.js';
import { createBot } from './bot.js';
import { SW, H, OX, PANEL, TEXT_SCALES, THINK_STEPS, REF_CLOSE, TEXT_DEC, TEXT_INC, SETUP_PINS, inRect, hudLayout, setScreen, column } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import * as MN from './menus.js';
import { READER, pageViewH } from './menus.js';
import { renderHud, renderFallback, hit as hudHit, CARD, chooseOptions } from './hud.js';
import { createControls } from './controls.js';
import { EVENTS } from './consts.js';
import { clamp } from './util.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_THROWS = 3;

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const ctl = createControls();
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, thinkIdx: 1 },
    setup: { ev: 'caber', level: 2, single: false, watch: false, lastMode: 'festival' },
    ui: { scroll: 0, drag: null, cardScroll: 0 }, page: 0, back: 'title', setupMsg: '', restoreMsg: '',
    record: { demoThrows: 0, bestFestival: 0, bestCaber: 0, bestStone: 0, bestBar: 0 },
    sim: null, paused: false, pauseMenu: false, think: null, feedback: null, needSpeed: 10,
    watch: { phase: 'think', timer: 0, paused: false, holdId: '' }, thinkTotal: 5,
    t: 0, touches: [], multi: false, lay: null, aspect: 720 / 1280, pad: { x: 0, y: 0, active: false }, btnDown: false,
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  let S = null, bot = null, evSeen = 0, simRng = rng.fork(), lastFly = 0;

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
    stride: (q) => tone({ freq: 180 + q * 260, to: 120, dur: 0.07, type: 'triangle', vol: 0.08 + q * 0.05 }),
    miss: () => tone({ freq: 140, to: 90, dur: 0.12, type: 'sawtooth', vol: 0.05 }),
    drop: () => { tone({ freq: 90, to: 50, dur: 0.35, type: 'sine', vol: 0.3 }); tone({ freq: 220, to: 70, dur: 0.25, type: 'square', vol: 0.05 }); },
    ready: () => [0, 7, 12].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.16 + i * 0.03, type: 'triangle', vol: 0.07 })),
    heave: () => { tone({ freq: 200, to: 700, dur: 0.35, type: 'sawtooth', vol: 0.05 }); tone({ freq: 90, to: 60, dur: 0.25, type: 'sine', vol: 0.2 }); },
    thud: () => { tone({ freq: 110, to: 45, dur: 0.4, type: 'sine', vol: 0.4 }); tone({ freq: 700, to: 200, dur: 0.06, type: 'square', vol: 0.05 }); },
    pump: (q) => tone({ freq: 220 + q * 200, to: 330, dur: 0.1, type: 'triangle', vol: 0.09 }),
    put: () => { tone({ freq: 150, to: 70, dur: 0.22, type: 'sine', vol: 0.3 }); tone({ freq: 500, to: 250, dur: 0.1, type: 'triangle', vol: 0.06 }); },
    good: (n) => [0, 4, 7, 12].slice(0, n).forEach((s, i) => tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.2 + i * 0.04, type: 'triangle', vol: 0.09 })),
    bad: () => [0, -3].forEach((n) => tone({ freq: 330 * Math.pow(2, n / 12), dur: 0.26, type: 'triangle', vol: 0.07 })),
    horn: () => tone({ freq: 233, dur: 0.5, type: 'sawtooth', vol: 0.05 }),
  };

  // ---- lifecycle -----------------------------------------------------------------------------------
  function startRun(kind) {
    const st = G.setup;
    let events = EVENTS;
    if (kind === 'single' || (kind === 'watch' && st.ev !== 'all')) events = [st.ev === 'all' ? 'caber' : st.ev];
    const sim = createSim({ level: st.level, events, mode: kind === 'festival' ? 'festival' : kind === 'single' ? 'single' : 'watch', hold: kind === 'watch' }, simRng.fork());
    S = sim; G.sim = sim.s; evSeen = 0; lastFly = 0;
    bot = kind === 'watch' ? createBot(sim, simRng.fork(), 0.9) : null;
    G.mode = kind; G.setup.lastMode = kind === 'watch' && events.length === 1 ? 'watch1' : kind;
    G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.think = null; G.feedback = null; G.ui.scroll = 0;
    G.watch = { phase: 'think', timer: 0, paused: false, holdId: '' };
    ctl.beginPlay(G.touches);
  }
  const leaveRun = () => { G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; S = null; bot = null; G.sim = null; };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; MN.ensureLayout(G, '-'); };

  // ---- sim events: sound, feedback, saving -----------------------------------------------------------
  function processEvents() {
    const s = S.s;
    for (const e of s.events) {
      if (e.id <= evSeen) continue;
      evSeen = e.id;
      const mine = G.mode !== 'watch';
      if (e.type === 'stride') { sfx.stride(e.q); G.feedback = { t: s.t, text: e.q >= 1 ? 'PERFECT' : e.q >= 0.7 ? 'GOOD' : e.q >= 0.4 ? 'OK' : 'SCRAMBLE', col: e.q >= 1 ? '#f0c455' : e.q >= 0.7 ? '#9fd8b0' : '#f6f0e2' }; }
      else if (e.type === 'miss') { sfx.miss(); G.feedback = { t: s.t, text: 'MISSED', col: '#ff9a86' }; }
      else if (e.type === 'drop') { sfx.drop(); G.feedback = { t: s.t, text: 'DROPPED', col: '#ff9a86' }; }
      else if (e.type === 'ready') { sfx.ready(); G.feedback = { t: s.t, text: 'READY: RUN', col: '#9fd8b0' }; }
      else if (e.type === 'heave') sfx.heave();
      else if (e.type === 'lock') sfx.tick();
      else if (e.type === 'put') sfx.put();
      else if (e.type === 'foul') { sfx.horn(); G.feedback = { t: s.t, text: 'FOUL', col: '#ff9a86' }; }
      else if (e.type === 'pump') { sfx.pump(e.q); G.feedback = { t: s.t, text: e.q >= 1 ? 'PERFECT' : e.q >= 0.7 ? 'GOOD' : 'OK', col: e.q >= 1 ? '#f0c455' : '#9fd8b0' }; }
      else if (e.type === 'release') sfx.heave();
      else if (e.type === 'judge') {
        if (e.pts >= 80) sfx.good(4); else if (e.pts > 0) sfx.good(2); else sfx.bad();
        if (mine) noteBest(S.s);
        if (demo && mine) { G.record.demoThrows++; saveAll(); }
      } else if (e.type === 'festivalEnd') { if (G.mode !== 'watch') noteBest(S.s, true); G.scene = 'result'; G.ui.scroll = 0; G.paused = false; G.pauseMenu = false; }
    }
  }
  function noteBest(s, fin) {
    const r = G.record;
    r.bestCaber = Math.max(r.bestCaber, s.best.caber); r.bestStone = Math.max(r.bestStone, s.best.stone); r.bestBar = Math.max(r.bestBar, s.barBest || 0);
    if (fin && s.list.length === 3) r.bestFestival = Math.max(r.bestFestival, s.total);
    saveAll();
  }
  // impact thud when the thing first touches the ground in flight
  function flightSounds() {
    const s = S.s;
    if (s.ph === 'fly' && s.event === 'caber' && s.cab.res) {
      const c = s.cab;
      if (lastFly < c.res.tFirst && c.flyT >= c.res.tFirst) sfx.thud();
      lastFly = c.flyT;
    } else if (s.ph === 'fly' && s.event === 'stone' && s.st.fly) {
      const k = s.st;
      if (lastFly < k.fly.tl && k.flyT >= k.fly.tl) sfx.thud();
      lastFly = k.flyT;
    } else if (s.ph === 'fly' && s.event === 'weight' && s.wt.fly) {
      const k = s.wt;
      if (lastFly < k.fly.tEnd && k.flyT >= k.fly.tEnd) sfx.thud();
      lastFly = k.flyT;
    } else lastFly = -1;
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
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'play') { G.setup.single = false; G.setup.watch = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'single') { G.setup.single = true; G.setup.watch = false; if (G.setup.ev === 'all') G.setup.ev = 'caber'; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { G.setup.watch = true; G.setup.single = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); }
  }
  function tryStart() {
    if (demo && G.record.demoThrows >= DEMO_THROWS && !G.setup.watch) { go('demolimit'); return; }
    startRun(G.setup.watch ? 'watch' : G.setup.single ? 'single' : 'festival');
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('ev-')) st.ev = id.slice(3);
    else if (id.startsWith('lv')) st.level = +id.slice(2);
    else if (id === 'start') tryStart();
    else if (id === 'back') go('title');
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
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
    if (id === 'again') { if (G.setup.lastMode === 'watch' || G.setup.lastMode === 'watch1') { G.setup.watch = true; G.setup.single = false; } tryStart(); }
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
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.page = 0; G.ui.scroll = 0; G.ui.drag = null; if (G.scene === 'play') ctl.beginPlay(G.touches); };
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
  const touchList = (input) => {
    if (G.multi) return G.touches;
    const p = input.pointer;
    return p.down ? [{ id: 0, x: p.x, y: p.y }] : [];
  };
  function afterNext() {
    if (demo && G.mode !== 'watch' && G.record.demoThrows >= DEMO_THROWS) { leaveRun(); go('demolimit'); }
  }
  function overlayClick(id) {
    if (!id) return false;
    if (id === 'pause') { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; ctl.reset(); sfx.tick(); return true; }
    if (id === 'think') { G.think = S.suggest(); G.ui.cardScroll = 0; ctl.reset(); sfx.tick(); return true; }
    if (id === 'think-close') { G.think = null; sfx.tick(); ctl.beginPlay(G.touches); return true; }
    if (id.startsWith('pick:')) { sfx.tick(); S.choose(id.slice(5)); ctl.reset(); return true; }
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
      if (w.holdId !== s.hold.id) { w.holdId = s.hold.id; w.phase = 'think'; G.thinkTotal = THINK_STEPS[G.settings.thinkIdx]; w.timer = G.thinkTotal; G.ui.cardScroll = 0; }
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
      else if (w.phase === 'reveal' && w.timer <= 0) { w.phase = 'act'; S.release(); }
      return;
    }
    S.input(bot());
    S.update(dt);
    processEvents(); flightSounds();
  }
  function updatePlay(dt, input) {
    const s = S.s;
    G.needSpeed = s.wt ? S.needSpeed(s.wt.bar) : 10;
    if (G.pauseMenu) { const inp = colInput('menu', input); MN.ensureLayout(G, 'pause'); updateFlowScene(dt, inp, handlePause, null); column('screen'); return; }
    if (G.mode === 'watch') { updateWatch(dt, input); return; }
    const lay = hudLayout(G.settings.textIdx);
    const ptr = input.pointer;
    if (G.think) {
      cardInput(input);
      if ((ptr.pressed && hudHit(ptr.x, ptr.y) === 'think-close') || input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyT')) { G.think = null; sfx.tick(); ctl.beginPlay(G.touches); }
      return;
    }
    if (ptr.pressed && overlayClick(hudHit(ptr.x, ptr.y))) return;
    if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) { overlayClick('pause'); return; }
    if (input.keys.pressed.has('KeyT')) { overlayClick('think'); return; }
    if (s.ph === 'choose') { for (let i = 0; i < 3; i++) if (input.keys.pressed.has(`Digit${i + 1}`)) { const o = chooseOptions(s)[i]; if (o) { S.choose(o.id); ctl.reset(); return; } } }
    if (s.ph === 'judge' && input.keys.pressed.has('KeyR')) { S.startReplay(); return; }
    if (s.ph === 'evend' && (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space'))) { overlayClick('next'); return; }
    if (s.ph === 'judge' && (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space'))) { overlayClick('next'); return; }
    const r = ctl.update(touchList(input), lay, input.keys.down, input.keys.pressed, G.aspect > 1);
    G.pad = { x: r.pad.x, y: r.pad.y, active: r.padActive }; G.btnDown = r.act.down;
    S.input({ pad: r.pad, act: r.act });
    S.update(dt);
    processEvents(); flightSounds();
  }

  // ?shot=1 (store screenshots): a real run played by the computer, advanced to a chosen moment and frozen
  function startShot() {
    const q = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
    G.setup.ev = q.get('ev') || 'caber'; G.setup.level = 2;
    startRun('single'); G.mode = 'shot'; G.setup.lastMode = 'shot';
    bot = createBot(S, simRng.fork(), 0.96);
    const until = q.get('until'), plus = Number(q.get('plus') || 0), n = Number(q.get('ticks') || 0);
    if (until) { for (let i = 0; i < 6000 && !(S.s.ph === until && S.s.attempt === 0); i++) { S.input(bot()); S.update(DT); } for (let i = 0; i < plus; i++) { S.input(bot()); S.update(DT); } }
    else for (let i = 0; i < n; i++) { S.input(bot()); S.update(DT); }
    evSeen = S.s.evId;
  }
  if (config.shot) {
    const sc = new URLSearchParams(globalThis.location ? globalThis.location.search : '').get('scene');
    if (sc && sc !== 'play') { G.scene = sc; G.back = 'title'; G.frozen = true; } else { startShot(); G.frozen = true; }
  }

  return {
    // Menus, Rules, About, settings, Watch & Learn, pause, choices and result cards are free; only live play counts against the preview.
    isPreviewExempt: () => !!config.dev || !(G.scene === 'play' && (G.mode === 'festival' || G.mode === 'single')) || G.paused || G.pauseMenu || !!G.think || !S || ['choose', 'judge', 'evend', 'end'].includes(S.s.ph) || !!S.s.replay || S.s.over,
    setTouches(list) { G.multi = true; G.touches = list; },
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
          renderHud(ctx, G, v, null);
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
