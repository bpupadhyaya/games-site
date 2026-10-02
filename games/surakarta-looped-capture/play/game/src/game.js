// GAME CONTRACT (docs/GAME-CONTRACT.md). Surakarta: the looped-circuit capture game, five opponents, a Learn path.
import { SCREEN, inRect, BACK_BTN, PAUSE_BTN, TOOLBAR_IDS, autoLayout } from './layout.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, THINK_STEPS, demoOver } from './screens.js';
import { parse, genMoves, captureRoute, sideName, countOf, other, QUIET_LIMIT, NN } from './rules.js';
import { LEVELS, levelById, createSearch } from './ai.js';
import { hintFrom, reasonFor, startHintSearch } from './explain.js';
import { LESSONS, lessonStart, judge } from './lessons.js';
import { createMatch, playMove, undoMatch, tapPoint, stepMatch, spawn, canUndo, humanTurn, settled, movesOf, FRAME_NODES } from './match.js';
import { RULE_COUNT, HOWTO_COUNT, tr } from './content.js';
import { themeById, THEMES, pointXY } from './art.js';
import { render, playGeo } from './view.js';

export const meta = { width: SCREEN.width, height: SCREEN.height };

const VERSION = '1.0.0';
const WIN_NOTES = [523, 659, 784, 1047, 1319];
const AUTO_LV = ['master', 'expert'];

