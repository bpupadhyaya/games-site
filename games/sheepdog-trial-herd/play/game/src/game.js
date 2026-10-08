// Sheepdog Trials, the game shell. Scenes, input, persistence, preview wiring, Watch & Learn, training. The trial itself lives in sim.js.
import { createSim, DT, CMD_NAME } from './sim.js';
import { createBot } from './bot.js';
import { COURSE_ORDER } from './courses.js';
import { SW, H, OX, PANEL, TEXT_SCALES, THINK_STEPS, REF_CLOSE, TEXT_DEC, TEXT_INC, SETUP_PINS, inRect, setScreen, column } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import * as MN from './menus.js';
import { READER, pageViewH } from './menus.js';
import { renderHud, renderFallback, hit as hudHit, CARD } from './hud.js';
import { LESSONS } from './training.js';
import { clamp } from './util.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_RUNS = 2;
const KEYCMD = { KeyD: 'comebye', ArrowRight: 'comebye', KeyA: 'away', ArrowLeft: 'away', KeyW: 'walkon', ArrowUp: 'walkon', KeyS: 'lie', ArrowDown: 'lie', Space: 'stand' };
const WEATHERS = ['clear', 'breeze', 'mist', 'rain'], TODS = ['dawn', 'day', 'dusk'];

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, dev: !!config.dev, loaded: false,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, cam: 'auto' },
    setup: { course: 'valley', weather: 'clear', tod: 'day', watch: false, lastMode: 'trial' },
    ui: { scroll: 0, drag: null, cardScroll: 0 }, page: 0, back: 'title', setupMsg: '', restoreMsg: '',
    record: { demoRuns: 0, best: {}, lessons: [], plays: 0 },
    sim: null, attract: null, lessonIdx: 0, paused: false, pauseMenu: false, think: null, feedback: null, note: null, toast: null,
    watch: { phase: 'think', timer: 0, paused: false, pending: null, last: null }, thinkTotal: 5,
    t: 0, lay: null, aspect: 720 / 1280, fi: 0,
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  let S = null, bot = null, evSeen = 0;
  const simRng = rng.fork(), attractRng = rng.fork();
  let AS = null, abot = null, attractN = 0;

  // ---- persistence ----------------------------------------------------------------------------------
  const saveAll = () => { storage.set('settings', G.settings); storage.set('record', G.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(G.settings, s);
    if (r) Object.assign(G.record, r);
    if (!G.record.best) G.record.best = {};
    if (!Array.isArray(G.record.lessons)) G.record.lessons = [];
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (G.settings.cam !== 'chase') G.settings.cam = 'auto';
    G.loaded = true;
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound: whistle phrases, bleats, the lead ewe's bell, the gate --------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    comebye: () => { tone({ freq: 1050, to: 1500, dur: 0.22, type: 'sine', vol: 0.08 }); tone({ freq: 1500, to: 1650, dur: 0.14, type: 'sine', vol: 0.05 }); },
    away: () => { tone({ freq: 1600, to: 1200, dur: 0.2, type: 'sine', vol: 0.08 }); tone({ freq: 1200, to: 900, dur: 0.16, type: 'sine', vol: 0.05 }); },
    walkon: () => { tone({ freq: 1250, dur: 0.1, type: 'sine', vol: 0.07 }); tone({ freq: 1250, dur: 0.1, type: 'sine', vol: 0.05 }); },
    lie: () => tone({ freq: 1100, to: 650, dur: 0.5, type: 'sine', vol: 0.08 }),
    stand: () => tone({ freq: 1350, dur: 0.38, type: 'sine', vol: 0.07 }),
    bleat: () => { tone({ freq: 360, to: 300, dur: 0.28, type: 'sawtooth', vol: 0.028 }); tone({ freq: 500, to: 380, dur: 0.22, type: 'triangle', vol: 0.02 }); },
    bell: () => tone({ freq: 1180, to: 1160, dur: 0.12, type: 'triangle', vol: 0.014 }),
    gate: (open) => { tone({ freq: open ? 150 : 100, to: open ? 220 : 60, dur: 0.18, type: 'square', vol: 0.05 }); tone({ freq: 700, to: 300, dur: 0.06, type: 'triangle', vol: 0.05 }); },
    good: (n) => [0, 4, 7, 12].slice(0, n).forEach((st, i) => tone({ freq: 523 * Math.pow(2, st / 12), dur: 0.2 + i * 0.04, type: 'triangle', vol: 0.09 })),
    bad: () => [0, -3].forEach((n) => tone({ freq: 330 * Math.pow(2, n / 12), dur: 0.26, type: 'triangle', vol: 0.07 })),
  };

  // ---- lifecycle -------------------------------------------------------------------------------------
  function startRun(kind) {
    const st = G.setup;
    const opts = kind === 'train' ? { course: 'meadow', lesson: G.lessonIdx, weather: 'clear', tod: 'day' } : { course: st.course, weather: st.weather, tod: st.tod };
    const sim = createSim(opts, simRng.fork());
    S = sim; G.sim = sim.s; evSeen = 0; G.nfaults = 0;
    bot = createBot(sim, simRng.fork());
    G.mode = kind; if (kind !== 'train') G.setup.lastMode = kind;
    G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.think = null; G.feedback = null; G.note = null; G.toast = null; G.ui.scroll = 0; G.ui.cardScroll = 0;
    G.watch = { phase: 'think', timer: 0, paused: false, pending: null, last: null };
    if (kind === 'watch') { G.thinkTotal = THINK_STEPS[G.settings.thinkIdx]; G.watch.pending = bot.advise(); G.watch.timer = G.thinkTotal; }
    if (kind === 'train') G.toast = { t: G.t, text: `Lesson ${G.lessonIdx + 1}: ${LESSONS[G.lessonIdx].title}` };
  }
  const leaveRun = () => { G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; S = null; bot = null; G.sim = null; };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; MN.ensureLayout(G, '-'); };

  // ---- sim events: sound, shouts, saving -----------------------------------------------------------------
  function processEvents() {
    const s = S.s;
    for (const e of s.events) {
      if (e.id <= evSeen) continue;
      evSeen = e.id;
      if (e.type === 'cmd') { sfx[e.cmd]?.(); G.feedback = { t: s.t, text: `${CMD_NAME[e.cmd]}!`, col: '#f2c35b' }; }
      else if (e.type === 'bleat') { if (e.id % 3 === 0) sfx.bleat(); }
      else if (e.type === 'gate') { G.toast = { t: G.t, text: e.passed ? 'Through the gate' : `${s.sheep.length - e.thr} sheep missed the gate` }; if (e.passed) sfx.good(2); else sfx.bad(); }
      else if (e.type === 'phase') { const names = { lift: 'Outrun done: now the lift', fetch: 'The flock is on its way', drive1: 'Fetch done: now the drive', drive2: 'Cross to the second gate', pen: 'Now the pen' }; if (names[e.phase]) G.toast = { t: G.t, text: names[e.phase] }; sfx.tick(); }
      else if (e.type === 'gateOpen') sfx.gate(true);
      else if (e.type === 'gateShut') sfx.gate(false);
      else if (e.type === 'arrived') G.toast = { t: G.t, text: 'The handler is at the pen gate' };
      else if (e.type === 'breakaway') { G.toast = { t: G.t, text: 'A ewe has broken away' }; sfx.bad(); }
      else if (e.type === 'tired') G.toast = { t: G.t, text: 'The dog is out of breath: Lie down' };
      else if (e.type === 'lesson') { sfx.good(4); if (G.mode === 'train') { G.record.lessons[G.lessonIdx] = true; saveAll(); } }
      else if (e.type === 'finish') {
        if (G.mode === 'trial') { noteBest(s); sfx.good(e.total >= 80 ? 4 : 2); } else sfx.good(2);
        G.scene = 'result'; G.ui.scroll = 0; G.paused = false; G.pauseMenu = false; G.think = null;
      }
    }
    // judge's notes as they are written
    if (s.faults.length > (G.nfaults || 0)) { const f = s.faults[s.faults.length - 1]; G.note = { t: s.t, text: `−${f.pts}  ${f.why}` }; }
    G.nfaults = s.faults.length;
    // the lead ewe's bell
    const l = s.sheep[0];
    if (G.settings.sound && l && l.sp > 0.7) { const k = Math.floor(s.t * (1.2 + l.sp * 0.5)); if (k !== G.bellK) { G.bellK = k; sfx.bell(); } }
  }
  function noteBest(s) {
    const r = G.record;
    if (!s.retired || s.total > 0) r.best[s.course] = Math.max(r.best[s.course] || 0, s.total);
    r.plays++; saveAll();
  }

  // ---- scrolling ---------------------------------------------------------------------------------------------
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
    if (ptr.pressed && R && ptr.x >= R.x && ptr.x <= R.x + R.w + 24 && ptr.y >= R.y && ptr.y <= R.y + R.h) G.ui.cardDrag = { y0: ptr.y, s0: G.ui.cardScroll || 0, moved: 0 };
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

  // ---- menu handlers --------------------------------------------------------------------------------------------
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'play') { G.setup.watch = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { G.setup.watch = true; go('setup'); G.setupMsg = ''; }
    else if (id === 'train') go('train');
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); }
  }
  function tryStart() {
    if (!MN.unlocked(G, G.setup.course)) { G.setupMsg = 'That course is locked: score 50 on the one before.'; return; }
    if (demo && G.record.demoRuns >= DEMO_RUNS && !G.setup.watch) { go('demolimit'); return; }
    if (demo && !G.setup.watch) { G.record.demoRuns++; saveAll(); }
    startRun(G.setup.watch ? 'watch' : 'trial');
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('c-')) { if (MN.unlocked(G, id.slice(2))) { st.course = id.slice(2); G.setupMsg = ''; } else G.setupMsg = 'That course is locked: score 50 on the one before.'; }
    else if (id.startsWith('t-')) st.tod = id.slice(2);
    else if (id.startsWith('w-')) st.weather = id.slice(2);
    else if (id === 'start') tryStart();
    else if (id === 'back') go('title');
  }
  function handleTrain(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id.startsWith('l-')) { G.lessonIdx = +id.slice(2); startRun('train'); }
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
    if (id === 'again') { G.setup.watch = G.setup.lastMode === 'watch'; tryStart(); }
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
    else if (id === 'quit') { const train = G.mode === 'train'; leaveRun(); if (train) go('train'); }
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
  function colInput(kind, input) {
    column(kind);
    const p = input.pointer;
    const inp = OX ? { keys: input.keys, pointer: { x: p.x - OX, y: p.y, down: p.down, pressed: p.pressed, released: p.released } } : input;
    setPress(inp.pointer);
    return inp;
  }
  const COLUMN = { title: 'title', setup: 'menu', train: 'menu', settings: 'menu', result: 'menu', demolimit: 'menu', howto: 'reader', about: 'reader', rules: 'reader' };

  // ---- the attract trial behind the menus ---------------------------------------------------------------------------
  function stepAttract() {
    if (!AS || AS.s.over || AS.s.t > 150) {
      const o = { course: COURSE_ORDER[attractN % 3], weather: WEATHERS[(attractN * 3 + 1) % WEATHERS.length], tod: TODS[attractN % 3] };
      if (attractN === 0) { o.course = 'valley'; o.weather = 'clear'; o.tod = 'day'; }
      attractN++;
      AS = createSim(o, attractRng.fork()); abot = createBot(AS, attractRng.fork()); G.attract = AS.s;
    }
    if (G.fi % 6 === 0) { const d = abot.next(); if (d) { if (d.gate) AS.toggleGate(); else AS.command(d.cmd); } }
    AS.update(DT);
  }

  // ---- the play update -------------------------------------------------------------------------------------------
  function doCommand(cmd) { if (S.command(cmd)) { G.think = null; } }
  function overlayClick(id) {
    if (!id) return false;
    if (id.startsWith('cmd:')) { doCommand(id.slice(4)); return true; }
    if (id === 'pause') { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; sfx.tick(); return true; }
    if (id === 'think') { G.think = bot.advise(); G.ui.cardScroll = 0; sfx.tick(); return true; }
    if (id === 'think-close') { G.think = null; sfx.tick(); return true; }
    if (id === 'cam') { G.settings.cam = G.settings.cam === 'chase' ? 'auto' : 'chase'; saveAll(); sfx.tick(); return true; }
    if (id === 'gate') { S.toggleGate(); return true; }
    if (id === 'lesson-next') {
      sfx.tick();
      if (G.lessonIdx < LESSONS.length - 1) { G.lessonIdx++; startRun('train'); } else { leaveRun(); go('train'); }
      return true;
    }
    return false;
  }
  function updateWatch(dt, input) {
    const s = S.s, w = G.watch;
    cardInput(input);
    if (input.pointer.pressed) {
      const id = hudHit(input.pointer.x, input.pointer.y);
      if (id === 'w-pause') { w.paused = !w.paused; sfx.tick(); }
      else if (id === 'w-faster') { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveAll(); sfx.tick(); }
      else if (id === 'w-slower') { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveAll(); sfx.tick(); }
      else if (id === 'w-quit') { leaveRun(); return; }
    }
    if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) w.paused = !w.paused;
    if (w.paused) return;                                    // freezes everything: timers, sim, motion
    if (w.pending) {
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
      else if (w.phase === 'reveal' && w.timer <= 0) {
        const d = w.pending; w.pending = null; w.last = d; w.phase = 'act';
        if (d.gate) S.toggleGate(); else S.command(d.cmd);
        w.nextCheck = s.t + 0.3;
      }
      processEvents();
      return;
    }
    S.update(DT);
    processEvents();
    if (!S.s.over && s.t >= (w.nextCheck || 0) && G.fi % 6 === 0) {
      const d = bot.next();
      if (d) { w.pending = d; w.phase = 'think'; G.thinkTotal = THINK_STEPS[G.settings.thinkIdx]; w.timer = G.thinkTotal; G.ui.cardScroll = 0; }
    }
  }
  function updatePlay(dt, input) {
    const s = S.s;
    if (G.pauseMenu) { const inp = colInput('menu', input); MN.ensureLayout(G, 'pause'); updateFlowScene(dt, inp, handlePause, null); column('screen'); return; }
    if (G.mode === 'watch') { updateWatch(dt, input); return; }
    const ptr = input.pointer, k = input.keys;
    if (G.think) {
      cardInput(input);
      const hh = ptr.pressed ? hudHit(ptr.x, ptr.y) : null;
      if (hh === 'think-close' || k.pressed.has('Escape') || k.pressed.has('KeyT')) { G.think = null; sfx.tick(); }
      else if (hh && hh.startsWith('cmd:')) { G.think = null; doCommand(hh.slice(4)); }          // a command tap closes the hint and is obeyed at once
      return;
    }
    if (ptr.pressed) overlayClick(hudHit(ptr.x, ptr.y));
    if (G.pauseMenu || G.think) return;
    if (k.pressed.has('KeyP') || k.pressed.has('Escape')) { overlayClick('pause'); return; }
    if (k.pressed.has('KeyT')) { overlayClick('think'); return; }
    if (k.pressed.has('KeyC')) overlayClick('cam');
    if (k.pressed.has('KeyG')) overlayClick('gate');
    for (const [code, cmd] of Object.entries(KEYCMD)) if (k.pressed.has(code)) doCommand(cmd);
    if (S && !S.s.over) S.update(DT);
    if (!S) return;
    processEvents();
    if (S.s.training && S.s.lesson.done && S.s.lesson.doneT > 0.8 && k.pressed.has('Enter')) overlayClick('lesson-next');
    void s;
  }

  // ?shot=1 (store screenshots): a real run played by the handler, advanced to a chosen moment and frozen
  function startShot() {
    const q = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
    G.setup.course = q.get('course') || 'valley'; G.setup.weather = q.get('weather') || 'clear'; G.setup.tod = q.get('tod') || 'day';
    if (q.get('train') !== null) { G.lessonIdx = Number(q.get('train')) || 0; startRun('train'); G.mode = 'shot'; } else if (q.get('watch') !== null) { startRun('watch'); G.mode = 'shot'; } else { startRun('trial'); G.mode = 'shot'; }
    const hb = createBot(S, simRng.fork());
    const until = q.get('until'), plus = Number(q.get('plus') || 0), n = Number(q.get('ticks') || 0);
    const stepBot = (i) => { if (i % 6 === 0) { const d = hb.next(); if (d) { if (d.gate) S.toggleGate(); else S.command(d.cmd); } } S.update(DT); };
    let i = 0;
    if (until) { for (; i < 60 * 500 && S.s.phase !== until; i++) stepBot(i); for (let j = 0; j < plus; j++, i++) stepBot(i); }
    else for (; i < n; i++) stepBot(i);
    if (q.get('cam')) G.settings.cam = q.get('cam');
    if (q.get('pause') !== null) { G.paused = true; G.pauseMenu = true; }
    if (q.get('watch') !== null) { G.mode = 'watch'; const a = hb.advise(); G.watch.pending = a; G.watch.phase = q.get('watch') === 'reveal' ? 'reveal' : 'think'; G.watch.timer = 3.4; }
    if (q.get('think') !== null) G.think = hb.advise();
    evSeen = S.s.evId; G.nfaults = S.s.faults.length;
  }
  if (config.shot) {
    const q = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
    const sc = q.get('scene');
    if (sc && sc !== 'play') {
      G.scene = sc; G.back = 'title'; G.frozen = true;
      if (sc !== 'result') { const nt = Number(q.get('ticks') || 900); for (let i = 0; i < nt; i++) { G.fi++; stepAttract(); } }
      if (sc === 'result') { G.setup.course = q.get('course') || 'valley'; const o = createSim({ course: G.setup.course, weather: 'clear', tod: 'day' }, simRng.fork()); const hb = createBot(o, simRng.fork()); for (let i = 0; i < 60 * 600 && !o.s.over; i++) { if (i % 6 === 0) { const d = hb.next(); if (d) { if (d.gate) o.toggleGate(); else o.command(d.cmd); } } o.update(DT); } S = o; G.sim = o.s; G.mode = 'trial'; }
    } else { startShot(); G.frozen = true; }
  }

  return {
    // Menus, Rules, About, Training, Watch & Learn, pause, the Think hint and the result card are free; only live play of a trial counts against the preview.
    isPreviewExempt: () => !!config.dev || !(G.scene === 'play' && G.mode === 'trial') || G.paused || G.pauseMenu || !!G.think || !S || S.s.over,
    wheel(dy) { G.wheelAcc = (G.wheelAcc || 0) + dy; },
    update(dt, raw) {
      setScreen(meta.width, meta.height);
      G.fi++;
      if (G.frozen) return;                                   // ?shot=1: a store screenshot frame stays exactly as built
      const kind = G.scene === 'play' ? 'screen' : (COLUMN[G.scene] || 'menu');
      const input = kind === 'screen' ? (column('screen'), setPress(raw.pointer), raw) : colInput(kind, raw);
      G.t += dt;
      if (G.scene !== 'play' && G.scene !== 'result') stepAttract();
      switch (G.scene) {
        case 'title': {
          const lt = MN.getLockTap(), pp = input.pointer;
          MN.setLockDown(G.lockDown > G.t);
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { G.lockDown = G.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(dt, input, handleTitle, 'title'); break;
        }
        case 'setup': updatePinned(dt, input, 'setup', handleSetup); break;
        case 'train': updateFlowScene(dt, input, handleTrain, 'train'); break;
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
      if (view && view.noGL) {
        const keep = G.sim;
        if (!G.sim && G.attract) G.sim = G.attract;
        renderFallback(ctx, G, view); G.sim = keep;
      }
      const kind = G.scene === 'play' ? 'screen' : (COLUMN[G.scene] || 'menu');
      const ox = column(kind);
      ctx.save(); ctx.translate(ox, 0);
      switch (G.scene) {
        case 'title': MN.renderTitle(ctx, G); break;
        case 'setup': MN.renderSetup(ctx, G); break;
        case 'train': MN.renderTrain(ctx, G); break;
        case 'settings': MN.renderSettings(ctx, G); break;
        case 'result': MN.renderResult(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'howto': MN.renderPages(ctx, G, HOWTO, 'How to Play'); break;
        case 'about': MN.renderPages(ctx, G, aboutList, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        case 'play':
          renderHud(ctx, G, view);
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
