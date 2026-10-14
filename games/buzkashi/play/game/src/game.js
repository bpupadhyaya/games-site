// Buzkashi: the game shell. Scenes, input (a finger to ride, three buttons), persistence, preview wiring, the Winter Cup, the Gauntlet, Practice,
// Learn drills, Watch & Learn and the Think hint. One match lives in sim.js (pure, fixed 60 Hz); the picture lives in scene.js and hud.js and
// only reads the state exposed here.
import { createMatch, describe } from './sim.js';
import { live, syncSize, sizeKey, TEXT_SCALES, refLayout, setupPins, inRect, playLayout } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import * as MN from './menus.js';
import { renderHud } from './hud.js';
import { drawScene, makeCam, focusFor, stepFocus } from './scene.js';
import {
  ROUNDS, GROUNDS, LESSONS, THINK_STEPS, GAUNTLET_TIME, gauntletRivals, gauntletSkill,
} from './consts.js';

// Fluid viewport (kit 1.7): the short side is 720 units, the long side follows the screen. The kit keeps meta.width / meta.height live.
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEMO_CARRY_CAP = 6;
const PRACTICE_TIME = 180;

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false, dev: !!config.dev, t: 0,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, guide: 0 },
    setup: { mode: 'cup', round: 0, horse: 1, ground: 0, rivals: 2, level: 1 },
    progress: { stars: [0, 0, 0, 0, 0], best: 0, drills: {}, demoRuns: 0, rounds: 0 },
    ui: { scroll: 0, drag: null }, back: 'title', setupMsg: '', restoreMsg: '', owned: false,
    round: null, run: null, cfg: null, drill: null, drillResult: null, learnCur: 0, resultInfo: null,
    paused: false, pauseMenu: false, think: null, thinkRects: null, planPts: null, target: null, banner: null,
    watch: { phase: 'ready', timer: 0, paused: false, lines: [], lastKind: '', since: 99 },
    c: { roles: {}, held: {}, touch: null, keyTurn: 0 }, cam: null, focus: { x: 0, y: 0 }, lastMode: 'cup',
  };
  const simRng = rng.fork();
  let evSeen = 0, lastSize = '';
  const bg = { run: null, focus: { x: 0, y: 0 } };

  // ---- persistence --------------------------------------------------------------------------------------------------------
  const saveAll = () => { storage.set('settings', G.settings); storage.set('progress', G.progress); storage.set('setup', G.setup); };
  Promise.all([storage.get('settings', null), storage.get('progress', null), storage.get('setup', null)]).then(([s, p, su]) => {
    if (s) Object.assign(G.settings, s);
    if (p) {
      if (Array.isArray(p.stars)) G.progress.stars = ROUNDS.map((_, i) => clamp(p.stars[i] | 0, 0, 3));
      G.progress.best = p.best | 0; G.progress.drills = p.drills && typeof p.drills === 'object' ? p.drills : {};
      G.progress.demoRuns = p.demoRuns | 0; G.progress.rounds = p.rounds | 0;
    }
    if (su) {
      G.setup.mode = ['cup', 'challenge', 'practice', 'watch'].includes(su.mode) ? su.mode : 'cup';
      G.setup.round = clamp(su.round | 0, 0, ROUNDS.length - 1); G.setup.horse = clamp(su.horse ?? 1, 0, 2); G.setup.ground = clamp(su.ground ?? 0, 0, 2);
      G.setup.rivals = clamp(su.rivals ?? 2, 0, 3); G.setup.level = clamp(su.level ?? 1, 0, 2);
    }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.settings.guide = clamp(G.settings.guide | 0, 0, 2);
    G.loaded = true; MN.invalidateLayout(); audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound --------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    hoof: (q) => tone({ freq: 84 + q * 12, to: 50, dur: 0.05, type: 'triangle', vol: 0.05 }),
    scoop: () => { tone({ freq: 220, to: 420, dur: 0.12, type: 'triangle', vol: 0.12 }); tone({ freq: 90, to: 60, dur: 0.1, type: 'square', vol: 0.05 }); },
    fumble: () => tone({ freq: 320, to: 120, dur: 0.2, type: 'sawtooth', vol: 0.06 }),
    tug: () => tone({ freq: 150, to: 110, dur: 0.1, type: 'square', vol: 0.06 }),
    strip: () => tone({ freq: 480, to: 160, dur: 0.15, type: 'sawtooth', vol: 0.08 }),
    bump: () => tone({ freq: 110, to: 60, dur: 0.1, type: 'triangle', vol: 0.12 }),
    flag: () => [0, 7].forEach((k, i) => tone({ freq: 587 * Math.pow(2, k / 12), dur: 0.14 + i * 0.05, type: 'triangle', vol: 0.08 })),
    score: (mine) => [0, 4, 7, 12].forEach((k, i) => tone({ freq: (mine ? 523 : 392) * Math.pow(2, (mine ? k : -k * 0.5) / 12), dur: 0.2 + i * 0.04, type: 'triangle', vol: 0.09 })),
    cheer: () => [0, 7, 12, 16].forEach((k, i) => tone({ freq: 330 * Math.pow(2, k / 12), dur: 0.28, type: 'sawtooth', vol: 0.025 + i * 0.002 })),
    whistle: () => tone({ freq: 1500, to: 1900, dur: 0.18, type: 'sine', vol: 0.05 }),
  };

  // ---- rounds and matches -------------------------------------------------------------------------------------------------
  const delayed = [];
  const later = (f, t = 0.3) => delayed.push({ t, f });
  const banner = (text, o = {}) => { G.banner = { text, t: o.t || 1.3, max: o.t || 1.3, color: o.color, sub: o.sub, size: o.size }; };
  const cfgFor = (mode, idx) => {
    const st = G.setup;
    if (mode === 'cup' || mode === 'watch') { const r = ROUNDS[idx]; return { size: r.size, rivals: r.size, skill: r.skill, look: r.look, time: r.time, horse: st.horse, mateSkill: 0.4 + 0.5 * r.skill, ground: 1, coach: mode === 'watch' }; }
    if (mode === 'challenge') return { size: 1, gauntlet: true, rivals: gauntletRivals(0), skill: gauntletSkill(0), look: 2, time: GAUNTLET_TIME, horse: st.horse, ground: 1 };
    if (mode === 'drill') { const l = LESSONS[G.learnCur]; return { ...l.cfg, time: l.time, horse: 1, ground: 1, mateSkill: 0.5 }; }
    return { size: st.rivals >= 2 ? 2 : 1, rivals: st.rivals, skill: [0.25, 0.5, 0.8][st.level], look: [1, 0, 3][st.ground], time: PRACTICE_TIME, horse: st.horse, ground: GROUNDS[st.ground].k, mateSkill: 0.5 };
  };
  function newMatch(mode, idx) {
    const cfg = cfgFor(mode, idx);
    G.cfg = cfg;
    G.run = createMatch(cfg, simRng.fork());
    evSeen = 0; G.think = null; G.planPts = null; G.target = null; G.banner = null; G.c.roles = {}; G.c.held = {}; G.c.touch = null; G.c.keyTurn = 0;
    G.focus = { ...focusFor(G.run.s) };
    G.watch.phase = 'ready'; G.watch.timer = 0; G.watch.lines = []; G.watch.lastKind = ''; G.watch.since = 99;
    G.round = { idx, over: false };
    return G.run;
  }
  function startRound(mode, opts = {}) {
    const st = G.setup;
    const idx = opts.idx ?? (mode === 'cup' || mode === 'watch' ? st.round : 0);
    if (demo && mode === 'cup' && idx > 1) { G.setupMsg = 'The web demo has the first two rounds.'; return; }
    if (demo && mode === 'challenge' && G.progress.demoRuns >= DEMO_CARRY_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; MN.invalidateLayout(); return; }
    G.mode = mode; G.lastMode = mode;
    if (mode === 'drill') { const l = LESSONS[G.learnCur]; G.drill = { id: l.id, title: l.title, goal: l.goal, got: 0, need: l.need }; } else G.drill = null;
    newMatch(mode, idx);
    G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.ui.scroll = 0; G.resultInfo = null; G.watch.paused = false;
    MN.invalidateLayout();
  }

  // ---- end of a match -----------------------------------------------------------------------------------------------------
  function endMatch() {
    const R = G.round, s = G.run.s;
    if (!R || R.over) return;
    R.over = true; s.over = true; s.phase = 'over';
    const sc = s.score;
    const info = { score: [sc[0], sc[1]], stars: 0, newStar: false, canNext: false, newBest: false, mine: s.mineCarries || 0, strips: s.riders[0].strips, hinted: s.hinted, points: 0 };
    if (G.mode === 'cup' || G.mode === 'watch') {
      const win = sc[0] > sc[1];
      if (G.mode === 'cup') {
        info.stars = win ? 1 + (sc[0] - sc[1] >= 2 ? 1 : 0) + (sc[0] - sc[1] >= 3 && !s.hinted ? 1 : 0) : 0;
        if (info.stars > G.progress.stars[R.idx]) { G.progress.stars[R.idx] = info.stars; info.newStar = true; }
        info.canNext = win && R.idx < ROUNDS.length - 1 && !(demo && R.idx + 1 > 1);
        G.progress.rounds++;
      }
    } else if (G.mode === 'challenge') {
      info.points = sc[0] * 100 + (sc[1] >= 3 ? Math.round(Math.max(0, s.clock)) : 0);
      if (info.points > G.progress.best) { G.progress.best = info.points; info.newBest = true; }
    }
    G.resultInfo = info;
    if (G.mode === 'drill') {
      const l = LESSONS[G.learnCur], got = l.mode === 'scoop' ? G.drill.got : sc[0];
      const pass = got >= l.need;
      if (pass) G.progress.drills[l.id] = true;
      G.drillResult = { pass, got };
      later(() => { if (G.round && G.round.over) { G.scene = 'lessonresult'; G.ui.scroll = 0; MN.invalidateLayout(); } }, 1.2);
    } else later(() => { if (G.round && G.round.over && G.scene === 'play') { G.scene = 'result'; G.ui.scroll = 0; MN.invalidateLayout(); } }, 1.5);
    saveAll();
    sfx.cheer();
    banner(sc[0] === sc[1] ? 'DRAW' : 'FULL TIME', { t: 1.5, sub: `${sc[0]} - ${sc[1]}` });
  }

  // ---- events -> sound, banners and flow ----------------------------------------------------------------------------------
  function processEvents() {
    const s = G.run.s;
    for (const e of s.events) {
      if (e.n < evSeen) continue;
      evSeen = e.n + 1;
      if (e.type === 'start') { sfx.whistle(); banner('GO!', { t: 0.9 }); }
      else if (e.type === 'scoop') {
        sfx.scoop();
        if (e.id === 0 && G.mode === 'drill' && G.drill && LESSONS[G.learnCur].mode === 'scoop') { G.drill.got++; if (G.drill.got >= G.drill.need) endMatch(); }
      } else if (e.type === 'steal') { sfx.strip(); banner(e.id === 0 ? 'Stripped it!' : s.riders[e.id].team === 1 ? 'They took it' : 'Team mate has it', { t: 1.0, color: e.id === 0 ? '#9ef0c0' : s.riders[e.id].team === 1 ? '#ff9a8a' : '#cfe6ff', size: 72 }); }
      else if (e.type === 'stripped') { if (e.id === 0) banner('Stripped!', { t: 1.0, color: '#ff9a8a', size: 80 }); }
      else if (e.type === 'loose') sfx.strip();
      else if (e.type === 'fumble') { sfx.fumble(); if (e.id === 0) banner('Fumbled: too fast', { t: 1.0, color: '#ffb48a', size: 70 }); }
      else if (e.type === 'tug') sfx.tug();
      else if (e.type === 'bump') sfx.bump();
      else if (e.type === 'flag') { sfx.flag(); if (s.riders[e.id].team === 0) banner('Post rounded', { t: 1.1, color: '#9ef0c0', sub: 'Now into the circle', size: 80 }); }
      else if (e.type === 'nocount') banner('Round the post first', { t: 1.2, color: '#ffd0a0', size: 64 });
      else if (e.type === 'score') {
        sfx.score(e.team === 0);
        if (e.team === 0 && e.id === 0) s.mineCarries = (s.mineCarries || 0) + 1;
        if (G.mode === 'challenge' && e.team === 0 && demo) { G.progress.demoRuns++; saveAll(); }
        banner(e.team === 0 ? 'CARRY!' : 'Rival carry', { t: 1.5, color: e.team === 0 ? '#ffd45a' : '#ff9a8a', sub: `${s.score[0]} - ${s.score[1]}` });
        if (G.mode === 'challenge' && demo && G.progress.demoRuns >= DEMO_CARRY_CAP) endMatch();
        if (G.mode === 'drill' && LESSONS[G.learnCur].mode === 'carry' && s.score[0] >= LESSONS[G.learnCur].need) endMatch();
      } else if (e.type === 'overtime') { sfx.whistle(); banner('SUDDEN DEATH', { t: 1.6, color: '#ffb48a', sub: 'First carry wins', size: 82 }); }
      else if (e.type === 'join') banner('Another rival', { t: 0.9, color: '#ff9a8a', size: 64 });
      else if (e.type === 'end') endMatch();
    }
    const q = Math.floor(s.riders[0].stride * 2);
    if (s.phase === 'play' && q !== (G._step | 0)) { G._step = q; if (s.riders[0].v > 3) sfx.hoof(q % 2); }
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
    else if (id.startsWith('riv')) { st.rivals = +id.slice(3); MN.invalidateLayout(); saveAll(); }
    else if (id.startsWith('lvl')) { st.level = +id.slice(3); MN.invalidateLayout(); saveAll(); }
    else if (id === 'start') {
      const open = st.round === 0 || G.progress.stars[st.round - 1] > 0 || st.mode === 'watch' || G.dev;
      if (st.mode === 'cup' && !open) { G.setupMsg = 'Win the round before it first.'; return; }
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
    else if (id === 'restore') { if (G.restoreMsg === 'Checking...') return; G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; MN.invalidateLayout(); }).catch(() => { G.restoreMsg = 'Could not reach the store.'; MN.invalidateLayout(); }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveAll(); MN.invalidateLayout();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    const m = G.lastMode === 'drill' ? G.setup.mode : G.lastMode;
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
    const m = G.mode, R = G.round, s = G.run && G.run.s;
    G.paused = false; G.pauseMenu = false; G.think = null; G.watch.paused = false;
    if (R) R.over = true;
    if ((m === 'practice' || m === 'challenge') && s && s.score[0] + s.score[1] > 0) {
      const info = { score: [s.score[0], s.score[1]], newBest: false, points: s.score[0] * 100 };
      if (m === 'challenge' && info.points > G.progress.best) { G.progress.best = info.points; info.newBest = true; }
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
  const camNow = (L) => makeCam(live.w, live.h, L.arena, L.land, G.focus);
  function openPause() { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.c.roles = {}; G.c.held = {}; G.c.touch = null; MN.invalidateLayout(); }
  function openThink() {
    const m = G.run, s = m.s;
    if (s.phase !== 'play' || s.over) return;
    const d = describe(m, s.riders[0]);
    G.think = { lines: [...d.lines, 'Using the hint means this chukka cannot earn a third star.'] };
    G.planPts = d.pts; G.target = d.pts.length > 1 ? d.pts[d.pts.length - 1] : null;
    if (!s.hinted) { s.hinted = true; s.hintCount = 1; }
    G.c.roles = {}; G.c.held = {}; G.c.touch = null;
  }
  // the fingers: the kit's one pointer, or every finger when main.js hands them over (two thumbs: ride + a button)
  function fingers(input) {
    if (env.touches) {
      const t = env.touches();
      return t && t.length ? t.map((f) => ({ id: f.id, x: f.x, y: f.y, down: f.down && !f.up, fresh: !!f.fresh, up: !!f.up })) : [];
    }
    const p = input.pointer;
    if (!p.down && !p.pressed && !p.released) return [];
    return [{ id: 'p', x: p.x, y: p.y, down: p.down, fresh: p.pressed, up: p.released }];
  }
  function playerControl(input, L, dt) {
    const s = G.run.s, keys = input.keys, cam = camNow(L);
    const ctl = {};
    let steered = false, grab = false;
    const held = { shield: false, sprint: false };
    for (const f of fingers(input)) {
      let role = G.c.roles[f.id];
      if (f.fresh && !role) {
        if (inRect(L.grab, f.x, f.y)) role = 'grab';
        else if (inRect(L.shield, f.x, f.y)) role = 'shield';
        else if (inRect(L.spur, f.x, f.y)) role = 'sprint';
        else if (inRect(L.pause, f.x, f.y) || inRect(L.think, f.x, f.y)) role = 'top';
        else if (f.y >= L.arena.y - 4 && f.y <= L.arena.y + L.arena.h + 4 && f.x >= L.arena.x && f.x <= L.arena.x + L.arena.w) role = 'steer';
        if (role) G.c.roles[f.id] = role;
        if (role === 'grab') grab = true;
        if (role === 'top') {
          delete G.c.roles[f.id];
          if (inRect(L.pause, f.x, f.y)) { openPause(); return null; }
          if (s.phase === 'play') { openThink(); return null; }
        }
      }
      if (f.up || !f.down) { if (f.up) delete G.c.roles[f.id]; continue; }
      if (role === 'shield') held.shield = true;
      else if (role === 'sprint') held.sprint = true;
      else if (role === 'steer') {
        const w = cam.world(f.x, f.y);
        ctl.tx = clamp(w.x, -15.5, 15.5); ctl.ty = clamp(w.y, -26.5, 26.5); steered = true; G.c.touch = { x: ctl.tx, y: ctl.ty };
      }
    }
    if (!steered) G.c.touch = null;
    // keyboard: arrows steer relative to the rider, Space grabs, S shields, B spurs
    const land = cam.land ? -1 : 1;
    const kx = (keys.down.has('ArrowLeft') || keys.down.has('KeyA') ? 1 : 0) - (keys.down.has('ArrowRight') || keys.down.has('KeyD') ? 1 : 0);
    const ku = keys.down.has('ArrowUp') || keys.down.has('KeyW'), kd = keys.down.has('ArrowDown');
    if (!steered && (kx || ku || kd || G.c.keyTurn)) {
      G.c.keyTurn += (kx * land - G.c.keyTurn) * Math.min(1, dt * 8);
      if (Math.abs(G.c.keyTurn) < 0.01 && !kx) G.c.keyTurn = 0;
      ctl.turn = G.c.keyTurn; ctl.go = kd ? 0.15 : ku ? 1 : 0.6;
    }
    if (keys.pressed.has('Space') || keys.pressed.has('Enter') || keys.pressed.has('KeyG')) grab = true;
    if (keys.down.has('KeyS') || keys.down.has('ShiftLeft') || keys.down.has('ShiftRight')) held.shield = true;
    if (keys.down.has('KeyB') || keys.down.has('KeyX')) held.sprint = true;
    G.c.held = held;
    ctl.shield = held.shield; ctl.sprint = held.sprint; ctl.grab = grab;
    return ctl;
  }
  function updateWatchControls(input, L) {
    const wt = G.watch, ptr = input.pointer, st = G.settings;
    if (ptr.pressed) {
      const rects = L.watchBtns;
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
    const wt = G.watch, m = G.run, s = m.s;
    if (wt.paused || s.over) return;
    if (s.phase === 'ready') {
      wt.timer += dt;
      if (wt.timer >= 1.2) { m.start(); wt.phase = 'act'; processEvents(); }
      return;
    }
    if (wt.phase === 'think') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'reveal'; wt.timer = 2; } return; }
    if (wt.phase === 'reveal') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'act'; wt.lines = []; G.planPts = null; G.target = null; s.held = false; wt.since = 0; } return; }
    wt.since += dt;
    // a new plan (the sack is loose, I have it, I lost it...): stop, think, reveal, then act
    const d = describe(m, s.riders[0]);
    if (d.kind !== wt.lastKind && wt.since > 3.5 && d.kind !== 'wait') {
      wt.lastKind = d.kind; wt.phase = 'think'; wt.timer = THINK_STEPS[G.settings.thinkIdx]; wt.lines = d.lines; G.planPts = d.pts;
      G.target = d.pts.length > 1 ? d.pts[d.pts.length - 1] : null; s.held = true;
      return;
    }
    m.update(dt, null);
    processEvents();
  }
  function updatePlay(dt, input) {
    const L = playLayout(G.settings.textIdx);
    const m = G.run, s = m.s, keys = input.keys;
    if (G.devHold) return;
    if (G.mode === 'shot') { if (G.devFreeze) return; m.update(dt, null); processEvents(); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    if (G.mode === 'watch') { updateWatch(dt, input, L); stepFocus(G.focus, focusFor(s), dt); return; }
    if (G.think) {
      const ptr = input.pointer;
      if ((ptr.pressed && G.thinkRects && inRect(G.thinkRects.close, ptr.x, ptr.y)) || keys.pressed.has('Enter') || keys.pressed.has('Escape') || keys.pressed.has('KeyT')) { G.think = null; G.planPts = null; G.target = null; sfx.tick(); }
      return;
    }
    if (s.over) return;
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { openPause(); return; }
    if (s.phase === 'ready') {
      let start = keys.pressed.has('Space') || keys.pressed.has('Enter') || keys.pressed.has('ArrowUp');
      for (const f of fingers(input)) {
        if (!f.fresh) continue;
        if (inRect(L.pause, f.x, f.y)) { openPause(); return; }
        start = true;
      }
      if (start) { m.start(); G.c.roles = {}; processEvents(); }
      return;
    }
    if (keys.pressed.has('KeyT')) { openThink(); return; }
    const ctl = playerControl(input, L, dt);
    if (ctl === null) return;
    m.update(dt, ctl);
    processEvents();
    stepFocus(G.focus, focusFor(s), dt);
  }

  // the idle match behind the menus
  function updateBackdrop(dt) {
    if (!bg.run || bg.run.s.over) {
      bg.run = createMatch({ size: 3, rivals: 3, skill: 0.5, mateSkill: 0.5, coach: true, time: 120, look: 1 }, simRng.fork());
      bg.run.start(); bg.focus = { ...focusFor(bg.run.s) };
    }
    bg.run.update(dt, null);
    stepFocus(bg.focus, focusFor(bg.run.s), dt * 0.7);
  }

  // what the picture needs this frame
  G.sceneState = (m) => {
    const s = m ? m.s : null;
    const reveal = G.mode === 'watch' && (G.watch.phase === 'reveal' || G.watch.phase === 'think');
    const frozen = G.paused || G.pauseMenu || !!G.think || (G.mode === 'watch' && (G.watch.paused || G.watch.phase === 'think' || G.watch.phase === 'reveal'));
    return { run: s, time: G.t, look: G.cfg ? G.cfg.look : 1, guide: reveal ? 0 : G.drill ? 0 : G.settings.guide, plan: G.planPts, target: G.target, touch: G.c.touch, frozen };
  };
  G.sceneBack = (ctx) => {
    const c = makeCam(live.w, live.h, live.land ? { x: 0, y: 0, w: live.w, h: live.h } : { x: 0, y: -live.h * 0.24, w: live.w, h: live.h }, live.land, bg.focus, { across: live.land ? 15 : 17, elev: live.land ? 24 : 30, vfov: 40, aimY: 1.1, phiOff: Math.sin(G.t * 0.12) * 0.3 });
    drawScene(ctx, c, { run: bg.run ? bg.run.s : null, time: G.t, look: 1, guide: 2, plan: null, target: null, touch: null, showMine: false });
  };

  if (config.shot) {
    G.mode = 'shot'; G.round = { idx: 1, over: false };
    const seed = Number(config.shotSeed) || 1;
    G.cfg = { size: 3, rivals: 3, skill: 0.55, mateSkill: 0.55, coach: true, time: 150, look: [1, 2, 3, 4, 0][(seed - 1) % 5], horse: 1, ground: 1 };
    G.run = createMatch(G.cfg, simRng.fork());
    G.run.start();
    const n = [420, 1500, 2700, 3900, 5200][(seed - 1) % 5] + (Number(config.shotTicks) || 0);
    for (let i = 0; i < n && !G.run.s.over; i++) G.run.update(1 / 60, null);
    G.run.s.events.length = 0;
    G.focus = { ...focusFor(G.run.s) };
    G.scene = 'play'; G.settings.guide = 1;
    if (config.dev) G.devFreeze = true;
  }
  if (config.dev) {
    G.devApi = {
      step(n = 1) { for (let i = 0; i < n; i++) { G.run.update(1 / 60, null); processEvents(); } G.focus = G.devFocus ? { ...G.devFocus } : { ...focusFor(G.run.s) }; },
      hold(v = true) { G.devHold = v; },
      focus(x, y) { G.devFocus = x == null ? null : { x, y }; if (G.devFocus) G.focus = { ...G.devFocus }; },
      look(i) { if (G.cfg) G.cfg.look = i; },
      riderFocus(i) { const r = G.run.s.riders[i]; G.devFocus = null; G.focus = { x: r.x, y: r.y }; G.devFocus = { x: r.x, y: r.y }; },
      freeze(v = true) { G.devFreeze = v; },
      startRound(mo, o) { startRound(mo, o); },
      start() { G.run.start(); },
      scene(sc, back) { G.scene = sc; if (back) G.back = back; G.ui.scroll = 0; MN.invalidateLayout(); },
      textIdx(i) { setText(i); },
      hint() { openThink(); },
      pause() { openPause(); },
      untilEvent(type, extra = 0) {
        for (let i = 0; i < 20000; i++) { G.run.update(1 / 60, null); if (G.run.s.events.some((e) => e.type === type)) { for (let k = 0; k < extra; k++) G.run.update(1 / 60, null); break; } }
        G.focus = { ...focusFor(G.run.s) };
      },
    };
  }

  const api = {
    // Menus, Rules, About, settings, Learn, Watch & Learn, practice, pause, hints and waiting at the start are free; only real play in the Cup or
    // the Gauntlet counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && (G.mode === 'cup' || G.mode === 'challenge') && G.run && G.run.s.phase === 'play' && !G.run.s.over) || G.paused || G.pauseMenu || !!G.think,
    update(dt, input) {
      syncSize(meta.width, meta.height);
      const sk = sizeKey();
      if (sk !== lastSize) { if (lastSize) { G.c.roles = {}; G.c.held = {}; G.ui.drag = null; MN.invalidateLayout(); } lastSize = sk; }
      meta.previewBadge = { x: live.w / 2, y: G.scene === 'play' ? playLayout(G.settings.textIdx).top + 8 : live.h - 70, align: 'center' };
      setPress(input.pointer);
      const own = !!(env.monetization && env.monetization.owns('unlock_game'));
      if (own !== G.owned) { G.owned = own; MN.invalidateLayout(); }
      G.t += dt;
      if (G.banner && G.banner.t > 0) G.banner.t -= dt;
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { const f = delayed[i].f; delayed.splice(i, 1); f(); } }
      if (G.scene !== 'play') { updateBackdrop(dt); if (env.touches) env.touches(); }
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
