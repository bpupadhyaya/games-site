// Sáhkku: state and flow. Drawing is in view.js, the rule book in rules.js, the computer's brain in ai.js, text in content.js.
//
// How a turn is played: tap the dice tray to roll four dice. Tap one of your herders (or the king): glowing cells show where each die would
// take it; cells that capture are ringed in red. Tap a cell to use that die. Every die is used on its own. The computer plays the same way.
import { layoutFor, TEXT_SCALES, THINK_STEPS, inRect } from './layout.js';
import { newGame, clone, rollDice, applyMove, legalMoves, describeMove, protectedMan, CAMP, N, NAMES, menLeft } from './rules.js';
import { LEVELS, bestTurn, threat } from './ai.js';
import { isOpen } from './settings.js';
import { WOOD_KEYS, STYLE_KEYS } from './art.js';
import { render, ui, docMetrics } from './view.js';
import { v3 } from './v3.js';

// Fluid viewport (kit 1.7.0): the short side is always 720 units and the long side follows the screen, in portrait and landscape.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_GAMES = 2, HINTS_PER_GAME = 3, AUTO_REVEAL_SECS = 2, ROLL_SECS = 0.75;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, sceneT: 1, game: newGame(), humanSide: 0, two: false, level: 2, flip: false,
    marks: true, sound: true, calm: false, wood: 'birch', style: 'four', textScaleIdx: 0, autoThinkIdx: 1,
    sel: -1, selKind: null, dieFilter: -1, selMoves: [], anim: null, rollAnim: null, msg: null, think: 0, plan: null, undo: [], hint: null, hintsLeft: HINTS_PER_GAME,
    danger: new Set(), dangerAt: -1, cursor: 24, kb: false, stats: { games: 0, wins: 0 }, saved: null, demoGames: 0, result: null,
    doc: { kind: 'rules', scroll: 0 }, autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false, autoCount: 0,
    frozen: false, demo: config.demo === true, owned: !!monetization.owns?.('unlock_game'), restoreMsg: '', restoreBusy: false, dev: config.dev === true, lockupRect: null, passNote: null,
  };
  let lastScene = state.scene, docDrag = null, lastMsKey = '', lastMs = [];
  const lay = () => layoutFor(meta.width, meta.height, state.flip);
  const g0 = () => state.game;

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    state.level = Math.max(0, Math.min(LEVELS.length - 1, v.level ?? 2)); state.humanSide = v.humanSide === 1 ? 1 : 0;
    state.marks = v.marks ?? true; state.sound = v.sound ?? true; state.calm = v.calm ?? false;
    if (WOOD_KEYS.includes(v.wood)) state.wood = v.wood; if (STYLE_KEYS.includes(v.style)) state.style = v.style;
    state.textScaleIdx = Math.max(0, Math.min(TEXT_SCALES.length - 1, v.textScaleIdx ?? 0)); state.autoThinkIdx = Math.max(0, Math.min(THINK_STEPS.length - 1, v.autoThinkIdx ?? 1));
    audio.setMuted?.(!state.sound);
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v }; });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && v.game.winner < 0 && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, humanSide: state.humanSide, marks: state.marks, sound: state.sound, calm: state.calm, wood: state.wood, style: state.style, textScaleIdx: state.textScaleIdx, autoThinkIdx: state.autoThinkIdx });
  const saveGame = () => { if (state.scene === 'play' && !state.autoMode && state.game.winner < 0) { state.saved = { game: clone(state.game), humanSide: state.humanSide, two: state.two, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  monetization.onChange?.(() => { state.owned = !!monetization.owns('unlock_game'); });
  const dur = (d) => (state.calm ? d * 0.6 : d);
  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.8, to: f * 0.36, dur: 0.07, type: 'sine', vol: 0.12 });
  const reset = (extra) => Object.assign(state, { sel: -1, selKind: null, dieFilter: -1, selMoves: [], anim: null, rollAnim: null, msg: null, think: 0.5, plan: null, undo: [], hint: null, hintsLeft: HINTS_PER_GAME, autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false, dangerAt: -1, result: null, passNote: null }, extra);
  const humanTurn = () => !state.autoMode && state.game.winner < 0 && (state.two || state.game.turn === state.humanSide);
  const movesNow = () => {
    const g = state.game, k = `${g.moves}|${g.rolls}|${g.phase}|${g.turn}|${g.used.join('')}`;
    if (k !== lastMsKey) { lastMsKey = k; lastMs = legalMoves(g); }
    return lastMs;
  };
  const dangerSet = () => {
    const g = state.game;
    if (state.dangerAt !== g.moves + g.rolls * 1000) {
      state.dangerAt = g.moves + g.rolls * 1000; state.danger = new Set();
      if (g.winner < 0) {
        const me = state.two || state.autoMode ? g.turn : state.humanSide;
        for (let c = 0; c < N * N; c++) if (g.men[me][c] > 0 && !protectedMan(g, c, me) && threat(g, c, 1 - me) >= 0.3) state.danger.add(c);
      }
    }
    return state.danger;
  };

  // ---- starting things
  function startGame(two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    reset({ scene: 'play', game: newGame(), two, flip: !two && state.humanSide === 1 });
    clearSave();
    say(two ? 'Red rolls first. Tap the dice to roll.' : state.humanSide === 0 ? 'You are Red and roll first. Tap the dice.' : 'You are Blue. Red rolls first.', 5);
    monetization.track('game_start', { level: state.level, two });
  }
  function startAuto() {
    reset({ scene: 'play', game: newGame(), two: false, flip: false, autoMode: true });
    say('Auto Play: the computer plays both sides. Watch, then compare with your own guess.', 999);
  }
  function resume() {
    const v = state.saved;
    reset({ scene: 'play', game: clone(v.game), humanSide: v.humanSide, two: v.two, level: v.level ?? state.level, hintsLeft: v.hintsLeft ?? HINTS_PER_GAME, flip: !v.two && v.humanSide === 1 });
    say('Game restored.');
  }

  // ---- rolling and moving
  function doRoll() {
    const g = state.game, who = g.turn;
    const ok = rollDice(g, rng);
    state.rollAnim = { t: 0, dur: dur(ROLL_SECS), ok, who }; state.undo = []; state.hint = null; state.sel = -1; state.selKind = null; state.selMoves = []; state.dieFilter = -1; state.plan = null;
    for (let k = 0; k < 4; k++) tone({ freq: 300 + k * 90, to: 200 + k * 40, dur: 0.05, type: 'square', vol: 0.03 });
    if (!ok) state.passNote = `${NAMES[who]} cannot use any die, so the turn passes.`;
  }
  function play(m) {
    const g = state.game, p = g.turn, from = m.from;
    const kingFrom = g.king.cell, res = applyMove(g, m);
    state.anim = { m, p, from, to: m.to, path: m.path, cap: res.cap, flip: res.flip, kind: m.kind, t: 0, step: dur(0.17), kingFrom, landed: false };
    state.anim.glide = Math.max(0.2, state.anim.step * Math.max(1, m.path.length));
    state.anim.dur = state.anim.glide + (res.cap || res.flip ? 0.7 : 0.16);
    state.sel = -1; state.selKind = null; state.selMoves = []; state.dieFilter = -1; state.hint = null;
    tone({ freq: 700, to: 500, dur: 0.05, type: 'triangle', vol: 0.04 });
    if (!state.autoMode && state.scene === 'play') {
      const who = state.two ? NAMES[p] : p === state.humanSide ? 'You' : 'The computer';
      if (res.cap) say(state.two ? `${NAMES[p]} captured a herder.` : p === state.humanSide ? 'You captured a herder.' : 'The computer captured one of your herders. Take back is available only inside your own turn.', 4);
      else if (res.flip) say(`${who} won the white reindeer king.`, 4);
    }
  }
  function animSounds(a) {
    if (!a.landed && a.t >= a.glide) {
      a.landed = true; clack(a.cap ? 300 : 420);
      if (a.cap) tone({ freq: 140, to: 60, dur: 0.16, type: 'sine', vol: 0.12 });
      if (a.flip) tone({ freq: 520, to: 900, dur: 0.3, type: 'triangle', vol: 0.09 });
      if (a.kind === 'wake') tone({ freq: 880, to: 1320, dur: 0.22, type: 'sine', vol: 0.08 });
    }
  }
  function finish() {
    const g = state.game;
    if (state.scene === 'over') return;
    state.scene = 'over'; state.result = { winner: g.winner, reason: g.reason };
    if (!state.autoMode) {
      state.stats.games += 1; clearSave();
      if (!state.two && g.winner === state.humanSide) state.stats.wins += 1;
      storage.set('stats', state.stats);
      monetization.track('game_end', { winner: g.winner, moves: g.moves, level: state.level });
    }
    tone({ freq: g.winner === 2 ? 330 : 523, to: g.winner === 2 ? 330 : 784, dur: 0.45, type: 'triangle', vol: 0.1 });
  }

  // ---- selecting
  function movesFromSel() {
    if (state.sel < 0 && state.selKind !== 'wake') return [];
    const ms = movesNow().filter((m) => (state.selKind === 'wake' ? m.kind === 'wake' : m.kind === state.selKind && m.from === state.sel));
    const filtered = state.dieFilter >= 0 ? ms.filter((m) => m.die === state.dieFilter || state.game.dice[state.dieFilter] === m.val) : ms;
    const byTo = new Map();
    for (const m of filtered) { const o = byTo.get(m.to); if (!o || m.val < o.val || (m.val === o.val && m.die === state.dieFilter)) byTo.set(m.to, m); }
    return [...byTo.values()];
  }
  function refreshSel() { state.selMoves = movesFromSel(); }
  function select(cellI, kind) { state.sel = cellI; state.selKind = kind; refreshSel(); clack(600); }
  const canWake = () => movesNow().some((m) => m.kind === 'wake');
  function pressCell(i) {
    const g = state.game, me = g.turn;
    if (g.phase !== 'move') return null;
    if (i < 0) { state.sel = -1; state.selKind = null; refreshSel(); return null; }
    const dest = state.selMoves.find((m) => m.to === i);
    if (dest && !(state.selKind !== 'wake' && state.sel === i)) return dest;
    const ms = movesNow(), manMoves = ms.some((m) => m.kind === 'man' && m.from === i), kingHere = g.king.cell === i && g.king.owner === me, kingMoves = ms.some((m) => m.kind === 'king' && m.from === i);
    if (i === CAMP[me] && canWake() && !(g.men[me][i] > 0 && state.sel !== i)) { const w = ms.find((m) => m.kind === 'wake' && (state.dieFilter < 0 || m.die === state.dieFilter)); if (w) return w; }
    if (state.sel === i && state.selKind === 'man' && kingHere && kingMoves) { select(i, 'king'); return null; }
    if (state.sel === i) { state.sel = -1; state.selKind = null; refreshSel(); return null; }
    if (g.men[me][i] > 0 && manMoves) { select(i, 'man'); return null; }
    if (kingHere && kingMoves) { select(i, 'king'); return null; }
    if (g.men[me][i] > 0 || kingHere) { say('That piece cannot use any of the dice now.', 3); return null; }
    if (state.sel >= 0) { say('Tap a glowing cell, or pick another piece.', 3); return null; }
    say('Tap one of your herders first.', 3);
    return null;
  }
  const doMove = (m) => { state.undo.push({ game: clone(state.game) }); play(m); };

  // ---- title and documents
  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title(!!state.saved), R = T.rows, hit = (r) => inRect(r, tap.x, tap.y);
    if (state.lockupRect && inRect(state.lockupRect, tap.x, tap.y)) { env.openArcforgeHome?.(); return; }
    if (hit(R.resume)) resume();
    else if (hit(R.play)) startGame(false);
    else if (hit(R.two)) startGame(true);
    else if (hit(R.auto)) startAuto();
    else if (hit(R.rules)) openDoc('rules'); else if (hit(R.how)) openDoc('how'); else if (hit(R.about)) openDoc('about'); else if (hit(R.settings)) openDoc('settings');
  }
  function openDoc(kind) { state.doc = { kind, scroll: 0 }; docDrag = null; state.msg = null; state.scene = 'doc'; clack(); }
  const settingsAct = (id, v, locked, need) => {
    if (locked) { say(`Win ${need} game${need === 1 ? '' : 's'} against the computer to unlock this.`, 4); return; }
    if (id === 'restore') {
      if (state.restoreBusy) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve().then(() => monetization.restore()).then(() => {
        state.owned = !!monetization.owns('unlock_game');
        state.restoreMsg = state.owned ? 'Purchase restored. Full game unlocked.' : 'No earlier purchase found for this account.';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
      clack(); return;
    }
    if (id === 'level') state.level = v; else if (id === 'side') state.humanSide = v;
    else if (id === 'marks') state.marks = !!v; else if (id === 'sound') { state.sound = !!v; audio.setMuted?.(!state.sound); } else if (id === 'calm') state.calm = !!v;
    else if (id === 'wood') state.wood = v; else if (id === 'style') state.style = v;
    savePrefs(); clack();
  };
  function updateDoc(tap, input) {
    const D = lay().doc, p = input.pointer, keys = input.keys.pressed, max = () => docMetrics.max;
    const setScroll = (v) => { state.doc.scroll = Math.max(0, Math.min(v, max())); };
    if (wheelInput.dy) { setScroll(state.doc.scroll + wheelInput.dy); wheelInput.dy = 0; }
    if (keys.has('ArrowDown')) setScroll(state.doc.scroll + 70); if (keys.has('ArrowUp')) setScroll(state.doc.scroll - 70);
    if (keys.has('PageDown')) setScroll(state.doc.scroll + docMetrics.view * 0.9); if (keys.has('PageUp')) setScroll(state.doc.scroll - docMetrics.view * 0.9);
    if (keys.has('Home')) setScroll(0); if (keys.has('End')) setScroll(max());
    if (p.pressed && max() > 0) {
      if (inRect(D.scrollbar, p.x, p.y)) docDrag = { bar: true };
      else if (inRect(D.viewport, p.x, p.y)) docDrag = { y0: p.y, s0: state.doc.scroll, moved: false };
    }
    if (docDrag) {
      if (!p.down) docDrag = null;
      else if (docDrag.bar) setScroll(((p.y - D.scrollbar.y) / D.scrollbar.h) * max());
      else { if (Math.abs(p.y - docDrag.y0) > 10) docDrag.moved = true; setScroll(docDrag.s0 - (p.y - docDrag.y0)); }
    }
    state.doc.scroll = Math.max(0, Math.min(state.doc.scroll, max()));
    if (keys.has('Escape')) { state.scene = 'title'; return; }
    if (!tap) return;
    if (inRect(D.nav.back, tap.x, tap.y)) { state.scene = 'title'; state.msg = null; clack(); }
    else if (inRect(D.nav.next, tap.x, tap.y)) { if (max() <= 0 || state.doc.scroll >= max() - 1) { state.scene = 'title'; state.msg = null; } else setScroll(state.doc.scroll + docMetrics.view * 0.85); clack(); }
    else if (inRect(D.header.textDec, tap.x, tap.y)) { if (state.textScaleIdx > 0) { state.textScaleIdx--; state.doc.scroll = 0; savePrefs(); clack(); } }
    else if (inRect(D.header.textInc, tap.x, tap.y)) { if (state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; state.doc.scroll = 0; savePrefs(); clack(); } }
    else if (state.doc.kind === 'settings' && inRect(D.viewport, tap.x, tap.y)) {
      for (const h of ui.hits) if (inRect(h.r, tap.x, tap.y)) { settingsAct(h.id, h.v, h.locked, h.need); break; }
    }
  }

  // ---- the computer's turn: a plan (the whole sequence of dice uses) played one move at a time
  function computerStep(dt) {
    const g = state.game;
    state.think -= dt; if (state.think > 0) return;
    if (g.phase === 'roll') { doRoll(); return; }
    if (!state.plan) { const lv = state.autoMode ? Math.max(2, state.level) : state.level; state.plan = bestTurn(g, lv, rng); }
    const m = state.plan.shift();
    if (!m) { state.plan = null; const ms = legalMoves(g); if (ms.length) state.plan = [ms[0]]; return; }
    play(m); state.think = 0.2;
  }

  // ---- Auto Play: THINK (the move is decided but held back) -> REVEAL (shown with the hint glow) -> ACT, for a whole game
  function autoTick(dt) {
    const g = state.game;
    if (state.autoPhase === 'reveal') {
      state.autoTimer -= dt; if (state.autoTimer > 0) return;
      const m = state.autoMove; state.autoPhase = null; state.autoMove = null; state.hint = null;
      if (m) play(m); return;
    }
    if (state.autoPhase === 'think') {
      state.autoTimer -= dt; if (state.autoTimer > 0) return;
      const m = state.autoMove; if (m) state.hint = { from: m.from, to: m.to, kind: m.kind, t: 0 };
      state.autoPhase = 'reveal'; state.autoTimer = AUTO_REVEAL_SECS;
      say(m ? `This is the move. ${describeMove(g, m)}` : 'This is the move.', AUTO_REVEAL_SECS + 0.5); return;
    }
    if (g.phase === 'roll') { state.think -= dt; if (state.think <= 0) { doRoll(); state.autoCount = 0; } return; }
    if (!state.plan || !state.plan.length) state.plan = bestTurn(g, Math.max(2, state.level), rng);
    const m = state.plan.shift();
    if (!m) { state.plan = null; return; }
    state.autoMove = m; state.autoPhase = 'think'; state.autoTimer = THINK_STEPS[state.autoThinkIdx] * (state.autoCount++ === 0 ? 1 : 0.4);
    say(`${NAMES[g.turn]} is thinking. Which die, which piece?`, state.autoTimer + AUTO_REVEAL_SECS + 1);
  }

  function updatePlay(dt, tap, p, input) {
    const L = lay(), BTN = L.BTN, g = state.game;
    if (state.autoMode) {
      if (tap && inRect(BTN.auto.exit, tap.x, tap.y)) { state.autoMode = false; state.autoPhase = null; state.autoMove = null; state.autoPaused = false; state.msg = null; state.scene = 'title'; state.plan = null; return; }
      if (tap && inRect(BTN.auto.pause, tap.x, tap.y)) { state.autoPaused = !state.autoPaused; return; }
      if (tap && inRect(BTN.auto.dec, tap.x, tap.y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx--; savePrefs(); } return; }
      if (tap && inRect(BTN.auto.inc, tap.x, tap.y)) { if (state.autoThinkIdx < THINK_STEPS.length - 1) { state.autoThinkIdx++; savePrefs(); } return; }
      if (state.autoPaused) return;                                   // freezes the loop, the search, any move in flight and the captions
      if (state.hint) state.hint.t += dt;
      if (state.rollAnim) { state.rollAnim.t += dt; if (state.rollAnim.t >= state.rollAnim.dur) { state.rollAnim = null; if (state.passNote) { say(state.passNote, 2.5); state.passNote = null; state.think = 1.2; } } return; }
      if (state.anim) { state.anim.t += dt; animSounds(state.anim); if (state.anim.t >= state.anim.dur) { state.anim = null; dangerSet(); if (g.winner >= 0) finish(); else if (g.phase === 'roll') { state.think = 0.9; state.plan = null; } } return; }
      if (g.winner >= 0) { finish(); return; }
      autoTick(dt); return;
    }
    if (state.hint) state.hint.t += dt;
    if (state.rollAnim) {
      state.rollAnim.t += dt;
      if (state.rollAnim.t >= state.rollAnim.dur) {
        state.rollAnim = null;
        if (state.passNote) { say(state.passNote, 3); state.passNote = null; state.think = 1.1; saveGame(); }
        else if (humanTurn()) say('Tap one of your herders, then a glowing cell.', 4);
      }
      return;
    }
    if (state.anim) {
      state.anim.t += dt; animSounds(state.anim);
      if (state.anim.t >= state.anim.dur) { state.anim = null; dangerSet(); if (g.winner >= 0) finish(); else { saveGame(); state.think = g.phase === 'roll' ? 0.8 : 0.3; } }
      return;
    }
    if (g.winner >= 0) { finish(); return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.msg = null; state.scene = 'title'; state.plan = null; return; }
    if (!humanTurn()) { computerStep(dt); return; }
    dangerSet();
    if (g.phase === 'roll') {
      const hitTray = tap && inRect(L.tray, tap.x, tap.y), key = input.keys.pressed.has('Space') || input.keys.pressed.has('Enter');
      if (hitTray || key) doRoll();
      return;
    }
    // phase 'move', human
    if ((tap && inRect(BTN.undo, tap.x, tap.y)) || input.keys.pressed.has('KeyU')) {
      if (state.undo.length) { state.game = state.undo.pop().game; state.sel = -1; state.selKind = null; state.selMoves = []; state.hint = null; state.dangerAt = -1; lastMsKey = ''; say('Move taken back.'); clack(360); saveGame(); } else say('Nothing to take back yet this turn.');
      return;
    }
    if ((tap && inRect(BTN.hint, tap.x, tap.y)) || input.keys.pressed.has('KeyH')) {
      if (state.hintsLeft <= 0) say('No hints left in this game.');
      else {
        state.hintsLeft -= 1; const seq = bestTurn(g, 3, rng);
        if (seq.length) { const m = seq[0]; state.hint = { from: m.from, to: m.to, kind: m.kind, t: 0 }; say(`Hint: ${describeMove(g, m)}`, 7); }
      }
      return;
    }
    if (tap) {
      let m = null;
      const di = L.dice.findIndex((r) => inRect(r, tap.x, tap.y));
      if (di >= 0) {
        if (!g.used[di]) { state.dieFilter = state.dieFilter === di ? -1 : di; refreshSel(); clack(520); } else say('That die has been used.', 2);
        return;
      }
      for (const h of ui.hits) if (h.id === 'sleepers' && inRect(h.r, tap.x, tap.y)) { const w = movesNow().find((q) => q.kind === 'wake'); if (w) m = w; else say('A Dawn die is needed to wake a herder.', 3); }
      if (!m) m = pressCell(v3.on && v3.pick ? v3.pick(tap.x, tap.y) : L.squareAt(tap.x, tap.y));
      if (m) doMove(m);
    }
    const k = input.keys.pressed;
    if (k.has('ArrowLeft') || k.has('ArrowRight') || k.has('ArrowUp') || k.has('ArrowDown')) {
      state.kb = true; const f = state.flip ? -1 : 1, dx = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0), dy = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0);
      state.cursor = Math.max(0, Math.min(N - 1, (state.cursor % N) + dx * f)) + N * Math.max(0, Math.min(N - 1, Math.floor(state.cursor / N) + dy * f));
    } else if ((k.has('Enter') || k.has('Space')) && state.kb) { const m = pressCell(state.cursor); if (m) doMove(m); }
  }

  function keyboardTap(input) {
    const k = input.keys.pressed, sc = state.scene, L = lay();
    if (input.pointer.pressed) { state.kb = false; return null; }
    const at = (r) => ({ x: r.x + 5, y: r.y + 5 });
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) return at(L.title(!!state.saved).rows.play); return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return at(L.over.again); if (k.has('Escape')) return at(L.over.back); return null; }
    if (sc === 'play' && k.has('Escape')) return at(L.BTN.menu);
    return null;
  }

  // Developer / screenshot hook (used by main.js with ?shot=1&seed=N or ?spec=...; never reachable by a player).
  function devScene(spec) {
    state.frozen = true; if (spec.textScale !== undefined) state.textScaleIdx = spec.textScale;
    if (spec.wood) state.wood = spec.wood; if (spec.style) state.style = spec.style; if (spec.calm !== undefined) state.calm = spec.calm;
    if (spec.level !== undefined) state.level = spec.level; if (spec.human !== undefined) state.humanSide = spec.human;
    if (spec.scene === 'title') { state.scene = 'title'; if (spec.saved) state.saved = { game: newGame() }; }
    else if (spec.scene === 'doc') { openDoc(spec.doc || 'rules'); state.doc.scroll = spec.scroll || 0; }
    else if (spec.scene === 'play' || spec.scene === 'over' || spec.scene === 'auto') {
      if (spec.scene === 'auto') startAuto(); else startGame(!!spec.two);
      state.msg = null; state.think = 99;
      const g = state.game;
      for (let n = 0; n < (spec.plies || 0) && g.winner < 0; n++) {          // play `plies` rolls with the computer on both sides
        if (g.phase === 'roll') rollDice(g, rng);
        if (g.phase === 'move') for (const m of bestTurn(g, 1, rng)) { if (g.phase !== 'move') break; applyMove(g, m); }
      }
      if (g.winner < 0 && spec.dice) {
        g.turn = spec.turn ?? state.humanSide; g.dice = spec.dice.slice(); g.used = [false, false, false, false]; g.phase = 'move';
        if (!legalMoves(g).length) { g.dice = [0, 1, 2, 3]; }
      } else if (g.winner < 0 && g.phase === 'roll' && !spec.noRoll) { g.turn = spec.turn ?? state.humanSide; rollDice(g, rng); }
      lastMsKey = ''; state.dangerAt = -1; dangerSet();
      if (spec.sel === 'first' || spec.sel === 'king') {
        const ms = movesNow(), m = ms.find((q) => (spec.sel === 'king' ? q.kind === 'king' : q.kind === 'man' && q.cap)) || ms.find((q) => q.kind === 'man') || ms.find((q) => q.kind === 'king');
        if (m) { state.sel = m.from; state.selKind = m.kind; refreshSel(); }
      }
      if (spec.msg) say(spec.msg, 99);
      if (spec.scene === 'auto') { state.autoPaused = !!spec.paused; const ms = movesNow(); if (ms.length) { const m = ms[0]; state.hint = { from: m.from, to: m.to, kind: m.kind, t: 0 }; } }
      if (spec.scene === 'over') { if (g.winner < 0) { g.winner = spec.winner ?? 0; g.reason = spec.reason || 'Red has captured every Blue herder.'; } state.scene = 'over'; state.result = { winner: g.winner, reason: g.reason }; state.anim = null; }
    }
    state.sceneT = 1; lastScene = state.scene;
  }

  return {
    update(dt, input) {
      state.t += dt;
      state.viewMoves = state.scene === 'play' && humanTurn() && state.game.phase === 'move' ? movesNow() : [];
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.scene !== 'doc') wheelInput.dy = 0;
      if (state.msg && !(state.autoMode && state.autoPaused)) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      if (state.frozen) return;
      const p = input.pointer, kbd = keyboardTap(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      if (state.scene === 'title') updateTitle(tap);
      else if (state.scene === 'doc') updateDoc(tap, input);
      else if (state.scene === 'play') updatePlay(dt, tap, p, input);
      else if (state.scene === 'over' && tap) {
        const O = lay().over;
        if (inRect(O.again, tap.x, tap.y)) { if (state.autoMode) startAuto(); else startGame(state.two); }
        else if (inRect(O.back, tap.x, tap.y)) { state.autoMode = false; state.msg = null; state.scene = 'title'; }
      }
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, state.flip);
      // the kit's "Preview 1:23" pill: top centre in portrait; in landscape it moves into the right-hand card, clear of the board
      meta.previewBadge = L.land && L.rightCard ? { x: L.rightCard.x + L.rightCard.w / 2, y: L.rightCard.y + 80, align: 'center' } : L.badgeAt;
      render(ctx, state, L);
    },
    getState: () => state,
    devScene,
    // kit 1.6.1: the free-preview timer counts real play only - a live game in progress. Menus, Rules, Auto Play, results and the demo-limit
    // screen are exempt.
    isPreviewExempt() { return !(state.scene === 'play' && !state.autoMode && state.game.winner < 0); },
  };
}
