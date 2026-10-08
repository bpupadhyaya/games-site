// Chinese Rings. State and flow. Drawing is in view.js, the rule book in rules.js, text in content.js, art in art.js.
//
// How a move is made: tap a ring. If the rule allows it the ring turns, slides through the bar and drops on (or lifts off) with a metal clink;
// if not it shivers and a sentence says which ring is in the way. The logic is instant; the ring animations only follow it.
import { layoutFor, TEXT_SCALES, THINK_STEPS, inRect, host } from './layout.js';
import { MIN_RINGS, MAX_RINGS, allOn, canMove, whyNot, toggle, isSolved, movesLeft, nextMove, hintWhy, scramble, parAll } from './rules.js';
import { LESSONS } from './content.js';
import { FINISH_KEYS, prewarmRing } from './art.js';
import { render, ui, docMetrics } from './view.js';

// Fluid viewport (kit 1.7.0): the short side is always 720 units and the long side follows the screen, in portrait and landscape.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
// Mouse-wheel travel (virtual units) collected by main.js and consumed by the document screens; empty in headless runs.
export const wheelInput = { dy: 0 };
const DEMO_PUZZLES = 3, AUTO_REVEAL_SECS = 2, MOVE_SECS = 0.5;
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5, 1568];
export const starsFor = (moves, par) => (moves <= par ? 3 : moves <= Math.ceil(par * 1.5) ? 2 : 1);

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, sceneT: 1, n: 4, mode: 'classic',
    pz: { bits: allOn(4), start: allOn(4), moves: 0, par: parAll(4), hints: 0 },
    anim: Array(MAX_RINGS).fill(null), shake: Array(MAX_RINGS).fill(0), undo: [],
    msg: null, hint: null, assist: true, lamps: true, sound: true, calm: false, finish: 'steel', textScaleIdx: 0, autoThinkIdx: 1,
    stats: { solved: 0, best: {}, stars: {} }, saved: null, learned: false, demoPuzzles: 0, lesson: null, result: null,
    doc: { kind: 'rules', scroll: 0 }, autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false, frozen: false, dev: config.dev === true,
    lockupRect: null, cursor: 0, kb: false, overDelay: 0,
  };
  let lastScene = state.scene, docDrag = null;
  const lay = () => layoutFor(meta.width, meta.height, state.pz.bits.length);
  const key = () => `${state.mode}${state.pz.bits.length}`;

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    state.n = Math.max(MIN_RINGS, Math.min(MAX_RINGS, v.n ?? 4)); if (v.mode === 'classic' || v.mode === 'scramble') state.mode = v.mode;
    state.assist = v.assist ?? true; state.lamps = v.lamps ?? true; state.sound = v.sound ?? true; state.calm = v.calm ?? false;
    if (FINISH_KEYS.includes(v.finish)) state.finish = v.finish;
    state.textScaleIdx = Math.max(0, Math.min(TEXT_SCALES.length - 1, v.textScaleIdx ?? 0)); state.autoThinkIdx = Math.max(0, Math.min(THINK_STEPS.length - 1, v.autoThinkIdx ?? 1));
    audio.setMuted?.(!state.sound);
    if (state.scene === 'title') setPuzzle(state.n, state.mode);
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, best: { ...(v.best || {}) }, stars: { ...(v.stars || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('demoPuzzles', 0).then((v) => { state.demoPuzzles = Math.max(state.demoPuzzles, v); });
  storage.get('save', null).then((v) => { if (v && v.pz && v.pz.bits && !isSolved(v.pz.bits) && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { n: state.n, mode: state.mode, assist: state.assist, lamps: state.lamps, sound: state.sound, calm: state.calm, finish: state.finish, textScaleIdx: state.textScaleIdx, autoThinkIdx: state.autoThinkIdx });
  const saveGame = () => { if (state.scene === 'play' && !state.autoMode && !isSolved(state.pz.bits)) { state.saved = { pz: { ...state.pz, bits: state.pz.bits.slice(), start: state.pz.start.slice() }, mode: state.mode, undo: state.undo.slice(-400) }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound && !state.autoMode) audio.tone(o); };
  const clink = (k, on) => {
    const f = PENTA[k % PENTA.length] * (on ? 1 : 0.5);
    tone({ freq: f * 2.01, to: f * 2.0, dur: 0.5, type: 'sine', vol: 0.07 }); tone({ freq: f * 5.4, to: f * 5.3, dur: 0.22, type: 'sine', vol: 0.04 });
    tone({ freq: f * 8.9, to: f * 8.7, dur: 0.1, type: 'sine', vol: 0.025 }); tone({ freq: on ? 160 : 230, to: on ? 230 : 120, dur: 0.12, type: 'triangle', vol: 0.05 });
  };
  const dur = (d) => (state.calm ? d * 0.45 : d);

  // ---- puzzles
  function setPuzzle(n, mode) {
    state.n = n; state.mode = mode;
    const bits = mode === 'scramble' ? scramble(n, rng) : allOn(n);
    state.pz = { bits, start: bits.slice(), moves: 0, par: movesLeft(bits), hints: 0 };
    state.anim.fill(null); state.shake.fill(0); state.undo = []; state.hint = null; state.result = null;
  }
  function startPuzzle() {
    if (config.demo && state.demoPuzzles >= DEMO_PUZZLES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoPuzzles += 1; storage.set('demoPuzzles', state.demoPuzzles); }
    setPuzzle(state.n, state.mode); clearSave();
    Object.assign(state, { scene: 'play', autoMode: false, autoPhase: null, autoMove: null, autoPaused: false, msg: null });
    say(state.mode === 'classic' ? 'Every ring is on the bar. Take them all off. Tap a ring to move it.' : 'A scrambled start. Take every ring off the bar. Tap a ring to move it.', 6);
    monetization.track('puzzle_start', { rings: state.n, mode: state.mode });
  }
  function startAuto() {
    setPuzzle(Math.min(state.n, 6), 'classic');
    Object.assign(state, { scene: 'play', autoMode: true, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false, msg: null });
    say('Auto Play: watch the puzzle solve itself. Before each move, think which ring it will be.', 999);
  }
  function resume() {
    const v = state.saved;
    state.n = v.pz.bits.length; state.mode = v.mode || 'classic';
    state.pz = { ...v.pz, bits: v.pz.bits.slice(), start: v.pz.start.slice() }; state.undo = (v.undo || []).slice();
    state.anim.fill(null); state.hint = null; state.result = null;
    Object.assign(state, { scene: 'play', autoMode: false, autoPhase: null, autoMove: null, autoPaused: false, msg: null });
    say('Puzzle restored.');
  }
  function startLesson(i) {
    const l = LESSONS[i];
    state.pz = { bits: l.start.slice(), start: l.start.slice(), moves: 0, par: movesLeft(l.start), hints: 0 };
    state.anim.fill(null); state.shake.fill(0); state.undo = []; state.hint = null; state.result = null;
    Object.assign(state, { scene: 'lesson', autoMode: false, autoPhase: null, lesson: { i, done: false }, msg: null });
  }
  const restartPuzzle = () => {
    state.pz = { ...state.pz, bits: state.pz.start.slice(), moves: 0 }; state.anim.fill(null); state.undo = []; state.hint = null; say('Back to the start of this puzzle.', 3);
    if (state.scene === 'lesson') state.lesson.done = false;
  };

  // ---- moves
  const startAnim = (k, from, to) => { state.anim[k] = { from, to, t: 0, dur: dur(MOVE_SECS) }; };
  function moveRing(k, forced = false) {
    const P = state.pz;
    if (!canMove(P.bits, k)) {
      state.shake[k] = 1; tone({ freq: 190, to: 120, dur: 0.14, type: 'triangle', vol: 0.06 });
      say(whyNot(P.bits, k), 5.5); return false;
    }
    const from = P.bits[k] ? 1 : 0, to = 1 - from;
    if (!forced) state.undo.push({ bits: P.bits.slice(), moves: P.moves });
    P.bits = toggle(P.bits, k); P.moves += 1; state.hint = null; state.cursor = k;
    startAnim(k, from, to); clink(k, !!to);
    if (state.scene === 'play' && !state.autoMode) {
      if (isSolved(P.bits)) finish(); else { saveGame(); if (movesLeft(P.bits) === 1) say('One move to go!', 3); }
    }
    return true;
  }
  function finish() {
    const P = state.pz, par = P.par, stars = starsFor(P.moves, par), k = key();
    clearSave();
    const prevBest = state.stats.best[k], newBest = state.mode === 'classic' && (prevBest === undefined || P.moves < prevBest);
    if (newBest) state.stats.best[k] = P.moves;
    state.stats.stars[k] = Math.max(state.stats.stars[k] || 0, stars); state.stats.solved += 1; storage.set('stats', state.stats);
    state.result = { moves: P.moves, par, stars, newBest, rings: P.bits.length };
    state.overDelay = 1.0;                                                                        // let the last ring settle before the result card
    monetization.track('puzzle_solved', { rings: P.bits.length, mode: state.mode, moves: P.moves, par });
    [0, 4, 7, 11].forEach((st, i) => tone({ freq: 523.25 * 2 ** (st / 12), to: 523.25 * 2 ** (st / 12), dur: 0.5, type: 'triangle', vol: 0.08 - i * 0.008 }));
  }
  function undoMove() {
    const P = state.pz;
    if (!state.undo.length) { say('Nothing to take back yet.'); return; }
    const prev = state.undo.pop();
    for (let i = 0; i < P.bits.length; i++) if (P.bits[i] !== prev.bits[i]) startAnim(i, P.bits[i] ? 1 : 0, prev.bits[i] ? 1 : 0);
    P.bits = prev.bits; P.moves = prev.moves; state.hint = null; say('Move taken back.', 2.5); tone({ freq: 330, to: 250, dur: 0.1, type: 'triangle', vol: 0.05 }); saveGame();
  }
  function giveHint() {
    const P = state.pz, m = nextMove(P.bits);
    if (!m) { say('Every ring is off the bar.'); return; }
    state.hint = { ring: m.ring, on: m.on, t: 0 }; P.hints += 1; say(hintWhy(P.bits), 8);
  }

  // ---- title and documents
  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title(!!state.saved), R = T.rows, hit = (r) => inRect(r, tap.x, tap.y);
    if (state.lockupRect && inRect(state.lockupRect, tap.x, tap.y)) { env.openArcforgeHome?.(); return; }
    const ping = (f) => tone({ freq: f, to: f * 0.9, dur: 0.07, type: 'sine', vol: 0.08 });
    if (hit(R.resume)) resume();
    else if (hit(R.play)) startPuzzle();
    else if (hit(R.mode)) { setPuzzle(state.n, state.mode === 'classic' ? 'scramble' : 'classic'); savePrefs(); ping(500); }
    else if (hit(R.ringsMinus)) { if (state.n > MIN_RINGS) { setPuzzle(state.n - 1, state.mode); savePrefs(); ping(440); } }
    else if (hit(R.ringsPlus)) { if (state.n < MAX_RINGS) { setPuzzle(state.n + 1, state.mode); savePrefs(); ping(520); } }
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.auto)) startAuto();
    else if (hit(R.rules)) openDoc('rules'); else if (hit(R.how)) openDoc('how'); else if (hit(R.about)) openDoc('about'); else if (hit(R.settings)) openDoc('settings');
  }
  function openDoc(kind) { state.doc = { kind, scroll: 0 }; docDrag = null; state.msg = null; state.scene = 'doc'; tone({ freq: 400, to: 360, dur: 0.06, type: 'sine', vol: 0.08 }); }
  const settingsAct = (id, v, locked, need) => {
    if (locked) { say(`Solve ${need} puzzle${need === 1 ? '' : 's'} yourself to unlock this.`, 4); return; }
    if (id === 'mode') setPuzzle(state.n, v); else if (id === 'rings') setPuzzle(v, state.mode);
    else if (id === 'assist') state.assist = !!v; else if (id === 'lamps') state.lamps = !!v; else if (id === 'finish') state.finish = v;
    else if (id === 'sound') { state.sound = !!v; audio.setMuted?.(!state.sound); } else if (id === 'calm') state.calm = !!v;
    savePrefs(); tone({ freq: 500, to: 420, dur: 0.06, type: 'sine', vol: 0.07 });
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
    if (inRect(D.nav.back, tap.x, tap.y)) { state.scene = 'title'; state.msg = null; }
    else if (inRect(D.nav.next, tap.x, tap.y)) { if (max() <= 0 || state.doc.scroll >= max() - 1) { state.scene = 'title'; state.msg = null; } else setScroll(state.doc.scroll + docMetrics.view * 0.85); }
    else if (inRect(D.header.textDec, tap.x, tap.y)) { if (state.textScaleIdx > 0) { state.textScaleIdx--; state.doc.scroll = 0; savePrefs(); } }
    else if (inRect(D.header.textInc, tap.x, tap.y)) { if (state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; state.doc.scroll = 0; savePrefs(); } }
    else if (state.doc.kind === 'settings' && inRect(D.viewport, tap.x, tap.y)) {
      for (const h of ui.hits) if (inRect(h.r, tap.x, tap.y) && inRect(h.clip || D.viewport, tap.x, tap.y)) { settingsAct(h.id, h.v, h.locked, h.need); break; }
    }
  }

  // ---- animations (all stop while Auto Play is paused)
  function stepAnims(dt) {
    for (let i = 0; i < state.anim.length; i++) {
      const a = state.anim[i]; if (a) { a.t += dt; if (a.t >= a.dur) state.anim[i] = null; }
      if (state.shake[i] > 0) state.shake[i] = Math.max(0, state.shake[i] - dt * 2.4);
    }
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 12) state.hint = null; }
  }

  // ---- Auto Play: THINK (the move is decided but held back) -> REVEAL (the ring glows, with the reason) -> ACT, for a whole puzzle
  function autoTick(dt) {
    if (state.autoPhase === 'done') { state.autoTimer += dt; if (state.autoTimer > 1.6) finishAuto(); return; }
    if (state.autoPhase === 'reveal') {
      state.autoTimer -= dt; if (state.autoTimer > 0) return;
      const m = state.autoMove; state.autoPhase = null; state.autoMove = null; state.hint = null;
      if (m) moveRing(m.ring, true);
      if (isSolved(state.pz.bits)) { state.autoPhase = 'done'; state.autoTimer = 0; say(`Solved in ${state.pz.moves} moves, the fewest possible.`, 6); }
      return;
    }
    if (state.autoPhase === 'think') {
      state.autoTimer -= dt; if (state.autoTimer > 0) return;
      const m = state.autoMove; if (m) { state.hint = { ring: m.ring, on: m.on, t: 0 }; say(hintWhy(state.pz.bits), AUTO_REVEAL_SECS + 0.5); }
      state.autoPhase = 'reveal'; state.autoTimer = AUTO_REVEAL_SECS; return;
    }
    const m = nextMove(state.pz.bits); if (!m) { state.autoPhase = 'done'; state.autoTimer = 0; return; }
    state.autoMove = m; state.autoPhase = 'think'; state.autoTimer = THINK_STEPS[state.autoThinkIdx];
    say(`Move ${state.pz.moves + 1} of ${state.pz.par}. Which ring moves next? Think, then watch.`, state.autoTimer + AUTO_REVEAL_SECS + 1);
  }
  function finishAuto() { state.autoMode = false; state.autoPhase = null; state.scene = 'over'; state.result = { moves: state.pz.moves, par: state.pz.par, stars: 3, auto: true, rings: state.pz.bits.length }; }

  function updatePlay(dt, tap, p, input) {
    const L = lay(), BTN = L.BTN;
    if (state.autoMode) {
      if (tap && inRect(BTN.auto.exit, tap.x, tap.y)) { Object.assign(state, { autoMode: false, autoPhase: null, autoMove: null, autoPaused: false, msg: null, scene: 'title', hint: null }); setPuzzle(state.n, state.mode); return; }
      if (tap && inRect(BTN.auto.pause, tap.x, tap.y)) { state.autoPaused = !state.autoPaused; return; }
      if (tap && inRect(BTN.auto.dec, tap.x, tap.y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx--; savePrefs(); } return; }
      if (tap && inRect(BTN.auto.inc, tap.x, tap.y)) { if (state.autoThinkIdx < THINK_STEPS.length - 1) { state.autoThinkIdx++; savePrefs(); } return; }
      if (state.autoPaused) return;                                       // freezes the loop, any ring in flight and the captions
      stepAnims(dt); autoTick(dt); return;
    }
    stepAnims(dt);
    if (isSolved(state.pz.bits)) { state.overDelay -= dt; if (state.overDelay <= 0) { state.scene = 'over'; state.msg = null; } return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.msg = null; state.scene = 'title'; return; }
    if ((tap && inRect(BTN.undo, tap.x, tap.y)) || input.keys.pressed.has('KeyU')) { undoMove(); return; }
    if ((tap && inRect(BTN.hint, tap.x, tap.y)) || input.keys.pressed.has('KeyH')) { giveHint(); return; }
    if ((tap && inRect(BTN.restart, tap.x, tap.y)) || input.keys.pressed.has('KeyR')) { if (state.pz.moves) { restartPuzzle(); saveGame(); } else say('You are already at the start.'); return; }
    if (p.pressed) { const k = L.ringAt(p.x, p.y); if (k >= 0) { state.kb = false; moveRing(k); } }
    else { const k = keyRing(input); if (k >= 0) moveRing(k); }
  }
  function keyRing(input) {
    const k = input.keys.pressed, n = state.pz.bits.length;
    for (let d = 1; d <= 9; d++) if (k.has('Digit' + d) || k.has('Numpad' + d)) { state.kb = true; return d <= n ? d - 1 : -1; }
    if (k.has('ArrowLeft')) { state.kb = true; state.cursor = Math.min(n - 1, state.cursor + 1); } else if (k.has('ArrowRight')) { state.kb = true; state.cursor = Math.max(0, state.cursor - 1); }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; return state.cursor; }
    return -1;
  }

  const lessonGoal = (l, bits) => (l.goal.solved ? isSolved(bits) : !bits[l.goal.ring]);
  function updateLesson(dt, tap, p, input) {
    const Ls = state.lesson, l = LESSONS[Ls.i], L = lay(), BTN = L.BTN;
    stepAnims(dt);
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; state.msg = null; setPuzzle(state.n, state.mode); return; }
    if (Ls.done) {
      if (tap && inRect(BTN.next, tap.x, tap.y)) {
        if (Ls.i + 1 < LESSONS.length) startLesson(Ls.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; setPuzzle(state.n, state.mode); say('You know the puzzle. Try one on your own.', 7); }
      }
      return;
    }
    if (tap && inRect(BTN.undo, tap.x, tap.y)) { undoMove(); return; }
    if (tap && inRect(BTN.hint, tap.x, tap.y)) { giveHint(); return; }
    if (tap && inRect(BTN.restart, tap.x, tap.y)) { restartPuzzle(); return; }
    const k = p.pressed ? L.ringAt(p.x, p.y) : keyRing(input);
    if (k < 0) return;
    if (moveRing(k) && lessonGoal(l, state.pz.bits)) { Ls.done = true; state.msg = null; state.hint = null; tone({ freq: 660, to: 990, dur: 0.22, type: 'triangle', vol: 0.09 }); }
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
    state.frozen = true; state.t = spec.t ?? 1.4; if (spec.textScale !== undefined) state.textScaleIdx = spec.textScale;
    if (spec.finish) state.finish = spec.finish; if (spec.calm !== undefined) state.calm = spec.calm; if (spec.assist !== undefined) state.assist = spec.assist;
    const walk = (steps) => { for (let i = 0; i < steps; i++) { const m = nextMove(state.pz.bits); if (!m) break; state.pz.bits = toggle(state.pz.bits, m.ring); state.pz.moves += 1; } };
    if (spec.scene === 'title') { state.scene = 'title'; if (spec.saved) state.saved = { pz: state.pz }; }
    else if (spec.scene === 'doc') { openDoc(spec.doc || 'rules'); state.doc.scroll = spec.scroll || 0; }
    else if (spec.scene === 'lesson') {
      startLesson(spec.lesson || 0); walk(spec.steps || 0);
      state.anim.fill(null); state.undo = []; state.msg = null;
      if (spec.done) state.lesson.done = true;
    } else if (spec.scene === 'play' || spec.scene === 'over' || spec.scene === 'auto') {
      state.n = spec.n || state.n; state.mode = spec.mode || state.mode;
      if (spec.scene === 'auto') startAuto(); else startPuzzle();
      state.msg = null; walk(spec.steps || 0);
      if (spec.wander) for (const k of spec.wander) if (canMove(state.pz.bits, k)) { state.pz.bits = toggle(state.pz.bits, k); state.pz.moves += 1; }
      state.anim.fill(null); state.undo = [];
      if (spec.hint) giveHint();
      if (spec.reject !== undefined) { state.shake[spec.reject] = 0.7; say(whyNot(state.pz.bits, spec.reject), 99); }
      if (spec.msg) say(spec.msg, 99);
      if (spec.scene === 'auto') { state.autoPaused = !!spec.paused; if (spec.hint) { state.autoPhase = 'reveal'; state.autoMove = nextMove(state.pz.bits); } }
      if (spec.scene === 'over') {
        const P = state.pz; P.bits = Array(P.bits.length).fill(0); P.moves = spec.moves || P.par; state.scene = 'over';
        state.result = { moves: P.moves, par: P.par, stars: starsFor(P.moves, P.par), newBest: !!spec.newBest, rings: P.bits.length };
      }
    }
    if (state.msg) state.msg.t = Math.min(1, state.msg.hold / 2);
    state.sceneT = 1; lastScene = state.scene;
  }

  let warmed = false;
  return {
    update(dt, input) {
      state.t += dt;
      if (!warmed && state.scene === 'title' && state.t > 0.3) { warmed = true; const sc = lay().sc; if (sc) prewarmRing(state.finish, sc.G.R * sc.k); }   // bake the play-scene ring sprite while the player reads the menu
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.scene !== 'doc') wheelInput.dy = 0;
      if (state.msg && !(state.autoMode && state.autoPaused)) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      if (state.frozen) return;
      const p = input.pointer, kbd = keyboardTap(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      if (state.scene === 'title') updateTitle(tap);
      else if (state.scene === 'doc') updateDoc(tap, input);
      else if (state.scene === 'play') updatePlay(dt, tap, p, input);
      else if (state.scene === 'lesson') updateLesson(dt, tap, p, input);
      else if (state.scene === 'over') {
        stepAnims(dt);
        if (tap) {
          const O = lay().over;
          if (inRect(O.again, tap.x, tap.y)) { if (state.result && state.result.auto) startAuto(); else startPuzzle(); }
          else if (inRect(O.back, tap.x, tap.y)) { state.autoMode = false; state.msg = null; state.scene = 'title'; setPuzzle(state.n, state.mode); }
        }
      }
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, state.pz.bits.length);
      // the kit's "Preview 1:23" pill: top centre in portrait; in landscape it moves above the buttons card, clear of the scene
      meta.previewBadge = L.land && L.rightCard ? { x: L.rightCard.x + L.rightCard.w / 2, y: L.rightCard.y - Math.max(16, 11.5 / (host.px || 0.5)) * 1.7 - 3, align: 'center' } : undefined;
      render(ctx, state, L);
    },
    getState: () => state,
    devScene,
    // kit 1.6.1: the free-preview timer counts real play only - a puzzle in progress. Menus, Rules, lessons, Auto Play, results and
    // the demo-limit screen are exempt.
    isPreviewExempt() { return !(state.scene === 'play' && !state.autoMode && !isSolved(state.pz.bits)); },
  };
}
