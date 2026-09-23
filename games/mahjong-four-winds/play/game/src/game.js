// Mahjong (Hong Kong style): state and flow. See design/GDD.md for the rules and design/ARCHITECTURE.md for the map.
//   rules.js    the rule book (pure)              flow.js    turn loop helpers shared with tests
//   ai.js       computer players + hints          play.js    a hand at the table: turn machine, input, tile motion
//   layout.js   table geometry                    view.js    table drawing        draw.js  shared drawing, tiles.js tile art
//   screens.js  menus, lessons, daily             lessons.js / puzzles.js / content.js  content as data
// This file: scenes, settings, storage, sound, lessons and the daily challenge.
import { W, H, inRect, TEXT_SCALES, AUTO_THINK_STEPS } from './layout.js';
import { createPlay } from './play.js';
import { renderPlay, renderResult, renderMatchEnd, MATCHEND_BTNS } from './view.js';
import { LESSONS, fakeState, withDraw, classify, NEED_COUNT, textOf } from './lessons.js';
import { makePuzzle } from './puzzles.js';
import { fullHand, winInfo, kindName } from './rules.js';
import { STYLES, setLang } from './tiles.js';
import { GOLD, tx, DISPLAY } from './draw.js';
import * as SC from './screens.js';

export const meta = { width: W, height: H };
const DEMO_HANDS = 3;
const PREF_DEFAULTS = { level: 1, sound: true, calm: false, big: false, style: 'traditional', lang: 'zh', timer: true, pace: 'normal', minFan: 1, hints: true, textScaleIdx: 0, autoThinkIdx: 1 };

