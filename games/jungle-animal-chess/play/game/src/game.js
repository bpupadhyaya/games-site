// Jungle (Dou Shou Qi). State and flow. Drawing is in view.js, the rule book in rules.js, the computer's brain in ai.js, text in content.js.
//
// How a move is made: tap an animal (it lifts and its legal squares glow; squares that eat are ringed in red, lake leaps get an arrow), then
// tap the square - or drag the animal onto it. A refused move says why. Moves glide (or leap, or swim), then a capture puffs the eaten token away.
import { layoutFor, TEXT_SCALES, THINK_STEPS, inRect } from './layout.js';
import { newGame, clone, applyMove, tryMove, legalFrom, endangered, describeMove, pieceOf, rankOf, sideOf, NAMES, ANIMALS, TERR, WATER } from './rules.js';
import { LEVELS, createThinker } from './ai.js';
import { LESSONS } from './content.js';
import { STYLE_KEYS } from './settings.js';
import { THEME_KEYS } from './art.js';
import { render, ui, docMetrics } from './view.js';

// Fluid viewport (kit 1.7.0): the short side is always 720 units and the long side follows the screen, in portrait and landscape.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
// Mouse-wheel travel (virtual units) collected by main.js and consumed by the document screens; empty in headless runs.
export const wheelInput = { dy: 0 };
const DEMO_GAMES = 2, HINTS_PER_GAME = 3, AUTO_REVEAL_SECS = 2;

