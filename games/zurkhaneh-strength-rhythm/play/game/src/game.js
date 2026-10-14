// Zurkhaneh Strength Rhythm: state and flow. Drawing is in view.js / docview.js; music and the rule constants are in music.js.
//
// Timing model: song time `pl.t` is the sum of the dt values handed to update() (deterministic, pausable). When the browser gives us an
// audio engine (env.rhythm, see web/audio/engine.js) backing sounds are scheduled on the audio clock a little ahead of pl.t. A player's
// gesture is judged at the tick it is recognised. Headless runs have no engine and run the same code.
import { PIECES, JUDGE, TIMING, SCORE, WEIGHT, UNISON, LEARN, SWIPE_MIN, WHIRL_TURN, LOOKAHEAD, buildRun, accuracyToStars, gradeOf, comboMult, barDur, slotDur } from './music.js';
import { layoutFor, inRect, TEXT_SCALES, gl } from './layout.js';
import { pitSpot, burst, stepParticles, CUE_K, ATH_K, CUE_H } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const NO_RHYTHM = { available: false, play() {}, sync() {}, flush() {}, toSong: () => NaN, setMuted() {}, now: () => 0, haptic() {} };
const DEMO_RUNS = 6;
const SWIPE_KEYS = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' };
const GRADE_TEXT = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', off: 'OFF', miss: 'MISS' };
const GRADE_COL = { perfect: '#ffe07a', great: '#8ef0dc', good: '#9fc4ff', off: '#d9b3ff', miss: '#ff7d8f' };
const FOLLOW = [1, -1, 2, -2, 3, -3, 4];
const PITCH = { l: 0.8, r: 1.15, u: 1.4, d: 0.65 };

