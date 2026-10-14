// Square Dance Caller: the game shell. Scenes, input (tap / keys), persistence, preview wiring, Tips, Endless Evening, Practice, Learn lessons,
// Watch & Learn and the Think hint. The engine (calls, shortest way home, scrambles, dancer paths) lives in sim.js; the picture in scene.js and hud.js.
import { apply, isHome, homeCount, bestCall, levelSquare, marathonSquare, customSquare, distOf, wayHome } from './sim.js';
import { live, syncSize, sizeKey, TEXT_SCALES, refLayout, setupPins, inRect, playLayout } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES, explainCall } from './content.js';
import { aboutList } from './credits.js';
import * as MN from './menus.js';
import { renderHud, watchRects, veil } from './hud.js';
import { drawRoom, drawFloor } from './scene.js';
import {
  CALL_BY_ID, SWING, TIPS, LEVELS, LESSONS, PACES, PACE_MUL, BEATS, SLACK_TIP, SLACK_ONE, HINT_COST, THINK_STEPS, DEMO_LEVELS, DEMO_MARATHON_CAP,
  MARATHON_LIVES, COUPLES,
} from './consts.js';
import { slotPos } from './sim.js';

// Fluid viewport (kit 1.7): the short side is 720 units, the long side follows the screen. The kit keeps meta.width / meta.height live.
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const POOL = ['cl4', 'hlc', 'c1s', 'srl', 'gr2', 'hpt', 'gs4', 'slc'];
const DEPTHS = [2, 4, 6, 8];
const CARD_N = [4, 6, 8];

