// Chess: state and flow. Drawing lives in view.js; rules in rules.js; the AI in engine.js; lessons
// and demo content in lessons.js/demo.js. This is the only file that mutates `state`.
//
// How a move is made: TAP a piece (its legal squares light up), then TAP a lit square; or DRAG the
// piece and drop it on a square. Castling: TAP/DRAG the king two squares toward the rook. Promotion
// opens a picker. An illegal attempt visibly tries, shudders back, and a message says why.
import {
  W, H, squareAt, pointXY, inRect, titleRows, BTN, BTN4, HEADER, REF_BACK, REF_NEXT, TEXT_DEC, TEXT_INC, RESULT_PANEL, PROMO, TEXT_SCALES, THINK_STEPS, DEMO_THINK, DEMO_PAUSE,
} from './layout.js';
import {
  newGame, applyMove, undoMove, tryMove, legalTargets, inCheck, WHITE, BLACK,
  TYPE_NAME, QUEEN, ROOK, BISHOP, KNIGHT, moveFrom, moveTo, moveFlag,
} from './rules.js';
import { LEVEL_COUNT, createThinker } from './engine.js';
import { LESSONS, loadStep, wantMatches, lessonTargets, miniGameReply } from './lessons.js';
import { DEMO_GAMES, demoRng } from './demo.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { invalidateArt } from './art.js';
import { invalidatePieces, warmPiece } from './pieces.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const HINTS_PER_GAME = 3, BOARD_THEMES = ['walnut', 'marble', 'rosewood'];

