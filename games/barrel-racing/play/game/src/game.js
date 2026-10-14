// Barrel Racing: the game shell. Scenes, input (one thumb), persistence, preview wiring, the Rodeo Cup, Time Trial, Practice, Learn drills,
// Watch & Learn and the Think hint. One run lives in sim.js (pure, fixed 60 Hz); the picture lives in scene.js and hud.js and only reads the
// state exposed here.
import { createRun, rivalRuns, makeAi, aiControl, thinkDue, idealFor, planLine, chainFor, SIDE_NAME } from './sim.js';
import { live, syncSize, sizeKey, TEXT_SCALES, refLayout, setupPins, inRect, playLayout } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import * as MN from './menus.js';
import { renderHud, watchRects, fmtT } from './hud.js';
import { drawScene, makeCam } from './scene.js';
import {
  ROUNDS, HORSES, GROUNDS, LESSONS, RUNS_PER_ROUND, CHALLENGE_LIVES, STAR_GOLD, STAR_PLAT, THINK_STEPS, challengeCourse, HINT_COST, KNOCK_S,
} from './consts.js';

// Fluid viewport (kit 1.7): the short side is 720 units, the long side follows the screen. The kit keeps meta.width / meta.height live.
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEMO_RUN_CAP = 6;
const SLIDE = 100;            // finger travel (virtual units) for full steering or full braking
const KEY_RATE = 5;           // how fast the keys move the steering

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false, dev: !!config.dev, t: 0,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, guide: 0 },
    setup: { mode: 'cup', round: 0, horse: 1, ground: 0 },
    progress: { stars: [0, 0, 0, 0, 0], best: 0, drills: {}, demoRuns: 0, rounds: 0 },
    ui: { scroll: 0, drag: null }, back: 'title', setupMsg: '', restoreMsg: '',
    round: null, run: null, cfg: { sp: 1, grip: 14, look: 1 }, horse: 1, par: 0, ideal: null, ghostRun: null,
    paused: false, pauseMenu: false, think: null, thinkRects: null, hinted: false, hintMsg: '', planPts: null,
    watch: { phase: 'ready', timer: 0, paused: false, lines: [], ai: null },
    resultInfo: null, learnCur: 0, drillResult: null, drill: null,
    c: { grab: null }, cam: null, lastMode: 'cup', keySteer: 0,
  };
  G.owned = () => !!(env.monetization && env.monetization.owns && env.monetization.owns('unlock_game'));
  if (env.monetization && env.monetization.onChange) env.monetization.onChange(() => MN.invalidateLayout());
  const simRng = rng.fork();
  let evSeen = 0, lastSize = '';
  // the idle rider behind the menus
  const bg = { run: null, ai: null, ideal: null };

  // ---- persistence --------------------------------------------------------------------------------------------------------
  const saveAll = () => { storage.set('settings', G.settings); storage.set('progress', G.progress); storage.set('setup', G.setup); };
  Promise.all([storage.get('settings', null), storage.get('progress', null), storage.get('setup', null)]).then(([s, p, su]) => {
    if (s) Object.assign(G.settings, s);
    if (p) {
      if (Array.isArray(p.stars)) G.progress.stars = ROUNDS.map((_, i) => clamp(p.stars[i] | 0, 0, 3));
      G.progress.best = p.best | 0; G.progress.drills = p.drills && typeof p.drills === 'object' ? p.drills : {};
      G.progress.demoRuns = p.demoRuns | 0; G.progress.rounds = p.rounds | 0;
    }
    if (su) { G.setup.mode = ['cup', 'challenge', 'practice', 'watch'].includes(su.mode) ? su.mode : 'cup'; G.setup.round = clamp(su.round | 0, 0, ROUNDS.length - 1); G.setup.horse = clamp(su.horse ?? 1, 0, 2); G.setup.ground = clamp(su.ground ?? 0, 0, 2); }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.settings.guide = clamp(G.settings.guide | 0, 0, 2);
    G.horse = G.setup.horse;
    G.loaded = true; MN.invalidateLayout(); audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound --------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    hoof: (q) => tone({ freq: 90 + q * 10, to: 52, dur: 0.06, type: 'triangle', vol: 0.09 }),
    knock: () => { tone({ freq: 200, to: 70, dur: 0.16, type: 'triangle', vol: 0.24 }); tone({ freq: 1200, to: 300, dur: 0.07, type: 'square', vol: 0.04 }); },
    burst: () => tone({ freq: 300, to: 900, dur: 0.35, type: 'sawtooth', vol: 0.05 }),
    barrel: () => [0, 7].forEach((k, i) => tone({ freq: 523 * Math.pow(2, k / 12), dur: 0.14 + i * 0.05, type: 'triangle', vol: 0.08 })),
    finish: (n) => [0, 4, 7, 12].slice(0, n).forEach((k, i) => tone({ freq: 523 * Math.pow(2, k / 12), dur: 0.22 + i * 0.04, type: 'triangle', vol: 0.09 })),
    cheer: () => [0, 7, 12, 16].forEach((k, i) => tone({ freq: 330 * Math.pow(2, k / 12), dur: 0.28, type: 'sawtooth', vol: 0.025 + i * 0.002 })),
    go: () => tone({ freq: 440, to: 660, dur: 0.12, type: 'triangle', vol: 0.08 }),
    fence: () => tone({ freq: 130, to: 80, dur: 0.1, type: 'square', vol: 0.05 }),
  };

  // ---- rounds and runs ----------------------------------------------------------------------------------------------------
  const delayed = [];
  const later = (f, t = 0.3) => delayed.push({ t, f });
  const blankRound = (idx) => ({ idx, runIdx: 0, mine: [], rivalRuns: [], rivalAll: [], total: 0, rivalTotal: 0, rivalSoFar: 0, clean: 0, knocks: 0, bestRun: 999, strikes: 0, score: 0, over: false });
  const cfgFor = () => {
    const R = G.round, m = G.mode, st = G.setup;
    if (m === 'cup' || m === 'watch') { const r = ROUNDS[R.idx]; return { sp: r.sp, grip: r.grip, look: r.look }; }
    if (m === 'challenge') return challengeCourse(R.runIdx);
    if (m === 'drill') return { ...LESSONS[G.learnCur].cfg };
    return { sp: 1.0, grip: 14.5 * [1, 0.9, 0.8][st.ground], look: st.ground === 0 ? 1 : st.ground === 1 ? 2 : 3 };
  };
  const newRun = () => {
    const R = G.round;
    G.cfg = cfgFor();
    const horse = G.mode === 'watch' ? 1 : G.horse;
    G.run = createRun({ ...G.cfg, horse });
    G.ideal = idealFor({ ...G.cfg, horse });
    G.par = G.mode === 'challenge' ? Math.round(G.ideal.time * challengeCourse(R.runIdx).parMul * 10) / 10 : 0;
    G.ghostRun = null;
    if (G.mode === 'cup' || G.mode === 'watch') {
      const gi = idealFor({ ...G.cfg, horse: 1 });
      const rv = R.rivalAll[R.runIdx];
      if (rv && gi.path.length > 6) G.ghostRun = { path: gi.path, ratio: gi.raw / Math.max(1, rv.time) };
    }
    evSeen = 0;
    G.think = null; G.hinted = false; G.hintMsg = ''; G.c.grab = null; G.planPts = null; G.keySteer = 0;
    G.watch.phase = 'ready'; G.watch.timer = 0; G.watch.lines = [];
    G.watch.ai = makeAi({ rr: G.ideal.rr, first: 0 });
  };
  function startRound(mode, opts = {}) {
    const st = G.setup;
    const idx = opts.idx ?? (mode === 'cup' || mode === 'watch' ? st.round : 0);
    if (demo && mode === 'cup' && idx > 1) { G.setupMsg = 'The web demo has the first two rounds.'; return; }
    if (demo && mode === 'challenge' && G.progress.demoRuns >= DEMO_RUN_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; MN.invalidateLayout(); return; }
    G.mode = mode; G.lastMode = mode;
    G.round = blankRound(idx);
    if (mode === 'cup' || mode === 'watch') {
      const r = ROUNDS[idx], gi = idealFor({ sp: r.sp, grip: r.grip, look: r.look, horse: 1 });
      G.round.rivalAll = rivalRuns(r.skill, RUNS_PER_ROUND, gi.time, simRng.fork());
      G.round.ideal = gi.time;
    }
    if (mode === 'cup' || mode === 'practice' || mode === 'challenge') G.horse = st.horse;
    if (mode === 'drill') { const l = LESSONS[G.learnCur]; G.drill = { id: l.id, title: l.title, goal: l.goal, got: 0, need: l.need, runs: l.runs }; } else G.drill = null;
    G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.ui.scroll = 0; G.resultInfo = null; G.watch.paused = false;
    newRun(); MN.invalidateLayout();
  }

  // ---- the hint: what to do next, in words, plus a gold line on the ground -------------------------------------------------
  const firstPref = (s) => (s.first >= 0 ? s.first : s.x >= 0 ? 0 : 1);
  function planFor(forWatch) {
    const run = G.run, s = run.s, rr = G.ideal ? G.ideal.rr : 3;
    const first = forWatch ? G.watch.ai.first : firstPref(s);
    const chain = chainFor(s, first);
    const who = forWatch ? 'the rider' : 'you';
    const pts = planLine({ x: s.x, y: s.y, th: s.th }, chain, rr);
    const lines = [];
    if (!chain.length) {
      const d = Math.max(0, s.y);
      lines.push(`All three barrels are turned. Now run straight for the line, about ${Math.round(d)} metres away.`);
      lines.push(s.burstUsed ? 'The burst is already used, so just keep the speed.' : `The burst is still unused and this straight is the best place for it${forWatch ? ': the rider uses it now' : ''}.`);
      lines.push('The clock stops when the horse crosses the line.');
    } else {
      const t = chain[0], d = Math.hypot(t.c.x - s.x, t.c.y - s.y), turn = t.dir > 0 ? 'right' : 'left';
      const vArc = Math.sqrt(s.grip * rr);
      lines.push(`Barrel ${s.stage + 1} of 3: the ${SIDE_NAME[t.i]} barrel, about ${Math.round(d)} metres ahead. ${who === 'you' ? 'Turn' : 'The rider turns'} ${turn} around it${s.stage === 0 ? ' (either near barrel may come first)' : ''}.`);
      lines.push(`The horse is doing ${s.v.toFixed(1)} metres a second. A turn about ${rr.toFixed(1)} metres from the barrel can be ridden at ${vArc.toFixed(1)} metres a second${s.v > vArc * 1.05 ? `, so ${who === 'you' ? 'slow down' : 'the rider slows down'} before the turn${who === 'you' ? ' by sliding down' : ''}` : ': the speed is about right'}.`);
      lines.push(s.stage < 2 ? 'Leave the turn pointing at the next barrel, then let the horse run. The gold line is the plan.' : 'Leave the turn pointing at the line and let the horse run home. The gold line is the plan.');
    }
    return { lines, pts };
  }

  // ---- run end --------------------------------------------------------------------------------------------------------
  function finishRun() {
    const R = G.round, s = G.run.s;
    if (R.over) return;
    R.mine.push({ net: s.net, time: s.time, knocked: s.knocked, dnf: s.dnf, hinted: s.hinted });
    R.total += s.net;
    if (s.knocked === 0 && !s.dnf) R.clean++;
    R.knocks += s.knocked;
    R.bestRun = Math.min(R.bestRun, s.net);
    const rv = R.rivalAll[R.runIdx] || null;
    if (rv) { R.rivalRuns.push(rv); R.rivalSoFar += rv.net; R.rivalTotal = R.rivalSoFar; }
    R.runIdx++;
    if (G.mode === 'challenge') {
      if (demo) { G.progress.demoRuns++; saveAll(); }
      if (s.net <= G.par && !s.dnf) R.score += 20 + Math.round(Math.max(0, G.par - s.net) * 10); else R.strikes++;
    }
    let over = false;
    if (G.mode === 'cup' || G.mode === 'watch') over = R.runIdx >= RUNS_PER_ROUND;
    else if (G.mode === 'challenge') over = R.strikes >= CHALLENGE_LIVES || (demo && G.progress.demoRuns >= DEMO_RUN_CAP);
    else if (G.mode === 'drill') {
      const d = G.drill, l = LESSONS[G.learnCur];
      let ok = false;
      if (l.mode === 'clean') ok = s.knocked === 0 && !s.dnf;
      else if (l.mode === 'par') ok = !s.dnf && s.net <= G.ideal.time * l.parMul;
      else if (l.mode === 'burstHome') ok = !s.dnf && s.burstHome;
      if (ok) d.got++;
      over = R.runIdx >= l.runs || d.got >= d.need;
    }
    if (over) endRound(); else later(() => { if (G.scene === 'play' && G.round && !G.round.over) newRun(); }, 0.01);
  }

  function endRound() {
    const R = G.round; R.over = true;
    const info = { stars: 0, newStar: false, canNext: false, newBest: false, gold: 0, plat: 0 };
    if (G.mode === 'cup' || G.mode === 'watch') {
      const win = R.total < R.rivalTotal;
      info.gold = (R.ideal || 0) * RUNS_PER_ROUND * STAR_GOLD; info.plat = (R.ideal || 0) * RUNS_PER_ROUND * STAR_PLAT;
      if (G.mode === 'cup') {
        info.stars = win ? 1 + (R.total <= info.gold ? 1 : 0) + (R.total <= info.plat ? 1 : 0) : 0;
        if (info.stars > G.progress.stars[R.idx]) { G.progress.stars[R.idx] = info.stars; info.newStar = true; }
        info.canNext = win && R.idx < ROUNDS.length - 1 && !(demo && R.idx + 1 > 1);
        G.progress.rounds++;
      }
    } else if (G.mode === 'challenge') {
      if (R.score > G.progress.best) { G.progress.best = R.score; info.newBest = true; }
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
      if (e.type === 'start') sfx.go();
      else if (e.type === 'burst') sfx.burst();
      else if (e.type === 'knock') sfx.knock();
      else if (e.type === 'barrel') sfx.barrel();
      else if (e.type === 'fence') sfx.fence();
      else if (e.type === 'finish') sfx.finish(s.knocked ? 2 : 4);
      else if (e.type === 'end' && G.mode !== 'shot') finishRun();
    }
    const q = Math.floor(s.stride * 2);
    if (s.phase !== 'ready' && !s.over && q !== (G._stepSound | 0)) { G._stepSound = q; sfx.hoof(q % 2); }
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
    else if (id.startsWith('horse')) { st.horse = +id.slice(5); MN.invalidateLayout(); saveAll(); }
    else if (id.startsWith('ground')) { st.ground = +id.slice(6); MN.invalidateLayout(); saveAll(); }
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
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; MN.invalidateLayout(); }).catch(() => { G.restoreMsg = 'Could not reach the store.'; MN.invalidateLayout(); }); }
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
      if (m === 'challenge' && R.score > G.progress.best) { G.progress.best = R.score; info.newBest = true; }
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
  // the 3D rider's licences (vendor3d/LICENSES.md) are shown on the About page when the file is there
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter((x) => x && !/fetch\(|keep it as is|LICENSES\.md/.test(x));
      if (paras.length) { aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }]; MN.invalidateLayout(); }
    }).catch(() => {});
  }
  const refList = () => (G.scene === 'howto' ? [HOWTO, 'How to Play'] : G.scene === 'about' ? [aboutList, 'About'] : [RULES, 'Rules']);
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

  // ---- the arena ----------------------------------------------------------------------------------------------------------
  function openPause() { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.c.grab = null; MN.invalidateLayout(); }
  function openThink() {
    const run = G.run, s = run.s;
    if (s.phase !== 'ride' || s.finished) return;
    const p = planFor(false);
    G.think = { lines: [...p.lines, `Using the hint adds ${HINT_COST} second to this run.`] };
    G.planPts = p.pts;
    if (!s.hinted) { s.hinted = true; s.hintCost = HINT_COST; }
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
      if (wt.timer >= 0.9) { run.start(); wt.phase = 'ride'; processEvents(); }
      return;
    }
    if (wt.phase === 'ride' && thinkDue(s, wt.ai)) {
      const p = planFor(true);
      wt.phase = 'think'; wt.timer = THINK_STEPS[G.settings.thinkIdx]; wt.lines = p.lines; G.planPts = p.pts; s.held = true; s.annStage = s.stage;
    }
    if (wt.phase === 'think') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'reveal'; wt.timer = 2; } return; }
    if (wt.phase === 'reveal') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'act'; wt.lines = []; G.planPts = null; s.held = false; } return; }
    run.update(dt, aiControl(run, wt.ai));
    processEvents();
  }
  const shotControl = (run) => {
    const s = run.s;
    if (s.phase === 'ready') { run.start(); return null; }
    if (!G.shotAi) G.shotAi = makeAi({ rr: G.ideal ? G.ideal.rr : 2.6, first: 0 });
    return aiControl(run, G.shotAi);
  };
  // One pointer steers: the thumb slides left/right to steer and down to brake from a floating anchor. Burst is reachable while steering in two
  // separate ways: a quick flick UP with the same thumb, or a tap on the Burst button with a second finger / the mouse (the steering is held
  // while that tap lands, and kept for a moment if the first finger is still moving afterwards).
  function playerControl(input, L, dt) {
    const s = G.run.s, ptr = input.pointer, keys = input.keys;
    let steer = null, brake = null, burst = false;
    const rawB = inRect(L.burst, ptr.x, ptr.y);
    let inB = rawB, gr = G.c.grab;
    // sliding the steering thumb across the Burst button is still steering; only a jump onto it (a second finger) or a fresh press is a Burst tap
    if (gr && !ptr.pressed) {
      if (!rawB) gr.tapB = false;
      else if (!gr.tapB && Math.hypot(ptr.x - gr.lx, ptr.y - gr.ly) > 90) gr.tapB = true;
      if (rawB && !gr.tapB) inB = false;
    }
    if (ptr.pressed) {
      if (inB) { if (!s.burstUsed) burst = true; }
      else { G.c.grab = gr = { ax: ptr.x, ay: ptr.y, steer: 0, brake: 0, up: 0, py: ptr.y, lx: ptr.x, ly: ptr.y, ghost: 0, tapB: false }; }
    }
    if (ptr.down && !ptr.pressed && !gr && !inB && !ptr.released) { G.c.grab = gr = { ax: ptr.x, ay: ptr.y, steer: 0, brake: 0, up: 0, py: ptr.y, lx: ptr.x, ly: ptr.y, ghost: 0, tapB: false }; }
    if (ptr.down && inB && !gr) burst = !s.burstUsed;
    if (gr && ptr.down && inB && !ptr.pressed) { burst = !s.burstUsed; steer = gr.steer; brake = gr.brake; }
    else if (gr && (ptr.down || gr.ghost > 0) && !inB) {
      let dx = ptr.x - gr.ax, dy = ptr.y - gr.ay;
      const vy = ptr.y - gr.py; gr.py = ptr.y;
      if (!ptr.down) { if (vy === 0 && ptr.x === gr.px) gr.ghost -= dt; else gr.ghost = 1.2; }
      gr.px = ptr.x;
      gr.up = Math.max(0, gr.up * 0.85 - vy);
      if (gr.up > SLIDE * 0.5 && dy < -SLIDE * 0.1) { if (!s.burstUsed) burst = true; gr.up = 0; }
      if (dx > SLIDE * 1.3) { gr.ax = ptr.x - SLIDE * 1.3; dx = SLIDE * 1.3; } else if (dx < -SLIDE * 1.3) { gr.ax = ptr.x + SLIDE * 1.3; dx = -SLIDE * 1.3; }
      if (dy < -SLIDE * 0.3) { gr.ay = ptr.y + SLIDE * 0.3; dy = -SLIDE * 0.3; }
      if (dy > SLIDE * 1.3) { gr.ay = ptr.y - SLIDE * 1.3; dy = SLIDE * 1.3; }
      gr.steer = clamp(dx / SLIDE, -1, 1); gr.brake = clamp(dy / SLIDE, 0, 1);
      steer = gr.steer; brake = gr.brake;
      if (gr.ghost <= 0 && !ptr.down) { G.c.grab = null; steer = 0; brake = 0; }
    }
    else if (gr && !ptr.down && inB && gr.ghost > 0) { gr.ghost -= dt; steer = gr.steer; brake = gr.brake; if (gr.ghost <= 0) { G.c.grab = null; steer = 0; brake = 0; } }
    if (gr && ptr.released && G.c.grab === gr) {
      if (inB && gr.ghost <= 0) { gr.ghost = 1.2; gr.px = ptr.x; steer = gr.steer; brake = gr.brake; }
      else if (!inB) { G.c.grab = null; steer = 0; brake = 0; }
    }
    if (G.c.grab) { G.c.grab.lx = ptr.x; G.c.grab.ly = ptr.y; }
    const kx = (keys.down.has('ArrowRight') || keys.down.has('KeyD') ? 1 : 0) - (keys.down.has('ArrowLeft') || keys.down.has('KeyA') ? 1 : 0);
    const kb = keys.down.has('ArrowDown') || keys.down.has('KeyS');
    if (kx || kb || G.keySteer) {
      G.keySteer += (kx - G.keySteer) * Math.min(1, dt * KEY_RATE);
      if (Math.abs(G.keySteer) < 0.01 && !kx) G.keySteer = 0;
      if (steer == null) steer = G.keySteer;
      if (brake == null) brake = kb ? 1 : 0;
    }
    if (keys.pressed.has('KeyB')) burst = true;
    return { steer, brake, burst };
  }
  function updatePlay(dt, input) {
    const L = playLayout(G.settings.textIdx);
    const run = G.run, s = run.s, ptr = input.pointer, keys = input.keys;
    if (G.mode === 'shot') { if (G.devFreeze) return; run.update(dt, shotControl(run)); processEvents(); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    if (G.mode === 'watch') { updateWatch(dt, input, L); return; }
    if (G.think) {
      if ((ptr.pressed && G.thinkRects && inRect(G.thinkRects.close, ptr.x, ptr.y)) || keys.pressed.has('Enter') || keys.pressed.has('Escape') || keys.pressed.has('KeyT')) { G.think = null; G.planPts = null; sfx.tick(); }
      return;
    }
    if (s.over) return;
    if (ptr.pressed && inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { openPause(); return; }
    if (s.phase === 'ready') {
      let h = -1;
      if (ptr.pressed) L.chips.forEach((r, k) => { if (inRect(r, ptr.x, ptr.y)) h = k; });
      if (keys.pressed.has('Digit1')) h = 0;
      if (keys.pressed.has('Digit2')) h = 1;
      if (keys.pressed.has('Digit3')) h = 2;
      if (keys.pressed.has('Space') || keys.pressed.has('Enter')) h = G.horse;
      if (h >= 0) {
        if (h !== G.horse) { G.horse = h; G.setup.horse = h; const cfg = G.cfg; G.run = createRun({ ...cfg, horse: h }); G.ideal = idealFor({ ...cfg, horse: h }); if (G.mode === 'challenge') G.par = Math.round(G.ideal.time * challengeCourse(G.round.runIdx).parMul * 10) / 10; G.watch.ai = makeAi({ rr: G.ideal.rr, first: 0 }); evSeen = 0; }
        G.hintMsg = ''; G.run.start(); G.c.grab = null; saveAll(); processEvents();
      }
      return;
    }
    if (s.phase === 'ride' && !s.finished && ptr.pressed && inRect(L.think, ptr.x, ptr.y)) { openThink(); return; }
    if (s.phase === 'ride' && !s.finished && keys.pressed.has('KeyT')) { openThink(); return; }
    let ctl = {};
    if (s.phase === 'ride' && !s.finished) ctl = playerControl(input, L, dt);
    else G.c.grab = null;
    run.update(dt, ctl);
    processEvents();
  }

  // the idle rider behind the menus
  function updateBackdrop(dt) {
    if (!bg.run || bg.run.s.over) {
      const cfg = { sp: 1.0, grip: 14, look: 1, horse: 1 };
      bg.ideal = idealFor(cfg); bg.run = createRun(cfg); bg.ai = makeAi({ rr: bg.ideal.rr * 1.15, first: 0 }); bg.run.start();
    }
    bg.run.update(dt, aiControl(bg.run, bg.ai));
  }

  // the 3D camera closes in on the rider while riding (a phone shows the whole arena only about 10 px per metre) and opens out at the line
  // and behind the menus; it is eased every tick and only read by the pictures
  const FOLLOW_ZOOM = 3.0;
  G.focus = { x: 0, y: 21, zoom: 1, elev: 58 };
  const focusTarget = () => {
    const s = G.scene === 'play' && G.run ? G.run.s : null;
    const wide = live.land ? 55 : 58;
    if (!s || s.phase !== 'ride' || s.finished) return { x: 0, y: 21, zoom: 1, elev: wide };
    const lead = Math.min(1, s.v / 12) * 6.5;
    // while riding the camera also drops a little so the horse and rider read as a side-on figure, not a top-down blob
    return { x: s.x + Math.sin(s.th) * lead, y: s.y + Math.cos(s.th) * lead, zoom: G.devZoom || FOLLOW_ZOOM, elev: G.devElev || (live.land ? 26 : 28), free: !!G.devZoom };
  };
  const stepFocus = (dt) => {
    const t = focusTarget(), k = 1 - Math.exp(-dt * 3.2), f = G.focus;
    f.x += (t.x - f.x) * k; f.y += (t.y - f.y) * k; f.zoom += (t.zoom - f.zoom) * (1 - Math.exp(-dt * 2.2)); f.elev += (t.elev - f.elev) * (1 - Math.exp(-dt * 2.2));
  };
  G.focusFor = () => (G.mode === 'shot' ? focusTarget() : G.focus);
  // is the 3D presenter (WebGL canvas behind this one) drawing the arena right now?
  G.gl = () => !!(config.gl3d && config.gl3d());
  G.v3 = null;
  // what the picture needs this frame
  G.sceneState = (run) => {
    const s = run ? run.s : null;
    const reveal = G.mode === 'watch' && (G.watch.phase === 'reveal' || G.watch.phase === 'think');
    const guide = G.drill ? 0 : G.settings.guide;
    let ghost = null;
    if (G.ghostRun && s && s.phase === 'ride' && !s.finished) {
      const gp = G.ghostRun.path, n = gp.length / 3, f = s.t * G.ghostRun.ratio / 0.05, i = Math.floor(f);
      if (i < n - 1) {
        const a = i * 3, b = a + 3, k = f - i;
        ghost = { x: gp[a] + (gp[b] - gp[a]) * k, y: gp[a + 1] + (gp[b + 1] - gp[a + 1]) * k, th: gp[a + 2] + (gp[b + 2] - gp[a + 2]) * k, stride: s.t * 3.4, yaw: 0, v: Math.hypot(gp[b] - gp[a], gp[b + 1] - gp[a + 1]) / 0.05 * G.ghostRun.ratio };
      }
    }
    return { run: s, time: G.t, look: G.cfg.look, guide: reveal ? 0 : guide, ideal: G.ideal ? G.ideal.path : null, mirror: !!(s && s.first === 1), ghost, plan: G.planPts };
  };
  G.sceneBack = (ctx) => {
    const gl = G.gl();
    const c = makeCam(live.w, live.h, { x: 0, y: 0, w: live.w, h: live.h }, live.land, gl);
    if (!(gl && G.scene === 'title' && G.heroRect)) drawScene(ctx, c, { run: bg.run ? bg.run.s : null, time: G.t, look: 1, guide: 2, ideal: null, mirror: false, ghost: null, plan: null, barrels: bg.run ? null : [] });
    // the title shows the hero scene (the rider and her horse at dusk) in the window the menu leaves clear; other menus keep the idling lane
    G.v3 = gl ? (G.scene === 'title' && G.heroRect ? { hero: G.heroRect, W: live.w, H: live.h, look: 3, horse: G.horse, t: G.t } : { rig: c.rig, run: bg.run ? bg.run.s : null, barrels: bg.run ? null : [], ghost: null, look: 1, horse: 1 }) : null;
  };

  if (config.shot) {
    G.mode = 'shot'; G.round = blankRound(1); G.round.runIdx = 1; G.round.total = 31.4; G.round.rivalSoFar = 33.2; G.round.mine = [{ net: 31.4, knocked: 0 }]; G.round.rivalRuns = [{ net: 33.2 }];
    const look = (Number(config.shotSeed) || 0) % 5;
    G.cfg = { sp: 1.0, grip: 14, look };
    G.horse = 1;
    G.run = createRun({ ...G.cfg, horse: 1 });
    G.ideal = idealFor({ ...G.cfg, horse: 1 });
    G.scene = 'play';
    if (config.dev) G.devFreeze = true;
  }
  if (config.dev) {
    G.devApi = {
      step(n = 1) { for (let i = 0; i < n; i++) { G.run.update(1 / 60, shotControl(G.run)); processEvents(); } },
      freeze(v = true) { G.devFreeze = v; },
      zoom(z, elev) { G.devZoom = z; G.devElev = elev; },
      startRound(m, o) { startRound(m, o); },
      start() { G.run.start(); },
      scene(s, back) { G.scene = s; if (back) G.back = back; G.ui.scroll = 0; MN.invalidateLayout(); },
      textIdx(i) { setText(i); },
      hint() { openThink(); },
      pause() { openPause(); },
      untilStage(st) { for (let i = 0; i < 6000 && G.run.s.stage < st; i++) G.run.update(1 / 60, shotControl(G.run)); },
      untilEvent(type, extra = 0) { for (let i = 0; i < 6000; i++) { G.run.update(1 / 60, shotControl(G.run)); if (G.run.s.events.some((e) => e.type === type)) { for (let k = 0; k < extra; k++) G.run.update(1 / 60, shotControl(G.run)); break; } } },
    };
  }

  const api = {
    // Menus, Rules, About, settings, Learn, Watch & Learn, practice, pause, hints and waiting at the line are free; only real riding in the Cup or
    // the Time Trial counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && (G.mode === 'cup' || G.mode === 'challenge') && G.run && G.run.s.phase === 'ride' && !G.run.s.finished) || G.paused || G.pauseMenu || !!G.think,
    update(dt, input) {
      syncSize(meta.width, meta.height);
      const sk = sizeKey();
      if (sk !== lastSize) { if (lastSize) { G.c.grab = null; G.ui.drag = null; MN.invalidateLayout(); } lastSize = sk; }
      const PL = G.scene === 'play' ? playLayout(G.settings.textIdx) : null;
      meta.previewBadge = { x: PL && PL.sideHud ? PL.clock.x + PL.clock.w / 2 : live.w / 2, y: PL ? PL.top + 10 : live.h - 70, align: 'center' };
      setPress(input.pointer);
      G.t += dt;
      stepFocus(dt);
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { const f = delayed[i].f; delayed.splice(i, 1); f(); } }
      if (G.scene !== 'play') updateBackdrop(dt);
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
      G.v3 = null;
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
    // fast-forward with an idle input (Watch & Learn plays itself), for screenshots and checks
    const idle = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } });
    G.devApi.tick = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, idle()); };
  }
  return api;
}
