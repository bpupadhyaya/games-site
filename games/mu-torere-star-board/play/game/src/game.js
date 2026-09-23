// Mū Tōrere: state and flow. Rules are in rules.js, the solved game in solver.js, the computer in ai.js,
// content in lessons.js / puzzles.js / content.js, drawing in view.js and art.js.
//
// Moving: TAP a stone (it lifts, its legal points glow), then TAP a glowing point; or DRAG the stone onto a point.
// A move that is not allowed visibly TRIES (the stone travels toward the point, shudders and comes back) and a message
// says exactly why. The game state is JSON; only this file mutates it.
import { W, H, BX, BY, pointPos, pointNear, inRect, BTN, TEXT_STEPPER, TEXT_SCALES, AUTO_THINK_STEPS, AUTO_REVEAL_SECONDS, TEXT_PAGE_TOP, TEXT_PAGE_BOTTOM, titleRows, LADDER_ROW, LADDER_SIDE, BACK } from './layout.js';
import { newGame, clone, applyMove, tryMove, legalMoves, SIDE_NAME, other } from './rules.js';
import { rate } from './solver.js';
import { LADDER, pickMove, bestMoves, hintReason, stubborn } from './ai.js';
import { LESSONS, boardOf } from './lessons.js';
import { puzzleFor, movesToWin } from './puzzles.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_USES = 4, HINTS = 3;
const same = (a, b) => a.from === b.from && a.to === b.to;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, game: newGame(), human: 1, two: false, mode: 'ladder', rung: 1,
    sound: true, calm: false, big: false, marks: false, side: 0,
    sel: -1, drag: null, anim: null, msg: null, think: 0, next: null, undo: [], hint: null, hintsLeft: HINTS,
    cursor: 0, kb: false, scroll: 0, pageH: 0, result: null,
    progress: { played: 0, wins: 0 }, ladder: { top: 1, beaten: {}, tries: {} }, learned: false, saved: null, demoUses: 0,
    lesson: null, pz: null, daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 },
    dev: config.dev === true,
    textScaleIdx: 0, // index into TEXT_SCALES; the About/How to play/Rules reference pages' own text size
    // Auto Play ("Watch & Learn"): a full, silent, start-to-finish demonstration game. `auto` is null
    // except while `scene === 'auto'`; it never touches `state.game`/`state.saved`/`state.progress`.
    autoThinkIdx: 1, auto: null,
  };
  storage.get('prefs', null).then((v) => {
    if (v) { state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.big = v.big ?? false; state.marks = v.marks ?? false; state.side = v.side ?? 0; state.textScaleIdx = v.textScaleIdx ?? 0; state.autoThinkIdx = v.autoThinkIdx ?? 1; audio.setMuted?.(!state.sound); }
    // Clamp: a saved index from a build with a longer/shorter TEXT_SCALES/AUTO_THINK_STEPS array
    // must never survive and produce NaN font sizes / think-times.
    state.textScaleIdx = Math.min(Math.max(state.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1);
    state.autoThinkIdx = Math.min(Math.max(state.autoThinkIdx ?? 1, 0), AUTO_THINK_STEPS.length - 1);
  });
  storage.get('progress', null).then((v) => { if (v) state.progress = { played: v.played ?? 0, wins: v.wins ?? 0 }; });
  storage.get('ladder', null).then((v) => { if (v) state.ladder = { top: v.top ?? 1, beaten: v.beaten || {}, tries: v.tries || {} }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoUses', 0).then((v) => { state.demoUses = Math.max(state.demoUses, v); });
  storage.get('save', null).then((v) => { if (v && v.game && !v.game.winner && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { sound: state.sound, calm: state.calm, big: state.big, marks: state.marks, side: state.side, textScaleIdx: state.textScaleIdx, autoThinkIdx: state.autoThinkIdx });
  const saveLadder = () => storage.set('ladder', state.ladder);
  const saveGame = () => { if (state.scene === 'play' && !state.game.winner) { state.saved = { game: clone(state.game), human: state.human, two: state.two, mode: state.mode, rung: state.rung }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const dur = (d) => (state.calm ? d * 0.6 : d);
  const say = (text, hold = 5) => { state.msg = { text, t: 0, hold }; };
  // Auto Play plays itself continuously with no player to hear it for - silent by design, regardless
  // of the real Sound preference, the same way the menu's own attract-mode preview is silent.
  const tone = (o) => { if (state.sound && state.scene !== 'auto') audio.tone(o); };
  const tok = (f = 1) => tone({ freq: 300 * f, to: 165 * f, dur: 0.09, type: 'sine', vol: 0.07 });
  const chime = (a, b) => tone({ freq: a, to: b, dur: 0.5, type: 'sine', vol: 0.06 });
  const reset = (extra) => Object.assign(state, { sel: -1, drag: null, anim: null, msg: null, think: 0, next: null, undo: [], hint: null, hintsLeft: HINTS, result: null }, extra);
  const demoBlocked = () => { if (!config.demo) return false; if (state.demoUses >= DEMO_USES) { state.scene = 'demo-limit'; return true; } state.demoUses += 1; storage.set('demoUses', state.demoUses); return false; };
  const humanTurn = () => { const g = state.game; if (g.winner || state.anim) return false; if (state.scene === 'lesson' || state.scene === 'puzzle') return !state.next; return state.two || g.turn === state.human; };

  // ---- starting things --------------------------------------------------------------------------------------------
  function humanSideFor(rung) {
    if (state.side === 1) return 1; if (state.side === 2) return 2;
    return (rung + (state.ladder.tries[rung] || 0)) % 2 === 1 ? 1 : 2;
  }
  function startGame(mode, rung) {
    if (demoBlocked()) return;
    const two = mode === 'two';
    reset({ scene: 'play', game: newGame(), mode, two, rung: rung || state.rung, human: two ? 1 : humanSideFor(rung) });
    if (!two) state.rung = rung;
    say(two ? 'Shell moves first. Only the two ends of a row stand beside an enemy, so only they can enter the putahi.' : state.human === 1 ? 'You are Shell and move first. TAP a stone at the end of your row, then the putahi (centre).' : `You are Greenstone. ${LADDER[rung - 1].name} moves first.`, 7);
    if (!two && state.human === 2) state.think = dur(0.9);
    monetization.track('game_start', { mode, rung });
  }
  function resume() {
    const v = state.saved;
    reset({ scene: 'play', game: clone(v.game), human: v.human, two: v.two, mode: v.mode || 'ladder', rung: v.rung || 1 });
    say('Game restored.'); if (!state.two && state.game.turn !== state.human) state.think = dur(0.6);
  }
  function startLesson(i) {
    if (config.demo && i >= 3 && demoBlocked()) return;
    const l = LESSONS[i];
    const g = newGame(); g.board = boardOf(l.board); g.turn = l.turn; g.seen = {}; g.seen[g.board.join('') + g.turn] = 1;
    reset({ scene: 'lesson', game: g, human: l.turn, two: false, lesson: { i, step: 0, done: false, doneText: '' } });
  }
  function startPuzzle() {
    if (demoBlocked()) return;
    const p = puzzleFor(state.daily.day), g = newGame(); g.board = p.board.slice(); g.turn = p.turn; g.seen = {}; g.seen[g.board.join('') + g.turn] = 1;
    reset({ scene: 'puzzle', game: g, human: p.turn, two: false, pz: { p, status: state.daily.solvedDay === state.daily.day ? 'solved' : 'ready', tries: state.pz?.tries ?? 0 } });
    say(`Win in ${movesToWin(p)}: it is your move as ${SIDE_NAME[p.turn]}.`, 6);
  }

  // ---- moves ------------------------------------------------------------------------------------------------------
  function play(m) {
    const g = state.game, side = g.turn;
    state.anim = { from: m.from, to: m.to, side, t: 0, dur: dur(0.34), refuse: false };
    applyMove(g, m); state.sel = -1; state.hint = null; state.drag = null; tok(side === 1 ? 1.15 : 0.9);
  }
  function refuse(from, to, why) {
    state.anim = { from, to, side: state.game.board[from], t: 0, dur: dur(0.62), refuse: true };
    state.sel = -1; state.drag = null; say(why, 6); tone({ freq: 180, to: 140, dur: 0.14, type: 'triangle', vol: 0.05 });
    if (state.scene === 'lesson') { const w = LESSONS[state.lesson.i].steps[state.lesson.step].want; if (w.kind === 'refuse' && w.from === from && w.to === to) { state.lesson.done = true; state.lesson.doneText = 'That is the rule: a stone enters the putahi only when it stands beside an enemy stone.'; } }
  }
  const lossText = (p) => (p <= 2 ? `That loses at once: ${SIDE_NAME[other(state.game.turn)]}'s reply leaves you with no move.` : `That loses: with best play you would be trapped within ${Math.round(p / 2)} moves.`);

  // A legal move was chosen by the player: what happens depends on the scene.
  function onMove(m) {
    const g = state.game, sc = state.scene;
    if (sc === 'play') { state.undo.push(clone(g)); play(m); return; }
    const r = rate(g.board, g.turn).find((x) => same(x.m, m));
    if (sc === 'puzzle') {
      if (r.v === 1) { play(m); return; }
      state.pz.tries += 1; state.sel = -1; say(r.v === -1 ? lossText(r.p) : 'That is safe, but it lets them escape: there is a move that wins by force.'); return;
    }
    const step = LESSONS[state.lesson.i].steps[state.lesson.step], w = step.want;
    const ok = w.kind === 'any' || (w.kind === 'moves' && w.moves.some((x) => same(x, m))) || (w.kind === 'ring' && m.from < 8 && m.to < 8) || (w.kind === 'safe' && r.v >= 0) || (w.kind === 'best' && r.v === 1);
    if (ok) { play(m); state.lesson.pending = true; chime(600, 800); return; }
    state.sel = -1;
    say(r.v === -1 ? lossText(r.p) : (step.hint || 'Not that one: read the note above and try again.'));
  }

  function attempt(from, to) {
    const r = tryMove(state.game, from, to);
    if (r.move) onMove(r.move); else refuse(from, to, r.error);
  }
  // A tap on board point i (also used by the keyboard).
  function tapPoint(i) {
    const g = state.game, me = g.turn;
    if (i < 0) { state.sel = -1; return; }
    if (state.sel < 0) {
      if (g.board[i] === me) { state.sel = i; tok(1.6); }
      else if (g.board[i]) say(`That is ${SIDE_NAME[g.board[i]]}'s stone. TAP one of your own stones (${SIDE_NAME[me]}).`);
      else say('First TAP one of your stones, then TAP the point you want it to go to.');
      return;
    }
    if (i === state.sel) { state.sel = -1; return; }
    if (g.board[i] === me) { state.sel = i; tok(1.6); return; }
    attempt(state.sel, i);
  }
  function press(x, y) {
    const i = pointNear(x, y), g = state.game;
    if (i >= 0 && g.board[i] === g.turn && state.sel !== i) { state.sel = i; tok(1.6); state.drag = { from: i, x, y, moved: false, wasSel: false }; return; }
    if (i >= 0 && g.board[i] === g.turn && state.sel === i) { state.drag = { from: i, x, y, moved: false, wasSel: true }; return; }
    tapPoint(i);
  }
  function release(x, y) {
    const d = state.drag; if (!d) return;
    state.drag = null;
    if (d.moved) { const j = pointNear(x, y); if (j >= 0 && j !== d.from) { state.sel = d.from; attempt(d.from, j); } else state.sel = d.from; }
    else if (d.wasSel) state.sel = -1;
  }

  // ---- results ------------------------------------------------------------------------------------------------------
  function finish() {
    const g = state.game, w = g.winner, mineWon = !state.two && w === state.human, draw = w === 3;
    state.scene = 'over'; clearSave(); state.progress.played += 1; if (mineWon) state.progress.wins += 1;
    storage.set('progress', state.progress);
    let title, why, extra = '', primary, secondary = 'Menu', advanced = false;
    const loser = other(w);
    if (state.two) { title = draw ? 'A draw' : `${SIDE_NAME[w]} wins`; why = draw ? 'The same position came up three times.' : `${SIDE_NAME[loser]} has no legal move.`; primary = 'Play again'; secondary = null; }
    else {
      title = draw ? 'A draw' : mineWon ? 'You win' : 'Trapped';
      why = draw ? 'The same position came up three times: neither side could make progress.' : mineWon ? `${SIDE_NAME[loser]} has no legal move.` : `You have no legal move. ${LADDER[state.rung - 1].name} wins this one.`;
      primary = 'Play again';
      if (state.mode === 'ladder') {
        const r = state.rung, adv = mineWon || (draw && r >= 11);
        if (adv) {
          advanced = true;
          state.ladder.beaten[r] = true; state.ladder.tries[r] = 0; if (r < 12) state.ladder.top = Math.max(state.ladder.top, r + 1);
          extra = r >= 12 ? 'You held the Deep Current. The Ladder is complete.' : `Rung ${r} cleared. ${LADDER[r].name} is next.`;
          primary = r < 12 ? 'Next opponent' : 'Play again'; secondary = 'The Ladder';
        } else { state.ladder.tries[r] = (state.ladder.tries[r] || 0) + 1; extra = draw ? 'A draw does not climb yet. Try again from the other side.' : 'Try again: the sides swap.'; primary = 'Try again'; secondary = 'The Ladder'; }
        saveLadder();
      } else secondary = 'The Ladder';
    }
    const btns = [{ label: primary, act: advanced && state.rung < 12 ? 'next' : 'again' }]; if (secondary && secondary !== 'Menu') btns.push({ label: secondary, act: 'ladder' }); btns.push({ label: 'Menu', act: 'menu' });
    state.result = { title, why, extra, btns };
    if (draw) chime(392, 392); else if (mineWon || state.two) chime(523, 784); else chime(330, 262);
    monetization.track('game_end', { winner: w, rung: state.rung, mode: state.mode });
  }
  function lessonOver() {
    const L = state.lesson; L.done = true; if (!L.doneText) L.doneText = 'Well done.';
  }
  function puzzleSolved() {
    const P = state.pz; P.status = 'solved'; say('Solved!', 8); chime(523, 1046);
    if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); }
  }

  // ---- Auto Play ("Watch & Learn"): a full, silent, start-to-finish AI-vs-AI game that teaches by
  // demonstration. For every decision (a move, exactly the `{from,to}` shape rules.js/ai.js already
  // use) it loops THINK (board sits still, configurable duration) -> REVEAL (~2s, show every legal
  // move and highlight the one about to be played) -> ACT (execute it with the real move/animation
  // code, never a fake path). Reuses ai.js's existing pickMove() (the same table lookup that drives
  // every computer opponent in normal play, instant since the whole game is solved - no search to
  // wait on) for BOTH sides. Runs on its own game object (state.auto.game), never state.game/
  // state.saved/state.progress, so it can never disturb the player's real save or progress.
  const AUTO_RUNG = 12; // "Deep Current": perfect play that also sets traps - the best teaching demo
  function enterAuto() {
    state.scene = 'auto';
    const g = newGame();
    state.auto = { game: g, phase: 'think', timer: AUTO_THINK_STEPS[state.autoThinkIdx], chosen: pickMove(g, AUTO_RUNG, rng), moves: null, anim: null };
  }
  function exitAuto() { state.auto = null; state.scene = 'title'; }
  // Executes a move exactly the way normal play does (same animation shape as play()), but on the
  // auto game object and with no sound.
  function playAuto(D, m) {
    const g = D.game, side = g.turn;
    D.anim = { from: m.from, to: m.to, side, t: 0, dur: dur(0.34), refuse: false };
    applyMove(g, m);
  }
  function updateAuto(dt, tap) {
    const D = state.auto; if (!D) return;
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { exitAuto(); return; }
    if (tap && inRect(TEXT_STEPPER.dec, tap.x, tap.y) && state.autoThinkIdx > 0) { state.autoThinkIdx--; savePrefs(); }
    else if (tap && inRect(TEXT_STEPPER.inc, tap.x, tap.y) && state.autoThinkIdx < AUTO_THINK_STEPS.length - 1) { state.autoThinkIdx++; savePrefs(); }
    else if (tap && (D.phase === 'think' || D.phase === 'reveal') && inRect(BTN.undo, tap.x, tap.y)) { D.timer = 0; }
    if (D.phase === 'over') {
      if (tap && inRect(BTN.over1, tap.x, tap.y)) enterAuto();
      else if (tap && inRect(BTN.over2, tap.x, tap.y)) exitAuto();
      return;
    }
    if (D.phase === 'act') {
      if (D.anim) { D.anim.t += dt; if (D.anim.t < D.anim.dur) return; D.anim = null; }
      if (D.game.winner) { D.phase = 'over'; return; }
      D.phase = 'think'; D.timer = AUTO_THINK_STEPS[state.autoThinkIdx]; D.chosen = pickMove(D.game, AUTO_RUNG, rng); D.moves = null;
      return;
    }
    if (D.phase === 'think') {
      D.timer -= dt;
      if (D.timer <= 0) { D.moves = legalMoves(D.game.board, D.game.turn); D.phase = 'reveal'; D.timer = AUTO_REVEAL_SECONDS; }
      return;
    }
    if (D.phase === 'reveal') { D.timer -= dt; if (D.timer <= 0) { D.phase = 'act'; playAuto(D, D.chosen); } }
  }

  // ---- per-scene updates --------------------------------------------------------------------------------------------
  function afterAnim() {
    const g = state.game, sc = state.scene;
    if (state.anim.refuse) { state.anim = null; return; }
    state.anim = null;
    if (sc === 'play') { if (g.winner) return finish(); saveGame(); if (!state.two && g.turn !== state.human) state.think = dur(0.5); return; }
    if (sc === 'puzzle') { if (g.winner) return puzzleSolved(); if (g.turn !== state.pz.p.turn) state.next = { t: dur(0.45) }; return; }
    if (sc === 'lesson') {
      const L = state.lesson, l = LESSONS[L.i];
      if (g.winner) return lessonOver();
      if (!L.pending) return;
      if (g.turn !== l.turn) { if (L.step + 1 >= l.steps.length) { L.pending = false; return lessonOver(); } state.next = { t: dur(0.5) }; }   // the player's move landed: the computer replies
      else { L.pending = false; L.step += 1; }                                                                                     // the reply landed: next step
    }
  }
  function updateBoard(dt, input, tap) {
    const sc = state.scene, g = state.game;
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 5) state.hint = null; }
    if (state.anim) { state.anim.t += dt; if (state.anim.t >= state.anim.dur) afterAnim(); return; }
    // scripted reply (lessons, puzzles)
    if (state.next) {
      state.next.t -= dt; if (state.next.t > 0) return;
      state.next = null; const m = stubborn(g.board, g.turn); if (m) play(m);
      return;
    }
    // buttons
    if (tap) {
      if (sc === 'lesson' && state.lesson.done && inRect(BTN.cont, tap.x, tap.y)) { const i = state.lesson.i; if (i + 1 < LESSONS.length) startLesson(i + 1); else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Climb the Ladder, or try the daily puzzle.', 7); } return; }
      if (inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.scene = 'title'; return; }
      if (sc === 'lesson' && inRect(BTN.undo, tap.x, tap.y) && !state.lesson.done) { startLesson(state.lesson.i); return; }
      if (sc === 'puzzle' && state.pz.status === 'solved' && inRect(BTN.cont, tap.x, tap.y)) { env.share(`Mū Tōrere daily puzzle: solved${state.pz.tries ? ' after ' + state.pz.tries + ' wrong tr' + (state.pz.tries === 1 ? 'y' : 'ies') : ' first try'}. Streak ${state.daily.streak}.`); return; }
      if (sc === 'play' && inRect(BTN.undo, tap.x, tap.y)) { if (state.undo.length) { state.game = state.undo.pop(); state.sel = -1; state.hint = null; state.think = 0; say('Move taken back.'); tok(0.8); saveGame(); } else say('Nothing to take back yet.'); return; }
      if ((sc === 'play' && !state.two || sc === 'puzzle') && inRect(BTN.hint, tap.x, tap.y)) return hint();
    }
    // the computer's turn
    if (sc === 'play' && !state.two && !g.winner && g.turn !== state.human) {
      state.think -= dt; if (state.think > 0) return;
      const m = pickMove(g, state.rung, rng); if (m) play(m); return;
    }
    if (sc === 'lesson' && state.lesson.done) return;
    if (sc === 'puzzle' && state.pz.status === 'solved') return;
    if (!humanTurn()) return;
    // board input: taps and drags
    const p = input.pointer;
    if (p.pressed) press(p.x, p.y);
    if (state.drag && p.down) { state.drag.x = p.x; state.drag.y = p.y; if (Math.hypot(p.x - (pointPos(state.drag.from).x), p.y - pointPos(state.drag.from).y) > 22) state.drag.moved = true; }
    if (p.released) release(p.x, p.y);
    if (!p.pressed && tap && tap.kb) tapPoint(tap.i);
  }
  function hint() {
    const g = state.game;
    if (state.hintsLeft <= 0) { say('No hints left in this game.'); return; }
    if (!humanTurn()) return;
    const b = bestMoves(g.board, g.turn)[0]; if (!b) return;
    state.hintsLeft -= 1; state.hint = { from: b.m.from, to: b.m.to, t: 0 }; say('Hint: ' + hintReason(g.board, g.turn, b.m), 7); state.sel = -1;
  }

  function updateTitle(tap) {
    if (!tap) return;
    const R = titleRows(!!state.saved), hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(R.resume)) resume();
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.ladder)) state.scene = 'ladder';
    else if (hit(R.two)) startGame('two', 1);
    else if (hit(R.daily)) startPuzzle();
    else if (hit(R.about)) { state.scene = 'about'; state.scroll = 0; }
    else if (hit(R.howto)) { state.scene = 'howto'; state.scroll = 0; }
    else if (hit(R.rules)) { state.scene = 'rules'; state.scroll = 0; }
    else if (hit(R.auto)) enterAuto();
    else if (hit(R.sound)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); savePrefs(); tok(); }
    else if (hit(R.calm)) { state.calm = !state.calm; savePrefs(); tok(); }
    else if (hit(R.big)) { state.big = !state.big; savePrefs(); tok(); }
    else if (hit(R.marks)) { state.marks = !state.marks; savePrefs(); tok(); }
  }
  function updateLadder(tap) {
    if (!tap) return;
    if (inRect(BACK, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (inRect(LADDER_SIDE, tap.x, tap.y)) { state.side = (state.side + 1) % 3; savePrefs(); tok(); return; }
    for (let i = 0; i < 12; i++) if (inRect(LADDER_ROW(i), tap.x, tap.y)) { if (i + 1 <= state.ladder.top) startGame('ladder', i + 1); else say('Beat the rung before it first.', 3); }
  }
  function updatePage(input, tap) {
    const p = input.pointer;
    if (p.pressed) state.dragY = p.y;
    // Clamp to the same visible window view.js clips the page to (TEXT_PAGE_BOTTOM - TEXT_PAGE_TOP),
    // so a drag can always reach the true bottom of the longest page, at any text scale.
    const viewH = TEXT_PAGE_BOTTOM - TEXT_PAGE_TOP;
    if (p.down && state.dragY !== undefined && !p.pressed) { state.scroll = Math.max(0, Math.min(Math.max(0, state.pageH - viewH), state.scroll + (state.dragY - p.y))); state.dragY = p.y; }
    if (tap && inRect(BACK, tap.x, tap.y)) state.scene = 'title';
    else if (tap && inRect(TEXT_STEPPER.dec, tap.x, tap.y) && state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); tok(); }
    else if (tap && inRect(TEXT_STEPPER.inc, tap.x, tap.y) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); tok(); }
  }
  function updateOver(tap) {
    if (!tap) return;
    const rects = [BTN.over1, BTN.over2, BTN.over3];
    state.result.btns.forEach((b, i) => {
      if (!inRect(rects[i], tap.x, tap.y)) return;
      if (b.act === 'next') startGame('ladder', state.rung + 1); else if (b.act === 'again') startGame(state.mode, state.rung); else if (b.act === 'ladder') state.scene = 'ladder'; else state.scene = 'title';
    });
  }

  // Keyboard: arrows move a cursor over the star, Space/Enter is a TAP, U takes back, H hints, Escape is Menu.
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene;
    if (input.pointer.pressed) { state.kb = false; return null; }
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) { const R = titleRows(!!state.saved), r = R.resume || R.learn; return { x: r.x + 5, y: r.y + 5 }; } return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return { x: BTN.over1.x + 5, y: BTN.over1.y + 5 }; if (k.has('Escape')) return { x: BTN.over3.x + 5, y: BTN.over3.y + 5 }; return null; }
    if (sc === 'about' || sc === 'howto' || sc === 'rules' || sc === 'ladder' || sc === 'demo-limit') { if (k.has('Escape')) return { x: BACK.x + 5, y: BACK.y + 5 }; return null; }
    if (sc === 'auto') { if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 }; if (k.has('Space')) return { x: BTN.undo.x + 5, y: BTN.undo.y + 5 }; return null; }
    if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 };
    if (k.has('KeyU')) return { x: BTN.undo.x + 5, y: BTN.undo.y + 5 };
    if (k.has('KeyH')) return { x: BTN.hint.x + 5, y: BTN.hint.y + 5 };
    if (k.has('Enter') && state.lesson?.done) return { x: BTN.cont.x + 5, y: BTN.cont.y + 5 };
    let c = state.cursor;
    if (k.has('ArrowRight')) c = c === 8 ? 0 : (c + 1) % 8; else if (k.has('ArrowLeft')) c = c === 8 ? 7 : (c + 7) % 8; else if (k.has('ArrowUp')) c = 8; else if (k.has('ArrowDown')) c = c === 8 ? 0 : c;
    if (c !== state.cursor) { state.cursor = c; state.kb = true; return null; }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; return { kb: true, i: state.cursor }; }
    return null;
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      const p = input.pointer, kbd = keyboard(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      const sc = state.scene;
      if (sc === 'title') updateTitle(tap && tap.x !== undefined ? tap : null);
      else if (sc === 'ladder') updateLadder(tap && tap.x !== undefined ? tap : null);
      else if (sc === 'about' || sc === 'howto' || sc === 'rules') updatePage(input, tap && tap.x !== undefined ? tap : null);
      else if (sc === 'demo-limit') { if (tap && tap.x !== undefined && inRect(BACK, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'over') updateOver(tap && tap.x !== undefined ? tap : null);
      else if (sc === 'auto') updateAuto(dt, tap && tap.x !== undefined ? tap : null);
      else updateBoard(dt, input, tap);
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
    // Auto Play is a free teaching/marketing demo, not real play: kit 1.6.1's preview gate skips
    // both time-accrual and the countdown badge while this is true.
    isPreviewExempt: () => state.scene === 'auto',
  };
}