export function createGame(env) {
  const { rng, storage, audio, config, monetization } = env;
  const state = {
    scene: 'title', t: 0,
    g: newGame(), human: WHITE, mode: 'ai', level: 3, boardTheme: 'walnut', sound: true, flipManual: false,
    sel: -1, targets: [], drag: null, promoPending: null, cursor: 4, kb: false,
    anim: null, parts: [], rings: [], banner: null, msg: null,
    thinking: false, thinkT: 0, hint: null, hintsLeft: HINTS_PER_GAME, last: null, overOpen: false, page: 0,
    lesson: { i: 0, s: 0, done: false, showSol: false }, miniWait: 0,
    demoIdx: 0, demoSpeed: 1, demoWait: 0,
    // AI-vs-AI demo teaching loop: THINK (viewer guesses, board static) -> REVEAL (legal targets +
    // the chosen move highlighted, 2s) -> MOVE (today's existing animation) -> loop. demoThinkIdx
    // indexes THINK_STEPS (never a raw float, same pattern as textScaleIdx); demoPendingMove is
    // `undefined` while the engine is still computing, `null` if it found no legal move, or the
    // move object once ready; demoChosen is the reveal-phase highlighted destination square.
    demoPhase: null, demoTimer: 0, demoThinkIdx: 1, demoPendingMove: undefined, demoChosen: -1,
    // Freezes the whole demo loop (every phase, and any in-flight move animation) at any moment;
    // Resume continues exactly where it froze rather than restarting the current step.
    demoPaused: false,
    progress: { played: 0, wins: 0 }, learned: [],
    coach: { seen: false }, coachBubble: null,
    textScaleIdx: 0, // index into TEXT_SCALES; the About/Controls/Rules reference pages' text size
  };
  let thinker = null, hinter = null, pending = null, warmI = 0, fontFix = 0, miniRng = null, demoGameRng = null;
  const sfx = [];

  // ---- storage --------------------------------------------------------------------------------
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, boardTheme: state.boardTheme, textScaleIdx: state.textScaleIdx, demoThinkIdx: state.demoThinkIdx });
  storage.get('prefs', null).then((p) => { if (!p) return; Object.assign(state, { level: p.level ?? state.level, sound: p.sound ?? true, boardTheme: p.boardTheme ?? 'walnut', textScaleIdx: Math.min(Math.max(p.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1), demoThinkIdx: Math.min(Math.max(p.demoThinkIdx ?? 1, 0), THINK_STEPS.length - 1) }); audio.setMuted(!state.sound); });
  storage.get('progress', null).then((p) => { if (p) state.progress = { played: p.played | 0, wins: p.wins | 0 }; });
  storage.get('learned', []).then((l) => { state.learned = Array.isArray(l) ? l : []; });
  storage.get('coach', null).then((c) => { if (c) state.coach = { seen: !!c.seen }; });

  // ---- small helpers ----------------------------------------------------------------------------
  const say = (text, kind = 'info') => { state.msg = { text, kind, t: 0 }; };
  const sound = (name) => {
    // The AI-vs-AI auto-play demo plays itself continuously with no player to hear it for -
    // silent by design, the same way the menu's own attract-mode preview is silent. Nothing is
    // lost: the demo is a visual "watch how the engine plays" feature, not an audio one.
    if (!state.sound || state.scene === 'demo') return;
    if (name === 'tok') audio.tone({ freq: 220, to: 120, dur: 0.08, type: 'triangle', vol: 0.28 });
    else if (name === 'take') { audio.tone({ freq: 190, to: 90, dur: 0.11, type: 'triangle', vol: 0.34 }); sfx.push({ at: state.t + 0.07, o: { freq: 480, to: 280, dur: 0.12, type: 'square', vol: 0.05 } }); }
    else if (name === 'refuse') audio.tone({ freq: 150, to: 110, dur: 0.14, type: 'sine', vol: 0.2 });
    else if (name === 'check') { audio.tone({ freq: 660, dur: 0.14, type: 'sine', vol: 0.17 }); sfx.push({ at: state.t + 0.13, o: { freq: 880, dur: 0.22, type: 'sine', vol: 0.17 } }); }
    else if (name === 'win') [523, 659, 784, 1046].forEach((f, k) => sfx.push({ at: state.t + k * 0.14, o: { freq: f, dur: 0.32, type: 'sine', vol: 0.19 } }));
    else if (name === 'lose') [392, 330, 262].forEach((f, k) => sfx.push({ at: state.t + k * 0.18, o: { freq: f, dur: 0.34, type: 'triangle', vol: 0.19 } }));
    else if (name === 'ok') audio.tone({ freq: 680, to: 880, dur: 0.09, type: 'sine', vol: 0.13 });
  };
  const flip = () => (state.scene === 'play' && state.mode === 'ai' && state.human === BLACK) || (boardScene() && state.flipManual);
  const pxy = (s) => pointXY(s, flip());
  const clearSel = () => { state.sel = -1; state.targets = []; state.drag = null; };
  const busy = () => !!state.anim || state.thinking || !!state.promoPending;
  const myTurn = () => {
    const g = state.g; if (g.result) return false;
    if (state.scene === 'play') return state.mode === 'two' || g.st.turn === state.human;
    if (state.scene === 'lesson') return true;
    return false;
  };
  function boardScene() { return state.scene === 'play' || state.scene === 'lesson'; }

  // ---- animation ----------------------------------------------------------------------------------
  const startAnim = (o, next) => { state.anim = { t: 0, dur: 0.28, ...o }; pending = next ?? null; };
  const burst = (s) => {
    const p = pxy(s); state.rings.push({ x: p.x, y: p.y, t: 0 });
    for (let k = 0; k < 12; k++) { const a = rng.range(0, Math.PI * 2), v = rng.range(50, 200); state.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, t: 0, max: rng.range(0.3, 0.6), size: rng.range(2, 5), c: k % 2 === 0 ? '210,60,40' : '250,214,140' }); }
  };
  const doMove = (m, then) => {
    const g = state.g, piece = g.st.board[m.from];
    const r = applyMove(g, m);
    const entry = g.log[g.log.length - 1];
    state.last = { f: m.from, t: m.to }; state.hint = null; clearSel();
    startAnim({ type: 'move', from: m.from, to: m.to, piece, cap: r.cap, flag: moveFlag(r.move), dur: 0.26 + (r.cap ? 0.05 : 0) }, () => {
      sound(r.cap ? 'take' : 'tok'); if (r.cap) burst(m.to);
      if (g.result) {
        if (g.result.why === 'checkmate') { state.banner = { text: 'Checkmate', t: 0 }; sound(g.result.winner === state.human || state.mode !== 'ai' ? 'win' : 'lose'); }
        else { state.banner = { text: g.result.why === 'stalemate' ? 'Stalemate' : 'Draw', t: 0 }; sound('ok'); }
      } else if (r.chk) { state.banner = { text: 'Check', t: 0 }; sound('check'); }
      if (then) then(r, entry);
    });
  };
  const refuse = (from, to, why) => {
    const p = state.g.st.board[from];
    if (why) say(why, 'warn');
    sound('refuse');
    if (to >= 0 && to !== from) startAnim({ type: 'refuse', from, to, piece: p, dur: 0.5 }, null);
  };

  // ---- starting a game ----------------------------------------------------------------------------
  const startGame = (human, mode) => {
    state.g = newGame(); state.human = human; state.mode = mode; state.scene = 'play'; state.hintsLeft = HINTS_PER_GAME;
    Object.assign(state, { last: null, msg: null, overOpen: false, hint: null, anim: null, thinking: false, banner: null, flipManual: mode === 'ai' ? false : state.flipManual });
    clearSel(); thinker = null; hinter = null; pending = null;
    if (!state.coach.seen) {
      state.coach.seen = true; storage.set('coach', state.coach);
      state.coachBubble = { text: 'TAP a piece then a lit square to move it - or DRAG it and let go. Castle by moving the king two squares toward a rook.', t: 0 };
    }
    afterMove(true);
  };
  const startThinking = () => { state.thinking = true; state.thinkT = 0; const played = state.g.log.map((e) => ({ from: moveFrom(e.m), to: moveTo(e.m) })); thinker = createThinker(state.g, state.level, rng, played); };
  const afterMove = (quiet) => {
    const g = state.g;
    if (g.result) { finishGame(); return; }
    if (!quiet && state.mode === 'ai' && inCheck(g.st) && g.st.turn === state.human) say('You are in check! Capture the attacker, block it, or move your king.', 'warn');
    if (state.mode === 'ai' && g.st.turn !== state.human) startThinking();
  };
  const finishGame = () => {
    state.overOpen = true; state.hint = null;
    if (state.mode === 'ai') {
      const r = state.g.result;
      state.progress.played++; if (r.winner === state.human) state.progress.wins++;
      storage.set('progress', { played: state.progress.played, wins: state.progress.wins });
      monetization.track('game_end', { level: state.level, why: r.why, won: r.winner === state.human });
    }
  };
  const takeBack = () => {
    const g = state.g; if (state.anim || g.log.length === 0 || state.thinking) return;
    thinker = null; state.thinking = false; state.hint = null; state.overOpen = false; clearSel();
    if (state.mode === 'two') undoMove(g);
    else { do { if (!undoMove(g)) break; } while (g.st.turn !== state.human && g.log.length); }
    const lg = g.log[g.log.length - 1]; state.last = lg ? { f: moveFrom(lg.m), t: moveTo(lg.m) } : null;
    say('Move taken back.', 'info'); sound('ok');
  };
  const hintReason = (g, m) => {
    const cap = g.st.board[m.to];
    if (cap) return `Captures the ${TYPE_NAME[Math.abs(cap)]}.`;
    const trial = { st: { ...g.st, board: g.st.board.slice() }, log: [], keyCounts: new Map(g.keyCounts), result: null };
    const r = tryMove(trial, m.from, m.to, m.promo || QUEEN);
    if (r.ok) { const after = applyMove(trial, r.move); if (after.chk) return 'Gives check.'; }
    const home = g.st.turn === WHITE ? 0 : 7;
    if ((m.from >> 3) === home) return 'Develops a piece off the back rank.';
    return 'Improves your position.';
  };
  const useHint = () => {
    if (state.hintsLeft <= 0 || busy() || !myTurn() || state.g.result || state.scene !== 'play') return;
    state.hintsLeft--; state.hint = null; hinter = createThinker(state.g, Math.min(6, state.level + 2), rng); say('Looking for a good move...', 'info');
  };
  const toMenu = () => {
    clearSel(); Object.assign(state, { scene: 'title', overOpen: false, thinking: false, anim: null, msg: null, hint: null, banner: null, promoPending: null });
    thinker = null; hinter = null; pending = null; state.mode = 'ai';
    state.g = newGame(); savePrefs();
  };

  // ---- lessons -------------------------------------------------------------------------------------
  const loadLessonStep = () => {
    const step = LESSONS[state.lesson.i].steps[state.lesson.s];
    state.g = loadStep(step); state.human = state.g.st.turn; state.mode = 'lesson';
    Object.assign(state.lesson, { done: false, showSol: false }); Object.assign(state, { last: null, msg: null, hint: null, anim: null, banner: null, miniWait: 0 });
    clearSel(); pending = null;
    if (step.minigame) miniRng = rngForMini();
  };
  function rngForMini() { return { next: () => rng.next(), int: (n) => rng.int(n), pick: (a) => rng.pick(a) }; }
  const startLesson = (i) => { state.scene = 'lesson'; state.lesson = { i, s: 0, done: false, showSol: false }; loadLessonStep(); };
  const stepDone = () => {
    state.lesson.done = true; sound('ok'); clearSel();
    const i = state.lesson.i;
    if (!state.learned.includes(i)) { state.learned.push(i); storage.set('learned', state.learned.slice()); }
  };
  const lessonAttempt = (from, to) => {
    const step = LESSONS[state.lesson.i].steps[state.lesson.s], want = step.want;
    if (step.minigame) { minigameAttempt(from, to); return; }
    const r = tryMove(state.g, from, to);
    if (want.refuse !== undefined) {
      if (from === want.refuse && !r.ok) { refuse(from, to, r.why); stepDone(); return; }
      if (r.ok) { refuse(from, to, 'That move is allowed. This step is about a move that is NOT allowed - try the square described above.'); return; }
      refuse(from, to, r.why); return;
    }
    if (!r.ok) { refuse(from, to, r.why); return; }
    if (r.move.needsPromoChoice) { state.promoPending = { from, to, forLesson: true }; return; }
    if (wantMatches(state.g, want, from, to)) { doMove(r.move, () => stepDone()); return; }
    refuse(from, to, 'That is a legal move, but this step asks for a different one. Tap the hint button to see it.');
  };
  const minigameAttempt = (from, to) => {
    const r = tryMove(state.g, from, to);
    if (!r.ok) { refuse(from, to, r.why); return; }
    if (r.move.needsPromoChoice) { state.promoPending = { from, to, forLesson: true }; return; }
    doMove(r.move, () => {
      if (state.g.result) { stepDone(); return; }
      state.miniWait = 0.5; // pause, then the practice opponent replies
    });
  };

  // ---- promotion -----------------------------------------------------------------------------------
  const choosePromo = (promo) => {
    const pend = state.promoPending; if (!pend) return;
    state.promoPending = null;
    const r = tryMove(state.g, pend.from, pend.to, promo);
    if (!r.ok) return;
    if (pend.forLesson) {
      const step = LESSONS[state.lesson.i].steps[state.lesson.s];
      if (step.minigame) { doMove(r.move, () => { if (state.g.result) stepDone(); else state.miniWait = 0.5; }); return; }
      if (wantMatches(state.g, step.want, pend.from, pend.to)) { doMove(r.move, () => stepDone()); return; }
      doMove(r.move, () => { }); return;
    }
    doMove(r.move, () => afterMove());
  };

  // ---- demo (watch two full games) ------------------------------------------------------------------
  const startDemo = () => {
    state.scene = 'demo'; state.demoIdx = 0; state.demoSpeed = 1;
    loadDemoGame();
  };
  function loadDemoGame() {
    const cfg = DEMO_GAMES[state.demoIdx];
    state.g = newGame(); state.mode = 'demo'; demoGameRng = demoRng(state.demoIdx);
    // demoWait here is only the brief settle pause before the FIRST think of a freshly-loaded
    // board (so the position doesn't start "thinking" the instant it appears); it is unrelated to
    // the per-move THINK/REVEAL teaching loop below, which owns all pacing between moves.
    Object.assign(state, { last: null, msg: null, hint: null, anim: null, banner: null, overOpen: false, demoWait: 0.6, demoPaused: false });
    clearSel(); thinker = null; pending = null;
    state.demoPhase = null; state.demoPendingMove = undefined; state.demoChosen = -1;
    say(cfg.name, 'info');
  }
  // Teaching loop for the AI-vs-AI demo: for every move, THINK (board static, viewer works out
  // their own guess) -> REVEAL_SOURCE (the piece about to move gets its own pulsing highlight,
  // nothing else shown yet — the viewer registers WHICH piece before being told where) -> REVEAL
  // (every legal destination for that piece is marked, and the actual chosen destination is marked
  // more prominently so the viewer can compare) -> MOVE (today's existing slide animation via
  // doMove, unchanged) -> loop. `demoSpeed` (the existing Speed x1/x2/x4 toggle) scales THINK and
  // both reveal stages down, same role it always had.
  const DEMO_SOURCE_SECS = 2;
  const DEMO_REVEAL_SECS = 2;
  function demoStep(dt) {
    if (state.demoPaused) return;
    const cfg = DEMO_GAMES[state.demoIdx];
    if (state.g.result) {
      state.demoWait -= dt;
      if (state.demoWait <= 0) {
        if (state.demoIdx < DEMO_GAMES.length - 1) { state.demoIdx++; loadDemoGame(); } else { state.demoIdx = 0; loadDemoGame(); }
      }
      return;
    }
    if (state.anim) return;
    if (state.demoWait > 0) { state.demoWait -= dt; return; }

    if (state.demoPhase === 'reveal') {
      state.demoTimer -= dt;
      if (state.demoTimer > 0) return;
      const mv = state.demoPendingMove;
      state.demoPhase = null; state.demoPendingMove = undefined; state.demoChosen = -1;
      clearSel();
      doMove(mv, () => {});
      return;
    }

    if (state.demoPhase === 'revealSource') {
      state.demoTimer -= dt;
      if (state.demoTimer > 0) return;
      // First stage is over (the viewer has seen which piece is about to move); now reveal every
      // legal destination for it plus the one actually chosen, same as before.
      const mv = state.demoPendingMove;
      state.targets = legalTargets(state.g.st, mv.from).map((m) => m.to);
      state.demoChosen = mv.to;
      state.demoPhase = 'reveal';
      state.demoTimer = DEMO_REVEAL_SECS / state.demoSpeed;
      return;
    }

    // THINK phase (also the default/initial phase: demoPhase starts null, so the very first call
    // here falls straight into it and starts the timer below).
    if (!thinker) {
      const level = cfg.levels[state.g.st.turn === WHITE ? 0 : 1];
      const played = state.g.log.map((e) => ({ from: moveFrom(e.m), to: moveTo(e.m) }));
      thinker = createThinker(state.g, level, demoGameRng, played);
      state.demoPhase = 'think';
      state.demoTimer = THINK_STEPS[state.demoThinkIdx] / state.demoSpeed;
    }
    const r = thinker.step();
    if (r.move !== undefined) state.demoPendingMove = r.move;
    state.demoTimer -= dt;
    if (state.demoTimer > 0) return;
    if (state.demoPendingMove === undefined) return; // viewer's think time is up but the engine (a
    // high level's deeper search) isn't ready yet — keep waiting rather than reveal nothing.
    const mv = state.demoPendingMove;
    thinker = null;
    if (!mv) { state.g.result = { winner: 0, why: 'no-move' }; state.demoPhase = null; return; }
    state.sel = mv.from;
    state.demoPhase = 'revealSource';
    state.demoTimer = DEMO_SOURCE_SECS / state.demoSpeed;
  }

  // ---- taps ------------------------------------------------------------------------------------------
  const ownPiece = (s) => { const p = state.g.st.board[s]; return p !== 0 && (p > 0) === (state.g.st.turn > 0); };
  const attempt = (from, to) => {
    if (state.scene === 'lesson') { if (!state.lesson.done) lessonAttempt(from, to); return; }
    const r = tryMove(state.g, from, to);
    if (!r.ok) { refuse(from, to, r.why); clearSel(); return; }
    if (r.move.needsPromoChoice) { state.promoPending = { from, to }; return; }
    state.msg = null; doMove(r.move, () => afterMove());
  };
  const select = (s) => {
    state.sel = s; state.hint = null; state.msg = null;
    const p = state.g.st.board[s];
    state.targets = state.scene === 'lesson' ? lessonTargets(state.g, LESSONS[state.lesson.i].steps[state.lesson.s], s) : legalTargets(state.g.st, s).map((m) => m.to);
    if (state.targets.length === 0 && state.scene !== 'lesson') say(`This ${TYPE_NAME[Math.abs(p)]} has no legal move right now.`, 'info');
    sound('ok');
  };
  const tapSquare = (s) => {
    if (busy()) return;
    if (state.scene === 'lesson' && state.lesson.done) return;
    if (state.g.result) return;
    if (!myTurn()) return;
    if (s < 0 || state.sel === s) { clearSel(); return; }
    if (state.sel >= 0 && state.targets.includes(s)) { attempt(state.sel, s); return; }
    if (ownPiece(s)) { select(s); return; }
    if (state.sel >= 0) { attempt(state.sel, s); return; }
    if (state.g.st.board[s]) say('That piece belongs to the opponent. Tap one of your own pieces.', 'info'); else clearSel();
  };
  const KEYMOVE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

  function boardPointer(p) {
    const d = state.drag;
    if (p.pressed && !busy()) {
      const s = squareAt(p.x, p.y, flip());
      state.kb = false;
      const hadSel = state.sel;
      tapSquare(s);
      if (s >= 0 && state.sel === s && myTurn() && !busy() && ownPiece(s)) {
        state.drag = { sq: s, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
      }
    }
    if (state.drag && p.down) { const dd = state.drag; dd.x = p.x; dd.y = p.y; if (!dd.moved && Math.hypot(p.x - dd.sx, p.y - dd.sy) > 14) { dd.moved = true; state.msg = null; } }
    if (p.released && d && state.drag === d) {
      state.drag = null;
      if (d.moved) { const s = squareAt(p.x, p.y, flip()); if (s >= 0 && s !== d.sq && !busy()) attempt(d.sq, s); }
    }
  }

  // ---- update -------------------------------------------------------------------------------------------
  function update(dt, input) {
    state.t += dt;
    const p = input.pointer, keys = input.keys;
    if (fontFix < 2 && state.t > (fontFix === 0 ? 0.8 : 2.6)) { fontFix++; invalidateArt(); invalidatePieces(); warmI = 0; }
    if (warmI < 12) { const type = 1 + (warmI % 6), white = warmI < 6; warmPiece(type, white, state.boardTheme, 34); warmI++; }
    for (let i = sfx.length - 1; i >= 0; i--) if (sfx[i].at <= state.t) { audio.tone(sfx[i].o); sfx.splice(i, 1); }
    if (state.msg) state.msg.t += dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t > 1.6) state.banner = null; }
    if (state.coachBubble) { state.coachBubble.t += dt; if (state.coachBubble.t > 6) state.coachBubble = null; }
    for (const q of state.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 380 * dt; }
    state.parts = state.parts.filter((q) => q.t < q.max);
    for (const r of state.rings) r.t += dt;
    state.rings = state.rings.filter((r) => r.t < 0.5);

    // Demo Pause must freeze an in-flight move slide too, not just the THINK/REVEAL timers inside
    // demoStep - this shared animation ticker runs for every scene, so it needs its own guard.
    if (state.anim && !(state.scene === 'demo' && state.demoPaused)) { state.anim.t += dt; if (state.anim.t >= state.anim.dur) { const f = pending; state.anim = null; pending = null; if (f) f(); } }

    if (state.scene === 'lesson' && state.miniWait > 0 && !state.anim) {
      state.miniWait -= dt;
      if (state.miniWait <= 0) {
        if (!miniRng) miniRng = rngForMini();
        const mv = miniGameReply(state.g, miniRng);
        if (mv) doMove(mv, () => { if (state.g.result) stepDone(); });
      }
    }
    if (state.scene === 'demo') demoStep(dt);

    if (state.thinking && !state.anim && thinker) {
      state.thinkT += dt;
      const r = thinker.step();
      if (r.move !== undefined && state.thinkT >= 0.45) { const mv = r.move; thinker = null; state.thinking = false; if (mv) doMove(mv, () => afterMove()); }
    }
    if (hinter) { const r = hinter.step(); if (r.move !== undefined) { state.hint = r.move ? { from: r.move.from, to: r.move.to, reason: hintReason(state.g, r.move) } : null; hinter = null; say(state.hint ? 'A good move is marked in gold.' : 'No move found.', 'info'); } }

    if (keys.pressed.size) {
      const k = [...keys.pressed];
      if (state.scene === 'title') { if (k.includes('Enter') || k.includes('Space')) startGame(WHITE, 'ai'); }
      else if (boardScene()) {
        state.kb = true;
        for (const c of k) {
          if (KEYMOVE[c]) { const [dx, dy] = KEYMOVE[c], f = flip() ? -1 : 1; const file = Math.max(0, Math.min(7, (state.cursor & 7) + dx * f)), rank = Math.max(0, Math.min(7, (state.cursor >> 3) + dy * f)); state.cursor = rank * 8 + file; }
          else if (c === 'Space' || c === 'Enter') { if (state.scene === 'play' && state.g.result && state.overOpen) startGame(state.human, state.mode); else tapSquare(state.cursor); }
          else if (c === 'Escape') { if (state.sel >= 0) clearSel(); else toMenu(); }
          else if (c === 'KeyU' && state.scene === 'play') takeBack();
          else if (c === 'KeyH' && state.scene === 'play') useHint();
        }
      } else if (keys.pressed.has('Escape')) state.scene = 'title';
    }

    const hit = (r) => p.pressed && inRect(r, p.x, p.y);
    if (state.promoPending) {
      if (p.pressed) {
        const idx = PROMO.pieces.findIndex((r) => inRect(r, p.x, p.y));
        if (idx >= 0) choosePromo([QUEEN, ROOK, BISHOP, KNIGHT][idx]);
      }
      return;
    }
    switch (state.scene) {
      case 'title': {
        if (!p.pressed) break;
        const rows = titleRows(false);
        if (hit(rows.playWhite)) startGame(WHITE, 'ai');
        else if (hit(rows.playBlack)) startGame(BLACK, 'ai');
        else if (hit(rows.twoPlayer)) startGame(WHITE, 'two');
        else if (hit(rows.watch)) startDemo();
        else if (hit(rows.learn)) { const open = LESSONS.map((_, i) => i).filter((i) => !state.learned.includes(i)); startLesson(open.length ? open[0] : 0); }
        else if (hit(rows.howto)) { state.scene = 'howto'; state.page = 0; }
        else if (hit(rows.about)) { state.scene = 'about'; state.page = 0; }
        else if (hit(rows.rules)) { state.scene = 'rules'; state.page = 0; }
        else if (hit(rows.level)) { state.level = (state.level % LEVEL_COUNT) + 1; savePrefs(); }
        else if (hit(rows.theme)) { state.boardTheme = BOARD_THEMES[(BOARD_THEMES.indexOf(state.boardTheme) + 1) % BOARD_THEMES.length]; warmI = 0; savePrefs(); }
        else if (hit(HEADER.sound)) { state.sound = !state.sound; audio.setMuted(!state.sound); savePrefs(); }
        break;
      }
      case 'howto': case 'about': case 'rules': {
        const list = state.scene === 'howto' ? HOWTO : state.scene === 'about' ? ABOUT : RULES;
        if (hit(REF_BACK)) { state.scene = 'title'; state.page = 0; }
        else if (hit(REF_NEXT)) state.page = (state.page + 1) % list.length;
        else if (hit(TEXT_DEC) && state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); sound('ok'); }
        else if (hit(TEXT_INC) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); sound('ok'); }
        break;
      }
      case 'demo': {
        if (hit(HEADER.back)) { thinker = null; state.scene = 'title'; clearSel(); state.demoPhase = null; state.demoPendingMove = undefined; state.demoChosen = -1; state.demoPaused = false; }
        else if (hit(HEADER.next)) { state.demoSpeed = state.demoSpeed >= 4 ? 1 : state.demoSpeed * 2; }
        else if (hit(DEMO_PAUSE)) { state.demoPaused = !state.demoPaused; sound('ok'); }
        else if (hit(DEMO_THINK.dec)) { if (state.demoThinkIdx > 0) { state.demoThinkIdx--; savePrefs(); sound('ok'); } }
        else if (hit(DEMO_THINK.inc)) { if (state.demoThinkIdx < THINK_STEPS.length - 1) { state.demoThinkIdx++; savePrefs(); sound('ok'); } }
        break;
      }
      case 'lesson': {
        const L = state.lesson, l = LESSONS[L.i];
        if (hit(BTN4.menu)) { toMenu(); break; }
        if (hit(BTN4.flip)) { state.flipManual = !state.flipManual; break; }
        if (hit(BTN4.hint) && !L.done) { L.showSol = true; say(l.steps[L.s].hint, 'good'); break; }
        if (hit(BTN4.next)) {
          if (!L.done) loadLessonStep();
          else if (L.s + 1 < l.steps.length) { L.s++; loadLessonStep(); }
          else if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
          else toMenu();
          break;
        }
        boardPointer(p);
        break;
      }
      case 'play': {
        const g = state.g;
        if (state.overOpen) {
          if (hit(RESULT_PANEL.again)) startGame(state.human, state.mode);
          else if (hit(RESULT_PANEL.menu)) toMenu();
          break;
        }
        if (hit(BTN.menu)) { toMenu(); break; }
        if (hit(BTN.flip)) { state.flipManual = !state.flipManual; break; }
        if (hit(BTN.undo)) { takeBack(); break; }
        if (hit(BTN.hint)) { useHint(); break; }
        if (hit(BTN.resign)) {
          if (g.result) { startGame(state.human, state.mode); break; }
          if (state.mode === 'ai') { g.result = { winner: -state.human, why: 'resign' }; finishGame(); sound('lose'); }
          break;
        }
        boardPointer(p);
        break;
      }
      default: break;
    }
  }

  return {
    update,
    render(ctx) { render(ctx, state); },
    getState() {
      const { g, ...rest } = state;
      return { ...rest, g: { board: g.st.board.slice(), turn: g.st.turn, moves: g.log.length, result: g.result } };
    },
  };
}
