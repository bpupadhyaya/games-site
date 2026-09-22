// Morabaraba: state and flow. Drawing is in view.js; rules are millfamily.js + morabaraba.js; the computer is engine.js;
// lessons.js, puzzles.js and info.js are content.
//
// How a move is made: PLACING = TAP an empty point. SLIDING = TAP a cow (its legal points glow) then TAP a point, or DRAG the cow
// onto a point. A mill lets you shoot: the other side's unprotected cows glow red and you TAP one. An illegal move visibly TRIES
// (the cow travels toward the point, shudders, comes back) and a message says why.
import { W, H, BTN, titleRows, inRect, pointNear, pointAt } from './layout.js';
import { RULES as R, POINT_UV } from './morabaraba.js';
import { LEVELS, createThinker, chooseMove } from './engine.js';
import { LESSONS, boardOf } from './lessons.js';
import { createPuzzleMaker, puzzleGame, forcingFirst } from './puzzles.js';
import { PAGES } from './info.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, HINTS_PER_GAME = 3;
const NAME = { 1: 'Dark', 2: 'Light' };
const sameMove = (a, b) => a.type === b.type && a.to === b.to && (a.from ?? -1) === (b.from ?? -1) && (a.take ?? -1) === (b.take ?? -1);

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, game: R.newGame(), human: 1, two: false, level: 1, marks: true, sound: true, calm: false, big: false,
    cursor: 12, kb: false, sel: -1, drag: null, take: null, anim: null, msg: null, think: 0, thinking: false, undo: [], hintsLeft: HINTS_PER_GAME, hint: null,
    threats: [], lessonGlow: null,
    stats: { games: 0, wins: 0, badges: {} }, saved: null, learned: false, demoGames: 0,
    lesson: null, pz: null, daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 }, info: { which: 'howto', page: 0 }, dev: config.dev === true,
  };
  let thinker = null, hintThinker = null, puzzleToday = null, pendingReply = null;
  const maker = createPuzzleMaker(state.daily.day);

  storage.get('prefs', null).then((v) => { if (v) { state.level = v.level ?? 1; state.marks = v.marks ?? true; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.big = v.big ?? false; audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && !v.game.winner && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, marks: state.marks, sound: state.sound, calm: state.calm, big: state.big });
  const saveGame = () => { if (state.scene === 'play' && !state.game.winner && !state.take) { state.saved = { game: R.clone(state.game), human: state.human, two: state.two, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const dur = (d) => (state.calm ? d * 0.6 : d);
  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.8, to: f * 0.36, dur: 0.06, type: 'sine', vol: 0.11 });
  const reset = (extra) => Object.assign(state, { sel: -1, drag: null, take: null, anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS_PER_GAME, lessonGlow: null }, extra);
  const bottomSide = () => (state.two ? 1 : state.human);
  const penOf = (side) => (side === bottomSide() ? 'bottom' : 'top');
  const humanTurn = () => !state.game.winner && (state.two || state.game.turn === state.human);
  const refreshThreats = () => {
    // points where the side NOT to move could close a mill on its next move (shown as warnings)
    const g = state.game, o = R.other(g.turn), set = new Set();
    if (g.winner) { state.threats = []; return; }
    const h = { ...g, turn: o };
    for (const m of R.basicMoves(h, o)) if (R.makesMill(h, m)) set.add(m.to);
    state.threats = [...set].filter((i) => !g.board[i]);
  };

  function start(human, two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    thinker = hintThinker = null; pendingReply = null;
    reset({ scene: 'play', game: R.newGame(), human, two });
    say(two ? 'Dark begins: TAP an empty point to place a cow.' : human === 1 ? 'You are Dark and go first. TAP an empty point to place a cow.' : 'You are Light. Dark places first.');
    refreshThreats(); if (!humanTurn()) state.think = 0.6;
    monetization.track('game_start', { side: two ? 'two' : human, level: state.level });
  }
  function resume() {
    const v = state.saved; thinker = hintThinker = null;
    reset({ scene: 'play', game: R.clone(v.game), human: v.human, two: v.two, level: v.level ?? state.level, hintsLeft: v.hintsLeft ?? HINTS_PER_GAME });
    say('Game restored.'); refreshThreats(); if (!humanTurn()) state.think = 0.45;
  }
  function startLesson(i) {
    const l = LESSONS[i], g = R.newGame();
    g.board = boardOf(l.board); g.hand = [0, l.hand[0], l.hand[1]]; g.turn = 1;
    thinker = hintThinker = null; pendingReply = null;
    reset({ scene: 'lesson', game: g, human: 1, two: true, lesson: { i, step: 0, done: false } });
    setGlow();
  }
  const setGlow = () => { const L = state.lesson; if (!L || L.done) { state.lessonGlow = null; return; } const st = LESSONS[L.i].steps[L.step]; state.lessonGlow = st.want === 'take' ? null : (st.from && !state.sel >= 0 ? st.from : st.at) || null; if (st.from && state.sel >= 0) state.lessonGlow = st.at || null; };
  function startPuzzle() {
    thinker = hintThinker = null; pendingReply = null;
    const tries = state.pz?.tries ?? 0;
    if (!puzzleToday) { reset({ scene: 'puzzle', game: R.newGame(), pz: { status: 'making', puzzle: null, n: 0, tries, wrong: 0 } }); return; }
    reset({ scene: 'puzzle', game: puzzleGame(puzzleToday), human: puzzleToday.side, two: false, pz: { status: state.daily.solvedDay === state.daily.day ? 'solved' : 'ready', puzzle: puzzleToday, n: puzzleToday.n, tries, wrong: 0 } });
    say(state.pz.status === 'solved' ? 'Solved already today.' : 'TAP a cow, then a point, to make your move.', 6);
  }

  // ---- making moves ----
  const animOf = (m, side, extra = {}) => ({ type: m.type, kind: side, from: m.from, to: m.to, take: m.take ?? -1, tside: R.other(side), pen: penOf(side), hand: state.game.hand[side], t: 0, mdur: dur(m.type === 'fly' ? 0.5 : m.type === 'place' ? 0.36 : 0.3), sdur: (m.take ?? -1) >= 0 ? dur(0.6) : 0, ...extra });
  // Applies a full move with its animation.
  function play(m) {
    const g = state.game, side = g.turn;
    state.anim = animOf(m, side, { hand: g.hand[side] - (m.type === 'place' ? 1 : 0) });
    R.apply(g, m); state.sel = -1; state.hint = null; state.take = null;
    if (m.take >= 0) tone({ freq: 240, to: 70, dur: 0.3, type: 'sawtooth', vol: 0.08 }); else clack(m.type === 'place' ? 520 : 420);
    refreshThreats();
  }
  // A human basic move that closes a mill: the cow lands, then the player picks a cow to shoot.
  function beginTake(m) {
    const g = state.game, side = g.turn, b = g.board.slice();
    if (m.from >= 0) b[m.from] = 0; b[m.to] = side;
    state.anim = animOf({ ...m, take: -1 }, side, { hand: g.hand[side] - (m.type === 'place' ? 1 : 0) });
    state.take = { move: m, board: b, opts: R.shootable(g, R.other(side), b) };
    state.sel = -1; state.hint = null; clack(520); say('A mill! TAP a glowing cow to shoot it.', 8);
  }
  function finishTake(p) {
    const g = state.game, m = { ...state.take.move, take: p }, side = g.turn;
    state.anim = { type: 'shot', kind: side, from: m.from, to: m.to, take: p, tside: R.other(side), pen: penOf(side), hand: 0, t: 0, mdur: 0, sdur: dur(0.6) };
    R.apply(g, m); state.take = null; state.hint = null; state.sel = -1;
    tone({ freq: 240, to: 70, dur: 0.3, type: 'sawtooth', vol: 0.08 }); refreshThreats();
  }
  function refuse(from, to, why) {
    const g = state.game;
    state.anim = { type: 'refuse', kind: g.board[from] || g.turn, from, to, take: -1, tside: 0, pen: 'top', hand: 0, t: 0, mdur: dur(0.62), sdur: 0 };
    state.sel = -1; state.drag = null; say(why);
    tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.06 });
  }

  // What a tap on board point i means. Returns a basic move ({type, from, to}) when the tap completes one.
  function tapBoard(i) {
    const g = state.game, me = g.turn, there = g.board[i], ph = R.phase(g, me);
    if (state.take) {
      if (state.take.opts.includes(i)) return { take: i };
      say(R.whyNotTake({ ...g, board: state.take.board }, i)); return null;
    }
    if (ph === 'place') {
      if (!there) return { type: 'place', from: -1, to: i };
      if (there === me) refuse(i, i, R.whyNotMove(g, i, i)); else say('That point is taken by the other side. TAP an empty point.');
      return null;
    }
    if (state.sel < 0) {
      if (there === me) {
        if (!R.canMoveFrom(g, i).length) { refuse(i, i, 'This cow is blocked: every point next to it is taken.'); return null; }
        state.sel = i; clack(600); return null;
      }
      if (there) say(`It is ${NAME[me]}'s turn. TAP one of the ${NAME[me]} cows.`); else say('First TAP a cow to move, then TAP where it should go.');
      return null;
    }
    if (i === state.sel) { state.sel = -1; return null; }
    if (there === me) { if (R.canMoveFrom(g, i).length) { state.sel = i; clack(600); } else refuse(i, i, 'This cow is blocked: every point next to it is taken.'); return null; }
    const m = R.basicMoves(g).find((x) => x.from === state.sel && x.to === i);
    if (m) return m;
    refuse(state.sel, i, R.whyNotMove(g, state.sel, i)); return null;
  }

  // A tap result -> a move on the board (human, lesson or puzzle)
  function commit(r) {
    const g = state.game;
    if (r.take !== undefined) {
      if (state.scene === 'lesson' && !lessonOk(r)) return;
      finishTake(r.take);
      if (state.scene === 'puzzle') state.pz.shot = true;
      if (state.scene === 'lesson') lessonAdvance();
      return;
    }
    if (state.scene === 'lesson' && !lessonOk(r)) return;
    const mill = R.makesMill(g, r);
    if (state.scene === 'puzzle') {
      if (!puzzleGood(r, mill)) { wrongMove(r, mill); return; }
      if (!mill) state.pz.n -= 1;
    }
    if (state.scene === 'play') state.undo.push(R.clone(g));
    if (mill) { beginTake(r); if (state.scene === 'lesson') { state.lesson.step += 1; setGlow(); } return; }
    play({ ...r, take: -1 });
    if (state.scene === 'lesson') lessonAdvance();
  }
  function lessonAdvance() {
    const L = state.lesson, l = LESSONS[L.i]; L.step += 1;
    const prev = l.steps[L.step - 1];
    if (prev.reply && !state.game.winner) pendingReply = prev.reply;
    if (L.step >= l.steps.length || state.game.winner) L.done = true;
    tone({ freq: 660, to: 990, dur: 0.2, type: 'triangle', vol: 0.08 }); setGlow();
  }
  function lessonOk(r) {
    const L = state.lesson, l = LESSONS[L.i], st = l.steps[L.step];
    if (!st) return false;
    if (st.want === 'take') { const ok = r.take !== undefined && (!st.at || st.at.includes(r.take)); if (!ok) say(st.hint); return ok; }
    if (r.take !== undefined) return false;
    const kindOk = st.want === 'place' ? r.type === 'place' : st.want === 'move' ? r.type === 'move' : st.want === 'fly' ? r.type === 'fly' : st.want === 'win' ? r.type === 'move' && R.apply(R.clone(state.game), { ...r, take: -1 }).winner === 1 : false;
    const ok = kindOk && (!st.at || st.at.includes(r.to)) && (!st.from || st.from.includes(r.from));
    if (!ok) { state.sel = -1; say(st.hint); }
    return ok;
  }
  // puzzle: is this move on the proven line?
  function puzzleGood(m, mill) {
    const list = forcingFirst(state.game, state.pz.n) || [];
    return list.some((x) => x.type === m.type && x.to === m.to && x.from === m.from && (mill ? x.take >= 0 : x.take === -1));
  }
  function wrongMove(m, mill) {
    const P = state.pz; P.tries += 1; P.wrong = 1.4; state.sel = -1;
    say(P.n === 1 ? 'That does not close a mill.' : 'That gives the other side a way to defend.');
    play({ ...m, take: mill ? R.shootable(state.game, R.other(state.game.turn), (() => { const b = state.game.board.slice(); if (m.from >= 0) b[m.from] = 0; b[m.to] = state.game.turn; return b; })())[0] : -1 });
  }

  function finish() {
    const g = state.game;
    state.scene = 'over'; state.stats.games += 1; clearSave();
    if (!state.two && g.winner === state.human) { state.stats.wins += 1; state.stats.badges['s' + state.human + state.level] = true; }
    storage.set('stats', state.stats); storage.set('progress', { played: state.stats.games, wins: state.stats.wins });
    tone({ freq: g.winner === 'draw' ? 330 : 523, to: g.winner === 'draw' ? 330 : 784, dur: 0.4, type: 'triangle', vol: 0.09 });
    monetization.track('game_end', { winner: g.winner, moves: g.moves, level: state.level });
  }

  // ---- drag support: press on a cow, move, release on a point ----
  function updateDrag(input) {
    const p = input.pointer, g = state.game;
    if (p.pressed && !state.take && humanTurn() && R.phase(g, g.turn) !== 'place') {
      const i = pointNear(p.x, p.y);
      if (i >= 0 && g.board[i] === g.turn && R.canMoveFrom(g, i).length) state.drag = { from: i, x: p.x, y: p.y, moved: false, wasSel: state.sel === i };
    }
    if (state.drag) {
      if (p.down) { state.drag.x = p.x; state.drag.y = p.y; if (Math.hypot(p.x - pointAt(state.drag.from).x, p.y - pointAt(state.drag.from).y) > 26) { state.drag.moved = true; state.sel = state.drag.from; } }
      if (p.released) {
        const d = state.drag; state.drag = null;
        if (d.moved) {
          const i = pointNear(p.x, p.y);
          if (i >= 0 && i !== d.from) { const m = R.basicMoves(g).find((x) => x.from === d.from && x.to === i); if (m) return { move: m }; refuse(d.from, i, R.whyNotMove(g, d.from, i)); }
          return { handled: true };
        }
      }
    }
    return null;
  }

  // ---- scenes ----
  function updateTitle(tap) {
    for (let k = 0; k < 2 && !puzzleToday; k++) puzzleToday = maker.step().puzzle;
    if (!tap) return;
    const RW = titleRows(!!state.saved), hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(RW.resume)) resume();
    else if (hit(RW.learn)) startLesson(0);
    else if (hit(RW.dark)) start(1, false);
    else if (hit(RW.light)) start(2, false);
    else if (hit(RW.two)) start(1, true);
    else if (hit(RW.daily)) startPuzzle();
    else if (hit(RW.level)) { state.level = (state.level + 1) % LEVELS.length; savePrefs(); clack(); say(`${LEVELS[state.level].name}: ${LEVELS[state.level].blurb}`, 3); }
    else if (hit(RW.sound)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); savePrefs(); clack(); }
    else if (hit(RW.marks)) { state.marks = !state.marks; savePrefs(); clack(); }
    else if (hit(RW.calm)) { state.calm = !state.calm; savePrefs(); clack(); }
    else if (hit(RW.big)) { state.big = !state.big; savePrefs(); clack(); }
    else if (hit(RW.howto)) { state.info = { which: 'howto', page: 0 }; state.scene = 'info'; }
    else if (hit(RW.about)) { state.info = { which: 'about', page: 0 }; state.scene = 'info'; }
  }
  function updateInfo(tap) {
    if (!tap) return; const pages = PAGES[state.info.which];
    if (inRect(BTN.menu, tap.x, tap.y)) state.scene = 'title';
    else if (inRect({ x: 260, y: 1462, w: 200, h: 76 }, tap.x, tap.y) && state.info.page > 0) state.info.page -= 1;
    else if (inRect(BTN.nextPage, tap.x, tap.y) && state.info.page + 1 < pages.length) state.info.page += 1;
  }

  // shared by play, lesson and puzzle: the human's board input. Returns nothing; may start a move.
  function humanInput(input, tap) {
    const d = updateDrag(input);
    if (d?.move) { commit(d.move); return; }
    if (d?.handled) return;
    if (!tap) return;
    if (state.drag?.moved) return;
    const i = pointNear(tap.x, tap.y);
    if (i < 0) { if (!state.take) state.sel = -1; return; }
    if (state.drag && state.drag.wasSel && state.sel === i && !state.take) { state.drag = null; state.sel = -1; return; }
    const r = tapBoard(i);
    if (r) commit(r);
  }

  function updatePlay(dt, tap, input) {
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 5) state.hint = null; }
    if (state.anim) {
      state.anim.t += dt;
      if (state.anim.t >= state.anim.mdur + state.anim.sdur) { const wasRefuse = state.anim.type === 'refuse'; state.anim = null; if (wasRefuse) return; if (state.take) return; if (state.game.winner) finish(); else { saveGame(); if (!humanTurn()) state.think = 0.5; } }
      return;
    }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; state.drag = null; return; }
    if (!humanTurn() && !state.game.winner) {
      state.think -= dt; if (state.think > 0) return;
      if (!thinker) { thinker = createThinker(state.game, state.level, rng); state.thinking = true; }
      const r = thinker.step();
      if (r.move !== undefined) { thinker = null; state.thinking = false; if (r.move) play(r.move); }
      return;
    }
    if (hintThinker) {
      const r = hintThinker.step();
      if (r.move !== undefined) { hintThinker = null; state.thinking = false; if (r.move) { state.hint = { from: r.move.from, to: r.move.to, take: r.move.take, t: 0 }; say(hintReason(state.game, r.move), 7); } }
      return;
    }
    const wantUndo = tap && inRect(BTN.undo, tap.x, tap.y) || input.keys.pressed.has('KeyU'), wantHint = tap && inRect(BTN.hint, tap.x, tap.y) || input.keys.pressed.has('KeyH');
    if (wantUndo) {
      if (state.take) { state.take = null; state.sel = -1; say('Move taken back.'); clack(360); }
      else if (state.undo.length) { state.game = state.undo.pop(); state.sel = -1; state.hint = null; state.drag = null; say('Move taken back.'); clack(360); saveGame(); refreshThreats(); }
      else say('Nothing to take back yet.');
      return;
    }
    if (wantHint) { if (state.hintsLeft <= 0) say('No hints left in this game.'); else if (state.take) say('TAP a glowing cow to shoot it.'); else { state.hintsLeft -= 1; hintThinker = createThinker(state.game, 2, rng); state.thinking = true; state.sel = -1; say('Thinking…', 3); } return; }
    if (state.game.winner) return;
    humanInput(input, tap);
  }

  function updateLesson(dt, tap, input) {
    const L = state.lesson, l = LESSONS[L.i];
    if (state.anim) {
      state.anim.t += dt;
      if (state.anim.t >= state.anim.mdur + state.anim.sdur) {
        const wasRefuse = state.anim.type === 'refuse'; state.anim = null;
        if (!wasRefuse && pendingReply && !state.take) { const r = pendingReply; pendingReply = null; play({ ...r }); }
      }
      return;
    }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (L.done) {
      if (tap && inRect(BTN.next, tap.x, tap.y)) {
        if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try Dark against the Herder.', 7); }
      }
      return;
    }
    humanInput(input, tap); setGlow();
  }

  function updatePuzzle(dt, tap, input) {
    const P = state.pz;
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (P.status === 'making') { for (let k = 0; k < 2 && !puzzleToday; k++) puzzleToday = maker.step().puzzle; if (puzzleToday) startPuzzle(); return; }
    if (state.anim) {
      state.anim.t += dt;
      if (state.anim.t < state.anim.mdur + state.anim.sdur) return;
      const type = state.anim.type; state.anim = null;
      if (type === 'refuse' || state.take || P.wrong > 0) return;
      const g = state.game;
      if (P.shot) { P.status = 'solved'; P.shot = false; if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); } say('Solved!', 6); tone({ freq: 523, to: 1046, dur: 0.4, type: 'triangle', vol: 0.09 }); return; }
      if (g.turn !== P.puzzle.side && !g.winner) { const reply = chooseMove(g, 1, rng); if (reply) play(reply); }
      return;
    }
    if (P.wrong > 0) { P.wrong -= dt; if (P.wrong <= 0) { state.game = puzzleGame(P.puzzle); P.n = P.puzzle.n; P.wrong = 0; state.take = null; state.anim = null; say('Set up again. Look for the move that cannot be answered.'); refreshThreats(); } return; }
    if (P.status === 'solved') { if (tap && inRect(BTN.share, tap.x, tap.y)) env.share(`Morabaraba daily puzzle: solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' first try'}. Streak ${state.daily.streak}.`); return; }
    humanInput(input, tap);
  }

  // A short reason for a hint
  function hintReason(g, m) {
    const me = g.turn, o = R.other(me);
    if (m.take >= 0) return `Hint: this ${m.type === 'place' ? 'placement' : 'move'} closes a mill, so you shoot a cow.`;
    const tests = R.mills.filter((mm) => mm.includes(m.to));
    if (tests.some((mm) => mm.filter((p) => p !== m.to).every((p) => g.board[p] === o))) return 'Hint: this blocks a mill the other side was about to close.';
    const after = g.board.slice(); if (m.from >= 0) after[m.from] = 0; after[m.to] = me;
    if (R.mills.some((mm) => mm.includes(m.to) && mm.filter((p) => after[p] === me).length === 2 && mm.some((p) => !after[p]))) return 'Hint: this sets up two cows in a line with the third point open: a mill threat.';
    if (m.from >= 0 && R.inMillAt(g.board, m.from, me)) return 'Hint: this opens your mill so you can close it again and shoot.';
    if (R.adj[m.to].length >= 4) return 'Hint: a strong crossroads: more lines, so your cows stay free to move.';
    return 'Hint: keeps your cows mobile and the position safe.';
  }

  // Keyboard (web demo): arrows move a cursor to the nearest point in that direction; Space/Enter TAP it; Escape = Menu.
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene;
    if (input.pointer.pressed) { state.kb = false; return null; }
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) return { key: 'start' }; return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return { x: BTN.again.x + 5, y: BTN.again.y + 5 }; return null; }
    if (sc === 'info' || sc === 'demo-limit') { if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 }; if (k.has('ArrowRight')) return { x: BTN.nextPage.x + 5, y: BTN.nextPage.y + 5 }; return null; }
    if (sc !== 'play' && sc !== 'lesson' && sc !== 'puzzle') return null;
    if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 };
    if (sc === 'lesson' && state.lesson.done && (k.has('Enter') || k.has('Space'))) return { x: BTN.next.x + 5, y: BTN.next.y + 5 };
    let dx = 0, dy = 0;
    if (k.has('ArrowLeft')) dx = -1; else if (k.has('ArrowRight')) dx = 1; else if (k.has('ArrowUp')) dy = -1; else if (k.has('ArrowDown')) dy = 1;
    if (dx || dy) {
      state.kb = true; const [cu, cv] = POINT_UV[state.cursor]; let best = -1, bs = Infinity;
      for (let i = 0; i < 24; i++) { if (i === state.cursor) continue; const du = POINT_UV[i][0] - cu, dv = POINT_UV[i][1] - cv, along = du * dx + dv * dy, across = Math.abs(du * dy) + Math.abs(dv * dx); if (along <= 0) continue; const sc2 = along + across * 2.2; if (sc2 < bs) { bs = sc2; best = i; } }
      if (best >= 0) state.cursor = best; return null;
    }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; const p = pointAt(state.cursor); return { x: p.x, y: p.y }; }
    return null;
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      const p = input.pointer, kbd = keyboard(input);
      let tap = p.pressed ? { x: p.x, y: p.y } : kbd && kbd.x !== undefined ? kbd : null;
      if (kbd && kbd.key === 'start') { const r = titleRows(!!state.saved); tap = { x: (r.resume || r.learn).x + 5, y: (r.resume || r.learn).y + 5 }; if (!r.resume && state.learned) tap = { x: r.dark.x + 5, y: r.dark.y + 5 }; }
      if (state.scene === 'title') updateTitle(tap);
      else if (state.scene === 'info') updateInfo(tap);
      else if (state.scene === 'play') updatePlay(dt, tap, input);
      else if (state.scene === 'lesson') updateLesson(dt, tap, input);
      else if (state.scene === 'puzzle') updatePuzzle(dt, tap, input);
      else if (state.scene === 'demo-limit') { if (tap && inRect(BTN.menu, tap.x, tap.y)) state.scene = 'title'; }
      else if (state.scene === 'over' && tap) {
        if (inRect(BTN.again, tap.x, tap.y)) start(state.human, state.two);
        else if (inRect(BTN.back, tap.x, tap.y)) state.scene = 'title';
      }
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
  };
}
