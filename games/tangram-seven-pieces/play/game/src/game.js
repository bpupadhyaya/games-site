// GAME CONTRACT (docs/GAME-CONTRACT.md). Tangram: Seven Pieces — see design/GDD.md.
import { createRng } from '../kit/rng.js';
import { SCREEN, inRect, BACK_BTN, PAUSE_BTN, TOOLBAR_IDS, toolRect, AUTO_BTNS } from './layout.js';
import { LEVELS, CHAPTER_RULES } from './levels.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, UNLOCK_NEED, THINK_STEPS, solvedIn, totalSolved, levelLocked, demoLocked, firstOpenLevel } from './screens.js';
import {
  createPuzzle, pointerDown, pointerMove, pointerUp, rotatePiece, flipPiece, undo, resetPieces, requestHint, placeAtSlot, nextTarget,
  updatePuzzle, isSettled, burst, selectNext, openSlots, logicalPolyPx, requestHint as askHint,
} from './puzzle.js';
import { randomAssembly, normalizeSolution, validateSolution, centroidOfPose } from './geom.js';
import { PIECE_COLORS } from './art.js';
import { render } from './view.js';

export const meta = { width: SCREEN.width, height: SCREEN.height };

const VERSION = '1.0.1';
const AUTO_IDS = ['trapezoidhouse', 'duck', 'lantern'];

