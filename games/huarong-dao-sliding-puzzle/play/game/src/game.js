// GAME CONTRACT (docs/GAME-CONTRACT.md). Huarong Dao: Sliding Puzzle — see design/GDD.md.
import { SCREEN, inRect, BACK_BTN, PAUSE_BTN, TOOLBAR_IDS, toolRect, AUTO_BTNS, CELL } from './layout.js';
import { LEVELS } from './levels.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, UNLOCK_NEED, THINK_STEPS, solvedIn, totalSolved, levelLocked, demoLocked, firstOpenLevel } from './screens.js';
import {
  createPuzzle, pointerDown, pointerMove, pointerUp, undo, requestHint, updatePuzzle, isSettled, burst, selectNext, nudge,
  nextAutoMove, autoSlide, movablePieces, ensureSol, rectOf, slideTo, restoreRun,
} from './puzzle.js';
import { render } from './view.js';

export const meta = { width: SCREEN.width, height: SCREEN.height };

const VERSION = '1.0.0';
const AUTO_IDS = ['dawn-patrol', 'two-guards', 'red-cliffs'];
const GOLDS = ['#fbe6a6', '#e4bd68', '#ffffff', '#ffcf6a'];
const REDS = ['#c7372c', '#e4bd68', '#f6ead2', '#d9604a'];

