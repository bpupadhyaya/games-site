// Rayuela: the game shell. Scenes, input, persistence, preview wiring, Learn, Watch & Learn, sound. The turns themselves live in sim.js.
import { createSim } from './sim.js';
import { scr, setScreen, useColumn, colFor, readerGeom, setupPins, inRect, hudFor, host, clamp } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, rulesPages, LESSONS } from './content.js';
import * as MN from './menus.js';
import { renderHud, renderFallback, watchHit } from './hud.js';
import { hintFor, routeSummary, planSummary, tossReasoning } from './ai.js';
import { TEXT_SCALES, THINK_STEPS, POINT_NAMES, DEMO_MATCH_CAP, SAVE_VERSION, LEVELS, GAME_LENGTHS, STEP } from './consts.js';
import { COURSES, getCourse } from './courses.js';

// fluid: the short side is always 720 units, the long side follows the screen (kit 1.7 fluid viewport); layout.js lays everything out from the live size
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const GRADE_COL = { perfect: '#7fe8d6', good: '#ffe9a0', ok: '#fff6e4' };
const SHORT_N = GAME_LENGTHS[0].numbers;

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const dev = !!config.dev;            // tester switch (?dev=1 / the shell's Developer toggle): the preview never runs out
  const fx = env.fx || null;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, drum: 2, timing: 'standard', offset: 0, thinkIdx: 1, hero: 'f' },
    setup: { course: 'classic', level: 2, watchA: 3, length: 'short', two: false, watch: false, lastKind: 'match' },
    ui: { scroll: 0, drag: null }, page: 0, back: 'title', setupMsg: '', restoreMsg: '',
    learn: { cur: 0, done: {}, result: null },
    saved: null, record: { demoMatches: 0, wins: 0 },
    sim: null, simObj: null, look: { hero: 'f' }, vseed: rng.int(1000), paused: false, pauseMenu: false, thinkOpen: false, thinkData: null,
    fb: null, pressFlash: null, dispT: 0,
    watch: { phase: 'think', timer: 0, paused: false, holdId: -1 }, watchText: '', t: 0,
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  if (config.dev && config.course && COURSES[config.course]) G.setup.course = config.course;
  let S = null, evSeen = 0, snap = null, simRng = rng.fork(), updAt = 0;
  const now = () => (env.clock ? env.clock() : 0);

  // ---- persistence -------------------------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', G.settings); storage.set('learn', { done: G.learn.done }); storage.set('record', G.record); };
  const validSave = (d) => d && d.v === SAVE_VERSION && d.cfg && d.snap && Array.isArray(d.snap.players) && d.snap.players.length >= 1 && COURSES[d.cfg.course];
  const metaOf = (d) => ({ course: COURSES[d.cfg.course].name, names: d.cfg.names, done: d.snap.players.map((p) => p.done), target: d.cfg.target || COURSES[d.cfg.course].N });
  const persistMatch = () => {
    if (!S || G.mode !== 'match' || S.s.over) return;
    const st = G.setup, d = { v: SAVE_VERSION, cfg: { course: st.course, level: st.level, length: st.length, two: st.two, target: S.s.target, names: S.s.players.map((p) => p.name) }, snap: S.snapshot() };
    snap = d; G.saved = metaOf(d); storage.set('match', d);
  };
  const clearSave = () => { snap = null; G.saved = null; storage.remove('match'); MN.invalidate(); };
  Promise.all([storage.get('settings', null), storage.get('learn', null), storage.get('record', null), storage.get('match', null)]).then(([s, l, r, m]) => {
    if (s) Object.assign(G.settings, s);
    if (l && l.done) G.learn.done = l.done;
    if (r) Object.assign(G.record, r);
    if (validSave(m)) { snap = m; G.saved = metaOf(m); }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.settings.drum = clamp(G.settings.drum | 0, 0, 3);
    G.settings.offset = clamp(G.settings.offset | 0, -100, 100);
    if (G.settings.timing !== 'relaxed') G.settings.timing = 'standard';
    if (G.settings.hero !== 'm') G.settings.hero = 'f';
    G.look.hero = G.settings.hero;
    G.loaded = true;
    MN.invalidate();
    audio.setMuted?.(!G.settings.sound); fx?.setMuted?.(!G.settings.sound);
  });

  // ---- sound ------------------------------------------------------------------------------------------------------------
  const vol = () => [0, 0.35, 0.65, 1][G.settings.drum];
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    kick: (v = 1) => { const k = vol() * v; if (!k || !G.settings.sound) return; if (fx) fx.kick(k); else tone({ freq: 150, to: 45, dur: 0.14, type: 'sine', vol: 0.3 * k }); },
    hat: () => { const k = vol(); if (!k || !G.settings.sound) return; if (fx) fx.hat(k); else tone({ freq: 6000, dur: 0.025, type: 'square', vol: 0.025 * k }); },
    rim: () => { const k = vol(); if (!k || !G.settings.sound) return; tone({ freq: 1800, to: 1200, dur: 0.04, type: 'square', vol: 0.04 * k }); },
    chalk: (g) => { if (!G.settings.sound) return; if (fx) fx.chalk(g === 'perfect' ? 1 : 0.8); else tone({ freq: 900, to: 500, dur: 0.05, type: 'triangle', vol: 0.08 }); },
    clack: (ok) => { if (!G.settings.sound) return; if (fx) fx.clack(ok); else tone({ freq: ok ? 1400 : 300, to: ok ? 700 : 150, dur: 0.09, type: 'square', vol: 0.07 }); },
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    count: (n) => tone({ freq: n === 3 ? 1040 : 780, dur: 0.07, type: 'triangle', vol: 0.12 * Math.max(0.4, vol()) }),
    whoosh: () => tone({ freq: 500, to: 1200, dur: 0.18, type: 'sine', vol: 0.05 }),
    clean: () => [0, 4, 7, 12].forEach((n, i) => later(i * 0.09, () => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.2, type: 'triangle', vol: 0.09 }))),
    foul: () => { tone({ freq: 190, to: 80, dur: 0.28, type: 'sawtooth', vol: 0.08 }); },
    win: () => [0, 4, 7, 11, 12].forEach((n, i) => later(i * 0.1, () => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.24, type: 'triangle', vol: 0.1 }))),
  };
  const delayed = [];
  const later = (t, f) => delayed.push({ t, f });

  // ---- match lifecycle ----------------------------------------------------------------------------------------------
  const setSim = (sim) => { S = sim; G.sim = sim.s; G.simObj = sim; evSeen = 0; G.fb = null; G.thinkOpen = false; G.thinkData = null; };
  const baseCfg = () => ({ timing: G.settings.timing, offset: G.settings.offset });
  const startBg = () => { setSim(createSim({ mode: 'practice', course: G.setup.course, players: [{ human: false, level: 4, name: 'Demo' }], hold: false, bpm: 80 }, simRng.fork())); G.mode = 'none'; };
  const lengthN = (c) => (G.setup.length === 'short' ? Math.min(SHORT_N, c.N) : 0);
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    G.look.hero = G.settings.hero;
    let cfg;
    const oppName = LEVELS[st.level - 1].name;
    if (kind === 'match') {
      if (demo && G.record.demoMatches >= DEMO_MATCH_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; MN.invalidate(); return; }
      const c = getCourse(st.course);
      cfg = { ...baseCfg(), mode: 'match', course: st.course, target: demo ? SHORT_N : lengthN(c),
        players: st.two ? [{ human: true, level: 0, name: 'Player 1' }, { human: true, level: 0, name: 'Player 2' }] : [{ human: true, level: 0, name: 'You' }, { human: false, level: st.level, name: oppName }] };
    } else if (kind === 'watch') {
      cfg = { ...baseCfg(), timing: 'standard', mode: 'watch', course: st.course, target: 3, hold: true,
        players: [{ human: false, level: st.watchA, name: LEVELS[st.watchA - 1].name }, { human: false, level: st.level, name: LEVELS[st.level - 1].name }] };
    } else if (kind === 'practice') {
      cfg = { ...baseCfg(), mode: 'practice', course: st.course, players: [{ human: true, level: 0, name: 'Practice' }] };
    } else if (kind === 'lesson') {
      const l = opts.lesson;
      cfg = { ...baseCfg(), mode: 'lesson', course: l.course, lesson: l.lesson, players: [{ human: true, level: 0, name: 'Lesson' }] };
    }
    if (opts.resume) cfg.resume = opts.resume;
    G.mode = kind === 'lesson' ? 'learn' : kind;
    st.lastKind = kind;
    setSim(createSim(cfg, simRng.fork()));
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = !!opts.paused; G.ui.scroll = 0; MN.invalidate();
    G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1 };
    G.watchText = '';
    if (kind === 'match') { if (demo && !opts.resume) { G.record.demoMatches++; saveSettings(); } if (!opts.resume) persistMatch(); }
  }
  const resumeMatch = () => {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    Object.assign(G.setup, { course: d.cfg.course, level: d.cfg.level, length: d.cfg.length, two: !!d.cfg.two });
    startMatch('match', { resume: d.snap, paused: true });
  };
  const leaveMatch = () => { persistMatch(); G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.thinkOpen = false; G.ui.scroll = 0; MN.invalidate(); startBg(); };

  // ---- learn -----------------------------------------------------------------------------------------------------------
  function startLesson() { startMatch('lesson', { lesson: LESSONS[G.learn.cur] }); }
  function lessonEvent(e) {
    const l = LESSONS[G.learn.cur];
    if (!l) return;
    if (e.type === 'lessonTry') G.fb = { t: S.s.t, text: e.ok ? 'Good' : 'Not this time', col: e.ok ? '#7fe8d6' : '#ffb59a' };
    if (e.type === 'lessonEnd') {
      G.learn.result = { score: e.ok, n: e.n, pass: e.pass };
      if (e.pass) { G.learn.done[l.id] = true; saveSettings(); }
      later(1.2, () => { G.scene = 'lessonresult'; G.ui.scroll = 0; G.mode = 'none'; MN.invalidate(); startBg(); });
    }
  }

  // ---- events from the sim: sound, feedback, saving ---------------------------------------------------------------------
  function processEvents() {
    const s = S.s;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (G.scene !== 'play') continue;
      if (e.type === 'beat') { if (e.kind === 'count') { sfx.count(e.bar); } else { sfx.kick(e.bar === 0 ? 1 : 0.7); } sfx.hat(); if (e.bar % 2 === 1 && e.kind === 'play') sfx.rim(); }
      else if (e.type === 'throw') sfx.whoosh();
      else if (e.type === 'land') { sfx.clack(e.ok); }
      else if (e.type === 'hop') {
        sfx.chalk(e.grade);
        if (e.p === s.cur) G.fb = { t: s.t, text: POINT_NAMES[e.grade] || '', col: GRADE_COL[e.grade] || '#fff', sub: `${e.d > 0 ? '+' : ''}${Math.round(e.d * 1000)} ms` };
      } else if (e.type === 'foul') sfx.foul();
      else if (e.type === 'clean') sfx.clean();
      else if (e.type === 'turnStart') { if (G.mode === 'match') persistMatch(); }
      else if (e.type === 'matchEnd') {
        if (G.mode === 'match' || G.mode === 'watch') {
          if (G.mode === 'match') { clearSave(); if (e.winner === 0) { G.record.wins = (G.record.wins | 0) + 1; saveSettings(); } }
          later(1.0, () => { sfx.win(); G.scene = 'result'; G.ui.scroll = 0; MN.invalidate(); });
        }
      }
      if (G.mode === 'learn') lessonEvent(e);
      if (G.scene !== 'play') break;
    }
  }

  // ---- watch & learn --------------------------------------------------------------------------------------------------------
  function watchTexts(s, kind) {
    if (kind === 'aim') return { think: tossReasoning(S), reveal: `Watch the dot: ${s.players[s.cur].name} will tap when it crosses the green zone, first sideways, then for the distance.` };
    return { think: routeSummary(S), reveal: planSummary(S) };
  }
  function updateWatch() {
    const s = S.s, w = G.watch;
    if (w.paused) return false;
    if (s.phase === 'hold' && s.hold) {
      if (w.holdId !== s.hold.id) { w.holdId = s.hold.id; w.phase = 'think'; w.timer = THINK_STEPS[G.settings.thinkIdx]; w.texts = watchTexts(s, s.hold.kind); }
      return 'hold';
    }
    return true;
  }

  // ---- play input ----------------------------------------------------------------------------------------------------------
  const humanTurn = () => S.s.players[S.s.cur].human && G.mode !== 'watch';
  function act(a) {
    if (!humanTurn()) return;
    const s = S.s;
    G.pressFlash = { act: a, t: s.t };
    if (a === 'T') { S.tapAim(s.cur); return; }
    S.tapHop(s.cur, a);
  }
  const doPause = () => { G.paused = true; G.pauseMenu = true; G.thinkOpen = false; G.ui.scroll = 0; MN.invalidate(); persistMatch(); };
  function openThink() {
    if (G.mode === 'watch' || !humanTurn()) return;
    G.thinkData = hintFor(S); G.thinkOpen = true; G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; MN.invalidate();
  }
  function playInput(input) {
    const ptr = input.pointer, keys = input.keys, lay = hudFor(G.settings.textIdx, false);
    if (G.mode === 'watch') {
      if (ptr.pressed) {
        const i = watchHit(G.settings.textIdx, ptr.x, ptr.y);
        if (i === 0) { G.watch.paused = !G.watch.paused; sfx.tick(); }
        else if (i === 1) { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveSettings(); }
        else if (i === 2) { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveSettings(); }
        else if (i === 3) leaveMatch();
        else if (G.watchBox && inRect(G.watchBox, ptr.x, ptr.y)) G.ui.wdrag = { y0: ptr.y, s0: G.watchScroll || 0 };
      }
      if (G.ui.wdrag && ptr.down) G.watchScroll = clamp(G.ui.wdrag.s0 - (ptr.y - G.ui.wdrag.y0), 0, G.watchMax || 0);
      if (ptr.released) G.ui.wdrag = null;
      if (keys.pressed.has('KeyP') || keys.pressed.has('Space')) G.watch.paused = !G.watch.paused;
      if (keys.pressed.has('Escape')) leaveMatch();
      return;
    }
    const s = S.s, aim = s.phase === 'aimX' || s.phase === 'aimZ';
    if (ptr.pressed) {
      if (inRect(lay.util.pause, ptr.x, ptr.y)) { doPause(); return; }
      if (inRect(lay.util.think, ptr.x, ptr.y)) { openThink(); return; }
      if (aim) { if (inRect(lay.toss, ptr.x, ptr.y) || inRect(lay.band, ptr.x, ptr.y)) act('T'); }
      else if (inRect(lay.pick, ptr.x, ptr.y)) act('P');
      else if (inRect(lay.left, ptr.x, ptr.y)) act('L');
      else if (inRect(lay.right, ptr.x, ptr.y)) act('R');
      else if (inRect(lay.both, ptr.x, ptr.y)) act('B');
    }
    if (aim) { if (keys.pressed.has('Space') || keys.pressed.has('Enter')) act('T'); }
    else {
      if (keys.pressed.has('KeyA') || keys.pressed.has('ArrowLeft')) act('L');
      if (keys.pressed.has('KeyD') || keys.pressed.has('ArrowRight')) act('R');
      if (keys.pressed.has('KeyS') || keys.pressed.has('ArrowDown') || keys.pressed.has('Space')) act('B');
      if (keys.pressed.has('KeyW') || keys.pressed.has('ArrowUp') || keys.pressed.has('KeyE')) act('P');
    }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) doPause();
    if (keys.pressed.has('KeyT')) openThink();
  }

  // ---- menus ------------------------------------------------------------------------------------------------------------------
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); MN.invalidate(); saveSettings(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); MN.invalidate(); saveSettings(); }
    if (input.keys.down.has('ArrowDown')) G.ui.scroll = clamp(G.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) G.ui.scroll = clamp(G.ui.scroll - 14, 0, max);
  };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; MN.invalidate(); };
  const setText = (d) => { G.settings.textIdx = clamp(G.settings.textIdx + d, 0, TEXT_SCALES.length - 1); G.ui.scroll = 0; MN.invalidate(); saveSettings(); };
  const toggleSound = () => { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); fx?.setMuted?.(!G.settings.sound); saveSettings(); MN.invalidate(); };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'continue') resumeMatch();
    else if (id === 'play') { G.setup.watch = false; G.setup.two = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'two') { if (demo) { go('demolimit'); return; } G.setup.watch = false; G.setup.two = true; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { G.setup.watch = true; G.setup.two = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'practice') startMatch('practice');
    else if (id === 'learn') go('learn');
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') toggleSound();
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('cs-')) { const c = id.slice(3); if (demo && c !== 'classic') { G.setupMsg = 'Snail and Rainbow are in the full game.'; return; } st.course = c; startBg(); }
    else if (id.startsWith('opp')) st.level = +id.slice(3);
    else if (id.startsWith('wa')) st.watchA = +id.slice(2);
    else if (id.startsWith('len-')) { if (demo && id !== 'len-short') { G.setupMsg = 'The whole course is in the full game.'; return; } st.length = id.slice(4); }
    else if (id === 'hero-m' || id === 'hero-f') { G.settings.hero = id.slice(5); G.look.hero = G.settings.hero; saveSettings(); }
    else if (id === 'start') {
      if (demo && st.level > 2 && !st.watch && !st.two) { G.setupMsg = 'The free demo has the first two opponents.'; return; }
      startMatch(st.watch ? 'watch' : 'match'); return;
    } else if (id === 'back') { go('title'); return; }
    MN.invalidate();
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); fx?.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); G.ui.scroll = 0; }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); G.ui.scroll = 0; }
    else if (id === 'drum-dec') st.drum = Math.max(0, st.drum - 1);
    else if (id === 'drum-inc') st.drum = Math.min(3, st.drum + 1);
    else if (id === 'tm-standard') st.timing = 'standard';
    else if (id === 'tm-relaxed') st.timing = 'relaxed';
    else if (id === 'off-dec') st.offset = Math.max(-100, st.offset - 20);
    else if (id === 'off-inc') st.offset = Math.min(100, st.offset + 20);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; MN.invalidate(); env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; MN.invalidate(); }).catch(() => { G.restoreMsg = 'Could not reach the store.'; MN.invalidate(); }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    MN.invalidate(); saveSettings();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'again') startMatch(G.setup.lastKind === 'watch' ? 'watch' : 'match');
    else if (id === 'new') { if (G.setup.lastKind === 'watch') startMatch('watch'); else go('setup'); }
    else if (id === 'menu') { go('title'); startBg(); }
  }
  function handleLearn(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id.startsWith('lesson') && id !== 'lesson-go' && id !== 'lesson-back') { const i = +id.slice(6); if (demo && i > 1) { return; } G.learn.cur = i; go('lesson'); }
  }
  function handleLesson(id) { if (!id) return; sfx.tick(); if (id === 'lesson-go') startLesson(); else if (id === 'lesson-back') go('learn'); }
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
    if (id === 'resume') { G.paused = false; G.pauseMenu = false; G.thinkOpen = false; MN.invalidate(); }
    else if (id === 'p-rules') { G.back = 'play'; go('rules'); }
    else if (id === 'p-howto') { G.back = 'play'; go('howto'); }
    else if (id === 'p-sound') toggleSound();
    else if (id === 'p-txt-dec') setText(-1);
    else if (id === 'p-txt-inc') setText(1);
    else if (id === 'quit') leaveMatch();
  }
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    MN.readerMetrics();
    const di = MN.docInfo(), RG = readerGeom();
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.page = 0; G.ui.scroll = 0; G.ui.drag = null; MN.invalidate(); };
    const by = (d) => { G.ui.scroll = clamp(G.ui.scroll + d, 0, di.max); };
    const pgH = Math.max(100, di.view * 0.88);
    const next = () => { if (G.ui.scroll >= di.max - 2) close(); else by(pgH); };
    const prev = () => { if (G.ui.scroll < 2) close(); else by(-pgH); };
    const onBtn = (x, y) => inRect(RG.next, x, y) || inRect(RG.back, x, y) || inRect(RG.dec, x, y) || inRect(RG.inc, x, y);
    if (ptr.pressed) {
      if (inRect(RG.next, ptr.x, ptr.y)) next();
      else if (inRect(RG.back, ptr.x, ptr.y)) prev();
      else if (inRect(RG.dec, ptr.x, ptr.y)) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); G.ui.scroll = 0; saveSettings(); }
      else if (inRect(RG.inc, ptr.x, ptr.y)) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); G.ui.scroll = 0; saveSettings(); }
      else if (!onBtn(ptr.x, ptr.y)) G.ui.drag = { y0: ptr.y, s0: G.ui.scroll };
    }
    if (G.ui.drag && ptr.down) G.ui.scroll = clamp(G.ui.drag.s0 - (ptr.y - G.ui.drag.y0), 0, di.max);
    if (ptr.released) G.ui.drag = null;
    if (keys.down.has('ArrowDown')) by(14);
    if (keys.down.has('ArrowUp')) by(-14);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) by(pgH);
    if (keys.pressed.has('PageUp')) by(-pgH);
    if (keys.pressed.has('End')) G.ui.scroll = di.max;
    if (keys.pressed.has('Home')) G.ui.scroll = 0;
    if (keys.pressed.has('ArrowRight')) next();
    if (keys.pressed.has('ArrowLeft')) prev();
    if (keys.pressed.has('Escape')) close();
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    const PN = setupPins();
    if (ptr.pressed && (inRect(PN.start, ptr.x, ptr.y) || inRect(PN.back, ptr.x, ptr.y))) { handleSetup(inRect(PN.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  // ---- the play update ------------------------------------------------------------------------------------------------------
  function updatePlay(dt, input) {
    if (G.mode === 'shot') { shotTick(); S.update(dt); processEvents(); updAt = now(); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    if (G.paused) { if (input.keys.pressed.has('KeyP')) G.paused = false; return; }
    if (config.bot && G.mode !== 'watch') shotTick();       // dev only (?dev=1&bot=1): a coached bot plays the human side
    playInput(input);
    if (G.paused || G.pauseMenu || G.scene !== 'play') return;
    if (G.mode === 'watch') {
      const w = G.watch, r = updateWatch();
      if (r === false) return;
      if (r === 'hold') {
        w.timer -= dt;
        if (w.phase === 'think') { G.watchText = w.texts.think; if (w.timer <= 0) { w.phase = 'reveal'; w.timer = 4.5; } }
        else if (w.phase === 'reveal') { G.watchText = w.texts.reveal; if (w.timer <= 0) { w.phase = 'act'; S.release(); } }
        S.update(dt); updAt = now();
        return;
      }
      if (w.phase === 'act' && w.texts) G.watchText = w.texts.reveal;
    }
    S.update(dt); updAt = now();
    processEvents();
  }

  // ?shot=1 (store screenshots): a real game played by a coached bot, frozen after N ticks with the full HUD
  const triNow = (u) => { const f = u - Math.floor(u); return f < 0.5 ? -1 + 4 * f : 3 - 4 * f; };
  function shotTick() {
    const s = S.s, T = s.turn;
    if (!T || !s.players[s.cur].human) return;
    if (s.phase === 'aimX' || s.phase === 'aimZ') {
      const a = T.aim, want = s.phase === 'aimX' ? 0.7 * triNow(a.px + (s.t - a.tx) * a.sx) : 0.72 * triNow(a.pz + (s.t - a.tz) * a.sz);
      if (Math.abs(want) < 0.04 && s.t - s.phaseT > 0.4) S.tapAim(s.cur);
    } else if (s.phase === 'count' || s.phase === 'hop') {
      const st = T.route[T.si];
      if (st && s.t >= st.t + (((st.i * 7) % 5) - 2) * 0.012) S.tapHop(s.cur, st.k === 'one' ? (st.i % 3 ? 'L' : 'R') : st.k === 'open' ? st.side : st.k === 'pick' ? 'P' : 'B');
    }
  }
  function startShot() {
    G.look.hero = 'f'; G.mode = 'shot'; G.setup.lastKind = 'match';
    setSim(createSim({ mode: 'match', course: config.course || 'classic', target: 4, timing: 'standard', players: [{ human: true, level: 0, name: 'You' }, { human: false, level: 3, name: LEVELS[2].name }] }, simRng.fork()));
    G.scene = 'play';
  }
  function startup() { if (config.shot) startShot(); else startBg(); }
  startup();

  // Where the action should appear on screen (virtual units): the 3D camera frames it inside this rectangle.
  function camBand() {
    const { vw, vh } = scr, R = (x, y, w, h) => ({ x, y, w, h });
    const play = hudFor(G.settings.textIdx, G.mode === 'watch').camBand;
    if (G.scene === 'play') return play;
    if (G.scene === 'title' || G.scene === 'result') {
      const col = colFor(G.scene);
      if (scr.land) { const lw = col.x - 16; return lw >= 300 ? R(host.l + 10, host.t + 20, lw - host.l - 10, vh - host.t - host.b - 40) : play; }
      if (G.scene === 'title') { const tb = MN.titleBand(); return tb.gap >= 100 ? R(0, tb.top, vw, tb.gap) : play; }
    }
    if (G.scene === 'learn' || G.scene === 'lesson' || G.scene === 'lessonresult') return R(0, host.t, vw, Math.max(200, vh * 0.3));
    return play;
  }

  const inRealPlay = () => G.scene === 'play' && G.mode === 'match' && S && !S.s.over && S.s.players[S.s.cur].human
    && ['aimX', 'aimLock', 'aimZ', 'flight', 'hop'].includes(S.s.phase);
  const api = {
    // Menus, Rules, About, settings, Learn, Practice, Watch & Learn, the count-in, the computer's turns, pause and results are free;
    // only the live toss and hop of a match count against the preview.
    isPreviewExempt: () => dev || !inRealPlay() || G.paused || G.pauseMenu,
    autoPause() { if (G.scene === 'play' && !G.paused && !G.pauseMenu && G.mode !== 'shot') { if (G.mode === 'watch') G.watch.paused = true; else doPause(); } },
    update(dt, input) {
      setScreen(meta.width, meta.height);
      const col = useColumn(G.scene === 'play' && !G.pauseMenu ? 'play' : G.scene === 'play' ? 'pause' : G.scene, G.scene === 'play' && G.pauseMenu);
      if (col.x) input = { keys: input.keys, pointer: { ...input.pointer, x: input.pointer.x - col.x } };
      setPress(input.pointer);
      G.t += dt;
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { delayed[i].f(); delayed.splice(i, 1); } }
      if (G.scene !== 'play') { S.update(dt); updAt = now(); }
      switch (G.scene) {
        case 'title': {
          const lt = MN.getLockTap(), pp = input.pointer;
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { G.lockDown = G.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(dt, input, handleTitle, 'title'); break;
        }
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'learn': updateFlowScene(dt, input, handleLearn, 'learn'); break;
        case 'lesson': updateFlowScene(dt, input, handleLesson, 'lesson'); break;
        case 'lessonresult': updateFlowScene(dt, input, handleLessonResult, 'lessonresult'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') go('title'); }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx, view) {
      setScreen(meta.width, meta.height);
      ctx.clearRect(-2, -2, scr.vw + 4, scr.vh + 4);
      const col = useColumn(G.scene === 'play' && !G.pauseMenu ? 'play' : G.scene === 'play' ? 'pause' : G.scene, G.scene === 'play' && G.pauseMenu);
      if (view) view.band = camBand();
      // the kit's "Preview m:ss" pill: centred at the top of the courtyard band, below the Pause / Think row, so it never covers a button or a score
      if (G.scene === 'play' && G.mode === 'match') {
        const hl = hudFor(G.settings.textIdx, false);
        globalThis.__previewBadge = { x: hl.camBand.x + hl.camBand.w / 2, y: scr.land ? hl.status.y + hl.status.h + 2 : hl.camBand.y + 2, align: 'center' };
      } else globalThis.__previewBadge = null;
      ctx.save(); ctx.translate(col.x, 0);
      const running = !G.paused && !(G.mode === 'watch' && G.watch.paused);
      const el = env.clock ? now() - updAt : 0;
      G.dispT = S ? S.s.t + (running && env.clock && el < 45 ? clamp(el / (STEP * 1000), 0, 1) * STEP : 0) : 0;
      if (view && view.noGL) renderFallback(ctx, G, view);
      switch (G.scene) {
        case 'title': MN.renderTitle(ctx, G); break;
        case 'setup': MN.renderSetup(ctx, G); break;
        case 'settings': MN.renderSettings(ctx, G); break;
        case 'learn': MN.renderLearn(ctx, G); break;
        case 'lesson': MN.renderLesson(ctx, G); break;
        case 'lessonresult': MN.renderLessonResult(ctx, G); break;
        case 'result': MN.renderResult(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'howto': MN.renderPages(ctx, G, HOWTO, 'How to Play'); break;
        case 'about': MN.renderPages(ctx, G, aboutList, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, rulesPages(), 'Rules'); break;
        case 'play':
          ctx.translate(-col.x, 0);                        // the HUD uses whole-screen coordinates; the pause panel sits in its column
          renderHud(ctx, G, S, view || {});
          ctx.translate(col.x, 0);
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        default: break;
      }
      ctx.restore();
    },
    camBand,
    // mouse wheel / trackpad: scrolls whichever reader or menu is on screen
    wheel(dy) {
      if (G.scene === 'howto' || G.scene === 'about' || G.scene === 'rules') { G.ui.scroll = clamp(G.ui.scroll + dy, 0, MN.docInfo().max); return; }
      if (G.scene === 'play' && G.mode === 'watch') { G.watchScroll = Math.max(0, (G.watchScroll || 0) + dy); return; }
      const mt = MN.flowMeta(); if (!mt.lay) return;
      G.ui.scroll = clamp(G.ui.scroll + dy, 0, Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)));
    },
    getState: () => G,
    // dev-only handles (?dev=1) for the verification scripts; unused in normal play
    ...(dev ? { _dev: { go, startMatch, handleTitle, handleSetup, handlePause, handleSettings, setText, sim: () => S, MN, config } } : {}),
  };
  return api;
}