// Board text rows (7 characters x 9): digits 1-8 are Red animals, letters a-h are Blue animals (a = rat .. h = elephant), anything else is empty.
export function parseBoard(rows) {
  return rows.join('').split('').map((ch) => (ch >= '1' && ch <= '8' ? pieceOf(1, +ch) : ch >= 'a' && ch <= 'h' ? pieceOf(2, ch.charCodeAt(0) - 96) : 0));
}

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, sceneT: 1, game: newGame(), humanSide: 1, two: false, level: 2, flip: false,
    marks: true, sound: true, calm: false, theme: 'meadow', style: 'classic', textScaleIdx: 0, autoThinkIdx: 1,
    sel: -1, selMoves: [], drag: null, anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS_PER_GAME, danger: new Set(), dangerAt: -1,
    cursor: 59, kb: false, stats: { games: 0, wins: 0, stars: {} }, saved: null, learned: false, demoGames: 0, lesson: null, result: null,
    doc: { kind: 'rules', scroll: 0 }, autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false, frozen: false, dev: config.dev === true,
    lockupRect: null,
  };
  let thinker = null, hintThinker = null, lastScene = state.scene, drag0 = null, docDrag = null;
  const lay = () => layoutFor(meta.width, meta.height, state.flip);

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    state.level = Math.max(0, Math.min(LEVELS.length - 1, v.level ?? 2)); state.humanSide = v.humanSide === 2 ? 2 : 1;
    state.marks = v.marks ?? true; state.sound = v.sound ?? true; state.calm = v.calm ?? false;
    if (THEME_KEYS.includes(v.theme)) state.theme = v.theme; if (STYLE_KEYS.includes(v.style)) state.style = v.style;
    state.textScaleIdx = Math.max(0, Math.min(TEXT_SCALES.length - 1, v.textScaleIdx ?? 0)); state.autoThinkIdx = Math.max(0, Math.min(THINK_STEPS.length - 1, v.autoThinkIdx ?? 1));
    audio.setMuted?.(!state.sound);
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, stars: { ...(v.stars || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && !v.game.winner && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, humanSide: state.humanSide, marks: state.marks, sound: state.sound, calm: state.calm, theme: state.theme, style: state.style, textScaleIdx: state.textScaleIdx, autoThinkIdx: state.autoThinkIdx });
  const saveGame = () => { if (state.scene === 'play' && !state.autoMode && !state.game.winner) { state.saved = { game: clone(state.game), humanSide: state.humanSide, two: state.two, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const dur = (d) => (state.calm ? d * 0.6 : d);
  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound && !state.autoMode) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.8, to: f * 0.36, dur: 0.07, type: 'sine', vol: 0.12 });
  const reset = (extra) => Object.assign(state, { sel: -1, selMoves: [], drag: null, anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS_PER_GAME, autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false, dangerAt: -1, result: null }, extra);
  const dangerSet = () => {
    const g = state.game;
    if (state.dangerAt !== g.moves) { state.dangerAt = g.moves; state.danger = g.winner ? new Set() : endangered(g, state.two || state.autoMode ? g.turn : state.humanSide); }
    return state.danger;
  };

  // ---- starting things
  function startGame(two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    thinker = hintThinker = null;
    reset({ scene: 'play', game: newGame(), two, flip: !two && state.humanSide === 2 });
    clearSave();
    say(two ? 'Red moves first. Tap an animal, then a square.' : state.humanSide === 1 ? 'You are Red and move first. Tap an animal.' : 'You are Blue. Red moves first.', 5);
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
  function startLesson(i) {
    const l = LESSONS[i], g = newGame();
    g.board = parseBoard(l.board); g.seen = {}; g.turn = 1;
    thinker = hintThinker = null;
    reset({ scene: 'lesson', game: g, two: true, flip: false, lesson: { i, done: false } });
  }
  const humanTurn = () => !state.autoMode && !state.game.winner && (state.two || state.game.turn === state.humanSide);

  // ---- moves
  function refreshSel() {
    state.selMoves = state.sel >= 0 ? legalFrom(state.game, state.sel) : [];
  }
  function play(m) {
    const g = state.game, side = g.turn, piece = g.board[m.from], rank = rankOf(piece), cap = g.board[m.to];
    const res = applyMove(g, m), swim = rank === 1 && (TERR[m.to] === WATER || TERR[m.from] === WATER);
    state.anim = { from: m.from, to: m.to, side, rank, cap, capRank: rankOf(cap), t: 0, glide: dur(res.jump ? 0.5 : 0.3), jump: res.jump, swim, landed: false, popped: false };
    state.anim.dur = state.anim.glide + (cap ? 0.7 : 0.14);
    state.sel = -1; state.selMoves = []; state.drag = null; state.hint = null;
    tone({ freq: 700, to: 500, dur: 0.05, type: 'triangle', vol: 0.04 });
    if (state.scene === 'play' && !state.autoMode && !g.winner) {
      if (g.quiet === 80) say('40 moves each without eating anything. At 50 the side with the stronger animals wins.', 6);
      if (cap) {                                                   // the tutor says what just happened
        const a = ANIMALS[rank], b = ANIMALS[rankOf(cap)];
        say(state.two ? `${NAMES[side]}'s ${a.toLowerCase()} ate the ${b.toLowerCase()}.` : side === state.humanSide ? `Your ${a.toLowerCase()} ate the ${b.toLowerCase()}.` : `The computer's ${a.toLowerCase()} ate your ${b.toLowerCase()}. Take back to try again.`, 4);
      }
    }
  }
  function animSounds(a) {
    if (!a.landed && a.t >= a.glide) {
      a.landed = true;
      if (a.swim) tone({ freq: 500, to: 220, dur: 0.18, type: 'sine', vol: 0.1 });
      else if (a.jump) tone({ freq: 260, to: 120, dur: 0.14, type: 'sine', vol: 0.12 });
      else clack(a.cap ? 300 : 420);
      if (a.cap) tone({ freq: 140, to: 60, dur: 0.16, type: 'sine', vol: 0.12 });
    }
    if (a.cap && !a.popped && a.t >= a.glide + 0.08) { a.popped = true; tone({ freq: 880, to: 1500, dur: 0.14, type: 'triangle', vol: 0.07 }); }
  }
  function finish() {
    const g = state.game;
    state.scene = 'over'; state.result = { winner: g.winner, reason: g.reason };
    if (!state.autoMode && state.scene === 'over') {
      state.stats.games += 1; clearSave();
      if (!state.two && g.winner === state.humanSide) { state.stats.wins += 1; state.stats.stars['l' + state.level] = true; }
      storage.set('stats', state.stats);
      monetization.track('game_end', { winner: g.winner, moves: g.moves, level: state.level });
    }
    const w = g.winner === 3 ? 330 : 523;
    tone({ freq: w, to: g.winner === 3 ? 330 : 784, dur: 0.45, type: 'triangle', vol: 0.1 });
  }

  // What a press on board square i means for the player to move. Returns the legal move chosen, or null.
  function pressSquare(i) {
    const g = state.game, me = g.turn;
    if (i < 0) { state.sel = -1; refreshSel(); return null; }
    if (state.sel >= 0 && i === state.sel) { state.sel = -1; refreshSel(); return null; }
    if (state.sel >= 0 && state.selMoves.some((m) => m.to === i)) { const q = state.selMoves.find((m) => m.to === i); return { from: state.sel, to: i, jump: q.jump }; }
    if (sideOf(g.board[i]) === me) { state.sel = i; refreshSel(); clack(600); drag0 = null; return null; }
    if (state.sel >= 0) {
      const r = tryMove(g, state.sel, i); say(r.error || 'That move is not allowed.', 5); tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.06 });
      return null;
    }
    if (g.board[i]) say(`It is ${NAMES[me]}'s turn. Tap one of the ${NAMES[me].toLowerCase()} animals.`);
    else say('First tap an animal, then the square it should go to.');
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
    if (id === 'level') state.level = v; else if (id === 'side') state.humanSide = v;
    else if (id === 'marks') state.marks = !!v; else if (id === 'sound') { state.sound = !!v; audio.setMuted?.(!state.sound); } else if (id === 'calm') state.calm = !!v;
    else if (id === 'theme') state.theme = v; else if (id === 'style') state.style = v;
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
      say(m ? `This is the move. ${describeMove(state.game, m)}` : 'This is the move.', AUTO_REVEAL_SECS + 0.5); return;
    }
    if (!thinker) { thinker = createThinker(state.game, Math.max(2, state.level), rng); state.thinking = true; }
    const r = thinker.step(); if (r.move === undefined) return;
    thinker = null; state.thinking = false; state.autoMove = r.move; state.autoPhase = 'think'; state.autoTimer = THINK_STEPS[state.autoThinkIdx];
    say(`${NAMES[state.game.turn]} is thinking. What would you play?`, state.autoTimer + AUTO_REVEAL_SECS + 1);
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
      if (state.anim) { state.anim.t += dt; animSounds(state.anim); if (state.anim.t >= state.anim.dur) { state.anim = null; dangerSet(); if (state.game.winner) finish(); } return; }
      autoTick(dt); return;
    }
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 8) state.hint = null; }
    if (state.anim) {
      state.anim.t += dt; animSounds(state.anim);
      if (state.anim.t >= state.anim.dur) { state.anim = null; dangerSet(); if (state.game.winner) finish(); else { saveGame(); if (!humanTurn()) state.think = 0.35; } }
      return;
    }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.msg = null; state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return; }
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
      if (r.move !== undefined) { hintThinker = null; state.thinking = false; if (r.move) { state.hint = { from: r.move.from, to: r.move.to, t: 0 }; say(`Hint: ${describeMove(state.game, r.move)}`, 7); } }
      return;
    }
    if ((tap && inRect(BTN.undo, tap.x, tap.y)) || input.keys.pressed.has('KeyU')) {
      if (state.undo.length) { state.game = state.undo.pop().game; state.sel = -1; state.selMoves = []; state.hint = null; state.dangerAt = -1; say('Move taken back.'); clack(360); saveGame(); } else say('Nothing to take back yet.');
      return;
    }
    if ((tap && inRect(BTN.hint, tap.x, tap.y)) || input.keys.pressed.has('KeyH')) {
      if (state.hintsLeft <= 0) say('No hints left in this game.');
      else { state.hintsLeft -= 1; hintThinker = createThinker(state.game, 3, rng); state.thinking = true; state.sel = -1; state.selMoves = []; say('Looking for a good move...', 6); }
      return;
    }
    // board: tap to select / move, or press-drag-release
    const L = lay(); let m = null;
    if (p.pressed) { m = pressSquare(L.squareAt(p.x, p.y)); drag0 = state.sel >= 0 && !m ? { x: p.x, y: p.y } : null; }
    if (!m && p.down && drag0 && state.sel >= 0) { if (state.drag || Math.hypot(p.x - drag0.x, p.y - drag0.y) > L.cell * 0.28) state.drag = { x: p.x, y: p.y }; }
    if (!m && p.released && drag0) {
      if (state.drag) { const i = L.squareAt(p.x, p.y); state.drag = null; if (i >= 0 && i !== state.sel) { const q = state.selMoves.find((s) => s.to === i); if (q) m = { from: state.sel, to: i, jump: q.jump }; else if (state.game.board[i] === 0 || sideOf(state.game.board[i]) !== state.game.turn) { const r = tryMove(state.game, state.sel, i); say(r.error, 5); } } }
      drag0 = null;
    }
    if (!p.down) { state.drag = null; }
    if (!m) { const k = keyMove(input); if (k) m = k; }
    if (m) { state.undo.push({ game: clone(state.game) }); play(m); }
  }

  function keyMove(input) {
    const k = input.keys.pressed; let dx = 0, dy = 0;
    if (k.has('ArrowLeft')) dx = -1; else if (k.has('ArrowRight')) dx = 1; else if (k.has('ArrowUp')) dy = -1; else if (k.has('ArrowDown')) dy = 1;
    if (dx || dy) { state.kb = true; const f = state.flip ? -1 : 1, x = Math.max(0, Math.min(6, (state.cursor % 7) + dx * f)), y = Math.max(0, Math.min(8, Math.floor(state.cursor / 7) + dy * f)); state.cursor = x + 7 * y; return null; }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; return pressSquare(state.cursor); }
    return null;
  }

  function updateLesson(dt, tap, p) {
    const L = state.lesson, l = LESSONS[L.i], BTN = lay().BTN;
    if (state.anim) { state.anim.t += dt; animSounds(state.anim); if (state.anim.t >= state.anim.dur) state.anim = null; return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; state.msg = null; return; }
    if (L.done) {
      if (tap && inRect(BTN.next, tap.x, tap.y)) {
        if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try a game against the computer.', 7); }
      }
      return;
    }
    if (!p.pressed) return;
    const m = pressSquare(lay().squareAt(p.x, p.y)); if (!m) return;
    const goal = l.goal;
    let ok = false;
    if (goal.type === 'to') ok = m.to === goal.to;
    else if (goal.type === 'capture') ok = state.game.board[m.to] !== 0;
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

  // Developer / screenshot hook (used with ?shot=1 by main.js; never reachable by a player).
  function devScene(spec) {
    state.frozen = true; if (spec.textScale !== undefined) state.textScaleIdx = spec.textScale;
    if (spec.theme) state.theme = spec.theme; if (spec.style) state.style = spec.style; if (spec.calm !== undefined) state.calm = spec.calm;
    if (spec.level !== undefined) state.level = spec.level; if (spec.human) state.humanSide = spec.human;
    if (spec.scene === 'title') { state.scene = 'title'; if (spec.saved) state.saved = { game: newGame() }; }
    else if (spec.scene === 'demo-limit') { state.scene = 'demo-limit'; }
    else if (spec.scene === 'doc') { openDoc(spec.doc || 'rules'); state.doc.scroll = spec.scroll || 0; }
    else if (spec.scene === 'lesson') { startLesson(spec.lesson || 0); if (spec.sel !== undefined) { state.sel = spec.sel; refreshSel(); } if (spec.play) { const m = { from: spec.play[0], to: spec.play[1] }; play(m); state.lesson.done = true; state.game.winner = 0; state.anim.t = spec.animT ?? 0; } }
    else if (spec.scene === 'play' || spec.scene === 'over' || spec.scene === 'auto') {
      if (spec.scene === 'auto') startAuto(); else startGame(!!spec.two);
      state.msg = null; state.think = 99;
      const g = state.game;
      if (spec.board) { g.board = parseBoard(spec.board); g.seen = {}; g.turn = spec.turn || 1; g.lost = spec.lost || [0, 0, 0]; g.gone = spec.gone || []; g.moves = spec.moves || 0; g.last = null; }
      else for (let n = 0; n < (spec.plies || 0) && !g.winner; n++) { const mv = createThinker(g, 1, rng); let r; do { r = mv.step(); } while (r.move === undefined); if (!r.move) break; applyMove(g, r.move); }
      if (spec.play) { state.undo = []; const m = { from: spec.play[0], to: spec.play[1] }; play(m); state.anim.t = spec.animT ?? 0; }
      state.dangerAt = -1; dangerSet();
      if (spec.sel !== undefined && spec.sel >= 0) { state.sel = spec.sel; refreshSel(); }
      if (spec.hint) { state.hint = { from: spec.hint[0], to: spec.hint[1], t: 0 }; }
      if (spec.msg) say(spec.msg, 99);
      if (spec.scene === 'auto') { state.autoPaused = !!spec.paused; }
      if (spec.scene === 'over') { if (!g.winner) { g.winner = spec.winner || 1; g.reason = spec.reason || 'Tiger entered the Blue den.'; } state.scene = 'over'; state.result = { winner: g.winner, reason: g.reason }; state.anim = null; }
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
