// Nine Men's Morris: state and flow. Drawing is in view.js; the rule book is rules.js; the computer's brain is
// engine.js; lessons.js and puzzles.js are content.
//
// How a move is made: PLACING: TAP an empty point. SLIDING: TAP a man (it lifts, its legal points glow), then TAP a
// glowing point; a man can also be DRAGGED there. A move that makes a mill first shows the man arriving, then the
// enemy men that may be taken glow red: TAP one. An illegal try shows a red ring and says why.
import { W, H, BTN, LOOK, titleRows, inRect, pointNear, pointAt, neighbourToward } from './layout.js';
import { newGame, clone, applyMove, tryMove, legalMoves, takeable, NONE, NAMES, mvFrom, mvTo, mvTake, bit, placing, flying, MILLS, formsMill, pop, mkMove, reasonNoMoves, inMills } from './rules.js';
import { LEVELS, createThinker, createEngine, chooseMove, explain } from './engine.js';
import { LESSONS } from './lessons.js';
import { createPuzzleMaker, puzzleGame, forcingMoves, FALLBACK } from './puzzles.js';
import { UNLOCKS, unlocked } from './unlocks.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, HINTS_PER_GAME = 3;
const mask = (pts) => pts.reduce((a, i) => a | bit(i), 0);

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, game: newGame(), human: 0, humanSide: 0, two: false, level: 1, marks: true, sound: true, calm: false,
    look: { wood: 'oak', set: 'boxwood', big: false },
    cursor: 9, kb: false, sel: -1, pend: null, anim: null, msg: null, think: 0, thinking: false, undo: [], hintsLeft: HINTS_PER_GAME,
    hint: null, drag: null, show: null, flash: null, bad: null, lastTo: -1,
    demo: { g: newGame(), timer: 0, since: 1, last: -1, pause: 0 },
    stats: { games: 0, wins: 0, badges: {} }, saved: null, learned: false, demoGames: 0,
    lesson: null, pz: null, daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 }, dev: config.dev === true,
  };
  let thinker = null, hintThinker = null, puzzleToday = null, engine = null;
  const eng = () => engine ?? (engine = createEngine(17));
  const maker = createPuzzleMaker(state.daily.day);

  storage.get('prefs', null).then((v) => { if (v) { state.level = v.level ?? 1; state.humanSide = v.side ?? 0; state.marks = v.marks ?? true; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.look = { ...state.look, ...(v.look || {}) }; audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && v.game.winner === null && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, side: state.humanSide, marks: state.marks, sound: state.sound, calm: state.calm, look: state.look });
  const saveGame = () => { if (state.scene === 'play' && state.game.winner === null && !state.pend) { state.saved = { game: clone(state.game), human: state.human, two: state.two, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const dur = (d) => (state.calm ? d * 0.6 : d);
  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.8, to: f * 0.36, dur: 0.06, type: 'sine', vol: 0.11 });
  const reset = (extra) => Object.assign(state, { sel: -1, pend: null, anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS_PER_GAME, drag: null, show: null, flash: null, bad: null, lastTo: -1 }, extra);
  const cancelThinking = () => { thinker = hintThinker = null; state.thinking = false; };

  function start(human, two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    cancelThinking();
    reset({ scene: 'play', game: newGame(), human, two });
    say(two ? 'Light begins. TAP an empty point to place a man.' : human === 0 ? 'You are Light and move first. TAP an empty point to place a man.' : 'You are Dark. Light places first.');
    if (!two && human === 1) state.think = 0.8;
    monetization.track('game_start', { side: two ? 'two' : human, level: state.level });
  }
  function resume() {
    const v = state.saved; cancelThinking();
    reset({ scene: 'play', game: clone(v.game), human: v.human, two: v.two, level: v.level ?? state.level, hintsLeft: v.hintsLeft ?? HINTS_PER_GAME });
    say('Game restored.'); if (!humanTurn()) state.think = 0.45;
  }
  function startLesson(i) {
    const l = LESSONS[i], g = newGame();
    g.p = [mask(l.light), mask(l.dark)]; g.hand = l.hand.slice(); g.turn = l.turn;
    cancelThinking();
    reset({ scene: 'lesson', game: g, human: l.turn, two: true, lesson: { i, done: false }, show: l.at ? l.at.slice() : null });
    state.lessonShowAll = false;
  }
  function startPuzzle() {
    cancelThinking(); const tries = state.pz?.tries ?? 0;
    if (!puzzleToday) { reset({ scene: 'puzzle', game: newGame(), pz: { status: 'making', puzzle: null, n: 0, tries, wrong: 0 } }); return; }
    const solved = state.daily.solvedDay === state.daily.day;
    reset({ scene: 'puzzle', game: puzzleGame(puzzleToday), human: puzzleToday.turn, two: false, pz: { status: solved ? 'solved' : 'ready', puzzle: puzzleToday, n: puzzleToday.n, tries, wrong: 0 } });
  }
  const humanTurn = () => state.game.winner === null && (state.two || state.game.turn === state.human);
  const rackOf = (side) => (state.two ? (side === 0 ? 'bottom' : 'top') : side === state.human ? 'bottom' : 'top');

  // Apply a whole move (with its take) and animate it.
  function play(m) {
    const g = state.game, me = g.turn, f = mvFrom(m), to = mvTo(m), x = mvTake(m), fly = f !== NONE && flying(g, me);
    const md = dur(fly ? 0.5 : f === NONE ? 0.36 : 0.3);
    state.anim = { side: me, from: f, to, take: x === NONE ? -1 : x, takeSide: 1 - me, mv: true, t: 0, moveDur: md, dur: md + (x === NONE ? 0.04 : 0.66), fly, rack: rackOf(me) };
    applyMove(g, m); state.lastTo = to; state.sel = -1; state.hint = null; state.show = null;
    if (fly) tone({ freq: 300, to: 700, dur: 0.22, type: 'triangle', vol: 0.06 }); else clack(f === NONE ? 520 : 440);
    if (x !== NONE) {
      const pts = []; for (const L of MILLS) if (L & bit(to) && (g.p[me] & L) === L) for (let i = 0; i < 24; i++) if (L & bit(i)) pts.push(i);
      // g.p[me] already has the man; the mill exists in the new position
      state.flash = { t: 0, pts };
      tone({ freq: 392, to: 392, dur: 0.14, type: 'triangle', vol: 0.09 }); tone({ freq: 587, to: 660, dur: 0.3, type: 'triangle', vol: 0.09 });
    }
  }
  // A human mill move: show the man arriving, then ask which enemy man to take.
  function beginTake(ms) {
    const g = state.game, m0 = ms[0], me = g.turn, f = mvFrom(m0), to = mvTo(m0), fly = f !== NONE && flying(g, me), md = dur(fly ? 0.5 : f === NONE ? 0.36 : 0.3);
    state.pend = { from: f, to, moves: ms }; state.sel = -1; state.hint = null; state.show = null; state.lastTo = to;
    state.anim = { pre: true, side: me, from: f, to, take: -1, takeSide: 1 - me, mv: true, t: 0, moveDur: md, dur: md + 0.04, fly, rack: rackOf(me) };
    if (fly) tone({ freq: 300, to: 700, dur: 0.22, type: 'triangle', vol: 0.06 }); else clack(f === NONE ? 520 : 440);
  }
  function chooseTake(i) {
    const pd = state.pend, g = state.game;
    const m = pd.moves.find((x) => mvTake(x) === i);
    if (!m) {
      const foe = 1 - g.turn;
      if (g.p[g.turn] & bit(i)) say('Those are your men. TAP a glowing red enemy man to take it.');
      else if (g.p[foe] & bit(i)) say('That man is in a mill, so it is protected. TAP a glowing red man that is not in a mill.');
      else say('TAP a glowing red enemy man to take it.');
      state.bad = { i, t: 0 }; tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.06 });
      return null;
    }
    return m;
  }
  function refuse(i, why) { state.sel = -1; state.bad = { i, t: 0 }; say(why); tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.06 }); }

  // What a tap on point i means. Returns the list of legal moves chosen, or null.
  function tapBoard(i) {
    const g = state.game, me = g.turn, mine = g.p[me], theirs = g.p[1 - me], occ = mine | theirs, name = NAMES[me];
    if (placing(g) && g.hand[me] > 0) {
      state.sel = -1;
      if (occ & bit(i)) { refuse(i, 'That point is taken. TAP an empty point to place a man.'); return null; }
      return tryMove(g, -1, i).moves;
    }
    if (state.sel < 0) {
      if (mine & bit(i)) { state.sel = i; clack(600); const why = reasonNoMoves(g, i); if (why) say(why); else if (flying(g, me)) say('Flying: this man can jump to ANY empty point.'); return null; }
      if (theirs & bit(i)) { say(`That is a ${NAMES[1 - me]} man. TAP one of your ${name} men.`); return null; }
      say('First TAP the man you want to move, then TAP where it should go.'); return null;
    }
    if (i === state.sel) { state.sel = -1; return null; }
    if (mine & bit(i)) { state.sel = i; clack(600); const why = reasonNoMoves(g, i); if (why) say(why); return null; }
    const r = tryMove(g, state.sel, i);
    if (r.moves) return r.moves;
    if (state.scene === 'lesson' && LESSONS[state.lesson.i].want === 'refused') { refuse(i, r.error); finishLesson(); return null; }
    refuse(i, r.error); return null;
  }

  function finish() {
    const g = state.game;
    state.scene = 'over'; state.stats.games += 1; clearSave();
    if (!state.two && g.winner === state.human) { state.stats.wins += 1; state.stats.badges['w' + state.level] = true; if (state.level >= 3) state.stats.badges.strong = true; }
    storage.set('stats', state.stats); storage.set('progress', { played: state.stats.games, wins: state.stats.wins });
    tone({ freq: g.winner === 'draw' ? 330 : 523, to: g.winner === 'draw' ? 330 : 784, dur: 0.4, type: 'triangle', vol: 0.09 });
    monetization.track('game_end', { winner: g.winner, plies: g.plies, level: state.level });
  }
  function finishLesson() { state.lesson.done = true; state.show = null; tone({ freq: 660, to: 990, dur: 0.2, type: 'triangle', vol: 0.08 }); }

  // ---- title -----------------------------------------------------------------------------------------
  function updateDemo(dt) {
    const d = state.demo; d.since += dt; d.timer += dt;
    if (d.g.winner !== null || d.g.plies > 64) { if (d.timer > 2) { d.g = newGame(); d.timer = 0; d.last = -1; } return; }
    if (d.timer < 0.85) return;
    d.timer = 0;
    const ms = legalMoves(d.g, []); if (!ms.length) return;
    const m = ms.find((x) => mvTake(x) !== NONE) ?? ms[(d.g.plies * 7 + 3) % ms.length];
    applyMove(d.g, m); d.last = mvTo(m); d.since = 0;
  }
  function updateTitle(dt, tap) {
    updateDemo(dt);
    for (let k = 0; k < 2 && !puzzleToday; k++) puzzleToday = maker.step().puzzle;
    if (!puzzleToday && maker.tries > 1500) puzzleToday = FALLBACK;
    if (!tap) return;
    const R = titleRows(!!state.saved), hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(R.resume)) resume();
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.play)) start(state.humanSide, false);
    else if (hit(R.two)) start(0, true);
    else if (hit(R.daily)) startPuzzle();
    else if (hit(R.level)) { state.level = (state.level + 1) % LEVELS.length; savePrefs(); clack(); say(LEVELS[state.level].note, 3.5); }
    else if (hit(R.side)) { state.humanSide = 1 - state.humanSide; savePrefs(); clack(); }
    else if (hit(R.sound)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); savePrefs(); clack(); }
    else if (hit(R.calm)) { state.calm = !state.calm; savePrefs(); clack(); }
    else if (hit(R.big)) { state.look.big = !state.look.big; savePrefs(); clack(); }
    else if (hit(R.look)) state.scene = 'look';
    else if (hit(R.about)) state.scene = 'about';
    else if (hit(R.how)) state.scene = 'how';
  }

  // ---- shared: a human tap on the board in play / lesson / puzzle ---------------------------------------
  function afterAnim() {
    const a = state.anim; state.anim = null;
    if (a.pre) { say('A mill! TAP a glowing red enemy man to take it.', 8); return; }
    const g = state.game;
    if (state.scene === 'play') { if (g.winner !== null) finish(); else { saveGame(); if (!humanTurn()) state.think = 0.4; } }
  }

  function updatePlay(dt, tap) {
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 6) state.hint = null; }
    if (state.anim) { state.anim.t += dt; if (state.anim.t >= state.anim.dur) afterAnim(); return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.scene = 'title'; cancelThinking(); return; }
    if (!humanTurn()) {
      state.think -= dt; if (state.think > 0) return;
      if (!thinker) { thinker = createThinker(state.game, state.level, rng, eng()); state.thinking = true; }
      const r = thinker.step();
      if (r.move !== undefined) { thinker = null; state.thinking = false; if (r.move !== null) play(r.move); }
      return;
    }
    if (hintThinker) {
      const r = hintThinker.step();
      if (r.move !== undefined) {
        const m = r.move; hintThinker = null; state.thinking = false;
        if (m !== null) { state.hint = { from: mvFrom(m) === NONE ? -1 : mvFrom(m), to: mvTo(m), t: 0 }; say('Hint: ' + explain(state.game, m), 7); }
      }
      return;
    }
    if (tap && inRect(BTN.undo, tap.x, tap.y)) {
      if (state.undo.length) { state.game = state.undo.pop(); state.pend = null; state.sel = -1; state.hint = null; say('Move taken back.'); clack(360); saveGame(); } else say('Nothing to take back yet.');
      return;
    }
    if (tap && inRect(BTN.hint, tap.x, tap.y)) {
      if (state.pend) say('Take a man first: TAP a glowing red man.');
      else if (state.hintsLeft <= 0) say('No hints left in this game.');
      else { state.hintsLeft -= 1; hintThinker = createThinker(state.game, 3, rng, eng()); state.thinking = true; state.sel = -1; say('Thinking about a good move…', 3); }
      return;
    }
    if (!tap) return;
    const i = pointNear(tap.x, tap.y);
    if (state.pend) { if (i < 0) return; const m = chooseTake(i); if (m) { state.pend = null; play(m); } return; }
    if (i < 0) { state.sel = -1; return; }
    const ms = tapBoard(i);
    if (ms) { state.undo.push(clone(state.game)); if (mvTake(ms[0]) === NONE) play(ms[0]); else beginTake(ms); }
  }

  function updateLesson(dt, tap) {
    const L = state.lesson, l = LESSONS[L.i];
    if (state.anim) { state.anim.t += dt; if (state.anim.t >= state.anim.dur) afterAnim(); return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (L.done) {
      if (tap && inRect(BTN.next, tap.x, tap.y)) {
        if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try the Apprentice level.', 7); }
      }
      return;
    }
    if (tap && inRect(BTN.show, tap.x, tap.y)) { state.show = l.solve.filter((p, k) => !(k === l.solve.length - 1 && l.takeAt === undefined && (l.want === 'mill' || l.want === 'win') && l.solve.length > 1 && false)); say(l.hint, 6); return; }
    if (!tap) return;
    const i = pointNear(tap.x, tap.y);
    if (state.pend) {
      if (i < 0) return;
      const m = chooseTake(i); if (!m) return;
      if (l.takeAt && !l.takeAt.includes(i)) { say(l.hint); state.bad = { i, t: 0 }; return; }
      state.pend = null; play(m); state.game.winner = null; finishLesson(); return;
    }
    if (i < 0) { state.sel = -1; return; }
    const ms = tapBoard(i); if (!ms) return;
    const m0 = ms[0], hasTake = mvTake(m0) !== NONE;
    const kindOk = l.want === 'place' ? mvFrom(m0) === NONE && !hasTake : l.want === 'step' ? mvFrom(m0) !== NONE && !hasTake : l.want === 'refused' ? false : hasTake;
    if (kindOk && (!l.at || l.at.includes(mvTo(m0)))) {
      if (hasTake) beginTake(ms); else { play(m0); state.game.winner = null; finishLesson(); }
    } else { state.sel = -1; say(l.hint); state.bad = { i, t: 0 }; }
  }

  function updatePuzzle(dt, tap) {
    const P = state.pz;
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (P.status === 'making') { for (let k = 0; k < 3 && !puzzleToday; k++) puzzleToday = maker.step().puzzle; if (puzzleToday) startPuzzle(); return; }
    if (state.anim) {
      state.anim.t += dt; if (state.anim.t < state.anim.dur) return;
      const a = state.anim; state.anim = null;
      if (a.pre) { say('A mill! TAP a glowing red enemy man to take it.', 8); return; }
      const g = state.game;
      if (P.wrong > 0) return;
      if (P.status === 'solved') return;
      if (P.mill) { P.mill = false; P.status = 'solved'; g.winner = null; if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); } say('Solved!', 6); tone({ freq: 523, to: 1046, dur: 0.4, type: 'triangle', vol: 0.09 }); return; }
      if (g.turn !== P.puzzle.turn && g.winner === null) { const reply = chooseMove(g, 1, rng, eng()); if (reply !== null) { P.n -= 1; play(reply); } }
      return;
    }
    if (P.wrong > 0) { P.wrong -= dt; if (P.wrong <= 0) { state.game = puzzleGame(P.puzzle); P.n = P.puzzle.n; P.wrong = 0; state.lastTo = -1; say('Set up again. Look for the move that cannot be stopped.'); } return; }
    if (P.status === 'solved') { if (tap && inRect(BTN.share, tap.x, tap.y)) env.share(`Nine Men's Morris puzzle of the day: solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' first try'}. Streak ${state.daily.streak}.`); return; }
    if (!tap) return;
    const i = pointNear(tap.x, tap.y);
    if (state.pend) { if (i < 0) return; const m = chooseTake(i); if (m) { state.pend = null; P.mill = true; play(m); } return; }
    if (i < 0) { state.sel = -1; return; }
    const ms = tapBoard(i); if (!ms) return;
    const good = forcingMoves(state.game, P.n, 60000) || [], m0 = ms[0], ok = good.some((x) => mvFrom(x) === mvFrom(m0) && mvTo(x) === mvTo(m0));
    if (mvTake(m0) !== NONE) { if (ok) beginTake(ms); else { P.tries += 1; play(m0); P.wrong = 1.4; } return; }
    play(m0);
    if (!ok) { P.tries += 1; P.wrong = 1.4; say(`That lets ${NAMES[1 - P.puzzle.turn]} escape.`); }
  }

  function updateLook(tap) {
    if (!tap) return;
    const pick = (group, key, set) => { if (unlocked(state, group, key)) { state.look[set] = key; savePrefs(); clack(); } else say(UNLOCKS[group][key].need + ' Then it is yours.', 4); };
    ['oak', 'walnut', 'ash'].forEach((w, i) => { if (inRect(LOOK.woods[i], tap.x, tap.y)) pick('wood', w, 'wood'); });
    ['boxwood', 'ivory'].forEach((s, i) => { if (inRect(LOOK.sets[i], tap.x, tap.y)) pick('set', s, 'set'); });
    if (inRect(LOOK.marks, tap.x, tap.y)) { state.marks = !state.marks; savePrefs(); clack(); }
    if (inRect(LOOK.back, tap.x, tap.y)) state.scene = 'title';
  }

  // Keyboard (web demo): arrows move a cursor over the 24 points, Space/Enter = TAP, Esc = Menu, U = Undo, H = Hint.
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene;
    if (input.pointer.pressed) { state.kb = false; return null; }
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) { const R = titleRows(!!state.saved); const r = R.resume ?? R.play; return { x: r.x + 5, y: r.y + 5 }; } return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return { x: BTN.again.x + 5, y: BTN.again.y + 5 }; if (k.has('Escape')) return { x: BTN.back.x + 5, y: BTN.back.y + 5 }; return null; }
    if (sc === 'look') { if (k.has('Escape')) return { x: LOOK.back.x + 5, y: LOOK.back.y + 5 }; return null; }
    if (sc === 'about' || sc === 'how') { if (k.has('Escape') || k.has('Enter')) return { x: BTN.pageBack.x + 5, y: BTN.pageBack.y + 5 }; return null; }
    if (sc !== 'play' && sc !== 'lesson' && sc !== 'puzzle') return null;
    if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 };
    if (k.has('KeyU')) return { x: BTN.undo.x + 5, y: BTN.undo.y + 5 };
    if (k.has('KeyH')) return { x: BTN.hint.x + 5, y: BTN.hint.y + 5 };
    let dx = 0, dy = 0;
    if (k.has('ArrowLeft')) dx = -1; else if (k.has('ArrowRight')) dx = 1; else if (k.has('ArrowUp')) dy = -1; else if (k.has('ArrowDown')) dy = 1;
    if (dx || dy) { state.kb = true; state.cursor = neighbourToward(state.cursor, dx, dy); return null; }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; const p = pointAt(state.cursor); return { x: p.x, y: p.y }; }
    return null;
  }

  // Dragging a man: press on it, move, release over a point.
  function drag(input) {
    const p = input.pointer, g = state.game;
    const active = state.scene === 'play' && humanTurn() && !state.anim && !state.pend && !placing(g);
    if (p.pressed && active) { const i = pointNear(p.x, p.y); if (i >= 0 && g.p[g.turn] & bit(i)) state.drag = { i, x0: p.x, y0: p.y, x: p.x, y: p.y, moved: false }; }
    if (!state.drag) return null;
    const d = state.drag;
    if (p.down) { d.x = p.x; d.y = p.y; if (!d.moved && Math.hypot(p.x - d.x0, p.y - d.y0) > 18) { d.moved = true; state.sel = d.i; } }
    if (p.released || !active) {
      state.drag = null;
      if (d.moved && active) { const j = pointNear(p.x, p.y, 64); if (j >= 0 && j !== d.i) { state.sel = d.i; return { x: pointAt(j).x, y: pointAt(j).y, fromDrag: true }; } state.sel = d.i; }
    }
    return null;
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      if (state.flash) { state.flash.t += dt; if (state.flash.t > 0.9) state.flash = null; }
      if (state.bad) { state.bad.t += dt; if (state.bad.t > 0.7) state.bad = null; }
      state.demo.since = state.demo.since;
      const p = input.pointer, kbd = keyboard(input), dr = drag(input);
      const tap = dr ?? (p.pressed ? { x: p.x, y: p.y } : kbd);
      const sc = state.scene;
      if (sc === 'title') updateTitle(dt, tap);
      else if (sc === 'look') updateLook(tap);
      else if (sc === 'about' || sc === 'how') { if (tap && inRect(BTN.pageBack, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'demo-limit') { if (tap && inRect({ x: 140, y: 880, w: 440, h: 76 }, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'play') updatePlay(dt, p.pressed && state.drag && !dr ? (tap) : tap);
      else if (sc === 'lesson') updateLesson(dt, tap);
      else if (sc === 'puzzle') updatePuzzle(dt, tap);
      else if (sc === 'over' && tap) {
        if (inRect(BTN.again, tap.x, tap.y)) start(state.human, state.two);
        else if (inRect(BTN.back, tap.x, tap.y)) state.scene = 'title';
        else if (inRect(BTN.share, tap.x, tap.y)) env.share(`I played Nine Men's Morris: ${state.game.winner === 'draw' ? 'a draw' : NAMES[state.game.winner] + ' won'} at the ${LEVELS[state.level].name} level.`);
      }
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
  };
}
