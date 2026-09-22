// Durak: state and flow. Drawing is in view.js; rules in rules.js; the computer's brain and solver in ai.js;
// lessons.js, puzzles.js and about.js are content. See design/GDD.md for the ruleset and scope.
//
// Controls (also taught on-screen): TAP a card to lift it, TAP it again or TAP the table to play it; or DRAG it
// onto the table / onto the exact card it should beat. TAP Take to pick up, TAP Bito when done throwing in,
// TAP Hint for the best move with a reason, TAP Undo for one step back.
import { W, H, TOP, ACTIONS, actionRect, handSlot, pairSpot, TABLE_ZONE, MENU_BTN, BACK, SETUP, SETTINGS_ROWS, SETTINGS_ROW, inRect } from './layout.js';
import * as R from './rules.js';
import { createThinker, explain, ROLLOUTS_PER_FRAME } from './ai.js';
import { LESSONS } from './lessons.js';
import { createPuzzleMaker, bestReply } from './puzzles.js';
import { render, lessonNextRect, dailyShareRect } from './view.js';

export const meta = { width: W, height: H };
const DEMO_LIMIT = 2;
const NAMES = ['You', 'Neighbour', 'Guest', 'Traveller'];
const DRAG_THRESHOLD = 18;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, game: null, names: NAMES, four: false, big: false, sound: true, calm: false,
    back: 'gzhel', setup: { n: 2, mode: 'pod', level: 2 }, stats: { played: 0, wins: 0 },
    sel: -1, drag: null, legalCards: new Set(), beatSlots: null, canXfer: false, actionEnabled: () => false,
    msg: '', modeName: 'Podkidnoy', hint: null, hintsLeft: 3, undo: null, thinking: false, seenOpen: false,
    saved: null, config, demoLimit: DEMO_LIMIT, demoPlays: 0,
    lesson: null, daily: { day: config.day ?? 0, streak: 0, solvedDay: -1, status: 'making', puzzle: null, wrongMsg: '' },
    pickup: null,
  };
  let thinker = null, hintThinker = null, dailyMaker = createPuzzleMaker(state.daily.day), dailyReady = null;
  // The daily puzzle may be solved from either seat; the table always shows the taught seat as seat 0 (you).
  const flipSeat = (s) => (s === 0 ? 1 : s === 1 ? 0 : s);
  function reseatToZero(g, you) {
    if (you === 0) return g;
    return { ...g, hands: [g.hands[1], g.hands[0]], known: [g.known[1], g.known[0]], out: [g.out[1], g.out[0]],
      attacker: flipSeat(g.attacker), defender: flipSeat(g.defender), actor: flipSeat(g.actor),
      loser: g.loser === -1 ? -1 : flipSeat(g.loser), refused: g.refused.map((r) => ({ ...r, p: flipSeat(r.p) })) };
  }

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state, { four: !!v.four, big: !!v.big, sound: v.sound ?? true, calm: !!v.calm, back: v.back || 'gzhel' }); audio.setMuted?.(!state.sound); state.setup.level = v.level ?? 2; state.setup.mode = v.mode || 'pod'; state.setup.n = v.n || 2; } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v }; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoPlays', 0).then((v) => { state.demoPlays = Math.max(state.demoPlays, v); });
  storage.get('save', null).then((v) => { if (v && v.game && !v.game.over) state.saved = v; });
  const savePrefs = () => storage.set('prefs', { four: state.four, big: state.big, sound: state.sound, calm: state.calm, back: state.back, level: state.setup.level, mode: state.setup.mode, n: state.setup.n });
  const saveGame = () => { if (state.scene === 'play' && state.game && !state.game.over) { state.saved = { game: R.clone(state.game), setup: { ...state.setup } }; storage.set('save', state.saved); } else storage.remove('save'); };

  const tone = (o) => { if (state.sound) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.85, to: f * 0.35, dur: 0.07, type: 'sine', vol: 0.1 });
  const chime = () => { tone({ freq: 523, dur: 0.1, vol: 0.08 }); tone({ freq: 784, to: 1046, dur: 0.18, vol: 0.08 }); };
  const say = (m) => { state.msg = m; };

  function resetPlayState() {
    Object.assign(state, { sel: -1, drag: null, hint: null, hintsLeft: 3, undo: null, thinking: false, pickup: null, seenOpen: false });
    thinker = hintThinker = null;
  }

  function newMatch() {
    if (config.demo && state.demoPlays >= DEMO_LIMIT) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoPlays += 1; storage.set('demoPlays', state.demoPlays); }
    const g = R.newDeal(rng, state.setup.n, state.setup.mode);
    resetPlayState();
    Object.assign(state, { scene: 'play', game: g, modeName: state.setup.mode === 'pod' ? 'Podkidnoy' : 'Perevodnoy' });
    say(g.attacker === 0 ? 'You hold the lowest trump: lead any card.' : `${state.names[g.attacker]} leads first.`);
    refreshLegal();
    monetization.track('match_start', { n: state.setup.n, mode: state.setup.mode, level: state.setup.level });
  }
  function resume() {
    const v = state.saved; resetPlayState();
    Object.assign(state, { scene: 'play', game: R.clone(v.game), setup: { ...v.setup }, modeName: v.setup.mode === 'pod' ? 'Podkidnoy' : 'Perevodnoy' });
    say('Match restored.'); refreshLegal();
  }
  function startLesson(i) {
    const L = LESSONS[i]; resetPlayState();
    const g = L.build();
    Object.assign(state, { scene: 'lesson', game: g, lesson: { i, done: false }, modeName: g.mode === 'per' ? 'Perevodnoy' : 'Podkidnoy' });
    say(L.text); refreshLegal();
  }
  function startDaily() {
    resetPlayState();
    if (dailyReady) {
      const solved = state.daily.solvedDay === state.daily.day;
      Object.assign(state, { scene: 'daily', game: R.clone(dailyReady.game), daily: { ...state.daily, status: solved ? 'solved' : 'ready', puzzle: dailyReady, wrongMsg: '' } });
    } else Object.assign(state, { scene: 'daily', game: null, daily: { ...state.daily, status: 'making' } });
    refreshLegal();
  }
  function finish() {
    const g = state.game;
    state.stats.played += 1; if (g.loser !== 0) state.stats.wins += 1;
    storage.set('stats', state.stats); storage.remove('save'); state.saved = null;
    tone({ freq: g.loser === 0 ? 260 : 523, to: g.loser === 0 ? 180 : 880, dur: 0.4, type: 'triangle', vol: 0.1 });
    monetization.track('match_end', { loser: g.loser, n: g.n, mode: g.mode });
  }

  // ---- geometry helpers -------------------------------------------------------------------------------------
  function handHit(x, y) {
    const g = state.game, hand = g.hands[0];
    for (let i = hand.length - 1; i >= 0; i--) {
      const s = handSlot(i, hand.length);
      const lifted = state.sel === hand[i];
      const yy = lifted ? s.y - 46 : s.y;
      if (Math.abs(x - s.x) < 78 && Math.abs(y - yy) < 108) return hand[i];
    }
    return null;
  }
  function nearestTablePair(x, y) {
    const g = state.game; let best = -1, bd = 1e9;
    g.table.forEach((t, i) => { if (t.d >= 0) return; const s = pairSpot(i); const d = Math.hypot(x - s.x, y - s.y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  const overTable = (x, y) => inRect(TABLE_ZONE, x, y);

  // ---- what the human may currently do -------------------------------------------------------------------------
  function refreshLegal() {
    const g = state.game;
    if (!g || g.actor !== 0 || g.over) { state.legalCards = new Set(); state.beatSlots = null; state.canXfer = false; state.actionEnabled = () => false; return; }
    const moves = R.legalMoves(g);
    state.legalCards = new Set(moves.filter((m) => m.t !== 'take' && m.t !== 'pass').map((m) => m.c));
    state.canXfer = moves.some((m) => m.t === 'xfer');
    state.beatSlots = state.sel >= 0 ? new Set(moves.filter((m) => m.t === 'def' && m.c === state.sel).map((m) => m.i)) : null;
    const has = (t) => moves.some((m) => m.t === t);
    state.actionEnabled = (k) => (k === 'take' ? has('take') : k === 'bito' ? has('pass') : k === 'hint' ? state.hintsLeft > 0 : k === 'undo' ? !!state.undo : k === 'seen');
  }

  function afterHumanMove() {
    const g = state.game;
    if (g.over) finish(); else saveGame();
    state.sel = -1; state.hint = null;
    refreshLegal();
  }

  // Applies a move for whichever seat is acting (used by both the human path and the AI/daily-reply path so
  // pick-up animation and sound stay in one place).
  function commit(g, move) {
    const ev = R.apply(g, move);
    const takeEv = ev.find((e) => e.k === 'take');
    if (takeEv) state.pickup = { seat: takeEv.p, cards: takeEv.cards, t: 0, dur: 0.5, n: g.n };
    clack(move.t === 'take' ? 260 : move.t === 'def' || move.t === 'xfer' ? 460 : 400);
  }

  function tryPlay(move) {
    const g = state.game;
    const why = R.whyNot(g, move);
    if (why) { say(why); clack(220); return false; }
    if (g.actor === 0) state.undo = R.clone(g);
    commit(g, move);
    say('');
    afterHumanMove();
    return true;
  }

  // Given where a card was tapped/dropped on the table (dropAtPairIndex may be -1/null for "anywhere"), works out
  // exactly which rules.js move that means for the currently selected card. Shared by every scene (play, lesson,
  // daily) and by both input styles (tap-tap and drag-drop) so a dragged card is judged identically to a tapped one.
  function computeSelectedMove(dropAtPairIndex) {
    const g = state.game;
    if (state.sel < 0) return null;
    if (g.phase === 'lead' || g.phase === 'throw') return { t: 'atk', c: state.sel };
    if (g.phase === 'defend') {
      const candidates = state.beatSlots ? [...state.beatSlots] : [];
      const i = dropAtPairIndex != null && candidates.includes(dropAtPairIndex) ? dropAtPairIndex : candidates[0];
      if (i != null) return { t: 'def', c: state.sel, i };
      if (state.canXfer) return { t: 'xfer', c: state.sel };
    }
    return null;
  }
  // 'play' scene: apply via tryPlay (handles undo stack, save, refusal messages).
  function playFromSelection(dropAtPairIndex) {
    const move = computeSelectedMove(dropAtPairIndex);
    if (move) tryPlay(move);
    else if (state.sel >= 0 && state.game.phase === 'defend') say(R.whyNot(state.game, { t: 'def', c: state.sel, i: 0 }) || 'That card does not help here.');
  }
  // Routes a resolved move to whichever scene is teaching right now, so a DRAGGED card is graded exactly like a
  // tapped one (see onUp below) — lessons and the daily deal must never be bypassed by the drag input path.
  function playSelectedInScene(dropAtPairIndex) {
    const move = computeSelectedMove(dropAtPairIndex);
    if (!move) { state.sel = -1; refreshLegal(); return; }
    if (state.scene === 'play') tryPlay(move);
    else if (state.scene === 'lesson') applyLessonMove(move);
    else if (state.scene === 'daily') applyDailyMove(move);
  }

  // ---- pointer handling: drag OR tap-tap, unified. Hand-card selection lives ENTIRELY here (onDown/onUp) so the
  // per-scene handlers below only deal with what a tap does elsewhere (table, buttons) — never with hand cards.
  // True once the current screen has nothing left to teach/solve, so a stray card drag can no longer mutate the
  // frozen position behind a "done"/"solved" overlay (it would otherwise apply invisibly and confuse the next shot).
  function teachingDone() {
    if (state.scene === 'lesson') return !!state.lesson?.done;
    if (state.scene === 'daily') return state.daily.status !== 'ready';
    return false;
  }
  function onDown(x, y) {
    const g = state.game;
    if (!g || g.over || g.actor !== 0 || state.seenOpen || teachingDone()) return;
    const c = handHit(x, y);
    if (c === null) return;
    const already = state.sel === c;
    state.sel = c; refreshLegal(); clack(560);
    state.drag = { c, x, y, downX: x, downY: y, moved: false, already };
  }
  function onMove(x, y) {
    if (!state.drag) return;
    state.drag.x = x; state.drag.y = y;
    if (Math.hypot(x - state.drag.downX, y - state.drag.downY) > DRAG_THRESHOLD) state.drag.moved = true;
  }
  function onUp(x, y) {
    if (!state.drag) return;
    const d = state.drag; state.drag = null;
    if (!d.moved) { if (d.already) { state.sel = -1; refreshLegal(); } return; } // a second tap on the same card cancels it
    if (overTable(x, y)) playSelectedInScene(nearestTablePair(x, y));
    else { state.sel = -1; refreshLegal(); }
  }

  // ---- per-scene updates --------------------------------------------------------------------------------------
  function updateTitle(tap) {
    if (!tap) return;
    const items = state.saved ? ['continue', 'new', 'learn', 'daily', 'about', 'settings'] : ['new', 'learn', 'daily', 'about', 'settings'];
    items.forEach((k, i) => {
      if (!inRect(MENU_BTN(i), tap.x, tap.y)) return;
      clack();
      if (k === 'continue') resume();
      else if (k === 'new') state.scene = 'setup';
      else if (k === 'learn') startLesson(0);
      else if (k === 'daily') startDaily();
      else if (k === 'about') state.scene = 'about';
      else if (k === 'settings') state.scene = 'settings';
    });
    if (inRect(TOP.sound, tap.x, tap.y)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); savePrefs(); clack(); }
  }
  function updateSettings(tap) {
    if (!tap) return;
    if (inRect(BACK, tap.x, tap.y)) { state.scene = 'title'; return; }
    for (let i = 0; i < SETTINGS_ROWS; i++) {
      if (!inRect(SETTINGS_ROW(i), tap.x, tap.y)) continue;
      clack();
      if (i === 0) { state.sound = !state.sound; audio.setMuted?.(!state.sound); }
      else if (i === 1) state.calm = !state.calm;
      else if (i === 2) state.big = !state.big;
      else if (i === 3) state.four = !state.four;
      else if (i === 4) state.back = state.back === 'gzhel' ? 'khokhloma' : 'gzhel';
      savePrefs();
    }
  }
  function updateSetup(tap) {
    if (!tap) return;
    if (inRect(BACK, tap.x, tap.y)) { state.scene = 'title'; return; }
    SETUP.players.forEach((p) => { if (inRect(p.r, tap.x, tap.y)) { state.setup.n = p.v; clack(); } });
    SETUP.modes.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { state.setup.mode = i === 0 ? 'pod' : 'per'; clack(); } });
    SETUP.levels.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { state.setup.level = i + 1; clack(); } });
    if (inRect(SETUP.start, tap.x, tap.y)) { savePrefs(); newMatch(); }
  }

  // The computer's move: time-sliced. Levels 1-2 resolve in a single step; 3-4 run a bounded number of
  // Monte-Carlo rollouts per frame (ai.js ROLLOUTS_PER_FRAME) and resume on the next update() call.
  function computerTurn() {
    const g = state.game, level = state.setup.level;
    if (!thinker) { thinker = createThinker(g, g.actor, level, rng); state.thinking = !thinker.done; }
    const mv = thinker.step();
    if (mv) { thinker = null; state.thinking = false; commit(g, mv); if (g.over) finish(); else saveGame(); refreshLegal(); }
  }

  function updatePlay(dt, tap) {
    const g = state.game;
    if (state.pickup) { state.pickup.t += dt; if (state.pickup.t >= state.pickup.dur) state.pickup = null; }
    if (g.over) {
      if (tap) {
        if (inRect({ x: 130, y: 800, w: 460, h: 90 }, tap.x, tap.y)) newMatch();
        else if (inRect({ x: 130, y: 908, w: 460, h: 76 }, tap.x, tap.y)) state.scene = 'title';
      }
      return;
    }
    if (tap && inRect(TOP.menu, tap.x, tap.y)) { saveGame(); state.scene = 'title'; return; }
    if (tap && inRect(TOP.sound, tap.x, tap.y)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); savePrefs(); return; }
    if (hintThinker) {
      const mv = hintThinker.step();
      if (mv) { hintThinker = null; state.hint = { move: mv, text: explain(g, mv) }; }
    }
    if (tap) {
      let acted = false;
      ACTIONS.forEach((k) => {
        if (acted || !inRect(actionRect(k), tap.x, tap.y) || !state.actionEnabled(k)) return;
        acted = true; clack();
        if (k === 'take') tryPlay({ t: 'take' });
        else if (k === 'bito') tryPlay({ t: 'pass' });
        else if (k === 'undo') { if (state.undo) { state.game = state.undo; state.undo = null; state.sel = -1; refreshLegal(); say('Move taken back.'); } }
        else if (k === 'seen') state.seenOpen = !state.seenOpen;
        else if (k === 'hint') { state.hintsLeft -= 1; hintThinker = createThinker(g, 0, Math.min(4, state.setup.level + 1), rng); }
      });
      if (acted) return;
    }
    if (g.actor !== 0) { computerTurn(); return; }
    if (!tap) return;
    if (state.seenOpen) { state.seenOpen = false; return; }
    if (overTable(tap.x, tap.y) && handHit(tap.x, tap.y) === null) { const i = nearestTablePair(tap.x, tap.y); playFromSelection(i >= 0 ? i : null); }
  }

  function updateLesson(tap) {
    const g = state.game, L = LESSONS[state.lesson.i];
    if (tap && inRect(BACK, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (state.lesson.done) {
      if (tap && inRect(lessonNextRect(state), tap.x, tap.y)) {
        const next = state.lesson.i + 1;
        // Demo cut (GDD > Demo cut): the free web preview teaches lessons 1-2 only.
        if (config.demo && next >= 2) state.scene = 'demo-limit';
        else if (next < LESSONS.length) startLesson(next);
        else state.scene = 'title';
      }
      return;
    }
    if (!tap) return;
    let move = null;
    if (overTable(tap.x, tap.y) && state.sel >= 0) move = computeSelectedMove(nearestTablePair(tap.x, tap.y));
    else if (inRect(actionRect('take'), tap.x, tap.y) && R.legalMoves(g).some((m) => m.t === 'take')) move = { t: 'take' };
    else if (inRect(actionRect('bito'), tap.x, tap.y) && R.legalMoves(g).some((m) => m.t === 'pass')) move = { t: 'pass' };
    if (move) applyLessonMove(move);
  }
  // Applies a candidate move during a lesson and grades it against what that lesson is teaching (L.want/L.at).
  // Used by both the tap-tap path (updateLesson above) and a real drag-drop (onUp -> playSelectedInScene).
  function applyLessonMove(move) {
    const g = state.game, L = LESSONS[state.lesson.i];
    const why = R.whyNot(g, move);
    if (why) { say(why); state.sel = -1; refreshLegal(); return; }
    const you = g.you ?? 0;
    commit(g, move);
    const ok = move.t === L.want && (!L.at || L.at.includes(move.c)) && (L.want !== 'win' || (g.over && g.loser !== you));
    state.sel = -1; refreshLegal();
    if (ok) { state.lesson.done = true; say(''); chime(); }
    else say('Not quite — read the tip above and try again.');
  }

  function updateDaily(tap) {
    if (tap && inRect(BACK, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (state.daily.status === 'making') {
      for (let k = 0; k < 4 && !dailyReady; k++) {
        const r = dailyMaker.step();
        if (r.puzzle) { dailyReady = r.puzzle; dailyReady.game = reseatToZero(dailyReady.game, dailyReady.you); dailyReady.you = 0; }
      }
      if (dailyReady) {
        const solved = state.daily.solvedDay === state.daily.day;
        state.game = R.clone(dailyReady.game);
        state.daily = { ...state.daily, status: solved ? 'solved' : 'ready', puzzle: dailyReady };
        refreshLegal();
      }
      return;
    }
    const g = state.game;
    if (state.daily.status === 'solved') {
      if (tap && inRect(dailyShareRect(), tap.x, tap.y)) env.share(`Durak daily deal solved. Streak ${state.daily.streak}.`);
      return;
    }
    if (g.actor !== 0) { commit(g, bestReply(g)); refreshLegal(); checkDailyOutcome(); return; }
    if (!tap) return;
    let move = null;
    if (overTable(tap.x, tap.y) && state.sel >= 0) move = computeSelectedMove(nearestTablePair(tap.x, tap.y));
    else if (inRect(actionRect('take'), tap.x, tap.y)) move = { t: 'take' };
    else if (inRect(actionRect('bito'), tap.x, tap.y)) move = { t: 'pass' };
    if (move) applyDailyMove(move);
  }
  // Applies a candidate move during the daily deal (tap-tap or drag) and checks whether it kept the taught seat safe.
  function applyDailyMove(move) {
    const g = state.game;
    const why = R.whyNot(g, move);
    if (why) { say(why); state.sel = -1; refreshLegal(); return; }
    commit(g, move); state.sel = -1; refreshLegal();
    checkDailyOutcome();
  }
  function checkDailyOutcome() {
    const g = state.game;
    if (!g.over) return;
    if (g.loser !== 0) {
      state.daily.status = 'solved';
      if (state.daily.solvedDay !== state.daily.day) {
        state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1;
        state.daily.solvedDay = state.daily.day;
        storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak });
      }
      chime();
    } else {
      state.daily.wrongMsg = 'That lost the round. Set up again and look for the safe line.';
      state.game = R.clone(dailyReady.game);
      refreshLegal();
    }
  }

  const updateAbout = (tap) => { if (tap && inRect(BACK, tap.x, tap.y)) state.scene = 'title'; };

  // Keyboard equivalents for the web demo (docs/GAME-CONTRACT.md): Left/Right choose a card, Enter/Space plays it,
  // T Take, B Bito, H Hint, U Undo, Escape Menu — the exact verbs taught in the Controls section of the GDD.
  function routeMove(move) {
    if (state.scene === 'play') tryPlay(move);
    else if (state.scene === 'lesson') applyLessonMove(move);
    else if (state.scene === 'daily') applyDailyMove(move);
  }
  function keyboard(input) {
    const k = input.keys.pressed;
    if (!k.size) return;
    if (k.has('Escape') && ['play', 'lesson', 'daily', 'setup', 'about', 'settings'].includes(state.scene)) {
      if (state.scene === 'play') saveGame();
      state.scene = 'title'; return;
    }
    if (!['play', 'lesson', 'daily'].includes(state.scene) || !state.game || state.game.actor !== 0 || state.game.over || teachingDone()) return;
    const g = state.game, hand = g.hands[0];
    if ((k.has('ArrowRight') || k.has('ArrowLeft')) && hand.length) {
      const idx = hand.indexOf(state.sel);
      const next = idx < 0 ? 0 : (idx + (k.has('ArrowRight') ? 1 : -1) + hand.length) % hand.length;
      state.sel = hand[next]; refreshLegal(); clack(560); return;
    }
    if (k.has('Enter') || k.has('Space')) { const mv = computeSelectedMove(null); if (mv) routeMove(mv); return; }
    if (k.has('KeyT') && state.actionEnabled('take')) { routeMove({ t: 'take' }); return; }
    if (k.has('KeyB') && state.actionEnabled('bito')) { routeMove({ t: 'pass' }); return; }
    if (k.has('KeyH') && state.scene === 'play' && state.actionEnabled('hint')) { state.hintsLeft -= 1; hintThinker = createThinker(g, 0, Math.min(4, state.setup.level + 1), rng); return; }
    if (k.has('KeyU') && state.scene === 'play' && state.actionEnabled('undo')) { state.game = state.undo; state.undo = null; state.sel = -1; refreshLegal(); say('Move taken back.'); }
  }

  return {
    update(dt, input) {
      state.t += dt;
      const p = input.pointer;
      if (p.pressed) onDown(p.x, p.y);
      if (state.drag) onMove(p.x, p.y);
      if (p.released) onUp(p.x, p.y);
      keyboard(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : null;
      if (state.scene === 'title') updateTitle(tap);
      else if (state.scene === 'setup') updateSetup(tap);
      else if (state.scene === 'play') updatePlay(dt, tap);
      else if (state.scene === 'lesson') updateLesson(tap);
      else if (state.scene === 'daily') updateDaily(tap);
      else if (state.scene === 'about') updateAbout(tap);
      else if (state.scene === 'settings') updateSettings(tap);
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
  };
}
