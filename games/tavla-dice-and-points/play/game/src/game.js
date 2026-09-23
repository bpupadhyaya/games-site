// Tavla (backgammon): state and flow. Drawing is in view.js; the rule book is rules.js; the computer's brain is ai.js;
// lessons.js and puzzles.js are content. See design/ARCHITECTURE.md for the whole map.
//
// Making a move: TAP a checker (its legal points glow), then TAP a point; or DRAG the checker and drop it. A move that is not
// allowed visibly tries, shudders and comes back, and a plain-language reason is shown (rules.whyNot).
import { W, H, BTN, DICE, CUBE, CUBE_ASK, DONE, PANEL, PBACK, SET_ROWS, TRAY, inRect, targetAt, stackPos, barPos, offPos, titleRows, OVER, TEXT_SCALES, TEXT_BTN } from './layout.js';
import { BAR, OFF, newGame, clone, expandRoll, beginTurn, legalSteps, playStep, turnCopy, whyNot, isOver, winner, resultValue, key, own, pips } from './rules.js';
import { LEVELS, createThinker, cubeOffer, cubeTake, reasonFor, SLICE } from './ai.js';
import { LESSONS, setup, ptOf } from './lessons.js';
import { createPuzzleMaker } from './puzzles.js';
import { render, REST } from './view.js';
import { SET_NAMES } from './sprites.js';
import { ABOUT, HOWTO, RULES } from './text.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, DEMO_LESSONS = 3, HINTS = 3;
const SETS = Object.keys(SET_NAMES);

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, phase: 'idle', g: newGame(), two: false, level: 2, gammon: true, cube: { on: false, v: 1, owner: -1 },
    sound: true, calm: false, big: false, set: 'classic', auto: true,
    textScaleIdx: 0, // index into TEXT_SCALES; the About/How to play/Rules reader pages' text size
    dice: { vals: null, side: 0, roll: null }, left: null, sel: -1, dests: [], sources: [], anim: null, drag: null, hint: null, msg: null,
    status: '', canUndo: false, canDouble: false, hintsLeft: HINTS, thinking: false, cursor: null, cursorOn: false, kbi: 0,
    cubeAsk: null, result: null, stats: { games: 0, wins: 0 }, saved: null, learned: false, demoGames: 0, page: 0,
    lesson: null, pz: null, daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 }, q: [], think: 0, endT: 0, autoT: 0,
    dev: config.dev === true, shot: false,
  };
  let turn = null, undo = [], thinker = null, hintThinker = null, forced = null, sfx = [], press = null, noAuto = false, puzzleToday = null, lastKb = 0;
  const maker = createPuzzleMaker(state.daily.day);

  // ---- saving ---------------------------------------------------------------------------------------------------------
  const savePrefs = () => storage.set('prefs', { level: state.level, gammon: state.gammon, cubeOn: state.cube.on, sound: state.sound, calm: state.calm, big: state.big, set: state.set, auto: state.auto, textScaleIdx: state.textScaleIdx });
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.games, wins: state.stats.wins }); };
  const saveGame = () => { if (state.scene === 'play' && !isOver(state.g)) { state.saved = { g: clone(state.g), two: state.two, level: state.level, gammon: state.gammon, cube: { ...state.cube }, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };
  storage.get('prefs', null).then((v) => { if (!v) return; state.level = v.level ?? 2; state.gammon = v.gammon ?? true; state.cube.on = v.cubeOn ?? false; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.big = v.big ?? false; state.set = SETS.includes(v.set) ? v.set : 'classic'; state.auto = v.auto ?? true; state.textScaleIdx = Math.min(Math.max(v.textScaleIdx ?? (v.big ? 1 : 0), 0), TEXT_SCALES.length - 1); audio.setMuted?.(!state.sound); });
  storage.get('stats', null).then((v) => { if (v) state.stats = { games: v.games ?? 0, wins: v.wins ?? 0 }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.g && !isOver(v.g) && state.scene === 'title') state.saved = v; });

  // ---- small helpers ----------------------------------------------------------------------------------------------------
  const dur = (d) => (state.calm ? d * 0.55 : d);
  const say = (text, hold = 5) => { state.msg = { text, t: 0, hold }; };
  const later = (at, o) => sfx.push({ at: state.t + at, o });
  const tone = (o) => { if (state.sound) audio.tone(o); };
  const clack = (f = 1, v = 0.16) => { tone({ freq: 420 * f, to: 130 * f, dur: 0.07, type: 'sine', vol: v }); tone({ freq: 2100 * f, to: 700, dur: 0.025, type: 'square', vol: 0.035 }); };
  const rattle = () => { const n = state.calm ? 3 : 9; for (let i = 0; i < n; i++) later(i * (state.calm ? 0.09 : 0.085), { freq: 600 + ((i * 397) % 5) * 130, to: 260, dur: 0.045, type: 'square', vol: 0.045 }); later(dur(0.9), { freq: 300, to: 110, dur: 0.09, type: 'sine', vol: 0.18 }); later(dur(0.9) + 0.06, { freq: 260, to: 100, dur: 0.07, type: 'sine', vol: 0.14 }); };
  const humanSide = (s) => state.scene !== 'play' || state.two || s === 0;
  const opp = (s) => 1 - s;
  const sideName = (s) => (state.two ? `Player ${s + 1}` : s === 0 ? 'You' : 'The rival');

  // ---- starting things --------------------------------------------------------------------------------------------------
  function resetPlay() {
    thinker = hintThinker = null; undo = []; forced = null; noAuto = false;
    Object.assign(state, { q: [], anim: null, drag: null, hint: null, sel: -1, dests: [], sources: [], dice: { vals: null, side: 0, roll: null }, left: null, canUndo: false, canDouble: false, cubeAsk: null, result: null, msg: null, status: '', thinking: false, cursorOn: false, endT: 0, autoT: 0, think: 0 });
    turn = null;
  }
  function start(two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    resetPlay(); Object.assign(state, { scene: 'play', two, g: newGame(), hintsLeft: HINTS });
    state.cube = { on: state.cube.on, v: 1, owner: -1 };
    // the opening roll: each side throws one die, the higher plays both dice as the first move
    let a, b; do { a = rng.int(6) + 1; b = rng.int(6) + 1; } while (a === b);
    state.g.turn = a > b ? 0 : 1; forced = a > b ? [a, b] : [b, a];
    say(`Opening roll: ${sideName(0)} ${a}, ${sideName(1).toLowerCase()} ${b}. ${sideName(state.g.turn)} ${state.g.turn === 0 && !two ? 'play' : 'plays'} ${Math.max(a, b)}-${Math.min(a, b)} first.`, 6);
    monetization.track('game_start', { level: state.level, two, cube: state.cube.on });
    beginSide(true);
  }
  function resume() {
    const v = state.saved; resetPlay();
    Object.assign(state, { scene: 'play', two: v.two, level: v.level ?? state.level, gammon: v.gammon ?? true, g: clone(v.g), cube: { ...v.cube }, hintsLeft: v.hintsLeft ?? HINTS });
    say('Game restored.'); beginSide(false);
  }
  function startLesson(i) {
    if (config.demo && i >= DEMO_LESSONS) { state.scene = 'demo-limit'; return; }
    const l = LESSONS[i]; resetPlay();
    Object.assign(state, { scene: 'lesson', two: true, g: setup(l, newGame()), lesson: { i, done: false }, hintsLeft: 99 });
    state.cube = { on: false, v: 1, owner: -1 };
    forced = l.dice; state.msg = null;
    beginSide(false, true);
  }
  function startPuzzle() {
    resetPlay(); const P = state.pz?.tries ?? 0;
    if (!puzzleToday) { Object.assign(state, { scene: 'puzzle', g: newGame(), two: true, pz: { status: 'making', puzzle: null, tries: P } }); state.status = 'Setting up today’s puzzle…'; return; }
    const pz = puzzleToday;
    Object.assign(state, { scene: 'puzzle', two: true, g: clone(pz.pos), pz: { status: state.daily.solvedDay === state.daily.day ? 'solved' : 'ready', puzzle: pz, tries: P } });
    state.cube = { on: false, v: 1, owner: -1 };
    forced = pz.roll; state.g.turn = 0;
    state.status = `Find the best play for ${pz.roll[0]}-${pz.roll[1]}. Each roll has one clearly best play: TAP the dice to throw.`;
    state.phase = 'roll'; state.dice = { vals: null, side: 0, roll: null };
    if (state.pz.status === 'solved') say('Already solved today. Play it again for practice, or come back tomorrow.', 6);
  }
  function toTitle() { if (state.scene === 'play') saveGame(); resetPlay(); state.scene = 'title'; }

  // ---- the turn machine ----------------------------------------------------------------------------------------------------
  // beginSide: it is g.turn's move. `opening` = the dice are already decided (opening roll).
  function beginSide(opening, lesson = false) {
    const s = state.g.turn; state.sel = -1; state.dests = []; state.sources = []; state.hint = null; undo = []; state.canUndo = false; state.q = []; noAuto = false;
    state.dice = { vals: null, side: s, roll: null }; state.left = null; state.status = '';
    if (state.scene === 'play' && humanSide(s) && !opening) saveGame();
    if (humanSide(s)) {
      state.phase = 'roll';
      state.canDouble = state.scene === 'play' && !opening && state.cube.on && state.cube.v < 64 && (state.cube.owner === -1 || state.cube.owner === s);
      if (!lesson && state.scene === 'play') state.status = state.two ? `${sideName(s)}: TAP the dice to roll.` : 'Your turn: TAP the dice to roll.';
      if (lesson && !LESSONS[state.lesson.i].rollFirst) roll();   // only the first lesson asks for the roll
      if (opening) roll();
    } else {
      state.phase = 'cpu'; state.think = opening ? 0.9 : 0.6; state.status = 'The rival is thinking…';
    }
  }
  function roll() {
    const s = state.g.turn;
    const vals = forced ? forced.slice() : [rng.int(6) + 1, rng.int(6) + 1];
    if (!forced || state.scene === 'play') forced = null;
    if (state.scene === 'lesson' || state.scene === 'puzzle') forced = null;
    state.dice = { vals, side: s, roll: { t: 0, dur: dur(0.95) } }; state.phase = 'rolling'; state.canDouble = false; state.status = ''; state.hint = null;
    rattle();
    if (state.scene === 'lesson') { state.lessonVals = vals; }
    if (state.scene === 'puzzle') state.pzRoll = vals;
    state.lastRoll = vals;
  }
  function afterRoll() {
    const s = state.g.turn, vals = state.dice.vals;
    turn = beginTurn(state.g, s, expandRoll(vals)); state.left = turn.dice.slice();
    if (humanSide(s)) { state.phase = 'move'; state.status = ''; refreshMoves(); }
    else if (turn.total === 0) { state.phase = 'cpuPass'; state.endT = 1.1; say('The rival has no legal move.', 2); }
    else { state.phase = 'cpuThink'; state.thinking = true; thinker = createThinker(state.g, s, turn.dice, state.level, rng); }
  }
  // work out what can be tapped now
  function refreshMoves() {
    const s = state.g.turn;
    let legal = legalSteps(state.g, s, turn);
    if (state.scene === 'lesson') { const l = LESSONS[state.lesson.i]; if (l.only) legal = legal.filter((st) => l.only.some(([f, t]) => ptOf(st.from) === f && ptOf(st.to) === t)); }
    state.legal = legal;
    state.sources = [...new Set(legal.map((x) => x.from))];
    if (state.sel !== -1 && !state.sources.includes(state.sel)) state.sel = -1;
    if (state.sel === -1 && state.sources.length === 1 && state.g.bar[s] > 0) state.sel = BAR;             // a checker on the bar must move: select it
    state.dests = state.sel === -1 ? [] : legal.filter((x) => x.from === state.sel).map((x) => ({ from: x.from, to: x.to, die: x.die }));
    state.left = turn.dice.slice(); state.canUndo = undo.length > 0;
    if (!legal.length) {
      state.phase = 'end'; state.endT = 0.75; state.sel = -1;
      if (turn.used === 0 && state.scene !== 'lesson') say(state.scene === 'puzzle' ? 'No legal move.' : `${sideName(s)} ${humanSide(s) && !state.two ? 'have' : 'has'} no legal move with this roll. The turn passes.`, 2.5);
    } else state.phase = 'move';
  }

  // play one step with an animation
  function step(s, st, from) {
    const g = state.g, n0 = st.from === BAR ? g.bar[s] : own(g, s, st.from);
    const fromPos = from ?? (st.from === BAR ? barPos(s, n0 - 1, n0) : stackPos(st.from, n0 - 1, n0));
    let m = 0, toPos;
    if (st.to === OFF) toPos = offPos(s, g.off[s]);
    else { m = st.hit ? 0 : Math.max(0, own(g, s, st.to)); toPos = stackPos(st.to, m, m + 1); }
    const a = { side: s, kind: 'move', from: fromPos, to: toPos, t: 0, dur: dur(st.to === OFF ? 0.36 : 0.3), hide: { kind: st.to === OFF ? 'off' : 'pt', idx: st.to, side: s }, hit: null, ghost: null, hitDur: 0 };
    if (st.hit) {
      const vb = g.bar[opp(s)];
      a.hit = { side: opp(s), from: stackPos(st.to, 0, 1), to: barPos(opp(s), vb, vb + 1) }; a.hitDur = dur(0.4); a.ghost = { side: opp(s), pos: stackPos(st.to, 0, 1) };
    }
    playStep(g, s, turn, st);
    state.anim = a; state.sel = -1; state.dests = []; state.hint = null; state.left = turn.dice.slice();
    later(dur(0.24), null);
    if (st.to === OFF) { clack(1.5); } else clack(st.hit ? 0.8 : 1);
    if (st.hit) later(dur(0.3), { freq: 160, to: 70, dur: 0.16, type: 'triangle', vol: 0.16 });
    if (state.scene === 'lesson' && humanSide(s)) lessonStep(st);
  }
  function humanStep(st, from) { undo.push({ g: clone(state.g), turn: turnCopy(turn) }); noAuto = false; step(state.g.turn, st, from); }

  function onAnimDone(a) {
    state.anim = null;
    const g = state.g;
    if (isOver(g)) { if (state.scene === 'play') finish(); else if (state.scene === 'lesson') refreshMoves(); return; }
    if (state.q.length) return;
    if (state.phase === 'move') refreshMoves();
    else if (state.phase === 'cpuMove') { finishTurn(); }
  }
  function finishTurn() {
    if (state.scene === 'lesson') { lessonTurnEnd(); return; }
    if (state.scene === 'puzzle') { puzzleTurnEnd(); return; }
    state.g.turn = opp(state.g.turn); state.g.moves += 0; beginSide(false);
  }

  // computer chooses and plays
  function cpuThinkTick() {
    if (!thinker) return;
    const r = thinker.step();
    if (!r.done) return;
    thinker = null; state.thinking = false;
    if (!r.cand) { state.phase = 'cpuPass'; state.endT = 0.8; return; }
    state.q = r.cand.steps.slice(); state.phase = 'cpuMove'; state.cpuWhy = null;
    { const v = state.dice.vals, hits = r.cand.steps.filter((x) => x.hit).length; say(`The rival rolled ${v[0]}-${v[1]}${hits ? ' and hit ' + (hits > 1 ? 'two of your checkers.' : 'your checker!') : '.'}`, 4); }
  }
  function cpuCube() {
    const s = state.g.turn;
    if (state.cube.on && state.scene === 'play' && !state.two && state.cube.v < 64 && (state.cube.owner === -1 || state.cube.owner === 1) && cubeOffer(state.g, 1) && state.level >= 1) {
      state.cubeAsk = { title: 'The rival doubles', body: `Doubling makes this game worth ${state.cube.v * 2} points instead of ${state.cube.v}. Take: play on, and you own the cube. Drop: give up the game and the rival scores ${state.cube.v}.`, by: 1 };
      state.phase = 'cubeask'; return true;
    }
    void s; return false;
  }
  function offerDouble() {
    const s = state.g.turn;
    if (state.two) {
      state.cubeAsk = { title: `${sideName(s)} doubles`, body: `The game would be worth ${state.cube.v * 2} points. ${sideName(opp(s))}: Take to play on and own the cube, or Drop to give up the game (${sideName(s)} scores ${state.cube.v}).`, by: s };
      state.phase = 'cubeask'; return;
    }
    if (cubeTake(state.g, 1)) { state.cube.v *= 2; state.cube.owner = 1; say(`The rival takes. The game is worth ${state.cube.v} points and the rival owns the cube.`, 5); tone({ freq: 500, to: 700, dur: 0.15, type: 'triangle', vol: 0.1 }); }
    else { say('The rival drops. You win this game.', 4); endByDrop(0); }
  }
  function endByDrop(w) { state.g.off[w] = 15; finishResult(w, state.cube.v, false, 'dropped'); }
  function cubeAnswer(take) {
    const A = state.cubeAsk, by = A.by; state.cubeAsk = null;
    if (take) { state.cube.v *= 2; state.cube.owner = opp(by); say(`Taken. The game is now worth ${state.cube.v} points.`, 4); state.phase = by === 1 ? 'cpu' : 'roll'; if (by === 1) { state.think = 0.3; state.cubeDone = true; } else state.canDouble = false; }
    else endByDrop(by);
  }

  // ---- game end -------------------------------------------------------------------------------------------------------------
  function finish() { const w = winner(state.g), gv = resultValue(state.g, w, state.gammon); finishResult(w, gv * state.cube.v, gv > 1, gv === 3 ? 'backgammon' : gv === 2 ? 'gammon' : 'single'); }
  function finishResult(w, points, big, kind) {
    const vsCpu = !state.two;
    state.scene = 'over'; state.phase = 'over'; state.thinking = false; state.q = []; state.anim = null; state.dests = []; state.sources = [];
    const name = vsCpu ? (w === 0 ? 'You win' : 'The rival wins') : `Player ${w + 1} wins`;
    state.result = {
      title: name + '!',
      body: `${kind === 'dropped' ? 'The double was dropped. ' : kind === 'gammon' ? 'A gammon: the loser had borne off no checker. ' : kind === 'backgammon' ? 'A backgammon: the loser still had a checker on the bar or in the winner’s home. ' : ''}${points} point${points === 1 ? '' : 's'}${state.cube.v > 1 && kind !== 'dropped' ? ` (cube ${state.cube.v})` : ''}.`,
      w, points,
    };
    if (vsCpu) { state.stats.games += 1; if (w === 0) state.stats.wins += 1; saveStats(); }
    clearSave(); tone({ freq: w === 0 || !vsCpu ? 523 : 330, to: w === 0 || !vsCpu ? 784 : 262, dur: 0.45, type: 'triangle', vol: 0.1 });
    monetization.track('game_end', { winner: w, points, level: state.level });
  }

  // ---- lessons --------------------------------------------------------------------------------------------------------------
  function lessonDone() { const L = state.lesson; if (L.done) return; L.done = true; state.msg = null; state.phase = 'lessondone'; state.sel = -1; state.dests = []; state.sources = []; tone({ freq: 660, to: 990, dur: 0.22, type: 'triangle', vol: 0.09 }); }
  function lessonStep(st) {
    const l = LESSONS[state.lesson.i], g = state.g;
    let ok = false;
    if (l.want === 'move') ok = true;
    else if (l.want === 'to') ok = l.at.includes(st.to + 1);
    else if (l.want === 'hit') ok = st.hit;
    else if (l.want === 'enter') ok = st.from === BAR;
    else if (l.want === 'off') ok = g.off[0] + 0 >= 0 && false;
    if (ok) state.lessonWant = true; state.lessonOkPending = ok;
  }
  function lessonAfterAnim() {
    const l = LESSONS[state.lesson.i], g = state.g;
    if (state.lessonOkPending) { state.lessonOkPending = false; lessonDone(); return true; }
    if (l.want === 'off' && g.off[0] >= l.count) { lessonDone(); return true; }
    if (l.want === 'all' && turn.dice.length === 0 && (!l.end || l.end(g))) { lessonDone(); return true; }
    return false;
  }
  function lessonTurnEnd() {
    const l = LESSONS[state.lesson.i];
    if (state.lesson.done) return;
    say(l.want === 'all' && l.end ? 'Not quite. ' + (l.hint || 'Read the lesson and try again.') : 'That is not the move for this lesson. ' + (l.hint || 'Read the line above and try again.'), 5);
    const i = state.lesson.i; const keep = state.msg; startLesson(i); state.msg = keep;
  }

  // ---- puzzle ---------------------------------------------------------------------------------------------------------------
  function puzzleTurnEnd() {
    const P = state.pz;
    if (key(state.g) === P.puzzle.best) {
      P.status = 'solved'; state.phase = 'solved'; state.sel = -1; state.dests = []; state.sources = [];
      if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); }
      state.status = ''; say(`Solved! ${P.puzzle.why}`, 30); tone({ freq: 523, to: 1046, dur: 0.4, type: 'triangle', vol: 0.09 });
    } else {
      P.tries += 1; state.phase = 'wrong'; state.endT = 3.4; say(P.tries >= 2 ? `Not the best play. Clue: ${P.puzzle.why} The position is set up again.` : 'Not the best play. Think about safety, hitting and making points. The position is set up again.', 4);
    }
  }
  function resetPuzzle() { const P = state.pz; if (!P || !P.puzzle) return; const keep = P.tries; startPuzzle(); state.pz.tries = keep; if (state.pz.status !== 'solved') say('Set up again. Tap the dice to throw the same roll.', 4); }

  // ---- interaction on the board ----------------------------------------------------------------------------------------------
  const topPos = (idx, s = 0) => (idx === BAR ? barPos(s, Math.max(0, state.g.bar[s] - 1), Math.max(1, state.g.bar[s])) : stackPos(idx, Math.max(0, Math.abs(state.g.board[idx]) - 1), Math.max(1, Math.abs(state.g.board[idx]))));
  function findPath(from, to) {
    const s = state.g.turn;
    const dfs = (g, tn, cur, depth) => {
      for (const st of legalSteps(g, s, tn).filter((x) => x.from === cur)) {
        if (st.to === to) return [st];
        if (st.to < 24 && depth < 3) { const n = clone(g), t2 = turnCopy(tn); playStep(n, s, t2, st); const r = dfs(n, t2, st.to, depth + 1); if (r) return [st].concat(r); }
      }
      return null;
    };
    return dfs(state.g, turn, from, 0);
  }
  function refuse(from, target, why) {
    const s = state.g.turn, fp = topPos(from, s);
    const n = target === OFF ? 0 : Math.abs(state.g.board[target] || 0), tp = target === OFF ? { x: 360, y: TRAY.me.y + 20 } : stackPos(target, n, n + 1);
    state.anim = { side: s, kind: 'refuse', from: fp, to: tp, t: 0, dur: dur(0.62), hide: from === BAR ? { kind: 'bar' } : { kind: 'pt', idx: from, side: s }, hit: null, ghost: null, hitDur: 0 };
    say(why, 6); tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.08 });
    if (state.scene === 'lesson') { const l = LESSONS[state.lesson.i]; if (l.want === 'refused' && l.at.includes(target + 1)) { state.lessonOkPending = true; } }
  }
  // chosen destination t for the selected source (or a drop)
  function tapDest(t, from) {
    const s = state.g.turn, legal = state.legal || [];
    const cands = legal.filter((x) => x.from === state.sel && x.to === t);
    if (cands.length) { cands.sort((a, b) => a.die - b.die); humanStep(cands[0], from); return true; }
    const l = state.scene === 'lesson' ? LESSONS[state.lesson.i] : null;
    const path = l && l.only ? null : findPath(state.sel, t);
    if (path && path.length > 1) { const first = path[0]; state.q = path.slice(1); state.pathMode = true; humanStep(first, from); return true; }
    if (l && l.only && legalSteps(state.g, s, turn).some((x) => x.from === state.sel && x.to === t)) { refuse(state.sel, t, l.hint || 'That move is allowed in the game but not for this lesson. Follow the instruction above.'); return false; }
    refuse(state.sel, t, whyNot(state.g, s, turn, state.sel, t)); return false;
  }
  function tapTarget(t, from) {
    const s = state.g.turn;
    if (t < 0) { state.sel = -1; state.dests = []; return; }
    if (state.sel !== -1) {
      if (t === state.sel) { state.sel = -1; state.dests = []; return; }
      if (state.sources.includes(t) && t !== OFF && !state.dests.some((d) => d.to === t)) { state.sel = t; refreshDests(); clack(1.4, 0.06); return; }
      tapDest(t, from); return;
    }
    if (state.sources.includes(t)) { state.sel = t; refreshDests(); clack(1.4, 0.06); return; }
    if (t === OFF) { say('Tap one of your checkers first, then tap the tray to bear it off.'); return; }
    if (t !== BAR && own(state.g, s, t) > 0) {
      const why = state.g.bar[s] > 0 ? 'A checker of yours is on the bar. It must enter the board before anything else moves.' : `That checker cannot move with your dice (${turn.dice.join(' and ')}): the points ahead are blocked or off the board.`;
      refuse(t, t, why); return;
    }
    if (t === BAR && state.g.bar[s] === 0) return;
    say('TAP one of your glowing checkers first, then TAP the point where it should go.');
  }
  function refreshDests() { state.dests = (state.legal || []).filter((x) => x.from === state.sel).map((x) => ({ from: x.from, to: x.to, die: x.die })); }
  function doUndo() {
    if (!undo.length) { say('Nothing to take back yet.', 2); return; }
    const e = undo.pop(); state.g = e.g; turn = e.turn; state.anim = null; state.q = []; state.sel = -1; state.drag = null; state.hint = null; noAuto = true; state.lessonOkPending = false;
    if (state.scene === 'lesson' && state.lesson.done) { state.lesson.done = false; }
    state.phase = 'move'; refreshMoves(); say('Move taken back.', 2); clack(0.9, 0.08);
  }
  function doHint() {
    if (state.phase !== 'move') { say(state.phase === 'roll' ? 'Roll the dice first: TAP the dice.' : 'Wait for the current move to finish.', 2.5); return; }
    if (state.scene === 'lesson') {
      const l = LESSONS[state.lesson.i], st = (state.legal || [])[0];
      if (l.only) { const m = state.legal.find((x) => true); if (m) state.hint = { from: m.from, to: m.to, t: 0 }; }
      say(l.hint || l.text, 6); return;
    }
    if (state.scene === 'puzzle') return;
    if (state.hintsLeft <= 0) { say('No hints left in this game.', 2.5); return; }
    state.hintsLeft -= 1; state.thinking = true; hintThinker = createThinker(state.g, state.g.turn, turn.dice, 3, rng); state.sel = -1; state.dests = [];
  }

  // The board input: press/drag/release. A tap on release is a tap; moving more than a few pixels while holding starts a drag.
  function boardInput(p) {
    if (p.pressed) {
      const tg = targetAt(p.x, p.y); state.cursorOn = false;
      press = { x: p.x, y: p.y, target: tg, src: (tg !== -1 && tg !== OFF && state.sources.includes(tg)) ? tg : null };
    }
    if (press && p.down && !p.released && press.src != null && !state.drag) {
      if (Math.hypot(p.x - press.x, p.y - press.y) > 12) { state.drag = { on: true, from: press.src, x: p.x, y: p.y }; state.sel = press.src; refreshDests(); }
    }
    if (state.drag && state.drag.on) { state.drag.x = p.x; state.drag.y = p.y; }
    if (p.released && press) {
      const pr = press; press = null;
      if (state.drag && state.drag.on) {
        const d = state.drag, t = targetAt(p.x, p.y); state.drag = null;
        if (t === d.from || t === -1) { state.sel = t === d.from ? d.from : -1; if (state.sel === -1) state.dests = []; return; }
        state.sel = d.from; refreshDests();
        const cands = (state.legal || []).filter((x) => x.from === d.from && x.to === t);
        if (cands.length) { cands.sort((a, b) => a.die - b.die); humanStep(cands[0], { x: p.x, y: p.y }); return; }
        tapDest(t, { x: p.x, y: p.y }); return;
      }
      tapTarget(pr.target, null);
    }
  }
  // Keyboard: Left/Right (or Up/Down) cycle through what can be chosen, Enter/Space chooses, Escape steps back, U undo, H hint.
  function keyboard(k) {
    if (k.has('KeyU')) { doUndo(); return; }
    if (k.has('KeyH')) { doHint(); return; }
    if (state.phase === 'roll') { if (k.has('Space') || k.has('Enter')) roll(); return; }
    if (state.phase === 'cubeask') { if (k.has('KeyT') || k.has('Enter')) cubeAnswer(true); else if (k.has('KeyD')) cubeAnswer(false); return; }
    if (state.phase !== 'move' || state.anim) return;
    const list = state.sel === -1 ? state.sources : state.dests.map((d) => d.to);
    if (k.has('Escape')) { state.sel = -1; state.dests = []; state.cursorOn = false; return; }
    if (!list.length) return;
    const move = (k.has('ArrowRight') || k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowLeft') || k.has('ArrowUp') ? 1 : 0);
    if (move) { state.kbi = (state.kbi + move + list.length * 4) % list.length; state.cursorOn = true; state.cursor = list[state.kbi % list.length]; return; }
    if (k.has('Enter') || k.has('Space')) {
      state.cursorOn = true; state.kbi = Math.min(state.kbi, list.length - 1); const t = list[state.kbi];
      tapTarget(t, null); state.kbi = 0; state.cursor = (state.sel === -1 ? state.sources : state.dests.map((d) => d.to))[0] ?? null;
    }
  }

  // ---- per-scene updates -------------------------------------------------------------------------------------------------------
  function updateTitle(tap) {
    for (let k = 0; k < 4 && !puzzleToday; k++) puzzleToday = maker.step().puzzle;
    if (!tap) return;
    const Rr = titleRows(!!state.saved), hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(Rr.resume)) resume();
    else if (hit(Rr.play)) start(false);
    else if (hit(Rr.learn)) startLesson(state.learned ? 0 : 0);
    else if (hit(Rr.two)) start(true);
    else if (hit(Rr.daily)) startPuzzle();
    else if (hit(Rr.level)) { state.level = (state.level + 1) % LEVELS.length; savePrefs(); clack(); }
    else if (hit(Rr.cube)) { state.cube.on = !state.cube.on; savePrefs(); clack(); }
    else if (hit(Rr.gammon)) { state.gammon = !state.gammon; savePrefs(); clack(); }
    else if (hit(Rr.settings)) state.scene = 'settings';
    else if (hit(Rr.howto)) { state.scene = 'howto'; state.page = 0; }
    else if (hit(Rr.about)) { state.scene = 'about'; state.page = 0; }
    else if (hit(Rr.rules)) { state.scene = 'rules'; state.page = 0; }
  }
  const DOC_LIST = { howto: HOWTO, about: ABOUT, rules: RULES };
  function updateDoc(tap) {
    if (!tap) return;
    // Text-size stepper: an index into TEXT_SCALES, clamped at both ends, same on every doc page.
    if (inRect(TEXT_BTN.dec, tap.x, tap.y)) { if (state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); clack(); } return; }
    if (inRect(TEXT_BTN.inc, tap.x, tap.y)) { if (state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); clack(); } return; }
    if (inRect(PBACK, tap.x, tap.y)) { state.scene = 'title'; return; }
    const list = DOC_LIST[state.scene];
    if (list && list.length > 1 && inRect({ x: 140, y: 1330, w: 440, h: 70 }, tap.x, tap.y)) state.page = (state.page + 1) % list.length;
  }
  function updateSettings(tap) {
    if (!tap) return;
    const hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(SET_ROWS.sound)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); clack(); }
    else if (hit(SET_ROWS.calm)) state.calm = !state.calm;
    else if (hit(SET_ROWS.big)) state.big = !state.big;
    else if (hit(SET_ROWS.set)) state.set = SETS[(SETS.indexOf(state.set) + 1) % SETS.length];
    else if (hit(SET_ROWS.auto)) state.auto = !state.auto;
    else if (hit(PBACK)) state.scene = 'title';
    savePrefs();
  }

  function updateBoard(dt, input, tap) {
    const p = input.pointer, ph = state.phase;
    // the message and dice-roll clocks
    if (state.dice.roll) { state.dice.roll.t += dt; }
    if (state.anim) {
      state.anim.t += dt;
      if (state.anim.t >= state.anim.dur + (state.anim.hit ? state.anim.hitDur : 0)) { const a = state.anim; onAnimDone(a); if (state.scene === 'lesson' && lessonAfterAnim()) return; }
    }
    // buttons (they work in every phase where they make sense)
    if (tap) {
      if (state.scene === 'over') {
        if (inRect(OVER.again, tap.x, tap.y)) start(state.two);
        else if (inRect(OVER.menu, tap.x, tap.y)) { state.scene = 'title'; state.phase = 'idle'; }
        else if (inRect(OVER.share, tap.x, tap.y)) env.share(`Tavla: ${state.result.title} ${state.result.body}`);
        return;
      }
      if (ph === 'cubeask') {
        if (inRect(CUBE_ASK.take, tap.x, tap.y)) cubeAnswer(true); else if (inRect(CUBE_ASK.drop, tap.x, tap.y)) cubeAnswer(false);
        return;
      }
      if (state.scene === 'lesson' && state.lesson.done && inRect(DONE, tap.x, tap.y)) {
        const i = state.lesson.i;
        if (i + 1 < LESSONS.length) startLesson(i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try the Beginner level for your first game.', 7); }
        return;
      }
      if (state.scene === 'puzzle' && state.pz.status === 'solved' && inRect(DONE, tap.x, tap.y)) { state.scene = 'title'; return; }
      if (inRect(BTN.menu, tap.x, tap.y)) { toTitle(); return; }
      if (inRect(BTN.undo, tap.x, tap.y) && (ph === 'move' || ph === 'end') && !state.anim) { doUndo(); return; }
      if (inRect(BTN.hint, tap.x, tap.y)) { if (state.scene === 'puzzle') resetPuzzle(); else doHint(); return; }
    }
    if (state.scene === 'lesson' && state.lesson.done) return;
    if (input.keys.pressed.size) { const k = input.keys.pressed; if (k.has('Escape') && ph !== 'move') { toTitle(); return; } keyboard(k); if (state.phase !== ph) return; }

    // per-phase work
    switch (state.phase) {
      case 'roll': {
        if (tap && (inRect({ x: DICE.x, y: DICE.y - 6, w: DICE.w, h: DICE.h + 12 }, tap.x, tap.y))) roll();
        else if (tap && state.canDouble && inRect({ x: CUBE.x - 40, y: CUBE.y - 40, w: 80, h: 90 }, tap.x, tap.y)) offerDouble();
        else if (tap && state.cube.on && !state.canDouble && inRect({ x: CUBE.x - 40, y: CUBE.y - 40, w: 80, h: 90 }, tap.x, tap.y)) say(state.cube.owner !== state.g.turn && state.cube.owner !== -1 ? 'The other side owns the cube: only they may double now.' : 'The cube can only be turned before you roll.', 3);
        break;
      }
      case 'rolling': {
        if (state.dice.roll.t >= state.dice.roll.dur) { state.dice.roll = null; afterRoll(); }
        break;
      }
      case 'move': {
        if (state.q.length && !state.anim) { const st = state.q.shift(); if (state.g.turn === 0 || state.two) undo.push({ g: clone(state.g), turn: turnCopy(turn) }); step(state.g.turn, st); break; }
        if (state.anim) break;
        boardInput(p);
        // one legal move only: play it for the player
        const uniq = new Set((state.legal || []).map((x) => x.from + '>' + x.to));
        if (state.auto && !noAuto && uniq.size === 1 && !state.drag && state.scene !== 'lesson' && state.scene !== 'puzzle') {
          state.autoT += dt;
          if (state.autoT > 0.55) { state.autoT = 0; const cs = (state.legal || []).slice().sort((a, b) => a.die - b.die); say('Only one move was possible, so it was played for you.', 3); humanStep(cs[0]); }
        } else state.autoT = 0;
        if (hintThinker) {
          const r = hintThinker.step();
          if (r.done) {
            hintThinker = null; state.thinking = false;
            if (r.cand && r.cand.steps.length) { const f = r.cand.steps[0]; state.hint = { from: f.from, to: f.to, t: 0 }; say('Hint: ' + reasonFor(state.g, r.cand, state.g.turn), 7); }
          }
        }
        break;
      }
      case 'end': {
        if (state.anim) break;
        if (state.q.length) { state.phase = 'move'; break; }
        if (tap && inRect(BTN.undo, tap.x, tap.y)) break;
        state.endT -= dt;
        if (state.endT <= 0) finishTurn();
        break;
      }
      case 'cpu': {
        state.think -= dt; if (state.think > 0) break;
        if (!state.cubeDone && cpuCube()) break;
        state.cubeDone = false; roll(); break;
      }
      case 'cpuThink': cpuThinkTick(); break;
      case 'cpuMove': {
        if (state.anim) break;
        if (state.q.length) { state.pauseT = (state.pauseT ?? 0) - dt; if (state.pauseT > 0) break; state.pauseT = dur(0.16); step(state.g.turn, state.q.shift(), null); break; }
        finishTurn(); break;
      }
      case 'cpuPass': { state.endT -= dt; if (state.endT <= 0) finishTurn(); break; }
      case 'wrong': { state.endT -= dt; if (state.endT <= 0) resetPuzzle(); break; }
      default: break;
    }
  }

  function updatePuzzleMaking() {
    for (let k = 0; k < 4 && !puzzleToday; k++) puzzleToday = maker.step().puzzle;
    if (puzzleToday) { const keep = state.pz.tries; startPuzzle(); state.pz.tries = keep; }
  }

  // ---- showcase scenes for the store screenshots (only for the reserved seeds 7770001..7770009) ------------------------------
  function showcase(n) {
    state.shot = true; state.sound = false; audio.setMuted?.(true); state.stats = { games: 12, wins: 7 };
    const playTo = (plies, level = 1) => { const g = newGame(); let side = 0; for (let i = 0; i < plies; i++) { const r = expandRoll([rng.int(6) + 1, rng.int(6) + 1]); const th = createThinker(g, side, r, level, rng); let res; do { res = th.step(); } while (!res.done); if (res.cand) { Object.assign(g, res.cand.after); } g.turn = side; side = opp(side); if (isOver(g)) break; } g.turn = 0; return g; };
    if (n === 1) return;
    if (n === 2 || n === 3 || n === 7 || n === 8) {
      start(false); resetPlay(); state.g = playTo(n === 3 ? 26 : 16); state.scene = 'play'; state.cube = { on: true, v: n === 7 ? 2 : 1, owner: n === 7 ? 0 : -1 };
      state.g.turn = 0; forced = n === 3 ? [6, 4] : [5, 3]; beginSide(false); state.dice = { vals: forced, side: 0, roll: null }; forced = null;
      turn = beginTurn(state.g, 0, expandRoll(state.dice.vals)); state.left = turn.dice.slice(); refreshMoves(); state.phase = 'move';
      if (state.sources.length) { state.sel = state.sources[Math.min(1, state.sources.length - 1)]; refreshDests(); }
      say('Tap a checker, then a glowing point.', 100); state.hintsLeft = 2;
      if (n === 7) { state.cubeAsk = { title: 'The rival doubles', body: `Doubling makes this game worth ${state.cube.v * 2} points instead of ${state.cube.v}. Take: play on, and you own the cube. Drop: give up the game.`, by: 1 }; state.phase = 'cubeask'; }
      if (n === 8) { state.g.off = [15, 6]; state.g.board.fill(0); state.g.bar = [0, 0]; state.g.board[13] = -5; state.g.board[15] = -4; state.result = { title: 'You win!', body: 'A gammon: the loser had borne off no checker. 2 points.', w: 0, points: 2 }; state.g.off = [15, 0]; state.scene = 'over'; state.phase = 'over'; state.dests = []; state.sources = []; }
      return;
    }
    if (n === 4) { start(false); resetPlay(); state.scene = 'play'; const g = newGame(); g.board.fill(0); [[6, 3], [5, 3], [4, 2], [3, 2], [2, 1]].forEach(([p, c]) => { g.board[p - 1] = c; }); g.off = [4, 3]; g.board[18] = -4; g.board[20] = -4; g.board[22] = -4; state.g = g; state.dice = { vals: [6, 3], side: 0, roll: null }; turn = beginTurn(g, 0, [6, 3]); refreshMoves(); state.sel = 5; refreshDests(); say('All 15 checkers are home: bear off with a die that matches.', 100); return; }
    if (n === 5) { startLesson(4); state.msg = null; state.dice = { vals: [2, 5], side: 0, roll: null }; turn = beginTurn(state.g, 0, [2, 5]); state.phase = 'move'; refreshMoves(); return; }
    if (n === 6) { puzzleToday = puzzleToday || (() => { let r; do { r = maker.step(); } while (!r.puzzle); return r.puzzle; })(); startPuzzle(); state.dice = { vals: puzzleToday.roll, side: 0, roll: null }; turn = beginTurn(state.g, 0, expandRoll(puzzleToday.roll)); state.phase = 'move'; refreshMoves(); state.status = `Find the best play for ${puzzleToday.roll[0]}-${puzzleToday.roll[1]}.`; return; }
  }
  if (config.seed >= 7770001 && config.seed <= 7770009) showcase(config.seed - 7770000);

  return {
    update(dt, input) {
      state.t += dt;
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      while (sfx.length && sfx[0].at <= state.t) { const e = sfx.shift(); if (e.o) tone(e.o); }
      if (state.shot) return;
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (input.keys.pressed.size && (sc === 'title')) { if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) { start(false); return; } }
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'howto' || sc === 'about' || sc === 'rules') updateDoc(tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (sc === 'demo-limit') { if (tap && tap.y > 800 && tap.y < 900) state.scene = 'title'; }
      else if (sc === 'puzzle' && state.pz.status === 'making') { if (tap && inRect(BTN.menu, tap.x, tap.y)) toTitle(); else updatePuzzleMaking(); }
      else updateBoard(dt, input, tap);
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
  };
}
