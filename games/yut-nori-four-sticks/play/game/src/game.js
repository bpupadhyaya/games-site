// Yut Nori: state and flow. Rules are rules.js, the computer is ai.js, drawing is view.js. See design/GDD.md.
//
// A turn: THROW (TAP or SWIPE the pad; yut and mo throw again) -> SPEND the held throws (TAP a chip to choose a throw,
// TAP a token, TAP a glowing point) -> a capture earns one more throw. A refused tap always says why.
import { W, H, PAD, BTN, CHIP, POINTS, TRAY, titleRows, PAGE_BACK, inRect, pointNear } from './layout.js';
import { newGame, clone, throwSticks, sticksFor, recordThrow, settle, applyMove, movesFor, whyNot, HOME, NAMES, moveKey } from './rules.js';
import { LEVELS, createThinker, reasonFor } from './ai.js';
import { LESSONS, lessonGame } from './lessons.js';
import { createPuzzleMaker, rate, dayIsWeekend } from './puzzle.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, HINTS = 3;
const TEAM_NAME = ['Blue', 'Red'];

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const restSticks = () => [0, 1, 2, 3].map((i) => ({ x: 360 + (i - 1.5) * 128, y: PAD.y + PAD.h / 2 + (i % 2 ? 12 : -12), rot: (i - 1.5) * 0.09, flat: false }));
  const state = {
    scene: 'title', t: 0, game: newGame(), two: false, level: 2, sound: true, calm: false, big: false,
    sel: null, selV: null, selK: -1, anim: null, msg: null, undo: [], hint: null, hintsLeft: HINTS, kb: false, kbTarget: null, kbIdx: 0,
    throwAnim: null, grip: null, rest: restSticks(), result: null, chipPop: 0, fx: [], think: 0, thinking: false,
    stats: { games: 0, wins: 0, badges: {} }, saved: null, learned: false, demoGames: 0,
    lesson: null, force: [], pz: null, daily: { day: config.day ?? 0, solvedDay: -1, streak: 0 }, dev: config.dev === true,
  };
  let thinker = null, hintThinker = null, puzzleToday = null, frozen = false, thinkStep = 0;
  const maker = createPuzzleMaker(state.daily.day);

  storage.get('prefs', null).then((v) => { if (v) { state.level = v.level ?? 2; state.sound = v.sound ?? true; state.calm = v.calm ?? false; state.big = v.big ?? false; audio.setMuted?.(!state.sound); } });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('daily', null).then((v) => { if (v) { state.daily.solvedDay = v.solvedDay ?? -1; state.daily.streak = v.streak ?? 0; } });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && v.game.winner < 0 && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, big: state.big });
  const saveGame = () => { if (state.scene === 'play' && state.game.winner < 0 && !state.anim && !state.throwAnim) { state.saved = { game: clone(state.game), two: state.two, level: state.level, hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  const dur = (d) => (state.calm ? d * 0.6 : d);
  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound) audio.tone(o); };
  const clack = (f = 520, v = 0.11) => tone({ freq: f, to: f * 0.42, dur: 0.07, type: 'triangle', vol: v });
  const spark = (x, y, rgb, n = 14) => { if (state.calm) return; for (let k = 0; k < n; k++) { const a = rng.range(0, Math.PI * 2), sp = rng.range(60, 220); state.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, r: rng.range(3, 6.5), rgb, t: 0, dur: rng.range(0.5, 0.9) }); } };

  const humanTurn = () => state.game.winner < 0 && (state.two || state.game.turn === 0);
  const reset = (extra) => Object.assign(state, { sel: null, selV: null, selK: -1, anim: null, msg: null, undo: [], hint: null, hintsLeft: HINTS, throwAnim: null, grip: null, result: null, fx: [], think: 0.5, thinking: false, rest: restSticks(), force: [] }, extra);

  function start(two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    thinker = hintThinker = null;
    reset({ scene: 'play', game: newGame(0), two });
    say(two ? 'Blue throws first. TAP the pad or SWIPE up to throw the sticks.' : 'You are Blue and you throw first. TAP the pad or SWIPE up.', 6);
    monetization.track('game_start', { two, level: state.level });
  }
  function resume() {
    const v = state.saved; thinker = hintThinker = null;
    reset({ scene: 'play', game: clone(v.game), two: v.two, level: v.level ?? state.level, hintsLeft: v.hintsLeft ?? HINTS });
    say('Game restored.'); afterSettle();
  }
  function startLesson(i) {
    const l = LESSONS[i]; thinker = hintThinker = null;
    reset({ scene: 'lesson', game: lessonGame(l), two: false, lesson: { i, done: false, throws: 0, moves: 0 }, force: (l.force || []).slice() });
    afterSettle();
  }
  function startPuzzle() {
    thinker = hintThinker = null;
    if (!puzzleToday) { reset({ scene: 'puzzle', game: newGame(), pz: { status: 'making' } }); return; }
    reset({ scene: 'puzzle', game: clone(puzzleToday.g), two: false, pz: { status: state.daily.solvedDay === state.daily.day ? 'done' : 'ready', puzzle: puzzleToday, stars: 3 } });
    afterSettle();
    say(puzzleToday.weekend ? 'Weekend challenge: three throws. Spend them all, as well as you can.' : 'Spend both throws as well as you can. Captures, shortcuts and safety all count.', 7);
  }

  // Choose the throw chip and token that should be active whenever a move phase begins.
  function afterSettle() {
    const g = state.game;
    state.sel = null; state.selV = null; state.selK = -1; state.hint = null;
    if (g.phase === 'move' && humanTurn()) { chooseChip(0, true); }
    if (!humanTurn() && g.winner < 0) state.think = 0.55;
  }
  function chooseChip(k, silent) {
    const g = state.game; if (k < 0 || k >= g.pending.length) return;
    state.selK = k; state.selV = g.pending[k]; state.sel = null; state.hint = null;
    const origins = [...new Set(movesFor(g, g.turn, state.selV).map((m) => m.from))];
    if (origins.length === 1) state.sel = origins[0];
    if (!silent) clack(700, 0.07);
  }

  // ---- the throw -----------------------------------------------------------------------------------
  function beginThrow(strength, fx, fy) {
    const forced = state.force.length ? state.force.shift() : undefined;
    const res = forced !== undefined ? { flat: sticksFor(forced, rng), v: forced } : throwSticks(rng);
    const cx = PAD.x + PAD.w / 2;
    const sticks = res.flat.map((flat, i) => ({
      x0: fx + (i - 1.5) * 14, y0: fy, xf: cx + (i - 1.5) * 132 + rng.range(-14, 14), yf: PAD.y + PAD.h / 2 + rng.range(-26, 26),
      rot0: rng.range(-1.1, 1.1), rotf: rng.range(-0.42, 0.42), turns: 1 + Math.floor(rng.range(1, 2.6 + strength * 2)), flat, d: i * 0.04,
    }));
    state.throwAnim = { t: 0, dur: dur(1.15 + 0.1 * strength), sticks, v: res.v, strength: state.calm ? 0.3 : strength, cues: [0, 0, 0, 0], flat: res.flat };
    state.undo = []; state.hint = null; state.sel = null; state.result = null; state.grip = null;
    tone({ freq: 240, to: 520, dur: 0.12, type: 'sine', vol: 0.06 });
  }
  function updateThrow(dt) {
    const a = state.throwAnim; a.t += dt;
    a.sticks.forEach((st, i) => {
      const u = (a.t - st.d) / (a.dur - 0.14);
      if (a.cues[i] < 1 && u >= 0.6) { a.cues[i] = 1; clack(700 + i * 90 + rng.range(-40, 40), 0.13); }
      if (a.cues[i] < 2 && u >= 0.8) { a.cues[i] = 2; clack(560 + i * 70, 0.07); }
      if (a.cues[i] < 3 && u >= 0.92) { a.cues[i] = 3; clack(430 + i * 40, 0.04); }
    });
    if (a.t < a.dur) return;
    state.throwAnim = null;
    state.rest = a.sticks.map((st, i) => ({ x: st.xf, y: st.yf, rot: st.rotf, flat: st.flat }));
    finishThrow(a);
  }
  function finishThrow(a) {
    const g = state.game, v = a.v, team = g.turn;
    state.result = { v, t: 0 }; state.chipPop = 1;
    if (v >= 4) { tone({ freq: 523, to: 1046, dur: 0.35, type: 'triangle', vol: 0.1 }); spark(360, PAD.y + 110, '255,215,110', 22); }
    else if (v === -1) tone({ freq: 300, to: 180, dur: 0.25, type: 'sawtooth', vol: 0.05 });
    else tone({ freq: 440 + v * 60, to: 660 + v * 60, dur: 0.14, type: 'sine', vol: 0.06 });
    if (state.lesson) state.lesson.throws += 1;
    const res = recordThrow(g, v);
    const who = state.two ? TEAM_NAME[team] : team === 0 ? 'You' : 'Red';
    if (res.dropped.length) {
      say(v === -1 && !g.g[team].length ? `Back-do, but ${state.two ? TEAM_NAME[team] : team === 0 ? 'you have' : 'Red has'} no token on the board to step back. The throw is lost.` : `${NAMES[v]} cannot move any token now. The turn passes.`, 5);
    } else if (g.phase === 'throw' && g.turn === team) say(`${NAMES[v]}! ${who === 'You' ? 'You throw' : who + ' throws'} again.`, 3);
    else if (v === -1) say('Back-do: one step BACK for a token.', 3.5);
    if (state.scene === 'lesson') { lessonCheck({ throwMade: true }); }
    if (state.scene === 'puzzle') return;
    afterSettle();
  }

  // ---- moves ---------------------------------------------------------------------------------------
  function play(m) {
    const g = state.game, team = g.turn, capTeam = 1 - team;
    const grp = m.from === -1 ? null : g.g[team].find((x) => x.pos === m.from);
    const cap = m.to !== HOME && m.to !== 'wait' ? g.g[capTeam].find((x) => x.pos === m.to) : null;
    const n = m.from === -1 ? 1 : grp.n;
    const info = applyMove(g, m);
    const steps = m.path.length, d = Math.max(0.3, steps * 0.15 + (m.back ? 0.05 : 0.08));
    state.anim = { team, from: m.from, path: m.path.slice(), n, back: m.back, t: 0, dur: dur(d), to: m.to === HOME || m.to === 'wait' ? -9 : m.to, home: info.home, cap: cap ? { team: capTeam, pos: m.to, n: cap.n } : null, capT: dur(d), info, m };
    state.sel = null; state.hint = null; state.selV = null; state.selK = -1;
    clack(m.short ? 620 : 480, 0.1);
    monetization.track('move', { v: m.v });
  }
  function updateAnim(dt) {
    const a = state.anim, before = a.t; a.t += dt;
    const per = a.dur / a.path.length;
    if (Math.floor(a.t / per) > Math.floor(before / per) && a.t < a.dur) clack(500 + Math.floor(a.t / per) * 40, 0.06);
    if (a.t >= a.dur + (a.cap ? 0.5 : a.home ? 0.15 : 0)) endAnim(a);
  }
  function endAnim(a) {
    state.anim = null;
    const g = state.game, p = a.to >= 0 ? POINTS[a.to] : POINTS[0];
    if (a.cap) {
      clack(210, 0.14); tone({ freq: 180, to: 70, dur: 0.24, type: 'sawtooth', vol: 0.06 }); spark(p.x, p.y, a.team === 0 ? '90,140,255' : '255,110,80', 26);
      const what = a.cap.n > 1 ? 'a stack of ' + a.cap.n : 'a token';
      say(state.two ? `${TEAM_NAME[a.team]} captured ${what}! It goes back to the start and ${TEAM_NAME[a.team]} throws again.` : a.team === 0 ? 'Captured! The red token goes back to the start and you throw again.' : `Red captured your ${a.cap.n > 1 ? 'stack of ' + a.cap.n : 'token'}! It goes back to the start. Red throws again.`, 5);
    } else if (a.home) { tone({ freq: 523, to: 784, dur: 0.3, type: 'triangle', vol: 0.09 }); spark(POINTS[0].x, POINTS[0].y, '255,215,110', 18); }
    else if (a.info.stack) { clack(380, 0.1); say('Stacked: they now move as one.', 3); }
    if (g.winner >= 0 && state.scene !== 'lesson') { finish(); return; }
    if (state.scene !== 'lesson') settle(g);
    if (state.scene === 'lesson') { lessonCheck({ move: a }); if (!state.lesson.done) afterSettle(); return; }
    if (state.scene === 'puzzle') { puzzleCheck(); return; }
    saveGame(); afterSettle();
  }

  // ---- taps on the board ---------------------------------------------------------------------------
  function stackAt(i) { const g = state.game; return g.g[g.turn].find((x) => x.pos === i); }
  function tapBoard(x, y) {
    const g = state.game, me = g.turn;
    if (g.phase === 'throw') { say('First throw the sticks: TAP the pad or SWIPE up on it.'); return null; }
    if (g.phase !== 'move') return null;
    // waiting tokens (the tray)
    const T = TRAY[me]; let trayHit = false;
    for (let k = 0; k < 4; k++) { const p = T.wait(k); if (Math.hypot(p.x - x, p.y - y) < 38) trayHit = true; }
    const i = pointNear(x, y);
    // a destination?
    if (state.sel != null && state.selV != null) {
      const ms = movesFor(g, me, state.selV).filter((m) => m.from === state.sel);
      let hit = null;
      if (i >= 0) hit = ms.find((m) => (m.to === HOME || m.to === 'wait' ? 0 : m.to) === i && !m.short) || ms.find((m) => (m.to === HOME || m.to === 'wait' ? 0 : m.to) === i);
      if (hit) return hit;
    }
    if (trayHit || i === 0) {
      if (g.wait[me] > 0) { if (state.selV != null && !movesFor(g, me, state.selV).some((m) => m.from === -1)) { say(whyNot(g, -1, state.selV, null)); return null; } state.sel = -1; clack(620, 0.08); return null; }
      if (state.sel != null && state.selV != null) { say(whyNot(g, state.sel, state.selV, 0)); return null; }
      say('No tokens are waiting. TAP a token on the board.'); return null;
    }
    if (i < 0) { state.sel = null; return null; }
    const mine = stackAt(i);
    if (mine) {
      if (state.selV != null && !movesFor(g, me, state.selV).some((m) => m.from === i)) { say(whyNot(g, i, state.selV, null)); state.sel = i; return null; }
      state.sel = i; clack(600, 0.08); return null;
    }
    const theirs = g.g[1 - me].find((s) => s.pos === i);
    if (state.sel != null && state.selV != null) { say(theirs ? `${NAMES[state.selV]} does not land there. ${whyNot(g, state.sel, state.selV, i)}` : whyNot(g, state.sel, state.selV, i)); return null; }
    say(theirs ? `That is ${TEAM_NAME[1 - me]}'s token. TAP one of your ${TEAM_NAME[me]} tokens.` : `First TAP one of your ${TEAM_NAME[me]} tokens, then a glowing point.`);
    return null;
  }
  function tapChip(x, y) {
    const g = state.game, n = g.pending.length;
    for (let k = 0; k < n; k++) if (inRect(CHIP(k, n), x, y)) { chooseChip(k); return true; }
    return false;
  }
  function humanAct(m) {
    const g = state.game;
    if (state.scene === 'lesson') {
      const l = LESSONS[state.lesson.i], c = clone(g); const info = applyMove(c, m);
      const okTo = !l.to || l.to.includes(m.to);
      const okKind = l.goal === 'short' ? m.short : l.goal === 'stack' ? info.stack : l.goal === 'capture' ? info.capture > 0 : l.goal === 'back' ? m.back : l.goal === 'home' ? m.to === HOME : l.goal === 'both' ? true : l.goal === 'move' ? true : false;
      if (!(okTo && okKind)) { state.sel = null; say(l.hint ?? 'Not that one. Read the lesson and try the glowing point that matches.'); state.selV = null; afterSettle(); return; }
    }
    state.undo.push({ g: clone(g), selK: state.selK }); play(m);
  }

  // ---- lessons and the daily challenge ---------------------------------------------------------------
  function lessonCheck(ev) {
    const L = state.lesson, l = LESSONS[L.i]; if (L.done) return;
    let ok = false;
    if (ev.throwMade) ok = l.goal === 'throw' && L.throws >= l.count;
    if (ev.move) { L.moves += 1; ok = l.goal === 'both' ? state.game.pending.length === 0 : l.goal !== 'throw' }
    if (ok) { L.done = true; state.msg = null; tone({ freq: 660, to: 990, dur: 0.22, type: 'triangle', vol: 0.09 }); state.game.winner = -1; state.game.pending = state.game.phase === 'move' ? [] : state.game.pending; if (state.game.phase === 'throw') state.game.phase = 'throw'; }
  }
  function puzzleCheck() {
    const P = state.pz, g = state.game;
    if (g.phase === 'move' && g.turn === 0 && g.winner < 0) { afterSettle(); return; }
    const stars = g.winner === 0 ? 3 : rate(P.puzzle, g);
    P.status = 'done'; P.stars = stars; state.msg = null;
    if (state.daily.solvedDay !== state.daily.day) {
      state.daily.streak = state.daily.solvedDay === state.daily.day - 1 ? state.daily.streak + 1 : 1; state.daily.solvedDay = state.daily.day;
      storage.set('daily', { solvedDay: state.daily.solvedDay, streak: state.daily.streak });
    }
    tone({ freq: 523, to: 1046, dur: 0.4, type: 'triangle', vol: 0.09 });
  }
  function finish() {
    const g = state.game;
    state.scene = 'over'; state.stats.games += 1; clearSave();
    if (!state.two && g.winner === 0) { state.stats.wins += 1; state.stats.badges['L' + state.level] = true; }
    storage.set('stats', state.stats); storage.set('progress', { played: state.stats.games, wins: state.stats.wins });
    tone({ freq: 523, to: 784, dur: 0.45, type: 'triangle', vol: 0.09 });
    monetization.track('game_end', { winner: g.winner, level: state.level });
  }

  // ---- per-scene updates -----------------------------------------------------------------------------
  function updateTitle(tap) {
    for (let k = 0; k < 2 && !puzzleToday; k++) puzzleToday = maker.step().puzzle;
    if (!tap) return;
    const R = titleRows(!!state.saved), hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(R.resume)) resume();
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.play)) start(false);
    else if (hit(R.two)) start(true);
    else if (hit(R.daily)) startPuzzle();
    else if (hit(R.level)) { state.level = (state.level + 1) % LEVELS.length; savePrefs(); clack(); }
    else if (hit(R.sound)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); savePrefs(); clack(); }
    else if (hit(R.calm)) { state.calm = !state.calm; savePrefs(); clack(); }
    else if (hit(R.big)) { state.big = !state.big; savePrefs(); clack(); }
    else if (hit(R.about)) state.scene = 'about';
    else if (hit(R.how)) state.scene = 'how';
  }
  // Pad: TAP throws at once; a SWIPE up throws harder and higher.
  function updatePad(dt, input, kbThrow) {
    const p = input.pointer, g = state.game;
    const can = g.phase === 'throw' && !state.throwAnim && !state.anim && humanTurn() && !(state.scene === 'puzzle');
    if (!can) { state.grip = null; return false; }
    const cx = PAD.x + PAD.w / 2, by = PAD.y + PAD.h - 30;
    if (kbThrow) { beginThrow(0.6, cx, by); return true; }
    if (p.pressed && inRect(PAD, p.x, p.y)) { state.grip = { x: p.x, y: p.y, sx: p.x, sy: p.y, t: 0 }; return true; }
    if (state.grip) {
      const gp = state.grip; gp.t += dt; gp.x = p.x; gp.y = p.y;
      const rise = gp.sy - p.y;
      if (rise > 90) { beginThrow(Math.min(1, 0.3 + rise / 380 + 0.5 / Math.max(0.05, gp.t) * 0.04), gp.x, gp.y); return true; }
      if (p.released || !p.down) { const moved = Math.hypot(p.x - gp.sx, p.y - gp.sy); beginThrow(moved < 40 ? 0.55 : Math.min(1, 0.4 + moved / 300), gp.x, Math.min(gp.y, by)); return true; }
    }
    return false;
  }
  function computerTurn(dt) {
    const g = state.game;
    if (state.throwAnim || state.anim) return;
    state.think -= dt; if (state.think > 0) return;
    if (g.phase === 'throw') { beginThrow(rng.range(0.4, 0.95), PAD.x + PAD.w / 2 + rng.range(-60, 60), PAD.y + PAD.h - 20); return; }
    if (!thinker) { thinker = createThinker(g, state.level, rng); state.thinking = true; }
    const r = thinker.step(60);
    if (r.done) { thinker = null; state.thinking = false; if (r.move) { play(r.move); } }
  }
  function updateSceneGame(dt, input, tap, sc) {
    const g = state.game;
    if (state.throwAnim) { updateThrow(dt); return; }
    if (state.anim) { updateAnim(dt); return; }
    if (sc === 'lesson' && state.lesson.done) { if (tap && inRect(BTN.next, tap.x, tap.y)) { if (state.lesson.i + 1 < LESSONS.length) startLesson(state.lesson.i + 1); else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try the computer at Beginner or Cautious.', 7); } } else if (tap && inRect(BTN.menu, tap.x, tap.y)) state.scene = 'title'; return; }
    if (sc === 'puzzle' && state.pz.status === 'done') { if (tap && inRect(BTN.hint, tap.x, tap.y)) env.share(`Yut Nori daily challenge: ${'★'.repeat(state.pz.stars)}${'☆'.repeat(3 - state.pz.stars)}. Streak ${state.daily.streak}.`); else if (tap && inRect(BTN.menu, tap.x, tap.y)) state.scene = 'title'; return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); state.scene = 'title'; thinker = hintThinker = null; state.thinking = false; return; }
    if (!humanTurn()) { computerTurn(dt); return; }
    if (updatePad(dt, input, input.keys.pressed.has('Space') && g.phase === 'throw')) return;
    if (hintThinker) {
      const r = hintThinker.step(80);
      if (r.done) { hintThinker = null; state.thinking = false; if (r.move) { const m = r.move; state.hint = { from: m.from, v: m.v, to: m.to, t: 0 }; const k = g.pending.indexOf(m.v); if (k >= 0) { state.selK = k; state.selV = m.v; state.sel = m.from; } say(`Hint: use ${NAMES[m.v]} on the glowing token. ${reasonFor(g, m)}`, 6); } }
      return;
    }
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 8) state.hint = null; }
    if (!tap) return;
    if (inRect(BTN.undo, tap.x, tap.y) && sc !== 'lesson') {
      const u = state.undo.pop();
      if (u && g.phase === 'move') { state.game = u.g; state.hint = null; afterSettle(); say('Move taken back.'); clack(360); } else say(g.phase === 'move' ? 'Nothing to take back yet. A throw cannot be taken back.' : 'A throw cannot be taken back.');
      return;
    }
    if (inRect(BTN.hint, tap.x, tap.y) && sc !== 'lesson') {
      if (sc === 'puzzle') { state.game = clone(state.pz.puzzle.g); state.undo = []; afterSettle(); say('Set up again.'); return; }
      if (g.phase !== 'move') say('Throw first, then ask for a hint.');
      else if (state.hintsLeft <= 0) say('No hints left in this game.');
      else { state.hintsLeft -= 1; hintThinker = createThinker(g, 4, rng); state.thinking = true; }
      return;
    }
    if (g.phase !== 'move') { if (g.phase === 'throw') { if (inRect(PAD, tap.x, tap.y)) return; } return; }
    if (tapChip(tap.x, tap.y)) return;
    const m = tapBoard(tap.x, tap.y);
    if (m) humanAct(m);
  }
  function keyboard(input) {
    const k = input.keys.pressed, g = state.game, sc = state.scene;
    if (input.pointer.pressed) { state.kb = false; return null; }
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) { const R = titleRows(!!state.saved); return { x: R.play.x + 5, y: R.play.y + 5 }; } return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return { x: BTN.again.x + 5, y: BTN.again.y + 5 }; return null; }
    if (sc === 'about' || sc === 'how') { if (k.has('Escape') || k.has('Enter')) return { x: PAGE_BACK.x + 5, y: PAGE_BACK.y + 5 }; return null; }
    if (sc !== 'play' && sc !== 'lesson' && sc !== 'puzzle') return null;
    if (k.has('Escape')) return { x: BTN.menu.x + 5, y: BTN.menu.y + 5 };
    if (sc === 'lesson' && state.lesson.done && (k.has('Enter') || k.has('Space'))) return { x: BTN.next.x + 5, y: BTN.next.y + 5 };
    if (k.has('KeyH')) return { x: BTN.hint.x + 5, y: BTN.hint.y + 5 };
    if (k.has('KeyU')) return { x: BTN.undo.x + 5, y: BTN.undo.y + 5 };
    if (g.phase !== 'move' || !humanTurn() || state.anim || state.throwAnim) return null;
    const cycle = (arr, cur, d) => arr[(Math.max(0, arr.indexOf(cur)) + d + arr.length) % arr.length];
    if (k.has('Tab')) { state.kb = true; chooseChip((state.selK + 1) % Math.max(1, g.pending.length), false); return null; }
    const origins = [...new Set(movesFor(g, g.turn, state.selV ?? g.pending[0]).map((m) => m.from))];
    if (k.has('ArrowLeft') || k.has('ArrowRight')) { state.kb = true; if (!origins.length) return null; state.sel = cycle(origins, state.sel, k.has('ArrowRight') ? 1 : -1); state.kbIdx = 0; state.kbTarget = state.sel < 0 ? 0 : state.sel; return null; }
    const dests = movesFor(g, g.turn, state.selV ?? g.pending[0]).filter((m) => m.from === state.sel);
    if (k.has('ArrowUp') || k.has('ArrowDown')) { state.kb = true; if (!dests.length) return null; state.kbIdx = (state.kbIdx + (k.has('ArrowDown') ? 1 : -1) + dests.length) % dests.length; const m = dests[state.kbIdx]; state.kbTarget = m.to === HOME || m.to === 'wait' ? 0 : m.to; return null; }
    if (k.has('Enter') || k.has('Space')) {
      state.kb = true;
      if (state.sel != null && dests.length) { const m = dests[state.kbIdx % dests.length]; const p = POINTS[m.to === HOME || m.to === 'wait' ? 0 : m.to]; return { x: p.x, y: p.y }; }
      if (origins.length) { state.sel = origins[0]; state.kbTarget = state.sel < 0 ? 0 : state.sel; }
    }
    return null;
  }

  // ---- screenshot scenes (store shots and design review): ?scene=N or seed 9000+N; input is ignored ------------------
  function showcase(n) {
    frozen = true; state.stats = { games: 7, wins: 3, badges: { L0: true, L2: true } }; state.learned = true;
    if (n === 1) return;
    const mk = (blue, red, wait, home, pending, phase = 'move') => { const s = lessonGame({ blue, red, wait, home, phase, pending }); return s; };
    if (n === 2) { start(false); state.game = mk([[5, 1], [9, 2]], [[13, 1], [21, 1]], [1, 2], [0, 0], [], 'throw'); state.msg = null; beginThrow(0.85, 380, PAD.y + PAD.h - 20); state.throwAnim.t = 0.5; }
    else if (n === 3) { start(false); state.game = mk([[5, 1], [9, 2], [16, 1]], [[13, 1], [21, 1], [7, 1]], [0, 1], [0, 0], [2, 3]); state.msg = null; state.rest = restSticks().map((s, i) => ({ ...s, flat: i % 3 === 0 })); afterSettle(); state.sel = 5; state.selV = 2; state.selK = 0; state.result = { v: 3, t: 2.2 }; say('Choose a token, then a glowing point.', 60); }
    else if (n === 4) { start(false); state.game = mk([[6, 1], [10, 1], [16, 1]], [[8, 1], [13, 2]], [1, 1], [0, 0], [2]); state.msg = null; afterSettle(); state.sel = 6; state.selV = 2; state.selK = 0; }
    else if (n === 5) { startLesson(4); }
    else if (n === 6) { start(false); state.game = mk([[22, 1], [19, 1]], [[12, 1], [14, 1]], [2, 2], [0, 0], [3]); state.game.home = [1, 0]; state.game.wait = [1, 2]; state.msg = null; afterSettle(); state.hint = { from: 19, v: 3, to: HOME, t: 0 }; state.sel = 19; state.selV = 3; say('Hint: use Geol on the glowing token. This brings a token home.', 60); }
    else if (n === 7) { start(false); state.game.winner = 0; state.scene = 'over'; state.game.moves = 61; state.game.throws = 48; }
    else if (n === 8) { state.scene = 'about'; }
    else if (n === 9) { state.scene = 'how'; }
  }
  if (config.showcase) showcase(config.showcase);

  return {
    update(dt, input) {
      state.t += dt;
      if (state.msg) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      if (state.result) state.result.t += dt;
      if (state.chipPop > 0) state.chipPop = Math.max(0, state.chipPop - dt * 3);
      for (const f of state.fx) f.t += dt; state.fx = state.fx.filter((f) => f.t < f.dur);
      const p = input.pointer;
      if (frozen) { if (state.throwAnim) updateThrow(0); return; }
      const kbd = keyboard(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd && kbd.x !== undefined ? kbd : null;
      const sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'about' || sc === 'how') { if (tap && inRect(PAGE_BACK, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'play' || sc === 'lesson' || sc === 'puzzle') {
        if (sc === 'puzzle' && state.pz.status === 'making') { for (let k = 0; k < 2 && !puzzleToday; k++) puzzleToday = maker.step().puzzle; if (puzzleToday) startPuzzle(); if (tap && inRect(BTN.menu, tap.x, tap.y)) state.scene = 'title'; return; }
        updateSceneGame(dt, input, tap, sc);
      } else if (sc === 'over' && tap) {
        if (inRect(BTN.again, tap.x, tap.y)) start(state.two);
        else if (inRect(BTN.back, tap.x, tap.y)) state.scene = 'title';
      } else if (sc === 'demo-limit' && tap) { /* nothing else is playable in the preview */ }
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
  };
}
