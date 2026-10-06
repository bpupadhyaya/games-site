// GAME CONTRACT (docs/GAME-CONTRACT.md). Kolam: draw one unbroken line around every dot. 72 patterns, a solver behind Think and Watch & Learn,
// a Learn path, a daily pattern and a free-draw Sandbox with mirrors.
import { inRect, hudOf, playLayout, autoLayout, sandboxLayout, setScreen } from './layout.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, THINK_STEPS, DEMO_PUZZLES, chapterStats } from './screens.js';
import { CHAPTERS, ALL_IDS, chapterIds, puzzleById, chapterOf, lessonPuzzle, LESSON_COUNT, orderOf } from './puzzles.js';
import { THEMES } from './art.js';
import { RULE_COUNT, HOWTO_COUNT, STR as X } from './content.js';
import { boardGeo, toUnit, patternSeq } from './boardview.js';
import * as P from './play.js';
import { SB_GRIDS, makeSandbox, pressSb, moveSb, releaseSb, undoSb, clearSb, weave, encodeSb, decodeSb, modeOf, drawnCount } from './sandbox.js';
import { render } from './view.js';

// Fluid viewport (kit 1.7.x): the short side is always 720 units, the long side follows the screen; the kit keeps meta.width/height live and
// every rectangle comes from layout.js for that size.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };

const VERSION = '1.1.0';
const AUTO_PUZZLES = ['p1-4', 'p1-5', 'p2-3'];
const ATTRACT_PUZZLE = 'p2-3';
const STRAY_PX = 260;
const NOTES = [0, 2, 4, 7, 9, 12, 14, 16];
const NAMES = [523.25, 587.33, 659.25, 783.99, 880.0];

