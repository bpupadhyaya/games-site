// Yote. State and flow. Drawing is in view.js, the rule book in rules.js, the computer's brain in ai.js, text in content.js.
//
// How a move is made: tap an empty pit to DROP a pebble from your hand there; or tap one of your pebbles on the board (it lifts and the pits
// it can reach glow; a jump is ringed in red with a +1 for the bonus) and then tap the pit - or drag the pebble onto it. After a jump the
// enemy pebbles that may be taken as the bonus pulse: tap one. Capture is never compulsory, so a refused move only says why.
import { v3 } from './v3.js';
import { layoutFor, TEXT_SCALES, THINK_STEPS, inRect } from './layout.js';
import { newGame, clone, applyMove, tryMove, legalFrom, endangered, describeMove, bonusOptions, pieceCount, NO_BONUS, HAND_BONUS, SZ, COLS } from './rules.js';
import { LEVELS, createThinker } from './ai.js';
import { LESSONS } from './content.js';
import { BOARD_KEYS, STYLE_KEYS, sideName } from './art.js';
import { render, ui, docMetrics } from './view.js';
import { TIMING } from './timing.js';

// Fluid viewport (kit 1.7.0): the short side is always 720 units and the long side follows the screen, in portrait and landscape.
// Picking: with the 3D layer live the board is a perspective view, so the presenter's ray test decides the pit; flat layout otherwise.
const sqAt = (L, x, y) => (v3.on && v3.pick ? v3.pick(x, y) : L.squareAt(x, y));
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
// Mouse-wheel travel (virtual units) collected by main.js and consumed by the document screens; empty in headless runs.
export const wheelInput = { dy: 0 };
const DEMO_GAMES = 2, HINTS_PER_GAME = 3, AUTO_REVEAL_SECS = 2;
const LETTER = { B: 1, W: 2 };


