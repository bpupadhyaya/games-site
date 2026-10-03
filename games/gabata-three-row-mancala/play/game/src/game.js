// GAME CONTRACT (docs/GAME-CONTRACT.md). Gabata (Three-Row Sowing): the Ethiopian and Eritrean three-row sowing game with a
// five-level engine, a tutor path, Watch & Learn, English and an Amharic key-terms choice.
import { SCREEN, inRect, BACK_BTN, PAUSE_BTN, TOOLBAR_IDS, autoLayout, playLayout } from './layout.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, THINK_STEPS, demoOver, recKey } from './screens.js';
import { legalMoves, CIRCUIT, outcome } from './engine.js';
import { LEVELS, chooseMove, rankMoves } from './ai.js';
import { hint, reasonFor, moveWords, THINK_DEPTH } from './explain.js';
import { LESSONS, lessonStart, judge, lessonText } from './lessons.js';
import { createMatch, startMove, undoMatch, tapCell, stepMatch, spark, canUndo, humanTurn } from './match.js';
import { RULE_COUNT, HOWTO_COUNT, tr, setLang, levelName, hintText, notBestText, setCalibration } from './content.js';
import { CAL_EN } from './calibration.js';
import { THEMES, boardGeo, cellAt, CELLS } from './art.js';
import { render, plateIcons } from './view.js';

export const meta = { width: SCREEN.width, height: SCREEN.height };

const VERSION = '1.0.0';
const WIN_NOTES = [523, 659, 784, 1047, 1319];
const AUTO_GAMES = [{ lv: ['master', 'master'] }, { lv: ['master', 'expert'] }];
const KEY = 'gb';
const DEFAULT_SETUP = { level: 'club', side: 1 };
// the mover's own holes in screen order (top to bottom, left to right), for keyboard play
const ownSorted = (turn) => [...CIRCUIT[turn]].sort((a, b) => a - b);
const nearRowHole = (turn, col) => (turn === 1 ? 12 + col : col);