// short original reels (D major). 16 eighth notes per phrase of eight beats; indices into DEG, -1 = rest
const DEG = [293.66, 329.63, 369.99, 392.0, 440.0, 493.88, 554.37, 587.33, 659.25, 739.99, 783.99, 880.0, 987.77, 1108.73];
const TUNES = [
  [7, 8, 9, 7, 9, 8, 7, 5, 6, 7, 6, 4, 5, 4, 3, -1],
  [4, 5, 7, 5, 4, 2, 4, 5, 7, 9, 8, 7, 5, 7, 5, 4],
  [9, 8, 7, 9, 10, 9, 8, 7, 5, 7, 9, 7, 8, 7, 5, 7],
];
const SING = [392.0, 440.0, 493.88, 587.33, 659.25];

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false, dev: !!config.dev, t: 0,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, pace: 1, guide: 0, oneTap: 0 },
    setup: { mode: 'tips', level: 0, card: 1, depth: 1 },
    progress: { stars: new Array(LEVELS.length).fill(0), best: 0, drills: {}, demoSquares: 0, squares: 0, evenings: 0, played: 0 },
    ui: { scroll: 0, drag: null }, back: 'title', setupMsg: '', restoreMsg: '',
    owned: false, restoreBusy: false, sq: null, round: { n: 0, score: 0, squares: 0, lives: MARATHON_LIVES, seed: 1 }, resultInfo: null,
    paused: false, pauseMenu: false, think: null, thinkRects: null, hintMsg: '', L: null,
    watch: { phase: 'idle', timer: 0, paused: false, lines: [], pick: null },
    learnCur: 0, drillResult: null, lastMode: 'tips', lockDown: 0,
  };
  let lastSize = '';
  const bg = { sq: null };

  // ---- persistence ---------------------------------------------------------------------------------------------------------------
  const saveAll = () => { storage.set('settings', G.settings); storage.set('progress', G.progress); storage.set('setup', G.setup); };
  Promise.all([storage.get('settings', null), storage.get('progress', null), storage.get('setup', null)]).then(([s, p, su]) => {
    if (s) Object.assign(G.settings, s);
    if (p) {
      if (Array.isArray(p.stars)) G.progress.stars = LEVELS.map((_, i) => clamp(p.stars[i] | 0, 0, 3));
      G.progress.best = p.best | 0; G.progress.drills = p.drills && typeof p.drills === 'object' ? p.drills : {};
      G.progress.demoSquares = p.demoSquares | 0; G.progress.squares = p.squares | 0; G.progress.evenings = p.evenings | 0; G.progress.played = p.played | 0;
    }
    if (su) {
      G.setup.mode = ['tips', 'marathon', 'practice', 'watch'].includes(su.mode) ? su.mode : 'tips';
      G.setup.level = clamp(su.level | 0, 0, LEVELS.length - 1); G.setup.card = clamp(su.card ?? 1, 0, 2); G.setup.depth = clamp(su.depth ?? 1, 0, 3);
    }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.settings.pace = clamp(G.settings.pace | 0, 0, PACES.length - 1);
    G.settings.guide = G.settings.guide ? 1 : 0; G.settings.oneTap = G.settings.oneTap ? 1 : 0;
    G.loaded = true; MN.invalidateLayout(); audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    sel: () => tone({ freq: 620, to: 780, dur: 0.07, type: 'triangle', vol: 0.06 }),
    boom: (hi) => tone({ freq: hi ? 110 : 73.4, to: hi ? 90 : 60, dur: 0.16, type: 'triangle', vol: 0.2 }),
    chop: () => tone({ freq: 1500, to: 900, dur: 0.035, type: 'square', vol: 0.018 }),
    fiddle: (f, d) => { tone({ freq: f, dur: d, type: 'sawtooth', vol: 0.03 }); tone({ freq: f * 2.005, dur: d * 0.8, type: 'triangle', vol: 0.016 }); },
    home: (k) => tone({ freq: 523 * Math.pow(2, k / 12), dur: 0.22, type: 'triangle', vol: 0.09 }),
    fail: () => [0, -3, -7].forEach((k, i) => later(() => tone({ freq: 330 * Math.pow(2, k / 12), dur: 0.3, type: 'triangle', vol: 0.08 }), i * 0.18)),
    chime: () => [0, 7, 12, 16, 19].forEach((k, i) => tone({ freq: 523 * Math.pow(2, k / 12), dur: 0.5 + i * 0.05, type: 'triangle', vol: 0.07 })),
  };
  const delayed = [];
  function later(f, t = 0.3) { delayed.push({ t, f }); }
  const sing = (call) => {
    const words = call.say.split(' ').slice(0, 12);
    words.forEach((w, i) => later(() => tone({ freq: SING[(w.length + i * 2) % SING.length], dur: 0.16, type: 'triangle', vol: 0.045 }), 0.04 + i * 0.26));
  };

  // ---- squares -------------------------------------------------------------------------------------------------------------------
  const paceMul = () => PACE_MUL[G.settings.pace] || 1;
  function newSquare(def, extra = {}) {
    const tempo = def.tempo * paceMul();
    return {
      arr: def.arr.slice(), opt: def.opt, card: def.card.slice(), tempo, look: def.tip.look, title: def.tip.name, k: def.level ? def.level.k : 0, levelIdx: def.level ? def.level.idx : -1,
      cap: def.opt + SLACK_TIP, cur: null, queued: null, sel: null, phase: 'ready', clock: 0, beatLen: 60 / tempo, used: 0, fillers: 0, hint: 0, hist: [],
      finT: 0, glow: 0, confetti: [], stars: 0, won: false, eighth: -1, phraseNo: 0, tune: def.tip.look % TUNES.length, ...extra,
    };
  }
  const base = () => (G.sq.cur ? G.sq.cur.to : G.sq.arr);
  function startPhrase(id) {
    const sq = G.sq, call = CALL_BY_ID[id] || SWING;
    const dur = BEATS * 60 / sq.tempo;
    sq.cur = { call, t: 0, dur, from: sq.arr, to: apply(sq.arr, call) };
    sq.beatLen = 60 / sq.tempo; sq.clock = 0; sq.eighth = -1; sq.phase = 'dance'; sq.used++; sq.hist.push(call.id);
    if (sq.queued === call.id) sq.queued = null;
    if (sq.sel === call.id) sq.sel = null;
    if (call.id !== 'swing') sing(call);
    G.hintMsg = '';
  }
  function commit(id) {
    const sq = G.sq;
    if (!sq || sq.phase === 'fin' || sq.phase === 'fail' || !sq.card.includes(id)) return;
    if (G.mode === 'shot') return;
    if (sq.phase === 'ready' || sq.phase === 'wait') { sq.queued = id; startPhrase(id); G.progress.played++; }
    else sq.queued = id;
    sq.sel = null;
    sfx.tick();
  }
  function endPhrase() {
    const sq = G.sq;
    sq.arr = sq.cur.to; sq.cur = null; sq.phraseNo++;
    if (isHome(sq.arr)) { resolve(); return; }
    if (sq.used + sq.hint >= sq.cap) { fail(); return; }
    if (G.mode === 'watch') { sq.phase = 'wait'; G.watch.phase = 'ready'; return; }
    if (sq.queued) startPhrase(sq.queued);
    else if (G.settings.pace === 0) sq.phase = 'wait';
    else { sq.fillers++; startPhrase('swing'); }
  }
  function spawnConfetti() {
    const sq = G.sq, cols = ['#ffd45a', '#e5484d', '#17a398', '#7a5af8', '#fff3dc', '#f2b01e'];
    for (let i = 0; i < 46; i++) {
      const a = rng.range(0, Math.PI * 2), sp = rng.range(0.4, 1.8);
      sq.confetti.push({ x: rng.range(-0.3, 0.3), y: rng.range(-0.3, 0.3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 0.6, c: cols[i % cols.length], r: rng.range(5, 10), rot: rng.range(0, 6), vr: rng.range(-8, 8), life: rng.range(1.4, 2.6) });
    }
  }
  function resolve() {
    const sq = G.sq, m = G.mode;
    sq.phase = 'fin'; sq.won = true; sq.finT = 0; sq.glow = 1;
    const total = sq.used + sq.hint;
    sq.stars = total <= sq.opt ? 3 : total <= sq.opt + SLACK_ONE ? 2 : 1;
    spawnConfetti();
    for (let i = 0; i < 8; i++) later(() => sfx.home(i * 2), 0.06 * i);
    later(() => sfx.chime(), 0.6);
    G.progress.squares++;
    const info = { won: true, stars: sq.stars, used: total, opt: sq.opt, cap: sq.cap, fillers: sq.fillers, newStar: false, canNext: false, nextIdx: 0 };
    if (m === 'tips') {
      const li = sq.levelIdx;
      if (sq.stars > G.progress.stars[li]) { G.progress.stars[li] = sq.stars; info.newStar = true; }
      info.nextIdx = Math.min(LEVELS.length - 1, li + 1);
      info.canNext = li < LEVELS.length - 1 && !(demo && li + 1 >= DEMO_LEVELS);
      if (demo) G.progress.demoSquares++;
    } else if (m === 'marathon') {
      G.round.score += 10 + 5 * sq.stars; G.round.squares++; G.round.n++;
      if (demo) G.progress.demoSquares++;
    } else if (m === 'practice') { G.round.squares++; G.round.n++; }
    G.resultInfo = info;
    saveAll();
  }
  function fail() {
    const sq = G.sq;
    sq.phase = 'fail'; sq.finT = 0; sq.won = false;
    sfx.fail();
    G.resultInfo = { won: false, stars: 0, used: sq.used + sq.hint, opt: sq.opt, cap: sq.cap, fillers: sq.fillers };
    if (G.mode === 'marathon') G.round.lives--;
    saveAll();
  }
  function afterBanner() {
    const sq = G.sq, m = G.mode;
    if (m === 'drill') { const l = LESSONS[G.learnCur]; if (sq.won) G.progress.drills[l.id] = true; G.drillResult = { pass: sq.won }; saveAll(); go('lessonresult'); return; }
    if (m === 'marathon') {
      if (sq.won && !(demo && G.progress.demoSquares >= DEMO_MARATHON_CAP)) { newMarathonSquare(); return; }
      if (!sq.won && G.round.lives > 0) { newMarathonSquare(); return; }
      endMarathon(); return;
    }
    if (m === 'practice') { if (sq.won) newPracticeSquare(); else newPracticeSquare(); return; }
    go('result');
  }
  function endMarathon() {
    const info = { score: G.round.score, squares: G.round.squares, newBest: false };
    if (G.round.score > G.progress.best) { G.progress.best = G.round.score; info.newBest = true; }
    G.resultInfo = info; G.mode = 'marathon'; saveAll(); go('result');
  }

  // ---- starting things -----------------------------------------------------------------------------------------------------------
  function enterPlay(sq) {
    G.sq = sq; G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.think = null; G.hintMsg = '';
    G.watch.phase = G.mode === 'watch' ? 'ready' : 'idle'; G.watch.paused = false; G.watch.lines = []; G.watch.pick = null;
    G.ui.scroll = 0; G.resultInfo = null; MN.invalidateLayout();
    if (G.mode === 'watch') { sq.phase = 'wait'; }
  }
  function startTips(idx) {
    if (demo && idx >= DEMO_LEVELS) { G.setupMsg = 'The web demo has the first squares.'; return; }
    G.mode = 'tips'; G.lastMode = 'tips'; G.setup.level = idx;
    enterPlay(newSquare(levelSquare(idx)));
  }
  function startWatch(idx) {
    G.mode = 'watch'; G.lastMode = 'watch'; G.setup.level = idx;
    enterPlay(newSquare(levelSquare(idx)));
  }
  function newMarathonSquare() {
    G.mode = 'marathon';
    enterPlay(newSquare(marathonSquare(G.round.n, G.round.seed + G.round.squares * 3 + (G.round.lives === MARATHON_LIVES ? 0 : 1))));
  }
  function startMarathon() {
    if (demo && G.progress.demoSquares >= DEMO_MARATHON_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; MN.invalidateLayout(); return; }
    G.mode = 'marathon'; G.lastMode = 'marathon'; G.progress.evenings++;
    G.round = { n: 0, score: 0, squares: 0, lives: MARATHON_LIVES, seed: G.progress.evenings * 17 + 3 };
    newMarathonSquare();
  }
  function newPracticeSquare() {
    const st = G.setup, card = POOL.slice(0, CARD_N[st.card]);
    enterPlay(newSquare(customSquare(card, DEPTHS[st.depth], G.round.seed + G.round.n * 31 + 7, 100 + st.depth * 4)));
  }
  function startPractice() {
    G.mode = 'practice'; G.lastMode = 'practice';
    G.round = { n: 0, score: 0, squares: 0, lives: 99, seed: G.progress.squares + 11 };
    newPracticeSquare();
  }
  function startLesson() {
    const l = LESSONS[G.learnCur];
    G.mode = 'drill'; G.lastMode = 'drill';
    let arr = [0, 1, 2, 3, 4, 5, 6, 7];
    for (const id of l.scramble) arr = apply(arr, CALL_BY_ID[id]);
    const def = { arr, opt: distOf(l.calls, arr), card: l.calls, tempo: 96, tip: TIPS[0], level: null };
    const sq = newSquare(def, { title: l.title });
    enterPlay(sq);
    sq.noPressure = true;
  }

  // ---- hints -----------------------------------------------------------------------------------------------------------------------
  function planFor(sq) {
    const b = sq.cur ? sq.cur.to : sq.arr;
    const id = bestCall(sq.card, b);
    if (!id) return null;
    const call = CALL_BY_ID[id], after = apply(b, call);
    return { id, lines: explainCall(call, homeCount(b), homeCount(after), distOf(sq.card, b)) };
  }
  function openThink() {
    const sq = G.sq;
    if (sq.phase === 'fin' || sq.phase === 'fail') return;
    const p = planFor(sq);
    if (!p) return;
    sq.sel = p.id;
    G.think = { lines: [...p.lines, sq.hint ? 'You already used a hint in this square.' : `Using the hint adds ${HINT_COST} phrase to this square.`] };
    if (!sq.hint && !sq.noPressure) sq.hint = HINT_COST;
    sfx.sel();
  }

  // ---- input -----------------------------------------------------------------------------------------------------------------------
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
    if (id === 'tips' || id === 'practice' || id === 'watch') openSetup(id);
    else if (id === 'marathon') openSetup('marathon');
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
    if (id.startsWith('lv')) {
      const i = +id.slice(2);
      if (st.mode === 'watch') startWatch(i);
      else if (i === 0 || G.progress.stars[i - 1] > 0 || G.dev) startTips(i);
      else G.setupMsg = 'Resolve the square before it first.';
      st.level = i; saveAll(); MN.invalidateLayout();
    } else if (id.startsWith('card')) { st.card = +id.slice(4); MN.invalidateLayout(); saveAll(); }
    else if (id.startsWith('depth')) { st.depth = +id.slice(5); MN.invalidateLayout(); saveAll(); }
    else if (id === 'start') {
      if (st.mode === 'marathon') startMarathon();
      else if (st.mode === 'practice') startPractice();
      else if (st.mode === 'tips') { const i = st.level; if (i === 0 || G.progress.stars[i - 1] > 0 || G.dev) startTips(i); else G.setupMsg = 'Resolve the square before it first.'; }
      else startWatch(st.level);
    } else if (id === 'back') go('title');
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') setText(st.textIdx - 1);
    else if (id === 'txt-inc') setText(st.textIdx + 1);
    else if (id === 'pace-dec') st.pace = Math.max(0, st.pace - 1);
    else if (id === 'pace-inc') st.pace = Math.min(PACES.length - 1, st.pace + 1);
    else if (id === 'guide-tog') st.guide = st.guide ? 0 : 1;
    else if (id === 'onetap-tog') st.oneTap = st.oneTap ? 0 : 1;
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (G.restoreBusy || env.monetization.owns('unlock_game')) return;
      G.restoreBusy = true; G.restoreMsg = 'Checking the store...';
      env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored. Full game unlocked.' : 'No earlier purchase was found for this account.'; })
        .catch(() => { G.restoreMsg = 'The store could not be reached. Try again later.'; })
        .then(() => { G.restoreBusy = false; MN.invalidateLayout(); });
    }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveAll(); MN.invalidateLayout();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    const m = G.lastMode === 'drill' ? G.setup.mode : G.lastMode;
    if (id === 'next') startTips(G.resultInfo.nextIdx);
    else if (id === 'again') { if (m === 'marathon') startMarathon(); else if (m === 'practice') startPractice(); else if (m === 'watch') startWatch(G.setup.level); else startTips(G.sq && G.sq.levelIdx >= 0 ? G.sq.levelIdx : G.setup.level); }
    else if (id === 'new') openSetup(m);
    else if (id === 'menu') go('title');
  }
  function handleLearn(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id.startsWith('lesson') && id !== 'lesson-go' && id !== 'lesson-back') { G.learnCur = +id.slice(6); go('lesson'); }
  }
  function handleLesson(id) { if (!id) return; sfx.tick(); if (id === 'lesson-go') startLesson(); else if (id === 'lesson-back') go('learn'); }
  function handleLessonResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'lr-again') startLesson();
    else if (id === 'lr-next') { G.learnCur = Math.min(LESSONS.length - 1, G.learnCur + 1); go('lesson'); }
    else if (id === 'lr-list') go('learn');
  }
  function leaveRound() {
    const m = G.mode;
    G.paused = false; G.pauseMenu = false; G.think = null; G.watch.paused = false;
    if (m === 'marathon' && G.round.squares > 0) { endMarathon(); return; }
    if (m === 'practice' && G.round.squares > 0) { G.resultInfo = { squares: G.round.squares }; go('result'); return; }
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
  const refList = () => (G.scene === 'howto' ? [HOWTO, 'How to Play'] : G.scene === 'about' ? [aboutList(), 'About'] : [RULES, 'Rules']);
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
    const ptr = input.pointer, k = input.keys, bar = MN.setupBar(G.setup.mode);
    if (k.pressed.has('Enter') && bar.start) { handleSetup('start'); return; }
    if (ptr.pressed && bar.start && inRect(bar.start, ptr.x, ptr.y)) { handleSetup('start'); return; }
    if (ptr.pressed && inRect(bar.back, ptr.x, ptr.y)) { handleSetup('back'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  // ---- the floor ---------------------------------------------------------------------------------------------------------------
  function openPause() { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; MN.invalidateLayout(); }
  function selectCall(id, input) {
    const sq = G.sq;
    if (sq.sel === id || G.settings.oneTap) commit(id); else { sq.sel = id; sfx.sel(); }
  }
  function playMusic(sq, dt) {
    // one step per eighth note of the phrase
    const e = Math.floor(sq.clock / (sq.beatLen / 2));
    if (e === sq.eighth) return;
    for (let k = sq.eighth + 1; k <= e && k < 16; k++) {
      const beat = k >> 1, off = k & 1;
      if (!off) { if (beat % 2 === 0) sfx.boom(beat % 4 === 2); else sfx.chop(); }
      else sfx.chop();
      const t = TUNES[sq.tune][k], odd = sq.phraseNo % 2 === 1;
      const note = odd && k >= 12 ? [5, 4, 3, 3][k - 12] : t;
      if (note >= 0 && (k % 2 === 0 || sq.phraseNo % 3 !== 2)) sfx.fiddle(DEG[note], sq.beatLen * 0.46);
    }
    sq.eighth = Math.min(e, 15);
  }
  function updateDance(dt) {
    const sq = G.sq;
    if (sq.phase !== 'dance' || !sq.cur) return;
    if (sq.noPressure && false) return;
    sq.cur.t += dt; sq.clock += dt;
    playMusic(sq, dt);
    if (sq.cur.t >= sq.cur.dur) endPhrase();
  }
  function updateBanner(dt, input) {
    const sq = G.sq;
    sq.finT += dt;
    sq.glow = Math.max(0, 1 - sq.finT / 2.4);
    if (sq.phase === 'fin' && sq.finT > 0.6 && (input.pointer.pressed || input.keys.pressed.has('Enter') || input.keys.pressed.has('Space'))) sq.finT = Math.max(sq.finT, 99);
    const lim = sq.phase === 'fin' ? 2.6 : 1.9;
    if (sq.finT >= lim && !sq.leaving) { sq.leaving = true; afterBanner(); }
  }
  function updateWatchControls(input, L) {
    const wt = G.watch, ptr = input.pointer, st = G.settings;
    if (ptr.pressed) {
      const rects = watchRects(L);
      if (inRect(rects[0], ptr.x, ptr.y) || inRect(L.pause, ptr.x, ptr.y)) { wt.paused = !wt.paused; sfx.tick(); }
      else if (inRect(rects[1], ptr.x, ptr.y)) { st.thinkIdx = Math.max(0, st.thinkIdx - 1); saveAll(); sfx.tick(); }
      else if (inRect(rects[2], ptr.x, ptr.y)) { st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1); saveAll(); sfx.tick(); }
      else if (inRect(rects[3], ptr.x, ptr.y)) { leaveWatch(); return false; }
    }
    if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) wt.paused = !wt.paused;
    return true;
  }
  function leaveWatch() { G.paused = false; G.watch.paused = false; go('title'); }
  function updateWatch(dt, input, L) {
    if (!updateWatchControls(input, L)) return;
    const wt = G.watch, sq = G.sq;
    if (wt.paused) return;
    if (sq.phase === 'fin' || sq.phase === 'fail') { updateBanner(dt, input); return; }
    if (sq.phase === 'dance') { wt.phase = 'idle'; updateDance(dt); return; }
    // wait: the computer thinks, reveals, then calls
    if (wt.phase === 'ready' || wt.phase === 'idle') {
      const p = planFor(sq);
      if (!p) return;
      wt.pick = p.id; wt.lines = p.lines; wt.phase = 'think'; wt.timer = THINK_STEPS[G.settings.thinkIdx];
      return;
    }
    if (wt.phase === 'think') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'reveal'; wt.timer = 2; sq.sel = wt.pick; sfx.sel(); } return; }
    if (wt.phase === 'reveal') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'idle'; wt.lines = []; commit(wt.pick); } }
  }
  function updatePlay(dt, input) {
    const sq = G.sq;
    const L = playLayout(G.settings.textIdx, sq.card.length);
    G.L = L;
    // confetti
    if (sq.confetti.length) {
      for (const c of sq.confetti) { c.x += c.vx * dt; c.y += c.vy * dt; c.vy -= 1.6 * dt; c.rot += c.vr * dt; c.life -= dt; }
      sq.confetti = sq.confetti.filter((c) => c.life > 0);
    }
    if (G.mode === 'shot') return;
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    if (G.mode === 'watch') { updateWatch(dt, input, L); return; }
    if (sq.phase === 'fin' || sq.phase === 'fail') { updateBanner(dt, input); return; }
    const ptr = input.pointer, keys = input.keys;
    if (G.think) {
      if ((ptr.pressed && G.thinkRects && inRect(G.thinkRects.close, ptr.x, ptr.y)) || keys.pressed.has('Enter') || keys.pressed.has('Escape') || keys.pressed.has('KeyT')) { G.think = null; sfx.tick(); }
      return;
    }
    if (ptr.pressed && inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { openPause(); return; }
    if (ptr.pressed && inRect(L.think, ptr.x, ptr.y)) { openThink(); return; }
    if (keys.pressed.has('KeyT')) { openThink(); return; }
    if (ptr.pressed) {
      let hit = -1;
      L.cards.forEach((r, k) => { if (inRect(r, ptr.x, ptr.y)) hit = k; });
      if (hit >= 0) selectCall(sq.card[hit], input);
      else if (inRect(L.callIt, ptr.x, ptr.y) && sq.sel) commit(sq.sel);
    }
    for (let k = 0; k < sq.card.length && k < 9; k++) if (keys.pressed.has(`Digit${k + 1}`)) selectCall(sq.card[k], input);
    if ((keys.pressed.has('Enter') || keys.pressed.has('Space')) && sq.sel) commit(sq.sel);
    updateDance(dt);
  }

  // the idle floor behind the menus
  const idleDancers = (t) => Array.from({ length: 8 }, (_, s) => {
    const p = slotPos(s);
    return { id: s, x: p.x, y: p.y, face: Math.atan2(-p.y, -p.x) + Math.sin(t * 1.2 + s) * 0.15, step: 0.1, spin: t * 0.6, reach: 0.1, lift: Math.abs(Math.sin(t * 2.4 + s * 0.5)) * 0.04 };
  });
  G.sceneBack = (ctx) => {
    const W = live.w, H = live.h, side = Math.min(W * 0.92, H * 0.5);
    if (G.wait3d && !G.has3d) { veil(ctx, W, H, W / 2, H * (live.land ? 0.5 : 0.28)); return; }
    if (!G.has3d) drawRoom(ctx, W, H, (G.progress.played + 2) % 6, G.t, (G.t * 1.5) % 1);
    const R = { x: W / 2 - side / 2, y: H * (live.land ? 0.5 : 0.28) - side / 2, w: side, h: side };
    drawFloor(ctx, R, { look: (G.progress.played + 2) % 6, time: G.t, beat: (G.t * 1.5) % 1, dancers: idleDancers(G.t), lit: new Array(8).fill(true), ghosts: null, arrows: null, glow: 0, confetti: null, tags: false, p3: G.has3d, idle: true });
  };

  // ---- screenshot mode and developer tools -------------------------------------------------------------------------------------
  const setShot = (n) => {
    const idx = [4, 13, 20, 27, 9][n % 5];
    G.mode = 'shot'; G.sq = newSquare(levelSquare(idx)); G.scene = 'play';
    const sq = G.sq, best = bestCall(sq.card, sq.arr);
    if (n % 5 === 1 || n % 5 === 0) { sq.sel = best; }
    else if (n % 5 === 2 || n % 5 === 4) {
      const call = CALL_BY_ID[best || sq.card[0]];
      sq.cur = { call, t: call.kind === 'grand' ? 0.45 * 4 : 0.5 * 4, dur: 4, from: sq.arr, to: apply(sq.arr, call) }; sq.phase = 'dance'; sq.clock = 1.9; sq.used = 1;
    } else if (n % 5 === 3) {
      sq.arr = [0, 1, 2, 3, 4, 5, 6, 7]; sq.phase = 'fin'; sq.won = true; sq.stars = 3; sq.finT = 1.5; sq.glow = 0.6; sq.used = sq.opt; spawnConfetti();
      for (const c of sq.confetti) c.life = 3;
    }
  };
  if (config.shot) { G.t = 5; setShot(Number(config.shotSeed) || 0); if (config.dev) G.devFreeze = true; }
  if (config.dev) {
    G.devApi = {
      freeze(v = true) { G.devFreeze = v; },
      startTips(i) { startTips(i); }, startMarathon() { startMarathon(); }, startPractice() { startPractice(); }, startWatch(i) { startWatch(i); }, startLesson(i) { G.learnCur = i; startLesson(); },
      scene(s, back) { G.scene = s; if (back) G.back = back; G.ui.scroll = 0; MN.invalidateLayout(); },
      textIdx(i) { setText(i); }, hint() { openThink(); }, pause() { openPause(); },
      select(id) { if (G.sq) G.sq.sel = id; }, commit(id) { commit(id); },
      shot(n) { setShot(n); },
      solve() { const sq = G.sq; for (let i = 0; i < 40 && sq.phase !== 'fin'; i++) { const id = bestCall(sq.card, sq.cur ? sq.cur.to : sq.arr); if (!id) break; if (sq.phase === 'dance') { sq.cur.t = sq.cur.dur; endPhrase(); if (G.sq.phase === 'fin') break; } commit(id); } },
    };
  }

  const api = {
    // Menus, Rules, About, settings, Learn, Practice, Watch & Learn, pause, hints and thinking before the first call are free; only the music
    // running in Tips and the Endless Evening counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && (G.mode === 'tips' || G.mode === 'marathon') && G.sq && G.sq.phase === 'dance') || G.paused || G.pauseMenu || !!G.think,
    update(dt, input) {
      syncSize(meta.width, meta.height);
      const sk = sizeKey();
      if (sk !== lastSize) { if (lastSize) { G.ui.drag = null; MN.invalidateLayout(); } lastSize = sk; }
      meta.previewBadge = G.scene === 'play' && G.L && G.L.pill ? { x: G.L.pill.x + G.L.pill.w / 2, y: G.L.pill.y + 1, align: 'center' } : { x: live.w / 2, y: live.h - 40, align: 'center' };
      setPress(input.pointer);
      const own = !!env.monetization?.owns?.('unlock_game');
      if (own !== G.owned) { G.owned = own; MN.invalidateLayout(); }
      G.t += dt;
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { const f = delayed[i].f; delayed.splice(i, 1); f(); } }
      if (G.devFreeze) return;
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
        case 'about': MN.renderPages(ctx, G, aboutList(), 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        case 'play':
          renderHud(ctx, G);
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        default: break;
      }
    },
    getState: () => G,
    // the 3D presenter (web/view3d) switches the 3D floor on when its stage is ready and off again if the GPU context is lost
    setStage3d(on) { G.has3d = !!on; },
    // main.js: true while the 3D hall is still loading (a quiet veil shows instead of a one-second flash of the 2D floor), false once it is ready or failed
    setWait3d(on) { G.wait3d = !!on; },
  };
  if (config.dev) {
    const idle = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } });
    G.devApi.tick = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, idle()); };
  }
  return api;
}
