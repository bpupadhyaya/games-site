// Patolli: state and flow. Rules are in engine.js, drawing in view.js / boardview.js / docview.js, words in content.js.
//
// Turn flow (state.g.phase):
//   idle      waiting for the throw (a human taps Throw the beans; a computer seat throws after a short beat)
//   throwing  the beans tumble
//   decide    a human is choosing a piece           think -> reveal: a computer (or Watch and Learn) deciding
//   moving    the piece is hopping; when the queue is empty its landing is resolved
//   wait      a short beat between steps
//   over      someone brought every piece home, the fanfare plays, then the result screen
// All time is the sum of the dt handed to update() (deterministic, pausable). Pause freezes everything before any animation advances.
import {
  HOME, LOOP, BEANS, MAX_CHAIN, BONUS_MARKS, PIECE_CHOICES, DEFAULT_PIECES, RULE_KEYS, armsFor, marksToSteps, fullRules,
  legalMoves, rankMoves, allHome, homeCount, pitCount, finalP, danger, loopIdx,
} from './engine.js';
import { MIN_SEATS, THINK_CHOICES, DEFAULT_THINK_IDX, REVEAL_SECONDS, DEMO_GAMES, ROSTER, SPEEDS } from './rulesdata.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, actionRects, host } from './layout.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { rulesPages } from './content.js';
import { frameOf, piecePos } from './boardview.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const defaultSeats = () => ['human', 'cpu', null, null];

