// Janggi (Korean chess): state and flow. Drawing is view.js; the rule book is rules.js; the computer is engine.js; the tutor's
// plain-language help is tutor.js; lessons.js and content.js are content. The only file that mutates `state`.
//
// How a move is made: TAP a piece (it lifts, its legal points glow), then TAP a glowing point; or DRAG the piece and drop it.
// A legal move glides there. An illegal one visibly TRIES, shudders and comes back, and a message says why.
import { TEXT_SCALES, layoutFor, lockHit, inRect, squareAt, pointXY, THINK_STEPS, REVEAL_SECONDS } from './layout.js';
import { newGame, fromBoard, applyMove, undoMove, tryMove, legalFor, inCheck, describe, canPass, callBikjang, LAYOUTS, CHO, HAN, SIDE_NAME, TYPE_NAME } from './rules.js';
import { LEVEL_COUNT, createThinker } from './engine.js';
import { LESSONS, stepBoard, sq } from './lessons.js';
import { pieceTip, riskyTargets, threatText, explainMove, hangingNote, dangerNote } from './tutor.js';
import { invalidateArt } from './art.js';
import { invalidatePieces, warmPiece } from './pieces.js';
import { render, readerMetrics } from './view.js';

// Fluid (kit 1.7+): the short side is always 720 units; the kit keeps meta.width/height live and every position comes from layoutFor().
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
// The mouse wheel scrolls the reader pages (main.js adds to it, in virtual units).
export const wheelInput = { dy: 0 };
const DEMO_GAMES = 2, DEMO_LESSONS = 4, HINTS_PER_GAME = 3;