export async function createGame(env) {
  const { rng, storage, audio, config } = env;
  setCalibration(CAL_EN);
  const attractRng = rng.fork();
  const nowMs = () => (env.clock ? env.clock() : 0); // display clock from the shell (drawing only); absent in headless runs, so alpha stays 1

  const S = {
    alpha: 1, updAt: 0, scene: 'title', overlay: null, t: 0, ovT: 0, sound: true, themeId: 'acacia', textIdx: 0, thinkIdx: 1, lang: 'en',
    setup: { ...DEFAULT_SETUP }, stats: {}, lessons: {}, save: null, demoGames: 0, progress: { games: 0, wins: 0 },
    page: { howto: 0, rules: 0 }, scroll: {}, scrollVel: {}, press: null, match: null, auto: null, lessonIdx: 0, endInfo: null, lessonInfo: null,
    toast: null, toastT: 0, kbd: false, canUndo: false, lessonWait: -1, lessonOk: null, lastOpts: null, sumText: '', attract: null, attractT: 0,
    demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, price: '', resetArm: false, version: VERSION, shot: false, lastPtr: { x: 0, y: 0 }, winSeq: null,
  };

  const [set, stats, les, save, dg, prog] = await Promise.all([storage.get(`${KEY}.settings`, null), storage.get(`${KEY}.stats`, null), storage.get(`${KEY}.lessons`, null), storage.get(`${KEY}.save`, null), storage.get(`${KEY}.demo`, 0), storage.get(`${KEY}.progress`, null)]);
  let langChosen = false;
  if (set) {
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (THEMES.some((t) => t.id === set.themeId)) S.themeId = set.themeId;
    if (Number.isInteger(set.textIdx)) S.textIdx = Math.min(Math.max(set.textIdx, 0), TEXT_SCALES.length - 1);
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = Math.min(Math.max(set.thinkIdx, 0), THINK_STEPS.length - 1);
    if (set.lang === 'en' || set.lang === 'am') { S.lang = set.lang; langChosen = true; }
    if (set.setup) {
      const lv = set.setup.level === 'two' || LEVELS.some((l) => l.id === set.setup.level) ? set.setup.level : 'club';
      S.setup = { level: lv, side: set.setup.side === 2 ? 2 : 1 };
    }
  }
  if (stats && typeof stats === 'object') S.stats = stats;
  if (les && typeof les === 'object') S.lessons = les;
  if (save && Array.isArray(save.moves)) S.save = save;
  if (Number.isInteger(dg)) S.demoGames = dg;
  if (prog && Number.isInteger(prog.wins) && Number.isInteger(prog.games)) S.progress = { games: prog.games, wins: prog.wins };
  setLang(S.lang);
  if (!langChosen) S.scene = 'lang';
  audio.setMuted(!S.sound);
  // The price shown is the store's localized price when the shell knows it, else the game.json price (kit priceOf).
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);

  const saveSettings = () => storage.set(`${KEY}.settings`, { sound: S.sound, themeId: S.themeId, textIdx: S.textIdx, thinkIdx: S.thinkIdx, lang: S.lang, setup: S.setup });
  const saveStats = () => storage.set(`${KEY}.stats`, S.stats);
  const saveLessons = () => storage.set(`${KEY}.lessons`, S.lessons);
  const saveGame = () => {
    const M = S.match;
    if (S.scene !== 'play' || !M || M.lesson || M.auto) return;
    S.save = M.over || !M.hist.length ? null : { level: M.level, human: M.human, two: M.two, moves: M.hist.map((h) => h.mv.cell) };
    storage.set(`${KEY}.save`, S.save);
  };

  // ------------------------------------------------------------------------------ sound
  const sfx = (o) => { if (S.sound) audio.tone(o); };
  const SOUNDS = {
    pick: () => { sfx({ freq: 300, to: 220, dur: 0.07, type: 'triangle', vol: 0.1 }); sfx({ freq: 1100, dur: 0.02, type: 'square', vol: 0.025 }); },
    land: (cell, k) => { const f = 420 + ((cell * 37 + k * 23) % 7) * 40; sfx({ freq: f, to: f * 0.7, dur: 0.045, type: 'triangle', vol: 0.085 }); sfx({ freq: 150, to: 110, dur: 0.06, type: 'sine', vol: 0.05 }); },
    capture: (big) => { [660, 880, 1100].slice(0, big ? 3 : 2).forEach((f, i) => sfx({ freq: f, dur: 0.18 + i * 0.05, type: 'sine', vol: 0.1 - i * 0.015 })); if (big) sfx({ freq: 196, dur: 0.4, type: 'triangle', vol: 0.1 }); },
    clink: () => sfx({ freq: 1500, to: 1900, dur: 0.05, type: 'sine', vol: 0.04 }),
    select: () => sfx({ freq: 620, to: 760, dur: 0.06, type: 'sine', vol: 0.08 }),
    refuse: () => sfx({ freq: 170, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.06 }),
    undo: () => sfx({ freq: 520, to: 330, dur: 0.1, type: 'triangle', vol: 0.1 }),
    hint: () => { sfx({ freq: 660, dur: 0.12, type: 'sine', vol: 0.1 }); sfx({ freq: 990, dur: 0.18, type: 'sine', vol: 0.06 }); },
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.08 }),
    lose: () => { [392, 330, 262].forEach((f, i) => sfx({ freq: f, to: f * 0.96, dur: 0.4, type: 'sine', vol: 0.09 - i * 0.01 })); },
    draw: () => { sfx({ freq: 440, dur: 0.3, type: 'sine', vol: 0.09 }); sfx({ freq: 392, dur: 0.4, type: 'sine', vol: 0.07 }); },
  };

  // ------------------------------------------------------------------------------ geometry
  const layNow = () => playLayout(TEXT_SCALES[S.textIdx]);
  const geoNow = () => { const lay = layNow(); return boardGeo(lay.board.x, lay.board.y, lay.board.w); };
  // Where captured stones fly to: the stone icon of each player's plate, in board units.
  const setTargets = (M) => {
    const lay = layNow(), geo = boardGeo(lay.board.x, lay.board.y, lay.board.w);
    const t = (r) => geo.toLocal(...plateIcons(r).dan);
    M.pileTo = [t(lay.chips[1]), t(lay.chips[0])];
  };

  // ------------------------------------------------------------------------------ matches
  function launch(M) {
    S.match = M; S.scene = M.auto ? 'auto' : 'play'; S.overlay = null; S.press = null; S.endInfo = null; S.lessonInfo = null; S.winSeq = null; S.toast = null;
    S.lessonWait = -1; S.lessonOk = null; S.sumText = ''; S.wasBusy = false; M.sum = null;
  }
  function startMatch(opts, count = true) {
    if (count && demoOver(S)) { S.scene = 'demo-limit'; S.overlay = null; return; }
    const two = opts.level === 'two';
    const M = createMatch({ level: two ? 'club' : opts.level, human: opts.side ?? 1, two, lesson: opts.lesson ?? null, start: opts.start });
    if (count && S.demo) { S.demoGames += 1; storage.set(`${KEY}.demo`, S.demoGames); }
    launch(M);
    if (!opts.lesson) { S.lastOpts = opts; S.save = null; storage.set(`${KEY}.save`, null); }
  }
  function continueGame() {
    const sv = S.save;
    if (!sv) return;
    const M = createMatch({ level: sv.level, human: sv.human ?? 1, two: sv.two });
    for (const cell of sv.moves) {
      const mv = legalMoves(M.st).find((m) => m.cell === cell);
      if (!mv) break;
      startMove(M, mv, true);
    }
    launch(M);
    S.lastOpts = { level: sv.two ? 'two' : sv.level, side: sv.human ?? 1 };
    S.overlay = 'pause'; S.ovT = 0; // a resumed game starts paused
  }
  function startLesson(i) {
    const L = LESSONS[i];
    if (!L || (S.demo && i >= 3)) { S.scene = 'demo-limit'; S.overlay = null; return; }
    S.lessonIdx = i;
    if (L.type === 'game') { startMatch({ level: L.level, side: L.human ?? 1, lesson: L }, false); return; }
    startMatch({ level: 'club', side: 1, lesson: L, start: lessonStart(L) }, false);
    const M = S.match;
    M.gate = (mv) => {
      const j = judge(L, M.st, mv);
      if (!j.ok) { S.lessonInfo = { ok: false, head: tr('notQuite'), body: j.text }; S.overlay = 'lesson'; S.ovT = 0; SOUNDS.refuse(); return false; }
      S.lessonOk = j; S.lessonWait = 0;
      return true;
    };
  }

  const youName = (M, who) => (M.two || M.auto ? (who === 1 ? tr('p1') : tr('p2')) : who === M.human ? tr('youWord') : levelName(M.level));
  function onEnd(M) {
    const o = M.over, w = o.winner;
    const lessonGame = M.lesson && M.lesson.type === 'game';
    const youWon = !M.two && !M.auto && w === M.human;
    let head;
    if (w === 0) head = tr('drawWord');
    else if (M.two || M.auto || M.lesson) head = tr('winsWord', { who: w === 1 ? tr('p1') : tr('p2') });
    else head = youWon ? tr('youWon') : tr('youLost', { who: levelName(M.level) });
    const me = M.two || M.auto ? 1 : M.human;
    const mine = me === 1 ? o.a : o.b, theirs = me === 1 ? o.b : o.a;
    let body = tr('finalScore', { a: mine, b: theirs });
    if (o.capped) body += tr('cappedNote', { n: 240 });
    let rec = '', lessonOk = false;
    if (!M.two && !M.auto && !M.lesson) {
      const key = recKey({ level: M.level });
      const r = S.stats[key] ?? [0, 0, 0];
      r[w === 0 ? 1 : youWon ? 0 : 2] += 1;
      S.stats[key] = r; saveStats();
      S.progress.games += 1; if (youWon) S.progress.wins += 1; storage.set(`${KEY}.progress`, S.progress);
      rec = `${tr('record')}: ${r[0]} ${tr('wins')}  ${r[1]} ${tr('draws')}  ${r[2]} ${tr('losses')}`;
      S.save = null; storage.set(`${KEY}.save`, null);
    }
    if (lessonGame) {
      lessonOk = true;
      S.lessons[M.lesson.id] = true; saveLessons(); body = `${body} ${lessonText(M.lesson.id).done}`;
    }
    S.endInfo = { head, body, rec, winner: w, lessonOk };
    if (w === 0) SOUNDS.draw();
    else if (M.two || M.auto || M.lesson || youWon) S.winSeq = { t: 0, i: 0 };
    else SOUNDS.lose();
  }

  function sumLine(M) {
    const s = M.sum;
    if (!s) return '';
    const who = s.who;
    const gain = s.n;
    let line;
    if (gain <= 0) line = tr('tookNothing');
    else if (!M.two && !M.auto && who === M.human) line = tr('youTook', { n: gain });
    else line = tr('theyTook', { who: youName(M, who), n: gain });
    return line;
  }

  function handleFx(M) {
    for (const e of M.fx) {
      if (e.t === 'pick') SOUNDS.pick();
      else if (e.t === 'land') SOUNDS.land(e.cell, e.k);
      else if (e.t === 'capture') { SOUNDS.capture(e.n >= 5); for (const c of e.cells) spark(M, rng, c, e.n >= 5); M.sum = M.sum ?? { who: e.who, n: 0 }; M.sum.n += e.n; }
      else if (e.t === 'pileclink') SOUNDS.clink();
      else if (e.t === 'refuse') SOUNDS.refuse();
      else if (e.t === 'undo') SOUNDS.undo();
      else if (e.t === 'over') onEnd(M);
    }
    M.fx.length = 0;
    if (M.busy) S.wasBusy = true;
    else if (S.wasBusy) { S.wasBusy = false; S.sumText = sumLine(M); M.sum = null; }
  }
  function beginMove(M) { M.sum = null; S.sumText = ''; }

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

  // ------------------------------------------------------------------------------ the title's attract board
  function newAttract() {
    const M = createMatch({ level: 'club', human: 1, two: true });
    M.auto = true; M.autoLv = ['club', 'club']; M.freeze = true; M.pileTo = [[60, -50], [60, 480]];
    S.attract = M; S.attractT = 0;
  }
  function stepAttract(dt) {
    let M = S.attract;
    if (!M) { newAttract(); M = S.attract; }
    stepMatch(M, dt, attractRng);
    for (const e of M.fx) if (e.t === 'capture') for (const c of e.cells) spark(M, attractRng, c, e.n >= 5);
    M.fx.length = 0;
    if (M.over && M.overT > 3.2) { newAttract(); return; }
    if (!M.busy && !M.over) {
      S.attractT += dt;
      if (S.attractT > 0.9) { S.attractT = 0; const mv = chooseMove(M.st, 'club', attractRng); if (mv) startMove(M, mv); }
    }
  }

  // ------------------------------------------------------------------------------ Watch & Learn
  function startAutoGame() {
    const a = S.auto, g = AUTO_GAMES[a.k];
    const M = createMatch({ auto: true });
    M.autoLv = g.lv;
    S.match = M; S.winSeq = null; S.endInfo = null; S.sumText = ''; S.wasBusy = false;
    Object.assign(a, { phase: 'intro', t: 0, plan: null, scan: null, note: { head: '', why: '' } });
  }
  function startAuto() {
    S.auto = { k: 0, phase: 'intro', t: 0, paused: false, plan: null, scan: null, note: { head: '', why: '' } };
    S.scene = 'auto'; S.overlay = null; S.press = null;
    startAutoGame();
  }
  function planAuto() {
    const a = S.auto, M = S.match, st = M.st;
    const ranked = rankMoves(st, THINK_DEPTH);
    const mv = chooseMove(st, M.autoLv[st.turn - 1], rng) ?? ranked[0].mv;
    let top = -Infinity;
    for (const r of ranked) if (r.v > top) top = r.v;
    const best = ranked.find((r) => r.v >= top - 1e-9);
    const mine = ranked.find((r) => r.mv.cell === mv.cell);
    const w = moveWords(mv), r = reasonFor(st, mv, ranked);
    let note = hintText(r, w);
    if (!mine || mine.v < top - 1e-9) note = { head: note.head, why: notBestText(hintText(r, moveWords(best.mv)).head.toLowerCase()) };
    a.plan = { mv, cells: legalMoves(st).map((m) => m.cell) };
    a.note = note;
  }
  // THINK (configurable) -> REVEAL (2 s: the options light up and the chosen one is marked) -> ACT (the sowing)
  function updateAuto(dt) {
    const a = S.auto, M = S.match;
    if (a.paused) return;
    a.t += dt;
    if (a.phase === 'intro') {
      if (a.t >= 1.2) { a.phase = 'think'; a.t = 0; planAuto(); }
    } else if (a.phase === 'think') {
      const cells = CIRCUIT[M.st.turn].filter((c) => M.st.cells[c] > 0);
      a.scan = cells.length ? cells[Math.floor(a.t / 0.5) % cells.length] : null;
      if (a.t >= THINK_STEPS[S.thinkIdx]) { a.phase = 'reveal'; a.t = 0; a.scan = null; }
    } else if (a.phase === 'reveal') {
      if (a.t >= 2) { a.phase = 'act'; a.t = 0; beginMove(M); startMove(M, a.plan.mv); }
    } else if (a.phase === 'act') {
      if (a.t >= 0.4 && !M.busy) {
        if (M.over) { a.phase = 'celebrate'; a.t = 0; } else { a.phase = 'think'; a.t = 0; planAuto(); }
      }
    } else if (a.phase === 'celebrate') {
      if (a.t >= 3.4) {
        if (a.k + 1 < AUTO_GAMES.length) { a.k += 1; startAutoGame(); } else { S.overlay = 'autosum'; S.ovT = 0; a.phase = 'summary'; }
      }
    }
  }

  // ------------------------------------------------------------------------------ store screenshots
  // `tools/arc shots` loads ?shot=1&seed=N. Seeds 900001.. stage a real moment instead of random play; 901001+ and 902001+ show
  // the Rules pages at 100 and 300 percent; 903001+ show the Rules pages in the Amharic mode.
  function stageShot(n) {
    const settle = (M, secs) => { for (let i = 0; i < secs * 60; i++) { setTargets(M); stepMatch(M, 1 / 60, rng); handleFx(M); } };
    const mk = (opts) => { S.setup = { ...DEFAULT_SETUP, ...opts }; startMatch({ ...S.setup }, false); return S.match; };
    // play n computer moves for both sides, silently, to reach a mid-game position
    const warm = (M, k, lv = 'club') => { for (let i = 0; i < k && !M.st.over; i++) { const mv = chooseMove(M.st, lv, rng); startMove(M, mv, true); } };
    const mine = (M) => { if (M.st.turn !== 1) warm(M, 1); };
    const longest = (M) => { let best = null, bn = -1; for (const m of legalMoves(M.st)) { const c = M.st.cells[m.cell]; if (c > bn) { bn = c; best = m; } } return best; };
    const next = (M, lv = 'club') => { const mv = chooseMove(M.st, lv, rng); beginMove(M); startMove(M, mv); return mv; };
    const showHint = (M) => { const h = hint(M.st); M.hint = { mv: h.mv, ...hintText(h, moveWords(h.mv)) }; };
    S.shot = true;
    S.stats = { club: [3, 1, 2], expert: [1, 0, 3] };
    ['capture', 'relay', 'column'].forEach((id) => { S.lessons[id] = true; });
    S.lang = S.lang === 'am' ? 'am' : 'en';
    if (n === 1) { const M = mk({}); warm(M, 4); mine(M); settle(M, 0.5); }
    else if (n === 2) { const M = mk({}); warm(M, 3); mine(M); const mv = longest(M); beginMove(M); startMove(M, mv); settle(M, 0.9); }
    else if (n === 3) {
      // a real capture: find a position where the player to move captures 4+, play it and stop while the seeds fly to the pile
      let M = null, mv = null;
      for (let trial = 0, k = 4; trial < 160 && !mv; trial++, k = 3 + (trial % 8)) {
        M = mk({}); warm(M, k, 'casual');
        if (M.st.over || M.st.turn !== 1) continue;
        mv = legalMoves(M.st).find((m) => { const o = outcome(M.st, m); return o.got >= 4 && !o.after.over; }) ?? null;
      }
      if (mv) { beginMove(M); startMove(M, mv); let seen = 0; for (let i = 0; i < 900; i++) { setTargets(M); stepMatch(M, 1 / 60, rng); if (M.fx.some((e) => e.t === 'capture')) seen = 1; handleFx(M); if (seen && ++seen > 40) break; } }
    }
    else if (n === 4) { const M = mk({}); warm(M, 4); mine(M); showHint(M); settle(M, 0.5); }
    else if (n === 5) { S.thinkIdx = 0; startAuto(); S.auto.k = 1; startAutoGame(); const M = S.match; warm(M, 5); settle(M, 0.3); S.auto.phase = 'reveal'; S.auto.t = 1; planAuto(); }
    else if (n === 6) { const M = mk({ level: 'two' }); warm(M, 5); settle(M, 0.5); }
    else if (n === 7) { S.lang = 'am'; setLang('am'); const M = mk({}); warm(M, 5); mine(M); settle(M, 0.5); }
    else if (n === 8) { S.scene = 'setup'; S.setup = { ...DEFAULT_SETUP, level: 'expert' }; }
    else if (n === 9) { S.scene = 'learn'; }
    else if (n === 10) { S.themeId = 'clay'; const M = mk({}); warm(M, 4); mine(M); settle(M, 0.5); }
    else if (n === 11) { S.themeId = 'clay'; S.scene = 'title'; newAttract(); for (let i = 0; i < 60 * 5; i++) stepAttract(1 / 60); }
    else if (n === 12) { S.scene = 'title'; newAttract(); for (let i = 0; i < 60 * 7; i++) stepAttract(1 / 60); }
    else if (n === 13) { S.scene = 'lang'; newAttract(); for (let i = 0; i < 60 * 3; i++) stepAttract(1 / 60); }
    else if (n >= 14 && n <= 50) { // text-zoom and screen checks (QA only)
      S.textIdx = 4;
      if (n === 14) S.scene = 'title';
      else if (n === 15) S.scene = 'settings';
      else if (n === 16) S.scene = 'about';
      else if (n === 17) { const M = mk({}); warm(M, 80, 'master'); S.match.freeze = true; if (!M.over) { M.over = { winner: 1, a: 31, b: 23, capped: false }; } onEnd(M); S.overlay = 'end'; S.ovT = 1; }
      else if (n === 18) S.scene = 'learn';
      else if (n === 19) S.scene = 'setup';
      else if (n === 20) { const M = mk({}); warm(M, 4); settle(M, 0.5); S.overlay = 'pause'; S.ovT = 1; }
      else if (n === 21) S.scene = 'demo-limit';
      else if (n === 22) { S.scene = 'howto'; S.page.howto = 2; }
      else if (n === 23) { startAuto(); warm(S.match, 4); settle(S.match, 0.5); S.auto.phase = 'reveal'; S.auto.t = 1; planAuto(); S.auto.paused = true; }
      else if (n === 24) { S.demo = true; S.textIdx = 0; S.scene = 'title'; }
      else if (n === 25) { const M = mk({}); warm(M, 4); mine(M); showHint(M); settle(M, 0.3); }
      else if (n === 26) { S.textIdx = 0; S.lang = 'am'; setLang('am'); S.scene = 'title'; }
      else if (n === 27) { startLesson(2); S.textIdx = 2; settle(S.match, 0.5); }
      else if (n === 28) { S.textIdx = 0; startLesson(3); settle(S.match, 0.5); S.lessonInfo = { ok: false, head: tr('notQuite'), body: tr('lessonWrongNone') }; S.overlay = 'lesson'; S.ovT = 1; }
      else if (n === 29) { S.textIdx = 0; S.lang = 'am'; setLang('am'); S.scene = 'setup'; }
      else if (n === 30) { S.textIdx = 2; const M = mk({}); warm(M, 4); mine(M); settle(M, 0.5); }
      else if (n === 31) { S.textIdx = 0; S.lang = 'am'; setLang('am'); S.scene = 'settings'; }
      else if (n === 32) { S.textIdx = 0; S.lang = 'am'; setLang('am'); const M = mk({}); warm(M, 4); mine(M); settle(M, 0.3); }
      else if (n === 33) { S.textIdx = 0; const M = mk({ level: 'two' }); warm(M, 5); settle(M, 0.5); }
      else if (n === 34) { S.textIdx = 0; S.scene = 'settings'; }
      else if (n === 35) { S.textIdx = 0; S.scene = 'about'; }
      else if (n === 36) { S.textIdx = 0; S.lang = 'am'; setLang('am'); S.scene = 'about'; }
      else if (n === 37) { S.textIdx = 0; const M = mk({}); warm(M, 3); mine(M); next(M, 'master'); settle(M, 0.3); }
      else if (n === 38) { S.textIdx = 0; const M = mk({}); warm(M, 3); mine(M); next(M, 'master'); settle(M, 0.7); }
      else if (n === 39) { S.textIdx = 0; const M = mk({}); warm(M, 3); mine(M); next(M, 'master'); settle(M, 1.1); }
      else if (n === 40) { S.textIdx = 0; const M = mk({}); warm(M, 3); mine(M); next(M, 'master'); settle(M, 1.6); }
      else if (n >= 42 && n <= 48) { S.textIdx = 0; S.scene = 'howto'; S.page.howto = n - 42; }
    } else if (n >= 1001 && n <= 1030) { S.scene = 'rules'; S.page.rules = n - 1001; }
    else if (n >= 2001 && n <= 2030) { S.scene = 'rules'; S.page.rules = n - 2001; S.textIdx = 4; }
    else if (n >= 3001 && n <= 3030) { S.lang = 'am'; setLang('am'); S.scene = 'rules'; S.page.rules = n - 3001; }
  }
  const wantsShot = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search);
  const sd = config?.seed ?? 0;
  const shotSeed = wantsShot && ((sd >= 900001 && sd <= 900050) || (sd >= 901001 && sd <= 901030) || (sd >= 902001 && sd <= 902030) || (sd >= 903001 && sd <= 903030)) ? sd - 900000 : 0;
  if (shotSeed) stageShot(shotSeed);

  // ------------------------------------------------------------------------------ ui plumbing
  const getScroll = (ui) => S.scroll[ui.scrollKey] ?? 0;
  const setScroll = (ui, v) => { if (ui.layout && ui.region) S.scroll[ui.scrollKey] = clampScroll(v, ui.layout.height, ui.region.h); };

  function gotoScene(scene) {
    S.scene = scene; S.overlay = null; S.press = null; S.resetArm = false; S.scrollVel = {};
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
  function setLanguage(l) { S.lang = l; setLang(l); saveSettings(); S.scroll = {}; }
  function leaveToMenu() { saveGame(); S.match = null; S.auto = null; gotoScene('title'); }

  function doThink() {
    const M = S.match;
    if (!M || M.over || !humanTurn(M)) return;
    const h = hint(M.st);
    M.hint = { mv: h.mv, ...hintText(h, moveWords(h.mv)) };
    SOUNDS.hint();
  }
  function doRestart() {
    const M = S.match;
    if (!M || M.auto) return;
    if (M.lesson) { startLesson(S.lessonIdx); return; }
    startMatch(S.lastOpts ?? { level: M.two ? 'two' : M.level, side: M.human }, S.demo);
  }
  const toast = (msg) => { S.toast = msg; S.toastT = 2.2; };
  const play = (M, cell) => { beginMove(M); if (tapCell(M, cell) === 'play') { saveGame(); return true; } return false; };

  function activate(id) {
    if (id == null) return;
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
    if (id.startsWith('lang:')) { const first = S.scene === 'lang'; setLanguage(id.slice(5)); if (first) gotoScene('title'); else SOUNDS.ui(); return; }
    if (id.startsWith('lv:')) { S.setup.level = id.slice(3); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('side:')) { S.setup.side = Number(id.slice(5)); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('theme:')) { S.themeId = id.slice(6); saveSettings(); SOUNDS.ui(); return; }
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
      case 'set:think-': S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); return;
      case 'set:think+': S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); return;
      case 'set:restore': Promise.resolve(env.monetization?.restore?.()).then(refreshOwns); return;
      case 'set:unlock': Promise.resolve(env.monetization?.purchase?.('unlock_game')).then(refreshOwns); return;
      case 'set:reset':
        if (!S.resetArm) { S.resetArm = true; return; }
        S.stats = {}; S.lessons = {}; S.save = null; S.progress = { games: 0, wins: 0 };
        saveStats(); saveLessons(); storage.set(`${KEY}.save`, null); storage.set(`${KEY}.progress`, S.progress); S.resetArm = false; return;
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
    if (pr.kind === 'cell') {
      const c = S.match ? cellAt(geoNow(), x, y) : -1;
      pr.active = c === pr.id;
      return;
    }
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

  function cellRelease(pr, x, y) {
    const M = S.match;
    if (!M || S.scene !== 'play' || S.overlay) return;
    if (cellAt(geoNow(), x, y) === pr.id) { S.kbd = false; M.cur = pr.id; play(M, pr.id); }
  }

  function onUp(x, y) {
    const pr = S.press;
    S.press = null;
    if (!pr) return;
    if (pr.kind === 'cell') { cellRelease(pr, x, y); return; }
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
    const M = S.match, lay = layNow();
    if (inRect(x, y, BACK_BTN)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: BACK_BTN }; return; }
    if (inRect(x, y, PAUSE_BTN)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: PAUSE_BTN }; return; }
    for (let i = 0; i < TOOLBAR_IDS.length; i++) {
      if (inRect(x, y, lay.tool[i])) { S.press = { id: `tool:${TOOLBAR_IDS[i]}`, active: true, kind: 'tool', rect: lay.tool[i] }; return; }
    }
    const c = cellAt(geoNow(), x, y);
    if (c >= 0) S.press = { id: c, active: true, kind: 'cell', x0: x, y0: y };
  }
  function hudAction(id) {
    if (id === 'hud:back') leaveToMenu();
    else if (id === 'hud:pause') { S.overlay = 'pause'; S.ovT = 0; }
  }
  function toolAction(id) {
    const M = S.match;
    if (!M) return;
    if (id === 'undo') { if (S.canUndo) { undoMatch(M); saveGame(); S.sumText = ''; } else toast(tr('nothingUndo')); }
    else if (id === 'think') doThink();
    else if (id === 'restart') doRestart();
  }

  // ---- auto
  function autoDown(x, y) {
    if (inRect(x, y, BACK_BTN)) { S.press = { id: 'auto:exit', active: true, kind: 'auto', rect: BACK_BTN }; return; }
    const lay = autoLayout(TEXT_SCALES[S.textIdx]);
    for (const id of ['slower', 'pause', 'faster']) {
      if (inRect(x, y, lay[id])) { S.press = { id: `auto:${id}`, active: true, kind: 'auto', rect: lay[id] }; return; }
    }
  }
  function autoAction(id) {
    if (id === 'auto:exit') { S.auto = null; S.match = null; gotoScene('title'); }
    else if (id === 'auto:pause') S.auto.paused = !S.auto.paused;
    else if (id === 'auto:slower') { S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); }
    else if (id === 'auto:faster') { S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); }
  }

  // ---- keyboard
  const DIGITS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5 };
  function onKeys(keys) {
    const has = (c) => keys.pressed.has(c);
    if (S.scene === 'play' && !S.overlay && S.match) {
      const M = S.match;
      for (const k of Object.keys(DIGITS)) if (has(k)) { S.kbd = true; M.cur = nearRowHole(M.st.turn, DIGITS[k]); play(M, M.cur); }
      if (has('ArrowLeft') || has('ArrowRight')) {
        const own = ownSorted(M.st.turn), dx = has('ArrowRight') ? 1 : -1;
        const at = own.indexOf(M.cur);
        S.kbd = true; M.cur = own[(Math.max(0, at) + dx + own.length) % own.length];
      }
      if (has('Enter') || has('Space')) { S.kbd = true; play(M, M.cur); }
      if (has('KeyU')) toolAction('undo');
      if (has('KeyT')) toolAction('think');
      if (has('KeyR')) toolAction('restart');
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
      if (has('ArrowRight')) activate('next');
      if (has('ArrowLeft')) activate('prev');
    }
  }

  // ------------------------------------------------------------------------------ main loop
  return {
    update(dt, input) {
      // Watch & Learn's Pause (and the in-game pause card) freezes the whole loop: timers, animations, particles, the ambient clock.
      S.updAt = nowMs(); S.stepped = true;
      const frozen = (S.scene === 'auto' && S.auto && S.auto.paused) || S.overlay === 'pause';
      if (!frozen) S.t += dt;
      if (S.overlay) S.ovT += dt;
      if (S.toastT > 0) { S.toastT -= dt; if (S.toastT <= 0) S.toast = null; }
      const ptr = S.shot ? { pressed: false, down: false, released: false, x: 0, y: 0 } : input.pointer;
      if (ptr.pressed) onDown(ptr.x, ptr.y);
      else if (ptr.down) onMove(ptr.x, ptr.y, dt);
      if (ptr.released) onUp(ptr.x, ptr.y);
      else if (S.press && S.press.kind === 'cell' && !ptr.down && !ptr.pressed && !S.shot) {
        // The release never reached us (the preview gate held the game, the app was backgrounded): let go where the finger last was.
        const p = S.press; S.press = null;
        cellRelease(p, S.lastPtr.x, S.lastPtr.y);
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

      if ((S.scene === 'title' || S.scene === 'lang') && !S.shot) stepAttract(dt);
      const M = S.match;
      if (M) {
        const wasIdle = !M.busy;
        if (S.scene === 'play') {
          if (S.overlay !== 'pause' && !S.shot) {
            setTargets(M);
            const before = M.hist.length;
            stepMatch(M, dt, rng);
            if (wasIdle && M.hist.length > before) { beginMove(M); saveGame(); }
          }
          S.canUndo = canUndo(M);
        } else if (S.scene === 'auto' && !frozen) { setTargets(M); stepMatch(M, dt, rng); updateAuto(dt); }
        if (S.scene === 'play' || S.scene === 'auto') {
          handleFx(M);
          if (!frozen) stepWinSeq(dt);
        }
        // Lessons: the right move shows its explanation once the stones have settled. A finished game shows its result card.
        const plain = M.lesson && M.lesson.type !== 'game';
        if (S.scene === 'play' && !S.overlay && plain && S.lessonOk && !S.shot && !M.busy) {
          S.lessonWait += dt;
          if (S.lessonWait > 0.9) {
            S.lessons[M.lesson.id] = true; saveLessons();
            S.lessonInfo = { ok: true, head: tr('correct'), body: S.lessonOk.text };
            S.overlay = 'lesson'; S.ovT = 0; S.lessonOk = null;
            SOUNDS.hint();
          }
        }
        if (S.scene === 'play' && M.over && !S.overlay && !plain && M.overT > 1.2 && !S.shot) { S.overlay = 'end'; S.ovT = 0; }
      }
    },

    render(ctx) {
      // How far between two fixed updates this frame is drawn: moving stones and the hand are drawn that far along, so motion is smooth on 120 Hz screens.
      const frozenNow = (S.scene === 'auto' && S.auto && S.auto.paused) || S.overlay === 'pause';
      S.alpha = S.stepped && env.clock && !frozenNow ? Math.max(0, Math.min(1, (nowMs() - S.updAt) / (1000 / 60))) : 1;
      render(ctx, S, buildUi(S));
    },

    getState() {
      const M = S.match;
      return {
        scene: S.scene, overlay: S.overlay, textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, theme: S.themeId, lang: S.lang, setup: S.setup,
        stats: S.stats, lessons: Object.keys(S.lessons).length, lessonIdx: S.lessonIdx, page: S.page, scroll: S.scroll, demoGames: S.demoGames,
        auto: S.auto ? { k: S.auto.k, phase: S.auto.phase, t: Math.round(S.auto.t * 100) / 100, paused: S.auto.paused } : null,
        match: M ? {
          level: M.level, lesson: Boolean(M.lesson), human: M.human, two: M.two, cells: M.st.cells.join(','), pd: M.st.pd.join(','), turn: M.st.turn, moves: M.hist.length,
          sel: M.sel, over: M.over ? [M.over.winner, M.over.a, M.over.b] : null, hint: M.hint ? [M.hint.mv.cell] : null, busy: M.busy,
          anim: M.A ? M.A.i : -1, disp: M.D.cells.join(','),
        } : null,
      };
    },

    // The preview clock counts real play only. Menus, setup, Learn, Rules / How to Play / About, Settings, every overlay (pause, result,
    // lesson, Watch & Learn summary), the demo card, the lessons and Watch & Learn are all free time.
    isPreviewExempt: () => S.shot || S.scene !== 'play' || Boolean(S.overlay) || Boolean(S.match && S.match.lesson),
  };
}
