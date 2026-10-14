// Gumboot Throwing: the game shell. Scenes, input (one thumb), persistence, preview wiring, the Festival Cup, Distance Challenge, Practice,
// Learn drills, Watch & Learn and the Think hint. One throw lives in sim.js (pure, fixed 60 Hz); the picture lives in scene.js and hud.js and
// only reads the state exposed here.
import { createThrow, rivalThrows, makeAi, aiPlan, sweetArc, ghostPath, releaseWords, STEP } from './sim.js';
import { live, syncSize, sizeKey, TEXT_SCALES, refLayout, setupPins, inRect, playLayout } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import * as MN from './menus.js';
import { renderHud, watchRects, stripToAim, windWords, fmt } from './hud.js';
import { drawScene, makeCam, viewFor } from './scene.js';
import { ROUNDS, STYLES, WINDS, LESSONS, THROWS_PER_ROUND, CHALLENGE_LIVES, THINK_STEPS, challengeLevel } from './consts.js';

// Fluid viewport (kit 1.7): the short side is 720 units, the long side follows the screen. The kit keeps meta.width / meta.height live.
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEMO_THROW_CAP = 9;
const KEY_AIM = 14;        // degrees per second with the arrow keys

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false, dev: !!config.dev, t: 0,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, guide: 0 },
    setup: { mode: 'cup', round: 0, pace: 1, sway: 1 },
    progress: { stars: [0, 0, 0, 0, 0], best: 0, drills: {}, demoRuns: 0, rounds: 0 },
    ui: { scroll: 0, drag: null }, back: 'title', setupMsg: '', restoreMsg: '', restoreBusy: false, owned: false,
    round: null, run: null, cfg: { wind: 2, sector: 14, sky: 0, boot: 0 }, style: 1,
    paused: false, pauseMenu: false, think: null, thinkRects: null, hinted: false, hintMsg: '',
    watch: { phase: 'ready', timer: 0, paused: false, lines: [], ai: null, plan: null },
    lastDist: 0, rivalNow: null, resultInfo: null, learnCur: 0, drillResult: null, drill: null,
    c: { hold: false, strip: false, key: false }, heroWin: { x: 0, y: 0, w: 0, h: 0 }, cam: null, guide: null, cheer: false, sky: 0, lastMode: 'cup', camFrom: null,
  };
  const simRng = rng.fork();
  const syncOwned = () => { const o = !!env.monetization?.owns?.('unlock_game'); if (o !== G.owned) { G.owned = o; MN.invalidateLayout(); } };
  env.monetization?.onChange?.(syncOwned);
  let evSeen = 0, lastSize = '', swingTick = 0, guideKey = '';

  // ---- persistence --------------------------------------------------------------------------------------------------------
  const saveAll = () => { storage.set('settings', G.settings); storage.set('progress', G.progress); storage.set('setup', G.setup); };
  Promise.all([storage.get('settings', null), storage.get('progress', null), storage.get('setup', null)]).then(([s, p, su]) => {
    if (s) Object.assign(G.settings, s);
    if (p) {
      if (Array.isArray(p.stars)) G.progress.stars = ROUNDS.map((_, i) => clamp(p.stars[i] | 0, 0, 3));
      G.progress.best = +p.best || 0; G.progress.drills = p.drills && typeof p.drills === 'object' ? p.drills : {};
      G.progress.demoRuns = p.demoRuns | 0; G.progress.rounds = p.rounds | 0;
    }
    if (su) { G.setup.mode = ['cup', 'challenge', 'practice', 'watch'].includes(su.mode) ? su.mode : 'cup'; G.setup.round = clamp(su.round | 0, 0, ROUNDS.length - 1); G.setup.pace = clamp(su.pace ?? 1, 0, 2); G.setup.sway = clamp(su.sway ?? 1, 0, 2); }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.settings.guide = clamp(G.settings.guide | 0, 0, 2);
    G.loaded = true; MN.invalidateLayout(); audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound --------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    swing: (om) => tone({ freq: 140 + om * 34, to: 120 + om * 40, dur: 0.1, type: 'sawtooth', vol: 0.018 }),
    thwip: () => { tone({ freq: 900, to: 180, dur: 0.3, type: 'sawtooth', vol: 0.035 }); tone({ freq: 200, to: 120, dur: 0.08, type: 'triangle', vol: 0.1 }); },
    thud: () => { tone({ freq: 120, to: 55, dur: 0.18, type: 'triangle', vol: 0.22 }); tone({ freq: 700, to: 220, dur: 0.07, type: 'square', vol: 0.02 }); },
    squelch: () => tone({ freq: 320, to: 90, dur: 0.22, type: 'sine', vol: 0.09 }),
    cheer: (n) => [0, 7, 12, 16].slice(0, n).forEach((k, i) => tone({ freq: 330 * Math.pow(2, k / 12), dur: 0.3, type: 'sawtooth', vol: 0.025 + i * 0.002 })),
    boo: () => tone({ freq: 190, to: 110, dur: 0.3, type: 'sine', vol: 0.06 }),
    go: () => tone({ freq: 440, to: 660, dur: 0.12, type: 'triangle', vol: 0.08 }),
  };

  // ---- rounds and throws --------------------------------------------------------------------------------------------------
  const delayed = [];
  const later = (f, t = 0.3) => delayed.push({ t, f });
  const blankRound = (idx) => ({ idx, runIdx: 0, mine: [], rivalRuns: [], rivalAll: [], best: 0, rivalBest: 0, total: 0, fairs: 0, fouls: 0, marks: [], over: false, hintUsed: false });
  const cfgFor = () => {
    const R = G.round, m = G.mode, st = G.setup;
    if (m === 'cup' || m === 'watch') { const r = ROUNDS[R.idx]; return { wind: r.wind, sector: r.sector, sky: r.sky, boot: r.boot }; }
    if (m === 'challenge') return challengeLevel(R.runIdx);
    if (m === 'drill') { const l = LESSONS[G.learnCur].cfg; return { wind: l.wind, sector: l.sector, sky: G.learnCur, boot: l.boot }; }
    return { wind: 6 * WINDS[st.sway].k, sector: 14, sky: 1, boot: 0 };
  };
  const newThrow = () => {
    const R = G.round;
    if (G.cam && G.run) G.camFrom = { ...viewFor(G.cam, G.run.s), t0: G.t }; else G.camFrom = null;
    G.cfg = cfgFor(); G.sky = G.cfg.sky;
    G.run = createThrow({ ...G.cfg, style: G.style }, simRng.fork());
    evSeen = 0; swingTick = 0; guideKey = '';
    G.think = null; G.hinted = false; G.hintMsg = ''; G.c.hold = false; G.c.strip = false; G.c.key = false; G.rivalNow = null; G.cheer = false; G.guide = null;
    G.watch.phase = 'ready'; G.watch.timer = 0; G.watch.lines = []; G.watch.plan = null;
    G.watch.ai = makeAi(ROUNDS[Math.min(ROUNDS.length - 1, R.idx)].skill, simRng.fork());
  };
  function startRound(mode, opts = {}) {
    const st = G.setup;
    const idx = opts.idx ?? (mode === 'cup' || mode === 'watch' ? st.round : 0);
    if (demo && mode === 'cup' && idx > 1) { G.setupMsg = 'The web demo has the first two rounds.'; return; }
    if (demo && mode === 'challenge' && G.progress.demoRuns >= DEMO_THROW_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; MN.invalidateLayout(); return; }
    G.mode = mode; G.lastMode = mode;
    G.round = blankRound(idx);
    if (mode === 'cup' || mode === 'watch') G.round.rivalAll = rivalThrows(ROUNDS[idx], THROWS_PER_ROUND, simRng.fork());
    if (mode === 'practice') G.style = st.pace;
    G.style = clamp(G.style, 0, 2);
    if (mode === 'drill') { const l = LESSONS[G.learnCur]; G.style = l.cfg.style; G.drill = { id: l.id, title: l.title, goal: l.goal, got: 0, need: l.need, runs: l.runs }; } else G.drill = null;
    G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.ui.scroll = 0; G.resultInfo = null; G.watch.paused = false; G.camFrom = null; G.run = null;
    newThrow(); MN.invalidateLayout();
  }

  // ---- guide and hint -------------------------------------------------------------------------------------------------------
  const updateGuide = () => {
    const run = G.run, s = run.s;
    if ((G.settings.guide > 1 && !G.drill) || (s.phase !== 'ready' && s.phase !== 'swing')) { G.guide = null; guideKey = ''; return; }
    const t = s.phase === 'swing' ? s.t : 1.9, key = `${s.style}|${Math.round(t * 30)}|${s.aim}|${s.phase}`;
    if (key === guideKey && G.guide) return;
    guideKey = key;
    const g = { arc: sweetArc(run, t), pred: null, ghost: null };
    if (s.phase === 'swing') { g.pred = run.predict(s.t, s.aim); g.ghost = ghostPath(run, s.t, s.aim); }
    G.guide = g;
  };
  const planLines = (run, forWatch, plan) => {
    const s = run.s, w = releaseWords(plan), st = STYLES[plan.style ?? s.style];
    const lines = [`The wind is ${windWords(s.wind)}. The lane is about ${Math.round(s.sector * 2)} degrees wide.`];
    if (forWatch) lines.push(`The ${st.name} promises the most within a safe holding time.`);
    lines.push(Math.abs(plan.aim) < 0.4 ? 'Aim straight down the lane.' : `Turn the aim ${Math.abs(plan.aim).toFixed(1)} degrees to the ${plan.aim > 0 ? 'right' : 'left'} so the wind carries the boot back to the middle.`);
    lines.push(`Hold for about ${w.sec.toFixed(1)} seconds, then let go as the boot comes up through the green arc. That should fly about ${fmt(plan.d)}${plan.fair ? '' : ', but it would land outside the lane'}.`);
    return lines;
  };

  // ---- throw end ------------------------------------------------------------------------------------------------------------
  function finishThrow() {
    const R = G.round, s = G.run.s;
    if (R.over) return;
    const fair = s.outcome === 'fair', dist = fair ? s.dist : 0;
    G.lastDist = dist;
    R.mine.push({ outcome: fair ? 'fair' : 'foul', dist, hinted: G.hinted });
    R.marks.push({ x: s.landX, z: s.landZ, fair });
    if (G.hinted) R.hintUsed = true;
    if (fair) { R.fairs++; R.total = Math.round((R.total + dist) * 10) / 10; if (dist > R.best) R.best = dist; } else R.fouls++;
    const rv = R.rivalAll[R.runIdx] || null;
    if (rv) { R.rivalRuns.push(rv); if (rv.dist > R.rivalBest) R.rivalBest = rv.dist; G.rivalNow = rv; }
    R.runIdx++;
    if (G.mode === 'challenge' && demo) { G.progress.demoRuns++; saveAll(); }
    let over = false;
    if (G.mode === 'cup' || G.mode === 'watch') over = R.runIdx >= THROWS_PER_ROUND;
    else if (G.mode === 'challenge') over = R.fouls >= CHALLENGE_LIVES || (demo && G.progress.demoRuns >= DEMO_THROW_CAP);
    else if (G.mode === 'drill') {
      const d = G.drill, l = LESSONS[G.learnCur];
      d.got = R.mine.filter((m) => m.outcome === 'fair' && m.dist >= l.far).length;
      over = R.runIdx >= l.runs || d.got >= d.need;
    }
    if (over) endRound(); else later(() => { if (G.scene === 'play' && G.round && !G.round.over) newThrow(); }, 0.01);
  }

  function endRound() {
    const R = G.round; R.over = true;
    const info = { stars: 0, newStar: false, canNext: false, newBest: false, hintCapped: false };
    if (G.mode === 'cup' || G.mode === 'watch') {
      const win = R.best > R.rivalBest;
      if (G.mode === 'cup') {
        const rd = ROUNDS[R.idx], top = R.best >= rd.star3;
        info.hintCapped = win && top && R.hintUsed;
        info.stars = win ? 1 + (R.best >= rd.star2 ? 1 : 0) + (top && !R.hintUsed ? 1 : 0) : 0;
        if (info.stars > G.progress.stars[R.idx]) { G.progress.stars[R.idx] = info.stars; info.newStar = true; }
        info.canNext = win && R.idx < ROUNDS.length - 1 && !(demo && R.idx + 1 > 1);
        G.progress.rounds++;
      }
    } else if (G.mode === 'challenge') {
      if (R.total > G.progress.best) { G.progress.best = R.total; info.newBest = true; }
    }
    G.resultInfo = info;
    if (G.mode === 'drill') {
      const l = LESSONS[G.learnCur], pass = G.drill.got >= G.drill.need;
      if (pass) G.progress.drills[l.id] = true;
      G.drillResult = { pass, got: G.drill.got };
      later(() => { if (G.round && G.round.over) { G.scene = 'lessonresult'; G.ui.scroll = 0; MN.invalidateLayout(); } }, 0.5);
    } else later(() => { if (G.round && G.round.over) { G.scene = 'result'; G.ui.scroll = 0; MN.invalidateLayout(); } }, 0.5);
    saveAll();
    sfx.cheer(3);
  }

  // ---- events -> sound and flow -------------------------------------------------------------------------------------------
  function processEvents() {
    const s = G.run.s;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (e.type === 'begin') sfx.go();
      else if (e.type === 'release') sfx.thwip();
      else if (e.type === 'slip') { sfx.squelch(); sfx.thwip(); }
      else if (e.type === 'land') {
        sfx.thud();
        if (e.outcome === 'fair') { G.cheer = true; sfx.cheer(e.dist > 40 ? 4 : e.dist > 25 ? 3 : 2); } else sfx.boo();
      } else if (e.type === 'end' && G.mode !== 'shot') finishThrow();
    }
    if (s.phase === 'swing') { const q = Math.floor(s.t * 9); if (q !== swingTick) { swingTick = q; sfx.swing(s.omega); } }
  }

  // ---- input --------------------------------------------------------------------------------------------------------------
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; MN.invalidateLayout(); };
  function setText(v) { G.settings.textIdx = clamp(v, 0, TEXT_SCALES.length - 1); G.ui.scroll = 0; MN.invalidateLayout(); saveAll(); }
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) setText(G.settings.textIdx + 1);
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) setText(G.settings.textIdx - 1);
    const wh = input.wheel ? input.wheel.dy : 0; if (wh) G.ui.scroll = clamp(G.ui.scroll + wh, 0, max);
    if (input.keys.down.has('ArrowDown')) G.ui.scroll = clamp(G.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) G.ui.scroll = clamp(G.ui.scroll - 14, 0, max);
  };
  const openSetup = (mode) => { G.setup.mode = mode; G.setupMsg = ''; go('setup'); };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'cup' || id === 'challenge' || id === 'practice' || id === 'watch') openSetup(id);
    else if (id === 'learn') go('learn');
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') { G.restoreMsg = ''; go('settings'); }
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); MN.invalidateLayout(); }
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('rd')) { st.round = +id.slice(2); G.setupMsg = ''; MN.invalidateLayout(); saveAll(); }
    else if (id.startsWith('pace')) { st.pace = +id.slice(4); MN.invalidateLayout(); saveAll(); }
    else if (id.startsWith('sway')) { st.sway = +id.slice(4); MN.invalidateLayout(); saveAll(); }
    else if (id === 'start') {
      const open = st.round === 0 || G.progress.stars[st.round - 1] > 0 || st.mode === 'watch' || G.dev;
      if ((st.mode === 'cup' || st.mode === 'watch') && !open) { G.setupMsg = 'Win the round before it first.'; return; }
      startRound(st.mode);
    } else if (id === 'back') go('title');
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') setText(st.textIdx - 1);
    else if (id === 'txt-inc') setText(st.textIdx + 1);
    else if (id === 'guide-dec') st.guide = Math.max(0, st.guide - 1);
    else if (id === 'guide-inc') st.guide = Math.min(2, st.guide + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (G.restoreBusy || G.owned) return;
      G.restoreBusy = true; G.restoreMsg = 'Checking with the store...';
      const done = (msg) => { G.restoreBusy = false; G.restoreMsg = msg; MN.invalidateLayout(); };
      Promise.resolve().then(() => env.monetization.restore())
        .then(() => { G.owned = !!env.monetization.owns?.('unlock_game'); done(G.owned ? 'Purchase restored. Full game unlocked.' : 'No earlier purchase found for this store account.'); })
        .catch(() => done('Could not reach the store. Please try again later.'));
    }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveAll(); MN.invalidateLayout();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    const m = G.lastMode === 'drill' || G.lastMode === 'shot' ? G.setup.mode : G.lastMode;
    if (id === 'next') startRound('cup', { idx: G.round.idx + 1 });
    else if (id === 'again') startRound(m, { idx: G.round ? G.round.idx : 0 });
    else if (id === 'new') openSetup(m);
    else if (id === 'menu') go('title');
  }
  function handleLearn(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id.startsWith('lesson') && id !== 'lesson-go' && id !== 'lesson-back') { G.learnCur = +id.slice(6); go('lesson'); }
  }
  const startLesson = () => startRound('drill');
  function handleLesson(id) { if (!id) return; sfx.tick(); if (id === 'lesson-go') startLesson(); else if (id === 'lesson-back') go('learn'); }
  function handleLessonResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'lr-again') startLesson();
    else if (id === 'lr-next') { G.learnCur = Math.min(LESSONS.length - 1, G.learnCur + 1); go('lesson'); }
    else if (id === 'lr-list') go('learn');
  }
  function leaveRound() {
    const m = G.mode, R = G.round;
    G.paused = false; G.pauseMenu = false; G.think = null; G.watch.paused = false;
    if (R) R.over = true;
    if ((m === 'practice' || m === 'challenge') && R && R.runIdx > 0) {
      const info = { newBest: false };
      if (m === 'challenge' && R.total > G.progress.best) { G.progress.best = R.total; info.newBest = true; }
      G.resultInfo = info; saveAll(); go('result'); return;
    }
    go('title');
  }
  function handlePause(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') { G.paused = false; G.pauseMenu = false; }
    else if (id === 'p-rules') { G.back = 'play'; go('rules'); }
    else if (id === 'p-howto') { G.back = 'play'; go('howto'); }
    else if (id === 'p-sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); }
    else if (id === 'p-txt-dec') setText(G.settings.textIdx - 1);
    else if (id === 'p-txt-inc') setText(G.settings.textIdx + 1);
    else if (id === 'quit') leaveRound();
    MN.invalidateLayout();
  }
  const refList = () => (G.scene === 'howto' ? [HOWTO, 'How to Play'] : G.scene === 'about' ? [ABOUT, 'About'] : [RULES, 'Rules']);
  const updatePages = (input) => {
    const [list, header] = refList(); MN.refPrepare(G, list, header);
    const ptr = input.pointer, keys = input.keys, rm = MN.refMeta(), view = rm.vh, R = refLayout();
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.ui.scroll = 0; G.ui.drag = null; MN.invalidateLayout(); };
    const setS = (v) => { G.ui.scroll = clamp(v, 0, rm.max); };
    const next = () => { if (G.ui.scroll >= rm.max - 4) close(); else setS(G.ui.scroll + view * 0.85); };
    const prev = () => { if (G.ui.scroll <= 4) close(); else setS(G.ui.scroll - view * 0.85); };
    if (ptr.pressed) {
      if (inRect(R.next, ptr.x, ptr.y)) next();
      else if (inRect(R.back, ptr.x, ptr.y)) prev();
      else if (inRect(R.dec, ptr.x, ptr.y)) setText(G.settings.textIdx - 1);
      else if (inRect(R.inc, ptr.x, ptr.y)) setText(G.settings.textIdx + 1);
      else G.ui.drag = { y0: ptr.y, s0: G.ui.scroll };
    }
    if (G.ui.drag && ptr.down) setS(G.ui.drag.s0 - (ptr.y - G.ui.drag.y0));
    if (!ptr.down) G.ui.drag = null;
    const wh = input.wheel ? input.wheel.dy : 0; if (wh) setS(G.ui.scroll + wh);
    if (keys.down.has('ArrowDown')) setS(G.ui.scroll + 16);
    if (keys.down.has('ArrowUp')) setS(G.ui.scroll - 16);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) setS(G.ui.scroll + view * 0.85);
    if (keys.pressed.has('PageUp')) setS(G.ui.scroll - view * 0.85);
    if (keys.pressed.has('End')) setS(rm.max);
    if (keys.pressed.has('Home')) setS(0);
    if (keys.pressed.has('Equal') || keys.pressed.has('NumpadAdd')) setText(G.settings.textIdx + 1);
    if (keys.pressed.has('Minus') || keys.pressed.has('NumpadSubtract')) setText(G.settings.textIdx - 1);
    if (keys.pressed.has('Escape')) close();
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    const pins = setupPins();
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) { handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  // ---- the field ----------------------------------------------------------------------------------------------------------
  function openPause() { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.c.hold = false; G.c.strip = false; G.c.key = false; MN.invalidateLayout(); }
  function openThink() {
    const run = G.run, s = run.s;
    if (s.phase !== 'ready') return;
    const plan = aiPlan(run, { errT: 0, errAim: 0, safe: 0.8 }, s.style);
    G.think = { lines: planLines(run, false, plan), plan };
    G.hinted = true; G.c.hold = false; G.c.strip = false;
  }
  const chooseStyle = (i) => { G.style = i; G.setup.pace = i; G.run.setStyle(i); sfx.tick(); };
  function updateWatchControls(input, L) {
    const wt = G.watch, ptr = input.pointer, st = G.settings;
    if (ptr.pressed) {
      const rects = watchRects(L);
      if (inRect(rects[0], ptr.x, ptr.y) || inRect(L.pause, ptr.x, ptr.y)) { wt.paused = !wt.paused; sfx.tick(); }
      else if (inRect(rects[1], ptr.x, ptr.y)) { st.thinkIdx = Math.max(0, st.thinkIdx - 1); saveAll(); sfx.tick(); }
      else if (inRect(rects[2], ptr.x, ptr.y)) { st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1); saveAll(); sfx.tick(); }
      else if (inRect(rects[3], ptr.x, ptr.y)) { leaveRound(); return false; }
    }
    if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) wt.paused = !wt.paused;
    return true;
  }
  function updateWatch(dt, input, L) {
    if (!updateWatchControls(input, L)) return;
    const wt = G.watch, run = G.run, s = run.s;
    if (wt.paused || s.over) return;
    if (s.phase === 'ready') {
      if (wt.phase === 'ready') {
        // the computer reads the wind and plans; then it thinks out loud
        wt.timer += dt;
        if (wt.timer >= 0.5) {
          const plan = aiPlan(run, wt.ai, null);
          wt.plan = plan; run.setStyle(plan.style); G.style = plan.style;
          wt.lines = planLines(run, true, plan); wt.phase = 'think'; wt.timer = THINK_STEPS[G.settings.thinkIdx];
        }
        return;
      }
      if (wt.phase === 'think') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'reveal'; wt.timer = 2; run.setAim(wt.plan.aim + wt.ai.errAim); } return; }
      if (wt.phase === 'reveal') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'act'; wt.lines = []; run.begin(); processEvents(); } return; }
      return;
    }
    if (s.phase === 'swing' && wt.plan && s.t >= wt.plan.t + wt.ai.errT) run.release();
    run.update(dt); processEvents();
  }
  function updatePlay(dt, input) {
    const L = playLayout(G.settings.textIdx);
    const run = G.run, s = run.s, ptr = input.pointer, keys = input.keys;
    if (G.mode === 'shot') {
      // store screenshots: a computer thrower plays the throw; ?ticks=N picks the moment
      if (G.devFreeze) return;
      if (!G.shotPlan) { G.shotPlan = aiPlan(run, { errT: 0, errAim: 0, safe: 0.8 }, s.style); run.setAim(G.shotPlan.aim); run.begin(); }
      if (s.phase === 'swing' && s.t >= G.shotPlan.t) run.release();
      run.update(dt); processEvents(); updateGuide();
      return;
    }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    if (G.mode === 'watch') { updateWatch(dt, input, L); updateGuide(); return; }
    if (G.think) {
      if ((ptr.pressed && G.thinkRects && inRect(G.thinkRects.close, ptr.x, ptr.y)) || keys.pressed.has('Enter') || keys.pressed.has('Escape') || keys.pressed.has('KeyT')) { G.think = null; sfx.tick(); }
      return;
    }
    if (s.over) return;
    if (ptr.pressed && inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { openPause(); return; }
    if (s.phase === 'ready') {
      if (ptr.pressed) {
        let hit = false;
        L.chips.forEach((r, k) => { if (inRect(r, ptr.x, ptr.y)) { chooseStyle(k); hit = true; } });
        if (inRect(L.think, ptr.x, ptr.y)) { openThink(); return; }
        if (!hit && inRect(L.strip, ptr.x, ptr.y)) { G.c.strip = true; run.setAim(stripToAim(L, ptr.x, ptr.y, s.sector)); }
        else if (!hit && !inRect(L.board, ptr.x, ptr.y)) { G.c.hold = true; G.c.key = false; G.hintMsg = ''; run.begin(); processEvents(); }
      }
      if (G.c.strip && ptr.down) run.setAim(stripToAim(L, ptr.x, ptr.y, s.sector));
      if (!ptr.down) G.c.strip = false;
      if (keys.pressed.has('Digit1')) chooseStyle(0);
      if (keys.pressed.has('Digit2')) chooseStyle(1);
      if (keys.pressed.has('Digit3')) chooseStyle(2);
      if (keys.pressed.has('KeyT')) { openThink(); return; }
      const kx = (keys.down.has('ArrowDown') || keys.down.has('KeyS') ? 1 : 0) - (keys.down.has('ArrowUp') || keys.down.has('KeyW') ? 1 : 0)
        + (keys.down.has('ArrowRight') || keys.down.has('KeyD') ? 1 : 0) - (keys.down.has('ArrowLeft') || keys.down.has('KeyA') ? 1 : 0);
      if (kx) run.setAim(Math.round((s.aim + kx * KEY_AIM * dt) * 100) / 100);
      if (keys.pressed.has('Space')) { G.c.hold = true; G.c.key = true; run.begin(); processEvents(); }
      updateGuide();
      return;
    }
    if (s.phase === 'swing') {
      const heldKey = keys.down.has('Space');
      if (G.c.hold && ((!G.c.key && !ptr.down) || (G.c.key && !heldKey))) { run.release(); G.c.hold = false; G.c.key = false; }
    } else { G.c.hold = false; G.c.key = false; }
    run.update(dt);
    processEvents();
    updateGuide();
  }

  // what the picture needs this frame
  G.sceneState = (run) => {
    const s = run ? run.s : null;
    const marks = G.round ? G.round.marks.map((m) => ({ x: m.x, z: m.z, fair: m.fair })) : [];
    return { frozen: !!(G.paused || G.pauseMenu || G.watch.paused), run: s, time: G.t, sky: G.sky, boot: s ? s.boot : 0, marks, ghost: G.guide && G.guide.ghost && G.settings.guide === 0 ? G.guide.ghost : null, cheer: G.cheer, camFrom: G.camFrom, windX: s ? s.wind.x : 0 };
  };
  G.sceneBack = (ctx, hero = false) => {
    const c = makeCam(live.w, live.h);
    drawScene(ctx, c, { run: null, time: G.t, sky: 1, boot: 0, marks: [], ghost: null, cheer: false, camFrom: null, windX: 2, menu: hero, heroWin: hero ? G.heroWin : null });
  };

  // dev and screenshots: put the throw in a chosen moment (ready, swing, flight, landed)
  const poseRun = (kind) => {
    const run = G.run, s = run.s;
    const sim = (n) => { for (let i = 0; i < n; i++) run.update(STEP); };
    if (kind === 'ready') return;
    const plan = aiPlan(run, { errT: 0, errAim: 0, safe: 0.8 }, s.style);
    run.setAim(plan.aim);
    run.begin();
    if (kind === 'swing') { sim(Math.round(plan.t * 60 * 0.8)); updateGuide(); return; }
    sim(Math.round(plan.t * 60));
    run.release();
    let g = 0;
    if (kind === 'flight') { while (s.phase === 'flight' && s.b && s.b.x < Math.max(14, plan.d * 0.55) && g++ < 2000) run.update(STEP); processEvents(); return; }
    while (s.phase !== 'landed' && g++ < 4000) run.update(STEP);
    if (kind === 'landed') sim(40);
    processEvents();
  };
  if (config.shot) {
    G.mode = 'shot'; G.round = blankRound(1); G.round.runIdx = 2; G.round.best = 31.4; G.round.rivalBest = 26.8;
    G.round.mine = [{ outcome: 'fair', dist: 31.4 }, { outcome: 'foul', dist: 0 }]; G.round.rivalRuns = [{ outcome: 'fair', dist: 24.1 }, { outcome: 'fair', dist: 26.8 }];
    G.round.marks = [{ x: 32.2, z: 1, fair: true }, { x: 20, z: 9, fair: false }];
    const sd = Number(config.shotSeed) || 0;
    G.sky = sd % 5; G.style = 1 + (sd % 2);
    G.cfg = { wind: 3 + (sd % 3), sector: 12, sky: G.sky, boot: sd % 5 };
    G.run = createThrow({ ...G.cfg, style: G.style }, simRng.fork());
    G.scene = 'play';
    if (config.dev) G.devFreeze = true;
  }
  if (config.dev) {
    G.devApi = {
      pose: (kind) => poseRun(kind),
      freeze(v = true) { G.devFreeze = v; },
      step(n = 1) { for (let i = 0; i < n; i++) { G.run.update(STEP); processEvents(); } },
      setStyle(i) { G.style = i; G.run.setStyle(i); },
    };
  }

  const api = {
    // Menus, Rules, About, settings, Learn, Watch & Learn, practice, pause, hints and waiting at the mat are free; only real throwing in the
    // Cup or the Challenge counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && (G.mode === 'cup' || G.mode === 'challenge') && G.run && (G.run.s.phase === 'swing' || G.run.s.phase === 'flight')) || G.paused || G.pauseMenu || !!G.think,
    update(dt, input) {
      syncSize(meta.width, meta.height);
      const sk = sizeKey();
      if (sk !== lastSize) { if (lastSize) { G.c.hold = false; G.c.strip = false; G.ui.drag = null; MN.invalidateLayout(); } lastSize = sk; }
      {
        // portrait: centred under the grip bar; landscape: top-left corner (the scoreboard is centred, Pause and Think are on the right)
        const PL = G.scene === 'play' ? playLayout(G.settings.textIdx) : null;
        meta.previewBadge = !PL ? { x: live.w / 2, y: live.h - 70, align: 'center' }
          : PL.land ? { x: PL.xl + 14, y: PL.yt + 12, align: 'left' } : { x: live.w / 2, y: PL.top + 56, align: 'center' };
      }
      setPress(input.pointer);
      G.t += dt; syncOwned();
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { const f = delayed[i].f; delayed.splice(i, 1); f(); } }
      switch (G.scene) {
        case 'title': {
          const lt = MN.getLockTap(), pp = input.pointer;
          MN.setLockDown(G.lockDown > G.t);
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
    render(ctx) {
      syncSize(meta.width, meta.height);
      G.vw = live.w; G.vh = live.h;
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
        case 'about': MN.renderPages(ctx, G, ABOUT, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        case 'play':
          renderHud(ctx, G);
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        default: break;
      }
    },
    getState: () => G,
  };
  if (config.dev) {
    const idle = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } });
    G.devApi.tick = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, idle()); };
  }
  return api;
}
