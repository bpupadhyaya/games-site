// Tent Pegging: the game shell. Scenes, input (one thumb), persistence, preview wiring, the Tournament Cup, Gallop Challenge, Practice,
// Learn drills, Watch & Learn and the Think hint. One run lives in sim.js (pure, fixed 60 Hz); the picture lives in scene.js and hud.js and
// only reads the state exposed here.
import { createRun, rivalRuns, makeAi, aiControl, thinkDue } from './sim.js';
import { live, syncSize, sizeKey, TEXT_SCALES, refLayout, setupPins, inRect, playLayout } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import * as MN from './menus.js';
import { renderHud, watchRects } from './hud.js';
import { drawScene, makeCam } from './scene.js';
import { ROUNDS, PACES, SWAYS, LESSONS, RUNS_PER_ROUND, CHALLENGE_LIVES, STARS_AT, THINK_STEPS, challengeLevel, DROP, REACH, PTS, AIM_MAX } from './consts.js';

// Fluid viewport (kit 1.7): the short side is 720 units, the long side follows the screen. The kit keeps meta.width / meta.height live.
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEMO_RUN_CAP = 6;
const PX_PER_M = 150;       // finger slide (virtual units) per metre of lance travel
const KEY_AIM = 2.2;        // metres per second with the arrow keys

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false, dev: !!config.dev, t: 0,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, guide: 0 },
    setup: { mode: 'cup', round: 0, pace: 1, sway: 1 },
    progress: { stars: [0, 0, 0, 0, 0], best: 0, drills: {}, demoRuns: 0, rounds: 0 },
    ui: { scroll: 0, drag: null }, back: 'title', setupMsg: '', restoreMsg: '', restoreBusy: false, owned: false,
    round: null, run: null, cfg: { sway: 0.2, off: 0.3, tol: 1, sky: 0, minPace: 0 }, pace: 1,
    paused: false, pauseMenu: false, think: null, thinkRects: null, hinted: false, hintMsg: '',
    watch: { phase: 'ready', timer: 0, paused: false, lines: [], ai: null },
    lastPoints: 0, lastStreakBonus: 0, rivalNow: null, resultInfo: null, learnCur: 0, drillResult: null, drill: null,
    c: { grab: null }, cam: null, mark: { z: 0, x: 0 }, predict: null, cheer: false, sky: 0, lastMode: 'cup',
  };
  // a short buzz on contact where the device offers one (Android); silently nothing elsewhere
  const buzz = (pat) => { try { if (typeof navigator !== 'undefined' && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(pat); } catch { /* none */ } };
  const simRng = rng.fork();
  let evSeen = 0, stepSound = 0, lastSize = '';

  // ---- persistence --------------------------------------------------------------------------------------------------------
  const saveAll = () => { storage.set('settings', G.settings); storage.set('progress', G.progress); storage.set('setup', G.setup); };
  Promise.all([storage.get('settings', null), storage.get('progress', null), storage.get('setup', null)]).then(([s, p, su]) => {
    if (s) Object.assign(G.settings, s);
    if (p) {
      if (Array.isArray(p.stars)) G.progress.stars = ROUNDS.map((_, i) => clamp(p.stars[i] | 0, 0, 3));
      G.progress.best = p.best | 0; G.progress.drills = p.drills && typeof p.drills === 'object' ? p.drills : {};
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
    hoof: (q) => tone({ freq: 95 + q * 8, to: 55, dur: 0.07, type: 'triangle', vol: 0.1 }),
    whoosh: () => tone({ freq: 900, to: 160, dur: 0.26, type: 'sawtooth', vol: 0.03 }),
    knock: () => { tone({ freq: 240, to: 90, dur: 0.1, type: 'triangle', vol: 0.22 }); tone({ freq: 1500, to: 400, dur: 0.05, type: 'square', vol: 0.03 }); },
    lift: (n) => [0, 4, 7, 12].slice(0, n).forEach((k, i) => tone({ freq: 523 * Math.pow(2, k / 12), dur: 0.22 + i * 0.04, type: 'triangle', vol: 0.09 })),
    miss: () => tone({ freq: 200, to: 110, dur: 0.16, type: 'sine', vol: 0.07 }),
    cheer: () => [0, 7, 12, 16].forEach((k, i) => tone({ freq: 330 * Math.pow(2, k / 12), dur: 0.28, type: 'sawtooth', vol: 0.025 + i * 0.002 })),
    go: () => tone({ freq: 440, to: 660, dur: 0.12, type: 'triangle', vol: 0.08 }),
  };

  // ---- rounds and runs ----------------------------------------------------------------------------------------------------
  const delayed = [];
  const later = (f, t = 0.3) => delayed.push({ t, f });
  const blankRound = (idx) => ({ idx, runIdx: 0, mine: [], rivalRuns: [], rivalAll: [], total: 0, rivalTotal: 0, rivalSoFar: 0, lifts: 0, strikes: 0, misses: 0, perfects: 0, streak: 0, bestStreak: 0, over: false });
  const cfgFor = () => {
    const R = G.round, m = G.mode, st = G.setup;
    if (m === 'cup' || m === 'watch') { const r = ROUNDS[R.idx]; return { sway: r.sway, off: r.off, tol: r.tol, sky: r.sky, minPace: r.minPace }; }
    if (m === 'challenge') return challengeLevel(R.runIdx);
    if (m === 'drill') { const l = LESSONS[G.learnCur].cfg; return { sway: l.sway, off: l.off, tol: l.tol, sky: G.learnCur, minPace: 0 }; }
    return { sway: 0.3 * SWAYS[st.sway].k, off: 0.35, tol: 1.1, sky: 1, minPace: 0 };
  };
  const newRun = () => {
    const R = G.round;
    G.cfg = cfgFor();
    G.sky = G.cfg.sky;
    G.pace = Math.max(G.pace, G.cfg.minPace | 0);
    G.run = createRun({ ...G.cfg, pace: G.pace, streak: R.streak }, simRng.fork());
    evSeen = 0; stepSound = 0;
    G.think = null; G.hinted = false; G.hintMsg = ''; G.c.grab = null; G.rivalNow = null; G.cheer = false;
    G.watch.phase = 'ready'; G.watch.timer = 0; G.watch.lines = [];
    G.watch.ai = makeAi(ROUNDS[Math.min(ROUNDS.length - 1, R.idx)].skill, simRng.fork());
  };
  function startRound(mode, opts = {}) {
    const st = G.setup;
    const idx = opts.idx ?? (mode === 'cup' || mode === 'watch' ? st.round : 0);
    if (demo && mode === 'cup' && idx > 1) { G.setupMsg = 'The web demo has the first two rounds.'; return; }
    if (demo && mode === 'challenge' && G.progress.demoRuns >= DEMO_RUN_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; MN.invalidateLayout(); return; }
    G.mode = mode; G.lastMode = mode;
    G.round = blankRound(idx);
    if (mode === 'cup' || mode === 'watch') {
      G.round.rivalAll = rivalRuns(ROUNDS[idx].skill, RUNS_PER_ROUND, simRng.fork());
      G.pace = Math.max(ROUNDS[idx].minPace, st.pace);
    } else if (mode === 'practice') G.pace = st.pace;
    if (mode === 'drill') { const l = LESSONS[G.learnCur]; G.pace = l.cfg.pace; G.drill = { id: l.id, title: l.title, goal: l.goal, got: 0, need: l.need, runs: l.runs }; } else G.drill = null;
    G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.ui.scroll = 0; G.resultInfo = null; G.watch.paused = false;
    newRun(); MN.invalidateLayout();
  }

  // The outcome if the finger were lifted right now (drives the guide colour)
  const predictOutcome = (s, run) => {
    const tt = s.t + DROP, zc = run.zAt(tt) + REACH, v = run.vAt(tt);
    const dt = Math.abs((zc - s.pegZ) / Math.max(1, v)), dx = Math.abs(run.swayAt(tt) + s.aim - s.pegX);
    if (dt <= s.liftT && dx <= s.liftX) return 'lift';
    if (dt <= s.strikeT && dx <= s.strikeX) return 'strike';
    return null;
  };
  const cmWord = (m) => `${Math.max(1, Math.round(Math.abs(m) * 100))} cm`;
  const planLines = (s, run, forWatch) => {
    const ahead = Math.max(0, s.pegZ - s.z), need = s.pegX - (run.swayAt(s.t + DROP) + s.aim);
    const tLeft = Math.max(0, (s.pegZ - REACH - run.zAt(s.t + DROP)) / Math.max(1, s.v));
    const lines = [`The peg stands about ${Math.round(ahead)} metres ahead, ${Math.abs(s.pegX) < 0.06 ? 'right on the lane line' : `${cmWord(s.pegX)} to the ${s.pegX < 0 ? 'left' : 'right'} of the lane line`}.`];
    lines.push(Math.abs(need) < 0.06 ? 'The lance already points at it.' : `The lance point is ${cmWord(need)} ${need > 0 ? 'to the left' : 'to the right'} of it: slide ${need > 0 ? 'right' : 'left'}${forWatch ? '' : ' by about that much'}. The horse rocks, so keep nudging.`);
    lines.push(`The lance needs ${DROP.toFixed(1)} seconds to come down. The ring already counts that: ${forWatch ? 'the rider lets go' : 'let go'} when the ring touches the peg, about ${tLeft.toFixed(1)} seconds from now.`);
    return lines;
  };

  // ---- run end --------------------------------------------------------------------------------------------------------
  function finishRun() {
    const R = G.round, s = G.run.s;
    if (R.over) return;
    const perfect = s.perfect && !G.hinted;
    const pts = s.perfect && G.hinted ? s.points - PTS.perfect : s.points;
    const bonus = s.outcome === 'lift' ? Math.min(PTS.streakMax, R.streak) : 0;
    G.lastPoints = pts; G.lastStreakBonus = bonus;
    R.mine.push({ outcome: s.outcome || 'miss', points: pts, perfect });
    R.total += pts;
    if (s.outcome === 'lift') { R.lifts++; R.streak++; R.bestStreak = Math.max(R.bestStreak, R.streak); if (perfect) R.perfects++; }
    else { R.streak = 0; if (s.outcome === 'strike') R.strikes++; else R.misses++; }
    const rv = R.rivalAll[R.runIdx] || null;
    if (rv) { R.rivalRuns.push(rv); R.rivalSoFar += rv.points; R.rivalTotal = R.rivalSoFar; G.rivalNow = rv; }
    R.runIdx++;
    if (G.mode === 'challenge' && demo) { G.progress.demoRuns++; saveAll(); }
    let over = false;
    if (G.mode === 'cup' || G.mode === 'watch') over = R.runIdx >= RUNS_PER_ROUND;
    else if (G.mode === 'challenge') over = R.misses >= CHALLENGE_LIVES || (demo && G.progress.demoRuns >= DEMO_RUN_CAP);
    else if (G.mode === 'drill') {
      const d = G.drill, l = LESSONS[G.learnCur];
      d.got = l.need2 === 'points' ? R.total : l.need2 === 'lift' ? R.lifts : R.lifts + R.strikes;
      over = R.runIdx >= l.runs || d.got >= d.need;
    }
    if (over) endRound(); else later(() => { if (G.scene === 'play' && G.round && !G.round.over) newRun(); }, 0.01);
  }

  function endRound() {
    const R = G.round; R.over = true;
    const info = { stars: 0, newStar: false, canNext: false, newBest: false };
    if (G.mode === 'cup' || G.mode === 'watch') {
      const win = R.total > R.rivalTotal;
      if (G.mode === 'cup') {
        info.stars = win ? 1 + (R.total >= STARS_AT[1] ? 1 : 0) + (R.total >= STARS_AT[2] ? 1 : 0) : 0;
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
    sfx.cheer();
  }

  // ---- events -> sound and flow -------------------------------------------------------------------------------------------
  function processEvents() {
    const s = G.run.s;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (e.type === 'contact' && G.settings.sound && G.scene === 'play') buzz(e.outcome === 'lift' ? [18, 40, 28] : e.outcome === 'strike' ? [24] : [10]);
      if (e.type === 'start') sfx.go();
      else if (e.type === 'release') sfx.whoosh();
      else if (e.type === 'contact') {
        if (e.outcome === 'lift') { sfx.knock(); sfx.lift(s.perfect ? 4 : 3); G.cheer = true; }
        else if (e.outcome === 'strike') { sfx.knock(); G.cheer = true; }
        else sfx.miss();
      } else if (e.type === 'end' && G.mode !== 'shot') finishRun();
    }
    const q = Math.floor(s.stride * 3);
    if (s.phase !== 'ready' && !s.over && q !== stepSound) { stepSound = q; sfx.hoof(q % 2); }
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
    else if (id === 'settings') go('settings');
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
    else if (id === 'set-replay') st.replay = st.replay === false;
    else if (id === 'txt-dec') setText(st.textIdx - 1);
    else if (id === 'txt-inc') setText(st.textIdx + 1);
    else if (id === 'guide-dec') st.guide = Math.max(0, st.guide - 1);
    else if (id === 'guide-inc') st.guide = Math.min(2, st.guide + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (G.restoreBusy || env.monetization.owns('unlock_game')) return;
      G.restoreBusy = true; G.restoreMsg = 'Checking with the store...'; MN.invalidateLayout();
      env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Full game restored. Thank you!' : 'No earlier purchase was found for this account.'; }).catch(() => { G.restoreMsg = 'Could not reach the store. Please try again.'; }).then(() => { G.restoreBusy = false; MN.invalidateLayout(); });
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

  // ---- the lane -----------------------------------------------------------------------------------------------------------
  function openPause() { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.c.grab = null; MN.invalidateLayout(); }
  function openThink() {
    const run = G.run, s = run.s;
    if (s.phase !== 'ride') return;
    G.think = { lines: planLines(s, run, false) };
    G.hinted = true; G.c.grab = null;
  }
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
      wt.timer += dt;
      if (wt.timer >= 0.9) { run.start(Math.max(wt.ai.paceWant, G.cfg.minPace | 0)); G.pace = s.pace; wt.phase = 'ride'; processEvents(); }
      return;
    }
    if (wt.phase === 'ride' && thinkDue(s)) {
      wt.phase = 'think'; wt.timer = THINK_STEPS[G.settings.thinkIdx]; wt.lines = planLines(s, run, true); s.held = true;
    }
    if (wt.phase === 'think') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'reveal'; wt.timer = 2; } return; }
    if (wt.phase === 'reveal') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'act'; wt.lines = []; } return; }
    const ctl = wt.phase === 'act' || s.phase !== 'ride' ? aiControl(run, wt.ai) : { aim: 0, release: false };
    run.update(dt, ctl || {});
    processEvents();
  }
  const shotControl = (run) => {
    const s = run.s;
    if (s.phase === 'ready') { run.start(2); return null; }
    if (!G.shotAi) G.shotAi = makeAi(0.9, simRng.fork());
    return aiControl(run, G.shotAi);
  };
  function updatePlay(dt, input) {
    const L = playLayout(G.settings.textIdx);
    const run = G.run, s = run.s, ptr = input.pointer, keys = input.keys;
    if (G.mode === 'shot') { if (G.devFreeze) return; run.update(dt, shotControl(run)); processEvents(); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    if (G.mode === 'watch') { updateWatch(dt, input, L); return; }
    if (G.think) {
      if ((ptr.pressed && G.thinkRects && inRect(G.thinkRects.close, ptr.x, ptr.y)) || keys.pressed.has('Enter') || keys.pressed.has('Escape') || keys.pressed.has('KeyT')) { G.think = null; sfx.tick(); }
      return;
    }
    if (s.over) return;
    if (ptr.pressed && inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { openPause(); return; }
    if (s.phase === 'ready') {
      let pace = -1;
      if (ptr.pressed) L.chips.forEach((r, k) => { if (inRect(r, ptr.x, ptr.y)) pace = k; });
      if (keys.pressed.has('Digit1')) pace = 0;
      if (keys.pressed.has('Digit2')) pace = 1;
      if (keys.pressed.has('Digit3')) pace = 2;
      if (keys.pressed.has('Space') || keys.pressed.has('Enter')) pace = G.pace;
      if (pace >= 0 && pace >= (G.cfg.minPace | 0)) { G.pace = pace; G.setup.pace = pace; G.hintMsg = ''; run.start(pace); G.c.grab = null; saveAll(); processEvents(); }
      else if (pace >= 0) G.hintMsg = `This round needs ${PACES[G.cfg.minPace].name} or faster.`;
      return;
    }
    if (s.phase === 'ride' && ptr.pressed && inRect(L.think, ptr.x, ptr.y)) { openThink(); return; }
    if (s.phase === 'ride' && keys.pressed.has('KeyT')) { openThink(); return; }
    let aim = null, release = false;
    if (s.phase === 'ride') {
      if (ptr.pressed) G.c.grab = { x0: ptr.x, aim0: s.aimT };
      if (G.c.grab && ptr.down) aim = G.c.grab.aim0 + (ptr.x - G.c.grab.x0) / PX_PER_M;
      if (G.c.grab && ptr.released) { release = true; G.c.grab = null; }
      const kx = (keys.down.has('ArrowRight') || keys.down.has('KeyD') ? 1 : 0) - (keys.down.has('ArrowLeft') || keys.down.has('KeyA') ? 1 : 0);
      if (kx) aim = clamp(s.aimT + kx * KEY_AIM * dt, -AIM_MAX, AIM_MAX);
      if (keys.pressed.has('Space')) release = true;
    }
    run.update(dt, { aim, release });
    processEvents();
  }

  // what the picture needs this frame
  G.sceneState = (run) => {
    const s = run ? run.s : null;
    let mark = { z: 0, x: 0 }, predict = null;
    if (run && (s.phase === 'ride' || s.phase === 'ready')) { mark = run.mark(); predict = s.phase === 'ride' ? predictOutcome(s, run) : null; }
    G.mark = mark; G.predict = predict;
    const reveal = G.mode === 'watch' && G.watch.phase === 'reveal';
    const guide = G.drill || reveal ? 0 : G.settings.guide;
    return { run: s, time: G.t, sky: G.sky, guide, mark, predict, pegZ: s ? s.pegZ : 0, pegX: s ? s.pegX : 0, cheer: G.cheer, replay: G.settings.replay !== false };
  };
  G.sceneBack = (ctx) => {
    const c = makeCam(live.w, live.h);
    drawScene(ctx, c, { run: null, time: G.t, sky: G.menuSky ?? 3, guide: 2, mark: { z: 0, x: 0 }, predict: null, pegZ: 56, pegX: 0.1, cheer: false, cam: 'hero', ...MN.heroTarget() });
  };

  if (config.shot) {
    G.mode = 'shot'; G.round = blankRound(1); G.round.runIdx = 2; G.round.total = 9; G.round.rivalSoFar = 6; G.round.mine = [{ outcome: 'lift' }, { outcome: 'strike' }]; G.round.rivalRuns = [{ outcome: 'strike' }, { outcome: 'miss' }];
    G.sky = (Number(config.shotSeed) || 0) % 5;
    G.cfg = { sway: 0.25, off: 0.3, tol: 1, sky: G.sky, minPace: 0 };
    G.run = createRun({ ...G.cfg, pace: 2, streak: 0 }, simRng.fork());
    G.scene = 'play';
    if (config.dev) G.devFreeze = true;
  }
  if (config.dev) {
    G.devApi = {
      step(n = 1) { for (let i = 0; i < n; i++) { G.run.update(1 / 60, shotControl(G.run)); processEvents(); } },
      freeze(v = true) { G.devFreeze = v; },
      untilPegIn(d) { for (let i = 0; i < 4000 && G.run.s.pegZ - G.run.s.z > d; i++) G.run.update(1 / 60, shotControl(G.run)); },
      untilEvent(type, extra = 0) { for (let i = 0; i < 4000; i++) { G.run.update(1 / 60, shotControl(G.run)); if (G.run.s.events.some((e) => e.type === type)) { for (let k = 0; k < extra; k++) G.run.update(1 / 60, shotControl(G.run)); break; } } },
    };
  }

  const api = {
    // Menus, Rules, About, settings, Learn, Watch & Learn, practice, pause, hints and waiting at the line are free; only real riding in the Cup or
    // the Challenge counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && (G.mode === 'cup' || G.mode === 'challenge') && G.run && (G.run.s.phase === 'ride' || G.run.s.phase === 'drop')) || G.paused || G.pauseMenu || !!G.think,
    update(dt, input) {
      syncSize(meta.width, meta.height);
      const own = !!env.monetization.owns('unlock_game');
      if (own !== G.owned) { G.owned = own; MN.invalidateLayout(); }
      const sk = sizeKey();
      if (sk !== lastSize) { if (lastSize) { G.c.grab = null; G.ui.drag = null; MN.invalidateLayout(); } lastSize = sk; }
      meta.previewBadge = { x: live.w / 2, y: G.scene === 'play' ? playLayout(G.settings.textIdx).top + 10 : live.h - 70, align: 'center' };
      setPress(input.pointer);
      G.t += dt;
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
          renderHud(ctx, G, !!config.iconShot);
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        default: break;
      }
    },
    getState: () => G,
  };
  if (config.dev) {
    // fast-forward with an idle input (Watch & Learn plays itself), for screenshots and checks
    const idle = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } });
    G.devApi.tick = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, idle()); };
  }
  return api;
}
