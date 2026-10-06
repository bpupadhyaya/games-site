// The Royal Game of Ur: state and flow. Drawing is in view.js; the rule book is rules.js; the computer's brain is engine.js;
// lessons.js, puzzles.js, heritage.js and content.js are content. See design/ARCHITECTURE.md for the map.
//
// A turn: ROLL (tap the dice) -> the dice tumble and settle -> CHOOSE (tap a glowing piece, then the glowing square; or, when
// only one piece can reach a square, just tap the square) -> the piece hops along its path. A refused move visibly tries and
// comes back, with the reason in words. Rosettes and captures have their own small effects. A roll of 0, or with no legal
// move, passes the turn after the player has seen why.
import { layoutFor, creditHit, RESERVE_RECT, HOME_RECT, TEXT_SCALES, AP_THINK_STEPS, inRect, cellNear, cellCenter, reservePos, restSlots, squareAt } from './layout.js';
import { PIECES, HOME, newGame, clone, cellOf, legalMoves, applyMove, pass, whyNot, rollDice, waitingCount } from './rules.js';
import { LEVELS, createThinker, explain } from './engine.js';
import { LESSONS, lessonGame } from './lessons.js';
import { HERITAGE } from './heritage.js';
import { RULES } from './content.js';
import { createPuzzleMaker, puzzleGame, puzzleKey } from './puzzles.js';
import { render, docMetrics } from './view.js';