export function createGame(env) {
  const { rng, storage, config } = env;
  const R = env.rhythm ?? NO_RHYTHM;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, timingIdx: 1, thinkSec: 5, cal: 0, labels: true, calm: false, haptics: true, textIdx: 0 },
    best: {}, demoRuns: 0, pl: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, licenses: '', owned: false, restoreMsg: '', restoreBusy: false, dev: config.dev === true, demo: config.demo === true,
  };
  let lastScene = state.scene, drag = null, prevSpace = false;

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = Math.min(Math.max(state.prefs.textIdx | 0, 0), TEXT_SCALES.length - 1); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const M = env.monetization;
  state.owned = !!M?.owns?.('unlock_game');
  M?.onChange?.(() => { state.owned = !!M.owns('unlock_game'); });
  // Settings > Restore purchase: asks the store, shows busy / restored / not found / failed in the row's hint.
  function restorePurchase() {
    if (state.restoreBusy || !M?.restore) return;
    state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
    Promise.resolve(M.restore()).then(() => {
      state.owned = !!M.owns('unlock_game');
      state.restoreMsg = state.owned ? 'Restored. Thank you!' : 'No earlier purchase found';
    }).catch(() => { state.restoreMsg = 'Store not reachable. Try later.'; }).finally(() => { state.restoreBusy = false; });
  }
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { R.setMuted(!state.prefs.sound); env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const tk = () => TIMING[state.prefs.timingIdx].k;
  const win = () => ({ p: JUDGE.perfect * tk(), g: JUDGE.great * tk(), o: JUDGE.good * tk() });
  const go = (scene) => { if (state.scene === 'play') R.flush(); state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  const cueSpot = (pit, owner) => pitSpot(pit, owner, pit.cam ? 0.5 : CUE_K, pit.cam ? CUE_H : 0);
  const haptic = (ms) => { if (state.prefs.haptics) R.haptic?.(ms); };

  // ---- a play session -------------------------------------------------------------------------------------------------------------------
  function newPlay(pi, mode) {
    return {
      mode, pi, piece: PIECES[pi], t: 0, cues: [], np: 0, ev: [], si: 0, fi: 0, endT: 0.5, bars: [], chunks: [], cur: null,
      speed: mode === 'learn' ? 0.85 : 1, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, off: 0, miss: 0 }, accSum: 0, accN: 0,
      unison: 0, layer: 0, paused: false, over: false, resync: true,
      acts: Array.from({ length: 8 }, () => null), drum: { l: 0, r: 0, bell: 0 }, pulse: 0, pops: [], parts: [], rips: [], shake: 0, banner: null, hintT: 0, flash: 0,
      g: { active: false }, whirling: false, holdCue: null, lastSwirl: 0,
      learn: mode === 'learn' ? { phrase: 0, attempt: 1, final: false, acc: [], tries: [] } : null,
      auto: mode === 'auto' ? { phase: 'think', timer: state.prefs.thinkSec, phrase: 0, n: Math.ceil(PIECES[pi].bars.length / 2), reveal: 0 } : null,
    };
  }
  // Move sounds for moves the circle performs (demonstrations): scheduled with the groove on the audio clock.
  function moveEvents(c) {
    const out = [];
    if (c.kind === 'tap') out.push({ t: c.t, who: 'move', voice: 'tap', vel: 0.8, layer: 0 });
    else if (c.kind === 'hold') { out.push({ t: c.t, who: 'move', voice: 'lift', vel: 0.8, layer: 0 }); out.push({ t: c.end, who: 'move', voice: 'set', vel: 0.8, layer: 0 }); }
    else if (c.kind === 'whirl') { for (let s = c.t; s < c.end - 0.05; s += 0.22) out.push({ t: s, who: 'move', voice: 'spin', vel: 0.55, layer: 0, pitch: 1 + (s - c.t) * 0.15 }); }
    else out.push({ t: c.t, who: 'move', voice: 'swing', vel: 0.85, layer: 0, pitch: PITCH[c.kind] });
    return out;
  }
  function append(pl, segments, extra = {}, speed = pl.speed) {
    const startT = pl.endT;
    const run = buildRun(pl.piece, segments, startT, { speed });
    const id = pl.chunks.length, chunk = { id, t0: startT, t1: run.end, sum: 0, n: 0, done: false, ...extra };
    for (const c of run.cues) { c.ch = id; if (!c.demo) chunk.n += 1; else for (const e of moveEvents(c)) run.events.push(e); pl.cues.push(c); }
    run.events.sort((a, b) => a.t - b.t);
    for (const e of run.events) { e.ch = id; pl.ev.push(e); }
    pl.bars.push(...run.bars);
    pl.chunks.push(chunk); pl.cur = chunk; pl.endT = run.end;
    return chunk;
  }
  const beatOf = (pl) => barDur(pl.piece, pl.speed) / 4;
  const phraseCount = (pl) => Math.ceil(pl.piece.bars.length / 2);
  function learnStep(pl) {
    const L = pl.learn, b0 = L.phrase * 2, b1 = Math.min(b0 + 2, pl.piece.bars.length);
    if (L.final) { pl.layer = 0; return append(pl, [{ kind: 'count' }, { kind: 'play', b0: 0, b1: pl.piece.bars.length }], { kind: 'final' }, 1); }
    return append(pl, [{ kind: 'count' }, { kind: 'watch', b0, b1 }, { kind: 'echo', b0, b1 }], { kind: 'pair', phrase: L.phrase, attempt: L.attempt });
  }
  function startPlay(mode) {
    if (config.demo && mode !== 'auto' && (state.sel > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (config.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush();
    const pl = newPlay(state.sel, mode); state.pl = pl; state.result = null;
    if (mode === 'learn') learnStep(pl);
    else if (mode === 'perform') append(pl, [{ kind: 'count' }, { kind: 'play', b0: 0, b1: pl.piece.bars.length }], { kind: 'whole' });
    else pl.unison = 0.3;
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('piece_start', { piece: pl.piece.id, mode });
  }
  function pausePlay() {
    const pl = state.pl; if (!pl || pl.paused || pl.over) return;
    pl.paused = true; R.flush(); pl.g = { active: false }; pl.whirling = false;
    while (pl.si > 0 && pl.ev[pl.si - 1].t > pl.t) pl.si -= 1;      // what was scheduled but not yet heard will be scheduled again
    for (let i = pl.si; i < pl.ev.length; i++) if (pl.ev[i].t > pl.t) pl.ev[i].on = undefined;
  }
  function resumePlay() { const pl = state.pl; if (!pl) return; pl.paused = false; pl.resync = true; }
  function truncateFuture(pl) {
    let k = pl.ev.length; while (k > 0 && pl.ev[k - 1].t > pl.t) k -= 1;
    pl.ev.length = k; pl.si = Math.min(pl.si, k); pl.fi = Math.min(pl.fi, k);
    pl.cues = pl.cues.filter((c) => c.t <= pl.t); pl.np = Math.min(pl.np, pl.cues.length);
    pl.bars = pl.bars.filter((b) => b.t0 <= pl.t); pl.endT = pl.t;
    R.flush(); pl.resync = true;
  }
  function listenAgain() {
    const pl = state.pl;
    if (!pl || pl.mode !== 'learn' || pl.learn.final || pl.paused || pl.over) return;
    if (pl.cur) pl.cur.cancel = true;
    truncateFuture(pl); pl.endT = pl.t + beatOf(pl) * 1.5;
    learnStep(pl); say('Listen again', 1.4);
  }
  function peekHint() { const pl = state.pl; if (pl && !pl.paused && !pl.over) pl.hintT = 4; }

  // ---- athletes ---------------------------------------------------------------------------------------------------------------------
  function startAct(pl, owner, kind, dur, cw, by) {
    pl.acts[owner] = { kind, age: 0, dur, cw };
    const followers = by === 'auto' ? 7 : Math.floor(pl.unison * 7 + 0.15);
    for (let k = 0; k < followers; k++) {
      const idx = (owner + FOLLOW[k] + 16) % 8;
      pl.acts[idx] = { kind, age: -((1 - pl.unison) * (0.03 + rng.range(0, 0.16))), dur, cw: -cw, follower: true };
    }
  }
  function effects(pl, owner, kind, strong) {
    if (state.prefs.calm) return;
    const pit = lay().play.pit, p = pitSpot(pit, owner, ATH_K);
    if (kind === 'tap') { burst(pl.parts, rng, p.x, p.y, strong ? 14 : 8, '#e8c48a', 0.9); pl.rips.push({ x: p.x, y: p.y, age: 0 }); pl.shake = Math.max(pl.shake, strong ? 0.5 : 0.25); }
    else if (kind === 'hold') burst(pl.parts, rng, p.x, p.y, 6, '#8aa4ff', 0.6);
    else if (kind === 'whirl') burst(pl.parts, rng, p.x, p.y, 5, '#ff7a5c', 0.7);
    else { const c = cueSpot(pit, owner); burst(pl.parts, rng, c.x, c.y, 8, '#35d0c0', 0.8); }
  }
  function pop(pl, owner, text, col, size) {
    const c = cueSpot(lay().play.pit, owner);
    pl.pops.push({ x: c.x, y: c.y - 30, text, col, size, age: 0 });
    if (pl.pops.length > 10) pl.pops.shift();
  }

  // ---- judging ------------------------------------------------------------------------------------------------------------------------
  function finalize(pl, c, g) {
    if (c.done) return;
    c.done = true; c.j = g;
    const mult = comboMult(pl.combo);
    if (g === 'miss') pl.combo = 0; else { pl.combo += 1; pl.maxCombo = Math.max(pl.maxCombo, pl.combo); }
    pl.score += Math.round(SCORE[g] * mult); pl.counts[g] += 1; pl.accSum += WEIGHT[g]; pl.accN += 1;
    const ch = pl.chunks[c.ch]; if (ch) ch.sum += WEIGHT[g];
    pl.unison = Math.max(0, Math.min(1, pl.unison + UNISON[g]));
    pop(pl, c.owner, GRADE_TEXT[g], GRADE_COL[g], g === 'perfect' ? 40 : 34);
    if (g === 'miss') { if (!state.prefs.calm) pl.flash = Math.max(pl.flash, 0.25); R.play('miss', 0.6); }
  }
  const gradeByErr = (err) => { const w = win(); return err <= w.p ? 'perfect' : err <= w.g ? 'great' : 'good'; };
  const gradeByWeight = (v) => (v >= 0.89 ? 'perfect' : v >= 0.64 ? 'great' : v >= 0.4 ? 'good' : v >= 0.15 ? 'off' : 'miss');
  function findCue(pl, now, test) {
    const w = win().o; let best = null;
    for (let i = pl.np; i < pl.cues.length && pl.cues[i].t <= now + w; i++) {
      const c = pl.cues[i]; if (c.done || c.demo || !test(c)) continue;
      const e = Math.abs(c.t - now); if (e <= w && (!best || e < Math.abs(best.t - now))) best = c;
    }
    return best;
  }
  function onPress(pl, now) {
    const c = findCue(pl, now, (q) => (q.kind === 'tap' || q.kind === 'hold') && q.j === null);
    if (!c) return;
    const g = gradeByErr(Math.abs(c.t - now));
    if (c.kind === 'tap') {
      R.play('tap', 0.9); haptic(12);
      startAct(pl, c.owner, 'tap', 0.3, 1, 'player'); effects(pl, c.owner, 'tap', g === 'perfect');
      finalize(pl, c, g);
    } else {
      c.startG = g; c.holding = true; c.j = 'holding'; pl.holdCue = c;
      R.play('lift', 0.9); haptic(8);
      startAct(pl, c.owner, 'hold', Math.max(0.3, c.dur), 1, 'player'); effects(pl, c.owner, 'hold');
    }
  }
  function onRelease(pl, now) {
    const c = pl.holdCue; if (!c || !c.holding) return;
    c.holding = false; pl.holdCue = null;
    const err = Math.abs(c.end - now), w = win().o;
    const eg = err <= w ? gradeByErr(err) : 'miss';
    const g = gradeByWeight((WEIGHT[c.startG] + WEIGHT[eg]) / 2);
    const a = pl.acts[c.owner]; if (a && a.kind === 'hold') a.dur = Math.max(0.2, a.age);
    R.play('set', 0.8); haptic(10);
    finalize(pl, c, g);
  }
  function onSwipe(pl, dir, now) {
    let c = findCue(pl, now, (q) => q.kind === dir);
    let g;
    if (c) g = gradeByErr(Math.abs(c.t - now));
    else { c = findCue(pl, now, (q) => q.kind === 'l' || q.kind === 'r' || q.kind === 'u' || q.kind === 'd'); if (!c) return; g = 'off'; }
    R.play('swing', 0.9, null, PITCH[dir]); haptic(14);
    startAct(pl, c.owner, dir, 0.38, 1, 'player'); effects(pl, c.owner, dir);
    finalize(pl, c, g);
  }
  // Called every play tick: turns pointer / keyboard state into presses, releases, swipes and whirling.
  function runGesture(pl, dt, input) {
    const p = input.pointer, k = input.keys, L = lay().play;
    const space = k.down.has('Space'), spacePressed = k.pressed.has('Space'), spaceReleased = prevSpace && !space; prevSpace = space;
    const tAdj = pl.t - state.prefs.cal / 1000;
    let pressed = false;
    if (p.pressed && !inRect(L.pause, p.x, p.y) && !inRect(L.hint, p.x, p.y)) { pl.g = { active: true, x0: p.x, y0: p.y, lx: p.x, ly: p.y, dx: 0, dy: 0, rate: 0, inst: 0, since: 9, key: false }; pressed = true; }
    if (spacePressed) { pl.g = { active: true, x0: 0, y0: 0, lx: 0, ly: 0, dx: 0, dy: 0, rate: 0, inst: 0, since: 9, key: true }; pressed = true; }
    if (pressed) onPress(pl, tAdj);
    for (const code of Object.keys(SWIPE_KEYS)) if (k.pressed.has(code)) onSwipe(pl, SWIPE_KEYS[code], tAdj);
    const g = pl.g;
    if (g.active && !g.key && p.down) {
      const dx = p.x - g.x0, dy = p.y - g.y0;
      if (Math.hypot(dx, dy) >= SWIPE_MIN) {
        onSwipe(pl, Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'l' : 'r') : (dy < 0 ? 'u' : 'd'), tAdj);
        g.x0 = p.x; g.y0 = p.y;
      }
      // turning rate (radians per second, smoothed) for whirls
      const vx = p.x - g.lx, vy = p.y - g.ly;
      if (Math.hypot(vx, vy) >= 6) {
        if (g.dx || g.dy) g.inst = Math.atan2(g.dx * vy - g.dy * vx, g.dx * vx + g.dy * vy) / Math.max(dt, 1 / 120);
        g.dx = vx; g.dy = vy; g.lx = p.x; g.ly = p.y; g.since = 0;
      } else g.since += dt;
      g.rate = g.rate * 0.82 + (g.since > 0.12 ? 0 : g.inst) * 0.18;
    } else if (g.active && !g.key) g.rate = 0;
    pl.whirling = (g.active && Math.abs(g.rate) > WHIRL_TURN) || k.down.has('KeyR');
    if (p.released || spaceReleased) { onRelease(pl, tAdj); pl.g = { active: false }; }
    else if (pl.holdCue && pl.holdCue.holding && !p.down && !space) onRelease(pl, tAdj);
  }

  // ---- per-tick play update -----------------------------------------------------------------------------------------------------------
  function stepAnim(pl, dt) {
    for (const a of pl.acts) if (a) a.age += dt;
    for (let i = 0; i < 8; i++) { const a = pl.acts[i]; if (a && a.age > (a.dur || 0.4) + 0.5) pl.acts[i] = null; }
    pl.drum.l = Math.max(0, pl.drum.l - dt * 7); pl.drum.r = Math.max(0, pl.drum.r - dt * 7); pl.drum.bell = Math.max(0, pl.drum.bell - dt * 1.6);
    for (const q of pl.pops) q.age += dt;
    pl.pops = pl.pops.filter((q) => q.age < 0.85);
    for (const r of pl.rips) r.age += dt;
    pl.rips = pl.rips.filter((r) => r.age < 0.6);
    stepParticles(pl.parts, dt);
    pl.pulse = Math.max(0, pl.pulse - dt * 3.2); pl.shake = Math.max(0, pl.shake - dt * 4); pl.flash = Math.max(0, pl.flash - dt * 2);
    pl.hintT = Math.max(0, pl.hintT - dt);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 1.6) pl.banner = null; }
    // drum layers follow unison with a little hysteresis
    const th = UNISON.layers; let L = pl.layer;
    while (L < 3 && pl.unison >= th[L]) L += 1;
    while (L > 0 && pl.unison < th[L - 1] - 0.04) L -= 1;
    if (L > pl.layer && pl.mode !== 'auto') pl.banner = { text: L === 3 ? 'THE FULL CIRCLE' : 'THE CIRCLE GROWS', t: 0 };
    pl.layer = L;
  }
  const evOn = (pl, e) => {
    if (e.on !== undefined) return e.on;
    if (e.who === 'ens') return pl.mode === 'auto' ? e.layer <= Math.max(1, pl.layer) : e.layer <= pl.layer;
    return true;
  };
  const actDur = (c) => (c.kind === 'hold' || c.kind === 'whirl' ? Math.max(0.3, c.dur) : c.kind === 'tap' ? 0.3 : 0.38);
  function performDemo(pl, c) {
    c.done = true; c.j = 'perfect';
    startAct(pl, c.owner, c.kind, actDur(c), c.cw, 'auto');
    effects(pl, c.owner, c.kind, true);
  }
  // The Think / Reveal card: below the pit on tall screens, in the left column on wide ones, over the pit's lower part otherwise.
  const thinkCard = (L) => {
    const P = L.play, I = P.info;
    if (!L.wide) { const w = Math.min(L.W, 620), y = P.strip.y, h = Math.max(190, Math.min(250, L.bot - y)); return { x: L.w / 2 - w / 2, y: Math.min(y, L.bot - h), w, h }; }
    const colW = P.pit.cx - P.pit.R - 16 - L.left;
    if (colW >= 330) return { x: L.left, y: I.y + 50, w: colW, h: 250 };
    if (colW >= 170) return { x: L.left, y: I.y + 50, w: colW, h: 330 };
    const w = Math.min(L.W - 20, 520), h = 220;
    return { x: L.w / 2 - w / 2, y: P.pit.cy + P.pit.R * 0.2, w, h };
  };
  function updatePlay(dt, input) {
    const pl = state.pl, L = lay().play;
    const tap = input.pointer.pressed ? { x: input.pointer.x, y: input.pointer.y } : null;
    if (pl.frozen) return;                       // dev screenshots only
    // Rotated / resized mid-piece: floating labels and sparks hold old screen positions, so drop them rather than draw them in the wrong place.
    const sig = `${Math.round(L.pit.cx)}|${Math.round(L.pit.cy)}|${Math.round(L.pit.R)}`;
    if (pl.sig !== undefined && pl.sig !== sig) { pl.pops.length = 0; pl.parts.length = 0; pl.rips.length = 0; }
    pl.sig = sig;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    if (input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) { pausePlay(); return; }
    if (input.keys.pressed.has('KeyH')) { if (pl.mode === 'learn') listenAgain(); else peekHint(); }
    if (tap) {
      if (inRect(L.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (inRect(L.hint, tap.x, tap.y)) { if (pl.mode === 'learn' && !pl.learn.final) listenAgain(); else peekHint(); }
    }
    // Watch and Learn: THINK and REVEAL do not advance song time (the music waits); ACT plays one phrase.
    if (pl.mode === 'auto') {
      const A = pl.auto;
      if (A.phase === 'think') {
        if (tap && inRect(thinkCard(lay()), tap.x, tap.y)) A.timer = 0;
        A.timer -= dt; stepAnim(pl, dt);
        if (A.timer <= 0) { A.phase = 'reveal'; A.reveal = 0; }
        return;
      }
      if (A.phase === 'reveal') {
        A.reveal += dt; stepAnim(pl, dt);
        if (A.reveal >= 2) {
          const b0 = A.phrase * 2, b1 = Math.min(b0 + 2, pl.piece.bars.length);
          R.flush(); pl.resync = true; pl.endT = pl.t + 0.35;
          append(pl, [{ kind: 'auto', b0, b1 }], { kind: 'auto', phrase: A.phrase });
          A.phase = 'act';
        }
        return;
      }
    } else runGesture(pl, dt, input);
    pl.t += dt;
    if (R.available) { R.sync(pl.t, pl.resync); pl.resync = false; }
    const horizon = pl.t + LOOKAHEAD;
    while (pl.si < pl.ev.length && pl.ev[pl.si].t <= horizon) {
      const e = pl.ev[pl.si++];
      if (e.on === undefined) e.on = evOn(pl, e);
      if (e.on && state.prefs.sound) R.play(e.voice, e.vel, e.t, e.pitch ?? 1);
    }
    while (pl.fi < pl.ev.length && pl.ev[pl.fi].t <= pl.t) {
      const e = pl.ev[pl.fi++];
      if (e.on === undefined) e.on = evOn(pl, e);
      if (e.who === 'click') { if (e.on) pl.pulse = e.voice === 'accent' ? 1 : 0.6; continue; }
      if (!e.on || e.who === 'move') continue;
      if (e.voice === 'bom') pl.drum.l = 1; else if (e.voice === 'tak' || e.voice === 'tek') pl.drum.r = 1; else if (e.voice === 'bell') pl.drum.bell = 1;
      if (e.voice === 'bom' || e.voice === 'stomp') pl.pulse = Math.max(pl.pulse, 0.7);
    }
    // moves the circle performs by itself (Watch and Learn, and the drummer's call in Learn)
    for (let i = pl.np; i < pl.cues.length && pl.cues[i].t <= pl.t; i++) { const c = pl.cues[i]; if (c.demo && !c.done) performDemo(pl, c); }
    // whirls: coverage while the finger keeps turning
    for (let i = pl.np; i < pl.cues.length && pl.cues[i].t <= pl.t + 0.05; i++) {
      const c = pl.cues[i]; if (c.done || c.demo || c.kind !== 'whirl') continue;
      if (pl.t >= c.t && pl.t <= c.end && pl.whirling) {
        c.cov += dt;
        const a = pl.acts[c.owner];
        if (!a || a.kind !== 'whirl') { startAct(pl, c.owner, 'whirl', Math.max(0.3, c.end - pl.t), c.cw, 'player'); effects(pl, c.owner, 'whirl'); }
        if (pl.t - pl.lastSwirl > 0.22) { pl.lastSwirl = pl.t; R.play('spin', 0.5, null, 1 + (pl.t - c.t) * 0.12); haptic(4); }
      }
      if (pl.t >= c.end + 0.05) {
        const frac = c.cov / Math.max(0.2, c.dur);
        finalize(pl, c, frac >= 0.85 ? 'perfect' : frac >= 0.65 ? 'great' : frac >= 0.45 ? 'good' : frac >= 0.2 ? 'off' : 'miss');
      }
    }
    // moves nobody performed
    const w = win().o + Math.max(0, state.prefs.cal / 1000);
    for (let i = pl.np; i < pl.cues.length && pl.cues[i].t <= pl.t; i++) {
      const c = pl.cues[i]; if (c.done || c.demo || c.kind === 'whirl') continue;
      if (c.kind === 'hold' && c.holding) {
        if (pl.t > c.end + w) { c.holding = false; pl.holdCue = null; finalize(pl, c, gradeByWeight(WEIGHT[c.startG] / 2)); }
      } else if (c.j === null && pl.t > c.t + w) finalize(pl, c, 'miss');
    }
    while (pl.np < pl.cues.length && pl.cues[pl.np].done) pl.np += 1;
    if (pl.mode === 'auto') pl.unison = Math.min(1, 0.3 + 0.7 * ((pl.auto.phrase + 1) / pl.auto.n));    // the circle grows as the piece goes on
    stepAnim(pl, dt);
    chunkLogic(pl);
  }
  // what happens when a call-and-response pair, a whole piece or the final take is over
  function chunkLogic(pl) {
    const c = pl.cur;
    if (!c || c.done || c.cancel || pl.t < c.t1 + 0.25) return;
    if (pl.t < c.t1 + 1.5 && pl.cues.some((q) => !q.done && q.ch === c.id)) return;
    c.done = true;
    const acc = c.n ? c.sum / c.n : 1;
    if (pl.mode === 'auto') {
      const A = pl.auto; A.phrase += 1;
      if (A.phrase >= A.n) { pl.over = true; R.flush(); return; }
      A.phase = 'think'; A.timer = state.prefs.thinkSec; R.flush(); pl.resync = true;
      return;
    }
    if (pl.mode === 'perform' || c.kind === 'final') { finishRun(); return; }
    const L2 = pl.learn;
    L2.tries[c.phrase] = c.attempt;
    if (acc < LEARN.pass && L2.attempt < LEARN.tries) { L2.attempt += 1; pl.banner = { text: 'ONCE MORE', t: 0 }; }
    else { L2.acc[c.phrase] = acc; L2.phrase += 1; L2.attempt = 1; if (L2.phrase >= phraseCount(pl)) L2.final = true; pl.banner = { text: acc >= 0.75 ? 'NICE' : 'ON TO THE NEXT', t: 0 }; }
    pl.endT = Math.max(pl.endT, pl.t) + beatOf(pl);
    learnStep(pl);
  }
  function finishRun() {
    const pl = state.pl;
    const fc = pl.chunks.find((c) => c.kind === 'final' || c.kind === 'whole');
    const acc = fc && fc.n ? fc.sum / fc.n : 0;
    const stars = accuracyToStars(acc);
    const id = pl.piece.id, old = state.best[id] ?? {};
    const res = { piece: pl.pi, mode: pl.mode, score: pl.score, acc, stars, grade: gradeOf(acc), maxCombo: pl.maxCombo, counts: { ...pl.counts }, learn: pl.learn ? { acc: [...pl.learn.acc], tries: [...pl.learn.tries] } : null, newBest: false };
    if (pl.mode === 'perform') {
      res.newBest = !old.score || pl.score > old.score;
      state.best[id] = { ...old, score: Math.max(old.score || 0, pl.score), acc: Math.max(old.acc || 0, acc), stars: Math.max(old.stars || 0, stars), combo: Math.max(old.combo || 0, pl.maxCombo) };
    } else state.best[id] = { ...old, learn: Math.max(old.learn || 0, stars) };
    storage.set('best', state.best);
    env.monetization.track?.('piece_end', { piece: id, mode: pl.mode, stars });
    R.flush(); pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  function pauseItems(pl) {
    return pl.mode === 'learn' && !pl.learn.final ? ['resume', 'listen', 'restart', 'quit'] : pl.mode === 'auto' ? ['resume', 'next', 'quit'] : ['resume', 'restart', 'quit'];
  }
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems(pl), M = lay().menu(items.length);
    if (input.keys.pressed.has('Escape') && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart') startPlay(pl.mode);
      else if (it === 'listen') { resumePlay(); listenAgain(); }
      else if (it === 'next') { state.sel = state.demo ? 0 : (state.sel + 1) % PIECES.length; startPlay('auto'); }
      else go('piece');
    });
  }

  // ---- menus and documents ------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'timing') p.timingIdx = cyc(p.timingIdx, TIMING.length);
    else if (id === 'labels') p.labels = !p.labels;
    else if (id === 'haptics') p.haptics = !p.haptics;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'thinkDec') p.thinkSec = Math.max(2, p.thinkSec - 1);
    else if (id === 'thinkInc') p.thinkSec = Math.min(10, p.thinkSec + 1);
    else if (id === 'calDec') p.cal = Math.max(-100, p.cal - 10);
    else if (id === 'calInc') p.cal = Math.min(400, p.cal + 10);
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') { restorePurchase(); return; }
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
    if (id === 'prev') { if (state.rulesPage > 0) { state.rulesPage -= 1; state.docScroll = 0; } return; }
    if (id === 'next') { if (state.rulesPage < RULES.length - 1) { state.rulesPage += 1; state.docScroll = 0; } else go(state.backTo); return; }
    if (id.startsWith('set:')) settingsAction(id.slice(4));
  }

  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.play)) go('songs');
    else if (hit(T.auto)) { state.sel = state.demo ? 0 : 1; startPlay('auto'); }
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 90 && Math.abs(tap.x - T.credit.x) < 190) env.openArcforgeHome?.();
  }
  function updateSongs(tap) {
    if (!tap) return;
    const G = lay().songs;
    if (inRect(G.back, tap.x, tap.y)) { go('title'); return; }
    G.cards.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { state.sel = i; go('piece'); } });
  }
  function updatePiece(tap) {
    if (!tap) return;
    const D = lay().piece;
    if (inRect(D.back, tap.x, tap.y)) go('songs');
    else if (inRect(D.learn, tap.x, tap.y)) startPlay('learn');
    else if (inRect(D.perform, tap.x, tap.y)) startPlay('perform');
    else if (inRect(D.watch, tap.x, tap.y)) startPlay('auto');
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay(state.result.mode);
    else if (inRect(Rr.songs, tap.x, tap.y)) go('songs');
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // What the 3D presenter needs, read-only: the pit's place on screen and what the circle is doing. Menus show the circle at work.
  const MENU_KINDS = ['tap', 'l', 'hold', 'r', 'whirl', 'u', 'tap', 'd'];
  function v3Of(L) {
    const sc = state.scene, pl = state.pl;
    let pit = null;
    if (sc === 'title') pit = L.title.pit; else if (sc === 'piece') pit = L.piece.pit; else if (sc === 'play' && pl) pit = L.play.pit;
    if (!pit) return { on: false };
    const t = state.t, v = { on: true, scene: sc, pit: { cx: pit.cx, cy: pit.cy, R: pit.R }, w: L.w, h: L.h, t };
    if (sc === 'play' && pl) {
      Object.assign(v, { acts: pl.acts, drum: pl.drum, pulse: pl.pulse, shake: state.prefs.calm ? 0 : pl.shake, frozen: pl.paused || pl.over, unison: pl.unison, calm: state.prefs.calm, playing: true });
    } else {
      const acts = [];
      for (let i = 0; i < 8; i++) acts.push({ kind: MENU_KINDS[(Math.floor(t / 1.1) + i) % 8], age: t % 1.1, dur: 0.9, cw: i % 2 ? 1 : -1 });
      Object.assign(v, { acts, drum: { l: Math.max(0, Math.sin(t * 6.8)), r: Math.max(0, Math.sin(t * 6.8 + Math.PI)), bell: 0 }, pulse: (Math.sin(t * 3.4) * 0.5 + 0.5) * 0.35, shake: 0, frozen: false, unison: 0.5, calm: state.prefs.calm, playing: false });
    }
    return v;
  }

  // ---- the object the kit and main.js see -----------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'songs') updateSongs(tap);
      else if (sc === 'piece') updatePiece(tap);
      else if (sc === 'play') updatePlay(dt, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height);
      render(ctx, state, L, view, meta, pauseItems, thinkCard);
      state.v3 = v3Of(L);
    },
    // main.js: true while the WebGL pit is showing (the painted pit below is the fallback for no WebGL / lost context / old WebViews).
    setLicenses(text) { state.licenses = text; },
    setGl(on) { state.gl = !!on; gl.on = !!on; },
    getState: () => state,
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except real play is free: menus, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !(state.scene === 'play' && pl && pl.mode !== 'auto' && !pl.paused && !pl.over);
    },
    // Tester tools (?dev=1): jump to a screen and fast-forward.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.piece !== undefined) state.sel = o.piece;
        const sc = o.scene ?? 'title';
        if (sc === 'play') startPlay(o.mode ?? 'perform');
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('perform'); const pl = state.pl; pl.score = 123450; pl.maxCombo = 41; pl.counts = { perfect: 88, great: 31, good: 9, off: 4, miss: 3 }; pl.chunks[0].sum = 118; pl.chunks[0].n = 135; finishRun();
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) {
            const pl = state.pl;
            if (pl && state.scene === 'play' && o.play && !pl.paused && pl.mode !== 'auto') {   // dev play-through: perform every move on time
              for (let j = pl.np; j < pl.cues.length && pl.cues[j].t <= pl.t + 0.02; j++) {
                const c = pl.cues[j]; if (c.done || c.demo) continue;
                startAct(pl, c.owner, c.kind, actDur(c), c.cw, 'player'); finalize(pl, c, 'perfect');
              }
            }
            api.update(1 / 60, idle);
          }
        }
        if (o.hint && state.pl) state.pl.hintT = 30;
        if (o.freeze && state.pl) state.pl.frozen = true;
      },
    },
  };
  return api;
}
