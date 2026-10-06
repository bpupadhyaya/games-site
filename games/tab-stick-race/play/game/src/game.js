// GAME CONTRACT (docs/GAME-CONTRACT.md). Tab: the four-stick race of Egypt and the Arab world, five opponents, a Learn path.
import { inRect, creditHit, titleLayout, TOOLBAR_IDS, autoLayout, playLayout, setLive } from './layout.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, THINK_STEPS, PACES, AUTO_SPEEDS, demoOver, lvName } from './screens.js';
import { WAIT, HOME, N, makeState, applyThrow, legalMoves, posOf, sqOf, isSafe } from './rules.js';
import { LEVELS, levelById, startPick, finishPick, searchJob, sortRows, analyse, explain } from './ai.js';
import { LESSONS, lessonStart, judge, REFUSALS, lessonText } from './lessons.js';
import { createMatch, playMove, undoMatch, tapStone, tapTarget, stepMatch, spawn, canUndo, canThrow, humanTurn, settled, startThrow, refuse, movesOf, isHumanSide } from './match.js';
import { RULE_COUNT, HOWTO_COUNT, tr, LANGS, SHORT } from './content.js';
import { themeById, THEMES, bakeSticks, stickDims, setSize } from './art.js';
import { render, playGeo, squareAt, exitBadge, yardRect, slotXY } from './view.js';

// Fluid viewport (kit 1.7.1): the short side is always 720 units, the long side follows the screen; the kit updates width/height live.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };

const VERSION = '1.1.0';
const STEP = 1 / 60;
const WIN_NOTES = [523, 659, 784, 1047, 1319];
const AUTO_LV = ['master', 'expert'];
const W_ = WAIT;
const AUTO_PIECES = 2;            // Watch & Learn plays a very short game (two stones each) so a whole session fits in a few minutes
const SINGLE_WAIT = 0.6;          // a single possible move is played for the player after this long (game seconds)

