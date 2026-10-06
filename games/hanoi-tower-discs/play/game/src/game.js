// GAME CONTRACT (docs/GAME-CONTRACT.md). Tower of Hanoi — see design/GDD.md.
import { meta, inRect, TOOLBAR_IDS, layoutFor } from './layout.js';
import { LEVELS, dailyLevel } from './levels.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, UNLOCK_NEED, THINK_STEPS, solvedIn, totalSolved, levelLocked, demoLocked, firstOpenLevel } from './screens.js';
import {
  createPuzzle, refit, pointerDown, pointerMove, pointerUp, tapPeg, undo, restart, think, updatePuzzle, allRest, commit, winBurst, cancel,
} from './puzzle.js';
import { bestMove, legalMoves, topOf } from './solver.js';
import { tr } from './content.js';
import { render } from './view.js';

export { meta };
// Mouse wheel / trackpad scrolling for the text readers: main.js adds CSS-pixel deltas converted to virtual units, update() consumes them.
export const wheelInput = { dy: 0 };

const VERSION = '1.1.0';
const PEG = (i) => 'ABCD'[i];
const PENTA = [1047, 880, 784, 659, 587, 523, 440, 392, 330, 294];
const WIN_NOTES = [523, 587, 659, 784, 880, 1047];

export async function createGame(env) {
  const { rng, storage, audio, config } = env;

  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0,
    sound: true, numbers: true, textIdx: 0, thinkIdx: 1,
    progress: { stars: {} },
    dailyRec: { day: -1, streak: 0 },
    page: { howto: 0, rules: 0 },
    scroll: {}, scrollVel: {}, press: null, puzDown: false,
    levelIdx: 0, daily: false, puz: null, auto: null, winInfo: null, winSeq: null, toast: null, toastT: 0,
    today: config?.day ?? 0, demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, resetArm: false,
    version: VERSION, price: '', shot: false, lastPtr: { x: 0, y: 0 }, save: null,
  };

  const [prog, set, daily, save] = await Promise.all([storage.get('hn.progress', null), storage.get('hn.settings', null), storage.get('daily', null), storage.get('hn.save', null)]);
  if (prog && prog.stars) S.progress = { stars: prog.stars };
  if (daily && Number.isInteger(daily.day)) S.dailyRec = { day: daily.day, streak: daily.streak ?? 0 };
  if (save && typeof save.id === 'string' && Array.isArray(save.history)) S.save = save;
  if (set) {
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (typeof set.numbers === 'boolean') S.numbers = set.numbers;
    if (Number.isInteger(set.textIdx)) S.textIdx = Math.min(Math.max(set.textIdx, 0), TEXT_SCALES.length - 1);
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = Math.min(Math.max(set.thinkIdx, 0), THINK_STEPS.length - 1);
  }
  audio.setMuted(!S.sound);
  // The price shown is the store's localized price when the shell knows it, else the game.json price (kit priceOf).
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);

  const saveSettings = () => storage.set('hn.settings', { sound: S.sound, numbers: S.numbers, textIdx: S.textIdx, thinkIdx: S.thinkIdx });
  const saveProgress = () => storage.set('hn.progress', { stars: S.progress.stars, solved: totalSolved(S) });
  const saveGame = () => {
    const puz = S.puz;
    if (S.scene !== 'play' || !puz || S.daily) return;
    S.save = puz.done || !puz.history.length ? null : { id: puz.level.id, history: puz.history.map((m) => [...m]) };
    storage.set('hn.save', S.save);
  };

  // ------------------------------------------------------------------------------ sound
  const sfx = (o) => { if (S.sound) audio.tone(o); };
  const SOUNDS = {
    lift: () => sfx({ freq: 420, to: 640, dur: 0.07, type: 'sine', vol: 0.07 }),
    land: (d, v) => {
      const k = Math.min(1, (v ?? 1200) / 1800);
      sfx({ freq: 190, to: 80, dur: 0.1, type: 'triangle', vol: 0.12 + 0.14 * k });
      sfx({ freq: PENTA[d % PENTA.length], dur: 0.28, type: 'sine', vol: 0.07 });
    },
    refuse: () => { sfx({ freq: 170, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.07 }); },
    undo: () => sfx({ freq: 520, to: 330, dur: 0.1, type: 'triangle', vol: 0.1 }),
    think: () => { sfx({ freq: 660, dur: 0.12, type: 'sine', vol: 0.1 }); sfx({ freq: 990, dur: 0.18, type: 'sine', vol: 0.06 }); },
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.08 }),
  };

  // ------------------------------------------------------------------------------ levels
  function openPuzzle(level, history) {
    S.puz = createPuzzle(level, rng.fork(), { history, area: layoutFor().play.scene });
    S.scene = 'play'; S.overlay = null; S.winInfo = null; S.winSeq = null; S.toast = null; S.puzDown = false;
  }
  function startLevel(i, fresh = false) {
    S.levelIdx = i; S.daily = false;
    const lv = LEVELS[i];
    const history = !fresh && S.save && S.save.id === lv.id ? S.save.history : undefined;
    openPuzzle(lv, history);
    if (fresh) { S.save = null; storage.set('hn.save', null); }
  }
  function startDaily() {
    if (S.demo) { S.scene = 'demo-limit'; return; }
    S.daily = true;
    openPuzzle(dailyLevel(config.day ?? 0));
  }

  function onWin() {
    const puz = S.puz;
    S.winSeq = { t: 0, i: 0 };
    winBurst(puz);
    S.winInfo = { stars: puz.stars, moves: puz.moves, min: puz.min };
    if (S.scene === 'auto') return;
    if (S.daily) {
      const d = S.dailyRec, day = config.day ?? 0;
      if (d.day !== day) { d.streak = d.day === day - 1 ? d.streak + 1 : 1; d.day = day; storage.set('daily', { day: d.day, streak: d.streak }); }
      return;
    }
    const lv = puz.level;
    if (puz.stars > (S.progress.stars[lv.id] ?? 0)) S.progress.stars[lv.id] = puz.stars;
    saveProgress();
    S.save = null; storage.set('hn.save', null);
  }

  // ------------------------------------------------------------------------------ Watch & Learn
  const AUTO_IDS = ['c3', 'c4', 'f4'];
  const autoIdx = () => AUTO_IDS.map((id) => LEVELS.findIndex((l) => l.id === id)).filter((i) => i >= 0);
  function startAutoPuzzle() {
    const a = S.auto;
    S.levelIdx = a.ids[a.k]; S.daily = false;
    S.puz = createPuzzle(LEVELS[S.levelIdx], rng.fork(), { area: layoutFor().play.sceneAuto });
    S.winSeq = null;
    Object.assign(a, { phase: 'intro', t: 0, target: null, scan: null, legal: [], note: '' });
  }
  function startAuto() {
    S.auto = { ids: autoIdx(), k: 0, phase: 'intro', t: 0, paused: false, target: null, scan: null, legal: [], note: '' };
    S.scene = 'auto'; S.overlay = null; S.puzDown = false;
    startAutoPuzzle();
  }
  function planAuto() {
    const a = S.auto, puz = S.puz;
    const mv = bestMove([...puz.pegOf], puz.P, puz.goal);
    if (!mv) { a.target = null; return; }
    const disc = topOf(puz.pegOf, mv[0]);
    a.target = { from: mv[0], to: mv[1], disc };
    a.legal = legalMoves(puz.pegOf, puz.P);
    let kd = -1;
    for (let d = puz.n - 1; d >= 0; d--) if (puz.pegOf[d] !== puz.goal) { kd = d; break; }
    a.note = disc === kd
      ? `Disc ${kd + 1} is free: ${PEG(mv[0])} to ${PEG(mv[1])}`
      : `Clearing the way for disc ${kd + 1}: disc ${disc + 1} to ${PEG(mv[1])}`;
  }
  // THINK (configurable) -> REVEAL (2 s: the disc, its legal pegs and the chosen peg light up) -> ACT (the move)
  function updateAuto(dt) {
    const a = S.auto, puz = S.puz;
    if (a.paused) return;
    a.t += dt;
    if (a.phase === 'intro') {
      if (a.t >= 1) { a.phase = 'think'; a.t = 0; planAuto(); }
    } else if (a.phase === 'think') {
      const pegsWith = [...Array(puz.P).keys()].filter((p) => puz.pegOf.includes(p));
      a.scan = pegsWith.length ? pegsWith[Math.floor(a.t / 0.7) % pegsWith.length] : null;
      if (a.t >= THINK_STEPS[S.thinkIdx]) { a.phase = 'reveal'; a.t = 0; a.scan = null; }
    } else if (a.phase === 'reveal') {
      if (a.t >= 2) {
        a.phase = 'act'; a.t = 0;
        if (a.target) commit(puz, a.target.from, a.target.to);
      }
    } else if (a.phase === 'act') {
      if (a.t >= 0.5 && allRest(puz)) {
        if (puz.done) { a.phase = 'celebrate'; a.t = 0; } else { a.phase = 'think'; a.t = 0; planAuto(); }
      }
    } else if (a.phase === 'celebrate') {
      if (a.t >= 3.4) {
        if (a.k + 1 < a.ids.length) { a.k += 1; startAutoPuzzle(); } else { S.overlay = 'autosum'; S.ovT = 0; a.phase = 'summary'; }
      }
    }
  }

  // ------------------------------------------------------------------------------ store screenshots
  // `tools/arc shots` loads the page with ?shot=1&seed=N and plays N ticks of random input. Seeds 900001 to 900009
  // (only together with ?shot=1) stage a real moment of play instead and ignore the random input.
  function stageShot(n) {
    const idxOf = (id) => LEVELS.findIndex((l) => l.id === id);
    const settle = (puz, secs) => { for (let i = 0; i < secs * 60; i++) updatePuzzle(puz, 1 / 60); puz.events.length = 0; };
    const play = (puz, k) => { for (let i = 0; i < k; i++) { const mv = bestMove([...puz.pegOf], puz.P, puz.goal); if (mv) commit(puz, mv[0], mv[1], true); } settle(puz, 1.5); };
    S.shot = true;
    ['c3', 'c4', 'c5', 'f3', 'f4', 's1'].forEach((id, i) => { S.progress.stars[id] = i % 3 === 1 ? 2 : 3; });
    if (n === 1) { // a five-disc tower mid-solution, a disc lifted over its peg
      startLevel(idxOf('c5'), true); play(S.puz, 12);
      const puz = S.puz;
      const mv = bestMove([...puz.pegOf], puz.P, puz.goal);
      puz.sel = mv[0]; const d = puz.discs[topOf(puz.pegOf, mv[0])]; d.mode = 'lift'; d.dst = mv[0];
      settle(puz, 1);
    } else if (n === 2) { // Think: the best next move
      startLevel(idxOf('c6'), true); play(S.puz, 20); think(S.puz); settle(S.puz, 0.5);
    } else if (n === 3) { // solved
      startLevel(idxOf('c4'), true); play(S.puz, 15); S.puz.doneT = 2;
      onWin(); S.overlay = 'win'; S.ovT = 1;
    } else if (n === 4) { // Watch & Learn about to move
      S.thinkIdx = 0; startAuto(); S.auto.k = 1; startAutoPuzzle(); play(S.puz, 5);
      S.auto.phase = 'reveal'; S.auto.t = 1; planAuto();
    } else if (n === 5) { S.scene = 'levels'; S.scroll.levels = 0; }
    else if (n === 6) { startLevel(idxOf('f6'), true); play(S.puz, 8); }
    else if (n === 7) { S.dailyRec = { day: S.today - 1, streak: 4 }; startDaily(); play(S.puz, 99); S.puz.doneT = 2; onWin(); S.overlay = 'win'; S.ovT = 1; }
    else if (n === 8) { startDaily(); play(S.puz, 3); }
    else if (n === 9) { startLevel(idxOf('s8'), true); play(S.puz, 6); }
    else if (n >= 10 && n <= 30) { // text-zoom and screen checks (QA only)
      S.textIdx = 4;
      if (n === 10) S.scene = 'title';
      else if (n === 11) S.scene = 'settings';
      else if (n === 12) S.scene = 'about';
      else if (n === 13) { startLevel(idxOf('c4'), true); play(S.puz, 15); S.puz.doneT = 2; onWin(); S.overlay = 'win'; S.ovT = 1; }
      else if (n === 14) { S.scene = 'levels'; }
      else if (n === 15) { startLevel(idxOf('c3'), true); play(S.puz, 2); S.overlay = 'pause'; S.ovT = 1; }
      else if (n === 16) { S.scene = 'demo-limit'; }
      else if (n === 17) { S.scene = 'howto'; S.jump = { scene: 'howto', page: 1 }; }
      else if (n === 18) { startAuto(); S.auto.paused = true; S.overlay = null; }
      else if (n === 19) { S.demo = true; S.scene = 'title'; S.textIdx = 0; }
      else if (n === 20) { S.textIdx = 0; startLevel(idxOf('c10'), true); play(S.puz, 300); }
      else if (n === 21) { S.textIdx = 0; startLevel(idxOf('f8'), true); play(S.puz, 14); }
      else if (n === 22) { S.textIdx = 0; S.dailyRec = { day: S.today - 1, streak: 4 }; startDaily(); play(S.puz, 2); }
    } else if (n >= 1001 && n <= 1020) { S.scene = 'rules'; S.jump = { scene: 'rules', page: n - 1001 }; }
    else if (n >= 2001 && n <= 2020) { S.scene = 'rules'; S.jump = { scene: 'rules', page: n - 2001 }; S.textIdx = 4; }
  }
  const wantsShot = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search);
  const sd = config?.seed ?? 0;
  const shotSeed = wantsShot && ((sd >= 900001 && sd <= 900030) || (sd >= 901001 && sd <= 901020) || (sd >= 902001 && sd <= 902020)) ? sd - 900000 : 0;
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
    S.scroll[scene] = 0;
    SOUNDS.ui();
  }

  function setText(d) {
    const n = Math.min(Math.max(S.textIdx + d, 0), TEXT_SCALES.length - 1);
    if (n === S.textIdx) return;
    S.textIdx = n; saveSettings(); S.scroll = {};
  }

  function leavePlay() {
    saveGame();
    S.puz = null; S.puzDown = false;
    if (S.daily) { S.daily = false; gotoScene('title'); } else { gotoScene('levels'); scrollToLevel(S.levelIdx); }
  }

  function activate(id) {
    if (id == null) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
    if (id.startsWith('lvl:')) {
      const i = Number(id.slice(4));
      if (demoLocked(S, i)) { S.scene = 'demo-limit'; return; }
      if (levelLocked(S, i)) return;
      SOUNDS.ui(); startLevel(i); return;
    }
    switch (id) {
      case 'play':
        if (totalSolved(S) === 0 && !levelLocked(S, 0)) { startLevel(0); return; }
        gotoScene('levels'); scrollToLevel(firstOpenLevel(S)); return;
      case 'daily': startDaily(); return;
      case 'auto': startAuto(); return;
      case 'howto': case 'rules': case 'about': case 'settings': gotoScene(id); return;
      case 'back': case 'menu': gotoScene('title'); return;
      case 'set:sound': S.sound = !S.sound; audio.setMuted(!S.sound); saveSettings(); if (S.sound) SOUNDS.ui(); return;
      case 'set:numbers': S.numbers = !S.numbers; saveSettings(); return;
      case 'set:think-': S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); return;
      case 'set:think+': S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); return;
      case 'set:restore': Promise.resolve(env.monetization?.restore?.()).then(refreshOwns); return;
      case 'set:unlock': Promise.resolve(env.monetization?.purchase?.('unlock_game')).then(refreshOwns); return;
      case 'set:reset':
        if (!S.resetArm) { S.resetArm = true; return; }
        S.progress = { stars: {} }; S.dailyRec = { day: -1, streak: 0 }; S.save = null;
        saveProgress(); storage.set('daily', { day: -1, streak: 0 }); storage.set('hn.save', null); S.resetArm = false; return;
      case 'ov:resume': S.overlay = null; return;
      case 'ov:restart': case 'ov:replay': S.overlay = null; if (S.daily) startDaily(); else startLevel(S.levelIdx, true); return;
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
    cancel(puz);
    for (let n = 0; n < 2000 && !puz.done; n++) { const mv = bestMove([...puz.pegOf], puz.P, puz.goal); if (!mv) break; commit(puz, mv[0], mv[1]); }
  }

  // ------------------------------------------------------------------------------ pointer handling
  function fixedHit(ui, x, y) {
    const list = [...ui.fixed];
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
    else if (pr.kind === 'auto') { if (inRect(x, y, pr.rect)) autoAction(pr.id); }
    else if (pr.kind === 'tool') { if (inRect(x, y, pr.rect)) toolAction(pr.id.slice(5)); }
  }

  // ---- play
  function playDown(x, y) {
    const P = layoutFor().play;
    if (inRect(x, y, P.back)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: P.back }; return; }
    if (inRect(x, y, P.pause)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: P.pause }; return; }
    for (let i = 0; i < TOOLBAR_IDS.length; i++) {
      const r = P.tools[i];
      if (inRect(x, y, r)) { S.press = { id: `tool:${TOOLBAR_IDS[i]}`, active: true, kind: 'tool', rect: r }; return; }
    }
    S.puzDown = pointerDown(S.puz, x, y);
  }
  function hudAction(id) {
    if (id === 'hud:back') leavePlay();
    else if (id === 'hud:pause') { cancel(S.puz); S.overlay = 'pause'; S.ovT = 0; }
  }
  function showToast(msg) { S.toast = msg; S.toastT = 2.2; }
  function toolAction(id) {
    const puz = S.puz;
    if (!puz || puz.done) return;
    if (id === 'undo') { if (!undo(puz)) showToast(tr('nothingUndo')); else saveGame(); }
    else if (id === 'think') think(puz);
    else if (id === 'restart') { restart(puz); saveGame(); }
  }

  // ---- auto
  function autoDown(x, y) {
    const P = layoutFor().play;
    if (inRect(x, y, P.back)) { S.press = { id: 'auto:exit', active: true, kind: 'auto', rect: P.back }; return; }
    for (const id of ['slower', 'pause', 'faster']) {
      if (inRect(x, y, P.auto[id])) { S.press = { id: `auto:${id}`, active: true, kind: 'auto', rect: P.auto[id] }; return; }
    }
  }
  function autoAction(id) {
    if (id === 'auto:exit') { S.auto = null; S.puz = null; gotoScene('title'); }
    else if (id === 'auto:pause') S.auto.paused = !S.auto.paused;
    else if (id === 'auto:slower') { S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); }
    else if (id === 'auto:faster') { S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); }
  }

  // ---- keyboard
  const PEG_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, KeyA: 0, KeyB: 1, KeyC: 2, KeyD: 3 };
  function onKeys(keys) {
    const has = (c) => keys.pressed.has(c);
    if (S.scene === 'play' && !S.overlay && S.puz) {
      for (const k of Object.keys(PEG_KEYS)) if (has(k)) tapPeg(S.puz, PEG_KEYS[k]);
      if (has('KeyU')) toolAction('undo');
      if (has('KeyT')) toolAction('think');
      if (has('KeyR')) toolAction('restart');
      if (has('Escape') || has('KeyP')) { cancel(S.puz); S.overlay = 'pause'; S.ovT = 0; }
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
      if (keys.down.has('ArrowDown')) setScroll(ui, getScroll(ui) + 18);
      if (keys.down.has('ArrowUp')) setScroll(ui, getScroll(ui) - 18);
      if (has('PageDown') || has('Space')) setScroll(ui, getScroll(ui) + ui.region.h * 0.9);
      if (has('PageUp')) setScroll(ui, getScroll(ui) - ui.region.h * 0.9);
      if (has('Home')) setScroll(ui, 0);
      if (has('End')) setScroll(ui, 1e9);
    }
    if (has('Escape') && ['levels', 'howto', 'rules', 'about', 'settings', 'demo-limit'].includes(S.scene)) gotoScene('title');
  }

  // ------------------------------------------------------------------------------ puzzle events
  function handleEvents() {
    const puz = S.puz;
    for (const ev of puz.events) {
      if (ev.type === 'lift') SOUNDS.lift();
      else if (ev.type === 'land') SOUNDS.land(ev.d, ev.v);
      else if (ev.type === 'refuse') SOUNDS.refuse();
      else if (ev.type === 'undo') SOUNDS.undo();
      else if (ev.type === 'think') SOUNDS.think();
      else if (ev.type === 'move') { if (S.scene === 'play') saveGame(); }
      else if (ev.type === 'solved') onWin();
    }
    puz.events.length = 0;
  }

  function stepWinSeq(dt) {
    const w = S.winSeq;
    if (!w) return;
    w.t += dt;
    while (w.i < WIN_NOTES.length && w.t >= 0.25 + w.i * 0.13) {
      sfx({ freq: WIN_NOTES[w.i], dur: 0.35, type: 'sine', vol: 0.16 });
      sfx({ freq: WIN_NOTES[w.i] / 2, dur: 0.4, type: 'triangle', vol: 0.06 });
      w.i++;
    }
    if (w.i >= WIN_NOTES.length) S.winSeq = null;
  }

  // ------------------------------------------------------------------------------ main loop
  return {
    update(dt, input) {
      // Watch & Learn's Pause freezes the whole loop: timers, the discs' springs, particles and the ambient clock.
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
        // cancelled): let go where the finger last was instead of leaving the disc stuck to a finger that is gone.
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

      // wheel / trackpad on the text screens
      if (wheelInput.dy) {
        const ui = buildUi(S);
        if (ui.layout && ui.region) setScroll(ui, getScroll(ui) + wheelInput.dy);
        wheelInput.dy = 0;
      }
      // a shot / QA seed asked for a particular Rules page: scroll the reader to it
      if (S.jump && S.jump.scene === S.scene && !S.overlay) {
        const ui = buildUi(S);
        if (ui.layout && ui.pageMarks) { const it = ui.layout.items[ui.pageMarks[Math.min(S.jump.page, ui.pageMarks.length - 1)]]; setScroll(ui, it ? it.y : 0); }
        S.jump = null;
      }
      // the screen changed shape (rotation, split window): re-fit the towers, the position is kept
      if (S.puz && (S.scene === 'play' || S.scene === 'auto')) {
        const L = layoutFor(), area = S.scene === 'auto' ? L.play.sceneAuto : L.play.scene;
        if (S.puz.g.area !== area) refit(S.puz, area);
      }

      if (S.puz) {
        if (S.scene === 'play' && S.overlay !== 'pause') updatePuzzle(S.puz, dt);
        else if (S.scene === 'auto' && !frozen) { updatePuzzle(S.puz, dt); updateAuto(dt); }
        if (S.puz) {
          handleEvents();
          if (!frozen) stepWinSeq(dt);
          if (S.scene === 'play' && S.puz.done && !S.overlay && S.puz.doneT > 1.7) { S.overlay = 'win'; S.ovT = 0; }
        }
      }
    },

    render(ctx) {
      render(ctx, S, buildUi(S), layoutFor());
    },

    // Check scripts only: every tappable rect on the current screen (screen coordinates), to test overlap / bounds programmatically.
    layoutRects() {
      const L = layoutFor(), out = [], add = (id, r) => { if (r && r.w != null) out.push({ id, x: r.x, y: r.y, w: r.w, h: r.h }); };
      const ui = buildUi(S);
      if (S.overlay || !(S.scene === 'play' || S.scene === 'auto')) {
        for (const f of ui.fixed) if (f.id != null) add(f.id, f.rect);
        if (ui.layout && ui.region) {
          const sc = getScroll(ui);
          for (const it of ui.layout.items) for (const bt of it.btns) if (bt.id != null) {
            const r = { x: ui.region.x + bt.x, y: ui.region.y + (ui.offY || 0) + bt.y - sc, w: bt.w, h: bt.h };
            const y0 = Math.max(r.y, ui.region.y), y1 = Math.min(r.y + r.h, ui.region.y + ui.region.h);
            if (y1 > y0) add(bt.id, { x: r.x, y: y0, w: r.w, h: y1 - y0 });
          }
        }
      } else if (S.scene === 'play') {
        add('back', L.play.back); add('pause', L.play.pause); TOOLBAR_IDS.forEach((id, i) => add(id, L.play.tools[i]));
      } else {
        add('back', L.play.back); for (const k of ['slower', 'pause', 'faster']) add(k, L.play.auto[k]);
      }
      return { w: L.w, h: L.h, mode: L.mode, rects: out, region: ui.region || null, panel: ui.panel || null, scene: S.puz ? S.puz.g.area : null, ins: L.ins, chips: S.puz && !S.overlay ? L.play.chips : [] };
    },

    getState() {
      const puz = S.puz;
      const r = (v) => Math.round(v * 10) / 10;
      return {
        scene: S.scene, overlay: S.overlay, w: meta.width, h: meta.height, textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, level: S.levelIdx,
        daily: S.daily, solved: totalSolved(S), stars: S.progress.stars, streak: S.dailyRec.streak, page: S.page, scroll: S.scroll,
        auto: S.auto ? { k: S.auto.k, phase: S.auto.phase, t: Math.round(S.auto.t * 100) / 100, paused: S.auto.paused } : null,
        puzzle: puz ? {
          id: puz.level.id, done: puz.done, moves: puz.moves, min: puz.min, stars: puz.stars, sel: puz.sel, pegOf: puz.pegOf, hint: puz.hint ? [puz.hint.from, puz.hint.to] : null,
          discs: puz.discs.map((d) => [d.mode, r(d.x), r(d.y)]),
        } : null,
      };
    },

    // The preview clock counts real play only. Menus, level select, Rules / How to Play / About, Settings,
    // every overlay (pause, win, Watch & Learn summary), the demo card and Watch & Learn are all free time.
    // Dev tools only (?dev=1): the layout checks read the rects of the screen that is showing through this.
    dbg: config?.dev ? { buildUi: () => buildUi(S) } : undefined,

    isPreviewExempt: () => S.shot || S.scene !== 'play' || Boolean(S.overlay),
  };
}
