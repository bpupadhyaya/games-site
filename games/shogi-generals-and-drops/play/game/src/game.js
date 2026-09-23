// Shogi: state and flow. Drawing is in view.js, the rule book is rules.js, the computer's brain is engine.js,
// lessons.js / tsume.js / puzzles.js / content.js are content. See design/ARCHITECTURE.md for the map.
//
// How a move is made: TAP a piece (its legal points glow), then TAP a glowing point. To drop a captured piece:
// TAP it on your stand, then TAP an empty glowing point. A refused move visibly tries, shudders, comes back, and a
// message says why.
import { W, H, geom, sqAt, standSlot, STAND, STAND_ORDER, inRect, TEXT_SCALES } from './layout.js';
import { newGame, applyMove, legalMoves, result, inCheck, mFrom, mTo, mPromo, mDrop, isDrop, dropMove, mk, whyNotMove, whyNotDrop, describe, fromRows, make, unmake, NAME, HINT, hasLegalMove } from './rules.js';
import { createThinker } from './engine.js';
import { LESSONS } from './lessons.js';
import { puzzleForDay, puzzlePos, moveMates, mateMoves, bestDefence } from './tsume.js';
import { buttonsFor } from './ui.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, DEMO_LESSONS = 4, HINTS = 3, STEP_NODES = 2000;
const SHOWCASE = 777700000;      // seeds SHOWCASE+1..+9 open fixed scenes for the store pictures (tools/arc shots)
const LETTER_T = { P: 1, L: 2, N: 3, S: 4, G: 5, B: 6, R: 7 };

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, variant: 'standard', game: newGame(), moves: [], human: 0, humanPick: 0, two: false, level: 2,
    sel: null, targets: [], anim: null, msg: null, thinking: false, thinkT: 0, result: null, hintsLeft: HINTS, hint: null,
    promo: null, menu: false, page: 0, cursor: 40, kb: false, lastMove: null, settingsFrom: null,
    // Index into TEXT_SCALES; the About/How-to-play/Rules reference pages' text size, set by the
    // A-/A+ stepper that lives right on those pages. Separate from prefs.big, which still governs
    // other (gameplay-adjacent) screens: setup/settings blurbs, lesson/puzzle status text, result text.
    textScaleIdx: 0,
    prefs: { sound: true, calm: false, big: false, labels: false, lang: 'jp' },
    stats: { played: 0, wins: 0 }, saved: null, lessonsDone: new Array(LESSONS.length).fill(false), lesson: null,
    pz: null, daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 }, demo: { games: 0, lessons: 0, puzzles: 0 },
    dev: config.dev === true, demoMode: config.demo === true,
  };
  let legalCache = null, thinker = null, hintThinker = null, pending = [], pendingShowcase = config.seed > SHOWCASE && config.seed < SHOWCASE + 10 ? config.seed - SHOWCASE : 0;
  let showcaseLang = null;         // a showcase scene's forced language choice always wins over the async prefs load below
  const G = () => geom(state.game.n);
  const flip = () => !state.two && state.human === 1 && state.scene === 'play';
  const bottomSide = () => (flip() ? 1 : 0);
  const legal = () => (legalCache ??= legalMoves(state.game));

  // ---- storage ---------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => {
    if (v) {
      state.prefs = { ...state.prefs, ...v.prefs }; state.level = v.level ?? state.level; audio.setMuted(!state.prefs.sound);
      // Guarded lookup + clamp: a stale saved index from a build with a longer/shorter TEXT_SCALES
      // array must never produce a NaN or out-of-range font size.
      state.textScaleIdx = Math.min(Math.max(v.textScaleIdx ?? state.textScaleIdx, 0), TEXT_SCALES.length - 1);
    }
    if (showcaseLang) state.prefs.lang = showcaseLang;
  });
  storage.get('progress', null).then((v) => { if (v) state.stats = { played: v.played ?? 0, wins: v.wins ?? 0 }; });
  storage.get('learned', null).then((v) => { if (Array.isArray(v)) state.lessonsDone = LESSONS.map((_, i) => !!v[i]); });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demo', null).then((v) => { if (v) state.demo = { games: Math.max(state.demo.games, v.games || 0), lessons: Math.max(state.demo.lessons, v.lessons || 0), puzzles: Math.max(state.demo.puzzles, v.puzzles || 0) }; });
  storage.get('save', null).then((v) => { if (v && Array.isArray(v.moves) && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { prefs: state.prefs, level: state.level, textScaleIdx: state.textScaleIdx });
  const saveProgress = () => storage.set('progress', { played: state.stats.played, wins: state.stats.wins });
  const saveGame = () => { if (state.scene === 'play' && !state.result && state.moves.length) { state.saved = { variant: state.variant, moves: state.moves.slice(), human: state.human, level: state.level, two: state.two }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };
  const saveDemo = () => storage.set('demo', state.demo);

  // ---- helpers ---------------------------------------------------------------------------------------------
  const dur = (d) => (state.prefs.calm ? d * 0.55 : d);
  const say = (text, hold = 6) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.prefs.sound) audio.tone(o); };
  const clack = (f = 420, v = 0.12) => tone({ freq: f * 0.8, to: f * 0.36, dur: 0.07, type: 'sine', vol: v });
  const chime = (freqs) => freqs.forEach((f) => tone({ freq: f, dur: 0.4, type: 'triangle', vol: 0.08 }));
  const later = (t, fn) => pending.push({ t, fn });
  const humanTurn = () => state.two || state.game.turn === state.human;
  const changed = () => { legalCache = null; state.sel = null; state.targets = []; state.hint = null; hintThinker = null; };
  const ui = () => ({ scene: state.scene, prefs: state.prefs, saved: state.saved, level: state.level, humanPick: state.humanPick, page: state.page, textScaleIdx: state.textScaleIdx, lessonsDone: state.lessonsDone, menu: state.menu, result: state.result, canUndo: state.moves.length > 0 && !state.two && !state.thinking, hintsLeft: state.hintsLeft, two: state.two, lesson: state.lesson, pz: state.pz, promo: state.promo });

  function replay(variant, moves) { const pos = newGame(variant); for (const m of moves) applyMove(pos, m); return pos; }
  function enter(scene) {
    Object.assign(state, { scene, menu: false, promo: null, page: 0, anim: null, msg: null, thinking: false });
    thinker = null; changed();
  }

  function startGame({ variant, human, level, two }) {
    if (state.demoMode && state.demo.games >= DEMO_GAMES) { enter('demo-limit'); return; }
    if (state.demoMode) { state.demo.games++; saveDemo(); }
    Object.assign(state, { variant, human, level, two, moves: [], game: newGame(variant), result: null, hintsLeft: HINTS, lastMove: null, cursor: variant === 'mini' ? 12 : 40 });
    enter('play'); clearSave(); savePrefs();
    say(two ? 'Sente (bottom) moves first. TAP a piece, then TAP a glowing point.' : human === 0 ? 'You move first. TAP a piece, then TAP a glowing point.' : 'The computer moves first. Watch its opening.', 9);
    monetization.track('game_start', { variant, level, two });
    afterMove();
  }
  function resume() {
    const v = state.saved;
    Object.assign(state, { variant: v.variant, human: v.human, level: v.level, two: v.two, moves: v.moves.slice(), game: replay(v.variant, v.moves), result: null, hintsLeft: HINTS, lastMove: v.moves.length ? v.moves[v.moves.length - 1] : null });
    enter('play'); say('Game restored.', 4);
    afterMove();
  }

  // ---- the one place a move is played -----------------------------------------------------------------------
  function playMove(m, quiet = false) {
    const pos = state.game, side = pos.turn, drop = isDrop(m), from = drop ? -1 : mFrom(m), to = mTo(m);
    const cell = drop ? (mDrop(m) | (side << 4)) : pos.b[from], capCell = drop ? 0 : pos.b[to];
    applyMove(pos, m);
    if (state.scene === 'play') state.moves.push(m);
    state.lastMove = m;
    state.anim = { kind: drop ? 'drop' : 'move', from, to, t: 0, dur: dur(capCell ? 0.46 : drop ? 0.3 : 0.24), cell, promo: mPromo(m), cap: capCell, by: side };
    changed();
    clack(drop ? 300 : 420, capCell ? 0.2 : 0.12);
    if (capCell) later(0.09, () => clack(240, 0.1));
    if (!quiet) afterMove();
  }
  function afterMove() {
    const pos = state.game;
    if (state.scene !== 'play') return;
    const res = result(pos);
    if (res) { finishGame(res); return; }
    if (inCheck(pos, pos.turn)) say(humanTurn() && !state.two ? 'Check! Your king is attacked: capture the attacker, block it, or move the king.' : 'Check!', 7);
    saveGame();
    if (!humanTurn()) { state.thinking = true; state.thinkT = 0; thinker = createThinker(pos, state.level, rng); }
  }
  function finishGame(res) {
    state.result = res; state.thinking = false; thinker = null; state.menu = false; state.sel = null; state.targets = [];
    const me = state.two ? null : state.human;
    const why = { checkmate: 'Checkmate', 'perpetual check': 'Perpetual check', repetition: 'Same position four times', 'move limit': 'Move limit reached', resignation: 'Resigned' }[res.why] || 'No legal move';
    if (res.winner === null) say(`${why}: the game is a draw.`, 999);
    else if (me === null) say(`${why}! ${res.winner === 0 ? 'Sente (bottom)' : 'Gote (top)'} wins.`, 999);
    else if (res.winner === me) say(`${why}! You win.`, 999);
    else say(`${why}. The computer wins this one. Try a lower level, or take moves back.`, 999);
    if (!state.two) { state.stats.played++; if (res.winner === me) state.stats.wins++; saveProgress(); chime(res.winner === me ? [523, 659, 784] : res.winner === null ? [440, 440] : [392, 330]); }
    clearSave();
    monetization.track('game_end', { winner: res.winner, why: res.why, ply: state.game.ply });
  }

  // ---- tapping -----------------------------------------------------------------------------------------------
  function computeTargets() {
    const s = state.sel, out = [];
    if (s) for (const m of legal()) if (s.drop ? (isDrop(m) && mDrop(m) === s.drop) : (!isDrop(m) && mFrom(m) === s.sq)) if (!out.includes(mTo(m))) out.push(mTo(m));
    state.targets = out;
  }
  function refuse(from, to, reason, cell) {
    state.anim = { kind: 'refuse', from, to, t: 0, dur: dur(0.55), cell, cap: 0, by: state.game.turn };
    say(reason, 8);
    tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.1 });
  }
  function tryMoveTo(to) {
    const pos = state.game, s = state.sel;
    if (s.drop) {
      if (state.targets.includes(to)) { commit(dropMove(s.drop, to)); return; }
      refuse(-1, to, whyNotDrop(pos, s.drop, to), s.drop | (pos.turn << 4));
      if (state.scene === 'lesson' && LESSONS[state.lesson.i].want.kind === 'refuse') lessonDone('That is the nifu rule: never two unpromoted pawns of yours in one column. Now you know.');
      return;
    }
    const from = s.sq;
    if (state.targets.includes(to)) {
      const opts = legal().filter((m) => !isDrop(m) && mFrom(m) === from && mTo(m) === to);
      if (opts.length > 1) { state.promo = { from, to, piece: pos.b[from] & 15, owner: pos.turn }; return; }
      commit(opts[0]); return;
    }
    refuse(from, to, whyNotMove(pos, from, to), pos.b[from]);
  }
  function commit(m) {
    if (state.scene === 'lesson') lessonMove(m);
    else if (state.scene === 'puzzle') puzzleMove(m);
    else playMove(m);
  }
  function blocked() {
    return !humanTurn() || state.result || state.anim || (state.scene === 'lesson' && state.lesson.done) || (state.scene === 'puzzle' && (state.pz.status !== 'play' || state.pz.busy));
  }
  function tapBoard(x, y) {
    const pos = state.game, sq = sqAt(G(), x, y, flip());
    if (sq < 0) return;
    state.cursor = sq;
    if (blocked()) { if (state.thinking) say('The computer is thinking. Your turn is coming.', 3); return; }
    const c = pos.b[sq], mine = c && (c >> 4) === pos.turn;
    if (state.sel && state.sel.sq === sq) { state.sel = null; state.targets = []; return; }
    if (state.sel && state.targets.includes(sq)) { tryMoveTo(sq); return; }
    if (mine) {
      state.sel = { sq }; computeTargets(); clack(520, 0.05);
      say(HINT[c & 15] + (state.targets.length ? '' : ' It has no legal move right now.'), 9);
      return;
    }
    if (state.sel) { tryMoveTo(sq); return; }
    say(c ? 'That is the opponent\'s piece. TAP one of your own pieces first.' : 'TAP one of your pieces first, then a glowing point.', 4);
  }
  function tapStand(which, i) {
    const pos = state.game, t = STAND_ORDER[i], owner = which === 'bot' ? bottomSide() : 1 - bottomSide();
    if (blocked() || owner !== pos.turn) { if (owner !== pos.turn && !state.result && !state.thinking) say('That is the opponent\'s stand. TAP your own stand, under the board.', 4); return; }
    if (!pos.hand[owner][t]) { say('You have no ' + NAME[t].toLowerCase() + ' on your stand.', 3); return; }
    if (state.sel && state.sel.drop === t) { state.sel = null; state.targets = []; return; }
    state.sel = { drop: t }; computeTargets(); clack(560, 0.05);
    say(state.targets.length ? `Drop the ${NAME[t].toLowerCase()}: TAP an empty glowing point.` : `No legal place to drop the ${NAME[t].toLowerCase()} right now.`, 7);
  }
  function tapStandAt(x, y) {
    for (const which of ['top', 'bot']) {
      if (!inRect(STAND[which], x, y)) continue;
      for (let i = 0; i < 7; i++) { const p = standSlot(which, i); if (Math.abs(x - p.x) < 44) { tapStand(which, i); break; } }
      return true;
    }
    return false;
  }

  // ---- lessons -------------------------------------------------------------------------------------------------
  function startLesson(i) {
    if (state.demoMode && i >= DEMO_LESSONS) { enter('demo-limit'); return; }
    const l = LESSONS[i];
    Object.assign(state, { game: fromRows(l.rows, l.hand || {}, 0), variant: 'standard', human: 0, two: true, moves: [], result: null, lastMove: null });
    enter('lesson'); state.lesson = { i, done: false };
    say(l.how, 999);
  }
  function lessonMove(m) {
    const l = LESSONS[state.lesson.i], w = l.want, pos = state.game, from = isDrop(m) ? -1 : mFrom(m), to = mTo(m);
    const at = w.to ? w.to[0] * pos.n + w.to[1] : -1;
    let ok = false;
    if (w.kind === 'capture') ok = !isDrop(m) && to === at;
    else if (w.kind === 'promote') ok = mPromo(m) === 1;
    else if (w.kind === 'drop') ok = isDrop(m) && mDrop(m) === LETTER_T[w.t] && to === at;
    else if (w.kind === 'mate') { const cap = make(pos, m); ok = inCheck(pos, pos.turn) && !hasLegalMove(pos); unmake(pos, m, cap); }
    if (!ok) { refuse(from, to, 'That move is legal, but this lesson asks for something else. ' + l.how, isDrop(m) ? (mDrop(m) | 0) : pos.b[from]); return; }
    playMove(m, true);
    lessonDone(w.kind === 'promote' ? 'Promoted! The character turned red: it now moves like a gold.' : w.kind === 'mate' ? 'Checkmate! The king has no escape. That is the heart of shogi.' : 'Well done.');
  }
  function lessonDone(text) {
    if (state.lesson.done) return;
    state.lesson.done = true; state.lessonsDone[state.lesson.i] = true;
    storage.set('learned', state.lessonsDone);
    say(text, 999); chime([523, 659, 784]);
    if (state.demoMode) { state.demo.lessons = Math.max(state.demo.lessons, state.lesson.i + 1); saveDemo(); }
  }
  function showLesson() {
    const w = LESSONS[state.lesson.i].want, pos = state.game;
    if (state.lesson.done || blocked()) return;
    if (w.kind === 'drop') { state.sel = { drop: LETTER_T[w.t] }; computeTargets(); return; }
    if (w.kind === 'refuse') { state.sel = { drop: 1 }; computeTargets(); say('TAP any empty point in the pawn\'s column, for example straight above your pawn.', 999); return; }
    for (const m of legal()) {
      let hit = false;
      if (w.kind === 'capture') hit = !isDrop(m) && mTo(m) === w.to[0] * pos.n + w.to[1];
      else if (w.kind === 'promote') hit = !!mPromo(m);
      else if (w.kind === 'mate') { const cap = make(pos, m); hit = inCheck(pos, pos.turn) && !hasLegalMove(pos); unmake(pos, m, cap); }
      if (hit) { state.sel = { sq: mFrom(m) }; computeTargets(); say('This piece. Now TAP the glowing point.', 999); return; }
    }
  }

  // ---- puzzle of the day ----------------------------------------------------------------------------------------
  function startPuzzle(extra = 0) {
    if (state.demoMode && state.demo.puzzles >= 1 && extra === 0 && state.scene !== 'puzzle') { enter('demo-limit'); return; }
    const day = (config.day ?? state.daily.day) + extra, pz = puzzleForDay(day);
    Object.assign(state, { game: puzzlePos(pz), variant: 'standard', human: 0, two: true, moves: [], result: null, lastMove: null });
    enter('puzzle');
    state.pz = { pz, extra, status: state.daily.solvedDay === day && !extra ? 'solved' : 'play', moveNo: 0, wrong: 0, busy: false, wait: 0 };
    say(state.pz.status === 'solved' ? 'Solved today. Come back tomorrow for a new puzzle, or try another.' : `Checkmate in ${pz.n === 1 ? 'one move' : 'three moves'}: every move you make must be a check. There is exactly one way.`, 999);
    if (state.demoMode) { state.demo.puzzles++; saveDemo(); }
  }
  function puzzleMove(m) {
    const p = state.pz, pos = state.game, remaining = p.pz.n - p.moveNo;
    const from = isDrop(m) ? -1 : mFrom(m);
    if (!moveMates(pos, m, remaining)) {
      p.wrong++;
      refuse(from, mTo(m), 'Legal, but it does not force checkmate. Look for a check the king cannot answer. Try again.', isDrop(m) ? (mDrop(m) | 0) : pos.b[from]);
      return;
    }
    playMove(m, true); p.moveNo++;
    if (!hasLegalMove(state.game)) { solved(); return; }
    p.busy = true; p.wait = 0.8;       // the defender answers with its most stubborn move
  }
  function solved() {
    const p = state.pz; p.status = 'solved'; p.busy = false;
    const day = config.day ?? state.daily.day;
    if (!p.extra && state.daily.solvedDay !== day) {
      state.daily.streak = state.daily.solvedDay === day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = day;
      storage.set('daily', { solvedDay: day, streak: state.daily.streak });
    }
    say(p.extra ? 'Checkmate! Solved.' : `Checkmate! Solved. Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}.`, 999);
    chime([523, 659, 784, 1046]);
  }

  // ---- hints -------------------------------------------------------------------------------------------------------
  function askHint() {
    if (state.scene === 'puzzle') {
      const p = state.pz; if (p.status !== 'play' || p.busy || state.anim) return;
      const sol = mateMoves(state.game, p.pz.n - p.moveNo)[0];
      if (sol !== undefined) { state.hint = { m: sol }; say('The highlighted move starts the mate. Every move must give check.', 999); }
      return;
    }
    if (state.scene !== 'play' || state.result || state.two || !humanTurn() || state.anim || hintThinker) return;
    if (state.hintsLeft <= 0) { say('No hints left in this game.', 3); return; }
    hintThinker = createThinker(state.game, 3, rng, { nodes: 40000, depth: 4, noNoise: true });
    say('Thinking about a good move…', 3);
  }
  function undo() {
    if (state.scene !== 'play' || state.result || state.two || state.anim) return;
    if (!state.moves.length) { say('Nothing to take back yet.', 3); return; }
    const pops = state.game.turn === state.human ? 2 : 1, keep = state.moves.slice(0, Math.max(0, state.moves.length - pops));
    state.moves = keep; state.game = replay(state.variant, keep); state.thinking = false; thinker = null; state.lastMove = keep.length ? keep[keep.length - 1] : null;
    changed(); say(pops === 2 ? 'Took back your move and the reply.' : 'Took back a move.', 3);
    afterMove();
  }

  // ---- buttons -----------------------------------------------------------------------------------------------------
  function goBack() {
    if (state.scene === 'settings' && state.settingsFrom === 'play' && state.moves.length && !state.result) {
      state.settingsFrom = null; enter('play'); say('Back in the game.', 3); afterMove(); return;
    }
    state.settingsFrom = null; enter('title');
  }
  function press(id) {
    if (id.startsWith('level')) { state.level = Number(id.slice(5)); savePrefs(); return; }
    if (id.startsWith('lesson')) { startLesson(Number(id.slice(6))); return; }
    switch (id) {
      case 'continue': resume(); break;
      case 'play': state.humanPick = 0; state.variant = 'standard'; enter('setup'); break;
      case 'mini': state.humanPick = 0; state.variant = 'mini'; enter('setup'); break;
      case 'two': startGame({ variant: 'standard', human: 0, level: state.level, two: true }); break;
      case 'learn': enter('learn'); break;
      case 'puzzle': startPuzzle(0); break;
      case 'howto': enter('howto'); break;
      case 'about': enter('about'); break;
      case 'rules': enter('rules'); break;
      case 'settings': { const from = state.scene === 'play' && state.moves.length && !state.result ? 'play' : null; enter('settings'); state.settingsFrom = from; break; }
      case 'sound': case 'tSound': state.prefs.sound = !state.prefs.sound; audio.setMuted(!state.prefs.sound); savePrefs(); break;
      case 'tCalm': state.prefs.calm = !state.prefs.calm; savePrefs(); break;
      case 'tBig': state.prefs.big = !state.prefs.big; savePrefs(); break;
      case 'tLabels': state.prefs.labels = !state.prefs.labels; savePrefs(); break;
      case 'langJP': state.prefs.lang = 'jp'; savePrefs(); break;
      case 'langEN': state.prefs.lang = 'en'; savePrefs(); break;
      case 'back': goBack(); break;
      case 'prev': state.page = Math.max(0, state.page - 1); break;
      case 'next': state.page++; break;
      case 'textDec': if (state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); } break;
      case 'textInc': if (state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); } break;
      case 'sideB': state.humanPick = 0; break;
      case 'sideW': state.humanPick = 1; break;
      case 'start': startGame({ variant: state.variant, human: state.humanPick, level: state.level, two: false }); break;
      case 'again': startGame({ variant: state.variant, human: state.two ? 0 : state.human, level: state.level, two: state.two }); break;
      case 'title': enter('title'); break;
      case 'menu': state.menu = true; break;
      case 'resume': state.menu = false; break;
      case 'newgame': state.humanPick = state.human; enter('setup'); break;
      case 'resign': state.menu = false; finishGame({ over: true, winner: 1 - (state.two ? state.game.turn : state.human), why: 'resignation' }); break;
      case 'undo': undo(); break;
      case 'hint': case 'pzHint': askHint(); break;
      case 'pzRestart': startPuzzle(state.pz.extra); break;
      case 'anotherPuzzle': startPuzzle(state.pz.extra + 1); break;
      case 'retryLesson': startLesson(state.lesson.i); break;
      case 'nextLesson': startLesson(state.lesson.i + 1); break;
      case 'showMe': showLesson(); break;
      case 'promoYes': case 'promoNo': {
        const pr = state.promo, opts = legal().filter((m) => !isDrop(m) && mFrom(m) === pr.from && mTo(m) === pr.to);
        state.promo = null; commit(opts.find((m) => mPromo(m) === (id === 'promoYes' ? 1 : 0)) ?? opts[0]); break;
      }
      case 'promoCancel': state.promo = null; state.sel = null; state.targets = []; break;
      default: break;
    }
  }
  function handleTap(x, y) {
    for (const b of buttonsFor(ui())) {
      if (!inRect(b, x, y)) continue;
      if (b.dim) { if (b.id === 'hint') say(state.two ? 'Hints are for games against the computer.' : 'No hints left in this game.', 3); else if (b.id === 'undo') say('Nothing to take back yet.', 3); return; }
      press(b.id);
      if (!['menu', 'resume', 'undo', 'hint'].includes(b.id)) tone({ freq: 660, to: 880, dur: 0.05, type: 'sine', vol: 0.05 });
      return;
    }
    if (state.promo || state.menu) return;
    if (state.scene === 'play' || state.scene === 'lesson' || state.scene === 'puzzle') { if (!tapStandAt(x, y)) tapBoard(x, y); }
  }
  function cursorPoint() {
    const g = G(), r = (state.cursor / g.n) | 0, c = state.cursor % g.n, rr = flip() ? g.n - 1 - r : r, cc = flip() ? g.n - 1 - c : c;
    return { x: g.gx + (cc + 0.5) * g.cell, y: g.gy + (rr + 0.5) * g.cell };
  }
  function handleKeys(keys) {
    const n = state.game.n, playing = state.scene === 'play' || state.scene === 'lesson' || state.scene === 'puzzle';
    const move = (dr, dc) => {
      state.kb = true; const s = flip() ? -1 : 1;
      const r = Math.max(0, Math.min(n - 1, ((state.cursor / n) | 0) + dr * s)), c = Math.max(0, Math.min(n - 1, (state.cursor % n) + dc * s));
      state.cursor = r * n + c;
    };
    for (const k of keys) {
      if (k === 'ArrowUp') move(-1, 0); else if (k === 'ArrowDown') move(1, 0); else if (k === 'ArrowLeft') move(0, -1); else if (k === 'ArrowRight') move(0, 1);
      else if (k === 'Space' || k === 'Enter') {
        state.kb = true;
        if (state.promo) press('promoYes');
        else if (state.scene === 'title') press(state.saved ? 'continue' : 'play');
        else if (state.scene === 'setup') press('start');
        else if (playing && !state.menu) { const p = cursorPoint(); tapBoard(p.x, p.y); }
      } else if (k === 'Escape') {
        if (state.promo) press('promoCancel'); else if (state.sel) { state.sel = null; state.targets = []; } else if (state.scene === 'play' && !state.result) state.menu = !state.menu;
      } else if (k === 'KeyH') askHint();
      else if (k === 'KeyZ') undo();
      else if (k === 'KeyD' && playing && humanTurn() && !state.menu) {
        const owner = state.game.turn, order = STAND_ORDER.filter((t) => state.game.hand[owner][t] > 0);
        if (!order.length) continue;
        const cur = state.sel && state.sel.drop ? order.indexOf(state.sel.drop) : -1;
        tapStand(owner === bottomSide() ? 'bot' : 'top', STAND_ORDER.indexOf(order[(cur + 1) % order.length]));
      }
    }
  }

  // ---- showcase scenes for the store pictures (only the reserved seeds) -----------------------------------------------------
  function playXY(r0, c0, r1, c1, promo = 0) {
    const n = state.game.n, m = mk(r0 * n + c0, r1 * n + c1, promo);
    if (legal().includes(m)) playMove(m, true);
    state.thinking = false; thinker = null; state.anim = null;
  }
  function showcase(k) {
    state.t = 3;
    if (k === 2 || k === 5) {
      startGame({ variant: 'standard', human: 0, level: 2, two: false });
      const script = k === 2 ? [[6, 2, 5, 2], [2, 6, 3, 6], [7, 7, 7, 6], [2, 2, 3, 2]] : [[6, 2, 5, 2], [2, 6, 3, 6], [7, 1, 2, 6, 1], [1, 7, 2, 6], [6, 3, 5, 3], [0, 2, 1, 3], [6, 6, 5, 6], [2, 2, 3, 2], [8, 5, 7, 5], [3, 6, 4, 6]];
      for (const s of script) playXY(...s);
      state.anim = null; state.msg = null;
      if (k === 2) { state.sel = { sq: 7 * 9 + 6 }; computeTargets(); say('Rook: slides along its row or column any distance.', 999); }
      else { state.thinking = false; state.sel = { sq: 5 * 9 + 6 }; computeTargets(); say(`Captured pieces wait on the stand. TAP one, then TAP an empty point to drop it.`, 999); }
    } else if (k === 3) { startLesson(5); showLesson(); }
    else if (k === 4) startPuzzle(0);
    else if (k === 6) { startLesson(8); state.game = fromRows(LESSONS[8].rows, {}, 0); state.sel = { sq: 3 * 9 + 3 }; computeTargets(); state.promo = { from: 3 * 9 + 3, to: 2 * 9 + 3, piece: 1, owner: 0 }; }
    // language choice: 7 shows a game in Play (English) (Western letters on every piece, no kanji); 8/9 show the
    // Settings screen's "Play (日本語)" / "Play (English)" choice itself, in each of its two states. showcaseLang
    // is re-applied once the async prefs load resolves (it may finish after this runs), so the forced choice
    // always wins for these fixed store-picture scenes.
    else if (k === 7) {
      showcaseLang = state.prefs.lang = 'en';
      startGame({ variant: 'standard', human: 0, level: 2, two: false });
      for (const s of [[6, 2, 5, 2], [2, 6, 3, 6], [7, 7, 7, 6], [2, 2, 3, 2]]) playXY(...s);
      state.anim = null; state.msg = null;
      state.sel = { sq: 7 * 9 + 6 }; computeTargets(); say('Rook: slides along its row or column any distance.', 999);
    } else if (k === 8) { showcaseLang = state.prefs.lang = 'jp'; enter('settings'); }
    else if (k === 9) { showcaseLang = state.prefs.lang = 'en'; enter('settings'); }
  }

  // ---- update ---------------------------------------------------------------------------------------------------------------
  function update(dt, input) {
    state.t += dt;
    if (pendingShowcase) { const k = pendingShowcase; pendingShowcase = 0; showcase(k); }
    if (state.msg) state.msg.t += dt;
    for (const p of pending) p.t -= dt;
    if (pending.length) pending = pending.filter((p) => { if (p.t <= 0) { p.fn(); return false; } return true; });
    if (state.anim) { state.anim.t += dt; if (state.anim.t >= state.anim.dur) state.anim = null; }

    const pt = input.pointer;
    if (pt.pressed) handleTap(pt.x, pt.y);
    if (input.keys.pressed.size) handleKeys([...input.keys.pressed]);

    if (state.scene === 'play' && !state.menu && !state.result) {
      if (state.thinking && thinker) {
        state.thinkT += dt;
        const res = thinker.step(STEP_NODES);
        if (res && state.thinkT >= dur(0.5) && !state.anim) { thinker = null; state.thinking = false; playMove(res.move); }
      }
      if (hintThinker) {
        const res = hintThinker.step(STEP_NODES);
        if (res) {
          hintThinker = null;
          if (res.move) { state.hintsLeft--; const d = describe(state.game, res.move); state.hint = { m: res.move }; say('Try the highlighted move: it ' + (d.length ? d.join(' and ') : 'improves your position') + '.', 999); }
        }
      }
    }
    if (state.scene === 'puzzle' && state.pz.busy && !state.anim) {
      state.pz.wait -= dt;
      if (state.pz.wait <= 0) {
        const p = state.pz; playMove(bestDefence(state.game), true); p.busy = false;
        say(`Check! Keep going: mate in ${p.pz.n - p.moveNo}.`, 999);
      }
    }
  }

  if (pendingShowcase) { const k = pendingShowcase; pendingShowcase = 0; showcase(k); }

  return {
    update,
    render(ctx, view) { render(ctx, state, { G: G(), flip: flip(), bottomSide: bottomSide(), buttons: buttonsFor(ui()), view }); },
    getState() { return state; },
  };
}
