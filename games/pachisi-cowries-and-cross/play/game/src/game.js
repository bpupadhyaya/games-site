// GAME CONTRACT (docs/GAME-CONTRACT.md): exports meta and createGame(env) -> { update, render, getState }.
// This file owns state and flow (scenes, input, turns, saving). Rules live in rules.js, the computer in ai.js,
// everything drawn in view.js. `state` is plain JSON: closures hold nothing that matters.
import { W, H, MAT, inRect, posXY, hopPath } from './layout.js';
import { geo, newGame, rollThrow, legalMoves, checkMove, noMoveReason, applyMove, nextTurn, clone, homeCount, progressOf, trackMap, trackIndex, COLOUR_NAMES } from './rules.js';
import { chooseMove, hintMove } from './ai.js';
import { LESSONS } from './lessons.js';
import { makeDaily, bestScore, moveScore, starsFor, DAILY_THROWS } from './daily.js';
import { screenButtons, RULES_PAGES } from './ui.js';
import { render as draw } from './view.js';

export const meta = { width: W, height: H };

const DEMO_GAMES = 2;

export function createGame(env) {
  const { rng, storage, audio, config } = env;

  const state = {
    scene: 'title', t: 0, demo: !!config.demo, demoGames: 0, dailyDemo: -1,
    prefs: { sound: true, calm: false, big: false, auto: true },
    setup: { mode: 'pachisi', players: 2, opp: 'balanced', friends: false, pieces: 4 },
    stats: { played: 0, wins: 0, lessons: {}, dailyDay: -1, dailyBest: 0, dailyStars: 0, streak: 0, lastDay: -1 },
    saved: null, menuOpen: false, howPage: 0, aboutPage: 0, rulesPage: 0, howFrom: 'title',
    g: newGame({ humans: [true, false] }), phase: 'throw', wait: 0, msg: '', roll: null, opts: [], sel: -1, hop: null, fly: [], hint: null, hintsLeft: 3,
    fast: false, sfx: [], shake: null, res: null, aiMove: null, autoT: null, pass: null, lesson: null, dl: null, over: null, swipe: null, flash: 0,
  };

  // ---- storage ----------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); audio.setMuted(!state.prefs.sound); } });
  storage.get('stats', null).then((v) => { if (v) Object.assign(state.stats, v, { lessons: { ...(v.lessons || {}) } }); });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('dailyDemo', -1).then((v) => { state.dailyDemo = Math.max(state.dailyDemo, v); });
  storage.get('save', null).then((v) => { if (v && v.g && v.g.winner < 0 && state.scene === 'title') state.saved = v; });
  const savePrefs = () => { storage.set('prefs', state.prefs); audio.setMuted(!state.prefs.sound); };
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.played, wins: state.stats.wins }); };
  const saveGame = () => { if (state.scene === 'play' && state.g.winner < 0) { state.saved = { g: clone(state.g), hintsLeft: state.hintsLeft }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  // ---- sound (all synthesized; delayed tones are scheduled in update so it stays deterministic) ---------------
  const tone = (o, delay = 0) => { if (!state.prefs.sound) return; if (delay > 0) state.sfx.push({ t: delay, o }); else audio.tone(o); };
  const clack = (f = 420, v = 0.1) => tone({ freq: f, to: f * 0.5, dur: 0.05, type: 'triangle', vol: v });
  let snd = 1;
  const sr = (n) => { snd = (Math.imul(snd, 1664525) + 1013904223) >>> 0; return snd % n; };
  const sounds = {
    shell: () => { clack(900 + sr(900), 0.07); tone({ freq: 2200 + sr(800), to: 1400, dur: 0.025, type: 'square', vol: 0.025 }); },
    hop: () => clack(340 + sr(120), 0.11),
    grace: () => { tone({ freq: 660, to: 880, dur: 0.16, type: 'triangle', vol: 0.09 }); tone({ freq: 990, to: 1320, dur: 0.22, type: 'triangle', vol: 0.08 }, 0.14); },
    capture: () => { tone({ freq: 240, to: 70, dur: 0.28, type: 'sawtooth', vol: 0.08 }); tone({ freq: 120, to: 60, dur: 0.2, type: 'sine', vol: 0.12 }, 0.05); },
    refuse: () => tone({ freq: 190, to: 120, dur: 0.16, type: 'triangle', vol: 0.07 }),
    home: () => [523, 659, 784, 1046].forEach((f, k) => tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.08 }, k * 0.11 + 0.001)),
    win: () => [523, 659, 784, 1046, 1318].forEach((f, k) => tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.09 }, k * 0.14 + 0.001)),
    ui: () => tone({ freq: 520, to: 700, dur: 0.06, type: 'sine', vol: 0.07 }),
  };

  const say = (text) => { state.msg = text; };
  const cur = () => state.g.players[state.g.turn];
  const isHuman = () => cur().human;
  const soloDrive = () => state.scene === 'lesson' || state.scene === 'daily';
  const aiTurn = () => !soloDrive() && !isHuman();
  const stepDef = () => LESSONS[state.lesson.i].steps[state.lesson.step];
  const nameOf = (pl) => state.g.players[pl].name;
  const dieMode = () => state.g.mode === 'ludo';
  const humans = () => state.g.players.filter((p) => p.human).length;

  // ---- starting things ---------------------------------------------------------------------------
  function levelsFor(n) {
    const o = state.setup.opp;
    if (o === 'mixed') return ['balanced', 'cautious', 'bold', 'balanced'].slice(0, n);
    return Array.from({ length: n }, () => o);
  }
  function resetPlayView() { state.menuOpen = false; state.roll = null; state.fly = []; state.hop = null; state.over = null; state.opts = []; state.sel = -1; }
  function startGame() {
    if (state.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (state.demo) { state.demoGames++; storage.set('demoGames', state.demoGames); }
    const t = state.setup, hs = Array.from({ length: t.players }, (_, i) => (t.friends ? true : i === 0));
    const g = newGame({ mode: t.mode, players: t.players, pieces: t.pieces, humans: hs, levels: levelsFor(t.players) });
    g.players.forEach((p) => { p.name = t.friends || !p.human ? COLOUR_NAMES[p.arm] : 'You'; });
    state.g = g; state.scene = 'play'; state.hintsLeft = 3; resetPlayView();
    clearSave(); beginTurn();
  }
  function continueGame() {
    const s = state.saved; if (!s) return;
    state.g = clone(s.g); state.hintsLeft = s.hintsLeft; state.scene = 'play'; resetPlayView(); beginTurn();
  }
  function beginTurn() {
    state.phase = 'throw'; state.sel = -1; state.opts = []; state.hint = null; state.autoT = null; state.res = null;
    state.wait = aiTurn() ? 0.75 : 0.15;
    if (isHuman()) state.fast = false;
    if (state.scene === 'play' && humans() > 1 && isHuman()) { state.pass = { pl: state.g.turn }; state.scene = 'pass'; }
    say(throwPrompt());
  }
  function throwPrompt() {
    if (soloDrive()) return state.msg;
    if (!isHuman()) return `${nameOf(state.g.turn)} (${cur().level}) is about to throw.  Tap to hurry.`;
    return `${humans() > 1 ? nameOf(state.g.turn) + ': ' : 'Your turn: '}${dieMode() ? 'TAP the die to throw.' : 'TAP or SWIPE the cowries to throw.'}`;
  }

  function startLesson(i) {
    if (state.demo && i >= 3) { say('The full game on iPhone and Android has all nine lessons.'); return; }
    const L = LESSONS[i], g = newGame({ mode: L.mode, players: 2, pieces: 4, humans: [true, false] });
    g.players[0].name = 'You'; g.players[1].name = 'Rival';
    g.pos[0] = L.me.slice(); g.pos[1] = L.rival.slice();
    state.g = g; state.scene = 'lesson'; resetPlayView();
    state.lesson = { i, step: 0, complete: false, stepDone: false, snap: null, retry: false };
    beginStep(0);
  }
  function beginStep(k) {
    const L = state.lesson, st = LESSONS[L.i].steps[k];
    L.step = k; L.stepDone = false; L.snap = clone(state.g); L.retry = false;
    state.sel = -1; state.opts = []; state.hint = null; state.autoT = null; state.wait = 0.2;
    say(st.text);
    if (st.throw == null && state.roll) { state.phase = 'show'; state.wait = 0.05; } else state.phase = 'throw';
  }
  function lessonEvent(ev) {
    const L = state.lesson; if (!L || L.stepDone || L.complete) return;
    const w = stepDef().want, m = ev.m, g = state.g, G = geo(g.mode);
    let ok = false;
    if (ev.kind === 'nomove') ok = w.kind === 'nomove';
    else if (ev.kind === 'refused') ok = w.kind === 'refused';
    else if (ev.kind === 'move') {
      if (w.kind === 'move') ok = true;
      else if (w.kind === 'enter') ok = m.enter;
      else if (w.kind === 'land') ok = m.to === w.to;
      else if (w.kind === 'capture') ok = m.caps.length > 0;
      else if (w.kind === 'home') ok = m.to === G.END;
      else if (w.kind === 'block') { const t = trackIndex(g, 0, m.to); ok = t != null && (trackMap(g).get(t) || []).filter(([p]) => p === 0).length >= 2; }
      if (!ok) L.retry = true;
    }
    if (ok) { L.stepDone = true; state.wait = ev.kind === 'nomove' || ev.kind === 'refused' ? 4.2 : 1.6; state.phase = 'lessonwait'; if (ev.kind === 'move') say('Well done!'); }
    else if (L.retry) { state.phase = 'lessonwait'; state.wait = 2; say('Not quite what the lesson asks. Let us try that again.'); }
  }
  function lessonAdvance() {
    const L = state.lesson;
    if (L.retry) {
      state.g = clone(L.snap); state.fly = []; state.hop = null; L.retry = false; state.sel = -1;
      say(stepDef().text); state.phase = 'show'; state.wait = 0.1; return;
    }
    const steps = LESSONS[L.i].steps;
    if (L.step + 1 < steps.length) beginStep(L.step + 1);
    else { L.complete = true; state.phase = 'lessondone'; say(LESSONS[L.i].done); state.stats.lessons[L.i] = true; saveStats(); sounds.home(); }
  }

  function startDaily() {
    if (state.demo && state.dailyDemo === config.day) { state.scene = 'demo-limit'; return; }
    if (state.demo) { state.dailyDemo = config.day; storage.set('dailyDemo', config.day); }
    const def = makeDaily(config.day);
    state.dl = { g0: def.g, throws: def.throws, k: 0, score: 0, best: bestScore(def), stars: 0, finished: false, caps: 0, homes: 0 };
    state.g = clone(def.g); state.g.players[0].name = 'You'; state.g.players[1].name = 'Rival';
    state.scene = 'daily'; resetPlayView(); state.phase = 'throw'; state.wait = 0.2;
    say(`Daily race: ${DAILY_THROWS} fixed throws, the same for everyone today. The rival pawns stand still. TAP or SWIPE the cowries.`);
  }
  function dailyEnd() {
    const D = state.dl, s = state.stats;
    D.finished = true; D.stars = starsFor(D.score, D.best);
    if (s.dailyDay !== config.day) { s.streak = s.lastDay === config.day - 1 ? s.streak + 1 : 1; s.dailyBest = 0; s.dailyStars = 0; }
    s.dailyDay = config.day; s.lastDay = config.day; s.dailyBest = Math.max(s.dailyBest, D.score); s.dailyStars = Math.max(s.dailyStars || 0, D.stars);
    saveStats(); state.phase = 'dailydone'; sounds.win(); say('The race is over.');
  }

  // ---- the throw ---------------------------------------------------------------------------------
  function doThrow() {
    const g = state.g;
    let forced = null;
    if (state.scene === 'lesson') forced = stepDef().throw ?? null;
    if (state.scene === 'daily') forced = state.dl.throws[state.dl.k];
    const th = rollThrow(g.mode, rng, forced);
    g.throws++;
    const calm = state.prefs.calm, die = dieMode();
    const spots = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) spots.push([190 + c * 170, 1148 + r * 96]);
    const order = rng.shuffle([0, 1, 2, 3, 4, 5]);
    const items = th.shells.map((mouth, k) => {
      const sp = die ? [360, 1195] : spots[order[k]];
      return {
        x0: die ? 360 : 300 + k * 24, y0: 1470, tx: sp[0] + (die ? 0 : (rng.next() - 0.5) * 50), ty: sp[1] + (die ? 0 : (rng.next() - 0.5) * 22),
        r0: rng.next() * 6.28, r1: rng.next() * 6.28, flips: 2 + rng.int(3), mouth: die ? 0 : mouth, dl: die ? 0 : k * 0.03, face0: rng.int(6),
      };
    });
    state.roll = { t: 0, dur: calm ? 0.5 : 1.45, value: th.value, grace: th.grace, up: th.up, die, items, snd: items.map(() => 0), pl: g.turn };
    state.phase = 'roll'; state.wait = 0; state.hint = null; state.sel = -1; state.opts = [];
    say(die ? 'The die tumbles...' : (isHuman() || soloDrive()) ? 'The shells fly...' : `${nameOf(g.turn)} throws...`);
  }
  function rollDone() {
    const R = state.roll, g = state.g;
    const text = R.die ? `${R.value}` : `${R.up} mouth${R.up === 1 ? '' : 's'} up = ${R.value}`;
    if (R.grace) sounds.grace();
    const who = soloDrive() || (isHuman() && humans() === 1) ? 'You threw' : `${nameOf(g.turn)} threw`;
    say(`${who} ${text}${R.grace ? '. Grace throw!' : '.'}`);
    state.phase = 'show'; state.wait = 0.45;
  }
  function afterShow() {
    const g = state.g, R = state.roll, pl = g.turn;
    const moves = legalMoves(g, R.value, R.grace, pl);
    if (!moves.length) {
      say(`No pawn can move. ${noMoveReason(g, R.value, R.grace, pl)}`);
      state.phase = 'nomove'; state.wait = isHuman() || soloDrive() ? 3.4 : 1.9; sounds.refuse();
      if (state.scene === 'lesson') lessonEvent({ kind: 'nomove' });
      return;
    }
    state.opts = moves; state.sel = -1; state.hint = null;
    if (aiTurn()) {
      state.aiMove = chooseMove(g, moves, cur().level, rng); state.phase = 'ai'; state.wait = 0.55;
      say(`${nameOf(pl)} is choosing...`);
      return;
    }
    state.phase = 'choose';
    const many = moves.length > 1, cap = moves.some((m) => m.caps.length);
    if (state.scene === 'lesson') say(stepDef().text);
    else if (state.scene === 'daily') say(`Throw ${state.dl.k + 1} of ${DAILY_THROWS}: value ${R.value}. TAP a glowing pawn, then TAP it again.`);
    else say(`You threw ${R.value}. ${many ? 'TAP a glowing pawn to preview it, then TAP it again to move.' : 'Only one move: TAP the glowing pawn.'}${cap ? ' A capture is possible!' : ''}`);
    state.autoT = !many && state.prefs.auto && state.scene === 'play' ? 0.9 : null;
  }
  function afterNoMove() {
    if (state.scene === 'lesson') { beginStep(state.lesson.step); return; }
    if (state.scene === 'daily') { nextDailyThrow(); return; }
    endTurn();
  }
  function nextDailyThrow() {
    const D = state.dl; D.k++;
    if (D.k >= DAILY_THROWS) dailyEnd(); else { state.phase = 'throw'; state.wait = 0.2; say(`Throw ${D.k + 1} of ${DAILY_THROWS}: TAP or SWIPE the cowries.`); }
  }

  // ---- moving ---------------------------------------------------------------------------------------
  function play(m) {
    const g = state.g, calm = state.prefs.calm, pts = hopPath(g, m.pl, m.i, m.from, m.to), n = pts.length - 1;
    const per = calm ? 0.04 : Math.min(0.2, 1.5 / Math.max(1, n));
    const fly = m.caps.map(([o, k]) => ({ pl: o, i: k, from: posXY(g, o, k, g.pos[o][k]), to: posXY(g, o, k, -1), t: 0, dur: calm ? 0.2 : 0.85 }));
    state.hop = { pl: m.pl, i: m.i, pts, seg: 0, t: 0, per: m.enter ? (calm ? 0.1 : 0.42) : per, m, fly, n };
    state.opts = []; state.sel = -1; state.hint = null; state.autoT = null; state.phase = 'hop'; state.wait = 0;
    const you = nameOf(m.pl) === 'You', capTxt = m.caps.length ? ` and ${you ? 'capture' : 'captures'} ${m.caps.length > 1 ? m.caps.length + ' pawns' : 'a pawn'}` : '';
    if (!soloDrive()) say(`${nameOf(m.pl)} ${m.enter ? (you ? 'enter a pawn' : 'enters a pawn') : (you ? 'move ' : 'moves ') + m.value}${capTxt}.`);
  }
  function hopDone() {
    const g = state.g, h = state.hop, m = h.m;
    const r = applyMove(g, m);
    state.fly.push(...h.fly);
    state.hop = null; state.res = { ...r };
    if (r.captured) { sounds.capture(); say(state.scene === 'lesson' ? 'Captured! The rival pawn goes back to its yard.' : `${nameOf(m.pl)} ${nameOf(m.pl) === 'You' ? 'capture' : 'captures'} ${r.captured > 1 ? r.captured + ' pawns' : 'a pawn'}!`); }
    if (r.home) sounds.home();
    if (state.scene === 'daily') { const D = state.dl; D.score += moveScore(g, m); D.caps += m.caps.length; D.homes += r.home ? 1 : 0; }
    state.phase = 'after'; state.wait = r.captured ? 0.8 : 0.3;
    if (state.scene === 'lesson') lessonEvent({ kind: 'move', m });
  }
  function afterMove() {
    const g = state.g, r = state.res;
    if (state.scene === 'lesson') { state.phase = 'show'; state.wait = 0.1; return; }
    if (state.scene === 'daily') { nextDailyThrow(); return; }
    if (r.won) { state.phase = 'won'; state.wait = 1.1; sounds.win(); return; }
    if (r.bonus) {
      state.phase = 'throw'; state.wait = aiTurn() ? 0.8 : 0.2; state.sel = -1;
      say(aiTurn() ? `${nameOf(g.turn)} throws again...` : r.captured ? 'Capture! Throw again.' : r.home ? 'Home! Throw again.' : 'Grace throw: throw again.');
      saveGame(); return;
    }
    endTurn();
  }
  function endTurn() { nextTurn(state.g); beginTurn(); saveGame(); }
  function finishGame() {
    const g = state.g, s = state.stats;
    s.played++; if (g.players[g.winner].human) s.wins++;
    saveStats(); clearSave();
    const rank = g.players.map((p, pl) => ({ pl, home: homeCount(g, pl), prog: progressOf(g, pl) })).sort((a, b) => (b.pl === g.winner) - (a.pl === g.winner) || b.home - a.home || b.prog - a.prog);
    state.over = { winner: g.winner, rank, youWon: g.players[g.winner].human && humans() === 1 };
    state.scene = 'over';
  }

  // ---- hitting things -------------------------------------------------------------------------------
  function pawnAt(x, y) {
    const g = state.g; let best = null, bd = 38;
    g.players.forEach((_, q) => g.pos[q].forEach((p, i) => {
      const s = posXY(g, q, i, p), d = Math.hypot(s.x - x, s.y - 16 - y);
      if (d < bd) { bd = d; best = { pl: q, i, p }; }
    }));
    return best;
  }
  function tapBoard(x, y) {
    const g = state.g;
    if (state.phase === 'throw') { if (isHuman() || soloDrive()) say(dieMode() ? 'First throw: TAP the die.' : 'First throw: TAP or SWIPE the cowries at the bottom.'); return; }
    if (state.phase !== 'choose') return;
    if (state.sel >= 0) { // a tap on the destination confirms too
      const m = state.opts.find((o) => o.i === state.sel);
      if (m) { const d = posXY(g, m.pl, m.i, m.to); if (Math.hypot(d.x - x, d.y - 14 - y) < 30) { play(m); return; } }
    }
    const pw = pawnAt(x, y);
    if (!pw) { state.sel = -1; say(`You threw ${state.roll.value}. TAP one of the glowing pawns.`); return; }
    if (pw.pl !== g.turn) { say('That is a rival pawn. TAP one of your own glowing pawns.'); return; }
    const mv = state.opts.find((o) => o.from === pw.p);
    if (mv) {
      if (state.sel === mv.i) play(mv);
      else { state.sel = mv.i; sounds.ui(); if (state.scene !== 'lesson') say(`${mv.enter ? 'It enters onto your start square.' : `It moves ${mv.value} squares.`}${mv.caps.length ? ' It captures a rival!' : ''} TAP the pawn again to move it.`); }
      return;
    }
    const why = checkMove(g, pw.pl, pw.i, state.roll.value, state.roll.grace);
    state.shake = { pl: pw.pl, i: pw.i, t: 0 }; sounds.refuse();
    say(`That pawn cannot move: ${why.text || 'no legal move.'}`);
    if (state.scene === 'lesson') lessonEvent({ kind: 'refused' });
  }
  function cycle(dir) {
    if (state.phase !== 'choose' || !state.opts.length) return;
    const idx = state.opts.findIndex((o) => o.i === state.sel);
    const nx = state.opts[(idx + dir + state.opts.length * 2) % state.opts.length];
    state.sel = nx.i; sounds.ui();
    say(`Selected. Press Space, or TAP the pawn again, to move ${nx.enter ? 'a pawn onto your start square' : nx.value + ' squares'}.`);
  }
  function confirmKey() {
    if (state.phase === 'throw' && (isHuman() || soloDrive())) doThrow();
    else if (state.phase === 'choose') { if (state.sel < 0) cycle(1); else { const m = state.opts.find((o) => o.i === state.sel); if (m) play(m); } }
  }
  function useHint() {
    if (state.phase !== 'choose' || state.hintsLeft <= 0 || state.scene !== 'play') return;
    const m = hintMove(state.g, state.roll.value, state.roll.grace, rng);
    if (!m) return;
    const t = trackIndex(state.g, m.pl, m.to);
    state.hintsLeft--; state.hint = { i: m.i }; state.sel = m.i;
    say(`Hint: ${m.caps.length ? 'this move captures a rival.' : m.enter ? 'bring a new pawn out.' : t != null && geo(state.g.mode).safe.has(t) ? 'this pawn reaches a safe square.' : 'this pawn is a good choice.'} TAP it to move.`);
  }

  function act(id) {
    const s = state;
    sounds.ui();
    if (id === 'new') s.scene = 'setup';
    else if (id === 'continue') continueGame();
    else if (id === 'learn') s.scene = 'learn';
    else if (id === 'daily') startDaily();
    else if (id === 'about') { s.scene = 'about'; s.aboutPage = 0; }
    else if (id === 'how') { s.scene = 'how'; s.howPage = 0; s.howFrom = 'title'; }
    else if (id === 'rules') { s.scene = 'rules'; s.rulesPage = 0; }
    else if (id === 'settings') s.scene = 'settings';
    else if (id === 'back') { if (s.scene === 'how' && s.howFrom !== 'title') s.scene = s.howFrom; else s.scene = 'title'; s.menuOpen = false; }
    else if (id === 'title') { s.scene = 'title'; s.menuOpen = false; }
    else if (id === 'page') { if (s.scene === 'how') s.howPage = (s.howPage + 1) % 2; else if (s.scene === 'rules') s.rulesPage = (s.rulesPage + 1) % RULES_PAGES.length; else s.aboutPage = (s.aboutPage + 1) % 2; }
    else if (id === 'start') startGame();
    else if (id.startsWith('mode:')) s.setup.mode = id.slice(5);
    else if (id.startsWith('pl:')) s.setup.players = Number(id.slice(3));
    else if (id.startsWith('who:')) s.setup.friends = id === 'who:friends';
    else if (id.startsWith('opp:')) s.setup.opp = id.slice(4);
    else if (id.startsWith('pcs:')) s.setup.pieces = Number(id.slice(4));
    else if (id.startsWith('set:')) { const k = id.slice(4); s.prefs[k] = !s.prefs[k]; savePrefs(); }
    else if (id.startsWith('lesson:')) startLesson(Number(id.slice(7)));
    else if (id === 'menu') s.menuOpen = true;
    else if (id === 'resume') s.menuOpen = false;
    else if (id === 'howmenu') { s.howFrom = s.scene; s.scene = 'how'; s.howPage = 0; s.menuOpen = false; }
    else if (id === 'leave') { s.menuOpen = false; s.hop = null; s.fly = []; s.phase = 'throw'; if (s.scene === 'lesson') s.scene = 'learn'; else { if (s.scene === 'play') saveGame(); s.scene = 'title'; } }
    else if (id === 'sound') { s.prefs.sound = !s.prefs.sound; savePrefs(); }
    else if (id === 'hint') useHint();
    else if (id === 'again') { if (s.scene === 'lesson') startLesson(s.lesson.i); else if (s.scene === 'daily') startDaily(); else startGame(); }
    else if (id === 'nextlesson') { if (s.lesson.i + 1 < LESSONS.length) startLesson(s.lesson.i + 1); else s.scene = 'learn'; }
    else if (id === 'lessons') s.scene = 'learn';
    else if (id === 'ready') { s.scene = 'play'; s.pass = null; }
  }

  // ---- update ------------------------------------------------------------------------------------
  function flow(dt) {
    let ph = state.phase;
    if ((ph === 'hop' && !state.hop) || (ph === 'roll' && !state.roll)) { state.phase = ph = 'throw'; state.wait = 0.2; }
    if (ph === 'hop') {
      const h = state.hop; h.t += dt;
      while (h.t >= h.per && h.seg < h.n) { h.t -= h.per; h.seg++; if (!h.m.enter) sounds.hop(); }
      if (h.seg >= h.n) hopDone();
      return;
    }
    if (ph === 'roll') {
      const R = state.roll; R.t += dt;
      R.items.forEach((it, k) => {
        const D = R.dur - 0.28, u = Math.min(1, Math.max(0, (R.t - it.dl) / D));
        if (u >= 0.72 && !(R.snd[k] & 1)) { R.snd[k] |= 1; sounds.shell(); }
        if (u >= 0.9 && !(R.snd[k] & 2)) { R.snd[k] |= 2; if (k % 2 === 0) clack(1300, 0.04); }
      });
      if (R.t >= R.dur) rollDone();
      return;
    }
    if (state.wait > 0) { state.wait -= dt; if (state.wait > 0) return; state.wait = 0; }
    switch (ph) {
      case 'throw': if (aiTurn()) doThrow(); break;
      case 'show': afterShow(); break;
      case 'choose': if (state.autoT != null) { state.autoT -= dt; if (state.autoT <= 0) { const m = state.opts[0]; if (m) play(m); } } break;
      case 'ai': play(state.aiMove); break;
      case 'after': afterMove(); break;
      case 'nomove': afterNoMove(); break;
      case 'lessonwait': lessonAdvance(); break;
      case 'won': finishGame(); break;
      default: break;
    }
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.shake) { state.shake.t += dt; if (state.shake.t > 0.55) state.shake = null; }
      for (const f of state.fly) f.t += dt;
      state.fly = state.fly.filter((f) => f.t < f.dur);
      for (const e of state.sfx) e.t -= dt;
      for (const e of state.sfx.filter((q) => q.t <= 0)) audio.tone(e.o);
      state.sfx = state.sfx.filter((q) => q.t > 0);

      const sc = state.scene, ptr = input.pointer, keys = input.keys.pressed;
      const inPlay = sc === 'play' || sc === 'lesson' || sc === 'daily';
      const yours = () => isHuman() || soloDrive();
      if (ptr.pressed) {
        state.swipe = { x: ptr.x, y: ptr.y };
        const b = screenButtons(state).find((q) => inRect(q, ptr.x, ptr.y));
        if (b) { if (b.locked) say('The full game on iPhone and Android has all nine lessons.'); else act(b.id); state.swipe = null; }
        else if (inPlay && !state.menuOpen) {
          const L = state.lesson;
          if (state.phase === 'lessonwait' && state.wait > 0.2) state.wait = 0.05;
          else if (state.phase === 'throw' && yours() && inRect({ x: MAT.x, y: MAT.y - 20, w: MAT.w, h: MAT.h + 40 }, ptr.x, ptr.y)) { doThrow(); state.swipe = null; }
          else if (aiTurn() && state.phase !== 'won') state.fast = true;
          else if (!(L && sc === 'lesson' && L.complete) && !(sc === 'daily' && state.dl.finished)) tapBoard(ptr.x, ptr.y);
        }
      }
      if (ptr.released) {
        const sw = state.swipe;
        if (sw && inPlay && !state.menuOpen && state.phase === 'throw' && yours() && sw.y > 900 && sw.y - ptr.y > 70) doThrow();
        state.swipe = null;
      }
      if (inPlay) {
        if (keys.has('Escape')) state.menuOpen = !state.menuOpen;
        if (!state.menuOpen) {
          if (keys.has('Space') || keys.has('Enter')) confirmKey();
          if (keys.has('ArrowRight') || keys.has('ArrowDown') || keys.has('Tab')) cycle(1);
          if (keys.has('ArrowLeft') || keys.has('ArrowUp')) cycle(-1);
        }
      } else if (sc === 'pass' && (keys.has('Space') || keys.has('Enter'))) act('ready');
      if (inPlay && !state.menuOpen) flow(dt * (state.fast && aiTurn() ? 2.8 : 1));
    },
    render(ctx) { draw(ctx, state); },
    getState: () => state,
  };
}
