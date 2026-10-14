// Game of the Goose: state and flow. Rules are in engine.js, drawing in view.js / boardview.js / docview.js, text in content.js.
//
// Turn flow (state.g.phase):
//   idle      waiting for the roll (a human taps Roll; a computer seat rolls after a short beat)
//   rolling   the dice tumble
//   decide    a human is choosing (a die, a feather, a road)           think -> reveal: a computer (or Watch and Learn) deciding
//   moving    the pawn is hopping / leaping; when the queue is empty its landing is resolved
//   wait      a short beat between turns
//   over      someone reached 63, the fanfare plays, then the result screen
// All time is the sum of the dt handed to update() (deterministic, pausable). Pause freezes everything before any animation advances.
import {
  FINAL, GEESE, MAX_FEATHERS, TALLY, VARIANT_KEYS, FEATHER_VALUE, DOUBLE_ESCAPE, MAZE, BRIDGE,
  walk, effectAt, isShieldable, rollOptions, previewOption, bestOption, valueTable, shieldGain, fullVariants,
} from './engine.js';
import { MIN_SEATS, THINK_CHOICES, DEFAULT_THINK_IDX, REVEAL_SECONDS, DEMO_GAMES, ROSTER, SPEEDS } from './rulesdata.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, actionRects } from './layout.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { rulesPages } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const defaultSeats = () => ['human', 'cpu', 'cpu', 'cpu', null, null];

