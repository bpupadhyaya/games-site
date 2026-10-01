// Fanorona: state and flow. Drawing is in view.js, the rules in rules.js, the computer player in engine.js, lessons in
// lessons.js and the text pages in content.js. This is the only file that mutates `state`.
//
// How a turn is made: TAP a stone (its reachable points light up; a number shows how many stones that step takes), then
// TAP a lit point; or DRAG the stone onto it. A step that could either approach or withdraw asks which. After a capture
// the same stone may keep going (lit points show where) or you tap End turn.
import {
  W, H, S, BTN, CHOICE, HDR, TITLE_SOUND, LIMIT, titleRows, pointAt, pointXY, inRect, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT,
  SETTINGS_ROW, SETTINGS_BACK, AUTO, LEARN_BAR, THINK_STEPS, REVEAL_TIME, RESULT, SIBLINGS, chipRect,
} from './layout.js';
import {
  LIGHT, DARK, other, SIDE_NAME, newGame, startBoard, legalSteps, mustCapture, applyStep, endChain, undoTurn, cancelChain, genTurns, countOf, ROWS, COLS, idx,
} from './rules.js';
import { LEVEL_COUNT, createThinker, bestTurn } from './engine.js';
import { LESSONS, lessonBoard } from './lessons.js';
import { page as pageList } from './content.js';
import { THEME_ORDER, invalidateArt } from './art.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, DEMO_MAX_LEVEL = 3;
const clampI = (v, a, b) => Math.min(Math.max(v | 0, a), b);

