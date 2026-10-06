// GAME CONTRACT (docs/GAME-CONTRACT.md). Alquerque: steps, compulsory leaping captures, multiple jumps, five opponent levels, a Learn path.
import { inRect, lay, creditHit, setScreen, screen, autoLayout, playLayout } from './layout.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, THINK_STEPS, demoLevelLocked, demoOver, recKey, scrollOf } from './screens.js';
import { NN, N, QUIET_LIMIT, legalMoves, applyMove, countOf, other } from './rules.js';
import { LEVELS, seeded, thinkTask } from './ai.js';
import { thinkAdvice, reasonFor } from './explain.js';
import { LESSONS, lessonStart, judge } from './lessons.js';
import { createMatch, playMove, undoMatch, tapPoint, stepMatch, spawn, canUndo, humanTurn, settled } from './match.js';
import { RULE_COUNT, HOWTO_COUNT, tr, sideLabel, sideThe, lvName, piecesText } from './content.js';
import { setLang, getLang, LANGS } from './lang.js';
import { themeById, THEMES } from './art.js';
import { render, playGeo } from './view.js';

// Kit 1.7 fluid viewport: the short side is always 720 units; meta.width / meta.height are updated live by the kit and every position
// comes from layout.js (a function of the live size).
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
const TOOLBAR_IDS = ['undo', 'think', 'restart'];

const VERSION = '1.1.2';   // fallback only: the About page shows env.manifest.version (game.json) when the kit provides it
const WIN_NOTES = [523, 659, 784, 1047, 1319];
// Watch & Learn: Master plays Light and Expert plays Dark: a real, well-played game with captures and a finish.
const AUTO_LEVEL = { 1: 'master', 2: 'expert' };

