// GAME CONTRACT (docs/GAME-CONTRACT.md): exports meta and createGame(env) -> { update, render, getState }.
// This file owns state and flow (scenes, input, turns, saving). Rules live in rules.js, the computer in ai.js,
// everything drawn in view.js. `state` is plain JSON: closures hold nothing that matters.
import { W, H, UNIT, BOARD, TRAY, DICE_SPOTS, G, creditHit, useLayout, inRect, posXY, hopPath } from './layout.js';
import { TRIES, SEAT_NAMES, newGame, legalMoves, checkMove, noMoveReason, applyMove, nextTurn, pairPenalty, onBoard, deepClone, homeCount, progressOf } from './rules.js';
import { chooseMove, hintMove, describeMove } from './ai.js';
import { screenButtons, screenLayout, readerMax, TEXT_SCALES, AP_THINK_STEPS, zoomOf } from './ui.js';
import { render as draw } from './view.js';
import { SEAT } from './art.js';

// `meta.width/height` are updated live by the kit on every resize (fluid viewport, short side = 720); every position comes from layout.js.
// Mouse wheel / trackpad scrolling for the readers and lists (main.js adds to dy, in virtual units).
export const wheelInput = { dy: 0 };
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };

const DEMO_GAMES = 2;
const TURN_CAP = 2000;
// Auto Play (Watch & Learn): a whole AI-vs-AI game driven by the SAME ai.js chooseMove used for every real computer
// opponent. THINK (configurable, default 5 s, max 10 s) -> REVEAL (fixed 2 s: the options glow, the chosen one is marked)
// -> ACT. A real Pause freezes everything (timers, dice and hop animations, particles) and resumes exactly where it was.
const AP_LEVELS = ['balanced', 'bold'], AP_REVEAL_TIME = 2;

