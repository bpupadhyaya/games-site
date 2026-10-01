// Tavli (Portes, Plakoto, Fevga): state and flow. Drawing is in view.js; the rule book is rules.js; the computer's brain is ai.js.
//
// Making a move: TAP a checker (its legal points glow), then TAP a point; or DRAG the checker and drop it. A move that is not allowed
// visibly tries, shudders and comes back, and a plain-language reason is shown (rules.whyNot).
// A MATCH rotates the three games (Portes, Plakoto, Fevga); each game is worth 1 point, 2 for a double win.
import { W, H, BTN, DICE, SETUP, PBACK, DOC_BACK, DOC_NEXT, SET_ROWS, SET_TEXT, PAUSE, TRAY, OVER, inRect, targetAt, barPos, titleRows, TEXT_SCALES, TEXT_BTN, THINK_STEPS } from './layout.js';
import { BAR, OFF, PORTES, VARIANTS, MATCH_ORDER, newGame, clone, expandRoll, beginTurn, legalSteps, playStep, turnCopy, whyNot, isOver, isDeadlocked, winner, resultValue, endTurn, top } from './rules.js';
import { LEVELS, createThinker, reasonFor } from './ai.js';
import { render, topSlot, landSlot } from './view.js';
import { SET_NAMES } from './sprites.js';
import { ABOUT, HOWTO, RULES } from './text.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, HINTS = 3, AUTO_REVEAL_SECS = 2, AUTO_LEVEL = 3;
const SETS = Object.keys(SET_NAMES);
const DOC_LIST = { howto: HOWTO, about: ABOUT, rules: RULES };

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, phase: 'idle', g: newGame(PORTES), two: false, level: 2,
    setup: { mode: 3, target: 5, two: false, level: 2 }, match: null,
    sound: true, calm: false, set: 'marble', auto: true, textScaleIdx: 0,
    // Watch & Learn (Auto Play): both sides computer-played. THINK -> REVEAL -> ACT per roll. autoThinkIdx indexes THINK_STEPS.
    autoMode: false, autoThinkIdx: 1, autoPhase: null, autoCand: null, autoReveal: null, autoTimer: 0,
    paused: false, pt: 0,
    dice: { vals: null, side: 0, roll: null }, left: null, sel: -1, dests: [], sources: [], legal: [], anim: null, drag: null, hint: null, msg: null,
    status: '', canUndo: false, hintsLeft: HINTS, thinking: false, cursor: null, cursorOn: false, kbi: 0,
    result: null, stats: { games: 0, wins: 0 }, saved: null, demoGames: 0, page: 0, q: [], think: 0, endT: 0, autoT: 0, fx: [], fxSeed: 1, overT: 0, pauseT: 0,
    matchLabel: '', dev: config.dev === true, shot: false,
  };
  let turn = null, undo = [], thinker = null, hintThinker = null, forced = null, sfx = [], press = null, noAuto = false;

  // ---- saving ---------------------------------------------------------------------------------------------------------------
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, set: state.set, auto: state.auto, textScaleIdx: state.textScaleIdx, autoThinkIdx: state.autoThinkIdx, setup: state.setup });
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.games, wins: state.stats.wins }); };
  const labelOf = (M) => (M ? (M.mode === 3 ? `Match to ${M.target}: ${M.score[0]} – ${M.score[1]}` : `${VARIANTS[M.mode].name}, single game`) : '');
  const saveGame = () => {
    if (state.scene === 'play' && !state.autoMode && state.match && !isOver(state.g)) {
      state.saved = { g: clone(state.g), match: { ...state.match, score: state.match.score.slice() }, two: state.two, level: state.level, hintsLeft: state.hintsLeft };
      state.matchLabel = labelOf(state.match); storage.set('save', state.saved);
    }
  };
  const clearSave = () => { state.saved = null; state.matchLabel = ''; storage.remove('save'); };
  storage.get('prefs', null).then((v) => {
    if (!v) return;
    state.level = v.level ?? 2; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.set = SETS.includes(v.set) ? v.set : 'marble'; state.auto = v.auto ?? true;
    state.textScaleIdx = Math.min(Math.max(v.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1); state.autoThinkIdx = Math.min(Math.max(v.autoThinkIdx ?? 1, 0), THINK_STEPS.length - 1);
    if (v.setup) state.setup = { mode: Math.min(Math.max(v.setup.mode ?? 3, 0), 3), target: v.setup.target === 7 ? 7 : 5, two: !!v.setup.two, level: Math.min(Math.max(v.setup.level ?? 2, 0), LEVELS.length - 1) };
    audio.setMuted?.(!state.sound);
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { games: v.games ?? 0, wins: v.wins ?? 0 }; });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.g && v.match && !isOver(v.g) && state.scene === 'title') { state.saved = v; state.matchLabel = labelOf(v.match); } });

  // ---- small helpers -----------------------------------------------------------------------------------------------------------
  const dur = (d) => (state.calm ? d * 0.55 : d);
  const say = (text, hold = 5) => { state.msg = { text, t: 0, hold }; };
  const later = (at, o) => sfx.push({ at: state.t + at, o });
  // Watch & Learn is silent by design (nobody is playing); every effect funnels through tone().
  const tone = (o) => { if (state.sound && !state.autoMode) audio.tone(o); };
  const clack = (f = 1, v = 0.16) => { tone({ freq: 420 * f, to: 130 * f, dur: 0.07, type: 'sine', vol: v }); tone({ freq: 2100 * f, to: 700, dur: 0.025, type: 'square', vol: 0.035 }); };
  const rattle = () => { const n = state.calm ? 3 : 9; for (let i = 0; i < n; i++) later(i * (state.calm ? 0.09 : 0.085), { freq: 600 + ((i * 397) % 5) * 130, to: 260, dur: 0.045, type: 'square', vol: 0.045 }); later(dur(0.9), { freq: 300, to: 110, dur: 0.09, type: 'sine', vol: 0.18 }); later(dur(0.9) + 0.06, { freq: 260, to: 100, dur: 0.07, type: 'sine', vol: 0.14 }); };
  const fx = (kind, x, y, col) => { state.fx.push({ kind, x, y, t: 0, dur: kind === 'ring' ? 0.6 : 0.8, col, seed: (state.fxSeed += 13) }); if (state.fx.length > 24) state.fx.shift(); };
  const humanSide = (s) => !state.autoMode && (state.scene !== 'play' || state.two || s === 0);
  const opp = (s) => 1 - s;
  const sideName = (s) => (state.two || state.autoMode ? (s === 0 ? 'Light' : 'Dark') : s === 0 ? 'You' : 'The rival');
  const variantOf = (M) => (M.mode === 3 ? MATCH_ORDER[M.n % 3] : M.mode);

  // ---- starting things ---------------------------------------------------------------------------------------------------------
  function resetPlay() {
    thinker = hintThinker = null; undo = []; forced = null; noAuto = false;
    Object.assign(state, { q: [], anim: null, drag: null, hint: null, sel: -1, dests: [], sources: [], legal: [], dice: { vals: null, side: 0, roll: null }, left: null, canUndo: false, result: null, msg: null, status: '', thinking: false, cursorOn: false, endT: 0, autoT: 0, think: 0, autoMode: false, autoPhase: null, autoCand: null, autoReveal: null, autoTimer: 0, paused: false, fx: [], overT: 0 });
    turn = null;
  }
  // a new match (or single game) from the setup choices; `auto` = Watch & Learn
  function startMatch(auto = false) {
    if (config.demo && !auto && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    const su = state.setup;
    resetPlay();
    state.two = auto ? false : su.two; if (auto) state.level = AUTO_LEVEL; else state.level = su.level;
    state.match = { mode: su.mode, target: auto ? 3 : su.target, score: [0, 0], n: 0 };
    state.autoMode = auto;
    beginGame(false);
  }
  // start the game that is next in the match: a fresh board, the opening roll
  function beginGame(replay) {
    const M = state.match, v = variantOf(M), keep = { two: state.two, level: state.level, auto: state.autoMode };
    if (config.demo && !keep.auto && !replay) {
      if (state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
      state.demoGames += 1; storage.set('demoGames', state.demoGames);
    }
    resetPlay(); state.two = keep.two; state.level = keep.level; state.autoMode = keep.auto;
    Object.assign(state, { scene: 'play', g: newGame(v), hintsLeft: HINTS });
    let a, b; do { a = rng.int(6) + 1; b = rng.int(6) + 1; } while (a === b);
    state.g.turn = a > b ? 0 : 1; forced = a > b ? [a, b] : [b, a];
    const hi = Math.max(a, b), lo = Math.min(a, b), solo = !state.two && !state.autoMode;
    say(`${VARIANTS[v].name}. Opening roll: ${sideName(0)} ${a}, ${sideName(1).toLowerCase()} ${b}. ${sideName(state.g.turn)} ${state.g.turn === 0 && solo ? 'play' : 'plays'} ${hi}-${lo} first.`, 6);
    monetization.track('game_start', { variant: v, level: state.level, two: state.two });
    beginSide(true);
  }
  function resume() {
    const v = state.saved; resetPlay();
    Object.assign(state, { scene: 'play', two: v.two, level: v.level ?? state.level, g: clone(v.g), match: { ...v.match, score: v.match.score.slice() }, hintsLeft: v.hintsLeft ?? HINTS });
    say('Game restored.'); beginSide(false);
  }
  function toTitle() { if (state.scene === 'play') saveGame(); resetPlay(); state.scene = 'title'; }

  // ---- the turn machine ----------------------------------------------------------------------------------------------------------
  function beginSide(opening) {
    const s = state.g.turn; state.sel = -1; state.dests = []; state.sources = []; state.hint = null; undo = []; state.canUndo = false; state.q = []; noAuto = false;
    state.dice = { vals: null, side: s, roll: null }; state.left = null; state.status = '';
    if (isDeadlocked(state.g)) { voidGame(); return; }
    if (state.scene === 'play' && humanSide(s) && !opening) saveGame();
    if (humanSide(s)) {
      state.phase = 'roll';
      state.status = state.two ? `${sideName(s)}: TAP the dice to roll.` : 'Your turn: TAP the dice to roll.';
      if (opening) roll();
    } else {
      state.phase = 'cpu'; state.think = opening ? 0.9 : 0.6; state.status = state.autoMode ? `${sideName(s)} is thinking…` : 'The rival is thinking…';
    }
  }
  function roll() {
    const s = state.g.turn;
    const vals = forced ? forced.slice() : [rng.int(6) + 1, rng.int(6) + 1];
    forced = null;
    state.dice = { vals, side: s, roll: { t: 0, dur: dur(0.95) } }; state.phase = 'rolling'; state.status = ''; state.hint = null;
    rattle();
  }
  function afterRoll() {
    const s = state.g.turn, vals = state.dice.vals;
    turn = beginTurn(state.g, s, expandRoll(vals)); state.left = turn.dice.slice();
    if (humanSide(s)) { state.phase = 'move'; state.status = ''; refreshMoves(); }
    else if (turn.total === 0) { state.phase = 'cpuPass'; state.endT = 1.1; say(state.autoMode ? `${sideName(s)} has no legal move.` : 'The rival has no legal move.', 2); }
    else { state.phase = 'cpuThink'; state.thinking = true; thinker = createThinker(state.g, s, turn.dice, state.level, rng); }
  }
  function refreshMoves() {
    const s = state.g.turn, legal = legalSteps(state.g, s, turn);
    state.legal = legal;
    state.sources = [...new Set(legal.map((x) => x.from))];
    if (state.sel !== -1 && !state.sources.includes(state.sel)) state.sel = -1;
    if (state.sel === -1 && state.sources.length === 1 && state.g.bar[s] > 0) state.sel = BAR;
    state.dests = state.sel === -1 ? [] : legal.filter((x) => x.from === state.sel).map((x) => ({ from: x.from, to: x.to, die: x.die }));
    state.left = turn.dice.slice(); state.canUndo = undo.length > 0;
    if (!legal.length) {
      state.phase = 'end'; state.endT = 0.75; state.sel = -1;
      if (turn.used === 0) say(`${sideName(s)} ${humanSide(s) && !state.two ? 'have' : 'has'} no legal move with this roll. The turn passes.`, 2.5);
    } else state.phase = 'move';
  }

  // play one step with an animation
  function step(s, st, from) {
    const g = state.g, n0 = st.from === BAR ? g.bar[s] : 1;
    const fromPos = from ?? (st.from === BAR ? barPos(s, n0 - 1, n0) : topSlot(g, s, st.from));
    const toPos = landSlot(g, s, st.to);
    const a = { side: s, kind: 'move', from: fromPos, to: toPos, t: 0, dur: dur(st.to === OFF ? 0.36 : 0.3), hide: { kind: st.to === OFF ? 'off' : 'pt', idx: st.to, side: s }, hit: null, pin: !!st.pin, ghost: null, hitDur: 0 };
    if (st.hit) {
      const vb = g.bar[opp(s)];
      a.hit = { side: opp(s), from: landSlot(g, s, st.to), to: barPos(opp(s), vb, vb + 1) }; a.hitDur = dur(0.4); a.ghost = { side: opp(s), pos: landSlot(g, s, st.to) };
    }
    playStep(g, s, turn, st);
    state.anim = a; state.sel = -1; state.dests = []; state.hint = null; state.left = turn.dice.slice();
    if (st.to === OFF) { clack(1.5); later(dur(0.3), { freq: 880, to: 1320, dur: 0.1, type: 'triangle', vol: 0.05 }); } else clack(st.hit ? 0.8 : 1);
    if (st.hit) { later(dur(0.3), { freq: 160, to: 70, dur: 0.16, type: 'triangle', vol: 0.16 }); later(dur(0.28), { fx: ['burst', toPos.x, toPos.y, '255,150,100'] }); }
    if (st.pin) { later(dur(0.3), { freq: 300, to: 180, dur: 0.08, type: 'square', vol: 0.08 }); later(dur(0.34), { freq: 1500, to: 1500, dur: 0.05, type: 'sine', vol: 0.06 }); later(dur(0.28), { fx: ['ring', toPos.x, toPos.y, '255,214,110'] }); }
    if (st.to === OFF) later(dur(0.3), { fx: ['burst', toPos.x, toPos.y, '255,236,170'] });
  }
  function humanStep(st, from) { undo.push({ g: clone(state.g), turn: turnCopy(turn) }); noAuto = false; step(state.g.turn, st, from); }

  function onAnimDone() {
    state.anim = null;
    if (isOver(state.g)) { finish(); return; }
    if (state.q.length) return;
    if (state.phase === 'move') refreshMoves();
    else if (state.phase === 'cpuMove') finishTurn();
  }
  function finishTurn() {
    endTurn(state.g, state.g.turn);
    state.g.turn = opp(state.g.turn); beginSide(false);
  }

  // computer chooses and plays
  function cpuThinkTick() {
    if (!thinker) return;
    const r = thinker.step();
    if (!r.done) return;
    thinker = null; state.thinking = false;
    if (!r.cand) { state.phase = 'cpuPass'; state.endT = 0.8; return; }
    if (state.autoMode) {
      state.autoCand = r.cand; state.autoPhase = 'think'; state.phase = 'autoThink'; state.autoTimer = THINK_STEPS[state.autoThinkIdx];
      say(`${sideName(state.g.turn)} is thinking…`, state.autoTimer + AUTO_REVEAL_SECS + 1);
      return;
    }
    state.q = r.cand.steps.slice(); state.phase = 'cpuMove';
    const v = state.dice.vals, hits = r.cand.steps.filter((x) => x.hit).length, pins = r.cand.steps.filter((x) => x.pin).length;
    say(`The rival rolled ${v[0]}-${v[1]}${hits ? ' and hit ' + (hits > 1 ? 'two of your checkers.' : 'your checker!') : pins ? ' and pinned ' + (pins > 1 ? 'two of your checkers.' : 'your checker!') : '.'}`, 4);
  }

  // ---- game end --------------------------------------------------------------------------------------------------------------------
  function voidGame() {
    const M = state.match;
    state.scene = 'over'; state.phase = 'over'; state.thinking = false; state.q = []; state.anim = null; state.dests = []; state.sources = [];
    state.result = { title: 'A blocked game', body: 'Both sides have a checker pinned and nothing can move, so this game is void. Nobody scores.', matchLine: labelOf(M), next: null, matchOver: false, w: -1, replay: true };
    if (!state.autoMode) clearSave();
    state.overT = 6;
  }
  function finish() { const w = winner(state.g); finishResult(w, resultValue(state.g, w)); }
  function finishResult(w, points) {
    const vsCpu = !state.two && !state.autoMode, M = state.match, v = state.g.v;
    state.scene = 'over'; state.phase = 'over'; state.thinking = false; state.q = []; state.anim = null; state.dests = []; state.sources = [];
    M.score[w] += points;
    const name = vsCpu ? (w === 0 ? 'You win' : 'The rival wins') : `${w === 0 ? 'Light' : 'Dark'} wins`;
    const matchOver = M.mode === 3 ? M.score[0] >= M.target || M.score[1] >= M.target : true;
    const next = matchOver ? null : VARIANTS[MATCH_ORDER[(M.n + 1) % 3]].name;
    const body = `${points === 2 ? 'A double win: the loser had borne off no checker. ' : ''}${points} point${points === 1 ? '' : 's'} in ${VARIANTS[v].name}.`;
    let matchLine = '';
    if (M.mode === 3) {
      const A = vsCpu ? 'You' : 'Light', B = vsCpu ? 'Rival' : 'Dark';
      matchLine = matchOver ? `${vsCpu ? (w === 0 ? 'You win the match' : 'The rival wins the match') : `${w === 0 ? 'Light' : 'Dark'} wins the match`} ${M.score[0]} – ${M.score[1]}` : `${A} ${M.score[0]} – ${M.score[1]} ${B}, first to ${M.target}`;
    }
    state.result = { title: name + '!', body, matchLine, w, points, next, matchOver };
    if (vsCpu) { state.stats.games += 1; if (w === 0) state.stats.wins += 1; saveStats(); }
    if (!state.autoMode) { clearSave(); monetization.track('game_end', { winner: w, points, variant: v, level: state.level }); }
    const win = w === 0 || !vsCpu;
    tone({ freq: win ? 523 : 330, to: win ? 784 : 262, dur: 0.45, type: 'triangle', vol: 0.1 });
    if (win) { later(0.2, { freq: 784, to: 1046, dur: 0.4, type: 'triangle', vol: 0.08 }); for (let i = 0; i < 4; i++) later(i * 0.18, { fx: ['burst', 130 + i * 150, 560 + (i % 2) * 60, i % 2 ? '255,214,110' : '120,190,255'] }); }
    state.overT = state.autoMode ? 6 : 0;
  }
  function overAgain() {
    const R_ = state.result;
    if (R_.replay) { beginGame(true); return; }                                  // a void game is simply played again
    if (R_.next) { state.match.n += 1; beginGame(false); }
    else startMatch(state.autoMode);
  }

  // ---- interaction on the board --------------------------------------------------------------------------------------------------
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
    const s = state.g.turn, fp = topSlot(state.g, s, from);
    const tp = target === OFF ? { x: 360, y: TRAY.me.y + 20 } : landSlot(state.g, s, target);
    state.anim = { side: s, kind: 'refuse', from: fp, to: tp, t: 0, dur: dur(0.62), hide: from === BAR ? { kind: 'bar' } : { kind: 'pt', idx: from, side: s }, hit: null, ghost: null, hitDur: 0 };
    say(why, 6); tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.08 });
  }
  function tapDest(t, from) {
    const s = state.g.turn, legal = state.legal || [];
    const cands = legal.filter((x) => x.from === state.sel && x.to === t);
    if (cands.length) { cands.sort((a, b) => a.die - b.die); humanStep(cands[0], from); return true; }
    const path = findPath(state.sel, t);
    if (path && path.length > 1) { const first = path[0]; state.q = path.slice(1); humanStep(first, from); return true; }
    refuse(state.sel, t, whyNot(state.g, s, turn, state.sel, t)); return false;
  }
  function refreshDests() { state.dests = (state.legal || []).filter((x) => x.from === state.sel).map((x) => ({ from: x.from, to: x.to, die: x.die })); }
  function tapTarget(t, from) {
    const s = state.g.turn, g = state.g;
    if (t < 0) { state.sel = -1; state.dests = []; return; }
    if (state.sel !== -1) {
      if (t === state.sel) { state.sel = -1; state.dests = []; return; }
      if (state.sources.includes(t) && t !== OFF && !state.dests.some((d) => d.to === t)) { state.sel = t; refreshDests(); clack(1.4, 0.06); return; }
      tapDest(t, from); return;
    }
    if (state.sources.includes(t)) { state.sel = t; refreshDests(); clack(1.4, 0.06); return; }
    if (t === OFF) { say('Tap one of your checkers first, then tap the tray to bear it off.'); return; }
    if (t !== BAR && g.pin[t] === s + 1) { say('That checker of yours is pinned under an opposing checker. It cannot move until that checker leaves.', 5); return; }
    if (t !== BAR && top(g, s, t) > 0) {
      const why = g.bar[s] > 0 && g.v === PORTES ? 'A checker of yours is on the bar. It must enter the board before anything else moves.' : `That checker cannot move with your dice (${turn.dice.join(' and ')}): the points ahead are closed or off the board.`;
      refuse(t, t, why); return;
    }
    if (t === BAR && g.bar[s] === 0) return;
    say('TAP one of your glowing checkers first, then TAP the point where it should go.');
  }
  function doUndo() {
    if (!undo.length) { say('Nothing to take back yet.', 2); return; }
    const e = undo.pop(); state.g = e.g; turn = e.turn; state.anim = null; state.q = []; state.sel = -1; state.drag = null; state.hint = null; noAuto = true;
    state.phase = 'move'; refreshMoves(); say('Move taken back.', 2); clack(0.9, 0.08);
  }
  function doHint() {
    if (state.phase !== 'move') { say(state.phase === 'roll' ? 'Roll the dice first: TAP the dice.' : 'Wait for the current move to finish.', 2.5); return; }
    if (state.hintsLeft <= 0) { say('No hints left in this game.', 2.5); return; }
    state.hintsLeft -= 1; state.thinking = true; hintThinker = createThinker(state.g, state.g.turn, turn.dice, 3, rng); state.sel = -1; state.dests = [];
  }
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
  function keyboard(k) {
    if (k.has('KeyU')) { doUndo(); return; }
    if (k.has('KeyH')) { doHint(); return; }
    if (state.phase === 'roll') { if (k.has('Space') || k.has('Enter')) roll(); return; }
    if (state.phase !== 'move' || state.anim) return;
    const list = state.sel === -1 ? state.sources : state.dests.map((d) => d.to);
    if (k.has('Backspace')) { state.sel = -1; state.dests = []; state.cursorOn = false; return; }
    if (!list.length) return;
    const move = (k.has('ArrowRight') || k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowLeft') || k.has('ArrowUp') ? 1 : 0);
    if (move) { state.kbi = (state.kbi + move + list.length * 4) % list.length; state.cursorOn = true; state.cursor = list[state.kbi % list.length]; return; }
    if (k.has('Enter') || k.has('Space')) {
      state.cursorOn = true; state.kbi = Math.min(state.kbi, list.length - 1); const t = list[state.kbi];
      tapTarget(t, null); state.kbi = 0; state.cursor = (state.sel === -1 ? state.sources : state.dests.map((d) => d.to))[0] ?? null;
    }
  }

  // ---- per-scene updates -----------------------------------------------------------------------------------------------------------
  function updateTitle(tap) {
    if (!tap) return;
    const Rr = titleRows(!!state.saved), hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(Rr.resume)) resume();
    else if (hit(Rr.play)) state.scene = 'setup';
    else if (hit(Rr.auto)) startMatch(true);
    else if (hit(Rr.settings)) state.scene = 'settings';
    else if (hit(Rr.howto)) { state.scene = 'howto'; state.page = 0; }
    else if (hit(Rr.about)) { state.scene = 'about'; state.page = 0; }
    else if (hit(Rr.rules)) { state.scene = 'rules'; state.page = 0; }
  }
  function updateSetup(tap) {
    if (!tap) return;
    const su = state.setup, hit = (r) => inRect(r, tap.x, tap.y);
    SETUP.modes.forEach((r, i) => { if (hit(r)) { su.mode = i; clack(); } });
    SETUP.match.forEach((r, i) => { if (hit(r) && su.mode === 3) { su.target = i ? 7 : 5; clack(); } });
    SETUP.opp.forEach((r, i) => { if (hit(r)) { su.two = i === 1; clack(); } });
    SETUP.levels.forEach((r, i) => { if (hit(r) && !su.two) { su.level = i; clack(); } });
    if (hit(SETUP.start)) { savePrefs(); startMatch(false); return; }
    if (hit(SETUP.back)) state.scene = 'title';
    savePrefs();
  }
  function updateDoc(tap) {
    if (!tap) return;
    if (inRect(TEXT_BTN.dec, tap.x, tap.y)) { if (state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); clack(); } return; }
    if (inRect(TEXT_BTN.inc, tap.x, tap.y)) { if (state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); clack(); } return; }
    const list = DOC_LIST[state.scene];
    if (inRect(DOC_BACK, tap.x, tap.y)) { if (state.page > 0) state.page -= 1; else state.scene = 'title'; return; }
    if (inRect(DOC_NEXT, tap.x, tap.y)) { if (state.page >= list.length - 1) { state.scene = 'title'; state.page = 0; } else state.page += 1; }
  }
  function updateSettings(tap) {
    if (!tap) return;
    const hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(SET_ROWS.sound)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); clack(); }
    else if (hit(SET_ROWS.calm)) state.calm = !state.calm;
    else if (hit(SET_ROWS.set)) state.set = SETS[(SETS.indexOf(state.set) + 1) % SETS.length];
    else if (hit(SET_ROWS.auto)) state.auto = !state.auto;
    else if (hit(SET_TEXT.dec)) { if (state.textScaleIdx > 0) state.textScaleIdx--; }
    else if (hit(SET_TEXT.inc)) { if (state.textScaleIdx < TEXT_SCALES.length - 1) state.textScaleIdx++; }
    else if (hit(PBACK)) state.scene = 'title';
    savePrefs();
  }

  function updateBoard(dt, input, tap) {
    const p = input.pointer, ph = state.phase;
    if (state.dice.roll) state.dice.roll.t += dt;
    if (state.anim) {
      state.anim.t += dt;
      if (state.anim.t >= state.anim.dur + (state.anim.hit ? state.anim.hitDur : 0)) onAnimDone();
    }
    if (state.scene === 'over') {
      if (tap) {
        if (inRect(OVER.again, tap.x, tap.y)) overAgain();
        else if (inRect(OVER.menu, tap.x, tap.y)) { resetPlay(); state.scene = 'title'; state.phase = 'idle'; }
        else if (inRect(OVER.share, tap.x, tap.y)) env.share(`Tavli: ${state.result.title} ${state.result.body} ${state.result.matchLine}`);
      } else if (state.autoMode && state.overT > 0) { state.overT -= dt; if (state.overT <= 0 && !state.result.matchOver) overAgain(); }
      return;
    }
    if (tap) {
      if (inRect(BTN.pause, tap.x, tap.y)) { setPaused(true); return; }
      if (state.autoMode) {
        if (inRect(BTN.aMenu, tap.x, tap.y)) { toTitle(); return; }
        if (inRect(BTN.aPause, tap.x, tap.y)) { setPaused(true); return; }
        if (inRect(BTN.aLess, tap.x, tap.y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx--; savePrefs(); } return; }
        if (inRect(BTN.aMore, tap.x, tap.y)) { if (state.autoThinkIdx < THINK_STEPS.length - 1) { state.autoThinkIdx++; savePrefs(); } return; }
        return;
      }
      if (inRect(BTN.menu, tap.x, tap.y)) { toTitle(); return; }
      if (inRect(BTN.undo, tap.x, tap.y) && (ph === 'move' || ph === 'end') && !state.anim) { doUndo(); return; }
      if (inRect(BTN.hint, tap.x, tap.y)) { doHint(); return; }
    }
    if (input.keys.pressed.size) {
      const k = input.keys.pressed;
      if (k.has('KeyP') || k.has('Escape')) { setPaused(true); return; }
      if (!state.autoMode) { keyboard(k); if (state.phase !== ph) return; }
    }

    switch (state.phase) {
      case 'roll': {
        if (tap && inRect({ x: DICE.x, y: DICE.y - 6, w: DICE.w, h: DICE.h + 12 }, tap.x, tap.y)) roll();
        break;
      }
      case 'rolling': {
        if (state.dice.roll.t >= state.dice.roll.dur) { state.dice.roll = null; afterRoll(); }
        break;
      }
      case 'move': {
        if (state.q.length && !state.anim) { const st = state.q.shift(); undo.push({ g: clone(state.g), turn: turnCopy(turn) }); step(state.g.turn, st); break; }
        if (state.anim) break;
        boardInput(p);
        const uniq = new Set((state.legal || []).map((x) => x.from + '>' + x.to));
        if (state.auto && !noAuto && uniq.size === 1 && !state.drag) {
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
        state.endT -= dt;
        if (state.endT <= 0) finishTurn();
        break;
      }
      case 'cpu': { state.think -= dt; if (state.think > 0) break; roll(); break; }
      case 'cpuThink': cpuThinkTick(); break;
      case 'autoThink': {
        state.autoTimer -= dt;
        if (state.autoTimer > 0) break;
        const cand = state.autoCand, s = state.g.turn;
        state.autoReveal = { side: s, steps: cand.steps.map((st) => ({ from: st.from, to: st.to })) };
        state.autoPhase = 'reveal'; state.autoTimer = AUTO_REVEAL_SECS; state.phase = 'autoReveal';
        say(reasonFor(state.g, cand, s), AUTO_REVEAL_SECS + 0.5);
        break;
      }
      case 'autoReveal': {
        state.autoTimer -= dt;
        if (state.autoTimer > 0) break;
        const cand = state.autoCand; state.autoCand = null; state.autoReveal = null; state.autoPhase = null;
        state.q = cand.steps.slice(); state.phase = 'cpuMove';
        break;
      }
      case 'cpuMove': {
        if (state.anim) break;
        if (state.q.length) { state.pauseT -= dt; if (state.pauseT > 0) break; state.pauseT = dur(0.16); step(state.g.turn, state.q.shift(), null); break; }
        finishTurn(); break;
      }
      case 'cpuPass': { state.endT -= dt; if (state.endT <= 0) finishTurn(); break; }
      default: break;
    }
  }

  function setPaused(on) { if (state.scene !== 'play' || state.shot) return; state.paused = on; state.pt = 0; press = null; state.drag = null; }
  function updatePause(dt, input) {
    // Everything else is frozen: no timers, no search, no animation, no sound queue. Only the overlay's own clock runs.
    state.pt += dt;
    const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, hit = (r) => tap && inRect(r, tap.x, tap.y);
    if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape') || input.keys.pressed.has('Space') || hit(PAUSE.resume)) { state.paused = false; return; }
    if (hit(PAUSE.restart)) { const auto = state.autoMode; state.paused = false; if (auto) startMatch(true); else { clearSave(); resetPlay(); state.scene = 'title'; } return; }
    if (hit(PAUSE.menu)) { state.paused = false; toTitle(); }
  }

  // ---- showcase scenes for screenshots (only for the reserved seeds 7770001..7770040) ---------------------------------------------
  function showcase(n) {
    state.shot = true; state.sound = false; audio.setMuted?.(true); state.stats = { games: 12, wins: 7 };
    const playTo = (v, plies, level = 1) => {
      const g = newGame(v); let side = 0;
      for (let i = 0; i < plies; i++) { const r = expandRoll([rng.int(6) + 1, rng.int(6) + 1]); const th = createThinker(g, side, r, level, rng); let res; do { res = th.step(); } while (!res.done); if (res.cand) Object.assign(g, res.cand.after); g.turn = side; side = opp(side); if (isOver(g)) break; }
      g.turn = 0; return g;
    };
    const board = (v, plies, dice, o = {}) => {
      state.setup.mode = o.mode ?? v; state.match = { mode: o.mode ?? v, target: 5, score: o.score || [0, 0], n: o.n || 0 };
      resetPlay(); state.shot = true; Object.assign(state, { scene: 'play', g: playTo(v, plies), hintsLeft: 2 });
      state.g.turn = 0; turn = beginTurn(state.g, 0, expandRoll(dice)); state.dice = { vals: dice, side: 0, roll: null }; state.left = turn.dice.slice(); refreshMoves(); state.phase = 'move';
      if (state.sources.length) { state.sel = state.sources[Math.min(o.pick ?? 1, state.sources.length - 1)]; refreshDests(); }
      say(o.msg || 'Tap a checker, then a glowing point.', 100);
    };
    if (n === 1) return;
    if (n === 2) { state.scene = 'setup'; return; }
    if (n === 3) { board(0, 22, [5, 3], { mode: 3, score: [1, 0] }); return; }
    if (n === 4) { board(1, 34, [6, 2], { mode: 3, score: [2, 1], n: 1, msg: 'Land on a lone checker to pin it under yours.', pick: 0 }); return; }
    if (n === 5) { board(2, 30, [4, 3], { mode: 3, score: [2, 2], n: 2, msg: 'Fevga: nothing is hit. Block the way and keep moving.', pick: 0 }); return; }
    if (n === 6) {
      board(0, 0, [6, 3], { mode: 3 });
      const g = newGame(0); g.board.fill(0); [[6, 3], [5, 3], [4, 2], [3, 2], [2, 1]].forEach(([pt, c]) => { g.board[pt - 1] = c; }); g.off = [4, 3]; g.board[18] = -4; g.board[20] = -4; g.board[22] = -4; g.off[1] = 3;
      state.g = g; turn = beginTurn(g, 0, [6, 3]); state.dice = { vals: [6, 3], side: 0, roll: null }; refreshMoves(); state.sel = 5; refreshDests(); say('All 15 checkers are home: bear off with a die that matches.', 100); return;
    }
    if (n === 7 || n === 16) {
      board(1, 0, [3, 2], { mode: 3 });
      state.g.off = [15, n === 16 ? 6 : 0]; state.g.board.fill(0); state.g.pin.fill(0); state.scene = 'over'; state.phase = 'over'; state.dests = []; state.sources = [];
      state.match.score = n === 16 ? [5, 3] : [3, 1]; state.match.n = 3;
      state.result = n === 16 ? { title: 'You win!', body: '1 point in Fevga.', matchLine: 'You win the match 5 – 3', next: null, matchOver: true, w: 0, points: 1 } : { title: 'You win!', body: 'A double win: the loser had borne off no checker. 2 points in Plakoto.', matchLine: 'You 3 – 1 Rival, first to 5', next: 'Fevga', matchOver: false, w: 0, points: 2 };
      fx('burst', 200, 600, '255,214,110'); fx('burst', 520, 640, '120,190,255'); state.fx.forEach((f) => { f.t = 0.2; });
      return;
    }
    if (n === 8) { state.scene = 'rules'; state.page = 0; return; }
    if (n === 9) { state.scene = 'rules'; state.page = 36; return; }
    if (n === 10) { startMatch(true); state.shot = true; return; }
    if (n === 11) { state.scene = 'settings'; return; }
    if (n === 12) { state.scene = 'about'; state.page = 3; state.textScaleIdx = 4; return; }
    if (n === 13) { state.scene = 'rules'; state.page = 50; state.textScaleIdx = 4; return; }
    if (n === 14) { state.textScaleIdx = 4; return; }
    if (n === 15) { state.scene = 'setup'; state.textScaleIdx = 4; return; }
    if (n === 17) { board(0, 22, [5, 3], { mode: 3 }); state.paused = true; return; }
    if (n === 18) { state.scene = 'howto'; state.page = 1; return; }
    if (n === 19) { state.scene = 'settings'; state.textScaleIdx = 4; return; }
    if (n === 21) { showcase(7); state.textScaleIdx = 4; return; }
    if (n === 20) { board(1, 34, [6, 2], { mode: 3, pick: 0 }); state.textScaleIdx = 4; }
  }
  if (config.seed >= 7770001 && config.seed <= 7770040) showcase(config.seed - 7770000);

  return {
    update(dt, input) {
      state.ptr = input.pointer.down ? { x: input.pointer.x, y: input.pointer.y } : null;
      if (state.paused) { updatePause(dt, input); return; }
      state.t += dt;
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      while (sfx.length && sfx[0].at <= state.t) { const e = sfx.shift(); if (e.o && e.o.fx) fx(...e.o.fx); else if (e.o) tone(e.o); }
      for (const f of state.fx) f.t += dt;
      state.fx = state.fx.filter((f) => f.t < f.dur);
      if (state.shot) return;
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (input.keys.pressed.size && sc === 'title' && (input.keys.pressed.has('Enter') || input.keys.pressed.has('Space'))) { state.scene = 'setup'; return; }
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'setup') updateSetup(tap);
      else if (sc === 'howto' || sc === 'about' || sc === 'rules') updateDoc(tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (sc === 'demo-limit') { if (tap && tap.y > 800 && tap.y < 900) state.scene = 'title'; }
      else updateBoard(dt, input, tap);
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
    // Only real play on the board counts against the free preview. Menus, setup, Rules, How to play, About, Settings, the result
    // screens, Watch & Learn and the paused screen are all free.
    isPreviewExempt() { return state.scene !== 'play' || state.autoMode === true || state.paused === true; },
  };
}
