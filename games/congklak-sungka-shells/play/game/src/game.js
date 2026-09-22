// Congklak: state and flow. Drawing is view.js; the rule book is rules.js; the computer is engine.js; lessons.js and puzzles.js are
// content. The rule book applies a move to `state.game` at once, and returns the list of EVENTS (lift, drop, capture) that
// `state.anim` then plays back while `state.shown` (the shell counts the player sees) catches up. Two hands can move at once (the opening).
import { W, H, BTN, SET, titleRows, inRect, houseNear, posXY } from './layout.js';
import { newGame, clone, applyMove, applyOpening, tryMove, legalMoves, nextRound, outcomeOf, STORE, sideOf } from './rules.js';
import { LEVELS, createThinker, chooseOpening } from './engine.js';
import { LESSONS } from './lessons.js';
import { puzzleFor, puzzleGame, gains, isWeekend } from './puzzles.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, HINTS = 3, SEEDSETS = ['cowries', 'saga', 'pebbles'], WOODS = ['teak', 'dark'], MATCHES = ['short', 'single', 'full'];
export const WORK_PER_TICK = 60000;
const LESSON_OPENING_REPLY = 11;

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, game: newGame('short'), shown: null, two: false, level: 1, match: 'short', sound: true, calm: false, big: false, seeds: 'cowries', wood: 'teak',
    cursor: 3, kb: false, anim: null, msg: null, thinking: false, think: 0, undo: [], hintsLeft: HINTS, hint: null, pick: [null, null],
    stats: { games: 0, wins: 0, badges: {} }, saved: null, learned: false, demoGames: 0, lesson: null, pz: null, ref: null,
    daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 }, dev: config.dev === true, worstWork: 0,
  };
  state.shown = state.game.b.slice();
  let thinker = null, hintThinker = null, hintOpening = false;

  storage.get('prefs', null).then((v) => { if (v) { state.level = Math.min(v.level ?? 1, LEVELS.length - 1); state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.big = v.big ?? false; state.seeds = SEEDSETS.includes(v.seeds) ? v.seeds : 'cowries'; state.wood = WOODS.includes(v.wood) ? v.wood : 'teak'; state.match = MATCHES.includes(v.match) ? v.match : 'short'; audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && v.game.winner === null && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, big: state.big, seeds: state.seeds, wood: state.wood, match: state.match });
  const saveGame = () => { if ((state.scene === 'play' || state.scene === 'round') && state.game.winner === null) { state.saved = { game: clone(state.game), two: state.two, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.games, wins: state.stats.wins }); };

  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f, to: f * 0.5, dur: 0.05, type: 'sine', vol: 0.1 });
  const shellTick = (n) => tone({ freq: 520 + (n % 12) * 24, to: 300, dur: 0.04, type: 'triangle', vol: 0.08 });
  const chime = (k) => tone({ freq: 620 + k * 90, to: 900 + k * 120, dur: 0.24, type: 'sine', vol: 0.09 });
  const syncShown = () => { state.shown = state.game.b.slice(); };
  const reset = (extra) => { thinker = hintThinker = null; Object.assign(state, { anim: null, msg: null, thinking: false, think: 0, undo: [], hint: null, hintsLeft: HINTS, ref: null, pick: [null, null] }, extra); syncShown(); };
  const humanTurn = () => state.game.phase === 'play' && !state.game.opening && (state.two || state.game.turn === 0);
  const durf = (d) => (state.calm ? d * 0.5 : d);
  const who = (pl) => (state.two ? (pl === 0 ? 'Player one' : 'Player two') : pl === 0 ? 'You' : 'The computer');

  // the computer secretly chooses its opening house as soon as an opening begins
  function beginOpening() {
    state.pick = [null, null]; hintOpening = false;
    if (!state.two && state.scene !== 'lesson') state.pick[1] = chooseOpening(state.game, 1, state.level, rng);
    if (state.scene === 'lesson') state.pick[1] = LESSON_OPENING_REPLY;
  }
  function start(two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    reset({ scene: 'play', game: newGame(state.match), two });
    beginOpening();
    say(two ? 'Both players TAP one of your own houses at the same time. Player one: right column. Player two: left column.' : 'You play the right-hand column. TAP one of your glowing houses; the computer chooses its first house at the same moment.', 7);
    monetization.track('game_start', { two, level: state.level, match: state.match });
  }
  function resume() {
    const v = state.saved;
    reset({ scene: v.game.phase === 'roundOver' ? 'round' : 'play', game: clone(v.game), two: v.two, level: v.level ?? state.level, hintsLeft: v.hintsLeft ?? HINTS });
    if (state.game.opening && state.scene === 'play') beginOpening();
    say('Game restored.'); if (state.scene === 'play' && !state.game.opening && !humanTurn()) state.think = 0.5;
  }
  function startLesson(i, keep) {
    const l = LESSONS[i], g = newGame('single');
    if (l.b) { g.b.fill(0); g.opening = false; for (const k in l.b) g.b[k] = l.b[k]; }
    reset({ scene: 'lesson', game: g, two: true, lesson: { i, step: 0, done: false, ...(keep || {}) } });
    if (g.opening) beginOpening();
  }
  function startPuzzle() {
    const p = puzzleFor(state.daily.day);
    reset({ scene: 'puzzle', game: puzzleGame(p), two: true, pz: { puzzle: p, status: state.daily.solvedDay === state.daily.day ? 'solved' : 'ready', tries: 0, wrong: 0 } });
    if (state.pz.status === 'ready') say(p.hard ? 'Weekend puzzle. TAP the one house that collects the most shells in a single move.' : 'TAP the one house that collects the most shells in a single move.', 7);
  }

  // ---- playing events back ---------------------------------------------------------------------------------------------------
  function startAnim(r, before) {
    const beats = r.ev.length ? r.ev[r.ev.length - 1].b + 1 : 1;
    state.shown = before;
    state.anim = { r, ev: r.ev, i: 0, timer: 0, tt: 0, end: 0, sd: durf(Math.max(0.045, Math.min(0.16, 5 / beats))), hands: [null, null], cap: null, lastDrop: {}, fast: false };
    state.hint = null; state.ref = null;
  }
  function play(house) {
    const before = state.game.b.slice(), r = applyMove(state.game, house);
    startAnim(r, before); clack(500);
  }
  function playOpening() {
    const before = state.game.b.slice(), r = applyOpening(state.game, state.pick[0], state.pick[1]);
    startAnim(r, before); clack(500);
  }
  function applyEv(A, e) {
    const sh = state.shown;
    if (e.t === 'lift') { sh[e.pos] = 0; const p = posXY(e.pos); A.hands[e.p] = { n: e.n, x: p.x, y: p.y, tx: p.x, ty: p.y }; clack(480); }
    else if (e.t === 'drop') {
      sh[e.pos] += 1; const h = A.hands[e.p]; const p = posXY(e.pos);
      if (h) { h.n -= 1; h.tx = p.x; h.ty = p.y; }
      A.lastDrop[e.pos] = A.tt; A.count = (A.count ?? 0) + 1;
      if (e.pos === STORE[e.p]) chime(0); else if (!(A.fast && A.count % 3)) shellTick(A.count);
    } else if (e.t === 'cap') { A.cap = { e, t: 0, dur: durf(0.55) }; A.hands[e.p] = null; chime(1); }
  }
  // Advance the animation. Returns true when it just ended.
  function stepAnim(dt) {
    const A = state.anim, sh = state.shown;
    A.tt += dt;
    for (const h of A.hands) if (h) { const k = Math.min(1, dt * 22); h.x += (h.tx - h.x) * k; h.y += (h.ty - h.y) * k; }
    if (A.cap) {
      A.cap.t += dt * (A.fast ? 3 : 1);
      if (A.cap.t >= A.cap.dur) { const e = A.cap.e; sh[e.pos] = 0; sh[e.from] = 0; sh[STORE[e.p]] += e.n; A.cap = null; A.timer = 0; }
      return false;
    }
    A.timer += dt * (A.fast ? 6 : 1);
    while (!A.cap && A.i < A.ev.length && A.timer >= A.sd) {
      A.timer -= A.sd; const b = A.ev[A.i].b;
      while (A.i < A.ev.length && A.ev[A.i].b === b && !A.cap) { applyEv(A, A.ev[A.i]); A.i += 1; }
    }
    if (A.i >= A.ev.length && !A.cap) { A.end += dt * (A.fast ? 3 : 1); if (A.end >= durf(0.3)) { state.anim = null; syncShown(); return true; } }
    return false;
  }
  const endWords = (r) => (r.end === 'capture' ? `took ${r.gain} shell${r.gain === 1 ? '' : 's'}` : r.end === 'store' ? 'ended in the storehouse' : r.end === 'limit' ? 'sowed on and on' : '');
  function afterMove(r) {
    const g = state.game;
    if (r.opening) {
      const bits = [];
      for (const pl of [0, 1]) if (r.ends[pl] === 'capture') bits.push(`${who(pl)} took ${r.gains[pl]}.`);
      say(`${bits.join(' ')} ${who(r.first)} finished first and plays next.`.trim(), 5);
    } else {
      const txt = endWords(r);
      if (r.end === 'capture') say(`${who(r.player)} shot: ${r.gain} shells to the storehouse.`, 4);
      else if (r.extra) say(state.two ? `${who(r.player)}: last shell in the storehouse. Play again!` : r.player === 0 ? 'Last shell in your storehouse: play again!' : 'The computer plays again.', 3.5);
      else if (!state.two && r.player === 1 && txt === '') say(`The computer sowed ${r.n} shell${r.n === 1 ? '' : 's'}.`, 2.5);
    }
    if (g.phase === 'roundOver') { state.scene = 'round'; saveGame(); tone({ freq: 440, to: 660, dur: 0.35, type: 'triangle', vol: 0.09 }); return; }
    if (g.phase === 'matchOver') { finish(); return; }
    saveGame();
    if (!humanTurn() && !g.opening) state.think = 0.55;
  }
  function finish() {
    const g = state.game;
    state.scene = 'over'; state.stats.games += 1; clearSave();
    if (!state.two && g.winner === 0) { state.stats.wins += 1; state.stats.badges['L' + state.level] = true; }
    saveStats();
    tone({ freq: g.winner === 'draw' ? 330 : 523, to: g.winner === 'draw' ? 330 : 880, dur: 0.45, type: 'triangle', vol: 0.09 });
    monetization.track('game_end', { winner: g.winner, moves: g.moves, level: state.level, rounds: g.rounds.length });
  }
  const refuse = (i, msg) => { state.ref = { pit: i, t: 0 }; say(msg, 6); tone({ freq: 190, to: 130, dur: 0.15, type: 'triangle', vol: 0.06 }); };

  // ---- taps ---------------------------------------------------------------------------------------------------------------------
  // tapping a house during the opening: each player picks once
  function tapOpening(i) {
    const pl = sideOf(i), g = state.game;
    if (pl < 0) return false;
    if (!state.two && pl === 1) { refuse(i, 'That is your opponent’s house. TAP one of your own, in the right-hand column.'); return false; }
    if (g.burnt[i]) { refuse(i, 'That house is burnt shut for this match.'); return false; }
    if (g.b[i] === 0) { refuse(i, 'That house is empty. TAP a house that has shells.'); return false; }
    if (state.pick[pl] != null && state.scene !== 'lesson') return false;
    state.pick[pl] = i; clack(600);
    return state.pick[0] != null && state.pick[1] != null;
  }
  function tapHouse(i) {
    const res = tryMove(state.game, i);
    if (res.error) { refuse(i, res.error); return null; }
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
    else if (hit(R.about)) state.scene = 'about';
    else if (hit(R.how)) state.scene = 'how';
    else if (hit(R.settings)) state.scene = 'settings';
  }
  function updateSettings(tap) {
    if (!tap) return;
    if (inRect(SET.level, tap.x, tap.y)) { state.level = (state.level + 1) % LEVELS.length; clack(); }
    else if (inRect(SET.match, tap.x, tap.y)) { state.match = MATCHES[(MATCHES.indexOf(state.match) + 1) % MATCHES.length]; clack(); }
    else if (inRect(SET.sound, tap.x, tap.y)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); clack(); }
    else if (inRect(SET.calm, tap.x, tap.y)) { state.calm = !state.calm; clack(); }
    else if (inRect(SET.big, tap.x, tap.y)) { state.big = !state.big; clack(); }
    else if (inRect(SET.seeds, tap.x, tap.y)) { state.seeds = SEEDSETS[(SEEDSETS.indexOf(state.seeds) + 1) % SEEDSETS.length]; clack(); }
    else if (inRect(SET.wood, tap.x, tap.y)) { state.wood = WOODS[(WOODS.indexOf(state.wood) + 1) % WOODS.length]; clack(); }
    else if (inRect(SET.back, tap.x, tap.y)) state.scene = 'title';
    else return;
    savePrefs();
  }

  // The computer thinks a slice per tick (a fixed number of drops) so a frame never stalls.
  function think(dt) {
    state.think -= dt;
    if (state.think > 0) return;
    if (!thinker) { thinker = createThinker(state.game, state.level, rng); state.thinking = true; }
    const w0 = thinker.work();
    for (;;) {
      const r = thinker.step();
      if (r.move !== undefined) { thinker = null; state.thinking = false; if (r.move >= 0) play(r.move); return; }
      const dw = thinker.work() - w0; if (dw >= WORK_PER_TICK) { state.worstWork = Math.max(state.worstWork, dw); return; }
    }
  }
  function updateHint() {
    const w0 = hintThinker.work();
    for (;;) {
      const r = hintThinker.step();
      if (r.move !== undefined) {
        hintThinker = null; state.thinking = false;
        if (r.move >= 0) {
          const o = outcomeOf(state.game, r.move);
          const why = o.end === 'capture' ? `It ends in your empty house and takes ${o.gain} shells.` : o.extra ? 'Its last shell falls in your storehouse, so you play again.' : o.gain > 0 ? `It collects ${o.gain} shells on the way.` : 'The computer’s search likes this one: it leaves your opponent the fewest good replies.';
          state.hint = { pit: r.move, t: 0 }; say(`Hint: sow the glowing house. ${why}`, 6);
        }
        return;
      }
      if (hintThinker.work() - w0 >= WORK_PER_TICK) return;
    }
  }

  function humanTap(dt, tap) {
    if (tap && inRect(BTN.undo, tap.x, tap.y)) {
      if (state.undo.length) { state.game = state.undo.pop(); syncShown(); state.hint = null; if (state.game.opening) beginOpening(); say('Move taken back.'); clack(360); saveGame(); } else say('Nothing to take back yet.');
      return true;
    }
    if (tap && inRect(BTN.hint, tap.x, tap.y)) {
      if (state.hintsLeft <= 0) say('No hints left in this game.');
      else if (state.game.opening) {
        state.hintsLeft -= 1; const h = chooseOpening(state.game, 0, 3, null); state.hint = { pit: h, t: 0 };
        const m = outcomeOfOpening(h); say(`Hint: sow the glowing house. On its own it ${m}.`, 6);
      } else { state.hintsLeft -= 1; hintThinker = createThinker(state.game, 2, rng); state.thinking = true; }
      return true;
    }
    return false;
  }
  function outcomeOfOpening(h) {
    const g = clone(state.game); g.opening = false; g.turn = 0; g.b.fill(0, 8, 15); // solo run: ignore what the opponent does
    for (let k = 8; k < 15; k++) if (!g.burnt[k]) g.b[k] = state.game.b[k];
    const o = applyMove(g, h, false);
    return o.end === 'capture' ? `takes ${o.gain} shells` : o.extra ? 'ends in your storehouse' : 'is safe and simple';
  }

  function updatePlay(dt, tap) {
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 6) state.hint = null; }
    if (state.ref) { state.ref.t += dt; if (state.ref.t > 0.6) state.ref = null; }
    if (state.anim) {
      if (tap && !inRect(BTN.menu, tap.x, tap.y)) state.anim.fast = true;
      const r = state.anim.r;
      if (tap && inRect(BTN.menu, tap.x, tap.y)) { finishAnimNow(); saveGame(); state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return; }
      if (stepAnim(dt)) afterMove(r);
      return;
    }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return; }
    const g = state.game;
    if (g.phase !== 'play') return;
    if (g.opening) {
      if (humanTap(dt, tap)) return;
      if (!tap) return;
      const i = houseNear(tap.x, tap.y); if (i < 0) return;
      if (tapOpening(i)) { state.undo.push(clone(g)); playOpening(); }
      return;
    }
    if (!humanTurn()) { think(dt); return; }
    if (hintThinker) { updateHint(); return; }
    if (humanTap(dt, tap)) return;
    if (!tap) return;
    const i = houseNear(tap.x, tap.y); if (i < 0) return;
    const m = tapHouse(i);
    if (m !== null) { state.undo.push(clone(g)); play(m); }
  }
  function finishAnimNow() { while (state.anim) { state.anim.fast = true; if (stepAnim(1)) break; } }

  function updateLesson(dt, tap) {
    const L = state.lesson, l = LESSONS[L.i], g = state.game;
    if (state.ref) { state.ref.t += dt; if (state.ref.t > 0.6) state.ref = null; }
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 6) state.hint = null; }
    if (state.anim) {
      if (tap && !inRect(BTN.menu, tap.x, tap.y)) state.anim.fast = true;
      if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.anim = null; state.scene = 'title'; return; }
      const r = state.anim.r;
      if (stepAnim(dt)) {
        const st = l.steps[L.step];
        if (L.step + 1 < l.steps.length && g.turn === 0 && g.phase === 'play' && !r.opening && r.extra) { say(st.done, 3); L.step += 1; }
        else { L.done = true; say(st.done, 20); tone({ freq: 660, to: 990, dur: 0.2, type: 'triangle', vol: 0.08 }); }
      }
      return;
    }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (L.done) {
      if (tap && inRect(BTN.next, tap.x, tap.y)) {
        if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try a game against the computer.', 7); }
      }
      return;
    }
    if (!tap) return;
    const i = houseNear(tap.x, tap.y); if (i < 0) return;
    const st = l.steps[L.step];
    if (g.opening) {
      if (sideOf(i) !== 0) { refuse(i, 'Those are your opponent’s houses. TAP one of yours, on the right.'); return; }
      if (g.b[i] === 0 || g.burnt[i]) { refuse(i, 'That house cannot be sown.'); return; }
      state.pick[0] = i; playOpening(); return;
    }
    const m = tapHouse(i); if (m === null) return;
    if (st.want.includes(m)) play(m); else say(st.hint ?? 'That is a real move, but not the one this lesson teaches. TAP the glowing house.', 6);
  }

  function updatePuzzle(dt, tap) {
    const P = state.pz;
    if (state.ref) { state.ref.t += dt; if (state.ref.t > 0.6) state.ref = null; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; state.anim = null; return; }
    if (state.anim) {
      if (tap) state.anim.fast = true;
      if (stepAnim(dt)) {
        if (P.wrong > 0) return;
        P.status = 'solved';
        if (state.daily.solvedDay !== state.daily.day) { state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day; storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak }); }
        say(`Solved! That collects ${P.puzzle.gain} shells, the most possible.`, 8); tone({ freq: 523, to: 1046, dur: 0.4, type: 'triangle', vol: 0.09 });
      }
      return;
    }
    if (P.wrong > 0) { P.wrong -= dt; if (P.wrong <= 0) { state.game = puzzleGame(P.puzzle); syncShown(); P.wrong = 0; say('Set up again. Count where each house’s last shell lands.'); } return; }
    if (P.status === 'solved') { if (tap && inRect(BTN.share, tap.x, tap.y)) env.share(`Congklak daily puzzle: solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' first try'}. Streak ${state.daily.streak}.`); return; }
    if (!tap) return;
    const i = houseNear(tap.x, tap.y); if (i < 0) return;
    const m = tapHouse(i); if (m === null) return;
    if (m === P.puzzle.best) play(m);
    else {
      const gg = gains(state.game).find((x) => x.m === m);
      P.tries += 1; P.wrong = 2.4; play(m);
      say(`That collects ${gg ? gg.gain : 0}. Another house collects more.`, 4);
    }
  }

  function updateRound(tap) {
    if (!tap || !inRect(BTN.cont, tap.x, tap.y)) return;
    const burnt = nextRound(state.game);
    reset({ scene: 'play', game: state.game, hintsLeft: HINTS, level: state.level, two: state.two }); beginOpening();
    say(`Round ${state.game.round}: ${burnt.length ? `${burnt.length} house${burnt.length === 1 ? '' : 's'} burnt shut. ` : ''}Both players TAP a first house.`, 6);
    tone({ freq: 500, to: 800, dur: 0.25, type: 'triangle', vol: 0.08 }); saveGame();
  }

  // Keyboard (web): Up/Down along your column, Enter/Space sows, U undo, H hint, F fast-forward, Esc menu.
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene;
    if (input.pointer.pressed) { state.kb = false; return null; }
    const at = (r) => ({ x: r.x + 5, y: r.y + 5 });
    if (sc === 'title') { const R = titleRows(!!state.saved); if (k.has('Enter') || k.has('Space')) return at(R.resume || R.play); return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return at(BTN.again); if (k.has('Escape')) return at(BTN.back); return null; }
    if (sc === 'round') { if (k.has('Enter') || k.has('Space')) return at(BTN.cont); return null; }
    if (sc === 'settings') { if (k.has('Escape')) return at(SET.back); return null; }
    if (sc === 'about' || sc === 'how') { if (k.has('Escape') || k.has('Enter')) return at(BTN.aboutBack); return null; }
    if (sc !== 'play' && sc !== 'lesson' && sc !== 'puzzle') return null;
    if (k.has('Escape')) return at(BTN.menu);
    if (k.has('KeyF') && state.anim) state.anim.fast = true;
    if (k.has('KeyU')) return at(BTN.undo);
    if (k.has('KeyH')) return at(BTN.hint);
    if (sc === 'lesson' && state.lesson.done && (k.has('Enter') || k.has('Space'))) return at(BTN.next);
    if (k.has('ArrowUp')) { state.kb = true; state.cursor = Math.min(6, state.cursor + 1); return null; }
    if (k.has('ArrowDown')) { state.kb = true; state.cursor = Math.max(0, state.cursor - 1); return null; }
    if (k.has('Enter') || k.has('Space')) { state.kb = true; const g = state.game; const pos = g.opening || g.turn === 0 ? state.cursor : 14 - state.cursor; const p = posXY(pos); return { x: p.x, y: p.y }; }
    return null;
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      const p = input.pointer, kbd = keyboard(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      const sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (sc === 'about' || sc === 'how') { if (tap && inRect(BTN.aboutBack, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'play') updatePlay(dt, tap);
      else if (sc === 'lesson') updateLesson(dt, tap);
      else if (sc === 'puzzle') updatePuzzle(dt, tap);
      else if (sc === 'round') updateRound(tap);
      else if (sc === 'over' && tap) {
        if (inRect(BTN.again, tap.x, tap.y)) start(state.two);
        else if (inRect(BTN.back, tap.x, tap.y)) state.scene = 'title';
      }
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
  };
}
export { isWeekend };