export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, sceneT: 1, game: newGame(), humanSide: 1, two: false, level: 2, flip: false,
    marks: true, sound: true, calm: false, board: 'laterite', style: 'river', textScaleIdx: 0, autoThinkIdx: 1,
    sel: -1, selMoves: [], pend: null, drag: null, anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS_PER_GAME, danger: new Set(), dangerAt: -1,
    cursor: 14, kb: false, stats: { games: 0, wins: 0, stars: {} }, saved: null, learned: false, demoGames: 0, lesson: null, result: null,
    doc: { kind: 'rules', scroll: 0 }, autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false, frozen: false, dev: config.dev === true,
    lockupRect: null, demo: config.demo === true, owned: !!monetization.owns?.('unlock_game'), restoreMsg: '', restoreBusy: false,
  };
  let thinker = null, hintThinker = null, lastScene = state.scene, drag0 = null, docDrag = null;
  const lay = () => layoutFor(meta.width, meta.height, state.flip);
  monetization.onChange?.(() => { state.owned = !!monetization.owns('unlock_game'); });

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    state.level = Math.max(0, Math.min(LEVELS.length - 1, v.level ?? 2)); state.humanSide = v.humanSide === 2 ? 2 : 1;
    state.marks = v.marks ?? true; state.sound = v.sound ?? true; state.calm = v.calm ?? false;
    if (BOARD_KEYS.includes(v.board)) state.board = v.board; if (STYLE_KEYS.includes(v.style)) state.style = v.style;
    state.textScaleIdx = Math.max(0, Math.min(TEXT_SCALES.length - 1, v.textScaleIdx ?? 0)); state.autoThinkIdx = Math.max(0, Math.min(THINK_STEPS.length - 1, v.autoThinkIdx ?? 1));
    audio.setMuted?.(!state.sound);
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, stars: { ...(v.stars || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && !v.game.winner && v.game.board && v.game.board.length === SZ && v.game.hand && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, humanSide: state.humanSide, marks: state.marks, sound: state.sound, calm: state.calm, board: state.board, style: state.style, textScaleIdx: state.textScaleIdx, autoThinkIdx: state.autoThinkIdx });
  const saveGame = () => { if (state.scene === 'play' && !state.autoMode && !state.game.winner) { state.saved = { game: clone(state.game), humanSide: state.humanSide, two: state.two, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const name = (s) => sideName(state.style, s);
  const dur = (d) => (state.calm ? d * 0.6 : d);
  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.8, to: f * 0.36, dur: 0.07, type: 'sine', vol: 0.12 });
  const reset = (extra) => Object.assign(state, { sel: -1, selMoves: [], pend: null, drag: null, anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS_PER_GAME, autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false, dangerAt: -1, result: null }, extra);
  const dangerSet = () => {
    const g = state.game;
    if (state.dangerAt !== g.moves) { state.dangerAt = g.moves; state.danger = g.winner ? new Set() : endangered(g, state.two || state.autoMode ? g.turn : state.humanSide); }
    return state.danger;
  };
  const humanTurn = () => !state.autoMode && !state.game.winner && (state.two || state.game.turn === state.humanSide);

  // ---- starting things
  function startGame(two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    thinker = hintThinker = null;
    reset({ scene: 'play', game: newGame(), two, flip: !two && state.humanSide === 2 });
    clearSave();
    say(two ? `${name(1)} moves first. Tap an empty pit to drop a pebble.` : state.humanSide === 1 ? `You are ${name(1)} and move first. Tap an empty pit to drop a pebble.` : `You are ${name(2)}. ${name(1)} moves first.`, 5);
    if (!two && state.humanSide === 2) state.think = 0.6;
    monetization.track('game_start', { level: state.level, two });
  }
  function startAuto() {
    thinker = hintThinker = null;
    reset({ scene: 'play', game: newGame(), two: false, flip: false, autoMode: true });
    say('Auto Play: the computer plays both sides. Watch, then compare with your own guess.', 999);
  }
  function resume() {
    const v = state.saved; thinker = hintThinker = null;
    reset({ scene: 'play', game: clone(v.game), humanSide: v.humanSide, two: v.two, level: v.level ?? state.level, hintsLeft: v.hintsLeft ?? HINTS_PER_GAME, flip: !v.two && v.humanSide === 2 });
    say('Game restored.');
    if (!humanTurn()) state.think = 0.5;
  }
  function setupBoard(g, rows, hand, turn = 1) {
    g.board = rows.join('').split('').map((ch) => LETTER[ch] || 0);
    g.hand = [0, hand ? hand[0] : 0, hand ? hand[1] : 0]; g.seen = {}; g.turn = turn; g.lost = [0, 0, 0]; g.moves = 0; g.last = null; g.quiet = 0; g.winner = 0;
  }
  function startLesson(i) {
    const l = LESSONS[i], g = newGame();
    setupBoard(g, l.board, l.hand);
    thinker = hintThinker = null;
    reset({ scene: 'lesson', game: g, two: true, flip: false, lesson: { i, done: false } });
  }

  // ---- moves
  function refreshSel() {
    const g = state.game;
    state.selMoves = state.sel >= 0 ? legalFrom(g, state.sel).map((m) => ({ to: m.to, jump: m.kind === 'jump', move: m })) : [];
  }
  function play(m) {
    const g = state.game, side = g.turn;
    applyMove(g, m);
    const L = g.last;
    const T = TIMING, d = dur(1);
    const total = m.kind === 'drop' ? T.drop : m.kind === 'step' ? T.step : T.hop + (L.bonus >= 0 || L.fromHand ? T.bonusAt - T.hop + T.bonusLen + 0.15 : T.capAt + T.capLen - T.hop + 0.15);
    state.anim = { kind: m.kind, from: m.from, to: m.to, cap: L.cap, bonus: L.bonus, bonusHand: L.fromHand, side, t: 0, dur: total * d, k: d, said: 0 };
    state.sel = -1; state.selMoves = []; state.pend = null; state.drag = null; state.hint = null;
    if (m.kind === 'drop') tone({ freq: 520, to: 700, dur: 0.06, type: 'triangle', vol: 0.05 });
    else tone({ freq: 700, to: 500, dur: 0.05, type: 'triangle', vol: 0.04 });
    if (!(m.kind === 'jump') && state.scene === 'play' && !state.game.winner && state.game.quiet === 60) say('30 moves each without a capture. At 40 the side with more pebbles wins.', 6);
    if (m.kind === 'jump' && !state.autoMode && state.scene === 'play') {                 // the tutor says what just happened
      const n = 1 + (L.bonus >= 0 || L.fromHand ? 1 : 0), pcs = n === 1 ? 'pebble' : 'pebbles';
      say(state.two ? `${name(side)} captured ${n} ${pcs}.` : side === state.humanSide ? `You captured ${n} ${pcs}.` : `The computer captured ${n} of your ${pcs}. Take back to try again.`, 4);
    }
  }
  // sounds keyed to the moment each part of the animation happens
  function animSounds(a) {
    const T = TIMING, t = a.t / a.k;
    const once = (bit, at, fn) => { if (!(a.said & bit) && t >= at) { a.said |= bit; fn(); } };
    if (a.kind === 'drop') once(1, T.dropLand, () => { clack(300); tone({ freq: 160, to: 90, dur: 0.1, type: 'sine', vol: 0.1 }); });
    else if (a.kind === 'step') once(1, T.step * 0.85, () => clack(420));
    else {
      once(1, T.hop * 0.9, () => clack(420));
      once(2, T.capAt + 0.05, () => { tone({ freq: 140, to: 60, dur: 0.14, type: 'sine', vol: 0.12 }); tone({ freq: 880, to: 1500, dur: 0.12, type: 'triangle', vol: 0.07 }); });
      if (a.bonus >= 0 || a.bonusHand) once(4, T.bonusAt + 0.25, () => { tone({ freq: 110, to: 55, dur: 0.2, type: 'sine', vol: 0.13 }); tone({ freq: 1046, to: 1760, dur: 0.16, type: 'triangle', vol: 0.08 }); });
    }
  }
  function finish() {
    const g = state.game;
    state.scene = 'over'; state.result = { winner: g.winner, reason: g.reason };
    if (!state.autoMode) {
      state.stats.games += 1; clearSave();
      if (!state.two && g.winner === state.humanSide) { state.stats.wins += 1; state.stats.stars['l' + state.level] = true; }
      storage.set('stats', state.stats);
      monetization.track('game_end', { winner: g.winner, moves: g.moves, level: state.level });
    }
    const w = g.winner === 3 ? 330 : 523;
    tone({ freq: w, to: g.winner === 3 ? 330 : 784, dur: 0.45, type: 'triangle', vol: 0.1 });
  }

  // A jump the player chose: the bonus is picked next. One choice (or none) is taken automatically; more wait for a tap.
  function chooseJump(m) {
    const g = state.game, opts = bonusOptions(g.board, g.hand, g.turn, m);
    if (opts.length === 1) return { ...m, bonus: opts[0] };
    state.pend = { move: m, opts }; state.sel = m.from; state.selMoves = []; state.drag = null;
    say('Now take a bonus: tap the enemy pebble to remove.', 8);
    clack(520);
    return null;
  }
  // What a press on board pit i means for the player to move. Returns the complete legal move chosen, or null.
  function pressSquare(i) {
    const g = state.game, me = g.turn, opp = 3 - me;
    if (state.pend) {
      if (state.pend.opts.includes(i)) { const m = { ...state.pend.move, bonus: i }; return m; }
      state.pend = null; state.sel = -1; state.selMoves = []; say('Jump cancelled. Tap a pebble to start again.', 3);
      if (i >= 0 && g.board[i] === me) { state.sel = i; refreshSel(); }
      return null;
    }
    if (i < 0) { state.sel = -1; refreshSel(); return null; }
    if (state.sel >= 0 && i === state.sel) { state.sel = -1; refreshSel(); return null; }
    if (state.sel >= 0) {
      const hit = state.selMoves.find((m) => m.to === i);
      if (hit) return hit.move.kind === 'jump' ? chooseJump(hit.move) : hit.move;
    }
    if (g.board[i] === me) { state.sel = i; refreshSel(); clack(600); drag0 = null; return null; }
    if (g.board[i] === 0) {
      if (state.sel >= 0) {
        const r = tryMove(g, state.sel, i); state.sel = -1; refreshSel();
        say(`${r.error || 'That move is not allowed.'} Tap the pit again to drop a pebble there.`, 5);
        tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.06 });
        return null;
      }
      if (g.hand[me] > 0) return { kind: 'drop', from: -1, to: i, cap: -1, bonus: NO_BONUS };
      say('You have no pebbles left in hand. Tap one of your pebbles on the board to move it.', 5); return null;
    }
    if (g.board[i] === opp) {
      if (state.sel >= 0) say('That is the other side’s pebble. Tap a glowing pit.');
      else say(`It is ${name(me)}’s turn. Tap an empty pit to drop, or one of your own pebbles.`);
    }
    return null;
  }

  // ---- title and documents
  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title(!!state.saved), R = T.rows, hit = (r) => inRect(r, tap.x, tap.y);
    if (state.lockupRect && inRect(state.lockupRect, tap.x, tap.y)) { env.openArcforgeHome?.(); return; }
    if (hit(R.resume)) resume();
    else if (hit(R.play)) startGame(false);
    else if (hit(R.two)) startGame(true);
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.auto)) startAuto();
    else if (hit(R.rules)) openDoc('rules'); else if (hit(R.how)) openDoc('how'); else if (hit(R.about)) openDoc('about'); else if (hit(R.settings)) openDoc('settings');
  }
  function openDoc(kind) { state.doc = { kind, scroll: 0 }; docDrag = null; state.msg = null; state.scene = 'doc'; clack(); }
  const settingsAct = (id, v, locked, need) => {
    if (locked) { say(`Win ${need} game${need === 1 ? '' : 's'} against the computer to unlock this.`, 4); return; }
    if (id === 'restore') {
      if (state.owned || state.restoreBusy || state.demo) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore()).then(() => {
        state.owned = !!monetization.owns('unlock_game');
        state.restoreMsg = state.owned ? 'Purchase restored. Thank you!' : 'No earlier purchase was found for this account.';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Please try again later.'; }).finally(() => { state.restoreBusy = false; });
      return;
    }
    if (id === 'level') state.level = v; else if (id === 'side') state.humanSide = v;
    else if (id === 'marks') state.marks = !!v; else if (id === 'sound') { state.sound = !!v; audio.setMuted?.(!state.sound); } else if (id === 'calm') state.calm = !!v;
    else if (id === 'board') state.board = v; else if (id === 'style') state.style = v;
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

  // ---- Auto Play: THINK (the move is decided but held back) -> REVEAL (shown with the hint glow) -> ACT, for a whole game
  function autoTick(dt) {
    if (state.autoPhase === 'reveal') {
      state.autoTimer -= dt; if (state.autoTimer > 0) return;
      const m = state.autoMove; state.autoPhase = null; state.autoMove = null; state.hint = null;
      if (m) play(m); return;
    }
    if (state.autoPhase === 'think') {
      state.autoTimer -= dt; if (state.autoTimer > 0) return;
      const m = state.autoMove; if (m) state.hint = { from: m.from, to: m.to, bonus: m.bonus, t: 0 };
      state.autoPhase = 'reveal'; state.autoTimer = AUTO_REVEAL_SECS;
      say(m ? `This is the move. ${describeMove(state.game, m)}` : 'This is the move.', AUTO_REVEAL_SECS + 0.5); return;
    }
    if (!thinker) { thinker = createThinker(state.game, Math.max(2, state.level), rng); state.thinking = true; }
    const r = thinker.step(); if (r.move === undefined) return;
    thinker = null; state.thinking = false; state.autoMove = r.move; state.autoPhase = 'think'; state.autoTimer = THINK_STEPS[state.autoThinkIdx];
    say(`${name(state.game.turn)} is thinking. What would you play?`, state.autoTimer + AUTO_REVEAL_SECS + 1);
  }

  function endAnim() {
    state.anim = null; dangerSet();
    if (state.game.winner) { finish(); return true; }
    return false;
  }
  function updatePlay(dt, tap, p, input) {
    const BTN = lay().BTN;
    if (state.autoMode) {
      if (tap && inRect(BTN.auto.exit, tap.x, tap.y)) { state.autoMode = false; state.autoPhase = null; state.autoMove = null; state.autoPaused = false; state.msg = null; state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return; }
      if (tap && inRect(BTN.auto.pause, tap.x, tap.y)) { state.autoPaused = !state.autoPaused; return; }
      if (tap && inRect(BTN.auto.dec, tap.x, tap.y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx--; savePrefs(); } return; }
      if (tap && inRect(BTN.auto.inc, tap.x, tap.y)) { if (state.autoThinkIdx < THINK_STEPS.length - 1) { state.autoThinkIdx++; savePrefs(); } return; }
      if (state.autoPaused) return;                                       // freezes the loop, the search, any move in flight and the captions
      if (state.hint) { state.hint.t += dt; if (state.hint.t > 4) state.hint = null; }
      if (state.anim) { state.anim.t += dt; animSounds(state.anim); if (state.anim.t >= state.anim.dur) endAnim(); return; }
      autoTick(dt); return;
    }
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 8) state.hint = null; }
    if (state.anim) {
      state.anim.t += dt; animSounds(state.anim);
      if (state.anim.t >= state.anim.dur) { if (!endAnim()) { saveGame(); if (!humanTurn()) state.think = 0.35; } }
      return;
    }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.msg = null; state.pend = null; state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return; }
    if (!humanTurn()) {
      state.think -= dt; if (state.think > 0) return;
      if (!thinker) { thinker = createThinker(state.game, state.level, rng); state.thinking = true; }
      const r = thinker.step();
      if (r.move !== undefined) { thinker = null; state.thinking = false; if (r.move) play(r.move); }
      return;
    }
    dangerSet();
    if (hintThinker) {
      const r = hintThinker.step();
      if (r.move !== undefined) { hintThinker = null; state.thinking = false; if (r.move) { state.hint = { from: r.move.from, to: r.move.to, bonus: r.move.bonus, t: 0 }; say(`Hint: ${describeMove(state.game, r.move)}`, 7); } }
      return;
    }
    if ((tap && inRect(BTN.undo, tap.x, tap.y)) || input.keys.pressed.has('KeyU')) {
      if (state.pend) { state.pend = null; state.sel = -1; state.selMoves = []; say('Jump cancelled.'); }
      else if (state.undo.length) { state.game = state.undo.pop().game; state.sel = -1; state.selMoves = []; state.hint = null; state.dangerAt = -1; say('Move taken back.'); clack(360); saveGame(); } else say('Nothing to take back yet.');
      return;
    }
    if ((tap && inRect(BTN.hint, tap.x, tap.y)) || input.keys.pressed.has('KeyH')) {
      if (state.pend) { say('Tap the enemy pebble you want to take as the bonus.'); return; }
      if (state.hintsLeft <= 0) say('No hints left in this game.');
      else { state.hintsLeft -= 1; hintThinker = createThinker(state.game, 3, rng); state.thinking = true; state.sel = -1; state.selMoves = []; say('Looking for a good move...', 6); }
      return;
    }
    // board: tap to select / move, or press-drag-release
    const L = lay(); let m = null;
    if (p.pressed) { m = pressSquare(sqAt(L, p.x, p.y)); drag0 = state.sel >= 0 && !state.pend && !m ? { x: p.x, y: p.y } : null; }
    if (!m && p.down && drag0 && state.sel >= 0) { if (state.drag || Math.hypot(p.x - drag0.x, p.y - drag0.y) > L.cell * 0.28) state.drag = { x: p.x, y: p.y }; }
    if (!m && p.released && drag0) {
      if (state.drag) {
        const i = sqAt(L, p.x, p.y); state.drag = null;
        if (i >= 0 && i !== state.sel) { const hit = state.selMoves.find((q) => q.to === i); if (hit) m = hit.move.kind === 'jump' ? chooseJump(hit.move) : hit.move; else if (state.game.board[i] === 0) { const r = tryMove(state.game, state.sel, i); say(r.error); } }
      }
      drag0 = null;
    }
    if (!p.down) { state.drag = null; }
    if (!m) { const k = keyMove(input, L); if (k) m = k; }
    if (m) { state.undo.push({ game: clone(state.game) }); play(m); }
  }

  // Arrow keys move the cursor in SCREEN directions (the board is turned in portrait); Enter / Space presses the pit.
  function keyMove(input, L) {
    const k = input.keys.pressed; let dx = 0, dy = 0;
    if (k.has('ArrowLeft')) dx = -1; else if (k.has('ArrowRight')) dx = 1; else if (k.has('ArrowUp')) dy = -1; else if (k.has('ArrowDown')) dy = 1;
    if (dx || dy) {
      state.kb = true;
      const p = v3.on && v3.sq ? v3.sq(state.cursor) : L.sq(state.cursor), n = sqAt(L, p.x + dx * L.cell, p.y + dy * L.cell * (v3.on ? 0.78 : 1));
      if (n >= 0) state.cursor = n;
      return null;
    }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; return pressSquare(state.cursor); }
    return null;
  }

  function lessonGoalMet(l, m) {
    const goal = l.goal;
    if (goal.type === 'drop') return m.kind === 'drop' && m.to === goal.to;
    if (goal.type === 'to') return m.kind === 'step' && m.to === goal.to;
    if (goal.type === 'capture') return m.kind === 'jump';
    if (goal.type === 'bonus') return m.kind === 'jump' && m.bonus === goal.at;
    return false;
  }
  function updateLesson(dt, tap, p) {
    const L = state.lesson, l = LESSONS[L.i], BTN = lay().BTN;
    if (state.anim) { state.anim.t += dt; animSounds(state.anim); if (state.anim.t >= state.anim.dur) state.anim = null; return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; state.msg = null; state.pend = null; return; }
    if (L.done) {
      if (tap && inRect(BTN.next, tap.x, tap.y)) {
        if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try a game against the computer.', 7); }
      }
      return;
    }
    if (!p.pressed) return;
    const m = pressSquare(sqAt(lay(), p.x, p.y)); if (!m) return;
    if (lessonGoalMet(l, m)) {
      play(m); state.game.winner = 0; L.done = true; state.msg = null; tone({ freq: 660, to: 990, dur: 0.22, type: 'triangle', vol: 0.09 });
    } else { state.sel = -1; state.selMoves = []; state.pend = null; say(l.hint, 5); }
  }

  function keyboardTap(input) {
    const k = input.keys.pressed, sc = state.scene, L = lay();
    if (input.pointer.pressed) { state.kb = false; return null; }
    const at = (r) => ({ x: r.x + 5, y: r.y + 5 });
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) return at(L.title(!!state.saved).rows.play); return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return at(L.over.again); if (k.has('Escape')) return at(L.over.back); return null; }
    if ((sc === 'play' || sc === 'lesson') && k.has('Escape')) return at(L.BTN.menu);
    return null;
  }

  // Developer / screenshot hook (used with ?shot=1&scene=... by main.js; never reachable by a player).
  function devScene(spec) {
    state.frozen = true; if (spec.textScale !== undefined) state.textScaleIdx = spec.textScale;
    if (spec.look) state.board = spec.look; if (spec.style) state.style = spec.style; if (spec.calm !== undefined) state.calm = spec.calm;
    if (spec.level !== undefined) state.level = spec.level;
    if (spec.human) state.humanSide = spec.human;
    const find = (g, from, to) => (from < 0 ? { kind: 'drop', from: -1, to, cap: -1, bonus: NO_BONUS } : legalFrom(g, from).find((x) => x.to === to));
    if (spec.scene === 'title') { state.scene = 'title'; if (spec.saved) state.saved = { game: newGame() }; }
    else if (spec.scene === 'doc') { openDoc(spec.doc || 'rules'); state.doc.scroll = spec.scroll || 0; }
    else if (spec.scene === 'lesson') {
      startLesson(spec.lesson || 0);
      if (spec.play) { const m = find(state.game, spec.play[0], spec.play[1]); if (m) { play({ ...m, bonus: spec.play[2] ?? NO_BONUS }); state.lesson.done = true; state.game.winner = 0; state.anim.t = spec.animT ?? 0; } }
    } else if (spec.scene === 'play' || spec.scene === 'over' || spec.scene === 'auto') {
      if (spec.scene === 'auto') startAuto(); else startGame(!!spec.two);
      state.msg = null; state.think = 99;
      const g = state.game;
      if (spec.board) { setupBoard(g, spec.board, spec.hand, spec.turn || 1); g.lost = spec.lost || [0, 0, 0]; g.moves = spec.moves || 0; }
      else for (let n = 0; n < (spec.plies || 0) && !g.winner; n++) { const mv = createThinker(g, 1, rng); let r; do { r = mv.step(); } while (r.move === undefined); if (!r.move) break; applyMove(g, r.move); }
      if (spec.play) { state.undo = []; const m = find(g, spec.play[0], spec.play[1]); if (m) { play({ ...m, bonus: spec.play[2] ?? NO_BONUS }); state.anim.t = (spec.animT ?? 0) * state.anim.k; } }
      state.dangerAt = -1; dangerSet();
      if (spec.sel !== undefined && spec.sel >= 0) { state.sel = spec.sel; refreshSel(); }
      if (spec.pend) { state.pend = { move: find(g, spec.pend[0], spec.pend[1]), opts: bonusOptions(g.board, g.hand, g.turn, find(g, spec.pend[0], spec.pend[1])) }; state.sel = spec.pend[0]; state.selMoves = []; }
      if (spec.hint) { state.hint = { from: spec.hint[0], to: spec.hint[1], bonus: spec.hint[2] ?? NO_BONUS, t: 0 }; }
      if (spec.msg) say(spec.msg, 99);
      if (spec.scene === 'auto') { state.autoPaused = !!spec.paused; }
      if (spec.scene === 'over') { if (!g.winner) { g.winner = spec.winner || 1; g.reason = spec.reason || 'Every enemy pebble has been captured.'; } state.scene = 'over'; state.result = { winner: g.winner, reason: g.reason }; state.anim = null; }
    }
    state.sceneT = 1; lastScene = state.scene;
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.scene !== 'doc') wheelInput.dy = 0;
      if (state.msg && !(state.autoMode && state.autoPaused)) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      if (state.frozen) return;
      const p = input.pointer, kbd = keyboardTap(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      if (state.scene === 'title') updateTitle(tap);
      else if (state.scene === 'doc') updateDoc(tap, input);
      else if (state.scene === 'play') updatePlay(dt, tap, p, input);
      else if (state.scene === 'lesson') updateLesson(dt, tap, p);
      else if (state.scene === 'over' && tap) {
        const O = lay().over;
        if (inRect(O.again, tap.x, tap.y)) { if (state.autoMode) startAuto(); else startGame(state.two); }
        else if (inRect(O.back, tap.x, tap.y)) { state.autoMode = false; state.msg = null; state.scene = 'title'; }
      }
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, state.flip);
      // the kit's "Preview 1:23" pill: top centre in portrait; in landscape it moves into the right-hand card, clear of the board
      meta.previewBadge = L.land && L.rightCard ? { x: L.rightCard.x + L.rightCard.w / 2, y: L.rightCard.y + 74, align: 'center' } : undefined;
      render(ctx, state, L);
    },
    getState: () => state,
    devScene,
    // kit 1.6.1: the free-preview timer counts real play only - a live game in progress. Menus, Rules, lessons, Auto Play, results and
    // the demo-limit screen are exempt.
    isPreviewExempt() { return !(state.scene === 'play' && !state.autoMode && !state.game.winner); },
  };
}
export { pieceCount, COLS, HAND_BONUS };
