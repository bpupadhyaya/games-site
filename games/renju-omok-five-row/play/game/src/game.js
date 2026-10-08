// Five in a Row: Renju & Omok - state and flow. Rules: rules.js. The computer: engine.js. Drawing: view.js, screens.js, art.js.
// Screens ('scene'): title, setup, play (also lessons and Watch & Learn), over, learn, settings, about, howto, rules, demo-limit.
import { MODES, MODE_IDS, OPENINGS, BLACK, WHITE, newGame, fromMoves, applyMove, legality, forbiddenPoints, foulText, centerOf, nameOf, restrictedThird } from './rules.js';
import { LEVELS, createThinker, threatsOf, explainMove, swapChoice, warmTables } from './engine.js';
import { layoutFor, TEXT_SCALES, THINK_STEPS, inRect, clamp } from './layout.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';
import { ui, beginFrame, hitAt, checkFonts } from './ui.js';
import { renderPlay, cellAt } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderReader, renderLearn, renderOver, renderDemoLimit } from './screens.js';
import { WOOD_IDS, STONE_IDS } from './art.js';

// Fluid viewport (kit): the short side is 720 units and the long side follows the screen; the kit updates meta.width/height live.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
const DEMO_GAMES = 3, AUTO_REVEAL_SECS = 2;
const SCROLL_SCENES = ['setup', 'settings', 'about', 'howto', 'rules', 'learn'];
const READERS = ['about', 'howto', 'rules'];

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  const state = {
    scene: 'title', t: 0, sceneT: 1,
    game: newGame('gomoku'), mode: 'gomoku', human: BLACK, two: false, level: 3, opening: 'none', seat0: BLACK, swapDone: false, swapAsk: false,
    last: -1, anim: null, winT: 0, overT: 0, overWhy: '', overHide: false,
    thinking: false, progress: 0, thinkDelay: 0, centreNext: false,
    hover: -1, aim: -1, aimStart: -1, pending: -1, touch: false, mouse: false, canPlay: false, kb: -1, px: undefined, py: undefined,
    hint: null, msg: null, coachText: '', coachMode: 1, threats: null, forbid: [], autoFree: false, shake: null,
    set: { sound: true, confirm: false, calm: false, coords: true, wood: 'kaya', stones: 'slate', ts: 0, thinkIdx: 1 },
    stats: { games: 0, wins: 0, w: {}, lessons: {} }, saved: null, demoGames: 0,
    scroll: { setup: 0, settings: 0, about: 0, howto: 0, rules: 0, learn: 0 },
    autoMode: false, autoPhase: null, autoMove: -1, autoWhy: '', autoTimer: 0, autoPaused: false, autoFrom: 'title',
    lesson: null, sfx: [], warmed: false, dev: config.dev === true,
  };
  let thinker = null, hintThinker = null, lastScene = state.scene, drag = null;

  // ---- storage ----------------------------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => {
    if (!v) return;
    state.mode = MODES[v.mode] ? v.mode : state.mode; state.level = clamp(v.level ?? 3, 1, LEVELS.length); state.human = v.human === WHITE ? WHITE : BLACK; state.two = !!v.two;
    state.coachMode = clamp(v.coachMode ?? 1, 0, 2); state.opening = OPENINGS.includes(v.opening) ? v.opening : 'none';
    Object.assign(state.set, { sound: v.sound ?? true, confirm: !!v.confirm, calm: !!v.calm, coords: v.coords ?? true, wood: WOOD_IDS.includes(v.wood) ? v.wood : 'kaya', stones: STONE_IDS.includes(v.stones) ? v.stones : 'slate', ts: clamp(v.ts ?? 0, 0, TEXT_SCALES.length - 1), thinkIdx: clamp(v.thinkIdx ?? 1, 0, THINK_STEPS.length - 1) });
    audio.setMuted?.(!state.set.sound);
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { games: v.games ?? 0, wins: v.wins ?? 0, w: v.w ?? {}, lessons: v.lessons ?? {} }; });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && Array.isArray(v.moves) && v.moves.length && MODES[v.mode] && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { mode: state.mode, level: state.level, human: state.human, two: state.two, coachMode: state.coachMode, opening: state.opening, ...state.set });
  const saveStats = () => storage.set('stats', state.stats);
  const saveGame = () => {
    const g = state.game;
    if (state.scene !== 'play' || state.autoMode || state.lesson || g.winner || !g.moves.length) return;
    state.saved = { mode: g.mode, moves: g.moves.slice(), human: state.human, two: state.two, level: state.level, opening: g.opening, seat0: state.seat0, swapDone: state.swapDone }; storage.set('save', state.saved);
  };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  // ---- sound ------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.set.sound && !state.autoPaused) audio.tone(o); };
  const clack = (white) => { tone({ freq: white ? 250 : 200, to: 90, dur: 0.1, type: 'sine', vol: 0.17 }); tone({ freq: 1800, to: 1000, dur: 0.03, type: 'triangle', vol: 0.06 }); };
  const tick = () => tone({ freq: 620, to: 520, dur: 0.04, type: 'triangle', vol: 0.07 });
  const buzz = () => tone({ freq: 150, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.07 });
  const jingle = (win) => { const f = win ? [523, 659, 784, 1046] : [392, 349, 330]; f.forEach((q, i) => state.sfx.push({ t: i * 0.11, o: { freq: q, to: q * 1.01, dur: 0.22, type: 'triangle', vol: 0.09 } })); };
  const say = (text, hold = 5) => { state.msg = { text, t: 0, hold }; };

  // ---- position bookkeeping -----------------------------------------------------------------------------------------------------
  const restricted = () => { const m = MODES[state.game.mode]; return m.ban3 || m.ban4 || m.banOver || state.game.opening === 'restricted'; };
  const humanTurn = () => !state.autoMode && !state.game.winner && !state.swapAsk && (state.lesson ? true : state.two || state.game.turn === state.human);
  function refresh() {
    const g = state.game;
    state.forbid = state.coachMode > 0 && restricted() && !g.winner && g.turn === BLACK && (humanTurn() || state.autoMode) ? forbiddenPoints(g) : [];
    state.threats = state.coachMode > 0 && !g.winner && g.moves.length && !state.autoMode ? threatsOf(g) : null;
    state.coachText = coachLine();
  }
  function coachLine() {
    const g = state.game, th = state.threats, me = g.turn, op = 3 - me, nm = (c) => (c === BLACK ? 'Black' : 'White');
    if (state.lesson) { const l = LESSONS[state.lesson.i]; return state.lesson.done ? l.ok : l.text; }
    if (g.winner) return '';
    if (state.autoMode) return state.autoWhy || 'Watch how the computer plays both sides.';
    if (!humanTurn()) return state.thinking ? 'The computer is thinking.' : '';
    if (state.coachMode === 0) return state.two ? `${nm(me)} to move.` : 'Your move.';
    const pt = (arr) => arr.slice(0, 2).map((i) => nameOf(g.n, i)).join(' or ');
    if (!th) return MODES[g.mode].centerFirst ? 'Black opens in the centre.' : 'Place the first stone. The centre is a good start.';
    if (th.five[me].length) return `${state.two ? nm(me) : 'You'} can make five at ${pt(th.five[me])}. Play it and win.`;
    if (th.five[op].length) return `${nm(op)} threatens five at ${pt(th.five[op])}. Block it now.`;
    if (th.win[me].length && state.coachMode > 1) return `A winning combination is available at ${pt(th.win[me])}.`;
    if (th.win[op].length) return `${nm(op)} is close to a winning combination at ${pt(th.win[op])}. Block, or attack with a four.`;
    if (restrictedThird(g)) return 'Opening rule: Black\u2019s second stone must go outside the marked central square.';
    if (state.forbid.length) return 'Red crosses are forbidden for Black. The coach marks them for you.';
    return g.moves.length < 4 ? 'Build near the centre, where stones can join in every direction.' : state.two ? `${nm(me)} to move.` : 'Your move. Make threes and fours, and watch your opponent’s lines.';
  }

  // ---- starting games ------------------------------------------------------------------------------------------------------------
  function resetPlay(extra) {
    thinker = hintThinker = null;
    Object.assign(state, { swapAsk: false, swapDone: false, last: -1, anim: null, winT: 0, overT: 0, overWhy: '', overHide: false, thinking: false, progress: 0, thinkDelay: 0, centreNext: false, hover: -1, aim: -1, aimStart: -1, pending: -1, kb: -1, hint: null, msg: null, autoMode: false, autoPhase: null, autoMove: -1, autoWhy: '', autoTimer: 0, autoPaused: false, lesson: null, canPlay: false, threats: null, forbid: [] }, extra);
  }
  function startGame(fresh = true) {
    if (config.demo && fresh && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo && fresh) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    resetPlay({ scene: 'play', game: newGame(state.mode, state.opening), seat0: state.human });
    monetization.track('game_start', { mode: state.mode, level: state.level, two: state.two });
    if (fresh) clearSave();
    say(MODES[state.mode].centerFirst ? 'Renju: Black always opens in the centre.' : state.two ? 'Black moves first. Pass the device after each move.' : state.human === BLACK ? 'You are Black and move first.' : 'You are White. Black moves first.', 5);
    afterMove();
  }
  function resume() {
    const v = state.saved; if (!v) return;
    state.mode = v.mode; state.human = v.human; state.two = v.two; state.level = v.level; state.opening = v.opening ?? 'none';
    resetPlay({ scene: 'play', game: fromMoves(v.mode, v.moves, v.opening), seat0: v.seat0 ?? v.human, swapDone: !!v.swapDone });
    state.last = v.moves[v.moves.length - 1] ?? -1;
    say('Game restored.', 3); afterMove();
  }
  function startAuto(from) {
    resetPlay({ scene: 'play', game: newGame(state.mode), autoMode: true, autoFrom: from });
    state.autoWhy = 'The computer is choosing a move.';
    say('Watch & Learn: the computer plays both sides. Guess each move before it appears.', 6);
    afterMove();
  }
  function startLesson(i) {
    const l = LESSONS[i], g = newGame(l.mode);
    l.b.forEach(([x, y]) => { g.cells[y * g.n + x] = BLACK; g.moves.push(y * g.n + x); });
    l.w.forEach(([x, y]) => { g.cells[y * g.n + x] = WHITE; g.moves.push(y * g.n + x); });
    g.turn = l.turn;
    resetPlay({ scene: 'play', game: g, human: l.turn, two: false, lesson: { i, done: false, tries: 0 } });
    const keep = state.coachMode; state.coachMode = Math.max(keep, 1); refresh(); state.coachMode = keep;
  }

  // what happens after any stone goes down (or a game starts)
  function afterMove() {
    const g = state.game;
    if (g.opening === 'swap' && !state.swapDone && g.moves.length === 3 && !g.winner && !state.lesson && !state.autoMode) decideSwap();
    refresh();
    if (g.winner || state.autoMode || state.lesson) { if (state.autoMode) { state.autoPhase = null; thinker = null; } return; }
    if (!humanTurn()) { state.thinkDelay = g.moves.length ? 0.5 : 0.35; thinker = null; state.thinking = false; }
    else if (!state.two && MODES[g.mode].centerFirst && g.moves.length === 0 && g.turn === BLACK) { state.thinkDelay = 0.45; state.centreNext = true; }
  }

  // Swap opening: after the third stone the side that plays White may take Black instead (colours swap seats).
  function decideSwap() {
    const g = state.game;
    if (state.two || state.human === WHITE) { state.swapAsk = true; state.thinking = false; return; }   // a person decides
    state.swapDone = true;                                           // the computer decides (it is the second player)
    if (swapChoice(g)) { state.human = WHITE; say('The computer swaps colours: you now play White, and it plays Black.', 7); }
    else say('The computer keeps White.', 5);
  }
  function answerSwap(swap) {
    state.swapAsk = false; state.swapDone = true;
    if (swap) { if (!state.two) state.human = 3 - state.human; say(state.two ? 'Colours swapped: the players change sides. Pass the device.' : 'You swapped: you now play Black, and the computer plays White.', 7); }
    else say(state.two ? 'Colours kept.' : 'You keep White.', 4);
    afterMove();
  }
  function play(idx) {
    const g = state.game, color = g.turn;
    applyMove(g, idx);
    state.last = idx; state.hint = null; state.pending = -1; state.aim = -1; state.aimStart = -1; state.thinking = false; state.msg = null;
    state.anim = { idx, color, t: 0, dur: state.set.calm ? 0.12 : 0.3 };
    clack(color === WHITE);
    if (g.winner) {
      state.winT = 0; state.overT = 1.5;
      state.overWhy = g.winner === 3 ? 'The board is full.' : `${g.winner === BLACK ? 'Black' : 'White'} made ${g.line.length > 5 ? g.line.length : 'five'} in a row.`;
      jingle(g.winner !== 3 && (state.two || state.autoMode || state.lesson || g.winner === state.human));
    }
    afterMove();
    saveGame();
  }

  function finish() {
    const g = state.game;
    state.scene = 'over';
    if (!state.autoMode && !state.lesson) {
      state.stats.games += 1; clearSave();
      if (!state.two && g.winner === state.human) { state.stats.wins += 1; ((state.stats.w[g.mode] ??= {})[state.level] = true); }
      saveStats(); monetization.track('game_end', { winner: g.winner, moves: g.moves.length, mode: g.mode, level: state.level });
    }
  }

  // ---- human moves ----------------------------------------------------------------------------------------------------------------
  function tryHuman(idx) {
    const g = state.game;
    if (state.lesson) return lessonMove(idx);
    const l = legality(g, idx);
    if (!l.ok) {
      if (l.reason === 'occupied') { tick(); return; }
      buzz();
      if (l.reason === 'centre') say('In Renju, Black’s first stone goes on the centre point.', 4);
      else if (l.reason === 'third') { say('Restricted third move: Black\u2019s second stone must go outside the marked central square.', 6); state.shake = { idx, t: 0 }; }
      else { say(`Forbidden: that would be ${foulText(l.reason)}. Black may not play it.`, 6); state.shake = { idx, t: 0 }; }
      return;
    }
    play(idx);
  }
  function lessonMove(idx) {
    const L = state.lesson, l = LESSONS[L.i], g = state.game, n = g.n, [ax, ay] = l.at ?? [-1, -1];
    if (L.done) return;
    if (l.kind === 'refused') {
      if (idx === ay * n + ax) { const r = legality(g, idx); buzz(); state.hint = null; L.done = true; say(r.ok ? 'Allowed.' : `Refused: ${foulText(r.reason)}.`, 6); state.stats.lessons[L.i] = true; saveStats(); jingle(true); refresh(); }
      else { L.tries++; say(l.hint, 5); tick(); }
      return;
    }
    if (l.answers.some(([x, y]) => y * n + x === idx)) {
      if (!legality(g, idx).ok) { buzz(); say('That point is not allowed.', 4); return; }
      play(idx); L.done = true; state.stats.lessons[L.i] = true; saveStats(); state.hint = null; refresh();
    } else { L.tries++; buzz(); say(`Not that one. ${l.hint}`, 6); }
  }
  function doUndo() {
    const g = state.game;
    if (state.lesson || state.autoMode) return;
    if (state.thinking) { thinker = hintThinker = null; state.thinking = false; }
    if (!g.moves.length) { say('Nothing to take back yet.', 3); return; }
    const mv = g.moves.slice(); mv.pop();
    if (state.swapDone && mv.length < 3) { state.swapDone = false; state.human = state.seat0; }
    state.swapAsk = false;
    if (!state.two) while (mv.length && (mv.length % 2 === 0 ? BLACK : WHITE) !== state.human) mv.pop();
    if (MODES[g.mode].centerFirst && state.human === BLACK && !state.two && mv.length === 0) mv.push(centerOf(g.n));
    state.game = fromMoves(g.mode, mv, g.opening); state.last = mv[mv.length - 1] ?? -1; state.anim = null; state.hint = null; state.pending = -1; state.centreNext = false;
    tick(); say('Move taken back.', 3); afterMove(); saveGame();
  }
  function doHint() {
    const g = state.game;
    if (g.winner) return;
    if (state.lesson) {
      const l = LESSONS[state.lesson.i], t = l.kind === 'refused' ? l.at : l.answers[0];
      state.hint = { idx: t[1] * g.n + t[0], t: 0 }; say(l.hint, 6); return;
    }
    if (!humanTurn() || hintThinker) return;
    hintThinker = createThinker(g, 4, rng, { nodes: 60000, scale: config.aiScale }); state.thinking = true; state.progress = 0; state.hint = null; say('Looking for a good move.', 8);
  }

  // ---- AI ---------------------------------------------------------------------------------------------------------------------------
  function aiStep(dt) {
    if (state.thinkDelay > 0) { state.thinkDelay -= dt; return; }
    if (state.centreNext) { state.centreNext = false; play(centerOf(state.game.n)); return; }
    if (!thinker) { thinker = createThinker(state.game, state.level, rng, { scale: config.aiScale }); state.thinking = true; state.progress = 0; }
    const r = thinker.step(config.aiSlice);
    if (r.move === undefined) { state.progress = r.progress ?? state.progress; return; }
    thinker = null; state.thinking = false;
    if (r.move >= 0) play(r.move);
  }
  function hintStep() {
    const r = hintThinker.step(config.aiSlice);
    if (r.move === undefined) { state.progress = r.progress ?? 0; return; }
    hintThinker = null; state.thinking = false;
    if (r.move >= 0) { const why = explainMove(state.game, r.move); state.hint = { idx: r.move, t: 0 }; say(`Hint ${nameOf(state.game.n, r.move)}: ${why}`, 9); }
  }
  // Watch & Learn: compute -> THINK (configurable, board still, "what would you play?") -> REVEAL (2 s, the move and why) -> ACT.
  function autoTick(dt) {
    const g = state.game;
    if (state.autoPhase === 'reveal') { state.autoTimer -= dt; if (state.autoTimer <= 0) { const m = state.autoMove; state.autoPhase = null; state.hint = null; if (m >= 0) play(m); } return; }
    if (state.autoPhase === 'think') {
      state.autoTimer -= dt;
      if (state.autoTimer <= 0) {
        state.autoPhase = 'reveal'; state.autoTimer = AUTO_REVEAL_SECS; state.hint = { idx: state.autoMove, t: 0 };
        state.autoWhy = explainMove(g, state.autoMove); state.coachText = `${g.turn === BLACK ? 'Black' : 'White'} plays ${nameOf(g.n, state.autoMove)}. ${state.autoWhy}`; state.msg = null;
      }
      return;
    }
    if (!thinker) { thinker = createThinker(g, Math.max(state.level, 2), rng, { scale: config.aiScale }); state.thinking = true; state.progress = 0; }
    const r = thinker.step(config.aiSlice);
    if (r.move === undefined) { state.progress = r.progress ?? 0; return; }
    thinker = null; state.thinking = false; state.autoMove = r.move; state.autoPhase = 'think'; state.autoTimer = THINK_STEPS[state.set.thinkIdx];
    state.autoWhy = `${g.turn === BLACK ? 'Black' : 'White'} is thinking. What would you play?`; state.coachText = state.autoWhy; state.msg = null;
  }

  // ---- buttons on the play screen ---------------------------------------------------------------------------------------------------
  function playButtons() {
    if (state.scene === 'over') return [{ id: 'menu', label: 'Menu' }, { id: 'again', label: 'Play again', kind: 'primary' }];
    if (state.autoMode) return [
      { id: 'exit', label: 'Exit' }, { id: 'pause', label: state.autoPaused ? 'Resume' : 'Pause', kind: 'primary' },
      { id: 'thdec', label: 'Think −', sub: `${THINK_STEPS[state.set.thinkIdx]} s`, disabled: state.set.thinkIdx === 0 }, { id: 'thinc', label: 'Think +', sub: `${THINK_STEPS[state.set.thinkIdx]} s`, disabled: state.set.thinkIdx === THINK_STEPS.length - 1 },
    ];
    if (state.lesson) return [{ id: 'menu', label: 'Lessons' }, { id: 'hint', label: 'Hint' }, { id: 'retry', label: 'Retry' }, { id: 'next', label: state.lesson.i + 1 < LESSONS.length ? 'Next' : 'Done', kind: 'primary', disabled: !state.lesson.done }];
    return [{ id: 'menu', label: 'Menu' }, { id: 'undo', label: 'Undo' }, { id: 'hint', label: 'Hint' }, { id: 'coach', label: 'Coach', sub: ['Off', 'Alerts', 'Full'][state.coachMode] }];
  }
  function leavePlay(to) {
    saveGame(); thinker = hintThinker = null;
    Object.assign(state, { thinking: false, autoMode: false, autoPhase: null, autoPaused: false, hint: null, msg: null, lesson: null, scene: to });
  }
  function press(id) {
    const sc = state.scene;
    switch (id) {
      case 'back': state.scene = 'title'; break;
      case 'menu': if (sc === 'over') leavePlay('title'); else if (state.lesson) leavePlay('learn'); else leavePlay('title'); break;
      case 'exit': leavePlay(state.autoFrom ?? 'title'); break;
      case 'pause': state.autoPaused = !state.autoPaused; break;
      case 'thdec': state.set.thinkIdx = clamp(state.set.thinkIdx - 1, 0, THINK_STEPS.length - 1); savePrefs(); break;
      case 'thinc': state.set.thinkIdx = clamp(state.set.thinkIdx + 1, 0, THINK_STEPS.length - 1); savePrefs(); break;
      case 'tdec': state.set.ts = clamp(state.set.ts - 1, 0, TEXT_SCALES.length - 1); savePrefs(); break;
      case 'tinc': state.set.ts = clamp(state.set.ts + 1, 0, TEXT_SCALES.length - 1); savePrefs(); break;
      case 'undo': doUndo(); break;
      case 'hint': doHint(); break;
      case 'coach': state.coachMode = (state.coachMode + 1) % 3; savePrefs(); refresh(); break;
      case 'retry': if (state.lesson) startLesson(state.lesson.i); break;
      case 'next':
        if (READERS.includes(sc)) { const z = ui.scrolls[0]; if (z && (state.scroll[sc] || 0) < z.max - 2) state.scroll[sc] = clamp((state.scroll[sc] || 0) + z.r.h * 0.85, 0, z.max); else state.scene = 'title'; }
        else if (state.lesson?.done) { const i = state.lesson.i + 1; if (i < LESSONS.length) startLesson(i); else leavePlay('learn'); }
        break;
      case 'again': if (state.autoMode) startAuto(state.autoFrom); else startGame(true); break;
      case 'review': state.overHide = true; break;
      case 'swapyes': answerSwap(true); break;
      case 'swapkeep': answerSwap(false); break;
      case 'home': env.openArcforgeHome?.(); break;
      case 'continue': resume(); break;
      case 'play': state.scene = 'setup'; state.scroll.setup = 0; break;
      case 'learn': state.scene = 'learn'; state.scroll.learn = 0; break;
      case 'auto': startAuto('title'); break;
      case 'howto': case 'rules': case 'about': state.scene = id; state.scroll[id] = 0; break;
      case 'settings': state.scene = 'settings'; state.scroll.settings = 0; break;
      case 'start': startGame(true); break;
      case 'sound': state.set.sound = !state.set.sound; audio.setMuted?.(!state.set.sound); savePrefs(); break;
      case 'confirm': state.set.confirm = !state.set.confirm; savePrefs(); break;
      case 'calm': state.set.calm = !state.set.calm; savePrefs(); break;
      case 'coords': state.set.coords = !state.set.coords; savePrefs(); break;
      default: {
        const [k, v] = id.split(':'), i = Number(v);
        if (k === 'mode') { state.mode = MODE_IDS[i]; savePrefs(); }
        else if (k === 'side') { state.two = i === 2; if (i < 2) state.human = i === 0 ? BLACK : WHITE; savePrefs(); }
        else if (k === 'level') { state.level = i; savePrefs(); }
        else if (k === 'opening') { state.opening = OPENINGS[i]; savePrefs(); }
        else if (k === 'wood') { state.set.wood = WOOD_IDS[i]; savePrefs(); }
        else if (k === 'stones') { state.set.stones = STONE_IDS[i]; savePrefs(); }
        else if (k === 'think') { state.set.thinkIdx = i; savePrefs(); }
        else if (k === 'lesson') startLesson(i);
      }
    }
    if (id !== 'home' && id !== 'pause') tick();
  }

  // ---- scrolling (drag, wheel, keys) ------------------------------------------------------------------------------------------------
  function scrolling(input) {
    const p = input.pointer, z = ui.scrolls[0];
    if (!z) { drag = null; return; }
    const cur = () => state.scroll[z.key] || 0, set = (v) => { state.scroll[z.key] = clamp(v, 0, z.max); };
    const w = input.wheel; if (w && w.dy) set(cur() + w.dy);
    const k = input.keys.pressed;
    if (k.has('ArrowDown')) set(cur() + 80); if (k.has('ArrowUp')) set(cur() - 80);
    if (k.has('PageDown')) set(cur() + z.r.h * 0.9); if (k.has('PageUp')) set(cur() - z.r.h * 0.9);
    if (p.pressed && inRect(z.r, p.x, p.y)) drag = { y0: p.y, s0: cur(), moved: false, id: hitAt(p.x, p.y)?.id };
    if (drag) {
      if (!p.down) { const d = drag; drag = null; if (!d.moved && d.id) press(d.id); }
      else { if (Math.abs(p.y - drag.y0) > 10) drag.moved = true; if (drag.moved) set(drag.s0 - (p.y - drag.y0)); }
    }
  }

  // ---- update -----------------------------------------------------------------------------------------------------------------------
  function update(dt, input) {
    state.t += dt;
    if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; drag = null; } else state.sceneT += dt;
    for (let i = state.sfx.length - 1; i >= 0; i--) { const s = state.sfx[i]; s.t -= dt; if (s.t <= 0) { tone(s.o); state.sfx.splice(i, 1); } }
    const p = input.pointer, sc = state.scene, keys = input.keys.pressed;
    const stale = ui.scene !== sc;                          // the registered buttons belong to another screen
    const frozen = state.autoMode && state.autoPaused;
    if (!frozen) {
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      if (state.anim) { state.anim.t += dt; if (state.anim.t >= state.anim.dur) state.anim = null; }
      if (state.hint) state.hint.t += dt;
      if (state.shake) { state.shake.t += dt; if (state.shake.t > 0.4) state.shake = null; }
      if (state.game.winner) state.winT += dt;
    }
    // a pointer that moves while not pressed is a mouse; a press with no such movement is a finger
    if (!p.down && state.px !== undefined && (p.x !== state.px || p.y !== state.py)) state.mouse = true;
    state.touch = !state.mouse; state.px = p.x; state.py = p.y;

    const scrolls = SCROLL_SCENES.includes(sc);
    if (scrolls) scrolling(input); else drag = null;
    let tapId = null;
    if (p.pressed && !stale && !(scrolls && ui.scrolls[0] && inRect(ui.scrolls[0].r, p.x, p.y))) { const h = hitAt(p.x, p.y); if (h) { tapId = h.id; press(h.id); } }
    if (keys.has('Escape')) { if (sc === 'play') press(state.autoMode ? 'exit' : 'menu'); else if (sc !== 'title') state.scene = 'title'; }
    if (sc === 'over' && !tapId && (keys.has('Enter') || keys.has('Space'))) press('again');
    if (sc !== 'play' && !state.warmed) state.warmed = warmTables(250);        // the computer's pattern tables are built in the background, between frames
    if (state.scene === 'play') updatePlay(dt, input, tapId);
    if (state.scene === 'play' && state.game.winner && !state.lesson && !state.anim && !frozen) { state.overT -= dt; if (state.overT <= 0) finish(); }
  }

  function updatePlay(dt, input, tapId) {
    const g = state.game, p = input.pointer, L = lay(), keys = input.keys.pressed, n = g.n;
    state.canPlay = humanTurn() && !state.autoMode;
    if (state.autoMode) { if (!state.autoPaused && !g.winner && (!state.anim || state.autoPhase)) autoTick(dt); return; }
    if (g.winner || state.swapAsk) return;
    if (hintThinker) { hintStep(); return; }
    if (!humanTurn()) { if (!state.anim || state.anim.t > 0.1) aiStep(dt); return; }
    if (state.centreNext) { aiStep(dt); return; }
    if (keys.has('KeyU')) press('undo');
    if (keys.has('KeyH')) press('hint');
    if (keys.has('ArrowLeft') || keys.has('ArrowRight') || keys.has('ArrowUp') || keys.has('ArrowDown')) {
      let c = state.kb >= 0 ? state.kb : centerOf(n);
      const dx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0), dy = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
      c = clamp((c % n) + dx, 0, n - 1) + clamp(((c / n) | 0) + dy, 0, n - 1) * n; state.kb = c; state.hover = c; state.mouse = true;
    }
    if ((keys.has('Space') || keys.has('Enter')) && state.kb >= 0) { tryHuman(state.kb); return; }
    const B = L.play.board, inBoard = p.x >= B.x - 10 && p.x <= B.x + B.w + 10 && p.y >= B.y - 10 && p.y <= B.y + B.h + 10;
    if (state.mouse && !p.down && !keys.size) { if (inBoard) state.hover = cellAt(L, n, p.x, p.y); else if (state.kb < 0) state.hover = -1; }
    if (p.pressed && !tapId && inBoard) { state.aim = cellAt(L, n, p.x, p.y); state.aimStart = state.aim; }
    else if (p.down && state.aimStart >= 0) state.aim = cellAt(L, n, p.x, p.y);
    if (p.released && state.aimStart >= 0) {
      const idx = cellAt(L, n, p.x, p.y);
      state.aim = -1; state.aimStart = -1;
      if (idx >= 0) {
        if (state.set.confirm) { if (state.pending === idx) { state.pending = -1; tryHuman(idx); } else { state.pending = idx; tick(); } }
        else tryHuman(idx);
      }
    }
  }

  // ---- render --------------------------------------------------------------------------------------------------------------------------
  function render(ctx) {
    const L = lay(), sc = state.scene;
    checkFonts(ctx);
    beginFrame(sc, L.key);
    if (sc === 'title') renderTitle(ctx, state, L);
    else if (sc === 'setup') renderSetup(ctx, state, L);
    else if (sc === 'settings') renderSettings(ctx, state, L);
    else if (sc === 'about') renderReader(ctx, state, L, ABOUT, 'About', 'about');
    else if (sc === 'howto') renderReader(ctx, state, L, HOWTO, 'How to Play', 'howto');
    else if (sc === 'rules') renderReader(ctx, state, L, RULES, 'Rules', 'rules');
    else if (sc === 'learn') renderLearn(ctx, state, L);
    else if (sc === 'demo-limit') renderDemoLimit(ctx, state, L);
    else if (sc === 'play') { state.canPlay = humanTurn() && !state.autoMode; renderPlay(ctx, state, L, state.dbgPtr ?? { x: state.px ?? 0, y: state.py ?? 0 }, playButtons()); }
    else if (sc === 'over') {
      renderPlay(ctx, state, L, { x: 0, y: 0 }, playButtons());
      if (!state.overHide) { ui.hits.length = 0; renderOver(ctx, state, L); }
    }
    if (state.sceneT < 0.25) { ctx.save(); ctx.fillStyle = `rgba(8,12,16,${0.55 * (1 - state.sceneT / 0.25)})`; ctx.fillRect(0, 0, L.w, L.h); ctx.restore(); }
  }

  return {
    update,
    render,
    getState: () => state,
    // test hooks (used by the screenshot / resize scripts through ?dev=1; they only call the same functions the buttons call)
    api: { press, startGame, startAuto, startLesson, play, tryHuman, refresh, finish, aimAt(idx) { const c = lay().cell(state.game.n), n = state.game.n; state.mouse = false; state.aim = idx; state.aimStart = idx; state.dbgPtr = { x: c.x0 + (idx % n) * c.cell, y: c.y0 + ((idx / n) | 0) * c.cell + c.cell * 0.9 }; } },
    // kit preview gate: only real, live human play counts against the free preview
    isPreviewExempt() { return !(state.scene === 'play' && !state.autoMode && !state.lesson && !state.game.winner); },
  };
}
