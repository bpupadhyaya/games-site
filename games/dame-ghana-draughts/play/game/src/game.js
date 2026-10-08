// Dame: West African Draughts - state and flow. Drawing is in view.js, the rules and the computer are in engine.js.
//
// How a move is made: tap a piece (it lifts and its legal squares glow), then tap where it should go. For a chain of jumps tap each
// landing square in turn; as soon as only one chain is left, the piece plays the rest by itself. Capture is compulsory, so while a
// capture exists only the pieces that can capture may be picked up.
import { layoutFor, TEXT_SCALES, THINK_STEPS, inRect, boardGeo } from './layout.js';
import { VARIANTS, LEVELS, newGame, clone, legalMoves, applyMove, createThinker, moveText, chooseMove } from './engine.js';
import { makeAnim, animLegAt } from './anim.js';
import { render, ui, readerMetrics } from './view.js';
import { WOODS } from './art.js';
import { SETS } from './pieces.js';

// Fluid viewport: the short side is always 720 units and the long side follows the screen, in portrait and landscape.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };       // mouse-wheel travel collected by main.js, consumed by the reader
const DEMO_GAMES = 2, AUTO_REVEAL_SECS = 2;
const idxOf = (r, x, n) => Math.max(0, Math.min(n - 1, Math.floor(((x - r.x) / r.w) * n)));

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  const state = {
    scene: 'title', t: 0, sceneT: 1, doc: 'rules', readerScroll: 0,
    variant: 'damii', level: 1, human: 1,
    sound: true, calm: false, marks: true, wood: 'teak', set: 'caps', loneOpt: 'auto', majority: false, textScaleIdx: 0, autoThinkIdx: 1,
    game: newGame(VARIANTS.damii), sel: -1, path: [], anim: null, msg: null, hint: null, hintBusy: false, thinking: false, think: 0, undo: [],
    lastText: '', cursor: 0, kb: false, stats: { games: 0, wins: 0, losses: 0, draws: 0, badges: {} }, saved: null, demoGames: 0,
    autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false,
    dev: config.dev === true,
  };
  const aux = { legal: [], mustCap: false, capFrom: new Set(), dests: new Set(), partialCaps: [], humanTurn: false };
  let thinker = null, hintThinker = null, lastScene = state.scene, capNagged = false, drag = null;

  const applyTextScale = () => { try { config.textScale = TEXT_SCALES[state.textScaleIdx]; } catch { /* frozen config in some hosts */ } };
  storage.get('prefs', null).then((v) => {
    if (!v) return;
    state.level = Math.min(Math.max(v.level ?? 1, 0), LEVELS.length - 1); state.variant = VARIANTS[v.variant] ? v.variant : 'damii'; state.human = v.human === -1 ? -1 : 1;
    state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.marks = v.marks ?? true;
    state.wood = WOODS.includes(v.wood) ? v.wood : 'teak'; state.set = SETS.includes(v.set) ? v.set : 'caps';
    state.loneOpt = ['auto', 'on', 'off'].includes(v.loneOpt) ? v.loneOpt : 'auto'; state.majority = !!v.majority;
    state.textScaleIdx = Math.min(Math.max(v.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1); state.autoThinkIdx = Math.min(Math.max(v.autoThinkIdx ?? 1, 0), THINK_STEPS.length - 1);
    audio.setMuted?.(!state.sound); applyTextScale();
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) } }; });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && !v.game.winner && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, variant: state.variant, human: state.human, sound: state.sound, calm: state.calm, marks: state.marks, wood: state.wood, set: state.set, loneOpt: state.loneOpt, majority: state.majority, textScaleIdx: state.textScaleIdx, autoThinkIdx: state.autoThinkIdx });
  const saveGame = () => { if (state.scene === 'play' && !state.autoMode && !state.game.winner) { state.saved = { game: clone(state.game), human: state.human, level: state.level, variant: state.variant }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound && !state.autoMode) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.8, to: f * 0.36, dur: 0.06, type: 'sine', vol: 0.11 });
  const thud = () => tone({ freq: 220, to: 70, dur: 0.14, type: 'triangle', vol: 0.14 });
  const humanTurn = () => state.scene === 'play' && !state.autoMode && !state.game.winner && state.game.turn === state.human;

  function refresh() {
    const g = state.game;
    aux.legal = g.winner ? [] : legalMoves(g);
    aux.mustCap = aux.legal.some((m) => m.caps.length > 0);
    aux.capFrom = new Set(aux.mustCap ? aux.legal.map((m) => m.from) : []);
    aux.humanTurn = humanTurn();
    recomputeSel();
  }
  const fits = (m, from, path) => m.from === from && path.every((s, i) => m.path[i] === s);
  function recomputeSel() {
    aux.dests = new Set(); aux.partialCaps = [];
    if (state.sel < 0) return;
    const k = state.path.length;
    for (const m of aux.legal) if (fits(m, state.sel, state.path) && m.path.length > k) { aux.dests.add(m.path[k]); if (k && !aux.partialCaps.length) aux.partialCaps = m.caps.slice(0, k); }
  }

  const rulesOf = () => ({ lone: state.loneOpt === 'auto' ? undefined : state.loneOpt === 'on', majority: state.majority || undefined });
  function begin(extra) {
    thinker = hintThinker = null;
    Object.assign(state, { sel: -1, path: [], anim: null, msg: null, hint: null, hintBusy: false, thinking: false, think: 0, undo: [], lastText: '', autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false, scene: 'play' }, extra);
    capNagged = false; refresh();
  }
  function start(force = false) {
    if (!force && config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (!force && config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    begin({ game: newGame(VARIANTS[state.variant], rulesOf()) });
    state.cursor = state.game.n * (state.game.n - 2) + 1;
    if (state.game.turn !== state.human) state.think = 0.6; else say('Tap one of your pieces. Capture is compulsory.', 5);
    refresh();
    monetization.track('game_start', { variant: state.variant, level: state.level });
  }
  function startAuto() {
    begin({ game: newGame(VARIANTS[state.variant], rulesOf()), autoMode: true });
    say('Auto Play: the computer plays both sides. Watch, then compare with your own idea.', 999);
  }
  function resume() {
    const v = state.saved;
    begin({ game: clone(v.game), human: v.human, level: v.level ?? state.level, variant: v.variant ?? state.variant });
    say('Game restored.');
    if (!humanTurn()) state.think = 0.5;
  }

  // Animate a legal move and apply it to the rule book.
  function play(m, byHuman) {
    const g = state.game, pre = g.cells.slice(), side = g.turn;
    if (byHuman) { state.undo.push(clone(g)); if (state.undo.length > 40) state.undo.shift(); }
    state.lastText = moveText(g, m);
    state.anim = makeAnim(pre, m, side, state.calm);
    applyMove(g, m);
    state.sel = -1; state.path = []; state.hint = null;
    refresh();
    clack(m.caps.length ? 520 : 420);
  }
  function refuse(why) { say(why); tone({ freq: 190, to: 130, dur: 0.16, type: 'triangle', vol: 0.06 }); }

  function select(i) {
    if (!aux.legal.some((m) => m.from === i)) { refuse(aux.mustCap ? 'Capture is compulsory. Only the glowing pieces can move.' : 'That piece has no move.'); return; }
    state.sel = i; state.path = []; recomputeSel(); clack(600);
  }
  // What a tap on board square i means. Returns the legal move that was chosen, or null.
  function tapBoard(i) {
    const g = state.game, me = g.turn, v = g.cells[i];
    if (state.sel < 0) {
      if (v * me > 0) select(i);
      else if (v) say('That is the computer\'s piece. Tap one of yours.');
      else say(aux.mustCap ? 'You must capture. Tap a glowing piece.' : 'First tap the piece you want to move.');
      return null;
    }
    if (i === state.sel && !state.path.length) { state.sel = -1; recomputeSel(); return null; }
    if (!state.path.length && v * me > 0) { select(i); return null; }
    const k = state.path.length, cands = aux.legal.filter((m) => fits(m, state.sel, state.path) && m.path[k] === i);
    if (!cands.length) { refuse(aux.mustCap ? 'You must keep capturing. Tap a glowing square.' : 'That piece cannot go there.'); return null; }
    const done = cands.find((m) => m.path.length === k + 1);
    if (done) return done;
    if (cands.length === 1) return cands[0];
    state.path.push(i); recomputeSel(); thud(); return null;
  }

  // A short, true reason for a hint: looked up on a copy of the position, never guessed.
  function hintWhy(m) {
    const g = state.game, me = g.turn, n = g.n;
    if (aux.legal.length === 1) return aux.mustCap ? 'Hint: this is your only capture, and it is compulsory.' : 'Hint: this is your only legal move.';
    const h = clone(g); applyMove(h, m);
    const crowned = h.last && h.last.crowned, reply = h.winner ? [] : legalMoves(h), danger = reply.some((r) => r.caps.length > 0);
    const lost = danger ? Math.max(...reply.map((r) => r.caps.length)) : 0;
    if (h.winner === me) return 'Hint: this move wins the game.';
    if (m.caps.length > 1) return `Hint: this chain captures ${m.caps.length} pieces${danger ? ', though your piece can be taken back' : ''}.`;
    if (m.caps.length) return danger ? `Hint: this wins a piece. Careful: the reply can take ${lost === 1 ? 'one back' : lost + ' back'}.` : 'Hint: this wins a piece and leaves nothing to capture.';
    if (crowned) return 'Hint: this move crowns a king.';
    if (danger) return 'Hint: a sacrifice. You give a piece to win more back.';
    const edge = m.to % n === 0 || m.to % n === n - 1;
    return edge ? 'Hint: a safe move to the edge, where nothing can capture it.' : 'Hint: a safe, solid move. No enemy piece can capture after it.';
  }

  function finish() {
    const g = state.game;
    state.scene = 'over';
    if (!state.autoMode) {
      state.stats.games += 1; clearSave();
      if (g.winner === 2) state.stats.draws += 1;
      else if (g.winner === state.human) { state.stats.wins += 1; state.stats.badges[state.variant + state.level] = true; }
      else state.stats.losses += 1;
      storage.set('stats', state.stats);
      monetization.track('game_end', { winner: g.winner, moves: g.moves, level: state.level });
    }
    tone({ freq: g.winner === 2 ? 330 : 523, to: g.winner === 2 ? 330 : 784, dur: 0.4, type: 'triangle', vol: 0.09 });
  }

  // ---- per-scene updates ---------------------------------------------------------------------------------------------
  function openReader(doc) { state.doc = doc; state.readerScroll = 0; drag = null; state.scene = 'reader'; clack(); }
  function updateTitle(tap) {
    if (!tap) return;
    const R = lay().menu(!!state.saved).rows, hit = (r) => inRect(r, tap.x, tap.y);
    if (ui.credit && inRect(ui.credit, tap.x, tap.y)) { env.openArcforgeHome?.(); return; }
    if (hit(R.resume)) resume();
    else if (hit(R.play)) start();
    else if (hit(R.variant)) { state.variant = idxOf(R.variant, tap.x, 2) === 0 ? 'damii' : 'dame8'; savePrefs(); clack(); }
    else if (hit(R.level)) { state.level = idxOf(R.level, tap.x, LEVELS.length); savePrefs(); clack(); }
    else if (hit(R.side)) { state.human = idxOf(R.side, tap.x, 2) === 0 ? 1 : -1; savePrefs(); clack(); }
    else if (hit(R.auto)) startAuto();
    else if (hit(R.howto)) openReader('howto');
    else if (hit(R.rules)) openReader('rules');
    else if (hit(R.about)) openReader('about');
    else if (hit(R.settings)) { state.scene = 'settings'; clack(); }
  }

  function updateReader(tap, input) {
    const RL = lay().reader, p = input.pointer, keys = input.keys.pressed, max = () => readerMetrics.max;
    const setScroll = (v) => { state.readerScroll = Math.max(0, Math.min(v, max())); };
    if (wheelInput.dy) { setScroll(state.readerScroll + wheelInput.dy); wheelInput.dy = 0; }
    if (keys.has('ArrowDown')) setScroll(state.readerScroll + 70);
    if (keys.has('ArrowUp')) setScroll(state.readerScroll - 70);
    if (keys.has('PageDown')) setScroll(state.readerScroll + readerMetrics.view * 0.9);
    if (keys.has('PageUp')) setScroll(state.readerScroll - readerMetrics.view * 0.9);
    if (p.pressed && max() > 0) {
      if (inRect(RL.scrollbar, p.x, p.y)) drag = { bar: true };
      else if (inRect(RL.viewport, p.x, p.y)) drag = { y0: p.y, s0: state.readerScroll };
    }
    if (drag) { if (!p.down) drag = null; else if (drag.bar) setScroll(((p.y - RL.scrollbar.y) / RL.scrollbar.h) * max()); else setScroll(drag.s0 - (p.y - drag.y0)); }
    state.readerScroll = Math.max(0, Math.min(state.readerScroll, max()));
    if (keys.has('Escape')) { state.scene = 'title'; state.readerScroll = 0; return; }
    if (!tap) return;
    if (inRect(RL.nav.back, tap.x, tap.y)) { state.scene = 'title'; state.readerScroll = 0; clack(); }
    else if (inRect(RL.nav.next, tap.x, tap.y)) {
      if (max() <= 0 || state.readerScroll >= max() - 1) { state.scene = 'title'; state.readerScroll = 0; } else setScroll(state.readerScroll + readerMetrics.view * 0.85);
      clack();
    } else if (inRect(RL.header.textDec, tap.x, tap.y) && state.textScaleIdx > 0) { state.textScaleIdx--; state.readerScroll = 0; applyTextScale(); savePrefs(); clack(); }
    else if (inRect(RL.header.textInc, tap.x, tap.y) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; state.readerScroll = 0; applyTextScale(); savePrefs(); clack(); }
  }

  const cycle = (arr, v) => arr[(arr.indexOf(v) + 1) % arr.length];
  function updateSettings(tap) {
    if (!tap) return;
    if (inRect(lay().settings.back, tap.x, tap.y)) { state.scene = 'title'; clack(); return; }
    for (const sr of state.settingsRects || []) {
      if (sr.key === 'text') {
        if (inRect(sr.dec, tap.x, tap.y) && state.textScaleIdx > 0) { state.textScaleIdx--; applyTextScale(); savePrefs(); clack(); }
        else if (inRect(sr.inc, tap.x, tap.y) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; applyTextScale(); savePrefs(); clack(); }
        continue;
      }
      if (!inRect(sr.rect, tap.x, tap.y)) continue;
      if (sr.key === 'sound') { state.sound = !state.sound; audio.setMuted?.(!state.sound); }
      else if (sr.key === 'calm') state.calm = !state.calm;
      else if (sr.key === 'marks') state.marks = !state.marks;
      else if (sr.key === 'wood') state.wood = cycle(WOODS, state.wood);
      else if (sr.key === 'set') state.set = cycle(SETS, state.set);
      else if (sr.key === 'lone') state.loneOpt = cycle(['auto', 'on', 'off'], state.loneOpt);
      else if (sr.key === 'majority') state.majority = !state.majority;
      savePrefs(); clack();
    }
  }

  // Auto Play: THINK (the move is decided but held back) -> REVEAL (shown with the hint glow) -> ACT, for a whole game, using the same
  // search as the computer opponent. Pause freezes the whole loop and any animation in flight.
  function autoTick(dt) {
    if (state.autoPhase === 'reveal') {
      state.autoTimer -= dt; if (state.autoTimer > 0) return;
      const m = state.autoMove; state.autoPhase = null; state.autoMove = null; state.hint = null;
      if (m) play(m, false);
      return;
    }
    if (state.autoPhase === 'think') {
      state.autoTimer -= dt; if (state.autoTimer > 0) return;
      const m = state.autoMove;
      if (m) state.hint = { from: m.from, to: m.to, path: m.path, t: 0 };
      state.autoPhase = 'reveal'; state.autoTimer = AUTO_REVEAL_SECS;
      say('This is the move. Compare it with your own guess.', AUTO_REVEAL_SECS + 0.5);
      return;
    }
    if (!thinker) { thinker = createThinker(state.game, state.level, rng); state.thinking = true; }
    const r = thinker.step();
    if (r.move === undefined) return;
    thinker = null; state.thinking = false;
    state.autoMove = r.move; state.autoPhase = 'think'; state.autoTimer = THINK_STEPS[state.autoThinkIdx];
  }

  function advanceAnim(dt) {
    const a = state.anim; if (!a) return false;
    a.t += dt;
    const leg = animLegAt(a);
    if (leg !== a.leg) { a.leg = leg; thud(); }
    if (a.t >= a.dur) {
      state.anim = null;
      if (a.crowned) tone({ freq: 660, to: 990, dur: 0.22, type: 'triangle', vol: 0.09 });
      if (state.game.winner) finish();
      else {
        saveGame();
        if (!aux.humanTurn && !state.autoMode) state.think = 0.4;
        if (humanTurn() && aux.mustCap && !capNagged) { capNagged = true; say('Capture is compulsory: the glowing pieces can capture.', 4); }
      }
    }
    return true;
  }

  function updatePlay(dt, tap) {
    const L = lay();
    if (state.autoMode) {
      if (tap && inRect(L.BTN.auto.exit, tap.x, tap.y)) { state.autoMode = false; state.autoPhase = null; state.autoMove = null; state.autoPaused = false; state.msg = null; state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; state.anim = null; state.hint = null; return; }
      if (tap && inRect(L.BTN.auto.pause, tap.x, tap.y)) { state.autoPaused = !state.autoPaused; return; }
      if (tap && inRect(L.BTN.auto.dec, tap.x, tap.y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx--; savePrefs(); } return; }
      if (tap && inRect(L.BTN.auto.inc, tap.x, tap.y)) { if (state.autoThinkIdx < THINK_STEPS.length - 1) { state.autoThinkIdx++; savePrefs(); } return; }
      if (state.autoPaused) return;                       // frozen: loop, search, animation, hint glow and the message timers
      if (state.hint) { state.hint.t += dt; if (state.hint.t > 4) state.hint = null; }
      if (advanceAnim(dt)) return;
      autoTick(dt); return;
    }
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 5) state.hint = null; }
    if (advanceAnim(dt)) return;
    if (tap && inRect(L.BTN.menu, tap.x, tap.y)) { saveGame(); state.msg = null; state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return; }
    if (!aux.humanTurn) {
      state.think -= dt; if (state.think > 0) return;
      if (!thinker) { thinker = createThinker(state.game, state.level, rng); state.thinking = true; }
      const r = thinker.step();
      if (r.move !== undefined) { thinker = null; state.thinking = false; if (r.move) play(r.move, false); }
      return;
    }
    if (hintThinker) {
      const r = hintThinker.step();
      if (r.move !== undefined) {
        const m = r.move; hintThinker = null; state.thinking = false; state.hintBusy = false;
        if (m) { state.hint = { from: m.from, to: m.to, path: m.path, t: 0 }; say(hintWhy(m), 6.5); }
      }
      return;
    }
    if (tap && inRect(L.BTN.undo, tap.x, tap.y)) {
      if (state.undo.length) { state.game = state.undo.pop(); state.sel = -1; state.path = []; state.hint = null; refresh(); say('Move taken back.'); clack(360); saveGame(); } else say('Nothing to take back yet.');
      return;
    }
    if (tap && inRect(L.BTN.hint, tap.x, tap.y)) { hintThinker = createThinker(state.game, 2, rng); state.thinking = true; state.hintBusy = true; state.sel = -1; state.path = []; recomputeSel(); return; }
    if (!tap) return;
    const geo = boardGeo(L, state.game.n, state.human === -1), i = geo.squareAt(tap.x, tap.y);
    if (i < 0) { state.sel = -1; state.path = []; recomputeSel(); return; }
    const m = tapBoard(i);
    if (m) play(m, true);
  }

  // Keyboard (web demo): arrows move a cursor over the board, Space or Enter taps that square, Escape is Menu, H hint, U take back.
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene, L = lay();
    if (input.pointer.pressed) { state.kb = false; return null; }
    const at = (r) => ({ x: r.x + 5, y: r.y + 5 });
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) return at(L.menu(!!state.saved).rows.play); return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return at(L.over.again); return null; }
    if (sc === 'settings') { if (k.has('Escape')) return at(L.settings.back); return null; }
    if (sc !== 'play') return null;
    if (k.has('Escape')) return at(state.autoMode ? L.BTN.auto.exit : L.BTN.menu);
    if (k.has('KeyH')) return at(L.BTN.hint);
    if (k.has('KeyU')) return at(L.BTN.undo);
    const n = state.game.n, flip = state.human === -1;
    let dx = 0, dy = 0;
    if (k.has('ArrowLeft')) dx = -1; else if (k.has('ArrowRight')) dx = 1; else if (k.has('ArrowUp')) dy = -1; else if (k.has('ArrowDown')) dy = 1;
    if (dx || dy) {
      state.kb = true; if (flip) { dx = -dx; dy = -dy; }
      let r = Math.max(0, Math.min(n - 1, Math.floor(state.cursor / n) + dy)), c = Math.max(0, Math.min(n - 1, (state.cursor % n) + dx));
      if ((r + c) % 2 !== 1) { const c2 = c + (dx || 1); c = c2 >= 0 && c2 < n ? c2 : c - (dx || 1); }
      state.cursor = r * n + c; return null;
    }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; const c = boardGeo(L, n, flip).center(state.cursor); return { x: c.x, y: c.y }; }
    return null;
  }

  // Store-screenshot / layout-check scenes (`?scene=NAME`, or `?shot=1&seed=N` through main.js). Real positions played by the computer, never faked art.
  function shotScene(name) {
    const reader = { rules: 'rules', howto: 'howto', about: 'about', rules3: 'rules', rulesmid: 'rules', aboutmid: 'about', aboutend: 'about' };
    if (name === 'demo') { state.scene = 'demo-limit'; return; }
    if (name === 'rules3') { state.textScaleIdx = 4; applyTextScale(); }
    if (reader[name]) { openReader(reader[name]); state.sceneT = 1; if (name === 'rulesmid') state.readerScroll = 900; if (name === 'aboutmid') state.readerScroll = 700; if (name === 'aboutend') state.readerScroll = 1700; return; }
    if (name === 'settings') { state.scene = 'settings'; return; }
    if (name === 'auto') { state.variant = 'damii'; startAuto(); return; }
    if (name === 'title') { state.scene = 'title'; return; }
    state.variant = name === 'play8' ? 'dame8' : 'damii'; state.human = name === 'black' ? -1 : 1; state.level = 1;
    start(true);
    state.msg = null;
    const wantsChain = name === 'capture' || name === 'chain';
    const walk = (plies) => {
      const gm = state.game;
      for (let i = 0; i < plies && !gm.winner; i++) {
        const ms = legalMoves(gm);
        if (wantsChain && i > 16 && gm.turn === state.human && ms.some((m) => m.caps.length > 1)) return true;
        applyMove(gm, chooseMove(gm, 0, rng, { depth: 2, nodes: 300, noise: 60 }));
      }
      return false;
    };
    if (wantsChain) { for (let attempt = 0; attempt < 8; attempt++) { if (walk(90)) break; start(true); state.msg = null; } }
    else walk(18 + (name === 'over' ? 20 : 0));
    const g = state.game;
    state.undo = []; state.think = 0; state.anim = null; refresh();
    if (name === 'chain' && g.turn === state.human) { const mv = aux.legal.slice().sort((a, b) => b.caps.length - a.caps.length)[0]; if (mv) { play(mv, true); return; } }
    if (name === 'over') { let keep = 0; for (let i = 0; i < g.cells.length; i++) if (g.cells[i] * state.human < 0 && keep++ > 0) g.cells[i] = 0; g.winner = state.human; g.reason = g.reason || 'The losing side is down to its last piece.'; state.scene = 'over'; state.stats.badges[state.variant + state.level] = true; return; }
    if (g.turn === state.human) {
      const mv = aux.legal.find((m) => m.caps.length > 1) || aux.legal.find((m) => m.caps.length) || aux.legal[0];
      if (mv && name !== 'plain') { state.sel = mv.from; recomputeSel(); }
    }
    state.lastText = g.last ? '' : '';
  }

  refresh();
  return {
    shotScene,
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.scene !== 'reader') wheelInput.dy = 0;
      if (state.msg && !(state.autoMode && state.autoPaused)) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      const p = input.pointer, kbd = keyboard(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      if (state.scene === 'title') updateTitle(tap);
      else if (state.scene === 'settings') updateSettings(tap);
      else if (state.scene === 'reader') updateReader(tap, input);
      else if (state.scene === 'play') updatePlay(dt, tap);
      else if (state.scene === 'over' && tap) {
        const O = lay().over;
        if (inRect(O.again, tap.x, tap.y)) { if (state.autoMode) startAuto(); else start(); }
        else if (inRect(O.menu, tap.x, tap.y)) { state.autoMode = false; state.msg = null; state.scene = 'title'; }
      } else if (state.scene === 'demo-limit' && tap && inRect(lay().over.menu, tap.x, tap.y)) state.scene = 'title';
    },
    render(ctx, view) { const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height); meta.previewBadge = L.badge || null; render(ctx, state, L, aux); },
    getState: () => state,
    dev: config.dev ? { refresh, start, startAuto, aux } : undefined,   // tester hooks for the layout / resize check scripts
    // Counts real play only: a live human game in progress. Menus, Rules, Settings, Auto Play, the result and demo-limit screens are exempt.
    isPreviewExempt() { return !(state.scene === 'play' && !state.autoMode && !state.game.winner); },
  };
}