export function createGame(env) {
  const { rng, storage, audio, config } = env;
  const fx = rng.fork(); // visual randomness never shifts the dice stream

  const state = {
    scene: 'title', t: 0, demo: !!config.demo, demoGames: 0,
    prefs: { sound: true, calm: false, auto: true, textScaleIdx: 0, apThinkIdx: 1 },
    setup: { players: 2, opp: 'balanced', mode: 'cpu' },
    stats: { played: 0, wins: 0 },
    saved: null, menuOpen: false, howPage: 0, aboutPage: 0, rulesPage: 0, refFrom: 'title', scroll: 0, press: null,
    g: newGame({ humans: [true, false] }), phase: 'throw', wait: 0, msg: '', roll: null, opts: [], sel: -1, dieSel: 0, hop: null, fly: [], parts: [], sfx: [],
    tries: 0, run: 0, aiMove: null, apMove: null, ap: { paused: false }, autoT: null, res: null, over: null, shake: null, jailShake: [0, 0, 0, 0], fast: false, hintOn: false,
  };

  // ---- layout follows the live size; screen-space animations are remapped when it changes (rotate / resize mid-game) ----------------
  let seen = { cx: 0, cy: 0, S: 0, tx: 0, ty: 0, tw: 0 };
  function ensureLayout(view) {
    void view; const w = meta.width, h = meta.height;   // meta is live (the kit updates it on every resize)
    useLayout(w, h, state.scene === 'title' ? 'title' : 'play');
    if (seen.S && (Math.abs(seen.cx - BOARD.cx) + Math.abs(seen.cy - BOARD.cy) + Math.abs(seen.S - BOARD.S) > 0.5)) remap(seen);
    seen = { cx: BOARD.cx, cy: BOARD.cy, S: BOARD.S, tx: TRAY.x + TRAY.w / 2, ty: TRAY.y + TRAY.h / 2, tw: TRAY.w };
  }
  function remap(o) {
    const k = BOARD.S / o.S, f = (p) => { p.x = BOARD.cx + (p.x - o.cx) * k; p.y = BOARD.cy + (p.y - o.cy) * k; };
    if (state.hop) state.hop.pts.forEach(f);
    state.fly.forEach((q) => { f(q.from); f(q.to); });
    if (state.hop) state.hop.fly.forEach((q) => { f(q.from); f(q.to); });
    state.parts.forEach(f);
    if (state.roll) state.roll.items.forEach((it) => { it.x0 = TRAY.x + TRAY.w / 2 + it.rx0; it.y0 = TRAY.y + TRAY.h + 40; });
  }
  ensureLayout();

  // ---- storage ----------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => {
    if (v) {
      Object.assign(state.prefs, v);
      state.prefs.textScaleIdx = Math.min(Math.max(state.prefs.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1);
      state.prefs.apThinkIdx = Math.min(Math.max(state.prefs.apThinkIdx ?? 1, 0), AP_THINK_STEPS.length - 1);
      audio.setMuted(!state.prefs.sound);
    }
  });
  storage.get('stats', null).then((v) => { if (v) Object.assign(state.stats, v); });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.g && v.g.winner < 0 && state.scene === 'title') state.saved = v; });
  const savePrefs = () => { storage.set('prefs', state.prefs); audio.setMuted(!state.prefs.sound); };
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.played, wins: state.stats.wins }); };
  const saveGame = () => { if (state.scene === 'play' && state.g.winner < 0) { state.saved = { g: deepClone(state.g) }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };

  // ---- sound (all synthesized; delayed tones are scheduled in update so it stays deterministic) ----------------
  const isAutoplay = () => state.scene === 'autoplay' || state.scene === 'autoplay-over';
  // Auto Play is silent by design regardless of the player's sound setting: never surprise a viewer with sound from a demo.
  const tone = (o, delay = 0) => { if (!state.prefs.sound || isAutoplay()) return; if (delay > 0) state.sfx.push({ t: delay, o }); else audio.tone(o); };
  let snd = 1;
  const sr = (n) => { snd = (Math.imul(snd, 1664525) + 1013904223) >>> 0; return snd % n; };
  const clack = (f = 420, v = 0.1, dur = 0.05) => tone({ freq: f, to: f * 0.5, dur, type: 'triangle', vol: v });
  const sounds = {
    rattle: () => { for (let k = 0; k < 7; k++) tone({ freq: 700 + sr(900), to: 300, dur: 0.03, type: 'square', vol: 0.03 }, k * 0.12 + 0.001); },
    land: () => { clack(300, 0.11, 0.07); clack(520, 0.07, 0.05); },
    hop: () => clack(340 + sr(120), 0.1),
    free: () => [440, 554, 659, 880].forEach((f, k) => tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.08 }, k * 0.07 + 0.001)),
    capture: () => { tone({ freq: 220, to: 70, dur: 0.3, type: 'sawtooth', vol: 0.08 }); tone({ freq: 880, to: 600, dur: 0.12, type: 'square', vol: 0.04 }, 0.05); tone({ freq: 700, to: 500, dur: 0.18, type: 'triangle', vol: 0.06 }, 0.2); },
    refuse: () => tone({ freq: 190, to: 120, dur: 0.16, type: 'triangle', vol: 0.07 }),
    pair: () => { tone({ freq: 660, to: 880, dur: 0.14, type: 'triangle', vol: 0.09 }); tone({ freq: 990, to: 1320, dur: 0.2, type: 'triangle', vol: 0.08 }, 0.12); },
    home: () => [523, 659, 784, 1046].forEach((f, k) => tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.08 }, k * 0.11 + 0.001)),
    win: () => [523, 659, 784, 1046, 1318].forEach((f, k) => tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.09 }, k * 0.14 + 0.001)),
    ui: () => tone({ freq: 520, to: 700, dur: 0.06, type: 'sine', vol: 0.07 }),
  };

  // ---- particles ----------------------------------------------------------------------------------------------------------
  function burst(x, y, cols, n, speed = 220, size = 5) {
    if (state.prefs.calm) n = Math.ceil(n / 3);
    for (let k = 0; k < n; k++) {
      const a = fx.next() * Math.PI * 2, sp = speed * (0.3 + fx.next() * 0.8);
      state.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.7 + fx.next() * 0.5, max: 1.2, col: cols[k % cols.length], sz: size * (0.6 + fx.next() * 0.8), rect: k % 3 === 0, rot: fx.next() * 6 });
    }
  }
  const GOLD = ['#ffe27a', '#fff4d6', '#f4c20d'];

  // ---- small helpers ----------------------------------------------------------------------------------------------------
  const say = (text) => { state.msg = text; };
  const cur = () => state.g.players[state.g.turn];
  const isHuman = () => cur().human;
  const apTurn = () => state.scene === 'autoplay';
  const aiTurn = () => apTurn() || !isHuman();
  const nameOf = (pl) => state.g.players[pl].name;
  const posOf = (pl) => (nameOf(pl) === 'You' ? 'Your' : nameOf(pl) + "'s");
  // a person may roll now (in pass-and-play, not during the brief hand-over pause that stops a stray tap rolling for the next player)
  const canThrow = () => state.scene === 'play' && state.phase === 'throw' && isHuman() && (state.wait <= 0 || !passGame());
  const passGame = () => state.g.players.filter((p) => p.human).length > 1;
  const youNow = () => isHuman() && state.g.players.filter((p) => p.human).length === 1;
  const go = (scene) => { state.scene = scene; state.scroll = 0; state.menuOpen = false; };
  const think = () => AP_THINK_STEPS[state.prefs.apThinkIdx ?? 1];

  // ---- starting things ---------------------------------------------------------------------------------------------------
  function levelsFor(n) {
    const o = state.setup.opp;
    if (o === 'mixed') return ['balanced', 'cautious', 'bold'].slice(0, n);
    return Array.from({ length: n }, () => o);
  }
  function resetView() { state.menuOpen = false; state.roll = null; state.fly = []; state.hop = null; state.over = null; state.opts = []; state.sel = -1; state.parts = []; state.sfx = []; state.fast = false; state.ap = { paused: false }; state.jailShake = [0, 0, 0, 0]; }
  function startAutoPlay() {
    state.g = newGame({ players: 2, humans: [false, false], levels: AP_LEVELS }); go('autoplay'); resetView(); beginTurn();
  }
  function startGame() {
    if (state.demo && state.demoGames >= DEMO_GAMES) { go('demo-limit'); return; }
    if (state.demo) { state.demoGames++; storage.set('demoGames', state.demoGames); }
    const n = state.setup.players, pass = state.setup.mode === 'pass', hs = Array.from({ length: n }, (_, i) => pass || i === 0);
    state.g = newGame({ players: n, humans: hs, levels: levelsFor(n) });
    // pass-and-play: every seat is a person, named by colour (no "You")
    if (pass) state.g.players.forEach((p) => { p.name = SEAT_NAMES[p.arm]; }); go('play'); resetView(); clearSave(); beginTurn();
  }
  function continueGame() {
    const s = state.saved; if (!s) return;
    state.g = deepClone(s.g); go('play'); resetView(); beginTurn();
  }
  function beginTurn() {
    state.phase = 'throw'; state.sel = -1; state.opts = []; state.autoT = null; state.res = null; state.roll = null; state.tries = 0; state.run = 0; state.dieSel = 0; state.hintOn = false;
    state.wait = aiTurn() ? 0.7 : passGame() ? 0.5 : 0.15;
    if (isHuman()) state.fast = false;
    say(throwPrompt());
  }
  function throwPrompt() {
    const g = state.g, pl = g.turn;
    if (apTurn()) return `${nameOf(pl)} (${cur().level}) is about to roll the dice.`;
    if (!isHuman()) return `${nameOf(pl)} is about to roll. TAP to hurry.`;
    if (passGame()) return !onBoard(g, pl) ? `${nameOf(pl)}, pass the phone to you: all pieces are in the cárcel. Roll for a pair: try ${state.tries + 1} of ${TRIES}.` : `${nameOf(pl)}'s turn: TAP or SWIPE the tray to roll.`;
    if (!onBoard(g, pl)) return `All your pieces are in the cárcel. Roll for a pair: try ${state.tries + 1} of ${TRIES}.`;
    return 'Your turn: TAP or SWIPE the tray to roll.';
  }

  // ---- the roll ------------------------------------------------------------------------------------------------------------------
  function doThrow(force) {
    const g = state.g, calm = state.prefs.calm;
    const d = force ? force.slice() : [rng.int(6) + 1, rng.int(6) + 1], dbl = d[0] === d[1];
    g.rolls++; state.run = dbl ? state.run + 1 : 0;
    const items = d.map((_, k) => { const jx = (fx.next() - 0.5) * 36, jy = (fx.next() - 0.5) * 26, rx0 = (k - 0.5) * 220 + (fx.next() - 0.5) * 40; return { rx0, jx, jy, x0: TRAY.x + TRAY.w / 2 + rx0, y0: TRAY.y + TRAY.h + 40, r0: fx.next() * 6.28, r1: (fx.next() - 0.5) * 0.7, face0: fx.int(6), dl: k * 0.06 }; });
    state.roll = { t: 0, dur: calm ? 0.45 : 1.15, dice: d, rem: d.slice(), dbl, used: 0, items, pl: g.turn };
    state.phase = 'roll'; state.wait = 0; state.sel = -1; state.opts = []; state.autoT = null; state.hintOn = false;
    sounds.rattle();
    say(aiTurn() || passGame() ? `${nameOf(g.turn)} rolls...` : 'The dice tumble...');
  }
  function rollDone() {
    const R = state.roll, g = state.g, pl = g.turn;
    sounds.land();
    if (R.dbl) sounds.pair();
    const who = youNow() ? 'You rolled' : `${nameOf(pl)} rolled`;
    if (R.dbl && state.run >= TRIES) {
      say(`${who} a pair for the third time in a row! The most advanced piece on the track goes back to the cárcel.`);
      state.phase = 'penalty'; state.wait = 1.3; return;
    }
    say(`${who} ${R.dice[0]} and ${R.dice[1]}${R.dbl ? ': a pair!' : '.'}`);
    state.phase = 'show'; state.wait = 0.45;
  }
  function penalty() {
    const g = state.g, pl = g.turn, pen = pairPenalty(g, pl);
    if (pen) {
      state.fly.push({ pl, i: pen.i, from: posXY(g, pl, pen.i, pen.from), to: posXY(g, pl, pen.i, -1), t: 0, dur: state.prefs.calm ? 0.2 : 0.9 });
      state.jailShake[g.players[pl].arm] = 0.7; sounds.capture();
      say(`${posOf(pl)} most advanced piece goes back to the cárcel.`);
    } else say('No piece on the track to lose. The turn ends.');
    state.phase = 'penaltydone'; state.wait = 1.4;
  }
  function resolve() {
    const g = state.g, R = state.roll, pl = g.turn;
    if (R.rem.every((v) => v == null)) { finishRoll(); return; }
    const moves = legalMoves(g, R.rem, R.dbl, pl);
    if (!moves.length) {
      const unused = R.rem.filter((v) => v != null), all = unused.length === 2;
      say(all ? `No piece can move. ${noMoveReason(g, R.rem, R.dbl, pl)}` : `The ${unused[0]} cannot be used and is lost. ${noMoveReason(g, R.rem, R.dbl, pl)}`);
      state.phase = 'nomove'; state.wait = isHuman() ? 2.6 : 1.6;
      if (all && !R.dbl) sounds.refuse();
      return;
    }
    state.opts = moves; state.sel = -1; state.hintOn = false;
    state.dieSel = moves.some((m) => m.di === state.dieSel) ? state.dieSel : moves[0].di;
    if (apTurn()) {
      state.apMove = chooseMove(g, R.rem, R.dbl, cur().level, rng);
      state.phase = 'apthink'; state.wait = think();
      say(`${nameOf(pl)} is thinking... (think time ${think()}s)`);
      return;
    }
    if (aiTurn()) { state.aiMove = chooseMove(g, R.rem, R.dbl, cur().level, rng); state.phase = 'ai'; state.wait = 0.55; say(`${nameOf(pl)} is choosing...`); return; }
    state.phase = 'choose';
    const caps = moves.some((m) => m.caps.length), many = moves.length > 1;
    say(many ? `Pick a die, then a glowing piece, then TAP it again to move.${caps ? ' A capture is possible!' : ''}` : `Only one move: TAP the glowing piece.${caps ? ' It captures!' : ''}`);
    state.autoT = !many && state.prefs.auto ? 0.9 : null;
  }
  function finishRoll() {
    const g = state.g, R = state.roll, pl = g.turn;
    if (R.dbl && state.run < TRIES) {
      state.phase = 'throw'; state.wait = aiTurn() ? 0.8 : 0.25; say(aiTurn() ? `${nameOf(pl)} rolled a pair and rolls again...` : passGame() ? `${nameOf(pl)} rolled a pair: roll again!` : 'A pair earns another roll: roll again!');
      return;
    }
    if (!onBoard(g, pl) && R.used === 0 && state.tries < TRIES - 1) {
      state.tries++; state.phase = 'throw'; state.wait = aiTurn() ? 0.8 : 0.3;
      say(aiTurn() ? `${nameOf(pl)} tries again (${state.tries + 1} of ${TRIES}).` : `No pair${passGame() ? ' for ' + nameOf(pl) : ''}. Try ${state.tries + 1} of ${TRIES}: roll again.`);
      return;
    }
    endTurn();
  }

  // ---- moving ---------------------------------------------------------------------------------------------------------------------
  function play(m) {
    const g = state.g, calm = state.prefs.calm, pts = hopPath(g, m.pl, m.i, m.from, m.to), n = pts.length - 1;
    const per = calm ? 0.04 : Math.min(0.2, 1.4 / Math.max(1, n));
    const fly = m.caps.map(([o, k]) => ({ pl: o, i: k, from: posXY(g, o, k, g.pos[o][k]), to: posXY(g, o, k, -1), t: 0, dur: calm ? 0.2 : 0.9 }));
    state.hop = { pl: m.pl, i: m.i, pts, seg: 0, t: 0, per: m.enter ? (calm ? 0.1 : 0.45) : per, m, fly, n };
    state.opts = []; state.sel = -1; state.autoT = null; state.phase = 'hop'; state.wait = 0; state.hintOn = false;
    const you = youNow() && m.pl === g.turn, caps = m.caps.length ? ` and ${you ? 'capture' : 'captures'} ${m.caps.length > 1 ? m.caps.length + ' pieces' : 'a piece'}` : '';
    say(`${nameOf(m.pl)} ${m.enter ? (you ? 'free a piece' : 'frees a piece') : (you ? 'move ' : 'moves ') + m.value}${caps}.`);
  }
  function hopDone() {
    const g = state.g, h = state.hop, m = h.m, R = state.roll;
    const end = posXY(g, m.pl, m.i, m.to);
    const r = applyMove(g, m);
    R.rem[m.di] = null; R.used++;
    state.fly.push(...h.fly); state.hop = null; state.res = { ...r };
    if (m.enter) { sounds.free(); burst(end.x, end.y, ['#fff4d6', ...GOLD], 16, 200); }
    if (r.captured) {
      sounds.capture();
      h.fly.forEach((f) => { burst(f.from.x, f.from.y, ['#ff6a5a', '#fff0b0', '#ffffff'], 18, 260); state.jailShake[g.players[f.pl].arm] = 0.7; });
      say(`${nameOf(m.pl)} ${youNow() && m.pl === g.turn ? 'capture' : 'captures'} ${r.captured > 1 ? r.captured + ' pieces' : 'a piece'}! Back to the cárcel.`);
    }
    if (r.home) { sounds.home(); burst(end.x, end.y, GOLD, 26, 300, 6); }
    state.phase = 'after'; state.wait = r.captured ? 0.8 : 0.3;
  }
  function afterMove() {
    if (state.res.won) { state.phase = 'won'; state.wait = 1.1; sounds.win(); return; }
    resolve();
  }
  function endTurn() {
    const g = state.g;
    nextTurn(g);
    if (g.turns >= TURN_CAP) { // practically never: a stalled game ends with the usual ranking
      g.winner = g.players.map((_, pl) => pl).sort((a, b) => homeCount(g, b) - homeCount(g, a) || progressOf(g, b) - progressOf(g, a))[0];
      state.phase = 'won'; state.wait = 0.2; return;
    }
    beginTurn(); saveGame();
  }
  function rankOf(g) { return g.players.map((p, pl) => ({ pl, home: homeCount(g, pl), prog: progressOf(g, pl) })).sort((a, b) => (b.pl === g.winner) - (a.pl === g.winner) || b.home - a.home || b.prog - a.prog); }
  function resetOverFx() { state.parts = []; state.hop = null; state.fly = []; state.opts = []; state.sel = -1; }
  function finishGame() {
    const g = state.g, s = state.stats;
    const solo = g.players.filter((p) => p.human).length === 1;
    s.played++; if (solo && g.players[g.winner].human) s.wins++;
    saveStats(); clearSave();
    state.over = { winner: g.winner, rank: rankOf(g), youWon: solo && g.players[g.winner].human };
    go('over'); resetOverFx();
  }
  function apFinishGame() { state.over = { winner: state.g.winner, rank: rankOf(state.g), youWon: false }; go('autoplay-over'); resetOverFx(); }

  // ---- hitting things --------------------------------------------------------------------------------------------------------------
  function pawnAt(x, y) {
    const g = state.g; let best = null, bd = Math.max(36, 40 * UNIT);
    g.players.forEach((_, q) => g.pos[q].forEach((p, i) => {
      const s = posXY(g, q, i, p), d = Math.hypot(s.x - x, s.y - 18 * UNIT - y);
      if (d < bd) { bd = d; best = { pl: q, i, p }; }
    }));
    return best;
  }
  const dieOpts = (di) => state.opts.filter((o) => o.di === di);
  function selectDie(di) {
    if (state.phase !== 'choose' || !dieOpts(di).length) return false;
    state.dieSel = di; state.sel = -1; sounds.ui();
    say(`The ${state.roll.dice[di]} is selected. TAP a glowing piece, then TAP it again to move it.`);
    return true;
  }
  function selectMove(mv) {
    if (state.sel === mv.i && state.dieSel === mv.di) { play(mv); return; }
    state.dieSel = mv.di; state.sel = mv.i; sounds.ui();
    say(`${mv.enter ? 'It leaves the cárcel for your salida.' : `It moves ${mv.value} squares.`}${mv.caps.length ? ' It captures a rival!' : ''} TAP the piece again to move.`);
  }
  function tapBoard(x, y) {
    const g = state.g;
    if (state.phase === 'throw') { if (isHuman()) say('TAP or SWIPE the dice tray at the bottom to roll.'); return; }
    if (state.phase !== 'choose') return;
    const di = DICE_SPOTS.findIndex((s) => Math.hypot(s.x - x, s.y - y) < 54);
    if (di >= 0) { if (state.roll.rem[di] == null) say('That die is already used.'); else if (!selectDie(di)) say(`No piece can use the ${state.roll.dice[di]} right now.`); return; }
    const cur2 = dieOpts(state.dieSel);
    if (state.sel >= 0) {
      const m = cur2.find((o) => o.i === state.sel);
      if (m) { const d = posXY(g, m.pl, m.i, m.to); if (Math.hypot(d.x - x, d.y - 14 * UNIT - y) < Math.max(26, 30 * UNIT)) { play(m); return; } }
    }
    const pw = pawnAt(x, y);
    if (!pw) { state.sel = -1; say('TAP one of the glowing pieces, or TAP a die to switch.'); return; }
    if (pw.pl !== g.turn) { say('That is a rival piece. TAP one of your own glowing pieces.'); return; }
    const mv = cur2.find((o) => o.from === pw.p) || state.opts.find((o) => o.from === pw.p);
    if (mv) { selectMove(mv); return; }
    const val = state.roll.rem[state.dieSel] ?? state.roll.rem.find((v) => v != null);
    const why = checkMove(g, pw.pl, pw.i, val, state.roll.dbl);
    state.shake = { pl: pw.pl, i: pw.i, t: 0 }; sounds.refuse();
    say(`That piece cannot move: ${why.text || 'no legal move.'}`);
  }
  function cycle(dir) {
    if (state.phase !== 'choose') return;
    const list = dieOpts(state.dieSel); if (!list.length) return;
    const idx = list.findIndex((o) => o.i === state.sel), nx = list[(idx + dir + list.length * 2) % list.length];
    state.sel = nx.i; sounds.ui();
    say(`Selected. Press Space, or TAP the piece again, to ${nx.enter ? 'free a piece onto your salida' : 'move ' + nx.value + ' squares'}.`);
  }
  function confirmKey() {
    if (canThrow()) doThrow();
    else if (state.phase === 'choose') { if (state.sel < 0) cycle(1); else { const m = dieOpts(state.dieSel).find((o) => o.i === state.sel); if (m) play(m); } }
  }
  function useHint() {
    if (state.phase !== 'choose' || state.scene !== 'play') return;
    const R = state.roll, m = hintMove(state.g, R.rem, R.dbl, rng);
    if (!m) return;
    state.dieSel = m.di; state.sel = m.i; state.hintOn = true;
    say(`Hint: with the ${m.value}, ${describeMove(state.g, m)} TAP the piece to move.`);
  }

  function act(id) {
    const s = state;
    sounds.ui();
    if (id === 'new') go('setup');
    else if (id === 'continue') continueGame();
    else if (id === 'about') { go('about'); s.aboutPage = 0; s.refFrom = 'title'; }
    else if (id === 'how') { go('how'); s.howPage = 0; s.refFrom = 'title'; }
    else if (id === 'rules') { go('rules'); s.rulesPage = 0; s.refFrom = 'title'; }
    else if (id === 'settings') go('settings');
    else if (id === 'back') {
      if (s.scene === 'how' || s.scene === 'rules' || s.scene === 'about') leaveReader();
      else go('title');
    }
    else if (id === 'title') go('title');
    else if (id === 'page') {
      s.scroll = 0;                                                  // "Top" in the readers
    }
    else if (id === 'textDec') { if (s.prefs.textScaleIdx > 0) { s.prefs.textScaleIdx--; savePrefs(); clampPages(); } }
    else if (id === 'textInc') { if (s.prefs.textScaleIdx < TEXT_SCALES.length - 1) { s.prefs.textScaleIdx++; savePrefs(); clampPages(); } }
    else if (id === 'start') startGame();
    else if (id === 'autoplay') startAutoPlay();
    else if (id === 'apDec') { if (s.prefs.apThinkIdx > 0) { s.prefs.apThinkIdx--; savePrefs(); } }
    else if (id === 'apInc') { if (s.prefs.apThinkIdx < AP_THINK_STEPS.length - 1) { s.prefs.apThinkIdx++; savePrefs(); } }
    else if (id === 'appause') s.ap.paused = true;
    else if (id === 'apresume') s.ap.paused = false;
    else if (id.startsWith('pl:')) s.setup.players = Number(id.slice(3));
    else if (id.startsWith('opp:')) s.setup.opp = id.slice(4);
    else if (id.startsWith('mode:')) s.setup.mode = id.slice(5);
    else if (id.startsWith('set:')) { const k = id.slice(4); s.prefs[k] = !s.prefs[k]; savePrefs(); }
    else if (id === 'menu') { s.menuOpen = true; s.scroll = 0; }
    else if (id === 'resume') { s.menuOpen = false; s.scroll = 0; }
    else if (id === 'howmenu' || id === 'rulesmenu') { const from = s.scene; go(id === 'howmenu' ? 'how' : 'rules'); s.refFrom = from; s.howPage = 0; s.rulesPage = 0; }
    else if (id === 'leave') { s.hop = null; s.fly = []; if (s.scene === 'play') saveGame(); s.phase = 'throw'; go('title'); }
    else if (id === 'sound') { s.prefs.sound = !s.prefs.sound; savePrefs(); }
    else if (id === 'hint') useHint();
    else if (id === 'again') { if (s.scene === 'autoplay-over') startAutoPlay(); else startGame(); }
  }
  function leaveReader() { go(state.refFrom || 'title'); }
  function clampPages() {
    state.scroll = Math.min(state.scroll || 0, readerMax(state));
  }

  // ---- update ---------------------------------------------------------------------------------------------------------------------------
  function flow(dt) {
    let ph = state.phase;
    if ((ph === 'hop' && !state.hop) || (ph === 'roll' && !state.roll)) { state.phase = ph = 'throw'; state.wait = 0.2; }
    if (ph === 'hop') {
      const h = state.hop; h.t += dt;
      while (h.t >= h.per && h.seg < h.n) { h.t -= h.per; h.seg++; if (!h.m.enter) sounds.hop(); }
      if (h.seg >= h.n) hopDone();
      return;
    }
    if (ph === 'roll') { const R = state.roll; R.t += dt; if (R.t >= R.dur) rollDone(); return; }
    if (state.wait > 0) { state.wait -= dt; if (state.wait > 0) return; state.wait = 0; }
    switch (ph) {
      case 'throw': if (aiTurn()) doThrow(); break;
      case 'show': resolve(); break;
      case 'choose': if (state.autoT != null) { state.autoT -= dt; if (state.autoT <= 0) { const m = state.opts[0]; if (m) play(m); } } break;
      case 'ai': play(state.aiMove); break;
      case 'apthink': {
        const mv = state.apMove;
        state.phase = 'apreveal'; state.sel = mv.i; state.dieSel = mv.di; state.wait = AP_REVEAL_TIME;
        say(`${nameOf(state.g.turn)}: the ${mv.value}, ${describeMove(state.g, mv)}`);
        break;
      }
      case 'apreveal': play(state.apMove); break;
      case 'after': afterMove(); break;
      case 'nomove': finishRoll(); break;
      case 'penalty': penalty(); break;
      case 'penaltydone': endTurn(); break;
      case 'won': if (apTurn()) apFinishGame(); else finishGame(); break;
      default: break;
    }
  }

  // ---- showcase scenes (store screenshots only) ---------------------------------------------------------------------------
  // main.js sets env.config.showcase in `?shot=1` mode only. A showcase is a real, legal position played by the real game code
  // (forced dice), so store screenshots show a human mid-game instead of a menu.
  const SHOWCASE = {
    race: { players: 4, humans: [true, false, false, false], pos: [[-1, 14, 31, 52], [-1, 5, 38, 66], [-1, -1, 12, 47], [20, 44, 60, -1]], turn: 0, dice: [3, 5], hint: true },
    capture: { players: 2, humans: [true, false], pos: [[-1, 40, 58, 63], [10, 22, 69, 75]], turn: 0, dice: [4, 2], pick: (m) => m.caps.length > 0 },
    pass: { players: 3, humans: [true, true, true], pass: true, pos: [[-1, 20, 41, 56], [4, 27, 30, 50], [-1, -1, 15, 62]], turn: 1, dice: [6, 2] },
    pair: { players: 4, humans: [true, false, false, false], pos: [[-1, -1, -1, 18], [-1, 9, 40, 55], [-1, 25, 61, -1], [14, 33, -1, -1]], turn: 0, dice: [4, 4] },
    setup: { scene: 'setup', mode: 'pass', players: 3 },
    win: { players: 2, humans: [true, false], pos: [[75, 75, 75, 75], [75, 75, 31, 52]], turn: 0, dice: [1, 1], win: 0 },
  };
  function applyShowcase(name) {
    const S = SHOWCASE[name]; if (!S) return;
    state.prefs.auto = false; state.prefs.calm = false;
    if (S.scene) { state.prefs.textScaleIdx = S.z || 0; state.setup.mode = S.mode || 'cpu'; state.setup.players = S.players || 2; go(S.scene); state.scroll = S.scroll || 0; state.t = 12; return; }
    state.g = newGame({ players: S.players, humans: S.humans, levels: ['balanced', 'cautious', 'bold'] });
    if (S.pass) state.g.players.forEach((p) => { p.name = SEAT_NAMES[p.arm]; });
    state.g.pos = S.pos.map((a) => a.slice()); state.g.turn = S.turn; state.g.turns = 14; state.g.rolls = 30;
    go('play'); resetView(); beginTurn(); state.wait = 0; state.showcase = S;
    if (S.win != null) { state.g.winner = S.win; state.stats.played = 3; state.stats.wins = 1; finishGame(); return; }
    doThrow(S.dice); state.roll.t = state.roll.dur - 0.02; state.t = 12;
  }
  function showcaseStep() {
    const S = state.showcase;
    if (!S || S.done || state.phase !== 'choose') return;
    S.done = true;
    if (S.hint) useHint();
    if (S.pick) { const m = state.opts.find(S.pick); if (m) selectMove(m); }
  }

  const trayZone = () => ({ x: TRAY.x, y: TRAY.y - 20, w: TRAY.w, h: TRAY.h + 40 });
  const btnAt = (x, y) => screenButtons(state).find((b) => inRect(b, x, y) && (!b.clip || inRect(b.clip, x, y)));

  if (config.showcase) applyShowcase(config.showcase);

  return {
    update(dt, input) {
      ensureLayout();
      const sc = state.scene, ptr = input.pointer, keys = input.keys.pressed;
      const inPlay = sc === 'play' || sc === 'autoplay';
      const paused = sc === 'autoplay' && state.ap.paused;

      // pointer: buttons act on release (so a drag can scroll), board taps act on press
      if (ptr.pressed) {
        const b = btnAt(ptr.x, ptr.y), afZone = sc === 'title' && G.tt && G.tt.lockup ? creditHit(G.tt.lockup) : null;
        state.press = { x: ptr.x, y: ptr.y, moved: false, s0: state.scroll, b: b && !b.dim ? b.id : null, af: Boolean(afZone && inRect(afZone, ptr.x, ptr.y)) };
        if (!b && inPlay && !state.menuOpen && !paused) {
          if (canThrow() && inRect(trayZone(), ptr.x, ptr.y)) { doThrow(); state.press = null; }
          else if (aiTurn() && sc === 'play' && state.phase !== 'won') state.fast = true;
          else if (sc === 'play') tapBoard(ptr.x, ptr.y);
        }
      }
      if (ptr.down && state.press) {
        const pr = state.press, dy = ptr.y - pr.y;
        if (Math.abs(dy) > 14 || Math.abs(ptr.x - pr.x) > 14) pr.moved = true;
        const lay = screenLayout(state);
        const mx = lay ? lay.maxScroll : readerMax(state);
        if (pr.moved && mx > 0) state.scroll = Math.min(Math.max(pr.s0 - dy, 0), mx);
      }
      if (ptr.released && state.press) {
        const pr = state.press; state.press = null;
        if (!pr.moved && pr.b) { const b = btnAt(ptr.x, ptr.y); if (b && b.id === pr.b) act(b.id); }
        if (!pr.moved && pr.af && state.scene === 'title' && G.tt && inRect(creditHit(G.tt.lockup), ptr.x, ptr.y)) env.openArcforgeHome?.();
        if (!state.menuOpen && canThrow() && inRect(trayZone(), pr.x, pr.y) && Math.hypot(ptr.x - pr.x, ptr.y - pr.y) > 70) doThrow();
      }
      // keyboard
      if (inPlay) {
        if (keys.has('Escape')) { state.menuOpen = !state.menuOpen; state.scroll = 0; }
        if (!state.menuOpen && !paused) {
          if (keys.has('Space') || keys.has('Enter')) confirmKey();
          if (keys.has('ArrowRight') || keys.has('ArrowDown') || keys.has('Tab')) cycle(1);
          if (keys.has('ArrowLeft') || keys.has('ArrowUp')) cycle(-1);
          if (keys.has('KeyD')) selectDie(1 - state.dieSel);
          if (keys.has('KeyH')) useHint();
        }
      } else {
        const lay = screenLayout(state);
        if (lay && lay.maxScroll > 0) { if (keys.has('ArrowDown')) state.scroll = Math.min(lay.maxScroll, (state.scroll || 0) + 80); if (keys.has('ArrowUp')) state.scroll = Math.max(0, (state.scroll || 0) - 80); }
        const rmx = readerMax(state);
        if (sc === 'how' || sc === 'about' || sc === 'rules') {
          const set = (v) => { state.scroll = Math.max(0, Math.min(rmx, v)); };
          if (wheelInput.dy) { set((state.scroll || 0) + wheelInput.dy); wheelInput.dy = 0; }
          for (const [k, d] of [['ArrowDown', 80], ['ArrowUp', -80], ['PageDown', 500], ['PageUp', -500], ['Space', 500]]) if (keys.has(k)) set((state.scroll || 0) + d);
          if (keys.has('Home')) set(0); if (keys.has('End')) set(rmx);
          if (keys.has('Escape')) act('back');
        } else if (lay && wheelInput.dy) { state.scroll = Math.max(0, Math.min(lay.maxScroll, (state.scroll || 0) + wheelInput.dy)); wheelInput.dy = 0; }
        wheelInput.dy = 0;
      }

      // everything below is the simulation: a paused Auto Play freezes ALL of it (timers, dice, hops, particles)
      if (paused) return;
      state.t += dt;
      if (state.shake) { state.shake.t += dt; if (state.shake.t > 0.55) state.shake = null; }
      for (let a = 0; a < 4; a++) if (state.jailShake[a] > 0) state.jailShake[a] = Math.max(0, state.jailShake[a] - dt);
      for (const f of state.fly) f.t += dt;
      state.fly = state.fly.filter((f) => f.t < f.dur);
      for (const p of state.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.vx *= 0.99; p.rot = (p.rot || 0) + dt * 6; }
      state.parts = state.parts.filter((p) => p.life > 0);
      for (const e of state.sfx) e.t -= dt;
      for (const e of state.sfx.filter((q) => q.t <= 0)) audio.tone(e.o);
      state.sfx = state.sfx.filter((q) => q.t > 0);
      if ((sc === 'over' || sc === 'autoplay-over') && state.over && state.t % 1.2 < dt) burst(W * 0.25 + fx.next() * W * 0.5, G.cards.over.y + 90, [SEAT[state.g.players[state.over.winner].arm], '#ffe27a', '#fff4d6'], 14, 240, 6);
      if (inPlay && !state.menuOpen) flow(dt * (state.fast && aiTurn() && sc === 'play' ? 2.8 : 1));
      showcaseStep();
    },
    render(ctx, view) { ensureLayout(view); draw(ctx, state); },
    getState: () => state,
    // Only real play counts against the kit's free-preview timer. Menus, setup, settings, How/Rules/About, the pause menu,
    // result screens and Auto Play (a free teaching demo) are all exempt.
    isPreviewExempt: () => !(state.scene === 'play' && !state.menuOpen),
  };
}
void H; void W;