export async function createGame(env) {
  const { rng, storage, audio, config } = env;

  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0,
    lang: 'en', sound: true, textIdx: 0, thinkIdx: 1,
    progress: { stars: {}, best: {} },
    run: null,
    page: { howto: 0, rules: 0 },
    scroll: {}, scrollVel: {}, press: null, puzDown: false,
    levelIdx: 0, puz: null,
    auto: null, winInfo: null, winSeq: null, toast: null, toastT: 0,
    demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, resetArm: false,
    version: VERSION, price: '', shot: false, lastPtr: { x: 0, y: 0 },
  };

  const [prog, set, run] = await Promise.all([storage.get('hd.progress', null), storage.get('hd.settings', null), storage.get('hd.run', null)]);
  if (prog && prog.stars) S.progress = { stars: prog.stars, best: prog.best ?? {} };
  if (run && typeof run.id === 'string' && Array.isArray(run.hist)) S.run = run;
  if (set) {
    if (set.lang === 'zh' || set.lang === 'en') S.lang = set.lang;
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (Number.isInteger(set.textIdx)) S.textIdx = Math.min(Math.max(set.textIdx, 0), TEXT_SCALES.length - 1);
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = Math.min(Math.max(set.thinkIdx, 0), THINK_STEPS.length - 1);
  }
  audio.setMuted(!S.sound);
  // The price shown is the store's localized price when the shell knows it, else the game.json price (kit priceOf).
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);

  const saveSettings = () => storage.set('hd.settings', { lang: S.lang, sound: S.sound, textIdx: S.textIdx, thinkIdx: S.thinkIdx });
  const saveProgress = () => storage.set('hd.progress', { ...S.progress, solved: totalSolved(S) });
  // The unfinished level is kept so the player can leave, close the app and come back to the same position.
  const saveRun = () => {
    const puz = S.puz;
    if (!puz || S.scene !== 'play') return;
    S.run = puz.done || !puz.history.length ? null : { id: puz.level.id, hist: puz.history.map((h) => [h.id, h.toX, h.toY]), hints: puz.hints };
    storage.set('hd.run', S.run);
  };

  // ------------------------------------------------------------------------------ sound
  const sfx = (o) => { if (S.scene !== 'auto' && S.sound) audio.tone(o); };
  const SOUNDS = {
    lift: () => sfx({ freq: 520, to: 720, dur: 0.05, type: 'sine', vol: 0.06 }),
    step: () => sfx({ freq: 980, to: 760, dur: 0.03, type: 'sine', vol: 0.035 }),
    knock: () => { sfx({ freq: 190, to: 92, dur: 0.09, type: 'triangle', vol: 0.26 }); sfx({ freq: 1500, to: 700, dur: 0.03, type: 'square', vol: 0.045 }); },
    slide: () => sfx({ freq: 300, to: 540, dur: 0.12, type: 'sine', vol: 0.05 }),
    select: () => sfx({ freq: 640, to: 760, dur: 0.05, type: 'sine', vol: 0.07 }),
    bump: () => sfx({ freq: 140, to: 80, dur: 0.1, type: 'triangle', vol: 0.18 }),
    hint: () => { sfx({ freq: 660, dur: 0.16, type: 'sine', vol: 0.11 }); sfx({ freq: 990, dur: 0.2, type: 'sine', vol: 0.05 }); },
    undo: () => sfx({ freq: 520, to: 330, dur: 0.1, type: 'triangle', vol: 0.1 }),
    reset: () => sfx({ freq: 400, to: 200, dur: 0.18, type: 'sawtooth', vol: 0.05 }),
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.07 }),
  };
  const WIN_NOTES = [392, 440, 523, 587, 659, 784, 880, 1047]; // a rising pentatonic run
  const sound = (name) => SOUNDS[name]?.();

  // ------------------------------------------------------------------------------ levels
  function startLevel(i, fresh = false) {
    S.levelIdx = i;
    const lv = LEVELS[i];
    S.puz = createPuzzle(lv, rng.fork());
    if (!fresh && S.run && S.run.id === lv.id) {
      restoreRun(S.puz, S.run.hist, S.run.hints ?? 0);
    } else if (S.run && S.run.id === lv.id) { S.run = null; storage.set('hd.run', null); }
    S.scene = 'play'; S.overlay = null; S.winInfo = null; S.winSeq = null; S.toast = null; S.puzDown = false;
  }

  function onWin() {
    const puz = S.puz;
    S.winSeq = { t: 0, i: 0 };
    burst(puz, 200, 760, rng, 24, GOLDS, { shape: 'tile', min: 120, max: 520, up: 260, life: 1.9, size0: 5, size1: 10, g: 640 });
    burst(puz, 520, 760, rng, 24, REDS, { shape: 'tile', min: 120, max: 520, up: 260, life: 1.9, size0: 5, size1: 10, g: 640 });
    burst(puz, 360, 1040, rng, 40, GOLDS, { shape: 'dot', min: 80, max: 460, up: 200, life: 1.4, size0: 3, size1: 7 });
    if (S.scene === 'auto') return;
    const lv = puz.level;
    const before = solvedIn(S, lv.ch);
    const wasBest = S.progress.best[lv.id] ?? 0;
    const newBest = !wasBest || puz.moves < wasBest;
    if (puz.stars > (S.progress.stars[lv.id] ?? 0)) S.progress.stars[lv.id] = puz.stars;
    if (newBest) S.progress.best[lv.id] = puz.moves;
    saveProgress();
    S.run = null; storage.set('hd.run', null);
    const after = solvedIn(S, lv.ch);
    const hasNext = LEVELS.some((l) => l.ch === lv.ch + 1);
    S.winInfo = { stars: puz.stars, moves: puz.moves, min: lv.min, best: newBest && Boolean(wasBest), newChapter: before < UNLOCK_NEED && after >= UNLOCK_NEED && hasNext ? lv.ch + 1 : null };
  }

  // ------------------------------------------------------------------------------ Watch & Learn
  const autoLevelIdx = () => AUTO_IDS.map((id) => LEVELS.findIndex((l) => l.id === id)).filter((i) => i >= 0);
  function startAutoPuzzle() {
    const a = S.auto;
    const idx = a.ids[a.k];
    S.levelIdx = idx;
    S.puz = createPuzzle(LEVELS[idx], rng.fork());
    S.puz.glide = true;
    S.winSeq = null;
    a.phase = 'intro'; a.t = 0; a.move = null; a.scan = -1; a.n = 0;
  }
  function startAuto() {
    S.auto = { ids: autoLevelIdx(), k: 0, phase: 'intro', t: 0, paused: false, move: null, scan: -1, n: 0, movable: [] };
    S.scene = 'auto'; S.overlay = null; S.puzDown = false;
    startAutoPuzzle();
  }
  // THINK (configurable) -> REVEAL (2 s: every block that can move is marked, the chosen block and its
  // landing cell pulse) -> ACT (the block slides) ... until the Commander walks out of the gate.
  function updateAuto(dt) {
    const a = S.auto, puz = S.puz;
    if (a.paused) return;
    a.t += dt;
    if (a.phase === 'intro') {
      if (!puz.sol) ensureSol(puz);
      if (a.t >= 1) { a.phase = 'think'; a.t = 0; a.move = nextAutoMove(puz); a.movable = movablePieces(puz); }
    } else if (a.phase === 'think') {
      a.scan = a.movable.length ? a.movable[Math.floor(a.t / 0.55) % a.movable.length] : -1;
      if (a.t >= THINK_STEPS[S.thinkIdx]) {
        a.phase = 'reveal'; a.t = 0; a.scan = -1;
        if (a.move) { puz.selected = -1; puz.hint = { id: a.move.id, x: a.move.x, y: a.move.y, left: a.move.left, t: 0, path: a.move.path }; }
      }
    } else if (a.phase === 'reveal') {
      if (a.t >= 2) {
        a.phase = 'act'; a.t = 0;
        if (a.move) { puz.hint = null; autoSlide(puz, a.move); a.n += 1; }
      }
    } else if (a.phase === 'act') {
      if (a.t >= 0.35 && isSettled(puz)) {
        if (puz.done) { a.phase = 'celebrate'; a.t = 0; } else { a.phase = 'think'; a.t = 0; a.move = nextAutoMove(puz); a.movable = movablePieces(puz); }
      }
    } else if (a.phase === 'celebrate') {
      if (a.t >= 3.4) {
        if (a.k + 1 < a.ids.length) { a.k += 1; startAutoPuzzle(); } else { S.overlay = 'autosum'; S.ovT = 0; a.phase = 'summary'; }
      }
    }
  }

  // ------------------------------------------------------------------------------ store screenshots
  // `tools/arc shots` loads the page with ?shot=1&seed=N and plays N ticks of random input. Seeds from
  // 900001 up (and only together with ?shot=1) stage a real moment of play instead and ignore the random
  // input, so the store pictures show actual gameplay. Players never see this: a normal launch has no shot flag.
  function stageShot(n) {
    const lvIdx = (id) => LEVELS.findIndex((l) => l.id === id);
    const settle = (puz, secs) => { for (let i = 0; i < secs * 60; i++) updatePuzzle(puz, 1 / 60); puz.events.length = 0; };
    const solverMoves = (puz, k) => { for (let i = 0; i < k; i++) { const m = nextAutoMove(puz); if (!m) break; slideTo(puz, m.id, m.x, m.y); settle(puz, 0.8); } };
    S.shot = true;
    LEVELS.slice(0, 11).forEach((l, i) => { S.progress.stars[l.id] = i % 4 === 1 ? 2 : i % 5 === 2 ? 1 : 3; S.progress.best[l.id] = l.min + (i % 4) * 3; });
    if (n === 1) { // a block held over its landing cell
      startLevel(lvIdx('heng-dao-li-ma'));
      const puz = S.puz;
      solverMoves(puz, 9);
      const m = nextAutoMove(puz);
      const p = puz.pieces[m.id], r = rectOf(p);
      const x0 = r.x + r.w / 2, y0 = r.y + r.h / 2;
      pointerDown(puz, x0, y0);
      const tx = x0 + (m.x - p.x) * CELL, ty = y0 + (m.y - p.y) * CELL;
      for (let i = 1; i <= 16; i++) { pointerMove(puz, x0 + (tx - x0) * i / 16, y0 + (ty - y0) * i / 16); updatePuzzle(puz, 1 / 60); }
      S.puzDown = true;
    } else if (n === 2) { // Think: the block pulses and its landing cell lights up
      startLevel(lvIdx('heng-dao-li-ma'));
      solverMoves(S.puz, 14);
      requestHint(S.puz);
      settle(S.puz, 0.3);
    } else if (n === 3) { // solved
      startLevel(lvIdx('two-guards'));
      const puz = S.puz;
      for (let i = 0; i < 60 && !puz.done; i++) { const m = nextAutoMove(puz); if (!m) break; slideTo(puz, m.id, m.x, m.y); settle(puz, 0.5); }
      puz.doneT = 0.2;
      S.winInfo = { stars: puz.stars, moves: puz.moves, min: puz.level.min, best: false, newChapter: null };
      S.overlay = 'win'; S.ovT = 1;
    } else if (n === 4) { // Watch & Learn about to move a block
      S.thinkIdx = 0;
      startAuto();
      S.auto.k = 1;
      startAutoPuzzle();
      S.auto.phase = 'think'; S.auto.t = 0.2;
      S.auto.move = nextAutoMove(S.puz); S.auto.movable = movablePieces(S.puz);
    } else if (n === 5) { // the level select
      S.scene = 'levels';
      S.scroll.levels = 0;
    } else if (n === 7) { S.scene = 'rules'; S.page.rules = 2;
    } else if (n === 8) { S.scene = 'howto'; S.page.howto = 1; S.textIdx = 2;
    } else if (n === 9) { S.scene = 'settings'; S.textIdx = 4;
    } else if (n === 6) { // the same game in Chinese, a block selected
      S.lang = 'zh';
      startLevel(lvIdx('red-cliffs'));
      solverMoves(S.puz, 4);
      const puz = S.puz;
      puz.selected = nextAutoMove(puz)?.id ?? -1;
    }
  }
  const shotSeed = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search) && config?.seed >= 900001 && config.seed <= 900009 ? config.seed - 900000 : 0;
  if (shotSeed) stageShot(shotSeed);

  // ------------------------------------------------------------------------------ ui plumbing
  const getScroll = (ui) => S.scroll[ui.scrollKey] ?? 0;
  const setScroll = (ui, v) => { if (ui.layout && ui.region) S.scroll[ui.scrollKey] = clampScroll(v, ui.layout.height, ui.region.h); };

  function scrollToLevel(idx) {
    const ui = buildUi(S);
    if (!ui.layout) return;
    for (const it of ui.layout.items) {
      const bt = it.b.t === 'grid' ? it.btns.find((b) => b.cell && b.cell.idx === idx) : null;
      if (bt) { S.scroll.levels = clampScroll(bt.y - 120, ui.layout.height, ui.region.h); return; }
    }
  }

  function gotoScene(scene) {
    S.scene = scene; S.overlay = null; S.press = null; S.resetArm = false; S.scrollVel = {};
    if (scene === 'howto') S.page.howto = 0;
    if (scene === 'rules') S.page.rules = 0;
    S.scroll[scene] = 0;
    sound('ui');
  }

  function setLang(l) { S.lang = l; saveSettings(); S.scroll = {}; sound('ui'); }
  function setText(d) {
    const n = Math.min(Math.max(S.textIdx + d, 0), TEXT_SCALES.length - 1);
    if (n === S.textIdx) return;
    S.textIdx = n; saveSettings(); S.scroll = {};
  }

  function leavePlay() {
    saveRun();
    S.puz = null; S.puzDown = false;
    gotoScene('levels'); scrollToLevel(S.levelIdx);
  }

  function activate(id) {
    if (id == null) return;
    if (id.startsWith('lang:')) { setLang(id.slice(5)); return; }
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
    if (id.startsWith('lvl:')) {
      const i = Number(id.slice(4));
      if (demoLocked(S, i)) { S.scene = 'demo-limit'; return; }
      if (levelLocked(S, i)) return;
      sound('ui'); startLevel(i); return;
    }
    switch (id) {
      case 'play':
        if (totalSolved(S) === 0 && !levelLocked(S, 0)) { startLevel(S.run ? Math.max(0, LEVELS.findIndex((l) => l.id === S.run.id)) : 0); return; }
        gotoScene('levels'); scrollToLevel(firstOpenLevel(S)); return;
      case 'auto': startAuto(); return;
      case 'howto': case 'rules': case 'about': case 'settings': gotoScene(id); return;
      case 'back': case 'menu': gotoScene('title'); return;
      case 'prev': S.page[S.scene] = Math.max(0, S.page[S.scene] - 1); S.scroll = {}; sound('ui'); return;
      case 'next': {
        const total = S.scene === 'rules' ? 13 : 6;
        if (S.scene === 'howto' && S.page.howto >= total - 1) { activate('play'); return; }
        S.page[S.scene] = Math.min(total - 1, S.page[S.scene] + 1); S.scroll = {}; sound('ui'); return;
      }
      case 'set:sound': S.sound = !S.sound; audio.setMuted(!S.sound); saveSettings(); if (S.sound) sound('ui'); return;
      case 'set:think-': S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); return;
      case 'set:think+': S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); return;
      case 'set:restore': Promise.resolve(env.monetization?.restore?.()).then(refreshOwns); return;
      case 'set:unlock': Promise.resolve(env.monetization?.purchase?.('unlock_game')).then(refreshOwns); return;
      case 'set:reset':
        if (!S.resetArm) { S.resetArm = true; return; }
        S.progress = { stars: {}, best: {} }; S.run = null; saveProgress(); storage.set('hd.run', null); S.resetArm = false; return;
      case 'ov:resume': S.overlay = null; return;
      case 'ov:restart': case 'ov:replay': S.overlay = null; startLevel(S.levelIdx, true); return;
      case 'ov:levels': S.overlay = null; leavePlay(); return;
      case 'ov:next': {
        const n = S.levelIdx + 1;
        S.overlay = null;
        if (n >= LEVELS.length) { leavePlay(); return; }
        if (demoLocked(S, n)) { S.puz = null; S.scene = 'demo-limit'; return; }
        if (levelLocked(S, n)) { leavePlay(); return; }
        startLevel(n, true); return;
      }
      case 'ov:devsolve': devSolve(); return;
      case 'ov:autoagain': S.overlay = null; startAuto(); return;
      case 'ov:autoexit': S.overlay = null; S.auto = null; S.puz = null; gotoScene('title'); return;
      default:
    }
  }

  function devSolve() {
    const puz = S.puz;
    S.overlay = null;
    if (!puz || puz.done) return;
    for (let n = 0; n < 200 && !puz.done; n++) { const m = nextAutoMove(puz); if (!m) break; slideTo(puz, m.id, m.x, m.y); }
  }

  // ------------------------------------------------------------------------------ pointer handling
  function fixedHit(ui, x, y) {
    const list = [...ui.fixed];
    if (ui.nav) list.push(ui.nav.prev, ui.nav.next);
    for (const f of list) if (f.id != null && !f.disabled && inRect(x, y, f.rect)) return f;
    return null;
  }

  function onDown(x, y) {
    S.toast = null;
    if (S.scene === 'play' && !S.overlay) { playDown(x, y); return; }
    if (S.scene === 'auto' && !S.overlay) { autoDown(x, y); return; }
    const ui = buildUi(S);
    if (!ui.layout) return;
    const f = fixedHit(ui, x, y);
    if (f) { S.press = { id: f.id, active: true, kind: 'fixed', rect: f.rect }; return; }
    const reg = ui.region;
    if (inRect(x, y, { x: reg.x - 6, y: reg.y - 4, w: reg.w + 12, h: reg.h + 8 })) {
      const hit = hitDoc(ui.layout, x - reg.x, y - reg.y - (ui.offY || 0) + getScroll(ui));
      const ok = Boolean(hit && !hit.disabled);
      S.press = { id: ok ? hit.id : null, active: ok, kind: 'doc', x0: x, y0: y, scroll0: getScroll(ui), scrolling: false, lastY: y, vel: 0 };
      S.scrollVel = {};
    } else S.press = null;
  }

  function onMove(x, y, dt) {
    if (S.puzDown && S.puz && S.scene === 'play' && !S.overlay) { pointerMove(S.puz, x, y); return; }
    const pr = S.press;
    if (!pr) return;
    if (pr.kind === 'doc') {
      const ui = buildUi(S);
      if (!ui.layout || !ui.region) { S.press = null; return; }
      if (!pr.scrolling && Math.abs(y - pr.y0) > 10) { pr.scrolling = true; pr.active = false; }
      if (pr.scrolling) {
        setScroll(ui, pr.scroll0 - (y - pr.y0));
        pr.vel = pr.vel * 0.6 + (-(y - pr.lastY) / Math.max(dt, 1e-3)) * 0.4;
        pr.lastY = y;
      }
    } else if (pr.rect) pr.active = inRect(x, y, pr.rect);
  }

  function onUp(x, y) {
    if (S.puzDown && S.puz && S.scene === 'play') {
      S.puzDown = false;
      pointerUp(S.puz, x, y);
      return;
    }
    const pr = S.press;
    S.press = null;
    if (!pr) return;
    if (pr.kind === 'doc') {
      const ui = buildUi(S);
      if (!ui.layout || !ui.region) return;
      if (pr.scrolling) { S.scrollVel[ui.scrollKey] = pr.vel; return; }
      const hit = hitDoc(ui.layout, x - ui.region.x, y - ui.region.y - (ui.offY || 0) + getScroll(ui));
      if (hit && hit.id === pr.id && !hit.disabled) activate(hit.id);
    } else if (pr.kind === 'fixed') { if (inRect(x, y, pr.rect)) activate(pr.id); }
    else if (pr.kind === 'hud') { if (inRect(x, y, pr.rect)) hudAction(pr.id); }
    else if (pr.kind === 'tool') { if (inRect(x, y, pr.rect)) toolAction(pr.id.slice(5)); }
    else if (pr.kind === 'auto') { if (inRect(x, y, pr.rect)) autoAction(pr.id); }
  }

  // ---- play
  function playDown(x, y) {
    if (inRect(x, y, BACK_BTN)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: BACK_BTN }; return; }
    if (inRect(x, y, PAUSE_BTN)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: PAUSE_BTN }; return; }
    for (let i = 0; i < TOOLBAR_IDS.length; i++) {
      const r = toolRect(i);
      if (inRect(x, y, r)) { S.press = { id: `tool:${TOOLBAR_IDS[i]}`, active: true, kind: 'tool', rect: r }; return; }
    }
    S.puzDown = pointerDown(S.puz, x, y);
  }
  function hudAction(id) {
    if (id === 'hud:back') leavePlay();
    else if (id === 'hud:pause') { S.overlay = 'pause'; S.ovT = 0; S.puzDown = false; if (S.puz) S.puz.drag = null; }
  }
  function showToast(msg) { S.toast = msg; S.toastT = 2.2; }
  function toolAction(id) {
    const puz = S.puz;
    if (!puz || puz.done) return;
    const zh = S.lang === 'zh';
    if (id === 'undo') { if (!undo(puz)) showToast(zh ? '没有可撤销的操作' : 'Nothing to undo'); else saveRun(); }
    else if (id === 'hint') { requestHint(puz); }
    else if (id === 'reset') { sound('reset'); S.run = null; storage.set('hd.run', null); startLevel(S.levelIdx, true); }
  }

  // ---- auto
  function autoDown(x, y) {
    if (inRect(x, y, BACK_BTN)) { S.press = { id: 'auto:exit', active: true, kind: 'auto', rect: BACK_BTN }; return; }
    for (const id of ['slower', 'pause', 'faster']) {
      if (inRect(x, y, AUTO_BTNS[id])) { S.press = { id: `auto:${id}`, active: true, kind: 'auto', rect: AUTO_BTNS[id] }; return; }
    }
  }
  function autoAction(id) {
    if (id === 'auto:exit') { S.auto = null; S.puz = null; gotoScene('title'); }
    else if (id === 'auto:pause') S.auto.paused = !S.auto.paused;
    else if (id === 'auto:slower') { S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); }
    else if (id === 'auto:faster') { S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); }
  }

  // ---- keyboard
  function onKeys(keys) {
    const has = (c) => keys.pressed.has(c);
    if (S.scene === 'play' && !S.overlay && S.puz) {
      if (has('KeyH')) toolAction('hint');
      if (has('KeyU')) toolAction('undo');
      if (has('KeyR')) toolAction('reset');
      if (has('Space') || has('Tab')) selectNext(S.puz);
      if (has('ArrowLeft')) nudge(S.puz, -1, 0);
      if (has('ArrowRight')) nudge(S.puz, 1, 0);
      if (has('ArrowUp')) nudge(S.puz, 0, -1);
      if (has('ArrowDown')) nudge(S.puz, 0, 1);
      if (has('Escape') || has('KeyP')) { S.overlay = 'pause'; S.ovT = 0; }
      return;
    }
    if (S.overlay === 'pause' && (has('Escape') || has('KeyP'))) { S.overlay = null; return; }
    if (S.scene === 'auto' && S.auto) {
      if (has('Space') || has('KeyP')) S.auto.paused = !S.auto.paused;
      if (has('Escape') && !S.overlay) autoAction('auto:exit');
      return;
    }
    const ui = buildUi(S);
    if (ui.layout && ui.region) {
      if (keys.down.has('ArrowDown') || keys.down.has('PageDown')) setScroll(ui, getScroll(ui) + 18);
      if (keys.down.has('ArrowUp') || keys.down.has('PageUp')) setScroll(ui, getScroll(ui) - 18);
    }
    if (has('Escape') && ['levels', 'howto', 'rules', 'about', 'settings', 'demo-limit'].includes(S.scene)) gotoScene('title');
    if (S.scene === 'howto' || S.scene === 'rules') {
      if (has('ArrowRight')) activate('next');
      if (has('ArrowLeft')) activate('prev');
    }
  }

  // ------------------------------------------------------------------------------ puzzle events
  function handleEvents() {
    const puz = S.puz;
    for (const ev of puz.events) {
      if (ev.type === 'lift') sound('lift');
      else if (ev.type === 'step') sound('step');
      else if (ev.type === 'land') { sound('knock'); dust(puz, puz.pieces[ev.id]); }
      else if (ev.type === 'drop') sound('knock');
      else if (ev.type === 'move') {
        if (ev.how !== 'drag') sound('slide');
        saveRun();
      } else if (ev.type === 'select') sound(ev.bump ? 'bump' : 'select');
      else if (ev.type === 'hint') sound('hint');
      else if (ev.type === 'undo') sound('undo');
      else if (ev.type === 'win') onWin();
    }
    puz.events.length = 0;
  }
  function dust(puz, p) {
    if (!p || puz.done) return;
    const r = rectOf(p);
    burst(puz, r.x + r.w / 2, r.y + r.h - 10, rng, 4, ['#f6ead2', '#e4bd68'], { min: 20, max: 90, up: 10, life: 0.5, size0: 2, size1: 4, g: 120, drag: 2 });
  }

  function stepWinSeq(dt) {
    const w = S.winSeq;
    if (!w) return;
    if (w.t === 0) { sfx({ freq: 110, to: 82, dur: 1.2, type: 'sine', vol: 0.28 }); sfx({ freq: 220, to: 164, dur: 0.9, type: 'triangle', vol: 0.1 }); }
    w.t += dt;
    while (w.i < WIN_NOTES.length && w.t >= 0.25 + w.i * 0.11) {
      sfx({ freq: WIN_NOTES[w.i], dur: 0.35, type: 'sine', vol: 0.15 });
      sfx({ freq: WIN_NOTES[w.i] / 2, dur: 0.4, type: 'triangle', vol: 0.05 });
      w.i++;
    }
    if (w.i >= WIN_NOTES.length) S.winSeq = null;
  }

  // ------------------------------------------------------------------------------ main loop
  return {
    update(dt, input) {
      // Watch & Learn's Pause freezes the whole loop: timers, the blocks' springs and slides, particles and the
      // ambient animation clock all stop, and resume exactly where they were.
      const frozen = S.scene === 'auto' && S.auto && S.auto.paused;
      if (!frozen) S.t += dt;
      if (S.overlay) S.ovT += dt;
      if (S.toastT > 0) { S.toastT -= dt; if (S.toastT <= 0) S.toast = null; }
      const ptr = S.shot ? { pressed: false, down: false, released: false, x: 0, y: 0 } : input.pointer;
      if (ptr.pressed) onDown(ptr.x, ptr.y);
      else if (ptr.down) onMove(ptr.x, ptr.y, dt);
      if (ptr.released) onUp(ptr.x, ptr.y);
      else if (S.puzDown && !ptr.down && !ptr.pressed && S.puz && !S.shot) {
        // The release never reached us (the preview gate held the game, the app was backgrounded, the touch was
        // cancelled): drop the block where it was last held instead of leaving it stuck to a finger that is gone.
        S.puzDown = false;
        if (S.scene === 'play') pointerUp(S.puz, S.lastPtr.x, S.lastPtr.y);
      }
      if (ptr.down || ptr.pressed) { S.lastPtr.x = ptr.x; S.lastPtr.y = ptr.y; }
      if (!S.shot && (input.keys.pressed.size || input.keys.down.size)) onKeys(input.keys);

      for (const k of Object.keys(S.scrollVel)) {
        const v = S.scrollVel[k];
        if (Math.abs(v) < 8) { delete S.scrollVel[k]; continue; }
        const ui = buildUi(S);
        if (ui.scrollKey === k && ui.layout && ui.region) setScroll(ui, (S.scroll[k] ?? 0) + v * dt);
        S.scrollVel[k] = v * Math.exp(-dt * 5);
      }

      if (S.puz) {
        if (S.scene === 'play' && S.overlay !== 'pause') updatePuzzle(S.puz, dt);
        else if (S.scene === 'auto' && !frozen) { updatePuzzle(S.puz, dt); updateAuto(dt); }
        if (S.puz) {
          handleEvents();
          stepWinSeq(dt);
          if (S.scene === 'play' && S.puz.done && !S.overlay && S.puz.doneT > 1.9) { S.overlay = 'win'; S.ovT = 0; }
        }
      }
    },

    render(ctx) {
      render(ctx, S, buildUi(S));
    },

    getState() {
      const puz = S.puz;
      return {
        scene: S.scene, overlay: S.overlay, lang: S.lang, textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, level: S.levelIdx,
        solved: totalSolved(S), stars: S.progress.stars, best: S.progress.best, page: S.page, scroll: S.scroll,
        auto: S.auto ? { k: S.auto.k, phase: S.auto.phase, t: Math.round(S.auto.t * 100) / 100, paused: S.auto.paused, n: S.auto.n } : null,
        puzzle: puz ? {
          id: puz.level.id, done: puz.done, hints: puz.hints, moves: puz.moves, min: puz.level.min, stars: puz.stars, selected: puz.selected,
          pieces: puz.pieces.map((p) => [p.t, p.x, p.y, Math.round(p.dx * 1000) / 1000, Math.round(p.dy * 1000) / 1000]),
        } : null,
      };
    },

    // The preview clock counts real play only. Menus, level select, Rules / How to Play / About, Settings,
    // every overlay (pause, win, Watch & Learn summary), the demo card and Watch & Learn are all free time.
    isPreviewExempt: () => S.shot || S.scene !== 'play' || Boolean(S.overlay),
  };
}
