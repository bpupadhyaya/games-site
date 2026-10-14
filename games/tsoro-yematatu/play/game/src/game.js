// Tsoro Yematatu. State and flow. Drawing is in view.js, the rule book in rules.js, the computer's brain in ai.js, text in content.js.
//
// How a move is made: while stones are still to be placed, tap an empty point and a stone drops there. Once all are down, tap one of your
// stones (it lifts and its reachable points glow), then tap the point - or drag the stone onto it. A line wins the moment it is made.
import { layoutFor, TEXT_SCALES, THINK_STEPS, inRect, setActivePoints } from './layout.js';
import { newGame, clone, applyMove, tryMove, legalFrom, legalMoves, threats, describeMove, inDrop, variantOf, VARIANT_KEYS, NAMES, pointName } from './rules.js';
import { LEVELS, createThinker } from './ai.js';
import { LESSONS } from './content.js';
import { BOARD_KEYS, STYLE_KEYS } from './art.js';
import { render, ui, docMetrics } from './view.js';
import { v3 } from './v3.js';

// Fluid viewport (kit 1.7.0): the short side is always 720 units and the long side follows the screen, in portrait and landscape.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
// Mouse-wheel travel (virtual units) collected by main.js and consumed by the document screens; empty in headless runs.
export const wheelInput = { dy: 0 };
const DEMO_GAMES = 2, HINTS_PER_GAME = 3, AUTO_REVEAL_SECS = 2, WIN_HOLD = 1.1;
const toGame = (v, key) => {                                         // a saved game back into a live one
  const V = variantOf(key), g = newGame(key);
  g.board = Int8Array.from(v.board); g.turn = v.turn; g.placed = v.placed.slice(); g.moves = v.moves; g.seen = { ...(v.seen || {}) }; g.last = v.last || null; g.winner = 0;
  return g.board.length === V.n ? g : null;
};
const toSave = (g) => ({ variant: g.variant, board: Array.from(g.board), turn: g.turn, placed: g.placed.slice(), moves: g.moves, seen: { ...g.seen }, last: g.last ? { ...g.last } : null, winner: g.winner });

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, sceneT: 1, game: newGame('classic'), variant: 'classic', humanSide: 1, two: false, level: 2, flip: false,
    marks: true, sound: true, calm: false, board: 'granite', style: 'pebble', textScaleIdx: 0, autoThinkIdx: 1,
    sel: -1, selMoves: [], drag: null, anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS_PER_GAME, threat: new Set(), threatAt: -1,
    cursor: 2, kb: false, stats: { games: 0, wins: 0, stars: {} }, saved: null, learned: false, demoGames: 0, lesson: null, result: null, winT: 0,
    doc: { kind: 'rules', scroll: 0 }, autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false, frozen: false, dev: config.dev === true,
    lockupRect: null,
  };
  let thinker = null, hintThinker = null, lastScene = state.scene, drag0 = null, docDrag = null;
  const lay = () => layoutFor(meta.width, meta.height, state.flip);
  const syncPoints = () => setActivePoints(variantOf(state.game.variant).pts);
  syncPoints();

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    state.level = Math.max(0, Math.min(LEVELS.length - 1, v.level ?? 2)); state.humanSide = v.humanSide === 2 ? 2 : 1;
    state.marks = v.marks ?? true; state.sound = v.sound ?? true; state.calm = v.calm ?? false;
    if (VARIANT_KEYS.includes(v.variant)) { state.variant = v.variant; if (state.scene === 'title') { state.game = newGame(v.variant); syncPoints(); } }
    if (BOARD_KEYS.includes(v.board)) state.board = v.board; if (STYLE_KEYS.includes(v.style)) state.style = v.style;
    state.textScaleIdx = Math.max(0, Math.min(TEXT_SCALES.length - 1, v.textScaleIdx ?? 0)); state.autoThinkIdx = Math.max(0, Math.min(THINK_STEPS.length - 1, v.autoThinkIdx ?? 1));
    audio.setMuted?.(!state.sound);
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, stars: { ...(v.stars || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  state.owned = !!monetization.owns?.('unlock_game'); state.restoreMsg = ''; state.restoreBusy = false; state.showRestore = !config.demo;
  monetization.onChange?.(() => { state.owned = !!monetization.owns?.('unlock_game'); });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && v.game.board && VARIANT_KEYS.includes(v.game.variant) && v.game.board.length === variantOf(v.game.variant).n && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, humanSide: state.humanSide, marks: state.marks, sound: state.sound, calm: state.calm, board: state.board, style: state.style, variant: state.variant, textScaleIdx: state.textScaleIdx, autoThinkIdx: state.autoThinkIdx });
  const saveGame = () => { if (state.scene === 'play' && !state.autoMode && !state.game.winner) { state.saved = { game: toSave(state.game), humanSide: state.humanSide, two: state.two, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const dur = (d) => (state.calm ? d * 0.5 : d);
  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound && !state.autoMode) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.8, to: f * 0.36, dur: 0.07, type: 'sine', vol: 0.12 });
  const reset = (extra) => Object.assign(state, { sel: -1, selMoves: [], drag: null, anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS_PER_GAME, autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false, threatAt: -1, result: null, winT: 0 }, extra);
  const threatSet = () => {                                          // points where the side NOT to move would complete a line if it were its turn
    const g = state.game, key = g.moves * 4 + g.turn;
    if (state.threatAt !== key) { state.threatAt = key; state.threat = g.winner ? new Set() : threats(g, 3 - g.turn); }
    return state.threat;
  };
  const humanTurn = () => !state.autoMode && !state.game.winner && (state.two || state.game.turn === state.humanSide);
  const sideName = (s) => NAMES[s];

  // ---- starting things
  function begin(game) { state.game = game; syncPoints(); }
  function startGame(two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    thinker = hintThinker = null;
    reset({ scene: 'play', two, flip: !two && state.humanSide === 2 });
    begin(newGame(state.variant));
    clearSave();
    const V = variantOf(state.variant);
    say(two ? `Sun moves first. Tap an empty point to drop a stone (${V.stones} each).` : state.humanSide === 1 ? 'You are Sun and move first. Tap an empty point to drop a stone.' : 'You are River. Sun moves first.', 5);
    if (!two && state.humanSide === 2) state.think = 0.6;
    monetization.track('game_start', { level: state.level, two, variant: state.variant });
  }
  function startAuto() {
    thinker = hintThinker = null;
    reset({ scene: 'play', two: false, flip: false, autoMode: true });
    begin(newGame(state.variant));
    say('Auto Play: the computer plays both sides. Watch, then compare with your own guess.', 999);
  }
  function resume() {
    const v = state.saved; thinker = hintThinker = null;
    const g = toGame(v.game, v.game.variant);
    if (!g) { clearSave(); return; }
    state.variant = g.variant;
    reset({ scene: 'play', humanSide: v.humanSide, two: v.two, level: v.level ?? state.level, hintsLeft: v.hintsLeft ?? HINTS_PER_GAME, flip: !v.two && v.humanSide === 2 });
    begin(g);
    say('Game restored.');
    if (!humanTurn()) state.think = 0.5;
  }
  function startLesson(i) {
    const l = LESSONS[i], g = newGame(l.variant);
    for (const [p, s] of Object.entries(l.stones)) g.board[+p] = s;
    g.placed = [0, l.placed[0], l.placed[1]]; g.turn = 1;
    thinker = hintThinker = null;
    reset({ scene: 'lesson', two: true, flip: false, lesson: { i, done: false } });
    begin(g);
  }

  // ---- moves
  function refreshSel() {
    const g = state.game;
    state.selMoves = state.sel >= 0 && !inDrop(g) ? legalFrom(g, state.sel).map((m) => ({ to: m.to, move: m })) : [];
  }
  function play(m) {
    const g = state.game, side = g.turn;
    applyMove(g, m);
    state.anim = { kind: m.kind, from: m.from, to: m.to, side, t: 0, dur: dur(m.kind === 'drop' ? 0.36 : 0.3), landed: false };
    state.sel = -1; state.selMoves = []; state.drag = null; state.hint = null;
    tone({ freq: 700, to: 500, dur: 0.05, type: 'triangle', vol: 0.04 });
  }
  function animSounds(a) {
    if (!a.landed && a.t >= a.dur * (a.kind === 'drop' ? 0.78 : 0.9)) { a.landed = true; clack(a.kind === 'drop' ? 360 : 440); }
  }
  // After a move has landed: tell the player about a threat.
  function afterMove() {
    const g = state.game;
    if (g.winner) { state.winT = 0; return; }
    if (state.scene === 'play' && !state.autoMode && state.marks && humanTurn()) {
      const t = threatSet();
      if (t.size && !(state.msg && state.msg.t < 1)) say(`${sideName(3 - g.turn)} can make a line on ${[...t].slice(0, 2).map((p) => pointName(g.variant, p)).join(' or ')}. Block it, or make your own first.`, 5);
    }
  }
  function finish() {
    const g = state.game;
    state.scene = 'over'; state.result = { winner: g.winner, reason: g.reason, line: g.line };
    if (!state.autoMode) {
      state.stats.games += 1; clearSave();
      if (!state.two && g.winner === state.humanSide) { state.stats.wins += 1; state.stats.stars['l' + state.level] = true; }
      storage.set('stats', state.stats);
      monetization.track('game_end', { winner: g.winner, moves: g.moves, level: state.level });
    }
    const w = g.winner === 3 ? 330 : 523;
    tone({ freq: w, to: g.winner === 3 ? 330 : 784, dur: 0.45, type: 'triangle', vol: 0.1 });
  }

  // What a press on point i means for the player to move. Returns the legal move chosen, or null.
  function pressPoint(i) {
    const g = state.game, me = g.turn;
    if (i < 0) { state.sel = -1; refreshSel(); return null; }
    if (inDrop(g)) {
      if (g.board[i]) { say('That point is taken. Tap an empty point to drop a stone.'); return null; }
      return { kind: 'drop', from: -1, to: i };
    }
    if (state.sel >= 0 && i === state.sel) { state.sel = -1; refreshSel(); return null; }
    if (state.sel >= 0) { const hit = state.selMoves.find((m) => m.to === i); if (hit) return hit.move; }
    if (g.board[i] === me) { state.sel = i; refreshSel(); clack(600); drag0 = null; if (!state.selMoves.length) say('That stone is blocked: every point next to it is taken. Try another.'); return null; }
    if (state.sel >= 0) {
      if (g.board[i]) say(`That is ${sideName(3 - me)}’s stone. Tap a glowing point.`);
      else { const r = tryMove(g, state.sel, i); say(r.error || 'That move is not allowed.'); tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.06 }); }
      return null;
    }
    if (g.board[i]) say(`It is ${sideName(me)}’s turn. Tap one of the ${me === 1 ? 'amber' : 'blue'} stones.`);
    else say('First tap one of your stones, then the point it should slide to.');
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
      if (state.restoreBusy || state.owned) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore()).then(() => {
        state.owned = !!monetization.owns?.('unlock_game');
        state.restoreMsg = state.owned ? 'Purchase restored. Full game unlocked.' : 'No earlier purchase found.';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
      clack(); return;
    }
    if (id === 'level') state.level = v; else if (id === 'side') state.humanSide = v;
    else if (id === 'variant') { state.variant = v; state.game = newGame(v); syncPoints(); }
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
      const m = state.autoMove; if (m) state.hint = { from: m.from, to: m.to, t: 0 };
      state.autoPhase = 'reveal'; state.autoTimer = AUTO_REVEAL_SECS;
      say(m ? `This is the move: ${describeMove(state.game, m)}.` : 'This is the move.', AUTO_REVEAL_SECS + 0.5); return;
    }
    if (!thinker) { thinker = createThinker(state.game, Math.max(2, state.level), rng); state.thinking = true; }
    const r = thinker.step(); if (r.move === undefined) return;
    thinker = null; state.thinking = false; state.autoMove = r.move; state.autoPhase = 'think'; state.autoTimer = THINK_STEPS[state.autoThinkIdx];
    say(`${sideName(state.game.turn)} is thinking. What would you play?`, state.autoTimer + AUTO_REVEAL_SECS + 1);
  }

  const settle = () => { state.anim = null; threatSet(); if (state.game.winner) afterMove(); };
  function updatePlay(dt, tap, p, input) {
    const BTN = lay().BTN, g = state.game;
    if (state.autoMode) {
      if (tap && inRect(BTN.auto.exit, tap.x, tap.y)) { state.autoMode = false; state.autoPhase = null; state.autoMove = null; state.autoPaused = false; state.msg = null; state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return; }
      if (tap && inRect(BTN.auto.pause, tap.x, tap.y)) { state.autoPaused = !state.autoPaused; return; }
      if (tap && inRect(BTN.auto.dec, tap.x, tap.y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx--; savePrefs(); } return; }
      if (tap && inRect(BTN.auto.inc, tap.x, tap.y)) { if (state.autoThinkIdx < THINK_STEPS.length - 1) { state.autoThinkIdx++; savePrefs(); } return; }
      if (state.autoPaused) return;                                       // freezes the loop, the search, any move in flight and the captions
      if (state.hint) { state.hint.t += dt; if (state.hint.t > 4) state.hint = null; }
      if (state.anim) { state.anim.t += dt; animSounds(state.anim); if (state.anim.t >= state.anim.dur) settle(); return; }
      if (g.winner) { state.winT += dt; if (state.winT > WIN_HOLD) finish(); return; }
      autoTick(dt); return;
    }
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 8) state.hint = null; }
    if (state.anim) {
      state.anim.t += dt; animSounds(state.anim);
      if (state.anim.t >= state.anim.dur) { settle(); if (!g.winner) { saveGame(); afterMove(); if (!humanTurn()) state.think = 0.35; } }
      return;
    }
    if (g.winner) { state.winT += dt; if (state.winT > WIN_HOLD) finish(); return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.msg = null; state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return; }
    if (!humanTurn()) {
      state.think -= dt; if (state.think > 0) return;
      if (!thinker) { thinker = createThinker(g, state.level, rng); state.thinking = true; }
      const r = thinker.step();
      if (r.move !== undefined) { thinker = null; state.thinking = false; if (r.move) play(r.move); }
      return;
    }
    threatSet();
    if (hintThinker) {
      const r = hintThinker.step();
      if (r.move !== undefined) { hintThinker = null; state.thinking = false; if (r.move) { state.hint = { from: r.move.from, to: r.move.to, t: 0 }; say(`Hint: ${describeMove(g, r.move)}.`, 7); } }
      return;
    }
    if ((tap && inRect(BTN.undo, tap.x, tap.y)) || input.keys.pressed.has('KeyU')) {
      if (state.undo.length) { state.game = state.undo.pop().game; state.sel = -1; state.selMoves = []; state.hint = null; state.threatAt = -1; say('Move taken back.'); clack(360); saveGame(); } else say('Nothing to take back yet.');
      return;
    }
    if ((tap && inRect(BTN.hint, tap.x, tap.y)) || input.keys.pressed.has('KeyH')) {
      if (state.hintsLeft <= 0) say('No hints left in this game.');
      else { state.hintsLeft -= 1; hintThinker = createThinker(g, 3, rng); state.thinking = true; state.sel = -1; state.selMoves = []; say('Looking for a good move...', 6); }
      return;
    }
    // board: tap to drop / select / move, or press-drag-release
    const L = lay(); let m = null;
    if (p.pressed) { m = pressPoint(v3.on && v3.pick ? v3.pick(p.x, p.y) : L.squareAt(p.x, p.y)); drag0 = state.sel >= 0 && !m ? { x: p.x, y: p.y } : null; }
    if (!m && p.down && drag0 && state.sel >= 0) { if (state.drag || Math.hypot(p.x - drag0.x, p.y - drag0.y) > L.cell * 0.28) state.drag = { x: p.x, y: p.y }; }
    if (!m && p.released && drag0) {
      if (state.drag) {
        const i = v3.on && v3.pick ? v3.pick(p.x, p.y) : L.squareAt(p.x, p.y); state.drag = null;
        if (i >= 0 && i !== state.sel) { const hit = state.selMoves.find((q) => q.to === i); if (hit) m = hit.move; else if (state.game.board[i] === 0) { const r = tryMove(state.game, state.sel, i); say(r.error); } }
      }
      drag0 = null;
    }
    if (!p.down) { state.drag = null; }
    if (!m) { const k = keyMove(input); if (k) m = k; }
    if (m) { state.undo.push({ game: clone(state.game) }); play(m); }
  }

  function keyMove(input) {
    const k = input.keys.pressed; let dx = 0, dy = 0;
    if (k.has('ArrowLeft')) dx = -1; else if (k.has('ArrowRight')) dx = 1; else if (k.has('ArrowUp')) dy = -1; else if (k.has('ArrowDown')) dy = 1;
    if (dx || dy) {                                                      // the nearest point in that direction
      state.kb = true; const pts = variantOf(state.game.variant).pts, c = pts[state.cursor] || pts[0]; let best = -1, bs = 1e9;
      pts.forEach((q, i) => { const vx = q.x - c.x, vy = q.y - c.y, along = vx * dx + vy * dy, side = Math.abs(vx * dy - vy * dx); if (i !== state.cursor && along > 0.02) { const s = along + side * 2; if (s < bs) { bs = s; best = i; } } });
      if (best >= 0) state.cursor = best;
      return null;
    }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; return pressPoint(state.cursor); }
    return null;
  }

  function updateLesson(dt, tap, p) {
    const L = state.lesson, l = LESSONS[L.i], BTN = lay().BTN;
    if (state.anim) { state.anim.t += dt; animSounds(state.anim); if (state.anim.t >= state.anim.dur) state.anim = null; return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; state.msg = null; begin(newGame(state.variant)); return; }
    if (L.done) {
      if (tap && inRect(BTN.next, tap.x, tap.y)) {
        if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; begin(newGame(state.variant)); say('You know the game. Try a game against the computer.', 7); }
      }
      return;
    }
    if (!p.pressed) return;
    const m = pressPoint(v3.on && v3.pick ? v3.pick(p.x, p.y) : lay().squareAt(p.x, p.y)); if (!m) return;
    const goal = l.goal;
    const ok = goal.type === 'to' ? m.to === goal.to : m.from === goal.from && m.to === goal.to;
    if (ok) { play(m); state.game.winner = 0; L.done = true; state.msg = null; tone({ freq: 660, to: 990, dur: 0.22, type: 'triangle', vol: 0.09 }); }
    else { state.sel = -1; state.selMoves = []; say(l.hint, 5); }
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
    if (spec.variant) { state.variant = spec.variant; state.game = newGame(spec.variant); syncPoints(); }
    if (spec.scene === 'title') { state.scene = 'title'; if (spec.saved) state.saved = { game: toSave(newGame(state.variant)) }; }
    else if (spec.scene === 'doc') { openDoc(spec.doc || 'rules'); state.doc.scroll = spec.scroll || 0; }
    else if (spec.scene === 'lesson') { startLesson(spec.lesson || 0); if (spec.play) { const m = legalMoves(state.game).find((x) => x.from === spec.play[0] && x.to === spec.play[1]); if (m) { play(m); state.lesson.done = true; state.game.winner = 0; state.anim.t = spec.animT ?? 0; } } }
    else if (spec.scene === 'play' || spec.scene === 'over' || spec.scene === 'auto') {
      if (spec.scene === 'auto') startAuto(); else startGame(!!spec.two);
      state.msg = null; state.think = 99;
      const g = state.game;
      if (spec.stones) { g.board.fill(0); for (const [p, s] of Object.entries(spec.stones)) g.board[+p] = s; g.placed = spec.placed ? [0, spec.placed[0], spec.placed[1]] : [0, 3, 3]; g.turn = spec.turn || 1; g.moves = spec.moves || 6; g.seen = {}; g.last = spec.last || null; }
      else for (let n = 0; n < (spec.plies || 0) && !g.winner; n++) { const mv = createThinker(g, 1, rng); let r; do { r = mv.step(); } while (r.move === undefined); if (!r.move) break; applyMove(g, r.move); }
      if (spec.play) { state.undo = []; const m = legalMoves(g).find((x) => x.from === spec.play[0] && x.to === spec.play[1]); if (m) { play(m); state.anim.t = spec.animT ?? 0; } }
      state.threatAt = -1; threatSet();
      if (spec.sel !== undefined && spec.sel >= 0) { state.sel = spec.sel; refreshSel(); }
      if (spec.hint) { state.hint = { from: spec.hint[0], to: spec.hint[1], t: 0 }; }
      if (spec.msg) { say(spec.msg, 99); state.msg.t = 1; }
      if (spec.scene === 'auto') { state.autoPaused = !!spec.paused; }
      if (spec.winLine) { g.line = spec.winLine; g.winner = spec.winner || g.board[spec.winLine[0]] || 1; g.reason = `${sideName(g.winner)} made three in a row.`; state.anim = null; state.winT = spec.winT ?? 0.6; }
      if (spec.scene === 'over') {
        if (!g.winner) { g.winner = spec.winner || 1; g.reason = spec.reason || `${sideName(g.winner)} made three in a row.`; }
        state.scene = 'over'; state.result = { winner: g.winner, reason: g.reason, line: g.line }; state.anim = null;
      }
    }
    state.sceneT = 1; lastScene = state.scene;
  }

  return {
    update(dt, input) {
      state.t += dt; syncPoints();
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
        else if (inRect(O.back, tap.x, tap.y)) { state.autoMode = false; state.msg = null; state.scene = 'title'; begin(newGame(state.variant)); }
      }
    },
    render(ctx, view) {
      syncPoints();
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, state.flip);
      // the kit's "Preview 1:23" pill: top centre in portrait; in landscape it moves into the right-hand card, clear of the board
      // portrait: the top-right corner of the opponent's plate (the plate's text sits left of it), never over the title or the board
      if (L.land && L.layoutKind === 'wide1' && L.plateTop && L.plateTop.w >= 300) meta.previewBadge = { x: L.plateTop.x + L.plateTop.w - 10, y: L.plateTop.y + 8, align: 'right' };
      else if (L.layoutKind === 'wide2' && L.rightCard) meta.previewBadge = { x: L.rightCard.x + L.rightCard.w / 2, y: L.rightCard.y + 74, align: 'center' };
      else if (L.layoutKind === 'portrait' && L.plateTop) meta.previewBadge = { x: L.plateTop.x + L.plateTop.w - 14, y: L.plateTop.y + 10, align: 'right' };
      else if (L.msg) meta.previewBadge = { x: L.msg.x + L.msg.w - 6, y: L.msg.y + L.msg.h - 26, align: 'right' };
      else meta.previewBadge = undefined;
      render(ctx, state, L);
    },
    getState: () => state,
    devScene,
    // kit 1.6.1: the free-preview timer counts real play only - a live game in progress. Menus, Rules, lessons, Auto Play, results and
    // the demo-limit screen are exempt.
    isPreviewExempt() { return !(state.scene === 'play' && !state.autoMode && !state.game.winner); },
  };
}
