// Snakes & Ladders Cloth Board: state and flow. Rules live in rules.js, drawing in art.js / view.js.
// This is the only file that mutates `state`. All time comes from `dt`, all randomness from env.rng.
//
// A turn:  idle (waiting to roll)  ->  toss (dice tumble)  ->  [pick (two dice, human chooses)]  ->  hold (a beat)
//          ->  move (hop, climb or slide)  ->  [bump (a bumped pawn hops back)]  ->  next turn.
// Watch & Learn (scene 'demo') runs the same machine with all seats played by the AI, adding the teaching
// loop THINK -> REVEAL (options lit, chosen one gold) -> ACT, and a Pause that freezes everything.
import {
  W, H, layoutFor, toCanon, tableAt, tableOffset, dieK, TEXT_SCALES, THINK_STEPS, inRect, squareAt, posXY, squareXY, startXY,
} from './layout.js';
import {
  newGame, optionsFor, applyMove, aiPick, bestOption, scoreOption, describeOption, lookAhead, classicBoard, generateBoard, seededRng, FINISH,
} from './rules.js';
import { snakePath } from './art.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { render, dieRects, msgItems } from './view.js';
import { listPointer } from './ui.js';

// `meta.width/height` are updated live by the kit on every resize (fluid viewport: short side 720); every rectangle comes from layoutFor().
// Mouse wheel / trackpad scrolling for the reference pages (main.js adds to dy, in virtual units).
export const wheelInput = { dy: 0 };
export const meta = { width: W, height: H, fluid: { short: 720 } };
const DEMO_LIMIT = 3;
const EMPTY_LAY = { rows: [], total: 0, G: { x: 0, w: 1, top: 0, bottom: 1 }, side: 0 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(env) {
  const { rng, storage, audio, config, monetization } = env;
  const vrng = rng.fork();   // cosmetic randomness only (spin, sparks): never shifts the dice
  const state = {
    scene: 'title', t: 0, page: 0, ui: { scroll: 0, drag: null },
    setup: { dice: 'one', players: 2, vs: 'cpu', level: 2, board: 'classic', exact: true, six: false, bump: false },
    sound: true, haptics: true, msgOpen: false, press: null, textIdx: 0, thinkIdx: 2, stats: { played: 0, wins: 0 }, demoPlays: 0, demoCount: 0,
    g: null, titleBoard: classicBoard(),
    phase: 'idle', mover: -1, wait: 0, holdT: 0, pendingDie: 0, values: [], options: [], restFace: [], tossDice: null, toss: null,
    shown: [0, 0], anim: null, parts: [], rings: [], sfx: [], msg: null, banner: null, reveal: null, hintDie: -1, chosenDie: undefined, thinkRing: false, shake: null,
    over: false, restored: false, paused: false, demo: { phase: 'think', timer: 0, speed: 1, finished: false }, gesture: null,
  };
  state.g = newGame({ players: 2, vsComputers: true, board: state.titleBoard });
  let lay = null;                         // the scrolling-list layout of the current scene (ui.js)
  const LY = () => layoutFor(meta.width, meta.height, state.g.players.length);   // screen geometry for the live size

  const savePrefs = () => storage.set('prefs', { sound: state.sound, haptics: state.haptics, textIdx: state.textIdx, thinkIdx: state.thinkIdx, setup: state.setup });
  storage.get('prefs', null).then((p) => {
    if (!p) return;
    state.sound = p.sound !== false; state.haptics = p.haptics !== false; audio.setMuted(!state.sound);
    state.textIdx = clamp(p.textIdx ?? 0, 0, TEXT_SCALES.length - 1); state.thinkIdx = clamp(p.thinkIdx ?? 2, 0, THINK_STEPS.length - 1);
    if (p.setup) Object.assign(state.setup, p.setup);
  });
  storage.get('stats', null).then((s) => { if (s) state.stats = { played: s.played ?? 0, wins: s.wins ?? 0 }; });
  storage.get('demoPlays', 0).then((n) => { state.demoPlays = n | 0; });

  // ---- helpers ---------------------------------------------------------------------------------------------
  const cur = () => state.g.players[state.g.turn];
  const say = (text, kind = 'info') => { state.msg = { text, kind }; };
  const speed = () => (state.scene === 'demo' ? state.demo.speed : 1);
  const later = (delay, o) => state.sfx.push({ at: state.t + delay, o });
  const laterBuzz = (delay, h) => state.sfx.push({ at: state.t + delay, h });
  const sound = (name, k = 0) => {
    if (!state.sound) return;
    if (name === 'tok') audio.tone({ freq: 300 + k * 48, to: 230 + k * 30, dur: 0.07, type: 'triangle', vol: 0.26 });
    else if (name === 'throw') audio.tone({ freq: 260, to: 620, dur: 0.18, type: 'sine', vol: 0.1 });
    else if (name === 'climb') [392, 494, 587, 784, 988].forEach((f, i) => later(i * 0.1, { freq: f, dur: 0.22, type: 'sine', vol: 0.17 }));
    else if (name === 'slide') { audio.tone({ freq: 760, to: 90, dur: 0.95, type: 'sawtooth', vol: 0.1 }); audio.tone({ freq: 2000, to: 500, dur: 0.6, type: 'square', vol: 0.025 }); }
    else if (name === 'bump') audio.tone({ freq: 150, to: 60, dur: 0.3, type: 'triangle', vol: 0.34 });
    else if (name === 'win') [523, 659, 784, 1046, 1318].forEach((f, i) => later(i * 0.13, { freq: f, dur: 0.4, type: 'sine', vol: 0.2 }));
    else if (name === 'pick') audio.tone({ freq: 700, to: 940, dur: 0.1, type: 'sine', vol: 0.14 });
    else if (name === 'ok') audio.tone({ freq: 680, to: 880, dur: 0.08, type: 'sine', vol: 0.12 });
    else if (name === 'six') [660, 880].forEach((f, i) => later(i * 0.1, { freq: f, dur: 0.2, type: 'sine', vol: 0.16 }));
  };
  // Haptics: the shell may provide env.haptic(pattern); otherwise navigator.vibrate where the WebView has it (Android).
  // Players only (not Watch & Learn), and only when Vibration is On in Settings. Silent no-op everywhere else.
  const buzz = (pattern) => {
    if (!state.haptics || state.scene !== 'play') return;
    try { if (env.haptic) env.haptic(pattern); else globalThis.navigator?.vibrate?.(pattern); } catch { /* no haptics here */ }
  };
  const burst = (x, y, n, cols, spd = 160, kind = 'spark', g = 380, scr = false) => {
    for (let k = 0; k < n; k++) { const a = vrng.range(0, Math.PI * 2), v = vrng.range(spd * 0.3, spd); state.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.3, t: 0, max: vrng.range(0.35, 0.8), size: vrng.range(2, 4.5), c: cols[k % cols.length], kind, g, scr }); }
  };
  const confetti = () => {
    const cols = ['#ffd75a', '#ff6b5a', '#5ad0c0', '#b983ff', '#fff'];
    for (let k = 0; k < 90; k++) state.parts.push({ x: vrng.range(0, LY().w), y: vrng.range(-200, -10), vx: vrng.range(-60, 60), vy: vrng.range(60, 220), t: 0, max: vrng.range(2.2, 3.6), size: vrng.range(4, 8), c: cols[k % 5], kind: 'confetti', g: 120, scr: true, rot: vrng.range(0, 6), spin: vrng.range(-8, 8) });
  };
  const go = (scene) => { state.scene = scene; state.msgOpen = false; state.ui.scroll = 0; state.ui.drag = null; state.page = 0; };
  const banner = (text, color, color2) => { state.banner = { text, t: 0, color, color2 }; };

  // ---- starting games ------------------------------------------------------------------------------------------
  function makeBoard(kind) {
    if (kind === 'fresh') return generateBoard(rng.fork(), 'fresh');
    if (kind === 'daily') return generateBoard(seededRng((config.day | 0) * 7919 + 17), 'daily');
    return classicBoard();
  }
  function resetRun() {
    const g = state.g;
    Object.assign(state, { shown: g.players.map(() => 0), phase: 'idle', wait: 0, values: [], options: [], restFace: [], tossDice: null, toss: null, anim: null, parts: [], rings: [], sfx: [], msg: null, banner: null, reveal: null, hintDie: -1, chosenDie: undefined, thinkRing: false, over: false, paused: false, msgOpen: false, gesture: null });
    state.demo = { phase: 'think', timer: 0, speed: state.demo.speed ?? 1, finished: false };
  }
  function startGame() {
    if (config.demo && state.demoPlays >= DEMO_LIMIT) { go('demo-limit'); return; }
    if (config.demo) { state.demoPlays++; storage.set('demoPlays', state.demoPlays); }
    const s = state.setup;
    state.g = newGame({ players: s.players, vsComputers: s.vs === 'cpu', level: s.level, board: makeBoard(s.board), opts: { dice: s.dice, exact: s.exact, sixAgain: s.six, bump: s.bump } });
    go('play'); resetRun(); savePrefs(); startTurn();
  }
  function startDemo() {
    const two = state.demoCount % 2 === 0;
    state.demoCount++;
    state.g = newGame({ players: 2, allAi: true, level: 3, board: classicBoard(), opts: { dice: two ? 'two' : 'one', exact: true, sixAgain: false, bump: !two } });
    const sp = state.demo.speed ?? 1;
    go('demo'); resetRun(); state.demo.speed = sp; startTurn();
  }
  function toMenu() { go('title'); state.phase = 'idle'; state.anim = null; state.over = false; state.paused = false; state.msg = null; state.banner = null; state.reveal = null; state.g = newGame({ players: 2, vsComputers: true, board: state.titleBoard }); state.shown = [0, 0]; }

  // ---- the turn machine ------------------------------------------------------------------------------------------
  function lookAheadText(g, pos) {
    const r = lookAhead(g, pos), ups = r.filter((x) => x.jump && x.jump.kind === 'ladder'), downs = r.filter((x) => x.jump && x.jump.kind === 'snake');
    const parts = [];
    if (g.opts.exact && pos > 0 && FINISH - pos <= 6) parts.push(`You need exactly ${FINISH - pos} to finish.`);
    if (ups.length) parts.push(`Ladder: roll ${ups.map((x) => `${x.roll} to reach ${x.to}`).join(', ')}.`);
    if (downs.length) parts.push(`Serpent: a ${downs.map((x) => `${x.roll} slides to ${x.to}`).join(', ')}.`);
    if (!parts.length) parts.push('No ladder or serpent within one roll.');
    return parts.join(' ');
  }
  function startTurn() {
    const g = state.g, p = cur(), demo = state.scene === 'demo';
    Object.assign(state, { phase: 'idle', mover: -1, values: [], options: [], reveal: null, hintDie: -1, chosenDie: undefined, tossDice: null, thinkRing: false });
    if (demo) {
      state.demo.phase = 'think'; state.demo.timer = THINK_STEPS[state.thinkIdx]; state.thinkRing = true;
      say(`THINK. ${p.name} on ${p.pos || 'the start'}: ${g.opts.dice === 'two' ? 'two dice, pick the better landing. ' : ''}${lookAheadText(g, p.pos)}`, 'info');
    } else if (p.ai) state.wait = 0.6 + vrng.range(0, 0.5);
    else say(g.players.some((q) => q.ai) ? 'Your turn. Tap Roll or flick the dice.' : `${p.name}, your turn. Tap Roll or flick the dice.`, 'info');
  }
  function roll(flick) {
    const g = state.g, n = g.opts.dice === 'two' ? 2 : 1;
    const values = []; for (let i = 0; i < n; i++) values.push(1 + rng.int(6));
    state.values = values; state.restFace = values.slice(); state.msg = null; state.hintDie = -1; state.thinkRing = false;
    state.phase = 'toss'; state.toss = { t: 0, dur: 1.05 };
    // dice positions are offsets from the table centre (design units), so rotating the device mid-throw cannot strand them
    const Ly = LY(), k = dieK(Ly, n), fo = flick ? tableOffset(Ly, n, flick.x, flick.y) : null, lim = (Ly.table.w / 2 - 70 * k) / k;
    state.tossDice = values.map((v, i) => {
      const sx = fo ? fo.x + (i ? 36 : -10) / k : n === 1 ? 0 : i ? 60 : -60, sy = fo ? fo.y : (Ly.table.h / 2 - 18) / k;
      const lane = n === 1 ? (flick ? clamp(flick.dx * 0.35 / k, -120, 120) : 0) : (i ? 125 : -125);
      const ang = vrng.range(-0.5, 0.5);
      return { sx, sy, tx: clamp(lane + vrng.range(-22, 22), -lim, lim), ty: vrng.range(-16, 16) + (flick ? clamp(flick.dy * 0.1 / k, -20, 8) : 0), value: v, a0: ang, aEnd: ang, spin: vrng.range(7, 13) * (vrng.chance(0.5) ? 1 : -1) };
    });
    sound('throw');
    const d = state.toss.dur;
    for (const f of [0.5, 0.77, 0.93]) later(d * f, { freq: 150 + vrng.range(0, 100), to: 80, dur: 0.07, type: 'square', vol: 0.15 });
    later(d * 0.52, { freq: 1200, to: 500, dur: 0.04, type: 'square', vol: 0.05 });
    laterBuzz(d * 0.5, 14); laterBuzz(d * 0.77, 9); laterBuzz(d * 0.95, 22);   // the three bounces, the last one firmest
  }
  function afterToss() {
    const g = state.g, p = cur(), demo = state.scene === 'demo';
    { const Ly = LY(), nn = state.tossDice.length; for (const d of state.tossDice) { const p = tableAt(Ly, nn, d.tx, d.ty); burst(p.x, p.y + 40, 6, ['rgba(255,235,190,0.8)'], 90, 'dust', 60, true); } }
    state.options = optionsFor(g, state.values);
    const human = !p.ai && !demo;
    if (g.opts.dice === 'two' && human) {
      state.phase = 'pick'; state.hintDie = -1;
      say('Choose one die. Its landing square glows. Tap the die or the square.', 'info'); return;
    }
    const chosen = g.opts.dice === 'two' ? aiPick(g, state.options, rng).die : 0;
    state.pendingDie = chosen; state.phase = 'hold';
    if (demo) {
      const faint = g.opts.dice === 'one' ? [1, 2, 3, 4, 5, 6].map((k) => Math.min(FINISH, p.pos + k)).filter((q) => q > 0 && q !== state.options[0].res.land) : null;
      state.reveal = { chosen, faint };
      state.holdT = 2; state.demo.phase = 'reveal';
      const a = state.options[0], b = state.options[1];
      say(g.opts.dice === 'two' ? `REVEAL. ${describeOption(g, a)} Or ${describeOption(g, b)} The ${a.value} leaves about ${scoreOption(g, a).toFixed(1)} turns to finish, the ${b.value} about ${scoreOption(g, b).toFixed(1)}. Chosen: the ${state.options[chosen].value}.` : `REVEAL. ${describeOption(g, a)}`, 'info');
    } else { state.holdT = g.opts.dice === 'two' ? 0.9 : 0.45; if (g.opts.dice === 'two') state.reveal = { chosen, faint: null }; }
  }
  function segsFor(pi, res, from) {
    const segs = [];
    if (res.over) { segs.push({ type: 'shudder', a: posXY(from, pi), dur: 0.5 }); return segs; }
    for (let n = from + 1; n <= res.land; n++) segs.push({ type: 'hop', a: posXY(n - 1, pi), b: squareXY(n), dur: 0.2, k: n - from });
    if (res.jump) {
      const A = squareXY(res.jump.from), B = squareXY(res.jump.to), len = Math.hypot(B.x - A.x, B.y - A.y);
      if (res.jump.kind === 'ladder') segs.push({ type: 'climb', a: A, b: B, dur: 0.65 + len / 650, jump: res.jump });
      else segs.push({ type: 'slide', pts: snakePath(A, B, res.jump.from + res.jump.to), a: A, b: B, dur: 0.9 + len / 560, jump: res.jump });
    }
    return segs;
  }
  function commit(die) {
    const g = state.g, opt = state.options[die]; if (!opt) return;
    state.chosenDie = die; state.hintDie = -1;
    const from = state.shown[g.turn], p = cur();
    const ev = applyMove(g, opt);
    state.phase = 'move'; state.reveal = null; state.mover = ev.player;
    if (state.scene === 'demo') state.demo.phase = 'act';
    if (opt.res.over) say(`${opt.value} is too many. ${p.name === 'You' ? 'You stay' : p.name + ' stays'} on ${from}.`, 'info');
    else if (!opt.res.jump) say(`${p.name === 'You' ? 'You roll' : p.name + ' rolls'} ${opt.value}: ${opt.res.win ? 'home!' : 'lands on ' + opt.res.to + '.'}`, 'info');
    startAnim(ev.player, segsFor(ev.player, opt.res, from), () => afterMove(ev));
  }
  function afterMove(ev) {
    const g = state.g;
    state.shown[ev.player] = g.players[ev.player].pos;
    if (ev.bumped) {
      const b = ev.bumped, segs = [];
      segs.push({ type: 'shudder', a: posXY(b.from, b.player), dur: 0.35 });
      for (let n = b.from - 1; n >= Math.max(b.to, 1); n--) segs.push({ type: 'hop', a: posXY(n + 1, b.player), b: squareXY(n), dur: 0.14, k: 1, back: true });
      if (b.to === 0) segs.push({ type: 'hop', a: squareXY(1), b: startXY(b.player), dur: 0.14, k: 1, back: true });
      banner('Bumped!', '#ffb199', '#e0533a'); sound('bump'); say(`${g.players[b.player].name} is bumped back to ${b.to || 'the start'}.`, 'bad');
      startAnim(b.player, segs, () => { state.shown[b.player] = b.to; proceed(ev); });
    } else proceed(ev);
  }
  function proceed(ev) {
    if (ev.win) { finish(); return; }
    if (ev.extra) { banner('Six! Again', '#fff1b0', '#e8a73a'); sound('six'); }
    startTurn();
    if (ev.extra && state.scene === 'play') say(`A six: ${cur().name === 'You' ? 'you roll' : cur().name + ' rolls'} again.`, 'good');
  }
  function finish() {
    const g = state.g, human = g.players.some((p) => p.ai) && !g.players[g.winner].ai;
    state.phase = 'idle'; state.thinkRing = false;
    const p = g.players[g.winner], pt = posXY(FINISH, g.winner);
    burst(pt.x, pt.y, 40, ['#ffd75a', '#fff1b0', '#ff9a4a'], 320, 'spark'); confetti(); sound('win'); buzz([30, 60, 30, 60, 90]);
    banner(`${p.name === 'You' ? 'You win' : p.name + ' wins'}!`);
    if (state.scene === 'demo') { state.demo.finished = true; state.ui.scroll = 0; return; }
    state.over = true; state.ui.scroll = 0;
    if (g.players.some((q) => q.ai)) {
      state.stats.played++; if (human) state.stats.wins++;
      storage.set('stats', state.stats);
    }
    monetization.track('game_end', { dice: g.opts.dice, players: g.players.length, human });
  }

  // ---- animation ------------------------------------------------------------------------------------------------------
  function startAnim(pi, segs, done) {
    if (!segs.length) { done(); return; }
    state.anim = { pi, segs, i: 0, t: 0, done }; enterSeg(state.anim);
  }
  function enterSeg(a) {
    const s = a.segs[a.i], p = state.g.players[a.pi];
    if (s.type === 'hop') { if (!s.back) { sound('tok', s.k); buzz(5); } }
    else if (s.type === 'climb') {
      sound('climb'); buzz([12, 40, 12, 40, 24]); banner('Ladder!', '#d7ffb0', '#4dbd5a');
      say(`${s.jump.name} lifts ${p.name === 'You' ? 'you' : p.name} from ${s.jump.from} to ${s.jump.to}!`, 'good');
    } else if (s.type === 'slide') {
      sound('slide'); buzz([40, 30, 60, 30, 80]); banner('Serpent!', '#ffc7b8', '#d0402a');
      say(`${s.jump.name} drags ${p.name === 'You' ? 'you' : p.name} from ${s.jump.from} down to ${s.jump.to}.`, 'bad');
    } else if (s.type === 'shudder') { sound('bump'); buzz(30); }
  }
  function leaveSeg(s) {
    if (s.type === 'hop') { const q = s.b; burst(q.x, q.y + 12, s.back ? 2 : 4, ['rgba(255,236,200,0.7)'], 60, 'dust', 40); }
    else if (s.type === 'climb') { burst(s.b.x, s.b.y, 22, ['#ffe27a', '#fff6c8', '#ffb347'], 200); state.rings.push({ x: s.b.x, y: s.b.y + 8, t: 0, c: 'rgba(255,230,140,0.95)', big: true }); }
    else if (s.type === 'slide') { burst(s.b.x, s.b.y + 8, 16, ['rgba(120,80,40,0.7)', 'rgba(230,200,150,0.7)'], 130, 'dust', 80); state.rings.push({ x: s.b.x, y: s.b.y + 8, t: 0, c: 'rgba(255,180,150,0.9)' }); }
  }
  function tickAnim(dt) {
    const a = state.anim; if (!a) return;
    a.t += dt;
    for (; ;) {
      const s = a.segs[a.i];
      if (a.t < s.dur) break;
      a.t -= s.dur; leaveSeg(s); a.i++;
      if (a.i >= a.segs.length) { state.anim = null; a.done(); return; }
      enterSeg(a);
    }
    // sparkles trail a climbing pawn, dust trails a sliding one
    const s = a.segs[a.i];
    if (s.type === 'climb' || s.type === 'slide') {
      const u = a.t / s.dur, pt = s.type === 'climb' ? { x: s.a.x + (s.b.x - s.a.x) * u, y: s.a.y + (s.b.y - s.a.y) * u } : s.pts[Math.min(s.pts.length - 1, Math.floor(u * (s.pts.length - 1)))];
      if (vrng.chance(0.6)) burst(pt.x, pt.y, 1, s.type === 'climb' ? ['#fff2b0', '#ffd75a'] : ['rgba(230,200,150,0.7)'], 60, s.type === 'climb' ? 'spark' : 'dust', 40);
    }
  }

  // ---- hints -------------------------------------------------------------------------------------------------------------
  function useHint() {
    const g = state.g, p = cur();
    if (state.over || p.ai || state.scene !== 'play') return;
    if (state.phase === 'idle') { say(`Hint: ${lookAheadText(g, p.pos)}`, 'hint'); sound('ok'); }
    else if (state.phase === 'pick') {
      const best = bestOption(g, state.options), other = state.options[1 - best.die];
      state.hintDie = best.die;
      say(`Hint: use the ${best.value}. ${describeOption(g, best)} The ${other.value} is the longer way home.`, 'hint'); sound('ok');
    }
  }

  // ---- input ---------------------------------------------------------------------------------------------------------------
  function openMsg() { state.msgOpen = true; state.ui.scroll = 0; state.ui.drag = null; state.gesture = null; }
  function humanCanRoll() { return state.scene === 'play' && !state.over && !cur().ai && state.phase === 'idle' && !state.anim; }
  function pointPlay(p) {
    const Ly = LY(), hit = (r) => p.pressed && inRect(r, p.x, p.y);
    if (hit(Ly.msg) && state.msg) { openMsg(); return; }
    if (hit(Ly.head.menu) || hit(Ly.bar.menu)) { toMenu(); return; }
    if (hit(Ly.head.sound) || hit(Ly.bar.sound)) { state.sound = !state.sound; audio.setMuted(!state.sound); savePrefs(); return; }
    if (hit(Ly.bar.hint)) { useHint(); return; }
    if (humanCanRoll()) {
      if (hit(Ly.bar.roll)) { roll(); return; }
      if (p.pressed && inRect(Ly.table, p.x, p.y)) state.gesture = { x: p.x, y: p.y };
      if (p.released && state.gesture) {
        const g0 = state.gesture; state.gesture = null;
        const dx = p.x - g0.x, dy = p.y - g0.y, far = Math.hypot(dx, dy) > 45;
        if (far || inRect(Ly.table, p.x, p.y)) roll(far ? { x: g0.x, y: g0.y, dx, dy } : undefined);
      }
    } else if (state.phase === 'pick' && p.pressed) {
      const rs = dieRects(state, Ly);
      let die = rs.findIndex((r) => inRect(r, p.x, p.y));
      if (die < 0) { const cp = toCanon(Ly, p.x, p.y), sq = squareAt(cp.x, cp.y); if (sq > 0) die = state.options.findIndex((o) => !o.res.over && (o.res.land === sq || o.res.to === sq)); }
      if (die >= 0) { sound('pick'); buzz(8); commit(die); }
    }
  }
  function pointDemo(p) {
    const Ly = LY(), hit = (r) => p.pressed && inRect(r, p.x, p.y);
    if (state.demo.finished) { const tap = listPointer(state.ui, p, lay ?? EMPTY_LAY); if (tap === 'watch') startDemo(); else if (tap === 'menu') toMenu(); return; }
    if (hit(Ly.msg) && state.msg) { openMsg(); return; }
    if (hit(Ly.demo.exit) || hit(Ly.head.menu)) { toMenu(); return; }
    if (hit(Ly.demo.pause)) { state.paused = !state.paused; sound('ok'); return; }
    if (hit(Ly.demo.speed)) { state.demo.speed = state.demo.speed >= 4 ? 1 : state.demo.speed * 2; return; }
    if (hit(Ly.demo.tdec) && state.thinkIdx > 0) { state.thinkIdx--; savePrefs(); sound('ok'); }
    if (hit(Ly.demo.tinc) && state.thinkIdx < THINK_STEPS.length - 1) { state.thinkIdx++; savePrefs(); sound('ok'); }
  }
  function zoom(p) {
    if (!p.pressed) return false;
    const Ly = LY();
    if (inRect(Ly.zoom.dec, p.x, p.y)) { if (state.textIdx > 0) { state.textIdx--; state.ui.scroll = 0; savePrefs(); sound('ok'); } return true; }
    if (inRect(Ly.zoom.inc, p.x, p.y)) { if (state.textIdx < TEXT_SCALES.length - 1) { state.textIdx++; state.ui.scroll = 0; savePrefs(); sound('ok'); } return true; }
    return false;
  }
  function tapList(id) {
    const s = state.setup;
    if (id === 'af:home') { env.openArcforgeHome?.(); return; }
    if (state.scene === 'title') {
      if (id === 'play') { go('setup'); sound('ok'); } else if (id === 'watch') startDemo();
      else if (id === 'howto' || id === 'rules' || id === 'about') go(id);
      else if (id === 'settings') go('settings');
    } else if (state.scene === 'setup') {
      if (id === 'start') startGame(); else if (id === 'back') go('title');
      else if (id.startsWith('toggle:')) { const k = id.slice(7); s[k] = !s[k]; sound('ok'); }
      else if (id.includes(':')) { const [k, v] = id.split(':'); s[k] = k === 'players' || k === 'level' ? Number(v) : v; sound('ok'); }
    } else if (state.scene === 'settings') {
      if (id === 'back') { go('title'); savePrefs(); }
      else if (id === 'haptics') { state.haptics = !state.haptics; savePrefs(); sound('ok'); if (state.haptics) { const h = env.haptic ?? globalThis.navigator?.vibrate?.bind(globalThis.navigator); try { h?.(20); } catch { /* none */ } } }
      else if (id === 'sound') { state.sound = !state.sound; audio.setMuted(!state.sound); savePrefs(); sound('ok'); }
      else if (id === 'zdec' && state.textIdx > 0) { state.textIdx--; savePrefs(); sound('ok'); }
      else if (id === 'zinc' && state.textIdx < TEXT_SCALES.length - 1) { state.textIdx++; savePrefs(); sound('ok'); }
      else if (id === 'tdec' && state.thinkIdx > 0) { state.thinkIdx--; savePrefs(); sound('ok'); }
      else if (id === 'tinc' && state.thinkIdx < THINK_STEPS.length - 1) { state.thinkIdx++; savePrefs(); sound('ok'); }
      else if (id === 'restore') { monetization.restore().then(() => { state.restored = true; }).catch(() => {}); sound('ok'); }
    } else if (state.scene === 'demo-limit') { if (id === 'menu') toMenu(); }
    else if (state.scene === 'play' && state.over) { if (id === 'again') startGame(); else if (id === 'menu') toMenu(); }
  }

  // ---- update ------------------------------------------------------------------------------------------------------------------
  function update(dt, input) {
    const p = input.pointer, keys = input.keys, sc = state.scene;
    state.press = p.down && !(state.ui.drag && state.ui.drag.moved) ? { x: p.x, y: p.y } : null;
    // Full-message reader (long captions at big text sizes): everything underneath is frozen until it is closed.
    if (state.msgOpen) {
      const tap = lay ? listPointer(state.ui, p, lay) : null;
      if (tap === 'close' || keys.pressed.has('Escape') || keys.pressed.has('Enter') || keys.pressed.has('Space')) { state.msgOpen = false; state.ui.scroll = 0; state.ui.drag = null; }
      return;
    }
    // Watch & Learn Pause freezes the WHOLE loop: timers, in-flight animation, toss, particles, scheduled sounds.
    // It is checked first, before anything advances, so it resumes exactly where it stopped.
    if (sc === 'demo' && state.paused && !state.demo.finished) { pointDemo(p); if (keys.pressed.has('KeyP') || keys.pressed.has('Space')) state.paused = false; return; }
    state.t += dt;
    const w = dt * speed();
    for (let i = state.sfx.length - 1; i >= 0; i--) if (state.sfx[i].at <= state.t) { const e = state.sfx[i]; state.sfx.splice(i, 1); if (e.h) buzz(e.h); else if (state.sound) audio.tone(e.o); }
    if (state.shake) { state.shake.t += dt; if (state.shake.t > 0.4) state.shake = null; }
    if (state.banner) { state.banner.t += dt; if (state.banner.t > 1.6) state.banner = null; }
    for (const q of state.parts) { q.t += dt; q.x += (q.vx + (q.kind === 'confetti' ? Math.sin(q.t * 5 + q.rot) * 40 : 0)) * dt; q.y += q.vy * dt; q.vy += (q.g ?? 380) * dt; }
    state.parts = state.parts.filter((q) => q.t < q.max);
    for (const r of state.rings) r.t += dt;
    state.rings = state.rings.filter((r) => r.t < 0.5);
    if (state.parts.length > 400) state.parts.splice(0, state.parts.length - 400);

    if (sc === 'play' || sc === 'demo') {
      tickAnim(w);
      const ended = state.over || (sc === 'demo' && state.demo.finished);
      if (!state.anim && !ended) {
        if (state.phase === 'idle') {
          if (sc === 'demo') { state.demo.timer -= w; if (state.demo.timer <= 0) roll(); }
          else if (cur().ai) { state.wait -= dt; if (state.wait <= 0) roll(); }
        } else if (state.phase === 'toss') { state.toss.t += w; if (state.toss.t >= state.toss.dur) afterToss(); }
        else if (state.phase === 'hold') { state.holdT -= w; if (state.holdT <= 0) commit(state.pendingDie); }
      }
      if (sc === 'play' && !state.over) pointPlay(p);
      else if (sc === 'demo') pointDemo(p);
      else if (state.over) { const tap = listPointer(state.ui, p, lay ?? EMPTY_LAY); if (tap) tapList(tap); }
      if (sc === 'play' && !state.over && state.phase === 'pick') {
        if (keys.pressed.has('Digit1') || keys.pressed.has('Numpad1')) { sound('pick'); commit(0); }
        else if (keys.pressed.has('Digit2') || keys.pressed.has('Numpad2')) { sound('pick'); commit(1); }
      }
      if (keys.pressed.size) {
        if (keys.pressed.has('Escape')) toMenu();
        else if (sc === 'play' && state.over && (keys.pressed.has('Enter') || keys.pressed.has('Space'))) startGame();
        else if (sc === 'play' && humanCanRoll() && (keys.pressed.has('Space') || keys.pressed.has('Enter'))) roll();
        else if (sc === 'play' && keys.pressed.has('KeyH')) useHint();
        else if (sc === 'demo' && keys.pressed.has('KeyP')) state.paused = true;
      }
      return;
    }
    // reference pages
    if (sc === 'howto' || sc === 'about' || sc === 'rules') {
      const list = sc === 'howto' ? HOWTO : sc === 'about' ? ABOUT : RULES;
      if (zoom(p)) return;
      if (lay) listPointer(state.ui, p, lay);     // long text at big zoom: drag to read more
      const ms = lay ? Math.max(0, lay.total - 100) : 0, setS = (v) => { state.ui.scroll = Math.max(0, Math.min(ms, v)); };
      if (wheelInput.dy) { setS(state.ui.scroll + wheelInput.dy); wheelInput.dy = 0; }
      for (const [k, d] of [['ArrowDown', 70], ['ArrowUp', -70], ['PageDown', 500], ['PageUp', -500], ['Space', 500]]) if (keys.pressed.has(k)) setS(state.ui.scroll + d);
      if (keys.pressed.has('Home')) setS(0); if (keys.pressed.has('End')) setS(ms);
      if (p.pressed && inRect(LY().refWide, p.x, p.y)) go('title');
      else if (keys.pressed.has('Escape') || keys.pressed.has('Enter')) go('title');
      return;
    }
    // list screens: title, setup, settings, demo-limit
    if ((sc === 'title' || sc === 'setup' || sc === 'settings') && zoom(p)) return;
    if (lay) { const tap = listPointer(state.ui, p, lay); if (tap) tapList(tap); }
    if (keys.pressed.size) {
      if (sc === 'title' && (keys.pressed.has('Enter') || keys.pressed.has('Space'))) go('setup');
      else if (sc === 'setup' && keys.pressed.has('Enter')) startGame();
      else if (keys.pressed.has('Escape') && sc !== 'title') go('title');
    }
  }

  // dev only (?dev=1 / Developer toggle): jump straight to the result screen for the layout checks. Never used in normal play.
  const devWin = () => { if (!config.dev || state.scene !== 'play' || state.over) return; state.g.winner = 0; state.shown[0] = FINISH; finish(); };

  return {
    devWin,
    update,
    render(ctx, view) { lay = render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height, state.g.players.length)); },
    // Centres of the current list screen's buttons ({ id: {x, y} }, screen units): for the scripted tests and the layout checks.
    buttons() {
      const out = {}, G = lay?.G; if (!lay) return out;
      for (const row of lay.rows) for (const bx of (row.box ? [row.box] : row.boxes ?? [])) { const y = G.top + row.y - state.ui.scroll + (bx.h ?? row.h) / 2; if (y > G.top && y < G.bottom) out[bx.b.id] = { x: bx.x + bx.w / 2, y }; }
      return out;
    },
    getUi: () => ({ scroll: state.ui.scroll }),
    isPreviewExempt: () => state.scene !== 'play' || state.over || state.msgOpen,
    getState() {
      const { g, ui, ...rest } = state;
      return { ...rest, g: { turn: g.turn, moves: g.moves, winner: g.winner, pos: g.players.map((q) => q.pos), opts: g.opts, kind: g.board.kind } };
    },
  };
}
