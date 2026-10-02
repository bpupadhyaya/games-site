// GAME CONTRACT (docs/GAME-CONTRACT.md). Noughts & Crosses: four rule sets, a perfect-play solver, a tutor path.
import { SCREEN, inRect, BACK_BTN, PAUSE_BTN, TOOLBAR_IDS, autoLayout, playLayout } from './layout.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, THINK_STEPS, demoModeLocked, demoOver, recKey } from './screens.js';
import { MODE_IDS, MODE_NAMES, SPECS, startState, legalMoves, wordsOf } from './rules.js';
import { LEVELS, chooseMove } from './ai.js';
import { scoreMoves, scoreOf } from './solver.js';
import { hint, reasonFor } from './explain.js';
import { lineKind, markName } from './analysis.js';
import { LESSONS, lessonStart, judge } from './lessons.js';
import { createMatch, playMove, undoMatch, tapCell, stepMatch, spawn, canUndo, humanTurn, settled } from './match.js';
import { RULE_COUNT, HOWTO_COUNT, tr } from './content.js';
import { boardGeo, themeById, THEMES } from './art.js';
import { render } from './view.js';

export const meta = { width: SCREEN.width, height: SCREEN.height };

const VERSION = '1.0.0';
const WIN_NOTES = [523, 659, 784, 1047, 1319];
const AUTO_GAMES = [
  { mode: 'classic', lv: ['perfect', 'perfect'] },
  { mode: 'terni', lv: ['perfect', 'skilled'] },
  { mode: 'misere', lv: ['perfect', 'perfect'] },
];