export async function createGame(env) {
  const { rng, storage, audio, config } = env;

  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0, sound: true, themeId: 'teak', textIdx: 0, thinkIdx: 1, threats: false,
    setup: { level: 'skilled', side: 1 }, stats: {}, lessons: {}, save: null, demoGames: 0, progress: { games: 0, wins: 0 },
    page: { howto: 0, rules: 0 }, scroll: {}, scrollVel: {}, press: null, match: null, auto: null, lessonIdx: 0, endInfo: null, lessonInfo: null,
    toast: null, toastT: 0, kbd: false, canUndo: false, winSeq: null, lessonWait: -1, lessonOk: null, lastOpts: null, hintBusy: false, hintSearch: null,
    demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, price: '', resetArm: false, version: VERSION, shot: false, lastPtr: { x: 0, y: 0 },
  };

  const [set, stats, les, save, dg, prog] = await Promise.all([storage.get('su.settings', null), storage.get('su.stats', null), storage.get('su.lessons', null), storage.get('su.save', null), storage.get('su.demo', 0), storage.get('su.progress', null)]);
  if (set) {
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (typeof set.threats === 'boolean') S.threats = set.threats;
    if (THEMES.some((t) => t.id === set.themeId)) S.themeId = set.themeId;
    if (Number.isInteger(set.textIdx)) S.textIdx = Math.min(Math.max(set.textIdx, 0), TEXT_SCALES.length - 1);
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = Math.min(Math.max(set.thinkIdx, 0), THINK_STEPS.length - 1);
    if (set.setup) {
      const lv = set.setup.level === 'two' || LEVELS.some((l) => l.id === set.setup.level) ? set.setup.level : 'skilled';
      S.setup = { level: lv, side: set.setup.side === 2 ? 2 : 1 };
    }
  }
  if (stats && typeof stats === 'object') S.stats = stats;
  if (les && typeof les === 'object') S.lessons = les;
  if (save && Array.isArray(save.moves) && (save.two || LEVELS.some((l) => l.id === save.level))) S.save = save;
  if (Number.isInteger(dg)) S.demoGames = dg;
  if (prog && Number.isInteger(prog.wins) && Number.isInteger(prog.games)) S.progress = { games: prog.games, wins: prog.wins };
  audio.setMuted(!S.sound);
  // The price shown is the store's localized price when the shell knows it, else the game.json price (kit priceOf).
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);

  const th = () => themeById(S.themeId);
  const pal = () => ({ 1: th().light.glow, 2: th().dark.glow });
  const saveSettings = () => storage.set('su.settings', { sound: S.sound, themeId: S.themeId, textIdx: S.textIdx, thinkIdx: S.thinkIdx, threats: S.threats, setup: S.setup });
  const saveStats = () => storage.set('su.stats', S.stats);
  const saveLessons = () => storage.set('su.lessons', S.lessons);
  const saveGame = () => {
    const M = S.match;
    if (S.scene !== 'play' || !M || M.lesson || M.auto) return;
    S.save = M.over || !M.hist.length ? null : { level: M.level, human: M.human, two: M.two, moves: M.hist.map((h) => [h.mv.from, h.mv.to]) };
    storage.set('su.save', S.save);
  };

  // ------------------------------------------------------------------------------ sound
  const sfx = (o) => { if (S.sound) audio.tone(o); };
  const SOUNDS = {
    step: (who) => { sfx({ freq: who === 1 ? 420 : 300, to: who === 1 ? 300 : 210, dur: 0.07, type: 'triangle', vol: 0.14 }); sfx({ freq: 1300, dur: 0.02, type: 'square', vol: 0.025 }); },
    whoosh: (dur) => { sfx({ freq: 260, to: 1400, dur: Math.max(0.3, dur * 0.8), type: 'sine', vol: 0.05 }); sfx({ freq: 140, to: 700, dur: Math.max(0.3, dur * 0.8), type: 'triangle', vol: 0.04 }); },
    hit: () => { sfx({ freq: 190, to: 70, dur: 0.22, type: 'triangle', vol: 0.2 }); sfx({ freq: 880, to: 440, dur: 0.18, type: 'sine', vol: 0.08 }); sfx({ freq: 2200, dur: 0.03, type: 'square', vol: 0.035 }); },
    select: () => sfx({ freq: 620, to: 760, dur: 0.06, type: 'sine', vol: 0.08 }),
    refuse: () => sfx({ freq: 170, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.07 }),
    undo: () => sfx({ freq: 520, to: 330, dur: 0.1, type: 'triangle', vol: 0.1 }),
    hint: () => { sfx({ freq: 660, dur: 0.12, type: 'sine', vol: 0.1 }); sfx({ freq: 990, dur: 0.18, type: 'sine', vol: 0.06 }); },
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.08 }),
    lose: () => { [392, 330, 262].forEach((f, i) => sfx({ freq: f, to: f * 0.96, dur: 0.4, type: 'sine', vol: 0.09 - i * 0.01 })); },
    draw: () => { sfx({ freq: 440, dur: 0.3, type: 'sine', vol: 0.09 }); sfx({ freq: 392, dur: 0.4, type: 'sine', vol: 0.07 }); },
  };

  // ------------------------------------------------------------------------------ geometry helpers
  const geoNow = (M) => playGeo(S, M).geo;
  const pointAt = (M, x, y) => {
    const g = geoNow(M), r = g.u * 0.55;
    let best = -1, bd = Infinity;
    for (let i = 0; i < NN; i++) { const [cx, cy] = pointXY(g, i); const d = Math.hypot(x - cx, y - cy); if (d <= r && d < bd) { bd = d; best = i; } }
    return best;
  };

  // ------------------------------------------------------------------------------ matches
  const cancelHint = () => { S.hintSearch = null; S.hintBusy = false; };
  function launch(M) {
    S.match = M; S.scene = M.auto ? 'auto' : 'play'; S.overlay = null; S.press = null; S.endInfo = null; S.lessonInfo = null; S.winSeq = null; S.toast = null; S.lessonWait = -1; S.lessonOk = null;
    cancelHint();
  }
  function startMatch(opts, count = true) {
    if (count && demoOver(S)) { S.scene = 'demo-limit'; S.overlay = null; return; }
    const two = opts.level === 'two';
    const M = createMatch({ level: two ? 'skilled' : opts.level, human: two ? 1 : opts.side ?? 1, two, pal: pal(), lesson: opts.lesson ?? null, start: opts.start });
    if (count && S.demo) { S.demoGames += 1; storage.set('su.demo', S.demoGames); }
    launch(M);
    if (!opts.lesson) { S.lastOpts = opts; S.save = null; storage.set('su.save', null); }
  }
  function continueGame() {
    const sv = S.save;
    if (!sv) return;
    const M = createMatch({ level: sv.level, human: sv.human ?? 1, two: sv.two, pal: pal() });
    for (const [from, to] of sv.moves) {
      const mv = movesOf(M).find((m) => m.from === from && m.to === to);
      if (!mv) break;
      playMove(M, mv, true);
    }
    M.events.length = 0;
    if (M.over) { S.save = null; storage.set('su.save', null); return; }
    launch(M);
    S.lastOpts = { level: sv.two ? 'two' : sv.level, side: sv.human ?? 1 };
    S.overlay = 'pause'; S.ovT = 0; // a resumed game starts paused
  }
  function startLesson(i) {
    const L = LESSONS[i];
    if (!L || (S.demo && i >= 3)) { S.scene = 'demo-limit'; S.overlay = null; return; }
    S.lessonIdx = i;
    if (L.type === 'game') { startMatch({ level: L.level, side: L.human ?? 1, lesson: L }, false); return; }
    startMatch({ level: 'skilled', side: L.turn, lesson: L, start: lessonStart(L) }, false);
    const M = S.match;
    M.gate = (mv) => {
      const j = judge(L, M.st, mv);
      if (!j.ok) { S.lessonInfo = { ok: false, head: 'Not quite', body: j.text.replace(/^Not quite\.\s*/, '') }; S.overlay = 'lesson'; S.ovT = 0; M.sel = -1; SOUNDS.refuse(); return false; }
      S.lessonOk = j; S.lessonWait = 0;
      return true;
    };
  }

  function onEnd(M, e) {
    const w = e.winner;
    const lessonGame = M.lesson && M.lesson.type === 'game';
    const youWon = !M.two && !M.auto && w === M.human;
    const nm = (who) => sideName(who);
    let head, body;
    if (w === 0) head = 'A draw';
    else if (M.two || M.auto || (M.lesson && !lessonGame)) head = `${nm(w)} wins!`;
    else head = youWon ? 'You win!' : `${levelById(M.level).name} wins`;
    const a = countOf(M.st.cells, 1), b = countOf(M.st.cells, 2);
    if (e.why === 'captured') body = `Every ${nm(other(w))} piece was captured.`;
    else if (e.why === 'blocked') body = `${nm(other(w))} had no legal move.`;
    else body = `${QUIET_LIMIT} moves passed without a capture. Light has ${a} pieces, Dark has ${b}${w === 0 ? ': a draw.' : '.'}`;
    let rec = '', lessonOk = false;
    if (!M.two && !M.auto && !M.lesson) {
      const r = S.stats[M.level] ?? [0, 0, 0];
      r[w === 0 ? 1 : youWon ? 0 : 2] += 1;
      S.stats[M.level] = r; saveStats();
      S.progress.games += 1; if (youWon) S.progress.wins += 1; storage.set('su.progress', S.progress);
      rec = `${tr('record')} (${levelById(M.level).name}): ${r[0]}${tr('wins')} ${r[1]}${tr('draws')} ${r[2]}${tr('losses')}`;
      S.save = null; storage.set('su.save', null);
    }
    if (lessonGame) {
      lessonOk = youWon;
      if (lessonOk) { S.lessons[M.lesson.id] = true; saveLessons(); body = `${body} ${M.lesson.done}`; } else body += ' Try again: keep your pieces off live circuits.';
    }
    S.endInfo = { head, body, rec, winner: w, lessonOk };
    if (w === 0) SOUNDS.draw();
    else if (M.two || M.auto || M.lesson || youWon) S.winSeq = { t: 0, i: 0 };
    else SOUNDS.lose();
  }

  function handleEvents(M) {
    for (const e of M.events) {
      if (e.type === 'step') SOUNDS.step(e.who);
      else if (e.type === 'whoosh') SOUNDS.whoosh(e.dur);
      else if (e.type === 'land') {
        const g = geoNow(M), [cx, cy] = pointXY(g, e.at);
        if (e.cap) { SOUNDS.hit(); spawn(M, rng, cx, cy, e.who, 'hit'); M.shake = 0.22; } else { spawn(M, rng, cx, cy, e.who, 'step'); }
      } else if (e.type === 'refuse') SOUNDS.refuse();
      else if (e.type === 'select') SOUNDS.select();
      else if (e.type === 'undo') SOUNDS.undo();
      else if (e.type === 'end') onEnd(M, e);
      else if (e.type === 'burst' && M.over && M.over.winner > 0) {
        const g = geoNow(M);
        for (let i = 0; i < NN; i++) if (M.st.cells[i] === M.over.winner && i % 3 === 0) { const [cx, cy] = pointXY(g, i); spawn(M, rng, cx, cy, M.over.winner, 'win'); }
      }
    }
    if (M.events.some((e) => e.type === 'step' || e.type === 'whoosh' || e.type === 'undo')) saveGame();
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

  // ------------------------------------------------------------------------------ Think (sliced across frames)
  function doThink() {
    const M = S.match;
    if (!M || M.over || !humanTurn(M) || S.hintBusy) return;
    M.hint = null; M.sel = -1;
    S.hintSearch = { search: startHintSearch(M.st, rng), st: M.st };
    S.hintBusy = true;
    SOUNDS.ui();
  }
  function stepHint() {
    const h = S.hintSearch, M = S.match;
    if (!h) return;
    if (!M || M.st !== h.st || M.over) { cancelHint(); return; }
    if (h.search.step(FRAME_NODES * 2)) {
      M.hint = hintFrom(h.st, h.search.result());
      cancelHint();
      SOUNDS.hint();
    }
  }

  // ------------------------------------------------------------------------------ Watch & Learn
  function startAutoGame() {
    const a = S.auto;
    const M = createMatch({ auto: true, pal: pal() });
    M.autoLv = AUTO_LV;
    S.match = M; S.winSeq = null; S.endInfo = null;
    Object.assign(a, { phase: 'intro', t: 0, plan: null, scan: null, search: null, note: { head: '', why: '' } });
  }
  function startAuto() {
    S.auto = { phase: 'intro', t: 0, paused: false, plan: null, scan: null, search: null, note: { head: '', why: '' } };
    S.scene = 'auto'; S.overlay = null; S.press = null; cancelHint();
    startAutoGame();
  }
  function beginThink() {
    const a = S.auto, M = S.match;
    a.phase = 'think'; a.t = 0; a.plan = null;
    a.search = createSearch(M.st, AUTO_LV[M.st.turn - 1], rng);
  }
  function finishPlan() {
    const a = S.auto, M = S.match, st = M.st;
    const res = a.search.result();
    const mv = res.mv ?? genMoves(st.cells, st.turn)[0];
    const mine = res.list.find((x) => x.mv.from === mv.from && x.mv.to === mv.to);
    const note = reasonFor(st, mv, mine ? mine.s : 0);
    const route = st.cells[mv.to] ? captureRoute(st.cells, mv.from, mv.to, st.turn) : null;
    a.plan = { mv: { from: mv.from, to: mv.to }, moves: genMoves(st.cells, st.turn), route };
    a.note = note;
    a.search = null;
  }
  // THINK (configurable) -> REVEAL (2 s: the trail or arrow and the reason) -> ACT (the move)
  function updateAuto(dt) {
    const a = S.auto, M = S.match;
    if (a.paused) return;
    a.t += dt;
    if (a.phase === 'intro') {
      if (a.t >= 1.2) beginThink();
    } else if (a.phase === 'think') {
      const mine = []; for (let i = 0; i < NN; i++) if (M.st.cells[i] === M.st.turn) mine.push(i);
      a.scan = mine.length ? mine[Math.floor(a.t / 0.4) % mine.length] : null;
      const done = a.search ? a.search.step(FRAME_NODES) : true;
      if (done && a.t >= THINK_STEPS[S.thinkIdx]) { finishPlan(); a.phase = 'reveal'; a.t = 0; a.scan = null; }
    } else if (a.phase === 'reveal') {
      if (a.t >= 2) { a.phase = 'act'; a.t = 0; playMove(M, a.plan.mv); }
    } else if (a.phase === 'act') {
      if (a.t >= 0.7 && settled(M)) {
        if (M.over) { a.phase = 'celebrate'; a.t = 0; } else beginThink();
      }
    } else if (a.phase === 'celebrate') {
      if (a.t >= 3.4) { S.overlay = 'autosum'; S.ovT = 0; a.phase = 'summary'; }
    }
  }

  // ------------------------------------------------------------------------------ store screenshots
  // `tools/arc shots` loads ?shot=1&seed=N. Seeds 900001..900050 stage a real moment instead of random play; 901001+ and
  // 902001+ show the Rules pages at 100 and 300 percent. The positions are real game positions (played by the engine).
  const MID = 'OOO.../OOO.O./O.O.../.X.X.X/X.X.../XX.X.X';
  function stageShot(n) {
    const settle = (M) => { M.events.length = 0; M.parts.length = 0; };
    const mk = (cells, level = 'expert', human = 1, turn = 1) => { S.setup = { level, side: human }; startMatch({ level, side: human, start: parse(cells, turn) }, false); const M = S.match; M.freeze = true; return M; };
    const mid = (frac) => { const M = mk(MID); const mv = movesOf(M).find((m) => m.from === 26 && m.to === 10); playMove(M, mv); M.anim.t = M.anim.dur * frac; M.events.length = 0; return M; };
    const hintOf = (M) => hintFrom(M.st, { mv: { from: 26, to: 10 }, list: [{ mv: { from: 26, to: 10 }, s: 120 }] });
    const autoReveal = () => { startAuto(); S.match.st = parse(MID); S.match.freeze = true; S.auto.phase = 'reveal'; S.auto.t = 1; S.auto.search = createSearch(S.match.st, 'master', rng); while (!S.auto.search.step(1e9)); finishPlan(); };
    S.shot = true;
    S.stats = { skilled: [4, 1, 2], expert: [1, 0, 3], casual: [6, 0, 0] };
    ['step', 'outer', 'inner'].forEach((id) => { S.lessons[id] = true; });
    if (n === 1) { const M = mk(MID); M.sel = 26; }
    else if (n === 2) { mid(0.55); }
    else if (n === 3) { const M = mk(MID); settle(M); M.hint = hintOf(M); }
    else if (n === 4) { S.threats = true; mk('OOO.../OO..O./O.O.../.XXX.X/X.X.../XX.X.X', 'expert'); }
    else if (n === 5) { S.thinkIdx = 0; autoReveal(); }
    else if (n === 6) { S.themeId = 'lacquer'; const M = mk(MID); M.sel = 26; }
    else if (n === 7) { S.themeId = 'batik'; const M = mk(MID); M.sel = 26; }
    else if (n === 8) { S.scene = 'setup'; S.setup = { level: 'expert', side: 1 }; }
    else if (n === 9) { S.scene = 'learn'; }
    else if (n === 10) { S.themeId = 'batik'; S.scene = 'title'; S.t = 3.2; }
    else if (n === 11) { S.themeId = 'lacquer'; S.scene = 'title'; S.t = 3.2; }
    else if (n === 12) { S.scene = 'title'; S.t = 3.2; }
    else if (n === 13) { startLesson(3); S.match.sel = 21; }
    else if (n === 14) { mid(0.3); S.themeId = 'batik'; }
    else if (n >= 15 && n <= 50) { // text-zoom and screen checks (QA only)
      S.textIdx = 4;
      if (n === 15) S.scene = 'title';
      else if (n === 16) S.scene = 'settings';
      else if (n === 17) S.scene = 'about';
      else if (n === 18) { const M = mk(MID); S.endInfo = { head: 'You win!', body: 'Every Dark piece was captured.', rec: 'Record (Expert): 2 W  0 D  3 L', winner: 1 }; M.over = { winner: 1, why: 'captured' }; S.overlay = 'end'; S.ovT = 1; }
      else if (n === 19) S.scene = 'learn';
      else if (n === 20) S.scene = 'setup';
      else if (n === 21) { mk(MID); S.overlay = 'pause'; S.ovT = 1; }
      else if (n === 22) S.scene = 'demo-limit';
      else if (n === 23) { S.scene = 'howto'; S.page.howto = 2; }
      else if (n === 24) { autoReveal(); S.auto.paused = true; }
      else if (n === 25) { S.textIdx = 0; S.demo = true; S.scene = 'title'; }
      else if (n === 26) { const M = mk(MID); M.sel = 26; }
      else if (n === 27) { S.textIdx = 2; const M = mk(MID); M.sel = 26; }
      else if (n === 28) { startLesson(1); S.lessonInfo = { ok: false, head: 'Not quite', body: 'That was only a step. Select your piece to see its glowing capture route.' }; S.overlay = 'lesson'; S.ovT = 1; }
      else if (n === 29) { S.textIdx = 0; mk(MID, 'master', 2, 2); }
      else if (n === 30) { S.textIdx = 0; S.threats = true; mk(MID); }
      else if (n === 31) { S.textIdx = 0; const M = mk(MID); M.msg = 'No capture there: the path must follow a circuit round at least one loop, over empty points.'; M.msgT = 99; }
      else if (n === 32) { S.textIdx = 0; const M = mk(MID); M.hint = hintOf(M); M.hint.why = `${M.hint.why} ${M.hint.why}`; }
      else if (n === 33) { S.textIdx = 0; const M = mk('....../....../....../....../....../.....X'); M.over = { winner: 1, why: 'captured' }; S.overlay = 'end'; S.endInfo = { head: 'You win!', body: 'Every Dark piece was captured.', rec: '', winner: 1 }; S.ovT = 1; }
      else if (n === 34) { S.textIdx = 0; const M = mk(MID); M.over = { winner: 0, why: 'limit' }; S.endInfo = { head: 'A draw', body: '60 moves passed without a capture. Light has 9 pieces, Dark has 9: a draw.', rec: '', winner: 0 }; S.overlay = 'end'; S.ovT = 1; }
      else if (n === 35) { S.textIdx = 0; const M = mk(MID); M.sel = 26; S.themeId = 'batik'; }
      else if (n === 36) { S.textIdx = 0; S.scene = 'settings'; }
      else if (n === 37) { S.textIdx = 0; S.scene = 'about'; }
      else if (n === 38) { S.textIdx = 0; S.scene = 'setup'; }
      else if (n === 39) { S.textIdx = 0; S.scene = 'learn'; }
      else if (n === 40) { S.textIdx = 0; mk(MID); S.overlay = 'pause'; S.ovT = 1; }
      else if (n >= 41 && n <= 47) { S.textIdx = 0; S.scene = 'howto'; S.page.howto = n - 41; }
    } else if (n >= 1001 && n <= 1030) { S.scene = 'rules'; S.page.rules = n - 1001; }
    else if (n >= 2001 && n <= 2030) { S.scene = 'rules'; S.page.rules = n - 2001; S.textIdx = 4; }
  }
  const wantsShot = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search);
  const sd = config?.seed ?? 0;
  const shotSeed = wantsShot && ((sd >= 900001 && sd <= 900050) || (sd >= 901001 && sd <= 901030) || (sd >= 902001 && sd <= 902030)) ? sd - 900000 : 0;
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
    startMatch(S.lastOpts ?? { level: M.two ? 'two' : M.level, side: M.human }, S.demo);
  }
  const toast = (msg) => { S.toast = msg; S.toastT = 2.2; };

  function activate(id) {
    if (id == null) return;
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
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
      case 'set:threats': S.threats = !S.threats; saveSettings(); SOUNDS.ui(); return;
      case 'set:think-': S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); return;
      case 'set:think+': S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); return;
      case 'set:restore': Promise.resolve(env.monetization?.restore?.()).then(refreshOwns); return;
      case 'set:unlock': Promise.resolve(env.monetization?.purchase?.('unlock_game')).then(refreshOwns); return;
      case 'set:reset':
        if (!S.resetArm) { S.resetArm = true; return; }
        S.stats = {}; S.lessons = {}; S.save = null; S.progress = { games: 0, wins: 0 };
        saveStats(); saveLessons(); storage.set('su.save', null); storage.set('su.progress', S.progress); S.resetArm = false; return;
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
    if (pr.kind === 'cell') { pr.active = S.match ? pointAt(S.match, x, y) === pr.id : false; return; }
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
    if (pr.kind === 'cell') {
      if (S.scene === 'play' && S.match && !S.overlay && pointAt(S.match, x, y) === pr.id) { S.kbd = false; S.match.cur = pr.id; tapPoint(S.match, pr.id); }
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

  // ---- play
  function playDown(x, y) {
    const { lay } = playGeo(S, S.match);
    if (inRect(x, y, BACK_BTN)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: BACK_BTN }; return; }
    if (inRect(x, y, PAUSE_BTN)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: PAUSE_BTN }; return; }
    for (let i = 0; i < TOOLBAR_IDS.length; i++) {
      if (inRect(x, y, lay.tool[i])) { S.press = { id: `tool:${TOOLBAR_IDS[i]}`, active: true, kind: 'tool', rect: lay.tool[i] }; return; }
    }
    const c = pointAt(S.match, x, y);
    if (c >= 0) S.press = { id: c, active: true, kind: 'cell' };
  }
  function hudAction(id) {
    if (id === 'hud:back') leaveToMenu();
    else if (id === 'hud:pause') { S.overlay = 'pause'; S.ovT = 0; }
  }
  function toolAction(id) {
    const M = S.match;
    if (!M) return;
    if (id === 'undo') { if (S.canUndo) { cancelHint(); undoMatch(M); } else toast('Nothing to undo'); }
    else if (id === 'think') doThink();
    else if (id === 'threats') { S.threats = !S.threats; saveSettings(); SOUNDS.ui(); }
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
  function onKeys(keys) {
    const has = (c) => keys.pressed.has(c);
    if (S.scene === 'play' && !S.overlay && S.match) {
      const M = S.match;
      const mv = (dr, dc) => { S.kbd = true; const r = Math.floor(M.cur / 6), c = M.cur % 6; M.cur = Math.max(0, Math.min(5, r + dr)) * 6 + Math.max(0, Math.min(5, c + dc)); };
      if (has('ArrowLeft')) mv(0, -1);
      if (has('ArrowRight')) mv(0, 1);
      if (has('ArrowUp')) mv(-1, 0);
      if (has('ArrowDown')) mv(1, 0);
      if (has('Enter') || has('Space')) { S.kbd = true; tapPoint(M, M.cur); }
      if (has('KeyU')) toolAction('undo');
      if (has('KeyT')) toolAction('think');
      if (has('KeyV')) toolAction('threats');
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
      // Watch & Learn's Pause (and the in-game pause card) freezes the whole loop: timers, search, animations, particles, the clock.
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
        if (S.match && S.scene === 'play' && !S.overlay && pointAt(S.match, S.lastPtr.x, S.lastPtr.y) === p.id) tapPoint(S.match, p.id);
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

      const M = S.match;
      if (M && !S.shot) {
        if (S.scene === 'play') {
          if (!frozen) { stepMatch(M, dt, rng); stepHint(); }
          S.canUndo = canUndo(M);
        } else if (S.scene === 'auto' && !frozen) { stepMatch(M, dt, rng); updateAuto(dt); }
        if (S.scene === 'play' || S.scene === 'auto') {
          handleEvents(M);
          if (!frozen) stepWinSeq(dt);
        }
        // Lessons: the right move shows its explanation once the piece has landed. A finished game shows its result card.
        const plain = M.lesson && M.lesson.type !== 'game';
        if (S.scene === 'play' && !S.overlay && plain && S.lessonOk) {
          if (settled(M)) S.lessonWait += dt;
          if (S.lessonWait > 0.7) {
            S.lessons[M.lesson.id] = true; saveLessons();
            S.lessonInfo = { ok: true, head: 'Correct!', body: S.lessonOk.text };
            S.overlay = 'lesson'; S.ovT = 0; S.lessonOk = null;
            SOUNDS.hint();
          }
        }
        if (S.scene === 'play' && M.over && !S.overlay && !plain && M.overT > 1.6) { S.overlay = 'end'; S.ovT = 0; }
      }
    },

    render(ctx) {
      render(ctx, S, buildUi(S));
    },

    getState() {
      const M = S.match;
      return {
        scene: S.scene, overlay: S.overlay, textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, theme: S.themeId, setup: S.setup, threats: S.threats,
        stats: S.stats, lessons: Object.keys(S.lessons).length, lessonIdx: S.lessonIdx, page: S.page, scroll: S.scroll, demoGames: S.demoGames, saved: Boolean(S.save),
        auto: S.auto ? { phase: S.auto.phase, t: Math.round(S.auto.t * 100) / 100, paused: S.auto.paused } : null,
        match: M ? {
          level: M.level, human: M.human, two: M.two, cells: M.st.cells.join(''), turn: M.st.turn, moves: M.hist.length, sel: M.sel, quiet: M.st.quiet,
          over: M.over ? [M.over.winner, M.over.why] : null, hint: M.hint ? [M.hint.mv.from, M.hint.mv.to] : null, anim: M.anim ? 1 : 0, thinking: M.thinking ? 1 : 0,
        } : null,
      };
    },

    // The preview clock counts real play only. Menus, setup, Learn, Rules / How to Play / About, Settings, every overlay (pause, result,
    // lesson, Watch & Learn summary), the demo card, the lessons and Watch & Learn are all free time.
    isPreviewExempt: () => S.shot || S.scene !== 'play' || Boolean(S.overlay) || Boolean(S.match && S.match.lesson),
  };
}