export function createGame(env) {
  const { rng, storage, config } = env;
  const diceRng = rng.fork(), fxRng = rng.fork(), nrRng = rng.fork();
  const state = {
    scene: 'title', sceneT: 0, t: 0, backTo: 'title',
    prefs: { sound: true, speedIdx: 0, thinkIdx: DEFAULT_THINK_IDX, calm: false, textIdx: 0, seats: defaultSeats(), variants: fullVariants() },
    stats: { played: 0, won: 0, bestTurns: 0, feathers: 0 },
    demoRuns: 0, g: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, restoreMsg: '', restoreBusy: false, owned: () => env.monetization?.owns?.('unlock_game') === true, dev: config.dev === true, demo: config.demo === true,
  };
  let lastScene = state.scene, drag = null;
  const forced = [];                       // dev / test: dice to throw next, as [a, b] pairs

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    const p = state.prefs;
    if (typeof v.sound === 'boolean') p.sound = v.sound;
    p.speedIdx = clamp(v.speedIdx | 0, 0, SPEEDS.length - 1);
    p.thinkIdx = clamp(v.thinkIdx ?? DEFAULT_THINK_IDX, 0, THINK_CHOICES.length - 1);
    p.calm = !!v.calm;
    p.textIdx = clamp(v.textIdx | 0, 0, TEXT_SCALES.length - 1);
    if (Array.isArray(v.seats) && v.seats.length === 6) p.seats = v.seats.map((s) => (s === 'human' || s === 'cpu' ? s : null));
    if (v.variants) for (const k of VARIANT_KEYS) if (typeof v.variants[k] === 'boolean') p.variants[k] = v.variants[k];
    fixSeats(); applyPrefs();
  });
  storage.get('stats', null).then((v) => { if (v) Object.assign(state.stats, v); });
  storage.get('demoGames', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  function fixSeats() {
    const s = state.prefs.seats;
    for (let i = 0; s.filter(Boolean).length < MIN_SEATS && i < 6; i++) if (!s[i]) s[i] = 'cpu';
    if (!s.includes('human')) { const i = s.findIndex(Boolean); s[i < 0 ? 0 : i] = 'human'; }
  }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const tone = (o) => { if (state.prefs.sound) env.audio.tone?.(o); };
  const K = () => SPEEDS[state.prefs.speedIdx].k;
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result') state.g = null; };

  // ---- a game ------------------------------------------------------------------------------------------------------------------------
  function newGame(auto) {
    const variants = { ...state.prefs.variants };
    const seats = state.prefs.seats.map((s, i) => ({ s, i })).filter((x) => x.s);
    const list = auto ? [0, 1, 2, 3].map((i) => ({ s: 'cpu', i })) : seats;
    const players = list.map((x, k) => ({
      id: k, seat: x.i, name: ROSTER[x.i].name, kind: auto ? 'cpu' : x.s, pos: 0, skip: 0, stuck: null, feathers: 0, opened: false, turns: 0, dir: 1,
      vis: null, finished: false,
    }));
    return {
      auto, variants, players, cur: 0, turnNo: 0, phase: 'wait', timer: 0.6, next: 'start', V: valueTable(variants),
      dice: [0, 0], faces: [1, 1], rollT: 0, rolled: false, rerolled: false, rolling: false,
      dec: null, hint: null, hi: [], queue: [], mv: null, pops: [], flap: 0, think: null, revealTotal: 0,
      narr: { text: '', t: 0 }, log: [], paused: false, over: false, winner: -1, overT: 0,
    };
  }
  const cur = () => state.g.players[state.g.cur];
  const humanTurn = () => { const g = state.g; return !g.auto && cur().kind === 'human'; };

  function say(text) {
    const g = state.g;
    g.narr = { text, t: 0 };
    g.log.push(text); if (g.log.length > 40) g.log.shift();
  }
  const pick = (arr) => arr[nrRng.int(arr.length)];

  function startGame(auto) {
    if (state.demo && !auto) {
      if (state.demoRuns >= DEMO_GAMES) { go('demo-limit'); return; }
      state.demoRuns += 1; storage.set('demoGames', state.demoRuns);
    }
    const g = newGame(auto);
    state.g = g; state.result = null; state.scene = 'play'; state.sceneT = 0;
    const names = g.players.map((p) => p.name);
    say(`${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} sit down to the Game of the Goose. Sixty-three spaces to the Garden.`);
    env.monetization.track?.('game_start', { players: g.players.length, auto });
    g.phase = 'wait'; g.timer = 0.9; g.next = 'start';
  }

  function startTurn() {
    const g = state.g, p = cur();
    g.turnNo += 1; g.rerolled = false; g.rolled = false; g.dice = [0, 0]; g.dec = null; g.hint = null; g.hi = []; g.think = null;
    if (p.skip > 0) {
      p.skip -= 1;
      say(`${p.name} is still resting at the inn and misses this turn.`);
      g.phase = 'wait'; g.timer = 1.1 * K(); g.next = 'end';
      return;
    }
    g.phase = 'idle'; g.timer = (p.kind === 'cpu' ? 0.55 : 0) * K();
    if (p.stuck) say(`${p.name} is stuck in the ${p.stuck}. A double would climb out.`);
  }

  function endTurn() {
    const g = state.g;
    if (g.over) return;
    g.hi = []; g.dec = null; g.hint = null; g.mv = null;
    g.cur = (g.cur + 1) % g.players.length;
    g.phase = 'wait'; g.timer = 0.3 * K(); g.next = 'start';
  }

  // ---- rolling -----------------------------------------------------------------------------------------------------------------------
  function roll() {
    const g = state.g, p = cur();
    const f = forced.shift();
    const a = f ? f[0] : diceRng.int(6) + 1, b = f ? f[1] : diceRng.int(6) + 1;
    g.dice = [a, b]; g.rolling = true; g.rollT = 0; g.phase = 'rolling'; g.rolled = true; g.timer = 0.85 * K();
    if (!g.rerolled) p.turns += 1;
    for (let i = 0; i < 4; i++) tone({ freq: 700 + fxRng.int(900), dur: 0.03, type: 'square', vol: 0.04 });
  }
  const rollText = (p, a, b) => pick([`${p.name} throws ${a} and ${b}: ${a + b}.`, `${p.name} rolls ${a} and ${b}. That makes ${a + b}.`, `The dice show ${a} and ${b} for ${p.name}: ${a + b}.`]);

  function afterRoll() {
    const g = state.g, p = cur(), [a, b] = g.dice;
    g.rolling = false;
    say(rollText(p, a, b));
    if (p.stuck) {
      if (DOUBLE_ESCAPE && a === b) {
        const where = p.stuck; p.stuck = null;
        say(`A double! ${p.name} climbs out of the ${where} and walks on.`);
        tone({ freq: 440, to: 880, dur: 0.25, type: 'triangle', vol: 0.12 });
      } else {
        say(`${p.name} throws ${a} and ${b} and stays in the ${p.stuck}, waiting for rescue.`);
        g.phase = 'wait'; g.timer = 1.0 * K(); g.next = 'end'; return;
      }
    }
    const opts = rollOptions(a, b, g.variants, p.opened);
    const canReroll = g.variants.feathers && p.feathers > 0 && !g.rerolled;
    if (opts.length === 1 && !canReroll) { g.phase = 'wait'; g.timer = 0.45 * K(); g.next = { move: opts[0] }; return; }
    const shown = opts.map((o) => describeOption(p, o));
    if (canReroll) shown.push({ id: 'reroll', label: 'Roll again', sub: 'Spend 1 feather', kind: 'reroll' });
    openDecision({ kind: 'die', opts: shown, raw: opts, canReroll });
  }

  function describeOption(p, o) {
    const g = state.g;
    const r = previewOption(p.pos, o, g.variants, p.feathers, p.dir);
    const bits = [];
    if (o.opening) bits.push(`leap to ${o.opening}`);
    else {
      bits.push(`to ${r.end}`);
      if (r.geese) bits.push(r.geese === 1 ? 'goose' : `${r.geese} geese`);
      if (r.jump === 'bridge') bits.push('bridge');
      else if (r.jump === 'maze') bits.push('maze');
      else if (r.jump === 'skeleton') bits.push('skeleton');
      else if (r.hazard === 'inn') bits.push('inn');
      else if (r.stuck) bits.push(r.stuck);
      else if (r.win) bits.push('the Garden!');
    }
    const label = o.opening ? `Leap ${o.amount}` : o.die < 0 ? `Move ${o.amount}` : `Move ${o.amount} (one die)`;
    return { id: o.id, label, sub: bits.join(', '), kind: 'die', amount: o.amount, end: r.end };
  }

  // ---- decisions -----------------------------------------------------------------------------------------------------------------------
  function openDecision(dec) {
    const g = state.g, p = cur();
    g.dec = dec; g.hint = null;
    // the computer's answer is worked out now (so Think / Reveal can show it) and used if a computer seat is deciding
    dec.pickId = computerChoice(dec, p);
    if (dec.kind === 'die') g.hi = dec.opts.filter((o) => o.end !== undefined).map((o) => ({ n: o.end, id: o.id }));
    else if (dec.kind === 'shield') g.hi = [{ n: p.pos, id: 'shield' }];
    else g.hi = [{ n: dec.to, id: 'take' }];
    if (humanTurn()) { g.phase = 'decide'; g.timer = 0; tone({ freq: 520, dur: 0.07, type: 'triangle', vol: 0.08 }); return; }
    // computer seat or Watch and Learn: Think, then Reveal, then Act
    g.phase = 'think';
    const total = g.auto ? THINK_CHOICES[state.prefs.thinkIdx] : 0.4 * K();
    g.think = { total, left: total };
    g.timer = total;
  }

  function computerChoice(dec, p) {
    const g = state.g;
    if (dec.kind === 'die') {
      const b = bestOption(g.V, p.pos, dec.raw, g.variants, p.feathers, p.dir, dec.canReroll);
      dec.info = b;
      return b.reroll ? 'reroll' : b.best;
    }
    if (dec.kind === 'shield') {
      const gain = shieldGain(g.V, dec.effect, p.pos);
      dec.gain = gain;
      return gain > FEATHER_VALUE + 0.15 ? 'shield' : 'accept';
    }
    const gain = g.V[p.pos] - g.V[dec.to];
    dec.gain = gain;
    return gain > 0 ? 'take' : 'stay';
  }

  function resolveDecision(id) {
    const g = state.g, dec = g.dec, p = cur();
    if (!dec || !dec.opts.some((o) => o.id === id)) return;
    g.dec = null; g.hint = null; g.hi = []; g.think = null;
    if (dec.kind === 'die') {
      if (id === 'reroll') {
        p.feathers -= 1; g.rerolled = true;
        say(`${p.name} spends a feather and rolls again.`);
        roll(); return;
      }
      const o = dec.raw.find((q) => q.id === id);
      g.phase = 'wait'; g.timer = 0.12; g.next = { move: o };
      return;
    }
    if (dec.kind === 'shield') {
      if (id === 'shield') {
        p.feathers -= 1;
        say(`${p.name} spends a feather and slips past the ${dec.what}.`);
        tone({ freq: 660, to: 990, dur: 0.2, type: 'triangle', vol: 0.12 });
        g.pops.push({ n: p.pos, text: 'Safe!', col: '#f6d27a', age: 0, fx: 'feather' });
        g.phase = 'wait'; g.timer = 0.7 * K(); g.next = 'end'; return;
      }
      applyHazard(dec.effect); return;
    }
    if (id === 'take') {
      say(`${p.name} takes the ${dec.name} to space ${dec.to}.`);
      g.queue.push({ k: 'slide', pid: p.id, from: p.pos, to: dec.to, t: 0, dur: 0.75 * K(), road: true });
      g.mv.after = 'end'; g.phase = 'moving'; return;
    }
    say(`${p.name} stays on the main track.`);
    g.phase = 'wait'; g.timer = 0.5 * K(); g.next = 'end';
  }

  // ---- moving ----------------------------------------------------------------------------------------------------------------------
  function beginMove(o) {
    const g = state.g, p = cur();
    p.opened = true;
    g.mv = { amount: o.amount, dir: p.dir, after: null, chain: 0 };
    g.hi = [];
    if (o.opening) {
      say(`An opening throw! ${p.name} leaps straight to ${o.opening}.`);
      tone({ freq: 380, to: 760, dur: 0.4, type: 'triangle', vol: 0.12 });
      g.queue.push({ k: 'leap', pid: p.id, from: p.pos, to: o.opening, t: 0, dur: 0.95 * K() });
      g.mv.after = 'end'; g.phase = 'moving'; return;
    }
    queueWalk(p, o.amount);
    g.phase = 'moving';
  }

  function queueWalk(p, n) {
    const g = state.g;
    const w = walk(p.pos, n, g.mv.dir);
    let from = p.pos;
    for (const to of w.path) { g.queue.push({ k: 'hop', pid: p.id, from, to, t: 0, dur: 0.15 * K() }); from = to; }
    g.mv.dir = w.dir;
    g.mv.endAt = w.end;
  }

  function stepQueue(dt) {
    const g = state.g, a = g.queue[0];
    if (!a) return false;
    if (a.k === 'wait') { a.t += dt; if (a.t >= a.dur) g.queue.shift(); return true; }
    const p = g.players[a.pid];
    a.t += dt;
    p.vis = { from: a.from, to: a.to, u: clamp(a.t / a.dur, 0, 1), k: a.k };
    if (a.t >= a.dur) {
      p.pos = a.to; p.vis = null; g.queue.shift();
      if (a.k === 'hop') tone({ freq: 300 + (a.to % 7) * 24, dur: 0.045, type: 'triangle', vol: 0.07 });
      else if (a.k === 'leap') tone({ freq: 180, to: 120, dur: 0.12, type: 'sine', vol: 0.12 });
    }
    return true;
  }

  function landed() {
    const g = state.g, p = cur(), pos = p.pos;
    p.dir = g.mv.dir;
    if (g.mv.after === 'end') { endTurn(); return; }
    const e = effectAt(pos, g.variants);
    if (e.type === 'win') { win(p); return; }
    if (e.type === 'goose') {
      g.mv.chain += 1;
      let line = `${cap(p.name)} lands on a goose at ${pos}! It carries the pawn ${g.mv.dir < 0 ? 'back' : 'on'} another ${g.mv.amount}.`;
      let text = 'Goose!';
      if (g.variants.feathers) {
        if (p.feathers < MAX_FEATHERS) { p.feathers += 1; state.stats.feathers += 1; line += ' A feather drifts down.'; text = 'Goose! +feather'; }
        else line += ' The feather pouch is already full.';
      }
      g.pops.push({ n: pos, text, col: '#fff6dc', age: 0, fx: 'feather' });
      say(line);
      g.flap = 1;
      tone({ freq: 340, to: 260, dur: 0.18, type: 'sawtooth', vol: 0.1 });
      tone({ freq: 410, to: 330, dur: 0.16, type: 'sawtooth', vol: 0.08 });
      g.queue.push({ k: 'wait', dur: 0.55 * K(), t: 0 });
      queueWalk(p, g.mv.amount);
      return;
    }
    if (e.type === 'road') {
      say(`${p.name} stops at a signpost: the ${e.name} leads on to space ${e.to}.`);
      openDecision({ kind: 'road', to: e.to, name: e.name, opts: [
        { id: 'take', label: `Take the ${e.name}`, sub: `Shortcut to space ${e.to}`, kind: 'road-take', end: e.to },
        { id: 'stay', label: 'Stay here', sub: 'Keep to the track', kind: 'road-stay' }] });
      return;
    }
    if (isShieldable(e) && g.variants.feathers && p.feathers > 0) {
      const what = hazardName(e);
      say(`${p.name} has landed on the ${what}.`);
      openDecision({ kind: 'shield', effect: e, what, opts: [
        { id: 'shield', label: 'Spend a feather', sub: `Slip past the ${what}`, kind: 'shield' },
        { id: 'accept', label: `Accept the ${what}`, sub: 'Keep the feather', kind: 'accept' }] });
      return;
    }
    if (e.type === 'none') { say(plainLine(p, pos)); g.phase = 'wait'; g.timer = 0.5 * K(); g.next = 'end'; return; }
    applyHazard(e);
  }
  const hazardName = (e) => (e.type === 'skip' ? 'inn' : e.kind);
  const plainLine = (p, pos) => pick([`${p.name} stops on ${pos}.`, `${p.name} rests on space ${pos}.`, `${p.name} stands on ${pos}.`]);

  function applyHazard(e) {
    const g = state.g, p = cur();
    if (e.type === 'jump') {
      let line;
      if (e.kind === 'bridge') {
        line = `${p.name} crosses the bridge from ${BRIDGE.at} to ${BRIDGE.to}.`;
        tone({ freq: 392, dur: 0.1, type: 'triangle', vol: 0.1 }); tone({ freq: 523, dur: 0.1, type: 'triangle', vol: 0.1 }); tone({ freq: 659, dur: 0.16, type: 'triangle', vol: 0.1 });
      } else if (e.kind === 'maze') { line = `${p.name} is lost in the maze and is led back to ${MAZE.to}.`; tone({ freq: 300, to: 160, dur: 0.4, type: 'sawtooth', vol: 0.08 }); }
      else { line = `The skeleton! ${p.name} must start again from the beginning.`; tone({ freq: 200, to: 60, dur: 0.7, type: 'sawtooth', vol: 0.12 }); }
      say(line);
      g.pops.push({ n: p.pos, text: e.kind === 'bridge' ? 'Bridge!' : e.kind === 'maze' ? 'Lost!' : 'Back to start!', col: e.kind === 'bridge' ? '#a9d6ff' : '#f2a08f', age: 0 });
      g.queue.push({ k: e.kind === 'bridge' ? 'leap' : 'slide', pid: p.id, from: p.pos, to: e.to, t: 0, dur: (e.kind === 'bridge' ? 0.9 : 0.85) * K() });
      g.mv.after = 'end'; g.phase = 'moving';
      return;
    }
    if (e.type === 'skip') {
      p.skip += e.turns;
      say(`${p.name} stops at the inn, and rests there for a turn.`);
      tone({ freq: 330, to: 262, dur: 0.35, type: 'triangle', vol: 0.1 });
      g.pops.push({ n: p.pos, text: 'Rest a turn', col: '#f0cf8d', age: 0 });
      g.phase = 'wait'; g.timer = 0.9 * K(); g.next = 'end'; return;
    }
    if (e.type === 'stuck') {
      let freed = null;
      for (const q of g.players) if (q !== p && q.stuck === e.kind) { q.stuck = null; freed = q; }
      p.stuck = e.kind;
      if (freed) say(`${p.name} lands in the ${e.kind} and ${freed.name} is set free! ${p.name} must wait there now.`);
      else say(`${p.name} falls into the ${e.kind}. Another pawn landing here will set them free, or a double.`);
      tone({ freq: 260, to: 110, dur: 0.5, type: 'sine', vol: 0.12 });
      g.pops.push({ n: p.pos, text: freed ? 'Swapped!' : cap(e.kind) + '!', col: '#f2a08f', age: 0 });
      g.phase = 'wait'; g.timer = 1.0 * K(); g.next = 'end';
    }
  }

  function win(p) {
    const g = state.g;
    g.over = true; g.winner = p.id; g.phase = 'over'; g.overT = 0; g.mv = null; g.queue.length = 0;
    p.finished = true;
    say(`${p.name} lands exactly on the Garden of the Goose in ${p.turns} ${p.turns === 1 ? 'turn' : 'turns'} and wins the game!`);
    for (let i = 0; i < 3; i++) tone({ freq: 523 * (1 + i * 0.25), dur: 0.3, type: 'triangle', vol: 0.12 });
    tone({ freq: 1046, dur: 0.6, type: 'triangle', vol: 0.12 });
    g.pops.push({ n: FINAL, text: 'Winner!', col: '#f6d27a', age: 0, fx: 'feather' });
  }

  function finishGame() {
    const g = state.g;
    const rows = g.players.map((p) => ({
      id: p.id, name: p.name, seat: p.seat, kind: p.kind, pos: p.pos, feathers: p.feathers, turns: p.turns,
      tally: p.pos + p.feathers * TALLY.perFeather + (p.id === g.winner ? TALLY.winner : 0), winner: p.id === g.winner,
    }));
    rows.sort((a, b) => b.tally - a.tally);
    const humanWon = g.players[g.winner].kind === 'human' && !g.auto;
    const res = { rows, winner: g.winner, winnerName: g.players[g.winner].name, turns: g.players[g.winner].turns, humanWon, auto: g.auto, variants: { ...g.variants }, newBest: false };
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
      const dec = g.dec, id = dec.pickId, opt = dec.opts.find((o) => o.id === id);
      let text;
      if (dec.kind === 'die') {
        const sc = dec.info?.scored.find((q) => q.id === id);
        text = id === 'reroll' ? 'Hint: roll again. This throw is poor, and a feather is worth less than a good throw.'
          : `Hint: ${opt.label.toLowerCase()} (${opt.sub}).${sc ? ` About ${Math.round(sc.value)} turns to go.` : ''}`;
      } else if (dec.kind === 'shield') text = id === 'shield' ? 'Hint: spend the feather. This hazard costs more turns than a feather is worth.' : 'Hint: keep the feather. This hazard costs little.';
      else text = id === 'take' ? `Hint: take the road, it saves about ${Math.max(0, dec.gain).toFixed(1)} turns.` : 'Hint: stay on the track. That road would lead you somewhere worse.';
      g.hint = { id, text, t: 0 };
      return;
    }
    const ahead = GEESE.filter((x) => x > p.pos && x - p.pos <= 12).map((x) => x - p.pos);
    const nearest = ahead[0];
    let text = `About ${Math.round(g.V[p.pos])} turns to go from space ${p.pos}.`;
    if (p.stuck) text = `You are in the ${p.stuck}. Throw a double, or wait for another pawn to land here.`;
    else if (nearest && nearest >= 2) text += ` The next goose is ${nearest} spaces away${nearest === 7 ? ', the most likely total' : ''}.`;
    g.hint = { id: null, text, t: 0 };
  }

  // ---- the turn clock ------------------------------------------------------------------------------------------------------------------
  function updateTurn(dt) {
    const g = state.g;
    for (const q of g.pops) q.age += dt;
    g.pops = g.pops.filter((q) => q.age < 1.5);
    g.flap = Math.max(0, g.flap - dt * 2);
    g.narr.t += dt;
    if (g.hint) { g.hint.t += dt; if (g.hint.t > 9) g.hint = null; }
    const ph = g.phase;
    if (ph === 'idle') {
      const p = cur();
      if (p.kind === 'cpu') { g.timer -= dt; if (g.timer <= 0) roll(); }
    } else if (ph === 'rolling') {
      g.rollT += dt; g.timer -= dt;
      if (Math.floor(g.rollT * 14) !== Math.floor((g.rollT - dt) * 14)) g.faces = [fxRng.int(6) + 1, fxRng.int(6) + 1];
      if (g.timer <= 0) { g.faces = [...g.dice]; afterRoll(); }
    } else if (ph === 'think') {
      g.timer -= dt; g.think.left = Math.max(0, g.timer);
      if (g.timer <= 0) { g.phase = 'reveal'; g.revealTotal = g.auto ? REVEAL_SECONDS : 0.7 * K(); g.timer = g.revealTotal; }
    } else if (ph === 'reveal') {
      g.timer -= dt;
      if (g.timer <= 0) resolveDecision(g.dec.pickId);
    } else if (ph === 'moving') {
      if (!stepQueue(dt)) landed();
    } else if (ph === 'wait') {
      g.timer -= dt;
      if (g.timer <= 0) {
        const nx = g.next; g.next = null;
        if (nx === 'end') endTurn();
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
      const A = actionRects(lay(), 1, true);
      const hit = tapAt && (inRect(A.btns[0], tapAt.x, tapAt.y) || inRect(A.dice[0], tapAt.x, tapAt.y) || inRect(A.dice[1], tapAt.x, tapAt.y));
      if (hit || k.has('Space') || k.has('Enter')) roll();
    } else if (human && g.phase === 'decide' && g.dec) {
      const A = actionRects(lay(), g.dec.opts.length, true);
      let id = null;
      if (tapAt) g.dec.opts.forEach((o, i) => { if (inRect(A.btns[i], tapAt.x, tapAt.y)) id = o.id; });
      ['Digit1', 'Digit2', 'Digit3', 'Digit4'].forEach((c, i) => { if (k.has(c) && g.dec.opts[i]) id = g.dec.opts[i].id; });
      if ((k.has('Space') || k.has('Enter')) && !id) id = g.dec.opts[0].id;
      if (id) resolveDecision(id);
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
    else if (id === 'restore') {
      const m = env.monetization;
      if (state.demo || state.restoreBusy || !m || m.owns?.('unlock_game')) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(m.restore()).then(() => {
        state.restoreMsg = m.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No earlier purchase found for this account.';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
      return;
    }
    savePrefs();
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
      let ns = s === 'human' ? 'cpu' : s === 'cpu' ? (n > MIN_SEATS ? null : 'human') : 'human';
      p.seats[i] = ns;
      if (!p.seats.includes('human')) p.seats[i] = 'human';
      savePrefs();
    });
    U.varRows.forEach((r, i) => { if (inRect(r, tapAt.x, tapAt.y)) { const key = VARIANT_KEYS[i]; p.variants[key] = !p.variants[key]; savePrefs(); } });
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
    // Tester tools (?dev=1 and tests): force the dice, jump to a screen with a prepared table.
    dev: {
      forceDice(list) { forced.push(...list); },
      jump(o = {}) {
        const sc = o.scene ?? 'title';
        if (o.variants) Object.assign(state.prefs.variants, o.variants);
        if (o.seats) state.prefs.seats = o.seats.slice();
        if (sc === 'play') {
          startGame(!!o.auto);
          const g = state.g;
          if (o.pos) o.pos.forEach((n, i) => { if (g.players[i]) g.players[i].pos = n; });
          if (o.feathers) o.feathers.forEach((n, i) => { if (g.players[i]) g.players[i].feathers = n; });
          if (o.stuck) o.stuck.forEach((s, i) => { if (g.players[i] && s) g.players[i].stuck = s; });
          if (o.cur !== undefined) g.cur = o.cur;
          if (o.opened) g.players.forEach((p) => { p.opened = true; });
          if (o.dice) forced.push(o.dice);
          if (o.log) o.log.forEach((t) => say(t));
          startTurn();
          if (o.roll) { g.timer = 0; roll(); }
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startGame(false); const g = state.g;
          g.players.forEach((p, i) => { p.pos = [63, 51, 40, 22][i] ?? 10; p.feathers = [1, 2, 0, 3][i] ?? 0; p.turns = 9; });
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