const SFX = {
  click: [[0, { freq: 1700, to: 800, dur: 0.03, type: 'triangle', vol: 0.1 }]],
  clack: [[0, { freq: 1200, to: 300, dur: 0.06, type: 'square', vol: 0.05 }], [0, { freq: 190, to: 90, dur: 0.09, type: 'sine', vol: 0.2 }], [0.045, { freq: 900, to: 250, dur: 0.04, type: 'triangle', vol: 0.08 }]],
  draw: [[0, { freq: 900, to: 600, dur: 0.04, type: 'triangle', vol: 0.06 }]],
  claim: [[0, { freq: 520, dur: 0.09, type: 'triangle', vol: 0.14 }], [0.09, { freq: 780, dur: 0.14, type: 'triangle', vol: 0.14 }]],
  win: [523, 659, 784, 1046, 1318].map((f, i) => [i * 0.11, { freq: f, dur: 0.3, type: 'triangle', vol: 0.15 }]),
  lose: [[0, { freq: 300, to: 200, dur: 0.25, type: 'sine', vol: 0.12 }]],
  wash: [[0, { freq: 330, to: 260, dur: 0.3, type: 'sine', vol: 0.1 }]],
  bad: [[0, { freq: 200, to: 140, dur: 0.14, type: 'sawtooth', vol: 0.07 }]],
  good: [[0, { freq: 660, dur: 0.08, type: 'triangle', vol: 0.12 }], [0.08, { freq: 990, dur: 0.16, type: 'triangle', vol: 0.12 }]],
  shuffle: Array.from({ length: 30 }, (_, i) => [(((i * 37) % 100) / 100) * 1.3, { freq: 600 + ((i * 137) % 500), to: 200, dur: 0.04, type: 'triangle', vol: 0.06 }]),
};

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, prefs: { ...PREF_DEFAULTS }, stats: { played: 0, wins: 0, bestFan: 0, hands: 0 }, learned: {},
    daily: { day: config.day ?? 0, results: [null, null, null], streak: 0, doneDay: -1 }, demoHands: 0,
    match: null, h: null, ui: null, matchWins: 0, saved: null, page: 0, lesson: null, lessonPlay: false, kb: false, cursorId: -1, dev: config.dev === true,
  };
  const vis = new Map(), rs = { vis, ptr: { x: 0, y: 0, down: false }, T: new Map(), cursorPos: null };
  const sq = [];
  const puzzles = [];
  let pd = null;                                                 // where the current press started

  // Auto Play plays itself continuously with no player to hear it for - silent by design,
  // regardless of the real Sound preference, the same way the menu's own attract-mode preview
  // (and every other game's Auto Play mode) is silent.
  const sfx = (name) => { if (!S.prefs.sound || S.scene === 'auto') return; for (const [dt, o] of SFX[name]) sq.push({ at: S.t + dt, o }); };
  const say = (text, hold = 4, warn = false) => { if (S.ui) S.ui.msg = { text, t: 0, hold, warn }; };
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveLearned = () => storage.set('learned', S.learned);
  const saveDaily = () => storage.set('daily', { day: S.daily.day, results: S.daily.results, streak: S.daily.streak, doneDay: S.daily.doneDay });
  const toTitle = () => { S.scene = 'title'; S.page = 0; };

  // ---- load saved data (never blocks play)
  storage.get('prefs', null).then((v) => {
    if (v) { S.prefs = { ...PREF_DEFAULTS, ...v }; audio.setMuted?.(!S.prefs.sound); }
    // Clamp: a saved index from a build with a longer/shorter TEXT_SCALES array must never survive
    // and produce NaN font sizes on the About/How to play/Rules pages.
    S.prefs.textScaleIdx = Math.min(Math.max(S.prefs.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1);
    S.prefs.autoThinkIdx = Math.min(Math.max(S.prefs.autoThinkIdx ?? 1, 0), AUTO_THINK_STEPS.length - 1);
  });
  storage.get('stats', null).then((v) => { if (v) S.stats = { ...S.stats, ...v }; });
  storage.get('learned', {}).then((v) => { S.learned = { ...v, ...S.learned }; });
  storage.get('demoHands', 0).then((v) => { S.demoHands = Math.max(S.demoHands, v); });
  storage.get('daily', null).then((v) => {
    if (!v) return;
    S.daily.streak = v.streak ?? 0; S.daily.doneDay = v.doneDay ?? -1;
    if (v.day === S.daily.day) S.daily.results = v.results ?? S.daily.results;
    else if (S.daily.doneDay < S.daily.day - 1) S.daily.streak = 0;
  });
  storage.get('save', null).then((v) => { if (v && v.h && v.match && S.scene === 'title') S.saved = v; });

  const play = createPlay({ S, rng, sfx, say, storage, vis, rs, config, monetization, audio, savePrefs, toTitle, startAutoMatch: () => startAutoMatch(), demoHands: DEMO_HANDS, lessonPlayDone: () => { S.lessonPlay = false; S.learned[LESSONS.length - 1] = true; saveLearned(); S.scene = 'learn'; } });

  function startMatch(mode, levels) {
    if (config.demo && S.demoHands >= DEMO_HANDS) { S.scene = 'demo-limit'; return; }
    const L = S.prefs.level;
    S.match = { mode, dealer: 0, rot: 0, hand: 1, repeats: 0, scores: [0, 0, 0, 0], levels: levels ?? [0, L, L, L], next: null };
    S.matchWins = 0; S.scene = 'play'; S.kb = false;
    play.startHand();
    monetization.track('match_start', { mode, level: L });
  }

  // Auto Play ("Watch & Learn"): a full, free, silent hand where every seat - including seat 0 - is
  // driven by ai.js's own chooseDiscard/chooseClaim/chooseKong (via createPlay's THINK/REVEAL/ACT
  // gate), reusing the exact same turn machine, animation and scoring as normal play. A NEW scene
  // ('auto'), never touching normal play/lesson/puzzle state, real save, stats or progress. Not
  // gated by the free-preview/demo-hand limits: it is a teaching/marketing tool, not real play.
  const AUTO_LEVEL = 2;
  function startAutoMatch() {
    S.match = { mode: 'auto', dealer: 0, rot: 0, hand: 1, repeats: 0, scores: [0, 0, 0, 0], levels: [AUTO_LEVEL, AUTO_LEVEL, AUTO_LEVEL, AUTO_LEVEL], next: null };
    S.matchWins = 0; S.scene = 'auto'; S.kb = false;
    play.startHand();
  }

  // ------------------------------------------------------------------------------------------------ lessons
  function startLesson(i) { S.lesson = { i, si: 0, daily: false }; S.scene = 'lesson'; loadStep(); }
  function loadStep() {
    const L = S.lesson, list = L.daily ? null : LESSONS[L.i].steps, st = L.daily ? L.step : list[L.si];
    Object.assign(L, { step: st, sel: [], locked: false, done: false, msg: null, msgGood: false, wrongT: 0, wrongIdx: -1, hintIdx: -1, fails: 0, prompt: null, info: null, clearAt: 0, lastStep: L.daily ? false : L.si === list.length - 1, canHint: false });
    if (st.type === 'play') { S.lessonPlay = true; startMatch('hand', [0, 0, 0, 0]); return; }
    if (st.hand) { L.hand = st.hand.slice().sort((a, b) => a - b); L.draw = st.draw ?? -1; }
    if (st.type === 'score') {
      const all = st.hand.slice(), draw = all.pop(); L.hand = all.sort((a, b) => a - b); L.draw = draw;
      const fs = fakeState(L.hand); withDraw(fs, draw); L.info = winInfo(fs, 0, fullHand(fs, 0), true);
    }
    L.canHint = ['discard', 'claim', 'win', 'pick', 'tap'].includes(st.type);
  }
  const lessonMsg = (text, good = false) => { S.lesson.msg = text; S.lesson.msgGood = good; };
  function lessonSuccess(text) { const L = S.lesson; L.done = true; L.locked = true; lessonMsg(text, true); sfx('good'); }
  function lessonWrong(text, idx = -1) { const L = S.lesson; L.fails++; lessonMsg(text); L.wrongT = 0.8; L.wrongIdx = idx; sfx('bad'); }
  function lessonNext() {
    const L = S.lesson;
    if (L.daily) { dailyNext(); return; }
    L.si++;
    if (L.si >= LESSONS[L.i].steps.length) { S.learned[L.i] = true; saveLearned(); S.scene = 'learn'; monetization.track('lesson_done', { lesson: L.i }); return; }
    loadStep();
  }
  function lessonHint() {
    const L = S.lesson, st = L.step; sfx('click');
    if (st.type === 'tap') { const sc = SC.lessonScene(S); const t = sc.tiles.find((x) => st.want.includes(x.kind)); L.hintIdx = t ? t.idx : -1; lessonMsg('Try the glowing tile.'); }
    else if (st.type === 'discard') {
      const w = st.wantAny ?? st.want ?? [];
      const idx = L.hand.findIndex((k) => w.includes(k)); L.hintIdx = idx >= 0 ? idx : (w.includes(L.draw) ? L.hand.length : -1);
      const wrong = textOf(st.wrong, S.prefs.lang);
      lessonMsg(typeof wrong === 'object' ? wrong.default : 'Discard the glowing tile.');
    } else { const wrong = textOf(st.wrong, S.prefs.lang); lessonMsg(typeof wrong === 'string' ? wrong : 'Follow the prompt above.'); }
  }

  function lessonTap(x, y, dragUp) {
    const L = S.lesson, st = L.step, sc = SC.lessonScene(S);
    if (inRect(SC.LESSON_BACK, x, y)) { S.scene = L.daily ? 'daily' : 'learn'; return; }
    if (L.canHint && inRect(SC.LESSON_HINT, x, y) && !L.done) { lessonHint(); return; }
    if ((L.done || st.type === 'info' || st.type === 'score') && inRect(SC.LESSON_NEXT, x, y)) { lessonNext(); return; }
    for (const o of sc.buttons) if (inRect(o.r, x, y) && !L.done) {
      if (st.type === 'win') { lessonSuccess('You won! Drawing the winning tile yourself scores extra.'); return; }
      if (o.id === st.want) lessonSuccess(st.want === 'pass' ? 'Right: no claim, play on.' : st.want === 'win' ? 'You won on a discard!' : `Yes! You took the ${st.want}. It is now a face-up set.`);
      else lessonWrong(st.want === 'pass' ? 'That is not needed here. Tap Pass.' : textOf(st.wrong, S.prefs.lang));
      return;
    }
    if (L.done) return;
    const hit = sc.tiles.find((t) => Math.abs(x - t.x) <= t.w / 2 + 2 && y >= t.y - t.w * 0.67 - 4 && y <= t.y + t.w * 0.67 + (t.hand ? 24 : 8));
    if (!hit) return;
    if (st.type === 'tap') {
      if (st.want.includes(hit.kind)) lessonSuccess(`Yes: the ${kindName(hit.kind)}.`); else lessonWrong(`That is the ${kindName(hit.kind)}. ${textOf(st.wrong, S.prefs.lang)}`, hit.idx);
    } else if (st.type === 'pick') {
      const need = NEED_COUNT[st.need], i = L.sel.indexOf(hit.idx);
      if (i >= 0) L.sel.splice(i, 1); else L.sel.push(hit.idx);
      sfx('click');
      if (L.sel.length === need) {
        const kinds = L.sel.map((idx) => sc.tiles.find((t) => t.idx === idx).kind);
        if (classify(kinds) === st.need) lessonSuccess(`Yes: that is a ${st.need}.`);
        else { lessonWrong(textOf(st.wrong, S.prefs.lang)); L.clearAt = 0.7; }
      }
    } else if (st.type === 'discard' || st.type === 'win') {
      if (!hit.hand) return;
      if (st.type === 'win') { lessonWrong('You can already win: tap the gold Win! button instead.'); return; }
      if (L.sel.includes(hit.idx) || dragUp) {
        const w = st.wantAny ?? st.want;
        L.sel = [];
        if (L.daily) { dailyAnswer(hit.kind); return; }
        if (w.includes(hit.kind)) lessonSuccess(`Well done. You discarded the ${kindName(hit.kind)}: it fitted nothing, so your hand stays tidy.`);
        else { const wrong = textOf(st.wrong, S.prefs.lang); lessonWrong(typeof wrong === 'object' ? (wrong[hit.kind] ?? wrong.default) : wrong); }
      } else { L.sel = [hit.idx]; sfx('click'); if (!L.msg || L.msgGood) lessonMsg(`${kindName(hit.kind)}. TAP it again, or DRAG it up, to discard.`); }
    } else if (st.type === 'claim') { if (hit.hand) lessonMsg('First choose: claim the tile with a button, or Pass.'); }
  }

  // ------------------------------------------------------------------------------------------------ daily
  function dailyStart() {
    const d = S.daily; let pi = d.results.findIndex((r) => r === null); if (pi < 0) { d.results = [null, null, null]; pi = 0; }
    dailyOpen(pi);
  }
  function dailyOpen(pi) {
    if (!puzzles[pi] || puzzles[pi].day !== S.daily.day) puzzles[pi] = { day: S.daily.day, ...makePuzzle(S.daily.day, pi) };
    const p = puzzles[pi];
    S.lesson = { daily: true, pi, si: pi, i: -1, step: { type: 'discard', hand: p.hand, draw: p.draw, want: [p.best], text: '' } };
    S.scene = 'lesson'; loadStep();
    S.lesson.prompt = 'You just drew a tile. Which tile do you discard? TAP a tile to lift it, TAP it again (or DRAG up) to discard.'; S.lesson.canHint = false;
  }
  function dailyAnswer(kind) {
    const L = S.lesson, p = puzzles[L.pi], ok = kind === p.best;
    if (S.daily.results[L.pi] === null) S.daily.results[L.pi] = ok;
    if (ok) lessonSuccess(`Correct. ${p.text}`); else { L.done = true; L.locked = true; lessonMsg(`Not the best. You discarded the ${kindName(kind)}. ${p.text}`); sfx('bad'); }
    saveDaily();
    const d = S.daily;
    if (d.results.every((r) => r !== null) && d.doneDay !== d.day) { d.streak = d.doneDay === d.day - 1 ? d.streak + 1 : 1; d.doneDay = d.day; saveDaily(); }
  }
  function dailyNext() { const L = S.lesson; if (L.pi < 2) dailyOpen(L.pi + 1); else S.scene = 'daily'; }

  // ------------------------------------------------------------------------------------------------ input for the menu scenes
  function menuTap(x, y) {
    const sc = S.scene;
    if (sc === 'title') {
      for (const b of SC.titleRects(S)) if (inRect(b.r, x, y)) {
        sfx('click');
        if (b.chip !== undefined) { S.prefs.level = b.chip; savePrefs(); return; }
        if (b.lang !== undefined) { S.prefs.lang = b.lang; savePrefs(); return; }
        if (b.id === 'continue') { play.resume(S.saved); S.scene = 'play'; return; }
        if (b.id === 'round') { S.saved = null; storage.remove('save'); startMatch('round'); return; }
        if (b.id === 'hand') { S.saved = null; storage.remove('save'); startMatch('hand'); return; }
        if (b.id === 'learn') { S.scene = 'learn'; return; }
        if (b.id === 'daily') { S.scene = 'daily'; return; }
        if (b.id === 'how') { S.scene = 'how'; S.page = 0; return; }
        if (b.id === 'about') { S.scene = 'about'; S.page = 0; return; }
        if (b.id === 'rules') { S.scene = 'rules'; S.page = 0; return; }
        if (b.id === 'auto') { startAutoMatch(); return; }
        if (b.id === 'settings') { S.scene = 'settings'; return; }
      }
    } else if (sc === 'settings') {
      if (inRect(SC.BACK, x, y)) { toTitle(); return; }
      for (const b of SC.settingsLangRects()) if (inRect(b.r, x, y)) { sfx('click'); S.prefs.lang = b.lang; savePrefs(); return; }
      SC.SETTINGS.forEach((s, i) => {
        if (!inRect(SC.settingRect(i), x, y)) return;
        const p = S.prefs; sfx('click');
        if (s.id === 'pace') p.pace = p.pace === 'fast' ? 'normal' : 'fast';
        else if (s.id === 'minFan') p.minFan = p.minFan === 1 ? 3 : 1;
        else if (s.id === 'style') p.style = STYLES[(STYLES.indexOf(p.style) + 1) % STYLES.length];
        else p[s.id] = !p[s.id];
        if (s.id === 'sound') audio.setMuted?.(!p.sound);
        savePrefs();
      });
    } else if (sc === 'how' || sc === 'about' || sc === 'rules') {
      const n = SC.pageCount(sc), hasPrev = S.page > 0, hasNext = S.page < n - 1;
      const P = SC.pagerRects(hasPrev, hasNext);
      if (hasPrev && inRect(P.prev, x, y)) S.page--;
      else if (hasNext && inRect(P.next, x, y)) S.page++;
      else if (inRect(P.back, x, y)) toTitle();
      else if (inRect(SC.TEXT_STEPPER.dec, x, y) && S.prefs.textScaleIdx > 0) { S.prefs.textScaleIdx--; savePrefs(); sfx('click'); }
      else if (inRect(SC.TEXT_STEPPER.inc, x, y) && S.prefs.textScaleIdx < TEXT_SCALES.length - 1) { S.prefs.textScaleIdx++; savePrefs(); sfx('click'); }
    } else if (sc === 'learn') {
      if (inRect(SC.LEARN_BACK, x, y)) { toTitle(); return; }
      LESSONS.forEach((_, i) => { if (inRect(SC.lessonRect(i), x, y)) { sfx('click'); startLesson(i); } });
    } else if (sc === 'daily') {
      if (inRect(SC.DAILY_RECTS.back, x, y)) toTitle(); else if (inRect(SC.DAILY_RECTS.play, x, y)) dailyStart();
    } else if (sc === 'matchend') {
      if (inRect(MATCHEND_BTNS.again, x, y)) startMatch(S.match.mode);
      else if (inRect(MATCHEND_BTNS.menu, x, y)) toTitle();
    } else if (sc === 'demo-limit') { if (inRect(SC.DEMO_MENU, x, y)) toTitle(); }
  }

  function menuKeys(keys) {
    if (!keys || !keys.pressed || !keys.pressed.size) return;
    const p = (c) => keys.pressed.has(c);
    if (S.scene === 'title' && (p('Enter') || p('Space'))) { if (S.saved) { play.resume(S.saved); S.scene = 'play'; } else startMatch('round'); }
    else if ((S.scene === 'how' || S.scene === 'about' || S.scene === 'rules') && (p('ArrowRight') || p('Enter'))) { if (S.page < SC.pageCount(S.scene) - 1) S.page++; else toTitle(); }
    else if ((S.scene === 'how' || S.scene === 'about' || S.scene === 'rules') && p('ArrowLeft')) S.page = Math.max(0, S.page - 1);
    else if (p('Escape') && ['settings', 'how', 'about', 'rules', 'learn', 'daily'].includes(S.scene)) toTitle();
    else if (S.scene === 'lesson' && (p('Enter') || p('Space')) && (S.lesson.done || ['info', 'score'].includes(S.lesson.step.type))) lessonNext();
  }

  // ------------------------------------------------------------------------------------------------ frame
  function update(dt, input) {
    S.t += dt;
    const ptr = input.pointer; rs.ptr.x = ptr.x; rs.ptr.y = ptr.y; rs.ptr.down = ptr.down;
    for (let i = sq.length - 1; i >= 0; i--) if (sq[i].at <= S.t) { audio.tone(sq[i].o); sq.splice(i, 1); }
    if (ptr.pressed) pd = { x: ptr.x, y: ptr.y };
    if (S.scene === 'play' || S.scene === 'auto') { play.update(dt, input); return; }
    if (S.scene === 'lesson') {
      const L = S.lesson;
      if (L.wrongT > 0) L.wrongT -= dt;
      if (L.clearAt > 0) { L.clearAt -= dt; if (L.clearAt <= 0) L.sel = []; }
    }
    if (input.keys) menuKeys(input.keys);
    if (ptr.released && pd) {
      const start = pd; pd = null;
      if (S.scene === 'lesson') lessonTap(ptr.x, ptr.y, ptr.y - start.y < -70 && Math.abs(ptr.x - start.x) < 60);
      else if (Math.hypot(ptr.x - start.x, ptr.y - start.y) < 40) menuTap(ptr.x, ptr.y);
    }
  }

  function render(ctx) {
    setLang(S.prefs.lang);
    const sc = S.scene;
    if (sc === 'play' || sc === 'auto') {
      renderPlay(ctx, S, rs);
      const ui = S.ui;
      if (ui.call) {
        const c = ui.call, a = Math.min(1, c.t * 6) * Math.max(0, 1 - Math.max(0, c.t - 0.9) / 0.5), pos = [[360, 1030], [560, 720], [360, 400], [160, 720]][c.seat];
        ctx.save(); ctx.globalAlpha = a; const s = 1 + (1 - Math.min(1, c.t * 5)) * 0.5;
        ctx.translate(pos[0], pos[1]); ctx.scale(s, s);
        tx(ctx, c.text, 0, 0, c.text.length > 6 ? 70 : 84, GOLD, { font: DISPLAY, shadow: true }); ctx.restore();
      }
      if (ui.ph === 'result') renderResult(ctx, S, rs);
      if (ui.pause) SC.renderPause(ctx, S, rs);
    } else if (sc === 'title') SC.renderTitle(ctx, S, rs);
    else if (sc === 'settings') SC.renderSettings(ctx, S, rs);
    else if (sc === 'how') SC.renderHow(ctx, S, rs);
    else if (sc === 'about') SC.renderAbout(ctx, S, rs);
    else if (sc === 'rules') SC.renderRules(ctx, S, rs);
    else if (sc === 'learn') SC.renderLearn(ctx, S, rs);
    else if (sc === 'daily') SC.renderDailyHub(ctx, S, rs);
    else if (sc === 'lesson') SC.renderLesson(ctx, S, rs);
    else if (sc === 'matchend') renderMatchEnd(ctx, S, rs);
    else if (sc === 'demo-limit') SC.renderDemoLimit(ctx, S);
  }

  // Auto Play is a free teaching/marketing demo, not real play: kit 1.6.1's preview gate skips both
  // time-accrual and the countdown badge while this is true, so watching it never eats into (or
  // shows) the paid-unlock free-preview timer.
  return { update, render, getState: () => S, isPreviewExempt: () => S.scene === 'auto' };
}