export async function createGame(env) {
  const { rng, storage, audio, config } = env;

  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0,
    lang: 'en', sound: true, glow: true, textIdx: 0, thinkIdx: 1,
    progress: { stars: {}, solved: 0 },
    dailyRec: { day: -1, streak: 0 },
    page: { howto: 0, rules: 0 },
    scroll: {}, scrollVel: {}, press: null, puzDown: false,
    levelIdx: 0, daily: false, puz: null, guides: false,
    auto: null, winInfo: null, winSeq: null, toast: null, toastT: 0,
    today: config?.day ?? 0, demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, resetArm: false,
    version: VERSION, price: '', shot: false, lastPtr: { x: 0, y: 0 },
  };

  const [prog, set, daily] = await Promise.all([storage.get('tg.progress', null), storage.get('tg.settings', null), storage.get('daily', null)]);
  if (prog && prog.stars) S.progress = { stars: prog.stars, solved: prog.solved ?? 0 };
  if (daily && Number.isInteger(daily.day)) S.dailyRec = { day: daily.day, streak: daily.streak ?? 0 };
  if (set) {
    if (set.lang === 'zh' || set.lang === 'en') S.lang = set.lang;
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (typeof set.glow === 'boolean') S.glow = set.glow;
    if (Number.isInteger(set.textIdx)) S.textIdx = Math.min(Math.max(set.textIdx, 0), TEXT_SCALES.length - 1);
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = Math.min(Math.max(set.thinkIdx, 0), THINK_STEPS.length - 1);
  }
  audio.setMuted(!S.sound);
  // The price shown is the store's localized price when the shell knows it, else the game.json price (kit priceOf).
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);

  const saveSettings = () => storage.set('tg.settings', { lang: S.lang, sound: S.sound, glow: S.glow, textIdx: S.textIdx, thinkIdx: S.thinkIdx });
  const saveProgress = () => storage.set('tg.progress', S.progress);

  // ------------------------------------------------------------------------------ sound
  const sfx = (o) => { if (S.scene !== 'auto' && S.sound) audio.tone(o); };
  const SOUNDS = {
    lift: () => sfx({ freq: 420, to: 640, dur: 0.06, type: 'sine', vol: 0.07 }),
    snap: () => { sfx({ freq: 210, to: 95, dur: 0.09, type: 'triangle', vol: 0.24 }); sfx({ freq: 1100, to: 620, dur: 0.04, type: 'square', vol: 0.05 }); },
    drop: () => sfx({ freq: 150, to: 90, dur: 0.07, type: 'triangle', vol: 0.12 }),
    rotate: () => sfx({ freq: 700, to: 900, dur: 0.04, type: 'sine', vol: 0.09 }),
    flip: () => sfx({ freq: 280, to: 880, dur: 0.1, type: 'sine', vol: 0.1 }),
    fit: () => sfx({ freq: 880, to: 1320, dur: 0.12, type: 'sine', vol: 0.09 }),
    hint: () => sfx({ freq: 660, dur: 0.12, type: 'sine', vol: 0.12 }),
    undo: () => sfx({ freq: 520, to: 330, dur: 0.1, type: 'triangle', vol: 0.1 }),
    reset: () => sfx({ freq: 400, to: 200, dur: 0.18, type: 'sawtooth', vol: 0.06 }),
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.08 }),
  };
  const WIN_NOTES = [523, 587, 659, 784, 880, 1047];

  // ------------------------------------------------------------------------------ levels
  function startLevel(i) {
    S.levelIdx = i; S.daily = false;
    const lv = LEVELS[i];
    const rules = CHAPTER_RULES[lv.ch];
    S.puz = createPuzzle(lv, rng.fork(), { mix: rules.mix, blind: rules.blind || !S.glow });
    S.guides = rules.guide;
    S.scene = 'play'; S.overlay = null; S.winInfo = null; S.winSeq = null; S.toast = null; S.puzDown = false;
  }

  // Daily puzzle: a fresh silhouette per day built by joining the seven pieces edge to edge, then
  // validated (connected, no holes, no slits) and screened for compactness. Same date, same shape.
  function dailyLevel(day) {
    const r = createRng(((day * 2654435761) ^ 0x7a3c9d1f) >>> 0);
    let best = null;
    for (let tries = 0; tries < 160; tries++) {
      const a = randomAssembly(r, 12);
      if (!a) continue;
      const sol = normalizeSolution(a.sol);
      const v = validateSolution(sol);
      if (!v.ok) continue;
      // prefer compact, calm silhouettes: high fill of the bounding box, few corners
      const score = 8 / (v.box.w * v.box.h) - 0.025 * v.loops[0].length;
      if (!best || score > best.score) best = { score, sol };
    }
    if (best) return { id: `daily-${day}`, ch: -1, n: ['Mystery shape', '神秘图形'], sol: best.sol };
    return { ...LEVELS[day % LEVELS.length], id: `daily-${day}` };
  }

  function startDaily() {
    if (S.demo) { S.scene = 'demo-limit'; return; }
    S.daily = true;
    S.puz = createPuzzle(dailyLevel(config.day ?? 0), rng.fork(), { mix: 1, blind: !S.glow });
    S.guides = false;
    S.scene = 'play'; S.overlay = null; S.winInfo = null; S.winSeq = null; S.toast = null; S.puzDown = false;
  }

  function winBurst(puz) {
    burst(puz, 180, 300, rng, 26, PIECE_COLORS, { shape: 'tile', min: 120, max: 520, up: 260, life: 1.9, size0: 5, size1: 10, g: 640 });
    burst(puz, 540, 300, rng, 26, PIECE_COLORS, { shape: 'tile', min: 120, max: 520, up: 260, life: 1.9, size0: 5, size1: 10, g: 640 });
    burst(puz, 360, 500, rng, 40, ['#ffe9a8', '#ffd45a', '#ffffff'], { shape: 'dot', min: 80, max: 420, up: 120, life: 1.4, size0: 3, size1: 7 });
    burst(puz, 360, 170, rng, 36, ['#ffb3c7', '#ffd6e0', '#ff8fb0'], { shape: 'petal', min: 20, max: 140, up: -60, life: 3.2, size0: 5, size1: 9, g: 120, drag: 0.5 });
  }

  function onWin() {
    const puz = S.puz;
    S.winSeq = { t: 0, i: 0 };
    winBurst(puz);
    if (S.scene === 'auto') return;
    if (S.daily) {
      const d = S.dailyRec, day = config.day ?? 0;
      if (d.day !== day) { d.streak = d.day === day - 1 ? d.streak + 1 : 1; d.day = day; storage.set('daily', { day: d.day, streak: d.streak }); }
      S.winInfo = { stars: puz.stars };
      return;
    }
    const lv = puz.level;
    const before = solvedIn(S, lv.ch);
    if (puz.stars > (S.progress.stars[lv.id] ?? 0)) S.progress.stars[lv.id] = puz.stars;
    S.progress.solved = totalSolved(S);
    saveProgress();
    const after = solvedIn(S, lv.ch);
    const hasNext = LEVELS.some((l) => l.ch === lv.ch + 1);
    S.winInfo = { stars: puz.stars, newChapter: before < UNLOCK_NEED && after >= UNLOCK_NEED && hasNext ? lv.ch + 1 : null };
  }

  // ------------------------------------------------------------------------------ Watch & Learn
  function autoLevelIds() {
    const out = [];
    for (const id of AUTO_IDS) { const i = LEVELS.findIndex((l) => l.id === id); if (i >= 0) out.push(i); }
    for (let i = 0; out.length < 3 && i < LEVELS.length; i++) if (!out.includes(i * 5 % LEVELS.length)) out.push(i * 5 % LEVELS.length);
    return out.slice(0, 3);
  }
  function startAutoPuzzle() {
    const a = S.auto;
    const idx = a.ids[a.k];
    S.levelIdx = idx; S.daily = false;
    S.puz = createPuzzle(LEVELS[idx], rng.fork(), { mix: 1, blind: true });
    S.puz.glide = true;
    S.guides = false;
    S.winSeq = null;
    a.phase = 'intro'; a.t = 0; a.target = null; a.scan = null;
  }
  function startAuto() {
    S.auto = { ids: autoLevelIds(), k: 0, phase: 'intro', t: 0, paused: false, target: null, scan: null };
    S.scene = 'auto'; S.overlay = null; S.puzDown = false;
    startAutoPuzzle();
  }
  // THINK (configurable) -> REVEAL (2 s: the open spots light up, the chosen piece + spot pulse) -> ACT
  function updateAuto(dt) {
    const a = S.auto, puz = S.puz;
    if (a.paused) return;
    a.t += dt;
    if (a.phase === 'intro') {
      if (a.t >= 1) { a.phase = 'think'; a.t = 0; a.target = nextTarget(puz); }
    } else if (a.phase === 'think') {
      const open = openSlots(puz);
      a.scan = open.length ? open[Math.floor(a.t / 0.7) % open.length] : null;
      if (a.t >= THINK_STEPS[S.thinkIdx]) {
        a.phase = 'reveal'; a.t = 0; a.scan = null;
        if (a.target) { puz.hint = { ...a.target, stage: 1, t: 0 }; puz.selected = a.target.piece; }
      }
    } else if (a.phase === 'reveal') {
      if (a.t >= 2) {
        a.phase = 'act'; a.t = 0;
        if (a.target) { puz.hint = null; placeAtSlot(puz, a.target.piece, a.target.slot); }
      }
    } else if (a.phase === 'act') {
      const p = a.target ? puz.pieces[a.target.piece] : null;
      if (p) p.lift = Math.max(p.lift, Math.min(1, Math.hypot(p.cx - p.dx, p.cy - p.dy) * 1.3));
      if (a.t >= 0.8 && isSettled(puz)) {
        if (puz.done) { a.phase = 'celebrate'; a.t = 0; } else { a.phase = 'think'; a.t = 0; a.target = nextTarget(puz); puz.selected = -1; }
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
  // input, so the store pictures show actual gameplay: a lifted piece over its snap ring, a hint, a win,
  // Watch & Learn, the level select. Players never see this: a normal launch has no shot flag.
  function stageShot(n) {
    const lvIdx = (id) => LEVELS.findIndex((l) => l.id === id);
    const settle = (puz, secs) => { for (let i = 0; i < secs * 60; i++) updatePuzzle(puz, 1 / 60); puz.events.length = 0; };
    const place = (puz, ks) => { for (const k of ks) placeAtSlot(puz, k, k); puz.moves = 0; puz.hints = 0; puz.history.length = 0; settle(puz, 1.5); };
    S.shot = true;
    if (n >= 3 && n <= 4) S.lang = 'en';
    const done = ['trapezoidhouse', 'heart', 'kite', 'hat', 'arrow', 'boot', 'stairs', 'mountain', 'crown', 'hourglass', 'crescent', 'pinetree', 'cat2', 'butterfly', 'duck', 'fish'];
    done.forEach((id, i) => { S.progress.stars[id] = i % 4 === 1 ? 2 : i % 5 === 2 ? 1 : 3; });
    S.progress.solved = totalSolved(S);
    if (n === 1) { // a piece held above the finger, its snap ring showing
      startLevel(lvIdx('cat2'));
      const puz = S.puz;
      place(puz, [0, 1, 2, 3]);
      const p = puz.pieces[4];
      const [x0, y0] = puz.g.toPx([p.dx, p.dy]);
      pointerDown(puz, x0, y0);
      const slot = puz.g.poses[4];
      const [tx, ty] = puz.g.toPx(centroidOfPose(slot));
      for (let i = 1; i <= 24; i++) { pointerMove(puz, x0 + (tx - x0) * i / 24 + 34, y0 + (ty - y0) * i / 24 + 58 + 30, 0); updatePuzzle(puz, 1 / 60); }
      S.puzDown = true;
    } else if (n === 2) { // a hint: the next piece pulses and its spot lights up
      startLevel(lvIdx('runner2'));
      place(S.puz, [0, 1, 2]);
      askHint(S.puz);
      settle(S.puz, 0.3);
    } else if (n === 3) { // solved: the win card (needs about 2.2 s of play after the last piece)
      startLevel(lvIdx('lantern'));
      place(S.puz, [0, 1, 2, 3, 4, 5]);
      placeAtSlot(S.puz, 6, 6);
      S.puz.hints = 0; S.puz.stars = 3;
    } else if (n === 4) { // Watch & Learn about to place a piece
      S.thinkIdx = 0;
      startAuto();
      S.auto.k = 0;
    } else if (n === 5) { // the level select
      S.scene = 'levels';
      S.scroll.levels = 0;
    } else if (n === 7) { // the Daily Puzzle solved (used for text-zoom checks)
      S.dailyRec = { day: S.today - 1, streak: 4 };
      startDaily();
      devSolve();
    } else if (n === 8) { // the Daily Puzzle in progress
      startDaily();
      place(S.puz, [0, 1, 2]);
    } else if (n === 6) { // the same game in Chinese
      S.lang = 'zh';
      startLevel(lvIdx('crane2'));
      place(S.puz, [0, 1, 2, 3, 4]);
      const puz = S.puz;
      const p = puz.pieces[5];
      const [x0, y0] = puz.g.toPx([p.dx, p.dy]);
      pointerDown(puz, x0, y0);
      for (let i = 1; i <= 30; i++) { pointerMove(puz, x0 + 3 * i, y0 - 7 * i, 0); updatePuzzle(puz, 1 / 60); }
      S.puzDown = true;
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
    SOUNDS.ui();
  }

  function setLang(l) { S.lang = l; saveSettings(); S.scroll = {}; SOUNDS.ui(); }
  function setText(d) {
    const n = Math.min(Math.max(S.textIdx + d, 0), TEXT_SCALES.length - 1);
    if (n === S.textIdx) return;
    S.textIdx = n; saveSettings(); S.scroll = {};
  }

  function leavePlay() {
    S.puz = null; S.puzDown = false;
    if (S.daily) { S.daily = false; gotoScene('title'); } else { gotoScene('levels'); scrollToLevel(S.levelIdx); }
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
      case 'prev': S.page[S.scene] = Math.max(0, S.page[S.scene] - 1); S.scroll = {}; SOUNDS.ui(); return;
      case 'next': {
        const total = S.scene === 'rules' ? 15 : 6;
        if (S.scene === 'howto' && S.page.howto >= total - 1) { activate('play'); return; }
        S.page[S.scene] = Math.min(total - 1, S.page[S.scene] + 1); S.scroll = {}; SOUNDS.ui(); return;
      }
      case 'set:sound': S.sound = !S.sound; audio.setMuted(!S.sound); saveSettings(); if (S.sound) SOUNDS.ui(); return;
      case 'set:glow': S.glow = !S.glow; saveSettings(); return;
      case 'set:think-': S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); return;
      case 'set:think+': S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); return;
      case 'set:restore': Promise.resolve(env.monetization?.restore?.()).then(refreshOwns); return;
      case 'set:unlock': Promise.resolve(env.monetization?.purchase?.('unlock_game')).then(refreshOwns); return;
      case 'set:reset':
        if (!S.resetArm) { S.resetArm = true; return; }
        S.progress = { stars: {}, solved: 0 }; S.dailyRec = { day: -1, streak: 0 }; saveProgress(); storage.set('daily', { day: -1, streak: 0 }); S.resetArm = false; return;
      case 'ov:resume': S.overlay = null; return;
      case 'ov:restart': case 'ov:replay': S.overlay = null; if (S.daily) startDaily(); else startLevel(S.levelIdx); return;
      case 'ov:levels': S.overlay = null; leavePlay(); return;
      case 'ov:next': {
        const n = S.levelIdx + 1;
        S.overlay = null;
        if (n >= LEVELS.length) { leavePlay(); return; }
        if (demoLocked(S, n)) { S.puz = null; S.scene = 'demo-limit'; return; }
        if (levelLocked(S, n)) { leavePlay(); return; }
        startLevel(n); return;
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
    for (let n = 0; n < 8 && !puz.done; n++) {
      const t = nextTarget(puz);
      if (!t) break;
      placeAtSlot(puz, t.piece, t.slot);
    }
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
    else if (pr.kind === 'auto') { if (inRect(x, y, pr.rect)) autoAction(pr.id); }
  }

  // ---- play
  function playDown(x, y) {
    if (inRect(x, y, BACK_BTN)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: BACK_BTN }; return; }
    if (inRect(x, y, PAUSE_BTN)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: PAUSE_BTN }; return; }
    for (let i = 0; i < TOOLBAR_IDS.length; i++) {
      const r = toolRect(i);
      if (inRect(x, y, r)) { toolAction(TOOLBAR_IDS[i]); S.press = { id: `tool:${TOOLBAR_IDS[i]}`, active: true, kind: 'tool', rect: r }; return; }
    }
    S.puzDown = pointerDown(S.puz, x, y);
  }
  function hudAction(id) {
    if (id === 'hud:back') leavePlay();
    else if (id === 'hud:pause') { S.overlay = 'pause'; S.ovT = 0; }
  }
  function showToast(msg) { S.toast = msg; S.toastT = 2.2; }
  function toolAction(id) {
    const puz = S.puz;
    if (!puz || puz.done) return;
    const sel = puz.selected;
    const zh = S.lang === 'zh';
    if ((id === 'rotL' || id === 'rotR' || id === 'flip') && sel < 0) { showToast(zh ? '先点选一块板' : 'Tap a piece first'); return; }
    if (id === 'rotL') rotatePiece(puz, sel, -1);
    else if (id === 'rotR') rotatePiece(puz, sel, 1);
    else if (id === 'flip') flipPiece(puz, sel);
    else if (id === 'undo') { if (!undo(puz)) showToast(zh ? '没有可撤销的操作' : 'Nothing to undo'); }
    else if (id === 'hint') requestHint(puz);
    else if (id === 'reset') resetPieces(puz);
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
      if (has('KeyQ') || has('ArrowLeft')) toolAction('rotL');
      if (has('KeyE') || has('ArrowRight')) toolAction('rotR');
      if (has('KeyF') || has('ArrowUp')) toolAction('flip');
      if (has('KeyH')) toolAction('hint');
      if (has('KeyU')) toolAction('undo');
      if (has('KeyR')) toolAction('reset');
      if (has('Space') || has('Tab')) selectNext(S.puz);
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
      if (ev.type === 'snap' || ev.type === 'drop') {
        SOUNDS[ev.type]();
        if (ev.type === 'snap' && ev.i != null) {
          const p = puz.pieces[ev.i];
          const poly = logicalPolyPx(puz, p);
          const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length, cy = poly.reduce((s, q) => s + q[1], 0) / poly.length;
          burst(puz, cx, cy, rng, 9, ['#ffe9a8', '#fff5d0', PIECE_COLORS[p.kind]], { min: 40, max: 190, up: 40, life: 0.7, size0: 2.5, size1: 5.5 });
        }
      } else if (SOUNDS[ev.type]) SOUNDS[ev.type]();
      if (ev.type === 'win') onWin();
    }
    puz.events.length = 0;
  }

  function stepWinSeq(dt) {
    const w = S.winSeq;
    if (!w) return;
    w.t += dt;
    while (w.i < WIN_NOTES.length && w.t >= w.i * 0.13) {
      sfx({ freq: WIN_NOTES[w.i], dur: 0.35, type: 'sine', vol: 0.16 });
      sfx({ freq: WIN_NOTES[w.i] / 2, dur: 0.4, type: 'triangle', vol: 0.06 });
      w.i++;
    }
    if (w.i >= WIN_NOTES.length) S.winSeq = null;
  }

  // ------------------------------------------------------------------------------ main loop
  return {
    update(dt, input) {
      // Watch & Learn's Pause freezes the whole loop: timers, the puzzle's springs, particles and the
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
        // cancelled): drop the piece where it was last held instead of leaving it stuck to a finger that is gone.
        S.puzDown = false;
        if (S.scene === 'play') pointerUp(S.puz, S.lastPtr.x, S.lastPtr.y);
      }
      if (ptr.down || ptr.pressed) { S.lastPtr.x = ptr.x; S.lastPtr.y = ptr.y; }
      if (!S.shot && (input.keys.pressed.size || input.keys.down.size)) onKeys(input.keys);

      for (const k of Object.keys(S.scrollVel)) {
        let v = S.scrollVel[k];
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
        daily: S.daily, solved: totalSolved(S), stars: S.progress.stars, streak: S.dailyRec.streak, page: S.page, scroll: S.scroll,
        auto: S.auto ? { k: S.auto.k, phase: S.auto.phase, t: Math.round(S.auto.t * 100) / 100, paused: S.auto.paused } : null,
        puzzle: puz ? {
          id: puz.level.id, done: puz.done, hints: puz.hints, moves: puz.moves, stars: puz.stars, selected: puz.selected,
          pieces: puz.pieces.map((p) => [p.kind, p.f, p.rot, Math.round(p.cx * 1000) / 1000, Math.round(p.cy * 1000) / 1000]),
        } : null,
      };
    },

    // The preview clock counts real play only. Menus, level select, Rules / How to Play / About, Settings,
    // every overlay (pause, win, Watch & Learn summary), the demo card and Watch & Learn are all free time.
    isPreviewExempt: () => S.shot || S.scene !== 'play' || Boolean(S.overlay),
  };
}
