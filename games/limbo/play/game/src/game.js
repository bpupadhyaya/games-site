// Limbo: state and flow. Drawing is in view.js / playview.js / docview.js; the simulation is engine.js.
//
// Time model: everything runs on the dt handed to update() (deterministic, pausable). An attempt advances by dt x timeScale, where the
// scale is 1, or the Think slow motion. In Watch and Learn the clock is frozen while the computer thinks and reveals.
import { TUNE, BEAT, PAN, barHeight, newAttempt, stepAttempt, aiPlan, aiControl, roundPoints, extraRounds } from './engine.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { burst, stepParticles, LOOKS } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const DEMO_ATTEMPTS = 4;
const AI_REVEAL = 2;
const AFTER = { clear: 1.7, touch: 2.0, fall: 1.8 };
const ROOT = 329.63;

export function createGame(env) {
  const { rng, storage, config } = env;
  const heroRng = rng.fork();
  const state = {
    scene: 'title', sceneT: 0, t: 0, backTo: 'title',
    prefs: { sound: true, calm: false, assist: false, thinkSec: 5, textIdx: 0 },
    best: { score: 0, round: -1, games: 0 }, demoRuns: 0,
    setup: { players: 2, startRound: 0, practiceRound: 3 }, setupKind: 'practice',
    pl: null, result: null,
    hero: { att: null, round: 0, bar: TUNE.bars[0], look: 0, fall: 0, wait: 0, plan: null, memo: {}, n: 0 },
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
    owned: false, restoreBusy: false, restoreMsg: '',
  };
  const mon = env.monetization;
  state.owned = !!mon?.owns?.('unlock_game');
  mon?.onChange?.(() => { state.owned = !!mon.owns('unlock_game'); });
  let lastScene = state.scene, drag = null;
  const later = [];                                            // tiny delayed callbacks counted in dt (a second note a moment after the first)

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = Math.min(Math.max(state.prefs.textIdx | 0, 0), TEXT_SCALES.length - 1); state.prefs.thinkSec = Math.min(10, Math.max(1, state.prefs.thinkSec | 0)); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) Object.assign(state.best, v); });
  storage.get('setup', null).then((v) => { if (v) { const s = state.setup; s.players = Math.min(4, Math.max(2, v.players | 0 || 2)); s.startRound = Math.min(6, Math.max(0, v.startRound | 0)); s.practiceRound = Math.min(TUNE.bars.length - 1, Math.max(0, v.practiceRound | 0)); } });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result' && !(state.pl && state.pl.paused && scene === 'rules')) state.pl = null; };
  const tone = (o) => { if (state.prefs.sound) env.audio.tone(o); };
  const pctOf = (v) => `${Math.round(v * 100)}%`;

  // ---- the title scene's own show ---------------------------------------------------------------------------------------------------------
  function heroNext() {
    const H = state.hero;
    H.round = H.n % 9; H.n += 1;
    if (H.round === 0) H.look = (H.look + 1) % LOOKS.length;
    H.att = newAttempt(heroRng, H.round, {});
    H.plan = aiPlan(H.round); H.memo = {}; H.fall = 0; H.wait = 0.9;
  }
  heroNext();
  function heroStep(dt) {
    const H = state.hero, a = H.att;
    const goal = barHeight(H.round);
    H.bar += Math.max(-0.5 * dt, Math.min(0.5 * dt, goal - H.bar));
    if (a.phase === 'ready') { H.wait -= dt; stepAttempt(a, dt, { go: H.wait <= 0, lean: 0, steer: 0 }); }
    else if (a.phase === 'run') stepAttempt(a, dt, aiControl(a, H.plan, H.memo));
    else {
      stepAttempt(a, dt, { go: false, lean: 0, steer: 0 });
      if (a.phase === 'touch') H.fall = Math.min(1, H.fall + dt / 0.9);
      if (a.sinceHit > 1.6) { if (a.phase === 'clear') heroNext(); else { H.att = newAttempt(heroRng, H.round, {}); H.plan = aiPlan(H.round); H.memo = {}; H.fall = 0; H.wait = 0.8; } }
    }
    a.ev.length = 0;
  }

  // ---- a play session -------------------------------------------------------------------------------------------------------------------
  function newPlay(mode, o = {}) {
    const startRound = mode === 'practice' ? state.setup.practiceRound : mode === 'party' ? state.setup.startRound : (o.round ?? 0);
    const pl = {
      mode, round: startRound, barShown: barHeight(Math.max(0, startRound - 1)), stage: 'intro', stageT: 0, afterT: 0,
      att: null, look: 0, score: 0, tries: TUNE.tries, clears: 0, misses: 0, attempts: 0, bestRound: -1, narrow: 0, bestBalance: 0,
      players: [], cur: 0, order: [], orderPos: 0, winners: null,
      origin: null, kb: 0, autoDrive: false, touchGo: false, hold: false, drive: null,
      paused: false, over: false, parts: [], pops: [], banner: null, shake: 0, barFall: 0, barGlow: 0,
      hint: null, thinkT: 0, thinkCool: 0, beatT: 0, beatN: 0,
      ai: null, last: null, shownFrom: 0, barTo: 0,
    };
    if (mode === 'party') {
      for (let i = 0; i < state.setup.players; i++) pl.players.push({ look: i, name: LOOKS[i].name, out: false, bestRound: -1, clears: 0 });
      pl.order = pl.players.map((_, i) => i); pl.cur = 0; pl.look = pl.players[0].look;
    }
    if (mode === 'auto') { pl.round = 0; pl.barShown = barHeight(0); pl.look = 1; }
    return pl;
  }
  function startPlay(mode, o = {}) {
    if (config.demo && mode !== 'auto' && state.demoRuns >= DEMO_ATTEMPTS) { go('demo-limit'); return; }
    state.pl = newPlay(mode, o); state.result = null;
    state.scene = 'play'; state.sceneT = 0;
    beginAttempt(state.pl, true);
    env.monetization.track?.('game_start', { mode });
  }
  function aiSay(pl) {
    const ai = pl.ai, plan = ai.plan;
    if (!plan) return '';
    if (ai.phase === 'think') return `The bar is at ${pctOf(plan.bar)}. A lean of ${pctOf(plan.need)} just fits under it, so I aim for ${pctOf(plan.target)}.`;
    if (ai.phase === 'reveal') return 'The gold zone is deep enough. I lean late, hold until my head is past, and steer the bubble home.';
    if (ai.phase === 'act') return 'Leaning now. Deeper means faster drift, so I keep nudging the bubble to the middle.';
    return ai.note || '';
  }
  // Prepare a fresh attempt for the current player and bar.
  function beginAttempt(pl, first = false) {
    const bar = barHeight(pl.round);
    pl.att = newAttempt(rng, pl.round, { calm: state.prefs.assist });
    pl.stage = 'intro'; pl.stageT = 0; pl.barFall = 0; pl.barGlow = 1; pl.hint = null; pl.thinkT = 0; pl.origin = null; pl.kb = 0;
    pl.shownFrom = pl.barShown; pl.barTo = bar;
    const sub = pl.mode === 'party' ? `${pl.players[pl.cur].name}'s turn` : pl.mode === 'practice' ? 'Practice' : pl.mode === 'auto' ? 'Watch and Learn' : (pl.tries < TUNE.tries ? `${pl.tries} ${pl.tries === 1 ? 'try' : 'tries'} left` : 'Go as low as you can');
    pl.banner = { text: `BAR ${pctOf(bar)}`, sub, t: 0, hold: first ? 1.5 : 1.2 };
    if (pl.mode === 'party') pl.look = pl.players[pl.cur].look;
    if (pl.mode === 'auto') { pl.ai = { phase: 'think', t: 0, plan: aiPlan(pl.round), memo: {}, say: '', note: '', retry: pl.ai ? pl.ai.retry : 0 }; pl.ai.say = aiSay(pl); }
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.paused && !pl.over && state.scene === 'play') pl.paused = true; };
  const resumePlay = () => { if (state.pl) state.pl.paused = false; };

  // ---- sound ------------------------------------------------------------------------------------------------------------------------------
  function beatSound(pl) {
    const n = pl.beatN, step = n % 8, oct = Math.floor(n / 8) % 2 ? 2 : 1;
    const f = ROOT * Math.pow(2, PAN[step] / 12) * oct * (step === 0 ? 0.5 : 1);
    tone({ freq: f, dur: 0.34, type: 'sine', vol: 0.11 });
    tone({ freq: f * 2.01, dur: 0.13, type: 'sine', vol: 0.045 });
    if (step % 4 === 0) tone({ freq: 82.4, to: 70, dur: 0.28, type: 'sine', vol: 0.12 });
    if (step % 2 === 1) tone({ freq: 3200, to: 2600, dur: 0.035, type: 'triangle', vol: 0.025 });
  }
  const popAdd = (pl, text, col, size, x, y) => { pl.pops.push({ text, col, size, x, y, age: 0, life: 1.0 }); if (pl.pops.length > 6) pl.pops.shift(); };
  function missSub(pl) {
    if (pl.mode === 'solo') return pl.tries - 1 > 0 ? `${pl.tries - 1} ${pl.tries - 1 === 1 ? 'try' : 'tries'} left` : 'No tries left';
    if (pl.mode === 'party') return `${pl.players[pl.cur].name} is out`;
    return 'Try again';
  }

  // ---- reactions to what happened in the attempt -------------------------------------------------------------------------------------------
  function reactions(pl) {
    const a = pl.att, P = lay().play;
    for (const e of a.ev) {
      if (e.k === 'go') {
        tone({ freq: 440, to: 660, dur: 0.14, type: 'triangle', vol: 0.12 });
        pl.attempts += 1;
        if (config.demo && pl.mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
      } else if (e.k === 'clear') {
        const pts = roundPoints(pl.round, e);
        pl.last = { kind: 'clear', pts };
        if (pl.mode === 'solo' || pl.mode === 'auto') pl.score += pts.total;
        pl.clears += 1; pl.bestRound = Math.max(pl.bestRound, pl.round);
        if (e.clearance < 0.03) pl.narrow += 1;
        pl.bestBalance = Math.max(pl.bestBalance, e.balance);
        const cx = P.bx, cy = P.gy - P.U * 0.6;
        burst(pl.parts, rng, cx, cy, 'confetti', state.prefs.calm ? 8 : 26, 1.1, ['#ffd873', '#ff6a4d', '#18b7a6', '#ff8fc2', '#fff2c2'], 11);
        const words = e.clearance < 0.02 ? 'SO CLOSE!' : e.balance > 0.7 ? 'SMOOTH!' : 'CLEARED!';
        popAdd(pl, words, '#fff2c2', 46, cx, cy - P.U * 0.4);
        if (pl.mode === 'solo' || pl.mode === 'auto') popAdd(pl, `+${pts.total}`, '#ffd873', 36, cx, cy - P.U * 0.4 + 56);
        pl.banner = { text: words, sub: pl.mode === 'party' ? `${pl.players[pl.cur].name} is through` : `Bar ${pctOf(pl.barShown)} cleared`, t: 0, hold: 1.5 };
        [523, 659, 784, 1046].forEach((f, i) => later.push({ t: i * 0.09, fn: () => tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.14 }) }));
        env.monetization.track?.('bar_cleared', { mode: pl.mode, bar: Math.round(pl.barShown * 100) });
      } else if (e.k === 'touch') {
        pl.last = { kind: 'touch' }; pl.misses += 1;
        const cx = P.bx, cy = P.gy - a.hitY * P.U;
        burst(pl.parts, rng, cx, cy, 'puff', 5, 0.5, '#e8d5b0', 12);
        popAdd(pl, 'TOUCHED!', '#ff8a7a', 46, cx, cy - 70);
        pl.banner = { text: 'THE BAR FELL', sub: missSub(pl), t: 0, hold: 1.7 };
        tone({ freq: 220, to: 80, dur: 0.3, type: 'square', vol: 0.12 });
        [0.08, 0.17, 0.27].forEach((d, i) => later.push({ t: d, fn: () => tone({ freq: 700 - i * 160, to: 300, dur: 0.07, type: 'square', vol: 0.08 }) }));
        if (!state.prefs.calm) pl.shake = 0.6;
      } else if (e.k === 'fall') {
        pl.last = { kind: 'fall' }; pl.misses += 1;
        popAdd(pl, 'TOPPLED!', '#ff8a7a', 46, P.bx - P.U * 0.4, P.gy - P.U * 0.9);
        pl.banner = { text: 'TOO WOBBLY', sub: missSub(pl), t: 0, hold: 1.7 };
        tone({ freq: 480, to: 70, dur: 0.6, type: 'sawtooth', vol: 0.1 });
        burst(pl.parts, rng, P.bx + a.x * P.U, P.gy, 'puff', 6, 0.6, '#e8c88a', 14);
        if (!state.prefs.calm) pl.shake = 0.5;
      } else if (e.k === 'hip') {
        tone({ freq: 300, to: 480, dur: 0.12, type: 'sine', vol: 0.05 });
      }
    }
    a.ev.length = 0;
  }

  // ---- deciding what comes next after an attempt --------------------------------------------------------------------------------------------
  function nextAfter(pl) {
    const cleared = pl.last && pl.last.kind === 'clear';
    if (pl.mode === 'solo') {
      if (cleared) pl.round += 1; else { pl.tries -= 1; if (pl.tries <= 0) { finishRun(); return; } }
    } else if (pl.mode === 'practice') {
      if (cleared) pl.round = Math.min(pl.round + 1, TUNE.bars.length + 2);
    } else if (pl.mode === 'auto') {
      if (cleared) { pl.round += 1; pl.ai.retry = 0; if (pl.round >= TUNE.autoRounds) { finishRun(); return; } }
      else pl.ai.retry += 1;
      if (pl.ai.retry >= 3) { finishRun(); return; }
    } else if (pl.mode === 'party') {
      const q = pl.players[pl.cur];
      if (cleared) { q.clears += 1; q.bestRound = Math.max(q.bestRound, pl.round); } else q.out = true;
      pl.orderPos += 1;
      if (pl.orderPos >= pl.order.length) {
        // the round is over
        const alive = pl.players.map((p, i) => (p.out ? -1 : i)).filter((i) => i >= 0);
        if (alive.length === 1) { pl.winners = alive; finishRun(); return; }
        if (alive.length === 0) { pl.winners = pl.order.slice(); finishRun(); return; }
        pl.round += 1; pl.order = alive; pl.orderPos = 0;
      }
      pl.cur = pl.order[pl.orderPos];
    }
    beginAttempt(pl);
  }

  function finishRun() {
    const pl = state.pl, old = state.best;
    const res = { mode: pl.mode, score: pl.score, bestRound: pl.bestRound, clears: pl.clears, misses: pl.misses, attempts: pl.attempts, narrow: pl.narrow, bestBalance: pl.bestBalance, newBest: false };
    if (pl.mode === 'party') {
      res.players = pl.players.map((q) => ({ ...q })); res.winners = pl.winners ?? [0];
      res.bestRound = Math.max(-1, ...pl.players.map((q) => q.bestRound));
    }
    if (pl.mode === 'solo') {
      res.newBest = pl.score > old.score;
      state.best = { score: Math.max(old.score, pl.score), round: Math.max(old.round, pl.bestRound), games: old.games + 1 };
      storage.set('best', state.best);
    }
    env.monetization.track?.('game_end', { mode: pl.mode, score: pl.score, round: pl.bestRound });
    pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  // ---- controls ------------------------------------------------------------------------------------------------------------------------------
  function readControls(pl, input, P) {
    const p = input.pointer, k = input.keys, L = lay();
    let lean = 0, steer = 0;
    const goKey = k.pressed.has('Space') || k.pressed.has('Enter');
    // thumb: press anywhere (not on a button) anchors the origin; drag down leans, drag sideways steers
    if ((p.pressed || (p.down && !pl.origin)) && !inRect(P.pause, p.x, p.y) && !inRect(P.think, p.x, p.y) && !inRect(P.skip, p.x, p.y)) {
      const oy = Math.min(p.y, L.h - 24 - 90);
      pl.origin = { x: p.x, y: oy, range: Math.max(90, Math.min(TUNE.leanRange, L.h - 24 - oy)) };
      pl.touchGo = true;
    }
    if (pl.origin && p.down) {
      if (p.y < pl.origin.y) pl.origin.y = p.y;
      lean = Math.max(0, Math.min(1, (p.y - pl.origin.y) / pl.origin.range));
      steer = Math.max(-1, Math.min(1, (p.x - pl.origin.x) / TUNE.steerRange));
    } else if (!p.down) pl.origin = null;
    // keyboard
    const dt = 1 / 60;
    if (k.down.has('ArrowDown') || k.down.has('KeyS')) pl.kb = Math.min(1, pl.kb + 1.5 * dt); else pl.kb = Math.max(0, pl.kb - 2.6 * dt);
    if (k.down.has('ArrowUp') || k.down.has('KeyW')) pl.kb = Math.max(0, pl.kb - 3 * dt);
    lean = Math.max(lean, pl.kb);
    if (k.down.has('ArrowLeft') || k.down.has('KeyA')) steer -= 1;
    if (k.down.has('ArrowRight') || k.down.has('KeyD')) steer += 1;
    const go = goKey || pl.touchGo;
    pl.touchGo = false;
    return { lean, steer: Math.max(-1, Math.min(1, steer)), go };
  }
  function tryThink() {
    const pl = state.pl; if (!pl || pl.paused || pl.over || pl.mode === 'auto') return;
    if (pl.mode !== 'practice' && pl.thinkCool > 0) return;
    if (pl.thinkT > 0) return;
    pl.thinkT = TUNE.thinkSeconds; pl.thinkCool = pl.mode === 'practice' ? 0 : TUNE.thinkCooldown; pl.hint = { t: 0 };
    tone({ freq: 330, to: 440, dur: 0.25, type: 'sine', vol: 0.1 });
  }

  // ---- animation ---------------------------------------------------------------------------------------------------------------------------------
  function stepAnim(pl, dt) {
    stepParticles(pl.parts, dt);
    for (const p of pl.pops) p.age += dt;
    pl.pops = pl.pops.filter((p) => p.age < p.life);
    pl.shake = Math.max(0, pl.shake - dt * 3);
    pl.barGlow = Math.max(0, pl.barGlow - dt * 0.9);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > pl.banner.hold) pl.banner = null; }
    if (pl.att.phase === 'touch') pl.barFall = Math.min(1, pl.barFall + dt / 1.0);
    for (let i = later.length - 1; i >= 0; i--) { later[i].t -= dt; if (later[i].t <= 0) { later[i].fn(); later.splice(i, 1); } }
    if (pl.thinkT > 0 && pl.stage !== 'run') { pl.thinkT -= dt; if (pl.thinkT <= 0) { pl.thinkT = 0; pl.hint = null; } }
  }

  // ---- per-tick play update -----------------------------------------------------------------------------------------------------------------
  function updatePlay(dt, tap, input) {
    const pl = state.pl, P = lay().play;
    if (pl.hold) return;                                         // tester tool: a frozen frame for screenshots
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    if (input.keys.pressed.has('Escape')) { pausePlay(); return; }
    if (tap && inRect(P.pause, tap.x, tap.y)) { pausePlay(); return; }
    if (pl.mode !== 'auto' && ((tap && inRect(P.think, tap.x, tap.y)) || input.keys.pressed.has('KeyH'))) tryThink();
    pl.stageT += dt;
    if (pl.thinkCool > 0) pl.thinkCool = Math.max(0, pl.thinkCool - dt);
    const att = pl.att;
    // the beat plays whenever the show is on (not during an AI think/reveal, which freeze the clock)
    const frozen = pl.mode === 'auto' && pl.ai && (pl.ai.phase === 'think' || pl.ai.phase === 'reveal');
    if (!frozen && pl.stage !== 'intro') {
      pl.beatT += dt * (1 + Math.min(extraRounds(pl.round), 6) * 0.04);
      const n = Math.floor(pl.beatT / BEAT);
      while (pl.beatN < n) { pl.beatN += 1; beatSound(pl); }
    }
    if (pl.stage === 'intro') {
      const f = Math.min(1, pl.stageT / 0.7), e = 1 - (1 - f) * (1 - f);
      pl.barShown = pl.shownFrom + (pl.barTo - pl.shownFrom) * e;
      if (pl.stageT >= 1.0) { pl.barShown = pl.barTo; pl.stage = 'ready'; pl.stageT = 0; }
    } else if (pl.stage === 'ready') {
      if (pl.mode === 'auto') aiReady(pl, dt, tap);
      else {
        const c = readControls(pl, input, P);
        if (c.go) {
          if (config.demo && state.demoRuns >= DEMO_ATTEMPTS) { go('demo-limit'); return; }
          stepAttempt(att, dt, { go: true, lean: 0, steer: 0 }); pl.stage = 'run'; pl.stageT = 0; reactions(pl);
        }
      }
    } else if (pl.stage === 'run') {
      let c;
      if (pl.mode === 'auto') c = aiControl(att, pl.ai.plan, pl.ai.memo);
      else if (pl.autoDrive) { if (!pl.drive) pl.drive = { plan: aiPlan(pl.round), memo: {} }; c = aiControl(att, pl.drive.plan, pl.drive.memo); }
      else c = readControls(pl, input, P);
      let scale = 1;
      if (pl.thinkT > 0) { pl.thinkT -= dt; scale = TUNE.thinkScale; if (pl.thinkT <= 0) { pl.thinkT = 0; pl.hint = null; } }
      stepAttempt(att, dt * scale, c);
      reactions(pl);
      if (att.phase !== 'run') {
        pl.stage = 'after'; pl.afterT = 0; pl.hint = null; pl.thinkT = 0; pl.drive = null;
        if (pl.ai) { pl.ai.phase = 'wait'; pl.ai.note = att.phase === 'clear' ? 'Through! Notice how late the lean began and how steady the bubble stayed.' : 'That one touched. A miss shows where the margin was too small. Trying again.'; pl.ai.say = aiSay(pl); }
      }
    } else if (pl.stage === 'after') {
      stepAttempt(att, dt, { go: false, lean: 0, steer: 0 });
      pl.afterT += dt;
      if (pl.afterT >= AFTER[att.phase]) { nextAfter(pl); if (state.scene !== 'play') return; }
    }
    stepAnim(pl, dt);
  }
  // Watch and Learn between attempts: think -> reveal -> act, with the clock stopped while it explains.
  function aiReady(pl, dt, tap) {
    const ai = pl.ai, P = lay().play;
    ai.t += dt;
    const lim = ai.phase === 'think' ? state.prefs.thinkSec : AI_REVEAL;
    const skip = tap && inRect(P.skip, tap.x, tap.y);
    if (ai.t >= lim || skip) {
      if (ai.phase === 'think') { ai.phase = 'reveal'; ai.t = skip ? AI_REVEAL * 0.35 : 0; }
      else {
        ai.phase = 'act'; ai.t = 0;
        stepAttempt(pl.att, dt, { go: true, lean: 0, steer: 0 }); pl.stage = 'run'; pl.stageT = 0; reactions(pl);
      }
      ai.say = aiSay(pl);
    }
  }

  const pauseItems = () => ['resume', 'restart', 'rules', 'quit'];
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems();
    const M = menuRects(lay(), items.length);
    if (input.keys.pressed.has('Escape') && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart') startPlay(pl.mode);
      else if (it === 'rules') openDoc('rules', 'play');
      else go('title');
    });
  }

  // ---- menus and documents ------------------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'assist') p.assist = !p.assist;
    else if (id === 'thinkDec') p.thinkSec = Math.max(1, p.thinkSec - 1);
    else if (id === 'thinkInc') p.thinkSec = Math.min(10, p.thinkSec + 1);
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') { restorePurchase(); return; }
    savePrefs();
  }
  // Settings > Restore purchase: asks the store again; clear busy / found / not found / failed messages. Hidden in the web demo.
  function restorePurchase() {
    if (state.demo || state.owned || state.restoreBusy || !mon?.restore) return;
    state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
    Promise.resolve(mon.restore()).then(() => {
      state.owned = !!mon.owns('unlock_game');
      state.restoreMsg = state.owned ? 'Purchase restored. Thank you!' : 'No earlier purchase was found.';
    }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
  }
  function leaveDoc() {
    if (state.backTo === 'play') { if (state.pl) { state.scene = 'play'; state.sceneT = 0; } else go('title'); return; }   // back to the paused game
    go(state.backTo);
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
    if (k.has('Escape')) { leaveDoc(); return; }
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
    if (id === 'back') { leaveDoc(); return; }
    if (id === 'textDec' || id === 'textInc') {
      const n = state.prefs.textIdx + (id === 'textInc' ? 1 : -1);
      if (n < 0 || n >= TEXT_SCALES.length) return;
      state.docFrac = docMetrics.max > 0 ? state.docScroll / docMetrics.max : 0; state.docRescale = true;
      state.prefs.textIdx = n; savePrefs(); return;
    }
    if (id === 'prev') { if (state.rulesPage > 0) { state.rulesPage -= 1; state.docScroll = 0; } return; }
    if (id === 'next') { if (state.rulesPage < RULES.length - 1) { state.rulesPage += 1; state.docScroll = 0; } else leaveDoc(); return; }
    if (id.startsWith('set:')) settingsAction(id.slice(4));
  }

  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.play)) startPlay('solo');
    else if (hit(T.party)) { state.setupKind = 'party'; go('setup'); }
    else if (hit(T.prac)) { state.setupKind = 'practice'; go('setup'); }
    else if (hit(T.auto)) startPlay('auto');
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 90 && Math.abs(tap.x - T.credit.x) < 190) env.openArcforgeHome?.();
  }
  function updateSetup(tap) {
    if (!tap) return;
    const U = lay().setup, s = state.setup, party = state.setupKind === 'party';
    const save = () => storage.set('setup', s);
    if (inRect(U.back, tap.x, tap.y)) go('title');
    else if (inRect(U.aDec, tap.x, tap.y)) { if (party) s.players = Math.max(2, s.players - 1); else s.practiceRound = Math.max(0, s.practiceRound - 1); save(); }
    else if (inRect(U.aInc, tap.x, tap.y)) { if (party) s.players = Math.min(4, s.players + 1); else s.practiceRound = Math.min(TUNE.bars.length - 1, s.practiceRound + 1); save(); }
    else if (party && inRect(U.bDec, tap.x, tap.y)) { s.startRound = Math.max(0, s.startRound - 1); save(); }
    else if (party && inRect(U.bInc, tap.x, tap.y)) { s.startRound = Math.min(6, s.startRound + 1); save(); }
    else if (inRect(U.start, tap.x, tap.y)) startPlay(party ? 'party' : 'practice');
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay(state.result.mode);
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see ----------------------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc !== 'play') heroStep(dt);
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'setup') updateSetup(tap);
      else if (sc === 'play') updatePlay(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
    // Called by main.js when the app goes to the background.
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except the dancer actually walking is free: menus, Rules, Watch and Learn, waiting to start, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !(state.scene === 'play' && pl && pl.mode !== 'auto' && !pl.paused && !pl.over && (pl.stage === 'run' || pl.stage === 'after'));
    },
    // Tester tools (?dev=1 and store shots): jump to a screen and fast-forward.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.setup) Object.assign(state.setup, o.setup);
        const sc = o.scene ?? 'title';
        if (sc === 'play') {
          state.setupKind = o.mode === 'party' ? 'party' : 'practice';
          startPlay(o.mode ?? 'solo', { round: o.round ?? 0 });
          const pl = state.pl;
          if (o.score) pl.score = o.score;
          if (o.round !== undefined && pl.mode === 'solo') pl.round = o.round;
          pl.barShown = barHeight(pl.round); pl.barTo = pl.barShown; pl.shownFrom = pl.barShown;
          pl.stage = 'ready'; pl.banner = null;
          if (o.run) {
            pl.autoDrive = !o.noai;
            stepAttempt(pl.att, 1 / 60, { go: true, lean: 0, steer: 0 }); reactions(pl); pl.stage = 'run';
            if (o.wobble) { pl.att.wobble = o.wobble; pl.att.lean = o.lean ?? pl.att.lean; }
          }
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'setup') { state.setupKind = o.kind ?? 'practice'; go('setup'); }
        else if (sc === 'result') {
          startPlay(o.mode ?? 'solo');
          const pl = state.pl;
          Object.assign(pl, { score: 1840, clears: 7, bestRound: 6, misses: 3, narrow: 2, bestBalance: 0.82, attempts: 10 });
          if (pl.mode === 'party') { pl.players.forEach((q, i) => { q.bestRound = [6, 4, 5, 3][i]; q.clears = [7, 5, 6, 4][i]; q.out = i !== 0; }); pl.winners = [0]; }
          finishRun();
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) {
            const pl = state.pl;
            if (pl && pl.stage === 'run' && o.until === 'pass' && pl.att.x > -0.2 && pl.att.phase === 'run') break;
            if (pl && pl.stage === 'run' && o.untilX !== undefined && pl.att.x > o.untilX) break;
            if (pl && o.until === 'clear' && pl.att.phase === 'clear' && pl.att.sinceHit > 0.35) break;
            api.update(1 / 60, idle);
          }
          if (state.pl) { state.pl.autoDrive = false; if (o.hold) state.pl.hold = true; }
        }
        if (o.think && state.pl) tryThink();
      },
    },
  };
  return api;
}
