// Toguz Kumalak: state and flow. Drawing is view.js; the rule book is rules.js; the computer is engine.js; lessons.js and puzzles.js are
// content. The rule book applies a move to `state.game` at once; `state.anim` then PLAYS it (lift, sow pit by pit, capture or tuz)
// while `state.shown` (the pit counts the player sees) catches up. Input is ignored while an animation runs.
import { W, H, BTN, AUTO_BTN, SET, RULES_BTN, ABOUT_BTN, HEADER, TEXT_SCALES, THINK_STEPS, titleRows, inRect, pitNear, pitPos } from './layout.js';
import { newGame, clone, applyMove, tryMove, legalMoves, sow, sideOf, numberOf, tuzWhy } from './rules.js';
import { LEVELS, createThinker } from './engine.js';
import { LESSONS } from './lessons.js';
import { puzzleFor, puzzleGame, gains, isWeekend } from './puzzles.js';
import { RULES } from './rulesText.js';
import { ABOUT } from './about.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, HINTS = 3, SEEDSETS = ['stones', 'bone', 'turquoise'], WOODS = ['walnut', 'birch'];
const NODES_PER_TICK = 600;
// Auto Play ("Watch & Learn") REVEAL phase length. THINK is configurable (THINK_STEPS, layout.js);
// this is fixed, matching every other game's own auto-play pass this session.
const AUTO_REVEAL_SECS = 2;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, page: 0, game: newGame(), shown: null, two: false, level: 1, sound: true, calm: false, big: false, seeds: 'stones', wood: 'walnut',
    // index into TEXT_SCALES; the About/Rules reference pages' own text size, separate from the
    // `big` gameplay toggle above (that one stays governing pit/tray/message text during play).
    textScaleIdx: 0,
    // Auto Play ("Watch & Learn"): true while both sides are computer-played for teaching purposes.
    // autoThinkIdx indexes THINK_STEPS, never a raw float, same pattern as textScaleIdx.
    // autoPhase/autoMove/autoTimer are the THINK -> REVEAL -> ACT state.
    autoMode: false, autoPaused: false, autoThinkIdx: 1, autoPhase: null, autoMove: null, autoTimer: 0,
    cursor: 4, kb: false, anim: null, msg: null, think: 0, thinking: false, undo: [], hintsLeft: HINTS, hint: null,
    stats: { games: 0, wins: 0, badges: {} }, saved: null, learned: false, demoGames: 0, lesson: null, pz: null, ref: null,
    daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 }, dev: config.dev === true, worstNodes: 0,
  };
  const snap = (g) => ({ pits: g.pits.slice(), kazan: g.kazan.slice(), tuz: g.tuz.slice() });
  state.shown = snap(state.game);
  let thinker = null, hintThinker = null;

  storage.get('prefs', null).then((v) => { if (v) { state.level = v.level ?? 1; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.big = v.big ?? false; state.seeds = SEEDSETS.includes(v.seeds) ? v.seeds : 'stones'; state.wood = WOODS.includes(v.wood) ? v.wood : 'walnut'; state.textScaleIdx = Math.min(Math.max(v.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1); state.autoThinkIdx = Math.min(Math.max(v.autoThinkIdx ?? 1, 0), THINK_STEPS.length - 1); audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && v.game.winner === null && v.game.pits?.length === 18 && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, big: state.big, seeds: state.seeds, wood: state.wood, textScaleIdx: state.textScaleIdx, autoThinkIdx: state.autoThinkIdx });
  // Auto Play never writes the player's real in-progress save (it reassigns the same `state.game` a
  // real game uses - the established, safe pattern this file already uses for lessons/puzzles).
  const saveGame = () => { if (state.scene === 'play' && !state.autoMode && state.game.winner === null) { state.saved = { game: clone(state.game), two: state.two, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.games, wins: state.stats.wins }); };

  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  // Auto Play watches itself with no player to hear it for - silent by design, same principle as
  // its own free-preview exemption below. Every sound effect in this file funnels through tone()
  // (clack/seedTick/chime all call it), so gating it here silences the whole mode at once.
  const tone = (o) => { if (state.sound && !state.autoMode) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f, to: f * 0.5, dur: 0.05, type: 'sine', vol: 0.1 });
  // a pebble dropped into a pit: a dry click, pitch climbing a little along the sowing
  const seedTick = (n) => tone({ freq: 340 + n * 22, to: 200 + n * 10, dur: 0.045, type: 'triangle', vol: 0.09 });
  const chime = (k) => tone({ freq: 620 + k * 90, to: 900 + k * 120, dur: 0.24, type: 'sine', vol: 0.09 });
  const syncShown = () => { state.shown = snap(state.game); };
  const reset = (extra) => { thinker = hintThinker = null; Object.assign(state, { anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintsLeft: HINTS, ref: null, autoMode: false, autoPaused: false, autoPhase: null, autoMove: null, autoTimer: 0 }, extra); syncShown(); };
  // Auto Play: nobody controls either side - the whole existing "the computer thinks a slice per
  // tick" machinery below already handles a side it doesn't own, so making humanTurn() false for
  // both sides during Auto Play (via its own dedicated autoTick() branch instead) reuses that same
  // idea without disturbing it.
  const humanTurn = () => !state.autoMode && state.game.winner === null && (state.two || state.game.turn === 0);
  const durf = (d) => (state.calm ? d * 0.5 : d);

  function start(two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    reset({ scene: 'play', game: newGame(), two });
    say(two ? 'Player one (bottom row) begins. TAP one of your pits to sow it.' : 'You play the bottom row. TAP one of your pits to sow it.');
    monetization.track('game_start', { two, level: state.level });
  }
  // Auto Play ("Watch & Learn"): a whole game, both sides driven by the same computer opponent used
  // for a real single-player game (engine.js createThinker - no new move-picker). Never counts
  // against the free-preview timer/demo-game cap - see isPreviewExempt() and the deliberate absence
  // of any `config.demo`/`state.demoGames` read here.
  function startAuto() {
    reset({ scene: 'play', game: newGame(), two: false, autoMode: true });
    say('Auto Play: the computer plays both sides. Watch, then compare with your own guess.', 999);
  }
  function resume() {
    const v = state.saved;
    reset({ scene: 'play', game: clone(v.game), two: v.two, level: v.level ?? state.level, hintsLeft: v.hintsLeft ?? HINTS });
    say('Game restored.'); if (!humanTurn()) state.think = 0.5;
  }
  function lessonGame(l) { const g = newGame(); g.pits = l.pits.slice(); g.kazan = l.kazan.slice(); g.tuz = l.tuz.slice(); return g; }
  function startLesson(i) { reset({ scene: 'lesson', game: lessonGame(LESSONS[i]), two: true, lesson: { i, done: false, wait: 0 } }); }
  function startPuzzle() {
    const p = puzzleFor(state.daily.day);
    reset({ scene: 'puzzle', game: puzzleGame(p), two: true, pz: { puzzle: p, status: state.daily.solvedDay === state.daily.day ? 'solved' : 'ready', tries: 0, wrong: 0 } });
    if (state.pz.status === 'ready') say(p.hard ? 'Weekend puzzle. TAP the one pit that takes the most pebbles.' : 'TAP the one pit that takes the most pebbles.');
  }

  // Start playing a move: the rule book changes the game now; the animation shows it.
  function play(pit) {
    const before = clone(state.game), r = applyMove(state.game, pit);
    state.shown = snap(before); state.shown.pits[pit] = 0;
    state.anim = { r, phase: 'lift', timer: 0, idx: 0, n: before.pits[pit], sd: durf(Math.max(0.07, Math.min(0.2, 2.4 / r.path.length))), lastDrop: -1, dropT: 9, flagT: 0, flagOwner: -1, tuzFlash: null };
    state.hint = null; state.ref = null;
    clack(500);
  }
  // Advance the animation. Returns true when it just ended.
  function stepAnim(dt) {
    const A = state.anim, r = A.r, sh = state.shown;
    A.timer += dt; A.dropT += dt;
    if (A.tuzFlash) A.tuzFlash.t += dt;
    if (A.flagOwner >= 0) A.flagT += dt / durf(0.5);
    if (A.phase === 'lift') {
      if (A.timer >= durf(0.22)) {
        A.phase = 'sow'; A.timer = 0;
        if (r.n > 1) { sh.pits[r.pit] = 1; A.n -= 1; A.lastDrop = r.pit; A.dropT = 0; seedTick(0); }   // the first pebble stays home
      }
    } else if (A.phase === 'sow') {
      while (A.timer >= A.sd && A.idx < r.path.length) {
        A.timer -= A.sd; const at = r.path[A.idx], owner = r.hits[A.idx];
        if (owner >= 0) { sh.kazan[owner] += 1; A.tuzFlash = { pit: at, t: 0 }; chime(0); } else sh.pits[at] += 1;
        A.n -= 1; A.idx += 1; A.lastDrop = at; A.dropT = 0; seedTick(A.idx);
      }
      if (A.idx >= r.path.length) { A.phase = r.capture > 0 || r.tuzMade >= 0 ? 'capwait' : 'end'; A.timer = 0; }
    } else if (A.phase === 'capwait') {
      if (A.timer >= durf(0.32)) { A.phase = 'cap'; A.timer = 0; }
    } else if (A.phase === 'cap') {
      if (A.timer >= durf(0.36)) {
        const made = r.tuzMade >= 0, c = made ? r.tuzMade : r.last;
        sh.kazan[r.player] += sh.pits[c]; sh.pits[c] = 0; chime(made ? 3 : 1);
        if (made) { sh.tuz[r.player] = c; A.flagOwner = r.player; A.flagT = 0; }
        A.phase = 'end'; A.timer = 0;
      }
    } else if (A.phase === 'end') {
      if (A.timer >= durf(r.tuzMade >= 0 ? 0.9 : 0.25)) { state.anim = null; syncShown(); return true; }
    }
    return false;
  }
  const describe = (r, who) => {
    const parts = [];
    const hit = r.hits.filter((h) => h >= 0).length;
    if (r.capture > 0) parts.push(`${who} captured ${r.capture} pebbles.`);
    if (r.tuzMade >= 0) parts.push(`${who === 'You' ? 'You have' : who + ' has'} a tuz: pit ${numberOf(r.tuzMade)} of the ${sideOf(r.tuzMade) === 0 ? 'bottom' : 'top'} row is now ${who === 'You' ? 'yours' : 'theirs'} for good.`);
    if (hit > 0 && r.tuzMade < 0 && r.capture === 0) parts.push(`${hit} pebble${hit === 1 ? '' : 's'} fell into a tuz and went to its owner.`);
    if (r.tuzBlocked) parts.push(tuzWhy(r.tuzBlocked));
    return parts.join(' ');
  };
  function afterMove(r) {
    const g = state.game;
    const t = describe(r, state.two || state.autoMode ? (r.player === 0 ? 'Player one' : 'Player two') : r.player === 0 ? 'You' : 'The computer');
    if (t) say(t, 4.5);
    else if (!state.two && !state.autoMode && r.player === 1) say(`The computer sowed ${r.n} pebble${r.n === 1 ? '' : 's'}.`, 2.5);
    if (g.winner !== null) { finish(); return; }
    saveGame();
    if (!humanTurn()) state.think = 0.55;
  }
  function finish() {
    const g = state.game;
    state.scene = 'over';
    // Auto Play never touches the real player's stats or save slot - it reassigns the same
    // `state.game` a real game uses (the established, safe pattern this file already uses for
    // lessons/puzzles), so nothing here can silently corrupt a real result.
    if (!state.autoMode) {
      state.stats.games += 1; clearSave();
      if (!state.two && g.winner === 0) { state.stats.wins += 1; state.stats.badges['L' + state.level] = true; }
      saveStats();
      monetization.track('game_end', { winner: g.winner, moves: g.moves, level: state.level });
    }
    tone({ freq: g.winner === 'draw' ? 330 : 523, to: g.winner === 'draw' ? 330 : 880, dur: 0.45, type: 'triangle', vol: 0.09 });
  }

  // ---- tapping a pit -------------------------------------------------------------------------------------------
  function tapPit(i) {
    const res = tryMove(state.game, i);
    if (res.error) { state.ref = { pit: i, t: 0 }; say(res.error, 6); tone({ freq: 190, to: 130, dur: 0.15, type: 'triangle', vol: 0.06 }); return null; }
    return i;
  }

  function updateTitle(tap) {
    if (!tap) return;
    const R = titleRows(!!state.saved), hit = (r) => r && inRect(r, tap.x, tap.y);
    if (hit(R.resume)) resume();
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.play)) start(false);
    else if (hit(R.two)) start(true);
    else if (hit(R.daily)) startPuzzle();
    else if (hit(R.auto)) startAuto();
    else if (hit(R.about)) { state.scene = 'about'; state.page = 0; }
    else if (hit(R.rules)) { state.scene = 'rules'; state.page = 0; }
    else if (hit(R.settings)) state.scene = 'settings';
  }
  function updateSettings(tap) {
    if (!tap) return;
    if (inRect(SET.level, tap.x, tap.y)) { state.level = (state.level + 1) % LEVELS.length; clack(); }
    else if (inRect(SET.sound, tap.x, tap.y)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); clack(); }
    else if (inRect(SET.calm, tap.x, tap.y)) { state.calm = !state.calm; clack(); }
    else if (inRect(SET.big, tap.x, tap.y)) { state.big = !state.big; clack(); }
    else if (inRect(SET.seeds, tap.x, tap.y)) { state.seeds = SEEDSETS[(SEEDSETS.indexOf(state.seeds) + 1) % SEEDSETS.length]; clack(); }
    else if (inRect(SET.wood, tap.x, tap.y)) { state.wood = WOODS[(WOODS.indexOf(state.wood) + 1) % WOODS.length]; clack(); }
    else if (inRect(SET.back, tap.x, tap.y)) state.scene = 'title';
    else return;
    savePrefs();
  }

  // The computer thinks a slice per tick (a few hundred nodes) so a frame never stalls.
  function think(dt) {
    state.think -= dt;
    if (state.think > 0) return;
    if (!thinker) { thinker = createThinker(state.game, state.level, rng); state.thinking = true; }
    const n0 = thinker.nodes();
    for (;;) {
      const r = thinker.step(), used = thinker.nodes() - n0;
      if (r.move !== undefined) { thinker = null; state.thinking = false; if (r.move >= 0) play(r.move); return; }
      if (used >= NODES_PER_TICK) { state.worstNodes = Math.max(state.worstNodes, used); return; }
    }
  }
  // Auto Play's own decision loop: THINK (board static, the pending move already decided but held
  // back - configurable, THINK_STEPS, capped 10s) -> REVEAL (~2s: the pending move shown via the
  // same `state.hint` mechanism the Hint button already uses, so the existing glow rendering just
  // works unchanged) -> ACT (play(), the real move-execution/animation path, unchanged) -> loop, for
  // a whole game. The move-picker is always engine.js's real `createThinker` at whatever level the
  // player selected - no new AI was written.
  function autoTick(dt) {
    if (state.autoPhase === 'reveal') {
      state.autoTimer -= dt;
      if (state.autoTimer > 0) return;
      const m = state.autoMove; state.autoPhase = null; state.autoMove = null; state.hint = null;
      if (m >= 0) play(m);
      return;
    }
    if (state.autoPhase === 'think') {
      state.autoTimer -= dt;
      if (state.autoTimer > 0) return;
      const m = state.autoMove;
      if (m >= 0) state.hint = { pit: m, t: 0 };
      state.autoPhase = 'reveal'; state.autoTimer = AUTO_REVEAL_SECS;
      say('This is the move - compare it with your own guess.', AUTO_REVEAL_SECS + 0.5);
      return;
    }
    // Computing (autoPhase still null): the real thinker, stepped a slice per frame exactly like a
    // normal computer opponent already does, just not yet visible - THINK starts once it is ready.
    if (!thinker) { thinker = createThinker(state.game, state.level, rng); state.thinking = true; }
    const n0 = thinker.nodes();
    for (;;) {
      const r = thinker.step(), used = thinker.nodes() - n0;
      if (r.move !== undefined) {
        thinker = null; state.thinking = false;
        state.autoMove = r.move; state.autoPhase = 'think'; state.autoTimer = THINK_STEPS[state.autoThinkIdx];
        say(`${state.game.turn === 0 ? 'Bottom row' : 'Top row'} is thinking…`, state.autoTimer + AUTO_REVEAL_SECS + 1);
        return;
      }
      if (used >= NODES_PER_TICK) { state.worstNodes = Math.max(state.worstNodes, used); return; }
    }
  }
  function updateHint() {
    const n0 = hintThinker.nodes();
    for (;;) {
      const r = hintThinker.step();
      if (r.move !== undefined) {
        hintThinker = null; state.thinking = false;
        if (r.move >= 0) {
          const g = state.game, s = sow(g.pits.slice(), g.kazan.slice(), g.tuz.slice(), g.turn, r.move, false);
          const why = s.tuzMade >= 0 ? 'Sowing this pit makes a tuz: three pebbles now, and every pebble that lands there later is yours.'
            : s.capture > 0 ? `Sowing this pit captures ${s.capture} pebbles.`
            : s.gain > 0 ? 'A pebble drops into your tuz on the way round.'
            : 'The computer’s search likes this one: it keeps your pits safe from an even capture.';
          state.hint = { pit: r.move, t: 0 }; say(`Hint: sow the glowing pit. ${why}`, 6);
        }
        return;
      }
      if (hintThinker.nodes() - n0 >= NODES_PER_TICK) return;
    }
  }

  function updatePlay(dt, tap) {
    // Auto Play's Pause/Resume and Exit are checked FIRST, ahead of the hint/ref cosmetic timers
    // and well ahead of the move-animation step below, so they register at literally any instant -
    // mid-THINK, mid-REVEAL, mid-move-animation or mid-engine-search - never queued behind an
    // animation the way a real player's own Menu tap normally is (see the file-header comment:
    // input is otherwise withheld while state.anim is playing).
    if (state.autoMode) {
      if (tap && inRect(AUTO_BTN.pause, tap.x, tap.y)) { state.autoPaused = !state.autoPaused; return; }
      if (tap && inRect(AUTO_BTN.exit, tap.x, tap.y)) {
        saveGame(); state.autoMode = false; state.autoPaused = false; state.autoPhase = null; state.autoMove = null;
        state.msg = null;
        state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return;
      }
      // Frozen: return before the hint/ref timers, stepAnim() (the move animation) and autoTick()
      // (the THINK/REVEAL countdown and the engine search loop) - nothing below this line runs
      // while paused, so Resume always picks back up exactly where it froze, never restarting the
      // current step.
      if (state.autoPaused) return;
    }
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 6) state.hint = null; }
    if (state.ref) { state.ref.t += dt; if (state.ref.t > 0.6) state.ref = null; }
    if (state.anim) { const rr = state.anim.r; if (stepAnim(dt)) afterMove(rr); return; }
    if (!state.autoMode && tap && inRect(BTN.menu, tap.x, tap.y)) {
      saveGame();
      state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return;
    }
    if (state.autoMode) {
      // The think-time stepper takes its own dedicated rects (AUTO_BTN.dec/inc) - neither undo nor
      // a hint means anything with nobody tapping. Every other tap - a pit - is ignored: the
      // computer plays every side.
      if (tap && inRect(AUTO_BTN.dec, tap.x, tap.y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx--; savePrefs(); } return; }
      if (tap && inRect(AUTO_BTN.inc, tap.x, tap.y)) { if (state.autoThinkIdx < THINK_STEPS.length - 1) { state.autoThinkIdx++; savePrefs(); } return; }
      autoTick(dt); return;
    }
    if (!humanTurn()) { think(dt); return; }
    if (hintThinker) { updateHint(); return; }
    if (tap && inRect(BTN.undo, tap.x, tap.y)) {
      if (state.undo.length) { state.game = state.undo.pop(); syncShown(); state.hint = null; say('Move taken back.'); clack(360); saveGame(); } else say('Nothing to take back yet.');
      return;
    }
    if (tap && inRect(BTN.hint, tap.x, tap.y)) {
      if (state.hintsLeft <= 0) say('No hints left in this game.');
      else { state.hintsLeft -= 1; hintThinker = createThinker(state.game, 2, rng); state.thinking = true; }
      return;
    }
    if (!tap) return;
    const i = pitNear(tap.x, tap.y); if (i < 0) return;
    const m = tapPit(i);
    if (m !== null) { state.undo.push(clone(state.game)); play(m); }
  }

  function updateLesson(dt, tap) {
    const L = state.lesson, l = LESSONS[L.i];
    if (state.ref) { state.ref.t += dt; if (state.ref.t > 0.6) state.ref = null; }
    if (state.anim) {
      const A = state.anim;
      if (stepAnim(dt)) {
        if (L.trapped) { L.trapped = false; say(l.trap.text, 5); L.wait = 5; }
        else { L.done = true; say(l.done, 14); tone({ freq: 660, to: 990, dur: 0.2, type: 'triangle', vol: 0.08 }); }
        void A;
      }
      return;
    }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (L.wait > 0) { L.wait -= dt; if (L.wait <= 0) { L.wait = 0; state.game = lessonGame(l); syncShown(); state.msg = null; } return; }
    if (L.done) {
      if (tap && inRect(BTN.next, tap.x, tap.y)) {
        if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try a game against the computer.', 7); }
      }
      return;
    }
    if (!tap) return;
    const i = pitNear(tap.x, tap.y); if (i < 0) return;
    const m = tapPit(i); if (m === null) return;
    if (l.trap && m === l.trap.pit) { L.trapped = true; play(m); }
    else if (l.want.includes(m)) play(m);
    else say(l.hint ?? 'That is a real move, but not the one this lesson teaches. TAP the glowing pit.', 6);
  }

  function updatePuzzle(dt, tap) {
    const P = state.pz;
    if (state.ref) { state.ref.t += dt; if (state.ref.t > 0.6) state.ref = null; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (state.anim) {
      if (stepAnim(dt)) {
        if (P.wrong > 0) return;
        P.status = 'solved';
        if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); }
        say(`Solved! That takes ${P.puzzle.gain} pebbles${P.puzzle.tuzMove ? ' and makes a tuz' : ''}, the most possible.`, 8); tone({ freq: 523, to: 1046, dur: 0.4, type: 'triangle', vol: 0.09 });
      }
      return;
    }
    if (P.wrong > 0) { P.wrong -= dt; if (P.wrong <= 0) { state.game = puzzleGame(P.puzzle); syncShown(); P.wrong = 0; say('Set up again. Count where each pit’s last pebble lands, and check odd or even.'); } return; }
    if (P.status === 'solved') { if (tap && inRect(BTN.share, tap.x, tap.y)) env.share(`Toguz Kumalak daily puzzle: solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' first try'}. Streak ${state.daily.streak}.`); return; }
    if (!tap) return;
    const i = pitNear(tap.x, tap.y); if (i < 0) return;
    const m = tapPit(i); if (m === null) return;
    if (m === P.puzzle.best) play(m);
    else {
      const gg = gains(state.game).find((x) => x.m === m);
      P.tries += 1; P.wrong = 1.8; play(m);
      say(`That takes ${gg ? gg.gain : 0}. Another pit takes more.`, 4);
    }
  }

  // Keyboard (web): Left/Right along your row, 1-9 pick a pit by its number, Enter/Space sows, U undo, H hint, Esc menu.
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene;
    if (input.pointer.pressed) { state.kb = false; return null; }
    const at = (r) => ({ x: r.x + 5, y: r.y + 5 });
    if (sc === 'title') { const R = titleRows(!!state.saved); if (k.has('Enter') || k.has('Space')) return at(R.resume || R.play); return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return at(BTN.again); if (k.has('Escape')) return at(BTN.back); return null; }
    if (sc === 'settings') { if (k.has('Escape')) return at(SET.back); return null; }
    if (sc === 'about') { if (k.has('Escape')) return at(ABOUT_BTN.back); if (k.has('Enter') || k.has('Space')) return at(ABOUT_BTN.next); return null; }
    if (sc === 'rules') { if (k.has('Escape')) return at(RULES_BTN.back); if (k.has('Enter') || k.has('Space')) return at(RULES_BTN.next); return null; }
    if (sc !== 'play' && sc !== 'lesson' && sc !== 'puzzle') return null;
    if (k.has('Escape')) return at(BTN.menu);
    if (k.has('KeyU')) return at(BTN.undo);
    if (k.has('KeyH')) return at(BTN.hint);
    if (sc === 'lesson' && state.lesson.done && (k.has('Enter') || k.has('Space'))) return at(BTN.next);
    const pitOf = (c) => (state.game.turn === 0 ? c : 17 - c);
    if (k.has('ArrowLeft')) { state.kb = true; state.cursor = Math.max(0, state.cursor - 1); return null; }
    if (k.has('ArrowRight')) { state.kb = true; state.cursor = Math.min(8, state.cursor + 1); return null; }
    for (let d = 1; d <= 9; d++) if (k.has('Digit' + d)) { state.kb = true; state.cursor = state.game.turn === 0 ? d - 1 : 9 - d; const p = pitPos(pitOf(state.cursor)); return { x: p.x, y: p.y }; }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; const p = pitPos(pitOf(state.cursor)); return { x: p.x, y: p.y }; }
    return null;
  }

  return {
    update(dt, input) {
      // While Auto Play is paused, genuinely nothing about that running game advances - not just
      // the board and search (already withheld in updatePlay), but also the message banner's own
      // hold timer (it must not quietly time out and vanish underneath the freeze) and `state.t`,
      // the shared decorative clock every ambient animation reads (the sowing-direction chevron,
      // the lamplight breathing flicker, the seed shimmer, a tuz flag's wave) - otherwise a
      // screenshot taken a moment apart would show the board "paused" but still visibly alive,
      // which is not what a real freeze looks like. `state.t` only ever gates decoration, never
      // game logic, so withholding it changes nothing else.
      const autoFrozen = state.scene === 'play' && state.autoMode && state.autoPaused;
      if (!autoFrozen) state.t += dt;
      if (state.msg && !autoFrozen) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      const p = input.pointer, kbd = keyboard(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      const sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (sc === 'about') {
        if (!tap) { /* no-op */ }
        // Back steps to the previous page, or exits to the title from page 1 (owner-reported bug,
        // 2026-09-23: Back used to always jump straight to the title, discarding whatever page you
        // were reading). Next steps forward and exits on the last page ("Done", view.js) instead of
        // silently wrapping back to page 1.
        else if (inRect(ABOUT_BTN.back, tap.x, tap.y)) { if (state.page > 0) state.page -= 1; else state.scene = 'title'; }
        else if (inRect(ABOUT_BTN.next, tap.x, tap.y)) { if (state.page >= ABOUT.pages.length - 1) { state.scene = 'title'; state.page = 0; } else state.page += 1; }
        else if (inRect(HEADER.textDec, tap.x, tap.y) && state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); clack(); }
        else if (inRect(HEADER.textInc, tap.x, tap.y) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); clack(); }
      }
      else if (sc === 'rules') {
        if (!tap) { /* no-op */ }
        // Same Back/Next fix as About above, over RULES/state.page (reset to 0 on entry, line ~188).
        else if (inRect(RULES_BTN.back, tap.x, tap.y)) { if (state.page > 0) state.page -= 1; else state.scene = 'title'; }
        else if (inRect(RULES_BTN.next, tap.x, tap.y)) { if (state.page >= RULES.length - 1) { state.scene = 'title'; state.page = 0; } else state.page += 1; }
        else if (inRect(HEADER.textDec, tap.x, tap.y) && state.textScaleIdx > 0) { state.textScaleIdx--; savePrefs(); clack(); }
        else if (inRect(HEADER.textInc, tap.x, tap.y) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; savePrefs(); clack(); }
      }
      else if (sc === 'play') updatePlay(dt, tap);
      else if (sc === 'lesson') updateLesson(dt, tap);
      else if (sc === 'puzzle') updatePuzzle(dt, tap);
      else if (sc === 'over' && tap) {
        if (inRect(BTN.again, tap.x, tap.y)) { if (state.autoMode) startAuto(); else start(state.two); }
        // `autoMode` (and the free-preview exemption it drives, plus a lingering long-hold message)
        // must never linger once the player leaves - every other exit path clears it explicitly too.
        else if (inRect(BTN.back, tap.x, tap.y)) { state.autoMode = false; state.autoPaused = false; state.msg = null; state.scene = 'title'; }
      }
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
    // kit 1.6.1: exempts Auto Play from this premium game's free-preview timer (both the
    // time-accrual and the countdown badge) - the same way the menu's own attract-mode preview is
    // never gated. Checked once per frame by web/kit/preview.js; nothing else needs to change.
    isPreviewExempt() { return state.autoMode === true; },
  };
}
export { isWeekend, legalMoves };
