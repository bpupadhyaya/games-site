// Go: state and flow. Drawing is view.js; the rule book is rules.js; the computer's brain is engine.js; lessons.js and
// puzzles.js are content. See design/ARCHITECTURE.md for the map.
//
// Placing a stone (taught in the game): TAP a crossing to aim (a ghost stone appears), TAP it again or press Place to
// play it. DRAG slides the ghost; lifting keeps it there; dragging off the board cancels. "Quick place" in Settings
// plays as soon as you lift. The computer thinks in slices (engine.js) so a frame is never blocked.
import { W, H, R, pointNear, inRect, boardLayout } from './layout.js';
import { newGame, attempt, play, isOver, group, areaScore, opp, coord, nbs, KOMI, BLACK, WHITE } from './rules.js';
import { LEVELS, PER_TICK, simsFor, createThinker, createScorer, quickMove, reasonFor } from './engine.js';
import { LESSONS, boardOf } from './lessons.js';
import { todaysPuzzle, fromRows, puzzleText } from './puzzles.js';
import { render, setupRects, lessonRects, settingsRects, quizRect, ABOUT_TEXT, HOW_TEXT } from './view.js';
import { titleButtons, PAGE_NAV, TEXT_SCALES, TEXT_BTN, THINK_STEPS, REVEAL_TIME, AUTOPLAY } from './layout.js';
import { RULES } from './content.js';
import { THEMES, warm } from './art.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, DEMO_LESSONS = 3;
const NAMES = { 1: 'Black', 2: 'White' };

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const S = {
    scene: 'title', t: 0, prefs: { sound: true, calm: false, big: false, quick: false, theme: 'kaya', textScaleIdx: 0, apThinkIdx: 1 },
    setup: { n: 9, level: 1, human: 1 },
    g: newGame(9), human: 1, two: false, level: 1, phase: 'play',
    pend: -1, pendOn: false, pendColor: 1, aim: null, anim: [], refuse: null, hint: null, msg: null, undo: [], sfx: [],
    thinking: false, thinkProg: 0, thinkKind: '', thinkT: 0,
    score: null, deadList: [], scorer: false, confetti: [],
    lesson: { i: 0, step: 0, done: false, tapped: [], showAt: false, retry: 0 }, learned: [],
    pz: null, daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 },
    stats: { played: 0, wins: 0 }, saved: null, demoGames: 0, demo: config.demo === true, dev: config.dev === true,
    tap: null, down: false, fromLesson: -1,
    rulesPage: 0, aboutPage: 0, howPage: 0,
    // Auto Play: a free, silent, save/stats-untouched THINK -> REVEAL -> ACT demonstration (STATUS.md).
    ap: null,
  };
  let thinker = null, hintThinker = null, scorer = null, quick = null;

  // ---- persistence ------------------------------------------------------------------------------------------------
  // Guard the lookup and clamp on load: a stale saved index from a build with a longer/shorter
  // TEXT_SCALES array must never produce a NaN (or out-of-range) font size on the reference pages.
  storage.get('prefs', null).then((v) => { if (v) { S.prefs = { ...S.prefs, ...v }; if (!THEMES[S.prefs.theme]) S.prefs.theme = 'kaya'; S.prefs.textScaleIdx = Math.min(Math.max(S.prefs.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1); S.prefs.apThinkIdx = Math.min(Math.max(S.prefs.apThinkIdx ?? 1, 0), THINK_STEPS.length - 1); audio.setMuted?.(!S.prefs.sound); } });
  storage.get('progress', null).then((v) => { if (v) S.stats = { played: v.played ?? 0, wins: v.wins ?? 0 }; });
  storage.get('learned', []).then((v) => { if (Array.isArray(v)) S.learned = [...new Set([...S.learned, ...v])]; });
  storage.get('daily', null).then((v) => { if (v) { S.daily.solvedDay = v.solvedDay ?? -1; S.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { S.demoGames = Math.max(S.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.g && !isOver(v.g) && S.scene === 'title') S.saved = v; });
  const savePrefs = () => storage.set('prefs', S.prefs);
  const saveGame = () => { if (S.scene === 'play' && S.phase === 'play' && S.g.moves > 0) { S.saved = { g: S.g, human: S.human, two: S.two, level: S.level }; storage.set('save', S.saved); } };
  const clearSave = () => { S.saved = null; storage.remove('save'); };
  const saveStats = () => storage.set('progress', { played: S.stats.played, wins: S.stats.wins });

  // ---- small helpers ---------------------------------------------------------------------------------------------
  const say = (text, hold = 6) => { S.msg = { text, t: 0, hold }; };
  // Auto Play is silent by design, exactly like an AI-vs-AI attract demo: no viewer chose to hear
  // the computer play itself. This covers the loop itself and the shared score/over phase it ends in.
  const isAutoplay = () => S.scene === 'autoplay';
  const tone = (o) => { if (S.prefs.sound && !isAutoplay()) audio.tone(o); };
  const later = (delay, o) => S.sfx.push({ t: delay, o });
  const clack = (big = false) => { tone({ freq: big ? 240 : 200, to: 80, dur: 0.09, type: 'triangle', vol: 0.13 }); later(0.025, { freq: 900, to: 500, dur: 0.03, type: 'sine', vol: 0.05 }); };
  const rattle = (k) => { for (let i = 0; i < Math.min(4, k + 1); i++) later(0.05 + i * 0.05, { freq: 320 - i * 40, to: 120, dur: 0.05, type: 'triangle', vol: 0.06 }); };
  const dur = (d) => (S.prefs.calm ? d * 0.5 : d);
  const boardL = () => boardLayout(S.g.n);
  const canMenu = () => true;

  function resetBoardState(extra) {
    thinker = hintThinker = scorer = quick = null;
    Object.assign(S, { pend: -1, pendOn: false, aim: null, anim: [], refuse: null, hint: null, msg: null, undo: [], thinking: false, thinkProg: 0, thinkKind: '', thinkT: 0, score: null, deadList: [], scorer: false, phase: 'play', confetti: [], fromLesson: -1 }, extra);
  }

  // ---- undo -------------------------------------------------------------------------------------------------------
  const snap = () => { const g = S.g; return { b: g.b.slice(), turn: g.turn, ko: g.ko, caps: g.caps.slice(), passes: g.passes, moves: g.moves, last: g.last, hl: g.hist.length, lc: g.lastCaptured.slice() }; };
  const pushUndo = () => S.undo.push(snap());
  function restore(s) {
    const g = S.g; g.b = s.b.slice(); g.turn = s.turn; g.ko = s.ko; g.caps = s.caps.slice(); g.passes = s.passes; g.moves = s.moves; g.last = s.last; g.hist.length = s.hl; g.lastCaptured = s.lc.slice();
    S.pend = -1; S.pendOn = false; S.hint = null; S.anim = []; thinker = hintThinker = null; S.thinking = false; S.thinkKind = ''; S.phase = 'play'; S.score = null; scorer = null; S.scorer = false;
  }
  const canUndo = () => (S.scene === 'play' && !S.two ? S.undo.some((s) => s.turn === S.human) : S.undo.length > 0);
  function undo() {
    if (!canUndo()) return false;
    let s; while ((s = S.undo.pop())) { restore(s); if (S.scene !== 'play' || S.two || s.turn === S.human) break; }
    say('Move taken back.', 3); tone({ freq: 400, to: 300, dur: 0.06, type: 'sine', vol: 0.06 });
    return true;
  }

  // ---- moves ----------------------------------------------------------------------------------------------------------
  // Apply a move that has already been checked. Animations, sounds, messages. i = -1 is a pass.
  function doMove(i) {
    const g = S.g, me = g.turn, r = play(g, i);
    if (!r.ok) return r;
    S.pend = -1; S.pendOn = false; S.hint = null;
    if (i >= 0) {
      S.anim.push({ type: 'drop', i, c: me, t: 0, dur: dur(0.22) });
      for (const c of r.captured) S.anim.push({ type: 'cap', i: c, c: opp(me), t: 0, dur: dur(0.45) });
      clack(); if (r.captured.length) rattle(r.captured.length);
    } else tone({ freq: 330, to: 260, dur: 0.12, type: 'sine', vol: 0.07 });
    return r;
  }
  function refuse(i, r) {
    S.refuse = { i, c: S.pendColor, t: 0 }; S.pendOn = false; S.pend = -1;
    say(r.msg, 7); tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.07 });
  }
  const atariNote = (g, whose) => {
    const n = g.n, seen = new Set();
    for (let i = 0; i < n * n; i++) if (g.b[i] === whose && !seen.has(i)) { const gr = group(g.b, n, i); gr.stones.forEach((s) => seen.add(s)); if (gr.libs.length === 1) return gr; }
    return null;
  };

  // ---- games ------------------------------------------------------------------------------------------------------------
  function startGame(n, level, humanSide, lessonIdx = -1) {
    if (S.demo && lessonIdx < 0 && S.demoGames >= DEMO_GAMES) { S.scene = 'demo-limit'; return; }
    if (S.demo && lessonIdx < 0) { S.demoGames += 1; storage.set('demoGames', S.demoGames); }
    resetBoardState({ scene: 'play', g: newGame(n), level, two: humanSide === 0, human: humanSide === 0 ? 1 : humanSide, fromLesson: lessonIdx });
    S.pendColor = 1;
    say(humanSide === 0 ? 'Black plays first. Tap a crossing, then tap it again to place a stone.' : humanSide === 1 ? 'You are Black and move first. TAP a crossing, then TAP it again (or press Place).' : 'You are White. Black (the computer) moves first.');
    monetization.track('game_start', { n, level, side: humanSide });
  }
  function resumeGame() {
    const v = S.saved; if (!v) return;
    resetBoardState({ scene: 'play', g: { ...v.g, b: v.g.b.slice(), caps: v.g.caps.slice(), hist: v.g.hist.slice(), lastCaptured: [] }, level: v.level, two: v.two, human: v.human });
    say('Game restored.', 3);
  }
  function beginScoring() {
    S.phase = 'scoring'; S.scorer = true; S.deadList = []; S.score = areaScore(S.g, []);
    scorer = createScorer(S.g, rng.int(1e9) + 1, S.g.n >= 13 ? 160 : 240);
    say('Both players passed. Counting the board...', 20);
    tone({ freq: 440, to: 330, dur: 0.2, type: 'sine', vol: 0.08 });
  }
  function acceptScore() {
    if (S.phase !== 'scoring' || S.scorer) return;
    S.phase = 'over';
    // Auto Play never touches the real save slot, stats or analytics - only the shared display and
    // scoring math (S.score/areaScore) are reused, exactly like a normal game-end otherwise.
    if (!isAutoplay()) clearSave();
    const win = S.score.winner, mine = S.two ? 0 : S.human;
    if (S.fromLesson >= 0) { markLearned(LESSONS[S.fromLesson].id); }
    if (!isAutoplay()) { S.stats.played += 1; if (!S.two && win === mine) S.stats.wins += 1; saveStats(); }
    if (!isAutoplay() && !S.two && win === mine) { spawnConfetti(); tone({ freq: 523, to: 784, dur: 0.4, type: 'triangle', vol: 0.09 }); }
    else tone({ freq: 392, to: 330, dur: 0.35, type: 'triangle', vol: 0.08 });
    const by = Math.abs(S.score.diff);
    say(S.two ? `${NAMES[win]} wins by ${by}.` : win === mine ? `You win by ${by}. Well played!` : `The computer wins by ${by}. Try Undo, the hints, or a gentler level.`, 60);
    if (!isAutoplay()) monetization.track('game_end', { winner: win, moves: S.g.moves });
  }
  function spawnConfetti() {
    S.confetti = [];
    for (let k = 0; k < 40; k++) S.confetti.push({ x: 60 + rng.range(0, 600), y: 360 + rng.range(0, 60), vx: rng.range(-40, 40), vy: rng.range(60, 220), t: rng.range(0, 0.6), col: ['#f3cf7a', '#e6533c', '#f6e3b4', '#7fc7a0'][rng.int(4)] });
  }
  function markLearned(id) {
    if (!S.learned.includes(id)) { S.learned.push(id); storage.set('learned', S.learned); }
  }

  // Human plays or passes (in a normal game)
  function humanTurn() { return S.phase === 'play' && !isOver(S.g) && (S.two || S.g.turn === S.human) && !S.thinking; }
  function afterMove() {
    saveGame();
    if (isOver(S.g)) { if (S.scene === 'play' || S.scene === 'autoplay') beginScoring(); return; }
  }
  function playHuman(i) {
    if (!humanTurn()) return;
    const g = S.g, me = g.turn;
    const r = attempt(g, i);
    if (!r.ok) return refuse(i, r);
    pushUndo(); const done = doMove(i);
    if (done.captured.length) say(`${NAMES[me]} captured ${done.captured.length} stone${done.captured.length > 1 ? 's' : ''}.`, 3.5);
    else if (S.g.b[i]) { const gr = atariNoteAround(S.g, i, opp(me)); if (gr) say('Atari! That group has one liberty left: it can be captured next move.', 5); else S.msg = null; }
    afterMove();
  }
  function atariNoteAround(g, i, enemy) {
    for (const j of nbs(g.n)[i]) if (g.b[j] === enemy) { const gr = group(g.b, g.n, j); if (gr.libs.length === 1) return gr; }
    return null;
  }
  function passHuman() {
    if (!humanTurn()) return;
    pushUndo(); doMove(-1); say(S.g.passes >= 2 ? 'Both players passed.' : `${NAMES[opp(S.g.turn)]} passes.`, 3.5);
    afterMove();
  }

  // ---- the computer ----------------------------------------------------------------------------------------------------
  function bannedSet(g) { const s = new Set(); for (let i = 0; i < g.n * g.n; i++) if (!g.b[i] && !attempt(g, i).ok) s.add(i); return s; }
  function startThinking() {
    S.thinking = true; S.thinkT = 0; S.thinkProg = 0; S.thinkKind = 'move';
    const g = S.g, banned = bannedSet(g);
    if (S.level === 0) quick = { banned, seed: rng.int(1e9) + 1 };
    else thinker = createThinker(g, { sims: simsFor(S.level, g.n), seed: rng.int(1e9) + 1, banned });
  }
  function stepThinking(dt) {
    const g = S.g; S.thinkT += dt;
    let mv = -2, wr = 0.5, res = null;
    if (quick) { if (S.thinkT < 0.6) { S.thinkProg = S.thinkT / 0.6; return; } mv = quickMove(g, makeR(quick.seed), quick.banned); wr = g.passes === 1 ? 1 : 0; }
    else { res = thinker.step(PER_TICK[g.n] ?? 8); S.thinkProg = thinker.progress(); if (!res || S.thinkT < 0.7) return; mv = res.move; wr = res.winrate; }
    if (res && S.level === 1 && res.moves.length > 1 && rng.chance(0.22)) mv = res.moves[1].mv;
    if (g.passes === 1 && wr >= 0.65) mv = -1;
    if (g.moves > g.n * g.n * 3) mv = -1;
    if (mv >= 0 && !attempt(g, mv).ok) mv = -1;
    thinker = null; quick = null; S.thinking = false; S.thinkKind = '';
    const me = g.turn;
    pushUndo();
    const done = doMove(mv);
    if (mv < 0) say(g.passes >= 2 ? 'The computer passes too.' : 'The computer passes. Pass as well to finish, or play on.', 6);
    else {
      if (done.captured.length) say(`The computer captured ${done.captured.length} stone${done.captured.length > 1 ? 's' : ''}.`, 4);
      else { const a = atariNote(g, opp(me)); if (a) say(`Careful: your group at ${coord(g.n, a.stones[0])} has one liberty left (atari).`, 6); else S.msg = null; }
    }
    afterMove();
  }
  const makeR = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

  function askHint() {
    if (S.scene === 'puzzle') { S.hint = { mv: S.pz.p.answers[0] }; say('The glowing point is the key move.', 6); return; }
    if (S.scene === 'lesson') {
      const st = LESSONS[S.lesson.i].steps[S.lesson.step], w = st.want;
      if (w.kind === 'hint') { hintStart(); return; }
      S.lesson.showAt = true; say('Hint: ' + st.hint, 8); return;
    }
    if (!humanTurn() || hintThinker) return;
    hintStart();
  }
  function hintStart() {
    S.thinkKind = 'hint';
    hintThinker = createThinker(S.g, { sims: Math.max(60, Math.round(simsFor(2, S.g.n) / 3)), seed: rng.int(1e9) + 1, banned: bannedSet(S.g), color: S.g.turn });
  }
  function stepHint() {
    const res = hintThinker.step(PER_TICK[S.g.n] ?? 8); if (!res) return;
    hintThinker = null; S.thinkKind = '';
    S.hint = { mv: res.move };
    say(res.move >= 0 ? `Hint: ${coord(S.g.n, res.move)}. ${reasonFor(S.g, res.move)}` : 'Hint: nothing useful is left. Passing is fine.', 9);
    if (S.scene === 'lesson') { const st = LESSONS[S.lesson.i].steps[S.lesson.step]; if (st.want.kind === 'hint') completeStep(); }
  }

  // ---- Auto Play: a free, silent, whole-game THINK -> REVEAL -> ACT demonstration -------------------------------------
  // Decision-point unit: one stone placement or pass, the same unit attempt()/play() already use.
  // Reuses the real computer opponent (engine.js createThinker/quickMove, the SAME code path
  // startThinking()/stepThinking() use for a human game) to drive BOTH Black and White, and the
  // real move/turn-resolution code (doMove/afterMove/beginScoring/acceptScore) - never a separate
  // fake execution path. Never touches S.stats or the save slot (guarded above by isAutoplay()).
  function startAutoplay() {
    thinker = hintThinker = scorer = quick = null;
    resetBoardState({ scene: 'autoplay', g: newGame(S.setup.n), level: S.setup.level, two: true, human: 1, fromLesson: -1 });
    S.pendColor = 1;
    S.ap = { phase: 'think', t: 0, decideT: 0, chosen: null, paused: false };
    apEnterThink();
  }
  function apEnterThink() {
    S.ap.phase = 'think'; S.ap.t = 0; S.ap.decideT = 0; S.ap.chosen = null;
    const g = S.g, banned = bannedSet(g);
    thinker = quick = null;
    if (S.level === 0) quick = { banned, seed: rng.int(1e9) + 1 };
    else thinker = createThinker(g, { sims: simsFor(S.level, g.n), seed: rng.int(1e9) + 1, banned });
  }
  // The exact decision logic of stepThinking(), stopping short of acting on it: the chosen move is
  // held in S.ap.chosen (nothing drawn from it) until REVEAL, matching every other game's pattern.
  function apDecide(dt) {
    if (S.ap.chosen !== null) return;
    const g = S.g; S.ap.decideT += dt;
    let mv = -2, wr = 0.5, res = null;
    if (quick) { if (S.ap.decideT < 0.6) { S.thinkProg = S.ap.decideT / 0.6; return; } mv = quickMove(g, makeR(quick.seed), quick.banned); wr = g.passes === 1 ? 1 : 0; }
    else { res = thinker.step(PER_TICK[g.n] ?? 8); S.thinkProg = thinker.progress(); if (!res) return; mv = res.move; wr = res.winrate; }
    if (res && S.level === 1 && res.moves.length > 1 && rng.chance(0.22)) mv = res.moves[1].mv;
    if (g.passes === 1 && wr >= 0.65) mv = -1;
    if (g.moves > g.n * g.n * 3) mv = -1;
    if (mv >= 0 && !attempt(g, mv).ok) mv = -1;
    thinker = null; quick = null;
    S.ap.chosen = mv;
  }
  function updateAutoplay(dt, p) {
    const A = S.ap, on = (r) => p.released && inRect(r, p.x, p.y);
    if (on(AUTOPLAY.exit)) { thinker = hintThinker = scorer = quick = null; S.scene = 'title'; return; }
    if (on(AUTOPLAY.dec) && S.prefs.apThinkIdx > 0) { S.prefs.apThinkIdx--; savePrefs(); }
    else if (on(AUTOPLAY.inc) && S.prefs.apThinkIdx < THINK_STEPS.length - 1) { S.prefs.apThinkIdx++; savePrefs(); }
    else if (on(AUTOPLAY.pause) && S.phase !== 'over') A.paused = !A.paused;
    if (A.paused) return;
    if (S.phase === 'over') {
      if (p.released && inRect(R.done, p.x, p.y)) startAutoplay();
      else if (p.released && inRect(R.menu, p.x, p.y)) S.scene = 'title';
      return;
    }
    if (S.phase === 'scoring') {
      if (scorer) {
        const budget = on(AUTOPLAY.skip) ? 1e6 : (PER_TICK[S.g.n] ?? 8) * 3;    // Skip: finish counting now
        const res = scorer.step(budget);
        if (res) { S.deadList = res.dead; S.score = areaScore(S.g, res.dead); S.scorer = false; scorer = null; A.t = 0; }
        return;
      }
      A.t += dt;
      if (on(AUTOPLAY.skip)) A.t = REVEAL_TIME;
      if (A.t >= REVEAL_TIME) acceptScore();
      return;
    }
    if (on(AUTOPLAY.skip)) {
      if (S.anim.length) for (const a of S.anim) a.t = a.dur;
      else if (A.phase === 'think') A.t = THINK_STEPS[S.prefs.apThinkIdx];
      else if (A.phase === 'reveal') A.t = REVEAL_TIME;
    }
    if (A.phase === 'think') {
      A.t += dt; apDecide(dt);
      if (A.chosen !== null && A.t >= THINK_STEPS[S.prefs.apThinkIdx]) { A.phase = 'reveal'; A.t = 0; }
    } else if (A.phase === 'reveal') {
      A.t += dt;
      if (A.t >= REVEAL_TIME) {
        const mv = A.chosen, me = S.g.turn; A.chosen = null; A.phase = 'act';
        pushUndo(); const done = doMove(mv);
        if (mv < 0) say(S.g.passes >= 2 ? 'Both players have now passed.' : `${NAMES[me]} passes.`, 4);
        else if (done.captured.length) say(`${NAMES[me]} captured ${done.captured.length} stone${done.captured.length > 1 ? 's' : ''}.`, 4);
        else S.msg = null;
        afterMove();
        if (S.phase === 'play') apEnterThink();
      }
    }
  }

  // ---- lessons ------------------------------------------------------------------------------------------------------------
  function startLesson(i, step = 0) {
    if (S.demo && i >= DEMO_LESSONS) { S.scene = 'demo-limit'; return; }
    const L = LESSONS[i], st = L.steps[step];
    if (st.want.kind === 'game') { startGame(L.n, 0, 1, i); return; }
    const keep = st.keep && S.scene === 'lesson' && S.lesson.i === i;
    const prevUndo = S.undo, g = keep ? S.g : (() => { const g0 = newGame(L.n, 0.5); g0.b = boardOf(st.rows || L.rows); return g0; })();
    resetBoardState({ scene: 'lesson', g, two: true, human: st.turn, undo: keep ? prevUndo : [] });
    S.g.turn = st.turn; S.pendColor = st.turn;
    S.lesson = { i, step, done: false, tapped: [], showAt: false, retry: 0 };
    S.msg = null;
  }
  const PRAISE = ['Well done!', 'Exactly right.', 'That is it.', 'Nicely played.'];
  function completeStep(text) {
    if (S.lesson.done) return;
    S.lesson.done = true; S.pend = -1; S.pendOn = false; S.lesson.showAt = false;
    say(text ?? PRAISE[(S.lesson.i + S.lesson.step) % PRAISE.length], 60);
    tone({ freq: 523, to: 784, dur: 0.3, type: 'triangle', vol: 0.09 });
  }
  function nextStep() {
    const L = LESSONS[S.lesson.i];
    if (S.lesson.step + 1 >= L.steps.length) { markLearned(L.id); S.scene = 'lessons'; return; }
    startLesson(S.lesson.i, S.lesson.step + 1);
  }
  function lessonFail(text) { S.lesson.retry = 1.7; say(text, 3); }
  function lessonPlace(i) {
    const L = LESSONS[S.lesson.i], st = L.steps[S.lesson.step], w = st.want, g = S.g, n = g.n;
    if (S.lesson.done || S.lesson.retry > 0) return;
    if (w.kind === 'libs' || w.kind === 'quiz' || w.kind === 'pass') { say(w.kind === 'quiz' ? 'Tap one of the answers below.' : w.kind === 'pass' ? 'Press the Pass button.' : 'Follow the instruction above.', 4); S.pend = -1; S.pendOn = false; return; }
    if (w.at && !w.at.some(([x, y]) => y * n + x === i)) { say('Aim at the glowing point.', 4); S.lesson.showAt = true; S.pend = -1; S.pendOn = false; return; }
    const r = attempt(g, i);
    if (!r.ok) { refuse(i, r); if (w.kind === 'refused' && (!w.why || r.why === w.why)) completeStep(`${r.msg} Good: now you know the rule.`); return; }
    if (w.kind === 'refused') { say('That move is allowed. Try the marked point.', 4); S.lesson.showAt = true; return; }
    pushUndo(); const done = doMove(i); const turn = st.turn; g.turn = turn;
    if (w.kind === 'capture') { if (done.captured.length) completeStep(`Captured ${done.captured.length} stone${done.captured.length > 1 ? 's' : ''}! The stones are removed and the points become empty.`); else lessonFail('That does not capture anything. Try again.'); }
    else if (w.kind === 'atari') { if (atariNoteAround(g, i, opp(turn))) completeStep('Atari! The white stone has one liberty left and will be captured next move.'); else lessonFail('That is not atari: the stone still has two liberties. Try again.'); }
    else if (w.kind === 'place') { if (st.want.kind === 'place' && L.id === 'tools' && S.lesson.step === 0) completeStep('Now you have a stone on the board. Next you will take it back.'); else completeStep(L.id === 'stone' ? 'Your first stone. Stones never move once played: they are only ever removed by capture.' : undefined); }
  }
  function lessonTapPoint(i) {
    const st = LESSONS[S.lesson.i].steps[S.lesson.step], w = st.want, g = S.g, n = g.n;
    if (w.kind !== 'libs' || S.lesson.done) return false;
    const [sx, sy] = w.at, si = sy * n + sx, libs = group(g.b, n, si).libs;
    if (g.b[i]) { say('That is a stone. Tap the EMPTY points that touch it.', 4); return true; }
    if (!libs.includes(i)) { say('That point does not touch the stone directly. Only up, down, left and right count.', 4); return true; }
    if (!S.lesson.tapped.includes(i)) { S.lesson.tapped.push(i); clack(); }
    if (S.lesson.tapped.length === libs.length) completeStep(`Yes: ${libs.length} liberties. A stone with no liberties is captured.`);
    return true;
  }
  function lessonQuiz(idx) {
    const st = LESSONS[S.lesson.i].steps[S.lesson.step], w = st.want;
    if (S.lesson.done || w.kind !== 'quiz') return;
    if (idx === w.correct) completeStep(`Correct: ${w.options[idx]}.`); else { say('Not quite. ' + st.hint, 6); tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.07 }); }
  }

  // ---- puzzle --------------------------------------------------------------------------------------------------------------
  function startPuzzle() {
    const p = todaysPuzzle(config.day ?? 0), g = fromRows(p);
    resetBoardState({ scene: 'puzzle', g, two: true, human: p.turn, pz: { p, status: S.daily.solvedDay === S.daily.day ? 'solved' : 'ready', retry: 0 } });
    S.pendColor = p.turn;
  }
  function puzzlePlace(i) {
    const pz = S.pz, g = S.g; if (pz.retry > 0) return;
    const r = attempt(g, i); if (!r.ok) return refuse(i, r);
    pushUndo(); doMove(i); g.turn = pz.p.turn;
    if (pz.p.answers.includes(i)) {
      pz.status = 'solved';
      say(pz.p.kind === 'kill' ? 'Solved! The marked stones cannot escape now.' : 'Solved! That keeps the marked stones safe.', 60);
      tone({ freq: 523, to: 784, dur: 0.35, type: 'triangle', vol: 0.09 });
      if (S.daily.solvedDay !== S.daily.day) { S.daily.streak = S.daily.solvedDay === S.daily.day - 1 ? S.daily.streak + 1 : 1; S.daily.solvedDay = S.daily.day; storage.set('daily', { solvedDay: S.daily.solvedDay, streak: S.daily.streak }); spawnConfetti(); }
    } else { pz.retry = 2.2; say('Not that one: the marked stones can still get away. Watch, then try again.', 3); }
  }

  // ---- input on the board ---------------------------------------------------------------------------------------------------
  function boardInput(p, onPlace, canAim = true) {
    const L = boardL();
    if (p.pressed) {
      const i = pointNear(L, p.x, p.y);
      if (i >= 0 && canAim) { S.aim = { start: i, was: S.pend === i && S.pendOn, moved: false }; S.pend = i; S.pendOn = true; }
      else S.aim = null;
    } else if (p.down && S.aim) {
      const i = pointNear(L, p.x, p.y); if (i !== S.aim.start) S.aim.moved = true;
      S.pend = i; S.pendOn = i >= 0;
    }
    if (p.released && S.aim) {
      const a = S.aim, i = S.pendOn ? S.pend : -1; S.aim = null;
      if (i < 0) { S.pend = -1; S.pendOn = false; return; }
      if (S.prefs.quick || (a.was && !a.moved)) onPlace(i);
    }
  }
  function keyboardInput(input, onPlace) {
    const k = input.keys.pressed, n = S.g.n;
    if (!k || !k.size) return;
    const mv = (dx, dy) => { let c = S.pend >= 0 ? S.pend : Math.floor(n / 2) * n + Math.floor(n / 2), x = c % n + dx, y = Math.floor(c / n) + dy; x = Math.max(0, Math.min(n - 1, x)); y = Math.max(0, Math.min(n - 1, y)); S.pend = y * n + x; S.pendOn = true; };
    if (k.has('ArrowLeft')) mv(-1, 0); if (k.has('ArrowRight')) mv(1, 0); if (k.has('ArrowUp')) mv(0, -1); if (k.has('ArrowDown')) mv(0, 1);
    if ((k.has('Enter') || k.has('Space')) && S.pend >= 0) onPlace(S.pend);
    if (k.has('KeyU')) undo(); if (k.has('KeyH')) askHint(); if (k.has('KeyP') && S.scene === 'play') passHuman();
  }
  const hit = (r, p) => p.pressed && inRect(r, p.x, p.y);
  const upHit = (r, p) => p.released && inRect(r, p.x, p.y);   // buttons act on release
  const pressedBtn = (rects, p) => rects.find((r) => upHit(r, p));

  // ---- per-scene updates ---------------------------------------------------------------------------------------------------
  function updateTitle(p) {
    if (!p.released) return;
    const B = titleButtons(!!S.saved), on = (r) => r && inRect(r, p.x, p.y);
    if (on(B.resume)) resumeGame();
    else if (on(B.play)) { if (S.demo && S.demoGames >= DEMO_GAMES) S.scene = 'demo-limit'; else S.scene = 'setup'; }
    else if (on(B.learn)) S.scene = 'lessons';
    else if (on(B.daily)) startPuzzle();
    else if (on(B.about)) { S.scene = 'about'; S.aboutPage = 0; }
    else if (on(B.how)) { S.scene = 'how'; S.howPage = 0; }
    else if (on(B.settings)) S.scene = 'settings';
    else if (on(B.rules)) { S.scene = 'rules'; S.rulesPage = 0; }
    else if (on(B.auto)) startAutoplay();
  }
  // About, How to play and Rules are all paginated the same way (one topic per page, Back/Next
  // with wraparound) and all share the same text-size stepper - one update handler for the three.
  const TEXT_STEP_TONE = (up) => tone({ freq: up ? 680 : 560, to: up ? 880 : 460, dur: 0.09, type: 'sine', vol: 0.13 });
  function updatePageNav(p, list, pageKey) {
    if (!p.released) return;
    const idx = S.prefs.textScaleIdx ?? 0;
    if (upHit(TEXT_BTN.dec, p) && idx > 0) { S.prefs.textScaleIdx = idx - 1; savePrefs(); TEXT_STEP_TONE(false); }
    else if (upHit(TEXT_BTN.inc, p) && idx < TEXT_SCALES.length - 1) { S.prefs.textScaleIdx = idx + 1; savePrefs(); TEXT_STEP_TONE(true); }
    else if (upHit(PAGE_NAV.next, p)) S[pageKey] = (S[pageKey] + 1) % list.length;
    else if (upHit(PAGE_NAV.back, p)) S.scene = 'title';
  }
  function updateSetup(p) {
    if (!p.released) return;
    const Rs = setupRects(), on = (r) => inRect(r, p.x, p.y);
    for (const o of Rs.sizes) if (on(o.r)) { S.setup.n = o.n; clack(); }
    for (const o of Rs.levels) if (on(o.r)) { S.setup.level = o.i; clack(); }
    for (const o of Rs.sides) if (on(o.r)) { S.setup.human = o.v; clack(); }
    if (on(Rs.start)) startGame(S.setup.n, S.setup.level, S.setup.human);
    if (on(Rs.back)) S.scene = 'title';
  }
  function updateLessons(p) {
    if (!p.released) return;
    lessonRects().forEach((r, i) => { if (inRect(r, p.x, p.y)) startLesson(i); });
    if (inRect({ x: 110, y: 1230, w: 500, h: 84 }, p.x, p.y)) S.scene = 'title';
  }
  function updateSettings(p) {
    if (!p.released) return;
    const Rs = settingsRects(), on = (r) => inRect(r, p.x, p.y), P = S.prefs;
    if (on(Rs.sound)) { P.sound = !P.sound; audio.setMuted?.(!P.sound); if (P.sound) clack(); }
    else if (on(Rs.calm)) P.calm = !P.calm;
    else if (on(Rs.big)) P.big = !P.big;
    else if (on(Rs.quick)) P.quick = !P.quick;
    else if (on(Rs.theme)) { const ks = Object.keys(THEMES); P.theme = ks[(ks.indexOf(P.theme) + 1) % ks.length]; }
    else if (on(Rs.back)) S.scene = 'title';
    else return;
    savePrefs();
  }

  function common(p, input, onPlace) {
    // shared bottom row + centre button for board scenes
    const pl = S.g.turn;
    S.pendColor = S.scene === 'lesson' ? LESSONS[S.lesson.i].steps[S.lesson.step].turn : S.scene === 'puzzle' ? S.pz.p.turn : pl;
    if (upHit(R.place, p) && S.pend >= 0 && S.pendOn) onPlace(S.pend);
    keyboardInput(input, onPlace);
  }

  function updatePlay(dt, p, input) {
    if (S.phase === 'play') {
      if (!S.two && !isOver(S.g) && S.g.turn !== S.human && !S.thinking && !S.anim.some((a) => a.type === 'drop' && a.t < a.dur * 0.6)) startThinking();
      if (S.thinking && S.thinkKind === 'move') stepThinking(dt);
      if (hintThinker) stepHint();
      const my = humanTurn();
      if (my) { boardInput(p, playHuman); common(p, input, playHuman); }
      if (upHit(R.pass, p)) passHuman();
      if (upHit(R.undo, p)) undo();
      if (upHit(R.hint, p)) askHint();
      if (upHit(R.menu, p)) { saveGame(); S.scene = 'title'; }
    } else if (S.phase === 'scoring') {
      if (scorer) {
        const res = scorer.step((PER_TICK[S.g.n] ?? 8) * 3);
        if (res) { S.deadList = res.dead; S.score = areaScore(S.g, res.dead); S.scorer = false; scorer = null; say(res.dead.length ? 'Dead stones are marked with a red cross. Tap a group to change it, then Accept.' : 'No dead stones found. Tap a group if you disagree, then Accept.', 60); }
      } else if (p.pressed) {
        const i = pointNear(boardL(), p.x, p.y);
        if (i >= 0 && S.g.b[i]) {
          const gr = group(S.g.b, S.g.n, i).stones, dead = new Set(S.deadList), all = gr.every((s) => dead.has(s));
          gr.forEach((s) => (all ? dead.delete(s) : dead.add(s)));
          S.deadList = [...dead]; S.score = areaScore(S.g, S.deadList); clack();
        }
      }
      if (upHit(R.done, p)) acceptScore();
      if (!S.scorer && upHit({ x: 36, y: 1290, w: 300, h: 84 }, p)) { S.g.passes = 0; S.phase = 'play'; S.score = null; S.deadList = []; say('Play continues. Your move.', 4); }
      if (upHit({ x: 384, y: 1290, w: 300, h: 84 }, p)) S.scene = 'title';
    } else if (S.phase === 'over') {
      if (upHit(R.done, p)) { S.scene = 'setup'; }
      if (upHit(R.menu, p)) S.scene = 'title';
    }
  }
  function updateLesson(dt, p, input) {
    const L = LESSONS[S.lesson.i], st = L.steps[S.lesson.step], w = st.want;
    if (S.lesson.retry > 0) { S.lesson.retry -= dt; if (S.lesson.retry <= 0) { startLesson(S.lesson.i, S.lesson.step); say('Let us try that again.', 3); } return; }
    if (hintThinker) stepHint();
    if (!S.lesson.done) {
      if (w.kind === 'libs') { if (p.pressed) { const i = pointNear(boardL(), p.x, p.y); if (i >= 0) lessonTapPoint(i); } }
      else if (w.kind === 'quiz') { for (let i = 0; i < w.options.length; i++) if (upHit(quizRect(st, i), p)) lessonQuiz(i); }
      else if (w.kind !== 'pass' && w.kind !== 'undo' && w.kind !== 'hint') { boardInput(p, lessonPlace); common(p, input, lessonPlace); }
      else if (w.kind === 'undo' || w.kind === 'hint') { boardInput(p, () => {}, false); }
      if (upHit(R.pass, p)) { if (w.kind === 'pass') { doMove(-1); S.g.turn = st.turn; S.g.passes = 0; completeStep('That is a pass. When both players pass one after the other, the game is over and the board is counted.'); } else say('You will need Pass later. For now: ' + st.text, 5); }
      if (upHit(R.undo, p)) { if (S.undo.length) { undo(); if (w.kind === 'undo') completeStep('Taken back. Undo works in every game.'); } else say('Nothing to undo yet.', 3); }
      if (upHit(R.hint, p)) askHint();
    } else if (upHit(R.next, p)) nextStep();
    if (upHit(R.menu, p)) S.scene = 'lessons';
  }
  function updatePuzzle(dt, p, input) {
    const pz = S.pz;
    if (pz.retry > 0) { pz.retry -= dt; if (pz.retry <= 0) { const p0 = todaysPuzzle(config.day ?? 0); S.g = fromRows(p0); S.anim = []; S.msg = null; S.undo = []; S.hint = null; } return; }
    if (pz.status !== 'solved') { boardInput(p, puzzlePlace); common(p, input, puzzlePlace); }
    else common(p, input, () => {});
    if (upHit(R.undo, p)) undo();
    if (upHit(R.hint, p)) askHint();
    if (upHit(R.menu, p)) S.scene = 'title';
    if (upHit(R.pass, p)) say('There is no passing in a puzzle: find the move.', 3);
  }

  return {
    update(dt, input) {
      S.t += dt;
      const p = input.pointer; S.down = p.down; S.tap = p.down ? { x: p.x, y: p.y } : null;
      // timers
      for (const a of S.anim) a.t += dt; S.anim = S.anim.filter((a) => a.t < a.dur + (a.type === 'drop' ? 0.05 : 0));
      if (S.refuse) { S.refuse.t += dt; if (S.refuse.t > 0.75) S.refuse = null; }
      if (S.msg) { S.msg.t += dt; if (S.msg.t > S.msg.hold && S.scene !== 'lesson' && !(S.scene === 'play' && S.phase !== 'play')) S.msg = null; else if (S.msg.t > S.msg.hold) S.msg = null; }
      for (const c of S.confetti) { c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; } if (S.confetti.length && S.confetti[0].t > 3) S.confetti = S.confetti.filter((c) => c.t < 2.5);
      if (S.sfx.length) { for (const s of S.sfx) s.t -= dt; for (const s of S.sfx) if (s.t <= 0) tone(s.o); S.sfx = S.sfx.filter((s) => s.t > 0); }
      if (S.scene === 'title' || S.scene === 'setup') warm(boardLayout(9), boardLayout(13), boardLayout(19), S.prefs.theme);
      // the puzzle of the day is stored by day number from config
      S.daily.day = config.day ?? S.daily.day;
      switch (S.scene) {
        case 'title': updateTitle(p); break;
        case 'setup': updateSetup(p); break;
        case 'lessons': updateLessons(p); break;
        case 'about': updatePageNav(p, ABOUT_TEXT, 'aboutPage'); break;
        case 'how': updatePageNav(p, HOW_TEXT, 'howPage'); break;
        case 'rules': updatePageNav(p, RULES, 'rulesPage'); break;
        case 'settings': updateSettings(p); break;
        case 'demo-limit': break;
        case 'play': updatePlay(dt, p, input); break;
        case 'lesson': updateLesson(dt, p, input); break;
        case 'puzzle': updatePuzzle(dt, p, input); break;
        case 'autoplay': updateAutoplay(dt, p); break;
        default: break;
      }
    },
    render(ctx) { render(ctx, S); },
    getState: () => S,
    // Auto Play is a free teaching/marketing tool, like the menu's own attract-mode preview - it
    // must never eat into the paid game's free-preview timer (kit 1.6.1).
    isPreviewExempt: () => isAutoplay(),
  };
}