export function createGame(env) {
  const { rng, storage, audio, config, monetization } = env;
  const state = {
    scene: 'title', t: 0, theme: 'rosewood', sound: true, textIdx: 0, level: 3, humanPref: LIGHT, danger: false, thinkIdx: 1,
    g: newGame(), vboard: startBoard(), startBoard: startBoard(), flip: false, human: LIGHT, mode: 'ai',
    sel: -1, targets: [], choice: null, drag: null, hint: null, msg: null, banner: null,
    anim: null, parts: [], rings: [], floats: [], trail: null,
    thinking: false, thinkT: 0, hintBusy: false, canAct: false, canMove: null, canUndo: false, dangerSet: null,
    overOpen: false, pendingOver: false, page: 0, progress: { played: 0, wins: 0 }, learned: [], demoGames: 0, saved: null,
    cursor: 22, kb: false, resignArm: 0, press: null,
    lesson: { i: 0, done: false }, learnReset: 0,
    // Watch & Learn: THINK -> REVEAL -> ACT for every turn of a whole game between two computer players
    ap: null, apPaused: false, apLevels: [4, 4], reveal: null,
  };
  let thinker = null, hinter = null, aiQueue = [], apThinker = null, apMove = undefined, apQueue = [], apRng = null, dirty = true;
  const sfx = [];
  const NO_INPUT = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

  // ---- storage -----------------------------------------------------------------------------------------------------------------
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, theme: state.theme, textIdx: state.textIdx, danger: state.danger, thinkIdx: state.thinkIdx, humanPref: state.humanPref });
  storage.get('prefs', null).then((p) => {
    if (!p) return;
    state.level = clampI(p.level ?? state.level, 1, LEVEL_COUNT); state.sound = p.sound ?? true; state.theme = THEME_ORDER.includes(p.theme) ? p.theme : 'rosewood';
    state.textIdx = clampI(p.textIdx ?? 0, 0, TEXT_SCALES.length - 1); state.danger = !!p.danger; state.thinkIdx = clampI(p.thinkIdx ?? 1, 0, THINK_STEPS.length - 1); state.humanPref = p.humanPref === DARK ? DARK : LIGHT;
    audio.setMuted(!state.sound);
  });
  storage.get('progress', null).then((p) => { if (p) state.progress = { played: p.played | 0, wins: p.wins | 0 }; });
  storage.get('learned', []).then((l) => { state.learned = Array.isArray(l) ? l.filter((n) => Number.isInteger(n)) : []; });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v | 0); });
  storage.get('save', null).then((v) => { if (v && v.g && v.g.board && state.scene === 'title') state.saved = v; });
  const saveGame = () => {
    const g = state.g;
    if (state.scene !== 'play' || state.mode !== 'ai' || g.chain) return;
    if (g.result) { state.saved = null; storage.remove('save'); return; }
    state.saved = { g: { board: g.board.slice(), turn: g.turn, ply: g.ply, quiet: g.quiet, history: g.history, log: g.log }, human: state.human, level: state.level };
    storage.set('save', state.saved);
  };

  // ---- helpers ------------------------------------------------------------------------------------------------------------------
  const say = (text, kind = 'info') => { state.msg = { text, kind, t: 0 }; };
  const sound = (name, n = 0) => {
    // Watch & Learn plays itself with nobody to hear it for: silent by design, like the menu's attract screen.
    if (!state.sound || state.scene === 'auto') return;
    if (name === 'tok') audio.tone({ freq: 240, to: 130, dur: 0.07, type: 'triangle', vol: 0.3 });
    else if (name === 'take') { const base = 170 + n * 38; audio.tone({ freq: base + 60, to: base * 0.6, dur: 0.13, type: 'triangle', vol: 0.34 }); sfx.push({ at: state.t + 0.06, o: { freq: base * 2.3, to: base * 1.2, dur: 0.12, type: 'square', vol: 0.05 } }); }
    else if (name === 'refuse') audio.tone({ freq: 150, to: 105, dur: 0.14, type: 'sine', vol: 0.2 });
    else if (name === 'ok') audio.tone({ freq: 640, to: 820, dur: 0.08, type: 'sine', vol: 0.12 });
    else if (name === 'sel') audio.tone({ freq: 520, to: 560, dur: 0.05, type: 'sine', vol: 0.1 });
    else if (name === 'win') [523, 659, 784, 1046].forEach((f, k) => sfx.push({ at: state.t + k * 0.14, o: { freq: f, dur: 0.32, type: 'sine', vol: 0.19 } }));
    else if (name === 'lose') [392, 330, 262].forEach((f, k) => sfx.push({ at: state.t + k * 0.18, o: { freq: f, dur: 0.34, type: 'triangle', vol: 0.19 } }));
  };
  const clearSel = () => { state.sel = -1; state.targets = []; state.choice = null; state.drag = null; };
  const pxy = (p) => pointXY(p, state.flip);
  const syncBoard = () => { state.vboard = state.g.board.slice(); dirty = true; };
  const trailOf = (entry) => (entry ? entry.steps.map((s) => ({ from: s.from, to: s.to })) : null);
  const myTurnNow = () => {
    const g = state.g;
    if (g.result) return false;
    if (state.scene === 'play') return state.mode === 'two' || g.turn === state.human;
    if (state.scene === 'learn') return !state.lesson.done && g.turn === LIGHT && state.learnReset <= 0;
    return false;
  };
  const busy = () => !!state.anim || aiQueue.length > 0;
  const canActNow = () => !busy() && !state.thinking && myTurnNow();

  function recalc() {
    dirty = false;
    const g = state.g;
    state.canAct = canActNow();
    state.canMove = state.canAct && !g.chain && mustCapture(g) ? [...new Set(legalSteps(g).map((s) => s.from))] : null;
    state.canUndo = state.canAct && state.scene === 'play' && (g.chain ? true : state.mode === 'two' ? g.history.length > 0 : g.history.some((h) => h.turn === state.human));
    state.dangerSet = null;
    if (state.danger && state.canAct && !g.chain) {
      const set = new Set();
      for (const t of genTurns(g.board, other(g.turn))) for (const s of t.steps) for (const v of s.victims) set.add(v);
      state.dangerSet = [...set].filter((p) => g.board[p] === g.turn);
    }
  }

  // ---- particles ---------------------------------------------------------------------------------------------------------------------
  const burst = (p, side) => {
    const q = pxy(p); state.rings.push({ x: q.x, y: q.y, t: 0, c: side === LIGHT ? '#fff2c8' : '#ff8a54' });
    for (let k = 0; k < 14; k++) {
      const a = rng.range(0, Math.PI * 2), v = rng.range(60, 240);
      state.parts.push({ x: q.x, y: q.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, max: rng.range(0.35, 0.7), size: rng.range(2.5, 6), c: side === LIGHT ? (k % 2 ? '255,240,200' : '255,214,140') : (k % 2 ? '255,120,70' : '90,40,30') });
    }
  };

  // ---- playing steps (the rules change at once, the picture catches up) -----------------------------------------------------------------
  function playStep(step, onDone) {
    const g = state.g, side = g.turn;
    const r = applyStep(g, step);
    if (!r.ok) return false;
    state.hint = null; state.reveal = null;
    if (state.scene !== 'auto') state.targets = [];
    state.anim = { t: 0, slide: 0.34, pop: r.victims.length ? 0.42 : 0, from: r.step.from, to: r.step.to, side, victims: r.victims.slice(), kind: r.step.kind, popped: false, done: onDone, res: r };
    sound('tok'); dirty = true;
    return true;
  }
  function finishAnim() {
    const an = state.anim; state.anim = null; syncBoard();
    if (an.done) an.done(an.res);
    dirty = true;
  }
  function tickAnim(dt) {
    const an = state.anim; if (!an) return;
    an.t += dt;
    if (!an.popped && an.victims.length && an.t >= an.slide) {
      an.popped = true;
      const enemy = other(an.side);
      an.victims.forEach((v, i) => { burst(v, enemy); sound('take', i); });
      const q = pxy(an.to); state.floats.push({ x: q.x, y: q.y - 40, t: 0, text: `+${an.victims.length}`, c: an.kind === 'approach' ? '#ffd27a' : '#8fe6f5' });
    }
    if (an.t >= an.slide + an.pop) finishAnim();
  }

  // ---- turn flow ----------------------------------------------------------------------------------------------------------------------
  const prompt = () => {
    const g = state.g;
    if (state.mode === 'two') return `${SIDE_NAME[g.turn]} to move. ${mustCapture(g) ? 'A capture is compulsory.' : 'No capture is possible: make a quiet move.'}`;
    return mustCapture(g) ? 'Your move. You must capture: tap a stone with a gold ring.' : 'Your move. No capture is possible, so make a quiet move with any stone.';
  };
  function afterTurn() {
    const g = state.g, entry = g.log[g.log.length - 1];
    clearSel(); state.trail = trailOf(entry);
    const took = entry ? entry.steps.reduce((a, s) => a + s.victims.length, 0) : 0;
    if (took >= 3) state.banner = { text: `Capture x${took}!`, t: 0 };
    syncBoard();
    if (state.scene === 'learn') { learnTurnEnded(entry); return; }
    if (g.result) { finishGame(); return; }
    if (state.scene === 'play') {
      saveGame();
      if (state.mode === 'ai' && g.turn !== state.human) { say(took ? `You took ${took}.` : 'Quiet move.', 'info'); startThinking(); }
      else say(`${state.mode === 'ai' ? (took ? `The computer took ${took}. ` : 'The computer made a quiet move. ') : ''}${prompt()}`, 'info');
    }
  }
  function startThinking() {
    state.thinking = true; state.thinkT = 0; state.hint = null; say('The computer is thinking...', 'info');
    thinker = createThinker(state.g.board, state.g.turn, state.level, rng);
    dirty = true;
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
  function startGame(human, mode, resume) {
    if (!resume && demoBlocked(mode)) return;
    state.scene = 'play'; state.mode = mode; state.human = human; state.flip = mode === 'ai' && human === DARK;
    state.g = newGame();
    if (resume) Object.assign(state.g, { board: resume.g.board.slice(), turn: resume.g.turn, ply: resume.g.ply, quiet: resume.g.quiet, history: resume.g.history, log: resume.g.log });
    Object.assign(state, { overOpen: false, pendingOver: false, trail: null, msg: null, hint: null, anim: null, thinking: false, banner: null, hintBusy: false, apPaused: false, reveal: null, resignArm: 0 });
    clearSel(); thinker = null; hinter = null; aiQueue = []; syncBoard();
    state.trail = trailOf(state.g.log[state.g.log.length - 1]);
    if (state.g.turn !== human && mode === 'ai') { say(`${SIDE_NAME[state.g.turn]} (the computer) moves first.`, 'info'); startThinking(); }
    else say(mode === 'two' ? `Light moves first. ${prompt()}` : `You play ${SIDE_NAME[human]}. ${prompt()}`, 'info');
    monetization.track('game_start', { mode, level: state.level, side: human });
  }
  function toMenu() {
    if (state.scene === 'play') saveGame();
    clearSel(); Object.assign(state, { scene: 'title', overOpen: false, pendingOver: false, thinking: false, anim: null, msg: null, hint: null, banner: null, reveal: null, apPaused: false, hintBusy: false });
    thinker = null; hinter = null; aiQueue = []; apThinker = null; apQueue = []; state.g = newGame(); state.flip = false; syncBoard(); savePrefs();
  }

  // ---- human input -----------------------------------------------------------------------------------------------------------------------
  function select(p, steps) {
    state.sel = p; state.targets = steps; state.choice = null; state.hint = null; sound('sel');
    const caps = Math.max(...steps.map((s) => s.victims.length));
    say(caps ? 'Tap a lit point. The number is how many stones that step takes.' : 'No capture is possible: tap a point to make a quiet move.', 'info');
  }
  function commitDest(from, to) {
    const opts = legalSteps(state.g).filter((s) => s.from === from && s.to === to);
    if (!opts.length) return;
    if (opts.length > 1) {
      state.choice = { from, to, options: opts }; state.drag = null;
      say('Approach or withdraw? Tap a button, or tap the stones you want to take.', 'info');
      return;
    }
    doHumanStep(opts[0]);
  }
  function doHumanStep(step) {
    clearSel();
    playStep(step, (r) => {
      if (r.ended) { afterTurn(); return; }
      const g = state.g;
      state.sel = g.chain.pos; state.targets = legalSteps(g);
      say('Keep capturing with this stone: tap a lit point. Or tap End turn.', 'good');
    });
  }
  function refuse(text) { say(text, 'warn'); sound('refuse'); }
  function tapPoint(p) {
    if (!state.canAct) return;
    const g = state.g;
    if (state.choice) {
      const opt = state.choice.options.find((o) => o.victims.includes(p));
      if (opt) { doHumanStep(opt); return; }
      state.choice = null; say(prompt(), 'info'); return;
    }
    if (p < 0) { if (!g.chain) clearSel(); return; }
    const side = g.board[p];
    if (g.chain) {
      if (state.targets.some((s) => s.to === p)) { commitDest(g.chain.pos, p); return; }
      refuse('Keep capturing with the same stone, or tap End turn.'); return;
    }
    if (side === g.turn) {
      if (state.sel === p) { clearSel(); say(prompt(), 'info'); return; }
      const steps = legalSteps(g).filter((s) => s.from === p);
      if (!steps.length) { clearSel(); refuse(mustCapture(g) ? 'You must capture this turn. Only stones with a gold ring can move.' : 'That stone is blocked: no empty point next to it.'); return; }
      select(p, steps); return;
    }
    if (state.sel >= 0 && state.targets.some((s) => s.to === p)) { commitDest(state.sel, p); return; }
    if (state.sel >= 0) {
      if (side) refuse('That point is taken.');
      else if (mustCapture(g)) refuse('Capturing is compulsory: that step would capture nothing.');
      else refuse('A stone moves one step along a line to an empty point.');
      return;
    }
    if (side) refuse('That is an enemy stone. Tap one of your own.'); else clearSel();
  }
  function endTurn() {
    const g = state.g;
    if (!state.canAct || !g.chain) return;
    endChain(g); afterTurn();
  }
  function undo() {
    if (!state.canUndo) return;
    const g = state.g;
    thinker = null; hinter = null; state.thinking = false; state.hintBusy = false; state.hint = null; state.overOpen = false; state.pendingOver = false; clearSel();
    if (g.chain) cancelChain(g);
    else if (state.mode === 'two') undoTurn(g);
    else { do { if (!undoTurn(g)) break; } while (g.turn !== state.human); }
    syncBoard(); state.trail = trailOf(g.log[g.log.length - 1]);
    sound('ok'); say(`Turn taken back. ${prompt()}`, 'info'); saveGame();
  }
  const sameStep = (a, b) => !!b && a.from === b.from && a.to === b.to && a.kind === b.kind;
  function useHint() {
    if (!state.canAct || state.hintBusy) return;
    if (state.scene === 'learn') { learnHint(); return; }
    if (state.mode !== 'ai') { say('Think is available when you play the computer.', 'info'); return; }
    const g = state.g, board = g.chain ? g.history[g.history.length - 1].board : g.board;
    hinter = createThinker(board, g.turn, 5, rng); state.hintBusy = true; state.hint = null; say('Thinking about the best move...', 'info');
  }
  function describeTurn(steps) {
    const n = steps.reduce((a, s) => a + s.victims.length, 0);
    if (!n) return 'No capture is possible. This quiet move keeps your stones safe and your options open.';
    const kinds = steps.map((s) => s.kind);
    return `Takes ${n} stone${n > 1 ? 's' : ''}${steps.length > 1 ? `: ${kinds.join(', then ')}` : ` by ${kinds[0]}`}.`;
  }
  function hintResult(res) {
    state.hintBusy = false; const g = state.g;
    if (!res.move) { say('No move found.', 'info'); return; }
    const played = g.chain ? g.chain.steps : [];
    let pick = null;
    for (const s of (res.scored.length ? res.scored.map((x) => x.t) : [res.move])) {
      if (s.steps.length >= played.length && played.every((p, i) => sameStep(p, s.steps[i]))) { pick = s; break; }
    }
    if (!pick) { say('That chain is already past the best line. Undo this turn to see the full advice.', 'warn'); return; }
    const rest = pick.steps.slice(played.length);
    if (!rest.length) { state.hint = null; say('Best is to stop here: tap End turn.', 'good'); return; }
    state.hint = { steps: rest }; say(describeTurn(pick.steps), 'good');
  }
  function resign() {
    const g = state.g;
    if (state.scene !== 'play' || g.result || (state.mode === 'ai' && !state.canAct) || state.anim) return;
    if (state.resignArm <= 0) { state.resignArm = 3; say(state.mode === 'ai' ? 'Tap Resign again to give up this game.' : 'Tap Draw again to agree a draw.', 'warn'); return; }
    state.resignArm = 0; clearSel(); thinker = null; state.thinking = false;
    g.result = state.mode === 'ai' ? { winner: other(state.human), why: 'resign' } : { winner: 0, why: 'agreed' };
    finishGame();
  }

  // ---- learn ----------------------------------------------------------------------------------------------------------------------------------
  function startLesson(i) {
    if (config.demo && i >= 3) { state.scene = 'demo-limit'; return; }
    state.scene = 'learn'; state.lesson = { i, done: false }; state.mode = 'lesson'; state.human = LIGHT; state.flip = false;
    state.g = newGame(lessonBoard(i)); Object.assign(state, { overOpen: false, pendingOver: false, anim: null, thinking: false, hint: null, trail: null, banner: null, learnReset: 0 });
    clearSel(); aiQueue = []; syncBoard(); say(LESSONS[i].text, 'info');
  }
  function learnTurnEnded(entry) {
    const L = LESSONS[state.lesson.i];
    if (L.goal({ steps: entry.steps })) {
      state.lesson.done = true; sound('win');
      if (!state.learned.includes(state.lesson.i)) { state.learned.push(state.lesson.i); storage.set('learned', state.learned.slice()); }
      say('Well done! Tap Next for the next lesson.', 'good'); state.banner = { text: 'Well done!', t: 0 };
    } else { say(L.fail, 'warn'); sound('refuse'); state.learnReset = 1.6; }
    dirty = true;
  }
  function learnHint() {
    const L = LESSONS[state.lesson.i], g = state.g;
    const board = g.chain ? g.history[g.history.length - 1].board : g.board;
    const ok = genTurns(board, LIGHT).filter((t) => L.goal({ steps: t.steps })).sort((a, b) => b.caps - a.caps);
    if (!ok.length) return;
    const played = g.chain ? g.chain.steps : [];
    const t = ok.find((x) => played.every((p, i) => sameStep(p, x.steps[i]))) || ok[0];
    const rest = t.steps.slice(played.length);
    state.hint = rest.length ? { steps: rest } : null; say('The gold arrows show one way to do it.', 'good');
  }

  // ---- Watch & Learn ----------------------------------------------------------------------------------------------------------------------
  function startAuto() {
    state.scene = 'auto'; state.mode = 'auto'; state.flip = false; state.human = 0;
    state.g = newGame(); apRng = rng.fork();
    state.apLevels = apRng.pick([[4, 4], [5, 4], [5, 5], [4, 5]]);
    Object.assign(state, { overOpen: false, pendingOver: false, anim: null, thinking: false, hint: null, trail: null, banner: null, apPaused: false, reveal: null, msg: null });
    clearSel(); aiQueue = []; apThinker = null; apMove = undefined; apQueue = []; syncBoard();
    state.ap = { phase: 'think', timer: THINK_STEPS[state.thinkIdx] };
  }
  function describeAuto(side, steps) {
    const n = steps.reduce((a, s) => a + s.victims.length, 0);
    if (!n) return `${SIDE_NAME[side]} makes a quiet move: nothing can be captured.`;
    return `${SIDE_NAME[side]} takes ${n}: ${steps.map((s) => s.kind).join(', then ')}.`;
  }
  function autoUpdate(dt) {
    const ap = state.ap, g = state.g;
    if (g.result) { if (!state.anim && state.pendingOver && !state.overOpen) { state.overOpen = true; state.pendingOver = false; } return; }
    if (state.anim || state.overOpen) return;
    if (ap.phase === 'think') {
      if (!apThinker) { apThinker = createThinker(g.board, g.turn, state.apLevels[g.turn - 1], apRng); apMove = undefined; ap.timer = THINK_STEPS[state.thinkIdx]; say(`${SIDE_NAME[g.turn]} is thinking. Which move would you play?`, 'info'); }
      const r = apThinker.step(); if (r.move !== undefined) apMove = r.move;
      ap.timer = Math.max(0, ap.timer - dt);
      if (ap.timer <= 0 && apMove !== undefined) {
        if (!apMove) { g.result = { winner: other(g.turn), why: 'blocked' }; state.pendingOver = true; return; }
        ap.phase = 'reveal'; ap.timer = REVEAL_TIME;
        const starts = [...new Set(legalSteps(g).map((s) => s.from))];
        state.reveal = { phase: 'chosen', starts, steps: apMove.steps.map((s) => ({ from: s.from, to: s.to, kind: s.kind, victims: s.victims.slice() })) };
        state.sel = apMove.steps[0].from; state.targets = legalSteps(g).filter((s) => s.from === state.sel);
        say(describeAuto(g.turn, apMove.steps), 'good');
      }
    } else if (ap.phase === 'reveal') {
      ap.timer -= dt;
      if (ap.timer <= 0) { ap.phase = 'act'; apQueue = apMove.steps.slice(); state.reveal = null; clearSel(); apThinker = null; }
    } else if (ap.phase === 'act') {
      if (!apQueue.length) return;
      const step = apQueue.shift();
      playStep(step, (r) => {
        if (!r.ended && apQueue.length === 0) endChain(state.g);
        if (r.ended || apQueue.length === 0) {
          state.trail = trailOf(state.g.log[state.g.log.length - 1]);
          if (state.g.result) state.pendingOver = true; else { ap.phase = 'think'; apMove = undefined; }
        }
      });
    }
  }

  // ---- keyboard cursor ----------------------------------------------------------------------------------------------------------------------
  const cursorMove = (dx, dy) => {
    const r0 = (state.cursor / COLS) | 0, c0 = state.cursor % COLS;
    let sx = state.flip ? ROWS - 1 - r0 : r0, sy = state.flip ? c0 : COLS - 1 - c0;
    sx = Math.max(0, Math.min(ROWS - 1, sx + dx)); sy = Math.max(0, Math.min(COLS - 1, sy + dy));
    state.cursor = idx(state.flip ? ROWS - 1 - sx : sx, state.flip ? sy : COLS - 1 - sy);
  };

  // ---- update -----------------------------------------------------------------------------------------------------------------------------------
  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  function update(dt, input) {
    if (SHOT) input = NO_INPUT;
    state.t += dt;
    const p = input.pointer, keys = input.keys;
    state.press = p.down ? { x: p.x, y: p.y } : null;
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
      if (r.move !== undefined && state.thinkT >= 0.55) { thinker = null; state.thinking = false; if (r.move) aiQueue = r.move.steps.slice(); dirty = true; }
    }
    if (aiQueue.length && !state.anim && !frozen) {
      const step = aiQueue.shift();
      playStep(step, (r) => { if (!r.ended && aiQueue.length === 0) endChain(state.g); if (r.ended || aiQueue.length === 0) afterTurn(); });
    }
    if (hinter) { const r = hinter.step(); if (r.move !== undefined) { hinter = null; hintResult(r); } }
    if (state.scene === 'auto' && !frozen) autoUpdate(dt);
    if (state.learnReset > 0 && !state.anim) {
      state.learnReset -= dt;
      if (state.learnReset <= 0) { state.learnReset = 0; state.g = newGame(lessonBoard(state.lesson.i)); syncBoard(); clearSel(); state.trail = null; say(LESSONS[state.lesson.i].text, 'info'); }
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
          else if (c === 'Space' || c === 'Enter') { if (state.overOpen) { startGame(state.human, state.mode); break; } tapPoint(state.cursor); }
          else if (c === 'Escape') { if (state.choice) state.choice = null; else if (state.sel >= 0 && !state.g.chain) clearSel(); else toMenu(); }
          else if (c === 'KeyU') undo();
          else if (c === 'KeyH') useHint();
          else if (c === 'KeyD' && state.scene === 'play') { state.danger = !state.danger; dirty = true; savePrefs(); }
          else if (c === 'KeyE') endTurn();
        }
      } else if (k.includes('Escape')) { if (state.scene === 'auto') toMenu(); else state.scene = 'title'; }
    }

    const hit = (r) => p.pressed && inRect(r, p.x, p.y);
    switch (state.scene) {
      case 'title': {
        if (!p.pressed) break;
        const R = titleRows(!!state.saved, state.textIdx >= 3);
        if (R.resume && hit(R.resume)) { const s = state.saved; state.level = s.level; startGame(s.human, 'ai', s); }
        else if (hit(R.play)) startGame(state.humanPref, 'ai');
        else if (hit(R.two)) startGame(LIGHT, 'two');
        else if (hit(R.learn)) { const open = LESSONS.map((_, i) => i).filter((i) => !state.learned.includes(i)); startLesson(open.length ? open[0] : 0); }
        else if (hit(R.watch)) startAuto();
        else if (hit(R.settings)) state.scene = 'settings';
        else if (hit(R.level)) { state.level = (state.level % LEVEL_COUNT) + 1; savePrefs(); }
        else if (hit(R.side)) { state.humanPref = state.humanPref === LIGHT ? DARK : LIGHT; savePrefs(); }
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
          else if (i === 2) state.humanPref = state.humanPref === LIGHT ? DARK : LIGHT;
          else if (i === 3) { state.theme = THEME_ORDER[(THEME_ORDER.indexOf(state.theme) + 1) % THEME_ORDER.length]; invalidateArt(); }
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
        choiceAndBoard(p, hit);
        break;
      }
      case 'play': {
        if (state.overOpen) { resultButtons(hit); break; }
        if (hit(HDR.menu)) { toMenu(); break; }
        if (hit(HDR.sound)) { state.sound = !state.sound; audio.setMuted(!state.sound); savePrefs(); break; }
        if (hit(BTN.undo)) { undo(); break; }
        if (hit(BTN.hint)) { useHint(); break; }
        if (hit(BTN.danger)) { state.danger = !state.danger; dirty = true; savePrefs(); break; }
        if (hit(BTN.end)) { if (state.g.chain && state.canAct) endTurn(); else resign(); break; }
        choiceAndBoard(p, hit);
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
  function choiceAndBoard(p, hit) {
    if (state.choice && state.canAct) {
      if (hit(CHOICE.approach)) { const o = state.choice.options.find((x) => x.kind === 'approach'); if (o) doHumanStep(o); return; }
      if (hit(CHOICE.withdraw)) { const o = state.choice.options.find((x) => x.kind === 'withdraw'); if (o) doHumanStep(o); return; }
    }
    const d = state.drag;
    if (p.pressed && state.canAct) {
      const q = pointAt(p.x, p.y, state.flip, S * 0.46);
      state.kb = false;
      tapPoint(q);
      if (q >= 0 && state.sel === q && state.canAct && !state.g.chain) state.drag = { p: q, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
    }
    if (state.drag && p.down) { const dd = state.drag; dd.x = p.x; dd.y = p.y; if (!dd.moved && Math.hypot(p.x - dd.sx, p.y - dd.sy) > 18) dd.moved = true; }
    if (p.released && d && state.drag === d) {
      state.drag = null;
      if (d.moved) { const q = pointAt(p.x, p.y, state.flip, S * 0.5); if (q >= 0 && q !== d.p && state.targets.some((s) => s.to === q) && state.canAct) commitDest(d.p, q); }
    }
  }

  // ---- store screenshots -----------------------------------------------------------------------------------------------------------
  // `tools/arc shots` loads the page with ?shot=1&seed=N and a random "monkey" player. For seeds 101..106 the game instead
  // stages a real, readable moment (below) and ignores the monkey's input. Never active in the app or in the demo.
  function playOpening(plies, wantChoice) {
    state.g = newGame();
    for (let i = 0; i < plies || (wantChoice && state.g.turn !== LIGHT); i++) {
      const t = bestTurn(state.g.board, state.g.turn, 2, rng);
      if (!t) break;
      for (const st of t.steps) applyStep(state.g, st);
      if (state.g.chain) endChain(state.g);
    }
  }
  function stageShot(n) {
    if (n === 104) { startAuto(); return; }
    if (n === 105) { state.scene = 'rules'; state.page = 26; return; }
    if (n === 106) { startLesson(2); state.sel = -1; learnHint(); return; }
    startGame(LIGHT, 'ai');
    for (let attempt = 0; attempt < 200; attempt++) {
      playOpening(4 + 2 * (attempt % 5), false);
      const g = state.g, steps = legalSteps(g);
      if (countOf(g.board, LIGHT) < 12 || countOf(g.board, DARK) < 12) continue;
      if (n === 102) { if (Math.max(...steps.map((x) => x.victims.length)) >= 3) break; }
      else { const seen = new Set(); let found = false; for (const x of steps) { const k = `${x.from}-${x.to}`; if (seen.has(k) && x.victims.length) found = true; seen.add(k); } if (found) break; }
    }
    state.mode = 'ai'; state.human = LIGHT; state.thinking = false; thinker = null; aiQueue = [];
    syncBoard(); state.trail = trailOf(state.g.log[state.g.log.length - 1]); state.danger = n === 102;
    const g = state.g;
    if (n === 102) { const steps = legalSteps(g); const best = Math.max(...steps.map((x) => x.victims.length)); const pick = steps.find((x) => x.victims.length === best); select(pick.from, steps.filter((x) => x.from === pick.from)); }
    else { const dup = legalSteps(g).filter((x) => x.victims.length); const seen = new Set(); let two = null; for (const x of dup) { const k = `${x.from}-${x.to}`; if (seen.has(k)) { two = x; break; } seen.add(k); } if (two) { select(two.from, legalSteps(g).filter((x) => x.from === two.from)); commitDest(two.from, two.to); } }
    dirty = true;
  }
  const SHOT = /(^|[?&])shot=/.test(globalThis.location?.search || '') && !config.demo && config.seed >= 101 && config.seed <= 106;
  if (SHOT) stageShot(config.seed);

  return {
    update,
    render(ctx) { render(ctx, state); },
    // Watch & Learn, the menus and the reading pages are free; only real play and lessons use up the preview time.
    isPreviewExempt: () => state.scene !== 'play' && state.scene !== 'learn',
    getState() {
      const { g, anim, ...rest } = state;
      return { ...rest, anim: anim ? { t: anim.t, from: anim.from, to: anim.to } : null, g: { board: g.board.slice(), turn: g.turn, ply: g.ply, quiet: g.quiet, chain: g.chain ? { pos: g.chain.pos, taken: g.chain.taken } : null, turns: g.log.length, result: g.result } };
    },
  };
}