// Fluid viewport (kit 1.7.1): the short side is always 720 units, the long side follows the screen, in portrait and landscape.
// `meta.width/height` are updated live by the kit on every resize; every position comes from layoutFor(meta.width, meta.height).
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_GAMES = 2, HINTS_PER_GAME = 3;
// Auto Play: a whole AI-vs-AI teaching game driven by the SAME engine.js thinker used for the real
// computer opponent, for BOTH seats. Master (index 3, zero blunder) gives the strongest, most
// instructive play; unlike a fixed-position game, the dice mean two Master-vs-Master games still
// play out differently every time, so there is no risk of a repetitive, fully deterministic replay.
// REVEAL is a fixed pause distinct from the configurable THINK pause.
const AP_LEVEL = 3, AP_REVEAL_TIME = 2;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, game: newGame(), two: false, first: 0, level: 1, sound: true, calm: false, big: false,
    sel: -1, anim: null, dice: { vals: [0, 0, 0, 0], total: 0, phase: 'none', t: 0, dur: 0.9 }, wait: 0, kb: -1,
    msg: null, think: 0, thinking: false, undo: [], hintsLeft: HINTS_PER_GAME, hint: null, caps: [0, 0], rv: [{}, {}],
    stats: { games: 0, wins: 0, badges: {} }, saved: null, learned: false, demoGames: 0,
    lesson: null, pz: null, about: 0, rules: 0, daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 }, dev: config.dev === true,
    textScaleIdx: 0, // index into TEXT_SCALES; the About/Rules reference pages' own text size
    apThinkIdx: 1, // index into AP_THINK_STEPS; the Auto Play THINK-phase pause, default 5s
    ap: null, // transient Auto Play loop state: { phase: 'think'|'reveal', timer, move }
    apPaused: false, // Auto Play Pause: freezes the whole demo (timers, dice, moving pieces) until Resume
    docScroll: 0, // scroll offset (units) of the current About / Rules page body
  };
  const lay = () => layoutFor(meta.width, meta.height);
  const boardKind = () => (state.scene === 'autoplay' || state.scene === 'autoplay-over' ? 'auto' : state.scene === 'lesson' || state.scene === 'puzzle' ? 'text' : 'play');
  const bd = () => lay().board(boardKind());                         // the board layout of the current scene
  let drag = null;
  let thinker = null, hintThinker = null, puzzleToday = null;
  const maker = createPuzzleMaker(state.daily.day);
  const isAutoplay = () => state.scene === 'autoplay' || state.scene === 'autoplay-over';

  storage.get('prefs', null).then((v) => {
    if (v) { state.level = v.level ?? 1; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.big = v.big ?? false; state.textScaleIdx = v.textScaleIdx ?? 0; state.apThinkIdx = v.apThinkIdx ?? 1; audio.setMuted?.(!state.sound); }
    // Clamp: a saved index from a build with a longer/shorter TEXT_SCALES/AP_THINK_STEPS array must
    // never survive and produce NaN font sizes / an out-of-range pause.
    state.textScaleIdx = Math.min(Math.max(state.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1);
    state.apThinkIdx = Math.min(Math.max(state.apThinkIdx ?? 1, 0), AP_THINK_STEPS.length - 1);
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.g && v.g.winner < 0 && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, big: state.big, textScaleIdx: state.textScaleIdx, apThinkIdx: state.apThinkIdx });
  // the app menu reads `progress` = { played, wins }
  const saveProgress = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.games, wins: state.stats.wins }); };
  const snapshot = () => ({ g: clone(state.game), dice: { ...state.dice, vals: state.dice.vals.slice() }, caps: state.caps.slice() });
  const saveGame = () => { if (state.scene === 'play' && state.game.winner < 0) { state.saved = { ...snapshot(), two: state.two, level: state.level, hintsLeft: state.hintsLeft, first: state.first }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const dur = (d) => (state.calm ? d * 0.6 : d);
  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  // Auto Play is silent by design regardless of the player's own sound setting (same principle as
  // the menu's attract-mode preview) - never surprise a viewer with sound from a demo.
  const tone = (o) => { if (state.sound && !isAutoplay()) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.8, to: f * 0.4, dur: 0.06, type: 'sine', vol: 0.11 });
  const chime = () => { tone({ freq: 660, to: 880, dur: 0.16, type: 'triangle', vol: 0.09 }); tone({ freq: 990, to: 1320, dur: 0.24, type: 'triangle', vol: 0.06 }); };
  const slots = (s) => restSlots(state.game.pos[s], s);
  const settleRv = () => { for (let s = 0; s < 2; s++) { state.rv[s] = {}; slots(s).forEach((p, i) => { if (p) state.rv[s][i] = { x: p.x, y: p.y }; }); } };
  const humanTurn = () => state.game.winner < 0 && (state.two || state.game.turn === 0);
  const reset = (extra) => {
    thinker = hintThinker = null;
    Object.assign(state, { sel: -1, anim: null, msg: null, think: 0.6, thinking: false, undo: [], hint: null, hintsLeft: HINTS_PER_GAME, wait: 0, kb: -1, caps: [0, 0], dice: { vals: [0, 0, 0, 0], total: 0, phase: 'none', t: 0, dur: 0.9 } }, extra);
    settleRv();
  };

  function start(two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    const first = two ? 0 : state.stats.games % 2;               // the human rolls first in the 1st, 3rd... game, the computer in the others
    reset({ scene: 'play', game: newGame(first), two, first });
    say(two ? 'Player 1 (shell) rolls first. Tap the dice to roll.' : first === 0 ? 'You are the shell pieces. Tap the dice to roll.' : 'The computer rolls first. You are the shell pieces.');
    monetization.track('game_start', { two, level: state.level });
  }
  // Auto Play: free, silent, never touches real save/stats (see isPreviewExempt below and apFinish).
  // Both seats are driven by engine.js's real thinker; the loop lives in updateAutoPlay.
  function startAutoPlay() {
    reset({ scene: 'autoplay', game: newGame(0), two: false, ap: { phase: 'run', timer: 0, move: null }, apPaused: false });
  }
  function apFinish() { state.scene = 'autoplay-over'; }
  function apAfterMove() {
    if (state.game.winner >= 0) { apFinish(); return; }
    state.ap.phase = 'run'; state.ap.move = null;
  }
  function resume() {
    const v = state.saved;
    reset({ scene: 'play', game: clone(v.g), two: v.two, level: v.level ?? state.level, hintsLeft: v.hintsLeft ?? HINTS_PER_GAME, first: v.first ?? 0, caps: (v.caps || [0, 0]).slice() });
    state.dice = { ...v.dice, vals: v.dice.vals.slice(), phase: v.dice.phase === 'rolling' ? 'shown' : v.dice.phase };
    say('Game restored.');
  }
  function setDice(total) { const vals = [0, 0, 0, 0]; for (let k = 0; k < total; k++) vals[k] = 1; state.dice = { vals, total, phase: 'shown', t: 0, dur: 0.9 }; }
  function startLesson(i) {
    const l = LESSONS[i];
    reset({ scene: 'lesson', game: lessonGame(l), two: true, lesson: { i, done: false } });
    if (l.roll) setDice(l.roll);
  }
  function startPuzzle() {
    const tries = state.pz?.tries ?? 0;
    if (!puzzleToday) { reset({ scene: 'puzzle', game: newGame(), pz: { status: 'making', tries } }); return; }
    reset({ scene: 'puzzle', game: puzzleGame(puzzleToday), two: false, pz: { status: state.daily.solvedDay === state.daily.day ? 'solved' : 'ready', puzzle: puzzleToday, tries, wrong: 0 } });
    setDice(puzzleToday.roll);
  }

  // ---- dice ---------------------------------------------------------------------------------------------
  function startRoll(forced) {
    let vals, total;
    if (forced === undefined) { const r = rollDice(rng); vals = r.dice; total = r.total; }
    else { total = forced; vals = rng.shuffle([0, 1, 2, 3].map((k) => (k < forced ? 1 : 0))); }
    state.dice = { vals, total, phase: 'rolling', t: 0, dur: dur(0.95) };
    state.hint = null; state.sel = -1; state.kb = -1; state.msg = null;
    for (let k = 0; k < 5; k++) tone({ freq: 700 + k * 90, to: 300, dur: 0.05, type: 'triangle', vol: 0.06 });
  }
  function diceLanded() {
    const d = state.dice, g = state.game; d.phase = 'shown'; g.roll = d.total;
    tone({ freq: 520, to: 260, dur: 0.1, type: 'triangle', vol: 0.1 });
    if (state.scene === 'lesson') { if (LESSONS[state.lesson.i].want === 'roll') { state.lesson.done = true; chime(); } return; }
    const who = state.scene === 'autoplay' ? (g.turn === 0 ? 'Shell' : 'Jet') : state.two ? (g.turn === 0 ? 'Player 1' : 'Player 2') : g.turn === 0 ? 'You' : 'The computer';
    if (d.total === 0) { say(`${who} rolled 0: no corner is up, so the turn passes.`, 2.4); state.wait = 1.5; return; }
    if (!legalMoves(g).length) { say(`${who} rolled ${d.total}, but no piece can move that far, so the turn passes.`, 2.6); state.wait = 1.7; return; }
    if (state.scene === 'autoplay') say(`${who} rolled ${d.total}.`, 3.5);
    else if (humanTurn()) say(`${state.two ? who : 'You'} rolled ${d.total}. Tap a glowing piece.`, 3.5);
  }

  // ---- moves --------------------------------------------------------------------------------------------
  function play(m) {
    const g = state.game, s = g.turn, was = g.pos[1 - s].slice();
    const from = m.from === 0 ? (state.rv[s][m.i] ?? reservePos(s, 0)) : squareAt(s, m.from), pts = [from];
    for (let p = Math.max(1, m.from + 1); p <= Math.min(14, m.to); p++) pts.push(squareAt(s, p));
    applyMove(g, m); state.sel = -1; state.hint = null; state.kb = -1;
    if (m.hit >= 0) state.caps[s] += 1;
    if (m.to === HOME) pts.push(slots(s)[m.i]);
    state.anim = { type: 'move', side: s, i: m.i, pts, t: 0, dur: dur(Math.min(1.1, 0.17 * (pts.length - 1) + 0.18)), hit: m.hit, hitSide: 1 - s, hitFrom: m.hit >= 0 ? was[m.hit] : 0, hitTo: m.hit >= 0 ? slots(1 - s)[m.hit] : null, rosette: m.rosette, off: m.to === HOME };
    clack(m.rosette ? 700 : 480);
  }
  function refuse(i, why) {
    const g = state.game, s = g.turn, p = g.pos[s][i];
    const start = p === 0 ? (state.rv[s][i] ?? reservePos(s, 0)) : squareAt(s, p), end = squareAt(s, Math.min(14, Math.max(1, p + g.roll))) ?? start;
    state.anim = { type: 'refuse', side: s, i, pts: [start, end], t: 0, dur: dur(0.7), hit: -1 };
    state.sel = -1; say(why, 5.5);
    tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.06 });
    if (state.scene === 'lesson' && LESSONS[state.lesson.i].want === 'refused') state.lesson.done = true;
  }
  const firstWaiting = (s) => { let k = -1; for (let i = 0; i < PIECES; i++) if (state.game.pos[s][i] === 0) k = i; return k; };   // top of the stack
  const pieceAtCell = (s, cell) => { for (let i = 0; i < PIECES; i++) { const c = cellOf(s, state.game.pos[s][i]); if (c && c.lane === cell.lane && c.c === cell.c) return i; } return -1; };
  const destCell = (m) => (m.to >= 1 && m.to <= 14 ? cellOf(state.game.turn, m.to) : null);
  const isDest = (m, cell) => { const d = destCell(m); return !!(cell && d && d.lane === cell.lane && d.c === cell.c); };

  // What a tap on the board means during the CHOOSE phase. Returns a legal move to play, or null.
  function tapChoose(tap) {
    const g = state.game, s = g.turn, moves = legalMoves(g), bp = bd().toBoard(tap.x, tap.y), cell = cellNear(bp.x, bp.y);       // the tap, in board space
    const inReserve = inRect(RESERVE_RECT(s), bp.x, bp.y), inHome = inRect(HOME_RECT(s), bp.x, bp.y);
    let pieceI = -1;
    if (cell) pieceI = pieceAtCell(s, cell); else if (inReserve && waitingCount(g, s)) pieceI = firstWaiting(s);
    const selMove = state.sel >= 0 ? moves.find((m) => m.i === state.sel) : null;
    if (selMove && (isDest(selMove, cell) || (inHome && selMove.off))) return selMove;   // a piece is lifted and this is where it goes
    if (pieceI >= 0) {
      if (pieceI === state.sel) { state.sel = -1; return null; }
      if (moves.some((x) => x.i === pieceI)) { state.sel = pieceI; clack(620); return null; }
      refuse(pieceI, whyNot(g, pieceI) || 'That piece cannot move.'); return null;
    }
    const hits = moves.filter((m) => isDest(m, cell) || (inHome && m.off));               // a square that exactly one move reaches: a shortcut
    if (hits.length === 1) return hits[0];
    if (selMove) { say(`That is not where this piece goes with a ${g.roll}. Tap the glowing square.`, 3.5); return null; }
    state.sel = -1;
    if (cell || inHome || inReserve) say('First tap one of your glowing pieces, then the glowing square it goes to.', 3.5);
    return null;
  }

  function finish() {
    const g = state.game, human = g.winner === 0;
    state.scene = 'over'; state.stats.games += 1; clearSave();
    if (!state.two && human) { state.stats.wins += 1; state.stats.badges[state.level] = true; }
    saveProgress();
    tone({ freq: human || state.two ? 523 : 330, to: human || state.two ? 784 : 262, dur: 0.5, type: 'triangle', vol: 0.09 });
    monetization.track('game_end', { winner: g.winner, moves: g.moves, level: state.level });
  }
  function afterMove() {
    if (state.game.winner >= 0) { if (state.scene === 'play') finish(); return; }
    if (state.scene === 'play') { saveGame(); state.think = 0.55; }
  }

  // ---- per-scene updates --------------------------------------------------------------------------------
  function updateAnim(dt) {
    const a = state.anim; a.t += dt;
    if (a.t < a.dur + (a.hit >= 0 ? dur(0.5) : 0)) return;
    state.anim = null;
    if (a.type !== 'move') return;
    if (a.rosette && (state.scene === 'play' || state.scene === 'autoplay')) { chime(); say('Rosette: roll again!', 2); } else if (a.rosette) chime();
    if (a.hit >= 0) tone({ freq: 220, to: 70, dur: 0.25, type: 'sawtooth', vol: 0.08 });
    if (state.scene === 'play') afterMove();
    else if (state.scene === 'autoplay') apAfterMove();
  }
  function easeRv(dt) {          // off-board pieces glide to their slots (the stacks close up smoothly)
    const k = 1 - Math.exp(-14 * dt);
    for (let s = 0; s < 2; s++) {
      const sl = slots(s);
      for (let i = 0; i < PIECES; i++) {
        const p = sl[i];
        if (!p) { delete state.rv[s][i]; continue; }
        if (state.anim && state.anim.side === s && state.anim.i === i) continue;
        const c = state.rv[s][i];
        if (!c || state.calm) state.rv[s][i] = { x: p.x, y: p.y }; else { c.x += (p.x - c.x) * k; c.y += (p.y - c.y) * k; }
      }
    }
  }
  const onBoard = (tap, side) => { const bp = bd().toBoard(tap.x, tap.y); return !!(cellNear(bp.x, bp.y) || inRect(RESERVE_RECT(side), bp.x, bp.y)); };
  const tapDice = (tap) => tap && inRect(bd().tray, tap.x, tap.y);

  function updateTitle(tap) {
    for (let k = 0; k < 2 && !puzzleToday; k++) puzzleToday = maker.step().puzzle;      // grow today's puzzle in the background
    if (!tap) return;
    const TT = lay().title(!!state.saved), R = TT.btn, hit = (r) => inRect(r, tap.x, tap.y);
    if (TT.lockup && hit(creditHit(TT.lockup))) { state.afFlash = 0.18; env.openArcforgeHome?.(); }
    else if (hit(R.resume)) resume();
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.play)) start(false);
    else if (hit(R.two)) start(true);
    else if (hit(R.daily)) startPuzzle();
    else if (hit(R.autoplay)) startAutoPlay();
    else if (hit(R.about)) { state.scene = 'about'; state.about = 0; state.docScroll = 0; drag = null; }
    else if (hit(R.rules)) { state.scene = 'rules'; state.rules = 0; state.docScroll = 0; drag = null; }
    else if (hit(R.level)) { state.level = (state.level + 1) % LEVELS.length; savePrefs(); clack(); }
    else if (hit(R.sound)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); savePrefs(); clack(); }
    else if (hit(R.big)) { state.big = !state.big; savePrefs(); clack(); }
    else if (hit(R.calm)) { state.calm = !state.calm; savePrefs(); clack(); }
  }
  // shared by play, lesson and puzzle: animations and the tumbling dice take priority over input
  function busy(dt) {
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 6) state.hint = null; }
    if (state.anim) { updateAnim(dt); return true; }
    if (state.dice.phase === 'rolling') { state.dice.t += dt; if (state.dice.t >= state.dice.dur) diceLanded(); return true; }
    return false;
  }
  // Auto Play's own loop: ROLL (auto) -> THINK (board sits still) -> REVEAL (the chosen move glows,
  // fixed pause) -> ACT (the real play()/applyMove() path - reuses busy()/updateAnim() to animate and
  // call apAfterMove() when done) -> loops. Exit/think-time controls always take the tap first.
  function updateAutoPlay(dt, tap) {
    const g = state.game, AP = state.ap;
    const bt = bd().btn;
    if (tap && inRect(bt.apExit, tap.x, tap.y)) { thinker = null; state.apPaused = false; state.scene = 'title'; return; }
    if (tap && inRect(bt.apPause, tap.x, tap.y)) { state.apPaused = !state.apPaused; clack(state.apPaused ? 300 : 500); return; }
    if (tap && inRect(bt.apDec, tap.x, tap.y) && state.apThinkIdx > 0) { state.apThinkIdx--; savePrefs(); clack(); return; }
    if (tap && inRect(bt.apInc, tap.x, tap.y) && state.apThinkIdx < AP_THINK_STEPS.length - 1) { state.apThinkIdx++; savePrefs(); clack(); return; }
    if (state.apPaused) return;                                          // a real Pause: nothing advances (dice, pieces, timers) until Resume
    if (busy(dt)) return;
    if (state.wait > 0) { state.wait -= dt; if (state.wait <= 0) { pass(g); apAfterMove(); } return; }
    if (AP.phase === 'think') {
      AP.timer -= dt;
      if (AP.timer <= 0) { AP.phase = 'reveal'; AP.timer = AP_REVEAL_TIME; state.hint = { i: AP.move.i, to: AP.move.to, t: 0 }; }
      return;
    }
    if (AP.phase === 'reveal') {
      AP.timer -= dt;
      if (AP.timer <= 0) { const m = AP.move; AP.move = null; AP.phase = 'act'; state.hint = null; play(m); }
      return;
    }
    if (AP.phase === 'act') return;   // waiting for busy()/updateAnim to finish and call apAfterMove()
    // AP.phase === 'run': auto-roll, then think about the roll (the real engine.js thinker, silently)
    state.think -= dt; if (state.think > 0) return;
    if (g.roll < 0) { startRoll(); return; }
    if (!thinker) { thinker = createThinker(g, AP_LEVEL, rng); state.thinking = true; }
    const r = thinker.step(24);
    if (r.move !== undefined) {
      thinker = null; state.thinking = false;
      if (r.move) { AP.move = r.move; AP.phase = 'think'; AP.timer = AP_THINK_STEPS[state.apThinkIdx]; }
    }
  }
  function updatePlay(dt, tap) {
    const g = state.game;
    const bt = bd().btn;
    if (busy(dt)) return;
    if (tap && inRect(bt.menu, tap.x, tap.y)) { saveGame(); state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return; }
    if (state.wait > 0) { state.wait -= dt; if (state.wait <= 0) { pass(g); afterMove(); } return; }
    if (!humanTurn()) {
      state.think -= dt; if (state.think > 0) return;
      if (g.roll < 0) { startRoll(); return; }
      if (!thinker) { thinker = createThinker(g, state.level, rng); state.thinking = true; }
      const r = thinker.step(24);                                          // about 3000 nodes per frame at most
      if (r.move !== undefined) { thinker = null; state.thinking = false; if (r.move) play(r.move); }
      return;
    }
    if (hintThinker) {
      const r = hintThinker.step(24);
      if (r.move !== undefined) { hintThinker = null; state.thinking = false; if (r.move) { state.hint = { i: r.move.i, to: r.move.to, t: 0 }; say(`Hint: ${explain(g, r.move)}`, 6); } }
      return;
    }
    if (tap && inRect(bt.undo, tap.x, tap.y)) {
      // one pop takes back your last move and the computer's reply; only before you roll, so a roll can never be re-tried
      if (g.roll >= 0) say('You can take a move back before you roll.', 3);
      else if (state.undo.length) { const u = state.undo.pop(); state.game = u.g; state.dice = u.dice; state.caps = u.caps; state.sel = -1; state.hint = null; state.wait = 0; settleRv(); say('Move taken back.'); clack(360); saveGame(); }
      else say('Nothing to take back yet.');
      return;
    }
    if (tap && inRect(bt.hint, tap.x, tap.y)) {
      if (g.roll < 1) say('Roll the dice first, then ask for a hint.');
      else if (state.hintsLeft <= 0) say('No hints left in this game.');
      else { state.hintsLeft -= 1; hintThinker = createThinker(g, 3, rng); state.thinking = true; state.sel = -1; }
      return;
    }
    if (g.roll < 0) {
      if (tapDice(tap)) startRoll();
      else if (tap && onBoard(tap, g.turn)) say('Tap the dice to roll first.', 2.5);
      return;
    }
    if (!tap) return;
    const m = tapChoose(tap);
    if (m) { state.undo.push(snapshot()); play(m); }
  }

  function updateLesson(dt, tap) {
    const L = state.lesson, l = LESSONS[L.i], g = state.game, bt = bd().btn;
    if (busy(dt)) return;
    if (tap && inRect(bt.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (L.done) {
      if (tap && inRect(bt.next, tap.x, tap.y)) {
        if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try a game against the Scribe.', 7); }
      }
      return;
    }
    if (!tap) return;
    if (g.roll < 0) { if (l.want === 'roll' && tapDice(tap)) startRoll(l.rolls[0]); else say(l.want === 'roll' ? 'Tap the dice tray to roll.' : 'Follow the instruction above.', 2.5); return; }
    const m = tapChoose(tap);
    if (!m) return;
    const ok = l.want === 'move' || (l.want === 'to' && m.to === l.at) || (l.want === 'off' && m.off) || (l.want === 'win' && applyMove(clone(g), m).winner === 0);
    if (ok) { play(m); g.winner = -1; L.done = true; state.msg = null; }
    else { state.sel = -1; say(l.hint ?? 'Not that one. Read the instruction above and try again.', 4); }
  }

  function updatePuzzle(dt, tap) {
    const P = state.pz, menuBtn = P.status === 'making' ? lay().notice().btn : bd().btn.menu;
    if (tap && inRect(menuBtn, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (P.status === 'making') { for (let k = 0; k < 2 && !puzzleToday; k++) puzzleToday = maker.step().puzzle; if (puzzleToday) startPuzzle(); return; }
    if (state.anim) { updateAnim(dt); return; }
    if (P.wrong > 0) { P.wrong -= dt; if (P.wrong <= 0) { state.game = puzzleGame(P.puzzle); P.wrong = 0; settleRv(); } return; }
    if (P.status === 'solved') { if (tap && inRect(bd().btn.next, tap.x, tap.y)) env.share(`Royal Game of Ur daily puzzle: solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' first try'}. Streak ${state.daily.streak}.`); return; }
    if (!tap) return;
    const m = tapChoose(tap);
    if (!m) return;
    play(m);
    if (puzzleKey(m) === P.puzzle.best) {
      P.status = 'solved';
      if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); }
      say(`Best move. ${P.puzzle.why}`, 8); tone({ freq: 523, to: 1046, dur: 0.4, type: 'triangle', vol: 0.09 });
    } else { P.tries += 1; P.wrong = 1.6; say(P.tries >= 3 ? `Not that one. The best move is the one where ${P.puzzle.why.charAt(0).toLowerCase() + P.puzzle.why.slice(1)}` : 'That is playable, but there is a stronger move. Setting the position up again...', 4); }
  }

  // About / Rules: Menu, Back, Next, text size, and a scrolling body (drag, wheel, arrow keys, scroll bar). A page that fits never moves.
  function updateDoc(tap, input) {
    const D = lay().doc, p = input.pointer, keys = input.keys.pressed, about = state.scene === 'about', max = () => docMetrics.max;
    const setScroll = (v) => { state.docScroll = Math.max(0, Math.min(v, max())); };
    const page = (d) => { if (d > 0 && state.docScroll >= max() - 1) { state.scene = 'title'; drag = null; return; } setScroll(state.docScroll + d * docMetrics.view * 0.85); drag = null; };
    if (wheelInput.dy) { setScroll(state.docScroll + wheelInput.dy); wheelInput.dy = 0; }
    if (keys.has('WheelDown') || keys.has('ArrowDown')) setScroll(state.docScroll + 90);
    if (keys.has('WheelUp') || keys.has('ArrowUp')) setScroll(state.docScroll - 90);
    if (keys.has('PageDown')) setScroll(state.docScroll + docMetrics.view * 0.9);
    if (keys.has('PageUp')) setScroll(state.docScroll - docMetrics.view * 0.9);
    if (p.pressed && max() > 0) {
      const sbHit = { x: D.scrollbar.x - 16, y: D.scrollbar.y, w: D.scrollbar.w + 32, h: D.scrollbar.h };
      if (inRect(sbHit, p.x, p.y)) drag = { bar: true };
      else if (inRect(D.body, p.x, p.y)) drag = { y0: p.y, s0: state.docScroll };
    }
    if (drag) {
      if (!p.down) drag = null;
      else if (drag.bar) setScroll(((p.y - D.scrollbar.y) / D.scrollbar.h) * max());
      else setScroll(drag.s0 - (p.y - drag.y0));
    }
    state.docScroll = Math.max(0, Math.min(state.docScroll, max()));
    if (!tap) return;
    if (inRect(D.menu, tap.x, tap.y)) { state.scene = 'title'; drag = null; }
    else if (inRect(D.next, tap.x, tap.y)) page(1);
    else if (inRect(D.prev, tap.x, tap.y)) page(-1);
    else if (inRect(D.zoomDec, tap.x, tap.y) && state.textScaleIdx > 0) { state.textScaleIdx--; state.docScroll = 0; savePrefs(); clack(); }
    else if (inRect(D.zoomInc, tap.x, tap.y) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; state.docScroll = 0; savePrefs(); clack(); }
  }

  // Keyboard (web demo): Space or Enter rolls the dice, then plays the chosen move; arrows choose among the legal moves;
  // H is a hint, U takes a move back, Escape is Menu.
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene, press = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    if (input.pointer.pressed) return null;
    const go = k.has('Enter') || k.has('Space');
    const L = lay();
    if (sc === 'title') return go ? press(L.title(!!state.saved).btn.play) : null;
    if (sc === 'over' || sc === 'autoplay-over') return go ? press(L.result.again) : null;
    if (sc === 'about' || sc === 'rules') { const D = L.doc; return k.has('Escape') ? press(D.menu) : (k.has('ArrowRight') || go) ? press(D.next) : k.has('ArrowLeft') ? press(D.prev) : null; }
    if (sc === 'autoplay') { const bt = bd().btn; return k.has('Escape') ? press(bt.apExit) : (k.has('Space') || k.has('KeyP')) ? press(bt.apPause) : null; }
    if (sc !== 'play' && sc !== 'lesson' && sc !== 'puzzle') return null;
    const bt = bd().btn;
    if (k.has('Escape')) return press(sc === 'puzzle' && state.pz.status === 'making' ? L.notice().btn : bt.menu);
    if (sc === 'lesson' && state.lesson.done) return go ? press(bt.next) : null;
    if (state.anim || state.dice.phase === 'rolling') return null;
    if (sc === 'play' && k.has('KeyU')) return press(bt.undo);
    if (sc === 'play' && k.has('KeyH')) return press(bt.hint);
    const g = state.game;
    if (g.roll < 0) return go ? press(bd().tray) : null;
    const moves = legalMoves(g);
    if (!moves.length || !humanTurn()) return null;
    const step = (k.has('ArrowRight') || k.has('ArrowDown') || k.has('Tab')) ? 1 : (k.has('ArrowLeft') || k.has('ArrowUp')) ? -1 : 0;
    if (step) { state.kb = state.kb < 0 ? (step > 0 ? 0 : moves.length - 1) : (state.kb + step + moves.length) % moves.length; state.sel = moves[state.kb].i; clack(620); return null; }
    if (go) {
      const m = state.kb >= 0 ? moves[state.kb] : moves.length === 1 ? moves[0] : null;
      if (!m) { say('Use the arrow keys to choose a piece, then press Enter.', 3); return null; }
      state.sel = m.i;
      const dc = destCell(m);
      const B = bd(), bp = dc ? cellCenter(dc.lane, dc.c) : press(HOME_RECT(g.turn));
      return B.toScreen(bp.x, bp.y);
    }
    return null;
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.afFlash > 0) state.afFlash -= dt;
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      easeRv(dt);
      if (state.scene !== 'about' && state.scene !== 'rules') wheelInput.dy = 0;
      const p = input.pointer, kbd = keyboard(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      if (state.scene === 'title') updateTitle(tap);
      else if (state.scene === 'play') updatePlay(dt, tap);
      else if (state.scene === 'lesson') updateLesson(dt, tap);
      else if (state.scene === 'puzzle') updatePuzzle(dt, tap);
      else if (state.scene === 'autoplay') updateAutoPlay(dt, tap);
      else if (state.scene === 'autoplay-over' && tap) {
        const Rz = lay().result;
        if (inRect(Rz.again, tap.x, tap.y)) startAutoPlay();
        else if (inRect(Rz.back, tap.x, tap.y)) state.scene = 'title';
      }
      else if (state.scene === 'about' || state.scene === 'rules') updateDoc(tap, input);
      else if (state.scene === 'over' && tap) {
        const Rz = lay().result;
        if (inRect(Rz.again, tap.x, tap.y)) start(state.two);
        else if (inRect(Rz.back, tap.x, tap.y)) state.scene = 'title';
      } else if (state.scene === 'demo-limit' && tap && inRect(lay().notice().btn, tap.x, tap.y)) state.scene = 'title';
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height)); },
    getState: () => state,
    // The free-preview timer counts only real play (a match or the daily puzzle). The menu, Learn, Rules, About,
    // Watch & Learn (Auto Play) and result screens are exempt.
    isPreviewExempt: () => !(state.scene === 'play' || state.scene === 'puzzle'),
  };
}
