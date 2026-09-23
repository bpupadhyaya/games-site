// Konane: state and flow. Drawing is in view.js, the rule book in rules.js, the computer's brain in engine.js; lessons.js,
// puzzles.js and content.js are content. See design/GDD.md for the map.
// How a move is made: TAP a stone (it lifts, its landing squares glow), then TAP a landing square. An impossible move visibly TRIES:
// the stone slides toward the square, shudders, comes back, and a message says why.
import { W, H, BTN, SETUP, HELP, TEXTSTEP, TEXT_SCALES, titleRows, inRect, squareAt, cellCenter } from './layout.js';
import { newGame, clone, applyMove, tryMove, legalMoves, jumpsFrom, overSquares, countMoves, NAMES } from './rules.js';
import { LEVELS, createThinker, fromRules } from './engine.js';
import { LESSONS, lessonGame } from './lessons.js';
import { createPuzzleMaker, puzzleGame, isPuzzleSolution } from './puzzles.js';
import { HELP_PAGES, ABOUT, RULES } from './content.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, HINTS = 3;
void fromRules;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, game: newGame(6), human: 1, two: false, level: 1, cfg: { n: 6, side: 1, level: 1 },
    sound: true, calm: false, textScaleIdx: 0, marks: true, cursor: 0, kb: false, canAct: false,
    sel: -1, anim: null, msg: null, think: 0, thinking: false, undo: [], hintsLeft: HINTS, hint: null,
    stats: { games: 0, wins: 0, badges: {} }, saved: null, learned: false, demoGames: 0, lesson: null, pz: null, page: 0,
    daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 }, demo: null, dev: config.dev === true,
  };
  let thinker = null, hintThinker = null, puzzleToday = null;
  const maker = createPuzzleMaker(state.daily.day), demoRng = rng.fork();

  storage.get('prefs', null).then((v) => { if (v) { state.cfg = { ...state.cfg, ...(v.cfg || {}) }; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.textScaleIdx = Math.min(Math.max((v.textScaleIdx ?? (v.big ? TEXT_SCALES.length - 1 : 0)) | 0, 0), TEXT_SCALES.length - 1); audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && !v.game.winner && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { cfg: state.cfg, sound: state.sound, calm: state.calm, textScaleIdx: state.textScaleIdx });
  const saveGame = () => { if (state.scene === 'play' && !state.game.winner) { state.saved = { game: clone(state.game), human: state.human, two: state.two, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const dur = (d) => (state.calm ? d * 0.6 : d);
  const say = (text, hold = 5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.8, to: f * 0.36, dur: 0.06, type: 'sine', vol: 0.11 });
  const reset = (extra) => Object.assign(state, { sel: -1, anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS, page: 0 }, extra);
  const hopsOf = (n, m) => overSquares(n, m.from, m.to).length;

  function start() {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    const { n, side, level } = state.cfg;
    thinker = hintThinker = null;
    reset({ scene: 'play', game: newGame(n), human: side || 1, two: side === 0, level });
    say(side === 0 ? 'Black opens: TAP a glowing black stone to remove it.' : side === 1 ? 'You are Black. TAP a glowing black stone to remove it and open the game.' : 'You are White. The computer (Black) opens.');
    if (side === 2) state.think = 0.6;
    monetization.track('game_start', { n, side, level });
  }
  function resume() {
    const v = state.saved; thinker = hintThinker = null;
    reset({ scene: 'play', game: clone(v.game), human: v.human, two: v.two, level: v.level ?? 1, hintsLeft: v.hintsLeft ?? HINTS });
    say('Game restored.');
    if (!(state.two || state.game.turn === state.human)) state.think = 0.45;
  }
  function startLesson(i) { thinker = hintThinker = null; reset({ scene: 'lesson', game: lessonGame(LESSONS[i]), human: LESSONS[i].turn, two: true, lesson: { i, done: false } }); }
  function startPuzzle() {
    thinker = hintThinker = null;
    const tries = state.pz?.tries ?? 0;
    if (!puzzleToday) { reset({ scene: 'puzzle', game: newGame(6), pz: { status: 'making', puzzle: null, tries, wrong: 0 } }); return; }
    reset({ scene: 'puzzle', game: puzzleGame(puzzleToday), two: true, pz: { status: state.daily.solvedDay === state.daily.day ? 'solved' : 'ready', puzzle: puzzleToday, tries, wrong: 0 } });
    say('One jump wins. TAP a stone, then a glowing square.', 6);
  }
  const humanTurn = () => !state.game.winner && (state.two || state.game.turn === state.human);

  // Build the animation for move m on game g (before it is applied).
  function mkAnim(g, m) {
    if (m.type === 'remove') return { type: 'remove', kind: g.b[m.at], at: m.at, t: 0, dur: dur(0.5) };
    const n = g.n, overs = overSquares(n, m.from, m.to), path = [m.from];
    let cur = m.from; for (let k = 0; k < overs.length; k++) { cur = cur + 2 * (overs[k] - cur); path.push(cur); }
    return { type: 'jump', kind: g.b[m.from], path, from: m.from, to: m.to, caps: overs.map((at, k) => ({ at, kind: g.b[at], side: k % 2 ? -1 : 1 })), t: 0, dur: dur(0.42 * overs.length + 0.08) };
  }
  function play(m) {
    state.anim = mkAnim(state.game, m);
    applyMove(state.game, m); state.sel = -1; state.hint = null;
    if (m.type === 'jump') { tone({ freq: 300, to: 90, dur: 0.2, type: 'sawtooth', vol: 0.06 }); clack(520); } else clack(380);
  }
  function refuse(from, to, why) {
    state.anim = { type: 'refuse', kind: state.game.b[from], from, to, t: 0, dur: dur(0.62) };
    state.sel = -1; say(why);
    tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.06 });
    if (state.scene === 'lesson' && LESSONS[state.lesson.i].want === 'refused' && from === LESSONS[state.lesson.i].from && from !== to) state.lesson.done = true;
  }

  // What a tap on square i means. Returns the legal move chosen, or null.
  function tapBoard(i) {
    const g = state.game, me = g.turn, there = g.b[i];
    if (g.ply < 2) {
      const m = legalMoves(g).find((x) => x.at === i);
      if (m) return m;
      say(me === 1 ? 'Black may only remove a black stone from a corner or from the middle. TAP a glowing stone.' : 'White removes a white stone that touches the empty square. TAP a glowing stone.');
      return null;
    }
    if (state.sel < 0) {
      if (there === me) { if (jumpsFrom(g, i).length) { state.sel = i; clack(600); } else say('That stone has no jump right now. Stones ringed in gold can jump.'); }
      else if (there) say(`That is a ${NAMES[there].toLowerCase()} stone. It is ${NAMES[me]}'s turn: TAP a ${NAMES[me].toLowerCase()} stone.`);
      else say(`First TAP one of your ${NAMES[me].toLowerCase()} stones, then TAP a glowing square.`);
      return null;
    }
    if (i === state.sel) { state.sel = -1; return null; }
    if (there === me) { if (jumpsFrom(g, i).length) { state.sel = i; clack(600); } else { state.sel = -1; say('That stone has no jump right now.'); } return null; }
    const r = tryMove(g, state.sel, i);
    if (r.move) return r.move;
    refuse(state.sel, i, r.error); return null;
  }

  function finish() {
    const g = state.game;
    state.scene = 'over'; state.stats.games += 1; clearSave();
    if (!state.two && g.winner === state.human) { state.stats.wins += 1; state.stats.badges[`${g.n}-${state.level}`] = true; }
    storage.set('stats', state.stats); storage.set('progress', { played: state.stats.games, wins: state.stats.wins });
    tone({ freq: 523, to: 784, dur: 0.4, type: 'triangle', vol: 0.09 });
    monetization.track('game_end', { winner: g.winner, moves: g.moves, level: state.level });
  }

  // ---- per-scene updates ----
  function tickDemo(dt) {
    let D = state.demo;
    if (!D) D = state.demo = { g: newGame(6), anim: null, timer: 1.2 };
    if (D.anim) { D.anim.t += dt; if (D.anim.t >= D.anim.dur) D.anim = null; }
    else if ((D.timer -= dt) <= 0) {
      const ms = legalMoves(D.g);
      if (D.g.winner || !ms.length) { D.g = newGame(6); D.timer = 1.4; } else {
        const m = ms[demoRng.int(ms.length)];
        if (m.type === 'remove') { applyMove(D.g, m); D.timer = 0.3; } else { D.anim = mkAnim(D.g, m); applyMove(D.g, m); D.timer = 0.55; }
      }
    }
  }
  function updateTitle(dt, tap) {
    for (let k = 0; k < 3 && !puzzleToday; k++) puzzleToday = maker.step().puzzle;
    tickDemo(dt);
    if (!tap) return;
    const R = titleRows(!!state.saved), hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(R.resume)) resume();
    else if (hit(R.play)) state.scene = 'setup';
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.daily)) startPuzzle();
    else if (hit(R.how)) { state.scene = 'help'; state.page = 0; }
    else if (hit(R.about)) { state.scene = 'about'; state.page = 0; }
    else if (hit(R.rules)) { state.scene = 'rules'; state.page = 0; }
    else if (hit(R.sound)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); savePrefs(); clack(); }
    else if (hit(R.calm)) { state.calm = !state.calm; savePrefs(); clack(); }
    // Quick shortcut: jump straight to the smallest or the largest step. Fine-grained control lives
    // right on the How to play/About/Rules pages themselves (the A-/A+ stepper), where the text is.
    else if (hit(R.big)) { state.textScaleIdx = state.textScaleIdx > 0 ? 0 : TEXT_SCALES.length - 1; savePrefs(); clack(); }
  }
  function updateSetup(dt, tap) {
    tickDemo(dt);
    if (!tap) return;
    const C = state.cfg;
    SETUP.sizes.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { C.n = [6, 8, 10][i]; savePrefs(); clack(); } });
    SETUP.sides.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { C.side = [1, 2, 0][i]; savePrefs(); clack(); } });
    SETUP.levels.forEach((r, i) => { if (inRect(r, tap.x, tap.y) && C.side !== 0) { C.level = i; savePrefs(); clack(); } });
    if (inRect(SETUP.start, tap.x, tap.y)) start();
    else if (inRect(SETUP.back, tap.x, tap.y)) state.scene = 'title';
  }
  function updatePages(dt, tap, pages) {
    tickDemo(dt);
    if (!tap) return;
    if (inRect(HELP.back, tap.x, tap.y)) state.scene = 'title';
    else if (inRect(HELP.next, tap.x, tap.y)) { state.page = (state.page + 1) % pages.length; clack(); }
    else if (inRect(HELP.prev, tap.x, tap.y)) { state.page = (state.page + pages.length - 1) % pages.length; clack(); }
    else if (inRect(TEXTSTEP.dec, tap.x, tap.y) && state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); clack(); }
    else if (inRect(TEXTSTEP.inc, tap.x, tap.y) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); clack(); }
  }

  function hintText(m) {
    const g = state.game, me = g.turn;
    if (m.type === 'remove') return `Hint: remove the glowing ${NAMES[g.b[m.at]].toLowerCase()} stone.`;
    const after = applyMove(clone(g), m);
    if (after.winner === me) return 'Hint: this jump wins. Your opponent will have no jump left.';
    const mine = countMoves(after, me), theirs = countMoves(after, 3 - me), hops = hopsOf(g.n, m);
    return `Hint: ${hops > 1 ? 'jump ' + hops + ' stones' : 'jump'} from the green stone to the green square. Afterwards you would have ${mine} jump${mine === 1 ? '' : 's'} and your opponent ${theirs}.`;
  }

  function updatePlay(dt, tap) {
    state.canAct = false;
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 6) state.hint = null; }
    if (state.anim) {
      state.anim.t += dt;
      if (state.anim.t >= state.anim.dur) { state.anim = null; if (state.game.winner) finish(); else { saveGame(); if (!humanTurn()) state.think = 0.45; } }
      return;
    }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return; }
    if (!humanTurn()) {
      state.think -= dt;
      if (state.think > 0) return;
      if (!thinker) { thinker = createThinker(state.game, state.level, rng); state.thinking = true; }
      const r = thinker.step();
      if (r.move !== undefined) { thinker = null; state.thinking = false; if (r.move) play(r.move); }
      return;
    }
    state.canAct = !hintThinker;
    if (hintThinker) {
      const r = hintThinker.step();
      if (r.move !== undefined) { hintThinker = null; state.thinking = false; if (r.move) { state.hint = { from: r.move.from ?? -1, to: r.move.to ?? r.move.at, t: 0 }; say(hintText(r.move), 8); } }
      return;
    }
    if (tap && inRect(BTN.undo, tap.x, tap.y)) {
      if (state.undo.length) { state.game = state.undo.pop(); state.sel = -1; state.hint = null; say('Move taken back.'); clack(360); saveGame(); } else say('Nothing to take back yet.');
      return;
    }
    if (tap && inRect(BTN.hint, tap.x, tap.y)) {
      if (state.hintsLeft <= 0) say('No hints left in this game.');
      else { state.hintsLeft -= 1; hintThinker = createThinker(state.game, 2, rng); state.thinking = true; state.sel = -1; }
      return;
    }
    if (!tap) return;
    const i = squareAt(state.game.n, tap.x, tap.y);
    if (i < 0) { state.sel = -1; return; }
    const m = tapBoard(i);
    if (m) { state.undo.push(clone(state.game)); play(m); }
  }

  function updateLesson(dt, tap) {
    const L = state.lesson, l = LESSONS[L.i];
    state.canAct = !state.anim && !L.done;
    if (state.anim) { state.anim.t += dt; if (state.anim.t >= state.anim.dur) state.anim = null; return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (L.done) {
      if (tap && inRect({ x: 265, y: BTN.next.y, w: 395, h: BTN.next.h }, tap.x, tap.y)) {
        if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try Play against the Easy computer.', 7); }
      }
      return;
    }
    if (!tap) return;
    const i = squareAt(state.game.n, tap.x, tap.y);
    if (i < 0) { state.sel = -1; return; }
    const m = tapBoard(i);
    if (!m) return;
    let ok = false;
    if (l.want === 'remove') ok = m.type === 'remove';
    else if (m.type === 'jump') {
      const after = applyMove(clone(state.game), m);
      ok = (l.want !== 'win' || after.winner === l.turn) && hopsOf(state.game.n, m) >= (l.hops ?? 1) && (!l.at || l.at.includes(m.to)) && l.want !== 'refused';
    }
    if (ok) { play(m); state.game.winner = 0; L.done = true; tone({ freq: 660, to: 990, dur: 0.2, type: 'triangle', vol: 0.08 }); }
    else { state.sel = -1; say(l.hint ?? (l.want === 'refused' ? 'That move is allowed. Try the one in the lesson text.' : 'Not that one. Read the line above and try again.')); }
  }

  function updatePuzzle(dt, tap) {
    const P = state.pz;
    state.canAct = false;
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (P.status === 'making') { for (let k = 0; k < 3 && !puzzleToday; k++) puzzleToday = maker.step().puzzle; if (puzzleToday) startPuzzle(); return; }
    if (state.anim) {
      state.anim.t += dt;
      if (state.anim.t < state.anim.dur) return;
      state.anim = null;
      if (P.wrong > 0) return;
      P.status = 'solved'; state.game.winner = 0;
      if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); }
      say('Solved! That was the only jump that wins by force.', 7); tone({ freq: 523, to: 1046, dur: 0.4, type: 'triangle', vol: 0.09 });
      return;
    }
    if (P.wrong > 0) { P.wrong -= dt; if (P.wrong <= 0) { state.game = puzzleGame(P.puzzle); P.wrong = 0; say('Set up again. Look for a jump that leaves them stuck.'); } return; }
    if (P.status === 'solved') { if (tap && inRect(BTN.share, tap.x, tap.y)) env.share(`Konane daily puzzle: solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' first try'}. Streak ${state.daily.streak}.`); return; }
    state.canAct = true;
    if (!tap) return;
    const i = squareAt(state.game.n, tap.x, tap.y);
    if (i < 0) { state.sel = -1; return; }
    const m = tapBoard(i);
    if (!m) return;
    play(m);
    if (!isPuzzleSolution(P.puzzle, m)) { P.tries += 1; P.wrong = 1.6; say(`That lets ${NAMES[state.game.turn]} win by force. Try another jump.`); }
  }

  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene;
    if (input.pointer.pressed) { state.kb = false; return null; }
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) return { x: titleRows(!!state.saved).play.x + 5, y: titleRows(!!state.saved).play.y + 5 }; return null; }
    if (sc === 'setup') { if (k.has('Enter') || k.has('Space')) return { x: SETUP.start.x + 5, y: SETUP.start.y + 5 }; if (k.has('Escape')) return { x: SETUP.back.x + 5, y: SETUP.back.y + 5 }; return null; }
    if (sc === 'help' || sc === 'about' || sc === 'rules') { if (k.has('ArrowRight') || k.has('Enter') || k.has('Space')) return { x: HELP.next.x + 5, y: HELP.next.y + 5 }; if (k.has('ArrowLeft')) return { x: HELP.prev.x + 5, y: HELP.prev.y + 5 }; if (k.has('Escape')) return { x: HELP.back.x + 5, y: HELP.back.y + 5 }; return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return { x: BTN.again.x + 5, y: BTN.again.y + 5 }; return null; }
    if (sc !== 'play' && sc !== 'lesson' && sc !== 'puzzle') return null;
    if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 };
    if (k.has('KeyU')) return { x: BTN.undo.x + 5, y: BTN.undo.y + 5 };
    if (k.has('KeyH')) return { x: BTN.hint.x + 5, y: BTN.hint.y + 5 };
    const n = state.game.n; let dx = 0, dy = 0;
    if (k.has('ArrowLeft')) dx = -1; else if (k.has('ArrowRight')) dx = 1; else if (k.has('ArrowUp')) dy = -1; else if (k.has('ArrowDown')) dy = 1;
    if (dx || dy) { state.kb = true; const x = Math.max(0, Math.min(n - 1, (state.cursor % n) + dx)), y = Math.max(0, Math.min(n - 1, Math.floor(state.cursor / n) + dy)); state.cursor = x + n * y; return null; }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; const p = cellCenter(n, Math.min(state.cursor, n * n - 1)); return { x: p.x, y: p.y }; }
    return null;
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      const p = input.pointer, kbd = keyboard(input), tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      const sc = state.scene;
      if (sc === 'title') updateTitle(dt, tap);
      else if (sc === 'setup') updateSetup(dt, tap);
      else if (sc === 'help') updatePages(dt, tap, HELP_PAGES);
      else if (sc === 'about') updatePages(dt, tap, ABOUT);
      else if (sc === 'rules') updatePages(dt, tap, RULES);
      else if (sc === 'play') updatePlay(dt, tap);
      else if (sc === 'lesson') updateLesson(dt, tap);
      else if (sc === 'puzzle') updatePuzzle(dt, tap);
      else if (sc === 'demo-limit') { if (tap && inRect(BTN.back, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'over' && tap) {
        if (inRect(BTN.again, tap.x, tap.y)) start();
        else if (inRect(BTN.back, tap.x, tap.y)) state.scene = 'title';
      }
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
  };
}
