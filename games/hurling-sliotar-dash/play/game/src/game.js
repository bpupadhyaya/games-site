// Hurling: Sliotar Dash — the game shell. Scenes, input, persistence, preview wiring, Learn, Watch & Learn. The match lives in sim.js.
import { createSim } from './sim.js';
import { SW, H, OX, PANEL, TEXT_SCALES, THINK_STEPS, REF_CLOSE, TEXT_DEC, TEXT_INC, SETUP_PINS, inRect, hudLayout, setScreen, column } from './layout.js';
import { isSide } from './camera.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES, LESSONS, QUIZ } from './content.js';
import * as MN from './menus.js';
import { READER, pageViewH } from './menus.js';
import { renderHud, renderFallback, renderThink, renderMarks, watchHit, fmtScore, totalPts, TEAM_NAME, CARD } from './hud.js';
import { createControls } from './controls.js';
import { createDrill } from './drills.js';
import { ROLES, CHOICES } from './consts.js';
import { clamp } from './util.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_MATCH_CAP = 2;
const SAVE_VERSION = 1;
const ASSIST = { off: 0, normal: 0.7, strong: 0.92 };

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const ctl = createControls();
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, assist: 'normal', thinkIdx: 1 },
    setup: { role: 5, opp: 3, mate: 3, mode: 'full', watch: false, watchA: 3, watchB: 3, lastMode: 'ai' },
    ui: { scroll: 0, drag: null }, page: 0, back: 'title', setupMsg: '', restoreMsg: '',
    learn: { cur: 0, qi: 0, qscore: 0, done: {}, result: null, tally: null },
    saved: null, record: { demoMatches: 0 },
    sim: null, snap: null, alpha: 1, updAt: 0, paused: false, pauseMenu: false, think: null, thinkRects: null, feedback: null, mark: -1,
    watch: { phase: 'think', timer: 0, paused: false, holdId: -1 }, t: 0, touches: [], multi: false, hud: null, aspect: 720 / 1280,
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  let S = null, evSeen = 0, snap = null, simRng = rng.fork(), drill = null;
  const nowMs = () => (env.clock ? env.clock() : 0);
  const takeSnap = (s) => {
    const cur = { x: s.players.map((p) => p.x), z: s.players.map((p) => p.z), f: s.players.map((p) => p.face), b: [s.ball.x, s.ball.y, s.ball.z] };
    G.snap = { prev: G.snap && G.snap.cur && G.snap.t <= s.t ? G.snap.cur : cur, cur, t: s.t };
    G.updAt = nowMs();
  };
  const stepSim = (dt) => { S.update(dt); takeSnap(S.s); };
  const prevKeys = new Set();

  // ---- persistence -------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', G.settings); storage.set('learn', { done: G.learn.done }); storage.set('record', G.record); };
  const roleName = (ri) => (ri === 1 ? 'Back' : ROLES[ri].name);
  const metaOfSave = (d) => ({ roleName: roleName(d.setup.role), half: d.half, you: d.score[0] ? fmtScore(d.score[0]) : '0-00', them: d.score[1] ? fmtScore(d.score[1]) : '0-00' });
  const validSave = (d) => d && d.v === SAVE_VERSION && d.setup && Array.isArray(d.score) && d.score.length === 2 && d.half >= 1 && d.half <= 2 && typeof d.clock === 'number';
  const persistMatch = () => {
    if (!S || G.mode !== 'ai' || S.s.over) return;
    const s = S.s;
    const d = { v: SAVE_VERSION, setup: { ...G.setup }, half: s.half, clock: s.clock, score: s.score.map((x) => ({ ...x })), stats: s.stats.map((x) => ({ ...x })) };
    snap = d; G.saved = metaOfSave(d); storage.set('match', d);
  };
  const clearSave = () => { snap = null; G.saved = null; storage.remove('match'); };

  Promise.all([storage.get('settings', null), storage.get('learn', null), storage.get('record', null), storage.get('match', null)]).then(([s, l, r, mch]) => {
    if (s) Object.assign(G.settings, s);
    if (l && l.done) G.learn.done = l.done;
    if (r) Object.assign(G.record, r);
    if (validSave(mch)) { snap = mch; G.saved = metaOfSave(mch); }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!(G.settings.assist in ASSIST)) G.settings.assist = 'normal';
    G.loaded = true;
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    strike: (q) => { tone({ freq: 1100 + q * 400, to: 420, dur: 0.05, type: 'square', vol: 0.07 }); tone({ freq: 160, to: 70, dur: 0.12, type: 'sine', vol: 0.18 }); },
    pass: () => tone({ freq: 520, to: 360, dur: 0.07, type: 'triangle', vol: 0.08 }),
    catch: () => tone({ freq: 200, to: 120, dur: 0.1, type: 'sine', vol: 0.14 }),
    hook: () => { tone({ freq: 900, to: 300, dur: 0.06, type: 'square', vol: 0.06 }); tone({ freq: 130, to: 80, dur: 0.1, type: 'triangle', vol: 0.12 }); },
    bounce: () => tone({ freq: 240, to: 150, dur: 0.07, type: 'sine', vol: 0.06 }),
    post: () => tone({ freq: 1500, to: 900, dur: 0.18, type: 'sine', vol: 0.1 }),
    score: (win) => (win ? [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.04, type: 'triangle', vol: 0.09 })) : [0, -3].forEach((n) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.26, type: 'triangle', vol: 0.07 }))),
    whistle: () => tone({ freq: 2400, to: 2100, dur: 0.3, type: 'sine', vol: 0.05 }),
  };

  // ---- match lifecycle -------------------------------------------------------------------------------
  const setSim = (sim) => { S = sim; G.sim = sim.s; evSeen = 0; G.feedback = null; G.think = null; G.mark = -1; G.snap = null; takeSnap(sim.s); };
  const startDemoBg = () => { drill = null; setSim(createSim({ levels: [3, 3], human: null, mode: 'quick', assist: 0.7 }, simRng.fork())); G.mode = 'none'; };
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    let cfg;
    if (kind === 'ai') {
      if (demo && G.record.demoMatches >= DEMO_MATCH_CAP && !opts.resume) { G.scene = 'demolimit'; G.ui.scroll = 0; return; }
      cfg = { human: st.role, levels: [st.mate, st.opp], mode: demo ? 'quick' : st.mode, assist: ASSIST[G.settings.assist] };
    } else if (kind === 'watch') {
      cfg = { human: null, levels: [st.watchA, st.watchB], mode: 'quick', watch: true, hold: true, assist: 0.7 };
    } else if (kind === 'drill') {
      const l = LESSONS[G.learn.cur];
      cfg = { human: l.role, levels: [3, 2], mode: 'quick', drill: l.drill.kind, assist: ASSIST[G.settings.assist] };
    }
    if (opts.resume) { cfg.resume = opts.resume; cfg.mode = G.setup.mode; }
    G.mode = kind; G.setup.lastMode = kind;
    setSim(createSim(cfg, simRng.fork()));
    drill = null;
    if (kind === 'drill') drill = createDrill(S, cfg.drill, simRng.fork());
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = !!opts.paused; G.ui.scroll = 0; G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1 };
    ctl.beginPlay(G.touches);
    if (kind === 'ai') { if (demo && !opts.resume) { G.record.demoMatches++; saveSettings(); } if (!opts.resume) persistMatch(); }
  }
  const resumeMatch = () => {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    Object.assign(G.setup, d.setup);
    startMatch('ai', { resume: { half: d.half, clock: d.clock, score: d.score, stats: d.stats }, paused: true });
  };
  const leaveMatch = () => { persistMatch(); G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; startDemoBg(); };

  // ---- learn --------------------------------------------------------------------------------------------
  function startLesson() {
    const l = LESSONS[G.learn.cur];
    if (l.quiz) { G.learn.qi = 0; G.learn.qscore = 0; G.scene = 'quiz'; G.ui.scroll = 0; return; }
    G.learn.tally = { n: 0, ok: 0 };
    startMatch('drill');
  }
  function drillOutcome(o) {
    const l = LESSONS[G.learn.cur], T = G.learn.tally;
    T.n++; if (o.ok) T.ok++;
    G.feedback = { t: S.s.t, text: o.ok ? 'Good' : 'Not this time', col: o.ok ? '#7fe8d6' : '#ffb59a' };
    if (T.n >= l.n) {
      G.learn.result = { score: T.ok, n: l.n, pass: T.ok >= l.need };
      if (G.learn.result.pass) { G.learn.done[l.id] = true; saveSettings(); }
      G.scene = 'lessonresult'; G.ui.scroll = 0; G.mode = 'none'; startDemoBg();
    }
  }

  // ---- events from the sim: sound, feedback, saving ------------------------------------------------
  function processEvents() {
    const s = S.s, mine = s.cfg.human >= 0 ? 0 : -1;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (G.scene !== 'play' && G.mode !== 'none') continue;
      if (e.type === 'strike') { sfx.strike(e.q || 0.5); if (e.by === s.cfg.human && G.mode !== 'watch') { const q = e.q; G.feedback = { t: s.t, text: q >= 0.8 ? 'PERFECT' : q >= 0.5 ? 'GOOD' : q >= 0.25 ? 'OK' : 'LOOSE', col: q >= 0.8 ? '#7fe8d6' : q >= 0.5 ? '#ffe9a0' : '#fff6e4' }; } }
      else if (e.type === 'pass') sfx.pass();
      else if (e.type === 'catch' || e.type === 'rise' || e.type === 'fumble') sfx.catch();
      else if (e.type === 'hook' || e.type === 'shoulder' || e.type === 'block' || e.type === 'blockdown') sfx.hook();
      else if (e.type === 'bounce') sfx.bounce();
      else if (e.type === 'post' || e.type === 'bar') sfx.post();
      else if (e.type === 'score') { sfx.whistle(); const win = mine < 0 ? true : e.team === 0; later(() => sfx.score(win)); if (G.mode === 'ai') persistMatch(); }
      else if (e.type === 'foul' || e.type === 'wide' || e.type === 'side') sfx.whistle();
      else if (e.type === 'halfEnd') { sfx.whistle(); if (G.mode === 'ai') persistMatch(); }
      else if (e.type === 'matchEnd') { if (G.mode === 'ai' || G.mode === 'watch') { if (G.mode === 'ai') clearSave(); G.scene = 'result'; G.ui.scroll = 0; } }
    }
  }
  const delayed = [];
  const later = (f) => delayed.push({ t: 0.35, f });

  // ---- watch & learn ---------------------------------------------------------------------------------
  function updateWatch(dt) {
    const s = S.s, w = G.watch;
    if (w.paused) return false;
    if (s.hold) {
      if (w.holdId !== s.hold.id) { w.holdId = s.hold.id; w.phase = 'think'; w.timer = THINK_STEPS[G.settings.thinkIdx]; }
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
      else if (w.phase === 'reveal' && w.timer <= 0) { w.phase = 'act'; S.release(); G.mark = -1; return true; }
      return false;
    }
    return true;
  }

  // ---- menus -----------------------------------------------------------------------------------------------
  // Scrolling by wheel and keys, shared by every scrolling screen (readers, menus, cards). `view` = visible height, `max` = furthest scroll.
  // Wheel: game.wheel(deltaY) from the shell. Keys: arrows, PageUp / PageDown, Space (Shift+Space up), Home, End.
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
  // drag inside a text card (Think card, Watch & Learn panel): returns true when this pointer press belongs to the card's text
  function cardInput(input) {
    const ptr = input.pointer, R = CARD.rect;
    if (ptr.pressed && R && ptr.x >= R.x && ptr.x <= R.x + R.w + 24 && ptr.y >= R.y && ptr.y <= R.y + R.h) G.ui.cardDrag = { y0: ptr.y, s0: G.ui.cardScroll || 0 };
    if (G.ui.cardDrag && ptr.down) G.ui.cardScroll = clamp(G.ui.cardDrag.s0 - (ptr.y - G.ui.cardDrag.y0), 0, CARD.max);
    if (ptr.released) G.ui.cardDrag = null;
    scrollInput(input, CARD.max, CARD.view, 'cardScroll');
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); saveSettings(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); saveSettings(); }
    scrollInput(input, max, mt.bottom - mt.top);
  };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; MN.ensureLayout(G, '-'); };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'continue') resumeMatch();
    else if (id === 'play') { G.setup.watch = false; G.setup.mode = demo ? 'quick' : 'full'; go('setup'); G.setupMsg = ''; }
    else if (id === 'quick') { G.setup.watch = false; G.setup.mode = 'quick'; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { G.setup.watch = true; go('setup'); G.setupMsg = ''; }
    else if (id === 'learn') go('learn');
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); }
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('role')) st.role = +id.slice(4);
    else if (id.startsWith('opp')) st.opp = +id.slice(3);
    else if (id.startsWith('mate')) st.mate = +id.slice(4);
    else if (id.startsWith('wa')) st.watchA = +id.slice(2);
    else if (id.startsWith('wb')) st.watchB = +id.slice(2);
    else if (id === 'len-full') st.mode = 'full';
    else if (id === 'len-quick') st.mode = 'quick';
    else if (id === 'start') {
      if (demo && st.opp > 2 && !st.watch) { G.setupMsg = 'The free demo has the first two rivals.'; return; }
      if (st.watch) startMatch('watch'); else go('role');
    } else if (id === 'back') go('title');
  }
  function handleRole(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'start') startMatch('ai'); else if (id === 'back') go('setup');
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); G.ui.scroll = 0; }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); G.ui.scroll = 0; }
    else if (id.startsWith('as-')) st.assist = id.slice(3);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; }).catch(() => { G.restoreMsg = 'Could not reach the store.'; }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveSettings();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'again') startMatch(G.setup.lastMode === 'watch' ? 'watch' : 'ai');
    else if (id === 'new') { if (G.setup.lastMode === 'watch') startMatch('watch'); else go('setup'); }
    else if (id === 'menu') { go('title'); startDemoBg(); }
  }
  function handleLearn(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id.startsWith('lesson') && id !== 'lesson-go' && id !== 'lesson-back') { G.learn.cur = +id.slice(6); go('lesson'); }
  }
  function handleLesson(id) { if (!id) return; sfx.tick(); if (id === 'lesson-go') startLesson(); else if (id === 'lesson-back') go('learn'); }
  function handleQuiz(id) {
    if (!id) return;
    sfx.tick();
    const i = +id.slice(3);
    if (i === QUIZ[G.learn.qi].ok) G.learn.qscore++;
    G.learn.qi++;
    if (G.learn.qi >= QUIZ.length) {
      const l = LESSONS[G.learn.cur];
      G.learn.result = { score: G.learn.qscore, n: QUIZ.length, pass: G.learn.qscore >= l.need };
      if (G.learn.result.pass) { G.learn.done[l.id] = true; saveSettings(); }
      go('lessonresult');
    } else G.ui.scroll = 0;
  }
  function handleLessonResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'lr-again') startLesson();
    else if (id === 'lr-next') { G.learn.cur = Math.min(LESSONS.length - 1, G.learn.cur + 1); go('lesson'); }
    else if (id === 'lr-list') go('learn');
  }
  function handlePause(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') { G.paused = false; G.pauseMenu = false; }
    else if (id === 'p-rules') { G.back = 'play'; go('rules'); }
    else if (id === 'p-howto') { G.back = 'play'; go('howto'); }
    else if (id === 'p-sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); }
    else if (id === 'p-txt-dec') { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); G.ui.scroll = 0; saveSettings(); }
    else if (id === 'p-txt-inc') { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); G.ui.scroll = 0; saveSettings(); }
    else if (id === 'quit') { if (G.mode === 'drill') { go('learn'); G.mode = 'none'; G.paused = false; G.pauseMenu = false; startDemoBg(); } else leaveMatch(); }
  }
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const max = READER.max || 0, view = pageViewH();
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.page = 0; G.ui.scroll = 0; G.ui.drag = null; if (G.scene === 'play') ctl.beginPlay(G.touches); };
    const zoom = (d) => { const n = clamp(G.settings.textIdx + d, 0, TEXT_SCALES.length - 1); if (n !== G.settings.textIdx) { G.settings.textIdx = n; G.ui.scroll = 0; saveSettings(); } };
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

  // ---- the play update ------------------------------------------------------------------------------
  // pointer in the coordinates of the current menu column (menus and readers are drawn in a column centred on the screen in landscape)
  function colInput(kind, input) {
    column(kind);
    const p = input.pointer;
    const inp = OX ? { keys: input.keys, pointer: { x: p.x - OX, y: p.y, down: p.down, pressed: p.pressed, released: p.released } } : input;
    setPress(inp.pointer);
    return inp;
  }
  const COLUMN = { title: 'title', setup: 'menu', role: 'menu', settings: 'menu', learn: 'menu', lesson: 'menu', quiz: 'menu', lessonresult: 'menu', result: 'menu', demolimit: 'menu', howto: 'reader', about: 'reader', rules: 'reader' };
  const touchList = (input) => {
    if (G.multi) return G.touches;
    const p = input.pointer;
    return p.down ? [{ id: 0, x: p.x, y: p.y }] : [];
  };
  function openThink() {
    const s = S.s, p = s.players[s.cfg.human];
    if (!p) return;
    const d = S.suggest(p);
    if (d) G.think = { kind: d.kind, summary: d.summary, reason: d.reason, to: d.to ?? -1 };
  }
  function updatePlay(dt, input) {
    const s = S.s;
    if (G.mode === 'shot') { stepSim(dt); processEvents(); return; }
    if (G.pauseMenu) { const inp = colInput('menu', input); MN.ensureLayout(G, 'pause'); updateFlowScene(dt, inp, handlePause, null); column('screen'); return; }
    const lay = hudLayout(G.settings.textIdx);
    const ts = touchList(input);
    if (G.mode === 'watch') {
      cardInput(input);
      if (input.pointer.pressed) {
        const i = watchHit(input.pointer.x, input.pointer.y);
        if (i === 0) { G.watch.paused = !G.watch.paused; sfx.tick(); }
        else if (i === 1) { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveSettings(); }
        else if (i === 2) { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveSettings(); }
        else if (i === 3) { leaveMatch(); return; }
      }
      if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) G.watch.paused = !G.watch.paused;
      if (!updateWatch(dt)) return;
      stepSim(dt); processEvents();
      return;
    }
    if (G.think) {
      cardInput(input);
      if (G.thinkRects && ((input.pointer.pressed && inRect(G.thinkRects.close, input.pointer.x, input.pointer.y)) || input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyT'))) { G.think = null; sfx.tick(); ctl.beginPlay(ts); }
      return;
    }
    const r = ctl.update(ts, lay, input.keys.down, input.keys.pressed, isSide(G.aspect));
    G.hud = r;
    if (r.ui.pause) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; persistMatch(); ctl.reset(); return; }
    if (r.ui.think) { openThink(); ctl.reset(); if (G.think) return; }
    S.input(r.input);
    stepSim(dt);
    if (drill) { const o = drill.tick(dt); if (o) drillOutcome(o); }
    processEvents();
  }

  // ?shot=1 (store screenshots): a real match played by a coached team, frozen after N ticks, with the full HUD
  function startShot() {
    G.mode = 'shot'; G.setup.lastMode = 'shot'; G.setup.role = 3;
    setSim(createSim({ human: 3, levels: [3, 3], mode: 'quick', bot: true, assist: 0.7, readyT: 0.3 }, simRng.fork()));
    S.s.cfg.bot = true;
    G.scene = 'play';
  }
  function startup() { if (config.shot) startShot(); else startDemoBg(); }
  startup();

  return {
    // Menus, Rules, About, settings, Learn text, Watch & Learn, pause and result screens are free; only real play counts against the preview.
    // Only live play of a real match (mode 'ai', play phase, not paused) uses the preview. Dev mode (env.config.dev) unlocks everything.
    isPreviewExempt: () => !!config.dev || !(G.scene === 'play' && G.mode === 'ai') || G.paused || G.pauseMenu || !!G.think || !S || !(S.s.phase === 'play' || S.s.phase === 'restart') || S.s.over,
    setTouches(list) { G.multi = true; G.touches = list; },
    wheel(dy) { G.wheelAcc = (G.wheelAcc || 0) + dy; },
    update(dt, raw) {
      setScreen(meta.width, meta.height);
      const kind = G.scene === 'play' ? 'screen' : (COLUMN[G.scene] || 'menu');
      const input = kind === 'screen' ? (column('screen'), setPress(raw.pointer), raw) : colInput(kind, raw);
      G.t += dt;
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { delayed[i].f(); delayed.splice(i, 1); } }
      if (G.scene !== 'play') { stepSim(dt); if (G.sim.over) startDemoBg(); }
      switch (G.scene) {
        case 'title': {
          const lt = MN.getLockTap(), pp = input.pointer;
          MN.setLockDown(G.lockDown > G.t);
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { G.lockDown = G.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(dt, input, handleTitle, 'title'); break;
        }
        case 'setup': updatePinned(dt, input, 'setup', handleSetup); break;
        case 'role': updatePinned(dt, input, 'role', handleRole); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'learn': updateFlowScene(dt, input, handleLearn, 'learn'); break;
        case 'lesson': updateFlowScene(dt, input, handleLesson, 'lesson'); break;
        case 'quiz': updateFlowScene(dt, input, handleQuiz, 'quiz'); break;
        case 'lessonresult': updateFlowScene(dt, input, handleLessonResult, 'lessonresult'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') go('title'); }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
      G.wheelAcc = 0;
    },
    render(ctx, view) {
      setScreen(meta.width, meta.height);
      G.viewW = (view && view.cssW) || SW; G.viewH = (view && view.cssH) || H;
      G.aspect = G.viewW / G.viewH;
      G.alpha = env.clock && G.updAt ? Math.max(0, Math.min(1, (nowMs() - G.updAt) / (1000 / 60))) : 1;
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
        case 'role': MN.renderRole(ctx, G); break;
        case 'settings': MN.renderSettings(ctx, G); break;
        case 'learn': MN.renderLearn(ctx, G); break;
        case 'lesson': MN.renderLesson(ctx, G); break;
        case 'quiz': MN.renderQuiz(ctx, G); break;
        case 'lessonresult': MN.renderLessonResult(ctx, G); break;
        case 'result': MN.renderResult(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'howto': MN.renderPages(ctx, G, HOWTO, 'How to Play'); break;
        case 'about': MN.renderPages(ctx, G, aboutList, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        case 'play':
          renderHud(ctx, G, v, G.hud);
          renderMarks(ctx, G, v);
          if (G.think) renderThink(ctx, G, v);
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
