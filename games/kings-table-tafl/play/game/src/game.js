// Tafl (Hnefatafl): state and flow. Rules: rules.js. The computer: engine.js. Drawing: view.js.
// Content: lessons.js, puzzles.js, pages.js. See design/ARCHITECTURE.md for the map.
//
// How a move is made: TAP a piece (it lifts, its legal squares glow), then TAP a glowing square; or DRAG the
// piece and drop it. An illegal move visibly TRIES (the piece travels toward the square, shudders and comes
// back) and a message says why.
import { W, H, BTN, titleRows, inRect, squareAt, centerOf, PAGE_NEXT, TEXT_DEC, TEXT_INC, TEXT_SCALES } from './layout.js';
import { newGame, fromRows, clone, applyMove, tryMove, legalMoves, openCorners, side, NAME, ATT, DEF, key } from './rules.js';
import { LEVELS, createThinker } from './engine.js';
import { LESSONS } from './lessons.js';
import { createPuzzleMaker, puzzleGame, bestReply } from './puzzles.js';
import { PAGES, RULES } from './pages.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, HINTS_PER_GAME = 3;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, game: newGame(11), size: 11, human: DEF, two: false, level: 1,
    sound: true, calm: false, big: false, marks: true,
    textScaleIdx: 0, // index into TEXT_SCALES; the About/Controls/Rules reference pages' own text size
    cursor: 60, kb: false, sel: -1, drag: null, anim: null, msg: null, think: 0, thinking: false, undo: [],
    hintsLeft: HINTS_PER_GAME, hint: null,
    stats: { games: 0, wins: 0, badges: {} }, saved: null, learned: false, demoGames: 0,
    lesson: null, page: 0, pz: null,
    daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 },
    dev: config.dev === true,
  };
  let thinker = null, hintThinker = null, puzzleToday = null;
  const maker = createPuzzleMaker(state.daily.day);

  storage.get('prefs', null).then((v) => { if (v) { state.level = v.level ?? 1; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.big = v.big ?? false; state.marks = v.marks ?? true; state.human = v.human ?? DEF; state.textScaleIdx = Math.min(Math.max(v.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1); audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && !v.game.winner && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, big: state.big, marks: state.marks, human: state.human, textScaleIdx: state.textScaleIdx });
  const saveGame = () => { if (state.scene === 'play' && !state.game.winner) { state.saved = { game: clone(state.game), human: state.human, two: state.two, level: state.level, size: state.size, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const dur = (d) => (state.calm ? d * 0.6 : d);
  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.8, to: f * 0.36, dur: 0.06, type: 'sine', vol: 0.11 });
  const reset = (extra) => Object.assign(state, { sel: -1, drag: null, anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS_PER_GAME }, extra);
  const humanTurn = () => !state.game.winner && (state.two || state.game.turn === state.human);
  const N = () => state.game.n;

  function start(size, human, two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    thinker = hintThinker = null;
    reset({ scene: 'play', game: newGame(size), size, human, two });
    say(two ? 'Attackers begin. TAP a dark piece, then TAP a glowing square.' : human === ATT ? 'You are the attackers. TAP a dark piece, then a glowing square.' : 'You are the defenders. The attackers move first.');
    if (!two && human === DEF) state.think = 0.9;
    monetization.track('game_start', { size, side: two ? 'two' : human, level: state.level });
  }
  function resume() {
    const v = state.saved; thinker = hintThinker = null;
    reset({ scene: 'play', game: clone(v.game), size: v.size ?? v.game.n, human: v.human, two: v.two, level: v.level ?? state.level, hintsLeft: v.hintsLeft ?? HINTS_PER_GAME });
    say('Game restored.');
    if (!humanTurn()) state.think = 0.45;
  }
  function startLesson(i) {
    const l = LESSONS[i], g = fromRows(l.rows, l.turn); g.seen[key(g)] = 1;
    thinker = hintThinker = null;
    reset({ scene: 'lesson', game: g, size: 7, human: l.turn, two: true, lesson: { i, done: false } });
  }
  function startPuzzle() {
    thinker = hintThinker = null;
    const tries = state.pz?.tries ?? 0;
    if (!puzzleToday) { reset({ scene: 'puzzle', game: newGame(7), pz: { status: 'making', puzzle: null, tries, wrong: 0, step: 0 } }); return; }
    const g = puzzleGame(puzzleToday);
    reset({ scene: 'puzzle', game: g, size: puzzleToday.n, human: DEF, two: false, pz: { status: state.daily.solvedDay === state.daily.day ? 'solved' : 'ready', puzzle: puzzleToday, tries, wrong: 0, step: 0 } });
  }

  // Animate a legal move and apply it to the rule book.
  function play(m) {
    const g = state.game, v = g.b[m.from];
    const caps = applyMove(g, m);
    state.anim = { type: 'move', v, from: m.from, to: m.to, caps, t: 0, dur: dur(0.28) };
    state.sel = -1; state.hint = null; state.drag = null;
    if (caps.length) { tone({ freq: 210, to: 70, dur: 0.2, type: 'triangle', vol: 0.12 }); clack(760); } else clack(v === DEF || v === 3 ? 470 : 380);
  }
  function refuse(from, to, why) {
    state.anim = { type: 'refuse', v: state.game.b[from], from, to, caps: [], t: 0, dur: dur(0.62) };
    state.sel = -1; state.drag = null; say(why);
    tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.06 });
    if (state.scene === 'lesson' && LESSONS[state.lesson.i].want === 'refused' && from !== to) state.lesson.done = true;
  }
  function tapBoard(i) {
    const g = state.game, me = g.turn, v = g.b[i];
    if (state.sel < 0) {
      if (v && side(v) === me) { state.sel = i; clack(600); }
      else if (v) say(`It is the ${NAME[me]}' turn. TAP one of the ${NAME[me]}.`);
      else say(`First TAP the piece you want to move, then TAP where it should go.`);
      return null;
    }
    if (i === state.sel) { state.sel = -1; return null; }
    if (v && side(v) === me) { state.sel = i; clack(600); return null; }
    const r = tryMove(g, state.sel, i);
    if (r.move) return r.move;
    refuse(state.sel, i, r.error); return null;
  }

  function finish() {
    const g = state.game;
    state.scene = 'over'; state.stats.games += 1; clearSave();
    if (!state.two && g.winner === state.human) { state.stats.wins += 1; state.stats.badges[`${state.human}_${state.size}_${state.level}`] = true; }
    storage.set('stats', state.stats);
    storage.set('progress', { played: state.stats.games, wins: state.stats.wins });
    tone({ freq: g.winner === 'draw' ? 330 : 523, to: g.winner === 'draw' ? 330 : 784, dur: 0.4, type: 'triangle', vol: 0.09 });
    monetization.track('game_end', { winner: g.winner, plies: g.ply, level: state.level, size: state.size });
  }

  // ---- per-scene updates --------------------------------------------------------------------------------
  function updateTitle(tap) {
    for (let k = 0; k < 3 && !puzzleToday; k++) puzzleToday = maker.step().puzzle;
    if (!tap) return;
    const R = titleRows(!!state.saved), hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(R.resume)) resume();
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.big)) start(11, state.human, false);
    else if (hit(R.small)) start(7, state.human, false);
    else if (hit(R.daily)) startPuzzle();
    else if (hit(R.two)) start(state.size === 7 ? 7 : 11, ATT, true);
    else if (hit(R.side)) { state.human = state.human === DEF ? ATT : DEF; savePrefs(); clack(); }
    else if (hit(R.level)) { state.level = (state.level + 1) % LEVELS.length; savePrefs(); clack(); say(LEVELS[state.level].says, 5); }
    else if (hit(R.sound)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); savePrefs(); clack(); }
    else if (hit(R.calm)) { state.calm = !state.calm; savePrefs(); clack(); }
    else if (hit(R.text)) { state.big = !state.big; savePrefs(); clack(); }
    else if (hit(R.about)) { state.scene = 'about'; state.page = 0; }
    else if (hit(R.help)) { state.scene = 'help'; state.page = 0; }
    else if (hit(R.rules)) { state.scene = 'rules'; state.page = 0; }
  }

  function updatePages(tap, which) {
    const pages = which === 'rules' ? RULES : PAGES[which];
    if (!tap) return;
    if (inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (inRect(TEXT_DEC, tap.x, tap.y)) { if (state.textScaleIdx > 0) { state.textScaleIdx -= 1; savePrefs(); clack(); } return; }
    if (inRect(TEXT_INC, tap.x, tap.y)) { if (state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx += 1; savePrefs(); clack(); } return; }
    if (inRect(PAGE_NEXT, tap.x, tap.y)) { if (state.page + 1 < pages.length) state.page += 1; else state.scene = 'title'; clack(); return; }
    if (inRect(BTN.undo, tap.x, tap.y) && state.page > 0) { state.page -= 1; clack(); }
  }

  function onSquarePlay(i) { const m = tapBoard(i); if (m) { state.undo.push(clone(state.game)); play(m); } }

  function updatePlay(dt, tap, sq) {
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 4) state.hint = null; }
    if (state.anim) {
      state.anim.t += dt;
      if (state.anim.t >= state.anim.dur) { state.anim = null; if (state.game.winner) finish(); else { saveGame(); if (!humanTurn()) state.think = 0.4; } }
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
    if (hintThinker) {
      const r = hintThinker.step();
      if (r.move !== undefined) {
        hintThinker = null; state.thinking = false;
        if (r.move) { state.hint = { from: r.move.from, to: r.move.to, t: 0 }; say(hintReason(r.move)); }
      }
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
    if (sq !== undefined && sq >= 0) onSquarePlay(sq); else if (sq === -1) state.sel = -1;
  }
  // A short reason for a hint: describe what the move does, judged on a copy of the position.
  function hintReason(m) {
    const g = clone(state.game), me = g.turn, v = g.b[m.from];
    const caps = applyMove(g, m);
    if (g.winner === me) return g.winner === DEF ? 'Hint: this move puts the king in a corner and wins.' : 'Hint: this move takes the king.';
    if (caps.length) return 'Hint: this move captures a piece. The glowing piece moves to the glowing square.';
    if (me === DEF && openCorners(g) >= 2) return 'Hint: the king threatens two corners at once. The attackers can only block one.';
    if (me === DEF && v === 3 && openCorners(g) === 1) return 'Hint: the king opens a line to a corner and forces the attackers to block.';
    if (me === ATT && openCorners(state.game) > 0 && openCorners(g) === 0) return 'Hint: this blocks the king\'s way to a corner.';
    return me === ATT ? 'Hint: this tightens the net and guards the corners.' : 'Hint: this improves your position and keeps the king\'s routes open.';
  }

  function updateLesson(dt, tap, sq) {
    const L = state.lesson, l = LESSONS[L.i];
    if (state.anim) { state.anim.t += dt; if (state.anim.t >= state.anim.dur) { state.anim = null; if (L.done) state.game.winner = 0; } return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (L.done) {
      if (tap && inRect(BTN.next, tap.x, tap.y)) {
        if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try the defenders against the Learner.', 7); }
      }
      return;
    }
    if (tap && inRect(BTN.skip, tap.x, tap.y)) { startLesson(L.i); return; }
    if (sq === undefined) return;
    if (sq < 0) { state.sel = -1; return; }
    const m = tapBoard(sq);
    if (!m) return;
    const probe = clone(state.game), caps = applyMove(probe, m), n = probe.n;
    const kindOk = l.want === 'move' ? true : l.want === 'capture' ? caps.length > 0 : l.want === 'win' ? probe.winner === l.turn : l.want === 'fork' ? openCorners(probe) >= 2 : l.want === 'block' ? !probe.winner && openCorners(probe) === 0 : false;
    const ok = kindOk && (!l.at || l.at.some(([x, y]) => x + n * y === m.to));
    if (ok) { play(m); L.done = true; tone({ freq: 660, to: 990, dur: 0.2, type: 'triangle', vol: 0.08 }); }
    else { state.sel = -1; say(l.want === 'refused' ? 'That move is allowed. Try to slide THROUGH the dark piece instead.' : l.hint); }
  }

  function updatePuzzle(dt, tap, sq) {
    const P = state.pz;
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (P.status === 'making') { for (let k = 0; k < 3 && !puzzleToday; k++) puzzleToday = maker.step().puzzle; if (puzzleToday) startPuzzle(); return; }
    if (state.anim) {
      state.anim.t += dt;
      if (state.anim.t < state.anim.dur) return;
      state.anim = null;
      const g = state.game;
      if (P.wrong > 0) return;
      if (g.winner === DEF) {
        P.status = 'solved'; g.winner = 0;
        if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); }
        say('Solved! The king is home.', 6); tone({ freq: 523, to: 1046, dur: 0.4, type: 'triangle', vol: 0.09 });
      } else if (g.turn === ATT && !g.winner) { const r = bestReply(g); if (r) play(r); else P.wrong = 1; }
      else if (P.step === 1 && g.turn === DEF) { say('Now finish it: slide the king to a corner.', 5); }
      return;
    }
    if (P.wrong > 0) { P.wrong -= dt; if (P.wrong <= 0) { state.game = puzzleGame(P.puzzle); P.step = 0; P.wrong = 0; say('Set up again. Look for a move that makes two threats the attackers cannot both stop.'); } return; }
    if (P.status === 'solved') { if (tap && inRect(BTN.share, tap.x, tap.y)) env.share(`Tafl daily puzzle: solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' first try'}. Streak ${state.daily.streak}.`); return; }
    if (sq === undefined) return;
    if (sq < 0) { state.sel = -1; return; }
    const m = tapBoard(sq);
    if (!m) return;
    const s = P.puzzle.solution;
    if (P.step === 0) {
      const good = m.from === s.from && m.to === s.to;
      play(m);
      if (good) P.step = 1; else { P.tries += 1; P.wrong = 1.4; say('That lets the attackers hold. Try another idea.'); }
    } else {
      play(m);
      if (state.game.winner !== DEF) { P.tries += 1; P.wrong = 1.4; say('The king can reach a corner from here. Look again.'); }
    }
  }

  // Keyboard (web): arrows move a cursor over the board, Space or Enter is a TAP on that square, Escape is Menu, U takes back, H hints.
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene;
    if (input.pointer.pressed) { state.kb = false; return null; }
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) { const R = titleRows(!!state.saved); return { x: R.big.x + 5, y: R.big.y + 5 }; } return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return { x: BTN.again.x + 5, y: BTN.again.y + 5 }; return null; }
    if (sc === 'about' || sc === 'help' || sc === 'rules') { if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 }; if (k.has('Enter') || k.has('Space')) return { x: PAGE_NEXT.x + 5, y: PAGE_NEXT.y + 5 }; return null; }
    if (sc !== 'play' && sc !== 'lesson' && sc !== 'puzzle') return null;
    if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 };
    if (k.has('KeyU')) return { x: BTN.undo.x + 5, y: BTN.undo.y + 5 };
    if (k.has('KeyH')) return { x: BTN.hint.x + 5, y: BTN.hint.y + 5 };
    if ((k.has('Enter') || k.has('Space')) && sc === 'lesson' && state.lesson?.done) return { x: BTN.next.x + 5, y: BTN.next.y + 5 };
    const n = N(); let dx = 0, dy = 0;
    if (k.has('ArrowLeft')) dx = -1; else if (k.has('ArrowRight')) dx = 1; else if (k.has('ArrowUp')) dy = -1; else if (k.has('ArrowDown')) dy = 1;
    if (dx || dy) { state.kb = true; const x = Math.max(0, Math.min(n - 1, (state.cursor % n) + dx)), y = Math.max(0, Math.min(n - 1, Math.floor(state.cursor / n) + dy)); state.cursor = x + n * y; return null; }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; if (state.cursor >= n * n) state.cursor = (n * n) >> 1; const p = centerOf(n, state.cursor); return { x: p.x, y: p.y, board: true }; }
    return null;
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      const p = input.pointer, kbd = keyboard(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd && kbd.x !== undefined ? kbd : null;
      const sc = state.scene, boardScene = sc === 'play' || sc === 'lesson' || (sc === 'puzzle' && state.pz.status !== 'making');
      // What the pointer means on the board: sq = square just pressed (or dropped on), -1 = pressed off the board, undefined = nothing.
      let sq;
      if (boardScene && !state.anim) {
        const n = N();
        if (tap) { const i = squareAt(n, tap.x, tap.y); if (i >= 0 || !(inRect(BTN.menu, tap.x, tap.y) || inRect(BTN.undo, tap.x, tap.y) || inRect(BTN.hint, tap.x, tap.y) || inRect(BTN.next, tap.x, tap.y) || inRect(BTN.skip, tap.x, tap.y) || inRect(BTN.share, tap.x, tap.y))) sq = i; }
        if (sq !== undefined && sq >= 0 && p.pressed && state.game.b[sq] && side(state.game.b[sq]) === state.game.turn) state.drag = { from: sq, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
        else if (p.pressed) state.drag = null;
        if (state.drag && p.down) { state.drag.x = p.x; state.drag.y = p.y; if (Math.hypot(p.x - state.drag.sx, p.y - state.drag.sy) > 22) state.drag.moved = true; }
        if (state.drag && p.released) {
          const d = state.drag; state.drag = null;
          if (d.moved) { const to = squareAt(n, p.x, p.y); if (to >= 0 && to !== d.from) { state.sel = d.from; sq = to; } }
        }
      } else if (p.released) state.drag = null;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'about') updatePages(tap, 'about');
      else if (sc === 'help') updatePages(tap, 'help');
      else if (sc === 'rules') updatePages(tap, 'rules');
      else if (sc === 'play') updatePlay(dt, tap, sq);
      else if (sc === 'lesson') updateLesson(dt, tap, sq);
      else if (sc === 'puzzle') updatePuzzle(dt, tap, sq);
      else if (sc === 'over' && tap) {
        if (inRect(BTN.again, tap.x, tap.y)) start(state.size, state.human, state.two);
        else if (inRect(BTN.back, tap.x, tap.y)) state.scene = 'title';
      }
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
  };
}
