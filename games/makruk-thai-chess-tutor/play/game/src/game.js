// Makruk: state and flow. Drawing is in view.js, the rules in rules.js, the computer player in engine.js, lessons in
// lessons.js and the text pages in content.js. This is the only file that mutates `state`.
//
// How a move is made: TAP a piece (its legal squares light up), then TAP a lit square; or DRAG the piece onto one.
// Watch & Learn plays whole games between two computers: THINK -> REVEAL -> ACT for every move, with a real Pause.
import {
  W, H, HDR, TITLE_SOUND, LIMIT, BTN, titleRows, squareAt, squareCentre, inRect, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT,
  SETTINGS_ROW, SETTINGS_BACK, AUTO, LEARN_BAR, THINK_STEPS, REVEAL_TIME, RESULT, SIBLINGS, chipRect,
} from './layout.js';
import {
  WHITE, BLACK, newGame, applyMove, undoMove, tryMove, legalMoves, legalTargets, inCheck, describeMove, parseSq, threatened, TYPE_NAME, SIDE_NAME, sqName, findKing,
} from './rules.js';
import { LEVEL_COUNT, createThinker, chooseMove } from './engine.js';
import { LESSONS, lessonBoard, lessonSolutions, cloneGame } from './lessons.js';
import { page as pageList } from './content.js';
import { THEME_ORDER, invalidateArt, warmArt } from './art.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, DEMO_MAX_LEVEL = 3, DEMO_LESSONS = 3;
const clampI = (v, a, b) => Math.min(Math.max(v | 0, a), b);
const HINT_LEVEL = { name: 'Think', depth: 6, budget: 70000, noise: 0, random: 0, margin: 0 };