export async function createGame(env) {
  const { rng, storage, audio, config } = env;
  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0, sound: true, themeId: 'stone', textIdx: 0, thinkIdx: 1, check: false,
    results: {}, saves: {}, openIds: {}, lastId: null, lessons: {}, daily: { streak: 0, last: -1 }, demoIds: [], demoCount: 0,
    page: { howto: 0, rules: 0 }, scroll: {}, scrollVel: {}, press: null, match: null, auto: null, chapterIdx: 0, lessonIdx: 0, endInfo: null,
    demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, price: '', resetArm: false, version: env.manifest?.version || VERSION, shot: false, lastPtr: { x: 0, y: 0 },
    cont: null, dailyDone: false, dailyId: null, attract: null, kbd: false, sb: null, sbClearArm: 0,
  };

  const [set, res, openIds, last, les, daily, dem, sbv] = await Promise.all([
    storage.get('kl.settings', null), storage.get('kl.res', null), storage.get('kl.open', null), storage.get('kl.last', null),
    storage.get('kl.lessons', null), storage.get('kl.daily', null), storage.get('kl.demo', null), storage.get('kl.sb', null),
  ]);
  if (set) {
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (typeof set.check === 'boolean') S.check = set.check;
    if (THEMES.some((t) => t.id === set.themeId)) S.themeId = set.themeId;
    if (Number.isInteger(set.textIdx)) S.textIdx = Math.min(Math.max(set.textIdx, 0), TEXT_SCALES.length - 1);
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = Math.min(Math.max(set.thinkIdx, 0), THINK_STEPS.length - 1);
  }
  if (res && typeof res === 'object') S.results = res;
  if (les && typeof les === 'object') S.lessons = les;
  if (daily && Number.isInteger(daily.streak) && Number.isInteger(daily.last)) S.daily = daily;
  if (Array.isArray(dem)) { S.demoIds = dem.filter((x) => typeof x === 'string'); S.demoCount = S.demoIds.length; }
  if (typeof last === 'string') S.lastId = last;
  if (openIds && typeof openIds === 'object') {
    for (const id of Object.keys(openIds)) {
      const sv = await storage.get(`kl.s.${id}`, null);
      const p = puzzleById(id);
      if (sv && p && P.restore(P.makeMatch(p), sv)) { S.saves[id] = sv; S.openIds[id] = 1; }
    }
  }
  if (sbv) S.sb = decodeSb(sbv);
  audio.setMuted(!S.sound);
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);

  const today = () => (Number.isInteger(config?.day) ? config.day : 0);
  const dailyId = (day) => { const pool = ALL_IDS.filter((id) => chapterOf(id) >= 1 && chapterOf(id) <= 4); return pool[(Math.imul(day, 2654435761) >>> 0) % pool.length]; };
  const refreshMeta = () => {
    S.dailyId = dailyId(today());
    S.dailyDone = S.daily.last === today();
    const id = S.lastId && S.saves[S.lastId] ? S.lastId : Object.keys(S.saves)[0];
    if (id) {
      const p = puzzleById(id), M = P.makeMatch(p);
      P.restore(M, S.saves[id]);
      S.cont = { id, name: `Pattern ${orderOf(id)}`, pct: Math.min(99, Math.round((M.T.arcs.length / p.nArc) * 100)) };
    } else S.cont = null;
  };
  {
    const p = puzzleById(ATTRACT_PUZZLE);
    S.attract = { puz: p, seq: patternSeq(p.B, p.sol) };
  }
  refreshMeta();

  const saveSettings = () => storage.set('kl.settings', { sound: S.sound, themeId: S.themeId, textIdx: S.textIdx, thinkIdx: S.thinkIdx, check: S.check });
  const saveRes = () => { storage.set('kl.res', S.results); storage.set('kl.progress', { patterns: Object.values(S.results).filter((v) => v > 0).length, stars: Object.values(S.results).reduce((a, b) => a + b, 0) }); };
  const saveSb = () => { if (S.sb) storage.set('kl.sb', encodeSb(S.sb)); };

  // ------------------------------------------------------------------------------ sound
  const sfx = (o) => { if (S.sound) audio.tone(o); };
  const note = (n, o = {}) => sfx({ freq: 261.63 * 2 ** (NOTES[n % NOTES.length] / 12) * (1 + Math.floor(n / NOTES.length) * 0.0), dur: 0.22, type: 'sine', vol: 0.085, ...o });
  const SOUNDS = {
    draw: (n) => { const f = NAMES[(n * 3) % NAMES.length] * (n % 10 < 5 ? 1 : 0.5); sfx({ freq: f, dur: 0.2, type: 'sine', vol: 0.07 }); sfx({ freq: f * 2, dur: 0.12, type: 'triangle', vol: 0.02 }); },
    erase: () => sfx({ freq: 330, to: 250, dur: 0.07, type: 'sine', vol: 0.05 }),
    refuse: () => sfx({ freq: 190, to: 130, dur: 0.2, type: 'triangle', vol: 0.07 }),
    fail: () => { sfx({ freq: 220, to: 150, dur: 0.35, type: 'triangle', vol: 0.08 }); },
    hint: () => { sfx({ freq: 660, dur: 0.14, type: 'sine', vol: 0.09 }); sfx({ freq: 990, dur: 0.2, type: 'sine', vol: 0.05 }); },
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.07 }),
    win: (i) => { const f = NAMES[i % NAMES.length] * (i >= 5 ? 2 : 1); sfx({ freq: f, dur: 0.6, type: 'sine', vol: 0.11 }); sfx({ freq: f / 2, dur: 0.7, type: 'triangle', vol: 0.04 }); },
  };
  const drain = (M) => {
    for (const e of M.ev) {
      if (e.k === 'draw') SOUNDS.draw(e.v); else if (e.k === 'erase' || e.k === 'undo') SOUNDS.erase(); else if (e.k === 'refuse') SOUNDS.refuse();
      else if (e.k === 'fail') SOUNDS.fail(); else if (e.k === 'hint') SOUNDS.hint(); else if (e.k === 'win') onWin(M);
    }
    M.ev.length = 0;
  };

  // ------------------------------------------------------------------------------ matches
  const z = () => TEXT_SCALES[S.textIdx];
  // Guide is a setting (off by default); lessons always have it on so the first steps teach
  const effGuide = () => S.check || Boolean(S.match && S.match.lesson !== null);
  const areaOf = () => (S.scene === 'auto' ? autoLayout(z()).area : S.scene === 'sandbox' ? sandboxLayout(z()).area : playLayout(z()).area);
  const unit = (x, y) => { const B = S.scene === 'sandbox' ? S.sb.B : S.match.B; return toUnit(boardGeo(B, areaOf(), 30), x, y); };

  function launch(M, paused = false) {
    S.match = M; S.scene = M.auto ? 'auto' : 'play'; S.overlay = paused ? 'pause' : null; S.ovT = 0; S.press = null; S.endInfo = null;
  }
  function startPuzzle(puz, o = {}) {
    if (!puz) return;
    const isLesson = o.lesson !== undefined && o.lesson !== null;
    if (S.demo && !isLesson && !S.demoIds.includes(puz.id)) {
      if (S.demoIds.length >= DEMO_PUZZLES) { S.scene = 'demo-limit'; S.overlay = null; return; }
      S.demoIds.push(puz.id); S.demoCount = S.demoIds.length; storage.set('kl.demo', S.demoIds);
    }
    const M = P.makeMatch(puz, o);
    if (isLesson) M.lessonTask = X.lessonTask;
    let paused = false;
    const saved = isLesson ? null : S.saves[puz.id];
    if (saved && !o.fresh) { if (P.restore(M, saved)) paused = true; } else if (saved && o.fresh) dropSave(puz.id);
    if (!isLesson) { S.lastId = puz.id; storage.set('kl.last', puz.id); }
    launch(M, paused);
    refreshMeta();
  }
  function dropSave(id) { delete S.saves[id]; delete S.openIds[id]; storage.remove(`kl.s.${id}`); storage.set('kl.open', S.openIds); }
  function saveMatch() {
    const M = S.match;
    if (!M || S.scene !== 'play' || M.lesson !== null || M.reveal || M.auto) return;
    const sv = P.saveOf(M), id = M.puz.id;
    if (!sv) { if (S.saves[id]) dropSave(id); refreshMeta(); return; }
    S.saves[id] = sv; S.openIds[id] = 1;
    storage.set(`kl.s.${id}`, sv); storage.set('kl.open', S.openIds);
    refreshMeta();
  }

  function onWin(M) {
    SOUNDS.win(0);
    M.winNotes = 0;
    if (M.auto) return;
    const id = M.puz.id;
    if (M.lesson !== null) {
      if (!S.lessons[M.lesson]) { S.lessons[M.lesson] = true; storage.set('kl.lessons', S.lessons); }
      S.endInfo = { head: X.lessonPass, body: '', stars: 0, lesson: true, last: M.lesson + 1 >= LESSON_COUNT };
      return;
    }
    let stars = 1;
    if (M.hints === 0) stars = 2;
    if (M.hints === 0 && M.mistakes === 0) stars = 3;
    if ((S.results[id] ?? 0) < stars) { S.results[id] = stars; saveRes(); }
    if (M.daily && S.daily.last !== today()) { S.daily = { streak: S.daily.last === today() - 1 ? S.daily.streak + 1 : 1, last: today() }; storage.set('kl.daily', S.daily); }
    if (S.saves[id]) dropSave(id);
    const lines = [X.star1]; if (stars >= 2) lines.push(X.star2); if (stars >= 3) lines.push(X.star3);
    const ids = chapterIds(chapterOf(id)), nx = ids[ids.indexOf(id) + 1] ?? null;
    S.endInfo = { head: X.endHead, body: `${M.puz.name}\nStars: ${stars}  ·  ${lines.join(' · ')}`, stars, next: nx && !M.daily ? nx : null };
    refreshMeta();
  }

  function doThink() {
    const M = S.match;
    if (!M || M.reveal || M.auto) return;
    P.think(M, M.lesson === null);
    drain(M);
    saveMatch();
  }
  function applyHint() {
    const M = S.match;
    if (!M || !M.hint || !M.hint.pl || !M.hint.seg.length || M.reveal) return;
    P.runPlan(M, M.hint.pl, 4.5);
  }

  // ------------------------------------------------------------------------------ Watch & Learn
  function startAutoPuzzle() {
    const a = S.auto, puz = puzzleById(AUTO_PUZZLES[a.k]);
    const M = P.makeMatch(puz, { auto: true });
    S.match = M;
    Object.assign(a, { phase: 'intro', t: 0, note: { head: '', why: '' }, hint: null });
  }
  function startAuto() {
    S.auto = { k: 0, phase: 'intro', t: 0, paused: false, note: { head: '', why: '' }, hint: null };
    S.scene = 'auto'; S.overlay = null; S.press = null;
    startAutoPuzzle();
  }
  function updateAuto(dt) {
    const a = S.auto, M = S.match;
    if (a.paused) return;
    a.t += dt;
    P.tick(M, dt); drain(M);
    if (M.reveal) {
      if (a.phase !== 'celebrate') { a.phase = 'celebrate'; a.t = 0; a.hint = null; }
      if (a.t >= 4.6) { if (a.k + 1 < AUTO_PUZZLES.length) { a.k += 1; startAutoPuzzle(); } else { S.overlay = 'autosum'; S.ovT = 0; a.phase = 'summary'; } }
      return;
    }
    if (a.phase === 'intro') { if (a.t >= 1.4) { a.phase = 'plan'; a.t = 0; } }
    else if (a.phase === 'plan') {
      const h = P.planHint(M, M.puz.sol);
      a.hint = h; a.note = { head: h.head, why: h.why };
      a.phase = 'think'; a.t = 0;
    } else if (a.phase === 'think') {
      if (a.t >= THINK_STEPS[S.thinkIdx]) { a.phase = 'reveal'; a.t = 0; SOUNDS.hint(); }
    } else if (a.phase === 'reveal') {
      if (a.t >= 2) { a.phase = 'act'; a.t = 0; M.hint = null; if (a.hint && a.hint.pl) P.runPlan(M, a.hint.pl, 3.2); }
    } else if (a.phase === 'act') {
      if (!M.run) { a.phase = 'plan'; a.t = 0; }
    }
  }

  // ------------------------------------------------------------------------------ store screenshots
  // `tools/arc shots` loads ?shot=1&seed=N. Seeds 900001.. stage real moments; 901001+ and 902001+ show Rules pages at 100 and 300 percent.
  function stagePlay(id, frac, o = {}) {
    const puz = puzzleById(id), M = P.makeMatch(puz, o);
    S.match = M; S.scene = 'play'; S.overlay = null;
    // follow the stored solution for `frac` of its arcs
    const T = M.T, sol = puz.sol;
    const seq = patternSeq(M.B, sol);
    const want = Math.floor(seq.length * frac);
    if (want > 0) {
      const { startTrail, exits, commit } = P.trailApi;
      startTrail(T, seq[0].arc, seq[0].dir);
      for (let i = 1; i < want; i++) {
        const opts = exits(T);
        const q = opts.find((x) => x.valid && !x.closing && x.arc === seq[i].arc && x.dir === seq[i].dir);
        if (!q) break;
        commit(T, q, opts.filter((x) => x.valid && !x.closing).length >= 2);
      }
      P.settle(M);
    }
    return M;
  }
  function stageShot(n) {
    S.shot = true;
    S.results = { 'p1-1': 3, 'p1-2': 3, 'p1-3': 2, 'p1-4': 3, 'p1-5': 3, 'p1-6': 1, 'p1-7': 2, 'p1-8': 3, 'p2-1': 2 };
    S.lessons = { 0: true, 1: true, 2: true };
    S.daily = { streak: 4, last: today() - 1 };
    refreshMeta();
    if (n === 1) { const M = stagePlay('p2-3', 0.55); M.cur = null; }
    else if (n === 2) { const M = stagePlay('p1-5', 0.5); P.think(M, false); S.t = 1; }
    else if (n === 3) { const M = stagePlay('p1-5', 1); M.reveal = { t: 1.6 }; M.disp = 99; M.order.fill(0); }
    else if (n === 4) { const M = stagePlay('p3-2', 1); M.reveal = { t: 3.4 }; M.disp = 999; }
    else if (n === 5) { const M = stagePlay('p4-1', 0.6); S.themeId = 'clay'; M.cur = null; }
    else if (n === 6) { const M = stagePlay('p4-3', 0.4); S.themeId = 'moon'; }
    else if (n === 7) { S.scene = 'sandbox'; S.sb = makeSandbox(0); S.sb.modeIdx = S.sb.modes.length - 1; weave(S.sb, rng); S.sb.born.fill(-9); }
    else if (n === 8) { S.scene = 'patterns'; S.chapterIdx = 0; }
    else if (n === 9) { S.scene = 'title'; S.t = 4.5; }
    else if (n === 10) { S.themeId = 'clay'; S.scene = 'chapters'; }
    else if (n >= 17 && n <= 50) {
      S.textIdx = 4;
      if (n === 17) S.scene = 'title';
      else if (n === 18) S.scene = 'settings';
      else if (n === 19) S.scene = 'about';
      else if (n === 20) stagePlay('p1-5', 0.5);
      else if (n === 21) { const M = stagePlay('p1-5', 0.5); P.think(M, false); S.t = 1; }
      else if (n === 22) { const M = stagePlay('p1-5', 1); M.reveal = { t: 3.5 }; M.disp = 99; S.endInfo = { head: X.endHead, body: 'Stars: 3', stars: 3, next: 'p1-6' }; S.overlay = 'end'; S.ovT = 1; }
      else if (n === 23) { stagePlay('p1-5', 0.5); S.overlay = 'pause'; S.ovT = 1; }
      else if (n === 24) S.scene = 'chapters';
      else if (n === 25) S.scene = 'patterns';
      else if (n === 26) S.scene = 'learn';
      else if (n === 27) { S.scene = 'lesson'; S.lessonIdx = 1; }
      else if (n === 28) S.scene = 'demo-limit';
      else if (n === 29) { S.scene = 'howto'; S.page.howto = 2; }
      else if (n === 30) { S.thinkIdx = 0; startAuto(); S.auto.paused = true; }
      else if (n === 31) S.scene = 'daily';
      else if (n === 32) { S.scene = 'sandbox'; S.sb = makeSandbox(0); weave(S.sb, rng); S.sb.born.fill(-9); }
      else if (n === 33) { S.textIdx = 0; stagePlay('p1-5', 0.5); }
      else if (n === 34) { S.textIdx = 0; S.scene = 'title'; }
      else if (n === 35) { S.textIdx = 0; S.scene = 'patterns'; }
      else if (n === 36) { S.textIdx = 0; S.scene = 'settings'; }
      else if (n === 37) { S.textIdx = 2; stagePlay('p1-5', 0.5); }
      else if (n === 38) { S.textIdx = 0; S.scene = 'about'; }
      else if (n === 39) { S.textIdx = 0; S.scene = 'sandbox'; S.sb = makeSandbox(0); }
      else if (n === 40) { S.scene = 'sandbox'; S.sb = makeSandbox(0); }
    } else if (n >= 1001 && n <= 1030) { S.scene = 'rules'; S.page.rules = n - 1001; }
    else if (n >= 2001 && n <= 2030) { S.scene = 'rules'; S.page.rules = n - 2001; S.textIdx = 4; }
    else if (n >= 3001 && n <= 3020) { S.scene = 'howto'; S.page.howto = n - 3001; }
  }
  const wantsShot = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search);
  const sd = config?.seed ?? 0;
  const shotSeed = wantsShot && ((sd >= 900001 && sd <= 900050) || (sd >= 901001 && sd <= 901030) || (sd >= 902001 && sd <= 902030) || (sd >= 903001 && sd <= 903020)) ? sd - 900000 : 0;
  if (shotSeed) stageShot(shotSeed);

  // ------------------------------------------------------------------------------ ui plumbing
  const getScroll = (ui) => (ui.layout && ui.region ? clampScroll(S.scroll[ui.scrollKey] ?? 0, ui.layout.height, ui.region.h) : 0);
  const setScroll = (ui, v) => { if (ui.layout && ui.region) S.scroll[ui.scrollKey] = clampScroll(v, ui.layout.height, ui.region.h); };
  function gotoScene(scene) {
    S.scene = scene; S.overlay = null; S.press = null; S.resetArm = false; S.scrollVel = {};
    if (scene === 'howto') S.page.howto = 0;
    if (scene === 'rules') S.page.rules = 0;
    S.scroll[scene] = 0;
    if (scene === 'title') refreshMeta();
    SOUNDS.ui();
  }
  function setText(d) {
    const n = Math.min(Math.max(S.textIdx + d, 0), TEXT_SCALES.length - 1);
    if (n === S.textIdx) return;
    S.textIdx = n; saveSettings(); S.scroll = {};
  }
  function leaveToMenu() { releaseAll(); saveMatch(); saveSb(); S.match = null; S.auto = null; S.sb = S.scene === 'sandbox' ? S.sb : S.sb; gotoScene('title'); }
  function releaseAll() {
    const M = S.match;
    if (M && S.scene === 'play') { P.releaseFinger(M, effGuide()); drain(M); }
    if (S.scene === 'sandbox' && S.sb) { releaseSb(S.sb); saveSb(); }
  }

  function toolAction(id) {
    if (S.scene === 'sandbox') return sbTool(id);
    const M = S.match;
    if (!M || M.reveal) return;
    releaseAll();
    if (id === 'undo') { if (!P.undoMove(M)) P.toast(M, 'Nothing to undo.'); drain(M); saveMatch(); }
    else if (id === 'clear') {
      if (M.clearArm > 0) { P.clearAll(M); M.clearArm = 0; drain(M); saveMatch(); }
      else if (M.T.arcs.length) M.clearArm = 2.5;
    } else if (id === 'think') doThink();
    else if (id === 'guide') { S.check = !S.check; saveSettings(); P.toast(M, S.check ? 'Guide on: turns that trap the pattern are refused.' : 'Guide off: you can make any turn.'); SOUNDS.ui(); }
  }
  function sbTool(id) {
    const SB = S.sb;
    if (id === 'sbDraw') { SB.erase = !SB.erase; SOUNDS.ui(); }
    else if (id === 'sbMirror') { SB.modeIdx = (SB.modeIdx + 1) % SB.modes.length; SOUNDS.ui(); saveSb(); }
    else if (id === 'sbGrid') { S.sb = makeSandbox((SB.gridIdx + 1) % SB_GRIDS.length); SOUNDS.ui(); saveSb(); }
    else if (id === 'sbWeave') { weave(SB, rng); SOUNDS.hint(); saveSb(); }
    else if (id === 'sbUndo') { if (undoSb(SB)) SOUNDS.erase(); saveSb(); }
    else if (id === 'sbClear') { if (S.sbClearArm > 0) { clearSb(SB); S.sbClearArm = 0; SOUNDS.erase(); saveSb(); } else if (drawnCount(SB)) S.sbClearArm = 2.5; }
  }

  function activate(id) {
    if (id == null) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
    if (id.startsWith('theme:')) { S.themeId = id.slice(6); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('ch:')) { S.chapterIdx = Number(id.slice(3)); gotoScene('patterns'); return; }
    if (id.startsWith('pz:')) {
      const pid = id.slice(3);
      if (S.demo && (chapterOf(pid) !== 0 || chapterIds(0).indexOf(pid) >= DEMO_PUZZLES)) { S.scene = 'demo-limit'; return; }
      SOUNDS.ui(); startPuzzle(puzzleById(pid)); return;
    }
    if (id.startsWith('les:') && id !== 'les:list' && id !== 'les:go') { const i = Number(id.slice(4)); if (S.demo && i >= 3) { S.scene = 'demo-limit'; return; } S.lessonIdx = i; gotoScene('lesson'); return; }
    switch (id) {
      case 'play': gotoScene('chapters'); return;
      case 'continue': if (S.cont) startPuzzle(puzzleById(S.cont.id)); return;
      case 'daily': gotoScene('daily'); return;
      case 'daily:play': startPuzzle(puzzleById(S.dailyId), { daily: true }); return;
      case 'sandbox':
        if (S.demo) { S.scene = 'demo-limit'; return; }
        if (!S.sb) S.sb = makeSandbox(0);
        S.scene = 'sandbox'; S.overlay = null; S.press = null; SOUNDS.ui(); return;
      case 'learn': gotoScene('learn'); return;
      case 'les:list': gotoScene('learn'); return;
      case 'les:go': startPuzzle(lessonPuzzle(S.lessonIdx), { lesson: S.lessonIdx, fresh: true }); return;
      case 'auto': startAuto(); return;
      case 'howto': case 'rules': case 'about': case 'settings': gotoScene(id); return;
      case 'back': case 'menu': gotoScene(S.scene === 'patterns' ? 'chapters' : S.scene === 'lesson' ? 'learn' : 'title'); return;
      case 'prev': S.page[S.scene] = Math.max(0, S.page[S.scene] - 1); S.scroll = {}; SOUNDS.ui(); return;
      case 'next': {
        const total = S.scene === 'rules' ? RULE_COUNT : HOWTO_COUNT;
        if (S.scene === 'howto' && S.page.howto >= total - 1) { activate('play'); return; }
        S.page[S.scene] = Math.min(total - 1, S.page[S.scene] + 1); S.scroll = {}; SOUNDS.ui(); return;
      }
      case 'set:sound': S.sound = !S.sound; audio.setMuted(!S.sound); saveSettings(); if (S.sound) SOUNDS.ui(); return;
      case 'set:guide': S.check = !S.check; saveSettings(); SOUNDS.ui(); return;
      case 'set:think-': S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); return;
      case 'set:think+': S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); return;
      case 'set:restore': Promise.resolve(env.monetization?.restore?.()).then(refreshOwns); return;
      case 'set:unlock': Promise.resolve(env.monetization?.purchase?.('unlock_game')).then(refreshOwns); return;
      case 'set:reset':
        if (!S.resetArm) { S.resetArm = true; return; }
        for (const k of Object.keys(S.saves)) dropSave(k);
        S.results = {}; S.lessons = {}; S.daily = { streak: 0, last: -1 }; S.lastId = null; S.demoIds = []; S.demoCount = 0;
        saveRes(); storage.set('kl.lessons', S.lessons); storage.set('kl.daily', S.daily); storage.set('kl.last', null); storage.set('kl.demo', []); S.resetArm = false; refreshMeta(); return;
      case 'ov:resume': S.overlay = null; return;
      case 'ov:hintdo': S.overlay = null; applyHint(); return;
      case 'ov:hintclose': S.overlay = null; return;
      case 'ov:restart': { S.overlay = null; const M = S.match; if (M) { if (M.lesson !== null) startPuzzle(M.puz, { lesson: M.lesson, fresh: true }); else startPuzzle(M.puz, { fresh: true, daily: M.daily }); } return; }
      case 'ov:menu': S.overlay = null; leaveToMenu(); return;
      case 'ov:list': S.overlay = null; { const M = S.match; if (S.scene === 'sandbox') { leaveToMenu(); return; } releaseAll(); saveMatch(); S.match = null; if (M) S.chapterIdx = Math.max(0, chapterOf(M.puz.id)); gotoScene('patterns'); } return;
      case 'ov:again': { S.overlay = null; const M = S.match; startPuzzle(M.puz, { fresh: true, daily: M.daily }); return; }
      case 'ov:nextpic': { S.overlay = null; const nid = S.endInfo && S.endInfo.next; S.match = null; if (nid) startPuzzle(puzzleById(nid)); else gotoScene('patterns'); return; }
      case 'ov:lessons': S.overlay = null; S.match = null; gotoScene('learn'); return;
      case 'ov:lessonnext': { S.overlay = null; S.match = null; const n = S.lessonIdx + 1; if (n >= LESSON_COUNT) gotoScene('learn'); else { S.lessonIdx = n; gotoScene('lesson'); } return; }
      case 'ov:autoagain': S.overlay = null; startAuto(); return;
      case 'ov:autoexit': S.overlay = null; S.auto = null; S.match = null; gotoScene('title'); return;
      default:
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
    if (S.match) S.match.toast = S.match.toast;
    if ((S.scene === 'play' && !S.overlay && S.match) || (S.scene === 'sandbox' && !S.overlay && S.sb)) { playDown(x, y); return; }
    if (S.scene === 'auto' && !S.overlay) { autoDown(x, y); return; }
    const ui = buildUi(S);
    if (!ui.layout) return;
    const f = fixedHit(ui, x, y);
    if (f) { S.press = { id: f.id, active: true, kind: 'fixed', rect: f.rect }; return; }
    const reg = ui.region;
    if (ui.layout.height > reg.h && inRect(x, y, { x: reg.x + reg.w + 2, y: reg.y, w: 26, h: reg.h })) {       // grab the scroll bar
      S.press = { id: null, active: false, kind: 'bar', ui }; S.scrollVel = {}; barTo(ui, y); return;
    }
    if (inRect(x, y, { x: reg.x - 6, y: reg.y - 4, w: reg.w + 12, h: reg.h + 8 })) {
      const hit = hitDoc(ui.layout, x - reg.x, y - reg.y - (ui.offY || 0) + getScroll(ui));
      const ok = Boolean(hit && !hit.disabled);
      S.press = { id: ok ? hit.id : null, active: ok, kind: 'doc', x0: x, y0: y, scroll0: getScroll(ui), scrolling: false, lastY: y, vel: 0 };
      S.scrollVel = {};
    } else S.press = null;
  }

  // drag the scroll bar: the thumb follows the finger / mouse
  function barTo(ui, y) {
    const reg = ui.region, over = ui.layout.height - reg.h, track = reg.h - 8, tH = Math.max(48, (reg.h / ui.layout.height) * track);
    const f = Math.min(1, Math.max(0, (y - reg.y - 4 - tH / 2) / Math.max(1, track - tH)));
    setScroll(ui, f * over);
  }

  function onMove(x, y, dt) {
    const pr = S.press;
    if (!pr) return;
    if (pr.kind === 'stroke') { strokeMove(x, y); return; }
    if (pr.kind === 'bar') { const ui = buildUi(S); if (ui.layout && ui.region && ui.scrollKey === pr.ui.scrollKey) barTo(ui, y); return; }
    if (pr.kind === 'doc') {
      const ui = buildUi(S);
      if (!ui.layout || !ui.region) { S.press = null; return; }
      if (!pr.scrolling && Math.abs(y - pr.y0) > 10) { pr.scrolling = true; pr.active = false; }
      if (pr.scrolling) { setScroll(ui, pr.scroll0 - (y - pr.y0)); pr.vel = pr.vel * 0.6 + (-(y - pr.lastY) / Math.max(dt, 1e-3)) * 0.4; pr.lastY = y; }
    } else if (pr.rect) pr.active = inRect(x, y, pr.rect);
  }

  function onUp(x, y) {
    const pr = S.press;
    S.press = null;
    if (!pr) return;
    if (pr.kind === 'stroke') { endStroke(); return; }
    if (pr.kind === 'bar') return;
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

  function playDown(x, y) {
    const sandbox = S.scene === 'sandbox';
    const HD = hudOf(z());
    if (inRect(x, y, HD.back)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: HD.back }; return; }
    if (inRect(x, y, HD.pause)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: HD.pause }; return; }
    const L = sandbox ? sandboxLayout(z()) : playLayout(z());
    const M = S.match;
    if (!sandbox && M.hint && M.hint.seg && M.hint.seg.length && !M.reveal && inRect(x, y, L.applyBtn)) { S.press = { id: 'hud:apply', active: true, kind: 'hud', rect: L.applyBtn }; return; }
    for (const r of L.tools) if (inRect(x, y, r)) { S.press = { id: `tool:${r.id}`, active: true, kind: 'tool', rect: r }; return; }
    if (!inRect(x, y, { x: L.area.x - 6, y: L.area.y - 6, w: L.area.w + 12, h: L.area.h + 12 })) return;
    S.lastPtr.x = x; S.lastPtr.y = y;
    S.kbd = false;
    const F = unit(x, y);
    if (sandbox) { const h = pressSb(S.sb, F); S.press = { id: 'stroke', kind: 'stroke', px: x, py: y }; if (h) SOUNDS.draw(h.arc); return; }
    if (M.reveal || M.run || M.fail) return;
    P.pressAt(M, F);
    if (M.held || M.start) S.press = { id: 'stroke', kind: 'stroke', px: x, py: y };
    drain(M);
  }
  function strokeMove(x, y) {
    const pr = S.press;
    if (Math.hypot(x - pr.px, y - pr.py) > STRAY_PX) { pr.stray = (pr.stray ?? 0) + 1; if (pr.stray > 24) { endStroke(); S.press = null; } return; }
    pr.stray = 0; pr.px = x; pr.py = y; S.lastPtr.x = x; S.lastPtr.y = y;
    const F = unit(x, y);
    if (S.scene === 'sandbox') { const h = moveSb(S.sb, F); if (h) { if (h.mode === 'draw') SOUNDS.draw(h.arc); else SOUNDS.erase(); } return; }
    const M = S.match;
    if (!M) { S.press = null; return; }
    P.dragTo(M, F, effGuide());
    drain(M);
  }
  function endStroke() {
    if (S.scene === 'sandbox' && S.sb) { if (releaseSb(S.sb)) saveSb(); return; }
    const M = S.match;
    if (M) { P.releaseFinger(M, effGuide()); drain(M); saveMatch(); }
  }
  function hudAction(id) {
    if (id === 'hud:back') leaveToMenu();
    else if (id === 'hud:pause') { releaseAll(); S.overlay = 'pause'; S.ovT = 0; }
    else if (id === 'hud:apply') { if (z() >= 2) { S.overlay = 'why'; S.ovT = 0; } else applyHint(); }
  }

  function autoDown(x, y) {
    const HD = hudOf(z());
    if (inRect(x, y, HD.back)) { S.press = { id: 'auto:exit', active: true, kind: 'auto', rect: HD.back }; return; }
    const L = autoLayout(z());
    for (const id of ['slower', 'pause', 'faster']) if (inRect(x, y, L[id])) { S.press = { id: `auto:${id}`, active: true, kind: 'auto', rect: L[id] }; return; }
  }
  function autoAction(id) {
    if (id === 'auto:exit') { S.auto = null; S.match = null; gotoScene('title'); }
    else if (id === 'auto:pause') S.auto.paused = !S.auto.paused;
    else if (id === 'auto:slower') { S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); }
    else if (id === 'auto:faster') { S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); }
  }

  function onKeys(keys) {
    const has = (c) => keys.pressed.has(c);
    if (S.scene === 'play' && !S.overlay && S.match && !S.match.reveal) {
      S.kbd = true;
      if (has('KeyZ') || has('KeyU')) toolAction('undo');
      if (has('KeyT')) toolAction('think');
      if (has('KeyG')) toolAction('guide');
      if (has('Escape') || has('KeyP')) { releaseAll(); S.overlay = 'pause'; S.ovT = 0; }
      return;
    }
    if (S.overlay === 'pause' && (has('Escape') || has('KeyP'))) { S.overlay = null; return; }
    if (S.scene === 'sandbox' && !S.overlay) { if (has('Escape')) leaveToMenu(); return; }
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
    if (has('Escape') && ['chapters', 'learn', 'howto', 'rules', 'about', 'settings', 'demo-limit', 'daily'].includes(S.scene)) gotoScene('title');
    if (has('Escape') && S.scene === 'patterns') gotoScene('chapters');
  }

  // ------------------------------------------------------------------------------ live size (rotation, resizable windows)
  // The layout follows meta.width/height. When the size changes while a finger is down, the stroke is cleanly ended (the drawn line, the saved
  // progress and the open puzzle all stay); the player simply lifts and carries on in the new layout.
  let sizeKey = '';
  function syncSize() {
    const k = `${meta.width}x${meta.height}`;
    if (k === sizeKey) return;
    const first = sizeKey === '';
    setScreen(meta.width, meta.height);
    sizeKey = k;
    if (first) return;
    if (S.press && (S.press.kind === 'stroke' || S.press.kind === 'bar')) { if (S.press.kind === 'stroke') endStroke(); S.press = null; }
    else if (S.press) S.press = null;
  }
  setScreen(meta.width, meta.height);

  // ------------------------------------------------------------------------------ main loop
  return {
    update(dt, input) {
      syncSize();
      const frozen = (S.scene === 'auto' && S.auto && S.auto.paused) || S.overlay === 'pause';
      if (!frozen) S.t += dt;
      if (S.overlay) S.ovT += dt;
      const ptr = S.shot ? { pressed: false, down: false, released: false, x: 0, y: 0 } : input.pointer;
      if (ptr.pressed) onDown(ptr.x, ptr.y);
      else if (ptr.down) onMove(ptr.x, ptr.y, dt);
      if (ptr.released) onUp(ptr.x, ptr.y);
      else if (S.press && S.press.kind === 'stroke' && !ptr.down && !ptr.pressed && !S.shot) { S.press = null; endStroke(); }
      if (ptr.down || ptr.pressed) { S.lastPtr.x = ptr.x; S.lastPtr.y = ptr.y; }
      if (!S.shot && (input.keys.pressed.size || input.keys.down.size)) onKeys(input.keys);
      const wy = env.wheel ? env.wheel.take() : 0;
      if (wy && !S.press) { const ui = buildUi(S); if (ui.layout && ui.region) { setScroll(ui, getScroll(ui) + wy); S.scrollVel = {}; } }

      for (const k of Object.keys(S.scrollVel)) {
        const v = S.scrollVel[k];
        if (Math.abs(v) < 8) { delete S.scrollVel[k]; continue; }
        const ui = buildUi(S);
        if (ui.scrollKey === k && ui.layout && ui.region) setScroll(ui, (S.scroll[k] ?? 0) + v * dt);
        S.scrollVel[k] = v * Math.exp(-dt * 5);
      }
      if (frozen) return;
      if (S.scene === 'sandbox' && S.sb) { S.sb.t += dt; if (S.sbClearArm > 0) S.sbClearArm = Math.max(0, S.sbClearArm - dt); return; }
      const M = S.match;
      if (M && S.scene === 'play') {
        P.tick(M, dt); drain(M);
        if (M.reveal) {
          stepReveal(M);
          if (!S.overlay && M.reveal.t > 3.4 && S.endInfo && !S.shot) { S.overlay = 'end'; S.ovT = 0; }
        }
      } else if (S.scene === 'auto' && S.auto && M) { updateAuto(dt); if (M.reveal) stepReveal(M); }
    },

    render(ctx) { syncSize(); render(ctx, S, buildUi(S)); },

    getState() {
      const M = S.match;
      return {
        scene: S.scene, overlay: S.overlay, textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, theme: S.themeId, check: S.check,
        results: S.results, lessons: Object.keys(S.lessons).length, lessonIdx: S.lessonIdx, page: S.page, scroll: S.scroll, demoCount: S.demoCount,
        daily: S.daily, open: Object.keys(S.openIds).length,
        auto: S.auto ? { k: S.auto.k, phase: S.auto.phase, t: Math.round(S.auto.t * 100) / 100, paused: S.auto.paused } : null,
        sandbox: S.sb ? { grid: S.sb.gridIdx, mode: S.sb.modeIdx, arcs: drawnCount(S.sb) } : null,
        match: M ? {
          id: M.puz.id, arcs: M.T.arcs.join(','), dirs: M.T.dirs.join(''), cur: M.cur ? [M.cur.arc, Math.round(M.cur.p * 100)] : null, hints: M.hints, mistakes: M.mistakes, undos: M.undos,
          hint: M.hint && M.hint.seg ? M.hint.seg.length : null, reveal: M.reveal ? Math.round(M.reveal.t * 100) / 100 : null, closed: M.T.closed, fail: M.fail ? M.fail.kind : null, run: Boolean(M.run), disp: Math.round(M.disp * 100) / 100,
        } : null,
      };
    },

    // The preview clock counts real play only. Menus, chapter lists, Learn (lessons), Rules / How to Play / About, Settings, every overlay
    // (pause, result, Watch & Learn summary), the demo card, Watch & Learn and a finished pattern's celebration are all free time.
    ...(S.dev ? { dbg: { S, stagePlay, stageShot, startAuto, puzzleById, makeSandbox, weave, rng } } : {}),

    isPreviewExempt: () => S.shot || (S.scene !== 'play' && S.scene !== 'sandbox') || Boolean(S.overlay) || Boolean(S.match && S.scene === 'play' && (S.match.lesson !== null || S.match.reveal)),
  };

  function stepReveal(M) {
    const R = M.reveal;
    while (M.winNotes < 8 && R.t >= 0.3 + M.winNotes * 0.2) { SOUNDS.win(M.winNotes + 1); M.winNotes++; }
  }
}
