// Lusona Sand Drawings: state and flow. Engine = mirror.js, levels = levels.js, drawing = view.js, geometry = layout.js.
import { playLayout, titleLayout, docLayout, settingsLayout, levelsLayout, overLayout, pauseLayout, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { makeLevel, trace, hintFor, seeded } from './mirror.js';
import { LEVELS, levelSeed, tierOf, TIER_NAMES } from './levels.js';
import { render, metrics, rowsOf } from './view.js';
import { v3 } from './v3.js';
import { DOCS } from './content.js';
import { setLook, LOOK_IDS } from './ui.js';

// Fluid viewport (kit 1.7+): short side 720 units, long side follows the screen; everything lays out from the live size.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_PUZZLES = 3;
const AUTO_GAP = 0.35;
const DEFAULT_PREFS = { look: 'sand', struts: true, sound: true, calm: false, textIdx: 0, thinkIdx: 1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DAILY_SIZES = [[5, 5], [5, 6], [6, 6], [6, 7], [7, 7], [5, 7], [6, 6]];   // by weekday

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, sceneT: 1, prefs: { ...DEFAULT_PREFS },
    P: null, focus: -1, hint: null, paused: false, auto: { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, cell: -1 }, autoText: '', thinkSecs: 5,
    pop: new Map(), msg: null, flash: null, scrollY: 0, doc: { kind: 'rules', page: 0 }, back: 'title', result: null, winT: 0, winDelay: 0,
    stars: [], unlocked: 0, doneCount: 0, hasSave: false, playInfo: '', day: config.day ?? 0, days: [], streak: 0, dailyDone: false, dailyInfo: '',
    demoCount: 0, dev: config.dev === true, sfx: [],
    demo: config.demo === true, owned: !!monetization.owns?.('unlock_game'), restoreMsg: '', restoreBusy: false,
  };
  let saveRaw = null;
  monetization.onChange?.(() => { S.owned = !!monetization.owns('unlock_game'); });
  const cache = new Map();

  // ---- persistence ------------------------------------------------------------------------------------------------------------
  const applyPrefs = () => { setLook(S.prefs.look); audio.setMuted?.(!S.prefs.sound); S.thinkSecs = THINK_STEPS[S.prefs.thinkIdx]; };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveProgress = () => storage.set('progress', { stars: S.stars, days: S.days });
  function recount() {
    S.doneCount = S.stars.filter((v) => v > 0).length;
    let u = 0; while (u < LEVELS.length - 1 && (S.stars[u] ?? 0) > 0) u += 1;
    S.unlocked = u;
    const set = new Set(S.days); let streak = 0, d = set.has(S.day) ? S.day : S.day - 1;
    while (set.has(d)) { streak += 1; d -= 1; }
    S.streak = streak; S.dailyDone = set.has(S.day);
    S.dailyInfo = S.dailyDone ? 'Done today' : streak ? `${streak} day streak` : 'New every day';
    S.playInfo = S.hasSave && saveRaw ? `Level ${saveRaw.id === 'daily' ? 'Daily' : saveRaw.id + 1}` : `Level ${Math.min(S.unlocked, LEVELS.length - 1) + 1}`;
    if (S.hasSave && saveRaw) S.playInfo = saveRaw.id === 'daily' ? 'Daily Drawing' : `Level ${saveRaw.id + 1}`;
  }
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...DEFAULT_PREFS, ...v }; S.prefs.textIdx = clamp(S.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); S.prefs.thinkIdx = clamp(S.prefs.thinkIdx | 0, 0, THINK_STEPS.length - 1); if (!LOOK_IDS.includes(S.prefs.look)) S.prefs.look = 'sand'; } applyPrefs(); });
  storage.get('progress', null).then((v) => { if (v) { S.stars = (v.stars ?? []).slice(0, LEVELS.length); S.days = (v.days ?? []).slice(-200); } recount(); });
  storage.get('demoCount', 0).then((v) => { S.demoCount = Math.max(S.demoCount, v | 0); });
  storage.get('save', null).then((v) => { if (v && v.cfg && S.scene === 'title' && !S.P) { saveRaw = v; S.hasSave = true; recount(); } });
  applyPrefs(); recount();

  const persist = () => {
    const P = S.P;
    if (!P || P.done || S.auto.on) return;
    saveRaw = { id: P.id, cfg: P.cfg.slice(), moves: P.moves, hints: P.hints, undo: P.undo.slice(-60) };
    S.hasSave = true; storage.set('save', saveRaw); recount();
  };
  const clearSave = () => { saveRaw = null; S.hasSave = false; storage.remove('save'); recount(); };

  // ---- sound -----------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (S.prefs.sound) audio.tone(o); };
  const later = (t, o) => S.sfx.push({ t, o });
  const sfx = {
    flip: (loops) => tone({ freq: 300 + Math.max(0, 6 - loops) * 55, to: 250, dur: 0.07, type: 'sine', vol: 0.11 }),
    join: () => { later(0, { freq: 520, to: 560, dur: 0.1, type: 'triangle', vol: 0.09 }); later(0.08, { freq: 700, to: 740, dur: 0.12, type: 'triangle', vol: 0.09 }); },
    tap: () => tone({ freq: 640, to: 560, dur: 0.035, type: 'sine', vol: 0.06 }),
    stone: () => tone({ freq: 160, to: 120, dur: 0.1, type: 'triangle', vol: 0.08 }),
    hint: () => tone({ freq: 740, to: 988, dur: 0.18, type: 'sine', vol: 0.08 }),
    win: () => { [392, 494, 587, 784, 988].forEach((f, i) => later(i * 0.12, { freq: f, to: f, dur: 0.4, type: 'triangle', vol: 0.09 })); },
  };

  // ---- helpers -----------------------------------------------------------------------------------------------------------------
  const say = (text, hold = 2.4) => { S.msg = { text, t: 0, hold }; };
  const flash = (id) => { S.flash = { id, t: 0 }; };
  function go(scene) { S.scene = scene; S.sceneT = 0; S.scrollY = 0; wheelInput.dy = 0; S.msg = null; if (scene === 'title') recount(); }
  const L = () => playLayout(meta.width, meta.height, S.P.L.W, S.P.L.H, !!(S.hint || S.auto.on));

  // ---- levels -------------------------------------------------------------------------------------------------------------------
  function levelData(n) {
    if (cache.has(n)) return cache.get(n);
    const d = LEVELS[n];
    const lv = makeLevel(d.W, d.H, levelSeed(n), { flips: d.flips, locks: d.locks, sym: d.sym });
    cache.set(n, lv);
    return lv;
  }
  function dailyData(day) {
    const [W, H] = DAILY_SIZES[(((day + 4) % 7) + 7) % 7];
    return makeLevel(W, H, 90000 + (day % 100000), { flips: 7 + (day % 3), locks: 4 + (day % 4), sym: day % 2 ? 'turn' : 'none' });
  }
  function newSession(lv, id, title, sub) {
    return { L: lv, cfg: lv.start.slice(), moves: 0, hints: 0, undo: [], done: false, id, title, sub };
  }
  function begin(P) {
    S.P = P; S.focus = -1; S.hint = null; S.paused = false; S.msg = null; S.result = null; S.winT = 0; S.winDelay = 0; S.pop = new Map();
    S.auto = { on: false, phase: null, timer: 0, paused: false, n: 0, done: false, cell: -1 }; S.autoText = '';
    go('play');
  }
  function demoBlocked() {
    if (config.demo && S.demoCount >= DEMO_PUZZLES) { go('demo-limit'); return true; }
    if (config.demo) { S.demoCount += 1; storage.set('demoCount', S.demoCount); }
    return false;
  }
  const subOf = (n) => `${TIER_NAMES[tierOf(n)]}  ·  ${LEVELS[n].W}×${LEVELS[n].H}`;
  function startLevel(n, fresh = false) {
    n = clamp(n, 0, LEVELS.length - 1);
    if (n > S.unlocked && !S.dev) { say('Finish the level before it first.'); return; }
    if (demoBlocked()) return;
    const lv = levelData(n);
    const P = newSession(lv, n, `Level ${n + 1}`, subOf(n));
    if (!fresh && saveRaw && saveRaw.id === n && saveRaw.cfg.length === P.cfg.length) { P.cfg = saveRaw.cfg.slice(); P.moves = saveRaw.moves | 0; P.hints = saveRaw.hints | 0; P.undo = (saveRaw.undo ?? []).slice(); }
    begin(P); persist();
  }
  function startDaily() {
    if (demoBlocked()) return;
    const lv = dailyData(S.day), P = newSession(lv, 'daily', 'Daily Drawing', `${lv.W}×${lv.H}${lv.sym === 'turn' ? '  ·  half-turn picture' : ''}`);
    if (saveRaw && saveRaw.id === 'daily' && saveRaw.cfg.length === P.cfg.length) { P.cfg = saveRaw.cfg.slice(); P.moves = saveRaw.moves | 0; P.hints = saveRaw.hints | 0; P.undo = (saveRaw.undo ?? []).slice(); }
    begin(P); persist();
  }
  function playButton() {
    if (S.hasSave && saveRaw) { if (saveRaw.id === 'daily') startDaily(); else startLevel(saveRaw.id); } else startLevel(S.unlocked);
  }
  function startAuto() {
    const n = clamp(S.unlocked, 5, 17), lv = levelData(n);
    begin(newSession(lv, 'auto', 'Watch and Learn', subOf(n)));
    S.auto.on = true;
    say('Watch the game think and turn tiles until the line is one.', 2.4);
  }

  // ---- moves ---------------------------------------------------------------------------------------------------------------------
  function turn(i, record = true) {
    const P = S.P;
    if (P.L.locked[i]) { sfx.stone(); say('That tile is set in stone.', 1.4); return false; }
    const before = trace(P.L.W, P.L.H, P.cfg).count;
    P.cfg[i] = 1 - P.cfg[i];
    if (record) { P.moves += 1; P.undo.push(i); }
    S.pop.set(i, 0);
    const after = trace(P.L.W, P.L.H, P.cfg).count;
    if (after < before) sfx.join(); else sfx.flip(after);
    return true;
  }
  function checkWin() {
    const P = S.P;
    if (P.done) return;
    if (trace(P.L.W, P.L.H, P.cfg).count === 1) win();
  }
  function win() {
    const P = S.P;
    P.done = true; S.hint = null; S.winT = 1.2; S.winDelay = 2.4; sfx.win();
    if (S.auto.on) { S.auto.done = true; S.auto.phase = null; S.autoText = 'The line is one. Every dot is inside it.'; return; }
    const stars = P.moves <= P.L.par && !P.hints ? 3 : P.moves <= P.L.par + 3 ? 2 : 1;
    let first = false, daily = P.id === 'daily';
    if (!daily) { first = (S.stars[P.id] ?? 0) === 0; S.stars[P.id] = Math.max(S.stars[P.id] ?? 0, stars); }
    else if (!S.days.includes(S.day)) { S.days.push(S.day); S.days = S.days.slice(-200); }
    saveProgress(); clearSave(); recount();
    if (daily) storage.set('daily', { day: S.day, streak: S.streak });
    monetization.track('puzzle_solved', { id: String(P.id), moves: P.moves, par: P.L.par });
    S.result = { stars, moves: P.moves, par: P.L.par, hints: P.hints, daily, first, id: P.id, streak: S.streak, last: !daily && P.id >= LEVELS.length - 1 };
  }
  function doUndo() {
    const P = S.P;
    if (!P.undo.length) { say('Nothing to undo.', 1.2); return; }
    const i = P.undo.pop(); P.cfg[i] = 1 - P.cfg[i]; P.moves = Math.max(0, P.moves - 1); S.hint = null; S.pop.set(i, 0); sfx.flip(3); persist();
  }
  function doReset() {
    const P = S.P;
    P.cfg = P.L.start.slice(); P.moves = 0; P.undo = []; S.hint = null; sfx.tap(); persist();
  }

  // ---- hints (also drive Watch and Learn) -------------------------------------------------------------------------------------------
  function makeHint() {
    const P = S.P, h = hintFor(P.L, P.cfg);
    if (!h) return null;
    const verb = h.after < h.before ? `Turning this tile joins two loops, leaving ${h.after}.` : h.after > h.before ? `Turning this tile splits a loop, but the final line needs this shape. After it you will have ${h.after} loops and the answer is closer.` : 'Turning this tile reshapes a loop without changing how many there are, and brings the field closer to one line.';
    return { cell: h.cell, before: h.before, after: h.after, text: `Look at the lit tile. ${verb}` };
  }
  function askHint() {
    const h = makeHint();
    if (!h) { say('The field is already one line.'); return; }
    S.P.hints += 1; S.hint = h; sfx.hint();
  }
  function hintGo() {
    const h = S.hint;
    if (!h) return;
    S.hint = null;
    if (turn(h.cell)) { persist(); checkWin(); }
  }

  // ---- Watch and Learn ---------------------------------------------------------------------------------------------------------------
  function autoTick(dt) {
    const a = S.auto, P = S.P;
    if (a.paused || a.done) return;
    if (a.phase === 'gap') { a.timer -= dt; if (a.timer <= 0) a.phase = null; return; }
    if (a.phase === 'think') {
      a.timer -= dt;
      if (a.timer > 0) return;
      a.phase = 'reveal'; a.timer = 2;
      S.autoText = `${S.hint.text} Turning it now.`;
      return;
    }
    if (a.phase === 'reveal') {
      a.timer -= dt;
      if (a.timer > 0) return;
      const cell = S.hint.cell;
      S.hint = null; turn(cell, false); a.phase = 'gap'; a.timer = AUTO_GAP;
      checkWin();
      return;
    }
    const h = makeHint();
    if (!h) { a.done = true; return; }
    S.hint = h; a.n += 1; a.phase = 'think'; a.timer = Math.max(1, S.thinkSecs);
    S.autoText = `Step ${a.n}. There are ${h.before} loops. Which tile should turn?`;
  }

  // ---- input -----------------------------------------------------------------------------------------------------------------------------
  let gesture = null;
  function getTap(p, scrollRect) {
    if (!scrollRect) { gesture = null; return p.pressed ? { x: p.x, y: p.y } : null; }
    if (p.pressed) gesture = { x0: p.x, y0: p.y, s0: S.scrollY, moved: false, inBody: inRect(scrollRect, p.x, p.y) };
    let tap = null;
    if (gesture) {
      if (p.down && gesture.inBody) {
        const dy = p.y - gesture.y0;
        if (Math.abs(dy) > 12) gesture.moved = true;
        if (gesture.moved) S.scrollY = clamp(gesture.s0 - dy, 0, metrics.max);
      }
      if (p.released || !p.down) { if (!gesture.moved) tap = { x: gesture.x0, y: gesture.y0 }; gesture = null; }
    }
    return tap;
  }
  function hitBtn(id, r, tap) { if (inRect(r, tap.x, tap.y)) { flash(id); return true; } return false; }

  function updatePlay(dt, tap, input) {
    const P = S.P, l = L(), W = P.L.W, H = P.L.H;
    if (S.auto.on && !S.auto.paused && !S.paused) autoTick(dt);
    if (S.winDelay > 0) { S.winDelay -= dt; if (S.winDelay <= 0 && S.result) go('over'); }
    const k = input.keys.pressed;
    if (!S.auto.on && !S.paused && !P.done) {
      if (S.focus < 0 && (k.has('ArrowLeft') || k.has('ArrowRight') || k.has('ArrowUp') || k.has('ArrowDown'))) S.focus = 0;
      else if (S.focus >= 0) {
        let r = Math.floor(S.focus / W), c = S.focus % W;
        if (k.has('ArrowLeft')) c = clamp(c - 1, 0, W - 1); if (k.has('ArrowRight')) c = clamp(c + 1, 0, W - 1);
        if (k.has('ArrowUp')) r = clamp(r - 1, 0, H - 1); if (k.has('ArrowDown')) r = clamp(r + 1, 0, H - 1);
        S.focus = r * W + c;
      }
      if ((k.has('Space') || k.has('Enter')) && S.focus >= 0) { S.hint = null; if (turn(S.focus)) { persist(); checkWin(); } }
      if (k.has('KeyU')) doUndo();
      if (k.has('KeyH')) { if (S.hint) hintGo(); else askHint(); }
    }
    if (k.has('KeyP') || k.has('Escape')) { if (S.auto.on) S.auto.paused = !S.auto.paused; else if (!P.done) { S.paused = !S.paused; if (S.paused) persist(); } }
    if (!tap) return;
    if (S.paused) {
      const pl = pauseLayout(meta.width, meta.height);
      if (hitBtn('resume', pl.resume, tap)) S.paused = false;
      else if (hitBtn('restart', pl.restart, tap)) { doReset(); S.paused = false; }
      else if (hitBtn('pmenu', pl.menu, tap)) { persist(); S.paused = false; go('title'); }
      return;
    }
    const B = l.btns;
    if (S.auto.on) {
      if (hitBtn('aexit', B.a, tap)) { S.auto.on = false; S.hint = null; S.P = null; go('title'); }
      else if (hitBtn('apause', B.b, tap)) S.auto.paused = !S.auto.paused;
      else if (hitBtn('adec', B.c, tap)) { if (S.prefs.thinkIdx > 0) { S.prefs.thinkIdx -= 1; applyPrefs(); savePrefs(); } }
      else if (hitBtn('ainc', B.d, tap)) { if (S.prefs.thinkIdx < THINK_STEPS.length - 1) { S.prefs.thinkIdx += 1; applyPrefs(); savePrefs(); } }
      return;
    }
    if (P.done) { S.winDelay = Math.min(S.winDelay, 0.01); return; }
    if (S.hint && l.coachR) {
      const c = l.coachR, bh = 56, pad = 14, bw = (c.w - pad * 2 - 10) / 2, y = c.y + c.h - pad - bh;
      if (hitBtn('close', { x: c.x + pad, y, w: bw, h: bh }, tap)) { S.hint = null; return; }
      if (hitBtn('go', { x: c.x + pad + bw + 10, y, w: bw, h: bh }, tap)) { hintGo(); return; }
    }
    if (hitBtn('undo', B.a, tap)) return doUndo();
    if (hitBtn('reset', B.b, tap)) return doReset();
    if (hitBtn('hint', B.c, tap)) return S.hint ? undefined : askHint();
    if (hitBtn('pause', B.d, tap)) { S.paused = true; persist(); return; }
    const i = v3.on && v3.pick ? v3.pick(tap.x, tap.y) : l.field.at(tap.x, tap.y);
    if (i >= 0) { S.focus = -1; S.hint = null; if (turn(i)) { persist(); checkWin(); } }
  }

  function changeSetting(i, k) {
    const id = rowsOf(S)[i].id, p = S.prefs;
    switch (id) {
      case 'look': p.look = LOOK_IDS[k]; setLook(p.look); break;
      case 'struts': p.struts = k === 0; break;
      case 'sound': p.sound = k === 0; audio.setMuted?.(!p.sound); break;
      case 'calm': p.calm = k === 1; break;
      case 'restore': {
        if (S.restoreBusy || S.owned) return;
        S.restoreBusy = true; S.restoreMsg = 'Checking with the store...';
        Promise.resolve().then(() => monetization.restore()).then(() => {
          S.owned = !!monetization.owns('unlock_game');
          S.restoreMsg = S.owned ? 'Purchase restored' : 'No earlier purchase found';
        }).catch(() => { S.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { S.restoreBusy = false; });
        return;
      }
      default: break;
    }
    savePrefs(); sfx.tap();
  }
  function textScale(dir) { const n = clamp(S.prefs.textIdx + dir, 0, TEXT_SCALES.length - 1); if (n !== S.prefs.textIdx) { S.prefs.textIdx = n; S.scrollY = 0; savePrefs(); } }

  function updateScene(dt, input) {
    const p = input.pointer, scrolling = ['levels', 'doc', 'settings'].includes(S.scene);
    const tap = getTap(p, scrolling ? metrics.rect : null);
    if (scrolling) {
      if (wheelInput.dy) { S.scrollY = clamp(S.scrollY + wheelInput.dy, 0, metrics.max); wheelInput.dy = 0; }
      const k = input.keys.pressed;
      if (k.has('ArrowDown')) S.scrollY = clamp(S.scrollY + 80, 0, metrics.max);
      if (k.has('ArrowUp')) S.scrollY = clamp(S.scrollY - 80, 0, metrics.max);
      S.scrollY = clamp(S.scrollY, 0, metrics.max);
    }
    const sc = S.scene, w = meta.width, h = meta.height;
    if (sc === 'play') return updatePlay(dt, tap, input);
    if (sc === 'title') {
      if (!tap) { if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) playButton(); return; }
      const t = titleLayout(w, h), B = t.buttons;
      for (const id of Object.keys(B)) if (hitBtn(id, B[id], tap)) {
        sfx.tap();
        if (id === 'play') playButton();
        else if (id === 'levels') go('levels');
        else if (id === 'daily') startDaily();
        else if (id === 'learn') startAuto();
        else if (id === 'howto' || id === 'rules' || id === 'about') { S.doc = { kind: id, page: 0 }; go('doc'); }
        else if (id === 'settings') { S.back = 'title'; go('settings'); }
        return;
      }
      if (Math.abs(tap.x - t.brand.x) < 260 && Math.abs(tap.y - t.brand.y) < 26) env.openArcforgeHome?.();
      return;
    }
    if (sc === 'levels') {
      const LL = levelsLayout(w, h, LEVELS.length);
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (!tap) return;
      if (hitBtn('back', LL.back, tap)) { go('title'); return; }
      if (hitBtn('tdec', LL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', LL.textInc, tap)) return textScale(1);
      if (inRect(LL.body, tap.x, tap.y)) {
        LEVELS.forEach((_, i) => { const r = { ...LL.tiles[i], y: LL.tiles[i].y - S.scrollY }; if (inRect(r, tap.x, tap.y)) { sfx.tap(); startLevel(i); } });
      }
      return;
    }
    if (sc === 'doc') {
      const DL = docLayout(w, h), n = DOCS[S.doc.kind].pages.length;
      if (input.keys.pressed.has('Escape')) { go('title'); return; }
      if (input.keys.pressed.has('ArrowRight') && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      if (input.keys.pressed.has('ArrowLeft') && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      if (!tap) return;
      if (hitBtn('back', DL.menu, tap)) go('title');
      else if (hitBtn('prev', DL.prev, tap) && S.doc.page > 0) { S.doc.page -= 1; S.scrollY = 0; }
      else if (hitBtn('next', DL.next, tap) && S.doc.page < n - 1) { S.doc.page += 1; S.scrollY = 0; }
      else if (hitBtn('tdec', DL.textDec, tap)) textScale(-1);
      else if (hitBtn('tinc', DL.textInc, tap)) textScale(1);
      return;
    }
    if (sc === 'settings') {
      const rows = rowsOf(S), SL = settingsLayout(w, h, TEXT_SCALES[S.prefs.textIdx], rows.length);
      const leave = () => { if (S.back === 'play' && S.P) { S.scene = 'play'; S.sceneT = 1; S.scrollY = 0; } else go('title'); };
      if (input.keys.pressed.has('Escape')) { leave(); return; }
      if (!tap) return;
      if (hitBtn('back', SL.back, tap)) return leave();
      if (hitBtn('tdec', SL.textDec, tap)) return textScale(-1);
      if (hitBtn('tinc', SL.textInc, tap)) return textScale(1);
      if (inRect(SL.body, tap.x, tap.y)) {
        const ty = tap.y + S.scrollY;
        rows.forEach((row, i) => {
          const g = SL.rows[i], n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
          for (let k = 0; k < n; k++) { const r = { x: g.ctrl.x + k * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }; if (inRect(r, tap.x, ty)) { flash('set' + i + '.' + k); changeSetting(i, k); } }
        });
      }
      return;
    }
    if (sc === 'over') {
      const O = overLayout(w, h);
      if (!tap) return;
      const R0 = S.result;
      if (hitBtn('next', O.next, tap)) { if (R0.daily) go('title'); else if (R0.last) go('levels'); else startLevel(R0.id + 1, true); }
      else if (hitBtn('share', O.again, tap)) env.share(`Lusona Sand Drawings ${R0.daily ? 'Daily Drawing' : 'level ' + (R0.id + 1)}: one closed line in ${R0.moves} moves, ${R0.stars} star${R0.stars === 1 ? '' : 's'}.`);
      else if (hitBtn('menu', O.menu, tap)) { if (R0.daily) go('levels'); else go('title'); }
      return;
    }
    if (sc === 'demo-limit' && tap) go('title');
  }

  return {
    update(dt, input) {
      S.t += dt; S.sceneT += dt;
      if (S.flash) { S.flash.t += dt; if (S.flash.t > 0.25) S.flash = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold) S.msg = null; }
      const frozen = S.paused || (S.auto.on && S.auto.paused);
      if (!frozen) {
        for (const [c, a] of S.pop) { if (a + dt > 0.4) S.pop.delete(c); else S.pop.set(c, a + dt); }
        if (S.winT > 0) S.winT -= dt;
        for (const q of S.sfx) q.t -= dt;
        const due = S.sfx.filter((q) => q.t <= 0); if (due.length) { S.sfx = S.sfx.filter((q) => q.t > 0); for (const q of due) tone(q.o); }
      }
      if (S.scene === 'play') {
        const l = L();
        meta.previewBadge = l.land ? { x: l.hud.x, y: l.hud.y + l.hud.h + 4, align: 'left' } : null;
      } else meta.previewBadge = null;
      updateScene(dt, input);
    },
    render(ctx, view) { ctx.clearRect(0, 0, (view ?? meta).width, (view ?? meta).height); render(ctx, S, view ?? meta); },
    getState: () => S,
    // Counts real play only: a live drawing in progress. Menus, Rules, settings, Watch and Learn, pause, results are free.
    isPreviewExempt() { return !(S.scene === 'play' && !S.auto.on && !S.paused && S.P && !S.P.done); },
    // Tester/screenshot hooks (only wired up in dev: see main.js).
    dev: {
      go: (scene, extra) => { Object.assign(S, extra ?? {}); go(scene); },
      start: (n) => { S.dev = true; startLevel(n, true); }, daily: () => startDaily(), auto: () => startAuto(), hint: () => askHint(),
      solveNow: () => { const P = S.P; P.cfg = P.L.sol.slice(); P.moves = P.L.par; win(); }, skipOver: () => { S.winDelay = 0.01; },
      doc: (kind, page = 0) => { S.doc = { kind, page }; go('doc'); },
      unlock: (n) => { for (let i = 0; i < n; i++) S.stars[i] = S.stars[i] || 2; recount(); },
      layout: () => { const l = L(); return { land: l.land, field: l.field.box, btns: l.btns, w: meta.width, h: meta.height }; },
    },
  };
}