export async function createGame(env) {
  const { rng, storage, audio, config } = env;

  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0, sound: true, themeId: 'marble', textIdx: 0, thinkIdx: 1,
    setup: { mode: 'classic', level: 'skilled', side: 1 }, stats: {}, lessons: {}, save: null, demoGames: 0, progress: { games: 0, wins: 0 },
    page: { howto: 0, rules: 0 }, scroll: {}, scrollVel: {}, press: null, match: null, auto: null, lessonIdx: 0, endInfo: null, lessonInfo: null,
    toast: null, toastT: 0, ghost: -1, ghostWho: 0, kbd: false, canUndo: false, firstGame: true, winSeq: null, lessonWait: -1, lessonOk: null, lastOpts: null,
    demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, price: '', resetArm: false, version: VERSION, shot: false, lastPtr: { x: 0, y: 0 },
  };

  const [set, stats, les, save, dg, prog] = await Promise.all([storage.get('nc.settings', null), storage.get('nc.stats', null), storage.get('nc.lessons', null), storage.get('nc.save', null), storage.get('nc.demo', 0), storage.get('nc.progress', null)]);
  if (set) {
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (THEMES.some((t) => t.id === set.themeId)) S.themeId = set.themeId;
    if (Number.isInteger(set.textIdx)) S.textIdx = Math.min(Math.max(set.textIdx, 0), TEXT_SCALES.length - 1);
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = Math.min(Math.max(set.thinkIdx, 0), THINK_STEPS.length - 1);
    if (set.setup && MODE_IDS.includes(set.setup.mode)) {
      const lv = set.setup.level === 'two' || LEVELS.some((l) => l.id === set.setup.level) ? set.setup.level : 'skilled';
      S.setup = { mode: set.setup.mode, level: lv, side: set.setup.side === 2 ? 2 : 1 };
    }
  }
  if (stats && typeof stats === 'object') S.stats = stats;
  if (les && typeof les === 'object') S.lessons = les;
  if (save && MODE_IDS.includes(save.mode) && Array.isArray(save.moves)) S.save = save;
  if (Number.isInteger(dg)) S.demoGames = dg;
  if (prog && Number.isInteger(prog.wins) && Number.isInteger(prog.games)) S.progress = { games: prog.games, wins: prog.wins };
  S.firstGame = !Object.keys(S.stats).length && !Object.keys(S.lessons).length;
  audio.setMuted(!S.sound);
  // The price shown is the store's localized price when the shell knows it, else the game.json price (kit priceOf).
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);

  const th = () => themeById(S.themeId);
  const pal = () => ({ 1: th().x.glow, 2: th().o.glow });
  const saveSettings = () => storage.set('nc.settings', { sound: S.sound, themeId: S.themeId, textIdx: S.textIdx, thinkIdx: S.thinkIdx, setup: S.setup });
  const saveStats = () => storage.set('nc.stats', S.stats);
  const saveLessons = () => storage.set('nc.lessons', S.lessons);
  const saveGame = () => {
    const M = S.match;
    if (S.scene !== 'play' || !M || M.lesson || M.auto) return;
    S.save = M.over || !M.hist.length ? null : { mode: M.mode, level: M.level, human: M.human, two: M.two, moves: M.hist.map((h) => [h.mv.from, h.mv.to]) };
    storage.set('nc.save', S.save);
  };

  // ------------------------------------------------------------------------------ sound
  const sfx = (o) => { if (S.sound) audio.tone(o); };
  const SOUNDS = {
    place: (who) => {
      if (who === 1) { sfx({ freq: 230, to: 110, dur: 0.09, type: 'triangle', vol: 0.16 }); sfx({ freq: 1500, dur: 0.025, type: 'square', vol: 0.03 }); }
      else { sfx({ freq: 300, to: 150, dur: 0.1, type: 'sine', vol: 0.15 }); sfx({ freq: 990, to: 880, dur: 0.22, type: 'sine', vol: 0.05 }); }
    },
    swish: () => sfx({ freq: 520, to: 300, dur: 0.12, type: 'sine', vol: 0.04 }),
    slide: () => sfx({ freq: 360, to: 560, dur: 0.16, type: 'sine', vol: 0.06 }),
    select: () => sfx({ freq: 620, to: 760, dur: 0.06, type: 'sine', vol: 0.08 }),
    refuse: () => sfx({ freq: 170, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.07 }),
    undo: () => sfx({ freq: 520, to: 330, dur: 0.1, type: 'triangle', vol: 0.1 }),
    hint: () => { sfx({ freq: 660, dur: 0.12, type: 'sine', vol: 0.1 }); sfx({ freq: 990, dur: 0.18, type: 'sine', vol: 0.06 }); },
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.08 }),
    lose: () => { [392, 330, 262].forEach((f, i) => sfx({ freq: f, to: f * 0.96, dur: 0.4, type: 'sine', vol: 0.09 - i * 0.01 })); },
    draw: () => { sfx({ freq: 440, dur: 0.3, type: 'sine', vol: 0.09 }); sfx({ freq: 392, dur: 0.4, type: 'sine', vol: 0.07 }); },
  };

  // ------------------------------------------------------------------------------ geometry helpers
  const geoNow = (M) => { const lay = playLayout(TEXT_SCALES[S.textIdx]); return boardGeo(M.mode, lay.board.x, lay.board.y, lay.board.side); };
  const cellAt = (M, x, y) => {
    const g = geoNow(M), r = g.cell / 2 + 4;
    for (let i = 0; i < SPECS[M.mode].n; i++) { const [cx, cy] = g.centers[i]; if (Math.abs(x - cx) <= r && Math.abs(y - cy) <= r) return i; }
    return -1;
  };

  // ------------------------------------------------------------------------------ matches
  function launch(M) {
    S.match = M; S.scene = M.auto ? 'auto' : 'play'; S.overlay = null; S.press = null; S.ghost = -1; S.endInfo = null; S.lessonInfo = null; S.winSeq = null; S.toast = null; S.lessonWait = -1; S.lessonOk = null;
  }
  function startMatch(opts, count = true) {
    if (demoModeLocked(S, opts.mode) || (count && demoOver(S))) { S.scene = 'demo-limit'; S.overlay = null; return; }
    const two = opts.level === 'two';
    const M = createMatch({ mode: opts.mode, level: two ? 'skilled' : opts.level, human: opts.side ?? 1, two, pal: pal(), lesson: opts.lesson ?? null, start: opts.start });
    if (count && S.demo) { S.demoGames += 1; storage.set('nc.demo', S.demoGames); }
    launch(M);
    if (!opts.lesson) { S.lastOpts = opts; S.save = null; storage.set('nc.save', null); }
  }
  function continueGame() {
    const sv = S.save;
    if (!sv) return;
    const M = createMatch({ mode: sv.mode, level: sv.level, human: sv.human ?? 1, two: sv.two, pal: pal() });
    for (const [from, to] of sv.moves) {
      const mv = legalMoves(M.st).find((m) => m.from === from && m.to === to);
      if (!mv) break;
      playMove(M, mv, true);
    }
    M.events.length = 0;
    launch(M);
    S.lastOpts = { mode: sv.mode, level: sv.two ? 'two' : sv.level, side: sv.human ?? 1 };
  }
  function startLesson(i) {
    const L = LESSONS[i];
    if (!L || (S.demo && i >= 3)) { S.scene = 'demo-limit'; S.overlay = null; return; }
    S.lessonIdx = i;
    if (L.type === 'game') { startMatch({ mode: L.mode, level: L.level, side: L.human ?? 1, lesson: L }, false); return; }
    startMatch({ mode: L.mode, level: 'skilled', side: L.turn, lesson: L, start: lessonStart(L) }, false);
    const M = S.match;
    M.gate = (mv) => {
      const j = judge(L, M.st, mv);
      if (!j.ok) { S.lessonInfo = { ok: false, head: 'Not quite', body: j.text.replace(/^Not quite\.\s*/, '') }; S.overlay = 'lesson'; S.ovT = 0; SOUNDS.refuse(); return false; }
      S.lessonOk = j; S.lessonWait = 0;
      return true;
    };
  }

  function onEnd(M, e) {
    const w = e.winner;
    const lessonGame = M.lesson && M.lesson.type === 'game';
    const loser = w ? 3 - w : 0;
    const youWon = !M.two && !M.auto && w === M.human;
    let head, body;
    if (w === 0) head = 'A draw';
    else if (M.two || M.auto || M.lesson) head = `${markName(w)} wins!`;
    else head = youWon ? 'You win!' : `${LEVELS.find((l) => l.id === M.level)?.name ?? 'Opponent'} wins`;
    if (e.why === 'line') { const k = lineKind(M.mode, M.over.line); body = `${k[0].toUpperCase()}${k.slice(1)}.`; }
    else if (e.why === 'misere') body = `${markName(loser)} completed three in a row, which loses in Misère.`;
    else if (e.why === 'blocked') body = `${markName(loser)} had no piece that could slide.`;
    else if (e.why === 'repeat') body = 'The same position came up three times.';
    else body = 'The board is full with no line.';
    if (w === 0 && M.mode === 'classic' && (M.level === 'perfect' || M.auto)) body += ' With perfect play from both sides, Classic is always a draw.';
    let rec = '', lessonOk = false;
    if (!M.two && !M.auto && !M.lesson) {
      const key = recKey(M.mode, M.level);
      const r = S.stats[key] ?? [0, 0, 0];
      r[w === 0 ? 1 : youWon ? 0 : 2] += 1;
      S.stats[key] = r; saveStats(); S.firstGame = false;
      S.progress.games += 1; if (youWon) S.progress.wins += 1; storage.set('nc.progress', S.progress);
      rec = `${tr('record')} (${MODE_NAMES[M.mode]}, ${LEVELS.find((l) => l.id === M.level)?.name}): ${r[0]} ${tr('wins')}  ${r[1]} ${tr('draws')}  ${r[2]} ${tr('losses')}`;
      S.save = null; storage.set('nc.save', null);
    }
    if (lessonGame) {
      lessonOk = w === 0 || youWon;
      if (lessonOk) { S.lessons[M.lesson.id] = true; saveLessons(); body = `${body} ${M.lesson.done}`; } else body += ' Try again: stop every threat and every fork.';
    }
    S.endInfo = { head, body, rec, winner: w, lessonOk };
    if (w === 0) SOUNDS.draw();
    else if (M.two || M.auto || M.lesson || youWon) S.winSeq = { t: 0, i: 0 };
    else SOUNDS.lose();
  }

  function handleEvents(M) {
    for (const e of M.events) {
      if (e.type === 'place') SOUNDS.swish();
      else if (e.type === 'slide') SOUNDS.slide();
      else if (e.type === 'land') { SOUNDS.place(e.who); const g = geoNow(M), [cx, cy] = g.centers[e.at]; spawn(M, rng, cx, cy, e.who, 'land'); }
      else if (e.type === 'refuse') SOUNDS.refuse();
      else if (e.type === 'select') SOUNDS.select();
      else if (e.type === 'undo') SOUNDS.undo();
      else if (e.type === 'end') onEnd(M, e);
      else if (e.type === 'burst' && M.over && M.over.line) { const g = geoNow(M), w = M.over.why === 'misere' ? 3 - M.over.winner : M.over.winner; for (const i of M.over.line) { const [cx, cy] = g.centers[i]; spawn(M, rng, cx, cy, w, 'win'); } }
    }
    if (M.events.some((e) => e.type === 'place' || e.type === 'slide' || e.type === 'undo')) saveGame();
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

  // ------------------------------------------------------------------------------ Watch & Learn
  function startAutoGame() {
    const a = S.auto, g = AUTO_GAMES[a.k];
    const M = createMatch({ mode: g.mode, auto: true, pal: pal() });
    M.autoLv = g.lv;
    S.match = M; S.winSeq = null; S.endInfo = null;
    Object.assign(a, { phase: 'intro', t: 0, plan: null, scan: null, note: { head: '', why: '' } });
  }
  function startAuto() {
    S.auto = { k: 0, phase: 'intro', t: 0, paused: false, plan: null, scan: null, note: { head: '', why: '' } };
    S.scene = 'auto'; S.overlay = null; S.press = null;
    startAutoGame();
  }
  function planAuto() {
    const a = S.auto, M = S.match, st = M.st;
    const list = scoreMoves(st);
    const mv = chooseMove(st, M.autoLv[st.turn - 1], rng) ?? list[0].mv;
    const best = Math.max(...list.map((x) => x.s));
    const mine = list.find((x) => x.mv.from === mv.from && x.mv.to === mv.to);
    let note;
    if (mine && mine.s === best) note = reasonFor(st, mv, list);
    else {
      const h = hint(st);
      note = { head: mv.from >= 0 ? `Slide ${wordsOf(M.mode, mv.from)} to ${wordsOf(M.mode, mv.to)}` : `Play ${wordsOf(M.mode, mv.to)}`, why: `Not the strongest move: the solver prefers to ${h.head[0].toLowerCase()}${h.head.slice(1)}.` };
    }
    a.plan = { mv, moves: legalMoves(st) };
    a.note = note;
  }
  // THINK (configurable) -> REVEAL (2 s: the options light up and the chosen one is marked) -> ACT (the move)
  function updateAuto(dt) {
    const a = S.auto, M = S.match;
    if (a.paused) return;
    a.t += dt;
    if (a.phase === 'intro') {
      if (a.t >= 1.2) { a.phase = 'think'; a.t = 0; planAuto(); }
    } else if (a.phase === 'think') {
      const empties = M.st.cells.map((c, i) => (c === 0 ? i : -1)).filter((i) => i >= 0);
      a.scan = empties.length ? empties[Math.floor(a.t / 0.5) % empties.length] : null;
      if (a.t >= THINK_STEPS[S.thinkIdx]) { a.phase = 'reveal'; a.t = 0; a.scan = null; }
    } else if (a.phase === 'reveal') {
      if (a.t >= 2) { a.phase = 'act'; a.t = 0; playMove(M, a.plan.mv); }
    } else if (a.phase === 'act') {
      if (a.t >= 0.7 && settled(M)) {
        if (M.over) { a.phase = 'celebrate'; a.t = 0; } else { a.phase = 'think'; a.t = 0; planAuto(); }
      }
    } else if (a.phase === 'celebrate') {
      if (a.t >= 3.4) {
        if (a.k + 1 < AUTO_GAMES.length) { a.k += 1; startAutoGame(); } else { S.overlay = 'autosum'; S.ovT = 0; a.phase = 'summary'; }
      }
    }
  }

  // ------------------------------------------------------------------------------ store screenshots
  // `tools/arc shots` loads ?shot=1&seed=N. Seeds 900001..900040 stage a real moment instead of random play; 901001+ and
  // 902001+ show the Rules pages at 100 and 300 percent.
  function stageShot(n) {
    const settle = (M, secs) => { for (let i = 0; i < secs * 60; i++) stepMatch(M, 1 / 60, rng); M.events.length = 0; M.parts.length = 0; };
    const mk = (mode, level, human = 1) => { S.setup = { mode, level, side: human }; startMatch({ mode, level, side: human }, false); S.match.freeze = true; return S.match; };
    const place = (M, list) => {
      for (const c of list) playMove(M, Array.isArray(c) ? { from: c[0], to: c[1] } : { from: -1, to: c }, true);
      M.anim = {}; handleEvents(M);
    };
    S.shot = true;
    S.stats = { 'classic:skilled': [4, 2, 1], 'classic:perfect': [0, 5, 3], 'terni:expert': [1, 1, 2] };
    ['win', 'block', 'fork', 'stopfork'].forEach((id) => { S.lessons[id] = true; });
    S.firstGame = false;
    if (n === 1) { const M = mk('classic', 'skilled'); place(M, [4, 0, 8, 2, 6]); settle(M, 1); M.thinking = true; }
    else if (n === 2) { const M = mk('terni', 'expert'); place(M, [4, 0, 8, 2, 1, 6]); M.sel = 8; settle(M, 1); }
    else if (n === 3) { const M = mk('classic', 'skilled'); place(M, [4, 1, 0, 8, 6, 3, 2]); settle(M, 1.1); }
    else if (n === 4) { const M = mk('classic', 'perfect', 2); place(M, [0, 4, 8]); settle(M, 1); M.hint = hint(M.st); }
    else if (n === 5) { S.thinkIdx = 0; startAuto(); S.auto.k = 1; startAutoGame(); const M = S.match; place(M, [4, 0, 8]); settle(M, 1); S.auto.phase = 'reveal'; S.auto.t = 1; planAuto(); }
    else if (n === 6) { const M = mk('quad', 'skilled'); place(M, [5, 0, 6, 15, 9, 3]); settle(M, 1); }
    else if (n === 7) { const M = mk('misere', 'expert'); place(M, [4, 0, 2, 6]); settle(M, 1); }
    else if (n === 8) { S.scene = 'setup'; S.setup = { mode: 'terni', level: 'perfect', side: 1 }; }
    else if (n === 9) { S.scene = 'learn'; }
    else if (n === 10) { S.themeId = 'night'; const M = mk('classic', 'skilled'); place(M, [4, 0, 8, 2, 6]); settle(M, 1); }
    else if (n === 11) { S.themeId = 'boxwood'; const M = mk('terni', 'skilled'); place(M, [4, 0, 8, 2, 1, 6]); M.sel = 8; settle(M, 1); }
    else if (n === 12) { S.themeId = 'night'; S.scene = 'title'; }
    else if (n === 13) { S.themeId = 'boxwood'; S.scene = 'title'; }
    else if (n >= 14 && n <= 50) { // text-zoom and screen checks (QA only)
      S.textIdx = 4;
      if (n === 14) S.scene = 'title';
      else if (n === 15) S.scene = 'settings';
      else if (n === 16) S.scene = 'about';
      else if (n === 17) { const M = mk('classic', 'skilled'); place(M, [4, 1, 0, 8, 6, 3, 2]); settle(M, 3); S.overlay = 'end'; S.ovT = 1; }
      else if (n === 18) S.scene = 'learn';
      else if (n === 19) S.scene = 'setup';
      else if (n === 20) { const M = mk('classic', 'skilled'); place(M, [4, 0]); settle(M, 1); S.overlay = 'pause'; S.ovT = 1; }
      else if (n === 21) S.scene = 'demo-limit';
      else if (n === 22) { S.scene = 'howto'; S.page.howto = 2; }
      else if (n === 23) { startAuto(); place(S.match, [4, 0]); settle(S.match, 1); S.auto.phase = 'reveal'; S.auto.t = 1; planAuto(); S.auto.paused = true; }
      else if (n === 24) { S.demo = true; S.textIdx = 0; S.scene = 'title'; }
      else if (n === 25) { const M = mk('quad', 'skilled'); place(M, [5, 0, 6, 15, 9, 3]); settle(M, 1); M.hint = hint(M.st); }
      else if (n === 26) { S.textIdx = 0; const M = mk('classic', 'skilled'); place(M, [4, 0, 8]); settle(M, 1); M.hint = hint(M.st); }
      else if (n === 27) { startLesson(2); S.textIdx = 2; settle(S.match, 1); }
      else if (n === 28) { S.textIdx = 0; startLesson(3); settle(S.match, 1); S.lessonInfo = { ok: false, head: 'Not quite', body: 'X could then make a fork and win.' }; S.overlay = 'lesson'; S.ovT = 1; }
      else if (n === 29) { S.textIdx = 0; const M = mk('terni', 'skilled'); place(M, [4, 0, 8, 2, 1, 6, [4, 3]]); settle(M, 0.2); }
      else if (n === 30) { S.textIdx = 2; const M = mk('classic', 'skilled'); place(M, [4, 0, 8, 2, 6]); settle(M, 1); }
      else if (n === 31) { S.textIdx = 0; const M = mk('classic', 'skilled'); place(M, [4, 0, 8, 2]); M.st = { ...M.st }; playMove(M, { from: -1, to: 6 }); M.events.length = 0; settle(M, 0.14); M.freeze = true; }
      else if (n === 32) { S.textIdx = 0; const M = mk('terni', 'skilled'); place(M, [4, 0, 8, 2, 1, 6]); playMove(M, { from: 8, to: 7 }); M.events.length = 0; settle(M, 0.2); }
      else if (n === 33) { S.textIdx = 0; const M = mk('terni', 'skilled'); place(M, [4, 0, 8, 2, 1, 6]); settle(M, 1); M.hint = hint(M.st); }
      else if (n === 34) { S.textIdx = 0; const M = mk('classic', 'two'); M.two = true; place(M, [4, 0, 8]); settle(M, 1); }
      else if (n === 35) { S.textIdx = 0; const M = mk('misere', 'skilled'); place(M, [4, 0, 2, 6, 3, 5, 1, 7, 8]); settle(M, 1.2); }
      else if (n === 36) { S.textIdx = 0; const M = mk('quad', 'skilled'); place(M, [5, 0, 6, 15, 9, 3, 10]); settle(M, 1.3); }
      else if (n === 49) { S.textIdx = 0; S.scene = 'title'; S.t = 6.9; }
      else if (n === 41) { S.textIdx = 0; const M = mk('classic', 'skilled'); place(M, [4, 0]); settle(M, 1); S.overlay = 'pause'; S.ovT = 1; }
      else if (n >= 42 && n <= 48) { S.textIdx = 0; S.scene = 'howto'; S.page.howto = n - 42; }
      else if (n === 38) { S.textIdx = 0; S.scene = 'settings'; }
      else if (n === 39) { S.textIdx = 0; S.scene = 'about'; }
      else if (n === 40) { S.textIdx = 0; S.scene = 'howto'; S.page.howto = 3; }
      else if (n === 37) { S.textIdx = 0; const M = mk('classic', 'perfect'); place(M, [4, 0, 2, 6, 3, 5, 7, 1, 8]); settle(M, 1.3); }
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
    S.scene = scene; S.overlay = null; S.press = null; S.resetArm = false; S.scrollVel = {}; S.ghost = -1;
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
  function leaveToMenu() { saveGame(); S.match = null; S.auto = null; S.ghost = -1; gotoScene('title'); }
  const warm = (mode) => { if (mode === 'quad' || mode === 'terni') scoreOf(startState(mode)); };

  function doThink() {
    const M = S.match;
    if (!M || M.over || !humanTurn(M)) return;
    M.hint = hint(M.st);
    M.sel = -1;
    SOUNDS.hint();
  }
  function doRestart() {
    const M = S.match;
    if (!M || M.auto) return;
    if (M.lesson) { startLesson(S.lessonIdx); return; }
    startMatch(S.lastOpts ?? { mode: M.mode, level: M.two ? 'two' : M.level, side: M.human }, S.demo);
  }
  const toast = (msg) => { S.toast = msg; S.toastT = 2.2; };

  function activate(id) {
    if (id == null) return;
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
    if (id.startsWith('mode:')) { const m = id.slice(5); if (demoModeLocked(S, m)) { S.scene = 'demo-limit'; return; } S.setup.mode = m; warm(m); saveSettings(); SOUNDS.ui(); return; }
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
        S.stats = {}; S.lessons = {}; S.save = null; S.firstGame = true; S.progress = { games: 0, wins: 0 };
        saveStats(); saveLessons(); storage.set('nc.save', null); storage.set('nc.progress', S.progress); S.resetArm = false; return;
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
      const c = S.match ? cellAt(S.match, x, y) : -1;
      pr.active = c === pr.id;
      if (pr.active) setGhost(pr.id); else S.ghost = -1;
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

  function onUp(x, y) {
    const pr = S.press;
    S.press = null;
    S.ghost = -1;
    if (!pr) return;
    if (pr.kind === 'cell') {
      if (S.scene === 'play' && S.match && !S.overlay && cellAt(S.match, x, y) === pr.id) { S.kbd = false; S.match.cur = pr.id; tapCell(S.match, pr.id); }
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

  function setGhost(i) {
    const M = S.match;
    if (!M || !humanTurn(M) || M.over) { S.ghost = -1; return; }
    const sp = SPECS[M.mode];
    const placing = !sp.slide || M.st.cells.filter((c) => c === M.st.turn).length < sp.pieces;
    if (placing && M.st.cells[i] === 0) { S.ghost = i; S.ghostWho = M.st.turn; } else S.ghost = -1;
  }

  // ---- play
  function playDown(x, y) {
    const lay = playLayout(TEXT_SCALES[S.textIdx]);
    if (inRect(x, y, BACK_BTN)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: BACK_BTN }; return; }
    if (inRect(x, y, PAUSE_BTN)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: PAUSE_BTN }; return; }
    for (let i = 0; i < TOOLBAR_IDS.length; i++) {
      if (inRect(x, y, lay.tool[i])) { S.press = { id: `tool:${TOOLBAR_IDS[i]}`, active: true, kind: 'tool', rect: lay.tool[i] }; return; }
    }
    const c = cellAt(S.match, x, y);
    if (c >= 0) { S.press = { id: c, active: true, kind: 'cell' }; setGhost(c); }
  }
  function hudAction(id) {
    if (id === 'hud:back') leaveToMenu();
    else if (id === 'hud:pause') { S.overlay = 'pause'; S.ovT = 0; S.ghost = -1; }
  }
  function toolAction(id) {
    const M = S.match;
    if (!M) return;
    if (id === 'undo') { if (S.canUndo) undoMatch(M); else toast('Nothing to undo'); }
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
  const DIGITS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6, Digit8: 7, Digit9: 8, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad7: 6, Numpad8: 7, Numpad9: 8 };
  function onKeys(keys) {
    const has = (c) => keys.pressed.has(c);
    if (S.scene === 'play' && !S.overlay && S.match) {
      const M = S.match, n = SPECS[M.mode].size;
      if (n === 3) for (const k of Object.keys(DIGITS)) if (has(k)) { S.kbd = true; M.cur = DIGITS[k]; tapCell(M, DIGITS[k]); }
      const mv = (dr, dc) => { S.kbd = true; const r = Math.floor(M.cur / n), c = M.cur % n; M.cur = Math.max(0, Math.min(n - 1, r + dr)) * n + Math.max(0, Math.min(n - 1, c + dc)); };
      if (has('ArrowLeft')) mv(0, -1);
      if (has('ArrowRight')) mv(0, 1);
      if (has('ArrowUp')) mv(-1, 0);
      if (has('ArrowDown')) mv(1, 0);
      if (has('Enter') || has('Space')) { S.kbd = true; tapCell(M, M.cur); }
      if (has('KeyU')) toolAction('undo');
      if (has('KeyT')) toolAction('think');
      if (has('KeyR')) toolAction('restart');
      if (has('Escape') || has('KeyP')) { S.overlay = 'pause'; S.ovT = 0; S.ghost = -1; }
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
        const p = S.press; S.press = null; S.ghost = -1;
        if (S.match && S.scene === 'play' && !S.overlay && cellAt(S.match, S.lastPtr.x, S.lastPtr.y) === p.id) tapCell(S.match, p.id);
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
      if (M) {
        if (S.scene === 'play') {
          if (S.overlay !== 'pause') stepMatch(M, dt, rng);
          S.canUndo = canUndo(M);
        } else if (S.scene === 'auto' && !frozen) { stepMatch(M, dt, rng); updateAuto(dt); }
        if (S.scene === 'play' || S.scene === 'auto') {
          handleEvents(M);
          if (!frozen) stepWinSeq(dt);
        }
        // Lessons: the right move shows its explanation once the mark has landed. A finished game shows its result card.
        const plain = M.lesson && M.lesson.type !== 'game';
        if (S.scene === 'play' && !S.overlay && plain && S.lessonOk && !S.shot) {
          S.lessonWait += dt;
          if (S.lessonWait > (M.over ? 1.7 : 0.9)) {
            S.lessons[M.lesson.id] = true; saveLessons();
            S.lessonInfo = { ok: true, head: 'Correct!', body: S.lessonOk.text };
            S.overlay = 'lesson'; S.ovT = 0; S.lessonOk = null;
            if (!M.over) SOUNDS.hint();
          }
        }
        if (S.scene === 'play' && M.over && !S.overlay && !plain && M.overT > (M.over.line ? 1.7 : 1.0) && !S.shot) { S.overlay = 'end'; S.ovT = 0; }
      }
    },

    render(ctx) {
      render(ctx, S, buildUi(S));
    },

    getState() {
      const M = S.match;
      return {
        scene: S.scene, overlay: S.overlay, textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, theme: S.themeId, setup: S.setup,
        stats: S.stats, lessons: Object.keys(S.lessons).length, lessonIdx: S.lessonIdx, page: S.page, scroll: S.scroll, demoGames: S.demoGames,
        auto: S.auto ? { k: S.auto.k, phase: S.auto.phase, t: Math.round(S.auto.t * 100) / 100, paused: S.auto.paused } : null,
        match: M ? {
          mode: M.mode, level: M.level, human: M.human, two: M.two, cells: M.st.cells.join(''), turn: M.st.turn, moves: M.hist.length, sel: M.sel,
          over: M.over ? [M.over.winner, M.over.why] : null, hint: M.hint ? [M.hint.mv.from, M.hint.mv.to] : null, anim: Object.keys(M.anim).length,
        } : null,
      };
    },

    // The preview clock counts real play only. Menus, setup, Learn, Rules / How to Play / About, Settings, every overlay (pause, result,
    // lesson, Watch & Learn summary), the demo card, the lessons and Watch & Learn are all free time.
    isPreviewExempt: () => S.shot || S.scene !== 'play' || Boolean(S.overlay) || Boolean(S.match && S.match.lesson),
  };
}
