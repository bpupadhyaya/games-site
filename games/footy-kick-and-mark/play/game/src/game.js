// Footy: Kick and Mark - the game shell. Scenes, input, persistence, preview wiring, Learn, Watch & Learn. The match lives in sim.js.
import { createSim } from './sim.js';
import { W, H, TEXT_SCALES, THINK_STEPS, REF_BACK, REF_NEXT, TEXT_DEC, TEXT_INC, SETUP_PINS, inRect, hudLayout } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES, LESSONS, QUIZ, ROLE_INFO } from './content.js';
import * as MN from './menus.js';
import { renderPlayHud, renderThink, renderFallback, watchHit } from './hud.js';
import { createControls } from './controls.js';
import { clamp } from './util.js';
import { ROLES, LEVELS } from './consts.js';

export const meta = { width: W, height: H };
const DEMO_MATCH_CAP = 2;
const SAVE_VERSION = 1;
const TEAM_NAMES = ['Red', 'Blue'];

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo, tp = env.touchpad || null, wheel = env.wheel || null;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, women: false, thinkIdx: 1 },
    setup: { role: 'mid', opp: 3, length: 'full', watch: false, watchA: 3, lastMode: 'ai' },
    ui: { scroll: 0, drag: null }, page: 0, back: 'title', restoreMsg: '', setupMsg: '',
    learn: { cur: 0, qi: 0, qscore: 0, done: {}, result: null },
    saved: null, record: { demoMatches: 0 },
    S: null, sim: null, paused: false, pauseMenu: false, think: null, thinkRects: null, aim: null, cs: null,
    watch: { phase: 'think', timer: 0, paused: false, holdId: -1 }, t: 0, viewW: 720, viewH: 1280, tally: null, lessonTitle: '', drill: null,
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  const controls = createControls();
  let S = null, evSeen = 0, snap = null, simRng = rng.fork();
  // the last few seconds of positions, kept for the small fixed replay inset (never part of the saved or hashed state)
  let hist = [];
  Object.defineProperty(G, 'replayFrames', { value: [], writable: true, enumerable: false });
  const recordHist = () => { const s = S.s; if (s.tick % 3) return; hist.push({ t: s.t, p: s.players.map((p) => [p.x, p.z]), b: [s.ball.x, s.ball.z, s.ball.y] }); if (hist.length > 130) hist.shift(); };

  // ---- persistence ----------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', G.settings); storage.set('learn', { done: G.learn.done }); storage.set('record', G.record); storage.set('setup', { role: G.setup.role, opp: G.setup.opp, length: G.setup.length }); };
  const metaOfSave = (d) => ({ roleName: ROLE_INFO[d.setup.role].name, q: d.q, pts: [d.score[0].g * 6 + d.score[0].b, d.score[1].g * 6 + d.score[1].b] });
  const validSave = (d) => d && d.v === SAVE_VERSION && d.setup && ROLES.includes(d.setup.role) && Array.isArray(d.score) && d.score.length === 2 && d.q >= 0 && d.q < 4 && d.clock > 0;
  const persistMatch = () => {
    if (!S || G.mode !== 'ai' || S.s.over) return;
    const s = S.s;
    const d = { v: SAVE_VERSION, setup: { role: G.setup.role, opp: G.setup.opp, length: G.setup.length }, q: s.q, clock: s.phase === 'break' ? 0.1 : s.clock, score: s.score.map((x) => ({ ...x })), qscore: s.qscore.map((a) => [{ ...a[0] }, { ...a[1] }]), stats: s.stats.map((x) => ({ ...x })), women: G.settings.women };
    if (s.phase === 'break') { d.q = s.q + 1; d.clock = 120; d.qscore = s.qscore.map((a) => [{ ...a[0] }, { ...a[1] }]); }
    if (d.q >= s.quarters) return;
    snap = d; G.saved = metaOfSave(d); storage.set('match', d);
  };
  const clearSave = () => { snap = null; G.saved = null; storage.remove('match'); };
  Promise.all([storage.get('settings', null), storage.get('learn', null), storage.get('record', null), storage.get('match', null), storage.get('setup', null)]).then(([s, l, r, mch, su]) => {
    if (s) Object.assign(G.settings, s);
    if (l && l.done) G.learn.done = l.done;
    if (r) Object.assign(G.record, r);
    if (su) { if (ROLES.includes(su.role)) G.setup.role = su.role; if (su.opp >= 1 && su.opp <= 5) G.setup.opp = su.opp | 0; if (su.length === 'quick' || su.length === 'full') G.setup.length = su.length; }
    if (validSave(mch)) { snap = mch; G.saved = metaOfSave(mch); }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.loaded = true;
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ------------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  // crowd: a soft murmur that swells on a goal or a mark (synthesised, quiet)
  let murmurIn = 0;
  const cheer = (k) => { for (let i = 0; i < 5; i++) tone({ freq: 180 + i * 53, to: 160 + i * 41, dur: 0.9 + 0.5 * k, type: 'sawtooth', vol: 0.012 * k + 0.004 }); };
  const murmur = (dt) => { murmurIn -= dt; if (murmurIn <= 0) { murmurIn = 1.6; for (let i = 0; i < 3; i++) tone({ freq: 140 + i * 37, to: 130 + i * 29, dur: 1.8, type: 'sawtooth', vol: 0.0045 }); } };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    kick: () => { tone({ freq: 170, to: 70, dur: 0.1, type: 'sine', vol: 0.18 }); tone({ freq: 700, to: 250, dur: 0.04, type: 'square', vol: 0.025 }); },
    handball: () => tone({ freq: 240, to: 150, dur: 0.07, type: 'triangle', vol: 0.12 }),
    mark: () => { tone({ freq: 330, to: 440, dur: 0.12, type: 'triangle', vol: 0.1 }); tone({ freq: 110, to: 90, dur: 0.1, type: 'sine', vol: 0.14 }); },
    tackle: () => tone({ freq: 120, to: 60, dur: 0.16, type: 'triangle', vol: 0.16 }),
    spoil: () => tone({ freq: 260, to: 120, dur: 0.08, type: 'square', vol: 0.05 }),
    bounce: () => tone({ freq: 200, to: 110, dur: 0.09, type: 'sine', vol: 0.1 }),
    whistle: () => tone({ freq: 2400, to: 2100, dur: 0.25, type: 'sine', vol: 0.05 }),
    siren: () => tone({ freq: 520, to: 520, dur: 0.7, type: 'sawtooth', vol: 0.05 }),
    goal: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.2 + i * 0.05, type: 'triangle', vol: 0.09 })),
    behind: () => tone({ freq: 392, to: 330, dur: 0.22, type: 'triangle', vol: 0.07 }),
  };

  // ---- match lifecycle ------------------------------------------------------------------------------------
  const setSim = (sim) => { hist = []; G.replay = null; G.replayFrames = []; S = sim; G.S = sim; G.sim = sim.s; evSeen = sim.s.evId; G.think = null; G.aim = null; controls.reset(); };
  const baseCfg = () => ({ names: TEAM_NAMES });
  function startDemoBg() { setSim(createSim({ ...baseCfg(), mode: 'quick', levels: [3, 3], humanRole: null }, simRng.fork())); G.mode = 'none'; }
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    let cfg;
    if (kind === 'ai') {
      if (demo && G.record.demoMatches >= DEMO_MATCH_CAP && !opts.resume) { G.scene = 'demolimit'; G.ui.scroll = 0; return; }
      cfg = { ...baseCfg(), mode: demo || st.length === 'quick' ? 'quick' : 'full', levels: [st.opp, st.opp], humanRole: st.role };
    } else if (kind === 'watch') cfg = { ...baseCfg(), mode: 'quick', levels: [st.watchA, st.opp], humanRole: null, watch: true };
    else if (kind === 'drill') cfg = { ...baseCfg(), mode: 'quick', levels: [3, 3], drill: opts.drill };
    if (opts.resume) cfg.resume = opts.resume;
    G.mode = kind; G.setup.lastMode = kind;
    setSim(createSim(cfg, simRng.fork()));
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = !!opts.paused; G.ui.scroll = 0; G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1 };
    if (kind === 'ai') { if (!opts.resume) { G.settings.tips = (G.settings.tips | 0) + 1; saveSettings(); } if (demo && !opts.resume) { G.record.demoMatches++; saveSettings(); } if (!opts.resume) persistMatch(); }
  }
  const resumeMatch = () => {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    G.setup.role = d.setup.role; G.setup.opp = d.setup.opp; G.setup.length = d.setup.length; G.settings.women = !!d.women;
    startMatch('ai', { resume: { q: d.q, clock: d.clock, score: d.score, qscore: d.qscore, stats: d.stats }, paused: true });
  };
  const leaveMatch = () => { persistMatch(); G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; startDemoBg(); };

  // ---- learn ---------------------------------------------------------------------------------------------
  function startLesson() {
    const l = LESSONS[G.learn.cur];
    if (l.quiz) { G.learn.qi = 0; G.learn.qscore = 0; G.scene = 'quiz'; G.ui.scroll = 0; return; }
    G.lessonTitle = l.title.replace(/^\d+\. /, '');
    startMatch('drill', { drill: l.drill });
  }
  function drillTick() {
    const d = S.s.drill; if (!d) return;
    G.drill = d; G.tally = { n: d.n, ok: d.ok };
    if (d.done) {
      const l = LESSONS[G.learn.cur];
      G.learn.result = { score: d.ok, n: l.n, pass: d.ok >= l.need };
      if (G.learn.result.pass) { G.learn.done[l.id] = true; saveSettings(); }
      G.scene = 'lessonresult'; G.ui.scroll = 0; G.mode = 'none'; startDemoBg();
    }
  }

  // ---- events from the sim: sound, banners, saving ----------------------------------------------------------
  function processEvents() {
    const s = S.s;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      switch (e.type) {
        case 'kick': sfx.kick(); break;
        case 'handball': sfx.handball(); break;
        case 'mark': sfx.mark(); cheer(0.5); break;
        case 'tackle': sfx.tackle(); break;
        case 'spoil': case 'tap': sfx.spoil(); break;
        case 'bounceBall': if (e.v > 3) sfx.bounce(); break;
        case 'bounce': case 'setshot': case 'heldBall': case 'out': sfx.whistle(); G.whistleT = G.t; break;
        case 'siren': sfx.siren(); break;
        case 'goal': sfx.goal(); G.whistleT = G.t; cheer(1); if (G.mode === 'ai') persistMatch(); G.replayFrames = hist.slice(-100); G.replay = { t0: s.t + 0.5, n: G.replayFrames.length, team: e.team }; break;
        case 'behind': sfx.behind(); if (G.mode === 'ai') persistMatch(); break;
        case 'quarterEnd':
          if (G.mode === 'ai' || G.mode === 'watch') { if (s.q + 1 < s.quarters) { persistMatch(); G.scene = 'qbreak'; G.ui.scroll = 0; } }
          break;
        case 'matchEnd':
          if (G.mode === 'ai' || G.mode === 'watch') { if (G.mode === 'ai') { clearSave(); if (s.winner === 0) { G.record.matchWins = (G.record.matchWins | 0) + 1; saveSettings(); } } G.scene = 'result'; G.ui.scroll = 0; }
          break;
        default: break;
      }
    }
  }

  // ---- watch & learn ---------------------------------------------------------------------------------------
  function updateWatch(dt) {
    const s = S.s, w = G.watch;
    if (w.paused) return false;
    if (s.hold) {
      if (w.holdId !== s.evId + ':' + s.hold.t0) { w.holdId = s.evId + ':' + s.hold.t0; w.phase = 'think'; w.timer = THINK_STEPS[G.settings.thinkIdx]; }
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
      else if (w.phase === 'reveal' && w.timer <= 0) { w.phase = 'act'; S.release(); return true; }
      return false;
    }
    return true;
  }

  // ---- menus -----------------------------------------------------------------------------------------------
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
    scrollKeys(input, max, mt.lay ? mt.bottom - mt.top : 1000);
  };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; MN.ensureLayout(G, '-'); };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'continue') resumeMatch();
    else if (id === 'play') { G.setup.watch = false; G.setup.length = demo ? 'quick' : G.setup.length === 'quick' ? 'quick' : 'full'; go('setup'); G.setupMsg = ''; }
    else if (id === 'quick') { G.setup.watch = false; G.setup.length = 'quick'; go('setup'); G.setupMsg = ''; }
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
    if (id.startsWith('role-') && id !== 'role-lesson') st.role = id.slice(5);
    else if (id === 'role-lesson') { G.learn.cur = ROLE_INFO[st.role].lesson; go('lesson'); G.back = 'setup'; }
    else if (id.startsWith('opp')) st.opp = +id.slice(3);
    else if (id.startsWith('wa')) st.watchA = +id.slice(2);
    else if (id === 'len-full') st.length = 'full';
    else if (id === 'len-quick') st.length = 'quick';
    else if (id === 'start') {
      if (demo && st.opp > 2 && !st.watch) { G.setupMsg = 'The free demo has the first two rivals.'; return; }
      startMatch(st.watch ? 'watch' : 'ai');
      saveSettings();
    } else if (id === 'back') go('title');
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); G.ui.scroll = 0; }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); G.ui.scroll = 0; }
    else if (id === 'set-men') st.women = false;
    else if (id === 'set-women') st.women = true;
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
  function handleQBreak(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'nextq') { S.nextQuarter(); G.scene = 'play'; persistMatch(); }
    else if (id === 'qsave') { persistMatch(); G.scene = 'title'; G.mode = 'none'; startDemoBg(); }
  }
  function handleLearn(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id.startsWith('lesson') && id !== 'lesson-go' && id !== 'lesson-back') { G.learn.cur = +id.slice(6); G.back = 'learn'; go('lesson'); }
  }
  function handleLesson(id) { if (!id) return; sfx.tick(); if (id === 'lesson-go') startLesson(); else if (id === 'lesson-back') go(G.back === 'setup' ? 'setup' : 'learn'); }
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
    else if (id === 'lr-next') { G.learn.cur = Math.min(LESSONS.length - 1, G.learn.cur + 1); G.back = 'learn'; go('lesson'); }
    else if (id === 'lr-list') go('learn');
  }
  function handlePause(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') { G.paused = false; G.pauseMenu = false; controls.reset(); }
    else if (id === 'p-rules') { G.back = 'play'; go('rules'); }
    else if (id === 'p-howto') { G.back = 'play'; go('howto'); }
    else if (id === 'p-sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); }
    else if (id === 'p-txt-dec') { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); G.ui.scroll = 0; saveSettings(); }
    else if (id === 'p-txt-inc') { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); G.ui.scroll = 0; saveSettings(); }
    else if (id === 'quit') leaveMatch();
  }
  // keys and wheel that scroll any long text: arrows, PageUp/PageDown, Space, Home/End, mouse wheel
  const scrollKeys = (input, max, viewH) => {
    const k = input.keys;
    let sc = G.ui.scroll;
    if (k.down.has('ArrowDown')) sc += 14;
    if (k.down.has('ArrowUp')) sc -= 14;
    if (k.pressed.has('PageDown') || k.pressed.has('Space')) sc += viewH * 0.85;
    if (k.pressed.has('PageUp')) sc -= viewH * 0.85;
    if (k.pressed.has('Home')) sc = 0;
    if (k.pressed.has('End')) sc = max;
    if (wheel) sc += wheel.take();
    G.ui.scroll = clamp(sc, 0, max);
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const dm = MN.docMeta(), vw = MN.docView();
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.page = 0; G.ui.scroll = 0; G.ui.drag = null; };
    const textChanged = () => { G.ui.scroll = 0; saveSettings(); };
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) { if (G.ui.scroll >= dm.max - 4) { close(); return; } G.ui.scroll = clamp(G.ui.scroll + dm.viewH * 0.85, 0, dm.max); }
      else if (inRect(REF_BACK, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); textChanged(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); textChanged(); }
      else if (ptr.y >= vw.top - 20 && ptr.y <= vw.bottom + 20) G.ui.drag = { y0: ptr.y, s0: G.ui.scroll };
    }
    if (G.ui.drag && ptr.down) G.ui.scroll = clamp(G.ui.drag.s0 - (ptr.y - G.ui.drag.y0), 0, dm.max);
    if (ptr.released) G.ui.drag = null;
    scrollKeys(input, dm.max, dm.viewH);
    if (keys.pressed.has('Escape')) close();
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  // ---- the play update ----------------------------------------------------------------------------------------
  const legacyTouches = (ptr) => [{ id: 0, x: ptr.x, y: ptr.y, down: ptr.down, pressed: ptr.pressed, released: ptr.released }].filter((t) => t.down || t.released);
  const openThink = () => {
    const hp = S.humanPlayer(); if (!hp) return;
    const h = S.hint(hp.id);
    G.think = { ...h }; G.thinkScroll = 0;
  };
  function updatePlay(dt, input, touches) {
    const ptr = input.pointer, s = S.s;
    if (G.mode === 'shot') { S.update(dt, {}); recordHist(); processEvents(); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    const lay = hudLayout(G.settings.textIdx);
    if (G.think) {
      if (ptr.pressed && G.thinkRects && inRect(G.thinkRects.close, ptr.x, ptr.y)) { G.think = null; sfx.tick(); controls.reset(); }
      if (input.keys.pressed.has('Enter')) { G.think = null; controls.reset(); }
      const tv = G.thinkView;
      if (tv) {       // long advice (large text) scrolls: drag, wheel, arrows, PageUp/PageDown, Home/End
        if (ptr.pressed && ptr.y >= tv.top - 10 && ptr.y <= tv.bottom + 10 && !(G.thinkRects && inRect(G.thinkRects.close, ptr.x, ptr.y))) G.ui.tdrag = { y0: ptr.y, s0: G.thinkScroll || 0, moved: 0 };
        if (G.ui.tdrag && ptr.down) { const d = G.ui.tdrag; d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0)); G.thinkScroll = clamp(d.s0 - (ptr.y - d.y0), 0, tv.max); }
        if (ptr.released) G.ui.tdrag = null;
        const k = input.keys; let sc = G.thinkScroll || 0;
        if (k.down.has('ArrowDown')) sc += 12; if (k.down.has('ArrowUp')) sc -= 12;
        if (k.pressed.has('PageDown')) sc += tv.vh * 0.85; if (k.pressed.has('PageUp')) sc -= tv.vh * 0.85;
        if (k.pressed.has('Home')) sc = 0; if (k.pressed.has('End')) sc = tv.max;
        if (wheel) sc += wheel.take();
        G.thinkScroll = clamp(sc, 0, tv.max);
      }
      return;
    }
    if (G.mode === 'watch') {
      if (ptr.pressed) {
        const i = watchHit(ptr.x, ptr.y);
        if (i === 0) { G.watch.paused = !G.watch.paused; sfx.tick(); }
        else if (i === 1) { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveSettings(); }
        else if (i === 2) { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveSettings(); }
        else if (i === 3) { leaveMatch(); return; }
      }
      if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) G.watch.paused = !G.watch.paused;
      if (!updateWatch(dt)) return;
      S.update(dt, {}); recordHist(); processEvents();
      return;
    }
    const brk = s.phase === 'break' || s.over;
    const c = controls.read(touches, input.keys, lay, !brk);
    G.cs = c;
    for (const t of c.taps) {
      if (inRect(lay.pause, t.x, t.y)) { c.pause = true; sfx.tick(); }
      else if (inRect(lay.think, t.x, t.y)) { c.think = true; sfx.tick(); }
    }
    if (c.pause) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; controls.reset(); persistMatch(); return; }
    if (c.think) { openThink(); controls.reset(); return; }
    S.update(dt, c);
    // the aim ring: where a kick (or, when tackled, a handball) from here would go
    const hp = S.humanPlayer();
    G.aim = null;
    if (hp && (s.phase === 'play' || s.phase === 'setshot') && s.ball.owner === hp.id) G.aim = { t: S.humanTarget(hp, hp.st === 'tackled' ? 'handball' : 'kick') };
    recordHist();
    processEvents();
    if (G.mode === 'drill') drillTick();
  }

  // ?shot=1 (store screenshots): a real match played by computer players, frozen after N ticks, with the full HUD
  function startShot() {
    G.mode = 'shot'; G.setup.lastMode = 'shot';
    const roles = { fwd: 3, mid: 1, def: 5, ruck: 0 };
    const role = ROLES[(config.seed >>> 0) % 4];
    setSim(createSim({ ...baseCfg(), mode: 'full', levels: [3, 3], humanRole: role, bot: true }, simRng.fork()));
    void roles;
    G.scene = 'play';
  }
  function startup() { if (config.shot) startShot(); else startDemoBg(); }
  startup();

  return {
    // Menus, Rules, About, settings, Learn, Watch & Learn, pause and the result screens are free; only real play counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && G.mode === 'ai') || G.paused || G.pauseMenu || !!G.think || !S || S.s.phase === 'break' || S.s.over,
    update(dt, input) {
      setPress(input.pointer);
      const touches = tp ? tp.snapshot() : legacyTouches(input.pointer);
      G.t += dt;
      if (G.scene === 'play' && wheel && !G.think && !G.pauseMenu) wheel.take();
      if (G.scene === 'play' && !G.paused && !G.pauseMenu && S && (G.mode === 'ai' || G.mode === 'watch') && !(G.mode === 'watch' && (S.s.hold || G.watch.paused))) murmur(dt);
      if (G.scene !== 'play') S.update(dt, {});
      switch (G.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'learn': updateFlowScene(dt, input, handleLearn, 'learn'); break;
        case 'lesson': updateFlowScene(dt, input, handleLesson, 'lesson'); break;
        case 'quiz': updateFlowScene(dt, input, handleQuiz, 'quiz'); break;
        case 'lessonresult': updateFlowScene(dt, input, handleLessonResult, 'lessonresult'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'qbreak': updateFlowScene(dt, input, handleQBreak, 'qbreak'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { go('title'); } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input, touches); break;
        default: break;
      }
    },
    render(ctx, view) {
      G.viewW = (view && view.cssW) || 720; G.viewH = (view && view.cssH) || 1280;
      ctx.clearRect(0, 0, W, H);
      if (view && view.noGL) renderFallback(ctx, G, view);
      switch (G.scene) {
        case 'title': MN.renderTitle(ctx, G); break;
        case 'setup': MN.renderSetup(ctx, G); break;
        case 'settings': MN.renderSettings(ctx, G); break;
        case 'learn': MN.renderLearn(ctx, G); break;
        case 'lesson': MN.renderLesson(ctx, G); break;
        case 'quiz': MN.renderQuiz(ctx, G); break;
        case 'lessonresult': MN.renderLessonResult(ctx, G); break;
        case 'result': MN.renderResult(ctx, G); break;
        case 'qbreak': renderPlayHud(ctx, G, view, null); MN.renderQBreak(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'howto': MN.renderPages(ctx, G, HOWTO, 'How to Play'); break;
        case 'about': MN.renderPages(ctx, G, aboutList, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        case 'play':
          renderPlayHud(ctx, G, view, G.cs);
          if (G.think) renderThink(ctx, G);
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        default: break;
      }
    },
    // called by the page when it goes to the background: a match in play stops at the pause menu instead of running on unseen
    autoPause() {
      if (G.scene === 'play' && S && (G.mode === 'ai' || G.mode === 'drill') && !G.pauseMenu && !G.think) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; controls.reset(); persistMatch(); }
      else if (G.scene === 'play' && G.mode === 'watch') G.watch.paused = true;
    },
    getState: () => G,
  };
}