export function createGame(env) {
  const { rng, storage, audio, config, monetization } = env;
  const state = {
    scene: 'title', t: 0,
    g: newGame(), human: CHO, two: false, level: 3, sound: true, calm: false, big: false, board: 'hanji', set: 'boxwood', lang: 'ko', tutor: true,
    scroll: 0, textScaleIdx: 0, // index into TEXT_SCALES; the How to play/About/Rules reference pages' text size
    setup: { cho: 'inner', han: 'inner', step: 0, mode: 'vs', human: CHO, hanKnown: false, choKnown: false },
    sel: -1, targets: [], risks: new Map(), drag: null, cursor: 85, kb: false, anim: null, parts: [], rings: [], banner: null, msg: null,
    thinking: false, thinkT: 0, land: null, hint: null, hintsLeft: HINTS_PER_GAME, last: null, overOpen: false,
    lesson: { i: 0, s: 0, done: false, showSol: false },
    progress: { played: 0, wins: 0 }, learned: [], learnedAll: false,
    saved: false, demoGames: 0,
    // Auto Play ("Watch & Learn"): a free, silent, whole-game THINK -> REVEAL -> ACT demo that drives BOTH sides with the
    // real createThinker() at the currently-set computer level. Never touches progress/save/demoGames. Pause freezes it all.
    autoPlay: false, paused: false, autoThinkIdx: 1, autoPhase: 'think', autoPhaseT: 0, autoMove: null,
  };
  let thinker = null, hinter = null, pending = null, savedBlob = null, warmI = 0, fontFix = 0;
  const sfx = [];
  const lay = () => layoutFor(meta.width, meta.height);
  const boardKind = () => (state.scene === 'lesson' ? 'lesson' : state.scene === 'autoplay' ? 'auto' : 'play');
  let sdrag = null;
  const applyTextScale = () => { try { config.textScale = TEXT_SCALES[state.textScaleIdx] ?? 1; } catch { /* config may be frozen */ } };

  // ---- storage ------------------------------------------------------------------------------------------------------
  const savePrefs = () => { storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, big: state.big, board: state.board, set: state.set, lang: state.lang, tutor: state.tutor, textScaleIdx: state.textScaleIdx, autoThinkIdx: state.autoThinkIdx }); };
  storage.get('prefs', null).then((p) => {
    if (!p) return;
    Object.assign(state, { level: Math.min(Math.max(p.level | 0 || 3, 1), LEVEL_COUNT), sound: p.sound ?? true, calm: !!p.calm, big: !!p.big, board: p.board === 'night' ? 'night' : 'hanji', set: p.set === 'ebony' ? 'ebony' : 'boxwood', lang: p.lang === 'en' ? 'en' : 'ko', tutor: p.tutor !== false, textScaleIdx: Math.min(Math.max(Number(p.textScaleIdx) || 0, 0), TEXT_SCALES.length - 1), autoThinkIdx: Math.min(Math.max(Number(p.autoThinkIdx ?? 1) || 0, 0), THINK_STEPS.length - 1) });
    audio.setMuted(!state.sound); applyTextScale();
  });
  storage.get('progress', null).then((p) => { if (p) state.progress = { played: p.played | 0, wins: p.wins | 0 }; });
  storage.get('learned', []).then((l) => { state.learned = Array.isArray(l) ? l : []; state.learnedAll = state.learned.length >= LESSONS.length; });
  storage.get('demoGames', 0).then((n) => { state.demoGames = n | 0; });
  storage.get('save', null).then((s) => { if (s && s.g && s.g.log && s.g.log.length && !s.g.result) { savedBlob = s; state.saved = true; } });
  const saveGame = () => {
    if (state.scene !== 'play' || state.g.result || state.two) return;
    savedBlob = { g: state.g, human: state.human, level: state.level, hintsLeft: state.hintsLeft };
    storage.set('save', JSON.parse(JSON.stringify(savedBlob))); state.saved = true;
  };
  const clearSave = () => { storage.remove('save'); state.saved = false; savedBlob = null; };

  // ---- small helpers -------------------------------------------------------------------------------------------------
  const say = (text, kind = 'info') => { state.msg = { text, kind, t: 0 }; };
  const sound = (name) => {
    // Auto Play is silent by design: it plays itself with no player driving it, so any tone would just be noise.
    if (!state.sound || state.scene === 'autoplay') return;
    if (name === 'tok') audio.tone({ freq: 250, to: 120, dur: 0.07, type: 'triangle', vol: 0.3 });
    else if (name === 'take') { audio.tone({ freq: 200, to: 90, dur: 0.1, type: 'triangle', vol: 0.36 }); sfx.push({ at: state.t + 0.06, o: { freq: 520, to: 300, dur: 0.12, type: 'square', vol: 0.06 } }); }
    else if (name === 'refuse') audio.tone({ freq: 150, to: 110, dur: 0.14, type: 'sine', vol: 0.22 });
    else if (name === 'check') { audio.tone({ freq: 660, dur: 0.14, type: 'sine', vol: 0.18 }); sfx.push({ at: state.t + 0.13, o: { freq: 880, dur: 0.22, type: 'sine', vol: 0.18 } }); }
    else if (name === 'bik') { audio.tone({ freq: 392, dur: 0.16, type: 'sine', vol: 0.2 }); sfx.push({ at: state.t + 0.15, o: { freq: 392, dur: 0.16, type: 'sine', vol: 0.2 } }); sfx.push({ at: state.t + 0.3, o: { freq: 523, dur: 0.3, type: 'sine', vol: 0.22 } }); }
    else if (name === 'pass') audio.tone({ freq: 330, to: 262, dur: 0.18, type: 'sine', vol: 0.16 });
    else if (name === 'win') [523, 659, 784, 1046].forEach((f, k) => sfx.push({ at: state.t + k * 0.13, o: { freq: f, dur: 0.3, type: 'sine', vol: 0.2 } }));
    else if (name === 'lose') [392, 330, 262].forEach((f, k) => sfx.push({ at: state.t + k * 0.17, o: { freq: f, dur: 0.32, type: 'triangle', vol: 0.2 } }));
    else if (name === 'ok') audio.tone({ freq: 700, to: 900, dur: 0.09, type: 'sine', vol: 0.14 });
  };
  const flip = () => state.scene === 'play' && state.human === HAN && !state.two;
  const pxy = (s) => pointXY(s, flip());
  const clearSel = () => { state.sel = -1; state.targets = []; state.risks = new Map(); state.drag = null; };
  const busy = () => !!state.anim || state.thinking;
  const myTurn = () => { const g = state.g; if (g.result) return false; if (state.scene === 'play') return state.two || g.turn === state.human; return g.turn === CHO; };

  // ---- animation ------------------------------------------------------------------------------------------------------
  const startAnim = (o, next) => { state.anim = { t: 0, ...o, dur: (o.dur ?? 0.3) * (state.calm ? 0.6 : 1) }; pending = next ?? null; };
  const burst = (s) => {
    const p = pxy(s); state.rings.push({ x: p.x, y: p.y, t: 0 });
    if (!state.calm) for (let k = 0; k < 14; k++) { const a = rng.range(0, Math.PI * 2), v = rng.range(60, 230); state.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, max: rng.range(0.35, 0.7), size: rng.range(2.5, 6), c: k % 3 === 0 ? '255,90,60' : '255,214,120' }); }
  };
  // Play a legal move (or a pass) on the board with its animation; `then` runs when it lands.
  const doMove = (m, then) => {
    const g = state.g, p = m.pass ? 0 : g.board[m.from], cap = m.pass ? 0 : g.board[m.to];
    const r = applyMove(g, m);
    state.hint = null; clearSel();
    if (!m.pass) state.last = { f: m.from, t: m.to };
    startAnim(m.pass ? { type: 'pass', dur: 0.45 } : { type: 'move', from: m.from, to: m.to, p, cap, dur: 0.3 + (cap ? 0.06 : 0) }, () => {
      if (m.pass) sound('pass'); else { sound(cap ? 'take' : 'tok'); if (cap) burst(m.to); state.land = { sq: m.to, t: 0 }; }
      if (g.result) { if (g.result.why === 'checkmate') { state.banner = { text: 'Checkmate', t: 0 }; sound('check'); } }
      else if (r.chk) { state.banner = { text: 'Check!', t: 0 }; sound('check'); }
      else if (g.bik) { state.banner = { text: 'Bikjang!', t: 0 }; sound('bik'); }
      else if (m.pass) { state.banner = { text: 'Pass', t: 0 }; }
      if (then) then(r);
    });
  };
  const refuse = (from, to, why) => {
    const p = state.g.board[from];
    if (why) say(why, 'warn');
    sound('refuse');
    if (to >= 0 && to !== from) startAnim({ type: 'refuse', from, to, p, dur: 0.55 }, null);
  };

  // ---- starting things -------------------------------------------------------------------------------------------------
  const aiLayout = () => rng.pick(LAYOUTS);
  // The set-up screen. vs the computer: the human picks their own set-up (Cho first; Han sees Cho's choice). Two players: Cho, then Han.
  const openSetup = (human, two) => {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    const S = { cho: 'inner', han: 'inner', step: 0, mode: two ? 'two' : 'vs', human, hanKnown: false, choKnown: false };
    if (!two && human === HAN) { S.cho = aiLayout(); S.choKnown = true; }
    state.setup = S; state.human = human; state.two = two; state.scene = 'setup'; sound('ok');
  };
  const setupSide = () => (state.setup.mode === 'two' ? (state.setup.step === 0 ? CHO : HAN) : state.setup.human);
  const setupPick = (i) => {
    const S = state.setup, choice = LAYOUTS[i];
    if (setupSide() === CHO) { S.cho = choice; S.choKnown = true; } else { S.han = choice; S.hanKnown = true; }
    sound('ok');
  };
  const setupGo = () => {
    const S = state.setup;
    if (S.mode === 'two' && S.step === 0) { S.step = 1; S.choKnown = true; sound('ok'); return; }
    if (S.mode === 'vs' && S.human === CHO) S.han = aiLayout();
    S.hanKnown = true; S.choKnown = true;
    startGame(S.human, S.mode === 'two', S.cho, S.han);
  };
  const startGame = (human, two, layoutCho, layoutHan) => {
    if (config.demo) { if (state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; } state.demoGames++; storage.set('demoGames', state.demoGames); }
    state.g = newGame(layoutCho ?? 'inner', layoutHan ?? 'inner'); state.human = human; state.two = two; state.scene = 'play'; state.hintsLeft = HINTS_PER_GAME;
    Object.assign(state, { last: null, msg: null, overOpen: false, hint: null, anim: null, thinking: false, banner: null }); clearSel(); thinker = null; hinter = null; pending = null;
    if (!two) clearSave();
    if (state.tutor && !two) say(`You are ${SIDE_NAME[human]}${human === CHO ? ' and move first' : ''}. Tap a piece to see how it moves. The tutor will warn you about dangers.`, 'good');
    afterMove(true);
  };
  const playAgain = () => { openSetup(state.human, state.two); };
  const resume = () => {
    if (!savedBlob) return;
    const b = JSON.parse(JSON.stringify(savedBlob));
    Object.assign(state, { g: b.g, human: b.human, level: b.level ?? state.level, hintsLeft: b.hintsLeft ?? 0, two: false, scene: 'play', last: null, msg: null, overOpen: false, hint: null, anim: null, thinking: false });
    const lg = state.g.log[state.g.log.length - 1]; if (lg && !lg.pass) state.last = { f: lg.f, t: lg.t };
    clearSel(); thinker = null; afterMove(true);
  };
  const startThinking = () => { state.thinking = true; state.thinkT = 0; thinker = createThinker(state.g, state.level, rng); };
  const afterMove = (quiet) => {
    const g = state.g;
    if (g.result) { finishGame(); return; }
    if (!quiet && !state.two && g.turn === state.human) {
      if (inCheck(g)) say('You are in check! Capture the attacker, block it, or move your general.', 'warn');
      else if (g.bik) say('Bikjang: the generals face each other. Break it (block, capture or move the general), or tap Call bikjang for a draw.', 'warn');
    }
    if (!state.two && g.turn !== state.human) startThinking();
    saveGame();
  };
  const finishGame = () => {
    const r = state.g.result;
    state.overOpen = true; clearSave(); state.hint = null;
    if (!state.two && state.scene === 'play') {
      state.progress.played++; if (r.winner === state.human) state.progress.wins++;
      storage.set('progress', { played: state.progress.played, wins: state.progress.wins });
      monetization.track('game_end', { level: state.level, won: r.winner === state.human });
    }
    sound(r.winner === 0 ? 'ok' : (state.two || r.winner === state.human) ? 'win' : 'lose');
  };

  // ---- Auto Play ("Watch & Learn") -----------------------------------------------------------------------------------
  // THINK -> REVEAL -> ACT per move, for the whole game, both sides driven by the real createThinker() at the currently-set
  // computer level. THINK reuses the same state.thinking/thinker/state.thinkT machinery real play uses for the computer's turn;
  // ACT reuses doMove() itself: never a separate, fake execution path. PAUSE freezes every timer, the search and any
  // in-flight animation (see update(): the whole simulation block is skipped while paused) and resumes exactly where it stopped.
  const startAutoplay = () => {
    state.autoPlay = true; state.paused = false; state.g = newGame(aiLayout(), aiLayout()); state.human = CHO; state.two = false; state.scene = 'autoplay';
    Object.assign(state, { last: null, msg: null, overOpen: false, hint: null, anim: null, thinking: false, banner: null, autoMove: null, autoPhase: 'think', autoPhaseT: 0 });
    clearSel(); thinker = null; hinter = null; pending = null;
    startThinking();
  };
  const exitAutoplay = () => { state.autoPlay = false; state.paused = false; thinker = null; pending = null; state.autoMove = null; toMenu(); };
  const afterAutoMove = () => {
    if (state.g.result) { finishAutoplay(); return; }
    startThinking();
  };
  const finishAutoplay = () => {
    // Deliberately NOT finishGame(): Auto Play never writes progress/save/demoGames/analytics - it is a free teaching demo.
    const r = state.g.result;
    state.overOpen = true; state.hint = null; state.autoMove = null; clearSel();
    sound(r.winner === 0 ? 'ok' : 'win');
  };
  const takeBack = () => {
    const g = state.g; if (state.anim || g.log.length === 0) return;
    thinker = null; state.thinking = false; state.hint = null; state.overOpen = false; clearSel();
    if (state.two) undoMove(g);
    else { do { if (!undoMove(g)) break; } while (g.turn !== state.human && g.log.length); }
    const lg = g.log[g.log.length - 1]; state.last = lg && !lg.pass ? { f: lg.f, t: lg.t } : null;
    say('Move taken back.', 'info'); sound('ok');
    if (!state.two && g.turn !== state.human) startThinking();
    saveGame();
  };
  const useHint = () => {
    if (state.hintsLeft <= 0 || busy() || !myTurn() || state.g.result) return;
    state.hintsLeft--; state.hint = null; hinter = createThinker(state.g, 4, rng); say('Thinking...', 'info');
  };
  const doPass = () => {
    const g = state.g;
    if (g.result || busy() || !myTurn()) return;
    if (g.bik) { // the button reads "Call bikjang" while the generals face each other: a draw
      if (callBikjang(g)) { sound('bik'); state.banner = { text: 'Bikjang called', t: 0 }; finishGame(); }
      return;
    }
    if (!canPass(g)) { say(inCheck(g) ? 'You cannot pass while your general is in check.' : 'Too early to end the game: a second pass in a row is only allowed later in the game.', 'warn'); sound('refuse'); return; }
    state.msg = null; doMove({ pass: true }, () => afterMove());
  };
  const toMenu = () => {
    if (state.scene === 'play') saveGame();
    clearSel(); Object.assign(state, { scene: 'title', overOpen: false, thinking: false, anim: null, msg: null, hint: null, banner: null }); thinker = null; hinter = null; pending = null; state.two = false;
    state.g = newGame(); savePrefs();
  };

  // ---- lessons -----------------------------------------------------------------------------------------------------------
  function stepDone(quiet) {
    state.lesson.done = true; if (!quiet) sound('ok'); clearSel();
    const l = LESSONS[state.lesson.i];
    if (state.lesson.s === l.steps.length - 1 && !state.learned.includes(state.lesson.i)) { state.learned.push(state.lesson.i); storage.set('learned', state.learned.slice()); state.learnedAll = state.learned.length >= LESSONS.length; }
  }
  const loadStep = () => {
    const st = LESSONS[state.lesson.i].steps[state.lesson.s];
    state.g = fromBoard(stepBoard(st), CHO); state.human = CHO; state.two = true;
    Object.assign(state.lesson, { done: false, showSol: false }); Object.assign(state, { last: null, msg: null, hint: null, anim: null, banner: null }); clearSel(); pending = null;
    if (st.want.read) stepDone(true);
  };
  const startLesson = (i) => {
    if (config.demo && i >= DEMO_LESSONS) { state.scene = 'demo-limit'; return; }
    state.scene = 'lesson'; state.lesson = { i, s: 0, done: false, showSol: false }; loadStep();
  };
  const wantMatches = (want, from, to) => {
    if (want.refuse || want.pass || want.read) return false;
    if (want.from && from !== sq(want.from)) return false;
    if (want.to) return want.to.some((p) => sq(p) === to);
    if (want.any) return true;
    const c = JSON.parse(JSON.stringify(state.g)); applyMove(c, { from, to });
    if (want.mate) return !!c.result && c.result.why === 'checkmate';
    if (want.check) return inCheck(c, HAN);
    return !!want.escape;
  };
  const lessonAttempt = (from, to) => {
    const st = LESSONS[state.lesson.i].steps[state.lesson.s], want = st.want, r = tryMove(state.g, from, to);
    if (want.refuse) {
      if (from === sq(want.refuse) && !r.ok) { refuse(from, to, r.why); stepDone(); return; }
      if (r.ok) { refuse(from, to, 'That move is allowed. This step is about a move that is NOT allowed: pick the piece and try the point described above.'); return; }
      refuse(from, to, r.why); return;
    }
    if (!r.ok) { refuse(from, to, r.why); return; }
    if (wantMatches(want, from, to)) { doMove(r.move, () => stepDone()); return; }
    refuse(from, to, want.pass ? 'This step is about passing: tap the Pass button.' : 'That is a legal move, but this step asks for a different one. Tap Hint to see it.');
  };
  const lessonTargets = (from) => {
    const w = LESSONS[state.lesson.i].steps[state.lesson.s].want, all = legalFor(state.g, from);
    if (w.refuse || w.pass || w.read) return [];
    if (w.from && from !== sq(w.from)) return [];
    if (w.to) return all.filter((t) => w.to.some((p) => sq(p) === t));
    if (w.any) return all;
    return all.filter((t) => wantMatches(w, from, t));
  };

  // ---- taps -------------------------------------------------------------------------------------------------------------------
  const ownPiece = (s) => { const p = state.g.board[s]; return p !== 0 && (p > 0) === (state.g.turn > 0); };
  const attempt = (from, to) => {
    if (state.scene === 'lesson') { if (!state.lesson.done) lessonAttempt(from, to); return; }
    const r = tryMove(state.g, from, to);
    if (!r.ok) { refuse(from, to, r.why); clearSel(); return; }
    state.msg = null;
    doMove(r.move, () => {
      if (state.tutor && !state.two && !state.g.result) { const n = hangingNote(state.g); if (n) say(n, 'warn'); }
      afterMove();
    });
  };
  const select = (s) => {
    state.sel = s; state.hint = null; state.msg = null;
    state.targets = state.scene === 'lesson' ? lessonTargets(s) : legalFor(state.g, s);
    state.risks = new Map();
    if (state.tutor && state.scene === 'play' && state.targets.length) state.risks = riskyTargets(state.g, s, state.targets);
    const type = Math.abs(state.g.board[s]);
    if (state.targets.length === 0 && state.scene !== 'lesson') say(`This ${TYPE_NAME[type]} has no legal move right now.${state.tutor ? ' ' + pieceTip(type) : ''}`, 'info');
    else if (state.tutor && state.scene === 'play') {
      const rk = [...state.risks.values()][0];
      say(pieceTip(type) + (state.risks.size ? ` Amber rings: it could be lost there. ${threatText(rk)}` : ''), 'info');
    }
    sound('ok');
  };
  const tapSquare = (s) => {
    if (state.anim || state.thinking) return;
    if (state.scene === 'lesson' && state.lesson.done) return;
    if (state.g.result) return;
    if (!myTurn()) return;
    if (s < 0 || state.sel === s) { clearSel(); return; }
    if (state.sel >= 0 && state.targets.includes(s)) { attempt(state.sel, s); return; }
    if (ownPiece(s)) { select(s); return; }
    if (state.sel >= 0) { attempt(state.sel, s); return; }
    if (state.g.board[s]) say('That piece belongs to the opponent. Tap one of your own pieces.', 'info'); else clearSel();
  };
  const KEYMOVE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const boardScene = () => state.scene === 'play' || state.scene === 'lesson';

  function boardPointer(p0) {
    // Pointer in screen units -> canonical board space (the board is drawn under a scale + offset, see layout.js).
    const BL = lay().board(boardKind());
    const p = { ...p0, x: (p0.x - BL.ox) / BL.s, y: (p0.y - BL.oy) / BL.s };
    const d = state.drag;
    if (p.pressed && !state.anim) {
      const s = squareAt(p.x, p.y, flip());
      state.kb = false;
      tapSquare(s);
      if (s >= 0 && state.sel === s && myTurn() && !state.thinking && !state.anim) state.drag = { sq: s, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
    }
    if (state.drag && p.down) { const dd = state.drag; dd.x = p.x; dd.y = p.y; if (!dd.moved && Math.hypot(p.x - dd.sx, p.y - dd.sy) > 16) { dd.moved = true; state.msg = null; } }
    if (p.released && d && state.drag === d) {
      state.drag = null;
      if (d.moved) { const s = squareAt(p.x, p.y - 46, flip()); if (s >= 0 && s !== d.sq && !state.anim) attempt(d.sq, s); }
    }
  }

  // ---- update -------------------------------------------------------------------------------------------------------------------
  function update(dt, input) {
    state.t += dt; if (state.lockPress > 0) state.lockPress = Math.max(0, state.lockPress - dt);
    const p = input.pointer, keys = input.keys;
    // fonts may arrive late: repaint the cached art twice, early
    if (fontFix < 2 && state.t > (fontFix === 0 ? 0.8 : 2.6)) { fontFix++; invalidateArt(); invalidatePieces(); warmI = 0; }
    if (warmI < 14) { warmPiece((warmI < 7 ? 1 : -1) * (1 + (warmI % 7)), 32, state.set, state.lang); warmI++; }
    const frozen = state.scene === 'autoplay' && state.paused;       // PAUSE: nothing below advances (timers, search, animation, particles)
    if (!frozen) {
      if (state.land) { state.land.t += dt; if (state.land.t > 0.3) state.land = null; }
      for (let i = sfx.length - 1; i >= 0; i--) if (sfx[i].at <= state.t) { audio.tone(sfx[i].o); sfx.splice(i, 1); }
      if (state.msg) state.msg.t += dt;
      if (state.banner) { state.banner.t += dt; if (state.banner.t > 1.5) state.banner = null; }
      for (const q of state.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 420 * dt; }
      state.parts = state.parts.filter((q) => q.t < q.max);
      for (const r of state.rings) r.t += dt;
      state.rings = state.rings.filter((r) => r.t < 0.5);

      if (state.anim) { state.anim.t += dt; if (state.anim.t >= state.anim.dur) { const f = pending; state.anim = null; pending = null; if (f) f(); } }
      // the computer thinks a little every frame and never blocks one
      if (state.thinking && !state.anim && thinker) {
        state.thinkT += dt;
        const r = thinker.step();
        const auto = state.scene === 'autoplay';
        const threshold = auto ? THINK_STEPS[state.autoThinkIdx] : (state.calm ? 0.35 : 0.6);
        if (r.move !== undefined && state.thinkT >= threshold) {
          const mv = r.move; thinker = null; state.thinking = false;
          if (auto) {
            // THINK is over: REVEAL the chosen move before acting on it. state.sel/state.targets show every legal destination
            // for the piece about to move; state.hint marks the one actually about to be taken, distinctly from the rest.
            if (mv && mv.pass) { state.autoMove = mv; state.hint = null; state.autoPhase = 'reveal'; state.autoPhaseT = 0; }
            else if (mv) { state.autoMove = mv; state.sel = mv.from; state.targets = legalFor(state.g, mv.from); state.hint = { from: mv.from, to: mv.to }; state.autoPhase = 'reveal'; state.autoPhaseT = 0; }
            else finishAutoplay();
          } else if (mv) doMove(mv, () => { if (state.tutor && !state.two && !state.g.result) { if (mv.pass) say('The computer passed.', 'info'); else { const n = dangerNote(state.g, state.human); if (n && !inCheck(state.g)) say(n, 'warn'); } } afterMove(); });
        }
      }
      if (state.scene === 'autoplay' && state.autoPhase === 'reveal' && !state.anim && state.autoMove) {
        state.autoPhaseT += dt;
        if (state.autoPhaseT >= REVEAL_SECONDS) { const mv = state.autoMove; state.autoMove = null; state.autoPhase = 'think'; state.autoPhaseT = 0; doMove(mv, () => afterAutoMove()); }
      }
      if (hinter) {
        const r = hinter.step();
        if (r.move !== undefined) {
          const sc = hinter.score;
          hinter = null;
          if (r.move) { state.hint = r.move.pass ? { pass: true, from: -1, to: -1 } : { from: r.move.from, to: r.move.to }; say(explainMove(state.g, r.move, sc), 'good'); }
          else { state.hint = null; say('No move found.', 'info'); }
        }
      }
    }

    if (state.scene === 'demo-limit') { if (p.pressed && inRect(lay().demo().back, p.x, p.y)) state.scene = 'title'; return; }

    if (keys.pressed.size) {
      const k = [...keys.pressed];
      if (state.scene === 'title') { if (k.includes('Enter') || k.includes('Space')) openSetup(CHO, false); }
      else if (state.scene === 'setup') { if (k.includes('Escape')) state.scene = 'title'; else if (k.includes('Enter')) setupGo(); }
      else if (state.scene === 'autoplay') { if (k.includes('Escape')) exitAutoplay(); else if (k.includes('Space')) state.paused = !state.paused; }
      else if (boardScene()) {
        state.kb = true;
        for (const c of k) {
          if (KEYMOVE[c]) { const [dx, dy] = KEYMOVE[c], f = flip() ? -1 : 1; const x = Math.max(0, Math.min(8, (state.cursor % 9) + dx * f)), y = Math.max(0, Math.min(9, ((state.cursor / 9) | 0) + dy * f)); state.cursor = y * 9 + x; }
          else if (c === 'Space' || c === 'Enter') { if (state.scene === 'play' && state.g.result && state.overOpen) playAgain(); else tapSquare(state.cursor); }
          else if (c === 'Escape') toMenu();
          else if (c === 'KeyU' && state.scene === 'play') takeBack();
          else if (c === 'KeyH' && state.scene === 'play') useHint();
          else if (c === 'KeyP' && state.scene === 'play') doPass();
        }
      } else if (keys.pressed.has('Escape')) state.scene = 'title';
    }

    const hit = (r) => p.pressed && inRect(r, p.x, p.y);
    switch (state.scene) {
      case 'title': {
        if (!p.pressed) break;
        const rows = lay().title(state.saved);
        if (hit(lockHit(lay(), rows))) { state.lockPress = 0.18; env.openArcforgeHome?.(); break; }
        if (state.saved && hit(rows.resume)) resume();
        else if (hit(rows.langKo)) { state.lang = 'ko'; warmI = 0; savePrefs(); }
        else if (hit(rows.langEn)) { state.lang = 'en'; warmI = 0; savePrefs(); }
        else if (hit(rows.learn)) { const open = LESSONS.map((_, i) => i).filter((i) => !state.learned.includes(i)); startLesson(open.length ? open[0] : 0); }
        else if (hit(rows.cho)) openSetup(CHO, false);
        else if (hit(rows.han)) openSetup(HAN, false);
        else if (hit(rows.two)) openSetup(CHO, true);
        else if (hit(rows.autoplay)) startAutoplay();
        else if (hit(rows.level)) { state.level = (state.level % LEVEL_COUNT) + 1; savePrefs(); }
        else if (hit(rows.tutor)) { state.tutor = !state.tutor; savePrefs(); sound('ok'); }
        else if (hit(rows.how)) { state.scene = 'howto'; state.scroll = 0; }
        else if (hit(rows.about)) { state.scene = 'about'; state.scroll = 0; }
        else if (hit(rows.rules)) { state.scene = 'rules'; state.scroll = 0; }
        else if (hit(rows.look)) state.scene = 'look';
        break;
      }
      case 'setup': {
        if (!p.pressed) break;
        const SU = lay().setup();
        const i = SU.cards.findIndex((r) => inRect(r, p.x, p.y));
        if (i >= 0) setupPick(i);
        else if (hit(SU.start)) setupGo();
        else if (hit(SU.back)) { if (state.setup.mode === 'two' && state.setup.step === 1) state.setup.step = 0; else state.scene = 'title'; }
        break;
      }
      case 'look': {
        if (!p.pressed) break;
        const LK = lay().look();
        let i = -1, key = '';
        for (const gr of LK.groups) { const k = gr.rects.findIndex((r) => inRect(r, p.x, p.y)); if (k >= 0) { i = k; key = gr.key; break; } }
        if (key === 'lang') { state.lang = i ? 'en' : 'ko'; warmI = 0; }
        else if (key === 'boards') state.board = i ? 'night' : 'hanji';
        else if (key === 'sets') { state.set = i ? 'ebony' : 'boxwood'; warmI = 0; }
        else if (key === 'text') state.big = i === 1;
        else if (key === 'calm') state.calm = i === 1;
        else if (key === 'sound') { state.sound = i === 0; audio.setMuted(!state.sound); }
        else if (hit(LK.back)) { state.scene = 'title'; i = 0; }
        if (i >= 0) savePrefs();
        break;
      }
      case 'howto': case 'about': case 'rules': {
        const RF = lay().ref();
        const setScroll = (v) => { state.scroll = Math.max(0, Math.min(v, readerMetrics.max)); };
        if (wheelInput.dy) { setScroll(state.scroll + wheelInput.dy); wheelInput.dy = 0; }
        for (const k of keys.pressed) {
          if (k === 'ArrowDown') setScroll(state.scroll + 70); else if (k === 'ArrowUp') setScroll(state.scroll - 70);
          else if (k === 'PageDown') setScroll(state.scroll + readerMetrics.viewH * 0.9); else if (k === 'PageUp') setScroll(state.scroll - readerMetrics.viewH * 0.9);
          else if (k === 'Home') setScroll(0); else if (k === 'End') setScroll(readerMetrics.max);
        }
        if (hit(RF.prev)) { state.scene = 'title'; sdrag = null; }
        else if (hit(RF.page)) { if (state.scroll >= readerMetrics.max - 2) { state.scene = 'title'; sdrag = null; } else setScroll(state.scroll + readerMetrics.viewH * 0.85); }
        else if (hit(RF.dec) && state.textScaleIdx > 0) { state.textScaleIdx--; applyTextScale(); savePrefs(); sound('ok'); }
        else if (hit(RF.inc) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; applyTextScale(); savePrefs(); sound('ok'); }
        else if (p.pressed && inRect(RF.card, p.x, p.y)) sdrag = { y0: p.y, s0: state.scroll };
        if (sdrag) { if (!p.down) sdrag = null; else setScroll(sdrag.s0 - (p.y - sdrag.y0)); }
        state.scroll = Math.max(0, Math.min(state.scroll, readerMetrics.max));
        break;
      }
      case 'lesson': {
        const L = state.lesson, l = LESSONS[L.i], BTN = lay().board('lesson').btn, st = l.steps[L.s];
        if (hit(BTN.menu)) { toMenu(); break; }
        if (hit(BTN.hint) && !L.done) { L.showSol = true; say(st.hint || 'Read the step above.', 'good'); break; }
        if (hit(BTN.pass)) {
          if (!L.done && st.want.pass) { if (!state.anim && canPass(state.g)) doMove({ pass: true }, () => stepDone()); }
          else if (!L.done) say('Passing is not what this step asks for.', 'info');
          break;
        }
        if (hit(BTN.next)) {
          if (!L.done) loadStep();
          else if (L.s + 1 < l.steps.length) { L.s++; loadStep(); }
          else if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
          else toMenu();
          break;
        }
        boardPointer(p);
        break;
      }
      case 'autoplay': {
        // No boardPointer(p): every move is automatic, so board taps do nothing here (this is a spectated demo).
        // Only Pause, Exit, the think-time stepper, and (once a game ends) the result panel's own buttons respond.
        const BL = lay().board('auto'), RES = lay().res();
        if (state.overOpen) {
          if (hit(RES.again)) startAutoplay();
          else if (hit(RES.look)) state.overOpen = false;
          else if (hit(RES.menu)) exitAutoplay();
          break;
        }
        if (hit(BL.btn.exit)) { exitAutoplay(); break; }
        if (hit(BL.btn.pause)) { state.paused = !state.paused; break; }
        if (hit(BL.stepper.dec) && state.autoThinkIdx > 0) { state.autoThinkIdx--; savePrefs(); }
        else if (hit(BL.stepper.inc) && state.autoThinkIdx < THINK_STEPS.length - 1) { state.autoThinkIdx++; savePrefs(); }
        break;
      }
      case 'play': {
        const g = state.g, BL = lay().board('play'), BTN = BL.btn, RES = lay().res();
        if (state.overOpen) {
          if (hit(RES.again)) playAgain();
          else if (hit(RES.look)) state.overOpen = false;
          else if (hit(RES.menu)) toMenu();
          break;
        }
        if (hit(BTN.menu)) { toMenu(); break; }
        if (hit(BTN.undo)) { takeBack(); break; }
        if (hit(BTN.hint)) { if (g.result) playAgain(); else useHint(); break; }
        if (hit(BTN.pass)) { doPass(); break; }
        if (BL.tutor && hit(BL.tutor)) { state.tutor = !state.tutor; if (!state.tutor) clearSel(); savePrefs(); sound('ok'); break; }
        boardPointer(p);
        break;
      }
      default: break;
    }
  }

  const quickMove = () => { const t = createThinker(state.g, 2, rng); for (;;) { const r = t.step(); if (r.move !== undefined) return r.move; } };
  const api = {
    update,
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height)); },
    getState() {
      const { g, risks, setup, ...rest } = state;
      return { ...rest, risks: risks.size, setup: { ...setup }, g: { board: g.board, turn: g.turn, moves: g.log.length, result: g.result, bik: g.bik } };
    },
    // kit 1.6.1: exempts Auto Play from the kit's free-preview timer entirely (no time accrual, no countdown badge) - it is a
    // free teaching/marketing tool, never real play. Stays true through the whole Auto Play game and its result panel.
    isPreviewExempt() {
      return !(state.scene === 'play' && !state.autoPlay && state.g && !state.g.result && !state.overOpen);
    },
  };
  if (config.dev) {
    // Dev tools only (?dev=1 / the app's Developer toggle): jump straight to screens for the layout matrix and screenshots.
    api.debugState = state;
    api.dev = {
      state,
      play(human = CHO, cho = 'inner', han = 'inner', moves = 0) {
        startGame(human, false, cho, han); state.msg = null; state.thinking = false; thinker = null;
        for (let i = 0; i < moves && !state.g.result; i++) { const mv = quickMove(); if (!mv) break; applyMove(state.g, mv.pass ? { pass: true } : mv); }
        const lg = state.g.log[state.g.log.length - 1]; state.last = lg && !lg.pass ? { f: lg.f, t: lg.t } : null; state.anim = null; pending = null; state.banner = null;
        if (state.g.turn !== state.human && !state.g.result) startThinking();
      },
      scene(name) { state.scene = name; state.overOpen = false; state.scroll = 0; },
      setup(human = CHO, two = false) { state.demoGames = 0; openSetup(human, two); },
      lesson(i, s = 0) { startLesson(i); state.lesson.s = s; loadStep(); },
      auto() { startAutoplay(); },
      over(winner) { const g = state.g; g.result = { winner: winner ?? state.human, why: 'checkmate' }; state.overOpen = true; },
    };
  }
  return api;
}