export async function createGame(env) {
  const { rng, storage, audio, config } = env;
  setScreen(meta.width, meta.height);

  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0, sound: true, themeId: 'cedar', textIdx: 0, thinkIdx: 1,
    setup: { level: 'skilled', side: 1 }, stats: {}, lessons: {}, save: null, demoGames: 0, progress: { games: 0, wins: 0 },
    page: { howto: 0, rules: 0 }, scroll: {}, scrollVel: {}, press: null, match: null, auto: null, lessonIdx: 0, endInfo: null, lessonInfo: null,
    toast: null, toastT: 0, kbd: false, canUndo: false, winSeq: null, lessonWait: -1, lessonOk: null, lastOpts: null,
    demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, price: '', resetArm: false, version: env.manifest?.version ?? VERSION, shot: false, lastPtr: { x: 0, y: 0 },
  };

  const [set, stats, les, save, dg, prog] = await Promise.all([storage.get('aq.settings', null), storage.get('aq.stats', null), storage.get('aq.lessons', null), storage.get('aq.save', null), storage.get('aq.demo', 0), storage.get('aq.progress', null)]);
  if (set) {
    if (LANGS.includes(set.lang)) setLang(set.lang);
    if (typeof set.sound === 'boolean') S.sound = set.sound;
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
  if (!set) setLang('en');
    audio.setMuted(!S.sound);
  // The price shown is the store's localized price when the shell knows it, else the game.json price (kit priceOf).
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);

  const th = () => themeById(S.themeId);
  const pal = () => ({ 1: th().p.glow, 2: th().d.glow });
  const saveSettings = () => storage.set('aq.settings', { lang: getLang(), sound: S.sound, themeId: S.themeId, textIdx: S.textIdx, thinkIdx: S.thinkIdx, setup: S.setup });
  const saveStats = () => storage.set('aq.stats', S.stats);
  const saveLessons = () => storage.set('aq.lessons', S.lessons);
  const saveGame = () => {
    const M = S.match;
    if (S.scene !== 'play' || !M || M.lesson || M.auto) return;
    S.save = M.over || !M.hist.length ? null : { level: M.level, human: M.human, two: M.two, moves: M.hist.map((h) => [h.mv.from, h.mv.to]) };
    storage.set('aq.save', S.save);
  };

  // ------------------------------------------------------------------------------ sound
  const sfx = (o) => { if (S.sound) audio.tone(o); };
  const SOUNDS = {
    step: (who) => { sfx({ freq: who === 1 ? 420 : 300, to: who === 1 ? 300 : 210, dur: 0.07, type: 'triangle', vol: 0.14 }); sfx({ freq: 1300, dur: 0.02, type: 'square', vol: 0.025 }); },
    jump: () => { sfx({ freq: 300, to: 760, dur: 0.22, type: 'sine', vol: 0.07 }); sfx({ freq: 150, to: 380, dur: 0.2, type: 'triangle', vol: 0.05 }); },
    land: () => { sfx({ freq: 210, to: 120, dur: 0.1, type: 'sine', vol: 0.15 }); sfx({ freq: 1250, dur: 0.02, type: 'square', vol: 0.025 }); },
    capture: () => { sfx({ freq: 560, to: 220, dur: 0.18, type: 'triangle', vol: 0.13 }); sfx({ freq: 150, to: 90, dur: 0.22, type: 'sine', vol: 0.12 }); sfx({ freq: 2200, dur: 0.03, type: 'square', vol: 0.03 }); },
    select: () => sfx({ freq: 620, to: 760, dur: 0.06, type: 'sine', vol: 0.08 }),
    refuse: () => sfx({ freq: 170, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.06 }),
    undo: () => sfx({ freq: 520, to: 330, dur: 0.1, type: 'triangle', vol: 0.1 }),
    hint: () => { sfx({ freq: 660, dur: 0.12, type: 'sine', vol: 0.1 }); sfx({ freq: 990, dur: 0.18, type: 'sine', vol: 0.06 }); },
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.08 }),
    lose: () => { [392, 330, 262].forEach((f, i) => sfx({ freq: f, to: f * 0.96, dur: 0.4, type: 'sine', vol: 0.09 - i * 0.01 })); },
    draw: () => { sfx({ freq: 440, dur: 0.3, type: 'sine', vol: 0.09 }); sfx({ freq: 392, dur: 0.4, type: 'sine', vol: 0.07 }); },
  };

  // ------------------------------------------------------------------------------ geometry helpers
  const geoNow = () => (S.match ? playGeo(S, S.match).geo : playGeo(S, { two: true }).geo);
  const cellAt = (x, y) => {
    // the nearest point wins, out to 0.75 of the spacing: every tap inside the grid (even in the middle of a square) and a little
    // outside its edge lands on a point, which matters on small boards (small phones, large text)
    const g = geoNow(), r = g.u * 0.75;
    let best = -1, bd = Infinity;
    for (let i = 0; i < NN; i++) { const [cx, cy] = g.centers[i]; const d = Math.hypot(x - cx, y - cy); if (d <= r && d < bd) { bd = d; best = i; } }
    return best;
  };
  const toast = (msg) => { S.toast = msg; S.toastT = 2.4; };

  // ------------------------------------------------------------------------------ matches
  function launch(M) {
    S.match = M; S.scene = M.auto ? 'auto' : 'play'; S.overlay = null; S.press = null; S.endInfo = null; S.lessonInfo = null; S.winSeq = null; S.toast = null; S.lessonWait = -1; S.lessonOk = null;
  }
  function startMatch(opts, count = true) {
    if (demoLevelLocked(S, opts.level) || (count && demoOver(S))) { S.scene = 'demo-limit'; S.overlay = null; return; }
    const two = opts.level === 'two';
    const M = createMatch({ level: two ? 'skilled' : opts.level, human: two ? 1 : opts.side ?? 1, two, pal: pal(), lesson: opts.lesson ?? null, start: opts.start });
    if (count && S.demo) { S.demoGames += 1; storage.set('aq.demo', S.demoGames); }
    launch(M);
    if (!opts.lesson) { S.lastOpts = opts; S.save = null; storage.set('aq.save', null); }
  }
  function continueGame() {
    const sv = S.save;
    if (!sv) return;
    const M = createMatch({ level: sv.level ?? 'skilled', human: sv.human ?? 1, two: Boolean(sv.two), pal: pal() });
    for (const [from, to] of sv.moves) {
      const mv = legalMoves(M.st).find((m) => m.from === from && m.to === to);
      if (!mv) break;
      playMove(M, mv, true);
    }
    M.events.length = 0; M.aiT = 0.6;
    launch(M);
    S.lastOpts = { level: sv.two ? 'two' : sv.level, side: sv.human ?? 1 };
    S.overlay = 'pause'; S.ovT = 0; // resuming starts paused
  }
  function startLesson(i) {
    const L = LESSONS[i];
    if (!L || (S.demo && i >= 3)) { S.scene = 'demo-limit'; S.overlay = null; return; }
    S.lessonIdx = i;
    if (L.type === 'game') { startMatch({ level: L.level, side: L.human ?? 1, lesson: L }, false); return; }
    startMatch({ level: 'novice', side: 1, lesson: L, start: lessonStart(L) }, false);
    const M = S.match;
    M.gate = (mv) => {
      const j = judge(L, M.st, mv);
      if (!j.ok) { S.lessonInfo = { ok: false, head: tr('notQuite'), body: j.text.replace(/^(Not quite\.|Casi\.|ليس تمامًا\.)\s*/, '') }; S.overlay = 'lesson'; S.ovT = 0; SOUNDS.refuse(); return false; }
      S.lessonOk = j; S.lessonWait = 0;
      return true;
    };
  }

  // who is "You", a level name, or a side name (two players, Watch & Learn, lessons)
  const named = (M) => M.two || M.auto || (M.lesson && M.lesson.type !== 'game');
  const nameFor = (M, who) => (named(M) ? sideThe(who) : who === M.human ? tr('youWord') : lvName(M.level));
  function onEnd(M, e) {
    const w = e.winner;
    const lessonGame = M.lesson && M.lesson.type === 'game';
    const youWon = !M.two && !M.auto && !(M.lesson && !lessonGame) && w === M.human;
    const st = M.st, a = countOf(st, 1), b = countOf(st, 2);
    let head, body;
    if (w === 0) head = tr('aDraw');
    else if (named(M)) head = tr('sideWin', { side: sideThe(w) });
    else head = youWon ? tr('youWin') : tr('levelWins', { name: lvName(M.level) });
    const lo = other(w);
    if (e.why === 'captured') {
      if (named(M)) body = tr('capSide', { side: sideThe(w) });
      else body = youWon ? tr('capYou') : tr('capOne', { name: lvName(M.level) });
    } else if (e.why === 'blocked') {
      if (named(M)) body = tr('blkSide', { side: sideThe(lo) });
      else body = youWon ? tr('blkYou') : tr('blkOne');
    } else {
      const lead = tr('limitLead', { n: QUIET_LIMIT });
      const hi = w === 1 ? a : b, lw = w === 1 ? b : a;
      if (w === 0) body = tr('endEqual', { lead, n: piecesText(a) });
      else if (named(M)) body = tr('endMoreSide', { lead, side: sideThe(w), a: hi, b: lw });
      else if (youWon) body = tr('endMoreYou', { lead, a: hi, b: lw });
      else body = tr('endMoreOne', { lead, name: lvName(M.level), a: hi, b: lw });
    }
    let rec = '', lessonOk = false;
    if (!M.two && !M.auto && !M.lesson) {
      const key = recKey(M.level, M.human);
      const r = S.stats[key] ?? [0, 0, 0];
      r[w === 0 ? 1 : youWon ? 0 : 2] += 1;
      S.stats[key] = r; saveStats();
      S.progress.games += 1; if (youWon) S.progress.wins += 1; storage.set('aq.progress', S.progress);
      const tot = [0, 0, 0];
      for (const sd of [1, 2]) { const q = S.stats[recKey(M.level, sd)] ?? [0, 0, 0]; for (let i = 0; i < 3; i++) tot[i] += q[i]; }
      rec = tr('recordLine', { label: tr('record'), level: lvName(M.level), w: tot[0], d: tot[1], l: tot[2] });
      S.save = null; storage.set('aq.save', null);
    }
    if (lessonGame) { lessonOk = youWon; if (lessonOk) { S.lessons[M.lesson.id] = true; saveLessons(); } }
    S.endInfo = { head, body, rec, winner: w, lessonOk };
    if (w === 0) SOUNDS.draw();
    else if (M.two || M.auto || M.lesson || youWon) S.winSeq = { t: 0, i: 0 };
    else SOUNDS.lose();
  }

  function handleEvents(M) {
    for (const e of M.events) {
      if (e.type === 'step') SOUNDS.step(e.who);
      else if (e.type === 'jump') SOUNDS.jump();
      else if (e.type === 'land') { const g = geoNow(), [cx, cy] = g.centers[e.at]; if (e.kind === 'jump') SOUNDS.land(); spawn(M, rng, cx, cy, e.who, 'land'); }
      else if (e.type === 'capture') { SOUNDS.capture(); const g = geoNow(), [cx, cy] = g.centers[e.at]; spawn(M, rng, cx, cy, e.who, 'capture'); }
      else if (e.type === 'refuse') {
        SOUNDS.refuse();
        const key = { must: 'tMust', stuck: 'tStuck', foe: 'tFoe', far: 'tFar', back: 'tBack', pick: 'tPick', chain: 'tChain' }[e.why];
        if (key) toast(tr(key));
      } else if (e.type === 'select') SOUNDS.select();
      else if (e.type === 'undo') SOUNDS.undo();
      else if (e.type === 'end') onEnd(M, e);
      else if (e.type === 'burst' && M.over && M.over.winner) {
        const g = geoNow();
        for (let i = 0; i < NN; i++) if (M.st.cells[i] === M.over.winner && i % 2 === 0) { const [cx, cy] = g.centers[i]; spawn(M, rng, cx, cy, M.over.winner, 'win'); }
      }
    }
    if (M.events.some((e) => e.type === 'step' || e.type === 'jump' || e.type === 'undo')) saveGame();
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
    const a = S.auto;
    const M = createMatch({ auto: true, pal: pal() });
    S.match = M; S.winSeq = null; S.endInfo = null;
    Object.assign(a, { phase: 'intro', t: 0, plan: null, task: null, scan: null, note: { head: '', why: '' }, need: 0 });
  }
  function startAuto() {
    S.auto = { phase: 'intro', t: 0, paused: false, plan: null, task: null, scan: null, note: { head: '', why: '' }, need: 0, games: 0 };
    S.scene = 'auto'; S.overlay = null; S.press = null;
    startAutoGame();
  }
  // One decision, as a generator the Pause button can freeze: the engine's own search at the side's level.
  function* planGen(st) {
    const arng = seeded(0x41c3 ^ (st.tn * 977) ^ (countOf(st, 1) * 7919 + countOf(st, 2) * 131));
    const mv = yield* thinkTask(st, AUTO_LEVEL[st.turn], arng);
    const moves = legalMoves(st);
    const note = reasonFor(st, mv, true);
    return { mv, moves, note: { head: `${sideThe(st.turn)}: ${note.head}`, why: note.why } };
  }
  function beginThink() { const a = S.auto; a.phase = 'think'; a.t = 0; a.plan = null; a.scan = null; a.task = planGen(S.match.st); a.need = legalMoves(S.match.st).length === 1 ? 1.2 : THINK_STEPS[S.thinkIdx]; }
  // THINK (configurable, the engine search runs in slices) -> REVEAL (2 s: the options light up, the chosen move is marked) -> ACT
  function updateAuto(dt) {
    const a = S.auto, M = S.match;
    if (a.paused) return;
    a.t += dt;
    if (a.phase === 'intro') {
      if (a.t >= 1.2) beginThink();
    } else if (a.phase === 'think') {
      if (a.task) { const r = a.task.next(); if (r.done) { a.plan = r.value; a.note = a.plan.note; a.task = null; } }
      const mine = []; for (let i = 0; i < NN; i++) if (M.st.cells[i] === M.st.turn) mine.push(i);
      a.scan = mine.length ? mine[Math.floor(a.t / 0.4) % mine.length] : null;
      if (a.t >= a.need && a.plan) { a.phase = 'reveal'; a.t = 0; a.scan = null; }
    } else if (a.phase === 'reveal') {
      if (a.t >= (a.need < 2 ? 1 : 2)) { a.phase = 'act'; a.t = 0; playMove(M, a.plan.mv); }
    } else if (a.phase === 'act') {
      if (a.t >= 0.7 && settled(M)) {
        if (M.over) { a.phase = 'celebrate'; a.t = 0; } else beginThink();
      }
    } else if (a.phase === 'celebrate') {
      if (a.t >= 3.6) { a.games += 1; S.overlay = 'autosum'; S.ovT = 0; a.phase = 'summary'; }
    }
  }

  // ------------------------------------------------------------------------------ store screenshots
  // `tools/arc shots` loads ?shot=1&seed=N. Seeds 900001..900099 stage a real moment (random legal moves from a fixed seed) instead
  // of random play; 901001+ / 902001+ show the English Rules pages at 100 / 300 percent, 903001+ / 904001+ Spanish, 905001+ / 906001+ Arabic.
  function thinkAdviceNow(st) { const g = thinkAdvice(st); for (;;) { const r = g.next(); if (r.done) return r.value; } }
  function runPlan(st) { const g = planGen(st); for (;;) { const r = g.next(); if (r.done) return r.value; } }
  function stageShot(n) {
    const settle = (M, secs) => { for (let i = 0; i < secs * 60; i++) stepMatch(M, 1 / 60, rng); M.events.length = 0; M.parts.length = 0; };
    const mk = (level = 'skilled', side = 1, two = false) => { S.setup = { level: two ? 'two' : level, side }; startMatch({ level: two ? 'two' : level, side }, false); S.match.freeze = true; return S.match; };
    // play `plies` moves silently: a uniformly random legal move from a fixed seed. Staged positions depend only on the rules engine
    // and the seed, never on the opponent levels, so retuning an opponent cannot change a store screenshot. (`level` is unused.)
    const ff = (M, plies, level = 'casual', seed = 7) => {
      void level;
      const r = seeded(seed);
      for (let i = 0; i < plies && !M.over; i++) { const ms = legalMoves(M.st); playMove(M, ms[r.int(ms.length)], true); }
      M.anim = {}; M.ghosts = []; M.events.length = 0; M.last = M.st.last;
    };
    const forcedFor = (st, who) => st.turn === who && st.chain < 0 && legalMoves(st).some((m) => m.cap >= 0);
    // advance quietly until `who` must capture; returns that capture
    const toCapture = (M, who) => {
      for (let k = 0; k < 160 && !M.over; k++) {
        if (forcedFor(M.st, who)) return legalMoves(M.st).find((m) => m.cap >= 0);
        ff(M, 1, 'casual', 100 + k);
      }
      return null;
    };
    const quiet = (M, who) => { for (let k = 0; k < 160 && !M.over; k++) { if (M.st.turn === who && !forcedFor(M.st, who) && M.st.chain < 0) return; ff(M, 1, 'casual', 300 + k); } };
    S.shot = true;
    setLang('en');
    S.stats = { 'skilled:1': [4, 1, 2], 'expert:1': [1, 0, 3], 'casual:2': [3, 0, 0] };
    ['step', 'diag', 'jump'].forEach((id) => { S.lessons[id] = true; });
    const sel = (M, who) => { const mv = toCapture(M, who); if (mv) M.sel = mv.from; settle(M, 1); return mv; };
    if (n === 1) { const M = mk(); ff(M, 12, 'casual', 3); quiet(M, 1); const m = legalMoves(M.st)[0]; if (m) M.sel = m.from; settle(M, 1); }
    else if (n === 2) { const M = mk(); ff(M, 20, 'casual', 5); sel(M, 1); }
    else if (n === 3) { const M = mk(); ff(M, 24, 'casual', 13); const mv = toCapture(M, 1); M.freeze = false; if (mv) playMove(M, mv); M.freeze = true; for (let i = 0; i < 0.3 * 60; i++) stepMatch(M, 1 / 60, rng); handleEvents(M); }
    else if (n === 4) { const M = mk(); ff(M, 24, 'casual', 17); toCapture(M, 1); M.hint = thinkAdviceNow(M.st); settle(M, 1); }
    else if (n === 5) { S.thinkIdx = 0; startAuto(); const M = S.match; ff(M, 12, 'casual', 19); toCapture(M, 1); settle(M, 1); S.auto.plan = runPlan(M.st); S.auto.note = S.auto.plan.note; S.auto.phase = 'reveal'; S.auto.t = 1; S.auto.need = 5; }
    else if (n === 6) { startLesson(4); settle(S.match, 1); S.match.sel = 17; }
    else if (n === 7) { S.scene = 'setup'; S.setup = { level: 'expert', side: 2 }; }
    else if (n === 8) { S.scene = 'learn'; }
    else if (n === 9) { S.themeId = 'tile'; const M = mk(); ff(M, 20, 'casual', 5); sel(M, 1); }
    else if (n === 10) { S.themeId = 'ebony'; const M = mk(); ff(M, 20, 'casual', 5); sel(M, 1); }
    else if (n === 11) { S.themeId = 'tile'; S.scene = 'title'; S.t = 0.5; }
    else if (n === 12) { S.themeId = 'ebony'; S.scene = 'title'; S.t = 0.5; }
    else if (n === 13) { S.scene = 'title'; S.t = 2.6; }
    else if (n === 14) { const M = mk('skilled', 2); ff(M, 21, 'casual', 9); settle(M, 1); }
    else if (n >= 15 && n <= 49) { // text-zoom and screen checks (QA only)
      S.textIdx = 4;
      if (n === 15) S.scene = 'title';
      else if (n === 16) S.scene = 'settings';
      else if (n === 17) S.scene = 'about';
      else if (n === 18) { const M = mk(); ff(M, 24, 'casual', 29); M.over = { winner: 1, why: 'limit' }; onEnd(M, { winner: 1, why: 'limit' }); S.overlay = 'end'; S.ovT = 1; }
      else if (n === 19) S.scene = 'learn';
      else if (n === 20) S.scene = 'setup';
      else if (n === 21) { const M = mk(); ff(M, 10, 'casual', 3); settle(M, 1); S.overlay = 'pause'; S.ovT = 1; }
      else if (n === 22) S.scene = 'demo-limit';
      else if (n === 23) { S.scene = 'howto'; S.page.howto = 2; }
      else if (n === 24) { startAuto(); ff(S.match, 12, 'casual', 19); toCapture(S.match, 1); settle(S.match, 1); S.auto.plan = runPlan(S.match.st); S.auto.note = S.auto.plan.note; S.auto.phase = 'reveal'; S.auto.t = 1; S.auto.need = 5; S.auto.paused = true; }
      else if (n === 25) { S.demo = true; S.textIdx = 0; S.scene = 'title'; }
      else if (n === 26) { const M = mk(); ff(M, 24, 'casual', 17); toCapture(M, 1); M.hint = thinkAdviceNow(M.st); settle(M, 1); }
      else if (n === 27) { S.textIdx = 0; const M = mk(); ff(M, 24, 'casual', 17); toCapture(M, 1); M.hint = thinkAdviceNow(M.st); settle(M, 1); }
      else if (n === 28) { S.textIdx = 2; startLesson(4); settle(S.match, 1); }
      else if (n === 29) { S.textIdx = 0; startLesson(6); settle(S.match, 1); S.lessonInfo = { ok: false, head: tr('notQuite'), body: tr('jSafe').replace(/^(Not quite\.|Casi\.|ليس تمامًا\.)\s*/, '') }; S.overlay = 'lesson'; S.ovT = 1; }
      else if (n === 30) { S.textIdx = 0; const M = mk(); ff(M, 13, 'casual', 3); settle(M, 1); }
      else if (n === 31) { S.textIdx = 2; const M = mk(); ff(M, 20, 'casual', 5); sel(M, 1); }
      else if (n === 32) { S.textIdx = 0; const M = mk('skilled', 1, true); ff(M, 20, 'casual', 5); sel(M, 1); }
      else if (n === 33) { S.textIdx = 0; const M = mk('skilled', 2); ff(M, 21, 'casual', 9); settle(M, 0.1); }
      else if (n === 34) { S.textIdx = 0; S.scene = 'settings'; }
      else if (n === 35) { S.textIdx = 0; S.scene = 'about'; }
      else if (n >= 36 && n <= 41) { S.textIdx = 0; S.scene = 'howto'; S.page.howto = n - 36; }
      else if (n === 42) { S.textIdx = 0; startLesson(3); settle(S.match, 1); }
      else if (n === 43) { S.textIdx = 0; const M = mk(); toCapture(M, 1); settle(M, 1); tapPoint(M, 0); M.freeze = false; }
      else if (n === 45) { S.textIdx = 0; startLesson(4); const M = S.match; settle(M, 1); const mv = legalMoves(M.st)[0]; playMove(M, mv, true); M.anim = {}; M.ghosts = []; M.events.length = 0; M.last = M.st.last; settle(M, 0.2); }
      else if (n === 46) { S.textIdx = 0; const M = mk(); ff(M, 20, 'casual', 5); const mv = toCapture(M, 1); M.freeze = false; if (mv) playMove(M, mv); M.freeze = true; for (let i = 0; i < 0.22 * 60; i++) stepMatch(M, 1 / 60, rng); handleEvents(M); }
      else if (n === 44) { S.textIdx = 0; const M = mk(); ff(M, 14, 'casual', 3); M.over = { winner: 0, why: 'limit' }; onEnd(M, { winner: 0, why: 'limit' }); S.overlay = 'end'; S.ovT = 1; }
    } else if (n >= 51 && n <= 80) { // Spanish and Arabic: review and store shots
      setLang(n <= 65 ? 'es' : 'ar');
      const k = n <= 65 ? n - 50 : n - 65;
      if (k === 1) S.scene = 'title';
      else if (k === 2) { S.scene = 'setup'; S.setup = { level: 'expert', side: 2 }; }
      else if (k === 3) { const M = mk(); ff(M, 20, 'casual', 5); sel(M, 1); }
      else if (k === 4) { const M = mk(); ff(M, 24, 'casual', 17); toCapture(M, 1); M.hint = thinkAdviceNow(M.st); settle(M, 1); }
      else if (k === 5) { S.thinkIdx = 0; startAuto(); const M = S.match; ff(M, 12, 'casual', 19); toCapture(M, 1); settle(M, 1); S.auto.plan = runPlan(M.st); S.auto.note = S.auto.plan.note; S.auto.phase = 'reveal'; S.auto.t = 1; S.auto.need = 5; }
      else if (k === 6) S.scene = 'learn';
      else if (k === 7) S.scene = 'settings';
      else if (k === 8) S.scene = 'about';
      else if (k === 9) { S.scene = 'howto'; S.page.howto = 2; }
      else if (k === 10) { startLesson(6); settle(S.match, 1); S.lessonInfo = { ok: false, head: tr('notQuite'), body: tr('jSafe').replace(/^(Not quite\.|Casi\.|ليس تمامًا\.)\s*/, '') }; S.overlay = 'lesson'; S.ovT = 1; }
      else if (k === 11) { const M = mk(); ff(M, 24, 'casual', 29); M.over = { winner: 1, why: 'captured' }; onEnd(M, { winner: 1, why: 'captured' }); S.overlay = 'end'; S.ovT = 1; }
      else if (k === 12) { const M = mk(); ff(M, 12, 'casual', 3); settle(M, 1); }
      else if (k === 13) { S.textIdx = 4; S.scene = 'title'; }
      else if (k === 14) { S.textIdx = 4; const M = mk(); ff(M, 24, 'casual', 17); toCapture(M, 1); M.hint = thinkAdviceNow(M.st); settle(M, 1); }
      else if (k === 15) { S.textIdx = 4; S.scene = 'settings'; }
    } else if (n >= 1001 && n <= 1030) { S.scene = 'rules'; S.page.rules = n - 1001; }
    else if (n >= 2001 && n <= 2030) { S.scene = 'rules'; S.page.rules = n - 2001; S.textIdx = 4; }
    else if (n >= 3001 && n <= 3030) { setLang('es'); S.scene = 'rules'; S.page.rules = n - 3001; }
    else if (n >= 4001 && n <= 4030) { setLang('es'); S.scene = 'rules'; S.page.rules = n - 4001; S.textIdx = 4; }
    else if (n >= 5001 && n <= 5030) { setLang('ar'); S.scene = 'rules'; S.page.rules = n - 5001; }
    else if (n >= 6001 && n <= 6030) { setLang('ar'); S.scene = 'rules'; S.page.rules = n - 6001; S.textIdx = 4; }
  }
  const wantsShot = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search);
  const sd = config?.seed ?? 0;
  const shotSeed = wantsShot && ((sd >= 900001 && sd <= 900080) || (sd >= 901001 && sd <= 906030)) ? sd - 900000 : 0;
  if (shotSeed) stageShot(shotSeed);

  // ------------------------------------------------------------------------------ ui plumbing
  const getScroll = (ui) => scrollOf(S, ui);
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
  function leaveToMenu() { saveGame(); S.match = null; S.auto = null; gotoScene('title'); }

  function doThink() {
    const M = S.match;
    if (!M || M.over || !humanTurn(M) || M.hintTask || M.lesson) return;
    const st = M.st;
    M.hint = null; M.sel = -1;
    M.hintTask = { gen: thinkAdvice(st), done: (adv) => { if (S.match === M && M.st === st) { M.hint = adv; SOUNDS.hint(); } } };
  }
  function doRestart() {
    const M = S.match;
    if (!M || M.auto) return;
    if (M.lesson) { startLesson(S.lessonIdx); return; }
    startMatch(S.lastOpts ?? { level: M.two ? 'two' : M.level, side: M.human }, S.demo);
  }

  function activate(id) {
    if (id == null) return;
    if (id === 'af:home') { env.openArcforgeHome?.(); return; }
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
    if (id.startsWith('lv:')) { const l = id.slice(3); if (demoLevelLocked(S, l)) return; S.setup.level = l; saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('side:')) { S.setup.side = Number(id.slice(5)); saveSettings(); SOUNDS.ui(); return; }
    if (id.startsWith('lang:')) { setLang(id.slice(5)); S.scroll = {}; saveSettings(); SOUNDS.ui(); return; }
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
        saveStats(); saveLessons(); storage.set('aq.save', null); storage.set('aq.progress', S.progress); S.resetArm = false; return;
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
      const T = lay().title, zone = T.lockOk ? creditHit(T.lock) : null;
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
    if (pr.kind === 'cell') {
      const c = S.match ? cellAt(x, y) : -1;
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

  function onUp(x, y) {
    const pr = S.press;
    S.press = null;
    if (!pr) return;
    if (pr.kind === 'cell') {
      if (S.scene === 'play' && S.match && !S.overlay && cellAt(x, y) === pr.id) { S.kbd = false; S.match.cur = pr.id; tapPoint(S.match, pr.id); }
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
    const M = S.match;
    const l = playGeo(S, M).lay;
    if (inRect(x, y, l.back)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: l.back }; return; }
    if (inRect(x, y, l.pause)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: l.pause }; return; }
    for (let i = 0; i < TOOLBAR_IDS.length; i++) {
      if (inRect(x, y, l.tool[i])) { S.press = { id: `tool:${TOOLBAR_IDS[i]}`, active: true, kind: 'tool', rect: l.tool[i] }; return; }
    }
    const c = cellAt(x, y);
    if (c >= 0) S.press = { id: c, active: true, kind: 'cell' };
  }
  function hudAction(id) {
    if (id === 'hud:back') leaveToMenu();
    else if (id === 'hud:pause') { S.overlay = 'pause'; S.ovT = 0; }
  }
  function toolAction(id) {
    const M = S.match;
    if (!M) return;
    if (id === 'undo') { if (S.canUndo) undoMatch(M); else toast(tr('tUndo')); }
    else if (id === 'think') doThink();
    else if (id === 'restart') doRestart();
  }

  // ---- auto
  function autoDown(x, y) {
    const back = playLayout(TEXT_SCALES[S.textIdx]).back;
    if (inRect(x, y, back)) { S.press = { id: 'auto:exit', active: true, kind: 'auto', rect: back }; return; }
    const l = autoLayout(TEXT_SCALES[S.textIdx]);
    for (const id of ['slower', 'pause', 'faster']) {
      if (inRect(x, y, l[id])) { S.press = { id: `auto:${id}`, active: true, kind: 'auto', rect: l[id] }; return; }
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
      const flip = geoNow().flip ? -1 : 1;
      const mv = (dr, dc) => { S.kbd = true; const r = Math.floor(M.cur / N), c = M.cur % N; M.cur = Math.max(0, Math.min(N - 1, r + dr * flip)) * N + Math.max(0, Math.min(N - 1, c + dc * flip)); };
      if (has('ArrowLeft')) mv(0, -1);
      if (has('ArrowRight')) mv(0, 1);
      if (has('ArrowUp')) mv(-1, 0);
      if (has('ArrowDown')) mv(1, 0);
      if (has('Enter') || has('Space')) { S.kbd = true; tapPoint(M, M.cur); }
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
      if (has('WheelDown')) setScroll(ui, getScroll(ui) + 150);
      if (has('WheelUp')) setScroll(ui, getScroll(ui) - 150);
      if (has('Home')) setScroll(ui, 0);
      if (has('End')) setScroll(ui, 1e9);
    }
    if (has('Escape') && ['setup', 'learn', 'howto', 'rules', 'about', 'settings', 'demo-limit'].includes(S.scene)) gotoScene('title');
  }

  // ------------------------------------------------------------------------------ main loop
  return {
    update(dt, input) {
      // A resize or rotation: re-lay out from the live size, and drop a half-made press (its rectangle is stale).
      const sw = screen.w, sh = screen.h;
      setScreen(meta.width, meta.height);
      if (sw !== screen.w || sh !== screen.h) S.press = null;
      // Watch & Learn's Pause (and the in-game pause card) freezes the whole loop: timers, search, animations, particles, the ambient clock.
      const frozen = (S.scene === 'auto' && S.auto && S.auto.paused) || S.overlay === 'pause';
      if (!frozen) S.t += dt;
      if (S.overlay) S.ovT += dt;
      if (S.toastT > 0 && !frozen) { S.toastT -= dt; if (S.toastT <= 0) S.toast = null; }
      const ptr = S.shot ? { pressed: false, down: false, released: false, x: 0, y: 0 } : input.pointer;
      if (ptr.pressed) onDown(ptr.x, ptr.y);
      else if (ptr.down) onMove(ptr.x, ptr.y, dt);
      if (ptr.released) onUp(ptr.x, ptr.y);
      else if (S.press && S.press.kind === 'cell' && !ptr.down && !ptr.pressed && !S.shot) {
        // The release never reached us (the preview gate held the game, the app was backgrounded): let go where the finger last was.
        const p = S.press; S.press = null;
        if (S.match && S.scene === 'play' && !S.overlay && cellAt(S.lastPtr.x, S.lastPtr.y) === p.id) tapPoint(S.match, p.id);
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
        // Lessons: the right move shows its explanation once the stone has landed (when the turn ends).
        const L = M.lesson;
        if (S.scene === 'play' && !S.overlay && L && S.lessonOk && !S.shot) {
          const turnDone = M.st.turn !== M.human || M.over || L.finish === 'accept';
          if (turnDone && settled(M)) {
            S.lessonWait += dt;
            if (S.lessonWait > 0.7) {
              S.lessons[L.id] = true; saveLessons();
              S.lessonInfo = { ok: true, head: tr('correct'), body: S.lessonOk.text };
              S.overlay = 'lesson'; S.ovT = 0; S.lessonOk = null;
              SOUNDS.hint();
            }
          }
        }
        if (S.scene === 'play' && M.over && !S.overlay && !(L && L.type !== 'game') && M.overT > 1.6 && settled(M) && !S.shot) { S.overlay = 'end'; S.ovT = 0; }
      }
    },

    render(ctx) {
      setScreen(meta.width, meta.height);
      render(ctx, S, buildUi(S));
    },

    getState() {
      const M = S.match;
      return {
        scene: S.scene, overlay: S.overlay, lang: getLang(), textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, theme: S.themeId, setup: S.setup,
        stats: S.stats, lessons: Object.keys(S.lessons).length, lessonIdx: S.lessonIdx, page: S.page, scroll: S.scroll, demoGames: S.demoGames,
        auto: S.auto ? { phase: S.auto.phase, t: Math.round(S.auto.t * 100) / 100, paused: S.auto.paused } : null,
        match: M ? {
          level: M.level, human: M.human, two: M.two, cells: M.st.cells.join(''), turn: M.st.turn, chain: M.st.chain, quiet: M.st.quiet,
          moves: M.hist.length, sel: M.sel, over: M.over ? [M.over.winner, M.over.why] : null, hint: M.hint ? [M.hint.mv.from, M.hint.mv.to] : null, anim: Object.keys(M.anim).length, ghosts: M.ghosts.length, ai: [Math.round(M.aiT * 100) / 100, Boolean(M.task), M.thinking, Boolean(M.hintTask)],
        } : null,
      };
    },

    // The preview clock counts real play only. Menus, setup, Learn, Rules / How to Play / About, Settings, every overlay (pause, result,
    // lesson, Watch & Learn summary), the demo card, the lessons (but not the whole-game lesson, which is real play) and Watch & Learn are free time.
    isPreviewExempt: () => S.shot || S.scene !== 'play' || Boolean(S.overlay) || Boolean(S.match && S.match.lesson && S.match.lesson.type !== 'game'),
  };
}
