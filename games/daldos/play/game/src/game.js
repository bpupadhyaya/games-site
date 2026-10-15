// Daldøs: state and flow. Drawing is in view.js, the rule book in rules.js, the computer's brain in ai.js, text in content.js.
//
// How a turn is played: tap the stick tray to throw the stick. Spatulas that can use the throw glow; tap one to see where it would land and tap
// the point (or the spatula again) to move. A throw of 4 earns another throw. The computer plays the same way.
import { layoutFor, TEXT_SCALES, THINK_STEPS, inRect } from './layout.js';
import { newGame, clone, rollStick, applyMove, legalMoves, describeMove, spot, NAMES, SIDES, COLS, HOME } from './rules.js';
import { LEVELS, bestMove } from './ai.js';
import { WOOD_KEYS, STYLE_KEYS } from './art.js';
import { render, ui, docMetrics } from './view.js';
import { v3 } from './v3.js';

// Fluid viewport (kit 1.7.0): the short side is always 720 units and the long side follows the screen, in portrait and landscape.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_GAMES = 2, HINTS_PER_GAME = 3, AUTO_REVEAL_SECS = 2, ROLL_SECS = 0.7;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, sceneT: 1, game: newGame(4), humanSide: 0, two: false, level: 2, flip: false, count: 4,
    marks: true, sound: true, calm: false, wood: 'pine', style: 'painted', textScaleIdx: 0, autoThinkIdx: 1,
    sel: -1, anim: null, rollAnim: null, msg: null, think: 0, hint: null, hintsLeft: HINTS_PER_GAME,
    kb: false, stats: { games: 0, wins: 0 }, saved: null, demoGames: 0, result: null, shownRoll: 0,
    doc: { kind: 'rules', scroll: 0 }, autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false,
    frozen: false, dev: config.dev === true, demo: config.demo === true, owned: false, restoreMsg: '', restoreBusy: false, lockupRect: null, passNote: null, viewMoves: [],
  };
  let lastScene = state.scene, docDrag = null, lastKey = '', lastMs = [];
  const lay = () => layoutFor(meta.width, meta.height, state.flip);

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    state.level = Math.max(0, Math.min(LEVELS.length - 1, v.level ?? 2)); state.humanSide = v.humanSide === 1 ? 1 : 0;
    state.count = SIDES.includes(v.count) ? v.count : 4;
    state.marks = v.marks ?? true; state.sound = v.sound ?? true; state.calm = v.calm ?? false;
    if (WOOD_KEYS.includes(v.wood)) state.wood = v.wood; if (STYLE_KEYS.includes(v.style)) state.style = v.style;
    state.textScaleIdx = Math.max(0, Math.min(TEXT_SCALES.length - 1, v.textScaleIdx ?? 0)); state.autoThinkIdx = Math.max(0, Math.min(THINK_STEPS.length - 1, v.autoThinkIdx ?? 1));
    audio.setMuted?.(!state.sound);
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v }; });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && v.game.winner < 0 && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, humanSide: state.humanSide, count: state.count, marks: state.marks, sound: state.sound, calm: state.calm, wood: state.wood, style: state.style, textScaleIdx: state.textScaleIdx, autoThinkIdx: state.autoThinkIdx });
  const saveGame = () => { if (state.scene === 'play' && !state.autoMode && state.game.winner < 0) { state.saved = { game: clone(state.game), humanSide: state.humanSide, two: state.two, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const dur = (d) => (state.calm ? d * 0.6 : d);
  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.8, to: f * 0.36, dur: 0.07, type: 'sine', vol: 0.12 });
  const reset = (extra) => Object.assign(state, { sel: -1, anim: null, rollAnim: null, msg: null, think: 0.5, hint: null, hintsLeft: HINTS_PER_GAME, autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false, result: null, passNote: null, shownRoll: 0 }, extra);
  const humanTurn = () => !state.autoMode && state.game.winner < 0 && (state.two || state.game.turn === state.humanSide);
  const movesNow = () => {
    const g = state.game, k = `${g.moves}|${g.rolls}|${g.phase}|${g.turn}|${g.roll}`;
    if (k !== lastKey) { lastKey = k; lastMs = g.phase === 'move' ? legalMoves(g) : []; }
    return lastMs;
  };
  const who = (side) => (state.autoMode ? `${NAMES[side]}` : state.two ? NAMES[side] : side === state.humanSide ? 'You' : 'The computer');

  // ---- starting things
  function startGame(two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    reset({ scene: 'play', game: newGame(state.count), two, flip: !two && state.humanSide === 1 });
    clearSave();
    say(two ? 'Red throws first. Tap the stick tray.' : state.humanSide === 0 ? 'You are Red and throw first. Tap the stick tray.' : 'You are Blue. Red throws first.', 5);
    monetization.track('game_start', { level: state.level, two, count: state.count });
  }
  function startAuto() {
    reset({ scene: 'play', game: newGame(state.count), two: false, flip: false, autoMode: true });
    say('Auto Play: the computer plays both sides. Watch, then compare with your own guess.', 999);
  }
  function resume() {
    const v = state.saved;
    reset({ scene: 'play', game: clone(v.game), humanSide: v.humanSide, two: v.two, level: v.level ?? state.level, hintsLeft: v.hintsLeft ?? HINTS_PER_GAME, flip: !v.two && v.humanSide === 1 });
    state.shownRoll = v.game.lastRoll || 0;
    say('Game restored.');
  }

  // ---- throwing and moving
  function doRoll() {
    const g = state.game, side = g.turn;
    const ok = rollStick(g, rng);
    state.shownRoll = ok ? g.roll : g.lastRoll;
    state.rollAnim = { t: 0, dur: dur(ROLL_SECS), ok, side }; state.hint = null; state.sel = -1;
    for (let k = 0; k < 3; k++) tone({ freq: 260 + k * 70, to: 180 + k * 30, dur: 0.05, type: 'square', vol: 0.03 });
    if (!ok) state.passNote = `${who(side)} threw ${g.lastRoll} and cannot use it, so the turn passes.`;
  }
  function play(m) {
    const g = state.game, side = g.turn, v = g.roll;
    const res = applyMove(g, m);
    state.anim = { m, side, from: m.from, to: m.to, cap: res.cap, turn: res.turn, home: res.home, t: 0, v, landed: false };
    state.anim.glide = dur(0.45 + 0.06 * Math.min(4, v)); state.anim.dur = state.anim.glide + (res.cap || res.turn || res.home ? 0.7 : 0.18);
    state.sel = -1; state.hint = null;
    tone({ freq: 700, to: 500, dur: 0.05, type: 'triangle', vol: 0.04 });
    if (!state.autoMode && state.scene === 'play') {
      if (res.cap) say(state.two ? `${NAMES[side]} captured a spatula.` : side === state.humanSide ? 'You captured a spatula.' : 'The computer captured one of your spatulas.', 4);
      else if (res.home) say(`${who(side)} brought a spatula home.`, 3);
      else if (g.extra) say(`${who(side)} threw a 4: another throw.`, 3);
    }
  }
  function animSounds(a) {
    if (!a.landed && a.t >= a.glide) {
      a.landed = true; clack(a.cap ? 300 : 420);
      if (a.cap) tone({ freq: 140, to: 60, dur: 0.16, type: 'sine', vol: 0.12 });
      if (a.turn) tone({ freq: 520, to: 900, dur: 0.25, type: 'triangle', vol: 0.09 });
      if (a.home) tone({ freq: 660, to: 990, dur: 0.3, type: 'sine', vol: 0.09 });
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
    tone({ freq: 523, to: 784, dur: 0.45, type: 'triangle', vol: 0.1 });
  }

  // ---- selecting
  const cellKey = (c) => (c ? c.row * COLS + c.col : -1);
  const fromCell = (m, side) => (m.from > 0 ? spot(side, m.from) : null);
  const toCell = (m, side) => (m.to < HOME ? spot(side, m.to) : null);
  function pressCell(cell) {
    const g = state.game, side = g.turn, ms = movesNow();
    if (!ms.length || !cell) return null;
    const selM = state.sel >= 0 ? ms.find((m) => m.from === state.sel) : null;
    const ck = cellKey(cell);
    if (selM && cellKey(toCell(selM, side)) === ck) return selM;
    const own = ms.find((m) => m.from > 0 && cellKey(fromCell(m, side)) === ck);
    if (own) { if (state.sel === own.from) return own; state.sel = own.from; clack(600); return null; }
    const dest = ms.filter((m) => cellKey(toCell(m, side)) === ck);
    if (dest.length === 1) return dest[0];
    if (dest.length > 1) { say('Tap the spatula you want to move first.', 3); return null; }
    state.sel = -1;
    return null;
  }
  function cycle(dir) {
    const ms = movesNow(); if (!ms.length) return;
    const i = ms.findIndex((m) => m.from === state.sel);
    state.sel = ms[(i + dir + ms.length * 2) % ms.length].from; clack(600);
  }

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
    if (id === 'restore') { restorePurchase(); return; }
    if (id === 'level') state.level = v; else if (id === 'side') state.humanSide = v; else if (id === 'count') state.count = v;
    else if (id === 'marks') state.marks = !!v; else if (id === 'sound') { state.sound = !!v; audio.setMuted?.(!state.sound); } else if (id === 'calm') state.calm = !!v;
    else if (id === 'wood') state.wood = v; else if (id === 'style') state.style = v;
    savePrefs(); clack();
  };
  function restorePurchase() {
    if (state.restoreBusy || state.demo) return;
    state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
    Promise.resolve().then(() => monetization.restore()).then(() => {
      state.owned = monetization.owns('unlock_game');
      state.restoreMsg = state.owned ? 'Purchase restored. The full game is unlocked.' : 'No earlier purchase was found for this account.';
    }).catch(() => { state.restoreMsg = 'Could not reach the store. Please try again later.'; }).finally(() => { state.restoreBusy = false; });
  }
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

  // ---- the computer's turn
  function computerStep(dt) {
    const g = state.game;
    state.think -= dt; if (state.think > 0) return;
    if (g.phase === 'roll') { doRoll(); return; }
    const m = bestMove(g, state.level, rng) || legalMoves(g)[0];
    if (m) { play(m); state.think = 0.2; }
  }

  // ---- Auto Play: THINK (decided but held back) -> REVEAL (shown with the hint glow) -> ACT, for a whole game
  function autoTick(dt) {
    const g = state.game;
    if (state.autoPhase === 'reveal') {
      state.autoTimer -= dt; if (state.autoTimer > 0) return;
      const m = state.autoMove; state.autoPhase = null; state.autoMove = null; state.hint = null;
      if (m) play(m); return;
    }
    if (state.autoPhase === 'think') {
      state.autoTimer -= dt; if (state.autoTimer > 0) return;
      const m = state.autoMove; if (m) state.hint = { from: m.from, to: m.to, side: g.turn, t: 0 };
      state.autoPhase = 'reveal'; state.autoTimer = AUTO_REVEAL_SECS;
      say(m ? `This is the move. ${describeMove(g, m)}` : 'This is the move.', AUTO_REVEAL_SECS + 0.5); return;
    }
    if (g.phase === 'roll') { state.think -= dt; if (state.think <= 0) doRoll(); return; }
    const m = bestMove(g, Math.max(2, state.level), rng);
    if (!m) return;
    state.autoMove = m; state.autoPhase = 'think'; state.autoTimer = THINK_STEPS[state.autoThinkIdx];
    say(`${NAMES[g.turn]} threw ${g.roll}. Which spatula should move?`, state.autoTimer + AUTO_REVEAL_SECS + 1);
  }

  function updatePlay(dt, tap, input) {
    const L = lay(), BTN = L.BTN, g = state.game;
    if (state.autoMode) {
      if (tap && inRect(BTN.auto.exit, tap.x, tap.y)) { state.autoMode = false; state.autoPhase = null; state.autoMove = null; state.autoPaused = false; state.msg = null; state.scene = 'title'; return; }
      if (tap && inRect(BTN.auto.pause, tap.x, tap.y)) { state.autoPaused = !state.autoPaused; return; }
      if (tap && inRect(BTN.auto.dec, tap.x, tap.y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx--; savePrefs(); } return; }
      if (tap && inRect(BTN.auto.inc, tap.x, tap.y)) { if (state.autoThinkIdx < THINK_STEPS.length - 1) { state.autoThinkIdx++; savePrefs(); } return; }
      if (state.autoPaused) return;                                   // freezes the loop, the search, any move in flight and the captions
      if (state.hint) state.hint.t += dt;
      if (state.rollAnim) { state.rollAnim.t += dt; if (state.rollAnim.t >= state.rollAnim.dur) { state.rollAnim = null; if (state.passNote) { say(state.passNote, 2.5); state.passNote = null; state.think = 1.2; } } return; }
      if (state.anim) { state.anim.t += dt; animSounds(state.anim); if (state.anim.t >= state.anim.dur) { state.anim = null; if (g.winner >= 0) finish(); else if (g.phase === 'roll') state.think = 0.9; } return; }
      if (g.winner >= 0) { finish(); return; }
      autoTick(dt); return;
    }
    if (state.hint) state.hint.t += dt;
    if (state.rollAnim) {
      state.rollAnim.t += dt;
      if (state.rollAnim.t >= state.rollAnim.dur) {
        state.rollAnim = null;
        if (state.passNote) { say(state.passNote, 3); state.passNote = null; state.think = 1.1; saveGame(); }
        else if (humanTurn()) say(`You threw ${g.roll}. Tap a glowing spatula.`, 4);
      }
      return;
    }
    if (state.anim) {
      state.anim.t += dt; animSounds(state.anim);
      if (state.anim.t >= state.anim.dur) { state.anim = null; if (g.winner >= 0) finish(); else { saveGame(); state.think = g.phase === 'roll' ? 0.8 : 0.3; } }
      return;
    }
    if (g.winner >= 0) { finish(); return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.msg = null; state.scene = 'title'; return; }
    if (!humanTurn()) { computerStep(dt); return; }
    if (g.phase === 'roll') {
      const hitTray = tap && inRect(L.tray, tap.x, tap.y), key = input.keys.pressed.has('Space') || input.keys.pressed.has('Enter');
      if (hitTray || key) doRoll();
      return;
    }
    // phase 'move', human
    if ((tap && inRect(BTN.hint, tap.x, tap.y)) || input.keys.pressed.has('KeyH')) {
      if (state.hintsLeft <= 0) say('No hints left in this game.');
      else {
        state.hintsLeft -= 1; const m = bestMove(g, 3, rng);
        if (m) { state.hint = { from: m.from, to: m.to, side: g.turn, t: 0 }; state.sel = m.from; say(`Hint: ${describeMove(g, m)}`, 7); }
      }
      return;
    }
    if (tap) {
      let m = null, usedHit = false;
      const ms = movesNow(), sel = state.sel >= 0 ? ms.find((q) => q.from === state.sel) : null;
      for (const h of ui.hits) {
        if (!inRect(h.r, tap.x, tap.y)) continue;
        usedHit = true;
        if (h.id === 'harbour') {
          const e = ms.find((q) => q.from === 0);
          if (e) { if (state.sel === 0) m = e; else { state.sel = 0; clack(600); } } else say('This throw cannot launch a spatula now.', 3);
        } else if (h.id === 'home' && sel && sel.home) m = sel;
        break;
      }
      if (!usedHit) m = pressCell(v3.on && v3.pick ? v3.pick(tap.x, tap.y) : L.cellAt(tap.x, tap.y));
      if (m) play(m);
    }
    const k = input.keys.pressed;
    if (k.has('ArrowRight') || k.has('ArrowDown')) { state.kb = true; cycle(1); }
    else if (k.has('ArrowLeft') || k.has('ArrowUp')) { state.kb = true; cycle(-1); }
    else if ((k.has('Enter') || k.has('Space')) && state.sel >= 0) { const m = movesNow().find((q) => q.from === state.sel); if (m) play(m); }
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
    if (spec.count) state.count = spec.count;
    if (spec.scene === 'title') { state.scene = 'title'; if (spec.saved) state.saved = { game: newGame(state.count) }; }
    else if (spec.scene === 'doc') { openDoc(spec.doc || 'rules'); state.doc.scroll = spec.scroll || 0; }
    else if (spec.scene === 'play' || spec.scene === 'over' || spec.scene === 'auto') {
      if (spec.scene === 'auto') startAuto(); else startGame(!!spec.two);
      state.msg = null; state.think = 99;
      const g = state.game;
      for (let n = 0; n < (spec.plies || 0) && g.winner < 0; n++) {          // play `plies` moves with the computer on both sides
        if (g.phase === 'roll') rollStick(g, rng);
        if (g.phase === 'move') { const m = bestMove(g, 1, rng); if (m) applyMove(g, m); }
      }
      if (g.winner < 0) {
        g.turn = spec.turn ?? state.humanSide; g.phase = 'move'; g.roll = spec.roll || 3; state.shownRoll = g.roll;
        if (!legalMoves(g).length) { for (let r = 1; r <= 4; r++) { g.roll = r; if (legalMoves(g).length) break; } state.shownRoll = g.roll; }
      }
      lastKey = '';
      if (spec.sel === 'first') {
        const ms = movesNow(), m = ms.find((q) => q.cap) || ms.find((q) => q.turn) || ms[0];
        if (m) state.sel = m.from;
      }
      if (spec.msg) say(spec.msg, 99);
      if (spec.scene === 'auto') { state.autoPaused = !!spec.paused; const ms = movesNow(); if (ms.length) { const m = ms[0]; state.hint = { from: m.from, to: m.to, side: g.turn, t: 0 }; } }
      if (spec.scene === 'over') { if (g.winner < 0) { g.winner = spec.winner ?? 0; g.reason = spec.reason || 'Red has brought every spatula home.'; for (let i = 0; i < g.n; i++) g.pieces[g.winner][i] = HOME; } state.scene = 'over'; state.result = { winner: g.winner, reason: g.reason }; state.anim = null; }
    }
    state.sceneT = 1; lastScene = state.scene;
  }

  return {
    update(dt, input) {
      state.t += dt; state.owned = monetization.owns('unlock_game');
      state.viewMoves = state.scene === 'play' && humanTurn() && state.game.phase === 'move' ? movesNow() : [];
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.scene !== 'doc') wheelInput.dy = 0;
      if (state.msg && !(state.autoMode && state.autoPaused)) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      if (state.frozen) return;
      const p = input.pointer, kbd = keyboardTap(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      if (state.scene === 'title') updateTitle(tap);
      else if (state.scene === 'doc') updateDoc(tap, input);
      else if (state.scene === 'play') updatePlay(dt, tap, input);
      else if (state.scene === 'over' && tap) {
        const O = lay().over;
        if (inRect(O.again, tap.x, tap.y)) { if (state.autoMode) startAuto(); else startGame(state.two); }
        else if (inRect(O.back, tap.x, tap.y)) { state.autoMode = false; state.msg = null; state.scene = 'title'; }
      }
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, state.flip);
      // the kit's "Preview 1:23" pill: top centre in portrait (the layout keeps that strip free); in landscape it sits above the board
      meta.previewBadge = L.land && L.badgeAt ? { x: L.badgeAt.x, y: L.badgeAt.y, align: 'center' } : undefined;
      render(ctx, state, L);
    },
    getState: () => state,
    devScene,
    // kit 1.6.1: the free-preview timer counts real play only - a live game in progress. Menus, Rules, Auto Play, results and the demo-limit
    // screen are exempt.
    isPreviewExempt() { return !(state.scene === 'play' && !state.autoMode && state.game.winner < 0); },
  };
}
