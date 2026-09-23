// Senet: state and flow. Rules are rules.js, the computer is ai.js, drawing is view.js, content is lessons.js / puzzles.js / about.js.
//
// A turn: TAP the sticks (they tumble), the number thrown appears, then TAP one of your glowing pieces and TAP a glowing square.
// A move that is not allowed visibly TRIES: the piece travels toward the square, shudders, comes back, and a sentence says why.
// Phases (state.phase): 'need' (waiting for a throw), 'tumble', 'choose' (the player picks a move), 'think' (the computer),
// 'moving' (a move animates), 'pause' (no legal move). The rule book applies a move at once; `state.anim` then PLAYS it.
import { W, H, BTN, TRAY, PAGE, titleRows, inRect, squareAt, idxAt } from './layout.js';
import { newGame, clone, legalMoves, applyMove, endThrow, throwSticks, facesFor, whyNot, describe } from './rules.js';
import { LEVELS, createThinker, scoreMoves } from './ai.js';
import { LESSONS, buildLesson } from './lessons.js';
import { createPuzzleMaker, puzzleGame } from './puzzles.js';
import { RULES } from './about.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, HINTS = 3;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, g: newGame(), phase: 'need', two: false, level: 1, sound: true, calm: false, big: false,
    roll: null, sel: -1, anim: null, msg: null, wait: 0, thinking: false, undo: [], hintsLeft: HINTS, hint: null,
    cursor: 5, kb: false, stats: { games: 0, wins: 0, badges: {} }, saved: null, learned: false, demoGames: 0,
    lesson: null, pz: null, rulesPage: 0, daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 }, dev: config.dev === true,
  };
  let thinker = null, hintJob = null, puzzleToday = null;
  const maker = createPuzzleMaker(state.daily.day);

  storage.get('prefs', null).then((v) => { if (v) { state.level = v.level ?? 1; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.big = v.big ?? false; audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.g && v.g.winner === null && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, big: state.big });
  const saveGame = () => { if (state.scene === 'play' && state.g.winner === null && state.phase !== 'tumble' && state.phase !== 'moving') { state.saved = { g: clone(state.g), two: state.two, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.games, wins: state.stats.wins }); };

  const dur = (d) => (state.calm ? d * 0.55 : d);
  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.8, to: f * 0.36, dur: 0.06, type: 'sine', vol: 0.11 });
  const rattle = () => { for (let k = 0; k < 4; k++) tone({ freq: 700 + k * 90, to: 300, dur: 0.05, type: 'triangle', vol: 0.06 }); };
  const reset = (extra) => { thinker = hintJob = null; Object.assign(state, { sel: -1, anim: null, msg: null, wait: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS, roll: null, kb: false }, extra); };
  const humanTurn = () => state.g.winner === null && (state.two || state.g.turn === 1 || state.scene !== 'play');
  const sqName = (i) => i + 1;

  // ---- starting things ----------------------------------------------------------------------------------------
  function start(two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    reset({ scene: 'play', g: newGame(), two, phase: 'need' });
    say(two ? 'Player one (cones) throws first. TAP the sticks to throw.' : 'You play the cones and throw first. TAP the sticks to throw.');
    monetization.track('game_start', { two, level: state.level });
  }
  function resume() {
    const v = state.saved;
    reset({ scene: 'play', g: clone(v.g), two: v.two, level: v.level ?? state.level, hintsLeft: v.hintsLeft ?? HINTS, phase: v.g.n ? 'choose' : 'need' });
    if (state.g.n) state.roll = { faces: facesFor(state.g.n), n: state.g.n, t: 9, dur: 1, tumbling: false, seeds: [] };
    say('Game restored.'); afterThrow(true);
  }
  function startLesson(i) {
    const l = LESSONS[i], g = buildLesson(l);
    reset({ scene: 'lesson', g, two: true, lesson: { i, done: false, threw: false }, phase: 'need' });
    if (l.throw) { g.n = l.throw; state.roll = { faces: facesFor(l.throw), n: l.throw, t: 9, dur: 1, tumbling: false, seeds: [] }; state.phase = 'choose'; }
  }
  function startPuzzle() {
    const tries = state.pz?.tries ?? 0;
    if (!puzzleToday) { reset({ scene: 'puzzle', pz: { status: 'making', puzzle: null, tries, wrong: 0 } }); return; }
    const g = puzzleGame(puzzleToday);
    reset({ scene: 'puzzle', g, two: true, phase: 'choose', pz: { status: state.daily.solvedDay === state.daily.day ? 'solved' : 'ready', puzzle: puzzleToday, tries, wrong: 0 } });
    state.roll = { faces: facesFor(g.n), n: g.n, t: 9, dur: 1, tumbling: false, seeds: [] };
  }

  // ---- throwing ----------------------------------------------------------------------------------------------
  function startThrow() {
    const r = throwSticks(rng);
    state.roll = { faces: r.faces, n: r.n, t: 0, dur: dur(1.2), tumbling: true, seeds: [0, 1, 2, 3].map((k) => ({ delay: k * 0.06 + rng.next() * 0.05, flips: 2 + rng.int(3) + k % 2, b: rng.next() * 0.6, dx: (rng.next() - 0.5) * 120, spin: (rng.next() - 0.5) * 1.6 })) };
    state.phase = 'tumble'; state.hint = null; state.sel = -1; state.msg = null; rattle();
  }
  // The sticks have settled: record the number, then either wait for the human's move, think, or pass.
  function afterThrow(restored = false) {
    const g = state.g;
    if (!restored) { g.n = state.roll.n; state.roll.tumbling = false; state.wait = 0.5; clack(300); }
    if (state.scene === 'lesson' && LESSONS[state.lesson.i].want === 'extra' && state.lesson.moved) { state.lesson.done = true; state.phase = 'idle'; return; }
    const moves = legalMoves(g);
    if (!moves.length) { state.phase = 'pause'; state.wait = state.scene === 'play' ? 1.6 : 1.6; say(`No piece can move ${g.n}. The turn passes.`, 2.6); return; }
    if (state.scene === 'play' && !state.two && g.turn === 2) { state.phase = 'think'; thinker = createThinker(g, state.level, rng); state.thinking = true; state.wait = 0.6; return; }
    state.phase = 'choose';
    if (state.scene === 'play') { const w = g.n === 5 ? 'none light' : `${g.n} light`; say(`You threw ${g.n} (${w}). TAP a glowing piece.`, 3.5); }
  }

  // ---- moves -------------------------------------------------------------------------------------------------
  function play(m) {
    const g = state.g, kind = g.turn, foe = g.board[m.swap] || 0;
    state.anim = { type: m.off ? 'off' : m.water ? 'water' : 'move', kind, from: m.from, to: m.to, dest: m.dest, swapKind: m.swap >= 0 ? foe : 0, t: 0, dur: dur(m.water ? 1.25 : m.off ? 0.7 : 0.5) };
    applyMove(g, m); state.sel = -1; state.hint = null; state.phase = 'moving'; state.thinking = false;
    if (m.water) tone({ freq: 500, to: 160, dur: 0.4, type: 'sine', vol: 0.1 }); else clack(m.swap >= 0 ? 560 : 420);
    if (m.off) tone({ freq: 660, to: 990, dur: 0.3, type: 'triangle', vol: 0.09 });
  }
  function refuse(from, to, why) {
    state.anim = { type: 'refuse', kind: state.g.board[from], from, to, dest: to, swapKind: 0, t: 0, dur: dur(0.62) };
    state.sel = -1; state.phase = 'moving'; say(why, 6);
    tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.06 });
    if (state.scene === 'lesson') { const l = LESSONS[state.lesson.i]; if (l.want === 'refused' && from === l.from - 1) state.lesson.done = true; }
  }

  // What a tap on square i (0..29, or 30 = the exit) means while the human is choosing.
  function tapSquare(i) {
    const g = state.g, n = g.n, me = g.turn, moves = legalMoves(g);
    const piece = i < 30 ? g.board[i] : 0;
    if (state.sel < 0) {
      if (i === 30) { say('Tap one of your pieces first. The exit is where a piece leaves the board.'); return null; }
      if (piece === me) {
        if (moves.some((m) => m.from === i)) { state.sel = i; clack(600); return null; }
        const why = whyNot(g, i, n); refuse(i, Math.min(29, i + n), why || 'That piece cannot move.'); return null;
      }
      if (piece) say(`That is the other side's piece. TAP one of yours (${me === 1 ? 'cones' : 'reels'}).`);
      else say('TAP one of your glowing pieces first, then TAP where it should go.');
      return null;
    }
    if (i === state.sel) { state.sel = -1; return null; }
    if (piece === me && moves.some((m) => m.from === i)) { state.sel = i; clack(600); return null; }
    const m = moves.find((x) => x.from === state.sel && (x.off ? i === 30 : x.dest === i));
    if (m) return m;
    const from = state.sel, why = whyNot(g, from, n), target = from + n;
    if (i === 30 && why === null) { say(`This piece moves ${n} to square ${sqName(target)}. TAP that glowing square.`); return null; }
    if (why) { refuse(from, Math.min(29, target), i === target || i === 30 ? why : `This throw moves it exactly ${n}, to square ${sqName(target)}. ${why}`); return null; }
    say(`This throw moves it exactly ${n}, to square ${sqName(target)}. TAP that glowing square.`); return null;
  }

  function finish() {
    const g = state.g;
    state.scene = 'over'; state.stats.games += 1; clearSave();
    if (!state.two && g.winner === 1) { state.stats.wins += 1; state.stats.badges['L' + state.level] = true; }
    saveStats();
    tone({ freq: g.winner === 1 ? 523 : 330, to: g.winner === 1 ? 784 : 330, dur: 0.4, type: 'triangle', vol: 0.09 });
    monetization.track('game_end', { winner: g.winner, throws: g.throws, level: state.level });
  }
  function movePlayed() {                            // the move animation is over
    const g = state.g, sc = state.scene, refused = state.anim.type === 'refuse';
    state.anim = null;
    if (refused) { state.phase = sc === 'lesson' && state.lesson.done ? 'idle' : 'choose'; return; }
    if (sc === 'lesson') return lessonAfterMove();
    if (sc === 'puzzle') return puzzleAfterMove();
    if (g.winner !== null) { finish(); return; }
    state.phase = 'need'; state.wait = 0.45; state.roll = state.roll ? { ...state.roll, faces: state.roll.faces } : null;
    if (g.extra && humanTurn()) say(`Another throw for ${state.two ? (g.turn === 1 ? 'player one' : 'player two') : 'you'}. TAP the sticks.`, 2.5);
    saveGame();
  }

  // ---- lessons -----------------------------------------------------------------------------------------------
  function lessonTap(i) {
    const L = state.lesson, l = LESSONS[L.i];
    if (state.phase === 'need' && l.want !== 'throw' && l.want !== 'extra') return;
    const m = tapSquare(i);
    if (!m) return;
    const to = m.off ? 31 : m.dest + 1;
    if (l.want === 'refused') { state.sel = -1; say(l.hint); return; }
    const ok = (l.want === 'move' || l.want === 'extra' || l.want === 'throw') && (!l.at || l.at.includes(to));
    if (!ok) { state.sel = -1; say(l.hint); return; }
    play(m); L.moved = true;
  }
  function lessonAfterMove() {
    const L = state.lesson, l = LESSONS[L.i];
    if (l.want === 'extra' && state.g.turn === 1 && state.g.winner === null) { state.phase = 'need'; say('You threw a 4, so you throw again. TAP the sticks.', 6); return; }
    L.done = true; state.phase = 'idle'; tone({ freq: 660, to: 990, dur: 0.2, type: 'triangle', vol: 0.08 });
  }

  // ---- daily puzzle ------------------------------------------------------------------------------------------
  function puzzleTap(i) {
    const P = state.pz;
    if (P.status !== 'ready' || P.wrong > 0) return;
    const m = tapSquare(i); if (!m) return;
    const best = P.puzzle.best, good = m.from === best.from && m.dest === best.dest;
    play(m); P.moved = good;
    if (!good) { P.tries += 1; P.wrong = 1.6; }
  }
  function puzzleAfterMove() {
    const P = state.pz; state.anim = null; state.phase = 'idle';
    if (P.moved) {
      P.status = 'solved';
      if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); }
      say('Solved! ' + P.puzzle.why, 8); tone({ freq: 523, to: 1046, dur: 0.4, type: 'triangle', vol: 0.09 });
    } else say('Not the best move. Watch: the position is set up again.');
  }

  // ---- per-scene updates -------------------------------------------------------------------------------------
  function updateTitle(tap) {
    for (let k = 0; k < 3 && !puzzleToday; k++) puzzleToday = maker.step().puzzle;
    if (!tap) return;
    const R = titleRows(!!state.saved), hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(R.resume)) resume();
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.play)) start(false);
    else if (hit(R.two)) start(true);
    else if (hit(R.daily)) startPuzzle();
    else if (hit(R.how)) state.scene = 'how';
    else if (hit(R.about)) state.scene = 'about';
    else if (hit(R.rules)) { state.scene = 'rules'; state.rulesPage = 0; }
    else if (hit(R.level)) { state.level = (state.level + 1) % LEVELS.length; savePrefs(); clack(); }
    else if (hit(R.sound)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); savePrefs(); clack(); }
    else if (hit(R.calm)) { state.calm = !state.calm; savePrefs(); clack(); }
    else if (hit(R.big)) { state.big = !state.big; savePrefs(); clack(); }
  }

  // Shared by play, lesson and puzzle: sticks, computer, moves, animation.
  function updateBoardScene(dt, tap) {
    const sc = state.scene, g = state.g;
    if (state.hint && (state.hint.t += dt) > 6) state.hint = null;
    if (state.anim) { state.anim.t += dt; if (state.anim.t >= state.anim.dur) movePlayed(); return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.scene = 'title'; thinker = hintJob = null; state.thinking = false; return; }
    if (sc === 'lesson' && state.lesson.done) { if (tap && inRect(BTN.next, tap.x, tap.y)) { if (state.lesson.i + 1 < LESSONS.length) startLesson(state.lesson.i + 1); else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try the computer at Easy.', 7); } } return; }
    if (sc === 'puzzle') {
      const P = state.pz;
      if (P.wrong > 0) { P.wrong -= dt; if (P.wrong <= 0) { const t = P.tries; state.g = puzzleGame(P.puzzle); state.phase = 'choose'; P.wrong = 0; P.moved = false; state.sel = -1; say('Set up again. Think about which piece is in danger and which square is safe.'); } return; }
      if (P.status === 'solved' && tap && inRect(BTN.share, tap.x, tap.y)) { env.share(`Senet daily puzzle: solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' first try'}. Streak ${state.daily.streak}.`); return; }
    }
    if (state.phase === 'tumble') {
      state.roll.t += dt;
      if (state.roll.t >= state.roll.dur) afterThrow();
      return;
    }
    if (state.phase === 'pause') { if ((state.wait -= dt) <= 0) { endThrow(g); state.msg = null; state.phase = 'need'; state.wait = 0.4; if (sc === 'lesson') { state.phase = 'need'; } saveGame(); } return; }
    if (state.phase === 'think') {
      if ((state.wait -= dt) > 0) return;
      const r = thinker.step();
      if (r.move !== undefined) { thinker = null; state.thinking = false; if (r.move) play(r.move); }
      return;
    }
    if (state.phase === 'need') {
      if (g.winner !== null) return;
      const mine = sc !== 'play' || state.two || g.turn === 1;
      if (!mine) { if ((state.wait -= dt) <= 0) startThrow(); return; }
      const trayTap = tap && inRect({ x: TRAY.x - 20, y: TRAY.y - 40, w: TRAY.w + 40, h: TRAY.h + 60 }, tap.x, tap.y);
      if (trayTap || (tap && tap.key === 'throw')) { if (sc === 'play' || sc === 'lesson') startThrow(); }
      return;
    }
    if (state.phase !== 'choose') return;
    // hint search runs a slice each frame
    if (hintJob) {
      const r = hintJob.next();
      if (r.done) {
        hintJob = null; state.thinking = false;
        const sc2 = r.value, best = sc2.reduce((b, x) => (x.v > b.v ? x : b), sc2[0]);
        state.hint = { from: best.m.from, dest: best.m.off ? 30 : best.m.dest, off: best.m.off, t: 0 };
        say('Hint: ' + describe(g, best.m).replace(/^It /, 'The glowing piece ').replace(/^The glowing piece brings/, 'The glowing piece brings'), 7);
      }
      return;
    }
    if (!tap) return;
    if (sc === 'play' && inRect(BTN.undo, tap.x, tap.y)) {
      if (state.undo.length) { state.g = state.undo.pop(); state.sel = -1; state.hint = null; state.roll = { faces: facesFor(state.g.n), n: state.g.n, t: 9, dur: 1, tumbling: false, seeds: [] }; say('Move taken back. Same throw: choose again.'); clack(360); saveGame(); afterThrow(true); } else say('Nothing to take back yet.');
      return;
    }
    if (sc === 'play' && inRect(BTN.hint, tap.x, tap.y)) {
      if (state.hintsLeft <= 0) say('No hints left in this game.'); else { state.hintsLeft -= 1; hintJob = scoreMoves(clone(g), 3); state.thinking = true; state.sel = -1; }
      return;
    }
    const i = squareAt(tap.x, tap.y);
    if (i < 0) { state.sel = -1; return; }
    if (sc === 'lesson') return lessonTap(i);
    if (sc === 'puzzle') return puzzleTap(i);
    if (!humanTurn()) return;
    const before = clone(g);
    const m = tapSquare(i);
    if (m) { before.n = g.n; state.undo.push(before); if (state.undo.length > 40) state.undo.shift(); play(m); }
  }

  // Keyboard: arrows move a cursor over the 3 x 10 squares (and the exit), Enter taps it, Space throws, Escape = Menu.
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene;
    if (input.pointer.pressed) { state.kb = false; return null; }
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) { const R = titleRows(!!state.saved); const r = R.resume || R.play; return { x: r.x + 5, y: r.y + 5 }; } return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return { x: BTN.again.x + 5, y: BTN.again.y + 5 }; return null; }
    if (sc === 'about' || sc === 'how') { if (k.has('Escape') || k.has('Enter')) return { x: PAGE.back.x + 5, y: PAGE.back.y + 5 }; return null; }
    if (sc === 'rules') {
      if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 };
      if (k.has('ArrowRight') || k.has('Enter') || k.has('Space')) return { x: BTN.hint.x + 5, y: BTN.hint.y + 5 };
      if (k.has('ArrowLeft')) return { x: BTN.undo.x + 5, y: BTN.undo.y + 5 };
      return null;
    }
    if (sc !== 'play' && sc !== 'lesson' && sc !== 'puzzle') return null;
    if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 };
    if (k.has('Space')) { if (sc === 'lesson' && state.lesson.done) return { x: BTN.next.x + 5, y: BTN.next.y + 5 }; return { x: TRAY.x + 5, y: TRAY.y + 5, key: 'throw' }; }
    let dx = 0, dy = 0;
    if (k.has('ArrowLeft')) dx = -1; else if (k.has('ArrowRight')) dx = 1; else if (k.has('ArrowUp')) dy = -1; else if (k.has('ArrowDown')) dy = 1;
    if (dx || dy) {
      state.kb = true;
      if (state.cursor === 30) { if (dy < 0) state.cursor = idxAt(2, 9); return null; }
      const c = state.cursor < 10 ? 0 : state.cursor < 20 ? 1 : 2, r = c === 1 ? 9 - (state.cursor % 10) : state.cursor % 10;
      const nc = Math.max(0, Math.min(2, c + dx)), nr = r + dy;
      if (nr > 9 && nc === 2) state.cursor = 30; else state.cursor = idxAt(nc, Math.max(0, Math.min(9, nr)));
      return null;
    }
    if (k.has('Enter')) {
      state.kb = true;
      if (state.phase === 'need') return { x: TRAY.x + 5, y: TRAY.y + 5, key: 'throw' };
      const x = state.cursor === 30 ? 524 : 114 + (state.cursor < 10 ? 0 : state.cursor < 20 ? 1 : 2) * 164 + 80, y = state.cursor === 30 ? 1237 : 352 + (state.cursor < 10 ? state.cursor : state.cursor < 20 ? 9 - (state.cursor - 10) : state.cursor - 20) * 88 + 44;
      return { x, y };
    }
    return null;
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      const p = input.pointer, kbd = keyboard(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd ? kbd : null;
      const sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'demo-limit') { if (tap && inRect(BTN.back, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'about' || sc === 'how') { if (tap && inRect(PAGE.back, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'rules') {
        if (tap && inRect(BTN.menu, tap.x, tap.y)) state.scene = 'title';
        else if (tap && inRect(BTN.hint, tap.x, tap.y)) state.rulesPage = Math.min(RULES.length - 1, state.rulesPage + 1);
        else if (tap && inRect(BTN.undo, tap.x, tap.y)) state.rulesPage = Math.max(0, state.rulesPage - 1);
      }
      else if (sc === 'play' || sc === 'lesson') updateBoardScene(dt, tap);
      else if (sc === 'puzzle') {
        if (state.pz.status === 'making') { if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; } for (let k = 0; k < 3 && !puzzleToday; k++) puzzleToday = maker.step().puzzle; if (puzzleToday) startPuzzle(); }
        else updateBoardScene(dt, tap);
      } else if (sc === 'over' && tap) {
        if (inRect(BTN.again, tap.x, tap.y)) start(state.two); else if (inRect(BTN.back, tap.x, tap.y)) state.scene = 'title';
      }
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
  };
}