export async function createGame(env) {
  const { rng, storage, audio, config } = env;
  const nowMs = () => (env.clock ? env.clock() : 0);   // display clock from the shell; absent in headless runs (alpha stays 1)

  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0, sound: true, themeId: 'sand', lang: 'en', textIdx: 0, thinkIdx: 1, paceIdx: 1, speedIdx: 1, autoSingle: true, pace: 1, wheel: 0,
    setup: { level: 'skilled', side: 0, pieces: SHORT }, stats: {}, lessons: {}, save: null, demoGames: 0, progress: { games: 0, wins: 0 },
    page: { howto: 0, rules: 0 }, scroll: {}, scrollVel: {}, press: null, match: null, auto: null, lessonIdx: 0, endInfo: null, lessonInfo: null,
    toast: null, toastT: 0, canUndo: false, winSeq: null, lessonWait: -1, lessonOk: null, lastOpts: null, hintBusy: false, hintDelay: 0,
    demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, price: '', resetArm: false, version: env.manifest?.version || VERSION, shot: false, lastPtr: { x: 0, y: 0 },
    alpha: 1,
  };
  let updAt = 0, stepped = false;

  const [set, stats, les, save, dg, prog] = await Promise.all([storage.get('tb.settings', null), storage.get('tb.stats', null), storage.get('tb.lessons', null), storage.get('tb.save', null), storage.get('tb.demo', 0), storage.get('tb.progress', null)]);
  if (set) {
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (THEMES.some((t) => t.id === set.themeId)) S.themeId = set.themeId;
    if (LANGS.some((l) => l.id === set.lang)) S.lang = set.lang;
    if (Number.isInteger(set.textIdx)) S.textIdx = Math.min(Math.max(set.textIdx, 0), TEXT_SCALES.length - 1);
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = Math.min(Math.max(set.thinkIdx, 0), THINK_STEPS.length - 1);
    if (Number.isInteger(set.paceIdx)) S.paceIdx = Math.min(Math.max(set.paceIdx, 0), PACES.length - 1);
    if (Number.isInteger(set.speedIdx)) S.speedIdx = Math.min(Math.max(set.speedIdx, 0), AUTO_SPEEDS.length - 1);
    if (typeof set.autoSingle === 'boolean') S.autoSingle = set.autoSingle;
    if (set.setup) {
      const lv = set.setup.level === 'two' || LEVELS.some((l) => l.id === set.setup.level) ? set.setup.level : 'skilled';
      S.setup = { level: lv, side: set.setup.side === 1 ? 1 : 0, pieces: [3, 5, 7].includes(set.setup.pieces) ? set.setup.pieces : SHORT };
    }
  }
  if (stats && typeof stats === 'object') S.stats = stats;
  if (les && typeof les === 'object') S.lessons = les;
  if (save && Array.isArray(save.log) && (save.two || LEVELS.some((l) => l.id === save.level))) S.save = save;
  if (Number.isInteger(dg)) S.demoGames = dg;
  if (prog && Number.isInteger(prog.wins) && Number.isInteger(prog.games)) S.progress = { games: prog.games, wins: prog.wins };
  audio.setMuted(!S.sound);
  // The price shown is the store's localized price when the shell knows it, else the game.json price (kit priceOf).
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);

  const T = (k, v) => tr(k, v, S.lang);
  const th = () => themeById(S.themeId);
  const pal = () => ({ 0: th().light.glow, 1: th().dark.glow });
  const saveSettings = () => storage.set('tb.settings', { sound: S.sound, themeId: S.themeId, lang: S.lang, textIdx: S.textIdx, thinkIdx: S.thinkIdx, paceIdx: S.paceIdx, speedIdx: S.speedIdx, autoSingle: S.autoSingle, setup: S.setup });
  const saveStats = () => storage.set('tb.stats', S.stats);
  const saveLessons = () => storage.set('tb.lessons', S.lessons);
  const saveGame = () => {
    const M = S.match;
    if (S.scene !== 'play' || !M || M.lesson || M.auto) return;
    S.save = M.over || !M.log.length ? null : { level: M.level, human: M.human, two: M.two, pieces: M.pieces, log: M.log.map((e) => e.slice()) };
    storage.set('tb.save', S.save);
  };

  // ------------------------------------------------------------------------------ sound
  const sfx = (o) => { if (S.sound) audio.tone(o); };
  const SOUNDS = {
    throw: () => { sfx({ freq: 300, to: 900, dur: 0.22, type: 'sine', vol: 0.035 }); },
    tick: (i, big) => { const f = 640 + i * 90 + (big ? 0 : 60); sfx({ freq: f, to: f * 0.7, dur: big ? 0.07 : 0.045, type: 'triangle', vol: big ? 0.12 : 0.06 }); sfx({ freq: 180, to: 110, dur: 0.06, type: 'sine', vol: big ? 0.09 : 0.04 }); },
    value: (v, extra) => { const base = { 1: 523, 2: 440, 3: 494, 4: 659, 6: 784 }[v] ?? 440; sfx({ freq: base, dur: 0.18, type: 'sine', vol: 0.12 }); if (extra) sfx({ freq: base * 1.5, dur: 0.24, type: 'sine', vol: 0.07 }); },
    step: (p) => { sfx({ freq: p === 0 ? 420 : 300, to: p === 0 ? 300 : 210, dur: 0.07, type: 'triangle', vol: 0.14 }); sfx({ freq: 1300, dur: 0.02, type: 'square', vol: 0.025 }); },
    hit: () => { sfx({ freq: 190, to: 70, dur: 0.22, type: 'triangle', vol: 0.2 }); sfx({ freq: 880, to: 440, dur: 0.18, type: 'sine', vol: 0.08 }); sfx({ freq: 2200, dur: 0.03, type: 'square', vol: 0.035 }); },
    home: () => { sfx({ freq: 700, dur: 0.1, type: 'sine', vol: 0.1 }); sfx({ freq: 1050, dur: 0.2, type: 'sine', vol: 0.08 }); },
    select: () => sfx({ freq: 620, to: 760, dur: 0.06, type: 'sine', vol: 0.08 }),
    refuse: () => sfx({ freq: 170, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.07 }),
    undo: () => sfx({ freq: 520, to: 330, dur: 0.1, type: 'triangle', vol: 0.1 }),
    hint: () => { sfx({ freq: 660, dur: 0.12, type: 'sine', vol: 0.1 }); sfx({ freq: 990, dur: 0.18, type: 'sine', vol: 0.06 }); },
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.08 }),
    lose: () => { [392, 330, 262].forEach((f, i) => sfx({ freq: f, to: f * 0.96, dur: 0.4, type: 'sine', vol: 0.09 - i * 0.01 })); },
  };

  // ------------------------------------------------------------------------------ matches
  const cancelHint = () => { S.hintBusy = false; S.hintDelay = 0; S.hintJob = null; };
  function launch(M) {
    S.match = M; S.scene = M.auto ? 'auto' : 'play'; S.overlay = null; S.press = null; S.endInfo = null; S.lessonInfo = null; S.winSeq = null; S.toast = null; S.lessonWait = -1; S.lessonOk = null;
    cancelHint();
  }
  function startMatch(opts, count = true) {
    if (count && demoOver(S)) { S.scene = 'demo-limit'; S.overlay = null; return; }
    const two = opts.level === 'two';
    const M = createMatch({ level: two ? 'skilled' : opts.level, human: two ? 0 : opts.side ?? 0, two, pieces: opts.pieces ?? SHORT, pal: pal(), lesson: opts.lesson ?? null, start: opts.start, force: opts.force });
    if (count && S.demo) { S.demoGames += 1; storage.set('tb.demo', S.demoGames); }
    launch(M);
    if (!opts.lesson) { S.lastOpts = opts; S.save = null; storage.set('tb.save', null); }
  }
  function replay(M, log) {
    for (const e of log) {
      if (e[0] === 't') { M.st = applyThrow(M.st, e[1]); M.log.push(['t', e[1]]); }
      else {
        const mv = legalMoves(M.st).find((m) => m.from === e[1] && m.to === e[2] && m.v === e[3]);
        if (!mv) return false;
        playMove(M, mv, true);
      }
    }
    return true;
  }
  function continueGame() {
    const sv = S.save;
    if (!sv) return;
    const M = createMatch({ level: sv.level, human: sv.human ?? 0, two: sv.two, pieces: sv.pieces ?? 7, pal: pal() });
    const ok = replay(M, sv.log);
    M.events.length = 0; M.hist = [];
    if (!ok || M.over) { S.save = null; storage.set('tb.save', null); return; }
    launch(M);
    S.lastOpts = { level: sv.two ? 'two' : sv.level, side: sv.human ?? 0, pieces: sv.pieces ?? 7 };
    S.overlay = 'pause'; S.ovT = 0; // a resumed game starts paused
  }
  function startLesson(i) {
    const L = LESSONS[i];
    if (!L || (S.demo && i >= 3)) { S.scene = 'demo-limit'; S.overlay = null; return; }
    S.lessonIdx = i;
    if (L.type === 'game') { startMatch({ level: L.level, side: L.human ?? 0, pieces: L.pieces ?? QUICK, lesson: L }, false); return; }
    startMatch({ level: 'skilled', side: 0, lesson: L, start: lessonStart(L), force: L.force }, false);
    const M = S.match;
    M.gate = (mv) => {
      const j = judge(L, M.st, mv);
      if (!j.ok) { S.lessonInfo = { ok: false, head: T('lessonRetry'), body: (REFUSALS[S.lang] ?? REFUSALS.en)[j.why] }; S.overlay = 'lesson'; S.ovT = 0; M.sel = null; SOUNDS.refuse(); return false; }
      S.lessonOk = j; S.lessonWait = 0;
      return true;
    };
  }

  function onEnd(M, e) {
    const w = e.winner;
    const lessonGame = M.lesson && M.lesson.type === 'game';
    const youWon = !M.two && !M.auto && w === M.human;
    const side = (p) => T(p === 0 ? 'ivory' : 'clay');
    let head, body;
    if (M.two || M.auto || (M.lesson && !lessonGame)) head = T('sideWins', { side: side(w) });
    else head = youWon ? T('youWin') : T('levelWins', { name: lvName(S, levelById(M.level)) });
    body = youWon ? T('youWinBody') : T('allHome');
    let rec = '', lessonOk = false;
    if (!M.two && !M.auto && !M.lesson) {
      const r = S.stats[M.level] ?? [0, 0];
      r[youWon ? 0 : 1] += 1;
      S.stats[M.level] = r; saveStats();
      S.progress.games += 1; if (youWon) S.progress.wins += 1; storage.set('tb.progress', S.progress);
      rec = `${T('record')} (${lvName(S, levelById(M.level))}): ${r[0]}${T('wins')}  ${r[1]}${T('losses')}`;
      S.save = null; storage.set('tb.save', null);
    }
    if (lessonGame) {
      lessonOk = youWon;
      if (lessonOk) { S.lessons[M.lesson.id] = true; saveLessons(); body = `${body} ${lessonText(M.lesson, S.lang).done}`; }
    }
    S.endInfo = { head, body, rec, winner: w, lessonOk };
    if (M.two || M.auto || M.lesson || youWon) S.winSeq = { t: 0, i: 0 };
    else SOUNDS.lose();
  }

  // Screen position (virtual units) of a mat point.
  const matXY = (x, y) => { const m = playGeo(S, S.match).lay.mat; return [m.x + x * m.w, m.y + y * m.h]; };

  function handleEvents(M) {
    for (const e of M.events) {
      if (e.type === 'throw') SOUNDS.throw();
      else if (e.type === 'impact') { SOUNDS.tick(e.i, e.big); const [x, y] = matXY(e.x, e.y); spawn(M, rng, x, y, 'dust'); }
      else if (e.type === 'value') SOUNDS.value(e.v, e.extra);
      else if (e.type === 'move' || e.type === 'move-enter' || e.type === 'move-cap' || e.type === 'move-off') SOUNDS.step(e.p);
      else if (e.type === 'land') {
        const g = playGeo(S, M).geo;
        if (e.off) SOUNDS.home();
        else {
          const [cx, cy] = g.sqXY(e.sq);
          const glow = e.p === 0 ? th().light.glow : th().dark.glow;
          if (e.cap) { SOUNDS.hit(); spawn(M, rng, cx, cy, 'hit', glow); } else spawn(M, rng, cx, cy, 'step', glow);
        }
      } else if (e.type === 'refuse') SOUNDS.refuse();
      else if (e.type === 'select') SOUNDS.select();
      else if (e.type === 'undo') SOUNDS.undo();
      else if (e.type === 'end') onEnd(M, e);
      else if (e.type === 'burst' && M.over) {
        const g = playGeo(S, M).geo;
        for (const x of M.st.pos[M.over.winner]) if (x >= 0 && x < N) { const [cx, cy] = g.sqXY(sqOf(M.over.winner, x)); spawn(M, rng, cx, cy, 'win', M.over.winner === 0 ? th().light.glow : th().dark.glow); }
      }
    }
    if (M.events.some((e) => e.type === 'value' || e.type === 'move' || e.type === 'move-cap' || e.type === 'move-off' || e.type === 'move-enter' || e.type === 'undo')) saveGame();
    M.events.length = 0;
  }

  function stepWinSeq(dt) {
    const w = S.winSeq;
    if (!w) return;
    w.t += dt;
    while (w.i < WIN_NOTES.length && w.t >= 0.3 + w.i * 0.11) {
      sfx({ freq: WIN_NOTES[w.i], dur: 0.35, type: 'sine', vol: 0.16 });
      sfx({ freq: WIN_NOTES[w.i] / 2, dur: 0.4, type: 'triangle', vol: 0.06 });
      w.i++;
    }
    if (w.i >= WIN_NOTES.length) S.winSeq = null;
  }

  // ------------------------------------------------------------------------------ Think
  function doThink() {
    const M = S.match;
    if (!M || M.over || !humanTurn(M) || M.st.phase !== 'move' || S.hintBusy) return;
    M.hint = null; M.sel = null;
    S.hintBusy = true; S.hintDelay = 0.12; S.hintJob = { job: searchJob(M.st, 'master'), st: M.st };   // a moment of "Thinking...", then the search in slices
    SOUNDS.ui();
  }
  function stepHint(dt) {
    if (!S.hintBusy) return;
    const M = S.match;
    if (!M || M.over || M.st.phase !== 'move') { cancelHint(); return; }
    S.hintDelay -= dt;
    const hj = S.hintJob;
    if (!hj || hj.st !== M.st) { cancelHint(); return; }
    if (!hj.job.done) hj.job.step();                    // a few milliseconds of search per frame
    if (S.hintDelay > 0 || !hj.job.done) return;
    const rows = sortRows(hj.job.rows);
    const mv = rows[0].mv;
    const ex = explain(M.st, mv, S.lang);
    M.hint = { mv, head: ex.head, why: ex.why };
    cancelHint();
    SOUNDS.hint();
  }

  // A turn with exactly one possible move (a lone stone, a blocked path) is played for the player after a short wait, with a note.
  // The player can turn this off in Settings; lessons never do it.
  function stepSingle(M, dt) {
    const ok = S.autoSingle && !M.lesson && !S.overlay && humanTurn(M) && M.st.phase === 'move' && !S.hintBusy && !M.hint && (M.sel === null || M.sel === undefined);
    if (!ok) { M.singleT = 0; return; }
    const list = movesOf(M);
    if (list.length !== 1) { M.singleT = 0; return; }
    M.singleT = (M.singleT || 0) + dt;
    if (M.singleT >= SINGLE_WAIT) { M.singleT = 0; toast(T('onlyMove')); playMove(M, list[0]); }
  }

  // ------------------------------------------------------------------------------ Watch & Learn
  function startAutoGame() {
    const a = S.auto;
    const M = createMatch({ auto: true, pieces: AUTO_PIECES, pal: pal() });
    M.autoLv = AUTO_LV.slice();
    S.match = M; S.winSeq = null; S.endInfo = null;
    Object.assign(a, { phase: 'intro', t: 0, plan: null, scan: null, note: { head: '', why: '' } });
  }
  function startAuto() {
    S.auto = { phase: 'intro', t: 0, paused: false, plan: null, scan: null, note: { head: '', why: '' } };
    S.scene = 'auto'; S.overlay = null; S.press = null; cancelHint();
    startAutoGame();
  }
  function beginThink() {
    const a = S.auto, M = S.match;
    a.phase = 'think'; a.t = 0; a.plan = null;
    a.forced = legalMoves(M.st).length === 1;           // nothing to decide: keep the explanation but do not wait
    a.pick = startPick(M.st, AUTO_LV[M.st.turn], rng); a.pick.st = M.st;   // Expert and Master search in slices while the think time runs
    a.cands = M.st.pos[M.st.turn].filter((x) => x >= 0 && x < N).map((x) => sqOf(M.st.turn, x));
  }
  function finishPlan() {
    const a = S.auto, M = S.match, st = M.st;
    const mv = (a.pick && a.pick.st === st ? finishPick(a.pick, rng) : null) ?? legalMoves(st)[0];
    const ex = explain(st, mv, S.lang);
    a.plan = { mv, moves: legalMoves(st) };
    a.note = { head: ex.head, why: ex.why };
  }
  // THINK (configurable) -> REVEAL (2 s: the stone, the square and the reason) -> ACT (the move). Throws happen between turns.
  function updateAuto(dt) {
    const a = S.auto, M = S.match;
    if (a.paused) return;
    a.t += dt;
    if (a.phase === 'intro') {
      if (a.t >= 1.2) { a.phase = 'next'; a.t = 0; }
    } else if (a.phase === 'next') {
      if (M.over) { a.phase = 'celebrate'; a.t = 0; return; }
      if (!settled(M)) return;
      if (M.st.phase === 'throw') { if (a.t >= 0.5 && startThrow(M, rng)) { a.phase = 'throwing'; a.t = 0; } }
      else if (M.st.phase === 'move') beginThink();
    } else if (a.phase === 'throwing') {
      if (!M.throwAnim && a.t >= 0.5) { a.phase = 'next'; a.t = 0; }
    } else if (a.phase === 'think') {
      a.scan = a.cands.length ? a.cands[Math.floor(a.t / 0.4) % a.cands.length] : null;
      if (a.pick && a.pick.job && !a.pick.job.done) a.pick.job.step();
      if (a.t >= (a.forced ? 0.5 : THINK_STEPS[S.thinkIdx])) { finishPlan(); a.phase = 'reveal'; a.t = 0; a.scan = null; }
    } else if (a.phase === 'reveal') {
      if (a.t >= (a.forced ? 1.2 : 2)) { a.phase = 'act'; a.t = 0; playMove(M, a.plan.mv); }
    } else if (a.phase === 'act') {
      if (a.t >= 0.7 && settled(M)) { a.phase = 'next'; a.t = 0; }
    } else if (a.phase === 'celebrate') {
      if (a.t >= 3.4) { S.overlay = 'autosum'; S.ovT = 0; a.phase = 'summary'; }
    }
  }

  // ------------------------------------------------------------------------------ store screenshots
  // `tools/arc shots` loads ?shot=1&seed=N. Seeds 900001..900060 stage a real moment instead of random play; 901001+ and
  // 902001+ show the Rules pages at 100 and 300 percent, 903001+ in Arabic. The positions are real game positions.
  function stageShot(n) {
    const settle = (M) => { M.events.length = 0; M.parts.length = 0; };
    const mk = (iv, cl, pending, o = {}) => {
      S.setup = { level: o.level ?? 'expert', side: o.side ?? 0, pieces: iv.length };
      startMatch({ level: o.level ?? 'expert', side: o.side ?? 0, pieces: iv.length, start: makeState(iv, cl, pending, o.phase ?? 'move', o.turn ?? 0) }, false);
      const M = S.match; M.freeze = true; return M;
    };
    const MID = [[4, 9, 12, 20, W_, W_, W_], [22, 17, 8, W_, W_, W_, HOME]];
    const throwShot = (frac, flats) => {
      const M = mk(MID[0], MID[1], [], { phase: 'throw' }); settle(M);
      M.force = [flats]; startThrow(M, rng); M.events.length = 0; M.throwAnim.t = M.throwAnim.plan.dur * frac; return M;
    };
    const hinted = (pending) => { const M = mk(MID[0], MID[1], pending); settle(M); const rows = analyse(M.st); const ex = explain(M.st, rows[0].mv, S.lang); M.hint = { mv: rows[0].mv, head: ex.head, why: ex.why }; return M; };
    S.shot = true; S.alpha = 1;
    S.stats = { skilled: [4, 2], expert: [1, 3], casual: [6, 0] };
    ['throw', 'enter', 'move'].forEach((id) => { S.lessons[id] = true; });
    if (n === 1) { const M = mk(MID[0], MID[1], [3, 1]); M.sel = 12; }
    else if (n === 2) { throwShot(0.2, 2); }
    else if (n === 3) { hinted([4, 1]); }
    else if (n === 4) { const M = mk([4, 9, 15, 20, W_, W_, W_], [22, 17, 8, W_, W_, W_, HOME], [4]); const mv = movesOf(M).find((m) => m.cap) ?? movesOf(M)[0]; playMove(M, mv); M.anim.t = M.anim.dur * 0.5; M.events.length = 0; }
    else if (n === 5) { S.thinkIdx = 0; startAuto(); const M = S.match; M.st = makeState(MID[0], MID[1], [4, 1]); M.freeze = true; S.auto.phase = 'reveal'; S.auto.t = 1; finishPlan(); }
    else if (n === 6) { S.themeId = 'lapis'; const M = mk(MID[0], MID[1], [3, 1]); M.sel = 12; }
    else if (n === 7) { S.themeId = 'palm'; throwShot(0.5, 3); }
    else if (n === 8) { S.scene = 'setup'; S.setup = { level: 'expert', side: 0, pieces: 7 }; }
    else if (n === 9) { S.scene = 'learn'; }
    else if (n === 10) { S.themeId = 'lapis'; S.scene = 'title'; S.t = 1.2; }
    else if (n === 11) { S.themeId = 'palm'; S.scene = 'title'; S.t = 2.2; }
    else if (n === 12) { S.scene = 'title'; S.t = 1.0; }
    else if (n === 13) { startLesson(3); S.match.sel = 5; S.match.freeze = true; }
    else if (n === 14) { const M = mk(MID[0], MID[1], [], { phase: 'throw' }); M.force = [3]; startThrow(M, rng); M.events.length = 0; M.throwAnim.t = M.throwAnim.plan.dur - 0.01; stepMatch(M, 0.05, rng); M.events.length = 0; M.pop.t = 0.5; }
    else if (n === 15) { S.lang = 'ar'; S.scene = 'title'; S.t = 1.2; }
    else if (n === 16) { S.lang = 'ar'; const M = mk(MID[0], MID[1], [3, 1]); M.sel = 12; }
    else if (n === 17) { S.lang = 'ar'; S.scene = 'setup'; }
    else if (n === 61) { const M = mk([25, 9, 12, W_, W_], [22, 17, W_, W_, W_], [4]); const mv = movesOf(M).find((m) => m.off); playMove(M, mv); M.anim.t = M.anim.dur * 0.55; M.events.length = 0; }
    else if (n === 62) { const M = mk([4, 9, 15, 20, W_, W_, W_], [22, 17, 8, W_, W_, W_, HOME], [4]); playMove(M, movesOf(M).find((m) => m.cap)); M.anim.t = M.anim.dur + 0.3; M.events.length = 0; }
    else if (n === 63) { const M = mk([W_, W_, 9, 12, W_], [22, 17, W_, W_, W_], [1]); playMove(M, movesOf(M).find((m) => m.from === W_)); M.anim.t = M.anim.dur * 0.5; M.events.length = 0; }
    else if (n === 64) { const M = mk([W_, W_, W_, W_], [W_, W_, W_, W_], [], { phase: 'throw' }); M.force = [2]; M.freeze = false; startThrow(M, rng); M.events.length = 0; for (let i = 0; i < 400 && M.throwAnim; i++) stepMatch(M, 1 / 60, rng); M.freeze = true; M.events.length = 0; M.pop.t = 0.4; }
    else if (n === 65) { const M = mk([HOME, HOME, HOME, HOME], [10, 14, 22, 5], [], { phase: 'throw' }); M.over = { winner: 0 }; M.winT = 1.2; M.overT = 1; S.endInfo = { head: T('youWin'), body: T('youWinBody'), rec: '', winner: 0 }; M.parts.length = 0; }
    else if (n >= 18 && n <= 60) { // text-zoom and screen checks (QA only)
      S.textIdx = 4;
      if (n === 18) S.scene = 'title';
      else if (n === 19) S.scene = 'settings';
      else if (n === 20) S.scene = 'about';
      else if (n === 21) { const M = mk(MID[0], MID[1], [3]); S.endInfo = { head: T('youWin'), body: T('youWinBody'), rec: 'Record (Expert): 2 W  0 L', winner: 0 }; M.over = { winner: 0 }; S.overlay = 'end'; S.ovT = 1; }
      else if (n === 22) S.scene = 'learn';
      else if (n === 23) S.scene = 'setup';
      else if (n === 24) { mk(MID[0], MID[1], [3]); S.overlay = 'pause'; S.ovT = 1; }
      else if (n === 25) S.scene = 'demo-limit';
      else if (n === 26) { S.scene = 'howto'; S.page.howto = 2; }
      else if (n === 27) { S.thinkIdx = 0; startAuto(); const M = S.match; M.st = makeState(MID[0], MID[1], [4, 1]); M.freeze = true; S.auto.phase = 'reveal'; S.auto.t = 1; finishPlan(); S.auto.paused = true; }
      else if (n === 28) { S.textIdx = 0; S.demo = true; S.scene = 'title'; }
      else if (n === 29) { const M = mk(MID[0], MID[1], [3, 1]); M.sel = 12; }
      else if (n === 30) { S.textIdx = 2; const M = mk(MID[0], MID[1], [3, 1]); M.sel = 12; }
      else if (n === 31) { startLesson(1); S.lessonInfo = { ok: false, head: T('lessonRetry'), body: REFUSALS.en.enter }; S.overlay = 'lesson'; S.ovT = 1; }
      else if (n === 32) { S.textIdx = 0; mk(MID[0], MID[1], [4, 1], { level: 'master', side: 1 }); }
      else if (n === 33) { S.textIdx = 0; const M = mk(MID[0], MID[1], [3, 1]); M.msg = 'refuseSafe'; M.msgT = 99; }
      else if (n === 34) { S.textIdx = 0; const M = hinted([4, 1]); M.hint.why = `${M.hint.why} ${M.hint.why}`; }
      else if (n === 35) { S.textIdx = 0; const M = mk(MID[0], MID[1], [3]); M.over = { winner: 0 }; S.overlay = 'end'; S.endInfo = { head: T('youWin'), body: T('youWinBody'), rec: '', winner: 0 }; S.ovT = 1; }
      else if (n === 36) { S.textIdx = 0; const M = mk(MID[0], MID[1], [3]); M.over = { winner: 1 }; S.endInfo = { head: T('levelWins', { name: 'Expert' }), body: T('allHome'), rec: '', winner: 1 }; S.overlay = 'end'; S.ovT = 1; }
      else if (n === 37) { S.textIdx = 0; S.scene = 'settings'; }
      else if (n === 38) { S.textIdx = 0; S.scene = 'about'; }
      else if (n === 39) { S.textIdx = 0; S.scene = 'setup'; }
      else if (n === 40) { S.textIdx = 0; S.scene = 'learn'; }
      else if (n === 41) { S.textIdx = 0; mk(MID[0], MID[1], [3]); S.overlay = 'pause'; S.ovT = 1; }
      else if (n >= 42 && n <= 48) { S.textIdx = 0; S.scene = 'howto'; S.page.howto = n - 42; }
      else if (n === 50) { S.lang = 'ar'; S.textIdx = 4; S.scene = 'rules'; S.page.rules = 3; }
      else if (n === 51) { S.lang = 'ar'; S.textIdx = 0; S.scene = 'rules'; S.page.rules = 3; }
      else if (n === 52) { S.lang = 'ar'; S.textIdx = 0; S.scene = 'howto'; S.page.howto = 1; }
      else if (n === 53) { S.lang = 'ar'; S.textIdx = 0; S.scene = 'settings'; }
      else if (n === 54) { S.lang = 'ar'; S.textIdx = 4; S.scene = 'title'; }
      else if (n === 55) { S.lang = 'ar'; S.textIdx = 0; S.scene = 'about'; }
      else if (n === 56) { S.lang = 'ar'; S.textIdx = 4; const M = mk(MID[0], MID[1], [3, 1]); M.sel = 12; }
    } else if (n >= 1001 && n <= 1030) { S.scene = 'rules'; S.page.rules = n - 1001; }
    else if (n >= 2001 && n <= 2030) { S.scene = 'rules'; S.page.rules = n - 2001; S.textIdx = 4; }
    else if (n >= 3001 && n <= 3030) { S.lang = 'ar'; S.scene = 'rules'; S.page.rules = n - 3001; }
  }
  const wantsShot = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search);
  const sd = config?.seed ?? 0;
  const shotSeed = wantsShot && ((sd >= 900001 && sd <= 900070) || (sd >= 901001 && sd <= 901030) || (sd >= 902001 && sd <= 902030) || (sd >= 903001 && sd <= 903030)) ? sd - 900000 : 0;
  if (shotSeed) stageShot(shotSeed);

  // ------------------------------------------------------------------------------ ui plumbing
  const getScroll = (ui) => S.scroll[ui.scrollKey] ?? 0;
  const setScroll = (ui, v) => { if (ui.layout && ui.region) S.scroll[ui.scrollKey] = clampScroll(v, ui.layout.height, ui.region.h); };

  function gotoScene(scene) {
    S.scene = scene; S.overlay = null; S.press = null; S.resetArm = false; S.scrollVel = {}; cancelHint();
    if (scene === 'howto') S.page.howto = 0;
    if (scene === 'rules') S.page.rules = 0;
    S.scroll[scene] = 0;
    SOUNDS.ui();
  }
  function setText(d) {
    const n = Math.min(Math.max(S.textIdx + d, 0), TEXT_SCALES.length - 1);
    if (n === S.textIdx) return;
    S.textIdx = n; saveSettings(); S.scroll = {};
  }
  function leaveToMenu() { saveGame(); S.match = null; S.auto = null; cancelHint(); gotoScene('title'); }
  function doRestart() {
    const M = S.match;
    if (!M || M.auto) return;
    if (M.lesson) { startLesson(S.lessonIdx); return; }
    startMatch(S.lastOpts ?? { level: M.two ? 'two' : M.level, side: M.human, pieces: M.pieces }, S.demo);
  }
  const toast = (msg) => { S.toast = msg; S.toastT = 2.2; };

  function activate(id) {
    if (id === 'af:home') { env.openArcforgeHome?.(); return; }
    if (id == null) return;
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
    if (id.startsWith('lv:')) { S.setup.level = id.slice(3); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('pace:')) { S.paceIdx = Number(id.slice(5)); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('side:')) { S.setup.side = Number(id.slice(5)); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('pc:')) { S.setup.pieces = Number(id.slice(3)); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('theme:')) { S.themeId = id.slice(6); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('lang:')) { S.lang = id.slice(5); saveSettings(); S.scroll = {}; SOUNDS.ui(); return; }
    if (id.startsWith('les:')) { SOUNDS.ui(); startLesson(Number(id.slice(4))); return; }
    switch (id) {
      case 'play': gotoScene('setup'); return;
      case 'continue': continueGame(); return;
      case 'start': saveSettings(); startMatch({ ...S.setup }); return;
      case 'learn': gotoScene('learn'); return;
      case 'auto': startAuto(); return;
      case 'howto': case 'rules': case 'about': case 'settings': gotoScene(id); return;
      case 'back': case 'menu': gotoScene('title'); return;
      case 'prev': S.page[S.scene] = Math.max(0, S.page[S.scene] - 1); S.scroll = {}; SOUNDS.ui(); return;
      case 'next': {
        const total = S.scene === 'rules' ? RULE_COUNT : HOWTO_COUNT;
        if (S.scene === 'howto' && S.page.howto >= total - 1) { activate('play'); return; }
        S.page[S.scene] = Math.min(total - 1, S.page[S.scene] + 1); S.scroll = {}; SOUNDS.ui(); return;
      }
      case 'set:sound': S.sound = !S.sound; audio.setMuted(!S.sound); saveSettings(); if (S.sound) SOUNDS.ui(); return;
      case 'set:single': S.autoSingle = !S.autoSingle; saveSettings(); SOUNDS.ui(); return;
      case 'set:think-': S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); return;
      case 'set:think+': S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); return;
      case 'set:restore': Promise.resolve(env.monetization?.restore?.()).then(refreshOwns); return;
      case 'set:unlock': Promise.resolve(env.monetization?.purchase?.('unlock_game')).then(refreshOwns); return;
      case 'set:reset':
        if (!S.resetArm) { S.resetArm = true; return; }
        S.stats = {}; S.lessons = {}; S.save = null; S.progress = { games: 0, wins: 0 };
        saveStats(); saveLessons(); storage.set('tb.save', null); storage.set('tb.progress', S.progress); S.resetArm = false; return;
      case 'ov:resume': S.overlay = null; return;
      case 'ov:restart': S.overlay = null; doRestart(); return;
      case 'ov:menu': S.overlay = null; leaveToMenu(); return;
      case 'ov:again': S.overlay = null; startMatch(S.lastOpts ?? { ...S.setup }); return;
      case 'ov:setup': S.overlay = null; S.match = null; gotoScene('setup'); return;
      case 'ov:lessons': S.overlay = null; S.match = null; gotoScene('learn'); return;
      case 'ov:lessonretry': S.overlay = null; return;
      case 'ov:lessonagain': S.overlay = null; startLesson(S.lessonIdx); return;
      case 'ov:lessonnext': { S.overlay = null; const n = S.lessonIdx + 1; if (n >= LESSONS.length) { S.match = null; gotoScene('learn'); } else startLesson(n); return; }
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
    S.toast = null;
    if (S.scene === 'play' && !S.overlay && S.match) { playDown(x, y); return; }
    if (S.scene === 'auto' && !S.overlay) { autoDown(x, y); return; }
    const ui = buildUi(S);
    if (!ui.layout) return;
    if (S.scene === 'title') {
      const lk = titleLayout().lockup, zone = lk ? creditHit(lk) : null;
      if (zone && inRect(x, y, zone)) { S.press = { id: 'af:home', active: true, kind: 'fixed', rect: zone }; return; }
    }
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
    const pr = S.press;
    if (!pr) return;
    if (pr.kind === 'target') { pr.active = targetAt(x, y)?.key === pr.id; return; }
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
    const pr = S.press;
    S.press = null;
    if (!pr) return;
    if (pr.kind === 'target') {
      const t = S.scene === 'play' && S.match && !S.overlay ? targetAt(x, y) : null;
      if (t && t.key === pr.id) act(t);
      return;
    }
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

  // ---- play: what is under a finger. Returns { key, type: 'sq' | 'yard' | 'exit' | 'mat', sq? } or null.
  function targetAt(x, y) {
    const M = S.match;
    if (!M) return null;
    const { lay, geo } = playGeo(S, M);
    const p = M.st.turn;
    if (inRect(x, y, lay.mat)) return { key: 'mat', type: 'mat' };
    const [bx, by] = exitBadge(geo, p);
    if (Math.hypot(x - bx, y - by) <= Math.max(geo.s * 0.45, 34)) return { key: 'exit', type: 'exit' };
    const sq = squareAt(geo, x, y);
    if (sq >= 0) return { key: `sq${sq}`, type: 'sq', sq };
    const yr = yardRect(lay, geo.flip, p), n = M.st.pos[p].length;
    if (inRect(x, y, yr)) {
      const wait = M.st.pos[p].filter((v) => v === WAIT).length;
      for (let k = 0; k < wait; k++) { const [sx, sy, d] = slotXY(yr, n, k); if (Math.hypot(x - sx, y - sy) <= Math.max(d * 0.62, 34)) return { key: 'yard', type: 'yard' }; }
    }
    return null;
  }

  function playDown(x, y) {
    const { lay } = playGeo(S, S.match);
    if (inRect(x, y, lay.back)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: lay.back }; return; }
    if (inRect(x, y, lay.pause)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: lay.pause }; return; }
    for (let i = 0; i < TOOLBAR_IDS.length; i++) {
      if (inRect(x, y, lay.tool[i])) { S.press = { id: `tool:${TOOLBAR_IDS[i]}`, active: true, kind: 'tool', rect: lay.tool[i] }; return; }
    }
    const t = targetAt(x, y);
    if (t) S.press = { id: t.key, active: true, kind: 'target' };
  }
  function hudAction(id) {
    if (id === 'hud:back') leaveToMenu();
    else if (id === 'hud:pause') { S.overlay = 'pause'; S.ovT = 0; }
  }
  function doThrow() {
    const M = S.match;
    if (!M) return;
    if (canThrow(M)) { cancelHint(); startThrow(M, rng); return; }
    if (M.over || M.throwAnim || M.anim) return;
    if (!isHumanSide(M, M.st.turn)) refuse(M, 'refuseNotTurn');
    else if (M.st.phase === 'move') refuse(M, 'refuseNoStone');
  }
  // A tap that ended on a target.
  function act(t) {
    const M = S.match;
    if (!M || M.over) return;
    if (t.type === 'mat') { doThrow(); return; }
    if (M.anim || M.throwAnim) return;
    if (!humanTurn(M)) { refuse(M, 'refuseNotTurn'); return; }
    if (M.st.phase === 'throw') { refuse(M, 'refuseThrow'); return; }
    const st = M.st, p = st.turn;
    const gate = M.gate;
    if (t.type === 'yard') { tapStone(M, WAIT); return; }
    if (t.type === 'exit') { const r = tapTarget(M, HOME, gate); if (r === null) refuse(M, 'refuseNoStone'); return; }
    if (t.type === 'sq') {
      const pos = posOf(p, t.sq);
      if (st.pos[p].includes(pos)) {
        const dest = M.sel !== null && M.sel !== undefined && M.sel !== pos && movesOf(M).some((m) => m.from === M.sel && m.to === pos);
        if (!dest) { const r = tapStone(M, pos); if (r === 'refuse') M.flashSq = t.sq; return; }
      }
      const r = tapTarget(M, pos, gate);
      if (r === null) {
        M.flashSq = t.sq;
        const enemySafe = isSafe(t.sq) && st.pos[1 - p].includes(posOf(1 - p, t.sq));
        refuse(M, enemySafe ? 'refuseSafe' : M.sel !== null && M.sel !== undefined ? 'refuseNoMove' : 'refuseNoStone');
      }
    }
  }
  function toolAction(id) {
    const M = S.match;
    if (!M) return;
    if (id === 'throw') doThrow();
    else if (id === 'undo') { if (S.canUndo) { cancelHint(); undoMatch(M); } else toast(T('undo')); }
    else if (id === 'think') doThink();
  }

  // ---- auto
  function autoDown(x, y) {
    const pl = playLayout(TEXT_SCALES[S.textIdx]);
    if (inRect(x, y, pl.back)) { S.press = { id: 'auto:exit', active: true, kind: 'auto', rect: pl.back }; return; }
    const lay = autoLayout(TEXT_SCALES[S.textIdx]);
    for (const id of ['slower', 'pause', 'faster']) {
      if (inRect(x, y, lay[id])) { S.press = { id: `auto:${id}`, active: true, kind: 'auto', rect: lay[id] }; return; }
    }
  }
  function autoAction(id) {
    if (id === 'auto:exit') { S.auto = null; S.match = null; gotoScene('title'); }
    else if (id === 'auto:pause') S.auto.paused = !S.auto.paused;
    else if (id === 'auto:slower') { S.speedIdx = Math.max(0, S.speedIdx - 1); saveSettings(); }
    else if (id === 'auto:faster') { S.speedIdx = Math.min(AUTO_SPEEDS.length - 1, S.speedIdx + 1); saveSettings(); }
  }

  // ---- keyboard
  function onKeys(keys) {
    const has = (c) => keys.pressed.has(c);
    if (S.scene === 'play' && !S.overlay && S.match) {
      if (has('Space') || has('Enter')) doThrow();
      if (has('KeyU')) toolAction('undo');
      if (has('KeyT')) toolAction('think');
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
    if (has('Escape') && ['setup', 'learn', 'howto', 'rules', 'about', 'settings', 'demo-limit'].includes(S.scene)) gotoScene('title');
    if (S.scene === 'howto' || S.scene === 'rules') {
      const rui = buildUi(S);
      if (rui.layout && rui.region) {
        const by = (d) => setScroll(rui, getScroll(rui) + d);
        if (has('PageDown') || has('Space')) by(rui.region.h * 0.85);
        if (has('PageUp')) by(-rui.region.h * 0.85);
        if (has('Home')) setScroll(rui, 0);
        if (has('End')) setScroll(rui, 1e9);
      }
    }
  }

  // The live virtual size (rotation, window resize): everything is laid out from it. A press in flight belongs to the old layout.
  let sizeKey = '';
  function syncSize() {
    setLive(meta.width, meta.height); setSize(meta.width, meta.height);
    const k = `${meta.width}x${meta.height}`;
    if (k === sizeKey) return;
    if (sizeKey) { S.press = null; S.scrollVel = {}; }
    sizeKey = k;
  }
  const keepScrollInRange = (ui) => { if (ui.layout && ui.region && S.scroll[ui.scrollKey] > 0) S.scroll[ui.scrollKey] = clampScroll(S.scroll[ui.scrollKey], ui.layout.height, ui.region.h); };

  // ------------------------------------------------------------------------------ main loop
  return {
    update(dt, input) {
      updAt = nowMs(); stepped = true;
      syncSize();
      // pictures of the sticks are painted a few per frame in the background (fixed work per frame, no clock)
      { const d = stickDims(S.scene === 'play' || S.scene === 'auto' ? playLayout(TEXT_SCALES[S.textIdx]).mat.h : 318); bakeSticks(th(), d.L, d.Wd, S.shot ? 80 : 4); }
      // Watch & Learn's Pause (and the in-game pause card) freezes the whole loop: timers, search, animations, particles, the clock.
      const frozen = (S.scene === 'auto' && S.auto && S.auto.paused) || S.overlay === 'pause';
      if (!frozen) S.t += dt;
      if (S.overlay) S.ovT += dt;
      if (S.toastT > 0) { S.toastT -= dt; if (S.toastT <= 0) S.toast = null; }
      const ptr = S.shot ? { pressed: false, down: false, released: false, x: 0, y: 0 } : input.pointer;
      if (ptr.pressed) onDown(ptr.x, ptr.y);
      else if (ptr.down) onMove(ptr.x, ptr.y, dt);
      if (ptr.released) onUp(ptr.x, ptr.y);
      else if (S.press && S.press.kind === 'target' && !ptr.down && !ptr.pressed && !S.shot) {
        // The release never reached us (the preview gate held the game, the app was backgrounded): let go where the finger last was.
        const p = S.press; S.press = null;
        const t = S.match && S.scene === 'play' && !S.overlay ? targetAt(S.lastPtr.x, S.lastPtr.y) : null;
        if (t && t.key === p.id) act(t);
      }
      if (ptr.down || ptr.pressed) { S.lastPtr.x = ptr.x; S.lastPtr.y = ptr.y; }
      if (!S.shot && (input.keys.pressed.size || input.keys.down.size)) onKeys(input.keys);

      if ((S.scene === 'howto' || S.scene === 'rules') && S.page[S.scene] > 0) {   // store-shot scenes open the reader at a given page
        const ui = buildUi(S), it = ui.layout && ui.layout.items.find((q) => q.b.anchor === S.page[S.scene]);
        S.page[S.scene] = 0; if (it) setScroll(ui, it.y);
      }
      if (S.wheel) {
        const ui = buildUi(S);
        if (ui.layout && ui.region) setScroll(ui, getScroll(ui) + S.wheel);
        S.wheel = 0;
      }
      for (const k of Object.keys(S.scrollVel)) {
        const v = S.scrollVel[k];
        if (Math.abs(v) < 8) { delete S.scrollVel[k]; continue; }
        const ui = buildUi(S);
        if (ui.scrollKey === k && ui.layout && ui.region) setScroll(ui, (S.scroll[k] ?? 0) + v * dt);
        S.scrollVel[k] = v * Math.exp(-dt * 5);
      }

      const M = S.match;
      if (M && !S.shot) {
        // the game speed setting plays throws, moves and the computer's waits faster; Watch & Learn has its own speed
        S.pace = S.scene === 'auto' ? AUTO_SPEEDS[S.speedIdx] : PACES[S.paceIdx];
        const pdt = dt * S.pace;
        if (S.scene === 'play') {
          if (!frozen) { stepMatch(M, pdt, rng); stepHint(dt); stepSingle(M, pdt); }
          S.canUndo = canUndo(M);
        } else if (S.scene === 'auto' && !frozen) { stepMatch(M, pdt, rng); updateAuto(pdt); }
        if (S.scene === 'play' || S.scene === 'auto') {
          handleEvents(M);
          if (!frozen) stepWinSeq(dt);
        }
        // Lessons: the right answer shows its explanation once the stone has landed. A finished game shows its result card.
        const L = M.lesson, plain = L && L.type !== 'game';
        if (S.scene === 'play' && !S.overlay && plain) {
          if (L.accept === 'throw' && M.st.phase === 'move' && settled(M) && !S.lessonOk) { S.lessonWait = 0; S.lessonOk = { ok: true }; }
          if (S.lessonOk) {
            if (settled(M)) S.lessonWait += dt;
            if (S.lessonWait > 0.9) {
              S.lessons[L.id] = true; saveLessons();
              S.lessonInfo = { ok: true, head: T('lessonDone'), body: lessonText(L, S.lang).done };
              S.overlay = 'lesson'; S.ovT = 0; S.lessonOk = null;
              SOUNDS.hint();
            }
          }
        }
        if (S.scene === 'play' && M.over && !S.overlay && !plain && M.overT > 1.6) { S.overlay = 'end'; S.ovT = 0; }
      }
    },

    render(ctx) {
      syncSize();
      S.alpha = stepped && env.clock ? Math.max(0, Math.min(1, (nowMs() - updAt) / (STEP * 1000))) : 1;
      const ui = buildUi(S); keepScrollInRange(ui);
      render(ctx, S, ui);
    },

    scrollBy(px) { S.wheel += px; },
    // Layout check hook (dev tools and the resize test): every tappable rectangle of the current screen, in screen units.
    layoutInfo() {
      const ui = buildUi(S), out = { scene: S.scene, overlay: S.overlay, size: [meta.width, meta.height], fixed: [], doc: [], region: ui.region ?? null, panel: ui.panel ?? null, play: null };
      for (const f of ui.fixed) if (f.id != null) out.fixed.push({ id: f.id, ...f.rect });
      if (ui.nav) for (const f of [ui.nav.prev, ui.nav.next]) out.fixed.push({ id: f.id, ...f.rect });
      if (ui.layout && ui.region) for (const it of ui.layout.items) for (const b of it.btns) if (b.id != null) out.doc.push({ id: b.id, x: ui.region.x + b.x, y: ui.region.y + (ui.offY || 0) + b.y - (S.scroll[ui.scrollKey] ?? 0), w: b.w, h: b.h });
      if (S.match && (S.scene === 'play' || S.scene === 'auto')) { const pl = playLayout(TEXT_SCALES[S.textIdx]); out.play = { mode: pl.mode, rects: pl.rects, auto: S.scene === 'auto', boardGeo: playGeo(S, S.match).geo.sqXY(0) }; }
      return out;
    },
        // the mouse wheel and the tests use the same path

    getState() {
      const M = S.match;
      return {
        scene: S.scene, overlay: S.overlay, textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, theme: S.themeId, lang: S.lang, setup: S.setup,
        stats: S.stats, lessons: Object.keys(S.lessons).length, lessonIdx: S.lessonIdx, page: S.page, scroll: S.scroll, demoGames: S.demoGames, saved: Boolean(S.save),
        auto: S.auto ? { phase: S.auto.phase, t: Math.round(S.auto.t * 100) / 100, paused: S.auto.paused } : null,
        match: M ? {
          level: M.level, human: M.human, two: M.two, pos: M.st.pos.map((a) => a.join(',')).join('|'), turn: M.st.turn, phase: M.st.phase, pending: M.st.pending.join(','), plies: M.st.plies,
          sel: M.sel, over: M.over ? M.over.winner : null, hint: M.hint ? [M.hint.mv.from, M.hint.mv.to] : null, anim: M.anim ? 1 : 0, throwing: M.throwAnim ? 1 : 0,
          thinking: M.thinking ? 1 : 0, log: M.log.length,
        } : null,
      };
    },

    // The preview clock counts live action only: sticks in the air, a stone travelling, the computer's turn. Menus, setup, Learn,
    // Rules / How to Play / About, Settings, every overlay (pause, result, lesson, Watch & Learn summary), the demo card, the lessons,
    // Watch & Learn, a finished game and the player's own idle moments (waiting to throw, choosing a stone) are all free time.
    // Developer mode (env.config.dev) never spends the preview.
    isPreviewExempt: () => S.shot || S.dev || S.scene !== 'play' || Boolean(S.overlay) || !S.match || Boolean(S.match.lesson) || Boolean(S.match.over) || humanTurn(S.match),
  };
}
