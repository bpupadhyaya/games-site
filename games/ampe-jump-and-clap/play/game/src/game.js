// Ampe: the game shell. Scenes, input, persistence, preview wiring, Learn, Watch & Learn, sound. The match itself lives in sim.js.
import { createSim } from './sim.js';
import { scr, setScreen, useColumn, colFor, readerGeom, setupPins, inRect, hudFor, host, clamp } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, rulesPages, LESSONS } from './content.js';
import * as MN from './menus.js';
import { renderHud, renderFallback, watchHit } from './hud.js';
import { STEP, TEXT_SCALES, THINK_STEPS, POINT_NAMES, DEMO_MATCH_CAP, SAVE_VERSION, LEVELS, TARGETS } from './consts.js';
import { predictHint } from './ai.js';

// fluid: the short side is always 720 units, the long side follows the screen (kit 1.7 fluid viewport); layout.js lays everything out from the live size
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const GRADE_COL = { perfect: '#7fe8d6', good: '#ffe9a0', ok: '#fff6e4', early: '#ffb59a', late: '#ffb59a', miss: '#ff9a86' };

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const dev = !!config.dev;            // tester switch (?dev=1 / the shell's Developer toggle): the preview never runs out
  const fx = env.fx || null;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, drum: 2, timing: 'standard', offset: 0, thinkIdx: 1, hero: 'm' },
    setup: { level: 3, watchA: 3, tempo: 'rising', target: 11, watch: false, lastKind: 'match' },
    ui: { scroll: 0, drag: null }, page: 0, back: 'title', setupMsg: '', restoreMsg: '',
    learn: { cur: 0, done: {}, result: null, tally: null },
    saved: null, record: { demoMatches: 0 },
    sim: null, look: { hero: 'm' }, vseed: rng.int(1000), paused: false, pauseMenu: false, thinkOpen: false, thinkData: null,
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
  let S = null, evSeen = 0, snap = null, simRng = rng.fork(), updAt = 0, lastLockMsg = 0;
  const now = () => (env.clock ? env.clock() : 0);

  // ---- persistence -------------------------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', G.settings); storage.set('learn', { done: G.learn.done }); storage.set('record', G.record); };
  const validSave = (d) => d && d.v === SAVE_VERSION && d.cfg && d.snap && Array.isArray(d.snap.score) && d.snap.score.every((v) => v < d.cfg.target) && d.snap.hist && Array.isArray(d.snap.hist.lead);
  const metaOf = (d) => ({ name: LEVELS[d.cfg.level - 1].name, score: [...d.snap.score], target: d.cfg.target });
  const persistMatch = () => {
    if (!S || G.mode !== 'match' || S.s.over) return;
    const d = { v: SAVE_VERSION, cfg: { level: G.setup.level, tempo: G.setup.tempo, target: G.setup.target }, snap: S.snapshot() };
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
    if (G.settings.hero !== 'f') G.settings.hero = 'm';
    G.look.hero = G.settings.hero;
    G.loaded = true;
    MN.invalidate();
    audio.setMuted?.(!G.settings.sound); fx?.setMuted?.(!G.settings.sound);
  });

  // ---- sound ------------------------------------------------------------------------------------------------------------
  const vol = () => [0, 0.35, 0.65, 1][G.settings.drum];
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    clap: () => { if (!G.settings.sound) return; if (fx) fx.clap(0.9); else { tone({ freq: 2200, to: 900, dur: 0.05, type: 'square', vol: 0.07 }); tone({ freq: 1400, to: 600, dur: 0.09, type: 'sawtooth', vol: 0.05 }); } },
    kick: (v = 1) => { const k = vol() * v; if (!k || !G.settings.sound) return; if (fx) fx.kick(k); else tone({ freq: 150, to: 45, dur: 0.14, type: 'sine', vol: 0.3 * k }); },
    hat: () => { const k = vol(); if (!k || !G.settings.sound) return; if (fx) fx.hat(k); else tone({ freq: 6000, dur: 0.025, type: 'square', vol: 0.025 * k }); },
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    count: () => tone({ freq: 880, dur: 0.07, type: 'triangle', vol: 0.12 * Math.max(0.4, vol()) }),
    point: (win) => (win ? [0, 4, 7].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.18 + i * 0.04, type: 'triangle', vol: 0.09 })) : [0, -3].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.22, type: 'triangle', vol: 0.07 }))),
    miss: () => tone({ freq: 160, to: 90, dur: 0.2, type: 'sawtooth', vol: 0.08 }),
  };
  const delayed = [];
  const later = (t, f) => delayed.push({ t, f });

  // ---- match lifecycle ----------------------------------------------------------------------------------------------
  const setSim = (sim) => { S = sim; G.sim = sim.s; evSeen = 0; G.fb = null; G.thinkOpen = false; G.thinkData = null; };
  const startBg = () => { setSim(createSim({ mode: 'demo', humans: [false, false], levels: [3, 3], tempo: 'slow', target: 999, leader: 0 }, simRng.fork())); G.mode = 'none'; };
  const baseCfg = () => ({ timing: G.settings.timing, offset: G.settings.offset });
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    G.look.hero = G.settings.hero;
    let cfg;
    if (kind === 'match') {
      if (demo && G.record.demoMatches >= DEMO_MATCH_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; MN.invalidate(); return; }
      cfg = { ...baseCfg(), mode: 'match', humans: [true, false], levels: [0, st.level], tempo: st.tempo, target: demo ? 11 : st.target, penalty: true };
    } else if (kind === 'watch') {
      cfg = { ...baseCfg(), mode: 'watch', humans: [false, false], levels: [st.watchA, st.level], tempo: 'slow', target: 11, hold: true, timing: 'standard' };
    } else if (kind === 'practice') {
      cfg = { ...baseCfg(), mode: 'practice', humans: [true, false], levels: [0, 1], tempo: 'practice', penalty: false, leader: 0 };
    } else if (kind === 'lesson') {
      cfg = { ...baseCfg(), humans: [true, false], levels: [0, 2], penalty: false, ...opts.lesson.cfg };
    }
    if (opts.resume) cfg.resume = opts.resume;
    G.mode = kind === 'lesson' ? 'learn' : kind;
    st.lastKind = kind;
    setSim(createSim(cfg, simRng.fork()));
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = !!opts.paused; G.ui.scroll = 0; MN.invalidate();
    G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1 };
    if (kind === 'match') { if (demo) { G.record.demoMatches++; saveSettings(); } if (!opts.resume) persistMatch(); }
  }
  const resumeMatch = () => {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    Object.assign(G.setup, d.cfg);
    startMatch('match', { resume: d.snap, paused: true });
  };
  const leaveMatch = () => { persistMatch(); G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.thinkOpen = false; G.ui.scroll = 0; MN.invalidate(); startBg(); };

  // ---- learn -----------------------------------------------------------------------------------------------------------
  function startLesson() {
    const l = LESSONS[G.learn.cur];
    G.learn.tally = { n: 0, ok: 0, rounds: 0 };
    startMatch('lesson', { lesson: l });
  }
  function lessonEvent(e, s) {
    const l = LESSONS[G.learn.cur], T = G.learn.tally;
    if (!l || !T) return;
    if (e.type === 'reveal') {
      T.rounds++;
      const f = e.feet[0], g = S.s.round.grade[0];
      let ok = false;
      if (l.kind === 'timing') ok = f !== null && (g === 'perfect' || g === 'good');
      else if (l.kind === 'left') ok = f === 0;
      else if (l.kind === 'right') ok = f === 1;
      else if (l.kind === 'match') ok = f !== null && e.feet[1] !== null && e.match;
      else if (l.kind === 'differ') ok = f !== null && e.feet[1] !== null && !e.match;
      if (ok) T.ok++;
      G.fb = { t: s.t, text: ok ? 'Good' : 'Not this time', col: ok ? '#7fe8d6' : '#ffb59a' };
    }
    if (e.type === 'matchEnd') {
      let res;
      if (l.kind === 'win') res = { score: e.winner === 0 ? 1 : 0, n: 1, pass: e.winner === 0 };
      else res = { score: T.ok, n: l.cfg.maxRounds, pass: T.ok >= l.need };
      G.learn.result = res;
      if (res.pass) { G.learn.done[l.id] = true; saveSettings(); }
      G.scene = 'lessonresult'; G.ui.scroll = 0; G.mode = 'none'; MN.invalidate(); startBg();
    }
  }

  // ---- events from the sim: sound, feedback, saving ---------------------------------------------------------------------
  function processEvents() {
    const s = S.s;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (G.scene !== 'play') continue;
      if (e.type === 'beat') { if (e.kind === 'count') { sfx.count(); } else { sfx.kick(e.kind === 'two' ? 1 : 0.8); } sfx.hat(); }
      else if (e.type === 'clap') sfx.clap();
      else if (e.type === 'tap' && e.p === 0 && s.cfg.humans[0]) {
        G.fb = { t: s.t, text: POINT_NAMES[e.grade] || '', col: GRADE_COL[e.grade] || '#fff', d: e.d };
        if (e.grade === 'perfect') later(0.0, () => tone({ freq: 1320, dur: 0.07, type: 'triangle', vol: 0.06 }));
        if (e.grade === 'miss') sfx.miss();
      } else if (e.type === 'reveal') {
        const mine = s.cfg.humans[0] ? e.scorer === 0 : true;
        if (e.scorer >= 0) later(0.12, () => sfx.point(mine));
        if (G.mode === 'match') persistMatch();
      } else if (e.type === 'matchEnd') {
        if (G.mode === 'match' || G.mode === 'watch') { if (G.mode === 'match') { clearSave(); if (e.winner === 0) { G.record.matchWins = (G.record.matchWins | 0) + 1; saveSettings(); } } G.scene = 'result'; G.ui.scroll = 0; MN.invalidate(); }
      }
      if (G.mode === 'learn') lessonEvent(e, s);
      if (G.scene !== 'play') break;
    }
  }

  // ---- watch & learn --------------------------------------------------------------------------------------------------------
  const nm = (i) => (i === 0 ? 'Gold' : 'Teal');
  const nfoot = (x) => (x === 1 ? 'Right' : 'Left');
  // "Gold has thrown Right in 3 of its last 4 rounds": the plain facts a player could have used
  function habitLine(s, p) {
    const hs = s.hist.feet[p].slice(-5), n = hs.length;
    if (n < 3) return '';
    const r = hs.filter((x) => x === 1).length, l = n - r, top = r >= l ? 1 : 0, k = Math.max(r, l);
    return k * 2 > n ? `${nm(p)} has thrown ${nfoot(top)} in ${k} of its last ${n} rounds.` : `${nm(p)} has been mixing its feet (${l} Left, ${r} Right lately).`;
  }
  function watchTexts(s) {
    const h = s.hold, L = h.leader, F = 1 - L;
    const pr = predictHint(s.hist.feet[F], true, nm(L), nm(F));
    const think = `${nm(L)} is the Leader this round, so ${nm(L)} wants the two feet to MATCH. ${nm(F)} is the Follower and wants them to DIFFER. `
      + `${habitLine(s, F) || `${nm(F)} has not shown a habit yet.`} ${habitLine(s, L)} `
      + `${pr.text.replace(/^It threw/, `${nm(F)} threw`).replace(/ It will probably throw/, ` ${nm(F)} will probably throw`)} `
      + `A smart Leader copies the foot the Follower is likely to use; a smart Follower avoids the foot the Leader is likely to copy.`;
    const f = h.planned, same = f[0] === f[1];
    const sc = [s.score[0], s.score[1]]; sc[same ? L : F]++;
    const why = same
      ? `${nm(L)} (Leader) guessed right and scores: ${nm(L)} wanted a match and ${nm(F)} threw the same foot, so ${nm(L)} stays the Leader.`
      : `${nm(F)} (Follower) scores: ${nm(F)} wanted a difference and got one, so ${nm(F)} becomes the Leader and ${nm(L)} must now try to differ.`;
    const reveal = `${nm(0)} chose ${nfoot(f[0])}. ${nm(1)} chose ${nfoot(f[1])}. ${same ? 'SAME foot.' : 'DIFFERENT feet.'} ${why} Score after this round: Gold ${sc[0]}, Teal ${sc[1]}.`;
    return { think, reveal };
  }
  function updateWatch() {
    const s = S.s, w = G.watch;
    if (w.paused) return false;
    if (s.phase === 'hold' && s.hold) {
      if (w.holdId !== s.hold.id) { w.holdId = s.hold.id; w.phase = 'think'; w.timer = THINK_STEPS[G.settings.thinkIdx]; w.texts = watchTexts(s); }
      return 'hold';
    }
    G.watchText = G.watchText && w.phase === 'act' ? G.watchText : G.watchText;
    return true;
  }

  // ---- play input ----------------------------------------------------------------------------------------------------------
  function tapFoot(f) {
    const ok = S.tap(0, f);
    G.pressFlash = { f, t: S.s.t };
    return ok;
  }
  const doPause = () => { G.paused = true; G.pauseMenu = true; G.thinkOpen = false; G.ui.scroll = 0; MN.invalidate(); persistMatch(); };
  function openThink() {
    if (G.mode === 'watch') return;
    G.thinkData = S.hint(0); G.thinkOpen = true; G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; MN.invalidate();
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
    if (ptr.pressed) {
      if (inRect(lay.left, ptr.x, ptr.y)) tapFoot(0);
      else if (inRect(lay.right, ptr.x, ptr.y)) tapFoot(1);
      else if (inRect(lay.util.pause, ptr.x, ptr.y)) { doPause(); return; }
      else if (inRect(lay.util.think, ptr.x, ptr.y)) { openThink(); return; }
    }
    if (keys.pressed.has('KeyA') || keys.pressed.has('ArrowLeft')) tapFoot(0);
    if (keys.pressed.has('KeyD') || keys.pressed.has('ArrowRight')) tapFoot(1);
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
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'continue') resumeMatch();
    else if (id === 'play') { G.setup.watch = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { G.setup.watch = true; go('setup'); G.setupMsg = ''; }
    else if (id === 'practice') startMatch('practice');
    else if (id === 'learn') go('learn');
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); fx?.setMuted?.(!G.settings.sound); saveSettings(); MN.invalidate(); }
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('opp')) st.level = +id.slice(3);
    else if (id.startsWith('wa')) st.watchA = +id.slice(2);
    else if (id.startsWith('tp-')) st.tempo = id.slice(3);
    else if (id === 'len-11') st.target = 11;
    else if (id === 'len-21') { if (demo) { G.setupMsg = 'The 21-point game is in the full app.'; return; } st.target = 21; }
    else if (id === 'hero-m' || id === 'hero-f') { G.settings.hero = id.slice(5); G.look.hero = G.settings.hero; saveSettings(); }
    else if (id === 'start') {
      if (demo && st.level > 2 && !st.watch) { G.setupMsg = 'The free demo has the first two opponents.'; return; }
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
    else if (id === 'p-sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); fx?.setMuted?.(!G.settings.sound); saveSettings(); MN.invalidate(); }
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
    if (G.mode === 'shot') { shotTick(dt); S.update(dt); processEvents(); updAt = now(); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    if (G.paused) { if (input.keys.pressed.has('KeyP')) G.paused = false; return; }
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
      if (w.phase === 'act') G.watchText = w.texts ? `${w.texts.reveal}` : '';
    }
    S.update(dt); updAt = now();
    processEvents();
  }

  // ?shot=1 (store screenshots): a real game played by a coached bot, frozen after N ticks with the full HUD
  const shotBot = { n: 0 };
  function shotTick() {
    const s = S.s, r = s.round;
    if (r && !r.resolved && r.foot[0] === null && s.t >= r.tc - 0.003) S.tap(0, (r.n * 5 + 1) % 3 === 0 ? 0 : 1);
    shotBot.n++;
  }
  function startShot() {
    G.look.hero = 'm'; G.mode = 'shot'; G.setup.lastKind = 'match';
    setSim(createSim({ mode: 'match', humans: [true, false], levels: [0, 3], tempo: 'quick', target: 11, timing: 'standard', penalty: true }, simRng.fork()));
    G.scene = 'play';
  }
  function startup() { if (config.shot) startShot(); else startBg(); }
  startup();

  // Where the two players should appear on screen (virtual units): the 3D camera frames them inside this rectangle.
  function camBand() {
    const { vw, vh } = scr, R = (x, y, w, h) => ({ x, y, w, h });
    const play = hudFor(G.settings.textIdx, G.mode === 'watch').band;
    if (G.scene === 'play') return play;
    if (G.scene === 'title' || G.scene === 'result') {
      const col = colFor(G.scene);
      if (scr.land) { const lw = col.x - 16; return lw >= 300 ? R(host.l + 10, host.t + 20, lw - host.l - 10, vh - host.t - host.b - 40) : play; }
      if (G.scene === 'title') { const tb = MN.titleBand(); return tb.gap >= 100 ? R(0, tb.top, vw, tb.gap) : play; }
    }
    return play;
  }

  const api = {
    // Menus, Rules, About, settings, Learn, Practice, Watch & Learn, the count-in before the first beat, pause and results are free;
    // only live rounds of a match count against the preview.
    isPreviewExempt: () => dev || !(G.scene === 'play' && G.mode === 'match') || G.paused || G.pauseMenu || !S || S.s.over || S.s.phase === 'count',
    autoPause() { if (G.scene === 'play' && !G.paused && !G.pauseMenu && G.mode !== 'shot') { if (G.mode === 'watch') G.watch.paused = true; else doPause(); } },
    update(dt, input) {
      setScreen(meta.width, meta.height);
      const col = useColumn(G.scene === 'play' && !G.pauseMenu ? 'play' : G.scene === 'play' ? 'pause' : G.scene, G.scene === 'play' && G.pauseMenu);
      // menu screens draw in a column; pointer positions are translated into that column's space
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
      ctx.save(); ctx.translate(col.x, 0);
      const running = !G.paused && !(G.mode === 'watch' && G.watch.paused) && (G.scene !== 'play' || true);
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
  };
  void TARGETS;
  return api;
}