export function createGame(env) {
  const { rng, storage, config } = env;
  const beanRng = rng.fork(), fxRng = rng.fork(), nrRng = rng.fork();
  const state = {
    scene: 'title', sceneT: 0, t: 0, backTo: 'title',
    prefs: { sound: true, speedIdx: 0, thinkIdx: DEFAULT_THINK_IDX, calm: false, textIdx: 0, seats: defaultSeats(), pieces: DEFAULT_PIECES, rules: fullRules() },
    stats: { played: 0, won: 0, bestTurns: 0, captures: 0 },
    demoRuns: 0, g: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
    restoreMsg: '', restoreBusy: false, owned: () => env.monetization?.owns?.('unlock_game') === true,
  };
  let lastScene = state.scene, drag = null;
  const forced = [];                       // dev / test: marked-face counts to throw next

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    const p = state.prefs;
    if (typeof v.sound === 'boolean') p.sound = v.sound;
    p.speedIdx = clamp(v.speedIdx | 0, 0, SPEEDS.length - 1);
    p.thinkIdx = clamp(v.thinkIdx ?? DEFAULT_THINK_IDX, 0, THINK_CHOICES.length - 1);
    p.calm = !!v.calm;
    p.textIdx = clamp(v.textIdx | 0, 0, TEXT_SCALES.length - 1);
    if (Array.isArray(v.seats) && v.seats.length === 4) p.seats = v.seats.map((s) => (s === 'human' || s === 'cpu' ? s : null));
    if (PIECE_CHOICES.includes(v.pieces)) p.pieces = v.pieces;
    if (v.rules) for (const k of RULE_KEYS) if (typeof v.rules[k] === 'boolean') p.rules[k] = v.rules[k];
    fixSeats(); applyPrefs();
  });
  storage.get('stats', null).then((v) => { if (v) Object.assign(state.stats, v); });
  storage.get('demoGames', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  function fixSeats() {
    const s = state.prefs.seats;
    for (let i = 0; s.filter(Boolean).length < MIN_SEATS && i < 4; i++) if (!s[i]) s[i] = 'cpu';
    if (!s.includes('human')) { const i = s.findIndex(Boolean); s[i < 0 ? 0 : i] = 'human'; }
  }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const tone = (o) => { if (state.prefs.sound) env.audio.tone?.(o); };
  const K = () => SPEEDS[state.prefs.speedIdx].k;
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result') state.g = null; };
  const boardFrame = () => frameOf(lay().play.board);

  // ---- a game ------------------------------------------------------------------------------------------------------------------------
  function newGame(auto) {
    const rules = { ...state.prefs.rules };
    const seats = state.prefs.seats.map((s, i) => ({ s, i })).filter((x) => x.s);
    const list = auto ? [0, 1].map((i) => ({ s: 'cpu', i })) : seats;
    const arms = armsFor(list.length);
    const n = state.prefs.pieces;
    const players = list.map((x, k) => ({
      id: k, seat: x.i, arm: arms[k], name: ROSTER[x.i].name, kind: auto ? 'cpu' : x.s,
      pieces: new Array(n).fill(0), captures: 0, turns: 0, throws: 0,
    }));
    return {
      auto, rules, players, cur: 0, turnNo: 0, phase: 'wait', timer: 0.6, next: 'start', npieces: n,
      beans: [false, false, false, false, false], marks: 0, steps: 0, throwT: 0, thrown: false, chain: 0,
      dec: null, hint: null, queue: [], vis: null, mv: null, pops: [], think: null, revealTotal: 0,
      narr: { text: '', t: 0 }, log: [], paused: false, over: false, winner: -1, overT: 0,
    };
  }
  const cur = () => state.g.players[state.g.cur];
  const humanTurn = () => { const g = state.g; return !g.auto && cur().kind === 'human'; };
  const pick = (arr) => arr[nrRng.int(arr.length)];

  function say(text) {
    const g = state.g;
    g.narr = { text, t: 0 };
    g.log.push(text); if (g.log.length > 40) g.log.shift();
  }

  function startGame(auto) {
    if (state.demo && !auto) {
      if (state.demoRuns >= DEMO_GAMES) { go('demo-limit'); return; }
      state.demoRuns += 1; storage.set('demoGames', state.demoRuns);
    }
    const g = newGame(auto);
    state.g = g; state.result = null; state.scene = 'play'; state.sceneT = 0;
    const names = g.players.map((p) => p.name);
    say(`${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} sit at the stone cross. ${g.npieces} pieces each, all to come home.`);
    env.monetization.track?.('game_start', { players: g.players.length, auto });
    g.phase = 'wait'; g.timer = 0.9; g.next = 'start';
  }

  function startTurn() {
    const g = state.g, p = cur();
    g.turnNo += 1; g.chain = 0; g.thrown = false; g.dec = null; g.hint = null; g.think = null; g.marks = 0; g.steps = 0;
    p.turns += 1;
    g.phase = 'idle'; g.timer = (p.kind === 'cpu' ? 0.55 : 0) * K();
  }
  function throwAgain() {
    const g = state.g, p = cur();
    g.thrown = false; g.dec = null; g.hint = null; g.think = null;
    g.phase = 'idle'; g.timer = (p.kind === 'cpu' ? 0.5 : 0) * K();
  }
  function endTurn() {
    const g = state.g;
    if (g.over) return;
    g.dec = null; g.hint = null; g.mv = null; g.vis = null;
    g.cur = (g.cur + 1) % g.players.length;
    g.phase = 'wait'; g.timer = 0.3 * K(); g.next = 'start';
  }

  // ---- throwing ----------------------------------------------------------------------------------------------------------------------
  function throwBeans() {
    const g = state.g, p = cur();
    const f = forced.shift();
    let marks = 0;
    const beans = [];
    for (let i = 0; i < BEANS; i++) {
      const up = f !== undefined ? i < f : beanRng.int(2) === 1;
      beans.push(up); if (up) marks += 1;
    }
    g.beans = beans; g.marks = marks; g.steps = marksToSteps(marks); g.thrown = true;
    g.throwT = 0; g.phase = 'throwing'; g.timer = 0.9 * K(); p.throws += 1;
    for (let i = 0; i < 5; i++) tone({ freq: 220 + fxRng.int(260), dur: 0.035, type: 'square', vol: 0.045 });
  }
  const stepsWord = (n) => `${n} ${n === 1 ? 'step' : 'steps'}`;

  function afterThrow() {
    const g = state.g, p = cur();
    const marks = g.marks, steps = g.steps;
    say(marks === 0 ? `${p.name} throws no marked faces: ${stepsWord(steps)}.` : marks === BEANS ? `${p.name} throws all five marked: ${stepsWord(steps)} and another throw!`
      : `${p.name} throws ${marks} marked ${marks === 1 ? 'face' : 'faces'}: ${stepsWord(steps)}.`);
    const moves = legalMoves(g.players, p.seat, steps, g.rules);
    if (moves.length === 0) {
      say(`${p.name} throws ${stepsWord(steps)} but no piece can use it.`);
      g.phase = 'wait'; g.timer = 0.9 * K(); g.next = marks === BONUS_MARKS && g.chain < MAX_CHAIN ? 'again' : 'end';
      if (g.next === 'again') g.chain += 1;
      return;
    }
    if (moves.length === 1) { g.phase = 'wait'; g.timer = 0.5 * K(); g.next = { move: moves[0] }; return; }
    openDecision(moves);
  }

  function describe(m) {
    const bits = [];
    if (m.finish) bits.push('home!');
    if (m.cap) bits.push('captures a piece');
    if (m.trap) bits.push(`trap: back to ${finalP(m)}`);
    if (m.boost) bits.push('corner stone: throw again');
    if (m.pair) bits.push('makes a pair');
    if (!bits.length) bits.push(`to place ${m.to}`);
    return { label: m.from === 0 ? 'Bring a piece in' : m.finish ? 'Bring a piece home' : `Piece at ${m.from}`, sub: bits.join(', ') };
  }

  // ---- decisions -----------------------------------------------------------------------------------------------------------------------
  function openDecision(moves) {
    const g = state.g;
    const human = humanTurn();
    const best = rankMoves(g.players, moves, g.rules, null);
    const noisy = human || g.auto ? best : rankMoves(g.players, moves, g.rules, () => (nrRng.next() - 0.5) * 0.9);
    const lead = moves.reduce((a, m, i) => (m.from > moves[a].from ? i : a), 0);
    g.dec = { moves, scores: best.scores, best: best.best, pick: g.auto || human ? best.best : noisy.best, sel: lead, info: moves.map(describe) };
    g.hint = null;
    if (human) { g.phase = 'decide'; g.timer = 0; tone({ freq: 520, dur: 0.07, type: 'triangle', vol: 0.08 }); return; }
    g.phase = 'think';
    const total = g.auto ? THINK_CHOICES[state.prefs.thinkIdx] : 0.4 * K();
    g.think = { total, left: total };
    g.timer = total;
  }

  function resolveDecision(idx) {
    const g = state.g, dec = g.dec;
    if (!dec || !dec.moves[idx]) return;
    const m = dec.moves[idx];
    g.dec = null; g.hint = null; g.think = null;
    g.phase = 'wait'; g.timer = 0.1; g.next = { move: m };
  }

  // ---- moving ----------------------------------------------------------------------------------------------------------------------
  function beginMove(m) {
    const g = state.g, pl = cur();
    g.mv = { m, stage: 0 };
    if (m.from === 0) tone({ freq: 380, to: 560, dur: 0.12, type: 'triangle', vol: 0.1 });
    let from = m.from;
    const steps = m.to - m.from;
    const dur = clamp(0.9 / Math.max(1, steps), 0.07, 0.15) * K();
    for (let q = m.from + 1; q <= m.to; q++) {
      g.queue.push({ k: q === 1 ? 'enter' : 'hop', seat: pl.seat, id: pl.id, j: m.j, from, to: q, t: 0, dur });
      from = q;
    }
    g.phase = 'moving';
  }

  function stepQueue(dt) {
    const g = state.g, a = g.queue[0];
    if (!a) return false;
    if (a.k === 'wait') { a.t += dt; if (a.t >= a.dur) g.queue.shift(); return true; }
    const pl = g.players[a.id];
    a.t += dt;
    g.vis = { id: a.id, j: a.j, from: a.from, to: a.to, u: clamp(a.t / a.dur, 0, 1), k: a.k };
    if (a.t >= a.dur) {
      pl.pieces[a.j] = a.to; g.vis = null; g.queue.shift();
      if (a.k === 'hop' || a.k === 'enter') tone({ freq: 300 + (a.to % 7) * 26, dur: 0.045, type: 'triangle', vol: 0.07 });
      else if (a.k === 'slide') tone({ freq: 240, to: 130, dur: 0.2, type: 'sawtooth', vol: 0.09 });
      else if (a.k === 'fly') tone({ freq: 200, to: 90, dur: 0.25, type: 'sine', vol: 0.12 });
    }
    return true;
  }

  function popAt(text, col, id, j, p) { state.g.pops.push({ text, col, id, j, p, age: 0 }); }

  function landed() {
    const g = state.g, p = cur(), m = g.mv.m;
    const flyVictim = () => {
      const v = g.players.find((q) => q.seat === m.cap.seat);
      g.queue.push({ k: 'fly', seat: v.seat, id: v.id, j: m.cap.j, from: m.cap.p, to: 0, t: 0, dur: 0.55 * K() });
      p.captures += 1; state.stats.captures += 1;
      say(`${p.name} lands on a piece of ${v.name} and sends it back to the pit!`);
      popAt('Captured!', '#ffb08a', p.id, m.j, m.to);
    };
    g.mv.stage += 1;
    if (g.mv.stage === 1) {
      // first arrival: what happened on the square
      if (m.finish) {
        say(`${p.name} brings a piece home.`);
        popAt('Home!', '#ffe9a0', p.id, m.j, HOME);
        tone({ freq: 523, to: 784, dur: 0.3, type: 'triangle', vol: 0.12 });
      } else if (m.cap && m.capAt === 'land') flyVictim();
      if (m.trap) {
        say(`${p.name} falls into a trap and is thrown back to place ${m.slideTo}.`);
        popAt('Trap!', '#ffb08a', p.id, m.j, m.to);
        g.queue.push({ k: 'wait', dur: 0.35 * K(), t: 0 });
        g.queue.push({ k: 'slide', seat: p.seat, id: p.id, j: m.j, from: m.to, to: m.slideTo, t: 0, dur: 0.6 * K() });
      } else if (m.boost) {
        say(`${p.name} reaches a corner stone and throws again.`);
        popAt('Corner stone!', '#8ff0e6', p.id, m.j, m.to);
        tone({ freq: 660, to: 990, dur: 0.22, type: 'triangle', vol: 0.12 });
      } else if (m.pair && !m.finish) {
        say(`${p.name} makes a pair. No one can land there.`);
      } else if (!m.cap && !m.finish) {
        say(pick([`${p.name} moves a piece to place ${m.to}.`, `${p.name} steps a piece on to place ${m.to}.`]));
      }
      if (g.queue.length) { g.phase = 'moving'; return; }
    }
    if (m.cap && m.capAt === 'slide' && !g.mv.slideDone) {
      g.mv.slideDone = true; flyVictim();
      if (g.queue.length) { g.phase = 'moving'; return; }
    }
    // all done: win, extra throw or pass the beans
    if (allHome(p)) { win(p); return; }
    const extra = (g.marks === BONUS_MARKS || m.boost) && g.chain < MAX_CHAIN;
    if (extra) { g.chain += 1; g.phase = 'wait'; g.timer = 0.6 * K(); g.next = 'again'; }
    else { g.phase = 'wait'; g.timer = 0.35 * K(); g.next = 'end'; }
  }

  function win(p) {
    const g = state.g;
    g.over = true; g.winner = p.id; g.phase = 'over'; g.overT = 0; g.mv = null; g.queue.length = 0; g.vis = null;
    say(`${p.name} brings every piece home and wins the game!`);
    for (let i = 0; i < 3; i++) tone({ freq: 523 * (1 + i * 0.25), dur: 0.3, type: 'triangle', vol: 0.12 });
    tone({ freq: 1046, dur: 0.6, type: 'triangle', vol: 0.12 });
  }

  function finishGame() {
    const g = state.g;
    const rows = g.players.map((p) => {
      const left = p.pieces.filter((q) => q < HOME).reduce((s, q) => s + q, 0);
      return {
        id: p.id, name: p.name, seat: p.seat, kind: p.kind, home: homeCount(p), pit: pitCount(p), n: p.pieces.length, captures: p.captures, turns: p.turns,
        tally: homeCount(p) * 10 + Math.floor(left / 4) + (p.id === g.winner ? 20 : 0), winner: p.id === g.winner,
      };
    });
    rows.sort((a, b) => b.tally - a.tally);
    const w = g.players[g.winner];
    const humanWon = w.kind === 'human' && !g.auto;
    const res = { rows, winner: g.winner, winnerName: w.name, turns: w.turns, humanWon, auto: g.auto, rules: { ...g.rules }, newBest: false, npieces: g.npieces };
    if (!g.auto) {
      const s = state.stats; s.played += 1;
      if (humanWon) { s.won += 1; if (!s.bestTurns || res.turns < s.bestTurns) { s.bestTurns = res.turns; res.newBest = true; } }
      storage.set('stats', s);
    }
    env.monetization.track?.('game_end', { winner: g.winner, turns: res.turns, auto: g.auto });
    state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  // ---- hints -------------------------------------------------------------------------------------------------------------------------
  function showHint() {
    const g = state.g;
    if (!g || g.over) return;
    const p = cur();
    if (g.dec) {
      const dec = g.dec, m = dec.moves[dec.best];
      const reasons = [];
      if (m.finish) reasons.push('it brings a piece home');
      if (m.cap) reasons.push('it captures a piece and sends it back to the pit');
      if (m.boost) reasons.push('it ends on a corner stone, so you throw again');
      if (m.pair) reasons.push('it makes a pair that cannot be landed on');
      if (m.trap) reasons.push(`but it falls into a trap, back to place ${finalP(m)}`);
      const fp = finalP(m);
      const iTo = fp >= 1 && fp <= LOOP ? loopIdx(p.arm, fp) : -1;
      const risk = iTo >= 0 && !m.pair ? danger(g.players, p.seat, iTo) : 0;
      if (!reasons.length) reasons.push(m.from === 0 ? 'it gets a piece onto the track' : 'it makes the most progress safely');
      let text = `Hint: ${describe(m).label.toLowerCase()}, to place ${m.to}: ${reasons.join(', ')}.`;
      if (risk > 0.2) text += ` Be careful: about ${Math.round(risk * 100)} in 100 that it is hit next throw.`;
      g.hint = { pick: dec.best, text, t: 0 };
      dec.sel = dec.best;
      return;
    }
    const togo = Math.round(p.pieces.reduce((s, q) => s + Math.max(0, HOME - q), 0) / 2.8);
    g.hint = { pick: null, text: `${p.name} has ${homeCount(p)} of ${g.npieces} pieces home. About ${togo} throws to go.`, t: 0 };
  }

  // ---- the turn clock ------------------------------------------------------------------------------------------------------------------
  function updateTurn(dt) {
    const g = state.g;
    for (const q of g.pops) q.age += dt;
    g.pops = g.pops.filter((q) => q.age < 1.5);
    g.narr.t += dt;
    if (g.hint) { g.hint.t += dt; if (g.hint.t > 9) g.hint = null; }
    const ph = g.phase;
    if (ph === 'idle') {
      const p = cur();
      if (p.kind === 'cpu' || g.auto) { g.timer -= dt; if (g.timer <= 0) throwBeans(); }
    } else if (ph === 'throwing') {
      g.throwT += dt; g.timer -= dt;
      if (g.timer <= 0) afterThrow();
    } else if (ph === 'think') {
      g.timer -= dt; g.think.left = Math.max(0, g.timer);
      if (g.timer <= 0) { g.phase = 'reveal'; g.revealTotal = g.auto ? REVEAL_SECONDS : 0.7 * K(); g.timer = g.revealTotal; }
    } else if (ph === 'reveal') {
      g.timer -= dt;
      if (g.timer <= 0) resolveDecision(g.dec.pick);
    } else if (ph === 'moving') {
      if (!stepQueue(dt)) landed();
    } else if (ph === 'wait') {
      g.timer -= dt;
      if (g.timer <= 0) {
        const nx = g.next; g.next = null;
        if (nx === 'end') endTurn();
        else if (nx === 'again') throwAgain();
        else if (nx && nx.move) beginMove(nx.move);
        else startTurn();
      }
    } else if (ph === 'over') {
      g.overT += dt;
      if (g.overT > 2.6) finishGame();
    }
  }

  // ---- play screen input ---------------------------------------------------------------------------------------------------------------
  function pause() { const g = state.g; if (g && !g.paused && !g.over) g.paused = true; }
  function resume() { const g = state.g; if (g) g.paused = false; }
  const pauseItems = (g) => (g.over ? ['exit'] : ['resume', 'restart', 'quit']);

  // The option whose piece stands nearest to a tap. The reach is at least ~30 css px so a finger on a small phone still finds it;
  // `loose` takes the nearest glowing piece anywhere on the board (tap-to-select assist, never confirms).
  function optionAt(x, y, loose) {
    const g = state.g, dec = g.dec, f = boardFrame(), p = cur();
    const reach = Math.max(f.cell * 0.85, 30 / Math.max(0.2, host.px || 1));
    let best = -1, bd = loose ? Infinity : reach;
    dec.moves.forEach((m, i) => {
      p.pieces.forEach((q, j) => {
        if (q !== m.from) return;
        const c = piecePos(f, p.arm, j, q), d = Math.hypot(c.x - x, c.y - y);
        if (d < bd) { bd = d; best = i; }
      });
    });
    return best;
  }
  function destAt(x, y) {
    const g = state.g, dec = g.dec, f = boardFrame(), p = cur();
    const m = dec.moves[dec.sel];
    const c = piecePos(f, p.arm, m.j, m.to);
    return Math.hypot(c.x - x, c.y - y) < f.cell * 0.6;
  }

  function updatePlay(dt, tapAt, input) {
    const g = state.g, P = lay().play, k = input.keys.pressed;
    if (g.paused) { updatePauseMenu(tapAt, input); return; }
    if (tapAt) {
      if (inRect(P.pause, tapAt.x, tapAt.y) || inRect(P.menu, tapAt.x, tapAt.y)) { pause(); return; }
      if (inRect(P.hint, tapAt.x, tapAt.y)) showHint();
    }
    if (k.has('Escape') || k.has('KeyP')) { pause(); return; }
    if (k.has('KeyH')) showHint();
    const human = humanTurn();
    if (human && g.phase === 'idle') {
      const A = actionRects(lay(), 1);
      const hit = tapAt && (inRect(A.btns[0], tapAt.x, tapAt.y) || A.beans.some((r) => inRect(r, tapAt.x, tapAt.y)));
      if (hit || k.has('Space') || k.has('Enter')) throwBeans();
    } else if (human && g.phase === 'decide' && g.dec) {
      const dec = g.dec, A = actionRects(lay(), 2);
      let confirm = false;
      if (tapAt) {
        if (inRect(A.btns[0], tapAt.x, tapAt.y)) confirm = true;
        else if (inRect(A.btns[1], tapAt.x, tapAt.y)) dec.sel = (dec.sel + 1) % dec.moves.length;
        else {
          const i = optionAt(tapAt.x, tapAt.y);
          if (i >= 0) { if (i === dec.sel) confirm = true; else dec.sel = i; }
          else if (destAt(tapAt.x, tapAt.y)) confirm = true;
          else if (inRect(lay().play.board, tapAt.x, tapAt.y)) { const j = optionAt(tapAt.x, tapAt.y, true); if (j >= 0) dec.sel = j; }
        }
      }
      if (k.has('Tab') || k.has('ArrowRight') || k.has('ArrowDown')) dec.sel = (dec.sel + 1) % dec.moves.length;
      if (k.has('ArrowLeft') || k.has('ArrowUp')) dec.sel = (dec.sel + dec.moves.length - 1) % dec.moves.length;
      if (k.has('Space') || k.has('Enter')) confirm = true;
      if (confirm) resolveDecision(dec.sel);
    }
    updateTurn(dt);
  }
  function updatePauseMenu(tapAt, input) {
    const g = state.g, items = pauseItems(g), M = menuRects(lay(), items.length, 96);
    if ((input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) && !g.over) { resume(); return; }
    if (!tapAt) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tapAt.x, tapAt.y)) return;
      if (it === 'resume') resume();
      else if (it === 'restart') startGame(g.auto);
      else go('title');
    });
  }

  // ---- menus and documents -------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'speed') p.speedIdx = cyc(p.speedIdx, SPEEDS.length);
    else if (id === 'think') p.thinkIdx = cyc(p.thinkIdx, THINK_CHOICES.length);
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') { restorePurchase(); return; }
    savePrefs();
  }
  function restorePurchase() {
    if (state.demo || state.restoreBusy) return;
    const mon = env.monetization;
    if (!mon?.restore) { state.restoreMsg = 'Purchases are not available here.'; return; }
    state.restoreBusy = true; state.restoreMsg = 'Checking...';
    Promise.resolve().then(() => mon.restore()).then(() => {
      state.restoreMsg = mon.owns('unlock_game') ? 'Full game unlocked.' : 'No earlier purchase found.';
    }).catch(() => { state.restoreMsg = 'Could not reach the store.'; })
      .then(() => { state.restoreBusy = false; });
  }
  function updateDoc(input) {
    const p = input.pointer, max = docMetrics.max, view = ui.view;
    const setScroll = (v) => { state.docScroll = Math.max(0, Math.min(v, max)); };
    const wy = input.wheel?.dy || 0;
    if (wy) setScroll(state.docScroll + wy);
    const k = input.keys.pressed;
    if (k.has('ArrowDown')) setScroll(state.docScroll + 70);
    if (k.has('ArrowUp')) setScroll(state.docScroll - 70);
    if (k.has('PageDown')) setScroll(state.docScroll + docMetrics.view * 0.9);
    if (k.has('PageUp')) setScroll(state.docScroll - docMetrics.view * 0.9);
    if (k.has('Escape')) { go(state.backTo); return; }
    if (p.pressed) drag = { x0: p.x, y0: p.y, s0: state.docScroll, moved: false, inView: inRect(view, p.x, p.y) };
    if (drag && p.down) {
      if (Math.abs(p.y - drag.y0) > 14) drag.moved = true;
      if (drag.moved && drag.inView) setScroll(drag.s0 - (p.y - drag.y0));
    }
    if (drag && p.released) {
      const d = drag; drag = null;
      if (d.moved) return;
      for (const h of ui.hits) {
        if (!inRect(h.r, d.x0, d.y0)) continue;
        if (h.clip && !inRect(h.clip, d.x0, d.y0)) continue;
        docAction(h.id); return;
      }
    }
  }
  function docAction(id) {
    if (id === 'back') { go(state.backTo); return; }
    if (id === 'textDec' || id === 'textInc') {
      const n = state.prefs.textIdx + (id === 'textInc' ? 1 : -1);
      if (n < 0 || n >= TEXT_SCALES.length) return;
      state.docFrac = docMetrics.max > 0 ? state.docScroll / docMetrics.max : 0; state.docRescale = true;
      state.prefs.textIdx = n; savePrefs(); return;
    }
    const pages = rulesPages().length;
    if (id === 'prev') { if (state.rulesPage > 0) { state.rulesPage -= 1; state.docScroll = 0; } return; }
    if (id === 'next') { if (state.rulesPage < pages - 1) { state.rulesPage += 1; state.docScroll = 0; } else go(state.backTo); return; }
    if (id.startsWith('set:')) settingsAction(id.slice(4));
  }

  function updateTitle(tapAt) {
    if (!tapAt) return;
    const T = lay().title, hit = (r) => inRect(r, tapAt.x, tapAt.y);
    if (hit(T.play)) go('setup');
    else if (hit(T.auto)) startGame(true);
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tapAt.y > T.credit.y - 60 && Math.abs(tapAt.x - T.credit.x) < 200) env.openArcforgeHome?.();
  }
  function updateSetup(tapAt, input) {
    const U = lay().setup, p = state.prefs;
    if (input.keys.pressed.has('Escape')) { go('title'); return; }
    if (!tapAt) return;
    if (inRect(U.back, tapAt.x, tapAt.y)) { go('title'); return; }
    U.seatCards.forEach((r, i) => {
      if (!inRect(r, tapAt.x, tapAt.y)) return;
      const n = p.seats.filter(Boolean).length, s = p.seats[i];
      // human -> computer -> empty -> human; never fewer than two seats and never without a human
      const ns = s === 'human' ? 'cpu' : s === 'cpu' ? (n > MIN_SEATS ? null : 'human') : 'human';
      p.seats[i] = ns;
      if (!p.seats.includes('human')) p.seats[i] = 'human';
      savePrefs();
    });
    U.varRows.forEach((r, i) => {
      if (!inRect(r, tapAt.x, tapAt.y)) return;
      if (i === 0) p.pieces = PIECE_CHOICES[(PIECE_CHOICES.indexOf(p.pieces) + 1) % PIECE_CHOICES.length];
      else { const key = RULE_KEYS[i - 1]; if (key) p.rules[key] = !p.rules[key]; }
      savePrefs();
    });
    if (inRect(U.start, tapAt.x, tapAt.y)) startGame(false);
  }
  function updateResult(tapAt) {
    if (!tapAt) return;
    const Rr = lay().result, r = state.result;
    if (inRect(Rr.again, tapAt.x, tapAt.y)) startGame(r.auto);
    else if (inRect(Rr.setup, tapAt.x, tapAt.y)) go(r.auto ? 'title' : 'setup');
    else if (inRect(Rr.menu, tapAt.x, tapAt.y)) go('title');
    else if (tapAt.y > Rr.more.y - 30 && tapAt.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see -------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tapAt = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(tapAt);
      else if (sc === 'setup') updateSetup(tapAt, input);
      else if (sc === 'play') updatePlay(dt, tapAt, input);
      else if (sc === 'result') updateResult(tapAt);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tapAt) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
    // Called by main.js when the app goes to the background.
    autoPause() { if (state.scene === 'play') pause(); },
    // Everything except real play is free: menus, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const g = state.g;
      return !(state.scene === 'play' && g && !g.auto && !g.paused && !g.over);
    },
    // Tester tools (?dev=1 and tests): force the beans, jump to a screen with a prepared table.
    dev: {
      forceThrows(list) { forced.push(...list); },
      jump(o = {}) {
        const sc = o.scene ?? 'title';
        if (o.seats) state.prefs.seats = o.seats.slice();
        if (o.pieces) state.prefs.pieces = o.pieces;
        if (o.rules) Object.assign(state.prefs.rules, o.rules);
        if (sc === 'play') {
          startGame(!!o.auto);
          const g = state.g;
          if (o.progress) o.progress.forEach((arr, i) => { if (g.players[i]) arr.forEach((n, j) => { if (j < g.players[i].pieces.length) g.players[i].pieces[j] = n; }); });
          if (o.cur !== undefined) g.cur = o.cur;
          if (o.throws) forced.push(...o.throws);
          if (o.log) { o.log.forEach((t) => say(t)); g.narr.t = 1; }
          startTurn();
          if (o.throw) { g.timer = 0; throwBeans(); }
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startGame(false); const g = state.g;
          g.players.forEach((p, i) => { p.pieces = p.pieces.map((_, j) => (i === 0 || j % 2 ? HOME : 14 + j * 3)); p.turns = 31 + i; p.captures = 2 - i; });
          win(g.players[0]); g.overT = 9; finishGame(); state.result.newBest = true;
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.g) pause();
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) api.update(1 / 60, idle);
        }
      },
    },
  };
  return api;
}