export function createGame(env) {
  const { rng, storage, audio, config, monetization } = env;
  const state = {
    scene: 'title', t: 0, theme: 'jade', sound: true, textIdx: 0, level: 3, humanPref: WHITE, danger: false, thinkIdx: 1,
    g: newGame(), vb: Array.from(newGame().board), flip: false, human: WHITE, mode: 'ai',
    sel: -1, targets: [], drag: null, hint: null, msg: null, banner: null,
    anim: null, parts: [], rings: [], floats: [], trail: null,
    thinking: false, thinkT: 0, hintBusy: false, canAct: false, canUndo: false, checkSq: -1, threatSet: null,
    overOpen: false, pendingOver: false, page: 0, progress: { played: 0, wins: 0 }, learned: [], demoGames: 0, saved: null,
    cursor: 20, kb: false, resignArm: 0, press: null,
    lesson: { i: 0, done: false }, learnReset: 0,
    // Watch & Learn: THINK -> REVEAL -> ACT for every move of a whole game between two computer players
    ap: null, apPaused: false, apLevels: [4, 4], reveal: null,
  };
  let warmI = 0;
  let thinker = null, thinkDone = null, hinter = null, apThinker = null, apMove, apRng = null, dirty = true;
  const sfx = [];
  const NO_INPUT = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

  // ---- storage -----------------------------------------------------------------------------------------------------
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, theme: state.theme, textIdx: state.textIdx, danger: state.danger, thinkIdx: state.thinkIdx, humanPref: state.humanPref });
  storage.get('prefs', null).then((p) => {
    if (!p) return;
    state.level = clampI(p.level ?? state.level, 1, LEVEL_COUNT); state.sound = p.sound ?? true; state.theme = THEME_ORDER.includes(p.theme) ? p.theme : 'jade';
    state.textIdx = clampI(p.textIdx ?? 0, 0, TEXT_SCALES.length - 1); state.danger = !!p.danger; state.thinkIdx = clampI(p.thinkIdx ?? 1, 0, THINK_STEPS.length - 1); state.humanPref = p.humanPref === BLACK ? BLACK : WHITE;
    audio.setMuted(!state.sound);
  });
  storage.get('progress', null).then((p) => { if (p) state.progress = { played: p.played | 0, wins: p.wins | 0 }; });
  storage.get('learned', []).then((l) => { state.learned = Array.isArray(l) ? l.filter((n) => Number.isInteger(n)) : []; });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v | 0); });
  storage.get('save', null).then((v) => { if (v && Array.isArray(v.moves) && state.scene === 'title') state.saved = v; });
  const saveGame = () => {
    const g = state.g;
    if (state.scene !== 'play' || state.mode !== 'ai') return;
    if (g.result) { state.saved = null; storage.remove('save'); return; }
    state.saved = { moves: g.log.map((e) => [e.from, e.to]), human: state.human, level: state.level };
    storage.set('save', state.saved);
  };

  // ---- helpers -------------------------------------------------------------------------------------------------------
  const say = (text, kind = 'info') => { state.msg = { text, kind, t: 0 }; };
  const sound = (name) => {
    // Watch & Learn plays itself with nobody to hear it for: silent by design, like the menu's attract screen.
    if (!state.sound || state.scene === 'auto') return;
    if (name === 'tok') audio.tone({ freq: 250, to: 120, dur: 0.07, type: 'triangle', vol: 0.3 });
    else if (name === 'take') { audio.tone({ freq: 200, to: 95, dur: 0.12, type: 'triangle', vol: 0.34 }); sfx.push({ at: state.t + 0.06, o: { freq: 520, to: 300, dur: 0.1, type: 'square', vol: 0.05 } }); }
    else if (name === 'refuse') audio.tone({ freq: 150, to: 105, dur: 0.14, type: 'sine', vol: 0.2 });
    else if (name === 'ok') audio.tone({ freq: 640, to: 820, dur: 0.08, type: 'sine', vol: 0.12 });
    else if (name === 'sel') audio.tone({ freq: 520, to: 560, dur: 0.05, type: 'sine', vol: 0.1 });
    else if (name === 'check') { audio.tone({ freq: 660, dur: 0.14, type: 'sine', vol: 0.17 }); sfx.push({ at: state.t + 0.13, o: { freq: 880, dur: 0.2, type: 'sine', vol: 0.17 } }); }
    else if (name === 'promote') [523, 784].forEach((f, k) => sfx.push({ at: state.t + k * 0.1, o: { freq: f, dur: 0.22, type: 'sine', vol: 0.16 } }));
    else if (name === 'win') [523, 659, 784, 1046].forEach((f, k) => sfx.push({ at: state.t + k * 0.14, o: { freq: f, dur: 0.32, type: 'sine', vol: 0.19 } }));
    else if (name === 'lose') [392, 330, 262].forEach((f, k) => sfx.push({ at: state.t + k * 0.18, o: { freq: f, dur: 0.34, type: 'triangle', vol: 0.19 } }));
  };
  const clearSel = () => { state.sel = -1; state.targets = []; state.drag = null; };
  const syncBoard = () => { state.vb = Array.from(state.g.board); dirty = true; };
  const myTurnNow = () => {
    const g = state.g;
    if (g.result) return false;
    if (state.scene === 'play') return state.mode === 'two' || g.turn === state.human;
    if (state.scene === 'learn') return !state.lesson.done && g.turn === WHITE && state.learnReset <= 0;
    return false;
  };
  const busy = () => !!state.anim;
  const canActNow = () => !busy() && !state.thinking && myTurnNow();
  function recalc() {
    dirty = false;
    const g = state.g;
    state.canAct = canActNow();
    state.canUndo = state.canAct && state.scene === 'play' && (state.mode === 'two' ? g.log.length > 0 : g.log.some((e) => e.side === state.human));
    state.checkSq = !state.anim && inCheck(g) ? findKing(g.board, g.turn) : -1;
    state.threatSet = state.danger && state.canAct ? threatened(g, g.turn) : null;
  }
  const burst = (s, side) => {
    const q = squareCentre(s, state.flip); state.rings.push({ x: q.x, y: q.y, t: 0, c: side === WHITE ? '#fff2c8' : '#ff8a70' });
    for (let k = 0; k < 14; k++) {
      const a = rng.range(0, Math.PI * 2), v = rng.range(60, 240);
      state.parts.push({ x: q.x, y: q.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, max: rng.range(0.35, 0.7), size: rng.range(2.5, 6), c: side === WHITE ? (k % 2 ? '255,240,200' : '255,214,140') : (k % 2 ? '255,110,90' : '120,30,40') });
    }
  };

  // ---- playing a move (the rules change at once, the picture catches up) ----------------------------------------------------
  function playMove(mv, onDone) {
    const g = state.g, side = g.turn, piece = g.board[mv.from], desc = describeMove(g, mv);
    const hadCount = !!g.count;
    const res = applyMove(g, mv);
    state.hint = null; state.reveal = null;
    if (state.scene !== 'auto') clearSel(); else { state.sel = -1; state.targets = []; }
    state.trail = { from: mv.from, to: mv.to };
    state.anim = { t: 0, slide: 0.34, pop: res.cap ? 0.42 : mv.promo ? 0.34 : 0, from: mv.from, to: mv.to, type: Math.abs(piece), side, cap: !!res.cap, capType: Math.abs(res.cap), promo: !!mv.promo, res, desc, done: onDone, countStart: !hadCount && !!g.count };
    sound(res.cap ? 'take' : 'tok'); dirty = true;
  }
  function finishAnim() {
    const an = state.anim; state.anim = null; syncBoard();
    const res = an.res;
    if (an.cap) { burst(an.to, -an.side); const q = squareCentre(an.to, state.flip); state.floats.push({ x: q.x, y: q.y - 40, t: 0, text: `+${TYPE_NAME[an.capType]}`, c: '#ffd27a' }); }
    if (an.promo) { const q = squareCentre(an.to, state.flip); state.rings.push({ x: q.x, y: q.y, t: 0, c: '#ffe08a' }); state.floats.push({ x: q.x, y: q.y - 40, t: 0, text: 'Bia-ngai!', c: '#fff0b0' }); sound('promote'); }
    if (res.mate) state.banner = { text: 'Checkmate', t: 0 };
    else if (res.chk) { state.banner = { text: 'Check', t: 0 }; sound('check'); }
    else if (an.promo) state.banner = { text: 'Promoted', t: 0 };
    else if (an.countStart) state.banner = { text: 'Counting begins', t: 0 };
    else if (res.end && res.end.winner === 0) state.banner = { text: res.end.why === 'stalemate' ? 'Stalemate' : 'Draw', t: 0 };
    if (an.done) an.done(res, an);
    dirty = true;
  }
  function tickAnim(dt) {
    const an = state.anim; if (!an) return;
    an.t += dt;
    if (an.t >= an.slide + an.pop) finishAnim();
  }

  // ---- turn flow ----------------------------------------------------------------------------------------------------------------
  const prompt = () => {
    const g = state.g;
    if (inCheck(g)) return state.mode === 'two' ? `${SIDE_NAME[g.turn]} is in check: move the Khun, capture the attacker or block.` : 'Check! Your Khun is attacked: move it, capture the attacker, or block.';
    if (g.count) { const c = g.count; return state.mode === 'two' ? `${SIDE_NAME[g.turn]} to move. Counting: ${c.n} of ${c.limit}.` : `Your move. Counting: ${c.n} of ${c.limit}, ${SIDE_NAME[c.chaser]} must mate in time.`; }
    return state.mode === 'two' ? `${SIDE_NAME[g.turn]} to move.` : 'Your move. Tap a piece, then a lit square.';
  };
  const gloss = (an) => `${SIDE_NAME[an.side]}: ${an.desc}.${an.countStart && state.g.count ? ` Counting begins (${state.g.count.kind === 'board' ? "Board's honour" : "Pieces' honour"}).` : ''}`;
  function afterMove(res, an) {
    const g = state.g;
    if (g.result) { finishGame(); return; }
    saveGame();
    if (state.mode === 'ai' && g.turn !== state.human) { say(`${gloss(an)} The computer is thinking...`, 'info'); startThinking(onAiMove); }
    else if (state.mode === 'ai') say(`${gloss(an)} ${prompt()}`, res.chk ? 'warn' : 'info');
    else say(prompt(), res.chk ? 'warn' : 'info');
  }
  function onAiMove(mv) { if (mv) playMove(mv, afterMove); }
  function startThinking(cb, level = state.level) {
    state.thinking = true; state.thinkT = 0; state.hint = null; dirty = true;
    thinker = createThinker(state.g, level, rng); thinkDone = cb;
  }
  function finishGame() {
    const r = state.g.result;
    state.pendingOver = true; clearSel(); state.hint = null;
    if (state.scene === 'play') {
      if (state.mode === 'ai') {
        state.progress.played++; if (r.winner === state.human) state.progress.wins++;
        storage.set('progress', { played: state.progress.played, wins: state.progress.wins });
        monetization.track('game_end', { level: state.level, why: r.why, won: r.winner === state.human });
        state.saved = null; storage.remove('save');
      }
      sound(r.winner === 0 ? 'ok' : state.mode === 'two' || r.winner === state.human ? 'win' : 'lose');
    }
    dirty = true;
  }
  function demoBlocked(mode) {
    if (!config.demo) return false;
    if (mode === 'two' || state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return true; }
    state.demoGames++; storage.set('demoGames', state.demoGames);
    if (state.level > DEMO_MAX_LEVEL) state.level = DEMO_MAX_LEVEL;
    return false;
  }
  function resetTransient() {
    Object.assign(state, { overOpen: false, pendingOver: false, trail: null, msg: null, hint: null, anim: null, thinking: false, banner: null, hintBusy: false, apPaused: false, reveal: null, resignArm: 0, learnReset: 0 });
    clearSel(); thinker = null; thinkDone = null; hinter = null; apThinker = null;
  }
  function startGame(human, mode, resume) {
    if (!resume && demoBlocked(mode)) return;
    state.scene = 'play'; state.mode = mode; state.human = human; state.flip = mode === 'ai' && human === BLACK;
    state.g = newGame(); resetTransient();
    if (resume) { for (const [f, t] of resume.moves) { const mv = legalMoves(state.g).find((x) => x.from === f && x.to === t); if (!mv) break; applyMove(state.g, mv); } }
    syncBoard();
    const last = state.g.log[state.g.log.length - 1]; state.trail = last ? { from: last.from, to: last.to } : null;
    if (state.g.turn !== human && mode === 'ai') { say(`${SIDE_NAME[state.g.turn]} (the computer) moves first.`, 'info'); startThinking(onAiMove); }
    else say(mode === 'two' ? `Gold moves first. ${prompt()}` : `You play ${SIDE_NAME[human]}. ${prompt()}`, 'info');
    monetization.track('game_start', { mode, level: state.level, side: human });
  }
  function toMenu() {
    if (state.scene === 'play') saveGame();
    resetTransient(); state.scene = 'title'; state.g = newGame(); state.flip = false; syncBoard(); savePrefs();
  }

  // ---- human input ----------------------------------------------------------------------------------------------------------------
  const ownPiece = (s) => { const p = state.g.board[s]; return p !== 0 && (p > 0) === (state.g.turn > 0); };
  function refuse(text) { say(text, 'warn'); sound('refuse'); }
  function select(s) {
    const g = state.g;
    state.sel = s; state.hint = null;
    state.targets = legalTargets(g, s).map((m) => ({ to: m.to, cap: !!m.cap, promo: m.promo }));
    sound('sel');
    if (!state.targets.length) say(inCheck(g) ? `This ${TYPE_NAME[Math.abs(g.board[s])]} cannot help: your Khun is in check.` : `This ${TYPE_NAME[Math.abs(g.board[s])]} has no legal move right now.`, 'info');
    else say(`${TYPE_NAME[Math.abs(g.board[s])]} on ${sqName(s)}: dots are quiet moves, red rings are captures.`, 'info');
  }
  function doHumanMove(from, to) {
    const r = tryMove(state.g, from, to);
    if (!r.ok) { refuse(r.why); return; }
    clearSel();
    if (state.scene === 'learn') playMove(r.move, lessonAfter); else playMove(r.move, afterMove);
  }
  function tapSquare(s) {
    if (!state.canAct) return;
    if (s < 0) { clearSel(); return; }
    if (state.sel === s) { clearSel(); say(prompt(), 'info'); return; }
    if (state.sel >= 0 && state.targets.some((t) => t.to === s)) { doHumanMove(state.sel, s); return; }
    if (ownPiece(s)) { select(s); return; }
    if (state.sel >= 0) { const r = tryMove(state.g, state.sel, s); refuse(r.ok ? 'That move is not available.' : r.why); return; }
    if (state.g.board[s]) refuse('That is an enemy piece. Tap one of your own.'); else clearSel();
  }
  function undo() {
    if (!state.canUndo) return;
    const g = state.g;
    thinker = null; hinter = null; state.thinking = false; state.hintBusy = false; state.hint = null; state.overOpen = false; state.pendingOver = false; clearSel();
    if (state.mode === 'two') undoMove(g);
    else { do { if (!undoMove(g)) break; } while (g.turn !== state.human); }
    syncBoard(); const last = g.log[g.log.length - 1]; state.trail = last ? { from: last.from, to: last.to } : null;
    sound('ok'); saveGame();
    if (state.mode === 'ai' && g.turn !== state.human) { say('Move taken back. The computer moves first.', 'info'); startThinking(onAiMove); } else say(`Move taken back. ${prompt()}`, 'info');
  }
  // the reason a move is good, in plain words
  function hintReason(g, mv) {
    const c = cloneGame(g), piece = g.board[mv.from], cap = g.board[mv.to], tname = TYPE_NAME[Math.abs(piece)];
    const wasThreat = threatened(g, g.turn).includes(mv.from);
    const r = applyMove(c, mv);
    if (r.mate) return 'This is checkmate.';
    if (mv.promo) return 'Promotes the Bia into a Bia-ngai.';
    if (cap) return r.chk ? `Takes the ${TYPE_NAME[Math.abs(cap)]} and gives check.` : `Takes the ${TYPE_NAME[Math.abs(cap)]}.`;
    if (r.chk) return 'Gives check and forces a reply.';
    if (wasThreat) return `Moves the ${tname} out of danger.`;
    if (g.count && g.count.chaser === g.turn) return `Closes in on the Khun. The count is ${g.count.n} of ${g.count.limit}.`;
    if (Math.abs(piece) === 1) return 'Advances a Bia toward the sixth rank.';
    return `Improves the ${tname}'s position.`;
  }
  function useHint() {
    if (!state.canAct || state.hintBusy) return;
    if (state.scene === 'learn') { learnHint(); return; }
    if (state.mode !== 'ai') { say('Think is available when you play the computer.', 'info'); return; }
    hinter = createThinker(state.g, 0, rng, { level: HINT_LEVEL }); state.hintBusy = true; state.hint = null; clearSel(); say('Thinking about the best move...', 'info');
  }
  function hintResult(res) {
    state.hintBusy = false;
    if (!res.move) { say('No move found.', 'info'); return; }
    state.hint = { from: res.move.from, to: res.move.to };
    say(`Think: ${describeMove(state.g, res.move)}. ${hintReason(state.g, res.move)}`, 'good');
  }
  function resign() {
    const g = state.g;
    if (state.scene !== 'play' || g.result || (state.mode === 'ai' && !state.canAct) || state.anim) return;
    if (state.resignArm <= 0) { state.resignArm = 3; say(state.mode === 'ai' ? 'Tap Resign again to give up this game.' : 'Tap Draw again to agree a draw.', 'warn'); return; }
    state.resignArm = 0; clearSel(); thinker = null; state.thinking = false;
    g.result = state.mode === 'ai' ? { winner: -state.human, why: 'resign' } : { winner: 0, why: 'agreed' };
    finishGame();
  }

  // ---- learn -----------------------------------------------------------------------------------------------------------------------
  function startLesson(i) {
    if (config.demo && i >= DEMO_LESSONS) { state.scene = 'demo-limit'; return; }
    state.scene = 'learn'; state.lesson = { i, done: false }; state.mode = 'lesson'; state.human = WHITE; state.flip = false;
    state.g = lessonBoard(i); resetTransient(); syncBoard(); say(LESSONS[i].text, 'info');
  }
  function lessonAfter(res, an) {
    const L = LESSONS[state.lesson.i], g = state.g;
    if (L.play && !g.result && an.side === WHITE) { say(`${gloss(an)} Ruby replies...`, 'info'); startThinking((mv) => { if (mv) playMove(mv, lessonAfter); }, 3); return; }
    if (L.play && !g.result) { say(`${gloss(an)} ${prompt()}`, 'info'); return; }
    const entry = { ...g.log[g.log.length - 1], mate: !!res.mate };
    if (L.goal(entry, g)) {
      state.lesson.done = true; sound('win');
      if (!state.learned.includes(state.lesson.i)) { state.learned.push(state.lesson.i); storage.set('learned', state.learned.slice()); }
      say(state.lesson.i + 1 < LESSONS.length ? 'Well done! Tap Next for the next lesson.' : 'Well done! You have finished every lesson.', 'good'); state.banner = { text: 'Well done!', t: 0 };
    } else { say(L.fail, 'warn'); sound('refuse'); state.learnReset = 1.8; }
    dirty = true;
  }
  function learnHint() {
    const L = LESSONS[state.lesson.i], g = state.g;
    if (L.play) { hinter = createThinker(g, 0, rng, { level: HINT_LEVEL }); state.hintBusy = true; say('Thinking...', 'info'); return; }
    const sol = lessonSolutions(g, state.lesson.i);
    if (!sol.length) return;
    state.hint = { from: sol[0].from, to: sol[0].to }; say(L.hint, 'good');
  }

  // ---- Watch & Learn ----------------------------------------------------------------------------------------------------------------
  function startAuto() {
    state.scene = 'auto'; state.mode = 'auto'; state.flip = false; state.human = 0;
    state.g = newGame(); apRng = rng.fork(); resetTransient();
    state.apLevels = apRng.pick([[4, 4], [5, 4], [4, 5], [3, 4], [4, 3]]);
    apThinker = null; apMove = undefined; syncBoard();
    state.ap = { phase: 'think', timer: THINK_STEPS[state.thinkIdx] };
    say('Two computers will play a whole game. Watch each move: think, then see the choice.', 'info');
  }
  function autoUpdate(dt) {
    const ap = state.ap, g = state.g;
    if (g.result) { if (!state.anim && state.pendingOver && !state.overOpen) { state.overOpen = true; state.pendingOver = false; } return; }
    if (state.anim || state.overOpen) return;
    if (ap.phase === 'think') {
      if (!apThinker) { apThinker = createThinker(g, state.apLevels[g.turn === WHITE ? 0 : 1], apRng); apMove = undefined; ap.timer = THINK_STEPS[state.thinkIdx]; say(`${SIDE_NAME[g.turn]} is thinking. Which move would you play?`, 'info'); }
      const r = apThinker.step(); if (r.move !== undefined) apMove = r.move;
      ap.timer = Math.max(0, ap.timer - dt);
      if (ap.timer <= 0 && apMove !== undefined) {
        if (!apMove) { g.result = { winner: -g.turn, why: 'checkmate' }; state.pendingOver = true; return; }
        ap.phase = 'reveal'; ap.timer = REVEAL_TIME;
        const all = legalMoves(g), movable = [...new Set(all.map((m) => m.from))];
        state.reveal = { movable, from: apMove.from, to: apMove.to, targets: all.filter((m) => m.from === apMove.from).map((m) => ({ to: m.to, cap: !!m.cap })) };
        say(`${SIDE_NAME[g.turn]} chooses: ${describeMove(g, apMove)}. ${hintReason(g, apMove)}`, 'good');
      }
    } else if (ap.phase === 'reveal') {
      ap.timer -= dt;
      if (ap.timer <= 0) { ap.phase = 'act'; const mv = apMove; apThinker = null; state.reveal = null; playMove(mv, () => { if (state.g.result) state.pendingOver = true; else { ap.phase = 'think'; apMove = undefined; } }); }
    }
  }

  // ---- keyboard cursor --------------------------------------------------------------------------------------------------------------------
  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  const cursorMove = (dx, dy) => {
    const f = state.flip ? -1 : 1;
    const file = Math.max(0, Math.min(7, (state.cursor & 7) + dx * f)), rank = Math.max(0, Math.min(7, (state.cursor >> 3) + dy * f));
    state.cursor = rank * 8 + file;
  };

  // ---- update ---------------------------------------------------------------------------------------------------------------------------
  function update(dt, input) {
    if (SHOT) input = NO_INPUT;
    state.t += dt;
    const p = input.pointer, keys = input.keys;
    state.press = p.down ? { x: p.x, y: p.y } : null;
    // pre-bake the heavy art a little each frame while the menu is showing (a fixed work budget, no clock)
    if (warmI >= 0 && state.t > 0.15) { if (warmArt(warmI, state.theme)) warmI++; else warmI = -1; }
    // Watch & Learn's Pause freezes everything that moves: timers, the engine search, move animations, particles.
    const frozen = state.scene === 'auto' && state.apPaused;
    for (let i = sfx.length - 1; i >= 0; i--) if (sfx[i].at <= state.t) { audio.tone(sfx[i].o); sfx.splice(i, 1); }
    if (state.msg) state.msg.t += dt;
    if (state.banner && !frozen) { state.banner.t += dt; if (state.banner.t > 1.5) state.banner = null; }
    if (state.resignArm > 0) state.resignArm -= dt;
    if (!frozen) {
      for (const q of state.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 420 * dt; }
      state.parts = state.parts.filter((q) => q.t < q.max);
      for (const r of state.rings) r.t += dt;
      state.rings = state.rings.filter((r) => r.t < 0.55);
      for (const f of state.floats) f.t += dt;
      state.floats = state.floats.filter((f) => f.t < 1.1);
      tickAnim(dt);
    }
    // the computer's turn
    if (state.thinking && !state.anim && thinker && !frozen) {
      state.thinkT += dt;
      const r = thinker.step();
      if (r.move !== undefined && state.thinkT >= 0.6) { const cb = thinkDone; thinker = null; thinkDone = null; state.thinking = false; dirty = true; if (cb) cb(r.move); }
    }
    if (hinter && !frozen) { const r = hinter.step(); if (r.move !== undefined) { hinter = null; hintResult(r); } }
    if (state.scene === 'auto' && !frozen) autoUpdate(dt);
    if (state.learnReset > 0 && !state.anim) {
      state.learnReset -= dt;
      if (state.learnReset <= 0) { state.learnReset = 0; state.g = lessonBoard(state.lesson.i); syncBoard(); clearSel(); state.trail = null; state.thinking = false; thinker = null; say(LESSONS[state.lesson.i].text, 'info'); }
    }
    if (state.pendingOver && !state.anim && !state.overOpen && state.g.result && state.scene !== 'auto' && state.scene !== 'learn') { state.overOpen = true; state.pendingOver = false; }
    if (dirty || state.canAct !== canActNow()) recalc();

    if (keys.pressed.size) {
      const k = [...keys.pressed];
      if (state.scene === 'title') { if (k.includes('Enter') || k.includes('Space')) startGame(state.humanPref, 'ai'); }
      else if (state.scene === 'play' || state.scene === 'learn') {
        state.kb = true;
        for (const c of k) {
          if (ARROWS[c]) cursorMove(...ARROWS[c]);
          else if (c === 'Space' || c === 'Enter') { if (state.overOpen) { startGame(state.human, state.mode); break; } tapSquare(state.cursor); }
          else if (c === 'Escape') { if (state.sel >= 0) clearSel(); else toMenu(); }
          else if (c === 'KeyU') undo();
          else if (c === 'KeyH') useHint();
          else if (c === 'KeyT' && state.scene === 'play') { state.danger = !state.danger; dirty = true; savePrefs(); }
        }
      } else if (k.includes('Escape')) { if (state.scene === 'auto') toMenu(); else state.scene = 'title'; }
    }

    const hit = (r) => p.pressed && inRect(r, p.x, p.y);
    switch (state.scene) {
      case 'title': {
        if (!p.pressed) break;
        const R = titleRows(!!state.saved, state.textIdx >= 3);
        if (R.resume && hit(R.resume)) { const s = state.saved; state.level = clampI(s.level ?? state.level, 1, LEVEL_COUNT); startGame(s.human === BLACK ? BLACK : WHITE, 'ai', s); }
        else if (hit(R.play)) startGame(state.humanPref, 'ai');
        else if (hit(R.two)) startGame(WHITE, 'two');
        else if (hit(R.learn)) { const open = LESSONS.map((_, i) => i).filter((i) => !state.learned.includes(i)); startLesson(open.length ? open[0] : 0); }
        else if (hit(R.watch)) startAuto();
        else if (hit(R.settings)) state.scene = 'settings';
        else if (hit(R.level)) { state.level = (state.level % LEVEL_COUNT) + 1; savePrefs(); }
        else if (hit(R.side)) { state.humanPref = state.humanPref === WHITE ? BLACK : WHITE; savePrefs(); }
        else if (hit(R.howto)) { state.scene = 'howto'; state.page = 0; }
        else if (hit(R.rules)) { state.scene = 'rules'; state.page = 0; }
        else if (hit(R.about)) { state.scene = 'about'; state.page = 0; }
        else if (hit(TITLE_SOUND)) { state.sound = !state.sound; audio.setMuted(!state.sound); savePrefs(); }
        break;
      }
      case 'howto': case 'about': case 'rules': {
        const list = pageList(state.scene);
        if (hit(REF_BACK)) { if (state.page > 0) state.page--; else state.scene = 'title'; }
        else if (hit(REF_NEXT)) { if (state.page >= list.length - 1) { state.scene = 'title'; state.page = 0; } else state.page++; }
        else if (hit(TEXT_DEC) && state.textIdx > 0) { state.textIdx--; savePrefs(); sound('ok'); }
        else if (hit(TEXT_INC) && state.textIdx < TEXT_SCALES.length - 1) { state.textIdx++; savePrefs(); sound('ok'); }
        break;
      }
      case 'settings': {
        if (!p.pressed) break;
        if (hit(SETTINGS_BACK)) { state.scene = 'title'; savePrefs(); break; }
        for (let i = 0; i < 7; i++) {
          const R = SETTINGS_ROW(i, state.textIdx >= 3);
          if (!inRect(R, p.x, p.y)) continue;
          if (i === 0) { state.sound = !state.sound; audio.setMuted(!state.sound); }
          else if (i === 1) state.level = (state.level % LEVEL_COUNT) + 1;
          else if (i === 2) state.humanPref = state.humanPref === WHITE ? BLACK : WHITE;
          else if (i === 3) { state.theme = THEME_ORDER[(THEME_ORDER.indexOf(state.theme) + 1) % THEME_ORDER.length]; invalidateArt(); warmI = 14; }
          else if (i === 4) state.danger = !state.danger;
          else if (i === 5) state.thinkIdx = (state.thinkIdx + 1) % THINK_STEPS.length;
          else if (i === 6) state.textIdx = (state.textIdx + 1) % TEXT_SCALES.length;
          savePrefs(); sound('ok'); dirty = true;
        }
        break;
      }
      case 'demo-limit': if (hit(LIMIT.btn)) toMenu(); break;
      case 'auto': {
        if (state.overOpen) { resultButtons(hit); break; }
        if (hit(HDR.menu) || hit(AUTO.exit)) { toMenu(); break; }
        if (hit(HDR.sound)) { state.sound = !state.sound; audio.setMuted(!state.sound); savePrefs(); break; }
        if (hit(AUTO.pause)) { state.apPaused = !state.apPaused; break; }
        if (hit(AUTO.dec) && state.thinkIdx > 0) { state.thinkIdx--; savePrefs(); if (state.ap.phase === 'think') state.ap.timer = Math.min(state.ap.timer, THINK_STEPS[state.thinkIdx]); }
        else if (hit(AUTO.inc) && state.thinkIdx < THINK_STEPS.length - 1) { state.thinkIdx++; savePrefs(); if (state.ap.phase === 'think') state.ap.timer = Math.max(state.ap.timer, THINK_STEPS[state.thinkIdx]); }
        break;
      }
      case 'learn': {
        if (hit(HDR.menu) || hit(LEARN_BAR.menu)) { toMenu(); break; }
        if (hit(HDR.sound)) { state.sound = !state.sound; audio.setMuted(!state.sound); savePrefs(); break; }
        if (hit(LEARN_BAR.hint) && !state.lesson.done) { useHint(); break; }
        if (hit(LEARN_BAR.reset)) { startLesson(state.lesson.i); break; }
        if (hit(LEARN_BAR.next) && state.lesson.done) { if (state.lesson.i + 1 < LESSONS.length) startLesson(state.lesson.i + 1); else toMenu(); break; }
        boardPointer(p);
        break;
      }
      case 'play': {
        if (state.overOpen) { resultButtons(hit); break; }
        if (hit(HDR.menu)) { toMenu(); break; }
        if (hit(HDR.sound)) { state.sound = !state.sound; audio.setMuted(!state.sound); savePrefs(); break; }
        if (hit(BTN.undo)) { undo(); break; }
        if (hit(BTN.hint)) { useHint(); break; }
        if (hit(BTN.threat)) { state.danger = !state.danger; dirty = true; savePrefs(); break; }
        if (hit(BTN.end)) { resign(); break; }
        boardPointer(p);
        break;
      }
      default: break;
    }
  }
  function resultButtons(hit) {
    if (hit(RESULT.dec) && state.textIdx > 0) { state.textIdx--; savePrefs(); }
    else if (hit(RESULT.inc) && state.textIdx < TEXT_SCALES.length - 1) { state.textIdx++; savePrefs(); }
    else if (hit(RESULT.again)) { if (state.scene === 'auto') startAuto(); else startGame(state.human, state.mode); }
    else if (hit(RESULT.menu)) toMenu();
    else if (state.scene !== 'auto') SIBLINGS.forEach((sib, i) => hit(chipRect(i, RESULT.chipsY)) && env.openGame(sib.slug));
  }
  function boardPointer(p) {
    const d = state.drag;
    if (p.pressed && state.canAct) {
      const s = squareAt(p.x, p.y, state.flip);
      state.kb = false;
      tapSquare(s);
      if (s >= 0 && state.sel === s && state.canAct) state.drag = { sq: s, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
    }
    if (state.drag && p.down) { const dd = state.drag; dd.x = p.x; dd.y = p.y; if (!dd.moved && Math.hypot(p.x - dd.sx, p.y - dd.sy) > 16) dd.moved = true; }
    if (p.released && d && state.drag === d) {
      state.drag = null;
      if (d.moved) { const s = squareAt(p.x, p.y, state.flip); if (s >= 0 && s !== d.sq && state.canAct && state.targets.some((t) => t.to === s)) doHumanMove(d.sq, s); }
    }
  }

  // ---- store screenshots ---------------------------------------------------------------------------------------------------------------
  // `tools/arc shots` loads the page with ?shot=1&seed=N and a random "monkey" player. For seeds 101..106 the game instead
  // stages a real, readable moment (below) and ignores the monkey's input. Never active in the app or in the demo.
  function playPlies(n, lvl) {
    for (let i = 0; i < n && !state.g.result; i++) { const mv = chooseMove(state.g, lvl, rng); if (!mv) break; applyMove(state.g, mv); }
    syncBoard(); const last = state.g.log[state.g.log.length - 1]; state.trail = last ? { from: last.from, to: last.to } : null;
  }
  function stageShot(n) {
    if (n === 104) { startAuto(); state.ap.timer = 0; return; }
    if (n === 105) { state.scene = 'rules'; state.page = 15; return; }
    if (n === 106) { startLesson(1); learnHint(); return; }
    if (n === 103) {
      startGame(WHITE, 'ai'); thinker = null; state.thinking = false; playPlies(20, 2); state.danger = true; state.mode = 'ai'; state.human = WHITE; state.flip = false;
      if (state.g.turn !== WHITE) playPlies(1, 2);
      const mv = chooseMove(state.g, 4, rng); if (mv) { state.hint = { from: mv.from, to: mv.to }; say(`Think: ${describeMove(state.g, mv)}. ${hintReason(state.g, mv)}`, 'good'); }
      dirty = true; return;
    }
    if (n === 102) {
      startLesson(7); const g = state.g; const mv = legalMoves(g).find((m) => m.from === parseSq('a2') && m.to === parseSq('a4'));
      applyMove(g, mv); const r = chooseMove(g, 3, rng); applyMove(g, r); syncBoard(); state.scene = 'play'; state.mode = 'ai'; state.human = WHITE; state.level = 3; state.lesson = { i: 7, done: false };
      state.trail = { from: r.from, to: r.to }; say(prompt(), 'info'); dirty = true; return;
    }
    // 101: a middle-game position with a piece selected
    startGame(WHITE, 'ai'); thinker = null; state.thinking = false; playPlies(16, 2); if (state.g.turn !== WHITE) playPlies(1, 2);
    state.mode = 'ai'; state.human = WHITE; state.flip = false;
    const mine = legalMoves(state.g).filter((m) => state.g.board[m.from] > 0), pick = mine.find((m) => m.cap) || mine[0];
    if (pick) select(pick.from);
    dirty = true;
  }
  const SHOT = /(^|[?&])shot=/.test(globalThis.location?.search || '') && !config.demo && config.seed >= 101 && config.seed <= 106;
  if (SHOT) stageShot(config.seed);

  return {
    update,
    render(ctx) { render(ctx, state); },
    // Watch & Learn, the menus, the settings and the reading pages are free; only real play and the lessons use up the preview time.
    isPreviewExempt: () => state.scene !== 'play' && state.scene !== 'learn',
    getState() {
      const { g, anim, ...rest } = state;
      return { ...rest, anim: anim ? { t: anim.t, from: anim.from, to: anim.to } : null, g: { board: Array.from(g.board), turn: g.turn, moves: g.log.length, count: g.count, result: g.result } };
    },
  };
}
